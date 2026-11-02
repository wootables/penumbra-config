# wsmenu: rpt.html = the colmenu harness (the REAL main.js on the 300-row lrfix fixture, the header menu, the
# Settings panel) PLUS what the page's right-click menu reads, lifted from the index.php under test where index.php
# has it: the header's handle (#headerToggleHandle), the console's tab strip (#editorTabs' links, each with its
# panel), the profile card's Quick actions button; the card view (penumbra_cards.js), Quick actions' stub
# (penumbra_palette_boot.js, its module a fake that records the open), and js/penumbra_wsmenu.js +
# css/penumbra_wsmenu.css (EMPTY files in --control). ?role=viewer|editor|admin|owner (default admin) sets
# penumbra_vars before main.js boots (owner = an admin who owns the report: isReportOwner); an admin also gets
# PENUMBRA_ADMIN_TOOLS, the chrome's registry (TOOLS_JSON).
import importlib.util, os, re
CM = os.environ.get('PNB_COLMENU_DIR', r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colmenu')
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(CM, 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)


def nophp(s):
    s = re.sub(r'<\?php\s*/\*(?:(?!\*/).)*\*/\s*\?>', '', s, flags=re.S)
    s = re.sub(r'<\?php.*?\?>', '', s, flags=re.S)
    if '<?' in s:
        raise SystemExit('lift: PHP left in %r' % s[:120])
    return s


def lift_handle(index_src):
    m = re.search(r'<div id="headerToggleHandle"[^\n]*\n\s*<span class="handle-inner">[^<]*</span>\s*\n</div>', index_src)
    if not m:
        raise SystemExit('lift: #headerToggleHandle not found in index.php')
    return nophp(m.group(0))


def lift_tabs(index_src):
    a = index_src.find('<li><a href="#sql-editor-tab">')
    if a < 0:
        raise SystemExit('lift: the console tab strip not found in index.php')
    ul0 = index_src.rfind('<ul>', 0, a)
    ul1 = index_src.find('</ul>', a)
    ul = nophp(index_src[ul0:ul1 + 5])
    hrefs = re.findall(r'href="#([a-z-]+-tab)"', ul)
    if len(hrefs) != 5:
        raise SystemExit('lift: %d console tabs (want 5): %r' % (len(hrefs), hrefs))
    panels = ''.join('<div id="%s"><p>%s</p></div>' % (h, h) for h in hrefs)
    return '<div id="editorTabs"><div class="ui-tabs-nav-wrapper">' + ul + '</div>' + panels + '</div>', hrefs


def div_block(text, marker):
    a = text.find('<div id="%s"' % marker)
    if a < 0:
        raise SystemExit('lift: no #%s' % marker)
    depth, i = 0, a
    while True:
        o = text.find('<div', i)
        c = text.find('</div>', i)
        if c < 0:
            raise SystemExit('lift: #%s never closes' % marker)
        if o != -1 and o < c:
            depth += 1
            i = o + 4
        else:
            depth -= 1
            i = c + 6
            if depth == 0:
                return a, i


def build(index_src, tools_json):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>wsmenu</title>')
    # the control bar as index.php draws it (the filter box, the pager, the toolbar's icons): the user's "space
    # in-between the control bar buttons/paginator/filter box" is ITS space. Its Group and Copy icons replace the
    # plumbing's stand-ins (one id each).
    ia, ib = div_block(index_src, 'resultsHeader')
    real = nophp(index_src[ia:ib])
    ha, hb = div_block(src, 'resultsHeader')
    src = src[:ha] + real + src[hb:]
    rep('<button id="copyActionsBtn" type="button">Copy</button>', '')
    rep('<button id="groupTableBtn" type="button">Group</button>', '')
    # the colmenu harness keeps the Save dialog open over the page (its save checks); here it opens as on index.php
    rep('<div id="saveStateLightbox" class="help-lightbox" style="display:block">', '<div id="saveStateLightbox" class="help-lightbox" style="display:none">')
    rep('<div id="reportHeaderContainer">', lift_handle(index_src) + '\n<div id="reportHeaderContainer">')
    tabs, _ = lift_tabs(index_src)
    rep('<div id="editorTabs"></div>', tabs)
    # the profile card's Quick actions button (index.php's #sbPaletteBtn: the stub opens the box from it)
    rep('<div class="sb-seg" id="sbUserSeg"></div>',
        '<div class="sb-seg sb-user sb-click" id="sbUserSeg"><button type="button" class="sb-user-btn" id="sbUserBtn" aria-expanded="false">H</button>'
        '<div class="sb-pop" id="sbUserPop"><div id="sbReportsList"></div><div class="sb-upop-foot">'
        '<a href="#" id="sbPaletteBtn" data-pnb-palette="open" role="button" title="Quick actions (Ctrl+K)">Quick actions</a></div></div></div>')
    # the role, before main.js boots (it reads penumbra_vars at ready)
    rep('    window.__queryResponse = { data: rows };\n  })();\n',
        '    window.__queryResponse = { data: rows };\n  })();\n'
        '  (function () {\n'
        '    var r = new URLSearchParams(location.search).get("role") || "admin", V = window.penumbra_vars;\n'
        '    window.__ROLE = r;\n'
        '    if (r === "viewer") { V.isAdmin = false; V.isGlobalAdmin = false; V.canEditReport = false; }\n'
        '    else if (r === "owner") { V.isReportOwner = true; window.PENUMBRA_ADMIN_TOOLS = ' + tools_json + '; }\n'
        '    else if (r === "editor") { V.isAdmin = true; V.isGlobalAdmin = false; V.canEditReport = true; }\n'
        '    else { window.PENUMBRA_ADMIN_TOOLS = ' + tools_json + '; }\n'
        '  })();\n')
    # index.php's order after main.js: the card view, the header menu (there already), then this menu; Quick actions'
    # stub (its module the fake); the recorder last
    rep('<script src="driver.js"></script>\n',
        '<link rel="stylesheet" href="penumbra_cards.css">\n<script src="penumbra_cards.js"></script>\n'
        '<link rel="stylesheet" href="penumbra_wsmenu.css">\n<script src="penumbra_wsmenu.js"></script>\n'
        '<script src="penumbra_palette_boot.js" data-js="palette_fake.js" data-css=""></script>\n'
        '<script src="wsdriver.js"></script>\n')
    return src
