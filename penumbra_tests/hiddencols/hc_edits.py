# The edits themselves (loaded by hc_patch.py). Written with LF; main.js
# texts go through crlf(); index.php is LF already.
#
# TIER 1 - no change to what the table holds:
#   wrapsel-*      the results-wrapper lookups: native, not a whole-document :visible scan
#   countafter-*   applyPagination: count + PDF guard AFTER the page is laid out
#   cfreset        format() pass: clear inline cell styles only where one is set
#   rcsreset       resetCellStates: same, for its per-cell style reset
# TIER 2 - hidden columns' cells built EMPTY, filled on demand:
#   lazy-*         helpers, the build, every reader the audit listed, the
#                  show paths + safety nets, the big-render notice, the switch

# =============================================================================
# TIER 1
# =============================================================================

# --- 1. The results-wrapper lookups: native, not a whole-document :visible scan
edit('js/main.js', 'wrapsel-helper', crlf('''    function _pnbHorizontalScrollTargets() {
        var targets = $('[id="results-wrapper"]:visible').get();
'''), crlf('''    // Every #results-wrapper jQuery's :visible would keep, in document order.
    // The flat and pivot wrappers share the id, so an id lookup (first match
    // only) will not do - and the old $('[id="results-wrapper"]:visible') gave
    // the selector engine no ID/TAG/CLASS seed: it walked EVERY element in the
    // document and ran :visible on each. That is ~0.7 s per search, sort and
    // load on a 2,000-row x 150-column table, and hidden columns count in full
    // (their cells are elements too). querySelectorAll('#id') returns every
    // element carrying the id, straight from the id index. The :visible test
    // is jQuery's own; the PiP retry is the jQuery lookup shim's (nothing
    // visible here -> the popped-out window's document). 2026-09-30
    function _pnbVisibleResultsWrappers() {
        var vis = function (el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); };
        var out = Array.prototype.filter.call(document.querySelectorAll('#results-wrapper'), vis);
        if (!out.length && _admPip.win) {
            try { out = Array.prototype.filter.call(_admPip.win.document.querySelectorAll('#results-wrapper'), vis); } catch (err) { out = []; }
        }
        return out;
    }

    function _pnbHorizontalScrollTargets() {
        var targets = _pnbVisibleResultsWrappers();
'''))

edit('js/main.js', 'wrapsel-visible-wrapper', crlf('''        return $('[id="results-wrapper"]:visible').filter(function () { return this.clientHeight > 0; }).get(0) || null;
'''), crlf('''        return _pnbVisibleResultsWrappers().filter(function (el) { return el.clientHeight > 0; })[0] || null;
'''))

# --- 2. applyPagination: the count + PDF guard AFTER the page is laid out
edit('js/main.js', 'countafter-remove', crlf('''        const totalRows = filteredRows.length;
        let totalPages = 1;

        updateFilteredResultCount();

        if (rowsPerPage === 'all' || totalRows === 0) {
'''), crlf('''        const totalRows = filteredRows.length;
        let totalPages = 1;

        if (rowsPerPage === 'all' || totalRows === 0) {
'''))

edit('js/main.js', 'countafter-add', crlf('''            $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`);
            $('#firstPageBtn, #prevPageBtn').prop('disabled', currentPage === 1);
            $('#nextPageBtn, #lastPageBtn').prop('disabled', currentPage >= totalPages);
        }

        // --- START MODIFICATION ---
'''), crlf('''            $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`);
            $('#firstPageBtn, #prevPageBtn').prop('disabled', currentPage === 1);
            $('#nextPageBtn, #lastPageBtn').prop('disabled', currentPage >= totalPages);
        }

        // AFTER the page loop, not before it (2026-09-30). The count reads only
        // the .search-hidden classes, but the PDF guard it calls asks for
        // "#tableHeader th:visible" - a forced style pass over every DISPLAYED
        // row. Before the loop, a search has just displayed every match, so
        // that pass restyled all of them (2,000 rows x 150 cells, hidden
        // columns included, ~0.4 s); after it, one page.
        updateFilteredResultCount();

        // --- START MODIFICATION ---
'''))

# --- 3. format() pass: clear inline cell styles only where one is set
edit('js/main.js', 'cfreset', crlf('''                const $cells = $(rowEl.cells);
                $cells.css(resetCellCss);
'''), crlf('''                const $cells = $(rowEl.cells);
                // Only cells carrying an inline style besides display: clearing a
                // property that is not set is a no-op, and doing it through jQuery
                // for every cell of every row - hidden columns included - was most
                // of this pass (2026-09-30).
                for (let _cfi = 0; _cfi < rowEl.cells.length; _cfi++) {
                    const _cst = rowEl.cells[_cfi].style;
                    if (_cst.length === 0 || (_cst.length === 1 && _cst.display)) continue;
                    $(rowEl.cells[_cfi]).css(resetCellCss);
                }
'''))

# --- 4. resetCellStates: skip the empty-cell content restore (TIER 2) and
#        clear inline styles only where one is set (TIER 1)
edit('js/main.js', 'rcsreset', crlf('''                for (let _ci = 0; _ci < rowEl.cells.length; _ci++) {
                    const cell = rowEl.cells[_ci];
                    const originalHtml = cell.dataset.originalHtml;
                    if (originalHtml !== undefined) {
                        cell.innerHTML = formatCellContent(originalHtml);
                    } else if (byPos[_ci]) {
'''), crlf('''                for (let _ci = 0; _ci < rowEl.cells.length; _ci++) {
                    const cell = rowEl.cells[_ci];
                    const originalHtml = cell.dataset.originalHtml;
                    // A hidden column's still-EMPTY cell (penumbraFillLazyColumns)
                    // holds no content to restore - filling writes it from scratch.
                    if (cell.hasAttribute('data-pnb-lazy')) {
                        // style only (below)
                    } else if (originalHtml !== undefined) {
                        cell.innerHTML = formatCellContent(originalHtml);
                    } else if (byPos[_ci]) {
'''))

edit('js/main.js', 'rcsreset-css', crlf('''                    $(cell).css(_rcsResetCellCss).removeData('rewritten');
'''), crlf('''                    // Only cells carrying an inline style besides display (clearing
                    // an unset property is a no-op; nothing ever SETS 'rewritten').
                    const _rst = cell.style;
                    if (_rst.length !== 0 && !(_rst.length === 1 && _rst.display)) {
                        $(cell).css(_rcsResetCellCss).removeData('rewritten');
                    }
'''))

# =============================================================================
# TIER 2 - hidden columns' cells built EMPTY
# =============================================================================

# --- the helpers (after formatCellContent)
edit('js/main.js', 'lazy-helpers', crlf('''    // --- Nested JSON Table Sorting Handler ---
'''), crlf('''    // ---- Hidden columns' cells: built EMPTY, filled on demand (2026-09-30) ----
    // The flat build used to format and parse every cell of every HIDDEN
    // column too - formatCellContent (DOMPurify on each @@HTML link) and an HTML
    // parse per cell - most of a 5 s load on a 2,000-row x 150-column report
    // with 10 columns showing, and twice that with a format() rule. A hidden
    // column's cells are now built EMPTY: the same <td>, same data-column, same
    // place in the row (every "header position == cell position" reader still
    // lines up), marked data-pnb-lazy. They are filled from masterRowData - row
    // from the '#' cell / data-row-index, column from the header's data-colname
    // - exactly as the build writes a shown cell, the moment anything needs
    // their CONTENT: the column is shown, sorted on, grouped or summarised on,
    // named by a format() / heatmap() / rewrite() rule, copied, or used by a
    // custom template. Search never needed them - it reads masterRowData.
    // The mark is an attribute, not an expando, so it survives into the grouped
    // view's cell clones (renderLeafGroup), and every fill covers both views.
    // Off for one page: &lazycells=off. Off for everyone: an empty
    // js/penumbra_lazycells.off (index.php -> penumbra_vars.lazyCellsOff).
    var _pnbLazyCols = new Set();   // data-column ids that may still hold EMPTY cells

    function penumbraLazyCellsEnabled() {
        if (/[?&]lazycells=off(?:&|$)/i.test(window.location.search)) return false;
        try { if (penumbra_vars && penumbra_vars.lazyCellsOff) return false; } catch (e) { }
        return true;
    }

    // masterRowData index of a flat or grouped data row (NaN when none).
    function _pnbLazyRowIndex(row) {
        var a = row.getAttribute('data-row-index');
        if (a !== null) return parseInt(a, 10);
        var h = row.cells[0];
        if (!h || h.getAttribute('data-column') !== '#') h = row.querySelector("td[data-column='#']");
        return h ? parseInt(h.textContent, 10) - 1 : NaN;
    }

    // data-column id -> masterRowData key, from the flat header.
    function _pnbLazyNameById() {
        var m = Object.create(null);
        var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th[data-colname]');
        for (var i = 0; i < ths.length; i++) m[ths[i].getAttribute('data-column')] = String(ths[i].getAttribute('data-colname')).toUpperCase();
        return m;
    }

    // One empty cell -> exactly what the flat build writes for a shown cell.
    function _pnbFillLazyCell(td, raw) {
        var formatted = formatCellContent(raw);
        td.innerHTML = formatted;
        var rawStr = (raw != null) ? String(raw) : formatted;
        if (rawStr !== formatted) td.dataset.originalHtml = rawStr;
        if (rawStr.indexOf('@@JSON') !== -1) td.classList.add('cell-contains-nested-table');
        td.removeAttribute('data-pnb-lazy');
    }

    // Fill the empty cells of these columns (data-column ids) in the flat table
    // AND the grouped view's clones - every row, paged-out and search-hidden
    // ones included (note-child rows are not data rows). An id with nothing
    // left to fill costs one Set lookup. Returns the number of cells filled.
    function penumbraFillLazyColumns(colIds) {
        if (!_pnbLazyCols.size || !colIds) return 0;
        var want = new Set();
        for (var i = 0; i < colIds.length; i++) {
            if (colIds[i] == null) continue;
            var id = String(colIds[i]);
            if (_pnbLazyCols.has(id)) want.add(id);
        }
        if (!want.size) return 0;
        var nameById = _pnbLazyNameById();
        var rows = document.querySelectorAll('#resultsTable > tbody > tr, #groupedResultsContainer tbody > tr');
        var filled = 0, held = false;
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (row.classList.contains('journal-note-child')) continue;
            var cells = row.cells, idx = null, map = null;
            if (!cells) continue;
            for (var c = 0; c < cells.length; c++) {
                var td = cells[c];
                if (!td.hasAttribute('data-pnb-lazy')) continue;
                var cid = td.getAttribute('data-column');
                if (!want.has(cid)) continue;
                if (idx === null) {
                    idx = _pnbLazyRowIndex(row);
                    map = (idx >= 0 && masterRowData[idx]) ? masterRowData[idx] : null;
                }
                // Same pause the build takes around its append: the body-wide
                // a11y observers would otherwise queue a sweep per burst.
                if (!filled && !window.__pnbA11ySuspended) { window.__pnbA11ySuspended = true; held = true; }
                _pnbFillLazyCell(td, map ? map.get(nameById[cid]) : undefined);
                filled++;
            }
        }
        want.forEach(function (id) { _pnbLazyCols.delete(id); });
        if (held) {
            setTimeout(function () {
                window.__pnbA11ySuspended = false;
                try { var _n = document.createElement('span'); document.body.appendChild(_n); document.body.removeChild(_n); } catch (e) { }
            }, 1500);
        }
        return filled;
    }

    // By column NAME (flat header data-colname, any case): rule conditions,
    // templates and group levels name their columns.
    function penumbraFillLazyColumnsByName(names) {
        if (!_pnbLazyCols.size || !names || !names.length) return 0;
        var want = new Set();
        for (var i = 0; i < names.length; i++) if (names[i] != null) want.add(String(names[i]).toUpperCase());
        var ids = [];
        var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th[data-colname]');
        for (var t = 0; t < ths.length; t++) {
            if (want.has(String(ths[t].getAttribute('data-colname')).toUpperCase())) ids.push(ths[t].getAttribute('data-column'));
        }
        return ids.length ? penumbraFillLazyColumns(ids) : 0;
    }

    // Every empty column whose flat header cell is SHOWING - the safety net the
    // view refreshes call (applyPagination, postColumnToggle, rebuildGroupedView)
    // so a column shown by any path is filled before it is painted or read.
    function penumbraFillVisibleLazyColumns() {
        if (!_pnbLazyCols.size) return 0;
        var ids = [];
        var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th');
        for (var i = 0; i < ths.length; i++) {
            var id = ths[i].getAttribute('data-column');
            if (_pnbLazyCols.has(id) && ths[i].style.display !== 'none') ids.push(id);
        }
        return ids.length ? penumbraFillLazyColumns(ids) : 0;
    }

    // Column names a parsed condition (parseAdvancedQuery) can read - each
    // condition's column and every {COLUMN} placeholder in a value: the two
    // ways evaluateParsedQuery reaches getCellValue. Over-inclusive is fine
    // (it only fills more); a name that is not a column is ignored.
    function _pnbColumnsNamedIn(parsed) {
        var out = [];
        var strip = function (s) { return String(s).replace(/^\\{\\s*['"]?|['"]?\\s*\\}$/g, '').toUpperCase(); };
        (function walk(x, depth) {
            if (x == null || depth > 25) return;
            if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) walk(x[i], depth + 1); return; }
            if (typeof x !== 'object') return;
            for (var k in x) {
                if (!Object.prototype.hasOwnProperty.call(x, k)) continue;
                var v = x[k];
                if (typeof v === 'string') {
                    if (k === 'column') out.push(strip(v));
                    var m = v.match(/\\{[^}]+\\}/g);
                    if (m) for (var j = 0; j < m.length; j++) out.push(strip(m[j]));
                } else if (v && typeof v === 'object') {
                    walk(v, depth + 1);
                }
            }
        })(parsed, 0);
        return out;
    }

    // What an EMPTY cell will read as once filled - text length and whether it
    // renders a nested table - without filling it: the grouped view's width
    // sampling weighs hidden columns too, and reading '' there would shift the
    // visible widths. Rendered into a detached <td>, the same parse context.
    var _pnbLazyProbeTd = null;
    function _pnbLazyCellProbe(td, nameById) {
        var row = td.parentNode;
        var idx = row ? _pnbLazyRowIndex(row) : NaN;
        var map = (idx >= 0 && masterRowData[idx]) ? masterRowData[idx] : null;
        var raw = map ? map.get((nameById || _pnbLazyNameById())[td.getAttribute('data-column')]) : undefined;
        if (!_pnbLazyProbeTd) _pnbLazyProbeTd = document.createElement('td');
        _pnbLazyProbeTd.innerHTML = formatCellContent(raw);
        var out = {
            nested: !!_pnbLazyProbeTd.querySelector('.nested-json-container'),
            len: (_pnbLazyProbeTd.textContent || '').trim().length
        };
        _pnbLazyProbeTd.innerHTML = '';
        return out;
    }

    // --- Nested JSON Table Sorting Handler ---
'''))

# --- the build: hidden columns' cells EMPTY
edit('js/main.js', 'lazy-build-setup', crlf('''                        if (penumbraBigRenderNotice(data.length, finalColumnOrder.length)) {
                            await penumbraYieldToPaint();
                        }
'''), crlf('''                        // Hidden columns' cells are built EMPTY and filled on demand
                        // (penumbraFillLazyColumns). Not when two column names differ
                        // only by case: masterRowData keys are upper-cased, so a fill
                        // could not tell those two columns apart.
                        _pnbLazyCols.clear();
                        const _lazyBuild = penumbraLazyCellsEnabled()
                            && new Set(newColumnNames.map(c => String(c).toUpperCase())).size === newColumnNames.length;
                        let _lazyHiddenCount = 0;
                        if (_lazyBuild) {
                            finalColumnOrder.forEach(c => {
                                if (!visibleColumnsSet.has(c)) {
                                    _pnbLazyCols.add(String(columnNameToOriginalIndex[c]));
                                    _lazyHiddenCount++;
                                }
                            });
                        }
                        if (penumbraBigRenderNotice(data.length, finalColumnOrder.length, _lazyHiddenCount)) {
                            await penumbraYieldToPaint();
                        }
'''))

edit('js/main.js', 'lazy-build-cell', crlf('''                                const rawCellValue = rowData[colName];
                                const formattedCellData = formatCellContent(rawCellValue);
                                td.innerHTML = formattedCellData;
'''), crlf('''                                const rawCellValue = rowData[colName];
                                if (_lazyBuild && !isColumnVisible) {
                                    // EMPTY until something needs it (penumbraFillLazyColumns).
                                    // The @@JSON marker is a raw-string test, so it is set now,
                                    // exactly as below.
                                    td.setAttribute('data-pnb-lazy', '');
                                    if (rawCellValue != null && String(rawCellValue).indexOf('@@JSON') !== -1) {
                                        td.classList.add('cell-contains-nested-table');
                                    }
                                    tr.appendChild(td);
                                    return;
                                }
                                const formattedCellData = formatCellContent(rawCellValue);
                                td.innerHTML = formattedCellData;
'''))

# --- show paths
edit('js/main.js', 'lazy-show-default7', crlf('''                            // 4. Call the post-processing function ONCE at the end
                            postColumnToggle();
'''), crlf('''                            // The columns just shown may have been built EMPTY.
                            penumbraFillVisibleLazyColumns();

                            // 4. Call the post-processing function ONCE at the end
                            postColumnToggle();
'''))

edit('js/main.js', 'lazy-show-apply', crlf('''        // 9. Re-attach tbody
        if (nextSibling) parent.insertBefore(tbody, nextSibling);
        else parent.appendChild(tbody);
'''), crlf('''        // 9. Re-attach tbody
        if (nextSibling) parent.insertBefore(tbody, nextSibling);
        else parent.appendChild(tbody);

        // 9a. Columns just shown whose cells were built EMPTY get their content
        // now - before the grouped rebuild below clones them, and before anything
        // paints or reads them. (2026-09-30)
        penumbraFillVisibleLazyColumns();
'''))

edit('js/main.js', 'lazy-net-pagination', crlf('''    function applyPagination() {
        const rowsPerPage = $('#rowsPerPageSelector').val();
'''), crlf('''    function applyPagination() {
        // Safety net: a column shown by ANY path has its EMPTY cells filled
        // before this pass pages and formats them (no-op when none is pending).
        penumbraFillVisibleLazyColumns();
        const rowsPerPage = $('#rowsPerPageSelector').val();
'''))

edit('js/main.js', 'lazy-net-coltoggle', crlf('''    async function postColumnToggle() {
'''), crlf('''    async function postColumnToggle() {
        penumbraFillVisibleLazyColumns();   // shown columns built EMPTY (2026-09-30)
'''))

# --- grouping: every column the rebuild READS or SHOWS, before the clone
edit('js/main.js', 'lazy-group-rebuild', crlf('''        const selectedColumn = getCustomSelectValue('groupingColumnSelector') || currentGroupingColumn;
        if (!selectedColumn) {
            console.error("No grouping column selected for rebuild.");
            return;
        }
'''), crlf('''        const selectedColumn = getCustomSelectValue('groupingColumnSelector') || currentGroupingColumn;
        if (!selectedColumn) {
            console.error("No grouping column selected for rebuild.");
            return;
        }
        // Hidden columns' EMPTY cells (penumbraFillLazyColumns) are filled for
        // every column this rebuild SHOWS and the group summary column it reads,
        // before the rows are cloned into the groups. The grouping levels fill
        // their own column: level 0 below, levels 1-2 in _groupLevelLabeler.
        penumbraFillVisibleLazyColumns();
        if (currentGroupAgg && currentGroupAgg.column) penumbraFillLazyColumnsByName([currentGroupAgg.column]);
'''))

edit('js/main.js', 'lazy-group-level0', crlf('''            const colId = header.data('column');
'''), crlf('''            const colId = header.data('column');
            penumbraFillLazyColumns([colId]);   // a hidden grouping column's cells may be EMPTY
'''))

edit('js/main.js', 'lazy-group-levels', crlf('''        var colId = $hdr.data('column');
'''), crlf('''        var colId = $hdr.data('column');
        penumbraFillLazyColumns([colId]);   // a hidden level column's cells may be EMPTY (2026-09-30)
'''))

edit('js/main.js', 'lazy-group-agg', crlf('''        var _rcaAggColId = _rcaAggColHeader.length ? _rcaAggColHeader.data('column') : null;
'''), crlf('''        var _rcaAggColId = _rcaAggColHeader.length ? _rcaAggColHeader.data('column') : null;
        if (_rcaAggColId !== null) penumbraFillLazyColumns([_rcaAggColId]);   // hidden summary column (2026-09-30)
'''))

edit('js/main.js', 'lazy-group-widths', crlf('''        var _sampleCount = 0;
        for (var _gk in groups) {
'''), crlf('''        var _sampleCount = 0;
        var _cwNameById = _pnbLazyCols.size ? _pnbLazyNameById() : null;   // EMPTY-cell probe (2026-09-30)
        for (var _gk in groups) {
'''))

edit('js/main.js', 'lazy-group-widths-probe', crlf('''                    if ($sCell.length) {
                        var _cLen;
                        // Nested JSON cells: .text() returns ALL sub-table content
                        // concatenated, massively inflating length. Use a moderate
                        // fixed value so nested columns get reasonable width without
                        // hogging space from other columns.
                        if ($sCell.find('.nested-json-container').length) {
                            _cLen = 100; // treat nested tables as ~100 chars wide
                        } else {
                            _cLen = $sCell.text().trim().length;
                        }
'''), crlf('''                    if ($sCell.length) {
                        var _cLen;
                        // A hidden column's cell may still be EMPTY: weigh it by the
                        // text it WILL hold, as when every cell was built up front.
                        var _cProbe = $sCell[0].hasAttribute('data-pnb-lazy') ? _pnbLazyCellProbe($sCell[0], _cwNameById) : null;
                        // Nested JSON cells: .text() returns ALL sub-table content
                        // concatenated, massively inflating length. Use a moderate
                        // fixed value so nested columns get reasonable width without
                        // hogging space from other columns.
                        if (_cProbe ? _cProbe.nested : $sCell.find('.nested-json-container').length) {
                            _cLen = 100; // treat nested tables as ~100 chars wide
                        } else {
                            _cLen = _cProbe ? _cProbe.len : $sCell.text().trim().length;
                        }
'''))

# --- sort on a hidden column
edit('js/main.js', 'lazy-sort', crlf('''    function sortRows(rowsArray) {
        if (!sortCriteria || sortCriteria.length === 0) {
            return;
        }
'''), crlf('''    function sortRows(rowsArray) {
        if (!sortCriteria || sortCriteria.length === 0) {
            return;
        }
        // A criterion on a hidden column reads cell text below, and a hidden
        // column's cells may still be EMPTY (penumbraFillLazyColumns).
        if (rowsArray.length && rowsArray[0].closest && rowsArray[0].closest('#resultsTable, #groupedResultsContainer')) {
            penumbraFillLazyColumns(sortCriteria.map(function (c) { return c.colIndex; }));
        }
'''))

# --- format() / heatmap() / rewrite() rules
edit('js/main.js', 'lazy-cf-fill', crlf('''            // Pre-compute column mappings per table (cached by table element)
            const tableMetaCache = new Map();
'''), crlf('''            // A rule condition may name a hidden column, whose cells may still
            // be EMPTY: fill every column the conditions can read before the
            // per-row maps below are built from the cells. (2026-09-30)
            if (_pnbLazyCols.size) {
                let _cfNamed = [];
                activeRules.forEach(function (rule) {
                    if (rule.parsedCondition) _cfNamed = _cfNamed.concat(_pnbColumnsNamedIn(rule.parsedCondition));
                });
                if (_cfNamed.length) penumbraFillLazyColumnsByName(_cfNamed);
            }

            // Pre-compute column mappings per table (cached by table element)
            const tableMetaCache = new Map();
'''))

edit('js/main.js', 'lazy-cf-read', crlf('''                rowDataMap.set(colName, _readComparisonCellText(rowEl.cells[pos]));
'''), crlf('''                const _cfCell = rowEl.cells[pos];
                // An EMPTY cell reads '' either way; skip the DOM read.
                rowDataMap.set(colName, (_cfCell && _cfCell.hasAttribute('data-pnb-lazy')) ? '' : _readComparisonCellText(_cfCell));
'''))

edit('js/main.js', 'lazy-heat', crlf('''        const runHeatPass = () => {
            if (!window.PenumbraHeat) return;
            const H = window.PenumbraHeat;
'''), crlf('''        const runHeatPass = () => {
            if (!window.PenumbraHeat) return;
            const H = window.PenumbraHeat;
            // Heat columns are read from their cells; a hidden one's may be EMPTY.
            if (_pnbLazyCols.size) {
                heatRules.forEach(function (rule) { if (rule.columns) penumbraFillLazyColumnsByName(rule.columns); });
            }
'''))

edit('js/main.js', 'lazy-rewrite', crlf('''            const hashCellPos = (cellIndexById['#'] !== undefined) ? cellIndexById['#'] : 0;
'''), crlf('''            const hashCellPos = (cellIndexById['#'] !== undefined) ? cellIndexById['#'] : 0;
            // Rewrites write into their target cells: a hidden target whose cells
            // are still EMPTY is filled first, so a rewritten cell is always a
            // built one (resetCellStates restores built cells). (2026-09-30)
            if (_pnbLazyCols.size) {
                penumbraFillLazyColumnsByName(rewriteRules.map(function (r) { return r.targetColumn; }));
            }
'''))

# --- copy / template readers
edit('js/main.js', 'lazy-copy-distinct', crlf('''                                if (colId !== null) {
                                    found = true;
'''), crlf('''                                if (colId !== null) {
                                    found = true;
                                    penumbraFillLazyColumns([colId]);   // a hidden column's cells may be EMPTY
'''))

edit('js/main.js', 'lazy-copy-dialog', crlf('''                        const colIdSingleCol = headerSingleCol.data('column');
'''), crlf('''                        const colIdSingleCol = headerSingleCol.data('column');
                        penumbraFillLazyColumns([colIdSingleCol]);   // a hidden column's cells may be EMPTY
'''))

edit('js/main.js', 'lazy-template', crlf('''        if (tplHasCalls) {
            PenumbraTemplate.collectRefs(tplSegments).forEach(r => templatePlaceholdersUpper.push(r));
        }
'''), crlf('''        if (tplHasCalls) {
            PenumbraTemplate.collectRefs(tplSegments).forEach(r => templatePlaceholdersUpper.push(r));
        }
        // Placeholders may name hidden columns, whose cells may still be EMPTY.
        penumbraFillLazyColumnsByName(templatePlaceholdersUpper);
'''))

edit('js/main.js', 'lazy-nested-plan', crlf('''        const sampleMax = Math.min($rows.length, 50);
'''), crlf('''        const sampleMax = Math.min($rows.length, 50);
        // Hidden @@JSON parents may still be EMPTY (penumbraFillLazyColumns):
        // fill each one whose sampled rows carry nested data, so the plan sees
        // the same rendered cells the build used to make. (2026-09-30)
        if (_pnbLazyCols.size) {
            const _npIdx = [];
            for (let i = 0; i < sampleMax; i++) {
                const _ix = _pnbLazyRowIndex($rows[i]);
                if (_ix >= 0 && masterRowData[_ix]) _npIdx.push(_ix);
            }
            const _npFill = [];
            const _npThs = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th[data-colname]');
            for (let t = 0; t < _npThs.length; t++) {
                const _id = _npThs[t].getAttribute('data-column');
                if (!_pnbLazyCols.has(_id)) continue;
                const _key = String(_npThs[t].getAttribute('data-colname')).toUpperCase();
                for (let k = 0; k < _npIdx.length; k++) {
                    const _v = masterRowData[_npIdx[k]].get(_key);
                    if (_v != null && String(_v).indexOf('@@JSON') !== -1) { _npFill.push(_id); break; }
                }
            }
            if (_npFill.length) penumbraFillLazyColumns(_npFill);
        }
'''))

# --- tables rebuilt / restored outside the main build
edit('js/main.js', 'lazy-rebuild-master', crlf('''        _flatSearchAppliedFor = null; // rebuilt rows: search-class stamp unknown
'''), crlf('''        _flatSearchAppliedFor = null; // rebuilt rows: search-class stamp unknown
        _pnbLazyCols.clear();         // every cell below is built in full
'''))

edit('js/main.js', 'lazy-restore-grouped', crlf('''                    $('#groupedResultsContainer').html(originalDataBeforeSnapshot.groupedHTML).show();
'''), crlf('''                    $('#groupedResultsContainer').html(originalDataBeforeSnapshot.groupedHTML).show();
                    // The saved grouped view can hold hidden columns' still-EMPTY cell
                    // clones; the full flat rebuild above has just cleared the set.
                    document.querySelectorAll('#groupedResultsContainer td[data-pnb-lazy]').forEach(function (td) {
                        _pnbLazyCols.add(td.getAttribute('data-column'));
                    });
'''))

# --- the big-render notice: an EMPTY cell costs ~1/10 of a built one
edit('js/main.js', 'lazy-notice-comment', crlf('''    // Measured 2026-08-20: cost tracks CELLS (rows x columns), ~18 us each and
    // roughly linear to ~2M cells. 25,000 rows of an 83-column report is ~45 s.
    // Hiding columns does NOT help - a <td> is created for every column and
    // hidden ones merely get display:none - so the copy steers toward fewer ROWS.
    // That guidance is AUTHOR-ONLY; see penumbraBigRenderNotice() below.
'''), crlf('''    // Measured 2026-08-20: cost tracks CELLS (rows x columns), ~18 us each and
    // roughly linear to ~2M cells. 25,000 rows of an 83-column report is ~45 s.
    // Since 2026-09-30 a HIDDEN column's cells are built empty (see
    // penumbraFillLazyColumns): ~2 us each, so they count as a tenth of a cell
    // (_PNB_EMPTY_CELL_WEIGHT) and hiding columns does help. The guidance is
    // AUTHOR-ONLY; see penumbraBigRenderNotice() below.
'''))

edit('js/main.js', 'lazy-notice-weight', crlf('''    const _PNB_RENDER_ESTIMATE_PAD = 1.50;
'''), crlf('''    const _PNB_RENDER_ESTIMATE_PAD = 1.50;
    // What one EMPTY hidden-column cell costs next to a built one (measured
    // 2026-09-30: ~2 us vs ~18 us). Counted in the estimate AND in the recorded
    // rate, so the two stay in the same unit.
    const _PNB_EMPTY_CELL_WEIGHT = 0.1;
'''))

edit('js/main.js', 'lazy-notice-fn', crlf('''    function penumbraBigRenderNotice(rowCount, colCount) {
        const rows = rowCount || 0;
        const cols = colCount || 0;
        const cells = rows * (cols + 1);            // +1 for the always-built '#' column
'''), crlf('''    function penumbraBigRenderNotice(rowCount, colCount, emptyColCount) {
        const rows = rowCount || 0;
        const cols = colCount || 0;
        // Built cells in full, EMPTY (hidden-column) cells at their weight; +1
        // for the always-built '#' column.
        const empty = Math.min(cols, emptyColCount || 0);
        const cells = Math.round(rows * ((cols - empty + 1) + empty * _PNB_EMPTY_CELL_WEIGHT));
'''))

edit('js/main.js', 'lazy-notice-tip', crlf('''                .text('To make this faster, narrow the report to fewer rows with a filter or a date range. Hiding columns does not help.')
'''), crlf('''                .text('To make this faster, narrow the report to fewer rows with a filter or a date range, or hide columns nobody needs.')
'''))

edit('js/main.js', 'lazy-notice-remediation-comment', crlf('''        // Remediation is AUTHOR-ONLY (2026-08-21). "Narrow the report" and
        // "hiding columns does not help" both describe edits to the report
'''), crlf('''        // Remediation is AUTHOR-ONLY (2026-08-21). "Narrow the report" and
        // "hide columns" both describe edits to the report
'''))

# --- the switch for everyone: index.php -> penumbra_vars.lazyCellsOff
edit('index.php', 'lazy-switch', '''      noadm: <?php echo json_encode((bool)$noadm); ?>,
''', '''      noadm: <?php echo json_encode((bool)$noadm); ?>,
      // Hidden columns' cells are built EMPTY and filled on demand (main.js
      // penumbraFillLazyColumns, 2026-09-30). ROLLBACK SWITCH: an empty
      // js/penumbra_lazycells.off builds every cell up front again - no deploy.
      lazyCellsOff: <?php echo json_encode(file_exists(__DIR__ . '/js/penumbra_lazycells.off')); ?>,
''')

# --- the nested-column branches read their PARENT column's cells: the plan
#     filled it when it found nested data, but fill it here too, so these
#     readers never depend on that (belt and braces; no-op once filled).
edit('js/main.js', 'lazy-copy-distinct-nested', crlf('''                            if (nestedMatch) {
                                found = true;
'''), crlf('''                            if (nestedMatch) {
                                found = true;
                                penumbraFillLazyColumns([nestedMatch.colId]);   // a hidden parent's cells may be EMPTY
'''))

edit('js/main.js', 'lazy-copy-dialog-nested', crlf('''                    if (nestedParent && nestedSub && nestedColId != null) {
'''), crlf('''                    if (nestedParent && nestedSub && nestedColId != null) {
                        penumbraFillLazyColumns([nestedColId]);   // a hidden parent's cells may be EMPTY
'''))
