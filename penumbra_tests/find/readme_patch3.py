# find round 3 (2026-10-19): the README rows - section 3 (the suite) and section 5 (the landmine).
#   py -3 readme_patch3.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

SUITE_OLD_HEAD = '# Find in results (2026-10-19, "find" rounds 1-2): Ctrl+F finds text without filtering in the flat\n'
SUITE_OLD_TAIL = "# re-applies round 1's four patches to new copies, patch2.py round 2's help bullets.\n"
SUITE_NEW = r"""# Find in results (2026-10-19, "find" rounds 1-3): Ctrl+F finds text without filtering in the flat
# table, the grouped view (Stacked and List) and the pivot - the matches highlighted, "3 of 41",
# Enter / F3 / Ctrl+G across every page (lazy rows too) and into closed groups (opened; the List
# layout picks the group; a pivot group expands), Esc hands the match to cell selection, "N more in
# rows your search hides", Filter to N rows (not in a pivot, not for a term the search holds or reads
# by value). Round 3: the bar at the window's top right (off the current match only), the busy cue,
# sliced reads + cached lazy texts, the search's own highlight (marks), the (i) tip, and main.js's
# busy() / runSearch / box-state sync. Static (17 I-): the include block run by PHP, its order, the
# search help, php -l, the main.js patch markers, CRLF, an ASCII module. Browser (47 scenarios, the
# REAL main.js + cell selection + the format engine + the List layout, the hiddencols fixture): the
# round 1-2 set plus the busy cue, text nodes and StaticRanges, class churn, a page turn mid-read,
# the Filter guards, the grouped Filter's applied search, the (i) tip and the form, the box's x after
# Filter, busy() without :visible, and the marks (flat, a column, the search's forms, grouped, pivot,
# with Find, print, no DOM writes). CONTROL: the live main.js and cell selection with no module =
# every behaviour check RED. `--mutants` runs all 64. `--scn sweep_a,sweep_b,sweep_c,grp_sweep_list,
# piv_sweep --dump`: seeded random walks (Find, the box, paging, sort, group / ungroup, pivot, groups
# opened) with invariants after every step (a fresh read, the highlights, the box's x, an empty box
# filters nothing, the marks). prof\prof.py = CPU profiles at 25,000 rows; themes\run_themes.py = the
# highlight contrast in all 18 themes. About 2 minutes; the mutants about 7. Run it from a LOCAL
# folder (headless Edge); --stage DIR = a stage in the app layout (the webroot for live). patch.py,
# patch2.py and patch3.py re-apply each round's patches to new copies.
"""

LAND_OLD = "  never read `hit.tr` unguarded. In a dialog Ctrl+F stays the browser's.\n"
LAND_NEW = r"""  never read `hit.tr` unguarded. In a dialog Ctrl+F stays the browser's. Round 3 (the same day):
  the bar sits at the WINDOW's top right in every view (place() moves it only off the current
  match). The highlights are OPAQUE chips that set their own text colour - ::highlight(pnb-find /
  pnb-find-cur / pnb-filter), the tokens on BODY (a theme's variables live on body.theme-x) -
  measured in all 18 themes (penumbra_tests\find\themes): the old see-through amber read 1.1:1 in
  the dark themes. Ranges are StaticRanges (live ones taxed every DOM change under them); the bar's
  labels change a text node's data (penumbra_a11y.js sweeps the page after any node is added or
  removed); the watcher takes up only the classes that move the view (VIEW_CLASSES - zebra stripes
  and hover cues used to restart reads). Reads run in ~10 ms slices with a lazy cell's text cached
  per Find session (textCache: the row Map, the column set and formats); the Filter count runs in
  slices (findHost.searchCountAsync). THE SEARCH'S OWN HIGHLIGHT (marks): findHost.searchTerms(q)
  reads the terms with parseAdvancedQuery (contains, =, //exact//, /regex/, a column's term in its
  column; comparisons, negations, ranges, empty and {COL} mark nothing), painted for the rows on
  screen (around the viewport past 600 rows), repainted from paged() and a watcher on the grouped /
  pivot containers, taken off for a print. main.js: _pnbHotkeyUiBusy asks by id and class - a
  comma-joined :visible selector made jQuery test every element (4-5 s a call at 480,000 elements, on
  every Ctrl+F, PageUp / PageDown / Home / End, single key and paste): never put :visible in a group
  selector on a hot path. findHost.runSearch and _pnbSyncSearchBoxState (the end of applyPagination)
  keep the box's has-text and previousSearchValue in step with its text (a .val() fires no keyup).
  index.php: the report search box is a FORM (onsubmit return false) - a browser's autofill walks the
  whole page for a focused field outside any form (0.2 s a focus in Edge at 25,000 rows).
"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if '"find" rounds 1-3' in t: raise SystemExit('already patched')
    if '\r\n' in t: raise SystemExit('the README has CRLF: the anchors are LF')
    a = t.find(SUITE_OLD_HEAD); b = t.find(SUITE_OLD_TAIL)
    print('  suite    head x%d tail x%d' % (t.count(SUITE_OLD_HEAD), t.count(SUITE_OLD_TAIL)))
    print('  landmine anchor x%d' % t.count(LAND_OLD))
    if t.count(SUITE_OLD_HEAD) != 1 or t.count(SUITE_OLD_TAIL) != 1 or b < a or t.count(LAND_OLD) != 1:
        raise SystemExit('nothing written')
    t = t[:a] + SUITE_NEW + t[b + len(SUITE_OLD_TAIL):]
    t = t.replace(LAND_OLD, LAND_NEW)
    open(out, 'wb').write(t.encode('utf-8', 'surrogateescape'))
    print('wrote ' + out)

main()
