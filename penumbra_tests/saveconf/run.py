# =============================================================================
# SAVECONF SUITE (2026-10-09) - the save-conflict warning
#
# Saving over the report the page loaded sends the version it loaded
# (penumbra_vars.reportVersion = {id, at}, index.php); save_server_state.php
# answers 409 {conflict, who, when} when the report was saved since, and the
# dialog says so with "Save anyway" (force, that one save) / open the latest /
# see what changed. A success hands the page the new version.
#   browser half  harness.html + driver.js: the REAL main.js save handler against
#                 a stubbed endpoint                      L-<scn>-<check>, E-<scn>
#   PHP half      test_saveconf.php: pnbSaveConflict() lifted and run, order /
#                 shape source checks, the SAME TO_CHAR format on both sides  P-*
#
#   py -3 run.py                 candidate = LIVE (main.js, save_server_state.php, index.php)
#   py -3 run.py --stage DIR     a stage in the app layout (each file from DIR when there, else live)
#   py -3 run.py --control       live files, expecting RED on everything new (before the deploy)
#   py -3 run.py --mutants | --mutant NAME
# Headless Edge over CDP; stages into %TEMP%\pnb_sc_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['base', 'conflict', 'self', 'otherid', 'nover', 'validate', 'jsaveas']
CHK = {
    'base': ['sentBase', 'versionMoved', 'secondSendsNew'],
    'conflict': ['noticeWho', 'noticeButtons', 'dialogStays', 'buttonBack', 'versionKept', 'forceSent', 'forceSaved', 'forceOnce'],
    'self': ['selfWords', 'rollbackWords'],
    'otherid': ['otherNoBase', 'otherVersion', 'noOverwriteNoBase'],
    'nover': ['noVersionNoBase'],
    'jsaveas': ['otherIdDropped', 'otherKeepsRest', 'sameIdKept', 'notExploringKept'],
    'validate': ['saneStopped', 'forceNotCarried'],
}
MUTANTS = {
    # jsaveas (2026-10-10): an explored table saved under another id leaves the journal out
    'js-nostrip': ([('main', "        if (window._penumbraJournalExploring && stateObject.viewOptions\r\n", "        if (false && stateObject.viewOptions\r\n")], ['L-jsaveas-otherIdDropped'], ['jsaveas']),
    'js-anyid': ([('main', "                && shortId !== String((window.Penumbra && window.Penumbra.journalReportId) || '')) {\r\n", "                && true) {\r\n")], ['L-jsaveas-sameIdKept'], ['jsaveas']),
    # main.js
    'nobase': ([('main', "                    base_updated_at: _pnbBase,\r\n", "")], ['L-base-sentBase'], ['base']),
    'noversionmove': ([('main', "                penumbra_vars.reportVersion = { id: response.new_id || shortId, at: response.updated_at };\r\n", "")],
                      ['L-base-versionMoved', 'L-base-secondSendsNew'], ['base']),
    'no409': ([('main', "            if (e.status === 409 && e.responseJSON && e.responseJSON.conflict) {\r\n", "            if (false) {\r\n")],
              ['L-conflict-noticeWho'], ['conflict']),
    'forcesticky': ([('main', "        _pnbSaveForce = false;\r\n", "")], ['L-conflict-forceOnce', 'L-validate-forceNotCarried'], ['conflict', 'validate']),
    'baseanyid': ([('main', "_pnbVer.id.trim() === shortId)", "true)")], ['L-otherid-otherNoBase'], ['otherid']),
    # PHP
    'noforce': ([('ss', "    if (!empty($data['force'])) return false;\n", "")], ['P-D4'], []),
    'noconflictcall': ([('ss', "            if (pnbSaveConflict($data, isset($before_data['UPDATED_AT_TXT'])", "            if (false && pnbSaveConflict($data, isset($before_data['UPDATED_AT_TXT'])")],
                       ['P-O1'], []),
    'fmtdrift': ([('ix', "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') AS UPDATED_AT_TXT", "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF3') AS UPDATED_AT_TXT")],
                 ['P-T2'], []),
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
cand = {'main': pick(os.path.join('js', 'main.js')), 'ss': pick('save_server_state.php'), 'ix': pick('index.php')}
if control: cand = {'main': os.path.join(APP, 'js', 'main.js'), 'ss': os.path.join(APP, 'save_server_state.php'), 'ix': os.path.join(APP, 'index.php')}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_sc_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('main.css', 'density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
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
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_php(texts):
    d = tempfile.mkdtemp(prefix='pnb_scp_')
    try:
        a, b = os.path.join(d, 'ss.php'), os.path.join(d, 'ix.php')
        open(a, 'wb').write(texts['ss'].encode('utf-8', 'surrogateescape')); open(b, 'wb').write(texts['ix'].encode('utf-8', 'surrogateescape'))
        out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_saveconf.php'), a, b], capture_output=True, text=True).stdout
        res = []
        for line in out.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: res.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3)))
        for f in ('ss', 'ix'):
            l = subprocess.run([PHP, '-n', '-l', a if f == 'ss' else b], capture_output=True, text=True).stdout
            res.append(('P-lint-' + f, 'No syntax errors' in l, l.strip()[:200]))
        return res
    finally:
        shutil.rmtree(d, ignore_errors=True)

def run_browser(texts, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    out = []
    for s in scns:
        r = run_page(s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:300]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('candidate: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            res = (run_browser(t, scns) if scns else []) + run_php(t)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        res = run_php(texts) + run_browser(texts, SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            sane = [a for a in failed if a.startswith('E-') or a.startswith('F-') or a in ('P-S0', 'P-lint-ss', 'P-lint-ix')]
            # absence checks (no version sent) hold before the change too; P-O7 likewise
            absent = {'L-otherid-otherNoBase', 'L-otherid-noOverwriteNoBase', 'L-nover-noVersionNoBase', 'P-O7', 'P-S0', 'P-lint-ss', 'P-lint-ix',
                      'L-conflict-dialogStays', 'L-conflict-buttonBack', 'L-conflict-versionKept'}   # any save error already did these
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
