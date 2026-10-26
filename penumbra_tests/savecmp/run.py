# =============================================================================
# SAVECMP SUITE (2026-10-23) - a capture of the page made during a snapshot comparison writes the REPORT's view.
#
# A comparison takes the grouped container over: the page's grouping becomes its synthetic __SNAP_TYPE, and a sort
# one of its headings takes over (cmpsort) counts the comparison's own columns ('#' first: the report's NOTE 5 is
# the comparison's 6, its 5 is QTY). buildStateObject wrote both, so a Save, a ?state= link and a link to the view
# made during a comparison reopened the report grouped by a column it does not have (it came back flat: "Previous
# grouping dropped") and sorted by other columns than its own; the Save dialog's sort card showed the comparison's;
# ?sort= of the report's view answered none (a flat report's view link said 'none' and reopened unsorted); the
# grouping dialog's Presets chip saved a grouping by __SNAP_TYPE.
#
#   NOTE (2026-10-23): since a3591f9 (viewlink, 08:45) a link to the view made during a comparison is the comparison's
#   OWN link plus the view (m 'keep': no grouping, sort or filter; snapcmp= in the url; its round trip is viewlink's
#   vcmpB). G5 / F5 here check that link carries nothing of __SNAP_TYPE on top of this patch (green on live too);
#   the view link's own phase 2 pages were dropped with it. Its fixture snapshots carry server ids for that link.
#
#   phase 1 (?mode=grouped / ?mode=flat, ?id=savecmp): the REAL main.js runs REAL comparisons (compare-to-live and
#   A-vs-B) over the report saved grouped by DEPT and sorted by NOTE descending, and flat and sorted; the captures are
#   made through the real Server Save (its POST kept), buildViewStateURL and PenumbraViewLink.build, and handed back.
#   phase 2 (?mode=saved / state / view): each capture opened in a fresh page - the Save's state preloaded as a
#   saved report is, the ?state= link, the view link over a plain report - and the view it comes back in read.
#   The harness is cmpsort's (a copy) plus a DEPT column, the grouping dialog's fields with its Presets chip
#   (js/penumbra_presets.js, live), and the Server Save dialog's fields.
#
#   cmprq (2026-10-23): a NEW QUERY run during a comparison (Run, a changed prompt answer) stashed the comparison's
#   __SNAP_TYPE grouping and its sort for the run's success: a report grouped before the comparison came back flat,
#   sorted by the comparison's column (by name). F8 now checks the flat report comes back in its own sort; F10 the
#   same after an A-vs-B; page ?mode=rqgrouped (Q0-Q7) the grouped report: its grouping, summary, group sort, start
#   depth, limit, layout (and whether the layout was chosen) and its sort in every group, after the comparison's
#   own grouping dialog changed the layout and the group sort; Q4 a plain re-query (unchanged); Q5 an A-vs-B over a
#   snapshot VIEW (the view's grouping still drops, as a run from a snapshot view always did; the table's own sort);
#   Q6 a pivot a run that never completed left armed (planted) does not come back over the report's grouping; Q7 a
#   table opened from the console during a comparison (flat and unsorted, unchanged); page ?mode=rqsnapab (Q8) a
#   ?snapab= boot - its A-vs-B drawn before the report's query ever ran - then a new query: the saved view it armed.
#
#   py -3 run.py [--stage DIR]       the candidate's js\main.js from DIR, else live
#   py -3 run.py --control           live js\main.js: red on the checks of each fix it does not hold (NEW_SETS), the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate main.js (must turn their asserts red)
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot. One Edge suite at a time.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket
# the details carry the page's own text (a sort card's arrow): never fail on a console's code page
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
# Each fix's checks, red on a main.js without it (the rest - G0 G5 G9 G10 G13 F0 F5 F7 Q0 Q4 Q7 - are what the page
# always did, and stay green everywhere). --control reads which fixes the live main.js holds (by a marker) and expects
# red on exactly the checks of the ones it does not: savecmp is live since 9acef70 (2026-10-23 11:20).
NEW_SETS = [
    ('savecmp', 'function _pnbCmpOnScreen()',
     ['G1', 'G2', 'G3', 'G4', 'G6', 'G7', 'G8', 'G11', 'G12', 'F1', 'F2', 'F3', 'F4', 'F6', 'F9',
      'R-G-saved', 'R-G-state', 'R-F-saved', 'R-F-state']),
    # F8 checked the old carry-over (the comparison's sort by name) until cmprq
    ('cmprq', 'function _pnbCmpStashReportGrouping(', ['F8', 'F10', 'Q1', 'Q2', 'Q3', 'Q5', 'Q6', 'Q8']),
]
PAGES = ['grouped', 'flat', 'rqgrouped', 'rqsnapab', 'R-G-saved', 'R-G-state', 'R-F-saved', 'R-F-state']

# --- mutants: name -> (edits on the candidate main.js, assert ids that MUST go red, pages to run) ------------------
MUTANTS = {
    # the state's sort is the page's again (a comparison's, by its own column numbers)
    'm-sort': ([("            sortCriteria: _pnbStateSortCriteria(),   // (savecmp) a comparison's: the report table's own\n",
                 "            sortCriteria: sortCriteria,\n")], ['G2', 'F1', 'R-G-saved'], ['grouped', 'flat', 'R-G-saved']),
    # the grouped branch writes the comparison's __SNAP_TYPE again
    'm-group': ([("        if (_pnbCmpOnScreen()) {\n"
                  "            // (2026-10-23, savecmp) a snapshot comparison holds the grouped container: the\n"
                  "            // report's own grouping as the comparison found it, never its __SNAP_TYPE\n"
                  "            _pnbCmpStateGrouping(state);\n"
                  "        } else if ($('#groupedResultsContainer').is(':visible') && currentGroupingColumn) {\n",
                  "        if ($('#groupedResultsContainer').is(':visible') && currentGroupingColumn) {\n")],
                ['G1', 'F1', 'R-G-state', 'R-F-state'], ['grouped', 'flat', 'R-G-state', 'R-F-state']),
    # during a comparison the state carries no grouping at all (the grouped report saved flat)
    'm-grpall': ([("            _pnbCmpStateGrouping(state);\n", "")], ['G1', 'G3', 'R-G-saved'], ['grouped', 'R-G-saved']),
    # the comparison's entry records no start depth and no limit
    'm-capture': ([("            startDepth: currentGroupStartDepth || 0,\n"
                    "            limit: currentGroupLimit ? Object.assign({}, currentGroupLimit) : null,\n", "")],
                  ['G1', 'G3', 'R-G-saved'], ['grouped', 'R-G-saved']),
    # the grouping's summary, group sort, layout left out
    'm-grpagg': ([("        if (g.agg) state.groupAgg = { column: g.agg.column, type: g.agg.type };\n", "")], ['G1'], ['grouped']),
    'm-grpsort': ([("        if (g.sort && (g.sort.key !== 'label' || g.sort.dir !== 'asc')) state.groupSort = { key: g.sort.key, dir: g.sort.dir };\n", "")], ['G1'], ['grouped']),
    'm-grplayout': ([("        if (g.layout === 'list') state.groupLayout = 'list';\n", "")], ['G1', 'R-G-saved'], ['grouped', 'R-G-saved']),
    # the report's kept sort handed out itself, not a copy: editing a capture edits what Clear puts back
    'm-copy': ([("        return _pnbCmpReportSort.map(function (c) { return Object.assign({}, c); });\n",
                 "        return _pnbCmpReportSort;\n")], ['G8'], ['grouped']),
    # the kept sort used with no comparison on screen (a lazy exit to the home screen leaves one; a new query left one
    # too until cmprq, F8's target then)
    'm-gate': ([("        if (!_pnbCmpOnScreen() || _pnbCmpReportSort === null) return sortCriteria;\n",
                 "        if (_pnbCmpReportSort === null) return sortCriteria;\n")], ['G13'], ['grouped']),
    # the Save dialog's sort card shows the page's sort again
    'm-card': ([("        var _lscSort = _pnbStateSortCriteria();\n", "        var _lscSort = sortCriteria;\n")], ['G6', 'F6'], ['grouped', 'flat']),
    # ?sort= answers none under any comparison again
    'm-urlcmp': ([("        if (_pnbCmpOnScreen() ? _pnbCmpReportGrouped() : $('#groupedResultsContainer').is(':visible')) return '';\n",
                   "        if ($('#groupedResultsContainer').is(':visible')) return '';\n")], ['F2'], ['flat']),
    # ...serializes the page's (the comparison's) sort
    'm-urlsort': ([("        var chain = _pnbStateSortCriteria();\n        if (!chain || !chain.length) return '';\n",
                    "        var chain = sortCriteria;\n        if (!chain || !chain.length) return '';\n")], ['F2'], ['flat']),
    # ...serializes a sort for a report that was grouped under the comparison
    'm-urlgrouped': ([("        if (_pnbCmpOnScreen() ? _pnbCmpReportGrouped() : $('#groupedResultsContainer').is(':visible')) return '';\n",
                       "        if (_pnbCmpOnScreen() ? false : $('#groupedResultsContainer').is(':visible')) return '';\n")], ['G5'], ['grouped']),
    # (the review) the entry records a grouping that was removed (the page's column outlives it)
    'm-entryclass': ([("        if (!currentGroupingColumn || !$('body').hasClass('group-mode-active')) return;\n",
                       "        if (!currentGroupingColumn) return;\n")], ['G12'], ['grouped']),
    # ...keeps an earlier comparison's record on a flat entry
    'm-entrynull': ([("        _preCompareGrouping = null;\n        if (!currentGroupingColumn || !$('body').hasClass('group-mode-active')) return;\n",
                      "        if (!currentGroupingColumn || !$('body').hasClass('group-mode-active')) return;\n")], ['G12'], ['grouped']),
    # ...is read after the renderer marked the page grouped itself (compare-to-live; A-vs-B)
    'm-order': ([("                    // whose grouping was removed.\n                    _capturePreCompareGrouping();\n\n"
                  "                    removeContainerization();\n                    $('body').addClass('snapshot-comparison-active');\n"
                  "                    $('body').addClass('group-mode-active');\n",
                  "                    // whose grouping was removed.\n\n"
                  "                    removeContainerization();\n                    $('body').addClass('snapshot-comparison-active');\n"
                  "                    $('body').addClass('group-mode-active');\n                    _capturePreCompareGrouping();\n")], ['G12'], ['grouped']),
    'm-orderab': ([("                    // see the twin in runComparisonAndDisplayGrouped().\n                    _capturePreCompareGrouping();\n\n"
                    "                    removeContainerization();\n                    $('body').addClass('snapshot-comparison-active');\n"
                    "                    $('body').addClass('group-mode-active');\n",
                    "                    // see the twin in runComparisonAndDisplayGrouped().\n\n"
                    "                    removeContainerization();\n                    $('body').addClass('snapshot-comparison-active');\n"
                    "                    $('body').addClass('group-mode-active');\n                    _capturePreCompareGrouping();\n")], ['G12'], ['grouped']),
    # (the review) the gate without the comparison's container: a lazy exit's leftover column hands out the kept sort
    'm-gatebox': ([("        return currentGroupingColumn === '__SNAP_TYPE' && !!document.getElementById('snapshotComparisonContainer');\n",
                    "        return currentGroupingColumn === '__SNAP_TYPE';\n")], ['G13'], ['grouped']),
    # the Presets chip saves a comparison's __SNAP_TYPE grouping
    'm-preset': ([("        if (levels.indexOf('__SNAP_TYPE') !== -1) return 'A snapshot comparison is grouped by change type, which is not a column of the report. Choose a column to group by before saving a preset.';\n", "")],
                 ['G7'], ['grouped']),
    # ---- cmprq: a new query run during a comparison ----
    # the report table's own sort not put back: the comparison's carried across by name, the kept one left stale
    'q-sort': ([("        if (_pnbCmpOn) _pnbCmpPutBackReportSort();\n", "")], ['F8', 'F10', 'Q1', 'Q3', 'Q5'], ['flat', 'rqgrouped']),
    # the comparison's __SNAP_TYPE stashed again (kept now: "Previous grouping dropped", flat)
    'q-group': ([("        }\n"
                  "        else if (_pnbCmpOn) {\n"
                  "            // ...but a state load's own run keeps the view the state armed, the report's: a\n"
                  "            // ?snapab= boot draws its comparison before the report's query ever ran\n"
                  "            if (!(_pnbCmpRq && isStateLoading)) _pnbCmpStashReportGrouping(_pnbCmpRq ? _preCompareGrouping : null);\n"
                  "        }// Stash Group Settings if active\n",
                  "        }// Stash Group Settings if active\n")], ['F8', 'F10', 'Q1', 'Q2', 'Q3', 'Q8'], ['flat', 'rqgrouped', 'rqsnapab']),
    # the snapshot cleanup drops the report's own view again (flat; a ?snapab= boot's armed grouping too)
    'q-clean': ([("            if (!_pnbCmpRq) {\n"
                  "                pendingPivotSettings = null;\n"
                  "                pendingGroupByColumn = null;\n"
                  "            }\n",
                  "            pendingPivotSettings = null;\n"
                  "            pendingGroupByColumn = null;\n")],
                ['Q1', 'Q2', 'Q3', 'Q8'], ['rqgrouped', 'rqsnapab']),
    # a state load's own run (a ?snapab= boot) stashes the record's "none" over the view the state armed (flat)
    'q-stateload': ([("            if (!(_pnbCmpRq && isStateLoading)) _pnbCmpStashReportGrouping(_pnbCmpRq ? _preCompareGrouping : null);\n",
                      "            _pnbCmpStashReportGrouping(_pnbCmpRq ? _preCompareGrouping : null);\n")], ['Q8'], ['rqsnapab']),
    # a pivot a run that never completed left armed survives over the report's grouping
    'q-pivotnull': ([("    function _pnbCmpStashReportGrouping(g) {\n        pendingPivotSettings = null;\n",
                      "    function _pnbCmpStashReportGrouping(g) {\n")], ['Q6'], ['rqgrouped']),
    # over a snapshot VIEW the record's grouping stashed too (a run from a snapshot view keeps no grouping)
    'q-snapview': ([("        var _pnbCmpRq = _pnbCmpOn && !isViewingSnapshot;\n", "        var _pnbCmpRq = _pnbCmpOn;\n")], ['Q5'], ['rqgrouped']),
    # the gate without the comparison: a plain re-query of a grouped report takes the comparison's path (flat)
    'q-gate': ([("        var _pnbCmpOn = _pnbCmpOnScreen() && !_pnbRunClearAll;\n",
                 "        var _pnbCmpOn = $('#groupedResultsContainer').is(':visible') && !_pnbRunClearAll;\n")],
               ['Q4'], ['rqgrouped']),
    # a table opened from the console during a comparison takes the report's grouping and sort (it starts from none)
    'q-clearall': ([("        var _pnbCmpOn = _pnbCmpOnScreen() && !_pnbRunClearAll;\n", "        var _pnbCmpOn = _pnbCmpOnScreen();\n")],
                   ['Q7'], ['rqgrouped']),
    # the record's parts left to the globals the comparison changed, or lost
    'q-layout': ([("        currentGroupLayout = (g.layout === 'list') ? 'list' : 'stacked';\n"
                   "        $('#groupLayout').val(currentGroupLayout);   // grplist2: the dialog's field follows\n", "")],
                 ['Q1', 'Q2'], ['rqgrouped']),
    'q-gsort': ([("        currentGroupSort = g.sort ? { key: g.sort.key, dir: g.sort.dir } : { key: 'label', dir: 'asc' };\n", "")],
                ['Q1', 'Q2'], ['rqgrouped']),
    'q-depth': ([("        currentGroupStartDepth = g.startDepth || 0;\n", "        currentGroupStartDepth = 0;\n")], ['Q1'], ['rqgrouped']),
    'q-limit': ([("        currentGroupLimit = g.limit ? Object.assign({}, g.limit) : null;\n", "        currentGroupLimit = null;\n")], ['Q1'], ['rqgrouped']),
    'q-agg': ([("        pendingGroupAgg = (pendingGroupByColumn && g.agg && g.agg.column) ? { column: g.agg.column, type: g.agg.type } : null;\n",
                "        pendingGroupAgg = null;\n")], ['Q1'], ['rqgrouped']),
    # whether the layout was chosen: left as the comparison's dialog left it (a pick) / not recorded
    'q-chosen': ([("        _groupLayoutChosen = g.layoutChosen === true;   // (grpauto) as it was\n", "")], ['Q2'], ['rqgrouped']),
    'q-chosenrec': ([("            layout: currentGroupLayout,   // grplist2\n"
                      "            // (2026-10-23, cmprq) ...and whether that layout was someone's choice (grpauto): a\n"
                      "            // new query run during the comparison puts it back with the rest\n"
                      "            layoutChosen: _groupLayoutChosen\n",
                      "            layout: currentGroupLayout   // grplist2\n")], ['Q1'], ['rqgrouped']),
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
    """The ready closure becomes an IIFE with a name-by-name export hook, plus reads of the page's sort, the
    report sort a comparison kept (cmpsort) and the grouping globals; hideLoading counts its calls (a render's end)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { runCmp: "runComparisonAndDisplayGrouped", runAb: "runComparisonTwoSnapshots", compress: "compressString", decompress: "decompressString",'
         ' bso: "buildStateObject", bvu: "buildViewStateURL", ser: "_penumbraSerializeSortForUrl", lsc: "_lscPopulateSortField", lvls: "_groupLevelsFromDialog", exitHome: "_exitSnapshotToHome",'
         ' loadSnap: "loadSnapshotData", clearAll: "performClearAllAction" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n'
         'window.__CF.sc = function () { return JSON.parse(JSON.stringify(sortCriteria)); };\r\n'
         'window.__CF.rs = function () { return _pnbCmpReportSort === null ? null : JSON.parse(JSON.stringify(_pnbCmpReportSort)); };\r\n'
         'window.__CF.grp = function () { return JSON.parse(JSON.stringify({ cols: currentGroupingColumns, agg: currentGroupAgg, sort: currentGroupSort, depth: currentGroupStartDepth, layout: currentGroupLayout, limit: currentGroupLimit })); };\r\n'
         # G12's precondition: an earlier comparison's record left behind (restoreOriginalData leaves one)
         'window.__CF.setPre = function (g) { _preCompareGrouping = g; };\r\n'
         # (cmprq) whether the layout was someone's choice (grpauto), the comparison's record, a snapshot VIEW on
         'window.__CF.chosen = function () { return _groupLayoutChosen; };\r\n'
         'window.__CF.pre = function () { return _preCompareGrouping === null ? null : JSON.parse(JSON.stringify(_preCompareGrouping)); };\r\n'
         'window.__CF.viewing = function () { return isViewingSnapshot; };\r\n'
         # (cmprq) what a run will restore (armed by a state load, or by a stash), and a pivot left armed planted
         'window.__CF.pend = function () { return JSON.parse(JSON.stringify({ g: pendingGroupByColumn, a: pendingGroupAgg, p: pendingPivotSettings, sl: isStateLoading })); };\r\n'
         'window.__CF.setPendPivot = function (p) { pendingPivotSettings = p; };\r\n'
         # (2026-10-24, snapgrp) whether this main.js has snapgrp (a run from a view gives the report's own view back)
         'window.__CF.snapgrp = (typeof _pnbSnapStateView === "function");\r\n')
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
stage = tempfile.mkdtemp(prefix='pnb_svcmp_')
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

def phase2_path(mode, exp, art):
    if mode == 'saved':
        if not art.get('save'): return None
        return 'harness.html?mode=saved&exp=%s#pre=%s' % (exp, urllib.parse.quote(art['save'], safe=''))
    if mode == 'state':
        u = art.get('state')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=state&exp=%s' % exp
    if mode == 'view':
        u = art.get('view')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=view&exp=%s' % exp
    return None

def run(main_text, pages):
    write_main(main_text)
    want = set(pages)
    for p in pages:
        if p.startswith('R-G-'): want.add('grouped')
        if p.startswith('R-F-'): want.add('flat')
    out, arts = [], {}
    for key in ('grouped', 'flat', 'rqgrouped', 'rqsnapab'):
        if key not in want: continue
        # (cmprq) rqsnapab: the ?snapab= boot of the saved grouped report (the stub serves the two snapshots)
        res = run_page('harness.html?mode=%s&id=savecmp%s' % (key, '&snapab=55,56&snapkeys=ID' if key == 'rqsnapab' else ''))
        out += collect(res, key)
        arts[key] = res.get('artifacts') or {}
    for key, letter in (('grouped', 'G'), ('flat', 'F')):
        for mode in ('saved', 'state'):   # (a view link's round trip: viewlink's vcmpB since a3591f9)
            pid = 'R-%s-%s' % (letter, mode)
            if pid not in want: continue
            path = phase2_path(mode, key, arts.get(key) or {})
            if not path:
                out.append((pid, False, '%s: phase 1 handed over nothing to open' % pid)); continue
            out += collect(run_page(path), pid)
    return out

try:
    src = read_b(main_path)
    print('main.js: %s%s' % (main_path, '   (CONTROL)' if control else ''))
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
            print('  %s  mutant %-13s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run(src, only.split(',') if only else PAGES)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:900]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # red expected on the checks of each fix this main.js does not hold
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
            # (cmprq) a build without a fix (another session's stage cut before it went live) cannot pass that fix's
            # checks: they are printed, and said, but not counted
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
