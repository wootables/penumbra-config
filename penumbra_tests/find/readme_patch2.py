# find round 2 (2026-10-19): the README rows - section 3 (the suite) and section 5 (the landmine)
# now cover the grouped view and the pivot.
#   py -3 readme_patch2.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

SUITE_OLD = r"""# Find in results (2026-10-19, "find" round 1): Ctrl+F on the FLAT table finds text without
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
"""
SUITE_NEW = r"""# Find in results (2026-10-19, "find" rounds 1-2): Ctrl+F finds text without filtering in the flat
# table, the grouped view (Stacked and List) and the pivot - the matches on the page highlighted,
# "3 of 41", Enter / F3 / Ctrl+G across every page (lazy rows too) and into closed groups (opened;
# the List layout picks the group; a pivot group expands), Esc hands the match to cell selection,
# "N more in rows your search hides", Filter to N rows (not in a pivot, not for a term the search
# already holds), the bar moved off the current match. Static (17 I-): the include block run by
# PHP (on / .off / missing), its order after main.js and cell selection, the search help's Find
# section (round 2's bullets), php -l, the main.js patch markers (findHost, the applyPagination
# call, the cheat-sheet row), CRLF, an ASCII module. Browser (32 scenarios, the REAL main.js + cell
# selection + the format engine + the List layout, the hiddencols fixture): keys, lazy rows, sort
# order, the search's scope, hidden columns, a column format (shown and stored), //exact// and
# /regex/, Filter to N rows, Esc, page turns, exports unchanged, Rows = None / &find=off left
# alone, nested JSON, entities, 3,000 rows, the bar off the match; grouped: Stacked open / closed /
# nested and closed, List, a search's scope, Filter, Esc, a group's name; pivot: open, closed, Esc.
# CONTROL: the live main.js and cell selection with no module = every behaviour check RED.
# `--mutants` runs all 40. About 70 s; the mutants several minutes. Run it from a LOCAL folder
# (headless Edge); --stage DIR = a stage in the app layout (the webroot for live). patch.py
# re-applies round 1's four patches to new copies, patch2.py round 2's help bullets.
"""

HEAD_OLD = """- **Find in results: Ctrl+F on the flat table (2026-10-19, "find" round 1; suite `find`).**
"""
HEAD_NEW = """- **Find in results: Ctrl+F in the flat table, the grouped view and the pivot (2026-10-19, "find"
  rounds 1-2; suite `find`).**
"""
TAIL_OLD = """  under the heading CELLS - they stick; the thead's own box scrolls away with the rows. Not built
  yet (rounds 2-3): the grouped view and the pivot, where Ctrl+F stays the browser's.
"""
TAIL_NEW = """  under the heading CELLS - they stick; the thead's own box scrolls away with the rows. Round 2
  (the same day) reads the grouped view (Stacked and List) and the pivot from the DOM: every group
  table and pivot row is built at render (a lazy pivot is built whole first, pivotMenu.ensureAll).
  A grouped view's matches are each heading's `.group-name`, then the shown columns' cells, in
  page order (rows or groups the search hides = "N more"); a pivot's are its body and Grand Total
  cells, a group's summary row only while it is drawn. Stepping into a closed group opens it:
  Stacked = the `.group-wrapper` chain gets `open` + display:block, then
  groupLayoutHost.afterToggle(); List = groupList.selectGroup(the innermost wrapper), since its
  band clicks are swallowed; a collapsed pivot group expands by clicking its chevrons level by
  level, as revealPivotNote does. A pivot gets no Filter (its cells are mostly sums). There is no
  pivot render event: a MutationObserver on the grouped and pivot containers re-reads (debounced
  60 ms) and ignores its own classes (pnb-find*, pnb-csel*) and style changes that keep the
  display. The bar drops to the bottom of the results box when it would cover the current match;
  Filter is not offered when the search already holds the term (as one of its AND parts). In a
  dialog Ctrl+F stays the browser's.
"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if '"find" rounds 1-2' in t: raise SystemExit('already patched')
    if '\r\n' in t: raise SystemExit('the README has CRLF: the anchors are LF')
    for name, a in (('suite', SUITE_OLD), ('head', HEAD_OLD), ('tail', TAIL_OLD)):
        n = t.count(a)
        print('  %-6s anchor x%d' % (name, n))
        if n != 1: raise SystemExit('nothing written')
    t = t.replace(SUITE_OLD, SUITE_NEW).replace(HEAD_OLD, HEAD_NEW).replace(TAIL_OLD, TAIL_NEW)
    open(out, 'wb').write(t.encode('utf-8', 'surrogateescape'))
    print('wrote ' + out)

main()
