# msheet - multi-worksheet imports (2026-10-02)

A workbook dropped on the page used to import its FIRST sheet only. Now every
VISIBLE worksheet holding a header row and a data row is read:

- **one** such sheet imports exactly as before (no new column, flat view);
- **two or more** are STACKED into one table: the tab name in a `WORKSHEET`
  column first, then the union of the sheets' columns (blank where a tab lacks
  one), and the import opens **grouped by `WORKSHEET`**, one band per tab in
  **tab order** (written as the column's custom sort order, so it is saved with
  the report);
- **none**: the old reader's answer, first sheet hidden or not, with its old error.

Hidden tabs are skipped (`.ods` excepted: SheetJS cannot see an ODS sheet's
visibility - `J-ods` pins that). A tab with its own `WORKSHEET` column keeps it;
ours becomes `WORKSHEET_2`. An oversize stacked workbook is refused before
anything is saved. Code: `js/main.js` `parseXLSXToObjects` / `importFileData` /
`_importArmSheetGrouping` + the `pendingImportSheetGroup` hook in the
`#executeQuery` view stash; the TWIN is `shared_logic.php` `parseImportXlsx` /
`parseImportXmlSpreadsheet` / `_importStackSheets` (the `imports/` folder reader).

**Found building this suite:** the old `imports/` reader took the first worksheet
RELATIONSHIP in `xl/_rels/workbook.xml.rels`, and Excel writes that file in no
particular order - every multi-tab fixture lists another tab first. So a
multi-tab Excel workbook in `imports/` was read from an arbitrary tab (for
`single.xlsx`, the empty Sheet3: nothing at all). Tab order now comes from
`xl/workbook.xml`. `P-old-rels` / `P-old-single` prove the fixtures reach it.

## A save that fails (`savefail`, added 2026-10-02)

The same drop path had an older bug, closed with its own control: when the SAVE of a
dropped file failed (any server error) over an existing import of the same name, the
report showed the PREVIOUS upload with no visible error. `#executeQuery` sends a
name's stored ID (`_penumbraImportIds`, then `_penumbraImportMeta[name].id`) ahead of
the session's rows (`_penumbraImportedData`), and the save's `error` callback only
logged to the console. Now it forgets that name's ID, so the query sends the rows just
parsed (query.php's inline fallback), and shows an ERROR toast with the server's reason.

The scenario drops `same_name.csv`, then a DIFFERENT `same_name.csv` while
`window.__saveFail` makes the fake `manage_imports.php` refuse every save (500, as a
database error does): S-rows (its rows render), S-inline (sent inline, no ID),
S-toast, S-rerun (Run again: still its rows), S-recover (with saves working again the
next upload is read back by its NEW ID). For this the fake `query.php` reads an import
the way the real one does - the stored rows of the ID the page sends, else the page's
inline rows. The old fake answered by NAME, i.e. with the last SAVED upload whatever
the page sent, which hides exactly this bug.

## Running

```
py -3 run.py                              # the live webroot
py -3 run.py --app <kit>\stage            # a staged kit (js\main.js + shared_logic.php)
py -3 run.py --control                    # both halves on the newest *.bak-*-msheet
py -3 run.py --control-savefail           # browser half on the newest js\main.js.bak-*-savefail
py -3 run.py --mutants                    # 16 JS mutants (mutants.json)
py -3 run.py --php-mutants --scn parity   # the PHP half's 9 mutants, with parity rows
```

Before a deploy there is no `.bak`: pass `--baseline-php <kit>\orig\shared_logic.php`
(and `--baseline-js <kit>\orig\js\main.js` for `--control` / `--control-savefail`).

Calibrated 2026-10-02 (msheet merged onto live `a89d3e23`; savefail LIVE 16:48, merged onto
live `ea0ae814`, its `.bak-20261002-1648-savefail`):

| run | expected |
|---|---|
| candidate | browser **75 pass, 0 fail**; PHP **28/28**; `RESULT: GREEN` |
| `--control` | browser red = exactly `CONTROL_RED` (33: msheet's 29 + savefail's 4 - that build predates both); PHP red = exactly its `CONTROL_RED` (16); `RESULT: GREEN` |
| `--control-savefail` | browser red = exactly `CONTROL_RED_SAVEFAIL` (S-rows S-inline S-toast S-rerun), the other 71 green; PHP half not run; `RESULT: GREEN` |
| `--mutants` | `SUMMARY JS mutants ok=16 bad=0` |
| `--php-mutants --scn parity` | all 9 "as expected" |

savefail's mutants: `keepstaleid` (the fix's two deletions removed, over EVERY scenario)
turns exactly S-rows S-inline S-rerun red; `keepid` / `keepmetaid` remove one deletion
each - the query falls back to the other map, same three red; `nofailtoast` and
`noreason` (the server's reason dropped) turn S-toast red.

## The two halves

**Browser** (`harness.html` + `driver.js`): the REAL `main.js` boots an admin's
report page, then a fixture is DROPPED on it and followed through
parse -> save -> query -> render. `harness.html` fakes `manage_imports.php`
(stores the save under a new ID; refuses > the cap with a 400, like the real one -
the cap is read from main.js's `PENUMBRA_IMPORT_MAX_ROWS` twin - and refuses every
save while `window.__saveFail` is set) and `query.php` (for `[IMPORT; name=X]` the
stored rows of the ID in the request's `importRefs`, else its inline `importData`
rows, columns from the FIRST row as the real resolver does). Scenarios: `parity` (J-, the parser on every fixture), `stack` (G-),
`single` (F-), `prevgroup` (V-: dropped onto a grouped report with a top-1
limit, count sort, depth 1 and a summary), `prevpivot` (W-), `overwrite` (O-),
`legacy` (L-, XML 2003), `cap` (Z-), `savefail` (S-, above). Hooks ride on main.js
line 1, so line numbers in errors are the file's.

**Server** (`test_msheet.php`): lifts the parsers from `shared_logic.php` by
TOKENIZER (it cannot be `require`d alone) with a per-run prefix, the baseline's
beside the candidate's. Needs ZipArchive: `php -n -d extension_dir=\\\\oitras\d$\...\ext
-d extension=zip` (FOUR backslashes - the `-d` parser folds `\\`; run.py does this).
`O-same` / `O2-same`: a one-tab workbook comes back byte-for-byte as the old
reader returned it. `X-twin`: the column name equals main.js's. `B-*`: the
server's table equals the browser's for the same file (keys compared
uppercased - the browser has always uppercased headers, the server kept their case).

## Vacuous on the old build - and the mutants that give them teeth

- PHP `T-every`, `T-hidden`: the old reader returns Mar's 2 uniform rows -> `blank`, `hidden`.
- Browser `V-agg`, `W-nopivot`: the stashed view is dropped there for its missing column -> `noaggnull`, `nopivotnull`.
- `B-case` survives the PHP `case` mutant BY DESIGN (the uppercased compare folds the spellings); `K-golden` sees it.

## Fixtures

`fixtures/` was authored by REAL Excel through COM (`make_fixtures.ps1 -Out <dir>`;
an invisible instance, killed by PID afterwards). COM trap found writing it:
PowerShell's binder caches the value TYPE per call site - one `.Value2 = $v` line
fed a string, then a number, throws "Unable to cast ... to System.String" - so
there is one assignment site per type.
