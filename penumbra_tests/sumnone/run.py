# =============================================================================
# SUMMARY "NONE" CHIP SUITE "sumnone" (2026-10-10)
#
# The settings panel's Columns list used to carry a summarize CHECKBOX plus a
# type chip at the far end of the row. They are now ONE chip in the checkbox's
# lane that reads None (data-type="") or a type; its menu has None first, and
# from None marks the type the old checkbox would have picked (is-suggested).
# The footer badge menu also has None first: a transient `false` (a preview,
# never saved), announced by a show_text() notification with an Undo button
# (_spBadgePickNone / .pnb-sum-undo) that only acts while that None is still in
# effect. Copied from the sumfx suite (same harness, same CDP input loop).
#
#   panel   N  rows, lane alignment, menu, None <-> type, Apply, reload, Reset, Sigma sort, badge toggle
#   footer  F  badge None, the notification, nothing saved, Undo, Apply clears it, stale Undo, all None
#   kbd     K  panel chip by keyboard (focus back on the chip), footer None + Undo by keyboard
#   theme   T  None chip contrast + dashed outline in 3 themes
#
#   py -3 run.py --main F --css F       a stage build (default: live js\main.js + css\main.css)
#   py -3 run.py --control              the build before (newest *.bak-*-sumnone): EXACTLY CONTROL_RED
#   py -3 run.py --mutants              each mutant must turn its asserts red
#   --scn a,b  --keep  --app DIR  -v  --shots DIR
#
#   Measured 2026-10-10 on the stage: 30/0, --control exactly the 26, mutants 11/11. Regression on the
#   stage: sumfx 64 (M-all updated for None), cmpfoot 25, pagedisplay, copyhtml, lazyrows, sortpage,
#   hiddencols, jsongroup, subsettip 35, msheet, savelayout 32, chgfoot 21, flatfreeze 38, colwidths -
#   green. jrowfeat (N-notegrp-hint/-esc) and admesc (V-rownote-panel) red IDENTICALLY on live: the
#   10-10 note-card Escape reversal, not this change.
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import glob, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_a11y.js']
ALL_SCN = ['panel', 'footer', 'kbd', 'theme', 'calc', 'calcint']
EXPECT = {
    'panel': ['N-rows', 'N-align', 'N-menu', 'N-on', 'N-off', 'N-apply', 'N-reload', 'N-reset', 'N-sort', 'N-toggle'],
    'footer': ['F-boot', 'F-opt', 'F-none', 'F-toast', 'F-nosave', 'F-undo', 'F-back', 'F-stale', 'F-longline', 'F-all'],
    'kbd': ['K-open', 'K-pick', 'K-none', 'K-undo'],
    'theme': ['T-light', 'T-dark-blue', 'T-charcoal-gold'],
    'calc': ['C-head', 'C-nonote', 'C-empty', 'C-align', 'C-border', 'C-gap'],
    'calcint': ['I-added', 'I-whitelist', 'I-notsummed', 'I-calcsummed', 'I-schedfilter', 'I-tablesearch', 'I-schedcols', 'I-strip'],
}
# Frozen from the first control run (2026-10-10, orig = live main.js 7fb8ff8c + main.css bfd471f7): the
# checkbox + right-hand chip build has no None anywhere, so everything but F-boot / E-footer / E-kbd /
# E-theme is red (E-panel: the driver throws once the sort header it looks for does not exist).
# Round 2 (sumnone2): --control picks the newest .bak-*-sumnone*, i.e. the round-1 build (live
# main.js 299ab4a6 + penumbra_calc 5e89aae2 when frozen, 2026-10-10): a pinned 15 s toast with no bar
# and the Undo inside the message, and the calc block with its note. (Round 1's control was 26 red.)
# Round 3 (sumnone3, calc only): --control now pairs main.js.bak-*-sumnone2 (round-1 toast) with
# penumbra_calc.js.bak-*-sumnone3 (round-2 calc block: border above, button past the list edge).
# Round 4 (sumnone4, css only): + main.css.bak-*-sumnone4 (Save 31px under the calc rule).
# calcint (added after round 4 with the calculated-columns work): the control builds above predate the
# calc-column integration it checks, so 5 of its 8 asserts are red on them too (I-added, I-calcsummed and
# I-tablesearch pass). The list was not extended then; the 2026-10-14 control run (baselines read from git
# via _oldver - the same sumnone2 / sumnone3 / sumnone4 bytes) was red on exactly these 10.
CONTROL_RED = ['F-toast', 'F-longline', 'C-align', 'C-border', 'C-gap',
               'I-whitelist', 'I-notsummed', 'I-schedfilter', 'I-schedcols', 'I-strip']
N = '\r\n'
# name -> (file, edits on the build under test, asserts that MUST go red, scenarios). Anchors occur once.
MUTANTS = {
    # no notification after a footer None
    'noundo': ('js', [("        show_text(\"<p id='undo_text'><span style='color: lightgreen'>DONE:</span> Summary removed",
                       "        if (false) show_text(\"<p id='undo_text'><span style='color: lightgreen'>DONE:</span> Summary removed")],
               ['F-toast', 'F-undo', 'F-stale', 'K-undo'], ['footer', 'kbd']),
    # Undo runs even after the None stopped being in effect
    'nostaleguard': ('js', [(" || transientColumnSummaries[key] !== false) {", ") {")], ['F-stale'], ['footer']),
    # a keyboard Undo leaves focus nowhere
    'noundofocus': ('js', [("        if (kbd && table) _spFocusSumBadge(table, u.colName);", "")], ['K-undo'], ['kbd']),
    # the footer None goes through the plain pick: no Undo offered
    'nonoundo': ('js', [("                if (isNone) { _spBadgePickNone(colName); return; }", "")], ['F-toast'], ['footer']),
    # the badge Hide/Show chip still keyed off the removed checkbox
    'oldsync': ('js', [("        var any = $('#spColumnList .sp-col-item .sp-col-sumtype').filter(function () {" + N +
                        "            return !!this.getAttribute('data-type');" + N + "        }).length > 0;",
                        "        var any = $('#spColumnList .sp-col-item .sp-col-sum:checked').length > 0;")], ['N-on'], ['panel']),
    # Apply records None as null instead of an explicit `false`
    'applynull': ('js', [("        var chosen = $it.find('.sp-col-sumtype').attr('data-type') || false;",
                          "        var chosen = $it.find('.sp-col-sumtype').attr('data-type') || null;")], ['N-apply'], ['panel']),
    # no suggested type when opening from None
    'nosuggest': ('js', [("                    (key === suggested ? ' is-suggested' : '') +" + N, "")], ['N-menu'], ['panel']),
    # a keyboard pick in the panel drops focus to <body>
    'nopanelrefocus': ('js', [("        _spCloseSummaryMenu(true);" + N + "        updateApplyResetState();",
                               "        _spCloseSummaryMenu();" + N + "        updateApplyResetState();")], ['K-pick', 'K-none'], ['kbd']),
    # the Sigma sort ignores the chip
    'sortchip': ('js', [("            return (chip && chip.getAttribute('data-type')) ? 1 : 0;", "            return 0;")], ['N-sort'], ['panel']),
    # main.css: the header lane stays checkbox-wide
    'lanewidth': ('css', [("    width: var(--sp-sum-lane);" + N + "}", "    width: 24px;" + N + "}")], ['N-align'], ['panel']),
    # --- round 2 (2026-10-10 sumnone2) ---
    # a 15 s toast is "pinned": no countdown bar
    'pinnedtoast': ('js', [("const aspec = { html: safeText, kind: kind, duration: duration, key: null, count: 1, pinned: false };",
                             "const aspec = { html: safeText, kind: kind, duration: duration, key: null, count: 1, pinned: true };")],
                    ['F-toast'], ['footer']),
    # the Undo stays inside the message, so a long one pushes it onto its own line
    'noactionmove': ('js', [("            el.insertBefore(b, t.badgeEl);", "")], ['F-toast', 'F-longline'], ['footer']),
    # an identical repeat lands on the old card (whose Undo is used): no Undo for the new None
    'coalesce': ('js', [("\"'>Undo</button></p>\", 11000, { action: true });", "\"'>Undo</button></p>\", 11000);")],
                 ['F-stale'], ['footer']),
    # penumbra_calc.js: the Add button not pushed to the right
    'calcleft': ('calc', [("'.pnb-calc-head #pnbCalcAdd{margin:0 0 0 auto;font-weight:400;}' +", "'.pnb-calc-head #pnbCalcAdd{margin:0;font-weight:400;}' +")],
                 ['C-head'], ['calc']),
    # --- round 3 (sumnone3) --- a padding SHORTHAND zeroes .sp-aligned's gutter: the button runs to the panel edge
    'calcpad': ('calc', [("'.pnb-calc-sec{margin:8px 0 0;padding-top:0;padding-bottom:8px;", "'.pnb-calc-sec{margin:8px 0 0;padding:0 0 8px;")],
                ['C-align'], ['calc']),
    # --- round 4 (sumnone4) --- main.css: Save keeps the global button margin (5px back under the rule)
    'gapmargin': ('css', [("+ .sp-actions > button {" + N + "    margin-top: 0;", "+ .sp-actions > button {" + N + "    margin-top: 5px;")],
                  ['C-gap'], ['calc']),
    # --- calcsweep (2026-10-10): calculated columns in the real page ---
    # the table's column properties ignore isSummable: the calculated column is not totalled
    'm-summable': ('js', [(" ||" + N + "                            !!(window.PenumbraCalc && window.PenumbraCalc.isSummable && window.PenumbraCalc.isSummable(upperColName));",
                           ";")], ['I-calcsummed'], ['calcint']),
    # the scheduler's column selector offers the calculated column again
    'm-schedcols': ('js', [("            if (window.PenumbraCalc && window.PenumbraCalc.isCalc && window.PenumbraCalc.isCalc(name)) return;" + N, "")],
                    ['I-schedcols'], ['calcint']),
    # the scheduler filter builder offers it again
    'm-schedfilter': ('js', [("                cols = cols.filter(function (c) { return !window.PenumbraCalc.isCalc(c.name); });", "")],
                      ['I-schedfilter'], ['calcint']),
    # penumbra_calc.js: back to pushing the name into the SUBSTRING whitelist
    'c-push': ('calc', [("            if (x.def.format !== 'text') summableNames[x.def.name] = true;",
                         "            if (x.def.format !== 'text') { summableNames[x.def.name] = true; window.penumbra_vars.totalExemptions.push(x.def.name); }")],
               ['I-whitelist', 'I-notsummed'], ['calcint']),
    # penumbra_calc.js: the Save strip leaves a pivot that uses a calculated column
    'c-strippivot': ('calc', [("                delete state.pivot;\n", "")], ['I-strip'], ['calcint']),
    # main.css: None looks like any other type chip
    'nodashed': ('css', [(".sp-col-sumtype.is-none {" + N + "    border-style: dashed;" + N, ".sp-col-sumtype.is-none {" + N)], ['T-light', 'T-dark-blue', 'T-charcoal-gold'], ['theme']),
}

# --- args ---------------------------------------------------------------------------------------
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
main_path = opt('--main')
css_path = opt('--css')
app_dir = opt('--app', APP)
index_path = opt('--index')
scn_arg = opt('--scn')
shots_dir = opt('--shots')
one_mutant = opt('--mutant')
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
verbose = flag('-v')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control and not main_path:
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-sumnone*'))
    if not baks: raise SystemExit('--control needs js\\main.js.bak-*-sumnone (made by the deploy), or --main <the build before>')
    main_path = baks[-1]
    cb = bak_glob(os.path.join(APP, 'css', 'main.css.bak-*-sumnone*'))
    if cb and not css_path: css_path = cb[-1]
main_path = main_path or os.path.join(app_dir, 'js', 'main.js')
css_path = css_path or os.path.join(app_dir, 'css', 'main.css')
index_path = index_path or os.path.join(app_dir, 'index.php')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    """The ready closure becomes an IIFE; window.__SF.ev evaluates INSIDE it (every
    closure function and variable, at call time). hideLoading counts its calls."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__SF = { ev: function (__s) { return eval(__s); } }; } catch (e) { window.__SF_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__SF_HIDES = (window.__SF_HIDES || 0) + 1;\r\n')

def mutate(js, css, name):
    target, edits, _, _ = MUTANTS[name]
    calc_path = os.path.join(stage, 'penumbra_calc.js')
    calc_src = open(_calc, 'rb').read().decode('utf-8', 'surrogateescape')
    open(calc_path, 'wb').write(calc_src.encode('utf-8', 'surrogateescape'))   # every build starts from the real module
    if target == 'calc':
        for old, new in edits:
            n = calc_src.count(old)
            if n != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, n, old[:120]))
            calc_src = calc_src.replace(old, new)
        open(calc_path, 'wb').write(calc_src.encode('utf-8', 'surrogateescape'))
        return (js, css)
    src = js if target == 'js' else css
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the build under test): %r" % (name, n, old[:120]))
        src = src.replace(old, new)
    return (src, css) if target == 'js' else (js, src)

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_sn_')
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
# The calculated-columns module from the build under test: beside --main when staged there, else the app's.
_calc = os.path.join(os.path.dirname(main_path or os.path.join(app_dir, 'js', 'main.js')), 'penumbra_calc.js')
if not os.path.exists(_calc): _calc = os.path.join(app_dir, 'js', 'penumbra_calc.js')
if control and os.path.basename(main_path).startswith('main.js.bak-'):   # --control from the live baks
    _cb = bak_glob(os.path.join(APP, 'js', 'penumbra_calc.js.bak-*-sumnone*'))
    if _cb: _calc = _cb[-1]
shutil.copyfile(_calc, os.path.join(stage, 'penumbra_calc.js'))
print('calc module: ' + _calc)
idx = read_b(index_path)
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in ' + index_path)
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.replace('<!--SNAP_TEMPLATE-->', m.group(0)).encode('utf-8', 'surrogateescape'))

def write_build(js, css):
    open(os.path.join(stage, 'main_sf.js'), 'wb').write(hook(js).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main.css'), 'wb').write(css.encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, meth='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=meth), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
for _ in range(100):
    try: urllib.request.urlopen('http://127.0.0.1:%d/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

# REAL input, asked for by the page (driver.js act()): keys, typed text, mouse clicks.
KEYS = {'Enter': ('Enter', 13, '\r'), 'Escape': ('Escape', 27, None), 'End': ('End', 35, None), 'Home': ('Home', 36, None),
        'ArrowDown': ('ArrowDown', 40, None), 'ArrowUp': ('ArrowUp', 38, None), 'Tab': ('Tab', 9, None), ' ': ('Space', 32, ' ')}
def perform(call, item, scn):
    if isinstance(item, dict) and 'shot' in item:
        if shots_dir:
            import base64
            os.makedirs(shots_dir, exist_ok=True)
            png = call('Page.captureScreenshot', {'format': 'png'}).get('data', '')
            open(os.path.join(shots_dir, '%s_%s.png' % (scn, item['shot'])), 'wb').write(base64.b64decode(png))
    elif isinstance(item, dict) and 'text' in item:
        call('Input.insertText', {'text': item['text']})
    elif isinstance(item, dict) and 'click' in item:
        x, y = item['click']
        call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})
        call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'buttons': 1, 'clickCount': 1})
        time.sleep(0.03)
        call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'buttons': 0, 'clickCount': 1})
    else:
        code, vk, text = KEYS[item]
        down = {'type': 'keyDown', 'key': item, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk}
        if text: down['text'] = text
        call('Input.dispatchKeyEvent', down)
        call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': item, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk})

def run_page(scn):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(meth, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': meth, 'params': params or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})        # every build is written to the same main_sf.js
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})     # the page keeps focus for the key presses
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s&t=%d%s' % (hp, scn, int(time.time() * 1000), '&shots=1' if shots_dir else '')})
        done_seq = 0
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.08)
            q = call('Runtime.evaluate', {'expression': 'window.__req ? JSON.stringify(window.__req) : null', 'returnByValue': True}).get('result', {}).get('value')
            if q:
                req = json.loads(q)
                if req['seq'] > done_seq:
                    for it in req['items']: perform(call, it, scn)
                    done_seq = req['seq']
                    call('Runtime.evaluate', {'expression': 'window.__ack = %d' % done_seq})
                    continue
            v = call('Runtime.evaluate', {'expression': 'window.__SFDONE ? JSON.stringify(window.__SFRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout waiting for the page (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(js, css, scns):
    write_build(js, css)
    return {s: run_page(s) for s in scns}

def evaluate(res, scns):
    out = []
    for s in scns:
        r = res.get(s, {})
        got = {a['id']: a for a in (r.get('asserts') or [])}
        for aid in EXPECT[s]:
            if aid in got: out.append((aid, got[aid]['ok'], got[aid]['detail']))
            else: out.append((aid, False, 'NOT RECORDED' + (' | fatal: ' + (r.get('fatal') or '')[:300] if r.get('fatal') else '')))
        for aid, a in got.items():
            if aid not in EXPECT[s]: out.append((aid, a['ok'], 'UNEXPECTED ID ' + a['detail']))
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('fatal'),
                    'errors %s hook %s fatal %s' % (r.get('errors'), r.get('hookErr'), (r.get('fatal') or '')[:300])))
        for line in (r.get('info') or []): out.append(('INFO', None, s + ': ' + line))
    return out

try:
    js_text, css_text = read_b(main_path), read_b(css_path)
    names = [s for s in ALL_SCN if not scn_arg or s in scn_arg.split(',')]
    print('main.js:  %s%s\nmain.css: %s' % (main_path, '   (CONTROL: the build before)' if control else '', css_path))
    if all_mutants or one_mutant:
        ok_n = bad_n = 0
        for name in ([one_mutant] if one_mutant else list(MUTANTS)):
            _, _, must, mscn = MUTANTS[name]
            sc = [s for s in mscn if s in names] or mscn
            mj, mc = mutate(js_text, css_text, name)
            res = [x for x in evaluate(run_build(mj, mc, sc), sc) if x[0] != 'INFO']
            red = [a for a, p, _ in res if not p]
            missing = [a for a in must if a not in red]
            good = not missing
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-14s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
            if verbose or not good:
                for a, p, d in res:
                    if not p: print('        %-14s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 and ok_n > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(js_text, css_text, names), names)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            if aid == 'INFO': print('  INFO  %s' % detail[:420]); continue
            print('  %s  %-14s %s' % ('PASS' if ok else 'FAIL', aid, detail[:420]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            if CONTROL_RED is None:
                print('CONTROL: not frozen yet - red set: %s' % ' '.join(failed))
                print('RESULT: RED')
            else:
                want = [a for a in CONTROL_RED if any(a in EXPECT[s] or a == 'E-' + s for s in names)]
                exact = sorted(failed) == sorted(want)
                print('CONTROL: %s (expected red: %s)' % ('as expected' if exact else 'NOT as expected', ' '.join(want)))
                print('RESULT: GREEN' if exact else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
