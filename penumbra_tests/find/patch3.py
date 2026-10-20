# =============================================================================
# FIND round 3 (2026-10-19) - the patches to js/main.js.
#
#   py -3 patch3.py SRC_ROOT OUT_ROOT     read js/main.js from SRC_ROOT (the app layout),
#                                         write the patched copy to OUT_ROOT
#   py -3 patch3.py SRC_ROOT --check      anchor counts only, nothing written
#
# Every anchor must occur exactly once and no marker may be there yet, or nothing is
# written. main.js is CRLF (the anchors are converted). Re-apply to the CURRENT live
# copy at deploy time: other sessions deploy main.js often.
#   busy       _pnbHotkeyUiBusy asked jQuery for a comma-joined selector with :visible,
#              which jQuery cannot hand to querySelectorAll: it tested EVERY element of
#              the page (4 to 5 s a call on a 25,000-row report, 480,000 elements) on
#              every Ctrl+F, PageUp / PageDown / Home / End, single-key shortcut and
#              paste. Now by id and by class (the same answers, the pop-out included).
#   runsearch  findHost.runSearch (Find's Filter to N rows) set the box's value only: no
#              has-text (the box's clear x and Run button stayed hidden), and the keyup
#              handler's previousSearchValue stayed stale (deleting the term to empty
#              no longer cleared the search). Now as a typed search leaves the box.
#              (same edit) findHost.searchCountAsync(q, done, stop): Find's Filter count in
#              ~10 ms slices; findHost.searchTerms(q): the text a search looks for, from
#              its own parser (parseAdvancedQuery), for the search's highlight.
# =============================================================================
import os, sys

def eol_of(t):
    return '\r\n' if t.count('\r\n') * 2 > t.count('\n') else '\n'

def conv(s, eol):
    return s.replace('\r\n', '\n').replace('\n', eol)

BUSY_OLD = """    function _pnbHotkeyUiBusy() {
        return $('#settingsPanel').hasClass('is-open') ||
            window._pnbAll('.infobox-overlay:visible, .modal-prompt-overlay:visible, #chartCarouselOverlay:visible').length > 0 ||
            window._pnbAll('.context-submenu').length > 0 ||
            window._pnbAll(PNB_LIGHTBOXES.join(', ')).is(':visible');
    }
"""
BUSY_NEW = """    // Asked by id and by class (find round 3, 2026-10-19): the comma-joined
    // selector with :visible this used to hand jQuery has no querySelectorAll
    // form, so jQuery tested EVERY element of the page - 4 to 5 s a call on a
    // 25,000-row report (480,000 elements), on every Ctrl+F, PageUp / PageDown /
    // Home / End, single-key shortcut and paste. Same answers, both documents.
    function _pnbUiShown(el) {
        // jQuery's :visible
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }
    function _pnbHotkeyUiBusy() {
        if ($('#settingsPanel').hasClass('is-open')) return true;
        var docs = [document], pip = window._admPip, pw = pip && pip.win;
        if (pw && !pw.closed && pw.document) docs.push(pw.document);
        for (var d = 0; d < docs.length; d++) {
            var doc = docs[d], i, els;
            if (doc.getElementsByClassName('context-submenu').length) return true;
            els = doc.getElementsByClassName('infobox-overlay');
            for (i = 0; i < els.length; i++) { if (_pnbUiShown(els[i])) return true; }
            els = doc.getElementsByClassName('modal-prompt-overlay');
            for (i = 0; i < els.length; i++) { if (_pnbUiShown(els[i])) return true; }
            if (_pnbUiShown(doc.getElementById('chartCarouselOverlay'))) return true;
            for (i = 0; i < PNB_LIGHTBOXES.length; i++) {
                if (_pnbUiShown(doc.getElementById(PNB_LIGHTBOXES[i].replace(/^#/, '')))) return true;
            }
        }
        return false;
    }
"""

RUN_OLD = """        runSearch: function (q) { $('#tableSearch').val(q); runTableSearch(); }
"""
RUN_NEW = r"""        // As a typed search leaves the box (find round 3): its clear x and Run button
        // (has-text), the value the keyup handler compares with (deleting the term
        // to empty clears the search), the toggles / filter strips that read the box
        // ('change' - not 'input', which would open the autocomplete's menu).
        runSearch: function (q) {
            var $ts = $('#tableSearch');
            q = String(q == null ? '' : q);
            $ts.val(q);
            $('#tableSearchContainer').toggleClass('has-text', q.length > 0);
            previousSearchValue = q;
            try { if ($ts.data('ui-autocomplete')) $ts.autocomplete('close'); } catch (e) { }
            runTableSearch();
            $ts.trigger('change');
        },
        // searchCount in slices of about 10 ms (find round 3): a 25,000-row count
        // took 0.2-0.3 s in one piece after every pause in Find's typing. done(n)
        // once counted; stop() true (a newer term, the bar closed) or new rows drop it.
        searchCountAsync: function (q, done, stop) {
            var sv = penumbraTakeSrcModifier(String(q || '').trim()).query, rr = false;
            if (/^__ROW\s+/i.test(sv)) { rr = true; sv = sv.replace(/^__ROW\s+/i, ''); }
            var rows = masterRowData;
            if (!sv.trim()) { done(rows.length); return; }
            var cols = penumbraFlatSearchColumns(Object.keys($('#resultsTable').data('columnNameToOriginalIndex') || {}));
            var pq = parseAdvancedQuery(sv, cols), n = 0, i = 0;
            (function slice() {
                if ((stop && stop()) || rows !== masterRowData) return;
                var t0 = performance.now();
                for (; i < rows.length; i++) {
                    rows[i].set('#', String(i + 1));
                    if (evaluateParsedQuery(rows[i], pq, cols, rr)) n++;
                    if ((i & 127) === 127 && performance.now() - t0 > 10) { i++; setTimeout(slice, 0); return; }
                }
                done(n);
            })();
        },
        // What a search LOOKS FOR as text a cell can show (find round 3: the
        // search's own highlight in js/penumbra_find.js): each term that keeps a row
        // by holding or equalling some text - a global one, or a column's (by its
        // name) - from the search's own parser. Comparisons, negations (!= !/),
        // number ranges / lists, 'empty' and {COLUMN} placeholders mark nothing.
        // [{ text, how: 'contains' | 'equals' | 'exact' | 'regex', cs: minds case, col: NAME | null }]
        searchTerms: function (q) {
            var sv = penumbraTakeSrcModifier(String(q || '').trim()).query.replace(/^__ROW\s+/i, '');
            if (!sv.trim()) return [];
            var cols = penumbraFlatSearchColumns(Object.keys($('#resultsTable').data('columnNameToOriginalIndex') || {}));
            var out = [];
            (parseAdvancedQuery(sv, cols) || []).forEach(function (p) {
                if (!p || (p.type !== 'global' && p.type !== 'condition')) return;
                var op = String(p.op || '').toLowerCase(), eq = (op === '=' || op === '==' || op === 'eq');
                if (op !== 'contains' && !eq) return;
                var col = (p.type === 'condition') ? String(p.column || '').toUpperCase() : null;
                if (col === '#') return;
                var v = stripWrappingQuotePair(String(p.value == null ? '' : p.value).trim());
                if (!v || v.toLowerCase() === 'empty' || /^\{[^}]+\}$/.test(v)) return;
                // testCondition's own order: //whole cell// first, then /pattern/ (/I minds case)
                if (v.length > 4 && v.slice(0, 2) === '//' && v.slice(-2) === '//') { out.push({ text: v.slice(2, -2), how: 'exact', cs: false, col: col }); return; }
                if (v.charAt(0) === '/' && v.length > 1) {
                    var k = v.lastIndexOf('/');
                    if (k > 1) out.push({ text: v.slice(1, k), how: 'regex', cs: /\/I$/.test(v), col: col });
                    return;
                }
                if (!_epqIsNumericStr(v) && /[,\-]/.test(v) && /^[\d,\-.$%\s]+$/.test(v)) return;
                out.push({ text: v, how: eq ? 'equals' : 'contains', cs: false, col: col });
            });
            return out;
        }
"""

# The box's state follows what it holds after every flat render (applyPagination's end):
# other scripts write the box with .val() too - leaving a comparison, a new query, a
# snapshot restore - and leave the same stale x / previousSearchValue behind.
SYNC_HOOK_OLD = """        if (window.Penumbra && window.Penumbra.find && window.Penumbra.find.paged) { try { window.Penumbra.find.paged(); } catch (_findErr) { } }
"""
SYNC_HOOK_NEW = """        _pnbSyncSearchBoxState();
        if (window.Penumbra && window.Penumbra.find && window.Penumbra.find.paged) { try { window.Penumbra.find.paged(); } catch (_findErr) { } }
"""
SYNC_FN_OLD = """    let previousSearchValue = '';
"""
SYNC_FN_NEW = """    let previousSearchValue = '';
    // The box's state from what it holds (find round 3, 2026-10-19): its clear x and Run
    // button (has-text) and the value the keyup handler compares with. Typing keeps them
    // in step; a script's .val() fires no keyup / input, so applyPagination calls this after
    // every flat render (a comparison left, a new query, a restore, Find's Filter).
    function _pnbSyncSearchBoxState() {
        var v = String($('#tableSearch').val() || '');
        $('#tableSearchContainer').toggleClass('has-text', v.length > 0);
        try { previousSearchValue = v; } catch (e) { /* a render before this line ran (TDZ) */ }
    }
"""

# ---- index.php: the search box in a FORM ---------------------------------------
# (the note goes OUTSIDE #resultsHeader: suites lift that block raw)
IDX_NOTE_OLD = """         field names the column arrow's Alt+Down twin (aria-keyshortcuts).
         Kept OUT of #resultsHeader: suites lift that block raw. */ ?>
"""
IDX_NOTE_NEW = """         field names the column arrow's Alt+Down twin (aria-keyshortcuts).
         Kept OUT of #resultsHeader: suites lift that block raw.
         The box sits in a FORM (find round 3, 2026-10-19): a browser's form
         autofill looks at a focused field outside any form by walking the whole
         page - 0.2 s a focus in Edge on a 25,000-row report. It never submits
         (onsubmit; Enter runs the search in main.js), and password managers are
         told to leave it alone, as main.js tells them for the scheduler's fields. */ ?>
"""
IDX_OPEN_OLD = """            <span class="search-wrapper pnb-sbox">
                <span id="searchBuilderIcon\""""
IDX_OPEN_NEW = """            <form class="search-wrapper pnb-sbox" role="search" aria-label="Search the report" onsubmit="return false;" novalidate autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other">
                <span id="searchBuilderIcon\""""
IDX_INPUT_OLD = """<input type="text" id="tableSearch" placeholder="""
IDX_INPUT_NEW = """<input type="text" id="tableSearch" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other" placeholder="""
IDX_CLOSE_OLD = """            </span>
            <span id="resultCount"></span>
"""
IDX_CLOSE_NEW = """            </form>
            <span id="resultCount"></span>
"""

# ---- help/topics/searchHelpLightbox.php: round 3's words -----------------------------
HELP_PLACE_OLD = """A small bar opens at the top right of the results: as you type,"""
HELP_PLACE_NEW = """A small bar opens at the top right of the window, where your browser's own find bar would be: as you type,"""
HELP_BULLET_OLD = """            <li>A pivot has no <strong>Filter to N rows</strong>: its cells are mostly sums. In a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find.</li>
"""
HELP_BULLET_NEW = """            <li>A pivot has no <strong>Filter to N rows</strong>: its cells are mostly sums. In a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find.</li>
            <li>The bar moves aside only while the match you are on would be under it. Its <strong>(i)</strong> button says what Find does and how it differs from the search box.</li>
            <li>On a long table the bar reads in short steps, so the page keeps responding: a spinner turns and the count says how far it got.</li>
"""
HELP_MARKS_OLD = """        <h4 id="search-find" """
HELP_MARKS_NEW = """        <p style="font-size: 11px; margin: 0 0 10px;"><strong>What the search found</strong> is marked in the rows it keeps, in a light colour (lighter than Find's). A column's term is marked in that column only. Comparisons such as <code>AMOUNT &gt; 1000</code>, and <code>!=</code>, keep rows by their value and mark nothing.</p>

        <h4 id="search-find" """

PATCHES = [
    ('help/topics/searchHelpLightbox.php', 'What the search found</strong>', [
        ('place', HELP_PLACE_OLD, HELP_PLACE_NEW),
        ('bullets', HELP_BULLET_OLD, HELP_BULLET_NEW),
        ('marks', HELP_MARKS_OLD, HELP_MARKS_NEW),
    ]),
    ('js/main.js', '_pnbUiShown(el)', [
        ('busy', BUSY_OLD, BUSY_NEW),
        ('runsearch', RUN_OLD, RUN_NEW),
        ('synchook', SYNC_HOOK_OLD, SYNC_HOOK_NEW),
        ('syncfn', SYNC_FN_OLD, SYNC_FN_NEW),
    ]),
    ('index.php', 'The box sits in a FORM (find round 3', [
        ('note', IDX_NOTE_OLD, IDX_NOTE_NEW),
        ('open', IDX_OPEN_OLD, IDX_OPEN_NEW),
        ('input', IDX_INPUT_OLD, IDX_INPUT_NEW),
        ('close', IDX_CLOSE_OLD, IDX_CLOSE_NEW),
    ]),
]

def main():
    if len(sys.argv) < 3: raise SystemExit('usage: patch3.py SRC_ROOT OUT_ROOT|--check')
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
