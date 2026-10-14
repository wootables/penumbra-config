# =============================================================================
# reposplit (2026-10-10): THE REPOSITORY'S LIST | DETAILS SPLIT FOLLOWS THE WINDOW.
#
#   py -3 run.py                     # against LIVE
#   py -3 run.py --app <dir>         # against a stage (a file it lacks comes from live)
#   py -3 run.py --mutant M          # M in MUTANTS below; each must go RED
#
# The split code (SPLIT_* vars .. watchSplitResize) is CUT from the
# penumbra_repository.js under test and run on a docked repository.php layout
# styled by the main.css + penumbra_repository.css under test, in headless Edge.
#  D. no saved divider: the details pane opens at the 520px default.
#  N. the viewport narrows 1600 -> 1000: the details pane stays inside the layout
#     and keeps its 400px floor; widening again restores the default split.
#  S. a SAVED divider survives a narrow + widen round trip (resize never saves).
#  M. Manage Mode: the list keeps "the maximum" through a resize.
#  R. no ResizeObserver: the list basis still SHRINKS, so the details pane is on
#     screen (min-width 280) instead of being pushed out past the right edge.
#
# EXPECTED TAIL: "GREEN N / 0".
# =============================================================================
import json, os, shutil, sys, tempfile, time
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
F = {'repo': rd('js/penumbra_repository.js'), 'css': rd('css/main.css'), 'rcss': rd('css/penumbra_repository.css')}

MUTANTS = {
    'noobserve':  ('repo', '        _srSplitRO.observe(el);\n', '\n'),
    'noshrink':   ('repo', "$list.css('flex', '0 1 ' + Math.round(px) + 'px');", "$list.css('flex', '0 0 ' + Math.round(px) + 'px');"),
    'default420': ('repo', 'var SPLIT_PAGE_DETAILS = 520;', 'var SPLIT_PAGE_DETAILS = 420;'),
    'nomanage':   ('repo', "if (manageOn()) { setListWidth(clampSplit(Number.MAX_SAFE_INTEGER, w)); }\n                else { applySavedSplit(); }", "applySavedSplit();"),
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

def cut(src, a, b):
    i = src.index(a); j = src.index(b, i)
    return src[i:j]
src = F['repo']
SPLIT = (cut(src, '    var REPO_PAGE =', '\n\n') + '\n'
         + cut(src, '    var SPLIT_BAR = 6;', '    function bindSplitterHandlers() {'))
ok('function watchSplitResize' in SPLIT and 'function applySavedSplit' in SPLIT, 'the split block was cut from penumbra_repository.js')
if 'function watchSplitResize' not in SPLIT: SPLIT += '\n    function watchSplitResize() {}\n'   # the pre-2026-10-10 control: run, and go RED on the checks

INNER = ('<div id="serverReportLayout">'
         '<div id="serverReportListPane"><div class="sr-list-scroll"><table id="serverReportListTable" style="width:1400px"><tr><td>wide table</td></tr></table></div></div>'
         '<div id="srSplitter" class="sr-splitter" role="separator" tabindex="0"></div>'
         '<div id="serverReportDetailsPane">details</div></div>')
LAYOUT = '<div id="openReportListLightbox" class="lightbox"><div class="lightbox-content">' + INNER + '</div></div>'
JS = ('window.penumbra_vars = {repoMode: true};\nwindow._manage = false;\n'
      'jQuery(function ($) {\nfunction manageOn() { return window._manage; }\n' + SPLIT +
      '\nwindow.build = function () { $("#openReportListLightbox .lightbox-content").html(' + json.dumps(INNER) + '); applySavedSplit(); watchSplitResize(); };\n'
      'window.manage = function (on) { window._manage = on; var w = $("#serverReportLayout")[0].offsetWidth; if (on) setListWidth(clampSplit(Number.MAX_SAFE_INTEGER, w)); else { var s = loadSplit(); if (s) setListWidth(clampSplit(s, w)); else resetSplit(); } };\n'
      'build(); window.ready = true;\n});')
GEOM = ("JSON.stringify((function(){var L=document.getElementById('serverReportLayout').getBoundingClientRect(),"
        "l=document.getElementById('serverReportListPane').getBoundingClientRect(),d=document.getElementById('serverReportDetailsPane').getBoundingClientRect();"
        "return {lay:Math.round(L.right),list:Math.round(l.width),det:Math.round(d.width),detR:Math.round(d.right)}})())")

work = tempfile.mkdtemp(prefix='pnb_reposplit_')
try:
    open(os.path.join(work, 'main.css'), 'wb').write(F['css'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(work, 'repo.css'), 'wb').write(F['rcss'].encode('utf-8', 'surrogateescape'))
    shutil.copyfile(os.path.join(LIVE, 'js', 'jquery-3.7.1.min.js'), os.path.join(work, 'jquery.js'))
    open(os.path.join(work, 'split.js'), 'wb').write(JS.encode('utf-8', 'surrogateescape'))
    for name, pre in (('page.html', ''), ('noro.html', '<script>delete window.ResizeObserver;</script>')):
        html = ('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"><link rel="stylesheet" href="repo.css"></head>'
                '<body class="pnb-repo-mode">' + pre + LAYOUT + '<script src="jquery.js"></script><script src="split.js"></script></body></html>')
        open(os.path.join(work, name), 'wb').write(html.encode('utf-8', 'surrogateescape'))
    b = Browser(work, port=9300 + os.getpid() % 400, size="1600,900")
    def vp(w):
        b.cmd('Emulation.setDeviceMetricsOverride', width=w, height=900, deviceScaleFactor=1, mobile=False); time.sleep(0.4)
        return json.loads(b.ev(GEOM))
    try:
        b.load('page.html'); b.ev("localStorage.clear()"); b.load('page.html')
        g = vp(1600)
        print('== D. default  %s' % g)
        ok(abs(g['det'] - 520) <= 2, 'D the details pane opens at the 520px default  [%d]' % g['det'])
        g = vp(1000); print('== N. narrowed to 1000  %s' % g)
        ok(g['detR'] <= g['lay'] + 1, 'N the details pane stays inside the layout  [right %d vs %d]' % (g['detR'], g['lay']))
        ok(g['det'] >= 398, 'N the details pane keeps its 400px floor  [%d]' % g['det'])
        g = vp(1600)
        ok(abs(g['det'] - 520) <= 2, 'N widening again restores the default split  [%d]' % g['det'])
        print('== S. a saved divider')
        b.ev("localStorage.setItem('penumbra_repo_split_page', '900')"); b.load('page.html')
        g0 = json.loads(b.ev(GEOM)); vp(1000); g1 = vp(1600)
        ok(g0['list'] == 900 and g1['list'] == 900, 'S the saved 900px list survives a narrow + widen  [%d -> %d]' % (g0['list'], g1['list']))
        ok(b.ev("localStorage.getItem('penumbra_repo_split_page')") == '900', 'S a resize never SAVES the divider')
        print('== M. Manage Mode')
        # No saved divider here: with one (900) the clamp at this width lands on the
        # same 400px by coincidence and a Manage-blind resize went GREEN.
        b.ev("localStorage.clear()"); b.load('page.html'); vp(1600)
        b.ev("manage(true)"); g = vp(1400)
        ok(abs(g['det'] - 400) <= 2, 'M Manage Mode keeps the list at the maximum through a resize  [details %d]' % g['det'])
        b.ev("manage(false)"); vp(1600)
        print('== R. no ResizeObserver')
        b.ev("localStorage.clear()"); b.load('noro.html', ready="window.ready && !window.ResizeObserver")
        g = vp(1000); print('  %s' % g)
        ok(g['detR'] <= g['lay'] + 1 and g['det'] >= 278, 'R the list basis shrinks, the details pane stays on screen  [det %d, right %d vs %d]' % (g['det'], g['detR'], g['lay']))
        ok(not b.errors, 'no page errors  %s' % (b.errors[:2] if b.errors else ''))
    finally:
        b.close()
finally:
    if os.path.basename(work).startswith('pnb_reposplit_'): shutil.rmtree(work, ignore_errors=True)
print(('GREEN' if failed == 0 else 'RED') + ' %d / %d' % (passed, failed))
sys.exit(0 if failed == 0 else 1)
