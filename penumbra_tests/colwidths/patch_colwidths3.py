"""Column widths ROUND 3 (2026-10-01): a pivot's value column, while it has only one.

    py -3 patch_colwidths3.py forward SRC_DIR OUT_DIR    apply every hunk (deploy build)
    py -3 patch_colwidths3.py reverse SRC_DIR OUT_DIR    undo every hunk (rollback build)
    py -3 patch_colwidths3.py check   SRC_DIR            report which way SRC_DIR stands

Rounds 1 and 2 (patch_colwidths.py, patch_colwidths2.py) must already be in
SRC_DIR - these hunks anchor on the text round 2 inserted, so round 3 comes out
BEFORE round 2 does (rollback.ps1 -Restore takes them out newest first). main.js
only gains one insert AFTER round 2's, so round 2's main.js hunks still read
APPLIED with round 3 in. Two kinds of hunk:
  insert   (anchor, text): forward needs ANCHOR once and ANCHOR+TEXT absent and
           puts TEXT right after ANCHOR; reverse needs ANCHOR+TEXT once.
  replace  (old, new):     forward needs OLD once and NEW absent; reverse needs
           NEW once and puts OLD back.
Anything else aborts BEFORE a byte is written, naming the hunk. Line endings
follow each file (main.js and help_content.php are CRLF, README.md LF); every
other byte, the two NULs in main.js included, is carried through. index.php is
not touched by this round. js/penumbra_colwidths.js and css/penumbra_colwidths.css
are whole-file swaps and are not handled here.
"""
import os
import sys

HUNKS = {}

HUNKS['js/main.js'] = [
('insert', 'host value field',
"""    window.Penumbra.colWidthsHost.pivotRelayout = function () {
        try { updateStickyColumnLayout(); } catch (e) { /* no pivot on screen */ }
    };
""",
"""    // A pivot's value column, while it has only one (js/penumbra_colwidths.js
    // decides that from the table): the field its one aggregation reads - that
    // aggregation's own column when it names one, else the pivot's value field.
    // A width for it is filed as PIVOT:=<field>, which penumbraColWidthsPivotKeys()
    // already carries through a save.
    window.Penumbra.colWidthsHost.pivotValueField = function () {
        const s = currentPivotSettings;
        if (!s) return null;
        const own = Array.isArray(s.aggColOverrides) ? s.aggColOverrides[0] : null;
        return (own || s.vals) ? String(own || s.vals) : null;
    };
"""),
]

HUNKS['help_content.php'] = [
('replace', 'help entry',
"""            <li id="us-colwidths"><strong>Column widths</strong> (on the table itself) -- Drag the right edge of a column heading to make that column wider or narrower. A line shows where the edge will land, with the new width beside it, and the table changes when you let go. Double-click the same edge to fit the column to its content again. From the keyboard, Tab to a column heading and press <kbd>+</kbd> to widen it, <kbd>-</kbd> to narrow it, or <kbd>0</kbd> to fit it to its content. A narrowed column cuts long values short with an ellipsis; hover a cell to read all of it, as usual. The same widths apply in the <strong>grouped view</strong>, where the table always fits the window: the other columns share whatever room is left, none is squeezed narrower than a minimum, and a column cannot be dragged wider than that leaves room for. In a <strong>pivot</strong>, the row-label columns (the fields down the left side) resize the same way; each width belongs to its field, so it stays with the field when you reorder the rows, and a column the pivot has collapsed stays collapsed. Your widths are remembered for this report in this browser. While you have any, this panel shows a <strong>Reset widths</strong> button and the status bar's <em>custom layout</em> chip lists the columns; a report editor can make them the report's widths by saving the report. Widths are for the screen only: a pivot's value columns, downloads, emails and scheduled output keep sizing columns to their content.</li>
""",
"""            <li id="us-colwidths"><strong>Column widths</strong> (on the table itself) -- Drag the right edge of a column heading to make that column wider or narrower. A line shows where the edge will land, with the new width beside it, and the table changes when you let go. Double-click the same edge to fit the column to its content again. From the keyboard, Tab to a column heading and press <kbd>+</kbd> to widen it, <kbd>-</kbd> to narrow it, or <kbd>0</kbd> to fit it to its content. A narrowed column cuts long values short with an ellipsis; hover a cell to read all of it, as usual. The same widths apply in the <strong>grouped view</strong>, where the table always fits the window: the other columns share whatever room is left, none is squeezed narrower than a minimum, and a column cannot be dragged wider than that leaves room for. In a <strong>pivot</strong>, the row-label columns (the fields down the left side) resize the same way; each width belongs to its field, so it stays with the field when you reorder the rows, and a column the pivot has collapsed stays collapsed. A pivot that shows just <strong>one value column</strong> (one entry under <strong>Values</strong> and nothing under <strong>Columns</strong>) lets you resize that column too, but never narrower than its widest number, so no digit is ever cut off; its width belongs to the field it totals. Your widths are remembered for this report in this browser. While you have any, this panel shows a <strong>Reset widths</strong> button and the status bar's <em>custom layout</em> chip lists the columns; a report editor can make them the report's widths by saving the report. Widths are for the screen only: a pivot with two or more value columns keeps sizing them to their content, and so do downloads, emails and scheduled output.</li>
"""),
]

HUNKS['README.md'] = [
('insert', 'design note',
"""  `&colwidths=flat` switches off just these two parts; the flat table keeps its widths.
""",
"""- **A pivot's VALUE column takes a width while it is the only one (2026-10-01).** Value columns have
  no identity a width could be filed under (a header carries only its text; `data-col-key` exists
  only for the drill-down) - except when there is ONE: row fields + one aggregation, no column field
  (or a column field with a single value and the Grand Total column hidden). Then the header holds
  exactly one `th:not([data-row-field])` and every body, subtotal and footer row exactly one
  `td:not([data-row-field]):not([colspan])` (the footer's label cell spans), measured on the real
  generator. The module marks such a table `data-pnb-colw-value` in `apply()` and every rule, grip
  and key asks for the mark, so a re-render into two value columns (a NEW, unmarked table) never
  shows the width. Filed as `PIVOT:=<field>` (host `pivotValueField()`: the one aggregation's own
  column, else `vals`) - `penumbraColWidthsPivotKeys()` already carries it. **A number is never
  cut:** the cells take the width with NO max-width (only the header is exact), so the browser
  holds the column at its widest number - a stored 45px came out 66px, the bold footer total, not
  one cell clipped; the drag and the `-` key stop at the same place (`valueFloor()`: each rendered
  cell's text by Range + its padding and border, measured equal to the browser's 66 / 138.7).
"""),
('insert', 'runbook',
"""(`patch_colwidths2.py reverse` + the module and stylesheet from that deploy's `.bak`).
""",
"""`rollback.ps1 -Restore -Round 3` takes out only the 2026-10-01 code (a pivot's single value column:
`patch_colwidths3.py reverse` + the module and stylesheet from that deploy's `.bak`);
`-DisableViews` switches it off with the rest of the grouped-view and pivot parts.
"""),
('insert', 'suite entry',
"""# &colwidths=flat (phase W: the views switch); real_input.py drags both with REAL mouse events.
""",
"""# Since 2026-10-01 a pivot's single VALUE column (phase Y: the mark, header + body + subtotal +
# footer cells, a number never cut at any stored width or drag, the - key at the widest number, two
# or more value columns or two aggregations taking none - and a re-render into them never flashing
# the width - the save, the aggregation's own column as the key); real_input.py drags it too.
"""),
]


def eol_of(text):
    crlf = text.count('\r\n')
    lf = text.count('\n') - crlf
    if crlf and lf:
        raise SystemExit('mixed line endings (%d CRLF, %d LF) - refusing to guess' % (crlf, lf))
    return '\r\n' if crlf else '\n'


def run(mode, src, out):
    plans = {}
    for rel, hunks in HUNKS.items():
        p = os.path.join(src, *rel.split('/'))
        text = open(p, 'rb').read().decode('utf-8')
        eol = eol_of(text)
        rows = []
        for kind, name, a, b in hunks:
            a2, b2 = a.replace('\n', eol), b.replace('\n', eol)
            if kind == 'insert':
                fwd_ok = text.count(a2) == 1 and text.count(a2 + b2) == 0
                rev_ok = text.count(a2 + b2) == 1
                applied = text.count(a2 + b2) == 1
                seen = 'anchor x%d' % text.count(a2)
            else:
                fwd_ok = text.count(a2) == 1 and text.count(b2) == 0
                rev_ok = text.count(b2) == 1 and text.count(a2) == 0
                applied = text.count(b2) == 1
                seen = 'old x%d new x%d' % (text.count(a2), text.count(b2))
            rows.append((kind, name, a2, b2, fwd_ok, rev_ok, applied, seen))
        plans[rel] = (p, text, eol, rows)

    if mode == 'check':
        for rel, (p, text, eol, rows) in plans.items():
            for kind, name, a2, b2, fwd_ok, rev_ok, applied, seen in rows:
                print('%-18s %-30s %s' % (rel, name, 'APPLIED' if applied else ('absent' if fwd_ok else 'UNEXPECTED (' + seen + ')')))
        return

    errors = []
    for rel, (p, text, eol, rows) in plans.items():
        for kind, name, a2, b2, fwd_ok, rev_ok, applied, seen in rows:
            if mode == 'forward' and not fwd_ok:
                errors.append('%s [%s %s]: %s' % (rel, kind, name, seen))
            if mode == 'reverse' and not rev_ok:
                errors.append('%s [%s %s]: %s' % (rel, kind, name, seen))
    if errors:
        print('ABORT - nothing written:')
        for e in errors:
            print('  ' + e)
        sys.exit(2)

    for rel, (p, text, eol, rows) in plans.items():
        new = text
        for kind, name, a2, b2, fwd_ok, rev_ok, applied, seen in rows:
            if kind == 'insert':
                new = new.replace(a2 + b2, a2) if mode == 'reverse' else new.replace(a2, a2 + b2)
            else:
                new = new.replace(b2, a2) if mode == 'reverse' else new.replace(a2, b2)
        dst = os.path.join(out, *rel.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'wb').write(new.encode('utf-8'))
        print('%-18s %s %d hunk(s) -> %s  (%d -> %d bytes, %s)' % (
            rel, mode, len(rows), dst, len(text.encode('utf-8')), len(new.encode('utf-8')),
            'CRLF' if eol == '\r\n' else 'LF'))


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('forward', 'reverse', 'check'):
        raise SystemExit(__doc__)
    run(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
