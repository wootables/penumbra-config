# =============================================================================
# MULTI-WORKSHEET IMPORT SUITE "msheet" (2026-10-02)
#
# A workbook dropped on the page used to import its FIRST sheet only. Now every
# VISIBLE worksheet holding a header row and a data row is read: one such sheet
# imports exactly as before; two or more are STACKED - the tab name in a
# WORKSHEET column first, then the union of the sheets' columns - and the import
# opens GROUPED by WORKSHEET, one band per tab in TAB order (written as the
# column's custom sort order). The imports/ folder reader in shared_logic.php is
# the twin and stacks the same way; building this suite found that it used to
# read an ARBITRARY tab of any multi-tab Excel workbook (the first worksheet
# relationship, and Excel writes the rels in no particular order).
#
# Two halves, both against fixtures authored by REAL Excel (fixtures/,
# make_fixtures.ps1):
#   browser  the REAL main.js on an admin's report page, a fixture dropped on it,
#            followed through parse -> save -> query -> render (stubbed
#            manage_imports.php + query.php in harness.html; the fake query reads
#            an import as query.php does: the stored rows of the ID the page sends,
#            else the page's inline rows - never "whatever was last saved under
#            that name", which would hide the savefail bug). driver.js asserts:
#     parity     J-*  the parser on every fixture (+ the rows the PHP half compares)
#     stack      G-*  three tabs + a hidden one + two without data: saved rows, the
#                     grouped view, tab order, counts, the notice, the sort order
#     single     F-*  one data tab: flat and unchanged, no notice, no sort order
#     prevgroup  V-*  dropped onto a GROUPED report (top-1 limit, count sort, depth 1,
#                     a summary): the import's grouping replaces it, from the defaults
#     prevpivot  W-*  dropped onto a PIVOT: the import's grouping replaces it
#     overwrite  O-*  the same workbook twice: the overwrite prompt says "stacked"
#     legacy     L-*  XML Spreadsheet 2003 (.xls) through the same drop
#     cap        Z-*  two tabs over the 50,000-row cap together: refused up front,
#                     nothing saved, no grouping left armed for the next query
#     savefail   S-*  (added 2026-10-02) a CSV saved, then a DIFFERENT file under the
#                     same name whose save the server refuses (500): its own rows show,
#                     sent inline (no stored ID), an ERROR toast says they were not saved
#                     (with the server's reason), a re-run keeps them, and the next save
#                     that works is read back by its new ID
#   server   test_msheet.php: the imports/ folder readers on the same fixtures,
#            the one-tab byte-for-byte identity with the old reader, the TWIN
#            column name, and B-* PARITY with the browser half's parsed rows.
#
#   py -3 run.py                        candidate = the live webroot
#   py -3 run.py --app DIR              candidate = DIR\js\main.js + DIR\shared_logic.php
#                                       (a staged kit before the deploy)
#   py -3 run.py --control              BOTH halves on the pre-change files (default: the
#                                       newest *.bak-*-msheet, or --baseline-js/--baseline-php):
#                                       exactly CONTROL_RED (and the PHP half's) must fail
#   py -3 run.py --control-savefail     the browser half on the build before the save-failure
#                                       fix (default: the newest js\main.js.bak-*-savefail, or
#                                       --baseline-js): exactly CONTROL_RED_SAVEFAIL must fail
#   py -3 run.py --mutant NAME / --mutants      JS single-point edits (mutants.json)
#   py -3 run.py --php-mutants                  the PHP half's own mutants
#   --scn a,b   a subset;   --keep keeps the staging dir;   --dump prints raw results
#   --libs DIR  vendor libs + css source (default: the live webroot)
#
# main.js is served with its LINE NUMBERS INTACT: the hooks ride on line 1 after
# the ready() anchor and the hideLoading counter on that function's own line.
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# Needs Python 3 + websocket-client (py -3 -m pip install websocket-client).
# =============================================================================
import glob, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
PHP = r'\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
# Four leading backslashes: PHP's -d value parser folds "\\" to "\", and a
# two-backslash UNC path then fails to load php_zip.dll ("module not found").
PHP_EXT = r'\\\\oitras\d$\Utilities\PHP_8.2-p\ext'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_SCN = ['parity', 'stack', 'single', 'prevgroup', 'prevpivot', 'overwrite', 'legacy', 'cap', 'savefail']
EXPECT = {
    'parity': ['P-boot-parity', 'J-three', 'J-meta', 'J-single', 'J-onetab', 'J-collide', 'J-hiddenfirst', 'J-legacy', 'J-case', 'J-ods', 'J-errors'],
    'stack': ['P-boot-stack', 'G-save', 'G-grouped', 'G-order', 'G-counts', 'G-collapsed', 'G-csort', 'G-toast', 'G-pending', 'G-err'],
    'single': ['P-boot-single', 'F-save', 'F-flat', 'F-csort', 'F-toast', 'F-err'],
    'prevgroup': ['P-boot-prevgroup', 'P-prevgroup', 'V-grouped', 'V-bands', 'V-reset', 'V-agg', 'V-collapsed', 'V-err'],
    'prevpivot': ['P-boot-prevpivot', 'P-prevpivot', 'W-grouped', 'W-nopivot', 'W-toast', 'W-err'],
    'overwrite': ['P-boot-overwrite', 'O-first', 'O-confirm', 'O-again', 'O-err'],
    'legacy': ['P-boot-legacy', 'L-save', 'L-bands', 'L-err'],
    'cap': ['P-boot-cap', 'Z-nosave', 'Z-noquery', 'Z-toast', 'Z-pending', 'Z-next', 'Z-err'],
    'savefail': ['P-boot-savefail', 'S-first', 'P-savefail-refused', 'S-rows', 'S-inline', 'S-toast', 'S-rerun', 'S-recover', 'S-err'],
}
# What the pre-change build gets wrong (browser half), frozen from the first
# control run (live b9e08a2a, 2026-10-02). Every other assert must PASS on the old
# build too: the one-sheet shapes (J-single, J-onetab, J-hiddenfirst, every F-*),
# the parse errors (J-errors), the first drop's silence (O-first) and the
# preconditions - which is what proves "a one-sheet workbook imports exactly as
# before". V-agg and W-nopivot pass on the old build VACUOUSLY (the stashed
# view is dropped there for its missing column); the noaggnull / nopivotnull
# mutants are what give them teeth. The PHP half judges its own control.
CONTROL_RED = ['J-three', 'J-meta', 'J-collide', 'J-legacy', 'J-case', 'J-ods',
               'G-save', 'G-grouped', 'G-order', 'G-counts', 'G-collapsed', 'G-csort', 'G-toast', 'G-pending',
               'V-grouped', 'V-bands', 'V-reset', 'V-collapsed', 'W-grouped', 'W-toast', 'O-confirm', 'O-again',
               'L-save', 'L-bands', 'Z-nosave', 'Z-noquery', 'Z-toast', 'Z-pending', 'Z-next',
               # the savefail scenario (added 2026-10-02): that build predates the fix as well
               'S-rows', 'S-inline', 'S-toast', 'S-rerun']
# --control-savefail: the build the save-failure fix replaced (live 2026-10-02 16:45-16:48,
# main.js ea0ae814 = schedrowdump's; js\main.js.bak-20261002-1648-savefail) on EVERY scenario:
# exactly these fail - a refused save over an existing import of the same name showed the
# PREVIOUS upload (the query sent its stored ID), silently - and the whole msheet change still
# passes. Frozen from its first control run (on 8425c02c); identical on each build that landed
# under the deploy (caf4bb5f, 0c86917f, ea0ae814).
CONTROL_RED_SAVEFAIL = ['S-rows', 'S-inline', 'S-toast', 'S-rerun']

MUTANTS = {}
for _k, _v in json.load(open(os.path.join(HERE, 'mutants.json'), encoding='utf-8')).items():
    MUTANTS[_k] = ([tuple(e) for e in _v['edits']], _v['must'], _v['scn'])

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
libs_dir = opt('--libs', APP)
base_js = opt('--baseline-js', None)
base_php = opt('--baseline-php', None)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
php_mutants = flag('--php-mutants')
control = flag('--control')
control_sf = flag('--control-savefail')
keep = flag('--keep')
verbose = flag('--verbose')
dump = flag('--dump')
no_php = flag('--no-php')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def newest(pattern, what):
    baks = bak_glob(os.path.join(APP, pattern))
    if not baks: raise SystemExit('no %s baseline: pass it explicitly (the deploy leaves %s)' % (what, pattern))
    return baks[-1]
if control and control_sf: raise SystemExit('--control and --control-savefail are separate runs')
if base_js is None and control: base_js = newest(os.path.join('js', 'main.js.bak-*-msheet'), 'main.js')
if base_js is None and control_sf: base_js = newest(os.path.join('js', 'main.js.bak-*-savefail'), 'main.js')
if base_php is None: base_php = newest('shared_logic.php.bak-*-msheet', 'shared_logic.php')
cand_js = base_js if (control or control_sf) else os.path.join(app_dir, 'js', 'main.js')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

ANCHOR = '$(document).ready(function () {'
# The closure's FIRST statement, on line 1, so every line number stays the file's.
# Getters read the view globals at CALL time (a let is still in its TDZ here);
# one that does not exist in the build under test reads "ERR:...".
HOOK = (' try { window.__MS = {'
        ' parse: function (b) { return parseXLSXToObjects(b); },'
        ' ensureXLSX: function (cb) { return ensureXLSXLoaded(cb); },'
        ' setGrouping: function (c) { return setGroupingColumns(c); },'
        ' rebuild: function (v) { return rebuildGroupedView(v); },'
        ' st: function () { var g = function (f) { try { var v = f(); return v === undefined ? null : JSON.parse(JSON.stringify(v)); }'
        ' catch (e) { return "ERR:" + e.message; } }; return {'
        ' grouping: g(function () { return currentGroupingColumn; }),'
        ' pendingSheet: g(function () { return pendingImportSheetGroup; }),'
        ' csort: g(function () { return customSortOrders; }),'
        ' groupLimit: g(function () { return currentGroupLimit; }),'
        ' groupSort: g(function () { return currentGroupSort; }),'
        ' startDepth: g(function () { return currentGroupStartDepth; }),'
        ' agg: g(function () { return currentGroupAgg; }),'
        ' pivot: g(function () { return currentPivotSettings; }) }; },'
        ' set: function (o) { if ("groupLimit" in o) currentGroupLimit = o.groupLimit; if ("groupSort" in o) currentGroupSort = o.groupSort;'
        ' if ("startDepth" in o) currentGroupStartDepth = o.startDepth; if ("agg" in o) currentGroupAgg = o.agg;'
        ' if ("pivot" in o) currentPivotSettings = o.pivot; } }; } catch (e) { window.__MS_ERR = String(e); }')

def hook(src):
    i = src.find(ANCHOR)
    if i < 0 or i > 200: raise SystemExit('main.js ready() anchor not found at the top')
    src = src[:i + len(ANCHOR)] + HOOK + src[i + len(ANCHOR):]
    hl = '    function hideLoading() {\r\n'
    if src.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % src.count(hl))
    return src.replace(hl, '    function hideLoading() { window.__MS_HIDES = (window.__MS_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_ms_')
os.makedirs(os.path.join(stage, 'js'))
for f in LIBS: shutil.copyfile(os.path.join(libs_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(libs_dir, 'js', 'xlsx.full.min.js'), os.path.join(stage, 'js', 'xlsx.full.min.js'))   # ensureXLSXLoaded's own path
shutil.copyfile(os.path.join(libs_dir, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copytree(os.path.join(HERE, 'fixtures'), os.path.join(stage, 'fixtures'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
# The fake save refuses what the real one refuses: the client's own twin of
# PENUMBRA_IMPORT_MAX_ROWS (importtrunc asserts it equals the PHP define).
cand_text = read_b(cand_js)
mcap = re.search(r'var PENUMBRA_IMPORT_MAX_ROWS = (\d+);', cand_text)
if not mcap: raise SystemExit('PENUMBRA_IMPORT_MAX_ROWS not found in the candidate main.js')
h = read_b(os.path.join(HERE, 'harness.html'))
if h.count('var __IMPORT_MAX = 50000;') != 1: raise SystemExit('harness __IMPORT_MAX anchor missing')
h = h.replace('var __IMPORT_MAX = 50000;', 'var __IMPORT_MAX = %s; window.__IMPORT_MAX = __IMPORT_MAX;' % mcap.group(1))
open(os.path.join(stage, 'harness.html'), 'wb').write(h.encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

POLL = '(function () { return JSON.stringify({ done: !!window.__MSDONE, res: window.__MSDONE ? window.__MSRESULT : null }); })()'

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
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same main_ms.js
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.3)
            v = call('Runtime.evaluate', {'expression': POLL, 'returnByValue': True}).get('result', {}).get('value')
            if not v: continue
            st = json.loads(v)
            if st['done']: return st['res']
        return {'fatal': 'timeout (240 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text, scns):
    open(os.path.join(stage, 'main_ms.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    res = {s: run_page(s) for s in scns}
    if dump:
        for s in scns:
            r = res[s] or {}
            print('--- %s: errors %s | rejections %s | fatal %s\n    obs %s' % (s, json.dumps(r.get('errors')), json.dumps(r.get('rejections')),
                                                                (r.get('fatal') or '')[:600], json.dumps(r.get('obs'))[:3000]))
    return res

def evaluate(res, scns):
    out = []
    for s in scns:
        r = res.get(s) or {}
        got = {a['id']: a for a in (r.get('asserts') or [])}
        for aid in EXPECT[s]:
            if aid in got: out.append((aid, got[aid]['ok'], got[aid]['detail']))
            else: out.append((aid, False, 'NOT RECORDED' + (' | fatal: ' + (r.get('fatal') or '')[:300] if r.get('fatal') else '')))
        for aid, a in got.items():
            if aid not in EXPECT[s]: out.append((aid, a['ok'], 'UNEXPECTED ID ' + a['detail']))
        out.append(('E-' + s, not r.get('fatal') and not r.get('rejections'),
                    'fatal %s rejections %s' % ((r.get('fatal') or '')[:300], r.get('rejections'))))
    return out

def run_php(extra, browser_json):
    cmd = [PHP, '-n', '-d', 'extension_dir=' + PHP_EXT, '-d', 'extension=zip', os.path.join(HERE, 'test_msheet.php'),
           '--app', app_dir, '--baseline', base_php] + extra
    if browser_json: cmd += ['--browser-json', browser_json]
    # A UNC working directory breaks a child that goes through cmd.exe; %TEMP% never does.
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=tempfile.gettempdir())
    return p.returncode, (p.stdout or '') + (p.stderr or '')

overall_bad = 0
try:
    print('candidate main.js: %s%s' % (cand_js, '   (CONTROL: the pre-change build)' if control
          else ('   (CONTROL-SAVEFAIL: the build before the save-failure fix)' if control_sf else '')))
    print('baseline shared_logic.php: %s' % base_php)
    names = [s for s in ALL_SCN if not scn_arg or s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            edits, must, mscn = MUTANTS[m]
            sc = [s for s in (mscn or names) if s in names]
            res = evaluate(run_build(mutate(cand_text, m), sc), sc)
            red = [a for a, p, _ in res if not p]
            if must is None:
                print('  EXPLORE mutant %-12s red: %s' % (m, ' '.join(red) or '(nothing)'))
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
                bad += 1
                continue
            good = sorted(red) == sorted(must)
            ok += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must) or '(nothing)', ' '.join(red)))
            if verbose or not good:
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
        print('SUMMARY JS mutants ok=%d bad=%d' % (ok, bad))
        overall_bad += bad
    else:
        res_raw = run_build(cand_text, names)
        res = evaluate(res_raw, names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-18s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('BROWSER pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            if CONTROL_RED is None:
                print('CONTROL: not frozen yet - red set: %s' % ' '.join(failed))
                overall_bad += 1
            else:
                want = [a for a in CONTROL_RED if any(a in EXPECT[s] for s in names)]
                good = sorted(failed) == sorted(want)
                print('CONTROL (browser): %s (expected red: %s)' % ('as expected' if good else 'NOT as expected', ' '.join(want)))
                overall_bad += (not good)
        elif control_sf:
            if CONTROL_RED_SAVEFAIL is None:
                print('CONTROL-SAVEFAIL: not frozen yet - red set: %s' % ' '.join(failed))
                overall_bad += 1
            else:
                want = [a for a in CONTROL_RED_SAVEFAIL if any(a in EXPECT[s] for s in names)]
                good = sorted(failed) == sorted(want)
                print('CONTROL-SAVEFAIL (browser): %s (expected red: %s)' % ('as expected' if good else 'NOT as expected', ' '.join(want)))
                overall_bad += (not good)
        else:
            overall_bad += f
        # ---- the PHP half, with the browser's parsed rows for the parity check ----
        bj = None
        par = (res_raw.get('parity') or {}).get('obs', {}).get('parity')
        if par:
            bj = os.path.join(stage, 'browser_parity.json')
            json.dump(par, open(bj, 'w', encoding='utf-8'))
        if control_sf:
            print('PHP half: not run (the save-failure fix is main.js only; plain runs keep judging shared_logic.php)')
        elif not no_php:
            rc, out = run_php((['--control'] if control else []) + (['--mutants'] if php_mutants else []), bj)
            print(out.rstrip())
            overall_bad += (rc != 0)
    print('RESULT: GREEN' if overall_bad == 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
sys.exit(1 if overall_bad else 0)
