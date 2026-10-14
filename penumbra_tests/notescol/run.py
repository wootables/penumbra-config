# =============================================================================
# NOTES COLUMN SUITE "notescol" - BROWSER HALF (2026-10-14)
#
# Row notes as a real column: the Notes cell previews the newest note; with the
# report's "Include notes in downloads and emails" (viewOptions.journalNotesExport,
# off by default) copies, downloads and emails carry the notes as text; and the
# author edits their own newest note from the note card.
#
# Each scenario boots the REAL main.js through the real run path (stubbed query.php
# + manage_journal.php) on the jrowfeat suite's 36-row fixture, with the View Options
# journal panel lifted from the index.php under test. driver.js records the asserts:
#   V-*  the cell preview + everything as before while the switch is off
#   X-*  the switch on: journalExportCell, CSV, JSON, Copy as HTML, parity with the server
#   T-*  the switch: saved only when on, only with row notes; restored
#   D-*  edit your own newest note (Edit button, mode, post, preview, refusal, cancel)
#   E-*  no page errors
#
#   py -3 run.py                     the live build (js\main.js, index.php, css\main.css, journal_export.php)
#   py -3 run.py --app DIR           a build laid out like the app (the stage before the deploy)
#   py -3 run.py --control --app DIR the build BEFORE the change: exactly CONTROL_RED fails
#   py -3 run.py --mutant NAME / --mutants   single-point reverts of the build (mutants.json)
#   --scn a,b    a subset;   --keep keeps the staging dir
#
# The X-parity assert compares main.js journalNotesFlatten() with journal_export.php's on one
# fixture: server.php --flat-out writes the server's string first.
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
SCN = ['panel', 'panelreopen', 'panelnone', 'cardup', 'xlsx', 'cellcopy', 'cellcopyon', 'hovercol', 'preview', 'resize', 'wrap', 'search', 'copycol', 'copycolon', 'exportcsv', 'setup', 'restore', 'edit', 'editnone', 'edit409', 'editcancel']
QS = {'panelreopen': '&me=lee', 'panel': '&me=lee', 'panelnone': '&me=pat', 'cardup': '&me=lee', 'xlsx': '&nx=1', 'cellcopyon': '&nx=1', 'copycolon': '&nx=1', 'preview': '&rx=1', 'resize': '&rx=1', 'wrap': '&rx=1', 'exportcsv': '&nx=1', 'restore': '&nx=1', 'edit': '&me=lee', 'editnone': '&me=pat', 'edit409': '&me=lee', 'editcancel': '&me=lee'}
EXPECT = {
    'preview': ['V-preview', 'V-tip', 'V-preview-file', 'V-nopreview', 'V-oneline', 'V-switch', 'V-off-out', 'V-off-skipfn', 'V-off-cell', 'V-off-csv', 'V-off-html'],
    'resize': ['W-clip', 'W-ellipsis', 'W-icon', 'W-wide'],
    'wrap': ['R-compact', 'R-hover', 'R-grow', 'R-grow-narrow', 'R-back'],
    'search': ['S-word', 'S-word-not', 'S-col-text', 'S-col-not', 'S-col-regex', 'S-col-count', 'S-col-empty', 'S-hidden'],
    'copycol': ['C-off'],
    'copycolon': ['C-on'],
    'panel': ['P-buttons', 'P-hint', 'P-up', 'P-save', 'P-after', 'P-up-typed', 'P-row', 'P-row-preview'],
    'panelreopen': ['P-reopen'],
    'panelnone': ['P-none'],
    'cardup': ['U-hint', 'U-up', 'U-typed'],
    'xlsx': ['K-xlsx-on'],
    'cellcopy': ['K-cell-off'],
    'cellcopyon': ['K-cell-on'],
    'hovercol': ['K-hover'],
    'exportcsv': ['X-out', 'X-skipfn', 'X-cell', 'X-csv-head', 'X-csv-cell', 'X-json', 'X-html', 'X-html-nobtn', 'X-parity'],
    'setup': ['T-default', 'T-on', 'T-on-live', 'T-rownotes-off', 'T-rownotes-back', 'T-off'],
    'restore': ['T-restore'],
    'edit': ['D-button', 'D-mode', 'D-post', 'D-after', 'D-preview', 'D-count'],
    'editnone': ['D-none'],
    'edit409': ['D-409'],
    'editcancel': ['D-cancel'],
}
# The build before the change (frozen from its first control run): everything new fails; the
# "switch off = as before" asserts (V-nopreview, V-off-csv, V-off-html) pass, which is what
# proves the fixture and the read-out are not the change.
CONTROL_RED = ['P-reopen', 'E-panelreopen', 'P-buttons', 'P-hint', 'P-up', 'P-save', 'P-after', 'P-up-typed', 'P-row', 'P-row-preview', 'E-panel', 'U-hint', 'U-up', 'U-typed', 'E-cardup', 'K-xlsx-on', 'E-xlsx', 'K-cell-on', 'K-cell-off', 'K-hover', 'E-hovercol', 'S-word', 'S-word-not', 'S-col-text', 'S-col-not', 'S-col-regex', 'S-hidden', 'C-on', 'R-compact', 'R-hover', 'R-grow', 'R-grow-narrow', 'R-back', 'E-wrap', 'E-resize', 'W-clip', 'W-ellipsis', 'W-icon', 'W-wide', 'V-preview', 'V-tip', 'V-preview-file', 'V-oneline', 'V-switch', 'V-off-out', 'V-off-skipfn', 'E-preview', 'X-out', 'X-skipfn', 'X-cell', 'X-csv-head', 'X-csv-cell', 'X-json', 'X-html', 'X-html-nobtn', 'X-parity', 'E-exportcsv', 'T-default', 'T-on', 'T-on-live', 'T-rownotes-off', 'T-rownotes-back', 'T-off', 'E-setup', 'T-restore', 'E-restore', 'D-button', 'D-mode', 'D-post', 'D-after', 'D-preview', 'D-count', 'E-edit', 'E-editnone', 'D-409', 'E-edit409', 'D-cancel', 'E-editcancel']
# (the E-* rows: the old build has no penumbraNotesColSkipped for the hook to export)

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
        old = old.replace('\n', '\r\n'); new = new.replace('\n', '\r\n')
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_nc_')
if not re.search(r'pnb_nc_[^\\/]+$', stage): raise SystemExit('bad stage dir')
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
# the server's flattening of the parity fixture (from the build's journal_export.php)
srv_out = subprocess.run([PHP, '-n', '-d', 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext', '-d', 'extension=mbstring',
                          os.path.join(HERE, 'server.php'), '--app', app_dir.replace('\\', '/'), '--flat-out', os.path.join(stage, 'parity.json')] + (['--control'] if control else []),
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
