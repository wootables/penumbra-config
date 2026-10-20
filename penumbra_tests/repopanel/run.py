# =============================================================================
# repopanel (2026-10-09): THE REPOSITORY PAGE OFFERS NO REPORT-ONLY CONTROLS.
#
#   py -3 run.py                     # against LIVE
#   py -3 run.py --app <dir>         # against a stage (app-shaped; a file it lacks comes from live)
#   py -3 run.py --mutant M          # M in MUTANTS below; each must go RED
#
# repository.php is index.php in repo mode: it reuses the report console's status
# bar and settings panel. The settings panel and the status bar are LIFTED from
# the index.php under test and rendered BOTH ways ($isRepoMode true / false: the
# <?php if/else/endif ?> and <?php echo $isRepoMode ? 'a' : 'b' ?> forms are
# resolved, every other PHP block dropped), styled by the main.css under test,
# in headless Edge (CDP). Measured, not pinned:
#  R. repository: Theme, Density, Single-Key Shortcuts shown; Consistent Row
#     Height, Deep Link Vendor Codes, the Columns section, Save Column Layout /
#     Reset and "Clear All Custom Preferences For This Report" hidden; the bar's
#     settings opener shown (its gear went 2026-10-19, colscard), every report chip
#     (frozen, nesting, pivot, group, earlier version, snapshot) and the Columns card
#     hidden even when main.js shows them, the count's caret too; Data and
#     Queried are not buttons (no role/tabindex), take no clicks, show no caret.
#  P. a report page: everything above is exactly as before (all shown, buttons).
#  J. main.js names the default option "(the app default)" on the repository page.
#
# EXPECTED TAIL: "GREEN N / 0".
# =============================================================================
import json, os, re, shutil, sys, tempfile, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dzdialogs'))
from cdp import Browser

LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
args = sys.argv[1:]
def opt(name, dflt=None):
    return args[args.index(name) + 1] if name in args else dflt
APP = opt('--app', LIVE)
MUTANT = opt('--mutant', '')
def rd(rel):
    p = os.path.join(APP, rel)
    if not os.path.exists(p): p = os.path.join(LIVE, rel)
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
F = {'idx': rd('index.php'), 'css': rd('css/main.css'), 'main': rd('js/main.js')}

MUTANTS = {
    'nocss':      ('css', 'body.pnb-repo-mode #settingsPanel :is(.sp-columns-section, .sp-actions, .sp-danger-zone),', ''),
    'nochips':    ('css', 'body.pnb-repo-mode #sbColsSeg > :not(#sbColsOpen),', ''),
    'nocaret':    ('css', 'body.pnb-repo-mode #sbColsOpen .sb-cl-caret,', ''),
    'notoggles':  ('css', 'body.pnb-repo-mode .sp-toggle-with-help:has(#spResolverToggle),', ''),
    'databtn':    ('main', ".removeClass('sb-click').removeAttr('role tabindex aria-haspopup aria-expanded');", ";"),
    'notitle':    ('main', "$('#sbColsOpen').attr('title', 'Open the Settings panel (theme & density)');", ""),
    'label':      ('main', "' (the app default)'", "\" (this report's default)\""),
}
if MUTANT:
    if MUTANT not in MUTANTS: sys.exit('unknown mutant %s' % MUTANT)
    k, a, b = MUTANTS[MUTANT]
    if F[k].count(a) != 1: sys.exit('mutant %s anchor hits %d' % (MUTANT, F[k].count(a)))
    F[k] = F[k].replace(a, b); print('      + MUTANT', MUTANT)

passed = failed = 0
def ok(cond, label):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + label)
    else: failed += 1; print('  FAIL ' + label)

def render(src, repo):
    s = re.sub(r"<\?php if \(\$isRepoMode\): \?>(.*?)<\?php else: \?>(.*?)<\?php endif; \?>",
               lambda m: m.group(1) if repo else m.group(2), src, flags=re.S)
    s = re.sub(r"<\?php echo \$isRepoMode \? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)'; \?>",
               lambda m: (m.group(1) if repo else m.group(2)).replace("\\'", "'"), s)
    return re.sub(r'<\?php.*?\?>', '', s, flags=re.S)

ix = F['idx']
a = ix.index('<div id="settingsPanel">'); b = ix.index('<div class="sp-section sp-danger-zone', a); b = ix.index('</div>\n</div>', b) + len('</div>\n</div>')
panel = ix[a:b]
c = ix.index('<div id="pnbStatusBar"'); d = ix.index('<div class="sb-spring"></div>', c)
bar = ix[c:d] + '</div>'
print('files: ' + APP + (' (missing ones from LIVE)' if APP != LIVE else ''))
mb = re.search(r"\n(    // REPOSITORY PAGE = NO REPORT \(2026-10-09\).*?\n    if \(\$\('body'\)\.hasClass\('pnb-repo-mode'\)\) \{.*?\n    \}\r?\n)", F['main'], re.S)
REPOJS = mb.group(1) if mb else ''
ok(bool(REPOJS), 'lifted the repository-page block from main.js')
ok(F['idx'].count('<div class="sp-section sp-columns-section">') == 1 and '$isRepoMode' not in bar and '<?' not in panel[panel.index('id="settingsPanelHandle"'):panel.index('>', panel.index('id="settingsPanelHandle"'))], 'index.php markup untouched where suites lift it verbatim (flatfreeze, sbkeys, singlekeytips)')
ok('id="spThemeSelector"' in panel and 'id="spClearStorage"' in panel and 'id="sbColsOpen"' in bar and 'id="sbPivot"' in bar, 'lifted the settings panel and the status bar from index.php')
ok("$('body').hasClass('pnb-repo-mode') ? ' (the app default)' : \" (this report's default)\"" in F['main'], "J main.js names the default option \"(the app default)\" on the repository page")

work = tempfile.mkdtemp(prefix='pnb_repopanel_')
try:
    open(os.path.join(work, 'main.css'), 'wb').write(F['css'].encode('utf-8', 'surrogateescape'))
    shutil.copyfile(os.path.join(LIVE, 'js', 'jquery-3.7.1.min.js'), os.path.join(work, 'jquery.js'))
    open(os.path.join(work, 'repo.js'), 'wb').write(('jQuery(function ($) {\n' + REPOJS + '\nwindow.ready = true;\n});').encode('utf-8', 'surrogateescape'))
    script = '''<script>
window.vis = function (sel) { var e = document.querySelector(sel); if (!e) return null; if (!e.getClientRects().length) return false; for (var p = e; p; p = p.parentElement) { var cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
// what main.js does at runtime: show the chips it manages (nesting and pivot are
// hidden in the markup too since colscard), and an open Columns card with its caret
['#sbFrozen', '#sbGroup', '#sbAsOf', '#sbSnapshot', '#sbNested', '#sbPivot'].forEach(function (s) { var e = document.querySelector(s); if (e) e.style.display = ''; });
(function () { var s = document.getElementById('sbColsSeg'); if (s) s.classList.add('sb-cl-ready', 'sb-cl-open'); })();
</script><script src="jquery.js"></script><script src="repo.js"></script>'''
    for name, repo in (('repo.html', True), ('report.html', False)):
        body_cls = 'pnb-repo-mode theme-wolfpack' if repo else 'theme-wolfpack'
        html = ('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"><style>#settingsPanel{left:0 !important;transform:none !important}</style></head><body class="%s">' % body_cls
                + render(panel, repo) + render(bar, repo) + script + '</body></html>')
        open(os.path.join(work, name), 'wb').write(html.encode('utf-8', 'surrogateescape'))
    SHOW = ['#spThemeSelector', '#spDensitySelector', '#spSingleKeysToggle + .sp-switch']
    REPORT_ONLY = ['#spRowExpandToggle + .sp-switch', '#spResolverToggle + .sp-switch', '.sp-columns-section', '#spApply', '#spReset', '#spClearStorage']
    CHIPS = ['#sbFrozen', '#sbNested', '#sbPivot', '#sbGroup', '#sbAsOf', '#sbSnapshot', '#sbColsPop']
    b = Browser(work, port=9300 + os.getpid() % 400)
    try:
        print('== R. repository page')
        b.load('repo.html')
        v = {s: b.ev('vis(%s)' % json.dumps(s)) for s in SHOW + REPORT_ONLY + CHIPS + ['#sbColsOpen', '#sbColsOpen .sb-cl-caret', '.sb-cols-gear-wrap', '#sbDataSeg', '#sbLoadSeg', '#sbDataSeg .sb-caret']}
        ok(all(v[s] for s in SHOW), 'R Theme, Density and Single-Key Shortcuts are offered  %s' % [v[s] for s in SHOW])
        bad = [s for s in REPORT_ONLY if v[s]]
        ok(not bad, 'R row height, vendor links, Columns, Save Column Layout, Reset, Clear All ... For This Report are gone  %s' % (bad or ''))
        bad = [s for s in CHIPS if v[s]]
        ok(not bad, 'R no frozen / nesting / pivot / group / earlier-version / snapshot chip and no Columns card, even when main.js shows them  %s' % (bad or ''))
        ok(v['#sbColsOpen'] and v['.sb-cols-gear-wrap'] is None and not v['#sbColsOpen .sb-cl-caret'], 'R the bar keeps its settings opener, with no caret; the gear is gone (2026-10-19)  [%s]' % v['#sbColsOpen .sb-cl-caret'])
        t = b.ev("document.getElementById('sbColsOpen').title")
        ht = b.ev("document.getElementById('settingsPanelHandle').title")
        ok(t == 'Open the Settings panel (theme & density)' and ht == '(CTRL+,) Settings Panel', 'R the opener and handle say what the panel holds  [%s | %s]' % (t, ht))
        attrs = b.ev("JSON.stringify(['sbDataSeg','sbLoadSeg'].map(function(i){var e=document.getElementById(i);return [e.getAttribute('role'), e.getAttribute('tabindex'), getComputedStyle(e).pointerEvents, e.title]}))")
        attrs = json.loads(attrs)
        ok(v['#sbDataSeg'] and v['#sbLoadSeg'] and all(x[0] is None and x[1] is None and x[2] == 'none' for x in attrs) and not v['#sbDataSeg .sb-caret'],
           'R Data and Queried stay as dummies: no button role, not focusable, no clicks, no caret  %s' % attrs)
        print('== P. a report page (unchanged)')
        b.load('report.html')
        v = {s: b.ev('vis(%s)' % json.dumps(s)) for s in SHOW + REPORT_ONLY + ['#sbFrozen', '#sbNested', '#sbPivot', '#sbColsOpen', '#sbColsOpen .sb-cl-caret', '#sbColsPop', '#sbDataSeg .sb-caret']}
        bad = [s for s in SHOW + REPORT_ONLY + ['#sbFrozen', '#sbNested', '#sbPivot', '#sbColsOpen', '#sbColsOpen .sb-cl-caret', '#sbColsPop', '#sbDataSeg .sb-caret'] if not v[s]]
        ok(not bad, 'P every panel control and bar chip is still there on a report  %s' % (bad or ''))
        attrs = json.loads(b.ev("JSON.stringify(['sbDataSeg','sbLoadSeg'].map(function(i){var e=document.getElementById(i);return [e.getAttribute('role'), e.getAttribute('tabindex'), getComputedStyle(e).pointerEvents]}))"))
        ht = b.ev("document.getElementById('settingsPanelHandle').title")
        ok(ht == '(CTRL+,) Column & Settings Panel', 'P the panel handle keeps its report title  [%s]' % ht)
        ok(all(x[0] == 'button' and x[1] == '0' and x[2] != 'none' for x in attrs), 'P Data and Queried are still buttons on a report  %s' % attrs)
        t = b.ev("document.getElementById('sbColsOpen').title")
        ok(t == 'Open the Column & Settings panel', 'P the opener keeps its report title  [%s]' % t)
        ok(not b.errors, 'no page errors  %s' % (b.errors[:2] if b.errors else ''))
    finally:
        b.close()
finally:
    if os.path.basename(work).startswith('pnb_repopanel_'): shutil.rmtree(work, ignore_errors=True)
print(('GREEN' if failed == 0 else 'RED') + ' %d / %d' % (passed, failed))
sys.exit(0 if failed == 0 else 1)
