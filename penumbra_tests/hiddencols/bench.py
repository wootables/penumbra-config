# Hidden-columns timing bench (2026-09-30) - the harness behind the numbers in
# README section 5. Headless Edge over CDP (real frames, real style/layout), one
# fresh tab per scenario, the REAL main.js booted by bench_harness.html through
# the real run path on a synthetic result set. Usage:
#   py -3 bench.py <label> <main.js> "<qs1>" ["<qs2>" ...] [--reps N] [--ops] [--profile] [--trace] [--visspy]
#   qs: rows=N&cols=M&vis=K   M columns, the first K shown    &narrow=1  only those K columns exist
#       &html=F  fraction of @@HTML link columns   &json=J  @@JSON columns   &fmt=1  one format() rule
#   --ops      also time search / clear / search on a hidden column / sort / paginate
#   --profile  CPU profile per step, attributed to the nearest main.js function
#   --trace    style/layout events per op      --visspy  who calls jQuery :visible, and when
# Stages into %TEMP% (libs + main.css from the live app); writes %TEMP%\pnb_hc_bench_<label>.json.
# Numbers from 2026-09-30 (2,000 rows x 150 columns, 10 shown, 10% @@HTML):
#   before: load 5.3 s, search 1.5 s, clear 1.7 s, sort 1.4 s;  + one format() rule: 11.9 s / 9.0 s
#   after:  load 1.3 s, search 0.2 s, clear 0.16 s, sort 0.4 s; + one format() rule:  2.2 s / 1.6 s
import json, os, subprocess, sys, time, shutil, socket, urllib.request, tempfile
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']

args = sys.argv[1:]
reps = 1
ops = False
if '--reps' in args:
    k = args.index('--reps'); reps = int(args[k + 1]); del args[k:k + 2]
if '--ops' in args:
    args.remove('--ops'); ops = True
prof_on = False
spy_on = False
if '--visspy' in args:
    args.remove('--visspy'); spy_on = True
trace_on = False
if '--trace' in args:
    args.remove('--trace'); trace_on = True
if '--profile' in args:
    args.remove('--profile'); prof_on = True
if len(args) < 3:
    raise SystemExit(__doc__ or 'usage: py -3 bench.py <label> <main.js> "<qs>" ...')
label, mainjs, scenarios = args[0], args[1], args[2:]

def patch_main(src_path, out_path):
    """The ready closure becomes an IIFE with a name-by-name export hook, and
    hideLoading counts and stamps its calls (the end of a run / search / sort)."""
    b = open(src_path, 'rb').read()
    anchor = b'$(document).ready(function () {'
    i = b.find(anchor)
    if i < 0 or i > 400:
        raise SystemExit('closure anchor not found near the top')
    names = ['runTableSearch', 'applyPagination', 'postColumnToggle', 'updateTotalRow', 'renderReportSnippet',
             'resetCellStates', 'applyConditionalFormatting', 'rebuildGroupedView', 'formatCellContent']
    hook = ('\r\n;try { window.__HP = { master: function () { return masterRowData; } }; } catch (e) { window.__HP_ERR = String(e); }\r\n'
            'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__HP[k] = eval(k); } catch (e) { (window.__HP_MISSING = window.__HP_MISSING || []).push(k); } }); } catch (e) { window.__HP_ERR2 = String(e); }\r\n')
    p = b[:i] + b';(function () {' + hook.encode('utf-8') + b[i + len(anchor):]
    j = p.rfind(b'});')
    p = p[:j] + b'})();' + p[j + 3:]
    hl = b'    function hideLoading() {\r\n'
    if p.count(hl) != 1:
        raise SystemExit('hideLoading anchor count = %d' % p.count(hl))
    p = p.replace(hl, hl + b'        window.__HP_HIDES = (window.__HP_HIDES || 0) + 1; window.__HP_HIDE_T = performance.now();\r\n')
    open(out_path, 'wb').write(p)

WWW = tempfile.mkdtemp(prefix='pnb_hc_bench_')
for f in LIBS:
    shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(WWW, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(WWW, 'main.css'))
shutil.copyfile(os.path.join(HERE, 'bench_harness.html'), os.path.join(WWW, 'harness.html'))
patch_main(mainjs, os.path.join(WWW, 'main_perf.js'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

http_port = free_port()
dbg_port = free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(http_port), '--bind', '127.0.0.1', '--directory', WWW],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
prof = tempfile.mkdtemp(prefix='pnbedge_hc_')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
                         '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                         '--user-data-dir=' + prof, '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dbg_port, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def jget(path, method='GET'):
    req = urllib.request.Request('http://127.0.0.1:%d%s' % (dbg_port, path), method=method)
    return json.loads(urllib.request.urlopen(req, timeout=10).read().decode())

for _ in range(100):
    try:
        jget('/json/version'); break
    except Exception:
        time.sleep(0.2)
for _ in range(50):
    try:
        urllib.request.urlopen('http://127.0.0.1:%d/harness.html' % http_port, timeout=5).read(); break
    except Exception:
        time.sleep(0.2)

class Tab:
    def __init__(self):
        t = jget('/json/new?about:blank', method='PUT')
        self.id = t['id']
        self.ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=900, suppress_origin=True)
        self.n = 0
        self.events = []
        self.collect = False
        self.trace_done = False
    def call(self, method, params=None, timeout=900):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        self.ws.settimeout(timeout)
        while True:
            msg = json.loads(self.ws.recv())
            if self.collect and msg.get('method') == 'Tracing.dataCollected':
                self.events.extend(msg['params']['value'])
            if msg.get('method') == 'Tracing.tracingComplete':
                self.trace_done = True
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (method, msg['error']))
                return msg.get('result', {})
    def ev(self, expr, timeout=900):
        r = self.call('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True}, timeout)
        if 'exceptionDetails' in r:
            raise RuntimeError('eval failed: %s' % json.dumps(r['exceptionDetails'])[:600])
        return r['result'].get('value')
    def trace_start(self):
        self.events = []; self.collect = True; self.trace_done = False
        self.call('Tracing.start', {'categories': 'devtools.timeline,disabled-by-default-devtools.timeline.stack,v8.execute', 'transferMode': 'ReportEvents'})
    def trace_stop(self):
        self.call('Tracing.end')
        self.ws.settimeout(120)
        while not self.trace_done:
            msg = json.loads(self.ws.recv())
            if msg.get('method') == 'Tracing.dataCollected':
                self.events.extend(msg['params']['value'])
            if msg.get('method') == 'Tracing.tracingComplete':
                self.trace_done = True
        self.collect = False
        return self.events
    def metrics(self):
        m = self.call('Performance.getMetrics')['metrics']
        return {x['name']: x['value'] for x in m}
    def close(self):
        try: self.ws.close()
        except Exception: pass
        try: jget('/json/close/' + self.id)
        except Exception: pass

def top_frames(profile, n=18):
    nodes = {nd['id']: nd for nd in profile['nodes']}
    self_us = {}
    for sid, dt in zip(profile.get('samples', []), profile.get('timeDeltas', [])):
        self_us[sid] = self_us.get(sid, 0) + dt
    agg = {}
    for nid, us in self_us.items():
        cf = nodes[nid]['callFrame']
        key = '%s @%s:%d' % (cf.get('functionName') or '(anon)', cf.get('url', '').split('/')[-1], cf.get('lineNumber', -1) + 1)
        agg[key] = agg.get(key, 0) + us
    tot = sum(agg.values()) or 1
    return [(k, round(v / 1000), round(100.0 * v / tot, 1)) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]

def app_attrib(profile, n=14):
    # every sample -> its NEAREST main.js frame (the jQuery lookup shims skipped)
    nodes = {nd['id']: nd for nd in profile['nodes']}
    parent = {}
    for nd in profile['nodes']:
        for c in nd.get('children', []): parent[c] = nd['id']
    self_us = {}
    for sid, dt in zip(profile.get('samples', []), profile.get('timeDeltas', [])):
        self_us[sid] = self_us.get(sid, 0) + dt
    agg = {}
    for nid, us in self_us.items():
        cur = nid; key = None
        while cur is not None:
            cf = nodes[cur]['callFrame']
            if cf.get('url', '').endswith('main_perf.js') and (cf.get('functionName') not in ('pipAwareFind', 'PipAwareInit')):
                key = '%s @%d' % (cf.get('functionName') or '(anon)', cf.get('lineNumber', -1) + 1); break
            cur = parent.get(cur)
        if key is None: key = '(no app frame)'
        agg[key] = agg.get(key, 0) + us
    tot = sum(agg.values()) or 1
    return [(k, round(v / 1000), round(100.0 * v / tot, 1)) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]

def trace_summary(events):
    out = []
    for e in events:
        if e.get('ph') != 'X' or e.get('name') not in ('UpdateLayoutTree', 'Layout'):
            continue
        dur = e.get('dur', 0) / 1000.0
        if dur < 3: continue
        bd = (e.get('args') or {}).get('beginData') or {}
        st = bd.get('stackTrace') or []
        where = 'frame (not forced)'
        for fr in st:
            if str(fr.get('url', '')).endswith('main_perf.js') and fr.get('functionName') not in ('pipAwareFind', 'PipAwareInit'):
                where = '%s @%s' % (fr.get('functionName') or '(anon)', fr.get('lineNumber', 0) + 1); break
        else:
            if st: where = 'forced by %s @%s' % (st[0].get('functionName') or '(anon)', str(st[0].get('url', '')).split('/')[-1])
        cnt = (e.get('args') or {}).get('elementCount') or ((e.get('args') or {}).get('endData') or {}).get('elementCount') or bd.get('dirtyObjects')
        out.append((round(e.get('ts', 0) / 1000.0), e['name'], round(dur), cnt, where))
    out.sort()
    return out

def delta(a, b, keys=('TaskDuration', 'ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration')):
    return {k: round((b.get(k, 0) - a.get(k, 0)) * 1000) for k in keys}

out = []
try:
    for qs in scenarios:
        for rep in range(reps):
            tab = Tab()
            try:
                tab.call('Performance.enable')
                tab.call('Page.enable')
                m0 = tab.metrics()
                if prof_on:
                    tab.call('Profiler.enable'); tab.call('Profiler.setSamplingInterval', {'interval': 200}); tab.call('Profiler.start')
                tab.call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?%s' % (http_port, qs)})
                for _ in range(600):
                    try:
                        if tab.ev('!!(window.__bench && window.__HP)', 30):
                            break
                    except Exception:
                        pass
                    time.sleep(0.1)
                boot = tab.ev('__bench.boot()')
                m1 = tab.metrics()
                if prof_on:
                    pr = tab.call('Profiler.stop')['profile']
                    print('  PROFILE boot:')
                    for k, ms, pct in top_frames(pr): print('    %6d ms %5.1f%%  %s' % (ms, pct, k))
                    print('  APP ATTRIBUTION boot:')
                    for k, ms, pct in app_attrib(pr, 20): print('    %6d ms %5.1f%%  %s' % (ms, pct, k))
                # let deferred post-render work land (a11y catch-up at +1.5 s, etc.)
                tab.ev('new Promise(r => setTimeout(r, 2500))')
                m2 = tab.metrics()
                rec = {'qs': qs, 'rep': rep, 'boot': boot, 'bootMetrics': delta(m0, m1), 'settleMetrics': delta(m1, m2),
                       'nodes': m2.get('Nodes'), 'heapMB': round(m2.get('JSHeapUsedSize', 0) / 1048576, 1)}
                if ops:
                    res = {}
                    for name, expr in [
                        ('search_free', "__bench.search('Juliet Kilo')"),
                        ('search_clear1', "__bench.search('')"),
                        ('search_hiddencol', "__bench.search(__COLDEF[__COLDEF.length - 1].name + ' contains Alpha')"),
                        ('search_clear2', "__bench.search('')"),
                        ('sort_visible', "__bench.sortClick(1)"),
                        ('paginate', "__bench.page()"),
                    ]:
                        a = tab.metrics()
                        if prof_on: tab.call('Profiler.start')
                        if trace_on: tab.trace_start()
                        if spy_on: tab.ev('__bench.visSpy(true)')
                        v = tab.ev(expr)
                        if spy_on:
                            vrep = tab.ev('__bench.visReport()')
                            tab.ev('__bench.visSpy(false)')
                            print('  :visible callers during %s:' % name)
                            for k, r in sorted(vrep.items(), key=lambda kv: -kv[1]['n'])[:12]:
                                print('    n=%-7d rowsDisplayed=%-5d %s' % (r['n'], r['displayedRowsAtFirstCall'], k[:260]))
                        if trace_on:
                            evs = tab.trace_stop()
                            print('  TRACE %s (style/layout >= 3 ms):' % name)
                            t0 = None
                            for ts, nm, dur, cnt, where in trace_summary(evs):
                                if t0 is None: t0 = ts
                                print('    +%5d ms %-16s %5d ms  elems=%s  %s' % (ts - t0, nm, dur, cnt, where))
                        if prof_on:
                            pr = tab.call('Profiler.stop')['profile']
                            print('  PROFILE %s:' % name)
                            for k, ms, pct in top_frames(pr, 6): print('    %6d ms %5.1f%%  %s' % (ms, pct, k))
                            print('  APP ATTRIBUTION %s:' % name)
                            for k, ms, pct in app_attrib(pr, 10): print('    %6d ms %5.1f%%  %s' % (ms, pct, k))
                        b = tab.metrics()
                        v['metrics'] = delta(a, b)
                        res[name] = v
                    rec['ops'] = res
                rec['census'] = tab.ev('__bench.census()')
                out.append(rec)
                b = rec['boot']
                print('%-40s rep%d  load->done %7.0f ms  ->paint %7.0f ms  task %6d ms (script %6d style %5d layout %5d)  nodes %s  tds %s (empty %s)  err %s' % (
                    qs, rep, b['buildToDone'], b['buildToPaint'], rec['bootMetrics']['TaskDuration'], rec['bootMetrics']['ScriptDuration'],
                    rec['bootMetrics']['RecalcStyleDuration'], rec['bootMetrics']['LayoutDuration'],
                    rec['nodes'], rec['census']['tds'], rec['census'].get('lazyLeft'), b['errors'][:2]), flush=True)
                if ops:
                    for name, v in rec['ops'].items():
                        print('    %-18s %7.0f ms  task %6d (script %6d style %5d layout %5d)  %s' % (
                            name, v.get('toPaint', 0), v['metrics']['TaskDuration'], v['metrics']['ScriptDuration'],
                            v['metrics']['RecalcStyleDuration'], v['metrics']['LayoutDuration'],
                            {k: v[k] for k in v if k in ('matched', 'count', 'firstRowNum')}), flush=True)
            finally:
                tab.close()
finally:
    with open(os.path.join(tempfile.gettempdir(), 'pnb_hc_bench_%s.json' % label), 'w') as f:
        json.dump(out, f, indent=1)
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(prof, ignore_errors=True)
    shutil.rmtree(WWW, ignore_errors=True)
