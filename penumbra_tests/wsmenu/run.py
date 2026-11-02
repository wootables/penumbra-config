# =============================================================================
# WSMENU SUITE (2026-11-01) - the page's own right-click menu
# (js/penumbra_wsmenu.js + css/penumbra_wsmenu.css, drawn with css/penumbra_colmenu.css; Recent reports from
# js/penumbra_userseg.js listRows; loaded by index.php and penumbra_admin_chrome.php behind js/penumbra_wsmenu.off).
#   report page   rpt.html (mk_harness.py: the colmenu harness = the REAL main.js on the lrfix fixture, the REAL
#                 header menu, the card view, Quick actions' stub) driven by REAL input over CDP: right-clicks,
#                 Shift+right-click, Shift+F10, keys. R-* opens / where, A-* the items' actions, S-* the lists,
#                 K-* keyboard, V-* / E-* / H-* the viewer, an editor, the home screen, C-* with the header menu
#   admin tool    adm.html (adm_template.html: the chrome's body, bar, nav, status bar and settings drawer - its
#                 script lifted from penumbra_admin_chrome.php): D-*
#   static        index.php / the chrome load it behind the switch, listRows, ES5, no em-dash, help, README: S-*
#   X-<scn>       no page errors
# --control = the build before the menu, read from git (CONTROL_REV below; --control-rev REV for another): every NEW
# check red, the GUARDS green (what that build already does: a cell's and a heading's menu are the header menu's, a
# field / a link / Shift / selected text keep the browser's, an admin tool's data keeps the browser's).
#
#   py -3 run.py [--app DIR] [--control [--control-rev REV]] [--mutants | --mutant NAME[,NAME]] [--scn a,b] [--keep]
# Headless Edge over CDP; stages into %TEMP%\pnb_wsm_*; writes nothing to the webroot. One suite at a time.
# =============================================================================
import html, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js', 'penumbra_palette_boot.js']
FOOT = "Shift+right-click for the browser's menu"
SCN = ['rmenu', 'ractions', 'rsubs', 'rkeys', 'rviewer', 'reditor', 'rhome', 'rcoexist', 'dadmin', 'dzoom', 'dnonadmin']
SCN = SCN + ['rowner', 'ddash', 'ddashlist', 'ddashv', 'dkiosk']   # (round 2) the report's owner, a dashboard
CHK = {
    'rmenu': ['R-opensBar', 'R-items', 'R-title', 'R-foot', 'R-notes', 'R-place', 'R-margin', 'R-header', 'R-status', 'R-claimed', 'R-cellNative', 'R-headNative',
              'R-input', 'R-link', 'R-shift', 'R-selNative', 'R-selElsewhere', 'R-second', 'R-reopen'],
    'ractions': ['A-header', 'A-headerBack', 'A-settings', 'A-rerun', 'A-rowHeight', 'A-viewLink', 'A-metrics', 'A-history', 'A-quick', 'A-cards', 'A-cardsBack',
                 'A-feedback', 'A-theme', 'A-density'],
    'rsubs': ['S-recentOrder', 'S-recentCur', 'S-recentPin', 'S-recentLinks', 'S-recentAgo', 'S-recentRepo', 'S-parity',
              'S-adminHeads', 'S-adminConsole', 'S-adminTools', 'S-adminSave', 'S-tab', 'S-subPlace', 'S-hoverOpens'],
    'rkeys': ['K-open', 'K-place', 'K-arrows', 'K-type', 'K-subOpen', 'K-subBack', 'K-escape', 'K-escNoConsole', 'K-enter'],
    'rviewer': ['V-items', 'V-rerunNote', 'V-recentNoRepo'],
    'reditor': ['E-items', 'E-adminNoTools', 'E-recentNoRepo'],
    'rhome': ['H-kind', 'H-items', 'H-adminTools', 'H-title'],
    'rcoexist': ['C-headThenPage', 'C-pageThenHead'],
    'dadmin': ['D-opens', 'D-items', 'D-title', 'D-data', 'D-recentRepo', 'D-tools', 'D-tabs', 'D-btn', 'D-copy', 'D-settings', 'D-theme', 'D-density'],
    'dzoom': ['D-zoom', 'D-zoomSub'],
    'dnonadmin': ['D-nonAdmin'],
    # (round 2, 2026-11-01: dashboards; Theme / Density; Send feedback)
    'rowner': ['O-items'],
    'ddash': ['G-opens', 'G-items', 'G-title', 'G-notes', 'G-kiosk', 'G-tools', 'G-recent', 'G-run', 'G-copy', 'G-tile'],
    'ddashlist': ['G-listItems', 'G-listTitle', 'G-listRow'],
    'ddashv': ['G-viewerItems', 'G-viewerRecent'],
    'dkiosk': ['G-kioskNone'],
}
# what live already does: the header menu's spots, a field, a link, Shift, selected text, an admin tool's data
GUARDS = {'R-cellNative', 'R-headNative', 'R-input', 'R-link', 'R-shift', 'R-selNative', 'R-claimed', 'D-data', 'G-tile', 'G-listRow', 'G-kioskNone'}
STATIC = ['S-indexLoads', 'S-chromeLoads', 'S-usersegRows', 'S-es5', 'S-noEmdash', 'S-help', 'S-readme', 'S-dashLoads']
# round 2's checks: red on round 1's build (the --control build), with the item lists that grew (Theme, Density, Send feedback)
NEW_R2 = {'R-place', 'R-items', 'V-items', 'E-items', 'H-items', 'D-items', 'D-nonAdmin', 'A-feedback', 'A-theme', 'A-density', 'D-theme', 'D-density', 'O-items',
          'S-help', 'S-readme', 'S-dashLoads'} | {c for k in ('ddash', 'ddashlist', 'ddashv', 'dkiosk') for c in CHK[k]} - {'G-tile', 'G-listRow', 'G-kioskNone'}

# Each mutant: ([(file key, exact old, new)], [checks that must go red], [scenarios to run]). Every anchor once.
MUTANTS = {
    'ws-noprevent': ([('ws', "        if (e.defaultPrevented) { return; }", "        if (false) { return; }")], ['R-claimed'], ['rmenu', 'rcoexist']),
    'ws-noshift': ([('ws', "        if (e.shiftKey && e.button === 2) { lastClosed = 0; return; }", "        if (false) { lastClosed = 0; return; }")], ['R-shift'], ['rmenu']),
    'ws-nosecond': ([('ws', "        if (lastClosed && Date.now() - lastClosed < SECOND_MS) { lastClosed = 0; return; }", "        if (false) { lastClosed = 0; return; }")], ['R-second'], ['rmenu']),
    'ws-nonear': ([('ws', "            Math.abs(e.clientX - cur.at.x) <= NEAR && Math.abs(e.clientY - cur.at.y) <= NEAR) ? Date.now() : 0;", "            true) ? Date.now() : 0;")], ['R-reopen'], ['rmenu']),
    'ws-nosel': ([('ws', "        return !onSelection(e, kbd);", "        return true;")], ['R-selNative'], ['rmenu']),
    'ws-selall': ([('ws', "        if (kbd) { return true; }\n        for (i = 0;", "        return true;\n        for (i = 0;")], ['R-selElsewhere'], ['rmenu']),
    'ws-nonative': ([('ws', "    var NATIVE = 'input, textarea,", "    var NATIVE = 'textarea,")], ['R-input', 'D-data'], ['rmenu', 'dadmin']),
    'ws-nolinks': ([('ws', ".CodeMirror, a[href], area[href],", ".CodeMirror, area[href],")], ['R-link', 'D-data'], ['rmenu', 'dadmin']),
    'ws-nodata': ([('ws', "    var DATA = 'table, canvas, pre, code,", "    var DATA = 'code,")], ['D-data'], ['dadmin']),
    'ws-nozoom': ([('ws', "        m.style.left = Math.round(x / z) + 'px';\n        m.style.top = Math.round(y / z) + 'px';\n    }", "        m.style.left = Math.round(x) + 'px';\n        m.style.top = Math.round(y) + 'px';\n    }")], ['D-zoom'], ['dzoom']),
    'ws-nosubzoom': ([('ws', "        if (x + mr.width > viewW() - 4) { x = Math.max(4, p.left - mr.width + 2); }", "        z = 1;\n        if (x + mr.width > viewW() - 4) { x = Math.max(4, p.left - mr.width + 2); }")], ['D-zoomSub'], ['dzoom']),
    'ws-nostop': ([('ws', "        e.preventDefault();\n        e.stopPropagation();\n    }, true);\n    // the focus gone elsewhere", "        e.preventDefault();\n    }, true);\n    // the focus gone elsewhere")], ['K-escNoConsole'], ['rkeys']),
    'ws-norefocus': ([('ws', "        if (refocus && c.back && c.back !== document.body && document.contains(c.back)) {", "        if (false) {")], ['K-escape', 'K-enter'], ['rkeys']),
    'ws-nokbdanchor': ([('ws', "            if (r && (r.width || r.height)) { x = r.left; y = Math.min(r.bottom, window.innerHeight - 40); }", "            if (false) { x = r.left; y = Math.min(r.bottom, window.innerHeight - 40); }")], ['K-place'], ['rkeys']),
    'ws-notype': ([('ws', "                if (lab && clean(lab.textContent).replace(/^[^a-z0-9]+/i, '').toLowerCase().charAt(0) === ch) { focusItem((i + j) % its.length, pn); break; }", "                if (false) { focusItem((i + j) % its.length, pn); break; }")], ['K-type', 'K-subOpen', 'K-subBack'], ['rkeys']),
    'ws-editgate': ([('ws', "    function canEdit() { var V = vars(); return !!(V && V.isAdmin); }", "    function canEdit() { return true; }")], ['V-items', 'V-rerunNote'], ['rviewer']),
    'ws-globalgate': ([('ws', "    function isGlobal() { var V = vars(), D = dashVars(); return V ? !!V.isGlobalAdmin : (D ? !!D.isAdmin : ADMIN === '1'); }", "    function isGlobal() { return true; }")], ['V-recentNoRepo', 'E-recentNoRepo', 'D-nonAdmin'], ['rviewer', 'reditor', 'dnonadmin']),
    'ws-homeconsole': ([('ws', "con = (kind === 'report' && canEdit()) ? consoleItems() : []", "con = canEdit() ? consoleItems() : []")], ['H-adminTools'], ['rhome']),
    'ws-curreport': ([('ws', "rows = U.listRows(kind === 'report' ? reportId() : null) || [];", "rows = U.listRows(null) || [];")], ['S-recentCur', 'S-recentOrder'], ['rsubs']),
    'ws-norepo': ([('ws', "        if (isGlobal() && kind !== 'repo') { out.push('-', repoItem(kind)); }", "")], ['S-recentOrder', 'S-recentRepo', 'D-recentRepo'], ['rsubs', 'dadmin']),
    'ws-nolinkitem': ([('ws', "        var tag = (it.href && !it.disabled) ? 'a' : 'div';", "        var tag = 'div';")], ['S-recentLinks', 'S-adminTools', 'A-metrics', 'D-recentRepo', 'D-tools'], ['rsubs', 'ractions', 'dadmin']),
    'ws-repoinlist': ([('ws', "            if (!t || t.id === 'repo' || !t.href) { return; }", "            if (!t || !t.href) { return; }")], ['S-adminTools', 'D-tools'], ['rsubs', 'dadmin']),
    'ws-nohere': ([('ws', "checked: t.id === here });", "checked: false });")], ['D-tools'], ['dadmin']),
    'ws-headerlabel': ([('ws', "label: hid ? 'Show header' : 'Hide header'", "label: 'Hide header'")], ['A-headerBack'], ['ractions']),
    'ws-rowcards': ([('ws', "        if (!tg || !rowsShowing() || (C && C.on())) { return null; }", "        if (!tg || !rowsShowing()) { return null; }")], ['A-cards'], ['ractions']),
    'ws-rowstate': ([('ws', "                tg.checked = !on;\n", "                tg.checked = !tg.checked;\n")], ['A-rowHeight'], ['ractions']),
    'ws-nostats': ([('ws', "                return { act: 'tabs-' + i, label: clean(words) || clean(b.textContent), note: badge ? clean(badge.textContent) : '',", "                return { act: 'tabs-' + i, label: clean(b.textContent), note: '',")], ['D-tabs'], ['dadmin']),
    'ws-notitleid': ([('ws', "            return (id && t.toLowerCase() !== id.toLowerCase()) ? t + ' (' + id + ')' : t;", "            return t;")], ['R-title'], ['rmenu']),
    'ws-nofoot': ([('ws', "        if (foot) { html += '<div class=\"pnb-hm-foot\" role=\"note\">' + esc(foot) + '</div>'; }", "")], ['R-foot'], ['rmenu']),
    'ws-statusbar': ([('ws', "'.modal-prompt-overlay, .ui-dialog, .ui-widget-overlay, .ui-autocomplete, .sb-pop,", "'.modal-prompt-overlay, .ui-dialog, .ui-widget-overlay, .ui-autocomplete, #pnbStatusBar, .sb-pop,")], ['R-status'], ['rmenu']),
    'ws-nohover': ([('ws', "            hoverTimer = setTimeout(function () { if (cur && document.contains(itemEl)) { openSub(itemEl, it); } }, 150);", "            hoverTimer = null;")], ['S-hoverOpens'], ['rsubs']),
    'us-order': ([('us', "            if (ta !== tb) return tb - ta;", "            if (ta !== tb) return ta - tb;")], ['S-recentOrder', 'S-parity'], ['rsubs']),
    'us-nopins': ([('us', "        for (i = 0; i < pins.length; i++) out.push({ id: pins[i].id, title: pins[i].title, ts: tsById[pins[i].id], pinned: true });", "")], ['S-recentOrder', 'S-recentPin', 'S-recentLinks', 'S-parity'], ['rsubs']),
    # (round 2) dashboards; Theme / Density; Send feedback
    'ws-nodashtile': ([('ws', "#logBody, .dash-tile, .dash-home-item';", "#logBody, .dash-home-item';")], ['G-tile'], ['ddash']),
    'ws-nodashrow': ([('ws', "#logBody, .dash-tile, .dash-home-item';", "#logBody, .dash-tile';")], ['G-listRow'], ['ddashlist']),
    'ws-nokiosk': ([('ws', "        if (document.body.classList.contains('dash-kiosk')) { return false; }", "")], ['G-kioskNone'], ['dkiosk']),
    'ws-dashopen': ([('ws', "else if (kind === 'dashboard' && dashOpen()) { add(dashLinkItem()); }", "else if (kind === 'dashboard') { add(dashLinkItem()); }")], ['G-listItems'], ['ddashlist']),
    'ws-dashkey': ([('ws', "        if (!k) { return ''; }", "        return '';")], ['G-notes'], ['ddash']),
    'ws-dashglobal': ([('ws', "(D ? !!D.isAdmin : ADMIN === '1')", "(D ? false : ADMIN === '1')")], ['G-items', 'G-tools', 'G-recent'], ['ddash']),
    'ws-dashtitle': ([('ws', "            return (dashOpen() && t) ? t : 'Dashboards';", "            return 'Dashboards';")], ['G-title'], ['ddash']),
    'ws-dashlinkurl': ([('ws', "            run: function () { copyText(window.location.href, 'Link copied.'); } };\n    }\n    // Quick actions", "            run: function () { copyText('dashboard.php', 'Link copied.'); } };\n    }\n    // Quick actions")], ['G-copy'], ['ddash']),
    'ws-viewport': ([('ws', "    function viewW() { return Math.min(document.documentElement.clientWidth || window.innerWidth, window.innerWidth); }", "    function viewW() { return window.innerWidth; }")], ['R-place'], ['rmenu']),
    'ws-themenow': ([('ws', "        if (t) { return t; }\n", "        return 'theme-default';\n")], ['A-theme', 'D-theme'], ['ractions', 'dadmin']),
    'ws-densitynow': ([('ws', "        return b.contains('density-compact') ? 'compact' : (b.contains('density-easy-read') ? 'easy-read' : 'standard');", "        return 'standard';")], ['A-density', 'D-density'], ['ractions', 'dadmin']),
    'ws-themekeep': ([('ws', "            function (v) { return /^theme-/.test(v); }, themeNow);", "            function (v) { return true; }, themeNow);")], ['A-theme', 'D-theme'], ['ractions', 'dadmin']),
    'ws-nochange': ([('ws', "        if (window.jQuery) { window.jQuery(s).trigger('change'); } else { s.dispatchEvent(new Event('change', { bubbles: true })); }", "")], ['A-theme', 'A-density', 'D-theme', 'D-density'], ['ractions', 'dadmin']),
    'ws-fbowner': ([('ws', "!reportId() || (V && V.isReportOwner)) { return null; }", "!reportId()) { return null; }")], ['O-items'], ['rowner']),
    'ws-fbspec': ([('ws', "window.penumbraOpenFeedbackDialog(a ? (a.getAttribute('data-action-value') || '') : FEEDBACK_SPEC,", "window.penumbraOpenFeedbackDialog(a ? (a.getAttribute('data-action-value') || '') : '',")], ['A-feedback'], ['ractions']),
    'dp-noload': ([('dash', "<script src=\"js/penumbra_wsmenu.js?v=<?php echo (int)@filemtime(__DIR__ . '/js/penumbra_wsmenu.js'); ?>\"></script>", "")], ['S-dashLoads'], []),
    'dp-notools': ([('dash', "<?php if (!empty($isAdmin)): ?><div hidden><?php penumbra_admin_tools_menu(); ?></div><?php endif; ?>", "")], ['S-dashLoads'], []),
    'ix-noload': ([('index', "<script defer src=\"js/penumbra_wsmenu.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_wsmenu.js'); ?>\"></script>", "")], ['S-indexLoads'], []),
    'ch-adminflag': ([('chrome', "data-admin=\"<?php echo !empty($isAdmin) ? '1' : '0'; ?>\"", "data-admin=\"1\"")], ['S-chromeLoads'], []),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
control_r1 = flag('--control-r1')
# --control's build = the files as git holds them at a revision: the build before this round (round 1's, 57f6d9e:
# NEW_R2 red, everything else green); --control-r1 the build before the menu (9a9dfb4^: every check but the guards
# red). Every file the harness reads comes from there, so a control is one consistent build whatever has shipped since.
CONTROL_REV = '57f6d9e'      # round 1 live (9a9dfb4 + its help cache): no dashboards, no Theme / Density, no feedback
CONTROL_R1_REV = '9a9dfb4^'  # the menu shipped in 9a9dfb4 (2026-11-01): the build before it
control_rev = opt('--control-rev', CONTROL_R1_REV if control_r1 else CONTROL_REV)
if control_r1: control = True
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
GITDIR = r'\\oitras.oit.ncsu.edu\d$\Utilities\penumbra_git'
sys.path.insert(0, HERE)
import mk_harness

def read_b(p):
    if not os.path.exists(p): return ''   # a build without the module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def git_show(rel):
    r = subprocess.run(['git', '--git-dir=' + GITDIR, 'show', '%s:%s' % (control_rev, rel)], capture_output=True)
    return r.stdout.decode('utf-8', 'surrogateescape') if r.returncode == 0 else ''   # not in that build: EMPTY
def pick(rel):
    p = os.path.join(app_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': 'js/main.js', 'colfmt': 'js/penumbra_colfmt.js', 'calc': 'js/penumbra_calc.js', 'colw': 'js/penumbra_colwidths.js',
        'menu': 'js/penumbra_colmenu.js', 'mcss': 'css/penumbra_colmenu.css', 'css': 'css/main.css', 'cards': 'js/penumbra_cards.js',
        'ccss': 'css/penumbra_cards.css', 'us': 'js/penumbra_userseg.js', 'index': 'index.php', 'chrome': 'penumbra_admin_chrome.php',
        'help': 'help/topics/userSettingsHelpLightbox.php', 'manifest': 'help/manifest.php', 'readme': 'README.md',
        'dash': 'dashboard.php', 'dhelp': 'help/topics/dashboardsHelpLightbox.php'}
# the module and its stylesheet: the build's own (none in a build before the menu: EMPTY)
OWN = {'ws': 'js/penumbra_wsmenu.js', 'wcss': 'css/penumbra_wsmenu.css'}
def load_texts():
    if control:
        t = {k: git_show(v) for k, v in list(RELS.items()) + list(OWN.items())}
        missing = [v for k, v in RELS.items() if not t[k]]
        if missing: raise SystemExit('--control-rev %s: git has no %s' % (control_rev, ', '.join(missing)))
        return t
    t = {k: read_b(pick(v.replace('/', os.sep))) for k, v in RELS.items()}
    for k, v in OWN.items(): t[k] = read_b(os.path.join(app_dir, v.replace('/', os.sep)))
    return t

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
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1: old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

# the admin tools registry, read from the chrome (penumbra_admin_tools()), as PENUMBRA_ADMIN_TOOLS carries it
def tools_json(chrome):
    rows = []
    for m in re.finditer(r"'(\w+)'\s*=>\s*array\('label' => '([^']*)',\s*'href' => '([^']*)',\s*'icon' => '([^']*)',\s*'desc' => '([^']*)'\)", chrome):
        rows.append({'id': m.group(1), 'label': m.group(2), 'href': m.group(3), 'icon': html.unescape(m.group(4)), 'desc': m.group(5)})
    if len(rows) < 7: raise SystemExit('tools registry: %d rows read from the chrome (want 7)' % len(rows))
    return json.dumps(rows)
def drawer(chrome):
    m = re.search(r"\(function \(\) \{\n    // Family settings drawer.*?\n\}\)\(\);", chrome, re.S)
    if not m: raise SystemExit('lift: the family settings drawer script not found in the chrome')
    return m.group(0)

stage = tempfile.mkdtemp(prefix='pnb_wsm_')
if not re.search(r'pnb_wsm_[^\\/]+$', stage): raise SystemExit('bad stage dir')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('wsdriver.js', 'palette_fake.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
ADM = open(os.path.join(HERE, 'adm_template.html'), encoding='utf-8').read()
DASH = open(os.path.join(HERE, 'dash_template.html'), encoding='utf-8').read()
# dashboard.php's userseg configure script, lifted (a build before the dashboard menu has none: nothing)
def dash_configure(dash):
    m = re.search(r"\(function \(\) \{\n    if \(!window\.PenumbraUserSeg\) \{ return; \}\n    window\.PenumbraUserSeg\.configure\(\{ isAdmin: !!penumbra_dash_vars\.isAdmin.*?\n\}\)\(\);", dash, re.S)
    return m.group(0) if m else ''

def write_stage(t):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    tj = tools_json(t['chrome'])
    w('rpt.html', mk_harness.build(t['index'], tj))
    a = ADM.replace('__TOOLS__', tj).replace('__DRAWER__', drawer(t['chrome']))
    w('adm.html', a)
    w('dash.html', DASH.replace('__TOOLS__', tj).replace('__CONFIGURE__', dash_configure(t['dash'])))
    w('main_hc.js', hook(t['main']))
    for k, name in (('colfmt', 'penumbra_colfmt.js'), ('calc', 'penumbra_calc.js'), ('colw', 'penumbra_colwidths.js'), ('menu', 'penumbra_colmenu.js'),
                    ('mcss', 'penumbra_colmenu.css'), ('css', 'main.css'), ('cards', 'penumbra_cards.js'), ('ccss', 'penumbra_cards.css'),
                    ('us', 'penumbra_userseg.js'), ('ws', 'penumbra_wsmenu.js'), ('wcss', 'penumbra_wsmenu.css')):
        w(name, t[k])

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

# ------------------------------------------------------------------ the page driver
class Pg:
    def __init__(s, path):
        s.t = jget('/json/new?about:blank', 'PUT')
        s.ws = websocket.create_connection(s.t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
        s.n = 0
        s.call('Network.enable'); s.call('Network.setCacheDisabled', {'cacheDisabled': True})
        s.call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        s.call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
    def call(s, m, p=None):
        s.n += 1; mid = s.n
        s.ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(s.ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(s, js):
        r = s.call('Runtime.evaluate', {'expression': js, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in r: return {'__exc': str(r['exceptionDetails'].get('exception', {}).get('description', r['exceptionDetails']))[:300]}
        return r.get('result', {}).get('value')
    def wait(s, js, t=20.0):
        t0 = time.time()
        while time.time() - t0 < t:
            v = s.ev(js)
            if v and not (isinstance(v, dict) and '__exc' in v): return v
            time.sleep(0.15)
        return None
    def mouse(s, typ, x, y, button='none', buttons=0, mods=0, count=0):
        s.call('Input.dispatchMouseEvent', {'type': typ, 'x': x, 'y': y, 'button': button, 'buttons': buttons, 'modifiers': mods, 'clickCount': count})
    # (a target that is not there - an item the control build never draws - is no input at all: the checks after it
    # go red on their own, and X-<scn> stays about page errors)
    def rclick(s, pt, mods=0):
        if not pt: return
        s.mouse('mouseMoved', pt['x'], pt['y'], mods=mods)
        s.mouse('mousePressed', pt['x'], pt['y'], 'right', 2, mods, 1)
        s.mouse('mouseReleased', pt['x'], pt['y'], 'right', 0, mods, 1)
        time.sleep(0.15)
    def click(s, pt):
        if not pt: return
        s.mouse('mouseMoved', pt['x'], pt['y'])
        s.mouse('mousePressed', pt['x'], pt['y'], 'left', 1, 0, 1)
        s.mouse('mouseReleased', pt['x'], pt['y'], 'left', 0, 0, 1)
        time.sleep(0.2)
    def hover(s, pt):
        if not pt: return
        s.mouse('mouseMoved', pt['x'], pt['y'])
    KEYS = {'ArrowDown': 40, 'ArrowUp': 38, 'ArrowRight': 39, 'ArrowLeft': 37, 'Enter': 13, 'Escape': 27, 'Home': 36, 'End': 35, 'Tab': 9, 'F10': 121}
    def key(s, k, mods=0):
        vk = s.KEYS.get(k) or ord(k.upper())
        code = k if k in s.KEYS else ('Key' + k.upper())
        down = {'type': 'keyDown' if len(k) > 1 else 'keyDown', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk, 'modifiers': mods}
        if len(k) == 1: down['text'] = k; down['unmodifiedText'] = k
        if k == 'Enter': down['text'] = '\r'
        s.call('Input.dispatchKeyEvent', down)
        s.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk, 'modifiers': mods})
        time.sleep(0.12)
    def menu(s): return s.ev('window.__ws.menu()')
    def acts(s): m = s.menu(); return [i['act'] for i in m['items']] if m else None
    def lastctx(s): c = s.ev('window.__ctx[window.__ctx.length - 1] || null'); return c or {}
    def errors(s): return s.ev('(window.__errors || []).slice(0, 5)') or []
    def close(s):
        try: s.ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, s.t['id']), timeout=10).read()
        except Exception: pass

READY_R = '!!(window.__ws && window.__queryDone >= 1 && document.querySelector("#resultsTable tbody tr") && document.title && document.title !== "wsmenu")'
READY_D = '!!(window.__ws && document.getElementById("gap"))'
def rpt(qs):
    p = Pg('rpt.html?' + qs)
    ok = p.wait(READY_R, 60)
    time.sleep(0.5)
    return p, ok

def scenario(name, out):
    A = lambda cid, okv, detail='': out.append((cid, bool(okv), str(detail)[:400]))
    p = None
    try:
        if name == 'rmenu':
            p, ok = rpt('id=lrfix&scn=wsr')
            # the probes first, so nothing moves after a point is measured: the report header's text and a link in it
            # (index.php's title, subtitle and crumb sit there; a title may hold a link), and a control-bar span that a
            # page-owned menu claims (a document contextmenu listener that cancels the browser's menu)
            p.ev('var d = document.createElement("div"); d.id = "wsHeadProbe"; d.style.padding = "10px";'
                 ' d.innerHTML = "<span id=\\"wsHeadText\\">Report header text</span> <a id=\\"wsProbeLink\\" href=\\"#probe\\">a link in the title</a>";'
                 ' document.getElementById("reportHeaderContainer").appendChild(d);'
                 ' var c = document.createElement("span"); c.id = "wsProbeClaim"; c.textContent = "claimed"; c.style.padding = "4px";'
                 ' document.querySelector("#resultsHeader .header-right").appendChild(c); window.__claimed = 0;'
                 ' document.addEventListener("contextmenu", function (e) { if (e.target && e.target.id === "wsProbeClaim") { e.preventDefault(); window.__claimed++; } }); 1')
            time.sleep(0.3)
            gap = p.ev('window.__ws.gap("#resultsHeader", "right")')
            left = p.ev('window.__ws.gap("#resultsHeader", "left")')
            p.rclick(gap)
            m, c = p.menu(), p.lastctx()
            A('R-opensBar', m is not None and c.get('prevented') and not c.get('head') and c.get('id') == 'resultsHeader', '%s %s' % (gap, c))
            A('R-items', m and [i['act'] for i in m['items']] == ['header', 'settings', 'theme', 'density', 'viewLink', 'quick', 'recent', 'admin', 'rerun', 'metrics', 'feedback', 'history', 'cardsShow', 'rowHeight'], m and [i['act'] for i in m['items']])
            A('R-title', m and m['name'] == 'Lazy rows fixture (lrfix)', m and m['name'])
            A('R-foot', m and m['foot'] == FOOT, m and m['foot'])
            notes = dict((i['act'], i['note']) for i in m['items']) if m else {}
            A('R-notes', notes.get('header') == 'F2' and notes.get('settings') == 'Ctrl+,' and notes.get('quick') == 'Ctrl+K' and notes.get('rerun') == 'F9'
              and notes.get('history') == 'Ctrl+Shift+Y' and notes.get('rowHeight') == 'Ctrl+Shift+H' and notes.get('viewLink') == '', notes)
            # at the pointer; near the right edge, kept on screen
            vw = p.ev('window.innerWidth')
            cw = p.ev('document.documentElement.clientWidth')   # less the page's scrollbar: the harness page has one
            clamp = m and cw < vw - 5 and m['rect']['right'] <= cw - 3 and m['rect']['right'] >= cw - 6
            p.key('Escape')
            p.rclick(left)
            m2 = p.menu()
            A('R-place', clamp and m2 and abs(m2['rect']['left'] - left['x']) <= 1 and abs(m2['rect']['top'] - left['y']) <= 1
              and abs((m['rect']['right'] - m['rect']['left']) - (m2['rect']['right'] - m2['rect']['left'])) <= 1,
              '%s %s %s vw=%s cw=%s' % (m and m['rect'], left, m2 and m2['rect'], vw, cw))
            p.key('Escape')
            p.rclick({'x': 3, 'y': 300})
            A('R-margin', p.menu() is not None and p.lastctx().get('prevented') and p.lastctx().get('tag') == 'HTML', p.lastctx())
            p.key('Escape')
            p.rclick(p.ev('window.__ws.center("#wsHeadText")'))
            A('R-header', p.menu() is not None and p.lastctx().get('id') == 'wsHeadText', p.lastctx())
            p.key('Escape')
            sb = p.ev('window.__ws.gap("#pnbStatusBar", "left")')
            p.rclick(sb)
            A('R-status', sb and p.menu() is not None, '%s %s' % (sb, p.lastctx()))
            p.key('Escape')
            # another listener took the right-click (cancelled the browser's menu): it is theirs
            n0 = p.ev('window.__claimed')
            p.rclick(p.ev('window.__ws.center("#wsProbeClaim")'))
            c = p.lastctx()
            A('R-claimed', p.ev('window.__claimed') == n0 + 1 and c.get('id') == 'wsProbeClaim' and not c.get('page') and p.menu() is None, c)
            cell = p.ev('window.__ws.center("#resultsTable tbody tr:nth-child(2) td:nth-child(3)")')
            p.rclick(cell)
            c = p.lastctx()
            A('R-cellNative', c.get('head') and not c.get('page') and p.menu() is None, c)
            p.key('Escape')
            th = p.ev('window.__ws.center("#tableHeader th[data-colname=V_NAME]")')
            p.rclick(th)
            c = p.lastctx()
            A('R-headNative', c.get('head') and not c.get('page') and p.menu() is None, c)
            p.key('Escape')
            p.rclick(p.ev('window.__ws.center("#tableSearch")'))
            c = p.lastctx()
            A('R-input', not c.get('prevented') and p.menu() is None, c)
            p.rclick(p.ev('window.__ws.center("#wsProbeLink")'))
            c = p.lastctx()
            A('R-link', not c.get('prevented') and p.menu() is None and c.get('id') == 'wsProbeLink', c)
            p.rclick(gap, 8)
            c = p.lastctx()
            A('R-shift', not c.get('prevented') and p.menu() is None and c.get('id') == 'resultsHeader', c)
            sel = p.ev('window.__ws.select("#wsHeadText")')
            p.rclick(sel)
            c = p.lastctx()
            A('R-selNative', not c.get('prevented') and p.menu() is None, c)
            # the same text selected, the right-click elsewhere: the menu. Chrome collapses a selection on a right
            # mousedown away from it, so this is the event a browser that keeps the selection (Firefox) sends: a
            # contextmenu at the control bar's gap, the text still selected
            p.ev('window.__ws.select("#wsHeadText"), 1')
            had = p.ev('!window.getSelection().isCollapsed')
            p.ev('document.elementFromPoint(%d, %d).dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: %d, clientY: %d})), 1'
                 % (gap['x'], gap['y'], gap['x'], gap['y']))
            time.sleep(0.15)
            A('R-selElsewhere', had and p.ev('!window.getSelection().isCollapsed') and p.menu() is not None and p.lastctx().get('prevented'), '%s %s' % (had, p.lastctx()))
            p.key('Escape')
            p.ev('window.getSelection().removeAllRanges(), 1')
            # again on the spot: on the menu's own corner (it opens at the pointer), and with the pointer left beside the
            # menu (2px from the window's right edge, in the page margin: the menu, kept 4px inside, opens left of it) -
            # the browser's menu each time
            p.rclick(left)
            first = p.menu() is not None
            p.rclick(left)
            c = p.lastctx()
            edge = {'x': vw - 2, 'y': 300}
            p.rclick(edge)
            m3 = p.menu()
            beside = bool(m3) and edge['x'] > m3['rect']['right']
            p.rclick(edge)
            c2 = p.lastctx()
            A('R-second', first and beside and not c.get('prevented') and not c2.get('prevented') and c2.get('tag') == 'HTML' and p.menu() is None,
              '%s %s %s %s' % (first, c, m3 and m3['rect'], c2))
            # elsewhere on the same element (the far end of the control bar): the menu again, there
            p.rclick(gap)
            p.rclick(left)
            c = p.lastctx()
            A('R-reopen', abs(left['x'] - gap['x']) > 40 and c.get('id') == 'resultsHeader' and p.menu() is not None and c.get('prevented'), '%s %s %s' % (gap, left, c))
        elif name == 'ractions':
            p, ok = rpt('id=lrfix&scn=wsa')
            gap = p.ev('window.__ws.gap("#resultsHeader", "right")')
            def run(act, d=0):
                p.rclick(gap)
                pt = p.ev('window.__ws.itemAt(%s, %d)' % (json.dumps(act), d))
                if pt: p.click(pt)
                time.sleep(0.25)
                return pt
            run('header')
            A('A-header', p.ev('document.getElementById("reportHeaderContainer").classList.contains("is-collapsed")'), p.ev('document.getElementById("reportHeaderContainer").className'))
            p.rclick(gap)
            lab = [i['label'] for i in (p.menu() or {'items': []})['items'] if i['act'] == 'header']
            p.key('Escape')
            run('header')
            A('A-headerBack', lab == ['Show header'] and not p.ev('document.getElementById("reportHeaderContainer").classList.contains("is-collapsed")'), lab)
            run('settings')
            A('A-settings', p.ev('document.getElementById("settingsPanel").classList.contains("is-open")'), p.ev('document.getElementById("settingsPanel").className'))
            p.key('Escape'); time.sleep(0.3)
            p.ev('document.getElementById("settingsPanel").classList.contains("is-open") && document.getElementById("settingsPanelClose").click(), 1')
            q0 = p.ev('window.__queryDone')
            run('rerun')
            A('A-rerun', p.wait('window.__queryDone > %d' % q0, 10), '%s -> %s' % (q0, p.ev('window.__queryDone')))
            time.sleep(0.6)
            p.rclick(gap)
            before = [i['checked'] for i in (p.menu() or {'items': []})['items'] if i['act'] == 'rowHeight']
            on0 = not p.ev('document.body.classList.contains("disable-auto-expand")')
            p.key('Escape')
            p.ev('var t = document.getElementById("spRowExpandToggle"); t.checked = document.body.classList.contains("disable-auto-expand"); 1')
            run('rowHeight')
            on1 = not p.ev('document.body.classList.contains("disable-auto-expand")')
            A('A-rowHeight', before == [('true' if on0 else 'false')] and on1 != on0, '%s %s %s' % (before, on0, on1))
            run('rowHeight')
            n0 = p.ev('window.__clip.length')
            run('viewLink')
            clip = p.wait('window.__clip.length > %d && window.__clip[window.__clip.length - 1]' % n0, 5)
            A('A-viewLink', clip and 'id=lrfix' in clip, clip)
            p.rclick(gap)
            mi = [i for i in (p.menu() or {'items': []})['items'] if i['act'] == 'metrics']
            A('A-metrics', mi and mi[0]['tag'] == 'A' and mi[0]['href'] == 'analytics.php?id=lrfix' and mi[0]['target'] == '_blank' and mi[0]['rel'] == 'noopener', mi)
            p.key('Escape')
            p.ev('window.__ws.spy(window.Penumbra, "openVersionHistory", "vh")')
            run('history')
            A('A-history', p.wait('window.__calls.indexOf("vh") >= 0', 3), p.ev('window.__calls'))
            p.ev('window.Penumbra.closeVersionHistory && window.Penumbra.closeVersionHistory(); var x = document.querySelector(".help-lightbox[style*=flex] .close-lightbox"); x && x.click(); 1')
            p.key('Escape'); time.sleep(0.3)
            n1 = p.ev('(window.__palOpens || []).length')
            run('quick')
            A('A-quick', p.wait('(window.__palOpens || []).length > %d' % n1, 6), p.ev('window.__palOpens'))
            p.key('Escape'); time.sleep(0.2)
            run('cardsShow')
            on = p.wait('window.Penumbra.cards && window.Penumbra.cards.on()', 5)
            time.sleep(0.4)
            p.rclick(p.ev('window.__ws.gap("#resultsHeader", "right")'))
            a2 = p.acts() or []
            A('A-cards', on and 'cardsTable' in a2 and 'rowHeight' not in a2 and 'cardsShow' not in a2, a2)
            pt = p.ev('window.__ws.itemAt("cardsTable", 0)')
            if pt: p.click(pt)
            A('A-cardsBack', on and p.wait('window.Penumbra.cards && !window.Penumbra.cards.on()', 5), p.ev('window.Penumbra.cards.view()'))
            # (round 2) feedback, Theme, Density - last: a theme or a density restyles the page under any later step
            p.ev('window.__fbArgs = []; window.penumbraOpenFeedbackDialog = function (s, l) { window.__fbArgs.push([String(s), String(l)]); }; 1')
            run('feedback')
            fb = p.wait('window.__fbArgs.length && window.__fbArgs[0]', 3)
            A('A-feedback', fb == ['freeze ; Bug|What happened?* ; Suggestion|What would help? ; Question|What would you like to know?', 'Send feedback to the report owner'], fb)
            def sub_of(act):
                g = p.ev('window.__ws.gap("#resultsHeader", "right")')
                p.rclick(g)
                p.click(p.ev('window.__ws.itemAt(%s, 0)' % json.dumps(act)))
                time.sleep(0.3)
                mm = p.menu() or {'subs': []}
                return [(i['label'], i['checked']) for i in (mm['subs'][0]['items'] if mm['subs'] else [])]
            t0 = sub_of('theme')
            p.click(p.ev('window.__ws.itemAt("theme-theme-dark-blue", 1)'))
            dt = p.wait('document.body.getAttribute("data-theme") === "theme-dark-blue"', 4)
            time.sleep(0.3)
            t1 = sub_of('theme')
            p.key('Escape')
            A('A-theme', t0 == [('Default Light', 'true'), ('Dark Blue', 'false')] and dt and t1 == [('Default Light', 'false'), ('Dark Blue', 'true')], [t0, dt, t1])
            d0 = sub_of('density')
            p.click(p.ev('window.__ws.itemAt("density-compact", 1)'))
            dc = p.wait('document.body.classList.contains("density-compact")', 4)
            time.sleep(0.3)
            d1 = sub_of('density')
            p.key('Escape')
            A('A-density', d0 == [('Standard', 'true'), ('Compact', 'false'), ('Easy Read', 'false')] and dc and d1 == [('Standard', 'false'), ('Compact', 'true'), ('Easy Read', 'false')], [d0, dc, d1])
        elif name == 'rsubs':
            p, ok = rpt('id=lrfix&scn=wss')
            now = int(time.time() * 1000)
            p.ev('localStorage.setItem("pnb_recent_reports", JSON.stringify([{id:"lrfix",title:"Lazy rows fixture",ts:%d},{id:"aaa",title:"Alpha report",ts:%d},'
                 '{id:"bbb",title:"Beta report",ts:%d},{id:"ccc",title:"Gamma",ts:%d}])); localStorage.setItem("penumbra_favorite_server_reports", JSON.stringify([{id:"zzz",title:"Zed pinned"},{id:"ccc",title:"Gamma"}])); 1'
                 % (now, now - 125000, now - 7300000, now - 3 * 86400000 - 1000))
            gap = p.ev('window.__ws.gap("#resultsHeader", "left")')
            p.rclick(gap)
            rp = p.ev('window.__ws.itemAt("recent", 0)')
            p.hover(rp)   # S-hoverOpens: resting on the item opens its list
            time.sleep(0.5)
            m = p.menu() or {'subs': []}
            A('S-hoverOpens', len(m['subs']) == 1, len(m['subs']))
            p.click(rp)   # (a click on its item opens it too - or keeps it: the list's checks stand on their own)
            time.sleep(0.3)
            m = p.menu() or {'subs': []}
            sub = m['subs'][0]['items'] if m['subs'] else []
            labels = [i['label'] for i in sub]
            A('S-recentOrder', labels == ['Gamma', 'Zed pinned', 'Alpha report', 'Beta report', 'Repository'], labels)
            A('S-recentCur', 'Alpha report' in labels and 'Lazy rows fixture' not in labels and all('lrfix' not in (i['href'] or '') for i in sub), labels)
            g = [i for i in sub if i['label'] == 'Gamma']
            A('S-recentPin', g and g[0]['mark'] == '\u2665' and g[0]['aria'] == 'Pinned: Gamma', g)
            A('S-recentLinks', g and g[0]['tag'] == 'A' and g[0]['href'] == 'index.php?id=ccc', g)
            al = [i for i in sub if i['label'] == 'Alpha report']
            A('S-recentAgo', al and al[0]['note'] == '2m ago', al)
            sp = m['subs'][0]['rect'] if m['subs'] else None
            A('S-subPlace', sp and abs(sp['left'] - (m['rect']['right'] - 2)) <= 3, '%s %s' % (sp, m.get('rect')))
            p.ev('window.__ws.spy(window, "penumbraOpenRepo", "repo")')
            rpt_ = p.ev('window.__ws.itemAt("repo", 1)')
            if rpt_: p.click(rpt_)
            A('S-recentRepo', p.wait('window.__calls.indexOf("repo") >= 0', 3), p.ev('window.__calls'))
            p.key('Escape'); time.sleep(0.3)
            par = p.ev('(function(){var U=window.PenumbraUserSeg, d=document.createElement("div"); d.innerHTML=U.buildListHtml("lrfix");'
                       'return {html: Array.prototype.map.call(d.querySelectorAll(".sb-recent-row"), function(r){return r.getAttribute("data-id")}), rows: (U.listRows ? U.listRows("lrfix").map(function(r){return r.id}) : null), rule: d.querySelectorAll(".sb-zone-rule").length};})()')
            A('S-parity', par and par['rows'] is not None and par['html'] == par['rows'] == ['ccc', 'zzz', 'aaa', 'bbb'] and par['rule'] == 1, par)
            p.rclick(gap)
            p.click(p.ev('window.__ws.itemAt("admin", 0)'))
            time.sleep(0.5)
            m = p.menu() or {'subs': []}
            s0 = m['subs'][0] if m['subs'] else {'items': [], 'heads': []}
            A('S-adminHeads', s0['heads'] == ['Admin controls', 'Admin tools'], s0['heads'])
            lab = [i['label'] for i in s0['items']]
            con = 'Hide admin controls' if p.ev('document.body.classList.contains("admin-view")') else 'Show admin controls'
            A('S-adminConsole', lab[:6] == [con, 'SQL Editor', 'Custom Code', 'View Options', 'Scheduler', 'Auditor'] and s0['items'][0]['note'] == 'Esc', lab)
            tl = [i for i in s0['items'] if (i['act'] or '').startswith('tool-')]
            A('S-adminTools', [i['act'] for i in tl] == ['tool-metrics', 'tool-calendar', 'tool-health', 'tool-grants', 'tool-notice', 'tool-tags']
              and all(i['tag'] == 'A' and i['href'] for i in tl) and tl and tl[0]['label'].endswith('Metrics'), [(i['act'], i['label'], i['href']) for i in tl])
            sv = s0['items'][-1] if s0['items'] else {}
            p.ev('window.__clicks = []; 1')
            spt = p.ev('window.__ws.itemAt("save", 1)')
            if spt: p.click(spt)
            time.sleep(0.3)
            A('S-adminSave', sv.get('act') == 'save' and sv.get('label') == 'Save this report...' and sv.get('note') == 'Ctrl+S' and 'saveQuery' in (p.ev('window.__clicks') or []), '%s %s' % (sv, p.ev('window.__clicks')))
            p.key('Escape'); time.sleep(0.2)
            p.ev('var lb = document.getElementById("saveStateLightbox"); if (lb) lb.style.display = "none"; 1')
            p.rclick(gap)
            p.click(p.ev('window.__ws.itemAt("admin", 0)'))
            time.sleep(0.5)
            vo = p.ev('window.__ws.itemAt("tab-view-options-tab", 1)')
            if vo: p.click(vo)
            time.sleep(0.6)
            A('S-tab', p.ev('document.body.classList.contains("admin-view")') and p.ev('(function(){var a=document.querySelector("#editorTabs a[href=\\"#view-options-tab\\"]"); return !!(a && a.parentNode.classList.contains("ui-tabs-active"));})()'),
              p.ev('document.body.className'))
        elif name == 'rkeys':
            p, ok = rpt('id=lrfix&scn=wsk')
            p.ev('var b = document.createElement("button"); b.type = "button"; b.id = "wsProbeBtn"; b.textContent = "Probe"; document.getElementById("resultsHeader").appendChild(b); b.focus(); 1')
            av0 = p.ev('document.body.classList.contains("admin-view")')
            p.key('F10', 8)
            m = p.menu()
            if m is None:   # the keyboard's own contextmenu did not arrive: what it would send (button 0, no pointer)
                p.ev('document.getElementById("wsProbeBtn").dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0})), 1')
                m = p.menu()
            A('K-open', m is not None and m['focus'] == 'header', m and m['focus'])
            br = p.ev('(function(){var r=document.getElementById("wsProbeBtn").getBoundingClientRect(); return {left:r.left, bottom:r.bottom};})()')
            A('K-place', m and br and abs(m['rect']['left'] - br['left']) <= 2 and abs(m['rect']['top'] - br['bottom']) <= 2, '%s %s' % (m and m['rect'], br))
            p.key('ArrowDown')
            A('K-arrows', (p.menu() or {}).get('focus') == 'settings', (p.menu() or {}).get('focus'))
            p.key('r')
            A('K-type', (p.menu() or {}).get('focus') == 'recent', (p.menu() or {}).get('focus'))
            p.key('ArrowRight')
            m = p.menu() or {'subs': []}
            A('K-subOpen', len(m['subs']) == 1 and (m.get('focus') or '').startswith('recent'), '%s %s' % (len(m['subs']), m.get('focus')))
            p.key('ArrowLeft')
            m = p.menu() or {'subs': [1]}
            A('K-subBack', len(m['subs']) == 0 and m.get('focus') == 'recent', '%s %s' % (len(m['subs']), m.get('focus')))
            # Escape closes the menu, and only the menu: main.js's own Escape (the console's show / hide) writes
            # penumbra_admin_open - it must not run (the harness's console is in a hidden box, so its class only opens)
            was = p.menu() is not None
            p.ev('localStorage.removeItem("penumbra_admin_open"), 1')
            p.key('Escape')
            A('K-escape', was and p.menu() is None and p.ev('document.activeElement && document.activeElement.id') == 'wsProbeBtn', '%s %s' % (was, p.ev('document.activeElement && document.activeElement.id')))
            A('K-escNoConsole', was and p.ev('localStorage.getItem("penumbra_admin_open")') is None and p.ev('document.body.classList.contains("admin-view")') == av0,
              '%s %s %s' % (was, p.ev('localStorage.getItem("penumbra_admin_open")'), av0))
            p.ev('document.getElementById("wsProbeBtn").focus(), 1')
            on0 = not p.ev('document.body.classList.contains("disable-auto-expand")')
            p.key('F10', 8)
            if p.menu() is None:
                p.ev('document.getElementById("wsProbeBtn").dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0})), 1')
            p.key('End')
            last = (p.menu() or {}).get('focus')
            p.key('Enter')
            time.sleep(0.3)
            on1 = not p.ev('document.body.classList.contains("disable-auto-expand")')
            A('K-enter', last == 'rowHeight' and on1 != on0 and p.menu() is None and p.ev('document.activeElement && document.activeElement.id') == 'wsProbeBtn', '%s %s %s %s' % (last, on0, on1, p.ev('document.activeElement && document.activeElement.id')))
        elif name in ('rviewer', 'reditor'):
            p, ok = rpt('id=lrfix&scn=wsv&role=' + ('viewer' if name == 'rviewer' else 'editor'))
            gap = p.ev('window.__ws.gap("#resultsHeader", "right")')
            p.rclick(gap)
            m = p.menu() or {'items': []}
            acts = [i['act'] for i in m['items']]
            if name == 'rviewer':
                A('V-items', acts == ['header', 'settings', 'theme', 'density', 'viewLink', 'quick', 'recent', 'rerun', 'metrics', 'feedback', 'cardsShow', 'rowHeight'], acts)
                A('V-rerunNote', [i['note'] for i in m['items'] if i['act'] == 'rerun'] == [''], [i for i in m['items'] if i['act'] == 'rerun'])
            else:
                A('E-items', acts == ['header', 'settings', 'theme', 'density', 'viewLink', 'quick', 'recent', 'admin', 'rerun', 'metrics', 'feedback', 'history', 'cardsShow', 'rowHeight'], acts)
                p.click(p.ev('window.__ws.itemAt("admin", 0)'))
                time.sleep(0.5)
                mm = p.menu() or {'subs': []}
                s0 = mm['subs'][0] if mm['subs'] else {'items': [], 'heads': []}
                A('E-adminNoTools', s0['heads'] == ['Admin controls'] and [i['act'] for i in s0['items']] == ['console', 'tab-sql-editor-tab', 'tab-report-options-tab', 'tab-view-options-tab', 'tab-scheduler-tab', 'tab-auditor-tab', 'save'],
                  [s0['heads'], [i['act'] for i in s0['items']]])
                p.key('Escape')
                p.rclick(gap)
            p.click(p.ev('window.__ws.itemAt("recent", 0)'))
            time.sleep(0.5)
            mm = p.menu() or {'subs': []}
            s0 = mm['subs'][0]['items'] if mm['subs'] else []
            A('V-recentNoRepo' if name == 'rviewer' else 'E-recentNoRepo', [i['act'] for i in s0] == ['recentNone'] and s0[0]['disabled'], [(i['act'], i['label']) for i in s0])
        elif name == 'rhome':
            p, ok = rpt('scn=wsh')
            A('H-kind', p.ev('window.PenumbraPageMenu && window.PenumbraPageMenu.kind()') == 'home', p.ev('window.PenumbraPageMenu && window.PenumbraPageMenu.kind()'))
            p.rclick(p.ev('window.__ws.gap("#resultsHeader", "right")'))
            m = p.menu() or {'items': [], 'name': None}
            acts = [i['act'] for i in m['items']]
            A('H-items', acts == ['header', 'settings', 'theme', 'density', 'quick', 'recent', 'admin'], acts)
            A('H-title', m['name'] == 'Penumbra', m['name'])
            p.click(p.ev('window.__ws.itemAt("admin", 0)'))
            time.sleep(0.5)
            mm = p.menu() or {'subs': []}
            s0 = mm['subs'][0] if mm['subs'] else {'items': [], 'heads': []}
            A('H-adminTools', s0['heads'] == ['Admin tools'] and len(s0['items']) == 6 and all((i['act'] or '').startswith('tool-') for i in s0['items']), [s0['heads'], [i['act'] for i in s0['items']]])
        elif name == 'rcoexist':
            p, ok = rpt('id=lrfix&scn=wsc')
            gap = p.ev('window.__ws.gap("#resultsHeader", "right")')
            th = p.ev('window.__ws.center("#tableHeader th[data-colname=V_NAME]")')
            p.rclick(th)
            h1 = p.ev('!!document.getElementById("pnbHeadMenu")')
            p.rclick(gap)
            A('C-headThenPage', h1 and p.menu() is not None and not p.ev('!!document.getElementById("pnbHeadMenu")'), '%s %s' % (h1, p.lastctx()))
            pg = p.menu() is not None
            cell = p.ev('window.__ws.center("#resultsTable tbody tr:nth-child(3) td:nth-child(3)")')
            p.rclick(cell)
            A('C-pageThenHead', pg and p.menu() is None and p.ev('!!document.getElementById("pnbHeadMenu")') and p.ev('document.querySelectorAll(".pnb-hm:not(.pnb-hm-sub)").length') == 1, '%s %s' % (pg, p.lastctx()))
        elif name == 'rowner':
            # (round 2) the report's owner: no Send feedback (it would come back to them)
            p, ok = rpt('id=lrfix&scn=wso&role=owner')
            p.rclick(p.ev('window.__ws.gap("#resultsHeader", "right")'))
            acts = p.acts() or []
            A('O-items', acts == ['header', 'settings', 'theme', 'density', 'viewLink', 'quick', 'recent', 'admin', 'rerun', 'metrics', 'history', 'cardsShow', 'rowHeight'], acts)
        elif name in ('ddash', 'ddashlist', 'ddashv', 'dkiosk'):
            # (round 2) a dashboard (dash_template.html): its header's buttons, the tools, the list page, a viewer, kiosk view
            qs = {'ddash': 'admin=1', 'ddashlist': 'admin=1&list=1', 'ddashv': 'admin=0', 'dkiosk': 'admin=1&kiosk=1'}[name]
            p = Pg('dash.html?' + qs)
            p.wait('!!(window.__ws && document.getElementById("dashGap"))', 30)
            time.sleep(0.3)
            gap = p.ev('window.__ws.center("#dashGap")')
            if name == 'ddash':
                now = int(time.time() * 1000)
                p.ev('localStorage.setItem("pnb_recent_reports", JSON.stringify([{id:"aaa",title:"Alpha report",ts:%d}])); 1' % (now - 60000))
                p.rclick(gap)
                m, c = p.menu(), p.lastctx()
                A('G-opens', m is not None and c.get('prevented') and c.get('id') == 'dashGap', c)
                items = m['items'] if m else []
                A('G-items', [i['act'] for i in items] == ['dashLink', 'quick', 'recent', 'admin', 'dash-dashRefreshBtn', 'dashlink-kiosk', 'dash-dashEditBtn', 'dash-dashHelpBtn'], [i['act'] for i in items])
                A('G-title', bool(m) and m['name'] == 'Sponsor KPIs', m and m['name'])
                own = [(i['label'], i['note']) for i in items if (i['act'] or '').startswith('dash') and i['act'] != 'dashLink']
                A('G-notes', own == [('Refresh', 'R'), ('Kiosk', 'K'), ('Edit', 'E'), ('Help', 'H')], own)
                k = [i for i in items if i['act'] == 'dashlink-kiosk']
                A('G-kiosk', bool(k) and k[0]['tag'] == 'A' and k[0]['href'] == 'dashboard.php?id=kpis&kiosk=1', k)
                p.click(p.ev('window.__ws.itemAt("admin", 0)'))
                time.sleep(0.3)
                mm = p.menu() or {'subs': []}
                s1 = mm['subs'][0] if mm['subs'] else {'items': [], 'heads': []}
                A('G-tools', s1['heads'] == ['Admin tools'] and [i['act'] for i in s1['items']] == ['tool-metrics', 'tool-calendar', 'tool-health', 'tool-grants', 'tool-notice', 'tool-tags']
                  and all(i['checked'] == 'false' for i in s1['items']), [s1['heads'], [(i['act'], i['checked']) for i in s1['items']]])
                p.key('Escape')
                p.rclick(gap)
                p.click(p.ev('window.__ws.itemAt("recent", 0)'))
                time.sleep(0.3)
                mm = p.menu() or {'subs': []}
                s0 = [(i['act'], i['tag'], i['href']) for i in (mm['subs'][0]['items'] if mm['subs'] else [])]
                A('G-recent', s0 == [('recent-0', 'A', 'index.php?id=aaa'), ('repo', 'A', 'repository.php')], s0)
                p.key('Escape')
                p.ev('window.__clicks = []; 1')
                p.rclick(gap)
                p.click(p.ev('window.__ws.itemAt("dash-dashRefreshBtn", 0)'))
                time.sleep(0.2)
                A('G-run', 'dashRefreshBtn' in (p.ev('window.__clicks') or []), p.ev('window.__clicks'))
                p.rclick(gap)
                p.click(p.ev('window.__ws.itemAt("dashLink", 0)'))
                clip = p.wait('window.__clip.length && window.__clip[window.__clip.length - 1]', 3)
                toast = p.ev('(function(){var t=document.getElementById("pnbPageMenuToast"); return t ? {on: t.classList.contains("is-on"), text: t.textContent} : null;})()')
                A('G-copy', bool(clip) and clip == p.ev('location.href') and bool(toast) and toast['on'] and toast['text'] == 'Link copied.', '%s %s' % (clip, toast))
                p.rclick(p.ev('window.__ws.center("#tile3 .dash-tile-body")'))
                c = p.lastctx()
                A('G-tile', not c.get('prevented') and p.menu() is None, c)
            elif name == 'ddashlist':
                p.rclick(gap)
                m = p.menu() or {'items': [], 'name': None}
                A('G-listItems', [i['act'] for i in m['items']] == ['quick', 'recent', 'admin', 'dash-dashCreateBtn', 'dash-dashHelpBtn']
                  and [i['label'] for i in m['items']][-2:] == ['New dashboard', 'Help'], [(i['act'], i['label']) for i in m['items']])
                A('G-listTitle', m['name'] == 'Dashboards', m['name'])
                p.key('Escape')
                p.rclick(p.ev('window.__ws.center("#dashRow1 .dash-home-title")'))
                c = p.lastctx()
                A('G-listRow', not c.get('prevented') and p.menu() is None, c)
            elif name == 'ddashv':
                p.rclick(gap)
                m = p.menu() or {'items': []}
                A('G-viewerItems', [i['act'] for i in m['items']] == ['dashLink', 'quick', 'recent', 'dash-dashRefreshBtn', 'dashlink-kiosk', 'dash-dashEditBtn', 'dash-dashHelpBtn'], [i['act'] for i in m['items']])
                p.click(p.ev('window.__ws.itemAt("recent", 0)'))
                time.sleep(0.3)
                mm = p.menu() or {'subs': []}
                s0 = [(i['act'], i['label']) for i in (mm['subs'][0]['items'] if mm['subs'] else [])]
                A('G-viewerRecent', s0 == [('recentNone', 'No reports opened yet')], s0)
            else:
                p.rclick(gap)
                c = p.lastctx()
                A('G-kioskNone', not c.get('prevented') and p.menu() is None and c.get('id') == 'dashGap', c)
        elif name in ('dadmin', 'dzoom', 'dnonadmin'):
            qs = {'dadmin': 'admin=1&tool=grants', 'dzoom': 'admin=1&tool=grants&dz=easy-read', 'dnonadmin': 'admin=0&tool=grants'}[name]
            p = Pg('adm.html?' + qs)
            p.wait(READY_D, 30)
            time.sleep(0.4)
            gap = p.ev('window.__ws.center("#gap")')
            if name == 'dadmin':
                p.rclick(gap)
                m, c = p.menu(), p.lastctx()
                A('D-opens', m is not None and c.get('prevented'), c)
                acts = [i['act'] for i in m['items']] if m else None
                A('D-items', acts == ['settings', 'theme', 'density', 'pageLink', 'quick', 'recent', 'admin', 'addUser', 'saveGrants', 'newTag', 'tabs'], acts)
                A('D-title', m and m['name'] == 'Manage Grants', m and m['name'])
                p.key('Escape')
                natives = []
                for sel in ('#dataCell', '#chart', '#logPre', '#someInput', '#someLink'):
                    p.rclick(p.ev('window.__ws.center(%s)' % json.dumps(sel)))
                    c = p.lastctx()
                    natives.append((sel, not c.get('prevented') and p.menu() is None))
                A('D-data', all(v for _, v in natives), natives)
                p.rclick(gap)
                p.click(p.ev('window.__ws.itemAt("recent", 0)'))
                time.sleep(0.5)
                mm = p.menu() or {'subs': []}
                s0 = mm['subs'][0]['items'] if mm['subs'] else []
                A('D-recentRepo', s0 and s0[-1]['act'] == 'repo' and s0[-1]['tag'] == 'A' and s0[-1]['href'] == 'repository.php', [(i['act'], i['tag'], i['href']) for i in s0])
                p.click(p.ev('window.__ws.itemAt("admin", 0)'))
                time.sleep(0.5)
                mm = p.menu() or {'subs': []}
                s1 = mm['subs'][0] if mm['subs'] else {'items': [], 'heads': []}
                gr = [i for i in s1['items'] if i['act'] == 'tool-grants']
                A('D-tools', s1['heads'] == ['Admin tools'] and len(s1['items']) == 6 and gr and gr[0]['checked'] == 'true' and gr[0]['tag'] == 'A'
                  and all(i['checked'] == 'false' for i in s1['items'] if i['act'] != 'tool-grants'), [s1['heads'], [(i['act'], i['checked'], i['tag']) for i in s1['items']]])
                p.click(p.ev('window.__ws.itemAt("tabs", 0)'))
                time.sleep(0.5)
                mm = p.menu() or {'subs': []}
                s2 = mm['subs'][0]['items'] if mm['subs'] else []
                ok_tabs = [i['label'] for i in s2] == ['Overview', 'Users', 'Errors'] and [i['note'] for i in s2] == ['', '12', ''] and [i['checked'] for i in s2] == ['true', 'false', 'false']
                ep = p.ev('window.__ws.itemAt("tabs-2", 1)')
                if ep: p.click(ep)
                time.sleep(0.2)
                A('D-tabs', ok_tabs and p.ev('document.getElementById("tab-c").getAttribute("aria-selected")') == 'true', [(i['label'], i['note'], i['checked']) for i in s2])
                p.ev('window.__clicks = []; 1')
                p.rclick(gap)
                ap = p.ev('window.__ws.itemAt("addUser", 0)')
                if ap: p.click(ap)
                time.sleep(0.2)
                A('D-btn', 'addUserBtn' in (p.ev('window.__clicks') or []), p.ev('window.__clicks'))
                p.rclick(gap)
                cp = p.ev('window.__ws.itemAt("pageLink", 0)')
                if cp: p.click(cp)
                clip = p.wait('window.__clip.length && window.__clip[window.__clip.length - 1]', 3)
                toast = p.ev('(function(){var t=document.getElementById("pnbPageMenuToast"); return t ? {on: t.classList.contains("is-on"), text: t.textContent} : null;})()')
                A('D-copy', clip and clip == p.ev('location.href') and toast and toast['on'] and toast['text'] == 'Link copied.', '%s %s' % (clip, toast))
                p.rclick(gap)
                st = p.ev('window.__ws.itemAt("settings", 0)')
                if st: p.click(st)
                A('D-settings', p.ev('document.getElementById("settingsPanel").classList.contains("is-open")'), p.ev('document.getElementById("settingsPanel").className'))
                # (round 2) Theme and Density through the family panel's own selects (the drawer's change handler,
                # lifted from the chrome): last, they restyle and zoom the page; the right-clicks on the intro line,
                # high on the page, which stays in view at any zoom
                p.ev('document.getElementById("settingsPanel").classList.contains("is-open") && document.getElementById("settingsPanelClose").click(), 1')
                time.sleep(0.2)
                def sub_of(act):
                    p.rclick(p.ev('window.__ws.center("#intro")'))
                    p.click(p.ev('window.__ws.itemAt(%s, 0)' % json.dumps(act)))
                    time.sleep(0.3)
                    mm = p.menu() or {'subs': []}
                    return [(i['label'], i['checked']) for i in (mm['subs'][0]['items'] if mm['subs'] else [])]
                t0 = sub_of('theme')
                p.click(p.ev('window.__ws.itemAt("theme-theme-wolfpack", 1)'))
                time.sleep(0.3)
                tp = p.ev('JSON.parse(localStorage.getItem("penumbra_pref_theme") || "{}").__landing__')
                t1 = sub_of('theme')
                p.key('Escape')
                A('D-theme', t0 == [('Default Light', 'true'), ('Dark Blue', 'false'), ('Wolfpack Red', 'false')] and tp == 'theme-wolfpack'
                  and p.ev('document.body.classList.contains("theme-wolfpack")') and [l for l, c in t1 if c == 'true'] == ['Wolfpack Red'], [t0, tp, t1])
                d0 = sub_of('density')
                p.click(p.ev('window.__ws.itemAt("density-easy-read", 1)'))
                time.sleep(0.4)
                dp = p.ev('JSON.parse(localStorage.getItem("penumbra_pref_density") || "{}").__landing__')
                d1 = sub_of('density')
                p.key('Escape')
                A('D-density', d0 == [('Standard', 'true'), ('Compact', 'false'), ('Easy Read', 'false')] and dp == 'easy-read'
                  and p.ev('document.body.classList.contains("density-easy-read")') and [l for l, c in d1 if c == 'true'] == ['Easy Read'], [d0, dp, d1])
            elif name == 'dzoom':
                z = p.ev('getComputedStyle(document.body).zoom')
                pt = p.ev('window.__ws.center("#intro")')   # high on the page: room below for the whole menu
                p.rclick(pt)
                m = p.menu()
                A('D-zoom', z == '1.15' and m and abs(m['rect']['left'] - pt['x']) <= 2 and abs(m['rect']['top'] - pt['y']) <= 2, '%s %s %s %s' % (z, pt, m and m['rect'], p.ev('JSON.stringify({vw: innerWidth, vh: innerHeight, l: document.getElementById("pnbPageMenu").style.left, t: document.getElementById("pnbPageMenu").style.top, ow: document.getElementById("pnbPageMenu").offsetWidth})')))
                p.click(p.ev('window.__ws.itemAt("recent", 0)'))
                time.sleep(0.5)
                m = p.menu() or {'subs': []}
                sp = m['subs'][0]['rect'] if m['subs'] else None
                A('D-zoomSub', sp and abs(sp['left'] - (m['rect']['right'] - 2 * 1.15)) <= 3, '%s %s' % (sp, m.get('rect')))
            else:
                p.rclick(gap)
                m = p.menu() or {'items': []}
                acts = [i['act'] for i in m['items']]
                p.click(p.ev('window.__ws.itemAt("recent", 0)'))
                time.sleep(0.5)
                mm = p.menu() or {'subs': []}
                s0 = mm['subs'][0]['items'] if mm['subs'] else []
                A('D-nonAdmin', acts == ['settings', 'theme', 'density', 'pageLink', 'quick', 'recent', 'addUser', 'saveGrants', 'newTag', 'tabs'] and [i['act'] for i in s0] == ['recentNone'], [acts, [i['act'] for i in s0]])
        errs = p.errors() if p else ['no page']
        out.append(('X-' + name, not errs, str(errs)[:400]))
    except Exception as ex:
        out.append(('X-' + name, False, 'driver threw: %r' % ex))
    finally:
        if p: p.close()

def static_checks(t):
    out = []
    A = lambda cid, okv, detail='': out.append((cid, bool(okv), str(detail)[:300]))
    idx, ch, us, ws = t['index'], t['chrome'], t['us'], t['ws']
    A('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_wsmenu.off')" in idx and 'src="js/penumbra_wsmenu.js?v=' in idx and 'href="css/penumbra_wsmenu.css?v=' in idx
      and "href=\"<?php echo 'css/penumbra_colmenu.css?v=' . filemtime(__DIR__ . '/css/penumbra_colmenu.css'); ?>\"" in idx)
    a = ch.find('src="js/penumbra_wsmenu.js?v='); b = ch.find('<script src="js/penumbra_userseg.js?v=')
    A('S-chromeLoads', "file_exists(__DIR__ . '/js/penumbra_wsmenu.off')" in ch and a > b > 0 and "data-admin=\"<?php echo !empty($isAdmin) ? '1' : '0'; ?>\"" in ch
      and 'href="css/penumbra_wsmenu.css?v=' in ch, (a, b))
    A('S-usersegRows', 'function listRows(curId) {' in us and 'listRows: listRows,' in us and 'var rows = listRows(curId), html' in us)
    code = re.sub(r'/\*.*?\*/', '', ws, flags=re.S)
    code = re.sub(r'(?m)^\s*//.*$', '', code)
    # ES5 for the admin tools' plain pages, and ASCII (a glyph as a \u escape) whatever charset IIS names for a .js
    A('S-es5', ws != '' and all(ord(ch) < 128 for ch in ws) and not re.search(r'=>|`|\blet\s|\bconst\s|\bclass\s+\w', code), re.findall(r'.{0,30}(?:=>|`|\blet\s|\bconst\s).{0,30}', code)[:3])
    A('S-noEmdash', ws != '' and '\u2014' not in ws and '&mdash;' not in ws and '\u2014' not in t['wcss'])
    hp = t['help'].find('id="us-pagemenu"')
    sec = t['help'][hp:t['help'].find('id="us-colmenu"', hp)] if hp > 0 else ''
    A('S-help', hp > 0 and 'data-jump-to="us-pagemenu"' in t['help'] and '<kbd>Shift</kbd>+right-click' in sec and 'Recent reports' in sec
      and '<strong>Theme</strong>' in sec and '<strong>Send feedback to the report owner...</strong>' in sec and 'A dashboard has it too' in sec
      and 'Right-click the dashboard' in t['dhelp']
      and '—' not in sec and '&mdash;' not in sec and 'right-click page menu' in t['manifest'], len(sec))
    A('S-readme', 'penumbra_tests\\wsmenu\\run.py' in t['readme'] and 'js\\penumbra_wsmenu.off' in t['readme'] and '(2026-11-01, "wsmenu"; suite `wsmenu`)' in t['readme']
      and 'Copy link to this dashboard' in t['readme'] and 'Send feedback to the report owner' in t['readme'])
    d = t['dash']
    A('S-dashLoads', "require_once 'penumbra_admin_chrome.php';" in d and "file_exists(__DIR__ . '/js/penumbra_wsmenu.off')" in d
      and '<?php if (!empty($isAdmin)): ?><div hidden><?php penumbra_admin_tools_menu(); ?></div><?php endif; ?>' in d
      and 'src="js/penumbra_userseg.js?v=' in d and 'window.PenumbraUserSeg.configure({ isAdmin: !!penumbra_dash_vars.isAdmin' in d and 'src="js/penumbra_wsmenu.js?v=' in d)
    return out

def run_all(texts, scns):
    write_stage(texts)
    res = []
    for s in scns: scenario(s, res)
    return res + static_checks(texts)

def expected_ids(scns):
    ids = []
    for s in scns: ids += CHK[s] + ['X-' + s]
    return ids + STATIC

try:
    texts = load_texts()
    print('build: %s' % ('git %s (CONTROL: %s)' % (control_rev, 'the build before the menu' if control_r1 else "round 1's build") if control else app_dir))
    names = [s for s in SCN if not scn_arg or s in scn_arg.split(',')]
    if all_mutants or one_mutant:
        good = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            edits, must, mscn = MUTANTS[m]
            sc = [s for s in (mscn if mscn else []) if s in names] if mscn else []
            res = run_all(mutate(texts, m), sc)
            red = [a for a, ok, _ in res if not ok]
            hit = sorted(red) == sorted(must)
            good += hit; bad += (not hit)
            print('  %s  mutant %-16s turns %s red   [red: %s]' % ('PASS' if hit else 'FAIL', m, ' '.join(must), ' '.join(red) or '(nothing)'))
            if not hit:
                for a, ok, d in res:
                    if not ok: print('        %-18s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (good, bad))
        print('RESULT: GREEN' if bad == 0 and good > 0 else 'RESULT: RED')
    else:
        res = run_all(texts, names)
        want = expected_ids(names)
        got = dict((a, (ok, d)) for a, ok, d in res)
        p = f = 0; failed = []
        for a in want:
            ok, d = got.get(a, (False, 'NOT RECORDED'))
            print('  %s  %-18s %s' % ('PASS' if ok else 'FAIL', a, d[:400]))
            if ok: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # round 1's build: round 2's checks red; the build before the menu: every check but the guards (and no page errors)
            new = [a for a in want if ((a not in GUARDS and not a.startswith('X-')) if control_r1 else (a in NEW_R2))]
            wrong = [a for a in want if (a in failed) != (a in new)]
            print('CONTROL: %s' % ('as expected (%d red, %d %s green)' % (len(new), len(want) - len(new), 'guards' if control_r1 else 'others') if not wrong else 'NOT as expected: %s' % ' '.join(wrong)))
            print('RESULT: GREEN' if not wrong else 'RESULT: RED')
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
