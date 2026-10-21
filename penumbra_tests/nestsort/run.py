# =============================================================================
# NESTSORT SUITE (2026-10-20) - a nested-table (@@JSON) column sorts by how many
# rows its tables hold, not by its cell's text (which ran the tables' text together
# and ordered by a first value that meant nothing). One count rule, two engines:
# js/main.js penumbraNestedRowCount / _pnbNestedCellRows  <->  penumbra_search.php
# penumbra_nested_row_count (json_decode fast path, the same walk behind it).
#
#   page half   harness.html + driver.js: the REAL main.js through the REAL run path
#               and the REAL header menu (js/penumbra_colmenu.js) on fixture.json -
#               header click, Shift+click chain, saved sort, saved sort on a HIDDEN
#               (lazy) column, ?sort=, grouped view, the menu's wording and items, a
#               breakdown table, a custom sort order, comparison-view cells     L-<scn>-<check>, E-<scn>
#   PHP half    test_nestsort.php: the runner's functions lifted by
#               pivotparity\extract_mirror.php (the runner is NEVER included) -
#               apply_state_logic's sort (the scheduled email), index.php's ?json=1
#               saved-sort block cut out and run, the count rule        P-* R-* J-* W-php
#   both        corpus.json case by case in each engine; fuzz: the two engines give
#               the same count on ~550 generated strings                Z-fuzz
#   static      the help names it                                       S-*
# Each order check compares the page / runner order with the order the fixture's OWN
# counts give (written while each value was built), stable: ties keep row order.
#
#   py -3 run.py [--app DIR]               the files under test (default: the live webroot):
#                                          js\main.js js\penumbra_colmenu.js schedule_runner.php
#                                          penumbra_search.php index.php help\topics\*.php
#   py -3 run.py --control --app DIR       the PRE-fix build: every NEW check red, every guard green
#   py -3 run.py --mutants --app DIR       each mutant against the checks it must turn red
#   py -3 run.py --mutant NAME --app DIR   one of them
#   --scn S   one page scenario (and no PHP half);   --php   the PHP half only
# Headless Edge over CDP; stages into %TEMP%\pnb_ns_*; writes nothing to the webroot.
# =============================================================================
import json, os, random, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EXTRACT = os.path.join(os.path.dirname(HERE), 'pivotparity', 'extract_mirror.php')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
UNDER_TEST = ['js/main.js', 'js/penumbra_colmenu.js', 'schedule_runner.php', 'penumbra_search.php', 'index.php',
              'help/topics/userSettingsHelpLightbox.php', 'help/topics/powerFeaturesHelpLightbox.php']
SCN = [('unit', ''), ('click', ''), ('chain', ''), ('saved', ''), ('savedhidden', ''), ('url', '&sort=N_JSON%7Cdesc'),
       ('grouped', ''), ('menu', ''), ('breakdown', ''), ('custom', ''), ('plain', '')]
# what this change brings (red on the pre-fix build); every other check is a GUARD
# (what the page already does, which must hold on both builds)
NEW = {
    'L-unit-corpus', 'L-unit-cellCorpus', 'L-unit-cmpCells', 'L-unit-cmpSort', 'Z-fuzz',
    'L-click-clickAsc', 'L-click-clickDesc', 'L-click-topFive',
    'L-chain-chainNumTie', 'L-chain-chainUnder',
    'L-saved-savedDesc', 'L-savedhidden-hiddenAsc', 'L-url-urlDesc',
    'L-grouped-groupedSaved', 'L-grouped-groupedAsc', 'L-grouped-groupedMenuLabels',
    'L-menu-menuLabels', 'L-menu-menuSortDesc', 'L-menu-menuThenLabels', 'L-menu-menuThen', 'L-menu-menuLate', 'L-menu-menuLateSort',
    'L-breakdown-bdMarked', 'L-breakdown-bdDesc', 'L-breakdown-bdAsc', 'L-breakdown-bdLabels',
    'L-custom-customIgnored',
    'P-corpus', 'P-walkSame', 'P-fixture',
    'R-desc', 'R-asc', 'R-chain', 'R-chainUnder', 'R-hidden', 'R-custom', 'R-grouped',
    'J-desc', 'J-chain', 'J-hidden',
    'S-helpMenu', 'S-helpSort',
}
M, CM, SR, PS, IX = 'js/main.js', 'js/penumbra_colmenu.js', 'schedule_runner.php', 'penumbra_search.php', 'index.php'
# name: (half, file, old, new, how many times old occurs, the checks it must turn red)
MUTANTS = {
    'js-text': ('js', M, "                    } else if (cell && cell.classList.contains('cell-contains-nested-table')) {\n",
                "                    } else if (false) {\n", 1,
                ['L-click-clickAsc', 'L-click-clickDesc', 'L-saved-savedDesc', 'L-url-urlDesc', 'L-grouped-groupedSaved', 'L-unit-cmpSort']),
    'js-nozero': ('js', M, "                if (!mapped[_nr].values[_ni].nest) mapped[_nr].values[_ni] = { text: '', num: 0, date: null, nest: true };\n",
                  "                void 0;\n", 1, ['L-click-clickAsc', 'L-click-clickDesc']),
    'js-custom': ('js', M, "var customCmp = _srNested[i] ? null : getCustomSortComparator(crit.colIdentifier);",
                  "var customCmp = getCustomSortComparator(crit.colIdentifier);", 1, ['L-custom-customIgnored']),
    'js-walk-empty': ('js', M, "            if (want && depth === 1 && ch !== 93) { count++; want = false; }   // an item starts\n",
                      "            if (want && depth === 1) { count++; want = false; }   // an item starts\n", 1,
                      ['L-unit-corpus', 'L-click-clickAsc']),
    'js-walk-escape': ('js', M, "                else if (ch === 92) esc = true;                    // a backslash\n",
                       "                else if (ch === 92) esc = false;                    // a backslash\n", 1, ['L-unit-corpus']),
    'js-now': ('js', M, "            if (c.classList.contains('snap-ba-now-only')) { host = c; break; }\n",
               "            if (false) { host = c; break; }\n", 1, ['L-unit-cmpCells', 'L-unit-cmpSort']),
    'js-deep': ('js', M, "        for (c = host.firstElementChild; c; c = c.nextElementSibling) {\n            if (c.classList.contains('raw-json-data') || c.classList.contains('json-error-fallback')) return _pnbJsonRows(c.textContent || '', 0);\n        }\n",
                "        var _d = host.querySelector('.raw-json-data, .json-error-fallback'); if (_d) return _pnbJsonRows(_d.textContent || '', 0);\n", 1,
                ['L-unit-cellCorpus', 'L-click-clickDesc']),
    'js-cap200': ('js', M, "        for (var i = 0; i < masterRowData.length; i++) {\n            var v = masterRowData[i].get(name);\n            if (v != null && String(v).indexOf('@@JSON') !== -1) return true;\n",
                  "        for (var i = 0; i < masterRowData.length && i < 200; i++) {\n            var v = masterRowData[i].get(name);\n            if (v != null && String(v).indexOf('@@JSON') !== -1) return true;\n", 1,
                  ['L-menu-menuLate']),
    'js-bdval': ('js', M, "                    if (bdNested[col]) {\n                        sortVal = String(penumbraNestedRowCount(rowMap.get(col)));\n                    } else if (ds.numeric[col]) {\n",
                 "                    if (ds.numeric[col]) {\n", 2, ['L-breakdown-bdDesc', 'L-breakdown-bdAsc']),
    'js-bdmark': ('js', M, "(bdNested[col] ? ' data-pnb-nested=\"1\"' : '')", "''", 2, ['L-breakdown-bdMarked', 'L-breakdown-bdLabels']),
    'cm-labels': ('js', CM, "        var up = nested ? 'fewest rows first' : 'ascending', down = nested ? 'most rows first' : 'descending';\n",
                  "        var up = 'ascending', down = 'descending';\n", 1,
                  ['L-menu-menuLabels', 'L-menu-menuThenLabels', 'L-menu-menuLate', 'L-grouped-groupedMenuLabels']),
    'cm-bdlabels': ('js', CM, "        var up = nest ? 'fewest rows first' : 'ascending', down = nest ? 'most rows first' : 'descending';\n",
                    "        var up = 'ascending', down = 'descending';\n", 1, ['L-breakdown-bdLabels']),
    'php-runner': ('php', SR, "                if (isset($nestRows[$ci])) { $cmp = $nestRows[$ci][$valA] <=> $nestRows[$ci][$valB]; }\n",
                   "                if (false) { $cmp = 0; }\n", 1,
                   ['R-desc', 'R-asc', 'R-chain', 'R-chainUnder', 'R-hidden', 'R-custom', 'R-grouped']),
    'php-walk-object': ('php', PS, "    if ($o === 123) return 1;                                  // {\n",
                        "    if ($o === 123) return 0;                                  // {\n", 1, ['P-corpus', 'P-walkSame']),
    'php-decode-only': ('php', PS, "    return _penumbra_json_rows($s, $p + 6);\n}\n", "    return 0;\n}\n", 1, ['P-corpus', 'P-fixture', 'R-desc']),
    'php-api': ('php', IX, "{ $_nsNested[$ci] = true; break; }", "{ $_nsNested[$ci] = false; break; }", 1, ['J-desc', 'J-chain', 'J-hidden']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app = opt('--app', APP)
control = flag('--control')
mutants = flag('--mutants')
one_mutant = opt('--mutant', None)
only_scn = opt('--scn', None)
php_only = flag('--php')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
def fs(p): return p.replace('\\', '/')
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')


# ---------------------------------------------------------------- the fixture
def make_fixture():
    names = ['Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley']
    statuses = ['Open', 'Closed', 'Pending']
    big = {50: 73, 120: 56, 180: 55, 79: 54, 233: 51}     # fi-epa-c's top five, 2026-10-20
    cols = ['V_ID', 'V_NAME', 'V_STATUS', 'N_JSON', 'V_NUM', 'L_JSON', 'H_JSON']
    rows, ex = [], {'N_JSON': [], 'L_JSON': [], 'H_JSON': []}
    for i in range(1, 241):
        r = {'V_ID': 'ID-%d' % (1000 + i), 'V_NAME': names[(i * 7) % 6], 'V_STATUS': statuses[(i * 5) % 3]}
        if i % 11 == 0: v, c = None, 0                                        # no value at all
        elif i % 13 == 0: v, c = '@@JSON', 0                                  # '@@JSON' || NULL
        elif i % 17 == 0: v, c = '@@JSON[]', 0
        elif i % 19 == 0: v, c = '@@JSON{"ONE":"x%d"}' % i, 1                 # a lone object
        elif i % 23 == 0: v, c = '@@JSON' + json.dumps(['a', 'b', 'c']), 3    # scalars
        elif i % 29 == 0:                                                      # a table in a sub-cell
            inner = '@@JSON' + json.dumps([{'Z': z} for z in range(7)])
            v, c = '@@JSON' + json.dumps([{'K': 'k%d' % i, 'SUB': inner}]), 1
        elif i % 31 == 0: v, c = '@@JSON[{"PT_ID":"P1"},{"PT_ID":"P2"},{"PT_ID":"P3"},{"PT_I', 4   # cut short
        elif i % 37 == 0: v, c = '@@JSON{"A":"x","B":"y', 1                  # an object cut short
        else:
            k = big.get(i, (i * 7) % 9 + 1)
            items = [{'PT_ID': 'P23-%06d' % (i * 100 + j)} for j in range(k)]
            if i % 5 == 0:
                for it in items: it['NOTE'] = 'a "quoted", [bracketed] {braced} note'
            v, c = '@@JSON' + json.dumps(items, separators=(',', ':')), k
        r['N_JSON'] = v; ex['N_JSON'].append(c)
        r['V_NUM'] = str(i % 10)
        # no table in the first 210 rows (the menu's old look stopped at row 200); the
        # letters fall as the count rises, so text order is NOT count order
        if i <= 210: v, c = None, 0
        else:
            k = i % 4 + 1
            v, c = '@@JSON' + json.dumps([{'L': chr(ord('z') - k) + str(j)} for j in range(k)], separators=(',', ':')), k
        r['L_JSON'] = v; ex['L_JSON'].append(c)
        k = (i * 5) % 7                                                        # hidden; 0 = []
        r['H_JSON'] = '@@JSON' + json.dumps([{'H': chr(ord('z') - k) + str(j)} for j in range(k)], separators=(',', ':'))
        ex['H_JSON'].append(k)
        rows.append({c2: r[c2] for c2 in cols})
    return {'cols': cols, 'rows': rows, 'expect': ex}


def make_fuzz():
    rnd = random.Random(20261020)
    alpha = ['[', ']', '{', '}', '"', ',', ':', '\\', ' ', 'a', '1', '\n', '\t', '@@JSON', 'null', '[{"A":1}', '"x,]"', '"\\"', 'é']
    out = []
    for _ in range(400):
        s = ''.join(rnd.choice(alpha) for _ in range(rnd.randint(0, 24)))
        out.append(('@@JSON' + s) if rnd.random() < 0.8 else s)
    def val(d):
        t = rnd.random()
        if d > 2 or t < 0.3: return rnd.choice([1, 'x', 'a,b]', 'q"t', None, True, 'é{', '\\'])
        if t < 0.65: return [val(d + 1) for _ in range(rnd.randint(0, 4))]
        return {'K%d' % j: val(d + 1) for j in range(rnd.randint(0, 3))}
    for _ in range(150):
        s = json.dumps(val(0), ensure_ascii=rnd.random() < 0.5)
        if rnd.random() < 0.3: s = s[:rnd.randint(0, len(s))]                  # cut short
        out.append('@@JSON' + s)
    return out


# ---------------------------------------------------------------- the page half
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__HC = { master: function () { return masterRowData; },'
         ' count: (typeof penumbraNestedRowCount === "function") ? penumbraNestedRowCount : null,'
         ' cellRows: (typeof _pnbNestedCellRows === "function") ? _pnbNestedCellRows : null,'
         ' fmt: function (v) { return formatCellContent(v); },'
         ' sortRows: function (rows) { sortRows(rows); return rows; },'
         ' setSort: function (c) { sortCriteria = c; },'
         ' breakdown: function (rows, t) { _showChartDrillBreakdown(rows, [t || "Test"], [], null); } };'
         ' } catch (e) { window.__HC_ERR = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')


class Browser:
    def __init__(self, stage):
        self.stage = stage
        def free_port():
            s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
        self.hp, self.dp = free_port(), free_port()
        self.srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(self.hp), '--bind', '127.0.0.1', '--directory', stage],
                                    cwd=stage, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                                      '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                                      '--remote-debugging-port=%d' % self.dp, '--remote-allow-origins=*', 'about:blank'],
                                     cwd=stage, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(150):
            try: self.jget('/json/version'); break
            except Exception: time.sleep(0.2)

    def jget(self, p, m='GET'):
        return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (self.dp, p), method=m), timeout=15).read().decode())

    def run_page(self, scn, extra):
        t = self.jget('/json/new?about:blank', 'PUT')
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
            call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is the same main_hc.js
            call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (self.hp, scn, extra)})
            t0 = time.time()
            while time.time() - t0 < 180:
                time.sleep(0.25)
                v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
                if v: return json.loads(v)
            return {'fatal': 'timeout (180 s)'}
        finally:
            try: ws.close()
            except Exception: pass
            try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (self.dp, t['id']), timeout=10).read()
            except Exception: pass

    def close(self):
        for p in (self.edge, self.srv):
            try: p.kill()
            except Exception: pass


def stage_page(stage, appdir):
    for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
    shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
    shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colmenu.css'), os.path.join(stage, 'penumbra_colmenu.css'))
    for f in ('harness.html', 'driver.js', 'corpus.json'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(read_b(os.path.join(appdir, 'js', 'main.js'))).encode('utf-8', 'surrogateescape'))
    shutil.copyfile(os.path.join(appdir, 'js', 'penumbra_colmenu.js'), os.path.join(stage, 'penumbra_colmenu.js'))


def page_checks(results):
    out = []
    for r in results:
        scn = r.get('scn', '?')
        if r.get('fatal'):
            out.append(('F-' + scn, False, r['fatal'][:300])); continue
        for k, v in r.get('chk', {}).items():
            detail = ''
            if k == 'corpus': detail = '; '.join(r.get('corpusBad', [])[:4]) or '%d cases' % len(r.get('corpus', []))
            elif k == 'cellCorpus': detail = '; '.join(r.get('cellBad', [])[:4]) or 'drawn as the page draws them'
            elif k == 'cmpCells': detail = 'now counts %s' % r.get('cmpCells')
            elif k == 'cmpSort': detail = 'order %s' % r.get('cmpOrder')
            elif k in ('clickAsc',): detail = 'first counts %s' % r.get('ascFirst')
            elif k in ('clickDesc', 'topFive'): detail = 'first counts %s' % r.get('descFirst')
            elif k == 'menuLabels': detail = '%s' % r.get('labels')
            elif k == 'menuPlainLabels': detail = '%s' % r.get('plainLabels')
            elif k == 'menuThenLabels': detail = '%s' % r.get('thenLabels')
            elif k == 'menuLate': detail = '%s' % r.get('lateLabels')
            elif k == 'groupedMenuLabels': detail = '%s' % r.get('gLabels')
            elif k == 'groupedSaved': detail = '%s groups' % r.get('groups')
            elif k == 'bdLabels': detail = '%s' % r.get('bdLabels')
            elif k == 'bdPlainLabels': detail = '%s' % r.get('bdPlainLabels')
            out.append(('L-%s-%s' % (scn, k), bool(v), detail))
        out.append(('E-' + scn, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr') or '')))
    return out


# ---------------------------------------------------------------- the PHP half
def run_php(appdir, work):
    mirror = os.path.join(work, 'runner_mirror.php')
    r1 = subprocess.run([PHP, '-n', '-d', 'memory_limit=1024M', EXTRACT, fs(os.path.join(appdir, 'schedule_runner.php')), fs(mirror)],
                        cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    if r1.returncode != 0 or not os.path.exists(mirror):
        return [('F-php', False, 'extract_mirror failed: %s' % (r1.stdout + r1.stderr)[-300:])], None
    r2 = subprocess.run([PHP, '-n', '-d', 'memory_limit=1024M', '-d', 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext', '-d', 'extension=mbstring',
                         os.path.join(HERE, 'test_nestsort.php'), fs(appdir), fs(work)],
                        cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
    line = [l for l in r2.stdout.splitlines() if l.startswith('RESULTS_JSON:')]
    if not line:
        return [('F-php', False, 'no RESULTS_JSON (exit %s): %s' % (r2.returncode, (r2.stdout + r2.stderr)[-400:]))], None
    res = json.loads(line[-1][len('RESULTS_JSON:'):])
    out = [(c['id'], c['pass'], c['detail']) for c in res.get('checks', [])]
    if res.get('fatal'): out.append(('F-php', False, res['fatal'][:300]))
    out.append(('W-php', res.get('warningCount', 0) == 0, '%s warning(s) %s' % (res.get('warningCount'), res.get('warnings', [])[:3])))
    return out, res.get('fuzz')


def static_checks(appdir):
    hu = read_b(os.path.join(appdir, 'help', 'topics', 'userSettingsHelpLightbox.php'))
    hp = read_b(os.path.join(appdir, 'help', 'topics', 'powerFeaturesHelpLightbox.php'))
    return [('S-helpMenu', 'Sort most rows first' in hu and 'Sort fewest rows first' in hu, 'the header menu help names the nested items'),
            ('S-helpSort', 'how many rows its table holds' in hp, 'Multi-Column Sorting names the row count'),
            ('S-noEmDash', '\u2014' not in hu and '\u2014' not in hp, 'no em-dash in the served help')]


# ---------------------------------------------------------------- one build
def run_build(appdir, scns, halves):
    stage = tempfile.mkdtemp(prefix='pnb_ns_')
    res = []
    try:
        fx, fz = make_fixture(), make_fuzz()
        for name, data in (('fixture.json', fx), ('fuzz.json', fz)):
            open(os.path.join(stage, name), 'w', encoding='utf-8').write(json.dumps(data))
        shutil.copyfile(os.path.join(HERE, 'corpus.json'), os.path.join(stage, 'corpus.json'))
        js_fuzz = php_fuzz = None
        if 'js' in halves:
            stage_page(stage, appdir)
            b = Browser(stage)
            try:
                pages = [b.run_page(s, e) for s, e in SCN if s in scns]
            finally:
                b.close()
            res += page_checks(pages)
            js_fuzz = next((p.get('fuzz') for p in pages if p.get('scn') == 'unit'), None)
        if 'php' in halves:
            work = os.path.join(stage, 'php'); os.makedirs(work)
            for name in ('fixture.json', 'fuzz.json', 'corpus.json'): shutil.copyfile(os.path.join(stage, name), os.path.join(work, name))
            pres, php_fuzz = run_php(appdir, work)
            res += pres
        if 'js' in halves and 'php' in halves and 'unit' in scns:
            same = bool(js_fuzz) and bool(php_fuzz) and js_fuzz == php_fuzz and None not in js_fuzz
            diff = [i for i in range(min(len(js_fuzz or []), len(php_fuzz or []))) if js_fuzz[i] != php_fuzz[i]][:3]
            res.append(('Z-fuzz', same, '%d strings, JS == PHP%s' % (len(fz), (' - first differences at %s: %r' % (diff, [fz[i] for i in diff])) if diff else '')))
        if 'static' in halves:
            res += static_checks(appdir)
    finally:
        time.sleep(1)
        shutil.rmtree(stage, ignore_errors=True)
    return res


def mutate_app(base, name):
    half, rel, old, new, want, must = MUTANTS[name]
    tmp = tempfile.mkdtemp(prefix='pnb_nsm_')
    for f in UNDER_TEST:
        d = os.path.join(tmp, f.replace('/', os.sep)); os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(os.path.join(base, f.replace('/', os.sep)), d)
    p = os.path.join(tmp, rel.replace('/', os.sep))
    src = read_b(p)
    nl = '\r\n' if src.count('\r\n') else '\n'
    o, nw = old.replace('\n', nl), new.replace('\n', nl)
    if src.count(o) != want:
        shutil.rmtree(tmp, ignore_errors=True)
        raise SystemExit("mutant '%s': anchor found %d times in %s, want %d (needs the FIXED build)" % (name, src.count(o), rel, want))
    open(p, 'wb').write(src.replace(o, nw).encode('utf-8', 'surrogateescape'))
    return tmp, half, must


if __name__ == '__main__':
    print('build under test: %s%s' % (app, '   (CONTROL: the pre-fix build)' if control else ''))
    if mutants or one_mutant:
        ok = bad = 0
        for name in ([one_mutant] if one_mutant else list(MUTANTS)):
            tmp, half, must = mutate_app(app, name)
            try:
                scns = [s for s, _ in SCN] if half == 'js' else []
                res = run_build(tmp, scns, {half})
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
            red = [a for a, p, _ in res if not p]
            good = not [m for m in must if m not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-16s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', name, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
        sys.exit(0)
    if only_scn:
        halves, scns = {'js'}, [only_scn]
    elif php_only:
        halves, scns = {'php', 'static'}, []
    else:
        halves, scns = {'js', 'php', 'static'}, [s for s, _ in SCN]
    res = run_build(app, scns, halves)
    p = f = 0; failed = []; wrong = []
    for aid, passed, detail in res:
        kind = 'NEW  ' if aid in NEW else 'guard'
        print('  %s  %s %-30s %s' % ('PASS' if passed else 'FAIL', kind, aid, detail))
        if passed: p += 1
        else: f += 1; failed.append(aid)
        if control and ((aid in NEW) == passed): wrong.append(aid)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        print('CONTROL: every NEW check red and every guard green? %s' % ('yes' if not wrong else 'NO - ' + ' '.join(wrong)))
        print('RESULT: GREEN' if not wrong and res else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
