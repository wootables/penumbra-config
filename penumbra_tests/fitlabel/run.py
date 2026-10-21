# =============================================================================
# FITLABEL SUITE (2026-10-20 d) - Fit's notice names a column as it shows (penumbra_colwidths.js
# fitOne): a journal column's heading carries its internal name, and the notice read "__JOURNAL_NOTES
# fitted to its content". The REAL main.js + js/penumbra_colwidths.js on the colmenu harness
# (colmenu's mk_harness.py, loaded by path: its files are read, never written) + driver.js here.
#   py -3 run.py [--stage DIR] [--control] [--mutants]
# Headless Edge over CDP; stages into %TEMP%\pnb_fl_*; writes nothing to the webroot.
# =============================================================================
import importlib.util, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
COLMENU = os.path.join(HERE, '..', 'colmenu')
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(COLMENU, 'mk_harness.py'))
mk_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mk_harness)
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['fitlbl']
CHK = {'fitlbl': ['noteLabel', 'dataLabel']}
NEW = {'L-fitlbl-noteLabel'}
MUTANTS = {
    # the notice reads the heading's internal name again
    'f-raw': ([('colw', "offerUndo((drill ? c.name : (dn ? host.friendly(dn) : 'Column')) + ' fitted to its content'",
                "offerUndo((drill ? c.name : (dn || 'Column')) + ' fitted to its content'")], ['L-fitlbl-noteLabel']),
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
all_mutants = flag('--mutants')
control = flag('--control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php')}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times" % (name, f, t[f].count(old)))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_fl_')
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
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

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

def run_browser():
    out = []
    for s in SCN:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:500]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants:
        okc = bad = 0
        for m in MUTANTS:
            write_stage(mutate(texts, m))
            res = run_browser()
            red = [a for a, p, _ in res if not p]
            good = not [x for x in MUTANTS[m][1] if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(MUTANTS[m][1]), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser()
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-24s %s' % ('PASS' if passed else 'FAIL', a, d[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW and not a.startswith('F-')]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(green_new) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(red_old) or 'none'))
            print('RESULT: GREEN' if not green_new and not red_old else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
