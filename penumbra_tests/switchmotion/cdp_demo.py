# Real-frame run of the switch motion change (2026-09-24).
# Headless Edge over CDP (NOT --dump-dom: real frames, real rAF, real compositor),
# screencasting the page while a layout_switch position is clicked, for one build.
#   py -3 cdp_demo.py <demo_dir> <out_dir> [rows] [position] [mode]
import base64, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
demo_dir, out_dir = sys.argv[1], sys.argv[2]
rows = int(sys.argv[3]) if len(sys.argv) > 3 else 6000
pos = int(sys.argv[4]) if len(sys.argv) > 4 else 1
kind = sys.argv[5] if len(sys.argv) > 5 else 'switch'     # switch | toggle
port = 9400 + (os.getpid() % 400)
os.makedirs(out_dir, exist_ok=True)
prof = tempfile.mkdtemp(prefix='pnbcdp_')
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                         '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                         '--user-data-dir=' + prof, '--window-size=1400,900', '--remote-debugging-port=%d' % port,
                         '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=*',
                         '--force-prefers-no-reduced-motion', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws_url = None
    for _ in range(100):
        try:
            tl = json.load(opener.open('http://127.0.0.1:%d/json' % port, timeout=2))
            pages = [t for t in tl if t.get('type') == 'page' and t.get('url', '').startswith('about:blank')]
            if pages:
                ws_url = pages[0]['webSocketDebuggerUrl']; break
        except Exception:
            pass
        time.sleep(0.2)
    if not ws_url:
        raise SystemExit('no page target')
    ws = websocket.create_connection(ws_url, timeout=120, suppress_origin=True)
    state = {'id': 0, 'frames': []}

    def handle(msg):
        if msg.get('method') == 'Page.screencastFrame':
            p = msg['params']
            state['frames'].append((p['metadata']['timestamp'], p['data']))
            state['id'] += 1
            ws.send(json.dumps({'id': state['id'], 'method': 'Page.screencastFrameAck', 'params': {'sessionId': p['sessionId']}}))

    def send(method, params=None):
        state['id'] += 1
        mid = state['id']
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError(method + ': ' + json.dumps(msg['error']))
                return msg.get('result', {})
            handle(msg)

    def ev(expr):
        r = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in r:
            raise RuntimeError('eval: ' + json.dumps(r['exceptionDetails'])[:400])
        return r.get('result', {}).get('value')

    def pump(seconds):
        end = time.time() + seconds
        ws.settimeout(0.05)
        while time.time() < end:
            try:
                handle(json.loads(ws.recv()))
            except websocket.WebSocketTimeoutException:
                pass
        ws.settimeout(120)

    send('Page.enable'); send('Runtime.enable')
    url = 'file:///' + demo_dir.replace('\\', '/') + '/harness.html?mode=demo&rows=%d' % rows
    send('Page.navigate', {'url': url})
    ready = False
    for _ in range(600):
        try:
            if ev('window.__READY === true'):
                ready = True; break
        except Exception:
            pass
        time.sleep(0.25)
    if not ready:
        raise SystemExit('page never became ready')
    info = ev("""(function(){var s=document.querySelector('#reportSnippetOutput .pnb-layout-switch');
      return {rows: document.querySelectorAll('#resultsTable tbody tr').length, sel: s && s.getAttribute('data-ls-selected'),
              reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, errs: (window.__errors||[]).slice(0,3)};})()""")
    print('ready', json.dumps(info))
    # Per-frame recorder: runs whenever the main thread is free to run rAF.
    ev("""(function(){ window.__rec = []; var go = true; window.__stopRec = function(){ go = false; };
      (function loop(){ if (!go) return;
        var sw = document.querySelector('#reportSnippetOutput .pnb-layout-switch');
        var th = sw && sw.querySelector('.pnb-ls-thumb');
        var tg = document.querySelector('#reportSnippetOutput .pnb-toggle');
        var ov = document.getElementById('loadingOverlay'), oc = getComputedStyle(ov);
        var m = th ? new DOMMatrix(getComputedStyle(th).transform) : null;
        var knob = tg ? new DOMMatrix(getComputedStyle(tg.querySelector('.sp-switch'), '::after').transform) : null;
        window.__rec.push([performance.timeOrigin + performance.now(), m ? Math.round(m.m41 * 10) / 10 : null,
          oc.display, Math.round(parseFloat(oc.opacity) * 100) / 100, ov.classList.contains('pnb-lo-scoped'),
          sw ? sw.getAttribute('data-ls-selected') : null, knob ? Math.round(knob.m41 * 10) / 10 : null,
          document.getElementById('groupedResultsContainer').offsetParent !== null]);
        requestAnimationFrame(loop); })(); return true; })()""")
    send('Page.startScreencast', {'format': 'jpeg', 'quality': 85, 'everyNthFrame': 1})
    pump(0.6)
    if kind == 'toggle':
        click_at = ev("""(function(){ var b = document.querySelector('#reportSnippetOutput .pnb-toggle-btn');
          var t = performance.timeOrigin + performance.now(); b.click(); return t; })()""")
    else:
        click_at = ev("""(function(){ var o = document.querySelectorAll('#reportSnippetOutput .pnb-ls-opt')[%d];
          var t = performance.timeOrigin + performance.now(); o.click(); return t; })()""" % pos)
    pump(3.5)
    send('Page.stopScreencast')
    ev('window.__stopRec(), true')
    rec = ev('window.__rec')
    final = ev("""(function(){var s=document.querySelector('#reportSnippetOutput .pnb-layout-switch');
      return {sel: s && s.getAttribute('data-ls-selected'), grouped: document.getElementById('groupedResultsContainer').offsetParent !== null,
              errs: (window.__errors||[]).slice(0,3)};})()""")
    frames = []
    for ts, data in state['frames']:
        rel = int(round(ts * 1000 - click_at))
        name = 'f_%+06d.jpg' % rel
        with open(os.path.join(out_dir, name), 'wb') as fh:
            fh.write(base64.b64decode(data))
        frames.append(rel)
    recs = [[int(round(r[0] - click_at))] + r[1:] for r in rec]
    json.dump({'info': info, 'final': final, 'frames': frames, 'rec': recs}, open(os.path.join(out_dir, 'run.json'), 'w'))
    print('frames', len(frames), 'rec', len(recs), 'final', json.dumps(final))
finally:
    try: proc.kill()
    except Exception: pass
    subprocess.run(['powershell', '-NoProfile', '-Command',
                    "Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % os.path.basename(prof)],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.5)
    shutil.rmtree(prof, ignore_errors=True)
