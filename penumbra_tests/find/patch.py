# =============================================================================
# FIND IN RESULTS round 1 (2026-10-19) - the patches to existing files.
#
#   py -3 patch.py SRC_ROOT OUT_ROOT      read the four files from SRC_ROOT (the app
#                                         layout), write the patched copies to OUT_ROOT
#   py -3 patch.py SRC_ROOT --check       anchor counts only, nothing written
#
# Every anchor must occur exactly once and no marker may be there yet, or nothing
# is written. Line endings follow each file (main.js is CRLF, the rest LF). Re-apply
# to the CURRENT live copies at deploy time (another session may have moved them).
# New files (js/penumbra_find.js, css/penumbra_find.css) are not made here.
# =============================================================================
import os, sys

def eol_of(t):
    return '\r\n' if t.count('\r\n') * 2 > t.count('\n') else '\n'

def conv(s, eol):
    return s.replace('\r\n', '\n').replace('\n', eol)

# ---- js/main.js -------------------------------------------------------------
MAIN_HOOK_OLD = """        applyConditionalFormatting();
        applyRewriteRules();
        applyZebraStriping();
    }

    $(document).on('click', '#viewLastPageLink', function (e) {
"""

MAIN_HOOK_NEW = r"""        applyConditionalFormatting();
        applyRewriteRules();
        applyZebraStriping();
        // Find in results (2026-10-19): the rows now on screen - Find repaints its
        // matches, and reads them again when the rows or the columns changed.
        if (window.Penumbra && window.Penumbra.find && window.Penumbra.find.paged) { try { window.Penumbra.find.paged(); } catch (_findErr) { } }
    }

    // ---- Find in results (2026-10-19, find round 1) ----
    // What js/penumbra_find.js needs from inside this closure: the rows, the
    // paging and the search. Ctrl+F finds text in the FLAT table without
    // filtering it, on every page - rows past the first page are built with
    // EMPTY cells (lazy rows) and the other pages are display:none, so the
    // browser's own find sees one page. Inert without the module.
    window.Penumbra = window.Penumbra || {};
    window.Penumbra.findHost = {
        // The flat table is the view on screen, with rows (round 1 covers it alone).
        flatActive: function () {
            var T = document.getElementById('resultsTable');
            if (!T || !masterRowData || !masterRowData.length) return false;
            if (document.body.classList.contains('pnb-data-hidden')) return false;
            if ($('#groupedResultsContainer').is(':visible') || $('#pivot-output-container').is(':visible')) return false;
            return $(T).is(':visible');
        },
        busy: function () { return _pnbHotkeyUiBusy(); },
        typing: function (el) { return _pnbIsTypingTarget(el); },
        rows: function () { return masterRowData; },
        rowIndex: function (tr) { return _pnbLazyRowIndex(tr); },
        renderOpts: function (col) { return _pnbColRenderOpts(col); },
        // The HTML the build writes for a value (a nested @@JSON table is read from it).
        cellHtml: function (raw, col) { var ro = _pnbColRenderOpts(col); return formatCellContent(raw, ro ? ro.deep : undefined); },
        // Put a row the search keeps on screen: turn to its page (applyPagination
        // fills it). True when it is displayed.
        showRow: function (tr) {
            if (!tr || !tr.isConnected || tr.classList.contains('search-hidden')) return false;
            if (tr.style.display !== 'none') return true;
            var rpp = parseInt($('#rowsPerPageSelector').val(), 10);
            if (!(rpp > 0)) return false;
            // counted as applyPagination pages: the rows the search keeps, in order
            var all = document.querySelectorAll('#resultsTable tbody tr'), k = 0, i;
            for (i = 0; i < all.length && all[i] !== tr; i++) {
                if (!all[i].classList.contains('search-hidden')) k++;
            }
            if (i >= all.length) return false;
            currentPage = Math.floor(k / rpp) + 1;
            applyPagination();
            return tr.style.display !== 'none';
        },
        fillRow: function (tr) { return _pnbFillRows([tr]); },
        wrapper: function () { return _pnbVisibleResultsWrapper(); },
        // The search the flat table shows ('' = none).
        searchApplied: function () { return String(_flatSearchAppliedFor || ''); },
        // Rows the search keeps for q, over every row - counted as runTableSearch's
        // flat branch keeps them (Find's "Filter to N rows" names the search's own N).
        searchCount: function (q) {
            var sv = penumbraTakeSrcModifier(String(q || '').trim()).query, rr = false;
            if (/^__ROW\s+/i.test(sv)) { rr = true; sv = sv.replace(/^__ROW\s+/i, ''); }
            if (!sv.trim()) return masterRowData.length;
            var cols = penumbraFlatSearchColumns(Object.keys($('#resultsTable').data('columnNameToOriginalIndex') || {}));
            var pq = parseAdvancedQuery(sv, cols), n = 0;
            for (var i = 0; i < masterRowData.length; i++) {
                masterRowData[i].set('#', String(i + 1));
                if (evaluateParsedQuery(masterRowData[i], pq, cols, rr)) n++;
            }
            return n;
        },
        // Does q join its parts with OR? The search has no parentheses, so one more
        // "AND term" would bind to the last OR branch only.
        searchHasOr: function (q) {
            var sv = penumbraTakeSrcModifier(String(q || '').trim()).query.replace(/^__ROW\s+/i, '');
            var cols = penumbraFlatSearchColumns(Object.keys($('#resultsTable').data('columnNameToOriginalIndex') || {}));
            return (parseAdvancedQuery(sv, cols) || []).some(function (p) { return p && p.type === 'logical' && String(p.op).toLowerCase() === 'or'; });
        },
        runSearch: function (q) { $('#tableSearch').val(q); runTableSearch(); }
    };

    $(document).on('click', '#viewLastPageLink', function (e) {
"""

MAIN_SHEET_OLD = """row(['Esc'], 'Close the open dialog, menu or panel')
        ]);"""
MAIN_SHEET_NEW = """row(['Esc'], 'Close the open dialog, menu or panel'),
            // Find in results (2026-10-19): listed while its module is loaded
            (window.Penumbra && window.Penumbra.find) ? row(['Ctrl+F'], 'Find in the table without filtering it (press it again for the browser find)') : ''
        ]);"""

# ---- index.php: after the table header menu's block ---------------------------
INDEX_OLD = """<script defer src="js/penumbra_colmenu.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_colmenu.js'); ?>"></script>
<?php endif; ?>
"""
INDEX_NEW = """<script defer src="js/penumbra_colmenu.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_colmenu.js'); ?>"></script>
<?php endif; ?>
<?php /* AFTER main.js: Find in results (2026-10-19, find round 1) -
         js/penumbra_find.js + css/penumbra_find.css. Ctrl+F finds text in the
         flat table without filtering it, on every page (the browser's own find
         sees only the page on screen); Ctrl+F again is the browser's. Nothing is
         saved. ROLLBACK SWITCH, no deploy and no restore: an empty
         js/penumbra_find.off stops both files loading (Ctrl+F is the browser's
         again; main.js's findHost is inert without the module). &find=off does
         the same for one page. */
if (!file_exists(__DIR__ . '/js/penumbra_find.off')
    && is_file(__DIR__ . '/js/penumbra_find.js') && is_file(__DIR__ . '/css/penumbra_find.css')): ?>
<link rel="stylesheet" href="css/penumbra_find.css?v=<?php echo filemtime(__DIR__ . '/css/penumbra_find.css'); ?>">
<script defer src="js/penumbra_find.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_find.js'); ?>"></script>
<?php endif; ?>
"""

# ---- js/penumbra_cellsel.js: the cell Find closes on becomes the active cell ----
CELLSEL_OLD = """        active: function () { return anchor ? anchor.td : null; },
"""
CELLSEL_NEW = """        active: function () { return anchor ? anchor.td : null; },
        // Find in results (2026-10-19): the cell Find closed on becomes the active
        // cell, focused, so the arrow keys carry on from there (Excel's habit).
        // False when it is not a cell of ours.
        activate: function (td) {
            if (!td || !td.isConnected || cellOf(td) !== td) { return false; }
            if (rects.length) { clear(); }
            ext = null;
            markKb();
            focusCell(td);
            return true;
        },
"""

# ---- help/topics/searchHelpLightbox.php -------------------------------------------
HELP_JUMP_OLD = """                <a href="#" data-jump-to="search-quicktips" class="help-jump-link">Keys</a><span style="opacity: 0.25; margin: 0 4px;">|</span>
"""
HELP_JUMP_NEW = """                <a href="#" data-jump-to="search-quicktips" class="help-jump-link">Keys</a><span style="opacity: 0.25; margin: 0 4px;">|</span>
                <a href="#" data-jump-to="search-find" class="help-jump-link">Find (Ctrl+F)</a><span style="opacity: 0.25; margin: 0 4px;">|</span>
"""
_TD = 'style="padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; white-space: normal; max-width: none;"'
_TH = 'style="padding: 5px; border-bottom: 1px solid #ccc; text-align: left; white-space: normal; max-width: none;"'
HELP_SEC_OLD = """        <h4 id="search-syntax" data-canonical="search-syntax" """
HELP_SEC_NEW = ("""        <h4 id="search-find" style="border-bottom: 2px solid var(--brand-primary, #336699); padding-bottom: 6px; margin: 18px 0 10px;">Find Without Filtering (Ctrl+F)</h4>
        <p style="font-size: 11px; margin: 0 0 8px;">The search box filters the rows. To <strong>find</strong> something instead, press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on a Mac) on a report's table. A small bar opens at the top right of the results: as you type, every match on the page is highlighted, the bar counts them (<em>3 of 41</em>) and the first one is brought into view. Nothing is hidden, and the totals, downloads and emails are unchanged.</p>
        <ul style="font-size: 11px; padding-left: 18px; margin: 0 0 10px;">
            <li>It looks through every page of the rows your search keeps, in their sorted order, and the columns on screen. Stepping to a match on another page turns to that page.</li>
            <li>When your search hides some matches, a line under the box says how many.</li>
            <li>It matches what a cell shows and its stored value: a cell shown as <code>$1,234.50</code> is found by <code>1,234.50</code> and by <code>1234.5</code>. Case and extra spaces make no difference.</li>
            <li>The search box's own forms work here too: <code>//Open//</code> finds the cells that say exactly <em>Open</em>, and <code>/^ID-10\\d$/</code> is a regular expression (end it with <code>/I</code> to match case).</li>
            <li><strong>Filter to N rows</strong> hands the term to the search box, so only the rows with a match stay. N is the search's own count, which can differ from the matches you see: the search also reads hidden columns.</li>
            <li>When a search is already applied, the term is added to it with <code>AND</code>. A search that uses <code>OR</code> cannot take one more term, so the button stays hidden then.</li>
            <li>For now Find covers the flat table. In the grouped view, a pivot or a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find.</li>
        </ul>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
            <tr><th """ + _TH.replace('text-align: left;', 'text-align: left; width: 30%;') + """>Keys</th><th """ + _TH + """>What they do</th></tr>
            <tr><td """ + _TD + """><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td """ + _TD + """>Opens the bar, or selects its text when it is open. Text you selected in the table first is put in the box.</td></tr>
            <tr><td """ + _TD + """><kbd>Ctrl</kbd>+<kbd>F</kbd> again, in the bar</td><td """ + _TD + """>Your browser's own find, for the rest of the page.</td></tr>
            <tr><td """ + _TD + """><kbd>Enter</kbd>, <kbd>F3</kbd> or <kbd>Ctrl</kbd>+<kbd>G</kbd></td><td """ + _TD + """>The next match (after the last one, the first again).</td></tr>
            <tr><td """ + _TD + """><kbd>Shift</kbd>+<kbd>Enter</kbd>, <kbd>Shift</kbd>+<kbd>F3</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd></td><td """ + _TD + """>The previous match.</td></tr>
            <tr><td """ + _TD + """><kbd>Alt</kbd>+<kbd>Enter</kbd></td><td """ + _TD + """>Filter to the rows with a match (the button's job).</td></tr>
            <tr><td """ + _TD + """><kbd>Esc</kbd></td><td """ + _TD + """>Closes the bar. The match you were on becomes the active cell, so the arrow keys move on from it (see Selecting Cells in Your Settings).</td></tr>
        </table>

        <h4 id="search-syntax" data-canonical="search-syntax" """)

PATCHES = [
    (os.path.join('js', 'main.js'), 'window.Penumbra.findHost', [('host+hook', MAIN_HOOK_OLD, MAIN_HOOK_NEW), ('sheet', MAIN_SHEET_OLD, MAIN_SHEET_NEW)]),
    ('index.php', 'js/penumbra_find.js', [('include', INDEX_OLD, INDEX_NEW)]),
    (os.path.join('js', 'penumbra_cellsel.js'), 'activate: function (td)', [('activate', CELLSEL_OLD, CELLSEL_NEW)]),
    (os.path.join('help', 'topics', 'searchHelpLightbox.php'), 'id="search-find"', [('jump', HELP_JUMP_OLD, HELP_JUMP_NEW), ('section', HELP_SEC_OLD, HELP_SEC_NEW)]),
]

def main():
    if len(sys.argv) < 3: raise SystemExit(__doc__ or 'usage: patch.py SRC_ROOT OUT_ROOT|--check')
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
            print('  %-42s %-10s anchor x%d' % (rel, name, n))
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
