# =============================================================================
# GRPLIST SUITE (2026-10-03) - the grouped view's List layout (step 2)
#
# Configure Grouping > Layout: List puts the group names in a column on the
# left and shows the selected group on the right, its own box fitted to the
# window and its table given the width its text needs (it scrolls sideways).
# js/penumbra_grouplist.js + css/penumbra_grouplist.css + the state and hooks in
# main.js. Each scenario loads the REAL main.js and the REAL module (harness.html,
# the hiddencols fixture grouped by H_GROUP, nested for n*) and publishes named
# checks:
#   L-<scn>-<check>  must hold on the candidate
#   E-<scn>          no page errors
#
#   py -3 run.py                        candidate = LIVE js\main.js + module + stylesheet
#   py -3 run.py --stage DIR            a stage in the app layout (DIR\js\main.js, DIR\js\penumbra_grouplist.js,
#                                       DIR\css\penumbra_grouplist.css)
#   py -3 run.py --control [--baseline F]
#                                       the build before (newest js\main.js.bak-*-grplist, or F) and NO module:
#                                       the List checks go RED, the Stacked ones stay green
#   py -3 run.py --mutant NAME / --mutant A,B,C / --mutants
#   --scn a,b                           a subset of scenarios
#   py -3 run.py --live-control         the LIVE build: the NEW checks (cmpgsort, rgsort, rgpaths - below) red, every other check
#                                       green; a fix already in live main.js has its checks expected GREEN instead
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
#
# RGSORT (2026-10-23): the same lost sort on the other paths - a regular regroup (the dialog's Apply, and with it the
# status-bar chip / header menu's group-by and a group_by trigger: rgapply, rglist (List), nrgapply (nested), rgprep
# (the Apply waiting for its rows), rgpivot (a pivot's sort left behind; the Apply's pivot branch; a throw)) and
# Remove Grouping (the flat rows in the page's sort, the user's choice 10-23 over dropping it: rgremove, rgremoff (no
# sort on: the report's own order), rgremlist (List, two levels), rgremsearch (a search typed), rgremguard (a pivot's
# sort, a throw)). rgsort re-sorts on EVERY Apply, so cmpgsort's "next" flag went: the mutants that edit it
# (cg-noresort, cg-noask, cg-reentry, cg-noconsume) are reported as superseded on a build without it, and cmpsort's
# 'consumed' reads the hook's 'missing' as spent. rgpivot's harness page has an #exitPivotModeBtn (that scenario only).
# Kit: penumbra_tests\rgsort\stage_20261023.
#
# RGPATHS (2026-10-23): the rest of the paths that redrew a view in an order the page's sort did not have. Grouped,
# rebuilt from the flat rows and never re-sorted: a search typed in the grouped view and cleared (rpsearch Stacked,
# rpsearchlist List), _pnbApplyColumnLayout - the header menu's move / hide, Settings > Columns, a hide of the sorted
# column (rplayout) -, a Custom Sort Order saved for the grouping column (rpcso), the journal's rebuild when the groups
# lack a configured column (rpjournal: the report journal on - run.py opens it with &id=, the harness answers
# manage_journal.php). Flat: a pivot's exit (rppivot: the flat rows in the page's sort before the paging - both of its
# branches -, the pivot's own sort gone unless it names a report column by number and name) and a comparison's Clear
# that leaves the flat table (rpcmpflat: the grouping's column gone from the result set - the hook hands out the
# comparison's record, getPreCmp; a pivot's sort through either renderer - runComparisonTwoSnapshots exported -;
# GUARD: a flat sort kept). The review's finds: the exit button with no pivot on screen ("View in table" from any
# view) drops no sort (rppivot noPivotKeeps, GUARD); a rebuild with no sort on clears the marks it cloned from the
# flat headings (rpmarksoff). rgsort's marker is 'function _pnbResortFlatView(' now (rgpaths gives it a parameter);
# cg-nogate / rg-nogate take the gate line as either build has it (a mutant's old text may be a tuple).
# Kit: penumbra_tests\rgpaths\stage_20261023.
#
# CMPGSORT (2026-10-23): a sort made in the grouped view orders the group tables, never the flat rows; a snapshot
# comparison's Clear regroups the flat rows (_restorePreCompareGrouping -> the dialog's Apply), and the groups came
# back unsorted and unmarked while the page's sort still held it. Scenarios cmpsort, ncmpsort, cmpsortprep, cmpsortpivot
# (Stacked) and cmpsortlist (List); the hook also exports updateHeaderIcons, getSort, setSort, getResortNext, records
# the tbodies each rebuild drew (window.__RGV_TB), with window.__FORCE_PREP makes the Apply wait for its rows as a big
# fill does, and with window.__THROW_SORT makes penumbraSortTbodyInPlace throw.
# Kit: penumbra_tests\cmpgsort\stage_20261023.
#
# ROUND 2 ("grplist2", 2026-10-03): the harness also loads density.css and the
# column-width tool (js/penumbra_colwidths.js + css, LIVE copies) as index.php does.
# New scenarios: longtext (fits first, like Stacked), pinnarrow (narrowing columns
# in the width tool shrinks the scroll), density, listwidth, trigger
# (group_by|...|layout=list|stacked through executeChainStep), switch
# (layout_switch / toggle_switch that name a layout); boot + exit gained checks.
# The CONTROL for round 2 is the build before it: run with no --stage while the
# LIVE app is still round 1 - the new checks must go red there.
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
JS_LIBS = ['jspdf-2.5.1.umd.min.js', 'jspdf-autotable-3.5.23.min.js']
SCN = [('boot', ''), ('many', ''), ('click', ''), ('keys', ''), ('search', ''), ('band', ''), ('email', ''), ('pdf', ''),
       ('exports', ''), ('save', ''), ('layoutonly', ''), ('wide', ''), ('widestacked', ''), ('nested', ''),
       ('nstick', ''), ('narrow', ''), ('kill', '&grouplist=off'), ('tallabove', ''), ('broken', ''), ('exit', ''),
       ('longtext', ''), ('pinnarrow', ''), ('pinhash', ''), ('density', ''), ('listwidth', ''), ('trigger', ''), ('switch', ''),
       ('copysnip', ''), ('pinflat', '&colwidths=flat'), ('radio', ''), ('tip', ''), ('compare', ''), ('fitstacked', ''), ('wideresize', ''), ('widecmp', ''), ('n3crumb', ''), ('nmerge', ''), ('nmergejs', ''), ('nmergeexp', ''), ('nsweep', ''), ('n3hidden', ''), ('npdf', ''), ('n3pdf', ''), ('pdf1', ''), ('nmail', ''), ('n3mail', ''), ('npath', ''),
       ('cmpsort', ''), ('cmpsortlist', ''), ('ncmpsort', ''), ('cmpsortprep', ''), ('cmpsortpivot', ''),
       ('rgapply', ''), ('rglist', ''), ('nrgapply', ''), ('rgprep', ''), ('rgpivot', ''),
       ('rgremove', ''), ('rgremoff', ''), ('rgremlist', ''), ('rgremsearch', ''), ('rgremguard', ''),
       ('rpsearch', ''), ('rpsearchlist', ''), ('rplayout', ''), ('rpcso', ''), ('rpjournal', '&id=gljr'), ('rppivot', ''), ('rpcmpflat', ''),
       ('rpmarksoff', '')]
# every check a scenario must publish (a missing one fails)
CHK = {
    'boot': ['on', 'items', 'oneGroup', 'open', 'fit', 'listFit', 'row', 'linksHidden', 'grid', 'count', 'selectedAria',
             'fieldSynced', 'listAuto', 'stableRows', 'barUnderList', 'barListWidth',
             'frame', 'barFlush', 'bandClean',    # round 4: one frame
             'rowFlush', 'bandTint', 'oneInset', 'ringOff',   # round 5: the row joins its pane
             'onePill', 'noSep',   # round 6: one vocabulary, no floating bullet
             'noEdgeWhileFits',   # glfit: no second rule beside a list that fits
             'darkEdge'],   # glsweep: a dark theme draws it anyway, in the grid's colour
    'many': ['longList', 'listScrolls', 'barUnderList', 'capped', 'edgeWhileScrolls', 'listKeep', 'rowStays',   # gltot
             'edgeColour'],   # glsweep
    'click': ['shown', 'aria', 'keepOpen', 'fitMoved'],
    'keys': ['down', 'end', 'home', 'upStays', 'shownFollows'],
    'search': ['searchEvent', 'listFollows', 'moved', 'items4', 'count', 'oneShown'],
    'band': ['noToggle', 'hasHide', 'hideWorks'],
    'email': ['stackedNow', 'same'],
    'pdf': ['same'],
    'exports': ['allRows', 'same'],
    'save': ['listSaved', 'stackedOmits'],
    'layoutonly': ['startsStacked', 'noRegroup', 'listOn', 'closed', 'regroup', 'stackedAgain'],
    'wide': ['minWidth', 'scrolls', 'headerSticky', 'headsFit'],   # round 7: no heading cut short
    # stackfit (2026-10-13): Stacked scrolls sideways too (was noMinWidth + noScroll)
    'widestacked': ['stackRule', 'screenOnly', 'scrolls', 'headerSticky', 'aligned', 'followsDensity', 'keptClosed',
                    'dropsStale', 'reopens', 'listOwns', 'headsFit', 'syncCheap'],   # stackfit2: no heading cut short
    # stackfit3: a short group and a tall one, a heading held - neither scrolls
    'fitstacked': ['measured', 'fits', 'tableFills', 'headsFit', 'heldRule', 'mixedHeights', 'mixedHeads',
                   'btnGap'],   # glgap: the group buttons stand off the search box
    # stackfit2: a set width is drawn as asked and a drag is not capped at the box
    'wideresize': ['toolExact', 'drawnExact', 'grows', 'scrollsMore', 'dragUncapped', 'headsFitPinned'],
    # stackfit2: a comparison's groups in Stacked get their own rule
    # crumbclick (2026-10-14): each name in the crumb goes to that group in the list
    'n3crumb': ['twoNames', 'pointer', 'rootGoes', 'rootOpen', 'rootShown', 'midGoes', 'nameNot', 'clipped', 'bandDom'],
    # glmerge (2026-10-14): a selected branch is one table
    'nmerge': ['clickSelects', 'allLeaves', 'oneHead', 'aligned', 'noFoot', 'oneScroll', 'rowsAll', 'headStays',
               'stripes', 'foldArrow', 'keysPass', 'enterSelects', 'backToLeaf', 'stripesBack', 'exitClean',
               'ptotal', 'ptAligned', 'ptPinned', 'ptNotTable', 'ptGone', 'boxKeep',   # gltot
               'hScroll', 'farCols',   # glhs
               'iconsInCells',   # glsweep: sort icons and grips stay in their header cell
               'ariaOwns', 'ptNames', 'ownsGone'],   # moderate (2026-10-15): WCAG 1.3.1 for a merged branch
    'nmergejs': ['clickSelects', 'headStays'],
    # glmerge: with a branch selected the PDF and the exports are Stacked's with that branch open
    # (glmail, 2026-10-14: the email is not - it carries the branch as one card, see nmail)
    'nmergeexp': ['pdf', 'exports'],
    # glmail (2026-10-14): a selected branch's email / Copy as HTML card is the one table the screen draws;
    # stackedCards is a GUARD (as before: green on the build before too); leafOwn was one until glpath
    # titled the group's card with the group above it
    'nmail': ['oneCard', 'band', 'foot', 'leafOwn', 'footLook', 'stackedCards', 'rows'],
    'n3mail': ['pathName', 'hiddenMid', 'oneLeaf'],
    # glsweep (2026-10-14): the bug sweep of the merged view
    'nsweep': ['mergeTables', 'stripesAfterMain', 'scrollPad', 'badgeMenu', 'totalFollows', 'rangeFollows', 'noteBtn',
               'selectGroup', 'rebuildKeeps', 'closedAfterRebuild', 'oneTotal', 'listKeys', 'printAll'],
    'n3hidden': ['firstDrawn', 'hiddenOut'],
    # pdfnest (2026-10-14): a grouped PDF prints the INNERMOST groups only, each titled with its path
    'npdf': ['noBranchPages', 'pathTitles', 'rowsMatch', 'collapsedSame', 'hiddenOuter'],
    'n3pdf': ['pathTitles3', 'mailPath3'],   # glpath: the email's cards too
    'pdf1': ['plainTitles', 'onePagePerGroup', 'mailPlain'],   # glpath: mailPlain is a GUARD
    # glpath (2026-10-14): every email / Copy as HTML card is titled with the groups it sits in
    'npath': ['listLeafPath', 'listAllPaths', 'stackedPaths'],
    'widecmp': ['cmpStacked', 'cmpRule', 'cmpScrolls', 'cmpHeadsFit', 'gridUntouched'],
    # round 4: h0 is 0 in List (the outer bands are hidden) - the drawn band's top is the base instead
    'nested': ['items9', 'path', 'folds', 'pathMoved', 'oneBand', 'crumb', 'bandTop', 'leftToBranch', 'footer', 'fills'],
    'nstick': ['h0', 'footer', 'fills'],
    'narrow': ['stackedNarrow', 'listWide'],
    'kill': ['off', 'rowHidden'],
    # glfit (2026-10-14): sized for the group scrolled into place, not the 425px cap
    'tallabove': ['boxFits', 'listFits', 'inPlace', 'tinyCap'],
    'broken': ['fellBack', 'staysStacked'],
    'exit': ['onBefore', 'cssGuard', 'gone', 'reset', 'fieldReset'],
    # round 2
    'longtext': ['minByHeadings', 'fits', 'tableFills', 'wraps'],
    'pinnarrow': ['headsFitPinned', 'scrollsFirst', 'pinDrawn', 'shrinks', 'noScroll', 'noRuleYet', 'restores'],
    'pinhash': ['toolRule', 'pinDrawn', 'headsFit', 'important', 'toolClears', 'headsFitAfter'],   # round 9: only '#' pinned
    'pinflat': ['viewsOff', 'ignoresPins', 'fits'],
    'density': ['standard', 'compact', 'easy', 'rowsFollow'],
    'listwidth': ['capped', 'shortFull', 'longClipped', 'groupBeside'],
    'trigger': ['startsStacked', 'listOn', 'layoutOnlyStep', 'aggKept', 'keepsList', 'cancelIgnored', 'junkIgnored', 'toStacked'],
    'switch': ['listSel', 'bestMatch', 'toggleOn', 'stackedNow', 'noRegroup', 'stepDone', 'stackedSel', 'plainSel', 'toggleOff', 'toggleBack'],
    'copysnip': ['writesList', 'stackedPlain'],
    # round 3
    'radio': ['opened', 'openShowsList', 'clickSets', 'appliedStacked', 'reopenShowsStacked', 'resetRepaints'],
    'tip': ['tipShows', 'tipDescribes'],
    # grplistcmp (2026-10-13): a snapshot comparison is listed too
    'compare': ['cmpOn', 'cmpItems', 'cmpOne', 'cmpPane', 'cmpFit', 'cmpDivider', 'cmpVisible', 'cmpCount', 'cmpClick',
                'cmpApplyStacked', 'cmpApplyList', 'cmpNotice', 'cmpRerun', 'cmpClear'],
    # cmpgsort (2026-10-23): a sort made in the grouped view (every group's table, never the flat rows), a snapshot
    # comparison, its Clear - the grouping comes back through the dialog's Apply, from the flat rows - and its sort
    # with it: rows, marks, stripes (Stacked: cmpsort, the nested ncmpsort, cmpsortprep - the Apply waiting for its
    # rows first; List: cmpsortlist)
    'cmpsort': ['sorted0', 'flatKept0', 'cleared', 'rowsBack', 'marksBack', 'sortKept', 'stripes', 'flatAfter', 'repaint',
                'consumed', 'nextDesc', 'cmpPutBack'],
    'cmpsortlist': ['noSortSame', 'multiBack', 'multiMarks', 'shownSorted'],
    'ncmpsort': ['nestBack', 'nestMarks'],
    'cmpsortprep': ['prepRan', 'prepBack', 'prepMarks'],
    # the review: a pivot's sort left behind is not applied to the restored groups; a re-sort that throws still lets
    # the Apply end (both GUARDS: green on the build before too)
    'cmpsortpivot': ['pivotLeft', 'throwContained'],
    # rgsort (2026-10-23): a sort made in the grouped view and a regular regroup - the dialog's Apply, the menu's
    # group-by, a group_by trigger (rgapply, Stacked), List with two levels (rglist), nested (nrgapply), the Apply
    # waiting for its rows (rgprep), a pivot's sort left behind / the Apply's pivot branch / a throw (rgpivot); then
    # Remove Grouping: the flat rows in the page's sort (rgremove), no sort on (rgremoff), List with two levels
    # (rgremlist), a search typed (rgremsearch), a pivot's sort left behind / a throw (rgremguard, GUARDS)
    'rgapply': ['sorted0', 'applyRan', 'rowsBack', 'marksBack', 'sortKept', 'stripes', 'flatKept', 'repaint', 'nextDesc',
                'menuSorted', 'menuMarks', 'triggerSorted', 'triggerMarks'],
    'rglist': ['noSortSame', 'multiBack', 'multiMarks', 'shownSorted'],
    'nrgapply': ['nestBack', 'nestMarks'],
    'rgprep': ['prepRan', 'prepBack', 'prepMarks'],
    'rgpivot': ['pivotLeft', 'pivotBranch', 'throwContained'],
    'rgremove': ['removed', 'flatSorted', 'flatMarks', 'flatSortKept', 'pageSorted', 'flatRepaint', 'flatNextDesc',
                 'regroupFromFlat', 'staleGone'],
    'rgremoff': ['offNatural', 'offUnmarked', 'offNextAsc'],
    'rgremlist': ['listGone', 'multiFlat', 'multiFlatMarks'],
    'rgremsearch': ['searchSorted', 'searchMarks'],
    'rgremguard': ['pivotLeftFlat', 'throwFlat'],
    # rgpaths (2026-10-23): the grouped rebuilds - a search cleared (rpsearch, rpsearchlist List), the column layout
    # (rplayout: the header menu's move and hide, Settings > Columns, the sorted column hidden), a Custom Sort Order on
    # the grouping column (rpcso), the journal (rpjournal); the flat views - a pivot's exit (rppivot), a comparison's
    # Clear that leaves the flat table (rpcmpflat)
    'rpsearch': ['noSortSame', 'cleared', 'clearSorted', 'clearMarks', 'clearStripes', 'clearSortKept', 'clearNextDesc'],
    'rpsearchlist': ['listBack', 'listMarks', 'listShown'],
    'rplayout': ['moveRan', 'moveSorted', 'moveMarks', 'hideSorted', 'hideMarks', 'panelSorted', 'panelMarks', 'hiddenSortKept'],
    'rpcso': ['bandsOrdered', 'csoSorted', 'csoMarks', 'csoSortKept'],
    'rpjournal': ['jrnRebuilt', 'jrnSorted', 'jrnMarks', 'jrnStripes'],
    'rppivot': ['exitNatural', 'exitUnmarked', 'exitPage', 'pivotSortGone', 'pivotRepaint', 'pivotShiftClick', 'rowFieldKept', 'exitSearch',
                'noPivotKeeps'],
    'rpcmpflat': ['goneFlat', 'goneSorted', 'goneMarks', 'goneSortKept', 'pivotCmpGone', 'pivotCmpRepaint', 'abPivotGone', 'flatKept'],
    # (the review) a flat sort's marks cloned into the groups by a rebuild with no sort on; the exit button with no
    # pivot on screen ("View in table" from any view) drops no sort (rppivot noPivotKeeps, GUARD)
    'rpmarksoff': ['offSearchUnmarked', 'offApplyUnmarked'],
}
# the checks the build before each fix fails (--live-control: these red, every other check green) - cmpgsort's, then
# rgsort's. A fix already in the LIVE main.js (its marker below) has its checks expected green there instead.
NEW_CMPGSORT = ['L-cmpsort-rowsBack', 'L-cmpsort-marksBack', 'L-cmpsort-stripes', 'L-cmpsort-repaint', 'L-cmpsort-consumed',
                'L-cmpsort-cmpPutBack', 'L-cmpsortlist-multiBack', 'L-cmpsortlist-multiMarks', 'L-cmpsortlist-shownSorted',
                'L-ncmpsort-nestBack', 'L-ncmpsort-nestMarks', 'L-cmpsortprep-prepBack', 'L-cmpsortprep-prepMarks']
NEW_RGSORT = ['L-rgapply-rowsBack', 'L-rgapply-marksBack', 'L-rgapply-stripes', 'L-rgapply-repaint', 'L-rgapply-menuSorted',
              'L-rgapply-menuMarks', 'L-rgapply-triggerSorted', 'L-rgapply-triggerMarks',
              'L-rglist-multiBack', 'L-rglist-multiMarks', 'L-rglist-shownSorted', 'L-nrgapply-nestBack', 'L-nrgapply-nestMarks',
              'L-rgprep-prepBack', 'L-rgprep-prepMarks', 'L-rgpivot-pivotBranch',
              'L-rgremove-flatSorted', 'L-rgremove-flatMarks', 'L-rgremove-pageSorted', 'L-rgremove-flatRepaint', 'L-rgremove-staleGone',
              'L-rgremoff-offNatural', 'L-rgremoff-offUnmarked', 'L-rgremlist-multiFlat', 'L-rgremlist-multiFlatMarks',
              'L-rgremsearch-searchSorted', 'L-rgremsearch-searchMarks']
NEW_RGPATHS = ['L-rpsearch-clearSorted', 'L-rpsearch-clearMarks', 'L-rpsearchlist-listBack', 'L-rpsearchlist-listMarks', 'L-rpsearchlist-listShown',
               'L-rplayout-moveSorted', 'L-rplayout-moveMarks', 'L-rplayout-hideSorted', 'L-rplayout-hideMarks', 'L-rplayout-panelSorted',
               'L-rplayout-panelMarks', 'L-rplayout-hiddenSortKept', 'L-rpcso-csoSorted', 'L-rpcso-csoMarks', 'L-rpjournal-jrnSorted',
               'L-rpjournal-jrnStripes', 'L-rppivot-exitNatural', 'L-rppivot-exitPage', 'L-rppivot-pivotSortGone', 'L-rppivot-pivotRepaint', 'L-rppivot-pivotShiftClick',
               'L-rppivot-rowFieldKept', 'L-rppivot-exitSearch', 'L-rpcmpflat-goneSorted', 'L-rpcmpflat-goneMarks', 'L-rpcmpflat-pivotCmpGone',
               'L-rpcmpflat-pivotCmpRepaint', 'L-rpcmpflat-abPivotGone', 'L-rpmarksoff-offSearchUnmarked', 'L-rpmarksoff-offApplyUnmarked']
NEW_SETS = [('cmpgsort', 'function _pnbResortGroupedView()', NEW_CMPGSORT), ('rgsort', 'function _pnbResortFlatView(', NEW_RGSORT),
            ('rgpaths', 'function _pnbPreCompareGroupingBack(', NEW_RGPATHS)]
# rgsort re-sorts on every Apply, so cmpgsort's "next" flag went with it: these mutants edit the flag and are
# reported as superseded on a build without it (the marker), not run
FLAG_MUTANTS = ('cg-noresort', 'cg-noask', 'cg-reentry', 'cg-noconsume')
FLAG_MARKER = '_pnbGroupResortNext'
# rgpaths sorts the flat rows as a pivot is left (its exit), so the Apply's pivot branch draws its groups from rows
# already in the sort: removing that branch's own re-sort changes nothing there - rp-pivotboth removes both
SUPERSEDED = {'rg-nopivot': ('function _pnbPreCompareGroupingBack(', 'rgpaths sorts the flat rows as the pivot is left (rp-pivotboth removes both)')}

# (file, old, new): file is 'main' (main.js), 'mod' (the module) or 'css' (its stylesheet)
MUTANTS = {
    # pdfnest: an outer group gets its own page again (the garbled title over an empty table)
    'pdfbranch': ([('main', "                const $groups = $('#groupedResultsContainer .group-wrapper.group-leaf').not('.search-hidden').filter(function () {", "                const $groups = $('#groupedResultsContainer .group-wrapper').not('.search-hidden').filter(function () {")],
                  ['L-npdf-noBranchPages'], ['npdf']),
    # pdfnest: a group's title without the groups it sits in
    'pdfpath': ([('main', "                    const gName = _pdfPath.concat(_pdfOwn.name ? [_pdfOwn.name] : []).join(' \\u203A ');", "                    const gName = _pdfOwn.name;")],
                ['L-npdf-pathTitles', 'L-n3pdf-pathTitles3'], ['npdf', 'n3pdf']),
    # pdfnest: the groups inside an outer group the search hid are printed
    'pdfhidden': ([('main', "                    return !$(this).parents('.group-wrapper.search-hidden').length;", "                    return true;")],
                  ['L-npdf-hiddenOuter'], ['npdf']),
    # pdfnest: the wrong set of groups - with one level, no page at all
    'pdfnone': ([('main', "                const $groups = $('#groupedResultsContainer .group-wrapper.group-leaf').not('.search-hidden').filter(function () {", "                const $groups = $('#groupedResultsContainer .group-wrapper.group-branch').not('.search-hidden').filter(function () {")],
                ['L-pdf1-onePagePerGroup'], ['pdf1']),
    # ---- glmail: a selected branch's email card ----
    # the module names no branch: a card per group again
    'mailapi': ([('mod', "            return { branch: mBranch, tables: mTables.slice() };\n", "            return null;\n")],
                ['L-nmail-oneCard', 'L-nmail-band', 'L-nmail-foot', 'L-nmail-rows', 'L-n3mail-pathName'], ['nmail', 'n3mail']),
    # the branch's other groups get cards of their own as well
    'mailskip': ([('main', "                if (_mTables && _mTables[0] !== _ownTable) return;   // drawn in the first group's card\r\n", "")],
                 ['L-nmail-oneCard'], ['nmail']),
    # the card is titled with its first group's band, not the branch's
    'mailband': ([('main', "const $srcHeader = _mBranch ? $(_mBranch).children('.group-header') : $srcGroup.find('.group-header');", "const $srcHeader = $srcGroup.find('.group-header');")],
                 ['L-nmail-band'], ['nmail']),
    # a card without the groups above it (glpath: every card's, re-anchored)
    'mailpath': ([('main', "                if (_mPath.length) groupNameText = _mPath.concat([groupNameText]).join(' \\u203A ');\r\n", "")],
                 ['L-n3mail-pathName', 'L-n3mail-oneLeaf', 'L-nmail-leafOwn', 'L-npath-listLeafPath', 'L-npath-listAllPaths',
                  'L-npath-stackedPaths', 'L-n3pdf-mailPath3'], ['n3mail', 'nmail', 'npath', 'n3pdf']),
    # ---- glpath: every card titled with its path ----
    # only a selected branch's card has its path (glmail as it was)
    'pathbranch': ([('main', "$(_mBranch || $srcGroup[0]).parents('.group-wrapper')", "$(_mBranch || []).parents('.group-wrapper')")],
                   ['L-npath-listLeafPath', 'L-npath-listAllPaths', 'L-npath-stackedPaths', 'L-n3pdf-mailPath3', 'L-nmail-leafOwn'], ['npath', 'n3pdf', 'nmail']),
    # a branch's card takes its first group's path: the branch named twice
    'pathleaf': ([('main', "$(_mBranch || $srcGroup[0]).parents('.group-wrapper')", "$($srcGroup[0]).parents('.group-wrapper')")],
                 ['L-nmail-band', 'L-n3mail-pathName'], ['nmail', 'n3mail']),
    # the card's own group in its path too: one level reads "A > A"
    'pathself': ([('main', ".parents('.group-wrapper').get().reverse().map(function (w) {", ".parents('.group-wrapper').addBack().get().reverse().map(function (w) {")],
                 ['L-pdf1-mailPlain'], ['pdf1']),
    # only the first group's rows
    'mailbody': ([('main', "(_mTables ? $(_mTables) : $srcTable).children('tbody')", "$srcTable.children('tbody')")],
                 ['L-nmail-rows'], ['nmail']),
    # no total for the branch
    'mailfoot': ([('main', "                    const _mFoot = _mTables ? penumbraGroupTotalFor(_mTables) : null;", "                    const _mFoot = null;")],
                 ['L-nmail-foot'], ['nmail']),
    # the first group's own footer as well: two total rows, the first the group's
    'mailtwofeet': ([('main', "const $srcTfoot = _mTables ? $() : $srcTable.children('tfoot');", "const $srcTfoot = $srcTable.children('tfoot');")],
                    ['L-nmail-foot'], ['nmail']),
    # a group's card loses its footer
    'mailnofeet': ([('main', "const $srcTfoot = _mTables ? $() : $srcTable.children('tfoot');", "const $srcTfoot = $();")],
                   ['L-nmail-leafOwn'], ['nmail']),
    # the total's cells unstyled (only the footer colour)
    'mailmodel': ([('main', "                            if (_m) copyStyles($(_m), $tdClone);\r\n", "                            if (false) copyStyles($(_m), $tdClone);\r\n")],   # (an else follows: keep the if)
                  ['L-nmail-footLook'], ['nmail']),
    # the summary badges stay in the total
    'mailbadge': ([('main', "                            const $tdClone = $('<td>').html(this.innerHTML);\r\n                            $tdClone.find('.pnb-sum-badge').remove();\r\n", "                            const $tdClone = $('<td>').html(this.innerHTML);\r\n")],
                  ['L-nmail-foot'], ['nmail']),
    # the groups inside a middle group the search hid get header-only cards
    'mailhidden': ([('main', "                if ($srcGroup.parents('.group-wrapper.search-hidden').length) return;\r\n                const _ownTable", "                const _ownTable")],
                   ['L-n3mail-hiddenMid'], ['n3mail']),
    # a branch down to one group is that group's card
    'mailone': ([('mod', "if (!on || !mBranch || !mTables || !table || mTables.indexOf(table) < 0) { return null; }", "if (!on || !mBranch || !mTables || mTables.length < 2 || !table || mTables.indexOf(table) < 0) { return null; }")],
                ['L-n3mail-oneLeaf'], ['n3mail']),
    # the branch outlives the List layout: Stacked's email merges it too
    'mailstacked': ([('mod', "if (!on || !mBranch || !mTables || !table || mTables.indexOf(table) < 0) { return null; }", "if (!mBranch || !mTables || !table || mTables.indexOf(table) < 0) { return null; }"),
                     ('mod', "            mBranch = null; mTables = null; mScroll = null;\n", "            mScroll = null;\n")],
                    ['L-nmail-stackedCards'], ['nmail']),
    # ---- glsweep: the merged view's bug sweep ----
    'swmtables': ([('mod', "            return mTables.indexOf(table) >= 0 ? mTables.slice() : null;", "            return null;")], ['L-nsweep-mergeTables'], ['nsweep']),
    'swzebra': ([('main', "            if (window.Penumbra && window.Penumbra.groupList && typeof window.Penumbra.groupList.restripe === 'function') window.Penumbra.groupList.restripe();", "")], ['L-nsweep-stripesAfterMain'], ['nsweep']),
    'swpad': ([('mod', "            c.style.scrollPaddingTop = (th0 ? Math.ceil(th0.getBoundingClientRect().height) : 0) + 'px';", "")], ['L-nsweep-scrollPad'], ['nsweep']),
    'swbadge': ([('main', "        var $td = $badge.closest('td, .pnb-gl-ptcell');", "        var $td = $badge.closest('td');")], ['L-nsweep-badgeMenu'], ['nsweep']),
    'swfresh': ([('mod', "                mObs = new MutationObserver(function (recs) {", "                mObs = new MutationObserver(function (recs) { return;")], ['L-nsweep-totalFollows'], ['nsweep']),
    'swrange': ([('mod', "        mRO = new ResizeObserver(function () { setRange(); });", "        mRO = new ResizeObserver(function () { });")], ['L-nsweep-rangeFollows'], ['nsweep']),
    'swnote': ([('mod', "        if (e.target.closest('.group-hide, .journal-pvnote-btn')) { return; }", "        if (e.target.closest('.group-hide')) { return; }")], ['L-nsweep-noteBtn'], ['nsweep']),
    'swselect': ([('mod', "            selPath = path; activePath = path;" + "\n", "            return false;" + "\n")], ['L-nsweep-selectGroup'], ['nsweep']),
    'swrebuild': ([('mod', "            keepScroll.push([kbox, mScroll.top, mScroll.left]);", "            keepScroll.push([kbox, 0, 0]);")], ['L-nsweep-rebuildKeeps'], ['nsweep']),
    'swpath': ([('mod', "                if (merge && w !== sel && sel.contains(w)) { mergeOpened.push(pathOf(w)); }", "                if (merge && w !== sel && sel.contains(w)) { mergeOpened.push(w); }")], ['L-nsweep-closedAfterRebuild'], ['nsweep']),
    'swdup': ([('mod', "if (!br || stale[x] !== ptEl || stale[x].parentNode !== box) {", "if (!br || stale[x].parentNode !== box) {")], ['L-nsweep-oneTotal'], ['nsweep']),
    'swkeys': ([('mod', "        if (l && l.parentNode === r && l._pnbGl) { return l; }", "        if (l && l.parentNode === r) { return l; }")], ['L-nsweep-listKeys'], ['nsweep']),
    'swprint': ([('css', "        visibility: visible !important;" + "\n" + "        animation: none !important;", "        animation: none !important;")], ['L-nsweep-printAll'], ['nsweep']),
    'swdrawn': ([('mod', "            for (var a = ls[i]; a && a !== br; a = a.parentElement) { if (a.classList && a.classList.contains('search-hidden')) { hid = true; break; } }", "            hid = ls[i].classList.contains('search-hidden');")], ['L-n3hidden-firstDrawn'], ['n3hidden']),
    # glsweep: the header cells unpositioned again - icons and grips pile up at the row's end
    'thstatic': ([('css', "    top: auto !important;\n}\n", "    position: static !important;\n}\n")],
                 ['L-nmerge-iconsInCells'], ['nmerge']),
    # glsweep: no edge on a dark theme beside a list that fits
    'darkedge': ([('css', "body.pnb-gl-on #groupedResultsContainer.pnb-gl-lscroll .group-wrapper.pnb-gl-sel,\nbody.pnb-gl-on.is-dark #groupedResultsContainer .group-wrapper.pnb-gl-sel {\n", "body.pnb-gl-on #groupedResultsContainer.pnb-gl-lscroll .group-wrapper.pnb-gl-sel {\n")],
                 ['L-boot-darkEdge'], ['boot']),
    # glsweep: the edge in the theme's --border-color again, not the grid's
    'edgecolor': ([('mod', "            if (ecol && r.style.getPropertyValue('--pnb-gl-edge') !== ecol) { r.style.setProperty('--pnb-gl-edge', ecol); }\n", "")],
                  ['L-boot-darkEdge', 'L-many-edgeColour'], ['boot', 'many']),
    # glgap: the group buttons touch the search box again
    'nogap': ([('mcss', "    column-gap: 24px;\r\n", "")],   # glsweep: the header grid's gap
              ['L-fitstacked-btnGap'], ['fitstacked']),
    # glhs: the groups under a selected branch clip again (main.css overflow: clip)
    'hsclip': ([('css', "body.pnb-gl-on #groupedResultsContainer .pnb-gl-merge .group-wrapper {\n    overflow: visible;\n}\n", "")],
               ['L-nmerge-hScroll', 'L-nmerge-farCols'], ['nmerge']),
    # gltot: main.js offers no branch total
    'ptmain': ([('main', "        totalFor: function (tables) { return penumbraGroupTotalFor(tables); }\r\n", "        totalFor: null\r\n")],
               ['L-nmerge-ptotal'], ['nmerge']),
    # gltot: the module never draws it
    'ptnone': ([('mod', "        parentTotal(merge ? sel : null, c, tbl);\n", "        parentTotal(null, c, tbl);\n")],
               ['L-nmerge-ptotal'], ['nmerge']),
    # gltot: equal columns instead of the header's widths
    'ptgrid': ([('mod', "row.style.gridTemplateColumns = ws.map(function (w) { return w + 'px'; }).join(' ');", "row.style.gridTemplateColumns = ws.map(function () { return '1fr'; }).join(' ');")],
               ['L-nmerge-ptAligned'], ['nmerge']),
    # gltot: not pinned to the box's foot
    'ptsticky': ([('css', "    position: sticky;\n    bottom: 0;\n    z-index: 4;\n    box-sizing: border-box;\n", "    z-index: 4;\n    box-sizing: border-box;\n")],
                 ['L-nmerge-ptPinned'], ['nmerge']),
    # gltot: the scroll positions are not put back after the re-measure
    'keepscroll': ([('mod', "            if (ke[0].scrollTop !== ke[1]) { ke[0].scrollTop = ke[1]; }\n", "")],
                   ['L-many-listKeep', 'L-nmerge-boxKeep'], ['many', 'nmerge']),
    # glmerge: a click on a branch's row only unfolds it again
    'mgnosel': ([('mod', "        else if (fromClick) { selPath = path; expanded[path] = true; }\n", "        else if (fromClick) { expanded[path] = true; }\n")],
                ['L-nmerge-clickSelects'], ['nmerge']),
    # glmerge: every group's header drawn
    'mghead': ([('css', "    visibility: collapse;\n", "")],
               ['L-nmerge-oneHead'], ['nmerge']),
    # glmerge: the other tables keep their own widths
    'mgwidth': ([('mod', "            if (merge) { shareWidths(tbl, mTables || []); }\n", "")],   # glsweep: re-anchored
                ['L-nmerge-aligned'], ['nmerge']),
    # glmerge: the per-group totals drawn between the groups
    'mgfoot': ([('css', "> table > tfoot {\n    display: none;\n}", "> table > tfoot {\n}")],
               ['L-nmerge-noFoot'], ['nmerge']),
    # glmerge: the header is not moved by the scroll-driven animation
    'mganim': ([('css', "        animation-timeline: --pnb-gl-merge;\n", "")],
               ['L-nmerge-headStays'], ['nmerge']),
    # glmerge: no scroll listener where there is no scroll-driven animation
    'mglisten': ([('mod', "            if (!SCROLL_ANIM) { box.addEventListener('scroll', placeHead, { passive: true }); }\n", "")],   # glsweep: re-anchored
                 ['L-nmergejs-headStays'], ['nmergejs']),
    # glmerge: the stripes restart in every group
    'mgstripe': ([('mod', "        restripe(r, merge ? sel : null);\n", "")],
                 ['L-nmerge-stripes'], ['nmerge']),
    # glmerge: what a branch opened stays open after it
    'mgclose': ([('mod', "            if (o.classList.contains('open')) {\n                o.classList.remove('open');\n", "            if (false) {\n")],   # glsweep: re-anchored
                ['L-nmerge-backToLeaf'], ['nmerge']),
    # crumbclick: a click on the crumb is swallowed like any band click
    'crumbclick': ([('mod', "        if (cp != null) { crumbGo(cp); }\n", "")],
                ['L-n3crumb-rootGoes', 'L-n3crumb-midGoes'], ['n3crumb']),
    # crumbclick: the names measured without the separators - the second name lands on the first
    'crumbsep': ([('mod', "            at += w + sep;\n", "            at += w;\n")],
                 ['L-n3crumb-midGoes'], ['n3crumb']),
    # crumbclick: the crumb reaches the name - a click on the group's own name jumps too
    'crumbwide': ([('mod', "            else if (ord > -1) { right = Math.min(right, cr.left - gap); }\n", "")],
                  ['L-n3crumb-clipped'], ['n3crumb']),
    # glfit: the box is read from the PAGE position again - under a tall header it keeps 425px
    'glpage': ([('mod', "            var room = Math.floor(want - base - (cr.top - rTop)", "            var room = Math.floor(want - (cr.top + window.pageYOffset)")],
               ['L-tallabove-boxFits', 'L-tallabove-inPlace'], ['tallabove']),
    # glfit: the list is read from the page position again
    'glpagelist': ([('mod', "            var lroom = want - base - (l.getBoundingClientRect().top - rTop)", "            var lroom = want - (l.getBoundingClientRect().top + window.pageYOffset)")],
                   ['L-tallabove-listFits'], ['tallabove']),
    # glfit: no left rule while the list scrolls
    'gledge': ([('mod', "            r.classList.toggle('pnb-gl-lscroll', l.scrollHeight > l.clientHeight + 1);\n", "")],
               ['L-many-edgeWhileScrolls'], ['many']),
    # glfit: the rule always - doubled beside a list that fits
    'gledgeall': ([('mod', "l.scrollHeight > l.clientHeight + 1);", "true);")],
                  ['L-boot-noEdgeWhileFits'], ['boot']),
    # stackfit3: measured on a short group, the box keeps its bar's width - tall groups scroll
    'nobarw': ([('mod', "        return c.clientWidth - (own > 0 ? 0 : scrollbarW());\n", "        return c.clientWidth;\n")],
               ['L-fitstacked-mixedHeights'], ['fitstacked']),
    # stackfit2: the module never tells the tool the view scrolls - set widths scale to the box, drags cap
    'nogrpscroll': ([('mod', "    document.documentElement.classList.add('pnb-grp-scroll');\n", "")],
                    ['L-wideresize-toolExact', 'L-wideresize-dragUncapped'], ['wideresize']),
    # the tool scales set widths down to the box again
    'cwscale': ([('cw', "groupScrolls() ? 0 : groupWidth(groupRefRow())", "groupWidth(groupRefRow())")],
                ['L-wideresize-toolExact'], ['wideresize']),
    # a drag is capped at the box again
    'cwcap': ([('cw', "        if (groupScrolls()) { return host.max; }\n", "")],
              ['L-wideresize-dragUncapped'], ['wideresize']),
    # comparison groups are left squeezed
    'nocmpscope': ([('mod', "        if (!cmp) { return out; }\n", "        return out;\n")],
                   ['L-widecmp-cmpRule', 'L-widecmp-cmpScrolls'], ['widecmp']),
    # no heading held at its need: '#' is cut short again
    'nohold': ([('mod', "        if (!short || !named) { return { w: w, cols: [] }; }\n", "        return { w: w, cols: [] };\n")],
               ['L-widestacked-headsFit'], ['widestacked']),
    # stackfit (2026-10-13): Stacked never measured - squeezed to fit again
    'nostack': ([('mod', "if (!wanted()) { if (on) { teardown(); } stackFit(); return; }", "if (!wanted()) { if (on) { teardown(); } return; }")],
                ['L-widestacked-stackRule', 'L-widestacked-scrolls', 'L-fitstacked-measured'], ['widestacked', 'fitstacked']),
    # the rule stays up under List
    'stackinlist': ([('mod', "            clearStack();   // List sizes its one table itself\n", "")],
                    ['L-widestacked-listOwns'], ['widestacked']),
    # the rule reaches print too
    'stackprint': ([('mod', "el.textContent = text ? '@media screen { ' + text + ' }' : '';", "el.textContent = text;")],
                   ['L-widestacked-screenOnly'], ['widestacked']),
    # a CLOSED group is measured (its icons read 0 wide) - nothing is ever dropped
    'stackclosed': ([('mod', "if (sc.tbls[i].getClientRects().length) { drawnT = sc.tbls[i]; break; }", "{ drawnT = sc.tbls[i]; break; }")],
                    ['L-widestacked-dropsStale'], ['widestacked']),
    # every collapse drops the rule (the next open squeezes for a frame)
    'stacknosig': ([('mod', "} else if (prev && sc.tbls.length && colSig(sc.tbls[0]) === prev.sig) {", "} else if (false) {")],
                   ['L-widestacked-keptClosed'], ['widestacked']),
    # asks more than the headings need: a narrow table scrolls
    'stackeager': ([('mod', "        var w = Math.ceil(pinSum + needSum), left", "        var w = Math.ceil(pinSum + needSum) + 5000, left")],
                   ['L-fitstacked-fits', 'L-fitstacked-measured'], ['fitstacked']),
    # grplistcmp: the module stands down in a comparison again
    'cmpexcl': ([('mod', "        if (window.innerWidth < NARROW) { return false; }", "        if (document.body.classList.contains('snapshot-comparison-active')) { return false; }\n        if (window.innerWidth < NARROW) { return false; }")],
                ['F-compare'], ['compare']),   # the list never appears: the scenario stops
    # the list walks the container only: a comparison's groups are one level down
    'cmphost': ([('mod', "    function groupsHost(r) { return (r && r.querySelector(':scope > #snapshotComparisonContainer')) || r; }", "    function groupsHost(r) { return r; }")],
                ['F-compare'], ['compare']),
    # the comparison's box is not the right-hand pane (the group sits in row 1 beside the list only)
    'cmppane': ([('css', "body.pnb-gl-on #groupedResultsContainer > #snapshotComparisonContainer {\n    grid-row: 1 / 4;\n    align-self: stretch;\n}", "")],
                ['L-compare-cmpDivider'], ['compare']),
    # display: contents for the comparison's box - jQuery's :visible goes false
    'cmpcontents': ([('css', "    grid-row: 1 / 4;\n    align-self: stretch;\n}\nbody.pnb-gl-on #groupedResultsContainer > .group-wrapper,", "    display: contents;\n}\nbody.pnb-gl-on #groupedResultsContainer > .group-wrapper,")],
                ['L-compare-cmpVisible'], ['compare']),
    # the comparison count reads :visible again
    'cmpcount': ([('main', "$('#snapshotComparisonContainer .group-wrapper:not(.search-hidden)').length;", "$('#snapshotComparisonContainer .group-wrapper:visible').length;")],
                 ['L-compare-cmpCount'], ['compare']),
    # Apply in a comparison ignores the layout (the 10-13 snapgrp guard)
    'cmpnolayout': ([('main', "                if (_cmpLayout !== currentGroupLayout) {", "                if (false) {")],
                    ['L-compare-cmpApplyStacked'], ['compare']),   # (List was on already: that Apply changes nothing)
    # Apply in a comparison regroups the live rows by __SNAP_TYPE (the bug before snapgrp)
    'cmpregroup': ([('main', "        if (selectedColumn === '__SNAP_TYPE') {", "        if (false) {")],
                   ['L-compare-cmpApplyStacked'], ['compare']),
    # nothing hidden: every group stays on screen
    'noclass': ([('mod', "if (w.classList.contains('pnb-gl-off') === k) { w.classList.toggle('pnb-gl-off', !k); changed = true; }", "")],
                ['L-boot-oneGroup', 'L-click-shown'], ['boot', 'click']),
    # hidden with .search-hidden: every export then drops the hidden groups
    'searchclass': ([('mod', "w.classList.toggle('pnb-gl-off', !k)", "w.classList.toggle('search-hidden', !k)")],
                    ['L-exports-allRows'], ['exports']),
    # no min-width: the selected table is squeezed like today, no sideways scroll
    'nominwidth': ([('mod', "if (w > 0) { tbl.style.minWidth = w + 'px'; fitted.push([tbl, 'minWidth']); }", "")],
                   ['L-wide-minWidth', 'L-wide-scrolls'], ['wide']),
    # no fit: the box keeps the stacked 425px cap
    'nofit': ([('mod', "if (room >= MIN_FIT) {", "if (false) {")],
              ['L-boot-fit'], ['boot']),
    # the grid rule without its guard beats .hide(): the container stays up after Remove Grouping
    'noguard': ([('css', 'body.pnb-gl-on #groupedResultsContainer:not([style*="display: none"]) {\n    display: grid !important;',
                  'body.pnb-gl-on #groupedResultsContainer {\n    display: grid !important;')],
                ['L-exit-cssGuard'], ['exit']),
    # no click guard: a click on the selected group's band collapses it (the re-sync re-opens it a frame later)
    'noblock': ([('mod', "if (!on || !e.target || !e.target.closest) { return; }\n        if (!e.target.closest('#groupedResultsContainer .group-wrapper > .group-header')) { return; }",
                  "return;")],
                ['L-band-noToggle'], ['band']),
    # every Apply regroups
    'layoutonly': ([('main', "        if (want === currentGroupLayout) return false;\r\n", "        return false;\r\n")],
                   ['L-layoutonly-noRegroup'], ['layoutonly']),
    # the normal Apply forgets the layout
    'noread': ([('main', "        // The layout (2026-10-03, grplist), read with the rest of the form.\r\n        currentGroupLayout = ($('#groupLayout').val() === 'list') ? 'list' : 'stacked';\r\n", "")],
               ['L-layoutonly-stackedAgain'], ['layoutonly']),
    # the first DRAWN band is not looked for: a hidden first band measures 0
    'stickyrevert': ([('main', "            var measured = 0;\r\n            for (var bi = 0; bi < bands.length && bi < 60 && !measured; bi++) {\r\n                measured = Math.round(bands[bi].getBoundingClientRect().height);\r\n            }\r\n",
                       "            var measured = Math.round(bands[0].getBoundingClientRect().height);\r\n")],
                     ['L-nstick-h0'], ['nstick']),
    # the footer's columns read from the first band again: a nested footer gets a cell per column per inner group
    'footerrevert': ([('main', "$(\"#groupedResultsContainer .group-wrapper.group-leaf:first > .group-content > table > thead > tr > th[data-colname]:not([style*='display: none'])\")",
                       "$(\"#groupedResultsContainer .group-wrapper:first th[data-colname]:not([style*='display: none'])\")")],
                     ['L-nested-footer', 'L-nested-fills', 'L-nstick-footer', 'L-nstick-fills'], ['nested', 'nstick']),
    # List is not saved
    'nosave': ([('main', "                state.groupLayout = 'list';\r\n", "")],
               ['L-save-listSaved'], ['save']),
    # no narrow-window fallback
    'nonarrow': ([('mod', "        if (window.innerWidth < NARROW) { return false; }", "")],
                 ['L-narrow-stackedNarrow'], ['narrow']),
    # the list's fallback is a cramped 150px again (beside a 425px box)
    'listfloor150': ([('mod', "(lroom >= MIN_FIT ? Math.floor(lroom) : STACKED_CAP)", "Math.max(MIN_FIT, Math.floor(lroom))")],
                     ['L-tallabove-listFloor'], ['tallabove']),
    # a fault is retried on the next event instead of staying Stacked
    'nobroken': ([('mod', "            broken = true;\n", "")],
                 ['L-broken-staysStacked'], ['broken']),
    # the search does not reach the list: the selected group disappears with nothing in its place
    'nosearchfollow': ([('main', "                _groupLayoutNotify('groupedSearched');", "")],
                       ['L-search-searchEvent'], ['search']),
    # ---- round 2 (grplist2) ----
    # widths set in the column-width tool are not read: narrowing columns cannot shrink the table
    'nopins': ([('mod', "            if (pinned > 0) {", "            if (false) {")],
               ['L-pinnarrow-shrinks', 'L-pinnarrow-noScroll'], ['pinnarrow']),
    # a column asks for its TEXT, not its heading: a long text column scrolls sideways again
    'textwidth': ([('mod', "var label = String(th.textContent || '')", "var label = String(tbl.textContent || '')")],
                  ['L-longtext-fits', 'L-longtext-minByHeadings'], ['longtext']),
    # the list keeps its own font size, whatever the density
    'nodensity': ([('mod', "        if (fs && l.style.fontSize !== fs) { l.style.fontSize = fs; }\n", "")],
                  ['L-density-compact', 'L-density-easy'], ['density']),
    # the list column is a fixed 260px again
    'fixedlist': ([('css', "    grid-template-columns: fit-content(min(420px, 40%)) minmax(0, 1fr);", "    grid-template-columns: 260px minmax(0, 1fr);")],
                  ['L-listwidth-capped'], ['listwidth']),
    # every sync re-draws the rows
    'listredraw': ([('mod', "        if (sig === lastSig && l.firstChild) { return; }\n", "")],
                   ['L-boot-stableRows'], ['boot']),
    # the grid sees no layout= option: it is read as a summary column / sort
    'nooption': ([('main', "                        const _gbOpts = _groupTriggerOptions(args);", "                        const _gbOpts = { pos: args, layout: null };")],
                 ['L-trigger-listOn'], ['trigger']),
    # a trigger without a layout reads the dialog's field as it stands (a cancelled choice)
    'nokeep': ([('main', "$('#groupLayout').val(_gbOpts.layout || currentGroupLayout);", "if (_gbOpts.layout) $('#groupLayout').val(_gbOpts.layout);")],
               ['L-trigger-cancelIgnored'], ['trigger']),
    # the dialog's field is not set from a loaded report
    'nofieldsync': ([('main', "                    $('#groupLayout').val(currentGroupLayout);\r\n", "")],
                    ['L-boot-fieldSynced'], ['boot']),
    # the layout-only shortcut does not end its step: a switch's step never completes
    'nostepdone': ([('main', "            penumbraSyncActiveLayout();\r\n            $(document).trigger('penumbra:stepComplete');\r\n            return;\r\n", "            return;\r\n")],
                   ['L-switch-stepDone'], ['switch']),
    # a layout_switch takes the FIRST match again: a plain position beats one naming the layout on screen
    'firstmatch': ([('main', "                if (s > best) { best = s; hit = i; }", "                if (s > 0 && hit < 0) { hit = i; }")],
                   ['L-switch-bestMatch'], ['switch']),
    # a layout_switch position that names a layout matches in either layout
    'anylayout': ([('main', "            if (_tl && _tl !== currentGroupLayout) return false;\r\n", "")],
                  ['L-switch-listSel'], ['switch']),
    # a toggle_switch command that names a layout is on in either layout
    'toggleany': ([('main', "            if (_cl && _cl !== currentGroupLayout) return false;", "")],
                  ['L-switch-toggleOff'], ['switch']),
    # grplist2b: a set width counts even where the tool does not draw the grouped view
    'pinanyview': ([('mod', "        var tool = document.documentElement.classList.contains('pnb-colw-views');", "        var tool = true;")],
                   ['L-pinflat-ignoresPins', 'L-pinflat-fits'], ['pinflat']),
    # grplist2b: the drawn width is trusted even when it is only the generic 350px cap
    'pinmaxwidth': ([('mod', "                sum += (drawn > 0 && drawn < pinned) ? drawn : pinned;", "                sum += drawn > 0 ? drawn : pinned;")],
                    ['L-pinnarrow-noRuleYet'], ['pinnarrow']),
    # Copy Snippet leaves the layout out: a List grouping pastes back as Stacked
    'nocopy': ([('main', "        if (_csList) triggerValue += '|layout=list';", "")],
               ['L-copysnip-writesList'], ['copysnip']),
    # ---- round 3 (grplist3) ----
    # the total bar goes back under the group
    'barcol2': ([('css', "    grid-column: 1;\n    grid-row: 2;\n    align-self: start;", "    grid-column: 2;\n    grid-row: 4;\n    align-self: start;")],
                ['L-boot-barUnderList', 'L-many-barUnderList'], ['boot', 'many']),
    # the total's one-line width widens the list's column (the table loses that width)
    'barwide': ([('css', "    contain: inline-size;\n", "")],
                ['L-boot-barListWidth'], ['boot']),
    # the box still gives up the total's height (glfit: one pass, so one edit)
    'barfit': ([('mod', "            var room = Math.floor(want - base - (cr.top - rTop) - under);", "            var room = Math.floor(want - base - (cr.top - rTop) - under - gtH);")],   # glfit: one pass now
               ['L-boot-fit'], ['boot']),
    # the list does not leave room for the total under it
    'barlist': ([('mod', "            var lroom = want - base - (l.getBoundingClientRect().top - rTop) - gtH - frameB;", "            var lroom = want - base - (l.getBoundingClientRect().top - rTop) - frameB;")],
                ['L-boot-listFit'], ['boot']),
    # ---- round 4 (grplist4): one frame ----
    # the container is not the frame: three cards with gaps again
    'noframe': ([('css', "    border: 1px solid var(--border-color, #d9dce1);\n    border-radius: 8px;\n    overflow: clip;\n    background: var(--bg-surface, #ffffff);\n}", "}")],
                ['L-boot-frame'], ['boot']),
    # the total floats 8px under the list again
    'gaptotal': ([('css', "    margin-top: 0;\n    top: calc(var(--pnb-grp-base, 0px) + var(--pnb-gl-list-h, 0px));", "    margin-top: 8px;\n    top: calc(var(--pnb-grp-base, 0px) + var(--pnb-gl-list-h, 0px) + 8px);")],
                 ['L-boot-barFlush'], ['boot']),
    # the hidden chevron keeps its 20px blank at the head of the band
    'chevronback': ([('css', "    display: none;   /* was visibility:hidden - a 20px blank at the head of the band (grplist4) */", "    visibility: hidden;")],
                    ['L-boot-bandClean'], ['boot']),
    # the bands above the selected group are drawn again: two headings, the summary twice
    'bandsback': ([('css', "body.pnb-gl-on #groupedResultsContainer .group-wrapper:not(.pnb-gl-sel) > .group-header {\n    display: none;\n}", "")],
                  ['L-nested-oneBand'], ['nested']),
    # the band shows no path to a nested group
    'nocrumb': ([('mod', "        if (sel) { sel.classList.toggle('pnb-gl-deep', names.length > 0); }", "")],
                ['L-nested-crumb'], ['nested']),
    # ---- round 5 (grplist5): the selected row joins its pane ----
    # the reserved scrollbar gutter is back: the row stops 11px short of the divider
    'gutterback': ([('css', "    scrollbar-width: thin;\n    /* No reserved gutter (grplist5):", "    scrollbar-width: thin;\n    scrollbar-gutter: stable;\n    /* No reserved gutter (grplist5):")],
                   ['L-boot-rowFlush'], ['boot']),
    # the band keeps the theme's own grey and its 14px padding: not the row's colour or height
    'bandgrey': ([('css', "    padding: 0 1em;\n    min-height: 3em;\n    background: var(--bg-surface-alt, #eef1f6);\n}", "}")],
                 ['L-boot-bandTint'], ['boot']),
    # a flat list keeps the blank twisty slot: names 18px off the inset
    'twistyback': ([('css', "#pnbGroupList:not(:has(.pnb-gl-item[aria-expanded])) .pnb-gl-twisty {\n    display: none;\n}", "")],
                   ['L-boot-oneInset'], ['boot']),
    # the keyboard ring is drawn all the time again
    'ringon': ([('css', "#pnbGroupList:focus-visible .pnb-gl-item.is-active {", "#pnbGroupList .pnb-gl-item.is-active {")],
               ['L-boot-ringOff'], ['boot']),
    # ---- round 6 (grplist6): one vocabulary ----
    # the three pills are three sizes and styles again
    'pillsplit': ([('css', "#pnbGroupList .pnb-gl-count,\nbody.pnb-gl-on #groupedResultsContainer .group-wrapper.pnb-gl-sel > .group-header .group-count,\nbody.pnb-gl-on #groupedResultsContainer > .group-grand-total > .group-header.ggt-header .group-count {\n    font-size: 0.9em;", "#pnbGroupList .pnb-gl-count {\n    font-size: 0.9em;")],
                  ['L-boot-onePill'], ['boot']),
    # the bullet floats at the head of the controls bar again
    'sepback': ([('css', "body.pnb-gl-on #collapseAllGroups,\nbody.pnb-gl-on #removeGroupingSep {", "body.pnb-gl-on #collapseAllGroups {")],
                ['L-boot-noSep'], ['boot']),
    # ---- round 7 (grplist7): no heading cut short ----
    # the percentages' sliver stands: the '#' heading is clipped again
    'nowiden': ([('mod', "            widenHeads(tbl);", "")],
                ['L-wide-headsFit'], ['wide']),
    # ---- round 9 (grplist9): the widths beat the tool's % !important ----
    # a plain inline width: the tool's percentages win and the free headings are cut
    'noimportant': ([('mod', "            plan[j][0].style.setProperty('width', plan[j][1] + 'px', 'important');", "            plan[j][0].style.width = plan[j][1] + 'px';")],
                    ['L-pinhash-headsFit', 'L-pinhash-important'], ['pinhash']),
    # the grouping dialog never wires the ? popover: the Layout tip shows nothing
    'notipinit': ([('main', "        if (typeof initHelpPopover === 'function') initHelpPopover();\r\n        $('#groupingLightbox').css('display', 'flex').hide().fadeIn();", "        $('#groupingLightbox').css('display', 'flex').hide().fadeIn();")],
                  ['L-tip-tipShows'], ['tip']),
    # opening the dialog does not repaint the radios: they keep the HTML default (Stacked)
    'nopaint': ([('main', "        _groupLayoutPaint();   // grplist3: the radios show it\r\n", "")],
                ['L-radio-openShowsList'], ['radio']),
    # a radio click does not reach the hidden field
    'noradioset': ([('main', "        if (this.checked) $('#groupLayout').val(this.value === 'list' ? 'list' : 'stacked');", "")],
                   ['L-radio-clickSets'], ['radio']),
    # Reset clears the field but leaves the radio on List
    'noresetpaint': ([('main', "        $('#groupLayout').val('stacked');\r\n        _groupLayoutPaint();   // grplist3\r\n", "        $('#groupLayout').val('stacked');\r\n")],
                     ['L-radio-resetRepaints'], ['radio']),
    # moderate (2026-10-15, WCAG 1.3.1): the first table no longer owns the later tables' rows
    'a11yowns': ([('mod', "        ownMerged(mTables);\n", "")], ['L-nmerge-ariaOwns'], ['nmerge']),
    # ... leaves its aria-owns behind when the branch is left
    'a11yownsleft': ([('mod', "        if (ownsHost && (ownsHost !== host0 || !want)) { ownsHost.removeAttribute('aria-owns'); ownsHost = null; }\n", "")],
                     ['L-nmerge-ownsGone'], ['nmerge']),
    # the total's cells lose their column names
    'a11yptname': ([('mod', "                cell.setAttribute('aria-label', colName);\n", "")], ['L-nmerge-ptNames'], ['nmerge']),
    # ---- cmpgsort (2026-10-23): a comparison's Clear hands a sorted grouped view back sorted ----
    # the Apply's regroup is not re-sorted (the bug)
    'cg-noresort': ([('main', "                if (_resort) _pnbResortGroupedView();\r\n", "")],
                    ['L-cmpsort-rowsBack', 'L-cmpsort-marksBack', 'L-cmpsort-repaint', 'L-cmpsort-cmpPutBack'], ['cmpsort']),
    # the restore does not ask its Apply for the re-sort
    'cg-noask': ([('main', "        _pnbGroupResortNext = true;\r\n", "")],
                 ['L-cmpsort-rowsBack', 'L-cmpsortlist-multiBack', 'L-ncmpsort-nestBack'], ['cmpsort', 'cmpsortlist', 'ncmpsort']),
    # the lazy-row re-entry (a big fill: the Apply waits for its rows, then runs again) drops the request
    'cg-reentry': ([('main', "_pnbConfirmGrouping.call(_self, e, true, _auto, _resort); });", "_pnbConfirmGrouping.call(_self, e, true, _auto); });")],
                   ['L-cmpsortprep-prepBack', 'L-cmpsortprep-prepMarks'], ['cmpsortprep']),
    # the request outlives its Apply: every later Apply would re-sort
    'cg-noconsume': ([('main', " : _pnbGroupResortNext; _pnbGroupResortNext = false;\r\n", " : _pnbGroupResortNext;\r\n")],
                     ['L-cmpsort-consumed'], ['cmpsort']),
    # the re-sorted groups keep the cloned headings' (missing) marks
    'cg-nomarks': ([('main', "            // Every group carries its own clone of the thead: this marks all of them.\r\n            updateHeaderIcons();\r\n", "")],
                   ['L-cmpsort-marksBack', 'L-cmpsortlist-multiMarks'], ['cmpsort', 'cmpsortlist']),
    # the re-sorted rows keep the stripes of their old places
    'cg-nozebra': ([('main', "this marks all of them.\r\n            updateHeaderIcons();\r\n            applyZebraStriping();\r\n", "this marks all of them.\r\n            updateHeaderIcons();\r\n")],
                   ['L-cmpsort-stripes'], ['cmpsort']),
    # no sort on: the restore re-sorts (redraws every group's tbody) anyway
    'cg-nogate': ([('main', ("    function _pnbResortGroupedView() {\r\n        if (!sortCriteria || !sortCriteria.length) return;\r\n",
                    "    function _pnbResortGroupedView() {\r\n        // (2026-10-23, rgpaths) No sort on: the marks only - the rebuild cloned the flat table's\r\n        // headings, which keep a flat sort's marks after the grouped view turned that sort off\r\n        // (repainted only when one shows: most rebuilds clone none).\r\n        if (!sortCriteria || !sortCriteria.length) { if (document.querySelector('#groupedResultsContainer th.sorted')) { try { updateHeaderIcons(); } catch (e) { } } return; }\r\n"), "    function _pnbResortGroupedView() {\r\n")],
                  ['L-cmpsortlist-noSortSame'], ['cmpsortlist']),
    # a level that names no heading of the group tables (a pivot's sort left behind) is applied anyway
    'cg-nopivot': ([('main', "            if (!sortCriteria.every(function (c) {\r\n", "            if (false && !sortCriteria.every(function (c) {\r\n")],
                   ['L-cmpsortpivot-pivotLeft'], ['cmpsortpivot']),
    # a throw in the re-sort escapes: the Apply's own steps after it never run
    'cg-nocatch': ([('main', "            try { console.warn('[cmpgsort] re-sort skipped:', e); } catch (x) { }\r\n", "            throw e;\r\n")],
                   ['L-cmpsortpivot-throwContained'], ['cmpsortpivot']),
    # ---- rgsort (2026-10-23): a sort made in the grouped view survives a regular regroup and Remove Grouping ----
    # the Apply's regroup is not re-sorted (the bug - a comparison's Clear is an Apply too)
    'rg-noapply': ([('main', "                // never orders\r\n                _pnbResortGroupedView();\r\n", "                // never orders\r\n")],
                   ['L-rgapply-rowsBack', 'L-rgapply-marksBack', 'L-rgapply-menuSorted', 'L-rgapply-triggerSorted', 'L-rglist-multiBack',
                    'L-nrgapply-nestBack', 'L-rgprep-prepBack', 'L-cmpsort-rowsBack'], ['rgapply', 'rglist', 'nrgapply', 'rgprep', 'cmpsort']),
    # the pivot branch (a pivot on screen is left first, then the grouping drawn) is not re-sorted
    'rg-nopivot': ([('main', "                _pnbResortGroupedView();   // (2026-10-23, rgsort) the page's sort on the groups drawn, as below\r\n", "")],
                   ['L-rgpivot-pivotBranch'], ['rgpivot']),
    # no sort on: a regular Apply re-sorts (redraws every group's tbody) anyway
    'rg-nogate': ([('main', ("    function _pnbResortGroupedView() {\r\n        if (!sortCriteria || !sortCriteria.length) return;\r\n",
                    "    function _pnbResortGroupedView() {\r\n        // (2026-10-23, rgpaths) No sort on: the marks only - the rebuild cloned the flat table's\r\n        // headings, which keep a flat sort's marks after the grouped view turned that sort off\r\n        // (repainted only when one shows: most rebuilds clone none).\r\n        if (!sortCriteria || !sortCriteria.length) { if (document.querySelector('#groupedResultsContainer th.sorted')) { try { updateHeaderIcons(); } catch (e) { } } return; }\r\n"), "    function _pnbResortGroupedView() {\r\n")],
                  ['L-rglist-noSortSame'], ['rglist']),
    # Remove Grouping leaves the flat rows as they were (the bug)
    'rg-noflat': ([('main', "            _pnbResortFlatView();\r\n", "")],
                  ['L-rgremove-flatSorted', 'L-rgremove-flatMarks', 'L-rgremove-pageSorted', 'L-rgremove-staleGone', 'L-rgremoff-offNatural',
                   'L-rgremoff-offUnmarked', 'L-rgremlist-multiFlat', 'L-rgremsearch-searchSorted'], ['rgremove', 'rgremoff', 'rgremlist', 'rgremsearch']),
    # the flat rows sorted, their headings left as they were
    'rg-flatmarks': ([('main', "            penumbraSortTbodyInPlace($tb);\r\n            updateHeaderIcons();\r\n        } catch (e) {\r\n", "            penumbraSortTbodyInPlace($tb);\r\n        } catch (e) {\r\n")],
                     ['L-rgremove-flatMarks', 'L-rgremove-staleGone', 'L-rgremlist-multiFlatMarks', 'L-rgremsearch-searchMarks'], ['rgremove', 'rgremlist', 'rgremsearch']),
    # no sort on: the rows a flat sort moved stay where it put them
    'rg-flatoff': ([('main', "                if (moved) penumbraSortTbodyInPlace($tb);\r\n", "")],
                   ['L-rgremoff-offNatural'], ['rgremoff']),
    # no sort on: the old sort's marks stay
    'rg-flatoffmarks': ([('main', "                if (moved) penumbraSortTbodyInPlace($tb);\r\n                updateHeaderIcons();\r\n", "                if (moved) penumbraSortTbodyInPlace($tb);\r\n")],
                        ['L-rgremoff-offUnmarked'], ['rgremoff']),
    # a level that names no flat heading (a pivot's sort left behind) is applied to the flat rows anyway
    'rg-flatgate': ([('main', "            if (!ours) return;\r\n", "")],
                    ['L-rgremguard-pivotLeftFlat'], ['rgremguard']),
    # a throw in the flat re-sort escapes: Remove Grouping's own steps after it never run
    'rg-flatcatch': ([('main', "            try { console.warn('[rgsort] flat re-sort skipped:', e); } catch (x) { }\r\n", "            throw e;\r\n")],
                     ['L-rgremguard-throwFlat'], ['rgremguard']),
    # the flat re-sort after the paging: page 1 keeps the rows the old order put there
    'rg-flatlate': ([('main', "            _pnbResortFlatView();\r\n", ""),
                     ('main', "            updateTableBorders();\r\n            // FORCE containerization when returning to main view\r\n",
                      "            _pnbResortFlatView();\r\n            updateTableBorders();\r\n            // FORCE containerization when returning to main view\r\n")],
                    ['L-rgremove-pageSorted'], ['rgremove']),
    # ---- rgpaths (2026-10-23): the rest of the paths that redraw a view ----
    # a search cleared in the grouped view: its rebuild not re-sorted (the bug)
    'rp-nosearch': ([('main', "                    // rows, which a sort made in the grouped view never orders\r\n                    _pnbResortGroupedView();\r\n", "                    // rows, which a sort made in the grouped view never orders\r\n")],
                    ['L-rpsearch-clearSorted', 'L-rpsearch-clearMarks', 'L-rpsearchlist-listBack', 'L-rpsearchlist-listShown'], ['rpsearch', 'rpsearchlist']),
    # _pnbApplyColumnLayout's rebuild (Settings > Columns, the header menu) not re-sorted
    'rp-nolayout': ([('main', "                    // (2026-10-23, rgpaths) the page's sort on the groups just drawn from the flat rows\r\n                    _pnbResortGroupedView();\r\n", "")],
                    ['L-rplayout-moveSorted', 'L-rplayout-moveMarks', 'L-rplayout-hideSorted', 'L-rplayout-panelSorted', 'L-rplayout-hiddenSortKept'], ['rplayout']),
    # a Custom Sort Order's rebuild not re-sorted
    'rp-nocso': ([('main', "            // rebuild draws them from the flat rows\r\n            _pnbResortGroupedView();\r\n", "            // rebuild draws them from the flat rows\r\n")],
                 ['L-rpcso-csoSorted', 'L-rpcso-csoMarks'], ['rpcso']),
    # the journal's rebuild not re-sorted
    'rp-nojournal': ([('main', "                // search below only hides rows in place)\r\n                _pnbResortGroupedView();\r\n", "                // search below only hides rows in place)\r\n")],
                     ['L-rpjournal-jrnSorted', 'L-rpjournal-jrnStripes'], ['rpjournal']),
    # a pivot's exit leaves the flat rows as they were (the bug)
    'rp-noexit': ([('main', "                if (_pnbPivotOn) _pnbResortFlatView(true);\r\n", "")],
                  ['L-rppivot-exitNatural', 'L-rppivot-exitPage', 'L-rppivot-pivotSortGone', 'L-rppivot-rowFieldKept', 'L-rppivot-exitSearch'], ['rppivot']),
    # ...re-sorts them, but keeps the pivot's own sort
    'rp-exitkeep': ([('main', "                if (_pnbPivotOn) _pnbResortFlatView(true);\r\n", "                if (_pnbPivotOn) _pnbResortFlatView();\r\n")],
                    ['L-rppivot-pivotSortGone', 'L-rppivot-pivotRepaint', 'L-rppivot-pivotShiftClick'], ['rppivot']),
    # the flat helper never drops a sort that is not the flat table's
    'rp-nodrop': ([('main', "            if (!ours && dropForeign) { sortCriteria = []; return _pnbResortFlatView(); }\r\n", "")],
                  ['L-rppivot-pivotSortGone', 'L-rppivot-pivotRepaint', 'L-rpcmpflat-pivotCmpGone', 'L-rpcmpflat-pivotCmpRepaint', 'L-rpcmpflat-abPivotGone'],
                  ['rppivot', 'rpcmpflat']),
    # ...drops it, but leaves the rows where the old flat sort put them
    'rp-droprows': ([('main', "{ sortCriteria = []; return _pnbResortFlatView(); }", "{ sortCriteria = []; return; }")],
                    ['L-rppivot-pivotSortGone'], ['rppivot']),
    # ...drops a sort that is not the flat table's with no pivot on screen too ("View in table" from any view)
    'rp-exitalways': ([('main', "                if (_pnbPivotOn) _pnbResortFlatView(true);\r\n", "                _pnbResortFlatView(true);\r\n")],
                      ['L-rppivot-noPivotKeeps'], ['rppivot']),
    # a rebuild with no sort on keeps the marks it cloned from the flat headings
    'rp-nomarksoff': ([('main', "if (!sortCriteria || !sortCriteria.length) { if (document.querySelector('#groupedResultsContainer th.sorted')) { try { updateHeaderIcons(); } catch (e) { } } return; }", "if (!sortCriteria || !sortCriteria.length) return;")],
                      ['L-rpmarksoff-offSearchUnmarked', 'L-rpmarksoff-offApplyUnmarked'], ['rpmarksoff']),
    # the Apply's pivot branch with neither the exit's flat re-sort nor its own: its groups in the flat order
    'rp-pivotboth': ([('main', "                if (_pnbPivotOn) _pnbResortFlatView(true);\r\n", ""),
                      ('main', "                _pnbResortGroupedView();   // (2026-10-23, rgsort) the page's sort on the groups drawn, as below\r\n", "")],
                     ['L-rgpivot-pivotBranch'], ['rgpivot']),
    # a comparison taking over from a pivot keeps the pivot's sort (compare-to-live; A-vs-B)
    'rp-noentry': ([('main', "                        _pnbResortFlatView(true);\r\n                    }\r\n\r\n                    let decompressed", "                    }\r\n\r\n                    let decompressed")],
                   ['L-rpcmpflat-pivotCmpGone', 'L-rpcmpflat-pivotCmpRepaint'], ['rpcmpflat']),
    'rp-noentryab': ([('main', "                        _pnbResortFlatView(true);\r\n                    }\r\n\r\n                    // Both A and B", "                    }\r\n\r\n                    // Both A and B")],
                     ['L-rpcmpflat-abPivotGone'], ['rpcmpflat']),
    # a comparison's Clear that leaves the flat table pages them as they were (the bug)
    'rp-noclear': ([('main', "            if (!_pnbPreCompareGroupingBack(_preCompareGrouping)) _pnbResortFlatView();\r\n", "")],
                   ['L-rpcmpflat-goneSorted', 'L-rpcmpflat-goneMarks'], ['rpcmpflat']),
    # ...re-sorts the flat rows even when the grouping comes back (they stay as they were then: cmpsort's GUARD)
    'rp-clearall': ([('main', "            if (!_pnbPreCompareGroupingBack(_preCompareGrouping)) _pnbResortFlatView();\r\n", "            _pnbResortFlatView();\r\n")],
                    ['L-cmpsort-flatAfter'], ['cmpsort']),
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
base_path = opt('--baseline', None)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
verbose = flag('--verbose')
# cmpgsort: the LIVE build as the control - the NEW checks red, every other check green
live_control = flag('--live-control')
if live_control and (stage_dir or control or all_mutants or one_mutant): raise SystemExit('--live-control runs the live build alone')
src_root = stage_dir or APP
cand = {'main': os.path.join(src_root, 'js', 'main.js'),
        'mod': os.path.join(src_root, 'js', 'penumbra_grouplist.js'),
        'css': os.path.join(src_root, 'css', 'penumbra_grouplist.css'),
        'cw': os.path.join(src_root, 'js', 'penumbra_colwidths.js')}
if not os.path.exists(cand['cw']): cand['cw'] = os.path.join(APP, 'js', 'penumbra_colwidths.js')
cand['mcss'] = os.path.join(src_root, 'css', 'main.css')
if not os.path.exists(cand['mcss']): cand['mcss'] = os.path.join(APP, 'css', 'main.css')
if control:
    if not base_path:
        baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-grplist'))
        if not baks: raise SystemExit('--control needs --baseline <main.js before the change> (the deploy leaves js\\main.js.bak-<stamp>-grplist)')
        base_path = baks[-1]

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['runTableSearch', 'getExportData', 'generatePdfContent', 'loadScript', 'updateGroupedResultCount',
             'buildStateObject', 'removeGrouping', 'applyDensity', 'executeChainStep', 'penumbraSyncActiveLayout',
             'runComparisonAndDisplayGrouped', 'compressString', 'updateComparisonResultCount',   # grplistcmp
             'rebuildGroupedView', 'recalculateGroupTotals', 'applyZebraStriping',   # glsweep
             'updateHeaderIcons',   # cmpgsort: the repaint with no table (the journal's)
             'runComparisonTwoSnapshots']   # rgpaths: the A-vs-B renderer
    # cmpgsort: the page's sort, and the restore's re-sort request (a ReferenceError on a build without it: 'missing');
    # every rebuild leaves the group tbodies it drew in window.__RGV_TB; with window.__FORCE_PREP the grouping Apply's
    # penumbraPrepareRows({allRows}) answers with a promise, as a big fill does (the handler then runs again)
    h = ('\r\n;try { window.__HC = {'
         ' setLayout: function (v) { try { currentGroupLayout = v; } catch (e) { } },'
         ' getLayout: function () { try { return currentGroupLayout; } catch (e) { return null; } },'
         ' getSort: function () { try { return JSON.parse(JSON.stringify(sortCriteria)); } catch (e) { return null; } },'
         ' setSort: function (v) { try { sortCriteria = v; } catch (e) { } },'
         ' getResortNext: function () { try { return _pnbGroupResortNext; } catch (e) { return "missing"; } },'
         ' getPreCmp: function () { try { return _preCompareGrouping; } catch (e) { return "missing"; } },'   # rgpaths
         ' getMaster: function () { try { return masterRowData; } catch (e) { return null; } } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n'
         'try { var __pnbRGV = rebuildGroupedView; rebuildGroupedView = function () { window.__REBUILDS = (window.__REBUILDS || 0) + 1; var r = __pnbRGV.apply(this, arguments); window.__RGV_TB = Array.prototype.slice.call(document.querySelectorAll("#groupedResultsContainer table > tbody")); return r; }; } catch (e) { window.__HC_ERR3 = String(e); }\r\n'
         'try { var __pnbPPR = penumbraPrepareRows; penumbraPrepareRows = function (o) { if (window.__FORCE_PREP && o && o.allRows) { window.__PREPS = (window.__PREPS || 0) + 1; return new Promise(function (r) { setTimeout(r, 60); }); } return __pnbPPR.apply(this, arguments); }; } catch (e) { window.__HC_ERR4 = String(e); }\r\n'
         'try { var __pnbSTI = penumbraSortTbodyInPlace; penumbraSortTbodyInPlace = function () { if (window.__THROW_SORT) { window.__THROWN = (window.__THROWN || 0) + 1; throw new Error("cmpgsort: a forced throw"); } return __pnbSTI.apply(this, arguments); }; } catch (e) { window.__HC_ERR5 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        # (rgpaths) alternatives: the anchor as one build or another has it
        if isinstance(old, tuple): old = ([o for o in old if t[f].count(o) == 1] + [old[0]])[0]
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_gl_')
os.makedirs(os.path.join(stage, 'js'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in JS_LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, 'js', f))
# glgap: main.css is a candidate file too ('mcss': the stage's when it has one), written by run_build
# round 2: density.css and the column-width tool, as index.php loads them (live copies)
shutil.copyfile(os.path.join(APP, 'css', 'density.css'), os.path.join(stage, 'density.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colwidths.css'), os.path.join(stage, 'penumbra_colwidths.css'))
# stackfit2: the column-width tool is a candidate file too ('cw': the stage's when it has
# one, else live), written by run_build so a mutant can reach it
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
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        # (rgpaths) where the page stands: the driver's step, its errors, the overlay hides and rebuilds so far
        st = call('Runtime.evaluate', {'expression': 'JSON.stringify({step: window.__STEP || null, errs: (window.__errors || []).concat(window.__rejections || []).slice(0, 3), hides: window.__HC_HIDES || 0, rebuilds: window.__REBUILDS || 0, hidden: document.hidden})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout (300 s) at %s' % st}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

# grplist3: the tip scenario's help = the candidate's group-layout tip block (help/tips/pivot-tips-storage.php since the v1 help went, 2026-10-19)
# behind the marker ensureHelpLoaded() checks for (the harness cannot run the PHP).
help_src = os.path.join(src_root, 'help', 'tips', 'pivot-tips-storage.php')
if control or not os.path.exists(help_src): help_src = os.path.join(APP, 'help', 'tips', 'pivot-tips-storage.php')
def help_stub():
    h = read_b(help_src)
    i = h.find('<div data-tip="group-layout">')
    block = h[i:h.find('</div>', i) + 6] if i >= 0 else ''
    # grplistcmp: the compare engine clones index.php's analysis-card template
    ix = read_b(os.path.join(APP, 'index.php'))
    k = ix.find('<template id="snapshotAnalysisTemplate">')
    tpl = ix[k:ix.find('</template>', k) + 11] if k >= 0 else ''
    return ('window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + block) + ';\n'
            + 'window.__SNAPTPL = ' + json.dumps(tpl) + ';\n')

def run_build(texts, scns):
    open(os.path.join(stage, 'help_stub.js'), 'wb').write(help_stub().encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_grouplist.js'), 'wb').write(texts['mod'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_grouplist.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_colwidths.js'), 'wb').write(texts['cw'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main.css'), 'wb').write(texts['mcss'].encode('utf-8', 'surrogateescape'))
    out = {}
    for s, x in SCN:
        if s not in scns: continue
        r = run_page(s, x)
        if r.get('fatal') and 'never finished loading' in r['fatal']:
            r = run_page(s, x); r['retried'] = True
        out[s] = r
    return out

def evaluate(res, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r = res.get(s, {})
        if r.get('fatal'):
            add('F-' + s, False, (r.get('fatal') or '')[:400]); continue
        add('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing'),
            'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), r.get('missing')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:330]) if v is not True else ''))
    return out

try:
    names = [s for s, _ in SCN]
    if scn_arg: names = [s for s in names if s in scn_arg.split(',')]
    if control:
        texts = {'main': read_b(base_path), 'mod': '/* --control: no module */\n', 'css': '/* --control: no module */\n',
                 'cw': read_b(os.path.join(APP, 'js', 'penumbra_colwidths.js')),
                 'mcss': read_b(os.path.join(APP, 'css', 'main.css'))}
        print('CONTROL: %s and NO module' % base_path)
    else:
        texts = {k: read_b(v) for k, v in cand.items()}
        print('candidate: %s' % src_root)
    if all_mutants or one_mutant:
        ok = bad = gone = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):   # cmpgsort: --mutant a,b,c runs those
            if m in SUPERSEDED and SUPERSEDED[m][0] in texts['main']:
                gone += 1
                print('  SKIP  mutant %-15s superseded: %s' % (m, SUPERSEDED[m][1]))
                continue
            if m in FLAG_MUTANTS and FLAG_MARKER not in texts['main']:
                gone += 1
                print('  SKIP  mutant %-15s superseded: rgsort re-sorts on every Apply (no %s in this build)' % (m, FLAG_MARKER))
                continue
            edits, must, scns = MUTANTS[m]
            res = evaluate(run_build(mutate(texts, m), scns), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-30s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d superseded=%d' % (ok, bad, gone))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(texts, names), names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if live_control:
            NEW = []
            for nm, marker, ids in NEW_SETS:
                if marker in texts['main']: print('CONTROL: %s is in live main.js already - its checks are expected GREEN' % nm)
                else: NEW += ids; print('CONTROL: %s is not in live main.js - its %d checks are expected RED' % (nm, len(ids)))
            seen = [a for a, _, _ in res]
            new_green = [a for a in NEW if a in seen and a not in failed]
            new_unseen = [a for a in NEW if a not in seen and (a.split('-')[1] in names)]
            old_red = [a for a in failed if a not in NEW]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            # a build without a fix (live before its deploy, another session's stage) fails that fix's checks: say so
            for nm, marker, ids in NEW_SETS:
                red = [a for a in ids if a in failed]
                if red and marker not in texts['main']:
                    print('NOTE: %s is not in this build: %d of its checks are red as on the build before it (expected until it is in): %s' % (nm, len(red), ' '.join(red)))
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
