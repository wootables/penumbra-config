# colopt: harness.html from the calccol harness (the REAL main.js on the saveconf
# fixture - 300 rows; V_AMOUNT money, V_DATE M/D/YYYY, V_LINK a server-linked vendor
# code (@@HTML resolver-link), H_JSON nested @@JSON - the Settings panel's column
# list, the calculated-column module) PLUS:
#   - js/penumbra_colfmt.js, loaded BEFORE main_hc.js (which runs at once); &nomod=1
#     leaves it out (the rollback switch: the old Shading chip must come back)
#   - the pivot builder's values table (pvshade's), for the cog's popover
#   - per scenario: column options seeded into localStorage before boot (fbuild,
#     fsort, gfmt, fheat; 2026-10-20 highlight rules: fhlseed, ghl), a pivot's
#     settings.aggFormat (pvfmt, pvfmt2), vendor codes
#     INSIDE the nested column (fdeep)
#   - (2026-10-20 b) hr*: a report SAVED with a column format and highlight rules
#     (STATE_DATA.columnFormats / .columnHighlights); hrview a viewer (canEditReport
#     off); hrsave the saver's own over them (SEED); the Save button and the Server
#     Save tab's Last Stop Changes card, where the dialog renders its lists
#   - (colopt c, 2026-10-12) LIFTED from the index.php under test: the Settings
#     panel's title ?, the Display Preferences' two ?s, the Freeze select by the
#     Columns heading, and the status bar's frozen-columns chip + its card - so the
#     control (live) and the stage each run their own markup. run.py builds the
#     harness per run (build(index_src)); this file run alone writes harness.html
#     from the live index.php.
#   - (colopt e, 2026-10-12) the WHOLE Settings panel is lifted now, PHP resolved
#     (_panel), in place of the calccol harness's bare one: the panel's own layout -
#     Theme, Density and Columns each on one row - is under test.
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
# penumbra_render_theme_options('', true) - three of its options are enough here
THEME_OPTS = ('<option value="report-default">Report Default</option>\n'
              '<option value="theme-default">Default Light</option>\n'
              '<option value="theme-dark-blue">Dark Blue</option>\n')
# one PHP comment's body: never across its own end (a lazy .*? would run on into the
# NEXT comment and swallow the markup between)
_C = r'/\*(?:(?!\*/).)*\*/'


def _lift(index_src):
    def one(rx, what):
        m = re.search(rx, index_src, re.S)
        if not m:
            raise SystemExit('lift: %s not found in index.php' % what)
        return m.group(0)
    chip = one(r'<span class="sb-chip" id="sbFrozen"[^\n]*', 'the frozen chip')
    m = re.search(r'\n([ \t]*)<div class="sb-pop sb-frz-pop" id="sbFrozenPop">.*?\n\1</div>', index_src, re.S)
    if not m:
        raise SystemExit('lift: the frozen card not found in index.php')
    card = m.group(0).strip()
    return chip, card


def _panel(index_src, colopt_on=True):
    """The Settings panel as index.php draws it, its PHP resolved the way a viewer of a
    saved report with the column options on gets it."""
    m = re.search(r'\n<div id="settingsPanel">\n.*?\n</div>\n', index_src, re.S)
    if not m:
        raise SystemExit('lift: the Settings panel not found in index.php')
    p = m.group(0).strip('\n')
    p = re.sub(r"<\?php echo isset\(\$_SERVER\['HTTP_SHIB_GIVENNAME'\]\).*?\?>", 'User', p)
    p = re.sub(r"<\?php echo penumbra_render_theme_options\([^)]*\); \?>", lambda x: THEME_OPTS, p)
    # Deep Link Vendor Codes: drawn only while the column options are off
    p = re.sub(r"<\?php\s*(?:" + _C + r"\s*)?if \(empty\(\$pnbColOptOn\)\): \?>((?:(?!<\?php).)*)<\?php endif; \?>",
               lambda x: '' if colopt_on else x.group(1), p, flags=re.S)
    p = re.sub(r"<\?php if \(\$canEditLoadedReport\): \?>((?:(?!<\?php).)*)<\?php endif; \?>", lambda x: x.group(1), p, flags=re.S)
    p = re.sub(r"<\?php\s*" + _C + r"\s*\?>", '', p, flags=re.S)
    if '<?' in p:
        i = p.index('<?')
        raise SystemExit('lift: PHP left in the Settings panel: %r' % p[i:i + 90])
    for must in ('id="spThemeSelector"', 'id="spDensitySelector"', 'id="spColumnSearch"', 'id="spColumnList"',
                 'id="spRowExpandToggle"', 'id="spKeysHelp"', 'id="spFreezeWrap"', 'id="spApply"', 'id="spClearStorage"'):
        if must not in p:
            raise SystemExit('lift: the Settings panel came out without %s' % must)
    return p


def _pivot_builder(index_src):
    """(2026-10-20 c) The pivot builder dialog as index.php draws it (its one PHP comment
    dropped) - for the pvhl* scenarios, which author, Generate and re-edit through it."""
    m = re.search(r'\n<div id="pivotLightbox" class="help-lightbox">\n.*?\n</div>\n', index_src, re.S)
    if not m:
        raise SystemExit('lift: the pivot builder not found in index.php')
    p = re.sub(r"<\?php\s*" + _C + r"\s*\?>", '', m.group(0).strip('\n'), flags=re.S)
    if '<?' in p:
        i = p.index('<?')
        raise SystemExit('lift: PHP left in the pivot builder: %r' % p[i:i + 90])
    for must in ('id="pivot-rows"', 'id="pivot-cols"', 'id="pivot-agg-table"', 'id="pivot-agg-table-body"', 'id="generatePivotBtn"'):
        if must not in p:
            raise SystemExit('lift: the pivot builder came out without %s' % must)
    return p


def build(index_src=None):
    src = open(os.path.join(HERE, '..', 'calccol', 'harness.html'), encoding='utf-8').read()

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>calccol</title>', '<title>colopt</title>')
    rep('<script src="penumbra_calc.js"></script>\n',
        '<script>if (!/[?&]nomod=1/.test(location.search)) document.write(\'<script src="penumbra_colfmt.js"></scr\' + \'ipt>\');</script>\n'
        '<script src="penumbra_calc.js"></script>\n')
    rep('<div id="action_overlay"></div>',
        '<div id="action_overlay"></div>\n'
        '<table id="pivot-agg-table"><thead><tr><th class="pat-opt"></th></tr></thead><tbody id="pivot-agg-table-body"></tbody></table>')
    # vendor codes inside the nested column (fdeep): the first sub-row's SUB_ID is a code
    rep('    window.__rowsFixture = rows;\n',
        '    if (window.__SCN === "fdeep") rows.forEach(function (r, i) {\n'
        '      if (!r.H_JSON) return;\n'
        '      var sub = JSON.parse(r.H_JSON.slice(6)); sub[0].SUB_ID = "PAM-P26-" + String(100000 + i).slice(-6); r.H_JSON = "@@JSON" + JSON.stringify(sub);\n'
        '    });\n'
        '    // pvtie: amounts whose sums / averages land on rounding ties (the binary value just\n'
        '    // under the half): the page and the email must print the same digits\n'
        '    // (every row 1.005: an average of equal values is that value whenever the count is a\n'
        '    // power of two - binary 1.00499999..., which Intl prints 1.00 and the decimal text 1.01)\n'
        '    if (window.__SCN === "pvtie") rows.forEach(function (r) { r.H_AMT = "1.005"; });\n'
        '    window.__rowsFixture = rows;\n')
    # (colopt f) a report saved with the old Last Stop Changes "Deep Link Vendor Codes" off
    rep('    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];\n',
        '    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];\n'
        '    if (S === "frepdeep") st.resolverLinksDefault = false;\n'
        # (2026-10-20 b) hr*: a report saved with a column format and two highlight rules
        # (a cell rule, a row rule) - what the Save dialog's Last Stop Changes saves
        '    if (/^hr/.test(S)) {\n'
        '      st.columnFormats = { V_AMOUNT: "currency:0" };\n'
        '      st.columnHighlights = { V_AMOUNT: [{ id: "r1", w: "V_AMOUNT > 50000", css: "background-color: var(--pnb-hl-amber, #fbe8a6)", row: false }],\n'
        '        V_STATUS: [{ id: "r2", w: "V_STATUS = //Closed//", css: "text-decoration: line-through", row: true }],\n'
        # r3: typed in Advanced in a form Basic writes another way (V_NAME contains Alpha)
        '        V_NAME: [{ id: "r3", w: "V_NAME = /Alpha/", css: "font-style: italic", row: false }] };\n'
        '    }\n')
    # (2026-10-20 b) hrview*: a viewer, who may not save the report - a line of its own: the
    # 'canEditReport: true,' text stays as it was (rowfunnel's harness, built on colmenu's on
    # this one, rewrites it)
    rep('    window.__queryResponse = { data: rows };\n',
        '    if (/^hrview/.test(S)) window.penumbra_vars.canEditReport = false;\n'
        '    window.__queryResponse = { data: rows };\n')
    # (2026-10-20 b) the Save button and the Server Save tab's Last Stop Changes card (index.php
    # ~8426): the dialog's opening renders its lists there
    rep('  <button id="confirmServerSaveBtn" class="pnb-btn pnb-btn-primary">Save to Server</button>\n',
        '  <div class="save-form-container collapsed" id="lastStopCard"><div class="lsc-collapsed-hint">Optional final overrides.</div>\n'
        '    <div id="lastStopCardBody"></div></div>\n'
        '  <button id="confirmServerSaveBtn" class="pnb-btn pnb-btn-primary">Save to Server</button>\n'
        '  <button id="saveQuery" class="toolbar-icon" title="Save Options">Save</button>\n')
    rep('    var S = window.__SCN;\n',
        '    var S = window.__SCN;\n'
        '    // colopt: the viewer\'s column options, saved before the report opens\n'
        '    var SEED = {\n'
        '      fbuild: { V_AMOUNT: { fmt: "currency:0" }, V_DATE: { fmt: "date:MMM D, YYYY" }, H_NUM: { fmt: "number:2" }, V_STATUS: { filter: true } },\n'
        '      fsort: { V_DATE: { fmt: "date:ddd, MMM D, YYYY" } },\n'
        '      gfmt: { V_AMOUNT: { fmt: "currency:0" }, V_DATE: { fmt: "date:YYYY-MM-DD" }, V_STATUS: { filter: true } },\n'
        '      fheat: { V_AMOUNT: { fmt: "number:0" } },\n'
        # (2026-10-20, hl) highlight rules: two on one column (the top one wins), a row rule,
        # a rule on another column's value; fhlseed also shades V_AMOUNT (a color scale)
        '      fhlseed: { V_AMOUNT: { hl: [{ id: "t1", w: "V_AMOUNT > 80000", css: "color: #0000ff", row: false },\n'
        '                                  { id: "t2", w: "V_AMOUNT > 50000", css: "color: #ff0000; background-color: var(--pnb-hl-amber, #fbe8a6)", row: false }] },\n'
        '                 V_STATUS: { hl: [{ id: "s1", w: "V_STATUS = //Closed//", css: "text-decoration: line-through", row: true }] },\n'
        '                 V_NAME: { hl: [{ id: "n1", w: "V_STATUS = //Pending//", css: "font-style: italic", row: false }] } },\n'
        '      ghl: { V_AMOUNT: { hl: [{ id: "g1", w: "V_AMOUNT > 50000", css: "background-color: var(--pnb-hl-amber, #fbe8a6)", row: false }] } },\n'
        # (2026-10-20 b) hrsave: the saver's own, over the report's (hr*): a format, a rule of
        # their own on top, their change to the report's r1, the report's r2 turned off, and
        # one more of their own on another column
        '      hrsave: { V_DATE: { fmt: "date:YYYY-MM-DD" },\n'
        '                V_NAME: { hl: [{ id: "o1", w: "V_STATUS = //Pending//", css: "font-style: italic", row: false }] },\n'
        '                V_AMOUNT: { hl: [{ id: "o2", w: "V_AMOUNT > 80000", css: "font-weight: bold", row: false },\n'
        '                                 { id: "r1", w: "V_AMOUNT > 50000", css: "background-color: var(--pnb-hl-green, #d3eedb)", row: false }] },\n'
        '                V_STATUS: { hlOff: ["r2"] } }\n'
        '    };\n'
        '    if (SEED[S]) { try { var _cp = {}; _cp.lrfix = { colopt: SEED[S] }; if (S === "fheat") _cp.lrfix.shade = { V_AMOUNT: "bar" };'
        ' if (S === "fhlseed") _cp.lrfix.shade = { V_AMOUNT: "scale" }; localStorage.setItem("penumbra_column_prefs", JSON.stringify(_cp)); } catch (e) {} }\n')
    # pv*: the pivot's three values (Amt = Sum, N = Count, Mean = Average of H_AMT), with
    # their own formats in pvfmt / pvfmt2 (none in pvcog, whose cog is driven instead)
    rep('rankN: null, rankDir: null, rankAgg: null, rankOther: true, rankScope: null, noBreakdown: false, startExpanded: true, hideEmpty: false };\n    }',
        'rankN: null, rankDir: null, rankAgg: null, rankOther: true, rankScope: null, noBreakdown: false, startExpanded: true, hideEmpty: false };\n'
        '      if (/^pv/.test(S)) {\n'
        '        st.pivot.agg = ["sum", "count", "avg"]; st.pivot.aggLabels = ["Amt", "N", "Mean"]; st.pivot.aggColOverrides = ["H_AMT", "H_AMT", "H_AMT"];\n'
        '        st.pivot.aggFormat = S === "pvfmt" ? ["currency:0", "currency", "percent:1"] : (S === "pvfmt2" ? ["number:2", null, "auto:0"]\n'
        '          : null);\n'
        '        if (S === "pvtie") { st.pivot.agg = ["sum", "count", "avg", "avg"]; st.pivot.aggLabels = ["Amt", "N", "Mean", "Pct"];\n'
        '          st.pivot.aggColOverrides = ["H_AMT", "H_AMT", "H_AMT", "H_AMT"]; st.pivot.aggFormat = ["number:2", null, "number:2", "percent:0"]; }\n'
        # (2026-10-20 c) pvhlseed: the values' Highlight rules saved with the pivot - two on Amt
        # (the top one wins where both set the color), one on N reading a COLUMN field, one on
        # Mean reading another value (Amt)
        '        if (S === "pvhlseed" || S === "pvhlnomod") st.pivot.aggHighlight = [\n'
        '          [{ id: "a1", w: "Amt > 1200", css: "color: var(--accent-danger, #c62828)", row: false },\n'
        '           { id: "a2", w: "Amt > 900", css: "background-color: var(--pnb-hl-amber, #fbe8a6); color: var(--accent-info, #0b5cad)", row: false }],\n'
        '          [{ id: "n1", w: "V_STATUS = //Open//", css: "text-decoration: underline", row: false }],\n'
        '          [{ id: "m1", w: "{Amt} > 900", css: "background-color: var(--pnb-hl-blue, #d6e5fa)", row: false }]];\n'
        '      }\n'
        '    }')
    if index_src is not None:
        chip, card = _lift(index_src)
        # the calccol harness's bare panel (two selects, two checkboxes, the list and
        # its buttons) gives way to the real one: the same ids, and everything around them
        m = re.search(r'<div id="settingsPanel">\n.*?\n</div>\n(?=<div id="copyActionsLightbox")', src, re.S)
        if not m:
            raise SystemExit('anchor: the harness\'s own Settings panel')
        src = src[:m.start()] + _panel(index_src) + '\n' + src[m.end():]
        rep('  <div class="sb-seg" id="sbColsSeg"><span id="sbCols"></span>\n',
            '  <div class="sb-seg" id="sbColsSeg"><span id="sbCols"></span>\n    ' + chip + '\n    ' + card + '\n')
        # (2026-10-20 c) pvhl*: the REAL pivot builder in the stub table's place - swapped in
        # while the page is read, before main.js binds to it (the other pivot scenarios keep the stub)
        stub = '<table id="pivot-agg-table"><thead><tr><th class="pat-opt"></th></tr></thead><tbody id="pivot-agg-table-body"></tbody></table>'
        rep(stub, stub + '\n<template id="pnbPvBuilderTpl">' + _pivot_builder(index_src) + '</template>\n'
            '<script>if (/[?&]scn=pvhl/.test(location.search)) (function () { var t = document.getElementById("pnbPvBuilderTpl"),'
            ' s = document.getElementById("pivot-agg-table"); s.parentNode.replaceChild(t.content.cloneNode(true), s);'
            ' var lb = document.getElementById("pivotLightbox"); if (lb) lb.style.display = "none"; })();</script>')
    return src


if __name__ == '__main__':
    idx = open(os.path.join(APP, 'index.php'), encoding='utf-8').read()
    open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(build(idx))
    print('harness written')
