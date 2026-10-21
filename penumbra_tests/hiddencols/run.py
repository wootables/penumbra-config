# =============================================================================
# HIDDEN-COLUMNS SUITE (2026-09-30)
#
# Hidden columns used to cost as much as shown ones: the flat build formatted
# and parsed every hidden cell, and several passes scanned or restyled every
# cell. The change (hc_patch.py) builds a hidden column's cells EMPTY and fills
# them from masterRowData the moment anything needs their content. This suite
# proves that is INVISIBLE: each scenario loads the REAL main.js twice - the
# BASELINE build (before the change) and the CANDIDATE - through the real run
# path on a 300-row, 20-column fixture (14 hidden columns of every value
# shape), drives one reader of hidden cells, and requires the two builds'
# fingerprints to be identical (D-*), the page errors to match (E-*), and the
# candidate's empty-cell census to be what the design says (L-*: the columns
# the scenario reads are filled, the rest still EMPTY, and no cell still marked
# empty holds content).
#
#   py -3 run.py                              candidate = live js\main.js, baseline = newest js\main.js.bak-*-hiddencols
#   py -3 run.py --candidate F --baseline B   any two builds (a stage vs the live copy before deploy)
#   py -3 run.py --control                    candidate := baseline: every L-* / N-* assert must go RED
#   py -3 run.py --mutant NAME                one hook taken out of the candidate
#   py -3 run.py --mutants                    every mutant, each checked against the asserts it MUST turn red
#   --scn a,b                                 a subset of scenarios; --keep keeps the staging dir
#   Both builds load alike (2026-10-20): lazy rows off, the same URL per scenario - so the
#   live js\main.js as candidate AND baseline is GREEN (it was 46/10 RED: see lazy_rows_off).
#
# Headless Edge over CDP (real time, real frames); stages into %TEMP%; writes
# nothing to the webroot. Needs Python 3 + websocket-client (py -3 -m pip install websocket-client).
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

ALL_SCN = ['boot', 'killswitch', 'killswitch2', 'show', 'sortnum', 'sorttext', 'group', 'group2', 'groupsort', 'fmt', 'heat',
           'rewrite', 'copydistinct', 'copydialog', 'template', 'nestedplan', 'search', 'default7', 'notice', 'wrap']
DIFF_SCN = [s for s in ALL_SCN if s not in ('notice', 'wrap')]
COLS = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML',
        'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE']
HIDDEN = COLS[6:]
ROWS = 300
# Columns each scenario makes the app read or show - filled; every other hidden column stays EMPTY.
FILLED = {
    'boot': [], 'show': ['H_TEXT', 'H_NUM', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL'],
    'sortnum': ['H_NUM'], 'sorttext': ['H_ENT', 'H_TEXT'], 'group': ['H_GROUP', 'H_AMT'],
    'group2': ['H_GROUP', 'H_GROUP2', 'H_MONEY'], 'groupsort': ['H_NUM'],
    'fmt': ['H_FLAG', 'H_NUM', 'H_TEXT', 'H_MONEY'], 'heat': ['H_NUM', 'H_AMT'],
    'rewrite': ['H_CODE', 'H_JSON'],   # copy_distinct runs the nested-column plan first, which fills the @@JSON parent
    'copydistinct': ['H_TEXT', 'H_ENT', 'H_JSON'], 'copydialog': ['H_ENT', 'H_JSON'],
    'template': ['H_TEXT', 'H_ENT', 'H_HTML', 'H_NL', 'H_JSON', 'H_NULL'], 'nestedplan': ['H_JSON'],
    'search': [], 'default7': ['H_TEXT'],
}

# --- mutants: name -> (edits on the CANDIDATE, assert ids that MUST go red) --------------------
# An edit's anchor must occur exactly once (i.e. the candidate must be the FIXED build).
MUTANTS = {
    'eager':          ([("if (_lazyBuild && (!isColumnVisible || !_rowEager)) {", "if (false) {")], ['L-boot']),
    'nosortfill':     ([("            penumbraFillLazyColumns(sortCriteria.map(function (c) { return c.colIndex; }));", "")], ['D-sortnum', 'D-sorttext', 'D-groupsort']),
    'nolevel0':       ([("            penumbraFillLazyColumns([colId]);   // a hidden grouping column's cells may be EMPTY", "")], ['D-group', 'D-group2']),
    'nolevels':       ([("        penumbraFillLazyColumns([colId]);   // a hidden level column's cells may be EMPTY (2026-09-30)", "")], ['D-group2']),
    'noaggrebuild':   ([("        if (currentGroupAgg && currentGroupAgg.column) penumbraFillLazyColumnsByName([currentGroupAgg.column]);", "")], ['D-group2']),
    'nocffill':       ([("                if (_cfNamed.length) penumbraFillLazyColumnsByName(_cfNamed);", "")], ['D-fmt']),
    'noheatfill':     ([("                heatRules.forEach(function (rule) { if (rule.columns) penumbraFillLazyColumnsByName(rule.columns); });", "")], ['D-heat']),
    'norewritefill':  ([("                penumbraFillLazyColumnsByName(rewriteRules.map(function (r) { return r.targetColumn; }));", "")], ['D-rewrite']),
    'nocopyfill':     ([("                                    penumbraFillLazyColumns([colId]);   // a hidden column's cells may be EMPTY", "")], ['D-copydistinct']),
    'nodialogfill':   ([("                        penumbraFillLazyColumns([colIdSingleCol]);   // a hidden column's cells may be EMPTY", "")], ['D-copydialog']),
    'nodialognested': ([("                        penumbraFillLazyColumns([nestedColId]);   // a hidden parent's cells may be EMPTY", "")], ['D-copydialog']),
    'notplfill':      ([("        penumbraFillLazyColumnsByName(templatePlaceholdersUpper);", "")], ['D-template']),
    'noplanfill':     ([("            if (_npFill.length) penumbraFillLazyColumns(_npFill);", "")], ['D-nestedplan', 'D-template']),
    'nowidthprobe':   ([("var _cProbe = $sCell[0].hasAttribute('data-pnb-lazy') ? _pnbLazyCellProbe($sCell[0], _cwNameById) : null;", "var _cProbe = null;")], ['D-group']),
    'nolazyskip':     ([("                    if (cell.hasAttribute('data-pnb-lazy')) {", "                    if (false) {")], ['L-fmt']),
    # B1 (2026-09-30): the show-a-column nets are applyPagination's fill of the rows on
    # screen and penumbraFillForView's whole-column fill of a column hidden at build.
    # applyPagination hands both calls its row lists since 3a9ac0b (2026-10-19, bigperf).
    'noshowfill':     ([("        _pnbFillDisplayedRows(_pnbPageRows);\r\n\r\n        // AFTER the page loop", "\r\n        // AFTER the page loop"),
                        ("        var n = shownHidden.length ? penumbraFillLazyColumns(shownHidden) : 0;\r\n", "        var n = 0;\r\n")], ['D-show']),
    'nodefault7fill': ([("        _pnbFillDisplayedRows(_pnbPageRows);\r\n\r\n        // AFTER the page loop", "\r\n        // AFTER the page loop"),
                        ("        if ($('#groupedResultsContainer').is(':visible')) return penumbraFillVisibleLazyColumns();\r\n        var shownHidden = [];\r\n",
                         "        if ($('#groupedResultsContainer').is(':visible')) return penumbraFillVisibleLazyColumns();\r\n        return 0;\r\n        var shownHidden = [];\r\n")], ['D-default7']),
    'nocount':        ([("        // columns included, ~0.4 s); after it, one page.\r\n        updateFilteredResultCount(allRows);\r\n", "        // columns included, ~0.4 s); after it, one page.\r\n")], ['D-search']),
    'noswitch':       ([("        if (/[?&]lazycells=off(?:&|$)/i.test(window.location.search)) return false;", "")], ['L-killswitch']),
    'noflag':         ([("        try { if (penumbra_vars && penumbra_vars.lazyCellsOff) return false; } catch (e) { }", "")], ['L-killswitch2']),
    'oldtip':         ([("or hide columns nobody needs.')", "Hiding columns does not help.')")], ['N-notice']),
    'noweight':       ([("        const empty = Math.min(cols, emptyColCount || 0);", "        const empty = 0;")], ['N-notice']),
    # Layers that are deliberately REDUNDANT - taking one out alone must change nothing
    # (each is covered by another), so these must stay GREEN. Listed so the claim is tested.
    # Lazy rows (B1): applyPagination now fills only the rows on screen, so this Settings Apply
    # net is the one whole-column fill for a column shown there - no longer redundant
    'noapplyfill':    ([("        // rows); the grouped rebuild below fills every row it clones.\r\n        penumbraFillForView();\r\n", "        // rows); the grouped rebuild below fills every row it clones.\r\n")], ['D-show']),
    'eq-noaggrecalc': ([("        if (_rcaAggColId !== null) penumbraFillLazyColumns([_rcaAggColId]);   // hidden summary column (2026-09-30)", "")], []),
}
MUTANT_SCN = {
    'eager': ['boot'], 'nosortfill': ['sortnum', 'sorttext', 'groupsort'], 'nolevel0': ['group', 'group2'], 'nolevels': ['group2'],
    'noaggrebuild': ['group2'], 'nocffill': ['fmt'], 'noheatfill': ['heat'], 'norewritefill': ['rewrite'],
    'nocopyfill': ['copydistinct'], 'nodialogfill': ['copydialog'], 'nodialognested': ['copydialog'], 'notplfill': ['template'],
    'noplanfill': ['nestedplan', 'template'], 'nowidthprobe': ['group'], 'nolazyskip': ['fmt'], 'noshowfill': ['show'],
    'nodefault7fill': ['default7'], 'nocount': ['search'], 'noswitch': ['killswitch'], 'noflag': ['killswitch2'], 'oldtip': ['notice'], 'noweight': ['notice'],
    'noapplyfill': ['show'], 'eq-noaggrecalc': ['group', 'group2'],
}

# --- args -------------------------------------------------------------------------------------
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
app_dir = opt('--app', APP)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if not base_path:
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-hiddencols'))
    if not baks:
        raise SystemExit('no baseline: pass --baseline <main.js before the change> (the deploy leaves js\\main.js.bak-<stamp>-hiddencols)')
    base_path = baks[-1]
if control:
    cand_path = base_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, and
    hideLoading counts its calls (the end of a run / search / apply)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['openSettingsPanel', 'runTableSearch', 'executeChainStep', 'generateTemplateOutput', 'getNestedColumnPlan',
             'penumbraBigRenderNotice', '_pnbHorizontalScrollTargets', '_pnbVisibleResultsWrapper', 'applyPagination']
    h = ('\r\n;try { window.__HC = { lazyCols: function () { try { return eval("_pnbLazyCols"); } catch (e) { return null; } } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    edits, _ = MUTANTS[name]
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:100]))
        src = src.replace(old, new)
    return src

# --- staging + browser ------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_hc_')
for d in ('base', 'cand'):
    os.makedirs(os.path.join(stage, d))
    for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, d, f))
    shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, d, 'main.css'))
    shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, d, 'harness.html'))
    shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, d, 'driver.js'))

def write_build(d, text):
    open(os.path.join(stage, d, 'main_hc.js'), 'wb').write(text.encode('utf-8', 'surrogateescape'))

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
    try: urllib.request.urlopen('http://127.0.0.1:%d/base/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(d, scn, extra=''):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == mid: return m.get('result', {})
    try:
        call('Page.enable')
        # Every build is written to the same main_hc.js: never let the browser serve a
        # cached copy (heuristic freshness once handed a mutant the previous build).
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s/harness.html?scn=%s%s' % (hp, d, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the scenario (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

# --- assertions ---------------------------------------------------------------------------------
def first_diff(a, b):
    if isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            x = a[i] if i < len(a) else '<none>'; y = b[i] if i < len(b) else '<none>'
            if x != y: return 'line %d: baseline=%s | candidate=%s' % (i, str(x)[:160], str(y)[:160])
        return 'equal'
    return 'baseline=%s | candidate=%s' % (json.dumps(a)[:200], json.dumps(b)[:200])

def check(scn, base, cand):
    out = []
    def rec(aid, ok, detail=''): out.append((aid, bool(ok), detail))
    if cand.get('fatal') or base.get('fatal'):
        rec('F-' + scn, False, 'fatal: base=%s cand=%s' % (str(base.get('fatal'))[:200], str(cand.get('fatal'))[:200])); return out
    if cand.get('missing'): rec('H-' + scn, False, 'hook missing ' + ','.join(cand['missing']))
    if scn in DIFF_SCN:
        diffs = [k for k in sorted(set(base['fp']) | set(cand['fp'])) if base['fp'].get(k) != cand['fp'].get(k)]
        detail = 'identical (%s)' % ','.join(sorted(base['fp'])) if not diffs else '; '.join(
            '%s: %s' % (k, first_diff(base['fp'].get(k, {}).get('table') if isinstance(base['fp'].get(k), dict) and 'table' in base['fp'].get(k, {}) else base['fp'].get(k),
                                      cand['fp'].get(k, {}).get('table') if isinstance(cand['fp'].get(k), dict) and 'table' in cand['fp'].get(k, {}) else cand['fp'].get(k)))
            for k in diffs[:2])
        if diffs and all(isinstance(base['fp'].get(k), dict) and 'groups' in base['fp'].get(k, {}) for k in diffs[:1]):
            detail = '; '.join('%s: %s' % (k, first_diff(base['fp'][k]['groups'], cand['fp'][k]['groups'])) for k in diffs[:2])
        rec('D-' + scn, not diffs, detail)
        rec('E-' + scn, base.get('errors') == cand.get('errors'), 'base=%s cand=%s' % (base.get('errors'), cand.get('errors')))
        # candidate census
        c = cand.get('census') or {}
        per = c.get('perCol') or {}
        want = {}
        if scn not in ('killswitch', 'killswitch2'):
            for h in HIDDEN:
                if h not in FILLED.get(scn, []): want[str(COLS.index(h))] = None   # still EMPTY (count checked below)
        ok = True; bad = []
        if scn in ('killswitch', 'killswitch2'):
            ok = c.get('flatLazy') == 0; bad = ['flatLazy=%s' % c.get('flatLazy')]
        else:
            for h in FILLED.get(scn, []):
                if per.get(str(COLS.index(h)), 0) != 0: ok = False; bad.append('%s still EMPTY x%d' % (h, per.get(str(COLS.index(h)))))
            for cid in want:
                if per.get(cid, 0) < ROWS: ok = False; bad.append('%s EMPTY only x%d' % (COLS[int(cid)], per.get(cid, 0)))
            if c.get('lazyWithContent', 0) != 0: ok = False; bad.append('marked-empty cells WITH content: %d' % c.get('lazyWithContent'))
            if scn == 'boot' and c.get('flatLazy') != ROWS * len(HIDDEN): ok = False; bad.append('flatLazy=%s' % c.get('flatLazy'))
        rec('L-' + scn, ok, ('filled %s; the other %d hidden columns EMPTY in every row' % (FILLED.get(scn, []) or 'nothing', len(want))) if ok else '; '.join(bad[:4]))
    if scn == 'notice':
        n1, n2 = cand['fp'].get('notice', {}), cand['fp'].get('notice2', {})
        ok = n1.get('shown') and 'does not help' not in (n1.get('tip') or '') and 'hide columns' in (n1.get('tip') or '') and n1.get('msg') != n2.get('msg')
        rec('N-notice', ok, 'tip=%r | 140 of 150 empty: %r | none empty: %r' % (n1.get('tip'), (n1.get('msg') or '')[:90], (n2.get('msg') or '')[:90]))
    if scn == 'wrap':
        w = cand['fp'].get('wrap', {})
        rec('W-wrap', w.get('sameTargets') and w.get('sameWrapper') and w.get('wrapperIsReal'), json.dumps(w))
    return out

# Deliberate LATER changes the baseline must carry too, so the comparison stays like with
# like: (name, old, new) - applied to the baseline when the candidate holds `new` and the
# baseline holds `old` exactly once. sortpage (2026-09-30): the on-load sort re-pages, so
# page 1 is the top of the sorted order (the pre-fix builds showed the original first page).
_SP_OLD = ("                                updateHeaderIcons();\r\n"
           "                                applyZebraStriping();\r\n"
           "                            }\r\n"
           "                        }\r\n")
_SP_NEW = ("                                updateHeaderIcons();\r\n"
           "                                // Page the SORTED order (2026-09-30). This sort runs after the\r\n"
           "                                // load path's applyPagination() above, which picked page 1 from\r\n"
           "                                // the BUILD order - so page 1 showed the original first page\r\n"
           "                                // re-ordered, and rows that belong at the top of the sort stayed\r\n"
           "                                // hidden until the reader paged away and back. Same tail as a\r\n"
           "                                // header-click sort; applyPagination() also re-stripes and\r\n"
           "                                // re-applies format() / rewrite() over the new page.\r\n"
           "                                currentPage = 1;\r\n"
           "                                applyPagination();\r\n"
           "                            }\r\n"
           "                        }\r\n")
# grplist (2026-10-03): recalculateGroupTotals() reads a footer's columns from the first
# INNERMOST group's own heading row. With nesting it read every inner group's headings under
# the first OUTER band, so each nested footer had one cell per column per inner group.
_GL_OLD = '        // Hoisted out of the per-group loop: this is a document-scoped :first\r\n        // query whose result is identical for every group (headers are uniform),\r\n        // and it was re-run once per wrapper. 2026-08-01\r\n        const visibleColumnOrder = $("#groupedResultsContainer .group-wrapper:first th[data-colname]:not([style*=\'display: none\'])").map(function () {\r\n'
_GL_NEW = '        // Hoisted out of the per-group loop: this is a document-scoped :first\r\n        // query whose result is identical for every group (headers are uniform),\r\n        // and it was re-run once per wrapper. 2026-08-01\r\n        // The first INNERMOST group\'s OWN heading row (2026-10-03, grplist): with\r\n        // nesting, .group-wrapper:first is an outer band, and every th below it -\r\n        // each of its inner groups\' headings - came back, so each footer got one\r\n        // cell per column PER inner group (3 groups x 7 columns = 21 cells), and\r\n        // the fixed-layout table made room for all 21: the real columns shrank\r\n        // into about half the width, the rest an empty footer.\r\n        const visibleColumnOrder = $("#groupedResultsContainer .group-wrapper.group-leaf:first > .group-content > table > thead > tr > th[data-colname]:not([style*=\'display: none\'])").map(function () {\r\n'
# tn1 (2026-10-10, 3a14daa): a custom template keeps a multi-line cell's line breaks
# (each <br> the cell shows is a \n; the old reader glued "Delta\nLima" into "DeltaLima").
# The template scenario fills H_NL, so D-template went red on every run from then on.
_TN_FN_OLD = ("        return (cellNode.textContent || '').trim();\r\n    }\r\n\r\n"
              "    // Strips machine-generated __SNAP_TYPE group clauses (the comparison\r\n")
_TN_FN_NEW = ("        return (cellNode.textContent || '').trim();\r\n    }\r\n\r\n" + r"""    // A cell's text for a custom template (2026-10-10, the user: "do it as-shown with a real newline if a newline is in
    // the cell (not wrapping)"): each <br> the cell shows is a line break - the screen draws a plain cell's \n as one -
    // where textContent alone glued "line1\nline2" into "line1line2". A newline right before a <br> is the \r of the
    // \r\n it ended (only the \n becomes a <br>; the parser turns the \r into \n) and goes. Wrapping adds nothing. The
    // twin of penumbra_tpl_cell_text (penumbra_template.php) - tplparity pins the two. A template puts a field back on
    // one line with string(regex_replace, {COL}, '\s*\n\s*', ' ').
    function _readTemplateCellText(cellNode) {
        if (!cellNode) return '';
        var src = (cellNode.querySelector && cellNode.querySelector('.snap-ba-now-only')) || cellNode;
        if (!src.querySelector || !src.querySelector('br')) return (src.textContent || '').trim();
        var copy = src.cloneNode(true), brs = copy.querySelectorAll('br');
        for (var i = brs.length - 1; i >= 0; i--) {   // last first: each <br>'s previous sibling is still the cell's own
            var br = brs[i], prev = br.previousSibling;
            if (prev && prev.nodeType === 3 && prev.nodeValue.slice(-1) === '\n') prev.nodeValue = prev.nodeValue.slice(0, -1);
            br.parentNode.replaceChild(document.createTextNode('\n'), br);
        }
        return (copy.textContent || '').trim();
    }

    // Strips machine-generated __SNAP_TYPE group clauses (the comparison
""".replace('\n', '\r\n'))
_TN_CALL_OLD = ("                    // .text() rendered both dual views glued into the template.\r\n"
                "                    plainSubs[upperName] = _readComparisonCellText($row.find(`td[data-column='${h.id}']`)[0]);\r\n")
_TN_CALL_NEW = ("                    // .text() rendered both dual views glued into the template.\r\n"
                "                    // Its line breaks as the cell shows them (2026-10-10; they were glued together).\r\n"
                "                    plainSubs[upperName] = _readTemplateCellText($row.find(`td[data-column='${h.id}']`)[0]);\r\n")
BASELINE_FIXES = [('sortpage', _SP_OLD, _SP_NEW), ('grplist-footer', _GL_OLD, _GL_NEW),
                  ('tn1-template-newlines', _TN_FN_OLD, _TN_FN_NEW), ('tn1-template-newlines-call', _TN_CALL_OLD, _TN_CALL_NEW)]
def fix_baseline(base_text, cand_text):
    for name, old, new in BASELINE_FIXES:
        # ...and not when the baseline has it already (a later build as the baseline).
        if new in cand_text and new not in base_text and base_text.count(old) == 1:
            base_text = base_text.replace(old, new)
            print('  baseline carries the later fix: %s' % name)
    return base_text

# Lazy ROWS (2026-09-30) are the lazyrows suite's to test. This suite compares hidden-
# column cells in EVERY row, off-page ones included, so BOTH builds build every row in
# full - the hidden COLUMNS stay lazy, which is what this suite is about. Both, not just
# the candidate (2026-10-20): a baseline WITH lazy rows (any build since 2026-09-30, e.g.
# the live copy a stage is compared against) built rows 201-300 as EMPTY shells, so every
# flat fingerprint differed from row 201 on - 10 D-* red with the same main.js on both
# sides. A build that has lazy rows but not this switch line stops the run.
_LR_ON = "                        const _lazyRowsOn = _lazyBuild && _rppAtBuild !== 'all';\r\n"
_LR_OFF = "                        const _lazyRowsOn = false;   // hiddencols suite: lazy rows off\r\n"
def lazy_rows_off(src, who):
    n = src.count(_LR_ON)
    if n == 1:
        print('  %s: lazy rows off (the lazyrows suite covers them)' % who)
        return src.replace(_LR_ON, _LR_OFF)
    if 'const _lazyRowsOn' in src:
        raise SystemExit('%s: this build has lazy rows, but its switch line was found %d times - update _LR_ON' % (who, n))
    return src   # from before lazy rows: every row is built in full

BASE_CACHE = {}   # the baseline never changes within a run - load each scenario once
def run_suite(cand_text, scns, label):
    if not BASE_CACHE:
        write_build('base', hook(lazy_rows_off(fix_baseline(read_b(base_path), cand_text), 'baseline')))
    write_build('cand', cand_text)
    results = []
    for s in scns:
        # The same URL for BOTH builds (2026-10-20): killswitch's &lazycells=off is what
        # makes it compare every cell, and a baseline with lazy cells built its hidden
        # ones EMPTY without it. A build from before lazy cells ignores the flag.
        extra = '&lazycells=off' if s == 'killswitch' else ''
        if s in DIFF_SCN and s not in BASE_CACHE:
            BASE_CACHE[s] = run_page('base', s, extra)
        b = BASE_CACHE.get(s, {'fp': {}})
        c = run_page('cand', s, extra)
        results.extend(check(s, b, c))
    return results

try:
    scns = scn_arg.split(',') if scn_arg else ALL_SCN
    cand_src = lazy_rows_off(read_b(cand_path), 'candidate')   # the baseline's: run_suite
    print('candidate: %s%s\nbaseline:  %s' % (cand_path, '   (CONTROL: candidate = baseline)' if control else '', base_path))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            _, must = MUTANTS[name]
            res = run_suite(hook(mutate(cand_src, name)), MUTANT_SCN[name], name)
            red = [a for a, ok, _ in res if not ok]
            if must:
                missing = [m for m in must if m not in red]
                good = not missing
                msg = 'turns %s red   [red: %s]' % (' '.join(must), ' '.join(red)) if good else 'stayed GREEN on %s   [red: %s]' % (' '.join(missing), ' '.join(red))
            else:
                good = not red
                msg = 'equivalent layer: all GREEN, as documented' if good else 'NOT equivalent - red: %s' % ' '.join(red)
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-15s %s' % ('PASS' if good else 'FAIL', name, msg), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run_suite(hook(cand_src), scns, 'main')
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %-16s %s' % ('PASS' if ok else 'FAIL', aid, detail[:300]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
