# =============================================================================
# SORTPAGE SUITE (2026-09-30)
#
# A report saved WITH A SORT showed the wrong page 1 on load: the on-load sort (a
# saved sort, ?sort=, a sort carried across a re-query) runs AFTER the load path's
# only applyPagination(), which had picked page 1 from the BUILD order - so page 1
# was the original first page re-ordered, and rows that belong at the top of the
# sort stayed hidden until the reader paged away and back. The fix re-pages after
# that sort (currentPage = 1; applyPagination(), the header-click tail).
#
# Browser only: the REAL main.js through the REAL run path on the hiddencols
# fixture (300 rows, 200 per page), six scenarios:
#   saved      saved sort H_NUM desc          savedtext  two-column saved sort
#   rpp25      saved sort + 25 rows per page  presearch  ?search= (about 70% match) + saved sort
#   url        ?sort=H_MONEY|desc             nosort     no sort (control: must hold on BOTH builds)
# P-* page 1 = the first N search-visible rows of the sorted order; S-* the body
# really is in sorted order (fixture check); E-* no page errors.
#
#   py -3 run.py                        live js\main.js
#   py -3 run.py --candidate F          any build
#   py -3 run.py --control              the pre-fix build (newest js\main.js.bak-*-sortpage, or --baseline):
#                                       RED on P-saved P-savedtext P-rpp25 P-presearch P-url; the rest GREEN
#   py -3 run.py --mutants              every mutant against the asserts it must turn red
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = [('saved', ''), ('savedtext', ''), ('rpp25', ''), ('presearch', '&search=H_FLAG%20%3D%20N'),
       ('url', '&sort=H_MONEY%7Cdesc'), ('nosort', '')]
SORTED = {'saved': 'sortedHnumDesc', 'rpp25': 'sortedHnumDesc', 'presearch': 'sortedHnumDesc', 'url': 'sortedHmoneyDesc'}
FIX_TAIL = ("                                updateHeaderIcons();\r\n"
            "                                // Page the SORTED order (2026-09-30).")
MUTANTS = {
    # the fix taken out: back to the old tail's behaviour (no re-page after the sort)
    'nofix': ([("                                currentPage = 1;\r\n                                applyPagination();\r\n                            }\r\n                        }\r\n",
                "                                applyZebraStriping();\r\n                            }\r\n                        }\r\n")],
              ['P-saved', 'P-savedtext', 'P-rpp25', 'P-presearch', 'P-url']),
    # currentPage is already 1 on a load - documented as redundant, must stay GREEN
    'eq-nocurrentpage': ([("                                currentPage = 1;\r\n                                applyPagination();\r\n                            }\r\n                        }\r\n",
                           "                                applyPagination();\r\n                            }\r\n                        }\r\n")], []),
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
base_path = opt('--baseline', None)
control = flag('--control')
mutants = flag('--mutants')
one_mutant = opt('--mutant', None)
if control:
    if not base_path:
        baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-sortpage'))
        if not baks: raise SystemExit('--control needs --baseline <pre-fix main.js> (the deploy leaves js\\main.js.bak-<stamp>-sortpage)')
        base_path = baks[-1]
    cand_path = base_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = { master: function () { return masterRowData; } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build)" % (name, src.count(old)))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_sp_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
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
        # Every build is written to the same main_hc.js: never let the browser serve a
        # cached copy (heuristic freshness once handed a mutant the previous build).
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_all(text, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    out = []
    for scn, extra in [s for s in SCN if s[0] in scns]:
        r = run_page(scn, extra)
        if r.get('fatal'):
            out.append(('F-' + scn, False, r['fatal'][:300])); continue
        out.append(('P-' + scn, r.get('pageOk'), 'rows %s, rpp %s, search-visible %s, displayed %s, first %s, last %s, %s' % (
            r.get('rows'), r.get('rpp'), r.get('searchVisible'), r.get('displayed'), r.get('firstDisplayedPos'), r.get('lastDisplayedPos'), r.get('pageInfo'))))
        if scn in SORTED:
            out.append(('S-' + scn, r.get(SORTED[scn]), 'body in sorted order (%s)' % SORTED[scn]))
        if scn == 'presearch':
            out.append(('X-presearch', bool(r.get('searchValue')) and r.get('searchVisible', 0) < r.get('rows', 0) and r.get('searchVisible', 0) > 200,
                        'search %r keeps %s of %s rows (more than one page)' % (r.get('searchValue'), r.get('searchVisible'), r.get('rows'))))
        if scn == 'rpp25':
            out.append(('X-rpp25', r.get('rpp') == '25', 'rows per page %r' % r.get('rpp')))
        out.append(('E-' + scn, not r.get('errors'), 'errors %s' % r.get('errors')))
    return out

try:
    src = read_b(cand_path)
    print('main.js: %s%s' % (cand_path, '   (CONTROL: the pre-fix build)' if control else ''))
    if mutants or one_mutant:
        ok = bad = 0
        for name in ([one_mutant] if one_mutant else list(MUTANTS)):
            must = MUTANTS[name][1]
            res = run_all(mutate(src, name), [s[0] for s in SCN])
            red = [a for a, p, _ in res if not p]
            good = (not [m for m in must if m not in red]) if must else (not red)
            ok += good; bad += (not good)
            print('  %s  mutant %-17s %s   [red: %s]' % ('PASS' if good else 'FAIL', name, ('turns %s red' % ' '.join(must)) if must else 'redundant by design: must stay GREEN', ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        res = run_all(src, [s[0] for s in SCN])
        p = f = 0; failed = []
        for aid, passed, detail in res:
            print('  %s  %-13s %s' % ('PASS' if passed else 'FAIL', aid, detail))
            if passed: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
