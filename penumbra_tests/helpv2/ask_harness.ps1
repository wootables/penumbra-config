# ask_harness.ps1 - run the Ask page's client harness in headless Edge (phase 6, 2026-10-15).
#
#   ask_harness.ps1 -App <stage or live dir> -Here <suite dir> -Out <scratch dir>
#
# Renders help/topics/askHelpLightbox.php as the loader would (PHP, PNB_HELP_V2 defined, the fragment's own
# script tag removed), writes it into ask_harness.html beside jQuery and the REAL js/penumbra_help_ask.js from
# -App, runs Edge headless with --dump-dom and prints the harness results (T1..T6). Prints RESULT: GREEN/RED.
param([string]$App = '', [string]$Here = '', [string]$Out = '')
$ErrorActionPreference = 'Stop'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not $Here) { $Here = $PSScriptRoot }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('helpask_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
if (-not $App)  { Write-Host 'RESULT: RED (no -App)'; return }
New-Item -ItemType Directory -Force $Out | Out-Null
Copy-Item (Join-Path $Here 'harness\jquery-3.7.1.min.js') (Join-Path $Out 'jquery-3.7.1.min.js') -Force
$js = Join-Path $App 'js\penumbra_help_ask.js'
if (-not (Test-Path $js)) { Write-Host "RESULT: RED (no js/penumbra_help_ask.js under $App)"; return }
Copy-Item $js (Join-Path $Out 'penumbra_help_ask.js') -Force
# the fragment, rendered
$frag = Join-Path $App 'help\topics\askHelpLightbox.php'
$render = Join-Path $Out '_render.php'
$fragSlashes = $frag -replace '\\', '/'
@"
<?php
define('PNB_HELP_V2', 2);
function pnb_help_show(`$a) { return true; }
`$isAdmin = false;
ob_start(); include '$fragSlashes'; `$h = ob_get_clean();
`$h = preg_replace('#<script src="js/penumbra_help_ask\.js[^"]*"></script>#', '', `$h);
echo `$h;
"@ | Set-Content -Path $render -Encoding UTF8
$html = & $php -n $render | Out-String
if (-not $html -or $html -notmatch 'id="askHelpLightbox"') { Write-Host 'RESULT: RED (the fragment did not render)'; Write-Host ($html.Substring(0, [Math]::Min(400, $html.Length))); return }
$page = Get-Content (Join-Path $Here 'ask_harness.html') -Raw
$page = $page.Replace('<!--FRAGMENT-->', $html + "`n<script src=""penumbra_help_ask.js""></script>")
$built = Join-Path $Out 'ask_harness_built.html'
[IO.File]::WriteAllText($built, $page, (New-Object System.Text.UTF8Encoding $false))
$dom = Join-Path $Out 'dom.html'
$url = 'file:///' + ((Resolve-Path $built).Path -replace '\\', '/')
$p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', "`"$url`"") -RedirectStandardOutput $dom -PassThru -Wait -WindowStyle Hidden
$out = Get-Content $dom -Raw
if ($out -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Host "RESULT: RED (no harness output; exit $($p.ExitCode))"; Write-Host ($out.Substring(0, [Math]::Min(600, $out.Length))); return }
$json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
if (-not $json.Trim()) { Write-Host 'RESULT: RED (the harness wrote nothing: a script error before the first test?)'; return }
$res = $json | ConvertFrom-Json
$red = 0
foreach ($prop in $res.PSObject.Properties) {
  $ok = $prop.Value.StartsWith('PASS')
  if (-not $ok) { $red++ }
  Write-Host ("  {0,-5} {1}  [{2}]" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $prop.Name, $prop.Value)
}
Write-Host ("RESULT: " + $(if ($red -eq 0) { 'GREEN' } else { "RED ($red)" }))
