#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tier 0 verification: unit-tests the pure helpers in scripts/lib/port-common.ps1
    plus the artifact contracts in port-components.ps1. No API calls, no writes to
    the repository (a temp directory is used for the state/lock tests).

.EXAMPLE
    pwsh -NoProfile -File ./scripts/tests/Test-PortHelpers.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '../lib/port-common.ps1')

$script:Pass = 0
$script:Fail = 0

function Assert-True {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][bool]$Condition, [string]$Detail)
    if ($Condition) {
        $script:Pass++
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } else {
        $script:Fail++
        Write-Host "  FAIL  $Name" -ForegroundColor Red
        if ($Detail) { Write-Host "        $Detail" -ForegroundColor DarkGray }
    }
}

function Assert-Equal {
    param([Parameter(Mandatory)][string]$Name, $Expected, $Actual)
    Assert-True -Name $Name -Condition ("$Expected" -eq "$Actual") -Detail "expected '$Expected', got '$Actual'"
}

$RepoRoot = Get-PortRepoRoot
$Scratch = Join-Path ([System.IO.Path]::GetTempPath()) "port-helper-tests-$([guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $Scratch -Force | Out-Null

try {

# ---------------------------------------------------------------------------
Write-Host "`nConvertFrom-ClaudeOutput" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$jsonBlob = @'
{"type":"result","subtype":"success","is_error":false,"duration_ms":42000,"num_turns":11,"result":"Done.\n\nPHASE_RESULT: SUCCESS\nFILES: a.ts\nSUMMARY: - ok","session_id":"11111111-2222-3333-4444-555555555555","total_cost_usd":1.2345}
'@
$p = ConvertFrom-ClaudeOutput -Text $jsonBlob -Format 'json'
Assert-True  'parses a plain json result'            ($null -ne $p)
Assert-Equal 'session id'    '11111111-2222-3333-4444-555555555555' $p.SessionId
Assert-Equal 'num turns'     11        $p.NumTurns
Assert-Equal 'cost'          1.2345    $p.CostUsd
Assert-True  'is_error false'                        (-not $p.IsError)

$p2 = ConvertFrom-ClaudeOutput -Text ("Some banner text`n" + $jsonBlob) -Format 'json'
Assert-True 'tolerates banner text before the JSON'  ($null -ne $p2 -and $p2.NumTurns -eq 11)

$streamBlob = @'
{"type":"system","subtype":"init","session_id":"aaa"}
{"type":"assistant","message":{"content":[]}}
{"type":"result","subtype":"success","is_error":false,"num_turns":3,"result":"first","session_id":"aaa","total_cost_usd":0.5}
{"type":"result","subtype":"success","is_error":false,"num_turns":9,"result":"PHASE_RESULT: SUCCESS","session_id":"bbb","total_cost_usd":2.5}
'@
$p3 = ConvertFrom-ClaudeOutput -Text $streamBlob -Format 'stream-json'
Assert-Equal 'stream-json keeps the LAST result line' 'bbb' $p3.SessionId
Assert-Equal 'stream-json cost from the last line'    2.5   $p3.CostUsd

Assert-True 'empty input returns null'  ($null -eq (ConvertFrom-ClaudeOutput -Text '' -Format 'json'))
Assert-True 'garbage input returns null' ($null -eq (ConvertFrom-ClaudeOutput -Text 'not json at all' -Format 'json'))

# ---------------------------------------------------------------------------
Write-Host "`nTest-AskedQuestion" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

# Copied verbatim from .claude/skills/speckit-specify/SKILL.md step 7.c - this is the
# exact shape of the blocking output the orchestrator must catch.
$clarifyTable = @'
## Question 1: Scope

**Context**: The spec does not state whether RTL is in scope.

**What we need to know**: Should the component support right-to-left layouts?

**Suggested Answers**:

| Option | Answer | Implications |
|--------|--------|--------------|
| A      | Yes    | More work    |
| B      | No     | Less work    |
| Custom | Provide your own answer | Explain |

**Your choice**: _[Wait for user response]_
'@
Assert-True 'catches the speckit clarification table' (Test-AskedQuestion -Result $clarifyTable)

Assert-True 'catches "Would you like me to..."'  (Test-AskedQuestion -Result "Report done.`nWould you like me to suggest remediation edits?")
Assert-True 'catches the implement (yes/no) gate' (Test-AskedQuestion -Result "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)")
Assert-True 'catches a trailing question mark'    (Test-AskedQuestion -Result "I finished part of it.`nShould I keep going?")

$goodResult = @'
Ported the component.

PHASE_RESULT: SUCCESS
FILES: src/lib/components/ui/status/index.ts
SUMMARY:
- Created the component
- Added tests
'@
Assert-True 'does not fire on a clean PHASE_RESULT block' (-not (Test-AskedQuestion -Result $goodResult))
Assert-True 'does not fire on empty input'                (-not (Test-AskedQuestion -Result ''))

# ---------------------------------------------------------------------------
Write-Host "`nTest-RateLimit" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$rl = Test-RateLimit -Text 'Claude AI usage limit reached|1793827200'
Assert-True  'detects the pipe-delimited usage limit' $rl.Hit
Assert-True  'extracts the reset timestamp'           ($null -ne $rl.ResetAt) "got '$($rl.ResetAt)'"
Assert-Equal 'reset timestamp is 2026' 2026 $rl.ResetAt.Year

$rlMs = Test-RateLimit -Text 'Claude AI usage limit reached|1793827200000'
Assert-True 'handles a millisecond timestamp' ($null -ne $rlMs.ResetAt -and $rlMs.ResetAt.Year -eq 2026)

$rl2 = Test-RateLimit -Text 'API Error: 429 Too Many Requests'
Assert-True 'detects a 429'                       $rl2.Hit
Assert-True 'no timestamp when none is present'   ($null -eq $rl2.ResetAt)

$rl3 = Test-RateLimit -Text 'Your limit will reset at 2026-07-29T18:00:00Z. Upgrade to increase your usage limit.'
Assert-True 'detects the prose form'              $rl3.Hit
Assert-True 'parses an ISO reset time'            ($null -ne $rl3.ResetAt)

Assert-True 'does not fire on a normal result'    (-not (Test-RateLimit -Text 'PHASE_RESULT: SUCCESS').Hit)
Assert-True 'does not fire on empty input'        (-not (Test-RateLimit -Text '').Hit)
Assert-True 'does not fire on a compile error'    (-not (Test-RateLimit -Text "src/lib/x.svelte:12:3 Type 'string' is not assignable").Hit)

# ---------------------------------------------------------------------------
Write-Host "`nAuth detection" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$auth = Get-ClaudeAuthInfo
Assert-True 'reads claude auth status' ($null -ne $auth) 'is the CLI logged in?'
if ($auth) {
    Assert-True 'auth status reports loggedIn' ([bool]$auth.loggedIn)
    Write-Host "        authMethod=$($auth.authMethod) subscriptionType=$($auth.subscriptionType)" -ForegroundColor DarkGray
}
Assert-True 'a claude.ai login counts as a subscription' `
    (Test-UsesSubscription -AuthInfo ([pscustomobject]@{ authMethod = 'claude.ai'; subscriptionType = 'max' }))
Assert-True 'an api-key login does not' `
    (-not (Test-UsesSubscription -AuthInfo ([pscustomobject]@{ authMethod = 'apiKey'; apiProvider = 'firstParty' })))
Assert-True 'null auth info does not' (-not (Test-UsesSubscription -AuthInfo $null))

# ---------------------------------------------------------------------------
Write-Host "`nGet-FailureDigest" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$long = (1..1000 | ForEach-Object { "line $_" }) -join "`n"
$d = Get-FailureDigest -Text $long -Head 10 -Tail 20
Assert-True 'digest keeps the head'   ($d -match '(?m)^line 1$')
Assert-True 'digest keeps the tail'   ($d -match '(?m)^line 1000$')
Assert-True 'digest drops the middle' ($d -notmatch '(?m)^line 500$')
Assert-True 'digest marks the omission' ($d -match 'lines omitted')
Assert-True 'short input passes through' ((Get-FailureDigest -Text "a`nb") -eq "a`nb")
Assert-True 'empty input is labelled'    ((Get-FailureDigest -Text '') -eq '(no output)')

$huge = 'x' * 40000
Assert-True 'digest respects MaxChars' ((Get-FailureDigest -Text $huge -MaxChars 1000).Length -le 1100)

# ---------------------------------------------------------------------------
Write-Host "`nExpand-PromptTemplate" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$tpl = Join-Path $Scratch 'tpl.md'
[System.IO.File]::WriteAllText($tpl, "Hello {{NAME}}, slug {{SLUG}}.")
Assert-Equal 'substitutes tokens' 'Hello Status, slug status.' (Expand-PromptTemplate -Path $tpl -Tokens @{ NAME = 'Status'; SLUG = 'status' })

$threw = $false
try { $null = Expand-PromptTemplate -Path $tpl -Tokens @{ NAME = 'Status' } } catch { $threw = $true }
Assert-True 'throws on an unreplaced token' $threw

$tpl2 = Join-Path $Scratch 'tpl2.md'
[System.IO.File]::WriteAllText($tpl2, "a`n`n{{EXTRA}}`n`nb")
Assert-True 'collapses the blank lines left by an empty token' `
    ((Expand-PromptTemplate -Path $tpl2 -Tokens @{ EXTRA = '' }) -notmatch "`n`n`n")

# ---------------------------------------------------------------------------
Write-Host "`nGet-NormalizedHash / artifact contracts" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$specTemplate = Join-Path $RepoRoot '.specify/templates/spec-template.md'
Assert-True 'the spec template exists' (Test-Path -LiteralPath $specTemplate)
$h1 = Get-NormalizedHash -Path $specTemplate

$copy = Join-Path $Scratch 'spec.md'
$crlf = ([System.IO.File]::ReadAllText($specTemplate) -replace "`r`n", "`n") -replace "`n", "`r`n"
[System.IO.File]::WriteAllText($copy, $crlf)
Assert-Equal 'hash is line-ending agnostic' $h1 (Get-NormalizedHash -Path $copy)
Assert-True  'hash of a missing file is null' ($null -eq (Get-NormalizedHash -Path (Join-Path $Scratch 'nope.md')))

# Test-PhaseArtifacts lives in the orchestrator; -NoRun loads its functions without running it.
. (Join-Path $PSScriptRoot '../port-components.ps1') -NoRun
$fakeFeature = Join-Path $Scratch 'specs/001-port-status'
New-Item -ItemType Directory -Path $fakeFeature -Force | Out-Null
Copy-Item -LiteralPath $specTemplate -Destination (Join-Path $fakeFeature 'spec.md')

$ctx = @{ Slug = 'status'; FeatureDir = 'specs/001-port-status'; SpecTemplateHash = $h1 }
$savedRoot = $RepoRoot
$RepoRoot = $Scratch   # Test-PhaseArtifacts resolves against $RepoRoot
$r = Test-PhaseArtifacts -Phase 'specify' -Ctx $ctx
Assert-True 'detects an untouched spec template' (-not $r.Ok)
Assert-True 'and says so'                        ($r.Reason -match 'template|NEEDS CLARIFICATION')

[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'spec.md'), ('# Real spec' + ("`nsome content" * 200) + "`n[NEEDS CLARIFICATION: what?]"))
$r = Test-PhaseArtifacts -Phase 'specify' -Ctx $ctx
Assert-True 'detects leftover [NEEDS CLARIFICATION]' (-not $r.Ok -and $r.Reason -match 'NEEDS CLARIFICATION')

New-Item -ItemType Directory -Path (Join-Path $fakeFeature 'checklists') -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'spec.md'), ('# Real spec' + ("`nsome content" * 200)))
[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'checklists/requirements.md'), "- [X] one`n- [ ] two`n")
$r = Test-PhaseArtifacts -Phase 'specify' -Ctx $ctx
Assert-True 'detects an unchecked requirements checklist' (-not $r.Ok -and $r.Reason -match 'checklist')

[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'checklists/requirements.md'), "- [X] one`n- [X] two`n")
$r = Test-PhaseArtifacts -Phase 'specify' -Ctx $ctx
Assert-True 'accepts a complete spec' $r.Ok $r.Reason

[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'tasks.md'), "- [ ] T001 do a`n- [ ] T002 do b`n")
$r = Test-PhaseArtifacts -Phase 'tasks' -Ctx $ctx
Assert-True 'rejects a too-short task list' (-not $r.Ok -and $r.Reason -match 'only 2 tasks')

[System.IO.File]::WriteAllText((Join-Path $fakeFeature 'tasks.md'), (1..8 | ForEach-Object { "- [ ] T00$_ do $_" }) -join "`n")
$r = Test-PhaseArtifacts -Phase 'tasks' -Ctx $ctx
Assert-True 'accepts an 8-task list' $r.Ok $r.Reason
$RepoRoot = $savedRoot

# ---------------------------------------------------------------------------
Write-Host "`nModel map (-Economy)" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

# The orchestrator was dot-sourced above with -NoRun, so $Model / $Effort / $Economy
# are its parameter defaults ($null / $null / $false) in this scope.
Assert-Equal 'default: specify is the cheap model'   'sonnet' (Get-PhaseModel 'specify'   'S')
Assert-Equal 'default: plan is the strong model'     'opus'   (Get-PhaseModel 'plan'      'S')
Assert-Equal 'default: analyze is the strong model'  'opus'   (Get-PhaseModel 'analyze'   'S')
Assert-Equal 'default: implement/S is strong'        'opus'   (Get-PhaseModel 'implement' 'S')
Assert-Equal 'default: implement/L is strong'        'opus'   (Get-PhaseModel 'implement' 'L')

$Economy = $true
Assert-Equal 'economy: specify stays cheap'          'sonnet' (Get-PhaseModel 'specify'   'S')
Assert-Equal 'economy: plan stays strong'            'opus'   (Get-PhaseModel 'plan'      'S')
Assert-Equal 'economy: analyze is NEVER downgraded'  'opus'   (Get-PhaseModel 'analyze'   'S')
Assert-Equal 'economy: implement/S drops to cheap'   'sonnet' (Get-PhaseModel 'implement' 'S')
Assert-Equal 'economy: implement/M stays strong'     'opus'   (Get-PhaseModel 'implement' 'M')
Assert-Equal 'economy: implement/L stays strong'     'opus'   (Get-PhaseModel 'implement' 'L')
Assert-Equal 'economy: fix/S drops to cheap'         'sonnet' (Get-PhaseModel 'fix'       'S')
Assert-Equal 'economy: fix/L stays strong'           'opus'   (Get-PhaseModel 'fix'       'L')
Assert-Equal 'economy: converge/S drops to cheap'    'sonnet' (Get-PhaseModel 'converge'  'S')
Assert-Equal 'economy: effort follows the model'     'medium' (Get-PhaseEffort 'implement' 'S')
Assert-Equal 'economy: effort stays high on M'       'high'   (Get-PhaseEffort 'implement' 'M')

$Model = 'haiku'
Assert-Equal '-Model overrides economy'      'haiku' (Get-PhaseModel 'implement' 'L')
Assert-Equal '-Model overrides analyze too'  'haiku' (Get-PhaseModel 'analyze'   'S')
$Model = $null
$Economy = $false
Assert-Equal 'restored to the default map' 'opus' (Get-PhaseModel 'implement' 'S')

# Every phase in the economy map must exist in the phase config, or the switch
# would silently do nothing for it.
$unknown = @($EconomyModelMap.Keys | Where-Object { -not $PhaseConfig.ContainsKey($_) })
Assert-True 'every economy phase exists in the phase config' ($unknown.Count -eq 0) ($unknown -join ', ')

# ---------------------------------------------------------------------------
Write-Host "`nFormat-Duration" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

Assert-Equal 'seconds'          '45s'    (Format-Duration 45)
Assert-Equal 'minutes'          '2m30s'  (Format-Duration 150)
Assert-Equal 'hours floor, not round' '1h30m' (Format-Duration 5400)
Assert-Equal 'multi-hour'       '4h45m'  (Format-Duration 17100)

# ---------------------------------------------------------------------------
Write-Host "`nState file" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$statePath = Join-Path $Scratch 'state.json'
$s = New-PortState
$s.components['status'] = @{ status = 'done'; costUsd = 1.5; phases = @{ specify = @{ status = 'done' } } }
Save-PortState -State $s -Path $statePath
$s2 = Read-PortState -Path $statePath
Assert-True  'state round-trips'                 ($s2.components.status.status -eq 'done')
Assert-Equal 'nested phase survives'    'done'   $s2.components.status.phases.specify.status
Assert-True  'no .tmp file left behind'          (-not (Test-Path -LiteralPath "$statePath.tmp"))

[System.IO.File]::WriteAllText($statePath, '{ this is not json')
$s3 = Read-PortState -Path $statePath
Assert-True 'a corrupt state file is backed up and reset' ($s3.schemaVersion -eq 1 -and $s3.components.Count -eq 0)
Assert-True 'the corrupt file was preserved' (@(Get-ChildItem -LiteralPath $Scratch -Filter 'state.json.corrupt-*').Count -eq 1)

Assert-True 'a missing state file yields a fresh state' ((Read-PortState -Path (Join-Path $Scratch 'nope.json')).status -eq 'idle')

# ---------------------------------------------------------------------------
Write-Host "`nRun lock" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$lockPath = Join-Path $Scratch 'run.lock'
Lock-PortRun -Path $lockPath
$blocked = $false
$probe = Start-Job -ScriptBlock {
    param($p)
    try { $h = [System.IO.File]::Open($p, 'OpenOrCreate', 'ReadWrite', 'None'); $h.Dispose(); return 'acquired' }
    catch { return 'blocked' }
} -ArgumentList $lockPath
$blocked = ((Receive-Job -Job (Wait-Job $probe) ) -eq 'blocked')
Remove-Job $probe -Force
Assert-True 'a second process cannot take the lock' $blocked
Unlock-PortRun -Path $lockPath
Assert-True 'the lock file is removed on release' (-not (Test-Path -LiteralPath $lockPath))

# ---------------------------------------------------------------------------
Write-Host "`nResolve-Launcher" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$claude = Resolve-Launcher -Name 'claude'
Assert-True 'resolves claude' ((Test-Path -LiteralPath $claude.File)) $claude.File
$pnpm = Resolve-Launcher -Name 'pnpm'
Assert-True 'resolves pnpm'   ((Test-Path -LiteralPath $pnpm.File))   "$($pnpm.File) $($pnpm.Prefix -join ' ')"
$threw = $false
try { $null = Resolve-Launcher -Name 'definitely-not-a-real-command-xyz' } catch { $threw = $true }
Assert-True 'throws on an unknown launcher' $threw

# ---------------------------------------------------------------------------
Write-Host "`nInvoke-ExternalProcess (timeout + tree kill)" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$pwshPath = Get-PwshPath
$r = Invoke-ExternalProcess -FilePath $pwshPath `
    -Arguments @('-NoProfile', '-NonInteractive', '-Command', 'Write-Output "hello"; exit 3') `
    -LogPath (Join-Path $Scratch 'proc-ok.log') -TimeoutSeconds 60 -WorkingDirectory $Scratch
Assert-Equal 'captures the exit code' 3 $r.ExitCode
Assert-True  'captures stdout' ($r.StdOut -match 'hello')
Assert-True  'writes the log file' (Test-Path -LiteralPath (Join-Path $Scratch 'proc-ok.log'))

$r = Invoke-ExternalProcess -FilePath $pwshPath `
    -Arguments @('-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 60') `
    -LogPath (Join-Path $Scratch 'proc-timeout.log') -TimeoutSeconds 3 -WorkingDirectory $Scratch
Assert-True 'flags the timeout' $r.TimedOut
Assert-True 'the timeout is enforced quickly' ($r.DurationSec -lt 30) "took $($r.DurationSec)s"

$r = Invoke-ExternalProcess -FilePath $pwshPath `
    -Arguments @('-NoProfile', '-NonInteractive', '-Command', '$i = [Console]::In.ReadToEnd(); Write-Output "got:$i"') `
    -StdinText 'piped-prompt' -LogPath (Join-Path $Scratch 'proc-stdin.log') -TimeoutSeconds 60 -WorkingDirectory $Scratch
Assert-True 'feeds stdin and sees EOF' ($r.StdOut -match 'got:piped-prompt')

# ---------------------------------------------------------------------------
Write-Host "`nManifest" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

$manifest = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'scripts/components.json')) | ConvertFrom-Json -Depth 50 -AsHashtable
$slugs = $manifest.components | ForEach-Object { $_.slug }
Assert-Equal 'component count' 38 $manifest.components.Count
Assert-Equal 'slugs are unique' 38 (($slugs | Sort-Object -Unique).Count)

$badDeps = @()
foreach ($c in $manifest.components) { foreach ($d in $c.dependsOn) { if ($slugs -notcontains $d) { $badDeps += "$($c.slug) -> $d" } } }
Assert-True 'every dependsOn resolves' ($badDeps.Count -eq 0) ($badDeps -join ', ')

$forwardRefs = @()
for ($i = 0; $i -lt $manifest.components.Count; $i++) {
    foreach ($d in $manifest.components[$i].dependsOn) {
        if ([array]::IndexOf($slugs, $d) -ge $i) { $forwardRefs += "$($manifest.components[$i].slug) -> $d" }
    }
}
Assert-True 'no component depends on a later one' ($forwardRefs.Count -eq 0) ($forwardRefs -join ', ')

$badCx = @($manifest.components | Where-Object { $_.complexity -notin @('S', 'M', 'L') } | ForEach-Object { $_.slug })
Assert-True 'every complexity is S/M/L' ($badCx.Count -eq 0) ($badCx -join ', ')

$missingFields = @()
foreach ($c in $manifest.components) {
    foreach ($f in @('slug', 'name', 'kind', 'wave', 'complexity', 'docsUrl', 'docsMdx', 'sourcePaths', 'dependsOn')) {
        if (-not $c.ContainsKey($f)) { $missingFields += "$($c.slug).$f" }
    }
}
Assert-True 'every component has the required fields' ($missingFields.Count -eq 0) ($missingFields -join ', ')

# ---------------------------------------------------------------------------
Write-Host "`nSettings profiles" -ForegroundColor Cyan
# ---------------------------------------------------------------------------

foreach ($f in @('headless-settings.json', 'port-permissions.json')) {
    $path = Join-Path $RepoRoot "scripts/$f"
    $ok = $false
    try { $j = [System.IO.File]::ReadAllText($path) | ConvertFrom-Json -AsHashtable; $ok = $true } catch { }
    Assert-True "$f is valid JSON" $ok
    if ($ok) {
        Assert-True "$f neutralises hooks"   ($j.ContainsKey('hooks') -and $j.hooks.Count -eq 0)
        Assert-True "$f neutralises plugins" ($j.ContainsKey('enabledPlugins') -and $j.enabledPlugins.Count -eq 0)
        Assert-True "$f does not pin a model" (-not $j.ContainsKey('model'))
    }
}

}
finally {
    Remove-Item -LiteralPath $Scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($script:Fail -eq 0) {
    Write-Host "All $($script:Pass) assertions passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$($script:Fail) of $($script:Pass + $script:Fail) assertions FAILED." -ForegroundColor Red
    exit 1
}
