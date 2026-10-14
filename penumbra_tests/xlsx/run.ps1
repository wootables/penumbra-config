# =============================================================================
# Penumbra XLSX SUITE  -  the browser workbook writer, offline
#
# Lifts createXlsxWorkbook() + extractHeaderDataForExcel() (and the four small
# helpers they call) out of the LIVE js/main.js by anchor, runs them against the
# real ExcelJS 4.4.0 and the real theme registry (themes.js, regenerated from
# themes_config.php each run), over DOM fixtures for every table type:
#
#   flat            table only / + frozen leading columns (2026-09-18: the Settings
#                   panel's Freeze control - the split, its survival of a write +
#                   re-read, the column freeze kept alone under a tall block) /
#                   + header block / + header + Monochrome
#   grouped         one sheet per group, name dedupe, header repeated per sheet,
#                   chart media stored ONCE
#   nested          single "Grouped Data" sheet with outline levels
#   pivot           colspan/rowspan merges offset by the block, GT column
#                   styling, frozen row-field columns
#   one-column      the block must not reach past the table
#
# Assertions cover the 2026-09-04 redesign of the header block (full-width band,
# by-line, timestamp+count, search filter, Report Parameters label|value rows,
# Summary, Visualizations side by side, live link, computed row heights) AND the
# defects it fixed: header-inflated column widths, per-sheet chart duplication,
# the freeze that pinned most of the screen, <br> cells losing their lines,
# inverted zebra, phantom columns on narrow tables.
#
#   powershell -File run.ps1                   EXPECTED: pass=130 fail=0 (2026-10-11: +2
#                                               pivot/subtotal, section 7b - any build
#                                               before pvsum fails exactly those 2)
#   powershell -File run.ps1 -MainJs <path>    (js\main.js.bak-20260904-xlsxhdr is
#                                               the positive control: 90 pass / 38 FAIL
#                                               as of 2026-09-18 = the redesign's 35 +
#                                               the 3 frozen-column asserts, which ANY
#                                               build before 2026-09-18 fails - the
#                                               pre-feature main.js scores 125 / 3)
#
# THE LIFTED BLOCK'S OUTSIDE REFERENCES ARE SUPPLIED BY HAND (harness.html, ctxFor).
# A new call from inside createXlsxWorkbook() to a main.js function that lives
# outside the lifted anchors needs an entry there, or the run dies with a
# ReferenceError at that section and EVERY LATER ASSERT SILENTLY STOPS RUNNING - the
# summary then reads "pass=74 fail=0", which looks green. That is how the pivot,
# one-column and chart sections went dark from 2026-09-16 to 2026-09-18
# (penumbraPivotEnsureAllRows). Read the pass COUNT, not just the fail count.
#
# If the UNC execution policy refuses the script ("not digitally signed"), run
# its body as a scriptblock from the workstation:
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\xlsx'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot',"`$here = '$dir'")))
# Do NOT pipe the invocation (a lingering headless child keeps stdout open).
#
# Writes the workbooks it built to files\ (flat_plain, flat_frozen, flat_header,
# flat_header_mono, grouped_header, nested_header, pivot_header .xlsx) so a human
# can open them.
# Writes nothing to the webroot. Exit code 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '')
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is EMPTY when this file is run as a SCRIPTBLOCK - which is the
# only way to start it from the UNC share, since GPO blocks -File there. Falling
# back to the literal keeps both forms working: -File still gets the real value,
# and the scriptblock form no longer resolves "$here\harness.html" to a bare
# relative "harness.html" and dies in staging.
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\xlsx' }   # empty when run as a scriptblock: never fall back to the caller's cwd
if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\xlsx' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
if (-not $MainJs) { $MainJs = "$app\js\main.js" }

$browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $browser)) { throw 'no Chrome or Edge found' }

# Stage on LOCAL disk: file:// over UNC is flaky in headless Chrome, and the
# run must never write into the suite dir on the share except its outputs.
$work = Join-Path $env:TEMP ('pnb_xlsx_' + [guid]::NewGuid().ToString('n').Substring(0, 8))
New-Item -ItemType Directory -Force -Path "$work\profile" | Out-Null
Write-Host "[1/3] staging (main.js under test: $MainJs)"
Copy-Item "$here\harness.html" $work -Force
Copy-Item "$app\js\jquery-3.7.1.min.js" $work -Force
Copy-Item "$app\js\exceljs-4.4.0.min.js" $work -Force
# main.js is CRLF with two NUL bytes - copy bytes, never re-encode.
[IO.File]::WriteAllBytes("$work\main_under_test.js", [IO.File]::ReadAllBytes($MainJs))
# The theme registry exactly as index.php emits it.
# The path lands inside PHP SINGLE quotes, and there \\ is the escape for ONE
# backslash - so a UNC $app reached require() as \oitras\... and could not be
# opened ("themes.js looks empty" is what that surfaces as, two lines down,
# which points at php rather than at the path). Double every backslash on the
# way in. PowerShell does not use backslash escapes, so \\ here is literal.
$appEsc = $app -replace '\\', '\\'
$themes = & $php -n -r "require '$appEsc\themes_config.php'; penumbra_emit_themes_js();"
[IO.File]::WriteAllText("$work\themes.js", ($themes -join "`n"), (New-Object System.Text.UTF8Encoding($false)))
if ((Get-Item "$work\themes.js").Length -lt 5000) { throw 'themes.js looks empty - php failed?' }

Write-Host "[2/3] running headless"
$dom = "$work\dom.txt"
$url = 'file:///' + ($work -replace '\\', '/') + '/harness.html?id=rj0qa05h'
$edgeArgs = @('--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
              "--user-data-dir=$work\profile", '--virtual-time-budget=60000', '--dump-dom', $url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $edgeArgs
$pr.WaitForExit(180000) | Out-Null
if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }

Write-Host "[3/3] results"
# A headless child can outlive its parent and keep the REDIRECTED STDOUT handle
# open, so a plain ReadAllText fails with "used by another process". Stop only
# the strays on THIS run's profile, then read through a share-everything handle -
# the same guard groupmode, a11y and pivotparity each carry with the same note.
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" |
    Where-Object { $_.CommandLine -like "*$work*" } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 800
$fsDom = [IO.File]::Open($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
$srDom = New-Object IO.StreamReader($fsDom)
$html  = $srDom.ReadToEnd()
$srDom.Close(); $fsDom.Close()
$m = [regex]::Match($html, '<pre id="out">(.*?)</pre>', 'Singleline')
if (-not $m.Success) { Write-Host "NO <pre id=out> in the dump - harness never finished"; exit 1 }
$text = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
$text -split "`n" | Where-Object { $_ -notmatch '^PASS ' } | ForEach-Object { Write-Host $_ }
$passN = ([regex]::Matches($text, '(?m)^PASS ')).Count
$failN = ([regex]::Matches($text, '(?m)^FAIL ')).Count
$err   = ($text -match '(?m)^(ERROR|EXTRACT_ERROR|LOAD_ERROR)')

# Sample workbooks
$fm = [regex]::Match($html, '<div id="files">(.*?)</div>', 'Singleline')
if ($fm.Success) {
    New-Item -ItemType Directory -Force -Path "$here\files" | Out-Null
    foreach ($line in ($fm.Groups[1].Value -split "`n")) {
        $p = $line.Trim() -split ' '
        if ($p.Length -eq 3 -and $p[0] -eq 'FILE') {
            [IO.File]::WriteAllBytes("$here\files\$($p[1])", [Convert]::FromBase64String($p[2]))
        }
    }
    Write-Host ("workbooks written to $here\files: " + ((Get-ChildItem "$here\files" -Filter *.xlsx | ForEach-Object { $_.Name }) -join ', '))
}
Copy-Item $dom "$here\dom.txt" -Force
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "xlsx: pass=$passN fail=$failN error=$err"
if ($failN -gt 0 -or $err) { exit 1 }
exit 0
