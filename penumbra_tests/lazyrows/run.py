# =============================================================================
# LAZY-ROWS SUITE (2026-09-30)
#
# Rows past the first page are built as their <tr>, their '#' cell and EMPTY
# cells (data-pnb-lazy), filled when the row comes on screen or something reads
# it. This suite proves that is INVISIBLE: each scenario loads the REAL main.js
# twice - the BASELINE (every row built in full) and the CANDIDATE - through the
# real run path on the 300-row hiddencols fixture (200 rows a page, so rows
# 200-299 start EMPTY), drives one thing that shows or reads rows, and requires
#   D-*  identical fingerprints: the table as displayed (every cell of every row
#        on screen; the inside of an off-screen row's cells is skipped), the
#        grouped view, and every export / copy / PDF / XLSX output, whole
#   E-*  no page errors on either build
#   L-*  the candidate's census: lazy rows exist where the design says, no EMPTY
#        cell in a showing column of a row on screen, none left in the rows an
#        export read, and no cell still marked EMPTY that holds content
#
#   py -3 run.py                              candidate = live js\main.js, baseline = newest js\main.js.bak-*-lazyrows
#   py -3 run.py --candidate F --baseline B   any two builds (the stage vs live before the deploy)
#   py -3 run.py --control                    candidate := baseline: the L-* asserts that need lazy rows go RED
#   py -3 run.py --mutant NAME / --mutants    fill sites taken out of the candidate
#   --scn a,b                                 a subset of scenarios
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
JS_LIBS = ['jspdf-2.5.1.umd.min.js', 'jspdf-autotable-3.5.23.min.js', 'exceljs-4.4.0.min.js']   # loadScript('js/...')
SCN = [('boot', ''), ('page2', ''), ('rpp25', ''), ('rowsall', ''), ('toall', ''), ('rowsnone', ''),
       ('search', ''), ('sort', ''), ('savedsort', ''), ('presearch', '&search=H_FLAG%20%3D%20N'),
       ('show', ''), ('hide', ''), ('group', ''), ('fmt', ''), ('exports', ''), ('nested', ''),
       ('copyhtml', ''), ('copycsv', ''), ('copytsv', ''), ('copyjson', ''), ('copysql', ''), ('copycustom', ''),
       ('copysingle', ''), ('nestedsort', ''), ('cfglobal', ''), ('nonesearch', ''),
       ('prepcsv', ''), ('prepall', ''),
       ('email', ''), ('pdf', ''), ('xlsx', ''), ('killswitch', '&lazycells=off')]
# The prep* scenarios run the candidate with the "Preparing N rows..." threshold at 0,
# so the 300-row fixture takes the overlay path (a real report needs 60,000 cells).
PREP_SCN = ['prepcsv', 'prepall']
PREP_OLD = 'var _PNB_PREPARE_NOTICE_CELLS = 60000;'
PREP_NEW = 'var _PNB_PREPARE_NOTICE_CELLS = 0;'
# Scenarios whose outputs read EVERY row the search keeps: none may be left EMPTY there after.
READS_ALL = ['prepcsv', 'prepall', 'rowsnone', 'hide', 'group', 'fmt', 'exports', 'nested', 'copyhtml', 'copycsv', 'copytsv', 'copyjson', 'copysql',
             'cfglobal', 'nonesearch', 'pdf', 'xlsx', 'toall', 'rowsall', 'killswitch']
# (copysingle / copycustom read single columns - they fill those columns only, by design)

MUTANTS = {
    # the rows on screen are never filled: page 2, a search, a sort, Rows = All show EMPTY cells
    'nopagefill': ([("        _pnbFillDisplayedRows();\r\n\r\n        // AFTER the page loop, not before it (2026-09-30).", "\r\n        // AFTER the page loop, not before it (2026-09-30).")],
                   ['D-page2', 'D-rpp25', 'D-toall', 'D-search', 'D-sort', 'D-savedsort', 'D-presearch'], ['page2', 'rpp25', 'toall', 'search', 'sort', 'savedsort', 'presearch']),
    # the flat exports read EMPTY cells
    'noexportfill': ([("        if (format !== 'html' && !isPivotMode && !isGrouped) _pnbFillSearchVisibleRows();\r\n", "")],
                     ['D-exports', 'D-rowsnone'], ['exports', 'rowsnone']),
    # the flat PDF reads EMPTY cells
    'nopdffill': ([("                // Lazy rows (2026-09-30): this reads every row the search keeps.\r\n                _pnbFillSearchVisibleRows();\r\n", "")],
                  ['D-pdf'], ['pdf']),
    # the flat XLSX reads EMPTY cells
    'noxlsxfill': ([("            _pnbFillSearchVisibleRows();   // lazy rows (2026-09-30): this reads every row the search keeps\r\n", "")],
                   ['D-xlsx', 'L-xlsx'], ['xlsx']),
    # Copy as HTML over every page reads EMPTY rows
    'nocopyfill': ([("                            if (_rowList[_fj].style.display === 'none') _pnbFillRowWith(_rowList[_fj], _fillCtx);\r\n", "")],
                   ['D-copyhtml'], ['copyhtml']),
    # Copy as SQL reads EMPTY cells
    'nosqlfill': ([("                    _pnbFillSearchVisibleRows();   // lazy rows (2026-09-30): every row the search keeps is read\r\n", "")],
                  ['D-copysql'], ['copysql']),
    # a nested sub-table header sort skips the EMPTY rows, which fill unsorted later
    'nonestedfill': ([("            penumbraFillLazyColumns([colIndex]);\r\n            const $targetRows", "            const $targetRows")],
                     ['D-nestedsort'], ['nestedsort']),
    # a column-less format() term decides other pages' rows from EMPTY cells
    'noglobalfill': ([("                if (activeRules.some(function (rule) { return rule.parsedCondition && _pnbHasGlobalTerm(rule.parsedCondition); })) {\r\n                    _pnbFillSearchVisibleRows();\r\n                }\r\n", "")],
                     ['D-cfglobal'], ['cfglobal']),
    # a search's first page waits EMPTY under the veil until it pages
    'nofirstpage': ([("                _pnbFillFirstPageRows();\r\n", "")],
                    ['L-search'], ['search']),
    # Rows = None: the search's first-page fill already covers every match (Rows = None pages
    # nothing), so the None branch's own fill is belt and braces - must stay GREEN
    'eq-nononefill': ([("            // the email embed carries.\r\n            _pnbFillDisplayedRows();\r\n", "            // the email embed carries.\r\n")], [], ['nonesearch', 'rowsnone']),
    # columns not registered: every COLUMN reader (sort, format(), grouping, rewrite) skips the lazy rows
    'noregister': ([("                        if (_anyLazyRow) finalColumnOrder.forEach(c => _pnbLazyCols.add(String(columnNameToOriginalIndex[c])));\r\n", "")],
                   ['D-sort', 'D-group', 'D-fmt'], ['sort', 'group', 'fmt']),
    # the view net's fill of the rows on screen: applyPagination fills them after every
    # column toggle anyway - redundant by design, must stay GREEN
    'eq-noviewrows': ([("        return n + _pnbFillDisplayedRows();\r\n", "        return n;\r\n")], [], ['show', 'hide']),
    # lazy rows off: the build is eager again - L-boot must notice
    'eager': ([("                        const _lazyRowsOn = _lazyBuild && _rppAtBuild !== 'all';\r\n", "                        const _lazyRowsOn = false;\r\n")],
              ['L-boot'], ['boot']),
    # the plain-text fast path and the positional lookup change nothing but speed - must stay GREEN
    # no overlay: the fill still happens in the reader, the output is identical, but no
    # "Preparing N rows..." - L-prep* must notice
    'noprepare': ([("        if (rows * Object.keys(ctx.vis).length < _PNB_PREPARE_NOTICE_CELLS) return null;\r\n",
                    "        return null;\r\n")],
                  ['L-prepcsv', 'L-prepall'], ['prepcsv', 'prepall']),
    'eq-nofasttext': ([("            if (!cellNode.firstElementChild) return cellNode.textContent.trim();\r\n", "")], [], ['exports', 'copycsv']),
    'eq-nocellof': ([("            return (c && c.getAttribute('data-column') === String(id)) ? c : row.querySelector(\"td[data-column='\" + id + \"']\");\r\n",
                      "            return row.querySelector(\"td[data-column='\" + id + \"']\");\r\n")], [], ['exports', 'nested']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
cand_path = opt('--candidate', os.path.join(APP, 'js', 'main.js'))
base_path = opt('--baseline', None)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
verbose = flag('--verbose')
if not base_path:
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-lazyrows'))
    if not baks: raise SystemExit('needs --baseline <main.js before the change> (the deploy leaves js\\main.js.bak-<stamp>-lazyrows)')
    base_path = baks[-1]
if control:
    cand_path = base_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['openSettingsPanel', 'runTableSearch', 'applyPagination', 'getExportData', 'generatePdfContent',
             'createXlsxWorkbook', 'loadScript']
    h = ('\r\n;try { window.__HC = { lazyCols: function () { try { return eval("_pnbLazyCols"); } catch (e) { return null; } },'
         ' setPage: function (p) { currentPage = p; applyPagination(); }, getPage: function () { return currentPage; } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n')
    h += ('try { var __pnbSL = showLoading; showLoading = function (m) { (window.__loadMsgs = window.__loadMsgs || []).push(String(m)); return __pnbSL.apply(this, arguments); }; } catch (e) { window.__HC_ERR4 = String(e); }\r\n')
    h += ('try { var __pnbRRS = renderReportSnippet; renderReportSnippet = function () {'
          ' try { var rpp = parseInt($("#rowsPerPageSelector").val(), 10) || 1e9, vis = {}, n = 0, seen = 0;'
          ' document.querySelectorAll("#resultsTable > thead > tr#tableHeader th").forEach(function (th) { if (th.style.display !== "none") vis[th.getAttribute("data-column")] = 1; });'
          ' var rows = document.querySelectorAll("#resultsTable > tbody > tr");'
          ' for (var i = 0; i < rows.length && seen < rpp; i++) { if (rows[i].classList.contains("search-hidden")) continue; seen++;'
          ' for (var k = 0; k < rows[i].cells.length; k++) { var td = rows[i].cells[k]; if (td.hasAttribute("data-pnb-lazy") && vis[td.getAttribute("data-column")]) n++; } }'
          ' (window.__rrsCensus = window.__rrsCensus || []).push(n); } catch (e) { (window.__rrsCensus = window.__rrsCensus || []).push("err " + e); }'
          ' return __pnbRRS.apply(this, arguments); }; } catch (e) { window.__HC_ERR3 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_lr_')
os.makedirs(os.path.join(stage, 'js'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in JS_LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, 'js', f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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

def run_page(scn, extra):
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
        # Every build is written to the same main_hc.js: never let the browser serve a
        # cached copy (heuristic freshness once handed a mutant the previous build).
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
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

def run_build(text, scns, prep=False):
    out = {}
    plain = [s for s in scns if s not in PREP_SCN]
    preps = [s for s in scns if s in PREP_SCN]
    for group, t in ((plain, text), (preps, text.replace(PREP_OLD, PREP_NEW) if prep else text)):
        if not group: continue
        open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(t).encode('utf-8', 'surrogateescape'))
        for s, x in SCN:
            if s not in group: continue
            r = run_page(s, x)
            # A page that never finished LOADING (a harness hiccup - it passed on
            # re-run) gets one retry; a build that cannot load fails both times.
            if r.get('fatal') and 'never finished loading' in r['fatal']:
                r = run_page(s, x); r['retried'] = True
            out[s] = r
    return out

def first_diff(a, b):
    a = json.dumps(a, sort_keys=True); b = json.dumps(b, sort_keys=True)
    n = min(len(a), len(b)); i = 0
    while i < n and a[i] == b[i]: i += 1
    return 'at %d: base %r / cand %r' % (i, a[max(0, i - 60):i + 100], b[max(0, i - 60):i + 100])

def evaluate(base, cand, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r, b = cand.get(s, {}), base.get(s, {})
        if r.get('fatal') or b.get('fatal'):
            add('F-' + s, False, 'cand: %s | base: %s' % ((r.get('fatal') or '')[:250], (b.get('fatal') or '')[:250])); continue
        fr, fb = r.get('fp', {}), b.get('fp', {})
        bad = [k for k in sorted(set(fr) | set(fb)) if fr.get(k) != fb.get(k)]
        add('D-' + s, not bad, ('identical (%s)' % ','.join(sorted(fr))) if not bad else ('DIFFER in %s: %s' % (','.join(bad), first_diff(fb.get(bad[0]), fr.get(bad[0])))))
        add('E-' + s, not r.get('errors') and not b.get('errors') and not r.get('hookErr') and not r.get('clipErr'),
            'cand %s %s %s | base %s' % (r.get('errors'), r.get('hookErr'), r.get('clipErr'), b.get('errors')))
        c, c0 = r.get('census') or {}, r.get('census0') or {}
        ok = c.get('lazyShownDisplayed') == 0 and c.get('lazyWithContent') == 0 and c.get('groupedLazyShown', 0) == 0
        why = 'on screen %s, holding content %s, grouped %s' % (c.get('lazyShownDisplayed'), c.get('lazyWithContent'), c.get('groupedLazyShown'))
        if s == 'boot':
            ok = ok and c0.get('lazyRows', 0) >= 90 and c0.get('firstLazyRow') == 200
            why += '; lazy rows at load %s of %s (first at %s): rows 200-299 must start EMPTY' % (c0.get('lazyRows'), c0.get('rows'), c0.get('firstLazyRow'))
        if s == 'search':
            rrs = r.get('rrs') or []
            ok = ok and bool(rrs) and all(x == 0 for x in rrs)
            why += '; EMPTY showing cells in the first page at each snippet render: %s' % rrs
        if s in READS_ALL:
            ok = ok and c.get('lazySearchVisible') == 0
            why += '; EMPTY cells left in rows the search keeps: %s' % c.get('lazySearchVisible')
        if s in PREP_SCN:
            msgs = [m for m in (r.get('loadMsgs') or []) if m.startswith('Preparing ')]
            ok = ok and msgs == ['Preparing 100 rows...']
            why += '; "Preparing N rows..." shown: %s' % msgs
        if s == 'rowsall':
            ok = ok and c0.get('lazyRows') == 0
            why += '; Rows = All builds every row in full (lazy rows at load %s)' % c0.get('lazyRows')
        if s == 'killswitch':
            ok = ok and c0.get('lazyAny') == 0
            why += '; &lazycells=off builds every cell (EMPTY cells at load %s)' % c0.get('lazyAny')
        add('L-' + s, ok, why)
    return out

try:
    base_text, cand_text = read_b(base_path), read_b(cand_path)
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the baseline itself)' if control else ''))
    print('baseline:  %s' % base_path)
    names = [s for s, _ in SCN]
    if scn_arg: names = [s for s in names if s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        ok = bad = 0
        todo = [one_mutant] if one_mutant else list(MUTANTS)
        need = sorted(set(s for m in todo for s in MUTANTS[m][2]))
        base = run_build(base_text, need)
        for m in todo:
            edits, must, scns = MUTANTS[m]
            res = evaluate(base, run_build(mutate(cand_text, m), scns, prep=True), scns)
            red = [a for a, p, _ in res if not p]
            good = (not [x for x in must if x not in red]) if must else (not red)
            ok += good; bad += (not good)
            print('  %s  mutant %-14s %s   [red: %s]' % ('PASS' if good else 'FAIL', m,
                  ('turns %s red' % ' '.join(must)) if must else 'redundant by design: must stay GREEN', ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-14s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        base = run_build(base_text, names)
        cand = run_build(cand_text, names, prep=True)
        res = evaluate(base, cand, names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-14s %s' % ('PASS' if passed else 'FAIL', a, d[:400]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
