# =============================================================================
# REPOSITORY OPENING ORDER SUITE "repoorder" (2026-10-02)
#
# User request 2026-10-02: the repository (Ctrl+O lightbox / repository.php) opens
# on 15 of MY most recent opens + 15 of anyone else's most recent opens (the rest
# of those slots going to never-opened reports, NULLS LAST, as before), SHOWN IN
# THAT ORDER. Before: 10 + 10, then re-sorted by Last Updated in the browser,
# which interleaved the two groups.
#
#   SERVER HALF  server_test.php lifts get_server_reports.php's mode=initial block
#                verbatim and runs it on a fake PDO (S-* asserts).
#   BROWSER HALF harness.html + driver.js run the REAL penumbra_repository.js in
#                headless Edge against a mocked get_server_reports.php (P-/J-/E-*).
#
#   py -3 run.py                     candidate = live get_server_reports.php + js\penumbra_repository.js
#   py -3 run.py --app DIR           candidate = DIR\get_server_reports.php + DIR\js\penumbra_repository.js
#   py -3 run.py --control           the PRE-CHANGE pair (default: newest *.bak-*-repoorder in the
#                                    live webroot, or --baseline DIR): EXACTLY CONTROL_RED must fail
#   py -3 run.py --mutants / --mutant NAME   single-point edits of the candidate (mutants.json);
#                                    each must turn exactly its own asserts red
#   --libs DIR  where jquery / jquery-ui / moment come from (default: the live webroot)
#   --keep      keep the staging dir      --dump  print the mocked ajax calls
#
# Stages into %TEMP%; writes nothing to the webroot. Needs Python 3 + websocket-client.
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js']
EXPECT_S = ['S-lift', 'S-sqlA-15', 'S-sqlB-15', 'S-mine15', 'S-oth15', 'S-order', 'S-excl', 'S-nulls', 'S-fewmine', 'S-nomine']
EXPECT_J = ['P-loaded', 'P-fixture', 'J-initial', 'P-title-asc', 'J-reset', 'P-rebuild', 'J-rebuild', 'J-loadmore',
            'J-loadmore-reset', 'J-search', 'J-restore', 'E-errors']
# What the pre-change pair gets wrong (frozen from the first control run against the
# live files of 2026-10-02 16:30, php c8dcceba / js 4dd461d7). Green there on purpose:
# the exclusion + NULLS LAST (unchanged), the title sort itself, the column rebuild,
# and the search path (still newest-updated first) - proving fixture and read-out.
CONTROL_RED = ['S-sqlA-15', 'S-sqlB-15', 'S-mine15', 'S-oth15', 'S-order', 'S-fewmine', 'S-nomine',
               'J-initial', 'J-reset', 'J-rebuild', 'J-loadmore', 'J-loadmore-reset', 'J-restore']

MUTANTS = json.load(open(os.path.join(HERE, 'mutants.json'), encoding='utf-8'))

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
base_dir = opt('--baseline', None)
libs_dir = opt('--libs', APP)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
dump = flag('--dump')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

php_path = os.path.join(app_dir, 'get_server_reports.php')
js_path = os.path.join(app_dir, 'js', 'penumbra_repository.js')
if control:
    if base_dir:
        php_path = os.path.join(base_dir, 'get_server_reports.php')
        js_path = os.path.join(base_dir, 'js', 'penumbra_repository.js')
    else:
        pb = bak_glob(os.path.join(APP, 'get_server_reports.php.bak-*-repoorder'))
        jb = bak_glob(os.path.join(APP, 'js', 'penumbra_repository.js.bak-*-repoorder'))
        if not pb or not jb: raise SystemExit('no baseline: pass --baseline <dir holding the pre-change pair> (the deploy leaves *.bak-<stamp>-repoorder)')
        php_path, js_path = pb[-1], jb[-1]

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def mutate(src, name):
    for old, new in MUTANTS[name]['edits']:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the NEW build): %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_repoorder_')
for f in LIBS: shutil.copyfile(os.path.join(libs_dir, 'js', f), os.path.join(stage, f))
for f in ('driver.js', 'harness.html'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))

# ---- server half -------------------------------------------------------------
def run_server(php_text):
    p = os.path.join(stage, 'gsr_cand.php')
    open(p, 'wb').write(php_text.encode('utf-8', 'surrogateescape'))
    r = subprocess.run([PHP, '-n', '-d', 'date.timezone=America/New_York', os.path.join(HERE, 'server_test.php'), p],
                       capture_output=True, timeout=120)
    try:
        return json.loads(r.stdout.decode('utf-8', 'replace'))['asserts']
    except Exception:
        return [{'id': 'S-lift', 'ok': False, 'detail': 'server_test.php said: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:400]}]

# ---- browser half ------------------------------------------------------------
_edge = {}
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (_edge['dp'], p), method=m), timeout=15).read().decode())
def start_browser():
    if _edge: return
    hp, dp = free_port(), free_port()
    _edge.update(hp=hp, dp=dp)
    _edge['srv'] = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _edge['proc'] = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                                      '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'),
                                      '--window-size=1500,900', '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(150):
        try: jget('/json/version'); return
        except Exception: time.sleep(0.2)

POLL = '(function () { return JSON.stringify({ done: !!window.__RODONE, res: window.__RODONE ? window.__RORESULT : null }); })()'

def run_browser(js_text):
    start_browser()
    open(os.path.join(stage, 'repo_cand.js'), 'wb').write(js_text.encode('utf-8', 'surrogateescape'))
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same repo_cand.js
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html' % _edge['hp']})
        t0 = time.time()
        while time.time() - t0 < 90:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': POLL, 'returnByValue': True}).get('result', {}).get('value')
            if not v: continue
            st = json.loads(v)
            if st['done']:
                if dump: print('  ajax: ' + ' | '.join(st['res'].get('calls') or []))
                return st['res']['asserts']
        return [{'id': 'E-errors', 'ok': False, 'detail': 'timeout (90 s)'}]
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (_edge['dp'], t['id']), timeout=10).read()
        except Exception: pass

def evaluate(got, expect):
    by = {}
    for a in got: by.setdefault(a['id'], a)
    out = []
    for aid in expect:
        a = by.get(aid)
        out.append((aid, bool(a and a['ok']), a['detail'] if a else 'NOT RECORDED'))
    for aid, a in by.items():
        if aid not in expect: out.append((aid, False, 'UNEXPECTED ID ' + a['detail']))
    return out

try:
    php_text, js_text = read_b(php_path), read_b(js_path)
    print('candidate: %s\n           %s%s' % (php_path, js_path, '   (CONTROL: the pre-change pair)' if control else ''))
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            spec = MUTANTS[m]
            if spec['file'] == 'php': res = evaluate(run_server(mutate(php_text, m)), EXPECT_S)
            else: res = evaluate(run_browser(mutate(js_text, m)), EXPECT_J)
            red = [a for a, p, _ in res if not p]
            if spec['must'] is None:
                print('  EXPLORE mutant %-14s red: %s' % (m, ' '.join(red) or '(nothing)'))
                bad += 1; continue
            good = sorted(red) == sorted(spec['must'])
            ok += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(spec['must']), ' '.join(red)))
            if not good:
                for a, p, d in res:
                    if not p: print('        %-18s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_server(php_text), EXPECT_S) + evaluate(run_browser(js_text), EXPECT_J)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-18s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            if CONTROL_RED is None:
                print('CONTROL: not frozen yet - red set: %s' % ' '.join(failed))
                print('RESULT: RED')
            else:
                good = sorted(failed) == sorted(CONTROL_RED)
                print('CONTROL: %s (expected red: %s)' % ('as expected' if good else 'NOT as expected', ' '.join(CONTROL_RED)))
                print('RESULT: GREEN' if good else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    for k in ('proc', 'srv'):
        try: _edge[k].kill()
        except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
