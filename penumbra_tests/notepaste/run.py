# =============================================================================
# NOTE IMAGE PASTE SUITE "notepaste" (2026-10-21)
#
# A pasted image (screenshot, "Copy image") in a note's text field is attached like a
# dropped file; the image hover preview is up to 900 x 700 (70% of the window).
# BROWSER HALF ONLY: the REAL main.js + main.css on notesfresh's harness (the notescol
# fixture); driver.js records P-* the paste, C-* the preview size, E-* no page errors.
#
#   py -3 run.py                     the live build
#   py -3 run.py --app DIR           a build laid out like the app (the stage)
#   py -3 run.py --control --app DIR the build BEFORE the change: exactly CONTROL_RED fails
#   py -3 run.py --mutant NAME / --mutants   single-point reverts (mutants.json)
#   --scn a,b    a subset;   --keep keeps the staging dir
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['shot', 'named', 'jpeg', 'mixed', 'text', 'big', 'svg', 'edit', 'pop']
QS = {}
EXPECT = {
    'shot': ['P-shot-file', 'P-shot-pill', 'P-shot-notext'],
    'named': ['P-named'], 'jpeg': ['P-jpeg'],
    'mixed': ['P-mixed-text', 'P-mixed-nofile'],
    'text': ['P-text'], 'big': ['P-big'], 'svg': ['P-svg'], 'edit': ['P-edit'],
    'pop': ['C-pop-tall', 'C-pop-wide'],
}
SRV_EXPECT = []   # no server half: the upload path is the Attach button's own
# The build before the change: an image paste did nothing (text only), the preview was 340 px.
# Green on it: plain text and text-beside-an-image paste as text (nothing changes there).
CONTROL_RED = ['P-shot-file', 'P-shot-pill', 'P-named', 'P-jpeg', 'P-big', 'P-svg', 'P-edit', 'C-pop-tall', 'C-pop-wide']

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
# An edit with a third element "css" applies to main.css instead of main.js (2026-10-14).
MUTANTS = {k: ([tuple(e) for e in v['edits']], v['must'], v['scn']) for k, v in json.load(open(os.path.join(HERE, 'mutants.json'), encoding='utf-8')).items()} \
    if os.path.exists(os.path.join(HERE, 'mutants.json')) else {}

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def lift_panel(index_text):
    a = index_text.find('<div id="journalRowConfig"')
    if a < 0: raise SystemExit('index.php: no #journalRowConfig')
    depth, i = 0, a
    while True:
        o = index_text.find('<div', i); c = index_text.find('</div>', i)
        if c < 0: raise SystemExit('index.php: #journalRowConfig never closes')
        if o != -1 and o < c: depth += 1; i = o + 4
        else:
            depth -= 1; i = c + 6
            if depth == 0: break
    block = index_text[a:i]
    if '<?' in block: raise SystemExit('index.php: PHP inside #journalRowConfig - the lift needs updating')
    return block
def lift_div(index_text, marker):
    a = index_text.find('<div id="%s"' % marker)
    if a < 0: raise SystemExit('index.php: no #' + marker)
    depth, i = 0, a
    while True:
        o = index_text.find('<div', i); c = index_text.find('</div>', i)
        if c < 0: raise SystemExit('index.php: #%s never closes' % marker)
        if o != -1 and o < c: depth += 1; i = o + 4
        else:
            depth -= 1; i = c + 6
            if depth == 0: break
    return index_text[a:i]

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['getExportData', 'buildStateObject', 'generateWysiwygHtml', 'penumbraNotesColSkipped', 'runTableSearch', 'createXlsxWorkbook']
    h = ('\r\n;try { window.__JR = {}; } catch (e) { window.__JR_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__JR[k] = eval(k); } catch (e) { (window.__JR_MISSING = window.__JR_MISSING || []).push(k); } }); } catch (e) { window.__JR_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__JR_HIDES = (window.__JR_HIDES || 0) + 1;\r\n')
def mutate(src, name, which='js'):
    for e in MUTANTS[name][0]:
        old, new = e[0], e[1]
        if (e[2] if len(e) > 2 else 'js') != which: continue
        if src.count(old) != 1:   # the file's own line endings: LF as written, else CRLF
            old = old.replace('\n', '\r\n'); new = new.replace('\n', '\r\n')
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_np_')
if not re.search(r'pnb_np_[^\\/]+$', stage): raise SystemExit('bad stage dir')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
# round 4: ExcelJS where createXlsxWorkbook() loads it (js/...), and the cell-selection module of the build
os.makedirs(os.path.join(stage, 'js'), exist_ok=True)
shutil.copyfile(os.path.join(APP, 'js', 'exceljs-4.4.0.min.js'), os.path.join(stage, 'js', 'exceljs-4.4.0.min.js'))
_csel = os.path.join(app_dir, 'js', 'penumbra_cellsel.js')
# round 7: the journal panel's module and stylesheet of the build
for _jf, _jdst in (('js/penumbra_journal.js', 'penumbra_journal_nc.js'), ('css/penumbra_journal.css', 'penumbra_journal.css')):
    _jsrc = os.path.join(app_dir, *_jf.split('/'))
    shutil.copyfile(_jsrc if os.path.exists(_jsrc) else os.path.join(APP, *_jf.split('/')), os.path.join(stage, _jdst))
shutil.copyfile(_csel if os.path.exists(_csel) else os.path.join(APP, 'js', 'penumbra_cellsel.js'), os.path.join(stage, 'penumbra_cellsel.js'))
css_text = read_b(os.path.join(app_dir, 'css', 'main.css'))
open(os.path.join(stage, 'main.css'), 'wb').write(css_text.encode('utf-8', 'surrogateescape'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
harness = open(os.path.join(HERE, 'harness.html'), encoding='utf-8').read()
if harness.count('<!--JR_VIEW_OPTIONS-->') != 1: raise SystemExit('harness: splice marker missing')
def server_half(app, mutant_src=None):
    """manage_journal.php's S-* checks; mutant_src = a mutated manage_journal.php to check instead."""
    tgt = os.path.join(app, 'manage_journal.php')
    if mutant_src is not None:
        tgt = os.path.join(stage, 'manage_journal_m.php'); open(tgt, 'wb').write(mutant_src.encode('utf-8', 'surrogateescape'))
    r = subprocess.run([PHP, '-n', os.path.join(HERE, 'server_check.php'), tgt], capture_output=True, text=True, encoding='utf-8', errors='replace')
    got = {}
    for line in r.stdout.splitlines():
        try: a = json.loads(line); got[a['id']] = a
        except Exception: pass
    out = []
    for aid in SRV_EXPECT:
        out.append((aid, got[aid]['ok'], got[aid]['detail']) if aid in got else (aid, False, 'NOT RECORDED ' + (r.stdout + r.stderr)[-300:]))
    return out

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(scn):
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
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?id=jrfix&scn=%s%s' % (hp, scn, QS.get(scn, ''))})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__JRDONE ? JSON.stringify(window.__JRRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text, index_text, scns):
    open(os.path.join(stage, 'main_jr.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    _h = harness.replace('<!--JR_VIEW_OPTIONS-->', lift_panel(index_text))
    if '<!--NC_JOURNAL_LIGHTBOX-->' in _h: _h = _h.replace('<!--NC_JOURNAL_LIGHTBOX-->', lift_div(index_text, 'journalLightbox'))
    open(os.path.join(stage, 'harness.html'), 'w', encoding='utf-8').write(_h)
    return {s: run_page(s) for s in scns}

def evaluate(res, scns):
    out = []
    for s in scns:
        r = res.get(s, {})
        got = {a['id']: a for a in (r.get('asserts') or [])}
        for aid in EXPECT[s]:
            if aid in got: out.append((aid, got[aid]['ok'], got[aid]['detail']))
            else: out.append((aid, False, 'NOT RECORDED' + (' | fatal: ' + (r.get('fatal') or '')[:300] if r.get('fatal') else '')))
        for aid, a in got.items():
            if aid not in EXPECT[s]: out.append((aid, a['ok'], 'UNEXPECTED ID ' + a['detail']))
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing') and not r.get('fatal'),
                    'errors %s hook %s missing %s fatal %s' % (r.get('errors'), r.get('hookErr'), r.get('missing'), (r.get('fatal') or '')[:200])))
    return out

try:
    cand_text = read_b(os.path.join(app_dir, 'js', 'main.js'))
    index_text = read_b(os.path.join(app_dir, 'index.php'))
    php_text = read_b(os.path.join(app_dir, 'manage_journal.php'))
    print('build: %s%s' % (app_dir, '   (CONTROL: the build before the change)' if control else ''))
    names = [s for s in SCN if not scn_arg or s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            edits, must, mscn = MUTANTS[m]
            sc = [s for s in (mscn or names) if s in names]
            kinds = set((e[2] if len(e) > 2 else 'js') for e in edits)
            res = []
            if kinds & {'js', 'css'}:
                open(os.path.join(stage, 'main.css'), 'wb').write(mutate(css_text, m, 'css').encode('utf-8', 'surrogateescape'))
                res += evaluate(run_build(mutate(cand_text, m), index_text, sc), sc)
            if 'php' in kinds:
                res += server_half(app_dir, mutate(php_text, m, 'php'))
            red = [a for a, p, _ in res if not p]
            if must is None:
                print('  EXPLORE mutant %-12s red: %s' % (m, ' '.join(red) or '(nothing)'))
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
                bad += 1; continue
            good = sorted(red) == sorted(must)
            ok += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must) or '(nothing)', ' '.join(red)))
            if not good:
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(cand_text, index_text, names), names) + server_half(app_dir)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-16s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            if CONTROL_RED is None:
                print('CONTROL: not frozen yet - red set: %s' % ' '.join(failed)); print('RESULT: RED')
            else:
                want = [a for a in CONTROL_RED if a in SRV_EXPECT or any(a in EXPECT[s] or a == 'E-' + s for s in names)]
                print('CONTROL: %s' % ('as expected' if sorted(failed) == sorted(want) else 'NOT as expected (want red: %s)' % ' '.join(want)))
                print('RESULT: GREEN' if sorted(failed) == sorted(want) else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
