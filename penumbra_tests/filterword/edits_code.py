# =============================================================================
# FILTER WORDING (2026-10-19) - the phrase edits to the CODE files.
# (rel path, old, new, expected count). Each old must occur exactly `count` times
# in the file as it stands when the edit runs (edits run in this order), or
# patch.py writes nothing. Anchors are written with \n; a CRLF file gets \r\n.
# User-facing words only: ids, classes, data(search), search|, &search= stay.
# =============================================================================

ENTRIES = [
    # ---------------------------------------------------------------- index.php
    ('index.php', 'charts, search syntax, or paste errors for help.', 'charts, filter syntax, or paste errors for help.', 1),
    ('index.php', 'all string/aggregation functions, and the search box syntax.</p>', 'all string/aggregation functions, and the filter box syntax.</p>', 1),
    ('index.php', 'The link also carries your current view &mdash; search, sort, theme, density, row height, rows per page, row limit, hidden header &mdash; whenever they differ from the defaults',
                  'The link also carries your current view (filter, sort, theme, density, row height, rows per page, row limit, hidden header) whenever they differ from the defaults', 1),
    ('index.php', '<strong>Search Bar</strong><small>Show the search box above the table.</small>', '<strong>Filter Bar</strong><small>Show the filter box above the table.</small>', 1),
    ('index.php', '(the day) to search, sort, group by and export,', '(the day) to filter, sort, group by and export,', 1),
    # the scheduler's own filter box keeps its words (the user, 10-19: "they may not follow the same wording and
    # dont need correcting"), except its label: "maybe use 'Apply Filter:' instead of search filter in scheduler"
    ('index.php', 'margin-right: 15px;">Search Filter: <span class="tab-help-icon" data-target="#searchFilterHelpLightbox" title="Help: Search Filter Syntax">',
                  'margin-right: 15px;">Apply Filter: <span class="tab-help-icon" data-target="#searchFilterHelpLightbox" title="Help: Apply Filter Syntax">', 1),
    ('index.php', 'id="schedSearchBuilderIcon" class="pnb-sbox-seg pnb-sbox-sb" title="Visual Search Builder" role="button" tabindex="0" aria-label="Open the Visual Search Builder">',
                  'id="schedSearchBuilderIcon" class="pnb-sbox-seg pnb-sbox-sb" title="Visual Filter Builder" role="button" tabindex="0" aria-label="Open the Visual Filter Builder">', 1),
    # (the report box's run / clear only: the scheduler's #schedSearchPlay / #clearSchedSearch keep theirs)
    ('index.php', 'id="tableSearchPlay" title="(Enter) Run search">', 'id="tableSearchPlay" title="(Enter) Apply the filter">', 1),
    ('index.php', 'id="clearTableSearch" title="Clear search">&times;</span>', 'id="clearTableSearch" title="Clear the filter">&times;</span>', 1),
    ('index.php', 'id="searchBuilderIcon" class="pnb-sbox-seg pnb-sbox-sb" title="Visual Search Builder (/)" role="button" tabindex="0" aria-label="Open the Visual Search Builder">',
                  'id="searchBuilderIcon" class="pnb-sbox-seg pnb-sbox-sb" title="Visual Filter Builder (/)" role="button" tabindex="0" aria-label="Open the Visual Filter Builder">', 1),
    ('index.php', 'placeholder="Double click here or begin typing to search" aria-label="Search report table"',
                  'placeholder="Double click here or begin typing to filter" aria-label="Filter report table"', 1),
    ('index.php', 'role="search" aria-label="Search the report"', 'role="search" aria-label="Filter the report"', 1),
    ('index.php', 'title="(Alt+Down) Show the columns and saved searches" aria-label="Show the columns and saved searches"',
                  'title="(Alt+Down) Show the columns and saved filters" aria-label="Show the columns and saved filters"', 1),
    ('index.php', '<h3>No rows match your search</h3>', '<h3>No rows match your filter</h3>', 1),
    ('index.php', 'Uses the same syntax as the main Search bar - e.g.', 'Uses the same syntax as the main filter box - e.g.', 1),
    ('index.php', 'title="Close this dialog and open the Visual Search Builder" style="color: var(--brand-text, var(--brand-primary)); text-decoration: underline;">Visual Search Builder</a>',
                  'title="Close this dialog and open the Visual Filter Builder" style="color: var(--brand-text, var(--brand-primary)); text-decoration: underline;">Visual Filter Builder</a>', 3),
    ('index.php', 'Tip: with a summary set, the search bar can filter whole groups by it &mdash; for example',
                  'Tip: with a summary set, the filter box can keep or drop whole groups by it, for example', 1),
    ('index.php', 'pivot and group layouts, visualizations, searches, and the copy/download templates.', 'pivot and group layouts, visualizations, filters, and the copy/download templates.', 1),
    ('index.php', '<h3 style="margin-top: 0;">Search Filter Mismatch</h3>', '<h3 style="margin-top: 0;">Filter Mismatch</h3>', 1),
    ('index.php', 'The selected snapshot was captured with a different search filter than your current view.', 'The selected snapshot was captured with a different filter than your current view.', 1),
    ('index.php', 'narrow them first: the Visual Search Builder, <code># 1-200</code> in the search box for the first 200 rows,',
                  'narrow them first: the Visual Filter Builder, <code># 1-200</code> in the filter box for the first 200 rows,', 1),

    # ---------------------------------------------------------------- js/main.js
    ('js/main.js', "push('Search filter', ctx.search || '(none)');", "push('Filter', ctx.search || '(none)');", 1),
    ('js/main.js', "report's current settings (search, sort, columns and prompt answers)", "report's current settings (filter, sort, columns and prompt answers)", 1),
    ('js/main.js', "if (q) bits.push('Search: ' + q);", "if (q) bits.push('Filter: ' + q);", 1),
    ('js/main.js', r'''The search box holds an \"or\" query, so a column filter cannot be added to it. Clear the search first.''',
                   r'''The filter box holds an \"or\" query, so a column filter cannot be added to it. Clear the filter first.''', 3),
    ('js/main.js', r'''The search box holds an \"or\" query, so a filter cannot be added to it. Clear the search first.''',
                   r'''The filter box holds an \"or\" query, so a condition cannot be added to it. Clear the filter first.''', 1),
    ('js/main.js', r'''The search box holds an \"or\" query, so " + kind + " cannot add or remove one condition. Clear the search first.''',
                   r'''The filter box holds an \"or\" query, so " + kind + " cannot add or remove one condition. Clear the filter first.''', 1),
    ('js/main.js', "an or cannot be combined with the rest of the search: ", "an or cannot be combined with the rest of the filter: ", 1),
    ('js/main.js', "return 'Search for: ' + (cmd.split('|')[1] || '(clear)');", "return 'Filter: ' + (cmd.split('|')[1] || '(clear)');", 1),
    ('js/main.js', r'''into the table\'s search bar so the table below hides the same rows the charts are hiding. The search bar flashes red so you know it was installed; clear it from the × in the search bar.''',
                   r'''into the table\'s filter box so the table below hides the same rows the charts are hiding. The filter box flashes red so you know it was installed; clear it from the × in the filter box.''', 1),
    ('js/main.js', 'includes the current prompt answers and search filter"', 'includes the current prompt answers and filter"', 2),
    ('js/main.js', "leaving the pivot view can't be undone. Search from the pivot instead.", "leaving the pivot view can't be undone. Filter from the pivot instead.", 1),
    ('js/main.js', "ERROR:</span> That search couldn't be applied to the comparison. ", "ERROR:</span> That filter couldn't be applied to the comparison. ", 1),
    ('js/main.js', "? 'Clear the search box to see all ' + total.toLocaleString() + ' rows again, or adjust your filter.'",
                   "? 'Clear the filter to see all ' + total.toLocaleString() + ' rows again, or adjust it.'", 1),
    ('js/main.js', ": 'Clear the search box or adjust your filter.'", ": 'Clear the filter or adjust it.'", 1),
    ('js/main.js', 'visualizations, searches and templates.', 'visualizations, filters and templates.', 2),
    ('js/main.js', ' Include current search filter: <code>', ' Include current filter: <code>', 1),
    ('js/main.js', "lines.push('Search filter included.');", "lines.push('Filter included.');", 1),
    ('js/main.js', "label: 'search filter' });", "label: 'filter' });", 1),
    ('js/main.js', '&#128269; Search filter: ${escapeHtml(searchVal)}</p>`', '&#128269; Filter: ${escapeHtml(searchVal)}</p>`', 1),
    ('js/main.js', "'Press <strong>/</strong> anywhere to jump straight to the search box.',", "'Press <strong>/</strong> anywhere to jump straight to the filter box.',", 1),
    ('js/main.js', "'Wrap a search in double slashes &mdash; <strong>//like this//</strong> &mdash; for exact matching.',",
                   "'Wrap a filter value in double slashes, <strong>//like this//</strong>, for exact matching.',", 1),
    ('js/main.js', "'Click the magnifying-glass icon in the search bar to build complex searches visually.',",
                   "'Click the magnifying-glass icon in the filter box to build complex filters visually.',", 1),
    ('js/main.js', 'rows will appear in the email body - your search/filter hides some rows,', 'rows will appear in the email body - your filter hides some rows,', 1),
    ('js/main.js', 'only the rows your current search/filter is showing are sent.', 'only the rows your current filter is showing are sent.', 1),
    ('js/main.js', 'The email will contain no rows - nothing matches the current search/filter.', 'The email will contain no rows - nothing matches the current filter.', 1),
    ('js/main.js', "carried.push('your search filter');", "carried.push('your filter');", 1),
    ('js/main.js', "blockRow(['Search filter: ' + by.search.content]", "blockRow(['Filter: ' + by.search.content]", 1),
    ('js/main.js', 'showing ${totalOriginalRows.toLocaleString()} search results in', 'showing ${totalOriginalRows.toLocaleString()} filtered results in', 1),
    # ...and the Rows card reads that count text back: accept the new word (and the old one)
    ('js/main.js', r"var gm = /with ([\d,]+) filtered results|showing ([\d,]+) search results/.exec(rc);",
                   r"var gm = /with ([\d,]+) filtered results|showing ([\d,]+) (?:filtered|search) results/.exec(rc);", 1),
    ('js/main.js', "rest: 'Type / to search, or double-click for suggestions',", "rest: 'Type / to filter, or double-click for suggestions',", 1),
    ('js/main.js', "restKeysOff: 'Double click here or begin typing to search',", "restKeysOff: 'Double click here or begin typing to filter',", 1),
    ('js/main.js', "focus: 'Type to search, or press / for the Visual Search Builder'", "focus: 'Type to filter, or press / for the Visual Filter Builder'", 1),
    ('js/main.js', "'/': { label: 'Jump to the table search (the filter box on the home screen)' },", "'/': { label: 'Jump to the filter box' },", 1),
    ('js/main.js', "'x': { label: 'Clear the table search',", "'x': { label: 'Clear the filter',", 1),
    ('js/main.js', "$warn.html('⚠ Search filter differs — snapshot: \"'", "$warn.html('⚠ Filter differs - snapshot: \"'", 1),
    ('js/main.js', "if (built.search) bits.push('the search filter');", "if (built.search) bits.push('the filter');", 1),
    ('js/main.js', '- the current search matches nothing on either side. Clear or widen the search to see the comparison.',
                   '- the current filter matches nothing on either side. Clear or widen the filter to see the comparison.', 1),
    ('js/main.js', 'title="Hide this group (adds a filter to the search bar)"', 'title="Hide this group (adds a condition to the filter box)"', 2),
    ('js/main.js', "viz: 'Visualization',\n        search: 'Search',", "viz: 'Visualization',\n        search: 'Filter',", 1),
    ('js/main.js', "seg.title = 'Marked rows among those the search shows';", "seg.title = 'Marked rows among those the filter keeps';", 1),
    ('js/main.js', " rows (max 5000). Narrow the view with a search first.'", " rows (max 5000). Narrow the view with a filter first.'", 2),
    ('js/main.js', "' in this group' : ' the search shows';", "' in this group' : ' the filter keeps';", 2),
    ('js/main.js', 'That row is hidden by the current search. Clear the search to jump to it.', 'That row is hidden by the current filter. Clear the filter to jump to it.', 1),
    ('js/main.js', 'That group is hidden by the current search. Clear the search to jump to it.', 'That group is hidden by the current filter. Clear the filter to jump to it.', 1),
    ('js/main.js', "Couldn&rsquo;t find that row in this pivot: a filter or search may leave it out.", "Couldn&rsquo;t find that row in this pivot: the filter may leave it out.", 1),
    ('js/main.js', "<strong>rename this toggle</strong>. Searches, snippet conditions and scheduled-task filters using that name",
                   "<strong>rename this toggle</strong>. The filter box, snippet conditions and scheduled-task filters using that name", 1),
    ('js/main.js', 'While they share it, searches such as Notes = empty read the toggle', 'While they share it, filters such as Notes = empty read the toggle', 1),
    ('js/main.js', "before it was renamed. Searches, snippets and scheduled tasks that say", "before it was renamed. Filters, snippets and scheduled tasks that say", 1),
    ('js/main.js', "keeps = 'Searches, snippets, buttons and scheduled tasks that say <strong>'", "keeps = 'Filters, snippets, buttons and scheduled tasks that say <strong>'", 1),
    ('js/main.js', "pivot: 'View this report for the interactive pivot view with sorting and search.',", "pivot: 'View this report for the interactive pivot view with sorting and filtering.',", 1),
    ('js/main.js', "if (text) steps.push({ cls: 'search', kw: 'Search', code: text, part: -1, xLabel: 'Clear the search' });",
                   "if (text) steps.push({ cls: 'search', kw: 'Filter', code: text, part: -1, xLabel: 'Clear the filter' });", 1),
    ('js/main.js', "kw: i ? 'and' : ('Search' + (P.prefix ? ' ' + P.prefix.trim() : ''))", "kw: i ? 'and' : ('Filter' + (P.prefix ? ' ' + P.prefix.trim() : ''))", 1),
    ('js/main.js', "xLabel: multi ? 'Remove “' + P.parts[i] + '” from the search' : 'Clear the search' });",
                   "xLabel: multi ? 'Remove “' + P.parts[i] + '” from the filter' : 'Clear the filter' });", 1),
    ('js/main.js', "kw: 'Search', code: text, n: visible, drop: (visible !== null) ? all - visible : null,\n                        part: -1, xLabel: 'Clear the search' });",
                   "kw: 'Filter', code: text, n: visible, drop: (visible !== null) ? all - visible : null,\n                        part: -1, xLabel: 'Clear the filter' });", 1),
    ('js/main.js', 'id="sbRfClear">Clear the whole search</button>', 'id="sbRfClear">Clear the whole filter</button>', 1),

    # ---------------------------------------------------------------- js/search_builder.js
    ('js/search_builder.js', "return { name: '(URL search)',", "return { name: '(URL filter)',", 1),
    ('js/search_builder.js', "saveLabel: 'Save current search…',", "saveLabel: 'Save current filter…',", 1),
    ('js/search_builder.js', "shareLabel: 'Share current search…'", "shareLabel: 'Share current filter…'", 1),
    ('js/search_builder.js', "var promptMsg = 'This search is empty or incomplete.", "var promptMsg = 'This filter is empty or incomplete.", 1),
    ('js/search_builder.js', "'Do you mean to clear the existing search query?';", "'Do you mean to clear the existing filter?';", 1),
    ('js/search_builder.js', r'''), so it searches the pivot\'s ' + _shared[0].label + '. Tick to search the ' + _shared[0].column + ' column\'s source rows instead.''',
                             r'''), so it filters on the pivot\'s ' + _shared[0].label + '. Tick to filter on the ' + _shared[0].column + ' column\'s source rows instead.''', 1),
    ('js/search_builder.js', r''' are also names of pivot aggregates, so they search the pivot. Tick to search those columns\' source rows instead.''',
                             r''' are also names of pivot aggregates, so they filter on the pivot. Tick to filter on those columns\' source rows instead.''', 1),
    ('js/search_builder.js', "$('#sbSubmitBtn').text('Search').attr('title', 'Apply this search to the table');", "$('#sbSubmitBtn').text('Filter').attr('title', 'Apply this filter to the table');", 1),
    ('js/search_builder.js', "'preset':    'Saved Searches',", "'preset':    'Saved Filters',", 1),

    # ---------------------------------------------------------------- search_builder_content.php
    ('search_builder_content.php', '<h3 class="pnb-dlg-title">Visual Search Builder <span class="tab-help-icon" data-target="#searchHelpLightbox" data-jump-to="search-builder" title="Help: Visual Search Builder">?</span></h3>',
                                   '<h3 class="pnb-dlg-title">Visual Filter Builder <span class="tab-help-icon" data-target="#searchHelpLightbox" data-jump-to="search-builder" title="Help: Visual Filter Builder">?</span></h3>', 1),
    ('search_builder_content.php', 'Tip: Type the preset name in the search bar to run it. Double-clicking the search bar also works.',
                                   'Tip: Type the preset name in the filter box to run it. Double-clicking the filter box also works.', 1),
    ('search_builder_content.php', "a column that shares its name with a pivot aggregate searches the column's source rows instead of the pivot",
                                   "a column that shares its name with a pivot aggregate filters on the column's source rows instead of the pivot", 1),
    ('search_builder_content.php', '<input type="checkbox" id="sbSrcRowsCheck"> Search source rows <span', '<input type="checkbox" id="sbSrcRowsCheck"> Filter source rows <span', 1),
    ('search_builder_content.php', 'title="Add another search condition">', 'title="Add another condition">', 1),
    ('search_builder_content.php', '<label class="sb-preview-label">Generated Search Query<span', '<label class="sb-preview-label">Generated Filter<span', 1),
    ('search_builder_content.php', 'title="Apply this search to the table">Search</button>', 'title="Apply this filter to the table">Filter</button>', 1),

    # ---------------------------------------------------------------- js/penumbra_find.js (Find's words for the FILTER)
    ('js/penumbra_find.js', "' your search hides');", "' your filter hides');", 1),
    ('js/penumbra_find.js', "filterBtn.title = (promo.add ? 'Add to the search: ' : 'Search for ') + promo.q + ' (Alt+Enter)';",
                            "filterBtn.title = (promo.add ? 'Add to the filter: ' : 'Filter for ') + promo.q + ' (Alt+Enter)';", 1),
    ('js/penumbra_find.js', "'The search box filters instead: it keeps only the rows that match. ' +", "'The filter box is different: it keeps only the rows that match. ' +", 1),
    ('js/penumbra_find.js', "'Filter to N rows turns what you found into that search. Esc closes;", "'Filter to N rows turns what you found into that filter. Esc closes;", 1),

    # ---------------------------------------------------------------- js/penumbra_colmenu.js
    ('js/penumbra_colmenu.js', "{ heading: 'Over the rows the search keeps' }", "{ heading: 'Over the rows the filter keeps' }", 2),
    ('js/penumbra_colmenu.js', "(p.rows === 1 ? ' row' : ' rows') + ' the search keeps' });", "(p.rows === 1 ? ' row' : ' rows') + ' the filter keeps' });", 1),
    ('js/penumbra_colmenu.js', """'The search holds an "or" query, so a column filter cannot be added to it. Clear the search first.'""",
                               """'The filter box holds an "or" query, so a column filter cannot be added to it. Clear the filter first.'""", 1),

    # ---------------------------------------------------------------- js/penumbra_grouplist.js
    ('js/penumbra_grouplist.js', "e.textContent = 'No group matches the search.';", "e.textContent = 'No group matches the filter.';", 1),

    # ---------------------------------------------------------------- js/penumbra_tiles.js
    ('js/penumbra_tiles.js', "title: 'The full live report page, framed - its own search, sorting and rendering' }", "title: 'The full live report page, framed - its own filter box, sorting and rendering' }", 1),
    ('js/penumbra_tiles.js', """: 'The search box holds an "or" query. Clear it to use these filters.';""", """: 'The filter box holds an "or" query. Clear it to use these filters.';""", 1),

    # ---------------------------------------------------------------- js/penumbra_bulkset.js (the View Options name)
    ('js/penumbra_bulkset.js', "label: 'Search bar',", "label: 'Filter bar',", 1),

    # ---------------------------------------------------------------- js/penumbra_dashboard.js: only where it names the BUILDER
    # (one shared dialog, now titled Visual Filter Builder). The dashboard's own filter box, its Search help
    # button and panel, its default-filter hint and the embedded tile's Search filter field keep their words
    # (the user, 10-19: the other filter boxes "may not follow the same wording and dont need correcting").
    ('js/penumbra_dashboard.js', 'title="Visual Search Builder: compose the filter from conditions', 'title="Visual Filter Builder: compose the filter from conditions', 1),
    ('js/penumbra_dashboard.js', 'aria-label="Open the Visual Search Builder"><svg', 'aria-label="Open the Visual Filter Builder"><svg', 1),
    ('js/penumbra_dashboard.js', "or press / for the Visual Search Builder');", "or press / for the Visual Filter Builder');", 1),
    ('js/penumbra_dashboard.js', "var msg = 'The Visual Search Builder could not be loaded;", "var msg = 'The Visual Filter Builder could not be loaded;", 1),

    # ---------------------------------------------------------------- schedule_runner.php (the scheduled email's words; twins of main.js)
    ('schedule_runner.php', '? "View this report for the interactive pivot view with sorting and search."', '? "View this report for the interactive pivot view with sorting and filtering."', 1),
    ('schedule_runner.php', '$linkText = "View this report for the interactive pivot view with sorting and search.";', '$linkText = "View this report for the interactive pivot view with sorting and filtering.";', 1),
    ('schedule_runner.php', '&#128269; Search filter: " . $', '&#128269; Filter: " . $', 3),

    # ---------------------------------------------------------------- manage_journal.php (twins of main.js's bulk messages)
    ('manage_journal.php', '). Narrow the view with a search first.', '). Narrow the view with a filter first.', 2),

    # ---------------------------------------------------------------- help/manifest.php (the topic's title; the old words stay findable)
    ('help/manifest.php', "array('id' => 'searchHelpLightbox', 'title' => 'Advanced Search',", "array('id' => 'searchHelpLightbox', 'title' => 'Filtering the Table',", 1),
    ('help/manifest.php', "'keywords' => 'search filter query find syntax field operators regex wildcard visual builder'),",
                          "'keywords' => 'filter box filtering search box search bar advanced search filter query find syntax field operators regex wildcard visual builder visual filter builder visual search builder'),", 1),
    ('help/manifest.php', 'search all tiles visual search builder build filter conditions', 'search all tiles visual filter builder visual search builder build filter conditions', 1),
    # the scheduler's field is labelled "Apply Filter" now: findable by that name too
    ('help/manifest.php', ". 'search filter per-recipient scheduled syntax", ". 'apply filter search filter per-recipient scheduled syntax", 1),

    # ---------------------------------------------------------------- help/snippets.php (the Custom Code reference's registry: developer
    # docs keep the API's word, "search"; the box gets its new name beside it. Then REGENERATE help/topics/optionsHelpLightbox.php
    # with penumbra_tests\helpv2\gen_snippets_help.php --app <stage> (lint L17) - never hunk the generated file.)
    ('help/snippets.php', 'the number updates live as the user types in the search bar. Pass', 'the number updates live as the user types in the search bar (the filter box). Pass', 1),
    ('help/snippets.php', '>Current value in the search filter box (default if no type given)</td>', '>Current value in the filter box (default if no type given)</td>', 1),
    ('help/snippets.php', "'meaning' => 'A link that puts VALUE in the search box and filters the table; an empty value clears it.'",
                          "'meaning' => 'A link that puts VALUE in the search box (the filter box) and filters the table; an empty value clears it.'", 1),
    ('help/snippets.php', 'Same syntax as the table search bar (<code>=</code>', 'Same syntax as the filter box above the table (<code>=</code>', 1),
    ('help/snippets.php', '<code>search|</code> replaces everything in the search box, so a switch', '<code>search|</code> replaces everything in the search box (the filter box), so a switch', 1),
    # the labels the app itself now shows (main.js: the header block's "Filter:", the feedback context's "Filter")
    ('help/snippets.php', 'the report header block (title, by-line, timestamp, row count, search filter, prompts, snippet, charts)',
                          'the report header block (title, by-line, timestamp, row count, filter, prompts, snippet, charts)', 1),
    ('help/snippets.php', '<li><strong>Search filter</strong> and <strong>sort order</strong> - reported even when', '<li><strong>Filter</strong> and <strong>sort order</strong> - reported even when', 1),
]
