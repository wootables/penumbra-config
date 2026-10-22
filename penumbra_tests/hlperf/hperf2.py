# =============================================================================
# hlperf (2026-10-21): is a format() rule in the report's custom code slower or faster
# than the SAME rule saved as a report highlight (column options cog / the pivot's
# Values cog)? Flat table and pivot, LIVE main.js, read-only (a temp stage dir).
#
# Built on bigperf\prof\bprof.py: the find kit's harness (bigperf\harness.html, real
# load path through penumbra_vars.preloadedState), headless Edge over CDP. main.js gets
# timing wrappers around the functions that matter (count + ms of every call).
#
#   py -3 hperf.py [--n 25000] [--runs 3] [--only F0,F1,...] [--label x] [--nowait]
# =============================================================================
import base64, json, os, re, shutil, socket, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/penumbra_tests/bigperf'
LIVE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
APPJS = ['penumbra_a11y.js', 'search_builder.js', 'penumbra_colwidths.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js',
         'penumbra_colfmt.js', 'penumbra_find.js']
CSS = ['main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_cellsel.css', 'penumbra_grouplist.css', 'penumbra_find.css']

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
N = int(opt('--n', '25000'))
RUNS = int(opt('--runs', '3'))
ONLY = [x for x in (opt('--only', '') or '').split(',') if x]
LABEL = opt('--label', '')
NOWAIT = '--nowait' in args
# (cfperf 2026-10-21) the main.js to measure (default: live) and where the report goes
MAIN = opt('--main', LIVE + '/js/main.js')
OUTDIR = opt('--out', HERE)

CSSRULE = 'background-color: #fde68a; font-weight: bold'
# The same rule, written both ways
CONFIGS = [
    ('F0', 'flat, no rules', {'scn': 'prof'}),
    ('F1', 'flat, format() in custom code', {'scn': 'prof', 'snip': "format(cell, H_AMT, H_AMT > 100, '%s')" % CSSRULE}),
    ('F2', 'flat, report highlight (column cog)', {'scn': 'prof', 'hl': {'H_AMT': [{'id': 'r1', 'w': 'H_AMT > 100', 'css': CSSRULE, 'row': False}]}}),
    ('P0', 'pivot, no rules', {'scn': 'piv_prof'}),
    ('P1', 'pivot, format() in custom code', {'scn': 'piv_prof', 'snip': "format(cell, Amt, Amt > 300, '%s')" % CSSRULE}),
    ('P2', 'pivot, highlight (Values cog)', {'scn': 'piv_prof', 'pvhl': [[{'id': 'p1', 'w': 'Amt > 300', 'css': CSSRULE}]]}),
]
WRAP = ['generatePivotTable', 'processPivotData', 'applyConditionalFormatting', 'resetCellStates', 'applyPagination',
        'applyRewriteRules', 'applyPivotHeaderFormatting']
WRAP_ASYNC = ['renderReportSnippet']
HOOK_NAMES = ['runTableSearch', 'applyPagination', 'applyConditionalFormatting', 'renderReportSnippet']

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def patch_main(text):
    anchor = '$(document).ready(function () {'
    i = text.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in HOOK_NAMES) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n'
         'window.__HC.rules = function () { return { cf: conditionalFormattingRules.length, hl: Object.keys(reportColumnHighlights).length, pvhl: !!(currentPivotSettings && currentPivotSettings.aggHighlight) }; };\r\n')
    # main.js's ready closure stays a READY closure (bprof runs it at once): as on the real
    # page it then runs after every later script - penumbra_colfmt.js included, which the
    # report's highlight rules are read through at the state load
    out = text[:i] + anchor + h + text[i + len(anchor):]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    out = out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
    for name in WRAP + WRAP_ASYNC:
        is_async = name in WRAP_ASYNC
        pat = re.compile(r'(?m)^([ \t]*)' + ('async ' if is_async else '') + r'function ' + name + r'\(')
        m = list(pat.finditer(out))
        if len(m) != 1: raise SystemExit('wrap %s: %d definitions' % (name, len(m)))
        ind = m[0].group(1)
        if is_async:
            w = ('async function %s() { var __t = performance.now(); try { return await __o_%s.apply(this, arguments); } finally { window.__pt("%s", __t); } }'
                 % (name, name, name))
            repl = 'async function __o_' + name + '('
        else:
            w = ('function %s() { var __t = performance.now(); try { return __o_%s.apply(this, arguments); } finally { window.__pt("%s", __t); } }'
                 % (name, name, name))
            repl = 'function __o_' + name + '('
        s, e = m[0].span()
        out = out[:s] + ind + w + '\r\n' + ind + repl + out[e:]
    pt = ('window.__pt = function (n, t) { var d = performance.now() - t, P = window.__PT = window.__PT || {}, e = P[n] = P[n] || { n: 0, ms: 0, each: [] };'
          ' e.n++; e.ms += d; if (e.each.length < 30) e.each.push(Math.round(d)); };\r\n')
    return pt + out

def patch_harness(text):
    old = "var N = /^big/.test(S) ? 3000 : (S === 'prof' ? (+P.get('n') || 25000) : (/^bp_/.test(S) ? (+P.get('n') || 3000) : 300));"
    if text.count(old) != 1: raise SystemExit('harness N anchor')
    text = text.replace(old, "var N = +P.get('n') || 300;")
    old2 = '    window.__STORED = st;\n'
    if text.count(old2) != 1:
        old2 = '    window.__STORED = st;\r\n'
        if text.count(old2) != 1: raise SystemExit('harness __STORED anchor')
    add = ("    function __b64(s) { return decodeURIComponent(escape(atob(s))); }\n"
           "    if (P.get('snip')) st.reportSnippet = __b64(P.get('snip'));\n"
           "    if (P.get('hl')) st.columnHighlights = JSON.parse(__b64(P.get('hl')));\n"
           "    if (st.pivot && P.get('pvrows')) st.pivot.rows = P.get('pvrows').split(',');\n"
           "    if (st.pivot && P.get('pvhl')) st.pivot.aggHighlight = JSON.parse(__b64(P.get('pvhl')));\n")
    text = text.replace(old2, old2 + add)
    # the pivot scenario shows the same 18 columns as prof
    old3 = "if (S === 'prof' || /^bp_/.test(S)) st.visibleColumns"
    if text.count(old3) != 1: raise SystemExit('harness visibleColumns anchor')
    text = text.replace(old3, "if (S === 'prof' || S === 'piv_prof' || /^bp_/.test(S)) st.visibleColumns")
    return text

def patch_driver(text):
    a = '    prof: async function () {'
    if text.count(a) != 1: raise SystemExit('driver prof anchor')
    return text.replace(a, "    piv_prof: async function () { R.info.prof = { pivotCells: document.querySelectorAll('#pivotResultTable tbody td').length }; },\n" + a)

def b64(o):
    s = o if isinstance(o, str) else json.dumps(o)
    return urllib.parse.quote(base64.b64encode(s.encode('utf-8')).decode('ascii'), safe='')

def other_headless():
    ps = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -match '--headless' -and "
          "$_.CommandLine -notmatch '--type=' -and $_.CommandLine -notmatch 'pnb_hperf_' -and "
          # an hour-old one is a hung leftover (an idle --dump-dom), not a suite running now
          "$_.CreationDate -gt (Get-Date).AddMinutes(-60) } | Measure-Object | Select-Object -ExpandProperty Count")
    try:
        r = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60)
        return int((r.stdout or '0').strip() or '0')
    except Exception:
        return 0

def wait_idle(say, cap=900):
    if NOWAIT: return
    t = time.time(); quiet = 0
    while time.time() - t < cap:
        n = other_headless()
        quiet = quiet + 1 if n == 0 else 0
        if quiet >= 2: return
        time.sleep(5)
    say('  (another headless Edge still running after %d s: measuring beside it)' % cap)

SETTLE = ("await new Promise(function (r) { setTimeout(r, 800); });"
          " await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });")
def search(q):
    return ("var b = document.getElementById('tableSearch'); b.focus(); b.value = %s;"
            " try { $(b).autocomplete('close'); } catch (e) { }"
            " var h0 = window.__HC_HIDES || 0;"
            " b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));"
            " var tw = performance.now(); while ((window.__HC_HIDES || 0) === h0 && performance.now() - tw < 60000) await new Promise(function (r) { setTimeout(r, 5); });"
            " var ms = Math.round(performance.now() - T0); b.blur(); %s"
            " return { doneMs: ms, count: (document.getElementById('resultCount') || {}).textContent };" % (json.dumps(q), SETTLE))
PAGE = ("var b = document.getElementById('%s'); var t = performance.now(); b.click(); var ms = Math.round(performance.now() - t); " + SETTLE +
        " return { syncMs: ms, page: (document.getElementById('pageInfo') || {}).textContent };")
ACF = ("var ms = []; for (var k = 0; k < 5; k++) { var t = performance.now(); window.__HC.applyConditionalFormatting(true); ms.push(performance.now() - t); }"
       " ms.sort(function (a, b) { return a - b; }); return { med: Math.round(ms[2]), all: ms.map(Math.round) };")
STYLED = ("var c = 0, k = { body: 0, summary: 0, gt: 0, foot: 0, flat: 0 }; [].forEach.call(document.querySelectorAll('#resultsTable tbody td, #pivotResultTable td'), function (td) {"
          " if (!/#fde68a|253, 230, 138/i.test(td.getAttribute('style') || '')) return; c++;"
          " if (!td.closest('#pivotResultTable')) k.flat++; else if (td.closest('tfoot')) k.foot++; else if (td.hasAttribute('data-grand-total') || td.classList.contains('pivot-grand-total')) k.gt++;"
          " else if (td.parentNode.hasAttribute('data-pivot-group-summary')) k.summary++; else k.body++; });"
          " return { styledCells: c, kinds: k };")
FLAT_ACTIONS = [('styled', STYLED), ('page_next', PAGE % 'nextPageBtn'), ('page_next2', PAGE % 'nextPageBtn'), ('page_first', PAGE % 'firstPageBtn'),
                ('acf_direct_x5', ACF), ('search_kilo', search('kilo')), ('search_clear', search(''))]
SNIPOUT = ("var o = document.getElementById('reportSnippetOutput'); var h = o ? o.innerHTML : null;"
           " return { blank: h !== null && h.trim() === '', len: h === null ? -1 : h.length, head: h === null ? null : h.slice(0, 120) };")
PIV_ACTIONS = [('snipout', SNIPOUT), ('styled', STYLED), ('pv_search_open', search('Open')), ('pv_search_clear', search(''))]

def main():
    stage = tempfile.mkdtemp(prefix='pnb_hperf_')
    for f in LIBS: shutil.copyfile(os.path.join(LIVE, 'js', f), os.path.join(stage, f))
    for f in APPJS: shutil.copyfile(os.path.join(LIVE, 'js', f), os.path.join(stage, f))
    for f in CSS: shutil.copyfile(os.path.join(LIVE, 'css', f), os.path.join(stage, f))
    open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
    open(os.path.join(stage, 'harness.html'), 'wb').write(patch_harness(read_b(os.path.join(KIT, 'harness.html'))).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'driver.js'), 'wb').write(patch_driver(read_b(os.path.join(KIT, 'driver.js'))).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(patch_main(read_b(MAIN)).encode('utf-8', 'surrogateescape'))
    lines = []
    def say(s=''):
        print(s); sys.stdout.flush(); lines.append(s)
    import hashlib
    say('hperf %s  n=%d  runs=%d  main.js %s mtime %s sha %s' % (time.strftime('%Y-%m-%d %H:%M:%S'), N, RUNS, MAIN,
        time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(MAIN))), hashlib.sha256(open(MAIN, 'rb').read()).hexdigest()[:12]))
    res = {}
    try:
        for run in range(RUNS):
            for key, desc, cfg in CONFIGS:
                if ONLY and key not in ONLY: continue
                wait_idle(say)
                one(stage, key, desc, cfg, run, say, res)
    finally:
        say('')
        say('=== MEDIANS over %d runs' % RUNS)
        for key, desc, cfg in CONFIGS:
            rs = res.get(key)
            if not rs: continue
            say('%s  %s' % (key, desc))
            names = []
            for r in rs:
                for k in r:
                    if k not in names: names.append(k)
            for k in names:
                vals = [r[k] for r in rs if k in r]
                say('    %-44s %8.0f   runs: %s' % (k, statistics.median(vals), ' | '.join('%.0f' % v for v in vals)))
        stamp = time.strftime('%Y%m%d_%H%M%S')
        try: open(os.path.join(OUTDIR, 'out_%s%s.txt' % (stamp, ('_' + LABEL) if LABEL else '')), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        except Exception as e: print('could not write the report: %s' % e)
        time.sleep(1)
        shutil.rmtree(stage, ignore_errors=True)

def one(stage, key, desc, cfg, run, say, res):
    def free_port():
        s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
    hp, dp = free_port(), free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=stage)
    prof_dir = os.path.join(stage, 'p_%s_%d' % (key, run))
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                             '--disable-sync', '--disable-extensions', '--user-data-dir=' + prof_dir,
                             '--window-size=1500,900', '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=stage)
    try:
        def jget(p, m='GET'):
            return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
        for _ in range(150):
            try: jget('/json/version'); break
            except Exception: time.sleep(0.2)
        t = jget('/json/new?about:blank', 'PUT')
        ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=900, suppress_origin=True)
        n = [0]
        def call(m, p=None):
            n[0] += 1; mid = n[0]
            ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get('id') == mid:
                    if 'error' in r: raise RuntimeError('%s: %s' % (m, r['error']))
                    return r.get('result', {})
        def ev(expr, wait=True):
            r = call('Runtime.evaluate', {'expression': expr, 'awaitPromise': wait, 'returnByValue': True})
            if r.get('exceptionDetails'): return {'exception': json.dumps(r['exceptionDetails'])[:600]}
            return r.get('result', {}).get('value')
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        q = 'scn=%s&n=%d' % (cfg['scn'], N)
        if cfg['scn'] == 'piv_prof': q += '&pvrows=H_GROUP,H_CODE'
        for k in ('snip', 'hl', 'pvhl'):
            if k in cfg: q += '&%s=%s' % (k, b64(cfg[k]))
        t0 = time.time()
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?%s' % (hp, q)})
        v = None
        while time.time() - t0 < 900:
            time.sleep(0.25)
            v = ev('window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', False)
            if v: break
        boot = time.time() - t0
        r0 = json.loads(v or '{}')
        pt = json.loads(ev('JSON.stringify(window.__PT || {})', False) or '{}')
        rules = ev('JSON.stringify(window.__HC.rules ? window.__HC.rules() : null)', False)
        say('')
        say('##### %s run %d: %s   boot %.1f s  info=%s errors=%s fatal=%s missing=%s rules=%s' % (
            key, run + 1, desc, boot, json.dumps(r0.get('info')), r0.get('errors'), (r0.get('fatal') or '')[:300], r0.get('missing'), rules))
        rec = res.setdefault(key, [])
        mine = {'load: boot wall ms': boot * 1000}
        say('  LOAD  ' + '  '.join('%s %dx %.0fms %s' % (k, e['n'], e['ms'], e['each'][:6]) for k, e in sorted(pt.items())))
        for k, e in pt.items():
            mine['load: %s ms (%s)' % (k, 'calls=%d' % e['n'])] = e['ms']
        ev("window.__lt = []; new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__lt.push(e.duration); }); }).observe({ type: 'longtask', buffered: false }); 1", False)
        acts = PIV_ACTIONS if cfg['scn'] == 'piv_prof' else FLAT_ACTIONS
        for name, body in acts:
            ev('window.__PT = {}; window.__lt = []; 1', False)
            w0 = time.time()
            out = ev('(async function () { var T0 = performance.now(); ' + body + ' })()')
            wall = (time.time() - w0) * 1000
            pt = json.loads(ev('JSON.stringify(window.__PT || {})', False) or '{}')
            lt = json.loads(ev('JSON.stringify(window.__lt || [])', False) or '[]')
            say('  %-15s wall %6.0f  long tasks %d sum %.0f max %.0f  -> %s' % (name, wall, len(lt), sum(lt), max(lt or [0]), json.dumps(out)[:160]))
            if pt: say('                  ' + '  '.join('%s %dx %.0fms %s' % (k, e['n'], e['ms'], e['each'][:6]) for k, e in sorted(pt.items())))
            if name == 'styled':
                mine['styled cells'] = (out or {}).get('styledCells', -1)
                for kk, vv in ((out or {}).get('kinds') or {}).items():
                    if vv: mine['styled cells: %s' % kk] = vv
                continue
            mine['%s: long tasks sum ms' % name] = sum(lt)
            if isinstance(out, dict) and 'doneMs' in out: mine['%s: done ms' % name] = out['doneMs']
            elif isinstance(out, dict) and 'syncMs' in out: mine['%s: sync ms' % name] = out['syncMs']
            elif isinstance(out, dict) and 'med' in out: mine['%s: median ms' % name] = out['med']
            for k, e in pt.items():
                mine['%s: %s ms (calls=%d)' % (name, k, e['n'])] = e['ms']
        rec.append(mine)
    finally:
        try: edge.kill()
        except Exception: pass
        try: srv.kill()
        except Exception: pass

if __name__ == '__main__':
    main()
