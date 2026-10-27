# =============================================================================
# JRNPLACE SUITE (2026-10-26) - where a report's SAVED layout puts the journal's columns (Notes, a toggle, its who /
# when) at load
#
# A Save writes the journal's columns into the report's columnOrder / visibleColumns by name (the data columns by
# place), but the journal places a new heading after the build by the viewer's OWN layout (localStorage) only. For
# every viewer without one - a new one, or after Clear All Custom Preferences - a Notes or toggle column the author
# moved to the end opened right after '#', one they hid showed, and a Save from there wrote it back that way (user
# report 10-26; "make sure toggle rows follow the same fix"). The fix: savedAnchorFor / journalHeadCell fall back to
# the report's saved layout (read in this table's places by name) for a column the viewer's own layout does not name;
# a column a layout names with nothing before it in the row goes right after '#' (a toggle's who / when column saved
# before its toggle landed after it); Reset this column takes a journal column back to the report's place too.
#
# Each scenario loads the REAL main.js + penumbra_calc.js (+ the live grouping module) through the REAL run path (a
# stubbed query.php, an empty journal) from a stored state (harness.html) whose viewOptions turn the journal on, and
# publishes named checks:
#   L-<scn>-<check>  must hold on the candidate
#   E-<scn>          no page errors
#
#   py -3 run.py                        candidate = LIVE js\main.js + js\penumbra_calc.js
#   py -3 run.py --stage DIR            DIR\js\main.js + DIR\js\penumbra_calc.js
#   py -3 run.py --live-control         the LIVE build: the NEW checks red, the GUARDs green (a build with the fix
#                                       already: every check green)
#   py -3 run.py --stage DIR --mutant a,b / --mutants [--verbose]
#   --scn a,b                           a subset of scenarios ('flowload' runs 'flowsave' first, 'tgflowload' 'tgflowsave')
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import base64, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request, zlib
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_colwidths.js', 'penumbra_grouplist.js', 'penumbra_presets.js']
CSS = ['main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css']
MARKER = 'function reportLayoutFor('

def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
H = ['H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE']
MID = ['V_AMOUNT', 'V_ID', '__JOURNAL_NOTES', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS']
# a view link with its own column layout naming Notes after V_ID (the report has it last)
T_LINK = tok({'v': 1, 'm': 'flat', 'o': 'none', 'c': {'o': MID + H, 'v': MID, 'n': True}})

# (scenario, extra URL, the scenario whose posted state it loads) - every one opens the report by id (the journal and
# the viewer's own layout are filed under it)
ID = '&id=ldfix'
SCN = [('repend', ID, None), ('repmid', ID, None), ('rephid', ID, None), ('repnone', ID, None), ('repfirst', ID, None),
       ('minewins', ID, None), ('mineunl', ID, None), ('minehid', ID, None), ('mineshow', ID, None),
       ('linkwins', ID + '&view=' + T_LINK, None), ('stays', ID, None), ('resetall', ID, None), ('resetcol', ID, None),
       ('requery', ID, None), ('grouped', ID, None), ('flowsave', ID, None), ('flowload', ID, 'flowsave'),
       ('tgend', ID, None), ('tghid', ID, None), ('tgflowsave', ID, None), ('tgflowload', ID, 'tgflowsave')]
# every check a scenario must publish (a missing one fails)
CHK = {
    'repend': ['layout', 'cells'], 'repmid': ['layout', 'cells'], 'rephid': ['layout', 'cellHidden', 'cells'],
    'repnone': ['layout', 'cells'], 'repfirst': ['layout'], 'minewins': ['layout'], 'mineunl': ['layout', 'cells'],
    'minehid': ['layout', 'cells'], 'mineshow': ['layout'], 'linkwins': ['layout', 'cells'],
    'stays': ['atLoad', 'staysMoved', 'freshMine'], 'resetall': ['cleanAtLoad', 'changed', 'backToReport'],
    'resetcol': ['backByReport'], 'requery': ['afterRun'], 'grouped': ['flat', 'groups'],
    'flowsave': ['startsFirst', 'moved', 'savedAtEnd'], 'flowload': ['layout', 'cells'],
    'tgend': ['layout', 'cells'], 'tghid': ['layout', 'cells'],
    'tgflowsave': ['startsFirst', 'moved', 'savedAtEnd'], 'tgflowload': ['layout', 'cells'],
}
# the checks the build before the fix fails (the rest are GUARDs: green on both)
NEW = ['L-repend-layout', 'L-repmid-layout', 'L-rephid-layout', 'L-rephid-cellHidden', 'L-mineunl-layout', 'L-minehid-layout',
       'L-stays-atLoad', 'L-resetall-cleanAtLoad', 'L-resetcol-backByReport', 'L-requery-afterRun', 'L-grouped-flat',
       'L-grouped-groups', 'L-flowload-layout', 'L-tgend-layout', 'L-tghid-layout', 'L-tgflowload-layout']

# name: (file 'main', [(old, new)], the checks that must go red, the scenarios to run)
MUTANTS = {
    # the report's saved order never read: a column the viewer's own layout does not name goes after '#' again
    'jp-noreport': ('main', [('                var rep = reportLayoutFor(col);', '                var rep = null;')],
                    ['L-repend-layout', 'L-repmid-layout', 'L-mineunl-layout', 'L-flowload-layout', 'L-requery-afterRun',
                     'L-resetall-cleanAtLoad', 'L-grouped-flat', 'L-tgend-layout', 'L-tgflowload-layout'],
                    ['repend', 'repmid', 'mineunl', 'flowsave', 'flowload', 'requery', 'resetall', 'grouped', 'tgend', 'tgflowsave', 'tgflowload']),
    # ...read by the raw saved place (not through its names): the SQL's moved columns misplace it
    'jp-rawplace': ('main', [('            var sl = (typeof _pnbStoredLayoutHere === \'function\') ? _pnbStoredLayoutHere() : null;', '            var sl = _pnbStoredLayout;')],
                    ['L-repmid-layout'], ['repmid']),
    # the report's order wins over the viewer's own layout (and over a view link's: none under a link)
    'jp-reportwins': ('main', [('            if (!order || order.indexOf(col) < 0) {', '            if (true) {')],
                      ['L-minewins-layout', 'L-mineshow-layout', 'L-stays-freshMine', 'L-linkwins-layout'],
                      ['minewins', 'mineshow', 'stays', 'linkwins']),
    # a column named with nothing before it in the row goes after the journal heading placed before it again
    'jp-prev': ('main', [('            return hashCellOf(headRow);\r\n        }\r\n        // The report\'s saved layout', '            return null;\r\n        }\r\n        // The report\'s saved layout')],
                ['L-tghid-layout', 'L-tgflowload-layout'], ['tghid', 'tgflowsave', 'tgflowload']),
    # the report's hidden journal column shown
    'jp-nohide': ('main', [('            return !!rep && rep.hidden;', '            return false;')],
                  ['L-rephid-layout', 'L-rephid-cellHidden', 'L-tghid-layout'], ['rephid', 'tghid']),
    # the viewer's own hidden / shown journal column not read (the report's decides)
    'jp-nomine': ('main', [('            if (lp && lp.order.indexOf(col) >= 0) return Array.isArray(lp.visible) && lp.visible.indexOf(col) < 0;\r\n', '')],
                  ['L-minehid-layout', 'L-mineshow-layout'], ['minehid', 'mineshow']),
    # a new heading never hidden by a saved layout (only a view link's)
    'jp-nohideflag': ('main', [("            else if (savedHidden(col)) th.style.display = 'none';\r\n", '')],
                      ['L-rephid-layout', 'L-minehid-layout', 'L-tghid-layout'], ['rephid', 'minehid', 'tghid']),
    # Reset this column leaves a journal column where it is again
    'jp-resetcol': ('main', [('        if (i < 0) return true;\r\n        var me = lay.cols[i];', "        if (i < 0 || lay.cols[i].colId.indexOf('__JOURNAL') === 0) return true;\r\n        var me = lay.cols[i];")],
                    ['L-resetcol-backByReport'], ['resetcol']),
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
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
verbose = flag('--verbose')
live_control = flag('--live-control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if live_control and (stage_dir or all_mutants or one_mutant): raise SystemExit('--live-control runs the live build alone')
main_path = os.path.join(stage_dir or APP, 'js', 'main.js')
calc_path = os.path.join(stage_dir or APP, 'js', 'penumbra_calc.js')
if stage_dir and not os.path.isfile(main_path): raise SystemExit('no main.js under --stage %s' % stage_dir)

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    which, edits, _, _ = MUTANTS[name]
    t = dict(texts)
    for old, new in edits:
        if t[which].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, t[which].count(old), old[:90]))
        t[which] = t[which].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_jp_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
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

def run_page(scn, extra, inject=None):
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
        call('Page.enable')
        if inject is not None:
            call('Page.addScriptToEvaluateOnNewDocument', {'source': 'window.__INJECT = ' + json.dumps(inject) + ';'})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        st = call('Runtime.evaluate', {'expression': 'JSON.stringify({step: window.__STEP || null, errs: (window.__errors || []).concat(window.__rejections || []).slice(0, 3), hides: window.__HC_HIDES || 0, q: window.__queryDone})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout (240 s) at %s' % st}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(texts, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_calc.js'), 'wb').write(texts['calc'].encode('utf-8', 'surrogateescape'))
    res = {}
    for s, x, src in SCN:
        if s not in scns: continue
        inj = None
        if src:
            if src not in res: res[src] = run_page(src, dict((a, b) for a, b, _ in SCN)[src])
            inj = (res[src].get('info') or {}).get('posted')
            if not inj:
                res[s] = {'fatal': "no state from '%s' to load" % src}; continue
        res[s] = run_page(s, x, inj)
    return res

def evaluate(res, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r = res.get(s, {})
        if r.get('fatal') and not r.get('chk'):
            add('F-' + s, False, (r.get('fatal') or '')[:400]); continue
        add('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('fatal'),
            'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), (r.get('fatal') or '')[:300]))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:900]) if v is not True else ''))
    return out

try:
    names = [s for s, _, _ in SCN]
    if scn_arg: names = [s for s in names if s in scn_arg.split(',')]
    texts = {'main': read_b(main_path), 'calc': read_b(calc_path)}
    print('candidate: %s + %s (%s the fix)' % (main_path, calc_path, 'with' if MARKER in texts['main'] else 'WITHOUT'))
    if all_mutants or one_mutant:
        if MARKER not in texts['main']: raise SystemExit('mutants need a build with the fix (--stage)')
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            _, _, must, scns = MUTANTS[m]
            res = evaluate(run_build(mutate(texts, m), scns), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-30s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(texts, names), names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-32s %s' % ('PASS' if passed else 'FAIL', a, d[:1100]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if live_control:
            expect = [] if MARKER in texts['main'] else NEW
            print('CONTROL: the fix is %s live main.js - %d checks expected RED' % ('in' if MARKER in texts['main'] else 'not in', len(expect)))
            seen = [a for a, _, _ in res]
            new_green = [a for a in expect if a in seen and a not in failed]
            new_unseen = [a for a in expect if a not in seen and a.split('-')[1] in names]
            old_red = [a for a in failed if a not in expect]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            if MARKER not in texts['main']:
                red = [a for a in NEW if a in failed]
                if red: print('NOTE: the fix is not in this build: %d of its checks are red as on the build before it' % len(red))
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
