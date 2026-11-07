# =============================================================================
# POPMENU SUITE (2026-11-06) - the shared right-click menus in the popped-out console.
# "Open in Window" (main.js popOutAdminWindow + _mountConsoleIn) moves the console, and the dialogs it raises, into a
# window.open() window. A breakdown opened while that window has the focus is drawn there (main.js _pnbModalHost), as
# are the Server Repository's rows. js/penumbra_colmenu.js now binds its listeners in that document too (main.js tells
# it: penumbra:console-window) and draws, places, keys and copies from the window the right-click was in.
#
# The REAL main.js + js/penumbra_colmenu.js + its stylesheet on the pivmenu harness (the pvshade fixture, the pivot
# builder lifted from index.php: ../pivmenu/mk_harness.py), served over http://127.0.0.1 so the console window is
# same-origin, in headless Edge with --disable-popup-blocking: the REAL "Open in Window" button opens the REAL console
# window. The screen is made narrower than the tab (the console window asks for 0.9 x the screen), so a menu placed
# against the wrong window shows. See driver.js for every check.
# (Round 2, same day; the user: "lets fix those last 2") also js/penumbra_wsmenu.js (the page's own menu) and
# js/penumbra_colwidths.js (a breakdown's column widths) in the console window; a same-window link in that
# window's page menu is followed by the TAB - the runner's last step (navTab, navPopKept), as the tab then leaves.
# (Round 3, same day; the user: "Yes, fix it") a breakdown there takes the report's frozen columns too (main.js
# _bdApply / _bdApplyPop): bdFrozenPop, bdFrozenPopRO.
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S] [--real]
#   --stage DIR   DIR\js\main.js + DIR\js\penumbra_colmenu.js (+ css, colwidths, index.php) over live
#   --control     the build before the change (main.js + penumbra_colmenu.js from git at CONTROL_REV once the change is
#                 live; live itself before that): exactly NEW red, the rest green
#   --real        also REAL input over CDP in the console window (a real right-click, ArrowDown, Escape): realMenu,
#                 realKeys, realEsc. Run it on a build with the change: without it the real Escape closes the dialog
#                 and the guards after it read nothing.
# Headless Edge over CDP; stages into %TEMP%\pnb_pw_*; writes nothing to the webroot.
# Needs `py -3 -m pip install websocket-client`.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
GITDIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
CONTROL_REV = '035a327^'   # (popmenu round 3 is LIVE since 035a327) the commit BEFORE it: the build without the change
CONTROL_REV = os.environ.get('PW_CONTROL_REV') or CONTROL_REV   # (another rev for a one-off control run)
T = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests'
PIVMENU = os.path.join(T, 'pivmenu')
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['pwmenu']
CHK = {
    'pwmenu': [
        # the tab first: a breakdown's menu there, as before
        'dockMenu', 'dockCopy',
        # the console in its own window, a breakdown opened there
        'popOpened', 'bdInPop',
        'opens', 'styled', 'copyFirst', 'keysMove', 'keysSub', 'keysPanel', 'escMenuOnly', 'escRefocus',
        'hoverSub', 'copyPop', 'toastPop', 'statsGroups', 'copyGroups', 'placed', 'subPlaced', 'selKeepsBrowser',
        'blurOwn', 'downCloses', 'itemsInPop', 'sumInPop',
        # (round 2) the page's own menu there, and the tab's while the console is out
        'wsTabRerun', 'wsOpens', 'wsStyled', 'wsLeftOut', 'wsKeys', 'wsSubHover', 'wsPlaced', 'wsSubPlaced', 'wsBlurOwn',
        # (round 2) a breakdown's column widths there
        'cwItems', 'cwKeys', 'cwFit', 'cwUndo', 'cwDrag', 'cwHint',
        # (round 3) the report's frozen columns on a breakdown there
        'bdFrozenPop', 'bdFrozenPopRO',
        'restoreCloses', 'rebound', 'pagehideCloses',
        # back in the tab
        'dockAfter'],
}
# round 1 (3854f03): red on the build before it
NEW_R1 = {'L-pwmenu-' + c for c in ['opens', 'styled', 'copyFirst', 'keysMove', 'keysSub', 'keysPanel', 'escMenuOnly', 'escRefocus',
                                 'hoverSub', 'copyPop', 'toastPop', 'statsGroups', 'copyGroups', 'placed', 'subPlaced',
                                 'blurOwn', 'downCloses', 'itemsInPop', 'sumInPop', 'restoreCloses', 'rebound', 'pagehideCloses']}
# (round 2) red on the build before it (round 1 live, the page's menu and the widths not in the console window yet);
# the navigation checks are the runner's own (run_nav), after the page's
NEW_R2 = {'L-pwmenu-' + c for c in ['wsTabRerun', 'wsOpens', 'wsStyled', 'wsLeftOut', 'wsKeys', 'wsSubHover', 'wsPlaced', 'wsSubPlaced',
                                    'wsBlurOwn', 'cwItems', 'cwKeys', 'cwFit', 'cwUndo', 'cwDrag', 'cwHint', 'navTab', 'navPopKept']}
# (round 3) red on the build before it (rounds 1-2 live): a breakdown in the console window took no frozen columns
NEW_R3 = {'L-pwmenu-bdFrozenPop', 'L-pwmenu-bdFrozenPopRO'}
NEW = NEW_R3   # the control is the build before round 3 (rounds 1-2's checks are old ones there)
HOOK_LINE = "            try { document.dispatchEvent(new CustomEvent('penumbra:console-window', { detail: { doc: pipDoc } })); } catch (err) { }\n"
P = 'L-pwmenu-'
MUTANTS = {
    # main.js no longer tells the menus about the console window
    'm-hook': ([('main', HOOK_LINE, '')], [P + 'opens', P + 'copyPop', P + 'statsGroups', P + 'itemsInPop', P + 'sumInPop', P + 'rebound'], ['pwmenu']),
    # the menus hear the news and do nothing with it
    'm-bindpop': ([('menu', "document.addEventListener('penumbra:console-window', function (e) { if (e.detail && e.detail.doc) { bindDoc(e.detail.doc); } });",
                    "document.addEventListener('penumbra:console-window', function (e) { });")], [P + 'opens', P + 'statsGroups'], ['pwmenu']),
    # the breakdown's menu drawn in the tab again
    'm-append': ([('menu', "        docOf(t.th).body.appendChild(el);   // (popmenu) the breakdown's own document\n", "        document.body.appendChild(el);\n")],
                 [P + 'opens', P + 'styled'], ['pwmenu']),
    # placed against the tab's window
    'm-place': ([('menu', "var pw = winOf(el), w = el.offsetWidth, h = el.offsetHeight, vw = pw.innerWidth, vh = pw.innerHeight;",
                  "var pw = winOf(el), w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;")], [P + 'placed'], ['pwmenu']),
    # a list beside its item flipped against the tab's window
    'm-subplace': ([('menu', "        var sw = winOf(el);   // (popmenu) the window it is drawn in\n", "        var sw = window;\n")], [P + 'subPlaced'], ['pwmenu']),
    # a list beside its item drawn in the tab
    'm-subdoc': ([('menu', "        docOf(itemEl).body.appendChild(el);   // (popmenu) in its item's document\n", "        document.body.appendChild(el);\n")],
                 [P + 'keysSub', P + 'hoverSub', P + 'statsGroups'], ['pwmenu']),
    # no list opens on hover in the console window
    'm-hover': ([('menu', "            if (docOf(itemEl) !== document) {   // (popmenu) a menu in the console window\n                hoverTimer = setTimeout(function () { if (cur && itemEl.isConnected) { openSub(itemEl, it); } }, 150);\n                return;\n            }\n", "")],
                [P + 'hoverSub'], ['pwmenu']),
    # the keys heard by the tab's window only
    'm-keys': ([('menu', "        win.addEventListener('keydown', keysIn(doc), true);\n", "        window.addEventListener('keydown', keysIn(doc), true);\n")],
               [P + 'keysMove', P + 'keysSub'], ['pwmenu']),   # (Escape still works: main.js replays it onto the tab, heard there)
    # the keys heard after main.js's Escape in the console window (on its document, bubbling): Escape takes the dialog
    'm-keyorder': ([('menu', "        win.addEventListener('keydown', keysIn(doc), true);\n", "        doc.addEventListener('keydown', keysIn(doc), false);\n")],
                   [P + 'escMenuOnly'], ['pwmenu']),
    # the keys read the tab's focus
    'm-activedoc': ([('menu', "        if (!cur || !inMenu(doc.activeElement)) { return; }\n", "        if (!cur || !inMenu(document.activeElement)) { return; }\n")],
                    [P + 'keysMove', P + 'keysSub'], ['pwmenu']),
    # the panel holding the focus read from the tab
    'm-activepanel': ([('menu', "        var p = panelOf(docOf(cur.el).activeElement);   // (popmenu) the menu's own document\n", "        var p = panelOf(document.activeElement);\n")],
                      [P + 'keysPanel'], ['pwmenu']),
    # Escape leaves the focus nowhere
    'm-refocus': ([('menu', "            if (!t && docOf(c.el) !== document) {   // (popmenu) a menu in the console window: document.contains reads the tab\n                t = [c.focusEl, c.cell && c.cell.td, c.th].filter(function (n) { return n && n.isConnected; })[0] || null;\n            }\n", "")],
                  [P + 'escRefocus'], ['pwmenu']),
    # the tab's clipboard
    'm-clip': ([('menu', "        var cb = clip();   // (popmenu) the window's the person is in\n", "        var cb = navigator.clipboard;\n")], [P + 'copyPop', P + 'copyGroups'], ['pwmenu']),
    # the tab's selection
    'm-sel': ([('menu', "        var sel = selOf(cell);   // (popmenu) its own window's selection\n", "        var sel = window.getSelection ? window.getSelection() : null;\n")],
              [P + 'selKeepsBrowser'], ['pwmenu']),
    # any window's blur closes the menu
    'm-blur': ([('menu', "        win.addEventListener('blur', function () { if (menuIn(doc)) { close(false); } });\n", "        win.addEventListener('blur', function () { close(false); });\n")],
               [P + 'blurOwn'], ['pwmenu']),
    # a press outside the menu in the console window is not heard
    'm-down': ([('menu', "        doc.addEventListener('mousedown', onDown, true);\n", "        if (doc === document) { doc.addEventListener('mousedown', onDown, true); }\n")],
               [P + 'downCloses'], ['pwmenu']),
    # an item's click in the console window is not heard
    'm-itemclick': ([('menu', "        doc.addEventListener('click', onItemClick, true);\n", "        if (doc === document) { doc.addEventListener('click', onItemClick, true); }\n")],
                    [P + 'copyPop', P + 'statsGroups', P + 'copyGroups'], ['pwmenu']),
    # a menu of given items (the Server Repository's rows) drawn in the tab
    'm-items': ([('menu', "        docOf(o.mark || o.focusEl).body.appendChild(el);   // (popmenu) where its mark is (the Server Repository's rows: the console window)\n", "        document.body.appendChild(el);\n")],
                [P + 'itemsInPop'], ['pwmenu']),
    # a summary row's menu (a breakdown's footer) drawn in the tab
    'm-sum': ([('menu', "        docOf(t.td).body.appendChild(el);   // (popmenu) the table's own document\n", "        document.body.appendChild(el);\n")],
              [P + 'sumInPop'], ['pwmenu']),
    # the console window's pagehide leaves its menu "open" (Return to Tab blurs it first: that blur closes it too)
    'm-pagehide': ([('menu', "                if (cur && docOf(cur.el) === doc) { close(false); }\n                var k = boundDocs.indexOf(doc);\n", "                var k = boundDocs.indexOf(doc);\n")],
                   [P + 'pagehideCloses'], ['pwmenu']),
    # ---- round 2: the page's own menu (ws)
    # its listeners never bound in the console window
    'w-bind': ([('ws', "    document.addEventListener('penumbra:console-window', function (e) { if (e.detail && e.detail.doc) { bindDoc(e.detail.doc); } });\n", "")],
               [P + 'wsOpens', P + 'navTab'], ['pwmenu']),
    # drawn in the tab
    'w-doc': ([('ws', "        docOf(spot).body.appendChild(m);   // (popmenu 2) where its spot is\n", "        document.body.appendChild(m);\n")], [P + 'wsOpens'], ['pwmenu']),
    # placed against the tab's window
    'w-place': ([('ws', "        var mw = winOf(m), z = zoomIn(m), vw = viewWIn(mw), vh = viewHIn(mw), r;   // (popmenu 2) its own window\n", "        var z = zoom(), vw = viewW(), vh = viewH(), r;\n")],
                [P + 'wsPlaced'], ['pwmenu']),
    # a list beside its item flipped against the tab's window
    'w-subflip': ([('ws', "        if (docOf(m) !== document) {\n            var sw = winOf(m);\n            x = sx; y = sy;\n", "        if (false) {\n            var sw = winOf(m);\n            x = sx; y = sy;\n")],
                  [P + 'wsSubPlaced'], ['pwmenu']),
    # no list on hover there
    'w-hover': ([('ws', "            if (docOf(itemEl) !== document) {   // (popmenu 2) the console window's (document.contains reads the tab)\n", "            if (false) {\n")],
                [P + 'wsSubHover'], ['pwmenu']),
    # the keys read the tab's focus
    'w-keysdoc': ([('ws', "        if (!cur || !inMenu(kd.activeElement)) { return; }\n", "        if (!cur || !inMenu(document.activeElement)) { return; }\n")], [P + 'wsKeys'], ['pwmenu']),
    # the Settings panel, Quick actions and the feedback form offered there too
    'w-leftout': ([('ws', "        if (docOf(spot) !== document) { items = tidy(", "        if (false) { items = tidy(")], [P + 'wsLeftOut'], ['pwmenu']),
    # by id in the tab only: the console's Run gone while it is out
    'w-el': ([('ws', "    function el(id) { return typeof window._pnbById === 'function' ? window._pnbById(id) : document.getElementById(id); }\n", "    function el(id) { return document.getElementById(id); }\n")],
             [P + 'wsTabRerun', P + 'wsLeftOut'], ['pwmenu']),
    # any window's blur closes it
    'w-blur': ([('ws', "    listen(window, 'blur', function () { if (!cur || winOf(cur.el) === this) { close(false); } });\n", "    listen(window, 'blur', function () { close(false); });\n")],
               [P + 'wsBlurOwn'], ['pwmenu']),
    # a same-window link in the console window followed by that window
    'w-link': ([('ws', "        if (it && it.href && n.tagName === 'A' && !it.target && docOf(n) !== document && ", "        if (false && it && it.href && n.tagName === 'A' && !it.target && docOf(n) !== document && ")],
               [P + 'navTab', P + 'navPopKept'], ['pwmenu']),
    # ---- round 2: a breakdown's column widths (colw)
    # a breakdown in the console window is not one
    'c-gate': ([('colw', "        if (table.classList && table.classList.contains('pnb-breakdown') && table.ownerDocument !== document && table.ownerDocument === popDoc()) {\n",
                "        if (false) {\n")], [P + 'cwItems', P + 'cwKeys'], ['pwmenu']),
    # its rules only in the tab's head
    'c-style': ([('colw', "            if (pd && (dcss || pd.getElementById('pnbColWidthDrillStyle'))) {\n", "            if (false) {\n")], [P + 'cwKeys'], ['pwmenu']),
    # nothing bound in the console window
    'c-bind': ([('colw', "        document.addEventListener('penumbra:console-window', function (e) { if (e.detail && e.detail.doc) { bindPop(e.detail.doc); } });\n", "")],
               [P + 'cwKeys', P + 'cwDrag'], ['pwmenu']),
    # the Undo in that window's notice not heard
    'c-undo': ([('colw', "        doc.addEventListener('click', onUndoClick);\n", "")], [P + 'cwUndo'], ['pwmenu']),
    # the drag's shield in the tab
    'c-drag': ([('colw', "        dd.body.appendChild(shield);\n", "        document.body.appendChild(shield);\n")], [P + 'cwDrag'], ['pwmenu']),
    # the + - 0 hint only in the tab
    'c-hint': ([('colw', "        if (!th || !th.setAttribute || !enabled() || !keysHint(docOf(th))) { return; }\n", "        if (!th || !th.setAttribute || !enabled() || !keysHint()) { return; }\n")],
               [P + 'cwHint'], ['pwmenu']),
    # ---- round 3: a breakdown's frozen columns in the console window (main)
    # its breakdowns never gathered
    'f-tables': ([('main', "        if (pwin) { try { tables = Array.prototype.slice.call(tables).concat(", "        if (false) { try { tables = Array.prototype.slice.call(tables).concat(")],
                 [P + 'bdFrozenPop'], ['pwmenu']),
    # gathered, but the rules not written there
    'f-rule': ([('main', "        _bdApplyPop(pwin, pcss, pwatch);\n", "")], [P + 'bdFrozenPop'], ['pwmenu']),
    # its rules written in the tab's head
    'f-split': ([('main', "            if (on) (t.ownerDocument === document ? css : pcss).push(_bdBuildCss(id, n, lefts));\n", "            if (on) css.push(_bdBuildCss(id, n, lefts));\n")],
                [P + 'bdFrozenPop'], ['pwmenu']),
    # its headers watched by an observer the tab made
    'f-ro': ([('main', "if (!_bdPop.ro && pwin.ResizeObserver) _bdPop.ro = new pwin.ResizeObserver(", "if (!_bdPop.ro && pwin.ResizeObserver) _bdPop.ro = new ResizeObserver(")],
             [P + 'bdFrozenPopRO'], ['pwmenu']),
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
real = flag('--real')
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'), 'mcss': os.path.join('css', 'penumbra_colmenu.css'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'css': os.path.join('css', 'main.css'), 'index': 'index.php',
        'ws': os.path.join('js', 'penumbra_wsmenu.js'), 'wcss': os.path.join('css', 'penumbra_wsmenu.css')}
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

# The console window asks for 0.9 x the screen: a screen narrower and lower than the tab (1500 x 900) makes that window
# the smaller of the two, the one arrangement where a menu placed against the wrong window runs off it.
SCREEN = ('<script>\n  try {\n'
          "    Object.defineProperty(window.screen, 'availWidth', { configurable: true, get: function () { return 1000; } });\n"
          "    Object.defineProperty(window.screen, 'availHeight', { configurable: true, get: function () { return 760; } });\n"
          "  } catch (e) { (window.__errors = window.__errors || []).push('screen override: ' + e); }\n</script>\n")
def harness(index_src):
    sys.path.insert(0, PIVMENU)
    import mk_harness
    src = mk_harness.build(index_src)
    a = '<script src="main_hc.js"></script>\n'
    if src.count(a) != 1: raise SystemExit('harness: main_hc.js tag x%d' % src.count(a))
    src = src.replace(a, SCREEN + a)
    # (round 2) the page's own menu after the header menu, as index.php loads it; an admin tool for its Admin list
    # (a same-window link: the navigation step); the console's Run inside the console, as index.php nests it
    b = '<link rel="stylesheet" href="penumbra_colmenu.css">\n<script src="penumbra_colmenu.js"></script>\n'
    if src.count(b) != 1: raise SystemExit('harness: colmenu tags x%d' % src.count(b))
    src = src.replace(b, b + '<script>window.PENUMBRA_ADMIN_TOOLS = [{ id: "zz", label: "ZZ tool", href: "zz_tool.html", desc: "A test tool" }];</script>\n'
                      '<link rel="stylesheet" href="penumbra_wsmenu.css">\n<script src="penumbra_wsmenu.js"></script>\n')
    for o, n in (('<div id="admWrapper"></div>', '<div id="admWrapper"><div id="zzConsoleBar"><button id="executeQuery">Run</button></div></div>'),
                 ('<button id="executeQuery">Run</button><button id="stopQueryBtn">Stop</button>', '<button id="stopQueryBtn">Stop</button>')):
        if src.count(o) != 1: raise SystemExit('harness: %r x%d' % (o, src.count(o)))
        src = src.replace(o, n)
    return src

stage = tempfile.mkdtemp(prefix='pnb_pw_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--disable-popup-blocking', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

class Conn:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=300, suppress_origin=True)
        self.n = 0
    def call(self, m, p=None):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(self, expr):
        return self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')
    def close(self):
        try: self.ws.close()
        except Exception: pass

# --real: REAL input in the console window, a page target of its own. The page half parks at window.__PW_REAL = {...}
# with the points to press; this side presses them and lets the page go on (window.__PW_REAL_GO).
def real_input(main):
    info = None
    t0 = time.time()
    while time.time() - t0 < 120:
        info = main.ev('window.__PW_REAL ? JSON.stringify(window.__PW_REAL) : null')
        if info: break
        if main.ev('window.__HCDONE ? 1 : 0'): return
        time.sleep(0.25)
    if not info: return
    info = json.loads(info)
    pop = None
    for _ in range(40):
        for t in jget('/json'):
            if t.get('type') == 'page' and 'Admin Console' in (t.get('title') or ''): pop = t
        if pop: break
        time.sleep(0.25)
    if not pop:
        main.ev('window.__PW_REAL_GO = { err: "no console window target" }'); return
    pc = Conn(pop['webSocketDebuggerUrl'])
    try:
        pc.call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        def mouse(kind, x, y, button='right', clicks=1):
            pc.call('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': button, 'clickCount': clicks,
                                                 'buttons': 2 if button == 'right' else (1 if button == 'left' else 0)})
        def key(k, code, vk):
            pc.call('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk})
            pc.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk})
        x, y = info['x'], info['y']
        mouse('mouseMoved', x, y, 'none')
        mouse('mousePressed', x, y)
        mouse('mouseReleased', x, y)
        time.sleep(0.4)
        r1 = main.ev('(function () { var w = window._admPip && window._admPip.win; var m = w && w.document.getElementById("pnbHeadMenu"); var a = w && w.document.activeElement; '
                     'return JSON.stringify({ menu: !!m, inTab: !!document.getElementById("pnbHeadMenu"), act: a && a.getAttribute ? a.getAttribute("data-act") : null }); })()')
        if os.environ.get('PW_SHOT'):   # a picture of the console window with the menu open (PW_SHOT=<png>)
            import base64
            open(os.environ['PW_SHOT'], 'wb').write(base64.b64decode(pc.call('Page.captureScreenshot', {'format': 'png'}).get('data', '')))
        key('ArrowDown', 'ArrowDown', 40)
        time.sleep(0.2)
        r2 = main.ev('(function () { var w = window._admPip && window._admPip.win; var a = w && w.document.activeElement; return a && a.getAttribute ? a.getAttribute("data-act") : null; })()')
        key('Escape', 'Escape', 27)
        time.sleep(0.4)
        # the real pointer out of the way (the window's top-left corner, where no menu opens): left over the
        # breakdown, a menu that later opens under it takes the browser's own hover there, which would cancel the
        # page half's scripted hovers - two pointers, a harness artefact (round 2: wsSubHover)
        mouse('mouseMoved', 0, 0, 'none')
        time.sleep(0.2)
        r3 = main.ev('(function () { var w = window._admPip && window._admPip.win; return JSON.stringify({ menu: !!(w && w.document.getElementById("pnbHeadMenu")), dialog: !!(w && w.document.querySelector(".infobox-overlay")) }); })()')
        main.ev('window.__PW_REAL_GO = ' + json.dumps({'r1': r1, 'r2': r2, 'r3': r3}))
    finally:
        pc.close()

# (round 2) The page's last step, driven from here: in the console window's page menu, Admin > ZZ tool (a link to this
# tab's own place). The TAB must follow it (navTab) and the console window must not (navPopKept: its click prevented,
# no window but the tab ever at zz_tool.html).
def run_nav(main, main_id):
    out = {}
    try: out['page'] = json.loads(main.ev('window.__PW_NAV ? window.__PW_NAV() : JSON.stringify({ err: "no __PW_NAV" })') or '{}')
    except Exception as e: out['page'] = {'err': str(e)}
    t0 = time.time(); mainUrl = ''; others = []
    while time.time() - t0 < 6:
        time.sleep(0.3)
        try: ts = jget('/json')
        except Exception: continue
        for tt in ts:
            if tt.get('type') != 'page': continue
            if tt.get('id') == main_id: mainUrl = tt.get('url') or ''
            elif (tt.get('url') or '').endswith('zz_tool.html') and tt.get('url') not in others: others.append(tt.get('url'))
        if mainUrl.endswith('zz_tool.html') or others: time.sleep(0.6); break
    out['mainUrl'] = mainUrl; out['others'] = others
    out['navTab'] = mainUrl.endswith('zz_tool.html')
    out['navPopKept'] = out['page'].get('prevented') is True and not others
    return out

def run_page(path):
    t = jget('/json/new?about:blank', 'PUT')
    main = Conn(t['webSocketDebuggerUrl'])
    try:
        main.call('Network.enable'); main.call('Network.setCacheDisabled', {'cacheDisabled': True})
        main.call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        main.call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        if real: real_input(main)
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = main.ev('window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null')
            if v:
                res = json.loads(v)
                if not res.get('fatal'): res['nav'] = run_nav(main, t['id'])
                return res
        return {'fatal': 'timeout (300 s)'}
    finally:
        main.close()
        try:
            for tt in jget('/json'):
                if tt.get('type') == 'page': urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, tt['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', harness(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('main.css', texts['css'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_wsmenu.js', texts['ws'])
    w('penumbra_wsmenu.css', texts['wcss'])
    w('zz_tool.html', '<!doctype html><title>zz tool</title><p>the ZZ tool</p>')

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, '&real=1' if real else ''))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        nav = r.get('nav') or {}
        chk['navTab'] = nav.get('navTab'); chk['navPopKept'] = nav.get('navPopKept')
        r.setdefault('info', {})['nav'] = nav
        for c in CHK[s] + ['navTab', 'navPopKept'] + (['realMenu', 'realKeys', 'realEsc'] if real else []):
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:700]) if v is not True else '')))
    return out

def git_show(rev, rel):
    r = subprocess.run(['git', '--git-dir=' + GITDIR, 'show', '%s:%s' % (rev, rel)], capture_output=True)
    if r.returncode != 0: raise SystemExit('--control: git has no %s at %s' % (rel, rev))
    return r.stdout.decode('utf-8', 'surrogateescape')

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    if control and CONTROL_REV:
        for k in ('main', 'menu', 'colw', 'ws'): texts[k] = git_show(CONTROL_REV, RELS[k].replace(os.sep, '/'))
    print('under test: %s%s' % (json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}),
                                '   (CONTROL: main.js, colmenu, colwidths, wsmenu at git %s)' % CONTROL_REV if control and CONTROL_REV else ('   (CONTROL: live)' if control else '')))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            write_stage(mutate(texts, m))
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:700]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW and not a.startswith('F-')]
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
