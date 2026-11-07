# =============================================================================
# cards - the card view (rows drawn as cards), 2026-10-28
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S,S] [--shots DIR]
# Headless Edge over CDP on the colmenu harness (the REAL main.js); stages into %TEMP%\pnb_cd_*;
# writes nothing to the webroot. One headless-Edge suite at a time.
# Parity with the table (filter, sort, hidden columns, paging, grouping), the table's own formats
# and highlight rules in the pill, the data bar in the bar, escaping, the auto-guess, the authoring
# form's round trip (save / re-open / re-edit), the view link (cv), the switch hidden when off and
# in a pivot, a11y (roles, roving focus, keys, contrast on every registry theme), phone width,
# 1,000 cards under 300 ms, the 1,000-card step. Static: index.php's markup and include block, the
# palette rows, help topic + tip + manifest, README, main.js's hooks, no em-dash.
# --control = live (no card view): every NEW check red, every other check green.
# =============================================================================
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, urllib.parse, zlib
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_colfmt.js', 'penumbra_calc.js',
        'penumbra_colwidths.js', 'penumbra_colmenu.js', 'jspdf-2.5.1.umd.min.js', 'jspdf-autotable-3.5.23.min.js']
CSS = ['density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css', 'penumbra_colmenu.css', 'penumbra_find.css']

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
shots_dir = opt('--shots', None)
if shots_dir: os.makedirs(shots_dir, exist_ok=True)
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = APP if control else (stage_dir or APP)
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'index': 'index.php', 'pal': os.path.join('js', 'penumbra_palette.js'),
        'cards': os.path.join('js', 'penumbra_cards.js'), 'cardscss': os.path.join('css', 'penumbra_cards.css'), 'maincss': os.path.join('css', 'main.css'),
        'topic': os.path.join('help', 'topics', 'viewoptionsHelpLightbox.php'), 'tip': os.path.join('help', 'tips', 'settings-tips-storage.php'),
        'manifest': os.path.join('help', 'manifest.php'), 'readme': 'README.md',
        'menu': os.path.join('js', 'penumbra_colmenu.js'),   # (cmenu) the menu engine: the cards' menus go through it
        'find': os.path.join('js', 'penumbra_find.js'),   # (round K) Find paints on the cards
        'ustopic': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php'),   # (round L) Settings > Cards
        'pftopic': os.path.join('help', 'topics', 'powerFeaturesHelpLightbox.php'), 'sptopic': os.path.join('help', 'topics', 'savePrefsHelpLightbox.php'),
        'vltopic': os.path.join('help', 'topics', 'viewLinkHelpLightbox.php'),   # (linkpos) the view-link help's scroll bullet
        'grptopic': os.path.join('help', 'topics', 'groupingHelpLightbox.php'), 'grptip': os.path.join('help', 'tips', 'pivot-tips-storage.php')}   # (bdlay) the grouping's Layout help
RELS['emtopic'] = os.path.join('help', 'topics', 'emailHelpLightbox.php')
RELS['wsmenu'] = os.path.join('js', 'penumbra_wsmenu.js')
RELS['calc'] = os.path.join('js', 'penumbra_calc.js')   # (viewstrict) the calculated columns under test (a visit's are the link's)   # (cardlink) Alt+Shift+L lives in the page menu   # (cmsize) the Email Report help's card sizes
def read_b(p):
    if not os.path.exists(p): return ''
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
T_NOCV = tok({'v': 1, 'm': 'flat', 'o': 'none'})   # a link without the card view: the table (the link wins over a saved pick)
T_XL = tok({'v': 1, 'm': 'flat', 'o': 'none', 'cv': 1, 'cz': 'xl'})   # (cxl) a link to the cards at Extra large

SCN = ['cgbar', 'cfmtbig', 'cfmt', 'cauto', 'cguess', 'cpage', 'cfull', 'chl', 'cbar', 'cesc', 'coff', 'cviewer', 'pcoff', 'gcards', 'gcoll', 'gncoll', 'ggcards', 'gglnest', 'csize', 'cszvlA', 'cszvlB', 'cnarrowA', 'cnarrowT', 'cnarrowN', 'cauth', 'cauthB', 'cauthM', 'cvlA', 'cvlB', 'cvlT', 'ca11y', 'cphone', 'cperf', 'cmore',
       'clay1', 'pw3dup', 'gw3agg', 'gw3cnt', 'ct3save', 'cw2det', 'cw2nest', 'cw2more', 'cw2pdf', 'gw2band', 'gw2mail', 'pw2piv', 'pw2next', 'cnest', 'ctclear', 'csweep', 'gsweep', 'gbcols', 'cpct', 'cfindgo', 'ctsel', 'cxl', 'cxlvl', 'cmenu', 'gmenu', 'pmenu', 'cmsize', 'gmsize', 'cdet', 'gdet', 'pdet', 'cdetph', 'cmword', 'curl1', 'curl2', 'curl3', 'curl4', 'cshare', 'cnote', 'cnotedet', 'ctmenu', 'ctrow', 'gtrow', 'cflink', 'ckword', 'cfind', 'gfind', 'cbarpick', 'csort', 'gsort', 'cempty', 'pfind', 'clayout', 'clayoutB', 'cdetrow', 'pvfind', 'cwhite', 'cdetpage', 'cdetmore', 'cseg', 'cxl2', 'cxl2ph', 'ccolsview', 'pvhtml', 'cfields', 'cfieldsB', 'gboard', 'gboardvl', 'gboardfew', 'gboardbig', 'gbandbig', 'cboard', 'cboardload', 'cboardrx', 'cbarrank', 'cvlC', 'cvlD', 'pfsort', 'cvlE', 'cvlF', 'pvlA', 'pvlB', 'pvcfg', 'pvcfgB', 'plab', 'cprint', 'gprint', 'pprint', 'cfix', 'cfixB', 'pfix', 'cfixprint', 'gfix2', 'cchips', 'cmail', 'gmail', 'pmail', 'cdens', 'cdensph', 'gdens', 'cflt', 'csave', 'copen', 'cdpack']
T_CV = tok({'v': 1, 'm': 'flat', 'o': 'none', 'cv': 1, 'cz': 'compact'})   # (curl) a view link asking for compact cards
CHK = {
    'cauto': ['switchShown', 'tableDefault', 'toCards', 'pagerWord', 'tableKeptForReaders', 'count', 'guessTitle', 'guessBig', 'guessFields', 'guessNoExtras', 'parity', 'linkKept', 'filtered', 'sorted', 'prefSaved',
              'roles', 'oneTabStop', 'arrowRight', 'arrowDown', 'enterSelects', 'escClears', 'clickSelects', 'toTable', 'prefTable', 'switchA11y'],
    # (csize) the author's default size, the viewer's size (pref), compact's parts, the form round trip; the link's cz; the phone default
    'csize': ['authorDefault', 'sizeControl', 'viewerCompact', 'compactParts', 'prefSize', 'backToStandard', 'formSize'],
    'cszvlA': ['carriesCz', 'describedCz', 'noCzStandard'], 'cszvlB': ['bootsCompact', 'prefUntouched'],
    'cnarrowA': ['narrowOpensCards'], 'cnarrowT': ['tableChoiceWins'], 'cnarrowN': ['noDefaultTable'],   # (round N) no report setup: the table on a phone
    'cguess': ['moneyOverNumber', 'fieldsNext'],
    'cpage': ['pageSize', 'nextPage', 'lastPageFilled', 'rowsPerPageAll'],
    'cfull': ['bootsCards', 'slots', 'hiddenFilled', 'pillPlain', 'barFallback', 'subShown', 'fieldLabels', 'fieldValues'],
    'chl': ['ruledPills', 'plainPills', 'pillMatchesCell',
            'edgeRuled', 'edgePlain', 'edgePainted', 'edgeDetail', 'edgeMail', 'edgeRule', 'edgeTheme',   # (cedge) the status edge
            'edgeSwatch', 'edgeSwatchMail', 'edgeSwatchTheme', 'edgeGreyTheme'],   # (cedge2) a Highlight swatch's theme variable
    # (cfmt) a cell's highlight on the title, a subtitle, the big number and a field; a plain one plain; a rule and a format
    # changed in the column options while the cards show; the details window's fields
    'cfmt': ['titleRuled', 'subRuled', 'subPlain', 'bigRuled', 'fieldRuled', 'fieldPlain', 'liveRule', 'liveFormat', 'detRuled',
             'firstDrawOnce', 'menuShown', 'buttonWords'],   # (cfmt2) one draw for a small page; Filter to names the shown value; the window's buttons
    # (cfmt2) 2,500 rows, 25 a page: main.js's format pass runs 50 ms deferred - the cards drawn again after it (a page turn too)
    'cfmtbig': ['bigRuled', 'pageTurnRuled', 'hookRedraw'],
    'cbar': ['cellHasBar', 'barFromCell', 'barColor'],
    'cesc': ['noScript', 'tagAsText'],
    # (round N) no report setup, no pick: offered, the switch hidden; set('cards') shows them and the switch, which stays with the table
    'coff': ['switchHidden', 'hostHidden', 'offeredHidden', 'setShows', 'switchStays', 'offFlyout', 'offBack', 'segClosesHidden'],   # (round J: noTableFlyout gone - the option off offers it now)
    'cviewer': ['noForm', 'switchShown', 'cards', 'viewerWindow', 'viewerPick'],   # (round N) Configure cards for a viewer
    # (pvtiles) the pivot as tiles: the switch shows, one tile per shown pivot row + the grand total first, the label / parents /
    # row total / column values from the cells, a fold followed, a value's click drills, the exit back to flat cards, a re-entry
    'pcoff': ['pivotShown', 'switchShownInPivot', 'tilesCount', 'totalTile', 'tileTitle', 'tileBig', 'tileFields', 'foldFollowed', 'drillWhiteCard', 'drillTextReal', 'drillForward', 'backAfterExit'],
    'gcards': ['grouped', 'inBands', 'bandHeads', 'bandAggs', 'bandTableHidden', 'headSticky', 'bandGrows', 'bandCards', 'totalCards', 'staleGone', 'searched'],   # (cband) the cards in the grouped view's own bands
    # (gfold) the bands fold as the table's: a band click, Enter on a band, Collapse all / Expand all, the fold kept across Table <-> Cards, a nested branch
    'gcoll': ['bandsOpen', 'bandClick', 'bandAgain', 'bandKey', 'collapseAll', 'expandAll', 'keptAcrossViews', 'focusKept', 'tableHome'],   # (cband) the real bands; the table: the view home
    'gncoll': ['nested', 'branchFolds', 'leafFolds'],
    # (cardlist, rewritten from glist) the group List layout IN the cards: its own frame on screen (the list, the total,
    # the picked group's band), the host parked in the picked group's box (no bands of its own), the box's table laid out
    # out of sight; a list row's click / its keys / its API move the host; a rebuild parks it again; a restored copy of
    # the view's HTML brings no second host; Table <-> Cards; a nested branch picked = every group under it, then a leaf
    'ggcards': ['listOn', 'onePicked', 'frameShown', 'hostInBox', 'noBandsOfItsOwn', 'tableHidden', 'pickClick', 'pickKey', 'listPick', 'rebuildParks', 'restoreNoCopy', 'keptAcrossViews'],
    'gglnest': ['listOn', 'branchPick', 'leafPick'],
    # (cardnotes) the Notes column in the card (the journal's real panel over a fake manage_journal.php): drawn when the
    # journal paints it, the notes read again followed, every note in full, its label, the usual buttons, a text click
    # stays, Add a note in the card, Escape keeps the text, a redraw carries the composer, Post / Reply / Edit / x, a
    # card menu's Add a note, Quick actions' add a note on the selected card, a hidden Notes column draws none;
    # the details window's notes, its Escape order, a post from it, a compact card's Add a note through it
    'cnote': ['autoDraw', 'refreshFollows', 'fullText', 'label', 'buttons', 'oneLine', 'noDelOnCard', 'linkThemed', 'quietIcons', 'capConsistent', 'showAll', 'textClickOpens', 'dblWaits', 'pencilHead', 'labelAdds', 'sizeWords', 'notesMenu', 'sharedEditLabel', 'mailNotes', 'addOpens', 'composeOpens', 'btnsUnder', 'escKeeps', 'carried', 'post', 'postKeepsShape', 'editOlder', 'topAligned', 'dblEdit', 'cardWording', 'capOff', 'reply', 'edit', 'del', 'menuAddNote', 'paletteNote', 'hiddenNone', 'focusKeepsClipped'],
    'cnotedet': ['inDetails', 'delInDetails', 'addInDetails', 'escComposerFirst', 'escThenCloses', 'postInDetails', 'compactViaDetails'],
    # (round I, cardsmenu) the table's own menus while the report offers cards: Show as cards (the sizes, the current one
    # ticked; This row as a card from a value), a size picked, a row's details, a heading's list without the row; (round N)
    # no size ticked while the table shows, Configure cards... last
    'ctmenu': ['rowTop', 'flyout', 'noneTicked', 'pickSize', 'rowCard', 'headerFlyout'],
    # (crow, the user) This row as a card: the row's details window OVER THE TABLE - the table stays, the count is of rows,
    # Next / Left step its rows, the menus inside lack the cards' own items, Print is that card, Escape gives the table's
    # cell back (active, focused), Next past the page turns the table's page (Previous back), Quick actions' Open card
    # details for the active cell (Next then Escape: the moved row's cell), a sort keeps the row, a filter that hides it
    # closes it, cards drawn under it make it the cards' window; grouped: the open groups' rows, a folded one's skipped
    'ctrow': ['opens', 'countRows', 'notesShown', 'nextRow', 'prevKey', 'menuInside', 'printsCard', 'escBack', 'pageTurns', 'pageBack',
              'paletteRow', 'paletteBack', 'sortFollows', 'filterCloses', 'toCards', 'toCardsBack'],
    'gtrow': ['opensInGroup', 'foldedSkipped', 'nextCrossesGroup'],
    # (gbar) a chart's rows as a list: the window, "1 of 3 bars", another page's row, the end, back, Escape to the chart
    'cgbar': ['opens', 'countBars', 'nextFar', 'nextLast', 'endStops', 'prevBack', 'escChart', 'escCanvas'],   # (gfocus) escCanvas
    # (cnest, 2026-11-02, the user) a nested table's gaps on a card are its field's (hover, menu; the details window too); the
    # card's padding still the card's; Clear all customizations last under one separator: a value's, a label's, the
    # details window's, the table's own (after This row as a card / Show as cards), a heading's; it still runs
    'cnest': ['nestHot', 'nestGapField', 'clearLastCard', 'whiteStillCard', 'clearLastLabel', 'nestGapDetails', 'clearLastDetails'],
    'ctclear': ['tableClearLast', 'clearRuns', 'headClearLast'],
    # (cnest sweep) the card sweep's fixes, one check each (S-cn*: the ones a page cannot reach here)
    # (clay, 2026-11-03, the user: named card layouts) Configure cards' Layouts
    'clay1': ['chipThere', 'savedApplied', 'sharedApplied', 'escList', 'openLayouts'],
    # (cleft, 2026-11-03, the user: the second sweep's leftovers) one check per fix
    'pw3dup': ['dupFields', 'dupSort'], 'gw3agg': ['aggHead', 'cntCard'], 'gw3cnt': ['cntCell'], 'ct3save': ['sizeNoWrite'],
    # (csw2, 2026-11-02, the user: a second card sweep) one check per fix
    'cw2det': ['selNoWin', 'dragKeeps', 'bodyTop', 'endFocus', 'escMenuFirst', 'noEngine', 'clipNoRepass', 'panelFocus', 'tableLinkSize'],
    'cw2nest': ['subFilter'], 'cw2more': ['rowNotDrawn', 'moreFocus'], 'cw2pdf': ['pdfShared'], 'gw2band': ['bandDown', 'regroupResets'],
    'gw2mail': ['foldedHeadKept'], 'pw2piv': ['setupOnce', 'selGone', 'detGone'], 'pw2next': ['pivotNextOn'],
    'csweep': ['escOverPopover', 'reopenMidFade', 'dblKeeps', 'backdropCloses', 'altKeys', 'menuKeyOnButton'],
    'gsweep': ['cutNoHeads'], 'gbcols': ['boardColsGreyed'], 'cpct': ['pctBar', 'pctLabel'], 'cfindgo': ['findLetGo'], 'ctsel': ['pageTurnNoSel'],
    # (round J) a filter link on a card and in the details window (which closes); links styled as the table's in three
    # themes; the field a menu is for in each theme's table-hover colour
    'cflink': ['cardLink', 'detailsLink', 'linkThemed', 'hoverThemed'],
    # (round K) a card's Copy reads This entire card and its toast the card's; a field's stats are over the cards (the
    # table's still over the rows the filter keeps); the details window's menus have no Sort (a card's own still has)
    'ckword': ['copyCardLabel', 'copyCardToast', 'copyFailCard', 'statsOverCards', 'detNoSort', 'detNoDoubleSep', 'cardKeepsSort', 'tableStatsRows'],
    # (round K, cardfind) the search box's marks on the cards (none on the hidden table); a scoped term in a field the card
    # does not show named on each card, the line opening the details (marked there), back after it closes; Find's
    # matches on the cards and in the details, the current card outlined; a buried match named, its card scrolled to;
    # one on the next page: the page turns, its card outlined and on screen; closing clears; the table's Find unchanged
    'cfind': ['filterOnCards', 'filterBuriedNamed', 'foundOpensDetails', 'lineBackAfterClose', 'filterCleared', 'findOnCards', 'findCurOutlined',
              'findInDetails', 'barOverDetails', 'findEscKeepsDetails', 'findBuriedNamed', 'findScrolled', 'findPageTurn', 'findCloseClears', 'tableFindUnchanged'],
    'gfind': ['bandMarked', 'cellMarked', 'foldedRevealed', 'filterMarked'],
    # (round K, barpick) the Bar list: text columns greyed out, number columns open, the picked text column kept, the
    # other lists untouched
    'cbarpick': ['textOff', 'numberOn', 'pickedKept', 'otherSlotsOpen', 'noneOpen'],
    # (round L, csort) the Sort list: listed with the cards, a pick sorts the table (the cards follow), the arrow turns it,
    # a sort made elsewhere reads back, none clears, gone with the table; grouped: every band sorted
    'csort': ['listShown', 'labelled', 'sortSized', 'pickSorts', 'arrowShown', 'flip', 'readsBack', 'noneClears', 'tableHides'],   # (csortlbl: labelled)
    'gsort': ['bandsSorted', 'menuSortFollows'],
    # (cempty) a blank field off its card, a filled one on; the other field always
    'cempty': ['blankOff', 'filledOn', 'otherKept'],
    # (pvfind) a row label marked on its tile, a value on its tile and outlined; in Compact a value the tile does not
    # show named on it; the search's marks on the tiles' labels; no Sort list over tiles
    'pfind': ['labelMarked', 'valueMarked', 'compactNamed', 'filterOnTiles', 'sortShown'],   # (round U: sortHidden -> sortShown)
    # (round U) pivot tiles sort: the list names the pivot's headings as the tiles word them; a pick, the arrow, the pivot's own
    # path read back; a tile's value / title / big number menus; Clear sort; Sort: none; Quick actions' openSort; the table
    'pfsort': ['apiShowAs', 'listShown', 'pickSorts', 'arrowShown', 'flip', 'readsBack', 'valueMenuSorts', 'clearFromMenu', 'titleMenuSorts', 'bigAndTotal', 'noneClears', 'openSort', 'tableHides'],
    # (clayout, round N) Settings > Cards: one button; Configure cards (Quick actions' openConfig): a title and fields picked
    # (drawn, kept as the viewer's whole setup, never the report's), Use the report's; a round L layout seeded: drawn on
    # load, shown in the window, the report's untouched
    'clayout': ['sectionGone', 'paletteOpens', 'titlePicked', 'fieldsPicked', 'keptAsPref', 'authorUntouched', 'resetBack'],
    'clayoutB': ['seededDrawn', 'formIsAuthors', 'seededShown'],
    # (the sweep) the details window keeps its row: a sort moves it, the window follows; a page turn closes it
    'cdetrow': ['sortFollows', 'pageCloses'],
    # (round M) a three-measure pivot in Compact: a value the tile does not show is named as the tile's field is (the
    # column path and the measure)
    'pvfind': ['namedAsField', 'sortLabels'],   # (round U) sortLabels
    # (round O) a value's text: its column's menu (marked), a margin round it too; the white space beside it, the title's, the
    # big number's: the card's own; the pill and the bar: their fields'; lit on its text only, in the hover colour; the
    # details window the same. The details window past the page (25 a page): the count over every card with the page, Next
    # turns to the next page's first card, Previous back, the Right key too, the last card's Next off; past the 1,000 drawn
    # (All, 1,003 rows): Next draws the next step. The status bar's Cards segment: after Cols (kept on a phone), the
    # controls in its card, Cards / Table, Fields / Cols, its open / close / Escape / a pick / Configure cards...
    'cwhite': ['textField', 'whiteCard', 'marginField', 'titleWhite', 'bigWhite', 'pillField', 'barField', 'hotOnText', 'hotNotWhite', 'hotLit', 'detTextField', 'detWhiteCard'],
    'cdetpage': ['posAll', 'nextEnabled', 'nextTurns', 'posPage', 'prevTurns', 'keysTurn', 'lastOff'],
    'cdetmore': ['posMore', 'nextDraws'],
    'cseg': ['segShown', 'controlsIn', 'chipCards', 'fieldsWord', 'cardsRowsShown', 'opens', 'escFocus', 'pickKeepsOpen', 'configBtn', 'tableWords'],
    # (round P) Extra large's two columns: the short cards split, the long one not, the order down the left then the right,
    # each pair on its row, no value wrapped; a value grown long in place / short again; never in the details window, with
    # one field, at Large, on a phone. The Cols card's Layout line on a report with no card setup: shown (table), the Cards
    # segment not yet; what cards are for (the words; the switch's options, the link, the table's Show as cards); the count
    # opens the card; the link shows the cards (the card closed, the focus on the count, the segment shown, the pick kept);
    # its words in cards; back to the table. (cauth / clayout: Settings > Cards gone)
    'cxl2': ['drawnSplit', 'splitShort', 'longStays', 'columnMajor', 'pairsAligned', 'noWrap', 'regrowUnsplits', 'shrinkSplits', 'detailsNone', 'oneFieldNone', 'largeNone'],
    'cxl2ph': ['phoneNone'],
    # (round Q) a pivot on link-valued fields: no markup on the tiles; a tile's subtitle its parent's text, its fields' labels
    # the columns' texts; the details window; a tile value's menu; a tile title's Filter to (its text, and it filters); from
    # the table, a column heading's Filter to
    # (round R) more fields per card: the report's ten drawn; the window's count and twelve (kept); Show field labels off
    # (drawn, kept, the window, the report's default), Extra large's two value columns, the details window, on again
    'cfieldsB': ['seededNoLabels', 'seededBox'],
    # (round S) the board: grouped, from flat cards, kept on a visit
    'gboard': ['boardShown', 'lanesSideBySide', 'noPageScroll', 'laneCards', 'oneColumn', 'cardsWhole', 'switchTwo', 'chipBoard', 'tableGreyed', 'cardMenu', 'keysLanes', 'detailsAcross',
               'laneFold', 'laneMenu', 'leaveToTable', 'tableMenuNoBoard', 'backToBoard', 'savedLayout', 'linkBoard',
               'keepsScroll', 'sortFollows', 'grpPopLayouts', 'grpPopActions', 'grpPopSwitch',
               'pageFits', 'noRoomUnder', 'chipGone', 'grpSize', 'bandMenuOnce', 'sortOff'],   # (bdlay) a report saved as a Board: the grouping's layout; (bdlay2) the user's first look; (bdlay3) the second
    'gboardfew': ['foldWide'],   # (bdlay2) three lanes that fit: a folded lane stays wide
    'gboardbig': ['lanesFilled', 'laneMore', 'laneMoreAdds', 'findDraws', 'expandAllFilled', 'laneCount'],   # (bdlay2) each lane its own share; (bdlay3) its count
    'gbandbig': ['bandShares', 'bandMore', 'bandMoreAdds'],   # (cband) six Stacked bands past the step: each its own share, Show more and count
    'gboardvl': ['bootsBoard'],   # (bdlay) gboard's link
    'cboard': ['guessPill', 'noAutoGroup', 'menuNoBoard', 'dialogOpens', 'applyMakesBoard', 'ungroupNoFlip'],   # (bdlay) Show as a board: Configure Grouping, Apply
    'cboardload': ['loadAsCards', 'oldKeyDropped'],   # (bdlay) round S's kept board view
    'cboardrx': ['noBoardOffer', 'notGrouped'],   # (bdlay) a viewer the report keeps from grouping
    'cfields': ['reportTen', 'tenDrawn', 'labelsShown', 'windowCount', 'labelsBox', 'labelsOff', 'labelsKept', 'labelsDefault', 'splitNoLabels', 'detailsLabels', 'labelsOn'],
    'pvhtml': ['noMarkup', 'subText', 'fieldLabels', 'detailsText', 'valueMenuText', 'labelMenuText', 'filterWorks', 'colHeadText'],
    'ccolsview': ['lineShown', 'segHiddenBefore', 'purposeWords', 'opensCols', 'linkSwitches', 'focusBack', 'purposeTitles', 'cardsWords', 'backToTable'],
    # (round N, ccfg) Configure cards: an editor, no report setup - Settings > Cards opens it over the cards, the lists, the
    # picks drawn and kept as the editor's own, four fields at most, the size; Use as the report's default (the editor's own
    # go), Remove; Escape, Ctrl+Shift+L, a card's menu, the table's list. With a setup: the switch, the window's picks and
    # words, the editor's change their own, re-made the default, an unsaved default kept across a re-run. Missing columns.
    'cauth': ['switchHidden', 'sectionGone', 'paletteOpens', 'cardsBehind', 'focusFirst', 'pickersListed', 'chipsListed', 'noDefaultYet', 'drawnPicks', 'fieldLimit',
              'keptAsPref', 'notReports', 'sizePick', 'makeDefault', 'defaultClearsMine', 'removeDefault', 'escCloses', 'hotkeyToggles', 'menuOpens', 'tableMenuOpens'],
    'cauthB': ['switchShown', 'roundTrip', 'editorLine', 'pickersShow', 'chipsShow', 'mineFirst', 'reedit', 'pendingKept'],
    'cauthM': ['guessFallsBack', 'keptField', 'missingListed', 'missingChip'],
    'cvlA': ['carriesCv', 'included', 'described', 'noCvOnTable'],
    'cvlB': ['bootsCards', 'prefUntouched'],
    'cvlT': ['linkWins'],
    'ca11y': ['themes', 'contrast', 'pillContrast', 'switchContrast'],
    'cphone': ['oneColumn', 'noHScroll', 'count'],
    'cperf': ['thousand', 'under300', 'noMore'],
    'cmore': ['capped', 'moreButton', 'moreText', 'moreDraws', 'deferredDraw'],
    # (cxl) Extra large: the author's default, the size list, one or two per row, every field, the link's cz, the pref, the form
    'cxl': ['authorXl', 'sizeOptions', 'twoPerRow', 'allFields', 'linkCz', 'prefXl', 'formXl', 'backToLarge'],
    'cxlvl': ['bootsXl', 'prefUntouched'],
    # (cmenu) the right-click menus through the engine: a value's column menu acting on its cell (Filter to runs), the card's
    # own items, a card's empty area = the row's items alone, Card size list + pick, a link / Shift keep the browser's menu,
    # Shift+F10 / the Menu key on a focused card, Esc back to the card, Show as table
    'cmenu': ['valueMenu', 'extras', 'filterRuns', 'cardRowOnly', 'sizeList', 'sizePick', 'linkKeepsBrowser', 'shiftKeepsBrowser', 'keyboardOpens', 'escRefocus', 'menuKeyOpens', 'showTable'],
    'gmenu': ['bandMenu', 'bandNoColumn', 'bandActs', 'bandKeyboard', 'bandRefocus', 'groupedValueMenu'],
    'pmenu': ['tileValueMenu', 'tileNoGrid', 'tileLabelMenu', 'tileSortOffered', 'totalTileMenu', 'tileConfigOn', 'segCfgOn', 'tableCfgOn', 'tileWhiteLabel', 'tileShowTable'],
    # (cardword) a card's menu: the grid-only items gone, "column" -> "field" everywhere, no doubled separator, Move field up / down /
    # to top / to bottom (a move reorders the table's columns: the fields follow), Add a calculated field... (above / below / top /
    # bottom), Show field(s); the table's own menu untouched
    'cmword': ['gridOnlyHidden', 'noColumnWord', 'noDoubleSep', 'moveLabels', 'moveReflected', 'moveToast', 'calcLabels', 'subNoColumn', 'tableUnchanged'],
    # (curl) by URL: the option off + ?cards=1&cardsize=xl (the switch, the cards at xl from the guesses, the pref untouched, no
    # leak into the state, a switch writes the pref); the option on + a saved Table pick + ?cards=1; a saved cards pick +
    # ?cards=0; the option off + a view link's cv / cz; the builder's Open as cards option
    'curl1': ['switchShown', 'cardsOn', 'sizeXl', 'guessed', 'offeredNoOption', 'prefUntouched', 'stateNoLeak', 'switchWrites'],
    'curl2': ['paramWins', 'prefStillTable'],
    'curl3': ['tableForced', 'prefStillCards'],
    'curl4': ['linkUnlocks', 'prefUntouched'],
    'cshare': ['noCvOnTable', 'optGone', 'asSeenSize'],   # (cmsize: the builder's cards option gone; the view as seen carries the size)
    # (cmsize) the menus at each of the four sizes, picked through the viewer's list: a value, the card's empty area, a band
    'cmsize': ['value_compact', 'area_compact', 'value_standard', 'area_standard', 'value_large', 'area_large', 'value_xl', 'area_xl', 'blankSelectionIgnored', 'textSelectionKeepsBrowser'],
    'gmsize': ['value_compact', 'band_compact', 'value_standard', 'band_standard', 'value_large', 'band_large', 'value_xl', 'band_xl'],
    # (cdet) the card details window: a click opens it (role=dialog, the card's title, focus inside, the card selected), the
    # header's parts, every shown column in order with the row's values, no hidden column (the card shows three), the
    # position, Next / Left, Escape back to the card, the filter respected, a value's menu inside (its cell), the menu's
    # Escape leaves the window, Open details from a card's menu, the API for the selected card; grouped: across a band;
    # a pivot tile: its parts, Next, Show the breakdown; a phone: the full-screen sheet
    'cdet': ['clickOpens', 'header', 'shownColumns', 'values', 'noHidden', 'position', 'next', 'prevKey', 'escCloses', 'filtered', 'menuInside', 'menuMark', 'menuMarkGoes', 'menuEscKeepsOpen', 'openFromMenu', 'apiOpen'],
    'gdet': ['opensInGroup', 'nextCrossesBand', 'countAll'],
    'pdet': ['tileOpens', 'tileFields', 'nextTile', 'breakdownButton'],
    'cdetph': ['sheet', 'noHScroll'],
    # (clbar) the brand bar is the value's place among the page's rows (one 1e9 outlier, two ties, a zero); the view
    # link carries the sender's own card setup (built from the cards and from the table's Open as cards, cleaned on
    # read), and the page it opens draws it as this visit's own (nothing written to disk)
    'cbarrank': ['ranked', 'outlierFull', 'tiesEqual', 'zeroEmpty', 'spread', 'medianHalf'],
    'cvlC': ['setupDrawn', 'carriesSetup', 'included', 'described', 'noneOnTable', 'cleaned', 'emptyDropped'],
    'cvlD': ['bootsSetup', 'layoutIsLinks', 'prefUntouched', 'labelsOff', 'windowShowsLink'],
    # (linkpos) a link from the cards carries the card at the top (tr, no lc) and the open details card (cd); the page it
    # opens has that card at the top and the details open; a pivot link carries its scroll (pt / pl) and opens scrolled
    'cvlE': ['cardsOn', 'carriesTop', 'noLc', 'carriesDetails', 'included', 'described'],
    'cvlF': ['bootsCards', 'topCard', 'detailsOpen', 'detailsRow'],
    'pvlA': ['pivotShown', 'scrolled', 'carriesRow', 'carriesCol', 'included', 'described'],
    'pvlB': ['pivotShown', 'rowAtTop', 'colAtLeft'],
    # (pvcfg) the report's tiles setup drawn (big = Total N, pill = the parent labels, bar = Total Amt ranked over the tiles,
    # fields = Amt + Mean, no labels, none on the total tile); the window over the tiles (its rows, its picks); a pick is
    # the viewer's own (drawn, in the link); Reset; an editor's Make default; the page the link opens
    'pvcfg': ['bigPicked', 'pillParent', 'barDrawn', 'barRanked', 'fieldsPicked', 'labelsOff', 'noBarOnTotal', 'canConfig', 'windowPivot', 'windowShows', 'pickOwn', 'linkCarries', 'resetBack', 'madeDefault'],
    'pvcfgB': ['linkApplied', 'prefUntouched'],
    # (pvlab) one measure with no label: the tile's pill and bar say Total Value, as the window's option does
    'plab': ['pillWord', 'meterWord', 'windowWord'],
    # (cprint) print as cards: the Download dialog's Print line; a print = every card drawn, one page each, in order, the
    # report / place / stamp line, the details window's fields; on paper the sheet alone, a break after each page, upright,
    # white paper under a dark theme; a real PDF (one page per card, portrait); gone after; the table when it shows. The
    # details window's Print icon (one card, the document named for it, the window kept), Ctrl+P there, Quick actions'
    # print / printOne; the window's buttons ghost (class, no fill, contrast on every theme)
    'cprint': ['noteShown', 'sheetBuilt', 'order', 'pageHead', 'pageFields', 'noPath', 'paperAlone', 'pageBreaks', 'paperColors', 'pdfPages', 'pdfPortrait',
               'afterRemoves', 'pdfKept', 'btnShape', 'btnPrintsOne', 'btnTitle', 'btnKeepsOpen', 'ctrlPOne', 'apiAll', 'apiOne', 'ghostClass', 'ghostFlat', 'ghostContrast', 'tableWhenOff'],
    # grouped: a page per card drawn, each named for its band; a folded band prints none; the board: its lane
    'gprint': ['gSheet', 'gPath', 'foldFollowed', 'boardPath'],
    # pivot tiles: a tile a page, its parts, no breakdown button on paper; the window's breakdown button a ghost one
    'pprint': ['pSheet', 'pTile', 'pNoButton', 'pDrillGhost'],
    # (cfix) packed cards (the gap under a short card filled, the order kept, Up / Down in the column, off / on, kept in the
    # setup and the link; a report's off; over a pivot); a wide part inside the card; a label's heading menu (on the card,
    # in the details window), white space still the card's; the details window's hidden card field; the window's words,
    # its lists' dress, All / None; an editor's Save writes what is shown, savedToReport drops their copy, a viewer's
    # writes the report's
    'cfix': ['packFills', 'orderKept', 'keysColumn', 'wideStays', 'labelMenu', 'whiteIsCard', 'detCardField', 'detLabelMenu', 'windowWords', 'listsStyled',
             'allNone', 'editorSaves', 'viewerSavesReport', 'savedDropsMine', 'packOff', 'packOn'],
    'cfixB': ['reportNoPack', 'boxFollows'], 'pfix': ['pivotPackOff'],
    # (cfix2) a repaint keeps the packing; the window's switches side by side; Download as PDF a card a page, the
    # email's PDF the table; the Download dialog's PDF note; the board's lanes to the status bar
    'cfixprint': ['restyleKeeps', 'switchesRow', 'pdfNote', 'pdfCards', 'pdfTableStays'], 'gfix2': ['lanesFit', 'laneFilled'],
    # (cchips) a list column's values as chips: each value a chip in order, six and "+3 more", the cell's text kept (unseen
    # between), a repeat once, one value, a pipe list; a pair, plain text, a link untouched; the highlight on the chips (a
    # theme switch too), their contrast on every theme; +N more opens (no details), kept over a redraw, Fewer; the details
    # window all; Find past the six; Click to filter: the value's rows, another field its cell's text
    # (cdash) the email's cards: Penumbra.cards.emailHtml() - flat, grouped, never a pivot
    'cmail': ['mailOffered', 'mailCount', 'mailCols', 'mailTitle', 'mailPlain', 'mailCleaned', 'mailChips', 'mailRuled', 'mailPill', 'mailBig', 'mailBar', 'mailLabels', 'screenSame', 'mailBudget', 'mailCompact', 'mailXl', 'mailDefaultTheme', 'mailThemed', 'mailSized', 'mailShownSize', 'mailPillOutlined', 'mailMediumAsked'],
    # (csched) the saved view; a report saved showing cards opens in cards
    'csave': ['savedNow', 'savedLists', 'saveWrites', 'sentSize', 'linkClean', 'sentSizeKept', 'guessResolved', 'tableClears'],   # (csz: sentSize, sentSizeKept)
    'copen': ['opensCards'],
    'gmail': ['grpHeads', 'grpNames', 'grpCounts', 'grpOpenCards', 'grpClosed', 'grpTitles'],
    'pmail': ['noPivot'],
    # (cdens) density moves the cards' type and room at every size (the table's switch the reference); Easy Read's Verdana;
    # back to Standard exactly; no card drawn over another after a switch; the two dialogs' caps the same on screen at
    # every density (zoomed 0.9 / 1.15); a phone's sheets the screen's width; a board's lane heads, its lanes refit to the
    # status bar after a switch and the page never scrolling
    'cdens': ['tableFollows', 'typeFollows', 'fieldsFollow', 'roomFollows', 'easyVerdana', 'backToStandard', 'noOverlap', 'dlgStandard', 'dlgCapsScreen'],
    'cdensph': ['sheetStandard', 'sheetFits'],
    # (cdpack) the packed grid keeps no row gap at any size x density (the density rules' size gaps outranked it)
    'cdpack': ['standardTight', 'compactTight', 'everyTight'],
    'gdens': ['laneHeadFollows', 'pageFits', 'boardRefit', 'boardBack'],
    'cchips': ['listChips', 'capShown', 'textSame', 'sepHidden', 'eachOnce', 'oneValue', 'inlineChips', 'pipeChips', 'pairPlain', 'plainPlain', 'linkKept', 'ruledChips',
               'moreOpens', 'moreKept', 'fewer', 'restyleKeeps', 'chipContrast', 'detAll', 'findShows', 'chipFilters', 'cellStill'],
    # (cflt) Click to filter field by field: a column's own marked on the card (pointer, underlined at rest, a hover) and in the
    # details window, where a click filters and closes it; no other field filters; the report's option marks every value but a
    # link's; either flip redraws the marks
    'cflt': ['noneOff', 'colMarked', 'colPointer', 'colAtRest', 'colOnly', 'otherOpens', 'detMarked', 'detOtherStays', 'detFilters', 'colOffClears',
             'allMarked', 'linkUnmarked', 'allOffClears'],
}
# nothing here holds on live: the card view is new (the control judges NEW red, the rest green). GUARDS = the
# checks that hold on live by construction (no switch, no host, no module) and are reached before a scenario's
# first use of the switch throws there.
NEW = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} | {'S-include', 'S-markup', 'S-voCard', 'S-paletteRows', 'S-help', 'S-readme', 'S-hooks', 'S-viewLink', 'S-module'}
GUARDS = {'L-coff-switchHidden', 'L-coff-hostHidden', 'L-coff-setRefused', 'L-pcoff-pivotShown',
          'L-gcards-grouped', 'L-cviewer-noForm', 'L-ca11y-themes', 'L-cbar-cellHasBar', 'L-cvlB-prefUntouched', 'S-noEmdash'}
NEW -= GUARDS
NEW = set()   # (cards is LIVE since ce634cd, 2026-10-28: old checks now; the round's NEW set above is kept for the record)
GUARDS |= {'L-gncoll-nested'}   # (the nested fixture itself holds on live)
NEW = ({'L-gcoll-%s' % c for c in CHK['gcoll']} | {'L-gncoll-%s' % c for c in CHK['gncoll']}) - GUARDS   # (gfold: the bands fold in cards)
NEW = set()   # (gfold is LIVE since 8da30d2, 2026-10-28: old checks now)
GUARDS |= {'L-ggcards-listOn', 'L-gglnest-listOn'}   # (the List layout itself holds on live)
NEW = ({'L-ggcards-%s' % c for c in CHK['ggcards']} | {'L-gglnest-%s' % c for c in CHK['gglnest']}) - GUARDS   # (glist: the List layout's pick in cards)
NEW = set()   # (glist is LIVE since c4370c4, 2026-10-28: old checks now)
GUARDS |= {'L-cszvlB-prefUntouched', 'L-cnarrowT-tableChoiceWins'}   # (hold on live: no size pref is ever written; an explicit Table pick already wins)
NEW = ({'L-csize-%s' % c for c in CHK['csize']} | {'L-cszvlA-%s' % c for c in CHK['cszvlA']} | {'L-cszvlB-%s' % c for c in CHK['cszvlB']}
       | {'L-cnarrowA-narrowOpensCards', 'L-cauto-prefTable', 'S-sizeRows', 'S-sizeMarkup', 'S-sizeHelp', 'S-viewLink'}) - GUARDS   # (csize; S-viewLink's text now names cz)
NEW = set()   # (csize is LIVE since 530d172, 2026-10-28: old checks now)
NEW = ({'L-pcoff-%s' % c for c in CHK['pcoff']} | {'S-pvHelp'}) - GUARDS   # (pvtiles: the pivot as tiles; pcoff's checks were rewritten)
NEW = set()   # (pvtiles is LIVE since 10bbd82, 2026-10-28: old checks now)
GUARDS |= {'L-cxl-backToLarge', 'L-cxlvl-prefUntouched', 'L-cmenu-linkKeepsBrowser', 'L-cmenu-shiftKeepsBrowser'}   # (hold on live: Large is there already; a link writes no pref; live has no card menu to keep off a link)
NEW = ({'L-%s-%s' % (s, c) for s in ('cxl', 'cxlvl', 'cmenu', 'gmenu', 'pmenu') for c in CHK[s]}
       | {'S-xlRows', 'S-xlMarkup', 'S-xlHelp', 'S-menuHook', 'S-menuHelp', 'S-viewLink', 'L-csize-sizeControl'}) - GUARDS   # (cxl + cmenu; S-viewLink's text now names extra large; the size list has four entries)
NEW = set()   # (cxl + cmenu are LIVE, 2026-10-28: old checks now)
GUARDS |= {'L-cmsize-textSelectionKeepsBrowser'}   # (holds on live: a selected text keeps the browser's menu there too)
NEW = {'L-cmsize-blankSelectionIgnored'}   # (menusel: a whitespace-only selection no longer blocks a card's menu; the size scenarios themselves hold on live)
NEW = set()   # (menusel is LIVE, 2026-10-28)
GUARDS |= {'L-cdetph-noHScroll'}   # (holds on live: a phone page with no window has no sideways scroll either)
NEW = ({'L-%s-%s' % (s, c) for s in ('cdet', 'gdet', 'pdet', 'cdetph') for c in CHK[s]}
       | {'L-cauto-enterSelects', 'L-cauto-escClears', 'L-cauto-clickSelects', 'S-detRow', 'S-detHelp', 'S-detCss'}) - GUARDS   # (cdet: the details window; Enter / a click open it now)
NEW = set()   # (cdet is LIVE since 76b3a42, 2026-10-28: old checks now)
GUARDS |= {'L-cmword-tableUnchanged', 'L-cmword-moveReflected', 'L-gmenu-bandNoColumn'}   # (hold on live: the table's labels; a move redraws the cards there too; a band's menu never said column)
NEW = ({'L-cmword-%s' % c for c in CHK['cmword']} | {'L-gmenu-bandNoColumn', 'L-pmenu-tileNoGrid', 'S-wordHelp'}) - GUARDS   # (cardword; tileNoGrid is red on live by the Open details title's "column")
NEW = set()   # (cardword is LIVE, 2026-10-29)
GUARDS |= {'L-curl1-prefUntouched', 'L-curl1-stateNoLeak', 'L-curl2-prefStillTable', 'L-curl3-prefStillCards', 'L-curl4-prefUntouched', 'L-cshare-noCvOnTable'}   # (hold on live: nothing is written there either; no cv on a table)
NEW = ({'L-%s-%s' % (s, c) for s in ('curl1', 'curl2', 'curl3', 'curl4', 'cshare') for c in CHK[s]} | {'S-emailCards', 'S-urlHelp'}) - GUARDS   # (curl)
NEW = set()   # (curl is LIVE, 2026-10-29: old checks now)
GUARDS |= {'L-ggcards-onePicked'}   # (holds on live: it drew the picked group's cards alone, under bands of its own)
NEW = ({'L-ggcards-%s' % c for c in CHK['ggcards']} | {'L-gglnest-%s' % c for c in CHK['gglnest']}
       | {'L-%s-%s' % (s, c) for s in ('cnote', 'cnotedet') for c in CHK[s]} | {'S-noteApi', 'S-noteHelp', 'S-listHelp', 'S-noteRow'}) - GUARDS   # (cardnotes + cardlist)
NEW = set()   # (cardnotes + cardlist are LIVE since 934b7cb, 2026-10-29: old checks now)
GUARDS |= {'L-coff-noTableFlyout'}   # (holds on live: no table menu offers cards there)
NEW = ({'L-cnote-%s' % c for c in ('oneLine', 'quietIcons', 'capConsistent', 'showAll', 'composeOpens', 'postKeepsShape', 'dblEdit', 'cardWording', 'capOff')}
       | {'L-ctmenu-%s' % c for c in CHK['ctmenu']} | {'L-cauto-pagerWord', 'L-cdet-menuMark', 'L-cdet-menuMarkGoes', 'S-roundI'}) - GUARDS   # (round I)
NEW = set()   # (round I is LIVE since 53cf6c0, 2026-10-29: old checks now)
NEW = ({'L-cflink-%s' % c for c in CHK['cflink']} | {'L-cnote-editOlder', 'L-coff-offFlyout', 'L-coff-offBack', 'S-roundJ'}) - GUARDS   # (round J)
NEW = set()   # (round J is LIVE since e0fcd22, 2026-10-29: old checks now)
GUARDS |= {'L-ckword-cardKeepsSort', 'L-ckword-tableStatsRows', 'L-cfind-tableFindUnchanged', 'L-cbarpick-numberOn', 'L-cbarpick-pickedKept',
           'L-cbarpick-otherSlotsOpen', 'L-cbarpick-noneOpen'}   # (hold on live: the card's and the table's menus, Find on the table, the open lists)
NEW = ({'L-%s-%s' % (s, c) for s in ('ckword', 'cfind', 'gfind', 'cbarpick') for c in CHK[s]} | {'S-roundK', 'S-pager'}) - GUARDS   # (round K)
NEW = set()   # (round K is LIVE, 2026-10-30: old checks now)
GUARDS |= {'L-pfind-sortHidden', 'L-cempty-filledOn', 'L-cempty-otherKept'}   # (hold on live: no list over tiles; filled fields drawn)
NEW = ({'L-%s-%s' % (s, c) for s in ('csort', 'gsort', 'cempty', 'pfind', 'clayout', 'clayoutB', 'cdetrow') for c in CHK[s]} | {'S-roundL'}
       | {'L-cdet-menuEscKeepsOpen', 'L-cdet-menuMarkGoes', 'L-cfind-barOverDetails', 'L-cfind-findEscKeepsDetails', 'L-ckword-copyCardToast', 'L-cmword-moveToast'}) - GUARDS   # (round L; the two: the live Escape bug the sweep found, the harness now loading as index.php)
NEW = set()   # (round L is LIVE since 2461028, 2026-10-30: old checks now)
NEW = {'L-csort-sortSized', 'L-ckword-copyFailCard', 'L-pvfind-namedAsField'}   # (round M)
NEW = set()   # (round M is LIVE, 2026-10-30: old checks now)
GUARDS |= {'L-cauth-switchHidden', 'L-pmenu-tileNoConfig'}   # (hold on live: the option off hides the switch; no window over tiles. cnarrowN is NEW: live resolves no view where cards are not offered)
NEW = ({'L-cauth-%s' % c for c in CHK['cauth']} | {'L-cauthB-%s' % c for c in ('editorLine', 'pickersShow', 'chipsShow', 'mineFirst', 'reedit', 'pendingKept')}
       | {'L-cauthM-missingListed', 'L-cauthM-missingChip', 'L-cviewer-viewerWindow', 'L-cviewer-viewerPick', 'L-csize-formSize', 'L-cxl-formXl', 'L-ctmenu-noneTicked'}
       | {'L-clayout-%s' % c for c in CHK['clayout']} | {'L-clayoutB-seededShown', 'L-coff-offeredHidden', 'L-coff-setShows', 'L-coff-switchStays', 'L-cnarrowN-noDefaultTable', 'S-roundN'}) - GUARDS   # (round N)
NEW = set()   # (round N is LIVE since 37f1c15, 2026-10-30: old checks now)
GUARDS |= {'L-cwhite-textField', 'L-cwhite-marginField', 'L-cwhite-pillField', 'L-cwhite-barField', 'L-cwhite-hotNotWhite', 'L-cwhite-detTextField'}   # (hold on live: a value's menu from its text, a pill's, a bar's; nothing lit by a class there)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cwhite', 'cdetpage', 'cdetmore', 'cseg') for c in CHK[sc]}
       | {'L-coff-segClosesHidden', 'L-pmenu-tileWhiteLabel', 'L-cdet-position', 'L-cdet-next', 'L-cdet-filtered', 'L-gdet-opensInGroup', 'S-roundO', 'S-markup'}) - GUARDS   # (round O)
NEW = set()   # (round O is LIVE since 6486e35, 2026-10-30: old checks now)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cxl2', 'cxl2ph', 'ccolsview') for c in CHK[sc]} | {'L-cauth-sectionGone', 'L-clayout-sectionGone', 'S-roundP'}) - GUARDS   # (round P)
NEW = set()   # (round P is LIVE since 38c66fa, 2026-10-30: old checks now)
NEW = {'L-pvhtml-%s' % c for c in CHK['pvhtml']} - GUARDS   # (round Q)
NEW = set()   # (round Q is LIVE since 10d2ee6, 2026-10-30: old checks now)
GUARDS |= {'L-cfields-labelsShown'}   # (holds on live: the labels always show there)
NEW = ({'L-cfields-%s' % c for c in CHK['cfields']} | {'L-cfieldsB-%s' % c for c in CHK['cfieldsB']} | {'L-cauth-fieldLimit', 'L-cauthB-chipsShow', 'L-clayoutB-seededShown'}) - GUARDS   # (round R: "N of 12")
NEW = set()   # (round R is LIVE since 05506cc, 2026-10-30: old checks now)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('gboard', 'cboard', 'cboardload') for c in CHK[sc]} | {'L-cauto-switchShown', 'L-cauto-switchA11y'}) - GUARDS   # (round S; the switch has three)
NEW = set()   # (round S is LIVE since 509ba42, 2026-10-30: old checks now)
GUARDS |= {'L-cfmt-subPlain', 'L-cfmt-fieldPlain'}   # (hold on live: a value with no rule wears nothing)
NEW = {'L-cfmt-%s' % c for c in CHK['cfmt']} - GUARDS   # (cfmt, 2026-10-30)
NEW = set()   # (cfmt is LIVE since ce6e4e8, 2026-10-30: old checks now)
NEW = set()   # (cfmt is LIVE since ce6e4e8, 2026-10-30: old checks now - retired in round T's merge)
NEW = {'L-pmenu-tileConfigOff', 'L-pmenu-segCfgOff', 'L-pmenu-tableCfgOff'}   # (round T: greyed over a pivot; totalTileMenu only widened, it holds on live)
NEW = set()   # (round T is LIVE since 1533015, 2026-10-30: old checks now)
GUARDS |= {'L-cfmtbig-pageTurnRuled'}   # (holds on live: a page turn's format pass runs at once)
NEW = ({'L-cfmt-firstDrawOnce', 'L-cfmt-menuShown', 'L-cfmt-buttonWords', 'S-roundN'} | {'L-cfmtbig-%s' % c for c in CHK['cfmtbig']}) - GUARDS   # (cfmt2; S-roundN reads the buttons' new words)
GUARDS |= {'L-cbarrank-outlierFull', 'L-cbarrank-zeroEmpty', 'L-cvlC-setupDrawn', 'L-cvlC-noneOnTable', 'L-cvlC-emptyDropped', 'L-cvlD-prefUntouched'}   # (hold on live: the largest full, a zero empty; a setup drawn, no cl on a table, an unknown key dropped, no pref written; tiesEqual is NEW: live drew the two 500s beside 1e9 at 0.0%)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cbarrank', 'cvlC', 'cvlD') for c in CHK[sc]} | {'L-cfull-barFallback', 'S-clbar'}) - GUARDS   # (clbar)
NEW = set()   # (clbar is LIVE since 5cdaa47, 2026-10-31: old checks now)
GUARDS |= {'L-pfsort-tableHides'}   # (holds on live: no list over a pivot table)
NEW = ({'L-pfsort-%s' % c for c in CHK['pfsort']} | {'L-pmenu-tileSortOffered', 'L-pvfind-sortLabels', 'L-pfind-sortShown', 'S-roundU'}) - GUARDS   # (round U: pivot tiles sort)
NEW = set()   # (round U is LIVE since ad8568a, 2026-10-31: old checks now)
GUARDS |= {'L-cvlE-cardsOn', 'L-cvlE-noLc', 'L-cvlF-bootsCards', 'L-pvlA-pivotShown', 'L-pvlA-scrolled'}   # (hold on live: cards and pivots show and scroll; no lc from a card page; pvlB-pivotShown reads the link's pt / pl = NEW)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cvlE', 'cvlF', 'pvlA', 'pvlB') for c in CHK[sc]} | {'L-cnote-focusKeepsClipped', 'L-cnote-showAll', 'S-linkpos'}) - GUARDS   # (linkpos; showAll: the focus before its click opens the card on live, so the click closes it)
NEW = set()   # (linkpos is LIVE: old checks now)
GUARDS |= {'L-pvcfg-noBarOnTotal', 'L-pvcfgB-prefUntouched'}   # (hold on live: no bar on any tile there; a link writes no pref)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('pvcfg', 'pvcfgB') for c in CHK[sc]} | {'L-pmenu-tileConfigOn', 'L-pmenu-segCfgOn', 'L-pmenu-tableCfgOn', 'S-pvcfg'}) - GUARDS   # (pvcfg)
NEW = set()   # (pvcfg is LIVE since f378ce2, 2026-10-31: old checks now)
GUARDS |= {'L-plab-windowWord'}   # (holds on live: the window already says Total Value)
NEW = {'L-plab-pillWord', 'L-plab-meterWord', 'S-pvlab'} - GUARDS   # (pvlab: the tile's words)
NEW = set()   # (pvlab is LIVE since b6c6ce5, 2026-10-31: old checks now)
GUARDS |= {'L-cprint-tableWhenOff'}   # (holds on live: the table prints, no sheet)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cprint', 'gprint', 'pprint') for c in CHK[sc]} | {'S-cprint'}) - GUARDS   # (cprint)
NEW = set()   # (cprint is LIVE since a70360f, 2026-10-31: old checks now)
GUARDS |= {'L-cfix-orderKept', 'L-cfix-whiteIsCard', 'L-cfix-viewerSavesReport', 'L-cfix-keysColumn', 'L-cmenu-cardRowOnly', 'L-cnote-menuAddNote', 'L-cnote-cardWording', 'L-cnote-topAligned',
           'L-ckword-copyCardLabel', 'L-ckword-copyCardToast', 'L-ckword-copyFailCard', 'L-cauthB-pendingKept'}   # (hold on live: the keys on rows of one height; the card's padding is its white space there too)   # (hold on live: the order, white space's card menu, a viewer's Save)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cfix', 'cfixB', 'pfix') for c in CHK[sc]} | {'S-cfix', 'S-roundN', 'S-detHelp',
       'L-cfmt-buttonWords', 'L-csize-formSize', 'L-cxl-formXl', 'L-cauth-noDefaultYet', 'L-cauth-notReports', 'L-cauth-fieldLimit', 'L-cauth-makeDefault',
       'L-cauth-defaultClearsMine', 'L-cauthB-editorLine', 'L-cauthB-chipsShow', 'L-cauthB-mineFirst', 'L-cauthB-reedit', 'L-cauthB-pendingKept',
       'L-pvcfg-madeDefault', 'L-cdet-shownColumns', 'L-cdet-values', 'L-cdet-noHidden', 'L-cfields-windowCount', 'L-cfields-labelsDefault',
       'L-clayoutB-seededShown', 'L-cvlC-cleaned', 'L-cviewer-viewerWindow', 'L-cmenu-cardRowOnly', 'L-cnote-menuAddNote', 'L-cnote-cardWording', 'L-cnote-topAligned', 'L-ckword-copyCardLabel', 'L-ckword-copyCardToast', 'L-ckword-copyFailCard', 'L-cwhite-hotNotWhite', 'L-clayout-authorUntouched', 'L-clayoutB-formIsAuthors', 'L-cprint-pageFields', 'L-cfields-detailsLabels', 'L-cauth-removeDefault'}) - GUARDS   # (cfix: the new checks, and the old ones its changes rewrote)
NEW = set()   # (cfix is LIVE since cc6fc06, 2026-10-31: old checks now)
GUARDS |= {'L-cfixprint-pdfTableStays', 'L-gfix2-laneFilled'}   # (hold on live: the email's PDF is the table; a lane fills its height)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cfixprint', 'gfix2') for c in CHK[sc]} | {'S-cfix2'}) - GUARDS   # (cfix2)
NEW = set()   # (cfix2 is LIVE since cb4c5fa, 2026-10-31: old checks now)
GUARDS |= {'L-cboard-guessPill', 'L-cboard-ungroupNoFlip'}   # (bdlay: hold on live - the guess is round S's; an ungroup there flips its board back to Cards, the same end)
GUARDS -= {'L-gfix2-laneFilled'}   # (bdlay: no longer holds on live - its board was a third view; the group menu's switch draws none there)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('gboard', 'gboardvl', 'cboard', 'cboardload', 'cboardrx', 'gfix2') for c in CHK[sc]}
       | {'L-cauto-switchShown', 'L-cauto-switchA11y', 'L-gprint-boardPath', 'S-bdlay'}) - GUARDS   # (bdlay: Board is the grouping's third layout, not a third view)
NEW = set()   # (bdlay is LIVE since 0a7dd3a, 2026-10-31: old checks now)
NEW = {'L-csort-labelled', 'L-csort-listShown', 'L-pfsort-listShown', 'S-csortlbl'} - GUARDS   # (csortlbl: the Sort by label, the options the bare names)
NEW = set()   # (csortlbl is LIVE since af71fe0, 2026-10-31: old checks now)

GUARDS |= {'L-cchips-pairPlain', 'L-cchips-plainPlain', 'L-cchips-linkKept', 'L-cchips-cellStill'}   # (hold on live: no value is a chip there; a value's click filters by its text)
NEW = ({'L-cchips-%s' % c for c in CHK['cchips']} | {'S-cchips'}) - GUARDS   # (cchips)
NEW = set()   # (cchips is LIVE since 535cc83, 2026-10-31: old checks now)
GUARDS |= {'L-gboardbig-findDraws'}   # (holds on live: the one step there grows to Find's row; bdlay2 keeps it per lane)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('gboardfew', 'gboardbig') for c in CHK[sc]}
       | {'L-gboard-chipBoard', 'L-gboard-keepsScroll', 'L-gboard-sortFollows', 'L-gboard-grpPopLayouts', 'L-gboard-grpPopActions', 'L-gboard-grpPopSwitch', 'S-bdlay2'}) - GUARDS   # (bdlay2: the user's first look at the live board)
NEW = set()   # (bdlay2 is LIVE since fa4307e, 2026-10-31: old checks now)
NEW = {'L-gboard-pageFits', 'L-gboard-noRoomUnder', 'L-gboard-chipGone', 'L-gboard-grpSize', 'L-gboard-bandMenuOnce', 'L-gboard-sortOff',
       'L-gboardbig-laneCount', 'S-bdlay3'} - GUARDS   # (bdlay3: the user's second look at the board)
NEW = set()   # (bdlay3 is LIVE since fd649f9, 2026-10-31: old checks now)
GUARDS |= {'L-gdet-countAll'}   # (cband: holds on live - the details count every card drawn, in bands or not)
NEW = ({'L-gcards-%s' % c for c in ('inBands', 'bandHeads', 'bandAggs', 'bandTableHidden', 'headSticky', 'bandGrows', 'bandCards', 'totalCards', 'staleGone')}
       | {'L-gcoll-%s' % c for c in ('bandsOpen', 'bandClick', 'bandAgain', 'bandKey', 'collapseAll', 'expandAll', 'keptAcrossViews', 'focusKept')}
       | {'L-gncoll-branchFolds', 'L-gsort-bandsSorted', 'L-gsort-menuSortFollows', 'L-gfind-bandMarked', 'L-gfind-foldedRevealed', 'L-gprint-gPath'}
       | {'L-gmenu-%s' % c for c in ('bandMenu', 'bandNoColumn', 'bandActs', 'bandKeyboard', 'bandRefocus')}
       | {'L-gdet-%s' % c for c in ('opensInGroup', 'nextCrossesBand', 'countAll')}
       | {'L-gbandbig-%s' % c for c in CHK['gbandbig']} | {'S-cband'}) - GUARDS   # (cband: the cards in the grouped view's own bands)
NEW = set()   # (cband is LIVE since 834ce16, 2026-11-01: old checks now)
GUARDS |= {'L-cmail-screenSame'}   # (cdash: holds on live - nothing there draws an email body to change the screen)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cmail', 'gmail', 'pmail') for c in CHK[sc]} | {'S-cdash'}) - GUARDS   # (cdash: the email's cards)
NEW = set()   # (cdash is LIVE since b5bde15, 2026-11-01: old checks now)
GUARDS |= {'L-cdens-tableFollows', 'L-cdens-backToStandard', 'L-cdens-noOverlap', 'L-cdens-dlgStandard', 'L-cdensph-sheetStandard', 'L-cdensph-sheetFits', 'L-gdens-boardBack'}   # (cdens: hold on live - the table's density, nothing moved, the caps at Standard, a phone's sheets held by a percentage)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cdens', 'cdensph', 'gdens') for c in CHK[sc]} | {'S-cdens'}) - GUARDS   # (cdens: the cards follow density)
NEW = set()   # (cdens is LIVE since 8e67c7d, 2026-11-01: old checks now)
GUARDS |= {'L-cflt-noneOff', 'L-cflt-colOnly', 'L-cflt-otherOpens', 'L-cflt-detOtherStays', 'L-cflt-colOffClears', 'L-cflt-allOffClears'}   # (cflt: hold on live - nothing marked there, a click opens the details)
NEW = ({'L-cflt-%s' % c for c in CHK['cflt']} | {'S-cflt'}) - GUARDS   # (cflt: Click to filter on a card's field and in the details window)
GUARDS |= {'L-csave-linkClean'}   # (csched: holds on live - authored() there never carries open / sent)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('csave', 'copen') for c in CHK[sc]} | {'L-cmail-mailThemed', 'L-cmail-mailDefaultTheme', 'S-csched', 'S-cdash'}) - GUARDS   # (csched)
NEW = set()   # (csched is LIVE since 4bb5714, 2026-11-01: old checks now)
GUARDS |= {'L-cdpack-standardTight'}   # (cdpack: holds on live - no density rule outranks the Standard size's or Standard density's pack)
NEW = ({'L-cdpack-%s' % c for c in CHK['cdpack']} | {'S-cdpack'}) - GUARDS   # (cdpack: no row gap in a packed grid)
NEW = set()   # (cdpack is LIVE since 8cd5426, 2026-11-01: old checks now)
NEW = {'L-cmail-mailCols', 'L-cmail-mailBig', 'L-cmail-mailCompact', 'L-cmail-mailSized', 'L-cmail-mailShownSize', 'L-cshare-optGone',
       'S-emailCards', 'S-urlHelp', 'S-cmsize'} - GUARDS   # (cmsize: the email cards by the size shown; no Open as cards in the email dialog)
NEW = set()   # (cmsize is LIVE since 3fd86cf, 2026-11-01: old checks now)
GUARDS |= {'L-cnote-dblWaits'}   # (cfb8: holds on live - a click on a note opens nothing there)
NEW = ({'L-cnote-%s' % c for c in ('textClickOpens', 'pencilHead', 'labelAdds', 'sizeWords', 'notesMenu', 'sharedEditLabel', 'mailNotes', 'btnsUnder')}
       | {'L-gboard-tableMenuNoBoard', 'L-cboard-menuNoBoard', 'L-cmail-mailPillOutlined', 'L-cmail-mailMediumAsked', 'S-xlHelp', 'S-sizeHelp', 'S-cmsize', 'S-cfb8', 'S-viewLink', 'S-sizeRows', 'L-cszvlA-describedCz'}) - GUARDS   # (cfb8: the user's eight notes on the cards)
NEW = set()   # (cfb8 is LIVE since e1c835f, 2026-11-01: old checks now)
NEW = {'L-csave-sentSize', 'L-csave-sentSizeKept', 'S-csz'}   # (csz: the saved view's size)
NEW = set()   # (csz is LIVE since 4cda1d2, 2026-11-01: old checks now)
GUARDS |= {'L-cnotedet-delInDetails'}   # (cdel: holds on live - the details window always had the x)
NEW = {'L-cnote-noDelOnCard', 'L-cnote-linkThemed', 'S-cdel'} - GUARDS   # (cdel: no x on a card; links themed)
NEW = set()   # (cdel is LIVE since 883f359, 2026-11-01: old checks now)
GUARDS |= {'L-ctmenu-headerFlyout'}   # (crow: holds on live - a heading's menu never had the row's item)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('ctrow', 'gtrow') for c in CHK[sc]} | {'L-ctmenu-rowTop', 'L-ctmenu-flyout', 'L-ctmenu-rowCard', 'S-crow'}) - GUARDS   # (crow: the row's window over the table)
NEW = set()   # (crow is LIVE since 5b78a0c, 2026-11-02: old checks now)
GUARDS |= {'L-cnest-whiteStillCard', 'L-ctclear-clearRuns'}   # (cnest: hold on live - the card's padding, the item's own run)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cnest', 'ctclear') for c in CHK[sc]}) - GUARDS   # (cnest: nested gaps, Clear all last)
GUARDS |= {'L-csweep-backdropCloses', 'L-csweep-reopenMidFade'}   # (cnest sweep: hold on live - one click on the backdrop closed it; a window opened in the X's fade stays)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cnest', 'ctclear', 'csweep', 'gsweep', 'gbcols', 'cpct', 'cfindgo', 'ctsel') for c in CHK[sc]}
       | {'S-cnest', 'S-cnPvSetup', 'S-cnTotalWord', 'S-cnResetPv', 'S-cnResetFlat'}) - GUARDS   # (cnest + its sweep)
NEW = set()   # (cnest is LIVE since ab526da, 2026-11-02: old checks now)
NEW = {'L-cgbar-%s' % c for c in CHK['cgbar']}   # (gbar: a chart's rows as a list in the details window)
NEW = set()   # (gbar is LIVE since c08a91a, 2026-11-02: old checks now)
NEW = {'L-cgbar-escCanvas'}   # (gfocus: Escape focuses a chart canvas)
NEW = set()   # (gfocus is LIVE, 2026-11-02: old checks now)

# (2026-11-02, cfsplit 4; the user: "In card detailed mode and table mode, right clicking on a split item does not offer filter
# or copy of just that item") citem: a chip right-clicked (H_TEXT's ; names, H_CODE's | codes), on the card and in the details
# window: Filter to / Exclude its value and its Copy first; guards (hold on live): none on a field of one value or a plain one
SCN = SCN + ['citem']
CHK['citem'] = ['chipMenu', 'chipCopy', 'chipFilterRuns', 'chipExcludeRuns', 'chipCopyRuns', 'pipeChip', 'detChip', 'oneChipNone', 'pillNone']
GUARDS |= {'L-citem-oneChipNone', 'L-citem-pillNone'}
NEW = ({'L-citem-%s' % c for c in CHK['citem']} | {'S-citem'}) - GUARDS
NEW = set()   # (cfsplit 4 is LIVE since 81e2699, 2026-11-02: old checks now)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('cw2det', 'cw2nest', 'cw2more', 'cw2pdf', 'gw2band', 'gw2mail', 'pw2piv', 'pw2next') for c in CHK[sc]}) - GUARDS   # (csw2: the second card sweep)
NEW = set()   # (csw2 is LIVE since a7d63c3, 2026-11-02: old checks now)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('pw3dup', 'gw3agg', 'gw3cnt', 'ct3save') for c in CHK[sc]}) - GUARDS   # (cleft: the second sweep's leftovers)
NEW = set()   # (cleft is LIVE since 4300d47, 2026-11-03: old checks now)
NEW = ({'L-clay1-%s' % c for c in CHK['clay1']} | {'S-clay'}) - GUARDS   # (clay: named card layouts)
NEW = set()   # (clay is LIVE since 7bcb809, 2026-11-03: old checks now)
# (cardlink, 2026-11-05, the user) a card's link by its RECORD (ck) not its place (cd); Copy link to this card (the window's
# icon and menu, a card's menu); Alt+Shift+L (the page menu's module). cvlE's carriesDetails / described now read ck.
SCN = SCN + ['cklA', 'cklB', 'cklC', 'cklD', 'cklT', 'cklTB', 'gklA', 'gklB', 'gklT', 'gklTB', 'pklP', 'pklB', 'gklC', 'gklD', 'gklE']
CHK['cklA'] = ['carriesRecord', 'sameAsRow', 'noValues', 'included', 'described', 'iconShown', 'iconCopies', 'toastWords', 'menuInWindow', 'menuCopies',
               'hotkeyCard', 'hotkeyView', 'hotkeyInField', 'hotkeyNoClash', 'cardMenu', 'cardMenuCopies', 'pageMenuNote', 'carriesScroll']
CHK['cklB'] = ['bootsCards', 'detailsOpen', 'sameRecord', 'otherPlace', 'pageTurned', 'scrolledAsSent']
CHK['cklC'] = ['noWindow', 'saysGone']
CHK['cklD'] = ['noWindow', 'saysFiltered', 'offersClear', 'clearOpens']
CHK['cklT'] = ['tableWindow', 'carriesRecord', 'iconShown']
CHK['cklTB'] = ['tableStays', 'sameRecord']
CHK['gklA'] = ['carriesRecord']
CHK['gklB'] = ['groupedOpens']
CHK['gklT'] = ['carriesRecord']
CHK['gklTB'] = ['groupedRow']
CHK['pklP'] = ['iconShown', 'menuItem', 'carriesTile', 'hotkeyCard']   # (cardlink 2) a pivot tile links to itself
CHK['pklB'] = ['tileOpens']
CHK['gklC'] = ['carriesGroups']   # (cardlink 2, the user: "didnt work in a group") a link that keeps a folded group
CHK['gklD'] = ['opensWithFolds', 'foldKept']
CHK['gklE'] = ['opensFolded', 'groupOpened']
GUARDS |= {'L-cklC-noWindow', 'L-cklD-noWindow', 'L-gklC-carriesGroups'}   # (hold on live: no window from a link that names no card; the open groups were always carried)
# (hold on live too: Ctrl+Shift+L is still Configure cards; 'open card' was listed for cd; the link boots cards and opens A
# window - on live the card at the old PLACE, which sameRecord catches; the table's own window opens, the table stays)
GUARDS |= {'L-cklA-hotkeyNoClash', 'L-cklA-included', 'L-cklB-bootsCards', 'L-cklB-detailsOpen', 'L-cklT-tableWindow', 'L-cklTB-tableStays'}
NEW_CARDLINK = ({'L-%s-%s' % (sc, c) for sc in ('cklA', 'cklB', 'cklC', 'cklD', 'cklT', 'cklTB', 'gklA', 'gklB', 'gklT', 'gklTB', 'pklP', 'pklB', 'gklC', 'gklD', 'gklE') for c in CHK[sc]}
       | {'L-cvlE-carriesDetails', 'L-cvlE-described', 'S-cardlink'}) - GUARDS   # added after every later round's NEW line (below)
# (viewstrict, 2026-11-05, the user: "a fresh report and only the customizations from the link, not a mix and match")
SCN = SCN + ['vstA', 'vstB', 'vstC']
CHK['vstA'] = ['carriesRowHeight']
CHK['vstB'] = ['noteButtons', 'linkLayout', 'calcStrict', 'rowFromLink', 'ownDensity', 'clearIsLeave', 'menuKeepLeave', 'pageMenu', 'visitNoWrite',
               'keptLayout', 'keptCalc', 'keptRow', 'keptOwnDensity', 'keptToast', 'leaveUrl', 'clearAllLeaves', 'oneLine']
CHK['vstC'] = ['linkDensity', 'keptDensity']   # (density: the harness loads the theme ids after main.js, so a link's theme is dropped there)
NEW_VST = {'L-%s-%s' % (sc, c) for sc in ('vstA', 'vstB', 'vstC') for c in CHK[sc]} | {'S-viewstrict'}
# (hscroll, 2026-11-06, the user: the header and the sideways scroll in links)
SCN = SCN + ['hsA', 'ghsA', 'ghsB', 'gbdA', 'gbdB']
CHK['hsA'] = ['hdrUrl', 'hdrSaid', 'noHdrWhenShown']
CHK['ghsA'] = ['carriesCol']
CHK['ghsB'] = ['boxAtCol']
CHK['gbdA'] = ['carriesLane', 'laneSaid']
CHK['gbdB'] = ['laneAtLeft']
NEW_HS = {'L-%s-%s' % (sc, c) for sc in ('hsA', 'ghsA', 'ghsB', 'gbdA', 'gbdB') for c in CHK[sc]}
CKL = {'ghsB': ('ghsA', 'token'), 'gbdB': ('gbdA', 'token'), 'vstB': ('vstA', 'token'), 'vstC': ('vstA', 'token'), 'cklB': ('cklA', 'token'), 'cklC': ('cklA', 'tokenGone'), 'cklD': ('cklA', 'tokenFiltered'), 'cklTB': ('cklT', 'token'), 'gklB': ('gklA', 'token'), 'gklTB': ('gklT', 'token'), 'pklB': ('pklP', 'token'), 'gklD': ('gklC', 'token'), 'gklE': ('gklC', 'tokenFolded', 'want2')}
MUTANTS = {
    # (hscroll) one per behaviour
    'hs-hdr': ([('main', "        var hdrPart = hdrHidden ? '&noheader' : '';", "        var hdrPart = '';")], ['L-hsA-hdrUrl'], ['hsA']),
    'hs-col': ([('main', "colAt = _pnbVlBoxLeftCol(box);", "colAt = null;")], ['L-ghsA-carriesCol'], ['ghsA']),
    'hs-colto': ([('main', "                if (pr[2]) _pnbVlBoxToCol(box, pr[2]);", "")], ['L-ghsB-boxAtCol'], ['ghsA', 'ghsB']),
    'hs-lane': ([('main', "var blNow = CDb.boardLane(); if (blNow) v.bl = blNow;", "var blNow = null;")], ['L-gbdA-carriesLane'], ['gbdA']),
    'hs-laneto': ([('cards', "        if (w.lane) boardToLane(w.lane);", "")], ['L-gbdB-laneAtLeft'], ['gbdA', 'gbdB']),
    # (viewstrict) one per behaviour
    'vs-calc': ([('calc', "        if (!key || linkVisit()) return sessionDefs.slice();", "        if (!key) return sessionDefs.slice();")], ['L-vstB-calcStrict'], ['vstA', 'vstB']),
    'vs-own': ([('main', "if (!u.has('density') && v.dn && !_pnbVlOwnPref('penumbra_pref_density', 'penumbra_user_density', u.get('id'))) {", "if (!u.has('density') && v.dn) {")], ['L-vstB-ownDensity'], ['vstA', 'vstB']),
    'vs-rh': ([('main', "if (!u.has('rowheight') && (v.rh === 0 || v.rh === 1)) _penumbraUrlOverrides.rowheight", "if (false) _penumbraUrlOverrides.rowheight")], ['L-vstB-rowFromLink'], ['vstA', 'vstB']),
    'vs-rhw': ([('main', "if (!_pnbViewLink) localStorage.setItem('penumbra_pref_rowExpand', JSON.stringify(_rep2));", "localStorage.setItem('penumbra_pref_rowExpand', JSON.stringify(_rep2));")], ['L-vstB-visitNoWrite'], ['vstA', 'vstB']),
    'vs-clear': ([('main', "        if (_pnbViewLink) { _pnbViewLinkLeave(); return; }", "")], ['L-vstB-clearAllLeaves'], ['vstA', 'vstB']),
    'vs-keepcol': ([('main', "            localStorage.setItem('penumbra_column_prefs', JSON.stringify(disk));\n        } catch (e6) { }", "        } catch (e6) { }")], ['L-vstB-keptLayout'], ['vstA', 'vstB']),
    'vs-keepcalc': ([('main', "try { window.PenumbraCalc.keepVisit(); } catch (e7) { }", "")], ['L-vstB-keptCalc'], ['vstA', 'vstB']),
    'vs-menu': ([('menu', "        if (c && visiting() && window.PenumbraViewLink.keep) {", "        if (false) {")], ['L-vstB-menuKeepLeave'], ['vstA', 'vstB']),
    'vs-leave': ([('main', "var u = window.location.pathname + '?id=' + encodeURIComponent(id);", "var u = window.location.pathname + window.location.search;")], ['L-vstB-leaveUrl'], ['vstA', 'vstB']),
    'vs-rhcap': ([('main', "        v.rh = isRowExpandActive ? 1 : 0;", "")], ['L-vstA-carriesRowHeight'], ['vstA']),
    # (cardlink) one per behaviour
    'ck-cap': ([('main', "if (ckNow && (v.m === 'pivot') === !!ckNow.p) {", "if (false) {")], ['L-cklA-carriesRecord', 'L-cvlE-carriesDetails'], ['cklA', 'cvlE']),
    'ck-idlike': ([('main', "            var cand = names.filter(function (n) { return _PNB_VL_IDLIKE.test(n); }).concat(", "            var cand = [].concat(")], ['L-cklA-carriesRecord'], ['cklA']),
    'ck-turn': ([('main', "turned = FH.showRow(rec.tr);   // another page", "turned = false;   // another page")], ['L-cklB-sameRecord', 'L-cklB-pageTurned'], ['cklA', 'cklB']),
    'ck-wait': ([('cards', "&& cards().length && !raf) linkApply(); }", "&& cards().length) linkApply(); }")], ['L-cklB-sameRecord'], ['cklA', 'cklB']),
    'ck-miss': ([('main', "        if (!rec.tr) { _pnbViewLinkRecordMiss(rec.why, vlk); return false; }", "        if (!rec.tr) { return false; }")], ['L-cklC-saysGone', 'L-cklD-saysFiltered'], ['cklA', 'cklC', 'cklD']),
    'ck-retry': ([('main', "            if (rec.tr) { _pnbViewLinkOpenRecord({ ck: vlk.ck, cv: vlk.cv, m: vlk.m }); return; }", "            if (rec.tr) { return; }")], ['L-cklD-clearOpens'], ['cklA', 'cklD']),
    'ck-menu': ([('cards', "        if (lnk) prt.push(lnk);\n", "")], ['L-cklA-menuInWindow', 'L-cklA-menuCopies'], ['cklA']),
    'ck-cardmenu': ([('cards', "            if (clk) out.push(clk);\n", "")], ['L-cklA-cardMenu', 'L-cklA-cardMenuCopies'], ['cklA']),
    'ck-btn': ([('cards', "        if (e.target.closest('.pnb-cdet-link')) { e.preventDefault(); linkCopy(); return; }", "")], ['L-cklA-iconCopies'], ['cklA']),
    'ck-pvkey': ([('main', "if (tr.closest('#pivotResultTable')) { var ph = _pnbViewLinkPivotSig(tr); return ph ? { p: 1, h: ph } : null; }", "if (tr.closest('#pivotResultTable')) { return null; }")], ['L-pklP-carriesTile'], ['pklP']),
    'ck-pvapply': ([('cards', "            if (pc) { focusAt = cardIndex(pc); roving(); openDetails(pc); detScrollTo(w.ds); }", "            if (false) { }")], ['L-pklB-tileOpens'], ['pklP', 'pklB']),
    'ck-gpoll': ([('main', "                if (vlg.ck && vlg.m === 'group') setTimeout(", "                if (false) setTimeout(")], ['L-gklD-opensWithFolds'], ['gklC', 'gklD']),
    'ck-gopen': ([('main', "        var opened = rec.grouped ? _pnbViewLinkOpenGroups(rec.tr) : false;", "        var opened = false;")], ['L-gklE-opensFolded'], ['gklC', 'gklE']),
    'ck-dscap': ([('main', "                if (dsNow > 0) v.ds = dsNow;\n", "")], ['L-cklA-carriesScroll'], ['cklA']),
    'ck-ds': ([('cards', "selectOnly(dc); openDetails(dc); detScrollTo(w.ds); }", "selectOnly(dc); openDetails(dc); }")], ['L-cklB-scrolledAsSent'], ['cklA', 'cklB']),
    'ck-hotcard': ([('wsmenu', "V.cardOpen() && typeof V.copyCard === 'function')", "false && typeof V.copyCard === 'function')")], ['L-cklA-hotkeyCard', 'L-pklP-hotkeyCard'], ['cklA', 'pklP']),
    'ck-hotkey': ([('wsmenu', "        if (!linkKey(e) || e.repeat) { return; }", "        if (true || !linkKey(e) || e.repeat) { return; }")], ['L-cklA-hotkeyCard', 'L-cklA-hotkeyView', 'L-cklA-hotkeyInField', 'L-pklP-hotkeyCard'], ['cklA', 'pklP']),
    'ck-group': ([('main', "        var grouped = $('#groupedResultsContainer').is(':visible');\n        var trs = document", "        var grouped = false;\n        var trs = document")], ['L-gklTB-groupedRow'], ['gklT', 'gklTB']),   # (the grouped cards also find the flat table's row: equivalent there)
    'ck-table': ([('main', "        if (typeof CD.openRow === 'function' && CD.openRow(rec.tr)) { if (typeof CD.detScrollTo", "        if (false) { if (typeof CD.detScrollTo")], ['L-cklTB-sameRecord'], ['cklT', 'cklTB']),
    # (cdpack) the packed grid's row-gap guard gone: the density rules' size gaps come back
    'pk-rowgap': ([('cardscss', '#pnbCardsHost.is-packed .pnb-cards-grid { row-gap: 0 !important; }\n', '')], ['L-cdpack-compactTight', 'L-cdpack-everyTight', 'S-cdpack'], ['cdpack']),
    # (cflt) no mark; the details window's click gone; a link's value marked; the report's flip not redrawn; no pointer; the column's
    # own not underlined; no hover
    'cf-mark': ([('cards', "    function cfltCls(td) { return cflt(td) ? ", "    function cfltCls(td) { return false ? ")], ['L-cflt-colMarked', 'L-cflt-detMarked', 'L-cflt-allMarked'], ['cflt']),
    'cf-det': ([('cards', "        if (cv && det.tr && !(window.getSelection", "        if (false && cv && det.tr && !(window.getSelection")], ['L-cflt-detFilters'], ['cflt']),
    'cf-link': ([('cards', "        if (td.querySelector('a, button, input, select, textarea')) return false;\n", "")], ['L-cflt-linkUnmarked'], ['cflt']),
    'cf-watch': ([('cards', "                if (cf !== lastCf) { lastCf = cf; if (on()) formatted(); }\n", "")], ['L-cflt-allMarked'], ['cflt']),
    'cf-ptr': ([('cardscss', ".pnb-card-val.is-cflt[data-col] { cursor: pointer; }\n", "")], ['L-cflt-colPointer', 'L-cflt-detMarked'], ['cflt']),
    'cf-rest': ([('cardscss', ".pnb-card-val.is-cfltcol[data-col] { text-decoration: underline dotted; text-underline-offset: 2px; }\n", "")], ['L-cflt-colAtRest'], ['cflt']),
    'cf-tip': ([('cards', "        var w = chips ? 'Click a value to filter to it' : 'Click to filter to this value';", "        var w = '';")], ['L-cflt-colMarked', 'L-cflt-allMarked'], ['cflt']),
    # (cdens) density: the Standard size's rules, Extra large's, Large's fields, Easy Read's Verdana, the lane heads, the dialogs' caps, the re-read
    'dn-std': ([('cardscss', 'body.density-compact #pnbCardsHost .pnb-card { padding: 8px 10px; gap: 5px; font-size: 11px; }\n', '')], ['L-cdens-typeFollows', 'L-cdens-roomFollows'], ['cdens']),
    'dn-xl': ([('cardscss', 'body.density-easy-read #pnbCardsHost.is-xl .pnb-card { padding: 21px 23px; gap: 13px; font-size: 16px; }\n', '')], ['L-cdens-typeFollows', 'L-cdens-roomFollows'], ['cdens']),
    'dn-fields': ([('cardscss', 'body.density-compact #pnbCardsHost.is-large .pnb-card-fields,\nbody.density-compact #pnbCardsHost.is-large .pnb-card-notes { font-size: 11px; }\n', '')], ['L-cdens-fieldsFollow'], ['cdens']),
    'dn-verdana': ([('cardscss', "body.density-easy-read #pnbCardsHost { font-family: 'Verdana', 'Arial', 'Georgia', serif; }\n", '')], ['L-cdens-easyVerdana'], ['cdens']),
    'dn-lane': ([('cardscss', 'body.density-easy-read .pnb-cards-lane > .pnb-cards-lanehead { font-size: 15px; padding: 10px 12px; }\n', '')], ['L-gdens-laneHeadFollows'], ['gdens']),
    'dn-cap': ([('cardscss', '#pnbCardDetails .pnb-cdet-box { max-width: calc(95vw / var(--pnb-dz)); max-height: calc(90vh / var(--pnb-dz)); }\n', '#pnbCardDetails .pnb-cdet-box { }\n')], ['L-cdens-dlgCapsScreen'], ['cdens']),
    'dn-reread': ([('cards', "        scheduleClip();   // (cdens) a density switch resizes the cards' type and the bar above the board: which are cut, and the lanes' height, read again\n", '')], ['L-gdens-boardRefit'], ['gdens']),
    # (cband) the cards in the grouped view's own bands
    'k-gcin': ([('cards', "        if (gc.parentNode !== el) {\n            if (!gcHomeAt)", "        if (false) {\n            if (!gcHomeAt)")], ['L-gcards-inBands'], ['gcards']),
    'k-gchome': ([('cards', "            gcHome();   // (cband) the grouped view home, the bands' grids gone, before the host empties\n", "")], ['L-gcoll-tableHome'], ['gcoll']),
    'k-gchome2': ([('cards', "        if (!band) gcHome();   // (cband) the grouped view home before the host is parked or written\n", "")], ['L-gboard-backToBoard'], ['gboard']),
    'k-sweep': ([('cards', "        for (var j = 0; j < xs.length; j++) if (seen.indexOf(xs[j]) < 0) xs[j].parentNode.removeChild(xs[j]);\n", "")], ['L-gcards-staleGone'], ['gcards']),
    'k-share': ([('cards', "        var share = Math.max(LANE_MIN, Math.ceil((drawn.limit || CAP) / Math.max(1, leaves.length)));\n", "        var share = drawn.limit || CAP;\n")], ['L-gbandbig-bandShares'], ['gbandbig']),
    'k-foot': ([('cards', "            if (rows.length > lim) {\n                var left = rows.length - lim, foot", "            if (false) {\n                var left = rows.length - lim, foot")], ['L-gbandbig-bandMore'], ['gbandbig']),
    'k-head': ([('cards', "            if (hd) { bandHead(hd, open); heads.push(hd); }\n", "            if (hd) { heads.push(hd); }\n")], ['L-gcoll-bandsOpen'], ['gcoll']),
    'k-headkey': ([('cards', "            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); bh.click(); }\n", "            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); }\n")], ['L-gcoll-bandKey'], ['gcoll']),
    'k-headmenu': ([('cards', "                bh.dispatchEvent(bev);\n", "")], ['L-gmenu-bandKeyboard'], ['gmenu']),
    'k-menutag': ([('cards', "        if (rh) { if (!e.pnbCardMenu) e.pnbCardMenu = { kind: 'band', el: rh, focus: rh, card: null }; return; }\n", "        if (rh) { return; }\n")], ['L-gmenu-bandMenu'], ['gmenu']),
    'k-focus': ([('cards', "        if (hadFocus && document.activeElement.closest('#groupedResultsContainer') && !document.activeElement.closest('.pnb-card')) hadFocus = false;   // (cband) a band's own head (main.js's) keeps its focus\n", "")], ['L-gcoll-focusKept'], ['gcoll']),
    'k-css-show': ([('cardscss', "body.pnb-cards-on.pnb-cards-inband #groupedResultsContainer {\n    position: static !important;", "body.pnb-cards-on.pnb-cards-inband #groupedResultsContainer-x {\n    position: static !important;")], ['L-gcards-inBands'], ['gcards']),
    'k-css-table': ([('cardscss', ":not(.pnb-cards-inband):not(.pnb-cards-bandmore):not(.group-wrapper) {", ":not(.pnb-cards-inband):not(.pnb-cards-bandmore):not(.group-wrapper)-x {")], ['L-gcards-bandTableHidden'], ['gcards']),
    'k-css-grow': ([('cardscss', "#groupedResultsContainer .group-content { position: relative; max-height: none; overflow: visible; }", "#groupedResultsContainer .group-content { position: relative; }")], ['L-gcards-bandGrows'], ['gcards']),
    'k-css-sticky': ([('cardscss',"body.pnb-cards-on.pnb-cards-inband:not(.pnb-gl-on) #groupedResultsContainer .group-header { position: sticky; }\n", "")], ['L-gcards-headSticky'], ['gcards']),
    # (csortlbl) the label gone; an aria-label over it again; the table's and the tiles' options worded Sort: again; None
    # worded Sort: none again; the help's old words
    'sl-label': ([('index', '<label for="pnbCardsSort">Sort by</label>', '')], ['L-csort-labelled', 'S-csortlbl'], ['csort']),
    'sl-aria': ([('index', '<select id="pnbCardsSort" class="pnb-cards-sortsel" title=', '<select id="pnbCardsSort" class="pnb-cards-sortsel" aria-label="Sort the cards" title=')], ['L-csort-labelled', 'S-csortlbl'], ['csort']),
    'sl-prefix': ([('cards', "'\">' + esc(h.friendly) + (h === extra", "'\">Sort: ' + esc(h.friendly) + (h === extra")], ['L-csort-listShown', 'L-csort-labelled'], ['csort']),
    'sl-pvprefix': ([('cards', "'\">' + esc(e.label) + '</option>'; }).join('');", "'\">Sort: ' + esc(e.label) + '</option>'; }).join('');")], ['L-pfsort-listShown'], ['pfsort']),
    'sl-none': ([('cards', "s.innerHTML = '<option value=\"\">None</option>' + list.concat(", "s.innerHTML = '<option value=\"\">Sort: none</option>' + list.concat(")], ['L-csort-listShown', 'S-csortlbl'], ['csort']),
    'sl-help': ([('ustopic', '<li><strong>Sort by</strong> in the Cards segment', '<li>The <strong>Sort</strong> list in the Cards segment')], ['S-csortlbl'], []),
    # (cdash) the email's cards: no chips; a chip's rule dropped; the pill's rule dropped; no budget; compact two a row; compact
    # fields kept; a closed group's rows; no group headings; a pivot offered; raw cells (no email cleaning); the dialog's wiring
    'cd-nochips': ([('cards', "var id = (hh && td && !td.children.length", "var id = (false && hh && td && !td.children.length")], ['L-cmail-mailChips', 'L-cmail-mailRuled'], ['cmail']),
    'cd-chiprule': ([('cards', "';color:' + th.text + ';' + st(td) + '\">' + esc(ps[c])", "';color:' + th.text + ';' + '\">' + esc(ps[c])")], ['L-cmail-mailRuled'], ['cmail']),
    'cd-pillrule': ([('cards', "'border:1px solid ' + (ps ? 'transparent' : th.text) + ';' + (ps || 'color:' + th.text + ';')", "'border:1px solid ' + th.text + ';' + ('color:' + th.text + ';')")], ['L-cmail-mailPill'], ['cmail']),   # (cfb8: re-anchored)
    'cd-budget': ([('cards', "                if (budget && bytes + c.length > budget) { cut = true; continue; }\n", "")], ['L-cmail-mailBudget'], ['cmail']),
    'cd-cols': ([('cards', "compact: { cols: 4,", "compact: { cols: 3,")], ['L-cmail-mailCompact', 'L-cmail-mailSized'], ['cmail']),   # (cmsize: the size table)
    # (cmsize) Large sent as Standard (the user's report) / the title's type fixed / the padding fixed / the send's call at
    # Standard whatever shows / the builder's cards option back / the view link's size dropped / the dialog's handler back
    'cm-large': ([('cards', "large: { cols: 2, pad: '14px 16px', title: 15, sub: 12, big: 22, field: 12, label: 11 }", "large: { cols: 2, pad: '11px 12px', title: 13, sub: 11, big: 19, field: 11, label: 11 }")], ['L-cmail-mailSized', 'L-cmail-mailShownSize'], ['cmail']),
    'cm-type': ([('cards', "'<div style=\"font-size:' + ms.title + 'px;font-weight:bold;", "'<div style=\"font-size:14px;font-weight:bold;")], ['L-cmail-mailSized', 'L-cmail-mailShownSize'], ['cmail']),
    'cm-pad': ([('cards', "';border-radius:8px;padding:' + ms.pad + ';", "';border-radius:8px;padding:10px 12px;")], ['L-cmail-mailSized'], ['cmail']),
    'cm-cursize': ([('cards', "sz = SIZES.indexOf(opts.size) >= 0 ? opts.size : curSize(), ms =", "sz = SIZES.indexOf(opts.size) >= 0 ? opts.size : 'standard', ms =")], ['L-cmail-mailShownSize'], ['cmail']),   # (cfb8: re-anchored)
    # (cfb8) the pill filled again / an asked-for Medium refused / no notes in the email / no pencil / the label inert / no
    # double-click wait / the notes' menu the browser's / Medium's buttons beside the box / the Shared item's old words / the
    # sizes' old words / the card menu's Show as a board back / the notes' click inert again
    # (csz) the saved view without its size / the size dropped on read
    # (cdel) the x back on a card / a note's link red again / the hide reaching the details window too
    'cd-del': ([('cardscss', "#pnbCardsHost .journal-rownote-inline .journal-rownote-act button.journal-rownote-del, #pnbCardsHost .pnb-sharednote-file .pnb-sharednote-filedel { display: none; }", "#pnbCardsHost .pnb-sharednote-file .pnb-sharednote-filedel { display: none; }")], ['L-cnote-noDelOnCard'], ['cnote']),
    'cd-link': ([('maincss', ".journal-rownote-text a:not(.journal-attach-chip),\n.pnb-sharednote-text a:not(.journal-attach-chip) {\n    color: var(--brand-text, var(--brand-primary, #336699));", ".journal-rownote-text a:not(.journal-attach-chip),\n.pnb-sharednote-text a:not(.journal-attach-chip) {\n    color: var(--accent-danger, #cc0000);")], ['L-cnote-linkThemed'], ['cnote']),
    # (crow) the row's item back in the Show as cards list; the window's rows the cards'; the table's redraw closing it; the
    # count in cards; the cards' items in its menus; no menu in it; the cell not made active; the opened cell kept after a
    # step; Print refused; cards drawn under it keeping the table's rows; Quick actions' table path gone; folded rows kept
    'cr-top': ([('cards', "        if (tr) out.push({ act: 'showCardRow',", "        if (false) out.push({ act: 'showCardRow',")], ['L-ctmenu-rowTop', 'L-ctmenu-rowCard', 'L-ctrow-opens'], ['ctmenu', 'ctrow']),
    'cr-rows': ([('cards', "    function detRows() { return det.tbl ? (det.rows || []) : rowsDrawn.map(", "    function detRows() { return false ? (det.rows || []) : rowsDrawn.map(")], ['L-ctrow-opens', 'L-ctrow-nextRow'], ['ctrow']),
    'cr-sync': ([('cards', "            if (det.tbl) { if (det.open) detRender(); } else closeDetails(false);", "            closeDetails(false);")], ['L-ctrow-pageTurns', 'L-ctrow-sortFollows'], ['ctrow']),
    'cr-word': ([('cards', "var word = det.list ? ' ' + det.list.word : (det.tbl ? ' rows' : ' cards');", "var word = det.list ? ' ' + det.list.word : ' cards';")], ['L-ctrow-countRows', 'L-gtrow-opensInGroup'], ['ctrow', 'gtrow']),
    'cr-extras': ([('cards', "        if (t.tbl) return [];   // (crow)", "        if (false) return [];   // (crow)")], ['L-ctrow-menuInside'], ['ctrow']),
    'cr-menu': ([('cards', "if (!CM || !hostApi() || !(on() || (det.open && det.tbl))) return false;", "if (!CM || !hostApi() || !on()) return false;")], ['L-ctrow-menuInside'], ['ctrow']),
    'cr-active': ([('cards', "if (CS && typeof CS.activate === 'function') CS.activate(back); }", "}")], ['L-ctrow-escBack'], ['ctrow']),
    'cr-col': ([('cards', "        if (tr && tr.isConnected && col) for (i = 0; i < tr.cells.length; i++) if (tr.cells[i].getAttribute('data-column') === col) return tr.cells[i];\n", "")], ['L-ctrow-paletteBack'], ['ctrow']),
    'cr-print': ([('cards', "        if (!hostApi() || !(on() || (det.open && det.tbl))) return null;", "        if (!hostApi() || !on()) return null;")], ['L-ctrow-printsCard'], ['ctrow']),
    'cr-draw': ([('cards', "        if (det.open) { if (det.tbl && !det.list) tblEnd(); detRender(); }", "        if (det.open) { detRender(); }")], ['L-ctrow-toCards'], ['ctrow']),
    'cr-pal': ([('cards', "openDetails: function (card) { return (!card && !on()) ? openActive() : openDetails(card || null); },", "openDetails: function (card) { return openDetails(card || null); },")], ['L-ctrow-paletteRow', 'L-ctrow-paletteBack'], ['ctrow']),
    'cr-fold': ([('cards', "        return leafRows(null).filter(function (tr) { return tr.getClientRects().length > 0; });", "        return leafRows(null);")], ['L-gtrow-foldedSkipped', 'L-gtrow-opensInGroup'], ['gtrow']),
    # --- (cnest) a nested table's gaps; Clear all customizations last
    'cn-hit': ([('cards', "|| n.classList.contains('nested-json-container')) && inRect(", ") && inRect(")], ['L-cnest-nestHot', 'L-cnest-nestGapField', 'L-cnest-nestGapDetails'], ['cnest']),
    'cn-last': ([('menu', "        items = clearLast(items);   // (cnest)", "")], ['L-cnest-clearLastCard', 'L-cnest-clearLastLabel', 'L-cnest-clearLastDetails', 'L-ctclear-tableClearLast', 'L-ctclear-headClearLast'], ['cnest', 'ctclear']),
    'cn-sep': ([('menu', "return tidy.concat(tidy.length ? ['-'] : [], [c]);", "return tidy.concat([c]);")], ['L-cnest-clearLastCard', 'L-ctclear-tableClearLast'], ['cnest', 'ctclear']),
    # --- (cnest sweep) one mutant per fix
    'cs-esc': ([('cards', "    function escMine(t, sel) {", "    function escMine(t, sel) { return true;")], ['L-csweep-escOverPopover'], ['csweep']),
    'cs-dbl': ([('cards', "if (e.target === dlg && !(e.detail > 1) && !(detDown", "if (e.target === dlg && !(detDown")], ['L-csweep-dblKeeps'], ['csweep']),
    'cs-altcard': ([('cards', "        if (e.altKey || e.ctrlKey || e.metaKey) return;   // (cnest sweep)", "        // (cnest sweep)")], ['L-csweep-altKeys'], ['csweep']),
    'cs-altdet': ([('cards', "(e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.ctrlKey && !e.metaKey && !/^", "(e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/^")], ['L-csweep-altKeys'], ['csweep']),
    'cs-f10': ([('cards', "            if (openMenu(e.target, null)) { e.preventDefault(); e.stopPropagation(); }", "            e.preventDefault(); e.stopPropagation(); openMenu(e.target, null);")], ['L-csweep-menuKeyOnButton'], ['csweep']),
    'cs-cut': ([('cards', "            if (cut && !cells.length && sec.rows.length) continue;   // (cnest sweep)", "            // (cnest sweep)")], ['L-gsweep-cutNoHeads'], ['gsweep']),
    'cs-cols': ([('cards', "            var bd = c && boardOn();", "            var bd = false;")], ['L-gbcols-boardColsGreyed'], ['gbcols']),
    'cs-pct': ([('cards', "pv = /%\\s*$/.test(st) ? num(st) : null;", "pv = null;")], ['L-cpct-pctBar'], ['cpct']),
    'cs-pctlab': ([('cards', "(td.textContent.trim() || textOf(td));   // (cnest sweep)", "textOf(td);   // (cnest sweep)")], ['L-cpct-pctLabel'], ['cpct']),
    'cs-find': ([('cards', "        if (findWanted && (!findWanted.isConnected || (P.find", "        if (false && (!findWanted.isConnected || (P.find")], ['L-cfindgo-findLetGo'], ['cfindgo']),
    'cs-sel': ([('cards', "if (!det.tbl) sel = rowIdx(to);", "sel = rowIdx(to);")], ['L-ctsel-pageTurnNoSel'], ['ctsel']),
    'cs-pvsetup': ([('cards', " : ((report && report.pivot) ? report.pivot : null); }", " : null; }")], ['S-cnPvSetup'], []),
    'cs-total': ([('cards', "bigLabel = pvTotalWord(measures, bmi);", "bigLabel = 'Total ' + (measures[bmi] || '');")], ['S-cnTotalWord'], []),
    'cs-resetpv': ([('cards', "curp.own || curp.title || curp.fields || curp.nopack", "curp.own || curp.title || curp.fields")], ['S-cnResetPv'], []),
    'cs-resetflat': ([('cards', "H.layoutSet((keepPv && keepPv.pivot) ? { pivot: keepPv.pivot } : null);", "H.layoutSet(null);")], ['S-cnResetFlat'], []),
    'cn-tidy': ([('menu', "out.forEach(function (it) { if (it !== '-' || (tidy.length && tidy[tidy.length - 1] !== '-')) { tidy.push(it); } });", "out.forEach(function (it) { tidy.push(it); });")], ['L-cnest-clearLastCard', 'L-ctclear-tableClearLast'], ['cnest', 'ctclear']),
    # --- (csw2) the second card sweep: one mutant per fix
    'w2-sel': ([('cards', "        if (window.getSelection && !window.getSelection().isCollapsed && String(window.getSelection()).trim() !== '') return;   // (csw2) a drag", "        // (csw2) a drag")], ['L-cw2det-selNoWin'], ['cw2det']),
    'w2-drag': ([('cards', " && !(detDown && detDown !== dlg && dlg.contains(detDown))) closeDetails(true);", ") closeDetails(true);")], ['L-cw2det-dragKeeps'], ['cw2det']),
    'w2-top': ([('cards', "if (bx) bx.scrollTop = 0; if (bd) bd.scrollTop = 0; }", "if (bx) bx.scrollTop = 0; }")], ['L-cw2det-bodyTop'], ['cw2det']),
    'w2-end': ([('cards', "        if (fb && ((pd && document.activeElement === pb)", "        if (false && ((pd && document.activeElement === pb)")], ['L-cw2det-endFocus'], ['cw2det']),
    'w2-escm': ([('cards', "&& !e.defaultPrevented && menuOpen()) { e.preventDefault(); e.stopPropagation(); menuEngine().close(); return; }", "&& false) { }")], ['L-cw2det-escMenuFirst'], ['cw2det']),
    'w2-engine': ([('cards', "        if (!menuEngine()) return;   // (csw2)", "        // (csw2)")], ['L-cw2det-noEngine'], ['cw2det']),
    'w2-clip': ([('cards', "if (on() && !ms.every(moreOnly)) scheduleClip();", "if (on()) scheduleClip();")], ['L-cw2det-clipNoRepass'], ['cw2det']),
    'w2-panel': ([('menu', "        if (p.back && document.contains(p.back)) { t = p.back; }   // (csw2)", "        // (csw2)")], ['L-cw2det-panelFocus'], ['cw2det']),
    'w2-tlink': ([('cards', "        if (vl && vl.cards) return sizeOk", "        if (vl) return sizeOk")], ['L-cw2det-tableLinkSize'], ['cw2det']),
    'w2-sub': ([('cards', "            (subCell(target, t) || t.el).dispatchEvent(ev);", "            t.el.dispatchEvent(ev);")], ['L-cw2nest-subFilter'], ['cw2nest']),
    'w2-row': ([('cards', "        if (on()) return showAs(null, tr) === true;", "        if (on()) { showAs(null, tr); return det.open; }")], ['L-cw2more-rowNotDrawn'], ['cw2more']),
    'w2-more': ([('cards', "            if (mf && mat > 0) {", "            if (false) {")], ['L-cw2more-moreFocus'], ['cw2more']),
    'w2-pdf': ([('cards', "var sn = items.length ? null : box.querySelector('.pnb-sharednote-text')", "var sn = null")], ['L-cw2pdf-pdfShared'], ['cw2pdf']),
    'w2-band': ([('cards', "        if (best === null) {   // (csw2)", "        if (false) {   // (csw2)")], ['L-gw2band-bandDown'], ['gw2band']),
    'w2-regroup': ([('cards', "        if (lastDraw && lastDraw.gsig !== gsig) laneMore = Object.create(null);\n", "")], ['L-gw2band-regroupResets'], ['gw2band']),
    'w2-fold': ([('cards', "if (cut && !cells.length && sec.rows.length) continue;", "if (cut && !cells.length) continue;")], ['L-gw2mail-foldedHeadKept'], ['gw2mail']),
    'w2-once': ([('cards', "out += pvTile(tr, idx, measures, compact, false, ps0); count++;", "out += pvTile(tr, idx, measures, compact, false); count++;")], ['L-pw2piv-setupOnce'], ['pw2piv']),
    'w2-pvsel': ([('cards', "            sel = null; focusAt = 0; openCards = Object.create(null);\n", "")], ['L-pw2piv-selGone'], ['pw2piv']),
    'w2-pvdet': ([('cards', "            if (det.open && !det.tbl) closeDetails(false);\n", "")], ['L-pw2piv-detGone'], ['pw2piv']),
    'w2-pnext': ([('cards', "        if (det.open && hostApi() && H.inPivot()) {   // (csw2)", "        if (det.open && hostApi() && H.inPivot()) { return false;   // (csw2)")], ['L-pw2next-pivotNextOn'], ['pw2next']),
    # --- (cleft) the second sweep's leftovers: one mutant per fix
    'l3-dupn': ([('cards', "        if (n > 1 && ths.length >= n) {", "        if (false) {")], ['L-pw3dup-dupFields'], ['pw3dup']),
    'l3-dupsort': ([('cards', "            if (e.label && out.byKey[e.key] && e.kind !== 'field') {", "            if (false) {")], ['L-pw3dup-dupSort'], ['pw3dup']),
    'l3-agg': ([('cards', "var ga = w.querySelector(':scope > .group-header > .group-agg-summary');", "var ga = null;")], ['L-gw3agg-aggHead'], ['gw3agg']),
    'l3-cnt': ([('main', "return !$(this).closest('td, .pnb-card', w).length; }).length; };", "return true; }).length; };")], ['L-gw3agg-cntCard', 'L-gw3cnt-cntCell'], ['gw3agg', 'gw3cnt']),
    'l3-save': ([('cards', "        if (!v && (z === base || (!report && !on()))) return report;", "        if (!v && z === base) return report;")], ['L-ct3save-sizeNoWrite'], ['ct3save']),
    'cd-delall': ([('cardscss', "#pnbCardsHost .journal-rownote-inline .journal-rownote-act button.journal-rownote-del, #pnbCardsHost .pnb-sharednote-file .pnb-sharednote-filedel { display: none; }", ".journal-rownote-inline .journal-rownote-act button.journal-rownote-del, .pnb-sharednote-file .pnb-sharednote-filedel { display: none !important; }")], ['L-cnotedet-delInDetails'], ['cnotedet']),
    'cz-sent': ([('cards', "        sent.size = curSize();   // (csz, the user) the size the cards show: the scheduled email draws them at it\n", "")], ['L-csave-sentSize'], ['csave']),
    'cz-clean': ([('cards', "        if (SIZES.indexOf(x.size) >= 0) o.size = x.size;   // (csz)\n", "")], ['L-csave-sentSizeKept'], ['csave']),
    'cf-pillfill': ([('cards', "'border:1px solid ' + (ps ? 'transparent' : th.text) + ';' + (ps || 'color:' + th.text + ';')", "(ps || 'background-color:' + th.alt + ';color:' + th.text + ';')")], ['L-cmail-mailPillOutlined'], ['cmail']),
    'cf-askmed': ([('cards', "sz = SIZES.indexOf(opts.size) >= 0 ? opts.size : curSize(), ms =", "sz = sizeOk(opts.size) ? opts.size : curSize(), ms =")], ['L-cmail-mailMediumAsked'], ['cmail']),
    'cf-notesmail': ([('cards', "            if (nH && String(nH).replace(/<[^>]*>/g, '').trim()) h += ", "            if (false) h += ")], ['L-cnote-mailNotes'], ['cnote']),
    'cf-pencil': ([('cardscss', "#pnbCardsHost .journal-rownote-pencil[hidden] { display: inline-flex; }\n", "")], ['L-cnote-pencilHead'], ['cnote']),
    'cf-label': ([('cards', "                if (hb && hb.offsetParent !== null) { e.preventDefault(); hb.click(); }\n", "")], ['L-cnote-labelAdds'], ['cnote']),
    'cf-dblwait': ([('cards', "                if (e.detail > 1) return;\n", "")], ['L-cnote-dblWaits'], ['cnote']),
    'cf-notemenu': ([('cards', "        if (inNotes && t.closest(NOTE_OWN)) return null;\n", "        if (inNotes) return null;\n")], ['L-cnote-notesMenu'], ['cnote']),
    'cf-medium': ([('cardscss', "#pnbCardsHost:not(.is-large):not(.is-xl) .journal-rownote-inline .journal-rownote-input { grid-row: 2; grid-column: 1 / -1; }\n", "")], ['L-cnote-btnsUnder'], ['cnote']),
    'cf-sharedlbl': ([('cards', "var lb = window._penumbraJournalNotesMode === 'shared' ? 'Edit note...' :", "var lb = false ? 'Edit note...' :")], ['L-cnote-sharedEditLabel'], ['cnote']),
    'cf-sizelbl': ([('cards', "var SIZE_LABELS = { compact: 'Small', standard: 'Medium',", "var SIZE_LABELS = { compact: 'Compact', standard: 'Standard',")], ['L-cnote-sizeWords'], ['cnote']),
    'cf-cardboard': ([('cards', "        if (bd) out.push({ act: 'cardsStacked',", "        if (!bd && !t.pivot) out.push({ act: 'cardsBoard', label: 'Show as a board', run: function () { showBoard(); } });\n        if (bd) out.push({ act: 'cardsStacked',")], ['L-cboard-menuNoBoard'], ['cboard']),
    'cm-optback': ([('main', "        if (longS) delete v.s;\n", "        if (longS) delete v.s;\n        if (opts && opts.cards) { v.cv = 1; v.cz = opts.size; }\n")], ['L-cshare-optGone'], ['cshare']),
    'cm-seensize': ([('main', "            if (czNow === 'compact' || czNow === 'large' || czNow === 'xl') v.cz = czNow;\n", "")], ['L-cshare-asSeenSize'], ['cshare']),
    'cm-handler': ([('main', "#emailLinkAsView, #emailShowRecipients', updateEmailWarnings);", "#emailLinkAsView, #emailShowRecipients, #emailLinkAsCards', updateEmailWarnings);")], ['S-emailCards'], []),
    'cd-cfields': ([('cards', "                if (compact || !filled(fTd)) continue;\n", "                if (!filled(fTd)) continue;\n")], ['L-cmail-mailCompact'], ['cmail']),
    'cd-closed': ([('cards', "                var rows = open ? leafRows(w) : [];\n", "                var rows = leafRows(w);\n")], ['L-gmail-grpClosed'], ['gmail']),
    'cd-nohead': ([('cards', "            if (sec.name !== null) {\n", "            if (false) {\n")], ['L-gmail-grpHeads', 'L-gmail-grpNames'], ['gmail']),
    'cd-pivot': ([('cards', "    function emailable() { return !!(allowed() && !H.inPivot()); }", "    function emailable() { return !!allowed(); }")], ['L-pmail-noPivot'], ['pmail']),
    'cd-raw': ([('main', "return td ? cloneCell($(td))[0].innerHTML : '';", "return td ? td.innerHTML : '';")], ['L-cmail-mailCleaned'], ['cmail']),
    'cd-pdf': ([('main', "const pdfContent = await generatePdfContent({ cards: true });", "const pdfContent = await generatePdfContent();")], ['S-cdash'], []),
    # (csched) no opening in cards; no sent record; no lists; the open / sent left in links; the table's Save keeps them;
    # clean() drops open; the theme ignored (two ways)
    'cs-noopen': ([('cards', "        if (report && report.open) return 'cards';   // (csched) the report was saved showing cards\n", "")], ['L-copen-opensCards'], ['copen']),
    'cs-nosent': ([('cards', "        return { open: 1, sent: sent };\n", "        return { open: 1 };\n")], ['L-csave-savedNow', 'L-csave-saveWrites'], ['csave']),
    'cs-nolists': ([('cards', "        if (Object.keys(lists).length) sent.lists = lists;\n", "")], ['L-csave-savedLists'], ['csave']),
    'cs-strip': ([('cards', "        if (o && (o.open || o.sent)) { o = JSON.parse(JSON.stringify(o)); delete o.open; delete o.sent; }   // (csched) the server Save's alone\n", "")], ['L-csave-linkClean', 'L-csave-tableClears'], ['csave']),
    'cs-cleanopen': ([('cards', "        if (cfg.open === 1 || cfg.open === true) o.open = 1;   // (csched) saved while cards showed: it opens in cards\n", "")], ['L-copen-opensCards'], ['copen']),
    'cs-theme': ([('cards', "? v : MAIL_THEME[k][1]; }", "? MAIL_THEME[k][1] : MAIL_THEME[k][1]; }")], ['L-cmail-mailThemed'], ['cmail']),
    'cs-vars': ([('main', "emailVars: function () { var t = penumbraTheme(currentThemeId()); return (t && t.vars) || {}; }", "emailVars: function () { return {}; }")], ['L-cmail-mailThemed'], ['cmail']),
    # (cchips) no list read; a link's cell split; a repeat kept; no cap; the text between dropped; +N more not kept; the details
    # capped; a chip filtering by the cell's text; no reveal for Find; the rule off the chips; restyle writing the value; the
    # extra chips shown; the text between seen
    'ch-nolist': ([('cards', "        return (listMemo[h.name] = id);", "        return (listMemo[h.name] = '');")], ['L-cchips-listChips', 'L-cchips-pipeChips', 'L-cchips-detAll'], ['cchips']),
    'ch-plain': ([('cards', "var id = (td && !td.children.length && !td.hasAttribute('data-pnb-raw')) ? listOf(h) : '';", "var id = (td && !td.hasAttribute('data-pnb-raw')) ? listOf(h) : '';")], ['L-cchips-linkKept'], ['cchips']),
    'ch-dedupe': ([('cards', "            if (!m[2] || seen[m[2]]) { out[out.length - 1] += bits[i]; continue; }", "            if (!m[2]) { out[out.length - 1] += bits[i]; continue; }")], ['L-cchips-eachOnce'], ['cchips']),
    'ch-cap': ([('cards', "            var ex = (cap && i > 2 * cap) ? ' is-extra' : '';", "            var ex = '';")], ['L-cchips-capShown'], ['cchips']),
    'ch-sep': ([('cards', " : '<span class=\"pnb-cchip-sep' + ex + '\">' + esc(ps[i]) + '</span>';", " : '';")], ['L-cchips-textSame'], ['cchips']),
    'ch-keep': ([('cards', "        if (keep && k) { if (open) chipsOpen[k] = 1; else delete chipsOpen[k]; }\n", "")], ['L-cchips-moreKept'], ['cchips']),
    'ch-det': ([('cards', "ddHtml(tc, c, 0, '', '');", "ddHtml(tc, c, CHIP_MAX, 'd', '');")], ['L-cchips-detAll'], ['cchips']),
    'ch-filter': ([('cards', "        if (cq) { runSearch(cq); return true; }\n", "")], ['L-cchips-chipFilters'], ['cchips']),   # (re-aimed, cflt: the click moved into cfltRun)
    'ch-reveal': ([('cards', "        chipsReveal(el);   // (cchips)\n", "")], ['L-cchips-findShows'], ['cchips']),
    'ch-ruled': ([('cards', "        var st = styleOf(td, CHIP_PROPS), sa = st ?", "        var st = '', sa = st ?")], ['L-cchips-ruledChips'], ['cchips']),
    'ch-restyle': ([('cards', "if (vals[k].classList.contains('is-chips')) chipsRestyle(vals[k], vc); else vals[k]", "if (false) chipsRestyle(vals[k], vc); else vals[k]")], ['L-cchips-restyleKeeps'], ['cchips']),
    'ch-css': ([('cardscss', ".pnb-card-val.is-chips:not(.is-allchips) .is-extra { display: none; }\n", "")], ['L-cchips-capShown'], ['cchips']),
    'ch-block': ([('cardscss', "    display: inline-block; max-width: 100%; box-sizing: border-box; margin: 0 4px 3px 0;", "    display: block; max-width: 100%; box-sizing: border-box; margin: 0 4px 3px 0;")], ['L-cchips-inlineChips'], ['cchips']),
    'ch-sepcss': ([('cardscss', ".pnb-cchip-sep { font-size: 0; }\n", "")], ['L-cchips-sepHidden'], ['cchips']),
    # (cfix2) the repaint's pack; the board fit (js, css); the switches row's css; the PDF hand-off, its blank page, the call
    'y-restyle': ([('cards', "        packCards(el);   // (cfix2) the card's cssText above took its span with it: packed again (the user's first test: one squashed row)\n"
                          "        scheduleClip();   // (cdens) a density switch resizes the cards' type and the bar above the board: which are cut, and the lanes' height, read again\n", "")], ['L-cfixprint-restyleKeeps'], ['cfixprint']),   # (re-aimed, cdens: the re-read after a restyle packs again too)
    'y-boardfit': ([('cards', "        lastBoardH = h;\n", "        lastBoardH = h; return;\n")], ['L-gfix2-lanesFit'], ['gfix2']),
    'y-boardcss': ([('cardscss', "    max-height: var(--pnb-board-h, max(360px, calc(100vh - 210px)));", "    max-height: max(360px, calc(100vh - 210px));")], ['L-gfix2-lanesFit'], ['gfix2']),
    'y-checks': ([('cardscss', "#pnbCardsConfig .pnb-cards-row.pnb-ccfg-checks { display: flex;", "#pnbCardsConfig .pnb-cards-row.pnb-ccfg-checks { display: grid;")], ['L-cfixprint-switchesRow'], ['cfixprint']),
    'y-pdfhook': ([('main', "const _pnbCardsPdf = !!(opts && opts.cards &&", "const _pnbCardsPdf = !!(false &&")], ['L-cfixprint-pdfCards'], ['cfixprint']),
    'y-pdfblank': ([('cards', "        try { if (doc.internal.getNumberOfPages() > 1) doc.deletePage(doc.internal.getNumberOfPages()); } catch (e) { }\n", "")], ['L-cfixprint-pdfCards'], ['cfixprint']),
    'y-pdfnote': ([('cards', "        pn.textContent = 'While '", "        pn.textContent = 'x' || 'While '")], ['L-cfixprint-pdfNote'], ['cfixprint']),   # (re-aimed: a new note has no hidden to clear)
    'y-pdfcall': ([('main', "generatePdfContent({ cards: true });", "generatePdfContent();")], ['S-cfix2'], []),
    # (cfix) packing off / its spans / its css; the keys; the card's one column; a label's heading menu (card, details); the
    # details' card field; an editor's Save; the setup's nopack (cards clean, main.js layoutSet, the link, a pivot's read,
    # layoutClean); All; the lists' dress; the main.js Save hook (static)
    'x-pack': ([('cards', "        var want = packWanted(el), grids", "        var want = false, grids")], ['L-cfix-packFills', 'L-cfix-packOn'], ['cfix']),
    'x-span': ([('cards', "                if (plan[i][2][j][0].style.gridRowEnd !== span) plan[i][2][j][0].style.gridRowEnd = span;\n", "")], ['L-cfix-packFills', 'L-cfix-packOn'], ['cfix']),
    'x-packcss': ([('cardscss', "#pnbCardsHost.is-packed.is-packed .pnb-cards-grid { grid-auto-rows: 2px; row-gap: 0; align-items: start; }", "#pnbCardsHost.is-packed.is-packed .pnb-cards-grid { }")], ['L-cfix-packFills'], ['cfix']),
    'x-keys': ([('cards', "        else if ((k === 'ArrowDown' || k === 'ArrowUp') && hostEl().classList.contains('is-packed'))", "        else if (false)")], ['L-cfix-keysColumn'], ['cfix']),
    'x-col': ([('cardscss', "    grid-template-columns: minmax(0, 1fr);   /* (cfix) one column", "    /* (cfix) one column")], ['L-cfix-wideStays'], ['cfix']),
    'x-head': ([('cards', "        var lab = headTarget(t, pt, card, card, false);   // (cfix)\n        if (lab) return lab;\n", "")], ['L-cfix-labelMenu'], ['cfix']),
    'x-dhead': ([('cards', "            var dlab = headTarget(t, pt, dfocus, dcard, true);   // (cfix)\n            if (dlab) return dlab;\n", "")], ['L-cfix-detLabelMenu'], ['cfix']),
    'x-detfield': ([('cards', "        for (k = 0; k < r.fields.length; k++) onCard[r.fields[k].name] = 1;\n", "")], ['L-cfix-detCardField', 'L-cdet-noHidden'], ['cfix', 'cdet']),
    'x-authored': ([('cards', "    function authored() { return canEdit() ? editorSetup() : report; }", "    function authored() { return report; }")], ['L-cfix-editorSaves', 'L-cauth-notReports', 'L-cauth-makeDefault'], ['cfix', 'cauth']),
    'x-clean': ([('cards', "        if (cfg.nopack === 1 || cfg.nopack === true) o.nopack = 1;", "")], ['L-cfixB-reportNoPack', 'L-cfix-packOff'], ['cfixB', 'cfix']),
    'x-mainset': ([('main', "                if (v && v.nopack) o.nopack = 1;   // (cfix) Pack the cards off\n", "")], ['L-cfix-packOff'], ['cfix']),
    'x-mainlink': ([('main', "        if (c.nopack === 1 || c.nopack === true) o.nopack = 1;   // (cfix)\n", "")], ['L-cfix-packOff'], ['cfix']),
    'x-pvread': ([('cards', "            delete keep.nopack; if (cfgPackOff()) keep.nopack = 1;   // (cfix) Pack the cards, over a pivot too\n", "")], ['L-pfix-pivotPackOff'], ['pfix']),
    'x-lclean': ([('cards', "        if (o.nopack) L.nopack = 1;   // (cfix) so does Pack the cards off (set over a pivot)\n", "")], ['L-pfix-pivotPackOff'], ['pfix']),
    'x-all': ([('cards', "if (!bx[i].checked && !bx[i].parentNode.classList.contains('is-missing')) { bx[i].checked = true; n++; }", "if (false) { n++; }")], ['L-cfix-allNone'], ['cfix']),
    'x-select': ([('cardscss', "    appearance: none; -webkit-appearance: none; -moz-appearance: none;\n    height: 28px;", "    height: 28px;")], ['L-cfix-listsStyled'], ['cfix']),
    'x-mainhook': ([('main', "            if (overwrite) { try { if (window.Penumbra && window.Penumbra.cards && window.Penumbra.cards.savedToReport)", "            if (overwrite) { try { if (window.Penumbra && window.Penumbra.cards && window.Penumbra.cards.savedToReportX)")], ['S-cfix'], []),
    # (cprint) no sheet on beforeprint; never removed; no page breaks; the rest of the page printed too; the theme's text on
    # paper; Ctrl+P in the window prints every card; the window's icon prints every card; no name for the PDF; Previous not a
    # ghost; the ghost filled by the themes; no group line; no Download line; the pivot's breakdown on paper
    'cp-nobuild': ([('cards', "        window.addEventListener('beforeprint', printBuild);\n", "")], ['L-cprint-sheetBuilt', 'L-cprint-ctrlPOne'], ['cprint']),
    'cp-reenter': ([('cards', "        if (printEl() && document.body.classList.contains('pnb-cprint')) return printEl();\n", "")], ['L-cprint-pdfKept'], ['cprint']),
    'cp-noafter': ([('cards', "        window.addEventListener('afterprint', printDone);\n", "")], ['L-cprint-afterRemoves'], ['cprint']),
    'cp-nobreak': ([('cardscss', "    #pnbCardsPrint .pnb-cp-page { page: pnbcards; break-after: page; }\n", "    #pnbCardsPrint .pnb-cp-page { }\n")], ['L-cprint-pageBreaks', 'L-cprint-pdfPages', 'L-cprint-pdfPortrait'], ['cprint']),
    'cp-noalone': ([('cardscss', "    body.pnb-cprint > :not(#pnbCardsPrint) { display: none !important; }\n", "")], ['L-cprint-paperAlone', 'L-cprint-pdfPages'], ['cprint']),
    'cp-nopaper': ([('cardscss', "        --bg-surface: #fff; --bg-surface-alt: #f3f4f6; --text-main: #111; --text-muted: #555; --border-color: #c9cdd3;\n", "")], ['L-cprint-paperColors'], ['cprint']),
    'cp-noone': ([('cards', "only = printWant !== null ? printWant : (det.open ? det.at : -1), i;", "only = printWant !== null ? printWant : -1, i;")], ['L-cprint-ctrlPOne'], ['cprint']),
    'cp-btnall': ([('cards', "{ e.preventDefault(); printCards(det.at); return; }", "{ e.preventDefault(); printCards(); return; }")], ['L-cprint-btnPrintsOne', 'L-cprint-btnTitle'], ['cprint']),
    'cp-notitle': ([('cards', "            if (nm) { printTitle = document.title; document.title = (rep ? rep + ' - ' : '') + nm; }", "            if (nm) { }")], ['L-cprint-btnTitle'], ['cprint']),
    'cp-noghost': ([('cards', 'class="pnb-cdet-ghost pnb-cdet-prev"', 'class="pnb-cdet-prev"')], ['L-cprint-ghostClass'], ['cprint']),
    'cp-ghostfill': ([('cardscss', 'border: 1px solid transparent; border-radius: 6px; background: transparent; box-shadow: none;', 'border: 1px solid transparent; border-radius: 6px; box-shadow: none;')], ['L-cprint-ghostFlat'], ['cprint']),
    'cp-nopath': ([('cards', "            var path = printPath(i);", "            var path = '';")], ['L-gprint-gPath', 'L-gprint-boardPath'], ['gprint']),
    'cp-nonote': ([('cards', "        paintPrintNote();   // (cprint) the Download dialog's Print: the cards' page count\n", "")], ['L-cprint-noteShown'], ['cprint']),
    'cp-pvbtn': ([('cardscss', '    #pnbCardsPrint .pnb-cdet-actions, #pnbCardsPrint .journal-rownote-act', '    #pnbCardsPrint .pnb-cdet-actions-x, #pnbCardsPrint .journal-rownote-act')], ['L-pprint-pNoButton'], ['pprint']),
    # (cfmt2) the frame's timestamp read as `again` again; that and main.js's hooks; the format pass's hook alone; the menu
    # naming the stored value; the old button words
    'g-raf': ([('cards', "raf = window.requestAnimationFrame(function () { draw(); });", "raf = window.requestAnimationFrame(draw);")], ['L-cfmt-firstDrawOnce'], ['cfmt']),
    'g-nodraw': ([('cards', "raf = window.requestAnimationFrame(function () { draw(); });", "raf = window.requestAnimationFrame(draw);"),
                  ('main', "                _pnbCardsFormatted();   // (cfmt2) the cards were drawn before this pass: drawn again from the styled cells\r\n", "")], ['L-cfmtbig-bigRuled'], ['cfmtbig']),
    'g-hook': ([('main', "                _pnbCardsFormatted();   // (cfmt2) the cards were drawn before this pass: drawn again from the styled cells\r\n", "")], ['L-cfmtbig-hookRedraw'], ['cfmtbig']),
    'g-menu': ([('menu', "cell.td.hasAttribute('data-pnb-raw')) ? (cell.td.textContent.replace(/\\s+/g, ' ').trim() || cv) : cv;", "cell.td.hasAttribute('data-pnb-raw')) ? cv : cv;")], ['L-cfmt-menuShown'], ['cfmt']),
    'g-words': ([('cards', "pnb-ccfg-reset\">Reset</button>", "pnb-ccfg-reset\">Reset my cards</button>")], ['L-cfmt-buttonWords'], ['cfmt']),   # (re-anchored, cfix: Reset)
    # (cfmt) the values wearing nothing again; the column options' hooks gone; the module's hook renamed
    'f-val': ([('cards', "    function valStyle(td) { return styleOf(td, VAL_PROPS); }", "    function valStyle(td) { return ''; }")], ['L-cfmt-titleRuled', 'L-cfmt-subRuled', 'L-cfmt-bigRuled', 'L-cfmt-fieldRuled', 'L-cfmt-detRuled'], ['cfmt']),
    'f-hlhook': ([('main', "        try { applyConditionalFormatting(true); } catch (e) { console.warn('highlight:', e); }\r\n        _pnbCardsFormatted();   // (cfmt)\r\n", "        try { applyConditionalFormatting(true); } catch (e) { console.warn('highlight:', e); }\r\n")], ['L-cfmt-liveRule'], ['cfmt']),
    'f-opthook': ([('main', "        _pnbCardsFormatted();   // (cfmt) a format / click filter / deep link: the cells written again\r\n", "")], ['L-cfmt-liveFormat'], ['cfmt']),
    'f-api': ([('cards', "        formatted: formatted,   // (cfmt)", "        formattedX: formatted,   // (cfmt)")], ['L-cfmt-liveRule', 'L-cfmt-liveFormat'], ['cfmt']),
    # (round T) Configure cards over a pivot: the button enabled / hidden again, its line gone; the tile menu's / the pivot
    # table's greyed item gone
    # (round S) the board: not a view that draws cards / not drawn / no grouping asked / leaving keeps what it made / never
    # its own / the keys / Board by / the pill's guess / an ungroup elsewhere kept / lanes stacked; main.js's view and kept
    # column; the switch's option; the chip
    's-on': ([('cards', "return offered() && (v === 'cards' || boardOn()); }", "return offered() && (v === 'cards'); }")], ['L-gboard-boardShown'], ['gboard']),   # (re-anchored, bdlay: the grouping's layout)
    's-draw': ([('cards', "        } else if (board) {\n            html = boardHtml(", "        } else if (false) {\n            html = boardHtml(")], ['L-gboard-boardShown'], ['gboard']),
    's-keys': ([('cards', "        if (boardOn() && /^Arrow(Up|Down|Left|Right)$/.test(k)) {", "        if (false) {")], ['L-gboard-keysLanes'], ['gboard']),
    's-guess': ([('cards', "        if (r.pill) { var dp = distinct(r.pill.name); if (dp >= 2 && dp <= 30) return r.pill.name; }\n", "")], ['L-cboard-guessPill'], ['cboard']),
    's-css': ([('cardscss', ".pnb-cards-board { display: flex; align-items: flex-start;", ".pnb-cards-board { display: block; align-items: flex-start;")], ['L-gboard-lanesSideBySide'], ['gboard']),
    's-rows': ([('cardscss', "#pnbCardsHost.is-board .pnb-cards-lane > .pnb-cards-grid { grid-auto-rows: max-content; align-content: start; }\n", "")], ['L-gboard-cardsWhole'], ['gboard']),   # (the squashed cards the picture showed)
    's-contain': ([('cards', "document.body.classList.toggle('pnb-board-on', board);", "document.body.classList.toggle('pnb-cards-board', board);")], ['L-gboard-noPageScroll'], ['gboard']),   # (the class collision the picture showed: <body> a flex row)
    's-chip': ([('cards', "            if (c) { var t = v ? 'Cards' : 'Table'; if (c.textContent", "            if (c) { var t = v ? (boardOn() ? 'Board' : 'Cards') : 'Table'; if (c.textContent")], ['L-gboard-chipBoard'], ['gboard']),   # (re-aimed, bdlay2: the Board chip left over)
    # (bdlay2, 2026-10-31) the board's scroll kept, a folded lane wide where every lane fits, Sort groups followed, a lane's
    # own share and Show more (and the step's own button off a board), Find's match drawn past a share, the grouping
    # chip's Layout line (painted, a pick, the actions' half and half)
    'c-scroll': ([('cards', "            if (bx) nb.scrollLeft = bx;\n", "")], ['L-gboard-keepsScroll', 'L-gboard-sortFollows'], ['gboard']),
    'c-roomy': ([('cards', "        var roomy = ls.length * w + Math.max(0, ls.length - 1) * 12 + 4 <= b.clientWidth;", "        var roomy = false;")], ['L-gboardfew-foldWide'], ['gboardfew']),
    'c-roomycss': ([('cardscss', ".pnb-cards-board.is-roomy > .pnb-cards-lane.is-closed { flex-basis: var(--pnb-lane-w, 272px); }\n", "")], ['L-gboardfew-foldWide'], ['gboardfew']),
    'c-reorder': ([('cards', "                else if (on() && muts.some(", "                else if (false && muts.some(")], ['L-gboard-sortFollows'], ['gboard']),
    'c-share': ([('cards', "                for (var i = 0; i < rows.length && i < lim; i++) {", "                for (var i = 0; i < rows.length && count < drawn.limit; i++) {")], ['L-gboardbig-lanesFilled'], ['gboardbig']),
    'c-lanemore': ([('cards', "                    out += '<div class=\"pnb-cards-more pnb-cards-lanemore\">", "                    if (false) out += '<div class=\"pnb-cards-more pnb-cards-lanemore\">")], ['L-gboardbig-laneMore'], ['gboardbig']),
    'c-stepbtn': ([('cards', "        if (drawn.more > 0 && !board) {   // (bdlay2) a board's lanes carry their own", "        if (drawn.more > 0) {")], ['L-gboardbig-laneMore'], ['gboardbig']),
    'c-laneclick': ([('cards', "            if (lk !== null) laneMore[lk] = ", "            if (false) laneMore[lk] = ")], ['L-gboardbig-laneMoreAdds'], ['gboardbig']),
    'c-findlane': ([('cards', "                if (fw >= lim) { laneMore[key] = (laneMore[key] || 0) + fw + 1 - lim; lim = fw + 1; }", "                if (fw >= lim) { lim = fw + 1; }")], ['L-gboardbig-findDraws'], ['gboardbig']),   # (only the keeping: a transient draw is undone by a big report's second pass)
    'c-poplay': ([('main', "            _sbPaintGrpLayouts();   // (bdlay2)\n", "")], ['L-gboard-grpPopLayouts'], ['gboard']),
    'c-popclick': ([('main', "            if (G && typeof G.layout === 'function') G.layout(this.getAttribute('data-layout'), null);\n", "")], ['L-gboard-grpPopSwitch'], ['gboard']),
    'c-popcss': ([('maincss', "#pnbStatusBar .sb-grp-pop .sb-grp-actions { display: flex; gap: 6px; }\n", "")], ['L-gboard-grpPopActions'], ['gboard']),
    # (bdlay3) the page fit, the chip, the size line, the band menu, the Sort list, the lane count
    'd-pagefit': ([('cards', "        if (over > 0 && h > 360) { h = Math.max(360, h - over); lastBoardH = h; el.style.setProperty('--pnb-board-h', h + 'px'); }\n", "")], ['L-gboard-pageFits'], ['gboard']),
    'd-hostpad': ([('cardscss', "#pnbCardsHost.is-board { padding-bottom: 0; }", "#pnbCardsHost.is-board { }")], ['L-gboard-noRoomUnder'], ['gboard']),
    'd-chip': ([('cards', "            if (brd) g.style.display = 'none';\n", "")], ['L-gboard-chipGone'], ['gboard']),
    'd-grpsize': ([('cards', "        paintGrpSize();   // (bdlay3) the grouping chip's Card size line, on a board (after m-pager's two lines)\n", "")], ['L-gboard-grpSize'], ['gboard']),
    'd-grpchg': ([('cards', "e.target.id === 'sbGrpCardSize') setSize", "e.target.id === 'sbGrpCardSizeX') setSize")], ['L-gboard-grpSize'], ['gboard']),
    'd-band': ([('cards', "        if (t.kind === 'band') return out;", "        if (false) return out;")], ['L-gboard-bandMenuOnce'], ['gboard']),
    'd-sort': ([('cards', "on() && !boardOn() && !!(H.inPivot()", "on() && !!(H.inPivot()")], ['L-gboard-sortOff'], ['gboard']),
    'd-sortopen': ([('cards', "        if (boardOn()) return false;   // (bdlay3) a board has no Cards chip: its lanes sort from the grouping chip\n", "")], ['L-gboard-sortOff'], ['gboard']),
    'd-count': ([('cards', "</button><span class=\"pnb-cards-moretxt\">' + drawnTxt + '</span></div>';", "</button></div>';")], ['L-gboardbig-laneCount'], ['gboardbig']),
    'd-palsort': ([('pal', "if (C.board && C.board().on) { return 'On a board the grouping chip sorts the lanes'; } ", "")], ['S-bdlay3'], []),
    # (bdlay, 2026-10-31) the board is the grouping's layout: the module reads it, main.js keeps it (the normalizer, the
    # save, a link's decode, the dialog's Board radio, the group menu's switch), the switch's greyed Table (its guard, its
    # look, its arrows), a card's and the table's menus, the band menu's Board, Show as a board's dialog, a viewer the
    # report keeps from grouping, round S's kept view read as cards and its board key dropped
    'b-layout': ([('cards', "return !!(G && typeof G.get === 'function' && G.get() === 'board'); }", "return false; }")], ['L-gboard-boardShown', 'L-cboard-applyMakesBoard'], ['gboard', 'cboard']),
    'b-norm': ([('main', "    function _groupLayoutNorm(v) { return (v === 'list' || v === 'board') ? v : 'stacked'; }", "    function _groupLayoutNorm(v) { return (v === 'list') ? v : 'stacked'; }")], ['L-gboard-boardShown'], ['gboard']),
    'b-save': ([('main', "            if (currentGroupLayout === 'list' || currentGroupLayout === 'board') {", "            if (currentGroupLayout === 'list') {")], ['L-gboard-savedLayout', 'L-gboard-linkBoard'], ['gboard']),
    'b-decode': ([('main', "            if (d.g.layout === 'list' || d.g.layout === 'board') g.layout = d.g.layout;   // (bdlay) Board too", "            if (d.g.layout === 'list') g.layout = 'list';")], ['L-gboard-linkBoard', 'L-gboardvl-bootsBoard'], ['gboard', 'gboardvl']),
    'b-greyed': ([('cards', "        if (v === 'table' && boardOn()) return;   // (bdlay) a board is cards: the switch's Table is greyed, Configure Grouping's Layout leaves it\n", "")], ['L-gboard-tableGreyed'], ['gboard']),
    'b-offui': ([('cards', "var ov = opts[i].getAttribute('data-view'), off = bd && ov === 'table',", "var ov = opts[i].getAttribute('data-view'), off = false,")], ['L-gboard-tableGreyed'], ['gboard']),
    'b-arrows': ([('cards', "            else if (!boardOn()) {   // (round S) through every option the switch has; (bdlay) a board: Cards alone (Table greyed)", "            else {")], ['L-gboard-tableGreyed'], ['gboard']),
    'b-cardmenu': ([('cards', "        if (bd) out.push({ act: 'cardsStacked',", "        if (false) out.push({ act: 'cardsStacked',")], ['L-gboard-cardMenu'], ['gboard']),
    'b-tablemenu': ([('cards', "        } }]);   // (cfb8, the user: not worth a menu slot)", "        } }, { act: 'showBoard', label: 'Show as a board', run: function () { showBoard(); } }]);   // (cfb8, the user: not worth a menu slot)")], ['L-gboard-tableMenuNoBoard'], ['gboard']),   # (cfb8: the item back; re-anchored, crow)
    'b-menu': ([('menu', "            view.push({ act: 'gBoard', label: 'Switch to Board view',", "            if (false) view.push({ act: 'gBoard', label: 'Switch to Board view',")], ['L-gboard-backToBoard'], ['gboard']),
    'b-gmnorm': ([('main', "            layout = _groupLayoutNorm(layout);\n            // (bdlay) a board only where the card view can draw it\n", "            layout = (layout === 'list') ? 'list' : 'stacked';\n            // (bdlay) a board only where the card view can draw it\n")], ['L-gboard-backToBoard', 'L-gfix2-lanesFit'], ['gboard', 'gfix2']),
    'b-gmguard': ([('main', "            if (layout === 'board' && !(window.Penumbra.cards && typeof window.Penumbra.cards.canBoard === 'function' && window.Penumbra.cards.canBoard())) return false;", "            if (layout === 'board') return false;")], ['L-gboard-backToBoard'], ['gboard']),
    'b-radio': ([('main', "        $('#groupLayoutRow .grp-lb-board').toggle(v === 'board' || !!(C && typeof C.canBoard === 'function' && C.canBoard()));", "        $('#groupLayoutRow .grp-lb-board').toggle(v === 'board');")], ['L-cboard-dialogOpens'], ['cboard']),
    'b-dialog': ([('cards', "            if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }\n", "")], ['L-cboard-dialogOpens', 'L-cboard-applyMakesBoard'], ['cboard']),
    'b-offer': ([('cards', "return allowed() && !H.inPivot() && (grpMode() || !document.body.classList.contains('restrict-grouping')); }", "return allowed() && !H.inPivot(); }")], ['L-cboardrx-noBoardOffer', 'L-cboardrx-notGrouped'], ['cboardrx']),
    'b-prefget': ([('main', "? (e.view === 'table' ? 'table' : 'cards') : null;   // (2026-10-31, bdlay)", "? e.view : null;   // (2026-10-31, bdlay)")], ['L-cboardload-loadAsCards'], ['cboardload']),
    'b-stale': ([('cards', "            if (el) el.classList.remove('is-board');   // (bdlay) a board left for the table (only a draw toggled them)\n            document.body.classList.remove('pnb-board-on');\n", "")], ['L-gboard-leaveToTable'], ['gboard']),
    'b-prefdrop': ([('main', "                delete e.board;   // (bdlay) round S's kept board column: Board is the grouping's layout now\n", "")], ['L-cboardload-oldKeyDropped'], ['cboardload']),
    # (round R) four fields again (the module, main.js's own cut); Show field labels: clean() dropping it, the draw ignoring
    # it, the value's title gone, the hidden label shown, the window not writing it / not showing it, main.js not keeping
    # it, Extra large's value columns misplaced
    'r-max': ([('cards', "    var MAX_FIELDS = 16; ", "    var MAX_FIELDS = 4; ")], ['L-cfields-reportTen', 'L-cfields-tenDrawn'], ['cfields']),
    'r-mainslice': ([('main', "o.fields = v.fields.slice(0, 16);", "o.fields = v.fields.slice(0, 4);")], ['L-cfields-windowCount'], ['cfields']),
    'r-clean': ([('cards', "        if (cfg.nolabels === 1 || cfg.nolabels === true) o.nolabels = 1;   // (round R) Show field labels off\n", "")], ['L-cfields-labelsOff', 'L-cfields-labelsDefault'], ['cfields']),
    'r-draw': ([('cards', "'<dl class=\"pnb-card-fields' + (r.nolabels ? ' is-nolabels' : '') + '\">'", "'<dl class=\"pnb-card-fields' + '\">'")], ['L-cfields-labelsOff'], ['cfields']),
    'r-title': ([('cards', "r.nolabels ? r.fields[i].friendly : ''); }   // (cchips) a list: its chips", "''); }   // (cchips) a list: its chips")], ['L-cfields-labelsOff'], ['cfields']),   # (re-aimed, bdlay2: cchips moved the title into ddHtml)
    'r-css': ([('cardscss', "    position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;\n", "")], ['L-cfields-labelsOff'], ['cfields']),
    'r-read': ([('cards', "        var lb = el.querySelector('#pnbCcfgLabels'); if (lb && !lb.checked) o.nolabels = 1;   // (round R) Show field labels off\n", "")], ['L-cfields-labelsOff'], ['cfields']),
    'r-paint': ([('cards', "        var lb = el.querySelector('#pnbCcfgLabels'); if (lb) lb.checked = !cur.nolabels;   // (round R)\n", "")], ['L-cfields-labelsKept', 'L-cfieldsB-seededBox'], ['cfields', 'cfieldsB']),   # (the window is built once: the box must follow the setup)
    'r-main': ([('main', "                if (v && v.nolabels) o.nolabels = 1;   // (round R) Show field labels off\n", "")], ['L-cfields-labelsOff'], ['cfields']),
    'r-grid': ([('cardscss', "    #pnbCardsHost.is-xl .pnb-card-fields.is-2col.is-nolabels > dd { grid-column: 1; }\n", "")], ['L-cfields-splitNoLabels'], ['cfields']),
    # (round Q) a pivot key's part drawn raw: on the tiles (keyText), in the field labels (keyPath), in the subtitle (the
    # row key's parts); the menu engine's pvDecode without its @@HTML branch, a column heading's Filter to undecoded;
    # main.js's pivot Filter to with the raw key
    'q-keytext': ([('cards', "        return t.content.textContent.replace(/\\s+/g, ' ').trim();\n    }\n    function keyPath(", "        return s;\n    }\n    function keyPath(")], ['L-pvhtml-noMarkup', 'L-pvhtml-subText'], ['pvhtml']),
    'q-keypath': ([('cards', "    function keyPath(k) { return String(k || '').split('|||').map(keyText).join(' > '); }", "    function keyPath(k) { return String(k || '').split('|||').join(' > '); }")], ['L-pvhtml-fieldLabels'], ['pvhtml']),
    'q-parts': ([('cards', "        var parts = key ? key.split('|||').map(keyText) : [];", "        var parts = key ? key.split('|||') : [];")], ['L-pvhtml-subText'], ['pvhtml']),
    'q-pvdecode': ([('menu', "        if (s != null && String(s).indexOf('@@HTML') === 0) {", "        if (false) {")], ['L-pvhtml-labelMenuText'], ['pvhtml']),
    'q-pvcol': ([('menu', "label: 'Filter to ' + pvShown(pvDecode(cv)), title: P.fieldLabel(cf) + ': ' + pvDecode(cv),", "label: 'Filter to ' + pvShown(cv), title: P.fieldLabel(cf) + ': ' + cv,")], ['L-pvhtml-colHeadText'], ['pvhtml']),
    'q-filter': ([('main', "? '' : _pnbFsCellText(p[1]);", "? '' : String(p[1]);")], ['L-pvhtml-filterWorks'], ['pvhtml']),
    # (round P) the two columns: never split / the half doubled / not put back before the read (a wrapped value stays split) / the draw's own split gone (a frame in one column) / the right
    # half not marked (row order) / its grid rule gone / no dense placement / on a phone too / one field split / any size
    # split / the measure a box's width. The Cols card's Layout line: never shown / not painted on a sync / the link unbound
    # / the card left open / the focus left / the words never turned / always to the cards / the link's title. What cards
    # are for: the switch's options, the table's Show as cards. Settings > Cards back
    # (clbar) the link's card setup: not captured, not from Open as cards, not applied, fields not cut, not listed, not
    # described; the bar: linear again, ties at their first place, no floor, the values unsorted
    'cb-nocl': ([('main', "            var clNow = _pnbCardSetupNow();   // (clbar) the sender's own card setup rides with the view\n            if (clNow) v.cl = clNow;\n", "")], ['L-cvlC-carriesSetup', 'L-cvlD-bootsSetup'], ['cvlC', 'cvlD']),
    'cb-noapply': ([('main', "        if (v.cl) { _pnbViewSessEntry = _pnbViewSessEntry || {}; _pnbViewSessEntry.cards = JSON.parse(JSON.stringify(v.cl)); }   // (clbar) the link's card setup is this visit's own (cardsHost.layoutGet)\n", "")], ['L-cvlD-bootsSetup', 'L-cvlD-layoutIsLinks'], ['cvlC', 'cvlD']),
    'cb-noclean': ([('main', "        if (Array.isArray(c.fields)) { var f = c.fields.map(nm).filter(Boolean).slice(0, 16); if (f.length) o.fields = f; }", "        if (Array.isArray(c.fields)) { var f = c.fields.map(nm).filter(Boolean).slice(0, 50); if (f.length) o.fields = f; }")], ['L-cvlC-cleaned'], ['cvlC']),
    'cb-nolist': ([('main', "        if (v.cl) inc.push('card setup');\n", "")], ['L-cvlC-included'], ['cvlC']),
    'cb-nodesc': ([('main', "        if (v.cl) out.push('your card setup');\n", "")], ['L-cvlC-described'], ['cvlC']),
    'cb-linear': ([('cards', "        var pr = rankPct(Math.abs(v), max.vals); if (Math.abs(v) > 0 && pr < 2) pr = 2;   // (clbar) a value shows; a zero draws nothing\n", "        var pr = Math.abs(v) / max.max * 100;\n")], ['L-cbarrank-ranked', 'L-cbarrank-spread', 'L-cbarrank-medianHalf', 'L-cfull-barFallback'], ['cbarrank', 'cfull']),
    'cb-ties': ([('cards', "        return (a + b) / 2 / (n - 1) * 100;\n", "        return a / (n - 1) * 100;\n")], ['L-cbarrank-ranked'], ['cbarrank']),
    'cb-floor': ([('cards', " if (Math.abs(v) > 0 && pr < 2) pr = 2;   // (clbar) a value shows; a zero draws nothing\n", "\n")], ['L-cbarrank-ranked'], ['cbarrank']),
    'cb-sort': ([('cards', "        vals.sort(function (a, b) { return a - b; });\n", "")], ['L-cbarrank-ranked'], ['cbarrank']),
    # (linkpos) the card at the top not read from the cards, the open card not captured, a pivot's row not captured, the
    # module's apply gone, the pivot's restore gone, the open card not described, the Show all focus rule gone
    'lp-nocards': ([('main', "        if (!wr || !host || host.hidden || !(wr.scrollTop > 0)) return out;", "        if (true) return out;")], ['L-cvlE-carriesTop'], ['cvlE']),
    'lp-nocd': ([('main', "if (ckNow && (v.m === 'pivot') === !!ckNow.p) {", "if (false) {")], ['L-cvlE-carriesDetails'], ['cvlE']),   # (cardlink) the open card by its record now
    'lp-nopt': ([('main', "if (pp.pt) v.pt = pp.pt; if (pp.pl) v.pl = pp.pl; }", "if (pp.pl) v.pl = pp.pl; }")], ['L-pvlA-carriesRow'], ['pvlA']),
    'lp-noapply': ([('cards', "        var w = linkWanted; linkWanted = null;\n", "        var w = null; linkWanted = null;\n")], ['L-cvlF-topCard', 'L-cvlF-detailsOpen'], ['cvlE', 'cvlF']),
    'lp-nopivotto': ([('main', "                if (vlk.m === 'pivot') _pnbViewLinkPivotTo(vlk);   // (linkpos) the pivot's scroll\n", "")], ['L-pvlB-rowAtTop'], ['pvlA', 'pvlB']),
    'lp-nodesc': ([('main', "        if (v.ck) out.push(v.ck.p ? 'the open tile' : 'the open card (found again by ' + (v.ck.k ? v.ck.k.join(', ') : 'its values') + ')');   // (cardlink)\n", "")], ['L-cvlE-described'], ['cvlE']),   # (cardlink)
    'lp-focus': ([('cards', "        if (e.target.closest && e.target.closest('.pnb-card-more')) return;   // (linkpos, the user) Show all: its click toggles; opened on focus, the card grew and the click fell on it (the details opened)\n", "")], ['L-cnote-focusKeepsClipped'], ['cnote']),
    # (pvcfg) the tiles' setup not kept, no pill, no bar, every value listed, the row total alone, the window barred over a
    # pivot, the link's cl without it, the pick not stored, Make default without it
    'pc-noclean': ([('cards', "        var pv = cleanPivot(cfg.pivot); if (pv) o.pivot = pv;   // (pvcfg) the pivot tiles' setup\n", "")], ['L-pvcfg-bigPicked', 'L-pvcfg-pillParent', 'L-pvcfg-barDrawn'], ['pvcfg']),
    'pc-nopill': ([('cards', "        if (!total && ps.pill === 'parent' && sub) {", "        if (false) {")], ['L-pvcfg-pillParent'], ['pvcfg']),
    'pc-nobar': ([('cards', "        if (!total && !compact && ps.bar) {   // (pvcfg) a bar from a measure's row total, its place among the tiles", "        if (false) {   // (pvcfg) a bar from a measure's row total, its place among the tiles")], ['L-pvcfg-barDrawn'], ['pvcfg']),
    'pc-nofields': ([('cards', "                if (pvFieldsOn && pvFieldsOn.indexOf(ai) < 0) continue;   // (pvcfg) the measures picked\n", "")], ['L-pvcfg-fieldsPicked'], ['pvcfg']),
    'pc-nobig': ([('cards', "        if (bmi >= 0) { var bci = pvTotalCell(tr, bmi); if (bci >= 0) { big = bci; bigLabel = pvTotalWord(measures, bmi); } }   // (cnest sweep) an unlabelled measure named (Total Value 2), not 'Total '\n", "")], ['L-pvcfg-bigPicked'], ['pvcfg']),
    'pc-window': ([('cards', "    function canConfig() { return !!hostApi() && allowed(); }   // (pvcfg) over a pivot too: the tiles' setup", "    function canConfig() { return !!hostApi() && allowed() && !H.inPivot(); }")], ['L-pvcfg-canConfig', 'L-pvcfg-windowPivot', 'L-pmenu-tileConfigOn'], ['pvcfg', 'pmenu']),
    'pc-nolink': ([('main', "            if (Object.keys(q).length) o.pivot = q;\n", "")], ['L-pvcfg-linkCarries', 'L-pvcfgB-linkApplied'], ['pvcfg', 'pvcfgB']),
    'pc-nostore': ([('main', "                if (v && v.pivot && typeof v.pivot === 'object') o.pivot = JSON.parse(JSON.stringify(v.pivot));   // (pvcfg) the tiles' setup\n", "")], ['L-pvcfg-pickOwn'], ['pvcfg']),
    'pc-nodefault': ([('cards', "        var o = clean(effective()) || {};\n", "        var o = clean(report || {}) || {};\n")], ['L-pvcfg-madeDefault'], ['pvcfg']),   # (re-anchored, cfix: an editor's Save writes the tiles shown)
    # (pvlab) the old wording back: an unlabelled measure's pill and bar say "Total " / "Total : $x"
    'pl-word': ([('cards', "    function pvTotalWord(measures, i) { return 'Total ' + (measures[i] || pvMeasureName('m' + i, i)); }", "    function pvTotalWord(measures, i) { return 'Total ' + (measures[i] || ''); }")], ['L-plab-pillWord', 'L-plab-meterWord'], ['plab']),
    'm-split': ([('cards', "        splitFields(el);   // (cxl2) first: a split card is shorter\n", ""), ('cards', "        splitFields(el);   // (cxl2) at once: an Extra large page is never painted in one column first\n", "")], ['L-cxl2-splitShort', 'L-cxl2-columnMajor'], ['cxl2']),
    'm-splitdraw': ([('cards', "        splitFields(el);   // (cxl2) at once: an Extra large page is never painted in one column first\n", "")], ['L-cxl2-drawnSplit'], ['cxl2']),
    'm-splithalf': ([('cards', "                ok = w > 0 && (nl ? 2 * val + gap : 2 * (lab + val) + 3 * gap) + SPLIT_SLACK <= w;", "                ok = w > 0 && (nl ? val + gap : (lab + val) + 3 * gap) + SPLIT_SLACK <= w;")], ['L-cxl2-longStays'], ['cxl2']),   # (re-anchored, round R)
    'm-splitreset': ([('cards', "        for (i = 0; i < was.length; i++) was[i].classList.remove('is-2col');\n", "")], ['L-cxl2-regrowUnsplits'], ['cxl2']),
    'm-splitcf2': ([('cards', "fit[i].dts[j].classList.toggle('is-cf2', j >= half); fit[i].dds[j].classList.toggle('is-cf2', j >= half);", "fit[i].dts[j].classList.toggle('is-cf2', j % 2 === 1); fit[i].dds[j].classList.toggle('is-cf2', j % 2 === 1);")], ['L-cxl2-columnMajor'], ['cxl2']),
    'm-splitcss': ([('cardscss', "    #pnbCardsHost.is-xl .pnb-card-fields.is-2col { grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); grid-auto-flow: row dense; }\n", "")], ['L-cxl2-columnMajor'], ['cxl2']),   # (pairs stay on their rows: implicit tracks)
    'm-splitdense': ([('cardscss', " grid-auto-flow: row dense; }", " }")], ['L-cxl2-columnMajor'], ['cxl2']),
    'm-splitphone': ([('cards', " && !(window.matchMedia && window.matchMedia(SPLIT_PHONE).matches);", ";")], ['L-cxl2ph-phoneNone'], ['cxl2ph']),
    'm-splitone': ([('cards', "            if (dts.length >= 2 && dts.length === dds.length) {", "            if (dts.length >= 1 && dts.length === dds.length) {")], ['L-cxl2-oneFieldNone'], ['cxl2']),
    'm-splitxl': ([('cards', "        var on2 = el.classList.contains('is-xl') && !(", "        var on2 = !(")], ['L-cxl2-largeNone'], ['cxl2']),
    'm-splitink': ([('cards', "        return hi > lo ? hi - lo : 0;\n", "        return box.getBoundingClientRect().width;\n")], ['L-cxl2-splitShort'], ['cxl2']),
    'm-cvshow': ([('cards', "        if (row.style.display !== (ok ? '' : 'none')) row.style.display = ok ? '' : 'none';", "        row.style.display = 'none';")], ['L-ccolsview-lineShown'], ['ccolsview']),
    'm-cvsync': ([('cards', "        paintColsView();   // (colsview) the Cols card's Layout line\n", "")], ['L-ccolsview-lineShown'], ['ccolsview']),
    'm-cvbind': ([('cards', "        if (cvs) cvs.addEventListener('click', colsViewSwitch);\n", "")], ['L-ccolsview-linkSwitches'], ['ccolsview']),
    'm-cvclose': ([('cards', "        if (seg && op && seg.classList.contains('sb-cl-open')) op.click();   // the card closes first (main.js's own toggle)\n", "")], ['L-ccolsview-linkSwitches'], ['ccolsview']),
    'm-cvfocus': ([('cards', "        if (op) { try { op.focus({ preventScroll: true }); } catch (err) { op.focus(); } }\n", "")], ['L-ccolsview-focusBack'], ['ccolsview']),
    'm-cvwords': ([('cards', "            var t = c ? 'Switch to table layout' : 'Switch to cards layout',", "            var t = 'Switch to cards layout',")], ['L-ccolsview-cardsWords'], ['ccolsview']),
    'm-cvback': ([('cards', "        if (wasCards) set('table'); else showAs(null, null);", "        showAs(null, null);")], ['L-ccolsview-backToTable'], ['ccolsview']),
    'm-cvtitle': ([('cards', "            if (btn.title !== tt) btn.title = tt;\n", "")], ['L-ccolsview-purposeTitles', 'L-ccolsview-cardsWords'], ['ccolsview']),
    'm-purpose': ([('cards', "            if (opts[i].title !== tip) opts[i].title = tip;\n", "")], ['L-ccolsview-purposeTitles'], ['ccolsview']),
    'm-purposemenu': ([('cards', "title: 'The same rows drawn as cards. ' + CARDS_FOR, items: function () {", "title: 'The same rows drawn as cards (the Table / Cards switch)', items: function () {")], ['L-ccolsview-purposeTitles'], ['ccolsview']),
    'm-secback': ([('index', '        <div class="sp-section sp-columns-section">\n', '        <div class="sp-section sp-cards-section" id="spCardsSection"><button type="button" id="spCardConfigBtn">Configure cards...</button></div>\n        <div class="sp-section sp-columns-section">\n')], ['L-cauth-sectionGone', 'L-clayout-sectionGone', 'S-roundP'], ['cauth', 'clayout']),
    # (round L, csort) no Sort list; a pick that sorts nothing; the arrow dead; the list not reading the table's sort back;
    # the flat heading in a grouped view (one table sorted, the bands not); a list over pivot tiles
    'm-sortlist': ([('cards', "        var pv = on() && H.inPivot(), show = pv ? !!PM() : (on() && !!HM());", "        var pv = on() && H.inPivot(), show = pv ? !!PM() : false;")], ['L-csort-listShown'], ['csort']),   # (re-anchored in round U)
    'm-sortpick': ([('cards', "            if (th) A.sort(th, (now && now.name === name) ? now.dir : 'asc');\n", "")], ['L-csort-pickSorts'], ['csort']),
    'm-sortflip': ([('cards', "        if (A && th) A.sort(th, now.dir === 'asc' ? 'desc' : 'asc');\n", "")], ['L-csort-flip'], ['csort']),
    'm-sortback': ([('cards', "        var want = now ? now.name : '';\n", "        var want = s.value;\n")], ['L-csort-readsBack'], ['csort']),
    # (the sweep) the details window taking an Escape from the engine's menu; the grouped tables' sort unwatched
    'm-escmenu': ([('cards', "        if (e.target && e.target.closest && e.target.closest('.pnb-hm, .pnb-hp, #pnbFindBar')) return;\n", "")], ['L-cdet-menuEscKeepsOpen', 'L-cfind-findEscKeepsDetails'], ['cdet', 'cfind']),
    'm-escfind': ([('cards', "e.target.closest('.pnb-hm, .pnb-hp, #pnbFindBar')) return;", "e.target.closest('.pnb-hm, .pnb-hp')) return;")], ['L-cfind-findEscKeepsDetails'], ['cfind']),
    'm-gsortmo': ([('cards', "                    if (t.tagName === 'TBODY' && !t.closest('#pnbCardsHost')) { clearTimeout(sortTimer); sortTimer = setTimeout(function () { if (on()) draw(); }, 40); return; }\n", "")], ['L-gsort-bandsSorted', 'L-gsort-menuSortFollows'], ['gsort']),
    'm-detgone': ([('cards', "        if (det.tr && !(hostApi() && H.inPivot())) {\n            var di = detRows().indexOf(det.tr);", "        if (false) {\n            var di = detRows().indexOf(det.tr);")], ['L-cdetrow-pageCloses', 'L-cdetrow-sortFollows'], ['cdetrow']),   # (no row kept: by position, as live was)
    'm-detfollow': ([('cards', "            det.at = di;\n        }\n", "        }\n")], ['L-cdetrow-sortFollows'], ['cdetrow']),
    'm-menuimm': ([('cards', "        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();\n        openMenu(e.target, e);", "        e.preventDefault(); e.stopPropagation();\n        openMenu(e.target, e);")], ['L-ckword-copyCardToast', 'L-cmword-moveToast'], ['ckword', 'cmword']),
    # (round M) the Sort list back to the browser's size; the card's copy failure in the row's words; a pivot cell named
    # without its measure
    'm-sortsize': ([('cardscss', "#pnbStatusBar .sb-cards-pop #pnbCardsSize, #pnbStatusBar .sb-cards-pop #pnbCardsSort {", "#pnbStatusBar .sb-cards-pop #pnbCardsSize {")], ['L-csort-sortSized'], ['csort']),   # (re-anchored, round O: both styled in the status bar's card)
    # (round O) the white space: a field from anything in it / a huge or no margin / its text never read / the bar's box never
    # read / a tile's value from anything; the lit field: never / on white space too / not painted. The details past the
    # page: never / Next off at a page's end / its last card's on / the count over the page / no page line / no next step
    # of cards / the window's row not set before the turn. The Cards segment: hidden / its chip / Fields / its rows / its
    # Configure button and focus / closed when it goes; main.js's POP_SEGS / the trigger's aria / its Escape focus
    'm-white': ([('cards', "    function fieldAt(t, pt) { var v = t.closest('[data-col]'); return onText(v, pt) ? v : null; }", "    function fieldAt(t, pt) { var v = t.closest('[data-col]'); return v; }")], ['L-cwhite-whiteCard', 'L-cwhite-titleWhite', 'L-cwhite-bigWhite', 'L-cwhite-detWhiteCard'], ['cwhite']),
    'm-whitepad': ([('cards', "    var HIT_PAD = 4;", "    var HIT_PAD = 400;")], ['L-cwhite-whiteCard'], ['cwhite']),
    'm-whitemargin': ([('cards', "    var HIT_PAD = 4;", "    var HIT_PAD = 0;")], ['L-cwhite-marginField'], ['cwhite']),
    'm-whitetext': ([('cards', "                for (i = 0; i < rs.length; i++) if (inRect(rs[i], pt.x, pt.y)) return true;\n", "")], ['L-cwhite-textField', 'L-cwhite-hotOnText'], ['cwhite']),
    'm-whitebar': ([('cards', "        if (el.classList.contains('pnb-card-pill') || el.classList.contains('pnb-card-meter')) return inRect(el.getBoundingClientRect(), pt.x, pt.y);\n", "")], ['L-cwhite-barField'], ['cwhite']),
    'm-whitepv': ([('cards', "    function pvAt(t, pt) { var v = t.closest('.pnb-card-val[data-pvc]'); return onText(v, pt) ? v : null; }", "    function pvAt(t, pt) { var v = t.closest('.pnb-card-val[data-pvc]'); return v; }")], ['L-pmenu-tileWhiteLabel'], ['pmenu']),
    'm-hot': ([('cards', "        document.addEventListener('mousemove', onHostMove, { passive: true });   // (round O) the field lit where its menu would open\n", "")], ['L-cwhite-hotOnText'], ['cwhite']),
    'm-hotwhite': ([('cards', "        if (dd && !onText(dd, { x: e.clientX, y: e.clientY })) dd = null;\n", "")], ['L-cwhite-hotNotWhite'], ['cwhite']),
    'm-hotcss': ([('cardscss', ".pnb-card-fields dd.is-hot, .pnb-card-fields dt:has(+ dd.is-hot),\n", ".pnb-card-fields dd.is-hotx, .pnb-card-fields dt:has(+ dd.is-hotx),\n")], ['L-cwhite-hotLit'], ['cwhite']),
    'm-detbeyond': ([('cards', "        if (to < 0 || to >= n) return detBeyond(delta);   // (round O) past the page, or past the cards drawn\n", "        if (to < 0 || to >= n) return false;\n")], ['L-cdetpage-nextTurns', 'L-cdetpage-prevTurns', 'L-cdetpage-keysTurn', 'L-cdetmore-nextDraws'], ['cdetpage', 'cdetmore']),
    'm-detcan': ([('cards', "pd = !detCan(-1), nd = !detCan(1),", "pd = !detCan(-1), nd = det.at >= n - 1,")], ['L-cdetpage-nextEnabled', 'L-cdetmore-posMore'], ['cdetpage', 'cdetmore']),
    'm-detcanlast': ([('cards', "        return g >= 0 && !!all[g + delta] && !!(P.findHost && typeof P.findHost.showRow === 'function');", "        return g >= 0;")], ['L-cdetpage-lastOff'], ['cdetpage']),
    'm-detposall': ([('cards', "                main = (g + 1).toLocaleString() + ' of ' + all.length.toLocaleString() + word;", "                main = (det.at + 1).toLocaleString() + ' of ' + n.toLocaleString() + word;")], ['L-cdetpage-posAll', 'L-cdetpage-posPage'], ['cdetpage']),
    'm-detpage': ([('cards', "                if (rpp > 0 && all.length > rpp) {", "                if (false) {")], ['L-cdetpage-posAll'], ['cdetpage']),
    'm-detmore': ([('cards', "        if (delta > 0 && det.at === detCount() - 1 && drawn.more > 0 && !det.tbl) {   // the next step of cards", "        if (false) {   // the next step of cards")], ['L-cdetmore-nextDraws'], ['cdetmore']),
    'm-detrowfirst': ([('cards', "        det.tr = to; if (!det.tbl) sel = rowIdx(to);   // the window's row first:", "        if (!det.tbl) sel = rowIdx(to);   // (re-anchored, cnest):")], ['L-cdetpage-nextTurns'], ['cdetpage']),
    'm-seg': ([('cards', "            g.style.display = off ? '' : 'none';", "            g.style.display = 'none';")], ['L-cseg-segShown'], ['cseg']),
    'm-segchip': ([('cards', "            if (c) { var t = v ? 'Cards' : 'Table';", "            if (c) { var t = 'Table';")], ['L-cseg-chipCards'], ['cseg']),   # (re-anchored, round S: the chip says Board too; bdlay; bdlay2: Cards again)
    'm-fields': ([('cards', "        var f = on() && !H.inPivot();\n", "        var f = false;\n")], ['L-cseg-fieldsWord'], ['cseg']),
    'm-segrow': ([('cards', "        var sr = document.getElementById('sbCardsSizeRow'); if (sr) sr.hidden = s.hidden;   // (round O) its row in the status bar's card\n", "")], ['L-cseg-cardsRowsShown', 'L-csize-sizeControl'], ['cseg', 'csize']),
    'm-segsortrow': ([('cards', "        var srw = document.getElementById('sbCardsSortRow'); if (srw) srw.hidden = !show;   // (round O)\n", "")], ['L-cseg-cardsRowsShown'], ['cseg']),
    'm-segcfg': ([('cards', "            else if (e.target.closest && e.target.closest('#sbCardsConfig')) segConfig();   // (round O) the status bar's Cards card\n", "")], ['L-cseg-configBtn'], ['cseg']),
    'm-segcfgfocus': ([('cards', "        var o = document.getElementById('sbCardsOpen'); if (o) { try { o.focus({ preventScroll: true }); } catch (e) { o.focus(); } }   // the window's focus comes back here\n", "")], ['L-cseg-configBtn'], ['cseg']),
    'm-segclose': ([('cards', "            if (!off && g.classList.contains('sb-open')) g.click();   // gone with its card open: closed (main.js's own toggle)\n", "")], ['L-coff-segClosesHidden'], ['coff']),
    'm-segpop': ([('main', "        POP_SEGS += ', #sbCardsSeg';   // (2026-10-30, round O) the card view's controls (js/penumbra_cards.js; index.php emits it with the module)\n", "")], ['L-cseg-opens', 'L-cseg-escFocus'], ['cseg']),
    'm-segaria': ([('main', "                if (this.id === 'sbCardsSeg') { this.removeAttribute('aria-expanded'); $('#sbCardsOpen').attr('aria-expanded', 'true'); }   // (round O) its trigger carries it\n", "")], ['L-cseg-opens'], ['cseg']),
    'm-segariaclose': ([('main', "            $('#sbCardsOpen').attr('aria-expanded', 'false');   // (round O) the Cards segment's trigger\n", "")], ['L-cseg-opens'], ['cseg']),
    'm-segesc': ([('main', "                if (this.id === 'sbCardsSeg') trig = document.getElementById('sbCardsOpen') || this;   // (round O)\n", "")], ['L-cseg-escFocus'], ['cseg']),
    'm-failcard': ([('menu', "copyText(l.join('\\n'), msg, fromCard ? 'The card could not be copied.' : 'The row could not be copied.');", "copyText(l.join('\\n'), msg, 'The row could not be copied.');")], ['L-ckword-copyFailCard'], ['ckword']),
    'm-pvmeasure': ([('cards', "        return ck + (ms.length > 1 && ms[ai] ? ' ' + ms[ai] : '');", "        return ck;")], ['L-pvfind-namedAsField'], ['pvfind']),
    'm-barover': ([('cardscss', "body.pnb-cdet-open .pnb-find-bar { z-index: 20001; }\n", "")], ['L-cfind-barOverDetails'], ['cfind']),
    'm-sortgrp': ([('cards', "        if (hostApi() && H.inGroup()) {\n            var ths = document.querySelectorAll('#groupedResultsContainer", "        if (false) {\n            var ths = document.querySelectorAll('#groupedResultsContainer")], ['L-gsort-bandsSorted'], ['gsort']),
    # (round U) the list off on pivot tiles again (m-sortpivot, re-anchored); the tile menus' sorts gone; a value's heading
    # found from the row's start (wrong under nested rows); the totals named as their heading; the pivot's state read
    # without the rank (a chain's last level); Sort: none leaving the levels; the flip ignored; openSort not opening
    'm-sortpivot': ([('cards', "        var pv = on() && H.inPivot(), show = pv ? !!PM() : (on() && !!HM());", "        var pv = on() && H.inPivot(), show = pv ? false : (on() && !!HM());")], ['L-pfind-sortShown', 'L-pfsort-listShown'], ['pfind', 'pfsort']),
    'u-menu': ([('cards', "        if (ps.length) out = out.concat(ps, ['-']);\n", "")], ['L-pfsort-valueMenuSorts', 'L-pfsort-titleMenuSorts', 'L-pmenu-tileSortOffered'], ['pfsort', 'pmenu']),
    'u-col': ([('cards', "            th = hd.cols[hd.n - 1 - after] || null;", "            th = hd.cols[Array.prototype.indexOf.call(cells, el)] || null;")], ['L-pvfind-sortLabels'], ['pvfind']),
    'u-total': ([('cards', "e.kind = 'total'; e.label = 'Total' + (m ? ' ' + m : ''); }", "e.kind = 'total'; }")], ['L-pfsort-listShown', 'L-pvfind-sortLabels'], ['pfsort', 'pvfind']),
    'u-none': ([('cards', "        if (!key) { hd.list.filter(", "        if (!key && false) { hd.list.filter(")], ['L-pfsort-noneClears'], ['pfsort']),
    'u-flip': ([('cards', "if (pa && pn) pa.sort(pn.th, pn.dir === 'asc' ? 'desc' : 'asc');", "if (pa && pn) pa.sort(pn.th, pn.dir);")], ['L-pfsort-flip'], ['pfsort']),
    'u-open': ([('cards', "        if (!g.classList.contains('sb-open')) g.click();\n", "")], ['L-pfsort-openSort'], ['pfsort']),
    'u-api': ([('cards', "        canShow: function () { return allowed(); }, showAs: function (sz) {", "        canShow: function () { return allowed(); }, showAsX: function (sz) {")], ['L-pfsort-apiShowAs'], ['pfsort']),
    'u-totaltile': ([('cards', "        if (!A || !el || !T || !T.tHead || !el.closest || !el.closest('#pivotResultTable > tbody')) return [];", "        if (!A || !el || !T || !T.tHead || !el.closest) return [];")], ['L-pfsort-bigAndTotal'], ['pfsort']),
    # (cempty) every field drawn, blank or not
    'm-empty': ([('cards', "    function filled(td) { return !!td && (td.textContent.trim() !== ''", "    function filled(td) { return !!td || (td.textContent.trim() !== ''")], ['L-cempty-blankOff'], ['cempty']),
    # (pvfind) the mirror off on pivot tiles; a pivot cell keyed by column name (none); a buried cell named by its key;
    # the search's marks on tiles through the rows' path
    'm-pvon': ([('cards', "    function findOn() { return on() && !!hostApi(); }", "    function findOn() { return on() && !!hostApi() && !H.inPivot(); }")], ['L-pfind-labelMarked', 'L-pfind-valueMarked', 'L-pfind-filterOnTiles'], ['pfind']),
    'm-pvkey': ([('cards', "            return lab ? '@label' : '#' + td.cellIndex;\n", "            return '';\n")], ['L-pfind-labelMarked', 'L-pfind-valueMarked'], ['pfind']),
    'm-pvlabel': ([('cards', "        if (!td || !(td.closest && td.closest('#pivotResultTable'))) return key;", "        return key;")], ['L-pfind-compactNamed'], ['pfind']),
    'm-pvmarks': ([('find', "        if (view === 'pivot') { paintTileMarks(M, rows, terms, reg); return; }\n", "")], ['L-pfind-filterOnTiles'], ['pfind']),
    # (clayout) the viewer's layout never drawn; never kept; Use the report's keeping it; the section never shown; main.js
    # never reading it back
    'm-layover': ([('cards', "        var cfg = withViewer(report || {}), by = hd.byName,", "        var cfg = report || {}, by = hd.byName,")], ['L-clayout-titlePicked', 'L-clayoutB-seededDrawn'], ['clayout', 'clayoutB']),
    'm-laysave': ([('cards', "        try { H.layoutSet(cfgRead()); } catch (e) { }\n", "")], ['L-clayout-keptAsPref', 'L-cauth-keptAsPref'], ['clayout', 'cauth']),   # (re-anchored, round N: the window's pick)
    'm-layreset': ([('cards', "        try { H.layoutSet((keepPv && keepPv.pivot) ? { pivot: keepPv.pivot } : null); } catch (e) { }\n        try { if (H.sizeSet) H.sizeSet(null); } catch (e) { }\n        size = null; sizePicked = false;\n        cfgPaint(); paintSize(); cfgRedraw();",
                     "        try { if (H.sizeSet) H.sizeSet(null); } catch (e) { }\n        size = null; sizePicked = false;\n        cfgPaint(); paintSize(); cfgRedraw();")], ['L-clayout-resetBack'], ['clayout']),   # (re-anchored, cfix)
    # (round N, ccfg) Configure cards: the table's flyout ticking a size again; the card menu's / the table list's / the
    # Settings button's / the hotkey's way in gone; Escape not the window's; the cards not shown behind it; the focus not in
    # it; the pick not a WHOLE setup (the module's own flag, main.js's slots and flag); the default not made / the
    # editor's own kept / not removed / its size kept / an unsaved one lost on a re-run; a viewer offered the default
    'm-cfgtick': ([('cards', "return { act: 'showCards-' + s, label: sizeLabel(s), run: function () { showAs(s, null); } };", "return { act: 'showCards-' + s, label: sizeLabel(s), checked: curSize() === s, run: function () { showAs(s, null); } };")], ['L-ctmenu-noneTicked'], ['ctmenu']),
    'm-cfgmenu': ([('cards', "        out.push({ act: 'cardConfig', label: 'Configure cards...', title: 'The title,", "        if (false) out.push({ act: 'cardConfig', label: 'Configure cards...', title: 'The title,")], ['L-cauth-menuOpens'], ['cauth']),   # (re-anchored, pvcfg)
    'm-cfgtable': ([('cards', "            out.push('-', { act: 'showCardsConfig', label: 'Configure cards...', title: 'The title,", "            if (false) out.push('-', { act: 'showCardsConfig', label: 'Configure cards...', title: 'The title,")], ['L-cauth-tableMenuOpens', 'L-ctmenu-noneTicked'], ['cauth', 'ctmenu']),   # (re-anchored, pvcfg)
    'm-cfgkey': ([('cards', "String(e.key || '').toUpperCase() !== 'L') return;", "String(e.key || '').toUpperCase() !== 'Q') return;")], ['L-cauth-hotkeyToggles'], ['cauth']),
    'm-cfgesc': ([('cards', "        if (cfgOpen && esc && !e.defaultPrevented && escMine(e.target, '#pnbCardsConfig')) { e.preventDefault(); e.stopPropagation(); closeConfig(true); return; }\n", "")], ['L-cauth-escCloses'], ['cauth']),
    'm-cfgbehind': ([('cards', "        if (!on()) showAs(null, null);   // the cards behind the window: each pick shows at once\n", "")], ['L-cauth-cardsBehind'], ['cauth']),
    'm-cfgfocus': ([('cards', "        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }\n        return true;", "        return true;")], ['L-cauth-focusFirst', 'L-clayout-paletteOpens'], ['cauth', 'clayout']),
    'm-cfgown': ([('cards', "        var el = cfgEl(), o = { own: 1 }, i;", "        var el = cfgEl(), o = {}, i;")], ['L-cauth-keptAsPref', 'L-clayout-keptAsPref'], ['cauth', 'clayout']),
    'm-cfgmainown': ([('main', "                if (v && v.own) o.own = 1;   // (ccfg) the whole setup, even all Automatic\n", "")], ['L-cauth-keptAsPref'], ['cauth']),
    'm-cfgmainslots': ([('main', "                ['title', 'big', 'pill', 'bar'].forEach(function (k) { if (v && typeof v[k] === 'string' && v[k]) o[k] = v[k]; });\n", "                if (v && typeof v.title === 'string' && v.title) o.title = v.title;\n")], ['L-cauth-keptAsPref', 'L-cauth-drawnPicks'], ['cauth']),
    'm-cfgdefault': ([('cards', "        if (sizeOk(z)) o.size = z; else delete o.size;\n", "        delete o.size;\n")], ['L-cauth-makeDefault', 'L-csize-formSize'], ['cauth', 'csize']),   # (re-anchored, cfix: the size shown is saved)
    'm-cfgclearmine': ([('cards', "        if (canEdit() && hostApi()) {\n            try { H.layoutSet(null); } catch (e) { }\n", "        if (canEdit() && hostApi()) {\n")], ['L-cauth-defaultClearsMine', 'L-cauthB-reedit', 'L-cfix-savedDropsMine'], ['cauth', 'cauthB', 'cfix']),   # (re-anchored, cfix: savedToReport)
    'm-cfgremove': ([('cards', "        report = null;\n        defaultPending = true;", "        defaultPending = true;")], ['L-cauth-removeDefault'], ['cauth']),
    'm-cfgsize': ([('cards', "        size = null; sizePicked = false;   // the default's size went with it: standard\n", "")], ['L-cauth-removeDefault'], ['cauth']),   # (re-anchored, cfix)
    'm-cfgpending': ([('cards', "        if (!(formWins && defaultPending)) { report = clean(cfg); defaultPending = false; }", "        { report = clean(cfg); defaultPending = false; }")], ['L-cauthB-pendingKept'], ['cauthB']),
    'm-cfgeditor': ([('cards', "    function canEdit() { try { return !!penumbra_vars.canEditReport; } catch (e) { return false; } }", "    function canEdit() { return true; }")], ['L-cviewer-viewerWindow'], ['cviewer']),
    # (round N) the switch's rule: shown everywhere; never for a report's setup; never for a viewer's pick there
    'm-swall': ([('cards', "    function switchWanted() { return allowed() && (!!report || asked() || on() || !!(H.prefGet && H.prefGet())); }", "    function switchWanted() { return allowed(); }")], ['L-coff-switchHidden', 'L-coff-offeredHidden', 'L-cauth-switchHidden'], ['coff', 'cauth']),
    'm-swreport': ([('cards', "(!!report || asked() || on() ||", "(asked() || on() ||")], ['L-cauthB-switchShown'], ['cauthB']),
    'm-swpref': ([('cards', "on() || !!(H.prefGet && H.prefGet())); }", "on()); }")], ['L-coff-switchStays'], ['coff']),
    'm-phoneall': ([('cards', "        return (H.narrow && H.narrow() && !!report) ? 'cards' : 'table';", "        return (H.narrow && H.narrow()) ? 'cards' : 'table';")], ['L-cnarrowN-noDefaultTable'], ['cnarrowN']),
    'm-mainlay': ([('main', "                return (e && e.cards && typeof e.cards === 'object') ? e.cards : null;", "                return null;")], ['L-clayoutB-seededDrawn', 'L-clayoutB-seededShown'], ['clayoutB']),
    # (round K) the card's row words left as the table's; the copy toast the row's; sort kept in the details window
    'm-cardrow': ([('menu', "        return String(s).replace(/\\bThis entire row\\b/g, 'This entire card')", "        return String(s); String(s).replace(/\\bThis entire row\\b/g, 'This entire card')")], ['L-ckword-copyCardLabel', 'L-ckword-statsOverCards'], ['ckword']),
    'm-cardtoast': ([('menu', "                var msg = fromCard ? 'Copied the card ('", "                var msg = false ? 'Copied the card ('")], ['L-ckword-copyCardToast'], ['ckword']),
    'm-detsort': ([('cards', "        if (t.inDetails) out = out.filter(function (it) { return !(it && it.act && SORT_ACTS[it.act]); });\n", "")], ['L-ckword-detNoSort'], ['ckword']),
    # (cardfind) no mirror at all; Find's matches / the search's marks painted on the table, not the cards; the current
    # match revealed in the table; a card not drawn yet never revealed; a group's name not marked; the line's click, the
    # repaint on closing the details, the details' parts, the line's place, the outline's CSS gone
    'm-nomirror': ([('find', "    function cardsMirror() {\n        if (dlg) { return null; }", "    function cardsMirror() {\n        if (true) { return null; }")],
                   ['L-cfind-filterOnCards', 'L-cfind-findOnCards', 'L-cfind-findBuriedNamed', 'L-gfind-cellMarked', 'L-gfind-filterMarked'], ['cfind', 'gfind']),   # (re-aimed, cband: a band's name is main.js's own head, marked without the mirror)
    'm-paintcards': ([('find', "        if (M) { paintCards(M); return; }   // (cardfind)\n", "")], ['L-cfind-findOnCards', 'L-cfind-findCurOutlined', 'L-cfind-findBuriedNamed'], ['cfind']),
    'm-cardmarks': ([('find', "        if (M) { paintCardMarks(M, terms, reg, view); return; }   // (cardfind)\n", "")], ['L-cfind-filterOnCards', 'L-cfind-filterBuriedNamed'], ['cfind']),
    'm-reveal': ([('find', "        if (Mf && td) { Mf.reveal(hit.tr); } else if", "        if (false) { Mf.reveal(hit.tr); } else if")], ['L-cfind-findScrolled'], ['cfind']),
    'm-wanted': ([('cards', "        if (!card) { findWanted = tr; return false; }", "        if (!card) { return false; }")], ['L-cfind-findPageTurn', 'L-gfind-foldedRevealed'], ['cfind', 'gfind']),
    'm-band': ([('find', "                if (bl && reg && (rm > 0 || k === cur)) {", "                if (false) {")], ['L-gfind-bandMarked'], ['gfind']),
    'm-foundclick': ([('cards', "        if (fd) { e.preventDefault(); var fc = fd.closest('.pnb-card'); focusAt = cardIndex(fc); roving(); selectOnly(fc); openDetails(fc); return; }\n", "")], ['L-cfind-foundOpensDetails'], ['cfind']),
    'm-detclose': ([('cards', "        if (P.find && typeof P.find.paged === 'function') { try { P.find.paged(); } catch (e) { } }   // (cardfind) its matches named on the card again\n", "")], ['L-cfind-lineBackAfterClose'], ['cfind']),
    'm-detparts': ([('cards', "        if (det.open && dl && cards()[det.at] === card) add(dl.querySelector('.pnb-cdet-body'));\n", "")], ['L-cfind-foundOpensDetails', 'L-cfind-findInDetails'], ['cfind']),
    'm-lineplace': ([('cards', "                card.insertBefore(b, at ? at.nextSibling : card.firstChild);", "                card.insertBefore(b, null);")], ['L-cfind-filterBuriedNamed'], ['cfind']),
    'm-findcss': ([('cardscss', "#pnbCardsHost .pnb-card.is-find-cur { outline: 2px solid var(--pnb-find-cur-bg, #8f6c00); outline-offset: 1px; }\n", "")], ['L-cfind-findCurOutlined'], ['cfind']),
    # (barpick) nothing greyed out; the picked column greyed out too
    'm-barpick': ([('cards', "            var off = slot === 'bar' && c.name !== current && !canBar(c, props);   // (barpick) listed, greyed out", "            var off = false;")], ['L-cbarpick-textOff'], ['cbarpick']),
    'm-barkept': ([('cards', "            var off = slot === 'bar' && c.name !== current && !canBar(c, props);   // (barpick) listed, greyed out", "            var off = slot === 'bar' && !canBar(c, props);")], ['L-cbarpick-pickedKept'], ['cbarpick']),
    # (round J) the card containers out of main.js's filter-link handler; the window left open after one; the Light Sepia
    # link colour / the links' underline / the Light Sepia hover colour gone; Edit on your newest note only
    'm-flinkmain': ([('main', ", #pnbCardsHost a[data-search], #pnbCardDetails a[data-search]', function (e) {", "', function (e) {")], ['L-cflink-cardLink', 'L-cflink-detailsLink'], ['cflink']),
    'm-flinkclose': ([('cards', "        if (e.target.closest('[data-col] a[data-search]')) { closeDetails(false); return; }\n", "")], ['L-cflink-detailsLink'], ['cflink']),
    'm-linktheme': ([('cardscss', ".theme-light-sepia #pnbCardsHost [data-col] a, .theme-light-sepia #pnbCardDetails [data-col] a { color: var(--brand-text, #8c6e54); }\n", "")], ['L-cflink-linkThemed'], ['cflink']),
    'm-linkdeco': ([('cardscss', "#pnbCardsHost [data-col] a, #pnbCardDetails [data-col] a { text-decoration: none; }\n", "")], ['L-cflink-linkThemed'], ['cflink']),
    'm-hovertheme': ([('cardscss', "body.theme-light-sepia { --pnb-card-hover: #dcd5c9; }\n", "")], ['L-cflink-hoverThemed'], ['cflink']),
    'm-editolder': ([('main', "            var mine = function (x) { return !!me && String(x.CREATED_BY || '').toLowerCase() === me; };", "            var mine = function (x) { return x === notes[notes.length - 1] && !!me && String(x.CREATED_BY || '').toLowerCase() === me; };")], ['L-cnote-editOlder'], ['cnote']),
    # (round I) the note line / its shape after a post / the double-click; the icons' frame; the cap / Show all / the focus
    # opening a cut card / Consistent Row Height read; the table's flyout / its row item / offered; the pager; "this card";
    # the menu-target mark
    'm-noteline': ([('main', "            if (inline) return inlineItemHtml(n, isReply, author, body, canEdit, canDel);   // (cardnotes 2) a card's\n", "")], ['L-cnote-oneLine'], ['cnote']),
    'm-noteshape': ([('main', "$panel.find('.journal-rownote-list').html(renderRowNoteList(rowKey, kind, $panel.hasClass('journal-rownote-inline')));\n                        $panel.find('.journal-rownote-railmeta').html(rowNoteRailMetaHtml(rowKey, kind));\n                        if (window.Penumbra.hydrateMentionPills) window.Penumbra.hydrateMentionPills($panel, jReportId());\n                        scheduleApply();\n                        if (isPivot)", "$panel.find('.journal-rownote-list').html(renderRowNoteList(rowKey, kind));\n                        $panel.find('.journal-rownote-railmeta').html(rowNoteRailMetaHtml(rowKey, kind));\n                        if (window.Penumbra.hydrateMentionPills) window.Penumbra.hydrateMentionPills($panel, jReportId());\n                        scheduleApply();\n                        if (isPivot)")], ['L-cnote-postKeepsShape'], ['cnote']),
    'm-notedbl': ([('main', "            $(eb).trigger('click');\n", "")], ['L-cnote-dblEdit'], ['cnote']),
    'm-noteicons': ([('cardscss', "#pnbCardsHost .journal-rownote-inline .journal-rownote-act button,\n#pnbCardDetails .journal-rownote-inline .journal-rownote-act button {\n    display: inline-flex;", "#pnbCardsHost .journal-rownote-inline .journal-rownote-act button-x,\n#pnbCardDetails .journal-rownote-inline .journal-rownote-act button-x {\n    display: inline-flex;")], ['L-cnote-quietIcons'], ['cnote']),
    'm-capnone': ([('cards', "    function paintCap() { var el = hostEl(), cap = capPx(); if (el) el.style.setProperty('--pnb-card-cap', cap ? cap + 'px' : 'none'); return cap; }", "    function paintCap() { var el = hostEl(), cap = capPx(); if (el) el.style.setProperty('--pnb-card-cap', 'none'); return cap; }")], ['L-cnote-capConsistent'], ['cnote']),
    'm-showall': ([('cards', "        if (mb) { e.preventDefault(); var mc = mb.closest('.pnb-card'); setOpen(mc, !mc.classList.contains('is-open')); return; }\n", "")], ['L-cnote-showAll'], ['cnote']),
    'm-capfocus': ([('cards', "            if (e.target.closest('.journal-rownote-compose') || tr2.bottom > cr2.bottom - 40) setOpen(card, true);\n", "")], ['L-cnote-composeOpens'], ['cnote']),
    'm-capswitch': ([('cards', "        if (!document.body.classList.contains('disable-auto-expand')) return CAP_PX[sz] || CAP_PX.standard;", "        return CAP_PX[sz] || CAP_PX.standard;")], ['L-cnote-capOff'], ['cnote']),
    'm-flyout': ([('menu', "            var tx = window.Penumbra.cards.tableItems(cur);", "            var tx = null;")], ['L-ctmenu-flyout', 'L-ctmenu-pickSize'], ['ctmenu']),
    'm-flyoutrow': ([('cards', "run: function () { openRow(tr, td); } });", "run: function () { showAs(null, tr); } });")], ['L-ctmenu-rowCard'], ['ctmenu']),   # (crow: re-aimed - the row's item showed the cards first)
    # (round J, cardsmenu 2: m-flyoutoff retired - the option off offers the flyout now) the pick's ask; the flyout gated on the option
    # (round N: m-offask and m-offgate retired - offered() IS allowed() now, and a menu's ask only keeps the switch where
    # the view pick cannot be written: set() writes it, which shows the switch by itself)
    'm-pager': ([('cards', "        paintSize();\n        paintPager();\n", "        paintSize();\n")], ['L-cauto-pagerWord'], ['cauto']),
    'm-cardword': ([('cards', "String(it.label || '').replace(/\\bthis row\\b/, 'this card')", "String(it.label || '')")], ['L-cnote-cardWording'], ['cnote']),
    'm-menumark': ([('cards', "            markMenuPart(t, target);   // (cardhover)\n", "")], ['L-cdet-menuMark'], ['cdet']),
    # (cardlist) the List layout: never parked; the frame left hidden; the box's table left drawn; a restored copy kept;
    # the host left in the box under the table; a branch's rows not gathered
    'm-listbox': ([('cards', "        var box = (grouped && listOn() && !board) ? listBox() : null, listWait = grouped && !box && listOn() && !board;", "        var box = null, listWait = false;")], ['L-ggcards-hostInBox', 'L-ggcards-noBandsOfItsOwn'], ['ggcards']),   # (re-anchored, round S)
    'm-listframe': ([('cardscss', "body.pnb-cards-on.pnb-gl-on #groupedResultsContainer {\n    position: static !important;", "body.pnb-cards-on.pnb-gl-on #groupedResultsContainer-x {\n    position: static !important;")], ['L-ggcards-frameShown'], ['ggcards']),
    'm-listhide': ([('cardscss', "body.pnb-cards-on.pnb-gl-on #groupedResultsContainer .group-wrapper.pnb-gl-sel > .group-content > :not(#pnbCardsHost) {\n    position: absolute !important;", "body.pnb-cards-on.pnb-gl-on #groupedResultsContainer .group-wrapper.pnb-gl-sel > .group-content > :not(#pnbCardsHost):not(table) {\n    position: absolute !important;")], ['L-ggcards-tableHidden'], ['ggcards']),
    'm-listcopy': ([('cards', "                for (var i = 0; i < copies.length; i++) if (copies[i] !== hostRef) copies[i].parentNode.removeChild(copies[i]);\n", "")], ['L-ggcards-restoreNoCopy'], ['ggcards']),
    'm-listhome': ([('cards', "            unpark();   // (cardlist) out of a List group's box\n", "")], ['L-ggcards-keptAcrossViews'], ['ggcards']),
    'm-listrows': ([('cards', "        if (w.classList.contains('group-leaf')) return leafRows(w);\n", "        return leafRows(w);\n")], ['L-gglnest-branchPick'], ['gglnest']),
    # (cardnotes) the notes button again; a hidden Notes column drawn; no composer carried; Escape not the notes'; a text
    # click opens the window; a card menu's Add a note to the note card; the window's button; Quick actions' card never
    # found; main.js: the card view not redrawn with the column, the panels not refreshed, Post / Reply / Edit / x not
    # taught the inline panel, the composer left open after a post
    'm-notebutton': ([('cards', "        return J ? J.html(nb.getAttribute('data-row-key') || '', notesLbl) : nb.outerHTML;", "        return nb.outerHTML;")], ['L-cnote-autoDraw', 'L-cnote-addOpens'], ['cnote']),
    'm-notehidden': ([('cards', "        notesOn = !!th && th.style.display !== 'none';", "        notesOn = !!th;")], ['L-cnote-hiddenNone'], ['cnote']),
    'm-notelift': ([('cards', "        var out = [], ps = root ? root.querySelectorAll('.journal-rownote-inline.is-composing') : [];", "        var out = [], ps = [];")], ['L-cnote-carried'], ['cnote']),
    'm-noteesc': ([('cards', "            if (esc && !e.defaultPrevented && P.journalInlineNotes && P.journalInlineNotes.escape(e.target)) { e.preventDefault(); e.stopPropagation(); return; }\n", "")], ['L-cnote-escKeeps', 'L-cnotedet-escComposerFirst'], ['cnote', 'cnotedet']),
    'm-noteclick': ([('cards', "        var np = e.target.closest('.journal-rownote-inline');\n        if (np) {\n", "        var np = e.target.closest('.journal-rownote-inline');\n        if (np) return;\n        if (np) {\n")], ['L-cnote-textClickOpens', 'L-cnote-labelAdds'], ['cnote']),   # (cfb8: re-anchored; the notes' click inert again)
    'm-notemenu': ([('cards', "title: it.title, run: function () { if (!addNoteIn(t.card, !!t.inDetails)) it.run(); } };", "title: it.title, run: function () { it.run(); } };")], ['L-cnote-menuAddNote', 'L-cnotedet-compactViaDetails'], ['cnote', 'cnotedet']),   # (re-anchored, round I: the label line changed)
    'm-notedet': ([('cards', "        var nb = notesOn ? tr.querySelector('.journal-notes-btn') : null;\n        if (nb) h += '<div class=\"pnb-cdet-notes\">'", "        var nb = notesOn ? tr.querySelector('.journal-notes-btn') : null;\n        if (nb) h += nb.outerHTML; if (false) h += '<div class=\"pnb-cdet-notes\">'")], ['L-cnotedet-inDetails'], ['cnotedet']),
    'm-notepal': ([('cards', "        if (!nb || nb.disabled) return null;\n        return { card: card,", "        return null;\n        return { card: card,")], ['L-cnote-paletteNote'], ['cnote']),
    'm-jredraw': ([('main', "                try { if (window.Penumbra.cards && window.Penumbra.cards.redraw) window.Penumbra.cards.redraw(); } catch (e) { }   // (cardnotes) the cards' Notes too\n", "")], ['L-cnote-autoDraw'], ['cnote']),
    'm-jrefresh': ([('main', "            refreshInlineNotes();   // (cardnotes) the notes drawn in the cards follow the notes as read now\n", "")], ['L-cnote-refreshFollows'], ['cnote']),
    'm-jpost': ([('main', "            var $card = $(this).closest('.journal-pvnote-card, .journal-rownote-inline');   // (cardnotes) or a card's own notes\n            if (!$card.length) return;\n            postRowNote(", "            var $card = $(this).closest('.journal-pvnote-card');\n            if (!$card.length) return;\n            postRowNote(")], ['L-cnote-post', 'L-cnotedet-postInDetails'], ['cnote', 'cnotedet']),
    'm-jreply': ([('main', "            if ($panel.hasClass('journal-rownote-inline') && !inlineCompose($panel[0])) return;   // (cardnotes) its composer opens first\n", "")], ['L-cnote-reply'], ['cnote']),
    'm-jedit': ([('main', "            var $card = $(this).closest('.journal-pvnote-card, .journal-rownote-inline');   // (cardnotes) or a card's own notes\n            var $panel = $card.find(", "            var $card = $(this).closest('.journal-pvnote-card');\n            var $panel = $card.find(")], ['L-cnote-edit'], ['cnote']),
    'm-jdel': ([('main', "            var $card = $(this).closest('.journal-pvnote-card, .journal-rownote-inline');\n            if (!$card.length) return;\n            var kind", "            var $card = $(this).closest('.journal-pvnote-card');\n            if (!$card.length) return;\n            var kind")], ['L-cnote-del'], ['cnote']),
    'm-notetop': ([('cardscss', "    align-content: start;   /* (cardnotes) a card stretched", "    align-content: normal;   /* (cardnotes) a card stretched")], ['L-cnote-topAligned'], ['cnote']),
    'm-jfold': ([('main', "                if ($panel.hasClass('journal-rownote-inline')) inlineClose($panel[0], 'add', true);   // (cardnotes) posted: the card's composer folds away\n", "")], ['L-cnote-post'], ['cnote']),
    # a card drawn from every row of the table (the rows the search hid, the other pages)
    'm-unfiltered': ([('cards', "            var rows = flatRows(false);\n            try { H.fillRows(rows); } catch (e) { }", "            var rows = Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr'));\n            try { H.fillRows(rows); } catch (e) { }")],
                     ['L-cauto-filtered', 'L-cauto-count'], ['cauto']),
    # a card drawn from every page's rows (a search-hidden row also carries display:none, so the page test alone is the one that matters)
    'm-unpaged': ([('cards', "            if (!all && tr.style.display === 'none') continue;\n", "")], ['L-cauto-count', 'L-cpage-pageSize'], ['cauto', 'cpage']),
    # the title read as text and written as HTML (an escaped value becomes a live tag)
    'm-unescaped': ([('cards', "((td && td.textContent.trim()) ? td.innerHTML : '<span class=\"pnb-card-blank\">(blank)</span>')", "((td && td.textContent.trim()) ? td.textContent : '<span class=\"pnb-card-blank\">(blank)</span>')")],
                    ['L-cesc-noScript', 'L-cesc-tagAsText'], ['cesc']),
    # (the switch shown on every report: m-switchoff became m-swall, round N)
    # the pill ignores the cell's highlight rule (the one helper both the draw and the restyle read)
    'm-pillnohl': ([('cards', "    function pillStyle(td) { return styleOf(td, PILL_PROPS); }", "    function pillStyle(td) { return ''; }")], ['L-chl-ruledPills', 'L-chl-pillMatchesCell'], ['chl']),
    # the bar ignores the cell's data bar
    'm-barnocell': ([('cards', "        if (m) return { w: Math.max(0, Math.min(100, parseFloat(m[2]))), color: m[1], own: true };\n", "")], ['L-cbar-barFromCell', 'L-cbar-barColor'], ['cbar']),
    # a hidden column's lazy cells never filled
    'm-nofill': ([('cards', "        if (hiddenNames.length) { try { H.fillByName(hiddenNames); } catch (e) { } }\n", "")], ['L-cfull-hiddenFilled'], ['cfull']),
    # the switch stays over a pivot
    # (pvtiles) the pivot shut out again; the big number from the first measure, not the row total; the pivot's changes not followed
    'm-pivotoff': ([('cards', "    function allowed() { return !!(hostApi() && H.loaded() && !H.inComparison()); }", "    function allowed() { return !!(hostApi() && H.loaded() && !H.inPivot() && !H.inComparison()); }")],
                   ['L-pcoff-switchShownInPivot', 'L-pcoff-tilesCount'], ['pcoff']),
    'm-pvbigfirst': ([('cards', "            if (td.classList.contains('pivot-grand-total') && !td.hasAttribute('data-row-field') &&", "            if (false &&")], ['L-pcoff-tileBig', 'L-pcoff-totalTile'], ['pcoff']),
    'm-pvtextoff': ([('cards', "        if (pvv && hostApi() && H.inPivot() && onText(pvv, clickPt(e))) {", "        if (pvv && hostApi() && H.inPivot()) {")], ['L-pcoff-drillWhiteCard'], ['pcoff']),   # (pvtext) the whole value drills again
    'm-pvnofollow': ([('cards', "                clearTimeout(pvTimer); pvTimer = setTimeout(function () { if (H.inPivot()) { sync(); if (on()) draw(); } }, 60);", "                clearTimeout(pvTimer); pvTimer = setTimeout(function () { }, 60);")], ['L-pcoff-foldFollowed'], ['pcoff']),   # (a sync() left in would still schedule the draw)
    # the viewer's pick never kept
    'm-noprefs': ([('cards', "        try { if (H.prefSet) H.prefSet(v); } catch (e) { }\n", "")], ['L-cauto-prefSaved'], ['cauto']),
    # the guess ignores money columns (cguess: a plain number column shown before the money column)
    'm-guessbig': ([('cards', "                if (!money && pr && pr.isCurrency) money = shown[i];\n", "")], ['L-cguess-moneyOverNumber'], ['cguess']),
    # a group heading without its count
    # (cband) m-grouphead retired: groupHtml (the copied bands) is gone - a band's count is main.js's own
    # the four-field limit gone
    'm-fourfields': ([('cards', "            bx[i].disabled = full;", "            bx[i].disabled = false;")], ['L-cauth-fieldLimit', 'L-cfields-windowCount'], ['cauth', 'cfields']),   # (round R: twelve)   # (re-anchored, round N: the window's chips)
    # the authored option never written to the state
    'm-nostate': ([('main', "            if (_cardsVo) viewOptions.cards = _cardsVo;\n", "")], ['L-cauth-makeDefault', 'L-cauthB-roundTrip'], ['cauth', 'cauthB']),
    # (no mutant for the post-query path's applyCardsOption: the boot state loader runs for viewers too, so on a
    # first load the two are equivalent; the path matters on a re-run of an option-less report, which this harness
    # cannot drive)
    # the view link never carries the card view / never applies it
    'm-nocv': ([('main', "            v.cv = 1;\n            var czNow = window.Penumbra.cards.size ? window.Penumbra.cards.size() : null;", "            var czNow = window.Penumbra.cards.size ? window.Penumbra.cards.size() : null;")], ['L-cvlA-carriesCv', 'L-cvlB-bootsCards'], ['cvlA', 'cvlB']),
    'm-nocvapply': ([('cards', "        if (vl) return vl.cards ? 'cards' : 'table';   // a link's view, never the viewer's own saved pick", "        if (vl && !vl.cards) return 'table';")], ['L-cvlB-bootsCards'], ['cvlA', 'cvlB']),
    # (gfold) Collapse all / Expand all ignored in cards (the class watcher gone); a band's click never forwarded
    'm-collapseall': ([('cards', "                        clearTimeout(foldTimer); foldTimer = setTimeout(function () { if (on()) draw(); }, 40); return;", "                        return;")],
                      ['L-gcoll-collapseAll', 'L-gcoll-bandClick'], ['gcoll']),
    'm-bandnoforward': ([('cards', "        hdr.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));\n        return true;", "        return false;")],
                        ['L-gboard-laneFold'], ['gboard']),   # (re-aimed, cband: a lane's fold is the only forward left - a band's head is main.js's)
    # (glist) the List layout's pick ignored: every group's cards drawn
    # (csize) the size never applied to the host; compact drawing every part; the phone default gone; cz never captured / never applied
    'm-sizeignored': ([('cards', "        el.classList.toggle('is-compact', sz === 'compact');\n        el.classList.toggle('is-large', sz === 'large');\n", "")], ['L-csize-authorDefault', 'L-csize-viewerCompact'], ['csize']),
    'm-compactfull': ([('cards', "        var compact = curSize() === 'compact';   // (csize) no subtitle, bar, fields or notes", "        var compact = false;")], ['L-csize-compactParts'], ['csize']),
    'm-nophone': ([('cards', "        return (H.narrow && H.narrow() && !!report) ? 'cards' : 'table';", "        return 'table';")], ['L-cnarrowA-narrowOpensCards'], ['cnarrowA']),
    'm-nocz': ([('main', "            if (czNow === 'compact' || czNow === 'large' || czNow === 'xl') v.cz = czNow;\n", "")], ['L-cszvlA-carriesCz', 'L-cszvlB-bootsCompact'], ['cszvlA', 'cszvlB']),   # (re-anchored, cxl)
    'm-czapply': ([('cards', "        if (vl && vl.cards) return sizeOk(vl.size) ? vl.size : 'standard';", "        if (vl && vl.cards) return 'standard';")], ['L-cszvlB-bootsCompact'], ['cszvlA', 'cszvlB']),
    # (cxl) Extra large refused by the module / never classed / not carried by a link / not applied from one
    'm-noxl': ([('cards', "    function sizeOk(v) { return v === 'compact' || v === 'large' || v === 'xl'; }", "    function sizeOk(v) { return v === 'compact' || v === 'large'; }")], ['L-cxl-authorXl'], ['cxl']),
    'm-xlclass': ([('cards', "        el.classList.toggle('is-xl', sz === 'xl');   // (cxl)\n", "")], ['L-cxl-authorXl', 'L-cxl-twoPerRow'], ['cxl']),
    'm-xlcz': ([('main', "            if (czNow === 'compact' || czNow === 'large' || czNow === 'xl') v.cz = czNow;\n", "            if (czNow === 'compact' || czNow === 'large') v.cz = czNow;\n")], ['L-cxl-linkCz'], ['cxl']),
    'm-xlczapply': ([('main', "        if (d.cz === 'compact' || d.cz === 'large' || d.cz === 'xl') v.cz = d.cz;", "        if (d.cz === 'compact' || d.cz === 'large') v.cz = d.cz;")], ['L-cxlvl-bootsXl'], ['cxlvl']),
    # (cmenu) the right-click never forwarded to the cell (the card's own items alone) / the card's items gone / a card's empty area with the
    # whole column menu / the keys gone / the focus never named / a band not forwarded / the engine's hook gone / Shift+right-click taken
    'm-menuoff': ([('cards', "            (subCell(target, t) || t.el).dispatchEvent(ev);   // (csw2) a nested table's value: its own sub-cell\n", "")], ['L-cmenu-valueMenu', 'L-cmenu-filterRuns'], ['cmenu']),
    'm-menuextras': ([('cards', "        out = out.concat(menuExtras(t, out.length > 0));\n", "")], ['L-cmenu-extras'], ['cmenu']),
    'm-menurow': ([('cards', "        if (t.kind === 'card' && !t.pivot) out = rowItems(out, t);\n", "")], ['L-cmenu-cardRowOnly'], ['cmenu']),
    'm-menukbd': ([('cards', "        if ((tog || inDet || (e.target && e.target.classList && e.target.classList.contains('pnb-card'))) && ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) {", "        if (false) {")], ['L-cmenu-keyboardOpens'], ['cmenu']),   # (cband: a band's head has its own, k-headmenu)   # (re-anchored, cdet)
    'm-menufocus': ([('cards', "        if (cur) { cur.focusEl = t.focus; if (t.kbd) cur.kbd = true; }\n", "")], ['L-cmenu-escRefocus'], ['cmenu']),
    'm-menuband': ([('cards', "            return hdr ? { kind: 'band', el: hdr, focus: gt, card: null } : null;", "            return null;")], ['L-gboard-laneMenu'], ['gboard']),   # (re-aimed, cband: a lane's head)
    'm-enginehook': ([('menu', "            var adj = window.Penumbra.cards.menuItems(items, fromCard, cur);", "            var adj = null;")], ['L-cmenu-extras', 'L-cmenu-cardRowOnly'], ['cmenu']),
    # (menusel) any selection, blank or not, hands the card's right-click to the browser again (the user's live tab held a "\n")
    'm-menusel': ([('cards', "        if (sx && !sx.isCollapsed && String(sx).trim() !== '' && sx.containsNode && sx.containsNode(t, true)) return null;", "        if (sx && !sx.isCollapsed && sx.containsNode && sx.containsNode(t, true)) return null;")], ['L-cmsize-blankSelectionIgnored'], ['cmsize']),
    # (cmsize) the menus at every size: the host's size class never minds, so the mutant that would prove it is the size itself (m-xlclass)
    # (cdet) hidden columns listed / Next over every row of the table (the filter and the page ignored) / Escape gone / a click
    # opens nothing / a right-click inside not the cell's / the drill button clicks nothing / the phone sheet rule gone
    'm-dethidden': ([('cards', "            if ((c.hidden && !onCard[c.name]) || c.hash || c.journal) continue;", "            if (c.hash || c.journal) continue;")], ['L-cdet-noHidden', 'L-cdet-shownColumns', 'L-cfix-detCardField'], ['cdet', 'cfix']),   # (re-anchored, cfix)
    'm-detnext': ([('cards', "    function detRows() { return det.tbl ? (det.rows || []) : rowsDrawn.map(function (x) { return x.tr; }); }", "    function detRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }")], ['L-cdet-filtered'], ['cdet']),
    'm-detesc': ([('cards', "            if (!(P.noteCardEscape && P.noteCardEscape())) closeDetails(true);\n", "")], ['L-cdet-escCloses'], ['cdet']),
    'm-detnoopen': ([('cards', "        openDetails(card);   // (cdet) a click opens the card's details\n", "")], ['L-cdet-clickOpens'], ['cdet']),
    'm-detmenu': ([('cards', "        var box = t.closest('#pnbCardDetails');\n        if (box) {", "        var box = null;\n        if (box) {")], ['L-cdet-menuInside'], ['cdet']),
    'm-detdrill': ([('cards', "        closeDetails(false);\n        cell.click();\n        return true;", "        closeDetails(false);\n        return true;")], ['L-pdet-breakdownButton'], ['pdet']),
    'm-detsheet': ([('cardscss', "    #pnbCardDetails .pnb-cdet-box { width: 100vw; max-width: 100vw; height: 100%; max-height: 100%; border-radius: 0; border: 0; margin: 0; }\n", "")], ['L-cdetph-sheet'], ['cdetph']),
    # (cardword) the grid-only items kept in a card's menu / the wording left as the table's / the card wording applied to the table too
    'm-wordhide': ([('menu', "    var CARD_HIDE = { width: 1, rowHeight: 1, freeze: 1, unfreeze: 1, pvFreeze: 1, pvHighlight: 1, bdWidth: 1 };", "    var CARD_HIDE = {};")], ['L-cmword-gridOnlyHidden'], ['cmword']),
    'm-wordlabel': ([('menu', "        return String(s).replace(/\\bColumns\\b/g, 'Fields')", "        return String(s); String(s).replace(/\\bColumns\\b/g, 'Fields')")], ['L-cmword-noColumnWord', 'L-cmword-subNoColumn'], ['cmword']),
    'm-wordtable': ([('menu', "        if (fromCard) { items = cardContext(items); }   // (cardword)", "        items = cardContext(items);   // (cardword)")], ['L-cmword-tableUnchanged'], ['cmword']),
    # (cardword) the toast kept the table's words on a card
    'm-wordtoast': ([('menu', "        if (fromCard) { msg = cardMsg(msg); }   // (cardword) the toast speaks of fields, up / down / top / bottom\n", "")], ['L-cmword-moveToast'], ['cmword']),
    # (curl) the URL's ask ignored / the URL's pick written into the pref / the switch still needing the option / the builder's cards option ignored
    'm-urlignored': ([('cards', "            if (c === '1' || c === 'true' || c === 'yes') o = { cards: true }; else if (c === '0' || c === 'false' || c === 'no') o = { cards: false };", "            if (false) o = { cards: true };")], ['L-curl1-cardsOn', 'L-curl2-paramWins'], ['curl1', 'curl2']),
    'm-urlpref': ([('cards', "        if (urlAsk && typeof urlAsk.cards === 'boolean') return urlAsk.cards ? 'cards' : 'table';   // (curl) this visit's ask, over everything", "        if (urlAsk && typeof urlAsk.cards === 'boolean') { try { H.prefSet(urlAsk.cards ? 'cards' : 'table'); } catch (e) { } return urlAsk.cards ? 'cards' : 'table'; }")], ['L-curl1-prefUntouched', 'L-curl2-prefStillTable'], ['curl1', 'curl2']),
    # (round N: m-urlneedsopt retired - every report offers cards, and an ask for them is a view of cards: on() shows the switch)
    'm-menushift': ([('cards', "        if (e.shiftKey && e.button === 2) return;   // the browser's own menu, as the engine leaves it\n", "")], ['L-cmenu-shiftKeepsBrowser'], ['cmenu']),
    # the 1,000-card step gone (every row drawn at once)
    'm-nocap': ([('cards', "    var CAP = 1000;                   // cards drawn per step", "    var CAP = 1000000;")], ['L-cmore-capped', 'L-cmore-moreButton'], ['cmore']),
    # the roving tab stop gone (every card a tab stop)
    'm-noroving': ([('cards', "        for (var i = 0; i < cs.length; i++) cs[i].tabIndex = (i === focusAt) ? 0 : -1;", "        for (var i = 0; i < cs.length; i++) cs[i].tabIndex = 0;")], ['L-cauto-oneTabStop'], ['cauto']),
    # the switch never hidden in the markup (shown before a report offers it)
    # (the penumbraSyncActiveLayout hook has no mutant since pvtiles: every pivot transition also mutates #pivot-output-container, which the tiles watch)
}

# (gbar, 2026-11-02) the details window's list mode (a Gantt's one-row bars)
MUTANTS.update({
    'gb-keeps': ([('cards', "        if (det.tbl && !det.list) det.rows = tblRows();", "        if (det.tbl) det.rows = tblRows();")], ['L-cgbar-nextFar', 'L-cgbar-prevBack'], ['cgbar']),
    'gb-show': ([('cards', "        if (det.list) listShow(det.tr);   // (gbar) its page first", "")], ['L-cgbar-nextFar'], ['cgbar']),
    'gb-end': ([('cards', "        if (det.list) return false;   // (gbar) a list ends where it ends", "")], ['L-cgbar-endStops'], ['cgbar']),
    'gb-word': ([('cards', "var word = det.list ? ' ' + det.list.word : (det.tbl ? ' rows' : ' cards');", "var word = det.tbl ? ' rows' : ' cards';")], ['L-cgbar-countBars'], ['cgbar']),
    'gb-back': ([('cards', "            try { back.focus({ preventScroll: true }); } catch (e) { }\n", "")], ['L-cgbar-escChart', 'L-cgbar-escCanvas'], ['cgbar']),   # (gfocus: re-anchored)
    'gb-tabindex': ([('cards', "            if (!back.hasAttribute('tabindex') && back.tabIndex < 0) back.setAttribute('tabindex', '-1');\n", "")], ['L-cgbar-escCanvas'], ['cgbar']),   # (gfocus)
})

def static_checks(t):
    out = []
    idx, pal, main, cards, css = t['index'], t['pal'], t['main'], t['cards'], t['cardscss']
    # (round N) the cards' help moved from View Options (vo-cards) to Your Settings (us-cards): the checks read both topics
    t = dict(t); vtopic = t['topic']; t['topic'] = t['topic'] + t['ustopic']
    out.append(('S-module', 'window.Penumbra.cardsHost' in main and "P.cards = {" in cards and '.pnb-card {' in css and "role=\"listitem\"" in cards and 'role="region"' in idx, 'module + host + css present'))
    out.append(('S-include', "file_exists(__DIR__ . '/js/penumbra_cards.off')" in idx and 'css/penumbra_cards.css?v=' in idx and 'js/penumbra_cards.js?v=' in idx, 'index.php loads both files behind the .off switch'))
    swi = idx.find('id="pnbCardsSwitch"'); rc = idx.find('<span id="resultCount"></span>')
    sgi = idx.find('id="sbCardsSeg"')   # (round O) the switch in the status bar's Cards segment
    out.append(('S-markup', swi > 0 and sgi > 0 and 0 < swi - sgi < 2200 and 'role="radiogroup"' in idx[swi:swi + 200] and 'id="pnbCardsHost"' in idx and idx.find('id="pnbCardsHost"') > idx.find('id="pivot-output-container"'), 'the switch in the status bar Cards segment; the host in #table-view-container'))
    vo = None   # (round N: View Options' Cards card - and S-voCard - gone; S-roundN checks it stays gone)
    i1, i2 = pal.find("{ id: 'cards', label: 'Show as cards'"), pal.find("{ id: 'cardstable', label: 'Show as a table'")
    i3 = pal.find("\n        { id: '", i2 + 10) if i2 > 0 else -1
    class _R:
        def __init__(self, s): self.s = s
        def group(self, _): return self.s
    r1 = _R(pal[i1:i2]) if 0 < i1 < i2 else None; r2 = _R(pal[i2:i3]) if 0 < i2 < i3 else None
    out.append(('S-paletteRows', bool(r1) and bool(r2) and 'card view' in r1.group(0) and "Penumbra.cards.set('cards')" in r1.group(0) and "Penumbra.cards.set('table')" in r2.group(0) and "el('pnbCardsSwitch')" in r1.group(0) and 'viewOptionCards' not in pal, 'two rows, no option id named'))
    out.append(('S-help', 'id="us-cards"' in t['topic'] and 'data-jump-to="us-cards"' in t['ustopic'] and 'data-jump-to="us-cards"' in (idx + cards) and 'data-tip="us-tip-cards"' in t['tip'] and 'data-tip="us-tip-cards"' in (idx + cards) and 'card view' in t['manifest'],
                'help topic section + jump + tip (defined + consumed) + manifest keywords'))
    out.append(('S-readme', 'Card view: the rows drawn as cards' in t['readme'] and 'penumbra_tests\\cards' in t['readme'], 'README section 5 bullet'))
    out.append(('S-hooks', all(k in main for k in ("window.Penumbra.cards.paged()", "window.Penumbra.cards.sync()", "viewOptions.cards = _cardsVo", "applyCardsOption(vo.cards)", "applyCardsOption(optionsToApply && optionsToApply.cards, true)", "function applyCardsOption(cfg, formWins)", "window.Penumbra._cardsPending = cfg || null")),
                'applyPagination tail, penumbraSyncActiveLayout, buildStateObject, both viewOptions load sites, the pending stash'))
    dro = re.search(r'var PNB_VIEW_DROP_ORDER = \[(.*?)\];', main, re.S); dtx = dro.group(1) if dro else ''
    out.append(('S-viewLink', "if (d.cv === 1 || d.cv === true) v.cv = 1;" in main and "window.Penumbra.cards.on()) {" in main and "['cv cz', 'card view']" in dtx and dtx.find("'cv") < dtx.find("'dn'") and "inc.push('card view')" in main and "out.push('shown as ' + (v.cz ? ({ xl: 'extra large', compact: 'small' }[v.cz] || v.cz) + ' ' : '') + 'cards')" in main,   # (cfb8: compact as small)
                'cv (+ cz) cleaned, captured, dropped first, listed, described (xl as extra large, compact as small)'))
    # (cxl) the Extra large row, both option lists, the help; (cmenu) the engine's hook + openItems, the module's handler, the help + README
    menu = t['menu']
    out.append(('S-xlRows', "{ id: 'cardsize-xl', label: 'Card size: Extra large'" in pal and "setSize('xl')" in pal and "cardSize('xl')" in pal, 'the Extra large palette row'))
    out.append(('S-xlMarkup', idx.count('<option value="xl">') >= 1 and '<option value="xl">Extra large</option>' in idx and "e.size === 'xl'" in main and "v === 'xl'" in main, 'xl in the size control and the setup row; the pref reads and writes it'))
    out.append(('S-xlHelp', 'Extra large' in t['topic'] and 'Extra large' in t['tip'] and 'Card size: Small / Medium / Large / Extra large' in t['topic'] and 'is-xl' in css, 'help topic + tip name Extra large; the css has it'))
    out.append(('S-menuHook', 'fromCard = e.pnbCardMenu || null;' in menu and 'window.Penumbra.cards.menuItems(items, fromCard, cur)' in menu and 'window.Penumbra.colMenu.openItems = function' in menu
                and 'function onHostMenu' in cards and 'menuItems: menuItems' in cards and "ev.pnbCardMenu = t;" in cards, 'the engine takes a card\'s forwarded right-click, asks the module for its items; openItems'))
    out.append(('S-menuHelp', 'Right-click a card' in t['topic'] and 'Right-click a card' in t['tip'] and 'cmenu' in t['readme'] and 'cxl' in t['readme'] and 'Shift' in t['topic'], 'help topic + tip + README name the menus'))
    # (cdet) the palette row, the help, the window's css + module
    out.append(('S-detRow', "{ id: 'carddetails', label: 'Open card details'" in pal and 'cards.openDetails()' in pal, 'the Open card details palette row'))
    out.append(('S-detHelp', 'Open card details' in t['topic'] and 'plus hidden card fields' in t['topic'] and 'Click a card for its details' in t['tip'] and 'cdet' in t['readme'], 'help topic + tip + README name the details window'))
    out.append(('S-wordHelp', 'speaks of fields' in t['topic'] and 'cardword' in t['readme'] and 'function cardContext(items)' in menu and 'var CARD_HIDE' in menu, 'help + README name the card wording; the engine has it'))
    # (curl; cmsize, the user: "needless config creep" - the email is as shown) no Open as cards in the email dialog, nothing
    # left of it in main.js; As you see it now carries the cards; the URL cleaner and the reserved params still know cards / cardsize
    out.append(('S-emailCards', 'emailLinkAsCards' not in idx and 'emailLinkCardSize' not in idx and 'emailCardsLinkRow' not in idx and 'emailLinkAsCards' not in main and 'emailLinkCardSize' not in main
                and '_pnbEmailLinkOpts' not in main and '_pnbEmailCardSize' not in main and "if (opts && opts.cards) {\n            v.cv = 1;" not in main.replace('\r\n', '\n')
                and "'#emailIncludeSnippet, #emailInsertData, #emailIncludeLink, #emailLinkAsView, #emailShowRecipients', updateEmailWarnings" in main
                and "urlParams.delete('cards'); urlParams.delete('cardsize');" in main and "_DL_RESERVED_PARAMS = { cards: 1, cardsize: 1," in main,
                'no Open as cards in the email dialog or main.js; the URL cleaner and the reserved params know cards / cardsize'))
    out.append(('S-urlHelp', '&amp;cards=1' in t['topic'] and 'Open as cards' not in t['topic'] and 'with <strong>As you see it now</strong> ticked while cards show' in t['topic'] and 'curl' in t['readme'] and 'var urlAsk' in cards, 'help + README name the URL parameters; the module reads them'))
    # (cmsize) the email cards' size table (the PHP twin is the csched suite's), the email help's sizes, README
    out.append(('S-cmsize', 'cmsize (2026-11-01' in t['readme'] and 'var MAIL_SIZE = {' in cards and 'MAIL_COLS' not in cards and 'ms = MAIL_SIZE[sz] || MAIL_SIZE.standard' in cards
                and 'Small four a row, Medium three, Large two, Extra large one' in t['emtopic'],
                'cmsize: the email cards by size (the module), the email help, README'))
    # (cfb8, the user's eight notes) the size words everywhere, no board item in a menu, the pencil head, the help, README
    out.append(('S-cfb8', 'cfb8 (2026-11-01' in t['readme'] and "var SIZE_LABELS = { compact: 'Small', standard: 'Medium', large: 'Large', xl: 'Extra large' };" in cards
                and idx.count('<option value="compact">Small</option><option value="standard">Medium</option>') == 2 and '<option value="compact">Compact</option><option value="standard">Standard</option>' not in idx
                and "label: 'Card size: Small'" in pal and "label: 'Card size: Medium'" in pal and "act: 'cardsBoard'" not in cards and "act: 'showBoard'" not in cards
                and 'var NOTE_PENCIL = ' in main and main.count("' + NOTE_PENCIL + '<span class=\"journal-rownote-btntxt\">") == 2 and '#pnbCardsHost .journal-rownote-pencil[hidden] { display: inline-flex; }' in css
                and '(Not Density&rsquo;s Compact / Standard.)' in t['ustopic'] and 'The pencil after <em>Notes</em>' in t['ustopic'] and 'Small to Extra large' in t['tip']
                and 'The pill is outlined as on screen' in t['emtopic'],
                'cfb8: Small / Medium, no Show as a board in a menu, the pencil head, the help, README'))
    out.append(('S-cdel', 'cdel (2026-11-01' in t['readme'] and '#pnbCardsHost .journal-rownote-inline .journal-rownote-act button.journal-rownote-del, #pnbCardsHost .pnb-sharednote-file .pnb-sharednote-filedel { display: none; }' in css
                and '.journal-rownote-text a:not(.journal-attach-chip),' in t['maincss'] and 'var(--accent-danger, #cc0000);\n    text-decoration: underline;\n    overflow-wrap: anywhere;' not in t['maincss'].replace('\r\n', '\n')
                and "(delete in the card's details)" in t['ustopic'], 'cdel: no x on a card, links themed, help, README'))
    # (crow) the row's window over the table: the module (the table's rows, the open, the back), one row item, Quick actions, help, README
    # (cnest sweep) the fixes a page here cannot reach: the tiles keep the report's setup under a viewer's own flat one, an
    # unlabelled measure's big number named, Configure cards' Reset over a pivot keeps Pack the cards off, the flat Reset
    # keeps the viewer's tiles setup; the README's paragraph
    out.append(('S-cnPvSetup', "function pvSetup() { var e = effective(); return (e && e.pivot) ? e.pivot : ((report && report.pivot) ? report.pivot : null); }" in cards, 'a viewer\'s own setup keeps the report\'s tiles'))
    out.append(('S-cnTotalWord', "bigLabel = pvTotalWord(measures, bmi);" in cards and "bigLabel = 'Total ' + (measures[bmi] || '')" not in cards, 'an unlabelled measure\'s big number named'))
    out.append(('S-cnResetPv', "(curp.own || curp.title || curp.fields || curp.nopack) ? curp : null" in cards, 'Reset over a pivot keeps Pack the cards off'))
    out.append(('S-cnResetFlat', "H.layoutSet((keepPv && keepPv.pivot) ? { pivot: keepPv.pivot } : null);" in cards and "Object.keys(v).some(function (k) { return k !== 'pivot'; })" in cards, 'the flat Reset keeps the viewer\'s tiles setup'))
    out.append(('S-cnest', 'cnest (2026-11-02' in t['readme'] and 'function clearLast(items)' in t['menu'] and "n.classList.contains('nested-json-container')" in cards, 'cnest: README, Clear all last, nested gaps'))
    out.append(('S-crow', 'crow (2026-11-02' in t['readme'] and 'function openRow(tr, cell)' in cards and 'function tblRows()' in cards and 'function tblBack()' in cards
                and cards.count("act: 'showCardRow'") == 1 and 'showAs(null, tr); } });' not in cards and 'C.canRow && C.canRow()' in pal and 'cards.openDetails()' in pal
                and 'details window over the table, which stays as it is' in t['ustopic'] and "(on the table: the active cell's row)" in t['ustopic'],
                'crow: the window over the table - module, the menu item, Quick actions, help, README'))
    out.append(('S-csz', 'csz (2026-11-01' in t['readme'] and 'sent.size = curSize();' in cards and 'if (SIZES.indexOf(x.size) >= 0) o.size = x.size;' in cards, 'csz: the saved view carries the size shown; README'))
    out.append(('S-detCss', '#pnbCardDetails .pnb-cdet-box' in css and 'max-width: 600px' in css and "el.id = 'pnbCardDetails';" in cards and 'help-lightbox pnb-cdet' in cards and "openDetails: function" in cards, 'the window: the app\'s dialog classes, the phone sheet, the API'))
    # (csize) the three size rows, the size control and the setup's size row, the help's size text
    out.append(('S-sizeRows', all(("{ id: 'cardsize-%s', label: 'Card size: %s'" % (s, w)) in pal and ("setSize('%s')" % s) in pal for s, w in (('compact', 'Small'), ('standard', 'Medium'), ('large', 'Large'))) and 'function cardSize(sz)' in pal, 'three Card size rows (cfb8: Small / Medium)'))
    out.append(('S-sizeMarkup', 'id="pnbCardsSize"' in idx and idx.find('id="pnbCardsSize"') - idx.find('id="pnbCardsSwitch"') < 1200 and 'data-slot="size"' in (idx + cards) and 'value="compact"' in idx and 'value="large"' in idx, 'the size control beside the switch; the setup\'s Card size row'))
    out.append(('S-pvHelp', 'each pivot row is a tile' in t['topic'] and 'each pivot row is a tile' in t['tip'] and 'have no card form' not in t['topic'] and 'pivotHtml' in cards and "body.pnb-cards-on #pivotResultTable" in css, 'help names the pivot tiles; the module and css have them'))
    out.append(('S-sizeHelp', 'Card size' in t['topic'] and '600px or less' in t['topic'] and 'Card size' in t['tip'] and 'Card size: Small / Medium / Large' in t['topic'], 'help topic + tip name the sizes and the phone default'))
    # (cardnotes + cardlist) main.js's inline panel and its handlers, the module's use; the help + README; the palette's card row
    out.append(('S-noteApi', 'window.Penumbra.journalInlineNotes = {' in main and main.count("closest('.journal-pvnote-card, .journal-rownote-inline')") >= 3 and 'refreshInlineNotes();' in main
                and 'function inlineCompose(panel)' in main and 'function liftNotes(root)' in cards and 'P.journalInlineNotes' in cards and '.journal-rownote-inline' in css, 'main.js draws a row\'s notes in a card; post / edit / delete read the inline panel; the module and css use it'))
    out.append(('S-noteHelp', 'The Notes column shows on the card like any long column' in t['topic'] and 'Notes (cardnotes, 2026-10-29)' in t['readme'] and 'journalInlineNotes' in t['readme'], 'help + README name the notes in the card'))
    out.append(('S-listHelp', 'Grouped with the <strong>List</strong> layout' in t['topic'] and 'The List layout (cardlist, 2026-10-29' in t['readme'] and 'function park(box)' in cards and 'is-list' not in css, 'help + README name the List layout in cards; glist\'s band picker gone'))
    out.append(('S-noteRow', "'Add a note to this card'" in pal and 'C.addNote(text)' in pal and 'C.noteCard()' in pal, 'Quick actions: add a note on the selected card'))
    # (round I) the help + README name the round; the engine asks the module for the table's items; main.js draws a card's note line
    out.append(('S-roundI', 'Show all' in t['topic'] and 'Show as cards' in t['topic'] and 'row-hover colour' in t['topic'] and '<strong>Cards:</strong>' in t['topic']
                and 'Round I (2026-10-29' in t['readme'] and 'window.Penumbra.cards.tableItems(cur)' in t['menu'] and 'function inlineItemHtml(' in main and 'tableItems: tableItems' in cards and '.pnb-card-more' in css,
                'help + README name round I; the engine\'s table hook; the note line; the cap'))
    # (round J) README names the round; main.js's filter-link handler takes the card view's copies; the css themes them
    out.append(('S-roundJ', 'Round J (2026-10-29' in t['readme'] and '#pnbCardsHost a[data-search], #pnbCardDetails a[data-search]' in main and '--pnb-card-hover' in css
                and '.registry-theme #pnbCardsHost [data-col] a' in css and 'C.canShow && C.canShow()' in pal and 'canShow: function' in cards and 'Show as cards' in t['topic'],
                'README names round J; the filter links in cards; the themed hover and links; Show as cards with the option off (menu, Quick actions, help)'))
    # (round K) help + README name the round; the mirror on both sides; the card words; the Bar list
    out.append(('S-roundK', 'Round K (2026-10-30' in t['readme'] and 'This entire card' in t['topic'] and 'Found in:' in t['topic'] and 'Also matches in:' in t['topic']
                and 'greyed out' in t['topic'] and 'findMirror: {' in cards and 'function cardsMirror()' in t['find'] and 'cardRow(cardWord(' in t['menu']
                and '.pnb-card-found' in css and 'function canBar(' in cards,
                'help + README name round K; the Find mirror (cards + find); the card words; the Bar list'))
    # (round K) 25 and 50 per page: the pager and the save dialog, the two topics that list the sizes
    def opts(rx):
        m = re.search(rx, idx, re.S)
        return re.findall(r'<option value="([^"]*)"', m.group(1)) if m else []
    want = ['10', '25', '50', '100', '200', '500', 'all', 'none']
    out.append(('S-pager', opts(r'<select id="rowsPerPageSelector"[^>]*>(.*?)</select>') == want and opts(r'<select id="serverSaveRowsPerPage"[^>]*>(.*?)</select>') == want
                and '<code>10</code>, <code>25</code>, <code>50</code>, <code>100</code>' in t['pftopic'] and '10, 25, 50, 100, 200 or 500 rows' in t['sptopic'],
                'Rows per page offers 10, 25, 50, 100, 200, 500, All, None (pager + save dialog); the help lists them'))
    # (round L) help + README name the round; the markup; main.js's layout pref and Clear All's line; the palette row
    out.append(('S-roundL', 'Round L (2026-10-30' in t['readme'] and 'id="us-cards"' in t['ustopic'] and ('us-tip-card-layout' in t['tip'] or 'Round P (2026-10-30' in t['readme']) and ('Sort: none' in t['topic'] or '<strong>None</strong> clears it' in t['topic'])
                and 'id="pnbCardsSort"' in idx and ('id="spCardsSection"' in idx or 'Round P (2026-10-30' in t['readme']) and 'layoutGet: function' in main and re.search(r"items\.push\('Card (title and fields|layout)'\)", main)
                and ("id: 'cardlayout'" in pal or "id: 'cardconfig'" in pal) and 'function paintSort(' in cards and 'function filled(' in cards and 'paintTileMarks(' in t['find'],
                'help + README name round L; the Sort list and Settings > Cards; the layout pref; the palette row; pivot tiles in Find'))
    # (round N) View Options' Cards card gone; Settings > Cards one button; the window (module + css); the help moved
    # (topic, tips, the Ctrl+Shift+L row, the manifest's card words); the palette row + the cheat sheet; README
    sec = re.search(r'<div class="sp-section sp-cards-section" id="spCardsSection" hidden>.*?</div>\s*</div>', idx, re.S)
    out.append(('S-roundN', 'Round N (2026-10-30' in t['readme'] and 'pnb-cards-vo' not in idx and 'id="pnbCardsSetup"' not in idx and ((bool(sec) and 'id="spCardConfigBtn"' in sec.group(0)) or ('Round P (2026-10-30' in t['readme'] and not sec))
                and 'vo-cards' not in vtopic and "Clear the default" in t['ustopic'] and "an editor's Save makes it everyone's" in t['tip'] and 'Make default' not in t['ustopic'] + t['tip'] and 'Configure cards' in t['tip']
                and '<kbd>Ctrl+Shift+L</kbd>' in t['pftopic'] and "row(['Ctrl+Shift+L']" in main and "id: 'cardconfig'" in pal and "keys: ['Ctrl', 'Shift', 'L']" in pal
                and 'configure cards' in t['manifest'] and 'journal cards card view' not in t['manifest']
                and 'function switchWanted(' in cards and "el.id = 'pnbCardsConfig';" in cards and '#pnbCardsConfig .pnb-ccfg-box' in css and 'openConfig: openConfig' in cards,
                "View Options > Cards gone; Settings > Cards one button; the window; the help moved; the palette row + cheat sheet; README"))
    # (round O) the controls in the status bar's Cards segment (after Cols, not .sb-opt, with the module) and out of the filter
    # bar; the white-space menu, the lit field, past the page; main.js's additions; css; help, tip, README
    segm = re.search(r'\n([ \t]*)<div class="sb-seg sb-click sb-cards-seg" id="sbCardsSeg".*?\n\1</div>', idx, re.S)
    tsc = re.search(r'<div id="tableSearchContainer".*?\n        </div>', idx, re.S)
    hot = css.find('/* (round O) lit where')
    out.append(('S-roundO', 'Round O (2026-10-30' in t['readme'] and bool(segm) and all(('id="%s"' % k) in segm.group(0) for k in ('pnbCardsSwitch', 'pnbCardsSize', 'pnbCardsSort', 'pnbCardsSortDir', 'sbCardsConfig', 'sbCardsOpen', 'sbCardsChip'))
                and 'sb-opt' not in segm.group(0)[:120] and sgi > idx.find('id="sbColsSeg"') > 0 and bool(tsc) and 'pnbCards' not in tsc.group(0)
                and '<?php' not in segm.group(0) and 'id="sbCardsSeg" style="display:none;"' in segm.group(0)
                and "POP_SEGS += ', #sbCardsSeg';" in main and "$('#sbCardsOpen').attr('aria-expanded', 'false');" in main and "trig = document.getElementById('sbCardsOpen') || this;" in main
                and 'function onText(' in cards and 'function detBeyond(' in cards and 'function paintSeg(' in cards and '#pnbStatusBar #sbCardsSeg .sb-cards-row[hidden]' in css and hot > 0 and ':hover' not in css[hot:hot + 420]
                and "status bar&rsquo;s <strong>Cards</strong> segment" in t['ustopic'] and 'white space' in t['ustopic'] and '28 of 300 cards' in t['ustopic'],
                'the controls in the status bar Cards segment (after Cols, kept on a phone, no PHP in it), out of the filter bar; the white-space menu, the lit field, past the page; main.js, css, help, tip, README'))
    # (round P) Settings > Cards gone (markup, its tip, its css, the module's hooks); the Cols card's Layout line (in the Cols
    # card after its list, hidden in the markup, no PHP in it, the link a button); the two columns (module + css, desktop
    # only); what cards are for (the module's words, the palette's sub, the help, the tip); README
    clm = re.search(r'<div class="sb-pop sb-cl-pop" id="sbColsPop".*?<div class="sb-cl-actions">', idx, re.S)
    cvm = re.search(r'<dl class="sb-cl-list sb-cl-view" id="sbColsView" style="display:none;">.*?</dl>', idx, re.S)
    mq = css.find('@media (min-width: 601px)')
    out.append(('S-roundP', 'Round P (2026-10-30' in t['readme'] and 'spCardsSection' not in idx and 'spCardConfigBtn' not in idx and 'us-tip-card-layout' not in idx + t['tip']
                and 'spCardsSection' not in css and 'spCardConfigBtn' not in cards and 'paintCfgSection' not in cards
                and bool(clm) and bool(cvm) and cvm.group(0) in clm.group(0) and clm.group(0).find('id="sbColsList"') < clm.group(0).find('id="sbColsView"')
                and '<?php' not in cvm.group(0) and '<button type="button" class="sb-cl-view-switch" id="sbColsViewSwitch">Switch to cards layout</button>' in cvm.group(0)
                and 'function splitFields(' in cards and 'function paintColsView(' in cards and "var CARDS_FOR = '" in cards
                and mq > 0 and '.pnb-card-fields.is-2col' in css[mq:mq + 900] and 'dt.is-cf2' in css[mq:mq + 900]
                and 'more detail than reads well on one line' in pal and 'When cards help' in t['ustopic'] and 'Switch to cards layout' in t['ustopic']
                and 'two columns' in t['ustopic'] and 'Cards</strong> section of this panel' not in t['ustopic'],
                "Settings > Cards gone; the Cols card's Layout line; two columns at Extra large; what cards are for (module, palette, help, tip); README"))
    # (clbar) the card setup in the view link (cleaned, captured, from Open as cards, applied as the session entry, dropped
    # first, listed, described); the rank-scaled brand bar; help, tip, README
    # (cmsize) the Open as cards path's setup line went with Open as cards
    out.append(('S-clbar', 'function _pnbViewLinkCardSetup(' in main and "['cl', 'card setup'], ['cv cz', 'card view']" in dtx and 'var clNow = _pnbCardSetupNow();' in main
                and '_pnbViewSessEntry.cards = JSON.parse(JSON.stringify(v.cl));' in main
                and "inc.push('card setup')" in main and "out.push('your card setup')" in main and 'function rankPct(' in cards and 'vals.sort(function (a, b) { return a - b; });' in cards
                and 'place</em> among the cards on the page' in t['ustopic'] and 'carries your card setup' in t['ustopic'] and 'a view link you copy carries it' in t['tip'] and 'clbar (2026-10-30' in t['readme'],
                'the card setup in the view link; the rank-scaled bar; help, tip, README'))
    # (linkpos) the cards' top card, the open details card and the pivot's scroll in the link: cleaned, captured, dropped
    # early, listed, described, restored; the module's hook; the Show all focus rule; the help
    out.append(('S-linkpos', 'function _pnbViewLinkCardsNow(' in main and 'function _pnbViewLinkPivotNow(' in main and 'function _pnbViewLinkPivotTo(' in main
                and ("['cd', 'open card'], ['cl', 'card setup']" in dtx or "['cd', 'open card'], ['ck', 'open card'], ['cl', 'card setup']" in dtx or "['cd', 'open card'], ['ds', 'scroll position'], ['ck', 'open card'], ['cl', 'card setup']" in dtx) and "['pt pl', 'scroll position'], ['gb gt gr gc tr lc', 'scroll position']" in dtx
                and "inc.push('open card')" in main and "out.push('pivot row ' + (v.pt + 1) + ' at the top')" in main and 'CD.linkWant({ top:' in main
                and 'function linkWant(' in cards and 'linkWant: linkWant' in cards and "e.target.closest('.pnb-card-more')) return;" in cards
                and 'the card at the top and a card whose details window is open' in t['vltopic'] and 'the card at the top and an open details window' in t['ustopic'] and 'linkpos (2026-10-31' in t['readme'],
                'the link carries the card at the top, the open card and the pivot scroll; the Show all focus rule; help + README'))
    # (pvlab) one helper words a measure's total on the tile; the pill's title and the bar's label go through it
    out.append(('S-pvlab', 'function pvTotalWord(' in cards and cards.count('pvTotalWord(measures, pmi)') == 1 and cards.count('pvTotalWord(measures, rmi)') == 1 and "esc('Total ' + (measures[pmi] || ''))" not in cards, 'pvTotalWord: the pill title + the bar label'))
    # (pvcfg) the tiles' setup kept, drawn and offered; the window's rows; the help, the tip, README
    out.append(('S-pvcfg', 'function cleanPivot(' in cards and 'function cfgPaintPv(' in cards and 'function pvBarScale(' in cards and 'PIVOT_NOCFG' not in cards and 'sbCardsCfgNote' not in cards.replace("getElementById('sbCardsCfgNote')", '')
                and "o.pivot = JSON.parse(JSON.stringify(v.pivot))" in main and "if (Object.keys(q).length) o.pivot = q;" in main and '[data-ccfg][hidden]' in css
                and '(over a pivot, what a tile shows)' in t['ustopic'] and "picks the tile's parts from the pivot's measures" in t['ustopic'] and 'each pivot row is a tile' in t['tip'] and 'pvcfg (2026-10-31' in t['readme'],
                'the tiles setup: module, store, link, css; help + tip + README'))
    out.append(('S-cprint', 'function printBuild(' in cards and "window.addEventListener('beforeprint', printBuild);" in cards and "window.addEventListener('afterprint', printDone);" in cards
                and 'class="pnb-cdet-ghost pnb-cdet-prev"' in cards and 'class="pnb-cdet-ghost pnb-cdet-next"' in cards and 'pnb-cdet-ghost pnb-cdet-drill' in cards and 'pnb-cdet-print' in cards
                and '@page pnbcards { size: portrait;' in css and 'body.pnb-cprint > :not(#pnbCardsPrint) { display: none !important; }' in css and '#pnbCardDetails .pnb-cdet-ghost {' in css
                and "{ id: 'cardprint', label: 'Print the cards'" in pal and "{ id: 'cardprintone', label: 'Print this card'" in pal and 'window.Penumbra.cards.print()' in pal and 'window.Penumbra.cards.printOne()' in pal
                and 'prints the cards on screen, one page per card' in t['ustopic'] and 'click the printer icon beside the close' in t['ustopic'] and 'Downloads, print, email' not in t['ustopic']
                and 'Print shows the cards, one page each' in t['tip'] and 'Downloads, print and email stay tables' not in t['tip'] and 'cprint (2026-10-31' in t['readme'],
                'print as cards: the module, its css, the ghost buttons, the Quick actions rows, the help, the tip, README'))
    ui = cards + css + t['topic'] + t['tip'] + (r1.group(0) if r1 else '') + (r2.group(0) if r2 else '') + (vo.group(0) if vo else '') + (idx[swi:swi + 600] if swi > 0 else '')
    out.append(('S-roundU', 'Round U (2026-10-31' in t['readme'] and 'function pvHeads(' in cards and 'function pvSortItems(' in cards and "openSort: openSortList" in cards
                and "{ id: 'cardsort', label: 'Sort the cards...'" in pal and 'window.Penumbra.cards.openSort()' in pal and ('On pivot tiles the <strong>Sort</strong> list' in t['ustopic'] or 'On pivot tiles <strong>Sort by</strong>' in t['ustopic'])
                and 'Pivot tiles sort as the pivot does' not in t['ustopic'] and "// (round T) Quick actions' reason showAs:" not in cards,
                'pivot tiles sort: the module, the Quick actions row, the help, README; showAs on its own line'))
    tipm = re.search(r'<div data-tip="us-tip-cards">.*?</div>', t['tip'], re.S)
    out.append(('S-cfix', 'cfix (2026-10-31' in t['readme'] and 'function packCards(' in cards and '#pnbCardsHost.is-packed' in css and 'savedToReport: savedToReport' in cards
                and 'window.Penumbra.cards.savedToReport(' in main and 'if (v && v.nopack) o.nopack = 1;' in main and 'if (c.nopack === 1 || c.nopack === true) o.nopack = 1;' in main
                and 'o.fields = v.fields.slice(0, 16);' in main and 'Pack the cards' in t['ustopic'] and '<strong>All</strong> / <strong>None</strong>' in t['ustopic']
                and bool(tipm) and '<ul>' in tipm.group(0) and len(tipm.group(0)) < 1100 and 'Pack the cards' in tipm.group(0) and 'Right-click a field\'s name for its column heading\'s menu' in t['ustopic'],
                'cfix: the module, css, main.js hooks, the help (a short tip), README'))
    out.append(('S-cfix2', 'cfix2 (2026-10-31' in t['readme'] and 'function pdfPages(doc)' in cards and 'function boardFit(el)' in cards and 'var(--pnb-board-h,' in css
                and 'generatePdfContent({ cards: true })' in main and 'function generatePdfContent(opts) {' in main and 'pnb-ccfg-checks' in cards and '.pnb-cards-pdfnote' in css
                and '<strong>Download &gt; PDF</strong> makes the same as a file' in t['ustopic'] and 'Download as PDF too' in t['tip'],
                'cfix2: the module (PDF pages, the board fit, the switches row), css, main.js hooks, the help, README'))
    out.append(('S-bdlay', 'bdlay (2026-10-31' in t['readme'] and 'function showBoard()' in cards and 'BOARD_NO_TABLE' in cards and 'function boardLayout()' in cards
                and 'ensureBoard' not in cards and 'pnbCardsBoardBy' not in cards and 'function _groupLayoutNorm(v)' in main and 'boardGet:' not in main
                and 'value="board"' in t['index'] and 'data-view="board"' not in t['index'] and 'sbCardsBoardRow' not in t['index']
                and "['board', 'Board']" in t['pal'] and 'window.Penumbra.cards.showBoard()' in t['pal'] and "act: 'gBoard'" in t['menu']
                and 'is a grouping layout' in t['ustopic'] and 'Layout: Stacked, List or Board' in t['grptopic'] and 'Layout: Stacked, List or Board' in t['grptip']
                and '.pnb-cseg-opt.is-off' in css,
                'bdlay: Board is the grouping\'s layout - the module, main.js, index.php, the menus, Quick actions, the help, README'))
    out.append(('S-csortlbl', 'csortlbl (2026-10-31' in t['readme'] and '<label for="pnbCardsSort">Sort by</label><select id="pnbCardsSort"' in idx and 'aria-label="Sort the cards"' not in idx
                and 'Sort: none' not in idx + cards and cards.count('<option value="">None</option>') == 2 and '<strong>Sort by</strong> in the Cards segment' in t['ustopic']
                and 'On pivot tiles <strong>Sort by</strong>' in t['ustopic'] and 'the card size, <em>Sort by</em> and <em>Configure cards...</em>' in t['ustopic'] and 'Sort: none' not in t['ustopic'],
                'csortlbl: the Sort by label in index.php (no aria-label over it), None in both lists, the help, README'))
    out.append(('S-cdash', 'cdash (2026-11-01' in t['readme'] and 'function emailHtml(opts)' in cards and 'emailable: emailable, emailHtml: emailHtml' in cards
                and 'the email body stays a table' not in t['index']
                and 'const cloneCell = ($srcTd) =>' in main and 'cellsOnly: tds || []' in main
                and '_cdM.emailHtml({ budget: _emailBodyBudgetBytes(attachments) })' in main
                and 'const pdfContent = await generatePdfContent({ cards: true });' in main and 'Email Report sends the cards while they show' in t['ustopic'],
                'the email\'s cards: the module, main.js (the cell helper, the dialog, the send, the PDF), index.php, the help, README'))
    out.append(('S-csched', 'csched (2026-11-01' in t['readme'] and 'function savedView()' in cards and 'var MAIL_THEME = {' in cards and "if (report && report.open) return 'cards';" in cards
                and 'emailBodyCardsRow' not in t['index'] and 'emailBodyAsCards' not in main and 'window.Penumbra.cards.on()' in main and 'emailVars: function ()' in main
                and "const _sv = (_svC && _svC.savedView) ? _svC.savedView() : null;" in main
                and '<strong>saved showing cards</strong>' in t['ustopic'],
                'csched: the saved view (module, the server Save), the body as shown, the themed email cards, the help, README'))
    out.append(('S-cchips', 'function chipsOf(' in cards and 'function chipParts(' in cards and 'function chipsReveal(' in cards and 'M.groupVariants(h.name)' in cards and '.pnb-cchip-sep { font-size: 0; }' in css
                and 'LISTS AS CHIPS (cchips' in cards and 'shows each value as a chip' in t['ustopic'] and 'cchips (2026-10-31' in t['readme'],
                'lists as chips: the module, its css, the help, README'))
    out.append(('S-bdlay2', 'bdlay2 (2026-10-31' in t['readme'] and 'function boardRoom(el, b)' in cards and 'var laneMore = Object.create(null);' in cards and 'data-lane-key' in cards
                and '.pnb-cards-board.is-roomy' in css and '.pnb-cards-lanemore' in css and 'function _sbPaintGrpLayouts()' in main and 'id="sbGrpLayouts"' in t['index']
                and '.sb-grp-lay.sb-grp-lay-on' in t['maincss'] and "id: 'grplayout-board'" in t['pal'] and 'Switch to Board view</strong></td>' in t['ustopic']
                and "grouping chip's <em>Layout</em> line" in t['grptip'],
                'bdlay2: the board keeps its scroll, folded lanes stay wide, Sort groups followed, a lane\'s own share, the grouping chip\'s Layout line'))
    out.append(('S-bdlay3', 'bdlay3 (2026-10-31' in t['readme'] and 'function paintGrpSize()' in cards and "if (t.kind === 'band') return out;" in cards
                and 'over = de.scrollHeight - de.clientHeight' in cards and "' cards drawn';" in cards and '#pnbCardsHost.is-board { padding-bottom: 0; }' in css
                and 'id="sbGrpSizeRow"' in t['index'] and 'id="sbGrpCardSize"' in t['index'] and "On a board the grouping chip sorts the lanes" in t['pal']
                and 'Cards chip steps aside' in t['ustopic'],
                'bdlay3: the board fits the window, no Cards chip on a board (the grouping chip has the card size), one layout switch per band menu, a lane counts its cards'))
    out.append(('S-cband', 'cband (2026-11-01' in t['readme'] and 'function bandDraw(el, r, max)' in cards and 'function gcHome()' in cards and 'function gcIn(el)' in cards
                and 'function groupHtml(' not in cards and '.pnb-cards-inband' in css and 'body.pnb-cards-on.pnb-cards-inband #groupedResultsContainer {' in css
                and "Grouped <strong>Stacked</strong>, the cards sit in the grouping" in t['ustopic'],
                'cband: Stacked draws the cards into the grouped view\'s own bands (gcIn / bandDraw / gcHome), the copied bands gone'))
    out.append(('S-cdens', 'cdens (2026-11-01' in t['readme'] and 'body.density-easy-read #pnbCardsHost.is-xl .pnb-card {' in css
                and 'body.density-compact #pnbCardsHost.is-compact .pnb-card {' in css and '#pnbCardsConfig .pnb-ccfg-box,' in css and 'calc(90vh / var(--pnb-dz))' in css
                and "scheduleClip();   // (cdens)" in cards,
                'cdens: the cards follow density (every size, Easy Read Verdana, lane heads), the card dialogs\' caps divided by --pnb-dz, restyle re-reads the clip and the board'))
    out.append(('S-cflt', 'cflt (2026-11-01' in t['readme'] and 'function cfltRun(' in cards and '.pnb-card-val.is-cflt[data-col] { cursor: pointer; }' in css
                and 'body.pnb-click-filter #pnbCardDetails' not in css and 'in the details window (which then closes)' in t['ustopic'],
                'cflt: Click to filter per field on a card and in the details window, its pointer / hover, the README and Settings help'))
    out.append(('S-cdpack', 'cdpack (2026-11-01' in t['readme'] and '#pnbCardsHost.is-packed .pnb-cards-grid { row-gap: 0 !important; }' in css,
                'cdpack: a packed grid keeps no row gap whatever outranks it (the density rules\' size gaps did)'))
    out.append(('S-noEmdash', '\u2014' not in ui and '&mdash;' not in ui, 'no em-dash in the new UI text'))
    return out

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    exp = ('try { window.__HC = {}; [["bso", "buildStateObject"], ["runSearch", "runTableSearch"], ["cf", "applyConditionalFormatting"], ["syncLayout", "penumbraSyncActiveLayout"], ["rgv", "rebuildGroupedView"], ["gpdf", "generatePdfContent"]].forEach(function (p) { try { window.__HC[p[0]] = eval(p[1]); } catch (e) { } }); } catch (e) { }\r\n')
    out = src[:i] + ';(function () {\r\n' + exp + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
# (cfsplit 4) the chip on the forwarded target; the Your Settings topic's bullet; the README's note
_static_checks_before_citem = static_checks
def static_checks(t):
    out = _static_checks_before_citem(t)
    out.append(('S-citem', "var chipEl = target.closest('.pnb-cchip'); t.item = chipEl ? chipEl.textContent : null;" in t['cards']
                and 'Right-click a chip for <em>Filter to</em>, <em>Exclude</em> and <em>Copy</em> of that value alone, on the card or in the details window.</li>' in t['ustopic']
                and '(cfsplit 4, the user' in t['readme'], 'the chip on the target, the topic\'s bullet, the README'))
    return out
MUTANTS.update({
    # (cfsplit 4) the chip not named on the forwarded target (the card and the details window alike); the cell's first value
    # taken in place of the chip's (main.js)
    'ci-nochip': ([('cards', "var chipEl = target.closest('.pnb-cchip'); t.item = chipEl ? chipEl.textContent : null;", "var chipEl = null; t.item = null;")],
                  ['L-citem-chipMenu', 'L-citem-detChip', 'S-citem'], ['citem']),
    'ci-first': ([('main', "var v = (at.value !== undefined && at.value !== null) ? String(at.value) : _pnbCfltItemAt(td, its, at.x, at.y);", "var v = its[0].v;")],
                 ['L-citem-chipMenu'], ['citem']),
})

# (clay) the preset engine beside the cards; Quick actions' row, the help, the README
RELS['presets'] = os.path.join('js', 'penumbra_presets.js'); RELS['presetscss'] = os.path.join('css', 'penumbra_presets.css')
_static_checks_before_clay = static_checks
def static_checks(t):
    out = _static_checks_before_clay(t)
    out.append(('S-clay', "{ id: 'cardlayouts', label: 'Card layouts...'," in t['pal'] and "run: function () { window.Penumbra.cards.openLayouts(); }" in t['pal']
                and '<strong>Save these cards...</strong> names what the window shows' in t['ustopic']
                and 'up to 16 fields; <strong>Layouts</strong> saves them by name.</li>' in t['tip'] and 'clay (2026-11-03, the user' in t['readme'],
                'the palette row, the Your Settings topic, the tip, the README'))
    return out
MUTANTS.update({
    # (clay) named card layouts: the chip never mounted; a layout's setup not applied; Escape closing the window under
    # the list; Quick actions' row opening the window alone; the engine without the cards namespace
    'ly-mount': ([('cards', "        lyMount();   // (clay)", "        // (clay)")], ['L-clay1-chipThere'], ['clay1']),
    'ly-apply': ([('cards', "        try { H.layoutSet(layoutClean(data.setup)); } catch (e) { }   // the report's own rules", "        // the report's own rules")], ['L-clay1-savedApplied'], ['clay1']),
    'ly-esc': ([('cards', "        if (cfgOpen && esc && !e.defaultPrevented && lyCtl && lyCtl.isOpen()) {", "        if (false) {")], ['L-clay1-escList'], ['clay1']),
    'ly-open': ([('cards', "        if (c && !lyCtl.isOpen()) c.click();\n", "")], ['L-clay1-openLayouts'], ['clay1']),
    'ly-ns': ([('presets', "        cards:       { pin: null,     legacy: null }\n", "")], ['L-clay1-chipThere'], ['clay1']),
    'ly-pal': ([('pal', "run: function () { window.Penumbra.cards.openLayouts(); }", "run: function () { window.Penumbra.cards.openConfig(); }")], ['S-clay'], []),
})

# (2026-11-03, menufix) a Board card's Show as table, Clear all on a lane, the space between cards
SCN = SCN + ['cgapm']
CHK['cgapm'] = ['gapMenu', 'gapSizes', 'gapCardStill', 'gapTable']
CHK['gboard'] = CHK['gboard'] + ['cardTableWord', 'laneClear']
GUARDS -= {'L-cnest-whiteStillCard'}   # (menufix) a card's empty space ends with Clear all now: red on live
NEW = ({'L-cgapm-%s' % c for c in CHK['cgapm']} | {'L-gboard-cardTableWord', 'L-gboard-laneClear', 'L-cnest-whiteStillCard', 'L-pmenu-totalTileMenu'}) - GUARDS - {'L-cgapm-gapCardStill'}
NEW = set()   # (menufix is LIVE since 5b124ce, 2026-11-03: old checks now)
# (2026-11-03, menufix2) the pill's menu, every card shown / trimmed, a tile's sorts naming their column, the column order
SCN = SCN + ['cmore2']
CHK['cmore2'] = ['pillMenu', 'allOffered', 'allOpens', 'trimOffered', 'allTrims']
CHK['pfsort'] = CHK['pfsort'] + ['colsSort']
NEW = ({'L-cmore2-%s' % c for c in CHK['cmore2']} - {'L-cmore2-allTrims'}) | {'L-pfsort-valueMenuSorts', 'L-pfsort-titleMenuSorts', 'L-pfsort-colsSort'}
NEW = set()   # (menufix2 is LIVE since f4cc45a, 2026-11-03: old checks now)
# (2026-11-03, menufix3) a card's Hide / Show only edit the card layout; its sorts named; the details window's Print
SCN = SCN + ['cfld3']
CHK['cfld3'] = ['sortNamed', 'hideCard', 'hideUndo', 'onlyCard', 'detPrint', 'detHideTable']
NEW_MF3 = {'L-cfld3-%s' % c for c in CHK['cfld3']} - {'L-cfld3-hideUndo'}
GUARDS |= {'L-cfld3-hideUndo'}   # the table hide's own Undo restores the field on live too
MUTANTS.update({
    'mf3-hide': ([('menu', "                    if (o.act === 'hide' && fcol) {", "                    if (false) {")], ['L-cfld3-hideCard'], ['cfld3']),   # (its Undo: the table hide's own Undo puts the field back too)
    'mf3-only': ([('menu', "                    } else if (o.act === 'only' && fcol) {", "                    } else if (false) {")], ['L-cfld3-onlyCard'], ['cfld3']),
    'mf3-details': ([('menu', "        if (fromCard && !fromCard.inDetails && !fromCard.pivot && CL && typeof CL.fieldHide === 'function') {", "        if (fromCard && !fromCard.pivot && CL && typeof CL.fieldHide === 'function') {")], ['L-cfld3-detHideTable'], ['cfld3']),
    'mf3-sort': ([('menu', "                o.label = it.label.replace(/^(Then sort|Sort) /, function (m, w) { return w + ' by ' + title + ': '; });", "")], ['L-cfld3-sortNamed'], ['cfld3']),
    'mf3-print': ([('cards', "        var pb = t.inDetails && det.open ? document.querySelector('#pnbCardDetails .pnb-cdet-print') : null;", "        var pb = null;")], ['L-cfld3-detPrint', 'L-cfld3-detHideTable'], ['cfld3']),
})
MUTANTS.update({
    'mf2-pill': ([('cards', "        if (ctl && !ctl.classList.contains('pnb-card-more')) return null;", "        if (ctl) return null;")], ['L-cmore2-pillMenu'], ['cmore2']),
    'mf2-allopen': ([('cards', "            if (open && c.classList.contains('is-clipped')) { c.classList.add('is-open'); openCards[k] = 1; }", "            if (false) { c.classList.add('is-open'); openCards[k] = 1; }")], ['L-cmore2-allOpens', 'L-cmore2-trimOffered'], ['cmore2']),
    'mf2-alloffer': ([('cards', "            if (anyCards('is-clipped')) out.push({ act: 'cardsAllOpen',", "            if (false) out.push({ act: 'cardsAllOpen',")], ['L-cmore2-allOffered', 'L-cmore2-allOpens'], ['cmore2']),
    'mf2-sortword': ([('cards', "label: 'Sort by ' + e.label + ': ascending',", "label: 'Sort ascending',")], ['L-pfsort-valueMenuSorts', 'L-pfsort-titleMenuSorts'], ['pfsort']),
    'mf2-cols': ([('cards', "        if (csi && st && st.cols && st.cols.length) {", "        if (false) {")], ['L-pfsort-colsSort'], ['pfsort']),
})
MUTANTS.update({
    'mf-gap': ([('cards', "        if (!t) { gapMenu(e); return; }", "        if (!t) return;")], ['L-cgapm-gapMenu', 'L-cgapm-gapSizes', 'L-cgapm-gapTable'], ['cgapm']),
    'mf-gapitems': ([('cards', "        CM.openItems('Cards', menuExtras({ kind: 'gap', card: null, pivot: false }, false), e.clientX, e.clientY, { kbd: kbd });", "        CM.openItems('Cards', [], e.clientX, e.clientY, { kbd: kbd });")], ['L-cgapm-gapMenu', 'L-cgapm-gapSizes'], ['cgapm']),
    'mf-boardword': ([('cards', "        if (bd) out.push({ act: 'cardsStacked', label: 'Show as table',", "        if (bd) out.push({ act: 'cardsStacked', label: 'Switch to Stacked view',")], ['L-gboard-cardTableWord'], ['gboard']),
    'mf-laneclear': ([('menu', "        if (!c && cur && !cur.bd && !cur.cmp) { c = clearItem(); }", "        if (false) { c = clearItem(); }")], ['L-gboard-laneClear', 'L-cgapm-gapMenu'], ['gboard', 'cgapm']),
})

# (2026-11-03, pvgt; found on ?id=cprojects, a pivot of eight labelled measures and no column field) the Grand Total tile
# named every value for the FIRST measure: the tfoot's cells carry the drill's data-agg-idx alone (no data-pv-ai), read as
# 0. pvgt: no column field (Amt the big number, N and Mean the fields); pvgtB: V_STATUS across and the tiles' setup picking
# N alone (the total tile listed none of them), Find on a Mean total the tile leaves out (named "<status> Amt")
SCN = SCN + ['pvgt', 'pvgtB']
CHK['pvgt'] = ['gtLabels', 'leafLabels', 'gtValues']
CHK['pvgtB'] = ['gtPicked', 'gtLabelsCol', 'leafPicked', 'gtFound']
GUARDS |= {'L-pvgt-leafLabels', 'L-pvgt-gtValues', 'L-pvgtB-leafPicked'}   # (pvgt: hold on live - the body's cells carry data-pv-ai; the values were right)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('pvgt', 'pvgtB') for c in CHK[sc]} | {'S-pvgt'}) - GUARDS   # (pvgt: the Grand Total tile's measures)
NEW = set()   # (pvgt is LIVE since b5e6af8, 2026-11-03: old checks now)
_static_checks_before_pvgt = static_checks
def static_checks(t):
    out = _static_checks_before_pvgt(t)
    cards = t['cards']
    out.append(('S-pvgt', "    function pvAi(td) { return parseInt(td.getAttribute('data-pv-ai') || td.getAttribute('data-agg-idx') || '0', 10); }" in cards
                and cards.count('pvAi(kc)') == 3 and "getAttribute('data-pv-ai') || '0'" not in cards,   # (pvgt2) the key cell's three reads
                'pvgt: one reader of a value cell\'s measure (data-pv-ai, else the drill\'s data-agg-idx), for the tile\'s fields and Find\'s label'))
    return out
MUTANTS.update({
    # (pvgt) the fallback gone: every Grand Total value named for the first measure, the picked N lets none through, Find
    # names a Mean total for the first measure; then each call site on its own (the tile's fields, Find's label)
    'gt-fallback': ([('cards', "    function pvAi(td) { return parseInt(td.getAttribute('data-pv-ai') || td.getAttribute('data-agg-idx') || '0', 10); }",
                      "    function pvAi(td) { return parseInt(td.getAttribute('data-pv-ai') || '0', 10); }")],
                    ['L-pvgt-gtLabels', 'L-pvgtB-gtPicked', 'L-pvgtB-gtLabelsCol', 'L-pvgtB-gtFound', 'S-pvgt'], ['pvgt', 'pvgtB']),
    'gt-tileai': ([('cards', "                var ai = pvAi(tc);   // (pvgt) the Grand Total row's cells: their data-agg-idx",
                    "                var ai = parseInt(tc.getAttribute('data-pv-ai') || '0', 10);")],
                  ['L-pvgt-gtLabels', 'L-pvgtB-gtPicked', 'L-pvgtB-gtLabelsCol', 'S-pvgt'], ['pvgt', 'pvgtB']),
    'gt-findai': ([('cards', ", ai = pvAi(td);   // (pvgt) a Grand Total cell's own measure", ", ai = parseInt(td.getAttribute('data-pv-ai') || '0', 10);")],
                  ['L-pvgtB-gtFound', 'S-pvgt'], ['pvgtB']),
})

# (2026-11-03, pvgt2; the user: "Yes, fix them here") the gaps pvgt left. pvgtD (no column field, Find loaded): the big
# number named for its measure (it read blank), Find marking a value on its tile (a key of "" read as none: the hit went
# to the title) and naming one a Compact tile leaves out by its measure (it read '#3'). pvgtC (no breakdown: the Grand
# Total row's totals carry no keys): those totals listed on the total tile, its big number named, Find marking them
SCN = SCN + ['pvgtD', 'pvgtC']
CHK['pvgtD'] = ['bigLabel', 'findValue', 'findNamed']
CHK['pvgtC'] = ['gtKeyless', 'bigKeyless', 'bodyKeyless', 'findKeyless']
GUARDS |= {'L-pvgtC-bodyKeyless'}   # (pvgt2: holds on live - the body's cells carry data-pv-ck + data-pv-ai under no breakdown)
NEW = ({'L-%s-%s' % (sc, c) for sc in ('pvgtD', 'pvgtC') for c in CHK[sc]} | {'S-pvgt', 'S-pvgt2'}) - GUARDS   # (pvgt2; S-pvgt now counts the key cell's reads)
NEW = set()   # (pvgt2 is LIVE since 149bf1b, 2026-11-03: old checks now)
_static_checks_before_pvgt2 = static_checks
def static_checks(t):
    out = _static_checks_before_pvgt2(t)
    cards = t['cards']
    out.append(('S-pvgt2', 'function pvKeyCell(td) {' in cards and 'function pvFieldLabel(kc, measures)' in cards and '        if (!ck) return (ms.length > 1 && ms[ai]) || key;' in cards
                and 'bigLabel = keyPath(' not in cards,
                'pvgt2: the key cell (a keyless total by its heading), the big number named as a field is, Find naming the measure alone'))
    return out
MUTANTS.update({
    # (pvgt2) the big number by its column alone; Find's old key test (a key of "" = a label); the hidden value by its place;
    # the Grand Total row's keyless totals without their heading's body cell
    'gt2-biglabel': ([('cards', "big = ci; bigLabel = pvFieldLabel(bk, measures); break;", "big = ci; bigLabel = keyPath(pvColKey(bk)); break;")],
                     ['L-pvgtD-bigLabel', 'L-pvgtC-bigKeyless', 'S-pvgt2'], ['pvgtD', 'pvgtC']),
    'gt2-findkey': ([('cards', "            var lab = td.hasAttribute('data-row-field') || !(pvKeyCell(td) || td.classList.contains('pivot-grand-total'));",
                      "            var lab = td.hasAttribute('data-row-field') || !(td.getAttribute('data-col-key') || td.getAttribute('data-pv-ck') || td.classList.contains('pivot-grand-total'));")],
                    ['L-pvgtD-findValue', 'L-pvgtD-findNamed', 'L-pvgtC-findKeyless'], ['pvgtD', 'pvgtC']),
    'gt2-findname': ([('cards', "        if (!ck) return (ms.length > 1 && ms[ai]) || key;", "        if (!ck) return key;")], ['L-pvgtD-findNamed', 'S-pvgt2'], ['pvgtD']),
    'gt2-footref': ([('cards', "        if (!T || td.hasAttribute('colspan') || td.hasAttribute('data-row-field-span-from')", "        if (true || td.hasAttribute('colspan') || td.hasAttribute('data-row-field-span-from')")],
                    ['L-pvgtC-gtKeyless', 'L-pvgtC-bigKeyless', 'L-pvgtC-findKeyless'], ['pvgtC']),
})
# (pvgt2) pvgt's call-site mutants re-anchored on the key cell (kc)
MUTANTS['gt-tileai'] = ([('cards', "                var ai = pvAi(kc);   // (pvgt) the Grand Total row's cells: their data-agg-idx", "                var ai = parseInt(kc.getAttribute('data-pv-ai') || '0', 10);")], MUTANTS['gt-tileai'][1], MUTANTS['gt-tileai'][2])
MUTANTS['gt-findai'] = ([('cards', ", ai = pvAi(kc);   // (pvgt) a Grand Total cell's own measure", ", ai = parseInt(kc.getAttribute('data-pv-ai') || '0', 10);")], MUTANTS['gt-findai'][1], MUTANTS['gt-findai'][2])

# (2026-11-03, bdj, the user) a % change tile's value opens its breakdown: the tile clicks the pivot's derived cell too
# (data-pv-drv: no drill keys of its own), and the pivot's own drill (brk, b573316) opens the cells it is computed from
SCN = SCN + ['pw4drv']
CHK['pw4drv'] = ['drvTile']
NEW = {'L-pw4drv-drvTile'}   # (bdj)
NEW = set()   # (bdj is LIVE since 3b4c8be, 2026-11-03: old checks now)
MUTANTS.update({
    'bd-drvtile': ([('cards', " || ptd.hasAttribute('data-grand-total') || ptd.hasAttribute('data-pv-drv'))) {", " || ptd.hasAttribute('data-grand-total'))) {")],
                   ['L-pw4drv-drvTile'], ['pw4drv']),
})

NEW = NEW | NEW_MF3   # (menufix3) after every later round's NEW line
NEW = NEW - NEW_MF3   # (menufix3 is LIVE since c53d600, 2026-11-03: old checks now)

# (cedge, 2026-11-03, the user: the cards list's item 4 - the status edge) a card's left edge in its pill's colour
GUARDS |= {'L-chl-edgePlain'}   # (cedge: holds on live - no card has an edge there)
NEW_CEDGE = {'L-chl-%s' % c for c in ('edgeRuled', 'edgePlain', 'edgePainted', 'edgeDetail', 'edgeMail', 'edgeRule', 'edgeTheme')} - GUARDS
NEW = NEW | NEW_CEDGE   # (cedge) after every later round's NEW line - add, never replace
NEW = NEW - NEW_CEDGE   # (cedge is LIVE since ac211e9, 2026-11-03: old checks now)
# (cedge2, 2026-11-04, the user: no edge from a Highlight swatch) a swatch's var() colour
NEW_CEDGE2 = {'L-chl-edgeSwatch', 'L-chl-edgeSwatchMail', 'L-chl-edgeSwatchTheme', 'L-chl-edgeGreyTheme'}
NEW = NEW | NEW_CEDGE2   # (cedge2) after every later round's NEW line - add, never replace
NEW = NEW - NEW_CEDGE2   # (cedge2 is LIVE since 190f407, 2026-11-04: old checks now)
MUTANTS.update({
    'ed-off': ([('cards', "    function edgeCss(c) { return c ? '--pnb-card-edge:' + c + ';' : ''; }", "    function edgeCss(c) { return ''; }")],
               ['L-chl-edgeRuled', 'L-chl-edgePainted', 'L-chl-edgeDetail'], ['chl']),
    'ed-card': ([('cards', "        if (r.pill) cs += edgeCss(edgeOf(cellOf(tr, r.pill)));   // (cedge) the status pill's colour down the left edge\n", "")],
                ['L-chl-edgeRuled', 'L-chl-edgePainted'], ['chl']),
    'ed-chroma': ([('cards', "            if (ch >= 24) { if (ch > bc) { bc = ch; best = v; } }\n            else if (k > gk) { gk = k; grey = v; }\n", "            if (k > gk) { gk = k; grey = v; }\n")],
                  ['L-chl-edgeTheme'], ['chl']),
    'ed-restyle': ([('cards', "            card.style.cssText = styleOf(tr, CARD_PROPS) + (r.pill ? edgeCss(edgeOf(cellOf(tr, r.pill))) : '');   // (cedge)", "            card.style.cssText = styleOf(tr, CARD_PROPS);   // (cedge)")],
                   ['L-chl-edgeTheme'], ['chl']),
    'ed-det': ([('cards', "        if (r.pill) cs += edgeCss(edgeOf(cellOf(tr, r.pill)));   // (cedge) the head's edge, as the card's\n", "")],
               ['L-chl-edgeDetail'], ['chl']),
    'ed-mail': ([('cards', "(eg ? 'border-left:4px solid ' + esc(eg) + ';' : '')", "''")], ['L-chl-edgeMail'], ['chl']),
    'ed-css': ([('cardscss', ".pnb-card[style*=\"--pnb-card-edge\"] { background-image: linear-gradient(var(--pnb-card-edge), var(--pnb-card-edge)); background-size: 4px 100%; background-repeat: no-repeat; }\n", "")],
               ['L-chl-edgePainted'], ['chl']),
    'e2-var': ([('cards', "|[a-z]{3,30}|var\\(\\s*--[\\w-]{1,60}\\s*(?:,\\s*(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\\([0-9.,%\\s\\/deg]+\\)|[a-z]{3,30})\\s*)?\\))$/i;", "|[a-z]{3,30})$/i;")],
               ['L-chl-edgeSwatch', 'L-chl-edgeSwatchMail'], ['chl']),
    'e2-mail': ([('cards', "        function st(td, props) { var s = unVar(styleOf(td, props || MAIL_PROPS), vm); return s ? esc(s) : ''; }", "        function st(td, props) { var s = styleOf(td, props || MAIL_PROPS); return s ? esc(s) : ''; }")],
                ['L-chl-edgeSwatchMail'], ['chl']),
    'e2-sig': ([('cards', "            if (sig !== edgeSig) { edgeSig = sig; edgeRgbs = Object.create(null); }", "            if (sig !== edgeSig) { edgeSig = sig; }")],
               ['L-chl-edgeGreyTheme'], ['chl']),
    'ed-detcss': ([('cardscss', ".pnb-cdet-card.pnb-card[style*=\"--pnb-card-edge\"] { background-image: none; border-left: 4px solid var(--pnb-card-edge); padding-left: 10px; }\n", "")],
                  ['L-chl-edgeDetail'], ['chl']),
})


# (lanehd, 2026-11-04, the user: "When grouping by 'board' only the header text is clickable for the collapse/expand -- the
# entire header band should be clickable like in the stacked layout") a lane's whole head folds it: its count, its empty end
CHK['gboard'] = CHK['gboard'] + ['laneHeadFolds']
NEW_LANEHD = {'L-gboard-laneHeadFolds'}
NEW = NEW | NEW_LANEHD   # (lanehd) after every later round's NEW line - add, never replace
NEW = NEW - NEW_LANEHD   # (lanehd is LIVE since 3d61921, 2026-11-04: old checks now)
NEW = NEW | NEW_CARDLINK   # (cardlink) after every later round's NEW line - add, never replace
NEW = NEW - NEW_CARDLINK   # (cardlink + cardlink 2 are LIVE since 39bfe1c / 7c0a335, 2026-11-05: old checks now)
GUARDS |= {'L-vstB-linkLayout', 'L-vstB-visitNoWrite', 'L-vstC-linkDensity'}   # (viewstrict: hold on live - the link's layout and density applied there already; no write visible there: its mutant vs-rhw decides)
NEW = NEW | (NEW_VST - GUARDS)   # (viewstrict) after every later round's NEW line - add, never replace
NEW = NEW - NEW_VST   # (viewstrict is LIVE since 387063b, 2026-11-05: old checks now)
GUARDS |= {'L-hsA-noHdrWhenShown'}   # (hscroll: holds on live - no &noheader there at all)
NEW = NEW | (NEW_HS - GUARDS)   # (hscroll) after every later round's NEW line - add, never replace
NEW = NEW - NEW_HS   # (hscroll is LIVE since edae988, 2026-11-06: old checks now)
NEW = NEW | {'L-vstB-oneLine'}   # (viewstrict 2: the two Settings buttons on one line)
NEW = NEW - {'L-vstB-oneLine'}   # (viewstrict 2 is LIVE, 2026-11-05: old checks now)
MUTANTS.update({
    'lh-click': ([('cards', "        var lh = e.target.closest('.pnb-cards-lanehead');\n", "        var lh = null;\n")], ['L-gboard-laneHeadFolds'], ['gboard']),
    'lh-cursor': ([('cardscss', ".pnb-cards-lane > .pnb-cards-lanehead { cursor: pointer; border-radius: 7px 7px 0 0; }", ".pnb-cards-lane > .pnb-cards-lanehead { border-radius: 7px 7px 0 0; }")], ['L-gboard-laneHeadFolds'], ['gboard']),
})

# (ccopy, 2026-11-05, the user: "copy table as-is still copies table format" in cards mode) Copy As-Is while cards show
# copies the cards (the email's layout over every row the search keeps) and the Copy dialog's As-Is option says so; the
# table showing and a pivot's tiles copy the table (guards: they hold on live)
SCN = SCN + ['ccopy', 'gcopy', 'pcopy']
CHK['ccopy'] = ['noteCards', 'htmlOnly', 'copiedCards', 'allPages', 'inOrder', 'offPageFilled', 'offPageRuled', 'sizeShown', 'toastCards', 'screenSame',
                'cutWords', 'searchKept', 'emptyNotice', 'tableWords', 'tableStill']
CHK['gcopy'] = ['noteCards', 'grpHeads', 'grpCards', 'grpToast', 'allFolded']
CHK['pcopy'] = ['pivotWords', 'pivotTable', 'pivotToast']
RELS['cptopic'] = os.path.join('help', 'topics', 'copyHelpLightbox.php')   # (ccopy) the Copy help
GUARDS |= {'L-ccopy-htmlOnly', 'L-ccopy-screenSame', 'L-ccopy-tableWords', 'L-ccopy-tableStill'} | {'L-pcopy-%s' % c for c in CHK['pcopy']}   # (ccopy: hold on live - the table's copy, its words; the pivot's)
NEW_CCOPY = ({'L-%s-%s' % (sc, c) for sc in ('ccopy', 'gcopy', 'pcopy') for c in CHK[sc]} | {'S-ccopy'}) - GUARDS
NEW = NEW | NEW_CCOPY   # (ccopy) after every later round's NEW line - add, never replace
NEW = NEW - NEW_CCOPY   # (ccopy is LIVE since 7290299, 2026-11-05: old checks now)
_static_checks_before_ccopy = static_checks
def static_checks(t):
    out = _static_checks_before_ccopy(t)
    m, cd, ix = t['main'], t['cards'], t['index']
    note = re.search(r'<small id="copyHtmlCardsNote"[^>]*>([^<]*)</small>', ix)
    ok = (m.count('if (_pnbCopyCards()) break;') == 1 and m.count('_pnbCopyCardsNote();') == 1
          and m.count("const exportData = getExportData('html', { allPages: true, budget: PENUMBRA_COPY_HTML_MAX_BYTES, notice: 'copy' });") == 1
          and 'function copyHtml(opts)' in cd and 'copyHtml: copyHtml,' in cd and 'id="copyHtmlTableNote"' in ix and 'id="copyHtmlLabel"' in ix
          and bool(note) and '\u2014' not in note.group(1) and 'Copy Cards As-Is' in t.get('cptopic', '') and 'Copy As-Is copies them' in t['ustopic']
          and 'ccopy (2026-11-05' in t['readme'])
    out.append(('S-ccopy', bool(ok), 'ccopy: main.js hook ahead of the unchanged table copy line + the note call, cards.js copyHtml, index.php label / notes (no em-dash), help (Copy, Your Settings > Cards), README'))
    return out
MUTANTS.update({
    # (ccopy) the page alone; the table copied anyway; the dialog's words left; the table's words not put back; the email's cut
    # words; the table's toast; no headings counted; nothing-to-copy unsaid
    'cc-all': ([('cards', "all = flatRows(!!opts.all);", "all = flatRows(false);")], ['L-ccopy-allPages', 'L-ccopy-inOrder', 'L-ccopy-toastCards'], ['ccopy']),
    'cc-hook': ([('main', "if (_pnbCopyCards()) break;", "if (false) break;")], ['L-ccopy-copiedCards', 'L-ccopy-allPages', 'L-ccopy-toastCards', 'L-gcopy-grpHeads'], ['ccopy', 'gcopy']),
    'cc-note': ([('main', "        _pnbCopyCardsNote();   // (ccopy) the As-Is option's words while cards show", "        void 0;   // (ccopy) the As-Is option's words while cards show")], ['L-ccopy-noteCards', 'L-gcopy-noteCards'], ['ccopy', 'gcopy']),
    'cc-noteback': ([('main', "$('#copyHtmlLabel').text(cards ? 'Copy Cards As-Is (HTML)' : 'Copy Table As-Is (HTML)');", "if (cards) $('#copyHtmlLabel').text('Copy Cards As-Is (HTML)');")], ['L-ccopy-tableWords'], ['ccopy']),
    'cc-words': ([('cards', "(opts.copy ? (left === 1 ? ' was' : ' were')", "(false ? (left === 1 ? ' was' : ' were')")], ['L-ccopy-cutWords'], ['ccopy']),
    'cc-toast': ([('main', "Copied ${n.toLocaleString()} card${n === 1 ? '' : 's'} to the clipboard.", "Copied table to clipboard.")], ['L-ccopy-toastCards', 'L-gcopy-grpToast'], ['ccopy', 'gcopy']),
    'cc-heads': ([('cards', "                heads++;\n", "")], ['L-gcopy-allFolded'], ['gcopy']),
    'cc-empty': ([('main', "if (!m.total && !m.heads) {", "if (false) {")], ['L-ccopy-emptyNotice'], ['ccopy']),
    'cc-fill': ([('cards', "        try { H.fillRows(all); } catch (e) { }", "        void 0;")], ['L-ccopy-offPageFilled'], ['ccopy']),
})

# (gtlast, 2026-11-05, the user: "In cards mode for pivots, why is the grand total always first?") the Grand Total tile
# LAST, after every row's tile, as the pivot table has it: pcoff's total-first checks re-aimed at the last tile
CHK['pcoff'] = CHK['pcoff'] + ['totalLast', 'totalFollows']
CHK['pw2next'] = CHK['pw2next'] + ['gtFirstStep']
NEW_GTLAST = {'L-pcoff-totalLast', 'L-pcoff-totalFollows', 'L-pcoff-totalTile', 'L-pcoff-tileTitle', 'L-pvcfg-noBarOnTotal', 'L-pfsort-bigAndTotal', 'L-pw4drv-drvTile',
              'L-pw2next-gtFirstStep', 'L-pw2next-pivotNextOn', 'S-gtlast',
              # read through the re-aimed helpers (the last tile, no row offset): red on a live that draws the total first
              'L-pcoff-tileBig', 'L-pcoff-tileFields', 'L-pvgt-gtLabels', 'L-pvgt-gtValues', 'L-pvgtB-gtFound', 'L-pvgtB-gtLabelsCol', 'L-pvgtB-gtPicked',
              'L-pvgtC-bigKeyless', 'L-pvgtC-findKeyless', 'L-pvgtC-gtKeyless', 'L-pvgtD-bigLabel'}
NEW = NEW | NEW_GTLAST   # (gtlast) after every later round's NEW line - add, never replace
NEW = NEW - NEW_GTLAST   # (gtlast is LIVE since 1a5706d, 2026-11-05: old checks now)
_static_checks_before_gtlast = static_checks
def static_checks(t):
    out = _static_checks_before_gtlast(t)
    cd = t['cards']
    i_loop = cd.find('            out += pvTile(tr, idx, measures, compact, false, ps0); count++;')
    i_foot = cd.find('        if (foot) { var gi = pvRows.length; pvRows.push({ tr: foot }); out += pvTile(foot, gi, measures, compact, true, ps0); count++; }')
    ok = (i_loop > 0 and i_foot > i_loop and 'out += pvTile(foot, 0, measures' not in cd and 'The grand total is the last tile. A click on a value' in t['ustopic']
          and 'gtlast (2026-11-05' in t['readme'])
    out.append(('S-gtlast', bool(ok), 'gtlast: the foot drawn after the body tiles (once none waits behind Show more), help + README'))
    return out
MUTANTS.update({
    # (gtlast) the total first again / drawn while tiles wait behind Show more
    'gt-first': ([('cards', "        var trs = T.tBodies.length ? T.tBodies[0].rows : [];\n        for (i = 0; i < trs.length; i++) {\n            var tr = trs[i];\n            if (tr.style.display === 'none') continue;",
                   "        if (foot) { pvRows.push({ tr: foot }); out += pvTile(foot, 0, measures, compact, true, ps0); count++; foot = null; }\n        var trs = T.tBodies.length ? T.tBodies[0].rows : [];\n        for (i = 0; i < trs.length; i++) {\n            var tr = trs[i];\n            if (tr.style.display === 'none') continue;")],
                 ['L-pcoff-totalLast', 'L-pcoff-totalTile', 'L-pcoff-tileTitle'], ['pcoff']),
    # (the sweep) the total's details window left at the old index / Next from the total stepping past the first new row
    'gt-follow': ([('cards', "        if (was.det) det.at = gi;\n", "")], ['L-pcoff-totalFollows'], ['pcoff']),
    'gt-next': ([('cards', "            if (gtFrom >= 0 && det.open && gtFrom < detCount()) { det.at = gtFrom - 1; return detGo(1); }\n", "")], ['L-pw2next-pivotNextOn'], ['pw2next']),
    'gt-held': ([('cards', "        if (foot) { var gi = pvRows.length; pvRows.push({ tr: foot });", "        if (foot && !drawn.more) { var gi = pvRows.length; pvRows.push({ tr: foot });")], ['L-pw2next-gtFirstStep'], ['pw2next']),
})

# (csweep3, 2026-11-05, the bug sweep) the copy's and email's cards: the notes only when sent, a nested Board's lanes,
# the List layout's picked group; the copy without a wait; the note's words
SCN = SCN + ['gbcopy', 'ggcopy', 'pw5more']
CHK['gbcopy'] = ['laneCards', 'laneHeads', 'laneToast']
CHK['ggcopy'] = ['listOnly']
CHK['pw5more'] = ['moreFocusRow']
CHK['cnote'] = CHK['cnote'] + ['mailNotesOff']
NEW_CSWEEP3 = ({'L-%s-%s' % (sc, c) for sc in ('gbcopy', 'ggcopy', 'pw5more') for c in CHK[sc]} | {'L-cnote-mailNotesOff', 'L-ccopy-noteCards', 'S-csweep3'})
NEW = NEW | NEW_CSWEEP3   # (csweep3) after every later round's NEW line - add, never replace
NEW = NEW - NEW_CSWEEP3   # (csweep3 is LIVE since fb50302, 2026-11-05: old checks now)
# (pvcopy, 2026-11-05, the user: "the cards arent copied as cards when in a pivot view") a pivot's tiles copy as cards:
# pcopy's checks are the tiles' now (the table's guards retired); pcopymore copies past Show more
SCN = SCN + ['pcopymore']
GUARDS -= {'L-pcopy-pivotWords', 'L-pcopy-pivotTable', 'L-pcopy-pivotToast'}
CHK['pcopy'] = ['tilesWords', 'tilesCards', 'tilesTotalLast', 'tilesParts', 'tilesMailSafe', 'tilesHtmlOnly', 'tilesToast']
CHK['pcopymore'] = ['allTiles', 'totalLast']
GUARDS |= {'L-pcopy-tilesHtmlOnly'}   # (pvcopy: the table's copy is text/html alone too - holds on live)
NEW_PVCOPY = ({'L-%s-%s' % (sc, c) for sc in ('pcopy', 'pcopymore') for c in CHK[sc]} | {'S-pvcopy'}) - GUARDS
NEW = NEW | NEW_PVCOPY   # (pvcopy) after every later round's NEW line - add, never replace
NEW = NEW - NEW_PVCOPY   # (pvcopy is LIVE since 74f7ced, 2026-11-05: old checks now)
# (pvmail, 2026-11-05, the user: "Yes, email tiles too") the Email Report's body over a pivot's tiles: the tiles as cards
SCN = SCN + ['pmailt']
CHK['pmailt'] = ['tilesMailable', 'tilesBody', 'tilesAsEmail', 'tilesSize', 'tilesEmailWords']
NEW_PVMAIL = ({'L-pmailt-%s' % c for c in CHK['pmailt']} | {'S-pvmail'}) - GUARDS
NEW = NEW | NEW_PVMAIL   # (pvmail) after every later round's NEW line - add, never replace
NEW = NEW - NEW_PVMAIL   # (pvmail is LIVE since 31a5970, 2026-11-05: old checks now)
_static_checks_before_pvmail = static_checks
def static_checks(t):
    out = _static_checks_before_pvmail(t)
    cd, m = t['cards'], t['main']
    ok = ('if (tilesCopyable() && !opts.copy) return pivotMailHtml({' in cd and 'mailable: copyable,' in cd and 'copy: !opts.email, tiles: true' in cd
          and 'window.Penumbra.cards.mailable && window.Penumbra.cards.mailable()) _emailAudit.bodyCards = true;' in m
          and '(_cdM.mailable ? _cdM.mailable() : (_cdM.emailable && _cdM.emailable()))' in m
          and "A pivot's tiles go as cards as well, the Grand Total last." in t['emtopic'] and 'A pivot sends its table.' not in t['emtopic']
          and 'pvmail (2026-11-05' in t['readme'])
    out.append(('S-pvmail', bool(ok), 'pvmail: emailHtml routes tiles, the API mailable, main.js gates the email body and its audit on it, the email help, README'))
    return out
MUTANTS.update({
    # (pvmail) the email's body over tiles the table's again / the copy's cut words / counted as a copy / the API's mailable
    # the table's / main.js's audit or body gate without tiles
    'pm-route': ([('cards', "        if (tilesCopyable() && !opts.copy) return pivotMailHtml({", "        if (false) return pivotMailHtml({")], ['L-pmailt-tilesBody', 'L-pmailt-tilesAsEmail'], ['pmailt']),
    'pm-words': ([('cards', "(opts.email ? (left === 1 ? '' : 's') + ' omitted", "(false ? (left === 1 ? '' : 's') + ' omitted")], ['L-pmailt-tilesEmailWords'], ['pmailt']),
    'pm-asmail': ([('cards', "copy: !opts.email, tiles: true", "copy: true, tiles: true")], ['L-pmailt-tilesAsEmail'], ['pmailt']),
    'pm-api': ([('cards', "        mailable: copyable,", "        mailable: emailable,")], ['L-pmailt-tilesMailable', 'S-pvmail'], ['pmailt']),
    'pm-audit': ([('main', "window.Penumbra.cards.mailable && window.Penumbra.cards.mailable()) _emailAudit.bodyCards = true;", "window.Penumbra.cards.mailable && false) _emailAudit.bodyCards = true;")], ['S-pvmail'], ['pmailt']),
    'pm-gate': ([('main', "(_cdM.mailable ? _cdM.mailable() : (_cdM.emailable && _cdM.emailable()))", "(_cdM.emailable && _cdM.emailable())")], ['S-pvmail'], ['pmailt']),
})
# (pvsched, 2026-11-05, the user: "Email + PDF tiles") over a pivot's tiles the Save records the tiles drawn (their size
# and setup) for the scheduled email; ptpar / ptpar2 dump the tiles with their rows and pivot (the kit's parity check)
SCN = SCN + ['pvsave', 'ptpar', 'ptpar2']
CHK['pvsave'] = ['tilesSaved']
CHK['ptpar'] = ['dumped']
CHK['ptpar2'] = ['dumped']
GUARDS |= {'L-ptpar-dumped', 'L-ptpar2-dumped'}   # (pvsched: a dump of the tiles, as on live)
NEW_PVSCHED = {'L-pvsave-tilesSaved'}
NEW = NEW | NEW_PVSCHED   # (pvsched) after every later round's NEW line - add, never replace
NEW = NEW - NEW_PVSCHED   # (pvsched is LIVE since 6636ed1, 2026-11-05: old checks now)
MUTANTS.update({
    'ps-saved': ([('cards', "return { open: 1, tiles: tv }; }", "return { open: 1 }; }")], ['L-pvsave-tilesSaved'], ['pvsave']),   # (pvsched) the Save's tiles gone
})
_static_checks_before_csweep3 = static_checks
def static_checks(t):
    out = _static_checks_before_csweep3(t)
    cd, m, ix = t['cards'], t['main'], t['index']
    ok = ('function notesOutOk() { return !!(P.journalNotesOut && P.journalNotesOut()); }' in cd and '(notesOn && !compact && notesOutOk())' in cd
          and 'if (H.inGroup() && boardOn()) {' in cd and "a.style.display === 'none' || a.classList.contains('pnb-gl-off')" in cd
          and '_prepC' not in m and m.count('if (_pnbCopyCards()) break;') == 1
          and "querySelectorAll('.pnb-card:not(.is-total)')" in cd and 'laid out as an emailed report shows them' in ix and 'csweep3 (2026-11-05' in t['readme'])
    out.append(('S-csweep3', bool(ok), 'csweep3: the notes gate, the Board lanes, the List off groups, no wait before the copy, the note, README'))
    return out
MUTANTS.update({
    # (csweep3) the notes always / a Board as its leaf groups again / the List's hidden groups copied
    'w3-notes': ([('cards', "(notesOn && !compact && notesOutOk())", "(notesOn && !compact)")], ['L-cnote-mailNotesOff', 'S-csweep3'], ['cnote']),
    'w3-board': ([('cards', "        if (H.inGroup() && boardOn()) {", "        if (false) {")], ['L-gbcopy-laneCards', 'L-gbcopy-laneToast', 'S-csweep3'], ['gbcopy']),
    'w3-more': ([('cards', "mc = mw ? mw.querySelectorAll('.pnb-card:not(.is-total)') : []", "mc = mw ? mw.querySelectorAll('.pnb-card') : []")], ['L-pw5more-moreFocusRow'], ['pw5more']),
    'w3-list': ([('cards', " || a.classList.contains('pnb-gl-off')) { gone = true; break; }", ") { gone = true; break; }")], ['L-ggcopy-listOnly', 'S-csweep3'], ['ggcopy']),
})
_static_checks_before_pvcopy = static_checks
def static_checks(t):
    out = _static_checks_before_pvcopy(t)
    cd, m, ix = t['cards'], t['main'], t['index']
    ok = ('function pivotMailHtml(opts) {' in cd and 'function tilesCopyable() {' in cd
          and 'if (tilesCopyable()) return pivotMailHtml({ budget: opts.budget > 0 ? opts.budget : 0 });' in cd
          and 'copyable: copyable, inTiles: tilesCopyable,' in cd
          and "if (C && typeof C.copyable === 'function' && typeof C.copyHtml === 'function') return !!C.copyable();" in m
          and "$('#copyHtmlTilesNote').css('display', tiles ? 'block' : 'none');" in m
          and 'id="copyHtmlTilesNote"' in ix and 'Tiles show, so this copies the tiles as cards' in ix and 'pvcopy (2026-11-05' in t['readme']
          and "a pivot's tiles too, the Grand Total last" in t.get('cptopic', '') and 'Pivot tiles copy as the pivot table' not in t.get('cptopic', '')
          and '—' not in (re.search(r'<small id="copyHtmlTilesNote"[^>]*>([^<]*)</small>', ix) or [None, '—'])[1])
    out.append(('S-pvcopy', bool(ok), 'pvcopy: the tiles copy (pivotMailHtml, its gate, the API), main.js asks copyable, the tiles note, README'))
    return out
MUTANTS.update({
    # (pvcopy) the table copied over tiles again / the gate without tiles / the tiles' note beside the cards' / no Grand
    # Total / only the drawn tiles / the field labels dropped
    'pv-branch': ([('cards', "        if (tilesCopyable()) return pivotMailHtml({ budget: opts.budget > 0 ? opts.budget : 0 });", "        if (false) return null;")], ['L-pcopy-tilesCards', 'L-pcopy-tilesToast'], ['pcopy']),
    'pv-gate': ([('cards', "function copyable() { return !!(on() && (emailable() || tilesCopyable())); }", "function copyable() { return !!(on() && emailable()); }")], ['L-pcopy-tilesWords', 'L-pcopy-tilesCards'], ['pcopy']),
    'pv-note': ([('main', "        if (tiles) $('#copyHtmlCardsNote').css('display', 'none');", "        void 0;")], ['L-pcopy-tilesWords'], ['pcopy']),
    'pv-total': ([('cards', "            if (foot) html += pvTile(foot, -1, measures, compact, true, ps0);", "            void 0;")], ['L-pcopy-tilesCards', 'L-pcopy-tilesTotalLast', 'L-pcopymore-totalLast'], ['pcopy', 'pcopymore']),
    'pv-drawn': ([('cards', "            for (i = 0; i < trs.length; i++) if (trs[i].style.display !== 'none') html += pvTile(trs[i], -1, measures, compact, false, ps0);", "            for (i = 0; i < trs.length && i < drawn.limit; i++) if (trs[i].style.display !== 'none') html += pvTile(trs[i], -1, measures, compact, false, ps0);")], ['L-pcopymore-allTiles'], ['pcopymore']),
    'pv-labels': ([('cards', "fh += '<tr>' + (nl ? '' :", "fh += '<tr>' + (true ? '' :")], ['L-pcopy-tilesParts'], ['pcopy']),
})

# (mailhid, 2026-11-05, the user's emailed pivot cards) a value its highlight paints in its own fill mails blank, its line
# kept: the flat cards' (chid) and a pivot's tiles' (pmhid) email; a value ruled in two colours keeps them (hidKept holds on live)
SCN = SCN + ['chid', 'pmhid']
CHK['chid'] = ['hidBlank', 'hidLine', 'hidKept']
CHK['pmhid'] = ['hidBlank', 'hidLine', 'hidKept']
NEW_MAILHID = {'L-chid-hidBlank', 'L-pmhid-hidBlank'}
NEW = NEW | NEW_MAILHID   # (mailhid) add, never replace
NEW = NEW - NEW_MAILHID   # (mailhid is LIVE since c4cc721, 2026-11-05: old checks now)
MUTANTS.update({
    # (mailhid) the flat cards' value / the tiles' value drawn as before (the square) / every two-colour value blanked
    'mh-val': ([('cards', "                if (mailHid(st(td))) return '&nbsp;';", "                if (false) return '&nbsp;';")], ['L-chid-hidBlank'], ['chid']),
    'mh-tile': ([('cards', "(mailHid(css(dds[k])) ? '&nbsp;' :", "(false ? '&nbsp;' :")], ['L-pmhid-hidBlank'], ['pmhid']),
    'mh-eq': ([('cards', r"c[1].replace(/\s+/g, '').toLowerCase() === b[1].replace(/\s+/g, '').toLowerCase()","c[1] !== '' && b[1] !== ''")], ['L-chid-hidKept', 'L-pmhid-hidKept'], ['chid', 'pmhid']),
})
# (tilegap, 2026-11-06) the tiles email (pivotMailHtml) keeps a blank column's line, as the tile on screen lists it
SCN = SCN + ['pvgap']
CHK['pvgap'] = ['gapLine', 'gapSame']
NEW_TILEGAP = {'L-pvgap-gapLine', 'L-pvgap-gapSame'}
NEW = NEW | NEW_TILEGAP   # (tilegap) add, never replace
NEW = NEW - NEW_TILEGAP   # (tilegap is LIVE since 31fc7e8, 2026-11-06: old checks now)
MUTANTS.update({
    # (tilegap) a blank column skipped again
    'tg-js': ([('cards', "                if (!fv && nl) continue;", "                if (!fv) continue;")], ['L-pvgap-gapLine', 'L-pvgap-gapSame'], ['pvgap']),
})
# (wcagser, 2026-11-06, WCAG 4.1.2) Stacked grouping in the cards: bandHead no longer makes the head a button (role,
# tabindex, aria-expanded): main.js's band IIFE owns that - the name the disclosure, the X Hide this group, siblings.
# gwcag: the head plain, one name + one X tab stop per band, the X a button in no button, Enter on the name folds (its
# aria-expanded follows), Shift+F10 on the name its menu. The suite's band toggle is the NAME now (tog / openOf / shut);
# gmenu's Shift+F10 / Escape moved from the head to the name with it (red on live: the head had it there).
SCN = SCN + ['gwcag']
CHK['gwcag'] = ['headNoRole', 'tabStops', 'hideButton', 'nameEnter', 'nameMenu']
NEW_WCAGSER = ({'L-gwcag-%s' % c for c in CHK['gwcag']} | {'L-gmenu-bandKeyboard'}) - GUARDS   # (bandRefocus holds on live: no menu, the focus never left the name)
NEW = NEW | NEW_WCAGSER   # (wcagser) add, never replace
# the head's own Enter is gone (main.js's name folds it): k-headkey has nothing to revert; k-head (no mark on the head) now
# loses Shift+F10 on the name; k-menutag re-anchored (Escape back to the name)
del MUTANTS['k-headkey']
MUTANTS['k-head'] = (MUTANTS['k-head'][0], ['L-gwcag-nameMenu', 'L-gmenu-bandKeyboard'], ['gwcag', 'gmenu'])
MUTANTS['k-menutag'] = ([('cards', "        if (rh) { if (!e.pnbCardMenu) e.pnbCardMenu = { kind: 'band', el: rh, focus: rh.querySelector('.group-name') || rh, card: null }; return; }", "        if (rh) { return; }")], MUTANTS['k-menutag'][1], MUTANTS['k-menutag'][2])
MUTANTS.update({
    # (wcagser) the head a button again (the fix reverted at one point): a button holding the name and X buttons, two tab stops
    'ws-head': ([('cards', "        if (!hd.classList.contains('pnb-cards-bandhead')) hd.classList.add('pnb-cards-bandhead');\n    }\n",
                  "        if (!hd.classList.contains('pnb-cards-bandhead')) hd.classList.add('pnb-cards-bandhead');\n        if (hd.getAttribute('tabindex') !== '0') hd.setAttribute('tabindex', '0');\n        if (hd.getAttribute('role') !== 'button') hd.setAttribute('role', 'button');\n        if (hd.getAttribute('aria-expanded') !== (open ? 'true' : 'false')) hd.setAttribute('aria-expanded', open ? 'true' : 'false');\n    }\n")],
                ['L-gwcag-headNoRole', 'L-gwcag-tabStops', 'L-gwcag-hideButton', 'L-gwcag-nameEnter'], ['gwcag']),
    # (wcagser) Shift+F10 keyed off the head again (the name's goes to nobody)
    'ws-namekey': ([('cards', "        var bh = bn ? bn.closest('.pnb-cards-bandhead') : null;", "        var bh = e.target && e.target.classList && e.target.classList.contains('pnb-cards-bandhead') ? e.target : null;")],
                   ['L-gwcag-nameMenu', 'L-gmenu-bandKeyboard'], ['gwcag', 'gmenu']),
})

def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

sys.path.insert(0, HERE)
import mk_harness
stage = tempfile.mkdtemp(prefix='pnb_cd_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
# the registry's theme CSS and ids (themes_config.php under test, else live)
emit = os.path.join(HERE, 'emit_themes.php')
th = json.loads(subprocess.run([PHP, '-n', '-d', 'display_errors=0', emit, src_root if os.path.exists(os.path.join(src_root, 'themes_config.php')) else APP], capture_output=True, text=True, encoding='utf-8').stdout)
open(os.path.join(stage, 'theme_vars.css'), 'w', encoding='utf-8').write(re.sub(r'</?style[^>]*>', '', th['css']))
open(os.path.join(stage, 'themes.js'), 'w', encoding='utf-8').write('window.__THEMES = ' + json.dumps(th['themes']) + ';\n')
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

def run_page(path, metrics=None, shot=None):
    t = jget('/json/new?about:blank', 'PUT')
    media = ['screen']   # (cprint) the media the page asked for
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Page.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        if metrics:
            mr = call('Emulation.setDeviceMetricsOverride', dict(metrics, screenWidth=metrics['width'], screenHeight=metrics['height']))
            call('Emulation.setTouchEmulationEnabled', {'enabled': True})
            if os.environ.get('PNB_INFO'): print('  metrics ->', mr)
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            ask = None if v else call('Runtime.evaluate', {'expression': 'JSON.stringify([window.__WANTMEDIA || null, window.__WANTPDF || 0])', 'returnByValue': True}).get('result', {}).get('value')
            if ask:   # (cprint) the page asks for print media, or a PDF of itself
                wm, wp = json.loads(ask)
                if wm and wm != media[0]: call('Emulation.setEmulatedMedia', {'media': wm if wm != 'screen' else ''}); media[0] = wm
                if wp:
                    pr = call('Page.printToPDF', {'preferCSSPageSize': True, 'printBackground': True})
                    raw = base64.b64decode(pr.get('data') or '')
                    if os.environ.get('PNB_PDF_OUT'): open(os.environ['PNB_PDF_OUT'], 'wb').write(raw)   # (a look at it)
                    mb = re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', raw)
                    info = {'pages': len(re.findall(rb'/Type\s*/Page(?![a-zA-Z])', raw)), 'w': float(mb.group(3)) - float(mb.group(1)) if mb else 0, 'h': float(mb.group(4)) - float(mb.group(2)) if mb else 0, 'bytes': len(raw)}
                    call('Runtime.evaluate', {'expression': 'window.__WANTPDF = 0; window.__PDFINFO = %s;' % json.dumps(info)})
            if v:
                if os.environ.get('PNB_DUMP'):   # (pvsched) a scenario's whole result, for the kit's parity check
                    _dm = re.search(r'scn=(\w+)', path)
                    open(os.path.join(os.environ['PNB_DUMP'], (_dm.group(1) if _dm else 'scn') + '.json'), 'w', encoding='utf-8').write(v)
                if shot:
                    time.sleep(0.4)
                    data = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}).get('data')
                    if data: open(shot, 'wb').write(base64.b64decode(data))
                return json.loads(v)
        tr = call('Runtime.evaluate', {'expression': 'JSON.stringify({errors: window.__errors, q: window.__queryDone, h: window.__HC_HIDES, step: window.__step})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout; %s' % tr}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

_static_before_viewstrict = None
_static_before_cardlink = static_checks
def static_checks(t):   # (cardlink) the shortcut sheet, Quick actions, the page menu, the help, the README
    out = _static_before_cardlink(t)
    main, pal, wsm = t['main'], t['pal'], t.get('wsmenu', '')
    out.append(('S-cardlink', "row(['Alt+Shift+L'], 'Copy a link to this view" in main and "id: 'cardlink'" in pal and "keys: ['Alt', 'Shift', 'L'], icon: { pal: 'link' }" in pal
                and 'function linkKey(e)' in wsm and "note: 'Alt+Shift+L'" in wsm and 'id="vl-card"' in t['vltopic']
                and '<strong>Copy link to this view</strong> (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>)' in t['ustopic'] and 'cardlink (2026-11-05' in t['readme']
                and '\u2014' not in t['vltopic'], 'the sheet row, the palette rows, the hotkey, the help, the README'))
    return out

_static_before_viewstrict = static_checks
def static_checks(t):   # (viewstrict) the help, Quick actions, the page menu, the README
    out = _static_before_viewstrict(t)
    out.append(('S-viewstrict', "id: 'viewkeep'" in t['pal'] and "id: 'viewleave'" in t['pal'] and "function visitItem(which)" in t.get('wsmenu', '')
                and '<strong>Keep this as my view</strong>' in t['vltopic'] and '<strong>Leave the shared view</strong>' in t['vltopic'] and 'viewstrict (2026-11-05' in t['readme']
                and 'function linkVisit()' in t.get('calc', '') and '—' not in t['vltopic'], 'Quick actions, the page menu, the help, the README, calc'))
    return out

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    hh = mk_harness.build(texts['index'])   # (cardlink) the page menu's module for the ckl / gkl / pkl scenarios (Alt+Shift+L)
    hh = hh.replace('<script src="driver.js"></script>', '<script>if (/^(ckl|gkl|pkl|vst)/.test(new URLSearchParams(location.search).get("scn") || "")) document.write(\'<script src="penumbra_wsmenu.js"></scr\' + \'ipt>\');</script>\n<script src="driver.js"></script>', 1)
    w('harness.html', hh)
    w('penumbra_wsmenu.js', texts['wsmenu'])
    w('penumbra_calc.js', texts['calc'])   # (viewstrict) over the LIBS copy (live's)
    w('main_hc.js', hook(texts['main']))
    w('penumbra_cards.js', texts['cards'] or '// (control: no card view)\n')
    w('penumbra_cards.css', texts['cardscss'])
    w('main.css', texts['maincss'])
    w('penumbra_colmenu.js', texts['menu'])   # (cmenu) the engine under test (the LIBS copy above is live's)
    w('penumbra_find.js', texts['find'])   # (round K) Find under test (cfind / gfind load it)
    w('penumbra_presets.js', texts['presets']); w('penumbra_presets.css', texts['presetscss'])   # (clay) the preset engine under test (clay1)

def url_for(s, token=None):
    u = 'harness.html?scn=%s&id=lrfix' % s
    if s == 'cperf': u += '&rows=1000'
    if s == 'cmore': u += '&rows=2500'
    if s == 'cfmtbig': u += '&rows=2500'   # (cfmt2)
    if s == 'cvlT': u += '&view=' + T_NOCV
    if s in ('cvlB', 'cszvlB', 'cvlD', 'cvlF', 'pvlB', 'pvcfgB', 'gboardvl') and token: u += '&view=' + token
    if s == 'cxlvl': u += '&view=' + T_XL
    if s == 'curl1': u += '&cards=1&cardsize=xl'   # (curl)
    if s == 'curl2': u += '&cards=1'
    if s == 'curl3': u += '&cards=0'
    if s == 'curl4': u += '&view=' + T_CV
    if s == 'gboardbig': u += '&rows=2500'   # (bdlay2) six lanes past the step
    if s == 'gw2band': u += '&rows=2500'   # (csw2) Stacked bands past the step
    if s == 'gbandbig': u += '&rows=2500'   # (cband) six Stacked bands past the step
    return u
PHONE = {'width': 375, 'height': 812, 'deviceScaleFactor': 1, 'mobile': True}
def run_browser(scns):
    out, res = [], {}
    for s in scns:
        token = None
        if s in ('cvlB', 'cszvlB', 'cvlD', 'cvlF', 'pvlB', 'pvcfgB', 'gboardvl'):
            token = ((res.get({'cvlB': 'cvlA', 'cszvlB': 'cszvlA', 'cvlD': 'cvlC', 'cvlF': 'cvlE', 'pvlB': 'pvlA', 'pvcfgB': 'pvcfg', 'gboardvl': 'gboard'}[s]) or {}).get('info') or {}).get('token') or 'none'
        shot = os.path.join(shots_dir, s + '.png') if shots_dir else None
        uu = url_for(s, token)
        if s in CKL:   # (cardlink) the link its maker built, and the record it names (its V_ID)
            inf = ((res.get(CKL[s][0]) or {}).get('info') or {})
            uu += '&view=' + (inf.get(CKL[s][1]) or 'none') + '&want=' + urllib.parse.quote(str(inf.get(CKL[s][2] if len(CKL[s]) > 2 else 'want') or ''))
        r = run_page(uu, PHONE if s in ('cphone', 'cnarrowA', 'cnarrowT', 'cnarrowN', 'cdetph', 'cxl2ph', 'cdensph') else None, shot); res[s] = r
        if shots_dir and s in ('cauto', 'gcards', 'gcoll', 'ggcards', 'csize', 'pcoff', 'cxl', 'cmenu', 'gmenu', 'pmenu', 'cdet', 'pdet', 'cnote'):   # the same page under a dark theme (csize: compact)
            run_page(url_for(s) + '&theme=theme-dark-blue&shot=1', None, os.path.join(shots_dir, s + '_dark.png'))
        if shots_dir and s in ('pcoff', 'cxl', 'cxl2', 'ccolsview', 'gboard', 'gcards', 'cmenu', 'gmenu', 'pmenu', 'cdet', 'pdet', 'cmword', 'curl1', 'cnote'):   # the light picture too, posed by the scenario's shot branch (the full run moves on past it)
            run_page(url_for(s) + '&shot=1', None, os.path.join(shots_dir, s + '_shot.png'))
        if shots_dir and s == 'cdetph':   # (cdet) the phone sheet, open
            run_page(url_for(s) + '&shot=1', PHONE, os.path.join(shots_dir, s + '_shot.png'))
        if r.get('fatal'):
            out.append(('F-' + s, False, r['fatal'][:3000])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}; info = r.get('info') or {}
        if r.get('fail'): info = dict(info, scenarioThrew=r['fail'][:400])   # the scenario's own exception (its later checks stay unset = red)
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s   info %s' % (v, json.dumps(info)[:900]) if (v is not True or os.environ.get('PNB_INFO')) else ''))   # PNB_INFO=1: info on every check
    return out

try:
    cand = {k: pick(v) for k, v in RELS.items()}
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % src_root)
    scns = scn_only.split(',') if scn_only else SCN
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, ms = MUTANTS[m]
            t = mutate(texts, m); write_stage(t)
            res = run_browser(ms) + static_checks(t)
            red = [a for a, p, _ in res if not p]
            dead = [a for a, p, _ in res if a.startswith('F-') and not p]
            good = not dead and all(x in red for x in must)
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]%s' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red), ('  DEAD ' + ' '.join(dead)) if dead else ''))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(scns)
        if not scn_only: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd[:900]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            red = {a for a, passed, _ in res if not passed}
            seen = {a for a, _, _ in res}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            old_red = sorted(a for a in red if a not in NEW)
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