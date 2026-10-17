# helphash_harness.ps1 - the Help Center deep-link parse, #help=<topic>[:<anchor>], in headless Edge (2026-10-16).
#
#   helphash_harness.ps1 -MainJs <path to main.js> [-Here <suite dir>] [-Out <scratch dir>] [-MustFail H2,H3,...]
#
# Lifts _helpTocItemFor and the boot-time _helpHash block out of -MainJs (lift_helphash.php), lays the
# harness page, jQuery and the lifted block beside it in -Out, runs Edge headless with --dump-dom and
# prints H0..H14. -MustFail names the cases that MUST fail for this file (the pre-change main.js, or a
# mutant made from the stage): those must FAIL and every other case PASS. Prints RESULT: GREEN/RED.
# Everything goes to the output stream, so run.ps1 can capture it. Edge's own stderr lands in
# <Out>\edge_stderr.txt; its profile is a SHORT %TEMP% path (a long one makes Edge log cache errors).
param([string]$MainJs = '', [string]$Here = '', [string]$Out = '', [string]$MustFail = '')
$ErrorActionPreference = 'Stop'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not $MainJs) { throw 'usage: -MainJs <main.js> [-Out <dir>] [-MustFail H2,H3]' }
if (-not (Test-Path -LiteralPath $MainJs)) { throw "no such file: $MainJs" }
# Empty when run as a scriptblock (the execution policy refuses .ps1 files on the share): never the caller's cwd.
if (-not $Here) { $Here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpanchor' } }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('helphash_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff')) }
New-Item -ItemType Directory -Force $Out | Out-Null
Copy-Item (Join-Path $Here 'helphash_harness.html') (Join-Path $Out 'helphash_harness.html') -Force
Copy-Item (Join-Path $Here 'jquery-3.7.1.min.js') (Join-Path $Out 'jquery-3.7.1.min.js') -Force
# No 2>&1 here: under $ErrorActionPreference = 'Stop' php's first stderr line would become an exception; the lift's exit code decides.
$lift = & $php -n (Join-Path $Here 'lift_helphash.php') "--mainjs=$MainJs" "--out=$(Join-Path $Out 'lifted.js')" | Out-String
Write-Output ('  ' + $lift.Trim())
if ($LASTEXITCODE -ne 0) { Write-Output 'RESULT: RED (lift failed)'; return }
$dom = Join-Path $Out 'dom.html'
$prof = Join-Path $env:TEMP ('hhp_' + (Get-Date -Format 'HHmmssfff') + '_' + $PID)
$url = 'file:///' + ((Resolve-Path (Join-Path $Out 'helphash_harness.html')).Path -replace '\\', '/')
$p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', "--user-data-dir=`"$prof`"", '--virtual-time-budget=5000', '--dump-dom', "`"$url`"") -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $Out 'edge_stderr.txt') -PassThru -WindowStyle Hidden
# Headless Edge sometimes dumps the DOM and then never exits (seen 2026-10-16 in penumbra_tests\dashhelplinks):
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
$must = @{}
foreach ($m in ($MustFail -split '[,\s]+')) { if ($m) { $must[$m.ToUpper()] = $true } }
$red = 0; $seen = 0
foreach ($prop in $res.PSObject.Properties) {
  $seen++
  $ok = $prop.Value.StartsWith('PASS')
  $id = ($prop.Name -split ' ')[0].ToUpper()
  # Not $mustFail: PowerShell names are case-insensitive, so that would overwrite the [string] parameter.
  $expectFail = $must.ContainsKey($id)
  $verdict = if ($expectFail) { if ($ok) { 'UNEXPECTED PASS' } else { 'fails as it must' } } else { if ($ok) { 'PASS' } else { 'FAIL' } }
  if (($expectFail -and $ok) -or (-not $expectFail -and -not $ok)) { $red++ }
  Write-Output ("  {0,-16} {1}  [{2}]" -f $verdict, $prop.Name, $prop.Value)
}
if ($seen -lt 15) { $red++; Write-Output "  (only $seen results; H0..H14 expected)" }
Write-Output ("RESULT: " + $(if ($red -eq 0) { 'GREEN' } else { "RED ($red)" }) + $(if ($MustFail) { " (expected failures: $MustFail)" } else { ' (control run: every case must pass)' }))
