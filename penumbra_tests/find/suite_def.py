# find suite - the scenarios, their checks and the mutants (run.py imports this).
SCN = [('boot', ''), ('open', ''), ('lazy', ''), ('order', ''), ('search', ''), ('hidcol', ''), ('fmt', ''),
       ('exact', ''), ('regex', ''), ('filter', ''), ('esc', ''), ('paint', ''), ('export', ''), ('gview', ''),
       ('none', ''), ('json', ''), ('ent', ''), ('big', ''), ('all', ''), ('off', '&find=off'), ('sel', ''), ('cover', ''),
       ('grp_stack', ''), ('grp_closed', ''), ('grp_nest_closed', ''), ('grp_list', ''), ('grp_search', ''), ('grp_filter', ''), ('grp_esc', ''),
       ('piv_open', ''), ('piv_closed', ''), ('piv_esc', ''),
       # round 3
       ('busy3', ''), ('textnode3', ''), ('grp_churn', ''), ('big_dirty', ''), ('guards3', ''), ('grp_applied', ''), ('info3', ''),
       ('xfix', ''), ('xsync', ''), ('busymain', ''), ('steady', ''), ('grp_steady', ''),
       # round 5
       ('dlg_find', ''), ('dlg_notable', ''), ('dlg_switch', ''), ('dlg_ontop', ''), ('cmp_names', ''),
       ('narrow', '&vw=420&vh=800'), ('narrow_mid', '&vw=700&vh=800'), ('wide_edge', '&vw=760&vh=800'),
       ('mk_flat', ''), ('mk_col', ''), ('mk_forms', ''), ('grp_marks_closed', ''), ('piv_marks', ''), ('mk_find', ''),
       # the sweep (never in a default run: --scn sweep_a,...): a seeded random walk, invariants after each step
       ('sweep_a', '&seed=11&steps=70'), ('sweep_b', '&seed=23&steps=70'), ('sweep_c', '&seed=37&steps=70'),
       ('grp_sweep_list', '&seed=41&steps=70'), ('piv_sweep', '&seed=53&steps=70'),
       ('probe', ''), ('shot', ''), ('shotdark', ''), ('shot_open', ''), ('shot_kilo', ''),
       ('shot_dlg', ''), ('shot_narrow', '&vw=420&vh=800'), ('shot_narrow_mid', '&vw=700&vh=800'), ('shot_cmp', ''),
       ('grp_probe', ''), ('grp_probe_closed', ''), ('grp_probe_list', ''), ('grp_probe_nest_closed', ''), ('piv_probe', ''), ('piv_probe_closed', '')]
PROBES = {'probe', 'shot', 'shotdark', 'shot_open', 'shot_kilo', 'shot_dlg', 'shot_narrow', 'shot_narrow_mid', 'shot_cmp', 'grp_probe', 'grp_probe_closed', 'grp_probe_list', 'grp_probe_nest_closed', 'piv_probe', 'piv_probe_closed',
          'sweep_a', 'sweep_b', 'sweep_c', 'grp_sweep_list', 'piv_sweep'}   # dumps / pictures / sweeps only (--scn ...), never in a default run
CHK = {
    'boot': ['sane300', 'saneLazy', 'sanePage', 'api', 'host', 'noBarYet', 'activateApi'],
    'open': ['ctrlF', 'barShown', 'inputFocused', 'a11y', 'placed', 'secondPasses', 'escCloses', 'escConsumed', 'metaF',
             'typingFree', 'busyFree', 'sheet'],
    'lazy': ['saneLazy', 'count1', 'onPage', 'filled', 'curMarked', 'inView', 'highlighted', 'live', 'caseless', 'noMatches'],
    'order': ['saneSorted', 'domOrder', 'firstOnTop', 'nextDown', 'wraps', 'f3', 'ctrlG', 'ctrlShiftG'],
    'search': ['saneSearched', 'scoped', 'countKept', 'moreLine', 'liveRescope'],
    'hidcol': ['saneHidden', 'noHiddenCol', 'noHiddenOnly', 'shownCol'],
    'fmt': ['saneFmt', 'saneLazy', 'shownLazy', 'rawLazy', 'shownFilled', 'rawFilled', 'rawTint'],
    'exact': ['containsWide', 'exactNarrow', 'exactWhole'],
    'regex': ['re9', 'reCase', 'reNoCase', 'bad', 'reHighlight'],
    'filter': ['labelOne', 'labelAsync', 'honest', 'clickFilters', 'noReoffer', 'andAdds', 'andFilters', 'orHides', 'altEnter'],
    'cover': ['topRow', 'atHome', 'underHome', 'notCovered', 'justBelow', 'backHome'],
    'esc': ['closed', 'unpainted', 'activeCell', 'arrowsOn', 'termKept'],
    'paint': ['sanePage2', 'startHere', 'paintsPage', 'afterFlip', 'noReread', 'closesOnNone'],
    'export': ['openOk', 'csvSame', 'htmlSame'],
    'gview': ['saneGrouped', 'taken'],
    'grp_stack': ['saneGrouped', 'taken', 'oneCell', 'inView', 'highlighted', 'allGroups', 'pageOrder', 'stepped', 'band', 'bandOutline', 'bandEsc'],
    'grp_closed': ['saneClosed', 'opened', 'othersClosed', 'inView', 'stepOpens'],
    'grp_nest_closed': ['saneNested', 'twoLevels', 'bothOpen', 'inView'],
    'grp_list': ['saneList', 'otherGroup', 'picked', 'inView', 'listFollows', 'barFollows'],
    'grp_search': ['saneSearched', 'allBefore', 'liveRescope', 'moreLine', 'scoped'],
    'grp_filter': ['offered', 'filtered', 'noReoffer'],
    'grp_esc': ['closed', 'activeCell', 'arrowsOn'],
    'piv_open': ['sanePivot', 'taken', 'labels', 'cur', 'stepped', 'noFilter', 'grandTotal'],
    'piv_closed': ['saneClosed', 'expanded', 'inView', 'othersClosed', 'stepExpands'],
    'piv_esc': ['closed', 'activeCell'],
    'none': ['saneNone', 'notTaken'],
    'json': ['saneJson', 'nestedLazy', 'nestedMarked', 'nestedOnce', 'noKeys'],
    'ent': ['decoded', 'noEntity', 'apos', 'lt'],
    'big': ['saneBig', 'bigCount', 'bigFast', 'bigLast'],
    'all': ['saneAll', 'allFound'],
    'off': ['saneOffNoApi', 'saneOffNotTaken'],
    'sel': ['prefill'],
    # round 3
    'busy3': ['busyShown', 'busyText', 'busyGone'],
    'textnode3': ['sameNodes', 'staticRanges'],
    'grp_churn': ['churnIgnored', 'closeTaken'],
    'big_dirty': ['noRestart', 'dirtyRight'],
    'guards3': ['noKeyword', 'wordOffered'],
    'grp_applied': ['appliedOnly'],
    'info3': ['aboutText', 'aboutWords', 'tipOpens', 'tipCloses', 'formNoSubmit'],
    'xfix': ['hasText', 'xShown', 'deleteClears'],
    'xsync': ['syncHasText', 'syncDeleteClears'],
    'busymain': ['busySame', 'noSlowSelector'],
    'steady': ['steadyWidth', 'steadyHeight', 'steadyFits', 'roomCleared', 'steadyNoFilter'],
    'grp_steady': ['gSteady', 'gRoom'],
    # round 5
    'dlg_find': ['dlgTaken', 'dlgAbove', 'dlgCount', 'dlgStep', 'dlgNoFilter', 'dlgNoRowNo', 'dlgSort', 'dlgEscFind', 'dlgCloses'],
    'dlg_notable': ['notableBrowser'],
    'dlg_switch': ['swDialog', 'swClosed', 'swBack'],
    'dlg_ontop': ['otEnds', 'otSecond'],
    'cmp_names': ['cmpBand', 'cmpNoCount', 'cmpOutline'],
    'narrow': ['nTwoRows', 'nSpans', 'nInside', 'nSteady', 'nWhole'],
    'narrow_mid': ['nTwoRows', 'nSpans', 'nInside', 'nSteady', 'nWhole'],
    'wide_edge': ['wOneRow', 'wInView'],
    'mk_flat': ['marked', 'onPage', 'notRowNo', 'allOnPage', 'followsPage', 'clearedNone'],
    'mk_col': ['colOnly', 'globalAnyCol'],
    'mk_forms': ['exactWhole', 'regexStart', 'equalsWhole', 'noCompare'],
    'grp_marks_closed': ['opensMarked', 'closedUnmarked'],
    'piv_marks': ['pivLabels'],
    'mk_find': ['bothShown', 'underFind', 'printClean', 'marksNoDom'],
    'sweep_a': ['noViolations'], 'sweep_b': ['noViolations'], 'sweep_c': ['noViolations'],
    'grp_sweep_list': ['noViolations'], 'piv_sweep': ['noViolations'],
    'probe': [], 'shot': [], 'shotdark': [], 'shot_open': [], 'shot_kilo': [],
    'shot_dlg': [], 'shot_narrow': [], 'shot_narrow_mid': [], 'shot_cmp': [],
    'grp_probe': [], 'grp_probe_closed': [], 'grp_probe_list': [], 'grp_probe_nest_closed': [], 'piv_probe': [], 'piv_probe_closed': [],
}
# Hold with or without the module (they assert an ABSENCE): green in --control too.
CONTROL_OK = {'L-boot-noBarYet', 'L-open-typingFree', 'L-open-busyFree', 'L-esc-closed', 'L-esc-unpainted',
              'L-export-csvSame', 'L-export-htmlSame', 'L-none-notTaken',
              'L-grp_esc-closed', 'L-piv_esc-closed',
              # round 1 is LIVE (2026-10-19 13:38): the control's live main.js and cell selection
              # carry findHost and activate - they hold without the module now
              'L-boot-host', 'L-boot-activateApi',
              # round 3: main.js's busy() answers the same old or new; no marks without the module
              'L-busymain-busySame', 'L-mk_flat-notRowNo', 'L-mk_flat-clearedNone', 'L-mk_forms-noCompare',
              'L-grp_marks_closed-closedUnmarked',
              # round 3 is LIVE (2026-10-19 evening): the live main.js keeps the box's state in step
              # (_pnbSyncSearchBoxState) and asks busy() without :visible - with no module too
              'L-xsync-syncHasText', 'L-xsync-syncDeleteClears', 'L-busymain-noSlowSelector',
              # round 5 absences: a dialog of words left to the browser, no bar once the dialog
              # closed, no heading found by a count
              'L-dlg_notable-notableBrowser', 'L-dlg_switch-swClosed', 'L-cmp_names-cmpNoCount'}

# name: ([(file, old, new)], checks that must go red, scenarios to run). file = mod | css | main | cellsel
MUTANTS = {
    # a lazy cell reads as empty: rows past the first page are never found
    'nolazy': ([('mod', "        var s = String(raw), h = H();\n", "        return '';\n        var s = String(raw), h = H();\n")],
               ['L-lazy-count1', 'L-json-nestedLazy', 'L-fmt-shownLazy'], ['lazy', 'json', 'fmt']),
    # main.js never turns to the match's page
    'noflip': ([('main', "            currentPage = Math.floor(k / rpp) + 1;\r\n            applyPagination();\r\n", "            return false;\r\n")],
               ['L-lazy-onPage'], ['lazy']),
    # the matches in data order, not on-screen (sorted) order
    'masterorder': ([('mod', "                finish(found, off, { sig: sig, body: sc.body, rows: sc.rows }, done);\n",
                      "                finish(found.sort(function (a, b) { return a.ri - b.ri; }), off, { sig: sig, body: sc.body, rows: sc.rows }, done);\n")],
                    ['L-order-domOrder'], ['order']),
    # rows the search hides count as matches
    'scopeall': ([('mod', "                    var tr = trs[r], kept = !tr.classList.contains('search-hidden');\n", "                    var tr = trs[r], kept = true;\n")],
                 ['L-search-scoped', 'L-search-countKept'], ['search']),
    # hidden columns are searched
    'hiddencols': ([('mod', "            if (id === null || id === '#' || th.style.display === 'none' || th.classList.contains('journal-toggle-col')) { continue; }\n",
                     "            if (id === null || id === '#' || th.classList.contains('journal-toggle-col')) { continue; }\n")],
                   ['L-hidcol-noHiddenCol', 'L-hidcol-noHiddenOnly'], ['hidcol']),
    # only the stored value is matched (never what the cell shows)
    'rawonly': ([('mod', "        if (spec.test(shown)) { return 1; }\n", "        if (false) { return 1; }\n")],
                ['L-fmt-shownLazy', 'L-fmt-shownFilled'], ['fmt']),
    # only what the cell shows is matched (never the stored value)
    'shownonly': ([('mod', "        return (alt !== null && alt !== shown && spec.test(alt)) ? 2 : 0;\n", "        return 0;\n")],
                  ['L-fmt-rawLazy', 'L-fmt-rawFilled'], ['fmt']),
    # the current match painted with a background: Copy as HTML / email carry it
    'markbg': ([('mod', "            if (k === cur) { td.classList.add('pnb-find-cur');", "            if (k === cur) { td.style.backgroundColor = 'rgb(255, 230, 0)'; td.classList.add('pnb-find-cur');")],
               ['L-export-htmlSame'], ['export']),
    # Ctrl+F taken from a text field - Find's own box too (Ctrl+F again = the browser's own find)
    # (round 5 split the guard: the text field first, then a dialog with a table or the view)
    'grabtyping': ([('mod', "            if (!h || h.typing(e.target)) { return; }\n            var d = topDialog();\n", "            if (!h) { return; }\n            var d = topDialog();\n")],
                   ['L-open-typingFree', 'L-open-secondPasses'], ['open']),
    # Ctrl+F taken under a dialog (one with no table: main.js's busy())
    'noguard': ([('mod', "            if (!d && (!activeView() || h.busy())) { return; }\n", "            if (!d && !activeView()) { return; }\n")],
                ['L-open-busyFree'], ['open']),
    # Esc reaches main.js's own Escape handler (the admin console toggle)
    'escleak': ([('mod', "            e.preventDefault();\n            e.stopPropagation();\n            close(true);\n", "            e.preventDefault();\n            close(true);\n")],
                ['L-open-escConsumed'], ['open']),
    # Esc hands nothing to cell selection
    'nohandback': ([('mod', "        if (handBack && td && shown(td) && cs && typeof cs.activate === 'function' && cs.activate(td)) { return; }\n", "")],
                   ['L-esc-activeCell', 'L-esc-arrowsOn'], ['esc']),
    # cell selection without activate (the cellsel patch missing)
    'noactivate': ([('cellsel', "            markKb();\n            focusCell(td);\n            return true;\n", "            return false;\n")],
                   ['L-esc-activeCell'], ['esc']),
    # a nested table's hidden raw JSON read as text (both guards gone: its class in
    # SKIP and the inline display:none check - each alone is the other's backstop)
    'rawjson': ([('mod', "    var SKIP = '.raw-json-data, .nested-json-header, ", "    var SKIP = '.nested-json-header, "),
                 ('mod', " || el.hidden || (el.style && el.style.display === 'none'));", " || el.hidden);")],
                ['L-json-noKeys'], ['json']),
    # a nested table's heading row read as text
    'jsonhead': ([('mod', "    var SKIP = '.raw-json-data, .nested-json-header, ", "    var SKIP = '.raw-json-data, ")],
                 ['L-json-noKeys'], ['json']),
    # applyPagination never tells Find: a page turned by hand keeps the old marks, a search change the old count
    'nohook': ([('main', "        if (window.Penumbra && window.Penumbra.find && window.Penumbra.find.paged) { try { window.Penumbra.find.paged(); } catch (_findErr) { } }\r\n", "")],
               ['L-paint-afterFlip', 'L-search-liveRescope'], ['paint', 'search']),
    # the button names Find's own count, not the search's
    'filterlie': ([('mod', "            p.n = (rows && rows.length <= COUNT_MAX_ROWS) ? h.searchCount(p.q) : null;\n", "            p.n = hits.length;\n")],
                  ['L-filter-honest'], ['filter']),
    # ...and the bar's own (sliced) count does too
    'filterlieasync': ([('mod', "            p.n = n; promo = p;\n", "            p.n = hits.length; promo = p;\n")],
                       ['L-filter-labelAsync'], ['filter']),
    # an applied search is replaced, not added to
    'noand': ([('mod', "        return { q: applied + ' AND ' + q, add: true, n: null };\n", "        return { q: q, add: false, n: null };\n")],
              ['L-filter-andAdds'], ['filter']),
    # two words handed over unquoted (the search reads them as two terms)
    'noquote': ([('mod', "            else if (t.indexOf('\"') < 0) { q = '\"' + t + '\"'; }\n", "            else if (t.indexOf('\"') < 0) { q = t; }\n")],
                ['L-filter-labelOne'], ['filter']),
    # a broken pattern throws
    'regexthrows': ([('mod', "            try { re = new RegExp(m[1], m[2] ? 'g' : 'gi'); } catch (e) { return { kind: 'bad', bad: true, term: t }; }\n",
                      "            re = new RegExp(m[1], m[2] ? 'g' : 'gi');\n")],
                    ['L-regex-bad'], ['regex']),
    # entities left encoded in a lazy row
    'nodecode': ([('mod', "        if (s.indexOf('&') < 0) { return s; }\n", "        return s;\n")],
                 ['L-ent-decoded'], ['ent']),
    # no "N more in rows your search hides" line
    'nomore': ([('mod', "        if (hidden > 0 && spec && !spec.bad && !scanning) {\n", "        if (false) {\n")],
               ['L-search-moreLine'], ['search']),
    # the cheat sheet does not list Ctrl+F
    'nosheet': ([('main', "            (window.Penumbra && window.Penumbra.find) ? row(['Ctrl+F'], 'Find in the table without filtering it (press it again for the browser find)') : ''\r\n", "            ''\r\n")],
                ['L-open-sheet'], ['open']),
    # stepping always starts at the first match (not where you are)
    'nostart': ([('mod', "        for (var k = 0; k < hits.length; k++) { if (hits[k].pos >= ref) { return k; } }\n        return 0;\n", "        return 0;\n")],
                ['L-paint-startHere'], ['paint']),
    # the match is never scrolled into view
    'noreveal': ([('mod', "        if (td && hit.tr.style.display !== 'none') { reveal(td); }\n", "")],
                 ['L-lazy-inView'], ['lazy']),
    # the bar stays open when the table is hidden (Rows = None): nothing watches the page's classes
    'nowatch': ([('mod', "                watcher.observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });\n", "")],
                ['L-paint-closesOnNone'], ['paint']),
    # main.js calls the grouped view the flat table (both of flatActive's guards gone: the
    # grouped / pivot check and the flat table's own visibility) - Find reads the wrong view
    'nogroupcheck': ([('main', "            if ($('#groupedResultsContainer').is(':visible') || $('#pivot-output-container').is(':visible')) return false;\r\n", ""),
                      ('main', "            return $(T).is(':visible');\r\n", "            return true;\r\n")],
                     ['L-gview-taken'], ['gview']),
    # ---- round 2: the grouped view and the pivot ----
    # the grouped view is not recognised: Ctrl+F stays the browser's there
    'nogroupview': ([('mod', "        if (shown(g) && g.querySelector('.group-content > table')) { return 'grouped'; }\n", "")],
                    ['L-grp_stack-taken', 'L-gview-taken'], ['grp_stack', 'gview']),
    # the pivot is not recognised
    'nopivotview': ([('mod', "        if (shown(p) && shown(document.getElementById('pivot-output-container'))) { return 'pivot'; }\n", "")],
                    ['L-piv_open-taken'], ['piv_open']),
    # a collapsed group around a match is not opened
    'noopen': ([('mod', "                chain[i].classList.add('open');\n                if (c) { c.style.display = 'block'; }\n", "")],
               ['L-grp_closed-opened', 'L-grp_nest_closed-bothOpen'], ['grp_closed', 'grp_nest_closed']),
    # the List layout does not pick the match's group
    'nolistpick': ([('mod', "                try { gl.selectGroup(chain[chain.length - 1]); } catch (e) { }\n", "")],
                   ['L-grp_list-picked'], ['grp_list']),
    # group names are not looked for in the headings
    'nobands': ([('mod', "                    if (lab) { out.push({ kind: 'band', el: lab, tr: null, kept: !searchHidden(el) }); }\n", "")],
                ['L-grp_stack-band'], ['grp_stack']),
    'nobandoutline': ([('css', '#groupedResultsContainer .group-name.pnb-find-cur {', '#groupedResultsContainer .group-name.pnb-find-nope {')],
                ['L-grp_stack-bandOutline'], ['grp_stack']),
    # rows the search hides in the grouped view count as matches
    'groupscope': ([('mod', "                var keep = !searchHidden(el);\n", "                var keep = true;\n")],
                   ['L-grp_search-scoped', 'L-grp_search-liveRescope'], ['grp_search']),
    # a collapsed pivot group around a match is not expanded
    'nopivexpand': ([('mod', "                if (ts[i].getAttribute('data-group-key') === key && shown(ts[i])) { ts[i].click(); break; }\n", "")],
                    ['L-piv_closed-expanded'], ['piv_closed']),
    # nothing reacts to a change in the grouped view (a search run with Find open)
    'nodomwatch': ([('mod', "    function relevant(recs) {\n", "    function relevant(recs) {\n        return false;\n")],
                   ['L-grp_search-liveRescope'], ['grp_search']),
    # Esc on a group's name reads its (missing) row: a TypeError, the bar stays open
    'bandescthrows': ([('mod', 'hit && hit.tr && hit.tr.isConnected', 'hit && hit.tr.isConnected')],
                      ['L-grp_stack-bandEsc'], ['grp_stack']),
    # a change that only moves things (the List layout's crumb, a frame after the pick): the bar stays put
    'nofollow': ([('mod', "                    else { onMove(); }\n", "")],
                 ['L-grp_list-barFollows'], ['grp_list']),
    # Filter to N rows offered in a pivot
    'pivfilter': ([('mod', "        if (scanned && (scanned.view === 'pivot' || scanned.view === 'dialog')) { return null; }\n",
                    "        if (scanned && scanned.view === 'dialog') { return null; }\n")],
                  ['L-piv_open-noFilter'], ['piv_open']),
    # the bar stays put over a match in the top row of a right-hand column
    'nocoverflip': ([('mod', "                top = (c.bottom + 6 + b.height <= window.innerHeight) ? Math.round(c.bottom + 6) : Math.max(0, Math.round(c.top - b.height - 6));\n", "")],
                    ['L-cover-notCovered', 'L-cover-justBelow'], ['cover']),
    # after Filter the button offers the applied term again (term AND term)
    'reoffer': ([('mod', "        if (applied.split(/\\s+and\\s+/i).some(function (part) { return norm(part).toLowerCase() === lowQ; })) { return null; }\n", "")],
                ['L-filter-noReoffer'], ['filter']),
    # Ctrl+F taken with the table hidden (Rows = None)
    'nonecheck': ([('main', "            if (document.body.classList.contains('pnb-data-hidden')) return false;\r\n", "")],
                  ['L-none-notTaken'], ['none']),
    # ---- round 3 ----
    # no busy cue (the class) / the spinner never drawn (the CSS)
    'nobusy': ([('mod', "        if (bar) { bar.classList.toggle('pnb-find-busy', !!(isOpen && (scanning || counting))); }\n", "")],
               ['L-busy3-busyShown'], ['busy3']),
    'nospin': ([('css', ".pnb-find-bar.pnb-find-busy .pnb-find-spin { visibility: visible; }", ".pnb-find-bar.pnb-find-busy .pnb-find-spin { }")],
               ['L-busy3-busyShown'], ['busy3']),
    # the count's words replace its text node (the a11y layer's page-wide sweep follows every change)
    'textreplace': ([('mod', "        if (t && t.nodeType === 3 && !t.nextSibling) { if (t.data !== s) { t.data = s; } return; }\n", "")],
                    ['L-textnode3-sameNodes'], ['textnode3']),
    # live Ranges (every DOM change under them pays to keep them up to date)
    'liveranges': ([('mod', "        if (typeof window.StaticRange === 'function') {\n", "        if (false) {\n")],
                   ['L-textnode3-staticRanges'], ['textnode3']),
    # any class change is a view change (zebra stripes and hover cues restart a read)
    'anyclass': ([('mod', "    function viewClasses(s) {\n", "    function viewClasses(s) {\n        return String(s || '');\n")],
                 ['L-grp_churn-churnIgnored'], ['grp_churn']),
    # a page turn mid-read starts the read over
    'restart': ([('mod', "            if (scanning) { dirty = true; return; }   // a page turned mid-read: the read looks again when it ends\n",
                  "            if (scanning) { reread(null); return; }\n")],
                ['L-big_dirty-noRestart'], ['big_dirty']),
    # Filter offered for 'empty' and number ranges (the search reads them by value)
    'noguard3': ([('mod', "            if (/^empty$/i.test(t) || (!plainNum && /[,\\-]/.test(t) && /^[\\d,\\-.$%\\s]+$/.test(t))) { return null; }\n", "")],
                 ['L-guards3-noKeyword'], ['guards3']),
    # the grouped view's Filter adds to whatever the box holds (typed, never run)
    'boxapplied': ([('mod', "        var applied = (scanned && scanned.dom) ? markQuery('grouped') : norm(h.searchApplied());\n",
                     "        var box = document.getElementById('tableSearch'), applied = norm((scanned && scanned.dom) ? (box ? box.value : '') : h.searchApplied());\n")],
                   ['L-grp_applied-appliedOnly'], ['grp_applied']),
    # the (i) button shows nothing / the bar's form submits (the page reloads)
    'notip': ([('mod', "            tip.hidden = !tip.hidden;\n", "")],
              ['L-info3-tipOpens'], ['info3']),
    'nosubmitstop': ([('mod', "        bar.addEventListener('submit', function (e) { e.preventDefault(); });\n", "")],
                     ['L-info3-formNoSubmit'], ['info3']),
    # the tip's old first words (2026-10-20: the owner's "Highlights ... (even across other pages)")
    'oldabout': ([('mod', "    var ABOUT = 'Highlights what you type and steps from match to match (even across other pages); every row stays in the table. ' +\n",
                   "    var ABOUT = 'Find highlights what you type and steps from match to match; every row stays in the table. ' +\n")],
                 ['L-info3-aboutWords'], ['info3']),
    # main.js runSearch: the box's clear x left hidden / deleting the term no longer clears the search
    # (both layers: runSearch's own lines and the sync at the end of applyPagination - each alone
    # is the other's backstop in the flat view)
    'nohastext': ([('main', "            $('#tableSearchContainer').toggleClass('has-text', q.length > 0);\r\n", ""),
                   ('main', "        $('#tableSearchContainer').toggleClass('has-text', v.length > 0);\r\n", "")],
                  ['L-xfix-hasText', 'L-xfix-xShown'], ['xfix']),
    'noprev': ([('main', "            previousSearchValue = q;\r\n", ""),
                ('main', "        try { previousSearchValue = v; } catch (e) { /* a render before this line ran (TDZ) */ }\r\n", "")],
               ['L-xfix-deleteClears'], ['xfix']),
    # a script's own search leaves the box's state stale (no sync at the end of applyPagination)
    'nosync': ([('main', "        _pnbSyncSearchBoxState();\r\n", "")],
               ['L-xsync-syncHasText', 'L-xsync-syncDeleteClears'], ['xsync']),
    # main.js busy() through jQuery's :visible selector again (every element of the page)
    'oldbusy': ([('main', "        if ($('#settingsPanel').hasClass('is-open')) return true;\r\n",
                  "        return $('#settingsPanel').hasClass('is-open') || window._pnbAll('.infobox-overlay:visible, .modal-prompt-overlay:visible, #chartCarouselOverlay:visible').length > 0 || window._pnbAll('.context-submenu').length > 0 || window._pnbAll(PNB_LIGHTBOXES.join(', ')).is(':visible');\r\n")],
                ['L-busymain-noSlowSelector'], ['busymain']),
    # ---- the search's own highlight (marks) ----
    'nomarks': ([('mod', "        var view = activeView(), q = view ? markQuery(view) : '';\n", "        var view = null, q = '';\n")],
                ['L-mk_flat-marked'], ['mk_flat']),
    'markallcols': ([('mod', "                if (terms[t].col && terms[t].col !== cells[c].name) { continue; }\n", "")],
                    ['L-mk_col-colOnly'], ['mk_col']),
    'marksnopaged': ([('mod', "        scheduleMarks(0);   // the search's own highlight follows the rows on screen, Find open or not\n", "")],
                     ['L-mk_flat-followsPage'], ['mk_flat']),
    'marksneg': ([('main', "                if (op !== 'contains' && !eq) return;\r\n", "")],
                 ['L-mk_forms-noCompare'], ['mk_forms']),
    'marksnoprint': ([('mod', "            ['pnb-find', 'pnb-find-cur', 'pnb-filter'].forEach(function (k) { if (reg.has(k)) { stash[k] = reg.get(k); reg.delete(k); } });\n", "")],
                     ['L-mk_find-printClean'], ['mk_find']),
    'marksnowatch': ([('mod', "            if (el) { markWatch.observe(el, { attributes: true, attributeFilter: ['style', 'class'], attributeOldValue: true, childList: true, subtree: true }); }\n", "")],
                     ['L-grp_marks_closed-opensMarked', 'L-piv_marks-pivLabels'], ['grp_marks_closed', 'piv_marks']),
    'marksclass': ([('mod', "        var nodes = textNodes(td), n = 0, i, r, k, low;\n", "        td.classList.add('pnb-mark-x');\n        var nodes = textNodes(td), n = 0, i, r, k, low;\n")],
                   ['L-mk_find-marksNoDom'], ['mk_find']),
    'markspriority': ([('mod', "        hl.priority = -1;   // under Find's own\n", "        hl.priority = 5;\n")],
                      ['L-mk_find-underFind'], ['mk_find']),
    # ---- round 4: one size from the start ----
    # the count only as wide as before (76px): "Searching... 40%" widens the bar
    'narrowcount': ([('css', "box-sizing: content-box; min-width: 15.5ch; padding: 0 4px;", "box-sizing: content-box; min-width: 76px; padding: 0 4px;")],
                    ['L-steady-steadyWidth', 'L-steady-steadyFits'], ['steady']),
    # the spinner out of the layout while idle (display, the old way): a read widens the bar
    'spinout': ([('css', "display: inline-block; visibility: hidden; box-sizing: border-box; width: 12px;", "display: none; box-sizing: border-box; width: 12px;"),
                 ('css', ".pnb-find-bar.pnb-find-busy .pnb-find-spin { visibility: visible; }", ".pnb-find-bar.pnb-find-busy .pnb-find-spin { display: inline-block; }")],
                ['L-steady-steadyWidth'], ['steady']),
    # Filter to N rows takes no place until it is offered / its place as wide as its padding
    'filtergone': ([('css', ".pnb-find-filter[hidden] { display: inline-block; visibility: hidden; }", ".pnb-find-filter[hidden] { display: none; }")],
                   ['L-steady-steadyWidth', 'L-steady-steadyNoFilter'], ['steady']),
    'narrowfilter': ([('css', "box-sizing: content-box; min-width: 17ch; margin: 0 2px;", "box-sizing: content-box; margin: 0 2px;")],
                     ['L-steady-steadyWidth', 'L-steady-steadyFits'], ['steady']),
    # no room for the hidden-rows line (the class never set / its rule gone / set only once the line shows)
    'noroom': ([('mod', "        if (v === 'shown' || ((v === 'flat' || v === 'grouped') && markQuery(v))) { bar.classList.add('pnb-find-room'); }\n", "")],
               ['L-steady-steadyHeight'], ['steady']),
    'roomcss': ([('css', ".pnb-find-bar.pnb-find-room .pnb-find-hides[hidden] { display: block; visibility: hidden; }", "")],
                ['L-steady-steadyHeight'], ['steady']),
    'roomlate': ([('mod', "        var v = (moreEl && !moreEl.hidden) ? 'shown' : scopeView();\n", "        var v = (moreEl && !moreEl.hidden) ? 'shown' : null;\n")],
                 ['L-steady-steadyHeight', 'L-grp_steady-gSteady'], ['steady', 'grp_steady']),
    # the grouped view's search not seen at open (the flat table's only)
    'roomflatonly': ([('mod', "        if (v === 'shown' || ((v === 'flat' || v === 'grouped') && markQuery(v))) { bar.classList.add('pnb-find-room'); }\n",
                       "        if (v === 'shown' || (v === 'flat' && markQuery(v))) { bar.classList.add('pnb-find-room'); }\n")],
                     ['L-grp_steady-gSteady'], ['grp_steady']),
    # the room kept after the bar closes (the next open, no filter on, is a line too tall)
    'roomstuck': ([('mod', "        bar.classList.remove('pnb-find-room');\n", "")],
                  ['L-steady-roomCleared'], ['steady']),
    # ---- round 5: dialogs, a comparison's group names, narrow windows ----
    # Ctrl+F never takes a dialog (the old "under a dialog: the browser's")
    'nodialog': ([('mod', "            var d = topDialog();\n            if (!d && (!activeView() || h.busy())) { return; }\n",
                   "            var d = null;\n            if (!d && (!activeView() || h.busy())) { return; }\n")],
                 ['L-dlg_find-dlgTaken'], ['dlg_find']),
    # the bar left under the dialog's layer
    'dialogbelow': ([('mod', "            bar.style.zIndex = dlg ? String(dialogZ(dlg) + 1) : '';\n", "            bar.style.zIndex = '';\n")],
                    ['L-dlg_find-dlgAbove'], ['dlg_find']),
    # a breakdown's '#' column read (its row numbers found)
    'dialognum': ([('mod', "                        if (c2 !== nc && cell.tagName === 'TD') {", "                        if (cell.tagName === 'TD') {")],
                  ['L-dlg_find-dlgNoRowNo'], ['dlg_find']),
    # Filter to N rows offered in a dialog (the report's rows, not the dialog's)
    'dialogfilter': ([('mod', "        if (scanned && (scanned.view === 'pivot' || scanned.view === 'dialog')) { return null; }\n",
                       "        if (scanned && scanned.view === 'pivot') { return null; }\n")],
                     ['L-dlg_find-dlgNoFilter'], ['dlg_find']),
    # nothing watches the dialog: a sort is not read again, its closing leaves the bar up
    'dialogwatch': ([('mod', "                    watcher.observe(dlg, { attributes: true, attributeFilter: ['style', 'class'], attributeOldValue: true, childList: true, subtree: true });\n                    if (dlg.parentNode) { watcher.observe(dlg.parentNode, { childList: true }); }\n", "")],
                    ['L-dlg_find-dlgSort', 'L-dlg_find-dlgCloses'], ['dlg_find']),
    # the signature blind to the rows' order: a sort keeps the old order of matches
    'nosortread': ([('mod', "            for (i = 0; i < rows.length; i++) { k = (Math.imul(k, 31) + rowId(rows[i])) | 0; }\n", "")],
                   ['L-dlg_find-dlgSort'], ['dlg_find']),
    # a dialog opened over Find's dialog does not end Find there
    'dialogontop': ([('mod', "        if (dlg) { return !!(dlg.isConnected && shown(dlg) && topDialog() === dlg); }\n",
                      "        if (dlg) { return !!(dlg.isConnected && shown(dlg)); }\n")],
                    ['L-dlg_ontop-otEnds'], ['dlg_ontop']),
    # a dialog with no table taken from the browser's find
    'notabletaken': ([('mod', "            if (!box || !body || !body.querySelector('table td')) { return null; }\n", "            if (!box || !body) { return null; }\n")],
                     ['L-dlg_notable-notableBrowser'], ['dlg_notable']),
    # Ctrl+F in a dialog while Find is open on the table keeps the table's matches
    'noswitch': ([('mod', "        if (isOpen && d !== dlg) { close(false); }\n        dlg = d;\n", "        dlg = d;\n")],
                 ['L-dlg_switch-swDialog'], ['dlg_switch']),
    # a comparison heading's name not found / its count read as part of it / no outline on it
    'cmplabel': ([('mod', "        for (var c = header.firstElementChild; c; c = c.nextElementSibling) {\n            if (c.tagName === 'SPAN' && !c.matches(BAND_PARTS)) { return c; }\n        }\n", "")],
                 ['L-cmp_names-cmpBand'], ['cmp_names']),
    'cmpcount': ([('mod', ".journal-pvnote-btn, .group-count, script", ".journal-pvnote-btn, script")],
                 ['L-cmp_names-cmpNoCount'], ['cmp_names']),
    'cmpoutline': ([('css', "#groupedResultsContainer .group-header > span:not(.group-name).pnb-find-cur { outline: 2px solid currentColor; outline-offset: 2px; }", "")],
                   ['L-cmp_names-cmpOutline'], ['cmp_names']),
    # no narrow layout / its line at the old phone width / past the one-row bar's own room
    'narrowgone': ([('css', "@media (max-width: 720px) {", "@media (max-width: 1px) {")],
                   ['L-narrow-nSpans', 'L-narrow_mid-nSpans'], ['narrow', 'narrow_mid']),
    'narrowphone': ([('css', "@media (max-width: 720px) {", "@media (max-width: 520px) {")],
                    ['L-narrow_mid-nSpans'], ['narrow_mid']),
    'narrowwide': ([('css', "@media (max-width: 720px) {", "@media (max-width: 800px) {")],
                   ['L-wide_edge-wOneRow'], ['wide_edge']),
}
