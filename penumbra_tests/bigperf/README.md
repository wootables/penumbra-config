# bigperf (2026-10-19): main-thread blocking on large report pages, outside Find

Report used: `?id=dirsearch`, 24,901 rows x 18 columns, 480,469 elements.

**Status: DEPLOYED 2026-10-19 19:02:57-58 EDT (user: "Deploy the bigperf set") = git 3a9ac0b, pushed.** From
orig4 / stage4 (live 18:16 + this patch; recut change set identical; suite 67/0 at 19:02; guards OK). After: committed
blobs == stage4; php82_errors.log untouched; `suite\run.py --stage <live> --scn <all six>` 52/0 GREEN at 19:04.
**Live after** (work-laptop Chrome, the real dirsearch, the same read-only measurements as before, ~19:06):

| item | live before (~17:00) | live after (~19:06) |
|---|---|---|
| a11y sweep after any DOM change | ~200 ms each | none |
| page turn | 274-367 ms + ~60 ms + ~200 ms follow-ups | 218-283 ms (320 / 404 right after load), no follow-ups |
| first Down arrow | 429 ms | 39 ms, no long task |
| typing "kilo" | a 183 ms sweep | no long tasks |
| search Enter "engineering" | 1,301 ms + ~490 ms follow-ups | 881 ms, no follow-ups |
| clear the search | 644 ms + ~610 ms follow-ups | 472 ms + one 51 ms |

Rollback (per path, the same deploy script): `git show 3a9ac0b^:<path>` into a stage folder.

## What was slow, and why

| # | Item | Root cause found |
|---|------|------------------|
| 3 | a11y layer sweeps | `penumbra_a11y.js`'s body observer ran FIVE whole-document `querySelectorAll` walks 400 ms after ANY node came or went (a page turn, a search, the autocomplete's list, a tooltip). main.js `syncKbd` had a second observer doing four more. |
| 4 | first arrow key | `penumbra_cellsel.js` `buildGrid` placed every cell of every row (25,000 x 21 = 525,000 Map entries) on the first key after any change. |
| 5 | typing | the two sweeps above, every ~400 ms while typing (the autocomplete's live region and list are DOM writes), plus... |
| all | **every DOM write** | one CSS rule: `html:has(#chartCarouselOverlay.cc-persistent)` in main.css. With it, any change anywhere (a row shown, a cell written, a class on body) makes the next style recalc walk the WHOLE document looking for the overlay: 15-23 ms per change at 550,000 elements, against 2-3 ms without it (`bprof.py --hasbisect` took the 45 `:has()` rules out one at a time; only this one mattered). |
| 1 | search Enter | `evaluateParsedQuery` re-derived the search side of a condition (quote strip, `{COLUMN}` test, number shape, range list, accounting form) and the column key for every cell of every row: 500,000 times per search. |
| 2 | page turn | the rows walked four times (`applyPagination`, the count, the lazy fill, zebra), zebra rewriting both classes on every shown row (restyling its cells), and the sweeps. What is left is mostly the layout of the new page (inherent) and its cells' content. |

## The changes (4 files)

- `css/main.css` (patch_bp.py): `html:has(> body > #chartCarouselOverlay.cc-persistent)`: same meaning (main.js always
  appends the overlay to body), the test looks two levels down.
- `js/penumbra_a11y.js` (whole copy, ES5 kept): the observer sweeps only the ADDED nodes (the node itself and under
  it); nodes added while paused (the build, a lazy fill, a theme switch) wait for the resume nudge; past 5,000 roots
  one whole-document sweep; jQuery UI live regions and tooltips skipped. `PenumbraA11y.sweep()` is still whole-document.
- `js/penumbra_cellsel.js` (whole copy): a row that is not drawn keeps only its place in the grid when nothing in its
  section spans (the flat table never does); a span reaching such a row places it in full after all.
- `js/main.js` (patch_bp.py, anchors x1, re-applies to any live copy): syncKbd's observer = added nodes only (same
  rules); `applyZebraStriping` writes only a stripe that changes; `evaluateParsedQuery` works the search side out
  once per distinct value (dates still per call) and skips the cell's number-shape tests that cannot matter;
  `applyPagination` hands its row lists to the count and the lazy fill.

## Timings

**Live, before** (work-laptop Chrome 155, the real dirsearch, read-only observers, 2026-10-19 ~17:00):
one a11y sweep 198-220 ms; page turn 270-370 ms task + ~60 ms + ~200 ms (sweep) follow-ups; first Down arrow 429 ms;
typing "kilo" a 183 ms sweep; search Enter ("engineering") 1,301 ms + ~490 ms follow-ups; clear 644 ms + ~610 ms.
The laptop runs about 1.7-2.5x the harness below, so expect roughly the same ratios there after the deploy.

**Harness, before -> after** (`prof\bprof.py`, headless Edge, 25,000 rows x 18 columns, 550,883 elements, median of 3,
no profiler attached; longest task / sum with follow-ups, ms; base = live incl. Find round 3 and Column stats 17:42):

| action | live | stage |
|---|---|---|
| a11y sweep after one node added / removed | 90 / 74 | 0 / 0 |
| page turn (next, next, first) | 164, 159 (243), 134 (211) | 142, 127, 116 |
| first Down arrow (cell selection) | 101 | no long task |
| typing "kilo" / "v_status = o" | 76 / 75 (208) | 0 / 0 |
| search Enter "kilo" | 500 (643) | 285 |
| second search "alpha" | 449 (523) | 246 |
| clear the search | 236 (309) | 164 |
| one forced style recalc after one row shown | 18.1 | 2.3-4.3 |

**Newest stage: stage4 = live 18:16 (Rows card 730087f) + this patch** (recut.py: change set identical; suite 67/0;
`deploy_bp.ps1 -From orig4 -Set stage4 -DryRun` GUARDS OK at 18:18).

## Tests (on stage3 = live 17:42 + this patch; the suite again on stage4)

- `suite\run.py` (new): 67/0 GREEN (14 static I-* + 6 scenarios); `--control` (the live files) wrong=0: the 8
  targeted checks fail there with the evidence (one added node = a whole-document sweep in each layer; 63,001 vs 4,201
  Map writes on the first arrow key; 400 vs 0 zebra class writes; 3 vs 1 row walks; 18.1 vs 2.3 ms recalc) and every
  other check passes; `--mutants` 21/21 killed. `bp_epq` compares the rows ~90 conditions keep (text, quoted, empty,
  //exact//, /regex/, !/, numbers, ranges, lists, accounting, dates incl. TODAY-365, {COLUMN} placeholders, nested
  __ROW, entities, #) with the LIVE build's: identical.
- Regression on the stage: a11y 65/65 (+ its mutant killed), cellsel 217/0, find 270/0 (round 3 module), lazyrows 96/0,
  sortpage 18/0, copyhtml 60/0, grplist 324/0, searchbox 37/0, cmpfoot 25/0, jsongroup 51/0. hiddencols 46/10: the SAME
  10 D-* fail with the live main.js on both sides (pre-existing since today: row 201's V_ID filled in one load and not
  the other), not this change.

## Deploy (after the user's go-ahead)

1. `py -3 recut.py N` (cd $env:TEMP first) if live moved since stage3 (`deploy_bp.ps1 -DryRun` says so): it cuts live
   into origN, re-applies patch_bp.py, copies the two whole modules only if their live sources did not move, and
   proves the change set identical.
2. `py -3 suite\run.py` on it (newest stageN is the default): GREEN, `I-cut-is-live-*` included.
3. `& ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\deploy_bp.ps1'))) -From origN -Set stageN -DryRun`, then without -DryRun.
4. Commit only these paths and push (message: commit_msg.txt, UTF-8 without BOM):
   `git add -- js/main.js css/main.css js/penumbra_a11y.js js/penumbra_cellsel.js && git commit --only -F <abs path>\commit_msg.txt -- js/main.js css/main.css js/penumbra_a11y.js js/penumbra_cellsel.js && git push`
5. After: tail php82_errors.log; `py -3 suite\run.py --stage <live app> --orig stageN` (GREEN = live is the stage);
   in the user's Chrome `PenumbraA11y.version === '2026-10-19'` and the long tasks of a page turn / typing.

Rollback: per path `git show <rev>^:<path>` into a stage folder and the same deploy script (never git checkout on live).

## Not done (follow-ups)

- A page turn still forces the new page's layout (~45 ms here, inherent with table-layout auto) and fills its cells.
- `updatePdfOptionState` still asks jQuery `:visible` and walks the document for the download radios (~15 ms a turn).
- The search's DOM pass (25,000 rows: class + display writes) and `updateTotalRow` (~30 ms).
- `applyZebraStriping` still reads every row's display (~13 ms); `applyPagination` could hand it the page's rows.

## Kit

`prof\bprof.py` (profiles, `--trace`, `--inval`, `--tree`, `--bench`, `--hasbisect`), `harness.html` (find kit's +
a11y + search_builder, `bp_*` scenarios), `driver.js` (a frozen copy of the find kit's driver: bprof.py runs only its
boot-only `prof` scenario; its Find checks still pin "your search hides", which the 20:16 filter-wording deploy changed
to "your filter hides" - test Find with the find kit, not this copy), `patch_bp.py`, `recut.py`, `deploy_bp.ps1`, `suite\` (run.py, suite_def.py,
driver.js), `orig*/stage*` (orig/stage 16:45 cut; orig2/stage2 after round 3; orig3/stage3 after Column stats 17:42),
`regress3\` (the stage + live copies the other suites read).
