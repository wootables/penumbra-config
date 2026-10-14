# cmpfoot README edits (2026-09-30). README.md is LF. Anchored insertions, each anchor exactly once.
#   py -3 cf_readme.py forward SRC DST | reverse SRC DST
import sys

# The END of section 3's code block (suites append in date order): the entry goes before its fence.
S3_ANCHOR = "```\n\n## 4. Operations runbook\n"
S3_ADD = r"""
# Snapshot-diff footers recomputed in place (2026-09-30): while a comparison is on screen, a
# footer badge pick, the settings panel's badge SHOW toggle and a journal-summary refresh rerun
# _penumbraRecomputeFooterInPlace over the diff's own cells (see section 5). Browser-only: the REAL
# main.js renders a REAL compare-to-live and A-vs-B diff of a 6-row fixture (keys: ID; New /
# Removed / Modified / Unchanged, 2 rows each) and the driver clicks a footer badge and a menu
# option like a user - pages live (a badge pick, parity with a fresh render, the SHOW toggle),
# numhidden (the label relocated off a hidden '#') and ab (under an in-place search, parity with
# recomputeWrapperTotals). Measured 2026-09-30 on the stage: 25/0; --control (newest
# js\main.js.bak-*-cmpfoot) 14/11, exactly B1 B2 B4 B5 R1 T1 T2 H4 H5 A4 A6; --mutants 4/4 bite
# (`oneliner` = the fix with the name read from the header at the cell's index, as before).
# Python + websocket-client over CDP, ~@@SECS@@ s.
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\cmpfoot\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\cmpfoot\run.py --mutants
"""

S5_ANCHOR = "- **A local snapshot is filed under the report it was CAPTURED from, never the one that happens\n"
S5_ADD = r"""- **A snapshot diff's `<thead>` has one cell MORE than its `<tfoot>` (2026-09-30).** Both comparison
  renderers put a hidden `__SNAP_TYPE` column second in the header and in every body row (the group
  X buttons filter on it), and `generateComparisonTotalRow` gives the footer no cell for it. Pair a
  footer cell with its column by the cell's own `data-sum-col` (or its `data-column`), never by
  index: `_penumbraRecomputeFooterInPlace` looked its column name up as the `thead th` at the cell's
  index, so every summarized cell took the name - and so the summary type - of the column to its
  LEFT. It also summed `textContent`; read a diff cell through `_readComparisonCellText`, because a
  modified cell holds its was AND now views, and the two run together parse as NaN. Both defects
  hid behind a ReferenceError: `col`, undeclared since the accumulator gained its toggle-column
  argument (2026-08-02), threw on every call, so until 2026-09-30 that refresh never wrote a
  value. Suite `cmpfoot`.
"""

S6_ANCHOR = "| Was | Closed by |\n|---|---|\n"
S6_ADD = r"""| While a snapshot comparison was on screen, picking a summary type on a footer badge (and the settings panel's Hide / Show badges) changed nothing and threw `ReferenceError: col is not defined` - `_penumbraRecomputeFooterInPlace` handed the accumulator an undeclared `col` (since 2026-08-02, when the accumulator gained its toggle-column argument). The obvious one-line fix would have put two more defects live: the diff's `<thead>` has a hidden `__SNAP_TYPE` cell its `<tfoot>` lacks, so each footer cell took the column name of its LEFT neighbour (Average picked on AMOUNT turned QTY into an average and left AMOUNT on SUM), and modified cells were read as their was/now text run together (NaN, dropped from the summary) | The cell's own `data-sum-col` names the column, cells are read through `_readComparisonCellText` as the search's recompute reads them, and the TOTALS / SUMMARY label follows the types as a fresh render writes it; 2026-09-30 (`main.js.bak-20260930-cmpfoot`); suite `cmpfoot` |
"""

EDITS = [(S3_ANCHOR, S3_ADD + S3_ANCHOR), (S5_ANCHOR, S5_ADD + S5_ANCHOR), (S6_ANCHOR, S6_ANCHOR + S6_ADD)]

def swap(text, a, b, what):
    n = text.count(a)
    if n != 1: raise SystemExit('%s: anchor found %d times, expected 1: %r' % (what, n, a[:80]))
    return text.replace(a, b)

mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
secs = sys.argv[4] if len(sys.argv) > 4 else '60'
text = open(src, 'rb').read().decode('utf-8')
if '\r' in text: raise SystemExit('README is expected to be LF-only')
edits = [(a, b.replace('@@SECS@@', secs)) for a, b in EDITS]
for i, (a, b) in enumerate(edits):
    text = swap(text, a, b, 'edit %d' % (i + 1)) if mode == 'forward' else swap(text, b, a, 'reverse %d' % (i + 1))
open(dst, 'wb').write(text.encode('utf-8'))
print('%s: %s -> %s (%d bytes)' % (mode, src, dst, len(text.encode('utf-8'))))
