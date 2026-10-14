# =============================================================================
# TABLE FIT SUITE (2026-10-03) - the table's scroll box (#results-wrapper) ends
# above the footer status bar, so its horizontal scrollbar is on screen.
#
# Reported on ?id=dirsearch: in Easy Read density with the docked admin console
# open, the table's horizontal scrollbar sat behind the status bar. Three causes,
# all in updateContainerHeight() and who calls it:
#   1. a flat 250px minimum: whenever the room between the box's top and the bar
#      was 100-250px (a docked console under a tall header) the box ran past the
#      bar. Now it fits whenever ~100px fits; 250px only below that (page scrolls).
#   2. nothing re-capped when something ABOVE the box moved it - a console tab
#      switch (342 -> 534px tall live), the console's audit log filling in, the
#      header re-rendering. One ResizeObserver on <body> now catches them all.
#   3. the cap was measured from the viewport, so a scrolled page read as more
#      room; it is measured from the box's PAGE position now (no scroll creep).
#
# The REAL main.js (ready closure unwrapped, window.__TF export hook) against the
# REAL main.css + density.css, in headless Edge over CDP with real frames (the
# observers have to fire on their own). driver.js steps:
#   T0             console closed: the box fits exactly on the bar (control regime)
#   T-open         the REAL console toggle, 100-250px of room: fits (the report)
#   T-tabshrink    a shorter console tab, no explicit re-cap: grows back, no gap
#   T-tabgrow      a taller console tab, no explicit re-cap: shrinks above the bar
#   T-floor        a tab leaving < 100px: keeps 250px, the page scrolls to it
#   T-floorbar     scrolled to the end, that box's scrollbar sits right above the bar
#   T-scrollstable a re-cap on the scrolled page changes neither cap nor scroll
#   T-idle         settled, the cap never changes again (no observer loop)
#   T-hdr          the header grows 80px, no explicit re-cap: shrinks above the bar
#   T-hdrback      the header shrinks back, no explicit re-cap: grows back, no gap
#   E              no page errors, no hook errors
#
#   py -3 run.py                        candidate = live js\main.js
#   py -3 run.py --candidate <main.js>  any build (the stage before the deploy)
#   py -3 run.py --control <main.js>    the PRE-FIX build: exactly CONTROL_RED must go red
#   py -3 run.py --mutant NAME / --mutants   single-point changes to the candidate;
#                                       each must turn exactly its own asserts red
#   --verbose prints every assert's detail (and the driver's notes)
#   --real-scrollbar  the page's vertical scrollbar NOT pinned (harness.html?pin=0): the live
#                     page's own behaviour, where the page turning scrollable narrows the box and
#                     its own observer re-caps some growth by accident. Diagnostic only - the
#                     control / mutant expectations assume the pinned default.
# Stages into %TEMP%; writes nothing to the webroot. cd into this folder first
# (Git Bash mangles a \\server\d$ argument to py -3).
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
JS_LIBS = ['jspdf-2.5.1.umd.min.js', 'jspdf-autotable-3.5.23.min.js', 'exceljs-4.4.0.min.js']
CR = '\r\n'
CONTROL_RED = ['T-open', 'T-tabshrink', 'T-tabgrow', 'T-hdr', 'T-hdrback']

MUTANTS = {
    # the old flat 250px minimum: the 100-250px band runs behind the bar again
    'floor250':    ([("            $wrapper.css('max-height', (availableHeight >= 100 ? availableHeight : 250) + 'px');" + CR,
                      "            $wrapper.css('max-height', Math.max(250, availableHeight) + 'px');" + CR)], ['T-open', 'T-tabgrow']),
    # the page observer created but never pointed at <body>: nothing above the box re-caps it
    'nopageobs':   ([("        }).observe(document.body);" + CR, "        });" + CR)], ['T-tabshrink', 'T-tabgrow', 'T-floor', 'T-hdr', 'T-hdrback']),
    # measured from the viewport again: a re-cap on a scrolled page creeps
    'viewporttop': ([("            const top = $wrapper[0].getBoundingClientRect().top + window.pageYOffset;" + CR,
                      "            const top = $wrapper[0].getBoundingClientRect().top;" + CR)], ['T-scrollstable']),
    # no floor at all: a sliver of room gets a sliver of a box and the page never scrolls to it
    # (T-floorbar too: its premise - a page that scrolls to the box - is gone)
    'fit0':        ([("(availableHeight >= 100 ? availableHeight : 250)", "(availableHeight >= 0 ? availableHeight : 250)")], ['T-floor', 'T-floorbar']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
cand_path = opt('--candidate', os.path.join(APP, 'js', 'main.js'))
control_path = opt('--control', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
verbose = flag('--verbose')
real_sb = flag('--real-scrollbar')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control_path: cand_path = control_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['updateContainerHeight', 'applyContainerization', 'removeContainerization']
    h = ('\r\n;try { window.__TF = {}; } catch (e) { window.__TF_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__TF[k] = eval(k); } catch (e) { (window.__TF_MISSING = window.__TF_MISSING || []).push(k); } }); }'
         ' catch (e) { window.__TF_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__TF_HIDES = (window.__TF_HIDES || 0) + 1;\r\n')
def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %r" % (name, src.count(old), old[:90]))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_tf_')
os.makedirs(os.path.join(stage, 'js'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in JS_LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, 'js', f))
for f in ('main.css', 'density.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,1150',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page():
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
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same main_tf.js
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html%s' % (hp, '?pin=0' if real_sb else '')})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__TFDONE ? JSON.stringify(window.__TFRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'results': [{'name': 'F-timeout', 'pass': False, 'detail': 'the driver never finished (240 s)'}], 'notes': []}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text):
    open(os.path.join(stage, 'main_tf.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    return run_page()

def short(name): return name.split(' ')[0]

try:
    cand_text = read_b(cand_path)
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the pre-fix build)' if control_path else ''))
    if all_mutants or one_mutant:
        ok = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must = MUTANTS[m]
            res = run_build(mutate(cand_text, m))
            red = [short(r['name']) for r in res['results'] if not r['pass']]
            good = sorted(red) == sorted(must)
            ok += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose or not good:
                for r in res['results']:
                    if not r['pass']: print('        %-16s %s' % (short(r['name']), r['detail'][:400]))
                for x in res.get('notes', []): print('        note: %s' % x)
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = run_build(cand_text)
        p = f = 0; failed = []
        for r in res['results']:
            print('  %s  %s' % ('PASS' if r['pass'] else 'FAIL', r['name']))
            if verbose or not r['pass']: print('          %s' % r['detail'][:500])
            if r['pass']: p += 1
            else: f += 1; failed.append(short(r['name']))
        for x in res.get('notes', []): print('  note: %s' % x)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control_path:
            same = sorted(failed) == sorted(CONTROL_RED)
            print('CONTROL: %s (expected red: %s)' % ('as expected' if same else 'NOT as expected', ' '.join(CONTROL_RED)))
            print('RESULT: GREEN' if same else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
