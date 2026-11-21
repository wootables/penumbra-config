# =============================================================================
# DIFF PARITY SUITE (2026-11-17)
#
# Two engines decide what changed between a report and a snapshot: the browser's comparison
# (runComparisonAndDisplayGrouped in js\main.js) and the scheduler's change analysis
# (penumbra_compute_snapshot_diff in schedule_runner.php). The second was written to mirror the first, and
# each has been fixed on its own since. This suite gives BOTH the same fixtures (cases.json) and requires the
# same answer: the same rows New / Removed / Modified / Unchanged, and the same changed cells on a Modified row.
#
#   scheduler half  php_side.php - the runner's function on the tokenizer-lifted mirror (no database, no e-mail)
#   browser half    the REAL js\main.js in headless Edge, on the cmpfoot suite's page (..\cmpfoot\harness.html,
#                   the fixture block swapped for the case), driven by driver.js: a real compare-to-live, read
#                   back from the rendered comparison. One page load per case.
#   Also checked on the browser half: every comparison row names the report row it shows
#   (data-pnb-src-index, 2026-11-17 cmpid; -1 on a Removed row).
#
#   py -3 run.py                   live js\main.js + live schedule_runner.php    EXPECTED: every case PARITY
#   py -3 run.py --main F          another main.js (a candidate build)
#   py -3 run.py --app DIR         another app folder for the scheduler half (and the page's libs)
#   py -3 run.py --cases a,b       a subset, by name
#   py -3 run.py --control         the browser half never marks a cell as changed (one edit of main.js): MUST be
#                                  RED on every case that has a Modified row, and only on those
#   --keep                         keeps the staging dir
#
# cases.json: keys = what the scheduler is given; browserKeys (optional) = what the browser is given instead;
# expect "browser-stops" = the one intended difference (a key the snapshot lacks: the browser stops and names
# it so a person can pick again, the scheduler carries on with the remaining keys).
#
# A case that is RED is a real difference between what a reader sees in the Snapshot Manager and what a
# scheduled e-mail of the same report says. Fix the engine that is wrong; never the fixture.
# Needs Python 3 + websocket-client and Edge. Writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_penumbra\php.exe'
CMPFOOT = os.path.join(os.path.dirname(HERE), 'cmpfoot')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
CONTROL_OLD = "                            if (_pnbDiffNormalizeCell(cv) !== _pnbDiffNormalizeCell(sv)) {\r\n                                changed.push(u);\r\n"
CONTROL_NEW = "                            if (false && _pnbDiffNormalizeCell(cv) !== _pnbDiffNormalizeCell(sv)) {\r\n                                changed.push(u);\r\n"

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
main_path = opt('--main', None)
app_dir = opt('--app', APP)
only = opt('--cases', None)
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if not main_path: main_path = os.path.join(app_dir, 'js', 'main.js')

cases = json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf-8'))
if only:
    want = only.split(',')
    cases_run = [c for c in cases if c['name'] in want]
    if len(cases_run) != len(want): raise SystemExit('unknown case in --cases')
else:
    cases_run = cases

# --- scheduler half --------------------------------------------------------------------------------
p = subprocess.run([PHP, '-n', os.path.join(HERE, 'php_side.php'), '--app=' + app_dir], capture_output=True, text=True, cwd=tempfile.gettempdir())
if p.returncode != 0: raise SystemExit('php_side.php failed: ' + (p.stderr or p.stdout)[:600])
server = json.loads(p.stdout.strip().splitlines()[-1])

# --- browser half ----------------------------------------------------------------------------------
def read_b(pth): return open(pth, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """cmpfoot's hook: the ready closure becomes an IIFE with a name-by-name export hook, and hideLoading counts its calls."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { runCmp: "runComparisonAndDisplayGrouped", compress: "compressString" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

src = read_b(main_path)
if control:
    if src.count(CONTROL_OLD) < 1: raise SystemExit('--control: the changed-cell test was not found in main.js')
    src = src.replace(CONTROL_OLD, CONTROL_NEW, 1)   # the first one is the compare-to-live engine's

stage = tempfile.mkdtemp(prefix='pnb_dp_')
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
idx = read_b(os.path.join(app_dir, 'index.php'))
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(CMPFOOT, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
page = page.replace('<!--SNAP_TEMPLATE-->', m.group(0))
# The page's fixture block (window.__COLS ... window.__QUERY) becomes the case named by ?c=<index>
fx = re.search(r"  window\.__COLS = \[.*?\n  window\.__QUERY = [^\n]*\n", page, re.S)
if not fx: raise SystemExit('harness.html: fixture block not found')
block = ("  window.__CASES = " + json.dumps(cases_run).replace('</', '<\\/') + ";\n"
         "  window.__CASE = window.__CASES[parseInt((/[?&]c=(\\d+)/.exec(location.search) || [])[1] || '0', 10)];\n"
         "  window.__COLS = window.__CASE.cols; window.__LIVE = window.__CASE.live; window.__SNAP = window.__CASE.snap; window.__KEYS = ('browserKeys' in window.__CASE) ? window.__CASE.browserKeys : window.__CASE.keys;\n"
         "  window.__QUERY = 'SELECT ' + window.__COLS.join(', ') + ' FROM DIFFPARITY_FIXTURE';\n")
page = page[:fx.start()] + block + page[fx.end():]
open(os.path.join(stage, 'harness.html'), 'wb').write(page.encode('utf-8', 'surrogateescape'))
open(os.path.join(stage, 'main_cf.js'), 'wb').write(hook(src).encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); pt = s.getsockname()[1]; s.close(); return pt
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(pth, meth='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, pth), method=meth), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
for _ in range(100):
    try: urllib.request.urlopen('http://127.0.0.1:%d/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(i):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid: return msg.get('result', {})
    try:
        call('Page.enable')
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?mode=live&c=%d&t=%d' % (hp, i, int(time.time() * 1000))})
        t0 = time.time()
        while time.time() - t0 < 120:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__CFDONE ? JSON.stringify(window.__CFRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the page (120 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

ok_n = bad_n = 0
red = []
try:
    print('main.js: %s%s' % (main_path, '   (CONTROL: no cell is ever marked changed)' if control else ''))
    print('runner : %s' % os.path.join(app_dir, 'schedule_runner.php'))
    for i, c in enumerate(cases_run):
        res = run_page(i)
        if 'timeout' in str(res.get('fatal', '')): res = run_page(i)   # a page that never booted: once more
        s = server.get(c['name'], 'MISSING')
        problems = []
        if res.get('fatal'): problems.append('browser: ' + str(res['fatal'])[:300])
        if res.get('hookErr'): problems.append('hook: ' + res['hookErr'])
        b = res.get('groups')
        if not res.get('fatal'):
            if c.get('expect') == 'browser-stops':
                # an intended difference, pinned: the browser refuses (it names the key in a notice, so a person
                # can pick again); the scheduler, with nobody to ask, answers on the remaining keys
                if b is not None: problems.append('the browser was expected to stop on the missing key, and compared')
                if s is None: problems.append('the scheduler was expected to carry on with the remaining keys, and did not')
            elif b is None or s is None:
                if not (b is None and s is None):
                    problems.append('comparable? browser=%s scheduler=%s%s' % (b is not None, s is not None, (' (browser said: ' + res.get('notice', '') + ')') if b is None else ''))
            else:
                for g in ('new', 'removed', 'modified', 'unchanged'):
                    if b.get(g) != s.get(g):
                        problems.append('%s: browser %s | scheduler %s' % (g, json.dumps(b.get(g)), json.dumps(s.get(g))))
            for line in (res.get('identity') or []): problems.append('row identity: ' + line)
        if res.get('pageErrors'): problems.append('page errors: ' + ' | '.join(res['pageErrors'])[:300])
        good = not problems
        ok_n += good; bad_n += (not good)
        if not good: red.append(c['name'])
        print('  %s  %-26s %s' % ('PARITY' if good else 'DIFFER', c['name'], c.get('what', '')), flush=True)
        for pr in problems: print('          ' + pr[:500], flush=True)
    print('TOTAL parity=%d differ=%d   differ: %s' % (ok_n, bad_n, ' '.join(red)))
    if control:
        # (a "browser-stops" case never reaches the changed-cell test, so the control leaves it green)
        want_red = sorted(c['name'] for c in cases_run if c.get('expect') != 'browser-stops' and server.get(c['name']) and server[c['name']]['modified'])
        exact = sorted(red) == want_red
        print('CONTROL: %s (red: %s | expected: %s)' % ('as expected' if exact else 'UNEXPECTED', ' '.join(sorted(red)), ' '.join(want_red)))
        print('RESULT: GREEN' if exact else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if bad_n == 0 and ok_n > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
