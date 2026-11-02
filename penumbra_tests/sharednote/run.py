# =============================================================================
# SHARED NOTE SUITE "sharednote" - BROWSER HALF (2026-11-01)
#
# The Notes column's second type (viewOptions.journalNotesMode 'shared', ?mode=shared): ONE note a table row,
# free text anyone edits from the text it holds. The REAL main.js through the real run path on the notescol /
# jrowfeat 36-row fixture (stubbed query.php + manage_journal.php keeping a Shared note's rules: an edit only
# from its base_text, else 409 with what it holds; an add on a row that has one, 409). driver.js asserts:
#   L-* the cell   K-* the note card (view, Edit, Save, Escape / Cancel, a draft)   N-* a row's first note
#   F-* someone saved first   R-* clearing   X-* copies / CSV / search + parity with journal_export.php
#   T-* the View Options type   I-* the cards' panel API   C-* Discussion as before   E-* no page errors
#
#   py -3 run.py [--app DIR]               the build (default: the live webroot)
#   py -3 run.py --control                 the LIVE build as the one before the change: exactly CONTROL_RED fails
#   py -3 run.py --app DIR --mutants | --mutant NAME   single-point reverts of the build (mutants.json)
#   --scn a,b    a subset;   --keep keeps the staging dir
# X-parity: server.php --text-out writes journal_export.php's journalSharedNoteText() of one fixture first.
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
SCN = ['cell', 'card', 'cancel', 'blank', 'mention', 'files', 'filesonly', 'paste', 'layout', 'smallcard', 'conflict', 'clear', 'export', 'setup', 'restore', 'inline', 'discussion']
SH = '&mode=shared'
QS = {'cell': SH, 'card': SH + '&me=kim', 'cancel': SH + '&me=kim', 'blank': SH + '&me=kim', 'mention': SH + '&me=kim', 'files': SH + '&me=kim', 'filesonly': SH + '&me=kim', 'paste': SH + '&me=kim', 'layout': '&me=kim', 'smallcard': SH + '&me=kim', 'conflict': SH + '&me=kim', 'clear': SH + '&me=kim',
      'export': SH + '&nx=1', 'setup': '', 'restore': SH, 'inline': SH + '&me=kim', 'discussion': ''}
EXPECT = {
    'cell': ['L-preview', 'L-nocount', 'L-tip', 'L-empty'],
    'card': ['K-view', 'K-meta', 'K-editbtn', 'K-box', 'K-post', 'K-after', 'K-cell'],
    'cancel': ['K-esc', 'K-esc-focus', 'K-draft', 'K-cancel'],
    'blank': ['N-open', 'N-post', 'N-cell'],
    'mention': ['M-field', 'M-post', 'M-view', 'M-clock'],   # (sharedmention, 2026-11-01)
    'files': ['G-row', 'G-staged', 'G-unpick', 'G-post', 'G-set', 'G-cell', 'G-remove'],   # (sharedfiles, 2026-11-01)
    'filesonly': ['H-first', 'H-set', 'H-cell'],
    'paste': ['G-paste', 'G-drop', 'G-fail'],
    'layout': ['C-layout', 'C-layout-card', 'G-layout-card', 'C-layout-medium', 'G-layout-medium'],   # (cfb8: -medium)
    'smallcard': ['S-standard', 'S-compact', 'S-large', 'S-compose', 'S-dblclick'],   # (sharedcard, 2026-11-01)
    'conflict': ['F-word', 'F-theirs', 'F-again'],
    'clear': ['R-post', 'R-after'],
    'export': ['X-text', 'X-csv', 'X-parity', 'X-search'],
    'setup': ['T-default', 'T-on', 'T-live', 'T-off', 'T-needs-notes'],
    'restore': ['T-restore'],
    'inline': ['I-html', 'I-compose', 'I-draft', 'I-escape'],
    'discussion': ['C-cell', 'C-card', 'C-flat'],
}
# The build before the change (frozen from its first control run): every Shared-note assert fails; the
# Discussion rows (C-*) pass - the fixture and the read-out are not the change.
CONTROL_RED = ['M-field', 'M-post', 'M-view', 'M-clock', 'E-mention', 'L-preview', 'L-nocount', 'L-tip', 'L-empty', 'K-view', 'K-meta', 'K-editbtn', 'K-box', 'K-post', 'K-after', 'K-cell', 'E-card', 'K-esc', 'K-esc-focus', 'K-draft', 'K-cancel', 'E-cancel', 'N-open', 'N-post', 'N-cell', 'E-blank', 'F-word', 'F-theirs', 'F-again', 'E-conflict', 'R-post', 'R-after', 'E-clear', 'X-text', 'X-csv', 'X-parity', 'X-search', 'T-default', 'T-on', 'T-live', 'T-off', 'T-needs-notes', 'T-restore', 'I-html', 'I-compose', 'I-draft', 'I-escape', 'E-inline']
# (E-cell / E-export / E-setup / E-restore stay green there: those scenarios end on a failed assert, not a page error)

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
# (sharedmention, 2026-11-01) --control-mention: the LIVE build of f03baf9 (a textarea, no mention field) as the one before
control_m = flag('--control-mention')
# (sharedfiles, 2026-11-01) --control-files: the LIVE build of a9119d1 (no files on a Shared note, Attach under the box)
control_f = flag('--control-files')
# (sharedcard, 2026-11-01) --control-card: the LIVE build of 004165e (Edit on a small card edits in place)
control_c = flag('--control-card')
control_8 = flag('--control-cfb8')   # (cfb8, 2026-11-01) the LIVE build of 4bbafcb (a Medium card's buttons beside the box)
if control_c: control = True
if control_c: CONTROL_RED = ['S-standard', 'S-compact', 'S-compose', 'S-dblclick']   # frozen from its first run (004165e live)
if control_8: control = True
if control_8: CONTROL_RED = ['C-layout-medium', 'G-layout-medium']
if control_f: control = True
if control_f: CONTROL_RED = ['G-row', 'G-staged', 'G-unpick', 'G-post', 'G-set', 'G-cell', 'G-remove', 'E-files', 'H-first', 'H-set', 'H-cell', 'E-filesonly', 'G-paste', 'G-drop', 'G-fail', 'C-layout-card', 'G-layout-card']   # frozen from its first run (a9119d1 live)
if control_m: control = True
if control_m: CONTROL_RED = ['M-field', 'M-post', 'M-view', 'M-clock']   # frozen from its first run (f03baf9 live)
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
        old = old.replace('\n', '\r\n'); new = new.replace('\n', '\r\n')
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_snb_')
if not re.search(r'pnb_snb_[^\\/]+$', stage): raise SystemExit('bad stage dir')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
# round 4: ExcelJS where createXlsxWorkbook() loads it (js/...), and the cell-selection module of the build
os.makedirs(os.path.join(stage, 'js'), exist_ok=True)
shutil.copyfile(os.path.join(APP, 'js', 'exceljs-4.4.0.min.js'), os.path.join(stage, 'js', 'exceljs-4.4.0.min.js'))
_csel = os.path.join(app_dir, 'js', 'penumbra_cellsel.js')
# round 7: the journal panel's module and stylesheet of the build
for _jf, _jdst in (('js/penumbra_journal.js', 'penumbra_journal_nc.js'), ('css/penumbra_journal.css', 'penumbra_journal.css')):
    _jsrc = os.path.join(app_dir, *_jf.split('/'))
    shutil.copyfile(_jsrc if os.path.exists(_jsrc) else os.path.join(APP, *_jf.split('/')), os.path.join(stage, _jdst))
journal_text = read_b(os.path.join(stage, 'penumbra_journal_nc.js'))   # (2026-10-29) a mutant may take the journal panel's file too ('journal')
shutil.copyfile(_csel if os.path.exists(_csel) else os.path.join(APP, 'js', 'penumbra_cellsel.js'), os.path.join(stage, 'penumbra_cellsel.js'))
css_text = read_b(os.path.join(app_dir, 'css', 'main.css'))
cards_css_text = read_b(os.path.join(app_dir, 'css', 'penumbra_cards.css'))   # (sharedfiles) the cards' notes panel; a mutant may take it ('cardscss')
open(os.path.join(stage, 'penumbra_cards.css'), 'wb').write(cards_css_text.encode('utf-8', 'surrogateescape'))
open(os.path.join(stage, 'main.css'), 'wb').write(css_text.encode('utf-8', 'surrogateescape'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
harness = open(os.path.join(HERE, 'harness.html'), encoding='utf-8').read()
if harness.count('<!--JR_VIEW_OPTIONS-->') != 1: raise SystemExit('harness: splice marker missing')
# the server's flattening of the parity fixture (from the build's journal_export.php)
srv_out = subprocess.run([PHP, '-n', '-d', 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext', '-d', 'extension=mbstring',
                          os.path.join(HERE, 'server.php'), '--app', app_dir.replace('\\', '/'), '--text-out', os.path.join(stage, 'parity.json')],
                         capture_output=True, text=True, encoding='utf-8', errors='replace')
if not os.path.exists(os.path.join(stage, 'parity.json')):
    open(os.path.join(stage, 'parity.json'), 'w').write('null')

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
    print('build: %s%s' % (app_dir, '   (CONTROL: the build before the change)' if control else ''))
    names = [s for s in SCN if not scn_arg or s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            edits, must, mscn = MUTANTS[m]
            sc = [s for s in (mscn or names) if s in names]
            open(os.path.join(stage, 'main.css'), 'wb').write(mutate(css_text, m, 'css').encode('utf-8', 'surrogateescape'))
            open(os.path.join(stage, 'penumbra_cards.css'), 'wb').write(mutate(cards_css_text, m, 'cardscss').encode('utf-8', 'surrogateescape'))
            open(os.path.join(stage, 'penumbra_journal_nc.js'), 'wb').write(mutate(journal_text, m, 'journal').encode('utf-8', 'surrogateescape'))
            res = evaluate(run_build(mutate(cand_text, m), index_text, sc), sc)
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
        res = evaluate(run_build(cand_text, index_text, names), names)
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
                want = [a for a in CONTROL_RED if any(a in EXPECT[s] or a == 'E-' + s for s in names)]
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
