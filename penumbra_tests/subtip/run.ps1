# =============================================================================
# subtip - the header Subscribe button's detail card + the scheduler's live link
# text pencil (2026-10-07).
#
#   & $sb                  # both halves against live
#   & $sb -App <path>      # against a stage (index.php, js\main.js, css\main.css,
#                          #   cron_describe.php, manage_schedule.php, schedule_runner.php)
#   & $sb -Control         # one deliberately false assertion per half: each must be FAIL 1
#   & $sb -Mutants         # targeted mutants (14 PHP + 16 browser), exact fail counts
#
# WHAT IS UNDER TEST.
#   PHP (test_subtip.php): penumbra_sub_task_about() in cron_describe.php (the card's facts,
#     viewer-safe), the __SNAP_TYPE twin vs the runner, penumbra_email_link_text() and its
#     wiring in schedule_runner.php, manage_schedule.php's save rule / prune / list feed, and
#     index.php's payload + markup.
#   Browser (tests.js, headless Edge, real jQuery): the subscription IIFE, the live link text
#     block, serializeSchedulerForm and escapeHtml are LIFTED from the real main.js by exact
#     anchors (never a pasted copy); the Escape rung A0.745 is lifted into a stand-in for the
#     app's capture-phase handler; the Delivery Options row is lifted from index.php; css\main.css
#     is the real stylesheet; the card's facts are the real PHP extractor's output
#     (gen_about.php). A missing anchor throws: the code moved, re-anchor.
#
# EXPECTED TAIL: "PHP  PASS: 83   FAIL: 0" and "JS   PASS: 85   FAIL: 0" (2026-10-07);
# -Control: FAIL 1 on each half; -Mutants: "MUTANTS: ALL BITE". The pre-feature app (live
# before 2026-10-07) scores PHP FAIL 48 and throws on the first browser anchor.
#
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\subtip\run.ps1'))
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
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\subtip'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$jq   = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditfixes\jquery-3.7.1.min.js'
$appFwd = $App -replace '\\', '/'

function Get-Lift([string]$src, [string]$start, [string]$end, [string]$what) {
    $s = $src.IndexOf($start)
    if ($s -lt 0) { throw "lift: start anchor missing ($what)" }
    if ($src.IndexOf($start, $s + 1) -ge 0) { throw "lift: start anchor not unique ($what)" }
    $e = $src.IndexOf($end, $s)
    if ($e -lt 0) { throw "lift: end anchor missing ($what)" }
    return $src.Substring($s, $e + $end.Length - $s)
}
function Get-FailCount([string]$report) { if ($report -match 'FAIL:\s+(\d+)') { return [int]$Matches[1] } return -1 }

# ---------------------------------------------------------------- PHP half
function Invoke-Php([string[]]$extra) {
    $a = @('-n', '-d', 'date.timezone=America/New_York', '-d', 'memory_limit=512M', (Join-Path $here 'test_subtip.php'), "--app=$appFwd") + $extra
    $o = & $php @a 2>&1 | Out-String
    return $o
}

# ---------------------------------------------------------------- browser half
$main  = [IO.File]::ReadAllText((Join-Path $App 'js\main.js'))
$index = [IO.File]::ReadAllText((Join-Path $App 'index.php'))
$nl = "`r`n"
$lift = @{}
$lift.esc = Get-Lift $main '    function escapeHtml(text) {' `
    ('        return div.innerHTML.replace(/"/g, ''&quot;'').replace(/''/g, ''&#39;'');' + $nl + '    }') 'escapeHtml'
$lift.ser = Get-Lift $main '    function serializeSchedulerForm() {' ("        return parts.join('|');" + $nl + '    }') 'serializeSchedulerForm'
$lift.link = Get-Lift $main '    // --- Link texts: a pencil after each option that puts a link in the email (2026-10-07) ---' `
    "    `$('.scheduler-config-panel').on('scroll', function () { if (`$_schedLinkPop) _schedLinkTextPlace(); });" 'live link text block'
$lift.subs = Get-Lift $main '    (function initReportSubscriptions() {' ('        renderChip();' + $nl + '    })();') 'subscription IIFE'
$lift.rung = Get-Lift $main '            // A0.745. The live link text popup' `
    ('                window._schedLinkTextEscape();' + $nl + '                _lastEscTime = 0;' + $nl + '                return;' + $nl + '            }') 'Escape rung A0.745'
$markup = Get-Lift $index '    <!-- Delivery Options section -->' '    <!-- Snapshot-specific options (hidden by default, shown when SNAPSHOT type selected) -->' 'Delivery Options row'
$markup = $markup.Substring(0, $markup.LastIndexOf('    <!-- Snapshot-specific options'))
$markup = [regex]::Replace($markup, '<\?php /\*[\s\S]*?\*/ \?>', '')
$aboutJson = (& $php -n -d date.timezone=America/New_York (Join-Path $here 'gen_about.php') "--app=$appFwd" 2>&1 | Out-String).Trim()
if (-not $aboutJson.StartsWith('{')) { throw "gen_about.php failed: $aboutJson" }

function Invoke-Harness($L, [string]$markupText, [string]$query) {
    $tmp = Join-Path $env:TEMP ('pnbsubtip_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force $tmp | Out-Null
    $enc = New-Object System.Text.UTF8Encoding($false)
    Copy-Item -LiteralPath (Join-Path $here 'harness.html') -Destination (Join-Path $tmp 'harness.html')
    Copy-Item -LiteralPath (Join-Path $here 'tests.js') -Destination (Join-Path $tmp 'tests.js')
    Copy-Item -LiteralPath $jq -Destination (Join-Path $tmp 'jquery.js')
    Copy-Item -LiteralPath (Join-Path $App 'css\main.css') -Destination (Join-Path $tmp 'main.css')
    # A stand-in for main.js's capture-phase Escape handler: like the real one it claims EVERY
    # Escape on document (capture) - carrying the real rung A0.745 lifted from main.js.
    $central = "var _lastEscTime = 0; window.__centralEsc = 0;`r`nwindow._pnbAll = function (sel) { return jQuery(sel); };`r`n" +
        "document.addEventListener('keydown', function (e) {`r`n    if (e.key !== 'Escape') return;`r`n" + $L.rung + "`r`n" +
        "    window.__centralEsc++; e.preventDefault(); e.stopImmediatePropagation();`r`n}, true);`r`n"
    [IO.File]::WriteAllText((Join-Path $tmp 'central.js'), $central, $enc)
    $fixture = "window.__about = $aboutJson;`r`n" +
        "window.penumbra_vars = { currentUserKey: 'jdoe', shibboleth: { email: 'jdoe@ncsu.edu' }, subscriptions: { email: 'jdoe@ncsu.edu', tasks: [`r`n" +
        "  { id: 1345, subject: 'Proposal Hit Ratio by College, Department and PI ({ROW_COUNT})', cron: '40 8 1 * *', schedule: 'Monthly on the 1st at 8:40 AM',`r`n" +
        "    recipient: false, suppressed: false, subscribed: false, about: window.__about.hit } ] } };`r`n" +
        "document.getElementById('deliveryHost').innerHTML = " + ($markupText | ConvertTo-Json) + ";`r`n"
    [IO.File]::WriteAllText((Join-Path $tmp 'fixture.js'), $fixture, $enc)
    $lifted = "window.__toasts = [];`r`nwindow.__pnbLift = (function (`$) {`r`n" + $L.esc + "`r`n" +
        "    function getSnippet() { return document.getElementById('reportSnippet').value; }`r`n" +
        "    function _pnbSubToast(kind, msgHtml) { window.__toasts.push(kind + ': ' + msgHtml); }`r`n" +
        $L.ser + "`r`n" + $L.link + "`r`n" + $L.subs + "`r`n" +
        "    return { serialize: serializeSchedulerForm };`r`n})(jQuery);`r`n"
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
    $p = Invoke-Php @()
    Write-Output $p
    $j = Invoke-Harness $lift $markup ''
    Write-Output $j
    Write-Output ('PHP  ' + (($p -split "`n") | Where-Object { $_ -match '^PASS:' } | Select-Object -Last 1))
    Write-Output ('JS   ' + (($j -split "`n") | Where-Object { $_ -match '^PASS:' } | Select-Object -Last 1))
    return
}
if ($Control) {
    $fp = Get-FailCount (Invoke-Php @('--control'))
    $fj = Get-FailCount (Invoke-Harness $lift $markup '?control=1')
    Write-Output ('CONTROL PHP: ' + $(if ($fp -eq 1) { 'exactly the one deliberate failure' } else { "BROKEN (FAIL $fp)" }))
    Write-Output ('CONTROL JS:  ' + $(if ($fj -eq 1) { 'exactly the one deliberate failure' } else { "BROKEN (FAIL $fj)" }))
    return
}

# --- targeted mutants -----------------------------------------------------------
$allGood = $true
$phpMutants = [ordered]@{ 'about-snap-any-op' = 2; 'about-leaks-condition' = 2; 'about-changes-truthy' = 1; 'about-no-stale-guard' = 1;
    'linktext-unescaped' = 1; 'runner-compare-literal' = 2; 'runner-custom-unused' = 1; 'prune-missing' = 1; 'save-no-cap' = 2; 'index-unguarded' = 1;
    'compare-fn-ignores-text' = 1; 'full-site-literal' = 2; 'caption-unescaped' = 1; 'caption-not-handed' = 1 }
foreach ($k in $phpMutants.Keys) {
    $f = Get-FailCount (Invoke-Php @("--mutant=$k"))
    if ($f -ne $phpMutants[$k]) { $allGood = $false }
    Write-Output ("{0} PHP mutant '{1}' -> FAIL: {2} (expected {3})" -f $(if ($f -eq $phpMutants[$k]) { 'OK  ' } else { 'BAD ' }), $k, $f, $phpMutants[$k])
}
$jsMutants = @(
    @{ Name = 'card header unescaped'; Part = 'subs'; Expect = 1; Edits = @(,@("'<div class=""prt-header"">' + escapeHtml(subjectText(t)) + '</div>", "'<div class=""prt-header"">' + subjectText(t) + '</div>")) },
    @{ Name = 'card opens on touch'; Part = 'subs'; Expect = 1; Edits = @(,@("if (oe && oe.pointerType && oe.pointerType !== 'mouse') return;", "")) },
    @{ Name = 'card opens on mouse focus'; Part = 'subs'; Expect = 1; Edits = @(,@("var tg = kb ? tipTarget(this) : null;", "var tg = tipTarget(this);")) },
    @{ Name = 'Escape listener on document (after the app)'; Part = 'subs'; Expect = 4; Edits = @(,@("window.addEventListener('keydown', function (e) {$nl            if (e.key !== 'Escape'", "document.addEventListener('keydown', function (e) {$nl            if (e.key !== 'Escape'")) },
    @{ Name = 'list toggle leaves the card stale'; Part = 'subs'; Expect = 1; Edits = @(,@("if (`$subTip && subTipTask === t) `$subTip.html(subTipHtml(t));", "")) },
    @{ Name = 'card closes on any resize'; Part = 'subs'; Expect = 1; Edits = @(,@("`$(window).on('resize', subTipFollow);", "`$(window).on('resize', subTipHide);")) },
    @{ Name = 'multi chip keeps the old one-schedule title'; Part = 'subs'; Expect = 1; Edits = @(,@("            } else if (tasks.length > 1) {$nl                title = chipListTitle(n);$nl            }", "            }")) },
    @{ Name = 'tooltip left over the open popup'; Part = 'link'; Expect = 1; Edits = @(,@("        btn.removeAttribute('title');$nl", "")) },
    @{ Name = 'automatic text typed back is stored'; Part = 'link'; Expect = 1; Edits = @(,@("            if (v === _schedLinkTextAuto(kind)) v = '';$nl", "")) },
    @{ Name = 'line breaks kept'; Part = 'link'; Expect = 1; Edits = @(,@(".replace(/\s+/g, ' ').trim();", ".trim();")) },
    @{ Name = 'no change event (form not dirty)'; Part = 'link'; Expect = 2; Edits = @(,@("`$(SCHED_LINK_KINDS[kind].store).val(v).trigger('change');", "`$(SCHED_LINK_KINDS[kind].store).val(v);")) },
    @{ Name = 'pencil never disables'; Part = 'link'; Expect = 5; Edits = @(,@(".prop('disabled', off !== '')", ".prop('disabled', false)")) },
    @{ Name = 'every pencil writes the live link store'; Part = 'link'; Expect = 6; Edits = @(,@("if (v !== _schedLinkTextValue(kind)) `$(SCHED_LINK_KINDS[kind].store).val(v)", "if (v !== _schedLinkTextValue(kind)) `$('#schedLinkText').val(v)")) },
    @{ Name = 'a popup stays open when its option goes off'; Part = 'link'; Expect = 2; Edits = @(,@("if (`$_schedLinkPop && _schedLinkTextGateOff(_schedLinkPopKind) !== '') _schedLinkTextClose(false);", "")) },
    @{ Name = 'Escape rung A0.745 missing'; Part = 'rung'; Expect = 2; Edits = @(,@("if (window._pnbAll('#schedLinkTextPop').length", "if (false && window._pnbAll('#schedLinkTextPop').length")) },
    @{ Name = 'store is type=hidden'; Part = 'markup'; Expect = 2; Edits = @(,@('<input type="text" id="schedLinkText"', '<input type="hidden" id="schedLinkText"')) },
    @{ Name = 'pencil inside the label'; Part = 'markup'; Expect = 1; Edits = @(@('Include Live Link</label><button type="button" id="schedLinkTextBtn"', 'Include Live Link <button type="button" id="schedLinkTextBtn"'), @('</svg></button><input type="text" id="schedLinkText"', '</svg></button></label><input type="text" id="schedLinkText"')) }
)
foreach ($m in $jsMutants) {
    $L2 = @{}; foreach ($k in $lift.Keys) { $L2[$k] = $lift[$k] }
    $mk = $markup
    $applicable = $true
    foreach ($ed in $m.Edits) {
        $target = if ($m.Part -eq 'markup') { $mk } else { $L2[$m.Part] }
        $hits = ($target.Length - $target.Replace($ed[0], '').Length) / $ed[0].Length
        if ($hits -ne 1) { Write-Output ("MUTANT NOT APPLICABLE (anchor found {0}x): {1}" -f $hits, $m.Name); $applicable = $false; break }
        if ($m.Part -eq 'markup') { $mk = $mk.Replace($ed[0], $ed[1]) } else { $L2[$m.Part] = $L2[$m.Part].Replace($ed[0], $ed[1]) }
    }
    if (-not $applicable) { $allGood = $false; continue }
    $f = Get-FailCount (Invoke-Harness $L2 $mk '')
    if ($f -ne $m.Expect) { $allGood = $false }
    Write-Output ("{0} JS mutant '{1}' -> FAIL: {2} (expected {3})" -f $(if ($f -eq $m.Expect) { 'OK  ' } else { 'BAD ' }), $m.Name, $f, $m.Expect)
}
Write-Output ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
