# =============================================================================
# SPLIT BY A DELIMITER SUITE (delimgroup, 2026-10-26)
#
# Group mode groups a text column whose cells hold a LIST by each value in it:
# PI_LIST:dsemi puts a "Lname1, Fname1;Lname2, Fname2" row in both names' groups.
# The token names the delimiter (:dsemi :dpipe :dcomma :dtab :dnl :dspace). A
# delimiter is offered only where splitting on it groups (a space only when it
# clearly does); the header menu's Group by lists As is and the column's buckets;
# Copy distinct values gains a pipe. Totals count each row once (the All groups
# bar, the status bar, the (Other) rollup, the counters); the shares that would
# add up past 100% are left off. schedule_runner.php groups the same way.
#
#   page half   harness.html (mk_harness.py) + driver.js: the REAL main.js and
#               js/penumbra_colmenu.js through the real run path (stubbed query.php)
#               on a 60-row fixture. Scenarios unit / render / nested / menu /
#               snippet / bucket.                        P-* U-* G-* N-* C-* K-* H-* E-*
#   runner half php_check.php on a MIRROR of schedule_runner.php
#               (pivotparity\extract_mirror.php: its functions only, never included)
#               against the browser's own fixture and bands: the same groups. X-*
#
#   py -3 run.py                        live js\main.js + js\penumbra_colmenu.js + schedule_runner.php
#   py -3 run.py --stage DIR            DIR\main.js + DIR\penumbra_colmenu.js + DIR\schedule_runner.php
#   py -3 run.py --control [--rev REV]  the build before the change: EXACTLY CONTROL_RED fail.
#                                       Before the deploy that is the live files; after it, REV^
#                                       from git (CONTROL_REV below once it is set).
#   py -3 run.py --stage DIR --mutants  each fix site put back -> exactly its asserts red
#   py -3 run.py --mutant NAME | --scn a,b | --keep
#
# Headless Edge over CDP; stages into %TEMP%\pnb_dg_*; writes nothing to the webroot.
# Run from a LOCAL cwd copy or cd into this folder first. One headless suite at a time.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(errors='backslashreplace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EXTRACT = os.path.join(os.path.dirname(HERE), 'pivotparity', 'extract_mirror.php')
if not os.path.isfile(EXTRACT):
    EXTRACT = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import git_show
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_SCN = ['unit', 'render', 'nested', 'menu', 'snippet', 'bucket', 'json', 'detect', 'chart', 'lists', 'copy']
# (splitviz) main.js loads these on demand from js/ beside the page: the chart scenario draws a real vis() chart
CHART_LIBS = ['chart-4.5.1.min.js', 'chartjs-plugin-datalabels-2.0.0.min.js', 'chartjs-chart-treemap-3.1.0.min.js',
              'chartjs-chart-sankey-0.19.1.min.js', 'penumbra_charts.js', 'penumbra_geo_us.js']
# Two rounds. --control = the LATEST round (jsontot, 2026-10-26: a nested @@JSON grouping counts each row once):
# before its deploy the control is the live files, after it CONTROL_REV from git. --control-delim = the split
# round's (live since e69cea1): e69cea1^, where the json round's checks are red as well.
# Each round's control is verified at its deploy and recorded in the README; --control runs the LATEST round's
# (grpbucket 2026-10-26: the split offered for a real list, the dialog's second dropdown, the XLSX outline footer).
# Before its deploy the control is the live files; after it CONTROL_REV from git.
# The grpbucket round went LIVE as 815d7ac; its control (815d7ac^) was exact at its deploy (CONTROL_RED_GRPBUCKET).
# --control now runs the splitviz round's (2026-10-26: a chart and the value lists split a list column; the list
# rule's fixes): before its deploy the live files, after it CONTROL_REV from git.
# The cfread round's control was cea7ce4^ (CONTROL_RED_CFREAD). --control now runs the sparse round's (2026-10-27: a
# list few cells hold two values of is offered its split when those cells are packed): before its deploy the live
# files, after it CONTROL_REV from git.
CONTROL_REV = '5cee2a4^'   # LIVE since 5cee2a4 (2026-10-27, sparse): the control is the build before it, read from git

NBSP = chr(160)
# The split rule's cases: [delimiter id, cell, the values]. The browser and the runner must agree
# on every one (U-pieces / X-pieces).
PIECE_CASES = [
    ['dsemi', 'a; b ;a;;', ['a', 'b']],
    ['dsemi', '', []],
    ['dsemi', '   ', []],
    ['dsemi', '@@HTML<b>x</b>;<i>y</i>', ['x', 'y']],
    ['dsemi', 'X;x', ['X', 'x']],
    ['dsemi', 'x' + NBSP + ';' + NBSP + 'y', ['x' + NBSP, NBSP + 'y']],
    ['dsemi', 'Lname1, Fname1;Lname2, Fname2;Lname3, Fname3', ['Lname1, Fname1', 'Lname2, Fname2', 'Lname3, Fname3']],
    ['dsemi', '\ta\t;\x0bb', ['a', 'b']],
    ['dnl', 'a\r\nb\rc\nd\n\n', ['a', 'b', 'c', 'd']],
    ['dspace', ' a  b a ', ['a', 'b']],
    ['dspace', 'a\tb c', ['a\tb', 'c']],
    ['dtab', 'a\tb\t a', ['a', 'b']],
    ['dpipe', 'a|b| c|', ['a', 'b', 'c']],
    ['dcomma', 'Smith, Ann', ['Smith', 'Ann']],
    ['dcomma', '2025,2024,2025', ['2025', '2024']],
    # (splitviz) a cell reads as the search reads it: entities decoded before the split (main.js decodeHtmlEntities:
    # the six names and the numeric forms; &nbsp; is a plain space), so the entity's own ; splits nothing
    ['dsemi', 'Population Health&amp;Pathobiology', ['Population Health&Pathobiology']],
    ['dsemi', 'A &amp; B; C&#59;D', ['A & B', 'C', 'D']],
    ['dcomma', 'x&nbsp;, &lt;y&gt;, z', ['x', 'z']],   # (decoded first: <y> is then a tag, stripped as the search strips it)
    ['dsemi', 'a&copy;b;c&#x41;', ['a&copy', 'b', 'cA']],
    # (cfread, 2026-10-26) the runner's twin is now penumbra_search.php's _search_decode_entities: the two entities of
    # a surrogate pair make the one character they spell (the old twin dropped both halves), and a code of 16+ decimal /
    # 14+ hex digits is rounded to a double first, as parseInt does (the old twin read its exact low 16 bits: C and I)
    ['dsemi', 'a&#55357;&#56832;b;&#xD83D;&#xDE00;', ['a' + chr(0x1F600) + 'b', chr(0x1F600)]],
    ['dsemi', 'x&#10000000000000067;;&#x123456789AC0049;y', ['xD', 'Py']],
]

# What the build before the change gets wrong - and ONLY that. E-render: its dialog offers no split, so the
# scenario's Apply runs with no column and the app alerts "Please select a column to group by.". X-notag holds
# there (no row is tagged); X-plain does not (it has no penumbra_grouped_row_total to agree with the sum).
CONTROL_RED = ['U-pieces', 'U-parse', 'U-label', 'U-spec', 'U-detect', 'U-variants',
               'G-picker', 'G-closed', 'G-bands', 'G-rows', 'G-nohide', 'G-total', 'G-bandsum', 'G-shares', 'G-status', 'C-viz', 'G-preview',
               'G-searchpills', 'G-searchstatus', 'K-count', 'G-other', 'G-csort', 'E-render',
               'N-bands', 'N-shares', 'N-total', 'N-status', 'N-path',
               'H-pipe', 'H-list', 'H-split', 'H-tick', 'H-asis', 'H-date', 'K-snippet', 'K-bucket',
               'X-pieces', 'X-parse', 'X-group', 'X-total', 'X-nested', 'X-nesttotal', 'X-other', 'X-plain']
# The json round (jsontot): the build before it groups by a nested field the same way (P-jbands, X-jgroup hold) but
# counted a row once per group in the bar, the status bar, (Other), the counter and the preview, and showed shares.
CONTROL_RED_JSON = ['J-total', 'J-shares', 'J-status', 'J-preview', 'J-searchstatus', 'K-jcount', 'J-other', 'X-jtotal', 'X-jother']
CONTROL_RED_DELIM = CONTROL_RED + CONTROL_RED_JSON
# The grpbucket round's control (the live build before it, 12bbda7): NEW checks red - U-detect (a list like ?id=jjornl's
# PI_LIST, LEADS, was not offered), the second dropdown (G-picker G-closed G-follow G-reopen G-reopenbin) and the runner's
# outline sheet (X-xfoot X-xband X-xfilter X-xsumfilter X-xstale: 223,596.61 as listed for 138,716.19) - and every check
# downstream of a split now picked through that dropdown: nothing is grouped there (the render and nested flows, the
# browser's outline export, E-render's "select a column" alert), so the runner half has no screen bands to match either.
CONTROL_RED_GRPBUCKET = ['U-detect', 'G-picker', 'G-closed', 'G-follow', 'G-bands', 'G-rows', 'G-nohide', 'G-total', 'G-bandsum', 'G-shares',
                      'G-status', 'C-viz', 'G-preview', 'G-searchpills', 'G-searchstatus', 'K-count', 'G-other', 'G-csort', 'E-render',
                      'N-bands', 'N-shares', 'N-total', 'N-status', 'B-xlsx', 'N-path', 'G-reopen', 'G-reopenbin',
                      'X-group', 'X-nested', 'X-other', 'X-xfoot', 'X-xband', 'X-xfilter', 'X-xsumfilter', 'X-xstale']
# The splitviz round's control (live 815d7ac, before it): EXACTLY its new checks red - the entity split cases in both engines
# (U-pieces X-pieces), the list rule (D-entity D-pair D-projects; D-titles D-thousands hold - guards), the chart split
# (V-*; charting a grouped view read the column as it is: C-viz) and the value lists (L-*; Most common filtered whole cells:
# "Kim, Di" found 5 rows of 21; Column stats summed lists of project numbers to ~3e36). L-search and X-search hold: both
# search engines already read the list-item condition alike.
CONTROL_RED_SPLITVIZ = ['U-pieces', 'C-viz', 'D-entity', 'D-pair', 'D-projects', 'V-rows', 'V-count', 'V-sum', 'V-series', 'V-click', 'V-view', 'V-unknown', 'V-exclude', 'V-cntok', 'V-builder', 'V-chart', 'V-clickui', 'V-panel', 'L-profile', 'L-numlist', 'L-menu', 'L-copy', 'L-parse', 'L-state', 'L-strip', 'L-chip', 'L-chip2', 'X-pieces']
# The cfread round's control (2026-10-26: the runner's delimiter decoder = penumbra_search.php's _search_decode_entities):
# the build before it reads the two new split cases' surrogate pair and long codes its own way - X-pieces alone (the
# browser's U-pieces holds: main.js is unchanged). Before its deploy the live files; after it CONTROL_REV from git.
CONTROL_RED_CFREAD = ['X-pieces']
# The sparse round's control (2026-10-27): the build before it offers a split only when one cell in twenty lists two
# values, so the two packed code lists (2 of 60 cells) get none - D-packed D-packednl. D-spaced and D-onelist hold there
# (guards: the waiver must not reach a spaced list or a lone one). main.js alone changes.
CONTROL_RED_LATEST = ['D-packed', 'D-packednl']
CONTROL_RED_SPARSE = CONTROL_RED_LATEST   # (the sparse round, LIVE since 5cee2a4: its control was 5cee2a4^)
# The copymenu round's control (2026-10-27: Copy > Distinct values > Each value in the lists > For SQL): the build before it
# offers no For SQL - L-copysql alone. Before its deploy the live files; after it CONTROL_REV from git.
CONTROL_RED_COPYMENU = ['L-copysql']   # (the copymenu round, LIVE since a8aabf9: its control is a8aabf9^)
# --control now runs the cpsplit round's (2026-10-27: Each value in the lists in the Copy dialog, under the header menu's
# Other... and in copy_distinct|COL:dsemi): before its deploy the live files, after it CONTROL_REV from git.
# The cpsplit round's control (2026-10-27): the build before it has no box in the Copy dialog (Q-box; Q-copy copies whole
# cells ticked or not; Q-remember; the split's Other... is missing: Q-other; Q-snippet writes the column alone), reads
# copy_distinct|PI_LIST:dsemi as a column named so and finds none (Q-trigger Q-trignl). main.js and
# penumbra_colmenu.js change; the runner does not.
# And the Copy list's names as the user asked them (Q-labels): This value, This row, Distinct values there.
CONTROL_RED_LATEST = ['Q-box', 'Q-copy', 'Q-remember', 'Q-other', 'Q-snippet', 'Q-trigger', 'Q-trignl', 'Q-labels']
CONTROL_REV = '9ca7d60^'   # LIVE since 9ca7d60 (2026-10-27, cpsplit): the control is the build before it, read from git
CONTROL_RED_CPSPLIT = CONTROL_RED_LATEST   # (the cpsplit round, LIVE since 9ca7d60: its control was 9ca7d60^)
# The copymenu 2 round's control (2026-10-27; the user took For SQL out again): the build before it offers For SQL under
# "Each value in the lists" - L-copynosql alone. Before its deploy the live files; after it CONTROL_REV from git.
CONTROL_RED_LATEST = ['L-copynosql']
CONTROL_REV = '0d19cfd^'   # LIVE since 0d19cfd (2026-10-27, copymenu 2): the control is the build before it, read from git.
def scn_of(aid):
    pre = aid.split('-')[0]
    return {'U': 'unit', 'C': 'render', 'N': 'nested', 'H': 'menu', 'X': 'php', 'J': 'json', 'B': 'nested',
            'D': 'detect', 'V': 'chart', 'L': 'lists', 'Q': 'copy'}.get(pre) or \
        {'K-count': 'render', 'K-snippet': 'snippet', 'K-bucket': 'bucket', 'K-jcount': 'json', 'P-jbands': 'json',
         'G-reopen': 'bucket', 'G-reopenbin': 'bucket'}.get(aid) or \
        ('render' if pre == 'G' else aid.split('-', 1)[1] if pre in ('P', 'E', 'F') else '?')

# --- mutants: one fix site put back (on the FIXED build) -> the asserts that MUST go red --------
NL = '\r\n'
MUTANTS = {
    # main.js
    'l0multi': ('main', [('                if (_gbMulti) {' + NL + '                    // Split by a delimiter (2026-10-26, delimgroup): the row joins the',
                          '                if (false) {' + NL + '                    // Split by a delimiter (2026-10-26, delimgroup): the row joins the')]),
    'labeler': ('main', [('        if (spec && spec.multi) {' + NL + '            return function (rowEl) {' + NL + '                var raw = _groupRowRaw(rowEl, base);',
                          '        if (false) {' + NL + '            return function (rowEl) {' + NL + '                var raw = _groupRowRaw(rowEl, base);')]),
    'sublvl': ('main', [('const _kl = Array.isArray(_ks) ? _ks : [_ks];', 'const _kl = [_ks];')]),
    'pathtot': ('main', [('_sls = Array.isArray(_sl) ? _sl : [_sl], _next = [];', '_sls = [String(_sl)], _next = [];')]),
    'gtotal': ('main', [('        if (_groupHasMultiLevel()) $rows = _groupDistinctRows($rows);' + NL, '')]),
    'sharetot': ('main', [('var t = (_shMultiDepth >= 0 && _shDepth >= _shMultiDepth) ? null : pct(val, totalRaw);', 'var t = pct(val, totalRaw);')]),
    'sharepar': ('main', [('            if (parent && !_shOwnSplit) {', '            if (parent) {')]),
    'status': ('main', [("const _grcSeen = _groupHasMultiLevel() ? Object.create(null) : null;", 'const _grcSeen = null;')]),
    'other': ('main', [('var _otherSeen = (_gbMulti || isVirtualGrouping) ? new Set() : null;', 'var _otherSeen = isVirtualGrouping ? new Set() : null;')]),
    # (jsontot) a nested @@JSON grouping: each fix site put back as it was
    'jother': ('main', [('var _otherSeen = (_gbMulti || isVirtualGrouping) ? new Set() : null;', 'var _otherSeen = _gbMulti ? new Set() : null;')]),
    'jlevels': ('main', [('            if (!multi && i === 0 && !t.split) {', '            if (false) {')]),
    'jcount': ('main', [('                                        _seenMatch[_mVal] = true;' + NL + '                                        groupSet[_mVal] = true;',
                         '                                        _seenMatch[_mVal] = true;' + NL + '                                        matching++;' + NL + '                                        groupSet[_mVal] = true;')]),
    'jpreview': ('main', [('        var _pgbOnce = !!(_pgbSpec && _pgbSpec.multi) || isVirtualGroup;', '        var _pgbOnce = !!(_pgbSpec && _pgbSpec.multi);')]),
    'cmkeys': ('main', [('var _cmSpec = (isGrouped && !isVirtualGrouping) ? groupBucketSpec(groupCol) : null;', 'var _cmSpec = null;')]),
    'preview': ('main', [('            } else if (_pgbSpec && _pgbSpec.multi) {', '            } else if (false) {')]),
    'previewrows': ('main', [('        if (_pgbOnce) matchingRows = Object.keys(_pgbSeenRows).length;' + NL, '')]),
    'trim': ('main', [("var p = parts[i].replace(/^[ \\t\\n\\r\\0\\x0B]+|[ \\t\\n\\r\\0\\x0B]+$/g, '');", 'var p = parts[i].trim();')]),
    'space': ('main', [('                if (pieceN >= rawN || multi < vals.length * 0.5 || pieceN * 2 > rawN || shared < memb * 0.8) continue;', '                if (false) continue;')]),
    'onesplit': ('main', [('        for (var d = 0; d < PENUMBRA_GROUP_DELIM_ORDER.length && !out.length; d++) {', '        for (var d = 0; d < PENUMBRA_GROUP_DELIM_ORDER.length; d++) {')]),   # (splitviz: was inner)
    'cssort': ('main', [('var entry = _csEntryForColumn((_csSf && _csSf.delim) ? _csSf.base : cacheKey);', 'var entry = _csEntryForColumn(cacheKey);')]),
    'snippet': ('main', [('const _gcBkt = !!(_gcSpec.split || _gcSpec.delim);', 'const _gcBkt = !!_gcSpec.split;')]),
    'viz': ('main', [("            if (sp.delim) warn.push(pivotFieldDisplayLabel(t) + ': a row counts once under each value its cell lists, so the bars add up to more than the rows.');", "            if (false) warn.push('');")]),
    'hdrapi': ('main', [('return _groupBucketVariantsFor(String(col)).map(function (v) {', 'return [].map(function (v) {')]),
    'variants': ('main', [("        if (kind !== 'date') {" + NL + '            // A text column whose cells list several values', '        if (false) {' + NL + '            // A text column whose cells list several values')]),
    'label': ('main', [("        if (sf.delim) return sf.base + ' (split by ' + groupDelimDef(sf.delim).sym + ')';   // delimgroup" + NL, '')]),
    # js/penumbra_colmenu.js
    'menulist': ('colmenu', [("            if (!gvar.length) { return { act: 'groupBy', label: label, run: function () { window.Penumbra.groupByColumn(col); } }; }",
                              "            return { act: 'groupBy', label: label, run: function () { window.Penumbra.groupByColumn(col); } };")]),
    'tick': ('colmenu', [('var on = grouped && gcol === v.token;', 'var on = false;')]),
    'pipe': ('colmenu', [("['pipe', 'A pipe', '|'], ", '')]),
    # schedule_runner.php
    'xpieces': ('runner', [('        $p = trim($p);' + NL + "        if ($p === '' || isset($seen['#' . $p])) continue;",
                            "        $p = trim($p, ' ');" + NL + "        if ($p === '' || isset($seen['#' . $p])) continue;")]),
    'xparse': ('runner', [('if ($split === null && $i === 1 && count($parts) === 2 && penumbra_group_delim_def($p) !== null) {', 'if (false) {')]),
    'xnested': ('runner', [('foreach ((is_array($label) ? $label : array($label)) as $l) {', "foreach (array(is_array($label) ? implode(';', $label) : $label) as $l) {")]),
    'xother': ('runner', [('                        if (isset($seenRid[$rid])) continue;' + NL, '')]),
    'xtotal': ('runner', [("    if (is_array($st) && $st['groups'] === count($grouped) && $st['members'] === $members) return $st['rows'];" + NL, '')]),
    'xstrip': ('runner', [('                    unset($_rows[$_ri][PENUMBRA_GROUP_ROWID]);' + NL, '')]),
    'xtag': ('runner', [('            if ($_gbRowIds) {' + NL + '                foreach ($data as $_ri => $_rr)', '            if (false) {' + NL + '                foreach ($data as $_ri => $_rr)')]),
    'xjtag': ('runner', [('                $_gbRowIds = true;' + NL + '                foreach ($data as $_ri => $_rr) { if (is_array($_rr)) $data[$_ri][PENUMBRA_GROUP_ROWID] = $_ri; }' + NL + '                $grouped = array();',
                          '                $grouped = array();')]),
    # (grpbucket round) delimfix: the list rule; grpbucket: the dialog's second dropdown; xlsxfoot: the outline sheet
    'detectshared': ('main', [('            if (shared < memb * 0.3) continue;' + NL, '')]),
    'detectstrict': ('main', [("                if (id === 'dcomma' && (tight || (pieceN >= rawN && (nLens < 3 || spaced > pieceN * 0.1)))) continue;", '                if (pieceN >= rawN) continue;')]),
    'bucketsync': ('main', [("        if (_grpLevelM) _groupSyncBucketSelect(_grpLevelM[1] ? parseInt(_grpLevelM[1], 10) - 1 : 0);" + NL, '')]),
    'bucketwrite': ('main', [("        var nt = base + (this.value || '');", '        var nt = base;')]),
    'pickertext': ('main', [("        if (suffix) $('#' + pid + ' .pcs-selected').text(base);" + NL, '')]),
    'bucketcur': ('main', [('        if (suffix && !have) {', '        if (false) {')]),
    'xfoot': ('runner', [("        if ($sheetName === 'Grouped Data' && !empty($_xlBands) && isset($_xlRids) && $_xlRids !== null && count($_xlRids) === count($rawRows)) {", '        if (false) {')]),
    'xsub': ('runner', [('                    : _xlsx_subtree_count($data, $apath, $_xlIds);', '                    : _xlsx_subtree_count($data, $apath);')]),
    'xids': ('runner', [("        if ($_sig !== null) $_out['_groupRowIds'] = array('ids' => $_ridsByGroup, 'sig' => $_sig);", '        if (false) { }')]),
    'xcopy1': ('runner', [("        $apiResult['_groupRowIds'] = isset($reprocessed['_groupRowIds']) ? $reprocessed['_groupRowIds'] : null;   // (xlsxfoot)" + NL, '')]),
    'xcopy2': ('runner', [("    $apiResult['_groupRowIds'] = isset($reprocessed['_groupRowIds']) ? $reprocessed['_groupRowIds'] : null;" + NL, '')]),
    'xsig': ('runner', [("        if (count($gi['ids'][$k]) !== count($rows) || md5(serialize($rows)) !== $gi['sig'][$k]) return null;" + NL, '')]),
    'xlabel': ('runner', [("    if (!empty($sf['delim'])) { $_dd = penumbra_group_delim_def($sf['delim']); return $sf['base'] . ' (split by ' . $_dd['sym'] . ')'; }   // delimgroup" + NL, '')]),
    # (splitviz, 2026-10-26) the list rule, the chart split, the value lists - one fix site each
    'decode': ('main', [("        var s = decodeHtmlEntities((raw === null || raw === undefined) ? '' : String(raw));", "        var s = (raw === null || raw === undefined) ? '' : String(raw);")]),
    'pairrule': ('main', [("                if (id === 'dcomma' && nLens === 1 && lens[2] && mixed < sharedN * 0.2) continue;   // a pair, not a list", '')]),
    'commaspaced': ('main', [('(pieceN >= rawN && (nLens < 3 || spaced > pieceN * 0.1))', '(pieceN >= rawN && (nLens < 3))')]),
    'commawaiver': ('main', [('(pieceN >= rawN && (nLens < 3 || spaced > pieceN * 0.1))', '(pieceN >= rawN)')]),
    'tight': ('main', [("                    if (id === 'dcomma' && kind === 'num' && /,(?![ \\t])/.test(_pnbFsCellText(vals[j]))) tight = true;", '')]),
    'numkind': ('main', [("        if (kind === 'date') return out;", '        if (kind) return out;')]),
    # (sparse, 2026-10-27) the one-in-twenty floor whole again; a cell packed whatever its white space; the new line
    # read as white space; one list enough (none still skips: a column listing nothing twice is no list)
    'packedfloor': ('main', [('            if (multi < vals.length * 0.05 && packed < multi * 0.9) continue;', '            if (multi < vals.length * 0.05) continue;')]),
    'packedws': ('main', [('                    if (!/[ \\t\\n\\r\\x0B]/.test(bare)) packed++;', '                    packed++;')]),
    'packednl': ('main', [("                    if (id === 'dnl') bare = bare.replace(/\\r\\n|\\r|\\n/g, ''); else if (id === 'dtab') bare = bare.replace(/\\t/g, '');", '')]),
    'twolists': ('main', [('            if (multi < 2) continue;', '            if (multi < 1) continue;')]),
    # (cpsplit, 2026-10-27) each fix site put back
    'dlgsplit': ('main', [('const _splitId = _pnbQuick ? (_pnbQuick.split || null) : _copySplitId();', 'const _splitId = _pnbQuick ? (_pnbQuick.split || null) : null;')]),
    'dlgbox': ('main', [('            ? (_groupDelimVariantsFor(col)[0] || null) : null;', '            ? null : null;')]),
    'dlgremember': ('main', [("            split: $('#copySplitInput').is(':checked')   // (2026-10-27, cpsplit)", '            split: false')]),
    'dlgrestore': ('main', [("        $('#copySplitInput').prop('checked', !!(lastCopySettings && lastCopySettings.split));   // (2026-10-27, cpsplit)", '')]),
    'otherbox': ('main', [("            $('#copySplitInput').prop('checked', !!split);   // (2026-10-27, cpsplit) Each value in the lists' Other...", '')]),
    'cmother': ('colmenu', [("                    sub.push({ act: 'copy-split-other', label: 'Other...',", "                    if (false) sub.push({ act: 'copy-split-other', label: 'Other...',")]),
    'trigtok': ('main', [("const distColRaw = distTok.delim ? String(distTok.base) : (args[0] || '');", "const distColRaw = args[0] || '';")]),
    'trigsplit': ('main', [('                        if (distTok.delim) {   // each value the lists hold, once, in order', '                        if (false) {')]),
    'trigraw': ('main', [('const raw = distTok.delim ? _groupRowRaw(this, distName) : null;', 'const raw = null;')]),
    'snippettok': ('main', [("const colTok = col + (_copySplitId() ? ':' + _copySplitId() : '');", 'const colTok = col;')]),
    # (cpsplit) the Copy list's names
    'vallabel': ('colmenu', [("label: valueLabel(cvt), long: 'Copy this value', title: cvt,", "label: 'This value', long: 'Copy this value', title: cvt,")]),
    'valcut': ('colmenu', [("(s.length > 28 ? s.slice(0, 27) + '...' : s)", 's')]),
    'valblank': ('colmenu', [("return s === '' ? '(blank)' : ", 'return ')]),
    'rowlabel': ('colmenu', [("label: 'This entire row', long: 'Copy this row'", "label: 'This row', long: 'Copy this row'")]),
    'distlabel': ('colmenu', [("shortCopy(u, 'Distinct column values')", "shortCopy(u, 'Distinct values')")]),
    'binfirst': ('main', [("        } else if (kind === 'num' && !_groupDelimVariantsFor(col).length && _groupBinWorthwhile(col)) {", "        } else if (kind === 'num' && _groupBinWorthwhile(col)) {")]),
    'vizsplit': ('main', [('        if (spec && spec.delim && rowDataMaps && rowDataMaps.length) return _vizSplitRows(rowDataMaps, xAxis, spec);', '')]),
    'splitskip': ('main', [("        if (rows[0] && typeof rows[0].has === 'function' && rows[0].has(key)) return rows;", '')]),
    'keepowner': ('main', [('        if (!ex.owner) return rows.filter(function (r, i) { return pass(ex.probe[i]); });', '        if (true) return rows.filter(function (r, i) { return pass(ex.probe[i]); });')]),
    'panelsplit': ('main', [('            filteredRows = _chartDrillSplits(_fpFields) ? _chartDrillProbe(sourceRows, _fpFields).filter(_fpPass)', '            filteredRows = false ? _chartDrillProbe(sourceRows, _fpFields).filter(_fpPass)')]),
    'clickkeep': ('main', [('            var matchingRows = _chartDrillKeep(sourceRows, drillFields, rowFilter);', '            var matchingRows = sourceRows.filter(function (r) { return rowFilter(r); });')]),
    'searchpart': ('main', [('            return FS.itemCond(spec.base, spec.delim, [String(val)]);', "            return '{' + field + '} = //' + val + '//';")]),
    'vizvariants': ('main', [("            return dv.map(function (d) { return { token: d.token, label: 'Split by ' + d.sym, phrase: 'split by ' + d.sym, delim: d.id }; });", '            return [];')]),
    'optiontext': ('main', [("        if (sf.delim) return sf.base + ' split by ' + groupDelimDef(sf.delim).sym;", '')]),
    'note': ('main', [("    $(document).on('change.vizSplitNote', '#vizXAxis, #vizGroupBy', vizSyncSplitNoteUI);", '')]),
    'cntok': ('main', [("            if (p.delim) return String(p.base).toUpperCase() + ':' + p.delim;   // (2026-10-26, splitviz)", '')]),
    'fsauto': ('main', [('                                f.split = dv.length ? dv[0].id : false;', '                                f.split = false;')]),
    'fsgroups': ('main', [('            var fsVals = !f.split ? function (row) { return [_pnbFsCellText(row.get(col))]; } : function (row) {', '            var fsVals = true ? function (row) { return [_pnbFsCellText(row.get(col))]; } : function (row) {')]),
    'fsdom': ('main', [("                     split: $(this).attr('data-fs-split') || false };", '                     split: false };')]),
    'profitems': ('main', [('        var dv = _groupDelimVariantsFor(name)[0] || null, ifreq = dv ? new Map() : null;', '        var dv = null, ifreq = null;')]),
    'profnum': ('main', [('        if (values && allNum && !ifreq) {', '        if (values && allNum) {')]),
    'filteritem': ('main', [("        var C = String(col || '').toUpperCase(), fields = [{ col: C, split: delim }];", "        var C = String(col || '').toUpperCase(), fields = [{ col: C, blank: true }];")]),
    'copysplit': ('main', [('                if (_splitId) {', '                if (false) {')]),   # (cpsplit) re-anchored
    'fsparse': ('tiles', [("                if (m === 'split') { f.split = 'auto'; continue; }  // chips for the values a list holds (2026-10-26)", '')]),
    'fsstate': ('tiles', [("                if (ied && ((im[5] === '=' && iff.mode !== 'ex') || (im[5] === '!=' && iff.mode === 'ex'))", "                if (false && ied && ((im[5] === '=' && iff.mode !== 'ex') || (im[5] === '!=' && iff.mode === 'ex'))")]),
    'fscompose': ('tiles', [("            if (f.split && fsItemEdges(f.split)) { parts.push(fsItemCond(col, f.split, vals, f.mode === 'ex')); return; }   // (2026-10-26)", '')]),
    'fsrender': ('tiles', [(' + ((f.split && fsItemEdges(f.split)) ? \' data-fs-split="\' + f.split + \'"\' : \'\')', '')]),
    'fswhole': ('tiles', [("                if (f && !(f.split && fsItemEdges(f.split)) && ((op === '=' && f.mode !== 'ex') || (op === '!=' && f.mode === 'ex'))) {", "                if (f && ((op === '=' && f.mode !== 'ex') || (op === '!=' && f.mode === 'ex'))) {")]),
    'cmitems': ('colmenu', [('        if (p.items && p.items.top.length) {', '        if (false) {')]),
    'cmcopy': ('colmenu', [("        var dv = (typeof A.groupVariants === 'function') ? (A.groupVariants(col) || []).filter(function (v) { return v.delim; })[0] : null;", '        var dv = null;')]),
    'xdecode': ('runner', [("    $s = penumbra_delim_decode_entities(($raw === null) ? '' : (string)$raw);", "    $s = ($raw === null) ? '' : (string)$raw;")]),
    # (cfread, 2026-10-26) the runner's own decoder back in place of penumbra_search.php's twin
    'xdelimown': ('runner', [('function penumbra_delim_decode_entities($s) {' + NL + '    return _search_decode_entities($s);',
                              'function penumbra_delim_decode_entities($s) {' + NL + NL.join([
                                  "    if (strpos($s, '&') === false) return $s;",
                                  "    return preg_replace_callback('/&(amp|lt|gt|quot|apos|nbsp|#(\\d+)|#x([0-9a-fA-F]+));/', function ($m) {",
                                  '        static $map = array(\'amp\' => \'&\', \'lt\' => \'<\', \'gt\' => \'>\', \'quot\' => \'"\', \'apos\' => "\'", \'nbsp\' => \' \');',
                                  "        if (isset($m[2]) && $m[2] !== '') $code = (int)$m[2];",
                                  "        elseif (isset($m[3]) && $m[3] !== '') $code = (int)hexdec($m[3]);",
                                  '        else return isset($map[$m[1]]) ? $map[$m[1]] : $m[0];',
                                  '        $c = $code & 0xFFFF;',
                                  '        if ($c < 0x80) return chr($c);',
                                  '        if ($c < 0x800) return chr(0xC0 | ($c >> 6)) . chr(0x80 | ($c & 0x3F));',
                                  "        if ($c >= 0xD800 && $c <= 0xDFFF) return '';",
                                  '        return chr(0xE0 | ($c >> 12)) . chr(0x80 | (($c >> 6) & 0x3F)) . chr(0x80 | ($c & 0x3F));',
                                  '    }, $s);',
                              ]))]),
}
MUTANT_RED = {
    # (G-total, G-other and G-csort hold here: the cell grouped whole still counts each row once, and on this fixture
    #  the whole-cell bands drop the same rows into (Other) and order the same three single-name bands first)
    'l0multi': ['G-bands', 'G-rows', 'G-bandsum', 'G-status', 'G-searchpills', 'G-searchstatus', 'K-snippet', 'H-split'],
    'labeler': ['N-bands', 'N-path', 'B-xlsx'],   # (B-xlsx: the export lists each row under its whole-cell group once)
    'sublvl': ['N-bands', 'N-path', 'B-xlsx'],
    'pathtot': ['N-path'],
    'gtotal': ['G-total', 'N-total', 'B-xlsx'],   # (B-xlsx: the export's last row IS the All groups bar)
    'sharetot': ['G-shares'],
    'sharepar': ['N-shares'],
    'status': ['G-status', 'G-searchstatus', 'N-status'],
    'other': ['G-other'],
    'cmkeys': ['K-count', 'K-bucket'],
    'preview': ['G-preview'],
    'previewrows': ['G-preview', 'J-preview'],   # (jsontot) the rows-once covers a nested field's groups too
    'trim': ['U-pieces'],
    'space': ['U-detect'],
    'onesplit': ['U-detect', 'G-picker'],
    'cssort': ['G-csort'],
    'snippet': ['K-snippet'],
    'viz': ['C-viz'],
    'hdrapi': ['H-list', 'H-split', 'H-tick', 'H-asis', 'H-date'],
    'variants': ['U-variants', 'G-picker', 'G-closed', 'G-follow', 'G-bands', 'G-rows', 'G-nohide', 'G-total', 'G-bandsum', 'G-shares', 'G-status', 'C-viz', 'G-preview',
                 'G-searchpills', 'G-searchstatus', 'K-count', 'G-other', 'G-csort', 'E-render', 'H-list', 'H-split', 'H-tick', 'H-asis'],
    'label': ['U-label'],   # (grpbucket) the closed picker shows the column alone, not the variant's label
    'menulist': ['H-list', 'H-split', 'H-tick', 'H-asis', 'H-date'],
    'tick': ['H-tick'],
    'pipe': ['H-pipe'],
    'xpieces': ['X-pieces'],
    'xparse': ['X-parse', 'X-group', 'X-total', 'X-nested', 'X-other',   # (nothing is tagged; the nested stack keeps STATUS)
               'X-xfoot', 'X-xband', 'X-xfilter', 'X-xsumfilter', 'X-xstale'],   # (grpbucket) no tags = no row indexes for the outline
    'xnested': ['X-group', 'X-nested', 'X-other', 'X-xsumfilter'],   # (grpbucket) the summary filter re-runs the nested grouping
    'xother': ['X-other', 'X-jother'],   # (jsontot) shared with the nested @@JSON grouping
    'xtotal': ['X-total', 'X-nesttotal', 'X-jtotal'],
    'xstrip': ['X-notag', 'X-nesttotal', 'X-other', 'X-jtotal', 'X-jother'],
    'xtag': ['X-total', 'X-nesttotal', 'X-other', 'X-xfoot', 'X-xband', 'X-xfilter', 'X-xsumfilter', 'X-xstale'],
    'xlabel': ['X-parse'],
    'detectshared': ['U-detect'],
    'detectstrict': ['U-detect'],
    'bucketsync': ['G-picker', 'G-closed', 'G-follow', 'N-bands', 'G-reopen', 'G-reopenbin',   # every split is picked through the dropdown
                   'N-shares', 'N-total', 'N-status', 'B-xlsx', 'N-path', 'G-bands', 'G-rows', 'G-nohide', 'G-total', 'G-bandsum',
                   'G-shares', 'G-status', 'C-viz', 'G-preview', 'G-searchpills', 'G-searchstatus', 'K-count', 'G-other', 'G-csort', 'E-render'],
    'bucketwrite': ['G-closed', 'N-bands', 'N-shares', 'B-xlsx', 'N-path', 'G-bands', 'G-rows', 'G-nohide', 'G-bandsum',   # the column as is
                    'G-shares', 'G-status', 'C-viz', 'G-preview', 'G-searchpills', 'G-searchstatus', 'K-count'],
    'pickertext': ['G-closed', 'G-reopen', 'G-reopenbin'],
    'bucketcur': ['G-reopenbin'],
    'xfoot': ['X-xfoot', 'X-xfilter', 'X-xsumfilter'],
    'xsub': ['X-xband'],
    'xids': ['X-xfoot', 'X-xband', 'X-xfilter', 'X-xsumfilter', 'X-xstale'],
    'xcopy1': ['X-xfilter'],
    'xcopy2': ['X-xsumfilter'],
    'xsig': ['X-xstale'],
    'jother': ['J-other'],
    # (the nested field no longer counts as a level that puts a row in several groups: the bar, the status bar, shares)
    'jlevels': ['J-total', 'J-shares', 'J-status', 'J-searchstatus'],
    'jcount': ['K-jcount'],
    'jpreview': ['J-preview'],
    'xjtag': ['X-jtotal', 'X-jother'],
    # (splitviz)
    'decode': ['U-pieces', 'D-entity', 'L-strip'],
    'pairrule': ['D-pair'],
    'commaspaced': ['D-titles'],
    'commawaiver': ['D-projects', 'L-numlist'],
    'tight': ['D-thousands'],
    'numkind': ['D-projects', 'L-numlist'],
    'packedfloor': ['D-packed', 'D-packednl'],
    'packedws': ['D-spaced'],
    'packednl': ['D-packednl'],
    'twolists': ['D-onelist'],
    'dlgsplit': ['Q-copy'],
    'dlgbox': ['Q-box', 'Q-copy', 'Q-remember', 'Q-other', 'Q-snippet'],
    'dlgremember': ['Q-remember'],
    'dlgrestore': ['Q-remember'],
    'otherbox': ['Q-other'],
    'cmother': ['Q-other'],
    'trigtok': ['Q-trigger', 'Q-trignl'],
    'trigsplit': ['Q-trigger', 'Q-trignl'],
    'trigraw': ['Q-trignl'],
    'snippettok': ['Q-snippet'],
    'vallabel': ['Q-labels'],
    'valcut': ['Q-labels'],
    'valblank': ['Q-labels'],
    'rowlabel': ['Q-labels'],
    'distlabel': ['Q-labels'],
    'binfirst': ['D-projects'],
    'vizsplit': ['V-rows', 'V-count', 'V-sum', 'V-series', 'V-click', 'V-view', 'V-exclude', 'V-chart', 'V-clickui', 'V-panel'],
    'splitskip': ['V-panel'],
    'keepowner': ['V-click', 'V-exclude', 'V-clickui'],
    'panelsplit': ['V-panel'],
    'clickkeep': ['V-clickui'],
    'searchpart': ['V-view', 'V-unknown'],
    'vizvariants': ['V-builder'],
    'optiontext': ['V-builder'],
    'note': ['V-builder'],
    'cntok': ['V-cntok'],
    'fsauto': ['L-strip', 'L-chip', 'L-chip2'],
    'fsgroups': ['L-strip'],
    'fsdom': ['L-chip', 'L-chip2'],
    'profitems': ['L-profile', 'L-numlist', 'L-menu'],
    'profnum': ['L-numlist'],
    'filteritem': ['L-menu'],
    'copysplit': ['L-copy', 'Q-copy'],   # (cpsplit) the dialog's box; (copymenu 2) no For SQL to read the split
    'fsparse': ['L-parse', 'L-strip', 'L-chip', 'L-chip2'],
    'fsstate': ['L-state', 'L-chip', 'L-chip2'],
    'fscompose': ['L-state', 'L-menu', 'L-chip', 'L-chip2'],
    'fsrender': ['L-strip', 'L-chip', 'L-chip2'],
    'fswhole': ['L-state'],
    'cmitems': ['L-menu'],
    'cmcopy': ['L-copy', 'L-copynosql', 'Q-other'],   # (cpsplit) the split list holds Other... too; (copymenu 2) with no list L-copynosql has none to read
    'xdecode': ['X-pieces'],
    'xdelimown': ['X-pieces'],   # (cfread) the surrogate pair and the long codes
}
def mutant_scns(name):
    which = MUTANTS[name][0]
    if which == 'runner': return ['php']
    reds = MUTANT_RED[name]
    return sorted(set(scn_of(a) for a in reds if scn_of(a) != 'php'))

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
def pick(stage_name, rel):
    return os.path.join(stage_dir, stage_name) if stage_dir else os.path.join(APP, rel)
main_path = opt('--main', pick('main.js', os.path.join('js', 'main.js')))
cm_path = opt('--colmenu', pick('penumbra_colmenu.js', os.path.join('js', 'penumbra_colmenu.js')))
sr_path = opt('--runner', pick('schedule_runner.php', 'schedule_runner.php'))
tl_path = opt('--tiles', pick('penumbra_tiles.js', os.path.join('js', 'penumbra_tiles.js')))   # (splitviz) the strip grammar
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
    rev = rev or CONTROL_REV
    if rev:
        main_path, cm_path, sr_path = git_show(rev, 'js/main.js'), git_show(rev, 'js/penumbra_colmenu.js'), git_show(rev, 'schedule_runner.php')
        tl_path = git_show(rev, 'js/penumbra_tiles.js')
    else:
        main_path, cm_path, sr_path = os.path.join(APP, 'js', 'main.js'), os.path.join(APP, 'js', 'penumbra_colmenu.js'), os.path.join(APP, 'schedule_runner.php')
        tl_path = os.path.join(APP, 'js', 'penumbra_tiles.js')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook (and setCso, which
    writes the closure's customSortOrders); hideLoading counts its calls."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['groupDelimPieces', 'pivotParseFieldToken', 'pivotFieldDisplayLabel', 'groupBucketSpec', '_groupBucketVariantsFor',
             '_groupDelimVariantsFor', '_previewGroupedAggMatch', 'groupsToVizConfig', 'runTableSearch', 'getGroupSummaryLabel',
             'createXlsxWorkbook',
             # (splitviz) the chart split, its drill and the builder's lists; the strip and Column stats
             'vizBucketRowsForAxis', 'generateChartDataFromMaps', '_buildChartClickCriteria', '_chartDrillKeep', '_chartDrillProbe',
             '_chartDrillSearchPart', '_vizBucketVariantsFor', 'populateVisualizationColumns', '_vizEnsureXOption', '_cnTok',
             'parseAdvancedQuery', 'evaluateParsedQuery', '_pnbFsGroups', 'liveUpdateChartFromFilters']
    h = ('\r\n;try { window.__JG = { master: function () { try { return eval("masterRowData"); } catch (e) { return null; } },'
         ' setCso: function (v) { customSortOrders = v; try { _csInvalidateComparators(); } catch (e) {} } }; } catch (e) { window.__JG_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__JG[k] = eval(k); } catch (e) { (window.__JG_MISSING = window.__JG_MISSING || []).push(k); } }); } catch (e) { window.__JG_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__JG_HIDES = (window.__JG_HIDES || 0) + 1;\r\n')

def mutate(srcs, name):
    which, edits = MUTANTS[name]
    s = srcs[which]
    for old, new in edits:
        n = s.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:110]))
        s = s.replace(old, new)
    out = dict(srcs); out[which] = s
    return out

# --- staging + browser ------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_dg_')
os.makedirs(os.path.join(stage, 'c'))
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, 'c', f))
shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, 'c', 'main.css'))
shutil.copyfile(os.path.join(app_dir, 'css', 'penumbra_colmenu.css'), os.path.join(stage, 'c', 'penumbra_colmenu.css'))
# (xlsxfoot) main.js loads ExcelJS on demand from js/ beside the page: the browser's XLSX export (B-xlsx)
os.makedirs(os.path.join(stage, 'c', 'js'))
shutil.copyfile(os.path.join(app_dir, 'js', 'exceljs-4.4.0.min.js'), os.path.join(stage, 'c', 'js', 'exceljs-4.4.0.min.js'))
for f in CHART_LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, 'c', 'js', f))
html = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
html = html.replace('<script src="driver.js"></script>', '<script src="cases.js"></script>\n<script src="driver.js"></script>')
open(os.path.join(stage, 'c', 'harness.html'), 'wb').write(html.encode('utf-8'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'c', 'driver.js'))
open(os.path.join(stage, 'c', 'cases.js'), 'wb').write(('window.__PIECE_CASES = ' + json.dumps(PIECE_CASES) + ';\n').encode('utf-8'))

def write_build(srcs):
    open(os.path.join(stage, 'c', 'main_dg.js'), 'wb').write(hook(srcs['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'c', 'penumbra_colmenu_dg.js'), 'wb').write(srcs['colmenu'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'c', 'penumbra_tiles_dg.js'), 'wb').write(srcs['tiles'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'runner.php'), 'wb').write(srcs['runner'].encode('utf-8', 'surrogateescape'))

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
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same files
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/c/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__DGDONE ? JSON.stringify(window.__DGRESULT) : null', 'returnByValue': True})
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

def run_php(obs):
    """The runner half: the mirror of the candidate schedule_runner.php against the browser's
    fixture and bands (render + nested scenarios)."""
    if not obs.get('fixture') or obs.get('bands') is None or obs.get('nested') is None:
        return [('X-input', False, 'no browser fixture/bands to compare with (render + nested must run first)')]
    mir = os.path.join(stage, 'mirror.php')
    r1 = subprocess.run([PHP, '-n', EXTRACT, os.path.join(stage, 'runner.php'), mir], capture_output=True, text=True)
    if r1.returncode != 0 or not os.path.isfile(mir):
        return [('X-mirror', False, 'extract_mirror failed: %s' % (r1.stdout + r1.stderr)[-300:])]
    inp = os.path.join(stage, 'php_in.json')
    open(inp, 'w', encoding='utf-8').write(json.dumps({'rows': obs['fixture'], 'cases': PIECE_CASES, 'bands': obs['bands'], 'nested': obs['nested'],
                                                    'jrows': obs.get('jfixture'), 'jbands': obs.get('jbands'),
                                                    'lrows': obs.get('lfixture'), 'searches': obs.get('searches')}))
    env = dict(os.environ); env['PENUMBRA_APP'] = app_dir
    r2 = subprocess.run([PHP, '-n', os.path.join(HERE, 'php_check.php'), mir, inp], capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    out = r2.stdout
    k = out.find('RESULTS_JSON:')
    if k < 0: return [('X-run', False, 'php_check gave no results: %s' % (out + r2.stderr)[-400:])]
    return [(a['id'], a['ok'], a['detail']) for a in json.loads(out[k + len('RESULTS_JSON:'):])['results']]

def run_suite(srcs, scns, obs_in=None):
    write_build(srcs)
    res, obs = [], dict(obs_in or {})
    for s in scns:
        if s == 'php': continue
        r = run_page(s)
        if r.get('fatal'):
            res.append(('F-' + s, False, 'fatal: ' + str(r['fatal'])[:400])); continue
        if r.get('hookErr'): res.append(('H-hook-' + s, False, 'hook: %s' % r.get('hookErr')))
        for a in r.get('asserts', []): res.append((a['id'], a['ok'], a['detail']))
        res.append(('E-' + s, not r.get('errors'), 'page errors: %s' % (r.get('errors') or 'none')))
        o = r.get('obs', {}) or {}
        if r.get('missing'): o['missing'] = r['missing']
        for k in ('fixture', 'bands', 'nested', 'jfixture', 'jbands', 'lfixture', 'searches'):
            if k in o: obs[k] = o[k]
        obs['scn:' + s] = {k: v for k, v in o.items() if k not in ('fixture', 'bands', 'nested', 'jfixture', 'jbands', 'lfixture', 'searches')}   # never obs[s]: a scenario is named nested
    if 'php' in scns: res.extend(run_php(obs))
    return res, obs

try:
    scns = scn_arg.split(',') if scn_arg else ALL_SCN + ['php']
    if 'php' in scns:   # the runner half compares with what the browser rendered
        for need in ('render', 'nested', 'json', 'lists'):
            if need not in scns: scns.insert(0, need)
    srcs = {'main': read_b(main_path), 'colmenu': read_b(cm_path), 'runner': read_b(sr_path), 'tiles': read_b(tl_path)}
    print('candidate: %s + %s + %s + %s%s' % (main_path, cm_path, sr_path, tl_path, '   (CONTROL: the build before the change)' if control else ''), flush=True)
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        base_obs = None
        if any(MUTANTS[n][0] == 'runner' for n in names):   # the runner's mutants compare with the FIXED build's own bands
            _, base_obs = run_suite(srcs, ['render', 'nested', 'json', 'lists'])
        ok_n = bad_n = 0
        for name in names:
            must = MUTANT_RED[name]
            sc = mutant_scns(name)
            res, _ = run_suite(mutate(srcs, name), sc, base_obs if sc == ['php'] else None)
            red = [a for a, ok, _ in res if not ok]
            missing = [m for m in must if m not in red]
            stray = [a for a in red if a not in must]
            good = not missing and not stray
            msg = ('turns exactly %s red' % ' '.join(must)) if good else \
                  ('stayed GREEN on %s; also red: %s' % (' '.join(missing) or '-', ' '.join(stray) or '-'))
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-12s %s' % ('PASS' if good else 'FAIL', name, msg), flush=True)
            if not good:
                for a, ok, d in res:
                    if not ok: print('        %s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res, obs = run_suite(srcs, scns)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %-16s %s' % ('PASS' if ok else 'FAIL', aid, detail[:420]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        for s in scns:
            o = obs.get('scn:' + s) or {}
            if o: print('  obs %-7s %s' % (s, json.dumps(o)[:700]))
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            want = [a for a in (CONTROL_RED_LATEST or []) if scn_of(a) in scns]
            exact = sorted(failed) == sorted(want)
            print('CONTROL: %s (expected red: %s)' % ('red set is EXACTLY the documented change' if exact else 'red set DIFFERS from CONTROL_RED', ' '.join(want)))
            if not exact:
                print('  unexpected red: %s' % ' '.join(a for a in failed if a not in want))
                print('  expected but green: %s' % ' '.join(a for a in want if a not in failed))
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
