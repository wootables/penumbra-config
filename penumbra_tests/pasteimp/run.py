# =============================================================================
# PASTEIMP SUITE (2026-10-09) - paste cells as an import, or append them to one
#
# Ctrl+V on the page (not in a field / editor / dialog) with a block of cells opens
# a preview: a NEW import (importFileData, tab-separated) or ADD to one of your
# imports (manage_imports.php action=append; new columns after a confirm; Undo =
# action=append_undo). Global admins only.
#   browser half  harness.html (mk_harness.py) + driver.js: the REAL main.js paste
#                 path against a stubbed endpoint          L-<scn>-<check>, E-<scn>
#   PHP half      test_pasteimp.php: the merge / undo helpers LIFTED and run (incl.
#                 the undo round trip), the actions' order by source       P-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
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
SCN = ['newimp', 'hashcol', 'ignore', 'append', 'addcols', 'undo', 'refuse', 'rerun']
CHK = {
    'newimp': ['prevented', 'preview', 'previewCells', 'defaultName', 'headFlush', 'saved', 'savedText', 'closed'],
    'hashcol': ['hashDropped', 'cancelCloses', 'oneColumn', 'commaKept'],
    'ignore': ['inInputIgnored', 'oneLineIgnored', 'nonAdminIgnored', 'editorIgnored', 'dialogIgnored', 'saneStillWorks'],
    'append': ['targetListed', 'buttonSaysAdd', 'sent', 'noSave', 'closed', 'notice', 'metaCount'],
    'addcols': ['asks', 'firstNoAdd', 'secondAdds', 'doneNotice'],
    'undo': ['undoSent', 'undoNotice', 'undoMeta', 'undoLinkGone', 'undoOnce'],
    'refuse': ['folderShown', 'escCloses'],
    'rerun': ['reran'],
}
MUTANTS = {
    # main.js
    'typing': ([('main', "        if (_pnbPasteIsTyping(e.target) || _pnbPasteIsTyping(document.activeElement)) return;\r\n", "")],
               ['L-ignore-inInputIgnored', 'L-ignore-editorIgnored'], ['ignore']),
    # (impgrant: a second guard - nowhere this paste could go - also stops a non-holder; drop both)
    'nonadmin': ([('main', "        if (typeof penumbra_vars === 'undefined' || !(penumbra_vars.isGlobalAdmin || penumbra_vars.importGrant)) return;\r\n", ""),
                  ('main', "        if (!_pnbPasteCanCreate() && !_pnbPasteTargets().length) return;   // impgrant: nowhere this paste could go\r\n", "")], ['L-ignore-nonAdminIgnored'], ['ignore']),
    'commasplit': ([('main', "        var rows = parseCSVToObjects(String(text).replace(/\\r\\n?/g, '\\n'), '\\t');\r\n", "        var rows = parseCSVToObjects(String(text).replace(/\\r\\n?/g, '\\n'));\r\n")],
                   ['L-hashcol-commaKept'], ['hashcol']),
    'noname': ([('main', "        var safeName = ((opts && opts.name) ? String(opts.name) : fileName.replace(", "        var safeName = ((false) ? String(opts.name) : fileName.replace(")],
               ['L-newimp-saved'], ['newimp']),
    'alwaysadd': ([('main', "            _pnbPasteAppend(target, rows, false);\r\n", "            _pnbPasteAppend(target, rows, true);\r\n")], ['L-addcols-firstNoAdd'], ['addcols']),
    'undotwice': ([('main', "        _pnbPasteUndo = null;\r\n        $.ajax({\r\n", "        $.ajax({\r\n"),
                    ('main', "        $(this).replaceWith('<span style=\"margin-left:8px; opacity:0.7;\">(undone)</span>');\r\n", "")], ['L-undo-undoOnce'], ['undo']),
    'undolink': ([('main', "        $(this).replaceWith('<span style=\"margin-left:8px; opacity:0.7;\">(undone)</span>');\r\n", "")], ['L-undo-undoLinkGone'], ['undo']),
    'noesc': ([('main', "            e.preventDefault(); e.stopPropagation();\r\n            _pnbPasteClose();\r\n", "            e.preventDefault(); e.stopPropagation();\r\n")], ['L-refuse-escCloses'], ['refuse']),
    'headinset': ([('main', 'modal-prompt-box infobox-dialog" style="position:relative; width:min(760px, 94vw);', 'modal-prompt-box" style="position:relative; width:min(760px, 94vw);')], ['L-newimp-headFlush'], ['newimp']),
    'norerun': ([('main', "            _pnbPasteRerun(name);\r\n        }).fail(", "        }).fail(")], ['L-rerun-reran'], ['rerun']),
    # PHP
    'nomissingfill': ([('mi', "        foreach ($all as $c) { $full[$c] = array_key_exists($c, $r) ? $r[$c] : ''; }\n", "        $full = $r;\n")], ['P-A2'], []),
    'undokeepcols': ([('mi', "    if (count($dropColumns)) {\n", "    if (false) {\n")], ['P-U1'], []),
    'nofolder': ([('mi', "        if (pnbImportFolderBacked($import_name, $meta[0]['FILENAME'])) {\n", "        if (false) {\n")], ['P-P2'], []),
    'undonotoken': ([('mi', " || (string)$meta[0]['TOK'] !== $token) {", ") {")], ['P-P7'], []),
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
cand = {'main': pick(os.path.join('js', 'main.js')), 'mi': pick('manage_imports.php')}
if control: cand = {'main': os.path.join(APP, 'js', 'main.js'), 'mi': os.path.join(APP, 'manage_imports.php')}
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
    d = tempfile.mkdtemp(prefix='pnb_pip_')
    try:
        a = os.path.join(d, 'mi.php')
        open(a, 'wb').write(texts['mi'].encode('utf-8', 'surrogateescape'))
        out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_pasteimp.php'), a], capture_output=True, text=True).stdout
        res = []
        for line in out.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: res.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3)))
        l = subprocess.run([PHP, '-n', '-l', a], capture_output=True, text=True).stdout
        res.append(('P-lint-mi', 'No syntax errors' in l, l.strip()[:200]))
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
            sane = [a for a in failed if a.startswith('E-') or a.startswith('F-') or a in ('P-S0', 'P-lint-mi')]
            # absence checks (no version sent) hold before the change too; P-O7 likewise
            absent = {'L-ignore-inInputIgnored', 'L-ignore-oneLineIgnored', 'L-ignore-nonAdminIgnored', 'L-ignore-editorIgnored', 'L-ignore-dialogIgnored',
                      'L-hashcol-cancelCloses', 'P-S0', 'P-P9', 'P-lint-mi'}   # hold before the change: nothing happens on a paste
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
