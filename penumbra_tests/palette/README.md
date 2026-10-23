# palette - the command palette (Ctrl+K), 2026-10-20

What it tests: `js/penumbra_palette_boot.js` (the always-loaded stub), `js/penumbra_palette.js` +
`css/penumbra_palette.css` (the module), index.php's stub tag behind `js/penumbra_palette.off`,
main.js's "?" sheet Ctrl+K row and its Clear all custom preferences hook, `penumbra_colmenu.js`
`colMenu.items(th, cell)`, the help topic `commandPaletteHelpLightbox` + tip `us-tip-palette`.

    $env:PYTHONIOENCODING='utf-8'
    py -3 \\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\palette\run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]

Headless Edge over CDP (one headless-Edge suite at a time), on the colmenu harness (the REAL
main.js, the saveconf fixture: shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*)
plus the stub tag, `#saveQuery` / `#toggleAiPanel` and a five-topic Help Center TOC; the driver
stubs `window.openHelpCenter` (the Ask page's form appears as its lazy load would make it) and
puts the page in the flat view (the harness boots with the fixture's pivot container shown and
the flat table hidden under `body.penumbra-fs-autoload-pending`; the colmenu suite never minds).

Scenarios: `pcold` the first Ctrl+K on a page that never prefetched (requestIdleCallback is a
no-op there): the box at once, keys typed meanwhile kept, the hand-over; `pfail` the module file
missing: a plain line, Esc closes, nothing hangs; `pmain` the "?" sheet row, the empty state,
fuzzy ranking + marks, greyed-with-a-reason vs hidden, the sections (columns, reports from
localStorage pnb_recent_reports, help), a question -> Ask first + submitted, the focus trap (Tab,
Shift+Tab, a focus elsewhere), the arrows skipping greyed rows, Esc restoring the focus, recents
stored / shown / cleared by #spClearStorage, the header-menu coverage (every act has an entry or a
recorded exemption) and the registry (every entry's control or function exists, or the harness
lacks the control); `ppick` "Which column?" (table order, the freeze on the first five only, a
frozen column marked, Unfreeze under Or), freeze / unfreeze / sort / hide run for real, a column's
own list (Show all columns runs), Backspace back, a theme through the Settings panel's select;
`pview` the authoring gate (a viewer: no Save / Version history / admin controls; "save" in full =
greyed with the reason; an editor sees them); `prow` row-level items only while a cell is
selected, Filter to "value" runs.

Static: `S-indexLoads`, `S-sheetRow`, `S-clearHook`, `S-menuItems`, `S-help` (topic, manifest x2,
tip defined and consumed), `S-registry` (every id / function the registry names exists in
index.php / main.js / the modules), `S-stubSmall`, `S-noEmdash`.

`--control` = live without the palette (EMPTY stub / module / css): every NEW check red, the
guards (what live gets right because the palette is absent) green. Mutants in run.py: b-noavail
(availability never read), b-tabout (Tab leaves the box), b-hang (a failed load hangs), b-nogate
(the authoring gate removed), b-nofreeze (the picker offers what the menu refuses), b-norecent,
b-nobuffer (keys typed before the module arrive are dropped), b-escfocus, b-noquestion, b-askdrop,
b-norow, j-noitems (the menu exports nothing), m-nosheet, m-noclear.

Kit: `stage_20261020\` (patch_palette.py re-applies the shared-file hunks to fresh live copies and
copies the new files from new\; deploy_palette.ps1 -DryRun; orig2.sha256 = the live files the
deploy was cut from; commit_msg.txt). Rollback: an empty `js\penumbra_palette.off`, or
`git show <rev>:<path>` per changed file by the same swap.

Round 4 (2026-10-20): 4a the icons RENDER as the toolbar's (L-pmain-iconsRendered in three themes + pshot: a screenshot crop's ink via PIL; mutant i-nostyle); 4b the combinations (scenario pcombo; the harness loads penumbra_presets.js and gives the Group dialog its preset chip slot; mutants c-applies, c-nopre, c-pivotcol, c-rows, c-preset, c-nocap). deploy_set.ps1 -From <dir> deploys a tested module/stylesheet set; deploy_r4b.ps1 cuts README at run time.

2026-10-21 (the searchrank follow-up): `psrank` - the Reports section keeps the server's relevance order. The driver
points the box's quicksearch call at `quicksearch_epa.json` (run.py QS_EPA_FIXTURE = live's answer for "EPA"):
serverOrder, idOverMidword (fi-epa / fi-epa-c over the mid-word "Department" titles), mergeOrder (a recent row the
server listed takes its place and is ranked from the server's copy; one it did not list, by tier), viewerTiers (no
server list), accentWord (no word start right after an accented letter, as Oracle's [:alnum:]), tagLocalFirst
(tag:NAME as before; a guard). Mutants q-scoreonly (live's sort), q-noplace, q-notier, q-wordstart, q-tagtier,
q-localtier, q-asciiword.

2026-10-22 (jarvispal, "Ask Jarvis from the palette"): the two ask rows together. When Ask Jarvis takes the Top match slot
(a question or code-like text from the console's audience on a report they may edit, the panel on the page), the free
Ask help row sits right under it instead of at the bottom; the Jarvis sub-line names the paid assistant (help, SQL,
custom code and data), the Ask help sub-line says it answers from the help text only; a viewer or a page without the
panel keeps Ask help first. pjar + askSecond, askSecondCode, subPaid, subHelpOnly, viewerAskFirst (a guard: live already
puts a viewer's Ask help first), noPanelAskFirst (a guard; the toggle's id renamed and penumbraAi cleared for one open);
static S-askRows (the module's lines, the header comment, the topic's writers' rule and no-panel rule). Mutants j-asklast
(Ask help left at the bottom), j-subpaid, j-subhelp (the old sub-lines back), t-askpara (the topic's no-panel sentence dropped:
S-askRows alone, static only); j-viewer's must list gained viewerAskFirst.
The help topic's Ask Jarvis cell is 68 words (L16's cell budget is 70; the first cut was 73 and red). Kit:
patch_jarvis.py (the app edits, re-appliable to a fresh copy of live), patch_suite.py (these suite edits),
deploy_jarvispal.ps1 (hash-guarded, MoveFileEx, then prebuild_caches.php) in the session's scratchpad `jarvis\`, copied with
the stage, orig, logs and DEPLOY.md to `stage_20261020\jarvispal\`. Stage: 520/520, control on live ddc0476 exactly the five new
checks red, 11 targeted mutants kill as declared; helpv2 on a full stage tree with -Mutants GREEN (28/28).

2026-10-22 (colmenu round 33, the palette half: the header menu's Column widths list and Fit to page went live in ebaabab while the
palette still knew the old menu): `pwidth`. This harness lifts `#results-wrapper` apart from the flat table and hides the table, and
the width module fits a flat table only inside it, so pmain's coverage never sees a width act; the scenario puts the table back in
its wrapper first. noDeadColRows (every column row's act is offered on some column: live's "Reset this column..." still pointed at
the dropped `reset`), widthCoverage (every act, fit / fitAll / fitPage / resetWidth included, an entry or an exemption), fitPageRow +
fitPageRuns (Fit columns to the page: a share for every shown column, no sideways scroll, the module's toast), resetWidthPick +
resetWidthRuns (Reset this column's width...: `#` greyed with the menu's reason, then one column's share gone). ppick colItems wants
"Clear all personal customizations..." where it wanted the Reset list's "This column"; psweep colReset runs the width reset or shows
the menu's reason (this scenario's widths are not fit-able). Static S-widthRows. Mutants w-nofitpage, w-fitall, w-deadreset,
w-noexempt. NEW = jarvispal's set | NEW_W33 while both rounds are undeployed (drop NEW_W33 once the palette half is live). Kit: the
session scratchpad's pal33/ (patch_pal33.py, orig/ + orig.sha256, deploy_pal33.ps1), copied to stage_20261020/pal33/.
