# Filter wording (2026-10-19): the report page's "search box" is the "filter box"

User-facing words only. Three words, one meaning each:

| Word | Means |
|------|-------|
| **FILTER** | the box above the table: keeps only the rows that match; totals, snippets, charts, calculations, exports and email follow |
| **FIND** | Ctrl+F: highlights matches, hides nothing |
| **SEARCH** | finding something to go to: the Help Center, "Search fields...", the repository, the home screen's report list, people |

SCOPE (the user, 10-19, relayed by the parent session): the scheduler's and the dashboard's own
filter boxes "may not follow the same wording and dont need correcting", "though maybe use 'Apply
Filter:' instead of search filter in scheduler". So: the scheduler field is labelled **Apply
Filter:** (help: "Apply Filter (scheduler)", the field named that way everywhere), its own run /
clear titles keep "(Enter) Run search" / "Clear search"; the dashboard keeps its box's words
("report search syntax", Search help, the default-filter hint, the tile's Search filter field).
Both name the builder by its new name (one shared dialog).

KEPT (API, saved or linked): `data(search)`, `action(search, ...)`, `search|` / `filter|` / `unfilter|`,
`&search=` / `?search=` / `dsearch`, `data-search`, saved-state field names, ids and classes
(`#tableSearch`, `.search-wrapper`, `#viewOptionSearch`, `hideSearch`), help anchor ids
(`search-syntax`, `search-builder`, `schedFilter-top`, ...), the preset type key `search`, ARIA
`role="search"`. Real searches keep "search". The developer reference (help/snippets.php ->
optionsHelpLightbox.php) keeps its API word and adds "(the filter box)" at five places.

## Status

**DEPLOYED 2026-10-19 20:16:44-20:16:55** (the user: "Deploy the filter wording: re-cut from live, ...").
Re-cut orig3 at 20:00 (after 3a9ac0b), patch.py -> stage3, the same word-level change set (43/43),
the static proofs and 11 suites + the searchbox copy green on stage3, then `deploy.ps1 -From orig3
-Set stage3`: git **b25ef2d** (43 paths) + help cache **17a6d12** (1316 chunks, VER 7, signature
match), both pushed. suites\searchbox\run.py copied over penumbra_tests\searchbox\run.py (the
original was unchanged since its backup). After: live == stage3 for all 43; run.py --app <live>
13/0; find 270/0 and searchbox 38/0 against live; php82_errors.log nothing since 20:16; the
scheduler's 20:17:15 run (the new schedule_runner.php) completed. Rollback: `git show b25ef2d^:<rel>`
per path through the same guarded swap (or `git revert`-style stage), then the help cache again.

## Kit

| Path | What |
|------|------|
| `STYLE.md` | the wording rules the help edits followed |
| `orig\` | live cut 2026-10-19 17:25 (+ manage_journal.php, help\ask.php, help\loader.php, help_*.php later, unchanged); `SHA256SUMS.orig` |
| `stage\` | the result (43 changed files, `CHANGED_FILES.txt`) |
| `edits_code.py` | 122 phrase edits (135 replacements; rel, old, new, count) to the code files + manifest + the reference registry |
| `hunks.json` | 315 phrase-level hunks for the 28 prose files (help topics, tips, AI prompt), cut by `mkhunks.py` |
| `patch.py SRC OUT` / `--check` | re-applies both to ANY copy (the live webroot moves often); every anchor exact, or nothing is written |
| `run.py` | the wording suite (static): W1-W12 + S0; `--control` = orig (every W red); `--mutants` (19) |
| `suites\searchbox\` | the searchbox suite, UPDATED for the new words (A, S5, mutants oldlabel / savedhdr / nokeysc): copy over `penumbra_tests\searchbox\run.py` AFTER the deploy |
| `suites_bak\` | the other suites' files as they were before their in-place edits (below) |
| `run_chain.ps1` | the affected suites one at a time against the stage (or `-Live`); logs in `out\` |
| `deploy.ps1` | the guarded swap (`-From <cut> -Set <stage> -DryRun` first) |
| `proof\` | patch.py(orig) + the generator: equals stage byte for byte (re-make with the commands below) |

## Proofs on the stage (2026-10-19)

- patch.py(orig) + gen_snippets_help.php == stage, byte for byte (43 files); patch.py --check
  against LIVE at 18:20 (after 04e78f3 Column stats and 730087f Rows card): CHECK OK.
- JS: only string-literal contents changed (code skeletons identical) in search_builder.js and the
  six penumbra_*.js; main.js: identical except the ONE intended regex (the Rows card's count-text
  reader takes "showing N filtered results" and the old "search results").
- PHP: `php -n -l` clean on 45 files (a broken control fails). Line endings, NUL bytes unchanged
  per file; em-dashes only fewer (index.php 20 -> 17 entities, main.js 67 -> 66 + 28 -> 26).
- helpv2 lint_help: stage == orig: only L16 (userSettings, pre-existing on live). L17 fresh.
- wording suite run.py: 13/0; --control as expected (S0 green, all 12 W red); mutants 19/19 (incl. the scope guards schedkeep, dashkeep, schedhelp).

## Suites (run_chain.ps1; logs and SUMMARY*.txt in out\)

stage2 (re-cut 18:20 on live after 04e78f3 Column stats + 730087f Rows card; the same word-level
change set as stage, 43/43 files), one suite at a time: find 270/0, colmenu 259/0, rowfunnel 114/0,
togglefix 508/0, subsettip 35/0, singlekeytips 57/0 + 4/0, dashsearch 0 failed, subtip PHP 83/0 +
JS 86/0, printx 17/0, acrow 81/0, searchbar 25/0, noadm5 28/0, xlsx 130/0. (On the first stage,
colmenu and rowfunnel were red only on the live features that stage predates.)

The same 13 suites against LIVE (the old words, 19:25): identical counts, all green (the in-place
edits are backward compatible: nobody's run goes red before the deploy).

The staged searchbox copy (suites\searchbox): stage2 38/0; mutants oldlabel -> S5, savedhdr -> A,
nokeysc -> S4 (each exactly that check); against orig2 (the pre-rename files) exactly S5 and A
red, 36 pass. Its own `--control` cannot run: it wants a `searchHelpLightbox.php.bak-20261006-
searchbox`, and that fragment did not exist on 10-06 (the original suite fails the same way since
the v1 help removal; pre-existing).

### Suite edits made IN PLACE (backward compatible: the old OR the new words pass)

The new words are pinned once, precisely, by `filterword\run.py` and the staged searchbox copy;
these pins accept both so nobody's run goes red before or after the deploy:
find\driver.js (moreLine x2, aboutText /filter/), acrow\run.py, noadm5\run.ps1 + test.php,
printx\run.py, searchbar\run.ps1 (S1, S6, the nocard anchor), singlekeytips\driver.js (L2, T1,
the "/" hint probe) + run.ps1 (I3), subsettip\run.py (T1, T4, the notitle anchor),
togglefix\driver.js (M-live-status, M-prec-warn, H-hdr-state / mark / clear / search / pages) +
mk_mutants.py + mutants.json (h-hdr-ingroup, m-js-commit-msg anchors), xlsx\harness.html,
subtip\tests.js (L13) + test_subtip.php (D: the runner's pivot link line), dashsearch\builder.html
(the opener's name, the "/" placeholder, the Filter help button and panel), colmenu\driver.js
(statsLine), rowfunnel\driver.js (eachX).
Found by: a literal scan, a phrase scan (regex pins) and then the RUNS (the toggle header box's
"rows the search shows" and the subtip runner line are composed in the tests: no scan saw them).
Originals: `suites_bak\*.20261019` (+ SHA256SUMS.bak). **Never copy one back over a shared suite:**
other sessions edit these too (rowfunnel\driver.js got the Rows card's round-2 checks at 18:17,
with my eachX change merged in by that session; `suites_bak\rowfunnel_driver.js.20261019` is
pre-round-2 and would delete them). The in-place edits are backward compatible: no rollback needed.

Noticed, not mine: togglefix mutants reenable-notes, n-js-dirty-notesig, s-mj-card-postfail have
stale main.js anchors on the PRE-rename file too (0, 0 and 2 hits).

## Deploy (only with the user's go-ahead)

1. If `deploy.ps1 -From orig2 -Set stage2 -DryRun` passes, skip to 4. Else re-cut: copy every
   file of `orig2\` (the 43 targets + the unchanged files the lint and suites read) from live into
   `orig3\`; sha256 them.
2. `py -3 patch.py orig3 stage3`, copy the unchanged files across, then
   `php -n ..\helpv2\gen_snippets_help.php --app stage3`.
3. Prove on stage3: `py -3 tools\samechange.py <kit> orig stage orig3 stage3` 43/43;
   `py -3 run.py --app stage3` GREEN; lint_help stage3 == orig3; php -l; the main.js skeleton
   (`tools\regexfix.py orig3\js\main.js X` then `tools\skeleton.py X stage3\js\main.js`), the other
   JS with `tools\skeleton.py`; rerun the suites whose files moved (run_chain.ps1 -Stage stage3 -Only ...).
   (tools\: wdiff.py = the word-level review, findpins / findpins2 = the test-pin scans.)
4. `deploy.ps1 -From <cut> -Set <stage> -DryRun`, then without -DryRun (index.php last).
5. Right after: `git add -- <43 paths>; git commit --only -F <msg> -- <43 paths>; git push`
   (GIT_DIR d$\Utilities\penumbra_git; message file written WITHOUT a BOM).
6. Help cache on live: `php ..\helpv2\prebuild_caches.php` (no argument), commit cache\help_chunks.json.
7. Copy `suites\searchbox\run.py` over `penumbra_tests\searchbox\run.py`.
8. On live: `run.py --app <live>` GREEN, find 270/0, searchbox (new copy), php82_errors.log
   untouched, the next scheduler run completes (schedule_runner.php changed: 3 email lines + 2 link texts).

Rollback: `git show <commit>^:<rel>` per path into a stage and the same guarded swap; the in-place
suite edits are backward compatible and need no rollback.
