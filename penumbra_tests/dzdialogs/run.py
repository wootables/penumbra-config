# =============================================================================
# dzdialogs (2026-10-09): EVERY DIALOG FOLLOWS DENSITY (round 2 of dzadmin).
#
#   py -3 run.py                     # against LIVE
#   py -3 run.py --app <dir>         # against a stage (app-shaped; a file it lacks comes from live)
#   py -3 run.py --mutant M          # M in MUTANTS below; each must go RED
#
# WHAT IS UNDER TEST (headless Edge over CDP, REAL mouse; the app's own jQuery,
# jQuery UI, CodeMirror, Chart.js, main.css and the density.css under test; the
# "DENSITY ZOOM SUPPORT" tail and single functions LIFTED from the main.js under
# test):
#  P. pins on the CSS / JS changes, and every changed script parses.
#  Z. each dialog type is zoomed 0.9 / 1.15 (lightbox, Help Center shell, prompt
#     box, full-screen card, download-link box); a dialog in a dialog is not
#     zoomed twice; the repository page's docked list scales too and fills its dock; on an admin
#     tool (page already zoomed) a dialog is not zoomed again.
#  H. viewport units: each dialog's ON-SCREEN height is the same fraction of the
#     window at every density (90vh, Pivot 96vh inline, Visualization 95vh, Help
#     Center 86vh, prompt 90vh, full-screen card 100vh-48px, download box 88vh
#     inline), and the admin settings drawer fills the window exactly.
#  D. drag and drop: Pivot's connected zones and the custom-sort list drop where
#     the pointer says, and the dragged item stays under the pointer.
#  C. CodeMirror (the Prompt Generator's editor): a click lands on the clicked
#     character and the cursor is DRAWN there.
#  K. Chart.js in the Visualization dialog: a real hover activates the bar under
#     the pointer (fix registered via pnbRegisterChartZoomFix, as main.js does).
#  F. lifted functions: the Grouping dropdown opens flush under its select, the
#     viz carousel steps exactly one tile, a Help Center jump lands its target at
#     the top of the pane.
#
# EXPECTED TAIL: "GREEN N / 0".
# =============================================================================
import json, os, re, shutil, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
F = {'help': rd('help/topics/userSettingsHelpLightbox.php'), 'dcss': rd('css/density.css'), 'main': rd('js/main.js'), 'sb': rd('js/search_builder.js'),
     'pre': rd('js/penumbra_presets.js'), 'repo': rd('js/penumbra_repository.js')}

MUTANTS = {
    'nozoom':      ('dcss', 'body:not(.pnb-adm-dz).density-easy-read :is(.help-lightbox > .lightbox-content,', 'body:not(.pnb-adm-dz).density-easy-read :is(.help-lightbox > .lightbox-contentX,'),
    'nonest':      ('dcss', 'body:not(.pnb-adm-dz):is(.density-compact, .density-easy-read) :is(.help-lightbox > .lightbox-content,', 'body.never-x :is(.help-lightbox > .lightbox-content,'),
    'norepo':      ('dcss', '/* The repository page docks the report list as the page itself; it scales the', 'body.pnb-repo-mode:is(.density-compact, .density-easy-read) #openReportListLightbox > .lightbox-content { zoom: 1; }\n/* The repository page docks the report list as the page itself; it scales the'),
    'repocap':     ('dcss', 'body.pnb-repo-mode:is(.density-compact, .density-easy-read) #openReportListLightbox > .lightbox-content { max-height: none; }', ''),
    'novh':        ('dcss', 'body:is(.density-compact, .density-easy-read) .help-lightbox > .lightbox-content { max-height: calc(90vh / var(--pnb-dz)); }', ''),
    'noadmvh':     ('dcss', 'body.pnb-adm-dz:is(.density-compact, .density-easy-read) #settingsPanel { height: calc(100vh / var(--pnb-dz)); }', ''),
    'nocmcounter': ('dcss', 'body:not(.pnb-adm-dz).density-easy-read :is(.help-lightbox, .modal-prompt-overlay) .CodeMirror { zoom: 0.8695652; }', ''),
    'nosortpatch': ('main', '        if (Math.abs(z - 1) > 0.001 && this.position) {', '        if (false && this.position) {'),
    'nochartfix':  ('main', "        if (!n || n.clientX === undefined || Math.abs(window.pnbZoomOf(c) - 1) <= 0.001) return;", "        return;"),
    'nopcs':       ('main', "            top:   (rect.bottom / z) + 'px',", "            top:   rect.bottom + 'px',"),
    'nocarou':     ('main', "        return Math.max(40, tile.getBoundingClientRect().width / (window.pnbZoomOf ? window.pnbZoomOf(tile) : 1) + gap);", "        return Math.max(40, tile.getBoundingClientRect().width + gap);"),
    'nohelpjump':  ('main', "        return Math.max(0, $pane[0].scrollTop + (er.top - pr.top) / (window.pnbZoomOf ? window.pnbZoomOf($pane[0]) : 1) - _helpStickyOffset());", "        return Math.max(0, $pane[0].scrollTop + (er.top - pr.top) - _helpStickyOffset());"),
}
if MUTANT:
    if MUTANT not in MUTANTS: sys.exit('unknown mutant %s (known: %s)' % (MUTANT, ', '.join(sorted(MUTANTS))))
    k, a, b = MUTANTS[MUTANT]
    a2 = a if a in F[k] else a.replace('\n', '\r\n')
    n = F[k].count(a2)
    if n != 1: sys.exit('mutant %s anchor hits %d in %s, expected 1' % (MUTANT, n, k))
    F[k] = F[k].replace(a2, b.replace('\n', '\r\n') if a2 is not a else b)
    print('      + MUTANT', MUTANT)

passed = failed = 0
def ok(cond, label):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + label)
    else: failed += 1; print('  FAIL ' + label)
def near(a, b, tol=1.5):
    return a is not None and b is not None and abs(a - b) <= tol

print('files: ' + APP + (' (missing ones from LIVE)' if APP != LIVE else ''))
print('== P. pins')
d, m = F['dcss'], F['main']
ok('body.density-compact   { --pnb-dz: 0.9; }' in d and 'body.density-easy-read { --pnb-dz: 1.15; }' in d, 'density.css defines the dialog scale --pnb-dz')
ok(m.count('window.pnbZoomOf = function (el)') == 1 and 'el.currentCSSZoom' in m, 'main.js exports pnbZoomOf (effective zoom, 1 without support)')
ok('if (window.pnbRegisterChartZoomFix) window.pnbRegisterChartZoomFix();' in m, 'the chart module loader registers the Chart.js zoom fix')
# (pvnotes round 12, 2026-10-09: the layer is placed by the canvas's screen box over its layout size - the zoom, and a
# slide's scale(); pvnotes V-sw-zoom drives it at 125%)
ok('var k = (canvas.offsetWidth > 0 && cr.width > 0) ? cr.width / canvas.offsetWidth : (window.pnbZoomOf ? window.pnbZoomOf(layer) : 1);' in m
   and 'var cw = cr.width / k, chh = cr.height / k;' in m and 'var sx = chart.width ? cw / chart.width : 1' in m, 'chart-note markers convert screen px to CSS px')
ok(m.count('/ (window.pnbZoomOf ? window.pnbZoomOf($b[0]) : 1)') == 1 and m.count('/ (window.pnbZoomOf ? window.pnbZoomOf($body[0]) : 1)') == 1, 'Version History jumps divide by the zoom')
ok('/ (window.pnbZoomOf ? window.pnbZoomOf($toc[0]) : 1)' in m and '/ (window.pnbZoomOf ? window.pnbZoomOf($scrollContainer[0]) : 1)' in m, 'Help Center TOC and in-topic jumps divide by the zoom')
ok('/ (window.pnbZoomOf ? window.pnbZoomOf($sc[0]) : 1)' in m, "Pivot's rank-scope width divides by the zoom")
ok("document.querySelectorAll('.help-lightbox .CodeMirror, .modal-prompt-overlay .CodeMirror')" in m, 'a live density change re-measures the dialog editors')
ok('<strong>Compact</strong> shows them at 90% and <strong>Easy Read</strong> at 115%, still fitting the window.' in F['help'], "the help's Density section says the dialogs and admin tools follow it")
ok('(want - r.top) / (window.pnbZoomOf ? window.pnbZoomOf(h.el) : 1)' in F['sb'], "Search Builder's dialog hold converts to the dialog's CSS px")
ok('var pw = pop.offsetWidth * z, ph = pop.offsetHeight * z;' in F['pre'] and "pop.style.top  = Math.round(top / z) + 'px';" in F['pre'], 'the presets popover converts both ways')
ok("(e.pageX - d.startX) / (window.pnbZoomOf ? window.pnbZoomOf(d.th) : 1)" in F['repo'] and '(ev.clientX - startX) / (window.pnbZoomOf ? window.pnbZoomOf($list[0]) : 1)' in F['repo'], 'Ctrl+O list column and splitter drags divide by the zoom')

def lift_fn(src, name):
    m_ = re.search(r'\n(    function ' + re.escape(name) + r'\(.*?\r?\n    \}\r?\n)', src, re.S)
    return m_.group(1) if m_ else None
tail_m = re.search(r'/\* ===== DENSITY ZOOM SUPPORT \(2026-10-09\).*?(?=\r?\n\}\);\s*\Z)', m, re.S)   # inside the ready closure, last
TAIL = tail_m.group(0) if tail_m else ''
LIFT = {n: lift_fn(m, n) for n in ('_pcsPositionDropdown', 'vizCarouStep', '_helpJumpTarget')}
ok(bool(TAIL) and m.rstrip().endswith('});') and all(LIFT.values()), 'main.js still ends with the ready closure; lifted the zoom-support block and _pcsPositionDropdown / vizCarouStep / _helpJumpTarget')

L = LIVE
work = tempfile.mkdtemp(prefix='pnb_dzdialogs_')
try:
    os.makedirs(os.path.join(work, 'js')); os.makedirs(os.path.join(work, 'css'))
    for f in ('js/jquery-3.7.1.min.js', 'js/jquery-ui.min.js', 'js/codemirror.min.js', 'js/chart-4.5.1.min.js', 'css/codemirror.min.css', 'css/jquery-ui.css'):
        shutil.copyfile(os.path.join(L, f), os.path.join(work, f))
    def wr(rel, s): open(os.path.join(work, rel), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    wr('css/main.css', rd('css/main.css')); wr('css/density.css', F['dcss'])
    for k, rel in (('main', 'main.js'), ('sb', 'search_builder.js'), ('pre', 'penumbra_presets.js'), ('repo', 'penumbra_repository.js')):
        wr('src_' + rel, F[k])
    wr('js/tail.js', TAIL)
    wr('js/lifted.js', '(function(){\n' + '\n'.join(LIFT[n] or '' for n in LIFT) +
       '\nfunction _helpStickyOffset(){ return 0; }\nwindow._pcsPositionDropdown=_pcsPositionDropdown; window.vizCarouStep=vizCarouStep; window._helpJumpTarget=_helpJumpTarget;\n})();\n')
    TALLDIV = '<div style="height:3000px">tall</div>'
    body = '''
<div id="lbA" class="help-lightbox" style="display:flex"><div class="lightbox-content pnb-dlg" style="width:760px">
  <div id="nestHost" class="help-lightbox" style="display:block;position:static"><div id="nested" class="lightbox-content">nested</div></div>
  <div id="pcs" class="penumbra-custom-select pcs-open" style="width:220px"><div class="pcs-selected">Choose a column</div><div class="pcs-dropdown" style="display:block"><div>one</div><div>two</div></div></div>
  <div id="carou" style="display:flex;column-gap:5px;overflow-x:auto;width:300px"><div class="viz-type-option" style="flex:0 0 100px;height:30px">a</div><div class="viz-type-option" style="flex:0 0 100px">b</div><div class="viz-type-option" style="flex:0 0 100px">c</div><div class="viz-type-option" style="flex:0 0 100px">d</div><div class="viz-type-option" style="flex:0 0 100px">e</div></div>
  <div id="zA" class="pivot-drop-zone" style="min-height:40px;border:1px solid #888;margin:6px;padding:4px;display:flex;gap:4px"><div class="pivot-column-item" data-field="A1">A1</div><div class="pivot-column-item" data-field="A2">A2</div><div class="pivot-column-item" data-field="A3">A3</div></div>
  <div id="zB" class="pivot-drop-zone" style="min-height:40px;border:1px solid #888;margin:6px;padding:4px;display:flex;gap:4px"><div class="pivot-column-item" data-field="B1">B1</div><div class="pivot-column-item" data-field="B2">B2</div><div class="pivot-column-item" data-field="B3">B3</div></div>
  <ul id="csList" style="padding:0"><li data-v="1" style="list-style:none;padding:5px;border:1px solid #999"><span class="cs-drag-handle" style="padding:0 6px;background:#ddd">::</span>one</li><li data-v="2" style="list-style:none;padding:5px;border:1px solid #999"><span class="cs-drag-handle">::</span>two</li><li data-v="3" style="list-style:none;padding:5px;border:1px solid #999"><span class="cs-drag-handle">::</span>three</li><li data-v="4" style="list-style:none;padding:5px;border:1px solid #999"><span class="cs-drag-handle">::</span>four</li></ul>
  <div id="subqueryFormContainer"><textarea id="subquerySql">SELECT column_one, column_two FROM some_table WHERE x = 1</textarea></div>
  TALL
</div></div>
<div id="pivotLightbox" class="help-lightbox" style="display:flex"><div class="lightbox-content pnb-dlg" style="width: 88%; max-width: 1440px; max-height: 96vh;">TALL</div></div>
<div id="visualizationLightbox" class="help-lightbox" style="display:flex"><div class="lightbox-content pnb-dlg viz-shell"><div style="position:relative;width:600px;height:260px"><canvas id="vizChart"></canvas></div>TALL</div></div>
<div id="helpCenterLightbox" class="help-lightbox help-center-overlay" style="display:flex"><div class="help-center-shell"><div id="helpCenterContent" style="overflow-y:auto;flex:1;position:relative"><div style="height:900px">a</div><h3 id="helpTarget">Target</h3><div style="height:2000px">b</div></div></div></div>
<div id="promptOv" class="modal-prompt-overlay" style="display:flex"><div class="modal-prompt-box">TALL</div></div>
<div id="fsDlg" class="penumbra-fs-dialog" style="display:flex"><div class="penumbra-fs-dialog-card">TALL</div></div>
<div id="dlLinkOptionsLightbox" style="display:flex; position:fixed; inset:0; z-index:100050; align-items:center; justify-content:center; padding:20px;"><div style="max-width:560px; width:100%; max-height:88vh; overflow:auto">TALL</div></div>
<div id="openReportListLightbox" class="help-lightbox" style="display:flex"><div class="lightbox-content">list</div></div>
<div id="settingsPanel">panel</div>
'''.replace('TALL', TALLDIV)
    scripts = '''
<script src="js/jquery-3.7.1.min.js"></script><script src="js/jquery-ui.min.js"></script><script src="js/codemirror.min.js"></script><script src="js/chart-4.5.1.min.js"></script>
<script src="js/tail.js"></script><script src="js/lifted.js"></script>
<script>
$('.pivot-drop-zone').sortable({ connectWith: '.pivot-drop-zone', items: '.pivot-column-item', placeholder: 'pivot-column-item-placeholder', tolerance: 'pointer' });
$('#csList').sortable({ handle: '.cs-drag-handle', cancel: 'input, textarea, select, option, .cs-val-remove', placeholder: 'ui-sortable-placeholder' });
window.cm = CodeMirror.fromTextArea(document.getElementById('subquerySql'), { lineNumbers: true });
if (window.pnbRegisterChartZoomFix) window.pnbRegisterChartZoomFix();
window.ch = new Chart(document.getElementById('vizChart'), { type: 'bar', data: { labels: ['a','b','c','d','e','f','g','h'], datasets: [{ data: [3,5,2,8,6,4,7,1] }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: true } } });
window.rc = function (sel) { var e = typeof sel === 'string' ? document.querySelector(sel) : sel; var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
window.zoomOf = function (sel) { var e = document.querySelector(sel); return e ? Math.round((e.currentCSSZoom || 1) * 1000) / 1000 : null; };
window.order = function () { return { A: $('#zA .pivot-column-item').map(function(){return this.dataset.field}).get().join(','), B: $('#zB .pivot-column-item').map(function(){return this.dataset.field}).get().join(','), cs: $('#csList li').map(function(){return this.dataset.v}).get().join(',') }; };
window.barAt = function (i) { var el = ch.getDatasetMeta(0).data[i], r = ch.canvas.getBoundingClientRect(); return { x: r.left + el.x * r.width / ch.width, y: r.top + (el.y + el.base) / 2 * r.height / ch.height }; };
window.only = function (id) { ['lbA','pivotLightbox','visualizationLightbox','helpCenterLightbox','promptOv','fsDlg','dlLinkOptionsLightbox','openReportListLightbox'].forEach(function (k) { var e = document.getElementById(k); if (e) e.style.display = (id === '*' || k === id) ? 'flex' : 'none'; }); var sp = document.getElementById('settingsPanel'); if (sp) sp.style.display = id === '*' ? '' : 'none'; return id; };
window.ready = true;
</script>'''
    head = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/jquery-ui.css"><link rel="stylesheet" href="css/codemirror.min.css"><link rel="stylesheet" href="css/main.css"><link rel="stylesheet" href="css/density.css"></head><body class="%s">'
    pages = {'std': '', 'compact': 'density-compact', 'easy': 'density-easy-read',
             'admeasy': 'pnb-adm pnb-adm-dz density-easy-read', 'repoeasy': 'pnb-repo-mode density-easy-read'}
    for k, cls in pages.items():
        wr(k + '.html', (head % cls) + body + scripts + '</body></html>')
    wr('parse.html', '<!doctype html><html><body><script>window.ready=true;</script></body></html>')

    b = Browser(work, port=9300 + os.getpid() % 400, size='1300,800')
    try:
        print('== P2. parse')
        b.load('parse.html')
        for k in ('main.js', 'search_builder.js', 'penumbra_presets.js', 'penumbra_repository.js'):
            r = b.ev("fetch('src_%s').then(function(x){return x.text()}).then(function(t){try{new Function(t);return 'ok'}catch(e){return String(e)}})" % k)
            ok(r == 'ok', '%s parses  [%s]' % (k, r if r != 'ok' else 'ok'))
        Zs = {'std': 1, 'compact': 0.9, 'easy': 1.15}; BASE = {}
        for k in ('std', 'compact', 'easy'):
            z = Zs[k]
            print('== %s (zoom %s)' % (k, z))
            b.load(k + '.html')
            vh = b.ev('innerHeight')
            b.ev("only('*')")
            zz = b.ev("JSON.stringify(['#lbA > .lightbox-content', '#helpCenterLightbox > .help-center-shell', '#promptOv > .modal-prompt-box', '#fsDlg > .penumbra-fs-dialog-card', '#dlLinkOptionsLightbox > div', '#nested', '#settingsPanel'].map(zoomOf))")
            if not isinstance(zz, str): print('    EVAL ERROR', zz, b.ev("JSON.stringify([typeof zoomOf, document.readyState, location.href, window.ready, typeof jQuery, typeof Chart, typeof CodeMirror])"), b.errors[-3:])
            zz = json.loads(zz)
            ok(all(near(v, z, 0.002) for v in zz[:5]), 'Z every dialog type is zoomed %s  %s' % (z, zz[:5]))
            ok(near(zz[5], z, 0.002), 'Z a dialog in a dialog is not zoomed twice  [%s]' % zz[5])
            ok(near(zz[6], 1, 0.002), 'Z page chrome (settings drawer) is not zoomed on a report page  [%s]' % zz[6])
            H = {'#lbA > .lightbox-content': 0.90, '#pivotLightbox > .lightbox-content': 0.96, '#visualizationLightbox > .lightbox-content': 0.95,
                 '#helpCenterLightbox > .help-center-shell': 0.86, '#promptOv > .modal-prompt-box': 0.90, '#dlLinkOptionsLightbox > div': 0.88}
            got = {s: b.ev("rc('%s').h" % s) for s in H}
            if k == 'std': BASE.update(got)
            # on-screen = nominal share of the window + the box's own padding/border, which DO scale
            want = {s: H[s] * vh + (BASE[s] - H[s] * vh) * z for s in H}
            bad = {s.split(' ')[0]: '%.0f vs %.0f' % (got[s], want[s]) for s in H if not near(got[s], want[s], 2.5)}
            ok(not bad and all(got[s] <= vh for s in H), 'H every dialog keeps its on-screen height share (90/96/95/86/90/88%% of the window) and fits  %s' % (bad or ''))
            fs = b.ev("rc('#fsDlg > .penumbra-fs-dialog-card').h")
            ok(near(fs, vh - 48 * z, 2.5) or (fs is not None and fs <= vh - 48 * z + 2.5), 'H the full-screen card stays inside the window  [%s of %s]' % (round(fs or 0), vh))
            # F: grouping dropdown
            b.ev("_pcsPositionDropdown($('#pcs'))")
            s1 = b.ev("rc('#pcs .pcs-selected')"); d1 = b.ev("rc('#pcs .pcs-dropdown')")
            b.ev("only('lbA')")
            ok(near(d1['t'], s1['b']) and near(d1['l'], s1['l']) and near(d1['w'], s1['w'], 3), 'F the Grouping dropdown opens flush under its select  [dy %.1f dx %.1f dw %.1f]' % (d1['t'] - s1['b'], d1['l'] - s1['l'], d1['w'] - s1['w']))
            # F: carousel step = one tile (CSS px)
            stp = b.ev("vizCarouStep(document.getElementById('carou'))")
            want_stp = b.ev("document.querySelector('#carou .viz-type-option').offsetWidth + 5")
            ok(near(stp, want_stp, 0.6), 'F the viz carousel steps one tile + gap, in CSS px  [%s vs %s]' % (round(stp, 2), want_stp))
            # F: help jump
            b.ev("only('helpCenterLightbox')")
            b.ev("(function(){var p=$('#helpCenterContent');p[0].scrollTop=0;p[0].scrollTop=_helpJumpTarget(p,$('#helpTarget'));})()")
            dy = b.ev("rc('#helpTarget').t - rc('#helpCenterContent').t")
            ok(near(dy, 0, 1.5), 'F a Help Center jump lands its target at the top of the pane  [%.1f px off]' % dy)
            # D: drags
            b.ev("only('lbA')")
            a1 = b.ev("rc('#zA [data-field=A1]')"); b3 = b.ev("rc('#zB [data-field=B3]')")
            x0, y0, x1, y1 = a1['x'], a1['y'], b3['l'] + 3, b3['y']
            b.mouse('mouseMoved', x0, y0); b.mouse('mousePressed', x0, y0, 1, 1); time.sleep(0.08)
            for i in range(1, 15): b.mouse('mouseMoved', x0 + (x1 - x0) * i / 14, y0 + (y1 - y0) * i / 14, 1); time.sleep(0.03)
            time.sleep(0.15)
            hp = b.ev("(function(){var h=document.querySelector('.ui-sortable-helper');return h?rc(h):null})()")
            b.mouse('mouseReleased', x1, y1, 0, 1); time.sleep(0.3)
            o = b.ev('order()')
            ok(o['A'] == 'A2,A3' and o['B'] == 'B1,B2,A1,B3', 'D Pivot: a field dragged between zones lands before B3  %s' % o)
            ok(hp is not None and near(hp['x'], x1, 3) and near(hp['y'], y1, 3), 'D Pivot: the dragged field stays under the pointer  [%s]' % (None if not hp else '%.1f, %.1f' % (hp['x'] - x1, hp['y'] - y1)))
            h1 = b.ev("rc('#csList li[data-v=\"1\"] .cs-drag-handle')"); i3 = b.ev("rc('#csList li[data-v=\"3\"]')")
            x0, y0, x1, y1 = h1['x'], h1['y'], h1['x'] + 30, i3['t'] + i3['h'] * 0.8
            b.mouse('mouseMoved', x0, y0); b.mouse('mousePressed', x0, y0, 1, 1); time.sleep(0.08)
            for i in range(1, 15): b.mouse('mouseMoved', x0 + (x1 - x0) * i / 14, y0 + (y1 - y0) * i / 14, 1); time.sleep(0.03)
            time.sleep(0.15)
            hp = b.ev("(function(){var h=document.querySelector('#csList .ui-sortable-helper .cs-drag-handle');return h?rc(h):null})()")
            b.mouse('mouseReleased', x1, y1, 0, 1); time.sleep(0.3)
            ok(b.ev('order().cs') == '2,3,1,4', 'D custom sort: a value dragged below the third lands third  [%s]' % b.ev('order().cs'))
            ok(hp is not None and near(hp['x'], x1, 3) and near(hp['y'], y1, 3), 'D custom sort: the dragged row stays under the pointer  [%s]' % (None if not hp else '%.1f, %.1f' % (hp['x'] - x1, hp['y'] - y1)))
            # C: CodeMirror
            cr = b.ev("(function(){var pre=document.querySelector('.CodeMirror-line');var w=document.createTreeWalker(pre,NodeFilter.SHOW_TEXT);var n,acc=0;while((n=w.nextNode())){if(acc+n.length>20){var rg=document.createRange();rg.setStart(n,20-acc);rg.setEnd(n,21-acc);var r=rg.getBoundingClientRect();return {x:r.left+r.width*0.3,y:r.top+r.height/2,l:r.left}};acc+=n.length}})()")
            b.click(cr['x'], cr['y'])
            time.sleep(0.2)
            # the DRAWN cursor element, not cm.cursorCoords(): CodeMirror computes those from screen
            # measures, so they stay right while the cursor it draws sits beside the text
            cur = b.ev("(function(){var c=document.querySelector('.CodeMirror-cursors .CodeMirror-cursor');return {ch:cm.getCursor().ch,l:c?c.getBoundingClientRect().left:null}})()")
            ok(cur['ch'] == 20, 'C the editor click lands on the clicked character  [ch %s]' % cur['ch'])
            ok(near(cur['l'], cr['l'], 1.0), 'C the editor draws its cursor at that character  [%s px off]' % (None if cur['l'] is None else round(cur['l'] - cr['l'], 1)))
            # K: chart hover
            b.ev("only('visualizationLightbox')"); time.sleep(0.4)
            hits = []
            for i in (1, 4, 6):
                t = b.ev('barAt(%d)' % i)
                b.mouse('mouseMoved', t['x'], t['y']); time.sleep(0.2)
                hits.append(b.ev('ch.getActiveElements().map(function(a){return a.index})'))
            ok(hits == [[1], [4], [6]], 'K Visualization chart: a real hover over bars 1, 4, 6 activates exactly those  %s' % hits)
        print('== admin tool (page zoomed 1.15)')
        b.load('admeasy.html')
        vh = b.ev('innerHeight')
        ok(near(b.ev("zoomOf('#lbA > .lightbox-content')"), 1.15, 0.002), 'Z a dialog on an admin tool inherits the page zoom once (1.15, not 1.32)')
        ok(near(b.ev("rc('#settingsPanel').h"), vh, 2), 'H the settings drawer fills the window exactly  [%s of %s]' % (round(b.ev("rc('#settingsPanel').h")), vh))
        ah = b.ev("rc('#lbA > .lightbox-content').h"); aw = 0.9 * vh + (BASE['#lbA > .lightbox-content'] - 0.9 * vh) * 1.15
        ok(near(ah, aw, 2.5), 'H an admin-tool dialog keeps its 90%% height  [%.0f vs %.0f]' % (ah, aw))
        print('== repository page (docked list)')
        b.load('repoeasy.html')
        b.ev("only('openReportListLightbox')")
        # a TALL dock (no admin bar above it): a 90vh-style cap would leave the list short of it
        b.ev("document.documentElement.style.setProperty('--pnb-repo-top', '0px')"); time.sleep(0.2)
        rz = b.ev("zoomOf('#openReportListLightbox > .lightbox-content')")
        fit = json.loads(b.ev("JSON.stringify([rc('#openReportListLightbox'), rc('#openReportListLightbox > .lightbox-content')])"))
        ok(near(rz, 1.15, 0.002), 'Z the repository page\'s docked report list follows density too (1.15)  [%s]' % rz)
        ok(near(fit[0]['w'], fit[1]['w'], 1.5) and near(fit[0]['h'], fit[1]['h'], 1.5), 'H ...and still fills its dock exactly  [dock %.0fx%.0f, list %.0fx%.0f]' % (fit[0]['w'], fit[0]['h'], fit[1]['w'], fit[1]['h']))
        ok(not b.errors, 'no page errors  %s' % (b.errors[:3] if b.errors else ''))
    finally:
        b.close()
finally:
    if os.path.basename(work).startswith('pnb_dzdialogs_'):
        shutil.rmtree(work, ignore_errors=True)

print(('GREEN' if failed == 0 else 'RED') + ' %d / %d' % (passed, failed))
sys.exit(0 if failed == 0 else 1)
