# =============================================================================
# ADMIN CONSOLE ON A CONSOLE-LESS PAGE SUITE "admesc" (2026-10-02)
#
# Client error 2026-10-02 12:00:50, user bplimon, report jjornl:
#   Uncaught TypeError: Cannot read properties of undefined (reading
#   'getBoundingClientRect') | main.js?v=1790945144:110442:29
# The tab had loaded index.php?id=jjornl&noadm 15 s earlier (IIS log 16:00:35
# UTC). &noadm previews the page as a plain viewer, so index.php rendered no
# #admWrapper; the user pressed Escape in a journal row note, the capture
# handler's section D called toggleSmartAdminView(), which read an EMPTY
# $('#admWrapper') as "hidden", decided to SHOW it, saved that preference, and
# the docked drawer threw on $wrapper[0]. Every page without the console takes
# that path: a viewer, &noadm, a non-admin's home screen (where it also slid
# the landing cards away), a dropped file (importFileData opens the console).
# The fix makes toggleSmartAdminView a no-op when the page has no console.
#
# Each scenario boots the REAL main.js through the real run path (stubbed
# query.php + manage_journal.php) on jrowfeat's 36-row journal fixture.
# driver.js records the asserts:
#   V-*  viewer page (no console): rownote = the incident (a REAL Escape in an
#        open row note), bodyesc, double (double press), drop (a dropped CSV)
#   H-*  the home screen for a non-admin (the landing cards must stay)
#   C-*  WITH the console: Escape opens (drawer finishes clean) and closes it;
#        popout = "Open in Window" (window._admPip) and all three ways home
#   P-*  preconditions        E-*  no page errors outside the asserts
#
#   py -3 run.py                                 candidate = live js\main.js
#   py -3 run.py --candidate F                   any build (the stage before the deploy)
#   py -3 run.py --control                       the PRE-FIX build (default: the newest
#                                                js\main.js.bak-*-admesc, or --baseline F):
#                                                EXACTLY CONTROL_RED must fail
#   py -3 run.py --mutant NAME / --mutants       single-point edits of the candidate; each
#                                                must turn exactly its own asserts red
#   --scn a,b   a subset;   --keep keeps the staging dir;   --app DIR libs source
#
# main.js is served with its LINE NUMBERS INTACT (the only hook - a hideLoading
# counter - is added on that function's own line), so an error's line:col is the
# file's: the control against js\main.js.bak-20261002-1331-jrowfeat (the build
# live at 12:00:50) reproduces the telemetry's 110442:29.
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# Needs Python 3 + websocket-client (py -3 -m pip install websocket-client).
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_SCN = ['rownote', 'bodyesc', 'double', 'drop', 'home', 'editor', 'popout']
PAGE = {'rownote': 'viewer', 'bodyesc': 'viewer', 'double': 'viewer', 'drop': 'viewer',
        'home': 'home', 'editor': 'editor', 'popout': 'editor'}
EXTRA = {'popout': '&pref=true'}   # the console starts OPEN before it pops out
EXPECT = {
    'rownote': ['P-rownote-open', 'V-rownote-err', 'V-rownote-pref', 'V-rownote-push', 'V-rownote-panel', 'V-rownote-body'],
    'bodyesc': ['V-body-err', 'V-body-pref', 'V-body-push'],
    'double': ['V-double-err', 'V-double-pref', 'V-double-push'],
    'drop': ['P-drop-ran', 'V-drop-err', 'V-drop-pref', 'V-drop-push', 'V-drop-caught', 'V-drop-toast'],
    'home': ['P-home-landing', 'H-home-err', 'H-home-pref', 'H-home-push', 'H-home-landing'],
    'editor': ['P-editor-closed', 'C-open', 'C-close', 'C-err'],
    'popout': ['P-pop-out', 'C-pop-esc', 'C-pop-close', 'C-pop-pipesc', 'C-pop-err'],
}
# What the pre-fix build gets wrong. Frozen from the first control run (live
# 73712d78, 2026-10-02): every other assert - the preconditions, the console's own
# open/close and all three ways home from the pop-out - must PASS on the old build
# too, which is what proves the fixture and the read-out are not the bug.
# V-drop-err is green on the old build by design: the import's catch swallows the
# TypeError (V-drop-caught / V-drop-toast see it).
# (2026-10-10) + P-rownote-open: since 2026-10-07 a table row's notes open in the floating card, which the 10-02 pre-fix
# build does not have - the scenario still runs its Escape checks there.
CONTROL_RED = ['P-rownote-open', 'V-rownote-err', 'V-rownote-pref', 'V-rownote-push', 'V-body-err', 'V-body-pref', 'V-body-push',
               'V-double-err', 'V-double-pref', 'V-double-push', 'V-drop-pref', 'V-drop-push', 'V-drop-caught',
               'V-drop-toast', 'H-home-err', 'H-home-pref', 'H-home-push', 'H-home-landing']

MUTANTS = {}
for _k, _v in json.load(open(os.path.join(HERE, 'mutants.json'), encoding='utf-8')).items():
    MUTANTS[_k] = ([tuple(e) for e in _v['edits']], _v['must'], _v['scn'])

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
cand_path = opt('--candidate', os.path.join(APP, 'js', 'main.js'))
base_path = opt('--baseline', None)
app_dir = opt('--app', APP)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
verbose = flag('--verbose')
dump = flag('--dump')          # print each scenario's raw result (errors, obs)
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control:
    if not base_path:
        baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-admesc'))
        if not baks: raise SystemExit('no baseline: pass --baseline <main.js before the fix> (the deploy leaves js\\main.js.bak-<stamp>-admesc)')
        base_path = baks[-1]
    cand_path = base_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """hideLoading counts its calls (the end of a run) - on its OWN line, so every
    line number in the served file is the real file's."""
    hl = '    function hideLoading() {\r\n'
    if src.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % src.count(hl))
    return src.replace(hl, '    function hideLoading() { window.__ADM_HIDES = (window.__ADM_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_adm_')
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(app_dir, 'css', 'main.css'), os.path.join(stage, 'main.css'))
for f in ('driver.js', 'harness.html'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# --disable-popup-blocking: "Open in Window" is a window.open() from a synthetic click.
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--disable-popup-blocking', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

POLL = ('(function () { return JSON.stringify({ done: !!window.__ADMDONE, want: window.__WANTKEY || 0, sent: window.__KEYSENT || 0,'
        ' res: window.__ADMDONE ? window.__ADMRESULT : null }); })()')

def run_page(scn):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def key_escape():
        down = {'type': 'rawKeyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27, 'nativeVirtualKeyCode': 27}
        call('Input.dispatchKeyEvent', down)
        call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27, 'nativeVirtualKeyCode': 27})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same main_adm.js
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.bringToFront')
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?id=jjornl&page=%s&scn=%s%s' % (hp, PAGE[scn], scn, EXTRA.get(scn, ''))})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': POLL, 'returnByValue': True}).get('result', {}).get('value')
            if not v: continue
            st = json.loads(v)
            if st['done']: return st['res']
            if st['want'] > st['sent']:
                key_escape()
                call('Runtime.evaluate', {'expression': 'window.__KEYSENT = %d' % st['want']})
        return {'fatal': 'timeout (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text, scns):
    open(os.path.join(stage, 'main_adm.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    res = {s: run_page(s) for s in scns}
    if dump:
        for s in scns:
            r = res[s] or {}
            print('--- %s: errors %s | rejections %s | obs %s | fatal %s' % (s, json.dumps(r.get('errors')), json.dumps(r.get('rejections')),
                                                                        json.dumps(r.get('obs')), (r.get('fatal') or '')[:400]))
    return res

def evaluate(res, scns):
    out = []
    for s in scns:
        r = res.get(s) or {}
        got = {a['id']: a for a in (r.get('asserts') or [])}
        for aid in EXPECT[s]:
            if aid in got: out.append((aid, got[aid]['ok'], got[aid]['detail']))
            else: out.append((aid, False, 'NOT RECORDED' + (' | fatal: ' + (r.get('fatal') or '')[:300] if r.get('fatal') else '')))
        for aid, a in got.items():
            if aid not in EXPECT[s]: out.append((aid, a['ok'], 'UNEXPECTED ID ' + a['detail']))
        # E-*: a fatal driver error or a rejection fails the scenario outright; page
        # errors are judged by the scenario's own *-err assert (the bug IS one).
        out.append(('E-' + s, not r.get('fatal') and not r.get('rejections'),
                    'fatal %s rejections %s' % ((r.get('fatal') or '')[:300], r.get('rejections'))))
    return out

try:
    cand_text = read_b(cand_path)
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the pre-fix build)' if control else ''))
    names = [s for s in ALL_SCN if not scn_arg or s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            edits, must, mscn = MUTANTS[m]
            sc = [s for s in (mscn or names) if s in names]
            res = evaluate(run_build(mutate(cand_text, m), sc), sc)
            red = [a for a, p, _ in res if not p]
            if must is None:
                print('  EXPLORE mutant %-12s red: %s' % (m, ' '.join(red) or '(nothing)'))
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
                bad += 1
                continue
            good = sorted(red) == sorted(must)
            ok += good; bad += (not good)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must) or '(nothing)', ' '.join(red)))
            if verbose or not good:
                for a, p, d in res:
                    if not p: print('        %-16s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(cand_text, names), names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-16s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            if CONTROL_RED is None:
                print('CONTROL: not frozen yet - red set: %s' % ' '.join(failed))
                print('RESULT: RED')
            else:
                want = [a for a in CONTROL_RED if any(a in EXPECT[s] for s in names)]
                print('CONTROL: %s (expected red: %s)' % ('as expected' if sorted(failed) == sorted(want) else 'NOT as expected', ' '.join(want)))
                print('RESULT: GREEN' if sorted(failed) == sorted(want) else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
