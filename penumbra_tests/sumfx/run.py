# =============================================================================
# BADGE FORMULA SUITE "sumfx" (2026-10-02)
#
# A footer summary badge opens a menu of summary types. Until 2026-10-02 it
# left Custom Formula out unless the column already had a formula: the menu had
# nowhere to type one. Now picking it turns the popover into a formula box
# (prefilled with the formula in effect, checked as you type, Enter / Apply to
# use it, Escape / Cancel to leave things as they were). Like every badge pick
# it is a PREVIEW: transientColumnSummaryFormulas, never saved, cleared on a
# report change and by the settings panel's Apply; everything that writes reads
# penumbraResolveSummaryFormulaPersisted(). The settings panel's hidden formula
# box starts from the badge formula, so keeping it = pick Custom Formula there +
# Save Column Layout. Focus returns to the badge after a pick, Cancel or Escape.
#
# Each scenario boots the REAL main.js (+ penumbra_a11y.js) through the real run
# path (stubbed query.php) on a 6-row fixture; driver.js records the asserts.
# Menu options are clicked in the page; typing, Enter, Escape, End are REAL key
# presses and the mouse scenario uses REAL clicks (CDP, asked for through act()).
#   flat     M menu  X box  V checks  A apply  P not saved  R re-open/Cancel/Escape/back  L keyword  O outside
#   mouse    U real mouse clicks           kbd     K keyboard only (incl. Escape out of the plain menu)
#   panel    S settings panel: the box starts from the badge formula, Apply keeps it + clears the preview, Reset
#   hydrate  H another report drops the preview
#   saved    W a report saved with a formula: the badge edits a preview; saves and the panel keep the saved one
#   grouped  G every group's footer       drill  D breakdown table       cmp  C snapshot comparison
#   theme    T contrast of the box (light, dark-blue, charcoal-gold)
#   E-<scn>  no page errors
#
#   py -3 run.py --main F --css F       a stage build (default: the live js\main.js + css\main.css)
#   py -3 run.py --control              the build before (newest js\main.js.bak-*-sumfx + css\main.css.bak-*-sumfx,
#                                       or --main/--css): EXACTLY CONTROL_RED must fail
#   py -3 run.py --mutant N / --mutants single edits of the build under test, each must turn its asserts red
#   --scn a,b   a subset;  --keep keeps the staging dir;  --app DIR libs / index.php source;  -v  every red line
#   --shots DIR screenshots (menu, box with an error, applied footer, the box in 3 themes)
#
#   Measured 2026-10-02 on the stage (stage2, rebased on live 4c90ff60): 64/0 (~30 s); --control on the
#   build before exactly CONTROL_RED (47) (~16 s); --mutants 21/21 (~100 s). Regression on the stage:
#   cmpfoot 25, hiddencols 56, pagedisplay 24, copyhtml 60, lazyrows 96, jrowfeat 122, sortpage 18,
#   admesc 39, jsongroup 59, savelayout 32, sbkeys 22+10, chgfoot 21, singlekeytips 53+4, searchbar 25,
#   colwidths 135+8, flatfreeze 38, filterstrip 315, xlsx 128, voptions 71, groupmode 612, subsettip 35,
#   msheet 75 - all green. The PowerShell suites ran from LOCAL copies (the share is RemoteSigned).
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# Needs Python 3 + websocket-client.
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
ALL_SCN = ['flat', 'mouse', 'kbd', 'panel', 'hydrate', 'saved', 'grouped', 'drill', 'cmp', 'theme']
EXPECT = {
    'flat': ['F-boot', 'M-all', 'M-fits', 'X-open', 'X-place', 'X-labels', 'V-quiet', 'V-bad', 'V-enter', 'V-empty', 'A-apply', 'A-focus',
             'P-nosave', 'R-prefill', 'R-cancel', 'R-esc', 'R-back', 'L-formulas', 'O-outside'],
    'mouse': ['U-menu', 'U-box', 'U-apply', 'U-nofocus', 'U-cancel'],
    'kbd': ['K-menu', 'K-end', 'K-box', 'K-apply', 'K-esc', 'K-escmenu'],
    'panel': ['P-report', 'S-chip', 'S-pick', 'S-apply', 'S-saved', 'S-reset'],
    'hydrate': ['H-cleared'],
    'saved': ['W-boot', 'W-prefill', 'W-edit', 'W-state', 'W-panel'],
    'grouped': ['G-boot', 'G-apply', 'G-focus'],
    'drill': ['D-boot', 'D-apply', 'D-focus'],
    'cmp': ['C-boot', 'C-apply', 'C-focus'],
    'theme': ['T-light', 'T-dark-blue', 'T-charcoal-gold'],
}
# What the build before this change gets wrong. Frozen from the first control run (2026-10-02,
# orig = live main.js caf4bb5f + main.css d8d83803): no Custom Formula in the badge menu, so every
# box / apply / focus assert after it fails or is never recorded; E-panel / E-hydrate are red
# because the driver reads transientColumnSummaryFormulas, which that build does not have. Still
# GREEN on it, as they must be: F-boot, K-menu, P-report, W-boot, W-state, W-panel, G-boot, D-boot,
# C-boot and the other E-*.
CONTROL_RED = ['M-all', 'M-fits', 'X-open', 'X-place', 'X-labels', 'V-quiet', 'V-bad', 'V-enter', 'V-empty', 'A-apply', 'A-focus',
               'P-nosave', 'R-prefill', 'R-cancel', 'R-esc', 'R-back', 'L-formulas', 'O-outside', 'U-menu', 'U-box', 'U-apply',
               'U-nofocus', 'U-cancel', 'K-end', 'K-box', 'K-apply', 'K-esc', 'K-escmenu', 'S-chip', 'S-pick', 'S-apply', 'S-saved',
               'S-reset', 'E-panel', 'H-cleared', 'E-hydrate', 'W-prefill', 'W-edit', 'G-apply', 'G-focus', 'D-apply', 'D-focus',
               'C-apply', 'C-focus', 'T-light', 'T-dark-blue', 'T-charcoal-gold']

# --- mutants: name -> (file, edits on the build under test, asserts that MUST go red, scenarios) ---
# Every anchor must occur exactly once. Lines end CRLF (main.js and main.css both).
N = '\r\n'
MUTANTS = {
    # the old menu: Custom Formula only for a column that already has a formula
    'nofx': ('js', [("            if (!def) return;" + N + "            html += '<button type=\"button\" role=\"menuitemradio\" class=\"sp-sumtype-opt' +" + N +
                     "                    (key === current ? ' is-current' : '') +" + N +
                     "                    (def.numeric && !looksNumeric ? ' is-nonnumeric' : '') + '\"' +" + N +
                     "                    ' data-type=\"' + escapeHtml(key) + '\">' +",
                     "            if (!def) return;" + N + "            if (key === 'formula' && !penumbraResolveSummaryFormula(colName)) return;" + N +
                     "            html += '<button type=\"button\" role=\"menuitemradio\" class=\"sp-sumtype-opt' +" + N +
                     "                    (key === current ? ' is-current' : '') +" + N +
                     "                    (def.numeric && !looksNumeric ? ' is-nonnumeric' : '') + '\"' +" + N +
                     "                    ' data-type=\"' + escapeHtml(key) + '\">' +")],
             ['M-all', 'X-open', 'U-menu', 'K-end'], ['flat', 'mouse', 'kbd']),
    # a report save reads the badge preview
    'writeleak': ('js', [("            const f = penumbraResolveSummaryFormulaPersisted(n);", "            const f = penumbraResolveSummaryFormula(n);")],
                  ['W-state', 'S-saved'], ['saved', 'panel']),
    # the panel's visible box shows the preview instead of the saved formula
    'panelleak': ('js', [("        return (savedType === 'formula')" + N + "            ? penumbraResolveSummaryFormulaPersisted(colName)" + N +
                          "            : penumbraResolveSummaryFormula(colName);", "        return penumbraResolveSummaryFormula(colName);")],
                  ['W-panel', 'S-saved'], ['saved', 'panel']),
    # the panel's hidden box does not start from the badge formula
    'nobridge': ('js', [("        return (savedType === 'formula')" + N + "            ? penumbraResolveSummaryFormulaPersisted(colName)" + N +
                         "            : penumbraResolveSummaryFormula(colName);", "        return penumbraResolveSummaryFormulaPersisted(colName);")],
                 ['S-chip', 'S-pick', 'S-reset'], ['panel']),
    # Reset empties a hidden box
    'noresetbridge': ('js', [("                    (isFixed || item.summary === 'formula') ? item.formula : _spFormulaBoxText(item.colName, item.summary)));",
                              "                    item.formula));")], ['S-reset'], ['panel']),
    # a report change keeps the old report's formula
    'nohydrate': ('js', [("        transientColumnSummaries = {};" + N + "        transientColumnSummaryFormulas = {};" + N + "        // Fresh budget",
                          "        transientColumnSummaries = {};" + N + "        // Fresh budget")], ['H-cleared'], ['hydrate']),
    # Apply keeps the preview formula, which then outranks what was just saved
    'noapplyclear': ('js', [("        transientColumnSummaries = {};" + N + "        transientColumnSummaryFormulas = {};" + N + "        userColumnSummaryFormulas = formulaOverrides;",
                             "        transientColumnSummaries = {};" + N + "        userColumnSummaryFormulas = formulaOverrides;")], ['S-apply'], ['panel']),
    # no focus back to the (rebuilt) badge after a keyboard pick
    'norefocus': ('js', [("        if (table) _spFocusSumBadge(table, colName);", "")],
                  ['A-focus', 'K-apply', 'G-focus', 'D-focus', 'C-focus'], ['flat', 'kbd', 'grouped', 'drill', 'cmp']),
    # focus handed back after a MOUSE pick / Cancel too (the badge's tooltip pops 600 ms later)
    'mousefocus': ('js', [("        try { return a.matches(':focus-visible'); } catch (e) { return true; }", "        return true;")],
                   ['U-nofocus', 'U-cancel'], ['mouse']),
    # Escape (A0.7) drops focus on <body>
    'noescfocus': ('js', [("                e.stopImmediatePropagation();" + N + "                _spCloseSummaryMenu(true);",
                           "                e.stopImmediatePropagation();" + N + "                _spCloseSummaryMenu();")],
                   ['R-esc', 'K-esc', 'K-escmenu'], ['flat', 'kbd']),
    # Cancel drops focus on <body>
    'nocancelfocus': ('js', [("        _spCloseSummaryMenu(true);" + N + "    });" + N + N + "    // Rebuild the summary footers",
                              "        _spCloseSummaryMenu();" + N + "    });" + N + N + "    // Rebuild the summary footers")], ['R-cancel'], ['flat']),
    # an error flashes at every keystroke
    'nodebounce': ('js', [("        _spSumFxTimer = setTimeout(function () { $msg.text(err); }, 600);", "        $msg.text(err);")], ['V-quiet'], ['flat']),
    # an empty box is accepted
    'emptyok': ('js', [("        var err = expr ? (penumbraParseSummaryFormula(expr).error || '')" + N +
                        "                       : 'Type a formula first, for example {sum}/{count}';",
                        "        var err = expr ? (penumbraParseSummaryFormula(expr).error || '') : '';")], ['V-empty'], ['flat']),
    # Enter does nothing in the box
    'noenter': ('js', [("        if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;", "        return;")],
                ['V-enter', 'A-apply', 'K-apply'], ['flat', 'kbd']),
    # the formula goes into the user layer (= would be saved by the next Save Column Layout)
    'notransient': ('js', [("        if (formula !== undefined) transientColumnSummaryFormulas[key] = formula;",
                            "        if (formula !== undefined) userColumnSummaryFormulas[key] = formula;")], ['P-nosave'], ['flat']),
    # the box opens empty
    'noprefill': ('js', [("                    ' value=\"' + escapeHtml(penumbraResolveSummaryFormula(colName)) + '\">' +", "                    ' value=\"\">' +")],
                  ['R-prefill', 'W-prefill', 'R-back'], ['flat', 'saved']),
    # a refused Enter is not announced
    'noalert': ('js', [("        if (now) { $msg.attr('role', 'alert').text(err); return false; }", "        if (now) { $msg.text(err); return false; }")],
                ['V-enter'], ['flat']),
    # main.css: no invalid ring (a border colour would be overridden by .is-dark's !important)
    'noinvalidring': ('css', [(".sp-sumfx .sp-sumfx-input[aria-invalid=\"true\"] {" + N + "    box-shadow: 0 0 0 1px var(--accent-danger, #cc0000);" + N + "}",
                               ".sp-sumfx .sp-sumfx-input[aria-invalid=\"true\"] {" + N + "}")], ['T-light', 'T-dark-blue', 'T-charcoal-gold'], ['theme']),
    # main.css: the menu's old 320px cap - the list scrolls and Custom Formula is below the fold
    'menuheight': ('css', [("    max-height: min(380px, calc(100vh - 16px));", "    max-height: 320px;")], ['M-fits'], ['flat']),
    # main.css: the global button margin back between the items (414px of list)
    'menumargin': ('css', [("    gap: 8px;" + N + "    width: 100%;" + N + "    /* The global `button { margin-top: 5px }` put a 5px gap above every item. */" + N + "    margin: 0;" + N,
                            "    gap: 8px;" + N + "    width: 100%;" + N)], ['M-fits'], ['flat']),
    # main.css: the undefined --text-primary (falls back to #222 on a dark surface)
    'textprimary': ('css', [("    padding: 9px 10px 8px;" + N + "    color: var(--text-main, #222);", "    padding: 9px 10px 8px;" + N + "    color: var(--text-primary, #222);")],
                    ['T-dark-blue', 'T-charcoal-gold'], ['theme']),
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
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-sumfx'))
    if not baks: raise SystemExit('--control needs js\\main.js.bak-*-sumfx (made by the deploy), or --main <the build before>')
    main_path = baks[-1]
    cb = bak_glob(os.path.join(APP, 'css', 'main.css.bak-*-sumfx'))
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
    src = js if target == 'js' else css
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the build under test): %r" % (name, n, old[:120]))
        src = src.replace(old, new)
    return (src, css) if target == 'js' else (js, src)

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_sf_')
for f in LIBS: shutil.copyfile(os.path.join(app_dir, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
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
