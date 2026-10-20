# =============================================================================
# BIGPERF (2026-10-19) - the patches to js/main.js: main-thread blocking on large
# report pages (?id=dirsearch: 24,901 rows x 18 columns, 480,000 elements) outside Find.
#
#   py -3 patch_bp.py SRC_ROOT OUT_ROOT     read js/main.js from SRC_ROOT (the app layout),
#                                           write the patched copy to OUT_ROOT
#   py -3 patch_bp.py SRC_ROOT --check      anchor counts only, nothing written
#
# Every anchor must occur exactly once and the marker may not be there yet, or nothing
# is written. main.js is CRLF (the anchors are converted). Re-apply to the CURRENT live
# copy at deploy time: other sessions deploy main.js often. None of these anchors
# overlaps find round 3's (find\patch3.py: _pnbHotkeyUiBusy, findHost.runSearch, the
# find.paged line, previousSearchValue), so either can go first.
#   kbdroots   syncKbd's body observer swept the WHOLE document (four querySelectorAll
#              walks, 12-30 ms) 400 ms after any node came or went: now only what was
#              added (whole document past 5,000 added roots; the tab bar as before).
#   zebra      applyZebraStriping wrote both stripe classes on every shown row (remove +
#              add) on every call - each write restyles the row's cells: now only a row
#              whose stripe changes.
#   epq        evaluateParsedQuery re-derived the search side of a condition (quote strip,
#              {COLUMN} test, number shape, range list, accounting form) and the column
#              key for EVERY cell of every row: now once per distinct value; the cell side
#              tests that cannot matter (a number shape for a text term) are skipped.
# =============================================================================
import os, sys

def eol_of(t):
    return '\r\n' if t.count('\r\n') * 2 > t.count('\n') else '\n'

def conv(s, eol):
    return s.replace('\r\n', '\n').replace('\n', eol)

MARKER = '(2026-10-19, bigperf)'

# ---- kbdroots ---------------------------------------------------------------------
KBD_SIG_OLD = r"""        function syncKbd(root) {
            var r = root || document;
"""
KBD_SIG_NEW = r"""        function syncKbd(root, roots) {
            var r = root || document;
            // roots (2026-10-19, bigperf): the nodes the body observer below saw ADDED -
            // every match at and under them, instead of the whole document
            var all = function (sel) {
                if (!roots) return r.querySelectorAll(sel);
                var out = [];
                for (var i = 0; i < roots.length; i++) {
                    var x = roots[i];
                    if (x.matches && x.matches(sel)) out.push(x);
                    if (x.firstElementChild) { var f = x.querySelectorAll(sel); for (var fi = 0; fi < f.length; fi++) out.push(f[fi]); }
                }
                return out;
            };
"""
KBD_PR_OLD = r"""            var pr = r.querySelectorAll('.pivot-item-remove');
"""
KBD_PR_NEW = r"""            var pr = all('.pivot-item-remove');
"""
KBD_PC_OLD = r"""            var pc = r.querySelectorAll('.pivot-drop-zone .pivot-column-item');
"""
KBD_PC_NEW = r"""            var pc = all('.pivot-drop-zone .pivot-column-item');
"""
KBD_CM_OLD = r"""            var cm = r.querySelectorAll('.CodeMirror textarea');
"""
KBD_CM_NEW = r"""            var cm = all('.CodeMirror textarea');
"""
KBD_SH_OLD = r"""            var sh = r.querySelectorAll('#tableHeader th[data-colname], #groupedResultsContainer th[data-colname]');
"""
KBD_SH_NEW = r"""            var sh = all('#tableHeader th[data-colname], #groupedResultsContainer th[data-colname]');
"""
KBD_OBS_OLD = r"""        var pendKE = false;
        var obKE = new MutationObserver(function () { if (window.__pnbA11ySuspended) return; if (pendKE) return; pendKE = true; setTimeout(function () { pendKE = false; syncKbd(); }, 400); });
        if (document.body) obKE.observe(document.body, { childList: true, subtree: true });
"""
KBD_OBS_NEW = r"""        // Only what was ADDED is swept (2026-10-19, bigperf): the whole-document pass
        // (four querySelectorAll walks: 12 ms on a 25,000-row report here, 30 ms on a
        // laptop) ran 400 ms after ANY node came or went - a page turn, a search, the
        // search box's suggestions, a tooltip. Nodes added while the a11y observers are
        // paused (the build, a lazy fill, a theme switch) wait for the sweep the resume
        // nudge starts; past 5,000 added roots the whole page is swept once. The tab
        // bar's stamps (not under any root) are redone on every sweep, as before.
        var pendKE = false, rootsKE = [], allKE = false, seqKE = 0;
        var obKE = new MutationObserver(function (muts) {
            for (var mi = 0; mi < muts.length && !allKE; mi++) {
                var ad = muts[mi].addedNodes;
                for (var ai = 0; ai < ad.length; ai++) {
                    if (ad[ai].nodeType !== 1) continue;
                    if (rootsKE.length >= 5000) { allKE = true; rootsKE = []; break; }
                    rootsKE.push(ad[ai]);
                }
            }
            if (window.__pnbA11ySuspended) return;
            if (pendKE || (!allKE && !rootsKE.length)) return;
            pendKE = true;
            setTimeout(function () {
                pendKE = false;
                var roots = rootsKE, whole = allKE, keep = [], i, p;
                rootsKE = []; allKE = false;
                if (whole) { syncKbd(); return; }
                var stamp = ++seqKE;
                for (i = 0; i < roots.length; i++) roots[i].__pnbKbdRoot = stamp;
                for (i = 0; i < roots.length; i++) {
                    if (!roots[i].isConnected) continue;
                    // a root inside another one is swept with it
                    for (p = roots[i].parentNode; p && p !== document.body; p = p.parentNode) { if (p.__pnbKbdRoot === stamp) break; }
                    if (!p || p === document.body) keep.push(roots[i]);
                }
                syncKbd(null, keep);
            }, 400);
        });
        if (document.body) obKE.observe(document.body, { childList: true, subtree: true });
"""

# ---- zebra --------------------------------------------------------------------------
ZEBRA_OLD = r"""                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    // Fast check for display:none
                    if (row.style.display !== 'none') {
                        // Native class manipulation avoids jQuery overhead
                        row.classList.remove('zebra-light', 'zebra-dark');
                        row.classList.add(visibleIndex % 2 === 0 ? 'zebra-light' : 'zebra-dark');
                        visibleIndex++;
                    }
                }
"""
ZEBRA_NEW = r"""                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    // Fast check for display:none
                    if (row.style.display !== 'none') {
                        // Only a row whose stripe changes is written (2026-10-19, bigperf):
                        // a remove + add on every shown row restyled its cells on every
                        // call (a page turn, a search, a format pass).
                        const cl = row.classList, want = (visibleIndex % 2 === 0) ? 'zebra-light' : 'zebra-dark';
                        if (!cl.contains(want) || cl.contains(want === 'zebra-light' ? 'zebra-dark' : 'zebra-light')) {
                            cl.remove('zebra-light', 'zebra-dark');
                            cl.add(want);
                        }
                        visibleIndex++;
                    }
                }
"""

# ---- epq ----------------------------------------------------------------------------
EPQ_HELPERS_OLD = r"""    function evaluateParsedQuery(rowDataMap, parsedQuery, visibleColumns, requireRowMatch) {
        if (!parsedQuery || parsedQuery.length === 0)
            return true;
"""
EPQ_HELPERS_NEW = r"""    // The column key getCellValue reads ({COLUMN} or COLUMN, any case) and the search
    // side of a condition (2026-10-19, bigperf): pure functions of their text, worked
    // out once per distinct value - they were re-derived for EVERY cell of every row,
    // 500,000 times a search on a 25,000 x 20 report. Dates are not here: a relative
    // date (TODAY-30) is still read per call.
    const _epqColKeyCache = new Map();
    function _epqColKey(colName) {
        let k = _epqColKeyCache.get(colName);
        if (k === undefined) {
            k = String(colName).replace(/^\{\s*['"]?|['"]?\s*\}$/g, '').toUpperCase();
            if (_epqColKeyCache.size >= 2000) _epqColKeyCache.clear();
            _epqColKeyCache.set(colName, k);
        }
        return k;
    }
    // What testCondition reads from a compare value (already quote-stripped).
    function _epqPrepOf(cv) {
        const s = String(cv);
        const num = _epqIsNumericStr(cv);
        return {
            cv: cv, ph: null,
            isEmpty: s.toLowerCase() === 'empty',
            isExact: s.startsWith('//') && s.endsWith('//'),
            isSlash: s.startsWith('/') && s.length > 1,
            cvNumeric: num,
            rangeCand: !num && (s.includes(',') || s.includes('-')),
            rangeChars: /^[\d,\-\.\$%\s]+$/.test(cv),
            cvAcct: /^\([\d,.$%]+\)$/.test(s.trim()),
            cleanSearch: s.toLowerCase().trim()
        };
    }
    // A search value -> its _epqPrepOf, or { ph: the {COLUMN} token } (that value is the row's).
    const _epqPrepCache = new Map();
    function _epqPrep(searchValue) {
        const key = String(searchValue);
        let p = _epqPrepCache.get(key);
        if (p === undefined) {
            const cv = stripWrappingQuotePair(key.trim());
            const m = cv.match(/^\{([^}]+)\}$/);
            p = m ? { cv: cv, ph: m[0] } : _epqPrepOf(cv);
            if (_epqPrepCache.size >= 500) _epqPrepCache.clear();
            _epqPrepCache.set(key, p);
        }
        return p;
    }

    function evaluateParsedQuery(rowDataMap, parsedQuery, visibleColumns, requireRowMatch) {
        if (!parsedQuery || parsedQuery.length === 0)
            return true;
"""
EPQ_COLKEY_OLD = r"""            // Support {COLUMN} or just COLUMN
            const cleanColName = String(colName).replace(/^\{\s*['"]?|['"]?\s*\}$/g, '').toUpperCase();

            const rawValue = rowDataMap.get(cleanColName) || "";
"""
EPQ_COLKEY_NEW = r"""            // Support {COLUMN} or just COLUMN
            const cleanColName = _epqColKey(colName);

            const rawValue = rowDataMap.get(cleanColName) || "";
"""
EPQ_TAGS_OLD = r"""            // Trim whitespace to ensure clean matching
            return decodedValue.replace(/<[^>]*>/g, '').trim();
        }
            ;

        const testCondition = (op, searchValue, cellText) => {
"""
EPQ_TAGS_NEW = r"""            // Trim whitespace to ensure clean matching
            return (decodedValue.indexOf('<') === -1 ? decodedValue : decodedValue.replace(/<[^>]*>/g, '')).trim();
        }
            ;

        const testCondition = (op, searchValue, cellText) => {
"""
EPQ_HEAD_OLD = r"""            let compareValue = stripWrappingQuotePair(String(searchValue).trim());

            // --- Resolve {COLUMN} placeholders ---
            // The WHOLE token goes to getCellValue, whose brace strip also drops spaces and
            // quotes inside the braces ({ BUDGET } = {BUDGET}), like the column side.
            const placeholderMatch = compareValue.match(/^\{([^}]+)\}$/);
            if (placeholderMatch) {
                compareValue = getCellValue(placeholderMatch[0]);
            }
            // -------------------------------------

            if (compareValue.toLowerCase() === 'empty') {
                return (op === '=') ? cellText === '' : cellText !== '';
            }

            // Regex Logic (compiled once per distinct pattern via _epqGetRegex)
            if (String(compareValue).startsWith('//') && String(compareValue).endsWith('//')) {
"""
EPQ_HEAD_NEW = r"""            // The search side, worked out once per distinct value (_epqPrep, 2026-10-19,
            // bigperf) instead of once per cell.
            let sp = _epqPrep(searchValue);

            // --- Resolve {COLUMN} placeholders ---
            // The WHOLE token goes to getCellValue, whose brace strip also drops spaces and
            // quotes inside the braces ({ BUDGET } = {BUDGET}), like the column side.
            // (The resolved value is this row's: its facts are derived here, not kept.)
            if (sp.ph) {
                sp = _epqPrepOf(getCellValue(sp.ph));
            }
            const compareValue = sp.cv;
            // -------------------------------------

            if (sp.isEmpty) {
                return (op === '=') ? cellText === '' : cellText !== '';
            }

            // Regex Logic (compiled once per distinct pattern via _epqGetRegex)
            if (sp.isExact) {
"""
EPQ_SLASH_OLD = r"""            if (op === '!/' || (String(compareValue).startsWith('/') && String(compareValue).length > 1)) {
"""
EPQ_SLASH_NEW = r"""            if (op === '!/' || sp.isSlash) {
"""
EPQ_RANGE_OLD = r"""            const isRangeCandidate = !isNumericStr(compareValue) && (String(compareValue).includes(',') || String(compareValue).includes('-'));
            if (isNumericStr(cellText) && isRangeCandidate) {
                // Ensure search string contains only valid range chars (digits, commas, dashes, $, %, spaces, dots)
                if (/^[\d,\-\.\$%\s]+$/.test(compareValue)) {
"""
EPQ_RANGE_NEW = r"""            // (The search side's tests first: the cell's number shape only when it can matter.)
            const isRangeCandidate = sp.rangeCand;
            if (isRangeCandidate && isNumericStr(cellText)) {
                // Ensure search string contains only valid range chars (digits, commas, dashes, $, %, spaces, dots)
                if (sp.rangeChars) {
"""
EPQ_NUM_OLD = r"""            if (isNumericStr(cellText) && isNumericStr(compareValue)) {
"""
EPQ_NUM_NEW = r"""            if (sp.cvNumeric && isNumericStr(cellText)) {
"""
EPQ_ACCT_OLD = r"""            if (/^\([\d,.$%]+\)$/.test(cellText.trim()) || /^\([\d,.$%]+\)$/.test(String(compareValue).trim())) {
"""
EPQ_ACCT_NEW = r"""            if (sp.cvAcct || /^\([\d,.$%]+\)$/.test(cellText.trim())) {
"""
EPQ_TEXT_OLD = r"""            const cleanCell = cellText.toLowerCase().trim();
            const cleanSearch = compareValue.toLowerCase().trim();
"""
EPQ_TEXT_NEW = r"""            const cleanCell = cellText.toLowerCase().trim();
            const cleanSearch = sp.cleanSearch;
"""

# ---- rows: one walk of the table per page turn --------------------------------------
# applyPagination, then updateFilteredResultCount and _pnbFillDisplayedRows each walked
# the 25,000 rows again (a querySelectorAll over 480,000 elements, then a loop): the
# count now takes applyPagination's row list, the fill the rows it just put on screen.
# Other callers pass nothing and walk as before.
ROWS_COUNT_OLD = r"""    function updateFilteredResultCount() {
        // PERF: Native DOM count instead of two jQuery :not() scans on 90K rows
        const allTrs = document.querySelectorAll("#resultsTable tbody tr");
"""
ROWS_COUNT_NEW = r"""    function updateFilteredResultCount(rowsAll) {
        // PERF: Native DOM count instead of two jQuery :not() scans on 90K rows
        // (rowsAll: applyPagination's own list of the same rows - 2026-10-19, bigperf)
        const allTrs = rowsAll || document.querySelectorAll("#resultsTable tbody tr");
"""
ROWS_FILL_OLD = r"""    // The flat rows on screen (applyPagination runs this after its page loop).
    function _pnbFillDisplayedRows() {
        if (!_pnbLazyCols.size) return 0;
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
"""
ROWS_FILL_NEW = r"""    // The flat rows on screen (applyPagination runs this after its page loop, and
    // hands over the rows it just put on screen - 2026-10-19, bigperf).
    function _pnbFillDisplayedRows(shownRows) {
        if (!_pnbLazyCols.size) return 0;
        if (shownRows) return _pnbFillRows(shownRows);
        var all = document.querySelectorAll('#resultsTable > tbody > tr');
"""
ROWS_ALL_OLD = r"""        if (rowsPerPage === 'all' || totalRows === 0) {
            for (let pi = 0; pi < filteredRows.length; pi++) {
                filteredRows[pi].style.display = '';
            }
"""
ROWS_ALL_NEW = r"""        // The rows this leaves on screen (handed to the fill and the count below).
        let _pnbPageRows = filteredRows;
        if (rowsPerPage === 'all' || totalRows === 0) {
            for (let pi = 0; pi < filteredRows.length; pi++) {
                filteredRows[pi].style.display = '';
            }
"""
ROWS_PAGE_OLD = r"""            // Hide all filtered rows, then show only the current page
            for (let pi = 0; pi < filteredRows.length; pi++) {
                filteredRows[pi].style.display = (pi >= startRow && pi < endRow) ? '' : 'none';
            }
"""
ROWS_PAGE_NEW = r"""            // Hide all filtered rows, then show only the current page
            for (let pi = 0; pi < filteredRows.length; pi++) {
                filteredRows[pi].style.display = (pi >= startRow && pi < endRow) ? '' : 'none';
            }
            _pnbPageRows = filteredRows.slice(startRow, endRow);
"""
ROWS_CALLS_OLD = r"""        _pnbFillDisplayedRows();

        // AFTER the page loop, not before it (2026-09-30). The count reads only
"""
ROWS_CALLS_NEW = r"""        _pnbFillDisplayedRows(_pnbPageRows);

        // AFTER the page loop, not before it (2026-09-30). The count reads only
"""
ROWS_COUNTCALL_OLD = r"""        // columns included, ~0.4 s); after it, one page.
        updateFilteredResultCount();
"""
ROWS_COUNTCALL_NEW = r"""        // columns included, ~0.4 s); after it, one page.
        updateFilteredResultCount(allRows);
"""

# ---- css/main.css: the carousel's page lock ---------------------------------------------
# html:has(#chartCarouselOverlay.cc-persistent) made EVERY change anywhere in the page (a
# row shown or hidden, a cell written, a class on body) cost the next style recalc a walk
# of the whole document looking for the overlay: 15-23 ms per change at 550,000 elements,
# against 2-3 ms without it (bprof --hasbisect). The overlay is always a child of <body>
# (main.js appends it there), so the same test looks two levels down instead.
CSS_CC_OLD = r"""/* The report page BEHIND a persistent overlay must not mint scrollbars around
   the tile - the overlay IS the frame's viewport. */
html:has(#chartCarouselOverlay.cc-persistent),
html:has(#chartCarouselOverlay.cc-persistent) body {
"""
CSS_CC_NEW = r"""/* The report page BEHIND a persistent overlay must not mint scrollbars around
   the tile - the overlay IS the frame's viewport. The overlay is always a child
   of <body> (main.js appends it there): "> body >" keeps the test two levels
   deep. Without it every change anywhere in the page (a row shown, a cell
   written) made the next style recalc walk the whole document looking for the
   overlay - 15-23 ms per change on a 25,000-row report (2026-10-19, bigperf). */
html:has(> body > #chartCarouselOverlay.cc-persistent),
html:has(> body > #chartCarouselOverlay.cc-persistent) body {
"""

PATCHES = [
    ('css/main.css', MARKER, [
        ('css_cc', CSS_CC_OLD, CSS_CC_NEW),
    ]),
    ('js/main.js', MARKER, [
        ('kbd_sig', KBD_SIG_OLD, KBD_SIG_NEW),
        ('kbd_pr', KBD_PR_OLD, KBD_PR_NEW),
        ('kbd_pc', KBD_PC_OLD, KBD_PC_NEW),
        ('kbd_cm', KBD_CM_OLD, KBD_CM_NEW),
        ('kbd_sh', KBD_SH_OLD, KBD_SH_NEW),
        ('kbd_obs', KBD_OBS_OLD, KBD_OBS_NEW),
        ('zebra', ZEBRA_OLD, ZEBRA_NEW),
        ('epq_help', EPQ_HELPERS_OLD, EPQ_HELPERS_NEW),
        ('epq_col', EPQ_COLKEY_OLD, EPQ_COLKEY_NEW),
        ('epq_tags', EPQ_TAGS_OLD, EPQ_TAGS_NEW),
        ('epq_head', EPQ_HEAD_OLD, EPQ_HEAD_NEW),
        ('epq_slash', EPQ_SLASH_OLD, EPQ_SLASH_NEW),
        ('epq_range', EPQ_RANGE_OLD, EPQ_RANGE_NEW),
        ('epq_num', EPQ_NUM_OLD, EPQ_NUM_NEW),
        ('epq_acct', EPQ_ACCT_OLD, EPQ_ACCT_NEW),
        ('epq_text', EPQ_TEXT_OLD, EPQ_TEXT_NEW),
        ('rows_count', ROWS_COUNT_OLD, ROWS_COUNT_NEW),
        ('rows_fill', ROWS_FILL_OLD, ROWS_FILL_NEW),
        ('rows_all', ROWS_ALL_OLD, ROWS_ALL_NEW),
        ('rows_page', ROWS_PAGE_OLD, ROWS_PAGE_NEW),
        ('rows_calls', ROWS_CALLS_OLD, ROWS_CALLS_NEW),
        ('rows_ccall', ROWS_COUNTCALL_OLD, ROWS_COUNTCALL_NEW),
    ]),
]

def main():
    if len(sys.argv) < 3: raise SystemExit('usage: patch_bp.py SRC_ROOT OUT_ROOT|--check')
    src, out = sys.argv[1], sys.argv[2]
    check = (out == '--check')
    results, problems = [], []
    for rel, marker, edits in PATCHES:
        p = os.path.join(src, rel)
        t = open(p, 'rb').read().decode('utf-8', 'surrogateescape')
        eol = eol_of(t)
        if marker in t: problems.append('%s: already patched (%r present)' % (rel, marker)); continue
        for name, old, new in edits:
            o = conv(old, eol)
            n = t.count(o)
            print('  %-14s %-10s anchor x%d' % (rel, name, n))
            if n != 1: problems.append('%s: %s anchor found %d times' % (rel, name, n)); continue
            t = t.replace(o, conv(new, eol))
        results.append((rel, t))
    if problems:
        for x in problems: print('PROBLEM: ' + x)
        raise SystemExit('nothing written')
    if check:
        print('CHECK OK (nothing written)'); return
    for rel, t in results:
        d = os.path.join(out, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        open(d, 'wb').write(t.encode('utf-8', 'surrogateescape'))
        print('wrote ' + d)

if __name__ == '__main__':
    main()
