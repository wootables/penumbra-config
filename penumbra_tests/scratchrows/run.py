# =============================================================================
# SCRATCHROWS SUITE (2026-10-13) - pasted rows in a live report's view
#
# Anyone viewing a report adds pasted cells to THIS view (status bar Data card;
# admins also from the Ctrl+V dialog). The rows join the report's own by a REPLAY
# of the last query answer (no second query.php request), are marked (tint, a
# Data line, "_with_pasted_rows" file names), dropped by any other run (notice:
# Add them back), refused for snapshots / emails, and their row controls inert.
#   harness.html (mk_harness.py, from pasteimp's) + driver.js: the REAL main.js
#   against a stubbed query.php                                 L-<scn>-<check>, E-<scn>
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
# Headless Edge over CDP; stages into %TEMP%\pnb_sc_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['add', 'rerun', 'remove', 'more', 'guard', 'nomatch', 'xss', 'adminview', 'stale', 'drop', 'dropadmin', 'gview', 'pview']
CHK = {
    'add': ['cardButton', 'dialog', 'plan', 'goLabel', 'noRequery', 'rows', 'tinted', 'values', 'number', 'cellText', 'stamp', 'cardSection', 'filename', 'srMark'],
    'rerun': ['requeried', 'dropped', 'stampGone', 'fnameBack', 'offer', 'readded', 'readdNoQuery'],
    'remove': ['removed', 'noRequery', 'noOffer', 'stampGone'],
    'more': ['five', 'stamp5'],
    'guard': ['emailBlocked', 'snapBlocked', 'rowCtl', 'realRowOk', 'afterRemove', 'ariaDisabled'],
    'nomatch': ['refused', 'oneLine', 'blankRows', 'escCloses'],
    'xss': ['noScript', 'noHtml', 'noJson'],
    'adminview': ['offered', 'nextLabel', 'planShown', 'added'],
    'stale': ['swallowed', 'notCarried'],
    'drop': ['overlaySays', 'preview', 'noImport', 'added'],
    'dropadmin': ['overlayImport', 'imported'],
    'gview': ['rowsTinted', 'headerMarked', 'otherClean'],
    'pview': ['cellMarked', 'otherClean', 'rowEdge', 'footMarked', 'cleanAfterRemove', 'cellLabel'],
}
MUTANTS = {
    'noreplay': ([('main', "        if (!fresh || !last || last.key !== _pnbScratchKey(post)) return $.ajax;\r\n", "        return $.ajax;\r\n")],
                 ['L-add-noRequery', 'L-remove-noRequery'], ['add', 'remove']),
    'keeponrerun': ([('main', "        var arm = _pnbScratchPending, was = _pnbScratch;\r\n",
                      "        var arm = _pnbScratchPending || (_pnbScratch && { rows: _pnbScratch.rows, cols: _pnbScratch.cols, at: _pnbScratch.at }), was = _pnbScratch;\r\n")],
                    ['L-rerun-dropped'], ['rerun']),
    'noexpire': ([('main', "        var fresh = !!_pnbScratchArm && Date.now() - _pnbScratchArmAt < 15000, last = _pnbScratchLast;\r\n",
                   "        var fresh = !!_pnbScratchArm, last = _pnbScratchLast;\r\n")], ['L-stale-notCarried'], ['stale']),
    'notint': ([('main', "                            if (rowIndex >= _pnbScratchFrom) tr.className = 'pnb-scratch-row';   // a pasted row\r\n", "")],
               ['L-add-tinted'], ['add']),
    'nostamp': ([('main', "        $('#importTimestamps').append('<div class=\"import-ts-line pnb-scratch-ts\"", "        $('#nowhere').append('<div class=\"import-ts-line pnb-scratch-ts\"")],
                ['L-add-stamp', 'L-add-cardSection'], ['add']),
    'nofname': ([('main', "        if (_pnbScratchOn()) sanitized += '_with_pasted_rows';\r\n", "")], ['L-add-filename'], ['add']),
    'noemailguard': ([('main', "        else if (t.closest('#sendEmailBtn')) what = 'An email';\r\n", "")], ['L-guard-emailBlocked'], ['guard']),
    'norowguard': ([('main', "        if (t.closest('tr.pnb-scratch-row') && t.closest(", "        if (false && t.closest(")], ['L-guard-rowCtl'], ['guard']),
    'nonumber': ([('main', "                if (last.numeric[m[1]] && v.trim() !== '') {\r\n", "                if (false) {\r\n")], ['L-add-number', 'L-add-plan'], ['add']),
    'nomarker': ([('main', "                v = (v == null) ? '' : String(v).replace(/@@(?=JSON|HTML)/gi, '');   // text, never markup\r\n",
                   "                v = (v == null) ? '' : String(v);\r\n")], ['L-xss-noHtml', 'L-xss-noJson'], ['xss']),
    'noescape': ([('main', "                if (typeof v === 'string') v = escapeHtml(v);\r\n", "")], ['L-xss-noScript', 'L-xss-noHtml'], ['xss']),
    'nolabel': ([('main', "        var target = byNorm[_pnbScratchNorm(h)];\r\n", "        var target = byNorm[String(h).toUpperCase()];\r\n")],
                ['L-add-plan'], ['add']),
    'noreaddoffer': ([('main', "                var same = _pnbScratchLast && _pnbScratchLast.qt === was.qt;\r\n", "                var same = false;\r\n")],
                     ['L-rerun-offer', 'L-rerun-readded'], ['rerun']),
    'replacenotadd': ([('main', "        _pnbScratchRun({ rows: have ? have.rows.concat(plan.rows) : plan.rows, cols: cols, at: new Date() });\r\n",
                        "        _pnbScratchRun({ rows: plan.rows, cols: cols, at: new Date() });\r\n")], ['L-more-five', 'L-more-stamp5'], ['more']),
    'noesc': ([('main', "            e.preventDefault(); e.stopPropagation();\r\n            _pnbScratchClose();\r\n", "            e.preventDefault(); e.stopPropagation();\r\n")],
              ['L-nomatch-escCloses'], ['nomatch']),
    'dropnoroute': ([('main', "                if (!_pnbPasteCanCreate()) { _pnbScratchDropFile(file); return; }\r\n", "")],
                    ['L-drop-preview', 'L-drop-noImport'], ['drop']),
    'dropsinkignored': ([('main', "        var sink = (typeof onRows === 'function') ? onRows : importFileData;\r\n", "        var sink = importFileData;\r\n")],
                        ['L-drop-preview', 'L-drop-noImport'], ['drop']),
    'dropoverlaytext': ([('main', "                $msg.text(_pnbPasteCanCreate() ? $msg.attr('data-import-text')\r\n", "                $msg.text(true ? $msg.attr('data-import-text')\r\n")],
                        ['L-drop-overlaySays'], ['drop']),
    'nogrouptint': ([('main', "                if (origRow.classList.contains('pnb-scratch-row')) newRow.className = 'pnb-scratch-row';   // a pasted row keeps its tint\r\n", "")],
                    ['L-gview-rowsTinted', 'L-gview-headerMarked'], ['gview']),
    'nopvnote': ([('main', "            if (_scSet && _scSet.has(rowDataMap)) _pnbScratchPvNote(rowKey, colKey);\r\n", "")],
                 ['L-pview-cellMarked', 'L-pview-rowEdge', 'L-pview-footMarked'], ['pview']),
    'pvmarkall': ([('main', "        return pv[kind][key] ? ' data-pnb-scratch=\"\"' : '';\r\n", "        return ' data-pnb-scratch=\"\"';\r\n")],
                  ['L-pview-otherClean', 'L-pview-rowEdge'], ['pview']),
    'pvnoreset': ([('main', "        _pnbScratchPv = { any: false, rows: Object.create(null), cells: Object.create(null), sub: Object.create(null), cols: Object.create(null) };\r\n",
                   "        if (!_pnbScratchPv.rows) _pnbScratchPv = { any: false, rows: Object.create(null), cells: Object.create(null), sub: Object.create(null), cols: Object.create(null) };\r\n")],
                  ['L-pview-cleanAfterRemove'], ['pview']),
    'noviewradio': ([('main', "            (_pnbScratchCanAdd() ? '<label style=\"display:flex; gap:8px; align-items:center; margin-top:8px;\"><input type=\"radio\" name=\"pnbPasteMode\" value=\"view\">",
                      "            (false ? '<label style=\"display:flex; gap:8px; align-items:center; margin-top:8px;\"><input type=\"radio\" name=\"pnbPasteMode\" value=\"view\">")],
                    ['L-adminview-offered'], ['adminview']),
    # WCAG Moderate fixes (2026-10-15): the hidden names and aria-disabled
    'nosrmark': ([('main', "                            if (rowIndex >= _pnbScratchFrom) tdRowNum.appendChild(_pnbScratchMark('pasted row'));\r\n", "")], ['L-add-srMark'], ['add']),
    'nopvlabel': ([('main', "        if (_pnbScratchPv.any) html = _pnbScratchPvLabel(html);\r\n", "")], ['L-pview-cellLabel'], ['pview']),
    'noinert': ([('main', "            if (_pnbScratch && !_pnbScratchInertT) _pnbScratchInertT = setTimeout(_pnbScratchInert, 60);\r\n", "")], ['L-guard-ariaDisabled'], ['guard']),
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
cand = {'main': pick(os.path.join('js', 'main.js'))}
css_main = pick(os.path.join('css', 'main.css'))
if control: cand = {'main': os.path.join(APP, 'js', 'main.js')}; css_main = os.path.join(APP, 'css', 'main.css')
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    tail = '\r\ntry { window.__HC_FN = getReportFilename; } catch (e) { window.__HC_ERR2 = String(e); }\r\n'
    out = out[:j] + tail + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    out = out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
    md = '                    data = _pnbScratchMerge(data);\r\n'
    if out.count(md) == 1:   # (absent in --control: the live build has no merge)
        out = out.replace(md, md + '                    window.__HC_DATA = data;\r\n')
    return out
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_sc_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(css_main, os.path.join(stage, 'main.css'))
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

def run_browser(texts, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    out = []
    for s in scns:
        r = run_page(s)
        if r.get('fatal') and not r.get('chk'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('fatal'),
                    'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), (r.get('fatal') or '')[:300])))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:400]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('candidate: %s  css: %s' % (json.dumps(cand), css_main))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            res = run_browser(t, scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        res = run_browser(texts, SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:400]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # without the change nothing exists to drive: every L-check must be red
            held = [a for a, passed, _ in res if passed and a.startswith('L-')]
            print('CONTROL: %d checks red (expected); checks that hold WITHOUT the change: %s' % (f, ' '.join(held) or 'none'))
            print('RESULT: GREEN' if not held and f > 0 else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
