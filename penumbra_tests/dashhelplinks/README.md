# dashhelplinks - the dashboard help panel's cross-topic links (2026-10-16)

## What it guards

`js/penumbra_dashboard.js` openHelpPanel() shows one Help Center topic inside the dashboard page
(LOCAL_HELP: Dashboards, Search). Its render() rewires every cross-topic link of the loaded topic:
a target the panel holds becomes a `data-dash-help` link (re-opens the panel there), any other becomes
`href="index.php#help=<topic>" target="_blank"` (the whole Help Center on the report page).

The bug: the delegated handler `$(document).on('click', '#dashHelpOverlay a[data-jump-to]', ...)`
fired first for every link that also carries `data-jump-to`, called preventDefault() and jumped to an
anchor that is not in the panel, so a hub link such as the Dashboards topic's "tile| and embed|"
(`data-target="optionsHelpLightbox" data-jump-to="action"`) or "Access List"
(`accessListHelpLightbox` / `acl-entries`) never opened anything. It predates Help Center v2.

The fix: the selector is `'#dashHelpOverlay a[data-jump-to]:not([target])'` - a link render()
handed to the browser (target="_blank") is skipped; in-panel jumps and the local-topic links are unchanged.

## Files

| file | role |
| --- | --- |
| `dashhelp_harness.html` | the page: a fixture of the two local topics with the Dashboards topic's real link markup, the lifted panel code, native clicks, a window listener that reads what the handlers left for the browser |
| `lift_dashhelp.php` | lifts `var LOCAL_HELP = {` .. the `[data-dash-help]` handler out of a penumbra_dashboard.js (CRLF -> LF); prints whether the fix is present |
| `dashhelp_harness.ps1` | one run: lift, lay out, headless Edge `--dump-dom`, print T0..T5 and RESULT |
| `run.ps1` | control (patched file, all PASS) + mutant (unpatched file, T2 FAILS, the rest PASS) -> SUITE: GREEN/RED |
| `jquery-3.7.1.min.js` | the dashboard's own jQuery version |

## Assertions

| id | what | control | mutant (unpatched) |
| --- | --- | --- | --- |
| T0 | the whole penumbra_dashboard.js parses (loaded without `penumbra_dash_vars`, its IIFE returns at once) | PASS | PASS |
| T1a | render() rewired the two hub links: `index.php#help=<topic>` (or `<topic>:<anchor>` once the links carry their section, 2026-10-16: `penumbra_tests\helpanchor` guards that), `target="_blank"`, `rel="noopener"` | PASS | PASS |
| T1b | render() rewired the Search link: `data-dash-help="searchHelpLightbox"`, no target, `href="#"` | PASS | PASS |
| T2 | a native click on each hub link reaches the window with `defaultPrevented === false`; the panel is untouched | PASS | **FAIL** |
| T3 | an in-panel jump is prevented and the panel body scrolled to its heading | PASS | PASS |
| T4 | the Search link is prevented, re-opens the panel on Search at `#search-syntax`, one overlay only | PASS | PASS |
| T5 | a link no handler claims (Full Help Center) reads as not prevented - the window listener is sound | PASS | PASS |

## Run

From PowerShell (the execution policy refuses `.ps1` files on the share; invoke the text):

    & ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashhelplinks\run.ps1'))) -Patched <stage>\js\penumbra_dashboard.js -Unpatched <orig>\js\penumbra_dashboard.js -Out <scratch dir>

Deployed 2026-10-16 10:43 as commit 8d8fa03, so the mutant is the pre-fix version:
`git show 618a0e5:js/penumbra_dashboard.js > <file>` (GIT_DIR //oitras.oit.ncsu.edu/d$/Utilities/penumbra_git).
Expected: both runs print `RESULT: GREEN` (the mutant run counts T2's FAIL as expected) and the wrapper
`SUITE: GREEN`. Headless Edge occasionally writes its DOM dump and never exits: the engine waits 90 s, then
stops the msedge processes of its own profile folder only, and reads the dump that is already on disk.

Also run against a stage (they share the file): `tiles` (`$env:PNB_DASH_SRC`), `singlekeytips` (`-DashJs`),
`noadm5` and `reporttags` (`-App <app-shaped dir>`), `dashsearch` (`-Stage <flat dir>`).
