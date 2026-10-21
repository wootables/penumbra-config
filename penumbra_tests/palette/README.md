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
