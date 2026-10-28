# =============================================================================
# viewlink - "Copy a link to this view" (?id=X&view=TOKEN), 2026-10-21
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S,S]
# Headless Edge over CDP on the colmenu harness (the REAL main.js); stages into
# %TEMP%\pnb_vl_*; writes nothing to the webroot. One headless-Edge suite at a time.
# The round trip: a capture page (vcapA / gvA / pvA) builds a link through the real
# controls; the page that link opens (vcapB / vgrpB / vpivB / pflatB) must show the same
# thing and capture the SAME view again (compared here, key by key).
# Static: index.php (pako for ?view=, the Copy dialog's button, ?view= read nowhere else),
# the palette row, the feedback email's link, the help topic + tip, no em-dash in the UI.
# --control = live (no view links): every new check red, the guards green.
# =============================================================================
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, zlib
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_colfmt.js', 'penumbra_calc.js',
        'penumbra_colwidths.js', 'penumbra_colmenu.js']
CSS = ['penumbra_find.css', 'main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css', 'penumbra_colmenu.css']

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
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = APP if control else (stage_dir or APP)
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'find': os.path.join('js', 'penumbra_find.js'), 'prompt': 'ai_system_prompt.php', 'calc': os.path.join('js', 'penumbra_calc.js'), 'main': os.path.join('js', 'main.js'), 'index': 'index.php', 'pal': os.path.join('js', 'penumbra_palette.js'),
        'form': 'submit_home_form.php', 'topic': os.path.join('help', 'topics', 'viewLinkHelpLightbox.php'),
        'tip': os.path.join('help', 'tips', 'settings-tips-storage.php'), 'manifest': os.path.join('help', 'manifest.php'),
        'cellsel': os.path.join('js', 'penumbra_cellsel.js')}   # (10-27 b) the cell selection module under test
def read_b(p):
    if not os.path.exists(p): return ''
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

# ---- tokens built here (zlib = pako.inflate's default format), base64url
def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
ALL20 = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE']
T_WINS = tok({'v': 1, 'm': 'flat', 'o': 'none', 'c': {'o': ALL20, 'v': ['V_ID', 'V_STATUS', 'H_CODE'], 'n': True}, 'fz': 1, 'w': {'V_STATUS': 250}})
T_STALE = tok({'v': 1, 'm': 'flat', 'o': 'GONE_C|desc', 'c': {'o': ['V_ID', 'GONE_A', 'V_NAME'], 'v': ['V_ID', 'GONE_A', 'V_NAME'], 'n': True},
               'w': {'OLD_B': 200}, 'fm': {'V_NAME': 'text'}})
BAD_S = '<img src=x onerror="window.__pwn=1">'
BAD = {'v': 1, 'm': 'flat', 's': BAD_S, 'o': 'V_NAME|desc',
       'c': {'o': ['V_ID', '<img src=x onerror="window.__pwn=2">', 'GONE_&amp;X'], 'v': ['V_ID', '<img src=x onerror="window.__pwn=2">', 'GONE_&amp;X'], 'n': True},
       'fm': {'V_NAME': '<img src=x onerror="window.__pwn=3">'},
       'hl': {'V_NAME': [{'id': 'x', 'w': '<img src=x onerror=window.__pwn=4>', 'css': '</style><img src=x onerror=window.__pwn=5>'}]},
       'cso': {'V_STATUS': ['<img src=x onerror=window.__pwn=7>', 'Open']},
       'query': 'DROP TABLE X', 'reportSnippet': '<script>window.__pwn=6</script>', 'viewOptions': {'hideSearch': True, 'hideExport': True},
       'th': 'theme-not-in-the-registry', 'dn': 'huge', 'noadm': 1, 'rowlimit': False, 'console': 1, 'download': 'csv', 'g': {'by': '<img src=x onerror=window.__pwn=8>'}}
T_BAD = base64.urlsafe_b64encode(zlib.compress(json.dumps(BAD).replace('"query"', '"__proto__": {"polluted": 1}, "query"', 1).encode(), 9)).decode().rstrip('=')
T_SQL = tok({'v': 1, 'm': 'flat', 's': "V_NAME = 'x' OR 1=1 --"})
T_BOMB = tok({'v': 1, 'm': 'flat', 's': ' ' * 300000})
T_OK = tok({'v': 1, 'm': 'flat', 's': 'Alpha'})
T_MAIL = tok({'v': 1, 'm': 'flat', 's': 'Alpha', 'o': 'V_AMOUNT|desc', 'c': {'o': ALL20, 'v': ['V_ID', 'V_NAME', 'V_AMOUNT'], 'n': True}, 'fz': 1, 'r': '25', 'pg': 2})
PIV = {'v': 2, 'rows': ['H_GROUP'], 'cols': ['V_STATUS'], 'vals': 'H_AMT', 'agg': ['sum', 'formula'], 'aggLabels': ['<img src=x onerror=window.__pwn=11>', '<b onmouseover=window.__pwn=15>F</b>'],
       'aggColOverrides': ['H_AMT', 'H_AMT'], 'aggFilters': None, 'aggFormulas': [None, 'window.__pwn=14 + constructor.constructor("window.__pwn=16")()'],
       'rowLayout': 'nested', 'colLayout': 'nested', 'sortOrder': 'asc', 'colSortOrder': 'asc', 'stickyColCount': 1, 'totalColAggs': None, 'totalRowAggs': ['sum'],
       'totalRowAggLabels': ['<img src=x onerror=window.__pwn=12>'], 'totalRowAggBaseIdx': None, 'rankN': None, 'rankDir': None, 'rankAgg': None, 'rankOther': True,
       'rankScope': None, 'noBreakdown': False, 'startExpanded': True, 'hideEmpty': False}
T_BADPIV = tok({'v': 1, 'm': 'pivot', 'p': PIV})
T_BADPIV2 = tok({'v': 1, 'm': 'pivot', 'p': dict(PIV, rows=['<img src=x onerror=window.__pwn=13>'], cols=['"><img src=x onerror=window.__pwn=17>'], vals='<svg onload=window.__pwn=18>')})
T_BADGRP = tok({'v': 1, 'm': 'group', 'g': {'by': 'H_GROUP', 'agg': {'column': 'H_AMT', 'type': 'sum'}, 'sort': {'key': '<img src=x onerror=window.__pwn=19>', 'dir': 'asc'}, 'layout': 'list'}})
T_BADGRP2 = tok({'v': 1, 'm': 'group', 'g': {'by': '<img src=x onerror=window.__pwn=20>,H_GROUP', 'agg': {'column': '<img src=x onerror=window.__pwn=21>', 'type': 'sum'}}})
Q1, Q2 = '" onmouseover="window.__pwn=30" x="', "' onmouseover='window.__pwn=31' x='"
T_BADPIV3 = tok({'v': 1, 'm': 'pivot', 'p': dict(PIV, aggLabels=[Q1, Q2], totalRowAggLabels=['" autofocus onfocus="window.__pwn=32" x="'], aggFormulas=None, agg=['sum', 'count'])})
T_BADGRP3 = tok({'v': 1, 'm': 'group', 'g': {'by': 'H_GROUP', 'agg': {'column': 'H_AMT', 'type': 'sum'}, 'sort': {'key': Q1, 'dir': 'asc'}, 'layout': 'list'}, 'cso': {'H_GROUP': [Q2, 'North']}})
T_FMSAVE = tok({'v': 1, 'm': 'flat', 'fm': {'V_AMOUNT': 'number:1'}, 'cso': {'V_STATUS': {'values': ['Pending', 'Open', 'Closed'], 'preset': None}}})
T_BADPIV4 = tok({'v': 1, 'm': 'pivot', 'p': {'rows': 5, 'cols': {}, 'vals': ['x']}})
T_GLIST = tok({'v': 1, 'm': 'group', 'g': {'by': 'H_GROUP', 'layout': 'list'}})
T_PGSTALE = tok({'v': 1, 'm': 'flat', 'o': 'none', 'r': '25', 'pg': 999})
from urllib.parse import quote
def url_for(s, token=None):
    base = 'harness.html?scn=%s' % s
    if s == 'vnoid': return base + '&view=' + T_OK
    if s == 'vsharenoid': return base
    if s in ('vcmpA', 'vcmpF', 'ggcA', 'vcmpS'): return base + '&id=lrfix'
    if s == 'vstate': return base + '&id=lrfix&state=x&view=' + T_OK
    base += '&id=lrfix'
    return base + ('&view=' + token if token else '')
# (2026-10-22) a link naming the journal's columns: Notes after V_ID and hidden (not in the visible list), the Done
# toggle after V_AMOUNT, shown, 90px
JRN_O = ['V_ID', '__JOURNAL_NOTES', 'V_NAME', 'V_AMOUNT', '__JOURNAL_TOGGLE__done', 'V_DATE', 'V_LINK', 'V_STATUS'] + [n for n in ALL20 if n.startswith('H_')]
T_JRN = tok({'v': 1, 'm': 'flat', 'o': 'none', 'c': {'o': JRN_O, 'v': ['V_ID', 'V_NAME', 'V_AMOUNT', '__JOURNAL_TOGGLE__done', 'V_DATE', 'V_LINK', 'V_STATUS'], 'n': True},
             'w': {'__JOURNAL_TOGGLE__done': 90}})
STATIC_TOK = {'vwins': T_WINS, 'vstale': T_STALE, 'vbad': T_BAD, 'vsql': T_SQL, 'vhuge': 'A' * 7000, 'vbomb': T_BOMB, 'vpgstale': T_PGSTALE, 'ggvA': T_GLIST, 'vbadpiv4': T_BADPIV4, 'vfmsave': T_FMSAVE, 'vbadpiv': T_BADPIV, 'vbadpiv2': T_BADPIV2, 'vbadgrp': T_BADGRP, 'vbadgrp2': T_BADGRP2, 'vbadpiv3': T_BADPIV3, 'vbadgrp3': T_BADGRP3, 'vmail': T_MAIL}
STATIC_TOK['vjrn'] = T_JRN
# (10-27 sweep) grouped by a nested-table column's own column; a grouping token past 200 chars (40 custom edges)
STATIC_TOK['vnest'] = tok({'v': 1, 'm': 'group', 'g': {'by': 'SUB_NAME'}})
GBINS_BY = 'H_AMT:bins' + '_'.join(str(int(round(5 * 1.5 ** i))) for i in range(1, 41))
STATIC_TOK['vgbins'] = tok({'v': 1, 'm': 'group', 'g': {'by': GBINS_BY}})
# (10-27 b) selected cells whose rows are none of this page's (fingerprints that match no row)
STATIC_TOK['vselX'] = tok({'v': 1, 'm': 'flat', 'o': 'none', 'sel': [{'r': [2, 4], 'c': ['V_NAME', 'V_AMOUNT'], 'h': ['zzzzz', 'zzzzz']}]})
# (10-27 review) the cleaner's own checks: a formula summary; sort levels on '#' and on a journal column
T_CSF = tok({'v': 1, 'm': 'flat', 'o': 'none', 'cs': {'V_AMOUNT': 'formula'}})
T_SCV = tok({'v': 1, 'm': 'group', 'g': {'by': 'H_GROUP'}, 'sc': [{'colIdentifier': '#', 'colIndex': '#', 'direction': 'desc'}, {'colIdentifier': '__JOURNAL_TOGGLE__done', 'colIndex': '__JOURNAL_TOGGLE__done', 'direction': 'asc'}]})

SCN = ['vcapA', 'vcapB', 'gvA', 'vgrpB', 'pvA', 'vpivB', 'pflatB', 'vwins', 'vwinsc', 'vstale', 'vbad', 'vsql', 'vhuge', 'vbomb', 'vnoid', 'vstate', 'vprompt', 'vlimit', 'vpgA', 'vpgB', 'vpgstale', 'vccA', 'vccB', 'vcchB', 'vmail', 'vthA', 'vthB', 'vshare', 'vsharenoid', 'vscrA', 'vscrB', 'vfindA', 'vfindB', 'vbadpiv', 'vbadpiv2', 'vbadpiv3', 'vbadgrp', 'vbadgrp2', 'vbadgrp3', 'vfmsave', 'vbadpiv4', 'vfitA', 'vfitB', 'vjrn', 'vcmpA', 'vcmpB', 'vcmpF', 'vcmpG', 'ggvA', 'ggvB', 'ggcA', 'ggcB', 'ggsA', 'ggsB', 'vcmpS', 'vcmpT', 'vnest', 'vgbins', 'vsnapv', 'vunit', 'vnumA', 'vnumB', 'vselA', 'vselB', 'vselX', 'pvselA', 'vpselB']
CHK = {
    'vcapA': ['api', 'filtered', 'sorted', 'hidden', 'frozen', 'width', 'format', 'built', 'carries', 'urlShape', 'copied', 'toast', 'noNoteWithoutLink'],
    'vcapB': ['note', 'active', 'oneQuery', 'rtSearch', 'rtShown', 'rtRows', 'rtView', 'rtSort', 'rtFrozen', 'rtWidths', 'rtFormats', 'rtLayout'],
    'gvA': ['built', 'mode'], 'vgrpB': ['note', 'active', 'rtGrouped', 'rtView'],
    'pvA': ['built', 'mode'], 'vpivB': ['note', 'active', 'rtPivot', 'rtView', 'defaultIsReports'],
    'pflatB': ['note', 'active', 'flatOverPivot'],
    'vwins': ['note', 'linkWins', 'linkFrozen', 'linkWidth', 'untouchedOnLoad', 'sessionHolds', 'savedUntouched'],
    'vwinsc': ['seedApplies'],
    'vstale': ['note', 'staleListed', 'restApplied'],
    'vbad': ['noScript', 'noPollution', 'tagTextRefused', 'noViewOptions', 'noAdminOverrides', 'queryUnchanged', 'unknownDropped', 'namesUnchanged', 'staleNameAsText'],
    'vsql': ['searchAsText', 'oneQuery'],
    'vhuge': ['ignored', 'defaultView'], 'vbomb': ['ignored', 'defaultView'], 'vnoid': ['ignored', 'defaultView'], 'vstate': ['ignored', 'defaultView'],
    'vprompt': ['promptRides', 'multiGrammar', 'forcedHiddenSkipped', 'reservedSkipped', 'includesPrompts'],
    'vlimit': ['fits', 'droppedNamed'],
    'vccA': ['calcShown', 'carriesCalc', 'reportNotRepeated', 'calcDialogViewLink'], 'vccB': ['note', 'calcApplied', 'calcValue', 'calcNotSaved', 'rtView'],
    'vcchB': ['note', 'calcApplied', 'calcValue', 'calcNotSaved'],
    'vmail': ['copyWithoutSending', 'labelsReworded', 'rowShown', 'disabledUntilLink', 'enabledWithLink', 'noListUnticked', 'listsCustomizations', 'disabledAgain'],
    'vthA': ['carriesTheme', 'describedTheme'], 'vthB': ['note', 'themeApplied', 'prefsNotSaved', 'rtView'],
    'vshare': ['shareIsViewLink', 'shareOpened', 'shareToast'], 'vsharenoid': ['shareKeepsState'],
    'vscrA': ['carriesScroll'], 'vscrB': ['note', 'rtTopRow', 'rtLeftCol'],
    'vfindA': ['findStepped', 'carriesFind', 'describedFind'], 'vfindB': ['note', 'findOpen', 'cellOnScreen', 'rtMatch', 'rtCell', 'rtTopRow'],
    'vbadpiv': ['noScript', 'pageAlive', 'pivotShown'], 'vbadpiv3': ['noScript', 'pageAlive', 'pivotShown'], 'vbadgrp3': ['noScript', 'pageAlive', 'grouped'], 'vbadpiv2': ['noScript', 'pageAlive'], 'vbadgrp': ['noScript', 'pageAlive', 'grouped'], 'vbadgrp2': ['noScript', 'pageAlive'],
    'vfmsave': ['note', 'listUnticked', 'wysiwygFormats', 'csoRoundTrip', 'savedReportFormats', 'urlDropsView'],
    'vbadpiv4': ['noScript', 'pageAlive'],
    'vcmpA': ['compared', 'cmpLink', 'cmpCarriesView', 'cmpDescribed', 'bannerCarriesView'], 'vcmpB': ['compared', 'cmpLink', 'cmpCarriesView', 'note', 'noStale'],
    'vcmpF': ['compared', 'typedCarried', 'hiddenCarried', 'appliedFallback'], 'vcmpG': ['compared', 'hiddenAgain', 'filterKept', 'oneRun'],
    'ggcA': ['compared', 'listOn', 'carriesCmpGroup'], 'ggcB': ['compared', 'listOn', 'rtGroup', 'rtGroupTop'],
    'ggsA': ['stacked', 'carriesOpen'], 'ggsB': ['note', 'rtOpen', 'rtBoxTop', 'rtPageTop'],
    'vcmpS': ['compared', 'stacked', 'carriesOpen', 'carriesSort', 'carriesCmpSel'], 'vcmpT': ['compared', 'rtOpen', 'rtBoxTop', 'rtSort', 'rtCmpSel'],
    'vselA': ['selected', 'pressCleared', 'carriesSel', 'toastSays'], 'vselB': ['note', 'rtSel', 'noMissNote'], 'vselX': ['note', 'selNone', 'selMissNoted'],
    'pvselA': ['pivSelected', 'carriesPivSel'], 'vpselB': ['note', 'rtPivSel'],
    'vnest': ['note', 'grouped', 'nestNotMissing', 'nestNoSkip'], 'vgbins': ['note', 'grouped'], 'vsnapv': ['snapFlag', 'snapNote', 'liveNoFlag', 'snapNoPositions', 'liveKeepsTop'],
    'vunit': ['csFormulaKept', 'scVirtualKept', 'longFilterDropped'], 'vnumA': ['numSorted', 'carriesNumSort'], 'vnumB': ['note', 'rtNumSort', 'noSkipNote'],
    'ggvA': ['listOn', 'carriesGroup'], 'ggvB': ['listOn', 'note', 'rtGroup', 'rtGroupTop'],
    'vpgA': ['turned', 'carriesPage'], 'vpgB': ['note', 'rtPage'], 'vpgstale': ['note', 'clamped'],
    'vfitA': ['fitShares', 'carriesShares'], 'vfitB': ['note', 'sharesApplied', 'rtShares'],   # (2026-10-22)
    'vjrn': ['note', 'jrnNotMissing', 'jrnNoSkipNote', 'jrnPlaced', 'jrnCellsFollow', 'jrnHidden', 'jrnShown', 'jrnWidth'],
}
# what live already gets right with no view links at all (the link is simply ignored)
GUARDS = {'L-vwinsc-seedApplies', 'L-vbad-noScript', 'L-vbad-noPollution', 'L-vbad-noViewOptions', 'L-vbad-noAdminOverrides', 'L-vbad-queryUnchanged',
          'L-vbad-namesUnchanged', 'L-vsql-oneQuery', 'L-vhuge-ignored', 'L-vhuge-defaultView', 'L-vbomb-ignored', 'L-vbomb-defaultView',
          'L-vnoid-ignored', 'L-vnoid-defaultView', 'L-vstate-ignored', 'L-vstate-defaultView', 'S-viewReadOnce',
          # the capture page's setup steps (the real controls work on live too) and a vacuous check on live
          'L-vcapA-filtered', 'L-vcapA-sorted', 'L-vcapA-hidden', 'L-vcapA-frozen', 'L-vcapA-width', 'L-vcapA-format', 'S-noEmdash'}

# (2026-10-22) view links are LIVE: a control judges this round's checks (NEW: red on live) and every other
# check (green on live). The round-1 rule (all but GUARDS new) no longer fits a live feature.
NEW = {'L-vselA-carriesSel', 'L-vselA-toastSays', 'L-vselB-rtSel', 'L-vselX-selMissNoted', 'L-vcmpS-carriesCmpSel', 'L-vcmpT-rtCmpSel',
       'L-pvselA-carriesPivSel', 'L-vpselB-rtPivSel'}   # (10-27 b: selected cells)
MUTANTS = {
    # --- (2026-10-22) a share refused again; the journal's columns counted gone again; the journal ignoring the
    # link's order; the journal ignoring the link's visible list
    'm-noshare': ([('main', "var wp = Math.round(parseFloat(x) * 100) / 100; return (wp > 0 && wp <= 100) ? wp + '%' : undefined; }", "return undefined; }")],
                  ['L-vfitA-carriesShares', 'L-vfitB-sharesApplied', 'L-vfitB-rtShares'], ['vfitA', 'vfitB']),
    'm-jrnmissing': ([('main', "n.indexOf('__JOURNAL') !== 0 && idx[n] === undefined", 'idx[n] === undefined')], ['L-vjrn-jrnNotMissing', 'L-vjrn-jrnNoSkipNote'], ['vjrn']),
    'm-jrnorder': ([('main', 'if (_pnbViewLink && _pnbViewLink.c && _pnbViewLink.c.o.indexOf(col) >= 0) order = _pnbViewLink.c.o;', '')], ['L-vjrn-jrnPlaced', 'L-vjrn-jrnCellsFollow'], ['vjrn']),
    'm-jrnhide': ([('main', "_pnbViewLink.c.v.indexOf(col) < 0) th.style.display = 'none';", '_pnbViewLink.c.v.indexOf(col) < 0) th.title = th.title;')], ['L-vjrn-jrnHidden'], ['vjrn']),
    # the state applied without validation (decode hands back the raw JSON)
    'm-novalidate': ([('main', "            return _pnbViewLinkClean(JSON.parse(txt));", "            return JSON.parse(txt);")],
                     ['L-vbad-unknownDropped'], ['vbad']),
    # the viewer's saved prefs overwritten (the session layer's write half gone)
    'm-prefswrite': ([('main', "        if (_pnbViewLink && _pnbViewLinkKey) {\n            var k = _pnbViewLinkKey, disk = {}, own", "        if (false) {\n            var k = _pnbViewLinkKey, disk = {}, own")],
                     ['L-vwins-savedUntouched'], ['vwins']),
    # the viewer's saved prefs read over the link (the read half gone)
    'm-prefsread': ([('main', "        if (lsKey === 'penumbra_column_prefs' && _pnbViewLink && _pnbViewLinkKey) {", "        if (false) {")],
                    ['L-vwins-linkWins'], ['vwins']),
    # a key dropped from the round trip (frozen columns never captured)
    'm-dropfz': ([('main', "        if (st.frozenCols) v.fz = st.frozenCols;\n", "")], ['L-vcapA-carries', 'L-vcapB-rtFrozen'], ['vcapA', 'vcapB']),
    # a key dropped on the way in (widths never laid over)
    'm-dropw': ([('main', "        slot('columnWidths', v.w);\n", "")], ['L-vcapB-rtWidths'], ['vcapA', 'vcapB']),
    # admin mode unlockable: the link's viewOptions / rowlimit let through
    'm-admin': ([('main', "        var v = { v: 1 };\n        v.m = ", "        var v = { v: 1, viewOptions: d.viewOptions };\n        if (d.rowlimit === false) _penumbraUrlOverrides.rowlimit = false;\n        v.m = "),
                 ('main', "        if (v.r) o.rowsPerPage = v.r;\n        return o;", "        if (v.r) o.rowsPerPage = v.r;\n        if (v.viewOptions) o.viewOptions = v.viewOptions;\n        return o;")],
                ['L-vbad-noViewOptions', 'L-vbad-noAdminOverrides', 'L-vbad-unknownDropped'], ['vbad']),
    # the stale note escapes nothing (a column name is HTML)
    'm-noescape': ([('main', "escapeHtml(miss.slice(0, 12).join(', '))", "miss.slice(0, 12).join(', ')")], ['L-vbad-staleNameAsText'], ['vbad']),
    # a forced default (maybe me()) carried to the recipient
    'm-forced': ([('main', "if (source !== 'url' && source !== 'stored' && source !== 'interactive')", "if (false)")], ['L-vprompt-forcedHiddenSkipped'], ['vprompt']),
    # (sweep) text that opens an HTML tag let through again
    'm-tagrule': ([('main', "if (t === 'string') return /<[A-Za-z!\/?]/.test(x) ? undefined : (x.length <= 4000 ? x : x.slice(0, 4000));", "if (t === 'string') return x.length <= 4000 ? x : x.slice(0, 4000);")],
                  ['L-vbadgrp2-noScript', 'L-vbad-tagTextRefused'], ['vbad', 'vbadpiv', 'vbadgrp2']),   # (10-23: the pivot renderer escapes its labels itself since a04f658, so vbadpiv stays safe without the rule - defence in depth)
    # (sweep) the link's formats laid into the REPORT's layer again (an editor's save writes them)
    'm-fmreport': ([('main', "        _pnbViewSessEntry = _pnbViewLinkColOpts(st, v);\n", "        slot('columnFormats', v.fm);\n        slot('columnHighlights', v.hl);\n")], ['L-vfmsave-savedReportFormats'], ['vfmsave']),
    # custom sort orders read as bare lists only (their real shape is {values, preset})
    'm-csoshape': ([('main', "var vals = Array.isArray(x) ? x : (x && typeof x === 'object' && Array.isArray(x.values) ? x.values : null);", "var vals = Array.isArray(x) ? x : null;")], ['L-vfmsave-csoRoundTrip'], ['vfmsave']),
    # (10-23) the comparison not recognised: the link captures its __SNAP_TYPE grouping and drops the comparison
    'm-cmpbase': ([('main', "        return !!((_activeCompareSnapshot || _activeCompareAb) && $('#snapshotComparisonContainer').is(':visible'));", "        return false;")], ['L-vcmpA-cmpLink'], ['vcmpA']),
    # the banner's Copy link without the view
    'm-bannerview': ([('main', "        if (_bvl && _bvl.url && _bvl.cmp) built.url = _bvl.url;\n", "")], ['L-vcmpA-bannerCarriesView'], ['vcmpA']),
    # (10-23 b) a comparison's hidden groups never captured / never re-applied; the List layout's group never restored;
    # the comparison link reading the box only
    'm-nosx': ([('main', "            if (sxs.length) v.sx = sxs;\n", "")], ['L-vcmpF-hiddenCarried'], ['vcmpF']),
    'm-nosxapply': ([('main', "    function runComparisonAndDisplayGrouped(snapshot, customKeyColumns = null) {\n        _pnbViewLinkSxIntoBox();", "    function runComparisonAndDisplayGrouped(snapshot, customKeyColumns = null) {\n")], ['L-vcmpG-hiddenAgain'], ['vcmpF', 'vcmpG']),
    'm-nogp': ([('main', "                if (vlg.gp) setTimeout(function () { _pnbViewLinkGroupTo(vlg); }, 300);\n", "")], ['L-ggvB-rtGroup'], ['ggvA', 'ggvB']),
    'm-nofallback': ([('main', "        return _stripSnapTypeClauses(String(_flatSearchAppliedFor || '').trim());\n", "        return '';\n")], ['L-vcmpF-appliedFallback'], ['vcmpF']),
    # (10-27 sweep) a comparison's own sort never captured / never restored
    'm-noxocap': ([('main', "                v.xo = sortCriteria.map(function (c) { return [String(c.colIdentifier), c.direction]; });\n", "")], ['L-vcmpS-carriesSort', 'L-vcmpT-rtSort'], ['vcmpS', 'vcmpT']),
    'm-noxoapply': ([('main', "                if (vlg.xo) setTimeout(function () { _pnbViewLinkCmpSort(vlg.xo); }, 250);", "                if (vlg.xo) { }")], ['L-vcmpT-rtSort'], ['vcmpS', 'vcmpT']),
    # a nested-table column's own column named as gone; a long grouping token dropped; no snapshot-view note
    'm-nonestvirt': ([('main', "idx[n] === undefined && !virt[n]) missing[n] = orig;", "idx[n] === undefined) missing[n] = orig;")], ['L-vnest-nestNoSkip', 'L-vnest-nestNotMissing'], ['vnest']),
    'm-gby200': ([('main', "typeof d.g.by === 'string' && d.g.by && d.g.by.length <= 2000)", "_pnbViewName(d.g.by))")], ['L-vgbins-grouped'], ['vgbins']),
    'm-nosnapnote': ([('main', "        if (b.snap) what += ' It opens the live report", "        if (false) what += ' It opens the live report")], ['L-vsnapv-snapNote'], ['vsnapv']),
    # (10-27 b) selected cells: not captured, not restored, a row's fingerprint ignored, a press elsewhere forgetting
    # them, a pivot's or a group's block not named
    'm-nosel': ([('main', "        if (!snapV) { var selB = _pnbViewLinkSelNow(); if (selB) v.sel = selB; }\n", "")], ['L-vselA-carriesSel', 'L-vselB-rtSel'], ['vselA', 'vselB']),
    'm-noselapply': ([('main', "        if (_pnbViewLink && _pnbViewLink.sel) _pnbViewLinkSelWhenReady(_pnbViewLink);\n", "")], ['L-vselB-rtSel', 'L-vcmpT-rtCmpSel'], ['vselA', 'vselB', 'vcmpS', 'vcmpT']),
    'm-selsig': ([('main', "rows[i].getClientRects().length && _pnbViewLinkRowSig(rows[i]) === h) return i;", "rows[i].getClientRects().length) return i;")], ['L-vselX-selNone', 'L-vselX-selMissNoted'], ['vselX']),
    'm-selgone': ([('cellsel', "if (keep.length) { gone = { list: keep, at: Date.now() }; }", "")], ['L-vselA-carriesSel'], ['vselA']),
    'm-selpivot': ([('main', "        if (T.id === 'pivotResultTable') return { k: { p: 1 }, rows: _pnbViewLinkPivotRows(T) };\n", "")], ['L-pvselA-carriesPivSel', 'L-vpselB-rtPivSel'], ['pvselA', 'vpselB']),
    'm-selgroup': ([('main', "return { k: { g: path }, rows: _pnbViewLinkSelGroupRows(box) };", "return null;")], ['L-vcmpS-carriesCmpSel', 'L-vcmpT-rtCmpSel'], ['vcmpS', 'vcmpT']),
    # (10-27 review) a formula summary dropped; sort levels on '#' / a journal column dropped, not captured, not applied
    'm-csformula': ([('main', "(typeof x === 'string' && /^[a-z_]{1,30}$/i.test(x))) ? x : undefined; });", "(typeof x === 'string' && x !== 'formula' && /^[a-z_]{1,30}$/i.test(x))) ? x : undefined; });")], ['L-vunit-csFormulaKept'], ['vunit']),
    'm-scvirtual': ([('main', "|| x.colIndex === '#' || (typeof x.colIndex === 'string' && /^__[A-Za-z0-9_]{1,120}$/.test(x.colIndex))", "")], ['L-vunit-scVirtualKept', 'L-vnumB-rtNumSort'], ['vunit', 'vnumA', 'vnumB']),
    'm-flatsc': ([('main', "if (Array.isArray(chainF) && chainF.some(", "if (false && chainF.some(")], ['L-vnumA-carriesNumSort', 'L-vnumB-rtNumSort'], ['vnumA', 'vnumB']),
    'm-flatscapply': ([('main', "if (v.sc) o.sortCriteria = v.sc.slice(); else delete o.sortCriteria;", "delete o.sortCriteria;")], ['L-vnumB-rtNumSort'], ['vnumA', 'vnumB']),
    # a long filter cut short; a snapshot view's positions carried; the Save list ticked; the drop order; the feedback token
    'm-longs': ([('main', "        if (longS) delete v.s;\n", "")], ['L-vunit-longFilterDropped'], ['vunit']),
    'm-snapvpos': ([('main', "if (v.m === 'flat' && !snapV) {", "if (v.m === 'flat') {")], ['L-vsnapv-snapNoPositions'], ['vsnapv']),
    'm-saveticked': ([('main', "(fromLink ? '' : ' checked')", "' checked'")], ['L-vfmsave-listUnticked'], ['vfmsave']),
    'm-dropgo': ([('main', "['f fi', 'Find'], ['go ga gp', 'open groups'],", "['f fi', 'Find'],")], ['S-dropOrder'], []),
    'm-feedbackcmp': ([('main', "return (b.token && !b.cmp) ? b.token : '';", "return b.token || '';")], ['S-feedbackNoCmp'], []),
    # (10-23 c) Stacked groups: the open set never captured / never restored
    'm-nogo': ([('main', "            if (gst) { v.go = gst.go; if (gst.ga) v.ga = true; if (gst.gb) v.gb = gst.gb; if (gst.gt) v.gt = gst.gt; }", "            if (gst) { }")], ['L-ggsA-carriesOpen', 'L-ggsB-rtOpen'], ['ggsA', 'ggsB']),
    'm-nostackapply': ([('main', "                else if (vlg.go || vlg.ga || vlg.gb || vlg.gt) setTimeout(function () { _pnbViewLinkStackTo(vlg); }, 300);\n", "")], ['L-vcmpT-rtOpen'], ['vcmpS', 'vcmpT']),
    # (round 3) a link's calculated columns never handed to the calc module
    'm-noccapply': ([('main', "                    window.PenumbraCalc.fromState(_pnbViewLink.cc, 'state');\n", "")], ['L-vccB-calcApplied'], ['vccA', 'vccB']),
    # the report's own calculated columns repeated in the link
    'm-ccdupe': ([('main', "return x && !rep[_pnbViewCalcKey(x)];", "return !!x;")], ['L-vccA-reportNotRepeated'], ['vccA']),
    # the calc dialog keeps its old &calc= link on a saved report
    'm-calcold': ([('calc', "var url = (vb && vb.url) ? vb.url : linkFor(r.def);", "var url = linkFor(r.def);")], ['L-vccA-calcDialogViewLink'], ['vccA']),
    # the Email option usable without the link ticked
    'm-maildisable': ([('main', "        $('#emailLinkAsView').prop('disabled', !_lrOn);\n", "")], ['L-vmail-disabledUntilLink'], ['vmail']),
    # the Email notice without the list of what the link carries
    'm-maillist': ([('main', "(_lrWhat.length ? _lrWhat.join('; ') : 'the report as it was saved, nothing changed')", "'your view'")], ['L-vmail-listsCustomizations'], ['vmail']),
    # the page captured but never turned to
    # (round 4) the link's theme never handed to the ?theme= override
    'm-nothemeboot': ([('main', "            if (!u.has('theme') && v.th) _penumbraUrlOverrides.theme = v.th;\n", "")], ['L-vthB-themeApplied'], ['vthA', 'vthB']),
    # any theme text let through, unchecked against the registry
    'm-themenoval': ([('main', "if (typeof d.th === 'string' && window.PENUMBRA_THEME_IDS && PENUMBRA_THEME_IDS.indexOf(d.th) !== -1) v.th = d.th;",
                      "if (typeof d.th === 'string') v.th = d.th;")], ['L-vbad-noAdminOverrides'], ['vbad']),
    # (round 5) the Share button keeps the ?state= link on a saved report
    'm-shareold': ([('main', "        if (_pnbViewLinkAvailable() === true) {\n            const vs = _pnbViewLinkBuild();", "        if (false) {\n            const vs = _pnbViewLinkBuild();")],
                   ['L-vshare-shareIsViewLink', 'L-vshare-shareToast'], ['vshare']),
    # Jarvis never told it may offer the view link
    'm-nochip': ([('prompt', ", viewlink (viewlink copies", " (viewlink copies")], ['S-jarvisChip'], []),
    # (round 6) the scroll never restored
    'm-noscroll': ([('main', "                if (vlk.m === 'flat') _pnbViewLinkScrollTo(vlk);\n", "")], ['L-vscrB-rtTopRow', 'L-vscrB-rtLeftCol'], ['vscrA', 'vscrB']),
    # Find reopened at its first match, not the sender's
    'm-findat': ([('find', "go(at >= 0 ? Math.min(at, hits.length - 1) : startIndex())", "go(startIndex())")], ['L-vfindB-rtMatch', 'L-vfindB-rtCell'], ['vfindA', 'vfindB']),
    # an open Find never captured
    'm-nofindcap': ([('main', "if (fcur && fcur.q && !cmp && !snapV) {", "if (false) {")], ['L-vfindA-carriesFind'], ['vfindA']),
    # (round 7) the Email dialog's Copy link does nothing
    'm-emailcopy': ([('main', "    $(document).on('click', '#emailCopyViewLink', function (e) {", "    $(document).on('click', '#emailCopyViewLinkX', function (e) {")], ['L-vmail-copyWithoutSending'], ['vmail']),
    'm-nopage': ([('main', "            currentPage = _pnbViewLink.pg;\n", "")], ['L-vpgB-rtPage', 'L-vpgstale-clamped'], ['vpgA', 'vpgB', 'vpgstale']),
    # the URL limit ignored
    'm-nolimit': ([('main', "            if (len <= LOCAL_STATE_URL_LIMIT || i >= PNB_VIEW_DROP_ORDER.length) break;", "            break;")], ['L-vlimit-fits'], ['vlimit']),
}

def static_checks(t):
    out = []
    idx, pal, form, main = t['index'], t['pal'], t['form'], t['main']
    out.append(('S-pakoForView', "isset($_GET['state']) || isset($_GET['view'])" in idx, 'index.php loads pako for ?view='))
    out.append(('S-copyButton', 'id="copyViewLinkBtn"' in idx and "<?php if (!empty($_GET['id'])): ?>" in idx.split('id="copyViewLinkBtn"')[0][-200:], 'the Copy dialog button, ?id= pages only'))
    out.append(('S-viewReadOnce', len(re.findall(r"\$_GET\['view'\]", idx)) <= 1 and "$_GET['view']" not in form, "?view= read by PHP only to load pako (no auth path touched)"))
    m = re.search(r"\{ id: 'viewlink', label: 'Copy a link to this view'.*?\},\n", pal, re.S)
    out.append(('S-paletteRow', bool(m) and all(k in m.group(0) for k in ('share', 'link', 'url', 'permalink', 'send view')) and 'PenumbraViewLink' in m.group(0), (m.group(0)[:200] if m else 'no row')))
    out.append(('S-feedbackLink', "preg_match('/^[A-Za-z0-9_-]+$/', $viewTok)" in form and "rawurlencode(trim((string)$reportRow['SHORT_ID']))\n            . '&view=' . $viewTok" in form
                and "htmlspecialchars($viewLink, ENT_QUOTES)" in form and "viewlink: ctx.id ? _pnbViewLinkToken() : ''" in main, 'the feedback email builds the link on the report id, token checked'))
    out.append(('S-emailOption', 'id="emailLinkAsView"' in idx and 'id="emailViewLinkRow"' in idx and "if ($('#emailLinkAsView').is(':checked')) {" in main
                and '#emailIncludeLink, #emailLinkAsView, #emailShowRecipients' in main and 'id="emailCopyViewLink"' in idx
                and "$(document).on('click', '#emailCopyViewLink', function (e) {" in main and 'Prepend link' not in idx, 'the Email dialog option, its link, its Copy link'))
    # (round 5) Jarvis may offer the view link as a chip: the prompt's action ids name it, the palette has the row
    sec = t['prompt'].split('SECTION 6: SUGGESTED QUICK ACTIONS')[1] if 'SECTION 6: SUGGESTED QUICK ACTIONS' in t['prompt'] else ''
    acts = re.search(r'id one of: ([a-z, -]+)', sec)
    out.append(('S-jarvisChip', bool(acts) and 'viewlink' in [a.strip() for a in acts.group(1).split(',')] and "{ id: 'viewlink'," in pal, 'viewlink in the prompt action ids and the palette registry'))
    # (10-27 review) the size trim drops scrolls and open groups before the grouping; no feedback token during a comparison
    dro = re.search(r'var PNB_VIEW_DROP_ORDER = \[(.*?)\];', main, re.S)
    dtx = dro.group(1) if dro else ''
    out.append(('S-dropOrder', bool(dtx) and "'go ga gp'" in dtx and "'gb gt gr gc tr lc'" in dtx and dtx.find("'go ga gp'") < dtx.find("['g', 'grouping']"), 'scrolls and open groups drop before the grouping'))
    out.append(('S-feedbackNoCmp', "return (b.token && !b.cmp) ? b.token : '';" in main, 'no feedback-email token during a comparison'))
    out.append(('S-help', 'viewLinkHelpLightbox' in t['manifest'] and 'Copy a link to this view' in t['topic'] and 'data-tip="us-tip-viewlink"' in t['tip'] and 'data-tip="us-tip-viewlink"' in idx, 'help topic + tip (defined + consumed) + manifest'))
    ui = re.findall(r'(?:Link copied|Opened a shared view|Copy a link to this view|Skipped, no longer|Left out to fit)[^"\n]*', main + idx + pal + t['topic'] + t['tip'])
    out.append(('S-noEmdash', bool(ui) and not any('\u2014' in x or '&mdash;' in x for x in ui) and '\u2014' not in t['topic'] + t['tip'], '%d UI strings' % len(ui)))
    return out

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    # (10-23) the comparison entry point and the compressor, for the vcmp* scenarios (cmpfoot's way)
    exp = ('try { window.__VL = {}; ["runComparisonAndDisplayGrouped", "compressString"].forEach(function (n) { try { window.__VL[n] = eval(n); } catch (e) { } }); window.__VL.setSnapView = function (b) { isViewingSnapshot = !!b; }; } catch (e) { }\r\n')
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
stage = tempfile.mkdtemp(prefix='pnb_vl_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('driver.js', 'seed.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
        call('Page.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if os.environ.get('PNB_SHOT') and path.startswith('harness.html?scn=' + os.environ.get('PNB_SHOT_SCN', 'vcapB')):
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot))
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
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_cellsel.js', texts['cellsel'])   # (10-27 b) over the LIBS copy (live's)
    w('penumbra_find.js', texts['find'])   # (round 6) Find under test   # (round 3) the calc module under test (its Copy link)

def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def run_browser(scns):
    out, res = [], {}
    pairs = {'vselB': 'vselA', 'vpselB': 'pvselA', 'vnumB': 'vnumA', 'vcmpT': 'vcmpS', 'ggsB': 'ggsA', 'ggcB': 'ggcA', 'ggvB': 'ggvA', 'vfitB': 'vfitA', 'vscrB': 'vscrA', 'vfindB': 'vfindA', 'vthB': 'vthA', 'vccB': 'vccA', 'vpgB': 'vpgA', 'vcapB': 'vcapA', 'vgrpB': 'gvA', 'vpivB': 'pvA', 'pflatB': 'vcapA'}
    for s in scns:
        token = STATIC_TOK.get(s)
        if s in pairs:
            a = res.get(pairs[s]) or {}
            token = (a.get('info') or {}).get('token') or 'none'
        if s == 'vcchB': token = ((res.get('vccA') or {}).get('info') or {}).get('halfToken') or 'none'
        path = url_for(s, token)
        if s == 'vcmpG':   # vcmpF's link after the group was hidden (its snapcmp= stripped: the comparison is run directly)
            pg_ = re.sub(r'&snapcmp=[^&]*', '', ((res.get('vcmpF') or {}).get('info') or {}).get('path') or '')
            path = pg_.replace('harness.html?', 'harness.html?scn=vcmpG&', 1) if pg_ else url_for(s, None)
        if s == 'vcmpT':
            pt_ = re.sub(r'&snapcmp=[^&]*', '', ((res.get('vcmpS') or {}).get('info') or {}).get('path') or '')
            path = pt_.replace('harness.html?', 'harness.html?scn=vcmpT&', 1) if pt_ else url_for(s, None)
        if s == 'ggcB':
            pc_ = re.sub(r'&snapcmp=[^&]*', '', ((res.get('ggcA') or {}).get('info') or {}).get('path') or '')
            path = pc_.replace('harness.html?', 'harness.html?scn=ggcB&', 1) if pc_ else url_for(s, None)
        if s == 'vcmpB':   # the link the comparison page built, opened as it is (its own snapcmp= and view=)
            pa = ((res.get('vcmpA') or {}).get('info') or {}).get('path') or ''
            # (the harness cannot boot a ?snapcmp= page - the comparison is run directly, as on A - so the
            # link opens without its snapcmp= and the page then runs the same comparison)
            pa = re.sub(r'&snapcmp=[^&]*', '', pa)
            path = (pa.replace('harness.html?', 'harness.html?scn=vcmpB&', 1) if pa else url_for(s, None))
        if s == 'vbad': path += '&expect_s=' + quote(BAD_S, safe='')
        if s == 'vunit': path += '&tcsf=' + T_CSF + '&tscv=' + T_SCV
        r = run_page(path); res[s] = r
        if r.get('fatal'):
            out.append(('F-' + s, False, r['fatal'][:3000])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}; info = r.get('info') or {}
        if s in pairs:
            a = res.get(pairs[s]) or {}; ai = a.get('info') or {}; av = ai.get('view') or {}; bv = info.get('view') or {}
            ad, bd = ai.get('dom') or {}, info.get('dom') or {}
            if s == 'vcapB':
                chk['rtSearch'] = bool(ad) and ad.get('search') == bd.get('search') == 'Alpha'
                chk['rtShown'] = bool(ad.get('shown')) and ad.get('shown') == bd.get('shown')
                chk['rtRows'] = bool(ad.get('rows')) and ad.get('rows') == bd.get('rows')
                if not chk['rtRows']: info = {'rowsA': ad.get('rows'), 'rowsB': bd.get('rows'), 'fx': info.get('fx'), 'steps': ai.get('steps')}
                for k, c in (('o', 'rtSort'), ('fz', 'rtFrozen'), ('w', 'rtWidths'), ('fm', 'rtFormats'), ('c', 'rtLayout')):
                    chk[c] = av.get(k) is not None and same(av.get(k), bv.get(k))
            if s == 'vgrpB': chk['rtGrouped'] = bd.get('grouped') is True and bv.get('m') == 'group' and (bv.get('g') or {}).get('by') == (av.get('g') or {}).get('by') == 'H_GROUP'
            if s == 'vpivB': chk['rtPivot'] = bd.get('pivot') is True and bv.get('m') == 'pivot'
            if s == 'pflatB': chk['flatOverPivot'] = bd.get('pivot') is False and bd.get('flat') is True and bv.get('m') == 'flat'
            if s in ('vscrB', 'vfindB'):
                aw, bw = ai.get('where') or {}, info.get('where') or {}
                chk['rtTopRow'] = bool(aw.get('row')) and aw.get('row') == bw.get('row')
                chk['rtLeftCol'] = bool(aw.get('col')) and aw.get('col') == bw.get('col')
            if s == 'vfindB':
                chk['rtMatch'] = ai.get('fcur') is not None and ai.get('fcur') == info.get('fcur')
                ac, bc = ai.get('cell') or {}, info.get('cell') or {}
                chk['rtCell'] = bool(ac.get('id')) and ac.get('id') == bc.get('id') and ac.get('col') == bc.get('col')
            if s in ('ggsB', 'vcmpT'):
                chk['rtOpen'] = bool(ai.get('open')) and ai.get('open') == info.get('open')
                chk['rtBoxTop'] = bool(ai.get('top')) and ai.get('top') == info.get('top')
                if s == 'ggsB': chk['rtPageTop'] = bool(ai.get('page')) and ai.get('page') == info.get('page')
                if s == 'vcmpT': chk['rtSort'] = bool(ai.get('sortIds')) and ai.get('sortIds') == info.get('sortIds')
            if s == 'vnumB': chk['rtNumSort'] = bool(ai.get('rows')) and ai.get('rows') == info.get('rows')
            if s in ('vselB', 'vpselB'): chk['rtSel' if s == 'vselB' else 'rtPivSel'] = ((ai.get('sel') or {}).get('n') or 0) > 0 and ai.get('sel') == info.get('sel')
            if s == 'vcmpT': chk['rtCmpSel'] = ((ai.get('cmpSel') or {}).get('n') or 0) > 0 and ai.get('cmpSel') == info.get('cmpSel')
            if s == 'ggcB' or s == 'ggvB':
                chk['rtGroup'] = bool(ai.get('sel')) and ai.get('sel') == info.get('sel')
                chk['rtGroupTop'] = bool(ai.get('top')) and ai.get('top') == info.get('top')
            if s == 'vpgB': chk['rtPage'] = bool(ad.get('page')) and ad.get('page') == bd.get('page') and ad.get('rows') == bd.get('rows')
            if s == 'vfitB': chk['rtShares'] = bool(av.get('w')) and same(av.get('w'), bv.get('w'))
            if s in ('vcapB', 'vgrpB', 'vpivB', 'vccB', 'vthB'): chk['rtView'] = bool(av) and same(av, bv)
            if not same(av, bv) and s != 'pflatB': info['diff'] = {k: [av.get(k), bv.get(k)] for k in set(av) | set(bv) if not same(av.get(k), bv.get(k))}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s   info %s' % (v, json.dumps(info)[:900]) if v is not True else ''))
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
