# Lazy rows (2026-09-30), loaded by lr_patch.py. main.js texts go through crlf();
# README.md is LF (raw strings: it holds backslashed paths).

# --- the build ------------------------------------------------------------------------

edit('js/main.js', 'lr-build-eager', crlf(r'''                        if (penumbraBigRenderNotice(data.length, finalColumnOrder.length, _lazyHiddenCount)) {
                            await penumbraYieldToPaint();
                        }
                        // Now, build the table body using the DocumentFragment
                        data.forEach((rowData, rowIndex) => {
                            const tr = document.createElement('tr');
'''), crlf(r'''                        // Lazy ROWS (2026-09-30): only the first page's rows - the first
                        // max(200, rows per page) the on-load filter keeps - are built in
                        // full. Every other row gets its <tr> and '#' cell (the row list,
                        // search state, sort order and the snippet engine all live there)
                        // and EMPTY cells, filled when the row comes on screen
                        // (applyPagination) or something reads it (_pnbFillRows). Rows =
                        // All builds everything, as before; so does the off switch.
                        const _rppAtBuild = $('#rowsPerPageSelector').val();
                        const _lazyRowsOn = _lazyBuild && _rppAtBuild !== 'all';
                        let _eagerLeft = Math.max(_PNB_EAGER_ROWS, parseInt(_rppAtBuild, 10) || 0);
                        let _anyLazyRow = false;
                        const _eagerRows = _lazyRowsOn
                            ? Math.min(_eagerLeft, preFilterMatchSet ? preFilterMatchSet.size : data.length) : data.length;
                        if (penumbraBigRenderNotice(data.length, finalColumnOrder.length, _lazyHiddenCount, _eagerRows)) {
                            await penumbraYieldToPaint();
                        }
                        // Now, build the table body using the DocumentFragment
                        data.forEach((rowData, rowIndex) => {
                            const tr = document.createElement('tr');
                            let _rowEager = true;
                            if (_lazyRowsOn) {
                                _rowEager = _eagerLeft > 0 && !(preFilterMatchSet && !preFilterMatchSet.has(rowIndex));
                                if (_rowEager) _eagerLeft--; else _anyLazyRow = true;
                            }
'''))

edit('js/main.js', 'lr-build-cell', crlf(r'''                                if (_lazyBuild && !isColumnVisible) {
                                    // EMPTY until something needs it (penumbraFillLazyColumns).
'''), crlf(r'''                                if (_lazyBuild && (!isColumnVisible || !_rowEager)) {
                                    // EMPTY until something needs it (penumbraFillLazyColumns),
                                    // or - a lazy row's shown columns - until the row comes
                                    // on screen or is read (_pnbFillRows).
'''))

edit('js/main.js', 'lr-build-register', crlf(r'''                            // Append the completed row to our offline fragment
                            fragment.appendChild(tr);
                        }
                        );

                        // Append the entire fragment to the page in ONE single, fast operation.
'''), crlf(r'''                            // Append the completed row to our offline fragment
                            fragment.appendChild(tr);
                        }
                        );
                        // Rows built EMPTY: any column may now hold empty cells, so every
                        // column reader fills before it reads - the hooks the hidden
                        // columns already use.
                        if (_anyLazyRow) finalColumnOrder.forEach(c => _pnbLazyCols.add(String(columnNameToOriginalIndex[c])));

                        // Append the entire fragment to the page in ONE single, fast operation.
'''))

# --- the notice: lazy rows cost their '#' cell plus EMPTY cells ---------------------------

edit('js/main.js', 'lr-notice-sig', crlf(r'''    function penumbraBigRenderNotice(rowCount, colCount, emptyColCount) {
        const rows = rowCount || 0;
        const cols = colCount || 0;
        // Built cells in full, EMPTY (hidden-column) cells at their weight; +1
        // for the always-built '#' column.
        const empty = Math.min(cols, emptyColCount || 0);
        const cells = Math.round(rows * ((cols - empty + 1) + empty * _PNB_EMPTY_CELL_WEIGHT));
'''), crlf(r'''    function penumbraBigRenderNotice(rowCount, colCount, emptyColCount, eagerRowCount) {
        const rows = rowCount || 0;
        const cols = colCount || 0;
        // Built cells in full, EMPTY (hidden-column) cells at their weight; +1
        // for the always-built '#' column. Lazy rows (past eagerRowCount) are
        // their '#' cell plus EMPTY cells.
        const empty = Math.min(cols, emptyColCount || 0);
        const eager = (typeof eagerRowCount === 'number') ? Math.min(rows, Math.max(0, eagerRowCount)) : rows;
        const cells = Math.round(eager * ((cols - empty + 1) + empty * _PNB_EMPTY_CELL_WEIGHT)
                                 + (rows - eager) * (1 + cols * _PNB_EMPTY_CELL_WEIGHT));
'''))

# --- the row fills ------------------------------------------------------------------------

edit('js/main.js', 'lr-eager-const', crlf(r'''    var _pnbLazyCols = new Set();   // data-column ids that may still hold EMPTY cells
'''), crlf(r'''    var _pnbLazyCols = new Set();   // data-column ids that may still hold EMPTY cells
    // ...and those of them HIDDEN at build (lazy rows, 2026-09-30): a shown one is
    // filled whole - one column, every row - as it always was; the lazy rows'
    // other columns wait for the screen.
    var _pnbHiddenLazyCols = new Set();
    // Lazy rows (2026-09-30): rows built in full at load - at least this many, or
    // a page of rows per page. See the build's _lazyRowsOn.
    var _PNB_EAGER_ROWS = 200;
    // Rows Copy as HTML fills per batch ahead of its reads (generateWysiwygHtml).
    var _PNB_COPY_FILL_BATCH = 250;
'''))

edit('js/main.js', 'lr-fill-helpers', crlf(r'''    // Column names a parsed condition (parseAdvancedQuery) can read - each
'''), crlf(r'''    // ---- Lazy ROWS (2026-09-30): the other half of the same mechanism ----
    // Past the first page a row is built as its <tr>, its '#' cell and EMPTY
    // cells (data-pnb-lazy), every column registered in _pnbLazyCols - so each
    // COLUMN reader above (sort, grouping, format() / heatmap() / rewrite(),
    // copy_distinct, templates, the nested plan) fills what it reads in every
    // row, as it does for a hidden column. The ROW fills below cover the rest:
    // the rows on screen (applyPagination, after its page loop) and the rows an
    // export or copy reads. They fill only the columns that are SHOWING - a
    // hidden column's cells stay empty until something reads that column -
    // and write content only: a cell's styles (format(), heatmap(), stripes)
    // are already on it.

    // What a row fill needs, worked out once per batch.
    function _pnbLazyFillCtx() {
        var vis = Object.create(null), any = false;
        var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th');
        for (var i = 0; i < ths.length; i++) {
            var id = ths[i].getAttribute('data-column');
            if (ths[i].style.display !== 'none' && _pnbLazyCols.has(id)) { vis[id] = true; any = true; }
        }
        return any ? { vis: vis, nameById: _pnbLazyNameById(), held: false } : null;
    }

    // One flat row's EMPTY cells in showing columns. Returns the cells filled.
    function _pnbFillRowWith(row, ctx) {
        if (!ctx || !row || row.classList.contains('journal-note-child')) return 0;
        var cells = row.cells, map, filled = 0;
        for (var c = 0; c < cells.length; c++) {
            var td = cells[c];
            if (!td.hasAttribute('data-pnb-lazy')) continue;
            var cid = td.getAttribute('data-column');
            if (!ctx.vis[cid]) continue;
            if (map === undefined) {
                var idx = _pnbLazyRowIndex(row);
                map = (idx >= 0 && masterRowData[idx]) ? masterRowData[idx] : null;
            }
            // The pause penumbraFillLazyColumns takes: the body-wide a11y
            // observers would otherwise queue a sweep per burst.
            if (!ctx.held && !window.__pnbA11ySuspended) { window.__pnbA11ySuspended = true; ctx.held = true; }
            _pnbFillLazyCell(td, map ? map.get(ctx.nameById[cid]) : undefined);
            filled++;
        }
        return filled;
    }

    function _pnbLazyFillDone(ctx) {
        if (!ctx || !ctx.held) return;
        ctx.held = false;
        setTimeout(function () {
            window.__pnbA11ySuspended = false;
            try { var _n = document.createElement('span'); document.body.appendChild(_n); document.body.removeChild(_n); } catch (e) { }
        }, 1500);
    }

    // These flat rows' EMPTY cells in showing columns. Returns the cells filled.
    function _pnbFillRows(rows) {
        if (!_pnbLazyCols.size || !rows || !rows.length) return 0;
        var ctx = _pnbLazyFillCtx();
        if (!ctx) return 0;
        var filled = 0;
        for (var r = 0; r < rows.length; r++) filled += _pnbFillRowWith(rows[r], ctx);
        _pnbLazyFillDone(ctx);
        return filled;
    }

    // The first rows-per-page rows the search keeps (all of them under Rows =
    // All / None) - what a search shows before it pages.
    function _pnbFillFirstPageRows() {
        if (!_pnbLazyCols.size) return 0;
        var rpp = parseInt($('#rowsPerPageSelector').val(), 10);
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
        var pick = [];
        for (var i = 0; i < all.length && !(rpp > 0 && pick.length >= rpp); i++) {
            if (!all[i].classList.contains('search-hidden') && !all[i].classList.contains('journal-note-child')) pick.push(all[i]);
        }
        return _pnbFillRows(pick);
    }

    // The flat rows on screen (applyPagination runs this after its page loop).
    function _pnbFillDisplayedRows() {
        if (!_pnbLazyCols.size) return 0;
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
        var shown = [];
        for (var i = 0; i < all.length; i++) {
            if (all[i].style.display !== 'none' && !all[i].classList.contains('search-hidden')) shown.push(all[i]);
        }
        return _pnbFillRows(shown);
    }

    // Every flat row the search keeps - what the flat exports read.
    function _pnbFillSearchVisibleRows() {
        if (!_pnbLazyCols.size) return 0;
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
        var keep = [];
        for (var i = 0; i < all.length; i++) {
            if (!all[i].classList.contains('search-hidden')) keep.push(all[i]);
        }
        return _pnbFillRows(keep);
    }

    // Does a parsed condition hold a column-less term (evaluatePart's
    // type 'global': it tests every visible column)? (lazy rows, 2026-09-30)
    function _pnbHasGlobalTerm(parsed) {
        var found = false;
        (function walk(x, depth) {
            if (found || x == null || depth > 25 || typeof x !== 'object') return;
            if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) walk(x[i], depth + 1); return; }
            if (x.type === 'global') { found = true; return; }
            for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k) && x[k] && typeof x[k] === 'object') walk(x[k], depth + 1);
        })(parsed, 0);
        return found;
    }

    // The views' safety net (column show / hide, Settings Apply, the default-7
    // block): the grouped view shows every row, so every showing column is
    // filled in every row. The flat view fills a column that was HIDDEN at
    // build in every row (one column - as the hidden-columns change always
    // did), and otherwise only the rows on screen: a lazy row's other columns
    // fill as it comes on screen or is read.
    function penumbraFillForView() {
        if (!_pnbLazyCols.size) return 0;
        if ($('#groupedResultsContainer').is(':visible')) return penumbraFillVisibleLazyColumns();
        var shownHidden = [];
        if (_pnbHiddenLazyCols.size) {
            var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th');
            for (var i = 0; i < ths.length; i++) {
                var id = ths[i].getAttribute('data-column');
                if (ths[i].style.display !== 'none' && _pnbHiddenLazyCols.has(id)) shownHidden.push(id);
            }
        }
        var n = shownHidden.length ? penumbraFillLazyColumns(shownHidden) : 0;
        return n + _pnbFillDisplayedRows();
    }

    // Lazy rows (2026-09-30): before an action that reads every row the search
    // keeps (a download, a whole-table copy, Rows = All) - or every row, for
    // grouping (opts.allRows) - fill what it will read. Little to fill: this
    // returns null and the reader's own fill does it in line, so small reports
    // behave exactly as before. More: "Preparing N rows..." goes up and gets a
    // frame to paint, the rows fill, and the returned promise resolves - a
    // multi-second fill is never a silent freeze.
    var _PNB_PREPARE_NOTICE_CELLS = 60000;
    function penumbraPrepareRows(opts) {
        opts = opts || {};
        if (!_pnbLazyCols.size || $('#pivot-output-container').is(':visible')) return null;
        if (!opts.allRows && $('#groupedResultsContainer').is(':visible')) return null;   // grouped clones were filled on entry
        var ctx = _pnbLazyFillCtx();
        if (!ctx) return null;
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
        var rows = 0;
        for (var i = 0; i < all.length; i++) {
            var r = all[i];
            if (!opts.allRows && r.classList.contains('search-hidden')) continue;
            var cells = r.cells;
            for (var c = 0; c < cells.length; c++) {
                if (cells[c].hasAttribute('data-pnb-lazy') && ctx.vis[cells[c].getAttribute('data-column')]) { rows++; break; }
            }
        }
        if (rows * Object.keys(ctx.vis).length < _PNB_PREPARE_NOTICE_CELLS) return null;
        showLoading('Preparing ' + rows.toLocaleString() + ' rows...');
        return penumbraYieldToPaint().then(function () {
            try { if (opts.allRows) penumbraFillVisibleLazyColumns(); else _pnbFillSearchVisibleRows(); }
            finally { hideLoading(); }
        });
    }

    // Column names a parsed condition (parseAdvancedQuery) can read - each
'''))

# --- where rows come on screen / columns show --------------------------------------------

edit('js/main.js', 'lr-pagination-start', crlf(r'''    function applyPagination() {
        // Safety net: a column shown by ANY path has its EMPTY cells filled
        // before this pass pages and formats them (no-op when none is pending).
        penumbraFillVisibleLazyColumns();
        const rowsPerPage = $('#rowsPerPageSelector').val();
'''), crlf(r'''    function applyPagination() {
        // (The EMPTY-cell safety net runs after the page loop below: it fills the
        // rows that are on screen, whatever path showed their columns.)
        const rowsPerPage = $('#rowsPerPageSelector').val();
'''))

edit('js/main.js', 'lr-pagination-fill', crlf(r'''        // AFTER the page loop, not before it (2026-09-30). The count reads only
'''), crlf(r'''        // Lazy rows / hidden columns (2026-09-30): the rows now on screen get
        // their EMPTY cells in every showing column - before the count's style
        // read and before format() / rewrite() / stripes below run over them.
        _pnbFillDisplayedRows();

        // AFTER the page loop, not before it (2026-09-30). The count reads only
'''))

edit('js/main.js', 'lr-net-default7', crlf(r'''                            // The columns just shown may have been built EMPTY.
                            penumbraFillVisibleLazyColumns();
'''), crlf(r'''                            // The columns just shown may have been built EMPTY.
                            penumbraFillForView();
'''))

edit('js/main.js', 'lr-net-settings', crlf(r'''        // paints or reads them. (2026-09-30)
        penumbraFillVisibleLazyColumns();
'''), crlf(r'''        // paints or reads them. (2026-09-30) Flat view: the rows on screen (lazy
        // rows); the grouped rebuild below fills every row it clones.
        penumbraFillForView();
'''))

edit('js/main.js', 'lr-net-postcoltoggle', crlf(r'''        penumbraFillVisibleLazyColumns();   // shown columns built EMPTY (2026-09-30)
'''), crlf(r'''        penumbraFillForView();   // shown columns built EMPTY (2026-09-30); flat view: rows on screen
'''))

# --- Copy as HTML over every page: fill each off-page row it reads -----------------------

edit('js/main.js', 'lr-copy-fillrow', crlf(r'''                $srcTable.find(rowSelector).each(function () {
                    // Another page's row (opts.offPageRows - Copy as HTML over every
                    // page; the selector already drops search-hidden rows).
                    processRow($(this), $tbodyClone, !!opts.offPageRows && this.style.display === 'none');
                });
'''), crlf(r'''                // Lazy rows: an off-page row may still be EMPTY. Fill them AHEAD of
                // the reads, a batch at a time: a write followed by a style read
                // costs a style recalc (~5 ms on a 5,000-row table), so filling
                // each row just before reading it cost ~1,000 recalcs and 5 s for
                // a 1,172-row copy. A batch costs one; at most one batch is filled
                // past the size cap.
                const _fillCtx = opts.offPageRows ? _pnbLazyFillCtx() : null;
                const _rowList = $srcTable.find(rowSelector).get();
                let _filledTo = 0;
                for (let _ri = 0; _ri < _rowList.length; _ri++) {
                    const _tr = _rowList[_ri];
                    // Another page's row (opts.offPageRows - Copy as HTML over every
                    // page; the selector already drops search-hidden rows).
                    const _off = !!opts.offPageRows && _tr.style.display === 'none';
                    if (_off && _fillCtx && !_wyTruncated && _ri >= _filledTo) {
                        _filledTo = Math.min(_rowList.length, _ri + _PNB_COPY_FILL_BATCH);
                        for (let _fj = _ri; _fj < _filledTo; _fj++) {
                            if (_rowList[_fj].style.display === 'none') _pnbFillRowWith(_rowList[_fj], _fillCtx);
                        }
                    }
                    processRow($(_tr), $tbodyClone, _off);
                }
                _pnbLazyFillDone(_fillCtx);
'''))

# --- exports: fill what they read; find cells by position; skip the clone for text-only cells ---

edit('js/main.js', 'lr-export-fill', crlf(r'''    function getExportData(format, opts) {
        opts = opts || {};
        const isPivotMode = $('#pivot-output-container').is(':visible');
        const isGrouped = $('#groupedResultsContainer').is(':visible');
'''), crlf(r'''    function getExportData(format, opts) {
        opts = opts || {};
        const isPivotMode = $('#pivot-output-container').is(':visible');
        const isGrouped = $('#groupedResultsContainer').is(':visible');
        // Lazy rows (2026-09-30): the flat exports read every row the search
        // keeps - fill those rows' showing cells first. (Copy as HTML fills what
        // it reads itself, in batches; the email embed reads the page on screen.)
        if (format !== 'html' && !isPivotMode && !isGrouped) _pnbFillSearchVisibleRows();
'''))

edit('js/main.js', 'lr-export-fasttext', crlf(r'''            // 1. Deep clone the node to avoid modifying the live table
            const clone = cellNode.cloneNode(true);
'''), crlf(r'''            // Faster exports (2026-09-30): a cell with no child ELEMENT is plain
            // text - nothing below changes it, so skip the clone.
            if (!cellNode.firstElementChild) return cellNode.textContent.trim();

            // 1. Deep clone the node to avoid modifying the live table
            const clone = cellNode.cloneNode(true);
'''))

edit('js/main.js', 'lr-export-cellof', crlf(r'''        // ============================================================
        // 4. JSON Export (Flat/Grouped) - FIXED LOGIC
        // ============================================================
'''), crlf(r'''        // Faster exports (2026-09-30): find a row's cell by POSITION - every row
        // holds its cells in the same order ('#', then every column, hidden ones
        // included) - instead of a selector query per cell. A cell that is not
        // where the first row says falls back to the query.
        const _cellPos = Object.create(null);
        const _posRow = $sourceRows[0];
        if (_posRow && _posRow.cells) {
            for (let _ci = 0; _ci < _posRow.cells.length; _ci++) _cellPos[_posRow.cells[_ci].getAttribute('data-column')] = _ci;
        }
        const cellOf = (row, id) => {
            const p = _cellPos[id];
            const c = (p !== undefined) ? row.cells[p] : null;
            return (c && c.getAttribute('data-column') === String(id)) ? c : row.querySelector("td[data-column='" + id + "']");
        };

        // ============================================================
        // 4. JSON Export (Flat/Grouped) - FIXED LOGIC
        // ============================================================
'''))

edit('js/main.js', 'lr-export-json-cell', crlf(r'''                visibleColumnInfo.forEach(header => {
                    if (header.name) {
                        const $cell = $row.find(`td[data-column='${header.id}']`);
                        const cellNode = $cell[0];
'''), crlf(r'''                visibleColumnInfo.forEach(header => {
                    if (header.name) {
                        const cellNode = cellOf($row[0], header.id);
                        const $cell = [cellNode];   // getCleanText reads [0]
'''))

edit('js/main.js', 'lr-export-flat-cell', crlf(r'''                    const $cell = $row.find("td[data-column='" + c.id + "']");
                    plainVals[c.name] = $cell.length ? getCleanText($cell) : '';
'''), crlf(r'''                    const _pcell = cellOf($row[0], c.id);
                    plainVals[c.name] = _pcell ? getCleanText([_pcell]) : '';
'''))

edit('js/main.js', 'lr-export-csv-cell', crlf(r'''            let rowData = visibleColumnInfo.map(info => {
                const $cell = $row.find(`td[data-column='${info.id}']`);
                const cellNode = $cell[0];
'''), crlf(r'''            let rowData = visibleColumnInfo.map(info => {
                const cellNode = cellOf($row[0], info.id);
                const $cell = [cellNode];   // getCleanText reads [0]
'''))

edit('js/main.js', 'lr-pdf-flat-fill', crlf(r'''            }// 3. STANDARD TABLE MODE
            else {
                const head = []
'''), crlf(r'''            }// 3. STANDARD TABLE MODE
            else {
                // Lazy rows (2026-09-30): this reads every row the search keeps.
                _pnbFillSearchVisibleRows();
                const head = []
'''))

edit('js/main.js', 'lr-xlsx-flat-fill', crlf(r'''            // Data
            let rIndex = 1;
            $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)").each(function () {
'''), crlf(r'''            // Data
            let rIndex = 1;
            _pnbFillSearchVisibleRows();   // lazy rows (2026-09-30): this reads every row the search keeps
            $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)").each(function () {
'''))

# --- the audit's other readers (2026-09-30) ----------------------------------------------

edit('js/main.js', 'lr-sql-fill', crlf(r'''                    $rowsToCopy = $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)");
'''), crlf(r'''                    _pnbFillSearchVisibleRows();   // lazy rows (2026-09-30): every row the search keeps is read
                    $rowsToCopy = $("#resultsTable tbody tr:not(.search-hidden):not(.journal-note-child)");
'''))

edit('js/main.js', 'lr-nestedsort-fill', crlf(r'''            const $targetRows = $('#groupedResultsContainer').is(':visible')
'''), crlf(r'''            // Lazy rows / hidden columns (2026-09-30): this re-sorts the column's
            // cell in EVERY row - an EMPTY one would be skipped now and filled
            // unsorted later.
            penumbraFillLazyColumns([colIndex]);
            const $targetRows = $('#groupedResultsContainer').is(':visible')
'''))

edit('js/main.js', 'lr-cf-global', crlf(r'''                if (_cfNamed.length) penumbraFillLazyColumnsByName(_cfNamed);
            }
'''), crlf(r'''                if (_cfNamed.length) penumbraFillLazyColumnsByName(_cfNamed);
                // A column-less term (format(row, Alpha, ...)) tests EVERY showing
                // cell - so every row the search keeps needs them all (lazy rows,
                // 2026-09-30): Copy as HTML and XLSX read the styles of rows on
                // other pages too.
                if (activeRules.some(function (rule) { return rule.parsedCondition && _pnbHasGlobalTerm(rule.parsedCondition); })) {
                    _pnbFillSearchVisibleRows();
                }
            }
'''))


edit('js/main.js', 'lr-pagination-none', crlf(r'''        if (_dataHidden) {
            $('#paginatorContainer').css('visibility', 'visible');
            updateFilteredResultCount();
            return;
        }
'''), crlf(r'''        if (_dataHidden) {
            $('#paginatorContainer').css('visibility', 'visible');
            // Lazy rows (2026-09-30): nothing is on screen, but the rows left
            // displayed (the build's first page, a search's matches) are what
            // the email embed carries.
            _pnbFillDisplayedRows();
            updateFilteredResultCount();
            return;
        }
'''))

edit('js/main.js', 'lr-search-firstpage', crlf(r'''                _snipVisibleCount = matchSet.size;
'''), crlf(r'''                _snipVisibleCount = matchSet.size;
                // Lazy rows (2026-09-30): every match stays displayed until the
                // applyPagination() below pages them; the first page's worth -
                // what shows under the veil meanwhile - gets its cells now.
                _pnbFillFirstPageRows();
'''))



# --- "Preparing N rows..." at the entry points -------------------------------------------

edit('js/main.js', 'lr-prep-download', crlf(r"""    $('#confirmDownloadBtn').on('click', async function () {
        const format = $('input[name="downloadFormat"]:checked').val();
        if (!format) {
            alert("Please select a download format.");
            return;
        }
"""), crlf(r"""    $('#confirmDownloadBtn').on('click', async function () {
        const format = $('input[name="downloadFormat"]:checked').val();
        if (!format) {
            alert("Please select a download format.");
            return;
        }
        // Lazy rows (2026-09-30): a big fill gets "Preparing N rows..." first.
        const _prepDl = penumbraPrepareRows();
        if (_prepDl) await _prepDl;
"""))

edit('js/main.js', 'lr-prep-copy', crlf(r"""    $('#confirmCopyBtn').on('click', function () {
        const format = $('input[name="copyFormat"]:checked').val();
        if (!format) {
            alert("Please select a copy format.");
            return;
        }
"""), crlf(r"""    $('#confirmCopyBtn').on('click', function _pnbConfirmCopy(e, _pnbPrepared) {
        const format = $('input[name="copyFormat"]:checked').val();
        if (!format) {
            alert("Please select a copy format.");
            return;
        }
        // Lazy rows (2026-09-30): the whole-table formats read every row the
        // search keeps - a big fill gets "Preparing N rows..." first. (Copy as
        // HTML fills in batches, up to its size cap, on its own.)
        if (!_pnbPrepared && ['csv', 'tsv', 'json', 'sql'].indexOf(format) !== -1) {
            const _prep = penumbraPrepareRows();
            if (_prep) { const _self = this; _prep.then(function () { _pnbConfirmCopy.call(_self, e, true); }); return; }
        }
"""))

edit('js/main.js', 'lr-prep-email', crlf(r"""            // 1. Generate attachments if requested
            if ($('#emailAttachCSV').is(':checked')) {
"""), crlf(r"""            // Lazy rows (2026-09-30): the attachments read every row the search
            // keeps - fill them here, under the overlay, once it has painted.
            if (_pnbLazyCols.size && ($('#emailAttachCSV').is(':checked') || $('#emailAttachXLS').is(':checked') || $('#emailAttachPDF').is(':checked'))) {
                await penumbraYieldToPaint();
                _pnbFillSearchVisibleRows();
            }

            // 1. Generate attachments if requested
            if ($('#emailAttachCSV').is(':checked')) {
"""))

edit('js/main.js', 'lr-prep-rowsall', crlf(r"""        applyPagination();
    });

    $('#firstPageBtn').on('click', function () {
"""), crlf(r"""        // Lazy rows (2026-09-30): Rows = All shows every row the search keeps -
        // a big fill gets "Preparing N rows..." first.
        const _prepAll = ($(this).val() === 'all') ? penumbraPrepareRows() : null;
        if (_prepAll) _prepAll.then(applyPagination); else applyPagination();
    });

    $('#firstPageBtn').on('click', function () {
"""))

edit('js/main.js', 'lr-prep-group', crlf(r"""    $('#confirmGroupingBtn').on('click', function () {
        // The whole stack, comma-joined. selectedColumn stays the LEVEL-0 value
        // because everything downstream of here (the compare teardown, the
        // masterRowData backup, the level-0 grouping walk) has always meant the
        // outermost column by that name.
        const selectedLevels = _groupLevelsFromDialog();
        const selectedColumn = selectedLevels[0] || '';
        if (!selectedColumn) {
            alert('Please select a column to group by.');
            return;
        }
"""), crlf(r"""    $('#confirmGroupingBtn').on('click', function _pnbConfirmGrouping(e, _pnbPrepared) {
        // The whole stack, comma-joined. selectedColumn stays the LEVEL-0 value
        // because everything downstream of here (the compare teardown, the
        // masterRowData backup, the level-0 grouping walk) has always meant the
        // outermost column by that name.
        const selectedLevels = _groupLevelsFromDialog();
        const selectedColumn = selectedLevels[0] || '';
        if (!selectedColumn) {
            alert('Please select a column to group by.');
            return;
        }
        // Lazy rows (2026-09-30): the grouped view clones every row - a big
        // fill gets "Preparing N rows..." first.
        if (!_pnbPrepared) {
            const _prep = penumbraPrepareRows({ allRows: true });
            if (_prep) { const _self = this; _prep.then(function () { _pnbConfirmGrouping.call(_self, e, true); }); return; }
        }
"""))


edit('js/main.js', 'lr-hiddenset-build', crlf(r"""                        _pnbLazyCols.clear();
                        const _lazyBuild = penumbraLazyCellsEnabled()
"""), crlf(r"""                        _pnbLazyCols.clear();
                        _pnbHiddenLazyCols.clear();
                        const _lazyBuild = penumbraLazyCellsEnabled()
"""))

edit('js/main.js', 'lr-hiddenset-add', crlf(r"""                                    _pnbLazyCols.add(String(columnNameToOriginalIndex[c]));
                                    _lazyHiddenCount++;
"""), crlf(r"""                                    _pnbLazyCols.add(String(columnNameToOriginalIndex[c]));
                                    _pnbHiddenLazyCols.add(String(columnNameToOriginalIndex[c]));
                                    _lazyHiddenCount++;
"""))

edit('js/main.js', 'lr-hiddenset-delete', crlf(r"""        want.forEach(function (id) { _pnbLazyCols.delete(id); });
"""), crlf(r"""        want.forEach(function (id) { _pnbLazyCols.delete(id); _pnbHiddenLazyCols.delete(id); });
"""))


# --- the fill writes plain text without an HTML parse ------------------------------------

edit('js/main.js', 'lr-fill-plaintext', crlf(r"""    function _pnbFillLazyCell(td, raw) {
        var formatted = formatCellContent(raw);
        td.innerHTML = formatted;
"""), crlf(r"""    function _pnbFillLazyCell(td, raw) {
        var formatted = formatCellContent(raw);
        // Plain text (no '<', '&', CR or NUL - all the HTML parser would turn into
        // markup, an entity, LF or U+FFFD) makes the SAME single text node through
        // textContent, without a parse per cell: the 813,400-cell fill of a
        // 10,000 x 83 report 8.8 s -> 7.1 s (lazy rows, 2026-09-30). Most of the
        // rest is DOMPurify on the @@HTML cells, which the build pays alike.
        if (/^[^<&\r\0]*$/.test(formatted)) td.textContent = formatted;
        else td.innerHTML = formatted;
"""))


# --- README.md ---------------------------------------------------------------------------

edit('README.md', 'readme-lazyrows-suite', r"""py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\copyhtml\run.py --mutants
```
""", r"""py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\copyhtml\run.py --mutants

# Lazy rows (2026-09-30): rows past the first page are built as their <tr>, their '#' cell and
# EMPTY cells - see section 5. DIFFERENTIAL, like hiddencols: every scenario loads the REAL
# main.js twice - the build BEFORE the change (every row built in full; newest
# js\main.js.bak-*-lazyrows, or --baseline) and the build under test - on the hiddencols fixture
# (300 rows, 200 a page, so rows 200-299 start EMPTY) and requires identical fingerprints (D-*):
# the table as displayed (the inside of an off-screen row's cells is skipped), the grouped view,
# and every output WHOLE - CSV / TSV / JSON / nested-flatten exports, each Copy dialog format on
# its own page load (an earlier format's fill once hid a later one's gap), the email embed, the
# PDF table data (autoTable's arguments) and the XLSX cells - after page turns, 25 a page, Rows =
# All / None, search, header and saved sorts, show / hide, grouping, format() / heatmap() /
# rewrite() rules incl. a column-less format() term, a nested sub-table header sort and the off
# switch. L-* is the census: rows 200-299 start EMPTY, no EMPTY cell in a showing column of a row
# on screen, none left in the rows an export read, a search's first page is filled at its snippet
# render, and the prep* scenarios (threshold patched to 0) show "Preparing 100 rows...". Measured
# 2026-09-30 on the stage: 96/0; --control (the old build) RED on exactly L-boot, L-prepcsv,
# L-prepall; --mutants 16/16 (12 fill sites bite; eq-nononefill, eq-noviewrows, eq-nofasttext and
# eq-nocellof are redundant by design). Runners that rewrite ONE main_hc.js per build turn the
# browser cache off (Network.setCacheDisabled): heuristic freshness once served the previous build.
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\lazyrows\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\lazyrows\run.py --mutants
```
""")

edit('README.md', 'readme-lazyrows-rule', r"""  cells. **Any new code that reads the TEXT or HTML of a flat or grouped cell whose column can be
  hidden must call a fill helper first** (or read masterRowData, as search, totals, the snippet
""", r"""  cells. **Any new code that reads the TEXT or HTML of a flat or grouped cell whose column can be
  hidden - or whose ROW can be off the page (lazy rows, next item) - must call a fill helper
  first** (or read masterRowData, as search, totals, the snippet
""")

edit('README.md', 'readme-lazyrows-landmine', r"""  `&lazycells=off`. Suite `hiddencols`.
""", r"""  `&lazycells=off`. Suite `hiddencols`.
- **Rows off the first page are built EMPTY too - "lazy rows" (2026-09-30).** The flat build
  makes every row's `<tr>` and '#' cell (the row list, search state, sort order and the snippet
  engine all live there - data(pagerows/pagepos/count) never read cell content), but only the
  first max(200, rows per page) rows the on-load filter keeps get their content; every other
  cell is EMPTY with `data-pnb-lazy`, and EVERY column is then registered in `_pnbLazyCols`, so
  each column reader above fills what it reads in every row. `_pnbHiddenLazyCols` is the subset
  hidden at build: showing one fills it whole (one column, as before). Row fills
  (`_pnbFillRows`, `_pnbFillDisplayedRows`, `_pnbFillSearchVisibleRows`,
  `_pnbFillFirstPageRows`; `_pnbLazyFillCtx` + `_pnbFillRowWith` for batches) fill only the
  SHOWING columns and write content only - a cell's format() / heatmap() / stripe styles are
  already on it. Wired: applyPagination after its page loop (and in its Rows = None branch - the
  email embed reads what stays displayed); `penumbraFillForView()` for the column / Settings /
  default-7 nets (the grouped view fills every row: it clones them); getExportData's flat
  exports, the flat PDF and XLSX branches, Copy SQL; Copy as HTML fills off-page rows AHEAD of
  its reads in batches of 250 (a fill followed by a style read is a ~5 ms recalc per row -
  1,172 rows took 8.4 s one at a time, 1.8 s batched); a format() rule with a column-less term
  (`_pnbHasGlobalTerm`) fills every row the search keeps; a nested sub-table header sort fills
  its column; a search fills its first page before it awaits the snippet render (every match is
  displayed until it pages). `penumbraPrepareRows()` puts "Preparing N rows..." up first when
  60,000+ cells wait (Download, the whole-table Copy formats, Rows = All, Apply Grouping; email
  attachments fill under their own overlay). Rows = All and the off switch build every row.
  Exports also find cells by position (`cellOf`) and skip getCleanText's clone for element-free
  cells; the fill writes plain text with textContent (no HTML parse). Measured headless on 10,000
  x 83 all shown: load 13.3 s -> 2.8 s (20,000: 25.1 -> 4.7 s), search 2.0 -> 0.7 s, sort 2.8 ->
  1.4 s, page turn 0.58 -> 0.41 s, later CSV exports 4.7 -> 1.9 s; the FIRST full export pays
  the deferred fill (4.6 -> 8.5 s) - most of it DOMPurify on the @@HTML cells, which the old load
  paid up front. Copy as HTML and Rows = All cost about the same as before. `rebuildTableFromMasterData` (snapshots, imports) stays eager. Switch: the same
  `js/penumbra_lazycells.off` / `&lazycells=off`. Suite `lazyrows`; hiddencols runs its candidate
  with lazy rows off.
""")

edit('README.md', 'readme-lazyrows-runbook', r"""### "Hidden columns look wrong - build every cell up front again"

Since 2026-09-30 a hidden column's cells are built EMPTY and filled when something needs them
(section 5). If a hidden column ever shows blank cells, or sorts, groups or copies wrong: create
""", r"""### "Hidden columns look wrong - build every cell up front again"

Since 2026-09-30 a hidden column's cells - and every cell of a row off the first page ("lazy
rows") - are built EMPTY and filled when something needs them (section 5). If a hidden column or
a page of rows ever shows blank cells, or an export, a sort, a group or a copy comes out wrong: create
""")
