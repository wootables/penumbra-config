# parens - parentheses group conditions in the filter text (2026-10-30)

## Phase 1 (live 778acc9): the three engines

**The change.** `(A or B) and C` used to be search text in every engine: `(A` a literal (or a
column-less word), `C)` a value. Now a `(` or `)` is a token of its own when it sits outside
quotes, `/regex/`, `//exact//` and `{column}`, is not a value that starts with `(` (the token
after an operator: `D = (x)` keeps its parens, `D = x)` gives its closer up), and every opener
has its closer. A group is reduced on its own (AND first, then OR) and stands as one result in
the list that holds it; groups nest; a one-part group is that part; an empty group is nothing;
a dangling `and` / `or` inside a group is dropped. Unbalanced parens read exactly as before.

The same rule in the three engines: `js/main.js` (`penumbraSplitParenTokens`, the stack in
`parseAdvancedQuery`, the `group` branch of `evaluateParsedQuery`), `penumbra_search.php`
(`_search_split_paren_tokens`, `php_parse_search_query`, `_php_evaluate_search_row_with_virtual`)
and `schedule_runner.php` (`_cf_split_paren_tokens`, `parse_format_condition`,
`evaluate_format_condition`). The walkers that used to read the flat list by position go
through groups too: the `__ROW` column collectors (both engines), the group-summary splitters
(both), the pivot search's source / aggregate split and its twin (a group holding both sides
is not split: the whole query goes to the post-filter), the highlight rule's pivot-only check,
the find host's terms, the server's journal toggle normaliser, the subscription-condition
validator (`penumbraSubCondCheckList`).

**The suite.** `corpus.json` (8 rows, 27 queries, each naming the rows it must return) goes
through all three engines: `harness.html` boots the real main.js in headless Edge, `php_side.php`
runs `php_apply_search_filter` and the scheduler's `parse_format_condition` +
`evaluate_format_condition` through a mirror that `pivotparity\extract_mirror.php` lifts out
of schedule_runner.php (never the runner itself: it opens Oracle and sends email).

| assert | what |
|---|---|
| H-boot | the browser half booted; its column list holds `#`, `K`, `V` |
| B-slug / Q-slug / F-slug | the browser / the search engine / the format engine return exactly the expected rows |

A query marked `paren` is one the old engines got wrong, so the CONTROL (the three files at
10d2ee6) is red exactly there. `noFormat` marks the nested-column queries the format engine
does not read. Two grouped queries carry no `paren` mark on purpose: the old engines read
`C = yes)` as `C = yes` (the text equality strips punctuation), so they came out right before.

```
py -3 run.py --stage DIR              DIR\js\main.js, DIR\penumbra_search.php, DIR\schedule_runner.php: GREEN
py -3 run.py --stage DIR --control    the files at 10d2ee6: EXACTLY the paren asserts red
py -3 run.py --stage DIR --mutants    10 mutants, each EXACTLY its asserts red (3 on main.js re-run Edge)
```

## Phase 2: group rows in the Visual Filter Builder (`js/search_builder.js`)

A row's `( )` toggle (beside its and / or; row 1 keeps the slot hidden, like its joiner) groups
it with the row above. A run of grouped rows and the row above the first of them is ONE pair of
parentheses on the wire, attached to what precedes it by that first row's joiner; the joiners
inside the run are the rows' own; a bar down the left (`.sb-group-head` / `.sb-grouped` /
`.sb-group-last`, set by `markGroupRuns` from `renumberRows`) shows the run. `groupItems(parts,
join)` folds the emitted parts into items for `buildQuery` (joinParts inside) and
`buildDisplayQuery` (bracketAndRuns inside, so the preview keeps its reading-aid brackets at
each level). The reverse parse (`splitGroupedQuery`) reads one level of groups from the text by
the engine's own paren rule; a group of one row is that row, an empty group nothing; the engine's
parse (`sbQueryGroupLevel`) decides whether the text groups at all when it is on the page. A
filter that nests groups inside groups opens as TEXT: `_sbGuard`, the notice in the footer gap,
Filter disabled, lifted by Clear All or a new condition. Presets save and load `grouped` per
condition (older presets load ungrouped). The box's column autocomplete sees past an opening
paren (`trailingColumnOf`).

```
py -3 builder_run.py --stage DIR --all   builder.html drives the real builder: 48 asserts GREEN;
                                         the phase 1 builder (778acc9) EXACTLY its reds; 3 mutants EXACT
```

`builder.html` boots the real `js/search_builder.js` with the real lightbox markup, a stubbed
engine (`_penumbraSearchAPI.parseQuery` answers as `window.__engine` says: none / one / nested,
or is removed for the text-fallback cases) and a stubbed `PenumbraPresets` whose `create`
captures getState / applyState for the preset round trip. Cases: g1 group rows from text, g2 a
row joining the group (preview + the wire text after Filter), g3 a row leaving it, g4 / g5 a
nested filter as text (with and without the engine), g6 group rows without the engine, g7 a
paren in a value, g8 an unbalanced paren, g9 the preset round trip, g10 the head row removed,
g11 a group of one row, g12 spaced parens.

**Traps.** The first value-slot rule kept every token after an operator whole, so `yes)` never
gave its closer up and no group ever closed: the engine suite's first run was red everywhere.
A mutant on the `__ROW` collector needs a query whose EVERY nested condition sits inside the
group. The builder harness must stub every `PenumbraPresets` method and every method of the
chip it returns (`refresh`, `setLoaded`), and `getState()` is null while a guard is up (the
phase 1 control crashed the harness until the round trip tolerated that). A mutant that drops
the parens on the wire cascades: the next case reopens the unparenthesised text while the engine
stub still says "group", and that filter opens as text.

## Phase 3: an `or` filter is wrapped when a condition is added (`js/penumbra_tiles.js` and its callers)

The one splitter, `splitTopLevel`, reads a group in parentheses as ONE part by the engines' paren
rule (`fsParenPieces`: outside quotes, regex, exact literals and braces; not on a value that
starts with `(`; balanced). `fsWrapSplit` reads a text whose top level an `or` joins as one part,
`(body)`, so the strip's state and its `has` / `add` / `remove` compose with `and` as for any
other text; `fsUnwrap` takes the parentheses off again when the last added condition goes.
`condParts` reads a condition that says `or` (a button, a switch) as one condition in
parentheses. Callers that used to refuse: the strip's chips, buttons, range boxes and lists
(main.js `_pnbFsGroups` / the strip render no longer pause on `or`), the toggle's `filter|` step and its authoring check (`_pnbFilterStepProblem` accepts an `or` condition),
the column menu's Show only (`cmpShowOnly`, through `PenumbraTiles.strip.add`), the grouped band
(`_gmShowOnly`), Find's Filter to N rows (`promoted`), the palette's Filter rows, the dashboard's
cross-filter clicks, chips and switches (`controls` no longer pause; a switch condition may say
`or`). The dashboard's per-tile ROUTING of an `or` filter (`searchSpecFor`) is unchanged.

The behaviour is pinned by the owning suites, not here: **filterstrip** (split / has / add /
remove / unwrap cases, the pause asserts turned into wrap asserts, mutants `fswrapblind` and
`fsparenflat`), **cmpmenu** (C27: Show only wraps the `or` query; mutants `k-noor`, `k-onlyadd`
re-anchored), **dashsearch** (a click under an `or` filter wraps it; the Controls tile's `or`
section wraps instead of pausing; the switch refusal case moved to a modifier; mutant `ctlor`
retired, its mutation being the code now).

**Phase 3 harness traps.** A step that follows an `F.exec(...)` must wait on `!F.busy() && !F.motion()`:
`F.motion()` alone resolves before the search runs (the box text changes at once, the applied search
later) and the next click is dropped by the strip's busy guard with no error anywhere. main.js
replaces `window.onerror` for its telemetry, so a harness collects errors with
`addEventListener('error')`. Unpausing the strip on `or` lets a focused range box commit its stale
value when focus leaves (`AMOUNT >= 5 and (the or query)`): a search the next step must let settle.
The dashsearch link scenario's fake backend (`filt`) knows one wrapped group now.

## Sweep (2026-10-31): what the adversarial pass found, and what pins it now

Four defects in the three phases, fixed in one round: an empty group between two conditions
left a doubled `and` (read as no match) - the word after a group now takes the joiner the group
left behind; the month-name date join ran before the paren split, so `(E >= Feb 2025)` lost its
year - the `contains` normalisation and the pre-pass run first; `({ A } = 1 ...)` was cut into
`{`, `A`, `}` - the pre-pass joins a brace name the opener cut open; the builder's text splitter
leaked a group's last `or` onto the row after it; and the pivot search's unsafe split (a group
holding a source and an aggregate condition) dropped a source condition outside the group - the
whole query now reaches the post-filter.

| file | what |
|---|---|
| `corpus2.json` | 33 adversarial queries through the three engines (`py -3 run.py --corpus corpus2.json`); `expect: null` = parity only |
| `walkers.py` | the tree walkers agree between the engines: the group-summary split, the pivot side, the collapse, the leaves, the toggle normaliser |
| `builder_fuzz.py` | 20 texts: text -> rows -> wire text is a fixed point (no engine on the page) |
| scratchpad `strip_units.py` | 32 unit cases on the strip library's pure functions |
| scratchpad `perf_probe.py` | 20,000 rows: flat 31 ms, one group 25 ms, nested 39 ms |

**Pre-existing, left alone (not grouping):** the PHP engines' `=` strips punctuation (`COL = yes)`
matches on the server, not on screen); two hand-typed `!/` operators in one query merge into one
regex token (the builder never writes `!/`); a leading `or` is a search term; a global word reads
inside `@@JSON` text on the server but not on screen; the pivot search's source / aggregate
`unsafe OR` scan tests `.operator` on nodes that carry `op` (dead since written; a mixed group
sets the flag directly); the pivot_trigger bin round-trip asserts fail on the pre-feature build
too; the palette's Jarvis rows depend on the environment.
