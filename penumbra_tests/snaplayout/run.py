# =============================================================================
# SNAPLAYOUT SUITE (2026-10-17) - leaving a snapshot view puts the live column layout back
# (main.js applyColumnLayoutByName, called by restoreOriginalData after
# rebuildTableFromMasterData re-renders every column in query order).
#   page half   harness.html (mk_harness.py, from colmenu's) + driver.js: the REAL main.js;
#               a 40-row snapshot loaded through loadSnapshotData, left through the caution
#               icon; run.py's hook exposes loadSnapshotData (window.__pnbSnap) and wraps
#               applyColumnLayoutByName (window.__ACL: ms; with __ACL_COUNT also tbody.rows
#               reads, cell moves in body rows, the body taken off the page)   L-<scn>-<check>, E-<scn>
# --control runs LIVE: the NEW checks red there, every other one green.
#
#   py -3 run.py [--main PATH_TO_main.js] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_sl_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request, importlib.util
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['snap', 'sbig']
CHK = {
    'snap': ['setup', 'restored', 'cellsFollow', 'hiddenFollow', 'restoreMinimal', 'stayAttached', 'noRowsWalk'],
    'sbig': ['setup', 'restored', 'cellsFollow', 'fast'],
}
# what this change brings (2026-10-17): the rest describe what live already does
NEW = {'L-snap-restoreMinimal', 'L-snap-stayAttached', 'L-snap-noRowsWalk', 'L-sbig-fast'}
ROWLOOP = ("            for (var row = tbody.firstElementChild; row; row = row.nextElementSibling) {\n"
           "                if (row.tagName !== 'TR') continue;\n"
           "                if (!_pnbApplyCellPlan(row, plan)) _pnbFullCellPass(row, desiredColIds, visibilityByColId);")
MUTANTS = {
    # every row takes the old full pass (all 21 cells re-appended)
    'm-full': ([("                if (!_pnbApplyCellPlan(row, plan)) _pnbFullCellPass(row, desiredColIds, visibilityByColId);",
                 "                _pnbFullCellPass(row, desiredColIds, visibilityByColId);")], ['L-snap-restoreMinimal'], ['snap']),
    # the rows walked as tbody.rows[r] again (quadratic)
    'm-rows': ([(ROWLOOP, ROWLOOP.replace("for (var row = tbody.firstElementChild; row; row = row.nextElementSibling) {",
                                          "for (var r = 0, row; (row = tbody.rows[r]); r++) {"))], ['L-snap-noRowsWalk', 'L-sbig-fast'], ['snap', 'sbig']),
    # the body off the page for every restore
    'm-detach': ([("            var detached = !plan.complete;\n            var parent = tbody.parentNode",
                   "            var detached = true;\n            var parent = tbody.parentNode")], ['L-snap-stayAttached'], ['snap']),
    # the plan never told which columns to hide
    'm-novis': ([("_pnbCellMovePlan(prevIds, prevVis, desiredColIds.map(String), visibilityByColId)",
                  "_pnbCellMovePlan(prevIds, prevVis, desiredColIds.map(String), {})")], ['L-snap-hiddenFollow'], ['snap']),
    # the plan built for the wrong order
    'm-order': ([("_pnbCellMovePlan(prevIds, prevVis, desiredColIds.map(String), visibilityByColId)",
                  "_pnbCellMovePlan(prevIds, prevVis, desiredColIds.map(String).reverse(), visibilityByColId)")], ['L-snap-cellsFollow'], ['snap']),
    # the first row skipped by the walk
    'm-skipfirst': ([(ROWLOOP, ROWLOOP.replace("var row = tbody.firstElementChild;", "var row = tbody.firstElementChild.nextElementSibling;"))],
                    ['L-snap-cellsFollow'], ['snap']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
main_path = opt('--main', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php')}
cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
if main_path and not control: cand['main'] = main_path
sys.path.insert(0, HERE)
import mk_harness
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

WRAP = r"""    function applyColumnLayoutByName(layout) {
        // (snaplayout test hook) time the call; with window.__ACL_COUNT count what it does
        var T = window.__ACL = { ms: 0, rowsGets: 0, moves: 0, detach: 0 };
        var cnt = !!window.__ACL_COUNT, d, ib, ac, rc;
        if (cnt) {
            d = Object.getOwnPropertyDescriptor(HTMLTableSectionElement.prototype, 'rows');
            ib = Node.prototype.insertBefore; ac = Node.prototype.appendChild; rc = Node.prototype.removeChild;
            Object.defineProperty(HTMLTableSectionElement.prototype, 'rows', { configurable: true, get: function () { T.rowsGets++; return d.get.call(this); } });
            var inBody = function (n) { return n && n.tagName === 'TR' && n.parentNode && n.parentNode.tagName === 'TBODY'; };
            Node.prototype.insertBefore = function (a, b) { if (inBody(this)) T.moves++; return ib.call(this, a, b); };
            Node.prototype.appendChild = function (a) { if (inBody(this)) T.moves++; return ac.call(this, a); };
            Node.prototype.removeChild = function (a) { if (a && a.tagName === 'TBODY') T.detach++; return rc.call(this, a); };
        }
        var t0 = performance.now();
        try { return __snapAclReal(layout); }
        finally {
            T.ms = performance.now() - t0;
            if (cnt) {
                Object.defineProperty(HTMLTableSectionElement.prototype, 'rows', d);
                Node.prototype.insertBefore = ib; Node.prototype.appendChild = ac; Node.prototype.removeChild = rc;
            }
        }
    }
    function __snapAclReal(layout) {"""

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    def one(old, new):
        nonlocal out
        if out.count(old) != 1: raise SystemExit('hook anchor x%d: %r' % (out.count(old), old[:60]))
        out = out.replace(old, new)
    one('    function hideLoading() {', '    function hideLoading() {\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
    one('    function applyColumnLayoutByName(layout) {', WRAP)
    one('    function restoreOriginalData() {', '    window.__pnbSnap = { load: function (s) { return loadSnapshotData(s); } };\n    function restoreOriginalData() {')
    return out
def mutate(texts, name):
    t = dict(texts)
    for old, new in MUTANTS[name][0]:
        crlf = lambda x: x.replace('\n', '\r\n')
        if t['main'].count(old) != 1 and t['main'].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t['main'].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, t['main'].count(old), old[:90]))
        t['main'] = t['main'].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_sl_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 400:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (400 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    import re
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, ('&rows=' + os.environ['PNB_ROWS']) if (s == 'sbig' and os.environ.get('PNB_ROWS')) else ''))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600] + '   info %s' % json.dumps(r.get('info'))[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        info = json.dumps(r.get('info'))
        print('  info %s: %s' % (s, info[:900]))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s' % v))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            write_stage(mutate(texts, m))
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            dead = [a[2:] for a in red if a.startswith('F-')]
            good = not [x for x in must if x not in red and not [d for d in dead if x.startswith('L-' + d + '-')]]
            okc += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            old_red = sorted(a for a in red if a not in NEW)
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
