# tip_harness.ps1 - run the help-popover (hover tip) harness in headless Edge.
#
#   tip_harness.ps1 -MainJs <path to main.js> -Here <suite dir> -Out <scratch dir> [-ExpectControl]
#
# Lifts the lazy first-hover wiring + initHelpPopover out of -MainJs (lift_tip.php), copies the
# harness page and jQuery beside it in -Out, runs Edge headless with --dump-dom and prints the
# harness results (T1..T4). With -ExpectControl the file is the UNPATCHED main.js (before the
# 2026-10-19 helptip fix) and T1 must FAIL: a ? icon in a dialog whose open path never called
# initHelpPopover() - the generator opened from the Query Prompts help topic - hovered to nothing.
# Prints RESULT: GREEN/RED. Run from a LOCAL cwd (headless Edge needs one); on the share, run the
# body as a scriptblock: & ([scriptblock]::Create([IO.File]::ReadAllText("$d\tip_harness.ps1"))) ...
param([string]$MainJs = '', [string]$Here = '', [string]$Out = '', [switch]$ExpectControl)
$ErrorActionPreference = 'Stop'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not $Here) { $Here = $PSScriptRoot }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('helptip_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
New-Item -ItemType Directory -Force $Out | Out-Null
Copy-Item (Join-Path $Here 'tip_harness.html') (Join-Path $Out 'tip_harness.html') -Force
Copy-Item (Join-Path $Here 'harness\jquery-3.7.1.min.js') (Join-Path $Out 'jquery-3.7.1.min.js') -Force
& $php -n (Join-Path $Here 'lift_tip.php') "--mainjs=$MainJs" "--out=$(Join-Path $Out 'lifted.js')"
if ($LASTEXITCODE -ne 0) { Write-Host 'RESULT: RED (lift failed)'; return }
$dom = Join-Path $Out 'dom.html'
$url = 'file:///' + ((Resolve-Path (Join-Path $Out 'tip_harness.html')).Path -replace '\\', '/')
$p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--dump-dom', "`"$url`"") -RedirectStandardOutput $dom -Wait -PassThru -WindowStyle Hidden
$html = Get-Content $dom -Raw
if ($html -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Host "RESULT: RED (no harness output; exit $($p.ExitCode))"; Write-Host ($html.Substring(0, [Math]::Min(600, $html.Length))); return }
$json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
if ($json -eq 'pending') { Write-Host 'RESULT: RED (harness never finished)'; return }
$res = $json | ConvertFrom-Json
$red = 0
foreach ($prop in $res.PSObject.Properties) {
  $ok = $prop.Value.StartsWith('PASS')
  $mustFail = $ExpectControl -and ($prop.Name -match '^T1 ')
  $verdict = if ($mustFail) { if ($ok) { 'UNEXPECTED PASS' } else { 'fails as the control should' } } else { if ($ok) { 'PASS' } else { 'FAIL' } }
  if (($mustFail -and $ok) -or (-not $mustFail -and -not $ok)) { $red++ }
  Write-Host ("  {0,-26} {1}  [{2}]" -f $verdict, $prop.Name, $prop.Value)
}
Write-Host ("RESULT: " + $(if ($red -eq 0) { 'GREEN' } else { "RED ($red)" }))
