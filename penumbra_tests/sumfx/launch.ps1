# Run a penumbra_tests PowerShell suite under the RemoteSigned machine policy:
# an unsigned .ps1 on the \\oitras share is refused, a LOCAL copy is not. The
# copy's $here / $PSScriptRoot are pointed back at the suite folder, so it
# reads its driver / harness / fixtures from there exactly as it would in place.
#   launch.ps1 -Suite savelayout -Out C:\...\reg_savelayout.txt -- -MainJs X -MainCss Y
# This file sits on the RemoteSigned share itself, so invoke it as a scriptblock:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<this file>'))) -Suite savelayout -Out C:\...\out.txt -- -MainJs X
param(
    [Parameter(Mandatory = $true)][string]$Suite,
    [Parameter(Mandatory = $true)][string]$Out,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = 'Stop'
$tests = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests'
$dir = Join-Path $tests $Suite
$src = Join-Path $dir 'run.ps1'
if (-not (Test-Path -LiteralPath $src)) { throw "no run.ps1 in $dir" }
$text = [IO.File]::ReadAllText($src)
$lit = "'" + $dir.Replace("'", "''") + "'"
# the first `$here = ...` line, whatever its form, becomes the suite folder
$rx = [regex]'(?m)^(\s*)\$here\s*=.*$'
if (-not $rx.IsMatch($text)) { throw "no `$here assignment in $src" }
$text = $rx.Replace($text, ('$1$here = ' + $lit).Replace('$h', '$$h'), 1)
$text = $text.Replace('$PSScriptRoot', $lit)
$local = Join-Path $env:TEMP ('pnb_launch_' + $Suite)
if ($local -notmatch '\\pnb_launch_[a-z0-9]+$') { throw "refusing an unexpected local dir: $local" }
New-Item -ItemType Directory -Force -Path $local | Out-Null
$copy = Join-Path $local 'run.ps1'
[IO.File]::WriteAllText($copy, $text, (New-Object Text.UTF8Encoding($true)))
# Start-Process, not `& powershell ... *>`: PS 5.1 turns a child's stderr lines
# into ErrorRecords, which under Stop end THIS script mid-suite.
$q = { param($s) if ($s -match '[\s"]') { '"' + $s.Replace('"', '\"') + '"' } else { $s } }
$argLine = (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $copy) + @($Rest | Where-Object { $_ -ne '--' }) | ForEach-Object { & $q $_ }) -join ' '
$errFile = $Out + '.stderr'
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -WorkingDirectory $env:TEMP -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $Out -RedirectStandardError $errFile
$err = if (Test-Path -LiteralPath $errFile) { [IO.File]::ReadAllText($errFile) } else { '' }
if ($err.Trim()) { [IO.File]::AppendAllText($Out, "`r`n--- stderr ---`r`n" + $err) }
"$Suite exit=$($p.ExitCode)"
