# =============================================================================
# BULK SETTINGS SUITE "bulkset" (2026-10-13)
#
# Management Mode's "Bulk settings..." dialog: js/penumbra_bulkset.js works out each
# report's change in the browser and saves it through save_server_state.php;
# bulk_settings_read.php feeds it. Two halves:
#
#   BROWSER  harness.html + tests.js run the module under test in headless Edge,
#            with main.js's OWN encryptState/decryptState lifted verbatim (crypto
#            parity) and a mocked $.ajax (the dialog driven end to end).
#            A-* access rules  T-* tags  S-* state edits  G-* password gates
#            X-* crypto parity  P-* per-report plans + payloads  D-* the dialog
#   PHP      test_bulkset.php: the read endpoint's pure helpers and admin gate,
#            the save endpoint's bulk_batch / owner_id / [via] changes (source pins
#            + lifted functions), the repository button + loader, index.php assets.
#
#   py -3 run.py                  candidate = the live webroot
#   py -3 run.py --app DIR        candidate = DIR (app layout; a file DIR lacks comes from live)
#   py -3 run.py --mutants | --mutant NAME   single-point edits of the module; each
#                                 must turn EXACTLY its listed asserts red
#   --keep  keep the staging dir
#
# Stages into %TEMP%; writes nothing to the webroot. Needs Python 3 + websocket-client.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'

# name -> ([(old, new), ...] applied to penumbra_bulkset.js, [asserts that must go red])
MUTANTS = {
    'adddupes':   ([("            out = dedupeAccess(cur.concat(items));", "            out = cur.concat(items);")],
                   ['A5', 'P11']),
    'removeexact': ([("            items.forEach(function (x) { drop[authKey(x)] = true; });\n            out = cur.filter(function (x) { return !drop[authKey(x)]; });",
                      "            items.forEach(function (x) { drop[x] = true; });\n            out = cur.filter(function (x) { return !drop[x]; });")],
                    ['A6']),
    'notagsbase': ([("            body.tags_base = r.tags.slice();   // only this run's adds and removes move\n", "")],
                   ['P7']),
    # every report opened, even when only the access list / tags change: a protected
    # report then needs its password for a change that never touches its state
    'alwaysopen': ([("        if (!needState) { return Promise.resolve(finish()); }\n", "")],
                   ['P20', 'B3']),
    # a state that was opened but did not change is re-serialized instead of sent as stored
    'reserialize': ([("        if (!plan.newState || (!plan.stateTouched && !plan.pwOp)) {", "        if (!plan.newState) {")],
                    ['P13b']),
    'gatesnaps':  ([("        if (r.enc_snaps > 0) {", "        if (false) {")],
                   ['G5', 'P28']),
    'gatescan':   ([("        if (!scan || !scan.snaps || !scan.tasks) {", "        if (!scan) {")],
                   ['G7']),
    'gatetasks':  ([("            if (r.tasks > 0) {", "            if (false) {")],
                   ['G2']),
    'viewinvert': ([("                var on = (o.kind === 'hide') ? (v === 'hide') : (v === 'on');", "                var on = (o.kind === 'hide') ? (v === 'show') : (v === 'on');")],
                   ['S8', 'S10', 'B6', 'D10', 'D13', 'D17', 'D18', 'D19', 'D21']),   # the dialog run hides Export: inverted, 'second' matches already
    'noclearkey': ([("            else if (op.mode === 'clear') { delete s[k]; }", "            else if (op.mode === 'clear') { s[k] = ''; }")],
                   ['S2']),
    'escleak':    ([("        if (e.key !== 'Escape') { return; }\n        e.stopImmediatePropagation();\n", "        if (e.key !== 'Escape') { return; }\n")],
                   ['D15']),
    'noscope':    ([("        body.scope_source_query = typeof plan.newState.query === 'string' ? plan.newState.query : '';\n", "")],
                   ['P24', 'P29']),
    'samepwseal': ([("                plan.finalEncrypted = true; plan.finalPassword = spec.password.value;\n                plan.changes.push({ label: 'Password', before: 'set', after: 'changed' });",
                     "                plan.finalEncrypted = true; plan.finalPassword = ctx.currentPassword;\n                plan.changes.push({ label: 'Password', before: 'set', after: 'changed' });")],
                   ['P25']),
    'savealways': ([("            plan.status = plan.changes.length ? 'update' : 'same';", "            plan.status = 'update';")],
                   ['P6', 'P11', 'B2', 'B3', 'B5']),
    'nobatch':    ([("            bulk_batch: batch,\n", "")],
                   ['P2', 'D18']),
    # --- bug sweep 2026-10-13: each fix reverted must go red ---
    'syncthrow':  ([("            return Promise.reject(new Error('Incorrect Password or Corrupt Data'));\n        }", "            throw new Error('Incorrect Password or Corrupt Data');\n        }")],
                   ['B1']),
    'phantomtitle': ([("            if (replaced !== r.title) {", "            if (true) {")],
                     ['B2']),
    'titleforces': ([("        var needState = specTouchesState(spec) || titleChanged;", "        var needState = specTouchesState(spec) || !!spec.titleReplace;")],
                    ['B3']),
    'rpptype':    ([("spec.rowsPerPage.mode === 'set' && String(s.rowsPerPage) !== String(spec.rowsPerPage.value)) {", "spec.rowsPerPage.mode === 'set') {")],
                   ['B5']),
    'emptyvo':    ([("            if (s.viewOptions || Object.keys(vo).length) { s.viewOptions = vo; }", "            s.viewOptions = vo;")],
                   ['B6']),
    'dropscope':  ([("            if (plan.scopeTables) { w.scope_tables = plan.scopeTables; }\n", "")],
                   ['B7']),
    'notabtrap':  ([("        if (e.key === 'Tab') {", "        if (false) {")],
                   ['B9', 'B10', 'B11']),
    'nostop403':  ([("                        while (i < plans.length) {\n                            results.push({ p: plans[i++], ok: false, msg: 'not attempted: the run stopped when the session ended' });\n                        }\n                        return finishRun(results, batch);\n", "")],
                   ['B12', 'B13']),
    'noreplaceword': ([("            if (m === 'replace' && $.trim($r.find('.pbs-replace-word').val()) !== 'REPLACE') {", "            if (false) {")],
                      ['D6']),
    # --- WCAG names 2026-10-15: each fix reverted must go red ---
    'modekeyname': ([("'\" aria-labelledby=\"' + labelId(name) + '\"' +", "'\" aria-label=\"' + esc(name) + ' change\"' +")],
                    ['D22']),
    'novaluename': ([("var h = '<select class=\"' + cls + '\"' + (name ? ' aria-label=\"' + esc(name) + '\"' : '') + '>';", "var h = '<select class=\"' + cls + '\">';")],
                    ['D23', 'D24']),
    'curpwunlinked': ([('autocomplete="off" aria-labelledby="pbsLbl-curpw" aria-describedby="pbsHint-curpw" placeholder', 'autocomplete="off" placeholder')],
                      ['D23', 'D24']),
    'pwplaceholder': ([('autocomplete="new-password" aria-label="Confirm new password" placeholder', 'autocomplete="new-password" placeholder')],
                      ['D23', 'D24']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app = opt('--app', LIVE)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
keep = flag('--keep')

def pick(rel):
    p = os.path.join(app, rel)
    return p if os.path.isfile(p) else os.path.join(LIVE, rel)
def read(p): return open(p, 'rb').read().decode('utf-8')

def lift_main_crypto():
    src = read(os.path.join(LIVE, 'js', 'main.js'))
    a = src.find('    async function deriveGcmKey(')
    b = src.find('    // --- Snapshot-at-rest codec')
    if a < 0 or b < 0 or b < a: raise SystemExit('main.js crypto anchors not found')
    body = src[a:b]
    return ('try { window.__mainCrypto = (function () {\n' + body +
            '\nreturn { deriveGcmKey: deriveGcmKey, encryptState: encryptState, decryptState: decryptState }; })(); }'
            ' catch (e) { window.__mainCryptoErr = String(e); }\n')

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class Edge:
    def __init__(self, stage):
        self.hp, self.dp = free_port(), free_port()
        self.srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(self.hp), '--bind', '127.0.0.1', '--directory', stage],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                                      '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1400,900',
                                      '--remote-debugging-port=%d' % self.dp, '--remote-allow-origins=*', 'about:blank'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws_url = None
        for _ in range(100):
            try:
                tg = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json' % self.dp, timeout=2).read())
                pages = [t for t in tg if t.get('type') == 'page' and t.get('url', '').startswith('about:blank')]
                if pages: ws_url = pages[0]['webSocketDebuggerUrl']; break
            except Exception: pass
            time.sleep(0.2)
        if not ws_url: raise SystemExit('no Edge page target')
        self.ws = websocket.create_connection(ws_url, timeout=120)
        self.n = 0
        self.errors = []
        self.cmd('Runtime.enable'); self.cmd('Network.enable'); self.cmd('Network.setCacheDisabled', {'cacheDisabled': True})
    def cmd(self, method, params=None):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('method') == 'Runtime.exceptionThrown':
                self.errors.append(m['params']['exceptionDetails'].get('exception', {}).get('description') or m['params']['exceptionDetails'].get('text'))
            if m.get('id') == mid: return m
    def run_page(self, name):
        self.errors = []
        self.cmd('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (self.hp, name)})
        for _ in range(100):
            r = self.cmd('Runtime.evaluate', {'expression': 'typeof window.__run', 'returnByValue': True})
            if r.get('result', {}).get('result', {}).get('value') == 'function': break
            time.sleep(0.1)
        r = self.cmd('Runtime.evaluate', {'expression': 'window.__run()', 'awaitPromise': True, 'returnByValue': True})
        return r.get('result', {}).get('result', {}).get('value') or [{'id': 'Z no result', 'ok': False, 'info': json.dumps(r)[:400]}]
    def close(self):
        try: self.ws.close()
        except Exception: pass
        for p in (self.edge, self.srv):
            try: p.kill()
            except Exception: pass

def stage_page(stage, name, module_src):
    open(os.path.join(stage, name + '_bulkset.js'), 'wb').write(module_src.encode('utf-8'))
    html = ('<!doctype html><html><head><meta charset="utf-8"><title>bulkset</title>'
            '<link rel="stylesheet" href="penumbra_bulkset.css"></head><body>'
            '<script src="jquery.js"></script><script src="crypto_main.js"></script>'
            '<script src="%s_bulkset.js"></script><script src="tests.js"></script></body></html>') % name
    open(os.path.join(stage, name + '.html'), 'w', encoding='utf-8').write(html)
    return name + '.html'

def php_half():
    out = []
    cmd = [PHP, '-n', '-d', 'date.timezone=America/New_York', os.path.join(HERE, 'test_bulkset.php'),
           pick('bulk_settings_read.php'), pick('save_server_state.php'), pick(os.path.join('js', 'penumbra_repository.js')), pick('index.php')]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    for line in p.stdout.splitlines():
        m = re.match(r'\s*(PASS|FAIL)\s+(\S+)\s*(.*)', line)
        if m: out.append(('H-' + m.group(2), m.group(1) == 'PASS', m.group(3)))
    if not out: out.append(('H-none', False, (p.stdout + p.stderr)[:400]))
    for f in ('bulk_settings_read.php', 'save_server_state.php', 'index.php'):
        l = subprocess.run([PHP, '-n', '-l', pick(f)], capture_output=True, text=True).stdout
        out.append(('H-lint-' + f, 'No syntax errors' in l, l.strip()[:200]))
    return out

def main():
    stage = tempfile.mkdtemp(prefix='pnb_bulkset_')
    shutil.copy(os.path.join(LIVE, 'js', 'jquery-3.7.1.min.js'), os.path.join(stage, 'jquery.js'))
    # A candidate without the module (live before the deploy) must come out RED, not crash.
    css = pick(os.path.join('css', 'penumbra_bulkset.css'))
    open(os.path.join(stage, 'penumbra_bulkset.css'), 'wb').write(open(css, 'rb').read() if os.path.isfile(css) else b'')
    shutil.copy(os.path.join(HERE, 'tests.js'), os.path.join(stage, 'tests.js'))
    open(os.path.join(stage, 'crypto_main.js'), 'w', encoding='utf-8').write(lift_main_crypto())
    mod = pick(os.path.join('js', 'penumbra_bulkset.js'))
    module = read(mod) if os.path.isfile(mod) else ''
    print('candidate: %s' % app)
    edge = Edge(stage)
    rc = 0
    try:
        if one_mutant or all_mutants:
            names = [one_mutant] if one_mutant else list(MUTANTS)
            bad = 0
            for nm in names:
                edits, want = MUTANTS[nm]
                src = module
                for old, new in edits:
                    if src.count(old) != 1: raise SystemExit('mutant %s: anchor count %d: %r' % (nm, src.count(old), old[:80]))
                    src = src.replace(old, new)
                res = edge.run_page(stage_page(stage, 'm_' + nm, src))
                red = sorted(set(r['id'].split(' ')[0] for r in res if not r['ok']))
                good = red == sorted(want)
                bad += 0 if good else 1
                print('  %-14s %s  red=%s%s' % (nm, 'OK  ' if good else 'MISS', ','.join(red), '' if good else '   want=' + ','.join(sorted(want))))
            print('MUTANTS: %d of %d as expected' % (len(names) - bad, len(names)))
            rc = 1 if bad else 0
        else:
            res = edge.run_page(stage_page(stage, 'cand', module))
            rows = [(r['id'], r['ok'], r.get('info', '')) for r in res]
            rows.append(('E-page-errors', not edge.errors, '; '.join(map(str, edge.errors))[:400]))
            rows += php_half()
            p = sum(1 for r in rows if r[1]); f = len(rows) - p
            for rid, okk, info in rows:
                if not okk: print('  FAIL  %s   %s' % (rid, info))
            print('PASS: %d   FAIL: %d' % (p, f))
            print('RESULT: %s' % ('GREEN' if f == 0 else 'RED'))
            rc = 0 if f == 0 else 1
    finally:
        edge.close()
        if not keep: shutil.rmtree(stage, ignore_errors=True)
        else: print('kept ' + stage)
    sys.exit(rc)

main()
