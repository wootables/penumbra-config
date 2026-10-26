# urlnum - a ?sort= level on a column named only in digits (2026-10-25)

A header click keeps jQuery's `data('colname')` value as the sort level's `colIdentifier`. For a column named
only in digits (a SQL PIVOT's `2021`) that is the NUMBER 2021, and the next click and the header menu's Clear sort
find a level by that value (`===`). The `?sort=` resolver (`_penumbraResolveUrlSortCriteria`) named the level with the
TEXT `'2021'`: a plain `?sort=` URL, a FLAT view link's sort (`v.o` rides as `?sort=`), and every re-run while `?sort=`
is in the URL. The state load's by-name pass (`_pnbStateSortByName`) kept the text, since it names its column. The
report opened sorted and marked (by the level's place), but the next click on the heading started over at ascending,
and Clear sort did nothing.

The fix (main.js):
1. the resolver names the level as the heading's `data()` reads it (`$('<th>').attr('data-colname', NAME).data('colname')`)
   when that is a NUMBER, else the text: `data()` parses a name like `[1]` as JSON - a fresh array per heading that no
   click finds, and that every reader taking the name as text (`String()`: "1") and the scheduler's PHP misread;
2. the by-name pass gives every level it keeps that form - one saved as text too (a save made from a `?sort=` view
   kept `'2021'`; the ldsort suite's `numsaved`) - its `heading()` likewise a number only;
3. `updateHeaderIcons`' pivot branch `String()`s an identifier before `.includes('::')` (hardening: no path of today's
   puts a number in a pivot's sort).

## Scenarios (fixture: vldigit's 60 rows + a column `0042`; `?id=unfix`)
| scn | what | checks |
|---|---|---|
| fA | flat, two clicks on 2021 (descending); the link built (Copy a link to this view) | A-click, A-built (GUARD) |
| fB | fA's link opened | B-sort (NEW: the number), B-marked, B-colsort (`data(colsort, 2021)`), B-nextClick (NEW: off) |
| fC | fA's link opened; the header menu's Clear sort (right-click, the item clicked) | C-offered, C-cleared (NEW) |
| uA | `?sort=2021` | U-sort (NEW), U-marked, U-nextClick (NEW: on to descending) |
| uB | `?sort=2021\|desc,V_NAME`, then a re-run (Run: no by-name pass) | R-load, R-rerun, R-nextClick (NEW), R-rows |
| uC | `?sort=0042\|desc`, then a re-run: a leading zero stays TEXT to `data()` | Z-sort, Z-rerun, Z-nextClick (GUARD) |
| uJ | a column named `[1]` too; `?sort=[1]\|desc`, a link made then, a re-run: TEXT (a number only) | J-sort, J-link, J-rerun (GUARD) |
| pA | a pivot report: its own heading sort; a numeric level beside it | H-pivot, H-ownSort, H-noThrow (NEW) |

P-* premises (`data()` hands 2021 back as the number, 0042 as text), E-* page errors.

## Runs
    py -3 run.py --stage DIR            DIR\js\main.js or DIR\main.js
    py -3 run.py                        live js\main.js
    py -3 run.py --control              live main.js while it lacks the fix (EXACTLY the 9 NEW red); refused once
                                        the fix is live: --control --rev <the fix commit>^ (from git). The installed
                                        copy's --control defaults to the deploy commit^ (install_tests.py writes it).
    py -3 run.py --stage DIR --mutants  urlstr (the resolver's text: R-rerun R-nextClick), keeptext (both halves:
                                        the 8 URL NEW), urlnumber (any digits a number: Z-rerun Z-nextClick),
                                        anyurl (the resolver keeps data()'s value whatever it is: J-rerun),
                                        anyheal (heading() likewise: J-sort J-link), pivstr (H-noThrow)
                                        - each EXACTLY its checks red

The ldsort suite carries the by-name half: numurl (the number; the next click takes it off) and numsaved (a level
saved as text), mutants ld-keepnamed / ld-urltext.
