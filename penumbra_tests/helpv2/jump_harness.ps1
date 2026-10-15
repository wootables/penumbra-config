# jump_harness.ps1 - run the Help Center jump harness in headless Edge.
#
#   jump_harness.ps1 -MainJs <path to main.js> -Here <suite dir> -Out <scratch dir> [-ExpectControl]
#
# Lifts the hub navigation + jump-link handler out of -MainJs (lift_jump.php), copies the
# harness page and jQuery beside it in -Out, runs Edge headless with --dump-dom and prints the
# harness results (T1..T6). With -ExpectControl the file is the UNPATCHED main.js and T2-T5
# must FAIL (the control proves the harness sees the old behaviour). Prints RESULT: GREEN/RED.
param([string]$MainJs = '', [string]$Here = '', [string]$Out = '', [switch]$ExpectControl)
$ErrorActionPreference = 'Stop'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not $Here) { $Here = $PSScriptRoot }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('helpjump_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
New-Item -ItemType Directory -Force $Out | Out-Null
Copy-Item (Join-Path $Here 'jump_harness.html') (Join-Path $Out 'jump_harness.html') -Force
Copy-Item (Join-Path $Here 'harness\jquery-3.7.1.min.js') (Join-Path $Out 'jquery-3.7.1.min.js') -Force
& $php -n (Join-Path $Here 'lift_jump.php') "--mainjs=$MainJs" "--out=$(Join-Path $Out 'lifted.js')"
if ($LASTEXITCODE -ne 0) { Write-Host 'RESULT: RED (lift failed)'; return }
$dom = Join-Path $Out 'dom.html'
$url = 'file:///' + ((Resolve-Path (Join-Path $Out 'jump_harness.html')).Path -replace '\\', '/')
$p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--dump-dom', "`"$url`"") -RedirectStandardOutput $dom -Wait -PassThru -WindowStyle Hidden
$html = Get-Content $dom -Raw
if ($html -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Host "RESULT: RED (no harness output; exit $($p.ExitCode))"; Write-Host ($html.Substring(0, [Math]::Min(600, $html.Length))); return }
$json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
$res = $json | ConvertFrom-Json
$red = 0
foreach ($prop in $res.PSObject.Properties) {
  $ok = $prop.Value.StartsWith('PASS')
  $mustFail = $ExpectControl -and ($prop.Name -match '^T[2345] ')
  $verdict = if ($mustFail) { if ($ok) { 'UNEXPECTED PASS' } else { 'fails as the control should' } } else { if ($ok) { 'PASS' } else { 'FAIL' } }
  if (($mustFail -and $ok) -or (-not $mustFail -and -not $ok)) { $red++ }
  Write-Host ("  {0,-26} {1}  [{2}]" -f $verdict, $prop.Name, $prop.Value)
}
Write-Host ("RESULT: " + $(if ($red -eq 0) { 'GREEN' } else { "RED ($red)" }))
