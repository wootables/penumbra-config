# Screenshots of the View Options journal setup panel, driven on a kept jrowfeat stage dir.
#   py -3 shot.py <kept stage dir> <out dir>
import base64, json, os, socket, subprocess, sys, time, urllib.request
import websocket

stage, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
import tempfile, shutil
PROFILE = tempfile.mkdtemp(prefix='pnb_shot_')   # a plain %TEMP% path: Edge would not start on the scratchpad's '--oitras' path
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + PROFILE, '--window-size=1400,1000', '--hide-scrollbars',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
print('edge pid', edge.pid, 'ports', hp, dp, flush=True)
try:
    for _ in range(150):
        try: jget('/json/version'); break
        except Exception: time.sleep(0.2)
    print('devtools up', flush=True)
    t = jget('/json/new?about:blank', 'PUT')
    print('tab', t.get('id'), flush=True)
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(expr):
        return call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')
    call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
    call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?id=jrfix&scn=cfg' % hp})
    for _ in range(240):
        time.sleep(0.25)
        if ev('window.__queryDone >= 1 && (window.__JR_HIDES || 0) >= 1'): break
    print('booted', ev('[window.__queryDone, window.__JR_HIDES, document.title]'), flush=True)
    time.sleep(1.5)
    # A clean page: only the setup panel, as wide as the admin console's View Options tab.
    ev("""(function(){
      document.querySelectorAll('body > *').forEach(function(el){ if (el.id !== 'view-options-tab') el.style.display = 'none'; });
      var t = document.getElementById('view-options-tab'); t.style.cssText = 'display:block; width:1240px; margin:16px; font-family:Segoe UI, Arial, sans-serif; font-size:13px;';
      document.querySelector('#view-options-tab .view-options-eu').style.display = 'none';
      window.Penumbra.syncJournalRowConfigUI();
      return true; })()""")
    def shot(name):
        print('shot', name, flush=True)
        r = ev("(function(){var b=document.getElementById('journalRowConfig').getBoundingClientRect();return [b.left,b.top,b.width,b.height];})()")
        img = call('Page.captureScreenshot', {'format': 'png', 'clip': {'x': r[0] - 6, 'y': r[1] - 6, 'width': r[2] + 12, 'height': r[3] + 12, 'scale': 1}})
        open(os.path.join(out, name), 'wb').write(base64.b64decode(img['data']))
    def tick(col, on):
        ev("(function(){var c=[].slice.call(document.querySelectorAll('#journalKeyColumnsBox .journal-keycol-cb')).filter(function(x){return x.value===%s;})[0]; if(c&&c.checked!==%s){c.checked=%s;$(c).trigger('change');} return !!c;})()" % (json.dumps(col), 'true' if on else 'false', 'true' if on else 'false'))
    time.sleep(0.4)
    shot('1_no_key.png')
    tick('PROTOCOL NO.', True); time.sleep(0.4)
    shot('2_key_not_unique.png')
    tick('PROTOCOL TYPE', True); time.sleep(0.8)
    ev("document.getElementById('journalAddToggleBtn').click(); true"); time.sleep(0.8)
    shot('3_added.png')
    ev("""(function(){var i=document.querySelector('#journalToggleList .journal-toggle-def:last-child .journal-toggle-def-label');
      i.value='Reviewed'; $(i).trigger('input');
      i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true,cancelable:true})); return true;})()"""); time.sleep(0.6)
    ev("(function(){var r=document.getElementById('journalRowNotesEnable'); r.checked=true; $(r).trigger('change'); return true;})()"); time.sleep(0.8)
    ev("(function(){var i=document.querySelector('#journalToggleList .journal-toggle-def:last-child .journal-toggle-def-label'); i.value='Reviewed'; $(i).trigger('input'); i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true,cancelable:true})); return true;})()"); time.sleep(0.5)
    shot('4_named.png')
    ev("document.querySelector('#journalToggleList .journal-toggle-def-remove').click(); true"); time.sleep(0.6)
    shot('5_removed_undo.png')
    print('shots in', out)
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if os.path.basename(PROFILE).startswith('pnb_shot_'): shutil.rmtree(PROFILE, ignore_errors=True)
