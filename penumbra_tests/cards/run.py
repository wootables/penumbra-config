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

SCN = ['cauto', 'cguess', 'cpage', 'cfull', 'chl', 'cbar', 'cesc', 'coff', 'cviewer', 'pcoff', 'gcards', 'gcoll', 'gncoll', 'ggcards', 'gglnest', 'csize', 'cszvlA', 'cszvlB', 'cnarrowA', 'cnarrowT', 'cauth', 'cauthB', 'cauthM', 'cvlA', 'cvlB', 'cvlT', 'ca11y', 'cphone', 'cperf', 'cmore',
       'cxl', 'cxlvl', 'cmenu', 'gmenu', 'pmenu', 'cmsize', 'gmsize', 'cdet', 'gdet', 'pdet', 'cdetph', 'cmword', 'curl1', 'curl2', 'curl3', 'curl4', 'cshare', 'cnote', 'cnotedet', 'ctmenu', 'cflink', 'ckword', 'cfind', 'gfind', 'cbarpick', 'csort', 'gsort', 'cempty', 'pfind', 'clayout', 'clayoutB', 'cdetrow', 'pvfind']
T_CV = tok({'v': 1, 'm': 'flat', 'o': 'none', 'cv': 1, 'cz': 'compact'})   # (curl) a view link asking for compact cards
CHK = {
    'cauto': ['switchShown', 'tableDefault', 'toCards', 'pagerWord', 'tableKeptForReaders', 'count', 'guessTitle', 'guessBig', 'guessFields', 'guessNoExtras', 'parity', 'linkKept', 'filtered', 'sorted', 'prefSaved',
              'roles', 'oneTabStop', 'arrowRight', 'arrowDown', 'enterSelects', 'escClears', 'clickSelects', 'toTable', 'prefTable', 'switchA11y'],
    # (csize) the author's default size, the viewer's size (pref), compact's parts, the form round trip; the link's cz; the phone default
    'csize': ['authorDefault', 'sizeControl', 'viewerCompact', 'compactParts', 'prefSize', 'backToStandard', 'formSize'],
    'cszvlA': ['carriesCz', 'describedCz', 'noCzStandard'], 'cszvlB': ['bootsCompact', 'prefUntouched'],
    'cnarrowA': ['narrowOpensCards'], 'cnarrowT': ['tableChoiceWins'],
    'cguess': ['moneyOverNumber', 'fieldsNext'],
    'cpage': ['pageSize', 'nextPage', 'lastPageFilled', 'rowsPerPageAll'],
    'cfull': ['bootsCards', 'slots', 'hiddenFilled', 'pillPlain', 'barFallback', 'subShown', 'fieldLabels', 'fieldValues'],
    'chl': ['ruledPills', 'plainPills', 'pillMatchesCell'],
    'cbar': ['cellHasBar', 'barFromCell', 'barColor'],
    'cesc': ['noScript', 'tagAsText'],
    'coff': ['switchHidden', 'hostHidden', 'notOffered', 'setRefused', 'offFlyout', 'offBack'],   # (round J: noTableFlyout gone - the option off offers it now)
    'cviewer': ['noForm', 'switchShown', 'cards'],
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
    # ticked; This row as a card from a value), a size picked, a row's details, a heading's list without the row
    'ctmenu': ['flyout', 'pickSize', 'rowCard', 'headerFlyout'],
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
    # (clayout) Settings > Cards: shown, a title and fields picked (drawn, kept with the size pref, never the report's),
    # back to the report's; Quick actions opens it; a seeded layout drawn on load, the author's form untouched
    'clayout': ['sectionShown', 'titlePicked', 'fieldsPicked', 'keptAsPref', 'authorUntouched', 'resetBack', 'paletteOpens'],
    'clayoutB': ['seededDrawn', 'seededShown', 'formIsAuthors'],
    # (the sweep) the details window keeps its row: a sort moves it, the window follows; a page turn closes it
    'cdetrow': ['sortFollows', 'pageCloses'],
    # (round M) a three-measure pivot in Compact: a value the tile does not show is named as the tile's field is (the
    # column path and the measure)
    'pvfind': ['namedAsField'],
    'cauth': ['formOff', 'setupShown', 'pickersListed', 'chipsListed', 'liveSwitch', 'stateOnEmpty', 'statePicks', 'fourLimit', 'drawnPicks', 'untickOff', 'stateOff'],
    'cauthB': ['formOn', 'pickersShow', 'chipsShow', 'roundTrip', 'switchShown', 'reedit'],
    'cauthM': ['missingListed', 'missingChip', 'guessFallsBack', 'keptField'],
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
    'pmenu': ['tileValueMenu', 'tileNoGrid', 'tileLabelMenu', 'totalTileMenu', 'tileShowTable'],
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

MUTANTS = {
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
    'm-sortsize': ([('cardscss', "#pnbCardsSort { align-self: center; margin-left: 4px; font-size: 11px; padding: 1px 2px; max-width: 15em; }\n", "")], ['L-csort-sortSized'], ['csort']),
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
    'm-laysave': ([('cards', "        try { H.layoutSet(v); } catch (e) { }\n", "")], ['L-clayout-keptAsPref'], ['clayout']),
    'm-layreset': ([('cards', "        try { H.layoutSet(null); } catch (e) { }\n", "")], ['L-clayout-resetBack'], ['clayout']),
    'm-laysec': ([('cards', "        var show = (offered() || on()) && !H.inPivot() && !!H.layoutSet;\n        sec.hidden = !show;", "        var show = (offered() || on()) && !H.inPivot() && !!H.layoutSet;\n        sec.hidden = true;")], ['L-clayout-sectionShown'], ['clayout']),
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
    'm-offask': ([('cards', "        menuAsk = true;   // (cardsmenu 2) a report whose Cards option is off shows them too, for the visit\n", "")], ['L-coff-offFlyout', 'L-coff-offBack'], ['coff']),
    'm-offgate': ([('cards', "        if (!hostApi() || !allowed() || on() || !c || !c.th || !c.th.closest) return null;   // (cardsmenu 2) the option on or off", "        if (!hostApi() || !offered() || on() || !c || !c.th || !c.th.closest) return null;")], ['L-coff-offFlyout', 'L-coff-offBack'], ['coff']),
    'm-pager': ([('cards', "        paintSize();\n        paintPager();\n", "        paintSize();\n")], ['L-cauto-pagerWord'], ['cauto']),
    'm-cardword': ([('cards', "String(it.label || '').replace(/\\bthis row\\b/, 'this card')", "String(it.label || '')")], ['L-cnote-cardWording'], ['cnote']),
    'm-menumark': ([('cards', "            markMenuPart(t, target);   // (cardhover)\n", "")], ['L-cdet-menuMark'], ['cdet']),
    # (cardlist) the List layout: never parked; the frame left hidden; the box's table left drawn; a restored copy kept;
    # the host left in the box under the table; a branch's rows not gathered
    'm-listbox': ([('cards', "        var box = (grouped && listOn()) ? listBox() : null, listWait = grouped && !box && listOn();", "        var box = null, listWait = false;")], ['L-ggcards-hostInBox', 'L-ggcards-noBandsOfItsOwn'], ['ggcards']),
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
    # the switch shown on every report
    'm-switchoff': ([('cards', "    function offered() { return (!!report || asked()) && allowed(); }", "    function offered() { return allowed(); }")], ['L-coff-switchHidden', 'L-coff-notOffered'], ['coff']),
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
    'm-fourfields': ([('cards', "            boxes[i].disabled = !boxes[i].checked && n >= MAX_FIELDS;", "            boxes[i].disabled = false;")], ['L-cauth-fourLimit'], ['cauth']),
    # the authored option never written to the state
    'm-nostate': ([('main', "            if (_cardsVo) viewOptions.cards = _cardsVo;\n", "")], ['L-cauth-statePicks', 'L-cauth-stateOnEmpty', 'L-cauthB-roundTrip'], ['cauth', 'cauthB']),
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
    'm-nophone': ([('cards', "        return (H.narrow && H.narrow()) ? 'cards' : 'table';", "        return 'table';")], ['L-cnarrowA-narrowOpensCards'], ['cnarrowA']),
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
    'm-urlneedsopt': ([('cards', "    function offered() { return (!!report || asked()) && allowed(); }", "    function offered() { return !!report && allowed(); }")], ['L-curl1-switchShown', 'L-curl4-linkUnlocks'], ['curl1', 'curl4']),
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
    out.append(('S-module', 'window.Penumbra.cardsHost' in main and "P.cards = {" in cards and '.pnb-card {' in css and "role=\"listitem\"" in cards and 'role="region"' in idx, 'module + host + css present'))
    out.append(('S-include', "file_exists(__DIR__ . '/js/penumbra_cards.off')" in idx and 'css/penumbra_cards.css?v=' in idx and 'js/penumbra_cards.js?v=' in idx, 'index.php loads both files behind the .off switch'))
    swi = idx.find('id="pnbCardsSwitch"'); rc = idx.find('<span id="resultCount"></span>')
    out.append(('S-markup', swi > 0 and rc > 0 and 0 < swi - rc < 400 and 'role="radiogroup"' in idx[swi:swi + 200] and 'id="pnbCardsHost"' in idx and idx.find('id="pnbCardsHost"') > idx.find('id="pivot-output-container"'), 'the switch right after the row count; the host in #table-view-container'))
    vo = re.search(r'<div class="view-option-item pnb-cards-vo">.*?pnb-cards-note.*?</p>\s*</div>\s*</div>', idx, re.S)
    lay = idx.find('id="viewOptionClickFilter"'); lcol = idx.find('name="headerLayout" value="split"')
    out.append(('S-voCard', bool(vo) and 'id="viewOptionCards"' in vo.group(0) and lay > 0 and vo.start() > lay and vo.start() - lay < 900 and 'data-tip="us-tip-cards"' in vo.group(0)
                and 'pnb-cards' not in idx[lcol:lay] and 'Table Behavior' in idx[lcol:lay]
                and all(k in vo.group(0) for k in ('data-slot="title"', 'data-slot="sub1"', 'data-slot="sub2"', 'data-slot="big"', 'data-slot="pill"', 'data-slot="bar"', 'id="pnbCardFields"')), 'a .view-option-item Cards card after Click-to-Filter (Table Behavior, not the Layout column), every slot picker'))
    i1, i2 = pal.find("{ id: 'cards', label: 'Show as cards'"), pal.find("{ id: 'cardstable', label: 'Show as a table'")
    i3 = pal.find("\n        { id: '", i2 + 10) if i2 > 0 else -1
    class _R:
        def __init__(self, s): self.s = s
        def group(self, _): return self.s
    r1 = _R(pal[i1:i2]) if 0 < i1 < i2 else None; r2 = _R(pal[i2:i3]) if 0 < i2 < i3 else None
    out.append(('S-paletteRows', bool(r1) and bool(r2) and 'card view' in r1.group(0) and "Penumbra.cards.set('cards')" in r1.group(0) and "Penumbra.cards.set('table')" in r2.group(0) and "el('pnbCardsSwitch')" in r1.group(0) and 'viewOptionCards' not in pal, 'two rows, no option id named'))
    out.append(('S-help', 'id="vo-cards"' in t['topic'] and 'data-jump-to="vo-cards"' in t['topic'] and 'Cards switched on' in t['topic'] and 'data-tip="us-tip-cards"' in t['tip'] and 'data-tip="us-tip-cards"' in idx and 'card view' in t['manifest'], 'help topic section + jump + tip (defined + consumed) + manifest keywords'))
    out.append(('S-readme', 'Card view: the rows drawn as cards' in t['readme'] and 'penumbra_tests\\cards' in t['readme'], 'README section 5 bullet'))
    out.append(('S-hooks', all(k in main for k in ("window.Penumbra.cards.paged()", "window.Penumbra.cards.sync()", "viewOptions.cards = _cardsVo", "applyCardsOption(vo.cards)", "applyCardsOption(optionsToApply && optionsToApply.cards, true)", "function applyCardsOption(cfg, formWins)", "window.Penumbra._cardsPending = cfg || null")),
                'applyPagination tail, penumbraSyncActiveLayout, buildStateObject, both viewOptions load sites, the pending stash'))
    dro = re.search(r'var PNB_VIEW_DROP_ORDER = \[(.*?)\];', main, re.S); dtx = dro.group(1) if dro else ''
    out.append(('S-viewLink', "if (d.cv === 1 || d.cv === true) v.cv = 1;" in main and "window.Penumbra.cards.on()) {" in main and "['cv cz', 'card view']" in dtx and dtx.find("'cv") < dtx.find("'dn'") and "inc.push('card view')" in main and "out.push('shown as ' + (v.cz ? (v.cz === 'xl' ? 'extra large' : v.cz) + ' ' : '') + 'cards')" in main,
                'cv (+ cz) cleaned, captured, dropped first, listed, described (xl as extra large)'))
    # (cxl) the Extra large row, both option lists, the help; (cmenu) the engine's hook + openItems, the module's handler, the help + README
    menu = t['menu']
    out.append(('S-xlRows', "{ id: 'cardsize-xl', label: 'Card size: Extra large'" in pal and "setSize('xl')" in pal and "cardSize('xl')" in pal, 'the Extra large palette row'))
    out.append(('S-xlMarkup', idx.count('<option value="xl">') >= 2 and '<option value="xl">Extra large</option>' in idx and "e.size === 'xl'" in main and "v === 'xl'" in main, 'xl in the size control and the setup row; the pref reads and writes it'))
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
    out.append(('S-sizeMarkup', 'id="pnbCardsSize"' in idx and idx.find('id="pnbCardsSize"') - idx.find('id="pnbCardsSwitch"') < 1200 and 'data-slot="size"' in idx and 'value="compact"' in idx and 'value="large"' in idx, 'the size control beside the switch; the setup\'s Card size row'))
    out.append(('S-pvHelp', 'each pivot row is a tile' in t['topic'] and 'each pivot row is a tile' in t['tip'] and 'have no card form' not in t['topic'] and 'pivotHtml' in cards and "body.pnb-cards-on #pivotResultTable" in css, 'help names the pivot tiles; the module and css have them'))
    out.append(('S-sizeHelp', 'Card size' in t['topic'] and '600px or less' in t['topic'] and 'Card size sets the default' in t['tip'] and 'Card size: Compact / Standard / Large' in t['topic'], 'help topic + tip name the sizes and the phone default'))
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
                and '.registry-theme #pnbCardsHost [data-col] a' in css and 'C.canShow && C.canShow()' in pal and 'canShow: function' in cards and 'option off' in t['topic'],
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
    out.append(('S-roundL', 'Round L (2026-10-30' in t['readme'] and 'id="us-cards"' in t['ustopic'] and 'us-tip-card-layout' in t['tip'] and 'Sort: none' in t['topic']
                and 'id="pnbCardsSort"' in idx and 'id="spCardsSection"' in idx and 'layoutGet: function' in main and "items.push('Card title and fields')" in main
                and "id: 'cardlayout'" in pal and 'function paintSort(' in cards and 'function filled(' in cards and 'paintTileMarks(' in t['find'],
                'help + README name round L; the Sort list and Settings > Cards; the layout pref; the palette row; pivot tiles in Find'))
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
    if s == 'cvlT': u += '&view=' + T_NOCV
    if s in ('cvlB', 'cszvlB') and token: u += '&view=' + token
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
        if s in ('cvlB', 'cszvlB'):
            token = ((res.get({'cvlB': 'cvlA', 'cszvlB': 'cszvlA'}[s]) or {}).get('info') or {}).get('token') or 'none'
        shot = os.path.join(shots_dir, s + '.png') if shots_dir else None
        r = run_page(url_for(s, token), PHONE if s in ('cphone', 'cnarrowA', 'cnarrowT', 'cdetph') else None, shot); res[s] = r
        if shots_dir and s in ('cauto', 'gcards', 'gcoll', 'ggcards', 'csize', 'pcoff', 'cxl', 'cmenu', 'gmenu', 'pmenu', 'cdet', 'pdet', 'cnote'):   # the same page under a dark theme (csize: compact)
            run_page(url_for(s) + '&theme=theme-dark-blue&shot=1', None, os.path.join(shots_dir, s + '_dark.png'))
        if shots_dir and s in ('pcoff', 'cxl', 'cmenu', 'gmenu', 'pmenu', 'cdet', 'pdet', 'cmword', 'curl1', 'cnote'):   # the light picture too, posed by the scenario's shot branch (the full run moves on past it)
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
