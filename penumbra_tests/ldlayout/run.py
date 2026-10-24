# =============================================================================
# LDLAYOUT SUITE (2026-10-23) - a report's SAVED column order and visibility at load, by name
#
# A save keeps each column's PLACE in the result (its heading's data-column) in columnOrder / visibleColumns, and the
# state load read them back by place (decodedState.columnOrder.map(index => newColumnNames[index])). After the report's
# SQL put a column in front of others, moved one or dropped one (or a column named like a number came in: JS puts its
# key first), the report opened with its columns shifted - other columns shown and hidden, in another order - and the
# header menu's Reset / Reset all and the custom-layout chip read the report's layout the same way. The fix: a save
# writes layoutColumnNames (the name at each place); the load, the two Resets and the chip map each saved place to its
# name and the name to its place now (_pnbLayoutByName); a state without them, or with names that do not cover its
# lists, is read by place as before; ?state= links carry them only while the link fits; a Save strips the viewer's own
# calculated columns from them too (penumbra_calc.js). Kit: penumbra_tests\ldlayout\stage_20261023.
#
# Each scenario loads the REAL main.js + penumbra_calc.js (+ the live grouping module) through the REAL run path (a
# stubbed query.php) from a stored state (harness.html) and publishes named checks:
#   L-<scn>-<check>  must hold on the candidate
#   E-<scn>          no page errors
#
#   py -3 run.py                        candidate = LIVE js\main.js + js\penumbra_calc.js
#   py -3 run.py --stage DIR            DIR\js\main.js + DIR\js\penumbra_calc.js
#   py -3 run.py --live-control         the LIVE build: the NEW checks red, the GUARDs green (a build with the fix
#                                       already: every check green)
#   py -3 run.py --stage DIR --mutant a,b / --mutants [--verbose]
#   --scn a,b                           a subset of scenarios ('saveload' runs 'save' first)
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
MARKER = 'function _pnbLayoutByName('

def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
H = ['H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE']
T_LAY = tok({'v': 1, 'm': 'flat', 'o': 'none', 'c': {'o': ['V_STATUS', 'V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK'] + H,
                                                    'v': ['V_STATUS', 'V_ID', 'V_NAME'], 'n': True}})
T_NOLAY = tok({'v': 1, 'm': 'flat', 'o': 'none'})

# (scenario, extra URL, the scenario whose posted state it loads)
SCN = [('front', '', None), ('oldfront', '', None), ('moved', '', None), ('gone', '', None), ('gonenew', '', None),
       ('renamed', '', None), ('numname', '', None), ('same', '', None), ('oldsame', '', None), ('badnames', '', None),
       ('partial', '', None), ('holey', '', None), ('netthrow', '', None), ('allgone', '', None), ('hashoff', '', None), ('casedup', '', None),
       ('jrnentry', '', None), ('group', '', None), ('save', '', None), ('saveload', '', 'save'), ('carry', '', None),
       ('mycalc', '&id=ldcalc', None), ('mycalcload', '&id=ldcalc', None), ('viewlink', '&id=ldfix&view=' + T_LAY, None),
       ('viewnolay', '&id=ldfix&view=' + T_NOLAY, None), ('reset', '', None), ('resetcol', '', None),
       ('pill', '&id=ldfix', None), ('prefs', '&id=ldfix', None), ('urlfit', '', None), ('sharefit', '', None),
       ('statecalc', '', None), ('requery', '', None)]
LAYOUT_ONLY = ['front', 'oldfront', 'moved', 'gone', 'gonenew', 'renamed', 'numname', 'same', 'oldsame', 'badnames', 'partial',
               'holey', 'netthrow', 'allgone', 'hashoff', 'jrnentry', 'saveload', 'viewnolay', 'mycalcload']
# every check a scenario must publish (a missing one fails)
CHK = dict((s, ['layout']) for s in LAYOUT_ONLY)
for s in ('front', 'moved', 'gone', 'gonenew', 'numname', 'hashoff', 'jrnentry', 'saveload', 'viewnolay'): CHK[s] = ['layout', 'idCell']
CHK.update({
    'casedup': ['eachItsOwn'],
    'group': ['groupsByName', 'flatByName'],
    'save': ['posted', 'listsAsBefore', 'namesWritten'],
    'carry': ['emptyRun', 'listsCarried', 'namesCarried'],
    'mycalc': ['calcHere', 'listsStripped', 'namesStripped'],
    'viewlink': ['linkLayout'],
    'reset': ['cleanAtLoad', 'changed', 'resetByName'],
    'resetcol': ['backByName'],
    'pill': ['chipHidden', 'layoutMine'],
    'prefs': ['prefsWin'],
    'urlfit': ['linkHasNames', 'localHasNames', 'calibrated', 'nearMeasureFits', 'nearLinkFits', 'nearLocalSaves', 'encryptedLean'],
    'requery': ['kept', 'byNameAfter'],
    'sharefit': ['shareKeepsNames', 'calibrated', 'filterRides', 'leanWhenSqueezed'],
    'statecalc': ['fromLink', 'layout'],
})
# the checks the build before the fix fails (the rest are GUARDs: green on both)
NEW = ['L-front-layout', 'L-moved-layout', 'L-gone-layout', 'L-gonenew-layout', 'L-numname-layout', 'L-hashoff-layout',
       'L-jrnentry-layout', 'L-saveload-layout', 'L-viewnolay-layout', 'L-casedup-eachItsOwn', 'L-group-groupsByName',
       'L-group-flatByName', 'L-save-namesWritten', 'L-carry-namesCarried', 'L-mycalc-namesStripped', 'L-reset-resetByName',
       'L-resetcol-backByName', 'L-pill-chipHidden', 'L-urlfit-linkHasNames', 'L-urlfit-localHasNames', 'L-requery-byNameAfter',
       'L-sharefit-shareKeepsNames']

# name: (file 'main' | 'calc', [(old, new)], the checks that must go red, the scenarios to run)
CR = '\r\n'
MUTANTS = {
    # the load reads the saved lists by place again
    'lo-off': ('main', [('const _ldLay = _pnbLayoutByName(decodedState, newColumnNames, _pnbNotSaved) || decodedState;',
                         'const _ldLay = decodedState;')],
               ['L-front-layout', 'L-moved-layout', 'L-gone-layout', 'L-numname-layout', 'L-saveload-layout', 'L-group-flatByName'],
               ['front', 'moved', 'gone', 'numname', 'save', 'saveload', 'group']),
    # a save writes no names
    'lo-nowrite': ('main', [('layoutColumnNames: _pnbDenseNames(layoutColumnNames) ? layoutColumnNames : undefined,', 'layoutColumnNames: undefined,')],
                   ['L-save-namesWritten', 'L-saveload-layout', 'L-mycalc-namesStripped', 'L-urlfit-linkHasNames', 'L-urlfit-localHasNames'],
                   ['save', 'saveload', 'mycalc', 'urlfit']),
    # a save with no table to read carries the stored lists without their names
    'lo-nocarry': ('main', [('            state.layoutColumnNames = _pnbStoredLayout.layoutColumnNames ? _pnbStoredLayout.layoutColumnNames.slice() : undefined;' + CR, '')],
                   ['L-carry-namesCarried'], ['carry']),
    # the stored layout keeps no names (the carry and both Resets lose them)
    'lo-layoutof': ('main', [('        var nm = Array.isArray(state.layoutColumnNames) ? state.layoutColumnNames.slice() : undefined;', '        var nm = undefined;')],
                    ['L-carry-namesCarried', 'L-reset-resetByName', 'L-resetcol-backByName'], ['carry', 'reset', 'resetcol']),
    # names trusted whatever places the column order lists
    'lo-nocount': ('main', [('        if (co.filter(isPlace).length !== saved.length || listed.some(', '        if (listed.some(')],
                   ['L-partial-layout'], ['partial']),
    # ...or a place past the names
    'lo-norange': ('main', [(' || listed.some(function (x) { return +x >= saved.length; })) return null;', ') return null;')],
                   ['L-badnames-layout'], ['badnames']),
    # names with a gap trusted
    'lo-dense': ('main', [("        for (var i = 0; i < a.length; i++) if (typeof a[i] !== 'string' || a[i] === '') return false;" + CR, '')],
                 ['L-holey-layout'], ['holey']),
    # the by-name read failing takes the table build down with it (no net)
    'lo-nonet': ('main', [("        catch (e) { console.warn('Saved column layout read by place:', e); return null; }", '        catch (e) { throw e; }')],
                 ['F-netthrow'], ['netthrow']),
    # a name changed in place: its place not kept
    'lo-norename': ('main', [('        if (ours === theirs) saved.forEach(function (n, i) {', '        if (false) saved.forEach(function (n, i) {')],
                    ['L-renamed-layout', 'L-mycalcload-layout', 'L-statecalc-layout'], ['renamed', 'mycalcload', 'statecalc']),
    # ...the saved side counted with the sender's own calculated columns a ?state= link carries
    'lo-theirs': ('main', [('        var theirs = saved.filter(function (n) { return !(notSaved && notSaved(n)); }).length;', '        var theirs = saved.length;')],
                  ['L-statecalc-layout'], ['statecalc']),
    # the Share link keeps the names even when the sharer's filter then cannot ride
    'lo-sharelean': ('main', [('        if (targetLen + shareWant > LOCAL_STATE_URL_LIMIT) {', '        if (false) {')],
                     ['L-sharefit-filterRides', 'L-sharefit-leanWhenSqueezed'], ['sharefit']),
    # ...counted with this viewer's own calculated columns (a save leaves them out)
    'lo-renamemine': ('main', [('            if (!(notSaved && notSaved(n))) ours++;', '            ours++;')],
                      ['L-mycalcload-layout'], ['mycalcload']),
    # ...onto a place a saved column took by name
    'lo-renametaken': ('main', [(' && curNames[i] !== null && !taken[i]) { map[i] = i; taken[i] = true; }', ' && curNames[i] !== null) { map[i] = i; taken[i] = true; }')],
                       ['L-gonenew-layout'], ['gonenew']),
    # two columns sharing a name both to the first of them
    'lo-dupname': ('main', [('            for (var k = 0; k < c.length; k++) if (!taken[c[k]]) { map[i] = c[k]; taken[c[k]] = true; return; }',
                             '            for (var k = 0; k < c.length; k++) { map[i] = c[k]; taken[c[k]] = true; return; }')],
                   ['L-casedup-eachItsOwn'], ['casedup']),
    # none of the shown columns left: only the row numbers shown
    'lo-noshown': ('main', [('        if (Array.isArray(vc) && vc.some(isPlace) && !nv.some(isPlace)) return null;' + CR, '')],
                   ['L-allgone-layout'], ['allgone']),
    # a view link's own layout (this result's places) read through the report's saved names
    'lo-viewnames': ('main', [('            delete st.layoutColumnNames;' + CR, '')], ['L-viewlink-linkLayout'], ['viewlink']),
    # Reset this column / Reset all on the stored places
    'lo-resetcolraw': ('main', [('        var sl = _pnbStoredLayoutHere(), rep = (sl && sl.columnOrder)', '        var sl = _pnbStoredLayout, rep = (sl && sl.columnOrder)')],
                       ['L-resetcol-backByName'], ['resetcol']),
    'lo-resetallraw': ('main', [('        var st = _pnbStoredLayoutHere(), ids = cur.cols.map(', '        var st = _pnbStoredLayout, ids = cur.cols.map(')],
                       ['L-reset-cleanAtLoad', 'L-reset-resetByName'], ['reset']),
    # the custom layout chip on the stored places
    'lo-pillraw': ('main', [('            ps = _pnbLayoutByName(ps, _pnbHeaderNames(), _pnbNotSaved) || ps;', '            ps = ps;')],
                   ['L-pill-chipHidden'], ['pill']),
    # a ?state= link keeps the names however long it gets
    'lo-urlkeep': ('main', [('        if (!lean && _pnbStateUrlLength(compressString(JSON.stringify(state))) <= LOCAL_STATE_URL_LIMIT) return state;', '        if (!lean) return state;')],
                   ['L-urlfit-nearMeasureFits', 'L-urlfit-nearLinkFits', 'L-urlfit-nearLocalSaves'], ['urlfit']),
    # ...or never carries them
    'lo-urlalways': ('main', [('        if (!lean && _pnbStateUrlLength(compressString(JSON.stringify(state))) <= LOCAL_STATE_URL_LIMIT) return state;', '')],
                     ['L-urlfit-linkHasNames', 'L-urlfit-localHasNames'], ['urlfit']),
    # an encrypted local save seals the names in
    'lo-enclean': ('main', [("        stateObject = _pnbUrlState(stateObject, $('#enableLocalReportPassword').is(':checked'));", '        stateObject = _pnbUrlState(stateObject, false);')],
                   ['L-urlfit-encryptedLean'], ['urlfit']),
    # the Local Save tab's size guard measures the state with the names
    'lo-measure': ('main', [('            const encoded = compressString(JSON.stringify(_pnbUrlState(stateObject)));', '            const encoded = compressString(JSON.stringify(stateObject));')],
                   ['L-urlfit-nearMeasureFits'], ['urlfit']),
    # a Save leaves the viewer's own calculated column's name in (penumbra_calc.js)
    'lo-calcstrip': ('calc', [('        if (Array.isArray(state.layoutColumnNames)) state.layoutColumnNames = state.layoutColumnNames.filter(function (n, i) { return idx[String(i)] !== true; });\n', '')],
                     ['L-mycalc-namesStripped'], ['mycalc']),
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

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    # what a save would write; a ?state= link and its decoding; the Local Save tab's size guard; a sealed state
    h = ('\r\n;try { window.__HC = {'
         ' build: function () { try { var s = buildStateObject(); return s ? JSON.parse(JSON.stringify(s)) : null; } catch (e) { return { __err: String(e) }; } },'
         ' viewUrl: function () { return buildViewStateURL(true); },'
         ' decomp: function (s) { return decompressString(s); },'
         ' compress: function (s) { return compressString(s); },'
         ' measure: function () { return measureLocalStateUrlLength(); },'
         ' decrypt: function (p, c) { return decryptState(p, c); } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         # the Share button's link, kept instead of copied and opened in a tab
         'try { _pnbShareCopyAndOpen = function (b, u, n) { window.__SHARE = { url: String(u || ""), note: String(n || "") }; }; } catch (e) { window.__HC_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
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

stage = tempfile.mkdtemp(prefix='pnb_lo_')
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
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:700]) if v is not True else ''))
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
            print('  %s  %-32s %s' % ('PASS' if passed else 'FAIL', a, d[:900]))
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
