# digitcol - columns named only in digits (2026-10-25)

**The bug.** jQuery's `.data('colname')` converts what it reads: a header whose column is
named only in digits - `2021`, as a PIVOT query yields - comes back as the NUMBER `2021`.
Every reader that then called a string method on it threw, and every reader that used it as
a key into the (text-keyed) row maps, or compared it with `===` to a typed name, misread the
column. The one found first (nestgb's review): on a report with such a column and a
nested-table (`@@JSON`) column, `getColumnsForGrouping()` threw, so the grouping dialog
never opened (`search_builder.js` `getAvailableColumns` upper-cased every name; main.js's
own list did the same without the search builder). The same report could not render its
report snippet at all (`renderReportSnippet` threw at load), and every `format()` /
`rewrite()` pass, `data(colorder | colvisible | colsort | coltotal)`, the scheduler's
change-column list, the `group|` / `sort|` / `copy_distinct|` / `pivot|` commands and the
nested-column plan behind Copy with Custom Template broke or misread the column.

**The fix.** Each reader that needs text String()s the name where it reads it (main.js x21,
search_builder.js x1); where a reader skipped an empty name it still tests data()'s own value, so
no picker gains or loses a column. One picker lists more: a numeric column named in digits gets the
grouping picker's bin entries, as any numeric column does (plainsb pins it; the number found no
values for the bin test before). The sort identifier a header click keeps stays data()'s own
value, as `_pnbStateSortByName`'s comment says (the `sort|` command keeps it too - only its
name match String()s; mutant `cmdsortstr` guards that).

**The suite.** `harness.html` boots the REAL main.js through the real run path (stubbed
query.php) on a 60-row PIVOT-shaped fixture: `2021`, `2022` (integer-like keys lead a JS
object, as they do when the browser parses query.php's JSON), `V_ID`, `V_NAME`, `V_STATUS`
and `J_SUBS` (@@JSON). `driver.js` drives each reader through its real entry point or, for an
internal one, through the eval export hook (jsongroup's).

| scenario | what | asserts |
|---|---|---|
| dlg | the Group icon -> the dialog (no search builder: main.js's own list) | P, G-dlg-open / -list / -by2021, E |
| dlgsb | the same with search_builder.js, as index.php loads it | P, G-dlgsb-*, E |
| plainsb | no nested-table column (the dialog opened before the fix): the same columns in the same order, and the one listing change - a numeric column named in digits (2022) gets the bin entries a numeric column gets (V_AMT) | P, G-plainsb-open / -list / -buckets, E |
| sweep | format() + rewrite() rules on plain columns, the readers one by one (the Copy dialog's distinct values of one column through its real Copy button), the commands (pivot\| up to the builder: no Generate button here) | P, F-cf, F-rw, U-*, K-*, E |

`P-*` proves the premise on every run (data() really hands back the number 2021).

```
py -3 run.py                        # live js\main.js + js\search_builder.js
py -3 run.py --stage DIR            # DIR\main.js + DIR\search_builder.js
py -3 run.py --control              # the pre-fix build: EXACTLY the 29 CONTROL_RED fail (P-* pass).
                                    # LIVE since 306438e (2026-10-25): the control is 306438e^, read from git
py -3 run.py --stage DIR --mutants  # 21 mutants, each one fix site put back -> exactly its asserts red
```
A clean run is 36 asserts (dlg 5, dlgsb 5, plainsb 5, sweep 21). The sweep's fixture adds 2023, a
nested-table column named in digits (U-nestplan: the plan Copy / Download read keeps its name as text).

Run from a LOCAL cwd copy or `cd` into this folder first (Git Bash mangles a `\\server\d$`
argument to `py -3`). One headless suite at a time on this workstation.

Not exercised here (inspection + review only): a snapshot comparison's search
(`runTableSearch`'s comparison branch) and the pivot cell drill-down - each is the same
one-token String() as a tested site (the chart drill breakdown's twin is U-chartdrill).

Mutants whose red set is wider than their own assert: the format() / rewrite() passes and the
snippet render run again on every redraw (a sort, a grouping, a copy's notice), so `cfmeta`,
`rwmeta` and `snippetcols` redden the K-* commands too; `sbapi` reddens `K-group` (the group|
command reads the grouping picker's list).
