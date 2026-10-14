# =============================================================================
# PRINTX SUITE (2026-10-10) - the print sweep: data bars print, the tables size
# their columns on paper, help icons / chart cog stay off, a dark theme's pivot
# Grand Total and charts print readably, the "Printed ..." stamp, and the
# Download dialog's Print option.
#   page half   harness.html (mk_harness.py, from shade's) + driver.js; run.py puts
#               the page in PRINT media (Emulation.setEmulatedMedia) when the driver
#               is ready, so every check reads the styles as they print  L-*, E-*
#   source      index.php's Print option + its tip, main.js's case 'print'     S-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['xflat', 'pdark']
SCN_Q = {'xflat': '&shade=V_AMOUNT%7Cbar&shade=H_NUM'}
CHK = {
    'xflat': ['stampText', 'barPrints', 'barExact', 'fillPrints', 'plainWhite', 'autoLayout', 'iconsGone', 'stampShown', 'headerGrey'],
    'pdark': ['gtLabel', 'canvasCard', 'darkCellsWhite'],
}
MUTANTS = {
    # css (main.css mixes endings: anchors carry none)
    'c-barwhite': ([('css', ':not([style*="background-color"]):not([style*="background-image"]) {', ':not([style*="background-color"]) {')], ['L-xflat-barPrints'], ['xflat']),
    'c-barexact': ([('css', '    td[style*="background-color"], td[style*="background-image"] {', '    td[style*="background-color"] {')], ['L-xflat-barExact'], ['xflat']),
    'c-bump': ([('css', '    th:not(#pnb-print):not(#pnb-print-2), td:not(#pnb-print):not(#pnb-print-2):not([style*="background-color"]):not([style*="background-image"]) {',
                 '    th:not(#pnb-print), td:not(#pnb-print):not([style*="background-color"]):not([style*="background-image"]) {')], ['L-pdark-gtLabel'], ['pdark']),
    'c-layout': ([('css', '        table-layout: auto !important;', '        table-layout: fixed !important;')], ['L-xflat-autoLayout'], ['xflat']),
    'c-icons': ([('css', '    .tab-help-icon, .bld-help-icon, .sp-help-icon, #searchHelpIcon, .chart-settings-cog {', '    .bld-help-icon {')], ['L-xflat-iconsGone'], ['xflat']),
    'c-card': ([('css', '    body.is-dark canvas {', '    body.is-dark canvas.never {')], ['L-pdark-canvasCard'], ['pdark']),
    'c-stamp': ([('css', '#pnbPrintStamp { display: none; }', '')], ['L-xflat-stampShown'], ['xflat']),
    # js (CRLF)
    'j-stamp': ([('main', "                    ? onSheet.toLocaleString() + ' of ' + $all.length.toLocaleString() + ' rows (this page only)'\r\n",
                  "                    ? $all.length.toLocaleString() + ' rows'\r\n")], ['L-xflat-stampText'], ['xflat']),
    'j-print': ([('main', "                setTimeout(function () { window.print(); }, 150);\r\n", "")], ['S-printCase'], []),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
scn_only = opt('--scn', None)
if scn_only: SCN = [scn_only]
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'css': os.path.join('css', 'main.css'), 'idx': 'index.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_px_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
    def ev(x): return call('Runtime.evaluate', {'expression': x, 'returnByValue': True}).get('result', {}).get('value')
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time(); printed = False
        while time.time() - t0 < 300:
            time.sleep(0.25)
            if not printed and ev('window.__PX_READY === true'):
                call('Emulation.setEmulatedMedia', {'media': 'print'})
                ev('window.__PX_PRINT = true')
                printed = True
            v = ev('window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))

def run_source(texts):
    idx, m = texts['idx'], texts['main']
    out = []
    out.append(('S-printOption', '<input type="radio" name="downloadFormat" value="print">' in idx and '<code># 1-200</code> in the search box for the first 200 rows' in idx, ''))
    out.append(('S-stampEl', '<div id="pnbPrintStamp" aria-hidden="true"></div>' in idx and idx.index('id="pnbPrintStamp"') < idx.index('<div id="reportHeaderContainer"'), ''))
    out.append(('S-printCase', "case 'print':" in m and "setTimeout(function () { window.print(); }, 150);" in m, ''))
    return out

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, SCN_Q.get(s, '')))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:400]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_source(t) + (run_browser(scns) if scns else [])
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_source(texts) + run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:400]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # hold before the sweep: fills, plain cells, the grey header (the 10-02 pass).
            # (A dark pivot's ordinary cells did NOT: one id bump lost to the theme too.)
            absent = {'L-xflat-fillPrints', 'L-xflat-plainWhite', 'L-xflat-headerGrey'}
            sane = [a for a, passed, _ in res if passed and not a.startswith('E-') and a not in absent]
            print('CONTROL: %d checks red (expected); checks that hold WITHOUT the change: %s' % (f, ' '.join(sane) or 'none'))
            print('RESULT: GREEN' if not sane and f > 0 else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
