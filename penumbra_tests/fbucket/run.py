# =============================================================================
# FBUCKET SUITE (2026-11-06): a bucket of a column in a filter - the Visual Search Builder's second dropdown.
#
# The user: "expand the visual search builder to offer a second dropdown column when a bucketable column is
# selected -- similar to grouping. This includes numbers/currency, columns detected with a delimiter, and most
# importantly -- dates ... Remember there is also a filter input in the scheduler that needs to match."
# A condition's column may carry a bucket, named as grouping, pivots and charts name it (LOG_DATE:fy = FY26,
# AMOUNT:binlog = '100,000 - 999,999', PI_LIST:dsemi = 'Jones, Jacob'), read the same way by the browser
# (js/main.js) and the server (penumbra_search.php: a scheduled task's filter).
#
#   B-<slug>   the BROWSER (real main.js, headless Edge) returns exactly the corpus's rows
#   Q-<slug>   the SERVER (penumbra_search.php php_apply_search_filter) returns exactly the corpus's rows
#   K-<slug>   both engines name the same bucket token for every condition (null = a plain column)
#   L-<n>      label parity: the browser's bucket labels == the server's, over 514 texts x buckets
#   R-<n>      ...and == the runner's own grouping labels of the text (pivot_split_bucket_label & co, the
#              twins pivotparity holds to main.js's grouping): the search reads a bucket as grouping names it
#   A1-A9      the builder's API: bucket value lists in the grouped view's order, a column's buckets, compare
#   U0-U20     the Visual Search Builder driven over CDP (real main.js API + builder + markup + css)
#   D1-D19     (phase 2) the filter boxes' lists: a column's buckets under it in the report's and the Scheduler's box
#              (none in a box of another kind), typed tokens' values, picks, Alt+Down, a double-click (README)
#   O1-O4      (phase 2) openBucketRow (the palette's Filter COLUMN by...) and the splitColumnToken export
#   H-boot     both pages booted without page errors
#
#   py -3 run.py                        the live files
#   py -3 run.py --stage DIR            DIR\js\main.js, DIR\js\search_builder.js, DIR\css\search_builder.css,
#                                       DIR\penumbra_search.php (missing -> live)            EXPECTED: GREEN
#   py -3 run.py --control              the four files at CONTROL_REV (the build before fbucket): every bucket
#                                       assert red, the plain-column ones green (see CONTROL_GREEN)
#   py -3 run.py --stage DIR --mutants  every mutant on DIR's files: EXACTLY its asserts red
#   py -3 run.py --stage DIR --mutant NAME
# Needs py -3, the PHP 8.2 CLI, websocket-client. Stages into %TEMP% (pnb_fbucket_*); writes nothing to the
# webroot. One headless suite at a time on this workstation: it waits while another runs.
# =============================================================================
import argparse, html, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = os.path.dirname(HERE)
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
EXTRACT = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_tiles.js']
REL = {'main': 'js/main.js', 'sb': 'js/search_builder.js', 'css': 'css/search_builder.css', 'search': 'penumbra_search.php'}
# The build before this round: live when the round was staged; '<deploy sha>^' once installed.
CONTROL_REV = '4b725a0^'
CR = '\r\n'

with open(os.path.join(HERE, 'corpus.json'), encoding='utf-8') as _f:
    CORPUS = json.load(_f)

R = []
def rec(i, name, ok, detail=''):
    R.append((i, name, bool(ok), (detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=True))[:600]))
def log(s): print(s, flush=True)
def read(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

# ---- the mutants: one single behaviour each (file key, old, new, the asserts that MUST go red - exactly) -------
BKT = [q['slug'] for q in CORPUS['queries'] if q['bucket']]
def B(*s): return ['B-' + x for x in s]
def Q(*s): return ['Q-' + x for x in s]
RANGE = ['fy-ge', 'fy-lt-century', 'month-ge', 'month-ge-lower', 'ym-between', 'year-gt', 'hour-ge', 'bin-ge']
ALLB = ['B-' + s for s in BKT]
ALLQ = ['Q-' + s for s in BKT]
ALLK = ['K-' + s for s in BKT]
MUTANTS = {
    # ---- the browser engine (js/main.js) ----
    'js-parse':   ('main', "            const _sbk = penumbraSearchBucketOf(currentTokens[0], columnMap);",
                           "            const _sbk = null;", None),
    'js-eval':    ('main', "            if (condition.bucket) return penumbraSearchBucketPart(condition, rowDataMap, getCellValue, testCondition);",
                           "            if (false) return null;", None),
    'js-order':   ('main', "        if (a === null || c === null) return null;",
                           "        return null;", None),
    'js-neg':     ('main', "        var neg = (op === '!=' || op === '<>' || op === '!/');",
                           "        var neg = false;", None),
    'js-cap':     ('main', "            n = (t !== s) ? v.sortVal(t) : null;",
                           "            n = null;", None),
    'js-colon':   ('main', "        if (has.call(columnMap, t.toUpperCase())) return null;   // a column whose own name holds a colon",
                           "        // (mutant) no colon guard", None),
    'js-auto':    ('main', "(b.width || pivotResolveAutoBinWidth(String(b.base).toUpperCase(), (typeof masterRowData !== 'undefined' && masterRowData) ? masterRowData : []))",
                           "(b.width || 1)", None),
    'js-values':  ('main', "            if (_sbkV) return penumbraSearchBucketValues(_sbkV);",
                           "            if (false) return null;", None),
    'js-binbake': ('main', "                if (sx === ':bin') {",
                           "                if (false) {", None),
    # ---- the server engine (penumbra_search.php) ----
    'php-parse':  ('search', "        $sbk = _search_bucket_of($firstToken, $columnMap);",
                             "        $sbk = null;", None),
    'php-braced': ('search', "        if ($sbk !== null && $condition !== null && $condition['type'] === 'condition') {",
                             "        if (false) {", None),
    'php-eval':   ('search', "            if (isset($part['bucket'])) {   // a bucket of a column (2026-11-06, fbucket): the cell's bucket in place of its text",
                             "            if (false) {", None),
    'php-order':  ('search', "    if ($a === null || $c === null) return null;",
                             "    return null;", None),
    'php-neg':    ('search', "    $neg = ($op === '!=' || $op === '<>' || $op === '!/');",
                             "    $neg = false;", None),
    'php-cap':    ('search', "        $n = ($t !== null && $t !== $s) ? _search_bucket_sort_val1($split, $t) : null;",
                             "        $n = null;", None),
    'php-colon':  ('search', "    if (isset($columnMap[strtoupper($t)])) return null;   // a column whose own name holds a colon",
                             "    // (mutant) no colon guard", None),
    'php-auto':   ('search', "    $parsedQuery = _search_bucket_auto_widths($parsedQuery, $data, $viewMode);",
                             "    // (mutant) no auto width", None),
    'php-fy':     ('search', "    $fy = ($m1 >= 7) ? $y + 1 : $y;",
                             "    $fy = $y;", None),
    'php-trim':   ('search', r'            $p = trim($p, " \t\n\r\0\x0B");',
                             "            $p = $p;", None),
    'php-binsedge': ('search', "        if ($n >= $edges[$i]) {",
                               "        if ($n > $edges[$i]) {", None),
    # ---- the builder (js/search_builder.js, css/search_builder.css) ----
    'sb-token':   ('sb', "        return col ? col + rowBucketSuffix($row) : '';",
                         "        return col;", None),
    'sb-presetsplit': ('sb', "            if (_pTok && _pTok.sx) preset = $.extend({}, preset, { column: _pTok.column });",
                             "            // (mutant)", None),
    'sb-syncafter': ('sb', "        syncBucketSelect($row, (_pTok && _pTok.sx) || '');   // (fbucket) the column's buckets, the preset's picked",
                           "        syncBucketSelect($row, '');", None),
    'sb-colchange': ('sb', "            syncBucketSelect($row, '');   // (2026-11-06, fbucket) the new column's buckets, As is",
                           "            // (mutant)", None),
    'sb-wide':    ('sb', "        $('#searchBuilderLightbox .sb-lightbox-content').toggleClass('sb-wide',",
                         "        $('#searchBuilderLightbox .sb-lightbox-content').toggleClass('sb-wide-off',", None),
    'sb-removewidth': ('sb', "        syncBuilderWidth();   // (fbucket) the last bucket row gone: the dialog's own width again",
                             "        // (mutant)", None),
    'sb-calendar': ('sb', "        if (_sbx) { showBucketTip($row, colName + _sbx); return; }",
                          "        if (false) { return; }", None),
    'sb-rangewarn': ('sb', "            $warn.toggle(_bcmp === 1);",
                           "            $warn.toggle(false);", None),
    'sb-revcontains': ('sb', "            if (singleRemainder && !resolvedCol && bucketTokenOf(singleColName)) {",
                             "            if (false) {", None),
    'sb-clearvalue': ('sb', "            // A value of the column (2025-07-01) is no label of a bucket, nor one bucket's label another's" + CR + "            $row.find('.sb-value-input').val('');",
                            "            // (mutant)", None),
    'sb-valuelist': ('sb', "        var colName = rowColumnToken($row);   // (fbucket) a bucket's labels are its values",
                           "        var colName = $row.find('.sb-col-select').val() || '';", None),
    'css-wide':   ('css', ".sb-lightbox-content.sb-wide {" + CR + "    width: 78%;",
                          ".sb-lightbox-content.sb-wide-off {" + CR + "    width: 78%;", None),
    'sb-names':   ('sb', "        return Object.prototype.hasOwnProperty.call(BUCKET_NAMES, sx) ? BUCKET_NAMES[sx] : sx.substring(1);",
                         "        return sx.substring(1);", None),
    # ---- (fbucket 2) the filter boxes' lists, the builder opened on a bucket row ----
    'sb2-box': ('sb', "        return selector === '#tableSearch' || selector === '#schedSearchFilter';",
        '        return false;', None),
    'sb2-items': ('sb', "                            if (_acBuckets && (group.key === 'visible' || group.key === 'hidden')) {",
        '                            if (false) {', None),
    'sb2-filter': ('sb', '                        filteredCols = _acBuckets ? filterColumnItems(columnItems, lastWord) : $.ui.autocomplete.filter(columnItems, lastWord);',
        '                        filteredCols = $.ui.autocomplete.filter(columnItems, lastWord);', None),
    'sb2-tokstart': ('sb', "            return !!t && !!up && (t.indexOf(up) === 0 || t.indexOf(' ' + up) !== -1);",
        '            return !!t && !!up && t.indexOf(up) !== -1;', None),
    'sb2-bk0': ('sb', "                if (bk0) return { colName: bk0, partial: '' };",
        '                if (false) return null;', None),
    'sb2-bk1': ('sb', "                if (bk1) return { colName: bk1, partial: '' };",
        '                if (false) return null;', None),
    'sb2-bk2': ('sb', '                    if (bk2) return { colName: bk2, partial: partial };',
        '                    if (false) return null;', None),
    'sb2-bk3': ('sb', '                if (bk3) return { colName: bk3, partial: partial };',
        '                if (false) return null;', None),
    'sb2-prefix': ('sb', '                if (_acBuckets && bucketPrefixClause(clauseCandidate, colMap)) return null;',
        '                // (mutant)', None),
    'sb2-dbl': ('sb', '                if ((_bL || _bR) && _isLikelyColumnPosition(fullText, _bS)) sel = _bS;',
        '                // (mutant)', None),
    'sb2-tokorder': ('sb', "                        var labelLower = String(col.tok || col.label || col.value || '').toLowerCase();   // (fbucket 2) a bucket by its token",
        "                        var labelLower = String(col.label || col.value || '').toLowerCase();", None),
    'sb2-brace': ('sb', "                    var _bh = (_bo !== -1 && _bv.indexOf('}', _bo) === -1) ? _bv.substring(0, _bo) : _bv.replace(/\\S*$/, '');",
        "                    var _bh = _bv.replace(/\\S*$/, '');", None),
    'sb2-render': ('sb', "                    $li.addClass('sb-autocomplete-bucket');",
        '                    // (mutant)', None),
    'sb2-trail': ('sb', '            if (!found && buckets) found = trailingBucketOf(cand, names);',
        '            // (mutant)', None),
    'sb2-taken': ('sb', '        return vars.filter(function (v) { return !taken[(name + v.sx).toUpperCase()]; }).map(function (v) {',
        '        return vars.map(function (v) {', None),
    'sb2-budget': ('sb', '            if (performance.now() > until) { _acWarm(); return []; }',
        '            // (mutant) no time cap', None),
    'sb2-warm': ('sb', '            if (_acWarming || !_acBuckets) return;',
        '            return;', None),
    'sb2-takenb': ('sb', '            if (resolveColumnName(col + v.sx)) return;   // (fbucket 2) Q:fy names the column Q:fy: no Fiscal Year for Q',
        '            // (mutant)', None),
    'sb2-row': ('sb', "            if (_bAsk && _bAsk.column && _sbMode.target === '#tableSearch') $bRow = addBucketRow(_bAsk);",
        '            // (mutant)', None),
    'sb2-rowlist': ('sb', "                    if ($bIn.is(':visible')) { $bIn.focus(); triggerAutocomplete($bIn, true); }",
        '                    // (mutant)', None),
    'sb2-empty': ('sb', "            rowCounter = 0;\r\n            $('#sbConditionsContainer').empty();\r\n        }\r\n        addConditionRow({ column: ask.column + ask.sx, operator: 'equals' });",
        "        }\r\n        addConditionRow({ column: ask.column + ask.sx, operator: 'equals' });", None),
    'sb2-export': ('sb', '        splitColumnToken: splitColumnToken,',
        '        // (mutant)', None),
    'css2-indent': ('css', '.sb-autocomplete-bucket .ui-menu-item-wrapper {\r\n    padding-left: 38px;',
        '.sb-autocomplete-bucket .ui-menu-item-wrapper {\r\n    padding-left: 24px;', None),
}
# The red set each mutant must give, EXACTLY (calibrated 2026-11-06 on the stage, each one read and explained:
# README "Mutants"). Kept beside this file: the parse mutants' sets run to a hundred names.
_EXP = os.path.join(HERE, 'mutants_expect.json')
if os.path.isfile(_EXP):
    with open(_EXP, encoding='utf-8') as _f:
        _e = json.load(_f)
    MUTANTS = dict((k, (v[0], v[1], v[2], _e.get(k))) for k, v in MUTANTS.items())
# The build before fbucket: every bucket query red in both engines, the label parities, the API, the builder's
# bucket steps; green: the plain-column / unknown-name / no-match queries, the K- tokens (both null), A5, U0, U3,
# U19, U20, H-boot.
CONTROL_RED = (['B-' + s for s in BKT] + ['Q-' + s for s in BKT] + ['L-parity', 'R-parity', 'A1', 'A2', 'A3', 'A4', 'A6', 'A7', 'A8', 'A9']
               + ['U%d' % i for i in [1, 2] + list(range(4, 19)) + [21]]
               # (fbucket 2) the boxes' lists and openBucketRow: all red but D6 (a box of another kind lists none), D12 (Q:fy
               # stays the column) and D16 (a plain column) - none of which needs the round
               + ['D%d' % i for i in [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20]] + ['O1', 'O2', 'O3', 'O4'])

def git_show(rev, rel):
    r = subprocess.run(['git', '--git-dir=' + GIT_DIR, 'show', '%s:%s' % (rev, rel)], capture_output=True)
    if r.returncode != 0: raise SystemExit('git show %s:%s failed: %s' % (rev, rel, r.stderr.decode('utf-8', 'replace')[:300]))
    return r.stdout.decode('utf-8', 'surrogateescape')

def files_from(stage, rev):
    out = {}
    for k, rel in REL.items():
        if rev: out[k] = git_show(rev, rel); continue
        p = os.path.join(stage, rel.replace('/', os.sep)) if stage else None
        out[k] = read(p) if (p and os.path.isfile(p)) else read(os.path.join(APP, rel.replace('/', os.sep)))
    return out

def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_fbucket_' } | "
          "Measure-Object | ForEach-Object { $_.Count }")
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60).stdout
        return int((out or '0').strip() or 0)
    except Exception:
        return 0

HOOKS = ('try { window.__FB = { parseQ: parseAdvancedQuery, evalQ: evaluateParsedQuery, flatCols: penumbraFlatSearchColumns, '
         'setRows: function (r) { masterRowData = r; }, '
         "bucketOf: (typeof penumbraSearchBucketOf === 'function') ? penumbraSearchBucketOf : null, "
         "bucketLabels: (typeof penumbraSearchBucketLabels === 'function') ? penumbraSearchBucketLabels : null }; } "
         'catch (e) { window.__FB_ERR = String(e); }')

def stage_dir(F):
    work = tempfile.mkdtemp(prefix='pnb_fbucket_')
    for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
    shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(work, 'main.css'))
    for f in ('engine.html', 'builder.html'): shutil.copyfile(os.path.join(HERE, f), os.path.join(work, f))
    with open(os.path.join(work, 'corpus.js'), 'w', encoding='utf-8', newline='') as f:
        f.write('window.CORPUS = ' + json.dumps(CORPUS, ensure_ascii=True) + ';\n')
    src = F['main']; anchor = '$(document).ready(function () {'
    if anchor not in src[:200]: raise SystemExit('main.js closure anchor not found - update run.py')
    i = src.index(anchor)
    src = src[:i] + anchor + CR + '    ' + HOOKS + CR + src[i + len(anchor):]
    open(os.path.join(work, 'main_patched.js'), 'wb').write(src.encode('utf-8', 'surrogateescape'))
    open(os.path.join(work, 'search_builder.js'), 'wb').write(F['sb'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(work, 'search_builder.css'), 'wb').write(F['css'].encode('utf-8', 'surrogateescape'))
    sbc = read(os.path.join(APP, 'search_builder_content.php'))
    at = sbc.find('?>')
    if at < 0: raise SystemExit('search_builder_content.php: no closing ?> - update run.py')
    with open(os.path.join(work, 'sb_markup.js'), 'w', encoding='utf-8', newline='') as f:
        f.write('window.__SB_MARKUP = ' + json.dumps(sbc[at + 2:], ensure_ascii=True) + ';\n')
    return work

def engine_half(work):
    url = 'file:///' + work.replace('\\', '/') + '/engine.html'
    args = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
            '--user-data-dir=' + os.path.join(work, 'profile_e'), '--virtual-time-budget=60000', '--dump-dom', url]
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        out, _ = p.communicate(timeout=300)
    except subprocess.TimeoutExpired:
        subprocess.run(['taskkill', '/PID', str(p.pid), '/T', '/F'], capture_output=True)
        return {'fatal': 'headless Edge timed out'}
    d = out.decode('utf-8', 'replace')
    i = d.find('<pre id="out">'); j = d.find('</pre>', i)
    if i < 0: return {'fatal': 'no <pre id=out> in the dump (%d bytes)' % len(d)}
    txt = html.unescape(d[i + 14:j])
    if not txt.startswith('RESULTS_JSON:'): return {'fatal': 'engine page did not finish: ' + txt[:400]}
    return json.loads(txt[13:])

def server_half(F):
    tmp = tempfile.mkdtemp(prefix='pnb_fbucket_php_')
    try:
        sp = os.path.join(tmp, 'penumbra_search.php'); rp = os.path.join(tmp, 'schedule_runner.php'); mp = os.path.join(tmp, 'mirror.php')
        open(sp, 'wb').write(F['search'].encode('utf-8', 'surrogateescape'))
        shutil.copyfile(os.path.join(APP, 'schedule_runner.php'), rp)
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', EXTRACT, rp, mp], capture_output=True, timeout=300)
        if r.returncode != 0 or not os.path.isfile(mp):
            return {'fatal': 'extract_mirror: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:1500]}
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', '-d', 'date.timezone=America/New_York',
                            os.path.join(HERE, 'php_side.php'), sp, mp, os.path.join(HERE, 'corpus.json')], capture_output=True, timeout=300)
        if r.returncode != 0: return {'fatal': (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}
        try: return json.loads(r.stdout.decode('utf-8'))
        except ValueError: return {'fatal': 'php_side.php printed no JSON: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class Page(object):
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=90, suppress_origin=True); self.n = 0
    def call(self, m, **p):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': m, 'params': p}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get('id') == mid:
                if 'error' in r: raise RuntimeError('%s: %s' % (m, r['error']))
                return r.get('result', {})
    def ev(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True)
        if r.get('exceptionDetails'): raise RuntimeError('JS: ' + json.dumps(r['exceptionDetails'])[:400])
        return r.get('result', {}).get('value')
    def wait(self, expr, ms=5000):
        t0 = time.time()
        while time.time() - t0 < ms / 1000.0:
            try:
                if self.ev(expr): return True
            except Exception: pass
            time.sleep(0.08)
        return False
    def mouse(self, typ, x, y, button='none', buttons=0, count=0):
        p = {'type': typ, 'x': x, 'y': y, 'button': button, 'buttons': buttons}
        if count: p['clickCount'] = count
        self.call('Input.dispatchMouseEvent', **p)
    def click(self, x, y):
        self.mouse('mouseMoved', x, y); time.sleep(0.03)
        self.mouse('mousePressed', x, y, 'left', 1, 1); time.sleep(0.04)
        self.mouse('mouseReleased', x, y, 'left', 0, 1)
    def key(self, k, code):
        self.call('Input.dispatchKeyEvent', type='rawKeyDown', key=k, code=k, windowsVirtualKeyCode=code)
        self.call('Input.dispatchKeyEvent', type='keyUp', key=k, code=k, windowsVirtualKeyCode=code)
    def size(self, w, h):
        self.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=False)

def J(x): return json.dumps(x, ensure_ascii=True)

def builder_half(work):
    prof = os.path.join(work, 'profile_b'); dp = free_port()
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
                             '--allow-file-access-from-files', '--user-data-dir=' + prof, '--remote-debugging-port=%d' % dp,
                             '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    def jget(p, m='GET'):
        return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
    try:
        for _ in range(150):
            try: jget('/json/version'); break
            except Exception: time.sleep(0.2)
        t = jget('/json/new?about:blank', 'PUT')
        pg = Page(t['webSocketDebuggerUrl'])
        pg.call('Page.enable'); pg.call('Runtime.enable')
        pg.size(1280, 800)
        pg.call('Page.navigate', url='file:///' + work.replace('\\', '/') + '/builder.html')
        pg.wait("typeof window.T === 'object' && document.readyState === 'complete'", 30000); time.sleep(0.8)
        builder_checks(pg)
    finally:
        try: edge.kill()
        except Exception: pass
        time.sleep(1)

def builder_checks(pg):
    def st(i=0): return pg.ev('T.state(%d)' % i)
    def opts(i=0): return [o[0] for o in (st(i) or {}).get('bucketOpts') or []]
    def settle(t=0.35): time.sleep(t)
    boot = pg.ev('T.boot()')
    rec('U0', 'builder page booted: hooks, rows, header', boot == 'ok', boot)
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 10000); settle(0.5)
    # U1: a day-date column: As is + the registry's date buckets in its order, no Hour (no time); row + dialog marked
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev('T.hideAc()')
    s = st(); want = ['', ':year', ':fy', ':yq', ':fyq', ':ym', ':quarter', ':fquarter', ':month', ':monthnum', ':dow']
    rec('U1', "a date column: the second dropdown shows As is + every date bucket of the registry in its order (no Hour: no times); the row and the dialog are marked",
        s and s['bucketShown'] and opts() == want and s['bucket'] == '' and s['rowClass'] and pg.ev('T.wide()'),
        {'opts': s and s['bucketOpts'], 'wide': pg.ev('T.wide()')})
    # U2: a date-time column adds Hour
    pg.ev("T.setCol(0, 'T')"); settle(); pg.ev('T.hideAc()')
    rec('U2', 'a date column with times also offers Hour', opts()[-1:] == [':hour'] and len(opts()) == 12, opts())
    # U3: plain text: no dropdown, nothing marked, the dialog its own width
    pg.ev("T.setCol(0, 'N')"); settle(); pg.ev('T.hideAc()')
    s = st()
    rec('U3', 'a text column with no buckets: no dropdown, the row unmarked, the dialog its own width',
        s and not s['bucketShown'] and not s['rowClass'] and not pg.ev('T.wide()'), {'state': s, 'wide': pg.ev('T.wide()')})
    # U4: a number column: Bins of <auto width, baked>, Order of Magnitude
    pg.ev("T.setCol(0, 'AMT')"); settle(); pg.ev('T.hideAc()')
    s = st()
    rec('U4', 'a number column: Bins of its auto width (written into the token: :bin500000) and Order of Magnitude',
        s and s['bucketShown'] and opts() == ['', ':bin500000', ':binlog'] and s['bucketOpts'][1][1].startswith('Bins of 500,000'), s and s['bucketOpts'])
    # U5: a list column: Split by ;
    pg.ev("T.setCol(0, 'L')"); settle(); pg.ev('T.hideAc()')
    s = st()
    rec('U5', 'a list column: Split by ; among its buckets', s and s['bucketShown'] and ':dsemi' in opts()
        and any(o[0] == ':dsemi' and o[1].startswith('Split by ;') for o in s['bucketOpts']), s and s['bucketOpts'])
    # U6: D + Fiscal Year: the value list opens with the labels in order; the tip names two; no calendar
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setBucket(0, ':fy')"); pg.wait('T.acOpen()', 3000); settle(0.4)
    items = pg.ev('T.acItems()'); s = st()
    rec('U6', "a bucket picked: its value list opens with the labels in the bucket's order (text last); the tip names two; no calendar",
        items[:7] == ['FY99', 'FY01', 'FY24', 'FY25', 'FY26', 'FY27', 'TBD'] and s['tip'] == 'Values like FY99 or FY01' and s['tipShown'] and not s['datepicker'],
        {'items': items, 'tip': s['tip'], 'dp': s['datepicker']})
    pg.ev('T.hideAc()')
    # U7: a typed set -> the alternation on the bucket token
    pg.ev("T.setOp(0, 'equals')"); settle(0.2); pg.ev('T.hideAc()')
    pg.ev("T.setVal(0, 'FY25|FY26')"); settle(); pg.ev('T.hideAc()')
    prev = pg.ev('T.preview()')
    rec('U7', 'a typed FY25|FY26 previews as D:fy = /^(?:FY25|FY26)$/', prev == 'D:fy = /^(?:FY25|FY26)$/', prev)
    # U8: Filter writes it to the box; the engine on it keeps FY25 + FY26 rows
    pg.ev('T.submit()'); settle(0.6)
    box = pg.ev('T.box()')
    ids = pg.ev("(function(){var S=window.__FB, q=$('#tableSearch').val(), cols=S.flatCols(CORPUS.columns.filter(function(c){return c!=='#';}));"
                " var p=S.parseQ(q, cols), out=[]; CORPUS.rows.forEach(function(o){var m=new Map(); CORPUS.columns.forEach(function(c){m.set(c.toUpperCase(), String(o[c]))});"
                " if (S.evalQ(m, p, cols, false)) out.push(+o.ID);}); return out;})()")
    rec('U8', 'Filter writes D:fy = /^(?:FY25|FY26)$/ to the box, and the filter keeps the FY25 and FY26 rows',
        box == 'D:fy = /^(?:FY25|FY26)$/' and ids == [1, 2, 9, 10, 11, 13, 14], {'box': box, 'ids': ids})
    # U9: reopened from the box: D, Fiscal Year, the set
    pg.ev("T.open($('#tableSearch').val())"); pg.wait('T.isOpen()', 5000); settle(0.5); pg.ev('T.hideAc()')
    s = st()
    rec('U9', 'reopened from the box: the row is D with Fiscal Year beside it and FY25 + FY26 as its set; the dialog wide',
        s and s['col'] == 'D' and s['bucket'] == ':fy' and s['bucketShown'] and sorted(s['multi'] or []) == ['FY25', 'FY26'] and pg.ev('T.wide()'), s)
    # U10: a multi-word column in braces round trip
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'AWARD DATE')"); settle(); pg.ev("T.setBucket(0, ':ym')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setOp(0, 'equals')"); pg.ev("T.setVal(0, 'Mar 2025')"); settle(); pg.ev('T.hideAc()')
    prev = pg.ev('T.preview()')
    pg.ev('T.submit()'); settle(0.5)
    pg.ev("T.open($('#tableSearch').val())"); pg.wait('T.isOpen()', 5000); settle(0.5); pg.ev('T.hideAc()')
    s = st()
    rec('U10', "a multi-word column: {AWARD DATE:ym} = 'Mar 2025', and it reopens as AWARD DATE / Year > Month / Mar 2025",
        prev == "{AWARD DATE:ym} = 'Mar 2025'" and s and s['col'] == 'AWARD DATE' and s['bucket'] == ':ym' and s['op'] == 'equals' and s['val'] == 'Mar 2025',
        {'preview': prev, 'reopened': s})
    # U11: between on a bucket; the range warning in the bucket's order
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev("T.setBucket(0, ':fy')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setOp(0, 'between')"); settle(0.2); pg.ev("T.setVal(0, 'FY25', 'FY22')"); settle(); pg.ev('T.hideAc()')
    warnOn = st()['warn']
    pg.ev("T.setVal(0, 'FY22', 'FY25')"); settle(); pg.ev('T.hideAc()')
    s0 = st(); prev = pg.ev('T.preview()')
    pg.ev('T.submit()'); settle(0.5)
    pg.ev("T.open($('#tableSearch').val())"); pg.wait('T.isOpen()', 5000); settle(0.5); pg.ev('T.hideAc()')
    s = st()
    rec('U11', "between on a bucket: FY25..FY22 warns (the bucket's order), FY22..FY25 does not; it writes D:fy >= FY22 and D:fy <= FY25 and reopens as one between row",
        warnOn and not s0['warn'] and prev == 'D:fy >= FY22 and D:fy <= FY25' and pg.ev('T.rows()') == 1 and s['op'] == 'between'
        and s['col'] == 'D' and s['bucket'] == ':fy' and s['val'] == 'FY22' and s['val2'] == 'FY25',
        {'warnOn': warnOn, 'warnOff': s0['warn'], 'preview': prev, 'reopened': s})
    # U12: contains (the two-token form) round trip
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev("T.setBucket(0, ':fy')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setOp(0, 'contains')"); pg.ev("T.setVal(0, 'FY2')"); settle(); pg.ev('T.hideAc()')
    prev = pg.ev('T.preview()'); pg.ev('T.submit()'); settle(0.5)
    pg.ev("T.open($('#tableSearch').val())"); pg.wait('T.isOpen()', 5000); settle(0.5); pg.ev('T.hideAc()')
    s = st()
    rec('U12', 'contains on a bucket: D:fy FY2, reopened as D / Fiscal Year / contains FY2',
        prev == 'D:fy FY2' and s['col'] == 'D' and s['bucket'] == ':fy' and s['op'] == 'contains' and s['val'] == 'FY2', {'preview': prev, 'reopened': s})
    # U13: a preset round trip (the chip's getState / applyState)
    gs = pg.ev('T.getState()')
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.3)
    if gs: pg.ev('T.applyState(%s)' % J(gs)); settle(0.5); pg.ev('T.hideAc()')
    s = st()
    cond = (gs or {}).get('conditions') if isinstance(gs, dict) else None
    rec('U13', "a preset saves the row's column as D:fy and loads back as D / Fiscal Year",
        bool(cond) and cond[0].get('column') == 'D:fy' and s['col'] == 'D' and s['bucket'] == ':fy' and s['val'] == 'FY2', {'saved': gs, 'loaded': s})
    # U14: the scheduler's builder: the same dropdown; Insert writes the bucket into the task's filter
    pg.ev("$('#searchBuilderLightbox').hide(); T.openSched('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'D')"); settle(); s1 = st()
    pg.ev("T.setBucket(0, ':fy')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setOp(0, 'equals')"); pg.ev("T.setVal(0, 'FY26')"); settle(); pg.ev('T.hideAc()')
    pg.ev('T.submit()'); settle(0.6)
    rec('U14', "the Scheduler's builder: the same second dropdown; Insert writes D:fy = FY26 into the task's filter",
        s1['bucketShown'] and pg.ev('T.schedBox()') == 'D:fy = FY26', {'shown': s1['bucketShown'], 'sched': pg.ev('T.schedBox()')})
    # U15: the dialog narrows again when the last bucket row goes
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'N')"); settle(); pg.ev('T.hideAc()')
    pg.ev('T.addRow()'); settle(0.3); pg.ev("T.setCol(1, 'D')"); settle(); pg.ev("T.setBucket(1, ':year')"); settle(); pg.ev('T.hideAc()')
    w1 = pg.ev('T.wide()'); pg.ev('T.removeRow(1)'); settle(0.3); w2 = pg.ev('T.wide()')
    rec('U15', 'a bucket row added widens the dialog; removing it narrows it again', w1 and not w2, {'with': w1, 'after': w2})
    # U16: switching the bucket clears the value and opens the new list
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev("T.setBucket(0, ':fy')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setOp(0, 'equals')"); pg.ev("T.setVal(0, 'FY26')"); settle(); pg.ev('T.hideAc()')
    pg.ev("T.setBucket(0, ':dow')"); pg.wait('T.acOpen()', 3000); settle(0.4)
    items = pg.ev('T.acItems()'); s = st()
    rec('U16', "another bucket picked: the value clears and the list offers that bucket's labels (Mon..Sun order)",
        s['val'] == '' and items[:6] == ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] and 'Sun' in items, {'val': s['val'], 'items': items})
    pg.ev('T.hideAc()')
    # U17: real clicks tick two labels in the list -> the alternation (two the list shows without a scroll)
    pg.ev("T.setBucket(0, ':month')"); pg.wait('T.acOpen()', 3000); settle(0.4)
    for v in ('Jan', 'Mar'):
        c = pg.ev('T.acItemAt(%s)' % J(v))
        if c: pg.click(c['x'], c['y']); settle(0.35)
    pg.key('Escape', 27); settle(0.4)
    prev = pg.ev('T.preview()')
    rec('U17', 'real clicks tick Jan and Mar in the bucket list: D:month = /^(?:Jan|Mar)$/', prev == 'D:month = /^(?:Jan|Mar)$/', prev)
    # U18: no wrapping, and the boxes keep their room: a bucket row in the wide dialog vs a plain row in the normal one
    lay = {}
    for (w, h) in ((1024, 768), (1280, 800), (1920, 1080)):
        pg.size(w, h); settle(0.2)
        pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.3)
        pg.ev("T.setCol(0, 'N')"); settle(); pg.ev('T.hideAc()'); plain = pg.ev('T.geo(0)')
        pg.ev("T.setCol(0, 'D')"); settle(); pg.ev("T.setBucket(0, ':fyq')"); settle(); pg.ev('T.hideAc()'); bk = pg.ev('T.geo(0)')
        lay[w] = {'plain': plain, 'bucket': bk}
    def one_line(g):
        bx = list(g['boxes'].values()); col = g['boxes'].get('.sb-col-select')
        return col and all(b['t'] < col['b'] and b['b'] > col['t'] for b in bx) and g['row']['sw'] <= g['row']['cw'] + 1 \
            and max(b['r'] for b in bx) <= g['content']['r'] and g['tipOneLine']
    def kept(p, b, k):
        return p['boxes'].get(k) and b['boxes'].get(k) and b['boxes'][k]['w'] >= 0.85 * p['boxes'][k]['w']
    ok18 = all(one_line(lay[w]['bucket']) and lay[w]['bucket']['boxes'].get('.sb-bucket-select')
               and kept(lay[w]['plain'], lay[w]['bucket'], '.sb-op-select') and kept(lay[w]['plain'], lay[w]['bucket'], '.sb-value-input:not(.sb-value-input-secondary)')
               and kept(lay[w]['plain'], lay[w]['bucket'], '.sb-col-select') and lay[w]['bucket']['content']['w'] > lay[w]['plain']['content']['w'] for w in lay)
    rec('U18', 'no wrapping at 1024 / 1280 / 1920: a bucket row is one line, inside the dialog, which widens so the column, operator and value boxes keep at least 85% of their room',
        ok18, dict((w, {'plain': {'content': lay[w]['plain']['content']['w'], 'col': (lay[w]['plain']['boxes'].get('.sb-col-select') or {}).get('w'),
                                  'op': (lay[w]['plain']['boxes'].get('.sb-op-select') or {}).get('w'), 'val': (lay[w]['plain']['boxes'].get('.sb-value-input:not(.sb-value-input-secondary)') or {}).get('w')},
                        'bucket': {'content': lay[w]['bucket']['content']['w'], 'col': (lay[w]['bucket']['boxes'].get('.sb-col-select') or {}).get('w'),
                                   'bkt': (lay[w]['bucket']['boxes'].get('.sb-bucket-select') or {}).get('w'), 'op': (lay[w]['bucket']['boxes'].get('.sb-op-select') or {}).get('w'),
                                   'val': (lay[w]['bucket']['boxes'].get('.sb-value-input:not(.sb-value-input-secondary)') or {}).get('w'),
                                   'oneLine': bool(one_line(lay[w]['bucket']))}}) for w in lay))
    pg.size(1280, 800); settle(0.2)
    # U19: a host whose engine reads no bucket (no getBucketVariants: the dashboard's adapter): no dropdown
    pg.ev("window.__gbv = window._penumbraSearchAPI.getBucketVariants; delete window._penumbraSearchAPI.getBucketVariants; T.open('')")
    pg.wait('T.isOpen()', 5000); settle(0.3)
    pg.ev("T.setCol(0, 'D')"); settle(); pg.ev('T.hideAc()')
    s = st()
    pg.ev('if (window.__gbv) window._penumbraSearchAPI.getBucketVariants = window.__gbv; true')
    rec('U19', "a host whose engine reads no bucket (the dashboard's filter): no second dropdown, the calendar as before",
        s and not s['bucketShown'] and s['datepicker'], s)
    # U21: a filter's bucket the column's list does not offer (Hour on a date-only column) reopens picked and named
    pg.ev("T.open(\"D:hour = '00:00'\")"); pg.wait('T.isOpen()', 5000); settle(0.4); pg.ev('T.hideAc()')
    s = st()
    rec('U21', "a typed bucket the column does not offer (D:hour, a date-only column) reopens picked, named Hour",
        s and s['col'] == 'D' and s['bucket'] == ':hour' and [':hour', 'Hour'] in [list(o) for o in s['bucketOpts']] and s['val'] == '00:00', s)
    box_checks(pg)
    errs = pg.ev('T.errors()') or []
    rec('U20', 'no page errors in the builder page', not errs, errs)

# ---- (fbucket 2, 2026-11-06) the filter boxes' lists, and the builder opened on a bucket row ------------------------
# The user: "This also implies also supporting it in the dropdown menu of the search bar similar to the dropdown menus
# of charting". The REAL attachFilterAutocomplete on the report's box (#tableSearch), the Scheduler's
# (#schedSearchFilter) and a box of another kind (#plainFilter, as a chart's Filter Expression is attached), typed
# into with REAL text input (CDP Input.insertText), keys and clicks.
DATE10 = ['Year', 'Fiscal Year', 'Year › Quarter', 'Fiscal Year › Quarter', 'Year › Month', 'Quarter',
          'Fiscal Quarter', 'Month', 'Month #', 'Day of Week']
FYV = ['FY99', 'FY01', 'FY24', 'FY25', 'FY26', 'FY27', 'TBD']
FISCAL3 = ['Fiscal Year', 'Fiscal Year › Quarter', 'Fiscal Quarter']

def box_checks(pg):
    W, SCH, PL = '#tableSearch', '#schedSearchFilter', '#plainFilter'
    def settle(t=0.3): time.sleep(t)
    def menu(sel): return pg.ev('T.menu(%s)' % J(sel))
    def items(sel): return pg.ev('T.items(%s)' % J(sel))
    def val(sel): return pg.ev('T.boxVal(%s)' % J(sel))
    def typein(sel, text, start=''):
        pg.ev('T.focusBox(%s, %s)' % (J(sel), J(start))); settle(0.1)
        pg.call('Input.insertText', text=text)
        pg.wait('!!T.menu(%s)' % J(sel), 2500); settle(0.3)
        return items(sel)
    def kmod(k, code, vk, mods):
        pg.call('Input.dispatchKeyEvent', type='rawKeyDown', key=k, code=code, windowsVirtualKeyCode=vk, modifiers=mods)
        pg.call('Input.dispatchKeyEvent', type='keyUp', key=k, code=code, windowsVirtualKeyCode=vk, modifiers=mods)
    def ctrl_space(sel, start):
        pg.ev('T.focusBox(%s, %s)' % (J(sel), J(start))); settle(0.1)
        kmod(' ', 'Space', 32, 2); pg.wait('!!T.menu(%s)' % J(sel), 2500); settle(0.3)
        return items(sel)
    def alt_down(sel, start):
        pg.ev('T.focusBox(%s, %s)' % (J(sel), J(start))); settle(0.1)
        kmod('ArrowDown', 'ArrowDown', 40, 1); pg.wait('!!T.menu(%s)' % J(sel), 2500); settle(0.3)
        return items(sel)
    def pick(sel, text):
        c = pg.ev('T.itemAt(%s, %s)' % (J(sel), J(text)))
        if not c: return False
        pg.click(c['x'], c['y']); settle(0.6)
        return True
    def api(fn, args): return pg.ev('T.api(%s, %s)' % (J(fn), J(args)))
    pg.ev("$('#searchBuilderLightbox').hide(); $('#sbAutocompleteDropdown').hide(); T.boxes()"); settle(0.3)

    # D1 + D15: a column's buckets right under it, named as the chart builder's X-Axis list names them; their look
    pg.ev('T.focusBox(%s, "")' % J(W)); settle(0.1)
    pg.call('Input.insertText', text='AMT'); pg.wait('!!T.menu(%s)' % J(W), 2500); settle(0.3)
    m1 = [x for x in (menu(W) or []) if 'h' not in x]
    rec('D1', "the report's filter box lists a column's buckets right under it, named as the chart builder's X-Axis list names them (AMT by Order of Magnitude)",
        [x['t'] for x in m1] == ['AMT', 'AMT by Bins of 500,000', 'AMT by Order of Magnitude'] and not m1[0]['b'] and m1[1]['b'] and m1[2]['b'], m1)
    rec('D15', "a bucket entry is indented under its column (38px vs 24px), a muted arrow glyph before it, its values' example after it (10–99)",
        len(m1) == 3 and m1[1]['pad'] == 38 and m1[0]['pad'] == 24 and m1[1]['g'] and m1[2]['g'] and m1[2]['ex'] == '10–99' and not m1[0]['g'], m1)
    # D2: typing COLUMN: lists that column's buckets alone, in the grouping's order
    i2 = typein(W, 'D:')
    rec('D2', "typing D: lists D's buckets alone, in the grouping's order", i2 == ['D by ' + x for x in DATE10], i2)
    # D3: D:f narrows to the fiscal ones; a pick writes D:fy and lists its values; a value completes it; the engine keeps the corpus's rows
    i3 = typein(W, 'D:f')
    p3 = pick(W, 'D by Fiscal Year'); v3 = val(W); vals3 = items(W)
    p3b = pick(W, 'FY26'); v3b = val(W)
    ids3 = pg.ev('T.ids(%s)' % J(v3b or ''))
    want3 = [q for q in CORPUS['queries'] if q['q'] == 'D:fy = FY26'][0]['ids']
    rec('D3', "D:f lists the buckets it begins; a pick writes D:fy and lists its values in order; FY26 completes it and the engine keeps the corpus's D:fy = FY26 rows",
        i3 == ['D by ' + x for x in FISCAL3] and p3 and v3 == 'D:fy ' and vals3 == FYV and p3b and v3b == 'D:fy FY26' and sorted(ids3 or []) == want3,
        {'typed': i3, 'box': v3, 'values': vals3, 'box2': v3b, 'ids': ids3, 'want': want3})
    # D4: a name with a space: the token in braces, then its values
    i4 = typein(W, 'AWARD')
    p4 = pick(W, 'AWARD DATE by Fiscal Year'); v4 = val(W); vals4 = items(W)
    api4 = api('getColumnAutocompleteValues', ['AWARD DATE:fy'])
    rec('D4', "a name with a space: the pick writes {AWARD DATE:fy} and lists that bucket's values",
        isinstance(i4, list) and 'AWARD DATE by Fiscal Year' in i4 and p4 and v4 == '{AWARD DATE:fy} ' and isinstance(api4, list) and len(api4) >= 2 and vals4 == api4,
        {'typed': i4, 'box': v4, 'values': vals4, 'api': api4})
    # D18: ...an open brace typed before it, Ctrl+Space: the buckets it begins; the pick replaces the brace too
    i18 = ctrl_space(W, '{AWARD DATE:f')
    p18 = pick(W, 'AWARD DATE by Fiscal Year'); v18 = val(W)
    rec('D18', "{AWARD DATE:f + Ctrl+Space lists AWARD DATE's fiscal buckets; the pick replaces the open brace too: {AWARD DATE:fy}",
        i18 == ['AWARD DATE by ' + x for x in FISCAL3] and p18 and v18 == '{AWARD DATE:fy} ', {'listed': i18, 'box': v18})
    # D5 / D6: the Scheduler's filter box lists them too; a box of another kind (a chart's filter) lists none
    i5 = typein(SCH, 'AMT')
    rec('D5', "the Scheduler's filter box lists them too", i5 == ['AMT', 'AMT by Bins of 500,000', 'AMT by Order of Magnitude'], i5)
    i6 = typein(PL, 'AMT')
    rec('D6', "a filter box of another kind (a chart's Filter Expression) lists no bucket", i6 == ['AMT'], i6)
    pg.ev('T.closeMenus()')
    # D7..D10: a typed token's values in every position the box reads a column's
    i7 = typein(W, 'D:fy FY2')
    rec('D7', "typed D:fy FY2: the bucket's values that begin FY2, not D's dates", i7 == ['FY24', 'FY25', 'FY26', 'FY27'], i7)
    i8 = typein(W, 'D:fy >= FY2')
    rec('D8', "typed D:fy >= FY2: the same, after an operator", i8 == ['FY24', 'FY25', 'FY26', 'FY27'], i8)
    i9 = typein(W, 'D:fy = ')
    rec('D9', "typed D:fy = (a space after the operator): every value of the bucket", i9 == FYV, i9)
    i10 = ctrl_space(W, 'D:fy')
    rec('D10', "D:fy + Ctrl+Space: every value of the bucket", i10 == FYV, i10)
    # D11: an unfinished token + Ctrl+Space: the buckets it begins, not the column's values
    i11 = ctrl_space(W, 'D:f')
    rec('D11', "D:f + Ctrl+Space: the buckets it begins, not D's dates", i11 == ['D by ' + x for x in FISCAL3], i11)
    # D12: a column whose own name holds a colon stays that column
    i12 = typein(W, 'Q:fy = ')
    a12 = api('getColumnAutocompleteValues', ['Q:fy'])
    rec('D12', "Q:fy = lists the values of the column named Q:fy (x, y), not Q's fiscal years", isinstance(a12, list) and i12 == a12 and 'x' in a12, {'listed': i12, 'api': a12})
    # D13: the text ends with a bucket token: the arrow's column, and Alt+Down lists its values
    t13 = pg.ev('T.trailing(%s, %s)' % (J(W), J('N = alpha and D:fy')))
    t13p = pg.ev('T.trailing(%s, %s)' % (J(PL), J('N = alpha and D:fy')))
    t13q = pg.ev('T.trailing(%s, %s)' % (J(W), J('N = alpha and Q:fy')))
    i13 = alt_down(W, 'N = alpha and D:fy'); v13 = val(W)
    rec('D13', "the box ending with D:fy: the arrow names D:fy (a plain box: nothing; Q:fy stays the column, by its header name Q:FY) and Alt+Down lists its values after a space",
        t13 == 'D:fy' and t13p == '' and t13q == 'Q:FY' and i13 == FYV and v13 == 'N = alpha and D:fy ',
        {'report': t13, 'plain': t13p, 'colon': t13q, 'listed': i13, 'box': v13})
    # D14: a double-click on a bucket token selects it whole; the column list leads with it; a pick replaces it whole
    r14 = pg.ev('T.dbl(%s, %s, 3)' % (J(W), J('D:fy = FY26')))
    pg.wait('!!T.menu(%s)' % J(W), 2500); settle(0.3)
    i14 = items(W) or []
    p14 = pick(W, 'D by Year'); v14 = val(W)
    rec('D14', "a double-click inside D:fy selects the whole token, the list leads with D by Fiscal Year, and D by Year replaces it whole",
        r14 == [0, 4] and i14[:1] == ['D by Fiscal Year'] and p14 and v14 == 'D:year = FY26', {'range': r14, 'first': i14[:3], 'box': v14})
    # D16: a plain column as before: its pick and its values
    i16 = typein(W, 'ID')
    p16 = pick(W, 'ID'); v16 = val(W); vals16 = items(W)
    a16 = api('getColumnAutocompleteValues', ['ID'])
    rec('D16', "a plain column as before: ID, its pick, its values", isinstance(i16, list) and i16[:1] == ['ID'] and p16 and v16 == 'ID ' and vals16 == a16,
        {'typed': i16, 'box': v16, 'values': (vals16 or [])[:6]})
    # D17: Alt+Down on the empty box: every column, each followed by its buckets; a pick from it, then its values
    i17 = alt_down(W, '') or []
    def after(name, n):
        k = i17.index(name) if name in i17 else -1
        return i17[k + 1:k + 1 + n] if k >= 0 else None
    ok17 = (after('D', 10) == ['D by ' + x for x in DATE10] and after('L', 1) == ['L split by ;'] and after('N', 1) == ['AWARD DATE']
            and (after('T', 11) or [''])[-1] == 'T by Hour' and after('AMT', 2) == ['AMT by Bins of 500,000', 'AMT by Order of Magnitude'])
    p17 = pick(W, 'AMT by Order of Magnitude'); v17 = val(W); vals17 = items(W)
    a17 = api('getColumnAutocompleteValues', ['AMT:binlog'])
    rec('D17', "Alt+Down on the empty box: every column followed by its buckets (D's 10, T's 11 with Hour, AMT's 2, L split by ;, none for N); a pick writes AMT:binlog and lists its values",
        ok17 and p17 and v17 == 'AMT:binlog ' and isinstance(a17, list) and len(a17) > 2 and vals17 == a17,
        {'D': after('D', 10), 'L': after('L', 1), 'N': after('N', 1), 'T': after('T', 11), 'AMT': after('AMT', 2), 'box': v17, 'values': (vals17 or [])[:5]})
    # D19: a bucket whose token is a column's own name (Q:fy) is offered nowhere: not under Q in the list, not in the builder's dropdown
    q19 = after('Q', 10) or []
    pg.ev('T.closeMenus()')
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 5000); settle(0.4)
    pg.ev("T.setCol(0, 'Q')"); settle(); pg.ev('T.hideAc()')
    o19 = [o[0] for o in ((pg.ev('T.state(0)') or {}).get('bucketOpts') or [])]
    pg.ev("$('#searchBuilderLightbox').hide()"); settle(0.2)
    rec('D19', "a bucket whose token names another column (Q:fy) is not offered: not under Q in the box's list, not in the builder's dropdown for Q",
        'Q by Year' in q19 and 'Q by Fiscal Year' not in q19 and ':year' in o19 and ':fy' not in o19, {'list': q19, 'builder': o19})
    pg.ev('T.closeMenus()')
    # D20: a slow reading (60 ms a column) never holds a list long: the first list shows what was read in time (the
    # reading began when the box took the focus), the rest goes on in the background, and a later list has every one
    pg.ev('T.slow(60); T.boxes()'); settle(0.2)
    dt20 = pg.ev('T.listTimed(%s)' % J(W)); settle(0.3)
    f20 = items(W) or []
    pg.ev('T.closeMenus()'); time.sleep(2.5)
    dt20b = pg.ev('T.listTimed(%s)' % J(W)); settle(0.3)   # the reading still slow: only the background's work makes it whole
    s20 = items(W) or []
    pg.ev('T.slow(0); T.closeMenus(); T.boxes()'); settle(0.2)
    rec('D20', "a slow reading (60 ms a column) holds the first list under 0.4 s with the buckets read in time (D's), not every column's; the reading goes on in the background, so a later list (the reading still slow) has them all at once (AWARD DATE's, Q's, under 0.15 s)",
        isinstance(dt20, (int, float)) and dt20 < 400 and 'D by Year' in f20 and not ('AWARD DATE by Year' in f20 and 'Q by Year' in f20)
        and 'AWARD DATE by Year' in s20 and 'Q by Year' in s20 and 'D by Year' in s20 and isinstance(dt20b, (int, float)) and dt20b < 150,
        {'firstMs': dt20, 'first': [x for x in f20 if ' by ' in x or ' split ' in x][:40], 'laterMs': dt20b, 'laterHasAll': ['AWARD DATE by Year' in s20, 'Q by Year' in s20]})

    # O1..O4: the builder opened on a new row for a column's bucket (the palette's Filter COLUMN by...)
    def st(i): return pg.ev('T.state(%d)' % i) or {}
    ok = pg.ev("T.openBucket('N = alpha', 'D', ':fy')")
    pg.wait('T.isOpen()', 5000); settle(0.6)
    n1 = pg.ev('T.rows()'); s0 = st(0); s1 = st(1); ac1 = pg.ev('T.acOpen()'); acI = pg.ev('T.acItems()')
    rec('O1', "openBucketRow('D', ':fy') over N = alpha: the builder keeps N = alpha and adds D by Fiscal Year (=), its value list open on the bucket's labels",
        ok and n1 == 2 and s0.get('col') == 'N' and s0.get('val') == 'alpha' and s1.get('col') == 'D' and s1.get('bucket') == ':fy' and s1.get('op') == 'equals' and ac1 and acI == FYV,
        {'rows': n1, 'r0': [s0.get('col'), s0.get('val')], 'r1': [s1.get('col'), s1.get('bucket'), s1.get('op')], 'open': ac1, 'items': acI})
    pg.ev("T.hideAc(); $('#searchBuilderLightbox').hide()"); settle(0.2)
    ok2 = pg.ev("T.openBucket('', 'AMT', ':binlog')")
    pg.wait('T.isOpen()', 5000); settle(0.5)
    n2 = pg.ev('T.rows()'); s2 = st(0)
    rec('O2', "openBucketRow on an empty box: the one row is AMT by Order of Magnitude (=), no empty row left above it",
        ok2 and n2 == 1 and s2.get('col') == 'AMT' and s2.get('bucket') == ':binlog' and s2.get('op') == 'equals', {'rows': n2, 'r0': s2})
    pg.ev("T.hideAc(); $('#searchBuilderLightbox').hide()"); settle(0.2)
    ok3 = pg.ev("T.openBucket('', 'L', '')")
    pg.wait('T.isOpen()', 5000); settle(0.5)
    n3 = pg.ev('T.rows()'); s3 = st(0)
    rec('O3', "openBucketRow with no bucket: the row is the column As is, its dropdown shown",
        ok3 and n3 == 1 and s3.get('col') == 'L' and s3.get('bucket') == '' and s3.get('bucketShown'), {'rows': n3, 'r0': s3})
    pg.ev("T.hideAc(); $('#searchBuilderLightbox').hide()"); settle(0.2)
    sp = [pg.ev('T.sbApi("splitColumnToken", [%s])' % J(t)) for t in ('d:FY', 'Q:fy', 'AWARD DATE:fyq', 'N')]
    rec('O4', "the builder's splitColumnToken export: d:FY -> D + :fy, Q:fy -> the column (Q:FY, the header's name), AWARD DATE:fyq -> AWARD DATE + :fyq, N -> N",
        sp == [{'column': 'D', 'sx': ':fy'}, {'column': 'Q:FY', 'sx': ''}, {'column': 'AWARD DATE', 'sx': ':fyq'}, {'column': 'N', 'sx': ''}], sp)

def checks(E, S):
    rec('H-boot', 'both halves booted without page errors', 'fatal' not in E and 'fatal' not in S and not E.get('pageErrors'),
        {'browser': E.get('fatal') or E.get('pageErrors'), 'server': S.get('fatal')})
    if 'fatal' in E or 'fatal' in S: return
    for qq in CORPUS['queries']:
        s = qq['slug']; want = qq['ids']
        b = sorted(E['q'].get(s) or []); qv = sorted(S['q'].get(s) or [])
        rec('B-' + s, 'browser: ' + qq['q'], b == want, {'want': want, 'got': b})
        rec('Q-' + s, 'server: ' + qq['q'], qv == want, {'want': want, 'got': qv})
        rec('K-' + s, 'the same bucket token in both engines: ' + qq['q'], E['tok'].get(s) == S['tok'].get(s), {'browser': E['tok'].get(s), 'server': S['tok'].get(s)})
    bad = [i for i, c in enumerate(CORPUS['labels']) if E['lbl'][i] != S['lbl'][i] or E['lbl'][i] is None]
    rec('L-parity', 'label parity over %d texts x buckets: browser == server' % len(CORPUS['labels']), not bad,
        [{'tok': CORPUS['labels'][i]['tok'], 'text': CORPUS['labels'][i]['text'], 'browser': E['lbl'][i], 'server': S['lbl'][i]} for i in bad[:6]])
    badr = [i for i, c in enumerate(CORPUS['labels']) if S['lbl'][i] != S['run'][i]]
    rec('R-parity', "...and == the runner's own grouping labels of the same text (pivot_split_bucket_label & co)", not badr,
        [{'tok': CORPUS['labels'][i]['tok'], 'text': CORPUS['labels'][i]['text'], 'search': S['lbl'][i], 'runner': S['run'][i]} for i in badr[:6]])
    A = E.get('api') or {}
    rec('A1', "the value list of D:fy: the labels in the bucket's order, a cell's text after them",
        A.get('valuesFy') == ['FY99', 'FY01', 'FY24', 'FY25', 'FY26', 'FY27', 'TBD'], A.get('valuesFy'))
    rec('A2', "the value list of D:dow: Mon..Sun order, a too-coarse cell's own text after them",
        A.get('valuesDow') == ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Feb 2025', 'TBD'], A.get('valuesDow'))
    rec('A3', 'the value list of L:dsemi: each value of the lists (entities decoded), once', isinstance(A.get('valuesList'), list)
        and all(v in A['valuesList'] for v in ('Jones, Jacob', 'Smith, Ann', 'Lee & Co', 'Kim', 'kim', 'Palmtag', 'Doe, J', 'A', 'B', 'A|B'))
        and len(A['valuesList']) == len(set(A['valuesList'])), A.get('valuesList'))
    rec('A4', "the value list of AMT:binlog: the magnitudes low to high as the grouped view sorts them ('1e3' reads as 1 there), a non-number after",
        A.get('valuesBinlog') == ['< 1', '1e3', '10 \u2013 99', '100 \u2013 999', '1,000 \u2013 9,999', '10,000 \u2013 99,999', '100,000 \u2013 999,999',
                                   '1,000,000 \u2013 9,999,999', 'n/a'], A.get('valuesBinlog'))
    rec('A5', "a plain column's value list is unchanged (13 distinct N values)", A.get('valuesPlain') == 13, A.get('valuesPlain'))
    def lst(x): return [v for v in x if isinstance(v, dict)] if isinstance(x, list) else []
    rec('A6', "getBucketVariants('D'): the date buckets the grouping offers, Hour left out (no times)",
        [v.get('sx') for v in lst(A.get('varD'))] == [':year', ':fy', ':yq', ':fyq', ':ym', ':quarter', ':fquarter', ':month', ':monthnum', ':dow'], A.get('varD'))
    rec('A7', "getBucketVariants('AMT'): Bins with the auto width written in (:bin500000, 'Bins of 500,000'), Order of Magnitude",
        [v.get('sx') for v in lst(A.get('varAMT'))] == [':bin500000', ':binlog'] and (lst(A.get('varAMT')) or [{}])[0].get('label') == 'Bins of 500,000', A.get('varAMT'))
    rec('A8', "getBucketVariants: L offers Split by ;, N (text) offers nothing",
        any(v.get('sx') == ':dsemi' for v in lst(A.get('varL'))) and A.get('varN') == [], {'L': A.get('varL'), 'N': A.get('varN')})
    rec('A9', 'compareBucketLabels: FY99 before FY01, FY26 after FY25, Mar = Mar, a list has no order', A.get('cmp') == [-1, 1, 0, None], A.get('cmp'))

def wait_edge():
    waited = 0
    while other_headless_edge() and waited < 1200:
        if waited == 0: log('      another headless Edge is running - waiting (up to 20 min) ...')
        time.sleep(15); waited += 15

# The three halves, each a list of rec tuples: the browser engine page (B-, A-, H- browser part), the server
# (Q-, L/R parity via both), the builder (U-). A mutant reuses the halves its file cannot reach from one baseline.
def halves(F, want=('engine', 'server', 'builder')):
    out = {}
    work = stage_dir(F) if ('engine' in want or 'builder' in want) else None
    try:
        if work: wait_edge()
        if 'engine' in want: out['E'] = engine_half(work)
        if 'server' in want: out['S'] = server_half(F)
        if 'builder' in want:
            mark = len(R)
            builder_half(work)
            out['U'] = R[mark:]; del R[mark:]
    finally:
        if work:
            for _ in range(5):
                try: shutil.rmtree(work); break
                except OSError: time.sleep(2)
    return out

def assemble(h):
    del R[:]
    checks(h['E'], h['S'])
    R.extend(h['U'])

def run_once(F, label):
    assemble(halves(F))

def report(title):
    bad = [r for r in R if not r[2]]
    log('---- %s: %d asserts, %d failed' % (title, len(R), len(bad)))
    for r in bad: log('  FAIL %-22s %s :: %s' % (r[0], r[1][:110], r[3][:400]))
    for r in R:
        if r[0] == 'U18' and r[2]: log('  info U18 widths :: %s' % r[3])
    return [r[0] for r in bad]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage'); ap.add_argument('--control', action='store_true'); ap.add_argument('--rev')
    ap.add_argument('--mutants', action='store_true'); ap.add_argument('--mutant')
    a = ap.parse_args()
    if a.mutant or a.mutants:
        names = a.mutant.split(',') if a.mutant else sorted(MUTANTS)   # (fbucket 2) --mutant A,B,C runs those
        allok = True
        base = halves(files_from(a.stage, None))
        assemble(base)
        if report('baseline (the stage, unmutated)'):
            log('RESULT: the baseline is not green - mutants not run'); return
        for n in names:
            key, old, new, want = MUTANTS[n]
            F = files_from(a.stage, None)
            c = F[key].count(old)
            if c != 1: log('MUTANT %s: anchor found %d times in %s' % (n, c, REL[key])); allok = False; continue
            F[key] = F[key].replace(old, new)
            # a server file reaches the server half only; a browser file the engine page and the builder
            h = dict(base)
            # (fbucket 2) the engine page loads neither the builder nor its css: their mutants rerun the builder alone
            h.update(halves(F, ('server',) if key == 'search' else (('builder',) if key in ('sb', 'css') else ('engine', 'builder'))))
            assemble(h)
            red = report('mutant ' + n)
            ok = want is not None and bool(red) and sorted(red) == sorted(want)
            log('MUTANT %s: %s red=%s' % (n, 'EXACT' if ok else ('GREEN (a finding)' if not red else ('CALIBRATE' if want is None else 'WRONG want=' + json.dumps(want))), json.dumps(red)))
            allok = allok and ok
        log('RESULT: ' + ('MUTANTS EXACT' if allok else 'MUTANTS WRONG'))
        return
    rev = a.rev or (CONTROL_REV if a.control else None)
    F = files_from(None if (a.control and rev) else a.stage, rev)
    run_once(F, 'control' if a.control else 'target')
    red = report('control (%s)' % (rev or 'live') if a.control else 'target (%s)' % (a.stage or 'live'))
    log('RED: ' + json.dumps(red))
    if a.control:
        miss = sorted(set(CONTROL_RED) - set(red)); extra = sorted(set(red) - set(CONTROL_RED))
        log('RESULT: ' + ('CONTROL EXACT (%d red)' % len(red) if not miss and not extra
                          else 'CONTROL WRONG: green but expected red %s; red but not expected %s' % (miss, extra)))
    else:
        log('RESULT: ' + ('GREEN' if not red else 'RED'))

if __name__ == '__main__':
    main()
