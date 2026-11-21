# Runs harness.html twice under headless Edge: once against the real
# js/search_builder.js, once against a deliberately broken copy.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File run.ps1             (the LIVE js\search_builder.js)
#   powershell -NoProfile -ExecutionPolicy Bypass -File run.ps1 -Js <file>  (another build's search_builder.js)
#
# Ends with three lines a runner can read, and an exit code (0 green, 1 red):
#   TOTAL pass=N fail=M
#   CONTROL: as expected (...)      or   CONTROL: NOT as expected (...)
#   RESULT: GREEN                   or   RESULT: RED
#
# The CONTROL is not optional. On file:// without --allow-file-access-from-files
# a script error is sanitised to "Script error.", so a harness can report success
# while testing nothing. Baking the source into a JS string literal (below)
# sidesteps that entirely, and the control proves the suite can still fail.
#
# (2026-11-17) Two repairs, no check changed:
#  - The script never exited by itself. Start-Process -Wait waits for the whole
#    process TREE, and headless Edge leaves children behind (crashpad, a
#    background renderer) after the browser process is done, so the first Edge
#    run was waited on for ever and the control never ran (a full run reported
#    TIMEOUT). On the aged fixed profile folder u1 the browser process itself
#    also stayed up after writing its dump. Now: a fresh profile folder per run
#    under %TEMP% (removed afterwards), -PassThru, a bounded wait that ends when
#    the browser process ends or the dump is complete, then whatever Edge still
#    runs on THAT profile folder is stopped (matched by its --user-data-dir,
#    nothing else is touched). Leftovers keep real.txt / ctrl.txt open for a
#    moment, hence the short retries.
#  - The control's three required failures printed as "FAIL" lines, which a log
#    scan reads as a red suite. They print as "EXPECTED-RED" now, and the control
#    is judged here: it is "as expected" only when the broken copy turns red on
#    EXACTLY the checks that need de-duplication ($controlMustRed) and every
#    other check still holds. Any other outcome (no red at all, a different set,
#    a harness error) is "NOT as expected" and makes the run RED.
#
# UNC .ps1 files are GPO-blocked from running directly under the long server
# name: start it from the suite folder under \\oitras\d$\... (as the full
# runner does), or paste this body as a scriptblock.
param([string]$Js = '')

# $MyInvocation.MyCommand.Path is null when this body is run as a scriptblock
# (the GPO workaround above), so check before calling Split-Path on it.
$dir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }
       else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_penumbra\penumbra_tests\listpaste' }
$jsPath = if ($Js) { $Js } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js\search_builder.js' }
Write-Output "search_builder.js under test: $jsPath"

# The checks the broken copy (de-duplication removed) MUST turn red: exactly these.
$controlMustRed = @('de-duplicates', 'keeps first-seen order', 'prototype keys still de-dup')

$src = [IO.File]::ReadAllText($jsPath)
[IO.File]::WriteAllText("$dir\SRC.js", "window.__src = " + ($src | ConvertTo-Json -Compress) + ";")

# harnessb.html = same suite, but with window.__break set so the extracted
# normalizeValueList loses its de-duplication.
$h = [IO.File]::ReadAllText("$dir\harness.html")
[IO.File]::WriteAllText("$dir\harnessb.html", $h.Replace('<script src="SRC.js"></script>',
    '<script src="SRC.js"></script><script>window.__break=1;</script>'))

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

# Stops the Edge processes started on one profile folder of this run (and only
# those: matched by the folder's unique name in --user-data-dir), and waits for
# them to be gone.
function Stop-ProfileEdge($uddName) {
  try {
    $ids = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($uddName, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
      ForEach-Object { $_.ProcessId })
    foreach ($id in $ids) { try { Stop-Process -Id $id -Force -ErrorAction Stop } catch { } }
    foreach ($id in $ids) { try { Wait-Process -Id $id -Timeout 10 -ErrorAction Stop } catch { } }
  } catch { }
}
# A stopped Edge lets go of the dump file a moment after it is gone: retry for up to 15 s.
function With-Retry([scriptblock]$io) {
  for ($i = 0; ; $i++) {
    try { return (& $io) } catch { if ($i -ge 30) { throw }; Start-Sleep -Milliseconds 500 }
  }
}
# The dump as written so far, read without locking Edge out of it.
function Read-Shared($path) {
  try {
    $fs = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try { $sr = New-Object IO.StreamReader($fs); return $sr.ReadToEnd() } finally { $fs.Close() }
  } catch { return '' }
}

foreach ($p in @(@('harness.html','real.txt'), @('harnessb.html','ctrl.txt'))) {
  $outFile = Join-Path $dir $p[1]
  # A fresh profile per run, outside the suite, removed afterwards. The old fixed
  # folders (u1, u2 here) are no longer used: on the aged u1 the browser process
  # wrote its dump and then stayed up for good (seen 2026-11-17, twice in a row).
  $uddName = 'pnb_listpaste_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $udd = Join-Path $env:TEMP $uddName
  With-Retry { [IO.File]::WriteAllText($outFile, '') }   # never read a previous run's dump as this run's
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $outFile `
    -RedirectStandardError ($outFile + '.err') -ArgumentList `
    '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
    ("--user-data-dir=" + $udd),'--dump-dom',
    ("file:///" + (Join-Path $dir $p[0]).Replace('\','/'))
  # -Wait alone HANGS (see the header). Done = the browser process ended, or the
  # dump is complete (its closing tag is written); 120 s at most either way.
  $t0 = Get-Date; $how = 'timeout'
  while (((Get-Date) - $t0).TotalSeconds -lt 120) {
    if ($pr.WaitForExit(500)) { $how = 'exit'; break }
    if ((Read-Shared $outFile) -match '</html>\s*$') { $how = 'dump'; break }
  }
  if ($how -eq 'timeout') { Write-Output "Edge did not finish $($p[0]) in 120 s; stopping it" }
  Stop-ProfileEdge $uddName
  try { if (-not $pr.HasExited) { $pr.Kill() } } catch { }
  for ($i = 0; $i -lt 10 -and (Test-Path -LiteralPath $udd); $i++) {
    try { Remove-Item -LiteralPath $udd -Recurse -Force -ErrorAction Stop }
    catch { Stop-ProfileEdge $uddName; Start-Sleep -Milliseconds 500 }   # a child Edge started after the first sweep
  }
}

# One run's <pre id="out">, as lines, and what it says.
function Read-Run($file) {
  $dom = With-Retry { [IO.File]::ReadAllText((Join-Path $dir $file)) }
  $m = [regex]::Match($dom, '(?s)<pre id="out">(.*?)</pre>')
  $body = if ($m.Success) { $m.Groups[1].Value } else { '(no output captured)' }
  $body = $body -replace '&quot;','"' -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&'
  $lines = @($body -split "`r?`n")
  $t = [regex]::Match($body, '(\d+) passed, (\d+) failed')
  New-Object PSObject -Property @{
    Lines  = $lines
    Done   = $t.Success                       # the harness reached its last line (no HARNESS-ERROR, no empty dump)
    Pass   = if ($t.Success) { [int]$t.Groups[1].Value } else { 0 }
    Fail   = if ($t.Success) { [int]$t.Groups[2].Value } else { 0 }
    Ok     = @($lines | Where-Object { $_ -match '^  ok   ' }   | ForEach-Object { $_.Substring(7) })
    Failed = @($lines | Where-Object { $_ -match '^  FAIL ' }   | ForEach-Object { $_.Substring(7) })
  }
}

$real = Read-Run 'real.txt'
$ctrl = Read-Run 'ctrl.txt'

Write-Output '===== REAL search_builder.js ====='
$real.Lines | ForEach-Object { Write-Output $_ }

# The control's reds are REQUIRED, so they are not printed as failures: a check
# the broken copy turns red reads EXPECTED-RED when it is one of $controlMustRed
# and UNEXPECTED-RED when it is not, and the harness's own "N passed, M failed"
# tail is restated in those words.
Write-Output ''
Write-Output '===== BROKEN-COPY CONTROL (de-duplication removed; the reds below are REQUIRED) ====='
foreach ($l in $ctrl.Lines) {
  if ($l -match '^  FAIL (.*)$') {
    $tag = if ($controlMustRed -contains $Matches[1]) { 'EXPECTED-RED' } else { 'UNEXPECTED-RED' }
    Write-Output "  $tag $($Matches[1])"
  } elseif ($l -match '^\d+ passed, \d+ failed') {
    Write-Output "$($ctrl.Pass) held, $($ctrl.Fail) red on the broken copy"
  } else { Write-Output $l }
}

# ---- verdicts --------------------------------------------------------------
$realGreen = $real.Done -and $real.Fail -eq 0 -and $real.Pass -gt 0 -and $real.Failed.Count -eq 0
$missing = @($controlMustRed | Where-Object { $ctrl.Failed -notcontains $_ })      # should be red, is not
$stray   = @($ctrl.Failed   | Where-Object { $controlMustRed -notcontains $_ })    # red, should not be
# same checks ran in both, and everything outside $controlMustRed still held on the broken copy
$ctrlOk = $ctrl.Done -and $missing.Count -eq 0 -and $stray.Count -eq 0 -and
          $ctrl.Fail -eq $controlMustRed.Count -and ($ctrl.Pass + $ctrl.Fail) -eq ($real.Pass + $real.Fail)

Write-Output ''
if (-not $real.Done) { Write-Output 'REAL run did not finish (harness error or empty dump): see the lines above' }
Write-Output ("TOTAL pass={0} fail={1}" -f $real.Pass, $(if ($real.Done) { $real.Fail } else { 1 }))
if ($ctrlOk) {
  Write-Output ("CONTROL: as expected (the broken copy is red on exactly: {0}; the other {1} checks hold)" -f ($controlMustRed -join ' / '), $ctrl.Pass)
} else {
  $why = @()
  if (-not $ctrl.Done)  { $why += 'the control run did not finish' }
  if ($missing.Count)   { $why += 'stayed green on: ' + ($missing -join ' / ') }
  if ($stray.Count)     { $why += 'also red: ' + ($stray -join ' / ') }
  if (-not $why.Count)  { $why += "counts differ (control $($ctrl.Pass)+$($ctrl.Fail), real $($real.Pass)+$($real.Fail))" }
  Write-Output ('CONTROL: NOT as expected (' + ($why -join '; ') + ')')
}
if ($realGreen -and $ctrlOk) { Write-Output 'RESULT: GREEN'; exit 0 }
Write-Output 'RESULT: RED'
exit 1
