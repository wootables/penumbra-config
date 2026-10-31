# =============================================================================
# dashsub - the Dashboard header's Subscribe chip beside the title (2026-10-30).
#
#   & $sb                  # against live
#   & $sb -App <path>      # against a stage (js\main.js, css\main.css)
#   & $sb -Control         # one deliberately false assertion: must be FAIL 1
#   & $sb -Mutants         # targeted mutants, exact fail counts
#
# WHAT IS UNDER TEST. In the Dashboard header layout the chip sits beside the title when the
#   title (on one line) + 12px + the chip fit the title panel, else on its own row under the
#   subtitle as before. main.js initSubBesideTitle (inside initReportSubscriptions) sets
#   .pnb-sub-beside on #reportInfoPanel; css\main.css grids it, scoped to .layout-dashboard.
#   The multi-schedule list slides back into the window when the chip sits at its right edge.
#   tests.js (headless Edge, real jQuery) runs the subscription IIFE LIFTED from the real
#   main.js by exact anchors (never a pasted copy) against the real stylesheet.
#   Headless with a virtual-time budget renders no frames after the first, so a ResizeObserver
#   never delivers again: harness.html records the page's observers and tests.js pumps them as
#   the browser would (a callback runs only for an observed target whose size changed).
#   The rAF this first used never ran here at all - hence the page's timer.
#
# EXPECTED TAIL: "PASS: 31   FAIL: 0"; -Control: FAIL 1; -Mutants: "MUTANTS: ALL BITE".
# The pre-feature app (live before this change) fails the beside checks.
#
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashsub\run.ps1'))
#   & $sb -App <stage>
# Never add a bare `exit` (it would kill the caller), and do not pipe the invocation.
# =============================================================================
param(
    [string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Control,
    [switch]$Mutants
)

$ErrorActionPreference = 'Stop'
# Hard-coded, not $PSScriptRoot: that is empty when the body runs as a scriptblock.
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashsub'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$jq   = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditfixes\jquery-3.7.1.min.js'

function Get-Lift([string]$src, [string]$start, [string]$end, [string]$what) {
    $s = $src.IndexOf($start)
    if ($s -lt 0) { throw "lift: start anchor missing ($what)" }
    if ($src.IndexOf($start, $s + 1) -ge 0) { throw "lift: start anchor not unique ($what)" }
    $e = $src.IndexOf($end, $s)
    if ($e -lt 0) { throw "lift: end anchor missing ($what)" }
    return $src.Substring($s, $e + $end.Length - $s)
}
function Get-FailCount([string]$report) { if ($report -match 'FAIL:\s+(\d+)') { return [int]$Matches[1] } return -1 }

$main = [IO.File]::ReadAllText((Join-Path $App 'js\main.js'))
$css  = [IO.File]::ReadAllText((Join-Path $App 'css\main.css'))
$nl = "`r`n"
$lift = @{}
$lift.esc = Get-Lift $main '    function escapeHtml(text) {' `
    ('        return div.innerHTML.replace(/"/g, ''&quot;'').replace(/''/g, ''&#39;'');' + $nl + '    }') 'escapeHtml'
$lift.subs = Get-Lift $main '    (function initReportSubscriptions() {' ('        renderChip();' + $nl + '    })();') 'subscription IIFE'
$lift.css = $css

function Invoke-Harness($L, [string]$query) {
    $tmp = Join-Path $env:TEMP ('pnbdashsub_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force $tmp | Out-Null
    $enc = New-Object System.Text.UTF8Encoding($false)
    Copy-Item -LiteralPath (Join-Path $here 'harness.html') -Destination (Join-Path $tmp 'harness.html')
    Copy-Item -LiteralPath (Join-Path $here 'tests.js') -Destination (Join-Path $tmp 'tests.js')
    Copy-Item -LiteralPath $jq -Destination (Join-Path $tmp 'jquery.js')
    [IO.File]::WriteAllText((Join-Path $tmp 'main.css'), $L.css, $enc)
    $fixture = "window.penumbra_vars = { currentUserKey: 'jdoe', shibboleth: { email: 'jdoe@ncsu.edu' }, subscriptions: { email: 'jdoe@ncsu.edu', tasks: [`r`n" +
        "  { id: 11, subject: 'Weekly hit ratio', cron: '0 8 * * 1', schedule: 'Weekly on Monday at 8:00 AM', recipient: false, suppressed: false, subscribed: false },`r`n" +
        "  { id: 12, subject: 'Monthly hit ratio', cron: '0 8 1 * *', schedule: 'Monthly on the 1st at 8:00 AM', recipient: false, suppressed: false, subscribed: false } ] } };`r`n"
    [IO.File]::WriteAllText((Join-Path $tmp 'fixture.js'), $fixture, $enc)
    $lifted = "window.__toasts = [];`r`nwindow.__pnbLift = (function (`$) {`r`n" + $L.esc + "`r`n" +
        "    function getSnippet() { return ''; }`r`n" +
        "    function _pnbSubToast(kind, msgHtml) { window.__toasts.push(kind + ': ' + msgHtml); }`r`n" +
        $L.subs + "`r`n    return {};`r`n})(jQuery);`r`n"
    [IO.File]::WriteAllText((Join-Path $tmp 'lifted.js'), $lifted, $enc)
    $ud  = Join-Path $env:TEMP ('pnbud_' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    $dom = Join-Path $tmp 'dom.txt'
    $url = 'file:///' + ($tmp -replace '\\', '/') + '/harness.html' + $query
    Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $tmp 'err.txt') -ArgumentList '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--allow-file-access-from-files', "--user-data-dir=$ud", '--window-size=1280,900', '--virtual-time-budget=60000', '--dump-dom', $url
    $text = [IO.File]::ReadAllText($dom)
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $ud -ErrorAction SilentlyContinue
    if ($text -match '<pre id="out">([\s\S]*?)</pre>') { return [System.Net.WebUtility]::HtmlDecode($Matches[1]) }
    return 'FAIL harness produced no report (dump length ' + $text.Length + ')' + "`nPASS: 0   FAIL: 1"
}

if (-not $Control -and -not $Mutants) {
    Invoke-Harness $lift ''
    return
}
if ($Control) {
    $f = Get-FailCount (Invoke-Harness $lift '?control=1')
    Write-Output ('CONTROL: ' + $(if ($f -eq 1) { 'exactly the one deliberate failure' } else { "BROKEN (FAIL $f)" }))
    return
}

# --- targeted mutants -----------------------------------------------------------
$allGood = $true
$cases = @(   # not $mutants: PowerShell variables are case-blind, that is the -Mutants switch
    @{ Name = 'gap not counted'; Part = 'subs'; Expect = 7; Edits = @(,@("var GAP = 12;", "var GAP = 0;")) },
    @{ Name = 'measures the squeezed title, not its one-line width'; Part = 'subs'; Expect = 9; Edits = @(,@("                title.style.width = 'max-content';$nl", "")) },
    @{ Name = 'chip changes unwatched'; Part = 'subs'; Expect = 5; Edits = @(,@("            new MutationObserver(queue).observe(`$slot[0], { childList: true, subtree: true, characterData: true });$nl", "")) },
    @{ Name = 'title resizes unwatched'; Part = 'subs'; Expect = 2; Edits = @(,@("            ro.observe(title);$nl", "")) },
    @{ Name = 'hidden panel answers false'; Part = 'subs'; Expect = 3; Edits = @(,@("if (avail <= 0) return null;", "if (avail <= 0) return false;")) },
    @{ Name = 'check inside the observer callback'; Part = 'subs'; Expect = 1; Edits = @(,@("var ro = new ResizeObserver(queue);", "var ro = new ResizeObserver(sync);")) },
    @{ Name = 'list never slides back'; Part = 'subs'; Expect = 1; Edits = @(,@("            if (popOver > 0) `$pop.css('left', -popOver + 'px');$nl", "")) },
    @{ Name = 'beside rule gone'; Part = 'css'; Expect = 7; Edits = @(,@("#reportInfoPanel.pnb-sub-beside:has(#pnbSubscribeBtn)", "#reportInfoPanel.pnb-sub-besideX:has(#pnbSubscribeBtn)")) },
    @{ Name = 'beside grid not scoped to Dashboard'; Part = 'css'; Expect = 1; Edits = @(,@("#reportHeaderContainer.layout-dashboard #reportInfoPanel.pnb-sub-beside:has(", "#reportHeaderContainer #reportInfoPanel.pnb-sub-beside:has(")) },
    @{ Name = 'chip keeps its 7px top margin'; Part = 'css'; Expect = 6; Edits = @(,@("#reportInfoPanel.pnb-sub-beside #pnbSubscribeSlot .pnb-sub-chip {$nl    margin-top: 0;", "#reportInfoPanel.pnb-sub-beside #pnbSubscribeSlot .pnb-sub-chip {$nl    margin-top: 7px;")) },
    @{ Name = 'grid gap is not the measured 12px'; Part = 'css'; Expect = 6; Edits = @(,@("    column-gap: 12px;       /* = GAP in initSubBesideTitle */", "    column-gap: 4px;       /* = GAP in initSubBesideTitle */")) }
)
foreach ($m in $cases) {
    $L2 = @{}; foreach ($k in $lift.Keys) { $L2[$k] = $lift[$k] }
    $applicable = $true
    foreach ($ed in $m.Edits) {
        $target = $L2[$m.Part]
        $hits = ($target.Length - $target.Replace($ed[0], '').Length) / $ed[0].Length
        if ($hits -ne 1) { Write-Output ("MUTANT NOT APPLICABLE (anchor found {0}x): {1}" -f $hits, $m.Name); $applicable = $false; break }
        $L2[$m.Part] = $L2[$m.Part].Replace($ed[0], $ed[1])
    }
    if (-not $applicable) { $allGood = $false; continue }
    $rep = Invoke-Harness $L2 ''
    $f = Get-FailCount $rep
    if ($f -ne $m.Expect) { $allGood = $false; Write-Output (($rep -split "`n") | Where-Object { $_ -match '^FAIL ' }) }
    Write-Output ("{0} mutant '{1}' -> FAIL: {2} (expected {3})" -f $(if ($f -eq $m.Expect) { 'OK  ' } else { 'BAD ' }), $m.Name, $f, $m.Expect)
}
Write-Output ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
