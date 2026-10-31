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
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, zlib
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_colfmt.js', 'penumbra_calc.js',
        'penumbra_colwidths.js', 'penumbra_colmenu.js']
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
        'pftopic': os.path.join('help', 'topics', 'powerFeaturesHelpLightbox.php'), 'sptopic': os.path.join('help', 'topics', 'savePrefsHelpLightbox.php')}
def read_b(p):
    if not os.path.exists(p): return ''
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
T_NOCV = tok({'v': 1, 'm': 'flat', 'o': 'none'})   # a link without the card view: the table (the link wins over a saved pick)
T_XL = tok({'v': 1, 'm': 'flat', 'o': 'none', 'cv': 1, 'cz': 'xl'})   # (cxl) a link to the cards at Extra large

SCN = ['cfmtbig', 'cfmt', 'cauto', 'cguess', 'cpage', 'cfull', 'chl', 'cbar', 'cesc', 'coff', 'cviewer', 'pcoff', 'gcards', 'gcoll', 'gncoll', 'ggcards', 'gglnest', 'csize', 'cszvlA', 'cszvlB', 'cnarrowA', 'cnarrowT', 'cnarrowN', 'cauth', 'cauthB', 'cauthM', 'cvlA', 'cvlB', 'cvlT', 'ca11y', 'cphone', 'cperf', 'cmore',
       'cxl', 'cxlvl', 'cmenu', 'gmenu', 'pmenu', 'cmsize', 'gmsize', 'cdet', 'gdet', 'pdet', 'cdetph', 'cmword', 'curl1', 'curl2', 'curl3', 'curl4', 'cshare', 'cnote', 'cnotedet', 'ctmenu', 'cflink', 'ckword', 'cfind', 'gfind', 'cbarpick', 'csort', 'gsort', 'cempty', 'pfind', 'clayout', 'clayoutB', 'cdetrow', 'pvfind', 'cwhite', 'cdetpage', 'cdetmore', 'cseg', 'cxl2', 'cxl2ph', 'ccolsview', 'pvhtml', 'cfields', 'cfieldsB', 'gboard', 'cboard', 'cboardload', 'cbarrank', 'cvlC', 'cvlD']
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
    'chl': ['ruledPills', 'plainPills', 'pillMatchesCell'],
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
    'pcoff': ['pivotShown', 'switchShownInPivot', 'tilesCount', 'totalTile', 'tileTitle', 'tileBig', 'tileFields', 'foldFollowed', 'drillForward', 'backAfterExit'],
    'gcards': ['grouped', 'groupCount', 'groupNames', 'groupCounts', 'groupAgg', 'groupCards', 'totalCards', 'searched'],
    # (gfold) the bands fold as the table's: a band click, Enter on a band, Collapse all / Expand all, the fold kept across Table <-> Cards, a nested branch
    'gcoll': ['bandsOpen', 'bandClick', 'bandAgain', 'bandKey', 'collapseAll', 'expandAll', 'keptAcrossViews', 'focusKept'],
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
    'cnote': ['autoDraw', 'refreshFollows', 'fullText', 'label', 'buttons', 'oneLine', 'quietIcons', 'capConsistent', 'showAll', 'textClickStays', 'addOpens', 'composeOpens', 'escKeeps', 'carried', 'post', 'postKeepsShape', 'editOlder', 'topAligned', 'dblEdit', 'cardWording', 'capOff', 'reply', 'edit', 'del', 'menuAddNote', 'paletteNote', 'hiddenNone'],
    'cnotedet': ['inDetails', 'addInDetails', 'escComposerFirst', 'escThenCloses', 'postInDetails', 'compactViaDetails'],
    # (round I, cardsmenu) the table's own menus while the report offers cards: Show as cards (the sizes, the current one
    # ticked; This row as a card from a value), a size picked, a row's details, a heading's list without the row; (round N)
    # no size ticked while the table shows, Configure cards... last
    'ctmenu': ['flyout', 'noneTicked', 'pickSize', 'rowCard', 'headerFlyout'],
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
    'csort': ['listShown', 'sortSized', 'pickSorts', 'arrowShown', 'flip', 'readsBack', 'noneClears', 'tableHides'],
    'gsort': ['bandsSorted', 'menuSortFollows'],
    # (cempty) a blank field off its card, a filled one on; the other field always
    'cempty': ['blankOff', 'filledOn', 'otherKept'],
    # (pvfind) a row label marked on its tile, a value on its tile and outlined; in Compact a value the tile does not
    # show named on it; the search's marks on the tiles' labels; no Sort list over tiles
    'pfind': ['labelMarked', 'valueMarked', 'compactNamed', 'filterOnTiles', 'sortHidden'],
    # (clayout, round N) Settings > Cards: one button; Configure cards (Quick actions' openConfig): a title and fields picked
    # (drawn, kept as the viewer's whole setup, never the report's), Use the report's; a round L layout seeded: drawn on
    # load, shown in the window, the report's untouched
    'clayout': ['sectionGone', 'paletteOpens', 'titlePicked', 'fieldsPicked', 'keptAsPref', 'authorUntouched', 'resetBack'],
    'clayoutB': ['seededDrawn', 'formIsAuthors', 'seededShown'],
    # (the sweep) the details window keeps its row: a sort moves it, the window follows; a page turn closes it
    'cdetrow': ['sortFollows', 'pageCloses'],
    # (round M) a three-measure pivot in Compact: a value the tile does not show is named as the tile's field is (the
    # column path and the measure)
    'pvfind': ['namedAsField'],
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
    'gboard': ['boardShown', 'lanesSideBySide', 'noPageScroll', 'laneCards', 'oneColumn', 'cardsWhole', 'chipBoard', 'boardByRow', 'keysLanes', 'detailsAcross', 'laneFold', 'laneMenu', 'boardByPick', 'leaveKeeps'],
    'cboard': ['guessPill', 'enterGroups', 'leaveUngroups', 'reenter', 'ungroupFlips'],
    'cboardload': ['loadGroups'],
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
    'pmenu': ['tileValueMenu', 'tileNoGrid', 'tileLabelMenu', 'totalTileMenu', 'tileConfigOff', 'segCfgOff', 'tableCfgOff', 'tileWhiteLabel', 'tileShowTable'],
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
    'cshare': ['noCvOnTable', 'cardsForce', 'standardNoCz'],
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
    'cvlC': ['setupDrawn', 'carriesSetup', 'included', 'described', 'emailCarries', 'noneOnTable', 'cleaned', 'emptyDropped'],
    'cvlD': ['bootsSetup', 'layoutIsLinks', 'prefUntouched', 'labelsOff', 'windowShowsLink'],
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

MUTANTS = {
    # (cfmt2) the frame's timestamp read as `again` again; that and main.js's hooks; the format pass's hook alone; the menu
    # naming the stored value; the old button words
    'g-raf': ([('cards', "raf = window.requestAnimationFrame(function () { draw(); });", "raf = window.requestAnimationFrame(draw);")], ['L-cfmt-firstDrawOnce'], ['cfmt']),
    'g-nodraw': ([('cards', "raf = window.requestAnimationFrame(function () { draw(); });", "raf = window.requestAnimationFrame(draw);"),
                  ('main', "                _pnbCardsFormatted();   // (cfmt2) the cards were drawn before this pass: drawn again from the styled cells\r\n", "")], ['L-cfmtbig-bigRuled'], ['cfmtbig']),
    'g-hook': ([('main', "                _pnbCardsFormatted();   // (cfmt2) the cards were drawn before this pass: drawn again from the styled cells\r\n", "")], ['L-cfmtbig-hookRedraw'], ['cfmtbig']),
    'g-menu': ([('menu', "cell.td.hasAttribute('data-pnb-raw')) ? (cell.td.textContent.replace(/\\s+/g, ' ').trim() || cv) : cv;", "cell.td.hasAttribute('data-pnb-raw')) ? cv : cv;")], ['L-cfmt-menuShown'], ['cfmt']),
    'g-words': ([('cards', "pnb-ccfg-reset\">Reset my cards</button>", "pnb-ccfg-reset\">Use the report\\'s</button>")], ['L-cfmt-buttonWords'], ['cfmt']),
    # (cfmt) the values wearing nothing again; the column options' hooks gone; the module's hook renamed
    'f-val': ([('cards', "    function valStyle(td) { return styleOf(td, VAL_PROPS); }", "    function valStyle(td) { return ''; }")], ['L-cfmt-titleRuled', 'L-cfmt-subRuled', 'L-cfmt-bigRuled', 'L-cfmt-fieldRuled', 'L-cfmt-detRuled'], ['cfmt']),
    'f-hlhook': ([('main', "        try { applyConditionalFormatting(true); } catch (e) { console.warn('highlight:', e); }\r\n        _pnbCardsFormatted();   // (cfmt)\r\n", "        try { applyConditionalFormatting(true); } catch (e) { console.warn('highlight:', e); }\r\n")], ['L-cfmt-liveRule'], ['cfmt']),
    'f-opthook': ([('main', "        _pnbCardsFormatted();   // (cfmt) a format / click filter / deep link: the cells written again\r\n", "")], ['L-cfmt-liveFormat'], ['cfmt']),
    'f-api': ([('cards', "        formatted: formatted,   // (cfmt)", "        formattedX: formatted,   // (cfmt)")], ['L-cfmt-liveRule', 'L-cfmt-liveFormat'], ['cfmt']),
    # (round T) Configure cards over a pivot: the button enabled / hidden again, its line gone; the tile menu's / the pivot
    # table's greyed item gone
    't-segoff': ([('cards', "                cb.disabled = pvoff;", "                cb.disabled = false;")], ['L-pmenu-segCfgOff'], ['pmenu']),
    't-seghide': ([('cards', "                cb.hidden = !allowed();", "                cb.hidden = !canConfig();")], ['L-pmenu-segCfgOff'], ['pmenu']),
    't-segnote': ([('cards', "            if (cn) cn.hidden = !(allowed() && H.inPivot());", "            if (cn) cn.hidden = true;")], ['L-pmenu-segCfgOff'], ['pmenu']),
    't-menuoff': ([('cards', "        else out.push({ act: 'cardConfig', label: 'Configure cards...', disabled: true, why: PIVOT_NOCFG });   // (round T) greyed, its reason\n", "")], ['L-pmenu-tileConfigOff'], ['pmenu']),
    't-tableoff': ([('cards', "            else out.push('-', { act: 'showCardsConfig', label: 'Configure cards...', disabled: true, why: PIVOT_NOCFG });   // (round T) greyed, its reason\n", "")], ['L-pmenu-tableCfgOff'], ['pmenu']),
    # (round S) the board: not a view that draws cards / not drawn / no grouping asked / leaving keeps what it made / never
    # its own / the keys / Board by / the pill's guess / an ungroup elsewhere kept / lanes stacked; main.js's view and kept
    # column; the switch's option; the chip
    's-on': ([('cards', "return offered() && (v === 'cards' || v === 'board'); }", "return offered() && (v === 'cards'); }")], ['L-gboard-boardShown', 'L-cboardload-loadGroups'], ['gboard', 'cboardload']),
    's-draw': ([('cards', "        } else if (board) {\n            html = boardHtml(", "        } else if (false) {\n            html = boardHtml(")], ['L-gboard-boardShown'], ['gboard']),
    's-ensure': ([('cards', "        boardGroupBy(want, true);\n", "")], ['L-cboard-enterGroups', 'L-cboardload-loadGroups'], ['cboard', 'cboardload']),
    's-leave': ([('cards', "            var b = document.getElementById('removeGroupingLink') || document.getElementById('ungroupBtn');\n            if (b) b.click();\n", "")], ['L-cboard-leaveUngroups'], ['cboard']),
    's-made': ([('cards', "        boardMade = made ? col : null;", "        boardMade = null;")], ['L-cboard-enterGroups', 'L-cboard-leaveUngroups'], ['cboard']),
    's-keys': ([('cards', "        if (boardOn() && /^Arrow(Up|Down|Left|Right)$/.test(k)) {", "        if (false) {")], ['L-gboard-keysLanes'], ['gboard']),
    's-boardby': ([('cards', "            else if (t.id === 'pnbCardsBoardBy' && t.value) boardGroupBy(", "            else if (false) boardGroupBy(")], ['L-gboard-boardByPick'], ['gboard']),
    's-guess': ([('cards', "        if (r.pill) { var dp = distinct(r.pill.name); if (dp >= 2 && dp <= 30) return r.pill.name; }\n", "")], ['L-cboard-guessPill'], ['cboard']),
    's-flip': ([('cards', "{ boardMade = null; boardWasGrouped = false; set('cards'); }", "{ boardMade = null; boardWasGrouped = false; }")], ['L-cboard-ungroupFlips'], ['cboard']),
    's-css': ([('cardscss', ".pnb-cards-board { display: flex; align-items: flex-start;", ".pnb-cards-board { display: block; align-items: flex-start;")], ['L-gboard-lanesSideBySide'], ['gboard']),
    's-mainview': ([('main', "(e.view === 'cards' || e.view === 'table' || e.view === 'board')) ? e.view : null;", "(e.view === 'cards' || e.view === 'table')) ? e.view : null;")], ['L-cboardload-loadGroups'], ['cboardload']),
    's-mainkeep': ([('main', "return (e && typeof e.board === 'string' && e.board) ? e.board : null;", "return null;")], ['L-cboard-enterGroups', 'L-cboardload-loadGroups'], ['cboard', 'cboardload']),
    's-switch': ([('index', '<button type="button" class="pnb-cseg-opt" role="radio" aria-checked="false" data-view="board" tabindex="-1"><span class="pnb-cseg-label">Board</span></button>', '')], ['L-gboard-chipBoard', 'L-cboard-enterGroups'], ['gboard', 'cboard']),
    's-rows': ([('cardscss', "#pnbCardsHost.is-board .pnb-cards-lane > .pnb-cards-grid { grid-auto-rows: max-content; align-content: start; }\n", "")], ['L-gboard-cardsWhole'], ['gboard']),   # (the squashed cards the picture showed)
    's-contain': ([('cards', "document.body.classList.toggle('pnb-board-on', board);", "document.body.classList.toggle('pnb-cards-board', board);")], ['L-gboard-noPageScroll'], ['gboard']),   # (the class collision the picture showed: <body> a flex row)
    's-chip': ([('cards', "var t = v ? (view === 'board' ? 'Board' : 'Cards') : 'Table';", "var t = v ? 'Cards' : 'Table';")], ['L-gboard-chipBoard'], ['gboard']),
    # (round R) four fields again (the module, main.js's own cut); Show field labels: clean() dropping it, the draw ignoring
    # it, the value's title gone, the hidden label shown, the window not writing it / not showing it, main.js not keeping
    # it, Extra large's value columns misplaced
    'r-max': ([('cards', "    var MAX_FIELDS = 12; ", "    var MAX_FIELDS = 4; ")], ['L-cfields-reportTen', 'L-cfields-tenDrawn'], ['cfields']),
    'r-mainslice': ([('main', "o.fields = v.fields.slice(0, 12);", "o.fields = v.fields.slice(0, 4);")], ['L-cfields-windowCount'], ['cfields']),
    'r-clean': ([('cards', "        if (cfg.nolabels === 1 || cfg.nolabels === true) o.nolabels = 1;   // (round R) Show field labels off\n", "")], ['L-cfields-labelsOff', 'L-cfields-labelsDefault'], ['cfields']),
    'r-draw': ([('cards', "'<dl class=\"pnb-card-fields' + (r.nolabels ? ' is-nolabels' : '') + '\">'", "'<dl class=\"pnb-card-fields' + '\">'")], ['L-cfields-labelsOff'], ['cfields']),
    'r-title': ([('cards', "(r.nolabels ? ' title=\"' + esc(r.fields[i].friendly) + '\"' : '')", "''")], ['L-cfields-labelsOff'], ['cfields']),
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
    'cb-noemail': ([('main', "            if (!v.cl) { var clOpt = _pnbCardSetupNow(); if (clOpt) v.cl = clOpt; }   // (clbar) the sender's setup, from the table too\n", "")], ['L-cvlC-emailCarries'], ['cvlC']),
    'cb-noapply': ([('main', "        if (v.cl) { _pnbViewSessEntry = _pnbViewSessEntry || {}; _pnbViewSessEntry.cards = JSON.parse(JSON.stringify(v.cl)); }   // (clbar) the link's card setup is this visit's own (cardsHost.layoutGet)\n", "")], ['L-cvlD-bootsSetup', 'L-cvlD-layoutIsLinks'], ['cvlC', 'cvlD']),
    'cb-noclean': ([('main', "        if (Array.isArray(c.fields)) { var f = c.fields.map(nm).filter(Boolean).slice(0, 12); if (f.length) o.fields = f; }", "        if (Array.isArray(c.fields)) { var f = c.fields.map(nm).filter(Boolean).slice(0, 50); if (f.length) o.fields = f; }")], ['L-cvlC-cleaned'], ['cvlC']),
    'cb-nolist': ([('main', "        if (v.cl) inc.push('card setup');\n", "")], ['L-cvlC-included'], ['cvlC']),
    'cb-nodesc': ([('main', "        if (v.cl) out.push('your card setup');\n", "")], ['L-cvlC-described'], ['cvlC']),
    'cb-linear': ([('cards', "        var pr = rankPct(Math.abs(v), max.vals); if (Math.abs(v) > 0 && pr < 2) pr = 2;   // (clbar) a value shows; a zero draws nothing\n", "        var pr = Math.abs(v) / max.max * 100;\n")], ['L-cbarrank-ranked', 'L-cbarrank-spread', 'L-cbarrank-medianHalf', 'L-cfull-barFallback'], ['cbarrank', 'cfull']),
    'cb-ties': ([('cards', "        return (a + b) / 2 / (n - 1) * 100;\n", "        return a / (n - 1) * 100;\n")], ['L-cbarrank-ranked'], ['cbarrank']),
    'cb-floor': ([('cards', " if (Math.abs(v) > 0 && pr < 2) pr = 2;   // (clbar) a value shows; a zero draws nothing\n", "\n")], ['L-cbarrank-ranked'], ['cbarrank']),
    'cb-sort': ([('cards', "        vals.sort(function (a, b) { return a - b; });\n", "")], ['L-cbarrank-ranked'], ['cbarrank']),
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
    'm-sortlist': ([('cards', "        var show = on() && !H.inPivot() && !!HM();\n        s.hidden = !show;", "        var show = false;\n        s.hidden = !show;")], ['L-csort-listShown'], ['csort']),
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
    'm-detcan': ([('cards', "        el.querySelector('.pnb-cdet-next').disabled = !detCan(1);", "        el.querySelector('.pnb-cdet-next').disabled = det.at >= n - 1;")], ['L-cdetpage-nextEnabled', 'L-cdetmore-posMore'], ['cdetpage', 'cdetmore']),
    'm-detcanlast': ([('cards', "        return g >= 0 && !!all[g + delta] && !!(P.findHost && typeof P.findHost.showRow === 'function');", "        return g >= 0;")], ['L-cdetpage-lastOff'], ['cdetpage']),
    'm-detposall': ([('cards', "                main = (g + 1).toLocaleString() + ' of ' + all.length.toLocaleString() + ' cards';", "                main = (det.at + 1).toLocaleString() + ' of ' + n.toLocaleString() + ' cards';")], ['L-cdetpage-posAll', 'L-cdetpage-posPage'], ['cdetpage']),
    'm-detpage': ([('cards', "                if (rpp > 0 && all.length > rpp) {", "                if (false) {")], ['L-cdetpage-posAll'], ['cdetpage']),
    'm-detmore': ([('cards', "        if (delta > 0 && det.at === detCount() - 1 && drawn.more > 0) {   // the next step of cards", "        if (false) {   // the next step of cards")], ['L-cdetmore-nextDraws'], ['cdetmore']),
    'm-detrowfirst': ([('cards', "        det.tr = to; sel = rowIdx(to);   // the window's row first: the redraw finds it on its page", "        sel = rowIdx(to);")], ['L-cdetpage-nextTurns'], ['cdetpage']),
    'm-seg': ([('cards', "            g.style.display = off ? '' : 'none';", "            g.style.display = 'none';")], ['L-cseg-segShown'], ['cseg']),
    'm-segchip': ([('cards', "            if (c) { var t = v ? (view === 'board' ? 'Board' : 'Cards') : 'Table';", "            if (c) { var t = 'Table';")], ['L-cseg-chipCards'], ['cseg']),   # (re-anchored, round S: the chip says Board too)
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
    'm-sortpivot': ([('cards', "        var show = on() && !H.inPivot() && !!HM();\n        s.hidden = !show;", "        var show = on() && !!HM();\n        s.hidden = !show;")], ['L-pfind-sortHidden'], ['pfind']),
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
    'm-layreset': ([('cards', "        try { H.layoutSet(null); } catch (e) { }\n        try { if (H.sizeSet) H.sizeSet(null); } catch (e) { }\n        size = null;\n        cfgPaint(); paintSize(); cfgRedraw();",
                     "        try { if (H.sizeSet) H.sizeSet(null); } catch (e) { }\n        size = null;\n        cfgPaint(); paintSize(); cfgRedraw();")], ['L-clayout-resetBack'], ['clayout']),
    # (round N, ccfg) Configure cards: the table's flyout ticking a size again; the card menu's / the table list's / the
    # Settings button's / the hotkey's way in gone; Escape not the window's; the cards not shown behind it; the focus not in
    # it; the pick not a WHOLE setup (the module's own flag, main.js's slots and flag); the default not made / the
    # editor's own kept / not removed / its size kept / an unsaved one lost on a re-run; a viewer offered the default
    'm-cfgtick': ([('cards', "return { act: 'showCards-' + s, label: sizeLabel(s), run: function () { showAs(s, null); } };", "return { act: 'showCards-' + s, label: sizeLabel(s), checked: curSize() === s, run: function () { showAs(s, null); } };")], ['L-ctmenu-noneTicked'], ['ctmenu']),
    'm-cfgmenu': ([('cards', "        if (!t.pivot) out.push({ act: 'cardConfig',", "        if (false) out.push({ act: 'cardConfig',")], ['L-cauth-menuOpens'], ['cauth']),
    'm-cfgtable': ([('cards', "            if (!H.inPivot()) out.push('-', { act: 'showCardsConfig',", "            if (false) out.push('-', { act: 'showCardsConfig',")], ['L-cauth-tableMenuOpens', 'L-ctmenu-noneTicked'], ['cauth', 'ctmenu']),
    'm-cfgkey': ([('cards', "String(e.key || '').toUpperCase() !== 'L') return;", "String(e.key || '').toUpperCase() !== 'Q') return;")], ['L-cauth-hotkeyToggles'], ['cauth']),
    'm-cfgesc': ([('cards', "        if (cfgOpen && esc && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); closeConfig(true); return; }\n", "")], ['L-cauth-escCloses'], ['cauth']),
    'm-cfgbehind': ([('cards', "        if (!on()) showAs(null, null);   // the cards behind the window: each pick shows at once\n", "")], ['L-cauth-cardsBehind'], ['cauth']),
    'm-cfgfocus': ([('cards', "        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }\n        return true;", "        return true;")], ['L-cauth-focusFirst', 'L-clayout-paletteOpens'], ['cauth', 'clayout']),
    'm-cfgown': ([('cards', "        var el = cfgEl(), o = { own: 1 }, i;", "        var el = cfgEl(), o = {}, i;")], ['L-cauth-keptAsPref', 'L-clayout-keptAsPref'], ['cauth', 'clayout']),
    'm-cfgmainown': ([('main', "                if (v && v.own) o.own = 1;   // (ccfg) the whole setup, even all Automatic\n", "")], ['L-cauth-keptAsPref'], ['cauth']),
    'm-cfgmainslots': ([('main', "                ['title', 'big', 'pill', 'bar'].forEach(function (k) { if (v && typeof v[k] === 'string' && v[k]) o[k] = v[k]; });\n", "                if (v && typeof v.title === 'string' && v.title) o.title = v.title;\n")], ['L-cauth-keptAsPref', 'L-cauth-drawnPicks'], ['cauth']),
    'm-cfgdefault': ([('cards', "        report = clean(o) || {};\n        defaultPending = true;", "        defaultPending = true;")], ['L-cauth-makeDefault', 'L-cauthB-reedit'], ['cauth', 'cauthB']),
    'm-cfgclearmine': ([('cards', "        report = clean(o) || {};\n        defaultPending = true;\n        try { H.layoutSet(null); } catch (e) { }\n", "        report = clean(o) || {};\n        defaultPending = true;\n")], ['L-cauth-defaultClearsMine', 'L-cauthB-reedit'], ['cauth', 'cauthB']),
    'm-cfgremove': ([('cards', "        report = null;\n        defaultPending = true;", "        defaultPending = true;")], ['L-cauth-removeDefault'], ['cauth']),
    'm-cfgsize': ([('cards', "        defaultPending = true;\n        size = null;   // the default's size went with it", "        defaultPending = true;\n        // the default's size went with it")], ['L-cauth-removeDefault'], ['cauth']),
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
                   ['L-cfind-filterOnCards', 'L-cfind-findOnCards', 'L-cfind-findBuriedNamed', 'L-gfind-bandMarked', 'L-gfind-filterMarked'], ['cfind', 'gfind']),
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
    'm-flyoutrow': ([('cards', "        for (var k = 0; k < cs.length; k++) if (parseInt(cs[k].getAttribute('data-row'), 10) === i) { focusAt = k; roving(); selectOnly(cs[k]); openDetails(cs[k]); return; }\n", "")], ['L-ctmenu-rowCard'], ['ctmenu']),
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
    'm-noteclick': ([('cards', "        if (e.target.closest('a, button, input, select, textarea, .journal-notes-btn, .journal-rownote-inline')) return;   // (cardnotes) the notes are read and written in place", "        if (e.target.closest('a, button, input, select, textarea, .journal-notes-btn')) return;")], ['L-cnote-textClickStays'], ['cnote']),
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
    'm-pvnofollow': ([('cards', "                clearTimeout(pvTimer); pvTimer = setTimeout(function () { if (H.inPivot()) { sync(); if (on()) draw(); } }, 60);", "                clearTimeout(pvTimer); pvTimer = setTimeout(function () { }, 60);")], ['L-pcoff-foldFollowed'], ['pcoff']),   # (a sync() left in would still schedule the draw)
    # the viewer's pick never kept
    'm-noprefs': ([('cards', "        try { if (H.prefSet) H.prefSet(v); } catch (e) { }\n", "")], ['L-cauto-prefSaved'], ['cauto']),
    # the guess ignores money columns (cguess: a plain number column shown before the money column)
    'm-guessbig': ([('cards', "                if (!money && pr && pr.isCurrency) money = shown[i];\n", "")], ['L-cguess-moneyOverNumber'], ['cguess']),
    # a group heading without its count
    'm-grouphead': ([('cards', "                + (cnt ? '<span class=\"pnb-cards-grpcount\">' + esc(cnt.textContent.replace(/\\s+/g, ' ').trim()) + '</span>' : '')\n", "")], ['L-gcards-groupCounts'], ['gcards']),
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
                        ['L-gcoll-bandClick', 'L-gcoll-bandKey', 'L-gncoll-branchFolds'], ['gcoll', 'gncoll']),
    # (glist) the List layout's pick ignored: every group's cards drawn
    # (csize) the size never applied to the host; compact drawing every part; the phone default gone; cz never captured / never applied
    'm-sizeignored': ([('cards', "        el.classList.toggle('is-compact', sz === 'compact');\n        el.classList.toggle('is-large', sz === 'large');\n", "")], ['L-csize-authorDefault', 'L-csize-viewerCompact'], ['csize']),
    'm-compactfull': ([('cards', "        var compact = curSize() === 'compact';   // (csize) no subtitle, bar, fields or notes", "        var compact = false;")], ['L-csize-compactParts'], ['csize']),
    'm-nophone': ([('cards', "        return (H.narrow && H.narrow() && !!report) ? 'cards' : 'table';", "        return 'table';")], ['L-cnarrowA-narrowOpensCards'], ['cnarrowA']),
    'm-nocz': ([('main', "            if (czNow === 'compact' || czNow === 'large' || czNow === 'xl') v.cz = czNow;\n", "")], ['L-cszvlA-carriesCz', 'L-cszvlB-bootsCompact'], ['cszvlA', 'cszvlB']),   # (re-anchored, cxl)
    'm-czapply': ([('cards', "        if (vl) return sizeOk(vl.size) ? vl.size : 'standard';", "        if (vl) return 'standard';")], ['L-cszvlB-bootsCompact'], ['cszvlA', 'cszvlB']),
    # (cxl) Extra large refused by the module / never classed / not carried by a link / not applied from one
    'm-noxl': ([('cards', "    function sizeOk(v) { return v === 'compact' || v === 'large' || v === 'xl'; }", "    function sizeOk(v) { return v === 'compact' || v === 'large'; }")], ['L-cxl-authorXl'], ['cxl']),
    'm-xlclass': ([('cards', "        el.classList.toggle('is-xl', sz === 'xl');   // (cxl)\n", "")], ['L-cxl-authorXl', 'L-cxl-twoPerRow'], ['cxl']),
    'm-xlcz': ([('main', "            if (czNow === 'compact' || czNow === 'large' || czNow === 'xl') v.cz = czNow;\n", "            if (czNow === 'compact' || czNow === 'large') v.cz = czNow;\n")], ['L-cxl-linkCz'], ['cxl']),
    'm-xlczapply': ([('main', "        if (d.cz === 'compact' || d.cz === 'large' || d.cz === 'xl') v.cz = d.cz;", "        if (d.cz === 'compact' || d.cz === 'large') v.cz = d.cz;")], ['L-cxlvl-bootsXl'], ['cxlvl']),
    # (cmenu) the right-click never forwarded to the cell (the card's own items alone) / the card's items gone / a card's empty area with the
    # whole column menu / the keys gone / the focus never named / a band not forwarded / the engine's hook gone / Shift+right-click taken
    'm-menuoff': ([('cards', "            t.el.dispatchEvent(ev);\n", "")], ['L-cmenu-valueMenu', 'L-cmenu-filterRuns'], ['cmenu']),
    'm-menuextras': ([('cards', "        out = out.concat(menuExtras(t, out.length > 0));\n", "")], ['L-cmenu-extras'], ['cmenu']),
    'm-menurow': ([('cards', "        if (t.kind === 'card' && !t.pivot) out = rowItems(out, t);\n", "")], ['L-cmenu-cardRowOnly'], ['cmenu']),
    'm-menukbd': ([('cards', "        if ((tog || inDet || (e.target && e.target.classList && e.target.classList.contains('pnb-card'))) && ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) {", "        if (false) {")], ['L-cmenu-keyboardOpens', 'L-gmenu-bandKeyboard'], ['cmenu', 'gmenu']),   # (re-anchored, cdet)
    'm-menufocus': ([('cards', "        if (cur) { cur.focusEl = t.focus; if (t.kbd) cur.kbd = true; }\n", "")], ['L-cmenu-escRefocus'], ['cmenu']),
    'm-menuband': ([('cards', "            return hdr ? { kind: 'band', el: hdr, focus: gt, card: null } : null;", "            return null;")], ['L-gmenu-bandMenu'], ['gmenu']),
    'm-enginehook': ([('menu', "            var adj = window.Penumbra.cards.menuItems(items, fromCard, cur);", "            var adj = null;")], ['L-cmenu-extras', 'L-cmenu-cardRowOnly'], ['cmenu']),
    # (menusel) any selection, blank or not, hands the card's right-click to the browser again (the user's live tab held a "\n")
    'm-menusel': ([('cards', "        if (sx && !sx.isCollapsed && String(sx).trim() !== '' && sx.containsNode && sx.containsNode(t, true)) return null;", "        if (sx && !sx.isCollapsed && sx.containsNode && sx.containsNode(t, true)) return null;")], ['L-cmsize-blankSelectionIgnored'], ['cmsize']),
    # (cmsize) the menus at every size: the host's size class never minds, so the mutant that would prove it is the size itself (m-xlclass)
    # (cdet) hidden columns listed / Next over every row of the table (the filter and the page ignored) / Escape gone / a click
    # opens nothing / a right-click inside not the cell's / the drill button clicks nothing / the phone sheet rule gone
    'm-dethidden': ([('cards', "            if (c.hidden || c.hash || c.journal) continue;\n            var tc = cellOf(tr, c);", "            if (c.hash || c.journal) continue;\n            var tc = cellOf(tr, c);")], ['L-cdet-noHidden', 'L-cdet-shownColumns'], ['cdet']),
    'm-detnext': ([('cards', "    function detRows() { return rowsDrawn.map(function (x) { return x.tr; }); }", "    function detRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }")], ['L-cdet-filtered'], ['cdet']),
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
    'm-sharecards': ([('main', "        if (opts && opts.cards) {\n            v.cv = 1;", "        if (false) {\n            v.cv = 1;")], ['L-cshare-cardsForce'], ['cshare']),
    'm-menushift': ([('cards', "        if (e.shiftKey && e.button === 2) return;   // the browser's own menu, as the engine leaves it\n", "")], ['L-cmenu-shiftKeepsBrowser'], ['cmenu']),
    # the 1,000-card step gone (every row drawn at once)
    'm-nocap': ([('cards', "    var CAP = 1000;                   // cards drawn per step", "    var CAP = 1000000;")], ['L-cmore-capped', 'L-cmore-moreButton'], ['cmore']),
    # the roving tab stop gone (every card a tab stop)
    'm-noroving': ([('cards', "        for (var i = 0; i < cs.length; i++) cs[i].tabIndex = (i === focusAt) ? 0 : -1;", "        for (var i = 0; i < cs.length; i++) cs[i].tabIndex = 0;")], ['L-cauto-oneTabStop'], ['cauto']),
    # the switch never hidden in the markup (shown before a report offers it)
    # (the penumbraSyncActiveLayout hook has no mutant since pvtiles: every pivot transition also mutates #pivot-output-container, which the tiles watch)
}

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
    out.append(('S-viewLink', "if (d.cv === 1 || d.cv === true) v.cv = 1;" in main and "window.Penumbra.cards.on()) {" in main and "['cv cz', 'card view']" in dtx and dtx.find("'cv") < dtx.find("'dn'") and "inc.push('card view')" in main and "out.push('shown as ' + (v.cz ? (v.cz === 'xl' ? 'extra large' : v.cz) + ' ' : '') + 'cards')" in main,
                'cv (+ cz) cleaned, captured, dropped first, listed, described (xl as extra large)'))
    # (cxl) the Extra large row, both option lists, the help; (cmenu) the engine's hook + openItems, the module's handler, the help + README
    menu = t['menu']
    out.append(('S-xlRows', "{ id: 'cardsize-xl', label: 'Card size: Extra large'" in pal and "setSize('xl')" in pal and "cardSize('xl')" in pal, 'the Extra large palette row'))
    out.append(('S-xlMarkup', idx.count('<option value="xl">') >= 1 and '<option value="xl">Extra large</option>' in idx and "e.size === 'xl'" in main and "v === 'xl'" in main, 'xl in the size control and the setup row; the pref reads and writes it'))
    out.append(('S-xlHelp', 'Extra large' in t['topic'] and 'Extra large' in t['tip'] and 'Card size: Compact / Standard / Large / Extra large' in t['topic'] and 'is-xl' in css, 'help topic + tip name Extra large; the css has it'))
    out.append(('S-menuHook', 'fromCard = e.pnbCardMenu || null;' in menu and 'window.Penumbra.cards.menuItems(items, fromCard, cur)' in menu and 'window.Penumbra.colMenu.openItems = function' in menu
                and 'function onHostMenu' in cards and 'menuItems: menuItems' in cards and "ev.pnbCardMenu = t;" in cards, 'the engine takes a card\'s forwarded right-click, asks the module for its items; openItems'))
    out.append(('S-menuHelp', 'Right-click a card' in t['topic'] and 'Right-click a card' in t['tip'] and 'cmenu' in t['readme'] and 'cxl' in t['readme'] and 'Shift' in t['topic'], 'help topic + tip + README name the menus'))
    # (cdet) the palette row, the help, the window's css + module
    out.append(('S-detRow', "{ id: 'carddetails', label: 'Open card details'" in pal and 'cards.openDetails()' in pal, 'the Open card details palette row'))
    out.append(('S-detHelp', 'Open card details' in t['topic'] and 'never a hidden column' in t['topic'] and 'Click a card for its details' in t['tip'] and 'cdet' in t['readme'], 'help topic + tip + README name the details window'))
    out.append(('S-wordHelp', 'speaks of fields' in t['topic'] and 'cardword' in t['readme'] and 'function cardContext(items)' in menu and 'var CARD_HIDE' in menu, 'help + README name the card wording; the engine has it'))
    # (curl) the email dialog's Open as cards row + its handling; the URL cleaner; the reserved params; the help
    out.append(('S-emailCards', 'id="emailLinkAsCards"' in idx and 'id="emailLinkCardSize"' in idx and 'id="emailCardsLinkRow"' in idx and "_lrUrl.searchParams.set('cards', '1')" in main
                and "_pnbViewLinkBuild(_pnbEmailLinkOpts())" in main and "urlParams.delete('cards'); urlParams.delete('cardsize');" in main and "_DL_RESERVED_PARAMS = { cards: 1, cardsize: 1," in main
                and "if (opts && opts.cards) {" in main, 'the email dialog\'s Open as cards (+ size) on the plain link and the view link; the URL cleaner and the reserved params know cards / cardsize'))
    out.append(('S-urlHelp', '&amp;cards=1' in t['topic'] and 'Open as cards' in t['topic'] and 'curl' in t['readme'] and 'var urlAsk' in cards, 'help + README name the URL parameters; the module reads them'))
    out.append(('S-detCss', '#pnbCardDetails .pnb-cdet-box' in css and 'max-width: 600px' in css and "el.id = 'pnbCardDetails';" in cards and 'help-lightbox pnb-cdet' in cards and "openDetails: function" in cards, 'the window: the app\'s dialog classes, the phone sheet, the API'))
    # (csize) the three size rows, the size control and the setup's size row, the help's size text
    out.append(('S-sizeRows', all(("{ id: 'cardsize-%s', label: 'Card size: %s'" % (s, s.capitalize())) in pal and ("setSize('%s')" % s) in pal for s in ('compact', 'standard', 'large')) and 'function cardSize(sz)' in pal, 'three Card size rows'))
    out.append(('S-sizeMarkup', 'id="pnbCardsSize"' in idx and idx.find('id="pnbCardsSize"') - idx.find('id="pnbCardsSwitch"') < 1200 and 'data-slot="size"' in (idx + cards) and 'value="compact"' in idx and 'value="large"' in idx, 'the size control beside the switch; the setup\'s Card size row'))
    out.append(('S-pvHelp', 'each pivot row is a tile' in t['topic'] and 'each pivot row is a tile' in t['tip'] and 'have no card form' not in t['topic'] and 'pivotHtml' in cards and "body.pnb-cards-on #pivotResultTable" in css, 'help names the pivot tiles; the module and css have them'))
    out.append(('S-sizeHelp', 'Card size' in t['topic'] and '600px or less' in t['topic'] and 'Card size' in t['tip'] and 'Card size: Compact / Standard / Large' in t['topic'], 'help topic + tip name the sizes and the phone default'))
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
    out.append(('S-roundL', 'Round L (2026-10-30' in t['readme'] and 'id="us-cards"' in t['ustopic'] and ('us-tip-card-layout' in t['tip'] or 'Round P (2026-10-30' in t['readme']) and 'Sort: none' in t['topic']
                and 'id="pnbCardsSort"' in idx and ('id="spCardsSection"' in idx or 'Round P (2026-10-30' in t['readme']) and 'layoutGet: function' in main and re.search(r"items\.push\('Card (title and fields|layout)'\)", main)
                and ("id: 'cardlayout'" in pal or "id: 'cardconfig'" in pal) and 'function paintSort(' in cards and 'function filled(' in cards and 'paintTileMarks(' in t['find'],
                'help + README name round L; the Sort list and Settings > Cards; the layout pref; the palette row; pivot tiles in Find'))
    # (round N) View Options' Cards card gone; Settings > Cards one button; the window (module + css); the help moved
    # (topic, tips, the Ctrl+Shift+L row, the manifest's card words); the palette row + the cheat sheet; README
    sec = re.search(r'<div class="sp-section sp-cards-section" id="spCardsSection" hidden>.*?</div>\s*</div>', idx, re.S)
    out.append(('S-roundN', 'Round N (2026-10-30' in t['readme'] and 'pnb-cards-vo' not in idx and 'id="pnbCardsSetup"' not in idx and ((bool(sec) and 'id="spCardConfigBtn"' in sec.group(0)) or ('Round P (2026-10-30' in t['readme'] and not sec))
                and 'vo-cards' not in vtopic and "Make default for everyone" in t['ustopic'] and "Make default for everyone" in t['tip'] and 'Configure cards' in t['tip']
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
                and "status bar&rsquo;s <strong>Cards</strong> segment" in t['ustopic'] and 'white space' in t['ustopic'] and '28 of 300 cards' in t['ustopic'] and "status bar's Cards segment" in t['tip'],
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
                and 'two columns' in t['ustopic'] and 'more detail than reads well across one line' in t['tip'] and 'Cards</strong> section of this panel' not in t['ustopic'],
                "Settings > Cards gone; the Cols card's Layout line; two columns at Extra large; what cards are for (module, palette, help, tip); README"))
    # (clbar) the card setup in the view link (cleaned, captured, from Open as cards, applied as the session entry, dropped
    # first, listed, described); the rank-scaled brand bar; help, tip, README
    out.append(('S-clbar', 'function _pnbViewLinkCardSetup(' in main and "['cl', 'card setup'], ['cv cz', 'card view']" in dtx and 'var clNow = _pnbCardSetupNow();' in main
                and 'if (!v.cl) { var clOpt = _pnbCardSetupNow(); if (clOpt) v.cl = clOpt; }' in main and '_pnbViewSessEntry.cards = JSON.parse(JSON.stringify(v.cl));' in main
                and "inc.push('card setup')" in main and "out.push('your card setup')" in main and 'function rankPct(' in cards and 'vals.sort(function (a, b) { return a - b; });' in cards
                and 'place</em> among the cards on the page' in t['ustopic'] and 'carries your card setup' in t['ustopic'] and 'a view link you copy carries it' in t['tip'] and 'clbar (2026-10-30' in t['readme'],
                'the card setup in the view link; the rank-scaled bar; help, tip, README'))
    ui = cards + css + t['topic'] + t['tip'] + (r1.group(0) if r1 else '') + (r2.group(0) if r2 else '') + (vo.group(0) if vo else '') + (idx[swi:swi + 600] if swi > 0 else '')
    out.append(('S-noEmdash', '\u2014' not in ui and '&mdash;' not in ui, 'no em-dash in the new UI text'))
    return out

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    exp = ('try { window.__HC = {}; [["bso", "buildStateObject"], ["runSearch", "runTableSearch"], ["cf", "applyConditionalFormatting"], ["syncLayout", "penumbraSyncActiveLayout"], ["rgv", "rebuildGroupedView"]].forEach(function (p) { try { window.__HC[p[0]] = eval(p[1]); } catch (e) { } }); } catch (e) { }\r\n')
    out = src[:i] + ';(function () {\r\n' + exp + src[i + len(anchor):]
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
            if v:
                if shot:
                    time.sleep(0.4)
                    data = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}).get('data')
                    if data: open(shot, 'wb').write(base64.b64decode(data))
                return json.loads(v)
        tr = call('Runtime.evaluate', {'expression': 'JSON.stringify({errors: window.__errors, q: window.__queryDone, h: window.__HC_HIDES})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout; %s' % tr}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_cards.js', texts['cards'] or '// (control: no card view)\n')
    w('penumbra_cards.css', texts['cardscss'])
    w('main.css', texts['maincss'])
    w('penumbra_colmenu.js', texts['menu'])   # (cmenu) the engine under test (the LIBS copy above is live's)
    w('penumbra_find.js', texts['find'])   # (round K) Find under test (cfind / gfind load it)

def url_for(s, token=None):
    u = 'harness.html?scn=%s&id=lrfix' % s
    if s == 'cperf': u += '&rows=1000'
    if s == 'cmore': u += '&rows=2500'
    if s == 'cfmtbig': u += '&rows=2500'   # (cfmt2)
    if s == 'cvlT': u += '&view=' + T_NOCV
    if s in ('cvlB', 'cszvlB', 'cvlD') and token: u += '&view=' + token
    if s == 'cxlvl': u += '&view=' + T_XL
    if s == 'curl1': u += '&cards=1&cardsize=xl'   # (curl)
    if s == 'curl2': u += '&cards=1'
    if s == 'curl3': u += '&cards=0'
    if s == 'curl4': u += '&view=' + T_CV
    return u
PHONE = {'width': 375, 'height': 812, 'deviceScaleFactor': 1, 'mobile': True}
def run_browser(scns):
    out, res = [], {}
    for s in scns:
        token = None
        if s in ('cvlB', 'cszvlB', 'cvlD'):
            token = ((res.get({'cvlB': 'cvlA', 'cszvlB': 'cszvlA', 'cvlD': 'cvlC'}[s]) or {}).get('info') or {}).get('token') or 'none'
        shot = os.path.join(shots_dir, s + '.png') if shots_dir else None
        r = run_page(url_for(s, token), PHONE if s in ('cphone', 'cnarrowA', 'cnarrowT', 'cnarrowN', 'cdetph', 'cxl2ph') else None, shot); res[s] = r
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
