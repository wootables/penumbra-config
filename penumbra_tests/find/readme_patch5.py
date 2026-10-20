# find round 5 (2026-10-20): the README rows - section 3 (the suite) and section 5 (the landmine).
#   py -3 readme_patch5.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

SUITE_OLD_HEAD = '# Find in results (2026-10-19..20, "find" rounds 1-4): Ctrl+F finds text without filtering in the\n'
SUITE_OLD_TAIL = "# new copies (round 4 changed only the module and its css: whole new copies, deploy6.ps1).\n"
SUITE_NEW = r"""# Find in results (2026-10-19..20, "find" rounds 1-5): Ctrl+F finds text without filtering in the
# flat table, the grouped view (Stacked and List), the pivot and a dialog that shows a table - the
# matches highlighted, "3 of 41", Enter / F3 / Ctrl+G across every page (lazy rows too) and into
# closed groups (opened; the List layout picks the group; a pivot group expands), Esc hands the
# match to cell selection, "N more in rows your filter hides", Filter to N rows (not in a pivot or
# a dialog, not for a term the search holds or reads by value). Round 3: the bar at the window's
# top right (off the current match only), the busy cue, sliced reads + cached lazy texts, the
# search's own highlight (marks), the (i) tip, and main.js's busy() / runSearch / box-state sync.
# Round 4: one size from the open (the count, the spinner and Filter keep their places; with a
# filter on, the "N more" line's room). Round 5: a breakdown / Table Info dialog (the topmost
# infobox with a table), a snapshot comparison's group names, the narrow window's two-row bar.
# Static (18 I-): the include block run by PHP, its order, the search help (round 5's dialog line
# too), php -l, the main.js patch markers, CRLF, an ASCII module. Browser (58 scenarios, the REAL
# main.js + cell selection + the format engine + the List layout, the hiddencols fixture): the
# round 1-2 set plus the busy cue, text nodes and StaticRanges, class churn, a page turn
# mid-read, the Filter guards, the grouped Filter's applied search, the (i) tip and the form, the
# box's x after Filter, busy() without :visible, the marks (flat, a column, the search's forms,
# grouped, pivot, with Find, print, no DOM writes), the bar's one size (flat and grouped: every
# state the same width and height, the longest probable words fit their places, the room cleared
# at close) and round 5's: a REAL breakdown (main.js's _showChartDrillBreakdown, hooked) - taken,
# drawn over the dialog's layer, its cells counted ('#' out), stepping inside it, no Filter, a
# sort read again, Esc closing Find and not the dialog, the dialog closing ending Find; a dialog of
# words left to the browser; Find on the table, then in a breakdown, then back; a breakdown opened
# over another ending Find in the lower one; a REAL snapshot-vs-snapshot comparison
# (runComparisonTwoSnapshots; the harness carries index.php's snapshotAnalysisTemplate and a
# hidden #manageSnapshotsLightbox, whose fadeOut callback draws it) - a group's name found, never
# its count, outlined; and the bar at 420 / 700 / 760 px wide (Emulation.setDeviceMetricsOverride
# from a scenario's &vw=&vh=). CONTROL: the live main.js and cell selection with no module = every
# behaviour check RED (but the absences and the live main.js's own checks, CONTROL_OK).
# `--mutants` runs all 89. `--scn sweep_a,sweep_b,sweep_c,grp_sweep_list,piv_sweep --dump`: seeded
# random walks (Find, the box, paging, sort, group / ungroup, pivot, groups opened) with invariants
# after every step (a fresh read, the highlights, the box's x, an empty box filters nothing, the
# marks); `--scn shot,shot_open,shot_kilo,shot_dlg,shot_narrow,shot_narrow_mid,shot_cmp --shot
# X.png` = pictures of the bar. prof\prof.py = CPU profiles at 25,000 rows; themes\run_themes.py =
# the highlight contrast in all 18 themes. About 3 minutes; the mutants about 10. Run it from a
# LOCAL folder (headless Edge); --stage DIR = a stage in the app layout (the webroot for live).
# patch.py, patch2.py and patch3.py re-apply rounds 1-3's patches to new copies (rounds 4-5
# changed only the module, its css and the help topic: whole new copies, deploy6.ps1 / deploy7.ps1).
"""

LAND_OLD = "  as flex items of the bar, the lines under them counted toward its max-content width (+8 px).\n"
LAND_NEW = r"""  as flex items of the bar, the lines under them counted toward its max-content width (+8 px).
  Round 5 (2026-10-20, the user: Ctrl+F inside dialogs like the breakdown, group names in a
  snapshot comparison, and the bar on narrow windows): IN A DIALOG that shows a table, Ctrl+F is
  Find's. topDialog() is the last .infobox-overlay on screen whose .infobox-body holds a table
  cell AND that nothing else covers (document.elementsFromPoint at its box's top, past Find's own
  bar); Find keeps that overlay (dlg) for its session. Its units are the dialog's top-level
  tables' body and footer cells, the '#' column out (numCol) and tables not on screen out (Table
  Info's other tabs); its signature is the rows' ORDER (a WeakMap row id: a header click sorts a
  breakdown by moving the same rows) and which tables show. The bar keeps the window's top right,
  its z-index the overlay's + 1 (100001 over the modal layer's 100000). No Filter and no "N more"
  (a dialog's rows are its own). main.js's busy() is true under any infobox, so Ctrl+F, F3 and
  Ctrl+G ask topDialog() first. The watcher observes the dialog's subtree and its parent's
  children: a sort re-reads; the dialog's removal, or another one drawn over it, ends Find there
  (scopeAlive). Ctrl+F in another place (a dialog over the table's open Find, or back) closes and
  re-opens there with the term kept (enter()). A dialog of words (no table) keeps the browser's
  find. A SNAPSHOT COMPARISON's heading is <span class="group-hide">x</span><span>NAME <span
  class="group-count">N</span></span>: bandLabel takes the heading's span that is none of the
  heading's parts (never "the span with no class": a painted match gives it one), and .group-count
  is in SKIP. A NARROW WINDOW (720 px and less): the bar spans it (left / right 8 px) as a two-row
  grid - the box and its buttons, then the count and Filter - with fixed 24 px rows (an empty
  count and Filter made row 2 shorter, so the bar grew as the results came in).
"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if '"find" rounds 1-5' in t: raise SystemExit('already patched')
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
