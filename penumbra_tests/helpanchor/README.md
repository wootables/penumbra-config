# helpanchor - a Help Center deep link carries a section anchor (2026-10-16)

## What it guards

`index.php#help=<topic>` opened a topic at its TOP: the boot-time `_helpHash` block of `js/main.js`
parsed only the topic id and called `openHelpCenter(topic, '', ...)`, and the dashboard's help
panel (`js/penumbra_dashboard.js` openHelpPanel().render()) rewired its cross-topic links to
`index.php#help=<topic>` and dropped their `data-jump-to`, as did the search builder's "?" icon
(window.open) and the panel's "Full Help Center" link. So "tile| and embed|" in the Dashboards
topic (`optionsHelpLightbox` / `action`) landed on the top of Custom Code, and "Access List"
(`accessListHelpLightbox` / `acl-entries`, an id that is only a `data-extra` of the Security
topic since Help Center v2) landed on the general topic with the search box focused.

The change, two files (patch scripts here, byte-safe, CRLF kept, each hunk anchored on text that
must occur exactly once; `--check` only reports; a second run says "already present"):

| file | script | what |
| --- | --- | --- |
| `js/main.js` | `patch_helphash.php` | the hash is `#help=<topicId>[:<anchorId>]`. Both ids strict (`[A-Za-z0-9_-]+`); the anchor goes to openHelpCenter() as the jump anchor, so activateHelpTopic's owner re-resolution (2026-10-14) scrolls to it, even when the id before the colon is stale. The topic id resolves through `_helpTocItemFor` (data-topic OR a folded data-extra id, both server-rendered at boot). A malformed percent-escape no longer throws URIError out of the ready handler. The search box is focused only for a stray id WITHOUT an anchor. |
| `js/penumbra_dashboard.js` | `patch_dashanchor.php` | `helpHubHref(topic, jumpTo)` builds the link (the anchor as strict as a topic id, else left off); used by render()'s hub links (their data-jump-to), the builder's "?" (window.open) and the panel's "Full Help Center" link (the panel's own anchor; the failure note's "Open the Help Center" link shares it). |

Backwards-compatible: `#help=<topic>` and `#help` behave as before; a colon never passes the
strict id regex, so a NEW link against an OLD main.js opens the general topic (deploy main.js
first, or both at once).

## Files

| file | role |
| --- | --- |
| `patch_helphash.php`, `patch_dashanchor.php` | the change itself (`php -n patch_x.php --file <copy> [--check]`); re-run `patch_helphash.php` on the CURRENT live main.js right before a deploy, other sessions stage that file too |
| `lift_helphash.php` | lifts `_helpTocItemFor` and the `_helpHash` block out of a main.js (CRLF -> LF), the block wrapped as `runHelpHash()` |
| `helphash_harness.html` | a server-rendered TOC fixture (a plain topic, host topics with folded ids in data-extra), a recording openHelpCenter() stub; sets location.hash per case and runs the lifted block (setTimeout stubbed to run at once) |
| `helphash_harness.ps1` | one run: lift, lay out, headless Edge `--dump-dom`, print H0..H14, RESULT. `-MustFail H2,H3` names the cases that must fail for that file |
| `lift_dashanchor.php` | lifts the help panel block (as penumbra_tests\dashhelplinks does) plus the builder's `#searchBuilderLightbox .tab-help-icon` handler |
| `dashanchor_harness.html` | the two local topics with the Dashboards topic's real link markup plus a hub link without data-jump-to and one with a bad anchor; a search builder with two "?" icons; window.open recorded; native clicks read defaultPrevented off the event (the builder's handler stops propagation, so a window listener would not see it) |
| `dashanchor_harness.ps1` | one run: lift, lay out, Edge, print D0..D8, RESULT; `-MustFail` as above |
| `run.ps1` | five runs (below) -> SUITE: GREEN/RED. Makes the main.js mutant itself from the stage |
| `jquery-3.7.1.min.js` | the app's own jQuery version |

## Assertions

The hash harness (H0..H14), per run: stage = the patched main.js, orig = the pre-change copy, mutant =
the stage with the parsed anchor NOT handed to openHelpCenter (the parse itself intact).

| id | hash | expected call (topic, anchor, focusSearch) | stage | orig | mutant |
| --- | --- | --- | --- | --- | --- |
| H0 | - | the lifted block and `_helpTocItemFor` loaded | PASS | PASS | PASS |
| H1 | `#help=optionsHelpLightbox` | optionsHelpLightbox, '', false (as before) | PASS | PASS | PASS |
| H2 | `#help=optionsHelpLightbox:action` | optionsHelpLightbox, action, false | PASS | **FAIL** | **FAIL** |
| H3 | `#help=accessListHelpLightbox:acl-entries` | accessListHelpLightbox (a data-extra id), acl-entries, false | PASS | **FAIL** | **FAIL** |
| H4 | `#help=accessListHelpLightbox` | accessListHelpLightbox, '', false (activateHelpTopic lands on the fragment) | PASS | **FAIL** | PASS |
| H5 | `#help=noSuchTopic` | whatIsPenumbraLightbox, '', true | PASS | PASS | PASS |
| H6 | `#help=noSuchTopic:acl-entries` | whatIsPenumbraLightbox, acl-entries, false (the owner re-resolution rescues it) | PASS | **FAIL** | **FAIL** |
| H7 | `#help=optionsHelpLightbox:a.b` | optionsHelpLightbox, '', false (bad anchor dropped) | PASS | **FAIL** | PASS |
| H8 | `#help` | whatIsPenumbraLightbox, '', true | PASS | PASS | PASS |
| H9 | `#help=%E0` | whatIsPenumbraLightbox, '', true, no throw | PASS | **FAIL** (URIError) | PASS |
| H10 | `#help=optionsHelpLightbox%3Aaction` | optionsHelpLightbox, action, false | PASS | **FAIL** | **FAIL** |
| H11 | `#help=optionsHelpLightbox:` | optionsHelpLightbox, '', false | PASS | **FAIL** | PASS |
| H12 | `#help=:acl-entries` | whatIsPenumbraLightbox, acl-entries, false | PASS | **FAIL** | **FAIL** |
| H13 | `#other` | no call | PASS | PASS | PASS |
| H14 | `#help=options<b>HelpLightbox` | whatIsPenumbraLightbox, '', true (the id stays strict) | PASS | PASS | PASS |

The dashboard harness (D0..D8): stage = the patched penumbra_dashboard.js, orig = the pre-change copy.

| id | what | stage | orig |
| --- | --- | --- | --- |
| D0 | the whole file parses | PASS | PASS |
| D1 | render(): `index.php#help=optionsHelpLightbox:action` and `...accessListHelpLightbox:acl-entries`, target _blank, rel noopener | PASS | **FAIL** |
| D2 | a hub link without data-jump-to: `index.php#help=userSettingsHelpLightbox`, no colon | PASS | PASS |
| D3 | a hub link with `data-jump-to="a.b"`: the anchor is left off | PASS | PASS |
| D4 | the Search link is still the panel's (`data-dash-help`, no target, `href="#"`) | PASS | PASS |
| D5 | "Full Help Center": `...searchHelpLightbox:search-syntax` when the panel opened at that anchor, plain for `openHelpPanel()` and for a bad anchor | PASS | **FAIL** |
| D6 | the failure note's "Open the Help Center" link: `...dashboardsHelpLightbox:dsh-far` | PASS | **FAIL** |
| D7 | the builder's "?" aimed at a hub topic: window.open(`index.php#help=optionsHelpLightbox:action`, _blank, noopener), no panel, click prevented | PASS | **FAIL** |
| D8 | the builder's "?" aimed at a local topic: the panel on Search at `#search-syntax`, nothing opened | PASS | PASS |

## Run

From PowerShell (the execution policy refuses `.ps1` files on the share; invoke the text, as a child
powershell for a long run):

    & ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpanchor\run.ps1'))) -MainJs <stage>\js\main.js -DashJs <stage>\js\penumbra_dashboard.js [-OrigMainJs <f>] [-OrigDashJs <f>] [-Out <dir>]

`-OrigMainJs` / `-OrigDashJs` default to the LIVE files (right before the deploy). After the deploy run
it with the live files as `-MainJs` / `-DashJs` and `git show <rev before>:js/main.js` /
`git show <rev before>:js/penumbra_dashboard.js` copies as the origs. Expected: five `RESULT: GREEN`
lines (a must-fail case prints "fails as it must") and `SUITE: GREEN`.

Also run against a stage (they share the files): `helpv2\jump_harness.ps1 -MainJs <stage main.js>`
(T1..T6, the 2026-10-14 cross-topic navigation), `dashhelplinks` (`-Patched <stage dash> -Unpatched
<pre-fix copy>`; its T1a accepts the anchor form), `tiles` (`$env:PNB_DASH_SRC`, `$env:PNB_MAIN_SRC`),
`singlekeytips` (`-MainJs`, `-DashJs`), `noadm5` and `reporttags` (`-App <app-shaped dir>`),
`dashsearch` (`-Stage <flat dir>`).

## Traps

- Headless Edge sometimes dumps the DOM and never exits: both engines wait 90 s and then stop the
  processes of THEIR profile only (from penumbra_tests\dashhelplinks).
- PowerShell variable names are case-insensitive: a loop variable `$mustFail` silently overwrote the
  `[string]$MustFail` parameter (`$false` -> the string "False", which is truthy) and every case read as
  UNEXPECTED PASS. The loop variable is `$expectFail`.
- A click handler that calls stopPropagation() never reaches a window-level listener: the dashboard
  harness reads `defaultPrevented` off the dispatched event object instead.
