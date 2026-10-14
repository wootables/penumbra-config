# =============================================================================
# COMPARISON-FOOTER SUITE (2026-09-30)
#
# While a snapshot comparison is on screen, penumbraRefreshSummaryFooters()
# recomputes the diff's footers IN PLACE (_penumbraRecomputeFooterInPlace) -
# on a footer badge pick, on the settings panel's badge SHOW toggle, and on a
# journal-summary refresh. That function called
# penumbraSummaryAccumulator(type, col) with `col` never declared (since the
# 2026-08-02 journal-toggle sweep), so every call threw a ReferenceError and the
# diff's footers never changed. Behind the throw it had two more defects, which
# the obvious one-line fix would have put live:
#   - it read each cell's column NAME from the header at the cell's INDEX, but
#     the diff's <thead> has a hidden __SNAP_TYPE column its <tfoot> has no cell
#     for: every cell took the name - and so the summary type - of the column
#     to its left;
#   - it summed textContent, which on a modified cell is its was/now views run
#     together (NaN), so modified cells dropped out of the summary.
# The fix reads the cell's own data-sum-col, reads cells through
# _readComparisonCellText (as the search's recomputeWrapperTotals does), and
# re-labels the footer (TOTALS / SUMMARY) as a fresh render would.
#
#   browser half only: the REAL js\main.js (ready closure unwrapped, window.__CF
#   export hook) renders a REAL comparison of a 6-row report against a 6-row
#   snapshot (keys: ID; New/Removed/Modified/Unchanged, 2 rows each), and the
#   driver clicks the footer badge and a menu option like a user - see driver.js:
#     live       F fixture  B badge pick  R = a fresh render  T badge SHOW toggle
#     numhidden  H the '#' column hidden (label relocated to the first plain cell)
#     ab         A A-vs-B + an in-place search (parity with recomputeWrapperTotals)
#
#   py -3 run.py                   live js\main.js          EXPECTED: live 12/0, numhidden 6/0, ab 7/0 (TOTAL 25/0)
#   py -3 run.py --control         the pre-fix build        EXPECTED: 14/11, RED on exactly B1 B2 B4 B5 R1 T1 T2 H4 H5 A4 A6
#                                  (newest js\main.js.bak-*-cmpfoot, made by the deploy; or --main <pre-fix copy>)
#   py -3 run.py --main F          any other copy (a stage build, a variant)
#   py -3 run.py --mutant NAME     ONE edit of the fixed build put back/broken
#   py -3 run.py --mutants         every mutant, each checked against the asserts it MUST turn red
#   --modes live,ab                a subset of pages; --keep keeps the staging dir
#
#   Measured 2026-09-30 on the stage: 25/0; control 14/11 (exactly those 11); mutants 4/4 bite -
#   oneliner B2 B3 B4 B5 R1 T1 T2 H4 A4, textcontent B4 R1 T1 T2 A4 A5, nolabel B5 R1 H4, nohidden A4 A5.
#   The suggested one-line fix ALONE (`col` -> colName || data-sum-col || colId on the old build) is
#   15/10: no more throw, but Average picked on AMOUNT re-typed QTY (its right-hand neighbour) as
#   "5.50 [AVG]", left AMOUNT on SUM, and Hide badges left AMOUNT's 4 badges behind.
#
# Headless Edge over CDP; stages into %TEMP% (the libs, main.css and the analysis
# <template> are copied out of the app); writes nothing to the webroot.
# Needs Python 3 + websocket-client.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, glob
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_MODES = ['live', 'numhidden', 'ab']
CONTROL_RED = ['B1', 'B2', 'B4', 'B5', 'R1', 'T1', 'T2', 'H4', 'H5', 'A4', 'A6']

# --- mutants: name -> (edits on the FIXED build, assert ids that MUST go red) ------------------
# Every anchor must occur exactly once.
NAME_LINE = "            var colName = $td.attr('data-sum-col') || '';\r\n"
READ_LINE = "                .each(function () { acc.push(_readComparisonCellText(this)); });\r\n"
LABEL_BLOCK = ("        if (typesShown.length) {\r\n"
               "            $wrapper.find('tfoot td.pnb-sum-label strong').text(penumbraSummaryHeaderLabel(typesShown));\r\n"
               "        }\r\n")
ROWS_SEL = "            $wrapper.find('tbody tr:not(.search-hidden) td[data-column=\"' + colId + '\"]')\r\n" + READ_LINE
MUTANTS = {
    # the obvious one-line fix: `col` defined, the name still from the header at the cell's index
    'oneliner':    ([(NAME_LINE, "            var colName = $wrapper.find('thead th').eq($td.index()).attr('data-colname') || '';\r\n")],
                    ['B2', 'B3', 'A4', 'H4']),
    'textcontent': ([(READ_LINE, "                .each(function () { acc.push(this.textContent); });\r\n")], ['B4', 'A4']),
    'nolabel':     ([(LABEL_BLOCK, '')], ['B5', 'H4']),
    # the visible-rows contract A4 claims to cover (a line this fix did not touch)
    'nohidden':    ([(ROWS_SEL, ROWS_SEL.replace('tbody tr:not(.search-hidden) td', 'tbody tr td'))], ['A4']),
}
def mode_of(aid):
    return {'H': 'numhidden', 'A': 'ab'}.get(aid[0], 'live')

# --- args ---------------------------------------------------------------------------------------
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
main_path = opt('--main', None)
app_dir = opt('--app', APP)
modes_arg = opt('--modes', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control and not main_path:
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-cmpfoot'))
    if not baks:
        raise SystemExit('--control needs js\\main.js.bak-*-cmpfoot (made by the deploy), or pass --main <pre-fix copy>')
    main_path = baks[-1]
if not main_path: main_path = os.path.join(app_dir, 'js', 'main.js')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, and
    hideLoading counts its calls (the end of a comparison render / search)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { runCmp: "runComparisonAndDisplayGrouped", runAb: "runComparisonTwoSnapshots", compress: "compressString", runTableSearch: "runTableSearch" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    edits, _ = MUTANTS[name]
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:100]))
        src = src.replace(old, new)
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_cf_')
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
# The comparison clones the REAL analysis-card <template> out of index.php.
idx = open(os.path.join(app_dir, 'index.php'), 'rb').read().decode('utf-8', 'surrogateescape')
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.replace('<!--SNAP_TEMPLATE-->', m.group(0)).encode('utf-8', 'surrogateescape'))

def write_build(text):
    open(os.path.join(stage, 'main_cf.js'), 'wb').write(text.encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
prof = os.path.join(stage, 'profile')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + prof, '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
for _ in range(100):
    try: urllib.request.urlopen('http://127.0.0.1:%d/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(mode):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid: return msg.get('result', {})
    try:
        call('Page.enable')
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?mode=%s&t=%d' % (hp, mode, int(time.time() * 1000))})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__CFDONE ? JSON.stringify(window.__CFRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the page (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_modes(text, modes, tag):
    write_build(text)
    out = []
    for md in modes:
        res = run_page(md)
        if res.get('fatal'): out.append(('X-' + md, False, 'fatal: ' + str(res['fatal'])[:400]))
        if res.get('hookErr'): out.append(('X-hook-' + md, False, 'hook: ' + res['hookErr']))
        for r in res.get('results', []):
            out.append((r['name'].split(' ')[0], bool(r['pass']), r['name'] + '  [' + r.get('detail', '') + ']'))
        if res.get('pageErrors'): print('  [%s/%s] page errors: %s' % (tag, md, ' | '.join(res['pageErrors'])[:400]), flush=True)
    return out

try:
    modes = modes_arg.split(',') if modes_arg else ALL_MODES
    src = read_b(main_path)
    if all_mutants or one_mutant:
        print('[mutants] fixed build: %s' % main_path)
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            must = MUTANTS[name][1]
            res = run_modes(hook(mutate(src, name)), sorted(set(mode_of(a) for a in must), key=ALL_MODES.index), name)
            red = [a for a, ok, _ in res if not ok]
            missing = [a for a in must if a not in red]
            good = not missing
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-12s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        print('main.js: %s%s' % (main_path, '   (CONTROL: the pre-fix build must be RED on exactly %s)' % ' '.join(CONTROL_RED) if control else ''))
        res = run_modes(hook(src), modes, 'main')
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:420]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            want = [a for a in CONTROL_RED if mode_of(a) in modes]
            exact = sorted(failed) == sorted(want)
            print('CONTROL: %s (red: %s | expected: %s)' % ('as expected' if exact else 'UNEXPECTED', ' '.join(failed), ' '.join(want)))
            print('RESULT: GREEN' if exact else 'RESULT: RED')
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
