# helpv2 - Help Center v2 suite (phases 0 to 2, 2026-10-14 / 2026-10-15)

The Help Center's content moved from one 1.6 MB `help_content.php` into one fragment per
topic under `help/`, behind a switch, with an audience gate that is built but OFF (phase 0).
Phase 1 re-shelved the table of contents into the categories a reader arrives with, split the
SQL Editor into four topics, folded the five scheduler topics into one book, merged the Access
List into Security, and collapsed six duplicated passages into one canonical section each with
links. Phase 2 rewrote the twelve viewer topics to the tier standard (see below). This suite
proves nothing a reader relied on was lost, that the switch and the gate do what they say,
that cross-topic links really navigate, that the rewrites kept every fact and stay inside the
reading budget, and that the AI help retrieval still indexes everything.

## Files under test (the stage, or the live webroot after the deploy)

| file | what changed |
| --- | --- |
| `help_content.php` | 4-line shim after `require_once 'db_connection.php';`: with v2 active it hands the request to `help/loader.php` and returns. Otherwise byte-identical to v1. CRLF. |
| `help_manifest.php` | 4-line shim before the v1 `function_exists` guard: requires `help/manifest.php`, which defines the TOC functions first while v2 is active. LF. |
| `help_retrieval.php` | v2-aware: builds the AI help chunks from the fragments (manifest order) into `cache/help_chunks_v2.json`, keyed on a count+mtime+size signature; tip stores index under their own headings; every chunk carries its block's audience (`a`). `PNB_HELP_VER` 3 -> 4. |
| `js/main.js` | ONE behaviour (two hunks, `patch_mainjs.php`): a `.help-jump-link` whose anchor lives in a topic that is not active activates that topic; `activateHelpTopic()` re-resolves the owning topic from a jump anchor (so `?` icons and `openHelpCenter()` aimed at a moved section keep landing on it), opens a folded topic at its own start when no anchor is given, and accepts a topic div itself as an anchor. CRLF. |
| `help/manifest.php` | NEW. The switch (`pnb_help_v2_active`), the gate (`pnb_help_gate_on`, `pnb_help_show`, `pnb_help_is_writer`), the registry (`pnb_help_v2_manifest`: categories; per topic id, title, audience, aliases, keywords, extra, new), the phase (`pnb_help_v2_phase` = 1) and the list of topics the phase touched (`pnb_help_v2_touched`), the v2 `penumbra_help_manifest()` / `penumbra_render_help_toc()`. |
| `help/loader.php` | NEW. Defines `PNB_HELP_V2`, renders every topic the user may see, then the tip stores. |
| `help/topics/<id>.php` x32, `help/tips/<id>.php` x5 | NEW. Byte-exact cuts of the v1 file (CRLF kept) with a 6-line guard header, `data-audience` on the topic div, inner `if ($isAdmin)` / `if (true)` wrappers rewritten to `pnb_help_show('writer')`, the Data Visualization "For Administrators" block gated like the pivot and snapshot ones; then the phase 1 edits below. |
| `help/v2.on` | NEW marker. Present = v2 serves. Delete = v1. NOT tracked in git; the deploy creates it on live only when the user says so. |

Not touched: index.php, the dashboard, CSS. Topic ids, anchor ids and `data-tip` keys are a contract
(42 `?` icons, `#help=` links, 40+ suites); former ids go into the manifest's `aliases`, which ride
in `data-extra` so main.js resolves them unchanged.

### Phase 1 edits (all by script, byte-safe: `split_sql.php`, `patch_phase1.php`, `patch_mainjs.php`)

| change | where |
| --- | --- |
| Categories: Start here / Find and filter / Shape the table / Charts / Share and export / Track over time / Dashboards / Write reports * / Automate * / Administer ** | `help/manifest.php` groups |
| SQL Editor split: SQL Editor keeps Features & Shortcuts, CLOB columns, User Variables, Special Encodings; Query Prompts, Importing External Files and Cross-Database Subqueries are topics of their own, same h4 ids, one-line intros | `sqlHelpLightbox.php`, `promptsHelpLightbox.php`, `importsHelpLightbox.php`, `subqueriesHelpLightbox.php` |
| Scheduler book: Dynamic Values, Skip When, Search Filter and On Completion are `extra` of the Scheduler topic (no TOC rows of their own; their ids still resolve through `data-extra`); a second row of pills jumps to them (`schedDyn-top`, `schedCond-top`, `schedFilter-top`, `schedDone-top`) | manifest + five scheduler fragments |
| Access List merged into Security: the Security section is two sentences and a link; the Access List fragment is canonical (`acl-entries` etc.), the pill-tooltip bullet moved in; Dashboards and the Scheduler's recipient rules link to it | `saveSecurityHelpLightbox.php`, `accessListHelpLightbox.php`, `dashboardsHelpLightbox.php`, `schedulerHelpLightbox.php` |
| Dynamic dates: canonical = Dynamic Values (`schedDyn-dates`, the `-3 months` row and the this/next/N-years-ago phrase moved in); the Scheduler's duplicate tables are a pointer | scheduler fragments |
| me() values: canonical = Dynamic Values (`schedDyn-meValues`, "PDF cover line" moved in); the Scheduler's section is a pointer; the SQL User Variables text links to it | scheduler fragments, `sqlHelpLightbox.php` |
| Scheduled snapshots: the "For Administrators" rotation bullets MOVED into the Scheduler's Take a Snapshot section (`schedHelp-snapshotPool`); the snapshot topic keeps a pointer | `snapshotsHelpLightbox.php`, `schedulerHelpLightbox.php` |
| Quick-open shortcuts: canonical = Power Features (`pf-themes`); View Options' table is a pointer (its gotcha paragraph stays) | `viewoptionsHelpLightbox.php`, `powerFeaturesHelpLightbox.php` |
| Templates: canonical = Copy with Custom Template (`copy-template`); Download and the Drop File row link to it (they already deferred to it in prose) | `copyHelpLightbox.php`, `downloadHelpLightbox.php`, `schedulerHelpLightbox.php` |
| Two engines kept apart on purpose, cross-linked: SQL vs snippet `me()` key tables (`me-keys-sql`, `me-keys-snippet`), browser vs scheduler search grammar (`search-syntax`, `scheduler-filter-syntax`) | `sqlHelpLightbox.php`, `optionsHelpLightbox.php`, `searchHelpLightbox.php`, `searchFilterHelpLightbox.php` |

Markup convention: the canonical heading carries `data-canonical="<key>"`; every pointer is
`<a href="#" data-jump-to="<anchor>" class="help-jump-link" data-canonical-ref="<key>">`. Lint L12
keeps a key unique, L14 makes every pointer resolve to its canonical's topic.

### Phase 2 rewrites (2026-10-15): the twelve viewer topics to the tier standard

`pnb_help_v2_standard()` in the manifest lists the rewritten topics (Search, Grouping, Column
Summaries, Pivot, Visualization, Snapshots, Journal, Download, Copy, Email, Settings, Dashboards);
`pnb_help_v2_dropped_tokens()` lists the facts a rewrite dropped on purpose, with the reason.

| rule | enforced by |
| --- | --- |
| One `?` per feature: a sticky header with the title, a what/when line ending in **Open it:** (button, shortcut, single key), and a jump row of the topic's sections | by hand; L15 keeps one h3 and one close button per shell |
| Paragraphs <= 80 words, bullets <= 50, table cells <= 70; no `&mdash;` / em-dash character (plain `-` or a sentence instead); no emoji in h3/h4 | **L16** (FAIL on a standard topic, warning elsewhere) |
| Every `<code>` / `<kbd>` text and every number of two or more digits of the v1 topic is still somewhere in v2 (any topic), or listed in `pnb_help_v2_dropped_tokens()` | **P9**; P6's word floor is 60% for phase >= 2 |
| Every section has an id; the ids index.php, main.js and other topics jump to are unchanged (`us-*`, `snh-*`, `pvh-*`, `vbh-*`, `colsum-*`, `search-*`, ...) | L5 / L6 / P2 |
| Cross-topic links are `pnb-help-open` + `data-target` + `data-jump-to` where the topic can be shown in the dashboard's own help panel (Dashboards, Search), `help-jump-link` elsewhere | L5 / L6 / L14 |
| Table cells carry `white-space: normal; max-width: none;` inline and the header uses `top: -14px; background: var(--bg-surface, #fefefe); margin: 0 -16px 14px; padding: 10px 16px 10px` | `visual_harness.php` + headless Edge (hub and panel renders) |

Why the inline cell style: main.css styles every `td` in the document for the report table
(nowrap, ellipsis). The hub neutralises that through `.lightbox-content td`; the dashboard's help
panel (`penumbra_dashboard.js` openHelpPanel) injects the fragment's inner HTML without that
wrapper, so without the inline style every table cell in the panel was clipped to one line.
The hub's own override for `[style*="position: sticky"]` still forces top / margin / background
there, so the header values are the panel's.

Two corrections to the audited text: the Email help's "2,000-row in-body limit" (main.js
`ROW_EMBED_CEILING` = 25000 since 2026-08-30: the body is trimmed to the relay cap instead; the
old number is a listed dropped token) and the Settings theme list, which skipped Monochrome
(`themes_config.php` offers it; Easy Read is legacy and not listed).

Known limitation (not fixed here, outside the help content): in the dashboard's help panel a
cross-topic link to a topic the panel does not hold is rewired to `index.php#help=<topic>`, but
the panel's `a[data-jump-to]` click handler calls preventDefault first, so the hub never opens.
A one-line fix in `penumbra_dashboard.js` (skip links that carry `target`) is proposed as a
follow-up.

## Running

```
$d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpv2'
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <stage> -Orig <orig> -Mutants
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))                      # live as app and orig
```

`run.php` is the runner (PHP 8.2 CLI, `-n`); `run.ps1` only builds its arguments. The jump
harness needs Edge (`jump_harness.ps1`, called by run.php through PowerShell).

| check | what |
| --- | --- |
| L1-L16 `lint_help.php` | manifest<->files, guard, audience attributes = manifest, unique ids, every jump link resolves (cross-topic ones listed as info), every `data-target` / `openHelpCenter` / `#help=` / `openHelpPanel` reference resolves, every consumed tip key is defined (index.php + js/*.js), tags balanced, `php -l`, line endings, manifest sanity, canonical keys unique (L12), shims present, every `data-canonical-ref` pointer resolves into its canonical's topic (L14), one h3 and one close button per topic shell (L15), the reading budget on every `pnb_help_v2_standard()` topic (L16: paragraphs <= 80 words, bullets <= 50, cells <= 70, no em-dashes, no emoji headings). Then the budget table for every fragment as warnings. |
| E*/P* `equiv_help.php` | always: v2 body carries `data-audience`; blocks close; gate on: viewer / writer / admin see exactly their topic sets, inner "For Administrators" blocks hidden from viewers, TOC stars and legend follow; v2 forced off renders the v1 body (rollback). Phase 0: v1 == v2 block by block and TOC == TOC. Phase 1+: every v1 block, element id, tip key and TOC id survives (P1 P2 P3 P5), words within 85-105% (P6; floor 60% from phase 2), every topic the manifest does not list as touched is identical to v1 (P7), new topics are well-formed (P8). Phase 2+: every fact token of a touched v1 topic is still in v2 or listed as dropped (P9). |
| `visual_harness.php` | report only: renders one topic as the hub shows it and as the dashboard's help panel shows it, scrolled by N px, into static HTML for a headless Edge `--screenshot`; a probe badge prints the pane's scrollWidth / clientWidth so a horizontal overflow is a number, not a guess. |
| R1-R5 `retrieval_smoke.php` | chunks from the fragments with audiences; the v1 build still works and matches within 10%; a scheduling question lands on the Scheduler topic; a pasted SELECT retrieves nothing; the two versions use different cache files. |
| J1-J2 `jump_harness.ps1` | headless Edge over a mini hub with the navigation code LIFTED from the main.js under test (`lift_jump.php`): in-topic link stays put, cross link activates the owner (and its folded extras), link into an extra activates host + extra, deep link re-resolves the owner, folded topic opens at its own start, plain open unchanged. J2 runs the UNPATCHED main.js and must fail exactly T2-T5. |
| `coverage_help.php` | report only: snippet functions, action types, URL parameters, single keys, View Options controls, scheduler labels, chart types, pivot aggregations, prompt tips vs the Query Prompts topic, hover-tip keys, topics without a `?` icon, each against the help. Writes `coverage_report.md`. |
| `-Mutants` | thirteen mutants in phase 2 (wrong audience, dangling jump, missing fragment, duplicate id, unbalanced div, text drift in an untouched topic, anchor removed, dangling canonical ref, gate leak, shim removed, PHP error, a dropped fact token -> P9, a 90-word paragraph in a standard topic -> L16): each must turn its own checks red and nothing else. The phase 1 table (eleven) stays in run.php for a phase 1 tree. |

`split_help.php` is the phase 0 generator (`--src <help_content.php> --out <stage> --report-dir <dir> --verify`);
it rebuilds the source from its own output and refuses to continue on a byte mismatch. `add_shims.php`
inserts the two shims, idempotently. `split_sql.php` and `patch_phase1.php` are the phase 1 generators
(idempotent: anchors already replaced are skipped; a missing anchor aborts before anything is written).
`readme_row.php` stages the README.md row.

## Deploy notes (when the user says so - the atomic recipe applies)

1. Targets: `help_content.php`, `help_manifest.php`, `help_retrieval.php`, `js/main.js` (swap), `help/` (new tree:
   `help/topics/` x32, `help/tips/` x5, `manifest.php`, `loader.php`), README.md. Order: `help/` first (inert without
   the marker), `js/main.js` (its change is harmless under v1: no anchor is ever outside the active topic there),
   then `help_retrieval.php`, `help_manifest.php`, `help_content.php` last.
2. Pre-flight per the recipe: clean `git status --porcelain` on every target, live sha256 == staged-from.
3. Prebuild `cache/help_chunks.json` (v1, VER 4) and `cache/help_chunks_v2.json` from the workstation
   (the web tier cannot write `cache/`): define `PNB_HELP_V2_FORCE` false/true before requiring
   `help_retrieval.php` and call `pnb_help_build()`; assert `src_mtime` equals the live signature.
4. Run this suite with `-App <live> -Orig <live>` (E7 proves v1 still renders; P* compare live v1 to live v2).
5. Create `help/v2.on` on live only when switching; an admin can preview first with
   `help_content.php?helpv2=1` (cookie, that browser only; `?helpv2=0` reverts).
6. Rollback = delete `help/v2.on` (no file swap needed). Full rollback = `git show HEAD~1:<file>`
   for the four changed files; the `help/` tree is inert without the shims.
7. Changelog artifact entry; `git commit && git push`. Add `help/v2.on`, `help/v2.off`, `help/gate.on`
   to `.gitignore` (the repo has none yet) so a marker is never deployed by a commit.
