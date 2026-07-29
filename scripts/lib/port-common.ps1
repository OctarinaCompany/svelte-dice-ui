#!/usr/bin/env pwsh
# Shared helpers for the Dice UI -> shadcn-svelte porting automation.
# Dot-sourced by scripts/port-components.ps1 and scripts/bootstrap.ps1.
# This file defines functions only; it performs no work when sourced.

Set-StrictMode -Version Latest

$script:Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$script:LauncherCache = @{}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

$script:RunLogPath = $null

function Set-PortRunLog {
    param([Parameter(Mandatory)][string]$Path)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $script:RunLogPath = $Path
}

function Write-PortLog {
    [CmdletBinding()]
    param(
        [Parameter(Position = 0)]
        [ValidateSet('Info', 'Step', 'Ok', 'Warn', 'Error', 'Debug')][string]$Level = 'Info',
        [Parameter(Mandatory, Position = 1)][string]$Message
    )
    $stamp = (Get-Date).ToString('HH:mm:ss')
    $tag = switch ($Level) {
        'Step'  { '>>' }
        'Ok'    { 'ok' }
        'Warn'  { '!!' }
        'Error' { 'XX' }
        'Debug' { '..' }
        default { '--' }
    }
    $line = "[$stamp] $tag $Message"

    switch ($Level) {
        'Step'  { Write-Host $line -ForegroundColor Cyan }
        'Ok'    { Write-Host $line -ForegroundColor Green }
        'Warn'  { Write-Host $line -ForegroundColor Yellow }
        'Error' { Write-Host $line -ForegroundColor Red }
        'Debug' { Write-Host $line -ForegroundColor DarkGray }
        default { Write-Host $line }
    }

    if ($script:RunLogPath) {
        try { Add-Content -LiteralPath $script:RunLogPath -Value $line -Encoding utf8 } catch { }
    }
}

# ---------------------------------------------------------------------------
# Paths and launchers
# ---------------------------------------------------------------------------

function Get-PortRepoRoot {
    # scripts/lib/port-common.ps1 -> repo root is two levels up.
    return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
}

<#
Resolves an external command to something ProcessStartInfo can launch directly.
Prefers a real .exe (no cmd.exe quoting layer). Falls back to running a .ps1
through the current pwsh, and to a .cmd/.bat shim as a last resort.
Returns @{ File = <path>; Prefix = @(<args to prepend>) }.
#>
function Resolve-Launcher {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    if ($script:LauncherCache.ContainsKey($Name)) { return $script:LauncherCache[$Name] }

    $result = $null

    foreach ($candidate in @("$Name.exe", $Name)) {
        $cmd = Get-Command $candidate -CommandType Application -ErrorAction SilentlyContinue |
            Where-Object { $_.Source -like '*.exe' } | Select-Object -First 1
        if ($cmd) { $result = @{ File = $cmd.Source; Prefix = @() }; break }
    }

    if (-not $result) {
        $cmd = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cmd -and $cmd.Source) {
            if ($cmd.Source -like '*.ps1') {
                $pwshPath = (Get-Process -Id $PID).Path
                $result = @{
                    File   = $pwshPath
                    Prefix = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $cmd.Source)
                }
            } elseif ($cmd.Source -like '*.cmd' -or $cmd.Source -like '*.bat') {
                $result = @{
                    File   = (Get-Command cmd.exe).Source
                    Prefix = @('/d', '/c', $cmd.Source)
                }
            } else {
                $result = @{ File = $cmd.Source; Prefix = @() }
            }
        }
    }

    if (-not $result) { throw "Cannot resolve launcher for '$Name'. Is it on PATH?" }

    $script:LauncherCache[$Name] = $result
    return $result
}

function Get-PwshPath {
    return (Get-Process -Id $PID).Path
}

# ---------------------------------------------------------------------------
# Process execution with a hard wall-clock timeout and process-tree kill
# ---------------------------------------------------------------------------

<#
Launches an external process, feeds it stdin, drains both pipes concurrently,
and enforces a wall-clock timeout by killing the whole process tree.

Returns [pscustomobject] with ExitCode, TimedOut, DurationSec, StdOut, StdErr, LogPath.
#>
function Start-DeadlineWait {
    <#
    .SYNOPSIS
        Sleep until a wall-clock deadline, in interruptible slices.
    .DESCRIPTION
        Counting down a remaining-seconds variable is wrong on any machine that suspends: the
        counter tracks iterations of awake time, not elapsed time. An observed run slept through a
        4h45 suspend and still had ~100 minutes of countdown left, hours after the usage window had
        actually reset. Comparing against an absolute deadline is immune to that.

        Sleeps in short slices so Ctrl-C stays responsive, and returns immediately if the deadline
        has already passed.
    #>
    param(
        [Parameter(Mandatory)][datetime]$Until,
        [string]$Label = 'waiting',
        [int]$ProgressEverySeconds = 600
    )

    $lastReport = Get-Date
    while ($true) {
        $remaining = ($Until - (Get-Date)).TotalSeconds
        if ($remaining -le 0) { break }
        Start-Sleep -Seconds ([Math]::Max(1, [Math]::Min(30, [int][Math]::Ceiling($remaining))))
        if (((Get-Date) - $lastReport).TotalSeconds -ge $ProgressEverySeconds) {
            $left = ($Until - (Get-Date)).TotalSeconds
            if ($left -gt 0) {
                Write-PortLog Debug ("{0}: {1} left (until {2})" -f $Label, (Format-Duration ([int]$left)), $Until.ToString('HH:mm'))
            }
            $lastReport = Get-Date
        }
    }
}

function Get-UsageSnapshot {
    <#
    .SYNOPSIS
        Read the plan-usage snapshot mirrored by the interactive status line.
    .DESCRIPTION
        Claude Code hands plan usage to a session's status line only; `claude -p` never sees it,
        and there is no CLI command that reports it. ~/.claude/statusline.sh therefore mirrors the
        numbers to a file that this function reads.

        A snapshot is only produced while an interactive session is open and rendering, so a stale
        file means "no reading", NEVER "0% used". Treating stale data as fresh would let the guard
        wave through a run that is actually about to exhaust the window.
    #>
    param(
        [string]$Path = (Join-Path $HOME '.claude/usage-snapshot.json'),
        [int]$MaxAgeMinutes = 15
    )

    $absent = @{ Available = $false; Reason = 'no snapshot file'; AgeMinutes = $null }
    if (-not (Test-Path -LiteralPath $Path)) { return $absent }

    try {
        $raw = [System.IO.File]::ReadAllText($Path)
        $j = $raw | ConvertFrom-Json
    } catch {
        return @{ Available = $false; Reason = 'unreadable snapshot'; AgeMinutes = $null }
    }

    $epoch = [DateTimeOffset]::FromUnixTimeSeconds([int64]$j.capturedAt).ToLocalTime().DateTime
    $ageMin = ((Get-Date) - $epoch).TotalMinutes
    if ($ageMin -gt $MaxAgeMinutes) {
        return @{ Available = $false; Reason = ("snapshot is {0:N0} min old (max {1})" -f $ageMin, $MaxAgeMinutes); AgeMinutes = $ageMin }
    }

    $toLocal = {
        param($unix)
        if ($null -eq $unix -or [int64]$unix -le 0) { return $null }
        [DateTimeOffset]::FromUnixTimeSeconds([int64]$unix).ToLocalTime().DateTime
    }

    return @{
        Available        = $true
        Reason           = $null
        AgeMinutes       = $ageMin
        FiveHourPercent  = [int]$j.fiveHourPercent
        FiveHourResetsAt = & $toLocal $j.fiveHourResetsAt
        SevenDayPercent  = [int]$j.sevenDayPercent
        SevenDayResetsAt = & $toLocal $j.sevenDayResetsAt
        CapturedAt       = $epoch
    }
}

function Invoke-ExternalProcess {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [AllowNull()][string]$StdinText = $null,
        [Parameter(Mandatory)][string]$LogPath,
        [hashtable]$EnvVars = @{},
        [Parameter(Mandatory)][int]$TimeoutSeconds,
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [switch]$LiveLog
    )

    $logDir = Split-Path -Parent $LogPath
    if ($logDir -and -not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    $errPath = [System.IO.Path]::ChangeExtension($LogPath, '.err.log')

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FilePath
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.StandardOutputEncoding = $script:Utf8NoBom
    $psi.StandardErrorEncoding = $script:Utf8NoBom
    foreach ($a in $Arguments) { [void]$psi.ArgumentList.Add([string]$a) }
    foreach ($k in $EnvVars.Keys) { $psi.Environment[[string]$k] = [string]$EnvVars[$k] }

    $proc = [System.Diagnostics.Process]::new()
    $proc.StartInfo = $psi
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [void]$proc.Start()

    # stdin: always close, so the child sees EOF instead of blocking on a read.
    try {
        if ($null -ne $StdinText -and $StdinText.Length -gt 0) {
            $proc.StandardInput.Write($StdinText)
        }
    } catch {
        Write-PortLog Warn "stdin write failed (process may have exited early): $($_.Exception.Message)"
    } finally {
        try { $proc.StandardInput.Close() } catch { }
    }

    # Drain both pipes CONCURRENTLY. Reading one to the end before the other deadlocks.
    $useThreadJob = $false
    if ($LiveLog) {
        $useThreadJob = $null -ne (Get-Command Start-ThreadJob -ErrorAction SilentlyContinue)
        if (-not $useThreadJob) {
            Write-PortLog Warn 'Start-ThreadJob unavailable; falling back to buffered logging for this phase.'
        }
    }

    $outJob = $null; $errJob = $null; $outTask = $null; $errTask = $null
    if ($useThreadJob) {
        $tee = {
            param($reader, $path)
            $writer = [System.IO.StreamWriter]::new($path, $false, [System.Text.UTF8Encoding]::new($false))
            try {
                while ($null -ne ($line = $reader.ReadLine())) { $writer.WriteLine($line); $writer.Flush() }
            } finally { $writer.Dispose() }
        }
        $outJob = Start-ThreadJob -ScriptBlock $tee -ArgumentList $proc.StandardOutput, $LogPath
        $errJob = Start-ThreadJob -ScriptBlock $tee -ArgumentList $proc.StandardError, $errPath
    } else {
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
    }

    # Watchdog driven by our own stopwatch, NOT by WaitForExit's timeout. With stdout/stderr
    # redirected and drained asynchronously, the timed overload has been observed blocking far past
    # its deadline - 49 minutes on an 18 minute budget - which turns one hung child into a
    # permanently stalled run. HasExited is authoritative and cannot be fooled. Polling also keeps
    # Ctrl-C responsive, which a blocking wait does not.
    $timedOut = $false
    $deadlineMs = [double]$TimeoutSeconds * 1000.0
    while (-not $proc.HasExited) {
        if ($sw.Elapsed.TotalMilliseconds -ge $deadlineMs) { $timedOut = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if ($timedOut) {
        Write-PortLog Warn "Timeout after ${TimeoutSeconds}s - killing process tree (pid $($proc.Id))."
        try { $proc.Kill($true) } catch { }
        [void]$proc.WaitForExit(20000)
        try {
            if (-not $proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null }
        } catch { }
    }
    # Let the async readers flush, but bounded: claude spawns node children that inherit the pipe
    # handles, and one surviving grandchild would make the argument-less overload block forever.
    [void]$proc.WaitForExit(30000)

    if ($useThreadJob) {
        $null = Wait-Job -Job $outJob, $errJob -Timeout 30
        Remove-Job -Job $outJob, $errJob -Force -ErrorAction SilentlyContinue
        $stdout = if (Test-Path -LiteralPath $LogPath) { [System.IO.File]::ReadAllText($LogPath) } else { '' }
        $stderr = if (Test-Path -LiteralPath $errPath) { [System.IO.File]::ReadAllText($errPath) } else { '' }
    } else {
        # Bounded for the same reason: GetResult() on a pipe a grandchild still holds open never
        # returns. Losing the tail of a log is recoverable; a wedged run is not.
        $stdout = if ($outTask.Wait(30000)) { $outTask.Result } else { '' }
        $stderr = if ($errTask.Wait(30000)) { $errTask.Result } else { '' }
        [System.IO.File]::WriteAllText($LogPath, $stdout, $script:Utf8NoBom)
        if ($stderr) { [System.IO.File]::WriteAllText($errPath, $stderr, $script:Utf8NoBom) }
    }

    $exit = try { $proc.ExitCode } catch { -1 }
    $sw.Stop()
    $proc.Dispose()

    return [pscustomobject]@{
        ExitCode    = $exit
        TimedOut    = $timedOut
        DurationSec = [int]$sw.Elapsed.TotalSeconds
        StdOut      = $stdout
        StdErr      = $stderr
        LogPath     = $LogPath
    }
}

# ---------------------------------------------------------------------------
# Claude CLI output parsing
# ---------------------------------------------------------------------------

function ConvertFrom-ClaudeOutput {
    [CmdletBinding()]
    param(
        [AllowNull()][AllowEmptyString()][string]$Text,
        [ValidateSet('json', 'stream-json')][string]$Format = 'json'
    )

    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

    $obj = $null
    if ($Format -eq 'stream-json') {
        foreach ($line in ($Text -split "`r?`n")) {
            $t = $line.Trim()
            if ($t.Length -lt 2 -or $t[0] -ne '{') { continue }
            try { $o = $t | ConvertFrom-Json -Depth 100 } catch { continue }
            if (($o.PSObject.Properties.Name -contains 'type') -and $o.type -eq 'result') { $obj = $o }
        }
    } else {
        $t = $Text.Trim()
        try { $obj = $t | ConvertFrom-Json -Depth 100 } catch {
            # Tolerate banner text before the JSON payload.
            $i = $t.IndexOf('{')
            if ($i -ge 0) { try { $obj = $t.Substring($i) | ConvertFrom-Json -Depth 100 } catch { } }
        }
    }
    if (-not $obj) { return $null }

    $prop = { param($n, $default) if ($obj.PSObject.Properties.Name -contains $n -and $null -ne $obj.$n) { $obj.$n } else { $default } }

    return [pscustomobject]@{
        IsError    = [bool](& $prop 'is_error' $false)
        Subtype    = [string](& $prop 'subtype' '')
        Result     = [string](& $prop 'result' '')
        SessionId  = [string](& $prop 'session_id' '')
        CostUsd    = [double](& $prop 'total_cost_usd' 0)
        DurationMs = [int](& $prop 'duration_ms' 0)
        NumTurns   = [int](& $prop 'num_turns' 0)
        Raw        = $obj
    }
}

# ---------------------------------------------------------------------------
# Authentication mode
# ---------------------------------------------------------------------------

<#
Returns the parsed output of `claude auth status`, or $null if it cannot be read.
Relevant fields: loggedIn, authMethod ("claude.ai" for OAuth), apiProvider,
subscriptionType ("max", "pro", ...). A subscription login is billed against the
plan's usage limits, not per-token, so the dollar guards are meaningless there
and rate limits become the real constraint.
#>
function Get-ClaudeAuthInfo {
    try {
        $claude = Resolve-Launcher -Name 'claude'
        $out = (& $claude.File @($claude.Prefix + @('auth', 'status')) 2>&1) | Out-String
        $i = $out.IndexOf('{')
        if ($i -ge 0) { return ($out.Substring($i) | ConvertFrom-Json) }
    } catch { }
    return $null
}

function Test-UsesSubscription {
    param($AuthInfo)
    if ($env:ANTHROPIC_API_KEY -or $env:ANTHROPIC_AUTH_TOKEN) { return $false }
    if (-not $AuthInfo) { return $false }
    if ($AuthInfo.PSObject.Properties.Name -contains 'subscriptionType' -and $AuthInfo.subscriptionType) { return $true }
    return ($AuthInfo.PSObject.Properties.Name -contains 'authMethod' -and $AuthInfo.authMethod -eq 'claude.ai')
}

# ---------------------------------------------------------------------------
# Plan usage limits
# ---------------------------------------------------------------------------

$script:RateLimitPatterns = @(
    '(?i)usage limit reached'
    '(?i)rate[_ ]limit'
    '(?i)\b429\b'
    '(?i)too many requests'
    '(?i)you have exceeded your (usage|rate)'
    '(?i)limit will reset'
    '(?i)resets? at'
    '(?i)upgrade to increase your usage limit'
)

<#
Detects a plan usage/rate limit and, when the message carries one, the moment it
resets. Claude Code emits several shapes depending on version, e.g.
    Claude AI usage limit reached|1793827200        (unix seconds)
    Claude usage limit reached. Your limit will reset at 3pm (Europe/Paris).
Returns @{ Hit = [bool]; ResetAt = [datetime] or $null; Evidence = <matched text> }.
#>
function Test-RateLimit {
    param([AllowNull()][AllowEmptyString()][string]$Text)

    $result = @{ Hit = $false; ResetAt = $null; Evidence = $null }
    if ([string]::IsNullOrWhiteSpace($Text)) { return $result }

    foreach ($p in $script:RateLimitPatterns) {
        $m = [regex]::Match($Text, $p)
        if ($m.Success) {
            $result.Hit = $true
            $start = [Math]::Max(0, $m.Index - 120)
            $len = [Math]::Min($Text.Length - $start, 320)
            $result.Evidence = $Text.Substring($start, $len).Trim()
            break
        }
    }
    if (-not $result.Hit) { return $result }

    # Pipe-delimited unix timestamp (seconds), the machine-readable form.
    $ts = [regex]::Match($Text, 'usage limit reached\s*\|\s*(\d{10,13})')
    if ($ts.Success) {
        $v = [long]$ts.Groups[1].Value
        if ($v -gt 99999999999) { $v = [long]($v / 1000) }   # milliseconds
        try { $result.ResetAt = [DateTimeOffset]::FromUnixTimeSeconds($v).LocalDateTime } catch { }
    }

    # ISO 8601 reset hint, e.g. "resets at 2026-07-29T18:00:00Z".
    if (-not $result.ResetAt) {
        $iso = [regex]::Match($Text, '(?i)reset[^0-9]{0,20}(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?)')
        if ($iso.Success) {
            try { $result.ResetAt = ([datetime]::Parse($iso.Groups[1].Value)).ToLocalTime() } catch { }
        }
    }

    return $result
}

# ---------------------------------------------------------------------------
# "The model asked a question instead of doing the work" heuristic
# ---------------------------------------------------------------------------

$script:QuestionPatterns = @(
    '(?im)^\s*\*{0,2}(would you like|do you want|should i|shall i|may i|can you (confirm|clarify)|please (confirm|choose|specify|provide|clarify)|let me know)\b'
    '(?im)^\s*\|\s*Option\s*\|'
    '(?im)_?\[?\s*Wait(ing)? for (the )?user'
    '(?im)^\s*#{1,4}\s*Question\s*\[?\d'
    '(?im)\(yes\s*/\s*no\)\s*$'
    '(?im)^\s*\*\*Your choice\*\*'
)

function Test-AskedQuestion {
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Result)

    if ([string]::IsNullOrWhiteSpace($Result)) { return $false }
    foreach ($p in $script:QuestionPatterns) { if ($Result -match $p) { return $true } }
    $last = ($Result -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
    return ($null -ne $last -and $last.TrimEnd().EndsWith('?'))
}

# ---------------------------------------------------------------------------
# Prompt templating
# ---------------------------------------------------------------------------

function Expand-PromptTemplate {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][hashtable]$Tokens
    )
    if (-not (Test-Path -LiteralPath $Path)) { throw "Prompt template not found: $Path" }
    $text = [System.IO.File]::ReadAllText($Path)
    foreach ($k in $Tokens.Keys) {
        $value = if ($null -eq $Tokens[$k]) { '' } else { [string]$Tokens[$k] }
        $text = $text.Replace("{{$k}}", $value)
    }
    $m = [regex]::Match($text, '\{\{([A-Z0-9_]+)\}\}')
    if ($m.Success) { throw "Unreplaced token {{$($m.Groups[1].Value)}} in $Path" }
    # Collapse the blank lines left behind by empty optional tokens.
    return ($text -replace '(\r?\n){3,}', "`n`n")
}

# ---------------------------------------------------------------------------
# Failure digests
# ---------------------------------------------------------------------------

function Get-FailureDigest {
    [CmdletBinding()]
    param(
        [AllowNull()][AllowEmptyString()][string]$Text,
        [int]$Head = 40,
        [int]$Tail = 160,
        [int]$MaxChars = 14000
    )
    if ([string]::IsNullOrEmpty($Text)) { return '(no output)' }
    $lines = $Text -split "`r?`n"
    if ($lines.Count -le ($Head + $Tail)) {
        $digest = $Text
    } else {
        $omitted = $lines.Count - $Head - $Tail
        $digest = (@($lines[0..($Head - 1)]) +
                   @('', "... [$omitted lines omitted] ...", '') +
                   @($lines[($lines.Count - $Tail)..($lines.Count - 1)])) -join "`n"
    }
    if ($digest.Length -gt $MaxChars) {
        $digest = "... [head truncated] ...`n" + $digest.Substring($digest.Length - $MaxChars)
    }
    return $digest
}

# ---------------------------------------------------------------------------
# Hashing (line-ending normalised, so a CRLF/LF difference is not a change)
# ---------------------------------------------------------------------------

function Get-NormalizedHash {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $text = [System.IO.File]::ReadAllText($Path) -replace "`r`n", "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text.Trim())
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

# ---------------------------------------------------------------------------
# State file (atomic read / modify / write)
# ---------------------------------------------------------------------------

function New-PortState {
    return @{
        schemaVersion       = 1
        orchestratorVersion = '1.0.0'
        createdAt           = (Get-Date).ToString('o')
        updatedAt           = (Get-Date).ToString('o')
        status              = 'idle'
        lastRunId           = $null
        upstreamCommit      = $null
        totals              = @{ costUsd = 0.0; durationSec = 0; done = 0; failed = 0; skipped = 0 }
        bootstrap           = @{ status = 'pending'; steps = @{}; commit = $null; finishedAt = $null; costUsd = 0.0 }
        components          = @{}
    }
}

function Read-PortState {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return (New-PortState) }
    try {
        $raw = [System.IO.File]::ReadAllText($Path)
        if ([string]::IsNullOrWhiteSpace($raw)) { return (New-PortState) }
        return ($raw | ConvertFrom-Json -Depth 100 -AsHashtable)
    } catch {
        $backup = "$Path.corrupt-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
        Write-PortLog Warn "State file unreadable ($($_.Exception.Message)). Backing it up to $backup and starting fresh."
        Move-Item -LiteralPath $Path -Destination $backup -Force
        return (New-PortState)
    }
}

function Save-PortState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$State,
        [Parameter(Mandatory)][string]$Path
    )
    $State.updatedAt = (Get-Date).ToString('o')
    $tmp = "$Path.tmp"
    $json = $State | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($tmp, $json, $script:Utf8NoBom)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

# ---------------------------------------------------------------------------
# Single-writer lock: Spec Kit feature state (.specify/feature.json) is global,
# so two concurrent runs would corrupt each other.
# ---------------------------------------------------------------------------

$script:PortLockHandle = $null

function Lock-PortRun {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    try {
        $script:PortLockHandle = [System.IO.File]::Open($Path, 'OpenOrCreate', 'ReadWrite', 'None')
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("$PID`n$((Get-Date).ToString('o'))`n")
        $script:PortLockHandle.SetLength(0)
        $script:PortLockHandle.Write($bytes, 0, $bytes.Length)
        $script:PortLockHandle.Flush()
    } catch {
        throw "Another port run holds $Path. Refusing to start: Spec Kit feature state is global and cannot be shared between concurrent runs."
    }
}

function Unlock-PortRun {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if ($script:PortLockHandle) {
        try { $script:PortLockHandle.Dispose() } catch { }
        $script:PortLockHandle = $null
    }
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Git helpers (the orchestrator owns git; agents never touch it)
# ---------------------------------------------------------------------------

function Invoke-Git {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$GitArgs
    )
    $out = & git -C $RepoRoot @GitArgs 2>&1
    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output   = ($out | Out-String)
    }
}

function Test-GitClean {
    param([Parameter(Mandatory)][string]$RepoRoot)
    $r = Invoke-Git -RepoRoot $RepoRoot status --porcelain
    return [string]::IsNullOrWhiteSpace($r.Output)
}

# ---------------------------------------------------------------------------
# Claude invocation
# ---------------------------------------------------------------------------

<#
Builds the argument list and runs one `claude -p` phase.

Returns [pscustomobject] with Proc (the Invoke-ExternalProcess result),
Parsed (the ConvertFrom-ClaudeOutput result, possibly $null) and SessionId.
#>
function Invoke-ClaudePhase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$Prompt,
        [Parameter(Mandatory)][string]$LogPath,
        [Parameter(Mandatory)][string]$SystemPrompt,
        [Parameter(Mandatory)][string]$SettingsPath,
        [Parameter(Mandatory)][int]$TimeoutSeconds,
        [hashtable]$EnvVars = @{},
        [string]$Model,
        [string]$FallbackModel,
        [string]$Effort,
        [double]$BudgetUsd = 0,
        [ValidateSet('json', 'stream-json')][string]$Format = 'json',
        [string]$JsonSchema,
        [ValidateSet('bypass', 'allowlist')][string]$PermissionProfile = 'bypass',
        [string]$SessionId,
        [switch]$LiveLog
    )

    if (-not $SessionId) { $SessionId = [guid]::NewGuid().ToString() }

    $claude = Resolve-Launcher -Name 'claude'
    $argv = @($claude.Prefix)
    $argv += @('-p', '--output-format', $Format)
    if ($Format -eq 'stream-json') { $argv += '--verbose' }
    if ($Model) { $argv += @('--model', $Model) }
    if ($FallbackModel) { $argv += @('--fallback-model', $FallbackModel) }
    if ($Effort) { $argv += @('--effort', $Effort) }
    if ($BudgetUsd -gt 0) { $argv += @('--max-budget-usd', ([string]$BudgetUsd)) }
    if ($JsonSchema) { $argv += @('--json-schema', $JsonSchema) }
    $argv += @('--append-system-prompt', $SystemPrompt)
    $argv += @('--settings', $SettingsPath)
    $argv += @('--setting-sources', 'project,local')
    $argv += @('--session-id', $SessionId)
    if ($PermissionProfile -eq 'bypass') {
        $argv += '--dangerously-skip-permissions'
    } else {
        $argv += @('--permission-mode', 'acceptEdits')
    }
    # Second layer of git protection, independent of whichever settings file resolved.
    $argv += '--disallowedTools'
    $argv += @(
        'Bash(git commit*)', 'Bash(git add*)', 'Bash(git push*)', 'Bash(git reset*)',
        'Bash(git checkout*)', 'Bash(git switch*)', 'Bash(git branch*)', 'Bash(git rebase*)',
        'Bash(git merge*)', 'Bash(git stash*)', 'Bash(git tag*)', 'Bash(git clean*)', 'Bash(gh *)',
        'Bash(pnpm publish*)', 'Bash(npm publish*)', 'Bash(pnpm dev*)', 'Bash(npm run dev*)'
    )

    $env2 = @{
        CI             = '1'
        NO_COLOR       = '1'
        FORCE_COLOR    = '0'
        DO_NOT_TRACK   = '1'
        ADBLOCK        = '1'
        npm_config_yes = 'true'
    }
    foreach ($k in $EnvVars.Keys) { $env2[$k] = $EnvVars[$k] }

    $proc = Invoke-ExternalProcess -FilePath $claude.File -Arguments $argv -StdinText $Prompt `
        -LogPath $LogPath -EnvVars $env2 -TimeoutSeconds $TimeoutSeconds `
        -WorkingDirectory $RepoRoot -LiveLog:$LiveLog

    $parsed = ConvertFrom-ClaudeOutput -Text $proc.StdOut -Format $Format

    if ($parsed) {
        $resultJsonPath = [System.IO.Path]::ChangeExtension($LogPath, '.result.json')
        try {
            [System.IO.File]::WriteAllText($resultJsonPath, ($parsed.Raw | ConvertTo-Json -Depth 100), $script:Utf8NoBom)
        } catch { }
    }

    return [pscustomobject]@{
        Proc      = $proc
        Parsed    = $parsed
        SessionId = $SessionId
    }
}

# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

function Format-Duration {
    param([int]$Seconds)
    if ($Seconds -lt 60) { return "${Seconds}s" }
    $ts = [TimeSpan]::FromSeconds($Seconds)
    # [int] rounds in PowerShell; floor is what we want for a duration.
    if ($ts.TotalHours -ge 1) { return ('{0}h{1:00}m' -f [Math]::Floor($ts.TotalHours), $ts.Minutes) }
    return ('{0}m{1:00}s' -f [Math]::Floor($ts.TotalMinutes), $ts.Seconds)
}
