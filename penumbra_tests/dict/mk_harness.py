# dict: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture: shown
# V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*; column options, calculated column,
# column widths and the header menu modules) PLUS the data dictionary:
# css/penumbra_dict.css + js/penumbra_dict.js BEFORE main.js, as index.php loads them (EMPTY
# files in --control), and per scenario the report's Custom Code / subtitle:
#   d* (not dnone / dsub)  a dict| block naming V_ID, V_NAME (an AI draft), V_AMOUNT (checked,
#                          with a source), H_OLD (no such column), H_ZZ (do not use), a note
#   dblank                 the same block under a BLANK label (no link drawn)
#   dsub                   no block in Custom Code; one in the SUBTITLE (engine B)
#   dnone                  Custom Code with no block at all
import importlib.util, os
HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(HERE, '..', 'colmenu', 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)

BLOCK = ('dict|`\\n'
         'One row per vendor payment. A payment can repeat across statuses.\\n'
         '# a comment line, never shown\\n'
         'V_ID | The payment id (as in RED. | source: LR_FIXTURE.V_ID\\n'
         'V_NAME | ? The vendor\\\'s name, as on the invoice.\\n'
         'V_AMOUNT | What was paid, in dollars (<b>not</b> cents). | source: LR_FIXTURE.AMT\\n'
         'H_OLD | A column this report no longer has.\\n'
         'H_ZZ | ! Internal mapping value. Do not use.\\n'
         '`)')
# (2026-10-22 b) pdict: the fixture's pivot (H_GROUP > H_GROUP2 down, V_STATUS across, sum of H_AMT
# labelled "Amt" - the calccol harness opens every p* scenario on it) with a [pivot] part
PBLOCK = ('dict|`\\n'
          '[pivot]\\n'
          'Each cell adds up the payments of its group and status.\\n'
          'Amt | ? Adds up H_AMT over the rows of the cell. | source: sum(H_AMT)\\n'
          'Grand Total | The total row and column add up every payment.\\n'
          'Old value | A value the pivot no longer has.\\n'
          '[columns]\\n'
          'One row per vendor payment.\\n'
          'V_ID | The payment id.\\n'
          'H_AMT | The amount paid, in dollars.\\n'
          '`)')


def build(index_src):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>dict</title>')
    rep('<script src="main_hc.js"></script>\n',
        '<link rel="stylesheet" href="penumbra_dict.css">\n<script src="penumbra_dict.js" data-ui="penumbra_dict_ui.js" data-ui-css="penumbra_dict_ui.css"></script>\n<script src="main_hc.js"></script>\n')
    rep('    window.__STORED = st;\n',
        # (2026-10-24 sweep) a commented-out line AFTER the block, between the block's apostrophe
        # (vendor's) and one after it (Don't): the comment stripper used to pair the two quotes
        # across the block and keep the comment alive
        '    if (/^d/.test(S) && S !== "dnone" && S !== "dsub") st.reportSnippet = "Before the block. sum(V_AMOUNT)\\naction(infobox, " + (S === "dblank" ? "" : "Data dictionary") + ", ' + BLOCK + '\\n// HIDDEN_COMMENT count()\\nAfter the block. Don\\\'t worry.";\n'
        '    if (S === "dnone") st.reportSnippet = "Just text. count()";\n'
        '    if (S === "pdict") st.reportSnippet = "Pivot report.\\naction(infobox, Data dictionary, ' + PBLOCK + '";\n'
        '    if (S === "dsub") { st.reportSnippet = "No dictionary here."; st.reportSubtitle = "Read the action(infobox, Glossary, dict|`V_ID | Subtitle meaning of the id.`)"; }\n'
        '    window.__STORED = st;\n')
    # the Custom Code sidebar (js/penumbra_snippet_help.js mounts into it) for dgen
    rep('<div id="admWrapper"></div>', '<div id="admWrapper"><div id="snippetHelperPanel"></div></div>')
    return src


if __name__ == '__main__':
    APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
    open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8').write(build(open(os.path.join(APP, 'index.php'), encoding='utf-8').read()))
