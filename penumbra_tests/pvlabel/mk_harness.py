# pvlabel harness (2026-10-22): the pivmenu harness (the pvshade harness - the REAL main.js over
# a saved pivot - with the pivot builder lifted from the index.php under test, the tile engine,
# the Copy dialog and the column menu) with saved pivots whose LABELS are tag-shaped, as an
# author or a shared preset can save them:
#   plflat  H_GROUP down, V_STATUS across (the one-level header): Sum and Count of H_AMT
#           labelled '<img onerror>' and 'R&D'; Grand Total overridden to Sum and Count,
#           labelled '<svg onload>' and a label with <b>, & and quotes
#   plnest  the same over V_STATUS > H_FLAG (the nested header)
#   plval   no column field; the values' source column has a tag-shaped NAME (a quoted SQL alias:
#           the fixture's rows carry it, a copy of H_AMT) - the heading over the values is that
#           name; Sum and Count of it
#   plval1  the same with Sum alone ("sum(<name>)")
#   plval2  Sum alone with a two-type Grand Total override (the heading spans the sub-heading row)
#   pllvl   three row fields, the 2nd and 3rd columns with tag-shaped NAMES (the fixture's rows carry
#           them, copies of H_GROUP2 and H_FLAG): the level menu's "Show <field>" entries
# window.__PL holds the strings; window.__INJ lists every element added to the document with an
# on* attribute that names __pwn (a MutationObserver from before main.js loads). pivmenu's files are read, never written.
import importlib.util, os
PIVMENU = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivmenu'
_spec = importlib.util.spec_from_file_location('pivmenu_mk_harness', os.path.join(PIVMENU, 'mk_harness.py'))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)


def build(index_src):
    src = _pm.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('pvlabel harness: anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>pvshade</title>', '<title>pvlabel</title>')
    # (review round) the Copy dialog's door and its placeholder chips, and the pivot's level menu
    # (index.php's markup): what reads a heading back as text and writes it into HTML
    rep('<button id="confirmCopyBtn">Copy</button>', '<div id="templatePlaceholders"></div><button id="confirmCopyBtn">Copy</button>')
    rep('<div id="action_overlay"></div>',
        '<div id="action_overlay"></div>\n<button id="copyActionsBtn" type="button">Copy</button>\n'
        '<span id="pivot-collapse-bar" style="display: none;"><a href="#" class="themed-link-button pivot-expand-all-btn">Expand All</a>'
        '<span class="pivot-level-dropdown-wrap" style="display:none;"><button type="button" class="pivot-level-dropdown-btn themed-link-button">&#9662;</button>'
        '<div class="pivot-collapse-dropdown" style="display:none;"></div></span><a href="#" class="themed-link-button pivot-collapse-all-btn">Collapse All</a></span>')
    rep('    window.__STORED = st;\n',
        "    var PL = window.__PL = {\n"
        "      a1: '<img src=x onerror=\"window.__pwn=(window.__pwn||[]).concat(1)\">', a2: 'R&D',\n"
        "      t1: '<svg onload=\"window.__pwn=(window.__pwn||[]).concat(2)\"></svg>', t2: 'Total <b>bold</b> & \"q\" \\'s',\n"
        # a column's NAME (a quoted SQL alias): the builder upper-cases it, so the handler is spelled
        # in upper case and character references (window = &#119;&#105;&#110;&#100;&#111;&#119;)
        "      v1: '<IMG SRC=X ONERROR=\"&#119;&#105;&#110;&#100;&#111;&#119;.__PWN=4\">',\n"
        "      r1: '<img src=x onerror=\"window.__pwn=(window.__pwn||[]).concat(5)\">',\n"
        "      r2: '<svg onload=\"window.__pwn=(window.__pwn||[]).concat(6)\"></svg>'\n"
        "    };\n"
        "    if (/^plval/.test(S)) rows.forEach(function (r) { r[PL.v1] = r.H_AMT; });\n"
        "    if (S === 'pllvl') rows.forEach(function (r) { r[PL.r1] = r.H_GROUP2; r[PL.r2] = r.H_FLAG; });\n"
        "    if (/^pl/.test(S)) {\n"
        "      st.pivot.rows = ['H_GROUP']; st.pivot.cols = (S === 'plnest') ? ['V_STATUS', 'H_FLAG'] : ['V_STATUS'];\n"
        "      st.pivot.agg = ['sum', 'count']; st.pivot.aggLabels = [PL.a1, PL.a2]; st.pivot.aggColOverrides = ['H_AMT', 'H_AMT'];\n"
        "      st.pivot.totalRowAggs = ['sum', 'count']; st.pivot.totalRowAggLabels = [PL.t1, PL.t2]; st.pivot.totalRowAggBaseIdx = [0, 1];\n"
        "      if (/^plval/.test(S)) {\n"
        "        st.pivot.cols = []; st.pivot.vals = PL.v1; st.pivot.aggLabels = ['Amt', 'N']; st.pivot.aggColOverrides = [PL.v1, PL.v1];\n"
        "        st.pivot.totalRowAggs = null; st.pivot.totalRowAggLabels = null; st.pivot.totalRowAggBaseIdx = null;\n"
        "        if (S === 'plval1' || S === 'plval2') { st.pivot.agg = ['sum']; st.pivot.aggLabels = ['Amt']; st.pivot.aggColOverrides = [PL.v1]; }\n"
        "        if (S === 'plval2') { st.pivot.totalRowAggs = ['sum', 'count']; st.pivot.totalRowAggBaseIdx = [0, 0]; }\n"
        "      }\n"
        "      if (S === 'pllvl') {\n"
        "        st.pivot.rows = ['H_GROUP', PL.r1, PL.r2]; st.pivot.agg = ['sum']; st.pivot.aggLabels = ['Amt']; st.pivot.aggColOverrides = ['H_AMT'];\n"
        "        st.pivot.totalRowAggs = null; st.pivot.totalRowAggLabels = null; st.pivot.totalRowAggBaseIdx = null;\n"
        "      }\n"
        "    }\n"
        "    window.__INJ = [];\n"
        "    new MutationObserver(function (ms) {\n"
        "      ms.forEach(function (m) {\n"
        "        Array.prototype.forEach.call(m.addedNodes, function (n) {\n"
        "          if (n.nodeType !== 1) return;\n"
        "          [n].concat(Array.prototype.slice.call(n.querySelectorAll('*'))).forEach(function (e) {\n"
        "            for (var i = 0; i < e.attributes.length; i++) if (/^on/i.test(e.attributes[i].name) && /__pwn/i.test(e.attributes[i].value)) { window.__INJ.push(e.tagName + ' ' + e.attributes[i].name + ' in ' + ((e.parentNode && e.parentNode.className) || '?')); break; }\n"
        "          });\n"
        "        });\n"
        "      });\n"
        "    }).observe(document.documentElement, { childList: true, subtree: true });\n"
        '    window.__STORED = st;\n')
    return src
