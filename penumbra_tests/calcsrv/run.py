# =============================================================================
# CALCSRV SUITE (2026-10-11) - calculated columns SAVED WITH THE REPORT: the server's
# twin engine penumbra_calc.php, its hooks, and the browser's save / load of them.
#   parity half  parity.html + parity.js: js/penumbra_calc.js ALONE works ~70 formulas
#                x 4 formats + structural cases over ~430 edge-case rows; parity.php
#                runs penumbra_calc.php over the same rows + definitions and compares
#                every row's column order and every appended cell, byte for byte  P-*
#   hook half    hooks.php: the candidate's OWN hook code lifted out of
#                schedule_runner.php (rows, stream, default totals) and index.php
#                (?json=1) and run - never the runner itself (Oracle + SENDS MAIL)  H-*
#   page half    harness.html (mk_harness.py, from saveconf's) + driver.js: the REAL
#                main.js + the module: a saved report's columns (source 'report',
#                first), the Save dialog's Last Stop list, the strip + renumbering  L-*
#   source       main.js calls the list as the Save dialog opens                   S-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn NAME]
# Headless Edge over CDP; stages into %TEMP%\pnb_cs_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, urllib.parse
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
MBSTRING = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext/php_mbstring.dll'   # (forward slashes: -d's ini parse eats a leading \\)
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
def q(*vals): return '&' + '&'.join('calc=' + urllib.parse.quote(v, safe='') for v in vals)
SCN = ['rload', 'rsave', 'rnolist', 'radj']
SCN_Q = {'rload': q('MINE|{H_NUM} + 1'), 'rsave': q('A|{H_NUM} + 1', 'B|{H_NUM} * 2', 'C|{B} + 1'), 'rnolist': q('MINE|{H_NUM} + 1'),
         'radj': q('D|{H_NUM} * {@R}|@R=3,1,9')}
CHK = {
    # (2026-10-18, calcadj) a link's column with an adjustable value: shown at it; moved, the query
    # re-runs; the save carries the moved value as the report's default, and the override is spent
    'radj': ['shown', 'moved', 'kept', 'spent'],
    'rload': ['shown', 'first', 'source', 'tag', 'notCalc', 'summable'],
    'rsave': ['before', 'listed', 'hint', 'hintFollows', 'kept', 'positions', 'depSaid', 'nowReport', 'untickedKept'],
    'rnolist': ['reportKept', 'mineGone'],
}
# (2026-10-22) the checks this round adds: red on live (its names forced to upper case)
NEW = {'P-labelKeys', 'P-labelClean', 'H-sched-label'}
MUTANTS = {
    # --- (2026-10-22) the twin's label: never kept; the row keyed by the name; the scheduler's totals check on the name
    'p-label': ([('lib', "    if ($lb !== $name) $out['label'] = $lb;\n", "")], ['P-labelClean', 'P-labels', 'H-sched-label'], []),
    'p-rowkey': ([('lib', "$key[$kd['name']] = isset($kd['label']) ? $kd['label'] : $kd['name'];", "$key[$kd['name']] = $kd['name'];")], ['P-labels', 'H-sched-label'], []),
    'p-sumkey': ([('sr', "array_key_exists(isset($calcDef['label']) ? $calcDef['label'] : $calcDef['name'], $calcFirst)", "array_key_exists($calcDef['name'], $calcFirst)")], ['H-sched-label'], []),
    # penumbra_calc.php (LF) - the twin
    'p-tie': ([('lib', "    $up = isset($frac[$f]) && $frac[$f] >= '5';", "    $up = isset($frac[$f]) && $frac[$f] > '5';")], ['P-corpus*'], []),
    'p-shortest': ([('lib', "    for ($p = 1; $p <= 17; $p++) {", "    for ($p = 17; $p <= 17; $p++) {")], ['P-corpus*'], []),
    'p-trim': ([('lib', "    return $r === null ? trim($s) : $r;", "    return trim($s);")], ['P-corpus*'], []),
    'p-listorder': ([('lib', "    $use = $order; sort($use);", "    $use = $order;")], ['P-depOrder'], []),
    'p-jslen': ([('lib', "_pnb_calc_js_len($formula) > PNB_CALC_MAX_FORMULA) return null;", "strlen($formula) > PNB_CALC_MAX_FORMULA) return null;")], ['P-names'], []),
    'p-first20': ([('lib', "        if (count($good) >= PNB_CALC_MAX_DEFS) break;\n", "")], ['P-manyDupes'], []),
    # (2026-10-18, calcadj) an adjustable value read as blank; its highest not enforced
    'p-inp': ([('lib', "        case 'inp': return _pnb_calc_to_num($get('@' . $node['n']));\n", "        case 'inp': return null;\n")], ['P-inputs'], []),
    'p-inpclamp': ([('lib', "    if ($mx !== null) { $o['max'] = $mx; if ($o['value'] > $mx) $o['value'] = $mx; }\n", "    if ($mx !== null) { $o['max'] = $mx; }\n")], ['P-inputs', 'P-inputClean'], []),
    # (2026-10-19, round 5) a date value read as a number only (blank)
    'p-datekind': ([('lib', "        case 'inp': $iv = $get('@' . $node['n']); $inn = _pnb_calc_to_num($iv); return $inn !== null ? $inn : _pnb_calc_to_date($iv);\n",
                     "        case 'inp': return _pnb_calc_to_num($get('@' . $node['n']));\n")], ['P-dateInputs'], []),
    # the hooks (schedule_runner.php CRLF, index.php LF)
    'h-sched': ([('sr', "        $apiData['data'] = pnb_calc_apply_rows($apiData['data'], $state['calcColumns'], $calcProblems);\r\n", "")], ['H-sched-rows'], []),
    'h-stream': ([('sr', "            $stream_row_callback = function ($row) use ($calcMap, $calcInner) { return $calcInner($calcMap($row)); };\r\n", "")], ['H-stream-rows'], []),
    'h-total': ([('sr', "    if (!empty($GLOBALS['penumbra_calc_summable']) && isset($GLOBALS['penumbra_calc_summable'][strtoupper((string)$header)])) return 'sum';\r\n", "")], ['H-total-calc'], []),
    'h-reset': ([('sr', "    $GLOBALS['penumbra_calc_summable'] = array();\r\n    if (is_array($state) && !empty($state['calcColumns'])", "    if (is_array($state) && !empty($state['calcColumns'])")], ['H-sched-none'], []),
    'h-json': ([('ix', "            $response['data'] = pnb_calc_apply_rows($response['data'], $state['calcColumns']);\n", "")], ['H-json-rows'], []),
    # js/penumbra_calc.js (LF)
    'j-reportfirst': ([('calc', "put(reportDefs, 'report'); put(savedDefs(), 'saved'); put(stateDefs, 'state'); put(urlDefs, 'url');",
                        "put(savedDefs(), 'saved'); put(stateDefs, 'state'); put(urlDefs, 'url'); put(reportDefs, 'report');")], ['L-rload-first'], ['rload']),
    'j-renumber': ([('calc', "                if (!by) return v;\n", "                return v;\n")], ['L-rsave-positions'], ['rsave']),
    'j-closure': ([('calc', "                c.refs.forEach(function (r) { if (appliedBy[r] && !keep[r]) { keep[r] = true; added.push(r); grew = true; } });\n", "")], ['L-rsave-kept'], ['rsave']),
    'j-nolist': ([('calc', "            last.applied.forEach(function (d) { if (d.src === 'report') keep[d.name] = true; });\n", "")], ['L-rnolist-reportKept'], ['rnolist']),
    'j-iscalc': ([('calc', "            return last.applied.some(function (d) { return d.name === n; }) && !isReport(n);\n",
                   "            return last.applied.some(function (d) { return d.name === n; });\n")], ['L-rload-notCalc'], ['rload']),
    'j-hint': ([('calc', "        if (e.target && e.target.matches && e.target.matches('#pnbCalcSaveRow input[data-calc-save]')) updateSaveHint();\n", "")], ['L-rsave-hintFollows'], ['rsave']),
    'j-keepmine': ([('calc', "            if (!mine.some(function (x) { return x.name === d.name; })) mine.push(plain(d));\n", "")], ['L-rsave-untickedKept'], ['rsave']),
    # main.js (CRLF)
    'm-src': ([('main', "window.PenumbraCalc.fromState(decodedState.calcColumns, penumbra_vars.preloadedState ? 'report' : 'state');", "window.PenumbraCalc.fromState(decodedState.calcColumns);")],
              ['L-rload-source'], ['rload']),
    'm-savedto': ([('main', "            if (window.PenumbraCalc && window.PenumbraCalc.savedToReport) {\r\n", "            if (false) {\r\n")], ['L-rsave-nowReport'], ['rsave']),
    'm-opencall': ([('main', "        if (window.PenumbraCalc && window.PenumbraCalc.renderSaveList) window.PenumbraCalc.renderSaveList();\r\n", "")], ['S-openCall'], []),
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
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
scn_only = opt('--scn', None)
if scn_only: SCN = [scn_only]
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'calc': os.path.join('js', 'penumbra_calc.js'), 'lib': 'penumbra_calc.php',
        'sr': 'schedule_runner.php', 'ix': 'index.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape') if os.path.exists(p) else ''

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; window.__HC.bso = buildStateObject; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cs_')
srvdir = os.path.join(stage, 'srv')
os.mkdir(srvdir)
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('main.css', 'density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
subprocess.run([sys.executable, os.path.join(HERE, 'mk_harness.py')], check=True, stdout=subprocess.DEVNULL)
for f in ('harness.html', 'driver.js', 'parity.html', 'parity.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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

def run_page(path, expr='window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null'):
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_calc.js'), 'wb').write(texts['calc'].encode('utf-8', 'surrogateescape'))
    lib = os.path.join(srvdir, 'penumbra_calc.php')
    if os.path.exists(lib): os.remove(lib)
    if texts['lib']: open(lib, 'wb').write(texts['lib'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(srvdir, 'sr.php'), 'wb').write(texts['sr'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(srvdir, 'ix.php'), 'wb').write(texts['ix'].encode('utf-8', 'surrogateescape'))

def php_lines(script, *a):
    # mbstring as production loads it (php.ini extension=mbstring): text compares lowercase with it
    res = subprocess.run([PHP, '-n', '-d', 'extension=' + MBSTRING, os.path.join(HERE, script)] + list(a), capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = []
    for line in res.stdout.splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
        if m: out.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
    if 'TOTAL' not in res.stdout: out.append(('F-' + script, False, (res.stdout + res.stderr)[-500:]))
    return out

def run_php_side(texts):
    out = []
    r = run_page('parity.html', 'window.__HCDONE ? JSON.stringify(window.__PARITY) : null')
    if r.get('fatal'): out.append(('F-parity', False, r['fatal'][:400]))
    fx = os.path.join(srvdir, 'parity.json')
    open(fx, 'w', encoding='utf-8').write(json.dumps(r))
    lib = os.path.join(srvdir, 'penumbra_calc.php')
    out += php_lines('parity.php', lib, fx)
    out += php_lines('hooks.php', lib, os.path.join(srvdir, 'sr.php'), os.path.join(srvdir, 'ix.php'))
    for k in ('sr', 'ix', 'lib'):
        p = os.path.join(srvdir, {'sr': 'sr.php', 'ix': 'ix.php', 'lib': 'penumbra_calc.php'}[k])
        if os.path.exists(p):
            l = subprocess.run([PHP, '-n', '-l', p], capture_output=True, text=True).stdout
            out.append(('P-lint-' + k, 'No syntax errors' in l, l.strip()[:200]))
    # main.js lists the columns as the Save dialog opens (the #saveQuery handler)
    m = texts['main']
    i = m.find('$("#saveQuery").click(')
    j = m.find('_lscPopulateSortField();', i)
    k = m.find("window.PenumbraCalc.renderSaveList();", j)
    nxt = m.find('$(document).on(', j)
    out.append(('S-openCall', i != -1 and j != -1 and k != -1 and k < nxt, 'saveQuery %d lsc %d call %d next %d' % (i, j, k, nxt)))
    return out

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, SCN_Q.get(s, '')))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:500]) if v is not True else '')))
    return out

def reds_cover(must, red):
    for x in must:
        if x.endswith('*'):
            if not [r for r in red if r.startswith(x[:-1])]: return False
        elif x not in red: return False
    return True

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for mname in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[mname]
            t = mutate(texts, mname)
            write_stage(t)
            res = run_php_side(t) + (run_browser(scns) if scns else [])
            red = [a for a, p, _ in res if not p]
            good = reds_cover(must, red)
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', mname, ' '.join(must), ' '.join(red)[:400]))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_php_side(texts) + run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # (2026-10-22) calculated columns are LIVE: a control judges this round's checks (NEW: red on live)
            # and every other check (green on live)
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
