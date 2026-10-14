# Parse-check JS files with headless Edge (CDP Runtime.compileScript) - no Node on this box.
#   py -3 jsparse.py FILE [FILE ...]      prints PARSE_OK / PARSE_FAILED per file
import json, socket, subprocess, sys, tempfile, time, urllib.request, shutil, os
import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
dp = free_port()
prof = tempfile.mkdtemp(prefix='pnb_jsparse_')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof,
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(150):
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/version' % dp, timeout=5).read(); break
        except Exception: time.sleep(0.2)
    t = json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d/json/new?about:blank' % dp, method='PUT'), timeout=15).read().decode())
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == mid: return m
    call('Runtime.enable')
    for f in sys.argv[1:]:
        src = open(f, 'rb').read().decode('utf-8', 'surrogateescape')
        r = call('Runtime.compileScript', {'expression': src, 'sourceURL': os.path.basename(f), 'persistScript': False})
        ex = r.get('result', {}).get('exceptionDetails')
        if ex:
            print('PARSE_FAILED %s: line %s col %s: %s' % (f, ex.get('lineNumber', 0) + 1, ex.get('columnNumber'),
                  (ex.get('exception') or {}).get('description', ex.get('text'))[:200]))
        elif 'error' in r:
            print('PARSE_ERROR %s: %s' % (f, r['error']))
        else:
            print('PARSE_OK %s (%d chars)' % (f, len(src)))
    ws.close()
finally:
    edge.kill(); time.sleep(1); shutil.rmtree(prof, ignore_errors=True)
