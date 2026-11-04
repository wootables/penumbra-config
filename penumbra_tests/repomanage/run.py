# =============================================================================
# REPOMANAGE SUITE (2026-11-03) - the Repository's Manage Mode layer and its list | details split
# (js/penumbra_repository.js + css/penumbra_repository.css, over css/main.css).
#
# What the user asked for that day, each round live: mmframe 17027f2 (a thick themed frame on the Manage bar and the
# SEL + Status columns; details pane floor 400 -> 460, docked default 520 -> 600, dialog 3:2 -> 3:2.5), mmfit e345a60
# (no sideways overflow under saved column widths), mmerase a638aa1 (Erase data on a row of its own), mmhead (the
# band's edge on the heading row in the heading TEXT colour - the brand edge vanished on brand-coloured headings).
#
#   BROWSER   harness.html + driver.js: the REAL module + CSS on the DOCKED page (repoMode) against a stubbed
#             get_server_reports.php; asserts listed at the top of driver.js.
#
#   py -3 run.py [--app DIR]          candidate = DIR\js\penumbra_repository.js + DIR\css\penumbra_repository.css
#                                     (each falls back to live when DIR lacks it); main.css always live's
#   py -3 run.py --control            LIVE's files: exactly CONTROL_RED red (before mmhead's deploy: M-headEdge)
#   py -3 run.py --mutants | --mutant NAME   single-point edits (MUTANTS): each must turn its own asserts red
#
# Headless Edge over CDP; stages into %TEMP%\pnb_rmanage_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js']
EXPECT = ['P-loaded', 'S-default', 'S-floor', 'S-css', 'M-arm', 'M-frame', 'M-headEdge', 'M-natural', 'M-fit', 'M-nosave',
          'X-shut', 'X-open', 'X-close', 'X-rearm', 'E-errors']
# --control is LIVE. Proven 2026-11-03 against mmerase's build (a638aa1): exactly ['M-headEdge'] red (CONTROL_RED_MMHEAD).
# mmhead is live since, so a control now reads all green (expected).
CONTROL_RED_MMHEAD = ['M-headEdge']
CONTROL_RED = []
MUTANTS = {
    'mx-pagedef': ([('repo', "    var SPLIT_PAGE_DETAILS = 600;", "    var SPLIT_PAGE_DETAILS = 520;")], ['S-default']),
    'mx-floor': ([('repo', "        var max = layoutW - SPLIT_BAR - SPLIT_DETAILS_MIN;", "        var max = layoutW - SPLIT_BAR - SPLIT_MIN;")], ['S-floor']),
    'mx-css': ([('rcss', "flex: 2.5 1 0%; min-width: 460px; box-sizing: border-box; }", "flex: 2 1 0%; }")], ['S-css']),
    'mx-bar': ([('rcss', "    border: 3px solid var(--brand-primary, #336699);\n", "    border-bottom: 1px solid var(--border-color, #ddd);\n")], ['M-frame']),
    'mx-head': ([('rcss', "    box-shadow: inset 3px 0 0 currentColor, inset 0 3px 0 currentColor;", "    box-shadow: inset 3px 0 0 var(--brand-primary, #336699), inset 0 3px 0 var(--brand-primary, #336699);")], ['M-headEdge']),
    'mx-natural': ([('repo', "            if (!widths[k] && MANAGE_COL_W[k]) { return MANAGE_COL_W[k]; }\n", "")], ['M-natural']),
    'mx-fit': ([('repo', "        fitManageCols($ths, plan);\n", "")], ['M-fit']),
    'mx-erasemove': ([('repo', "                + '                </div>'\n                + '                <div id=\"srEraseRow\" class=\"sr-erase-row\" hidden>'\n",
                       "                + '                <div id=\"srEraseRow\" class=\"sr-erase-row\" hidden>'\n"),
                      ('repo', "                + '                    </span>'\n                + '                </div>'\n                // Orphaned schedules",
                       "                + '                    </span>'\n                + '                </div>'\n                + '                </div>'\n                // Orphaned schedules")], ['X-shut']),
    'mx-toggle': ([('repo', "        setEraseRow(!!$('#srEraseRow').attr('hidden'));\n", "")], ['X-open']),   # (X-close then finds the row shut anyway)
    'mx-offset': ([('repo', "        $('#srEraseToggle').attr('aria-expanded', show ? 'true' : 'false').toggleClass('is-on', !!show);\n        // The bar changes height and the sticky table header is offset by it.\n        syncBulkBarOffset();\n",
                    "        $('#srEraseToggle').attr('aria-expanded', show ? 'true' : 'false').toggleClass('is-on', !!show);\n")], ['X-open']),
    'mx-rearm': ([('repo', "        setEraseRow(false);\n", "")], ['X-rearm']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control: app_dir = APP
def pick(rel):
    p = os.path.join(app_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
PATHS = {'repo': pick(os.path.join('js', 'penumbra_repository.js')), 'rcss': pick(os.path.join('css', 'penumbra_repository.css')),
         'main': os.path.join(APP, 'css', 'main.css')}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
TEXTS = {k: read_b(v) for k, v in PATHS.items()}

def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_rmanage_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('driver.js', 'harness.html'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))

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

POLL = '(function () { return JSON.stringify({ done: !!window.__RXDONE, res: window.__RXDONE ? window.__RXRESULT : null }); })()'
def run_browser(texts):
    start_browser()
    for k, name in (('repo', 'repo_cand.js'), ('rcss', 'repo_cand.css'), ('main', 'main_cand.css')):
        open(os.path.join(stage, name), 'wb').write(texts[k].encode('utf-8', 'surrogateescape'))
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
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same files
        call('Emulation.setDeviceMetricsOverride', {'width': 1500, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html' % _edge['hp']})
        t0 = time.time()
        while time.time() - t0 < 90:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': POLL, 'returnByValue': True}).get('result', {}).get('value')
            if not v: continue
            st = json.loads(v)
            if st['done']: return st['res']['asserts']
        return [{'id': 'E-errors', 'ok': False, 'detail': 'timeout (90 s)'}]
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (_edge['dp'], t['id']), timeout=10).read()
        except Exception: pass

def evaluate(got):
    by = {}
    for a in got: by.setdefault(a['id'], a)
    out = [(aid, bool(by.get(aid) and by[aid]['ok']), by[aid]['detail'] if aid in by else 'NOT RECORDED') for aid in EXPECT]
    out += [(aid, False, 'UNEXPECTED ID ' + a['detail']) for aid, a in by.items() if aid not in EXPECT]
    return out

try:
    print('candidate: %s\n           %s%s' % (PATHS['repo'], PATHS['rcss'], '   (CONTROL: live)' if control else ''))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS)
        bad = []
        for m in names:
            res = evaluate(run_browser(mutate(TEXTS, m)))
            red = sorted(a for a, ok, _ in res if not ok)
            must = sorted(MUTANTS[m][1])
            ok = all(x in red for x in must)
            print('MUTANT %-14s %s  red: %s' % (m, 'KILLED' if ok else 'SURVIVED', ' '.join(red)))
            if not ok: bad.append(m)
        print('RESULT: GREEN' if not bad else 'RESULT: RED (survived: %s)' % ' '.join(bad))
    else:
        res = evaluate(run_browser(TEXTS))
        p = f = 0; failed = []
        for aid, ok, d in res:
            print('  %s  %-12s %s' % ('PASS' if ok else 'FAIL', aid, str(d)[:300]))
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            good = sorted(failed) == sorted(CONTROL_RED)
            print('CONTROL: %s' % ('as expected (%d red)' % len(failed) if good else 'NOT as expected: red %s' % ' '.join(sorted(failed))))
            print('RESULT: GREEN' if good else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 else 'RESULT: RED')
finally:
    try: _edge['proc'].kill()
    except Exception: pass
    try: _edge['srv'].kill()
    except Exception: pass
    shutil.rmtree(stage, ignore_errors=True)
