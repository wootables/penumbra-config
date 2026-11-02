# =============================================================================
# narrowrows - the health hub's row lists in a narrow card (2026-11-01).
#
#   & $sb                  # against live
#   & $sb -App <path>      # against a stage (css\main.css)
#   & $sb -Control         # one deliberately false assertion: must be FAIL 1
#   & $sb -Mutants         # targeted mutants, exact fail counts (-Show lists each one's FAIL lines)
#
# WHAT IS UNDER TEST. health.php's outage, delivery, maintenance-job and run lists are
#   one-line grids (css\main.css sections 9 + 14, 7 and 7b) whose narrow layouts switched
#   only on the WINDOW (under 761px). But the hub's left column is a narrow CARD from a
#   1151px window to about 1750px (lists 380-640px wide), so the squeezable column got
#   0-4px: an outage's cause stood one letter per line (the user's report, 2026-11-01), a
#   job's name vanished and its controls ran past the card. Section 7c steps on the list's
#   own width - a container query inside @media (min-width: 761px): under 640px the wordy
#   cell moves under its row. harness.html carries the lists' live shapes (classes verbatim
#   from health.php) and tests.js copies them into boxes of 466px (the left column at a
#   1364px window), 386px (at 1160px, the narrowest two-column window) and 683px (at
#   1920px: the one-line rows must stay). A second run at a 600px window checks that the
#   phone layout under 761px is left alone.
#
# EXPECTED TAIL: "PASS: 29   FAIL: 0"; -Control: FAIL 1; -Mutants: "MUTANTS: ALL BITE".
# The app before 7c (live before 2026-11-01) fails 15: the 466px and 386px room and edge checks.
#
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\narrowrows\run.ps1'))
#   & $sb -App <stage>
# Never add a bare `exit` (it would kill the caller), and do not pipe the invocation.
# =============================================================================
param(
    [string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Control,
    [switch]$Mutants,
    [switch]$Show,
    # Hard-coded default, not $PSScriptRoot: that is empty when the body runs as a scriptblock.
    [string]$SuiteDir = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\narrowrows'
)

$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

function Get-Count([string]$report, [string]$what) { if ($report -match ($what + ':\s+(\d+)')) { return [int]$Matches[1] } return -1 }

$css = [IO.File]::ReadAllText((Join-Path $App 'css\main.css'))
$nl = "`r`n"

function Invoke-Harness([string]$cssText, [int]$width, [string]$query) {
    $tmp = Join-Path $env:TEMP ('pnbnarrow_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    [void][IO.Directory]::CreateDirectory($tmp)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::Copy((Join-Path $SuiteDir 'harness.html'), (Join-Path $tmp 'harness.html'))
    [IO.File]::Copy((Join-Path $SuiteDir 'tests.js'), (Join-Path $tmp 'tests.js'))
    [IO.File]::WriteAllText((Join-Path $tmp 'main.css'), $cssText, $enc)
    $ud  = Join-Path $env:TEMP ('pnbud_' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    $dom = Join-Path $tmp 'dom.txt'
    $url = 'file:///' + ($tmp -replace '\\', '/') + '/harness.html' + $query
    Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $tmp 'err.txt') -ArgumentList '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--allow-file-access-from-files', "--user-data-dir=$ud", "--window-size=$width,900", '--virtual-time-budget=5000', '--dump-dom', $url
    $text = [IO.File]::ReadAllText($dom)
    foreach ($d in @($tmp, $ud)) { try { [IO.Directory]::Delete($d, $true) } catch { } }
    if ($text -match '<pre id="out">([\s\S]*?)</pre>') { return [System.Net.WebUtility]::HtmlDecode($Matches[1]) }
    return 'FAIL harness produced no report at ' + $width + 'px (dump length ' + $text.Length + ')' + "`nPASS: 0   FAIL: 1"
}

# One evaluation = the desktop window (1364px: the 466 / 386 / 683 probes) + a phone-width window.
function Invoke-All([string]$cssText, [string]$query) {
    $a = Invoke-Harness $cssText 1364 $query
    $b = Invoke-Harness $cssText 600 ''
    $body = @(($a -split "`n") + ($b -split "`n") | Where-Object { $_ -and $_ -notmatch '^PASS:' })
    return (($body -join "`n") + "`nPASS: " + ((Get-Count $a 'PASS') + (Get-Count $b 'PASS')) + '   FAIL: ' + ((Get-Count $a 'FAIL') + (Get-Count $b 'FAIL')))
}

if (-not $Control -and -not $Mutants) {
    Invoke-All $css ''
    return
}
if ($Control) {
    $f = Get-Count (Invoke-All $css '?control=1') 'FAIL'
    Write-Output ('CONTROL: ' + $(if ($f -eq 1) { 'exactly the one deliberate failure' } else { "BROKEN (FAIL $f)" }))
    return
}

# --- targeted mutants: each edit's anchor must be found exactly once in the candidate ----
$allGood = $true
$cases = @(   # not $mutants: PowerShell variables are case-blind, that is the -Mutants switch
    @{ Name = 'no container: the step never fires'; Expect = 15; Edits = @(,@("    .pnb-rows { container: pnb-rows / inline-size; }$nl", '')) },
    @{ Name = 'not gated to wide windows: the phone layout is overridden'; Expect = 1; Edits = @(
        @("@media (min-width: 761px) {$nl    .pnb-rows { container", "    .pnb-rows { container"),
        @("    }$nl}$nl/* 8. The directory folded", "    }$nl/* 8. The directory folded")) },
    @{ Name = 'step too low (400px): the 466px card keeps the squeezed rows'; Expect = 8; Edits = @(,@('@container pnb-rows (max-width: 639px)', '@container pnb-rows (max-width: 400px)')) },
    @{ Name = 'step too high (700px): a 1920px window loses the one-line rows'; Expect = 4; Edits = @(,@('@container pnb-rows (max-width: 639px)', '@container pnb-rows (max-width: 700px)')) },
    @{ Name = 'outage keeps the six-column template'; Expect = 1; Edits = @(,@('.pnb-rows-out .pnb-row { grid-template-columns: 112px minmax(0, 1fr) 52px 70px;', '.pnb-rows-out .pnb-row { grid-template-columns: 112px 100px 52px 62px minmax(0, 1fr) 70px;')) },
    @{ Name = 'outage rows not dense: the checks drop to a third line'; Expect = 1; Edits = @(,@('52px 70px; grid-auto-flow: row dense; row-gap: 2px; }', '52px 70px; row-gap: 2px; }')) },
    @{ Name = 'outage lines 10px apart'; Expect = 1; Edits = @(,@('52px 70px; grid-auto-flow: row dense; row-gap: 2px; }', '52px 70px; grid-auto-flow: row dense; }')) },
    @{ Name = 'outage end time not pinned under the start'; Expect = 2; Edits = @(,@("        .pnb-rows-out .pnb-row .to { grid-column: 1; }$nl", '')) },
    @{ Name = 'outage cause not spanning'; Expect = 5; Edits = @(,@("        .pnb-rows-out .pnb-row .p { grid-column: 2 / -1; }$nl", '')) },
    @{ Name = 'delivery keeps the six-column template'; Expect = 1; Edits = @(,@('.pnb-rows-dl .pnb-row { grid-template-columns: 62px 62px 62px 40px minmax(0, 1fr);', '.pnb-rows-dl .pnb-row { grid-template-columns: 62px 62px 62px 40px minmax(0, 1fr) 48px;')) },
    @{ Name = 'delivery rows not dense: the link drops to a third line'; Expect = 2; Edits = @(,@('40px minmax(0, 1fr); grid-auto-flow: row dense; row-gap: 2px; }', '40px minmax(0, 1fr); row-gap: 2px; }')) },
    @{ Name = 'delivery detail not spanning'; Expect = 4; Edits = @(,@("        .pnb-rows-dl .pnb-row .p { grid-column: 1 / -1; }$nl", '')) },
    @{ Name = 'job / run rows keep the five-column template'; Expect = 8; Edits = @(,@("        .pnb-rows-jobs .pnb-row, .pnb-rows-runs .pnb-row { grid-template-columns: 82px 82px minmax(0, 1fr); }$nl", '')) },
    @{ Name = 'job / run last run (user) in one 82px column'; Expect = 1; Edits = @(,@("        .pnb-rows-jobs .pnb-row .to, .pnb-rows-runs .pnb-row .to { grid-column: 1 / 3; grid-row: 2; }$nl", '')) },
    @{ Name = 'job / run controls (figures) left in column 5'; Expect = 5; Edits = @(,@("        .pnb-rows-jobs .pnb-row .k, .pnb-rows-runs .pnb-row .k { grid-column: 3; grid-row: 2; }$nl", '')) },
    @{ Name = 'job / run detail (message) left on line 2'; Expect = 2; Edits = @(,@("        .pnb-rows-jobs .pnb-row .p, .pnb-rows-runs .pnb-row .p { grid-column: 1 / -1; grid-row: 3; }$nl", '')) }
)
foreach ($m in $cases) {
    $c2 = $css
    $applicable = $true
    foreach ($ed in $m.Edits) {
        $hits = ($c2.Length - $c2.Replace($ed[0], '').Length) / $ed[0].Length
        if ($hits -ne 1) { Write-Output ("MUTANT NOT APPLICABLE (anchor found {0}x): {1}" -f $hits, $m.Name); $applicable = $false; break }
        $c2 = $c2.Replace($ed[0], $ed[1])
    }
    if (-not $applicable) { $allGood = $false; continue }
    $rep = Invoke-All $c2 ''
    $f = Get-Count $rep 'FAIL'
    $good = ($f -eq $m.Expect)
    if (-not $good) { $allGood = $false }
    Write-Output ('{0} {1}  (FAIL {2}, want {3})' -f $(if ($good) { 'bites ' } else { 'WRONG ' }), $m.Name, $f, $m.Expect)
    if ($Show) { ($rep -split "`n") | Where-Object { $_ -like 'FAIL *' } | ForEach-Object { '         ' + $_ } }
}
Write-Output $(if ($allGood) { 'MUTANTS: ALL BITE' } else { 'MUTANTS: SOME DID NOT BITE AS EXPECTED' })
