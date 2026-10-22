# =============================================================================
# viewlink - "Copy a link to this view" (?id=X&view=TOKEN), 2026-10-21
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S,S]
# Headless Edge over CDP on the colmenu harness (the REAL main.js); stages into
# %TEMP%\pnb_vl_*; writes nothing to the webroot. One headless-Edge suite at a time.
# The round trip: a capture page (vcapA / gvA / pvA) builds a link through the real
# controls; the page that link opens (vcapB / vgrpB / vpivB / pflatB) must show the same
# thing and capture the SAME view again (compared here, key by key).
# Static: index.php (pako for ?view=, the Copy dialog's button, ?view= read nowhere else),
# the palette row, the feedback email's link, the help topic + tip, no em-dash in the UI.
# --control = live (no view links): every new check red, the guards green.
# =============================================================================
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, zlib
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_colfmt.js', 'penumbra_calc.js',
        'penumbra_colwidths.js', 'penumbra_colmenu.js']
CSS = ['main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css', 'penumbra_colmenu.css']

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
scn_only = opt('--scn', None)
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = APP if control else (stage_dir or APP)
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'calc': os.path.join('js', 'penumbra_calc.js'), 'main': os.path.join('js', 'main.js'), 'index': 'index.php', 'pal': os.path.join('js', 'penumbra_palette.js'),
        'form': 'submit_home_form.php', 'topic': os.path.join('help', 'topics', 'viewLinkHelpLightbox.php'),
        'tip': os.path.join('help', 'tips', 'settings-tips-storage.php'), 'manifest': os.path.join('help', 'manifest.php')}
def read_b(p):
    if not os.path.exists(p): return ''
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

# ---- tokens built here (zlib = pako.inflate's default format), base64url
def tok(obj):
    return base64.urlsafe_b64encode(zlib.compress(json.dumps(obj).encode('utf-8'), 9)).decode().rstrip('=')
ALL20 = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE']
T_WINS = tok({'v': 1, 'm': 'flat', 'o': 'none', 'c': {'o': ALL20, 'v': ['V_ID', 'V_STATUS', 'H_CODE'], 'n': True}, 'fz': 1, 'w': {'V_STATUS': 250}})
T_STALE = tok({'v': 1, 'm': 'flat', 'o': 'GONE_C|desc', 'c': {'o': ['V_ID', 'GONE_A', 'V_NAME'], 'v': ['V_ID', 'GONE_A', 'V_NAME'], 'n': True},
               'w': {'OLD_B': 200}, 'fm': {'V_NAME': 'text'}})
BAD_S = '<img src=x onerror="window.__pwn=1">'
BAD = {'v': 1, 'm': 'flat', 's': BAD_S, 'o': 'V_NAME|desc',
       'c': {'o': ['V_ID', '<img src=x onerror="window.__pwn=2">'], 'v': ['V_ID', '<img src=x onerror="window.__pwn=2">'], 'n': True},
       'fm': {'V_NAME': '<img src=x onerror="window.__pwn=3">'},
       'hl': {'V_NAME': [{'id': 'x', 'w': '<img src=x onerror=window.__pwn=4>', 'css': '</style><img src=x onerror=window.__pwn=5>'}]},
       'cso': {'V_STATUS': ['<img src=x onerror=window.__pwn=7>', 'Open']},
       'query': 'DROP TABLE X', 'reportSnippet': '<script>window.__pwn=6</script>', 'viewOptions': {'hideSearch': True, 'hideExport': True},
       'th': 'theme-<img src=x onerror=window.__pwn=9>', 'dn': 'huge', 'noadm': 1, 'rowlimit': False, 'console': 1, 'download': 'csv', 'g': {'by': '<img src=x onerror=window.__pwn=8>'}}
T_BAD = base64.urlsafe_b64encode(zlib.compress(json.dumps(BAD).replace('"query"', '"__proto__": {"polluted": 1}, "query"', 1).encode(), 9)).decode().rstrip('=')
T_SQL = tok({'v': 1, 'm': 'flat', 's': "V_NAME = 'x' OR 1=1 --"})
T_BOMB = tok({'v': 1, 'm': 'flat', 's': ' ' * 300000})
T_OK = tok({'v': 1, 'm': 'flat', 's': 'Alpha'})
T_MAIL = tok({'v': 1, 'm': 'flat', 's': 'Alpha', 'o': 'V_AMOUNT|desc', 'c': {'o': ALL20, 'v': ['V_ID', 'V_NAME', 'V_AMOUNT'], 'n': True}, 'fz': 1, 'r': '25', 'pg': 2})
T_PGSTALE = tok({'v': 1, 'm': 'flat', 'o': 'none', 'r': '25', 'pg': 999})
from urllib.parse import quote
def url_for(s, token=None):
    base = 'harness.html?scn=%s' % s
    if s == 'vnoid': return base + '&view=' + T_OK
    if s == 'vstate': return base + '&id=lrfix&state=x&view=' + T_OK
    base += '&id=lrfix'
    return base + ('&view=' + token if token else '')
STATIC_TOK = {'vwins': T_WINS, 'vstale': T_STALE, 'vbad': T_BAD, 'vsql': T_SQL, 'vhuge': 'A' * 7000, 'vbomb': T_BOMB, 'vpgstale': T_PGSTALE, 'vmail': T_MAIL}

SCN = ['vcapA', 'vcapB', 'gvA', 'vgrpB', 'pvA', 'vpivB', 'pflatB', 'vwins', 'vwinsc', 'vstale', 'vbad', 'vsql', 'vhuge', 'vbomb', 'vnoid', 'vstate', 'vprompt', 'vlimit', 'vpgA', 'vpgB', 'vpgstale', 'vccA', 'vccB', 'vcchB', 'vmail', 'vthA', 'vthB']
CHK = {
    'vcapA': ['api', 'filtered', 'sorted', 'hidden', 'frozen', 'width', 'format', 'built', 'carries', 'urlShape', 'copied', 'toast', 'noNoteWithoutLink'],
    'vcapB': ['note', 'active', 'oneQuery', 'rtSearch', 'rtShown', 'rtRows', 'rtView', 'rtSort', 'rtFrozen', 'rtWidths', 'rtFormats', 'rtLayout'],
    'gvA': ['built', 'mode'], 'vgrpB': ['note', 'active', 'rtGrouped', 'rtView'],
    'pvA': ['built', 'mode'], 'vpivB': ['note', 'active', 'rtPivot', 'rtView'],
    'pflatB': ['note', 'active', 'flatOverPivot'],
    'vwins': ['note', 'linkWins', 'linkFrozen', 'linkWidth', 'untouchedOnLoad', 'sessionHolds', 'savedUntouched'],
    'vwinsc': ['seedApplies'],
    'vstale': ['note', 'staleListed', 'restApplied'],
    'vbad': ['noScript', 'noPollution', 'searchLiteral', 'noViewOptions', 'noAdminOverrides', 'queryUnchanged', 'unknownDropped', 'namesUnchanged', 'staleNameAsText'],
    'vsql': ['searchAsText', 'oneQuery'],
    'vhuge': ['ignored', 'defaultView'], 'vbomb': ['ignored', 'defaultView'], 'vnoid': ['ignored', 'defaultView'], 'vstate': ['ignored', 'defaultView'],
    'vprompt': ['promptRides', 'multiGrammar', 'forcedHiddenSkipped', 'reservedSkipped', 'includesPrompts'],
    'vlimit': ['fits', 'droppedNamed'],
    'vccA': ['calcShown', 'carriesCalc', 'reportNotRepeated', 'calcDialogViewLink'], 'vccB': ['note', 'calcApplied', 'calcValue', 'calcNotSaved', 'rtView'],
    'vcchB': ['note', 'calcApplied', 'calcValue', 'calcNotSaved'],
    'vmail': ['rowShown', 'disabledUntilLink', 'enabledWithLink', 'noListUnticked', 'listsCustomizations', 'disabledAgain'],
    'vthA': ['carriesTheme', 'describedTheme'], 'vthB': ['note', 'themeApplied', 'prefsNotSaved', 'rtView'],
    'vpgA': ['turned', 'carriesPage'], 'vpgB': ['note', 'rtPage'], 'vpgstale': ['note', 'clamped'],
}
# what live already gets right with no view links at all (the link is simply ignored)
GUARDS = {'L-vwinsc-seedApplies', 'L-vbad-noScript', 'L-vbad-noPollution', 'L-vbad-noViewOptions', 'L-vbad-noAdminOverrides', 'L-vbad-queryUnchanged',
          'L-vbad-namesUnchanged', 'L-vsql-oneQuery', 'L-vhuge-ignored', 'L-vhuge-defaultView', 'L-vbomb-ignored', 'L-vbomb-defaultView',
          'L-vnoid-ignored', 'L-vnoid-defaultView', 'L-vstate-ignored', 'L-vstate-defaultView', 'S-viewReadOnce',
          # the capture page's setup steps (the real controls work on live too) and a vacuous check on live
          'L-vcapA-filtered', 'L-vcapA-sorted', 'L-vcapA-hidden', 'L-vcapA-frozen', 'L-vcapA-width', 'L-vcapA-format', 'S-noEmdash'}

MUTANTS = {
    # the state applied without validation (decode hands back the raw JSON)
    'm-novalidate': ([('main', "            return _pnbViewLinkClean(JSON.parse(txt));", "            return JSON.parse(txt);")],
                     ['L-vbad-unknownDropped'], ['vbad']),
    # the viewer's saved prefs overwritten (the session layer's write half gone)
    'm-prefswrite': ([('main', "        if (_pnbViewLink && _pnbViewLinkKey) {\n            var k = _pnbViewLinkKey, disk = {}, own", "        if (false) {\n            var k = _pnbViewLinkKey, disk = {}, own")],
                     ['L-vwins-savedUntouched'], ['vwins']),
    # the viewer's saved prefs read over the link (the read half gone)
    'm-prefsread': ([('main', "        if (lsKey === 'penumbra_column_prefs' && _pnbViewLink && _pnbViewLinkKey) {", "        if (false) {")],
                    ['L-vwins-linkWins'], ['vwins']),
    # a key dropped from the round trip (frozen columns never captured)
    'm-dropfz': ([('main', "        if (st.frozenCols) v.fz = st.frozenCols;\n", "")], ['L-vcapA-carries', 'L-vcapB-rtFrozen'], ['vcapA', 'vcapB']),
    # a key dropped on the way in (widths never laid over)
    'm-dropw': ([('main', "        slot('columnWidths', v.w);\n", "")], ['L-vcapB-rtWidths'], ['vcapA', 'vcapB']),
    # admin mode unlockable: the link's viewOptions / rowlimit let through
    'm-admin': ([('main', "        var v = { v: 1 };\n        v.m = ", "        var v = { v: 1, viewOptions: d.viewOptions };\n        if (d.rowlimit === false) _penumbraUrlOverrides.rowlimit = false;\n        v.m = "),
                 ('main', "        if (v.r) o.rowsPerPage = v.r;\n        return o;", "        if (v.r) o.rowsPerPage = v.r;\n        if (v.viewOptions) o.viewOptions = v.viewOptions;\n        return o;")],
                ['L-vbad-noViewOptions', 'L-vbad-noAdminOverrides', 'L-vbad-unknownDropped'], ['vbad']),
    # the stale note escapes nothing (a column name is HTML)
    'm-noescape': ([('main', "escapeHtml(miss.slice(0, 12).join(', '))", "miss.slice(0, 12).join(', ')")], ['L-vbad-staleNameAsText'], ['vbad']),
    # a forced default (maybe me()) carried to the recipient
    'm-forced': ([('main', "if (source !== 'url' && source !== 'stored' && source !== 'interactive')", "if (false)")], ['L-vprompt-forcedHiddenSkipped'], ['vprompt']),
    # (round 3) a link's calculated columns never handed to the calc module
    'm-noccapply': ([('main', "                    window.PenumbraCalc.fromState(_pnbViewLink.cc, 'state');\n", "")], ['L-vccB-calcApplied'], ['vccA', 'vccB']),
    # the report's own calculated columns repeated in the link
    'm-ccdupe': ([('main', "return x && !rep[_pnbViewCalcKey(x)];", "return !!x;")], ['L-vccA-reportNotRepeated'], ['vccA']),
    # the calc dialog keeps its old &calc= link on a saved report
    'm-calcold': ([('calc', "var url = (vb && vb.url) ? vb.url : linkFor(r.def);", "var url = linkFor(r.def);")], ['L-vccA-calcDialogViewLink'], ['vccA']),
    # the Email option usable without the link ticked
    'm-maildisable': ([('main', "        $('#emailLinkAsView').prop('disabled', !_lrOn);\n", "")], ['L-vmail-disabledUntilLink'], ['vmail']),
    # the Email notice without the list of what the link carries
    'm-maillist': ([('main', "(_lrWhat.length ? _lrWhat.join('; ') : 'the report as it was saved, nothing changed')", "'your view'")], ['L-vmail-listsCustomizations'], ['vmail']),
    # the page captured but never turned to
    # (round 4) the link's theme never handed to the ?theme= override
    'm-nothemeboot': ([('main', "            if (!u.has('theme') && v.th) _penumbraUrlOverrides.theme = v.th;\n", "")], ['L-vthB-themeApplied'], ['vthA', 'vthB']),
    # any theme text let through, unchecked against the registry
    'm-themenoval': ([('main', "if (typeof d.th === 'string' && window.PENUMBRA_THEME_IDS && PENUMBRA_THEME_IDS.indexOf(d.th) !== -1) v.th = d.th;",
                      "if (typeof d.th === 'string') v.th = d.th;")], ['L-vbad-noAdminOverrides'], ['vbad']),
    'm-nopage': ([('main', "            currentPage = _pnbViewLink.pg;\n", "")], ['L-vpgB-rtPage', 'L-vpgstale-clamped'], ['vpgA', 'vpgB', 'vpgstale']),
    # the URL limit ignored
    'm-nolimit': ([('main', "            if (len <= LOCAL_STATE_URL_LIMIT || i >= PNB_VIEW_DROP_ORDER.length) break;", "            break;")], ['L-vlimit-fits'], ['vlimit']),
}

def static_checks(t):
    out = []
    idx, pal, form, main = t['index'], t['pal'], t['form'], t['main']
    out.append(('S-pakoForView', "isset($_GET['state']) || isset($_GET['view'])" in idx, 'index.php loads pako for ?view='))
    out.append(('S-copyButton', 'id="copyViewLinkBtn"' in idx and "<?php if (!empty($_GET['id'])): ?>" in idx.split('id="copyViewLinkBtn"')[0][-200:], 'the Copy dialog button, ?id= pages only'))
    out.append(('S-viewReadOnce', len(re.findall(r"\$_GET\['view'\]", idx)) <= 1 and "$_GET['view']" not in form, "?view= read by PHP only to load pako (no auth path touched)"))
    m = re.search(r"\{ id: 'viewlink', label: 'Copy a link to this view'.*?\},\n", pal, re.S)
    out.append(('S-paletteRow', bool(m) and all(k in m.group(0) for k in ('share', 'link', 'url', 'permalink', 'send view')) and 'PenumbraViewLink' in m.group(0), (m.group(0)[:200] if m else 'no row')))
    out.append(('S-feedbackLink', "preg_match('/^[A-Za-z0-9_-]+$/', $viewTok)" in form and "rawurlencode(trim((string)$reportRow['SHORT_ID']))\n            . '&view=' . $viewTok" in form
                and "htmlspecialchars($viewLink, ENT_QUOTES)" in form and "viewlink: ctx.id ? _pnbViewLinkToken() : ''" in main, 'the feedback email builds the link on the report id, token checked'))
    out.append(('S-emailOption', 'id="emailLinkAsView"' in idx and 'id="emailViewLinkRow"' in idx and "if ($('#emailLinkAsView').is(':checked')) {" in main
                and '#emailIncludeLink, #emailLinkAsView, #emailShowRecipients' in main, 'the Email dialog option and its link'))
    out.append(('S-help', 'viewLinkHelpLightbox' in t['manifest'] and 'Copy a link to this view' in t['topic'] and 'data-tip="us-tip-viewlink"' in t['tip'] and 'data-tip="us-tip-viewlink"' in idx, 'help topic + tip (defined + consumed) + manifest'))
    ui = re.findall(r'(?:Link copied|Opened a shared view|Copy a link to this view|Skipped, no longer|Left out to fit)[^"\n]*', main + idx + pal + t['topic'] + t['tip'])
    out.append(('S-noEmdash', bool(ui) and not any('\u2014' in x or '&mdash;' in x for x in ui) and '\u2014' not in t['topic'] + t['tip'], '%d UI strings' % len(ui)))
    return out

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
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

sys.path.insert(0, HERE)
import mk_harness
stage = tempfile.mkdtemp(prefix='pnb_vl_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('driver.js', 'seed.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
        call('Page.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if os.environ.get('PNB_SHOT') and path.startswith('harness.html?scn=' + os.environ.get('PNB_SHOT_SCN', 'vcapB')):
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot))
                return json.loads(v)
        tr = call('Runtime.evaluate', {'expression': 'JSON.stringify({errors: window.__errors, q: window.__queryDone, h: window.__HC_HIDES})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout; %s' % tr}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_calc.js', texts['calc'])   # (round 3) the calc module under test (its Copy link)

def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def run_browser(scns):
    out, res = [], {}
    pairs = {'vthB': 'vthA', 'vccB': 'vccA', 'vpgB': 'vpgA', 'vcapB': 'vcapA', 'vgrpB': 'gvA', 'vpivB': 'pvA', 'pflatB': 'vcapA'}
    for s in scns:
        token = STATIC_TOK.get(s)
        if s in pairs:
            a = res.get(pairs[s]) or {}
            token = (a.get('info') or {}).get('token') or 'none'
        if s == 'vcchB': token = ((res.get('vccA') or {}).get('info') or {}).get('halfToken') or 'none'
        path = url_for(s, token)
        if s == 'vbad': path += '&expect_s=' + quote(BAD_S, safe='')
        r = run_page(path); res[s] = r
        if r.get('fatal'):
            out.append(('F-' + s, False, r['fatal'][:3000])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}; info = r.get('info') or {}
        if s in pairs:
            a = res.get(pairs[s]) or {}; ai = a.get('info') or {}; av = ai.get('view') or {}; bv = info.get('view') or {}
            ad, bd = ai.get('dom') or {}, info.get('dom') or {}
            if s == 'vcapB':
                chk['rtSearch'] = bool(ad) and ad.get('search') == bd.get('search') == 'Alpha'
                chk['rtShown'] = bool(ad.get('shown')) and ad.get('shown') == bd.get('shown')
                chk['rtRows'] = bool(ad.get('rows')) and ad.get('rows') == bd.get('rows')
                if not chk['rtRows']: info = {'rowsA': ad.get('rows'), 'rowsB': bd.get('rows'), 'fx': info.get('fx'), 'steps': ai.get('steps')}
                for k, c in (('o', 'rtSort'), ('fz', 'rtFrozen'), ('w', 'rtWidths'), ('fm', 'rtFormats'), ('c', 'rtLayout')):
                    chk[c] = av.get(k) is not None and same(av.get(k), bv.get(k))
            if s == 'vgrpB': chk['rtGrouped'] = bd.get('grouped') is True and bv.get('m') == 'group' and (bv.get('g') or {}).get('by') == (av.get('g') or {}).get('by') == 'H_GROUP'
            if s == 'vpivB': chk['rtPivot'] = bd.get('pivot') is True and bv.get('m') == 'pivot'
            if s == 'pflatB': chk['flatOverPivot'] = bd.get('pivot') is False and bd.get('flat') is True and bv.get('m') == 'flat'
            if s == 'vpgB': chk['rtPage'] = bool(ad.get('page')) and ad.get('page') == bd.get('page') and ad.get('rows') == bd.get('rows')
            if s in ('vcapB', 'vgrpB', 'vpivB', 'vccB', 'vthB'): chk['rtView'] = bool(av) and same(av, bv)
            if not same(av, bv) and s != 'pflatB': info['diff'] = {k: [av.get(k), bv.get(k)] for k in set(av) | set(bv) if not same(av.get(k), bv.get(k))}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s   info %s' % (v, json.dumps(info)[:900]) if v is not True else ''))
    return out

try:
    cand = {k: pick(v) for k, v in RELS.items()}
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % src_root)
    scns = scn_only.split(',') if scn_only else SCN
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, ms = MUTANTS[m]
            t = mutate(texts, m); write_stage(t)
            res = run_browser(ms) + static_checks(t)
            red = [a for a, p, _ in res if not p]
            dead = [a for a, p, _ in res if a.startswith('F-') and not p]
            good = not dead and all(x in red for x in must)
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]%s' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red), ('  DEAD ' + ' '.join(dead)) if dead else ''))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(scns)
        if not scn_only: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd[:900]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            red = {a for a, passed, _ in res if not passed}
            new = {a for a, _, _ in res if not a.startswith('E-') and not a.startswith('F-')} - GUARDS
            new_green = sorted(a for a in new if a not in red)
            guard_red = sorted(a for a in GUARDS if a in red)
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: guards red on live (unexpected): %s' % (' '.join(guard_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not guard_red else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
