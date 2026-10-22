# =============================================================================
# PVFIX SUITE (2026-10-20 d) - the pivot's right-click menu: Highlight... on a value heading,
# every value cell's own index (a % Change heading's Shading / Format), and a two-sided Color
# scale on lopsided values coloured each side by rank (page + the email's twin).
# The REAL main.js, js/penumbra_colmenu.js and js/penumbra_colfmt.js on the pivmenu harness
# (mk_harness.py; pivmenu's files are read, never written) + test_pvfix.php on a mirror of
# schedule_runner.php (pivotparity's extract_mirror.php).
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_pf_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
MIRROR = os.path.join(HERE, '..', 'pivotparity', 'extract_mirror.php')
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['pfmenu', 'pfneg']
CHK = {
    'pfmenu': ['pvAi', 'chgItems', 'spanItems', 'amtItems', 'hlOpens', 'hlStored', 'hlDebounced', 'hlDrawn', 'hlStaysOpen', 'hlReset', 'chgShade',
               'backPlain', 'backBtn', 'chgCellMenu', 'chgCellFilter'],
    'pfneg': ['negBuilt', 'negFar', 'posSpread', 'topFull', 'posOrder', 'engRank', 'engNoFlag'],
}
PHP_CHK = ['V-twin', 'L-two', 'E-cells', 'E-neg', 'E-top', 'E-spread']
# the round's checks: red on live (5d8.. before pvfix) - the rest guard what live already does
NEW_PVFIX = {'L-pfmenu-' + c for c in ['pvAi', 'chgItems', 'spanItems', 'amtItems', 'hlOpens', 'hlStored', 'hlDebounced', 'hlDrawn', 'hlStaysOpen', 'hlReset', 'chgShade']} \
    | {'L-pfneg-' + c for c in ['negFar', 'posSpread', 'posOrder', 'engRank']} \
    | {'P-' + c for c in ['L-two', 'E-neg', 'E-spread']}   # live 56837df
# (pvfix 2, 2026-10-21) Back from the Highlight card; a % change cell's menu
NEW = {'L-pfmenu-backPlain', 'L-pfmenu-backBtn', 'L-pfmenu-chgCellMenu', 'L-pfmenu-chgCellFilter'}
# (P-V-twin: the page against the email value by value - green on live too, where neither reads
# rankSides; it is the twins' guard, for the mutants)
MUTANTS = {
    # every value cell's index: the body's line gone
    'a-noai': ([('main', "                    drillAttr += ' data-pv-ai=\"' + idx + '\"';\n", "")], ['L-pfmenu-pvAi', 'L-pfmenu-chgItems'], ['pfmenu']),
    # the menu reads the drill's index only
    'a-menuai': ([('menu', "                var cai = td.getAttribute('data-pv-ai');\n", "                var cai = null;\n")], ['L-pfmenu-chgItems', 'L-pfmenu-spanItems'], ['pfmenu']),
    # Highlight... never offered
    'h-off': ([('main', "        hlOn: function () { return !!(_pnbColOptOn() && window.PenumbraColFmt && window.PenumbraColFmt.hlColOk); },", "        hlOn: function () { return false; },")],
              ['L-pfmenu-amtItems', 'L-pfmenu-chgItems', 'L-pfmenu-hlOpens'], ['pfmenu']),
    # every value handed over rebuilds the pivot
    'h-nodebounce': ([('main', "        _pnbPvMenuHlTimer = setTimeout(_pnbPvMenuHlRun, 600);", "        _pnbPvMenuHlTimer = setTimeout(_pnbPvMenuHlRun, 0);")], ['L-pfmenu-hlDebounced'], ['pfmenu']),
    # the rules land on the next value
    'h-index': ([('main', "        arr[w.ai] = hl.length ? hl : null;", "        arr[w.ai + 1] = hl.length ? hl : null;")], ['L-pfmenu-hlStored', 'L-pfmenu-hlDrawn'], ['pfmenu']),
    # --- (pvfix 2) Back from the card: none; the waiting change not made first; the editor's pause not handed over
    'b-noback': ([('main', "            back: typeof back === 'function' ? { label: 'Back to the column menu', run: back } : null", "            back: null")],
                 ['L-pfmenu-backPlain', 'L-pfmenu-backBtn'], ['pfmenu']),
    'b-noflush': ([('main', "    function _pnbPvMenuHlFlush() { clearTimeout(_pnbPvMenuHlTimer); return _pnbPvMenuHlRun(); }", "    function _pnbPvMenuHlFlush() { return false; }")],
                  ['L-pfmenu-backBtn'], ['pfmenu']),
    'b-edflush': ([('colfmt', "            edFlush();   // (2026-10-21) a rule still in its pause is handed over before the view goes\n", "")],
                  ['L-pfmenu-backBtn'], ['pfmenu']),
    # --- (pvfix 2) a % change cell: no menu; no column key. (Its breakdown, since brk 2026-10-21, and a formula's
    # none - the old v-drill - are the pvdrv suite's: menuDrv, formulaNone, mutants m-drv / m-all.)
    'v-target': ([('menu', "|| cell.hasAttribute('data-grand-total') || cell.hasAttribute('data-pv-ai')) { return { kind: 'value', el: cell }; }", "|| cell.hasAttribute('data-grand-total')) { return { kind: 'value', el: cell }; }")],
                 ['L-pfmenu-chgCellMenu'], ['pfmenu']),
    'v-ck': ([('main', "                    if (!drillAttr) drillAttr = ` data-pv-ck=", "                    if (false) drillAttr = ` data-pv-ck=")], ['L-pfmenu-chgCellMenu', 'L-pfmenu-chgCellFilter'], ['pfmenu']),
    # Reset takes nothing off
    'h-reset': ([('main', "            onReset: function () { _pnbPvMenuHlSet(ai, []); }", "            onReset: function () { }")], ['L-pfmenu-hlReset'], ['pfmenu']),
    # the two-sided lopsided test never says yes
    'r-nolop': ([('main', "            return pos[(pos.length - 1) >> 1] < 0.2;\n        }", "            return false;\n        }")], ['L-pfneg-negFar', 'L-pfneg-posSpread'], ['pfneg']),
    # rankSides read without its flag: a snippet's heatmap(curve=rank, mid=) changes
    'r-noflag': ([('main', "                } else if (mid !== null && curve === 'rank' && opts.rankSides && sorted && sorted.length) {", "                } else if (mid !== null && curve === 'rank' && sorted && sorted.length) {")], ['L-pfneg-engNoFlag'], ['pfneg']),
    # a side's rank one place low
    'r-offby': ([('main', "                if (v > mid) { var nHi = sorted.length - sHi; return nHi > 0 ? Math.min(1, (pos - sHi + 1) / nHi) : 0; }", "                if (v > mid) { var nHi = sorted.length - sHi; return nHi > 0 ? Math.min(1, (pos - sHi) / nHi) : 0; }")],
                ['L-pfneg-engRank', 'P-V-twin'], ['pfneg']),
    # the email's twin one place low
    's-offby': ([('sr', "    if ($v > $mid) { $nHi = $n - $sHi; return $nHi > 0 ? min(1, ($pos - $sHi + 1) / $nHi) : 0; }", "    if ($v > $mid) { $nHi = $n - $sHi; return $nHi > 0 ? min(1, ($pos - $sHi) / $nHi) : 0; }")], ['P-V-twin'], []),
    # the email never ranks a two-sided scale
    's-nolop': ([('sr', "    return $pos[intdiv(count($pos) - 1, 2)] < 0.2;\n}\n\n/** A Grand Total row value", "    return false;\n}\n\n/** A Grand Total row value")], ['P-L-two', 'P-E-neg', 'P-E-spread'], []),
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
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'), 'mcss': os.path.join('css', 'penumbra_colmenu.css'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'colfmt': os.path.join('js', 'penumbra_colfmt.js'),
        'css': os.path.join('css', 'main.css'), 'index': 'index.php', 'sr': 'schedule_runner.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == 1: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found once: %r" % (name, f, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

stage = tempfile.mkdtemp(prefix='pnb_pf_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
sys.path.insert(0, HERE)
import mk_harness
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
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('main.css', texts['css'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colfmt.js', texts['colfmt'])

VEC = {}
def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        if (r.get('info') or {}).get('vec'): VEC['v'] = r['info']['vec']
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s   notes %s' % (json.dumps(r.get('info'))[:600], r.get('notes'))) if v is not True else '')))
    return out

def run_php(texts):
    d = tempfile.mkdtemp(prefix='pnb_pfp_')
    try:
        srp = os.path.join(d, 'sr.php'); mir = os.path.join(d, 'mirror.php'); vec = os.path.join(d, 'vec.json')
        open(srp, 'wb').write(texts['sr'].encode('utf-8', 'surrogateescape'))
        open(vec, 'w', encoding='utf-8').write(json.dumps(VEC.get('v') or []))
        out = []
        l = subprocess.run([PHP, '-n', '-l', srp], capture_output=True, text=True).stdout
        out.append(('P-lint-sr', 'No syntax errors' in l, l.strip()[:200]))
        subprocess.run([PHP, '-n', MIRROR, srp, mir], capture_output=True, text=True)
        res = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_pvfix.php'), mir, os.path.join(APP, 'themes_config.php'), vec], capture_output=True, text=True)
        seen = set()
        for line in res.stdout.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: out.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3))); seen.add(m.group(2))
        for c in PHP_CHK:
            if c not in seen: out.append(('P-' + c, False, 'never ran: ' + (res.stdout + res.stderr)[-300:]))
        return out
    finally:
        shutil.rmtree(d, ignore_errors=True)

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            mt = mutate(texts, m)
            write_stage(mt)
            VEC.clear()
            res = run_browser(scns + ([] if 'pfneg' in scns else ['pfneg']))   # pfneg's vectors feed the email half
            res += run_php(mt)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        res += run_php(texts)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:700]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW and not a.startswith('F-')]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(green_new) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(red_old) or 'none'))
            print('RESULT: GREEN' if not green_new and not red_old else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
