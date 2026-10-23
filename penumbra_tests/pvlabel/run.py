# =============================================================================
# PVLABEL SUITE (2026-10-22) - a pivot's aggregation labels, Grand Total labels and value field
# are TEXT. A saved report (or a shared preset) whose aggLabels / totalRowAggLabels hold
# '<img src=x onerror=...>' ran that script for every viewer: generatePivotTable wrote the labels
# into the header unescaped (the value field's heading through formatCellContent, which leaves
# plain text as HTML). The scheduler's generate_pivot_html already escaped them (P-*: a guard).
# The REAL main.js and js/penumbra_colmenu.js on the pivmenu harness (mk_harness.py; pivmenu's
# files are read, never written) + test_pvlabel.php on a mirror of schedule_runner.php
# (pivotparity's extract_mirror.php).
# Review round: what READS a heading back as text (getFlatPivotHeaders, the level menu) and wrote it
# as HTML - the Copy dialog's column list, its Copied-values notice, the template placeholder chips,
# the "Show <field>" level menu - is text too (pllvl: a tag-shaped row field NAME, red on live
# before this round: row headings were escaped, their reader was not).
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# --control = live: every NEW check red, the guards green - true until a04f658 (LIVE 2026-10-22 14:50).
# Since then the pre-fix build is `git show 903e74b:js/main.js` > <dir>\js\main.js, run with --stage <dir>
# (expect the NEW set red there); plain `py -3 run.py` = live, 42/0.
# --php = the PHP half alone (no Edge; --mutants then runs only the s-* ones). pvgt (2026-10-22): the
# Grand Total sub-labels of the email / .csv / .xlsx follow the page (an override shows its own labels,
# even with the values' types in their order). `--php --control` = live: the E-gt NEW set red until the
# pvgt deploy; since then `git show 3973cce:schedule_runner.php` > <dir>\schedule_runner.php, --php --stage <dir>.
# Headless Edge over CDP; stages into %TEMP%\pnb_pl_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
MIRROR = os.path.join(HERE, '..', 'pivotparity', 'extract_mirror.php')
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['plflat', 'plnest', 'pllvl', 'plval', 'plval1', 'plval2']
CHK = {
    'plflat': ['subText', 'gtText', 'noTags', 'plainSame', 'menuTitle', 'sortKeeps', 'copyText', 'copyDlg', 'copyPh', 'copyNote', 'builderShows', 'rebuildText', 'noScript'],
    'pllvl': ['lvlText', 'leafText', 'noTags', 'noScript'],
    'plnest': ['subText', 'gtText', 'noTags', 'colHeads', 'noScript'],
    'plval': ['valHead', 'noTags', 'subText', 'noScript'],
    'plval1': ['valHead', 'noTags', 'noScript'],
    'plval2': ['valHead', 'noTags', 'noScript'],
}
PHP_CHK = ['E-flat', 'E-nest', 'E-val',
           'E-gteq-html', 'E-gteq-csv', 'E-gteq-xlsx', 'E-gtdef-html', 'E-gtdef-csv', 'E-gtdef-xlsx',
           'E-gtnone-html', 'E-gtnone-csv', 'E-gtnone-xlsx', 'E-gtdiff-html', 'E-gtdiff-csv', 'E-gtdiff-xlsx', 'E-gteq-nest']
# (pvgt, 2026-10-22) red on the runner before pivot_row_total_display_labels: an override listing the
# values' types in their order took the values' labels (=== by VALUE) in the email, .csv and .xlsx
NEW_SR = {'P-E-gteq-html', 'P-E-gteq-csv', 'P-E-gteq-xlsx', 'P-E-gtdef-html', 'P-E-gtdef-csv', 'P-E-gtdef-xlsx', 'P-E-gteq-nest'}
# red on live (284b1bc); the rest guard what live already does: 'R&D' unchanged, the builder's
# own rows and tokens (escaped since before), the column values, the email
NEW = {'L-plflat-' + c for c in ['subText', 'gtText', 'noTags', 'menuTitle', 'sortKeeps', 'copyText', 'copyDlg', 'copyPh', 'copyNote', 'rebuildText', 'noScript']} \
    | {'L-pllvl-' + c for c in ['lvlText', 'leafText', 'noTags', 'noScript']} \
    | {'L-plnest-' + c for c in ['subText', 'gtText', 'noTags', 'noScript']} \
    | {'L-plval-' + c for c in ['valHead', 'noTags', 'noScript']} \
    | {'L-plval1-' + c for c in ['valHead', 'noTags', 'noScript']} \
    | {'L-plval2-' + c for c in ['valHead', 'noTags', 'noScript']} \
    | NEW_SR
SUB = '<th class="pivot-sub-header"><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">'
GT = '<th class="pivot-sub-header pivot-grand-total"><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">'
MUTANTS = {
    # one heading at a time back to the raw label
    'f-sub': ([('main', "                    for (let i = 0; i < dataColumnCount; i++) {\n                        subLabels.forEach(label => {\n                            html += `" + SUB + "${escapeHtml(label)}</span>",
                "                    for (let i = 0; i < dataColumnCount; i++) {\n                        subLabels.forEach(label => {\n                            html += `" + SUB + "${label}</span>")],
              ['L-plflat-subText', 'L-plflat-noTags', 'L-plflat-copyText', 'L-plflat-noScript'], ['plflat']),
    'f-gt': ([('main', "                    gtSubLabels.forEach(function (label) {\n                        html += `" + GT + "${escapeHtml(label)}</span>",
               "                    gtSubLabels.forEach(function (label) {\n                        html += `" + GT + "${label}</span>")],
             ['L-plflat-gtText', 'L-plflat-noScript'], ['plflat']),
    'n-sub': ([('main', "                    for (let i = 0; i < leafCount; i++) {\n                        subLabels.forEach(label => {\n                            html += `" + SUB + "${escapeHtml(label)}</span>",
                "                    for (let i = 0; i < leafCount; i++) {\n                        subLabels.forEach(label => {\n                            html += `" + SUB + "${label}</span>")],
              ['L-plnest-subText', 'L-plnest-noTags', 'L-plnest-noScript'], ['plnest']),
    'n-gt': ([('main', "                    gtSubLabelsNested.forEach(function (label) {\n                        html += `" + GT + "${escapeHtml(label)}</span>",
               "                    gtSubLabelsNested.forEach(function (label) {\n                        html += `" + GT + "${label}</span>")],
             ['L-plnest-gtText', 'L-plnest-noScript'], ['plnest']),
    # the value field's heading through formatCellContent again (multi, then single)
    'v-multi': ([('main', '<span class="pivot-header-text">${escapeHtml(headerText)}</span></div></th>`;', '<span class="pivot-header-text">${formatCellContent(headerText)}</span></div></th>`;')],
                ['L-plval-valHead', 'L-plval-noTags', 'L-plval-noScript'], ['plval']),
    'v-single': ([('main', '                    html += `<th><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">${escapeHtml(headerText)}</span>',
                   '                    html += `<th><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">${formatCellContent(headerText)}</span>')],
                 ['L-plval1-valHead', 'L-plval1-noTags', 'L-plval1-noScript'], ['plval1']),
    'v-span': ([('main', '                    html += `<th rowspan="2"><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">${escapeHtml(headerText)}</span>',
                 '                    html += `<th rowspan="2"><div class="pivot-header-flex-wrapper"><span class="pivot-header-text">${formatCellContent(headerText)}</span>')],
               ['L-plval2-valHead', 'L-plval2-noTags', 'L-plval2-noScript'], ['plval2']),
    # (review round) the readers of the headings, one at a time back to raw
    'c-sel': ([('main', "                $selector.append(`<option value=\"${escapeHtml(header)}\">${escapeHtml(header)}</option>`);",
                "                $selector.append(`<option value=\"${header}\">${header}</option>`);")],
              ['L-plflat-copyDlg', 'L-plflat-noScript'], ['plflat']),
    'c-note': ([('main', 'unique values from "${escapeHtml(selectedColumn)}" to clipboard.', 'unique values from "${selectedColumn}" to clipboard.')],
               ['L-plflat-copyNote'], ['plflat']),
    'c-ph': ([('main', "return '<code title=\"Click to insert at the cursor\">{' + escapeHtml(fh) + '}</code>';", "return '<code title=\"Click to insert at the cursor\">{' + fh + '}</code>';")],
             ['L-plflat-copyPh', 'L-plflat-noScript'], ['plflat']),
    'l-mid': ([('main', "Show ' + escapeHtml(fieldName) + suffix +", "Show ' + fieldName + suffix +")], ['L-pllvl-lvlText', 'L-pllvl-noTags', 'L-pllvl-noScript'], ['pllvl']),
    'l-leaf': ([('main', "Show ' + escapeHtml(leafName) +", "Show ' + leafName +")], ['L-pllvl-leafText', 'L-pllvl-noTags', 'L-pllvl-noScript'], ['pllvl']),
    # the guard can fail: the email's value heading unescaped
    's-val': ([('sr', "$headerText = $isMulti ? htmlspecialchars($valField) : ", "$headerText = $isMulti ? $valField : ")], ['P-E-val'], []),
    # (pvgt) one builder at a time back to the by-VALUE compare, then the shared rule loses the labels,
    # then the email's flat Grand Total heading unescaped
    's-gt-html': ([('sr', "    $rowTotalDisplayLabels = pivot_row_total_display_labels($totalRowAggs, $totalRowAggLabels, $aggDisplayLabels);",
                    "    $rowTotalDisplayLabels = ($rowTotalAggTypes === $aggTypes) ? $aggDisplayLabels : pivot_build_agg_display_labels($rowTotalAggTypes, $totalRowAggLabels);")],
                  ['P-E-gteq-html', 'P-E-gtdef-html', 'P-E-gteq-nest'], []),
    's-gt-csv': ([('sr', "        $rowTotalCsvLabels = pivot_row_total_display_labels($totalRowAggs, $totalRowAggLabels, $aggDisplayLabels);",
                   "        $rowTotalCsvLabels = ($rowTotalAggTypes === $aggTypes) ? $aggDisplayLabels : pivot_build_agg_display_labels($rowTotalAggTypes, $totalRowAggLabels);")],
                 ['P-E-gteq-csv', 'P-E-gtdef-csv'], []),
    's-gt-xlsx': ([('sr', "            $rowTotalXlsxLabels = pivot_row_total_display_labels($totalRowAggs, $totalRowAggLabels, $aggDisplayLabels);",
                    "            $rowTotalXlsxLabels = ($rowTotalAggTypes === $aggTypes) ? $aggDisplayLabels : pivot_build_agg_display_labels($rowTotalAggTypes, $totalRowAggLabels);")],
                  ['P-E-gteq-xlsx', 'P-E-gtdef-xlsx'], []),
    's-gt-lbl': ([('sr', "        return pivot_build_agg_display_labels($totalRowAggs, $totalRowAggLabels);", "        return pivot_build_agg_display_labels($totalRowAggs, null);")],
                 ['P-E-gteq-html', 'P-E-gteq-csv', 'P-E-gteq-xlsx', 'P-E-gtdiff-html', 'P-E-gtdiff-csv', 'P-E-gtdiff-xlsx', 'P-E-gteq-nest'], []),
    's-gt-esc': ([('sr', "                foreach ($gtSubLabels as $label) {\n                    $html .= \"<th style='{$subHeaderCss} background-color: {$s['headerBg']}; color: {$s['headerFont']};'>\" . htmlspecialchars($label) . \"</th>\";",
                   "                foreach ($gtSubLabels as $label) {\n                    $html .= \"<th style='{$subHeaderCss} background-color: {$s['headerBg']}; color: {$s['headerFont']};'>\" . $label . \"</th>\";")],
                 ['P-E-gteq-html', 'P-E-flat'], []),
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
php_only = flag('--php')
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if php_only:
    SCN = []
    MUTANTS = {k: v for k, v in MUTANTS.items() if not v[2]}
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'), 'mcss': os.path.join('css', 'penumbra_colmenu.css'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'css': os.path.join('css', 'main.css'), 'index': 'index.php', 'sr': 'schedule_runner.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == 1: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found once: %r" % (name, f, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

stage = tempfile.mkdtemp(prefix='pnb_pl_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
sys.path.insert(0, HERE)
import mk_harness
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = edge = None
if not php_only:
  srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
  edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(0 if php_only else 150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path):
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
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

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('main.css', texts['css'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('penumbra_colwidths.js', texts['colw'])

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s   notes %s' % (json.dumps(r.get('info'))[:900], r.get('notes'))) if v is not True else '')))
    return out

def run_php(texts):
    d = tempfile.mkdtemp(prefix='pnb_plp_')
    try:
        srp = os.path.join(d, 'sr.php'); mir = os.path.join(d, 'mirror.php')
        open(srp, 'wb').write(texts['sr'].encode('utf-8', 'surrogateescape'))
        out = []
        l = subprocess.run([PHP, '-n', '-l', srp], capture_output=True, text=True).stdout
        out.append(('P-lint-sr', 'No syntax errors' in l, l.strip()[:200]))
        subprocess.run([PHP, '-n', MIRROR, srp, mir], capture_output=True, text=True)
        res = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_pvlabel.php'), mir, os.path.join(APP, 'themes_config.php')], capture_output=True, text=True)
        seen = set()
        for line in res.stdout.splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s+(.*)', line)
            if m: out.append(('P-' + m.group(2), m.group(1) == 'PASS', m.group(3))); seen.add(m.group(2))
        for c in PHP_CHK:
            if c not in seen: out.append(('P-' + c, False, 'never ran: ' + (res.stdout + res.stderr)[-300:]))
        return out
    finally:
        shutil.rmtree(d, ignore_errors=True)

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            mt = mutate(texts, m)
            write_stage(mt)
            res = run_browser(scns) + run_php(mt)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        res += run_php(texts)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-26s %s' % ('PASS' if passed else 'FAIL', a, d[:900]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(green_new) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(red_old) or 'none'))
            print('RESULT: GREEN' if not green_new and not red_old else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
