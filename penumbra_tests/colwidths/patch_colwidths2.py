"""Column widths ROUND 2 (2026-09-30): the grouped view and a pivot's row labels.

    py -3 patch_colwidths2.py forward SRC_DIR OUT_DIR    apply every hunk (deploy build)
    py -3 patch_colwidths2.py reverse SRC_DIR OUT_DIR    undo every hunk (rollback build)
    py -3 patch_colwidths2.py check   SRC_DIR            report which way SRC_DIR stands

Round 1 (patch_colwidths.py) must already be in SRC_DIR - these hunks anchor on
the code it inserted. Two kinds of hunk:
  insert   (anchor, text): forward needs ANCHOR once and ANCHOR+TEXT absent and
           puts TEXT right after ANCHOR; reverse needs ANCHOR+TEXT once.
  replace  (old, new):     forward needs OLD once and NEW absent; reverse needs
           NEW once and puts OLD back.
Anything else aborts BEFORE a byte is written, naming the hunk. Line endings
follow each file (main.js and help_content.php are CRLF, index.php and
README.md LF); every other byte, the two NULs in main.js included, is carried
through. js/penumbra_colwidths.js and css/penumbra_colwidths.css are whole-file
swaps and are not handled here.
"""
import os
import sys

HUNKS = {}

HUNKS['js/main.js'] = [
('insert', 'pivot keys fn',
"""            if (userColumnWidths[n] !== r) out[n] = userColumnWidths[n];
        });
        return out;
    }
""",
"""    // The PIVOT:<field> keys in either layer - the widths of a pivot's
    // row-label columns (js/penumbra_colwidths.js files them that way).
    function penumbraColWidthsPivotKeys() {
        const seen = Object.create(null);
        Object.keys(reportColumnWidths).concat(Object.keys(userColumnWidths)).forEach(function (k) {
            if (k.indexOf('PIVOT:') === 0) seen[k] = true;
        });
        return Object.keys(seen);
    }
"""),
('insert', 'save pivot keys',
"""                const w = penumbraColWidthFor(n);
                if (w) out[n] = w;
            }
""",
"""            // A pivot's row-label widths are not flat columns: every one in
            // force goes through, whether a pivot is on screen or not.
            penumbraColWidthsPivotKeys().forEach(function (k) {
                const pw = penumbraColWidthFor(k);
                if (pw) out[k] = pw;
            });
"""),
('insert', 'host pivot accessors',
"""        state: function () {
            return { report: Object.assign({}, reportColumnWidths), user: Object.assign({}, userColumnWidths), key: currentLoadedStateName || null };
        }
    };
""",
"""    // For a pivot's row-label columns: the row fields level by level (what a
    // width is filed under, PIVOT:<field>) and the pivot's sticky-column
    // layout, which reads those columns' widths by hand.
    window.Penumbra.colWidthsHost.pivotRowFields = function () {
        return (currentPivotSettings && Array.isArray(currentPivotSettings.rows)) ? currentPivotSettings.rows.slice() : [];
    };
    window.Penumbra.colWidthsHost.pivotRelayout = function () {
        try { updateStickyColumnLayout(); } catch (e) { /* no pivot on screen */ }
    };
"""),
]

HUNKS['index.php'] = [
('replace', 'module include + views switch',
"""<?php /* AFTER main.js: flat-table column widths (js/penumbra_colwidths.js +
         css/penumbra_colwidths.css, 2026-09-24) - the header grips, the
         + / - / 0 keys and the width stylesheet. main.js keeps the widths'
         STATE either way, so a report saved while this is off keeps them.
         ROLLBACK SWITCH: an empty js/penumbra_colwidths.off stops both files
         loading - no deploy, no restore - and deleting it switches the
         feature back on. */
$pnbColwOn = !file_exists(__DIR__ . '/js/penumbra_colwidths.off')
    && is_file(__DIR__ . '/js/penumbra_colwidths.js') && is_file(__DIR__ . '/css/penumbra_colwidths.css');
if ($pnbColwOn): ?>
<link rel="stylesheet" href="css/penumbra_colwidths.css?v=<?php echo filemtime(__DIR__ . '/css/penumbra_colwidths.css'); ?>">
<script defer src="js/penumbra_colwidths.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_colwidths.js'); ?>"></script>
<?php endif; ?>
""",
"""<?php /* AFTER main.js: column widths (js/penumbra_colwidths.js +
         css/penumbra_colwidths.css; the flat table 2026-09-24, the grouped
         view and a pivot's row labels 2026-09-30) - the header grips, the
         + / - / 0 keys and the width stylesheets. main.js keeps the widths'
         STATE either way, so a report saved while this is off keeps them.
         ROLLBACK SWITCHES, no deploy and no restore: an empty
         js/penumbra_colwidths.off stops both files loading (every column is
         content-sized again); an empty js/penumbra_colwidths_views.off keeps
         the flat table's widths and switches off only the grouped-view and
         pivot parts (this script is then marked data-views="off"). Deleting
         the file switches it back on. */
$pnbColwOn = !file_exists(__DIR__ . '/js/penumbra_colwidths.off')
    && is_file(__DIR__ . '/js/penumbra_colwidths.js') && is_file(__DIR__ . '/css/penumbra_colwidths.css');
if ($pnbColwOn): ?>
<link rel="stylesheet" href="css/penumbra_colwidths.css?v=<?php echo filemtime(__DIR__ . '/css/penumbra_colwidths.css'); ?>">
<script defer src="js/penumbra_colwidths.js?v=<?php echo filemtime(__DIR__ . '/js/penumbra_colwidths.js'); ?>"<?php if (file_exists(__DIR__ . '/js/penumbra_colwidths_views.off')) { echo ' data-views="off"'; } ?>></script>
<?php endif; ?>
"""),
]

HUNKS['help_content.php'] = [
('replace', 'help entry',
"""            <li id="us-colwidths"><strong>Column widths</strong> (on the table itself) -- Drag the right edge of a column heading to make that column wider or narrower. A line shows where the edge will land, with the new width beside it, and the table changes when you let go. Double-click the same edge to fit the column to its content again. From the keyboard, Tab to a column heading and press <kbd>+</kbd> to widen it, <kbd>-</kbd> to narrow it, or <kbd>0</kbd> to fit it to its content. A narrowed column cuts long values short with an ellipsis; hover a cell to read all of it, as usual. Your widths are remembered for this report in this browser. While you have any, this panel shows a <strong>Reset widths</strong> button and the status bar's <em>custom layout</em> chip lists the columns; a report editor can make them the report's widths by saving the report. Widths apply to the flat table on screen only: the grouped and pivot views, downloads, emails and scheduled output keep sizing columns to their content.</li>
""",
"""            <li id="us-colwidths"><strong>Column widths</strong> (on the table itself) -- Drag the right edge of a column heading to make that column wider or narrower. A line shows where the edge will land, with the new width beside it, and the table changes when you let go. Double-click the same edge to fit the column to its content again. From the keyboard, Tab to a column heading and press <kbd>+</kbd> to widen it, <kbd>-</kbd> to narrow it, or <kbd>0</kbd> to fit it to its content. A narrowed column cuts long values short with an ellipsis; hover a cell to read all of it, as usual. The same widths apply in the <strong>grouped view</strong>, where the table always fits the window: the other columns share whatever room is left, none is squeezed narrower than a minimum, and a column cannot be dragged wider than that leaves room for. In a <strong>pivot</strong>, the row-label columns (the fields down the left side) resize the same way; each width belongs to its field, so it stays with the field when you reorder the rows, and a column the pivot has collapsed stays collapsed. Your widths are remembered for this report in this browser. While you have any, this panel shows a <strong>Reset widths</strong> button and the status bar's <em>custom layout</em> chip lists the columns; a report editor can make them the report's widths by saving the report. Widths are for the screen only: a pivot's value columns, downloads, emails and scheduled output keep sizing columns to their content.</li>
"""),
]

HUNKS['README.md'] = [
('insert', 'design note',
"""  downloads, email and the scheduler never read `columnWidths`. Suite `colwidths`.
""",
"""- **Column widths reach the grouped view and a pivot's row labels (2026-09-30).** The GROUPED view
  is fit-to-width and REAL fixed layout (`width:100%`, each column a content-aware % written INLINE
  on the cloned `<th>` by `_proportionalColumnPercents()`), so a name-keyed rule on the `<th>` alone
  sets a column - but, measured, a px width beside the original %s holds only while the rest can
  absorb it: four narrowed columns came out 20% WIDER (Edge spreads the leftover over EVERY column,
  set ones included - at Compact density's 4px 5px cells; at the default 9px it happens to give it
  to the % columns only), one widened column crushed the rest to ~23px. The module rescales the un-sized columns' %s to sum to exactly 100% (every px width then
  holds at any table width and the rest share what is left), holds a column whose share would fall
  under 40px AT 40px, scales the set widths down if even the floors do not fit, caps a drag at what
  the others leave, and re-runs on a container resize. A PIVOT is auto layout like the flat table;
  its row-label cells (header, rowspan group cells, leaves, summary rows) all carry
  `data-row-field="<level>"`, so th+td rules key on that, filed as `PIVOT:<field>` - the field at that
  level now, so a reordered pivot keeps each width with its field - never beating
  `.pivot-row-field-minimized`, and followed by `updateStickyColumnLayout()` (host `pivotRelayout`).
  The row-label headers get `tabindex=0` for the keys. VALUE columns are not covered (no stable
  identity on every value cell). `penumbraColWidthsForSave()` carries every `PIVOT:` key in force.
  `js/penumbra_colwidths_views.off` (index.php marks the script `data-views="off"`) or
  `&colwidths=flat` switches off just these two parts; the flat table keeps its widths.
"""),
('insert', 'runbook',
"""of it stays - after the same hash-guarded, atomic swap the deploy used.
""",
"""
To switch off only the grouped-view and pivot row-label resizing (the flat table keeps its widths),
create an empty `js\\penumbra_colwidths_views.off` instead, or run `rollback.ps1 -DisableViews`
(`-EnableViews` deletes it). `rollback.ps1 -Restore -Round 2` takes out only the 2026-09-30 code
(`patch_colwidths2.py reverse` + the module and stylesheet from that deploy's `.bak`).
"""),
('insert', 'suite entry',
"""# `-Mutants` runs every mutant against the asserts it must turn red.
""",
"""# Since 2026-09-30 also the GROUPED view (phase V: the shared widths, exact px at any width and at
# Compact density, the 40px floor, the drag cap, a regroup, a re-render only its own observer sees)
# and a PIVOT's row labels (phase Q: data-row-field rules, PIVOT:<field> keys that follow a
# reordered field, collapsed columns, the sticky offsets, the keys), plus a third page load with
# &colwidths=flat (phase W: the views switch); real_input.py drags both with REAL mouse events.
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
