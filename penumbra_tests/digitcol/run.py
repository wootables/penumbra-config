# =============================================================================
# DIGIT-NAMED COLUMNS SUITE (digitcol, 2026-10-25)
#
# A column named only in digits - 2021, as a PIVOT query yields - comes back from
# jQuery's data('colname') as the NUMBER 2021, and every reader that then called a
# string method on it threw. The one found first: on a report with such a column AND
# a nested-table (@@JSON) column the grouping dialog never opened (getColumnsForGrouping
# -> search_builder.js getAvailableColumns upper-cased every name). The fix String()s
# the name at each reader that needs text (main.js x21, search_builder.js x1); the sort
# identifier a header click keeps stays data()'s own value, as before.
#
# Each scenario boots the REAL main.js through the real run path (stubbed query.php) on
# a 60-row PIVOT-shaped fixture (2021, 2022, V_ID, V_NAME, V_STATUS, J_SUBS @@JSON):
#   dlg     the Group icon -> the dialog's pickers (no search builder: main.js's own list)
#   dlgsb   the same with search_builder.js loaded, as index.php loads it
#   plainsb no nested-table column (the dialog opened before the fix): the same columns, plus the bin
#           entries a numeric column named in digits now gets like any numeric column
#   sweep   format() / rewrite() rules, data(colorder|colvisible|colsort|coltotal), the
#           API snippet's fields, the chart drill breakdown, the scheduler's change-column
#           list, the copy_distinct| / sort| / group| commands (search builder loaded)
#   P-*  premises (data() really hands back the number; the rows; the search builder)
#   G-*  the grouping dialog; F-* rules applied; U-* one reader each; K-* commands; E-* page errors
#
#   py -3 run.py                        candidate = live js\main.js + js\search_builder.js
#   py -3 run.py --stage DIR            DIR\main.js + DIR\search_builder.js (a stage)
#   py -3 run.py --candidate F --sb F   any builds
#   py -3 run.py --control              the pre-fix build: EXACTLY the CONTROL_RED asserts
#                                       fail. The fix is live since 306438e: the control reads
#                                       306438e^ from git (--rev REV for another build).
#   py -3 run.py --stage DIR --mutants  every mutant on the stage, each turning its asserts red
#   py -3 run.py --mutant NAME          one; --scn a,b a subset; --keep keeps the staging dir
#
# Headless Edge over CDP; stages into %TEMP%\pnb_dc_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(errors='backslashreplace')   # a heading's sort arrows on a cp1252 console
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import git_show
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_SCN = ['dlg', 'dlgsb', 'plainsb', 'sweep']

SWEEP_U = ['F-cf', 'F-rw', 'U-grpcols', 'U-sbfallback', 'U-coltotal', 'U-colorder', 'U-colvisible', 'U-apicols', 'U-rulesfirst',
           'U-snippetdom', 'U-chartdrill', 'U-sched', 'U-nestplan', 'K-distinct', 'U-copydlg', 'K-sort', 'U-colsort', 'K-group', 'K-pivot']
# What the pre-fix build gets wrong - and ONLY that (the P-* premises hold on it too).
# (plainsb: the dialog opened before the fix too - only its bin entries for 2022 were missing)
CONTROL_RED = (['G-dlg-open', 'G-dlg-list', 'G-dlg-by2021', 'E-dlg', 'G-dlgsb-open', 'G-dlgsb-list', 'G-dlgsb-by2021', 'E-dlgsb', 'G-plainsb-buckets']
               + SWEEP_U + ['E-sweep'])
def scn_of(aid):
    if aid in SWEEP_U: return 'sweep'
    return aid.split('-')[1]   # G-<scn>-x, E-<scn>, P-<scn>

# --- mutants: one fix site put back as it was (on the FIXED build) -> the asserts that MUST go red --
D = '// a name in digits (2021) is a number to data()'
NL = '\r\n'
def L(*lines): return NL.join(lines)
MUTANTS = {
    'sbapi': ('main', [(L("                // (2026-10-25, digitcol) String: jQuery's data() hands a name in digits (a PIVOT's 2021)",
                          "                // back as a NUMBER, and the pickers this list feeds upper-case every name (the grouping",
                          "                // dialog's pickers broke on a report with such a column and a nested-table one).",
                          "                var dc = String($(this).data('colname'));"),
                        "                var dc = $(this).data('colname');")]),
    'grpfallback': ('main', [("            if (name) name = String(name);   // (2026-10-25, digitcol) a name in digits (2021) is a number to data()" + NL, "")]),
    'sbfallback': ('sb', [(L("                const raw = $(this).data('colname');",
                             "                if (!raw) return;",
                             "                const name = String(raw);   // (2026-10-25) a name in digits (2021) is a number to data()"),
                           L("                const name = $(this).data('colname');",
                             "                if (!name) return;"))]),
    'cfmeta': ('main', [("                    const _cn = $(this).data('colname'), colName = _cn ? String(_cn) : _cn;   " + D + NL + "                    const colId = $(this).data('column');" + NL + "                    if (colName) {" + NL + "                        colMapping.push(",
                         "                    const colName = $(this).data('colname');" + NL + "                    const colId = $(this).data('column');" + NL + "                    if (colName) {" + NL + "                        colMapping.push(")]),
    'rwmeta': ('main', [("                const _cn = $(this).data('colname'), colName = _cn ? String(_cn) : _cn;   " + D + NL + "                const colId = $(this).data('column');" + NL + "                if (colName) {" + NL + "                    colNameToId[",
                         "                const colName = $(this).data('colname');" + NL + "                const colId = $(this).data('column');" + NL + "                if (colName) {" + NL + "                    colNameToId[")]),
    'coltotal': ('main', [("                    if (nm) nm = String(nm);   " + D + NL, "")]),
    'rulesig': ('main', [(".get().filter(Boolean).map(String);   " + D + NL + "            buildVirtualColumnNames().forEach(vc => { if (!visibleColumns.some(",
                          ".get().filter(Boolean);" + NL + "            buildVirtualColumnNames().forEach(vc => { if (!visibleColumns.some(")]),
    'snippetcols': ('main', [("            visibleColumns = $sourceHeaders.map((_, th) => $(th).data('colname')).get().filter(Boolean).map(String);   " + D,
                              "            visibleColumns = $sourceHeaders.map((_, th) => $(th).data('colname')).get().filter(Boolean);")]),
    'cmdgroup': ('main', [("                                    const _cn = $(this).data('colname'), name = _cn ? String(_cn) : _cn;   " + D + NL + "                                    if (name && name.toLowerCase() === _gcBase",
                           "                                    const name = $(this).data('colname');" + NL + "                                    if (name && name.toLowerCase() === _gcBase")]),
    'cmddistinct': ('main', [("                                    if (String($(this).data('colname') || '').toLowerCase() === distCol) {   " + D,
                              "                                    if (($(this).data('colname') || '').toLowerCase() === distCol) {")]),
    'cmdsort': ('main', [("                                if (name && String(name).toLowerCase() === sortColArg.toLowerCase()) {   " + D,
                          "                                if (name && name.toLowerCase() === sortColArg.toLowerCase()) {")]),
    # the sort| command's identifier made text: no longer what a header click keeps (the fix must not do this)
    'cmdsortstr': ('main', [("                                const name = $(this).data('colname');   // kept as data() gives it: a header click's sort keeps the same",
                             "                                const name = String($(this).data('colname'));")]),
    'dlcolorder': ('main', [("                    if (String($(this).data('colname')) === colParam) {   " + D,
                             "                    if ($(this).data('colname') === colParam) {")]),
    'dlcolvisible': ('main', [("return String($(this).data('colname')) === colParam.toUpperCase(); }).get(0);",
                               "return $(this).data('colname') === colParam.toUpperCase(); }).get(0);")]),
    'dlcolsort': ('main', [("                const crit = sortCriteria.find(c => String(c.colIdentifier).toUpperCase() === colParam);   // a header sort keeps data()'s number",
                            "                const crit = sortCriteria.find(c => c.colIdentifier.toUpperCase() === colParam);")]),
    'apicols': ('main', [(L("                    .filter(function (n) { return n && n !== '#'; })",
                            "                    .map(String);   " + D + ": row[\"2021\"], not row[2021]"),
                          "                    .filter(function (n) { return n && n !== '#'; });")]),
    'chartdrill': ('main', [("            return String($(this).data('colname'));   " + D + "; the rows are keyed by text",
                             "            return $(this).data('colname');")]),
    'schedcols': ('main', [("            if (name) name = String(name);   " + D + NL + "            if (!name || name === '#') return;",
                            "            if (!name || name === '#') return;")]),
    'cmdpivot': ('main', [("                                const _cn = $(this).data('colname'), name = _cn ? String(_cn) : _cn;   " + D + NL + "                                if (name && name.toLowerCase() === pVal",
                           "                                const name = $(this).data('colname');" + NL + "                                if (name && name.toLowerCase() === pVal")]),
    'copydistinct': ('main', [("                            if (String(dc) === selectedColumn) return true;   " + D,
                               "                            if (dc === selectedColumn) return true;")]),
    'nestplan': ('main', [("            const _cn = $(this).data('colname'), name = _cn ? String(_cn) : _cn;   " + D + NL + "            const colId = $(this).data('column');" + NL + "            if (!name || name === '#') return;",
                           "            const name = $(this).data('colname');" + NL + "            const colId = $(this).data('column');" + NL + "            if (!name || name === '#') return;")]),
}
# (the format() / rewrite() passes and the snippet's own render run again on every redraw - a sort,
#  a grouping, a copy's notice - so putting one of those readers back reddens the commands too)
MUTANT_RED = {
    'sbapi': ['G-dlgsb-open', 'G-dlgsb-list', 'G-dlgsb-by2021', 'E-dlgsb', 'U-grpcols', 'K-group', 'G-plainsb-buckets'],
    'grpfallback': ['G-dlg-open', 'G-dlg-list', 'G-dlg-by2021', 'E-dlg'],
    'sbfallback': ['U-sbfallback'],
    'cfmeta': ['F-cf', 'U-snippetdom', 'K-distinct', 'K-sort', 'K-group', 'E-sweep'],
    'rwmeta': ['F-cf', 'F-rw', 'U-snippetdom', 'K-distinct', 'K-sort', 'K-group', 'E-sweep'],
    'coltotal': ['U-coltotal'],
    'rulesig': ['U-rulesfirst'],
    'snippetcols': ['F-cf', 'F-rw', 'U-snippetdom', 'K-distinct', 'K-sort', 'E-sweep'],
    'cmdgroup': ['K-group'],
    'cmddistinct': ['K-distinct'],
    'cmdsort': ['K-sort', 'U-colsort'],
    'cmdsortstr': ['K-sort'],
    'dlcolorder': ['U-colorder'],
    'dlcolvisible': ['U-colvisible'],
    'dlcolsort': ['U-colsort'],
    'apicols': ['U-apicols'],
    'chartdrill': ['U-chartdrill'],
    'schedcols': ['U-sched'],
    'cmdpivot': ['K-pivot'],
    'copydistinct': ['U-copydlg'],
    'nestplan': ['U-nestplan'],
}
MUTANT_SCN = {k: (['dlg'] if k == 'grpfallback' else ['dlgsb', 'sweep', 'plainsb'] if k == 'sbapi' else ['sweep']) for k in MUTANTS}

# --- args -------------------------------------------------------------------------------------
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
cand_path = opt('--candidate', os.path.join(stage_dir, 'main.js') if stage_dir else os.path.join(APP, 'js', 'main.js'))
sb_path = opt('--sb', os.path.join(stage_dir, 'search_builder.js') if stage_dir else os.path.join(APP, 'js', 'search_builder.js'))
rev = opt('--rev', None)
app_dir = opt('--app', APP)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if rev and not control: raise SystemExit('--rev is for --control')
if control:
    # the fix is LIVE since 306438e (2026-10-25): the control is the build before it, read from git
    rev = rev or '306438e^'
    cand_path, sb_path = git_show(rev, 'js/main.js'), git_show(rev, 'js/search_builder.js')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, and
    hideLoading counts its calls (the end of a run / search / apply)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['getColumnsForGrouping', 'penumbraDataLookup', '_penumbraColTotal', 'getApiSnippetSampleColumns', '_pnbPivotRulesFirst',
             'renderReportSnippet', '_showChartDrillBreakdown', 'applyTaskTypeUI', 'executeChainStep', 'getNestedColumnPlan']
    h = ('\r\n;try { window.__JG = { master: function () { try { return eval("masterRowData"); } catch (e) { return null; } },'
         ' sortCrit: function () { try { return eval("sortCriteria"); } catch (e) { return null; } },'
         ' snippetText: function () { try { var e = eval("snippetEditor"); return (e && e.getValue) ? e.getValue() : ""; } catch (x) { return ""; } } }; } catch (e) { window.__JG_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__JG[k] = eval(k); } catch (e) { (window.__JG_MISSING = window.__JG_MISSING || []).push(k); } }); } catch (e) { window.__JG_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__JG_HIDES = (window.__JG_HIDES || 0) + 1;\r\n')

def mutate(main_src, sb_src, name):
    which, edits = MUTANTS[name]
    src = main_src if which == 'main' else sb_src
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:100]))
        src = src.replace(old, new)
    return (src, sb_src) if which == 'main' else (main_src, src)

# --- staging + browser ------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_dc_')
os.makedirs(os.path.join(stage, 'c'))
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, 'c', f))
shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, 'c', 'main.css'))
shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, 'c', 'harness.html'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'c', 'driver.js'))

def write_build(main_text, sb_text):
    open(os.path.join(stage, 'c', 'main_dc.js'), 'wb').write(main_text.encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'c', 'search_builder_dc.js'), 'wb').write(sb_text.encode('utf-8', 'surrogateescape'))

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
    try: urllib.request.urlopen('http://127.0.0.1:%d/c/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(scn):
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
        # Every build is written to the same files: never let the browser serve a cached copy.
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/c/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__DCDONE ? JSON.stringify(window.__DCRESULT) : null', 'returnByValue': True})
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

def run_suite(main_text, sb_text, scns):
    write_build(hook(main_text), sb_text)
    res, obs = [], {}
    for s in scns:
        r = run_page(s)
        if r.get('fatal'):
            res.append(('F-' + s, False, 'fatal: ' + str(r['fatal'])[:400])); continue
        if r.get('missing') or r.get('hookErr'):
            res.append(('H-' + s, False, 'hook: missing %s %s' % (r.get('missing'), r.get('hookErr'))))
        for a in r.get('asserts', []):
            res.append((a['id'], a['ok'], a['detail']))
        res.append(('E-' + s, not r.get('errors'), 'page errors: %s' % (r.get('errors') or 'none')))
        obs[s] = r.get('obs', {})
    return res, obs

try:
    scns = scn_arg.split(',') if scn_arg else ALL_SCN
    main_src, sb_src = read_b(cand_path), read_b(sb_path)
    print('candidate: %s + %s%s' % (cand_path, sb_path, '   (CONTROL: the pre-fix build)' if control else ''), flush=True)
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            must = MUTANT_RED[name]
            m_main, m_sb = mutate(main_src, sb_src, name)
            res, _ = run_suite(m_main, m_sb, MUTANT_SCN[name])
            red = [a for a, ok, _ in res if not ok]
            missing = [m for m in must if m not in red]
            stray = [a for a in red if a not in must]
            good = not missing and not stray
            msg = ('turns exactly %s red' % ' '.join(must)) if good else \
                  ('stayed GREEN on %s; also red: %s' % (' '.join(missing) or '-', ' '.join(stray) or '-'))
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-13s %s' % ('PASS' if good else 'FAIL', name, msg), flush=True)
            if not good:
                for a, ok, d in res:
                    if not ok: print('        %s %s' % (a, d[:260]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res, obs = run_suite(main_src, sb_src, scns)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %-18s %s' % ('PASS' if ok else 'FAIL', aid, detail[:400]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        for s in scns:
            o = obs.get(s) or {}
            keep_keys = [k for k in ('flatHead', 'level0', 'buckets', 'bands2021', 'sortCrit', 'drillHead', 'bootErrors') if k in o]
            if keep_keys: print('  obs %-6s %s' % (s, '; '.join('%s=%s' % (k, json.dumps(o[k])) for k in keep_keys))[:900])
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            want = [a for a in CONTROL_RED if scn_of(a) in scns]
            exact = sorted(failed) == sorted(want)
            print('CONTROL: %s (expected red: %s)' % ('red set is EXACTLY the documented bug' if exact else 'red set DIFFERS from CONTROL_RED', ' '.join(want)))
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
