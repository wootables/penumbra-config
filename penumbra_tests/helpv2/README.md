# helpv2 - Help Center v2 suite (phases 0 to 6, 2026-10-14 / 2026-10-15)

The Help Center's content moved from one 1.6 MB `help_content.php` into one fragment per
topic under `help/`, behind a switch, with an audience gate that is built but OFF (phase 0).
Phase 1 re-shelved the table of contents into the categories a reader arrives with, split the
SQL Editor into four topics, folded the five scheduler topics into one book, merged the Access
List into Security, and collapsed six duplicated passages into one canonical section each with
links. Phase 2 rewrote the twelve viewer topics to the tier standard, phase 3 the writer and
administrator topics, phase 4 made the Custom Code reference a generated topic from one registry, phase 5 audited the help against the code through the coverage map, and phase 6 added the Ask page (see below). This suite
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
| `help/manifest.php` | NEW. The switch (`pnb_help_v2_active`), the gate (`pnb_help_gate_on`, `pnb_help_show`, `pnb_help_is_writer`), the registry (`pnb_help_v2_manifest`: categories; per topic id, title, audience, aliases, keywords, extra, new), the phase (`pnb_help_v2_phase` = 5) and the list of topics the phase touched (`pnb_help_v2_touched`), the v2 `penumbra_help_manifest()` / `penumbra_render_help_toc()`. |
| `help/loader.php` | NEW. Defines `PNB_HELP_V2`, renders every topic the user may see, then the tip stores. |
| `help/topics/<id>.php` x32, `help/tips/<id>.php` x5 | NEW. Byte-exact cuts of the v1 file (CRLF kept) with a 6-line guard header, `data-audience` on the topic div, inner `if ($isAdmin)` / `if (true)` wrappers rewritten to `pnb_help_show('writer')`, the Data Visualization "For Administrators" block gated like the pivot and snapshot ones; then the phase 1 edits below. |
| `help/snippets.php` | NEW (phase 4). The Custom Code registry: data only, 41 entries; `help/topics/optionsHelpLightbox.php` is GENERATED from it by `tests/gen_snippets_help.php` (see Phase 4). |
| `ai_system_prompt.php` | STAGED copy (phase 5): one added heading, `### avg(COLUMN, CONDITION?)`; a deploy of it must be followed by `php renew_ai_cache.php`. |
| `help/ask.php`, `help_ask.php`, `help/topics/askHelpLightbox.php`, `js/penumbra_help_ask.js` | NEW (phase 6). The Ask page: library, endpoint, topic, client. Inert without the marker. |
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

### Phase 3 rewrites (2026-10-15): the writer and administrator topics to the same standard

The same rules and the same checks, now over 30 topics (`pnb_help_v2_standard()`): SQL Editor, Query
Prompts, Importing External Files, Cross-Database Subqueries, Saving a Report, Save Preferences, Security
(with the Access List extra), Version History, View Options, Power Features, the Scheduler book (Scheduler,
Dynamic Values, Skip When, Search Filter, On Completion), Report Repository and Auditor. Left alone on
purpose: the home topic, and `optionsHelpLightbox` (the Custom Code reference is phase 4's structured source).

What moved, so that a fact lives in one place: the settings every scheduled task shares (how the runner
ticks, cron, the control card, prompt values, me() values, decryption key, Test Run, failures) left the
Email section for sections of their own; the quick-open shortcuts, the everyday keys and the table
navigation keys live only in Power Features (`pf-themes`, `pf-everyday`, `pf-navkeys`; SQL Editor and View
Options point there); the prompt "reserved names" rule moved from the SQL Editor to Query Prompts; the
Scheduler's Subscriptions, Change Analysis and Custom Template passages and the Auditor's sub-view,
action-type and Health passages became tables with one aspect per row. Every v1 id is kept (`schedHelp-*`,
`dbDumpHelp-*`, `audit-*`, `features`, `clob-columns`, `uservars`, `encoding`, `prompts`, `imports`,
`paste-import`, `paste-into-view`, `import-access`, `subqueries`, `linkToPromptGenerator`), and so are the
table id `pnbRecipientVarsChart` and the `pnb-rv-nonrecip` row class that main.js clones into the Scheduler
and Search Filter topics.

Found and fixed on the way: the phase 2 dash sweep had turned the SQL comment marker `--` into `-` inside
two `<pre>` examples (`WHERE 1=0  -- Start false`, `RETURNING CLOB  -- use CLOB`), restored; v1's Dynamic
Values topic carried a `<tr>` (the `-3 months` example) outside any table, now inside its table; a stray
space before a full stop in the Search Filter topic. Left alone: main.js looks for `#auditorHelpFullLogLink`
to retarget a link, but no such element exists in v1 or v2 (a dead hook, noted here only).

Three more mutants (sixteen in all): a cell over budget in the Scheduler book -> L16; the chart id
`pnbRecipientVarsChart` renamed -> P2; the id an index.php icon targets (`dbDumpHelp-destination`)
renamed -> P2 + L5. The `missing-fragment` mutant deletes a topic that is now standard and touched, so
L16 and P9 join its allowed failures.

Retrieval R3 ("how do I schedule an email report to go out every monday") had slipped to the Access List's
"scheduled emails" chunk: the rewritten Email Report section never said "schedule" or named a day, and the
scorer is lexical (a title boost, `schedule` -> `scheduler` only through the synonym map). Fixed in the
content, not the test: the section now opens with the task in the reader's words (every Monday at
8:00 AM, `0 8 * * 1`). A rewritten section must still contain the words of the question it answers.

### Phase 4 (2026-10-15): the Custom Code reference from ONE structured source, a parameter table per function

`help/snippets.php` is the registry: a PHP file that returns data only, and the one place the Custom Code reference
is written. `tests/gen_snippets_help.php --app <dir>` renders `help/topics/optionsHelpLightbox.php` from it in the
tier standard; the rendered file says GENERATED in its header, carries the registry's sha256, and lint L17 re-renders
it in memory (`--check`) and fails while the topic is stale. Edit the registry, regenerate, commit both.

| registry key | holds |
| --- | --- |
| `intro` | the what/when line, the "Open it:" line and the Getting Started HTML |
| `badges` | the availability badges (browser + email, browser only, exports, admin, styling): label and style |
| `categories` | nine, in jump-row order: Interactive, Aggregation, Math, Logic, Data and Identity, Date, Text and Lookup, Formatting, Components |
| `functions` | one entry per v1 anchor id (41: 39 functions, the `abs/floor/ceil/mod` group as one, and the two components Stat cards and Breakdown cards): `title`, `names` (the editor names it covers), `signature`, `category`, `where` (badge), `canonical` (`me` keeps `me-keys-snippet`), `summary`, `params` (rows: name, required, default, meaning, example), `forms` (rows: signature, meaning, example; format 5, heatmap 3, action 7), `body` (the prose and sub-tables, HTML in a nowdoc), `related` |

141 parameter rows and 15 form rows, every one with an example; the generated topic is 21,400 words and keeps all
44 v1 anchor ids (P2) and every fact token (P9). The generator refuses (exit 2, writes nothing) a function without
a signature (components excepted), a parameter or form row without a meaning or an example, an em-dash anywhere, a
duplicate anchor id, a category the registry does not list, or a `related` id that is not a function.

How the registry began: `tests/snippets_import.php` (one-off, kept as the record) cut the v1 topic per function:
badge, first paragraph, body, category from the index table, signature from the editor's hover cards; no sentence or
example was retyped. The parameter rows were then written by hand against the code (`js/main.js`,
`js/penumbra_snippet_help.js`). vis()'s two flex-div argument tables (41 rows) became its parameter rows by
`harness/vis_params.php`, each description kept verbatim; the three descriptions over 70 words (`comboSeries`,
`options`, `referenceLine`) stay in full as paragraphs under the signature and their rows end "(details below)".

| check | what |
| --- | --- |
| **L17** | the topic is the current render of the registry (the generator's `--check`); a refusal is red too |
| **L18** | the registry's `names` = the editor's `PENUMBRA_SNIPPET_FN_NAMES` in `js/main.js` (43 names; components excepted); the hover cards (`js/penumbra_snippet_help.js`) and the AI prompt (`ai_system_prompt.php`) are compared as warnings W2h / W2a, not failed |
| two mutants | a registry edit without a regeneration -> L17; a registry name that is no editor function (`avg` -> `avgx`) -> L17 + L18. Eighteen mutants in all. |

Found: `ai_system_prompt.php` had no heading for `avg()` (W2a; settled in phase 5). The 166 flex-div rows inside the bodies were phase 4b's work (below); the hover cards and the AI prompt are still separate copies of the reference (compared, not generated: both are code files).

### Phase 4b (2026-10-15): every pseudo-table in the Custom Code bodies is a real table, one aspect per row

The 17 flex-div tables inside the registry bodies (151 rows: data() types, me() variables, info() sections, string()
operations, format() variables, heatmap options, the action() key, trigger, fullscreen and pattern tables, the
slide/web/noweb argument tables) became `<table>` markup in the tier standard (`harness/flex_to_tables.php`), so
L16's cell budget now reads them. Five cells that bundled several aspects were split into rows of their own
(`harness/split_rows.php`): the pivot trigger's `Agg` (170 words, now seven rows: basic, percentiles, weighted,
change, shares, running, `:down`), its custom ranges, the fullscreen `CHARTNUMBER` and `THEME`, the heatmap `style=`
option. The slide/web/noweb bodies dropped their argument tables (the generated parameter table is the one place;
the slide example `<p>Hello, world</p>` moved into its CONTENT row, as P9 demanded). Then the bodies lost the
signature block and the summary sentence they repeated under the generated ones (33 blocks, 3 paragraphs,
`harness/dedupe.php`), and the registry signature became the one signature, its placeholders named as the parameter
table names them (`SCOPE?` on every aggregate, `data(TYPE?, ...)`, `case(CONDITION, OUTPUT, ...)`,
`action(TYPE, LABEL, VALUE, CONDITION?)`, the `MODIFIERS?` of the two sparklines).

| check | what |
| --- | --- |
| **L19** | no flex-div pseudo-table row (`display: flex` with `flex: 0 0 Npx` cells) in any standard topic |
| mutant `flex-table` | a flex-div row planted in the Dashboards topic -> L19 only. Nineteen mutants in all. |

Found: the hover cards (`js/penumbra_snippet_help.js`, where the registry's signatures came from) omit the trailing
scope argument every aggregate accepts and write `action()` as `action(TYPE, ...)`; the help now carries the full
forms, the hover cards are a separate copy still (compared by L18's warning, not generated).

### Phase 5 (2026-10-15): the accuracy audit through the coverage map

Every row of `coverage_help.php` was checked against the code and settled in the help, or in the probe when the
probe was wrong:

| probe | finding | settled by |
| --- | --- | --- |
| C1 | `avg()` had no heading in `ai_system_prompt.php`, the AI builder's own copy of the reference | a staged `ai_system_prompt.php` with `### avg(COLUMN, CONDITION?)` after `sum()`; its deploy must be followed by `php renew_ai_cache.php` (the file's own header says so); lint and the probe read the staged copy first |
| C3 | `dsearch` and `eview` were in no topic; `calc` and `embed` were outside Power Features | three rows in Power Features: `dsearch` (a dashboard's filter bar as a JSON fragment list, routed to the report's own columns by `penumbra_route_dash_search`), `calc` (`calc=Name|formula|format`, `calc=off`, a link to Settings), `embed` with `eview=header|table` |
| C5 | "Export/Download" is written with a `<wbr>` in index.php | the probe normalises the spacing around `/` |
| C6 | "Subject Line: ?" and "Body Preamble: ?" carry the help icon's text, "Header line (optional; ...)" a parenthetical | the probe cuts a label at `(` and strips trailing `: * ?`; the help now names the **Private Key (PEM)** box and **Reason for override** as the form does |
| C8 | the Pivot topic called the share types "% of Row Total" and so on while the builder's Aggregate cell says "% Row" | each of the five rows names its key and the builder's label (`getAggregationLabel` in main.js) |
| C9 | the probe matched tip KEYS (`autofill-table`) as words | it now matches each tip's `<h4>` (the generator control's label) in the topic that owns the generator: Query Prompts gained "The Prompt Generator" (`pr-generator`, nine controls, one row each), Cross-Database Subqueries names the Tag Generator's six controls |
| C10 | 12 tip keys with no static consumer | 10 are consumed by main.js at run time (`viz-series-*`, `pivot-value-options`, `us-tip-colopts`); `pivot-presets` and `pivot-preset-onload` have no consumer anywhere: dead tips, left in place (P3 keeps every v1 tip key) and reported |
| C11 | 8 topics have no `?` icon in index.php | code-side, reported: Advanced Search, Column Summaries, Power Features, Dashboards, Query Prompts, Importing External Files, Cross-Database Subqueries, Report Repository |

C2, C4 and C7 had no gap. After the pass, C1 to C9 report 0 and C10 / C11 stay as the code-side list.

Suite flake found and fixed on the way: P9 went red once inside a mutant run with a token nothing had touched. A
v1 row prints the live clock (`date('g:i A')`, the `{SEND_TIME}` example) and the v1 and v2 renders are seconds
apart, so a minute boundary between them turns a two-digit number into a "lost" fact token. `hv_fact_tokens` now
normalises the live clock and date strings exactly as the block comparison always did (`hv_normalise_lines`).

### Phase 6 (2026-10-15): the Ask page and its question cards

A new topic at the top of the list, **Ask a question**, answers a question in the reader's own words from the
help text alone. Four new files, all inert without the v2 marker (the topic exists only in the v2 manifest and
the endpoint refuses while v2 is off):

| file | what |
| --- | --- |
| `help/ask.php` | the pure half: validation, the card store, the limits, the help-only prompt, the handler (`pnb_ask_handle`). No HTTP, no model, no globals: the endpoint wires the real ones, the suite wires a stub. |
| `help_ask.php` | the endpoint (JSON): signed-in users; 404 while v2 is off or `help/ask.off` exists; 403 outside the audience (`help/ask.writer`, `help/ask.admin`); the model call mirrors ai_assist.php (Gemini first, Anthropic as the fallback, the same proxy and keys). |
| `help/topics/askHelpLightbox.php` | the page: question box, answer with sources and votes, Top questions, How it works; its own script tag loads the client. |
| `js/penumbra_help_ask.js` | the client (ES5): renders answers as text plus markdown-lite (bullets, bold, code, `[Topic]` links to the sources), votes, cards, and the **Ask the help** button an empty search offers. |

What a question costs: nothing when a card already answers it (the same question in other words, token overlap
at least 0.8); nothing when the help has no passage for it (the model is never asked to guess, and a pasted SQL
statement gets a plain refusal); one model call otherwise, behind a per-person minute limit (`help_ask_per_minute`,
5) and a day budget everyone shares (`help_ask_per_day`, 300), so the page can never spend the whole free tier.
Every answer becomes a card: others see it under Top questions once it has a net thumbs-up, a card voted down to
-2 is answered afresh the next time, and a card built from writer passages never answers or lists to a viewer
(the audience of its sources travels with it). State lives beside the notice and maintenance state
(`penumbra_maintenance_state_dir()`): `help_ask_cards.json` (atomic tmp+rename under a lock), `help_ask_quota.json`,
`help_ask_rate/`, `help_ask_log.jsonl` (hashed users, never the key).

`help_retrieval.php` grew `pnb_help_retrieve_chunks($query, $topK, $allowedAud)`: the scorer, returning the picked
chunk records and skipping audiences the reader may not read; `pnb_help_retrieve()` formats them as before. Chunks
carry their topic id now (`PNB_HELP_VER` 5, so both caches rebuild once), which is what the page's source links use.

| check | what |
| --- | --- |
| **A1-A10** `ask_tests.php` | the pure half against a scratch state dir and a stub model: a help-only prompt (no DDL, the passages, the question) and one model call; the card answers the rephrased question; one vote per person, retirement and regeneration; the minute limit and the day budget (429, clock injected); no passages means no model call and no card; the audience filter on passages and on cards; text-only answers; the store's integrity and cap; validation and permissions; the log |
| **H1** `ask_harness.ps1` + `ask_harness.html` | the real client in headless Edge against a stubbed `$.ajax`: an answer renders as text (a planted `<img onerror>` and `<b>` stay text), markdown-lite and source links, a vote posts once and marks the button, cards show their answer without a model call and their source links activate the topic, an empty search offers to ask the same words, a 429 shows the server's message and re-enables the form |
| **L20** | the Ask fragment alone carries a script, and it is `js/penumbra_help_ask.js`; endpoint and library present |
| eight mutants | the card cache, the no-passage gate, the text-only answer, the day budget, the audience filter in retrieval, the card audience, the editor-rights notice (each -> its A-check), the ask-mode recall (-> R6). Twenty-seven mutants in all. |

**The editor-rights notice (the owner's rule, 2026-10-15 afternoon):** when the best passage belongs to the writer or
administrator help and the asker is a plain viewer (not an administrator, a grant holder or the owner of a saved report:
`penumbraIsConsoleAudience`, independent of the help gate, which only decides what may be read), the answer is preceded by
"This requires editor rights to the report. Ask your report owner to set that up for you." (administrator passages: ask an
administrator). The notice is computed per reader from the card's stored top audience (`ta`), never baked into the shared
card text, so a writer reading the same card sees none; the model is told the reader's role and the notice in a READER
line so its own first sentence agrees. A11 and harness T7 cover it; the `ask-no-notice` mutant turns A11 red.

Deployed 2026-10-15 19:12 (commit 3fe21a7): the notice (help/ask.php, help_ask.php, the Ask topic, the client) and the
Column Summaries row that had labelled the column visibility control with an eye glyph (the Settings panel's Columns
list uses a Show checkbox; the row now shows the checkbox). Five files, hash-guarded swap, the v2 chunk cache rebuilt
(1,275 chunks), the suite green against live (A11 and H1 included). The recall mode followed at 19:32 (commit e035680:
help_retrieval.php and help_ask.php, two files, the same guarded swap, the suite green against live with R6 and R7).

**Recall for short questions (2026-10-15 evening):** the Ask log showed "how do i hide a column" answered with "no passage"
three times. The retrieval keeps one term after the stop list ("column" is a schema stopword, kept so data questions do not
pull help into the assistant) and the assistant's precision gate wants two matched terms or a title on the best chunk.
`pnb_help_retrieve_chunks()` gained a mode: `'ask'` keeps every candidate that matches all the original terms the question
has (up to two) or a title, above a low floor, best first; `'assist'` (the default) keeps its gates. Column-management
synonyms were added (hide, hidden, freeze, reorder, width, height, checkbox). R6 proves "how do i hide a column" lands on
Your Settings in ask mode, R7 that assist mode still answers nothing for it; the `ask-no-recall` mutant turns R6 red, and the
mutant loop now runs the retrieval smoke as well.

**Two-letter tokens (2026-10-17, E2E_2026-10-17 D1):** the Ask page answered "no passage" for *is the IP address list
enforced*: `pnb_help_tokenize()` dropped every token shorter than three characters, so "IP" reached neither the index nor the
question, and "list" is a stopword. `help_retrieval.php` now carries `$GLOBALS['PNB_HELP_SHORT']`, an allow-list the same
tokenizer applies to the chunks and to the question, in two tiers: 1 = feature names the assistant and the Ask page both
query on (`ip`, `s3`, `db`, `ui`, `ai`); 2 = data-domain abbreviations the Ask page queries on but the assistant never does
(`pi`, `id`, `fy`; the stop list already stops "investigator", "fiscal" and "year" for the same reason). Measured on the
stage: with `pi` and `id` on the assistant's side too, six of twelve data questions such as "list all awards for pi id 12345"
pulled help into its prompt; with the tier split the assistant's output for a twenty-question battery is byte-identical to
live. `PNB_HELP_VER` 5 -> 6, so both chunk caches rebuild. The survey behind the list (uses / fragments): `ip` 7/3, `s3` 14/2,
`db` 35/10, `ui` 24/7, `ai` 2/1, `pi` 125/16, `id` 285/29, `fy` 92/13; every other two-letter token is a stopword, a number,
a date-format letter pair or an example value. R8 proves the IP question lands on Security & Access with the IP Address List
passage in ask mode, R9 that twelve data questions naming PI / ID / FY / DB still retrieve nothing in assist mode, R10 that a
cache stamped with the previous VER is rejected and rebuilt; the `short-tokens-dropped` mutant turns R8 red and
`assist-short-leak` turns R9 red (twenty-nine mutants). `patch_shorttok.php --from=<live> --to=<stage>` re-applies the four
exact-anchor edits to a fresh copy of live. Side effect, by design: `pnb_ask_tokens()` (the Ask page's card matching, Jaccard
0.8 over the question's tokens) uses the same tokenizer, so cards made from now on carry the two-letter tokens of their
question; a card made before whose question held one would match a rephrase a little less well until it is asked afresh
(the two cards on live at the time, pivot presets and attachment size, hold none, so nothing changes for them).

Not done, on purpose: no admin review page for the cards (the log and the store are plain files; `remove` exists in
the endpoint for an administrator); no streaming; the home topic does not link to Ask (it stays as it was); the
model's answer quality is not tested (the stub stands in for it; the first live answers are the test).

### Phase 7 (2026-10-15 evening): the claim-level accuracy audit against the code

Every claim in the 33 topics, the 5 tip stores and the Custom Code registry was traced to the live code by nine
read-only reviewers, one per book (Custom Code x2, pivot, charts + dashboards, share/track, scheduler, writer,
find/shape, admin + misc): 2,213 claims; 1,913 confirmed, 54 wrong, 130 partly right, 116 not reachable from the
code. Their tables are in `work/audit/*.md` of the session scratchpad; the summary is
`ACCURACY_REPORT_2026-10-15.md` beside this README.

Every wrong claim, and every partial one the reviewer could restate, was corrected on the stage with
`work/audit/patch_all.pl` (195 exact-anchor edits, applied in memory and written only once every anchor held),
plus three length passes for the tier lint (`patch_fix1/2/3.pl`): 29 topic fragments, the pivot, viz and builder
tip stores, and the registry (`help/snippets.php`, regenerated). The big themes: the preset controls moved into a
title-bar chip (pivot, charts, search), the email dialog's limits and options, the Search Filter's date engine, the
IP Address List that nothing enforces, the Column Summaries total list, eighteen chart types and their
availability lists, and the SFTP private key stored unencrypted (a code finding, documented as such).

Suite changes: the three corrected tip stores joined `pnb_help_v2_touched()` (P7 now compares the 3 untouched
blocks: the home topic and the settings and snapshot tip stores) and four tokens removed on purpose joined
`pnb_help_v2_dropped_tokens()` (a formula dash, `=SUM()`, `strtotime()` twice). No check was weakened: P9 still
guards 3,820 fact tokens, L16 holds every rewritten topic to the tier lengths. Code-side findings (the hover
cards, a stale runner notice, the SSH key) are in the report and were not changed. The `php-error` mutant now breaks the one remaining writer gate of the Copy topic (its PHP-stub block is admin-gated), still red on L9 and E-php.

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
| L1-L20 `lint_help.php` | manifest<->files, guard, audience attributes = manifest, unique ids, every jump link resolves (cross-topic ones listed as info), every `data-target` / `openHelpCenter` / `#help=` / `openHelpPanel` reference resolves, every consumed tip key is defined (index.php + js/*.js), tags balanced, `php -l`, line endings, manifest sanity, canonical keys unique (L12), shims present, every `data-canonical-ref` pointer resolves into its canonical's topic (L14), one h3 and one close button per topic shell (L15), the reading budget on every `pnb_help_v2_standard()` topic (L16: paragraphs <= 80 words, bullets <= 50, cells <= 70, no em-dashes, no emoji headings), the Custom Code topic is the current render of `help/snippets.php` (L17), the registry's names are exactly the editor's function list (L18), no flex-div pseudo-table row in a standard topic (L19), the Ask fragment alone carries a script and it is the Ask client (L20). Then the budget table for every fragment as warnings. |
| E*/P* `equiv_help.php` | always: v2 body carries `data-audience`; blocks close; gate on: viewer / writer / admin see exactly their topic sets, inner "For Administrators" blocks hidden from viewers, TOC stars and legend follow; v2 forced off renders the v1 body (rollback). Phase 0: v1 == v2 block by block and TOC == TOC. Phase 1+: every v1 block, element id, tip key and TOC id survives (P1 P2 P3 P5), words within 85-105% (P6; floor 60% from phase 2), every topic the manifest does not list as touched is identical to v1 (P7), new topics are well-formed (P8). Phase 2+: every fact token of a touched v1 topic is still in v2 or listed as dropped (P9). |
| `visual_harness.php` | report only: renders one topic as the hub shows it and as the dashboard's help panel shows it, scrolled by N px, into static HTML for a headless Edge `--screenshot`; a probe badge prints the pane's scrollWidth / clientWidth so a horizontal overflow is a number, not a guess. |
| R1-R10 `retrieval_smoke.php` | chunks from the fragments with audiences; the v1 build still works and matches within 10%; a scheduling question lands on the Scheduler topic; a pasted SELECT retrieves nothing; the two versions use different cache files; in ask mode "how do i hide a column" lands on Your Settings while assist mode keeps its gate (R6, R7); in ask mode "is the IP address list enforced" lands on Security & Access with the IP Address List passage (R8), twelve data questions naming PI / ID / FY / DB retrieve nothing in assist mode (R9), a cache stamped with the previous `PNB_HELP_VER` is rejected and rebuilt (R10). |
| J1-J2 `jump_harness.ps1` | headless Edge over a mini hub with the navigation code LIFTED from the main.js under test (`lift_jump.php`): in-topic link stays put, cross link activates the owner (and its folded extras), link into an extra activates host + extra, deep link re-resolves the owner, folded topic opens at its own start, plain open unchanged. J2 runs the UNPATCHED main.js and must fail exactly T2-T5. |
| A1-A10 `ask_tests.php` | the Ask page's pure half (help/ask.php) against a scratch state dir and a stub model: help-only prompt, card cache, votes and retirement, limits, no-passage gate, audience filter, text-only answers, store integrity, validation, log (phase 6). |
| H1 `ask_harness.ps1` | the Ask client (js/penumbra_help_ask.js) in headless Edge against a stubbed endpoint: T1-T6 (phase 6). |
| `coverage_help.php` | report only: snippet functions, action types, URL parameters, single keys, View Options controls, scheduler labels, chart types, pivot aggregations, prompt tips vs the Query Prompts topic, hover-tip keys, topics without a `?` icon, each against the help. Writes `coverage_report.md`. |
| `-Mutants` | twenty-nine mutants in phases 2 to 6 plus the 2026-10-17 allow-list (wrong audience, dangling jump, missing fragment, duplicate id, unbalanced div, text drift in an untouched topic, anchor removed, dangling canonical ref, gate leak, shim removed, PHP error, a dropped fact token -> P9, a 90-word paragraph in a standard topic -> L16; phase 3: a cell over budget in the Scheduler book -> L16, the recipient-variables chart id `pnbRecipientVarsChart` renamed -> P2, the id an index.php icon targets (`dbDumpHelp-destination`) renamed -> P2 + L5; phase 4: a registry edit without a regeneration -> L17, a registry name that is no editor function -> L17 + L18; phase 4b: a flex-div row planted in a standard topic -> L19; phase 6: the Ask page's card cache, no-passage gate, text-only answer, day budget, audience filter, card audience and editor-rights notice, each -> its A-check; the ask-mode recall -> R6; 2026-10-17: the two-letter allow-list dropped from the tokenizer -> R8, the Ask-only tier let through to the assistant's question -> R9): each must turn its own checks red and nothing else. The phase 1 table (eleven) stays in run.php for a phase 1 tree. |

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

**Two-letter allow-list, deployed 2026-10-17 21:46 (commit b8540f3, pushed):** `help_retrieval.php` swapped by
`deploy_shorttok.ps1` (one MoveFileEx; guards: git clean for the path, live sha = the staged-from sha the patch was applied to,
set differs from live, no tmp file), then `prebuild_caches.php v1` and `v2` on live (VER 6, 1,242 and 1,309 chunks,
`match: true`; the web tier cannot write `cache/`, so without the prebuild every request would rebuild into %TEMP%),
`retrieval_smoke.php` against live R1-R10 green, the live module probed with the live caches (the IP question lands on
Security & Access with the IP Address List passage; "list all awards for pi id 12345" retrieves nothing in assist mode), no
new line in the PHP error log. Commit `--only help_retrieval.php cache/help_chunks.json` (the v2 cache is ignored; the v1
cache thereby also caught up with the help text of e66544c, whose VER 5 rebuild was still uncommitted on live). The suite
files (`retrieval_smoke.php`, `run.php`, `run.ps1`, `patch_shorttok.php`, this README) were installed on d$ the same minute.
Rollback = `git show b8540f3~1:help_retrieval.php` and `:cache/help_chunks.json` back over live by the same swap, then
`prebuild_caches.php v2` with the old module (a VER 5 module rejects a VER 6 cache and rebuilds into %TEMP% until then).
Re-staging, should the file move again: `patch_shorttok.php --from=<live copy> --to=<stage>` re-applies the four
exact-anchor edits.
7. Changelog artifact entry; `git commit && git push`. Add `help/v2.on`, `help/v2.off`, `help/gate.on`
   to `.gitignore` (added by the deploy commit) so a marker is never deployed by a commit.

**Deployed 2026-10-15 11:00 (commit 9fc7aa2; the README row's wording followed in the next commit), switch OFF.**
The deploy set was the stage plus the CURRENT live `js/main.js` with `patch_mainjs.php` re-applied (live had
moved on since the stage was cut): the +/- change set was proved identical to the stage's (sorted diff lines),
CRLF-only with its two NULs intact, and `orig2/` = live before the swap. Suite GREEN on the deploy set (J2's
control = the unpatched live main.js) and against live (`--app` = `--orig` = live; J2 then has no control).
Both caches were prebuilt from live afterwards (`prebuild_caches.php v1|v2`: stored signature == live signature).
Trap paid: the stage tree carries `help/v2.on`, and the recursive copy took it to live, so v2 was ON for about
two minutes (10:59:35 to 11:01:43) until the marker was deleted. Strip the markers from the deploy set before
the swap; `.gitignore` protects only the commit. Second trap: the Bash tool halves doubled backslashes in
command text and heredocs, so a deploy script written from Bash lost one of the UNC root's two backslashes
(the hash guard failed closed; repaired from PowerShell, where they survive).

**Phases 4, 4b, 5 and 6 were deployed 2026-10-15 14:36 (commit 79205b5); the switch was flipped ON at 15:59 (help/v2.on created on live, the hub and the Ask page verified in Chrome; rollback = delete the marker).** The deploy set was: `help/snippets.php` (new), `help/topics/optionsHelpLightbox.php`
(regenerated), `help/manifest.php` (phase 4: `optionsHelpLightbox` joins the standard list), the five phase 5 topics
(`powerFeaturesHelpLightbox`, `schedulerHelpLightbox`, `pivotBuilderHelpLightbox`, `promptsHelpLightbox`, `subqueriesHelpLightbox`),
`ai_system_prompt.php` (then `php renew_ai_cache.php`), the README row; phase 6 adds `help/ask.php`, `help_ask.php`, `help/topics/askHelpLightbox.php` and `js/penumbra_help_ask.js` (all new), `help_retrieval.php` (VER 5) and `help/manifest.php`. The help files are inert without the marker. Rebuild
the v2 chunk cache afterwards (`prebuild_caches.php v2`): the topics' text changed.

Deploy record 2026-10-15 14:36: 14 files swapped by `harness/deploy6_2026-10-15.ps1` (hash guard: every changed file's live
hash equalled its HEAD blob, the five new files were absent, no marker in the set or on live), the README row refreshed in
place, both caches rebuilt (v1 1240 chunks, v2 1274, VER 5, signatures matched), the suite green against live, commit
79205b5 pushed (my 17 paths only; `.gitignore` gained the three Ask markers). `renew_ai_cache.php` was NOT run: it needs
the server's local D: config path, it would re-snapshot the DDL from the databases and create a billed explicit Gemini
cache, and ai_assist.php sends the prompt inline (implicit caching), so the avg() heading is live at the next request.
