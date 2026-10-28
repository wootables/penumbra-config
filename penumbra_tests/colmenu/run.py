# =============================================================================
# COLMENU SUITE (2026-10-16) - the table header's right-click menu
# (js/penumbra_colmenu.js + css/penumbra_colmenu.css + main.js window.Penumbra.headerMenu,
# penumbra_calc.js openDialog(name, {seed, onAdded}), penumbra_colwidths.js fit/resetAll).
#   page half   harness.html (mk_harness.py, from colopt's) + driver.js: the REAL main.js,
#               column options, calculated column and column width modules
#                                                                   L-<scn>-<check>, E-<scn>
#   static      index.php loads the module behind its .off switch; the help names it  S-*
# --control runs LIVE (no module: EMPTY files): every NEW check red there, every other
# one green (they describe what live already does: a cell's menu is the browser's).
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_cm_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['mflat', 'mkbd', 'mopts', 'mcalc', 'mgroupby', 'gmenu', 'mrestr', 'mexcl', 'mcopy', 'mjournal', 'mmore', 'mfitnest', 'mfitnote', 'mcell', 'mnest', 'mload', 'msubs', 'mbucket', 'mnum',   # (round 33) mreset retired: Reset all columns left the menu
       'mauto', 'mauto2', 'ggmenu', 'gglist', 'ggfmt', 'mautostale', 'mhl']   # (2026-10-24, hlhead) mhl
SCN = SCN + ['mnestgb', 'ggnest']   # (2026-10-25, nestgb) Group by on a nested-table column
SCN = SCN + ['gnnestbd', 'gchipnest']   # (2026-10-25, nestgb2) a group's band menu and the status bar chip on nested-table columns
SCN = SCN + ['ggstat']   # (2026-10-26, cstat) Column stats in the grouped view, a search typed there
SCN = SCN + ['mcopym', 'ggcopym']   # (2026-10-27, copymenu) the menu's copies as one list, Copy
# (2026-10-27, fltmenu) a cell's Filter list, Copy's [column name] / This nested table / Distinct column groups; mhl retired
# with Highlight... (the user: "Highlight is a redundant card that is already inside 'Column options...'"): fmNoHighlight
SCN = [s for s in SCN if s != 'mhl'] + ['mfltm']
CHK = {
    # (2026-10-27, copymenu) ONE Copy list: a cell's (in its place) and a heading's; This row (the layout, a value of several
    # lines, '#', a nested table, a journal toggle); the report hiding Clipboard; the keyboard; the grouped view's. (copymenu 2)
    # no For SQL in any list (cmDistinct, cmNestNoSql), Link to this view where the page can make a view link
    'mcopym': ['cmCell', 'cmList', 'cmValue', 'cmRow', 'cmRowLayout', 'cmRowLines', 'cmHead', 'cmHeadList', 'cmName', 'cmDistinct',
               'cmClipOff', 'cmViewLinkNone', 'cmViewLink', 'cmNumRow', 'cmNumHead', 'cmKbd', 'cmNestList', 'cmNestRow', 'cmNestNoSql', 'cmJournal'],
    'ggcopym': ['gcList', 'gcRow'],
    # (2026-10-27, fltmenu) the Filter list (text, number, date; the bounds' rule; a heading flat), Click to filter (off / on /
    # off, the report's for every column), no Highlight..., the Copy list's order and names, groups (date, number, none),
    # a nested table's lists and copy, '#', the keyboard
    'mfltm': ['fmCell', 'fmList', 'fmFilterRuns', 'fmNumList', 'fmAtLeast', 'fmKeepOther', 'fmDropOther', 'fmDate', 'fmHead', 'fmNoHighlight', 'fmNoHighlightCell',
              'fmClick', 'fmForced', 'fmCopyOrder', 'fmCopyName', 'fmHeadName', 'fmGroupsList', 'fmGroupsCopy', 'fmGroupsNum', 'fmGroupsNone',
              'fmNestLists', 'fmNestCopy', 'fmNestPad', 'fmNumCell', 'fmKbd'],
    # (2026-10-26, cstat) Column stats in the grouped view with a search typed there (it marks the grouped rows alone): the rows it
    # keeps, each row once (grouped by SUB_NAME a row sits in several groups); csAll / csBefore: no search, a search before grouping
    'ggstat': ['csAll', 'csCount', 'csNum', 'csJournal', 'csBefore', 'csOnce', 'csShownCopy'],
    # (2026-10-25, nestgb2) the group band menu's Group by lists (grouped by H_GROUP, H_GROUP2) and the status bar's grouping
    # chip: no nested-table column, its tables' columns at the top level (the dialog's Nested Table Columns)
    'gnnestbd': ['nbTopList', 'nbDedupe', 'nbNoParent', 'nbInnerNone', 'nbOtherTitle', 'nbPick', 'nbPickTick', 'nbUndo', 'nbKbd', 'nbHiddenNot', 'nbHiddenList'],
    'gchipnest': ['ncNoParent', 'ncPlain', 'ncNestList', 'ncPick', 'ncActive'],
    # (2026-10-25, nestgb; nestcopy) a nested-table column's Nested columns section: Group by and Copy distinct values per column
    # of its tables (flat and grouped, mouse and keyboard)
    'mnestgb': ['nsNoDraw', 'nsSection', 'nsAria', 'nsColList', 'nsOwnOnly', 'nsPlain', 'nsNone', 'nsDigitSafe', 'nsListThrows', 'nsCase', 'nsNoRaw', 'nsClipOff', 'nsCopy',
                'nsCopyOther', 'nsCmpNone', 'nsInnerOwn', 'nsStats', 'nsStatsFilter', 'nsStatsTables', 'nsStaleNoEmpty', 'nsGroups', 'nsGroupedTick', 'nsRegroup', 'nsKbdOpens', 'nsKbdPick', 'nsKbdCopy', 'nsKbdScroll'],   # (v2: the review's six; v3: nsCmpNone, nsInnerOwn)
    'ggnest': ['gnSection', 'gnKbdOpens', 'gnKbdPick', 'gnTick', 'gnTickNoop', 'gnCopyGrouped', 'gnStatsGrouped'],
    'mhl': ['hlItem', 'hlAlone', 'hlHeaderOption', 'hlBack', 'hlKbdFocus', 'hlKbdNotReset', 'hlResetFocus', 'hlNotNum', 'hlNotRestricted'],   # (2026-10-24, hlhead) Highlight... in the menu
    # (2026-10-20, grpsweep 2) a formatted column's group; a List choice left behind by a saved view
    'ggfmt': ['fmtOnlyAll'],
    'mautostale': ['staleChoice'],
    # (2026-10-20, grpauto) the grouped view's layout from the group count, when none is named
    'mauto': ['autoFew', 'sameAgain', 'autoMany', 'tipShown', 'redecides', 'tipOnce', 'chosenSticks', 'ungroupResets', 'boundary8', 'filterNoFlip', 'boundary9', 'staleForm'],
    'mauto2': ['dialogKeepsAuto', 'radioPickSticks', 'triggerBare', 'triggerNamedSticks', 'cancelledPick', 'narrowStacked', 'implicitStacked'],
    # (2026-10-20, grpmenu) a group's own menu: on a band (Stacked), in the List layout
    'ggmenu': ['gmOpens', 'gmTitle', 'gmItems', 'gmMarked', 'gmUnmarked', 'gmToggle', 'gmToggleBack', 'gmCopy', 'gmOnly', 'gmOnlyReplaces', 'gmOnlyBlank', 'gmHide',
               'gmSort', 'gmSortList', 'gmBarLast', 'gmSortSumm', 'gmOtherLast', 'gmByList', 'gmGroupBy', 'gmTick', 'gmUndo', 'gmAdd', 'gmLevelMenu', 'gmAddUsed',
               'gmRemoveLevel', 'gmRemoveUndo', 'gmUniqueNo', 'gmCollapseAll', 'gmKbd', 'gmKbdBack', 'gmNativeSecond', 'gmExpandAll', 'gmRestricted', 'gmHdrRestricted',
               'gmCompareNative', 'gmTotalNative', 'gmConfigure', 'gmUngroup', 'gmUndoStale'],
    'gglist': ['glSwitch', 'glRowOpens', 'glRowItems', 'glRowMarked', 'glBandOpens', 'glKbd', 'glKbdBack', 'glNoteDrawn', 'glKbdStackFocus', 'glToStacked'],
    'mflat': ['opens', 'prevented', 'titleName', 'statsLine', 'statsAllUnique', 'statsDup', 'statsNum', 'statsDate', 'statsTop', 'statsEmpty', 'statsToggle', 'statsNotes', 'statsJournalFiltered', 'statsFiltered', 'itemsAll', 'sortAsc', 'sortChecked', 'sortDesc', 'sortClear', 'moveRight', 'moveMinimal', 'cellsFollow', 'saved',
              'toastUndo', 'noSavedToast', 'undo', 'edgeDisabled', 'moveStart', 'moveEnd', 'tipNotEarly', 'tipThird', 'tipStored', 'tipOnce',
              'tipOpens', 'hide', 'hideSaved', 'skipHidden', 'showList', 'showHere', 'showFilled', 'swapList', 'swapDone', 'multiMove', 'lastNotHidable'],
    'mkbd': ['opensBelow', 'focusFirst', 'arrowMoves', 'enterRuns', 'focusBack', 'escCloses', 'escFocusBack', 'outsideCloses'],
    'mopts': ['optsPopover', 'optsTitle', 'optsNoFreeze', 'optsOpener', 'optsCloses', 'optsBack', 'freezeItem', 'freezes', 'unfreezeItem', 'unfreezes',
              'noFreezePast5', 'fitItem', 'fits', 'fitUndo', 'fitUndone', 'fitAll', 'fitAllUndo', 'fitPage', 'fitPageUndo', 'resetItem', 'resets', 'fitsLong', 'fitsLongCut', 'fitCapped'],
    'mcalc': ['dialog', 'seeded', 'placedRight', 'placeSaved', 'calcRemoveItem', 'calcRemoved', 'calcStart'],
    'mgroupby': ['uniqueAsks', 'groupItem', 'grouped', 'uniqueQuiet', 'stalePickQuiet'],   # uniqueAsks / uniqueQuiet 2026-10-19 (grpunique): an all-different column asks first
    'gmenu': ['opens', 'noFreeze', 'cellGroup', 'groupItems', 'sortsGroups', 'fitGroup', 'moveAll', 'groupsKept', 'hideAll', 'regroup', 'ungroup'],
    'mrestr': ['sortOnly', 'noLayout'],
    'mexcl': ['cellNative', 'numMenu', 'compareNative'],
    'mcell': ['cellOpens', 'cellFilter', 'cellAdd', 'cellExclude', 'cellCopy', 'cellRaw', 'cellBlank', 'cellNatives', 'cellKbd'],
    # (round 23) a nested-table (@@JSON) column
    'mnest': ['nestOpens', 'nestNoFilter', 'nestStats', 'nestSubOpens', 'nestSubFilter', 'nestPadOpens', 'nestLinkOpens', 'nestLinkFoot', 'nestNoFoot', 'nestLinkFilter',
              'nativeShift', 'nativeSecond', 'nativeOther', 'nativeSecondCell', 'nestRowHeight', 'nestRowHeightPlain', 'nestRowHeightFlips'],
    'msubs': ['topOrder', 'noChips', 'arrows', 'showLabel', 'moveList', 'flyPos', 'nested', 'hoverSwitch', 'showList', 'hoverCloses', 'hoverOpens', 'calcList',
              'copyList', 'resetList', 'clearPanel', 'kbdOpens', 'kbdBack', 'escAll', 'outsideAll'],
    'mreset': ['raItem', 'raOffClean', 'raOnCustom', 'raLayout', 'raCells', 'raPref', 'raFmt', 'raShade', 'raSum', 'raWidth', 'raFreeze', 'raToast',
               'raOffAfter', 'unLayout', 'unCells', 'unFmt', 'unShade', 'unSum', 'unWidth', 'unFreeze', 'unFmtOnly'],
    'mbucket': ['bkModes', 'bkList', 'bkValues', 'bkApply', 'bkReopen', 'bkGap', 'bkOpenEnd', 'bkClear', 'bkText', 'dtModes', 'dtList', 'dtUnits', 'dtApply', 'dtClear'],
    'mnum': ['numOpens', 'numItems', 'numResets', 'numSort', 'numHide', 'numShowItem', 'numShown', 'numCell'],
    'mload': ['idSame', 'idFast', 'idFallback', 'idDynamic', 'edExists', 'edHiddenSkip', 'edShownRefresh', 'edShownNow', 'edShownOnce'],
    'mfitnest': ['nestGrow', 'nestCompact', 'fitLines'],
    # (2026-10-20, notefit) Fit on the Notes column: the note's own box (16em growing / 22em one line), the button's row
    'mfitnote': ['noteGrow', 'noteCompact', 'noteShort', 'noteSpill'],
    'mjournal': ['jrnPainted', 'jrnNoGroup', 'jrnNotesCell', 'jrnAddNote', 'jrnAddNoteScrolled', 'jrnInNote', 'jrnMoves', 'jrnStaysUnsaved', 'jrnSwap', 'jrnSaved'],
    'mmore': ['thenItems', 'thenSort', 'filterList', 'filterApply', 'filterReopen', 'filterBack', 'filterEsc', 'filterClear', 'filterBlank',
              'only', 'showAll', 'resetCol', 'copyName'],
    'mcopy': ['copyItem', 'copySubmenu', 'copyComma', 'copyNewline', 'copyTab', 'copyFiltered', 'copyKeeps', 'copyOther'],
    # (not in SCN) the menu left open for a picture: PNB_SHOT=<png> py -3 run.py --stage DIR --scn mshot
    'mshot': ['open'],
    # (not in SCN) a big report's move, timed / profiled: --scn mperf [PNB_PROFILE=<json>] [PNB_ROWS=N]
    'mperf': ['done'],
    'mrerun': ['done'],
}
# what this change brings: everything but the checks of what live already does
GUARDS = {'L-mexcl-cellNative', 'L-mexcl-numMenu', 'L-mexcl-compareNative', 'L-mshot-open', 'L-mperf-done', 'L-mrerun-done'}
NEW_R1 = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - GUARDS | {'S-indexLoads', 'S-helpNamed'}
# round 2 (2026-10-16): the counts under the name, the measuring Fit
NEW_R2 = {'L-mflat-statsLine', 'L-mflat-statsEmpty', 'L-mflat-statsFiltered', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup', 'S-helpFit'}
# round 3 (2026-10-16): Fit's cap, journal counts, Copy distinct values
NEW = {'L-mopts-fitCapped', 'L-mflat-statsToggle', 'L-mflat-statsNotes', 'S-helpCopy'} | {'L-mcopy-' + c for c in CHK['mcopy']}
# round 4 (same deploy): "all unique" / "none empty" (statsLine and statsFiltered read the new words), Swap...
NEW_R34 = NEW | {'L-mflat-statsAllUnique', 'L-mflat-statsLine', 'L-mflat-statsFiltered', 'L-mflat-swapList', 'L-mflat-swapDone', 'S-helpSwap'}
# round 5 (2026-10-16): journal columns a fixed block; the popover's Back
NEW_R5 = {'L-mopts-optsBack', 'S-helpBack'}
# round 6 (2026-10-16): journal columns movable (mjournal rewritten), the eight new items
NEW_R6 = {'S-helpBack', 'S-helpMore'} | {'L-mjournal-' + c for c in CHK['mjournal']} | {'L-mmore-' + c for c in CHK['mmore']}
# round 7 (2026-10-16): Fit measures nested sub-tables and multi-line cells as they lay out
NEW_R7 = {'L-mfitnest-' + c for c in CHK['mfitnest']}
# round 8 (2026-10-17): the cell menu
NEW_R8 = {'L-mcell-' + c for c in CHK['mcell']} | {'L-gmenu-cellGroup', 'S-helpCells'}
# round 9 (2026-10-17, perf): a move touches only the moved cells (multiMove is a guard: the
# old full pass got it right too, just slowly)
NEW_R9 = {'L-mflat-moveMinimal'}
# round 10 (2026-10-17, load perf): id lists found by id; a hidden editor refreshed when shown
# (idSame, idFallback, idDynamic, edExists, edShownNow are guards: live gets them right too)
NEW_R10 = {'L-mload-idFast', 'L-mload-edHiddenSkip', 'L-mload-edShownRefresh', 'L-mload-edShownOnce'}
# round 11 (2026-10-17): Reset all columns - every mreset check is new (live has no item),
# plus the help rows
NEW_R11 = {'L-mreset-' + c for c in CHK['mreset']} | {'S-helpResetAll', 'S-helpRowHeight'}
# round 12 (2026-10-17): the menu reorganized (mockup B) - the lists under one item; the
# checks of the old top level that changed shape come along (itemsAll, showList, copySubmenu)
NEW_R12 = {'L-msubs-' + c for c in CHK['msubs']} | {'S-helpSubs', 'L-mflat-itemsAll', 'L-mflat-showList', 'L-mflat-showHere', 'L-mflat-showFilled', 'L-mcopy-copySubmenu',
       'S-helpResetAll', 'S-helpMore', 'S-helpSwap', 'S-helpCopy'}
# round 13 (2026-10-17): the lists open BESIDE their item (hover, click, ArrowRight), no Back;
# Column stats and Pivot / Chart left out; Copy distinct values named again. The checks that
# read a list (showList, swapList, copy*) and the top level (itemsAll) change shape with it.
NEW_R13 = {'L-msubs-' + c for c in CHK['msubs']} | {'L-mflat-itemsAll', 'L-mflat-showList', 'L-mflat-swapList', 'L-mcopy-copyItem', 'L-mcopy-copySubmenu', 'L-mmore-copyName',
       'S-helpMore', 'S-helpCopy', 'S-helpStats'}
# round 16 (2026-10-17): Filter by value's Ranges for a number column (bkText is a guard: live has no modes either)
NEW_R16 = {'L-mbucket-' + c for c in CHK['mbucket']} - {'L-mbucket-bkText'} | {'S-helpRanges'}
# round 19 (2026-10-18): Fit's Undo, Fit all column widths, date Ranges
NEW_R19 = {'L-mopts-fitUndo', 'L-mopts-fitUndone', 'L-mopts-fitAll', 'L-mopts-fitAllUndo', 'L-mbucket-dtModes', 'L-mbucket-dtList', 'L-mbucket-dtApply', 'L-mbucket-dtClear', 'S-helpFitAll'}
# round 20 (2026-10-18): the '#' menu, journal cells, Add a note to this row, date units
NEW_R20 = {'L-mnum-' + c for c in CHK['mnum']} | {'L-mjournal-jrnNotesCell', 'L-mjournal-jrnAddNote', 'L-mbucket-dtUnits', 'S-helpNum', 'L-mexcl-numMenu', 'L-mcell-cellNatives'}
# round 21 (2026-10-18): Column stats as a list beside the item (the stats checks change shape), the
# notes button's inside, Remove this calculated column
NEW_R21 = {'L-mflat-statsLine', 'L-mflat-statsAllUnique', 'L-mflat-statsTop', 'L-mflat-statsToggle', 'L-mflat-statsNotes', 'L-mflat-statsFiltered',
           'L-mjournal-jrnInNote', 'L-mcalc-calcRemoveItem', 'L-mcalc-calcRemoved', 'S-helpStats', 'L-msubs-topOrder'}   # live fe02e8c
NEW_GRPU = {'L-mgroupby-uniqueAsks'}   # (2026-10-19, grpunique) live 72b3f9d
# round 23 (2026-10-19): nested-table (@@JSON) columns - no checklist filter, stats count the tables, a sub-cell
# filters in its sub-column, the cell around the table offers no value (live offers Filter to "@@JSON[{...")
NEW_R23 = {'L-mnest-nestNoFilter', 'L-mnest-nestStats', 'L-mnest-nestSubOpens', 'L-mnest-nestSubFilter', 'L-mnest-nestPadOpens', 'S-helpStats'}   # live e44fe71
# round 24 (2026-10-19): a linked sub-cell (fi-epa-c) opens the menu and filters by its text
NEW_R24 = {'L-mnest-nestLinkOpens', 'L-mnest-nestLinkFilter'}   # live a34b30e
# round 25 (2026-10-19): the way to the browser's menu (Shift, a second right-click), the link items gone, a footer
NEW_R25 = {'L-mnest-nestLinkOpens', 'L-mnest-nestLinkFoot', 'L-mnest-nativeShift', 'L-mnest-nativeSecond', 'L-mnest-nativeSecondCell'}   # live a04520b
# round 26 (2026-10-19): the Duplicates line (statsAllUnique reads it too)
NEW_R26 = {'L-mflat-statsDup', 'L-mflat-statsAllUnique'}   # live 04e78f3
NEW_R30 = {'L-mnest-nestRowHeight', 'L-mnest-nestRowHeightFlips'}   # live 7482049
# (round 31) the item reads the state in force, not a stale checkbox (both checks start from a stale one)
NEW_R31 = {'L-mnest-nestRowHeight', 'L-mnest-nestRowHeightFlips'}
# (2026-10-20, grpauto + grpmenu) the layout from the group count; a group's own menu. The guards describe
# what live already does: few groups Stacked (and still Stacked at exactly 8), a snippet's bare group_by
# keeps the layout, a comparison's groups and the All groups bar keep the browser's menu.
GRP_GUARDS = {'L-mauto-autoFew', 'L-mauto-boundary8', 'L-mauto2-triggerBare', 'L-ggmenu-gmCompareNative', 'L-ggmenu-gmTotalNative'}
NEW_GRP = {'L-%s-%s' % (s, c) for s in ('mauto', 'mauto2', 'ggmenu', 'gglist') for c in CHK[s]} - GRP_GUARDS | {'S-helpGroups'}   # live 4662e17
# (2026-10-20, grpsweep) the final sweep: no auto List where List cannot be drawn (a narrow window), a radio
# picked in a cancelled dialog is not a later trigger's choice. (Text selected in a band was dropped: bands are
# user-select: none, so there is never any.)
NEW_SWEEP1 = {'L-mauto2-cancelledPick', 'L-mauto2-narrowStacked', 'S-helpGroupsSweep'}   # live fbf79b7
# (2026-10-20, grpsweep 2, after an independent review) Show only keeps every value of the group, an auto
# grouping clears a choice left behind, a layout set without a pick is a choice only when List, a stale Undo
# does nothing, a List row's notes select the group first, the keyboard's switch to Stacked keeps a focus
NEW_SWEEP2 = {'L-ggfmt-fmtOnlyAll', 'L-mautostale-staleChoice', 'L-mauto2-implicitStacked', 'L-ggmenu-gmUndoStale',
              'L-gglist-glNoteDrawn', 'L-gglist-glKbdStackFocus', 'S-helpOnlyValues'}   # live f4342ec
# (2026-10-20, notefit; user on jjornl) Fit on the Notes column measures the note's own box and the button's row:
# live measures the note as one line of text (grow / compact / spill far too wide or cut) and the button's icon,
# count and note as lines of their own (short notes cut)
NEW_NOTEFIT = {'L-mfitnote-' + c for c in CHK['mfitnote']}   # live 96b8f66
# (2026-10-20, mutfix) nothing is staged: every round above is live, so --control holds live to every check
# (NEW = NEW_NOTEFIT left it red on exactly those 4 since their deploy). The next round names its own NEW.
NEW_SET_R33_BASE = set()
# (round 33) Column widths list (fit, Fit to page, resets) up the menu, row height on every column, the
# Reset list one Clear all customizations item; reshaped checks fail on live too
NEW = {'L-mopts-fitItem', 'L-mopts-resetItem', 'L-mopts-resets', 'L-mopts-fitPage', 'L-mopts-fitPageUndo', 'L-mmore-resetCol',
       'L-msubs-topOrder', 'L-msubs-arrows', 'L-msubs-resetList', 'L-msubs-clearPanel', 'L-mnum-numItems', 'L-mnum-numResets',
       'L-mflat-itemsAll', 'L-mnest-nestRowHeightPlain', 'S-helpSubs', 'S-helpResetAll', 'S-helpRowHeight', 'S-helpMore'}
# (2026-10-24, hlhead; round 33 is live) Highlight... in the header menu - hlNotNum / hlNotRestricted hold on live (guards)
NEW = {'L-mhl-%s' % c for c in CHK['mhl'] if c not in ('hlNotNum', 'hlNotRestricted')}
# (2026-10-25, nestgb; hlhead is LIVE since 75458b7: its mhl checks are old ones now) Group by on a nested-table column is a list
# of its tables' columns (live: the plain item, a grouping by the whole column); ngbPlain and ngbDigitSafe hold on live (guards)
NEW = {'L-mnestgb-%s' % c for c in CHK['mnestgb'] if c not in ('ngbPlain', 'ngbDigitSafe')} | {'L-ggnest-%s' % c for c in CHK['ggnest']} | {'S-helpNestGroup'}
NEW = set()   # (nestgb is LIVE since 3c820e7, 2026-10-25: its checks are old ones now; the next round names its own NEW)
# (2026-10-25, nestgb2) the group band menu's lists and the status bar's grouping chip name no nested-table column and list its
# tables' columns at the top level (live: the column itself, no sub-column); nbInnerNone, nbHiddenNot and ncPlain hold on live (guards)
NEW = {'L-gnnestbd-%s' % c for c in CHK['gnnestbd'] if c not in ('nbInnerNone', 'nbHiddenNot')} | {'L-gchipnest-%s' % c for c in CHK['gchipnest'] if c != 'ncPlain'} | {'S-helpNestBand'}
NEW = set()   # (nestgb2 is LIVE since 3249bc4, 2026-10-25: its checks are old ones now)
# (2026-10-25, nestcopy) a nested-table column's Nested columns section (Group by and Copy distinct values per column of its tables):
# mnestgb / ggnest reshaped (live has nestgb's flyout); nsPlain and nsDigitSafe hold on live (guards). nestgb2's set above stays.
NEW = NEW | {'L-mnestgb-%s' % c for c in CHK['mnestgb'] if c not in ('nsPlain', 'nsDigitSafe')} | {'L-ggnest-%s' % c for c in CHK['ggnest']} | {'S-helpNestGroup'}
NEW = NEW - ({'L-mnestgb-%s' % c for c in CHK['mnestgb']} | {'L-ggnest-%s' % c for c in CHK['ggnest']} | {'S-helpNestGroup'})   # (nestcopy is LIVE since 934d195, 2026-10-25: old checks now; nestgb2's set above stays)
# (2026-10-25, neststats) Column stats per column of a nested-table column's tables: nsStats / nsStatsFilter new, nsColList /
# nsNone / nsClipOff reshaped (the list gains Column stats; the greyed line's reason; the stats stay where Clipboard is hidden)
NEW = NEW | {'L-mnestgb-%s' % c for c in ('nsColList', 'nsNone', 'nsClipOff', 'nsStats', 'nsStatsFilter', 'nsStatsTables')} | {'L-ggnest-gnStatsGrouped', 'S-helpNestStats'}
NEW = NEW - ({'L-mnestgb-%s' % c for c in ('nsColList', 'nsNone', 'nsClipOff', 'nsStats', 'nsStatsFilter', 'nsStatsTables')} | {'L-ggnest-gnStatsGrouped', 'S-helpNestStats'})   # (neststats is LIVE since 9e27a25, 2026-10-26: old checks now)
NEW = NEW - {'L-mnestgb-nsListThrows'}   # (2026-10-25, digitcol) a guard: the picker's list throwing (a stub) - holds on live
# (2026-10-26, cstat) Column stats in the grouped view count the rows a search typed there keeps, each row once (live: every
# row - it reads the flat table, which that search never marks); csAll and csBefore hold on live (guards)
NEW = NEW | {'L-ggstat-%s' % c for c in CHK['ggstat'] if c not in ('csAll', 'csBefore')}
NEW = NEW - {'L-ggstat-%s' % c for c in CHK['ggstat']}   # (cstat is LIVE since 12bbda7, 2026-10-26: old checks now)
# (2026-10-27, copymenu) the menu's copies as ONE list, Copy: the new scenarios (cmValue, cmName, cmNumHead and cmStaleSql hold
# on live: guards) and the checks of the old top level that change shape with it (the Copy list where its items were)
COPYM_GUARDS = {'L-mcopym-cmValue', 'L-mcopym-cmName', 'L-mcopym-cmNumHead'}
NEW_COPYM = ({'L-%s-%s' % (s, c) for s in ('mcopym', 'ggcopym') for c in CHK[s]} - COPYM_GUARDS) | {
    'L-mflat-itemsAll', 'L-mcopy-copyItem', 'L-mcell-cellOpens', 'L-mnest-nestSubOpens', 'L-mnest-nestPadOpens', 'L-msubs-topOrder',
    'L-msubs-arrows', 'L-msubs-showLabel', 'L-mnestgb-nsPlain', 'S-helpCopyMenu'}
NEW = NEW | NEW_COPYM
NEW = NEW - NEW_COPYM   # (copymenu is LIVE since a8aabf9, 2026-10-27: old checks now)
# (2026-10-27, copymenu 2; the user: "remove the SQL copy options in the right click menu and replace with 'Link to this view',
# with the tooltip explaining") no For SQL in any list (cmDistinct, cmNestNoSql: live a8aabf9 has it), Link to this view where
# the page can make a view link (cmViewLink); cmViewLinkNone holds on live (a guard); the help's rows reshaped, and the
# view link topic names the right-click route (S-helpVlMenu)
NEW_COPYM2 = {'L-mcopym-cmDistinct', 'L-mcopym-cmNestNoSql', 'L-mcopym-cmViewLink', 'S-helpCopyMenu', 'S-helpVlMenu'}
NEW = NEW | NEW_COPYM2
MUTANTS = {
    # --- (2026-10-27, copymenu) the Copy list: a cell's never placed (it lands at the heading's spot); always a list, an item
    # alone too; the first copy alone in its place; no This row; a hidden column, '#' copied; lines not indented; a nested table
    # as its text; a toggle as 1 / 0; a heading's list at the foot of the column's tools
    'cm-noslot': ([('menu', "            cellCps.push(rowCopyItem('copyRow', function () { return gridRowLines(th, cell.td); }));\n            items.push(copySlot);\n",
                   "            cellCps.push(rowCopyItem('copyRow', function () { return gridRowLines(th, cell.td); }));\n")], ['L-mcopym-cmCell', 'L-mcopym-cmClipOff'], ['mcopym']),
    'cm-noone': ([('menu', "        if (list.length === 1) { return shortCopy(list[0], list[0].long || list[0].label); }", "        if (false) { return shortCopy(list[0], list[0].long || list[0].label); }")],
                 ['L-mcopym-cmClipOff', 'L-mcopym-cmNumRow', 'L-mnestgb-nsSection'], ['mcopym', 'mnestgb']),
    'cm-first': ([('menu', "        if (list.length === 1) { return shortCopy(list[0], list[0].long || list[0].label); }", "        if (true) { return shortCopy(list[0], list[0].long || list[0].label); }")],
                 ['L-mcopym-cmCell', 'L-mcopym-cmList', 'L-mcopym-cmHead', 'L-ggcopym-gcList'], ['mcopym', 'ggcopym']),
    'cm-norow': ([('menu', "            cellCps.push(rowCopyItem('copyRow', function () { return gridRowLines(th, cell.td); }));\n            items.push(copySlot);\n", "            items.push(copySlot);\n")],
                 ['L-mcopym-cmList', 'L-mcopym-cmRow', 'L-mcopym-cmNumRow', 'L-ggcopym-gcList', 'L-ggcopym-gcRow'], ['mcopym', 'ggcopym']),
    'cm-hidden': ([('menu', "            if (name === null || name === '#' || !shown(h) || !c) { return; }", "            if (name === null || name === '#' || !c) { return; }")], ['L-mcopym-cmRowLayout'], ['mcopym']),
    'cm-rownum': ([('menu', "            if (name === null || name === '#' || !shown(h) || !c) { return; }", "            if (name === null || !shown(h) || !c) { return; }")],
                  ['L-mcopym-cmRow', 'L-mcopym-cmNumRow', 'L-ggcopym-gcRow'], ['mcopym', 'ggcopym']),
    'cm-indent': ([('menu', "        out.push(label + ': ' + String(v).replace(/\\r?\\n/g, '\\n  '));", "        out.push(label + ': ' + String(v));")], ['L-mcopym-cmRowLines'], ['mcopym']),
    'cm-nesttext': ([('menu', "        return box ? nestedRows(box) : cellText(c);", "        return cellText(c);")], ['L-mcopym-cmNestRow'], ['mcopym']),
    'cm-toggle': ([('menu', "            if (jv === '1' || jv === '0') { return jv === '1' ? 'Yes' : 'No'; }", "            if (jv === '1' || jv === '0') { return jv; }")], ['L-mcopym-cmJournal'], ['mcopym']),
    'cm-headpos': ([('menu', "        else if (cpList.length) { use.unshift(copyEntry('copyMenu', cpList)); }", "        else if (cpList.length) { use.push(copyEntry('copyMenu', cpList)); }")], ['L-mcopym-cmHead'], ['mcopym']),
    # --- (copymenu 2) Link to this view: none; offered where the page cannot make one; no title; running nothing; no separator
    'cm-novl': ([('menu', "        if (vlOk && cpList.length) {", "        if (false) {")], ['L-mcopym-cmViewLink'], ['mcopym']),
    'cm-vlalways': ([('menu', "VL.available() === true; } catch (eVL) { vlOk = false; }", "true; } catch (eVL) { vlOk = false; }")], ['L-mcopym-cmViewLinkNone'], ['mcopym']),
    'cm-vltitle': ([('menu', "long: 'Copy a link to this view', title: VIEWLINK_TITLE, run:", "long: 'Copy a link to this view', run:")], ['L-mcopym-cmViewLink'], ['mcopym']),
    'cm-vlrun': ([('menu', "run: function () { VL.copy(); } });", "run: function () { } });")], ['L-mcopym-cmViewLink'], ['mcopym']),
    'cm-vlsep': ([('menu', "            cpList.push('-', { act: 'copyViewLink'", "            cpList.push({ act: 'copyViewLink'")], ['L-mcopym-cmViewLink'], ['mcopym']),
    # --- (copymenu 3) the Copy list without its heading; a heading's Copy back below, with Group by
    'cm-nohead': ([('menu', "items: function () { return [{ heading: 'Copy' }].concat(list); } };", "items: function () { return list; } };")], ['L-mcopym-cmHeadRow'], ['mcopym']),
    'cm-headlow': ([('menu', "        if (items.indexOf(copySlot) < 0) { look.push(copySlot); }\n", "")], ['L-mcopym-cmHeadPlace', 'L-mcopym-cmHeadNoFilter'], ['mcopym']),
    'cm-headalign': ([('menu', "        if (hd && fi && hd.classList.contains('pnb-hm-head') && fi.classList.contains('pnb-hm-item')) {", "        if (false) {")], ['L-mcopym-cmHeadAlign'], ['mcopym']),
    # the keyboard: ArrowRight opens no list (the Copy list's from a cell)
    'cm-kbd': ([('menu', "        else if (k === 'ArrowRight' && opens) { activate(it[i]); }\n", "")], ['L-mcopym-cmKbd'], ['mcopym']),
    # --- (2026-10-26, cstat) the grouped view's rows: the flat table's alone (live's reading); every copy of a row; the first copy
    # though a later one is kept; the last copy though hidden; one reader on the flat rows (a journal column's counts; every other one's)
    'cs-flat': ([('main', "        if (!$('#groupedResultsContainer').is(':visible')) return document.querySelectorAll('#resultsTable > tbody > tr');",
                  "        if (true) return document.querySelectorAll('#resultsTable > tbody > tr');")],
                ['L-ggstat-csCount', 'L-ggstat-csNum', 'L-ggstat-csJournal', 'L-ggstat-csOnce', 'L-ggstat-csShownCopy'], ['ggstat']),
    'cs-copies': ([('main', "        return Array.from(byIdx.values());", "        return Array.prototype.slice.call(all);")], ['L-ggstat-csOnce'], ['ggstat']),
    'cs-firstcopy': ([('main', "            if (!had || (had.classList.contains('search-hidden') && !all[i].classList.contains('search-hidden'))) byIdx.set(idx, all[i]);",
                       "            if (!had) byIdx.set(idx, all[i]);")], ['L-ggstat-csShownCopy'], ['ggstat']),
    'cs-lastcopy': ([('main', "            if (!had || (had.classList.contains('search-hidden') && !all[i].classList.contains('search-hidden'))) byIdx.set(idx, all[i]);",
                      "            byIdx.set(idx, all[i]);")], ['L-ggstat-csShownCopy'], ['ggstat']),
    'cs-jrnflat': ([('main', "        var rows = _pnbColStatsRows(), seen = new Set(), n = 0, empty = 0, on = 0, notes = 0, kind = '';",
                     "        var rows = document.querySelectorAll('#resultsTable > tbody > tr'), seen = new Set(), n = 0, empty = 0, on = 0, notes = 0, kind = '';")],
                   ['L-ggstat-csJournal'], ['ggstat']),
    'cs-profflat': ([('main', "        var rows = _pnbColStatsRows(), freq = new Map(), n = 0, empty = 0, nested = 0, subRows = 0;",
                      "        var rows = document.querySelectorAll('#resultsTable > tbody > tr'), freq = new Map(), n = 0, empty = 0, nested = 0, subRows = 0;")],
                    ['L-ggstat-csCount', 'L-ggstat-csNum', 'L-ggstat-csOnce', 'L-ggstat-csShownCopy'], ['ggstat']),
    # --- (2026-10-25, nestgb2) the band menu's lists: no nested tables' columns; the nested-table column listed too; its tables'
    # columns at every level; a name two tables share twice; Other column... promising nested fields at every level; a hidden
    # column's tables read; a pick that adds a level instead of regrouping this one
    'nb-nonest': ([('menu', "        if (nest.length) {\n            if (items.length) { items.push('-'); }\n", "        if (false) {\n            if (items.length) { items.push('-'); }\n")],
                  ['L-gnnestbd-nbTopList', 'L-gnnestbd-nbDedupe', 'L-gnnestbd-nbPick', 'L-gnnestbd-nbPickTick', 'L-gnnestbd-nbUndo', 'L-gnnestbd-nbKbd'], ['gnnestbd']),
    'nb-parent': ([('menu', "                    nest.push(gmColumnItem(info, mode, subs[j], subs[j]));\n                }\n                continue;\n",
                    "                    nest.push(gmColumnItem(info, mode, subs[j], subs[j]));\n                }\n")], ['L-gnnestbd-nbNoParent'], ['gnnestbd']),
    'nb-deep': ([('menu', "                for (var j = 0; outer && j < subs.length; j++) {", "                for (var j = 0; j < subs.length; j++) {")], ['L-gnnestbd-nbInnerNone'], ['gnnestbd']),
    'nb-dedupe': ([('menu', "                    if (nestSeen[k] || used.indexOf(k) >= 0) { continue; }", "                    if (used.indexOf(k) >= 0) { continue; }")],
                  ['L-gnnestbd-nbDedupe', 'L-gnnestbd-nbTopList'], ['gnnestbd']),
    'nb-title': ([('menu', "'Configure grouping: hidden columns, date and number ranges' + (outer ? ', nested fields' : '')", "'Configure grouping: hidden columns, date and number ranges, nested fields'")],
                 ['L-gnnestbd-nbOtherTitle'], ['gnnestbd']),
    'nb-hidden': ([('menu', "subs = (nf && shown(t)) ? nf(c) : null;", "subs = nf ? nf(c) : null;")], ['L-gnnestbd-nbHiddenNot', 'L-gnnestbd-nbHiddenList'], ['gnnestbd']),
    'nb-regroup': ([('menu', "            l[d] = c;\n", "            l.splice(d + 1, 0, c);\n")], ['L-gnnestbd-nbPick'], ['gnnestbd']),
    # --- (2026-10-25, nestgb2) the chip: the nested-table column's button back; no nested tables' columns; a shared name twice;
    # no heading over them; their buttons grouping by the nested-table column
    'nc-parent': ([('main', "                    });\n                    return;\n                }\n                var label = $(this).clone()", "                    });\n                }\n                var label = $(this).clone()")],
                  ['L-gchipnest-ncNoParent'], ['gchipnest']),
    'nc-nonest': ([('main', "            if (nest.length) cols = cols.concat([{ head: 'Nested table columns' }], nest);", "            if (false) cols = cols.concat([{ head: 'Nested table columns' }], nest);")],
                  ['L-gchipnest-ncNestList', 'L-gchipnest-ncPick', 'L-gchipnest-ncActive'], ['gchipnest']),
    'nc-dedupe': ([('main', "if (!nestSeen[k]) { nestSeen[k] = true; nest.push(", "if (true) { nestSeen[k] = true; nest.push(")], ['L-gchipnest-ncNestList'], ['gchipnest']),
    'nc-head': ([('main', "                if (c.head) { $('<div class=\"sb-pop-h\"></div>').toggleClass('sb-mt', cols[0] !== c).text(c.head).appendTo($list); return; }",
                  "                if (c.head) { return; }")], ['L-gchipnest-ncNestList'], ['gchipnest']),
    'nc-token': ([('main', "nest.push({ colname: String(s), label: String(s) });", "nest.push({ colname: String(colname), label: String(s) });")], ['L-gchipnest-ncPick'], ['gchipnest']),
    # --- (2026-10-25, nestcopy) the Nested columns section: none drawn; the whole column's Copy distinct values kept; its plain Group
    # by kept; the column's own list without its name on top; no greyed line where nothing is listed; no tick; no "instead"; a
    # Group by that groups by nothing; one only from the flat table; the ticked one regrouping when picked again; Copy's option
    # without its nested data (the copy reads the plain column); Other... not choosing it. (v2, the review) the names read by
    # drawing every lazy cell (Copy's own plan); no screen reader name; group mode's case on Group by; no section where neither
    # engine names a column; Copy distinct values where the report hides Clipboard (the nested ones; a plain column's; the copy
    # itself); a tall menu not scrolled to the keyboard's item
    'ns-nosection': ([('menu', "        if (nsec) { items.push('-'); items = items.concat(nsec); }   // (2026-10-25, nestcopy) the Nested columns section\n", "")],
                     ['L-mnestgb-nsSection', 'L-mnestgb-nsNone'], ['mnestgb']),
    'ns-keepcopy': ([('menu', "        if (clipOff || canCopyN) { use = use.filter(function (u) { return u.act !== 'copy'; }); }\n", "")],
                    ['L-mnestgb-nsSection', 'L-mnestgb-nsNone', 'L-mnestgb-nsNoRaw', 'L-mnestgb-nsClipOff'], ['mnestgb']),
    'ns-plaingb': ([('menu', "        if (nsub) { canGroup = false; }\n", "")], ['L-mnestgb-nsSection'], ['mnestgb']),
    'ns-heading': ([('menu', "        var A = api(), items = [{ heading: label }];", "        var A = api(), items = [];")], ['L-mnestgb-nsColList', 'L-mnestgb-nsCase'], ['mnestgb']),
    'ns-none': ([('menu', "            out.push({ act: 'nestnone',", "            if (false) out.push({ act: 'nestnone',")], ['L-mnestgb-nsNone', 'L-mnestgb-nsNoRaw'], ['mnestgb']),
    'ns-tick': ([('menu', "checked: mine,\n                title: 'A row joins", "checked: false,\n                title: 'A row joins")], ['L-mnestgb-nsGroupedTick', 'L-ggnest-gnTick'], ['mnestgb', 'ggnest']),
    'ns-instead': ([('menu', "label: 'Group by ' + label + (grouped && !mine ? ' instead' : ''),", "label: 'Group by ' + label,")],
                   ['L-mnestgb-nsGroupedTick', 'L-ggnest-gnSection', 'L-ggnest-gnKbdOpens'], ['mnestgb', 'ggnest']),
    'ns-run': ([('menu', "                run: function () { if (!mine) { window.Penumbra.groupByColumn(e.g); } } });", "                run: function () { } });")],
               ['L-mnestgb-nsGroups'], ['mnestgb']),
    'ns-flatonly': ([('menu', "if (!mine) { window.Penumbra.groupByColumn(e.g); }", "if (!gcol) { window.Penumbra.groupByColumn(e.g); }")],
                    ['L-mnestgb-nsRegroup', 'L-ggnest-gnKbdPick'], ['mnestgb', 'ggnest']),
    'ns-again': ([('menu', "                run: function () { if (!mine) { window.Penumbra.groupByColumn(e.g); } } });", "                run: function () { window.Penumbra.groupByColumn(e.g); } });"),
                  ('main', "            if ($('body').hasClass('group-mode-active') && actualCol === String(currentGroupingColumn)) return;", "")],
                 ['L-ggnest-gnTickNoop'], ['ggnest']),
    'ns-copyplain': ([('main', "        var $opt = $('<option></option>').attr({ value: name, 'data-nested-parent': String(col), 'data-nested-sub': String(sub), 'data-nested-colid': th.getAttribute('data-column'), 'data-nested-mapkey': String(col).toUpperCase() }).text(name);",
                       "        var $opt = $('<option></option>').attr({ value: name }).text(name);")],
                     ['L-mnestgb-nsCopy', 'L-mnestgb-nsKbdCopy', 'L-ggnest-gnCopyGrouped'], ['mnestgb', 'ggnest']),
    'ns-other': ([('main', "            $('#copyColumnSelector').val(name);\n            setTimeout(function () { $('#copyDelimiterInput').focus().select(); }, 60);",
                   "            setTimeout(function () { $('#copyDelimiterInput').focus().select(); }, 60);")], ['L-mnestgb-nsCopyOther'], ['mnestgb']),
    'ns-draw': ([('main', "        var subs = _pnbNestCopyKeys(_pnbNestCopyRows(), String(col || '').toUpperCase());\n        return subs.length ? subs : null;\n",
                  "        var p = getNestedColumnPlan().filter(function (x) { return String(x.parentName) === String(col); })[0];\n        return p ? p.subNames : null;\n")],
                ['L-mnestgb-nsNoDraw'], ['mnestgb']),
    'ns-aria': ([('menu', "label: label, aria: 'Nested column ' + label, sub: true,", "label: label, sub: true,")], ['L-mnestgb-nsAria'], ['mnestgb']),
    'ns-case': ([('menu', "label: 'Group by ' + label + (grouped", "label: 'Group by ' + e.g + (grouped")], ['L-mnestgb-nsCase'], ['mnestgb']),
    'ns-raw': ([('menu', "csub = canCopyN ? (A.nestedCopyFields(col) || []) : null;", "csub = canCopyN ? A.nestedCopyFields(col) : null;")], ['L-mnestgb-nsNoRaw'], ['mnestgb']),
    'ns-clip': ([('menu', "        if (e.c && !clipOff) {", "        if (e.c) {")], ['L-mnestgb-nsClipOff'], ['mnestgb']),   # (re-anchored, neststats)
    # --- (2026-10-25, neststats) no Column stats in a column's list; the stats over every row (the filter's ignored); none where
    # Clipboard is hidden; the heading the column's own (the rows the filter keeps, not its tables')
    'ns-stats': ([('menu', "        if (typeof A.nestedValues === 'function') {\n            var statsMemo = null;", "        if (false) {\n            var statsMemo = null;")],
                 ['L-mnestgb-nsStats', 'L-mnestgb-nsColList'], ['mnestgb']),
    'ns-statsall': ([('main', "        var kept = _pnbHlRowsKept(), vals = [], tables = 0;", "        var kept = masterRowData.slice(), vals = [], tables = 0;")],
                    ['L-mnestgb-nsStatsFilter', 'L-ggnest-gnStatsGrouped'], ['mnestgb', 'ggnest']),   # (re-anchored, the review)
    # (the review) the flat rows alone (a search typed while grouped marks the grouped rows); the stale-main.js guard gone; a
    # value that is a table counted as a value
    'ns-statsflat': ([('main', "        var kept = _pnbHlRowsKept(), vals = [], tables = 0;",
                       "        var kept = Array.prototype.map.call(document.querySelectorAll('#resultsTable > tbody > tr:not(.search-hidden)'), function (tr) { return masterRowData[_pnbLazyRowIndex(tr)]; }).filter(Boolean), vals = [], tables = 0;")],
                     ['L-ggnest-gnStatsGrouped'], ['ggnest']),
    'ns-stale': ([('menu', "nested && (!clipOff || typeof A.nestedValues === 'function') && typeof", "nested && typeof")], ['L-mnestgb-nsStaleNoEmpty'], ['mnestgb']),
    'ns-statstables': ([('menu', "                    if (tabs) { list.splice(1, 0, { info: 'With a table', value: tabs.toLocaleString() }); }\n", "")], ['L-mnestgb-nsStatsTables'], ['mnestgb']),
    'ns-statsclip': ([('menu', "        if (typeof A.nestedValues === 'function') {\n            var statsMemo = null;", "        if (!clipOff && typeof A.nestedValues === 'function') {\n            var statsMemo = null;")],
                     ['L-mnestgb-nsClipOff'], ['mnestgb']),
    'ns-statshead': ([('menu', "                    list[0] = { heading: 'Over the ' + all", "                    if (false) list[0] = { heading: 'Over the ' + all")],
                     ['L-mnestgb-nsStats', 'L-mnestgb-nsStatsFilter'], ['mnestgb']),   # (re-anchored, the review)
    'ns-clipplain': ([('menu', "        if (clipOff || canCopyN) { use =", "        if (canCopyN) { use =")], ['L-mnestgb-nsClipOff'], ['mnestgb']),
    'ns-clipmain': ([('main', "        if (document.body.classList.contains('restrict-clipboard')) return false;\n        var subs = penumbraHeaderNestedCopyFields(col), th = null;\n",
                      "        var subs = penumbraHeaderNestedCopyFields(col), th = null;\n")], ['L-mnestgb-nsClipOff'], ['mnestgb']),
    'ns-scroll': ([('menu', "        else if (typeof it[i].scrollIntoView === 'function') { try { it[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (eS) { } }\n", "")],
                  ['L-mnestgb-nsKbdScroll'], ['mnestgb']),
    'ns-scrolltop': ([('menu', "        if (i === 0 && sc) { sc.scrollTop = 0; }\n        else if (typeof", "        if (typeof")], ['L-mnestgb-nsKbdScroll'], ['mnestgb']),
    # (v3, the second review) nested names read from a snapshot comparison's rows; the cell's lookup taking a nested table's
    # inner @@JSON copy (the first in document order)
    'ns-cmp': ([('main', " || document.body.classList.contains('snapshot-comparison-active')) return out;", ") return out;")], ['L-mnestgb-nsCmpNone'], ['mnestgb']),
    'ns-inner': ([('main', "        const div = _pnbOwnRawJson(cell);\n", "        const div = cell.querySelector('.raw-json-data');\n")], ['L-mnestgb-nsInnerOwn'], ['mnestgb']),
    # --- (2026-10-25, nestgb) main.js: every column taken for a nested table (a plain one loses its items); every nested table's
    # columns on each; sorted by name; the picker's five rows; its list throwing out of the menu; ArrowRight opening nothing
    # (the catch line goes along: "return any ? out : null;" is main.js's idiom, seven times over)
    'ng-allnested': ([('main', "the plain item, as before)\n        return any ? out : null;\n", "the plain item, as before)\n        return out;\n")], ['L-mnestgb-nsPlain'], ['mnestgb']),
    'ng-own': ([('main', "                getVirtualColumnsForRow(new Map([[C, v]])).forEach(function (vals, k) {", "                getVirtualColumnsForRow(r).forEach(function (vals, k) {")],
               ['L-mnestgb-nsSection'], ['mnestgb']),
    'ng-order': ([('main', "the plain item, as before)\n        return any ? out : null;\n", "the plain item, as before)\n        return any ? out.sort() : null;\n")], ['L-mnestgb-nsSection'], ['mnestgb']),
    'ng-five': ([('main', "            for (var i = 0; i < Math.min(masterRowData.length, 10); i++) {\n                var r = masterRowData[i], v =",
                  "            for (var i = 0; i < Math.min(masterRowData.length, 5); i++) {\n                var r = masterRowData[i], v =")],
                ['L-mnestgb-nsOwnOnly'], ['mnestgb']),
    'ng-nocatch': ([('main', "        } catch (e) { return null; }   // (the picker's own list throws while a column is named in digits: the plain item, as before)\n",
                     "        } catch (e) { throw e; }\n")],
                   ['L-mnestgb-nsListThrows'], ['mnestgb']),   # (2026-10-25, digitcol) a stubbed throw: a column named in digits throws no more
    'ng-kbd': ([('menu', "        else if (k === 'ArrowRight' && opens) { activate(it[i]); }\n", "")],
               ['L-mnestgb-nsKbdOpens', 'L-mnestgb-nsKbdPick', 'L-mnestgb-nsKbdCopy', 'L-ggnest-gnKbdOpens', 'L-gnnestbd-nbKbd'], ['mnestgb', 'ggnest', 'gnnestbd']),
    # --- (2026-10-24, hlhead) Highlight...: no item; the column's whole options instead of its rules alone
    'mh-noitem': ([('menu', "            arrange.push({ act: 'highlight', label: 'Highlight...',", "            if (false) arrange.push({ act: 'highlight', label: 'Highlight...',")], ['L-mhl-hlItem'], ['mhl']),
    'mh-full': ([('main', "            _pnbOpenColOpts(th, !!kbd, { col: col, title: title, back: back, only: 'highlight' });", "            _pnbOpenColOpts(th, !!kbd, { col: col, title: title, back: back });")],
                ['L-mhl-hlAlone'], ['mhl']),
    # (the reviews) from the keyboard, the rules alone: the shared pick - no focus with no rule, Reset with one (Enter there
    # took every rule off); after Reset, the focus nowhere in the popover
    'mh-nofocus': ([('mod', "            if (hlOnly) first = q('[data-sec=\"highlight\"] button:not([disabled])');\n            if (first) { try { first.focus({ preventScroll: true }); } catch (x) { } }\n",
                            "            if (first) { try { first.focus({ preventScroll: true }); } catch (x) { } }\n")],
                   ['L-mhl-hlKbdFocus', 'L-mhl-hlKbdNotReset'], ['mhl']),
    'mh-resetfocus': ([('mod', "            if (hlOnly) first = q('[data-sec=\"highlight\"] button:not([disabled])');   // (2026-10-24) the rules alone: their first button\n", "")],
                      ['L-mhl-hlResetFocus'], ['mhl']),
    # --- (2026-10-20, notefit) the width module: a box's own width / max-width, a flex row's items side by side
    'j-notewidth': ([('colw', "            if (v && v.unit === 'px') { w = bb ? Math.max(v.value, e) : v.value + e; need = held ? w : Math.max(w, need); }\n", "")],
                    ['L-mfitnote-noteGrow'], ['mfitnote']),
    'j-notemax': ([('colw', "        if (held && LEN.test(st.maxWidth)) { w = px(st.maxWidth); need = Math.min(need, bb ? Math.max(w, e) : w + e); }\n", "")],
                  ['L-mfitnote-noteCompact'], ['mfitnote']),
    'j-noterow': ([('colw', "        var row = /flex$/.test(es.display) && !/column/.test(es.flexDirection), items = 0;", "        var row = false, items = 0;")],
                  ['L-mfitnote-noteShort', 'L-mfitnote-noteGrow'], ['mfitnote']),
    'j-noteheld': ([('colw', "        var held = !/^(nowrap|pre)$/.test(st.whiteSpace) || st.overflowX !== 'visible';", "        var held = true;")],
                   ['L-mfitnote-noteSpill'], ['mfitnote']),
    'j-noteown': ([('colw', "        if (/^table/.test(st.display)) { return need; }", "        return need;")],
                  ['L-mfitnote-noteGrow', 'L-mfitnote-noteCompact'], ['mfitnote']),
    # --- (2026-10-20, grpauto) main.js: the layout from the group count
    'm-autocount': ([('main', "        var want = (n > PENUMBRA_GROUP_AUTO_STACKED_MAX && canList) ? 'list' : 'stacked';", "        var want = (n >= PENUMBRA_GROUP_AUTO_STACKED_MAX && canList) ? 'list' : 'stacked';")], ['L-mauto-boundary8'], ['mauto']),
    # (sweep) List where it cannot be drawn: a narrow window keeps the count's List nobody sees
    'm-canlist': ([('main', "        var want = (n > PENUMBRA_GROUP_AUTO_STACKED_MAX && canList) ? 'list' : 'stacked';", "        var want = (n > PENUMBRA_GROUP_AUTO_STACKED_MAX) ? 'list' : 'stacked';")], ['L-mauto2-narrowStacked'], ['mauto2']),
    'm-autooff': ([('main', "        if (!n) return;\n        var canList", "        return;\n        var canList")], ['L-mauto-autoMany', 'L-mauto-boundary9'], ['mauto']),   # (re-anchored, sweep 2)
    # the count decided again by every grouped search: the narrowed filter flips List back to Stacked
    'm-autosearch': ([('main', "                _groupLayoutNotify('groupedSearched');   // the List layout follows the search (2026-10-03, grplist)\n",
                       "                _groupLayoutNotify('groupedSearched');   // the List layout follows the search (2026-10-03, grplist)\n                _groupApplyAutoLayout();\n")],
                     ['L-mauto-filterNoFlip'], ['mauto']),
    'm-chosenon': ([('main', "                !(_groupLayoutChosen && $('body').hasClass('group-mode-active')), true);", "                true, true);")], ['L-mauto-chosenSticks'], ['mauto']),
    'm-chosenoff': ([('main', "                !(_groupLayoutChosen && $('body').hasClass('group-mode-active')), true);", "                false, true);")], ['L-mauto-autoMany', 'L-mauto-redecides'], ['mauto']),
    'm-ungroupkeep': ([('main', "        _groupLayoutChosen = false;   // (grpauto) the next grouping starts unchosen\n        currentGroupLimit = null;\n        $('body').removeClass('group-mode-active');\n        // applyPagination()",
                        "        currentGroupLimit = null;\n        $('body').removeClass('group-mode-active');\n        // applyPagination()")], ['L-mauto-ungroupResets'], ['mauto']),
    'm-samecol': ([('main', "            if ($('body').hasClass('group-mode-active') && actualCol === String(currentGroupingColumn)) return;", "            if (actualCol === String(currentGroupingColumn)) return;")], ['L-mauto-sameAgain'], ['mauto']),
    'm-staleform': ([('main', "                limit: currentGroupLimit || null,\n",
                      "                limit: _groupNormalizeLimit({ n: $('#groupLimitN').val(), dir: $('#groupLimitDir').val(), other: $('#groupLimitOther').is(':checked'), minRows: $('#groupLimitMinRows').val() }),\n")],
                    ['L-mauto-staleForm'], ['mauto']),
    'm-gmchosen': ([('main', "            layout = (layout === 'list') ? 'list' : 'stacked';\n            _groupLayoutChosen = true;\n", "            layout = (layout === 'list') ? 'list' : 'stacked';\n")], ['L-mauto-chosenSticks'], ['mauto']),
    # (re-anchored, sweep 2) every dialog Apply chooses
    'm-dialogchooses': ([('main', "        else if (_groupLayoutPicked) _groupLayoutChosen = true;\n        else if (currentGroupLayout !== _layoutWas) _groupLayoutChosen = (currentGroupLayout === 'list');\n",
                          "        else _groupLayoutChosen = true;\n")], ['L-mauto2-dialogKeepsAuto'], ['mauto2']),
    # --- (2026-10-20, grpsweep 2)
    'm-autoreset': ([('main', "        if (_auto) _groupLayoutChosen = false;\n", "        if (_auto) { }\n")], ['L-mautostale-staleChoice'], ['mautostale']),
    'm-implicit': ([('main', "            _groupLayoutChosen = _groupLayoutPicked || currentGroupLayout === 'list'; _groupLayoutPicked = false;", "            _groupLayoutChosen = true; _groupLayoutPicked = false;")],
                   ['L-mauto2-implicitStacked'], ['mauto2']),
    'm-onlyfirst': ([('main', "            for (var i = 0; i < trs.length; i++) {\n                var idx = _pnbLazyRowIndex(trs[i]), m = (idx >= 0 && masterRowData) ? masterRowData[idx] : null;",
                      "            for (var i = 0; i < trs.length && i < 1; i++) {\n                var idx = _pnbLazyRowIndex(trs[i]), m = (idx >= 0 && masterRowData) ? masterRowData[idx] : null;")],
                    ['L-ggfmt-fmtOnlyAll'], ['ggfmt']),
    'm-undostale': ([('main', "                if (!_gmLive() || _gmLevels().join(',') !== made) return;\n", "")], ['L-ggmenu-gmUndoStale'], ['ggmenu']),
    'j-gmnotesel': ([('menu', "                    if (listOn() && L && typeof L.selectGroup === 'function') { L.selectGroup(w); }\n", "")], ['L-gglist-glNoteDrawn'], ['gglist']),
    'j-gmkbdfocus': ([('menu', "                    if (nm) { try { nm.focus({ preventScroll: true }); } catch (e) { nm.focus(); } }\n", "")], ['L-gglist-glKbdStackFocus'], ['gglist']),
    'm-radiopick': ([('main', "        if (this.checked) _groupLayoutPicked = true;   // (grpauto) a person's pick: the layout becomes theirs at Apply\n", "")], ['L-mauto2-radioPickSticks'], ['mauto2']),
    'm-trigpick': ([('main', "                                _groupLayoutPicked = !!_gbOpts.layout;\n", "                                _groupLayoutPicked = false;\n")], ['L-mauto2-triggerNamedSticks'], ['mauto2']),
    'm-trigauto': ([('main', "                                _groupLayoutPicked = !!_gbOpts.layout;\n",
                     "                                _groupLayoutPicked = !!_gbOpts.layout;\n                                _pnbGroupAutoNext = !_gbOpts.layout;\n")], ['L-mauto2-triggerBare'], ['mauto2']),
    # (sweep) the round-1 line: a bare trigger left a cancelled dialog's radio pick standing
    'm-trigstale': ([('main', "                                _groupLayoutPicked = !!_gbOpts.layout;\n", "                                if (_gbOpts.layout) _groupLayoutPicked = true;\n")], ['L-mauto2-cancelledPick'], ['mauto2']),
    # --- (2026-10-20, grpmenu) main.js: what the group menu runs
    'm-barlast': ([('main', "            sorted.forEach(function (el) { $c[0].insertBefore(el, after); });", "            sorted.forEach(function (el) { $c.append(el); });")], ['L-ggmenu-gmBarLast'], ['ggmenu']),
    'm-otherlast': ([('main', "                return (oa !== ob) ? (oa ? 1 : -1) : cmp(a, b);", "                return cmp(a, b);")], ['L-ggmenu-gmOtherLast'], ['ggmenu']),
    'm-onlyadds': ([('main', "            p.cols.forEach(function (c, k) { st.sel[c] = p.vals[k]; });", "            p.cols.forEach(function (c, k) { st.sel[c] = (st.sel[c] || []).concat(p.vals[k]); });")], ['L-ggmenu-gmOnlyReplaces'], ['ggmenu']),   # (re-anchored, sweep 2)
    'm-gmask': ([('main', "            if (outer !== String(before.levels[0]) && outer.indexOf(':') === -1 && _pnbGroupAllUnique(outer)", "            if (false && outer !== String(before.levels[0]) && outer.indexOf(':') === -1 && _pnbGroupAllUnique(outer)"),
                 ('main', "            _gmApply($.extend({}, before, { levels: levels }), !_groupLayoutChosen, false);", "            _gmApply($.extend({}, before, { levels: levels }), !_groupLayoutChosen, true);")], ['L-ggmenu-gmUniqueNo'], ['ggmenu']),
    'm-gmrestrict': ([('main', "                restricted: $('body').hasClass('restrict-grouping')\n", "                restricted: false\n")], ['L-ggmenu-gmRestricted'], ['ggmenu']),
    'm-gmreveal': ([('main', "                else _gmReveal(w);", "                else { }")], ['L-gglist-glToStacked'], ['gglist']),
    'm-gmselect': ([('main', "                if (layout === 'list') { if (GL && typeof GL.selectGroup === 'function') GL.selectGroup(w); }", "                if (layout === 'list') { }")], ['L-gglist-glSwitch'], ['gglist']),
    'm-gmtoggle': ([('main', "                $(w).children('.group-header').trigger('click');\n                return true;", "                return true;")], ['L-ggmenu-gmToggle'], ['ggmenu']),
    # the band's LABEL in place of the row's value: [Blank] would filter to a literal "[Blank]" no row holds
    'm-onlylabel': ([('main', "                    var v = _pnbFsCellText(m.get(cols[k]));",
                      "                    var v = path[k].getAttribute('data-group-key');")], ['L-ggmenu-gmOnlyBlank'], ['ggmenu']),   # (re-anchored, sweep 2)
    'm-gmsort': ([('main', "                currentGroupSort = { key: key, dir: dir };\n                _sbSortGroups(key, dir);\n                return true;", "                currentGroupSort = { key: key, dir: dir };\n                return true;")], ['L-ggmenu-gmSort'], ['ggmenu']),
    # --- (2026-10-20, grpmenu) the module
    'j-gmband': ([('menu', "        var gb = bandOf(e.target);\n", "        var gb = null;\n")], ['L-ggmenu-gmOpens'], ['ggmenu']),
    'j-gmrow': ([('menu', "            var row = target.closest('.pnb-gl-item') || (target === list", "            var row = null || (target === list")], ['L-gglist-glRowOpens'], ['gglist']),
    'j-gmkbdlist': ([('menu', "(target === list ? list.querySelector('.pnb-gl-item.is-active') : null)", "(null)")], ['L-gglist-glKbd'], ['gglist']),
    'j-gmtoggle': ([('menu', "        if (!lo) { items.push({ act: 'gToggle'", "        if (true) { items.push({ act: 'gToggle'")], ['L-gglist-glRowItems'], ['gglist']),
    'j-gmrestricted': ([('menu', "        if (!info.restricted && A) {", "        if (A) {")], ['L-ggmenu-gmRestricted'], ['ggmenu']),
    'j-hdrrestrict': ([('menu', "        if (grpRestricted()) { gi = []; }\n", "")], ['L-ggmenu-gmHdrRestricted'], ['ggmenu']),
    'j-gmused': ([('menu', "if (!shown(t) || c === '#' || isJournal(c) || used.indexOf(String(c).toUpperCase()) >= 0) { continue; }", "if (!shown(t) || c === '#' || isJournal(c)) { continue; }")], ['L-ggmenu-gmAddUsed'], ['ggmenu']),
    'j-gmtick': ([('menu', "        return { act: 'gby:' + c, label: nm, checked: mine,", "        return { act: 'gby:' + c, label: nm, checked: false,")], ['L-ggmenu-gmTick', 'L-gnnestbd-nbPickTick'], ['ggmenu', 'gnnestbd']),
    'j-gmlevel': ([('menu', "colLabel(info.col) + (info.levels.length > 1 ? ', level ' + (info.depth + 1) + ' of ' + info.levels.length : '')", "colLabel(info.col)")], ['L-ggmenu-gmLevelMenu'], ['ggmenu']),
    'j-gmtip': ([('menu', "            if (!d || d.layout !== 'list' || gmTipSeen()) { return; }", "            if (!d || d.layout !== 'list') { return; }"),
                 ('menu', "                    if (!listOn() || gmTipSeen()) { return; }", "                    if (!listOn()) { return; }")], ['L-mauto-tipOnce'], ['mauto']),
    'j-gmspot': ([('menu', "    function spotOf(target) { return (target && target.closest) ? (target.closest('th, td, .group-header, .pnb-gl-item') || target) : target; }",
                   "    function spotOf(target) { return (target && target.closest) ? (target.closest('th, td') || target) : target; }")], ['L-ggmenu-gmNativeSecond'], ['ggmenu']),
    'j-gmfocus': ([('menu', "            var t = (c.focusEl && document.contains(c.focusEl)) ? c.focusEl\n", "            var t = (false) ? c.focusEl\n")], ['L-ggmenu-gmKbdBack', 'L-gglist-glKbdBack'], ['ggmenu', 'gglist']),
    'c-gmmark': ([('mcss', "#groupedResultsContainer .group-header.pnb-hm-for,\n", "")], ['L-ggmenu-gmMarked'], ['ggmenu']),
    'j-gmundo': ([('menu', "        if (undo) { toast('<p>' + msg + offerUndo(undo) + '</p>', UNDO_MS); }", "        if (undo) { toast('<p>' + msg + offerUndo(function () { }) + '</p>', UNDO_MS); }")], ['L-ggmenu-gmUndo', 'L-ggmenu-gmRemoveUndo', 'L-gnnestbd-nbUndo'], ['ggmenu', 'gnnestbd']),
    'j-gmkbd': ([('menu', "        if (kbd) { var r = b.el.getBoundingClientRect(); x = r.left; y = r.bottom; }", "        if (kbd) { var r = b.el.getBoundingClientRect(); x = r.left; y = r.top - 400; }")], ['L-ggmenu-gmKbd'], ['ggmenu']),
    'j-gmnotip': ([('menu', "            if (!d || d.layout !== 'list' || gmTipSeen()) { return; }", "            return;")], ['L-mauto-tipShown'], ['mauto']),
    'j-gmclick': ([('menu', "    function clickId(id) { var b = document.getElementById(id); if (b) { b.click(); } }", "    function clickId(id) { }")], ['L-ggmenu-gmCollapseAll', 'L-ggmenu-gmConfigure'], ['ggmenu']),
    # (2026-10-19, calcadj round 8) main.js: the all-different question left behind by a pick the dialog could not
    # select; the menu: Group by on a journal column
    'm-askstale': ([('main', "        var _askNext = _pnbGroupAskNext; _pnbGroupAskNext = false;   // (round 8) taken here, before any early return\r\n", "        var _askNext = _pnbGroupAskNext;\r\n"),
                    ('main', "        var _askUnique = !_pnbPrepared && (!!e.originalEvent || _askNext);\r\n", "        var _askUnique = !_pnbPrepared && (!!e.originalEvent || _askNext);\r\n        _pnbGroupAskNext = false;\r\n")],
                   ['L-mgroupby-stalePickQuiet'], ['mgroupby']),
    'n-journalgroup': ([('menu', "canGroup = !isNum && !isJournal(col) && typeof", "canGroup = !isNum && typeof")], ['L-mjournal-jrnNoGroup'], ['mjournal']),
    # (2026-10-19, grpunique) main.js (CRLF): the all-different column no longer asks
    'm-grpunique': ([('main', "            if (!window.confirm('Every row has a different ' + selectedColumn + ', so grouping by it makes one group per row and summarises nothing.\\n\\nGroup by it anyway?')) return;\r\n", "")],
                    ['L-mgroupby-uniqueAsks'], ['mgroupby']),
    # --- the module
    'j-menu': ([('menu', "        if (!th || !api()) { footNote = false; return; }\n        e.preventDefault();", "        if (!th || !api() || true) { footNote = false; return; }\n        e.preventDefault();")],
               ['L-mflat-opens', 'L-mflat-prevented'], ['mflat']),   # (re-anchored 2026-10-20: round 25's early return clears footNote)
    'j-skiphidden': ([('menu', "            for (j = i - 1; j >= 0; j--) { if (movable(cols[j])) { return j; } }", "            if (i > 0) { return i - 1; }")],
                     ['L-mflat-skipHidden'], ['mflat']),
    'j-tiponce': ([('menu', "        if (isMove && moves > 2 && !tipSeen()) {\n            markTipSeen();", "        if (isMove && moves > 2) {")],
                  ['L-mflat-tipOnce', 'L-mflat-tipStored'], ['mflat']),
    'j-tipearly': ([('menu', "moves > 2 && !tipSeen()", "moves > 1 && !tipSeen()")], ['L-mflat-tipNotEarly'], ['mflat']),
    'j-grouped': ([('menu', "        return (g && th.closest('thead')) ? th : null;", "        return null;")], ['L-gmenu-opens'], ['gmenu']),
    'j-restrict': ([('menu', "        var restricted = A.restricted(), layout", "        var restricted = false, layout")], ['L-mrestr-noLayout'], ['mrestr']),
    'j-kbdplace': ([('menu', "            x = r.left; y = r.bottom;", "            x = r.left; y = r.top - 400;")], ['L-mkbd-opensBelow'], ['mkbd']),
    'j-focusback': ([('menu', "            if (t) { try { t.focus({ preventScroll: true }); } catch (e) { } }", "")], ['L-mkbd-focusBack', 'L-mkbd-escFocusBack'], ['mkbd']),
    'j-showhere': ([('menu', "                l.cols.splice(a < 0 ? l.cols.length : a + 1, 0, it);", "                l.cols.push(it);")], ['L-mflat-showHere'], ['mflat']),
    'j-calcplace': ([('menu', "                A.applyLayout(l);\n            }\n        });", "            }\n        });")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    # --- main.js
    'm-fromheader': ([('main', "        if (opts.fromHeader) {\n            window.Penumbra.refreshSettingsColumns();\n            return _asyncRerender;\n        }\n", "")],
                     ['L-mflat-noSavedToast'], ['mflat']),
    'm-sortrun': ([('main', "        else return;\n        _pnbRunHeaderSort($h.closest('table'));", "        else return;")],
                  ['L-mflat-sortAsc', 'L-mflat-sortDesc', 'L-gmenu-sortsGroups'], ['mflat', 'gmenu']),
    'm-hdrfreeze': ([('main', "            freeze: !hdr && _pnbFreezeState(col) ?", "            freeze: _pnbFreezeState(col) ?")], ['L-mopts-optsNoFreeze'], ['mopts']),
    'm-opener': ([('main', "        _all('.pnb-hm-opener.is-open').removeClass('is-open pnb-hm-opener');\n", "")], ['L-mopts-optsCloses'], ['mopts']),
    # --- the calculated column module, the width module
    'j-calcafter': ([('calc', "                    if (after) { try { after(name); } catch (e) { } }\n", "")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    'j-calcseed': ([('calc', "esc(d ? d.formula : (opts.seed || ''))", "esc(d ? d.formula : '')")], ['L-mcalc-seeded'], ['mcalc']),
    # (re-anchored 2026-10-20 d, jrnhidden: fitOne gained the dn line before offerUndo; the setWidth line alone)
    'j-fit': ([('colw', "        setWidth(c, clampW(Math.min(w, fitCap(c)), c));\n", "")], ['L-mopts-fits', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut'], ['mopts']),
    # --- (round 2) the measuring Fit, the counts
    'j-fitauto': ([('colw', "        setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "        setWidth(c, 'auto');")], ['L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup'], ['mopts', 'gmenu']),
    # --- (round 3) Fit's cap, journal counts, Copy distinct values
    'j-fitcap': ([('colw', "        setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "        setWidth(c, clampW(w, c));")], ['L-mopts-fitCapped'], ['mopts']),
    'm-statsjournal': ([('main', "        var jrn = !!(P.journalFriendlyCol && P.journalSearchColumnValue && P.journalFriendlyCol(String(col)));",
                         "        var jrn = false;")], ['L-mflat-statsToggle', 'L-mflat-statsNotes'], ['mflat']),
    'm-quickdelim': ([('main', "                const delimiter = (_pnbQuick && typeof _pnbQuick.delim === 'string') ? _pnbQuick.delim : ($('#copyDelimiterInput').val() || ';');",
                       "                const delimiter = $('#copyDelimiterInput').val() || ';';")], ['L-mcopy-copyComma', 'L-mcopy-copyNewline', 'L-mcopy-copyTab'], ['mcopy']),
    'm-quickkeep': ([('main', "        if (_pnbQuick) return;\n        lastCopySettings = {", "        lastCopySettings = {")], ['L-mcopy-copyKeeps'], ['mcopy']),
    'j-copyother': ([('menu', "            run: function () { A.copyDistinct(col, null); } });", "            run: function () { A.copyDistinct(col, ';'); } });")],
                    ['L-mcopy-copyOther'], ['mcopy']),
    # --- (round 4) the quick read, Swap...
    # (re-anchored 2026-10-20: since round 21 the quick read's "all unique" is Column stats' Unique "all")
    'j-allunique': ([('menu', "            { info: 'Unique', value: (p.values > 1 && p.unique === p.values) ? 'all' : n(p.unique) });",
                      "            { info: 'Unique', value: n(p.unique) });")], ['L-mflat-statsAllUnique'], ['mflat']),
    # (j-noneempty dropped 2026-10-20: round 21's Column stats list shows Empty as a number, "0", so the
    # "none empty" wording it broke is gone; m-statsempty still bites the empty count)
    'j-swaphalf': ([('menu', "                l.cols[i] = l.cols[j];\n                l.cols[j] = a;", "                l.cols[i] = l.cols[j];")],
                   ['L-mflat-swapDone'], ['mflat']),
    'j-swapself': ([('menu', "            if (!movable(c) || c.colName === col) { return; }", "            if (!movable(c)) { return; }")],
                   ['L-mflat-swapList'], ['mflat']),
    # --- (round 5) the journal block, Back
    'm-back': ([('main', "            back: (hdr && typeof hdr.back === 'function') ? { label: 'Back to the column menu', run: hdr.back } : null", "            back: null")],
               ['L-mopts-optsBack'], ['mopts']),
    # (re-anchored 2026-10-21, backrun: pvfix2's Back hands a paused rule over first, so edFlush() now sits between
    # e.preventDefault() and cfg.back.run(); the run line alone)
    'j-backrun': ([('mod', "            cfg.back.run();\n", "")], ['L-mopts-optsBack'], ['mopts']),
    # --- (round 6) journal columns movable; the new items
    'm-jplace': ([('main', "        function placeHead(headRow, prev, th) {\n            if (th.parentNode === headRow) return th;", "        function placeHead(headRow, prev, th) {")],
                 ['L-mjournal-jrnStaysUnsaved'], ['mjournal']),
    'm-jrow': ([('main', "                placeAfter(anchor, cell);\n            }\n        }", "                placeAfter(hash, cell);\n            }\n        }")],
               ['L-mjournal-jrnMoves'], ['mjournal']),
    'm-jsaved': ([('main', "            if (!order) return null;\n            for (var k = order.indexOf(col) - 1;", "            return null;\n            for (var k = order.indexOf(col) - 1;")],
                 ['L-mjournal-jrnSaved'], ['mjournal']),
    'm-thensort': ([('main', "        if (then && (dir === 'asc' || dir === 'desc')) {", "        if (false) {")], ['L-mmore-thenSort'], ['mmore']),
    'm-filterkeep': ([('main', "        if (values && values.length) st.sel[C] = values.slice();", "        if (false) st.sel[C] = values.slice();")], ['L-mmore-filterApply'], ['mmore']),
    'j-filterinit': ([('menu', "        var on = vals.map(function (v) { return any ? !!v.on : true; });", "        var on = vals.map(function (v) { return true; });")],
                     ['L-mmore-filterReopen'], ['mmore']),
    'j-panelesc': ([('menu', "        if (panel && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); closePanel(true); return; }\n", "")],
                   ['L-mmore-filterEsc'], ['mmore']),   # (re-anchored 2026-10-20: the line stops the other window listeners too)
    # (re-aimed 2026-10-20, mutfix: round 13 took statsNum / statsDate out of mmore; round 21's Column stats list
    # shows the spread and the span again, and mflat's statsNum / statsDate read them)
    'm-statsnum': ([('main', "            out.num = { min: nums[0], max: nums[nums.length - 1],", "            out.num = { min: nums[nums.length - 1], max: nums[0],")], ['L-mflat-statsNum'], ['mflat']),
    'm-statsdate': ([('main', "                    if (!dMin || k < dMin.k) dMin = { k: k, t: t };", "                    if (!dMin) dMin = { k: k, t: t };")], ['L-mflat-statsDate'], ['mflat']),
    'j-only': ([('menu', "                l.cols.forEach(function (c) { c.visible = c.colName === col; });", "                l.cols.forEach(function (c) { c.visible = true; });")],
               ['L-mmore-only'], ['mmore']),
    'm-resetpos': ([('main', "        if (to !== i) penumbraApplyHeaderLayout(lay);\n", "")], ['L-mmore-resetCol'], ['mmore']),
    'j-copyname': ([('menu', "            navigator.clipboard.writeText(name).then(", "            navigator.clipboard.writeText(String(name).toLowerCase()).then(")],
                   ['L-mmore-copyName'], ['mmore']),
    # (j-toolon dropped 2026-10-20, mutfix: toolOn() has had no caller since round 13 took Pivot by / Chart out of the menu)
    'm-blankoffer': ([('main', "return e.v !== '' || e.all > 0 || e.on;", "return true;")], ['L-mmore-filterList', 'L-mmore-filterApply'], ['mmore']),
    # --- (round 7) Fit as the cell lays out
    'j-fittable': ([('colw', "            if (st.display === 'table' || st.display === 'inline-table') {", "            if (false) {")],
                   ['L-mfitnest-nestGrow', 'L-mfitnest-nestCompact'], ['mfitnest']),
    'j-fitbr': ([('colw', "            if (n.tagName === 'BR') { if (!row) { flushLine(acc); } continue; }", "            if (n.tagName === 'BR') { continue; }")],
                ['L-mfitnest-fitLines'], ['mfitnest']),
    'j-fitfixed': ([('colw', "        if (st.tableLayout === 'fixed') { w = widest * n; }   // fixed: the columns share the width equally\n", "")],
                   ['L-mfitnest-nestCompact'], ['mfitnest']),
    # --- (round 8) the cell menu
    'j-cellof': ([('menu', "        if (!th) { cell = cellOf(e.target); th = cell ? cell.th : null; }\n", "")], ['L-mcell-cellOpens', 'L-gmenu-cellGroup'], ['mcell', 'gmenu']),
    'j-celllink': ([('menu', "        if (!onNotes && !onNestLink && target.closest('a, button, input, select, textarea, label, [contenteditable=\"true\"]')) { return null; }\n", "")],
                   ['L-mcell-cellNatives'], ['mcell']),   # (re-anchored 2026-10-20: cellOf's line; the bare one is the pivot's and the breakdown's)
    'j-cellsel': ([('menu', "        if (sel && !sel.isCollapsed && sel.containsNode && sel.containsNode(td, true)) { return null; }\n", "")], ['L-mcell-cellNatives'], ['mcell']),
    'm-cellraw': ([('main', "        return _pnbFsCellText(m.get(String(col || '').toUpperCase()));\n    }\n    // One value into", "        return String(td.textContent || '').trim();\n    }\n    // One value into")],
                  ['L-mcell-cellRaw'], ['mcell']),
    'm-celladd': ([('main', "        var v = String(value == null ? '' : value), cur = (st.sel[C] || []).slice();\n        if (!cur.some(function (x) { return String(x).toLowerCase() === v.toLowerCase(); })) cur.push(v);",
                    "        var v = String(value == null ? '' : value), cur = (st.sel[C] || []).slice();\n        cur = [v];")],
                  ['L-mcell-cellAdd'], ['mcell']),   # (re-anchored 2026-10-20: penumbraPivotMenuFilter has the same line; penumbraHeaderFilterAdd's is the one)
    'm-cellex': ([('main', "fields = [exclude ? { col: C, blank: true, mode: 'ex' } : { col: C, blank: true }];", "fields = [{ col: C, blank: true }];")],
                 ['L-mcell-cellExclude'], ['mcell']),
    # (2026-10-20, grpmenu) re-anchored: the line now starts with a group band's focus
    'j-cellfocus': ([('menu', "                : (c.cell && document.contains(c.cell.td)) ? c.cell.td : (document.contains(c.th) ? c.th : null);",
                      "                : document.contains(c.th) ? c.th : null;")], ['L-mcell-cellKbd'], ['mcell']),
    # --- (round 9, perf) only the cells that change
    'm-cellplan': ([('main', "            if (!_pnbApplyCellPlan(row, plan)) _pnbFullCellPass(row, desiredOrder, visibilityMap);",
                     "            if (true) _pnbFullCellPass(row, desiredOrder, visibilityMap);")], ['L-mflat-moveMinimal'], ['mflat']),
    'm-planlast': ([('main', "        for (i = ids.length - 1; i >= 0; i--) {\n            if (stay[ids[i]]) continue;",
                     "        for (i = 0; i < ids.length; i++) {\n            if (stay[ids[i]]) continue;")], ['L-mflat-multiMove'], ['mflat']),
    'm-planlis': ([('main', "        for (var t = tails.length ? tailIdx[tails.length - 1] : -1; t >= 0; t = prevIdx[t]) stay[ids[t]] = true;",
                    "        for (var t = -1; t >= 0; t = prevIdx[t]) stay[ids[t]] = true;")], ['L-mflat-moveMinimal'], ['mflat']),
    # --- (round 12) the lists under one item
    'u-noshowall': ([('menu', "        body.push({ act: 'showAll', label: 'Show all columns', disabled: !hidden.length, why: 'Every column is shown', run: function () {\n            var l = copyLayout(api().layout());\n            l.cols.forEach(function (c) { c.visible = true; });\n            applyWithUndo(l, 'Showing all ' + l.cols.length + ' columns.', false);\n        } });\n", "")],
                    ['L-msubs-showList'], ['msubs']),
    'u-clear': ([('menu', "run: function () { var b = document.getElementById('spClearStorage'); if (b) { b.click(); } } });", "run: function () { } });")], ['L-msubs-clearPanel'], ['msubs']),
    'u-arrow': ([('menu', "((it.sub && it.act !== 'back') ? '<span class=\"pnb-hm-arrow\" aria-hidden=\"true\">&#8250;</span>' : '')", "''")], ['L-msubs-arrows'], ['msubs']),
    'u-copyname': ([('menu', "        if (!isNum) { use.push({ act: 'copyName', label: 'Copy column name', run: function () { copyName(col); } }); }\n", "")], ['L-msubs-topOrder'], ['msubs']),   # (re-anchored 2026-10-20: not on round 20's '#' menu)
    # --- (round 31) the item trusts the panel's checkbox
    'h-stale': ([('menu', "        var on = !document.body.classList.contains('disable-auto-expand');\n        if (tg.checked !== on) { tg.checked = on; }\n", "        var on = tg.checked;\n")], ['L-mnest-nestRowHeight'], ['mnest']),
    # --- (round 30) the row height item never offered; the pick flips nothing
    'h-noitem': ([('menu', "        var rh = rowHeightItem();\n        if (rh) { size.push(rh); }\n", "")], ['L-mnest-nestRowHeight', 'L-mnest-nestRowHeightFlips', 'L-mnest-nestRowHeightPlain'], ['mnest']),
    # (round 33) the row height item back on nested-table columns only
    'h-nestonly': ([('menu', "        var rh = rowHeightItem();\n        if (rh) { size.push(rh); }", "        var rh = nested ? rowHeightItem() : null;\n        if (rh) { size.push(rh); }")], ['L-mnest-nestRowHeightPlain'], ['mnest']),
    'h-noflip': ([('menu', "                tg.checked = !tg.checked;\n", "")], ['L-mnest-nestRowHeightFlips'], ['mnest']),
    # --- (round 26) the Duplicates line: the extra copies miscounted
    'd-extra': ([('main', "        freq.forEach(function (c) { if (c > 1) { dupRows += c; dupExtra += c - 1; dupValues++; } });", "        freq.forEach(function (c) { if (c > 1) { dupRows += c; dupExtra += c; dupValues++; } });")], ['L-mflat-statsDup'], ['mflat']),
    'd-noline': ([('menu', "        if (p.dup) {\n            items.push({ info: 'Duplicates',", "        if (false) {\n            items.push({ info: 'Duplicates',")], ['L-mflat-statsDup', 'L-mflat-statsAllUnique'], ['mflat']),
    # --- (round 25) the way to the browser's menu
    's-shift': ([('menu', "        if (e.shiftKey && e.button === 2) { if (cur) { close(false); } lastClosed = null; return; }\n", "")], ['L-mnest-nativeShift'], ['mnest']),
    's-second': ([('menu', "            lastClosed = (e.button === 2 && cur.spot && cur.spot === spotOf(e.target)) ? { spot: cur.spot, t: Date.now() } : null;", "            lastClosed = null;")], ['L-mnest-nativeSecond', 'L-mnest-nativeSecondCell'], ['mnest']),
    'f-foot': ([('menu', "        footNote = !!(e.target && e.target.closest && e.target.closest('a[href]'));", "        footNote = false;")], ['L-mnest-nestLinkFoot'], ['mnest']),
    # --- (round 24) a linked sub-cell
    'n-link': ([('menu', "        if (!onNotes && !onNestLink && target.closest('a, button", "        if (!onNotes && target.closest('a, button")], ['L-mnest-nestLinkOpens'], ['mnest']),
    'n-linkval': ([('main', "        nestedCellQuery: function (td, target) { return _nestedCellFilterQuery(td, target, true); },", "        nestedCellQuery: function (td, target) { return _nestedCellFilterQuery(td, target, false); },")], ['L-mnest-nestLinkOpens', 'L-mnest-nestLinkFilter'], ['mnest']),
    # --- (round 23) nested-table columns
    'n-filter': ([('menu', "if (!isJournal(col) && !isNum && !nested && typeof A.filterInfo === 'function'", "if (!isJournal(col) && !isNum && typeof A.filterInfo === 'function'")], ['L-mnest-nestNoFilter'], ['mnest']),
    'n-top': ([('main', "            if (rawV != null && String(rawV).indexOf('@@JSON') === 0) {", "            if (false) {")], ['L-mnest-nestStats'], ['mnest']),
    'n-sub': ([('menu', "        if (cell && cell.nested && typeof A.nestedCellQuery === 'function') {", "        if (false) {")], ['L-mnest-nestSubOpens', 'L-mnest-nestSubFilter'], ['mnest']),
    # --- (round 21) Column stats, the notes button, Remove calculated column
    's-noflyout': ([('menu', "            look.push({ act: 'stats', label: 'Column stats', sub: true, items: function () { return statsItems(col); } });\n", "")], ['L-mflat-statsLine'], ['mflat']),
    's-topnofilter': ([('menu', "run: function () { A.filterAdd(col, t.v, false); } }); }", "run: function () { } }); }")], ['L-mflat-statsTop'], ['mflat']),
    'c-noremove': ([('menu', "            if (typeof C.isCalc === 'function' && C.isCalc(col) && typeof C.remove === 'function') {", "            if (false) {")], ['L-mcalc-calcRemoveItem'], ['mcalc']),
    'j-innote': ([('menu', "        var onNotes = target.closest('button.journal-notes-btn');", "        var onNotes = null;")], ['L-mjournal-jrnInNote'], ['mjournal']),
    # --- (round 20) the '#' menu, Add a note, the fiscal year
    'n-native': ([('menu', "        if (!th) { return null; }   // (round 20) the '#' heading has a short menu of its own", "        if (!th || th.getAttribute('data-column') === '#') { return null; }")], ['L-mnum-numOpens'], ['mnum']),
    # (2026-10-27, notescroll) Add a note to this row... brings the row's Notes button into the table's box first
    'j-noscroll': ([('menu', "run: function () { intoView(nb); nb.click(); } });", "run: function () { nb.click(); } });")], ['L-mjournal-jrnAddNoteScrolled'], ['mjournal']),
    'j-nonote': ([('menu', "            if (nb && !nb.disabled) {   // (a row whose key is empty cannot take notes: its button is disabled)\n                items.push({ act: 'addNote',", "            if (false) {\n                items.push({ act: 'addNote',")], ['L-mjournal-jrnAddNote'], ['mjournal']),
    'f-fy': ([('main', "var fy = m >= PNB_FY_START_MONTH ? y + 1 : y;", "var fy = y;")], ['L-mbucket-dtUnits'], ['mbucket']),
    # --- (round 19) date Ranges, Fit all
    'k-nodate': ([('main', "        if (days.length >= 2 && days.length === nonEmpty) {", "        if (false) {")], ['L-mbucket-dtModes'], ['mbucket']),
    'w-nofitall': ([('menu', "        if (typeof W.fitAll === 'function') {\n            items.push({ act: act('fitAll')", "        if (false) {\n            items.push({ act: act('fitAll')")], ['L-mopts-fitAll'], ['mopts']),
    # (round 33) no Fit to page in the list; a share dropped by main.js; the clear item back in a list
    'w-nopage': ([('menu', "        if (typeof W.fitPage === 'function') {\n            items.push({ act: act('fitPage')", "        if (false) {\n            items.push({ act: act('fitPage')")], ['L-mopts-fitPage', 'L-msubs-resetList'], ['mopts', 'msubs']),
    'w-share': ([('main', "                if (p > 0 && p <= 100 && name.indexOf('PIVOT:') !== 0) out[name] = p + '%';", "")], ['L-mopts-fitPage'], ['mopts']),
    'c-flyout': ([('menu', "        if (clear.length) { items.push('-'); items = items.concat(clear); }", "        if (clear.length) { items.push('-'); items.push({ act: 'resets', label: 'Reset', sub: true, items: function () { return clear; } }); }")], ['L-msubs-topOrder', 'L-msubs-resetList'], ['msubs']),
    # --- (round 16) Ranges
    'k-contig': ([('menu', "                apply.disabled = sp.n === 0 || sp.gap || !!info.off;", "                apply.disabled = sp.n === 0 || !!info.off;")], ['L-mbucket-bkGap'], ['mbucket']),
    # (the fixture's amounts are all distinct, so a wrong count per value cannot show: the cuts instead)
    'k-step': ([('main', "        for (; c < hi && cuts.length < 12; c += step) cuts.push(+c.toFixed(6));", "        for (; c < hi && cuts.length < 1; c += step) cuts.push(+c.toFixed(6));")], ['L-mbucket-bkList'], ['mbucket']),
    'k-range': ([('main', "max: (max === null || max === undefined) ? '' : String(max) };", "max: '' };")], ['L-mbucket-bkApply'], ['mbucket']),
    'k-openend': ([('menu', "(clearR || sp.first === 0) ? null : bk.buckets[sp.first].min,", "clearR ? null : bk.buckets[sp.first].min,")], ['L-mbucket-bkOpenEnd'], ['mbucket']),
    # --- (round 13) the lists beside their item
    'v-hover': ([('menu', "            hoverTimer = setTimeout(function () { if (cur && document.contains(itemEl)) { openSub(itemEl, it); } }, 150);", "            hoverTimer = null;")], ['L-msubs-hoverOpens'], ['msubs']),
    'v-hoverclose': ([('menu', "            hoverTimer = setTimeout(function () { if (cur) { closeSubs(level); } }, 250);", "            hoverTimer = null;")], ['L-msubs-hoverCloses'], ['msubs']),
    'v-kbdright': ([('menu', "        else if (k === 'ArrowRight' && opens) { activate(it[i]); }\n", "")], ['L-msubs-kbdOpens'], ['msubs']),
    'v-kbdleft': ([('menu', "        else if (k === 'ArrowLeft' && level > 0) { var from = cur.subs[level - 1].from; closeSubs(level - 1); try { from.focus({ preventScroll: true }); } catch (err) { from.focus(); } }\n", "")], ['L-msubs-kbdBack'], ['msubs']),
    'v-side': ([('menu', "        var x = p.right - 2, y = r.top - 5;", "        var x = p.left, y = p.top;")], ['L-msubs-flyPos'], ['msubs']),
    'v-close': ([('menu', "        c.subs.forEach(function (s) { if (s.el.parentNode) { s.el.parentNode.removeChild(s.el); } });\n", "")], ['L-msubs-escAll', 'L-msubs-outsideAll'], ['msubs']),
    'u-resetwidths': ([('menu', "        if (all) {\n            items.push({ act: act('resetWidths')", "        if (false) {\n            items.push({ act: act('resetWidths')")], ['L-msubs-resetList', 'L-mopts-resetItem'], ['msubs', 'mopts']),
    'u-seps': ([('menu', "        items = items.concat(look);\n", "        if (look.length) { items.push('-'); items = items.concat(look); }\n")], ['L-msubs-topOrder'], ['msubs']),
    # --- (round 11) Reset all columns
    'r-layout': ([('main', "        if (s.moved) penumbraApplyHeaderLayout(s.rep);\n        _pnbDropLayoutPref();",
                   "        _pnbDropLayoutPref();")], ['L-mreset-raLayout'], ['mreset']),
    'r-droppref': ([('main', "        if (s.moved) penumbraApplyHeaderLayout(s.rep);\n        _pnbDropLayoutPref();",
                     "        if (s.moved) penumbraApplyHeaderLayout(s.rep);")], ['L-mreset-raPref'], ['mreset']),
    'r-custom': ([('main', "        customized: function () { return !!_pnbColumnCustoms(); },", "        customized: function () { return true; },")],
                 ['L-mreset-raOffClean', 'L-mreset-raOffAfter'], ['mreset']),
    'r-undofmt': ([('main', "_pnbColOptWrite(C, { fmt: o.fmt || null,", "_pnbColOptWrite(C, { fmt: null,")], ['L-mreset-unFmt', 'L-mreset-unFmtOnly'], ['mreset']),
    'r-undosum': ([('main', "                persistColumnSummaries(userColumnSummaries, userColumnSummaryFormulas);\n", "")], ['L-mreset-unSum'], ['mreset']),
    'r-freezeorder': ([('main', "        if (s.frozen !== null) penumbraSetFrozenCols(reportFrozenCols);\n", "")], ['L-mreset-raFreeze'], ['mreset']),
    # --- (round 10, load perf)
    'p-idlist': ([('main', "            var fast = (typeof selector === 'string' && !context",
                   "            var fast = (false && typeof selector === 'string' && !context")], ['L-mload-idFast'], ['mload']),
    'p-idsort': ([('main', "            return jQuery.uniqueSort(out);", "            return out;")], ['L-mload-idSame'], ['mload']),
    'p-idscope': ([('main', "found = el.querySelectorAll(m[2].charAt(0) === '>' ? ':scope ' + m[2] : m[2]);", "found = el.querySelectorAll(m[2]);")],
                  ['L-mload-idFast'], ['mload']),
    'p-edhidden': ([('main', "        if (shown || typeof IntersectionObserver !== 'function') {",
                     "        if (true || typeof IntersectionObserver !== 'function') {")], ['L-mload-edHiddenSkip', 'L-mload-edShownRefresh'], ['mload']),
    'p-edcancel': ([('main', "            if (w.__pnbRefreshIO) { w.__pnbRefreshIO.disconnect(); w.__pnbRefreshIO = null; }\n", "")], ['L-mload-edShownOnce'], ['mload']),
    'p-edio': ([('main', "            w.__pnbRefreshIO = null;\n            cm.refresh();", "            w.__pnbRefreshIO = null;")], ['L-mload-edShownRefresh'], ['mload']),
    'j-fitgroup': ([('colw', "        var tables = c.view === 'group' ? document.querySelectorAll('#groupedResultsContainer table') : [c.th.closest('table')];",
                     "        var tables = [c.th.closest('table')];")], ['L-gmenu-fitGroup'], ['gmenu']),
    # (re-anchored 2026-10-20, mutfix: since round 21 statsFiltered reads the Column stats list, which
    # penumbraHeaderColProfile counts; the penumbraHeaderColStats line it hit feeds only a journal column's counts now)
    'm-statshidden': ([('main', "            if (rows[i].classList.contains('search-hidden')) continue;\n            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            n++;\n            var rawV = m.get(name);",
                        "            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            n++;\n            var rawV = m.get(name);")], ['L-mflat-statsFiltered'], ['mflat']),
    # (2026-10-20, jrnhidden) its twin in penumbraHeaderColStats, which since round 21 feeds only a journal column's
    # counts (a toggle's Checked / Unchecked, Notes' rows): statsJournalFiltered reads them with rows hidden
    'm-jrnhidden': ([('main', "            if (rows[i].classList.contains('search-hidden')) continue;\n            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);",
                      "            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);")], ['L-mflat-statsJournalFiltered'], ['mflat']),
    'm-statsempty': ([('main', "            else seen.add(t);", "            seen.add(t);")], ['L-mflat-statsEmpty'], ['mflat']),
    # (j-statsline dropped 2026-10-20: round 21 removed the counts line under the title, statsLine, that it blanked;
    # the Column stats list beside the item has s-noflyout, s-topnofilter and d-noline)
}
# (round 33) mreset retired with Reset all columns: its mutants have nothing to turn red
MUTANTS = {k: v for k, v in MUTANTS.items() if set(v[2]) != {'mreset'}}
# (2026-10-27, fltmenu) a cell's Filter list, Click to filter, At least / At most; Copy's [column name] before This entire row,
# This nested table, Distinct column groups; Highlight... out. NEW = what live fails: mfltm but its guards (they hold on
# live: Filter to still runs, a heading's flat Filter by value..., Copy column name's copy, a '#' cell, no groups where
# none apply) and the checks reshaped with it.
FLT_GUARDS = {'L-mfltm-fmFilterRuns', 'L-mfltm-fmHead', 'L-mfltm-fmCopyName', 'L-mfltm-fmNumCell', 'L-mfltm-fmGroupsNone'}
NEW_FLT = ({'L-mfltm-%s' % c for c in CHK['mfltm']} - FLT_GUARDS) | {'L-gmenu-cellGroup', 'L-mcell-cellOpens', 'L-mcopym-cmCell', 'L-mcopym-cmList',
    'L-mcopym-cmClipOff', 'L-mcopym-cmNestList', 'L-ggcopym-gcList', 'S-helpCopyMenu', 'S-helpFltMenu'}
NEW = NEW | NEW_FLT
NEW = NEW - NEW_FLT   # (fltmenu is LIVE since 5eae534, 2026-10-27: old checks now)
NEW = NEW | NEW_COPYM2   # (copymenu 2, again: fltmenu's retirement took S-helpCopyMenu out with its own)
NEW = NEW - NEW_COPYM2   # (copymenu 2 is LIVE since 0d19cfd, 2026-10-27: old checks now)
# (2026-10-27, copymenu 3; the user: "Add a 'Copy' static header in the flyover menu so everything below makes more instant
# sense", "When right clicking headers, move the copy menu to be above the filter to value item") the Copy list's heading
# row; a heading's Copy right above Filter by value... (with none, after the sorts) - live has neither
CHK['mcopym'] = CHK['mcopym'] + ['cmHeadRow', 'cmHeadPlace', 'cmHeadNoFilter', 'cmHeadAlign']
NEW_COPYM3 = {'L-mcopym-cmHeadRow', 'L-mcopym-cmHeadPlace', 'L-mcopym-cmHeadNoFilter', 'L-mcopym-cmHeadAlign', 'L-mcopym-cmHead', 'L-msubs-topOrder'}
NEW = NEW | NEW_COPYM3
NEW = NEW - NEW_COPYM3   # (copymenu 3 is LIVE since 766f5e9, 2026-10-27: old checks now)
# mhl retired with Highlight...: its mutants have nothing to turn red
MUTANTS = {k: v for k, v in MUTANTS.items() if 'mhl' not in v[2]}
MUTANTS.update({
    # the Filter list: never placed; always its first item alone; Filter by value... on a cell's top level; the bounds before
    # Filter by value...; no separator before Click to filter
    'fm-noslot': ([('menu', "                }\n            }\n            items.push(fltSlot);\n", "                }\n            }\n")], ['L-mfltm-fmCell', 'L-mfltm-fmList', 'L-mcell-cellOpens'], ['mfltm', 'mcell']),
    'fm-alone': ([('menu', "            else if (fl.length === 1) { fillSlot(fltSlot, fl[0]); }", "            else if (true) { fillSlot(fltSlot, fl[0]); }")], ['L-mfltm-fmCell', 'L-mfltm-fmList', 'L-mfltm-fmNumList'], ['mfltm']),
    'fm-bytop': ([('menu', "            if (items.indexOf(fltSlot) >= 0) { fltBy = fbv; } else { look.push(fbv); }", "            look.push(fbv);")], ['L-mfltm-fmList', 'L-mfltm-fmNumList'], ['mfltm']),
    'fm-order': ([('menu', "            var fl = flt.concat(fltBy ? [fltBy] : [], fltCmp)", "            var fl = flt.concat(fltCmp, fltBy ? [fltBy] : [])")], ['L-mfltm-fmNumList'], ['mfltm']),
    'fm-nosep': ([('menu', "            if (cf) { if (fl.length) { fl.push('-'); } fl.push(cf); }", "            if (cf) { fl.push(cf); }")], ['L-mfltm-fmList'], ['mfltm']),
    # the bounds: none for a number; At least writes the high end; the other end always dropped / never dropped; no dates
    'fm-nonum': ([('main', "            if (isFinite(x)) return { kind: 'number', bound: String(x) };", "            if (false) return { kind: 'number', bound: String(x) };")], ['L-mfltm-fmNumList', 'L-mfltm-fmAtLeast'], ['mfltm']),
    'fm-side': ([('menu', "run: function () { A.filterBound(col, 'min', bnd.bound, bnd.kind); } });", "run: function () { A.filterBound(col, 'max', bnd.bound, bnd.kind); } });")], ['L-mfltm-fmAtLeast'], ['mfltm']),
    'fm-nokeep': ([('main', "        var was = st.range[C] || { min: '', max: '' }, r = { min: was.min || '', max: was.max || '' }", "        var was = { min: '', max: '' }, r = { min: was.min || '', max: was.max || '' }")], ['L-mfltm-fmKeepOther'], ['mfltm']),
    'fm-nodrop': ([('main', "            if (lo > hi) r[other] = '';", "            if (false) r[other] = '';")], ['L-mfltm-fmDropOther'], ['mfltm']),
    'fm-nodate': ([('main', "        if (k.date) {\n            var d = lib.isoDate(s);", "        if (false) {\n            var d = lib.isoDate(s);")], ['L-mfltm-fmDate'], ['mfltm']),
    # Click to filter: always on; the report's switch ignored (menu, main.js); none at all
    'fm-cfon': ([('menu', "            A.setClickFilter(col, !st.on);", "            A.setClickFilter(col, true);")], ['L-mfltm-fmClick'], ['mfltm']),
    'fm-cfforced': ([('menu', "        if (st.forced) { return { act: 'clickFilter'", "        if (false) { return { act: 'clickFilter'")], ['L-mfltm-fmForced'], ['mfltm']),
    'fm-cfmain': ([('main', "forced: document.body.classList.contains('pnb-click-filter') };", "forced: false };")], ['L-mfltm-fmForced'], ['mfltm']),
    'fm-nocf': ([('menu', "            var fl = flt.concat(fltBy ? [fltBy] : [], fltCmp), cf = clickFilterItem(col, name, isNum, restricted);", "            var fl = flt.concat(fltBy ? [fltBy] : [], fltCmp), cf = null;")],
                ['L-mfltm-fmList', 'L-mfltm-fmClick', 'L-mfltm-fmForced', 'L-mfltm-fmNestLists'], ['mfltm']),
    # Copy: the name after This entire row; named Column name; no This nested table; its text, not its rows
    'fm-nameafter': ([('menu', "        var cpList = (cpRowAt < 0 ? cellCps.concat(cpNm)", "        var cpList = (true ? cellCps.concat(cpNm)")], ['L-mfltm-fmCopyOrder', 'L-mcopym-cmList', 'L-ggcopym-gcList'], ['mfltm', 'mcopym', 'ggcopym']),
    'fm-namelabel': ([('menu', "var o = shortCopy(u, valueLabel(cpName)); o.title = cpName; return o;", "var o = shortCopy(u, 'Column name'); return o;")], ['L-mfltm-fmCopyOrder', 'L-mfltm-fmHeadName', 'L-mcopym-cmList'], ['mfltm', 'mcopym']),
    'fm-nonest': ([('menu', "            if (cell.td.querySelector('.nested-json-container')) {\n                cellCps.push({ act: 'copyNestedTable'", "            if (false) {\n                cellCps.push({ act: 'copyNestedTable'")],
                  ['L-mfltm-fmNestLists', 'L-mfltm-fmNestCopy', 'L-mfltm-fmNestPad', 'L-mcopym-cmNestList'], ['mfltm', 'mcopym']),
    'fm-nesttext': ([('menu', "l = box ? nestedRows(box) : [];", "l = [cellText(cell.td)];")], ['L-mfltm-fmNestCopy'], ['mfltm']),
    # Distinct column groups: none; offered where the report hides Clipboard; in data order; each row's group (not once)
    'fm-nogroups': ([('menu', "        if (gcv.length) {\n            use.push({ act: 'copyGroups'", "        if (false) {\n            use.push({ act: 'copyGroups'")], ['L-mfltm-fmGroupsList', 'L-mfltm-fmGroupsCopy', 'L-mfltm-fmGroupsNum'], ['mfltm']),
    'fm-grpclip': ([('menu', "typeof A.groupVariants === 'function' && !document.body.classList.contains('restrict-clipboard'))", "typeof A.groupVariants === 'function')")], ['L-mfltm-fmGroupsNone'], ['mfltm']),
    'fm-grpsort': ([('main', "        try { out.sort(pivotSplitComparator(spec.split, spec.base)); } catch (e) { }\n", "")], ['L-mfltm-fmGroupsCopy', 'L-mfltm-fmGroupsNum'], ['mfltm']),
    'fm-grponce': ([('main', "            if (!seen[k]) { seen[k] = true; out.push(k); }", "            out.push(k);")], ['L-mfltm-fmGroupsCopy'], ['mfltm']),
    # Highlight... back in the menu (the 10-24 item)
    'fm-hl': ([('menu', "        // 10-24 Highlight... item went: the column's highlight rules are Column options' own (main.js keeps openColHighlight)\n",
                "        // 10-24 Highlight... item went: the column's highlight rules are Column options' own (main.js keeps openColHighlight)\n"
                "        if (!restricted && !isNum && A.colOptsOn()) { arrange.push({ act: 'highlight', label: 'Highlight...', run: function () { } }); }\n")],
              ['L-mfltm-fmNoHighlight', 'L-mfltm-fmNoHighlightCell'], ['mfltm']),
})

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
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php'), 'topic': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php'),
        'ptips': os.path.join('help', 'tips', 'pivot-tips-storage.php'),   # (2026-10-20) the grouping dialog's Layout tip
        'gtopic': os.path.join('help', 'topics', 'groupingHelpLightbox.php')}   # (2026-10-25, nestgb2) the grouping topic: the chip's list
sys.path.insert(0, HERE)
import mk_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    out = out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
    # (2026-10-27, copymenu) main.js's own notices too (its show_text is the closure's, never the driver's window.show_text stub)
    st = '    function show_text(text, duration = 8000, opts) {'
    if out.count(st) == 1: out = out.replace(st, st + '\n        (window.__HC_MAIN_TOASTS = window.__HC_MAIN_TOASTS || []).push(String(text));')
    return out
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        # main.js mixes line endings: an anchor written with LF may sit in a CRLF stretch
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cm_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path):
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        # (perf) PNB_PROFILE_BOOT=<json>: the CPU from navigation until the page is ready (mperf: the build)
        booting = bool(os.environ.get('PNB_PROFILE_BOOT'))
        if booting:
            call('Profiler.enable'); call('Profiler.setSamplingInterval', {'interval': 500}); call('Profiler.start')
        tnav = time.time()
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        profiling = False
        while time.time() - t0 < 300:
            time.sleep(0.25)
            if booting:
                if call('Runtime.evaluate', {'expression': '!!window.__PERF_READY', 'returnByValue': True}).get('result', {}).get('value'):
                    prof = call('Profiler.stop').get('profile')
                    open(os.environ['PNB_PROFILE_BOOT'], 'w', encoding='utf-8').write(json.dumps(prof))
                    print('BOOT wall %.1f s' % (time.time() - tnav))
                    booting = False
                    call('Runtime.evaluate', {'expression': 'window.__PERF_GO = true'})
                continue
            # (perf) PNB_PROFILE: once the page says it is ready, profile the move it then makes
            if os.environ.get('PNB_PROFILE') and not profiling:
                ready = call('Runtime.evaluate', {'expression': '!!window.__PERF_READY', 'returnByValue': True}).get('result', {}).get('value')
                if ready:
                    call('Profiler.enable'); call('Profiler.setSamplingInterval', {'interval': 200}); call('Profiler.start')
                    call('Runtime.evaluate', {'expression': 'window.__PERF_GO = true'})
                    profiling = True
                    continue
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if profiling:
                    prof = call('Profiler.stop').get('profile')
                    open(os.environ['PNB_PROFILE'], 'w', encoding='utf-8').write(json.dumps(prof))
                if os.environ.get('PNB_SHOT'):
                    import base64
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot))
                return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])

def static_checks(texts):
    idx = texts['index']   # (2026-10-19) the v1 help is gone: the settings topic alone carries the wording the S-help* checks pin
    return [
        ('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_colmenu.off')" in idx and 'src="js/penumbra_colmenu.js?v=' in idx
         and 'href="css/penumbra_colmenu.css?v=' in idx, ''),
        # (round 5) the popover's Back, the journal block
        ('S-helpBack', 'returns to this menu' in texts['topic'] and 'move like any other and stay where you put them' in texts['topic'], ''),
        # (round 8) the cell menu in both help files
        ('S-helpNum', 'Hide the row numbers' in texts['topic'] and 'Add a note to this row' in texts['topic'] and 'by fiscal year' in texts['topic'], ''),
        ('S-helpFitAll', 'Fit all column widths to contents' in texts['topic'] and 'date column by year' in texts['topic'], ''),
        ('S-helpRanges', '<em>Ranges</em> groups the values into about six ranges' in texts['topic'], ''),
        ('S-helpSubs', '<strong>Move column</strong>' in texts['topic'] and 'Clear all customizations' in texts['topic'], ''),
        ('S-helpResetAll', '<strong>Column widths</strong>: Fit all column widths to page' in texts['topic'] and 'shares of the page' in texts['topic'] and '<strong>Reset</strong>: All columns</td>' not in texts['topic'], ''),   # (round 33) reshaped
        ('S-helpRowHeight', 'every row keeps one compact height' in texts['topic'] and 'nested-table cells alone' not in texts['topic'] and 'every nested row shows in full' not in texts['topic'] and '<strong>Freeze row labels</strong>' in texts['topic'], ''),
        ('S-helpCells', 'data-colmenu-cells' in texts['topic'] and 'Filter to "value"' in texts['topic'], ''),
        # (round 6) the new items in both help files
        ('S-helpMore', all(x in texts['topic'] for x in ('Then sort ascending', 'Filter by value...', 'Show only this column',
                                                           "Reset this column's width", '<strong>Copy column name</strong>', 'the lists open beside their item')), ''),   # (round 33) the Reset list's row went
        # (round 21) Column stats is back as a list beside the item; Pivot / Chart this column stay out
        ('S-helpStats', '<strong>Column stats</strong>' in texts['topic'] and 'A nested-table column counts its tables' in texts['topic'] and 'Pivot by this column' not in texts['topic']
         and '<em>all</em> when none repeats' in texts['topic'] and 'all unique' not in texts['topic'], ''),
        # (round 4) Swap..., the quick read
        ('S-helpSwap', '<em>Swap with...</em>' in texts['topic'], ''),   # (round 21: the "all unique" wording moved to S-helpStats)
        # (round 3) Copy distinct values, the cap, the journal counts
        ('S-helpCopy', '<strong>Copy distinct values</strong></td>' in texts['topic']
         and "60% of the table's visible width" in texts['topic'] and 'checked and unchecked boxes' in texts['topic'], ''),
        # (round 2) the help says Fit measures, and names the counts
        ('S-helpFit', 'widest value on screen' in texts['topic'] and 'how many different values' in texts['topic'], ''),
        ('S-helpNamed', 'id="us-colmenu" data-colmenu-help' in texts['topic']
         and 'data-jump-to="us-colmenu"' in texts['topic'], ''),
        # (2026-10-20, grpmenu / grpauto) a group's own menu; the layout no one chose (the topic and the Layout tip)
        ('S-helpGroups', 'data-colmenu-groups' in texts['topic'] and '<strong>Switch to List view</strong>' in texts['topic']
         and 'The layout no one chose' in texts['topic'] and '8 or fewer open <em>Stacked</em>' in texts['topic']
         and 'stays until the grouping is removed' in texts['ptips'] and chr(0x2014) not in texts['topic'] + texts['ptips'], ''),   # no em dash in the served help
        # (2026-10-20, grpsweep) a narrow window stays Stacked
        ('S-helpGroupsSweep', 'which always shows Stacked, they stay Stacked' in texts['topic'], ''),
        # (2026-10-20, grpsweep 2) Show only keeps every value of the group
        ('S-helpOnlyValues', 'keeps every row it shows' in texts['topic'] and 'more than 200 different values' in texts['topic'], ''),
        # (2026-10-25, nestgb; nestcopy) a nested-table column's Nested columns section
        ('S-helpNestGroup', '<strong>Nested columns</strong> (a nested-table column)' in texts['topic'] and 'a row joins the group of each value its table holds' in texts['topic']
         and "as Copy's <em>Nested sub-columns</em>" in texts['topic'] and 'section near the foot of the menu' in texts['topic'] and 'the menu ends with' not in texts['topic']
         and 'Where the report hides Clipboard, the menu offers no <em>Copy distinct values</em>' in texts['topic']
         and 'Group by a sub-column' not in texts['topic'] and chr(0x2014) not in texts['topic'], ''),
        # (2026-10-25, neststats) the Nested columns row names Column stats; the stats row says where a sub-column's are
        ('S-helpNestStats', "as Copy's <em>Nested sub-columns</em>, and <em>Column stats</em>" in texts['topic'] and 'has stats of its own under <em>Nested columns</em>' in texts['topic']
         and chr(0x2014) not in texts['topic'], ''),
        # (2026-10-27, copymenu; copymenu 2) the Copy list's rows: Copy (Link to this view among them), Copy this row, Link to this
        # view, no For SQL; the cell's Copy paragraph names the list with the link in it, a breakdown's says it has none;
        # (fltmenu) the column's name before the row
        ('S-helpCopyMenu', '<strong>Copy</strong></td>' in texts['topic'] and '<strong>Copy this row</strong></td>' in texts['topic'] and '<strong>Copy</strong>: Link to this view</td>' in texts['topic']
         and 'and on a saved report <em>Link to this view</em>' in texts['topic'] and 'It carries no data: whoever opens it sees the rows their own access allows. The same link as Copy' in texts['topic']
         and 'For SQL' not in texts['topic'] and "the <em>Copy</em> list: the value itself, the column's name, <em>This entire row</em>" in texts['topic'] and chr(0x2014) not in texts['topic']
         and "such as <em>Copy column name</em> on a comparison's heading." in texts['topic'] and "as the column menu's but without <em>Link to this view</em>" in texts['topic']
         and "<em>This entire row</em>, its distinct values and the view link." in texts['topic'], ''),
        # (copymenu 2, the review) the view link topic's Copy one names the right-click route
        ('S-helpVlMenu', "the menu's <em>Copy</em> list ends with <em>Link to this view</em>" in read_b(os.path.join(APP, 'help', 'topics', 'viewLinkHelpLightbox.php') if control
         else pick(os.path.join('help', 'topics', 'viewLinkHelpLightbox.php'))), ''),
        # (2026-10-27, fltmenu) the cell's Filter list, Click to filter, At least / At most, This nested table, Distinct column groups;
        # Highlight... no item of the menu's
        ('S-helpFltMenu', '<em>Filter</em> lists <em>Filter to "value"</em>' in texts['topic'] and '<em>Click to filter</em> is the column\'s Filter switch' in texts['topic']
         and '<strong>Filter</strong>: At least / At most</td>' in texts['topic'] and '<em>This nested table</em> (one line per row of it)' in texts['topic']
         and '<em>Distinct column groups</em> (a date period or number range, then a delimiter)' in texts['topic'] and '<strong>Highlight...</strong>' not in texts['topic']
         and '<em>Highlight...</em> in its right-click menu' not in texts['topic'], ''),
        # (2026-10-25, nestgb2) the group band menu's lists and the status bar chip's: no nested-table column, its tables' columns
        ('S-helpNestBand', "A nested-table column is never listed; the top level lists its tables' columns instead" in texts['topic']
         and 'A nested-table column is not in the list; the columns of its tables are, under <em>Nested table columns</em>' in texts['topic']
         and "a nested-table column's sub-columns stand in for it, under <em>Nested table columns</em>" in texts['gtopic']
         and chr(0x2014) not in texts['topic'] + texts['gtopic'], ''),
    ]

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, ('&rows=' + os.environ['PNB_ROWS']) if (s in ('mperf', 'mrerun') and os.environ.get('PNB_ROWS')) else ''))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        full = bool(os.environ.get('PNB_INFO'))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:None if full else 600]) if (v is not True or full) else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            # (2026-10-20, mutfix) a dead scenario (F-) is no kill: its checks never ran, so its must-checks
            # count as missed; the fatal text is printed (it names the driver line that needs a guard)
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            for a, p, d in res:
                if a.startswith('F-') and not p: print('      %s  %s' % (a, ' '.join(d.split())))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd if os.environ.get('PNB_INFO') else dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            old_red = sorted(a for a in red if a not in NEW and not a.startswith('F-'))
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
    shutil.rmtree(stage, ignore_errors=True)
