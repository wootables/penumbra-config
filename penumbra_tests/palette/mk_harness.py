# palette: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture, 300 rows;
# shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*; the column options, calculated
# column, column width and header menu modules) PLUS the command palette's stub tag, as index.php
# emits it: penumbra_palette_boot.js with data-js / data-css. The stub, the module and the
# stylesheet are EMPTY files in --control.
#   pcold / pfail: requestIdleCallback is a no-op, so the module is NEVER prefetched - the first
#                  Ctrl+K is the cold path; pfail's data-js names a file the server has not got.
#   prow:          the cell selection module (js/penumbra_cellsel.js) rides along.
# Plumbing added: the authoring gate's controls and (round 2) the REAL toolbar lifted from the
# index.php under test - the action-icon sprite, the .export-container row (its .export-icon SVGs
# with their <use href="#pnbi-...">) and the Save / Run / AI .toolbar-icon buttons - so the icon
# check compares the box's icons with the toolbar's own; a Help Center table of contents
# (#helpCenterToc, five topics incl. the Ask page) - the driver stubs window.openHelpCenter after boot.
import importlib.util, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(HERE, '..', 'colmenu', 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)

TOC = ('<div id="helpCenterToc"><div class="help-toc-group">'
       '<button type="button" class="help-toc-item" data-topic="whatIsPenumbraLightbox" data-extra="" data-keywords="what is penumbra introduction overview home" data-audience="viewer">What is Penumbra?</button>'
       '<button type="button" class="help-toc-item" data-topic="askHelpLightbox" data-extra="" data-keywords="ask question answer assistant" data-audience="viewer">Ask a question <span class="help-toc-new-badge">NEW</span></button>'
       '<button type="button" class="help-toc-item" data-topic="searchHelpLightbox" data-extra="" data-keywords="filter box filtering search syntax" data-audience="viewer">Filtering the Table</button>'
       '<button type="button" class="help-toc-item" data-topic="groupingHelpLightbox" data-extra="" data-keywords="group by column collapse sections subtotal" data-audience="viewer">Grouping</button>'
       '<button type="button" class="help-toc-item" data-topic="userSettingsHelpLightbox" data-extra="" data-keywords="settings theme density panel" data-audience="viewer">Your Settings</button>'
       '<button type="button" class="help-toc-item" data-topic="auditorHelpLightbox" data-extra="" data-keywords="audit log events history" data-audience="writer">PENUMBRA Audit Log</button>'
       '</div></div>')


def _lift(index_src):
    def one(rx, what):
        m = re.search(rx, index_src, re.S)
        if not m:
            raise SystemExit('lift: %s not found in index.php' % what)
        return m.group(0)
    sprite = one(r'<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden" xmlns="http://www.w3.org/2000/svg">\s*<defs>.*?</defs>\s*</svg>', 'the action-icon sprite')
    toolbar = one(r'<div class="export-container">\s*<div>\s*.*?</div>\s*</div>', 'the toolbar row (.export-container)')
    toolbar = re.sub(r'<!--.*?-->', '', toolbar, flags=re.S)
    buttons = ''.join(one(r'<button id="%s" class="toolbar-icon"[^\n]*?</button>' % i, 'the %s button' % i) for i in ('saveQuery', 'executeQuery', 'toggleAiPanel'))
    return sprite, toolbar, buttons


def _lift_r6(index_src, menu_html=''):
    """(round 6) the title breadcrumb's "?" and the magnifier beside it, and the profile card's
    "Search actions and reports" row, as index.php has them - each '' when index.php has not got it
    (the control, a mutant), so the checks go red rather than the build."""
    def maybe(rx, group=0):
        m = re.search(rx, index_src, re.S)
        return m.group(group) if m else ''
    help_icon = maybe(r'<span id="searchHelpIcon".*?</span>')
    magnifier = maybe(r"\$pnbPaletteIconHtml = \$pnbPaletteOn \? '(.*?)' : '';", 1).replace("\\'", "'")
    pop_row = maybe(r'<a href="#" class="sb-recent-row sb-pal-row".*?</a>')   # (round 6; gone since round 10 - the rowGone check wants it absent)
    # (round 10) the card's bottom bar as index.php has it, in its two forms: the viewer's (no admin pill) and
    # the admin's (the joined pill, its menu stubbed); the Search button's PHP switch resolved to "on"
    foot = maybe(r'<div class="sb-upop-foot">.*?<\?php endif; \?>\s*</div>')
    foot = re.sub(r'<\?php if \(!empty\(\$pnbPaletteOn\)\):.*?\?>', '', foot, flags=re.S)
    # (round 12) the menu as the chrome under test renders it (the menu + the tools JSON beside it), else a stub
    foot = re.sub(r'<\?php penumbra_admin_tools_menu\(true\); \?>', lambda m: menu_html or '<div class="pnb-admmenu" hidden></div>', foot)
    foot_admin = re.sub(r'<\?php if \(\$sb_is_admin\): \?>|<\?php endif; \?>', '', foot)
    foot_viewer = re.sub(r'<\?php if \(\$sb_is_admin\): \?>.*?<\?php endif; \?>', '', foot, flags=re.S)
    foot_viewer = re.sub(r'<\?php endif; \?>', '', foot_viewer)
    foot_admin = foot_admin.replace('<div class="sb-upop-foot">', '<div class="sb-upop-foot" id="zzFootAdmin">', 1).replace('id="sbPaletteBtn"', 'id="zzPaletteBtnAdmin"')
    foot_viewer = foot_viewer.replace('<div class="sb-upop-foot">', '<div class="sb-upop-foot" id="zzFootViewer">', 1)
    return help_icon, magnifier, pop_row, foot_viewer, foot_admin


AI_PANEL = ('<div id="tableSelector"></div><button type="button" id="toggleAiPanel" class="toolbar-icon" title="(Ctrl+Shift+A) Ask AI Assistant">AI</button>'
            '<div id="aiAssistPanel" style="display:none"><div class="ai-panel-inner"><div id="aiPanelHeader"><span id="aiPanelTitle">Ask Jarvis</span></div>'
            '<div id="aiChatMessages"><div class="ai-welcome-msg"><p>Ask me.</p></div></div>'
            '<div id="aiInputArea"><textarea id="aiChatInput" rows="1" aria-label="Ask the AI assistant"></textarea><button id="aiSendBtn" title="Send (Enter)">Send</button>'
            '<div id="aiProfileBar"><label class="ai-profile-toggle"><input type="checkbox" id="aiProfileOn"> Include a summary of my results</label></div></div></div></div>')   # (round 16) the panel's ids, as index.php has them


def build(index_src, menu_html=''):
    src = colmenu_harness.build(index_src)
    sprite, toolbar, buttons = _lift(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>palette</title>')
    # the plumbing's stand-ins give way to the real controls (one id each): Run / Save / AI as
    # index.php draws them (inline SVGs), the toolbar row with its sprite icons, the TOC
    rep('<button id="executeQuery">Run</button><button id="copyActionsBtn" type="button">Copy</button>', buttons + TOC)
    rep('  <button id="groupTableBtn" type="button">Group</button>\n', '')
    # (round 4) the grouping dialog's preset chip slot, as index.php has it (main.js mounts the control
    # on the Group button's click): the "Apply group preset" combination picks a preset there
    rep('<div id="groupingLightbox" style="display:none">\n', '<div id="groupingLightbox" style="display:none">\n  <span class="pnb-dlg-action" id="groupPresetMount"></span>\n')
    rep('<div id="loadingOverlay" style="display:none">', sprite + '\n<div id="zzToolbar">' + toolbar + '</div>\n<div id="loadingOverlay" style="display:none">')
    # (round 6) penumbra_vars as index.php declares it: a top-level const, NOT a window property (the
    # module had read window.penumbra_vars, always empty on live); the colmenu plumbing's object is
    # built inside its IIFE, so it is parked on window.__PV and bound to the const right after
    rep('    window.penumbra_vars = {\n', '    window.__PV = {\n')
    rep('    if (/^hrview/.test(S)) window.penumbra_vars.canEditReport = false;\n', '    if (/^hrview/.test(S)) window.__PV.canEditReport = false;\n')
    rep('<script src="jquery-3.7.1.min.js"></script>\n', '<script>const penumbra_vars = window.__PV; delete window.__PV;\n'
        '  window.PENUMBRA_FORMS_ASSETS = { js: "penumbra_forms.js", css: "penumbra_forms.css" };   /* (round 8) the real forms module, lazy as on index.php */</script>\n'
        '<script src="jquery-3.7.1.min.js"></script>\n')
    # (round 8) the feedback scenario's custom code: a commented-out call first, then the author's call (to:,
    # freeze:LABEL, two types) and a second one - the engine renders the links, the box reads the first
    rep('    window.__PV = {\n',
        '    window.__PV = {\n'
        '      isReportOwner: false,\n')
    rep('      preloadedState: st,\n',
        '      preloadedState: (/^pfeed/.test(window.__SCN) ? Object.assign({}, st, { reportSnippet: "// action(feedback, \'Old form\', \'to:nobody ; Bug|Commented out?\')\\n"\n'
        '        + "Total: count() rows\\n"\n'
        '        + "action(feedback, \'Ask the data steward\', \'to:jsmith ; freeze:Disputed totals ; Bug|What happened?* ; Question|What would you like to know?\')\\n"\n'
        '        + "action(feedback, \'Second form\', \'Suggestion|Second?\')" }) : st),\n')
    # (round 6) the title breadcrumb with the "?" and the magnifier beside it, a note box and an editable
    # note (the key opens the box from them), and the profile card's row inside a stand-in card on the
    # status bar: #zzUserSeg / #zzUserBtn (never main.js's #sbUserSeg, whose click handler main.js binds)
    # with a plain recent row beside it for the "styled like the other rows" check; the button's click
    # toggles the card as main.js's would
    help_icon, magnifier, pop_row, foot_viewer, foot_admin = _lift_r6(index_src, menu_html)
    rep('<div id="zzToolbar">',
        '<nav class="pnb-crumb" aria-label="Breadcrumb" id="zzCrumb"><a class="pnb-crumb-home" href="#">PENUMBRA</a>' + help_icon + magnifier + '</nav>\n'
        '<textarea id="zzTa" rows="2" cols="30">a note being typed</textarea> <div id="zzCe" contenteditable="true" style="display:inline-block;min-width:120px;border:1px solid #ccc;">an editable note</div>\n'
        '<div id="zzToolbar">')
    rep('<div id="pnbStatusBar">',
        '<div id="pnbStatusBar"><div class="sb-seg sb-user sb-click sb-open" id="zzUserSeg"><button type="button" class="sb-user-btn" id="zzUserBtn" aria-expanded="true">Me</button>'
        '<div class="sb-pop" id="zzUserPop" style="left:0;right:auto;min-width:354px;max-width:510px;"><div class="sb-recent-row" id="zzPlainRow"><a class="sb-recent-main" href="#"><span class="rt">A recent report</span></a></div>' + pop_row
        + '<div class="sb-pop-h sb-mt">The viewer\'s bar</div>' + foot_viewer
        # (round 12) the admin's bar (its menu carries the tools JSON) on every page but the viewer's (ptoolsv)
        + '<script>if (!/scn=ptoolsv/.test(location.search)) document.write(' + json.dumps('<div class="sb-pop-h sb-mt">The admin\'s bar</div>' + foot_admin).replace('</script>', '</scr" + "ipt>') + ');</script>'
        + '</div></div>\n'
        '<script>document.getElementById("zzUserBtn").addEventListener("click", function () { var seg = this.parentNode, open = seg.classList.toggle("sb-open"); this.setAttribute("aria-expanded", open ? "true" : "false"); });</script>\n')
    # (round 4b) the preset engine, EAGER before main.js as index.php loads it: the "Apply ... preset" rows
    rep('<script src="main_hc.js"></script>\n', '<script src="penumbra_presets.js"></script>\n<script src="main_hc.js"></script>\n<script src="search_builder.js"></script>\n')   # (round 14) the builder after main.js, as index.php orders them
    # the stub AFTER the header menu, as index.php orders them; the cold scenarios never prefetch
    rep('<script src="penumbra_colmenu.js"></script>\n',
        '<script src="penumbra_colmenu.js"></script>\n'
        '<link rel="stylesheet" href="penumbra_find.css"><script src="penumbra_find.js"></script>\n'   # (round 14) Find, as index.php loads it
        '<script>if (/^pcold|^pfail/.test(window.__SCN)) { window.requestIdleCallback = function () {}; }\n'
        '  if (/^prow/.test(window.__SCN)) document.write(\'<link rel="stylesheet" href="penumbra_cellsel.css"><script src="penumbra_cellsel.js"></scr\' + \'ipt>\');\n'
        '  document.write(\'<script src="penumbra_palette_boot.js" data-js="\' + (window.__SCN === "pfail" ? "penumbra_palette_missing.js" : "penumbra_palette.js") + \'?v=1" data-css="penumbra_palette.css?v=1" data-fn="help_functions.json?v=1"></scr\' + \'ipt>\');</script>\n')
    # (round 15) the editor console: its tab list and the REAL View Options panel from index.php (PHP stripped), stub
    # panels for the other tabs, a scheduler stub with the new-task controls main.js binds, all inside #admWrapper
    # (hidden until the admin view opens, as main.js keeps it); the headers (title + subtitle) of the dialogs the
    # harness lacks, so their words are there to read. The harness's own title / subtitle inputs give way to the
    # panel's textareas (the same ids).
    ul = re.search(r'<ul>\s*<li><a href="#sql-editor-tab">.*?</ul>', index_src, re.S).group(0)
    ul = re.sub(r'<\?php.*?\?>', '', ul, flags=re.S)
    vo = index_src[index_src.index('<div id="view-options-tab">'):index_src.index('<div id="scheduler-tab">')]
    vo = re.sub(r'<\?php.*?\?>', '', vo, flags=re.S)
    tabs = ('<div id="editorTabs">' + ul + '<div id="sql-editor-tab"></div><div id="report-options-tab"></div>' + vo
            + '<div id="scheduler-tab"><div id="schedulerPlaceholder">No task selected</div><div class="scheduler-config-panel" style="display:none"></div>'
              '<select id="schedNewEventType" aria-label="Type of event to add"><option value="EMAIL">Email</option><option value="SFTP">SFTP</option></select>'
              '<button type="button" id="addNewTaskBtn">+ Add</button></div>'
            + '<div id="auditor-tab"></div></div>')
    rep('<div id="editorTabs"></div>', '')
    # out of the hidden plumbing: the console must be VISIBLE once the admin view opens (a tab panel the person can see,
    # an option that can take the focus); main.js keeps #admWrapper hidden until then, as index.php does
    rep('<input id="reportTitle" value=""><input id="reportSubtitle" value=""><div id="admWrapper"></div>', '')
    rep('<div id="zzToolbar">', '<div id="admWrapper" style="display:none">' + tabs + AI_PANEL + '</div>\n<div id="zzToolbar">')   # (round 16) + the Ask Jarvis panel
    # the dialogs' own words: each real dialog's visible text (title, subtitle, labels, small print, headings, buttons,
    # options) from index.php, put INSIDE the harness's stand-in of that dialog (hidden), or as a hidden stand-in when
    # the harness has none - what the module reads at the first match
    heads = ''
    for lid in ('pivotLightbox', 'visualizationLightbox', 'groupingLightbox', 'downloadActionsLightbox', 'copyActionsLightbox', 'emailLightbox', 'manageSnapshotsLightbox', 'journalLightbox'):
        m = re.search(r'^<div id="' + lid + r'"[^\n]*\n(.*?)(?=^<(?:div|\?php|script)\b)', index_src, re.S | re.M)
        if not m: continue
        texts = re.findall(r'<(?:small|label|h3|h4|p|legend|option|button)\b[^>]*>(.*?)</(?:small|label|h3|h4|p|legend|option|button)>', m.group(1), re.S)
        words = ' '.join(re.sub(r'<[^>]+>', ' ', t) for t in texts)
        words = re.sub(r'<\?php.*?\?>', '', words, flags=re.S)
        block = '<div class="zz-dlg-words" hidden><p class="pnb-dlg-sub">' + words + '</p></div>'
        if re.search(r'<div id="' + lid + r'"[^>]*>', src):
            src = re.sub(r'(<div id="' + lid + r'"[^>]*>)', lambda mm: mm.group(1) + block, src, count=1)
        else:
            heads += '<div id="' + lid + '" class="help-lightbox" style="display:none">' + block + '</div>\n'
    rep('<div id="loadingOverlay" style="display:none">', '<div id="zzDlgHeads" style="display:none">' + heads + '</div>\n<div id="loadingOverlay" style="display:none">')
    # the real pivot builder (the colopt harness keeps it in a template, swapped in for pvhl*): in for pvo / pshot15 too,
    # so the Pivot action's dialog words are there to read
    rep('if (/[?&]scn=pvhl/.test(location.search))', 'if (/[?&]scn=(pvhl|pvo|pshot15)/.test(location.search))')
    return src


if __name__ == '__main__':
    idx = open(os.path.join(colmenu_harness.APP, 'index.php'), encoding='utf-8').read()
    open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(build(idx))
    print('harness written')
