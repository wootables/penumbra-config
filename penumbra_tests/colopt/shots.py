# colopt: screenshots of the new UI from the REAL code (the suite's harness + stage),
# for review before a deploy. py -3 shots.py --stage DIR --out DIR
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv += []
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
stage_dir = opt('--stage'); out_dir = opt('--out')
os.makedirs(out_dir, exist_ok=True)
import importlib.util
spec = importlib.util.spec_from_file_location('corun', os.path.join(HERE, 'run.py'))
# reuse run.py's constants and hook without running it: read the few pieces we need
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
src = open(os.path.join(HERE, 'run.py'), encoding='utf-8').read()
hook_src = src[src.index('def hook(src):'):src.index('def mutate(texts, name):')]
ns = {}
exec(hook_src, ns)
hook = ns['hook']
stage = tempfile.mkdtemp(prefix='pnb_cos_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
rd = lambda p: open(p, 'rb').read().decode('utf-8', 'surrogateescape')
# (colopt c) the harness lifts its Settings / status bar bits from the stage's index.php
# (else the live one), and the help stub carries that help file's Settings tips
sys.path.insert(0, HERE)
import mk_harness
def _staged(rel):
    p = os.path.join(stage_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
open(os.path.join(stage, 'harness.html'), 'wb').write(mk_harness.build(rd(_staged('index.php'))).encode('utf-8', 'surrogateescape'))
_m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', rd(_staged('help_content.php')), re.S)
open(os.path.join(stage, 'help_stub.js'), 'w', encoding='utf-8').write('window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (_m.group(0) if _m else '')) + ';\n')
open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(rd(_staged(os.path.join('js', 'main.js')))).encode('utf-8', 'surrogateescape'))
for f, d in (('penumbra_colfmt.js', 'js'), ('penumbra_calc.js', 'js'), ('main.css', 'css')):
    p = os.path.join(stage_dir, d, f)   # a file the change leaves alone: the live one
    shutil.copyfile(p if os.path.exists(p) else os.path.join(APP, d, f), os.path.join(stage, f))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1280,860', '--force-device-scale-factor=1',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
def shot(query, name, clip=None):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 860, 'deviceScaleFactor': 1, 'mobile': False})
        # (2026-10-20 b) 'page:FILE' - a plain page of the stage dir (the email), ready once loaded
        plain = query.startswith('page:')
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, query[5:]) if plain else 'http://127.0.0.1:%d/harness.html?%s' % (hp, query)})
        t0 = time.time()
        while time.time() - t0 < 120:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'document.readyState === "complete"' if plain else '!!window.__SHOTREADY', 'returnByValue': True}).get('result', {}).get('value')
            if v: break
        time.sleep(0.4)
        if clip == 'pop':   # (colopt d) a close-up: the open popover and a margin round it
            r = call('Runtime.evaluate', {'expression': '(function () { var p = document.querySelector(".sp-sumtype-menu"); if (!p) return null;'
                                          ' var b = p.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()',
                                          'returnByValue': True}).get('result', {}).get('value')
            clip = {'x': max(0, r[0] - 70), 'y': max(0, r[1] - 50), 'width': r[2] + 140, 'height': r[3] + 100} if r else None
        p = {'format': 'png'}
        if clip: p['clip'] = dict(clip, scale=1)
        img = call('Page.captureScreenshot', p).get('data')
        open(os.path.join(out_dir, name), 'wb').write(base64.b64decode(img))
        print('wrote', name)
    finally:
        ws.close()
try:
    # (2026-10-20, hl) Highlight rules: the list, a rule's view (Basic, Advanced), a new
    # rule, the table they draw; light and dark
    # (2026-10-20 b, hl phase 2) the report's rules: the list (their own rule over the report's,
    # one of the report's off), a report rule opened by an editor, a viewer's list, the Save
    # dialog's Last Stop Changes list, the table; the email as the runner writes it
    # (PNB_EMAIL_HTML: test_colopt.php hl's PNB_EMAIL_OUT, and its .dark.html)
    if os.environ.get('PNB_SHOTS') == 'hl2':
        shot('scn=hrshot&view=list', 'hr_list.png', 'pop')
        shot('scn=hrshot&view=list&col=V_STATUS', 'hr_list_off.png', 'pop')
        shot('scn=hrshot&view=rule', 'hr_rule_report.png', 'pop')
        shot('scn=hrviewshot', 'hr_list_viewer.png', 'pop')
        shot('scn=hrshot&view=list&dark=1', 'hr_list_dark.png', 'pop')
        shot('scn=hrshot&view=save', 'hr_save_list.png', 'pop')
        shot('scn=hrshot&view=table', 'hr_table.png', {'x': 0, 'y': 0, 'width': 1280, 'height': 860})
        eh = os.environ.get('PNB_EMAIL_HTML')
        if eh:
            shutil.copyfile(eh, os.path.join(stage, 'email.html'))
            shutil.copyfile(eh + '.dark.html', os.path.join(stage, 'email_dark.html'))
            shot('page:email.html', 'hr_email.png', {'x': 0, 'y': 0, 'width': 1280, 'height': 860})
            shot('page:email_dark.html', 'hr_email_dark.png', {'x': 0, 'y': 0, 'width': 1280, 'height': 860})
        raise SystemExit(0)
    if os.environ.get('PNB_SHOTS') == 'hl':
        shot('scn=shothl', 'hl_list.png', 'pop')
        shot('scn=shothl&ed=0', 'hl_rule.png', 'pop')
        shot('scn=shothl&ed=1&adv=1', 'hl_rule_adv.png', 'pop')
        shot('scn=shothl&ed=new', 'hl_new.png', 'pop')
        shot('scn=shothl&ed=0&dark=1', 'hl_rule_dark.png', 'pop')
        shot('scn=shothl&open=NONE', 'hl_table.png', {'x': 0, 'y': 0, 'width': 1280, 'height': 860})
        shot('scn=shothl&open=NONE&dark=1', 'hl_table_dark.png', {'x': 0, 'y': 0, 'width': 1280, 'height': 860})
        raise SystemExit(0)
    # (colopt g) Filter a row of its own: a vendor-code column (Filter + Links), a number column
    shot('scn=shotpanel&open=V_LINK', 'colopt_g_vendor.png', 'pop')
    shot('scn=shotpanel&open=V_AMOUNT&frz=4', 'colopt_g_amount.png', 'pop')
    shot('scn=shotpanel&open=V_LINK&dark=1', 'colopt_g_dark.png', 'pop')
    raise SystemExit(0)   # (colopt g) only these; the e shots below are kept for the record
    # (colopt e) the Settings panel's Theme / Density / Columns rows, and the roomier popover
    PANEL = {'x': 0, 'y': 0, 'width': 500, 'height': 620}
    shot('scn=shotpanel&open=NONE&frz=4', 'colopt_e_panel.png', PANEL)
    shot('scn=shotpanel&open=NONE&frz=4&dark=1', 'colopt_e_panel_dark.png', PANEL)
    shot('scn=shotpanel&open=V_AMOUNT&frz=4', 'colopt_e_amount.png', 'pop')         # a number: every section
    shot('scn=shotpanel&open=V_NAME&frz=4', 'colopt_e_text.png', 'pop')             # a text column, frozen with
    shot('scn=shotpanel&open=V_AMOUNT&fx=1', 'colopt_e_formula.png', 'pop')         # the formula row
    shot('scn=shotpanel&open=V_AMOUNT&frz=4&dark=1', 'colopt_e_dark.png', 'pop')
    shot('scn=shotpivot', 'colopt_e_pivot.png', 'pop')
    # (colopt d) was the same popovers at 328px, + a full page; (colopt c) full pages
finally:
    edge.kill(); srv.kill(); time.sleep(1); shutil.rmtree(stage, ignore_errors=True)
