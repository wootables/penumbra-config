# rowfunnel: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture,
# 300 rows; scenarios named g* open GROUPED by H_GROUP, p* as a pivot) PLUS
#   - the status bar's LEAD segment lifted from the index.php under test (the live row count,
#     the row-limit icon and, on the stage, the Rows card's button), as the first segment of
#     the harness's bar, up to its first closing div - the way the rowlimitwarn suite lifts it;
#   - the editor's row-limit toggle and Save button (hidden, as the plumbing is);
#   - per scenario: r150 150 rows / rcap* 200 rows, the limit SAVED on for rcap, rcapv, r150 and
#     rsaved (rsaved runs 300 rows with ?rowlimit=false, so it is off here); rcapv and rcapurl
#     are viewers (penumbra_vars.isAdmin false; rcapurl's cap is its own ?rowlimit=true);
#     rrepo has the repository page's body class; rbig 20,000 rows.
import importlib.util, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(HERE, '..', 'colmenu', 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)

LEAD_RX = r'(?s)<div class="sb-seg sb-lead">.*?</div>'


def lead(index_src):
    m = re.search(LEAD_RX, index_src)
    if not m:
        raise SystemExit('lift: the status bar lead segment not found in index.php')
    s = re.sub(r'(?s)<\?php\s*/\*.*?\*/\s*\?>', '', m.group(0))
    if '<?' in s:
        raise SystemExit('lift: PHP left in the lead segment')
    return s


def build(index_src):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>rowfunnel</title>')
    rep('<div id="pnbStatusBar">\n', '<div id="pnbStatusBar">\n  ' + lead(index_src) + '\n')
    rep('<button id="copyActionsBtn" type="button">Copy</button>',
        '<button id="copyActionsBtn" type="button">Copy</button>'
        '<button id="toggleLimitBtn" class="toolbar-icon is-active" type="button"></button><button id="saveQuery" type="button">Save</button>')
    rep('    window.__rowsFixture = rows;\n',
        '    if (/^rcap/.test(window.__SCN)) rows.length = 200;\n'
        '    else if (/^r150/.test(window.__SCN)) rows.length = 150;\n'
        '    window.__rowsFixture = rows;\n')
    big = re.findall(r'for \(var i = 1; i <= \((.+?) \? \(\+P\.get\("rows"\) \|\| 20000\) : 300\); i\+\+\) \{', src)
    if len(big) != 1:
        raise SystemExit('big-fixture row loop x%d' % len(big))
    rep('i <= (%s ? (+P.get("rows")' % big[0], 'i <= ((%s || window.__SCN === "rbig") ? (+P.get("rows")' % big[0])
    rep('    window.__STORED = st;\n',
        '    if (/^(rcap|r150|rsaved)/.test(S) && S !== "rcapurl") st.noLimit = false;\n'
        '    window.__STORED = st;\n')
    rep('isAdmin: true, isGlobalAdmin: true, canEditReport: true,',
        'isAdmin: !/^(rcapv|rcapurl)/.test(S), isGlobalAdmin: !/^(rcapv|rcapurl)/.test(S), canEditReport: !/^(rcapv|rcapurl)/.test(S),')
    rep('<script src="jquery-3.7.1.min.js"></script>\n',
        '<script>\n'
        '  if (window.__SCN === "rrepo") document.body.classList.add("pnb-repo-mode");\n'
        '  window.__BTN_HIDDEN_AT_BOOT = (function () { var b = document.getElementById("sbRowsBtn"); return b ? b.hidden : null; })();\n'
        '</script>\n'
        '<script src="jquery-3.7.1.min.js"></script>\n')
    return src
