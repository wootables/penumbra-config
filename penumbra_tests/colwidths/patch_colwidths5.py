"""Column widths ROUND 5 (2026-10-01): a pivot's two-row header - groups and leaves.

    py -3 patch_colwidths5.py forward SRC_DIR OUT_DIR    apply every hunk (deploy build)
    py -3 patch_colwidths5.py reverse SRC_DIR OUT_DIR    undo every hunk (rollback build)
    py -3 patch_colwidths5.py check   SRC_DIR            report which way SRC_DIR stands

Rounds 1-4 must already be in SRC_DIR - these hunks anchor on the text round 4
inserted, so round 5 comes out BEFORE round 4 does (rollback.ps1 -Restore takes
them out newest first). js/main.js: a pivot VALUE column key (PIVOT:= ... and
PIVOT:TOTAL= ...) may be as narrow as 16px instead of 40 (its cells never go
under their widest number anyway), and the host says so (minValue).
help_content.php: the entry gains the two-row header. README.md: three inserts
after round 4's. index.php is not touched. Two kinds of hunk:
  insert   (anchor, text): forward needs ANCHOR once and ANCHOR+TEXT absent and
           puts TEXT right after ANCHOR; reverse needs ANCHOR+TEXT once.
  replace  (old, new):     forward needs OLD once and NEW absent; reverse needs
           NEW once and puts OLD back.
Anything else aborts BEFORE a byte is written, naming the hunk. Line endings
follow each file (main.js and help_content.php are CRLF, README.md LF); every
other byte, the two NULs in main.js included, is carried through.
js/penumbra_colwidths.js and css/penumbra_colwidths.css are whole-file swaps and
are not handled here.
"""
import os
import sys

HUNKS = {}

HUNKS['js/main.js'] = [
('insert', 'value column minimum',
"""    const PENUMBRA_COLW_MIN = 40, PENUMBRA_COLW_MAX = 2000;
""",
"""    // A pivot's VALUE columns may go narrower (2026-10-01): their cells never
    // go under their widest number anyway, and a column of nothing but '-'
    // needs about 16px.
    const PENUMBRA_COLW_MIN_VALUE = 16;
"""),
('replace', 'clean: the value minimum',
"""            if (isFinite(n) && n >= PENUMBRA_COLW_MIN && n <= PENUMBRA_COLW_MAX) out[name] = n;
""",
"""            const lo = (name.indexOf('PIVOT:=') === 0 || name.indexOf('PIVOT:TOTAL=') === 0) ? PENUMBRA_COLW_MIN_VALUE : PENUMBRA_COLW_MIN;
            if (isFinite(n) && n >= lo && n <= PENUMBRA_COLW_MAX) out[name] = n;
"""),
('insert', 'host minValue',
"""        min: PENUMBRA_COLW_MIN,
""",
"""        minValue: PENUMBRA_COLW_MIN_VALUE,
"""),
]

HUNKS['help_content.php'] = [
('insert', 'help entry',
"""Their widths belong to the field they total.""",
""" When the heading is <strong>two rows</strong> (several entries under <strong>Values</strong>, such as each year over Amount and % change), each year's heading resizes like a column of its own and shares its new width evenly among the columns under it, and each column under it resizes on its own; a column of nothing but dashes can go as narrow as a dash. These widths belong to the column's place (the first year, its second column), so they stay put as the years roll."""),
('replace', 'help entry tail',
"""a pivot with two entries under Values, or two fields nested under Columns, keeps sizing its value columns to their content""",
"""a pivot whose heading is three rows or more keeps sizing its value columns to their content"""),
]

HUNKS['README.md'] = [
('insert', 'design note',
"""  attributes vanish with the breakdown off.
""",
"""- **A TWO-ROW pivot header: groups and leaves, like a flat table at two levels (2026-10-01, round
  5).** Several aggregations under one column field (fycompprop: each FY over Amount / % change /
  YTD Run Total / Count / % change / YTD Run Count), two nested column fields, or the Grand Total
  split by its own aggregations: the top row's cells (row labels aside) are GROUPS, the second row's
  their LEAVES (a top cell spanning both rows is a leaf of its own). Every body, subtotal and footer
  row ENDS with one cell per leaf (measured: the last 18 of every fycompprop row), so a leaf's cells
  are `td:nth-last-child(<its place from the right>)` - which the row labels' rowspans on the left
  never disturb - and its header `tr:nth-child(<row>) > th:nth-last-child(<place>)`, on a table
  the module marks `data-pnb-colw-grid` (never the one-row mark, so rounds 3-4 never mix in). A leaf
  sizes alone (its group follows); a group sized whole shares its new width EVENLY among its leaves
  (`splitEven`: a leaf whose widest number is above the even share keeps it, the rest re-share).
  Keys by POSITION, `PIVOT:=<field>@<group>.<leaf>` (the Grand Total's group is T), so a fiscal-year
  comparison keeps its narrow baseline year as the years roll; flipping the year order moves them
  with the position. A value column may now be 16px (`PENUMBRA_COLW_MIN_VALUE`; everything else
  keeps 40): fycompprop's baseline-year "-" columns floor at 16. Three header rows: none.
"""),
('insert', 'runbook',
"""column only) - the module and stylesheet from that deploy's `.bak` + `patch_colwidths4.py reverse`.
""",
"""`rollback.ps1 -Restore -Round 5` takes out only the two-row header (back to round 4): the module and
stylesheet from that deploy's `.bak` + `patch_colwidths5.py reverse` (main.js loses the 16px value
minimum: a narrower stored width is then simply dropped by the clean pass).
"""),
('insert', 'suite entry',
"""# any one of them, a flat two-field column layout in, a nested one and two aggregations out.
""",
"""# Round 5 (2026-10-01, phase M): a TWO-ROW header - each group (a year) and each leaf under it sized
# like a flat table at two levels, the even split held at each leaf's widest number, a "-" column
# down to 16px, keys by position (the Grand Total's group T), nested column fields and the Grand
# Total's own aggregations in, three header rows out, no one-row width leaking in.
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
