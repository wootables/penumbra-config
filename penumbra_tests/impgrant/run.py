# =============================================================================
# IMPGRANT SUITE (2026-10-09) - 'imports' as a grants-tool connection
#
# {sql: 'imports'} = every import (+ create your own); {sql: 'imports', tables:
# ['221', ...]} = those imports, BY ID. A holder lists / loads / replaces / appends
# to / undoes on the imports the grant covers; query.php lets them read those.
#   browser half  harness.html (mk_harness.py, from pasteimp's) + driver.js: the REAL
#                 main.js as a holder - paste, append / undo by ID, replace_id, the
#                 sidebar + its menu, the list at boot          L-<scn>-<check>, E-<scn>
#   PHP half      test_impgrant.php: the scope helpers, pnbImportMay and the grants
#                 validator LIFTED and run; the endpoint / query.php by source    P-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
# Headless Edge over CDP; stages into %TEMP%\pnb_ig_*; writes nothing to the webroot.
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
SCN = ['gpaste', 'gnone', 'gside', 'greplace', 'gload', 'gload0']
CHK = {
    'gpaste': ['opens', 'newDisabled', 'appendChecked', 'buttonAdd', 'sentId', 'noSave', 'undoId'],
    'gnone': ['noTargetIgnored', 'noGrantIgnored', 'starOpens', 'starNewChecked'],
    'gside': ['ownerShown', 'noRemoveShared', 'removeMine', 'menuSharedBare', 'menuMineNoDup', 'menuStarDup', 'menuAdminAll'],
    'greplace': ['replaceIdSent', 'mineKept', 'ownNoReplaceId'],
    'gload': ['listCalled', 'mineFlag'],
    'gload0': ['noListCall'],
}
MUTANTS = {
    # main.js
    'm-gate': ([('main', "        if (typeof penumbra_vars === 'undefined' || !(penumbra_vars.isGlobalAdmin || penumbra_vars.importGrant)) return;\r\n",
                 "        if (typeof penumbra_vars === 'undefined' || !penumbra_vars.isGlobalAdmin) return;\r\n")], ['L-gpaste-opens', 'L-gnone-starOpens'], ['gpaste', 'gnone']),
    'm-cancreate': ([('main', "(penumbra_vars.isGlobalAdmin || penumbra_vars.importGrant === '*'));\r\n    }\r\n", "true);\r\n    }\r\n")],
                    ['L-gpaste-newDisabled', 'L-gnone-noTargetIgnored'], ['gpaste', 'gnone']),
    'm-appendid': ([('main', "action: 'append', id: (window._penumbraImportMeta[name] && window._penumbraImportMeta[name].id) || undefined,", "action: 'append',")], ['L-gpaste-sentId'], ['gpaste']),
    'm-undoid': ([('main', "_pnbPasteUndo = { id: r.id, import_name: name,", "_pnbPasteUndo = { import_name: name,")], ['L-gpaste-undoId'], ['gpaste']),
    'm-notarget': ([('main', "        if (!_pnbPasteCanCreate() && !_pnbPasteTargets().length) return;   // impgrant: nowhere this paste could go\r\n", "")], ['L-gnone-noTargetIgnored'], ['gnone']),
    'm-sideremove': ([('main', "            if (!_impNotMine) html += '<div class=\"action-icon\" title=\"Remove imported data\"", "            html += '<div class=\"action-icon\" title=\"Remove imported data\"")], ['L-gside-noRemoveShared'], ['gside']),
    'm-menudup': ([('main', "${(_impCanCreate && !_impNotMine) ?", "${(!_impNotMine) ?")], ['L-gside-menuMineNoDup'], ['gside']),
    'm-menurename': ([('main', "${_impNotMine ? '' : '<div class=\"submenu-item\" data-action=\"import-rename\">Rename</div>'}", "<div class=\"submenu-item\" data-action=\"import-rename\">Rename</div>")], ['L-gside-menuSharedBare'], ['gside']),
    'm-replaceid': ([('main', "replace_id: (_impPrev && _impPrev.mine === false && _impPrev.id) ? _impPrev.id : undefined", "replace_id: undefined")], ['L-greplace-replaceIdSent'], ['greplace']),
    'm-minekept': ([('main', "mine: _impPrev ? _impPrev.mine : true,", "mine: true,")], ['L-greplace-mineKept'], ['greplace']),
    'm-listgate': ([('main', "        if (penumbra_vars.isGlobalAdmin || penumbra_vars.importGrant) {\r\n", "        if (penumbra_vars.isAdmin) {\r\n")], ['L-gload0-noListCall'], ['gload', 'gload0']),
    'm-mineflag': ([('main', "                            mine: (imp.MINE === undefined || imp.MINE === null) ? undefined : !!Number(imp.MINE),\r\n", "")], ['L-gload-mineFlag'], ['gload']),
    # PHP
    'p-scopeempty': ([('db', "        return $ids ? array_keys($ids) : null;\n", "        return $ids ? array_keys($ids) : '*';\n")], ['P-S5'], []),
    'p-maygrant': ([('mi', "    return isset($row['ID']) && (int)$row['ID'] > 0 && penumbraImportGrantCovers($userGrants, (int)$row['ID']);\n", "    return false;\n")], ['P-M3'], []),
    'p-gate': ([('mi', "if (!$isAdmin && $impScope === null) {", "if (!$isAdmin) {")], ['P-G1'], []),
    'p-create': ([('mi', "        // A NEW import: an admin, or the whole-connection imports grant (impgrant).\n        if (!$impCanCreate) {", "        // A NEW import: an admin, or the whole-connection imports grant (impgrant).\n        if (false) {")], ['P-SV2'], []),
    'p-replacemay': ([('mi', "            if (empty($existing) || !pnbImportMay($existing[0], $isAdmin, $currentUserKey, $userGrants)) {", "            if (empty($existing)) {")], ['P-SV3'], []),
    'p-loadmay': ([('mi', "        if (!pnbImportMay(array('ID' => $id, 'USER_ID' => $meta[0]['USER_ID']), $isAdmin, $currentUserKey, $userGrants)) {", "        if (false) {")], ['P-LD1'], []),
    'p-qidor': ([('q', "if (!$_ownsImport && !$_importForRpt && !$_importGranted) {", "if (!$_ownsImport && !$_importForRpt) {")], ['P-Q1'], []),
    'p-admin': ([('ga', "        if (in_array(strtolower($uid), pnb_admin_ids(), true)) {", "        if (false) {")], ['P-A1', 'P-A2'], []),
    'p-validid': ([('ga', "                        if ($conn === 'imports' && !preg_match('/^[0-9]{1,12}$/', $t)) { $err = \"invalid import id '$t' for '$uid'\"; return null; }\n", "")], ['P-V2'], []),
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
RELS = {'main': os.path.join('js', 'main.js'), 'db': 'db_connection.php', 'mi': 'manage_imports.php', 'q': 'query.php', 'ga': 'grants_admin.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__HC = {}; window.__HC.psb = populateSelectorBox; window.__HC.menu = showImportMoreOptions; }'
         ' catch (e) { window.__HC_ERR = String(e); }\r\n')
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

stage = tempfile.mkdtemp(prefix='pnb_ig_')
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
    d = tempfile.mkdtemp(prefix='pnb_igp_')
    try:
        paths = []
        for k in ('db', 'mi', 'q', 'ga'):
            a = os.path.join(d, k + '.php')
            open(a, 'wb').write(texts[k].encode('utf-8', 'surrogateescape'))
            paths.append(a)
        out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_impgrant.php')] + paths, capture_output=True, text=True)
        res = []
        for line in out.stdout.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: res.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3)))
        if 'TOTAL' not in out.stdout: res.append(('P-ran', False, (out.stdout + out.stderr)[-400:]))
        for k, a in zip(('db', 'mi', 'q', 'ga'), paths):
            l = subprocess.run([PHP, '-n', '-l', a], capture_output=True, text=True).stdout
            res.append(('P-lint-' + k, 'No syntax errors' in l, l.strip()[:200]))
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
    print('under test: %s' % json.dumps(cand))
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
            sane = [a for a in failed if a.startswith('E-') or a.startswith('F-') or a.startswith('P-lint') or a in ('P-S0', 'P-ran')]
            # hold before the change too: a non-holder's paste is ignored, the old engine's own
            # behaviour (own-only list, admin-all menu, own-name save), lint, the file read
            # (the validator lifts and keeps IDs / none-checked before too - only the ID RULE is new;
            # an old holder-less page never opens a paste, and the old menu always offered Duplicate)
            absent = {'L-gnone-noGrantIgnored', 'L-gnone-noTargetIgnored', 'L-gside-removeMine', 'L-gside-menuAdminAll', 'L-gside-menuStarDup',
                      'L-greplace-ownNoReplaceId', 'L-gload-listCalled',
                      'P-S0', 'P-G2', 'P-R2', 'P-V0', 'P-V2a', 'P-V3', 'P-V4', 'P-lint-db', 'P-lint-mi', 'P-lint-q', 'P-lint-ga'}
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
