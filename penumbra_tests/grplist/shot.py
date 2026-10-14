# Screenshots of the List layout from the grplist harness (the same staging as run.py).
#   py -3 shot.py --stage DIR --out OUTDIR [scn ...]      default scenarios: boot wide nested
import base64, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = sys.argv[:1] + [a for a in sys.argv[1:]]
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
stage_dir = opt('--stage')
out_dir = opt('--out')
scns = args or ['boot', 'wide', 'nested']
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
src = read_b(os.path.join(stage_dir, 'js', 'main.js'))
anchor = '$(document).ready(function () {'
i = src.find(anchor)
h = ('\r\n;try { window.__HC = {}; ["runTableSearch","getExportData","generatePdfContent","loadScript","buildStateObject","removeGrouping"].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) {} }); } catch (e) {}\r\n')
src = src[:i] + ';(function () {' + h + src[i + len(anchor):]
j = src.rfind('});'); src = src[:j] + '})();' + src[j + 3:]
hl = '    function hideLoading() {\r\n'
src = src.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')

stage = tempfile.mkdtemp(prefix='pnb_glshot_')
os.makedirs(os.path.join(stage, 'js'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
open(os.path.join(stage, 'main_hc.js'), 'wb').write(src.encode('utf-8', 'surrogateescape'))
shutil.copyfile(os.path.join(stage_dir, 'js', 'penumbra_grouplist.js'), os.path.join(stage, 'penumbra_grouplist.js'))
shutil.copyfile(os.path.join(stage_dir, 'css', 'penumbra_grouplist.css'), os.path.join(stage, 'penumbra_grouplist.css'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
                         '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900', '--hide-scrollbars=false',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
try:
    for _ in range(150):
        try: jget('/json/version'); break
        except Exception: time.sleep(0.2)
    os.makedirs(out_dir, exist_ok=True)
    for scn in scns:
        t = jget('/json/new?about:blank', 'PUT')
        ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
        n = [0]
        def call(m, p=None):
            n[0] += 1; mid = n[0]
            ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get('id') == mid: return r.get('result', {})
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setDeviceMetricsOverride', {'width': 1500, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 120:
            time.sleep(0.3)
            v = call('Runtime.evaluate', {'expression': '!!window.__HCDONE', 'returnByValue': True}).get('result', {}).get('value')
            if v: break
        # hide the harness's own "DONE" marker and plumbing for a clean picture
        call('Runtime.evaluate', {'expression': "document.getElementById('out').style.display='none'; window.scrollTo(0,0); 1", 'returnByValue': True})
        time.sleep(0.5)
        png = call('Page.captureScreenshot', {'format': 'png'}).get('data')
        p = os.path.join(out_dir, 'grplist_%s.png' % scn)
        open(p, 'wb').write(base64.b64decode(png))
        print('saved', p)
        ws.close()
finally:
    edge.kill(); srv.kill(); time.sleep(1); shutil.rmtree(stage, ignore_errors=True)
