# =============================================================================
# FIND SUITE (2026-10-19) - Find in results on the FLAT table (find round 1)
#
# Ctrl+F finds text in the flat table WITHOUT filtering it, on every page (lazy
# rows, other pages), with a count, next / previous, a "N more in rows your
# search hides" line and "Filter to N rows". js/penumbra_find.js +
# css/penumbra_find.css; main.js gets window.Penumbra.findHost + one hook at the
# end of applyPagination + a cheat-sheet row; cell selection gets activate(td).
# Each scenario loads the STAGED main.js (hooked), cell selection, the format
# engine and the module (harness.html, the hiddencols fixture) and publishes
# named checks:
#   L-<scn>-<check>  must hold on the candidate (checks named sane* are harness
#                    sanity and must hold in --control too; CONTROL_OK lists the
#                    checks that assert an ABSENCE and so hold without the module)
#   E-<scn>          no page errors
#   I-*              (full runs only, no browser) the include block lifted from the
#                    staged index.php and run by PHP with / without the files and the
#                    .off switch; the help section; php -l; the main.js / cellsel patches
#
#   py -3 run.py                    candidate = the kit's stage\ (main.js, module, css, cellsel, index.php, help)
#   py -3 run.py --stage DIR        another stage in the app layout
#   py -3 run.py --control          LIVE main.js + LIVE cell selection and NO module: every
#                                   non-sane, non-absence L check goes RED
#   py -3 run.py --mutant NAME / --mutants
#   --scn a,b                       a subset of scenarios;  --dump  print each result
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_colwidths.js', 'penumbra_colfmt.js', 'penumbra_grouplist.js']
CSS_LIBS = ['main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_cellsel.css', 'penumbra_grouplist.css']

from suite_def import SCN, PROBES, CHK, CONTROL_OK, MUTANTS

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', os.path.join(HERE, 'stage'))
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
verbose = flag('--verbose')
dump = flag('--dump')
shot = opt('--shot', None)   # a PNG of each page once its scenario is done (use with --scn shot,shotdark)

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
cand = {'main': os.path.join(stage_dir, 'js', 'main.js'),
        'mod': os.path.join(stage_dir, 'js', 'penumbra_find.js'),
        'css': os.path.join(stage_dir, 'css', 'penumbra_find.css'),
        'cellsel': os.path.join(stage_dir, 'js', 'penumbra_cellsel.js')}
if control:
    cand['main'] = os.path.join(APP, 'js', 'main.js')
    cand['cellsel'] = os.path.join(APP, 'js', 'penumbra_cellsel.js')

HOOK_NAMES = ['runTableSearch', 'parseAdvancedQuery', 'evaluateParsedQuery', 'getExportData', 'applyPagination', '_pnbKeysSheetHtml', 'executeChainStep',
              # round 5: a real breakdown dialog, a plain infobox, a real snapshot-vs-snapshot comparison
              '_showChartDrillBreakdown', 'showInfoboxDialog', 'runComparisonTwoSnapshots']
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in HOOK_NAMES) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n')
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

stage = tempfile.mkdtemp(prefix='pnb_find_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS_LIBS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
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

def run_page(scn, extra):
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
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        # a background headless page moves document.activeElement on focus() but
        # fires no focus / focusin events (cell selection's Tab stops need them)
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        # round 5: a scenario's own window size (&vw=420&vh=800 in its SCN extra)
        mw = re.search(r'[?&]vw=(\d+)', extra or '')
        if mw:
            mh = re.search(r'[?&]vh=(\d+)', extra or '')
            call('Emulation.setDeviceMetricsOverride', {'width': int(mw.group(1)), 'height': int(mh.group(1)) if mh else 800, 'deviceScaleFactor': 1, 'mobile': False})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if shot:
                    import base64
                    png = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if png:
                        p = shot.replace('.png', '_%s.png' % scn)
                        open(p, 'wb').write(base64.b64decode(png)); print('shot: ' + p)
                return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(texts, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_find.js'), 'wb').write(texts['mod'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_find.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_cellsel.js'), 'wb').write(texts['cellsel'].encode('utf-8', 'surrogateescape'))
    out = {}
    for s, x in SCN:
        if s not in scns: continue
        r = run_page(s, x)
        if r.get('fatal') and 'never finished loading' in r['fatal']:
            r = run_page(s, x); r['retried'] = True
        out[s] = r
    return out

def evaluate(res, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r = res.get(s, {})
        if r.get('fatal'):
            add('F-' + s, False, (r.get('fatal') or '')[:400]); continue
        add('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing'),
            'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), r.get('missing')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:330]) if v is not True else ''))
    return out

# --- the index.php + help + patch half (no browser) ------------------------------
def index_half():
    out = []
    add = lambda aid, ok, d='': out.append((aid, bool(ok), d))
    idx_p = os.path.join(stage_dir, 'index.php')
    help_p = os.path.join(stage_dir, 'help', 'topics', 'searchHelpLightbox.php')
    idx = read_b(idx_p)
    m = re.search(r'(?s)<\?php /\* AFTER main\.js: Find in results.*?<\?php endif; \?>', idx)
    add('I-block', m is not None, idx_p)
    if m:
        tmp = tempfile.mkdtemp(prefix='pnb_findi_')
        os.makedirs(os.path.join(tmp, 'js')); os.makedirs(os.path.join(tmp, 'css'))
        open(os.path.join(tmp, 't.php'), 'w', encoding='utf-8', newline='').write(m.group(0))
        jsf, cssf, offf = os.path.join(tmp, 'js', 'penumbra_find.js'), os.path.join(tmp, 'css', 'penumbra_find.css'), os.path.join(tmp, 'js', 'penumbra_find.off')
        open(jsf, 'w').write('/* x */'); open(cssf, 'w').write('/* x */')
        runphp = lambda: subprocess.run([PHP, '-n', os.path.join(tmp, 't.php')], cwd=tmp, capture_output=True, text=True).stdout
        on = runphp()
        open(offf, 'w').write(''); off = runphp(); os.remove(offf)
        os.remove(cssf); half = runphp()
        shutil.rmtree(tmp, ignore_errors=True)
        add('I-on', '<link rel="stylesheet" href="css/penumbra_find.css?v=' in on and re.search(r'<script defer src="js/penumbra_find\.js\?v=\d{9,}"></script>', on), on.strip().replace('\n', ' | '))
        add('I-off', off.strip() == '', 'output=[%s]' % off.strip())
        add('I-missing', half.strip() == '' and 'Warning' not in half, 'output=[%s]' % half.strip())
        # after main.js and after cell selection (Esc hands the match to it)
        p_find = idx.find('js/penumbra_find.js')
        add('I-order', p_find > idx.find('js/main.js?v=') > 0 and p_find > idx.find('js/penumbra_cellsel.js') > 0, '')
    hp = read_b(help_p)
    add('I-help', 'id="search-find"' in hp and 'data-jump-to="search-find"' in hp and '<kbd>Ctrl</kbd>+<kbd>F</kbd>' in hp
        and hp.find('id="search-find"') < hp.find('id="search-syntax"'), help_p)
    add('I-help-nodash', '\u2014' not in hp, 'an em-dash in the help')
    # round 2: the help says the grouped view and the pivot are covered (the round-1 line gone)
    add('I-help-round2', 'It works in the grouped view and in a pivot too' in hp and 'For now Find covers the flat table' not in hp, help_p)
    # round 5: a dialog that shows a table is Find's now (the old "In a dialog ... browser's own find" line gone)
    add('I-help-round5', 'such as a breakdown' in hp and '<kbd>Ctrl</kbd>+<kbd>F</kbd> finds in that table' in hp
        and "In a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find." not in hp, help_p)
    for f in (idx_p, help_p):
        r = subprocess.run([PHP, '-n', '-l', f], capture_output=True, text=True).stdout
        add('I-lint-' + os.path.basename(f), 'No syntax errors' in r, r.strip())
    mj = read_b(os.path.join(stage_dir, 'js', 'main.js'))
    add('I-main-host', mj.count('window.Penumbra.findHost = {') == 1, '')
    add('I-main-hook', mj.count('window.Penumbra.find.paged();') == 1, '')
    add('I-main-sheet', mj.count("row(['Ctrl+F'], ") == 1, '')
    add('I-main-crlf', '\n' not in mj.replace('\r\n', ''), 'a lone LF in the staged main.js')
    cs = read_b(os.path.join(stage_dir, 'js', 'penumbra_cellsel.js'))
    add('I-cellsel-activate', cs.count('activate: function (td) {') == 1, '')
    mod = read_b(os.path.join(stage_dir, 'js', 'penumbra_find.js'))
    add('I-mod-ascii', all(ord(ch) < 128 for ch in mod), 'a non-ASCII character in the module')
    add('I-mod-nodash', '\u2014' not in mod and '\u2014' not in read_b(os.path.join(stage_dir, 'css', 'penumbra_find.css')), '')
    return out

try:
    names = [s for s, _ in SCN if s not in PROBES]
    if scn_arg: names = [s for s, _ in SCN if s in scn_arg.split(',')]
    texts = {k: read_b(v) for k, v in cand.items()}
    if control:
        texts['mod'] = '/* --control: no module */\n'; texts['css'] = '/* --control: no module */\n'
        print('CONTROL: live %s + live cell selection and NO module' % cand['main'])
    else:
        print('candidate: %s' % stage_dir)
    if dump:
        res = run_build(texts, names)
        for k in names: print('=== %s' % k); print(json.dumps(res[k], indent=1)[:30000])
    elif all_mutants or one_mutant:
        ok = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            res = evaluate(run_build(mutate(texts, m), scns), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-34s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    elif control:
        res = evaluate(run_build(texts, names), names)
        wrong = []
        for a, passed, d in res:
            expect = ('-sane' in a) or a.startswith('E-') or a in CONTROL_OK
            if passed != expect: wrong.append(a)
            print('  %s  %-36s %s  %s' % ('ok ' if passed == expect else 'BAD', a, 'pass' if passed else 'fail', d[:200] if passed != expect else ''))
        print('CONTROL wrong=%d   %s' % (len(wrong), ' '.join(wrong)))
        print('RESULT: GREEN' if not wrong else 'RESULT: RED')
    else:
        res = evaluate(run_build(texts, names), names)
        if not scn_arg: res = index_half() + res
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-36s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
