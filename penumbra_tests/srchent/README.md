# srchent - the server search reads a cell as the browser does (2026-10-26)

**The fix.** `penumbra_search.php`'s `_search_get_cell_value()` (the engine behind scheduled
sends' Search Filter, the `?json=1` / `&search=` / `&dsearch=` lanes, dashboards' data tiles and
subscription conditions) read a cell as `trim(strip_tags(<@@HTML off>))` and never decoded HTML
entities. The report page's search (main.js `evaluateParsedQuery` -> `getCellValue`) decodes
them FIRST (`decodeHtmlEntities`). So `DEPT = 'Crop & Soil Sciences'` matched a cell stored as
`Crop &amp; Soil Sciences` on screen and missed it everywhere on the server. Now the server reads
a cell exactly as the browser, step for step:

1. **Entities** (`_search_decode_entities`): `&amp; &lt; &gt; &quot; &apos;`, `&nbsp;` as a PLAIN
   space, `&#NNN;` / `&#xHH;` as `String.fromCharCode` reads them - one UTF-16 unit, so `&#65601;`
   is `A` and `&#128512;` is U+F600; two entities that write a surrogate pair make the one character
   they spell; half a pair alone reads U+FFFD on the server (a lone unit on screen; neither matches
   anything typed). Any other entity (`&eacute;`, `&AMP;`, `&#X41;`) stays as it is; one pass
   (`&amp;lt;` reads `&lt;`). Not `html_entity_decode()`: it knows far more names.
2. **`@@HTML`** off, AFTER the decode (as the browser: `&#64;&#64;HTML` counts too).
3. **Tags**: `/<[^>]*>/` (the browser's), not `strip_tags()` - which dropped everything after a
   lone `<` (`<1%` read as ''), honoured quotes inside a tag, ate whole comments and NUL bytes.
   Decoding first means `&lt;none&gt;` reads '' and `x &lt; 5 and y &gt; 3` reads `x  3` - on
   screen too (a browser quirk, mirrored, not fixed here).
4. **Trim** (`_search_js_trim`): JavaScript's `trim()` - a no-break space, U+FEFF, the Unicode
   spaces and U+2028/2029 go too; a NUL stays.
5. **Nested `@@JSON` values** (`_search_nested_value`, both `_search_get_virtual_columns` and the
   `__ROW` reader): as main.js `getVirtualColumnsForRow` / `getStructuredVirtualData` - the text as
   it is (NO entity decode there), except an `@@HTML` one: prefix and tags off, then trimmed.
   The server used to keep it raw.

**The suite.** `corpus.json` (built by `mk_corpus.py`: 34 rows, one reading rule each, 43
queries naming the rows they return) goes through BOTH engines: `harness.html` boots the REAL
main.js in headless Edge (hooks patched in as the closure's first statement, `getCellValue` named
so it can be called) and prints every read; `php_side.php` does the same through the real
`penumbra_search.php`; `run.py` compares.

| assert | what |
|---|---|
| H-boot | the browser half booted; the page's column list (`penumbraFlatSearchColumns`) holds `#`, SUB, AMT2 |
| B-slug | the BROWSER returns exactly the query's expected rows (the corpus is right) |
| R-rid | the server reads every cell of that row exactly as the browser |
| R-utf8 | every server read is UTF-8 |
| N-rid-virt / N-rid-row | a row's nested values, both readers |
| Q-slug | the SERVER returns exactly the query's expected rows |

```
py -3 run.py                          # live penumbra_search.php: GREEN
py -3 run.py --stage DIR              # DIR\penumbra_search.php: GREEN
py -3 run.py --control                # CONTROL_REV's file: EXACTLY CONTROL_RED red
py -3 run.py --stage DIR --mutants    # each mutant EXACTLY its asserts red
py -3 run.py --stage DIR --all        # all of it, one Edge run
```
Edge runs once per invocation (the browser half does not change); the control and the mutants
re-run only the PHP half. Stages into `%TEMP%\pnb_srchent_*`, writes nothing to the webroot, and
waits while another headless Edge runs (one headless suite at a time on this workstation).
