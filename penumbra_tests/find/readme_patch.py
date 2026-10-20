# find round 1 (2026-10-19): the README rows - section 3 (the suite) and section 5 (the landmine).
#   py -3 readme_patch.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

SUITE_ANCHOR = r"""$d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colscard'; & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
"""
SUITE_ADD = r"""
# Find in results (2026-10-19, "find" round 1): Ctrl+F on the FLAT table finds text without
# filtering - the matches on the page highlighted, "3 of 41", Enter / F3 / Ctrl+G across every page
# (lazy rows too), Esc hands the match to cell selection, "N more in rows your search hides",
# Filter to N rows. Static (16 I-): the include block run by PHP (on / .off / missing), its order
# after main.js and cell selection, the search help's Find section, php -l, the main.js patch
# markers (findHost, the applyPagination call, the cheat-sheet row), CRLF, an ASCII module. Browser
# (21 scenarios, the REAL main.js + cell selection + the format engine, the hiddencols fixture):
# keys, lazy rows, sort order, the search's scope, hidden columns, a column format (shown and
# stored), //exact// and /regex/, Filter to N rows, Esc, page turns, exports unchanged, grouped /
# Rows = None / &find=off left alone, nested JSON, entities, 3,000 rows. CONTROL: the live main.js
# and cell selection with no module = every behaviour check RED. `--mutants` runs all 28. About 3
# minutes; the mutants about 5. Run it from a LOCAL folder (headless Edge); --stage DIR = a stage
# in the app layout (the webroot for live). patch.py re-applies the four patches to new copies.
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\find\run.py [--stage DIR] [--control] [--mutants]
"""

LANDMINE_ANCHOR = """- **The Cols count opens the Columns card (2026-10-19, "colscard"; suite `colscard`).**"""
LANDMINE_ADD = """- **Find in results: Ctrl+F on the flat table (2026-10-19, "find" round 1; suite `find`).**
  js/penumbra_find.js + css/penumbra_find.css (an empty js/penumbra_find.off stops both; &find=off
  for one page). From main.js it needs `window.Penumbra.findHost` (the rows, a row's index, a
  column's render options and a value's HTML, `showRow` = turn to a row's page through
  `currentPage` + applyPagination, the search's own count for "Filter to N rows"), ONE call at the
  end of applyPagination (`find.paged()`: repaint the page, or read the table again when the kept
  rows' order or the columns changed - a page turn never re-reads) and the "?" sheet's Ctrl+F row;
  from cell selection `cellSel.activate(td)` (Esc hands the match over). A cell not drawn yet (a
  lazy row) is matched on the text `_pnbWriteCell` would draw (the column's format applied, @@HTML
  stripped, entities decoded, @@JSON read from formatCellContent's HTML in an inert template), a
  drawn cell on its DOM text, and the stored value (data-pnb-raw / the raw) counts too. Painting =
  the CSS Custom Highlight API + an outline (a match by its stored value only: an inset box-shadow
  tint), never a background or a `<mark>`: Copy as HTML and the email copy computed backgrounds.
  Keys on window, capture phase, ahead of main.js's document-capture Escape, which swallows every
  Esc (a test that an Esc did not leak needs a counter registered BEFORE main.js). The bar sits
  under the heading CELLS - they stick; the thead's own box scrolls away with the rows. Not built
  yet (rounds 2-3): the grouped view and the pivot, where Ctrl+F stays the browser's.
"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if 'penumbra_tests\\find\\run.py' in t: raise SystemExit('already patched')
    for name, a in (('suite', SUITE_ANCHOR), ('landmine', LANDMINE_ANCHOR)):
        n = t.count(a)
        print('  %-9s anchor x%d' % (name, n))
        if n != 1: raise SystemExit('nothing written')
    t = t.replace(SUITE_ANCHOR, SUITE_ANCHOR + SUITE_ADD)
    t = t.replace(LANDMINE_ANCHOR, LANDMINE_ADD + LANDMINE_ANCHOR)
    open(out, 'wb').write(t.encode('utf-8', 'surrogateescape'))
    print('wrote ' + out)

main()
