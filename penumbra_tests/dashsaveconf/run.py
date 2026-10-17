# =============================================================================
# DASHSAVECONF SUITE (2026-10-16) - the save-conflict warning on DASHBOARDS
# (the report page's saveconf of 2026-10-09, carried to manage_dashboard.php)
#
# Saving over the dashboard the page loaded sends the version it loaded
# (penumbra_dash_vars.meta.version, dashboard.php; action=get's version after a
# kiosk hop); manage_dashboard.php answers 409 {conflict, who, when} when the
# dashboard was saved since, and the page says so with "Save anyway" (force, that
# one save) / open the latest. A success hands the page the new version.
#   browser half  harness.html: the REAL penumbra_dashboard.js save path against a
#                 stubbed endpoint                         L-<scn>-<check>, E-<scn>
#   PHP half      test_dashsaveconf.php: dashSaveConflict() lifted and run, order /
#                 shape source checks, the SAME TO_CHAR format on both sides  P-*
#
#   py -3 run.py                 candidate = LIVE (penumbra_dashboard.js, manage_dashboard.php, dashboard.php)
#   py -3 run.py --stage DIR     a stage in the app layout (each file from DIR when there, else live)
#   py -3 run.py --control       live files, expecting RED on everything new (before the deploy)
#   py -3 run.py --mutants | --mutant NAME     (with --stage DIR: mutate the stage)
# Headless Edge over CDP; stages into %TEMP%\pnb_dsc_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'chart-4.5.1.min.js', 'purify.min.js', 'penumbra_tiles.js']
CSS = ['main.css', 'penumbra_tiles.css', 'penumbra_dashboard.css']
SCN = ['base', 'conflict', 'self', 'nover', 'isnew', 'plainerr']
CHK = {
    'base': ['sentBase', 'noForce', 'versionMoved'],
    'conflict': ['noticeWho', 'noticeEscaped', 'noticeButtons', 'buttonBack', 'openLatest', 'openNoSave', 'forceSent', 'forceSaved', 'forceOnce', 'versionAdopted'],
    'self': ['selfWords', 'unknownWho', 'oneNotice'],
    'nover': ['noVersionNoBase'],
    'isnew': ['newNoBase', 'newAdopts'],
    'plainerr': ['plainError', 'bare409Plain', 'forceNotCarried'],
}
# Source checks on the page script the scenarios cannot reach (the kiosk hop).
SRC = {
    'S-hopVersion': "                if (typeof r.version === 'string') { META.version = r.version; }   // its save-conflict token (2026-10-16)",
}
MUTANTS = {
    # penumbra_dashboard.js
    'nobase': ([('js', "        if (!IS_NEW && typeof META.version === 'string') { payload.base_updated_at = META.version; }", "")],
               ['L-base-sentBase'], ['base']),
    'noadopt': ([('js', "                if (typeof r.version === 'string') { META.version = r.version; }   // the row as this save left it", "                // gone")],
                ['L-base-versionMoved', 'L-conflict-versionAdopted', 'L-isnew-newAdopts'], ['base', 'conflict', 'isnew']),
    'no409': ([('js', "            if (x && x.status === 409 && x.responseJSON && x.responseJSON.conflict) {", "            if (false) {")],
              ['L-conflict-noticeWho', 'L-conflict-noticeButtons'], ['conflict']),
    'forcesticky': ([('js', "        _dashSaveForce = false;\r\n        var payload", "        var payload")],
                    ['L-conflict-forceOnce'], ['conflict']),
    'noforceflag': ([('js', "        if (forceNow) { payload.force = true; }", "")], ['L-conflict-forceSent'], ['conflict']),
    'noescape': ([('js', "<span style='color: var(--accent-danger, #cc0000)'>NOT SAVED:</span> \" + escapeHtml(lead) +", "<span style='color: var(--accent-danger, #cc0000)'>NOT SAVED:</span> \" + lead +")],
                 ['L-conflict-noticeEscaped'], ['conflict']),
    'nohop': ([('js', SRC['S-hopVersion'], "")], ['S-hopVersion'], []),
    # manage_dashboard.php / dashboard.php
    'noforce': ([('md', "    if (!empty($data['force'])) return false;\n", "")], ['P-D4'], []),
    'noconflictcall': ([('md', "            if (dashSaveConflict($input, $dashCurVer)) {", "            if (false && dashSaveConflict($input, $dashCurVer)) {")], ['P-O1'], []),
    'no409php': ([('md', "                http_response_code(409);\n", "")], ['P-O5'], []),
    'noversionback': ([('md', "                              'version' => dashVersionOf($oracleConn, (int)$existing['ID'])]);", "                              ]);")], ['P-O9'], []),
    'fmtdrift': ([('dp', "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') AS VERSION_TXT", "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF3') AS VERSION_TXT")], ['P-T2'], []),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {'js': pick(os.path.join('js', 'penumbra_dashboard.js')), 'md': pick('manage_dashboard.php'), 'dp': pick('dashboard.php')}
if control: cand = {'js': os.path.join(APP, 'js', 'penumbra_dashboard.js'), 'md': os.path.join(APP, 'manage_dashboard.php'), 'dp': os.path.join(APP, 'dashboard.php')}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_dsc_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, 'harness.html'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(scn):
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
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 90:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (90 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_php(texts):
    d = tempfile.mkdtemp(prefix='pnb_dscp_')
    try:
        a, b = os.path.join(d, 'md.php'), os.path.join(d, 'dp.php')
        open(a, 'wb').write(texts['md'].encode('utf-8', 'surrogateescape')); open(b, 'wb').write(texts['dp'].encode('utf-8', 'surrogateescape'))
        out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_dashsaveconf.php'), a, b], capture_output=True, text=True).stdout
        res = []
        for line in out.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: res.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3)))
        for f, pth in (('md', a), ('dp', b)):
            l = subprocess.run([PHP, '-n', '-l', pth], capture_output=True, text=True).stdout
            res.append(('P-lint-' + f, 'No syntax errors' in l, l.strip()[:200]))
        return res
    finally:
        shutil.rmtree(d, ignore_errors=True)

def run_src(texts):
    return [(k, texts['js'].count(v) == 1, 'found %d times' % texts['js'].count(v)) for k, v in SRC.items()]

def run_browser(texts, scns):
    open(os.path.join(stage, 'dash_hc.js'), 'wb').write(texts['js'].encode('utf-8', 'surrogateescape'))
    out = []
    for s in scns:
        r = run_page(s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:400]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('candidate: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            res = (run_browser(t, scns) if scns else []) + run_php(t) + run_src(t)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        res = run_php(texts) + run_src(texts) + run_browser(texts, SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            sane = [a for a in failed if a.startswith('E-') or a.startswith('F-') or a in ('P-S0', 'P-lint-md', 'P-lint-dp')]
            # checks that hold BEFORE the change too: no version is sent, ordinary errors stay ordinary
            absent = {'L-base-noForce', 'L-nover-noVersionNoBase', 'L-isnew-newNoBase', 'L-conflict-buttonBack', 'L-conflict-openNoSave',
                      'L-plainerr-plainError', 'L-plainerr-bare409Plain', 'L-plainerr-forceNotCarried', 'L-self-oneNotice', 'L-conflict-forceOnce',
                      'P-S0', 'P-lint-md', 'P-lint-dp', 'P-O13', 'P-O15'}
            sane += [a for a, passed, _ in res if passed and not (a.startswith('E-') or a in absent)]
            print('CONTROL: %d new checks red (expected); harness problems or checks that hold WITHOUT the change: %s' % (f, ' '.join(sane) or 'none'))
            print('RESULT: GREEN' if not sane and f > 0 else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
