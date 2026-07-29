#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 0 of the Dice UI -> shadcn-svelte port: turn this empty repository into
    a working SvelteKit + Tailwind v4 + shadcn-svelte registry project.

.DESCRIPTION
    Steps (each recorded in .port-state.json under `bootstrap.steps`, so a re-run
    resumes at the first incomplete one):

      B0 preflight    - toolchain versions, disk space, clean working tree
      B1 reference    - shallow clone of sadmann7/diceui into .reference/diceui
      B2 skeleton     - `sv create` into a temp dir, then merged into the repo root
      B3 toolchain    - one `claude -p` call: Tailwind, shadcn-svelte, tests, lint,
                        registry.json, docs shell, package scripts, CLAUDE.md
      B4 constitution - /speckit-constitution with all principles supplied inline
      B5 verify       - the same gate the component loop uses
      B6 commit       - one commit, tagged port/bootstrap

    Run it directly, or via `port-components.ps1 -Bootstrap`.
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [string[]]$OnlySteps,
    [ValidateSet('bypass', 'allowlist')][string]$PermissionProfile = 'bypass',
    [double]$TimeoutMinutes = 30,
    [double]$ScaffoldBudgetUsd = 25,
    [double]$RateLimitWaitMinutes = 20,
    [int]$MaxRateLimitWaits = 36,
    [string]$StatePath = '.port-state.json',
    [string]$LogRoot = '.port-logs',
    [switch]$NoRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'lib/port-common.ps1')
if ($NoRun) { return }

$RepoRoot = Get-PortRepoRoot
$StateFull = if ([System.IO.Path]::IsPathRooted($StatePath)) { $StatePath } else { Join-Path $RepoRoot $StatePath }
$LogRootFull = if ([System.IO.Path]::IsPathRooted($LogRoot)) { $LogRoot } else { Join-Path $RepoRoot $LogRoot }
$LogDir = Join-Path $LogRootFull '_bootstrap'
$PromptDir = Join-Path $PSScriptRoot 'prompts'
$ManifestFull = Join-Path $PSScriptRoot 'components.json'
$SettingsPath = Join-Path $PSScriptRoot $(if ($PermissionProfile -eq 'allowlist') { 'port-permissions.json' } else { 'headless-settings.json' })

Set-PortRunLog -Path (Join-Path $LogDir 'bootstrap.log')

$Manifest = [System.IO.File]::ReadAllText($ManifestFull) | ConvertFrom-Json -Depth 50 -AsHashtable
$State = Read-PortState -Path $StateFull
if (-not $State.bootstrap) { $State.bootstrap = @{ status = 'pending'; steps = @{}; commit = $null; finishedAt = $null; costUsd = 0.0 } }
if ($Force) { $State.bootstrap.steps = @{} ; $State.bootstrap.status = 'pending' }

$AllSteps = @('preflight', 'reference', 'skeleton', 'toolchain', 'constitution', 'verify', 'commit')
$Steps = if ($OnlySteps) { @($AllSteps | Where-Object { $OnlySteps -contains $_ }) } else { $AllSteps }

$authInfo = Get-ClaudeAuthInfo
$UsesSubscription = Test-UsesSubscription -AuthInfo $authInfo
if ($UsesSubscription) {
    Write-PortLog Info "Auth: $($authInfo.authMethod) subscription ($($authInfo.subscriptionType)) - billed against plan usage limits, so no dollar caps are applied."
    $ScaffoldBudgetUsd = 0
}

<#
Runs a Claude invocation, transparently waiting out any plan usage limit rather
than treating it as a failure.
#>
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
                $waitSec = [int]($RateLimitWaitMinutes * 60)
                if ($rl.ResetAt) {
                    $delta = [int]($rl.ResetAt.AddMinutes(1) - (Get-Date)).TotalSeconds
                    if ($delta -gt 0) { $waitSec = $delta }
                }
                $waitSec = [Math]::Max(60, [Math]::Min($waitSec, 6 * 3600))
                Write-PortLog Warn "Plan usage limit reached (wait $waits of $MaxRateLimitWaits). Sleeping $(Format-Duration $waitSec)."
                $remaining = $waitSec
                while ($remaining -gt 0) {
                    $slice = [Math]::Min(60, $remaining)
                    Start-Sleep -Seconds $slice
                    $remaining -= $slice
                }
                continue
            }
        }
        return $run
    }
}

function Test-StepDone { param([string]$Name) return ($State.bootstrap.steps.ContainsKey($Name) -and $State.bootstrap.steps[$Name] -eq 'done') }
function Set-StepDone { param([string]$Name) $State.bootstrap.steps[$Name] = 'done'; Save-PortState -State $State -Path $StateFull }
function Stop-Bootstrap {
    param([string]$Message)
    Write-PortLog Error $Message
    $State.bootstrap.status = 'failed'
    Save-PortState -State $State -Path $StateFull
    exit 1
}

Write-PortLog Step 'Bootstrap starting.'
Write-PortLog Info "Repo root: $RepoRoot"
Write-PortLog Info "Steps    : $($Steps -join ' -> ')"

# ===========================================================================
# B0 - preflight
# ===========================================================================
if ($Steps -contains 'preflight' -and -not (Test-StepDone 'preflight')) {
    Write-PortLog Step 'B0 preflight'

    foreach ($tool in @('node', 'pnpm', 'git', 'claude')) {
        $cmd = Get-Command $tool -ErrorAction SilentlyContinue
        if (-not $cmd) { Stop-Bootstrap "Required tool not found on PATH: $tool" }
    }

    $nodeVer = (& node -v).Trim().TrimStart('v')
    if ([int]($nodeVer -split '\.')[0] -lt 20) { Stop-Bootstrap "Node 20+ required, found $nodeVer" }
    Write-PortLog Info "node $nodeVer / pnpm $((& pnpm -v).Trim()) / claude $((& claude --version).Trim())"

    $drive = Get-PSDrive -Name (Split-Path -Qualifier $RepoRoot).TrimEnd(':')
    $freeGb = [Math]::Round($drive.Free / 1GB, 1)
    if ($freeGb -lt 10) { Stop-Bootstrap "Less than 10 GB free on $($drive.Name): ($freeGb GB)" }
    Write-PortLog Info "$freeGb GB free on $($drive.Name):"

    foreach ($p in @('.specify/scripts/powershell/common.ps1', '.specify/templates/spec-template.md',
                     '.claude/skills/speckit-specify/SKILL.md', '.claude/skills/speckit-implement/SKILL.md')) {
        if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $p))) { Stop-Bootstrap "Missing Spec Kit file: $p" }
    }

    if (-not (Test-GitClean -RepoRoot $RepoRoot)) {
        $dirty = (Invoke-Git -RepoRoot $RepoRoot status --porcelain).Output
        # Untracked scaffolding that this project intentionally keeps out of the first commit is fine;
        # anything else means the tree is not in a known-good state.
        $blocking = @($dirty -split "`r?`n" | Where-Object { $_.Trim() } | Where-Object {
            $_ -notmatch '^\?\?\s+(\.agents/|\.claude/|\.specify/|scripts/|skills-lock\.json|\.port-)'
        })
        if ($blocking.Count -gt 0) {
            Write-PortLog Error 'The working tree has uncommitted changes. Commit or stash them first:'
            $blocking | ForEach-Object { Write-Host "  $_" }
            Stop-Bootstrap 'Refusing to bootstrap on a dirty tree.'
        }
    }

    Set-StepDone 'preflight'
    Write-PortLog Ok 'B0 preflight passed.'
}

# ===========================================================================
# B1 - upstream reference clone
# ===========================================================================
$ReferencePath = Join-Path $RepoRoot $Manifest.upstream.clonePath
if ($Steps -contains 'reference' -and -not (Test-StepDone 'reference')) {
    Write-PortLog Step 'B1 reference clone'

    if (Test-Path -LiteralPath $ReferencePath) {
        Write-PortLog Info "Reference clone already present at $($Manifest.upstream.clonePath)."
    } else {
        $r = Invoke-ExternalProcess -FilePath (Resolve-Launcher -Name 'git').File -Arguments @(
            'clone', '--filter=blob:none', '--depth', '1', $Manifest.upstream.repo, $ReferencePath
        ) -LogPath (Join-Path $LogDir 'b1-clone.log') -TimeoutSeconds 900 -WorkingDirectory $RepoRoot
        if ($r.ExitCode -ne 0) { Stop-Bootstrap "Cloning $($Manifest.upstream.repo) failed. See $($r.LogPath)" }
    }

    $State.upstreamCommit = (Invoke-Git -RepoRoot $ReferencePath rev-parse HEAD).Output.Trim()
    Write-PortLog Ok "Upstream pinned at $($State.upstreamCommit)"

    # Make sure the automation's own artifacts stay out of git.
    $giPath = Join-Path $RepoRoot '.gitignore'
    $gi = if (Test-Path -LiteralPath $giPath) { [System.IO.File]::ReadAllText($giPath) } else { '' }
    $needed = @('', '# Porting automation', '.reference/', '.port-state.json', '.port-state.json.*', '.port-state.lock', '.port-logs/', '.bootstrap-tmp/')
    $missing = @($needed | Where-Object { $_ -and ($gi -split "`r?`n") -notcontains $_ })
    if ($missing.Count -gt 0) {
        Add-Content -LiteralPath $giPath -Value (($needed -join "`n") + "`n") -Encoding utf8
        Write-PortLog Info 'Added the automation paths to .gitignore.'
    }

    Set-StepDone 'reference'
}

# ===========================================================================
# B2 - SvelteKit skeleton
# ===========================================================================
if ($Steps -contains 'skeleton' -and -not (Test-StepDone 'skeleton')) {
    Write-PortLog Step 'B2 SvelteKit skeleton'

    if (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json')) {
        Write-PortLog Info 'package.json already exists - skipping scaffolding.'
    } else {
        # `sv create` refuses to scaffold into a non-empty directory, and this repo already has
        # .git/.claude/.specify/README.md. Scaffold into a temp dir and merge.
        $tmp = Join-Path $RepoRoot '.bootstrap-tmp'
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }

        $npx = Resolve-Launcher -Name 'npx'
        $r = Invoke-ExternalProcess -FilePath $npx.File -Arguments (@($npx.Prefix) + @(
            '--yes', 'sv', 'create', $tmp, '--template', 'minimal', '--types', 'ts', '--no-add-ons', '--no-install'
        )) -LogPath (Join-Path $LogDir 'b2-sv-create.log') -TimeoutSeconds 900 -WorkingDirectory $RepoRoot `
           -EnvVars @{ CI = '1'; npm_config_yes = 'true' }
        if ($r.ExitCode -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $tmp 'package.json'))) {
            Stop-Bootstrap "'sv create' failed. See $($r.LogPath)"
        }

        # Merge .gitignore as a union of lines rather than overwriting the existing one.
        $tmpGi = Join-Path $tmp '.gitignore'
        if (Test-Path -LiteralPath $tmpGi) {
            $repoGiPath = Join-Path $RepoRoot '.gitignore'
            $existing = if (Test-Path -LiteralPath $repoGiPath) { [System.IO.File]::ReadAllText($repoGiPath) -split "`r?`n" } else { @() }
            $incoming = [System.IO.File]::ReadAllText($tmpGi) -split "`r?`n"
            $add = @($incoming | Where-Object { $_.Trim() -and $existing -notcontains $_ })
            if ($add.Count -gt 0) {
                Add-Content -LiteralPath $repoGiPath -Value (("`n# From the SvelteKit skeleton`n" + ($add -join "`n")) + "`n") -Encoding utf8
            }
            Remove-Item -LiteralPath $tmpGi -Force
        }

        Get-ChildItem -LiteralPath $tmp -Force | Where-Object { $_.Name -ne '.git' } | ForEach-Object {
            $dest = Join-Path $RepoRoot $_.Name
            if (Test-Path -LiteralPath $dest) {
                Write-PortLog Warn "Skipping '$($_.Name)' - it already exists at the repository root."
            } else {
                Move-Item -LiteralPath $_.FullName -Destination $dest -Force
            }
        }
        Remove-Item -LiteralPath $tmp -Recurse -Force
        Write-PortLog Ok 'Skeleton merged into the repository root.'
    }

    $pnpm = Resolve-Launcher -Name 'pnpm'
    $r = Invoke-ExternalProcess -FilePath $pnpm.File -Arguments (@($pnpm.Prefix) + @('install', '--reporter', 'append-only')) `
        -LogPath (Join-Path $LogDir 'b2-install.log') -TimeoutSeconds 1200 -WorkingDirectory $RepoRoot `
        -EnvVars @{ CI = '1'; npm_config_yes = 'true' }
    if ($r.ExitCode -ne 0) { Stop-Bootstrap "pnpm install failed. See $($r.LogPath)" }

    Set-StepDone 'skeleton'
    Write-PortLog Ok 'B2 skeleton done.'
}

# ===========================================================================
# B3 - toolchain (delegated to one claude -p call)
# ===========================================================================
$systemPrompt = [System.IO.File]::ReadAllText((Join-Path $PromptDir 'system-noninteractive.txt'))

if ($Steps -contains 'toolchain' -and -not (Test-StepDone 'toolchain')) {
    Write-PortLog Step 'B3 toolchain'

    $prompt = Expand-PromptTemplate -Path (Join-Path $PromptDir 'bootstrap-scaffold.md') -Tokens @{
        REPO_ROOT = $RepoRoot
    }

    $run = Invoke-WithLimitWait {
        Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $prompt `
            -LogPath (Join-Path $LogDir 'b3-toolchain.log') -SystemPrompt $systemPrompt `
            -SettingsPath $SettingsPath -TimeoutSeconds ([int]($TimeoutMinutes * 60 * 4)) `
            -Model 'opus' -FallbackModel 'sonnet' -Effort 'high' -BudgetUsd $ScaffoldBudgetUsd `
            -Format 'stream-json' -PermissionProfile $PermissionProfile -LiveLog
    }

    if ($run.Parsed) { $State.bootstrap.costUsd += $run.Parsed.CostUsd }
    Save-PortState -State $State -Path $StateFull

    if ($run.Proc.TimedOut) { Stop-Bootstrap "B3 timed out. See $($run.Proc.LogPath)" }
    if ($run.Proc.ExitCode -ne 0) { Stop-Bootstrap "B3 exited $($run.Proc.ExitCode). See $($run.Proc.LogPath)" }
    if ($run.Parsed -and $run.Parsed.Result -notmatch '(?m)^\s*PHASE_RESULT:\s*SUCCESS\b') {
        if (Test-AskedQuestion -Result $run.Parsed.Result) { Stop-Bootstrap 'B3 ended with a question instead of finishing the work.' }
        Write-PortLog Warn 'B3 did not emit PHASE_RESULT: SUCCESS. Continuing to the file checks, which are the real gate.'
    }

    $required = @('package.json', 'components.json', 'src/lib/utils.ts',
                  'src/app.css', 'registry.json', 'CLAUDE.md')
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $RepoRoot $_)) })
    if ($missing.Count -gt 0) { Stop-Bootstrap "B3 did not produce: $($missing -join ', ')" }

    # SvelteKit accepts its configuration either in svelte.config.js or inline in the
    # `sveltekit()` Vite plugin (vite-plugin-svelte 7+). Both are valid; require one.
    $hasSvelteConfig = Test-Path -LiteralPath (Join-Path $RepoRoot 'svelte.config.js')
    $viteConfigPath = Join-Path $RepoRoot 'vite.config.ts'
    $hasInlineKitConfig = (Test-Path -LiteralPath $viteConfigPath) -and
        ([System.IO.File]::ReadAllText($viteConfigPath) -match 'sveltekit\s*\(\s*\{')
    if (-not ($hasSvelteConfig -or $hasInlineKitConfig)) {
        Stop-Bootstrap 'B3 produced no SvelteKit configuration (neither svelte.config.js nor an inline sveltekit({...}) in vite.config.ts).'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'src/routes/docs'))) {
        Stop-Bootstrap 'B3 did not produce the docs route shell (src/routes/docs).'
    }

    $pkg = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'package.json')) | ConvertFrom-Json -AsHashtable
    $neededScripts = @('check', 'lint', 'test:unit', 'build', 'registry:build')
    $missingScripts = @($neededScripts | Where-Object { -not ($pkg.scripts -and $pkg.scripts.ContainsKey($_)) })
    if ($missingScripts.Count -gt 0) { Stop-Bootstrap "package.json is missing required scripts: $($missingScripts -join ', ')" }

    Set-StepDone 'toolchain'
    Write-PortLog Ok 'B3 toolchain done.'
}

# ===========================================================================
# B4 - constitution
# ===========================================================================
if ($Steps -contains 'constitution' -and -not (Test-StepDone 'constitution')) {
    Write-PortLog Step 'B4 constitution'

    # /speckit-constitution may rewrite the speckit SKILL.md files, which are integrity-hashed in
    # .specify/integrations/claude.manifest.json. Commit first so the diff is visible and revertable.
    if (-not (Test-GitClean -RepoRoot $RepoRoot)) {
        $null = Invoke-Git -RepoRoot $RepoRoot add -A
        $null = Invoke-Git -RepoRoot $RepoRoot commit -m 'chore: scaffold SvelteKit + Tailwind v4 + shadcn-svelte toolchain' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
        Write-PortLog Info 'Pre-constitution checkpoint committed.'
    }

    $prompt = Expand-PromptTemplate -Path (Join-Path $PromptDir 'bootstrap-constitution.md') -Tokens @{
        TODAY           = (Get-Date -Format 'yyyy-MM-dd')
        UPSTREAM_REPO   = $Manifest.upstream.repo
        UPSTREAM_COMMIT = $(if ($State.upstreamCommit) { $State.upstreamCommit } else { 'HEAD' })
    }

    $run = Invoke-WithLimitWait {
        Invoke-ClaudePhase -RepoRoot $RepoRoot -Prompt $prompt `
            -LogPath (Join-Path $LogDir 'b4-constitution.log') -SystemPrompt $systemPrompt `
            -SettingsPath $SettingsPath -TimeoutSeconds ([int]($TimeoutMinutes * 60)) `
            -Model 'opus' -FallbackModel 'sonnet' -Effort 'high' `
            -BudgetUsd $(if ($UsesSubscription) { 0 } else { 5 }) `
            -Format 'json' -PermissionProfile $PermissionProfile
    }

    if ($run.Parsed) { $State.bootstrap.costUsd += $run.Parsed.CostUsd }
    Save-PortState -State $State -Path $StateFull

    $constitution = Join-Path $RepoRoot '.specify/memory/constitution.md'
    $text = [System.IO.File]::ReadAllText($constitution)
    # The skill prepends a "Sync Impact Report" HTML comment that legitimately quotes the
    # placeholder tokens it replaced, so strip comments before looking for leftovers.
    $body = [regex]::Replace($text, '(?s)<!--.*?-->', '')
    if ($body -match '\[PROJECT_NAME\]|\[PRINCIPLE_1_NAME\]|\[GOVERNANCE_RULES\]|\[CONSTITUTION_VERSION\]') {
        Stop-Bootstrap 'B4 left placeholders in .specify/memory/constitution.md.'
    }
    if ($body.Trim().Length -lt 1500) {
        Stop-Bootstrap "B4 produced a suspiciously short constitution ($($body.Trim().Length) chars)."
    }

    $skillDiff = (Invoke-Git -RepoRoot $RepoRoot diff --name-only -- .claude/skills).Output
    if (-not [string]::IsNullOrWhiteSpace($skillDiff)) {
        Write-PortLog Warn 'The constitution step modified files under .claude/skills - reverting them to keep the Spec Kit manifest hashes valid:'
        $skillDiff -split "`r?`n" | Where-Object { $_.Trim() } | ForEach-Object { Write-Host "  $_" }
        $null = Invoke-Git -RepoRoot $RepoRoot checkout -- .claude/skills
    }

    Set-StepDone 'constitution'
    Write-PortLog Ok 'B4 constitution done.'
}

# ===========================================================================
# B5 - verification gate
# ===========================================================================
if ($Steps -contains 'verify' -and -not (Test-StepDone 'verify')) {
    Write-PortLog Step 'B5 verify'

    $gate = @(
        @{ Name = 'sync';  Args = @('exec', 'svelte-kit', 'sync');           Timeout = 180;  Optional = $false }
        @{ Name = 'check'; Args = @('run', 'check');                          Timeout = 900;  Optional = $false }
        @{ Name = 'lint';  Args = @('run', 'lint');                           Timeout = 600;  Optional = $false }
        @{ Name = 'test';  Args = @('run', 'test:unit', '--', '--run');       Timeout = 1200; Optional = $false }
        @{ Name = 'build'; Args = @('run', 'build');                          Timeout = 1200; Optional = $false }
        @{ Name = 'registry'; Args = @('run', 'registry:build');              Timeout = 300;  Optional = $true }
    )
    $pnpm = Resolve-Launcher -Name 'pnpm'
    foreach ($g in $gate) {
        Write-PortLog Step "gate:$($g.Name)"
        $r = Invoke-ExternalProcess -FilePath $pnpm.File -Arguments (@($pnpm.Prefix) + $g.Args) `
            -LogPath (Join-Path $LogDir "b5-$($g.Name).log") -TimeoutSeconds $g.Timeout `
            -WorkingDirectory $RepoRoot -EnvVars @{ CI = '1'; NO_COLOR = '1'; npm_config_yes = 'true' }
        if ($r.ExitCode -ne 0 -or $r.TimedOut) {
            if ($g.Optional) { Write-PortLog Warn "gate:$($g.Name) failed but is optional."; continue }
            Write-Host (Get-FailureDigest -Text "$($r.StdOut)`n$($r.StdErr)")
            Stop-Bootstrap "B5 gate failed at '$($g.Name)'. The component loop would inherit a broken skeleton. See $($r.LogPath)"
        }
    }

    Set-StepDone 'verify'
    Write-PortLog Ok 'B5 verify passed.'
}

# ===========================================================================
# B6 - commit
# ===========================================================================
if ($Steps -contains 'commit' -and -not (Test-StepDone 'commit')) {
    Write-PortLog Step 'B6 commit'
    if (Test-GitClean -RepoRoot $RepoRoot) {
        Write-PortLog Info 'Nothing to commit.'
    } else {
        $null = Invoke-Git -RepoRoot $RepoRoot add -A
        $r = Invoke-Git -RepoRoot $RepoRoot commit `
            -m 'chore: bootstrap SvelteKit + Tailwind v4 + shadcn-svelte toolchain' `
            -m "Upstream reference pinned at $($Manifest.upstream.repo)@$($State.upstreamCommit)" `
            -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
        if ($r.ExitCode -ne 0) { Stop-Bootstrap "Bootstrap commit failed: $($r.Output)" }
    }
    $null = Invoke-Git -RepoRoot $RepoRoot tag -f 'port/bootstrap'
    $State.bootstrap.commit = (Invoke-Git -RepoRoot $RepoRoot rev-parse --short HEAD).Output.Trim()
    Set-StepDone 'commit'
    Write-PortLog Ok "B6 committed $($State.bootstrap.commit), tagged port/bootstrap."
}

$incomplete = @($AllSteps | Where-Object { -not (Test-StepDone $_) })
if ($incomplete.Count -eq 0) {
    $State.bootstrap.status = 'done'
    $State.bootstrap.finishedAt = (Get-Date).ToString('o')
    Save-PortState -State $State -Path $StateFull
    Write-PortLog Ok ("Bootstrap complete ({0:N2} USD). Next: ./scripts/port-components.ps1" -f $State.bootstrap.costUsd)
} else {
    $State.bootstrap.status = 'partial'
    Save-PortState -State $State -Path $StateFull
    Write-PortLog Warn "Bootstrap partially complete. Remaining steps: $($incomplete -join ', ')"
}
exit 0
