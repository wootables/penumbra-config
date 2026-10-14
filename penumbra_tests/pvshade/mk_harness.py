# pvshade: harness.html from the shade harness (REAL main.js + main.css; a p* scenario
# loads the stored report as a PIVOT: H_GROUP > H_GROUP2 down, V_STATUS across).
# Here the pivot has TWO values - Sum and Count of H_AMT - and the scenario picks the
# first one's shading (pbar / pscale; pnone = none), as a saved report carries it in
# settings.aggShade. Plus the builder's values table (empty), for the cog flow.
# pvsum 2026-10-11: group subtotal rows, lopsided values, a one-sided formula:
#   pvsum   THREE row fields (H_GROUP > H_GROUP2 > H_FLAG), COLLAPSED - the two levels of
#           subtotal rows are what shows; Amt a colour scale, N data bars
#   pvlop   lopsided Amt - North x1000, South / East / West all $0 - as a colour scale
#   pvform  a one-sided formula {Amt} / {N} ("Per") as data bars
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'shade', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>shade</title>', '<title>pvshade</title>')
rep('rankN: null, rankDir: null, rankAgg: null, rankOther: true, rankScope: null, noBreakdown: false, startExpanded: true, hideEmpty: false };\n    }',
    'rankN: null, rankDir: null, rankAgg: null, rankOther: true, rankScope: null, noBreakdown: false, startExpanded: true, hideEmpty: false };\n'
    '      if (/^pv/.test(S)) {\n'
    '        st.pivot.agg = ["sum", "count"]; st.pivot.aggLabels = ["Amt", "N"]; st.pivot.aggColOverrides = ["H_AMT", "H_AMT"];\n'
    '        st.pivot.aggShade = S === "pvbar" ? ["bar", null] : (S === "pvscale" ? ["scale", null] : null);\n'
    '      }\n'
    '      if (S === "pvsum") { st.pivot.rows = ["H_GROUP", "H_GROUP2", "H_FLAG"]; st.pivot.startExpanded = false; st.pivot.aggShade = ["scale", "bar"]; }\n'
    '      if (S === "pvlop") st.pivot.aggShade = ["scale", null];\n'
    '      if (S === "pvform") {\n'
    '        st.pivot.agg = ["sum", "count", "formula"]; st.pivot.aggLabels = ["Amt", "N", "Per"]; st.pivot.aggColOverrides = ["H_AMT", "H_AMT", null];\n'
    '        st.pivot.aggFormulas = [null, null, "{Amt} / {N}"]; st.pivot.aggShade = [null, null, "bar"];\n'
    '      }\n'
    '    }')
rep('    window.__rowsFixture = rows;\n',
    '    if (window.__SCN === "pvlop") rows.forEach(function (r) {\n'
    '      if (r.H_GROUP === "North") r.H_AMT = String(Number(r.H_AMT) * 1000);\n'
    '      else if (r.H_GROUP === "South" || r.H_GROUP === "East" || r.H_GROUP === "West") r.H_AMT = "0";\n'
    '    });\n'
    '    window.__rowsFixture = rows;\n')
rep('<div id="action_overlay"></div>',
    '<div id="action_overlay"></div>\n'
    '<table id="pivot-agg-table"><thead><tr><th class="pat-opt"></th></tr></thead><tbody id="pivot-agg-table-body"></tbody></table>')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
