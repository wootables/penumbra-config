# Serve DIR, open DIR/PAGE in headless Edge, wait for window.__DONE, print window.__OUT (JSON).
#   py -3 runpage.py DIR PAGE [timeout_s]
import json, os, socket, subprocess, sys, tempfile, time, urllib.request, shutil
import websocket
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
d, page = sys.argv[1], sys.argv[2]
tmo = float(sys.argv[3]) if len(sys.argv) > 3 else 60
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
prof = tempfile.mkdtemp(prefix='pnb_pr_')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof, '--window-size=1400,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(150):
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/version' % dp, timeout=5).read(); break
        except Exception: time.sleep(0.2)
    for _ in range(100):
        try: urllib.request.urlopen('http://127.0.0.1:%d/' % hp, timeout=5).read(); break
        except Exception: time.sleep(0.2)
    t = json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d/json/new?about:blank' % dp, method='PUT'), timeout=15).read().decode())
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
    call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, page)})
    t0 = time.time(); out = None
    while time.time() - t0 < tmo:
        time.sleep(0.2)
        v = call('Runtime.evaluate', {'expression': 'window.__DONE ? JSON.stringify(window.__OUT) : null', 'returnByValue': True}).get('result', {}).get('value')
        if v: out = v; break
    print(out if out else json.dumps({'fatal': 'timeout'}))
    ws.close()
finally:
    edge.kill(); srv.kill(); time.sleep(1); shutil.rmtree(prof, ignore_errors=True)
