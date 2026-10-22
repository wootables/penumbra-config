# =============================================================================
# CFPERF SUITE (2026-10-21) - three sources of wasted work out of js/main.js, nothing styled
# differently: resetCellStates restores cell CONTENT only after a rewrite() / sparkline_cell()
# wrote (styles still reset, unstyled rows and cells skipped); the pivot is built ONCE on load,
# search, clear and Generate (the snippet's rules taken before the build, a render whose rules
# match builds nothing again); a highlight-only format pass reads no cells in its reset pass.
# The REAL main.js (ready closure kept), js/penumbra_colmenu.js and js/penumbra_colfmt.js on
# the pvfix harness (mk_harness.py; pvfix / pivmenu / pvshade files are read, never written).
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_cfp_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['cffmt', 'cfrw', 'cfhl', 'gcf', 'pcf', 'pcftxt']
CHK = {
    'cffmt': ['loadStyled', 'hdr', 'searchNoRestore', 'searchStyled', 'clearNoRestore', 'clearStyled', 'contentSame', 'hiddenClean', 'origBg', 'page2Styled'],
    'cfrw': ['rwShown', 'rwFmt', 'rwRestores', 'rwShownAfter', 'rwToFmt', 'rwToFmtStyled', 'fmtOnlyNoRestore', 'fmtOnlyPlain'],
    'cfhl': ['hlLoaded', 'hlOneRead', 'hlPassStyled', 'hlStaleOff', 'hlStaleStyled', 'hlPage2'],
    'gcf': ['gStyled', 'gNoRestore', 'gSearchStyled', 'gClearStyled'],
    'pcf': ['pvOneBuild', 'pvStyled', 'pvHdr', 'pvSort', 'pvBar', 'pvSearchOneBuild', 'pvSearchStyled', 'pvSearchSort', 'pvClearOneBuild', 'pvClearStyled',
            'pvGenOneBuild', 'pvGenStyled', 'pvGenHdr', 'pvGenBar', 'pvGenStale', 'pvSigMismatch', 'pvSigMatch', 'pvSigStyled'],
    'pcftxt': ['txtShown', 'txtGenOneBuild', 'txtGenStyled'],
}
# this round's checks: red on live (136ab7d) - the rest guard what live already does
NEW = {'L-cffmt-searchNoRestore', 'L-cffmt-clearNoRestore', 'L-gcf-gNoRestore', 'L-cfrw-fmtOnlyNoRestore', 'L-cfhl-hlOneRead',
       'L-pcf-pvOneBuild', 'L-pcf-pvSearchOneBuild', 'L-pcf-pvClearOneBuild', 'L-pcf-pvGenOneBuild', 'L-pcf-pvSigMatch'}
SIG_LINE = "                || (opts.pivotRulesSig && opts.pivotRulesSig === _pnbRulesSig(localConditionalRules, localRewriteRules))));\n"
MUTANTS = {
    # --- resetCellStates: the content restore only after a rewrite
    # a rewrite never says so: no restore after it, nor when the snippet drops it
    'rf-noflag': ([('main', "            _pnbCellsRewritten = true;   // what resetCellStates restores\n", "")], ['L-cfrw-rwRestores', 'L-cfrw-rwToFmt'], ['cfrw']),
    # every reset restores again (the old way)
    'rf-always': ([('main', "        const _rcsRestore = _pnbCellsRewritten;\n", "        const _rcsRestore = true;\n")],
                  ['L-cffmt-searchNoRestore', 'L-cffmt-clearNoRestore', 'L-gcf-gNoRestore', 'L-cfrw-fmtOnlyNoRestore'], ['cffmt', 'gcf', 'cfrw']),
    # the restore never clears the flag: every reset after one rewrite restores
    'rf-noclear': ([('main', "        _pnbCellsRewritten = false;\n        const _rcsUpperToRaw = {};\n", "        const _rcsUpperToRaw = {};\n")], ['L-cfrw-fmtOnlyNoRestore'], ['cfrw']),
    # the row pass skips every row / never sees an 'original-bg'
    'rr-skipall': ([('main', "            if (!(_rrs && _rrs.length !== 0 && !(_rrs.length === 1 && _rrs.display))\n", "            if (true || !(_rrs && _rrs.length !== 0 && !(_rrs.length === 1 && _rrs.display))\n")],
                   ['L-cffmt-hiddenClean', 'L-cffmt-origBg'], ['cffmt']),
    'rr-noorig': ([('main', "\n                && !_rrow.hasAttribute('data-original-bg') && !$.data(_rrow, 'original-bg')) continue;\n", ") continue;\n")], ['L-cffmt-origBg'], ['cffmt']),
    # the cell pass skips every cell
    'cs-noattr': ([('main', "                    if (!cell.hasAttribute('style')) continue;\n", "                    continue;\n")], ['L-cffmt-hiddenClean'], ['cffmt']),
    # --- the format pass with nothing to test
    # the reads come back
    'fp-nogate': ([('main', "            if (!applyOnly && !activeRules.some(function (r) { return r.type === 'row' || r.type === 'cell'; })) {\n", "            if (false) {\n")],
                  ['L-cfhl-hlOneRead'], ['cfhl']),
    # ...or the old styles stay on
    'fp-noreset': ([('main', "                for (let _rsi = 0; _rsi < $rows.length; _rsi++) _pnbCfResetRow($rows[_rsi]);\n", "")], ['L-cfhl-hlStaleOff'], ['cfhl']),
    # --- the pivot's second build
    'pv-searchregen': ([('main', "                await renderReportSnippet(dataToProcess, false, { noPivotRegen: true });\n", "                await renderReportSnippet(dataToProcess);\n")],
                       ['L-pcf-pvSearchOneBuild', 'L-pcf-pvClearOneBuild'], ['pcf']),
    'pv-loadnofirst': ([('main', "                                    const _pvRulesFirst = _pnbPivotRulesFirst(settings);\n", "                                    const _pvRulesFirst = null;\n")], ['L-pcf-pvOneBuild'], ['pcf']),
    # the rules worked out but not handed to the build: the render, finding them alike, leaves it bare.
    # (Not pvHdr: the saved density's switch render, between the build and the load tail, hands the
    # tail its header rules - it never rebuilds the pivot, so the CELLS stay bare. Traced 2026-10-21.)
    'pv-loadnoassign': ([('main', "                                    if (_pvRulesFirst) { conditionalFormattingRules = _pvRulesFirst.cf; rewriteRules = _pvRulesFirst.rw; }\n                                    const pivotData = processPivotData(masterRowData",
                          "                                    const pivotData = processPivotData(masterRowData")], ['L-pcf-pvStyled'], ['pcf']),
    'pv-gennofirst': ([('main', "                        _pvRulesFirst = _pnbPivotRulesFirst(currentPivotSettings);\n", "                        _pvRulesFirst = null;\n")], ['L-pcf-pvGenOneBuild'], ['pcf']),
    'pv-gennoassign': ([('main', "                        _pvRulesFirst = _pnbPivotRulesFirst(currentPivotSettings);\n                        if (_pvRulesFirst) { conditionalFormattingRules = _pvRulesFirst.cf; rewriteRules = _pvRulesFirst.rw; }\n",
                         "                        _pvRulesFirst = _pnbPivotRulesFirst(currentPivotSettings);\n")], ['L-pcf-pvGenStale'], ['pcf']),
    # any rules given count as the pivot's / none ever do
    'pv-sigalways': ([('main', SIG_LINE, "                || opts.pivotRulesSig));\n")], ['L-pcf-pvSigMismatch'], ['pcf']),
    'pv-signever': ([('main', SIG_LINE, "                || false));\n")], ['L-pcf-pvSigMatch', 'L-pcf-pvOneBuild', 'L-pcf-pvGenOneBuild'], ['pcf']),
    # the rules read first not as the render reads them: comments kept, the pivot's labels missing
    'pp-noblock': ([('main', "            snippetText = snippetText.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n            snippetText = snippetText.replace(/((?:'",
                     "            snippetText = snippetText.replace(/((?:'")], ['L-pcf-pvOneBuild'], ['pcf']),
    'pp-noline': ([('main', "            snippetText = snippetText.replace(/((?:'[^']*'|\"[^\"]*\"|\\/\\/[^\\/\\n]*\\/\\/))|\\/\\/.*$/gm, (match, quoted) => quoted ? quoted : '');\n            if (/\\[\\s*PROMPT/i",
                    "            if (/\\[\\s*PROMPT/i")], ['L-pcf-pvOneBuild'], ['pcf']),
    'pp-cols': ([('main', "            if (pvSettings) {\n                const _aggToks", "            if (false) {\n                const _aggToks")], ['L-pcf-pvOneBuild'], ['pcf']),
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
check_anchors = flag('--check-anchors')
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
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

# counted functions: calls (window.__CNT.<name>); content writes made inside resetCellStates
# (rcsWrites); cell reads made inside applyConditionalFormatting (acfReads)
COUNT = ['generatePivotTable', 'resetCellStates', '_pnbWriteCell', '_readComparisonCellText', 'applyConditionalFormatting', 'renderReportSnippet']
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    # the READY closure stays one (as on the page it then runs after penumbra_colfmt.js,
    # which the report's highlight rules are read through at the state load)
    inj = ('\r\n;window.__CNT = {}; window.__CNTX = { rcs: 0, acf: 0 };\r\n'
           'window.__HC = { rules: function () { return { cf: conditionalFormattingRules, rw: rewriteRules }; },\r\n'
           '  setRules: function (cf, rw) { conditionalFormattingRules = cf; rewriteRules = rw; },\r\n'
           '  sort: function () { return sortCriteria; },\r\n'
           '  editor: function () { return snippetEditor; },\r\n'
           '  render: function (a, b, c) { return renderReportSnippet(a, b, c); },\r\n'
           '  acf: function (a, b) { return applyConditionalFormatting(a, b); },\r\n'
           '  rcs: function () { return resetCellStates(); },\r\n'
           '  runSearch: function () { return runTableSearch(); },\r\n'
           '  sig: function () { return (typeof _pnbRulesSig === "function") ? _pnbRulesSig(conditionalFormattingRules, rewriteRules) : null; } };\r\n')
    out = src[:i] + anchor + inj + src[i + len(anchor):]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    out = out.replace(hl, hl + '\r\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
    for name in COUNT:
        pat = re.compile(r'(?m)^([ \t]*)(async )?function ' + re.escape(name) + r'\(')
        m = list(pat.finditer(out))
        if len(m) != 1: raise SystemExit('count %s: %d definitions' % (name, len(m)))
        ind, asy = m[0].group(1), m[0].group(2) or ''
        pre = 'var __C = window.__CNT; __C.%s = (__C.%s || 0) + 1;' % (name, name)
        if name == 'resetCellStates':
            body = pre + ' window.__CNTX.rcs++; try { return __o_%s.apply(this, arguments); } finally { window.__CNTX.rcs--; }' % name
        elif name == 'applyConditionalFormatting':
            body = pre + ' window.__CNTX.acf++; try { return __o_%s.apply(this, arguments); } finally { window.__CNTX.acf--; }' % name
        elif name == '_pnbWriteCell':
            body = pre + ' if (window.__CNTX.rcs > 0) __C.rcsWrites = (__C.rcsWrites || 0) + 1; return __o_%s.apply(this, arguments);' % name
        elif name == '_readComparisonCellText':
            body = pre + ' if (window.__CNTX.acf > 0) __C.acfReads = (__C.acfReads || 0) + 1; return __o_%s.apply(this, arguments);' % name
        elif asy:
            body = pre + ' return await __o_%s.apply(this, arguments);' % name
        else:
            body = pre + ' return __o_%s.apply(this, arguments);' % name
        w = '%sfunction %s() { %s }' % (asy, name, body)
        s, e = m[0].span()
        out = out[:s] + ind + w + '\r\n' + ind + asy + 'function __o_' + name + '(' + out[e:]
    return out
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == 1: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found once: %r" % (name, f, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

if check_anchors:
    texts = {k: read_b(v) for k, v in cand.items()}
    bad = 0
    for m in MUTANTS:
        try: mutate(texts, m); print('  ok   %s' % m)
        except SystemExit as e: bad += 1; print('  BAD  %s' % e)
    print('RESULT: GREEN' if not bad else 'RESULT: RED')
    sys.exit(0)

stage = tempfile.mkdtemp(prefix='pnb_cfp_')
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
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s   notes %s' % (json.dumps(r.get('info'))[:900], r.get('notes'))) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            mt = mutate(texts, m)
            write_stage(mt)
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            fatal = [a for a in red if a.startswith('F-')]
            # a crashed scenario is no kill
            good = not fatal and not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-16s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:1100]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW]
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
