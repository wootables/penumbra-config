# vldigit - a view link's sort on a column named only in digits (2026-10-25)

**The bug.** A header click keeps jQuery's `.data('colname')` value as the sort level's
`colIdentifier`, and for a column named only in digits - `2021`, as a PIVOT query yields -
that is the NUMBER `2021` (on purpose: see the comment above `_pnbStateSortByName` in
main.js; the digitcol round kept it). The view link's one validator, `_pnbViewLinkClean`,
runs when "Copy a link to this view" builds the link AND when the link is opened, and its
grouped / pivot sort filter (`d.sc`) passed every `colIdentifier` through `_pnbViewName`,
which takes strings only. So a grouped (or pivot) view sorted by such a column was linked,
and opened, without that sort level; the other levels came through.

**The fix.** In that filter only: a finite number passes on its text and stays a number
(the next click on the heading and the header menu find the level by that value: a level
restored as the text "2021" would make the click start over and the menu's Clear sort do
nothing). Anything else must still be a name: tag-shaped text (refused before, by
`_pnbViewData`), oversized or empty text, and every other kind of value (an array, `true`,
`null`, an object, a missing one, `1e999` = Infinity) are refused - a link is anyone's
input to any viewer.

**The suite.** `harness.html` boots the REAL main.js through the real run path (stubbed
query.php) on the digitcol suite's fixture without its nested-table column: 60 rows of
`2021` (three values: many ties), `2022`, `V_ID`, `V_NAME`, `V_STATUS`.

| scenario | what | checks |
|---|---|---|
| gA | report grouped by V_STATUS; clicks: 2021 twice (descending), Shift+click V_NAME; the link built by the real builder; then one more click on 2021 | P-gA, A-click, A-built, **A-carries**, A-nextClick, E-gA |
| gB | gA's link opened on the report (flat, no sort of its own) | P-gB, B-applied, **B-sort**, **B-marked**, **B-rows**, **B-nextClick**, **B-rtView** (gA's link carries 2021 as the number AND gB captures the same view again, compared in run.py), E-gB |
| gC | the validator alone, on tokens made in run.py: 14 levels (numbers, text, refused kinds) and a pivot view's | C-decoded, **C-numbersKept** (levels 0-4), C-textKept, C-refusedText, C-refusedShape (both judge a decode that kept the text levels), **C-pivotKept**, E-gC |

Bold = NEW (red on the build without the fix); the rest are GUARDs (green on both).
`P-*` proves the premise on every run (data() hands the grouped 2021 heading back as the number).

```
py -3 run.py --stage DIR            # DIR\js\main.js or DIR\main.js; refuses to fall back to live
py -3 run.py                        # live js\main.js
py -3 run.py --control              # the build without the fix: EXACTLY the 8 NEW checks red.
                                    # LIVE since 0a37b30 (2026-10-25): the control is 0a37b30^, read from
                                    # git (--rev REV for another build; one with the fix is refused)
py -3 run.py --stage DIR --mutants  # 4 mutants, each turning EXACTLY its checks red
```

| mutant | the fix undone as | red |
|---|---|---|
| numdrop | numbers refused again (the build before) | the 8 NEW |
| strfix | the level kept as TEXT (String() before validating; String() also turns a missing identifier into "undefined") | A-carries, B-sort, B-nextClick, B-rtView, C-numbersKept, C-pivotKept, C-refusedText, C-refusedShape |
| anyshape | "not text = a number" (the global isFinite() coerces an array, true, null) | C-refusedShape |
| nolen | text unchecked (oversized and empty names pass) | C-refusedText |

A clean run is 21 checks. Headless Edge over CDP; stages into `%TEMP%\pnb_vd_*`; writes
nothing to the webroot. Run it from this folder (`cd` first: Git Bash mangles a
`\\server\d$` argument to `py -3`). One headless suite at a time on this workstation.

Not covered (by design): a Penumbra PIVOT view's own header sort keys off the pivot heading's
TEXT (`click.pivotSort` builds the identifier from `.text()`), so a pivot view sorted by its
`2021` heading always linked fine; C-pivotKept shows a number in a pivot view's sort (a stale
level from the table under it) is kept too. A FLAT view's sort rides as `?sort=`, whose
resolver names the level with the STRING `'2021'` (ldsort `numurl` pins that as it is).
