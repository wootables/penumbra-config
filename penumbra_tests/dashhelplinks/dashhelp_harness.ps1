# dashhelp_harness.ps1 - the dashboard help panel's link handling, in headless Edge (2026-10-16).
#
#   dashhelp_harness.ps1 -DashJs <path to penumbra_dashboard.js> [-Here <suite dir>] [-Out <scratch dir>] [-ExpectMutant]
#
# Lifts the help panel block (LOCAL_HELP .. the [data-dash-help] handler) out of -DashJs with
# lift_dashhelp.php, lays the harness page, jQuery, the lifted block and the whole file beside it
# in -Out, runs Edge headless with --dump-dom and prints T0..T5. With -ExpectMutant the file is the
# UNPATCHED penumbra_dashboard.js: T2 (a hub link left to the browser) must FAIL and everything
# else PASS - the mutant proves the harness sees the dead link. Prints RESULT: GREEN/RED.
# Everything goes to the output stream, so run.ps1 can capture it. Edge's own stderr lands in
# <Out>\edge_stderr.txt; its profile is a SHORT %TEMP% path (a long one makes Edge log cache errors).
param([string]$DashJs = '', [string]$Here = '', [string]$Out = '', [switch]$ExpectMutant)
$ErrorActionPreference = 'Stop'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not $DashJs) { throw 'usage: -DashJs <penumbra_dashboard.js> [-Out <dir>] [-ExpectMutant]' }
if (-not (Test-Path -LiteralPath $DashJs)) { throw "no such file: $DashJs" }
# Empty when run as a scriptblock (the execution policy refuses .ps1 files on the share): never the caller's cwd.
if (-not $Here) { $Here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashhelplinks' } }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('dashhelp_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff')) }
New-Item -ItemType Directory -Force $Out | Out-Null
Copy-Item (Join-Path $Here 'dashhelp_harness.html') (Join-Path $Out 'dashhelp_harness.html') -Force
Copy-Item (Join-Path $Here 'jquery-3.7.1.min.js') (Join-Path $Out 'jquery-3.7.1.min.js') -Force
Copy-Item -LiteralPath $DashJs -Destination (Join-Path $Out 'dash_full.js') -Force
$lift = & $php -n (Join-Path $Here 'lift_dashhelp.php') "--dashjs=$DashJs" "--out=$(Join-Path $Out 'lifted.js')" 2>&1 | Out-String
Write-Output ('  ' + $lift.Trim())
if ($LASTEXITCODE -ne 0) { Write-Output 'RESULT: RED (lift failed)'; return }
$dom = Join-Path $Out 'dom.html'
$prof = Join-Path $env:TEMP ('dhp_' + (Get-Date -Format 'HHmmssfff') + '_' + $PID)
$url = 'file:///' + ((Resolve-Path (Join-Path $Out 'dashhelp_harness.html')).Path -replace '\\', '/')
$p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', "--user-data-dir=`"$prof`"", '--virtual-time-budget=5000', '--dump-dom', "`"$url`"") -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $Out 'edge_stderr.txt') -PassThru -WindowStyle Hidden
# Headless Edge sometimes dumps the DOM and then never exits (seen 2026-10-16 on the live-file run):
# wait a bounded time, then stop every process of THIS profile only - the dump is already on disk.
$p.WaitForExit(90000) | Out-Null
if (-not $p.HasExited) {
  Write-Output '  (Edge did not exit after its dump; stopping the harness profile processes)'
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch { } }
  Start-Sleep -Seconds 2
}
try { [IO.Directory]::Delete($prof, $true) } catch { }
$html = Get-Content $dom -Raw
if ($html -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Output "RESULT: RED (no harness output; exit $($p.ExitCode))"; Write-Output ($html.Substring(0, [Math]::Min(600, $html.Length))); return }
$json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
if ($json -eq 'pending') { Write-Output 'RESULT: RED (the harness script never ran)'; return }
$res = $json | ConvertFrom-Json
$red = 0; $seen = 0
foreach ($prop in $res.PSObject.Properties) {
  $seen++
  $ok = $prop.Value.StartsWith('PASS')
  $mustFail = $ExpectMutant -and ($prop.Name -like 'T2 *')
  $verdict = if ($mustFail) { if ($ok) { 'UNEXPECTED PASS' } else { 'fails as the mutant must' } } else { if ($ok) { 'PASS' } else { 'FAIL' } }
  if (($mustFail -and $ok) -or (-not $mustFail -and -not $ok)) { $red++ }
  Write-Output ("  {0,-24} {1}  [{2}]" -f $verdict, $prop.Name, $prop.Value)
}
if ($seen -lt 7) { $red++; Write-Output "  (only $seen results; T0, T1a, T1b, T2, T3, T4, T5 expected)" }
Write-Output ("RESULT: " + $(if ($red -eq 0) { 'GREEN' } else { "RED ($red)" }) + $(if ($ExpectMutant) { ' (mutant run)' } else { ' (control run)' }))
