# jsongroup - grouping by a nested @@JSON sub-column (2026-09-30)

**The bug.** `rebuildGroupedView()`'s virtual (@@JSON) path read each flat row's
nested data as `masterRowData[its position in the tbody]`. A flat sort moves the
`<tr>`s in place, and an open journal note row inserts a `<tr>` with no `'#'` cell,
so after either one most rows were grouped by ANOTHER row's nested table. The
summary pre-sort ("Sort groups by Summary" on a nested summary column) did the
same. The "of N" totals were right, because a walk over every row is order-free,
so nothing looked off. **The fix:** all three passes resolve each row by its own
`'#'` cell (`_pnbLazyRowIndex`), like every other masterRowData reader.

**The suite.** `harness.html` boots the REAL main.js through the real run path
(stubbed query.php) on a 240-row fixture. `J_SUBS` holds 1-3 nested rows of
SUB_NAME / SUB_AMT / SUB_ROLE, plus edge rows: a blank name, a padded name, a
name twice in one row, a null cell and an empty `@@JSON[]`. `driver.js` reorders
the flat table the way a user does, groups through the REAL dialog (Group icon,
picker, Apply Grouping) and checks every band against ground truth computed from
the fixture alone. Each row is identified by its `'#'` cell.

| scenario | what reorders the flat table | grouping |
|---|---|---|
| plain | nothing (old and new mappings agree: proves the truth model) | SUB_NAME |
| sortload | a SAVED sort (V_AMOUNT desc, the on-load sort) | SUB_NAME |
| clicksort | a header click (V_NAME) | SUB_NAME |
| sortsearch | saved sort + flat search `V_STATUS = 'Open'` | SUB_NAME (matching rows only) |
| noteopen | a journal note row open under row 5 (no sort) | SUB_NAME |
| sumsort | saved sort | V_REGION, Sum of SUB_AMT (nested), sorted by summary desc |
| sumsortboth | saved sort | SUB_NAME, Sum of SUB_AMT, sorted by summary desc (order asserted since 2026-10-01) |

Asserts: `P-*` premises ('#' = fixture row, the sort or note row really happened,
the bands are on the asked column), `M-*` membership, `C-*` completeness, `T-*`
"of N" totals, `V-*` summary values, `S-sumsort` / `S-sumsortboth` band order, `E-*` page errors.

```
py -3 run.py                        # live js\main.js                  -> 59/0
py -3 run.py --candidate <main.js>  # a stage build
py -3 run.py --control              # newest js\main.js.bak-*-jsongroup: EXACTLY the 13 CONTROL_RED fail
py -3 run.py --mutants              # posgroups (11 red), possumsort (1), uncorrsumsort (1), eq-postotals (all green)
```

**Fixed 2026-10-01 (`grouprank`):** in `sumsortboth` the bands used to be ranked on
the sum of ALL of a member row's nested SUB_AMT while each band SHOWS only its own
name's share (and the runner ranks on that share). The pre-sort now correlates like
the band header; `S-sumsortboth` asserts the order, mutant `uncorrsumsort` breaks it,
and the driver still records `orderMonotonic` / `orderByLoose` as observations.

`deploy.ps1` / `rollback.ps1`: the atomic-deploy recipe for this change
(hash-guarded, `.bak-<stamp>`, MoveFileEx), manifest in `deploy\<stamp>\`.
