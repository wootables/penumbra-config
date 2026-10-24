# =============================================================================
# SNAPSORT SUITE (2026-10-23) - the sort in a snapshot VIEW: rows, heading marks and sortCriteria agree.
#
# Every snapshot view draws the frozen rows in their captured order under a fresh, unmarked header
# (rebuildTableFromMasterData), but sortCriteria kept whatever the page held: the report's saved sort in a lazy ?snap=
# tab (the state block sets it before autoLoadSnapshotFromUrl), the live sort after Load As View. The page claimed a
# sort its rows did not have: the first click on that column went straight to descending, a repaint with no table
# marked it by number (on a snapshot of other columns: another column), and whatever read sortCriteria saw it. Only
# restoreOriginalData reset it on the way out - and with it the report's own sort.
#
#   pages: ?mode=lz (a ?snap= boot of the report saved flat and sorted), ?mode=lzg (&snapview=report, the report saved
#   grouped: the snapshot drawn grouped), ?mode=ov (Load As View over the sorted report, then another snapshot, then
#   back to live data), ?mode=ovg (Load As View over the grouped sorted report, then back). The harness is savecmp's
#   (a copy) with the snapshot store stubbed for ?snap= boots and the caution icon a person clicks to go back.
#
#   py -3 run.py [--stage DIR]       the candidate's js\main.js from DIR, else live
#   py -3 run.py --control           live js\main.js: red on the checks of each fix it does not hold (NEW_SETS), the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate main.js (must turn their asserts red)
#   --pages lz,ov                    only these pages
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot. One Edge suite at a time.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_tiles.js', 'penumbra_colwidths.js', 'penumbra_presets.js']
CSS = ['main.css', 'penumbra_colmenu.css', 'penumbra_colwidths.css', 'penumbra_presets.css']
# Each fix's checks, red on a main.js without it (the rest are what the page always did, green everywhere: L0 L3 L4
# L10 G0 G3 V0 V3 V10 W0 C1 P5 - L3/V3 by accident on a build without it: the stale sort it held was the report's; V10
# because its page's step before it, V5, had wiped the sort there; L10/P5 because the stale sort reached the run).
NEW_SETS = [
    ('snapsort', 'function _pnbSnapApplyReportSort(',
     ['L1', 'L2', 'L5', 'L6', 'L7', 'L8', 'L9', 'G1', 'G2', 'V1', 'V2', 'V4', 'V4b', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11', 'V12',
      'V12b', 'V13', 'V14', 'V14b', 'W1', 'W2', 'P1', 'P2', 'P3', 'P4']),
]
PAGES = {
    'lz': 'harness.html?mode=lz&id=snapsort&snap=55',
    'lzg': 'harness.html?mode=lzg&id=snapsort&snap=55&snapview=report',
    'ov': 'harness.html?mode=ov&id=snapsort',
    'ovg': 'harness.html?mode=ovg&id=snapsort',
    'lzrun': 'harness.html?mode=lzrun&id=snapsort&snap=55',
    'lzcase': 'harness.html?mode=lzcase&id=snapsort&snap=55',
    'lzcmp': 'harness.html?mode=lzcmp&id=snapsort&snap=55',
    'ovrun': 'harness.html?mode=ovrun&id=snapsort',
    'ovlive': 'harness.html?mode=ovlive&id=snapsort',
    'ovcmp': 'harness.html?mode=ovcmp&id=snapsort',
    'ovcon': 'harness.html?mode=ovcon&id=snapsort',
    'ovp': 'harness.html?mode=ovp&id=snapsort',
    'lzp': 'harness.html?mode=lzp&id=snapsort&snap=55',
    'lzpx': 'harness.html?mode=lzpx&id=snapsort&snap=55',
    'lzpw': 'harness.html?mode=lzpw&id=snapsort&snap=55',
    'ovx': 'harness.html?mode=ovx&id=snapsort',
}
# ?mode=lzpw's state, encrypted as the app encrypts one (PENUMBRA_GCM:: + salt, iv, AES-256-GCM, PBKDF2-SHA-256 x100000)
# by the browser itself before the pages run (enc_state.js): the same report as ?mode=lz
ENC_PW = 'snapsort-pw'
ENC_PLAIN = json.dumps({'name': 'snapsort', 'query': 'SELECT ID, DEPT, NAME, AMOUNT, QTY, NOTE FROM SNAPSORT_FIXTURE',
                        'reportTitle': 'Sort in a snapshot view', 'theme': 'theme-default', 'density': 'standard',
                        'sortCriteria': [{'colIdentifier': 'NOTE', 'colIndex': 5, 'direction': 'desc'}], 'noLimit': True,
                        'rowExpandDefault': False, 'resolverLinksDefault': False, 'rowsPerPage': '200', 'reportSnippet': ''})
ENC_JS = ("(async function (pw, plain) {"
          " var enc = new TextEncoder();"
          " var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));"
          " var km = await crypto.subtle.importKey('raw', enc.encode(pw), { name: 'PBKDF2' }, false, ['deriveKey']);"
          " var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);"
          " var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plain)));"
          " var buf = new Uint8Array(28 + ct.length); buf.set(salt, 0); buf.set(iv, 16); buf.set(ct, 28);"
          " var bin = ''; for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);"
          " return 'PENUMBRA_GCM::' + btoa(bin);"
          " })(%s, %s)")

# --- mutants: name -> (edits on the candidate main.js, assert ids that MUST go red, pages to run) ------------------
MUTANTS = {
    # nothing kept as the view opens: it opens unsorted, and no way out has the report's sort to give back
    's-keep': ([("                if (!isViewingSnapshot) _pnbSnapKeepReportSort();\n", "")], ['L1', 'V1', 'V5'], ['lz', 'ov']),
    # the view not drawn in it: the page claims the sort its rows do not have, as before (?snapview=report's groups
    # are drawn from those rows, so they lose it too)
    's-apply': ([("                // (snapsort) ...in the report's own sort, by column name, marked (not another report's)\n"
                  "                _pnbSnapApplyReportSort(_pnbSnapFromOtherReport(snapshot));\n", "")], ['L1', 'L2', 'V1', 'G1'], ['lz', 'ov', 'lzg']),
    # by the report's column NUMBER, not its name: a snapshot of other columns is sorted (and marked) by another one
    's-byname': ([("                var h = heads[String(c && c.colIdentifier).toUpperCase()];\n",
                   "                var h = { col: c.colIndex, name: c.colIdentifier };\n")], ['V4'], ['ov']),
    # a level whose column the snapshot lacks kept (by its number): the view claims a sort it cannot draw
    's-drop': ([("                if (h) out.push({ colIdentifier: h.name, colIndex: h.col, direction: c.direction === 'desc' ? 'desc' : 'asc' });\n",
                 "                out.push({ colIdentifier: h ? h.name : c.colIdentifier, colIndex: h ? h.col : c.colIndex, direction: c.direction === 'desc' ? 'desc' : 'asc' });\n")],
               ['V10', 'V12'], ['ov']),
    # the report's name for the column kept ("Note"), not the heading's (NOTE): a click on the marked heading starts a
    # new sort instead of taking it off
    's-name': ([("                if (h) out.push({ colIdentifier: h.name, colIndex: h.col, direction: c.direction === 'desc' ? 'desc' : 'asc' });\n",
                 "                if (h) out.push({ colIdentifier: c.colIdentifier, colIndex: h.col, direction: c.direction === 'desc' ? 'desc' : 'asc' });\n")],
               ['L8'], ['lzcase']),
    # a pivot's sort applied to the snapshot's rows (its row field is a column there too) - on screen, or armed in a
    # ?snap= tab of a pivot report
    's-pivot': ([("            ((k && !k.pivot && !foreign) ? k.sort : []).forEach(function (c) {\n",
                  "            ((k && !foreign) ? k.sort : []).forEach(function (c) {\n")], ['P1', 'P3'], ['ovp', 'lzp']),
    # a ?snap= tab of a pivot report: the armed pivot's sort taken for a flat one (the view sorted by it; Compare to
    # Live Data's flat table too)
    's-lazypivot': ([("            pivot: $('#pivot-output-container').is(':visible') || (!originalDataBeforeSnapshot && !!pendingPivotSettings)\n",
                      "            pivot: $('#pivot-output-container').is(':visible')\n")], ['P3', 'P4'], ['lzp']),
    # a run from that tab never gives the pivot's sort back (the report's pivot comes back unsorted)...
    's-runpivot': ([("        if (isViewingSnapshot) _pnbSnapPutBackReportSort(!originalDataBeforeSnapshot && !_pendingSnapshotCompare && !!window._reportDefaultPivot);\n",
                     "        if (isViewingSnapshot) _pnbSnapPutBackReportSort(false);\n")], ['P5'], ['lzpx']),
    # ...or gives it back to Compare to Live Data's flat table too
    's-cmppivot': ([("        if (isViewingSnapshot) _pnbSnapPutBackReportSort(!originalDataBeforeSnapshot && !_pendingSnapshotCompare && !!window._reportDefaultPivot);\n",
                     "        if (isViewingSnapshot) _pnbSnapPutBackReportSort(!originalDataBeforeSnapshot && !!window._reportDefaultPivot);\n")], ['P4'], ['lzp']),
    # the report's state arriving after its ?snap= view opened (a password asked for) changes nothing in the view
    's-pwkeep': ([("                    if (isViewingSnapshot) {\n"
                   "                        _pnbSnapKeepReportSort();\n"
                   "                        if (!$('#groupedResultsContainer').is(':visible') && !$('#pivot-output-container').is(':visible')) _pnbSnapApplyReportSort(_pnbSnapFromOtherReport(_lazyViewedSnapshot));\n"
                   "                    }\n", "")], ['L9', 'L10'], ['lzpw']),
    # another report's snapshot sorted by this report's sort
    's-foreign': ([("                _pnbSnapApplyReportSort(_pnbSnapFromOtherReport(snapshot));\n", "                _pnbSnapApplyReportSort(false);\n")], ['V14'], ['ovx']),
    # back to live data: the report's sort not given back
    's-restore': ([("                _snapSortBack = _pnbSnapPutBackReportSort(true);\n", "")], ['V5', 'W2', 'P2'], ['ov', 'ovg', 'ovp']),
    # ...given back, but the rebuilt flat table not sorted in it
    's-restoreflat': ([("                if (_snapSortBack && !originalDataBeforeSnapshot.isPivotVisible && !originalDataBeforeSnapshot.isGroupedVisible) _pnbResortFlatView(true);\n", "")],
                      ['V5'], ['ov']),
    # ...and wiped by the finally again
    's-finally': ([("                if (!_snapSortBack) sortCriteria = [];\n", "                sortCriteria = [];\n")], ['V5', 'W2', 'P2'], ['ov', 'ovg', 'ovp']),
    # a run from a view (Run, the lazy exit, Compare to Live Data) takes the view's sort
    's-run': ([("        if (isViewingSnapshot) _pnbSnapPutBackReportSort(!originalDataBeforeSnapshot && !_pendingSnapshotCompare && !!window._reportDefaultPivot);\n", "")],
              ['L5', 'L6', 'L7', 'V6'], ['lz', 'lzrun', 'lzcmp', 'ovrun']),
    # a live action's exit (a pivot / group preset, a comparison's Clear on a view) keeps the view's sort
    's-live': ([("        _pnbSnapPutBackReportSort(false);\n        _pnbResortFlatView(true);\n        if (_pnbCmpReportSort !== null)",
                 "        if (_pnbCmpReportSort !== null)")], ['V7', 'V9'], ['ovlive', 'ovcmp']),
    # ...and a comparison opened on the view gives the view's sort back at its Clear
    's-cmp': ([("        if (_pnbCmpReportSort !== null) _pnbCmpReportSort = sortCriteria.map(function (c) { return Object.assign({}, c); });\n        return true;\n", "        return true;\n")],
              ['V8'], ['ovcmp']),
    # a table opened from the console during a view gets the report's sort
    's-console': ([("        _pnbSnapReportSort = null;   // (snapsort) ...the report's a snapshot view kept too\n", "")], ['C1'], ['ovcon']),
    # a capture made during a view writes the view's sort (the snapshot's numbering)
    's-state': ([("        if (isViewingSnapshot && _pnbSnapReportSort) {\n"
                  "            return _pnbSnapReportSort.pivot ? [] : _pnbSnapReportSort.sort.map(function (c) { return Object.assign({}, c); });\n"
                  "        }\n", "")], ['V4b'], ['ov']),
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
only = opt('--pages', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def pick(rel):
    if stage_dir and not control and os.path.exists(os.path.join(stage_dir, rel)): return os.path.join(stage_dir, rel)
    return os.path.join(APP, rel)
main_path = pick(os.path.join('js', 'main.js'))
menu_path = pick(os.path.join('js', 'penumbra_colmenu.js'))

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, plus reads of the page's sort, the report
    sort a snapshot view keeps (snapsort: 'missing' on a build without it) and the snapshot flag; hideLoading counts
    its calls (a render's end)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { compress: "compressString", decompress: "decompressString", loadSnap: "loadSnapshotData", restore: "restoreOriginalData",'
         ' exitLive: "_exitSnapshotForLiveAction", exitHome: "_exitSnapshotToHome", uhi: "updateHeaderIcons", bso: "buildStateObject",'
         ' ser: "_penumbraSerializeSortForUrl", runCmp: "runComparisonAndDisplayGrouped", runAb: "runComparisonTwoSnapshots", clearAll: "performClearAllAction" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n'
         'window.__CF.sc = function () { return JSON.parse(JSON.stringify(sortCriteria)); };\r\n'
         'window.__CF.setSort = function (s) { sortCriteria = s; };\r\n'
         'window.__CF.viewing = function () { return isViewingSnapshot; };\r\n'
         'window.__CF.kept = function () { try { return eval("typeof _pnbSnapReportSort === \'undefined\' ? \'missing\' : JSON.parse(JSON.stringify(_pnbSnapReportSort))"); } catch (e) { return "missing"; } };\r\n'
         'window.__CF.rs = function () { return _pnbCmpReportSort === null ? null : JSON.parse(JSON.stringify(_pnbCmpReportSort)); };\r\n'
         'window.__CF.grp = function () { return JSON.parse(JSON.stringify({ cols: currentGroupingColumns })); };\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        olds = old if isinstance(old, tuple) else (old,)
        done = False
        for alt in olds:
            for o, n in ((alt, new), (alt.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
                if src.count(o) == 1: src = src.replace(o, n); done = True; break
            if done: break
        if not done:
            raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(olds[0]), olds[0][:90]))
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_snapsort_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
shutil.copyfile(menu_path, os.path.join(stage, 'penumbra_colmenu.js'))
idx = read_b(os.path.join(APP, 'index.php'))
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.replace('<!--SNAP_TEMPLATE-->', m.group(0)).encode('utf-8', 'surrogateescape'))

def write_main(text):
    open(os.path.join(stage, 'main_cf.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
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

def run_page(path):
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__CFDONE ? JSON.stringify(window.__CFRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the page (240 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def collect(res, tag):
    out = []
    if res.get('fatal'): out.append(('X-' + tag, False, '[%s] fatal: %s' % (tag, str(res['fatal'])[:600])))
    if res.get('hookErr'): out.append(('X-' + tag + '-hook', False, '[%s] hook: %s' % (tag, res['hookErr'])))
    for r in res.get('results', []):
        out.append((r['name'].split(' ')[0], bool(r['pass']), r['name'] + '  [' + r.get('detail', '') + ']'))
    if res.get('pageErrors'): print('  [%s] page errors: %s' % (tag, ' | '.join(res['pageErrors'])[:600]), flush=True)
    if res.get('info'): print('  [%s] info: %s' % (tag, json.dumps(res['info'])[:600]), flush=True)
    return out

def make_enc_state():
    """?mode=lzpw's encrypted state, made by the browser (WebCrypto) on the harness's own origin; enc_state.js."""
    open(os.path.join(stage, 'blank.html'), 'wb').write(b'<!doctype html><title>blank</title>')
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid: return msg.get('result', {})
    try:
        call('Page.enable')
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/blank.html' % hp})
        time.sleep(1.0)
        r = call('Runtime.evaluate', {'expression': ENC_JS % (json.dumps(ENC_PW), json.dumps(ENC_PLAIN)), 'awaitPromise': True, 'returnByValue': True})
        v = r.get('result', {}).get('value')
        if not v or not str(v).startswith('PENUMBRA_GCM::'): raise SystemExit('could not make the encrypted state: %r' % r)
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass
    open(os.path.join(stage, 'enc_state.js'), 'wb').write(('window.__ENC_STATE = %s;\n' % json.dumps(v)).encode('utf-8'))

def run(main_text, pages):
    write_main(main_text)
    out = []
    for key in pages:
        out += collect(run_page(PAGES[key]), key)
    return out

try:
    src = read_b(main_path)
    print('main.js: %s%s' % (main_path, '   (CONTROL)' if control else ''))
    make_enc_state()
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            edits, must, pages = MUTANTS[name]
            res = run(mutate(src, name), pages)
            red = [a for a, ok, _ in res if not ok]
            missing = [a for a in must if a not in red]
            good = not missing and not [a for a in red if a.startswith('X')]
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-14s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run(src, only.split(',') if only else list(PAGES.keys()))
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:900]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            NEW = []
            for name, marker, ids in NEW_SETS:
                held = marker in src
                print('CONTROL: %s is %s in this main.js%s' % (name, 'IN' if held else 'NOT', '' if held else ' (its checks must be red)'))
                if not held: NEW += ids
            seen = [a for a, _, _ in res]
            new_green = [a for a in NEW if a in seen and a not in failed]
            new_unseen = [a for a in NEW if a not in seen]
            old_red = [a for a in failed if a not in NEW]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            skip = []
            for name, marker, ids in NEW_SETS:
                if marker not in src:
                    skip += ids
                    print('NOTE: %s is not in this main.js: its checks (%s) show the page as it was before it - not counted' % (name, ' '.join(ids)))
            counted = [a for a in failed if a not in skip]
            print('RESULT: GREEN' if not counted and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
