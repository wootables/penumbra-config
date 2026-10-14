"""Column widths ROUND 4 (2026-10-01): a pivot's value columns, one width together.

    py -3 patch_colwidths4.py forward SRC_DIR OUT_DIR    apply every hunk (deploy build)
    py -3 patch_colwidths4.py reverse SRC_DIR OUT_DIR    undo every hunk (rollback build)
    py -3 patch_colwidths4.py check   SRC_DIR            report which way SRC_DIR stands

Rounds 1-3 must already be in SRC_DIR - these hunks anchor on the text round 3
inserted, so round 4 comes out BEFORE round 3 does (rollback.ps1 -Restore takes
them out newest first). Only help_content.php (the entry is replaced) and
README.md (three inserts after round 3's) change; js/main.js and index.php are
not touched by this round. Two kinds of hunk:
  insert   (anchor, text): forward needs ANCHOR once and ANCHOR+TEXT absent and
           puts TEXT right after ANCHOR; reverse needs ANCHOR+TEXT once.
  replace  (old, new):     forward needs OLD once and NEW absent; reverse needs
           NEW once and puts OLD back.
Anything else aborts BEFORE a byte is written, naming the hunk. Line endings
follow each file (help_content.php is CRLF, README.md LF); every other byte is
carried through. js/penumbra_colwidths.js and css/penumbra_colwidths.css are
whole-file swaps and are not handled here.
"""
import os
import sys

HUNKS = {}

HUNKS['help_content.php'] = [
('replace', 'help entry',
"""A pivot that shows just <strong>one value column</strong> (one entry under <strong>Values</strong> and nothing under <strong>Columns</strong>) lets you resize that column too, but never narrower than its widest number, so no digit is ever cut off; its width belongs to the field it totals.""",
"""A pivot's <strong>value columns</strong> resize too while its heading is a single row (one entry under <strong>Values</strong> and no more than one field under <strong>Columns</strong>): dragging any of them sets them all to the same width, the <strong>Grand Total</strong> column has a width of its own, and no column goes narrower than its widest number, so no digit is ever cut off. Their widths belong to the field they total."""),
('replace', 'help entry tail',
"""Widths are for the screen only: a pivot with two or more value columns keeps sizing them to their content, and so do downloads, emails and scheduled output.</li>""",
"""Widths are for the screen only: a pivot with two entries under Values, or two fields nested under Columns, keeps sizing its value columns to their content, and so do downloads, emails and scheduled output.</li>"""),
]

HUNKS['README.md'] = [
('insert', 'design note',
"""  cell's text by Range + its padding and border, measured equal to the browser's 66 / 138.7).
""",
"""- **...and then ALL its value columns, ONE width together (2026-10-01, round 4).** The rule above
  widened from "exactly one value column" to "a ONE-ROW header" (one aggregation; no column field,
  one, or several laid out flat): the value columns are every `:not([data-row-field]):not([colspan])`
  cell except `.pivot-grand-total` - which EVERY Grand Total cell carries (header, body, subtotal,
  footer corner) - so they share `PIVOT:=<field>` and the Grand Total column takes its own
  `PIVOT:TOTAL=<field>`. A drag on any value header sizes them all (the label says "all N columns")
  and stops at the widest number of ALL of them, so they land at one width; each column's missing
  max-width still holds a later, wider number whole. A two-row header (two aggregations, nested
  column fields) takes none. Per-column widths were not built: on `int-col-mat` 126 of 140 value
  cells carried `data-col-key` (not the Grand Total's), the keys are `@@HTML` links, and the drill
  attributes vanish with the breakdown off.
"""),
('insert', 'runbook',
"""`-DisableViews` switches it off with the rest of the grouped-view and pivot parts.
""",
"""`rollback.ps1 -Restore -Round 4` takes out only the round-4 widening (back to round 3: one value
column only) - the module and stylesheet from that deploy's `.bak` + `patch_colwidths4.py reverse`.
"""),
('insert', 'suite entry',
"""# the width - the save, the aggregation's own column as the key); real_input.py drags it too.
""",
"""# Round 4 (2026-10-01, phase Z): a ONE-ROW header's value columns, one width together - every FY
# column + its cells, the Grand Total on its own, the floor over all of them, the drag and keys on
# any one of them, a flat two-field column layout in, a nested one and two aggregations out.
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
