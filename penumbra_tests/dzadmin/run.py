# =============================================================================
# dzadmin (2026-10-09): ADMIN TOOLS FOLLOW DENSITY + COPY/DOWNLOAD SUBTEXT COLOR.
#
#   py -3 run.py                     # against LIVE
#   py -3 run.py --app <dir>         # against a stage (app-shaped; a file it lacks comes from live)
#   py -3 run.py --control           # the browser half WITHOUT the Chart.js zoom fix: must go RED
#   py -3 run.py --mutant M          # M in MUTANTS below; each must go RED
#
# WHAT IS UNDER TEST
#  A. pins: penumbra_admin_chrome.php opts its <body> in (.pnb-adm-dz), applies the
#     family density at boot (pnbApplyDensity) and exposes pnbZoom(); density.css
#     zooms an opted-in body (0.9 / 1.15) and keeps Compact from narrowing it;
#     analytics_all opts in for family scope and registers the pnbZoomFix plugin;
#     tags_admin / analytics_all measure sticky offsets with offsetHeight and
#     divide drag deltas by the zoom; health's popover divides by z; the Copy and
#     Download dialogs carry no hard-coded #555 (theme token instead), nor does
#     main.js's nested-placeholder note.
#  B. browser (headless Edge, CDP, REAL mouse events): the density boot block lifted
#     from the chrome sets the class from localStorage exactly like home (landing
#     pin > global > Standard), density.css zooms the body, and Chart.js 4.5.1
#     hover hits the bar under the pointer at 90% and 115% with the plugin lifted
#     from analytics_all.php. Without it (--control) the hover misses: RED.
#
# EXPECTED TAIL: "GREEN N / 0" (N = 27 as of 2026-10-09).
# =============================================================================
import json, os, re, subprocess, sys, tempfile, time, shutil, urllib.request, threading, functools, http.server, socketserver

LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
args = sys.argv[1:]
def opt(name, dflt=None):
    return args[args.index(name) + 1] if name in args else dflt
APP = opt('--app', LIVE)
CONTROL = '--control' in args
MUTANT = opt('--mutant', '')

def src(rel):
    p = os.path.join(APP, rel)
    if not os.path.exists(p): p = os.path.join(LIVE, rel)
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

F = {k: src(v) for k, v in {
    'chrome': 'penumbra_admin_chrome.php', 'dcss': 'css/density.css', 'an': 'analytics_all.php',
    'tags': 'tags_admin.php', 'health': 'health.php', 'idx': 'index.php', 'main': 'js/main.js'}.items()}

# Each mutant: (file key, exact old text, new text). The anchor must hit exactly once.
MUTANTS = {
    'nobodyclass': ('chrome', 'echo "<body class=\\"pnb-adm pnb-adm-dz\\">\\n";', 'echo "<body class=\\"pnb-adm\\">\\n";'),
    'noboot':      ('chrome', '        window.pnbApplyDensity(dv);\n', '\n'),
    'nozoomrule':  ('dcss',   'body.pnb-adm-dz.density-easy-read { zoom: 1.15; }', 'body.pnb-adm-dz.density-easy-read { }'),
    'noplugin':    ('an',     "if (window.Chart) Chart.register({ id: 'pnbZoomFix'", "if (false) Chart.register({ id: 'pnbZoomFix'"),
    'gbcrsticky':  ('tags',   "root.style.setProperty('--pnb-adm-offset', (bar ? bar.offsetHeight : 0) + 'px');", "root.style.setProperty('--pnb-adm-offset', (bar ? Math.round(bar.getBoundingClientRect().height) : 0) + 'px');"),
    'grey555':     ('idx',    '<strong>Copy Table as CSV</strong>\n                    <small style="display: block; margin-left: 22px; color: var(--text-muted);">', '<strong>Copy Table as CSV</strong>\n                    <small style="display: block; margin-left: 22px; color: #555;">'),
}
if MUTANT:
    if MUTANT not in MUTANTS: sys.exit('unknown mutant %s (known: %s)' % (MUTANT, ', '.join(sorted(MUTANTS))))
    k, a, b = MUTANTS[MUTANT]
    n = F[k].count(a)
    if n != 1: sys.exit('mutant %s anchor hits %d times in %s, expected 1' % (MUTANT, n, k))
    F[k] = F[k].replace(a, b)
    print('      + MUTANT', MUTANT)

passed = failed = 0
def ok(cond, label):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + label)
    else: failed += 1; print('  FAIL ' + label)

print('files: ' + APP + (' (missing ones from LIVE)' if APP != LIVE else ''))
print('== A. pins')
c = F['chrome']
ok('echo "<body class=\\"pnb-adm pnb-adm-dz\\">\\n";' in c, 'the chrome body opts into the family density (.pnb-adm-dz)')
ok("if (!b || !b.classList.contains('pnb-adm-dz')) { return; }" in c, 'pnbApplyDensity leaves a body that did not opt in alone (the repository page)')
ok("Object.prototype.hasOwnProperty.call(dp, '__landing__') ? dp['__landing__'] : dg;" in c and '        window.pnbApplyDensity(dv);\n' in c, 'boot reads the home chain: landing pin, else the global default')
ok('window.pnbZoom = function ()' in c, 'pnbZoom() is exported for screen-px -> CSS-px conversions')
ok("if (window.pnbApplyDensity) { window.pnbApplyDensity(v); }" in c, 'the settings panel applies live through the same applier')
ok("won't visibly change" not in c and 'Theme and density apply to the home screen and every admin tool.' in c, 'the panel no longer says density skips the admin tools')
d = F['dcss']
ok('body.pnb-adm-dz.density-compact   { zoom: 0.9; }' in d and 'body.pnb-adm-dz.density-easy-read { zoom: 1.15; }' in d, 'density.css zooms an opted-in body: Compact 0.9, Easy Read 1.15')
ok('html body.pnb-adm-dz.density-compact { max-width: none; }' in d, "Compact does not narrow an admin tool to the report pages' 96%")
a = F['an']
ok('<body<?php if ($anFamilyTheme) echo \' class="pnb-adm-dz"\';' in a, 'Metrics/Calendar opt in for family scope only (report scope keeps its own settings)')
ok("Chart.register({ id: 'pnbZoomFix'" in a, 'Metrics registers the Chart.js zoom fix')
ok("setProperty('--pnb-adm-offset', admBarEl.offsetHeight + 'px')" in a, 'Metrics measures its sticky offset in CSS px (offsetHeight)')
ok('const dx = (e.clientX - dtDrag.x) / (window.pnbZoom ? window.pnbZoom() : 1);' in a and 'w: th.offsetWidth' in a, 'Metrics column drag: CSS-px start width, delta divided by the zoom')
t = F['tags']
ok("(bar ? bar.offsetHeight : 0) + 'px'" in t and "strip.offsetHeight + 'px' : '0px'" in t and '? 0 : b.offsetHeight;' in t, 'Tags measures bar, strip and banners in CSS px')
ok('var dx = (e.clientX - dtDrag.x) / (window.pnbZoom ? window.pnbZoom() : 1);' in t and 'w: th.offsetWidth' in t, 'Tags column drag divides by the zoom')
h = F['health']
ok("pop.style.left = ((left + window.pageXOffset) / z) + 'px';" in h and 'vw - pop.offsetWidth * z - 16' in h, 'Health range popover converts screen px to CSS px')
i = F['idx']
s, e = i.find('<div id="copyActionsLightbox"'), i.find('<div id="groupingLightbox"')
blk = i[s:e] if s > 0 and e > s else ''
ok(blk != '' and re.search(r'color:\s*#555\b', blk) is None, 'Copy/Download dialogs: no hard-coded #555 left')
ok(blk.count('color: var(--text-muted);') >= 19, 'Copy/Download option descriptions use the theme token (%d)' % blk.count('color: var(--text-muted);'))
ok('<small style="color: var(--text-muted);">Using any nested sub-column placeholder' in F['main'], "main.js's nested-placeholder note in those dialogs uses the token too")

# ---------------------------------------------------------------- B. browser
print('== B. browser (headless Edge, real mouse events)')
work = tempfile.mkdtemp(prefix='pnb_dzadmin_')
try:
    shutil.copy(os.path.join(LIVE, 'js', 'chart-4.5.1.min.js'), work)
    open(os.path.join(work, 'density.css'), 'w', encoding='utf-8').write(d)
    m = re.search(r"\n    // DENSITY \(2026-10-09\).*?\n    \} catch \(e\) \{ \}\n", c, re.S)
    boot = m.group(0) if m else '/* boot block not found */'
    m2 = re.search(r"    if \(window\.Chart\) Chart\.register\(\{ id: 'pnbZoomFix'.*?\n    \} \}\);\n", a, re.S)
    plugin = '' if CONTROL else (m2.group(0) if m2 else '/* plugin not found */')
    page = ('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="density.css">'
            '<style>body{margin:0;padding:20px}.wrap{position:relative;height:300px;width:800px}</style></head>'
            '<body class="__BODY__"><div class="wrap"><canvas id="c"></canvas></div>'
            '<script src="chart-4.5.1.min.js"></script><script>\n'
            '(function(){\n' + boot + '\n})();\n' + plugin +
            '\nwindow.ch = new Chart(document.getElementById("c"), { type: "bar", data: { labels: ["a","b","c","d","e","f","g","h"], datasets: [{ data: [3,5,2,8,6,4,7,1] }] },'
            ' options: { animation: false, responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: true } } });\n'
            'window.target = function (i) { var el = ch.getDatasetMeta(0).data[i], r = ch.canvas.getBoundingClientRect();'
            ' return { x: r.left + el.x * r.width / ch.width, y: r.top + (el.y + el.base) / 2 * r.height / ch.height }; };\n'
            '</script></body></html>')
    open(os.path.join(work, 'opt.html'), 'w', encoding='utf-8').write(page.replace('__BODY__', 'pnb-adm pnb-adm-dz'))
    open(os.path.join(work, 'noopt.html'), 'w', encoding='utf-8').write(page.replace('__BODY__', 'pnb-repo-mode'))
    ok(bool(m) and (CONTROL or bool(m2)), 'lifted the boot block from the chrome and the plugin from analytics_all')

    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    httpd = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=work))
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    import websocket
    EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    prof = os.path.join(work, 'p')
    dport = 9300 + (os.getpid() % 500)
    proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                             '--disable-sync', '--disable-extensions', '--user-data-dir=' + prof, '--window-size=1200,700',
                             '--remote-debugging-port=%d' % dport, '--remote-allow-origins=*', 'about:blank'])
    try:
        wsu = None
        for _ in range(80):
            try:
                ts = json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % dport))
                pg = [x for x in ts if x.get('type') == 'page' and x.get('url') == 'about:blank']
                if pg: wsu = pg[0]['webSocketDebuggerUrl']; break
            except Exception: pass
            time.sleep(0.25)
        ws = websocket.create_connection(wsu, timeout=30)
        nid = [0]
        def cmd(meth, **pa):
            nid[0] += 1; me = nid[0]; ws.send(json.dumps({'id': me, 'method': meth, 'params': pa}))
            while True:
                r = json.loads(ws.recv())
                if r.get('id') == me: return r.get('result', r)
        def ev(js):
            return cmd('Runtime.evaluate', expression=js, returnByValue=True, awaitPromise=True)['result'].get('value')
        cmd('Network.enable'); cmd('Network.setCacheDisabled', cacheDisabled=True)
        base = 'http://127.0.0.1:%d/' % port
        def load(name, ls):
            cmd('Page.navigate', url=base + 'noopt.html')     # same origin first, so localStorage can be primed
            for _ in range(40):
                if ev('document.readyState') == 'complete': break
                time.sleep(0.1)
            ev('localStorage.clear();' + ''.join('localStorage.setItem(%s,%s);' % (json.dumps(k), json.dumps(v)) for k, v in ls.items()) + '1')
            cmd('Page.navigate', url=base + name)
            for _ in range(60):
                if ev('!!(window.ch && window.target)'): break
                time.sleep(0.1)
            time.sleep(0.3)
            return ev('JSON.stringify({cls: document.body.className, zoom: getComputedStyle(document.body).zoom, pz: window.pnbZoom ? pnbZoom() : null})')
        cases = [
            ({}, 'opt.html', '', '1', 'no prefs at all: Standard, no zoom'),
            ({'penumbra_user_density': 'compact'}, 'opt.html', 'density-compact', '0.9', 'a global default of Compact: zoom 0.9'),
            ({'penumbra_user_density': 'compact', 'penumbra_pref_density': json.dumps({'__landing__': 'easy-read'})}, 'opt.html', 'density-easy-read', '1.15', "the home screen's own pin beats the global default: Easy Read, 1.15"),
            ({'penumbra_user_density': 'compact', 'penumbra_pref_density': json.dumps({'__landing__': 'report-default'})}, 'opt.html', '', '1', "a landing pin of 'App default' means Standard even with a global Compact"),
            ({'penumbra_user_density': 'easy-read'}, 'noopt.html', '', '1', 'a body that did not opt in (repository page) is left alone'),
        ]
        for ls, name, want_cls, want_zoom, label in cases:
            r = json.loads(load(name, ls))
            has = re.search(r'\bdensity-(compact|easy-read)\b', r['cls'])
            ok(((has.group(0) if has else '') == want_cls) and r['zoom'] == want_zoom, label + '  [%s zoom=%s]' % (r['cls'], r['zoom']))
        for ls, z in (({'penumbra_user_density': 'compact'}, '0.9'), ({'penumbra_user_density': 'easy-read'}, '1.15'), ({}, '1')):
            load('opt.html', ls)
            hits = []
            for i in (1, 4, 6):
                tg = json.loads(ev('JSON.stringify(target(%d))' % i))
                cmd('Input.dispatchMouseEvent', type='mouseMoved', x=tg['x'], y=tg['y'])
                time.sleep(0.2)
                hits.append(json.loads(ev('JSON.stringify(ch.getActiveElements().map(function(a){return a.index}))')))
            ok(hits == [[1], [4], [6]], 'zoom %s: a real hover over bars 1, 4, 6 activates exactly those bars  %s' % (z, hits))
    finally:
        proc.kill()
        httpd.shutdown()
finally:
    time.sleep(0.5)
    if os.path.basename(work).startswith('pnb_dzadmin_'):
        shutil.rmtree(work, ignore_errors=True)

print(('GREEN' if failed == 0 else 'RED') + ' %d / %d' % (passed, failed))
sys.exit(0 if failed == 0 else 1)
