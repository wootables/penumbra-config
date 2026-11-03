# =============================================================================
# BDHL SUITE (2026-11-02, "bdhl") - the report's format() rules and the viewer's highlight rules reach the
# breakdown tables (a pivot cell's, a chart point's): row and cell rules, a rule on a column the breakdown
# does not show (from the row's source row), a report highlight rule (and Off for me), the viewer's own;
# no heat; the cells keep their own borders; a sort moves the styles with the rows; a no-rows line is
# never styled. Each row is held against the fixture by V_ID (driver.js).
# The REAL main.js + js/penumbra_colfmt.js on the pivmenu harness (mk_harness.py; pivmenu's files are
# read, never written).
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_bh_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['pbh', 'pbhoff', 'pbhnone', 'pbhui', 'pbhfmt']
CHK = {
    'pbh': ['mainLazy', 'attrs', 'rowFlag', 'cellNum', 'rowNot', 'viewerHl', 'reportHl', 'noHeat', 'border', 'sorted',
            'chartAttrs', 'chartFlag', 'chartCell', 'chartRep', 'emptyClean'],
    'pbhoff': ['reportOff', 'viewerOn'],
    'pbhnone': ['clean'],
    'pbhfmt': ['fmtItem', 'fmtNotText', 'fmtOnly', 'fmtChange', 'totChange', 'totCents', 'fmtSaved', 'fmtList', 'fmtRules', 'fmtReset', 'totReset', 'fmtDate2', 'fmtKbd', 'fmtBack'],
    'pbhui': ['fmtDate', 'fmtAmt', 'fmtTotal', 'menuItem', 'popOpen', 'kbdFocus', 'escKeeps', 'addRule', 'ruleChange', 'bordersKept', 'backReopens'],
}
# the round's checks: red on live (before bdhl); the rest guard what live already does
# (bdhl 2) round 1 is live: its checks are all old now; round 2's are red on live but the totals
# (bdhl 3) rounds 1 and 2 are live: all their checks are old now
OLD = {'L-%s-%s' % (s, c) for s in ('pbh', 'pbhoff', 'pbhnone', 'pbhui') for c in CHK[s]} | {'L-pbhfmt-fmtNotText'}
# (bdhl 4) round 3 is live: its checks are old; the totals' are new (fmtTotal changed its meaning)
OLD = (OLD | {'L-pbhfmt-%s' % c for c in CHK['pbhfmt']}) - {'L-pbhui-fmtTotal', 'L-pbhfmt-totChange'}   # (a guard: x-text proves it)
NEW = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - OLD
# (2026-11-02, pnt) bdhl 4 is live (434fcd3): every check is old but totCents, the total against the cents added up, and
# totChange (its prediction is the new number text: red on live too)
NEW = {'L-pbhfmt-totCents', 'L-pbhfmt-totChange'}
OLD = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - NEW
# (pnt is LIVE since c5451f9, 2026-11-02: every check is old now)
NEW = set()
OLD = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]}
PIVOT = ['L-pbh-rowFlag', 'L-pbh-cellNum', 'L-pbh-rowNot', 'L-pbh-viewerHl', 'L-pbh-reportHl']
MUTANTS = {
    # (2026-11-02, pnt) the total's number text back to toFixed(12)
    'p-numtext': ([('main', 'var s = (mag >= 1e-6 && mag < 1e14) ? v.toPrecision(15) : mag >= 1e21 ? String(v) : v.toFixed(12);',
                    'var s = mag >= 1e21 ? String(v) : v.toFixed(12);')], ['L-pbhfmt-totCents'], ['pbhfmt']),
    # no breakdown is formatted at all
    'm-open': ([('main', "        penumbraBreakdownFreezeSync();\n        _pnbBdFormat(rows);\n", "        penumbraBreakdownFreezeSync();\n")],
               PIVOT + ['L-pbh-chartFlag', 'L-pbhoff-viewerOn'], ['pbh', 'pbhoff']),
    # the headers carry no column name (both builders)
    # (bdhl 4) the totals without the column: when built; when worked out again; not worked out again after Format...
    't-build': ([('main', "                    col: col   // (bdhl 4) in the column's format, as the report's totals", "                    nocol: col")],
                ['L-pbhui-fmtTotal'], ['pbhui']),
    't-badge': ([('main', "                    col: col   // (bdhl 4) in the column's format\n", "                    nocol: col\n")],
                ['L-pbhfmt-totChange'], ['pbhfmt']),
    't-refresh': ([('main', "        penumbraRefreshDrillFooters();   // (bdhl 4) and their totals, in the new format", "")],
                  ['L-pbhfmt-totChange'], ['pbhfmt']),
    'm-attr': ([('main', "(col !== '#' ? ' data-pnb-bd-col=\"' + escapeHtml(col) + '\"' : '')", "('')", 2)],
               ['L-pbh-attrs', 'L-pbh-chartAttrs', 'L-pbh-cellNum', 'L-pbh-viewerHl', 'L-pbh-reportHl', 'L-pbh-chartCell'], ['pbh']),
    # a breakdown's column id is the main table's (none): every cell rule misses
    'm-colid': ([('main', "const colId = bdTable ? colName : $(this).data('column');", "const colId = $(this).data('column');")],
                ['L-pbh-cellNum', 'L-pbh-viewerHl', 'L-pbh-reportHl', 'L-pbh-chartCell'], ['pbh']),
    # a pivot on screen still stops the pass
    'm-pivot': ([('main', "        if (!bdTable && $('#pivot-output-container').is(':visible')) {", "        if ($('#pivot-output-container').is(':visible')) {")],
                PIVOT, ['pbh']),
    # the pivot builder / the chart builder hands over no source rows: a hidden column's rules miss
    'm-pvsrc': ([('main', "        penumbraBreakdownOpened(matchingRows);\n\n        // Cache original row order", "        penumbraBreakdownOpened();\n\n        // Cache original row order")],
                ['L-pbh-rowFlag', 'L-pbh-cellNum', 'L-pbh-viewerHl', 'L-pbh-sorted'], ['pbh']),
    'm-chsrc': ([('main', "        penumbraBreakdownOpened(matchingRows);\n\n        setTimeout(function () {", "        penumbraBreakdownOpened();\n\n        setTimeout(function () {")],
                ['L-pbh-chartFlag', 'L-pbh-chartCell'], ['pbh']),
    # the source rows handed over but never read
    'm-fill': ([('main', "                    if (_bdEl) _bdFill(rowDataMap, rowEl.__pnbBdSrc);", "                    if (false) _bdFill(rowDataMap, rowEl.__pnbBdSrc);")],
               ['L-pbh-rowFlag', 'L-pbh-cellNum', 'L-pbh-chartFlag'], ['pbh']),
    # a breakdown's pass fills the report table's lazy cells: the heat's columns; the rules' columns
    'm-heat': ([('main', "        const heatRules = bdTable ? [] : conditionalFormattingRules.filter(", "        const heatRules = conditionalFormattingRules.filter(")],
               ['L-pbh-mainLazy'], ['pbh']),
    'm-lazy':([('main', "            if (_pnbLazyCols.size && !bdTable) {", "            if (_pnbLazyCols.size) {")],
               ['L-pbh-mainLazy'], ['pbh']),
    # the row reset run on a breakdown: its cells lose their borders
    'm-reset': ([('main', "                if (!applyOnly && !bdTable) _pnbCfResetRow(rowEl);", "                if (!applyOnly) _pnbCfResetRow(rowEl);")],
                ['L-pbh-border'], ['pbh']),
    # the no-rows line read as a row
    'm-norows': ([('main', ".filter(function () { return !this.querySelector(':scope > td[colspan]'); })   // (bdhl) not its no-rows line", "   // (bdhl) not its no-rows line")],
                 ['L-pbh-emptyClean'], ['pbh']),
    # (bdhl 2) the cells as built (no format); the format shown but no value kept under it
    'f-cell': ([('main', "                    var bdc = _pnbBdCell(col, rowMap.get(col), displayVal, bdRo);", "                    var bdc = { html: displayVal, attr: '' };", 2)],
               ['L-pbhui-fmtDate', 'L-pbhui-fmtAmt'], ['pbhui']),
    'f-raw': ([('main', "attr: ' data-pnb-raw=\"' + escapeHtml(String(raw)) + '\"' };", "attr: '' };")],
              ['L-pbhui-fmtDate', 'L-pbhui-fmtAmt'], ['pbhui']),
    # a rule changed: an open breakdown not drawn again; drawn again over its old styles
    'r-redraw': ([('main', "        _pnbBdFormat(null, true);   // (bdhl 2) an open breakdown too\n", "")],
                 ['L-pbhui-addRule'], ['pbhui']),
    'r-restore': ([('main', "                    else if (el.__pnbBdCss === null) el.removeAttribute('style');\n                    else el.setAttribute('style', el.__pnbBdCss);\n", "")],
                  ['L-pbhui-ruleChange'], ['pbhui']),
    # the menu: no Highlight...; its Back reopens nothing
    'm-item': ([('menu', "        if (bcol && A && typeof A.openColHighlight === 'function'", "        if (false && bcol && A && typeof A.openColHighlight === 'function'")],
               ['L-pbhui-menuItem', 'L-pbhui-popOpen', 'L-pbhui-addRule'], ['pbhui']),
    # the keyboard's open read when the item runs (the menu already closed): the editor never takes the focus
    'm-kbd': ([('menu', "bkbd = !!(cur && cur.kbd);", "bkbd = false;")],
              ['L-pbhui-kbdFocus'], ['pbhui']),
    # (bdhl 3) no Format...; offered on a text column too; the whole editor, not the format alone; a change not
    # written into an open breakdown; Reset doing nothing; Back reopening nothing
    'x-item': ([('menu', "var bfmt = bcol && A && typeof A.openColFormat === 'function'", "var bfmt = false && bcol && A && typeof A.openColFormat === 'function'")],
               ['L-pbhfmt-fmtItem', 'L-pbhfmt-fmtChange'], ['pbhfmt']),
    'x-text': ([('menu', "typeof A.canFormat === 'function' && A.canFormat(bcol);", "true;")],
               ['L-pbhfmt-fmtNotText'], ['pbhfmt']),
    'x-only': ([('main', "        if (hdr && hdr.only === 'format') {", "        if (false && hdr && hdr.only === 'format') {")],
               ['L-pbhfmt-fmtOnly'], ['pbhfmt']),
    'x-reformat': ([('main', "        if (key === 'format') _pnbBdReformat(col);   // (bdhl 3) an open breakdown's cells of this column too\n", "")],
                   ['L-pbhfmt-fmtChange', 'L-pbhfmt-fmtDate2'], ['pbhfmt']),
    'x-reset': ([('main', "onReset: function () { penumbraSetColOpt(col, 'format', reportColumnFormats[String(col).toUpperCase()] || ''); },", "onReset: function () { },")],
                ['L-pbhfmt-fmtReset'], ['pbhfmt']),
    'x-back': ([('menu', "var bback = function () { if (A.closeColOpts) { A.closeColOpts(); } if (th.isConnected) { openBreakdown(t, t.at ? t.at.x : 0, t.at ? t.at.y : 0, bkbd); } };", "var bback = function () { if (A.closeColOpts) { A.closeColOpts(); } };")],
               ['L-pbhfmt-fmtBack', 'L-pbhui-backReopens'], ['pbhfmt', 'pbhui']),
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
    # the chart point's breakdown and the source rows, for the driver
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;'
                       ' window.__chartDrill = function (rows, t) { _showChartDrillBreakdown(rows, [t || "Point"], [], null); };'
                       ' window.__mrd = function () { return masterRowData; };')
def mutate(texts, name):
    t = dict(texts)
    for e in MUTANTS[name][0]:
        f, old, new = e[:3]; times = e[3] if len(e) > 3 else 1   # (a 4th item: the anchor's expected count, every hit replaced)
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == times: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found %d time(s): %r" % (name, f, times, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

stage = tempfile.mkdtemp(prefix='pnb_bh_')
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

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            mine = (r.get('info') or {}).get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   notes %s   info %s' % (r.get('notes'), json.dumps(mine if mine is not None else r.get('info'))[:900])) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            write_stage(mutate(texts, m))
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
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
