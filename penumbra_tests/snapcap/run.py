# =============================================================================
# SNAPCAP SUITE (2026-10-23) - a capture of the page made during a snapshot VIEW writes the REPORT's column layout.
#
# A snapshot view draws the frozen rows under a fresh #tableHeader: the snapshot's columns, all shown, in its captured
# order, numbered its own way (rebuildTableFromMasterData). buildStateObject reads visibleColumns / columnOrder off
# that header, and the view link's captureColumnLayoutByName() takes the snapshot's by name, so a Save, a ?state= link
# and a link to the view made during a Load As View (no ?snap= in the URL: Save and the view link stay available)
# reopened the report with the snapshot's layout - its hidden columns shown, in another order. The report's own
# layout is in the view's stash (originalDataBeforeSnapshot.columnLayout, by name). The ways back to live data gave
# it back only in the flat case.
#
#   phase 1 (?id=snapcap): ?mode=ov (Load As View over the flat report: captures, back to live data, a snapshot
#   without NOTE, Run from a view), ovg (the report grouped), ovp (its pivot), ovlive (a live action from a view),
#   ovcol (a column hidden during a view), lz (a ?snap=56 tab: its query never ran)
#   phase 2 (?mode=saved / state / view): each capture opened in a fresh page - the Save's state preloaded as a saved
#   report is, the ?state= link, the view link over the report as saved - and the column layout it comes back in.
#   The harness is snapsort's (a copy) plus savecmp's Server Save dialog fields.
#
# snapgrp (2026-10-24) - the rest of the report's own view during a view: the view empties the grouped container, hides
# the pivot and draws the snapshot's columns, so a capture wrote no grouping and no pivot and dropped the widths,
# summaries and summary formulas of a column the snapshot lacks; a ?snap= tab's Server Save dropped the report's own
# calculated columns; the ways back lost the grouping (and a grouping made on the snapshot left group mode on, with the
# snapshot's rows kept for the next Remove Grouping); Reset / the custom-layout chip on a view read a layout saved
# without column names by place. Pages: gv (a view over the grouped report: captures, a grouping made on the snapshot,
# back, Run), pv (over its pivot, sorted by its DEPT row field), nw (snapshot #59 without AMOUNT and QTY, which carry
# widths, a summary and a formula), lzg / lzp / lzc / lzw (?snap= tabs of the grouped / pivot report, of one with its
# own calculated column, of #59), rsv / rsvc / rsc (Reset this column, Reset all, the chip on a view; rsvc with the
# viewer's own calculated column), ovgx / ovgl (the flat report's snapshot grouped, then back / then a live action),
# gvf (INFO only: a snapshot failing to load during a view of the grouped report comes back flat - not fixed), and
# their reopen pages R-gv-*, R-pv-*, R-nw-*, R-lzg-state, R-lzp-state, R-lzc-saved, R-lzc-state.
#
# cmppiv (2026-10-24) - the three edges snapback left. (The user's call) a comparison opened over the report's LIVE pivot
# keeps the pivot for its end (its Clear, a Save or Run during it, a view loaded over it; one that aborts put a blank
# page): lpc, lpab, lpr, lplv, lpx, lpxc, lps. A pivot drawn again through the builder under a search: from all the rows,
# then the search in pivot mode (one matching no live row was refused, the report flat): cmpvpz, cmpvpe. Compare to
# Live Data from a view whose comparison does not render: the report's view it kept, drawn again: clvf, clvfp, clvn.
#
#   py -3 run.py [--stage DIR]       the candidate's js\main.js from DIR, else live
#   py -3 run.py --control           live js\main.js: red on the checks of each fix it does not hold (NEW_SETS), the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate main.js (must turn their asserts red)
#   --pages ov,lz,R-ov-saved         only these pages (a phase 2 page runs its phase 1 page first)
#   --main FILE                      this main.js (a file, not a folder)
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
# Each fix's checks, red on a main.js without it (the rest are what the page always did, green everywhere).
NEW_SETS = [
    ('snapcap', 'function _pnbSnapStateLayout(',
     ['C1', 'C2', 'C3', 'C4', 'C6', 'C7', 'G1', 'G2', 'G3', 'P1', 'P2', 'L1', 'L2', 'K1', 'K1b', 'K3', 'U1', 'U2', 'Z1', 'Z2',
      'E1', 'E2', 'B1', 'R1', 'R2', 'R4', 'A1', 'A2',
      'R-ov-saved', 'R-ov-state', 'R-ov-view', 'R-lz-state', 'R-ovcalc-saved', 'R-ovreset-prefs']),
    # (2026-10-24) the rest of the report's own view during a view: grouping, pivot (and its sort), column parts, a
    # ?snap= tab's calculated columns; the ways back; Reset / the chip by name on a view
    ('snapgrp', 'function _pnbSnapStateView(',
     ['GV1', 'GV1b', 'GV2', 'GV3', 'GV4', 'GV5', 'GV5b', 'GV6', 'GV7', 'PV1', 'PV1b', 'PV2', 'PV3', 'PV4', 'PV6',
      'NW1', 'NW1b', 'NW2', 'NW3', 'NW4', 'LG1', 'LG2', 'LG3', 'LG4', 'LG5', 'LP1', 'LP2', 'LP3', 'LC1', 'LC3', 'LW1', 'LW2',
      'RV0', 'RV1', 'RV2', 'RC1', 'RC2', 'GX1', 'GX2', 'GX3', 'GX4', 'GX5', 'GL1', 'GL2', 'GL3',
      'CV2', 'CV3', 'CB2', 'GS1', 'GS2', 'CG1', 'GC3', 'PV7', 'GR1', 'GR2', 'GR3',
      'R-gv-saved', 'R-gv-state', 'R-gv-view', 'R-pv-saved', 'R-pv-state', 'R-pv-view', 'R-nw-saved', 'R-nw-state', 'R-nw-view',
      'R-lzg-state', 'R-lzp-state', 'R-lzc-saved', 'R-lzc-state']),
    # (snapback, 2026-10-24) the ways back snapgrp left: the load's failure path, a pivot report's comparison Clear on a
    # view, Compare to Live Data from a view, Load As View over a comparison
    ('snapback', 'function _pnbSnapPutBackView(',
     ['GF1', 'GF2', 'GF3', 'GF4', 'GF5', 'GF6', 'GF7', 'PF1', 'CP1', 'CL1', 'CL2', 'CL3', 'CL4', 'CL5', 'CL6', 'CL7', 'CL8', 'CL9',
      'CL10', 'LV1', 'LV2', 'LV3', 'LV4', 'LV5', 'LV6']),
    # (cmppiv, 2026-10-24) the three edges snapback left: a comparison over the report's LIVE pivot keeps it for its end
    # (the user's call); a pivot drawn again under a search; Compare to Live Data from a view whose comparison does not render
    ('cmppiv', 'function _pnbCmpNotOpened(',
     ['LP1', 'LP2', 'LP3', 'LP3b', 'LP4', 'LP4b', 'LP5', 'LP6', 'LP7', 'LP7b', 'LP8', 'LP9', 'LP10', 'LP11', 'LP12', 'LS1', 'LS1b', 'LS1c', 'LS1d', 'LS2',
      'CF1', 'CF2', 'CF3']),
]
PHASE1 = {
    'ov': 'harness.html?mode=ov&id=snapcap',
    'ovg': 'harness.html?mode=ovg&id=snapcap',
    'ovp': 'harness.html?mode=ovp&id=snapcap',
    'ovlive': 'harness.html?mode=ovlive&id=snapcap',
    'ovcol': 'harness.html?mode=ovcol&id=snapcap',
    'ovchg': 'harness.html?mode=ovchg&id=snapcap',
    # the viewer's own calculated column, from the URL: DOUBLE = {QTY}*2 (penumbra_calc.js, loaded for this page)
    'ovcalc': 'harness.html?mode=ovcalc&id=snapcap&calc=DOUBLE%7C%7BQTY%7D*2%7Cnumber',
    # ...and a view loaded after the report's next run came back empty (no stash)
    'ovcalc0': 'harness.html?mode=ovcalc0&id=snapcap&calc=DOUBLE%7C%7BQTY%7D*2%7Cnumber',
    'ovundo': 'harness.html?mode=ovundo&id=snapcap',
    'ovfail': 'harness.html?mode=ovfail&id=snapcap',
    'ovreset': 'harness.html?mode=ovreset&id=snapcap',
    'ovpanel': 'harness.html?mode=ovpanel&id=snapcap',
    'lz': 'harness.html?mode=lz&id=snapcap&snap=56',
    # (snapgrp, 2026-10-24) the rest of the report's own view during a view: its grouping, its pivot, the widths and
    # summaries of columns a snapshot lacks; ?snap= tabs of the grouped / pivot report and of one with its own
    # calculated column; Reset all / Reset column on a view of a report saved before its column names were kept
    'gv': 'harness.html?mode=gv&id=snapcap',
    'pv': 'harness.html?mode=pv&id=snapcap',
    'nw': 'harness.html?mode=nw&id=snapcap',
    'lzg': 'harness.html?mode=lzg&id=snapcap&snap=55',
    'lzp': 'harness.html?mode=lzp&id=snapcap&snap=55',
    'lzc': 'harness.html?mode=lzc&id=snapcap&snap=55',
    'rsv': 'harness.html?mode=rsv&id=snapcap',
    # ...with the viewer's own calculated column on the live table; the custom-layout chip on a view
    'rsvc': 'harness.html?mode=rsvc&id=snapcap&calc=DOUBLE%7C%7BQTY%7D*2%7Cnumber',
    'rsc': 'harness.html?mode=rsc&id=snapcap',
    # the flat report's snapshot grouped during the view, then back / then a live action; two edges seen, not fixed
    # here (INFO only)
    'ovgx': 'harness.html?mode=ovgx&id=snapcap',
    'ovgl': 'harness.html?mode=ovgl&id=snapcap',
    'gvf': 'harness.html?mode=gvf&id=snapcap',
    # a ?snap=59 tab (no AMOUNT, no QTY) of the report with widths and summaries on them
    'lzw': 'harness.html?mode=lzw&id=snapcap&snap=59',
    # (review) the ways back past an A-vs-B comparison opened on the view (its Clear / back to live data), a second
    # snapshot loaded over the view, the grouped report's comparison Clear; a table opened from the console during a
    # view / in a ?snap= tab / after an empty run
    'cmpv': 'harness.html?mode=cmpv&id=snapcap',
    'cmpvb': 'harness.html?mode=cmpvb&id=snapcap',
    'ovg2': 'harness.html?mode=ovg2&id=snapcap',
    'cmpvg': 'harness.html?mode=cmpvg&id=snapcap',
    'gvc': 'harness.html?mode=gvc&id=snapcap',
    'lzgc': 'harness.html?mode=lzgc&id=snapcap&snap=55',
    'gvce': 'harness.html?mode=gvce&id=snapcap',
    # (review 2) a view over the report grouped by a one-click grouping: grouping and ungrouping the snapshot in it
    'gvr2': 'harness.html?mode=gvr2&id=snapcap',
    # (snapback, 2026-10-24) the ways back snapgrp left: a snapshot failing to load during a view (gvf: the grouped
    # report, gvfg: its snapshot regrouped first, pvf: the pivot report, ovgf: the flat report's snapshot grouped, cmpvf:
    # an A-vs-B comparison on the view); an A-vs-B comparison on a view of the pivot report, then its Clear (cmpvp);
    # Compare to Live Data from a view (clv grouped, clvp pivot; then Run: clvgr, clvr; from a ?snap= tab: lzcl, lzclp);
    # Load As View over a comparison (lvc back to live data, lvcr Run; lvcp the pivot report's comparison from a view)
    'gvfg': 'harness.html?mode=gvfg&id=snapcap',
    'pvf': 'harness.html?mode=pvf&id=snapcap',
    'ovgf': 'harness.html?mode=ovgf&id=snapcap',
    'cmpvf': 'harness.html?mode=cmpvf&id=snapcap',
    'cmpvp': 'harness.html?mode=cmpvp&id=snapcap',
    'clv': 'harness.html?mode=clv&id=snapcap',
    'clvp': 'harness.html?mode=clvp&id=snapcap',
    'clvgr': 'harness.html?mode=clvgr&id=snapcap',
    'clvr': 'harness.html?mode=clvr&id=snapcap',
    'lzcl': 'harness.html?mode=lzcl&id=snapcap&snap=55',
    'lzclp': 'harness.html?mode=lzclp&id=snapcap&snap=55',
    'lvc': 'harness.html?mode=lvc&id=snapcap',
    'lvcr': 'harness.html?mode=lvcr&id=snapcap',
    'lvcp': 'harness.html?mode=lvcp&id=snapcap',
    # (review) the failure path: the grouped report's search with its groups (gvfs), over a view kept undrawn (lvcf); a
    # ?snap= tab of a report saved as a pivot by a column its query no longer has: Compare to Live Data, its Clear (lzclx)
    'gvfs': 'harness.html?mode=gvfs&id=snapcap',
    'lvcf': 'harness.html?mode=lvcf&id=snapcap',
    'lzclx': 'harness.html?mode=lzclx&id=snapcap&snap=55',
    # (cmppiv, 2026-10-24) a comparison over the report's LIVE pivot: with live data (lpc: a capture, the Server Save, its
    # Clear), A vs B (lpab), a Run during it (lpr), a view loaded over it (lplv), one that aborts (lpx A vs B, lpxc with
    # live data), the pivot searched first (lps); a pivot drawn again under a search: an A-vs-B comparison on a view of
    # the pivot report cleared under a search matching no live row (cmpvpz) / some (cmpvpe); Compare to Live Data from a
    # view whose comparison does not render (clvf the grouped report, clvfp the pivot report: it throws; clvn: it aborts)
    'lpc': 'harness.html?mode=lpc&id=snapcap',
    'lpab': 'harness.html?mode=lpab&id=snapcap',
    'lpr': 'harness.html?mode=lpr&id=snapcap',
    'lplv': 'harness.html?mode=lplv&id=snapcap',
    # ...then, from the view over it: Compare to Live Data (lplvc), an A-vs-B comparison on it (lplva), cleared
    'lplvc': 'harness.html?mode=lplvc&id=snapcap',
    'lplva': 'harness.html?mode=lplva&id=snapcap',
    'lpx': 'harness.html?mode=lpx&id=snapcap',
    'lpxc': 'harness.html?mode=lpxc&id=snapcap',
    'lps': 'harness.html?mode=lps&id=snapcap',
    'cmpvpz': 'harness.html?mode=cmpvpz&id=snapcap',
    'cmpvpe': 'harness.html?mode=cmpvpe&id=snapcap',
    'clvf': 'harness.html?mode=clvf&id=snapcap',
    'clvfp': 'harness.html?mode=clvfp&id=snapcap',
    'clvn': 'harness.html?mode=clvn&id=snapcap',
}
# phase 2: (page id, the phase 1 page whose capture it opens, the capture)
PHASE2 = [('R-ov-saved', 'ov', 'saved'), ('R-ov-state', 'ov', 'state'), ('R-ov-view', 'ov', 'view'), ('R-lz-state', 'lz', 'state'),
          ('R-ovcalc-saved', 'ovcalc', 'saved'), ('R-ovreset-prefs', 'ovreset', 'prefs'),
          # (snapgrp)
          ('R-gv-saved', 'gv', 'saved'), ('R-gv-state', 'gv', 'state'), ('R-gv-view', 'gv', 'view'),
          ('R-pv-saved', 'pv', 'saved'), ('R-pv-state', 'pv', 'state'), ('R-pv-view', 'pv', 'view'),
          ('R-nw-saved', 'nw', 'saved'), ('R-nw-state', 'nw', 'state'), ('R-nw-view', 'nw', 'view'),
          ('R-lzg-state', 'lzg', 'state'), ('R-lzp-state', 'lzp', 'state'), ('R-lzc-saved', 'lzc', 'saved'), ('R-lzc-state', 'lzc', 'state')]
ALL_PAGES = list(PHASE1.keys()) + [p for p, _, _ in PHASE2]

# --- mutants: name -> (edits on the candidate main.js, assert ids that MUST go red, pages to run) ------------------
MUTANTS = {
    # a capture during a view reads the view's header again: the snapshot's layout
    'c-state': ([("        _pnbSnapStateLayout(state);\n", "")], ['C1', 'C2', 'C3', 'Z1', 'Z2', 'R-ov-saved', 'R-ov-state'],
                ['ov', 'lz', 'R-ov-saved', 'R-ov-state']),
    # nothing kept as the view opens: the capture takes the report's STORED layout, not the one the viewer had
    'c-stash': ([("                        stateLayout: _pnbHeaderStateLayout(),\n", "                        stateLayout: null,\n")], ['U1'], ['ovchg']),
    # a ?snap= tab (no stash): no stored layout to fall back on - none written
    'c-lazy': ([("        var lay = (originalDataBeforeSnapshot && originalDataBeforeSnapshot.stateLayout) || _pnbStoredLayout;\n",
                 "        var lay = (originalDataBeforeSnapshot && originalDataBeforeSnapshot.stateLayout) || null;\n")], ['Z1', 'Z2', 'R-lz-state'], ['lz', 'R-lz-state']),
    # a link to the view during a view: the snapshot's layout by name again
    'c-vlink': ([("        var lay = isViewingSnapshot ? (originalDataBeforeSnapshot ? originalDataBeforeSnapshot.columnLayout : null) : captureColumnLayoutByName();\n",
                  "        var lay = captureColumnLayoutByName();\n")], ['C4', 'U2', 'R-ov-view'], ['ov', 'ovchg', 'R-ov-view']),
    # back to live data: the layout not put back (the flat branch's own apply was moved up into this one)
    'c-restore': ([("                if (originalDataBeforeSnapshot.columnLayout) {\n"
                    "                    applyColumnLayoutByName(originalDataBeforeSnapshot.columnLayout);\n"
                    "                }\n", "")], ['C5', 'G2', 'G3', 'P2'], ['ov', 'ovg', 'ovp']),
    # a Run from a view reads the view's header for the run's restore again
    'c-run': ([("        } else if (isViewingSnapshot) {\n"
                "            // (2026-10-23, snapcap) A snapshot view's header holds the SNAPSHOT's columns (all shown, in\n"
                "            // its captured order), which this run used to give the report: it keeps the report's own\n"
                "            // layout, as the view found it. A ?snap= tab has none to read (its report never ran): its run\n"
                "            // is the report's state load, which lays the saved layout.\n"
                "            var _snapLay = originalDataBeforeSnapshot && originalDataBeforeSnapshot.columnLayout;\n"
                "            if (_snapLay) lastQueryState = { order: _snapLay.order.filter(function (c) { return c !== '#'; }), visible: _snapLay.visible.slice(), isNumVisible: _snapLay.isNumVisible !== false };\n",
                "")], ['C7'], ['ov']),
    # a live action from a view: the live table rebuilt all shown, in the query's order
    'c-live': ([("        if (_snapLay) applyColumnLayoutByName(_snapLay);\n", "")], ['L1', 'L2'], ['ovlive']),
    # a column change on a view stored as the viewer's own layout for the report
    'c-prefs': ([("        // and the header holds the snapshot's columns.\n        if (isViewingSnapshot) return;\n",
                  "        // and the header holds the snapshot's columns.\n")], ['K1b', 'K3'], ['ovcol']),
    # (review) the Save's calculated-column strip by the table's map again: during a view the snapshot's numbering
    'c-strip': ([("            window.PenumbraCalc.stripFromState(stateObject, _pnbStateNameToIndex());\n",
                  "            window.PenumbraCalc.stripFromState(stateObject, $('#resultsTable').data('columnNameToOriginalIndex'));\n")],
                ['E1', 'R-ovcalc-saved'], ['ovcalc', 'R-ovcalc-saved']),
    # (second review) a view with no stash takes the calculated columns out by the table's (the snapshot's) map
    'c-strip2': ([("        if (isViewingSnapshot) return (originalDataBeforeSnapshot && originalDataBeforeSnapshot.nameToIndex) || null;\n",
                   "        if (isViewingSnapshot && originalDataBeforeSnapshot && originalDataBeforeSnapshot.nameToIndex) return originalDataBeforeSnapshot.nameToIndex;\n")],
                 ['E2'], ['ovcalc0']),
    # (second review) Reset all's Undo after leaving the view lays out - and stores - the view's column ids
    'c-undo': ([("            if (s.moved && resetOnView === isViewingSnapshot) {\n", "            if (s.moved) {\n")], ['R4'], ['ovundo']),
    # (review) the load's failure path: the live table back all shown, in the query's order
    'c-fail': ([("                        if (originalDataBeforeSnapshot.columnLayout) applyColumnLayoutByName(originalDataBeforeSnapshot.columnLayout);\n", "")],
               ['B1'], ['ovfail']),
    # (review) Reset all on a view drops the viewer's stored layout for the report
    'c-dropview': ([("        // layout for the report stays (nothing is stored during a view, so its Undo could not write it back)\n        if (isViewingSnapshot) return;\n",
                     "        // layout for the report stays (nothing is stored during a view, so its Undo could not write it back)\n")],
                   ['R1', 'R-ovreset-prefs'], ['ovreset', 'R-ovreset-prefs']),
    # (review) the column panel's Apply on a view says it saved the layout
    'c-msg': ([("        show_text(isViewingSnapshot\n", "        show_text(false\n")], ['A1'], ['ovpanel']),
    # (ldlayout merged in) the names at each place left as the build read them off the view's header: the report's
    # places read through the snapshot's names
    'c-names': ([("        if ('layoutColumnNames' in state) state.layoutColumnNames = (lay && lay.layoutColumnNames) ? lay.layoutColumnNames.slice() : undefined;\n", "")],
                ['C1', 'R-ov-saved'], ['ov', 'R-ov-saved']),
}
MUTANTS.update({
    # (snapgrp) a capture during a view reads the screen for the grouping / pivot again
    'g-view': ([("        if (isViewingSnapshot) _pnbSnapStateView(state);\n", "")],
               ['GV1', 'GV2', 'GV3', 'GV4', 'PV1', 'PV2', 'PV3', 'PV4', 'LG1', 'LP1', 'R-gv-saved', 'R-pv-saved'],
               ['gv', 'pv', 'lzg', 'lzp', 'R-gv-saved', 'R-pv-saved']),
    # nothing of the grouping kept as the view opens
    'g-stash-grp': ([("                        grouping: _pnbGroupingRecordNow(),\n", "                        grouping: null,\n")], ['GV1', 'GV6', 'GV7'], ['gv']),
    # the kept pivot not written
    'g-stash-piv': ([("            if (s.isPivotVisible) { if (s.pivotSettings) state.pivot = JSON.parse(JSON.stringify(s.pivotSettings)); }\n",
                      "            if (s.isPivotVisible) { }\n")], ['PV1', 'PV2', 'PV3', 'PV4'], ['pv']),
    # a pivot's sort not written with its pivot
    'g-psort': ([("        if (state.pivot && _pnbSnapReportSort && _pnbSnapReportSort.pivot) state.sortCriteria = _pnbSnapReportSort.sort.map(function (c) { return Object.assign({}, c); });\n", "")],
                ['PV1', 'PV1b', 'LP1', 'R-pv-saved'], ['pv', 'lzp', 'R-pv-saved']),
    # a ?snap= tab: the saved grouping / pivot not written
    'g-lazy-grp': ([("            _pnbStateGroupingOf(state, _pnbSavedGrouping());\n", "")], ['LG1', 'LG2', 'LG3', 'LG5'], ['lzg']),
    'g-lazy-piv': ([("            state.pivot = JSON.parse(JSON.stringify(window._reportDefaultPivot));\n", "")], ['LP1', 'LP2', 'LP3'], ['lzp']),
    # the state load keeps the saved grouping without its start depth and limit
    'g-default': ([(", groupStartDepth: decodedState.groupStartDepth || 0, groupLimit: decodedState.groupLimit || null })); } catch (e) {}\n",
                    " })); } catch (e) {}\n")], ['LG1', 'LG4'], ['lzg']),
    # a ?snap= tab's way back re-arms the saved grouping's column and summary only (the globals the viewer changed stay)
    'g-lazy-rearm': ([("                        _pnbCmpStashReportGrouping(_pnbSavedGrouping());\n",
                       "                        pendingGroupByColumn = window._reportDefaultGroup.groupBy;\n"
                       "                        pendingGroupAgg = (window._reportDefaultGroup.groupAgg && window._reportDefaultGroup.groupAgg.column) ? window._reportDefaultGroup.groupAgg : null;\n")],
                     ['LG4'], ['lzg']),
    # the column parts read off the view's header again
    'g-cols': ([("        _pnbSnapStateCols(state);\n", "")], ['NW1', 'NW2', 'NW3', 'NW4', 'LW1', 'R-nw-saved'], ['nw', 'lzw', 'R-nw-saved']),
    'g-cols-stash': ([("                        stateCols: _pnbHeaderStateCols()\n", "                        stateCols: null\n")], ['NW1'], ['nw']),
    'g-cols-lazy': ([("        var c = s ? s.stateCols : { columnWidths: reportColumnWidths, columnSummaries: reportColumnSummaries, columnSummaryFormulas: reportColumnSummaryFormulas };\n",
                      "        var c = s ? s.stateCols : null;\n")], ['LW1', 'LW2'], ['lzw']),
    # back to live data: the grouping globals left as the view's (the grouped report)
    'g-restore': ([("                if (originalDataBeforeSnapshot.isGroupedVisible) _pnbSnapPutBackGrouping(originalDataBeforeSnapshot.grouping, originalDataBeforeSnapshot.groupMode);\n",
                    "                if (false) _pnbSnapPutBackGrouping(originalDataBeforeSnapshot.grouping, originalDataBeforeSnapshot.groupMode);\n")], ['GV6'], ['gv']),
    # Run from a view: the report's grouping / pivot not re-armed
    'g-run': ([("            } else if (_snapViewStash && !_pendingSnapshotCompare && !_pnbRunClearAll) {\n", "            } else if (false && _snapViewStash) {\n")], ['GV7', 'PV6'], ['gv', 'pv']),
    # ...and its pivot's sort dropped as before
    'g-run-sort': ([("        if (isViewingSnapshot && originalDataBeforeSnapshot && originalDataBeforeSnapshot.isPivotVisible && originalDataBeforeSnapshot.pivotSettings\n"
                     "                && !_pendingSnapshotCompare && !_pnbRunClearAll) _pnbSnapPutBackReportSort(true);\n", "")],
                   ['PV6'], ['pv']),
    # (review) a table opened from the console during a view / in a ?snap= tab: the report's grouping armed on it
    'g-clearall': ([("            } else if (_snapViewStash && !_pendingSnapshotCompare && !_pnbRunClearAll) {\n",
                     "            } else if (_snapViewStash && !_pendingSnapshotCompare) {\n")], ['GC1'], ['gvc']),
    'g-clearall-lazy': ([("            if (_wasLazySnapView && !_pendingSnapshotCompare && !_pnbRunClearAll) {\n",
                          "            if (_wasLazySnapView && !_pendingSnapshotCompare) {\n")], ['GC3'], ['lzgc']),
    # (review) ...and with nothing kept, a capture writes the report's saved views on that table
    'g-gate': ([("        } else if (!currentLoadedStateName) {\n", "        } else if (false) {\n")], ['GC2'], ['gvce']),
    # a ?snap= tab: the report's calculated columns not kept by the Server Save / not carried by a capture
    'g-calc-save': ([("            _pnbSnapKeepReportCalc(stateObject);\n", "")], ['LC1', 'R-lzc-saved'], ['lzc', 'R-lzc-saved']),
    'g-calc-state': ([("        _pnbSnapStateCalc(state);\n", "")], ['LC3', 'R-lzc-state'], ['lzc', 'R-lzc-state']),
    # Reset on a view: the layout saved without names by place again
    'g-names': ([("        return _pnbLayoutByName(_pnbSnapNamedLayout(_pnbStoredLayout), _pnbHeaderNames(), _pnbNotSaved) || _pnbStoredLayout;\n",
                  "        return _pnbLayoutByName(_pnbStoredLayout, _pnbHeaderNames(), _pnbNotSaved) || _pnbStoredLayout;\n")], ['RV1', 'RV2'], ['rsv']),
    # ...the names not cut to the places the layout lists (the viewer's own calculated column after them)
    'g-trunc': ([("        nm.length = Math.min(nm.length, co.filter(function (x) { return /^\\d+$/.test(String(x)); }).length);\n", "")], ['RC1', 'RC2'], ['rsvc']),
    # the custom-layout chip by place on a view again
    'g-chip': ([("            ps = _pnbSnapNamedLayout(ps);   // (2026-10-24, snapgrp) on a view: a layout saved without names, by the report's\n", "")],
               ['RV0'], ['rsc']),
    # a link to the view during a view carries the view's own open groups
    'g-vlink': ([("        var gsc = (isViewingSnapshot && !cmp) ? null : _pnbViewLinkGroupNow();\n", "        var gsc = _pnbViewLinkGroupNow();\n"),
                 ("            var gst = (isViewingSnapshot && !cmp) ? null : _pnbViewLinkStackNow();\n", "            var gst = _pnbViewLinkStackNow();\n")], ['GV5b'], ['gv']),
    # (review) ...and a comparison's link on a view loses the comparison's
    'g-vlink-cmp': ([("        var gsc = (isViewingSnapshot && !cmp) ? null : _pnbViewLinkGroupNow();\n", "        var gsc = isViewingSnapshot ? null : _pnbViewLinkGroupNow();\n"),
                     ("            var gst = (isViewingSnapshot && !cmp) ? null : _pnbViewLinkStackNow();\n", "            var gst = isViewingSnapshot ? null : _pnbViewLinkStackNow();\n")], ['CV1'], ['cmpv']),
    # (review) a link's sort while the snapshot is grouped: the screen decides again (unsorted)
    'g-sort-url': ([("        if (isViewingSnapshot) return _pnbSnapReportNotFlat() ? '' : _pnbSortChainForUrl(_pnbStateSortCriteria());\n", "")], ['GX5'], ['ovgx']),
    # a grouping made on the snapshot keeps group mode (and the snapshot's rows) on the way back - however it was left:
    # on screen, hidden by a comparison on the view (a second snapshot loaded over the view: g-view-leave covers it too)
    'g-leave-restore': ([("                else _pnbSnapLeaveGroupMode();\n                // --- END FIX ---\n", "                // --- END FIX ---\n")],
                        ['GX2', 'GX3', 'GX4', 'CB2'], ['ovgx', 'cmpvb']),
    # ...into a live action, or a comparison's Clear on a view
    'g-leave-exit': ([("        _pnbSnapLeaveGroupMode();\n        masterRowData = originalDataBeforeSnapshot.masterRowData;\n",
                       "        masterRowData = originalDataBeforeSnapshot.masterRowData;\n")], ['GL1', 'GL2', 'CV3'], ['ovgl', 'cmpv']),
    # ...the snapshot's groups left on screen at a live action
    'g-hide-exit': ([("        } else if ($('#groupedResultsContainer').is(':visible')) {\n            $('#groupedResultsContainer').hide().empty();\n            $('#groupActionsContainer').hide();\n        }\n",
                      "        }\n")], ['GL1'], ['ovgl']),
    # (review) a comparison's Clear on a view regroups by the grouping recorded as it began (the view's)
    'g-cmp-clear': ([("            _preCompareGrouping = _snapCmpGrp ? $.extend(true, {}, _snapCmpGrp) : null;\n",
                      "            void 0;\n")], ['CV2', 'CG1'], ['cmpv', 'cmpvg']),
    # (review 2) ...and its start depth and limit off the dialog's fields, as the view's last grouping left them
    'g-cmp-form': ([("        $('#groupStartDepth').val(String(saved.startDepth || 0));\n", ""),
                    ("        $('#groupLimitN').val(_savedLim && _savedLim.n > 0 ? String(_savedLim.n) : '');\n", "")],
                   ['CG1'], ['cmpvg']),
    # (review 2) Run from a view of the pivot report: a grouping made on the snapshot left in the globals
    'g-run-pivot-leave': ([("                        _pnbSnapLeaveGroupMode();\n                        if (_snapViewStash.isPivotVisible", "                        if (_snapViewStash.isPivotVisible")],
                          ['PV7'], ['pv']),
    # (review 2) group mode kept while a view is on screen: no one-click grouping of the snapshot by the report's column,
    # and the LIVE rows under the snapshot's table at a Remove Grouping made in the view
    'g-view-leave': ([("                if (originalDataBeforeSnapshot) { $('body').removeClass('group-mode-active'); originalMasterRowData = null; }\n", "")],
                     ['GR1', 'GR2'], ['gvr2']),
})
MUTANTS.update({
    # (snapback) the load's failure path: the report's grouped / pivot view not put back on the live table it rebuilt
    'b-put': ([("                        _pnbSnapPutBackView(originalDataBeforeSnapshot, _snapBack);   // (snapback) its grouped / pivot view on it\n", "")],
              ['GF1', 'GF3', 'PF1', 'GF6'], ['gvf', 'gvfg', 'pvf', 'cmpvf']),
    # ...a comparison opened on the view left on screen
    'b-leave-cmp': ([("        if ($('body').hasClass('snapshot-comparison-active')) {\n            var sc = sortCriteria;\n            _teardownComparisonState();\n            sortCriteria = sc;\n        }\n", "")],
                    ['GF6'], ['cmpvf']),
    # ...the view's group mode (and the snapshot's rows) left as the view had them
    'b-put-mode': ([("        if (s.isGroupedVisible) _pnbSnapPutBackGrouping(s.grouping, s.groupMode);\n        else _pnbSnapLeaveGroupMode();\n", "")],
                   ['GF1', 'GF4', 'GF5'], ['gvf', 'ovgf']),
    # ...the pivot back without its sort
    'b-put-psort': ([("        if (s.isPivotVisible) { sortCriteria = b.pivotSort; updateHeaderIcons(); }\n", "")], ['PF1'], ['pvf']),
    # a comparison opened on a view of the pivot report: its Clear keeps no pivot / draws none / draws it unsorted
    'b-cmp-piv': ([("            _pnbCmpReportPivot = _pnbSnapPivotRecord(originalDataBeforeSnapshot);\n", "")], ['CP1'], ['cmpvp']),
    'b-clear-piv': ([("            _pnbCmpPutBackReportPivot();\n", "")], ['CP1', 'CL5'], ['cmpvp', 'clvp']),
    'b-psort': ([("                _pnbPivotSortAfterDraw();\n", "")], ['CP1', 'CL5'], ['cmpvp', 'clvp']),
    # Compare to Live Data from a view: nothing of the report's view kept / handed to the comparison / taken by it
    'b-hdr': ([("        _pendingSnapshotCompare.reportView = _pnbSnapReportViewNow();\n", "")],
              ['CL1', 'CL3', 'CL4', 'CL5', 'CL6', 'CL7', 'CL8', 'CL9'], ['clv', 'clvp', 'clvgr', 'clvr', 'lzcl', 'lzclp']),
    'b-arm': ([("                            _pnbCmpViewArm = ('reportView' in _psc) ? { snapshot: _psc.snapshot, view: _psc.reportView } : null;\n", "")],
              ['CL1', 'CL4'], ['clv', 'clvp']),
    'b-take': ([("        if (_pnbCmpTakeViewRecord()) return;\n", "")], ['CL1', 'CL4'], ['clv', 'clvp']),
    # ...a capture during it writes no pivot; a Run during it draws the report flat
    'b-state-piv': ([("        if (!isViewingSnapshot && _pnbCmpOnScreen()) _pnbCmpStatePivot(state);\n", "")], ['CL4'], ['clvp']),
    'b-rq-piv': ([("        if (_pnbCmpRq && !isStateLoading && _pnbCmpReportPivot) _pnbCmpStashReportPivot(_pnbCmpReportPivot);\n", "")], ['CL6'], ['clvr']),
    # Load As View over a comparison: the view keeps none of the comparison's record / back to live data draws nothing /
    # restores the empty view kept undrawn
    'b-lvc': ([("                if (_snapCmpView && originalDataBeforeSnapshot) _pnbSnapStashCmpView(originalDataBeforeSnapshot, _snapCmpView);\n", "")],
              ['LV1', 'LV2', 'LV3', 'LV4', 'LV5'], ['lvc', 'lvcr', 'lvcp']),
    'b-redraw': ([("                if (_snapRedraw && !isViewingSnapshot) _pnbSnapRedraw(_snapRedraw);   // (snapback)\n", "")], ['LV2', 'LV5'], ['lvc', 'lvcp']),
    'b-redraw-of': ([("            let _snapRedraw = _pnbSnapRedrawOf(originalDataBeforeSnapshot);\n", "            let _snapRedraw = null;\n")], ['LV2'], ['lvc']),
    # (review) the failure path: the groups back without the search they were drawn under; its last step (the search,
    # a view kept undrawn drawn again) never taken; a report pivot whose column left the query drawn anyway
    'b-search': ([("        if ((s.isPivotVisible || s.isGroupedVisible) && s.currentSearch) { $('#tableSearch').val(s.currentSearch); b.search = s.currentSearch; }\n", "")],
                 ['GF7'], ['gvfs']),
    'b-done': ([("                if (_snapBack) _pnbSnapBackDone(_snapBack, currentSearch);   // (snapback) the failure path's last step\n", "")],
               ['LV6'], ['lvcf']),
    'b-gone': ([("                .filter(function (c) { return !penumbraPivotFieldExists(c, look); });\n            if (gone.length) {\n",
                 "                .filter(function (c) { return !penumbraPivotFieldExists(c, look); });\n            if (false) {\n")], ['CL10'], ['lzclx']),
})
MUTANTS.update({
    # (cmppiv) a comparison over the report's live pivot: the pivot not read before the renderer takes it off the screen
    # (with live data / A vs B), or not kept at the comparison's entry
    'p-read': ([("            setTimeout(() => {\n                try {\n" + "                    // (2026-10-24, cmppiv) the report's pivot, read before it leaves the screen below: kept for the comparison's end\n                    _pnbCmpLivePivot = _pnbCmpPivotOnScreen();\n", "            setTimeout(() => {\n                try {\n")],
               ['LP1', 'LP2', 'LP3', 'LP5', 'LP6', 'LP7', 'LP9', 'LP10'], ['lpc', 'lpr', 'lplv', 'lpxc', 'lps']),
    'p-read-ab': ([("            setTimeout(function () {\n                try {\n" + "                    // (2026-10-24, cmppiv) the report's pivot, read before it leaves the screen below: kept for the comparison's end\n                    _pnbCmpLivePivot = _pnbCmpPivotOnScreen();\n", "            setTimeout(function () {\n                try {\n")],
                  ['LP4', 'LP8'], ['lpab', 'lpx']),
    'p-keep': ([("        _pnbCmpKeepLivePivot();\n", "")], ['LP1', 'LP2', 'LP3', 'LP4', 'LP5', 'LP6', 'LP7', 'LP10'], ['lpc', 'lpab', 'lpr', 'lplv', 'lps']),
    # a comparison that never took the page: nothing drawn again (with live data / A vs B); Compare to Live Data's kept
    # view ignored
    'p-not': ([("                    _pnbCmpNotOpened(snapshot);\n", "")], ['LP9', 'CF1', 'CF2', 'CF3'], ['lpxc', 'clvf', 'clvfp', 'clvn']),
    'p-not-ab': ([("                    _pnbCmpNotOpened(null);", "                    void 0;")], ['LP8'], ['lpx']),
    'p-not-arm': ([("        var v = lp ? { pivot: lp } : (a ? a.view : null);\n", "        var v = lp ? { pivot: lp } : null;\n")], ['CF1', 'CF2', 'CF3'], ['clvf', 'clvfp', 'clvn']),
    # a pivot drawn again under a search: from the rows the flat search left / never searched in pivot mode / not armed /
    # the arm not handed to the draw's tail
    'p-allrows': ([("                _pnbPivotAllRows();\n", "")], ['LS1', 'LS1b'], ['cmpvpz']),
    'p-tail': ([("                    _pnbPivotSearchAfterDraw();", "                    void 0;")], ['LS1', 'LS2', 'LP10'], ['cmpvpz', 'cmpvpe', 'lps']),
    'p-arm': ([("            _pnbPivotSearchNext = String($('#tableSearch').val() || '').trim() ? { of: _pnbPivotFields(currentPivotSettings) } : null;\n",
                "            _pnbPivotSearchNext = null;\n")], ['LS1', 'LS2', 'LP10'], ['cmpvpz', 'cmpvpe', 'lps']),
    'p-transfer': ([("        _pnbPivotSearchTail = _pnbPivotSearchNext; _pnbPivotSearchNext = null;", "        void 0;")], ['LS1', 'LS2', 'LP10'], ['cmpvpz', 'cmpvpe', 'lps']),
    # (review) the flat search's marks left off the rows the Generate read; the flat "No rows match" box left beside the
    # pivot's own message; a view over the comparison drops the preset the pivot was
    'p-rowsback': ([("                _pnbPivotRowsBack();", "                void 0;")], ['LS2b'], ['cmpvpe']),
    'p-nomatch': ([("        $('#pnbNoSearchMatches').hide();\n        runTableSearch();\n", "        runTableSearch();\n")], ['LS1c'], ['cmpvpz']),
    'p-preset-view': ([("            s.pivotPreset = (v.pivot.preset || v.pivot.chip) ? { preset: v.pivot.preset || null, chip: v.pivot.chip || null } : null;", "            s.pivotPreset = null;")],
                      ['LP7b', 'LP11', 'LP12'], ['lplv', 'lplvc', 'lplva']),
    # (review 2) the stash's preset not put on its pivot record (the ways back from the view over the comparison); the
    # builder chip's preset not named again; a search cleared in pivot mode leaving the flat rows marked
    'p-preset-onto': ([("        if (p && s && s.pivotPreset) { p.preset = s.pivotPreset.preset; p.chip = s.pivotPreset.chip; }\n", "")],
                      ['LP7b', 'LP11', 'LP12'], ['lplv', 'lplvc', 'lplva']),
    'p-chip': ([("                if (p.chip && _pivotPresetCtl) _pivotPresetCtl.setLoaded(p.chip.name, p.chip.src);\n", "")], ['LP3b', 'LP4b'], ['lpc', 'lpab']),
    'p-cleared': ([("            if (!searchValue) _pnbPivotSearchCleared();", "            void 0;")], ['LS1d'], ['cmpvpz']),
    # a preset's pivot drawn again unnamed
    'p-preset': ([("            if ((p.preset || p.chip) && !String($('#pivotErrorBox').text() || '').trim()) {", "            if (false) {")], ['LP3b', 'LP4b'], ['lpc', 'lpab']),
})
# c-names bites only on a build that writes layoutColumnNames (ldlayout): --mutants skips it elsewhere; the snapgrp
# ones only on a build that has it, the snapback ones likewise
NEEDS = {'c-names': 'function _pnbHeaderNames('}
NEEDS.update({k: 'function _pnbSnapStateView(' for k in MUTANTS if k.startswith('g-')})
NEEDS.update({k: 'function _pnbSnapPutBackView(' for k in MUTANTS if k.startswith('b-')})
NEEDS.update({k: 'function _pnbCmpNotOpened(' for k in MUTANTS if k.startswith('p-')})

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
main_file = opt('--main', None)
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
main_path = main_file if (main_file and not control) else pick(os.path.join('js', 'main.js'))
menu_path = pick(os.path.join('js', 'penumbra_colmenu.js'))
calc_path = pick(os.path.join('js', 'penumbra_calc.js'))


def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, plus reads of the page's sort, the stored
    layout, the view's stash and the snapshot flag; hideLoading counts its calls (a render's end)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { compress: "compressString", decompress: "decompressString", loadSnap: "loadSnapshotData", restore: "restoreOriginalData",'
         ' exitLive: "_exitSnapshotForLiveAction", exitHome: "_exitSnapshotToHome", uhi: "updateHeaderIcons", bso: "buildStateObject",'
         ' bvu: "buildViewStateURL", ser: "_penumbraSerializeSortForUrl", clearAll: "performClearAllAction",'
         ' runAb: "runComparisonTwoSnapshots", stack: "_pnbViewLinkStackNow", runCmp: "runComparisonAndDisplayGrouped", search: "runTableSearch",'
         ' mountChip: "_pivotMountPresetChip" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n'
         'window.__CF.sc = function () { return JSON.parse(JSON.stringify(sortCriteria)); };\r\n'
         'window.__CF.viewing = function () { return isViewingSnapshot; };\r\n'
         'window.__CF.stored = function () { return _pnbStoredLayout === null ? null : JSON.parse(JSON.stringify(_pnbStoredLayout)); };\r\n'
         'window.__CF.stash = function () { if (!originalDataBeforeSnapshot) return null; var s = originalDataBeforeSnapshot, o = {}; Object.keys(s).forEach(function (k) { if (k !== "masterRowData" && k !== "groupedHTML" && k !== "pivotHTML") o[k] = s[k]; }); return JSON.parse(JSON.stringify(o)); };\r\n'
         # (snapgrp) the grouping the page holds
         'window.__CF.grp = function () { return JSON.parse(JSON.stringify({ col: currentGroupingColumn, cols: currentGroupingColumns, agg: currentGroupAgg, sort: currentGroupSort, depth: currentGroupStartDepth, limit: currentGroupLimit, layout: currentGroupLayout })); };\r\n'
         # ...and the NAME of each row the page holds (masterRowData)
         'window.__CF.mrd = function () { return (masterRowData || []).map(function (r) { return (r && typeof r.get === "function") ? r.get("NAME") : (r && r.NAME); }); };\r\n'
         # (cmppiv) the pivot builder's preset chip: what it names, and naming one
         'window.__CF.chip = function () { return _pivotPresetCtl ? { name: _pivotPresetCtl.loaded(), src: _pivotPresetCtl.loadedSource() } : null; };\r\n'
         'window.__CF.setChip = function (n, s) { if (!_pivotPresetCtl) return false; _pivotPresetCtl.setLoaded(n, s); return true; };\r\n')
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
stage = tempfile.mkdtemp(prefix='pnb_snapcap_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
shutil.copyfile(menu_path, os.path.join(stage, 'penumbra_colmenu.js'))
shutil.copyfile(calc_path, os.path.join(stage, 'penumbra_calc.js'))
idx = read_b(os.path.join(APP, 'index.php'))
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
page = page.replace('<!--SNAP_TEMPLATE-->', m.group(0))
# (snapback) the pivot builder, as index.php has it (its PHP comments out), in an inert template: the pages whose way
# back draws the report's pivot again through the builder's Generate put it in the page before main.js runs
mb = re.search(r'<div id="pivotLightbox" class="help-lightbox">.*?\r?\n</div>', idx, re.S)
if not mb: raise SystemExit('pivotLightbox not found in index.php')
if page.count('<!--PIVOT_BUILDER-->') != 1: raise SystemExit('harness.html: pivot builder placeholder missing')
page = page.replace('<!--PIVOT_BUILDER-->', '<template id="pnbPivotBuilderTpl">' + re.sub(r'<\?php.*?\?>', '', mb.group(0), flags=re.S) + '</template>')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.encode('utf-8', 'surrogateescape'))

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
    if res.get('info'): print('  [%s] info: %s' % (tag, json.dumps(res['info'])[:1500]), flush=True)
    return out

def phase2_path(mode, exp, art):
    if mode == 'saved':
        if not art.get('save'): return None
        return 'harness.html?mode=saved&exp=%s&id=snapcap#pre=%s' % (exp, urllib.parse.quote(art['save'], safe=''))
    if mode == 'state':
        u = art.get('state')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=state&exp=%s' % exp
    if mode == 'view':
        u = art.get('view')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=view&exp=%s' % exp
    if mode == 'prefs':
        if not art.get('prefs'): return None
        return 'harness.html?mode=prefs&exp=%s&id=snapcap#prefs=%s' % (exp, urllib.parse.quote(art['prefs'], safe=''))
    return None

def run(main_text, pages):
    write_main(main_text)
    want = set(pages)
    for pid, src1, _ in PHASE2:
        if pid in want: want.add(src1)
    out, arts = [], {}
    for key in PHASE1:
        if key not in want: continue
        res = run_page(PHASE1[key])
        out += collect(res, key)
        arts[key] = res.get('artifacts') or {}
    for pid, src1, mode in PHASE2:
        if pid not in want: continue
        path = phase2_path(mode, src1, arts.get(src1) or {})
        if not path:
            out.append((pid, False, '%s: phase 1 handed over nothing to open' % pid)); continue
        out += collect(run_page(path), pid)
    return out

try:
    src = read_b(main_path)
    print('main.js: %s%s' % (main_path, '   (CONTROL)' if control else ''))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else [k for k in MUTANTS if NEEDS.get(k, '') in src]
        skipped = [k for k in MUTANTS if k not in names and not one_mutant]
        if skipped: print('NOTE: not run on this main.js (it has not what they need): %s' % ' '.join(skipped))
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
        res = run(src, only.split(',') if only else ALL_PAGES)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:1200]), flush=True)
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
