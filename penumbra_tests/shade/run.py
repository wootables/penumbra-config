# =============================================================================
# SHADE SUITE (2026-10-10) - viewer shading (Settings panel chip, &shade=) and
# heatmap(style=bar) in BOTH engines.
#   page half    harness.html (mk_harness.py, from calccol's) + driver.js: the REAL
#                main.js - bars / fills on the cells, the chip and its menu, saving,
#                None, Clear All Custom Preferences             L-<scn>-<check>, E-<scn>
#   parity       the browser's PenumbraHeat css for 10 cases -> test_parity.php runs
#                the PHP twin (lifted from schedule_runner.php) on the same cases and
#                theme: byte-identical; plus the email's parser / allow-list     P-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
# Headless Edge over CDP; stages into %TEMP%\pnb_sh_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['sbar', 'sscale', 'spanel', 'sclear']
SCN_Q = {'sbar': '&shade=V_AMOUNT%7Cbar', 'sscale': '&shade=V_AMOUNT'}
CHK = {
    'sbar': ['bars', 'noFill', 'textUntouched', 'otherColsPlain'],
    'sscale': ['fills', 'graded'],
    'spanel': ['chipOnNumbers', 'noChipOnText', 'menu', 'rowNotSelected', 'barApplied', 'saved', 'chipReads', 'noneClears', 'noneUnsaves'],
    'sclear': ['set', 'cleared'],
}
MUTANTS = {
    # the JS engine (CRLF)
    'j-floor': ([('main', "                if (String(rParts[0]).trim() === '' && bMin > 0) bMin = 0;\r\n", "")], ['P-warm'], []),   # (the 1..3 case: every value above zero)
    'j-twoside': ([('main', "                var bAnchor = mid !== null ? mid : ((bMin < 0 && bMax > 0) ? 0 : null);\r\n",
                    "                var bAnchor = mid !== null ? mid : null;\r\n")], ['P-straddle'], []),
    'j-tint': ([('main', " : [0.6, 0.5, 0.4, 0.3, 0.2], f = null;\r\n", " : [0.7, 0.5, 0.4, 0.3, 0.2], f = null;\r\n")],
               ['P-pos'], []),
    # a dark theme starts near the full hue (2026-10-11, darkbar) - each engine alone
    'j-dark': ([('main', "                    var steps = bDark ? [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2] : [0.6, 0.5, 0.4, 0.3, 0.2], f = null;\r\n",
                 "                    var steps = [0.6, 0.5, 0.4, 0.3, 0.2], f = null;\r\n")], ['L-parityd-strong', 'PD-pos'], []),
    'p-dark': ([('sr', "        foreach ($dark ? array(0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2) : array(0.6, 0.5, 0.4, 0.3, 0.2) as $st) {\r\n",
                 "        foreach (array(0.6, 0.5, 0.4, 0.3, 0.2) as $st) {\r\n")], ['PD-pos', 'PD-money'], []),
    'j-mode': ([('main', "                        if (VALID.style.indexOf(sv) !== -1) rule.mode = sv;\r\n", "")], ['L-parity-parseBar'], []),
    # the viewer layer (CRLF)
    'v-merge': ([('main', "        }).concat(_pnbShadeRules());   // + the viewer's own shading (2026-10-10, shade)\r\n", "        });\r\n")],
                ['L-sbar-bars', 'L-sscale-fills'], ['sbar', 'sscale']),
    'v-clear': ([('main', "        _pnbShadeClearColumn(col);\r\n", "")], ['L-spanel-noneClears'], ['spanel']),
    'v-eligible': ([('main', "            ok = seen > 0 && nums / seen >= 0.8;\r\n", "            ok = true;\r\n")], ['L-spanel-noChipOnText'], ['spanel']),
    # (no v-rowclick mutant: the chip's own handler stops the click, so the row
    # handler's exclusion is a second guard a mutant cannot expose)
    'v-moneybar': ([('main', "                range: neg ? null : (money ? (bar ? '0:p99' : '0:') : null),\r\n", "                range: neg ? null : (money ? '0:' : null),\r\n")],
                   ['L-sbar-bars'], ['sbar']),
    # the PHP twin (CRLF)
    'p-mode': ([('sr', "    if (isset($opts['mode']) && $opts['mode'] === 'bar') return _pnb_heat_bar_css($v, $domain, $opts, $themeName);\r\n", "")],
               ['P-pos', 'P-straddle'], []),
    'p-allow': ([('sr', "array('background-color', 'color', 'background-image', 'background-repeat')", "array('background-color', 'color')")], ['P-R2'], []),
    'p-pc': ([('sr', "    return ($r == floor($r) ? (string)(int)$r : (string)$r) . '%';\r\n", "    return number_format($r, 1) . '%';\r\n")], ['P-pos'], []),
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
RELS = {'main': os.path.join('js', 'main.js'), 'sr': 'schedule_runner.php', 'css': os.path.join('css', 'main.css')}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
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

stage = tempfile.mkdtemp(prefix='pnb_sh_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))

def run_parity(texts, dark=False):
    tag = 'D' if dark else ''
    r = run_page('harness.html?scn=parity' + ('&dark=1' if dark else ''))
    if r.get('fatal'): return [('F-parity' + tag, False, r['fatal'][:400])]
    out = [('E-parity' + tag, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr')))]
    chk = r.get('chk') or {}
    for c in ('ran', 'parseBar', 'strong'):
        out.append(('L-parity%s-%s' % (tag.lower(), c), chk.get(c) is True, '%s  %s' % (chk.get(c), chk.get('barInfo', ''))))
    d = tempfile.mkdtemp(prefix='pnb_shp_')
    try:
        srp = os.path.join(d, 'sr.php'); fxp = os.path.join(d, 'parity.json')
        open(srp, 'wb').write(texts['sr'].encode('utf-8', 'surrogateescape'))
        open(fxp, 'w', encoding='utf-8').write(json.dumps(r.get('info') or {}))
        res = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_parity.php'), srp, fxp], capture_output=True, text=True)
        for line in res.stdout.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: out.append(('P' + tag + '-' + m.group(2).replace('P-', ''), m.group(1) == 'PASS', m.group(3)))
        if 'TOTAL' not in res.stdout: out.append(('P-ran', False, (res.stdout + res.stderr)[-400:]))
        l = subprocess.run([PHP, '-n', '-l', srp], capture_output=True, text=True).stdout
        out.append(('P' + tag + '-lint-sr', 'No syntax errors' in l, l.strip()[:200]))
    finally:
        shutil.rmtree(d, ignore_errors=True)
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
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:400]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_parity(t) + run_parity(t, True) + (run_browser(scns) if scns else [])
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_parity(texts) + run_parity(texts, True) + run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:400]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # hold before the change: the fill case (both engines already agree on fills),
            # the page booting, the lint, the file reads, a text column with no chip
            absent = {'P-fill', 'P-S0', 'P-S1', 'P-lint-sr', 'L-parity-ran', 'L-spanel-noChipOnText', 'L-sbar-otherColsPlain', 'L-sbar-textUntouched', 'L-sbar-noFill'}
            sane = [a for a, passed, _ in res if passed and not a.startswith('E-') and a not in absent]
            print('CONTROL: %d checks red (expected); checks that hold WITHOUT the change: %s' % (f, ' '.join(sane) or 'none'))
            print('RESULT: GREEN' if not sane and f > 0 else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
