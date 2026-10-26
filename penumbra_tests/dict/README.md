# dict - the data dictionary, 2026-10-22

What it tests: `js/penumbra_dict.js` + `css/penumbra_dict.css` (the module), main.js's `dict|` infobox
mode in BOTH engines (A = Custom Code, B = the subtitle), the dialog branch in `showInfoboxDialog`, the
`window.Penumbra` bridge (`snippetText`, `openDataDictionary`, `dict*`), Column options' `cfg.about`
(main.js) and its link (`penumbra_colfmt.js`), the header menu's `about` item (`penumbra_colmenu.js`),
the palette rows `dictionary` / `gendict` (static), the Custom Code sidebar's Generate button
(`penumbra_snippet_help.js`), `generate_dictionary.php`'s helpers, `dictseeds/`, index.php's tags behind
`js/penumbra_dict.off`, the help (`optionsHelpLightbox` `#dict-mode`) and `ai_system_prompt.php`.

    $env:PYTHONIOENCODING='utf-8'
    py -3 \\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dict\run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]

Headless Edge over CDP on the colmenu harness (the REAL main.js, saveconf fixture: shown V_ID V_NAME
V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*); `mk_harness.py` adds the module before main.js and puts a
dict| block in the stored report's Custom Code (an apostrophe and an unbalanced paren in it on purpose).
Generate's POST is answered by a fake XMLHttpRequest in the driver (no AI call, no network).

Scenarios: `dunit` the module's pure functions; `dlink` engine A's link and the dialog (note, rows, tags,
source, escaping, filter, the editor-only lines); `dmenu` / `dopts` the two ways in, only for a column
with an entry; `dview` a viewer; `dblank` a blank label; `dsub` a block in the subtitle only (engine B);
`dnone` no block (guards); `dgen` Generate end to end through its UI (sidebar button, request, merge,
Insert, re-open, the encrypted gate, Esc); `dgenerr` a refusal in the footer gap.

PHP: `gen_tests.php` (the endpoint's helpers, lifted with PNB_DICT_LIB_ONLY - the file returns before
db_connection.php); `email_tests.php` (engine C, schedule_runner.php UNCHANGED: a scheduled email of a
snippet holding a block keeps the text around it and drops the block; lifted via parity\extract_engine_c.php
into the run's temp dir, never the auditfixes mirror) - a GUARD, green on live too, with a positive control.

`--control` = live without the module: every NEW check red, the guards green. 22 mutants (`--mutants`).

Found by the suite (2026-10-22): main.js's `penumbraSnippetQuoteState` ignored backticks, so an apostrophe
or a paren INSIDE backtick text in a call silently stopped the whole snippet rendering (pre-existing; it
would have hit every dictionary). Fixed in the scan: backtick spans are masked first, as the engines do.

(2026-10-24, dictstat41) `dstats`: Column stats starts with the column's meaning where the dictionary names it (the
user: "could be in the stats submenu even"). One item under a "What it means" heading: the text escaped, cut past 280
characters at a word, an AI draft / Do not use tag, the source, the whole of it in its aria-label; a click or Enter
(ArrowRight on Column stats lands ON it) opens the dialog at the ENTRY's name, as the header's What this column means
now does. Stand-in entries (D().entryFor swapped for V_AMOUNT) give the long, avoid/blank and found-by-label cases;
a spy on window.Penumbra.openDataDictionary reads the name the dialog is opened at. `S-helpStats`: the help names it,
and the touched bullet and cell stay within L16. 10 x- mutants; j-nomenu / j-menuany follow `dictEntry`. The
comparison menu's What this column means is cmpmenu's C34.

## Later rounds (all live)

- 2026-10-22 b `4d15f3b` the pivot's part (`[pivot]` / `[columns]`): scenario `pdict`, `pv*` unit checks.
- 2026-10-22 `af4e9c2` long meanings wrap (`L-dlink-wraps`).
- 2026-10-22 c `04f7faf` the eager core / lazy UI split (`dlazy`) and the editor (`dedit`; Generate's grid in `dgen`).
- 2026-10-24 `ca5b46f` the final bug sweep from an independent review (`desc`, `dgen2`, `labelScan`, `noNesting`,
  `deadBlocks`, `multiReplace`, `commentsKept`, `litEscapes`, `commentStripped`; `email_tests.php` now also holds the
  schedule_runner.php comment strippers to backtick text). Traps: main.js's global Escape is a CAPTURE listener on
  document that clicks a dialog's first `.modal-btn-primary` - a dialog's own Escape guard must capture on WINDOW and
  must never leave Apply as that button's job; the lazy half runs in promises (the driver records unhandled rejections).
