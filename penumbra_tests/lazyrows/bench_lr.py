# Lazy-rows bench (2026-09-30): the hcperf perf fixture (www/harness.html) with a
# build of each given main.js, headless Edge over CDP, one fresh tab per config.
# Per build and config: load (query success -> first paint after the build), a page
# turn, a search and its clear, a header sort, the first and a second CSV export,
# Copy as HTML (all pages, 50 MB cap), and Rows = All.
#   py -3 bench_lr.py <label>=<main.js> [<label>=<main.js> ...] -- "<qs>" ["<qs>" ...]
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_WWW = os.path.join(os.path.dirname(HERE), 'hcperf', 'www')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
argv = sys.argv[1:]
cut = argv.index('--')
builds = [a.split('=', 1) for a in argv[:cut]]
configs = argv[cut + 1:]

www = tempfile.mkdtemp(prefix='pnb_lrb_')
for f in os.listdir(SRC_WWW):
    fp = os.path.join(SRC_WWW, f)
    if os.path.isfile(fp) and f != 'main_perf.js': shutil.copyfile(fp, os.path.join(www, f))

def perf_build(path):
    b = open(path, 'rb').read()
    anchor = b'$(document).ready(function () {'
    i = b.find(anchor)
    hook = ('\r\n;try { window.__HP = { master: function () { return masterRowData; },'
            ' getExportData: function (f, o) { return getExportData(f, o); },'
            ' applyPagination: function () { return applyPagination(); },'
            ' runTableSearch: function () { return runTableSearch(); },'
            ' setPage: function (p) { currentPage = p; applyPagination(); } }; } catch (e) { window.__HP_ERR = String(e); }\r\n')
    p = b[:i] + b';(function () {' + hook.encode() + b[i + len(anchor):]
    hl = b'    function hideLoading() {\r\n'
    p = p.replace(hl, hl + b'        window.__HP_HIDES = (window.__HP_HIDES || 0) + 1; window.__HP_HIDE_T = performance.now();\r\n')
    j = p.rfind(b'});')
    return p[:j] + b'})();' + p[j + 3:]

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(www, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

OPS = r'''(async function () {
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function raf2() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(performance.now()); }); }); }); }
  async function hidesAfter(n, max) { var t = performance.now(); while ((window.__HP_HIDES || 0) <= n && performance.now() - t < max) await sleep(5); }
  var H = window.__HP, out = {};
  out.load = Math.round((window.__HP_LOADPAINT || 0) - window.__T.success);
  var t0 = performance.now(); H.setPage(2); out.page = Math.round((await raf2()) - t0);
  H.setPage(1); await raf2();
  var h = window.__HP_HIDES || 0; t0 = performance.now();
  $('#tableSearch').val('COL_001_TEXT contains Alpha'); H.runTableSearch(); await hidesAfter(h, 600000);
  out.search = Math.round((await raf2()) - t0);
  h = window.__HP_HIDES || 0; t0 = performance.now();
  $('#tableSearch').val(''); H.runTableSearch(); await hidesAfter(h, 600000);
  out.clear = Math.round((await raf2()) - t0);
  var th = document.querySelector('#tableHeader th[data-column="1"]');
  h = window.__HP_HIDES || 0; t0 = performance.now();
  $(th).trigger('click'); await hidesAfter(h, 600000);
  out.sort = Math.round((await raf2()) - t0);
  t0 = performance.now(); var c1 = H.getExportData('csv'); out.csv1 = Math.round(performance.now() - t0);
  t0 = performance.now(); var c2 = H.getExportData('csv'); out.csv2 = Math.round(performance.now() - t0);
  out.csvLen = c1.content.length; out.csvSame = (c1.content === c2.content);
  t0 = performance.now(); var x = H.getExportData('html', { allPages: true, budget: 50 * 1024 * 1024, notice: 'copy' });
  out.copyHtml = Math.round(performance.now() - t0); out.copyChars = x.content.length;
  t0 = performance.now(); $('#rowsPerPageSelector').val('all'); H.applyPagination(); out.rowsAll = Math.round((await raf2()) - t0);
  return JSON.stringify(out);
})()'''

def run(qs):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=3600, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?%s' % (hp, qs)})
        t0 = time.time()
        while time.time() - t0 < 1800:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': '(window.__HP_HIDES || 0) >= 1 && document.querySelectorAll("#resultsTable tbody tr").length > 0', 'returnByValue': True}).get('result', {}).get('value')
            if v: break
        # the first paint after the build
        call('Runtime.evaluate', {'expression': 'new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { window.__HP_LOADPAINT = performance.now(); r(1); }); }); })', 'awaitPromise': True, 'returnByValue': True})
        time.sleep(2.0)
        r = call('Runtime.evaluate', {'expression': OPS, 'awaitPromise': True, 'returnByValue': True})
        if 'exceptionDetails' in r: return {'error': json.dumps(r['exceptionDetails'])[:400]}
        return json.loads(r['result']['value'])
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

try:
    for qs in configs:
        print(qs)
        for label, path in builds:
            open(os.path.join(www, 'main_perf.js'), 'wb').write(perf_build(path))
            print('  %-8s %s' % (label, json.dumps(run(qs)))); sys.stdout.flush()
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(www, ignore_errors=True)
