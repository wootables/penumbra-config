# find round 4 (2026-10-20): the README rows - section 3 (the suite) and section 5 (the landmine).
#   py -3 readme_patch4.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

SUITE_OLD_HEAD = '# Find in results (2026-10-19, "find" rounds 1-3): Ctrl+F finds text without filtering in the flat\n'
SUITE_OLD_TAIL = "# patch2.py and patch3.py re-apply each round's patches to new copies.\n"
SUITE_NEW = r"""# Find in results (2026-10-19..20, "find" rounds 1-4): Ctrl+F finds text without filtering in the
# flat table, the grouped view (Stacked and List) and the pivot - the matches highlighted, "3 of 41",
# Enter / F3 / Ctrl+G across every page (lazy rows too) and into closed groups (opened; the List
# layout picks the group; a pivot group expands), Esc hands the match to cell selection, "N more in
# rows your filter hides", Filter to N rows (not in a pivot, not for a term the search holds or reads
# by value). Round 3: the bar at the window's top right (off the current match only), the busy cue,
# sliced reads + cached lazy texts, the search's own highlight (marks), the (i) tip, and main.js's
# busy() / runSearch / box-state sync. Round 4: one size from the open (the count, the spinner and
# Filter keep their places; with a filter on, the "N more" line's room). Static (17 I-): the include
# block run by PHP, its order, the search help, php -l, the main.js patch markers, CRLF, an ASCII
# module. Browser (50 scenarios, the REAL main.js + cell selection + the format engine + the List
# layout, the hiddencols fixture): the round 1-2 set plus the busy cue, text nodes and StaticRanges,
# class churn, a page turn mid-read, the Filter guards, the grouped Filter's applied search, the (i)
# tip and the form, the box's x after Filter, busy() without :visible, the marks (flat, a column, the
# search's forms, grouped, pivot, with Find, print, no DOM writes) and the bar's one size (flat and
# grouped: every state the same width and height, the longest probable words fit their places, the
# room cleared at close). CONTROL: the live main.js and cell selection with no module = every
# behaviour check RED (but the absences and the live main.js's own checks, CONTROL_OK). `--mutants`
# runs all 74. `--scn sweep_a,sweep_b,sweep_c,grp_sweep_list,piv_sweep --dump`: seeded random walks
# (Find, the box, paging, sort, group / ungroup, pivot, groups opened) with invariants after every
# step (a fresh read, the highlights, the box's x, an empty box filters nothing, the marks);
# `--scn shot,shot_open,shot_kilo --shot X.png` = pictures of the bar. prof\prof.py = CPU profiles at
# 25,000 rows; themes\run_themes.py = the highlight contrast in all 18 themes. About 2 minutes; the
# mutants about 8. Run it from a LOCAL folder (headless Edge); --stage DIR = a stage in the app
# layout (the webroot for live). patch.py, patch2.py and patch3.py re-apply rounds 1-3's patches to
# new copies (round 4 changed only the module and its css: whole new copies, deploy6.ps1).
"""

LAND_OLD = "  whole page for a focused field outside any form (0.2 s a focus in Edge at 25,000 rows).\n"
LAND_NEW = r"""  whole page for a focused field outside any form (0.2 s a focus in Edge at 25,000 rows).
  Round 4 (2026-10-20, the user: start at the max probable size, no resizing as results come in):
  the bar opens at its probable largest and holds it. The count keeps 15.5ch (its longest words:
  Not a valid pattern, Searching... 99%, 99,999 of 99,999) and Filter to N rows 17ch (Filter to
  99,999 rows) - in ch, so they follow the report's font (--report-font; measured in Verdana, the
  default); the spinner and the button keep their places while not shown (visibility, not
  display: a [hidden] Filter button stays inline-block, so test it by .hidden, never by its box).
  With a filter on in the flat or grouped view, the "N more..." line's height is kept from the open
  (.pnb-find-room, sticky until close; close() empties the line too - left as it was, the next
  open read it as shown and kept the room). The controls sit in a row of their own (.pnb-find-row):
  as flex items of the bar, the lines under them counted toward its max-content width (+8 px).
"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if '"find" rounds 1-4' in t: raise SystemExit('already patched')
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
