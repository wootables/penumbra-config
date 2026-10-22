# =============================================================================
# PVDRV SUITE (2026-10-21, "brk") - a derived pivot value drills to the cells it is computed from:
# a share its own cell, a comparison both cells (a table each), Prior Year the year-before cell, a
# running value every cell it adds up (one table led by a Pivot column / Pivot row), a formula none;
# a group summary row the column-wise ones; the pivot's breakdowns off, none; the cell menu's Show
# the breakdown. Each dialog's rows are held against the fixture (bucketed in driver.js) and the
# cell's value recomputed from them. B-same: the base cells' breakdowns (the drill's code moved into
# shared helpers) are the live page's, byte for byte.
# The REAL main.js and js/penumbra_colmenu.js on the pivmenu harness (mk_harness.py; pivmenu's files
# are read, never written).
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_pd_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['pdyear', 'pdnob', 'pdq', 'pddown', 'pdgrp', 'pdbase']
CHK = {
    'pdyear': ['marks', 'chg', 'chgFirst', 'diff', 'share', 'run', 'runFirst', 'idx', 'ix23', 'yoy', 'yoyNone', 'ly', 'lyNone',
               'formulaNone', 'menuDrv', 'menuBase'],
    'pdnob': ['nobMarks'],
    'pdq': ['ytd', 'freezeLead', 'ytdStart', 'roll', 'rollPartial', 'rollsum', 'cum', 'runN', 'yoyQ'],
    'pddown': ['chgDown', 'runDown', 'yoyDown', 'idxDown', 'rollDown'],
    'pdgrp': ['sumMarks', 'sumChg', 'sumRun', 'sumShare', 'bodyChg'],
    'pdbase': ['grabbed'],
}
# the round's checks: red on live (7e005bb, before brk); the rest guard what live already does
OLD = {'L-pdyear-formulaNone', 'L-pdyear-menuBase', 'L-pdnob-nobMarks', 'L-pdbase-grabbed', 'B-same'}
NEW = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - OLD
MUTANTS = {
    # a derived value's cells never marked; a group summary's; marked with the breakdowns off; every summary type
    'k-mark': ([('main', "                    if (!_noBreakdown && _pnbPvDrvOk(aggType, false)) drillAttr += ' data-pv-drv=\"1\"';",
                 "                    if (false) drillAttr += ' data-pv-drv=\"1\"';")], ['L-pdyear-marks', 'L-pdyear-chg', 'L-pdq-ytd'], ['pdyear', 'pdq']),
    'k-sum': ([('main', "(!_noBreakdownSummary && _pnbPvDrvOk(aggType, true) ? ' data-pv-drv=\"1\" data-pv-rk=\"' + _summaryRowKeyEsc + '\"' : '')", "('')")],
              ['L-pdgrp-sumMarks', 'L-pdgrp-sumChg'], ['pdgrp']),
    'k-nob': ([('main', "                    if (!_noBreakdown && _pnbPvDrvOk(aggType, false)) drillAttr", "                    if (_pnbPvDrvOk(aggType, false)) drillAttr")],
              ['L-pdnob-nobMarks'], ['pdnob']),
    'k-sumall': ([('main', "        if (sum) return !/:down$/.test(String(t)) && (k === 'share' || k === 'prev' || k === 'first' || k === 'run');", "        if (sum) return true;")],
                 ['L-pdgrp-sumMarks'], ['pdgrp']),
    # the cells: the previous one two back; the first the second; the baseline one before it; last year's the previous
    # column's; a running value from the second; YTD from the start; a rolling window one short; a vertical value across
    'r-prev': ([('main', "                R.cells.push(cell(i - 1, lab(keys[i - 1])", "                R.cells.push(cell(Math.max(0, i - 2), lab(keys[i - 1])")],
               ['L-pdyear-chg', 'L-pdyear-diff', 'L-pddown-chgDown'], ['pdyear', 'pddown']),
    'r-first': ([('main', "                R.cells.push(cell(0, lab(keys[0]) + ', the first ' + W));", "                R.cells.push(cell(1, lab(keys[0]) + ', the first ' + W));")],
                ['L-pdyear-idx', 'L-pddown-idxDown'], ['pdyear', 'pddown']),
    'r-base': ([('main', "bi = bk == null ? -1 : keys.indexOf(bk);", "bi = bk == null ? -1 : keys.indexOf(bk) - 1;")], ['L-pdyear-ix23'], ['pdyear']),
    'r-py': ([('main', "            var pk = pivotYoyPrevKey(at, info, pivotYoyIndex(keys, info))", "            var pk = pivotYoyPrevKey(keys[Math.max(0, i - 1)], info, pivotYoyIndex(keys, info))")],
             ['L-pdyear-yoy', 'L-pdyear-ly', 'L-pdq-yoyQ', 'L-pddown-yoyDown'], ['pdyear', 'pdq', 'pddown']),
    'r-run': ([('main', "            var f0 = lab(span(0));", "            var f0 = lab(span(Math.min(1, i)));")],
              ['L-pdyear-run', 'L-pdq-cum', 'L-pdq-runN', 'L-pddown-runDown', 'L-pdgrp-sumRun'], ['pdyear', 'pdq', 'pddown', 'pdgrp']),
    'r-ytd': ([('main', "                while (s0 > 0 && !pivotYtdReset(t, keys[s0 - 1], keys[s0], info)) s0--;", "                while (s0 > 0) s0--;")], ['L-pdq-ytd'], ['pdq']),
    'r-roll': ([('main', "r0 = Math.max(0, i - rs.n + 1)", "r0 = Math.max(0, i - rs.n + 2)")], ['L-pdq-roll', 'L-pdq-rollsum', 'L-pddown-rollDown'], ['pdq', 'pddown']),
    'r-down': ([('main', "        var down = /:down$/.test(t), W = down ? 'row' : 'column';", "        var down = false, W = down ? 'row' : 'column';")],
               ['L-pddown-chgDown', 'L-pddown-runDown', 'L-pddown-idxDown'], ['pddown']),
    # the base value's Filter dropped; a running count filtered
    'f-filter': ([('main', "        var aggFilter = (!R.noFilter && settings.aggFilters && settings.aggFilters[bi]) || null;", "        var aggFilter = null;")],
                 ['L-pdq-ytd', 'L-pdq-roll'], ['pdq']),
    'f-count': ([('main', "            noFilter: /^running_count/.test(t) };", "            noFilter: false };")], ['L-pdq-runN'], ['pdq']),
    # a running total's cell (drill attributes too) opens the old breakdown as well
    'h-base': ([('main', "        if (this.hasAttribute('data-pv-drv')) return;\n", "")], ['L-pdyear-run', 'L-pdgrp-sumRun'], ['pdyear', 'pdgrp']),
    # a running value's one table without its Pivot column; frozen without it
    't-lead': ([('main', "content += _pnbPvDrillTable(rows, cols, { name: R.axis === 'row' ? 'Pivot row' : 'Pivot column',",
                 "content += _pnbPvDrillTable(rows, cols, null && { name: R.axis === 'row' ? 'Pivot row' : 'Pivot column',")], ['L-pdyear-run', 'L-pdq-ytd'], ['pdyear', 'pdq']),
    'z-freeze': ([('main', "            var lead = (want > 0 && t.hasAttribute('data-pnb-bd-lead')) ? 1 : 0;", "            var lead = 0;")], ['L-pdq-freezeLead'], ['pdq']),
    # the menu: no breakdown for a derived value; a breakdown for every value (a formula's)
    'm-drv': ([('menu', "            var drillable = drv || el.hasAttribute('data-row-key')", "            var drillable = el.hasAttribute('data-row-key')")], ['L-pdyear-menuDrv'], ['pdyear']),
    'm-all': ([('menu', "            if (P.canDrill() && drillable) {\n", "            if (P.canDrill()) {\n")], ['L-pdyear-formulaNone'], ['pdyear']),
    # the compare note loses its "before it"
    'n-note': ([('main', "' with the ' + W + (down ? ' above it' : ' before it') + ', '", "' with the ' + W + ', '")], ['L-pdyear-chg', 'L-pddown-chgDown'], ['pdyear', 'pddown']),
    # the base drill drifts: a table's markup; the corner's title
    # (a markup-only drift such as an HTML comment never shows: the dialog's content goes through DOMPurify)
    'b-drift': ([('main', "            tableHtml += penumbraDrillFooterHtml(lead ? ['#', '\\u0000lead'].concat(drillCols.slice(1)) : drillCols, ds,",
                  "            tableHtml += penumbraDrillFooterHtml(lead ? ['#', '\\u0000lead'].concat(drillCols.slice(1)) : drillCols.slice(0, -1), ds,")], ['B-same'], ['pdbase']),
    'b-gt': ([('main', "            titleParts.push('Grand Total');\n        }\n\n        var matchingRows = sourceData.filter(", "        }\n\n        var matchingRows = sourceData.filter(")],
             ['B-same'], ['pdbase']),
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
        'css': os.path.join('css', 'main.css'), 'index': 'index.php'}
cand = {k: pick(v) for k, v in RELS.items()}
live = {k: os.path.join(APP, v) for k, v in RELS.items()}
if control: cand = dict(live)
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
    out = out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
    # every notice, for the checks (a toast may have no dock in the harness)
    st = '    function show_text(text, duration = 8000, opts) {'
    if out.count(st) != 1: raise SystemExit('show_text anchor count %d' % out.count(st))
    return out.replace(st, st + '\n        (window.__HC_TOASTS = window.__HC_TOASTS || []).push(String(text));')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == 1: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found once: %r" % (name, f, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

stage = tempfile.mkdtemp(prefix='pnb_pd_')
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

DLG = {}
def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        if s == 'pdbase': DLG['stage'] = (r.get('info') or {}).get('dlg')
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            # its own info first (info[c], when the scenario keeps one by the check's name), then the notes
            mine = (r.get('info') or {}).get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   notes %s   info %s' % (r.get('notes'), json.dumps(mine if mine is not None else r.get('info'))[:900])) if v is not True else '')))
    return out

# B-same: the base cells' breakdowns against the live page's (pdbase, run on live once)
def live_dlg():
    if 'live' not in DLG:
        write_stage({k: read_b(v) for k, v in live.items()})
        r = run_page('harness.html?scn=pdbase')
        DLG['live'] = (r.get('info') or {}).get('dlg')
    return DLG['live']
def b_same():
    a, b = DLG.get('live'), DLG.get('stage')
    ok = bool(a) and bool(b) and len(a) == len(b) and all(x == y for x, y in zip(a, b)) and all(x.get('body') for x in a)
    why = ''
    if not ok and a and b:
        for x, y in zip(a, b):
            if x != y:
                for f in ('title', 'head', 'body', 'added', 'found'):
                    if x.get(f) != y.get(f):
                        xs, ys = str(x.get(f)), str(y.get(f))
                        k = next((i for i in range(min(len(xs), len(ys))) if xs[i] != ys[i]), min(len(xs), len(ys)))
                        why = '%s.%s differs at %d: live %r / stage %r' % (x.get('k'), f, k, xs[max(0, k - 40):k + 80], ys[max(0, k - 40):k + 80])
                        break
                break
    return ('B-same', ok, 'dialogs %s' % (len(a or [])) if ok else why or 'live %s stage %s' % (bool(a), bool(b)))

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    live_dlg()
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            mt = mutate(texts, m)
            write_stage(mt)
            DLG.pop('stage', None)
            res = run_browser(scns)
            if 'pdbase' in scns: res.append(b_same())
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if 'pdbase' in SCN: res.append(b_same())
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:900]))
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
