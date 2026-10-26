# =============================================================================
# LDSRV SUITE (2026-10-24) - the SERVER's readers of a report's saved column layout, BY NAME, as the page reads it.
#
# A saved state keeps visibleColumns / columnOrder as each column's PLACE in the result the page had, plus (since
# ldlayout, 2026-10-23) layoutColumnNames. The page maps place -> saved name -> the place that name has now
# (main.js _pnbLayoutByName); the ?json=1 API (index.php), every scheduled output (schedule_runner.php
# apply_state_logic) and the stub of an encrypted report (generate_stub.php) read the lists by PLACE - after the
# report's SQL put a column in front, moved or dropped one they showed other columns than the page. ldsrv: one PHP
# twin of the map (penumbra_layout.php) used by all three before their own by-place loops (the stub carries a copy).
#
#   page half    parity.html + parity.js + lifted.js (the candidate main.js's OWN _pnbLayoutByName, _pnbLayoutMap,
#                _pnbDenseNames and the state load's layout block): a corpus of saved states and results -> the
#                page's map and the columns it shows (Edge over CDP)                                       W-* by hand
#   twin half    parity.php: penumbra_layout.php over the same corpus - the page's key order, the map entry for
#                entry, the lists in the row's own places (on 8.2 with mbstring; again on 5.6: P56-*)        P-*
#   reader half  hooks.php: index.php's and apply_state_logic's OWN column blocks lifted and run (never the runner:
#                Oracle + SENDS MAIL) - the columns each shows == the page's                    H-json-*, H-sched-*
#                stubhook.php: generate_stub.php's stub GENERATED and its own block run with the twin it carries
#                                                                                               H-stub-*, H-stub-embed
#                a state the page reads by place reads exactly as in the reference cut                         O-*
#   source       the twin and the generated stub lint                                                         S-*
#
#   py -3 run.py [--stage DIR]       candidate = DIR\<file> where it exists, else the live webroot's
#   py -3 run.py --control           the LIVE files: the NEW checks red, every GUARD green
#   py -3 run.py --stage DIR --mutants | --mutant a,b
#   [--ref DIR]   the files BEFORE ldsrv (default: the kit's live\ cut)   [--main FILE]  main.js (default: live)
# Headless Edge over CDP (one page, once per run); stages into %TEMP%\pnb_lds_*; writes nothing to the webroot.
# Run it through the kit's run_suite.ps1 (one Edge suite at a time across sessions).
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
PHP56 = r'\\oitras.oit.ncsu.edu\c$\PHP\php.exe'          # 5.6.20: only for "the twin still runs on an old PHP"
MBSTRING = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext/php_mbstring.dll'   # forward slashes: -d eats a leading \\
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
KIT = os.path.join(HERE, 'stage_20261024')
FILES = {'ix': 'index.php', 'sr': 'schedule_runner.php', 'gs': 'generate_stub.php', 'lib': 'penumbra_layout.php'}

# --- targeted mutants: (file key, old, new) each once; the checks one of which must go red ---
MUTANTS = {
    # penumbra_layout.php (LF) - the twin
    't-jsorder': ([('lib', "    return array_merge($idx, $rest);\n", "    return $keys;\n")], ['P-numrenamed-keys', 'H-json-numrenamed', 'H-sched-numrenamed']),
    't-pos': ([('lib', "if (is_int($x) && $x >= 0) $list[] = $pos[(string)$js[$x]];", "if (is_int($x) && $x >= 0) $list[] = $x;")], ['H-json-numsaved', 'H-sched-nummany', 'H-stub-numrenamed']),
    't-curupper': ([('lib', "        $at[_pnb_layout_upper(_pnb_layout_js_str($n))][] = $i;\n", "        $at[_pnb_layout_js_str($n)][] = $i;\n")], ['P-casedup-map', 'H-json-casedup', 'H-sched-unicode']),
    't-savedupper': ([('lib', "        $u = _pnb_layout_upper($n);\n", "        $u = $n;\n")], ['P-lowernames-map', 'H-json-lowernames']),
    't-mb': ([('lib', "    return function_exists('mb_strtoupper') ? mb_strtoupper($s, 'UTF-8') : strtoupper($s);", "    return strtoupper($s);")], ['P-unicode-map', 'H-json-unicode']),
    't-taken': ([('lib', "        foreach ($at[$u] as $c) if (!isset($taken[$c])) { $map[$i] = $c; $taken[$c] = true; break; }",
                  "        foreach ($at[$u] as $c) { $map[$i] = $c; $taken[$c] = true; break; }")], ['P-casedup-map', 'H-sched-casedup']),
    't-rename': ([('lib', "    if ($ours === $theirs) foreach ($saved as $i => $n) {", "    if (false) foreach ($saved as $i => $n) {")],
                 ['P-renamed-map', 'H-json-renamed', 'H-sched-journalren', 'H-stub-calcren']),
    't-count': ([('lib', "    if ($ours === $theirs) foreach ($saved as $i => $n) {", "    if (true) foreach ($saved as $i => $n) {")], ['P-gonetwo-map', 'H-json-gonetwo']),
    't-allgone': ([('lib', "    if (_pnb_layout_is_list($vc) && _pnb_layout_some_place($vc) && !_pnb_layout_some_place($nv)) return null;\n", "")],
                  ['P-allgone-map', 'H-json-allgone', 'O-sched-allgone']),
    't-dense': ([('lib', "    foreach ($a as $n) if (!is_string($n) || $n === '') return false;", "    foreach ($a as $n) if (!is_string($n)) return false;")],
                ['P-holey-map', 'H-json-holey', 'P-dense']),
    't-cocount': ([('lib', "    if ($coPlaces !== $nSaved) return null;\n", "")], ['P-partial-map', 'H-json-partial', 'P-longer-map']),
    't-past': ([('lib', "    foreach ($listed as $x) if ((float)_pnb_layout_js_str($x) >= $nSaved) return null;\n", "")],
               ['P-badpast-map', 'H-json-badpast', 'P-badpastvis-map', 'H-sched-badpastvis']),
    't-listedvis': ([('lib', "    if (_pnb_layout_is_list($vc)) foreach ($vc as $x) if (_pnb_layout_is_place($x)) $listed[] = $x;\n", "")],
                    ['P-badpastvis-map', 'H-json-badpastvis']),
    't-place': ([('lib', "    return preg_match('/\\A[0-9]+\\z/', _pnb_layout_js_str($x)) === 1;", "    return is_numeric($x);")], ['P-weird-map', 'H-json-weird', 'P-isplace']),
    't-dollar': ([('lib', "    return preg_match('/\\A[0-9]+\\z/', _pnb_layout_js_str($x)) === 1;", "    return preg_match('/^[0-9]+$/', _pnb_layout_js_str($x)) === 1;")],
                 ['P-weird-map', 'H-json-weird', 'P-isplace']),
    't-jsbool': ([('lib', "    if (is_bool($x)) return $x ? 'true' : 'false';", "    if (is_bool($x)) return (string)$x;")], ['P-weird-map', 'P-jsstr']),
    't-jsarr': ([('lib', "    if (is_array($x) && _pnb_layout_is_list($x)) {", "    if (false) {")], ['P-weird-map', 'H-json-weird', 'P-jsstr']),
    't-junk': ([('lib', "                elseif (!is_numeric($x)) $list[] = $x;", "                else $list[] = $x;")], ['P-weird-here', 'H-json-weird', 'H-sched-weird', 'H-stub-weird']),
    't-fullupper': ([('lib', "    if (!_pnb_layout_full_upper() && (_pnb_layout_non_ascii($saved) || _pnb_layout_non_ascii($curNames))) return null;\n", "")],
                    ['P56-unicode-noupper']),
    't-unset': ([('lib', "        unset($out['layoutColumnNames']);\n", "")], ['P-front-names']),
    # (srvsort 2026-10-24: pnb_sort_state_here has the same skip line - the next line keeps this anchor unique)
    't-skipkeys': ([('lib', "            if (!isset($skipped[(string)$k])) $keys[] = $k;\n        }\n        $js = pnb_layout_js_keys($keys);",
                    "            $keys[] = $k;\n        }\n        $js = pnb_layout_js_keys($keys);")], ['P-skip', 'H-json-journalren', 'H-sched-journalren']),
    't-calcws': ([('lib', "        if ($n !== null) $n = preg_replace('/' . $ws . '+/u', '_', _pnb_layout_upper($n));",
                   "        if ($n !== null) $n = _pnb_layout_upper($n);")], ['P-calcnames', 'H-stub-calcspace']),
    # the readers
    'r-ixcall': ([('ix', "                $_ldState = pnb_layout_state_here($state, $first_row_keys, $journal_toggle_cols);\n", "                $_ldState = $state;\n")],
                 ['H-json-front', 'H-json-moved', 'H-json-gone']),
    'r-ixhard': ([('ix', "!function_exists('pnb_layout_state_here')) @include_once __DIR__ . '/penumbra_layout.php';\n",
                   "!function_exists('pnb_layout_state_here')) require_once __DIR__ . '/penumbra_layout.php';\n")], ['H-S2-missing', 'F-hooks.php']),
    'r-ixsoft': ([('ix', "            if (isset($state['layoutColumnNames']) && function_exists('pnb_layout_state_here')) {\n",
                   "            if (isset($state['layoutColumnNames'])) {\n")], ['H-S2-empty', 'F-hooks.php']),
    'r-ixvis': ([('ix', "                foreach ($_ldState['visibleColumns'] as $idx) {\n", "                foreach ($state['visibleColumns'] as $idx) {\n")], ['H-json-front']),
    'r-ixord': ([('ix', "                foreach ($_ldState['columnOrder'] as $idx) {\n", "                foreach ($state['columnOrder'] as $idx) {\n")], ['H-json-front', 'H-json-moved']),
    'r-ixskip': ([('ix', "pnb_layout_state_here($state, $first_row_keys, $journal_toggle_cols);", "pnb_layout_state_here($state, $first_row_keys, array());")],
                 ['H-json-journalren']),
    'r-srcall': ([('sr', "            $state = pnb_layout_state_here($state, $originalKeys, $preserveCols);\r\n", "")],
                 ['H-sched-front', 'H-sched-moved', 'H-sched-gone']),
    'r-srhard': ([('sr', "!function_exists('pnb_layout_state_here')) @include_once __DIR__ . '/penumbra_layout.php';\r\n",
                   "!function_exists('pnb_layout_state_here')) require_once __DIR__ . '/penumbra_layout.php';\r\n")], ['H-S2-missing', 'F-hooks.php']),
    'r-srsoft': ([('sr', "        if (isset($state['layoutColumnNames']) && function_exists('pnb_layout_state_here')) {\r\n",
                   "        if (isset($state['layoutColumnNames'])) {\r\n")], ['H-S2-empty', 'F-hooks.php']),
    'r-srskip': ([('sr', "pnb_layout_state_here($state, $originalKeys, $preserveCols);", "pnb_layout_state_here($state, $originalKeys, array());")],
                 ['H-sched-journalren']),
    'r-gsembed': ([('gs', "{$pnb_layout_src}\r\n", "")], ['H-stub-embed', 'H-stub-front']),
    'r-gscall': ([('gs', "                if (function_exists('pnb_layout_state_here')) \\$decrypted_state = pnb_layout_state_here(\\$decrypted_state, \\$first_row_keys, array(), pnb_layout_calc_names(\\$decrypted_state));\r\n", "")],
                 ['H-stub-front', 'H-stub-moved']),
    'r-gscalc': ([('gs', "array(), pnb_layout_calc_names(\\$decrypted_state));", "array(), null);")], ['H-stub-calcren', 'H-stub-calcspace']),
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
    a = s.find('    function _pnbLayoutByName(lay, curNames, notSaved) {\n')
    b = s.find("    // The columns a save leaves out: the viewer's own calculated columns.\n", a)
    la = s.find('                            const _ldLay = _pnbLayoutByName(decodedState, newColumnNames, _pnbNotSaved) || decodedState;\n')
    lb = s.find('                        } else if (restoreState) {\n', la)
    if min(a, b, la, lb) < 0: raise SystemExit('main.js: the layout code is not where it was (%d %d %d %d)' % (a, b, la, lb))
    return ('// lifted.js - generated by ldsrv run.py from %s\n(function () {\n  try {\n'
            '    var editor = { getValue: function () { return window.__Q || \'\'; } };\n'
            '    function _pnbNotSaved() { return false; }\n' % main_js.replace('\\', '/')
            + s[a:b]
            + '    window.__LD = { byName: _pnbLayoutByName, dense: _pnbDenseNames };\n'
              '    window.__LOAD = function (decodedState, newColumnNames) {\n'
              '      let finalColumnOrder, visibleColumnsSet;\n'
            + s[la:lb]
            + '      return { order: finalColumnOrder, vis: Array.from(visibleColumnsSet || []) };\n    };\n'
              '  } catch (e) { window.__LIFT_ERR = String(e && e.stack || e); }\n})();\n')

stage = tempfile.mkdtemp(prefix='pnb_lds_')
for f in ('parity.html', 'parity.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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

def php_lines(exe, script, *a, mb=True):
    cmd = [exe, '-n'] + (['-d', 'extension=' + MBSTRING] if mb else []) + [os.path.join(HERE, script)] + list(a)
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

def run_php(files):
    out = []
    out += [('F-page', False, ' ; '.join(fx_page.get('errors', [])))] if fx_page.get('errors') else []
    for f in fx_page.get('fx', []):
        if f.get('want') is not None:
            out.append(('W-' + f['id'], f.get('shown') == f['want'], '%s vs %s' % (f.get('shown'), f['want'])))
    out += php_lines(PHP, 'parity.php', files['lib'], fxjson)
    p56 = php_lines(PHP56, 'parity.php', files['lib'], fxjson, mb=False)
    out += [('P56-' + n[2:] if n.startswith('P-') else 'P56-' + n, ok_, info) for n, ok_, info in p56]
    out += php_lines(PHP, 'hooks.php', files['ix'], files['sr'], os.path.join(ref_dir, 'index.php'), os.path.join(ref_dir, 'schedule_runner.php'), files['lib'], fxjson)
    gen = os.path.join(stage, 'stub_generated_%d.php' % len(os.listdir(stage)))
    out += php_lines(PHP, 'stubhook.php', files['gs'], files['lib'], os.path.join(ref_dir, 'generate_stub.php'), fxjson, gen)
    for n, exe, p in (('S-lint-lib82', PHP, files['lib']), ('S-lint-lib56', PHP56, files['lib']), ('S-lint-stub82', PHP, gen),
                      ('S-lint-ix82', PHP, files['ix']), ('S-lint-sr82', PHP, files['sr']), ('S-lint-gs82', PHP, files['gs'])):
        good, info = lint(exe, p) if os.path.exists(p) else (False, 'missing: ' + p)
        out.append((n, good, '' if good else info))
    if os.path.exists(files['lib']):
        out.append(('S-noclose', '?>' not in read_b(files['lib']), 'penumbra_layout.php holds a closing PHP tag (the stub embeds it whole)'))
    return out

def is_new(name):
    if name in ('P-S0-page', 'P56-S0-page'): return False   # the page's side ran: true either way
    if name.startswith(('P-', 'P56-', 'S-lint-lib', 'S-noclose')) or name in ('H-stub-embed', 'H-S1-json', 'H-S1-sched'): return True
    m = re.match(r'H-(?:json|sched|stub)-(.+)$', name)
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
    if 'lib' not in texts:   # the readers require the twin from their own folder in production; the suite points them at it
        files['lib'] = cand['lib']
    return files

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
        print('MUTANT %-12s %s   targets red: %s   (all newly red: %d: %s)' % (name, 'BITES' if ok_ else 'DOES NOT BITE', ', '.join(hit) or '-', len(red), ', '.join(sorted(red)[:12])))
    print('TOTAL mutants=%d bite=%d' % (len(names), bites))
    print('RESULT: GREEN' if bites == len(names) and not base_bad else 'RESULT: RED')
else:
    res = run_php(cand)
    bad = report(res, 'CONTROL (live)' if control else 'CANDIDATE')
    if control:
        # the fuzz cases are left out here: by place, some of them are right by luck
        def fuzz(n):
            m = re.match(r'H-(?:json|sched|stub)-(.+)$', n)
            return bool(m and KIND.get(m.group(1)) == 'FUZZ')
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
