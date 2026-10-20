# Find in results, rounds 1-3 (2026-10-19) - the flat table, the grouped view and the pivot, then the place, the colours, the search's own highlight and speed

Ctrl+F (Cmd+F) on a report's flat table opens a small bar under the column headings, top right of
the results. It finds text WITHOUT filtering: every match on the page highlighted, "3 of 41",
Enter / Shift+Enter, F3 / Shift+F3, Ctrl+G / Ctrl+Shift+G step across EVERY page (lazy rows
included), Esc closes and hands the match to cell selection as the active cell. Ctrl+F again in
the box = the browser's own find. A line counts the matches in rows the search hides; "Filter to
N rows" (Alt+Enter) hands the term to the search box (N = the search's own count; ANDed onto an
applied search, never onto one with OR). Terms: plain text, `//exact//`, `/regex/` (`/re/I` minds
case). Matches what a cell SHOWS and its stored value ($1,234.50 and 1234.5). Not taken in the
grouped view, a pivot, a dialog, a text field or Rows = None (round 1).

## The kit

| Path | What |
|---|---|
| `stage\` | THE DEPLOY SET (app layout). New: `js/penumbra_find.js`, `css/penumbra_find.css`. Patched: `js/main.js` (window.Penumbra.findHost + one call at the end of applyPagination + the "?" cheat-sheet row), `index.php` (the include block + the `js/penumbra_find.off` switch), `js/penumbra_cellsel.js` (`cellSel.activate(td)`), `help/topics/searchHelpLightbox.php` (the "Find Without Filtering (Ctrl+F)" section + its jump link). |
| `orig\` | The live copies the stage was cut from (2026-10-19 12:33) + `SHA256SUMS.txt`. |
| `patch.py` | Re-applies the four patches to any copies: `py -3 patch.py SRC OUT` (`--check` = anchors only). Every anchor must hit once; nothing is written otherwise. |
| `run.py`, `suite_def.py`, `harness.html`, `driver.js` | The suite (below). |

## The suite

Run from a LOCAL cwd (headless Edge): `cd $env:TEMP; py -3 \\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\find\run.py`

* default: candidate = `stage\` (or `--stage DIR`): I-* (no browser: the include block run by PHP on / .off / missing, order, help, lint, the patch markers, CRLF, ASCII) + 21 scenarios.
* `--control`: LIVE main.js + LIVE cell selection, NO module: every behaviour check red; sane* and the absences in CONTROL_OK green.
* `--mutants` / `--mutant NAME`: 28 targeted mutants (module, main.js, cellsel), each must turn its named checks red.
* `--dump --scn probe|shot,shotdark [--shot X.png]`: facts / pictures, never in a default run.

Results 2026-10-19 (final stage): **141/0**, control **wrong=0**, mutants **28/28**. Regression on the stage:
cellsel 217/0, lazyrows 96/0 (every export / copy identical to the eager baseline), sortpage 18/0,
searchbox 37/0. helpv2 `lint_help.php`: the search topic clean; L16 is red ONLY for
userSettingsHelpLightbox (a 125-word paragraph, an 89-word cell) and live is red the same way:
pre-existing, not this change. 3,000 rows: reading them 32 ms, the last match (page 15) 149 ms.

## Deployed 2026-10-19 13:38:40-46 EDT (git 05a096a + help cache 10c7fe8 + README 9e3047f, pushed)

Live moved twice after the first cut (colscard 249f81d at 13:20, calcadj 176e29c at 13:36:36 - the second one
between the dry run and the swap; the guard stopped it with nothing written). What went live = `stage3\` (cut from
`orig3\` at 13:37, the change set proved identical to `stage\`, 141/0 + every mutant anchor x1 on it).
`deploy.ps1` = the swap that ran (guards; each live sha re-checked right before its MoveFileEx). After: help cache
rebuilt (1,314 chunks, signature match), find 141/0 against the live webroot, php82_errors.log untouched.
`readme_patch.py` = the README rows (sections 3 and 5). The steps below are kept as the recipe.

### The deploy steps (as followed)

1. Pre-flight (atomic recipe): `git status --porcelain` empty for the four patched paths; live sha256 ==
   `orig\SHA256SUMS.txt`. Live moved? Copy live to `orig2`, `py -3 patch.py orig2 stage2`, copy the two new
   files into `stage2`, rerun the suite with `--stage stage2` (+ `--control`), deploy `stage2`.
2. Swap (MoveFileEx per file): the new `js/penumbra_find.js` + `css/penumbra_find.css`, then `js/main.js`,
   `js/penumbra_cellsel.js`, `help/topics/searchHelpLightbox.php`, and `index.php` LAST (it switches the
   module on).
3. After: `php prebuild_caches.php` on live (the help chunk cache), the suite against live
   (`--stage <webroot>`), php82_errors.log, commit + push the six paths, README section 6 + changelog row.
4. Rollback without a deploy: an empty `js/penumbra_find.off` (index.php stops loading both files; main.js's
   host is inert). For one page: `&find=off`.

## Traps found

* The heading CELLS are sticky, not the thead: the thead's box scrolls away with the rows - measure a `th`.
* main.js's own Escape handler (document, capture) preventDefaults and swallows every Esc: proving Find
  consumed one needs a counter registered BEFORE main.js (the harness has `window.__docEsc`).
* Ctrl+F inside Find's own box is already left to the browser by the text-field guard (an explicit line for
  it was an equivalent mutant - removed).
* Two layers guard the hidden raw JSON (its class + the inline display:none) and the grouped view (the
  grouped / pivot check + the flat table's own visibility): their mutants remove BOTH layers.
* A plain lazy value is also found by the stored-value fallback: `count1` asserts `raw === false` to prove the
  shown-text path.
* The search reads `Zulu Unique` as TWO terms (AND) and `"Zulu Unique"` as one (testCondition strips the
  quote pair): Filter quotes a term that is more than one plain word.

# Round 2 (2026-10-19 afternoon) - the grouped view, the pivot, and the two live findings

Asked by the user after the live check of round 1 ("Yes fix both, but also ctrl+f still opens the default
chrome find for me" - in a grouped report and a pivot). Three files only: `js/penumbra_find.js`,
`css/penumbra_find.css`, `help/topics/searchHelpLightbox.php` (`patch2.py`: the two round-2 bullets).
main.js, index.php and cell selection are unchanged.

* **Grouped view (Stacked and List).** Every group table is built at render, so Find reads the DOM: each
  heading's `.group-name` (a "band" match), then the shown columns' cells of each group table, in page order.
  Rows or groups the search hides count in "N more". Stepping into a closed group opens it: Stacked = the
  `.group-wrapper` chain gets `open` + display:block, then `groupLayoutHost.afterToggle()`; List =
  `Penumbra.groupList.selectGroup(innermost wrapper)` (its band clicks are swallowed). Filter is offered (the
  search box's value is the applied search).
* **Pivot.** The body and Grand Total cells; a group's summary row only while it is drawn. A collapsed group
  expands by clicking its chevrons level by level (as revealPivotNote does); a lazy pivot is built whole first
  (`pivotMenu.ensureAll()`). No Filter (its cells are mostly sums). The left edge for reveal = the sticky
  `thead th.pivot-last-sticky`.
* **No render event for the pivot:** a MutationObserver on `#groupedResultsContainer` and
  `#pivot-output-container` (debounced 60 ms) re-reads; it ignores its own classes (`pnb-find*`, `pnb-csel*`)
  and style changes that keep the display.
* **Finding 1 (the bar covered the match):** `place()` drops the bar to the bottom of the results box (above
  the status bar) when it would cover the current match. Suite: `cover`; mutant `nocoverflip`.
* **Finding 2 ("term AND term"):** `promoted()` returns null when the applied search already holds the term
  as one of its AND parts. Suite: `filter` noReoffer; mutant `reoffer`.
* **A group name's outline:** the current band match's class lands on `.group-name` (not the header):
  `#groupedResultsContainer .group-name.pnb-find-cur` (outline-offset 2px). Check `bandOutline`; mutant
  `nobandoutline`.

Results (stage4 = what went live as stage5): **207/0** (17 I- + 32 scenarios), control **wrong=0**, mutants
**40/40**. helpv2 lint: searchHelpLightbox clean (L16 red only for userSettingsHelpLightbox, pre-existing).

## Deployed 2026-10-19 14:34:22-23 EDT (git 0d78629 + help cache 7506b96 + README 33e4050, pushed)

`deploy2.ps1` from `stage5\` (cut `orig5\` 14:25 == round 1's files; live main.js / cellsel / index.php ==
the stage4 copies the suite ran with). After: help cache rebuilt (1,314 chunks, signature match), find
**207/0 against LIVE**, php82_errors.log untouched (last write 12:06).

**Live E2E (work-laptop Chrome, real keys):** ?id=hitratio (pivot, 2,162 PI rows ALL in collapsed groups):
Ctrl+F taken; "Townley" = 1 of 1 inside two collapsed levels, both expanded, the cell in view and
outlined, no Filter; "Mary" = 10, Enter / Enter / Shift+Enter stepped across colleges, each group
expanded, in view; Esc = bar closed, every mark gone, the match = the active cell. ?id=pipins (List
layout, 509 groups): "Healey" picked group 020301 (was 010101), the cell in view; a group's name =
the `.group-name` outlined (solid 2px); Filter to 2 rows (a real click) = search "Healey", 2 rows in
2 of 19 groups, Find still open, Filter NOT offered again; Esc = the active cell. No app console error.

**Finding (round 2b):** the first match a long group name in ANOTHER group -> the bar sat on it. The
List layout draws the picked band's crumb ("02 - Provost >") a frame after the pick, through the
`--pnb-gl-crumb` variable on #groupedResultsContainer's style: the name slid right, under the bar,
after place() ran, and relevant() ignores a style change that keeps the display. Fix: the watcher's
not-relevant branch calls onMove() (rAF place). Check grp_list `barFollows` (pads the name under the
bar, 3 frames, the bar must have moved); mutant `nofollow`. Suite 208/0, control wrong=0, 41/41.
`deploy3.ps1` (stage6 / orig6, the module only), `readme_patch2b.py`. **LIVE 14:48:08 (git 42a77a7 + README
f76ce60, pushed)**; find 208/0 on LIVE; the same repro on pipins = the name in full, the bar at the box's
bottom.

**Finding (round 2c):** Esc with the current match on a group's NAME threw `Cannot read properties of null
(reading 'isConnected')` in close() (a band has no row; close() read `hit.tr` to find the cell to hand
over) and the bar stayed open; every close(false) (the view changing, Rows = None) had the same hole. The
suite's Esc checks only ever closed on a cell. Fix: `hit && hit.tr && ...` (no cell to hand over, the focus
goes back). Check grp_stack `bandEsc`; mutant `bandescthrows` (reproduces the TypeError: E-grp_stack red
too). Audit: close() was the ONLY unguarded `hit.tr` (startIndex's is flat-only; rowNo / _hits / paint are
guarded). Suite 209/0, control wrong=0, 42/42. `deploy4.ps1` (stage7 / orig7), `readme_patch2c.py`.
**LIVE 14:55:32 (git 4ddccad + README 9ec1fc4, pushed)**; find 209/0 on LIVE; live Esc on "022301 -
Outreach and Engagement" = closed, no marks, no console error. php82_errors.log: one new line, the 14:49
client-error telemetry of that TypeError (my own test, before the fix), nothing after.

**Trap (live check):** a click by stale coordinates missed the Find box (the bar had flipped), and
typing "Healey" went to the PAGE: its `e` opened Email Report and "aley" landed in To (closed with
its x, nothing sent). Before typing into Find: focus `.pnb-find-input` from JS and confirm it.

Traps: a check named sane* must hold without Find (rename or split the ones that need it); a check over an
empty list is vacuous (require non-empty); the filterUi local `show` shadowed a function (renamed `showHit`).
`deploy2.ps1` = the round-2 swap (css, js, help; each live sha re-checked right before its MoveFileEx);
`readme_patch2.py` = the README rows (sections 3 and 5) for round 2.

# Round 3 (2026-10-19 afternoon) - the bar's place, theme-safe colours, the search's own highlight, speed

Asked by the user after using rounds 1-2 live: a consistent place for the bar (top right, like the
browser's), the text highlight borrowed for the FILTER search, whether the highlights hold up in every
theme and on hovered rows, the lockups on large reports (?id=dirsearch: 24,901 rows x 18 columns,
480,000 elements), a full bug sweep of Find mixed with the filter search (the box's x disappearing),
and a tooltip on find vs filter. Three agents helped: a theme audit (`themes\`), a review of the module
for hotspots and bugs, a map of the search's lifecycle in main.js.

**What changed.**
- **The bar:** the window's top right in every view; `place()` moves it only while the current match
  would be under it (just below the match's row, or above it when the window ends first). An (i)
  button explains find vs filter (the title on hover; a click shows the words under the box); the
  placeholder says "Find without filtering"; the bar is a FORM.
- **Colours:** opaque chips that set their own `color`. `::highlight(pnb-find / pnb-find-cur /
  pnb-filter)`; the tokens sit on BODY, because a theme's variables live on `body.theme-x` and a
  `var()` inside a custom property resolves where it is declared. In all 18 themes the worst cases
  are 4.84 / 4.87 / 5.66:1; the old current match read 1.1:1 in the dark themes. The outline is
  `currentColor` (at least 4:1); a stored-value hit is a dashed ring.
- **Speed:**
  - reads run in ~10 ms slices (`SLICE_MS`) behind a spinner and "Searching... N%";
  - a lazy cell's text is worked out once per Find session (`textCache`);
  - the Filter count runs in slices (`findHost.searchCountAsync`);
  - StaticRanges replace live Ranges;
  - labels update a text node's data (`setText`);
  - only `VIEW_CLASSES` changes count as a view change;
  - a change that arrives during a read marks it dirty instead of restarting it (`finish`);
  - an Enter pressed during a read is kept (`pendingStep`).
- **The search's own highlight (marks):**
  - `findHost.searchTerms(q)` reads the terms with `parseAdvancedQuery`;
  - the marks are painted on the rows on screen (around the viewport past 600 rows), repainted from
    `paged()` and from the grouped / pivot watcher (`watchMarks`), and taken off for a print;
  - they never touch a cell.
- **main.js (`patch3.py`):**
  - `_pnbHotkeyUiBusy` now asks by id and class (it was 4-5 s a call on dirsearch);
  - `findHost.runSearch` sets `has-text` and `previousSearchValue` and fires `change`;
  - new `searchCountAsync` and `searchTerms`;
  - new `_pnbSyncSearchBoxState()` at the end of `applyPagination`.
- **index.php (`patch3.py`):** the report search box is a FORM, with password-manager opt-outs. Edge's
  autofill took 0.2 s per focus on a field outside a form.
- **Help (`patch3.py`):** the bar's place, the (i) button, the spinner, and a paragraph on the marks.

**Measured (`prof\prof.py`, 25,000 rows, headless Edge).**

| Measure | Before | After |
|---|---|---|
| `busy()` | 2,053 ms | 26 ms |
| long tasks in the Find paths (open, type, retype, find inside a search) | 54 | 0 |

What remains is main.js's own work: a search's Enter (~0.5 s, behind its veil) and a page turn
(~0.2 s). A separate session took those up (the big-report performance pass).

**Bugs fixed (the review and the sweep).**
- The x: Find's Filter set the box's value silently.
- Deleting the term to empty left the table filtered (a stale `previousSearchValue`).
- Filter was offered for `empty` and for number ranges.
- The grouped Filter AND-merged text typed in the box but never run (`markGroupedQ` now comes from
  `penumbra:groupedSearched`).
- Reads restarted at every page turn or redraw.
- An Enter pressed during a read was dropped.
- A step on a stale match was lost.
- The overflow past the range cap was tinted as if found by its stored value.
- The focus was lost when the view went away.
- A group's name match opened its own group.
- Esc handed cell selection a cell inside a closed group.

**Tests.**
- **find:** 270 checks (48 scenarios), the control exact, 65 of 65 mutants.
- **Sweep:** `S.sweep` with `_verify`; 5 seeded walks x 70 steps, no violations. The same walk against
  the old main.js catches the x bug.
- **Regression:** searchbox 37/0 (its S1 check widened to accept the form), cellsel 217/0, lazyrows
  96/0, sortpage 18/0.
- **themes\run_themes.py:** the real stylesheet passes in every theme.

**Traps.**
- A Bash heredoc halves `\\` in Python paths: use `//server/` forward slashes.
- The searchbox suite lifts `#resultsHeader` raw, so the index.php note goes OUTSIDE it.
- Live main.js / index.php moved at 15:37 (be44c13): re-cut to `orig9` / `stage9` and prove the +/-
  change set identical before deploying.

## Round 3 deployed 2026-10-19 16:57:59-16:58:04 EDT (git 1376e06 + help cache c5b98cb + README 43ef175, pushed)

Live main.js / index.php had moved at 15:37 (be44c13), so this was re-cut to `orig9` (16:45) and
`patch3.py` re-applied to `stage9`. The +/- change set was proven identical to the tested one:
main.js 106 lines, index.php 13, help 6. On stage9: find 270/0, control exact, 65/65 mutants, the
sweeps clean, searchbox 37/0, cellsel 217/0, sortpage 18/0, lazyrows 96/0.
`deploy5.ps1 -From orig9 -Set stage9` swapped css, module, main.js, help, then index.php last.
After the swap: the help cache rebuilt (1,316 chunks, signatures match), find 270/0 against LIVE,
and php82_errors.log untouched.

**Live E2E** (the user's Chrome, real keys):
- **dirsearch** (24,901 rows, forest theme):
  - `busy()`: 36 ms, down from 4.3-5.1 s;
  - Ctrl+F: 328 ms blocked in all, down from 4.7 s;
  - the bar at the top right (8 px / 16 px), a FORM;
  - "smith": 1,157 matches in 1.45 s with the spinner shown; Filter to 948 rows;
  - the click on Filter left the box at "smith" with its x shown and 250 marks, all "smith";
  - Esc left the active cell on "Travis Smith", with the marks still shown;
  - Delete in the box cleared the search: 0 hidden rows, no marks, no x.
- **pipins** (List layout, hello-kitty theme): a typed search "Healey" marked name and email in the
  picked group; the x click cleared it.
- **hitratio** (pivot): "Townley" marks the PI label once the group is expanded.
- The only console error came from a browser extension.

What remains slow is main.js's own work: a search's Enter (~1.3 s at 24,901 rows), the clear
(~1.8 s), a PageDown page flip (~1.1 s) and the a11y layer's sweep. The linked session "Big-report
performance pass" (local_efec24e1) has those.
## Round 4 deployed 2026-10-20 00:23:10 EDT (git 16a2cb8 + README 5c70d8c, pushed)

The user: "It does a lot of resizing based on the results that come in and the numbering changes
in the text -- it should start out the max probable size to avoid the resizing".

Before (the `steady` scenario on `orig10`): open 426x36, reading 471x36, read 434x55, Filter
offered 559x55, no matches 426x36. After: 640x55 in every state with a filter on, 640x36 without.

What changed (module + css only, whole new copies; `orig10` = the 23:54 cut, `stage10` = the build):
- The count keeps 15.5ch (its longest words: Not a valid pattern, Searching... 99%, 99,999 of
  99,999) and Filter to N rows 17ch (Filter to 99,999 rows). In ch, so they follow the report's
  font; measured in Verdana (the app's default) by `steady`'s fit probes.
- The spinner and the Filter button keep their places while not shown (visibility, not display).
  A [hidden] Filter button keeps its box: `btnShown()` tests `.hidden` first.
- With a filter on in the flat or grouped view, the "N more in rows your filter hides" line's
  height is kept from the open: `.pnb-find-room` on the bar (roomUi: at open and after each read;
  sticky until close). `.pnb-find-hides` has min-height 1.3em (empty, the line had no height).
- close() empties the line: left as it was, the next open read it as shown and kept the room.
- The controls sit in `.pnb-find-row`; the bar is a block. As flex items of the bar, the lines
  under the controls counted toward its max-content width (+8 px whenever one showed).

Tests: `steady` (flat: every state's size, the fit probes, the room cleared at close, one size
without a filter) and `grp_steady` (the grouped view's search at open); `busy3` reads the spinner
by visibility (`drawn()`); 9 mutants (narrowcount, spinout, filtergone, narrowfilter, noroom,
roomcss, roomlate, roomflatonly, roomstuck); `shot_open` / `shot_kilo` pictures; CONTROL_OK gained
the three checks of round 3's main.js (live now, they hold with no module). On stage10: 279/0
(50 scenarios), control exact, 74/74 mutants; `deploy6.ps1` swapped css then module; after:
279/0 against LIVE. The README note went in through `readme_swap.ps1 -N 6 -Patch readme_patch4.py`
(cut, patch, guarded MoveFileEx).

**Live check** (the user's Chrome, real keys): the window was minimized (a 0x0 viewport, screenshots
timed out), so the report ran in a 1500x900 same-origin iframe in the tab, with a 10 ms size
sampler. dirsearch (24,901 rows, forest theme) with the filter "smith": Ctrl+F, "john" (1 of 33,
1,064 more in rows your filter hides, Filter to 20 rows), "zzqq", "/[/" (Not a valid pattern),
"smith" (Searching... with the spinner, 1 of 1,157): 5,123 samples, all 640x55. Esc cleared the
room; Delete in the filter box cleared the filter; Ctrl+F again ("john": Searching..., 109 of 1,097,
Filter): 265 samples, all 640x36. The only console errors came from a browser extension.

Found by the live check: "/[" is plain text (a pattern needs its closing slash), so `steady`'s bad
pattern step had been a second No matches; it types "/[/" now and asserts the words showed.
