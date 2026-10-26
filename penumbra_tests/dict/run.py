# =============================================================================
# DICT SUITE (2026-10-22) - the data dictionary
# (js/penumbra_dict.js + css/penumbra_dict.css, main.js's dict| infobox mode in both engines +
# the dialog branch + the window.Penumbra bridge + Column options' cfg.about, penumbra_colfmt.js's
# link, penumbra_colmenu.js's item, penumbra_palette.js's rows, penumbra_snippet_help.js's button,
# generate_dictionary.php's helpers, dictseeds/, index.php's tags, the help).
#   page half   harness.html (mk_harness.py, from colmenu's) + driver.js     L-<scn>-<check>, E-<scn>
#   php half    gen_tests.php lifts generate_dictionary.php's helpers        S-php
#   static      index.php, the palette rows, the seed, the help             S-*
# --control runs LIVE (no module: EMPTY files): every NEW check red there, the guards green.
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_dict_*; writes nothing to the webroot.
# One headless-Edge suite at a time.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['desc', 'dgen2', 'dlazy', 'dedit', 'pdict', 'dunit', 'dlink', 'dmenu', 'dstats', 'dopts', 'dview', 'dblank', 'dsub', 'dnone', 'dgen', 'dgenerr']
CHK = {
    'dunit': ['loaded', 'notes', 'entries', 'flags', 'laterWins', 'source', 'pipeInText', 'keySpace', 'roundTrip', 'clean', 'blocks', 'replace', 'append', 'bare', 'multi',
              'mergeKept', 'mergeReplaced', 'mergeAdded', 'mergeGone', 'mergeStats', 'mergeNote', 'escapes', 'renderTags', 'renderGone', 'renderViewer', 'renderNone',
              'pvParse', 'pvLegacy', 'pvSerialize', 'pvRoundTrip', 'pvMulti', 'pvMerge', 'pvMergeNoPivot', 'pvRenderOrder', 'pvRenderFocus', 'pvRenderMissing', 'pvRenderPlain',
              'labelScan', 'noNesting', 'deadBlocks', 'multiReplace', 'commentsKept', 'litEscapes'],
    'dlink': ['linkRendered', 'commentStripped', 'snippetIntact', 'has', 'dialogTitle', 'rows', 'note', 'draftTag', 'avoidTag', 'source', 'escaped', 'filter', 'filterEmpty', 'missingLine', 'goneTag', 'authorBar', 'wraps'],
    'dmenu': ['aboutItem', 'aboutBeforeFilter', 'focusRow', 'noItemWithoutEntry', 'cellMenuItem'],
    # (2026-10-24, dictstat) Column stats starts with the column's meaning; the dialog opens at the entry's name
    'dstats': ['meanShown', 'meanEscaped', 'meanFirst', 'meanAria', 'meanFocused', 'meanOpens', 'draftTag', 'noMeanWithoutEntry', 'longCut', 'meanWraps',
               'avoidBlank', 'hardCut', 'cutTidy', 'byLabel', 'opensAtEntry', 'keyboard'],
    'dopts': ['aboutLink', 'linkOpens', 'popoverClosed', 'noLinkWithoutEntry'],
    'dview': ['viewerRows', 'noMissing', 'noGoneTag', 'noAuthorBar', 'draftStillShown', 'cannotGenerate', 'noEditViewer'],
    'dblank': ['noLink', 'stillHas', 'menuItem', 'defaultTitle'],
    'dsub': ['subLink', 'notFromSnippet', 'subPayload', 'subNoEdit'],
    'dnone': ['noLink', 'hasFalse', 'noMenuItem'],
    'dgen': ['sidebarButton', 'dialogOpens', 'existingSaid', 'noRequestOnOpen', 'requestShape', 'requestColumns', 'keptChecked', 'draftReplaced', 'added', 'staleKept', 'noteKept',
             'summary', 'noFence', 'gridShown', 'textBack', 'inserted', 'toastSaysSave', 'currentFollows', 'reopenCounts', 'encBlocks', 'errInFooter', 'encSendsWhenTicked', 'escCloses'],
    'dgenerr': ['errorShown', 'noInsert', 'snippetUntouched'],
    # (2026-10-24 sweep) Esc / X in Edit; Generate's close and Generate again
    'desc': ['escCleanCancels', 'escDiscards', 'reAddRemoved', 'xAsks', 'closedClean'],
    'dgen2': ['genAsks', 'againKeepsChecked', 'genClosesOnYes'],
    # (2026-10-22 c) the core / lazy split; the editor (the dialog's Edit, Generate's grid)
    'dlazy': ['notLoadedYet', 'coreAnswers', 'menuWithoutUi', 'loadedOnOpen', 'uiCssApplied', 'loadedOnce'],
    'dedit': ['editButton', 'editorRows', 'editorValues', 'footSwapped', 'todoCount', 'cleanCancel', 'checkedTag', 'removeMarks', 'addOffersMissing', 'addedRow',
              'grows', 'escAsks', 'applied', 'appliedValues', 'backToView', 'applyToast', 'escAfterApply'],
    # (2026-10-22 b) the pivot's part: first in the dialog, a value cell's menu, Generate sends the pivot
    'pdict': ['dictPivotShape', 'labelByIndex', 'pivotEntry', 'pivotFirst', 'pivotRows', 'pivotNote', 'pivotGone', 'countBoth', 'cellAbout', 'cellFocus',
              'genSubtitle', 'genCounts', 'genSendsPivot', 'genPivotFirst', 'genPivotMerged', 'genColsKept', 'genSummary', 'headTitleFlat'],
}
# what live already does (no module): nothing anywhere
GUARDS = {'L-dnone-noLink', 'L-dnone-hasFalse', 'L-dnone-noMenuItem', 'L-dblank-noLink', 'L-dopts-noLinkWithoutEntry', 'L-dmenu-noItemWithoutEntry'}
STATIC = ['S-indexLoads', 'S-indexLazy', 'S-paletteRows', 'S-sidebar', 'S-php', 'S-phpLint', 'S-seed', 'S-help', 'S-aiPrompt', 'S-noEmdash', 'S-helpStats']
# S-email is a GUARD: engine C (unchanged) already drops the block - green on live too
GUARDS.add('S-email')
GUARDS |= {'L-dgen-noRequestOnOpen', 'S-noEmdash'}   # true of a page without the module, too
NEW = ({'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} | set(STATIC)) - GUARDS
# (2026-10-22 b) phase 1 is LIVE (eb46ff7): --control holds live to every phase-1 check; NEW = the pivot round only
NEW = {"L-pdict-%s" % c for c in CHK["pdict"]} | {"L-dunit-" + c for c in CHK["dunit"] if c.startswith("pv")} | {"S-help", "S-aiPrompt", "S-php"}
# (2026-10-22 c) pivot round live 4d15f3b; this round: long meanings wrap
NEW = {"L-dlink-wraps"}
# (2026-10-22 c) wraps live af4e9c2; this round: the lazy split + the editor
NEW = {"L-%s-%s" % (s, c) for s in ("dlazy", "dedit") for c in CHK[s]} | {"L-dgen-gridShown", "L-dgen-textBack", "L-dview-noEditViewer", "L-dsub-subNoEdit", "S-indexLazy"}
# true of live too (it has the core lookups, the menu item, the wrap, no Edit): guards, not new
NEW -= {"L-dlazy-coreAnswers", "L-dlazy-menuWithoutUi", "L-dlazy-uiCssApplied", "L-dview-noEditViewer"}
GUARDS |= {"L-dlazy-coreAnswers", "L-dlazy-menuWithoutUi", "L-dlazy-uiCssApplied", "L-dview-noEditViewer"}
# (2026-10-24, dictstat) the editor round is live (04f7faf); this round: Column stats' meaning, What this column means opening
# at the entry's name, the help. A column with no entry keeps its counts as they were: a guard, green on live too.
NEW = {"L-dstats-%s" % c for c in CHK["dstats"]} | {"S-helpStats"}
NEW -= {"L-dstats-noMeanWithoutEntry"}
GUARDS |= {"L-dstats-noMeanWithoutEntry"}
# (2026-10-24 sweep) the final bug sweep: Esc never applies, the label scan, dead / several blocks,
# comments and escapes kept, the comment strippers (JS + the email's PHP: S-email is NEW now - live
# applies a commented-out rule after a block with an apostrophe), Generate's close and Generate again
NEW = ({"L-%s-%s" % (s, c) for s in ("desc", "dgen2") for c in CHK[s]} | {"L-dunit-" + c for c in ("labelScan", "noNesting", "deadBlocks", "multiReplace", "commentsKept", "litEscapes")}
       | {"L-dlink-commentStripped", "S-email", "S-php"})
GUARDS.discard("S-email")
NEW -= {"L-desc-xAsks"}
GUARDS |= {"L-desc-xAsks"}   # live asks before the X drops changes too

MUTANTS = {
    'd-noflags': ([('dict', "var text2 = rest.join('|').trim(), m = /^([?!]{1,2})\\s*/.exec(text2)", "var text2 = rest.join('|').trim(), m = null && /^([?!]{1,2})\\s*/.exec(text2)")],
                  ['L-dunit-flags', 'L-dlink-draftTag', 'L-dlink-avoidTag'], ['dunit', 'dlink']),
    'd-mergekeep': ([('dui', "if (e && !e.draft) { out.entries.push(e); st.kept++; return; }", "")], ['L-dunit-mergeKept', 'L-dgen-keptChecked'], ['dunit', 'dgen']),
    'd-escape': ([('dui', "'<th scope=\"row\" class=\"pnb-dict-name\">' + esc(e.name)", "'<th scope=\"row\" class=\"pnb-dict-name\">' + e.name")], ['L-dunit-escapes'], ['dunit']),
    'd-textraw': ([('dui', "(e.text ? esc(e.text) :", "(e.text ? e.text :")], ['L-dunit-escapes', 'L-dlink-escaped'], ['dunit', 'dlink']),
    'd-noauthor': ([('dui', "if (opts.author && opts.columns && opts.columns.length) {", "if (opts.columns && opts.columns.length) {")], ['L-dview-noMissing', 'L-dunit-renderViewer'], ['dview', 'dunit']),
    'd-encbypass': ([('dui', "if (enc && !enc.checked) {", "if (false) {")], ['L-dgen-encBlocks'], ['dgen']),
    'd-noclean': ([('dict', ".replace(/\\/\\*/g, '/ *').replace(/\\*\\//g, '* /')", "")], ['L-dunit-clean'], ['dunit']),
    'd-firstwins': ([('dict', "if (Object.prototype.hasOwnProperty.call(sn, e.key)) { sec.entries[sn[e.key]] = e; }", "if (Object.prototype.hasOwnProperty.call(sn, e.key)) { }")], ['L-dunit-laterWins'], ['dunit']),
    'd-replaceappend': ([('dict', "        return s.slice(0, bl[0].start) + block + s.slice(bl[0].end);\n    }", "        return s.replace(/\\s*$/, '') + '\\n\\n' + block + '\\n';\n    }")], ['L-dunit-replace', 'L-dgen-inserted'], ['dunit', 'dgen']),
    # (the dict branch itself only shapes a blank label and the payload - m-blanklink / m-payload; without
    # it the generic path still draws a working link, so the mode list is what decides a link exists)
    'm-enginea': ([('main', "mode !== 'tile' && mode !== 'embed' && mode !== 'dict')", "mode !== 'tile' && mode !== 'embed')")],
                  ['L-dlink-linkRendered'], ['dlink']),
    # the completeness scan blind to backticks again: the block's apostrophe / paren stops the snippet rendering
    'm-quotestate': ([('main', "        text = String(text).replace(/`([^`]+)`/g, '_');\n", "")], ['L-dlink-linkRendered', 'L-dlink-snippetIntact'], ['dlink']),
    'm-engineb': ([('main', "ibMode !== 'tile' && ibMode !== 'embed' && ibMode !== 'dict') return \"\";", "ibMode !== 'tile' && ibMode !== 'embed') return \"\";")], ['L-dsub-subLink'], ['dsub']),
    # engine B's own branch: without it the payload keeps its backticks and the dialog shows none of it
    'm-enginebpay': ([('main', "                            if (ibMode === 'dict') {", "                            if (false) {")], ['L-dsub-subPayload'], ['dsub']),
    'm-blanklink': ([('main', "        if (!String(linkText == null ? '' : linkText).trim()) return '';\n", "")], ['L-dblank-noLink'], ['dblank']),
    'm-payload': ([('dui', "            var d = current() || o.own;", "            var d = current();")], ['L-dsub-subPayload'], ['dsub']),
    'm-noabout': ([('main', "            about: (window.PenumbraDict && window.PenumbraDict.entryFor(", "            about: (false && window.PenumbraDict.entryFor(")], ['L-dopts-aboutLink'], ['dopts']),
    'm-author': ([('main', "        return !!document.getElementById('admWrapper') && !/[?&]noadm\\b/.test(window.location.search);", "        return true;")], ['L-dview-noMissing', 'L-dview-noAuthorBar'], ['dview']),
    # (2026-10-24, dictstat) the header's item now goes through dictEntry / aboutItem
    'j-nomenu': ([('menu', "        if (ent) { look.push(aboutItem(ent)); }\n", "")], ['L-dmenu-aboutItem', 'L-dblank-menuItem'], ['dmenu', 'dblank']),
    'j-menuany': ([('menu', "        return D.entryFor(col, label) || null;\n", "        return D.entryFor(col, label) || { name: col, key: col, text: '', source: '' };\n")],
                  ['L-dmenu-noItemWithoutEntry', 'L-dstats-noMeanWithoutEntry'], ['dmenu', 'dstats']),
    'c-nolink': ([('mod', "        if (cfg.about) {\n            html +=", "        if (false) {\n            html +=")], ['L-dopts-aboutLink'], ['dopts']),
    'c-noclick': ([('mod', "            cfg.about.run();\n", "")], ['L-dopts-linkOpens'], ['dopts']),
    # --- (2026-10-22 b) the pivot's part
    'p-nosection': ([('dict', "if (mk) { sec = mk[1].toLowerCase() === 'pivot' ? out.pivot : out; return; }", "if (mk) { return; }")], ['L-dunit-pvParse', 'L-pdict-pivotFirst'], ['dunit', 'pdict']),
    'p-noorder': ([('dui', "        if (pv) {\n            html += '<section class=\"pnb-dict-sec pnb-dict-sec-pivot\"", "        if (false) {\n            html += '<section class=\"pnb-dict-sec pnb-dict-sec-pivot\"")], ['L-dunit-pvRenderOrder', 'L-pdict-pivotFirst'], ['dunit', 'pdict']),
    'p-nogt': ([('dui', "        if (inPivot) { inPivot[GT] = true; }\n", "")], ['L-pdict-pivotGone'], ['pdict']),
    'p-nomerge': ([('dui', "        var p = pvCols ? mergeSection(existing.pivot, generated.pivot, pvCols)", "        var p = false ? mergeSection(existing.pivot, generated.pivot, pvCols)")], ['L-dunit-pvMerge', 'L-pdict-genPivotMerged'], ['dunit', 'pdict']),
    'm-nodictpivot': ([('main', "        const s = currentPivotSettings;\n        if (!s || !Array.isArray(s.agg)", "        const s = null;\n        if (!s || !Array.isArray(s.agg)")], ['L-pdict-dictPivotShape', 'L-pdict-genSendsPivot'], ['pdict']),
    'j-nopvabout': ([('menu', "        return (vl && D.pivotEntryFor(vl)) ? { act: 'pvAbout'", "        return false ? { act: 'pvAbout'")], ['L-pdict-cellAbout'], ['pdict']),
    # the item back behind the builder's gate (inside the value's tools): a viewer's cell loses it
    'j-pvaboutgated': ([('menu', "            var abc = aai !== null ? pvAbout(parseInt(aai, 10)) : null;", "            var abc = (aai !== null && tool) ? pvAbout(parseInt(aai, 10)) : null;")], ['L-pdict-cellAbout'], ['pdict']),
    'c-nohead': ([('duicss', ".pnb-dictgen .pnb-dlg-head .pnb-dlg-title { margin: 0; border-bottom: none; padding-bottom: 0; font-size: 17px; }\n", "")], ['L-pdict-headTitleFlat'], ['pdict']),
    # (2026-10-22 c) the wrap reset gone: main.css's base td rule truncates meanings again
    'c-nowrap': ([('duicss', ".pnb-dict-table th, .pnb-dict-table td { white-space: normal; overflow: visible; text-overflow: clip; max-width: none; overflow-wrap: anywhere; }\n", "")], ['L-dlink-wraps'], ['dlink']),
    # --- (2026-10-22 c) the lazy split and the editor
    'l-urlignored': ([('dict', "        return { js: js || 'js/penumbra_dict_ui.js', css: css || 'css/penumbra_dict_ui.css' };", "        return { js: 'js/penumbra_dict_ui.js', css: 'css/penumbra_dict_ui.css' };")], ['L-dlazy-loadedOnOpen'], ['dlazy']),
    # the lazy half fetched at once (the split undone): it must not load before a dialog opens
    'l-eager': ([('dict', "    function openGenerator() {\n", "    setTimeout(function () { ui(); }, 0);\n    function openGenerator() {\n")], ['L-dlazy-notLoadedYet'], ['dlazy']),
    'u-noedit': ([('dui', "(current() ? '<button type=\"button\" class=\"pnb-btn pnb-btn-sm pnb-btn-primary\" data-dd=\"edit\">Edit</button> ' : '')", "''")], ['L-dedit-editButton'], ['dedit']),
    'u-editsub': ([('dui', "(current() ? '<button type=\"button\" class=\"pnb-btn pnb-btn-sm pnb-btn-primary\" data-dd=\"edit\">Edit</button> ' : '')", "('<button type=\"button\" class=\"pnb-btn pnb-btn-sm pnb-btn-primary\" data-dd=\"edit\">Edit</button> ')")], ['L-dsub-subNoEdit'], ['dsub']),
    'u-nocheck': ([('dui', "        function check(tr) { tr.classList.remove('is-draft');", "        function check(tr) { tr.classList.add('was-checked');")], ['L-dedit-checkedTag', 'L-dedit-appliedValues'], ['dedit']),
    'u-removekept': ([('dui', "                if (tr.classList.contains('is-removed')) { return; }\n", "")], ['L-dedit-appliedValues'], ['dedit']),
    # (re-anchored 2026-10-24: the Esc guard is Cancel now) no Esc guard: main.js's Escape clicks Apply
    'u-noguard': ([('dui', "            guard(window, 'keydown', function (e) {\n                if (e.key !== 'Escape') { return; }", "            guard(null, 'keydown', function (e) {\n                if (e.key !== 'Escape') { return; }")],
                  ['L-dedit-escAsks', 'L-desc-escCleanCancels', 'L-desc-escDiscards'], ['dedit', 'desc']),
    # the guard on document again: main.js's earlier capture listener closes the dialog first
    'u-guarddoc': ([('dui', "            guard(window, 'keydown', function (e) {\n                if (e.key !== 'Escape') { return; }", "            guard(document, 'keydown', function (e) {\n                if (e.key !== 'Escape') { return; }")],
                   ['L-dedit-escAsks', 'L-desc-escDiscards'], ['dedit', 'desc']),
    'u-nofoot': ([('dui', "            if (footer && saved) { footer.innerHTML = ''; saved.forEach(function (n) { footer.appendChild(n); }); saved = null; }\n", "")], ['L-dedit-cleanCancel', 'L-dedit-backToView'], ['dedit']),
    'u-nogen': ([('dui', ", _gen: e ? 'rewritten' : 'new' });", " });")], ['L-dgen-gridShown'], ['dgen']),
    'u-textignored': ([('dui', "            var d = D.fromSnippet(txt.value);", "            var d = ed.get();")], ['L-dgen-textBack'], ['dgen']),
    'u-nogrow': ([('dui', "        function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }", "        function grow(ta) { }")], ['L-dedit-grows'], ['dedit']),
    # --- (2026-10-24 sweep)
    'w-escapply': ([('dui', "                e.stopImmediatePropagation(); e.preventDefault();\n                if (!ed.dirty() || window.confirm('Discard your changes to the data dictionary?')) { leave(); }",
                     "                if (!ed.dirty()) { return; }\n                if (!window.confirm('Discard your changes to the data dictionary?')) { e.stopImmediatePropagation(); e.preventDefault(); } else { unguard(); }")],
                   ['L-desc-escCleanCancels', 'L-desc-escDiscards'], ['desc']),
    'w-labelscan': ([('dict', "pre = s.slice(from, at), hm = CALL.exec(pre);", "pre = s.slice(from, at), hm = /^action\\s*\\(\\s*infobox\\s*,\\s*([^,]*?)\\s*,/i.exec(s.slice(s.lastIndexOf('action', at), at));")], ['L-dunit-labelScan'], ['dunit']),
    'w-deadread': ([('dict', "    function liveBlocks(s) { return blocks(s).filter(function (b) { return !b.dead; }); }", "    function liveBlocks(s) { return blocks(s); }")], ['L-dunit-deadBlocks'], ['dunit']),
    'w-multikeep': ([('dict', "        for (i = bl.length - 1; i >= 1; i--) {", "        for (i = bl.length - 1; i >= 99; i--) {")], ['L-dunit-multiReplace'], ['dunit']),
    'w-nocomments': ([('dict', "            if (!lit && line.charAt(0) === '#') { sec.comments.push(line); return; }", "            if (!lit && line.charAt(0) === '#') { return; }")], ['L-dunit-commentsKept'], ['dunit']),
    'w-noescape': ([('dict', "    function literal(t) { return (/^[#\\\\]/.test(t) || MARKER.test(t)) ? '\\\\' + t : t; }", "    function literal(t) { return t; }")], ['L-dunit-litEscapes'], ['dunit']),
    'w-stripjs': ([('main', "        snippetText = snippetText.replace(/((?:`[^`]+`|'[^']*'|\"[^\"]*\"|\\/\\/[^\\/\\n]*\\/\\/))|\\/\\/.*$/gm, (match, quoted) => quoted ? quoted : '');\r\n\r\n",
                    "        snippetText = snippetText.replace(/((?:'[^']*'|\"[^\"]*\"|\\/\\/[^\\/\\n]*\\/\\/))|\\/\\/.*$/gm, (match, quoted) => quoted ? quoted : '');\r\n\r\n")], ['L-dlink-commentStripped'], ['dlink']),
    'w-noreadd': ([('dui', "            } else if (there.classList.contains('is-removed')) {", "            } else if (false) {")], ['L-desc-reAddRemoved'], ['desc']),
    'w-genclose': ([('dui', "        q('[data-dg=\"cancel\"]').addEventListener('click', userClose);", "        q('[data-dg=\"cancel\"]').addEventListener('click', close);")], ['L-dgen2-genAsks'], ['dgen2']),
    'w-againbase': ([('dui', "            var base = review() || existing;", "            var base = existing;")], ['L-dgen2-againKeepsChecked'], ['dgen2']),
    's-nobutton': ([('snip', "(w.PenumbraDict ? '<div class=\"snip-panel-tools\">", "(false ? '<div class=\"snip-panel-tools\">")], ['L-dgen-sidebarButton'], ['dgen']),
    # --- (2026-10-24, dictstat) Column stats' meaning
    'x-nomean': ([('menu', "        if (!e) { return body; }\n", "        return body;\n")], ['L-dstats-meanShown', 'L-dstats-meanFirst', 'L-dstats-keyboard'], ['dstats']),
    'x-rawtext': ([('menu', "(t ? esc(cut) : '<span class=\"pnb-hm-mean-blank\">", "(t ? cut : '<span class=\"pnb-hm-mean-blank\">")], ['L-dstats-meanEscaped'], ['dstats']),
    'x-nocut': ([('menu', "        if (t.length > MEAN_MAX) {\n", "        if (false) {\n")], ['L-dstats-longCut'], ['dstats']),
    # the wrap rule gone: the long meaning's unbroken name runs out of the list sideways
    'x-nowrapcss': ([('mcss', ".pnb-hm-mean .pnb-hm-label { white-space: normal; overflow-wrap: anywhere; }\n", "")], ['L-dstats-meanWraps'], ['dstats']),
    'x-noaria': ([('menu', "'\" title=\"' + esc(it.title) + '\" aria-label=\"' + esc(said) + '\">' +", "'\" title=\"' + esc(it.title) + '\">' +")], ['L-dstats-meanAria'], ['dstats']),
    # not an item: the keyboard never lands on it
    'x-notitem': ([('menu', "'<div class=\"pnb-hm-item pnb-hm-mean\" role=\"menuitem\"", "'<div class=\"pnb-hm-mean\" role=\"menuitem\"")], ['L-dstats-meanFocused', 'L-dstats-keyboard'], ['dstats']),
    # the dialog opened at the column again (an entry found by the heading's label not focused): the meaning; the header's item
    'x-meancol': ([('menu', "run: function () { window.Penumbra.openDataDictionary(e.name); } },\n            '-'].concat(body);", "run: function () { window.Penumbra.openDataDictionary(col); } },\n            '-'].concat(body);")], ['L-dstats-opensAtEntry'], ['dstats']),
    'x-aboutcol': ([('menu', "        if (ent) { look.push(aboutItem(ent)); }\n", "        if (ent) { look.push({ act: 'about', label: 'What this column means', run: function () { window.Penumbra.openDataDictionary(col); } }); }\n")], ['L-dstats-opensAtEntry'], ['dstats']),
    'x-nodraft': ([('menu', "(e.draft ? ' <span class=\"pnb-hm-tag pnb-hm-tag-draft\"", "(false ? ' <span class=\"pnb-hm-tag pnb-hm-tag-draft\"")], ['L-dstats-draftTag'], ['dstats']),
    'x-noavoid': ([('menu', "(e.avoid ? '<span class=\"pnb-hm-tag pnb-hm-tag-avoid\">Do not use</span> ' : '')", "''")], ['L-dstats-avoidBlank'], ['dstats']),
    # (the review) the hard cut splitting an emoji; the dots after an opening bracket; the heading's label never asked
    'x-halfemoji': ([('menu', "            if (hi >= 0xD800 && hi <= 0xDBFF) { at--; }\n", "")], ['L-dstats-hardCut'], ['dstats']),
    'x-tidy': ([('menu', ".replace(/[\\s.,;:(\\[\\/-]+$/, '') + '...';", ".replace(/[\\s.,;:]+$/, '') + '...';")], ['L-dstats-cutTidy'], ['dstats']),
    'x-nolabel': ([('menu', "dictEntry(col, th ? labelOf(th) : col)", "dictEntry(col, col)")], ['L-dstats-byLabel'], ['dstats']),
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
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'dict': os.path.join('js', 'penumbra_dict.js'), 'dcss': os.path.join('css', 'penumbra_dict.css'),
        'dui': os.path.join('js', 'penumbra_dict_ui.js'), 'duicss': os.path.join('css', 'penumbra_dict_ui.css'),
        'pal': os.path.join('js', 'penumbra_palette.js'), 'snip': os.path.join('js', 'penumbra_snippet_help.js'),
        'gen': 'generate_dictionary.php', 'seed': os.path.join('dictseeds', 'STATS_COMBINED_V2.txt'), 'seedcfg': os.path.join('dictseeds', 'web.config'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php'),
        'topic': os.path.join('help', 'topics', 'optionsHelpLightbox.php'), 'ai': 'ai_system_prompt.php',
        'utopic': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php')}
sys.path.insert(0, HERE)
import mk_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

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
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_dict_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(tempfile.gettempdir(), 'pnbedge_dict_%d' % dp), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])
    w('penumbra_dict.js', texts['dict'])
    w('penumbra_dict.css', texts['dcss'])
    w('penumbra_dict_ui.js', texts['dui'])
    w('penumbra_dict_ui.css', texts['duicss'])
    w('penumbra_snippet_help.js', texts['snip'])

def php_checks(texts):
    p = os.path.join(stage, 'generate_dictionary.php')
    out, m, lint_ok, lint_txt = 'no generate_dictionary.php', None, False, 'no generate_dictionary.php'
    if texts['gen']:
        open(p, 'wb').write(texts['gen'].encode('utf-8', 'surrogateescape'))
        lint = subprocess.run([PHP, '-n', '-l', p], capture_output=True, text=True)
        lint_ok, lint_txt = lint.returncode == 0, lint.stdout.strip()[:200]
        env = dict(os.environ, PNB_DICT_GEN=p)
        r = subprocess.run([PHP, '-n', os.path.join(HERE, 'gen_tests.php')], capture_output=True, text=True, env=env)
        out = (r.stdout or '') + (r.stderr or '')
        m = re.search(r'SUMMARY pass=(\d+) fail=(\d+)', out)
    # engine C (the scheduled email): schedule_runner.php is not changed by this feature; lift its functions
    # (parity\extract_engine_c.php, never require the runner) into the stage and mail a snippet holding a block
    ex = os.path.join(HERE, '..', 'parity', 'extract_engine_c.php')
    edir = os.path.join(stage, 'engc'); os.makedirs(edir, exist_ok=True)
    subprocess.run([PHP, '-n', ex, pick('schedule_runner.php'), os.path.join(edir, 'runner_functions.php')], capture_output=True)
    for dep in ('penumbra_search.php', 'journal_export.php', 'penumbra_template.php', 'themes_config.php', 'penumbra_render_charts.php'):
        subprocess.run([PHP, '-n', ex, pick(dep), os.path.join(edir, 'dep_' + dep)], capture_output=True)
    er = subprocess.run([PHP, '-n', os.path.join(HERE, 'email_tests.php'), edir], capture_output=True, text=True)
    eout = (er.stdout or '') + (er.stderr or '')
    em = re.search(r'SUMMARY pass=(\d+) fail=(\d+)', eout)
    return [('S-phpLint', lint_ok, lint_txt),
            ('S-php', bool(m) and int(m.group(2)) == 0 and int(m.group(1)) > 0, ' '.join(l for l in out.splitlines() if l.startswith('FAIL') or l.startswith('SUMMARY'))[:600]),
            ('S-email', bool(em) and int(em.group(2)) == 0 and int(em.group(1)) >= 6, ' '.join(l for l in eout.splitlines() if l.startswith('FAIL') or l.startswith('SUMMARY'))[:600])]

# (2026-10-24, dictstat) the help names Column stats' meaning (the ways in, the menu's table, Column stats' paragraph) and the
# comparison's item; the new cell and the comparison's list item stay within 70 words (help L16)
def _words(h): return len(re.sub(r'<[^>]+>', ' ', h).split())
def help_stats(topic, ut):
    m1 = re.search(r'<strong>What this column means</strong></td><td[^>]*>(.*?)</td>', ut, re.S)
    m2 = re.search(r'<li>(In a snapshot comparison,.*?)</li>', ut, re.S)
    n1, n2 = (_words(m1.group(1)) if m1 else None), (_words(m2.group(1)) if m2 else None)
    good = (bool(m1 and m2) and '<em>Column stats</em> starts with the meaning' in topic
            and 'the list starts with its meaning; a click on it opens the dictionary' in ut and 'offers <em>What this column means</em>' in m2.group(1)
            and n1 <= 70 and n2 <= 70)
    return ('S-helpStats', good, 'cell=%s li=%s words' % (n1, n2))

def static_checks(texts):
    idx, pal, snip, seed, topic, ai = texts['index'], texts['pal'], texts['snip'], texts['seed'], texts['topic'], texts['ai']
    di, mi = idx.find('src="js/penumbra_dict.js?v='), idx.find('src="js/main.js?v=')
    seed_ok = False
    if seed:
        lines = [l for l in seed.splitlines() if l.strip() and not l.startswith('#')]
        cols = [l for l in lines if '|' in l]
        seed_ok = len(cols) > 120 and any(l.startswith('zz_resolver | !') for l in cols) and '`' not in seed and '\\_' not in seed
    new_ui = texts['dict'] + texts['dcss']
    return [
        ('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_dict.off')" in idx and di != -1 and 'href="css/penumbra_dict.css?v=' in idx and (mi == -1 or di < mi), 'dict at %d, main at %d' % (di, mi)),
        # (2026-10-22 c) the lazy half's URLs on the core's tag, each with its own filemtime
        ('S-indexLazy', """data-ui="js/penumbra_dict_ui.js?v=<?php echo is_file(__DIR__ . '/js/penumbra_dict_ui.js') ? filemtime(""" in idx
         and """data-ui-css="css/penumbra_dict_ui.css?v=<?php echo is_file(__DIR__ . '/css/penumbra_dict_ui.css') ? filemtime(""" in idx, ''),
        ('S-paletteRows', "id: 'dictionary', label: 'Data dictionary'" in pal and "id: 'gendict', label: 'Generate data dictionary'" in pal
         and re.search(r"id: 'gendict'[^\n]*gate: 'admin'", pal) is not None and "book: '<path" in pal and "id: 'dictionary'" in pal and
         re.search(r"id: 'dictionary'[^\n]*gate:", pal) is None, ''),
        ('S-sidebar', 'snipGenDictBtn' in snip and 'w.PenumbraDict.openGenerator()' in snip, ''),
        ('S-seed', seed_ok and 'allowUnlisted="false"' in texts['seedcfg'], ''),
        ('S-help', 'id="dict-mode"' in topic and 'dict|' in topic and 'source:' in topic and 'Generate data dictionary' in topic and 'What this column means' in topic and '[pivot]' in topic and 'What this value means' in topic, ''),
        ('S-aiPrompt', 'dict|' in ai and '[pivot]' in ai, ''),
        help_stats(topic, texts['utopic']),
        ('S-noEmdash', chr(0x2014) not in new_ui and chr(0x2013) not in new_ui, ''),
    ] + php_checks(texts)

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps((r.get('info') or {}).get(c))[:500]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-16s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            for a, p, d in res:
                if a.startswith('F-') and not p: print('      %s  %s' % (a, ' '.join(d.split())))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            old_red = sorted(a for a in red if a not in NEW and not a.startswith(('F-', 'E-')))
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: guards red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not old_red else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
