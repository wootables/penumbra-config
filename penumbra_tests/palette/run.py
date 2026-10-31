# =============================================================================
# PALETTE SUITE (2026-10-20) - the command palette (Ctrl+K)
# (js/penumbra_palette_boot.js = the always-loaded stub, js/penumbra_palette.js + css/penumbra_palette.css
# = the module, index.php's stub tag, main.js's "?" sheet row + Clear all custom preferences hook,
# js/penumbra_colmenu.js colMenu.items, the help topic + tip).
#   page half   harness.html (mk_harness.py, from colmenu's) + driver.js: the REAL main.js and the
#               header menu / column modules; scenarios pcold pfail pmain ppick pview prow
#                                                                   L-<scn>-<check>, E-<scn>
#   static      index.php emits the stub behind its .off switch; main.js's row + hook; the menu's
#               items export; the help topic, manifest entries and tip; every id / function the
#               registry names exists in index.php / main.js / the modules; no em-dash   S-*
# --control runs LIVE (no stub, no module: EMPTY files): every NEW check red there, every other
# one green.
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_pal_*; writes nothing to the webroot.
# One headless-Edge suite at a time (four at once gave false reds, 2026-10-19).
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_presets.js', 'penumbra_forms.js', 'penumbra_find.js']   # (round 14) Find, as index.php loads it
SCN = ['pcold', 'pfail', 'pmain', 'ppick', 'pview', 'prow', 'pshot', 'pcombo', 'pkeys', 'pdash', 'pdasha', 'pshot6', 'pfn', 'pshot7f', 'pshot7t', 'pfeed', 'pshot8', 'prank', 'pshot9', 'pshot10', 'pshot11', 'ptools', 'ptoolsv', 'padmin', 'pshot12', 'pdsec', 'pmetr', 'phand', 'pshot14a', 'pshot14b', 'pvo', 'pshot15', 'pjar', 'pshot16', 'pchip', 'pshot17', 'pthm', 'pjip', 'pshot19', 'pshow', 'pjump', 'pverb', 'pshot20', 'pnote', 'pmail', 'pmiss', 'pshot21', 'ptop', 'pr23', 'psweep', 'psrank', 'pperf', 'pwidth', 'pcmplink']
SCN = SCN + ['pjbusy', 'pjbusyrm', 'pjbusyhc', 'pshotjb']   # (jarbusy, 2026-10-23) the busy card while Jarvis thinks
SCN = SCN + ['pdictcol']   # (2026-10-24, dictstat) What this column means... as a "Which column?" row
SCN = SCN + ['phlcol']   # (2026-10-24, hlhead) Highlight... as a "Which column?" row
SCN = SCN + ['pnestgb']   # (2026-10-25, nestgb) Group by: a nested table's columns, never the @@JSON column itself
CHK = {
    # (jarbusy, 2026-10-23) "a visible loading animation that grabs the users attention" while the box asks Jarvis: the busy card at
    # once, large, where the answer lands and in view (a long pasted question, a 600px-tall window), moving (bar, dots, shimmer), said
    # once through the box's one live region (two keys typed while it waits say nothing again), aria-busy on the answer's place;
    # ended by the answer, an error (whose line reads AA in every theme), Esc (aborted) and a close that is not Esc (left alive);
    # every theme of the registry AA (words 4.5:1, moving marks 3:1), no text faded by opacity
    'pjbusy': ['busyShown', 'busyInView', 'busyMoves', 'busySaidOnce', 'busyMarked', 'busyEndsOnAnswer', 'busyEndsOnError', 'errorReadable', 'busyEndsOnCancel', 'busyEndsOnClose', 'busyThemes', 'busyNoFade'],
    # (jarbusy) under prefers-reduced-motion: nothing moves, still plainly busy (the words, a full bar, solid dots), AA in every theme
    'pjbusyrm': ['rmStill', 'rmObvious', 'rmThemes'],
    'pjbusyhc': ['hcMarks'],   # (jarbusy) forced colours (High Contrast): the dots and the bar in Highlight, 3:1; the words 4.5:1
    'pshotjb': ['open'],   # (jarbusy) the photograph: the busy card mid-animation (PNB_JBTHEME, PNB_JBRM=1, PNB_JBHC=1)
    'pcold': ['shellAtOnce', 'keysKept', 'handOver', 'renders'],
    'pfail': ['shellAtOnce', 'failLine', 'escCloses', 'noHang', 'escChipCloses'],
    'pmain': ['sheetRow', 'emptyRecent', 'emptyCommon', 'commonAvailOnly', 'hiddenUntilTyped', 'rankTop', 'marks', 'greyWhenTyped', 'greyReason',
              'columnsSec', 'reportsLocal', 'helpSec', 'askLast', 'questionFirst', 'askOpens', 'askSubmits',
              'trapTab', 'trapShiftTab', 'trapFocusin', 'arrows', 'escFocus', 'recentsStored', 'recentsShown', 'clearPrefs', 'coverage', 'registryNeeds', 'iconsTwin', 'groupIcon', 'iconsRendered', 'windowKey', 'reportsGate', 'noEmdashUi'],
    'ppick': ['pickMode', 'pickOrder', 'pickFreezeOff', 'pickFreezeRuns', 'pickFrozenPill', 'unfreezeOr', 'unfreezeRuns', 'sortRuns', 'hideRuns',
              'colMode', 'colItems', 'colRun', 'backspaceBack', 'themePick', 'themeRuns'],
    'pwidth': ['noDeadColRows', 'widthCoverage', 'fitPageRow', 'fitPageRuns', 'resetWidthPick', 'resetWidthRuns'],   # (colmenu round 33)
    'pcmplink': ['everOff', 'everOn', 'everRuns'],   # (2026-10-23, lnk40) the comparison banner's evergreen link as a row
    'phlcol': ['hlGone', 'hlFindsOptions'],   # (2026-10-27, fltmenu) Highlight... left the header menu: no row; the word finds Column options...
    'pnestgb': ['pnComboNoParent', 'pnComboNested', 'pnComboHidden', 'pnDigitSafe', 'pnDigitNested', 'pnListThrows', 'pnPivotNone', 'pnComboTop', 'pnPickNoParent', 'pnPickNested', 'pnPickPlain', 'pnPickPre', 'pnPickRuns',
                'pnCopyNoDraw', 'pnCopyNoParent', 'pnCopyNested', 'pnCopyHidden', 'pnCopyPlain', 'pnCopyRuns', 'pnCopyClipOff', 'pnCopySparse', 'pnStatsNoWork'],   # (2026-10-25, nestgb; nestcopy: the pnCopy* checks; neststats: pnStatsNoWork)
    'pdictcol': ['aboutGreyed', 'aboutRow', 'aboutPick', 'aboutRuns'],   # (2026-10-24, dictstat) the column's meaning as a "Which column?" row
    'pview': ['saveHidden', 'saveGreyExact', 'vhHidden', 'consoleHidden', 'editorSave', 'editorVh'],
    'prow': ['noRowItemsIdle', 'rowItems', 'rowFilterRuns', 'rowCopyRow', 'rowBounds', 'rowNoSql'],   # (2026-10-27, fltmenu) rowBounds   # (2026-10-27, copymenu) rowCopyRow; (copymenu 2) rowNoSql
    # (round 4) the box open beside the toolbar in Wolfpack Red; the runner adds inkPalette / inkMatch from a screenshot
    'pshot': ['open', 'inkPalette', 'inkMatch'],
    # (round 4b) the combinations: each opens its dialog with the choice made, applies nothing; the cap
    'pcombo': ['comboGroupRow', 'comboGroupOpens', 'comboGroupLayout', 'comboGroupNotApplied', 'comboPivot', 'comboChart', 'comboCopyOpens',
               'comboPresetRow', 'comboPresetLoads', 'comboRows', 'comboDensity', 'comboCap', 'comboMore'],
    # (round 6) the key from the fields and editors (Esc returns focus + cursor), the platform rule and its
    # labels, the breadcrumb's magnifier, the profile card's row
    'pkeys': ['fieldOpens', 'fieldFocusBack', 'taOpens', 'taFocusBack', 'ceOpens', 'ceFocusBack', 'cmOpens', 'cmCursorBack',
              'macCtrlIgnored', 'macCmdOpens', 'labelMac', 'winMetaIgnored', 'labelWin',
              'crumbIcon', 'crumbSameSize', 'crumbOpens', 'crumbEscFocus', 'crumbEnterOpens', 'plainNoHelpFirst',
              'popBtn', 'popBtnStyle', 'popNoWrap', 'popBtnOpens', 'popEscFocus', 'rowGone',   # (round 10) the bar's button, the row gone
              'quickLabel', 'boltEverywhere', 'escClick', 'escNotInTab', 'backdropClose', 'insideClickStays'],   # (round 11) the name, the bolt, the Esc button, the backdrop
    # (round 6) dashboard.php's stand-in (dash.html): a viewer, then a global admin
    'pdash': ['dashOpens', 'dashRows', 'dashPlaceholder', 'dashNoTools', 'dashRefreshRuns', 'dashFilterRuns', 'dashHelpRow', 'dashGateViewer', 'dashNoFeedback', 'dashRecentWrite', 'dashNoMetricsRow'],
    'pdasha': ['dashGateAdmin', 'dashRecentWrite', 'dashNoMetricsRow'],
    # (round 6) the photograph: the magnifier in the breadcrumb and the card's row, both in the viewport
    'pshot6': ['crumbShown', 'footShown'],
    'pshot10': ['open'],   # (round 10) the card in the dark theme
    'pshot11': ['open'],   # (round 11) the box's top row
    # (round 7) the functions and tags section: fetched once on the first open (never before), the loading row,
    # the rows and their ranking, options, the cap, the anchors, the inserts in the right editor only
    'pfn': ['lazyIndex', 'loadingRow', 'fnRow', 'fetchedOnce', 'cachedInMemory', 'paramQuery', 'namesFirst', 'tagOption', 'tagRows', 'fnMinChars',
            'fnCap', 'fnMore', 'anchorFn', 'anchorTag', 'anchorOption', 'insertSnippet', 'insertCursor', 'insertSql', 'insertOnlySnippet', 'insertOnlySql', 'noInsertFromBody', 'editorFirst'],
    'pshot7f': ['open'], 'pshot7t': ['open'],
    # (round 8) the feedback entry: absent without a saved report, the author's first rendered call reused (the
    # commented-out one ignored), the default spec with the freeze box, nothing sent on open, greyed for the owner
    'pfeed': ['absentWithoutId', 'entryShown', 'authoredSpec', 'authoredNotCommented', 'nothingSent', 'defaultSpec', 'defaultFreeze', 'ownerGreyed'],
    'pshot8': ['open'],
    # (round 9) the rankings on real labels (bug / feedback / fr / grp / exp), the marks inside one word, the box
    # 760px wide with 5px more padding, the one-line footer, the owner's capped reason
    'prank': ['rankBug', 'rankFeedback', 'rankFr', 'rankGrp', 'marksWord', 'rankExp', 'boxWide', 'footerOneLine', 'padding', 'ownerLabelFits'],
    'pshot9': ['open'],
    # (round 12) the admin tools rows: an admin's page (the menu rendered by the real chrome), a viewer's page (no
    # menu), an admin tool page (adm.html = the real status bar)
    'ptools': ['toolsMatchMenu', 'toolsDesc', 'toolsTyped', 'toolOpens', 'toolsAfterReport'],
    'ptoolsv': ['viewerNoTools'],
    'padmin': ['adminStub', 'adminOpens', 'adminRows', 'adminSettings', 'adminPlaceholder', 'adminNoReportTools', 'adminToolOpens', 'adminCardBtn', 'adminEscBack', 'adminNoReportMetrics'],
    'pshot12': ['open'],
    # (round 13) the Dashboards section: the fixture list (what the server returns this caller), matched on title and id,
    # never the owner or a tag for a non-admin (an admin's term reaches both), after Reports, a row's link, one fetch per
    # open from two letters, absent on an empty list, the browser's own history row
    'pdsec': ['dashNoFetchShort', 'dashSection', 'dashHref', 'dashAfterReports', 'dashById', 'dashNotByOwner', 'dashNoTagViewer', 'dashFetchedOnce',
                 'dashByOwnerAdmin', 'dashByTagAdmin', 'dashRefetchNewOpen', 'dashAbsentEmpty', 'dashLocalRow'],
    # (round 13, the round-12 addition) "Metrics for this report (ID)": absent without ?id=, shown to the admin, the owner
    # and the plain viewer (the metrics page's own rule: anyone who can open the report), above the all-reports tool row,
    # opens analytics.php?id= in a new tab
    'pmetr': ['absentWithoutId', 'adminSees', 'aboveAllReports', 'opensRight', 'ownerSees', 'viewerSees'],
    # (round 14) the hand-offs: the two rows for a two-word text leading the empty state (no "nothing matches" note), Find opens with
    # the box untouched, the filter row writes the phrase quoted the grammar's way, a condition row in the grammar's syntax merged
    # into the current filter, < > greyed on a text column and not on a number column, after Actions when actions match, "Filter
    # by COLUMN..." opens the header menu's value list, a hidden column gets neither row
    'phand': ['handRows', 'handLeadsEmpty', 'findNoFilter', 'filterQuoted', 'condRow', 'condMerges', 'typesHonoured', 'handAfterActions', 'filterByOpens', 'hiddenNoRow'],
    'pshot14a': ['open'], 'pshot14b': ['open'],
    # (round 15) the dialogs' own words (wysiwyg -> Copy, cross-tab -> Pivot, collapse -> Group, recipients -> Email; Freeze's label hit
    # above Snapshots' word hit), the View Options rows (the panel's own count, the state notes, selecting opens the editor on the
    # option, focused, unchanged), the console's tabs as rows, the scheduler's own Add once with EMAIL and nothing saved, a viewer: none
    'pvo': ['wysiwyg', 'uiWordsMore', 'uiBelowLabel', 'voCount', 'voState', 'optionOpens', 'optionFocused', 'optionUnchanged', 'tabRows', 'schedRow', 'manageRow', 'viewerNoRows'],
    'pshot15': ['open'],
    # (round 16) Ask Jarvis: the row for an admin and for a grant holder (the server's flag), not for a viewer; a question or SQL puts
    # it first with Ask help second; plain text keeps both at the bottom; the no-match state lists it with the hand-offs; nothing is
    # sent by listing; Enter opens the console on the panel and the panel's own send runs once with the text; the summary box is
    # untouched; the popped-out console takes the text and sends, the main console stays shut
    'pjar': ['rowForAdmin', 'rankQuestion', 'rowForGrant', 'rankSql', 'rankPlain', 'emptyState', 'nothingSentOnOpen', 'noRowViewer', 'noRowNonEditor', 'sendsOnce', 'panelOpens', 'summaryUntouched', 'popOut',
             'askSecond', 'askSecondCode', 'subPaid', 'subHelpOnly', 'viewerAskFirst', 'noPanelAskFirst'],   # (jarvispal, 2026-10-22) the two ask rows together, the paid / free sub-lines; a viewer or no panel: Ask help first
    'pshot16': ['open'],
    # (round 17) a canned reply with valid + invented + hidden-column + gated suggestions: only the valid ones render, four at most, the
    # block never shows as text, the Group chip opens the dialog with V_STATUS and List chosen and applies nothing, a viewer loses the gated
    'pchip': ['validRender', 'unknownDropped', 'hiddenColDropped', 'blockNeverRaw', 'maxFour', 'chipOpensPreselected', 'chipOpensNotApplies', 'viewerGatedDropped'],
    'pshot17': ['open'],
    # (round 18b) every theme of the page's own select has a row, the Theme... action stays first, the current one marked, a name finds
    # its theme, 'density' lists exactly the three densities, 'compact' finds its row, selecting applies the theme through the select's change
    'pthm': ['everyTheme', 'themeActionKept', 'themeCurrentMarked', 'themeByName', 'densityThree', 'densityByName', 'themeApplies'],
    # (round 19b) the answer in the box: Enter on the row keeps the box open on a waiting line (the console stays shut), the answer
    # renders with chips, a script in the reply is text, Continue shows the Q and the A in the panel, Esc while waiting aborts and
    # records nothing, a close that is not Esc leaves the request alive and its answer lands in the panel, a chip closes the box
    'pjip': ['nothingSentUntilEnter', 'inPlace', 'answerRenders', 'answerChips', 'sanitized', 'continueCarries', 'cancelAborts', 'lateLands', 'chipClosesBox'],
    'pshot19': ['open'],
    # (round 20) hidden columns as rows (the menu's own Show items; none when Column Organization is closed), row / page jumps
    # (the page turned through findHost.showRow, the row marked and selected, a bare number lower, out of range greyed, the
    # filter's order, Rows = All fills the row itself), a leading verb routed to the hand-off rows (not mid-text, not a column's name)
    'pshow': ['showAllRow', 'showOneRows', 'showOneRuns', 'showAllRuns', 'allShownGreyed', 'rowNumbers', 'restrictedNone'],
    'pjump': ['rowLabel', 'rowJump', 'hashForm', 'bareLower', 'pageJump', 'lastPage', 'top', 'bottom', 'outOfRange', 'filterOrder', 'lazyFill', 'noPagesWhenAll'],
    'pverb': ['verbFilterCond', 'verbSearchFor', 'verbFind', 'verbLookFor', 'verbWhere', 'verbFilterBy', 'midTextKept', 'colNameKept', 'runsOnEnter'],
    'pshot20': ['open'],
    # (round 21) notes: the journal's composer with the draft (nothing posted), the chart's notes, the selected row's own item;
    # email: the dialog opened with the chips through its tokenizer, the name left for its directory list (a pick there),
    # your view ticked, nothing sent, an address the dialog rejects greyed, several addresses, the Email action's own gate;
    # the misses log: addresses and typed notes redacted in the event and in the beacon
    'pnote': ['journalRow', 'journalPrefilled', 'notPosted', 'chartRow', 'chartPrefill', 'rowRow', 'rowPrefill', 'lazyJournal', 'noSurfaceGreyed'],   # (final sweep) the lazy module, the greyed no-surface row
    'pmail': ['rowValid', 'opensPrefilled', 'directoryList', 'viewLinkTicked', 'nothingSent', 'invalidGreyed', 'multiAddresses', 'nothingSentMulti', 'verbAlone', 'verbAloneOpens', 'partialName', 'partialNameOpens', 'partialAddress', 'partialAddressOpens', 'verbAlwaysLeads', 'gateHidden'],   # (round 22) the row from the first word
    'pmiss': ['emailRedacted', 'noteRedacted', 'plainKept', 'beaconClean', 'partialRedacted'],
    'pshot21': ['open'],
    'pperf': ['wideTyping'],   # (the final sweep) a keystroke on a 315-column header stays fast
    # (2026-10-21, the searchrank follow-up) the Reports section keeps the server's relevance order: live's "EPA" list in its
    # order, the id hits over the mid-word title hits, the browser's own rows merged by the same tiers (a listed row ranked
    # from the server's copy), a viewer's too, a word start never after an accented letter, tag:NAME as before
    'psrank': ['serverOrder', 'idOverMidword', 'mergeOrder', 'viewerTiers', 'accentWord', 'tagLocalFirst'],
    # (round 22) the Top match slot: one row first and preselected for a clear intent, not repeated below; none for a partial word
    'ptop': ['topSend', 'topFilter', 'topFind', 'topRow', 'topNote', 'topUnhide', 'topTheme', 'topDensity', 'topReportId', 'topQuestion', 'noTopAmbiguous', 'fixedOrder', 'topGroupBy', 'topGroupPartial', 'noTopGroupBare'],   # (final sweep) the combination verbs
    # (round 23) the inventory rows open their controls as the buttons do; hidden controls grey with their reason; Table info rows from the
    # server's list through the exported opener, the console's audience only; the end-to-end sweep of the registry (the visible end state)
    'pr23': ['tagGenerator', 'manageData', 'formatSql', 'rowLimit', 'wordWrap', 'tableList', 'popOut', 'shareState', 'profileCard', 'hiddenGreyed', 'tableInfoRows', 'tableInfoByName', 'tableInfoNone', 'tableInfoViewer', 'consoleRowsViewer'],
    'psweep': ['pivotOpens', 'groupOpens', 'downloadOpens', 'copyOpens', 'emailOpens', 'snapshotsOpen', 'saveOpens', 'downloadFormat', 'aiPanel', 'consoleToggles', 'filterFocus', 'findOpens', 'rowHeight', 'helpCenter', 'shortcutSheet', 'versionHistory', 'reportList', 'calcDialog', 'viewLink', 'metricsTab', 'colOptions', 'colFit', 'colReset', 'colMoveEnd'],
}
# (jaredge, 2026-10-23) pjip, the waiting state's edges: the input names no removed option in the Jarvis view; the Esc chip cancels
# as the key does; Backspace back to the list drops a waiting question, another mode's Backspace leaves one left running alone; one
# question at a time (asked again while one is on its way: nothing sent beside it, that one shown waiting and said so, its answer
# landing in the box and once in the panel); a failure handed back inside the call settles it (the next question is sent)
CHK['pjip'] = CHK['pjip'] + ['noStaleActive', 'escChipCancels', 'backCancels', 'backKeepsOther', 'oneAtATime', 'stillSaid', 'stillLands', 'syncFailAsksAgain']
# what this change brings: every browser check (live has no palette) and every static check but the
# guards (what live already gets right: a viewer's Save / Version history / admin controls are absent
# because the palette itself is; the empty-state and idle checks pass for the same reason)
GUARDS = {'L-pview-saveHidden', 'L-pview-vhHidden', 'L-pview-consoleHidden', 'L-prow-noRowItemsIdle', 'L-pmain-emptyRecent', 'L-pmain-hiddenUntilTyped', 'L-pmain-commonAvailOnly'}
NEW_R1 = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - GUARDS | {'S-indexLoads', 'S-sheetRow', 'S-clearHook', 'S-menuItems', 'S-help', 'S-registry', 'S-stubSmall'}   # round 1, live 4bf277a
# round 2 (2026-10-20): the icons are the toolbar's own (live has the unicode glyphs)
NEW_R5 = {'L-pmain-reportsGate', 'S-serverGate', 'S-clientGate'}   # round 5 (live 0736423 searches the repository for everyone)
# round 6: the key everywhere + the platform rule, dashboard.php, the card's row, the magnifier, the bare
# penumbra_vars read. Guards = what live's stub / module already get right on these pages (the key from
# the body opens on dash.html, a viewer's search never leaves the page, the empty state from the key never
# leads with Help; live GREYS the report tools on a dashboard, this round hides them: a new check). The pview editor checks and the round-5 gate
# check are red on live for the real reason the round fixes: the harness now declares penumbra_vars as
# index.php does (a top-level const) and live's module reads window.penumbra_vars, always empty.
GUARDS_R6 = {'L-pdash-dashOpens', 'L-pdash-dashGateViewer', 'L-pkeys-plainNoHelpFirst'}
NEW = ({'L-pkeys-%s' % c for c in CHK['pkeys']} | {'L-pdash-%s' % c for c in CHK['pdash']} | {'L-pdasha-%s' % c for c in CHK['pdasha']} | {'L-pshot6-%s' % c for c in CHK['pshot6']}) - GUARDS_R6
NEW |= {'S-dashStub', 'S-crumbIcon', 'S-popBtn', 'S-cssIcon', 'S-sheetRow', 'S-varsBare', 'S-reportHref', 'S-keyRule', 'S-helpCopy',
        'L-pview-editorSave', 'L-pview-editorVh', 'L-pmain-reportsGate'}
# round 7 (live a453c4e has no functions and tags section): every pfn check (each reads the section or the
# index's state, so none holds on live by accident), the shots, the statics
NEW = {'L-pfn-%s' % c for c in CHK['pfn']} | {'L-pshot7f-open', 'L-pshot7t-open', 'S-fnIndex', 'S-fnLazy', 'S-fnHelp', 'S-fnVer', 'S-fnCss'}
# round 8 (live b2a8751 has no feedback entry): the pfeed checks that read the entry or the form, the shot, the
# statics; absentWithoutId and the dashboard's dashNoFeedback hold on live for want of the entry (guards)
NEW = ({'L-pfeed-%s' % c for c in CHK['pfeed']} - {'L-pfeed-absentWithoutId'}) | {'L-pshot8-open', 'S-feedbackExport', 'S-feedbackHelp', 'S-ownerVar', 'S-feedbackSpec'}
# round 9 (live cc193ad: the 560px box, scattered letters across words still match): every prank check but the
# rankings live already gets right by score (fr: Freeze first; grp: Group first), the shot, the statics
GUARDS_R9 = {'L-prank-rankFr', 'L-prank-marksWord', 'L-prank-rankFeedback', 'L-prank-rankExp', 'L-pshot9-open'}   # (live: Freeze / Download first already; the shot's row is there)
NEW = ({'L-prank-%s' % c for c in CHK['prank']} - GUARDS_R9) | {'L-pfeed-ownerGreyed', 'S-boxWide', 'S-fuzzyWord', 'S-ownerReason'}   # (the owner's reason changed: its check is new again)
# round 10 (live 5eae01f: the card's list row, no bar button): the button checks, the row gone, the photos' footers;
# popNoWrap holds on live (three buttons never wrapped) and is a guard
NEW = ({'L-pkeys-%s' % c for c in ('popBtn', 'popBtnStyle', 'popBtnOpens', 'popEscFocus', 'rowGone', 'labelMac', 'labelWin')}) | {'L-pshot6-footShown', 'L-pshot10-open', 'S-popBtn', 'S-rowGone', 'S-cssIcon', 'S-helpCopy'}   # (the two statics now name the bar's icon rule and the help's Search button)
# round 11 (live 01894ba: "Search", the magnifier, an Esc span): the name on every surface, the bolt, the Esc button,
# the backdrop; insideClickStays and backdropClose hold on live (guards); the statics the names changed
GUARDS_R11 = {'L-pkeys-insideClickStays', 'L-pkeys-backdropClose'}   # (live's backdrop click and its inside click hold; its Esc chip is a span: escNotInTab is new)
NEW = ({'L-pkeys-%s' % c for c in ('quickLabel', 'boltEverywhere', 'escClick', 'escNotInTab', 'popBtn', 'crumbIcon')} | {'L-pfail-escChipCloses', 'L-pshot11-open', 'S-quickName', 'S-bolt', 'S-escButton', 'S-popBtn', 'S-clearHook', 'S-helpCopy'})
# round 12 (live 40ac3bb: no tools rows, no stub on the admin pages): every ptools / padmin check and the statics;
# the viewer's check holds on live for want of the rows (a guard); on live the admin page's box never opens
GUARDS_R12 = {'L-ptoolsv-viewerNoTools'}   # (S-chromePages holds on live too: every tool page mounted the bar before; it guards the structure)
NEW = ({'L-ptools-%s' % c for c in CHK['ptools']} | {'L-padmin-%s' % c for c in CHK['padmin']} | {'L-pshot12-open', 'S-toolsSource', 'S-adminStub'})
# round 13 (live c41bd70: no Dashboards section, the gate inside get_server_reports.php, the list plain can-view): every
# pdsec check, the recents write on the dashboard page, the statics
GUARDS_R13 = {'L-pdsec-dashAbsentEmpty', 'L-pdsec-dashNoFetchShort', 'L-pdsec-dashNoTagViewer', 'L-pdsec-dashNotByOwner',   # (no section on live: nothing to show or fetch)
              'L-pdash-dashNoMetricsRow', 'L-pdasha-dashNoMetricsRow', 'L-padmin-adminNoReportMetrics', 'L-pmetr-absentWithoutId'}   # (no such row on live)
NEW = ({'L-pdsec-%s' % c for c in CHK['pdsec']} | {'L-pmetr-%s' % c for c in CHK['pmetr']}
       | {'L-pdash-dashRecentWrite', 'L-pdasha-dashRecentWrite', 'S-dashGate', 'S-gateFile', 'S-dashClient', 'S-dashRecents', 'S-dashHelp', 'S-metricsRow'}) - GUARDS_R13
# round 14 (live e22c1e0: no hand-offs, no grammar exports): every phand check but the vacuous hidden-column one, the shots, the statics
GUARDS_R14 = {'L-phand-hiddenNoRow'}   # (no rows at all on live)
NEW = ({'L-phand-%s' % c for c in CHK['phand']} | {'L-pshot14a-open', 'L-pshot14b-open', 'S-grammarExports', 'S-handoffs'}) - GUARDS_R14
# round 15 (live: no dialog words, no View Options rows, no tab rows): every pvo check but the viewer's (vacuous on live), the shot, the statics
GUARDS_R15 = {'L-pvo-viewerNoRows'}
NEW = ({'L-pvo-%s' % c for c in CHK['pvo']} | {'L-pshot15-open', 'S-uiWords', 'S-voSource', 'S-tabsSource'}) - GUARDS_R15
# round 16 (live: no Ask Jarvis row, no aiAllowed flag): every pjar check but the vacuous ones (no row = nothing sent, no row for a viewer), the shot, the statics
GUARDS_R16 = {'L-pjar-noRowViewer', 'L-pjar-nothingSentOnOpen'}
NEW = ({'L-pjar-%s' % c for c in CHK['pjar']} | {'L-pshot16-open', 'S-jarvisGate', 'S-jarvisOnce'}) - GUARDS_R16
# round 17 (live: no contract, no chips, no prompt section): every pchip check (each needs chips to exist: none is vacuous on live),
# the shot, the statics
GUARDS_R17 = set()   # (every pchip check needs chips to exist: none is vacuous on live)
NEW = ({'L-pchip-%s' % c for c in CHK['pchip']} | {'L-pshot17-open', 'S-contract', 'S-chipsSafe'}) - GUARDS_R17
# round 18a (live: no time budget in ai_assist.php): the static
NEW = {'S-aiTimeBudget'}
# round 18b (live: no theme rows; the density rows include Report Default): the theme checks and the density count; the action-first
# and compact checks hold on live (no theme rows to sort below; Density: Compact was a row already)
GUARDS_R18B = {'L-pthm-themeActionKept', 'L-pthm-densityByName'}
NEW = ({'L-pthm-%s' % c for c in CHK['pthm']} | {'S-themeSource'}) - GUARDS_R18B
# round 19a (live: the Claude call not streamed, no SSE consumer): the statics
NEW = {'S-aiStream', 'S-aiStreamParse'}
# round 19b (live: the row forwards to the panel; no penumbraAi export): every pjip check but the vacuous one, the shot, the static
GUARDS_R19B = {'L-pjip-nothingSentUntilEnter', 'L-pjip-lateLands'}   # lateLands: live forwards to the panel, so a late answer lands there vacuously
NEW = ({'L-pjip-%s' % c for c in CHK['pjip']} | {'L-pshot19-open', 'S-inPlace', 'S-jarvisGate'}) - GUARDS_R19B   # S-jarvisGate: its text changed this round
# round 20 (live: no Show rows, no jumps, no verb): every check but the vacuous ones (live never strips a verb: a mid-text verb and a
# column's name stay by default), the shot, the static
GUARDS_R20 = {'L-pverb-midTextKept', 'L-pverb-colNameKept'}
NEW = ({'L-pshow-%s' % c for c in CHK['pshow']} | {'L-pjump-%s' % c for c in CHK['pjump']} | {'L-pverb-%s' % c for c in CHK['pverb']} | {'L-pshot20-open', 'S-r20'}) - GUARDS_R20
# round 21 (2026-10-21; live 7857e04 shows the Ask Jarvis row to a viewer who may not edit the report - no console on the
# page - and the row sends that report's SQL and Custom Code): the non-editor check, and the gate's static (its text changed)
NEW = {'L-pjar-noRowNonEditor', 'S-jarvisGate'}   # (live bf5bb8f: superseded by the round below)
# round 21 (live: no note / email rows, no redaction): every check but the vacuous ones (nothing sent when no row ran; the
# gate's absence; a plain text kept as it is), the shot, the static (notPosted / nothingSent want the row to have run: red on live)
GUARDS_R21 = {'L-pmail-nothingSentMulti', 'L-pmail-gateHidden', 'L-pmiss-plainKept'}
NEW = ({'L-pnote-%s' % c for c in CHK['pnote']} | {'L-pmail-%s' % c for c in CHK['pmail']} | {'L-pmiss-%s' % c for c in CHK['pmiss']} | {'L-pshot21-open', 'S-r21'}) - GUARDS_R21
# round 22 (live: the Email row only once a complete address is typed; [email] redaction only): the verb-alone and partial rows, the
# always-lead, the partial's redaction; invalidGreyed and emailRedacted changed their text (new again)
NEW = {'L-pmail-verbAlone', 'L-pmail-verbAloneOpens', 'L-pmail-partialName', 'L-pmail-partialAddress', 'L-pmail-partialAddressOpens', 'L-pmail-verbAlwaysLeads', 'L-pmiss-emailRedacted', 'L-pmiss-partialRedacted', 'S-r22'}   # (partialNameOpens and invalidGreyed hold on live too: a name was left in the input, a finished bad address greyed)
# round 22 too: the slot (live reorders sections per verb instead), and the View Options / console-tab rows on the REAL nesting (live:
# "#editorTabs > ul" finds nothing, the console opens and stops, no tab rows list) - the round-15 checks are new again on this harness
# (manageRow holds on live: the console opens; its tab never switched, which optionOpens / schedRow catch); the statics whose text changed
NEW = NEW | {'L-ptop-%s' % c for c in CHK['ptop']} - {'L-ptop-noTopAmbiguous'} | {'L-pvo-optionOpens', 'L-pvo-optionFocused', 'L-pvo-tabRows', 'L-pvo-schedRow', 'L-pjar-rankQuestion', 'L-pjar-rankSql', 'L-pverb-verbFilterCond', 'S-r21', 'S-tabsSource', 'S-voSource'}
# round 23 (live: none of the inventory rows, no Table info rows, no exported opener, no reportTables): the new rows and the inventory static;
# the sweep's checks hold on live (the rows it drives are older) but for the ones the harness never had an end state for
GUARDS_R23 = {'L-pr23-tableInfoNone', 'L-pr23-tableInfoViewer', 'L-pr23-consoleRowsViewer', 'L-pr23-profileCard'}   # (hiddenGreyed wants the rows: red on live)
NEW = ({'L-pr23-%s' % c for c in CHK['pr23']} | {'S-entryPoints', 'S-r23'}) - GUARDS_R23
# another session's round (psrank, the server's report order) may sit in this suite before its change is live: its checks stay new
GUARDS_SR = {'L-psrank-tagLocalFirst'}   # (2026-10-21, the searchrank follow-up) the tag order: live keeps it already
NEW = NEW - {'L-psrank-%s' % c for c in CHK.get('psrank', [])}   # (psrank is LIVE since 43c1e25: its checks are old ones, green on live)
# the final sweep (live: the journal row needs the module already loaded; no greyed no-surface row; greyed text at 45%)
NEW = {'S-final'}   # (round 24b over live a03b153: r24's checks are old ones now; the static's text changed)
# jarvispal (2026-10-22, live 9ba8017: Ask help at the bottom under a leading Ask Jarvis, the old sub-lines): the two ask rows together,
# the sub-lines, the static; viewerAskFirst / noPanelAskFirst hold on live already (a viewer's question puts Ask help first there too)
GUARDS_JP = {'L-pjar-viewerAskFirst', 'L-pjar-noPanelAskFirst'}
NEW = {'L-pjar-askSecond', 'L-pjar-askSecondCode', 'L-pjar-subPaid', 'L-pjar-subHelpOnly', 'S-askRows'}
# colmenu round 33 (2026-10-22, live ebaabab: the menu's Column widths list and Fit to page live, the palette still on the old menu: no
# Fit to page row, "Reset this column..." pointing at an act the menu dropped). Both rounds are undeployed here: the union is what
# live must show red. Once round 33's palette half is live, drop NEW_W33 from the union (its checks are old ones then).
NEW_W33 = {'L-pwidth-%s' % c for c in CHK['pwidth']} | {'L-psweep-colReset', 'S-widthRows'}
NEW = NEW   # (round 33's palette half is LIVE since 08c66aa, 2026-10-22 14:10: NEW_W33's checks are old ones now, green on live)
# (2026-10-23, lnk40) the comparison banner's evergreen link as a row; jarvispal's set above is still undeployed (red on live)
NEW = NEW | {'L-pcmplink-everOff', 'L-pcmplink-everOn', 'L-pcmplink-everRuns'}
# jarbusy (2026-10-23; live: a plain muted "Thinking..." line carrying a live region of its own, the error in #b00020 on every theme):
# every pjbusy / pjbusyrm check, the shot, the static. The sets above that are still undeployed stay in the union (red on live too).
NEW_JB = {'L-pjbusy-%s' % c for c in CHK['pjbusy']} | {'L-pjbusyrm-%s' % c for c in CHK['pjbusyrm']} | {'L-pjbusyhc-hcMarks', 'L-pshotjb-open', 'S-jarBusy'}
NEW = NEW - {'L-pcmplink-everOff', 'L-pcmplink-everOn', 'L-pcmplink-everRuns'}   # (lnk40's row is LIVE since 425d199, 2026-10-23: its pcmplink checks are old ones now, green on live)
# (jarbusy is LIVE since d6da5bc, 2026-10-23 15:08: NEW_JB's checks are old ones now, green on live; jarvispal's set above is still undeployed)
# jaredge (2026-10-23; live d6da5bc: the Esc chip only closes the box and the answer lands later, Backspace back to the list leaves a
# waiting question running, a second ask runs beside the first, the input names a removed option in the Jarvis view): the pjip checks
# and the static. backKeepsOther and syncFailAsksAgain hold on live already (guards). pjbusy's busyEndsOnClose closes with Ctrl+K now.
NEW_JE = {'L-pjip-%s' % c for c in ('noStaleActive', 'escChipCancels', 'backCancels', 'oneAtATime', 'stillSaid', 'stillLands')} | {'S-jarEdge'}
NEW = NEW   # (jaredge is LIVE since 9120044, 2026-10-23 20:22: NEW_JE's checks are old ones now, green on live; jarvispal's set above is still undeployed)
# (2026-10-24, dictstat) What this column means... (live: no such row) and a column row's own availability
NEW = NEW | {'L-pdictcol-aboutGreyed', 'L-pdictcol-aboutRow', 'L-pdictcol-aboutPick', 'L-pdictcol-aboutRuns'}
NEW = NEW - {'L-pdictcol-aboutGreyed', 'L-pdictcol-aboutRow', 'L-pdictcol-aboutPick', 'L-pdictcol-aboutRuns'}   # (dictstat41 is LIVE since e92fca8, 2026-10-24: old checks now)
# (2026-10-24, hlhead) Highlight... as a "Which column?" row (live: no such row)
NEW = NEW | {'L-phlcol-hlRow', 'L-phlcol-hlPick', 'L-phlcol-hlRuns'}
NEW = NEW - {'L-phlcol-hlRow', 'L-phlcol-hlPick', 'L-phlcol-hlRuns'}   # (hlhead is LIVE since 75458b7, 2026-10-25: old checks now)
# (2026-10-25, nestgb) Group by lists a nested table's columns, never the @@JSON column (live: the column, no sub-columns);
# pnPickPlain, pnDigitSafe and pnPivotNone hold on live (guards). jarvispal's set above is still undeployed (red on live).
NEW = NEW | {'L-pnestgb-%s' % c for c in CHK['pnestgb'] if c not in ('pnPickPlain', 'pnDigitSafe', 'pnPivotNone')} | {'S-nestGroupHelp'}
NEW = NEW - ({'L-pnestgb-%s' % c for c in CHK['pnestgb']} | {'S-nestGroupHelp'})   # (nestgb is LIVE since 3c820e7, 2026-10-25: old checks now; jarvispal's set is still undeployed)
# (2026-10-25, nestcopy) Copy distinct values rows for the nested tables' columns, none for the @@JSON column (live: the column's own
# row, no nested ones); pnCopyPlain holds on live (a guard)
# (v2, the review) pnCopyClipOff new; pnCopyNoDraw holds on live too (a guard: live lists no nested rows, so draws nothing)
NEW = NEW | {'L-pnestgb-%s' % c for c in ('pnCopyNoParent', 'pnCopyNested', 'pnCopyHidden', 'pnCopyRuns', 'pnCopyClipOff', 'pnCopySparse')} | {'S-nestCopyHelp'}
NEW = NEW - ({'L-pnestgb-%s' % c for c in CHK['pnestgb']} | {'S-nestCopyHelp'})   # (nestcopy is LIVE since 934d195, 2026-10-25: old checks now; jarvispal's set is still undeployed)
NEW = NEW | {'L-pnestgb-pnStatsNoWork'}   # (2026-10-25, neststats) the box never works out a nested column's Column stats
NEW = NEW - {'L-pnestgb-pnStatsNoWork'}   # (neststats is LIVE since 9e27a25, 2026-10-26: an old check now)
# (round 3) the group-mode icon: candidate C, and the old drawing's signature (its first line)
GROUP_C_SYMBOL = '<symbol id="pnbi-group" viewBox="0 0 24 24"><path d="m4 4 2.5 2.5L9 4"/><line x1="12" y1="5" x2="20" y2="5"/><line x1="8" y1="9.5" x2="20" y2="9.5"/><line x1="8" y1="13" x2="20" y2="13"/><path d="m6.25 15.25 2.5 2.5-2.5 2.5"/><line x1="12" y1="18" x2="20" y2="18"/></symbol>'
OLD_GROUP_SIG = '<line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>'
def served_files():
    import glob
    out = glob.glob(os.path.join(APP, '*.php')) + glob.glob(os.path.join(APP, 'js', '*.js')) + glob.glob(os.path.join(APP, 'css', '*.css'))
    out += glob.glob(os.path.join(APP, 'help', '*.php')) + glob.glob(os.path.join(APP, 'help', 'topics', '*.php')) + glob.glob(os.path.join(APP, 'help', 'tips', '*.php'))
    return out

# (2026-10-25, digitcol, LIVE since 306438e) pnDigitNested (a column named in digits: the nested tables' columns still listed)
# and pnListThrows (the grouping list throwing, a stub: the box still works) hold on live
NEW = NEW - {'L-pnestgb-pnDigitNested', 'L-pnestgb-pnListThrows'}
# (2026-10-27, copymenu) Copy this row from the selected cell; Copy distinct values for SQL... as a "Which column?" row
NEW = NEW | {'L-prow-rowCopyRow', 'S-copyRowHelp'}
NEW = NEW - {'L-prow-rowCopyRow', 'S-copyRowHelp'}   # (copymenu is LIVE since a8aabf9, 2026-10-27: old checks now)
NEW = NEW | {'L-prow-rowNoSql'}   # (2026-10-27, copymenu 2) the For SQL row gone (live a8aabf9 has it)
NEW = NEW - {'L-prow-rowNoSql'}   # (copymenu 2 is LIVE since 0d19cfd, 2026-10-27: old checks now)
MUTANTS = {
    # --- (2026-10-27, copymenu) no Copy this row from the cell; the Copy list walked as a list of its own (its rows named
    # Copy: ...); the items' own names unread (This value)
    'pc-rowcopy': ([('pal', "['cellFilter', 'cellExclude', 'cellAtLeast', 'cellAtMost', 'cellCopy', 'copyRow', 'copyNestedTable', 'addNote'].indexOf(it.act) < 0", "['cellFilter', 'cellExclude', 'cellAtLeast', 'cellAtMost', 'cellCopy', 'copyNestedTable', 'addNote'].indexOf(it.act) < 0")], ['L-prow-rowCopyRow'], ['prow']),
    'pc-bundle': ([('pal', "                if (it.bundle && it.sub && typeof it.items === 'function' && !it.disabled) {", "                if (false) {")], ['L-prow-rowItems', 'L-prow-rowCopyRow'], ['prow']),
    'pc-long': ([('pal', "                var own = it.long || it.label;", "                var own = it.label;")], ['L-prow-rowItems', 'L-prow-rowCopyRow'], ['prow']),
    # --- (2026-10-25, nestcopy) the @@JSON column's own Copy distinct values row kept; no rows for its tables' columns; the shown
    # columns' tables alone; a row that opens nothing; every shown column's own row gone
    'pc-parent': ([('pal', "        for (var i = out.length - 1; i >= 0; i--) { if (drop[out[i].id]) { out.splice(i, 1); } }\n", "")], ['L-pnestgb-pnCopyNoParent'], ['pnestgb']),
    'pc-none': ([('pal', "        if (hs.length) { nestCopyCombos(out, hs); }   // (2026-10-25, nestcopy) their Copy distinct values rows; none for the @@JSON column\n", "")],
                ['L-pnestgb-pnCopyNested', 'L-pnestgb-pnCopyHidden', 'L-pnestgb-pnCopyRuns'], ['pnestgb']),
    'pc-shown': ([('pal', "        nestCopyPlan().forEach(function (p) {\n            var parent = lab[p.col] || p.col;",
                   "        nestCopyPlan().filter(function (p) { return hs.some(function (t) { return t.getAttribute('data-colname') === p.col; }); }).forEach(function (p) {\n            var parent = lab[p.col] || p.col;")],
                 ['L-pnestgb-pnCopyHidden'], ['pnestgb']),
    'pc-run': ([('pal', "run: function () { var a = A(); if (!a || typeof a.copyNested !== 'function' || !a.copyNested(p.col, s, null)) { toast('Copy is not offered for this column'); } } });",
                 "run: function () { } });")], ['L-pnestgb-pnCopyRuns'], ['pnestgb']),
    'pc-plaindrop': ([('pal', "if (nestedOf(c) !== null) { drop['combo:copydistinct:' + c] = true; }", "drop['combo:copydistinct:' + c] = true;")], ['L-pnestgb-pnCopyPlain'], ['pnestgb']),
    # (v2, the review) the names read by drawing every lazy cell (Copy's own plan); the rows on where the report hides Clipboard
    'pc-draw': ([('main', "        var rows = _pnbNestCopyRows(), out = [];\n        if (!rows.length) return out;\n",
                  "        getNestedColumnPlan();\n        var rows = _pnbNestCopyRows(), out = [];\n        if (!rows.length) return out;\n")], ['L-pnestgb-pnCopyNoDraw'], ['pnestgb']),
    'pc-clip': ([('pal', "        if (document.body.classList.contains('restrict-clipboard')) {\n            out.forEach(function (e) { if (String(e.id).indexOf('combo:copydistinct:') === 0) { e.avail = TOOL_OFF; } });\n        }\n", "")],
                ['L-pnestgb-pnCopyClipOff'], ['pnestgb']),
    # (2026-10-25, neststats) the box opening a nested column's Column stats list in its walk
    'pc-statswalk': ([('pal', "                if (/^neststats-[0-9]+$/.test(String(it.act))) { return; }", "                if (false) { return; }")], ['L-pnestgb-pnStatsNoWork'], ['pnestgb']),
    # (v3, the second review) a shown column whose nested tables start further down keeping its own copy row on
    'pc-sparse': ([('pal', "            e.avail = function () { return colNestedNow(c) ? ", "            e.avail = function () { return false ? ")], ['L-pnestgb-pnCopySparse'], ['pnestgb']),
    # --- (2026-10-25, nestgb) the @@JSON column listed in Group by's "Which column?" again; its tables' columns not listed; every
    # column taken for a nested table; the typed letters' best match left to the shown columns; the column's own Group by rows
    # back; its tables' columns without rows of their own
    'pn-parent': ([('pal', "            if (e.act === 'groupBy' && nestPick(th, q, e, nest, nestSeen)) { return; }\n", "            if (e.act === 'groupBy') { nestPick(th, q, e, nest, nestSeen); }\n")],
                  ['L-pnestgb-pnPickNoParent'], ['pnestgb']),
    'pn-nokids': ([('pal', "            nest.push(seen[key]);\n", "")], ['L-pnestgb-pnPickNested', 'L-pnestgb-pnPickPre', 'L-pnestgb-pnPickRuns'], ['pnestgb']),
    'pn-skipall': ([('pal', "        if (!nf) { return false; }\n        var raw = [], kids = [], parent = colName(th);", "        if (!nf) { return true; }\n        var raw = [], kids = [], parent = colName(th);")],   # (re-anchored, nestcopy)
                   ['L-pnestgb-pnPickPlain'], ['pnestgb']),
    'pn-pre': ([('pal', "        if (nb >= 0 && (best < 0 || items[best].off || nest[nb].score > items[best].score)) {", "        if (false) {")], ['L-pnestgb-pnPickPre'], ['pnestgb']),
    'pn-combo': ([('pal', "            if (canGroupBtn && !nf) {\n", "            if (canGroupBtn) {\n")], ['L-pnestgb-pnComboNoParent'], ['pnestgb']),
    'pn-nocombo': ([('pal', "        if (canGroupBtn && hs.length) { nestCombos(out, gcol); }   // (2026-10-25, nestgb) every nested table's columns, a hidden one's too (none in a pivot)\n", "")],
                   ['L-pnestgb-pnComboNested', 'L-pnestgb-pnComboHidden', 'L-pnestgb-pnComboTop'], ['pnestgb']),
    # (the second review) the nested tables' rows in a pivot view, where no column has Group by rows
    'pn-pivot': ([('pal', "        if (canGroupBtn && hs.length) { nestCombos(out, gcol); }", "        if (canGroupBtn) { nestCombos(out, gcol); }")], ['L-pnestgb-pnPivotNone'], ['pnestgb']),
    # (the review) the shown columns' nested tables alone; both safety nets gone (main.js's catch and the box's own), so the
    # picker's list throwing on a column named in digits breaks the box
    'pn-hidden': ([('pal', "        Array.prototype.forEach.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (t) {\n            var parent = colName(t);",
                    "        headers().forEach(function (t) {\n            var parent = colName(t);")], ['L-pnestgb-pnComboHidden'], ['pnestgb']),
    'pn-nocatch': ([('main', "        } catch (e) { return null; }   // (the picker's own list throws while a column is named in digits: the plain item, as before)\n", "        } catch (e) { throw e; }\n"),
                    ('pal', "        if (!(k in nestMemo)) { try { nestMemo[k] = a.nestedFields(col); } catch (e) { nestMemo[k] = null; } }\n", "        if (!(k in nestMemo)) { nestMemo[k] = a.nestedFields(col); }\n")],
                   ['L-pnestgb-pnListThrows'], ['pnestgb']),   # (2026-10-25, digitcol) a stubbed throw: a column named in digits throws no more
    # (2026-10-25, digitcol) main.js's column list for the search builder back to jQuery's number: no nested rows with such a column
    'dc-sbapi': ([('main', "                // (2026-10-25, digitcol) String: jQuery's data() hands a name in digits (a PIVOT's 2021)\n"
                           "                // back as a NUMBER, and the pickers this list feeds upper-case every name (the grouping\n"
                           "                // dialog's pickers broke on a report with such a column and a nested-table one).\n"
                           "                var dc = String($(this).data('colname'));\n",
                   "                var dc = $(this).data('colname');\n")], ['L-pnestgb-pnDigitNested'], ['pnestgb']),
    # --- (2026-10-24, hlhead) Highlight... : no row on the page
    'hc-norow': ([('pal', "        { id: 'col:highlight', label: 'Highlight...',", "        { id: 'col:highlight', hide: function () { return true; }, label: 'Highlight...',")], ['L-phlcol-hlRow'], ['phlcol']),
    # --- (2026-10-24, dictstat) What this column means... : offered on a report with no dictionary; greyed on one with it; a column
    # row's own availability ignored again (greyed never); the picker's reason generic
    'dc-availalways': ([('pal', "avail: function () { var D = window.PenumbraDict; return (D && D.has()) ? true : 'This report has no data dictionary'; }, needs: function () { return !!window.PenumbraDict; } },", "avail: function () { return true; }, needs: function () { return !!window.PenumbraDict; } },")],
                       ['L-pdictcol-aboutGreyed'], ['pdictcol']),
    'dc-availnever': ([('pal', "avail: function () { var D = window.PenumbraDict; return (D && D.has()) ? true : 'This report has no data dictionary'; }, needs: function () { return !!window.PenumbraDict; } },", "avail: function () { return 'This report has no data dictionary'; }, needs: function () { return !!window.PenumbraDict; } },")],
                      ['L-pdictcol-aboutRow', 'L-pdictcol-aboutPick', 'L-pdictcol-aboutRuns'], ['pdictcol']),
    'dc-colavail': ([('pal', "        ACTIONS.forEach(function (e) { if (e.pick === 'column' && typeof e.avail === 'function' && availNow[e.id] === true) { ", "        ACTIONS.forEach(function (e) { if (false) { ")],
                    ['L-pdictcol-aboutGreyed'], ['pdictcol']),
    'dc-why': ([('pal', "        if (act === 'about') { return 'no entry in the report\\'s data dictionary'; }\n", "")], ['L-pdictcol-aboutPick'], ['pdictcol']),
    # --- (jaredge, 2026-10-23) the Esc chip closing without the cancel; Backspace back leaving a waiting question running; Backspace back
    # cancelling from any mode; the one-at-a-time guard gone; the "still answering" status gone; a handler that ran at once not
    # settling the ask; Esc not forgetting the question it cancelled; the stale aria-activedescendant left on the input
    'je-chipkeeps': ([('pal', "function (e) { e.preventDefault(); jarvisCancel(); close(true); });   // (round 11) the Esc chip is a button", "function (e) { e.preventDefault(); close(true); });   // (round 11) the Esc chip is a button")],
                     ['L-pjip-escChipCancels', 'S-jarEdge'], ['pjip']),
    'je-backkeeps': ([('pal', "        if (mode.kind === 'jarvis') { jarvisCancel(); }   // (jaredge) back to the list from a waiting question drops it, as Esc does (nothing recorded)\n", "")],
                     ['L-pjip-backCancels', 'S-jarEdge'], ['pjip']),
    'je-backany': ([('pal', "        if (mode.kind === 'jarvis') { jarvisCancel(); }   // (jaredge) back", "        { jarvisCancel(); }   // (jaredge) back")], ['L-pjip-backKeepsOther', 'S-jarEdge'], ['pjip']),
    'je-twoasks': ([('pal', "        if (jarvisQ !== null) { setMode({ kind: 'jarvis', q: jarvisQ, state: 'waiting', still: true }, true); return; }", "        if (false) { }")],
                   ['L-pjip-oneAtATime', 'L-pjip-stillSaid', 'L-pjip-stillLands', 'S-jarEdge'], ['pjip']),
    'je-nostill': ([('pal', "        if (waiting && mode.still) { st = JARVIS_STILL; }", "        if (false) { }")], ['L-pjip-stillSaid', 'S-jarEdge'], ['pjip']),
    'je-settled': ([('pal', "        if (!settled) { jarvisReq = req; jarvisQ = text; }", "        { jarvisReq = req; jarvisQ = text; }")], ['L-pjip-syncFailAsksAgain', 'S-jarEdge'], ['pjip']),
    'je-qkept': ([('pal', "        jarvisReq = null; jarvisQ = null;\n    }\n", "        jarvisReq = null;\n    }\n")], ['L-pjip-lateLands'], ['pjip']),
    'je-staleactive': ([('pal', "        ui.input.removeAttribute('aria-activedescendant');   // (jaredge) the option it named went with the list\n", "")], ['L-pjip-noStaleActive', 'S-jarEdge'], ['pjip']),
    # --- (jarbusy, 2026-10-23) the busy card: the old plain line back; nothing animated; no reduced-motion form; a reduced-motion form
    # with no bar; a live region of its own; nothing said; said again on every render; no aria-busy; the card left on after the answer /
    # in place of the error; the card not brought into view; the words faded by opacity; the dots in a faint tint; the hint's old
    # opacity; the error's old colour; the marks lost in High Contrast (forced colours)
    'jb-plainline': ([('pal', "        if (waiting) { html += jarvisBusyHtml(); }\n", "        if (waiting) { html += '<div class=\"pnb-pal-ai-wait\" aria-live=\"polite\">Thinking&hellip; <span class=\"pnb-pal-ai-hint\">Esc cancels</span></div>'; }\n")],
                     ['L-pjbusy-busyShown', 'L-pjbusy-busyMoves', 'L-pjbusy-busySaidOnce', 'L-pjbusy-busyEndsOnAnswer', 'L-pjbusy-busyEndsOnCancel', 'L-pjbusy-busyThemes', 'L-pjbusyrm-rmStill', 'L-pjbusyrm-rmObvious', 'S-jarBusy'], ['pjbusy', 'pjbusyrm']),
    'jb-still': ([('pcss', " animation: pnbPalAiBar 1.3s ease-in-out infinite;", ""), ('pcss', " animation: pnbPalAiDot 1.1s ease-in-out infinite;", ""), ('pcss', "    animation: pnbPalAiShimmer 1.6s linear infinite;\n", "")],
                 ['L-pjbusy-busyMoves'], ['pjbusy']),
    'jb-norm': ([('pcss', "@media (prefers-reduced-motion: reduce) {\n    .pnb-pal-ai-bar i {", "@media (prefers-reduced-motion: no-preference) and (max-width: 1px) {\n    .pnb-pal-ai-bar i {")],
                ['L-pjbusyrm-rmStill', 'L-pjbusyrm-rmObvious', 'S-jarBusy'], ['pjbusyrm']),
    'jb-rmnobar': ([('pcss', "    .pnb-pal-ai-bar i { animation: none; width: 100%;", "    .pnb-pal-ai-bar i { animation: none; width: 0;")], ['L-pjbusyrm-rmObvious', 'S-jarBusy'], ['pjbusyrm']),
    'jb-twolive': ([('pal', "<div class=\"pnb-pal-ai-wait is-busy\">", "<div class=\"pnb-pal-ai-wait is-busy\" aria-live=\"polite\">")], ['L-pjbusy-busySaidOnce'], ['pjbusy']),
    'jb-nosay': ([('pal', "        var st = mode.state === 'done' ? 'answered' : (waiting ? JARVIS_BUSY : '');\n", "        var st = mode.state === 'done' ? 'answered' : '';\n")], ['L-pjbusy-busySaidOnce'], ['pjbusy']),
    'jb-resay': ([('pal', "        if (ui.status.textContent !== st) { status(st); }", "        status(st);")], ['L-pjbusy-busySaidOnce', 'S-jarBusy'], ['pjbusy']),
    'jb-nobusyattr': ([('pal', "html = '<div class=\"pnb-pal-ai\"' + (waiting ? ' aria-busy=\"true\"' : '') + '>", "html = '<div class=\"pnb-pal-ai\"' + '>")], ['L-pjbusy-busyMarked'], ['pjbusy']),
    'jb-stays': ([('pal', "        if (waiting) { html += jarvisBusyHtml(); }\n", "        if (waiting || mode.state === 'done') { html += jarvisBusyHtml(); }\n")], ['L-pjbusy-busyEndsOnAnswer'], ['pjbusy']),
    'jb-errstays': ([('pal', "        if (waiting) { html += jarvisBusyHtml(); }\n", "        if (waiting || mode.state === 'failed') { html += jarvisBusyHtml(); }\n")], ['L-pjbusy-busyEndsOnError', 'L-pjbusy-errorReadable'], ['pjbusy']),
    'jb-noview': ([('pal', "        if (waiting) { var card = ui.body.querySelector('.pnb-pal-ai-busy'); if (card && typeof card.scrollIntoView === 'function') { card.scrollIntoView({ block: 'nearest' }); } }", "")], ['L-pjbusy-busyInView'], ['pjbusy']),
    'jb-faded': ([('pcss', ".pnb-pal-ai-busytext { font-size: 13px; font-weight: 600; }", ".pnb-pal-ai-busytext { font-size: 13px; font-weight: 600; opacity: 0.6; }")], ['L-pjbusy-busyNoFade'], ['pjbusy']),
    'jb-faintdots': ([('pcss', "border-radius: 50%; background: var(--brand-text, var(--brand-primary, #336699));", "border-radius: 50%; background: color-mix(in srgb, var(--brand-primary, #336699) 30%, transparent);")], ['L-pjbusy-busyThemes', 'L-pjbusyrm-rmThemes'], ['pjbusy', 'pjbusyrm']),
    'jb-hintfade': ([('pcss', ".pnb-pal-ai-hint { margin-left: auto; font-size: 11px; white-space: nowrap; color: color-mix(in srgb, var(--text-muted, #666) 65%, var(--text-main, #222)); }",
                              ".pnb-pal-ai-hint { margin-left: auto; font-size: 11px; white-space: nowrap; color: var(--text-muted, #666); opacity: .8; }")], ['L-pjbusy-busyNoFade', 'S-jarBusy'], ['pjbusy']),
    'jb-oldred': ([('pcss', ".pnb-pal-ai-wait.pnb-pal-ai-err { color: var(--accent-danger, #c62828); }", ".pnb-pal-ai-wait.pnb-pal-ai-err { color: var(--danger, #b00020); }")], ['L-pjbusy-errorReadable', 'S-jarBusy'], ['pjbusy']),
    'jb-nohc': ([('pcss', "    .pnb-pal-ai-bar i, .pnb-pal-ai-dots i { forced-color-adjust: none; background-color: Highlight; }\n", "")], ['L-pjbusyhc-hcMarks', 'S-jarBusy'], ['pjbusyhc']),
    # --- (2026-10-23, lnk40) the evergreen row: none; offered with no evergreen button on the banner; a row that clicks nothing
    'e-noever': ([('pal', "        { id: 'cmpevergreen', label:", "        { id: 'cmpevergreen', hide: function () { return true; }, label:")], ['L-pcmplink-everOff', 'L-pcmplink-everOn', 'L-pcmplink-everRuns'], ['pcmplink']),
    'e-always': ([('pal', "return bannerBtn('.snap-banner-link-evergreen') ? true : 'Only in a comparison", "return true || bannerBtn('.snap-banner-link-evergreen') ? true : 'Only in a comparison")], ['L-pcmplink-everOff'], ['pcmplink']),
    'e-norun': ([('pal', "          run: function () { click(bannerBtn('.snap-banner-link-evergreen')); }, needs: has('snapshotBtn') },", "          run: function () { }, needs: has('snapshotBtn') },")], ['L-pcmplink-everRuns'], ['pcmplink']),
    # --- (colmenu round 33) the width rows: no Fit columns to the page row; the row running Fit all; the column row back on
    # the act the menu dropped; Fit to page neither an entry nor an exemption
    'w-nofitpage': ([('pal', "        { id: 'fitpage', label: 'Fit all column widths to page',", "        { id: 'zzfitpage', hide: function () { return true; }, label: 'Zz',")],
                    ['L-pwidth-fitPageRow', 'L-pwidth-fitPageRuns', 'S-widthRows'], ['pwidth']),
    'w-fitall': ([('pal', "          run: function () { W().fitPage(firstTh()); }, needs: function () { return !!(W() && W().fitPage); } },",
                          "          run: function () { W().fitAll(firstTh()); }, needs: function () { return !!(W() && W().fitPage); } },")],
                 ['L-pwidth-fitPageRuns', 'L-pwidth-resetWidthRuns'], ['pwidth']),
    'w-deadreset': ([('pal', "act: 'resetWidth', icon: { pal: 'width' }", "act: 'reset', icon: { pal: 'width' }")],
                    ['L-pwidth-noDeadColRows', 'L-pwidth-widthCoverage', 'L-pwidth-resetWidthPick'], ['pwidth']),
    'w-noexempt': ([('pal', "fitPage: 'a top-level entry (Fit all column widths to page)', ", '')], ['L-pwidth-widthCoverage'], ['pwidth']),
    # --- (2026-10-21, the searchrank follow-up) the Reports order: live's title-weighted score alone; no server place (the
    # tier, then the score); no tier (the place, then the score); no word-start tier; tag:NAME ranked by tier and place; a
    # listed row ranked from the browser's copy (its stale title); an accented letter read as a word boundary
    'q-scoreonly': ([('pal', "        out.sort(function (a, b) { return (a.tier - b.tier) || (a.place - b.place) || (b.m.score - a.m.score); });\n", "        out.sort(function (a, b) { return b.m.score - a.m.score; });\n")],
                    ['L-psrank-serverOrder', 'L-psrank-idOverMidword', 'L-psrank-mergeOrder', 'L-psrank-viewerTiers', 'L-psrank-accentWord'], ['psrank']),
    'q-noplace': ([('pal', "return (a.tier - b.tier) || (a.place - b.place) || (b.m.score - a.m.score);", "return (a.tier - b.tier) || (b.m.score - a.m.score);")], ['L-psrank-serverOrder', 'L-psrank-mergeOrder'], ['psrank']),
    'q-notier': ([('pal', "return (a.tier - b.tier) || (a.place - b.place) || (b.m.score - a.m.score);", "return (a.place - b.place) || (b.m.score - a.m.score);")], ['L-psrank-mergeOrder', 'L-psrank-viewerTiers', 'L-psrank-accentWord'], ['psrank']),
    'q-wordstart': ([('pal', "        if (wordAt(id, t) || wordAt(title, t)) { return 2; }\n", "")], ['L-psrank-viewerTiers', 'L-psrank-accentWord'], ['psrank']),
    'q-tagtier': ([('pal', "h.tier = tag ? 0 : reportTier(q, s ? s.r : h.r); h.place = (s && !tag) ? s.at : reportHits.length;", "h.tier = reportTier(q, s ? s.r : h.r); h.place = s ? s.at : reportHits.length;")], ['L-psrank-tagLocalFirst'], ['psrank']),
    'q-localtier': ([('pal', "reportTier(q, s ? s.r : h.r)", "reportTier(q, h.r)")], ['L-psrank-mergeOrder'], ['psrank']),
    'q-asciiword': ([('pal', "return /[0-9]/.test(c) || c.toLowerCase() !== c.toUpperCase();", "return /[a-z0-9]/.test(c);")], ['L-psrank-accentWord'], ['psrank']),
    # --- the module: availability never read (every entry available)
    'b-noavail': ([('pal', "availNow[e.id] = e.pick === 'column' ? (headers().length ? true : 'No table is loaded') : e.avail();", "availNow[e.id] = true;")],
                  ['L-pmain-greyReason', 'L-pmain-greyWhenTyped'], ['pmain']),
    # Tab leaves the box (no section step, no focusin guard)
    'b-tabout': ([('pal', "        if (k === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); sectionStep(e.shiftKey ? -1 : 1); return; }\n", ""),
                  ('pal', "        document.addEventListener('focusin', trap, true);\n", "")],
                 ['L-pmain-trapTab', 'L-pmain-trapFocusin'], ['pmain']),
    # --- the stub: a failed script load hangs on "Loading..."
    'b-hang': ([('stub', "        s.onerror = fail;\n", "        s.onerror = null;\n")], ['L-pfail-failLine'], ['pfail']),
    # the authoring gate removed
    'b-nogate': ([('pal', "    function gated(e) { return (e.gate === 'admin' && !isAdmin()) || (e.gate === 'global' && !isGlobal()); }",
                   "    function gated(e) { return false; }")], ['L-pview-saveHidden', 'L-pview-vhHidden', 'L-pview-saveGreyExact'], ['pview']),
    # the picker offers what the menu refuses
    'b-nofreeze': ([('pal', "            var off = !found || found.disabled, why = found ? (found.why || '') : absentWhy(e.act, th, pos, n);",
                     "            var off = false, why = found ? (found.why || '') : absentWhy(e.act, th, pos, n);")], ['L-ppick-pickFreezeOff'], ['ppick']),
    # recents never kept
    'b-norecent': ([('pal', "            var v = readRecent().filter(function (x) { return x !== id; });\n            v.unshift(id);\n", "            var v = [];\n")],
                   ['L-pmain-recentsStored', 'L-pmain-recentsShown'], ['pmain']),
    # the keys typed before the module arrived are dropped
    'b-nobuffer': ([('pal', "        var text = shell && shell.input ? shell.input.value : '', opener = shell ? shell.opener : null;",
                     "        var text = '', opener = shell ? shell.opener : null;")], ['L-pcold-keysKept'], ['pcold']),
    # Esc leaves the focus where the box was
    'b-escfocus': ([('pal', "        if (restore && u.opener && u.opener.isConnected && u.opener !== document.body) {", "        if (false) {")], ['L-pmain-escFocus'], ['pmain']),
    # a question is never promoted
    'b-noquestion': ([('pal', "    function isQuestion(q) { return /\\?\\s*$/.test(q) || q.trim().split(/\\s+/).length >= 3; }", "    function isQuestion(q) { return false; }")],
                     ['L-pmain-questionFirst'], ['pmain']),
    # the Ask page gets an empty question
    'b-askdrop': ([('pal', "                box.value = q;\n", "                box.value = '';\n")], ['L-pmain-askSubmits'], ['pmain']),
    # row-level items never listed
    'b-norow': ([('pal', "        var cell = activeCell(), out = [];\n        if (!cell) { return out; }", "        var cell = activeCell(), out = [];\n        if (true) { return out; }")],
                ['L-prow-rowItems'], ['prow']),
    # --- the header menu: no items for the palette
    'j-noitems': ([('menu', "        items: function (th, cell) { return (th && api()) ? flatItems(buildItems(th, false, cell || null)) : []; },",
                    "        items: function (th, cell) { return []; },")], ['L-ppick-colItems', 'L-ppick-pickFreezeOff'], ['ppick']),
    # --- main.js (CRLF): the "?" sheet row gone; the clear hook gone
    'm-nosheet': ([('main', "            window.PenumbraPalette ? row([window.PenumbraPalette.keyLabel ? window.PenumbraPalette.keyLabel() : 'Ctrl+K'], 'Quick actions: run an action, a column\\'s actions, a report or a help topic') : ''\n", "            ''\n")],
                  ['L-pmain-sheetRow'], ['pmain']),
    # --- (round 2) the icons: a toolbar entry without its twin; a twin that is another control's; twins drawn as nothing
    'i-notwin': ([('pal', "{ id: 'download', label: 'Download the report data', sub: 'Excel, PDF, CSV, TSV, JSON', keys: ['Ctrl', 'Shift', 'D'], icon: { twin: 'downloadBtn', use: 'pnbi-download' },", "{ id: 'download', label: 'Download the report data', sub: 'Excel, PDF, CSV, TSV, JSON', keys: ['Ctrl', 'Shift', 'D'], icon: { use: 'pnbi-download' },")], ['S-iconsTwin'], []),
    'i-othertwin': ([('pal', "{ id: 'pivot', label: 'Pivot table builder', keys: ['Ctrl', 'Shift', 'P'], icon: { twin: 'pivotBtn', use: 'pnbi-pivot' },", "{ id: 'pivot', label: 'Pivot table builder', keys: ['Ctrl', 'Shift', 'P'], icon: { twin: 'visualizeBtn', use: 'pnbi-visualize' },")], ['S-iconsTwin', 'L-pmain-iconsTwin'], ['pmain']),
    'i-nodraw': ([('pal', "        if (ic.twin) { var t = twinSvg(ic.twin); if (t) { return t; } }\n", "")], ['L-pmain-iconsTwin'], ['pmain']),
    # --- (round 2b) a key dispatched on the window throws in the handler
    'w-winkey': ([('pal', "var k = e.key, inBox = (e.target && typeof e.target === 'object' && e.target.nodeType === 1) ? ui.box.contains(e.target) : false;", "var k = e.key, inBox = ui.box.contains(e.target);")], ['L-pmain-windowKey'], ['pmain']),
    # --- (round 3) the old group drawing back in the sprite; a copy of it left in a served file
    'g-old': ([('index', GROUP_C_SYMBOL, '<symbol id="pnbi-group" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' + OLD_GROUP_SIG + '</symbol>')], ['S-groupIcon', 'L-pmain-groupIcon'], ['pmain']),
    'g-copy': ([('pal', "    P.EXEMPT = {", "    // (old) <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>" + OLD_GROUP_SIG + "\n    P.EXEMPT = {")], ['S-groupIcon'], []),
    # --- (round 4) the box's icons without the toolbar's stroke rule: black blobs again
    'i-nostyle': ([('pcss', ".pnb-pal-svg:not(.pnb-pal-twin) { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }\n", "")], ['L-pmain-iconsRendered', 'L-pshot-inkPalette'], ['pmain', 'pshot']),
    # --- (round 4b) the combinations: Group applies instead of opening; the column pick dropped; the pivot
    # opener given no column; Rows per page a no-op; the preset row never picked; the cap gone
    'c-applies': ([('pal', "            if (layout) {\n                var r = document.querySelector('#groupLayoutRow input[name=\"groupLayoutChoice\"][value=\"' + layout + '\"]');",
                   "            click(el('confirmGroupingBtn'));\n            if (layout) {\n                var r = document.querySelector('#groupLayoutRow input[name=\"groupLayoutChoice\"][value=\"' + layout + '\"]');")],
                  ['L-pcombo-comboGroupNotApplied'], ['pcombo']),
    'c-nopre': ([('pal', "            if (it) { click(it); }\n", "")], ['L-pcombo-comboGroupOpens'], ['pcombo']),
    'c-pivotcol': ([('pal', "run: function () { a.pivotColumn(col); } }); }", "run: function () { a.pivotColumn(''); } }); }")], ['L-pcombo-comboPivot'], ['pcombo']),
    'c-rows': ([('pal', "                    run: function () { rs.value = o.value; if (hasJQ)", "                    run: function () { if (hasJQ)")], ['L-pcombo-comboRows'], ['pcombo']),
    'c-preset': ([('pal', "            }, function (row) { click(row); }, 4000);", "            }, function (row) { }, 4000);")], ['L-pcombo-comboPresetLoads'], ['pcombo']),
    'c-nocap': ([('pal', "        if (acts.length > cap) {", "        if (false) {")], ['L-pcombo-comboCap'], ['pcombo']),
    # --- (round 5) the report discovery gate: the client gate gone (every user's text goes to the server);
    # the server gate lifted; the STATE_DATA / recipients surfaces back for non-admins
    'b-noclientgate': ([('pal', "        if (!reportDiscoveryAllowed()) { return; }\n", "")], ['L-pmain-reportsGate', 'S-clientGate'], ['pmain']),
    's-nogate': ([('disc', "        return (bool)$isAdmin;\n", "        return true;\n")], ['S-serverGate', 'S-dashGate'], []),   # (round 13: the gate moved; lifting it opens both lists)
    's-deepback': ([('gsr', "function penumbraReportTextMatchSql($isAdmin, $p, $searchPattern, $matchTerm) {\n    if (!penumbraReportDiscoveryAllowed($isAdmin)) {", "function penumbraReportTextMatchSql($isAdmin, $p, $searchPattern, $matchTerm) {\n    if (false) {")], ['S-serverGate'], []),
    'm-noclear': ([('main', "        try { if (window.PenumbraPalette && typeof window.PenumbraPalette.clearRecent === 'function') window.PenumbraPalette.clearRecent(); } catch(e) {}\n", "")],
                  ['L-pmain-clearPrefs'], ['pmain']),
    # --- (round 6) the stub: Ctrl+K taken on a Mac (and the Windows key on Windows); the CodeMirror case
    # missed (the key stands down inside an editor); no focus back at all
    'k-mac': ([('stub', "        return mac() ? (e.metaKey && !e.ctrlKey) : (e.ctrlKey && !e.metaKey);\n", "        return e.ctrlKey || e.metaKey;\n")],
              ['L-pkeys-macCtrlIgnored', 'L-pkeys-winMetaIgnored', 'S-keyRule'], ['pkeys']),
    'k-nocm': ([('stub', "        if (!hot(e)) { return; }\n", "        if (!hot(e) || (e.target && e.target.closest && e.target.closest('.CodeMirror'))) { return; }\n")],
               ['L-pkeys-cmOpens'], ['pkeys']),
    'k-norefocus': ([('stub', "            if (w && w.CodeMirror && typeof w.CodeMirror.focus === 'function') { w.CodeMirror.focus(); return; }\n            el.focus({ preventScroll: true });\n", "")],
                    ['L-pkeys-fieldFocusBack', 'L-pkeys-cmCursorBack'], ['pkeys']),
    # the module: window.penumbra_vars again (empty on live); the Help Center never leads; no dashboard rows;
    # a report row opens dashboard.php?id=
    'b-winvars': ([('pal', "        try { if (typeof penumbra_vars !== 'undefined' && penumbra_vars) { return penumbra_vars; } } catch (e0) { }\n", "")],
                  ['L-pview-editorSave', 'L-pmain-reportsGate', 'S-varsBare'], ['pview', 'pmain']),
    'b-nohelpfirst': ([('pal', "            if (ui.from === 'crumb' && hc && availNow[hc.id] === true) {", "            if (false) {")], ['L-pkeys-crumbOpens'], ['pkeys']),
    'b-dashrows': ([('pal', "        dashActs = onDashboard() ? dashEntries() : [];\n", "        dashActs = [];\n")], ['L-pdash-dashRows'], ['pdash']),
    'd-reporthref': ([('pal', "window.location.assign('index.php?id=' + encodeURIComponent(h.r.id));", "window.location.assign('?id=' + encodeURIComponent(h.r.id));")], ['S-reportHref'], []),
    # the pages: no stub on dashboard.php; no magnifier; no card row; the sheet row with a fixed label
    'd-nostub': ([('dash', "<script defer src=\"js/penumbra_palette_boot.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_palette_boot.js'); ?>\"", "<script defer src=\"js/zz_gone.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_palette_boot.js'); ?>\"")],
                 ['S-dashStub'], []),
    'x-noicon': ([('index', "$pnbPaletteIconHtml = $pnbPaletteOn ? '<span id=\"searchPaletteIcon\"", "$pnbPaletteIconHtml = ''; $pnbZz = $pnbPaletteOn ? '<span id=\"zzNoIcon\"")],
                 ['L-pkeys-crumbIcon', 'S-crumbIcon'], ['pkeys']),
    # (round 10) no bar button; the list row back; a label too long for the bar
    'x-nobtn': ([('index', "<a href=\"#\" id=\"sbPaletteBtn\" data-pnb-palette=\"open\" role=\"button\"", "<a href=\"#\" id=\"zzNoBtn\" data-zz=\"open\" role=\"button\"")],
                ['L-pkeys-popBtn', 'S-popBtn'], ['pkeys']),
    'x-rowback': ([('index', "            <div id=\"sbCurrentSection\" style=\"display:none;\">",
                    "            <a href=\"#\" class=\"sb-recent-row sb-pal-row\" id=\"sbPaletteRow\" data-pnb-palette=\"open\" role=\"button\"><span class=\"sb-recent-main\"><span class=\"rt\">Search actions and reports</span></span></a>\n            <div id=\"sbCurrentSection\" style=\"display:none;\">")],
                  ['L-pkeys-rowGone', 'S-rowGone'], ['pkeys']),
    'x-longlabel': ([('index', "</svg> Quick actions</a>", "</svg> Quick actions, columns, reports and help</a>")], ['L-pkeys-popNoWrap'], ['pkeys']),
    # --- (round 11) an old "Search" label left; the Esc chip not clickable; the backdrop click ignored; a magnifier left
    'n-oldlabel': ([('index', "</svg> Quick actions</a>", "</svg> Search</a>")], ['L-pkeys-quickLabel', 'S-quickName'], ['pkeys']),
    'n-escspan': ([('pal', "        ui.esc.addEventListener('click', function (e) { e.preventDefault();", "        if (0) ui.esc.addEventListener('click', function (e) { e.preventDefault();")], ['L-pkeys-escClick'], ['pkeys']),   # (jaredge: the line's start, before and after the chip's cancel)
    'n-nobackdrop': ([('pal', "        veil.addEventListener('mousedown', function (e) { if (e.target === veil) { e.preventDefault(); jarvisCancel(); close(true); } });", "        // (no backdrop click)")], ['L-pkeys-backdropClose'], ['pkeys']),
    # --- (round 12) a hand-copied list missing a tool; the card's admin gate gone (a viewer's page carries the
    # menu, so the viewer sees the rows); the stub missing from the admin pages' bar
    't-handlist': ([('chrome', "    echo '<script>window.PENUMBRA_ADMIN_TOOLS = ' . json_encode($rows, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) . ';</script>';",
                     "    echo '<script>window.PENUMBRA_ADMIN_TOOLS = ' . json_encode(array_slice($rows, 0, 6), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) . ';</script>';")],
                   ['L-ptools-toolsMatchMenu', 'S-toolsSource'], ['ptools']),
    't-nogate': ([('index', "                <?php if ($sb_is_admin): ?>\n                <span class=\"pnb-admsplit\">", "                <?php if (true): ?>\n                <span class=\"pnb-admsplit\">")],
                 ['L-ptoolsv-viewerNoTools'], ['ptoolsv']),
    't-nostub': ([('chrome', "<script defer src=\"js/penumbra_palette_boot.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_palette_boot.js'); ?>\"", "<script defer src=\"js/zz_gone.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_palette_boot.js'); ?>\"")],
                 ['L-padmin-adminStub', 'S-adminStub'], ['padmin']),
    'n-magnifier': ([('index', '<svg class="pnb-foot-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#pnbi-quick"/></svg> Quick actions</a>',
                      '<svg class="pnb-foot-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20" y2="20"/></svg> Quick actions</a>')],
                    ['L-pkeys-boltEverywhere', 'S-bolt'], ['pkeys']),
    'm-nolabel': ([('main', "row([window.PenumbraPalette.keyLabel ? window.PenumbraPalette.keyLabel() : 'Ctrl+K'], 'Quick actions:", "row(['Ctrl+K'], 'Quick actions:")],
                  ['L-pkeys-labelMac', 'S-sheetRow'], ['pkeys']),
    # --- (round 7) the index missing a function; a wrong anchor; the insert in the wrong editor; the index
    # fetched at module load; fetched by the idle prefetch; no cap; a one-letter search
    'f-missing': ([('fni', "    foreach ((array)$R['functions'] as $id => $f) {\n", "    foreach ((array)$R['functions'] as $id => $f) {\n        if ($id === 'sum') { continue; }\n")],
                  ['S-fnIndex', 'L-pfn-fnRow'], ['pfn']),
    'f-anchor': ([('fni', "'params' => $params, 'topic' => 'optionsHelpLightbox', 'anchor' => (string)$id,", "'params' => $params, 'topic' => 'optionsHelpLightbox', 'anchor' => 'fn-' . $id,")],
                 ['S-fnIndex', 'L-pfn-anchorFn'], ['pfn']),
    'f-wrongeditor': ([('pal', "            var can = ed.kind === 'snippet';\n", "            var can = !!ed.cm;\n")], ['L-pfn-insertOnlySnippet'], ['pfn']),
    'f-eager': ([('pal', "    function editorKind() {\n", "    loadFnIndex();\n    function editorKind() {\n")], ['S-fnLazy', 'L-pfn-lazyIndex'], ['pfn']),
    'f-prefetch': ([('stub', "            state = 'ready';\n", "            state = 'ready';\n            if (typeof P.loadFnIndex === 'function') { P.loadFnIndex(); }\n"),
                    ('pal', "    P.fnState = function () { return fnState; };   // (round 7)\n", "    P.fnState = function () { return fnState; };   // (round 7)\n    P.loadFnIndex = loadFnIndex;\n")],
                   ['S-fnLazy', 'L-pfn-lazyIndex'], ['pfn']),
    'f-nocap': ([('pal', "        if (out.length > cap) {\n", "        if (false) {\n")], ['L-pfn-fnCap'], ['pfn']),
    'f-short': ([('pal', "        if (q.length < 2) { return []; }\n        if (fnState === 'loading')", "        if (q.length < 1) { return []; }\n        if (fnState === 'loading')")], ['L-pfn-fnMinChars'], ['pfn']),
    # --- (round 8) the export missing; the owner check skipped; a send on open; the authored spec ignored
    'e-noexport': ([('main', "    window.penumbraOpenFeedbackDialog = penumbraOpenFeedbackDialog;", "    // (gone)")], ['S-feedbackExport', 'L-pfeed-entryShown'], ['pfeed']),
    'e-noowner': ([('pal', "              return vars().isReportOwner ? 'You own this report, so feedback would come to you' : true;\n", "              return true;\n")], ['L-pfeed-ownerGreyed'], ['pfeed']),
    'e-sendonopen': ([('pal', "          run: function () { var a = authoredFeedback(); window.penumbraOpenFeedbackDialog(a ? a.spec : FEEDBACK_DEFAULT_SPEC, a ? a.label : 'Send feedback to the report owner'); },",
                      "          run: function () { var a = authoredFeedback(); window.penumbraOpenFeedbackDialog(a ? a.spec : FEEDBACK_DEFAULT_SPEC, a ? a.label : 'Send feedback to the report owner'); setTimeout(function () { var f = document.querySelector('.pf-modal form'); if (f) { var t = f.querySelector('textarea'); if (t) { t.value = 'sent on open'; } f.requestSubmit(); } }, 400); },")],
                     ['L-pfeed-nothingSent'], ['pfeed']),
    'e-noauthored': ([('pal', "        var a = document.querySelector('#reportSnippetOutput a.snippet-action[data-action-name=\"feedback\"], #mainReportSubtitle a.snippet-action[data-action-name=\"feedback\"]');\n", "        var a = null;\n")],
                     ['L-pfeed-authoredSpec'], ['pfeed']),
    # --- (round 9) the loose scoring back: letters picked across words match again
    'b-loosefuzzy': ([('pal', "        if (q.length >= 3) {\n            var first = idx[0], span = t.slice(first, idx[idx.length - 1] + 1);", "        if (false) {\n            var first = idx[0], span = t.slice(first, idx[idx.length - 1] + 1);")],
                     ['L-prank-rankBug', 'S-fuzzyWord'], ['prank']),
    # --- (round 13) the dashboard sibling opened on its own; the list's cut removed; the owner reached by a non-admin's term;
    # the list fetched on every keystroke
    'd-nogate': ([('disc', "        return penumbraReportDiscoveryAllowed($isAdmin);\n", "        return true;\n")], ['S-dashGate'], []),
    'd-listungated': ([('mdash', "            if (!dashListVisible($row, $isAdmin, $currentUserKey, $opened)) { continue; }   // (round 13) the discovery gate: a non-admin lists owned / opened only\n", "")], ['S-dashGate'], []),
    'd-deftext': ([('pal', "match(q, d.title, d.id + (admin ? ' ' + d.owner : ''))", "match(q, d.title, d.id + ' ' + d.owner)")], ['L-pdsec-dashNotByOwner', 'S-dashClient'], ['pdsec']),
    'd-eachkey': ([('pal', "        if (dashFetched || q.length < 2) { return; }\n        dashFetched = true;\n", "        if (q.length < 2) { return; }\n")], ['L-pdsec-dashFetchedOnce', 'S-dashClient'], ['pdsec']),
    # --- (round 13, the metrics row) shown without a report and on a dashboard; hidden from everyone but an admin
    'x-metricseverywhere': ([('pal', "          hide: function () { return !reportId() || onDashboard() || onAdminPage(); }, needs: function () { return !onDashboard() && !onAdminPage(); },\n",
                             "          hide: function () { return false; }, needs: function () { return true; },\n")],
                            ['L-pmetr-absentWithoutId', 'L-pdash-dashNoMetricsRow', 'S-metricsRow'], ['pmetr', 'pdash']),
    'x-metricsadminonly': ([('pal', "          avail: function () { return reportId() ? true : 'The report is not saved on the server yet'; },\n          hide: function () { return !reportId() || onDashboard() || onAdminPage(); },",
                            "          avail: function () { return reportId() ? (vars().isAdmin ? true : 'Admins only') : 'The report is not saved on the server yet'; },\n          hide: function () { return !reportId() || !vars().isAdmin || onDashboard() || onAdminPage(); },")],
                           ['L-pmetr-ownerSees', 'L-pmetr-viewerSees'], ['pmetr']),
    # --- (round 14) the text pasted into the box as typed; the Find row filtering instead; a hidden column's rows
    'h-raw': ([('pal', "            var term = g ? g.formatValue(t) : t, merged2 = addCond(term);", "            var term = t, merged2 = addCond(term);")], ['L-phand-filterQuoted', 'S-handoffs'], ['phand']),
    'h-findfilters': ([('pal', "                       run: function () { close(true); setTimeout(function () { F.open(t); }, 0); } });", "                       run: function () { close(true); applySearch(g ? g.formatValue(t) : t); } });")], ['L-phand-findNoFilter'], ['phand']),
    'h-hiddencol': ([('pal', "        var hs = headers(), byName = {};\n        hs.forEach(function (th) { byName[", "        var hs = Array.prototype.slice.call(document.querySelectorAll('#tableHeader th[data-colname]')), byName = {};\n        hs.forEach(function (th) { byName[")], ['L-phand-hiddenNoRow'], ['phand']),
    # --- (round 15) the dialog words hand-copied (no wysiwyg); the option toggled on select; the rows for a viewer; a hand list missing one
    'u-handlist': ([('pal', "        if (root) { var ns = root.querySelectorAll(UI_SEL); for (i = 0; i < ns.length; i++) { txt.push(ns[i].textContent); } }\n", "        if (root) { txt.push('copy options clipboard csv tsv tab-delimited google sheets'); }\n")], ['L-pvo-wysiwyg', 'S-uiWords'], ['pvo']),
    'v-toggles': ([('pal', "                           spotlight(t, f); }); } });\n", "                           spotlight(t, f); if (f && f.type === 'checkbox') { f.click(); } }); } });\n")], ['L-pvo-optionUnchanged'], ['pvo']),
    'v-viewer': ([('pal', "                       icon: { pal: 'settings' }, kw: 'view options editor ' + (small || ''), gate: 'admin', live: true,", "                       icon: { pal: 'settings' }, kw: 'view options editor ' + (small || ''), live: true,")], ['L-pvo-viewerNoRows'], ['pvo']),
    'v-handlist': ([('pal', "tab.querySelectorAll('.view-option-item input[type=\"checkbox\"]')", "tab.querySelectorAll('#viewOptionClickFilter, #viewOptionSearch, #viewOptionSnapshots, #viewOptionEmail, #viewOptionGrouping, #viewOptionClipboard, #viewOptionExport, #viewOptionPivot, #viewOptionViz, #viewOptionPagination, #viewOptionJournal, #viewOptionColumns')")], ['L-pvo-voCount', 'S-voSource'], ['pvo']),
    # --- (round 16) the row for a viewer; the text sent twice; placed but not sent; the summary box flipped
    'j-viewer': ([('pal', "    function jarvisOn() { return !!vars().aiAllowed && !!vars().canEditReport && !!(window.penumbraAi || el('toggleAiPanel'))", "    function jarvisOn() { return !!(window.penumbraAi || el('toggleAiPanel'))")], ['L-pjar-noRowViewer', 'L-pjar-noRowNonEditor', 'L-pjar-viewerAskFirst', 'S-jarvisGate'], ['pjar']),
    # --- (jarvispal, 2026-10-22) Ask help left at the bottom under a leading Ask Jarvis; the Jarvis sub-line back to the old text; the
    # Ask help sub-line back to the old one (nothing for a non-question)
    'j-asklast': ([('pal', "            if (jarLeads && ask.length) { var askRow = ask[0]; secQ.items.splice(secQ.items.indexOf(askRow), 1); sections[0].items.push(askRow); }\n", "")], ['L-pjar-askSecond', 'L-pjar-askSecondCode', 'S-askRows'], ['pjar']),
    'j-subpaid': ([('pal', "sub: 'the paid AI assistant: help, SQL, custom code and data', icon: { pal: 'ask' }, keys: null, arrow: 'asks and answers in this box',", "sub: 'the editor\\'s AI assistant answers here', icon: { pal: 'ask' }, keys: null, arrow: 'asks and answers in this box',")], ['L-pjar-subPaid', 'S-askRows'], ['pjar']),
    'j-subhelp': ([('pal', "sub: question ? 'answers from the help text only, with the pages it used' : 'answers from the help text only', icon: { pal: 'ask' }, ask: true,", "sub: question ? 'answers from the Help Center, with the pages it used' : '', icon: { pal: 'ask' }, ask: true,")], ['L-pjar-subHelpOnly', 'S-askRows'], ['pjar']),
    't-askpara': ([('topic', " Without the panel, Ask help stays first.</p>\n", "</p>\n")], ['S-askRows'], []),   # the topic's no-panel rule dropped (static only)
    # (round 21) the editor gate dropped: a viewer who may not edit the report gets the row again (7857e04's state)
    'j-noneditor': ([('pal', " && !!vars().canEditReport && !!(window.penumbraAi || el('toggleAiPanel'))", " && !!(window.penumbraAi || el('toggleAiPanel'))")], ['L-pjar-noRowNonEditor', 'S-jarvisGate'], ['pjar']),
    'j-double': ([('pal', "            var sb = byId('aiSendBtn'); if (sb) { click(sb); } else { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }   // the panel's own send (its Send button, else its Enter handler), once\n",
                          "            var sb = byId('aiSendBtn'); if (sb) { click(sb); }\n            setTimeout(function () { input.value = text; var sb2 = byId('aiSendBtn'); if (sb2) { click(sb2); } }, 500);\n")],
                 ['L-pjar-sendsOnce', 'S-jarvisOnce'], ['pjar']),
    'j-nosend': ([('pal', "            var sb = byId('aiSendBtn'); if (sb) { click(sb); } else { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }   // the panel's own send (its Send button, else its Enter handler), once\n", "")], ['L-pjar-sendsOnce', 'S-jarvisOnce'], ['pjar']),
    'j-summary': ([('pal', "            input.value = text;\n            input.dispatchEvent(new Event('input', { bubbles: true }));\n", "            input.value = text;\n            var cS = byId('aiProfileOn'); if (cS) { cS.checked = !cS.checked; }\n            input.dispatchEvent(new Event('input', { bubbles: true }));\n")], ['L-pjar-summaryUntouched', 'S-jarvisOnce'], ['pjar']),
    # --- (round 17) an unknown id rendered as a chip; a chip that applies the grouping itself; the block shown raw; the gate skipped
    'c-unknown': ([('pal', "            e = comboEntries().filter(function (x) { return x.id === cid; })[0] || null;\n", "            e = comboEntries().filter(function (x) { return x.id === cid; })[0] || { id: cid, label: cid, icon: { pal: 'ask' }, avail: true, run: function () { } };\n")], ['L-pchip-unknownDropped'], ['pchip']),
    'c-applies': ([('pal', "if (!r) { return false; } try { r.run(); } catch (e2) { toast('That action could not run.'); return false; } return true; };", "if (!r) { return false; } try { r.run(); setTimeout(function () { var b = el('confirmGroupingBtn'); if (b) { click(b); } }, 300); } catch (e2) { toast('That action could not run.'); return false; } return true; };")], ['L-pchip-chipOpensNotApplies'], ['pchip']),
    'c-raw': ([('main', "            $msg.html(renderAiMarkdown(split.text));\n", "            $msg.html(renderAiMarkdown(text));\n")], ['L-pchip-blockNeverRaw', 'S-chipsSafe'], ['pchip']),
    # --- (round 18a) the time budget gone: PHP's 90-s limit kills a slow provider call mid-flight again
    'a-notime': ([('aia', "set_time_limit(360);\n$response = curl_exec($ch);\n", "$response = curl_exec($ch);\n")], ['S-aiTimeBudget'], []),   # (round 19a: the budget grew with the stream)
    # --- (round 18b) a hand list of themes missing most of them; Report Default counted as a density again
    'h-themelist': ([('pal', "        themeOptions().forEach(function (t) {\n            out.push({ id: 'combo:theme:'", "        [{ value: 'theme-default', label: 'Default Light' }, { value: 'theme-dark-blue', label: 'Dark Blue' }].forEach(function (t) {\n            out.push({ id: 'combo:theme:'")], ['L-pthm-everyTheme', 'S-themeSource'], ['pthm']),
    'h-density': ([('pal', "                if (o.value === 'report-default') { return; }   // (round 18b) a choice, not a density: the three densities are rows\n", "")], ['L-pthm-densityThree'], ['pthm']),
    # --- (round 19a) a partial SSE line dropped at a chunk boundary; the stream not requested
    'a-nobuffer': ([('aia', "    $st['buf'] .= $chunk;\n", "    $st['buf'] = $chunk;\n")], ['S-aiStreamParse'], []),
    'a-nostream': ([('aia', "        'stream' => true,       // (round 19a) the answer streams: bytes from the first token, never an idle connection\n", "")], ['S-aiStream'], []),
    # --- (round 19b) the row forwards to the panel again; the answer put in raw; Esc does not abort; the answer not recorded as history
    'j-forward': ([('pal', "                  run: function () { if (window.penumbraAi && typeof window.penumbraAi.ask === 'function') { askJarvis(t); } else { close(true); setTimeout(function () { askJarvisInPanel(t); }, 0); } } }];\n",
                          "                  run: function () { close(true); setTimeout(function () { askJarvisInPanel(t); }, 0); } }];\n")], ['L-pjip-inPlace'], ['pjip']),
    'j-rawhtml': ([('pal', "            ans.innerHTML = AI.render(split.text);   // the panel's own renderer: its markdown, its escaping\n", "            ans.innerHTML = split.text;\n")], ['L-pjip-sanitized', 'S-inPlace'], ['pjip']),
    'j-noabort': ([('pal', "        if (jarvisReq && typeof jarvisReq.abort === 'function') { try { jarvisReq.abort(); } catch (e) { } }\n", "")], ['L-pjip-cancelAborts'], ['pjip']),
    'j-nohistory': ([('main', "                    appendAiMessage('user', text);\n                    appendAiMessage('assistant', resp.reply);\n                    if (handlers.done) handlers.done(resp.reply);\n", "                    if (handlers.done) handlers.done(resp.reply);\n")], ['L-pjip-continueCarries', 'L-pjip-lateLands'], ['pjip']),
    # --- (round 20) the Show rows not listed; the restricted gate dropped; the wrong hidden column shown; the row off by one; the page
    # count floored; the Rows = All fill dropped; past the end not greyed; the verb left in; find routed to the filter; a FILTER column stripped
    's-noshow': ([('pal', ".concat(voEntries()).concat(tabEntries()).concat(showEntries()).concat(tableEntries()).forEach(function (e) {", ".concat(voEntries()).concat(tabEntries()).concat(tableEntries()).forEach(function (e) {")], ['L-pshow-showAllRow'], ['pshow']),
    's-norestrict': ([('pal', "        try { if (typeof a.restricted === 'function' && a.restricted()) { return out; } } catch (eR) { return out; }   // the menu's own gate\n", "")], ['L-pshow-restrictedNone'], ['pshow']),
    's-wrongk': ([('pal', "avail: true, run: menuRun(anchor, 'show-' + k) });", "avail: true, run: menuRun(anchor, 'show-' + (k + 1)) });")], ['L-pshow-showOneRuns'], ['pshow']),
    'g-offbyone': ([('pal', "            else { target = v.rows[n - 1]; }   // the Nth row shown\n", "            else { target = v.rows[n]; }   // the Nth row shown\n")], ['L-pjump-rowJump'], ['pjump']),
    'g-pagemath': ([('pal', "                pages = Math.ceil(total / rpp);\n", "                pages = Math.floor(total / rpp);\n")], ['L-pjump-pageJump'], ['pjump']),
    'g-nofill': ([('pal', "        if (FH && typeof FH.fillRow === 'function' && tr.closest('#resultsTable')) { try { FH.fillRow(tr); } catch (e2) { } }   // Rows = All: no page turn, the row's own fill\n", "")], ['L-pjump-lazyFill'], ['pjump']),
    'g-norange': ([('pal', "            else if (n > total) { off = true; why = v.what + ' ' + nLabel(total) + ' rows'; }\n", "")], ['L-pjump-outOfRange'], ['pjump']),
    'v-left': ([('pal', "            rest = t.slice(v.length).trim();\n", "            rest = t;\n")], ['L-pverb-verbFilterCond'], ['pverb']),
    'v-findfilter': ([('pal', "kind: (v === 'find' || v === 'find in' || v === 'look for') ? 'find' : (v === 'filter by' ? 'by' : 'filter') };", "kind: (v === 'filter by' ? 'by' : 'filter') };")], ['L-pverb-verbFind'], ['pverb']),
    'v-colstrip': ([('pal', "            if (thByName(v) || thByName(v.split(' ')[0])) { return null; }   // a column named FILTER / SEARCH / FIND / WHERE: its name, not a verb\n", "")], ['L-pverb-colNameKept'], ['pverb']),
    # --- (round 21) the draft posted; the draft dropped; the dialog's Send pressed; the dialog's check dropped; chips put in
    # past the dialog's tokenizer; your view not ticked; the address reaching the misses log
    'n-autopost': ([('journal', "        compose: function (text) { open(); if (mentionMf && typeof mentionMf.setText === 'function') { mentionMf.setText(text || ''); } },\n", "        compose: function (text) { open(); if (mentionMf && typeof mentionMf.setText === 'function') { mentionMf.setText(text || ''); } setTimeout(postNote, 300); },\n")], ['L-pnote-notPosted'], ['pnote']),
    'n-noprefill': ([('pal', "run: function () { close(true); setTimeout(function () { journalCompose(text); }, 0); } });", "run: function () { close(true); setTimeout(function () { journalCompose(''); }, 0); } });")], ['L-pnote-journalPrefilled'], ['pnote']),
    'p-eager': ([('pal', "            if (lazy) { availNow[e.id] = true; }\n", "            if (lazy) { try { availNow[e.id] = e.avail(); } catch (err) { availNow[e.id] = 'Not available right now'; } }\n"),
                 ('pal', "                avail: true, run: function () { var k = act('copy-other'); if (k && k.run && !k.disabled) { k.run(); } else { toast('Copy is not offered for this column'); } } });   // (round 24b) no menu build per keystroke\n",
                  "                avail: function () { var k = act('copy-other'); return (k && !k.disabled) ? true : 'Not offered for this column'; }, run: function () { var k = act('copy-other'); if (k && k.run) { k.run(); } } });\n")], ['L-pperf-wideTyping'], ['pperf']),
    'p-comboverb': ([('pal', "        else if ((cm = /^(group by|pivot by|chart|copy distinct values of|column options of)\\s+\\S/.exec(t))) {", "        else if (false && (cm = /^(group by|pivot by|chart|copy distinct values of|column options of)\\s+\\S/.exec(t))) {")], ['L-ptop-topGroupBy', 'L-ptop-topGroupPartial'], ['ptop']),
    'm-autosend': ([('pal', "            try { input.focus(); var n = input.value.length; input.setSelectionRange(n, n); } catch (e2) { }\n        }, 4000);\n", "            try { input.focus(); var n = input.value.length; input.setSelectionRange(n, n); } catch (e2) { }\n            click(el('sendEmailBtn'));\n        }, 4000);\n")], ['L-pmail-nothingSent'], ['pmail']),
    'm-novalidate': ([('pal', "            if (x.indexOf('@') >= 0) { (addressOk(x) ? emails : bad).push(x); }\n", "            if (x.indexOf('@') >= 0) { emails.push(x); }\n")], ['L-pmail-invalidGreyed'], ['pmail']),
    'm-direct': ([('pal', "            if (emails.length) {\n                input.value = emails.join('; ');\n                if (typeof window.commitPendingRecipients === 'function') { window.commitPendingRecipients('#emailInputReal', '#emailRecipientContainer'); }   // the dialog's own tokenizer: chips\n            }\n", "            emails.concat(names).forEach(function (a) { var c = document.createElement('span'); c.className = 'email-capsule'; c.setAttribute('data-email', a); c.textContent = a; el('emailRecipientContainer').insertBefore(c, input); });\n")], ['L-pmail-opensPrefilled'], ['pmail']),
    'm-noview': ([('pal', "            if (asv && shown(el('emailViewLinkRow')) && !asv.disabled && !asv.checked) { asv.checked = true; asv.dispatchEvent(new Event('change', { bubbles: true })); }   // your view, the dialog's own option\n", "")], ['L-pmail-viewLinkTicked'], ['pmail']),
    'm-emaillog': ([('pal', "        text = missRedact(text);\n", "")], ['L-pmiss-emailRedacted', 'L-pmiss-beaconClean'], ['pmiss']),
    # --- (round 22) a partial treated as a bad address (the row greyed); the partial committed as a chip; the verb rule gone from the redaction
    'e-hidepartial': ([('pal', "            if (!done) { partial = x; return; }\n", "            if (!done) { bad.push(x); return; }\n")], ['L-pmail-partialName', 'L-pmail-partialAddress'], ['pmail']),
    'e-commitpartial': ([('pal', "            if (partial) { rest.push(partial); }   // (round 22) a half-typed recipient: left in the input, uncommitted - the dialog's own autocomplete and validation take over\n", "            if (partial) { input.value = partial; if (typeof window.commitPendingRecipients === 'function') { window.commitPendingRecipients('#emailInputReal', '#emailRecipientContainer'); } }\n")], ['L-pmail-partialAddressOpens'], ['pmail']),
    'm-redactpartial': ([('pal', "        if (e && e[2].trim()) { t = e[1] + ' [recipients]'; }\n", "")], ['L-pmiss-partialRedacted'], ['pmiss']),
    # --- (round 22) a top match on a partial word (the exact-name rule relaxed); the top row repeated in its section
    't-ambiguous': ([('pal', "        return (cands.length === 1 && starts === 1 && !cands[0].off) ? cands[0] : null;\n", "        return (cands.length >= 1 && !cands[0].off) ? cands[0] : null;\n")], ['L-ptop-noTopAmbiguous'], ['ptop']),
    't-duplicate': ([('pal', "            sections.forEach(function (s) { var k = s.items.indexOf(top); if (k >= 0) { s.items.splice(k, 1); } });   // once: in the slot, not again below\n", "")], ['L-ptop-topSend'], ['ptop']),
    # (round 22) the tab strip read as "#editorTabs > ul" again (the live bug)
    'v-strip': ([('pal', "        return Array.prototype.filter.call(t.querySelectorAll('li > a[href^=\"#\"]'), function (a) { var h = a.getAttribute('href'); return h.length > 1 && !!t.querySelector(h); });\n", "        return Array.prototype.slice.call(t.querySelectorAll(':scope > ul > li > a[href^=\"#\"]'));\n")], ['L-pvo-optionOpens', 'L-pvo-tabRows'], ['pvo']),
    # --- (round 23) the Table info rows for everyone (the console's gate dropped); an inventory row dropped (the static must catch the control)
    'i-tablegate': ([('pal', "icon: { pal: 'column' }, kw: 'table stats info columns schema rows used in', gate: 'admin', live: true,", "icon: { pal: 'column' }, kw: 'table stats info columns schema rows used in', live: true,")], ['L-pr23-tableInfoViewer'], ['pr23']),
    'i-norow': ([('pal', "        { id: 'managedata', label: 'Manage local data',", "        { id: 'managedata', label: 'Manage local data', hide: function () { return true; },")], ['L-pr23-manageData'], ['pr23']),
    # --- (final sweep) the journal row back on the module's presence (the live bug)
    'f-journalgate': ([('pal', "        var jb = el('journalBtn'), journalOn = !!(jb && shown(jb));\n", "        var jb = el('journalBtn'), journalOn = !!(jb && shown(jb) && window.PenumbraJournal);\n")], ['L-pnote-lazyJournal'], ['pnote']),
    'c-nogate': ([('pal', "        if (!visible(e, '') || dashHidden(e) || (typeof e.hide === 'function' && e.hide())) { return false; }   // the gates a row has (authoring, the page)\n", "        if (dashHidden(e) || (typeof e.hide === 'function' && e.hide())) { return false; }\n")], ['L-pchip-viewerGatedDropped', 'S-chipsSafe'], ['pchip']),
}
# (2026-10-27, fltmenu) phlcol reshaped: Highlight...'s old row mutants have nothing to turn red; the rows' and the keywords'
MUTANTS = {k: v for k, v in MUTANTS.items() if 'phlcol' not in v[2]}
MUTANTS['pf-rowbounds'] = ([('pal', "'cellAtLeast', 'cellAtMost', 'cellCopy', 'copyRow', 'copyNestedTable', 'addNote'].indexOf", "'cellCopy', 'copyRow', 'copyNestedTable', 'addNote'].indexOf")], ['L-prow-rowBounds'], ['prow'])
MUTANTS['pf-hlkw'] = ([('pal', "kw: 'format summary shading links filter highlight colour color conditional rule cells rows header', pick: 'column' },", "kw: 'format summary shading links', pick: 'column' },")], ['L-phlcol-hlFindsOptions'], ['phlcol'])
MUTANTS['pf-hlrow'] = ([('pal', "        { id: 'col:freeze', label: 'Freeze up to this column...',", "        { id: 'col:highlight', label: 'Highlight...', act: 'highlight', icon: { pal: 'highlight' }, kw: 'highlight', pick: 'column' },\n        { id: 'col:freeze', label: 'Freeze up to this column...',")], ['L-phlcol-hlGone'], ['phlcol'])
NEW = NEW | {'L-prow-rowBounds', 'L-phlcol-hlGone', 'L-phlcol-hlFindsOptions', 'S-copyRowHelp'}   # (2026-10-27, fltmenu; S-copyRowHelp: the rows' help line names the new ones)
NEW = NEW - {'L-prow-rowBounds', 'L-phlcol-hlGone', 'L-phlcol-hlFindsOptions', 'S-copyRowHelp'}   # (fltmenu is LIVE since 5eae534, 2026-10-27)

CHIPS_REPLY = json.dumps({'status': 'success', 'reply': 'Group the rows by their status and look at the open ones.\n\n```penumbra-actions\n' + json.dumps([
    {'id': 'combo:group', 'args': {'column': 'V_STATUS', 'layout': 'list'}}, {'id': 'filter', 'args': {'condition': 'V_STATUS = Open'}},
    {'id': 'combo:teleport', 'args': {'column': 'V_STATUS'}}, {'id': 'col:sortAsc', 'args': {'column': 'V_AMOUNT'}}, {'id': 'action', 'args': {'id': 'zzz'}},
    {'id': 'combo:group', 'args': {'column': 'V_LINK'}}, {'id': 'action', 'args': {'id': 'save'}}, {'id': 'vo', 'args': {'option': 'Custom Sort Orders'}}]) + '\n```'})
# (round 17) the canned reply: valid (group, filter, sort, save, vo) + invented (teleport, zzz) + a hidden column (V_LINK) suggestions
DASH_LIST_FIXTURE = json.dumps({"status": "success", "data": [
    {"short_id": "dshA", "title": "Awards overview", "owner_id": "ownerx", "authorized": "vone", "created_at": "2026-10-01", "updated_at": "2026-10-19", "can_edit": False, "tags": ["awards"]},
    {"short_id": "dshB", "title": "Budget burn", "owner_id": "vone", "authorized": "", "created_at": "2026-10-02", "updated_at": "2026-10-18", "can_edit": True, "tags": ["finance"]},
    {"short_id": "dshC", "title": "Sponsor spend", "owner_id": "other", "authorized": "vone", "created_at": "2026-10-03", "updated_at": "2026-10-17", "can_edit": False, "tags": []}]})
# (the list as the server returns it to THIS caller: the cut itself is dash_gate_tests.php's to prove)

# (2026-10-21, the searchrank follow-up) get_server_reports.php?mode=quicksearch&limit=8&search=EPA as live answered it on
# 2026-10-21 (faaae25's tiers: the id starts with it, an id word starts with it, then four mid-word "Department" titles;
# newest within each). ID and OWNER_ID are placeholders: the box reads SHORT_ID and TITLE.
QS_EPA_FIXTURE = json.dumps({"status": "success", "data": [dict(zip(("ID", "SHORT_ID", "TITLE", "OWNER_ID", "UPDATED_AT"), r)) for r in (
    (901, "epa-perm", "External Professional Activity (EPA) Permission Levels", "ownerx", "2026-08-11 21:19:23"),
    (902, "fi-epa-c", "Financial Interest & External Professional Activities", "ownerx", "2026-10-21 15:25:17"),
    (903, "fi-epa", "Financial Interest & External Professional Activities", "ownerx", "2026-10-20 22:13:40"),
    (904, "fi-epa-c-spoofer", "Financial Interest & External Professional Activities (spoofer)", "ownerx", "2026-10-20 22:07:29"),
    (905, "cdprop", "Proposals by Department and College Over the Past 5 Fiscal Years-to-Date", "ownerx", "2026-10-05 20:59:24"),
    (906, "cdawd", "Awards by Department and College Over the Past 5 Fiscal Years-to-Date", "ownerx", "2026-10-05 20:55:11"),
    (907, "hitratio", "Proposal Hit Ratio by College, Department and PI", "ownerx", "2026-10-05 11:21:24"),
    (908, "award_compare_monthdeptprimespon", "Compare month to month, year to year, awards by sponsor and department.", "ownerx", "2026-08-20 16:26:14"))]})
# (2026-10-30, selflt) the selected cell one of several selected: the header menu's Filter to / Exclude the selected values and
# Copy the selected cells as rows, named by the selection, the cell's own gone; the picked row filters by every value
CHK['prow'] = CHK['prow'] + ['rowSel', 'rowSelRuns']
NEW_SEL = {'L-prow-rowSel', 'L-prow-rowSelRuns', 'S-selRowHelp'}
NEW = NEW | NEW_SEL
NEW = NEW - NEW_SEL   # (selflt is LIVE since e3ef480, 2026-10-30: old checks now)
MUTANTS['sl-palrows'] = ([('pal', "            if (['selFilter', 'selExclude', 'selCopy'].indexOf(it.act) >= 0 && !it.disabled) {", "            if (false) {")], ['L-prow-rowSel', 'L-prow-rowSelRuns'], ['prow'])
MUTANTS['sl-palsub'] = ([('pal', "sub: 'the ' + nSel + ' selected cells',", "sub: where,")], ['L-prow-rowSel'], ['prow'])

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
        'stub': os.path.join('js', 'penumbra_palette_boot.js'), 'pal': os.path.join('js', 'penumbra_palette.js'), 'pcss': os.path.join('css', 'penumbra_palette.css'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php'), 'topic': os.path.join('help', 'topics', 'commandPaletteHelpLightbox.php'),
        'manifest': os.path.join('help', 'manifest.php'),
        'gsr': 'get_server_reports.php',   # (round 5) the report discovery gate
        'dash': 'dashboard.php',   # (round 6) the stub on the dashboard page
        'fni': os.path.join('help', 'functions_index.php'), 'fnep': 'help_functions.php',   # (round 7) the functions and tags index
        'chrome': 'penumbra_admin_chrome.php',   # (round 12) the admin tools registry + the admin pages' bar
        'disc': 'penumbra_discovery.php', 'mdash': 'manage_dashboard.php',   # (round 13) the discovery gates + the dashboards list
        'sb': os.path.join('js', 'search_builder.js'),   # (round 14) the search grammar's exports
        'prompt': 'ai_system_prompt.php',   # (round 17) the Jarvis system prompt (the contract section)
        'aia': 'ai_assist.php',   # (round 18a) the proxy's time budget
        'journal': os.path.join('js', 'penumbra_journal.js'),   # (round 21) the journal's compose
        'chrome2': 'penumbra_admin_chrome.php'}   # (round 23) the inventory reads the chrome's markup too
# (2026-10-30, selflt) cell selection under test too (its cells(): the selection's rows): the stage's, over LIBS's live copy
RELS.update({'csel': os.path.join('js', 'penumbra_cellsel.js')})
sys.path.insert(0, HERE)
import mk_harness, mk_dash_harness, mk_adm_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no palette: EMPTY files
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
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_pal_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css', 'penumbra_forms.css', 'penumbra_find.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
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

def run_page(path, shot_path=None):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]; navs = []   # every navigation the page makes (a mid-scenario reload restarts the driver from the top)
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('method') == 'Network.requestWillBeSent' and r.get('params', {}).get('type') == 'Document':
                ini = r['params'].get('initiator', {}); cf = (ini.get('stack') or {}).get('callFrames') or []
                navs.append('%s DOC %s initiator %s %s' % (round(time.time() - t00[0], 1), r['params'].get('documentURL', ''), ini.get('type'),
                            ' <- '.join('%s@%s:%s' % (c.get('functionName') or '?', (c.get('url') or '').split('/')[-1], c.get('lineNumber')) for c in cf[:8])))
            if r.get('method') in ('Page.frameRequestedNavigation', 'Page.frameScheduledNavigation', 'Page.frameNavigated'):
                pr = r.get('params', {}); fr = pr.get('frame', {})
                navs.append('%s %s %s %s' % (round(time.time() - t00[0], 1), r['method'].split('.')[1], pr.get('reason', fr.get('url', '')), pr.get('url', '')))
            if r.get('id') == mid: return r.get('result', {})
    t00 = [time.time()]
    try:
        call('Page.enable'); call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        if 'scn=pshot9' in path: call('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})   # (round 9) the photo at 1440px
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        if path.endswith('scn=pjbusy'): call('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 600, 'deviceScaleFactor': 1, 'mobile': False})   # (jarbusy) a short window
        if 'scn=pjbusy' in path or 'scn=pshotjb' in path:   # (jarbusy) the motion preference set either way: Edge reads Windows' "Animation effects" (off = reduce)
            rm = 'scn=pjbusyrm' in path or ('scn=pshotjb' in path and os.environ.get('PNB_JBRM'))
            hc = 'scn=pjbusyhc' in path or ('scn=pshotjb' in path and os.environ.get('PNB_JBHC'))   # forced colours, as Windows High Contrast
            call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if rm else 'no-preference'}] + ([{'name': 'forced-colors', 'value': 'active'}] if hc else [])})
        if 'scn=pshotjb' in path and os.environ.get('PNB_JBTHEME'): path = path + '&theme=' + os.environ['PNB_JBTHEME']   # (jarbusy) the photograph's theme
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        budget = float(os.environ.get('PNB_TIMEOUT') or 300)
        while time.time() - t0 < budget:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                shot_to = shot_path or os.environ.get('PNB_SHOT')
                if shot_to:
                    import base64
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(shot_to, 'wb').write(base64.b64decode(shot))
                return json.loads(v)
        # the driver's step trace (window.__TRACE) says where a scenario stalled
        tr = call('Runtime.evaluate', {'expression': 'JSON.stringify({trace: (window.__TRACE || []).slice(-16), errors: (window.__R && window.__R.errors) || [], done: !!window.__HCDONE, q: window.__queryDone, h: window.__HC_HIDES})', 'returnByValue': True}).get('result', {}).get('value')
        # a 100 ms timer's real wait: a throttled (hidden) page answers in seconds
        tm = call('Runtime.evaluate', {'expression': '(async function () { var t = performance.now(); await new Promise(function (r) { setTimeout(r, 100); }); return Math.round(performance.now() - t) + " ms for a 100 ms timer; visibility " + document.visibilityState + "; hasFocus " + document.hasFocus(); })()', 'awaitPromise': True, 'returnByValue': True}).get('result', {}).get('value')
        st = call('Runtime.evaluate', {'expression': 'JSON.stringify({box: !!document.getElementById("pnbPalette"), open: !!(window.PenumbraPalette && window.PenumbraPalette.isOpen && window.PenumbraPalette.isOpen()), mode: window.PenumbraPalette && window.PenumbraPalette.mode ? window.PenumbraPalette.mode() : null, ae: document.activeElement ? document.activeElement.tagName + "#" + document.activeElement.id : null, state: window.PenumbraPalette && window.PenumbraPalette.boot ? window.PenumbraPalette.boot.state() : null})', 'returnByValue': True}).get('result', {}).get('value')
        tr = str(tr) + ' | timer: ' + str(tm) + ' | state: ' + str(st) + ' | navs: ' + json.dumps(navs[-12:])
        return {'fatal': 'timeout (%d s); trace %s' % (budget, tr)}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

RECIPIENTS_STUB = '[{"label": "Smith, Bob (bob)", "value": "bob@ncsu.edu", "fname": "Bob", "lname": "Smith", "username": "bob", "empl_id": "", "ouc": "", "ouc2d": "", "ouc4d": "", "dept": "", "jobcode": "", "jobcode_prefix": "", "empl_class": "", "empl_status": "", "pi_eligible": ""}]'
JOURNAL_STUB = '{"status": "success", "installed": true, "data": [], "report": {"title": "A recent report"}}'

# ---------------------------------------------------------------- (round 23) the entry-point inventory
# Every clickable control with an id (a <button>, role="button", an <a href="#...">, a button-type input) in the page markup,
# plus every id a JS click handler is bound to, must be an entry point the box offers (the module references the id:
# tool / toolRun / has / el('id') or '#id') or sit in ENTRY_SKIP with the reason it is not a row. Recomputed on every run
# from the files under test: a new button without a row (or a reason) is red.
ENTRY_SKIP_RULES = [
    # (regex over the id, reason) - the first rule that matches wins
    (r'^(aiClearChat|aiClosePanel|aiSendBtn)$', 'the AI panel\'s own controls (the panel is a row)'),
    (r'^audit|^refreshAuditLogBtn$', 'the Auditor tab\'s own controls (the tab is a row)'),
    (r'^(cs[A-Z]|csClear|csLoad|csSave|csCancel|csAdd)', 'the custom sort dialog\'s own steps (a View Options row opens it)'),
    (r'^(confirm|delete(All|Selected)|export|import|saveJsonStateBtn|saveAsCopyBtn|lastStopToggle|autoTitleBtn|reportTagsContainer|generateRandomIdBtn|resetUserPrefsBtn)', 'a step inside the Save / Manage local data dialogs (each dialog is a row)'),
    (r'^(generatePrompt|testPrompt|resetPromptForm|generateSubquery|formatSubquerySql|resetSubqueryForm|promptSwapBoolean|linkToPromptGenerator|retryPromptLink|resetAllPromptsLink|selectDefaultsFromAutofill|sidebarImportPrompt)', 'the Tag Generator / prompt form\'s own steps (the generator is a row)'),
    (r'^(viz|copyChartImage|downloadChart|injectVizInfoboxBtn|removeVizSnippetBtn|updateVizSnippetBtn|copyViz)', 'the chart builder\'s own tabs and steps (the builder is a row)'),
    (r'^(copy(Copy|Group|Pivot)SnippetBtn|updatePivotSnippetBtn|downloadCopySnippetBtn|confirmCopyBtn|createDownloadLinkBtn|dlLink|pnbDlManual)', 'a step inside the Copy / Download dialogs (each is a row)'),
    (r'^(generatePivotBtn|modifyPivotBtn|resetPivotBtn|pivotTransposeBtn|closePivotBtn|pivot-agg-table)$', 'the pivot builder\'s own steps (the builder, Exit the pivot view and the pivot rows cover it)'),
    (r'^(resetGroupingBtn|configureGroupingBtn|removeGroupingLink|ungroupBtn)$', 'the Group dialog\'s own steps (Group, Ungroup, Expand / Collapse all groups are rows)'),
    (r'^(snap|dm|pnbSnapHdr|createSnap|compareSnapshot|loadSnapshotBtn|linkToSchedulerFromSnapshot|unifiedSnapshotTableBody|schedOpenSnapshots|createNewSnapshotBtnV2)', 'a step inside the Snapshots dialog (the dialog is a row; a snapshot is created there)'),
    (r'^(sched|clearSchedSearch|refreshSchedulerBtn|refreshCronPreview|testRun|addNewTaskBtn|cancelTaskBtn|saveTaskBtn|deleteTaskBtn|runner)', 'the Scheduler tab\'s own steps (the tab, a new email task and Manage schedules are rows; the global pause is an admin-only switch)'),
    (r'^(journal|jHist)', 'the Report journal panel\'s own controls (the journal and Add a note are rows)'),
    (r'^(helpCenter|helpMatch|pnbAsk)', 'the Help Center\'s own controls (the Help Center and Ask help are rows)'),
    (r'^(sendEmailBtn|resetEmailSettingsBtn)$', 'the Email dialog\'s own buttons (the dialog is a row; Send is the person\'s)'),
    (r'^(sbColsPop|sbCustomCols|sbFrozen|sbGroup$|sbGroupPop|sbGroupPresetList|sbGroupSharedList|sbGrp|sbPivot$|sbPivotPop|sbPivotPresetList|sbPivotSharedList|sbPivotOpenBuilder|sbSnap|sbSnapshot|sbRf|sbTableHidden|sbAsOf$|sbAsOfHistory|sbColsSeg|sbColsOpen|sbColsSettings)', 'a status-bar indicator or its popover\'s own buttons (the state they show has its row: Group, Pivot, Snapshots, Freeze, Version history, Settings)'),
    (r'^(sbPaletteBtn|searchPaletteIcon)$', 'the box itself'),
    (r'^pnbCardsSortDir$', 'the cards\' Sort list arrow (Sort ascending... / Sort descending... are rows)'),   # (2026-10-30, csort)
    (r'^(sbCardsOpen|sbCardsConfig)$', 'the status bar\'s Cards card and its Configure cards... (Show as cards / as a table, Card size and Configure cards... are rows)'),   # (2026-10-30, cards round O)
    (r'^sbColsViewSwitch$', 'the Cols card\'s Layout line: Switch to cards layout / table layout (Show as cards and Show as a table are rows)'),   # (2026-10-30, cards round P)
    (r'^(copyViewLinkBtn|emailCopyViewLink)$', 'Copy a link to this view (a row, through PenumbraViewLink.copy; the Email dialog\'s Copy link is the same)'),
    (r'^(scrollTopBtn|scrollBottomBtn)$', 'Scroll to the top / bottom (rows, through scrollEdge)'),
    (r'^searchHelpIcon$', 'the Help Center (a row)'),
    (r'^(searchBuilderIcon|schedSearchBuilderIcon|sbAddConditionBtn|sbClearBtn|sbSubmitBtn|searchBuilderLightbox)$', 'the Visual filter builder (a row) and its own steps'),
    (r'^(tableSearchCols|tableSearchPlay|activeFilterIcon)$', 'the filter box\'s own controls (Jump to the filter box, Clear the filter are rows)'),
    (r'^(sp[A-Z]|settingsPanelClose|settingsPanelOverlay)', 'the Settings panel\'s own controls (the panel, Clear preferences, Keyboard shortcuts, themes and densities are rows)'),
    (r'^(repo|sr[A-Z]|openReport|reportFilterInput)', 'repository.php\'s own page (Open the report list is a row)'),
    (r'^dash', 'dashboard.php\'s own controls (dashEntries reads them on that page)'),
    (r'^(pnbPaste|pnbScratch)', 'the paste / scratch overlays (mid-flow)'),
    (r'^(importCautionIcon|snapshotCautionIcon)$', 'a dismiss icon on a caution banner'),
    (r'^(authAccessContainer|helpCenterLightbox|dlLinkOptionsLightbox|toggleDockBtn|btnDecrypt|confirmPauseBtn|manualApplySnippetBtn|copyServerUrlLink|undeleteReportBtn|viewLastPageLink|clearSelectorSearch|clearSnipHelperSearch|schedSaveReportLink|testRunCancelLink|exportStatesToFileBtn)', 'a container, a confirm step, or a link inside another flow'),
]
def entry_inventory(texts):
    import re as _re
    markup = {'index': texts.get('index', ''), 'dash': texts.get('dash', ''), 'chrome': texts.get('chrome', '')}
    jss = {'main': texts.get('main', ''), 'journal': texts.get('journal', ''), 'sb': texts.get('sb', '')}
    for f in os.listdir(os.path.join(APP, 'js')):
        if f.endswith('.js') and not f.endswith('.min.js') and f not in ('main.js', 'penumbra_journal.js', 'search_builder.js', 'penumbra_palette.js', 'penumbra_palette_boot.js'):
            jss[f] = read_b(os.path.join(APP, 'js', f))
    handled = set()
    for t in jss.values():
        for p in (r"\$\(['\"]#([A-Za-z0-9_-]+)['\"]\)\s*\.(?:on|one)\(\s*['\"]click", r"\$\(['\"]#([A-Za-z0-9_-]+)['\"]\)\s*\.click\(\s*function",
                  r"\$\(document\)\.on\(\s*['\"]click[^'\"]*['\"]\s*,\s*['\"]#([A-Za-z0-9_-]+)['\"]", r"getElementById\(['\"]([A-Za-z0-9_-]+)['\"]\)\s*\.addEventListener\(\s*['\"]click",
                  r"\$\(['\"]#([A-Za-z0-9_-]+)['\"]\)\s*\.off\([^)]*\)\s*\.on\(\s*['\"]click"):
            handled |= set(_re.findall(p, t))
    ids = set()
    for t in markup.values():
        for m in _re.finditer(r'<(button|a|svg|span|div|input|label|li)\b([^>]*)>', t, _re.S):
            tag, attrs = m.group(1), m.group(2)
            idm = _re.search(r'\bid="([A-Za-z0-9_-]+)"', attrs)
            if not idm: continue
            isbtn = tag == 'button' or 'role="button"' in attrs or (tag == 'a' and _re.search(r'href="(#|javascript)', attrs)) or (tag == 'input' and _re.search(r'type="(button|submit)"', attrs))
            if isbtn or idm.group(1) in handled: ids.add(idm.group(1))
    return sorted(ids | handled)
def entry_points_check(texts):
    import re as _re
    pal = texts['pal']
    refs = set(_re.findall(r"(?:tool|toolRun|has|el)\(['\"]([A-Za-z0-9_-]+)['\"]\)", pal)) | set(_re.findall(r"['\"]#([A-Za-z0-9_-]+)['\"]", pal)) | set(_re.findall(r"getElementById\(['\"]([A-Za-z0-9_-]+)['\"]\)", pal))
    inv = entry_inventory(texts)
    bad = []
    for i in inv:
        if i in refs: continue
        if any(_re.search(rx, i) for rx, _ in ENTRY_SKIP_RULES): continue
        bad.append(i)
    return inv, bad

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('penumbra_admin_chrome.php', texts['chrome'])
    for sub, key in (('js', 'stub'), ('js', 'pal'), ('css', 'pcss')):
        os.makedirs(os.path.join(stage, sub), exist_ok=True)
        w(os.path.join(sub, {'stub': 'penumbra_palette_boot.js', 'pal': 'penumbra_palette.js', 'pcss': 'penumbra_palette.css'}[key]), texts[key])
    os.makedirs(os.path.join(stage, 'help'), exist_ok=True)
    w(os.path.join('help', 'functions_index.php'), texts['fni'])   # (the chrome's stub tag needs pnb_help_functions_ver())
    menu_html = render_chrome('menu') if texts['chrome'] else ''
    w('harness.html', mk_harness.build(texts['index'], menu_html, render_themes()))   # (round 18b) the registry's theme options
    w('adm.html', mk_adm_harness.build(render_chrome('bar') if texts['chrome'] else ''))   # (round 12) an admin tool page
    w('dash.html', mk_dash_harness.build())   # (round 6) dashboard.php's stand-in
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])
    w('penumbra_cellsel.js', texts['csel'])   # (2026-10-30, selflt)
    w('penumbra_palette_boot.js', texts['stub'])
    w('penumbra_palette.js', texts['pal'])
    w('penumbra_palette.css', texts['pcss'])
    w('get_server_reports.php', texts['gsr'])   # (the gate tests read it from here)
    w('penumbra_discovery.php', texts['disc'])   # (round 13) the discovery gates (empty on the control: the gate tests then lift it from the endpoint)
    w('search_builder.js', texts['sb'])   # (round 14) the search builder under test (the harness loads it after main.js, as index.php does)
    w('ai_assist_stub.json', '{"status": "success", "reply": "A stub answer."}')   # (round 16) what the panel's send gets back (penumbra_vars.aiProxyUrl in the scenario)
    w('ai_assist_chips.json', CHIPS_REPLY)   # (round 17) the canned reply with a penumbra-actions block
    w('theme_reg.json', theme_reg_json())   # (jarbusy) every theme of the registry + the variable blocks index.php emits (the contrast checks)
    w('penumbra_journal.js', texts.get('journal', ''))   # (round 21) the journal module under test (pnote loads it)
    w('get_email_recipients.php', RECIPIENTS_STUB)   # (round 21) the dialog's directory list, answered for any term
    w('manage_journal.php', JOURNAL_STUB)   # (round 21) the journal's list (and any POST), answered
    os.makedirs(os.path.join(stage, '_src'), exist_ok=True)
    w(os.path.join('_src', 'manage_dashboard.php'), texts['mdash'])   # (round 13) dash_gate_tests.php reads it here; the browser gets the fixture list
    w(os.path.join('_src', 'ai_assist.php'), texts.get('aia', ''))   # (round 19a) ai_stream_tests.php reads it here
    w('manage_dashboard.php', DASH_LIST_FIXTURE)
    w('manage_dashboard_none.json', '{"status": "success", "data": []}')
    w('quicksearch_epa.json', QS_EPA_FIXTURE)   # (2026-10-21) the quicksearch's answer for psrank (the driver points the box's call here)
    # (round 7) the functions and tags index as the harness serves it (help_functions.json), built by PHP from the
    # staged builder over the live help sources; the control (no builder on live) gets an empty object
    os.makedirs(os.path.join(stage, 'help'), exist_ok=True)
    w(os.path.join('help', 'functions_index.php'), texts['fni'])
    w('help_functions.json', fn_index_json() if texts['fni'] else '{}')

PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
def fn_index_run(check):
    """(round 7) fn_index_build.php over the staged builder: the JSON, or (ok, the last line) with --check."""
    argv = [PHP, '-n', os.path.join(HERE, 'fn_index_build.php'), '--index', os.path.join(stage, 'help', 'functions_index.php'), '--help', os.path.join(APP, 'help'),
            '--main', os.path.join(stage, 'main_hc.js')] + (['--check'] if check else [])
    try:
        r = subprocess.run(argv, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120, cwd=tempfile.gettempdir())
    except Exception as e:
        return (False, 'fn_index_build.php: %s' % e) if check else '{}'
    if not check: return r.stdout if r.returncode == 0 and r.stdout.strip().startswith('{') else '{}'
    lines = [x for x in (r.stdout or '').splitlines() if x.strip()]
    return (r.returncode == 0 and bool(lines) and lines[-1].startswith('FNIDX: GREEN'), (lines[-1] if lines else (r.stderr or 'no output'))[:300])
def fn_index_json(): return fn_index_run(False)
def render_chrome(what):
    """(round 12) render_chrome.php over the staged chrome, from the app folder (its helpers), as an admin."""
    try:
        r = subprocess.run([PHP, '-n', '-f', os.path.join(HERE, 'render_chrome.php'), '--', '--chrome', os.path.join(stage, 'penumbra_admin_chrome.php'), '--what', what, '--admin', '1'],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120, cwd=APP)
        if r.returncode != 0 or 'Fatal error' in (r.stdout or ''): print('    render_chrome %s: %s' % (what, (r.stdout or r.stderr)[:300])); return ''
        return r.stdout
    except Exception as e:
        print('    render_chrome %s: %s' % (what, e)); return ''
def gate_tests():
    """(round 5) gate_tests.php over the staged get_server_reports.php: (ok, the last line)."""
    try:
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'gate_tests.php'), '--file', os.path.join(stage, 'get_server_reports.php'), '--gate', os.path.join(stage, 'penumbra_discovery.php')],
                           capture_output=True, text=True, timeout=120, cwd=tempfile.gettempdir())
        lines = [x for x in (r.stdout or '').splitlines() if x.strip()]
        return (r.returncode == 0 and bool(lines) and lines[-1].startswith('GATE: GREEN'), (lines[-1] if lines else (r.stderr or 'no output'))[:300])
    except Exception as e:
        return (False, 'gate_tests.php: %s' % e)

def dash_gate_tests():
    """(round 13) dash_gate_tests.php over the staged manage_dashboard.php + penumbra_discovery.php: (ok, the last line)."""
    try:
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'dash_gate_tests.php'), '--file', os.path.join(stage, '_src', 'manage_dashboard.php'), '--gate', os.path.join(stage, 'penumbra_discovery.php')],
                           capture_output=True, text=True, timeout=120, cwd=tempfile.gettempdir())
        lines = [x for x in (r.stdout or '').splitlines() if x.strip()]
        return (r.returncode == 0 and bool(lines) and lines[-1].startswith('DGATE: GREEN'), (lines[-1] if lines else (r.stderr or 'no output'))[:300])
    except Exception as e:
        return (False, 'dash_gate_tests.php: %s' % e)

def contract_check(pal, prompt):
    """(round 17) the prompt's kinds and action ids agree with the module's KINDS and registry: (ok, note)."""
    try:
        kinds = re.findall(r"\{ id: '([a-z:A-Z]+)', label:", pal.split('var KINDS = [')[1].split('];')[0])
        sec = prompt.split('SECTION 6: SUGGESTED QUICK ACTIONS')[1]
        pk = set(re.findall(r'^- ([a-z:A-Z]+(?:, [a-z:A-Z]+)*) ', sec, re.M))
        pkinds = set()
        for k in pk:
            for x in k.split(', '): pkinds.add(x.split(' ')[0])
        pkinds |= set(re.findall(r'^- (col:[A-Za-z]+) \{column\}', sec, re.M))
        for x in re.findall(r'(col:[A-Za-z]+) \{column\}', sec): pkinds.add(x)
        acts = re.search(r'id one of: ([a-z, -]+)', sec).group(1).split(', ')
        reg = set(re.findall(r"\{ id: '([a-zA-Z:_-]+)'", pal))
        missing = sorted(set(kinds) - pkinds); extra = sorted(pkinds - set(kinds)); badacts = [a for a in acts if a.strip() not in reg]
        short = len(sec) < 3500 and 'penumbra-actions' in sec
        return (not missing and not extra and not badacts and short, 'kinds %d, missing %s, extra %s, bad action ids %s, section %d chars' % (len(kinds), missing, extra, badacts, len(sec)))
    except Exception as e:
        return (False, 'contract_check: %s' % e)

def time_budget_check(aia):
    """(round 18a) set_time_limit(N) sits right before the provider's curl_exec, with N above every CURLOPT_TIMEOUT in the file."""
    m = re.search(r'set_time_limit\((\d+)\);\s*\n\$response = curl_exec\(\$ch\);', aia)
    if not m: return False
    n = int(m.group(1)); tos = [int(x) for x in re.findall(r'CURLOPT_TIMEOUT, (\d+)\)', aia)]
    return bool(tos) and n > max(tos) and n <= 600   # (round 19a: a streamed answer may take minutes)

def theme_reg_json():
    """(jarbusy) theme_reg.php over the live registry: {css: the generated variable blocks, themes: [{id, label, isDark}]}."""
    try:
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'theme_reg.php'), os.path.join(APP, 'themes_config.php')], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, cwd=tempfile.gettempdir())
        if r.returncode == 0 and r.stdout.strip().startswith('{'): return r.stdout
        print('    theme_reg: %s' % (r.stdout or r.stderr)[:300])
    except Exception as e:
        print('    theme_reg: %s' % e)
    return '{"css": "", "themes": []}'
def render_themes():
    """(round 18b) the Settings panel's theme options as index.php renders them (themes_config.php via php -n); '' on failure."""
    try:
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'render_themes.php'), os.path.join(APP, 'themes_config.php')], capture_output=True, text=True, timeout=60, cwd=tempfile.gettempdir())
        return r.stdout if (r.returncode == 0 and '<option' in (r.stdout or '')) else ''
    except Exception as e:
        print('    render_themes: %s' % e); return ''

def sse_tests():
    """(round 19a) ai_stream_tests.php over the staged ai_assist.php: (ok, the last line)."""
    try:
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'ai_stream_tests.php'), '--file', os.path.join(stage, '_src', 'ai_assist.php')],
                           capture_output=True, text=True, timeout=120, cwd=tempfile.gettempdir())
        lines = [x for x in (r.stdout or '').splitlines() if x.strip()]
        return (r.returncode == 0 and bool(lines) and lines[-1].startswith('SSE: GREEN'), (lines[-1] if lines else (r.stderr or 'no output'))[:300])
    except Exception as e:
        return (False, 'ai_stream_tests.php: %s' % e)

def chrome_pages():
    """(round 12) every admin tool the registry names mounts the chrome's status bar, or IS index.php / analytics_all.php."""
    tools = re.findall(r"'href' => '([a-z_]+\.php)'", read_b(os.path.join(APP, 'penumbra_admin_chrome.php')))
    bad = []
    for page in tools:
        src = read_b(os.path.join(APP, page))
        if not src: bad.append(page + ':missing'); continue
        if 'penumbra_admin_statusbar()' in src or 'penumbra_admin_close(' in src: continue
        if re.search(r"require __DIR__ \. '/(index|analytics_all)\.php';", src): continue   # a wrapper: the engine page carries the bar / the stub
        bad.append(page + ':no bar')
    return (len(tools) >= 7 and not bad, 'tools %s bad %s' % (tools, bad))

def static_checks(texts):
    idx, main, pal, stub, menu = texts['index'], texts['main'], texts['pal'], texts['stub'], texts['menu']
    # every control id the registry names is in index.php (pnbSubscribeBtn is built by main.js; the
    # palette's own ids and the Ask page's live in the module / the help topic)
    ids = set(re.findall(r"(?:tool|toolRun|has|el)\('([A-Za-z]+)'\)", pal)) - {'pnbPalette', 'pnbPaletteInput', 'pnbPaletteList', 'pnbPaletteIcons', 'pnbAskQ', 'pnbAskForm'}
    # (round 6) the dashboard page's controls live in dashboard.php / penumbra_dashboard.js
    dash_src = texts.get('dash', '') + read_b(os.path.join(APP, 'js', 'penumbra_dashboard.js'))
    missing_ids = sorted(i for i in ids if ('id="%s"' % i) not in idx and ("id=\"%s\"" % i) not in main and ("id: '%s'" % i) not in main and ("id='%s'" % i) not in main and ('#%s' % i) not in main
                         and ('id="%s"' % i) not in dash_src and ("id=\"%s\"" % i) not in dash_src)
    fns = [('openVersionHistory', main), ('penumbraOpenRepo', main), ('openSearchBuilder', main), ('penumbraToggleShortcutSheet', main), ('openHelpCenter', main),
           ('show_text', main), ('window.Penumbra.find', texts['main']), ('openDialog', texts['calc']), ('ungroup:', main), ('resetAll:', main), ('setFrozen:', main),
           ('frozen:', main), ('customized:', main), ('restricted:', main), ('groupingColumn:', main), ('fitAll', texts['colw']), ('resetAll', texts['colw']),
           ('resized', texts['colw']), ('canFit', texts['colw']), ('items: function (th, cell)', menu), ('active: function', read_b(os.path.join(APP, 'js', 'penumbra_cellsel.js'))),
           ('groupByColumn', main), ('spThemeSelector', idx), ('PENUMBRA_FROZEN_COLS_MAX', main)]
    missing_fns = [name for name, src in fns if name not in src]
    emd = [k for k in ('stub', 'pal', 'pcss', 'topic', 'help') if '\u2014' in texts[k]]
    # (round 2) every entry driven by a toolbar control (tool('X') / toolRun('X')) names that control as its
    # icon's twin, and the twin named is that control, so the box draws the toolbar's own icon
    under_test = {v.replace(os.sep, '/') for v in RELS.values()}
    old_group = [k for k in texts if OLD_GROUP_SIG in texts[k]]
    for rel in served_files():
        if os.path.relpath(rel, APP).replace(os.sep, '/') in under_test: continue   # (a text under test stands in for its live file)
        try: t = open(rel, 'rb').read().decode('utf-8', 'surrogateescape')
        except Exception: continue
        if OLD_GROUP_SIG in t: old_group.append(os.path.relpath(rel, APP))
    icon_bad, icon_n = [], 0
    for line in pal.splitlines():
        m = re.search(r"\{ id: '([^']+)'.*?(?:tool|toolRun)\('([A-Za-z]+)'\)", line)
        if not m: continue
        icon_n += 1
        t = re.search(r"icon: \{ twin: '([A-Za-z]+)'", line)
        if not t or t.group(1) != m.group(2): icon_bad.append(m.group(1))
    return [
        ('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_palette.off')" in idx and 'src="js/penumbra_palette_boot.js?v=' in idx
         and 'data-js="js/penumbra_palette.js?v=' in idx and 'data-css="css/penumbra_palette.css?v=' in idx, ''),
        ('S-sheetRow', "row([window.PenumbraPalette.keyLabel ? window.PenumbraPalette.keyLabel() : 'Ctrl+K']" in main and 'window.PenumbraPalette ?' in main, ''),
        ('S-clearHook', 'window.PenumbraPalette.clearRecent' in main and 'Quick actions: recent picks' in main, ''),
        ('S-menuItems', 'items: function (th, cell)' in menu and 'flatItems(buildItems(th, false, cell || null))' in menu, ''),
        ('S-help', 'id="commandPaletteHelpLightbox" class="help-topic" data-audience="viewer"' in texts['topic'] and texts['manifest'].count("'commandPaletteHelpLightbox'") >= 2
         and 'data-tip="us-tip-palette"' in texts['help'] and 'data-tip="us-tip-palette"' in pal and 'data-jump-to="cp-keys"' in texts['topic'], ''),
        ('S-registry', not missing_ids and not missing_fns, 'ids %s fns %s' % (missing_ids, missing_fns)),
        # (colmenu round 33) the width rows: Fit columns to the page runs the module's own fit; the per-column reset the menu
        # still has (its width), never the dropped act; the new list and act exempted, the old ones gone; the topic names the row
        ('S-widthRows', "{ id: 'fitpage', label: 'Fit all column widths to page'" in pal and 'run: function () { W().fitPage(firstTh()); }' in pal
         and "act: 'resetWidth'" in pal and "act: 'reset'," not in pal and "fitPage: 'a top-level entry" in pal and "resets: 'the list'" not in pal
         and 'fitPage: function (th)' in texts['colw'] and 'Fit all column widths to page' in texts['topic'], ''),
        ('S-stubSmall', 0 < len(stub.splitlines()) <= 150, '%d lines' % len(stub.splitlines())),
        ('S-noEmdash', not emd, str(emd)),
        ('S-iconsTwin', icon_n >= 12 and not icon_bad, 'toolbar entries %d, without their twin: %s' % (icon_n, icon_bad)),
        # (round 3) the sprite's #pnbi-group is candidate C, and no copy of the old drawing (the framed table)
        # remains in any served file: the texts under test plus the live tree's PHP / JS / CSS / help
        ('S-groupIcon', GROUP_C_SYMBOL in idx and not old_group, 'old drawing in: %s' % old_group),
        # (round 5) the report discovery gate, server side: gate_tests.php G1-G9 over the staged endpoint
        ('S-serverGate',) + gate_tests(),
        # (round 13) the dashboards: ONE gate file holds both gates and both endpoints require it (the one place to lift); the
        # list's cut (dash_gate_tests.php D1-D7); the module fetches the list once per open from two letters, matches the title
        # and the id (the owner and tag:NAME for an admin only), keeps the browser's history; the help names the section
        ('S-dashGate',) + dash_gate_tests(),
        ('S-gateFile', 'function penumbraReportDiscoveryAllowed($isAdmin)' in texts['disc'] and 'function penumbraDashboardDiscoveryAllowed($isAdmin)' in texts['disc']
         and 'return penumbraReportDiscoveryAllowed($isAdmin);' in texts['disc'] and texts['disc'].count('function penumbra') == 2
         and "require_once 'penumbra_discovery.php';" in texts['gsr'] and 'function penumbraReportDiscoveryAllowed' not in texts['gsr']
         and "require_once 'penumbra_discovery.php';" in texts['mdash'], ''),
        ('S-dashClient', "x.open('GET', 'manage_dashboard.php?action=list', true);" in pal and 'if (dashFetched || q.length < 2) { return; }' in pal
         and "match(q, d.title, d.id + (admin ? ' ' + d.owner : ''))" in pal and 'if (tag) { if (admin && ' in pal and "secD = { title: 'Dashboards'" in pal
         and "window.location.assign('dashboard.php?id=' + encodeURIComponent(h.d.id))" in pal, ''),
        ('S-dashRecents', "localStorage.setItem('pnb_recent_dashboards'" in pal and 'if (onDashboard()) { try { var dv = (typeof penumbra_dash_vars !== ' in pal and 'dv.shortId && dv.found' in pal, ''),
        ('S-dashHelp', texts['topic'].count('Dashboards</td>') == 1 and 'the dashboards you own or have opened' in texts['topic'] and 'tag:NAME' in texts['topic'], ''),
        # (round 13) the metrics row: one entry, the report's own page in a new tab, hidden off a saved report's page
        # (round 14) the grammar's own exports (the builder's parser, serializer and quoting) and the hand-offs that use them:
        # the condition parsed and re-serialized, the phrase quoted, the box written through the search action, never assigned
        ('S-grammarExports', 'parseCondition: reverseParseCondition,' in texts['sb'] and 'conditionToSyntax: conditionToSyntax,' in texts['sb']
         and 'formatValue: formatValue,' in texts['sb'] and 'resolveColumn: resolveColumnName,' in texts['sb'], ''),
        ('S-handoffs', 'p = g.parseCondition(t);' in pal and 'g.conditionToSyntax(p.column, p.operator,' in pal and 'var term = g ? g.formatValue(t) : t, merged2 = addCond(term);' in pal
         and "a.setAttribute('data-action-name', 'search');" in pal and "setTimeout(function () { F.open(t); }, 0);" in pal
         and "el('tableSearch').value =" not in pal and "getElementById('tableSearch').value =" not in pal and 'var hs = headers(), byName = {};' in pal, ''),
        # (round 15) the dialog words read from the markup (no hand copy: 'wysiwyg' never appears in the module), every dialog
        # action names its dialog; the View Options rows from the panel's own checkboxes (no option id in the module); the
        # tab rows from the console's tab list
        ('S-uiWords', "var UI_SEL = '.pnb-dlg-title, .pnb-dlg-sub, label, small, h4, legend, button, option, .pnb-subset-tip';" in pal and 'root.querySelectorAll(UI_SEL)' in pal
         and 'wysiwyg' not in pal.lower() and pal.count("dlg: '#") >= 8 and '|| (question ? null : uiMatch(q, e))' in pal, ''),
        ('S-voSource', "tab.querySelectorAll('.view-option-item input[type=\"checkbox\"]')" in pal and 'viewOptionClickFilter' not in pal and 'viewOptionBareHeader' not in pal
         and "spotlight(t, f); }); } });" in pal and 'f.click()' not in pal, ''),   # (round 22) the option looked up again at run time
        ('S-tabsSource', "var out = [], as = tabLinks();" in pal and "t.querySelectorAll('li > a[href^=\"#\"]')" in pal and "click(el('addNewTaskBtn'))" in pal and "s.value = 'EMAIL';" in pal, ''),
        # (round 16) the gate is the server's own, read by index.php into penumbra_vars.aiAllowed and read bare by the module; the
        # send is the panel's own Enter handler, dispatched once, the summary box and the send button untouched by the module;
        # main.js reads the panel PiP-aware in its send and its message append
        ('S-jarvisGate', 'aiAllowed: <?php echo json_encode((bool)penumbraIsConsoleAudience($isAdmin, $userGrants, $currentUserKey)); ?>,' in idx
         and "function jarvisOn() { return !!vars().aiAllowed && !!vars().canEditReport && !!(window.penumbraAi || el('toggleAiPanel')) && !!reportId() && !onDashboard() && !onAdminPage(); }" in pal
         and "var $input = $(window._pnbById ? window._pnbById('aiChatInput') : '#aiChatInput');" in main and "var $container = $(window._pnbById ? window._pnbById('aiChatMessages') : '#aiChatMessages');" in main, ''),
        # (jarvispal, 2026-10-22) the two ask rows: Ask Jarvis in the slot puts Ask help right under it; the sub-lines name the paid
        # assistant and the help text; the header comment and the topic say the same (the topic: the writers' rule, the no-panel rule)
        ('S-askRows', "if (jarLeads && ask.length) { var askRow = ask[0]; secQ.items.splice(secQ.items.indexOf(askRow), 1); sections[0].items.push(askRow); }" in pal
         and "sub: 'the paid AI assistant: help, SQL, custom code and data'" in pal and "sub: question ? 'answers from the help text only, with the pages it used' : 'answers from the help text only'" in pal
         and ' *   Jarvis    "Ask Jarvis: ..."' in pal and 'the paid assistant (help, SQL, custom code and data)' in texts['topic'] and '<em>Ask help: ...</em> right under it' in texts['topic']
         and 'answers from the help text only' in texts['topic'] and 'Without the panel, Ask help stays first' in texts['topic'], ''),
        ('S-jarvisOnce', pal.count("var sb = byId('aiSendBtn'); if (sb) { click(sb); }") == 1 and pal.count("byId('aiSendBtn')") == 1 and 'aiProfileOn' not in pal
         and "typeof window._pnbById === 'function'" in pal, ''),
        # (round 17) the contract: the prompt's kinds and action ids agree with the module's (static per deploy); the chips are safe: the
        # block cut out before rendering, the label escaped, the arguments kept as data (never attributes), the gates in resolve
        ('S-contract',) + contract_check(pal, texts.get('prompt', '')),
        # (round 18a) the proxy's time budget covers the provider call: set right before curl_exec and above every CURLOPT_TIMEOUT
        ('S-aiTimeBudget', time_budget_check(texts.get('aia', '')), ''),
        # (round 19b) the box renders the answer with the panel's own renderer, through the panel's own request
        ('S-inPlace', 'window.penumbraAi = {' in main and 'function penumbraAiContextParts(dbType) {' in main and 'var contextParts = penumbraAiContextParts(dbType);' in main
         and "ans.innerHTML = AI.render(split.text);" in pal and "setMode({ kind: 'jarvis', q: text, state: 'waiting' }, true);" in pal and 'jarvisCancel(); close(true);' in pal, ''),
        # (round 19a) the streamed call: requested, consumed by the write function, budgeted (330 s, a 60-s stall), the client waits 340 s
        ('S-aiStream', "'stream' => true," in texts.get('aia', '') and 'curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($c, $chunk) use (&$sse, &$raw) { $raw .= $chunk; penumbra_ai_sse_consume($chunk, $sse); return strlen($chunk); });' in texts.get('aia', '')
         and 'curl_setopt($ch, CURLOPT_TIMEOUT, 330);' in texts.get('aia', '') and 'curl_setopt($ch, CURLOPT_LOW_SPEED_TIME, 60);' in texts.get('aia', '') and "'max_tokens' => 8000," in texts.get('aia', '')
         and 'timeout: 340000,' in main and "if ($ai_provider === 'anthropic') { $response = $raw; }" in texts.get('aia', ''), ''),
        ('S-aiStreamParse',) + sse_tests(),
        # (jarbusy, 2026-10-23) the busy card while Jarvis thinks: drawn by the module (no live region of its own, the status said once,
        # brought into view), animated in the stylesheet by three keyframes and held still under reduced motion (a full bar, solid dots,
        # plain lines); the hint never faded by opacity; the error in the themes' danger token
        ('S-jarBusy', "if (waiting) { html += jarvisBusyHtml(); }" in pal and "var JARVIS_BUSY = 'Jarvis is thinking. Esc cancels.';" in pal
         and "if (ui.status.textContent !== st) { status(st); }" in pal and 'aria-live="polite">Thinking' not in pal and "card.scrollIntoView({ block: 'nearest' })" in pal
         and all(('@keyframes %s ' % k) in texts['pcss'] for k in ('pnbPalAiBar', 'pnbPalAiDot', 'pnbPalAiShimmer'))
         and '@media (prefers-reduced-motion: reduce) {\n    .pnb-pal-ai-bar i { animation: none; width: 100%;' in texts['pcss'].replace('\r\n', '\n')
         and '    .pnb-pal-ai-dots i { animation: none; opacity: 1; transform: none; }' in texts['pcss'] and '    .pnb-pal-ai-skel i { animation: none;' in texts['pcss']
         and ('opacity' not in texts['pcss'].split('.pnb-pal-ai-hint {')[1].split('}')[0] if '.pnb-pal-ai-hint {' in texts['pcss'] else False)
         and 'var(--danger, #b00020)' not in texts['pcss'] and '.pnb-pal-ai-wait.pnb-pal-ai-err { color: var(--accent-danger, #c62828); }' in texts['pcss']
         and '    .pnb-pal-ai-bar i, .pnb-pal-ai-dots i { forced-color-adjust: none; background-color: Highlight; }' in texts['pcss'], ''),
        # (jaredge, 2026-10-23) the waiting state's edges: the Esc chip cancels as the key does; Backspace back from the Jarvis view (and only
        # from it) drops a waiting question; one question at a time (the one on its way shown again, said so; a handler that ran at once
        # settles the ask); the Jarvis view clears the input's aria-activedescendant
        ('S-jarEdge', "ui.esc.addEventListener('click', function (e) { e.preventDefault(); jarvisCancel(); close(true); });" in pal
         and "if (mode.kind === 'jarvis') { jarvisCancel(); }" in pal
         and "if (jarvisQ !== null) { setMode({ kind: 'jarvis', q: jarvisQ, state: 'waiting', still: true }, true); return; }" in pal
         and "if (!settled) { jarvisReq = req; jarvisQ = text; }" in pal and "if (waiting && mode.still) { st = JARVIS_STILL; }" in pal
         and "var JARVIS_STILL = 'Jarvis is still answering your last question. Esc cancels it.';" in pal
         and "ui.input.removeAttribute('aria-activedescendant');   // (jaredge)" in pal, ''),
        # (the final sweep) the journal row follows the button; greyed rows at an AA-friendly opacity; the tip names the slot
        ('S-final', 'function journalCompose(draft) {' in pal and "var jb = el('journalBtn'), journalOn = !!(jb && shown(jb));" in pal and '.pnb-pal-it.is-off .pnb-pal-lab, .pnb-pal-it.is-off .pnb-pal-pos { color: var(--text-muted, #666); }' in texts['pcss'] and '.pnb-pal-it.is-sel .pnb-pal-lab { color: color-mix(in srgb, var(--brand-text, var(--brand-primary, #336699)) 60%, var(--text-main, #222));' in texts['pcss'] and 'var(--text-muted, #666) 65%, var(--text-main, #222)' in texts['pcss'] and 'border: 1px solid color-mix(in srgb, var(--accent-success, #1a7f37) 55%, transparent);' in texts['pcss'] and 'function rowText(r) {' in pal and 'rowText(r).replace' in pal and 'uiWordsCache[key] = e.ui;' in pal
         and 'add a note, unhide, group by, ask)' in texts['help'] and 'add a note, unhide, group by, ask)' in texts['topic'] and "'copy distinct values of': 'copydistinct', 'column options of': 'colopts' }[cm[1]];" in pal, ''),
        # (round 23) the inventory: every control an entry point or a listed reason; the Table info rows from the server's list through the exported opener
        ('S-entryPoints',) + (lambda r: (not r[1], 'inventory %d, without a row or a reason: %s' % (len(r[0]), r[1])))(entry_points_check(texts)),
        ('S-r23', 'function tableEntries()' in pal and 'vars().reportTables' in pal and 'window.penumbraShowTableInfo(name)' in pal and 'window.penumbraShowTableInfo = function (t, tab) { showTableInfoDialog(String(t || \'\'), tab); };' in main
         and 'reportTables: <?php echo json_encode(array_values(array_map(\'strval\', is_array($reportTables) ? $reportTables : array())));' in idx and 'Table info: TABLE' in texts['topic'], ''),
        # (round 22) the row from the first word: the rest optional, the partial handed to the dialog uncommitted, the verb rule in the redaction
        ('S-r22', 'function topMatch(q, c)' in pal and "sections.unshift({ title: 'Top match', items: [top] });" in pal and 'function tabLinks()' in pal and "'#editorTabs > ul" not in pal
         and "(?:\\s+to\\b)?(?:\\s+(.*))?$/i;" in pal and "if (!done) { partial = x; return; }" in pal and "if (partial) { rest.push(partial); }" in pal
         and "t = e[1] + ' [recipients]';" in pal and 'keep typing, or press Enter to finish the address in the dialog' in pal and 'a half-typed recipient is left in the input' in texts['topic'], ''),
        # (round 21) the notes and the email go through the editors' and the dialog's own paths; the redaction sits before the beacon
        ('S-r21', 'function noteRows(q)' in pal and 'function mailRows(q)' in pal and "window.commitPendingRecipients('#emailInputReal', '#emailRecipientContainer')" in pal
         and "autocomplete('search', lastTok)" in pal and 'function missRedact(text)' in pal and '        text = missRedact(text);' in pal
         and 'window.penumbraLooksLikeEmail = penumbraLooksLikeEmail;' in main and 'setText: setText,' in main and 'window.Penumbra.noteCardPrefill = function (text) {' in main
         and 'compose: function (text) { open();' in texts.get('journal', '') and 'Add a note to the Report journal' in texts['topic'] and 'Email this report to' in texts['topic'], ''),
        # (round 20) the Show rows run the menu's own items, the jumps go through findHost, the verb router exists, the help and the stylesheet carry the round
        ('S-r20', "showAll: 'a top-level entry (Show all hidden columns)'" in pal and 'function showEntries()' in pal and 'function jumpRows(q)' in pal and 'function verbRoute(q)' in pal
         and 'FH.showRow(tr)' in pal and 'FH.fillRow(tr)' in pal and 'pnb-pal-rowspot' in pal and 'pnb-pal-rowspot' in texts['pcss']
         and 'Show all hidden columns' in texts['topic'] and 'Go to a row or a page' in texts['topic'] and 'a verb first' in texts['topic'], ''),
        # (round 18b) the theme rows come from the page's own select (themeOptions), no theme name is written in the module
        ('S-themeSource', "themeOptions().forEach(function (t) {\n            out.push({ id: 'combo:theme:' + t.value, label: 'Theme: ' + t.label," in pal
         and 'Default Light' not in pal and 'Dark Blue' not in pal and "if (o.value === 'report-default') { return; }" in pal, ''),
        ('S-chipsSafe', '$msg.html(renderAiMarkdown(split.text));' in main and "$chip.data('pnbAction', { id: a.id, args: a.args });" in main and '_pnbAiEsc(r.label)' in main
         and 'eval(' not in main.split('function _pnbAiActionsSplit')[1].split('function appendAiMessage')[0]
         and "if (!visible(e, '') || dashHidden(e) || (typeof e.hide === 'function' && e.hide())) { return false; }" in pal and 'P.describe = function' in pal and 'P.resolve = function' in pal and 'P.run = function' in pal, ''),
        ('S-metricsRow', pal.count("id: 'metrics-report'") == 1 and "window.open('analytics.php?id=' + encodeURIComponent(reportId()), '_blank', 'noopener')" in pal
         and 'hide: function () { return !reportId() || onDashboard() || onAdminPage(); }, needs: function () { return !onDashboard() && !onAdminPage(); },' in pal
         and 'metrics: ' in pal.split('var PAL_SYMBOLS = {')[1][:2000], ''),
        ('S-clientGate', "if (!reportDiscoveryAllowed()) { return; }" in pal and "function reportDiscoveryAllowed() { return isGlobal(); }" in pal, ''),
        # (round 6) the stub on dashboard.php (the same tag, the same switch); the magnifier and the card's row in
        # index.php; the stylesheet names the magnifier where it names the "?"; the module reads the top-level const
        # and sends a report row to index.php; the key rule (the one .CodeMirror mention in the stub is refocus's);
        # the help names the Mac key and the two new ways in
        ('S-dashStub', 'src="js/penumbra_palette_boot.js?v=' in texts['dash'] and 'data-js="js/penumbra_palette.js?v=' in texts['dash']
         and "file_exists(__DIR__ . '/js/penumbra_palette.off')" in texts['dash'], ''),
        ('S-crumbIcon', 'id="searchPaletteIcon" data-pnb-palette="open" data-pnb-from="crumb"' in idx and '(Ctrl+K)"' in idx
         and "isset($pnbPaletteIconHtml) ? $pnbPaletteIconHtml : ''" in idx, ''),
        # (round 10) the bar's Search button right after Help in index.php's footer, on the palette switch; the row gone
        ('S-popBtn', idx.count('id="sbPaletteBtn" data-pnb-palette="open" role="button" title="Quick actions: run an action, jump to a column, report or help (Ctrl+K)"') == 1
         and '? Help</a>\n                <?php if (!empty($pnbPaletteOn)):' in idx and '</svg> Quick actions</a>' in idx and '.pnb-foot-ico {' in texts['css'], ''),
        # (round 11) the name wherever a user sees it (markup, not comments), the bolt on every surface, the Esc button
        ('S-quickName', 'aria-label="Quick actions"' in pal and 'aria-label="Quick actions"' in stub and "'Quick actions: run an action, a column" in main
         and '<h3 style="margin: 0 0 4px;">Quick actions</h3>' in texts['topic'] and '<h4>Quick actions</h4>' in texts['help'] and "'title' => 'Quick actions'" in texts['manifest']
         and not [l for l in (idx + pal + stub).splitlines() if ('Command palette' in l or 'Search actions' in l or 'Search</a>' in l) and not l.strip().startswith(('//', '*', '/*', '<?php /*', 'if (!file_exists'))]
         and 'Command Palette' not in texts['topic'] and 'Command Palette' not in texts['help'], ''),
        ('S-bolt', '<symbol id="pnbi-quick" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>' in idx
         and idx.count('<use href="#pnbi-quick"/>') == 2 and "quick: '<polygon points=\"13 2 3 14 12 14 11 22 21 10 12 10 13 2\"/>'" in pal and '<use href="#pnbpal-quick"/>' in pal
         and 'points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"' in stub and '&#128269;' not in pal and 'circle cx="10.5"' not in idx, ''),
        # (round 12) the tools JSON comes from the menu's own loop over the registry (no second list anywhere: the module
        # names no tool); the chrome's bar carries the stub on the switch + the admin flag + the card button; every admin
        # tool page mounts that bar (or IS index.php / analytics_all.php)
        ('S-toolsSource', "echo '<script>window.PENUMBRA_ADMIN_TOOLS = ' . json_encode($rows, JSON_HEX_TAG" in texts['chrome'] and "$rows[] = array('id' => (string)$key, 'label' => (string)$t['label'], 'href' => (string)$t['href']," in texts['chrome']
         and 'window.PENUMBRA_ADMIN_TOOLS' in pal and not re.search(r"(grants_admin|tags_admin|health|system_notice|analytics_all|repository|calendar)\.php", pal)
         and texts['chrome'].count("'desc' =>") >= 7, ''),
        ('S-adminStub', "file_exists(__DIR__ . '/js/penumbra_palette.off')" in texts['chrome'] and 'src="js/penumbra_palette_boot.js?v=' in texts['chrome'] and 'data-fn="help_functions.php?v=<?php echo pnb_help_functions_ver(); ?>"' in texts['chrome']
         and "window.PENUMBRA_ADMIN_VARS = { isAdmin: <?php echo !empty($isAdmin) ? 'true' : 'false'; ?>, page: 'admin' }" in texts['chrome']
         and 'id="sbPaletteBtn" data-pnb-palette="open" role="button"' in texts['chrome'], ''),
        ('S-chromePages',) + chrome_pages(),
        ('S-escButton', '<button type="button" class="pnb-pal-kbd pnb-pal-esc" aria-label="Close quick actions" tabindex="-1"' in pal
         and '<button type="button" class="pnb-pal-kbd pnb-pal-esc" aria-label="Close quick actions" tabindex="-1"' in stub and '.pnb-pal-esc:hover, .pnb-pal-esc:focus-visible' in texts['pcss'], ''),
        ('S-rowGone', 'sbPaletteRow' not in idx and 'sb-pal-row' not in idx and 'sb-pal-row' not in texts['css'] and 'sb-pal-key' not in texts['css'], ''),
        ('S-cssIcon', texts['css'].count('#searchPaletteIcon') >= 10 and '#searchPaletteIcon {' in texts['css'] and '.pnb-crumb #searchPaletteIcon' in texts['css']
         and '#pnbStatusBar .sb-upop-foot .pnb-foot-ico' in texts['css'], '%d mentions' % texts['css'].count('#searchPaletteIcon')),   # (round 10: the bar's icon rule, the row's gone)
        ('S-varsBare', "typeof penumbra_vars !== 'undefined' && penumbra_vars" in pal and "typeof penumbra_dash_vars !== 'undefined'" in pal, ''),
        ('S-reportHref', "window.location.assign('index.php?id=' + encodeURIComponent(h.r.id));" in pal and "assign('?id='" not in pal, ''),
        ('S-keyRule', "return mac() ? (e.metaKey && !e.ctrlKey) : (e.ctrlKey && !e.metaKey);" in stub and stub.count("closest('.CodeMirror')") == 1
         and "closest('.CodeMirror')" in stub.split('function refocus')[-1].split('function relabel')[0], ''),
        ('S-helpCopy', 'on a Mac <kbd>Cmd</kbd>+<kbd>K</kbd>' in texts['topic'] and 'lightning bolt' in texts['topic'] and "profile card's <em>Quick actions</em> button" in texts['topic']
         and 'on a Mac <kbd>Cmd</kbd>+<kbd>K</kbd>' in texts['help'] and 'lightning bolt' in texts['help'], ''),
        # (round 7) the index's integrity (fn_index_build.php --check over the staged builder and the live sources); the
        # index fetched from open() only (one call site, none in the stub); the help; the pages' ?v= and the endpoint's
        # cache header; the signature style
        ('S-fnIndex',) + ((fn_index_run(True)) if texts['fni'] else (False, 'no help/functions_index.php')),
        ('S-fnLazy', pal.count('loadFnIndex();') == 1 and "        if (fnState === 'idle') { loadFnIndex(); }" in pal and 'loadFnIndex' not in stub and 'P.loadFnIndex' not in pal, ''),
        ('S-fnHelp', 'Functions and tags</td>' in texts['topic'] and '<kbd>Shift</kbd>+<kbd>Enter</kbd>' in texts['topic'] and 'SQL bracket tags' in texts['help'], ''),
        ('S-fnVer', idx.count('data-fn="help_functions.php?v=<?php echo pnb_help_functions_ver(); ?>"') == 1 and texts['dash'].count('data-fn="help_functions.php?v=<?php echo pnb_help_functions_ver(); ?>"') == 1
         and "require_once __DIR__ . '/help/functions_index.php'" in idx and "require_once __DIR__ . '/help/functions_index.php'" in texts['dash']
         and "Cache-Control: private, max-age=604800" in texts['fnep'] and "require_once 'db_connection.php';" in texts['fnep'], ''),
        ('S-fnCss', '.pnb-pal-sig {' in texts['pcss'] and 'monospace' in texts['pcss'].split('.pnb-pal-sig {')[1].split('}')[0], ''),
        # (round 8) the one main.js line; the help; the page's owner flag; the default spec as main.js's grammar has it
        ('S-feedbackExport', main.count('window.penumbraOpenFeedbackDialog = penumbraOpenFeedbackDialog;') == 1, ''),
        ('S-feedbackHelp', 'Send feedback to the report owner...' in texts['topic'] and 'Freeze a copy of this dataset for review' in texts['topic'], ''),
        ('S-ownerVar', 'isReportOwner: <?php echo json_encode(isset($owner_id) && isset($currentUserKey) && penumbraIsReportOwner($owner_id, $currentUserKey)); ?>' in idx, ''),
        ('S-feedbackSpec', "var FEEDBACK_DEFAULT_SPEC = 'freeze ; Bug|What happened?* ; Suggestion|What would help? ; Question|What would you like to know?';" in pal
         and "label: 'Send feedback to the report owner...'" in pal and "'You own this report" in pal, ''),
        # (round 9) the width and paddings in the stylesheet; the one-word rule in the matcher; the owner's reason
        ('S-boxWide', '.pnb-pal {\n    width: min(760px, 100%);' in texts['pcss'].replace('\r\n', '\n') and 'padding: 13px 15px;' in texts['pcss'] and 'padding: 9px 5px;' in texts['pcss']
         and 'padding: 11px 17px;' in texts['pcss'] and 'flex-wrap: nowrap;' in texts['pcss'] and 'max-width: 50%;' in texts['pcss'], ''),
        ('S-fuzzyWord', "if (q.length >= 3) {" in pal and "/[^a-z0-9]/.test(span)" in pal, ''),
        ('S-ownerReason', "'You own this report, so feedback would come to you'" in pal, ''),
        # (2026-10-25, nestgb) the Columns section names a nested table's columns in Group by
        ('S-nestGroupHelp', '<em>Nested table columns</em>' in texts['topic'] and 'A row joins the group of each value its table holds' in texts['topic']
         and chr(0x2014) not in texts['topic'], ''),
        # (2026-10-25, nestcopy) ...and Copy distinct values the same way
        # (2026-10-27, copymenu) This row's items name Copy this row
        ('S-copyRowHelp', 'Filter to its value, Exclude it, At least or At most it (a number or a date), Copy this value, Copy this row, Copy this nested table, Add a note to this row.' in texts['topic'] and chr(0x2014) not in texts['topic'], ''),
        ('S-nestCopyHelp', 'Copy distinct values follows the same rule' in texts['topic'] and '<em>Copy distinct values of PARENT-NAME...</em>' in texts['topic']
         and chr(0x2014) not in texts['topic'], ''),
    ]

# (round 4) the ink of an icon's crop: the share of pixels that differ from the crop's corner (the
# background). An outlined 24-box icon inks 10-40% of its box; a filled blob 50% and more, or a few dots.
def ink_ratio(im, rect):
    x, y, w, h = rect
    px = list(im.crop((x, y, x + w, y + h)).getdata())
    bg = px[0]
    return sum(1 for q in px if abs(q[0] - bg[0]) + abs(q[1] - bg[1]) + abs(q[2] - bg[2]) > 90) / float(len(px))
def ink_checks(png, info):
    try:
        from PIL import Image
        im = Image.open(png).convert('RGB')
    except Exception as e:
        return {'inkPalette': False, 'inkMatch': False}, 'PIL/screenshot: %s' % e
    rects = (info or {}).get('rects') or {}
    rs, bad_p, bad_m = {}, [], []
    for k, v in rects.items():
        if not v or not v.get('pal') or not v.get('tb'): bad_p.append(k + ':missing'); continue
        a, b = ink_ratio(im, v['pal']), ink_ratio(im, v['tb'])
        rs[k] = (round(a, 3), round(b, 3))
        # (measured: the fixed 16px icons ink 0.30-0.46, live's filled blobs 0.56 / 0.64 and the "two dots" group 0.04)
        if not (0.08 <= a <= 0.52): bad_p.append('%s:%.2f' % (k, a))
        if abs(a - b) >= 0.15: bad_m.append('%s:%.2f vs %.2f' % (k, a, b))
    return {'inkPalette': len(rs) >= 3 and not bad_p, 'inkMatch': len(rs) >= 3 and not bad_m}, 'ink %s bad %s %s' % (rs, bad_p, bad_m)
SHOT_PATH = os.environ.get('PNB_SHOT') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot.png')
SHOT6_PATH = os.environ.get('PNB_SHOT6') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot6.png')   # (round 6) the breadcrumb + the card
SHOT7 = {'pshot7f': os.environ.get('PNB_SHOT7F') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot7f.png'), 'pshot7t': os.environ.get('PNB_SHOT7T') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot7t.png'),
         'pshot8': os.environ.get('PNB_SHOT8') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot8.png'),
         'pshot9': os.environ.get('PNB_SHOT9') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot9.png'),
         'pshot10': os.environ.get('PNB_SHOT10') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot10.png'),
         'pshot11': os.environ.get('PNB_SHOT11') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot11.png'),
         'pshot12': os.environ.get('PNB_SHOT12') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot12.png'),
         'pshot14a': os.environ.get('PNB_SHOT14A') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot14a.png'),   # (round 14) "sponsor nih"
         'pshot14b': os.environ.get('PNB_SHOT14B') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot14b.png'),   # (round 14) a no-match text
         'pshot15': os.environ.get('PNB_SHOT15') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot15.png'),   # (round 15) "view options" as an admin
         'pshot16': os.environ.get('PNB_SHOT16') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot16.png'),   # (round 16) a question, Ask Jarvis first
         'pshot17': os.environ.get('PNB_SHOT17') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot17.png'),   # (round 17) a reply with chips
         'pshot19': os.environ.get('PNB_SHOT19') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot19.png'),   # (round 19b) an answer in the box
         'pshot20': os.environ.get('PNB_SHOT20') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot20.png'),   # (round 20) "row 250": Go to first
         'pshot21': os.environ.get('PNB_SHOT21') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shot21.png')}   # (round 21) an email row first

SHOT7['pshotjb'] = os.environ.get('PNB_SHOTJB') or os.path.join(tempfile.gettempdir(), 'pnb_palette_shotjb.png')   # (jarbusy) the busy card
# (2026-10-30, selflt) the rows' help line names the selection's rows (the line S-copyRowHelp pins kept as it was)
_static_checks_before_sel = static_checks
def static_checks(texts):
    return _static_checks_before_sel(texts) + [
        ('S-selRowHelp', 'In a selection of several cells: Filter to the selected values, Exclude the selected values, Copy the selected cells.' in texts['topic'] and chr(0x2014) not in texts['topic'], ''),
    ]
def run_browser(scns):
    out = []
    for s in scns:
        r = run_page(('dash.html?scn=%s' if s.startswith('pdash') else ('adm.html?scn=%s' if s in ('padmin', 'pshot12') else 'harness.html?scn=%s')) % s, SHOT_PATH if s == 'pshot' else (SHOT6_PATH if s == 'pshot6' else SHOT7.get(s)))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:4000])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        if s == 'pshot':
            ink, note = ink_checks(SHOT_PATH, r.get('info'))
            chk.update(ink); r.setdefault('info', {})['ink'] = note; print('    screenshot: %s' % SHOT_PATH)
        if s == 'pshot6': print('    screenshot: %s rects %s' % (SHOT6_PATH, json.dumps((r.get('info') or {}).get('rects'))))
        full = bool(os.environ.get('PNB_INFO'))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:None if full else 700]) if (v is not True or full) else '')))
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
            res = run_browser(scns) + static_checks(t)   # (the static checks too: a static-only mutant must show its kill)
            red = [a for a, p, _ in res if not p]
            # a dead page is NOT a kill: the must-checks have to go red on a page that still runs (a mutant
            # that crashes the scenario is a harness problem to fix, and would hide a survivor)
            dead = [(a[2:], dd) for a, p, dd in res if a.startswith('F-') and not p]
            good = not dead and not [x for x in must if x not in red]
            for d, dd in dead: print('    DEAD %s: %s' % (d, dd[:1500]))
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, dd if os.environ.get('PNB_INFO') else dd[:700]))
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
