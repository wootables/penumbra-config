# Help Center accuracy audit, 2026-10-15

Every claim in the 33 help topics, the 5 hover-tip stores and the Custom Code registry was traced to the live
code (js/main.js, index.php, schedule_runner.php, penumbra_search.php, the js/penumbra_*.js modules, the PHP
endpoints) by nine read-only reviewers, one per book. A claim is **confirmed** when the code does what the help
says, **wrong** when it does not, **partly** when the help is right in substance but off in a detail (a label, a
list, an edge case), **unverifiable** when the code path was not reached (an Oracle or OS behaviour, an advice
sentence, a renderer the reviewer did not open). The per-topic tables are in `work/audit/*.md` next to this file.

## Totals

| book | claims | confirmed | wrong | partly | unverifiable |
|---|---|---|---|---|---|
| Custom Code functions, part 1 (count .. sparkline_cell) | 176 | 150 | 7 | 9 | 10 |
| Custom Code functions, part 2 (action .. breakdown_cards) | 180 | 163 | 2 | 9 | 6 |
| Pivot Builder + pivot tips | 120 | 89 | 9 | 21 | 1 |
| Data Visualization + viz tips, Dashboards | 207 | 172 | 8 | 19 | 8 |
| Download, Copy, Email, Snapshots + snap tips, Journal, Version History | 310 | 270 | 8 | 14 | 18 |
| Scheduler book (5 topics) | 317 | 271 | 9 | 22 | 15 |
| Writer topics (SQL, Prompts + builder tips, Imports, Subqueries, Save ID, Save prefs, Security, Access List) | 286 | 244 | 6 | 18 | 18 |
| Advanced Search, Grouping, Column Summaries, Your Settings + settings tips | 273 | 241 | 5 | 11 | 16 |
| View Options, Power Features, Repository, Auditor, What is Penumbra, Ask | 344 | 313 | 0 | 7 | 24 |
| **all** | **2,213** | **1,913 (86%)** | **54 (2.4%)** | **130 (5.9%)** | **116 (5.2%)** |

Four of the 54 wrong claims and four of the 130 partial ones are not in the help at all but in the Custom Code
hover cards (js/penumbra_snippet_help.js) and a scheduler notice (schedule_runner.php); they are listed under
*Code-side findings* below and were not changed. Every other wrong claim, and every partial claim the reviewer
could state the correct version of, was corrected on the stage: 195 edits across 29 fragments, 3 tip stores and
the Custom Code registry (regenerated), plus the manifest.

## What was wrong (and now says)

**Presets moved into a title-bar chip (pivot, charts, search).** Three topics and two tip stores still described
the old Configuration-panel controls: a *Load Preset* dropdown, a red x to delete, a *Save Current as Preset*
button, a *Load by default* / *Run on Load* checkbox, "presets never leave your machine". The presets live in a
*Presets* chip in each builder's title bar (*Save current view...* / *Save current chart...* / *Save current
search...*, a pin icon *Apply when the report loads*, Rename and Delete icons), and since 2026-09-05 a report's
editors can *Share current ...* a preset to the server for every viewer. Also the pivot and viz "overwrite"
sentences: saving under an existing name asks first.

**Pivot.** The bottom-right corner Grand Total cell *is* clickable (it drills into every source row; only a
derived aggregation's corner cell is not). Column Total overrides offer thirteen base types, not eight, and Row
Total tokens accept any non-derived type including percentiles. Email forces a flat layout (row fields side by
side, headers combined "2024 - Q1"); the help said nested headers were fully supported. Six "no limit" cells in
the formats table meant "not applicable". Rankable types include Std Deviation, Range, Non-Blank and Blank;
Mode, Antimode, percentiles and Weighted Average are not. The (Other) row counts rolled-up pivot rows, not
source records. The browser's own CSV/XLSX export writes "2024-Q1", only the scheduler's attachments write
"2024 - Q1". Default labels are the short ones (Avg, Std Dev), so formulas reference {Avg}.

**Data Visualization.** Eighteen chart types, not seventeen. The settings are four tabs with greyed-out controls,
not hidden fields; the button bar is docked at the bottom, not between form and preview; the *Chart #* dropdown
is *Chart to update*; the buttons are an *Actions* menu (Insert into Custom Code, Insert as an infobox, Copy
vis() to clipboard, Move inside an infobox, Move to fullscreen slide, Set up fullscreen mode, Remove this
chart) plus *Update chart*; the Limit spinner runs 1 to 9999 (not "stops at 500"); radar has no Group By; the
horizontal, trend-line, reference-line, axis-label and Y-range availability lists each missed types (box plot,
map, sankey, gauge, bullet, gantt); the vis() signature has 41 slots ending in funnelMode, bands, boxWhiskers,
pareto, options.

**Email dialog.** The attachment cap is about 6.5 MB decoded (70% of the relay cap), not 15 MB. Each recipient
gets their own copy by default; *Let recipients see each other's addresses* sends one shared message (the
option and its notice were missing). The dialog refuses an invalid chip and the server reports every skipped
or refused address (the help said addresses were dropped silently). The Excel option is a *Table only* /
*Include header data* radio pair; there is no monochrome option in the email dialog. The live link now carries
the search filter and prompt values (the help and its notice row said the opposite).

**Scheduler book.** The SFTP/SCP private key is **not** encrypted (see the security finding below); passwords
and S3 keys are. A per-recipient change-analysis email *does* carry the ?snapcmp= link unless the SQL itself
holds a literal recipient variable. Preserve mode recreates the table once when a run's data no longer fits a
column type. The Search Filter topic described an older date engine: dates are parsed strictly plus
TODAY/NOW/SYSDATE offsets (SYSDATE-30 works, English phrases do not), compared at the precision typed (a bare
year is a year, a month is a month), an implicit contains on a number is a substring test as in the browser,
and the two-token {COLUMN} value form works. Smaller: the runner card also reads Blocked / Status unknown; a
DB Dump streams a too-large result instead of failing; {SEND_DATE} family also works in a Snapshot task's name;
the baseline offer appears only when the report has no snapshots; Last Query Run is the query's last run (Last
Accessed is the last open); the form's type is *Dump to DB Table*.

**Security & Access.** The IP Address List is not a security layer: the field is disabled, never saved and never
checked (a known open finding). The topic now says two layers, access list and password, and marks the IP
section *Not in use*.

**Column Summaries.** The built-in total list is TOTAL, AMOUNT, COUNT, AMT, CNT, COST (the configured
total_exemptions), not "AMOUNT, TOTAL, RATE, COUNT, AVG, MIN, MAX, SUM or VALUE". Count Non-Blank is the
*suggested* type for text, not a default. XLSX footers are static values; no =SUM() formula is written. Badge
clicks on a report with column customization off survive for administrators only.

**Copy, Download, Snapshots, Dashboards, Prompts, Subqueries, Settings, Ask.** PHP Stub is administrators-only
(its help block is now admin-gated); the Copy dialog's button is *Snippet*. Grouped Excel: one sheet per group
only for a single grouping level, outline levels when nested (download, grouping, scheduler). download=xls|mono
exists. Pinning a snapshot takes the creator, the owner or an admin, not any viewer; the pre-compare buttons are
named; the lopsided pill also needs a 50-row gap. Tag-grant holders can create, edit and delete a dashboard that
carries their tag (since 2026-10-09). The prompt reserved-name list was wrong (dsearch is reserved; limit, asof,
embed, eview are not) and the claim "never read as a prompt answer" was false: link builders skip such a
prompt. SELECT * is not rejected in a subquery. The grouped view scrolls sideways rather than fitting the
window. Ask: cards are listed unless their net score is negative and retire at a net score of -2.

**Custom Code registry.** avg()/percentile() are not rounded in email before nesting; rank() in email collapses
ties (only dates are not ranked); a bare data() prints the literal "undefined" in a subtitle or infobox; stddev()
returns 0 where the STDEV badge is blank; calc() also admits spaces and scientific notation; abs(0 - 5) is NaN in
email; case() text equality is case-sensitive in email; a date-range prompt is one position (FROM..TO); an
unknown theme| name is not ignored (default look, saved, success toast); the infobox DATA is fetched only when it
starts with / or http(s)://; the pivot Agg table gained ytd/yoy/prioryear; vis() lists all 18 types, every
aggregation and the 41-slot signature; trendLine draws on scatter and histogram too; progress_bar prints 30% in
the body and email but 30.0% in a subtitle; vis() is drawn in email, so web() around it is what suppresses it.

## Code-side findings (not help; nothing changed)

1. **Security.** A Drop-a-File task's SFTP/SCP private key is stored unencrypted in the task options, returned
   to the browser on every task list and loaded raw by the transport (manage_schedule.php 1082-1101, 696-720;
   js/main.js 120133, 118259; plugins/file_transport.php 162). Only drop_password and the two S3 keys get the
   AES-256-CBC treatment.
2. Custom Code hover cards (js/penumbra_snippet_help.js): stddev "email rounds to 2 dp" (line 445), me() "title
   and type mail as a blank placeholder" (171; they mail as literal {TITLE}/{TYPE}), calc() "supports column
   references" (235), date_diff example gives 31 not 30 (506), round() "VALUE may be a column" (252; a bare column
   is NaN), heatmap "every aggregation is shaded" (551; derived aggregations are skipped), me(ouc2d...) listed
   without saying email-only.
3. schedule_runner.php 18244-18247: the info() Engine row text says heatmap(), format() and rewrite() are
   stripped server-side; they render (12736, 12678, 13930).
4. Smaller stale bits: the visualization builder's Insert button tooltip says "at the cursor" (index.php 6596;
   it inserts at line 1); the map comment says 51 tiles (js/main.js 9843; 55 real); the keyboard cheat sheet
   says Ctrl+Shift shortcuts stand down in the SQL editor (js/main.js 89736; they do not); the manage_schedule
   form comment omits DB_DUMP from the data skip conditions (index.php 3349; the runner applies them).
5. Behaviour differences the help does not mention and the code may want to align: mode() in email skips blank
   cells while the browser counts them; email's data() accepts any promptN while the browser stops at 6;
   format() styles with commas split when unquoted; rank() has no `all` scope.

## Left as written (the reviewer could not finish verifying)

Scheduler snapshots "never show the match dot" (the code compares every row's signature with no scheduler
exclusion: worth a look); the journal toggle `|` name warning and the yes/unchecked search words; Version
History's "past the first three" threshold; .xlsx hidden sheets on the browser side and the WORKSHEET grouped
view; the .ods hidden-sheet remark; the "before 2026-09-10" date; the prompt section caption "in capitals";
Pulse tile click targets; the watchdog's two-failure threshold; the Excel formula-injection character rule;
sixteen Oracle/OS/advice sentences (ORA-01489, DBMS_LOB speed, WCAG conformance, symlinks).

## How the corrections were checked

Every replacement was an exact-anchor edit asserted to match once (work/audit/patch_all.pl, applied in memory
and written only when all 195 anchors held). The three corrected tip stores joined the manifest's touched list,
and the three tokens the audit removed on purpose (a formula dash, =SUM(), strtotime()) joined its dropped-token
list, so the equivalence check P9 keeps guarding every other fact. The suite (lint L1-L20, equivalence P1-P9 and
the audience matrix, retrieval R1-R7, Ask A1-A11, the client harness, 27 mutants) ran green on the corrected stage (run26: 60 checks, 27 of 27 mutants killed; the php-error
mutant was repointed at the Copy topic's remaining writer gate once its PHP-stub block became admin-gated). The
live run after the deploy is recorded in the suite's out/ log of that run.
