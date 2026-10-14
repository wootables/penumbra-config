# Copy as HTML copies every page (2026-09-30), loaded by ch_patch.py. main.js and
# help_content.php texts go through crlf(); README.md is LF (raw strings: it holds
# backslashed paths).

# --- main.js ---------------------------------------------------------------------

edit('js/main.js', 'allpages-layout-helper', crlf(r'''    $(document).on('click', '#viewLastPageLink', function (e) {
        e.preventDefault();
        $('#lastPageBtn').click();
    });

    /**
 * Gathers data for Export (Clipboard or Download).
'''), crlf(r'''    $(document).on('click', '#viewLastPageLink', function (e) {
        e.preventDefault();
        $('#lastPageBtn').click();
    });

    // Copy as HTML over EVERY page of the flat table (2026-09-30), as Rows = All
    // shows it. generateWysiwygHtml copies what the table LOOKS like - it skips
    // display:none rows and copies computed styles - and pagination leaves every
    // other page display:none, striped from whenever it was last on screen, with
    // the tfoot showing its "View Last Page" link in place of the totals. This
    // stripes the rows as Rows = All would and swaps the link row for the totals
    // row; generateWysiwygHtml then reads the other pages' rows WHERE THEY ARE
    // (opts.offPageRows), still display:none - never shown. restore() puts back
    // every class and style attribute this changed, as they were - not
    // re-derived: Rows = None, for one, leaves its rows unstriped. One task from
    // start to finish, so nothing paints in between. format() / rewrite() /
    // heatmap() need no pass here: they already cover off-page rows (see the
    // scope note in applyConditionalFormatting).
    function _pnbAllPagesLayout() {
        const table = document.getElementById('resultsTable');
        const saved = [];   // [element, attribute, value] - put back in reverse
        const keep = (el, attr) => { saved.push([el, attr, el.getAttribute(attr)]); };
        if (table) {
            // applyZebraStriping's rule over the Rows = All layout: there every
            // row without .search-hidden is displayed, and the rest keep theirs.
            for (let b = 0; b < table.tBodies.length; b++) {
                const rows = table.tBodies[b].children;
                let k = 0;
                for (let i = 0; i < rows.length; i++) {
                    const r = rows[i];
                    if (r.style.display === 'none' && r.classList.contains('search-hidden')) continue;
                    keep(r, 'class');
                    r.classList.remove('zebra-light', 'zebra-dark');
                    r.classList.add(k % 2 === 0 ? 'zebra-light' : 'zebra-dark');
                    k++;
                }
            }
            if (table.tFoot) {
                $(table.tFoot).find('tr.total-row-data, tr.total-row-link').each(function () {
                    keep(this, 'style');
                    $(this).toggle($(this).hasClass('total-row-data'));
                });
            }
        }
        return {
            restore: function () {
                for (let i = saved.length - 1; i >= 0; i--) {
                    const s = saved[i];
                    if (s[2] === null) s[0].removeAttribute(s[1]);
                    else s[0].setAttribute(s[1], s[2]);
                }
            }
        };
    }

    /**
 * Gathers data for Export (Clipboard or Download).
'''))

edit('js/main.js', 'getexport-html-allpages', crlf(r'''            if (isPivotMode) {
                htmlContent = generateWysiwygHtml($('#pivotResultTable'), false);
                rowCount = penumbraPivotBodyRowCount();
            } else if (isGrouped) {
                htmlContent = generateWysiwygHtml($('#groupedResultsContainer'), true);
                rowCount = $('#groupedResultsContainer tbody tr:not(.search-hidden):not(.journal-note-child)').length;
            } else {
                htmlContent = generateWysiwygHtml($('#resultsTable'), false);
                rowCount = $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)").length;
            }
'''), crlf(r'''            // opts come from Copy as HTML (allPages, budget, notice - see its
            // handler). The email embed passes none: it carries the page on screen.
            if (isPivotMode) {
                htmlContent = generateWysiwygHtml($('#pivotResultTable'), false, opts);
                rowCount = penumbraPivotBodyRowCount();
            } else if (isGrouped) {
                htmlContent = generateWysiwygHtml($('#groupedResultsContainer'), true, opts);
                rowCount = $('#groupedResultsContainer tbody tr:not(.search-hidden):not(.journal-note-child)').length;
            } else if (opts.allPages) {
                // EVERY page, laid out as Rows = All shows it (2026-09-30).
                const _lay = _pnbAllPagesLayout();
                try {
                    htmlContent = generateWysiwygHtml($('#resultsTable'), false, $.extend({}, opts, { offPageRows: true }));
                } finally {
                    _lay.restore();
                }
                rowCount = $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)").length;
            } else {
                htmlContent = generateWysiwygHtml($('#resultsTable'), false);
                rowCount = $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)").length;
            }
'''))

edit('js/main.js', 'copy-cap-constant', crlf(r'''    var PENUMBRA_WYSIWYG_BYTES_PER_ROW = 3000;
'''), crlf(r'''    var PENUMBRA_WYSIWYG_BYTES_PER_ROW = 3000;
    // Copy as HTML stops after this many bytes of rows (2026-09-30, 50 MB chosen
    // by the product owner). It copies every page, and every cell carries its
    // computed styles inline (~470 bytes a cell), so an uncapped copy of a big
    // report ties the page up and hands the clipboard HTML no paste target can
    // take. Measured: 5,000 rows x 20 columns (45 MB) copy whole in ~7 s; 10,000
    // x 83 stop at ~1,500 rows after ~9 s. The copy ends with a note, and the
    // toast points to Copy as TSV / CSV for every row.
    var PENUMBRA_COPY_HTML_MAX_BYTES = 50 * 1024 * 1024;
'''))

edit('js/main.js', 'wysiwyg-opts-signature', crlf(r'''    function generateWysiwygHtml($sourceContainer, isGroupedMode = false) {
        // Create a temporary wrapper to hold our clone
'''), crlf(r'''    // opts (2026-09-30, Copy as HTML): budget - a byte cap for this build, in
    // place of the email's setWysiwygBudget(); notice: 'copy' - the wording of
    // the note at the cut; offPageRows - the flat table's other pages are copied
    // too, as Rows = All shows them (getExportData lays them out first with
    // _pnbAllPagesLayout).
    function generateWysiwygHtml($sourceContainer, isGroupedMode = false, opts) {
        opts = opts || {};
        const _wyBudget = (typeof opts.budget === 'number' && opts.budget > 0) ? opts.budget : _wysiwygBudget;
        // Create a temporary wrapper to hold our clone
'''))

edit('js/main.js', 'wysiwyg-budget-use', crlf(r'''            if (_wysiwygBudget > 0) {
                const _rowBytes = ($trClone[0] && $trClone[0].outerHTML)
                    ? $trClone[0].outerHTML.length : 0;
                if (_wyBytes + _rowBytes > _wysiwygBudget) { _wyTruncated = true; return; }
'''), crlf(r'''            if (_wyBudget > 0) {
                const _rowBytes = ($trClone[0] && $trClone[0].outerHTML)
                    ? $trClone[0].outerHTML.length : 0;
                if (_wyBytes + _rowBytes > _wyBudget) { _wyTruncated = true; return; }
'''))

edit('js/main.js', 'wysiwyg-flat-offpage', crlf(r'''                $srcTable.find(rowSelector).each(function () {
                    processRow($(this), $tbodyClone);
                });
'''), crlf(r'''                $srcTable.find(rowSelector).each(function () {
                    // Another page's row (opts.offPageRows - Copy as HTML over every
                    // page; the selector already drops search-hidden rows).
                    processRow($(this), $tbodyClone, !!opts.offPageRows && this.style.display === 'none');
                });
'''))

edit('js/main.js', 'wysiwyg-processrow-offpage', crlf(r'''        const processRow = ($srcRow, $destTbody) => {
            // Skip hidden rows (includes collapsed detail rows and hidden summary rows).
            // Visible summary rows (shown when a group is collapsed) ARE included so the
            // exported HTML matches the on-screen WYSIWYG layout.
            if ($srcRow.css('display') === 'none') return;
            _wyTotal++;
            // Once over budget keep COUNTING but stop building: the notice needs
            // the true total, and the caller needs to know how many were cut.
            if (_wyTruncated) return;

            const $trClone = $('<tr>');
            copyStyles($srcRow, $trClone);
'''), crlf(r'''        const processRow = ($srcRow, $destTbody, offPage) => {
            // Skip hidden rows (includes collapsed detail rows and hidden summary rows).
            // Visible summary rows (shown when a group is collapsed) ARE included so the
            // exported HTML matches the on-screen WYSIWYG layout.
            // offPage (2026-09-30): a flat row another PAGE hides, copied as it looks
            // once shown - and read right where it is, display:none. Showing each one
            // for its read cost ~4 style recalcs of the whole table per row: 1,172 rows
            // of a 5,000-row report took 4,800 recalcs and 40-56 s, 751 rows x 83
            // columns 37 s. Read in place the copy needs 1-4 recalcs (~1.5 s).
            if (!offPage && $srcRow.css('display') === 'none') return;
            _wyTotal++;
            // Once over budget keep COUNTING but stop building: the notice needs
            // the true total, and the caller needs to know how many were cut.
            if (_wyTruncated) return;

            const $trClone = $('<tr>');
            copyStyles($srcRow, $trClone);
            if (offPage) $trClone[0].style.display = 'table-row';   // what it computes once shown
'''))

edit('js/main.js', 'wysiwyg-copy-notice', crlf(r'''                }).text('Showing ' + _wyShown.toLocaleString() + ' of ' +
                        _wyTotal.toLocaleString() + ' rows — ' +
                        _omitted.toLocaleString() + ' row' + (_omitted === 1 ? '' : 's') +
                        ' omitted to keep this email under the size limit. ' +
                        'Open the report for the full data, or attach it instead.')
'''), crlf(r'''                }).text(opts.notice === 'copy'
                    ? ('Showing ' + _wyShown.toLocaleString() + ' of ' +
                       _wyTotal.toLocaleString() + ' rows - ' +
                       _omitted.toLocaleString() + (_omitted === 1 ? ' row was' : ' rows were') +
                       ' left out to keep this copy under the size limit.')
                    : ('Showing ' + _wyShown.toLocaleString() + ' of ' +
                       _wyTotal.toLocaleString() + ' rows — ' +
                       _omitted.toLocaleString() + ' row' + (_omitted === 1 ? '' : 's') +
                       ' omitted to keep this email under the size limit. ' +
                       'Open the report for the full data, or attach it instead.'))
'''))

edit('js/main.js', 'copy-handler-html', crlf(r'''            case 'html':
                // --- SIMPLIFIED: Use the shared getExportData logic for true WYSIWYG ---
                const exportData = getExportData('html');
                const htmlToCopy = exportData.content;
                const htmlRowCount = exportData.rowCount;
'''), crlf(r'''            case 'html':
                // --- SIMPLIFIED: Use the shared getExportData logic for true WYSIWYG ---
                // EVERY page (2026-09-30), like Copy as CSV / TSV / JSON - it used to
                // carry only the page on screen. Capped by size (see
                // PENUMBRA_COPY_HTML_MAX_BYTES); the email embed stays one page.
                const exportData = getExportData('html', { allPages: true, budget: PENUMBRA_COPY_HTML_MAX_BYTES, notice: 'copy' });
                const htmlToCopy = exportData.content;
                const htmlRowCount = exportData.rowCount;
                const htmlRun = lastWysiwygRun();
'''))

edit('js/main.js', 'copy-handler-toast', crlf(r'''                    navigator.clipboard.write([item]).then(() => {
                        show_text(`<p id='undo_text'><span style='color: lightgreen'>SUCCESS:</span> Copied table to clipboard.</p>`);
                    }
'''), crlf(r'''                    navigator.clipboard.write([item]).then(() => {
                        if (htmlRun.truncated) {
                            show_text(`<p id='undo_text'><span style='color: orange'>NOTICE:</span> Copied ${htmlRun.rowsShown.toLocaleString()} of ${htmlRun.rowsTotal.toLocaleString()} rows as HTML - the whole table is too large to copy with its formatting. Copy as TSV or CSV takes every row.</p>`);
                        } else {
                            show_text(`<p id='undo_text'><span style='color: lightgreen'>SUCCESS:</span> Copied table to clipboard.</p>`);
                        }
                    }
'''))

# --- help_content.php ------------------------------------------------------------

edit('help_content.php', 'help-copy-html-pages', crlf(r'''group headers, subtotals, and pivot crosstabs all come across as a formatted table.</p>
        </div>
        <p style="font-size: 11px; margin-bottom: 18px;"><strong>Tip:</strong> the clipboard receives HTML only'''), crlf(r'''group headers, subtotals, and pivot crosstabs all come across as a formatted table.</p>
            <p style="margin: 6px 0 0; font-size: 11px;">It copies <strong>every row your search keeps</strong> - all pages, not just the one on screen, the same rows as CSV and TSV (a collapsed group still comes across as its header). A very large table is cut off to keep the copy small enough to paste, and ends with a note saying how many rows were left out - Copy as TSV or CSV takes every row.</p>
        </div>
        <p style="font-size: 11px; margin-bottom: 18px;"><strong>Tip:</strong> the clipboard receives HTML only'''))

# --- README.md -------------------------------------------------------------------

edit('README.md', 'readme-copyhtml-suite', r'''py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\jsongroup\run.py --mutants
```
''', r'''py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\jsongroup\run.py --mutants

# Copy as HTML copies every page (2026-09-30): it used to carry only the page on screen, while
# CSV / TSV / JSON copy every search-visible row. Browser only: the REAL main.js on the hiddencols
# fixture (300 rows, 200 per page, a totals row, @@HTML links) through the Copy dialog's own
# button. The ORACLE is the old one-page copy taken with Rows = All: the new copy must equal it
# byte for byte from page 1, page 2, 25 per page, after a search, with format() / heatmap() /
# rewrite() rules, with Rows = None and Rows = All; R-* the page is put back exactly (every row's
# display, the stripes, the tfoot, the page label); M-email the email embed still carries ONE
# page, identical to the build before the change; C-* the size cap (a build with a 40,000-byte
# cap): the note and its counts, a prefix of the full copy, the toast; L-* the copy costs at
# most 10 style recalcs however many rows it reads (the browser's RecalcStyleCount over CDP -
# showing each row to read it was ~4 recalcs a row, quadratic). Needs the build BEFORE the
# change as --baseline (default: the newest
# js\main.js.bak-*-copyhtml). Measured 2026-09-30 on the stage: 60/0; --control (the old build
# as the candidate) 45/15, exactly the O-/N- asserts of the six multi-page scenarios plus
# C-note, C-prefix and C-toast (it pasted one page, and from any page but the last a dead "View
# Last Page" link row in place of the totals); --mutants: every step of the layout bites, and
# eq-forward (restore order) is redundant by design.
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\copyhtml\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\copyhtml\run.py --mutants
```
''')

edit('README.md', 'readme-copyhtml-landmine', r'''  `&lazycells=off`. Suite `hiddencols`.
''', r'''  `&lazycells=off`. Suite `hiddencols`.
- **Copy as HTML copies EVERY page; the email embed copies ONE (2026-09-30).** generateWysiwygHtml
  copies what the table LOOKS like: it skips display:none rows and inlines each cell's computed
  styles, and pagination leaves every other page display:none. The Copy dialog calls
  `getExportData('html', { allPages, budget, notice })`: `_pnbAllPagesLayout()` stripes the flat
  table as Rows = All would and swaps the "View Last Page" link row for the totals row, then
  generateWysiwygHtml (`opts.offPageRows`) reads each other-page row WHERE IT IS, display:none,
  and `restore()` puts back the saved class / style attributes (never re-derived: Rows = None is
  unstriped). format() / rewrite() / heatmap() already cover off-page rows. **Never show rows to
  read their computed styles:** each shown row cost ~4 style recalcs of the WHOLE table (~8-10 ms
  each on 5,000 rows) - quadratic: 1,172 rows took 4,800 recalcs and 40-56 s, 751 rows x 83
  columns 37 s. It was never layout (CDP LayoutCount stayed at 1). getComputedStyle on a
  display:none row computes just that element's style; read in place the copy needs 1-4 recalcs
  (~1.5 s). The copy stops at
  `PENUMBRA_COPY_HTML_MAX_BYTES` (50 MB: 5,000 x 20 copies whole in ~7 s, 10,000 x 83 stops near
  1,500 rows after ~9 s) with a note in the HTML and an orange toast. The email path passes
  no opts: one page, its own setWysiwygBudget() budget and wording. Suite `copyhtml` (its L-*
  asserts read the browser's RecalcStyleCount around the copy).
''')
