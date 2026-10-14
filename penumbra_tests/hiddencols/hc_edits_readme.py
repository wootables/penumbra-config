# README.md (LF) edits, loaded by hc_patch.py after hc_edits.py: the suite, the
# switch, the capacity note, the landmines, and the one related follow-up.
# Raw strings: README text holds backslashed UNC paths.

edit('README.md', 'readme-suite', r'''& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\switchmotion\run.ps1'))) -Mutants
```
''', r'''& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\switchmotion\run.ps1'))) -Mutants

# Hidden columns built EMPTY (2026-09-30): a hidden column's cells are created empty
# (data-pnb-lazy) and filled from masterRowData the moment anything needs their content - see
# section 5. DIFFERENTIAL: each scenario loads the REAL main.js twice - the build BEFORE the
# change (newest js\main.js.bak-*-hiddencols, or --baseline) and the build under test - through
# the real run path on a 300-row fixture with 14 hidden columns of every value shape (@@HTML
# links, @@JSON, entities, multi-line, nulls), drives ONE reader of hidden cells (Settings-panel
# Apply, a saved sort / grouping / nested levels / summary sort on hidden columns, format() /
# heatmap() / rewrite() rules naming them, copy_distinct, the Copy dialog, custom templates, the
# nested-column plan, search, the default-7 block, both off switches) and requires identical
# fingerprints - every element, attribute and text node except the inside of a still-hidden
# cell - identical page errors, and the empty-cell census the design promises (the columns the
# scenario reads are filled, every other hidden column still empty, no still-marked cell holding
# content). Measured 2026-09-30 on the stage: 56/0 over 20 scenarios; --control (the old build as
# the candidate) 39/17, exactly the 17 census/notice asserts; --mutants 24/24 (22 bite, and the 2
# "eq-" layers are redundant by design and stay green). Python + websocket-client over CDP, ~3 min.
# bench.py + bench_harness.html in the same folder are the timing harness behind the numbers in
# section 5 (py -3 bench.py <label> <main.js> "rows=2000&cols=150&vis=10&html=0.1" --ops).
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\hiddencols\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\hiddencols\run.py --mutants
```
''')

edit('README.md', 'readme-runbook', r'''### "I need to take the app down"
''', r'''### "Hidden columns look wrong - build every cell up front again"

Since 2026-09-30 a hidden column's cells are built EMPTY and filled when something needs them
(section 5). If a hidden column ever shows blank cells, or sorts, groups or copies wrong: create
an empty `js\penumbra_lazycells.off` in the app folder. The next page load builds every cell up
front again, exactly as before (index.php passes it to main.js as `penumbra_vars.lazyCellsOff`);
delete it to switch back. `&lazycells=off` does the same for one page - compare a report with
and without it first. The rest of that change (native results-wrapper lookups, the count after
the page loop, the skipped style resets) has no switch: it changes nothing a user can see.
`py -3 penumbra_tests\hiddencols\hc_patch.py reverse <in> <out>` takes the whole change back out
of main.js, index.php and README.md - exactly the inserted lines, so later deploys by others stay.

### "I need to take the app down"
''')

edit('README.md', 'readme-capacity', r'''~10 s freeze *and* roughly 0.7-1.9 GB of browser RAM, so both budgets land in the same place.
''', r'''~10 s freeze *and* roughly 0.7-1.9 GB of browser RAM, so both budgets land in the same place.

**Hidden columns (2026-09-30):** their cells are built EMPTY and filled on demand (section 5) -
~2 us a cell against ~18 us for a shown one, and one element with no content nodes - so a hidden
column costs about a tenth of a shown one. The loading notice counts it at
`_PNB_EMPTY_CELL_WEIGHT` = 0.1 (in the quoted estimate AND the recorded rate), and its author tip
now says hiding columns helps.
''')

edit('README.md', 'readme-notice-guidance', r'''page will not respond until it finishes", plus a guidance line steering to fewer *rows* - and
''', r'''page will not respond until it finishes", plus a guidance line steering to fewer *rows* (and,
since hidden columns are built empty on 2026-09-30, fewer shown columns) - and
''')

edit('README.md', 'readme-landmines', r'''  downloads, email and the scheduler never read `columnWidths`. Suite `colwidths`.
''', r'''  downloads, email and the scheduler never read `columnWidths`. Suite `colwidths`.
- **A hidden column's cells are EMPTY until something fills them (2026-09-30).** The flat build
  still creates every `<td>` - same `data-column`, same position, so every "header position ==
  cell position" reader lines up - but a HIDDEN column's cells hold nothing and carry
  `data-pnb-lazy` (an attribute, so the mark survives into the grouped view's cell clones). They
  are filled from masterRowData, exactly as the build writes a shown cell, by
  `penumbraFillLazyColumns(ids)` / `penumbraFillLazyColumnsByName(names)` /
  `penumbraFillVisibleLazyColumns()`; `_pnbLazyCols` lists the columns that may still hold empty
  cells. **Any new code that reads the TEXT or HTML of a flat or grouped cell whose column can be
  hidden must call a fill helper first** (or read masterRowData, as search, totals, exports, the
  snippet engine and pivot already do) - otherwise it reads ''. Wired 2026-09-30: show
  (Settings-panel Apply, the default-7 block, and safety nets in applyPagination /
  postColumnToggle / rebuildGroupedView), sortRows, grouping (level 0, levels 1-2, the summary
  column and summary sort, the width sampler's probe), format() / heatmap() / rewrite() rules,
  copy_distinct, the Copy dialog, custom templates and the nested-column plan; resetCellStates
  skips empty cells' content. A build where two column names differ only by case stays eager
  (masterRowData keys are upper-cased). Measured on 2,000 rows x 150 columns with 10 shown: load
  5.3 s -> 1.3 s, search 1.5 s -> 0.2 s, sort 1.4 s -> 0.4 s; with one format() rule, load
  11.9 s -> 2.2 s and search 9.0 s -> 1.6 s. Switch: `js/penumbra_lazycells.off` /
  `&lazycells=off`. Suite `hiddencols`.
- **A context-less jQuery `:visible` (or attribute-only) selector scans EVERY element (2026-09-30).**
  `$('[id="results-wrapper"]:visible')` gave the selector engine no ID/TAG/CLASS seed, so it
  walked the whole document and ran `:visible` on each element - ~0.7 s per search, sort and load
  on a 300,000-cell table, hidden cells included. `_pnbVisibleResultsWrappers()` does it natively
  (`querySelectorAll('#results-wrapper')` returns every element sharing the id; the PiP retry is
  kept). Also: a forced style read (`:visible`, offsetWidth, getComputedStyle) between a search
  displaying every match and applyPagination hiding all but one page restyles EVERY matched row -
  applyPagination runs its count / PDF guard after the page loop for that reason.
''')

edit('README.md', 'readme-open-item', r'''## 6. Known open items
''', r'''## 6. Known open items
- **A flat search still displays every match before pagination hides all but one page
  (2026-09-30).** runTableSearch's phase 2 sets `display` on every matched row, then
  renderReportSnippet runs, then applyPagination re-hides everything past the page. Any forced
  style read in between (a format() rule's pass asks `:visible` of the containers) restyles every
  matched row, hidden columns' cells included: ~0.5 s of the remaining ~1.6 s search with one
  format() rule on 2,000 x 150 (hiddencols bench). Fix = page-aware display in phase 2; needs its
  own audit first (heatmap scope=page reads row display in that window).
''')
