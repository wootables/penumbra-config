# =============================================================================
# CMPSORT SUITE (2026-10-22) - a heading CLICK in a snapshot comparison sorts by the comparison's own sort.
#
# The page keeps ONE sort (main.js sortCriteria). A comparison renders its tables unsorted - every render, a
# search's re-run included, is a new #snapshotComparisonContainer - and numbers its own columns (its column list
# counts '#' first: the report table's NOTE is 4, the comparison's NOTE 5 and its 4 is QTY). The click handler
# worked on the stale sort: the first click on the report sort's column went asc -> desc, by the report table's
# column number (another column in the comparison); updateHeaderIcons() with no table (the journal's repaint after
# a render) marked comparison headings from it, by those numbers; the comparison's Clear left the comparison's
# criteria for the report table. Found by the two reviews of the comparison menu's round 2 (2d6c232), whose menu
# works around it for its own items (penumbra_colmenu.js cmpSortBox).
#
#   browser half only: the cmpmenu suite's harness (a copy: harness.html - the REAL js\main.js, ready closure
#   unwrapped, window.__CF export hook; a REAL compare-to-live comparison of the 6-row cmpfoot report against a
#   6-row snapshot, keys ID, 2 rows in each of New / Removed / Modified / Unchanged) and this suite's driver.js,
#   which clicks the headings as a person does (S11: an A-vs-B comparison, the other renderer). The hook here also
#   exports runComparisonTwoSnapshots, updateHeaderIcons (the repaint with no table), _teardownComparisonState (the
#   exit Apply Grouping / a pivot / Load As View share), _csApplyToCurrentView (a saved Custom Sort Order re-applying
#   the sort on screen) and a read of the page's sort (window.__CF.sc()).
#
#   py -3 run.py [--stage DIR]       the candidate's js\main.js (and js\penumbra_colmenu.js) from DIR, else live
#   py -3 run.py --control           live js\main.js: NEW red, the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate main.js (must turn their asserts red)
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# (Kept apart from penumbra_tests\cmpmenu, whose run.py / driver.js another round - fit39 - was editing when this
# was written: the two suites share the harness, not their files.)
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_tiles.js', 'penumbra_colwidths.js']
# every check but S0 (the report table's own click sort, as it always was) is red on the live main.js
NEW = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
# (2026-10-23, cmprq) S8 expects what the build under test does with a new query run during a comparison (the report
# table's own sort handed back with cmprq, the comparison's before it); S13 (a table opened from the console) green on
# both, m-noentry's target since
CMPRQ_MARK = 'function _pnbCmpStashReportGrouping('

# --- mutants: name -> (edits on the candidate main.js, assert ids that MUST go red) ------------------
MUTANTS = {
    # a click on a comparison heading works on the page's stale sort again (no take-over)
    'm-clicktake': ([("        _pnbCmpSortTakeOver(this);\n", "")], ['S2', 'S4', 'S5', 'S6', 'S11']),
    # the header menu's sort takes nothing over: the report's sort is not kept for the comparison's end
    'm-menutake': ([("        _pnbCmpSortTakeOver($h[0]);\n", "")], ['S10']),
    # the take-over keeps the stale criteria (the report's or an earlier render's) in place
    'm-noreset': ([("        }\n        sortCriteria = [];\n    }\n    // As a comparison ends", "        }\n    }\n    // As a comparison ends")], ['S2', 'S5']),
    # the runner never marks the render it sorted: every click starts afresh, and no marks are painted there
    'm-nomark': ([("        if (_cmpBox) { $(_cmpBox).data('pnbPageSort', true); }\n", "        if (_cmpBox) { }\n")], ['S2', 'S3']),
    # the marks painted from the page's sort on any comparison render (the journal's repaint, after a render)
    'm-gate': ([("        if (_cmpBoxNow && $headers.length && _cmpBoxNow.contains($headers[0]) && !_pnbCmpSortIsOn(_cmpBoxNow)) return;\n", "")], ['S1', 'S4']),
    # the sorted table's headings alone painted (the other groups keep an earlier sort's marks)
    'm-onetable': ([("            ? $sortedTable.closest('#snapshotComparisonContainer').find('thead th')\n", "            ? $sortedTable.find('thead th')\n")], ['S2', 'S5']),
    # the comparison's Clear leaves the comparison's criteria for the report table
    'm-norestore': ([("            _pnbCmpPutBackReportSort();\n            $('#groupedResultsContainer').empty().hide();\n", "            $('#groupedResultsContainer').empty().hide();\n")], ['S6', 'S7', 'S8', 'S10']),
    # another view taking over (the shared teardown) leaves the comparison's criteria
    'm-noteardown': ([("        _pnbCmpPutBackReportSort();   // (2026-10-22, cmpsort) the report table's own sort back\n", "")], ['S9']),
    # the put-back leaves the render marked: a teardown's comparison, still on screen, is painted from the report's sort
    'm-putbackmark': ([("        _pnbCmpReportSort = null;\n        $('#snapshotComparisonContainer').removeData('pnbPageSort');\n        if (kept === null) return false;\n",
                        "        _pnbCmpReportSort = null;\n        if (kept === null) return false;\n")], ['S9']),
    # a sort of the report's own table during a comparison does not replace the sort kept from before it
    'm-reportkeep': ([("        else { $('#snapshotComparisonContainer').removeData('pnbPageSort'); _pnbCmpReportSort = null; }\n",
                       "        else { $('#snapshotComparisonContainer').removeData('pnbPageSort'); }\n")], ['S7']),
    # ...nor unmarks the comparison render: its headings are painted from the report's sort, and the next click on it
    # takes nothing over
    'm-reportmark': ([("        else { $('#snapshotComparisonContainer').removeData('pnbPageSort'); _pnbCmpReportSort = null; }\n",
                       "        else { _pnbCmpReportSort = null; }\n")], ['S7']),
    # a comparison's entry keeps a report sort that an earlier comparison left kept (a table opened from the console
    # ends one so; a plain new query did too until cmprq, S8's case then)
    'm-noentry': ([("        if (currentGroupingColumn !== '__SNAP_TYPE') { _pnbCmpReportSort = null; }\n", "")], ['S13']),
    # a Custom Sort Order saved during a comparison drives its clicks on a render the page's sort is not on
    'm-csapply': ([("        if ($cmpBox.length && !_pnbCmpSortIsOn($cmpBox[0])) return;\n", "")], ['S12']),
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
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def pick(rel):
    if stage_dir and not control and os.path.exists(os.path.join(stage_dir, rel)): return os.path.join(stage_dir, rel)
    return os.path.join(APP, rel)
main_path = pick(os.path.join('js', 'main.js'))
menu_path = pick(os.path.join('js', 'penumbra_colmenu.js'))

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook (cmpmenu's, plus updateHeaderIcons, the
    comparison teardown and a read of the page's sort), and hideLoading counts its calls (a render's end)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { runCmp: "runComparisonAndDisplayGrouped", runAb: "runComparisonTwoSnapshots", compress: "compressString", uhi: "updateHeaderIcons", teardown: "_teardownComparisonState", csApply: "_csApplyToCurrentView",'
         ' clearAll: "performClearAllAction" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n'
         'window.__CF.sc = function () { return JSON.parse(JSON.stringify(sortCriteria)); };\r\n'
         # (2026-10-23, cmprq) whether this main.js holds cmprq: S8 expects what the build does
         'window.__CF_CMPRQ = ' + ('true' if CMPRQ_MARK in src else 'false') + ';\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if src.count(o) == 1: src = src.replace(o, n); break
        else:
            raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(old), old[:90]))
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_cmps_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colmenu.css'), os.path.join(stage, 'penumbra_colmenu.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colwidths.css'), os.path.join(stage, 'penumbra_colwidths.css'))
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

def run_page():
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?mode=live&t=%d' % (hp, int(time.time() * 1000))})
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

def run(main_text, tag):
    write_main(main_text)
    res = run_page()
    out = []
    if res.get('fatal'): out.append(('X', False, 'fatal: ' + str(res['fatal'])[:500]))
    if res.get('hookErr'): out.append(('X-hook', False, 'hook: ' + res['hookErr']))
    for r in res.get('results', []):
        out.append((r['name'].split(' ')[0], bool(r['pass']), r['name'] + '  [' + r.get('detail', '') + ']'))
    if res.get('pageErrors'): print('  [%s] page errors: %s' % (tag, ' | '.join(res['pageErrors'])[:500]), flush=True)
    return out

try:
    src = read_b(main_path)
    print('main.js: %s%s' % (main_path, '   (CONTROL)' if control else ''))
    print('penumbra_colmenu.js: %s' % menu_path)
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            must = MUTANTS[name][1]
            res = run(mutate(src, name), name)
            red = [a for a, ok, _ in res if not ok]
            missing = [a for a in must if a not in red]
            good = not missing and not [a for a in red if a.startswith('X')]
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-12s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run(src, 'main')
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:700]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            seen = [a for a, _, _ in res]
            new_green = [a for a in NEW if a in seen and a not in failed]
            new_unseen = [a for a in NEW if a not in seen]
            old_red = [a for a in failed if a not in NEW]
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
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
