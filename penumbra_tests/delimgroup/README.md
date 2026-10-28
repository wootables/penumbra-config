# delimgroup - group by a column split by a delimiter (2026-10-26)

**The feature.** Group mode groups a text column whose cells hold a LIST by each value in it:
`PI_LIST:dsemi` puts a `Lname1, Fname1;Lname2, Fname2` row in both names' groups. The token
names the delimiter, never the character: `:dsemi` (;) `:dpipe` (|) `:dcomma` (,) `:dtab`
`:dnl` (new line) `:dspace`. A comma separates grouping levels, a pipe separates snippet
arguments, a colon starts a bucket, and white space is trimmed off every token.

- **Split rule** (main.js `groupDelimPieces`, schedule_runner.php `penumbra_group_delim_pieces`,
  identical): `@@HTML` and tags off, split on the one character (a new line = `\r\n`, `\r`, `\n`;
  a space = a run of spaces), each piece trimmed of ASCII white space only (PHP `trim()`'s set:
  a no-break space stays), empty pieces dropped, a value the cell repeats counted once. A cell
  with none lands in `[Blank]`. Read from the DATA (`masterRowData` by the row's own index), as
  the runner reads it, never the rendered text.
- **Offered only where it groups** (`_groupDelimVariantsFor`): text columns only (dates and
  numbers have their own buckets, a nested table its own columns); 2+ cells (and 5%) hold two or
  more values; fewer distinct values than distinct cell texts; not a delimiter inside most values
  of one already offered (the comma in a semicolon list of "Lname, Fname"); a space only when no
  other delimiter qualifies, half the cells hold several words, at most half as many words as
  texts, and 80% of memberships land in a word another row shares.
- **Where:** the dialog's pickers (every level) list `↳ COLUMN split by ;` like the date and bin
  entries; the header menu's Group by is a list (As is, then the column's buckets) wherever the
  dialog offers buckets; `group_by|COL:dsemi` resolves like a bucket token. Copy distinct values
  gains a pipe (`DELIMS`, flat + nested + band menus; the palette's `copy-pipe` exemption).
- **Totals count each row once** (the user's call; a nested @@JSON grouping since jsontot too): the All groups bar, the status bar's rows,
  the (Other) rollup, `countMatchingRows` and the summary preview's rows. Group pills count a
  row in each of its groups. **Shares:** no % of parent on a split level's bands, no % of total
  at or below the outermost split level. The hide-group x is withheld (as for buckets).
- **Runner:** `pivot_parse_field_token` returns `delim`; `penumbra_group_level_spec`'s label
  returns an ARRAY for a split level and `penumbra_group_rows_nested` files the row under each.
  A split level tags each row with `PENUMBRA_GROUP_ROWID` until the (Other) rollup and the row
  count have seen it once; `penumbra_grouped_row_total` gives the three "N total rows" texts the
  distinct count for that very map.
- **Not split (yet):** a pivot field reads such a token as the plain column.
- **(splitviz, 2026-10-26) Charts and the value lists split too.** A chart's X axis or series `PI_LIST:dsemi`
  draws one bar per value (`vizBucketRowsForAxis` gives a row one copy per value it lists; the bars count
  listings, and the builder's note under the X axis says so); a click, the breakdown, a drill and the filter
  panel keep a report row when ANY of its values matches (`_chartDrillKeep`), the panel redraws from the value
  rows so an unchecked value goes alone; View in table is the filter strip's list-item condition
  `PI_LIST = /(?:^|;)[ \t\n\r\x0B]*(?:A|B)[ \t\n\r\x0B]*(?:;|$)/` (`PenumbraTiles.strip.itemCond`), which both
  search engines read alike. Charting a grouped view keeps its split. `filter_strip()` takes a `split` /
  `split=semicolon|comma|pipe|tab|newline|space` field (chips per value, counted by the rows listing it; a
  dashboard Controls tile refuses it); Column stats lists a list column's values (its Most common filters to the
  rows listing one) and gives a list of numbers no total; Copy distinct values gains Each value in the lists.
- **(splitviz) The list rule's fixes, measured on live reports:** a cell is read as the search reads it, entities
  decoded first (`Health&amp;Pathobiology` holds no `;`; the runner's twin `penumbra_delim_decode_entities`); ONE
  split per column (the first of ; | , tab new line that qualifies, space last); comma cells that always hold
  exactly two parts are a pair, not a list (`New, logged 2021-03-29`, `Last, First`); a comma list with more values
  than lists qualifies when its lists take 3+ lengths of single-word values (project numbers); a number column is
  read too (a list of numbers is a list; thousands commas are not); a list column offers its split, not bins.
- **(cfread, 2026-10-26)** the runner's twin `penumbra_delim_decode_entities` is now penumbra_search.php's
  `_search_decode_entities` (proven against main.js by ..\srchent): two split cases pin it - a surrogate pair of
  entities makes one character (the old twin dropped both halves) and a code of 16+ decimal / 14+ hex digits rounds
  as parseInt does (mutant `xdelimown` puts the old twin back: X-pieces red). Half a pair alone reads U+FFFD on the
  server and stays a lone UTF-16 unit on the page (the same mark; JSON cannot carry the lone half to PHP, so no case).
- **(sparse, 2026-10-27)** a list few cells hold two values of is offered its split when those cells are PACKED - no
  white space but the delimiter, the way a query folds codes (`?id=dirsearch`'s JOBCODES_ALL `H865|TSW912`: two jobs
  for 3.6% of people, under the one-in-twenty floor; prose puts a space after its punctuation). Measured on live: the
  two dirsearch columns gain the pipe split in every college subset; no other column of dirsearch, cvmnihusda,
  int-col-mat, dodnsa, nihpis, jjornl or grantprofiles changes. D-packed D-packednl D-spaced D-onelist; mutants
  packedfloor packedws packednl twolists. main.js alone; the runner reads a saved token and detects nothing.
- **(cpsplit, 2026-10-27)** Each value in the lists beyond the header menu (scenario `copy`, Q-*): the Copy dialog's
  Copy Single Column (Distinct) shows the box for a list column only (Q-box), copies each value once when ticked
  (Q-copy), reopens as the last copy had it (Q-remember); the header menu's split list gains Other..., which opens
  Copy with the box ticked (Q-other); `copy_distinct|PI_LIST:dsemi|delim` copies each value once, a new-line list
  read as stored (Q-trigger Q-trignl); Copy snippet writes that token (Q-snippet). Mutants dlgsplit dlgbox
  dlgremember dlgrestore otherbox cmother trigtok trigsplit trigraw snippettok; copysplit re-anchored on
  `if (_splitId) {`. (A chain's tooltip text is built by describeTrigger but never put on the link: no check.)
  The Copy list's names (the user): a value copy named by the value, cut to 28 characters, an empty one (blank);
  the column's name, named by itself (fltmenu, 5eae534: above This entire row); This entire row; Distinct column
  values (Q-labels; mutants vallabel valcut valblank rowlabel distlabel). The long
  names (an item alone, the palette's rows) stay Copy this value / Copy this row / Copy distinct values.
- **Known, not this suite's:** the server search (penumbra_search.php `_search_get_cell_value`) does not decode
  entities as the browser's does, so a condition on `Crop & Soil` misses a cell holding `Crop &amp; Soil` in a
  scheduled send; X-search keeps to cells without entities.

**The suite.** `harness.html` (built by `mk_harness.py` from digitcol's page shell) boots the REAL
main.js and penumbra_colmenu.js through the real run path on a 60-row fixture. `driver.js` computes
the ground truth from the FIXTURE with its own copy of the split rule.

| scenario | what | asserts |
|---|---|---|
| unit | the split rule (PIECE_CASES), the token, the label, the spec, which delimiters each column offers, the dialog's entries | U-* |
| render | the dialog -> PI_LIST:dsemi + Sum of AMT: bands, rows, totals, shares, status bar, chart, preview, a search, countMatchingRows, top 2 + (Other), a custom order | G-*, C-viz, K-count |
| nested | STATUS then PI_LIST:dsemi: sub-bands, shares, totals, path totals under a search | N-* |
| menu | Copy distinct values' pipe; Group by's list on a list / plain / date column, the tick, As is | H-* |
| snippet | `group_by|pi_list:dsemi` from a trigger link | K-snippet |
| bucket | countMatchingRows' groups under AWARD_DATE:month (it read the token as a column before) | K-bucket |
| (grpbucket, 2026-10-26) | unit: LEADS (shaped like ?id=jjornl's PI_LIST: more people than lists, each in 3 rows) offered, MEMO (prose ;) not; render: the column list holds columns only, each column's second dropdown (#groupingBucket1) offers As is + its buckets and follows the column; nested: level 2's split through its dropdown, the browser's XLSX outline ends on the All groups bar; bucket: reopening on a token shows the column and its bucket, a fixed width too; php: the outline sheet's footer and parent bands count each row once, also after a recipient's filter and a summary filter, stale indexes refused | U-detect, G-picker, G-closed, G-follow, B-xlsx, G-reopen, G-reopenbin, X-xfoot, X-xband, X-xfilter, X-xsumfilter, X-xstale |
| json | (jsontot, 2026-10-26) the fixture plus J_SUBS (@@JSON, 0-3 rows of SUB_NAME): grouped by SUB_NAME, each row once in the All groups bar, the status bar, the summary preview, countMatchingRows and (Other); no shares | P-jbands, J-*, K-jcount |
| detect | (splitviz) DEPT_ENT (an entity's ;), TRANS (type, date pairs), PROJS (a comma list of numbers: offered, not bins), TITLE_C (titles with commas), AMT_K (thousands commas) | D-* |
| chart | (splitviz) the value rows, the builder's count / sum / series, a click's rows and its View in table, an unchecked value, the chart note's key, the builder's lists and note, the report's REAL vis() chart: its bars, a click on a bar (the drill popup's scope), its filter panel | V-* |
| lists | (splitviz) Column stats on PI_LIST and PROJS, its Most common click, Copy distinct values' Each value in the lists, the strip grammar's split, the report's filter_strip() chips: counts, a click, a second value, the item searches the browser finds | L-* |
| php | `php_check.php` on the runner's mirror, against the browser's own fixture and bands; (splitviz) the lists scenario's item searches through penumbra_search.php | X-* |

```
py -3 run.py                        # live js\main.js + js\penumbra_colmenu.js + schedule_runner.php + js\penumbra_tiles.js
py -3 run.py --stage DIR            # DIR\main.js + DIR\penumbra_colmenu.js + DIR\schedule_runner.php + DIR\penumbra_tiles.js
py -3 run.py --control              # the build before the LATEST round (splitviz): EXACTLY CONTROL_RED_LATEST fail
                                    # (28; explained beside it in run.py); after its deploy CONTROL_REV from git
py -3 run.py --stage DIR --mutants  # 81 mutants, each one fix site put back -> exactly its asserts red
```
A clean run is 114 asserts. Earlier rounds' controls were run at their deploys: the split round (e69cea1^, exact),
jsontot (881c6b5^, exactly its 9 checks), grpbucket (815d7ac^, exactly its 35: CONTROL_RED_GRPBUCKET); --control now
runs the latest round's only. The chart scenario loads the chart libraries main.js asks for from the app's js\. Run from a LOCAL cwd copy or `cd` into this folder first. One headless
suite at a time on this workstation.
