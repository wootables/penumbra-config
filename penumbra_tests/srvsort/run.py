# =============================================================================
# SRVSORT SUITE (2026-10-24) - the SERVER's readers of a report's saved SORT, BY NAME, as the page reads it.
#
# A save keeps each sort level's colIndex as its column's PLACE in the page's result (Object.keys order: a column
# named 2021 comes first there). Since ldsort (d1b8d52) the page finds each level again by its name against the
# result it loads (main.js _pnbStateSortByName); the ?json=1 API (index.php) and the stub of an encrypted report
# (generate_stub.php) read colIndex by PLACE, in PHP's own key order: after the report's SQL put a column in front,
# moved or dropped one - or for a column named like a number, even unchanged - they sorted by another column than
# the page. srvsort: one PHP twin of the page's rule (penumbra_layout.php pnb_sort_state_here, which the stub carries
# with the layout twin) called before both readers' own loops.
#
#   page half    parity.html + parity.js + lifted.js (the candidate main.js's OWN _pnbStateSortByName, the query
#                success handler's header map and its ldsort block): a corpus of saved states and results -> the
#                columns the page sorts by (Edge over CDP)
#   twin half    parity.php: the twin over the same corpus - level for level, the page's places from the readers'
#                rows, the levels on the page's columns in each reader's own places (8.2 with mbstring; 7.4: P74-*;
#                5.6 without: P56-*)                                                                          P-*
#   reader half  hooks.php: index.php ?json=1's OWN sort block lifted and run - the rows in the page's order  H-json-*
#                stubhook.php: generate_stub.php's stub GENERATED, its own sort block run with the twin it carries
#                (8.2: H-stub-*; 7.4, sorted not placed: H74-stub-*)                                 H-stub-*, H-stub-embed
#                a state the page reads as before reads exactly as in the reference cut                        O-*
#   source       the twin, the readers and the generated stub lint (8.2; the twin and the stub on 7.4, the twin on 5.6) S-*
#
#   py -3 run.py [--stage DIR]       candidate = DIR\<file> where it exists, else the live webroot's
#   py -3 run.py --control           the LIVE files: the NEW checks red, every GUARD green
#   py -3 run.py --stage DIR --mutants | --mutant a,b
#   [--ref DIR]   the files BEFORE srvsort (default: the kit's live\ cut)   [--main FILE]  main.js (default: live)
# Headless Edge over CDP (one page, once per run); stages into %TEMP%\pnb_srs_*; writes nothing to the webroot.
# NEVER loads schedule_runner.php (Oracle + it SENDS MAIL). Run it through the kit's run_suite.ps1 (one Edge suite
# at a time across sessions).
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
PHP74 = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP7.4.3\php.exe'   # a stub runs on its reader's PHP (7.1+)
PHP56 = r'\\oitras.oit.ncsu.edu\c$\PHP\php.exe'                   # 5.6.20: only for "the twin still runs on an old PHP"
MB82 = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext/php_mbstring.dll'   # forward slashes: -d eats a leading \\
MB74 = '//oitras.oit.ncsu.edu/d$/Utilities/PHP7.4.3/ext/php_mbstring.dll'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
KIT = os.path.join(HERE, 'stage_20261024')
FILES = {'ix': 'index.php', 'gs': 'generate_stub.php', 'lib': 'penumbra_layout.php'}

# --- targeted mutants: (file key, old, new) each once; the checks one of which must go red ---
IXCALL = ("                $state = pnb_sort_state_here($state, array_keys($response['data'][0]), $journal_toggle_cols,\n"
          "                    $_ssMine ? function ($n) use ($_ssMine) { return in_array((string)$n, $_ssMine, true); } : null);\n")
MUTANTS = {
    # penumbra_layout.php (LF) - the twin
    't-placefirst': ([('lib', "        if ($at >= 0 && $at < $n && _pnb_layout_upper($names[(int)$at]) === $u) $hit[$k] = (int)$at;\n        elseif",
                       "        if (false) $hit[$k] = (int)$at;\n        elseif")], ['P-casesame-map', 'H-json-casesame', 'H-stub-casesame']),
    't-byname': ([('lib', "        elseif (isset($byName[$u])) $hit[$k] = $byName[$u];\n", "")], ['P-front-map', 'H-json-front', 'H-stub-front']),
    't-lastdup': ([('lib', "        $byName[_pnb_layout_upper($nm)] = $i;\n", "        if (!isset($byName[_pnb_layout_upper($nm)])) $byName[_pnb_layout_upper($nm)] = $i;\n")],
                  ['P-casemoved-map', 'H-json-casemoved']),
    't-upper': ([('lib', "        $u = _pnb_layout_upper(_pnb_layout_js_str($c['colIdentifier'])); $at = _pnb_sort_place_of($c);",
                  "        $u = _pnb_layout_js_str($c['colIdentifier']); $at = _pnb_sort_place_of($c);")], ['P-lowerident-map', 'H-json-lowerident']),
    't-mb': ([('lib', "    return function_exists('mb_strtoupper') ? mb_strtoupper($s, 'UTF-8') : strtoupper($s);", "    return strtoupper($s);")],
             ['P-unicode-map', 'H-json-unicode']),
    't-rename': ([('lib', "            if ($savedCount !== $ours || $at < 0 || $at >= $n || isset($named[(int)$at]) || $mine[(int)$at]) { $dropped[] = $c['colIdentifier']; continue; }",
                   "            if (true) { $dropped[] = $c['colIdentifier']; continue; }")], ['P-renamed-map', 'H-json-renamed', 'H-stub-oldname', 'O-json-calcren']),
    't-count': ([('lib', "            if ($savedCount !== $ours || $at < 0", "            if ($at < 0")], ['P-renamedfront-map', 'H-json-renamedfront', 'H-json-link']),
    't-named': ([('lib', "|| $at >= $n || isset($named[(int)$at]) || $mine[(int)$at])", "|| $at >= $n || $mine[(int)$at])")], ['P-namedplace-map', 'H-json-namedplace']),
    't-mine': ([('lib', "|| isset($named[(int)$at]) || $mine[(int)$at])", "|| isset($named[(int)$at]))")], ['P-linkmine-map', 'H-json-linkmine']),
    't-ours': ([('lib', "        if (!$mine[$i]) $ours++;\n", "        $ours++;\n")], ['P-viewercalc-map', 'H-json-link']),
    't-used': ([('lib', "        if (isset($used[$i])) continue;\n", "")], ['P-dup-map']),
    't-virtual': ([('lib', "    return $c['colIndex'] === '#' || strncmp($c['colIndex'], '__', 2) === 0;", "    return $c['colIndex'] === '#';")],
                  ['P-journal-map', 'H-json-journal', 'H-json-journalren']),
    't-hash': ([('lib', "    return $c['colIndex'] === '#' || strncmp($c['colIndex'], '__', 2) === 0;", "    return strncmp($c['colIndex'], '__', 2) === 0;")],
               ['P-hashlast-map', 'P-hashfront-map']),
    't-level': ([('lib', "        && _pnb_layout_js_str($c['colIdentifier']) !== '';", "        ;")], ['P-blankident-map', 'H-json-blankident']),
    't-dir': ([('lib', "'direction' => (isset($c['direction']) && $c['direction'] === 'desc') ? 'desc' : 'asc');",
                "'direction' => isset($c['direction']) ? $c['direction'] : 'asc');")], ['P-dirupper-map', 'H-json-dirupper']),
    't-placeof': ([('lib', "    return _pnb_layout_is_place($x) ? (float)_pnb_layout_js_str($x) : -1;", "    return is_numeric($x) ? (float)$x : -1;")],
                  ['P-placeof', 'P-weird-map', 'H-json-weird']),
    't-jsorder': ([('lib', "        foreach (pnb_layout_js_keys($keys) as $k) $names[] = (string)$k;\n        $own = count($names);",
                    "        foreach ($keys as $k) $names[] = (string)$k;\n        $own = count($names);")], ['P-numrenamed-here-json', 'H-json-numrenamed', 'H-stub-numrenamed']),
    't-pos': ([('lib', "                $c['colIndex'] = $pos[$names[$c['colIndex']]];\n", "")], ['P-num2021-here-json', 'H-json-num2021sort', 'H-stub-nummany']),
    't-skip': ([('lib', "            if (!isset($skipped[(string)$k])) $keys[] = $k;\n        }\n        $names = array();",
                 "            $keys[] = $k;\n        }\n        $names = array();")], ['P-journalren-here-json', 'H-json-journalren']),
    't-savedcount': ([('lib', "            foreach ($state['columnOrder'] as $x) if (_pnb_layout_is_place($x)) $savedCount++;",
                       "            $savedCount = count($state['columnOrder']);")], ['P-coextra-here-json', 'H-json-coextra']),
    't-coabsent': ([('lib', "        $savedCount = -1;\n        if (array_key_exists('columnOrder', $state)", "        $savedCount = count($names);\n        if (array_key_exists('columnOrder', $state)")],
                   ['P-coabsent-here-json', 'H-json-coabsent']),
    't-pivot': ([('lib', "    if (array_key_exists('pivot', $state) && _pnb_sort_js_truthy($state['pivot'])) return $state;\n", "")],
                ['P-pivot-assaved', 'O-json-pivot', 'O-stub-pivot']),
    't-truthy': ([('lib', "    if (is_array($v)) return true;\n", "    if (is_array($v)) return (bool)$v;\n")], ['P-truthy', 'P-pivotempty-assaved', 'O-json-pivotempty']),
    't-nolist': ([('lib', "    if (!is_array($state) || !isset($state['sortCriteria']) || !_pnb_layout_is_list($state['sortCriteria'])\n",
                   "    if (!is_array($state) || !isset($state['sortCriteria'])\n")], ['P-nolist-assaved', 'O-json-nolist']),
    't-tail': ([('lib', "        foreach (array_values($tail) as $t) $names[] = (string)$t;\n", "")], ['P-calcren-here-stub', 'H-stub-calcren']),
    't-tailown': ([('lib', "                if ($c['colIndex'] >= $own) continue;\n", "")], ['P-calcfront2-here-stub', 'H-stub-calcfront2']),
    't-tailclash': ([('lib', "        if (isset($have[$d['name']]) || $d['refs'] === null) $why[$i] = true; else", "        if ($d['refs'] === null) $why[$i] = true; else")],
                    ['P-tail', 'P-calcclash-names-stub', 'H-stub-calcclash']),
    't-tailrefs': ([('lib', "            if (!isset($byName[$r])) { $bad = true; continue; }\n", "            if (!isset($byName[$r])) { continue; }\n")],
                   ['P-tailrefs', 'P-calcgone-names-stub', 'H-stub-calcgone', 'H-stub-calcgone2']),
    't-taildep': ([('lib', "            if (!$resolve($dep)) $bad = true;\n", "            $resolve($dep);\n")], ['P-tailrefs', 'P-calcchain-names-stub', 'H-stub-calcchain']),
    't-tailloop': ([('lib', "                foreach (array_slice($stack, array_search($dep, $stack, true)) as $x) $why[$x] = true;\n", "")],
                   ['P-tailloop', 'P-calcloop-names-stub', 'H-stub-calcloop']),
    't-tailinput': ([('lib', "        foreach ($defs[$i]['refs']['inputs'] as $n) if (!isset($inputs[$n])) $bad = true;\n", "")],
                    ['P-tailinput', 'P-calcnoinput-names-stub', 'H-stub-calcnoinput']),
    't-taildup': ([('lib', "        if (isset($at[$nm])) $defs[$at[$nm]] = $def; else {", "        if (isset($at[$nm])) {} else {")], ['P-taildup', 'P-calcdup-names-stub', 'H-stub-calcdup']),
    't-tailquote': ([('lib', "        if ($ch === '\"') {\n            $k = strpos($f, '\"', $i + 1);\n            if ($k === false) return null;\n            $i = $k + 1;\n            continue;\n        }\n", "")],
                    ['P-tailrefs', 'P-calcquote-names-stub', 'H-stub-calcquote']),
    't-tailname': ([('lib', "        if ($nm === null || !preg_match('/\\A[A-Z][A-Z0-9_]{0,59}\\z/', $nm) || !$flen || $flen > 500) continue;",
                     "        if ($nm === null || $nm === '' || !$flen || $flen > 500) continue;")], ['P-tail', 'P-calcclash-names-stub', 'H-stub-calcclash']),
    't-tailformula': ([('lib', "|| !$flen || $flen > 500) continue;", "|| $flen > 500) continue;")], ['P-tail', 'P-calcnoformula-names-stub', 'H-stub-calcnoformula']),
    't-tail20': ([('lib', "        if (++$good >= 20) break;\n", "")], ['P-tail20']),
    't-fullupper': ([('lib', "    if (!_pnb_layout_full_upper() && (_pnb_layout_non_ascii($names) || _pnb_sort_non_ascii_ids($criteria))) return null;\n", "")],
                    ['P56-unicode-map-noupper']),
    't-catch': ([('lib', "        $r = pnb_sort_by_name($state['sortCriteria'], $names, $savedCount, $notSaved);\n        if ($r === null) return $state;\n",
                  "        $r = pnb_sort_by_name($state['sortCriteria'], $names, $savedCount, $notSaved);\n")], ['P56-unicode-here-noupper']),
    # the readers
    'r-ixcall': ([('ix', IXCALL, "")], ['H-json-front', 'H-json-moved', 'H-json-num2021', 'H-S1-json']),
    'r-ixafter': ([('ix', IXCALL, ""),
                   ('ix', "        // --- APPLY SAVED SORT ORDER (Enhanced with Date Support) ---\n",
                    "        if (function_exists('pnb_sort_state_here') && isset($state['sortCriteria']) && !empty($response['data'])) $state = pnb_sort_state_here($state, array_keys($response['data'][0]), $journal_toggle_cols, null);\n        // --- APPLY SAVED SORT ORDER (Enhanced with Date Support) ---\n")],
                  ['H-json-journal', 'H-json-journalren', 'H-S1-json']),
    'r-ixskip': ([('ix', "array_keys($response['data'][0]), $journal_toggle_cols,\n                    $_ssMine", "array_keys($response['data'][0]), array(),\n                    $_ssMine")],
                 ['H-json-journalren']),
    'r-ixnotsaved': ([('ix', "$_ssMine = (!isset($_GET['id']) && !empty($_ssCalcAdded)) ? $_ssCalcAdded : array();", "$_ssMine = array();")], ['H-json-link', 'H-json-linkmine']),
    # the review's finding 1 (2026-10-24): every calculated column a link names, not the ones the API worked out
    'r-ixcalcnames': ([('ix', IXCALL, "                $state = pnb_sort_state_here($state, array_keys($response['data'][0]), $journal_toggle_cols, isset($_GET['id']) ? null : pnb_layout_calc_names($state));\n")],
                      ['H-json-linkclash']),
    'r-ixcalcdiff': ([('ix', "            $_ssCalcAdded = is_array($_ssFirst) ? array_values(array_diff(array_map('strval', array_keys($_ssFirst)), $_ssCalcFrom)) : array();",
                       "            $_ssCalcAdded = is_array($_ssFirst) ? array_map('strval', array_keys($_ssFirst)) : array();")], ['H-calc-added', 'H-calc-clash']),
    'r-ixhard': ([('ix', "            if (!function_exists('pnb_sort_state_here')) @include_once __DIR__ . '/penumbra_layout.php';\n",
                   "            if (!function_exists('pnb_sort_state_here')) require_once __DIR__ . '/penumbra_layout.php';\n")], ['H-S2-missing', 'F-hooks.php']),
    'r-ixsoft': ([('ix', "            if (function_exists('pnb_sort_state_here')) {\n                $_ssMine =",
                   "            if (true) {\n                $_ssMine =")], ['H-S2-empty', 'H-S2-missing', 'F-hooks.php']),
    'r-gscall': ([('gs', "                \\$decrypted_state = pnb_sort_state_here(\\$decrypted_state, array_keys(\\$results[0]), array(), null, pnb_sort_calc_tail(\\$decrypted_state, array_keys(\\$results[0])));\r\n", "")],
                 ['H-stub-front', 'H-stub-moved', 'H-stub-S1']),
    'r-gstail': ([('gs', "array(), null, pnb_sort_calc_tail(\\$decrypted_state, array_keys(\\$results[0])));", "array(), null, array());")], ['H-stub-calcren']),
    'r-gssoft': ([('gs', "            if (!empty(\\$decrypted_state['sortCriteria']) && function_exists('pnb_sort_state_here')) {\r\n",
                   "            if (!empty(\\$decrypted_state['sortCriteria'])) {\r\n")], ['H-stub-S2']),
    'r-gsembed': ([('gs', "{$pnb_layout_src}\r\n", "")], ['H-stub-embed', 'H-stub-front']),
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
ref_dir = opt('--ref', os.path.join(KIT, 'live'))
main_js = opt('--main', os.path.join(APP, 'js', 'main.js'))
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
def pick(rel):
    if control or not stage_dir: return os.path.join(APP, rel)
    p = os.path.join(stage_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {k: pick(v) for k, v in FILES.items()}
print('candidate: ' + ', '.join('%s=%s' % (v, cand[k]) for k, v in FILES.items()))
print('reference: ' + ref_dir + '   main.js: ' + main_js)
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape') if os.path.exists(p) else ''

# ---- the page's own code, lifted out of main.js
def lift_main(src):
    s = src.replace('\r\n', '\n')
    def once(a, what):
        if s.count(a) != 1: raise SystemExit('main.js: %s found %d times' % (what, s.count(a)))
        return s.find(a)
    a = once('    function _pnbStateSortByName(criteria, nameToIdx, savedCount, notSaved) {\n', '_pnbStateSortByName')
    b = s.find('    // Serialize the ACTIVE flat-table column sort back into the ?sort= grammar\n', a)
    la = once('                    // (2026-10-23, ldsort) A state load\'s saved sort, on the same terms: by name against\n', 'the ldsort block')
    lb = s.find('                    // Carry the previous run\'s column sort across a re-query. The\n', la)
    ha = s.rfind('                    const newColumnNames = Object.keys(data[0]);\n', 0, la)
    hb = s.find('                    // ?sort= URL override: replace the report\'s saved on-load column\n', ha)
    if min(b, lb, ha, hb) < 0 or not (ha < hb < la): raise SystemExit('main.js: the sort code is not where it was (%d %d %d %d)' % (b, lb, ha, hb))
    return ('// lifted.js - generated by srvsort run.py from %s\n(function () {\n  try {\n' % main_js.replace('\\', '/')
            + s[a:b]
            + '    window.__SS = _pnbStateSortByName;\n'
              '    window.__LOADSORT = function (data, decodedState, sortCriteria, pendingPivotSettings, isCalc) {\n'
              '      var isStateLoading = true, notices = [];\n'
              '      var show_text = function (h) { notices.push(String(h)); };\n'
              '      var escapeHtml = function (x) { return String(x); };\n'
              '      window.PenumbraCalc = { isCalc: isCalc };\n'
            + s[ha:hb] + s[la:lb]
            + '      return { sortCriteria: sortCriteria, names: newColumnNames, nameToIdx: columnNameToOriginalIndex, notices: notices };\n    };\n'
              '  } catch (e) { window.__LIFT_ERR = String(e && e.stack || e); }\n})();\n')

stage = tempfile.mkdtemp(prefix='pnb_srs_')
for f in ('parity.html', 'parity.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'jquery-3.7.1.min.js'), os.path.join(stage, 'jquery.js'))
open(os.path.join(stage, 'lifted.js'), 'wb').write(lift_main(read_b(main_js)).encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def page_side():
    hp, dp = free_port(), free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                             '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--remote-debugging-port=%d' % dp,
                             '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        def jget(p, m='GET'):
            return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
        for _ in range(150):
            try: jget('/json/version'); break
            except Exception: time.sleep(0.2)
        t = jget('/json/new?about:blank', 'PUT')
        ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
        n = [0]
        def call(m, p=None):
            n[0] += 1; mid = n[0]
            ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get('id') == mid: return r.get('result', {})
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/parity.html' % hp})
        t0 = time.time()
        while time.time() - t0 < 120:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__PARITY) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fx': [], 'errors': ['timeout (120 s)']}
    finally:
        # the whole tree: a headless Edge left behind holds every other session's Edge suite in its queue
        subprocess.run(['taskkill', '/PID', str(edge.pid), '/T', '/F'], capture_output=True)
        try: srv.kill()
        except Exception: pass

def php_lines(exe, script, *a, mb=None):
    cmd = [exe, '-n'] + (['-d', 'extension=' + mb] if mb else []) + [os.path.join(HERE, script)] + list(a)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = []
    for line in res.stdout.splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)', line)
        if m: out.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
    if 'TOTAL' not in res.stdout: out.append(('F-' + script, False, (res.stdout + res.stderr)[-600:]))
    return out
def lint(exe, path):
    res = subprocess.run([exe, '-n', '-l', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return res.returncode == 0 and 'No syntax errors' in res.stdout, (res.stdout + res.stderr).strip()[-300:]

fx_page = page_side()
fxjson = os.path.join(stage, 'parity.json')
open(fxjson, 'w', encoding='utf-8').write(json.dumps(fx_page))
KIND = {f['id']: f.get('kind') for f in fx_page.get('fx', [])}
print('page side: %d fixtures, %d errors' % (len(fx_page.get('fx', [])), len(fx_page.get('errors', []))))

def run_php(files):
    out = []
    out += [('F-page', False, ' ; '.join(fx_page.get('errors', [])))] if fx_page.get('errors') else []
    out += php_lines(PHP, 'parity.php', files['lib'], fxjson, mb=MB82)
    out += [('P74-' + n[2:] if n.startswith('P-') else 'P74-' + n, ok_, info) for n, ok_, info in php_lines(PHP74, 'parity.php', files['lib'], fxjson, mb=MB74)]
    out += [('P56-' + n[2:] if n.startswith('P-') else 'P56-' + n, ok_, info) for n, ok_, info in php_lines(PHP56, 'parity.php', files['lib'], fxjson)]
    out += php_lines(PHP, 'hooks.php', files['ix'], os.path.join(ref_dir, 'index.php'), files['lib'], os.path.join(APP, 'journal_export.php'),
                     os.path.join(APP, 'penumbra_search.php'), fxjson, os.path.join(APP, 'penumbra_calc.php'), mb=MB82)
    gen = os.path.join(stage, 'stub_generated_%d.php' % len(os.listdir(stage)))
    out += php_lines(PHP, 'stubhook.php', files['gs'], files['lib'], os.path.join(ref_dir, 'generate_stub.php'), os.path.join(ref_dir, 'penumbra_layout.php'),
                     fxjson, gen, mb=MB82)
    gen74 = gen.replace('.php', '_74.php')
    out += php_lines(PHP74, 'stubhook.php', files['gs'], files['lib'], os.path.join(ref_dir, 'generate_stub.php'), os.path.join(ref_dir, 'penumbra_layout.php'),
                     fxjson, gen74, '--sorted', mb=MB74)
    for n, exe, p in (('S-lint-lib82', PHP, files['lib']), ('S-lint-lib74', PHP74, files['lib']), ('S-lint-lib56', PHP56, files['lib']),
                      ('S-lint-ix82', PHP, files['ix']), ('S-lint-gs82', PHP, files['gs']), ('S-lint-stub82', PHP, gen), ('S-lint-stub74', PHP74, gen)):
        good, info = lint(exe, p) if os.path.exists(p) else (False, 'missing: ' + p)
        out.append((n, good, '' if good else info))
    if os.path.exists(files['lib']):
        out.append(('S-noclose', '?>' not in read_b(files['lib']), 'penumbra_layout.php holds a closing PHP tag (the stub embeds it whole)'))
    return out

def is_new(name):
    if name in ('P-S0-page', 'P74-S0-page', 'P56-S0-page'): return False   # the page's side ran: true either way
    if name.startswith(('P-', 'P74-', 'P56-', 'H-calc-')) or name in ('H-S1-json', 'H-S1-calc', 'H-stub-S1', 'H74-stub-S1', 'H-stub-S1-twin', 'H74-stub-S1-twin'): return True
    m = re.match(r'H(?:74)?-(?:json|stub)-(.+)$', name)
    return bool(m and KIND.get(m.group(1)) == 'NEW')

def report(res, title):
    bad = [r for r in res if not r[1]]
    print('\n==== %s: %d checks, %d red' % (title, len(res), len(bad)))
    for n, good, info in res:
        print('  %s  %s%s' % ('PASS' if good else 'FAIL', n, '' if good else '   ' + info[:700]))
    return bad

def mutate(name):
    edits, _ = MUTANTS[name]
    d = os.path.join(stage, 'mut_' + name)
    os.makedirs(d, exist_ok=True)
    files = dict(cand)
    texts = {}
    for k, old, new in edits:
        if k not in texts: texts[k] = read_b(files[k])
        c = texts[k].count(old)
        if c != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, k, c, old[:90]))
        texts[k] = texts[k].replace(old, new)
    for k, t in texts.items():
        p = os.path.join(d, FILES[k]); open(p, 'wb').write(t.encode('utf-8', 'surrogateescape')); files[k] = p
    return files

def fuzz(n):
    m = re.match(r'(?:[HPO](?:74|56)?)-(?:json-|stub-)?(fz\d+)', n)
    return bool(m)

if one_mutant or all_mutants:
    names = list(MUTANTS) if all_mutants else one_mutant.split(',')
    base = run_php(cand)
    base_bad = [r[0] for r in base if not r[1]]
    print('baseline: %d checks, %d red%s' % (len(base), len(base_bad), (': ' + ', '.join(base_bad[:20])) if base_bad else ''))
    bites = 0
    for name in names:
        res = run_php(mutate(name))
        red = set(r[0] for r in res if not r[1]) - set(base_bad)
        targets = MUTANTS[name][1]
        hit = [t for t in targets if t in red]
        ok_ = bool(hit)
        bites += ok_
        print('MUTANT %-14s %s   targets red: %s   (all newly red: %d: %s)' % (name, 'BITES' if ok_ else 'DOES NOT BITE', ', '.join(hit) or '-', len(red), ', '.join(sorted(red)[:12])))
    print('TOTAL mutants=%d bite=%d' % (len(names), bites))
    print('RESULT: GREEN' if bites == len(names) and not base_bad else 'RESULT: RED')
else:
    res = run_php(cand)
    bad = report(res, 'CONTROL (live)' if control else 'CANDIDATE')
    if control:
        # the fuzz cases are left out here: by place, some of them are right by luck
        new_green = [r[0] for r in res if is_new(r[0]) and r[1] and not fuzz(r[0])]
        guard_red = [r[0] for r in res if not is_new(r[0]) and not r[1] and not fuzz(r[0])]
        new_red = [r[0] for r in res if is_new(r[0]) and not r[1]]
        print('\nCONTROL: %d NEW checks red (%s ...); NEW but green: %s; GUARD red: %s'
              % (len(new_red), ', '.join(new_red[:8]), ', '.join(new_green) or 'none', ', '.join(guard_red) or 'none'))
        print('RESULT: CONTROL GREEN' if not new_green and not guard_red and new_red else 'RESULT: CONTROL RED')
    else:
        print('TOTAL pass=%d fail=%d' % (len(res) - len(bad), len(bad)))
        print('RESULT: GREEN' if not bad else 'RESULT: RED')
if not keep:
    shutil.rmtree(stage, ignore_errors=True)
else:
    print('kept: ' + stage)
