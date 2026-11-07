# fbucket - a bucket of a column in a filter (2026-11-06)

**The ask (the user, 2026-11-06):** "expand the visual search builder to offer a second dropdown column when a
bucketable column is selected -- similar to grouping. This includes numbers/currency, columns detected with a
delimiter, and most importantly -- dates. This implies the UI should be widened for this scenario so no wrapping
occurs. Remember there is also a filter input in the scheduler that needs to match for scheduled tasks."

**The grammar.** A condition's column may carry one of the buckets the grouping offers, named the way grouping,
pivots and charts name it: `LOG_DATE:fy = FY26`, `{AWARD DATE:ym} >= 'Jan 2025'`, `AMOUNT:binlog = '100,000 – 999,999'`,
`PI_LIST:dsemi = 'Jones, Jacob'`. The condition reads the cell's bucket label (as the grouped view names the group) in
place of the cell's text; every operator reads that label as it reads a value. A list (a split by a delimiter) names
each value its cell holds: a positive operator holds when any passes, a negative one (`!=`, `!= /re/`) when every one
does. `>` `<` `>=` `<=` compare two labels in the bucket's own order (FY99 before FY01, Jan before Mar, a bin by its low
edge); a value that is no label compares as a value does. The name before the LAST colon must be a column and the whole
name must not be one (a column named `Q:fy` stays that column). Suffixes: the 11 date buckets (year fy yq fyq ym quarter
fquarter month monthnum dow hour), `bin` (auto width: the report's rows), `bin<width>`, `binlog`, `bins<e1_e2...>`, and
the six delimiter ids (dsemi dpipe dcomma dtab dnl dspace). No "active per" token in a filter.

**Where.** `js/main.js` (penumbraSearchBucketSuffix / Of / Labels / SortVal / Order / Test / Part, parse step 0b before
the `{COLUMN}` step, the evaluator's `condition.bucket` line, `__ROW`'s referenced columns, Find's terms skip a bucket;
`_penumbraSearchAPI.getBucketVariants` and `compareBucketLabels`; `_computeColumnAutocompleteValues` answers a token
with its labels) and `penumbra_search.php` (the `_search_bucket_*` twins, step 1a after the `{COLUMN}` step, the
evaluator, `_search_bucket_auto_widths` in `php_apply_search_filter`). The builder: `js/search_builder.js`
(`.sb-bucket-select` beside the column, syncBucketSelect / rowColumnToken / splitColumnToken / syncBuilderWidth) and
`css/search_builder.css` (`.sb-bucket-select`, `.sb-lightbox-content.sb-wide`).

## The suite

`corpus.json` (written by `mk_corpus.py`: 14 rows, 58 queries, 514 label cases; every date expectation is also worked
out by an independent Python oracle and the generator stops if they disagree).

| assert | what |
|---|---|
| H-boot | both halves booted, no page errors |
| B-&lt;slug&gt; | the browser (real main.js in headless Edge, `engine.html`) returns exactly the corpus's rows |
| Q-&lt;slug&gt; | the server (`php_side.php`: the real `php_apply_search_filter`) returns exactly the corpus's rows |
| K-&lt;slug&gt; | both engines name the same bucket token for every condition |
| L-parity | 514 texts x buckets: the browser's labels == the server's |
| R-parity | ...== the runner's own grouping labels of the text (pivot_split_bucket_label & co, via extract_mirror) |
| A1-A9 | the builder's API: value lists in the grouped view's order, a column's buckets (Bins baked to a width), compare |
| U0-U20 | the Visual Search Builder over CDP (`builder.html`: real main.js API + builder + markup + css) |

U-asserts: the dropdown per column kind (date, date-time, text, number, list), a bucket's value list and tip, no
calendar, a typed set, Filter + the engine on the box, reopen (set, braces, between + the range warning, contains),
the preset round trip, the Scheduler's builder (Insert), widening and narrowing, a bucket switch clears the value,
real clicks tick two labels, no wrapping at 1024 / 1280 / 1920 (one line, inside the dialog, the column / operator /
value boxes keep at least 85% of their room), a host with no getBucketVariants (the dashboard's filter) shows none.

```
py -3 run.py                        the live files
py -3 run.py --stage DIR            DIR\js\main.js, DIR\js\search_builder.js, DIR\css\search_builder.css,
                                    DIR\penumbra_search.php (missing -> live)              EXPECTED: GREEN
py -3 run.py --control              the four files at CONTROL_REV (the build before fbucket): see CONTROL below
py -3 run.py --stage DIR --mutants  every mutant: EXACTLY its asserts red (a server mutant reruns the server half,
                                    a browser one the engine page and the builder; the rest comes from one baseline)
py -3 shot.py --stage DIR --out DIR screenshots of the dialog (before / with buckets / a bucket's value list)
```

Needs py -3, websocket-client, the PHP 8.2 CLI. Stages into %TEMP% (pnb_fbucket_*); writes nothing to the webroot.
One headless suite at a time on this workstation: it waits while another runs.

**Traps.** The builder page stubs `window.stackHeaders` (main.js's resize handler calls the report page's header
stacker: U18 resizes). The value list scrolls: a real click must tick labels the list shows without a scroll. A
pre-feature build answers the API calls with '(none)': the A-checks read lists defensively.

## Phase 2 (2026-11-06): the filter boxes' lists, and the builder opened on a bucket row

**The ask (the user):** "This also implies also supporting it in the dropdown menu of the search bar similar to the
dropdown menus of charting". The report's filter box (`#tableSearch`) and the Scheduler's (`#schedSearchFilter`) list
each column's buckets right under it, as the chart builder's X-Axis list does (`AMT by Order of Magnitude`, an example
of the values muted after it); a pick writes the token (`AMT:binlog`, `{AWARD DATE:fy}`) and lists that bucket's
values; a typed token (`D:fy FY2`, `D:fy >= `, `D:fy` + Ctrl+Space) lists the bucket's values, not the column's; a
token's start (`D:`, `D:f`) lists the buckets it begins. A box of another kind (a chart's Filter Expression, a pivot
cell's, the dashboard's) lists none. The command palette's *Filter COLUMN by...* opens the builder through
`_penumbraSearchBuilder.openBucketRow(col, sx)` (the palette suite's `pfbucket` scenario covers the palette side).

| assert | what |
|---|---|
| D1, D15 | a column's buckets right under it, named as charting names them; indented 38px, a muted glyph, the example |
| D2, D3 | `D:` lists D's buckets alone (never ID's: a token matches from its start); `D:f` the fiscal three; a pick writes `D:fy`, lists its values, `FY26` completes it and the engine keeps the corpus's rows |
| D4, D18 | a name with a space: `{AWARD DATE:fy}`; an open brace typed before it (`{AWARD DATE:f` + Ctrl+Space) is replaced too |
| D5, D6 | the Scheduler's box lists them; a box of another kind lists none |
| D7..D11 | a typed token in each place the box reads a column (value, operator + value, operator + space, Ctrl+Space; an unfinished token + Ctrl+Space = its buckets) |
| D12, D19 | a column whose name holds a colon (`Q:fy`) stays that column; its name is never offered as Q's Fiscal Year (the box's list, the builder's dropdown) |
| D13 | the box ending with `D:fy`: the arrow's column (`trailingColumn`), Alt+Down lists its values; a plain box: nothing |
| D14 | a double-click inside `D:fy` selects the whole token; the list leads with it; a pick replaces it whole |
| D16 | a plain column (ID) as before |
| D17 | Alt+Down on the empty box: every column followed by its buckets; a pick from that list |
| O1..O4 | `openBucketRow`: the box's conditions kept plus the bucket's row (=), its value list open; an empty box: one row; no bucket: As is; the `splitColumnToken` export |
| D20 | the cost cap: with a reading of 60 ms a column the first list takes under 0.4 s (the buckets read in time); the reading goes on in the background, so a later list, the reading still slow, has every column's at once (under 0.15 s) |

The box checks type with REAL text input (CDP `Input.insertText`), keys (Ctrl+Space, Alt+Down) and clicks; the
harness upper-cases the header's names, so the colon column reads back as `Q:FY`.

**Why the cap.** Measured on live int-col-mat (27 columns, 3,241 rows): `getBucketVariants` for every column costs 331 ms
the first time after the data loads (15-20 ms a column even for text: the 2,000-value delimiter sample; a number column's
bins scan all its rows), 2.6 ms after. A 300-column report would hold the first list for seconds, so the box reads each
column once (a memo per attach; main.js re-attaches the box when the data changes), begins in idle moments when the box
takes the focus, and a list waits for it at most 120 ms. The palette does the same per open (its `fbSlow` check).

**Mutants (phase 2, 23, each red set predicted before the run and matched: mut2_predicted.json in the kit).** sb2-box
(no box lists buckets: 17 D-asserts), sb2-items, sb2-filter, sb2-tokstart, sb2-bk0..3 (one per detectValueContext
branch: D9, D10+, D8, D7), sb2-prefix, sb2-dbl, sb2-tokorder, sb2-brace, sb2-render, sb2-trail, sb2-taken / sb2-takenb
(Q:fy offered), sb2-row / rowlist / empty / export (O-asserts), sb2-budget / sb2-warm (D20), css2-indent (D15). A builder
or css mutant reruns the builder page alone (the engine page loads neither). `--mutant A,B` runs a list.

**Control.** CONTROL_REV stays the build before fbucket: every new assert red there but D6, D12, D16 (they need nothing
of the round). `--rev 4b725a0` (phase 1 alone) gives the same new reds.
