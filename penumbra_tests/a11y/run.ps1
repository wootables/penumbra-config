# =============================================================================
# A11y suite (2026-09-08): the shared accessibility layer js/penumbra_a11y.js.
#
#   harness.html - the module booted against a fixture DOM in headless Edge:
#                  skip link, decorative-svg sweep (+ the __pnbA11ySuspended
#                  pause), keyboard stamps + Enter/Space on HTML and SVG
#                  targets, the lightbox and prompt-overlay focus traps (focus
#                  in, Tab wrap, restore), dynamic + persistent [role=menu]
#                  keys, enhanceChartA11y tables (44 assertions).
#
# Run the BODY as a scriptblock (UNC scripts are GPO-blocked):
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\a11y\run.ps1')); & $sb
# Never pipe the invocation (a lingering Edge child keeps stdout open).
#
# Pass 1 runs the LIVE module (or $env:PNB_A11Y_SRC). Pass 2 runs a TARGETED
# MUTANT - the stamp handler's click dispatch deleted - and the suite must
# report it red; a mutant that survives means the harness stopped biting.
# No `exit` here on purpose: a scriptblock's exit kills the caller's session.
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\a11y'
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$src  = if ($env:PNB_A11Y_SRC) { $env:PNB_A11Y_SRC } else { "$app\js\penumbra_a11y.js" }
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-A11yHarness([string]$moduleText, [string]$tag) {
    [IO.File]::WriteAllText("$here\a11y_check.js", $moduleText, $utf8)
    $out = "$here\dom_$tag.txt"
    if (Test-Path $out) { Remove-Item $out -Force }
    # Short profile path: Edge's cache subfolders overflow MAX_PATH under long dirs.
    $prof = Join-Path $env:TEMP ('pnbedge_' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    $url = 'file:///' + ($here -replace '\\', '/') + '/harness.html'
    $edgeArgs = @('--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', "--user-data-dir=$prof", '--virtual-time-budget=15000', '--dump-dom', $url)
    $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $out -ArgumentList $edgeArgs
    $pr.WaitForExit(120000) | Out-Null
    if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
    # A lingering Edge child (same --user-data-dir) keeps the redirected stdout
    # open after the main process exits: stop ONLY processes on this profile and
    # read the dump with a share-everything handle.
    Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
    Start-Sleep -Milliseconds 500
    try { Remove-Item -LiteralPath $prof -Recurse -Force -ErrorAction SilentlyContinue } catch {}
    $fs = New-Object IO.FileStream($out, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    $sr = New-Object IO.StreamReader($fs); $dom = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
    $i = $dom.IndexOf('<pre id="out">'); $j = $dom.IndexOf('</pre>', $i)
    if ($i -lt 0 -or $j -lt 0) { return @{ pass = 0; fail = @('NO RESULT BLOCK (dom ' + $dom.Length + ' bytes)') } }
    $lines = [System.Net.WebUtility]::HtmlDecode($dom.Substring($i + 14, $j - $i - 14)) -split "`n"
    $pass = @($lines | Where-Object { $_ -like 'PASS *' }).Count
    $fail = @($lines | Where-Object { $_ -like 'FAIL *' -or $_ -like 'HARNESS ERROR*' -or $_ -like 'running*' })
    return @{ pass = $pass; fail = $fail }
}

Write-Host "[1/2] live module: $src"
$live = [IO.File]::ReadAllText($src, $utf8)
$r1 = Invoke-A11yHarness $live 'live'
Write-Host ("  live: {0} PASS, {1} FAIL" -f $r1.pass, $r1.fail.Count)
$r1.fail | ForEach-Object { Write-Host "    $_" }

Write-Host "[2/2] targeted mutant (stamp handler's click dispatch deleted) ..."
$nl = if ($live.Contains("`r`n")) { "`r`n" } else { "`n" }
$needle = "        e.preventDefault();" + $nl + "        fireClick(t);" + $nl + "    });"
$mutant = $live.Replace($needle, "        e.preventDefault();" + $nl + "        /* MUTANT: click dispatch removed */" + $nl + "    });")
if ($mutant -eq $live) { throw "mutant anchor not found - the stamp handler moved; update the suite" }
$r2 = Invoke-A11yHarness $mutant 'mutant'
$killed = ($r2.fail.Count -ge 1) -and (@($r2.fail | Where-Object { $_ -like '*Enter/Space click icon*' }).Count -eq 1)
$verdict = if ($killed) { 'KILLED (harness bites)' } else { 'SURVIVED - the harness is not testing the click dispatch' }
Write-Host ("  mutant: {0} PASS, {1} FAIL -> {2}" -f $r2.pass, $r2.fail.Count, $verdict)

Copy-Item $src "$here\a11y_check.js" -Force   # leave the live copy staged, never the mutant
$ok = ($r1.fail.Count -eq 0) -and ($r1.pass -ge 40) -and $killed
$mut = if ($killed) { 'killed' } else { 'SURVIVED' }
Write-Host ("SUMMARY live={0}/{1} mutant={2}" -f $r1.pass, ($r1.pass + $r1.fail.Count), $mut)
if ($ok) { Write-Host 'RESULT: GREEN' } else { Write-Host 'RESULT: RED' }
