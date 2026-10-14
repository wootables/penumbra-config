# =============================================================================
# Penumbra PROMPT-CHIP SUITE (2026-10-04) - an answered-prompt chip squeezed below
# its label's width (Dashboard header at an iPad Pro width, ?id=hitratio) keeps the
# label inside the chip, beside the icon, and moves the value to its own line;
# a chip that fits (short label, or room) is laid out as before.
#
#   powershell -File run.ps1                  live css/main.css
#   powershell -File run.ps1 -Css <p>         a staged copy
#   powershell -File run.ps1 -Mutant <name>   nowrap | emnone | stbasis
#   Control = -Css <the pre-change main.css>: fails C1 C2 C3 (C4 held there too).
#   Mutants: nowrap -> C2 C3, emnone -> C1 C4, stbasis -> C6 (a "PI:" chip wraps).
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\promptchip'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Css <p>
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$Css = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\promptchip' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $Css) { $Css = "$app\css\main.css" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
Write-Host "[1/3] css under test: $Css"
$u8 = New-Object System.Text.UTF8Encoding($false)
$cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
$mutants = @{
  'nowrap'  = @("    flex-wrap: wrap;`r`n    row-gap: 2px;`r`n    max-width: 100%;", "    max-width: 100%;")
  'emnone'  = @("    flex: 1 1 8em;`r`n    max-width: max-content;`r`n    min-width: 0;`r`n}", "    flex: none;`r`n}")
  'stbasis' = @("    flex: 1 1 6em;`r`n    max-width: max-content;`r`n    min-width: 0;", "    min-width: 0;")
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant'" }
  $n = ([regex]::Matches($cssText, [regex]::Escape($mutants[$Mutant][0]))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1" }
  $cssText = $cssText.Replace($mutants[$Mutant][0], $mutants[$Mutant][1])
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\main_css_under_test.css", $cssText, $u8)
Write-Host "[2/3] running harness headless ..."
$udd = Join-Path $here 'profile'
if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json
[IO.File]::WriteAllText("$here\result.json", ($parsed | ConvertTo-Json -Depth 6), $u8)

Write-Host "[3/3] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0) { exit 1 }
