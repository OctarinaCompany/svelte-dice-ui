#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Ports Dice UI React components to shadcn-svelte, one at a time, by driving
    Claude Code in headless mode through the full Spec Kit cycle.

.DESCRIPTION
    For each component in scripts/components.json the orchestrator runs:

        create-feature -> specify -> plan -> tasks -> analyze -> remediate
                       -> implement -> verify (+ bounded fix loop)
                       -> converge (+ one extra implement/verify pass) -> commit

    Every Claude phase is a fresh `claude -p` process. Continuity comes from the
    files on disk plus SPECIFY_FEATURE_DIRECTORY / SPECIFY_FEATURE, which are set
    in the child process environment so each phase deterministically targets the
    right feature directory.

    Resume is the DEFAULT: phases already marked done are skipped. Use -Force to
    re-run them.

.EXAMPLE
    ./scripts/port-components.ps1 -DryRun
    Validate the manifest and render every prompt without calling the API.

.EXAMPLE
    ./scripts/port-components.ps1 -Bootstrap
    Run phase 0 (project scaffolding) and then port every component.

.EXAMPLE
    ./scripts/port-components.ps1 -Only status -Phases specify
    Smoke-test a single phase on a single component.

.EXAMPLE
    ./scripts/port-components.ps1 -From direction-provider -To gauge
    Port wave 0 plus the first part of wave 1.
#>
[CmdletBinding()]
param(
    # ---- selection -------------------------------------------------------
    [string[]]$Only,
    [string[]]$Skip,
    [string]$From,
    [string]$To,
    # Comma-separated is accepted, so this works both natively and via `pwsh -File`
    # (which passes `-Phases a,b` as a single string instead of splitting it).
    [string[]]$Phases,

    # ---- execution -------------------------------------------------------
    [switch]$Bootstrap,
    [switch]$BootstrapOnly,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$StopOnFailure,
    [switch]$NoConverge,
    [switch]$NoCommit,
    [switch]$NoRun,

    # ---- model / limits --------------------------------------------------
    # -Economy: complexity-aware model map. Keeps the strong model where a weak
    # answer is expensive (plan, analyze) and drops to the cheaper one where the
    # work is mechanical or the component is simple. See $EconomyModelMap.
    [switch]$Economy,
    [string]$Model,
    [string]$FallbackModel = 'sonnet',
    [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')][string]$Effort,
    [int]$MaxRetries = 2,
    [double]$TimeoutMinutes = 30,
    [double]$PhaseBudgetUsd = 0,
    [double]$TotalBudgetUsd = 300,

    # ---- plan usage limits (subscription logins) -------------------------
    # A usage limit is a WAIT, not a failure: it does not consume a retry.
    [double]$RateLimitWaitMinutes = 20,
    [int]$MaxRateLimitWaits = 36,
    # Pause before a usage window is exhausted, leaving headroom for interactive work.
    # Per-window because the two behave nothing alike: the 5-hour window is what a side project
    # must not monopolise, while the weekly one is the long-run ceiling. 0 disables a check.
    [int]$SessionStopPercent = 50,
    [int]$WeeklyStopPercent = 85,
    # 30 rather than 15: observed snapshots are typically 16-33 min old because the interactive
    # session renders sporadically, so 15 left the guard blind most of the time. A 30-minute-old
    # weekly reading is still near-exact; a 5-hour reading can drift ~10 points, which the lower
    # session threshold absorbs.
    [int]$UsageSnapshotMaxAgeMinutes = 30,
    [string]$UsageSnapshotPath = (Join-Path $HOME '.claude/usage-snapshot.json'),

    # ---- safety ----------------------------------------------------------
    [ValidateSet('bypass', 'allowlist')][string]$PermissionProfile = 'bypass',

    # ---- paths -----------------------------------------------------------
    [string]$ManifestPath = 'scripts/components.json',
    [string]$StatePath = '.port-state.json',
    [string]$LogRoot = '.port-logs'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'lib/port-common.ps1')

$RepoRoot = Get-PortRepoRoot
$ManifestFull = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $RepoRoot $ManifestPath }
$StateFull = if ([System.IO.Path]::IsPathRooted($StatePath)) { $StatePath } else { Join-Path $RepoRoot $StatePath }
$LogRootFull = if ([System.IO.Path]::IsPathRooted($LogRoot)) { $LogRoot } else { Join-Path $RepoRoot $LogRoot }
$LockPath = Join-Path $RepoRoot '.port-state.lock'
$PromptDir = Join-Path $PSScriptRoot 'prompts'
$SettingsPath = Join-Path $PSScriptRoot $(if ($PermissionProfile -eq 'allowlist') { 'port-permissions.json' } else { 'headless-settings.json' })

$RunId = (Get-Date).ToString('yyyyMMdd-HHmmss')

# `pwsh -File script.ps1 -Only a,b` passes "a,b" as one string, so split it ourselves.
function Split-ListArg {
    param([AllowNull()][string[]]$Values)
    if (-not $Values) { return @() }
    return @($Values | ForEach-Object { $_ -split '[,;]' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}
$Only = Split-ListArg $Only
$Skip = Split-ListArg $Skip
$Phases = Split-ListArg $Phases

# ===========================================================================
# Phase configuration
# ===========================================================================

$AllPhases = @('create-feature', 'specify', 'plan', 'tasks', 'analyze', 'remediate',
    'implement', 'verify', 'converge', 'commit')

$PhaseConfig = @{
    'specify'   = @{ Order = '01'; Template = '01-specify.md';   Model = 'sonnet'; Effort = 'medium'; Budget = 2;  TimeMul = 1.0; Format = 'json' }
    'plan'      = @{ Order = '02'; Template = '02-plan.md';      Model = 'opus';   Effort = 'high';   Budget = 3;  TimeMul = 1.0; Format = 'json' }
    'tasks'     = @{ Order = '03'; Template = '03-tasks.md';     Model = 'sonnet'; Effort = 'medium'; Budget = 2;  TimeMul = 1.0; Format = 'json' }
    # analyze runs on the strong model even by default: its job is to find what is
    # MISSING across spec/plan/tasks, and a weak answer there is invisible - it just
    # returns verdict "ready", the remediate phase is skipped, and nothing downstream
    # notices. It is also short and writes no code, so it is cheap to keep strong.
    'analyze'   = @{ Order = '04'; Template = '04-analyze.md';   Model = 'opus';   Effort = 'high';   Budget = 2;  TimeMul = 0.6; Format = 'json'; Schema = $true }
    'remediate' = @{ Order = '05'; Template = '05-remediate.md'; Model = 'sonnet'; Effort = 'high';   Budget = 2;  TimeMul = 1.0; Format = 'json' }
    'implement' = @{ Order = '06'; Template = '06-implement.md'; Model = 'opus';   Effort = 'high';   Budget = 15; TimeMul = 3.0; Format = 'stream-json'; Live = $true }
    'fix'       = @{ Order = '08'; Template = '08-fix.md';       Model = 'opus';   Effort = 'high';   Budget = 6;  TimeMul = 1.5; Format = 'stream-json'; Live = $true }
    'converge'  = @{ Order = '09'; Template = '09-converge.md';  Model = 'opus';   Effort = 'high';   Budget = 3;  TimeMul = 1.0; Format = 'json' }
}

$ComplexityMultiplier = @{ 'S' = 1.0; 'M' = 1.5; 'L' = 2.5 }

<#
-Economy model map. `Any` applies to every complexity; otherwise the component's
manifest `complexity` selects the entry.

Rationale, phase by phase:
  specify / tasks / remediate  transcription and decomposition - the cheaper model
                               is adequate, and this is already the default.
  plan                         defines the public API, the React->Svelte translation
                               and which modules get extracted for LATER components
                               to reuse (sortable's DnD core, mask-input's formatter,
                               color-swatch's colour helpers). A weak decision here
                               costs several components, not one.
  analyze                      the only net against coverage gaps; a weak answer is
                               silent. Never downgraded.
  implement / fix / converge   complexity-aware. The presentational components of
                               wave 1 do not need the strong model; combobox,
                               sortable, media-player and data-table do. `fix` in
                               particular is root-cause debugging from a compiler
                               digest, which is where model strength shows most.

This is a quality-preserving trim, not a large usage reduction: only the 10
S-complexity components change behaviour. For a real reduction use -Model sonnet.
#>
$EconomyModelMap = @{
    'specify'   = @{ Any = 'sonnet' }
    'tasks'     = @{ Any = 'sonnet' }
    'remediate' = @{ Any = 'sonnet' }
    'plan'      = @{ Any = 'opus' }
    'analyze'   = @{ Any = 'opus' }
    'implement' = @{ S = 'sonnet'; M = 'opus'; L = 'opus' }
    'fix'       = @{ S = 'sonnet'; M = 'opus'; L = 'opus' }
    'converge'  = @{ S = 'sonnet'; M = 'opus'; L = 'opus' }
}

$AnalyzeSchema = @'
{"type":"object","additionalProperties":false,"required":["criticalCount","highCount","mediumCount","lowCount","coveragePercent","verdict","findings"],"properties":{"criticalCount":{"type":"integer"},"highCount":{"type":"integer"},"mediumCount":{"type":"integer"},"lowCount":{"type":"integer"},"coveragePercent":{"type":"number"},"verdict":{"type":"string","enum":["ready","needs-remediation"]},"findings":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","category","severity","location","summary","recommendation"],"properties":{"id":{"type":"string"},"category":{"type":"string"},"severity":{"type":"string","enum":["CRITICAL","HIGH","MEDIUM","LOW"]},"location":{"type":"string"},"summary":{"type":"string"},"recommendation":{"type":"string"},"proposedEdit":{"type":"string"}}}}}}
'@ -replace '\r?\n', ''

# The verification gate. Ordered; stops at the first non-optional failure.
$GateSteps = @(
    @{ Name = 'install';  Launcher = 'pnpm'; Args = @('install', '--reporter', 'append-only'); TimeoutSec = 900;  Optional = $false; SkipUnlessDepsChanged = $true }
    @{ Name = 'sync';     Launcher = 'pnpm'; Args = @('exec', 'svelte-kit', 'sync');           TimeoutSec = 180;  Optional = $false }
    @{ Name = 'check';    Launcher = 'pnpm'; Args = @('run', 'check');                         TimeoutSec = 900;  Optional = $false }
    @{ Name = 'lint';     Launcher = 'pnpm'; Args = @('run', 'lint');                          TimeoutSec = 600;  Optional = $false }
    @{ Name = 'test';     Launcher = 'pnpm'; Args = @('run', 'test:unit', '--', '--run');      TimeoutSec = 1800; Optional = $false }
    @{ Name = 'build';    Launcher = 'pnpm'; Args = @('run', 'build');                         TimeoutSec = 1200; Optional = $false }
    @{ Name = 'registry'; Launcher = 'pnpm'; Args = @('run', 'registry:build');                TimeoutSec = 300;  Optional = $true }
)

$SuppressionPattern = '@ts-ignore|@ts-expect-error|eslint-disable|svelte-ignore|\.skip\(|\.todo\(|\bas any\b'
$ProtectedConfigFiles = @('tsconfig.json', 'eslint.config.js', 'eslint.config.mjs', 'vitest.config.ts', 'svelte.config.js', 'vite.config.ts')

# ===========================================================================
# Helpers
# ===========================================================================

function Get-PhaseTimeout {
    param([string]$Phase, [string]$Complexity)
    $cfg = $PhaseConfig[$Phase]
    $mul = if ($cfg) { [double]$cfg.TimeMul } else { 1.0 }
    $cmul = if ($ComplexityMultiplier.ContainsKey($Complexity)) { $ComplexityMultiplier[$Complexity] } else { 1.0 }
    return [int]([Math]::Ceiling($TimeoutMinutes * 60 * $mul * $cmul))
}

<#
Resolves the model for a phase. -Model overrides everything; -Economy applies the
complexity-aware map; otherwise the per-phase default from $PhaseConfig.
#>
function Get-PhaseModel {
    param([string]$Phase, [string]$Complexity)
    if ($Model) { return $Model }
    if ($Economy -and $EconomyModelMap.ContainsKey($Phase)) {
        $m = $EconomyModelMap[$Phase]
        if ($m.ContainsKey('Any')) { return $m['Any'] }
        if ($m.ContainsKey($Complexity)) { return $m[$Complexity] }
    }
    return $PhaseConfig[$Phase].Model
}

function Get-PhaseEffort {
    param([string]$Phase, [string]$Complexity)
    if ($Effort) { return $Effort }
    # Economy pairs the cheaper model with a lower effort tier on simple work.
    if ($Economy -and (Get-PhaseModel -Phase $Phase -Complexity $Complexity) -eq 'sonnet' `
        -and $Phase -in @('implement', 'fix', 'converge')) { return 'medium' }
    return $PhaseConfig[$Phase].Effort
}

function Get-PhaseBudget {
    param([string]$Phase, [string]$Complexity)
    if ($PhaseBudgetUsd -lt 0) { return 0 }        # sentinel: no cap (subscription login)
    if ($PhaseBudgetUsd -gt 0) { return $PhaseBudgetUsd }
    $cfg = $PhaseConfig[$Phase]
    if (-not $cfg) { return 0 }
    $cmul = if ($ComplexityMultiplier.ContainsKey($Complexity)) { $ComplexityMultiplier[$Complexity] } else { 1.0 }
    return [Math]::Round([double]$cfg.Budget * $cmul, 2)
}

function New-PhaseEnv {
    param([string]$FeatureDir, [string]$FeatureLabel)
    return @{
        SPECIFY_FEATURE_DIRECTORY = $FeatureDir
        SPECIFY_FEATURE           = $FeatureLabel
        SPECIFY_INIT_DIR          = $RepoRoot
    }
}

function New-PromptTokens {
    param([hashtable]$Component, [hashtable]$Ctx)
    $sourceList = ($Component.sourcePaths | ForEach-Object { "   - $_" }) -join "`n"
    return @{
        NAME          = $Component.name
        SLUG          = $Component.slug
        KIND          = $Component.kind
        DOCS_URL      = $Component.docsUrl
        DOCS_MDX      = $Component.docsMdx
        SOURCE_PATHS  = $sourceList
        FEATURE_DIR   = $Ctx.FeatureDir
        FEATURE_LABEL = $Ctx.FeatureLabel
        PROMPT_EXTRA  = $(if ($Component.promptExtra) { "COMPONENT-SPECIFIC GUIDANCE`n$($Component.promptExtra)" } else { '' })
        REPO_ROOT     = $RepoRoot
    }
}

function Test-PhaseArtifacts {
    param([string]$Phase, [hashtable]$Ctx)

    $fd = Join-Path $RepoRoot $Ctx.FeatureDir

    switch ($Phase) {
        'specify' {
            $p = Join-Path $fd 'spec.md'
            if (-not (Test-Path -LiteralPath $p)) { return @{ Ok = $false; Reason = 'spec.md missing' } }
            $c = [System.IO.File]::ReadAllText($p)
            if ($c.Length -lt 1500) { return @{ Ok = $false; Reason = "spec.md too small ($($c.Length) bytes)" } }
            if ($c -match '\[NEEDS CLARIFICATION') { return @{ Ok = $false; Reason = '[NEEDS CLARIFICATION] markers remain' } }
            if ($Ctx.SpecTemplateHash -and (Get-NormalizedHash -Path $p) -eq $Ctx.SpecTemplateHash) {
                return @{ Ok = $false; Reason = 'spec.md is still the unmodified template' }
            }
            $cl = Join-Path $fd 'checklists/requirements.md'
            if ((Test-Path -LiteralPath $cl) -and ([System.IO.File]::ReadAllText($cl) -match '(?m)^\s*-\s\[\s\]')) {
                return @{ Ok = $false; Reason = 'requirements checklist has unchecked items' }
            }
        }
        'plan' {
            $p = Join-Path $fd 'plan.md'
            if (-not (Test-Path -LiteralPath $p)) { return @{ Ok = $false; Reason = 'plan.md missing' } }
            $c = [System.IO.File]::ReadAllText($p)
            if ($c.Length -lt 1500) { return @{ Ok = $false; Reason = "plan.md too small ($($c.Length) bytes)" } }
            if ($c -match '\[PLACEHOLDER|\[TODO\]|\[NEEDS CLARIFICATION') { return @{ Ok = $false; Reason = 'placeholders remain in plan.md' } }
        }
        'tasks' {
            $p = Join-Path $fd 'tasks.md'
            if (-not (Test-Path -LiteralPath $p)) { return @{ Ok = $false; Reason = 'tasks.md missing' } }
            $n = ([regex]::Matches([System.IO.File]::ReadAllText($p), '(?m)^\s*-\s\[[ xX]\]\s*T\d+')).Count
            if ($n -lt 5) { return @{ Ok = $false; Reason = "only $n tasks generated" } }
        }
        'remediate' {
            $cl = Join-Path $fd 'checklists/requirements.md'
            if ((Test-Path -LiteralPath $cl) -and ([System.IO.File]::ReadAllText($cl) -match '(?m)^\s*-\s\[\s\]')) {
                return @{ Ok = $false; Reason = 'requirements checklist still has unchecked items' }
            }
        }
        'implement' {
            $uiDir = Join-Path $RepoRoot "src/lib/components/ui/$($Ctx.Slug)"
            if (-not (Test-Path -LiteralPath $uiDir)) { return @{ Ok = $false; Reason = "component directory missing: src/lib/components/ui/$($Ctx.Slug)" } }
            $svelte = Get-ChildItem -LiteralPath $uiDir -Filter *.svelte -Recurse -ErrorAction SilentlyContinue
            if (-not $svelte) { return @{ Ok = $false; Reason = 'no .svelte files in the component directory' } }
            if (Test-GitClean -RepoRoot $RepoRoot) { return @{ Ok = $false; Reason = 'no working-tree changes' } }
            $tp = Join-Path $fd 'tasks.md'
            if (Test-Path -LiteralPath $tp) {
                $t = [System.IO.File]::ReadAllText($tp)
                $tot = ([regex]::Matches($t, '(?m)^\s*-\s\[[ xX]\]')).Count
                $done = ([regex]::Matches($t, '(?m)^\s*-\s\[[xX]\]')).Count
                if ($tot -gt 0 -and ($done / $tot) -lt 0.8) {
                    return @{ Ok = $false; Reason = "only $done/$tot tasks marked complete" }
                }
            }
        }
    }
    return @{ Ok = $true; Reason = $null }
}

function Get-PhaseOutcome {
    param($Run, [string]$Phase, [hashtable]$Ctx)

    $proc = $Run.Proc
    $parsed = $Run.Parsed

    if ($proc.TimedOut) { return @{ Ok = $false; Reason = 'timeout'; Retryable = $true } }

    # A plan usage limit is a WAIT, not a failure - check it before anything else,
    # because it surfaces both as a non-zero exit and as an is_error result.
    $limitText = "$($proc.StdErr)`n$($proc.StdOut)" + $(if ($parsed) { "`n$($parsed.Result)" } else { '' })
    if ($proc.ExitCode -ne 0 -or ($parsed -and $parsed.IsError)) {
        $rl = Test-RateLimit -Text $limitText
        if ($rl.Hit) { return @{ Ok = $false; Reason = 'rate-limit'; Retryable = $true; RateLimit = $rl } }
    }

    if ($proc.ExitCode -ne 0) {
        $err = "$($proc.StdErr)`n$($proc.StdOut)"
        if ($err -match '(?i)invalid api key|not authenticated|unauthorized|\b401\b|credit balance') {
            return @{ Ok = $false; Reason = 'auth-or-quota'; Retryable = $false }
        }
        if ($err -match '(?i)unknown model|invalid model|model not found') {
            return @{ Ok = $false; Reason = 'bad-model'; Retryable = $false }
        }
        if ($err -match '(?i)budget (limit )?(exceeded|reached)') {
            return @{ Ok = $false; Reason = 'phase-budget'; Retryable = $false }
        }
        return @{ Ok = $false; Reason = "exit:$($proc.ExitCode)"; Retryable = $true }
    }

    if (-not $parsed) { return @{ Ok = $false; Reason = 'unparseable-output'; Retryable = $true } }
    if ($parsed.Subtype -eq 'error_max_turns') { return @{ Ok = $false; Reason = 'max-turns'; Retryable = $true } }
    if ($parsed.IsError) { return @{ Ok = $false; Reason = "is_error:$($parsed.Subtype)"; Retryable = $true } }

    # The PHASE_RESULT marker does not apply when a JSON output schema was supplied.
    $cfg = $PhaseConfig[$Phase]
    $schemaMode = ($cfg -and $cfg.ContainsKey('Schema') -and $cfg.Schema)
    $markerMissing = $false
    if (-not $schemaMode) {
        if ($parsed.Result -notmatch '(?m)^\s*PHASE_RESULT:\s*SUCCESS\b') {
            if ($parsed.Result -match '(?m)^\s*PHASE_RESULT:\s*FAILURE\b') {
                $why = ([regex]::Match($parsed.Result, '(?m)^\s*PHASE_RESULT:\s*FAILURE\s*-?\s*(.*)$')).Groups[1].Value
                return @{ Ok = $false; Reason = "self-reported-failure: $why"; Retryable = $true }
            }
            if (Test-AskedQuestion -Result $parsed.Result) {
                return @{ Ok = $false; Reason = 'asked-a-question'; Retryable = $true }
            }
            # Not an explicit failure and not a question - the model simply ended in prose. The
            # artifact contract is the ground truth here, so let it decide rather than discarding
            # work that may well be complete: a needless retry costs a full phase.
            $markerMissing = $true
        }
    }

    $art = Test-PhaseArtifacts -Phase $Phase -Ctx $Ctx
    if (-not $art.Ok) {
        $reason = if ($markerMissing) { "missing-result-marker (artifacts also failed: $($art.Reason))" }
                  else { "artifact: $($art.Reason)" }
        return @{ Ok = $false; Reason = $reason; Retryable = $true }
    }

    return @{ Ok = $true; Reason = $null; Retryable = $false; MarkerMissing = $markerMissing }
}

function Get-DepsHash {
    $parts = @()
    foreach ($f in @('package.json', 'pnpm-lock.yaml')) {
        $p = Join-Path $RepoRoot $f
        $parts += (Get-NormalizedHash -Path $p)
    }
    return ($parts -join '|')
}

function Invoke-VerifyGate {
    param([hashtable]$Ctx, [hashtable]$State)

    $results = @{}
    $depsHash = Get-DepsHash

    foreach ($step in $GateSteps) {
        $name = $step.Name

        if ($step.ContainsKey('SkipUnlessDepsChanged') -and $step.SkipUnlessDepsChanged) {
            if ($State.ContainsKey('lastDepsHash') -and $State.lastDepsHash -eq $depsHash) {
                Write-PortLog Debug "gate:$name skipped (dependencies unchanged)"
                $results[$name] = 'skip'
                continue
            }
        }

        $launcher = Resolve-Launcher -Name $step.Launcher
        $argv = @($launcher.Prefix) + $step.Args
        $logPath = Join-Path $Ctx.LogDir "07-verify-$name.log"

        Write-PortLog Step "gate:$name  ($($step.Launcher) $($step.Args -join ' '))"
        $r = Invoke-ExternalProcess -FilePath $launcher.File -Arguments $argv -LogPath $logPath `
            -TimeoutSeconds $step.TimeoutSec -WorkingDirectory $RepoRoot `
            -EnvVars @{ CI = '1'; NO_COLOR = '1'; FORCE_COLOR = '0'; npm_config_yes = 'true' }

        if ($r.TimedOut -or $r.ExitCode -ne 0) {
            if ($step.Optional) {
                Write-PortLog Warn "gate:$name failed but is optional - continuing."
                $results[$name] = 'skip'
                continue
            }
            $results[$name] = 'fail'
            return @{
                Ok       = $false
                Steps    = $results
                Failed   = $name
                Command  = "$($step.Launcher) $($step.Args -join ' ')"
                ExitCode = $(if ($r.TimedOut) { 'timeout' } else { $r.ExitCode })
                Output   = "$($r.StdOut)`n$($r.StdErr)"
                Remaining = (($GateSteps | Where-Object { $_.Name -ne $name -and -not $results.ContainsKey($_.Name) } | ForEach-Object { "$($_.Launcher) $($_.Args -join ' ')" }) -join '; ')
            }
        }

        $results[$name] = 'pass'
        if ($name -eq 'install') { $State.lastDepsHash = $depsHash }
    }

    $State.lastDepsHash = Get-DepsHash
    return @{ Ok = $true; Steps = $results; Failed = $null }
}

function Get-SuppressionViolations {
    $diff = (Invoke-Git -RepoRoot $RepoRoot diff --unified=0 -- src).Output
    $added = ($diff -split "`r?`n") | Where-Object { $_ -match '^\+' -and $_ -notmatch '^\+\+\+' }
    $cheats = @($added | Where-Object { $_ -match $SuppressionPattern })

    $changedConfigs = @()
    $names = (Invoke-Git -RepoRoot $RepoRoot diff --name-only).Output -split "`r?`n"
    foreach ($n in $names) {
        # `git diff --name-only` output ends with a newline, so splitting always yields a trailing
        # empty entry. Split-Path throws on an empty string, which would abort the whole run at the
        # exact moment the fix loop is meant to rescue it.
        $trimmed = $n.Trim()
        if (-not $trimmed) { continue }
        $leaf = Split-Path -Leaf $trimmed
        if ($leaf -and ($ProtectedConfigFiles -contains $leaf)) { $changedConfigs += $trimmed }
    }

    return @{ Lines = $cheats; Configs = $changedConfigs }
}

<#
Waits out a plan usage limit. Prefers the reset time carried in the error message;
otherwise sleeps -RateLimitWaitMinutes and probes again. Sleeps in one-minute
slices so Ctrl-C stays responsive during a multi-hour wait.
#>
function Wait-RateLimit {
    param($RateLimit, [int]$WaitNumber)

    $waitSec = [int]($RateLimitWaitMinutes * 60)
    $until = $null
    if ($RateLimit -and $RateLimit.ResetAt) {
        $until = $RateLimit.ResetAt.AddMinutes(1)
    } else {
        # The error text usually carries no reset time, which used to mean sleeping blind in
        # 20-minute increments - seven of them in one observed stall. The status-line snapshot
        # knows the exact reset, so prefer it before falling back to the fixed interval.
        $snap = Get-UsageSnapshot -Path $UsageSnapshotPath -MaxAgeMinutes $UsageSnapshotMaxAgeMinutes
        if ($snap.Available -and $snap.FiveHourResetsAt -and $snap.FiveHourResetsAt -gt (Get-Date)) {
            $until = $snap.FiveHourResetsAt.AddMinutes(1)
        }
    }
    if ($until) {
        $delta = [int]($until - (Get-Date)).TotalSeconds
        if ($delta -gt 0) { $waitSec = $delta }
    }
    # Never sleep more than 6 hours in one go, so a bogus timestamp cannot park the run forever.
    $waitSec = [Math]::Max(60, [Math]::Min($waitSec, 6 * 3600))

    $msg = "Plan usage limit reached (wait $WaitNumber of $MaxRateLimitWaits). Sleeping $(Format-Duration $waitSec)"
    if ($until) { $msg += " - until $($until.ToString('yyyy-MM-dd HH:mm'))" }
    Write-PortLog Warn "$msg. This does not consume a retry."
    if ($RateLimit -and $RateLimit.Evidence) { Write-PortLog Debug $RateLimit.Evidence }

    Start-DeadlineWait -Until ((Get-Date).AddSeconds($waitSec)) -Label 'usage limit'
}

<#
Runs a Claude invocation, transparently waiting out any plan usage limit.
Used by the phases that do not go through the main retry loop (fix, converge).
#>
function Wait-UsageHeadroom {
    <#
    .SYNOPSIS
        Pause between phases while a usage window is above its configured stop percentage.
    .DESCRIPTION
        The reactive waiter only fires once a limit has already been hit, which leaves nothing for
        the user's own interactive work. This stops earlier, at a configurable percentage, and
        sleeps until the window's exact reset time rather than guessing in fixed increments.

        Called only BETWEEN phases, so the state file always describes a valid boundary.

        Both windows are checked: exhausting the seven-day allowance would stall the run far longer
        than the five-hour one, and it is the window a multi-day port is most likely to burn.
    #>
    param([string]$Context = '')

    if ($SessionStopPercent -le 0 -and $WeeklyStopPercent -le 0) { return }

    $waits = 0
    while ($true) {
        $snap = Get-UsageSnapshot -Path $UsageSnapshotPath -MaxAgeMinutes $UsageSnapshotMaxAgeMinutes
        if (-not $snap.Available) {
            # Throttled by time, not by a flip-flop flag: the snapshot alternates between fresh and
            # stale as the interactive session renders sporadically, so a "warn once until fresh
            # again" rule fires on every alternation and buries the log in duplicates.
            if (-not $script:UsageGuardWarnedAt -or ((Get-Date) - $script:UsageGuardWarnedAt).TotalMinutes -ge 60) {
                Write-PortLog Warn ("Usage guard inactive ({0}). It needs an interactive Claude Code session open to refresh the snapshot; the run still stops reactively when a limit is hit." -f $snap.Reason)
                $script:UsageGuardWarnedAt = Get-Date
            }
            return
        }

        $over = @()
        if ($SessionStopPercent -gt 0 -and $snap.FiveHourPercent -ge $SessionStopPercent) {
            $over += @{ Name = "session $($snap.FiveHourPercent)%/$SessionStopPercent%"; Pct = $snap.FiveHourPercent; ResetsAt = $snap.FiveHourResetsAt }
        }
        if ($WeeklyStopPercent -gt 0 -and $snap.SevenDayPercent -ge $WeeklyStopPercent) {
            $over += @{ Name = "weekly $($snap.SevenDayPercent)%/$WeeklyStopPercent%"; Pct = $snap.SevenDayPercent; ResetsAt = $snap.SevenDayResetsAt }
        }
        if ($over.Count -eq 0) { return }

        # Wait out whichever breached window resets last, so one sleep clears them all.
        $worst = $over | Sort-Object { $_.ResetsAt } | Select-Object -Last 1
        $waits++
        if ($waits -gt $MaxRateLimitWaits) {
            Write-PortLog Warn "Usage guard exhausted its $MaxRateLimitWaits waits - continuing and letting the reactive waiter take over."
            return
        }

        $desc = ($over | ForEach-Object { $_.Name }) -join ', '
        if (-not $worst.ResetsAt) {
            Write-PortLog Warn "Usage guard: $desc but no reset time in the snapshot. Sleeping $(Format-Duration ([int]($RateLimitWaitMinutes * 60)))."
            $waitSec = [int]($RateLimitWaitMinutes * 60)
        } else {
            $waitSec = [int]($worst.ResetsAt.AddMinutes(1) - (Get-Date)).TotalSeconds
            Write-PortLog Warn ("Usage guard{0}: over threshold on $desc. Sleeping until $($worst.ResetsAt.ToString('yyyy-MM-dd HH:mm')) to leave you headroom." -f $(if ($Context) { " before $Context" } else { '' }))
        }
        $waitSec = [Math]::Max(60, [Math]::Min($waitSec, 8 * 3600))

        Start-DeadlineWait -Until ((Get-Date).AddSeconds($waitSec)) -Label 'usage guard' -ProgressEverySeconds 900
        # Loop round and re-read: the window may have reset late, or the other one may now breach.
    }
}

function Invoke-WithLimitWait {
    param([Parameter(Mandatory)][scriptblock]$Invoke)
    $waits = 0
    while ($true) {
        $run = & $Invoke
        if ($run.Proc.ExitCode -ne 0 -or ($run.Parsed -and $run.Parsed.IsError)) {
            $txt = "$($run.Proc.StdErr)`n$($run.Proc.StdOut)" + $(if ($run.Parsed) { "`n$($run.Parsed.Result)" } else { '' })
            $rl = Test-RateLimit -Text $txt
            if ($rl.Hit) {
                $waits++
                if ($waits -gt $MaxRateLimitWaits) { return $run }
                Wait-RateLimit -RateLimit $rl -WaitNumber $waits
                continue
            }
        }
        return $run
    }
}

function Wait-Backoff {
    param([int]$Attempt)
    $delay = [Math]::Min(600, 30 * [Math]::Pow(2, $Attempt - 1))
    $delay = $delay * (0.8 + (Get-Random -Minimum 0.0 -Maximum 0.4))
    $d = [int]$delay
    Write-PortLog Info "Backing off ${d}s before retry."
    Start-Sleep -Seconds $d
}

function New-PhaseRecord {
    return @{
        status = 'pending'; attempts = 0; startedAt = $null; finishedAt = $null; durationSec = 0
        sessionId = $null; exitCode = $null; timedOut = $false; isError = $false; subtype = $null
        numTurns = 0; costUsd = 0.0; model = $null; log = $null; resultJson = $null
        artifactsOk = $false; error = $null
    }
}

# `-NoRun` lets a test harness dot-source this file to exercise the helpers above
# without executing the pipeline. It must sit AFTER every function definition,
# because `return` in a dot-sourced script stops the rest of the file loading.
if ($NoRun) { return }

# ===========================================================================
# Manifest loading and selection
# ===========================================================================

if (-not (Test-Path -LiteralPath $ManifestFull)) { throw "Manifest not found: $ManifestFull" }
$Manifest = [System.IO.File]::ReadAllText($ManifestFull) | ConvertFrom-Json -Depth 50 -AsHashtable

$allComponents = @($Manifest.components | Where-Object { $_.enabled })
$slugs = $allComponents | ForEach-Object { $_.slug }
$dupes = $slugs | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dupes) { throw "Duplicate slug(s) in the manifest: $($dupes.Name -join ', ')" }

foreach ($c in $allComponents) {
    foreach ($d in $c.dependsOn) {
        if ($slugs -notcontains $d) { throw "Component '$($c.slug)' depends on unknown slug '$d'." }
    }
}

$selected = $allComponents
if ($From) {
    $i = [array]::IndexOf($slugs, $From)
    if ($i -lt 0) { throw "-From '$From' is not a known slug." }
    $selected = $selected | Where-Object { [array]::IndexOf($slugs, $_.slug) -ge $i }
}
if ($To) {
    $i = [array]::IndexOf($slugs, $To)
    if ($i -lt 0) { throw "-To '$To' is not a known slug." }
    $selected = $selected | Where-Object { [array]::IndexOf($slugs, $_.slug) -le $i }
}
if ($Only) {
    foreach ($o in $Only) { if ($slugs -notcontains $o) { throw "-Only '$o' is not a known slug." } }
    $selected = $selected | Where-Object { $Only -contains $_.slug }
}
if ($Skip) { $selected = $selected | Where-Object { $Skip -notcontains $_.slug } }
$selected = @($selected)

if ($Phases) {
    $badPhases = @($Phases | Where-Object { $AllPhases -notcontains $_ })
    if ($badPhases.Count -gt 0) { throw "Unknown phase(s): $($badPhases -join ', '). Valid phases: $($AllPhases -join ', ')" }
}
$activePhases = if ($Phases) { @($AllPhases | Where-Object { $Phases -contains $_ }) } else { @($AllPhases) }
if ($NoConverge) { $activePhases = @($activePhases | Where-Object { $_ -ne 'converge' }) }
if ($NoCommit) { $activePhases = @($activePhases | Where-Object { $_ -ne 'commit' }) }

# ===========================================================================
# Billing mode
#
# A subscription login (claude.ai OAuth) is billed against the plan's usage
# limits, not per token, so `--max-budget-usd` and the dollar accumulator measure
# nothing. Disable them and let the rate-limit waiter be the real regulator.
# ===========================================================================

$authInfo = Get-ClaudeAuthInfo
$UsesSubscription = Test-UsesSubscription -AuthInfo $authInfo

if ($UsesSubscription) {
    $script:AuthSummary = "Auth     : $($authInfo.authMethod) subscription ($($authInfo.subscriptionType)) - billed against plan usage limits, not per token."
    if (-not $PSBoundParameters.ContainsKey('TotalBudgetUsd')) { $TotalBudgetUsd = 0 }
    if (-not $PSBoundParameters.ContainsKey('PhaseBudgetUsd')) { $PhaseBudgetUsd = -1 }
} elseif ($authInfo) {
    $script:AuthSummary = "Auth     : $($authInfo.authMethod) / $($authInfo.apiProvider) - per-token billing, dollar guards active."
} else {
    $script:AuthSummary = 'Auth     : could not read `claude auth status`; assuming per-token billing.'
}

# ===========================================================================
# Dry run
# ===========================================================================

if ($DryRun) {
    Write-Host ''
    Write-PortLog Step "DRY RUN - no process will be launched and nothing will be written."
    Write-PortLog Info "Repo root      : $RepoRoot"
    Write-PortLog Info "Manifest       : $ManifestFull ($($allComponents.Count) enabled components)"
    Write-PortLog Info "Settings       : $SettingsPath  (profile: $PermissionProfile)"
    Write-PortLog Info ($script:AuthSummary -replace '^Auth\s+:', 'Auth           :')
    Write-PortLog Info "Phases         : $($activePhases -join ' -> ')"
    Write-PortLog Info "Selected       : $($selected.Count) component(s)"
    Write-Host ''

    $systemPrompt = [System.IO.File]::ReadAllText((Join-Path $PromptDir 'system-noninteractive.txt'))
    Write-PortLog Info "System prompt  : $($systemPrompt.Length) chars"

    $table = foreach ($c in $selected) {
        $n = ([array]::IndexOf($slugs, $c.slug) + 1)
        $row = [ordered]@{
            '#'        = $n
            Slug       = $c.slug
            Wave       = $c.wave
            Cx         = $c.complexity
            FeatureDir = ('specs/{0:000}-port-{1}' -f $n, $c.slug)
            Implement  = (Format-Duration (Get-PhaseTimeout 'implement' $c.complexity))
            Models     = (($AllPhases | Where-Object { $PhaseConfig.ContainsKey($_) } |
                            ForEach-Object { Get-PhaseModel -Phase $_ -Complexity $c.complexity } |
                            Sort-Object -Unique) -join '+')
        }
        if (-not $UsesSubscription) {
            $row['Est$'] = [Math]::Round((($PhaseConfig.Keys | ForEach-Object { Get-PhaseBudget $_ $c.complexity } | Measure-Object -Sum).Sum), 1)
        }
        [pscustomobject]$row
    }
    $table | Format-Table -AutoSize | Out-String | Write-Host

    Write-PortLog Step $(if ($Model) { "Model map (overridden by -Model $Model)" }
                         elseif ($Economy) { 'Model map (-Economy: complexity-aware)' }
                         else { 'Model map (default)' })
    $modelRows = foreach ($ph in ($AllPhases + 'fix' | Where-Object { $PhaseConfig.ContainsKey($_) })) {
        [pscustomobject]@{
            Phase = $ph
            S     = ('{0}/{1}' -f (Get-PhaseModel $ph 'S'), (Get-PhaseEffort $ph 'S'))
            M     = ('{0}/{1}' -f (Get-PhaseModel $ph 'M'), (Get-PhaseEffort $ph 'M'))
            L     = ('{0}/{1}' -f (Get-PhaseModel $ph 'L'), (Get-PhaseEffort $ph 'L'))
        }
    }
    $modelRows | Format-Table -AutoSize | Out-String | Write-Host
    if ($Economy) {
        $sCount = @($selected | Where-Object { $_.complexity -eq 'S' }).Count
        Write-PortLog Info "-Economy changes behaviour for the $sCount S-complexity component(s) of this selection only; plan and analyze always stay on the strong model. For a real usage reduction use -Model sonnet."
    }

    if ($UsesSubscription) {
        Write-PortLog Info 'No dollar caps: this run is billed against your plan usage limits. When a limit is hit the run pauses and resumes itself.'
        Write-PortLog Warn 'Opus has a tighter allowance than Sonnet on subscription plans. `-Model sonnet` runs everything on Sonnet if you want the 38 components to fit in fewer usage windows.'
    } else {
        $worstCase = ($table.'Est$' | Measure-Object -Sum).Sum
        Write-PortLog Info ("Worst-case budget across the selection: {0:N0} USD - the sum of the per-phase --max-budget-usd caps, NOT an estimate of actual spend (real runs land far below the caps)." -f $worstCase)
        if ($TotalBudgetUsd -gt 0 -and $worstCase -gt $TotalBudgetUsd) {
            Write-PortLog Warn ("The global cap is {0:N0} USD (-TotalBudgetUsd). The run aborts cleanly between phases when actual spend reaches it; resume afterwards with a higher cap." -f $TotalBudgetUsd)
        }
    }

    Write-PortLog Step 'Rendering every prompt template for every selected component...'
    $rendered = 0
    foreach ($c in $selected) {
        $n = ([array]::IndexOf($slugs, $c.slug) + 1)
        $ctx = @{ FeatureDir = ('specs/{0:000}-port-{1}' -f $n, $c.slug); FeatureLabel = ('{0:000}-port-{1}' -f $n, $c.slug); Slug = $c.slug }
        $tokens = New-PromptTokens -Component $c -Ctx $ctx
        foreach ($phase in $PhaseConfig.Keys) {
            $t = $tokens.Clone()
            $t['FINDINGS_JSON'] = '{}'
            $t['ATTEMPT'] = '1'; $t['MAX_ATTEMPTS'] = "$MaxRetries"; $t['STEP'] = 'check'
            $t['COMMAND'] = 'pnpm run check'; $t['EXIT_CODE'] = '1'; $t['DIGEST'] = '(digest)'
            $t['REMAINING_STEPS'] = 'lint; test; build'; $t['CHEAT_WARNING'] = ''
            $null = Expand-PromptTemplate -Path (Join-Path $PromptDir $PhaseConfig[$phase].Template) -Tokens $t
            $rendered++
        }
    }
    Write-PortLog Ok "$rendered prompts rendered, no unreplaced tokens."

    if ($selected.Count -gt 0) {
        $c = $selected[0]
        $n = ([array]::IndexOf($slugs, $c.slug) + 1)
        $ctx = @{ FeatureDir = ('specs/{0:000}-port-{1}' -f $n, $c.slug); FeatureLabel = ('{0:000}-port-{1}' -f $n, $c.slug); Slug = $c.slug }
        $tokens = New-PromptTokens -Component $c -Ctx $ctx
        $prompt = Expand-PromptTemplate -Path (Join-Path $PromptDir '01-specify.md') -Tokens $tokens
        Write-Host ''
        Write-PortLog Step "Example: first phase of the first selected component ($($c.slug) / specify)"
        Write-Host "--- command ---------------------------------------------------------" -ForegroundColor DarkGray
        $cfg = $PhaseConfig['specify']
        $exampleArgs = @('claude', '-p', '--output-format', $cfg.Format,
            '--model', (Get-PhaseModel 'specify' $c.complexity),
            '--fallback-model', $FallbackModel, '--effort', (Get-PhaseEffort 'specify' $c.complexity),
            '--max-budget-usd', (Get-PhaseBudget 'specify' $c.complexity),
            '--append-system-prompt', '<system-noninteractive.txt>', '--settings', $SettingsPath,
            '--setting-sources', 'project,local', '--session-id', '<guid>')
        $exampleArgs += $(if ($PermissionProfile -eq 'bypass') { '--dangerously-skip-permissions' } else { '--permission-mode acceptEdits' })
        Write-Host ($exampleArgs -join ' ')
        Write-Host "  < stdin: the prompt below   ($($prompt.Length) chars)"
        Write-Host "--- env -------------------------------------------------------------" -ForegroundColor DarkGray
        (New-PhaseEnv -FeatureDir $ctx.FeatureDir -FeatureLabel $ctx.FeatureLabel).GetEnumerator() |
            ForEach-Object { Write-Host "  $($_.Key)=$($_.Value)" }
        Write-Host "--- stdin -----------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host $prompt
        Write-Host "---------------------------------------------------------------------" -ForegroundColor DarkGray
    }

    Write-Host ''
    if (Test-Path -LiteralPath $StateFull) {
        Write-PortLog Info "An existing state file was found at $StateFull (untouched by this dry run)."
    }
    Write-PortLog Ok 'Dry run complete. Nothing was written.'
    return
}

# ===========================================================================
# Real run
# ===========================================================================

Set-PortRunLog -Path (Join-Path $LogRootFull "_runs/$RunId.log")
Write-PortLog Step "Port run $RunId starting."
Write-PortLog Info "Repo root: $RepoRoot"
Write-PortLog Info "Phases   : $($activePhases -join ' -> ')"
Write-PortLog Info "Selection: $($selected.Count) component(s): $(($selected | ForEach-Object { $_.slug }) -join ', ')"
Write-PortLog Info "Profile  : $PermissionProfile   Settings: $SettingsPath"
Write-PortLog Info $script:AuthSummary
if ($UsesSubscription) {
    Write-PortLog Info "Usage limits: a limit pauses the run (up to $RateLimitWaitMinutes min per wait, max $MaxRateLimitWaits waits) without consuming a retry."
}
if ($PermissionProfile -eq 'bypass') {
    Write-PortLog Warn 'Running with --dangerously-skip-permissions. Every component is committed and tagged, so damage is one `git reset --hard port/<prev>` away.'
}

Lock-PortRun -Path $LockPath
try {
    $State = Read-PortState -Path $StateFull
    $State.status = 'running'
    $State.lastRunId = $RunId
    if (-not $State.ContainsKey('lastDepsHash')) { $State.lastDepsHash = $null }

    # ---- bootstrap -------------------------------------------------------
    if ($Bootstrap -or $BootstrapOnly) {
        Write-PortLog Step 'Running bootstrap (phase 0).'
        $bootstrapScript = Join-Path $PSScriptRoot 'bootstrap.ps1'
        Save-PortState -State $State -Path $StateFull
        Unlock-PortRun -Path $LockPath
        $bootstrapArgs = @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $bootstrapScript,
            '-StatePath', $StateFull, '-LogRoot', $LogRootFull,
            '-PermissionProfile', $PermissionProfile, '-TimeoutMinutes', ([string]$TimeoutMinutes)
        )
        if ($Force) { $bootstrapArgs += '-Force' }
        & (Get-PwshPath) @bootstrapArgs
        $bootstrapExit = $LASTEXITCODE
        Lock-PortRun -Path $LockPath
        $State = Read-PortState -Path $StateFull
        $State.status = 'running'
        if ($bootstrapExit -ne 0) {
            Write-PortLog Error "Bootstrap failed (exit $bootstrapExit). Aborting: there is no point porting components onto a broken skeleton."
            $State.status = 'aborted-failure'
            Save-PortState -State $State -Path $StateFull
            exit 1
        }
        Write-PortLog Ok 'Bootstrap complete.'
        if ($BootstrapOnly) {
            $State.status = 'idle'
            Save-PortState -State $State -Path $StateFull
            exit 0
        }
    }

    if (-not $State.upstreamCommit) {
        $refPath = Join-Path $RepoRoot $Manifest.upstream.clonePath
        if (Test-Path -LiteralPath $refPath) {
            $State.upstreamCommit = (Invoke-Git -RepoRoot $refPath rev-parse HEAD).Output.Trim()
        }
    }

    $systemPrompt = [System.IO.File]::ReadAllText((Join-Path $PromptDir 'system-noninteractive.txt'))
    $specTemplateHash = Get-NormalizedHash -Path (Join-Path $RepoRoot '.specify/templates/spec-template.md')

    $aborted = $null

    foreach ($component in $selected) {
        $slug = $component.slug
        $order = ([array]::IndexOf($slugs, $slug) + 1)
        $complexity = $component.complexity

        if (-not $State.components.ContainsKey($slug)) {
            $State.components[$slug] = @{
                status = 'pending'; order = $order; featureDir = $null; featureLabel = $null; featureNum = $null
                startedAt = $null; finishedAt = $null; durationSec = 0; costUsd = 0.0
                commit = $null; tag = $null; failureReason = $null; phases = @{}
            }
        }
        $cs = $State.components[$slug]
        if ($Force) {
            foreach ($k in @($cs.phases.Keys)) { $cs.phases[$k].status = 'pending' }
            $cs.status = 'pending'; $cs.failureReason = $null
        }
        if ($cs.status -eq 'done' -and -not $Force) {
            Write-PortLog Info "$slug already done - skipping (use -Force to redo)."
            continue
        }

        Write-Host ''
        Write-PortLog Step "===== [$order/$($slugs.Count)] $($component.name)  ($slug, wave $($component.wave), complexity $complexity) ====="

        $cs.status = 'running'
        $cs.startedAt = (Get-Date).ToString('o')
        $componentStart = [System.Diagnostics.Stopwatch]::StartNew()
        $logDir = Join-Path $LogRootFull $slug
        $componentFailed = $null

        # ---- phase 00: create the feature directory ----------------------
        # Every later phase needs a feature directory, so this is a prerequisite rather than
        # an optional phase: run it whenever one has not been resolved yet, even if -Phases
        # did not name it. Already-created features are skipped by the `status -ne 'done'`
        # check below, so this never renumbers an existing feature.
        if (($activePhases -contains 'create-feature') -or (-not $cs.featureDir)) {
            $rec = if ($cs.phases.ContainsKey('create-feature')) { $cs.phases['create-feature'] } else { New-PhaseRecord }
            $cs.phases['create-feature'] = $rec
            if ($rec.status -ne 'done') {
                Write-PortLog Step 'phase 00 create-feature'
                $desc = "Port the Dice UI $($component.name) component to shadcn-svelte"
                $r = Invoke-ExternalProcess -FilePath (Get-PwshPath) -Arguments @(
                    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                    '-File', (Join-Path $RepoRoot '.specify/scripts/powershell/create-new-feature.ps1'),
                    '-Json', '-AllowExistingBranch', '-ShortName', "port-$slug", $desc
                ) -LogPath (Join-Path $logDir '00-create-feature.log') -TimeoutSeconds 120 `
                  -WorkingDirectory $RepoRoot -EnvVars @{ SPECIFY_INIT_DIR = $RepoRoot }

                $jsonLine = ($r.StdOut -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
                if ($r.ExitCode -ne 0 -or -not $jsonLine) {
                    $componentFailed = "create-feature failed (exit $($r.ExitCode)). See $($r.LogPath)"
                } else {
                    $fj = $jsonLine | ConvertFrom-Json
                    $cs.featureLabel = $fj.BRANCH_NAME
                    $cs.featureNum = $fj.FEATURE_NUM
                    $cs.featureDir = "specs/$($fj.BRANCH_NAME)"
                    $rec.status = 'done'; $rec.finishedAt = (Get-Date).ToString('o'); $rec.artifactsOk = $true
                    Write-PortLog Ok "feature dir: $($cs.featureDir)"
                }
                Save-PortState -State $State -Path $StateFull
            }
        }

        if (-not $componentFailed -and -not $cs.featureDir) {
            $componentFailed = 'no feature directory resolved (run the create-feature phase first)'
        }

        $ctx = @{
            Slug             = $slug
            FeatureDir       = $cs.featureDir
            FeatureLabel     = $cs.featureLabel
            LogDir           = $logDir
            SpecTemplateHash = $specTemplateHash
        }
        $phaseEnv = if ($cs.featureDir) { New-PhaseEnv -FeatureDir $cs.featureDir -FeatureLabel $cs.featureLabel } else { @{} }
        $tokens = if ($cs.featureDir) { New-PromptTokens -Component $component -Ctx $ctx } else { @{} }

        # ---- the Claude-driven phases ------------------------------------
        $analyzeResult = $null

        foreach ($phase in @('specify', 'plan', 'tasks', 'analyze', 'remediate', 'implement')) {
            if ($componentFailed) { break }
            if ($activePhases -notcontains $phase) { continue }

            $cfg = $PhaseConfig[$phase]
            $rec = if ($cs.phases.ContainsKey($phase)) { $cs.phases[$phase] } else { New-PhaseRecord }
            $cs.phases[$phase] = $rec
            if ($rec.status -eq 'done') { Write-PortLog Debug "phase $($cfg.Order) $phase already done - skipping."; continue }
            if ($rec.status -eq 'skipped') { continue }

            # remediate only runs when analyze asked for it
            if ($phase -eq 'remediate') {
                $needs = $false
                if ($analyzeResult) {
                    $needs = ($analyzeResult.verdict -eq 'needs-remediation') -or
                             (([int]$analyzeResult.criticalCount + [int]$analyzeResult.highCount) -gt 0)
                } elseif ($cs.phases.ContainsKey('analyze') -and $cs.phases['analyze'].ContainsKey('verdict')) {
                    $needs = $cs.phases['analyze'].verdict -eq 'needs-remediation'
                }
                if (-not $needs) {
                    Write-PortLog Ok 'phase 05 remediate not needed (analysis verdict: ready).'
                    $rec.status = 'skipped'
                    Save-PortState -State $State -Path $StateFull
                    continue
                }
                $tokens['FINDINGS_JSON'] = ($analyzeResult | ConvertTo-Json -Depth 20)
            }

            $timeout = Get-PhaseTimeout $phase $complexity
            $budget = Get-PhaseBudget $phase $complexity
            # NOT $model / $effort: PowerShell variable names are case-insensitive, so those would
            # be the script's own -Model / -Effort parameters. Assigning them would make the first
            # phase's resolution sticky for every later phase (Get-PhaseModel returns $Model first).
            $phaseModel = Get-PhaseModel -Phase $phase -Complexity $complexity
            $phaseEffort = Get-PhaseEffort -Phase $phase -Complexity $complexity
            $basePrompt = Expand-PromptTemplate -Path (Join-Path $PromptDir $cfg.Template) -Tokens $tokens

            $ok = $false
            $rateLimitWaits = 0
            for ($attempt = 1; $attempt -le ($MaxRetries + 1); $attempt++) {
                $rec.attempts = $attempt
                $rec.status = 'running'
                $rec.startedAt = (Get-Date).ToString('o')
                $rec.model = $phaseModel
                Save-PortState -State $State -Path $StateFull

                $prompt = $basePrompt
                if ($attempt -gt 1) {
                    $prefix = "RETRY $attempt of $($MaxRetries + 1). The previous attempt failed: $($rec.error).`n"
                    if ($rec.error -match 'asked-a-question') {
                        $prefix += "You ended your previous turn with a question. There is no human to answer it. Decide yourself and complete the work.`n"
                    }
                    if ($rec.error -match 'artifact:') {
                        $prefix += "The expected artifact check failed. Produce it this time.`n"
                    }
                    if ($rec.error -match 'missing-result-marker') {
                        $prefix += "Your previous turn did not end with the required PHASE_RESULT block. End with it this time.`n"
                    }
                    $prompt = "$prefix`n$basePrompt"
                }

                $logPath = Join-Path $logDir ("{0}-{1}{2}.log" -f $cfg.Order, $phase, $(if ($attempt -gt 1) { ".retry$attempt" } else { '' }))
                # Checked here rather than mid-phase: pausing between phases keeps the state file
                # on a valid boundary, so a Ctrl-C during the wait resumes cleanly.
                Wait-UsageHeadroom -Context "$slug/$phase"

                Write-PortLog Step "phase $($cfg.Order) $phase  (attempt $attempt, model $phaseModel, timeout $(Format-Duration $timeout), cap `$$budget)"

                $run = Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $prompt -LogPath $logPath `
                    -SystemPrompt $systemPrompt -SettingsPath $SettingsPath -TimeoutSeconds $timeout `
                    -EnvVars $phaseEnv -Model $phaseModel -FallbackModel $FallbackModel -Effort $phaseEffort `
                    -BudgetUsd $budget -Format $cfg.Format `
                    -JsonSchema $(if ($cfg.ContainsKey('Schema') -and $cfg.Schema) { $AnalyzeSchema } else { $null }) `
                    -PermissionProfile $PermissionProfile `
                    -LiveLog:$(if ($cfg.ContainsKey('Live') -and $cfg.Live) { $true } else { $false })

                $rec.sessionId = $run.SessionId
                $rec.exitCode = $run.Proc.ExitCode
                $rec.timedOut = $run.Proc.TimedOut
                $rec.durationSec = $run.Proc.DurationSec
                $rec.log = $logPath
                $rec.resultJson = [System.IO.Path]::ChangeExtension($logPath, '.result.json')
                if ($run.Parsed) {
                    $rec.isError = $run.Parsed.IsError
                    $rec.subtype = $run.Parsed.Subtype
                    $rec.numTurns = $run.Parsed.NumTurns
                    $rec.costUsd = $run.Parsed.CostUsd
                    $cs.costUsd += $run.Parsed.CostUsd
                    $State.totals.costUsd += $run.Parsed.CostUsd
                }

                $outcome = Get-PhaseOutcome -Run $run -Phase $phase -Ctx $ctx
                $rec.error = $outcome.Reason
                $rec.artifactsOk = $outcome.Ok
                $rec.finishedAt = (Get-Date).ToString('o')

                if ($outcome.Ok) {
                    $rec.status = 'done'
                    if ($outcome.MarkerMissing) {
                        Write-PortLog Warn "phase $phase ended without the PHASE_RESULT marker, but its artifact contract passed - accepting."
                    }
                    Write-PortLog Ok ("phase {0} {1} done in {2} ({3} turns, `${4:N2})" -f $cfg.Order, $phase, (Format-Duration $rec.durationSec), $rec.numTurns, $rec.costUsd)

                    if ($phase -eq 'analyze' -and $run.Parsed) {
                        try {
                            $txt = $run.Parsed.Result.Trim()
                            $i = $txt.IndexOf('{')
                            if ($i -gt 0) { $txt = $txt.Substring($i) }
                            $analyzeResult = $txt | ConvertFrom-Json -Depth 50
                            $rec.verdict = $analyzeResult.verdict
                            Write-PortLog Info ("analysis verdict: {0} (critical {1}, high {2}, coverage {3}%)" -f `
                                $analyzeResult.verdict, $analyzeResult.criticalCount, $analyzeResult.highCount, $analyzeResult.coveragePercent)
                        } catch {
                            Write-PortLog Warn "Could not parse the analysis JSON: $($_.Exception.Message). Treating it as needs-remediation."
                            $rec.verdict = 'needs-remediation'
                            $analyzeResult = [pscustomobject]@{ verdict = 'needs-remediation'; criticalCount = 0; highCount = 0; findings = @() }
                        }
                    }

                    $ok = $true
                    Save-PortState -State $State -Path $StateFull
                    break
                }

                # A plan usage limit is a wait, not a failed attempt.
                if ($outcome.Reason -eq 'rate-limit') {
                    $rateLimitWaits++
                    $rec.status = 'waiting'
                    Save-PortState -State $State -Path $StateFull
                    if ($rateLimitWaits -gt $MaxRateLimitWaits) {
                        Write-PortLog Error "Plan usage limit still active after $MaxRateLimitWaits waits. Aborting; resume later with the same command."
                        $aborted = 'rate-limit'
                        break
                    }
                    Wait-RateLimit -RateLimit $outcome.RateLimit -WaitNumber $rateLimitWaits
                    $attempt--   # the for-loop increment cancels this out
                    continue
                }

                $rec.status = 'failed'
                Write-PortLog Warn "phase $($cfg.Order) $phase failed: $($outcome.Reason)"
                Save-PortState -State $State -Path $StateFull

                if (-not $outcome.Retryable) {
                    if ($outcome.Reason -eq 'auth-or-quota') { $aborted = 'auth-or-quota' }
                    break
                }
                if ($attempt -le $MaxRetries) { Wait-Backoff -Attempt $attempt }
            }

            if (-not $ok) { $componentFailed = "phase '$phase': $($rec.error)" }
            if ($aborted) { break }

            if ($TotalBudgetUsd -gt 0 -and $State.totals.costUsd -ge $TotalBudgetUsd) {
                Write-PortLog Error ("Global budget exhausted: {0:N2} / {1:N2} USD." -f $State.totals.costUsd, $TotalBudgetUsd)
                $aborted = 'budget'
                break
            } elseif ($TotalBudgetUsd -gt 0 -and $State.totals.costUsd -ge ($TotalBudgetUsd * 0.8)) {
                Write-PortLog Warn ("80% of the global budget consumed ({0:N2} / {1:N2} USD)." -f $State.totals.costUsd, $TotalBudgetUsd)
            }
        }

        # ---- phase 07/08: verification gate and bounded fix loop ---------
        if (-not $componentFailed -and -not $aborted -and $activePhases -contains 'verify') {
            $rec = if ($cs.phases.ContainsKey('verify')) { $cs.phases['verify'] } else { New-PhaseRecord }
            $cs.phases['verify'] = $rec
            if ($rec.status -ne 'done') {
                $gate = $null
                for ($attempt = 0; $attempt -le $MaxRetries; $attempt++) {
                    $rec.attempts = $attempt + 1
                    $rec.status = 'running'
                    Write-PortLog Step "phase 07 verify (pass $($attempt + 1))"
                    $gate = Invoke-VerifyGate -Ctx $ctx -State $State
                    $rec.steps = $gate.Steps
                    Save-PortState -State $State -Path $StateFull
                    if ($gate.Ok) { break }

                    Write-PortLog Warn "gate failed at step '$($gate.Failed)' (exit $($gate.ExitCode))."
                    if ($attempt -eq $MaxRetries) { break }

                    $viol = Get-SuppressionViolations
                    $cheatWarning = ''
                    if ($viol.Lines.Count -gt 0 -or $viol.Configs.Count -gt 0) {
                        Write-PortLog Warn "Suppression attempt detected: $($viol.Lines.Count) line(s), $($viol.Configs.Count) config file(s)."
                        $cheatWarning = "`nREJECTED - your previous attempt tried to suppress the failure instead of fixing it. " +
                            "These changes are unacceptable and must be reverted:`n" +
                            (($viol.Lines | Select-Object -First 20) -join "`n") +
                            $(if ($viol.Configs.Count) { "`nModified configuration files (revert them): $($viol.Configs -join ', ')" } else { '' }) + "`n"
                    }

                    $fixTokens = $tokens.Clone()
                    $fixTokens['ATTEMPT'] = ($attempt + 1)
                    $fixTokens['MAX_ATTEMPTS'] = $MaxRetries
                    $fixTokens['STEP'] = $gate.Failed
                    $fixTokens['COMMAND'] = $gate.Command
                    $fixTokens['EXIT_CODE'] = $gate.ExitCode
                    $fixTokens['DIGEST'] = (Get-FailureDigest -Text $gate.Output)
                    $fixTokens['REMAINING_STEPS'] = $gate.Remaining
                    $fixTokens['CHEAT_WARNING'] = $cheatWarning

                    $fcfg = $PhaseConfig['fix']
                    $fixPrompt = Expand-PromptTemplate -Path (Join-Path $PromptDir $fcfg.Template) -Tokens $fixTokens
                    $fixLog = Join-Path $logDir ("08-fix.{0}.log" -f ($attempt + 1))
                    Write-PortLog Step "phase 08 fix (attempt $($attempt + 1) of $MaxRetries)"

                    $frun = Invoke-WithLimitWait {
                        Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $fixPrompt -LogPath $fixLog `
                            -SystemPrompt $systemPrompt -SettingsPath $SettingsPath `
                            -TimeoutSeconds (Get-PhaseTimeout 'fix' $complexity) -EnvVars $phaseEnv `
                            -Model (Get-PhaseModel 'fix' $complexity) -FallbackModel $FallbackModel `
                            -Effort (Get-PhaseEffort 'fix' $complexity) `
                            -BudgetUsd (Get-PhaseBudget 'fix' $complexity) -Format $fcfg.Format `
                            -PermissionProfile $PermissionProfile -LiveLog
                    }

                    if ($frun.Parsed) {
                        $cs.costUsd += $frun.Parsed.CostUsd
                        $State.totals.costUsd += $frun.Parsed.CostUsd
                    }
                    Save-PortState -State $State -Path $StateFull
                }

                if ($gate -and $gate.Ok) {
                    $rec.status = 'done'; $rec.artifactsOk = $true; $rec.failedStep = $null
                    Write-PortLog Ok 'phase 07 verify passed.'
                } else {
                    $rec.status = 'failed'
                    $rec.failedStep = $(if ($gate) { $gate.Failed } else { 'unknown' })
                    $componentFailed = "gate:$($rec.failedStep)"
                }
                Save-PortState -State $State -Path $StateFull
            }
        }

        # ---- phase 09: converge (optional extra implement + verify) ------
        if (-not $componentFailed -and -not $aborted -and $activePhases -contains 'converge') {
            $rec = if ($cs.phases.ContainsKey('converge')) { $cs.phases['converge'] } else { New-PhaseRecord }
            $cs.phases['converge'] = $rec
            if ($rec.status -ne 'done') {
                $tasksPath = Join-Path $RepoRoot "$($cs.featureDir)/tasks.md"
                $before = if (Test-Path -LiteralPath $tasksPath) { (Get-Item -LiteralPath $tasksPath).Length } else { 0 }

                $ccfg = $PhaseConfig['converge']
                $cprompt = Expand-PromptTemplate -Path (Join-Path $PromptDir $ccfg.Template) -Tokens $tokens
                Write-PortLog Step 'phase 09 converge'
                $crun = Invoke-WithLimitWait {
                    Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $cprompt `
                        -LogPath (Join-Path $logDir '09-converge.log') -SystemPrompt $systemPrompt `
                        -SettingsPath $SettingsPath -TimeoutSeconds (Get-PhaseTimeout 'converge' $complexity) `
                        -EnvVars $phaseEnv -Model (Get-PhaseModel 'converge' $complexity) `
                        -FallbackModel $FallbackModel -Effort (Get-PhaseEffort 'converge' $complexity) `
                        -BudgetUsd (Get-PhaseBudget 'converge' $complexity) -Format $ccfg.Format `
                        -PermissionProfile $PermissionProfile
                }

                $rec.sessionId = $crun.SessionId
                $rec.exitCode = $crun.Proc.ExitCode
                $rec.durationSec = $crun.Proc.DurationSec
                $rec.log = $crun.Proc.LogPath
                if ($crun.Parsed) {
                    $rec.numTurns = $crun.Parsed.NumTurns
                    $rec.costUsd = $crun.Parsed.CostUsd
                    $cs.costUsd += $crun.Parsed.CostUsd
                    $State.totals.costUsd += $crun.Parsed.CostUsd
                }

                $after = if (Test-Path -LiteralPath $tasksPath) { (Get-Item -LiteralPath $tasksPath).Length } else { 0 }
                $rec.status = 'done'
                $rec.tasksGrew = ($after -gt $before)
                Save-PortState -State $State -Path $StateFull

                if ($after -gt $before) {
                    Write-PortLog Warn "converge appended work to tasks.md ($before -> $after bytes). Running one extra implement + verify pass."

                    $icfg = $PhaseConfig['implement']
                    $iprompt = (Expand-PromptTemplate -Path (Join-Path $PromptDir $icfg.Template) -Tokens $tokens)
                    $iprompt = "A convergence audit appended a new phase of tasks to tasks.md. Implement ONLY the unchecked tasks that remain.`n`n$iprompt"
                    $irun = Invoke-WithLimitWait {
                        Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $iprompt `
                            -LogPath (Join-Path $logDir '10-implement-converge.log') -SystemPrompt $systemPrompt `
                            -SettingsPath $SettingsPath -TimeoutSeconds (Get-PhaseTimeout 'implement' $complexity) `
                            -EnvVars $phaseEnv -Model (Get-PhaseModel 'implement' $complexity) `
                            -FallbackModel $FallbackModel -Effort (Get-PhaseEffort 'implement' $complexity) `
                            -BudgetUsd (Get-PhaseBudget 'implement' $complexity) -Format $icfg.Format `
                            -PermissionProfile $PermissionProfile -LiveLog
                    }
                    if ($irun.Parsed) {
                        $cs.costUsd += $irun.Parsed.CostUsd
                        $State.totals.costUsd += $irun.Parsed.CostUsd
                    }

                    Write-PortLog Step 'phase 07 verify (post-converge)'
                    $gate2 = Invoke-VerifyGate -Ctx $ctx -State $State
                    if (-not $gate2.Ok) { $componentFailed = "post-converge gate:$($gate2.Failed)" }
                    Save-PortState -State $State -Path $StateFull
                } else {
                    Write-PortLog Ok 'converge found no remaining work.'
                }
            }
        }

        # ---- phase 10: commit --------------------------------------------
        if (-not $componentFailed -and -not $aborted -and $activePhases -contains 'commit') {
            $rec = if ($cs.phases.ContainsKey('commit')) { $cs.phases['commit'] } else { New-PhaseRecord }
            $cs.phases['commit'] = $rec
            if ($rec.status -ne 'done') {
                Write-PortLog Step 'phase 10 commit'
                if (Test-GitClean -RepoRoot $RepoRoot) {
                    Write-PortLog Warn 'Nothing to commit.'
                    $rec.status = 'skipped'
                } else {
                    $null = Invoke-Git -RepoRoot $RepoRoot add -A
                    $msg = @(
                        "feat($slug): port the $($component.name) component from Dice UI",
                        "Upstream: $($Manifest.upstream.repo)@$($State.upstreamCommit)",
                        "Spec: $($cs.featureDir)",
                        "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
                    )
                    $r = Invoke-Git -RepoRoot $RepoRoot commit -m $msg[0] -m $msg[1] -m $msg[2] -m $msg[3]
                    if ($r.ExitCode -ne 0) {
                        $componentFailed = "commit failed: $($r.Output)"
                    } else {
                        $cs.commit = (Invoke-Git -RepoRoot $RepoRoot rev-parse --short HEAD).Output.Trim()
                        $tag = "port/$slug"
                        $null = Invoke-Git -RepoRoot $RepoRoot tag -f $tag
                        $cs.tag = $tag
                        $rec.status = 'done'
                        Write-PortLog Ok "committed $($cs.commit), tagged $tag"
                    }
                }
                Save-PortState -State $State -Path $StateFull
            }
        }

        # ---- component wrap-up -------------------------------------------
        $componentStart.Stop()
        $cs.durationSec = [int]$componentStart.Elapsed.TotalSeconds
        $cs.finishedAt = (Get-Date).ToString('o')

        if ($componentFailed) {
            $cs.status = 'failed'
            $cs.failureReason = $componentFailed
            $State.totals.failed++
            Write-PortLog Error "$slug FAILED: $componentFailed"

            if (-not (Test-GitClean -RepoRoot $RepoRoot)) {
                # Preserve the spec artifacts, then roll the working tree back. A half-implemented
                # component left in the tree would break the next component's build.
                $null = Invoke-Git -RepoRoot $RepoRoot add -- $cs.featureDir
                $staged = (Invoke-Git -RepoRoot $RepoRoot diff --cached --name-only).Output
                if (-not [string]::IsNullOrWhiteSpace($staged)) {
                    $null = Invoke-Git -RepoRoot $RepoRoot commit -m "wip($slug): failed port artifacts" -m "Reason: $componentFailed" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
                    Write-PortLog Info 'Spec artifacts preserved in a wip commit.'
                }
                if ($StopOnFailure) {
                    Write-PortLog Warn '-StopOnFailure: leaving the working tree as-is for inspection.'
                } else {
                    $null = Invoke-Git -RepoRoot $RepoRoot reset --hard HEAD
                    $null = Invoke-Git -RepoRoot $RepoRoot clean -fd -e .port-state.json -e .port-state.lock -e .port-logs -e .reference
                    Write-PortLog Info 'Working tree rolled back to the last good commit.'
                }
            }
            Save-PortState -State $State -Path $StateFull
            if ($StopOnFailure) { $aborted = 'failure'; break }
        } else {
            # A component is only 'done' once every phase of the full pipeline has run. A partial
            # run (-Phases, -NoConverge, -NoCommit) leaves it 'partial' so a later full run picks
            # it up instead of skipping it as finished.
            # 'skipped' counts as satisfied: it means the pipeline deliberately declined the phase
            # (remediate when the analysis verdict is 'ready', converge under -NoConverge), which is
            # different from -Phases never having offered it a chance to run.
            $pending = @($AllPhases | Where-Object {
                -not ($cs.phases.ContainsKey($_) -and $cs.phases[$_].status -in @('done', 'skipped'))
            })
            if ($pending.Count -eq 0) {
                $cs.status = 'done'
                Write-PortLog Ok ("$slug done in {0} (`${1:N2})" -f (Format-Duration $cs.durationSec), $cs.costUsd)
            } else {
                $cs.status = 'partial'
                Write-PortLog Warn ("$slug partial - phases not run: {0}. Re-run without -Phases to finish it." -f ($pending -join ', '))
            }
            Save-PortState -State $State -Path $StateFull
        }

        if ($aborted) { break }
    }

    # ---- summary ---------------------------------------------------------
    $State.status = switch ($aborted) {
        'budget'         { 'aborted-budget' }
        'auth-or-quota'  { 'aborted-failure' }
        'failure'        { 'aborted-failure' }
        default          { 'complete' }
    }
    Save-PortState -State $State -Path $StateFull

    Write-Host ''
    Write-PortLog Step '===== Summary ====='
    $rows = foreach ($c in $selected) {
        $s = $State.components[$c.slug]
        [pscustomobject]@{
            Slug     = $c.slug
            Status   = $s.status
            Duration = (Format-Duration ([int]$s.durationSec))
            Cost     = ('{0:N2}' -f $s.costUsd)
            Commit   = $s.commit
            Reason   = $s.failureReason
        }
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Host

    # Recompute the tallies from the component records rather than trusting the running
    # counters: a component that failed in an earlier run and succeeded in this one would
    # otherwise stay counted as failed forever.
    $allStatuses = @($State.components.Values | ForEach-Object { $_.status })
    $State.totals.done = @($allStatuses | Where-Object { $_ -eq 'done' }).Count
    $State.totals.failed = @($allStatuses | Where-Object { $_ -eq 'failed' }).Count
    $State.totals.skipped = @($allStatuses | Where-Object { $_ -eq 'skipped' }).Count
    Save-PortState -State $State -Path $StateFull

    Write-PortLog Info ("Total: {0} done, {1} failed, {2:N2} USD (cumulative across runs)." -f $State.totals.done, $State.totals.failed, $State.totals.costUsd)

    $failedSlugs = @($rows | Where-Object { $_.Status -eq 'failed' } | ForEach-Object { $_.Slug })
    if ($failedSlugs.Count -gt 0) {
        Write-PortLog Warn "Re-run the failures with:"
        Write-Host "  ./scripts/port-components.ps1 -Only $($failedSlugs -join ',') -Force"
    }
    if ($aborted) { Write-PortLog Error "Run aborted: $aborted"; exit 1 }
    Write-PortLog Ok 'Run complete.'
}
finally {
    Unlock-PortRun -Path $LockPath
}
