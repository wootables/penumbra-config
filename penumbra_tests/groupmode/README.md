# Group Mode harness

Boots the LIVE `js/main.js` headlessly and drives the real `rebuildGroupedView()`
against a synthetic six-row result table. Covers single-level grouping (asserted
as an INVARIANT), two- and three-level nesting, bucketed levels, the level cap,
the bucket picker helpers, and custom-sort-vs-variant ordering.

## Running

UNC `.ps1` files are GPO-blocked ("not digitally signed"), so run the body as a
scriptblock from the workstation and do NOT pipe the invocation:

```powershell
$dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\groupmode'
$body = [IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot', "`$here = '$dir'")
& ([scriptblock]::Create($body))
```

Positive control (a pre-nesting `main.js` must FAIL the nesting phases):

```powershell
& ([scriptblock]::Create($body)) -MainJs '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js\main.js.bak-20260829-nestedgroups'
```

Calibrated as of 2026-09-17: **live = 594 assertions, 0 failed.** `summary.txt` holds that line after every run (the
console summary is Write-Host, which a caller capturing output cannot see). The number moves whenever a phase is
added - it was 509 on 2026-08-30 and 571 on 2026-09-10 - so read `summary.txt`, never a count quoted in prose.

### The control has TWO blind spots. Both need a targeted mutant.

1. **A GATED phase is invisible to it.** Phase J (denominators) is
   `NESTED`-gated, so the pre-nesting control skips all ten of its assertions
   and proves nothing about them.
2. **`-MainJs` swaps only the JS half.** The PHP pass always reads the LIVE
   `schedule_runner.php`, so all ~78 php assertions pass on a control run by
   construction. The control cannot judge ANY runner work.

A broad control says "the nesting work is tested"; it never says "this new phase
tests anything." For that, build a TARGETED MUTANT: copy the live file, revert
only the lines the phase protects, and point the suite at it. Three exist:

| Mutant | Revert | Expected |
|---|---|---|
| JS denominators | `_grpIsFiltered` gate, branch + leaf `data-total-rows` stamps | 9 of phase J's 10 fail, nothing else |
| JS prototype keys | `js/main.js.bak-20260830-protokeys` (the whole pre-sweep file) | 14 of phase K's 15 fail |
| JS agg vocabulary | `js/main.js.bak-20260830-groupaggvocab` | phase L's 5 NEW types fail; its 5 "unchanged" guards pass on BOTH by design |
| JS start-depth guard | remove ONLY the `_groupStartDepthApplied` gate | 1 fails: "a re-render does NOT re-apply the default" |
| JS grouped-to-chart | revert `groupBy: _series` to `groupBy: .none.` | 3 series assertions fail |
| JS group limits | wrap the `currentGroupLimit` block in `if (false && ...)` | 11 behavioural assertions fail |
| PHP group limits | make `penumbra_apply_group_limit()` return its input | 10 fail |
| PHP render/sort | `_cf_sort_groups` nested branch, ancestor bands, leaf label, indent | 9 fail |
| PHP nested XLSX | force `$_xlNested = false` | 13 fail |
| JS reset button A | rename the `$('#resetGroupingBtn')` selector so nothing binds | 15 of phase M's 19 fail; the 2 pre-click guards and the 2 "untouched" negatives pass BY DESIGN |
| JS reset button B | add `setGroupingColumns([])` to the handler | 1 fails: "and is still the nested stack" |
| JS reset button D | add `$('#groupedResultsContainer').empty()` to the handler | 1 fails: "the applied grouping still renders its bands" |
| CSS picker indent | revert `.pcs-dropdown .pcs-item-bucket` to the bare `.pcs-item-bucket` | 4 of phase "picker css"'s 6 fail |

Phase Q's mutants are built into `run.ps1` as `-Mutant <site>` (2026-09-17), because
there are seven of them and each has to stand alone - reverting two maps at once
lets one assertion cover for another, which is exactly how the 2026-08-30
prototype-key sweep missed these two functions in the first place. Every count is
out of 594 and every failure is inside phase Q:

| `-Mutant` | Revert | Expected |
|---|---|---|
| `groups` | `_previewGroupedAggMatch`'s group bucket map back to `{}` | 10 - summary, distinct, nested-summary, and `Object.prototype` gains `rowCount` |
| `shared` | its `sharedVals` (both-virtual branch) back to `{}` | 3 - the nested-summary case only |
| `distinct` | `_aggregateValues`' `distinct` back to `{}` | 2 - the count_distinct counts; it under-counts, it never throws |
| `groupset` | `countMatchingRows`' `groupSet` back to `{}` | 2 - the matching-group counts (`__proto__` is lost) |
| `allgroupset` | its `allGroupSet` back to `{}` | 1 - the no-DOM group denominator |
| `seen` | all three per-row @@JSON dedup maps back to `{}` | 4 - the nested counts |
| `hop` | the three READS back to `map.hasOwnProperty(k)` | 19 - throws on a null-prototype map |

`hop` fails the same NUMBER as the pre-fix control and for the opposite reason, so
compare details, not counts: "groups.hasOwnProperty is not a function" here versus
"sharedVals[nGk].push is not a function" on the control. A mutant needs the FIXED
main.js and throws "anchor not found exactly once" against anything else.
| JS reset/preset P1 | delete the `_groupPresetCtl.setLoaded(null)` line | 1: "the chip drops the loaded name" |
| JS reset/preset P2 | make Reset also `PenumbraPresets.remove()` the loaded preset | 2: "NOT deleted" AND "pin survives" - `remove()` calls `repinIn()`, so deleting a pinned preset releases its pin too |
| JS reset/preset P3 | make Reset also `setPin('layout', null, null, null)` | 1: "pin survives" only |
| CSS configure C1 | drop `#configureGroupingBtn` from the `body.restrict-grouping` rule | 1: "restrict-grouping hides it" |
| CSS configure C2 | drop the `body.snapshot-comparison-active #configureGroupingBtn` rule | 1: "a snapshot comparison hides it" |
| PHP hidden group col | move the forced-column strip back to BEFORE `penumbra_group_rows_nested()` | 4 of that phase's 9 |

The hidden-group-column mutant is worth reading for what it does NOT kill. Five
of the nine survive it, correctly: the view is still `grouped`, every row is
still present exactly once, the forced column is still stripped, and both
visible-column assertions hold. Only the four that describe the actual defect
fail, with `{"[Blank]":83}` as the detail. A phase where the mutant kills
everything usually means the assertions are all restating one fact.

**Why the "Configure Grouping" gates are asserted in the STYLESHEET pass:** both
are pure CSS. `applyUserViewRestrictions()` only calls `.hide()` on the toolbar
icon (`#groupTableBtn`) and then leans on `body.restrict-grouping` for every
other entry point, so any new control that opens the grouping builder must be
added to that rule or it stays clickable for a viewer whose View Options hide
Grouping. Note the `viewOptionGrouping` map in main.js is the ADMIN MARKER
registry (which controls get the "hidden from users" badge), **not** the
enforcement path - adding an id there alone does not restrict anything.

P3 exists because P2 alone would not have proved the pin assertion: it fails
there only as a CASCADE of the deletion. P3 breaks the pin while leaving the
preset intact, which is the independent proof.

**The preset phase needs `penumbra_presets.js` STAGED** (it is in `$libs`, and
`harness.html` has a `#groupPresetMount` div plus a `<script>` for it BEFORE
main.js). Without it `window.PenumbraPresets` is undefined,
`_groupMountPresetChip()` returns early, `_groupPresetCtl` stays null, and the
reset handler's guarded `setLoaded(null)` is a no-op - the assertions would run
against a chip that never existed. That is why the phase opens with a
"the chip is mounted" guard. The phase swaps in an in-memory backend via
`PenumbraPresets._setStorage` so it neither reads nor writes real browser state.

**Mutating the CSS needs its own recipe** - `-MainJs` swaps only the JS, so it
cannot reach the stylesheet pass at all. Patch the STAGED `$here\main.css` (the
copy run.ps1 makes), re-run just sticky.html with the same Edge arguments, then
**`Copy-Item` the live file back over the staged one** or the next full run
lies. Never mutate the webroot copy. Parse the dump with
`<pre id="out">RESULTS_JSON:(.*?)</pre>` and a NON-GREEDY match: the inline
`<script>` in the dumped DOM contains the literal string `RESULTS_JSON:`, so a
greedy pattern swallows the whole page and `ConvertFrom-Json` dies on it.

Phase M needed THREE mutants, and the reason is worth keeping. Mutant A proves
the 15 "what Reset clears" assertions bind to the handler at all. It cannot
touch the two that say Reset must NOT disturb the report - those pass when
nothing runs, which is exactly right - so each needed its own mutant, and they
turned out to guard DIFFERENT failure modes: B breaks the level STATE, D breaks
the rendered DOM. A mutant that cleared the state and re-rendered
(`setGroupingColumns([]); rebuildGroupedView()`) killed only B's assertion,
because an empty stack makes the rebuild a no-op and leaves the old bands
standing - which is why D empties the container instead. Neither assertion alone
would have covered the other.

For the JS one, run `-MainJs <mutant>`. For the PHP ones, regenerate `mirror.php`
from the mutant runner and invoke `test_nested_php.php` directly:

```powershell
& $php $extract "<mutant>.php" "$dir\mirror.php"
$env:PENUMBRA_APP = $app; & $php "$dir\test_nested_php.php"
```
Restore `mirror.php` from the live runner afterwards - a stale mutant mirror
makes the next full run lie.

**A phase whose subject can THROW must run LAST and restore the fixture in a
`finally`.** Phase K swaps in prototype-named group values; against the pre-fix
build the grouping walk throws, and without the restore every later phase would
run on the wrong fixture. It also means the PREVIOUS phase's render is left
standing, so any assertion that scans the whole container reads stale
plain-value DOM and discriminates nothing — two of phase K's had to be rewritten
to scope to its own bands and require them to exist.

**Watch for assertions that pass on the mutant too.** Two were caught this way
and both are instructive: phase J's `-1`-in-a-pill check (labelled
`(render-time)` because the leak it is named after lives on the SEARCH path this
fixture cannot drive), and an XLSX schema-order check written as
`strpos($x, '<sheetPr>') < strpos($x, '<sheetViews>')` - `strpos` returns
`false` when the needle is missing and `false < <int>` is TRUE, so it passed
against a build emitting no `sheetPr` at all. Order assertions must prove both
halves EXIST first.

THREE passes now: the JS harness, the stylesheet, and the PHP scheduled-send
engine. `-MainJs` swaps only the JS half, so the ~79 css and ~22 php assertions
pass on a control run too - judge the control by its JS phases.

Phases that need an API the control's build does not have are GATED on that API
(`NESTED`, `GRAMMAR`, `PERSIST`) - their presence check fails loudly and the
inner assertions are skipped rather than run against a build that cannot support
them. That is why the control's total is lower, not just its pass count. A control run that passes means the harness has stopped
testing anything - fix it before trusting a clean live run.

`-MainJs` swaps only the JS half. The stylesheet pass reads the LIVE
`css/main.css` either way, so its ~61 assertions pass on a control run too -
that is expected, not a broken control. Judge the control by the JS phases.

## Fixture

Six rows over COLLEGE / DEPT / AWARD_DATE / AMOUNT / ACTIVE, with deliberately
uneven fan-out (2/1 at every level) because a symmetric tree hides off-by-ones.
Fiscal years span FY24-FY26 so `AWARD_DATE:fy` produces three distinct bands.

`ACTIVE` is a 0/1 flag: it exists specifically to assert that a column which
*parses* as numeric but has no spread is NOT offered bin variants.

Three more fixtures, each owned by one phase and restored in a `finally`:

- `PROTO_DATA` (phase K) - four prototype names as COLLEGE values, for the
  RENDER path.
- `PREVIEW_DATA` (phase Q) - all five (`__proto__`, `constructor`, `toString`,
  `valueOf`, `hasOwnProperty`), as COLLEGE values AND as DEPT values, with
  `__proto__` FIRST. The order matters: on a broken build a throwing name
  reached first stops the run before `__proto__` can write onto
  `Object.prototype`, which would make the pollution assert vacuous. Two DEPT
  values are prototype names so `count_distinct`, which keys its own map by the
  cell, is exercised too.
- `VIRT_PARENTS` + `VIRT_TEAMS` (phase Q) - four parent rows carrying `@@JSON`
  cells whose nested `SQUAD` values are the group keys. The first parent names
  `constructor` TWICE: the per-row dedup map is the only thing deciding whether
  that row counts once, twice, or - on a plain `{}` - not at all.

Phase Q is also the first phase here that drives the SEARCH path
(`_penumbraSearchAPI.countMatchingRows` and `_previewGroupedAggMatch`) rather
than the render; the "(render-time)" label on phase J's `-1`-in-a-pill check
above predates it.

## Structure

- `run.ps1` stages the vendor JS, injects three hook sets into main.js as the
  ready-closure's FIRST statement, runs headless Edge, parses `RESULTS_JSON:`,
  then runs a SECOND Edge pass over `sticky.html` and merges its results.
- `harness.html` builds the fake report DOM, drives the hooks, asserts.
- `sticky.html` tests the STYLESHEET, with no main.js at all: it hand-builds the
  nested wrapper shape against the live `main.css` + `density.css` and asserts
  the sticky offsets, the branch/leaf scroll split and the z-order, in all three
  density modes. It exists because the JS harness loads no CSS and therefore
  cannot see a layout regression - the 2026-08-30 overlap bug was invisible to
  every assertion in `harness.html`.

Two hook sets on purpose:

- `window.__GM` - everything that predates nested grouping, plus `setLevel0`
  which writes the scalar directly.
- `window.__GM2` - the nesting API (`setLevels`, `maxLevels`, `labeler`, ...).
- `window.__GM3` - the picker + comma grammar (`dialogLevels`, `populateLevels`,
  `level0Of`). The Copy Snippet phase drives the REAL `#copyGroupSnippetBtn`
  handler and reads `window.__clip`, so the writer is tested end to end rather
  than re-implemented.

Separate `try/catch` each, so a pre-nesting `main.js` still exposes `__GM` and
runs the single-level and bucket phases; only the nesting assertions fail, and
they fail readably instead of the run reporting one opaque fatal.

## Traps this harness has already paid for

- **The CodeMirror family is REQUIRED** even though group mode never touches the
  editor: main.js initialises the editors during ready unconditionally. Without
  them init dies at `CodeMirror is not defined` and never reaches the
  `PENUMBRA_PIVOT_SPLITS` assignment - which surfaces much later and very
  confusingly as `cannot read 'fy' of undefined` inside a bucket test. The
  `#sqlQuery` / `#reportSnippet` / `#subquerySql` textareas must exist too.
- **Read the hooks INSIDE `run()`, never at script top level.** main.js's body
  is in `$(document).ready`, which jQuery defers, so at the time the harness
  script executes neither hook set exists. Latching `NESTED` eagerly produced 31
  phantom failures against a perfectly good build.
- **`jQuery.fx.off = true`.** The fx ticker's rAF never fires under `--dump-dom`,
  so an animated `slideDown` would leave `.group-content` at `display:none` and
  every collapse assertion would read wrong. Do NOT null `requestAnimationFrame`
  instead - main.js calls it during init and the closure would die.
- **Tree lookups return a SENTINEL, not null.** On a control run half these nodes
  legitimately do not exist; returning null throws on the first `.rows` and
  aborts the whole run as one fatal instead of failing per assertion.
- **Fresh `--user-data-dir` per run.** A reused profile has served a cached
  `main_patched.js` and "passed" against code already changed.
- `Start-Process -Wait` HANGS (a lingering Edge child holds the redirected
  stdout handle). Use `-PassThru` + a bounded `WaitForExit`, then read the dump
  through a shared `FileShare.ReadWrite` handle.

## What this harness structurally CANNOT see

Keep this list honest - every entry cost a live debugging session.

- **The search path.** The grouped-search branch keys each row off a
  `td[data-column="#"]` that this fixture's table does not use, so no phase here
  can drive a filter. Everything about "X of Y" is asserted as a RENDER-time
  contract (`data-total-rows` stamped on each header) because that is the input
  the search path re-labels from. The visible `171 of -1` leak needed the live
  pass to find.
- **The BROWSER's XLSX export.** No ExcelJS is staged, so the browser's nested
  outline export has no coverage here. (The RUNNER's is covered - see below.)
  Verify the browser one live: patch `HTMLAnchorElement.prototype.click`
  to swallow the `download` anchor, intercept `window.ExcelJS`'s `Workbook`
  constructor to keep the instance, then read back `worksheet.rowCount` and each
  row's `outlineLevel`. Expected shape for a 2-level grouping: one sheet named
  `Grouped Data`, L0 = column header + outer bands, L1 = inner bands, L2 = data,
  one merge per band. On `?id=grantprofiles` that is 5,276 rows / 716 merges in
  ~3.6s.
- **A blocking `alert()` reads exactly like a frozen tab.** `createXlsxWorkbook`
  returns `hasData ? workbook : null` and the caller turns null into
  `alert("There is no visible data to export.")`. A native alert blocks the
  renderer, so CDP `Runtime.evaluate` times out at 45s, repeatedly, and the tab
  never recovers - which looks like an infinite loop and is not. **Override
  `window.alert` before driving any export**, and when a tab does go
  unresponsive, remember the trace has to survive it: write markers to
  `localStorage` (synchronous, survives the reload that clears the freeze), not
  to an in-memory array you can no longer read.

## `regroup()` must blank the dialog picker, or the level stack is ignored

`rebuildGroupedView()` opens with:

```js
const selectedColumn = getCustomSelectValue('groupingColumnSelector') || currentGroupingColumn;
```

The DIALOG wins over the level stack. Phase I drives that picker and leaves it on
COLLEGE, and every phase after it happened to use COLLEGE as level 0 - so the
staleness was invisible until phase O asked for level 0 = `DEPT`, silently got
COLLEGE back, and 11 assertions failed for the wrong reason.

**Diagnosing this class of failure:** read `data-group-col` off the rendered
wrappers. It says which column the RENDER actually used, so comparing it against
what the test asked for separates "my feature is broken" from "the harness
rendered something else entirely". Checking header visibility is NOT a useful
probe - group mode hides the source table, so every `th` reports hidden.

`regroup()` now blanks `#groupingColumnSelector .pcs-selected` before rebuilding.

## Hooks may only reference HOISTED functions eagerly

The hook sets run as the closure's first statement. Reading a `const`/`let`
declared later in the closure (e.g. `PENUMBRA_GROUP_OTHER_LABEL`) hits the
temporal dead zone, throws, and kills the entire hook set - which surfaces only
as that set's "API is present" assertion failing. Wrap such reads in a getter:
`otherLabel: function () { return PENUMBRA_GROUP_OTHER_LABEL; }`.

## A run can FAIL because another session is writing main.js

`run.ps1` copies the live 5.8 MB `main.js` and patches it. If another Claude
session is mid-write, that copy is TORN and the run dies with
`window.__GM missing - hook injection failed` plus a `pageErrors` entry like
`Uncaught SyntaxError: missing ) after argument list @main_patched.js:99493`.

The tell is that the line number is deep in the file rather than at the
injection point, AND a syntax check of `main.js` itself passes. That combination
means the source is fine and the COPY was torn - **re-run once the file settles
rather than debugging your own change.** Seen live 2026-08-30 (16:38 failed,
16:40 passed, nothing in between changed on the test side).

## The runner's XLSX, without the zip extension

`generate_xlsx_string()` ends in `new ZipArchive()`, and this php.ini cannot load
`zip`. `test_nested_php.php` declares its own `ZipArchive` (guarded by
`class_exists`, so a php.ini that has the real one wins and those assertions
simply skip) whose `addFromString` just records entries. That is BETTER than a
real `.xlsx`: the sheet XML is exactly what has to be right, and it can be
asserted directly instead of through a zip round trip.

It also needs `$theme_styles` and `$total_exemptions`. The palette comes from the
app's own `themes_config.php` - pure declarations, no connections, no output -
found via the `PENUMBRA_APP` env var that `run.ps1` sets, so the test file
carries no hard-coded webroot path.

## Extending it

The hooks already expose `setAgg` / `setSort` / `setCustomSort` and the whole
bucket helper surface, so per-level aggregates, grand totals and group-relative
metrics can be asserted here without touching `run.ps1` - add the phase to
`harness.html` and, if it needs a new closure internal, one more entry to
`$hooks2` (or a `$hooks3` with its own `try/catch` if it should degrade
independently on older builds).

## The grand-total bar and containerization (added 2026-09-10)

Two coverage gaps closed after the 2026-09-10 bar fixes. Neither pass could see
them before: `sticky.html` had no `.group-grand-total` in its fixture at all, and
neither fixture had a `#table-view-container`, a `#results-wrapper`, or anything
touching `role` / `tabindex`.

**`harness.html` phase M - `applyContainerization()` must skip the grouped view**
(hook set `__GM8`). The grouped view is deliberately un-containerized: its bands
and its total bar are sticky against the VIEWPORT, so `#results-wrapper`
(`overflow-y:auto`) becoming their containing block parks a band at the bottom of
its own wrapper and lifts the bar up over the rows. Every path that ENTERS group
mode calls `removeContainerization()` first; `applyTheme()` ended in an
unconditional `applyContainerization()` and put it straight back. The phase runs
LAST, builds its own `#table-view-container` (the fixture has none, and without
one `$activeView.children()` is empty and the whole thing is a vacuous no-op) and
restores the DOM in a `finally` - restoring the GROUPED container first, because
`#resultsTable`'s original next sibling IS `#groupedResultsContainer`.

**`sticky.html` - the bar's own dressing.** Cursor, selectability, surface,
`border-bottom`, the sticky pairing and the "ALL GROUPS" label, plus a per-theme
pass over the five themes that carry a `.group-header` hover rule of their own.

### Calibration (live 571 / 0)

| mutant | what it reverts | kills |
|---|---|---|
| C1 | bar rule back to `.group-grand-total > .group-header` (0,2,0) | 8 - cursor, bottom border, and the alt-surface claim unthemed + in all five themes |
| C2 | hover rules stop excluding `.ggt-header` | 5 - "hovering the total bar changes nothing", one per theme |
| C3 | label rule back to `.group-grand-total .group-name` (0,2,0) | 2 - "a step smaller than a band name", "below the band name in every density" |
| C4 | label `12px` back to `0.92em` | 1 - "the label size is the same in every density" |
| M1 | the `applyContainerization` guard removed (the pre-fix build) | 3 - the "grouped view is NOT wrapped" claims |
| M2 | `applyContainerization` refuses ALWAYS | 3 - the two setup guards + "the flat view still containerizes afterwards" |

C3 and C4 are BOTH needed: C3 cannot reach the density-constancy claim (its
revert pins the label to a flat 13px, which is constant across densities), and C4
cannot reach the "smaller than a band name" claim (0.92em is still under 13px at
every density). M1 and M2 kill DISJOINT sets for the same reason - M1 proves the
claims, M2 proves the guards are not decorative.

CSS mutants follow the existing recipe: patch the STAGED `main.css`, re-run
`sticky.html` alone with the same Edge args, then copy the live file back over the
staged one. Never the webroot copy.

### Three traps this cost

- **A transitioned property cannot be read synchronously.**
  `#groupedResultsContainer .group-header` carries
  `transition: background-color 0.15s`, so `getComputedStyle()` straight after a
  class flip returns the value the transition STARTED from. The first hover probe
  read "no repaint" on every dark theme and passed against C2. The light themes
  only appeared to work because their background-IMAGE is not in the transition
  list and flips instantly. Inject
  `.group-header { transition: none !important }` for the measurement.
- **`selectorText =` silently no-ops on a `:not()` selector** in Chromium. The
  rewrite took on the bare `.group-header:hover` rule and on nothing else, which
  read as "no theme hover rule applies at all". Insert a TWIN rule at the
  original's own index instead - `parent.insertRule(sel.replace(/:hover/g,
  '.pnb-fakehover') + ' {' + rule.style.cssText + '}', index + 1)`, back to front
  so an earlier rule's index is still valid - which keeps both the specificity
  AND the source order, and order is what decides these ties.
- **An unthemed hover probe is VACUOUS.** With no theme class only
  `#groupedResultsContainer .group-header:hover` (1,2,0) applies, and the bar's
  own (1,3,0) rule already outranks it, so the assertion passes with the
  exclusion removed. Only the five per-theme rules tie at (1,3,0) and win on
  source order. C2 is the only reason this was caught.

The exclusion itself is written `:where(:not(.ggt-header))`, not
`:not(.ggt-header)`. `:where()` contributes ZERO specificity, so the seven hover
rules keep the exact weight they had; the bare `:not()` raised them from (1,3,0)
to (1,4,0), which handed OPEN bands in the three dark themes a hover colour they
had never had (their `.group-wrapper.open > .group-header` rule is (1,4,0) and
had always won). The band-repaint guard therefore hovers a CLOSED band - which is
also what a reader actually hovers.
