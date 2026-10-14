# =============================================================================
# MOBILE SUITE (2026-10-02) - the mobile / tablet pass and the print pass, as
# measured layout, in headless Edge over CDP at TRUE phone and tablet viewports
# (Emulation.setDeviceMetricsOverride - a headless WINDOW never goes below
# 492px, see the 2026-07-25 pass) and with print media emulated
# (Emulation.setEmulatedMedia).
#
# The candidate is a webroot-shaped dir: css\main.css, css\penumbra_dashboard.css,
# grants_admin.php (its inline <style> is lifted into css/grants.css). The four
# harness pages carry the live markup shapes (ids and classes verbatim, the
# inline flex-basis the repository JS writes, a heatmap cell's inline fill) and
# each defines window.__state() with the measurements.
#
# Asserts (P = phone 390x844, T = tablet 768x1024 / 1024x768, D = desktop 1280,
# R = print at 1024):
#   P-home     home: the two-column grid stays inside the viewport (was 650px wide)
#   P-ghost    home: the "tap the heart to pin" hint is gone at phone width
#   D-home     desktop: the grid still has two columns (no over-reach)
#   P-header   report banner: snippet column stacked UNDER the title, inside the viewport (was 614px)
#   D-header   desktop: the banner keeps its two columns
#   P-sblead   status bar: the profile cell ends inside the viewport (was 90px past it)
#   P-pop      status bar: the profile popover is inside the viewport (was -61..479)
#   P-settings settings panel: the panel and its close button are inside the viewport
#   P-snapstack snapshots dialog: the columns pane sits UNDER the list pane
#   P-snapscroll snapshots dialog: the table scrolls inside its frame, the dialog itself does not scroll sideways
#   P-snapfoot snapshots dialog: every footer control ends inside the viewport
#   T-repo     repository at 768: details UNDER the list, splitter gone, list full width (inline flex-basis beaten)
#   T-repo1024 repository at 1024: still side by side
#   P-nav      admin chrome: the tool pills end inside the viewport (was 634px)
#   P-navstatic admin chrome: the bar is not sticky on a phone (it stood 190px tall)
#   T-navsticky admin chrome at 1024: still sticky
#   P-jobs     health maintenance: the job controls are inside the viewport (was 549px)
#   P-runs     health maintenance: a run's message is inside the viewport and wraps
#   P-dash     dashboard head: the action buttons end inside the viewport (was 451px)
#   P-grants   grants save bar: the note sits on its own line under the button
#   R-sb       print: the footer status bar does not print
#   R-adm      print: the admin tool bar does not print
#   R-heat     print: a heatmap / conditional-format cell keeps its inline fill and text colour
#   R-plain    print: a plain cell prints black on white, a header cell on light grey
#   R-total    print (dark theme): the pivot grand-total row prints light, black text
#   R-notice   print: a posted notice prints black on white
#   R-crumb    print: the breadcrumb prints black
#
#   py -3 run.py                 candidate = the LIVE webroot
#   py -3 run.py --app <dir>     candidate = <dir> (a stage)
#   py -3 run.py --control       the build before this pass: the newest
#                                *.bak-*-mobile files in the webroot, else live itself
#                                while it still lacks the fix: RED on exactly CONTROL_RED
#   py -3 run.py --mutants       every mutant of the candidate: each must turn exactly
#                                its own asserts red
#   py -3 run.py --mutant NAME   one of them; --verbose prints every observation
# Writes nothing to the webroot. cd into this folder first (Git Bash mangles a
# \\server\d$ argument to py -3).
# =============================================================================
import glob, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PAGES = ['home.html', 'report.html', 'admin.html', 'dash.html']
CR = '\r\n'
PHONE, TAB, TABL, DESK = (390, 844), (768, 1024), (1024, 768), (1280, 800)

# ---- the fix's own lines: each must be found exactly once in a FIXED build ----
A = {
 'homefr':    ('main', '    .pnl-cols.pnl-has-rail { grid-template-columns: minmax(0, 1fr); }' + CR,
                       '    .pnl-cols.pnl-has-rail { grid-template-columns: 1fr; }' + CR),
 'noghost':   ('main', '    .pnl-ghost { display: none; }' + CR, ''),
 'nohdr':     ('main', '        grid-template-areas: "title" "snippet" "prompts" "timestamps" "breadcrumb";' + CR + '        gap: 8px 0;' + CR,
                       '        grid-template-columns: 1fr auto;' + CR + '        grid-template-areas: "title snippet" "prompts snippet" ". snippet";' + CR + '        gap: 8px 0;' + CR),
 'nosblead':  ('main', '    #pnbStatusBar .sb-seg.sb-lead { min-width: 0; flex: 0 1 auto; overflow: hidden; }' + CR, ''),
 'nopop':     ('main', '        width: calc(100vw - 24px);' + CR + '        max-width: calc(100vw - 24px);' + CR, ''),
 'nosettings':('main', '    #settingsPanel { box-sizing: border-box; width: 100vw; min-width: 0; max-width: 100vw; }' + CR, ''),
 'nosnapstack':('main', '    #manageSnapshotsLightbox .snap-unified-container { flex-direction: column; height: auto; }' + CR, ''),
 'nosnapscroll':('main', '    #manageSnapshotsLightbox .snap-unified-container .snap-table-wrap { overflow-x: auto; max-height: 50vh; }' + CR, ''),
 'nosnapfoot':('main', '    #manageSnapshotsLightbox .snap-bottom-bar-v2 { flex-wrap: wrap; row-gap: 8px; }' + CR, ''),
 'norepo':    ('main', '    #serverReportLayout { flex-direction: column; }' + CR, ''),
 'nonav':     ('main', '    .pnb-adm-nav { flex: 1 1 100%; min-width: 0; }' + CR, ''),
 'nostatic':  ('main', '    body.pnb-adm .pnb-adm-stick { position: static; }' + CR, ''),
 'nojobs':    ('main', '    .pnb-rows-jobs .pnb-row .k { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }' + CR, ''),
 'noruns':    ('main', '    .pnb-rows-runs .pnb-row .p { grid-column: 1 / -1; white-space: normal; }' + CR, ''),
 'nodash':    ('dash', '    .dash-head-actions { flex: 1 1 100%; min-width: 0; }\n', ''),
 'nogrants':  ('grants', '    .bar-inner { flex-wrap: wrap; }\n', ''),
 'noprinthide':('main', '    #pnbStatusBar, .pnb-adm-stick, .pnb-adm-bar, .pnb-help-launcher, #scrollDpad { display: none !important; }' + CR, ''),
 # (printx 2026-10-10: two id bumps + the data-bar exemption on these selectors)
 'noheat':    ('main', '    th:not(#pnb-print):not(#pnb-print-2), td:not(#pnb-print):not(#pnb-print-2):not([style*="background-color"]):not([style*="background-image"]) {' + CR,
                       '    th:not(#pnb-print):not(#pnb-print-2), td:not(#pnb-print):not(#pnb-print-2) {' + CR),
 'nobump':    ('main', '    th:not(#pnb-print):not(#pnb-print-2) {   /* same specificity bump as the cell rules above */' + CR, '    th {' + CR),
 'nototal':   ('main', '    #pivot-output-container #pivotResultTable td.pivot-grand-total,' + CR + '    #pivot-output-container #pivotResultTable th.pivot-grand-total {' + CR,
                       '    #pivotResultTable th.pivot-grand-total {' + CR),
 'nonotice':  ('main', '    .pnb-notice { background: #fff !important; color: #000 !important; border-left-color: #000 !important; }' + CR, ''),
 'nocrumb':   ('main', '    .pnb-crumb, .pnb-crumb a { color: #000 !important; }' + CR, ''),
}
MUTANT_RED = {
 # (nosblead also reds P-pop: the popover is anchored to the profile cell, so it leaves with it;
 #  nosnapfoot also reds P-snapscroll: an overflowing footer is what scrolls the dialog sideways.)
 'homefr': ['P-home'], 'noghost': ['P-ghost'], 'nohdr': ['P-header'], 'nosblead': ['P-sblead', 'P-pop'], 'nopop': ['P-pop'],
 'nosettings': ['P-settings'], 'nosnapstack': ['P-snapstack'], 'nosnapscroll': ['P-snapscroll'], 'nosnapfoot': ['P-snapfoot', 'P-snapscroll'],
 'norepo': ['T-repo'], 'nonav': ['P-nav'], 'nostatic': ['P-navstatic'], 'nojobs': ['P-jobs'], 'noruns': ['P-runs'],
 'nodash': ['P-dash'], 'nogrants': ['P-grants'],
 'noprinthide': ['R-sb', 'R-adm'], 'noheat': ['R-heat'], 'nobump': ['R-plain'], 'nototal': ['R-total'], 'nonotice': ['R-notice'], 'nocrumb': ['R-crumb'],
}
CONTROL_RED = sorted(set(sum(MUTANT_RED.values(), [])))

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
control = flag('--control')
mutants = flag('--mutants')
one_mutant = opt('--mutant', None)
verbose = flag('--verbose')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def write_b(p, s): open(p, 'wb').write(s.encode('utf-8', 'surrogateescape'))
SRC = {'main': os.path.join(app_dir, 'css', 'main.css'),
       'dash': os.path.join(app_dir, 'css', 'penumbra_dashboard.css'),
       'grants': os.path.join(app_dir, 'grants_admin.php')}
if control:
    SRC = {'main': os.path.join(APP, 'css', 'main.css'), 'dash': os.path.join(APP, 'css', 'penumbra_dashboard.css'), 'grants': os.path.join(APP, 'grants_admin.php')}
    if read_b(SRC['main']).count(A['nonav'][1]):
        for k, pat in (('main', os.path.join(APP, 'css', 'main.css.bak-*-mobile')), ('dash', os.path.join(APP, 'css', 'penumbra_dashboard.css.bak-*-mobile')), ('grants', os.path.join(APP, 'grants_admin.php.bak-*-mobile'))):
            b = bak_glob(pat)
            if not b: raise SystemExit('--control: live has the fix and there is no %s to stand for the build before it' % pat)
            SRC[k] = b[-1]
BASE = {k: read_b(p) for k, p in SRC.items()}

def grants_css(php):
    m = re.search(r'<style[^>]*>(.*?)</style>', php, re.S)
    if not m: raise SystemExit('grants_admin.php: no <style> block')
    return m.group(1)

def mutate(texts, name):
    which, old, new = A[name]
    t = texts[which]
    if t.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build)" % (name, t.count(old)))
    texts = dict(texts); texts[which] = t.replace(old, new)
    return texts

# ---- stage: harness + candidate css, one http server, one Edge ----
stage = tempfile.mkdtemp(prefix='pnb_mob_')
os.makedirs(os.path.join(stage, 'css'))
for f in PAGES: shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
# main.css references fonts/images relative to css/; copy what exists beside it.
for sub in ('images', 'fonts'):
    sp = os.path.join(app_dir, 'css', sub)
    if os.path.isdir(sp): shutil.copytree(sp, os.path.join(stage, 'css', sub))
def install(texts):
    write_b(os.path.join(stage, 'css', 'main.css'), texts['main'])
    write_b(os.path.join(stage, 'css', 'penumbra_dashboard.css'), texts['dash'])
    write_b(os.path.join(stage, 'css', 'grants.css'), grants_css(texts['grants']))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'),
                         '--window-size=1400,900', '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

class Tab(object):
    def __init__(self):
        self.t = jget('/json/new?about:blank', 'PUT')
        self.ws = websocket.create_connection(self.t['webSocketDebuggerUrl'], timeout=60, suppress_origin=True)
        self.n = 0
        self.call('Network.enable')
        self.call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build rewrites the same css paths
        self.call('Page.enable')
    def call(self, m, p=None):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get('id') == mid:
                if 'error' in r: raise RuntimeError('%s: %s' % (m, r['error']))
                return r.get('result', {})
    def ev(self, expr):
        r = self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
        if r.get('exceptionDetails'): raise RuntimeError(json.dumps(r['exceptionDetails'])[:300])
        return r.get('result', {}).get('value')
    def measure(self, page, size, media=None):
        w, h = size
        self.call('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': w < 768})
        self.call('Emulation.setEmulatedMedia', {'media': media or ''})
        self.call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s?b=%d' % (hp, page, int(time.time() * 1000))})
        for _ in range(100):
            if self.ev('document.readyState') == 'complete' and self.ev('!!window.__state'): break
            time.sleep(0.05)
        time.sleep(0.15)
        s = json.loads(self.ev('JSON.stringify(window.__state())'))
        if s.get('cw') not in (w, w - 15, w - 17):   # a vertical scrollbar may take 15-17px
            raise RuntimeError('%s@%dx%d: viewport is %s, the emulation did not take' % (page, w, h, s.get('cw')))
        return s
    def close(self):
        try: self.ws.close()
        except Exception: pass
        try: jget('/json/close/' + self.t['id'])
        except Exception: pass

def observe():
    t = Tab()
    try:
        o = {}
        o['home390'] = t.measure('home.html', PHONE)
        o['home1280'] = t.measure('home.html', DESK)
        o['rep390'] = t.measure('report.html', PHONE)
        o['rep768'] = t.measure('report.html', TAB)
        o['rep1024'] = t.measure('report.html', TABL)
        o['rep1280'] = t.measure('report.html', DESK)
        o['repPrint'] = t.measure('report.html', TABL, 'print')
        o['adm390'] = t.measure('admin.html', PHONE)
        o['adm1024'] = t.measure('admin.html', TABL)
        o['admPrint'] = t.measure('admin.html', TABL, 'print')
        o['dash390'] = t.measure('dash.html', PHONE)
        return o
    finally:
        t.close()

def inside(box, cw): return box is not None and box['r'] <= cw + 1 and box['l'] >= -1
def rgb(s): return tuple(int(x) for x in re.findall(r'\d+', s or '')[:3])
def light(s):
    c = rgb(s); return len(c) == 3 and sum(c) / 3.0 >= 200

def asserts(o):
    h, hd, r, r8, r10, rd, rp, a, a10, ap, d = (o['home390'], o['home1280'], o['rep390'], o['rep768'], o['rep1024'], o['rep1280'], o['repPrint'], o['adm390'], o['adm1024'], o['admPrint'], o['dash390'])
    R = {}
    R['P-home'] = inside(h['cols'], h['cw']) and inside(h['card'], h['cw']) and inside(h['rail'], h['cw']) and h['sw'] <= h['cw'] + 1
    R['P-ghost'] = h['ghostDisplay'] == 'none'
    R['D-home'] = hd['tracks'] == 2 and hd['ghostDisplay'] != 'none'
    R['P-header'] = inside(r['snippet'], r['cw']) and r['snippet']['t'] >= r['title']['b'] - 1 and r['hdrTracks'] == 1
    R['D-header'] = rd['hdrTracks'] == 2
    R['P-sblead'] = inside(r['userSeg'], r['cw']) and r['lead']['w'] > 80
    R['P-pop'] = inside(r['pop'], r['cw'])
    R['P-settings'] = r['panel']['r'] <= r['cw'] + 1 and r['close']['r'] <= r['cw'] and r['close']['l'] >= 0
    R['P-snapstack'] = r['snapRight']['t'] >= r['snapLeft']['b'] - 1 and inside(r['snapRight'], r['cw'])
    R['P-snapscroll'] = r['snapCsw'] <= r['snapCcw'] + 1 and r['twSw'] > r['twCw'] and r['twOx'] == 'auto'
    R['P-snapfoot'] = all(x <= r['cw'] + 1 for x in r['footRights'])
    R['T-repo'] = (r8['details']['t'] >= r8['list']['b'] - 1 and r8['splitterDisplay'] == 'none'
                   and r8['list']['w'] >= 0.9 * r8['layoutW'])
    R['T-repo1024'] = r10['details']['l'] > r10['list']['l'] + 100 and r10['splitterDisplay'] != 'none'
    R['P-nav'] = inside(a['nav'], a['cw']) and a['sw'] <= a['cw'] + 1
    R['P-navstatic'] = a['stickPos'] == 'static'
    R['T-navsticky'] = a10['stickPos'] == 'sticky'
    # ...and the controls span the row (without the grid-column they land in the 82px first
    # column of a second row and spill over their neighbours instead of past the viewport).
    R['P-jobs'] = (inside(a['jobK'], a['cw']) and inside(a['jobRow'], a['cw']) and a['jobTo'] == 'none'
                   and a['jobK']['w'] >= 0.8 * a['jobRow']['w'])
    R['P-runs'] = inside(a['runP'], a['cw']) and inside(a['runRow'], a['cw']) and a['runPws'] == 'normal'
    R['P-dash'] = inside(d['actions'], d['cw']) and d['sw'] <= d['cw'] + 1
    R['P-grants'] = a['note']['t'] >= a['save']['b'] - 1 and inside(a['note'], a['cw'])
    R['R-sb'] = rp['sbDisplay'] == 'none' and ap['sbDisplay'] == 'none'
    R['R-adm'] = ap['stickDisplay'] == 'none'
    R['R-heat'] = rgb(rp['heatBg']) == (200, 30, 30) and rgb(rp['heatColor']) == (255, 255, 255)
    R['R-plain'] = rgb(rp['plainBg']) == (255, 255, 255) and rgb(rp['plainColor']) == (0, 0, 0) and rgb(rp['thBg']) == (240, 240, 240)
    R['R-total'] = light(rp['totalBg']) and rgb(rp['totalColor']) == (0, 0, 0)
    R['R-notice'] = rgb(rp['noticeBg']) == (255, 255, 255) and rgb(rp['noticeColor']) == (0, 0, 0)
    R['R-crumb'] = rgb(rp['crumbColor']) == (0, 0, 0)
    return R

def run(label, texts, expect_red):
    install(texts)
    o = observe()
    R = asserts(o)
    red = sorted(k for k, v in R.items() if not v)
    ok = red == sorted(expect_red)
    print('%-14s %s  red=%s%s' % (label, 'OK ' if ok else 'BAD', red or '-', '' if ok else '  expected=%s' % (sorted(expect_red) or '-')))
    if verbose or not ok:
        for k in sorted(R): print('   %-13s %s' % (k, 'green' if R[k] else 'RED'))
        # The raw observations of the last BAD / --verbose build, for a look at the numbers.
        with open(os.path.join(HERE, 'last_obs.json'), 'w') as fh: json.dump({'label': label, 'red': red, 'obs': o}, fh, indent=1)
        print('   (observations: last_obs.json)')
    return ok

try:
    allok = True
    if control:
        allok = run('control', BASE, CONTROL_RED)
    elif one_mutant:
        allok = run('mutant:' + one_mutant, mutate(BASE, one_mutant), MUTANT_RED[one_mutant])
    elif mutants:
        allok = run('candidate', BASE, [])
        for name in A:
            allok = run('mutant:' + name, mutate(BASE, name), MUTANT_RED[name]) and allok
    else:
        allok = run('candidate', BASE, [])
    print('RESULT', 'PASS' if allok else 'FAIL')
finally:
    for p in (edge, srv):
        try: p.kill()
        except Exception: pass
    time.sleep(0.3)
    shutil.rmtree(stage, ignore_errors=True)
sys.exit(0 if allok else 1)
