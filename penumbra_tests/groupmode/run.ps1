# =============================================================================
# Penumbra GROUP MODE HARNESS  -  one-command rebuild + run
#
# Boots the LIVE js/main.js headlessly (same recipe as ..\pivot_trigger) and
# drives the real rebuildGroupedView() against a synthetic result table:
#   - single-level grouping (the pre-nesting behaviour, asserted as an INVARIANT)
#   - two- and three-level nesting, including a bucketed level (AWARD_DATE:fy)
#   - the level cap, the level-0 mirror, and per-level data-* attributes
#   - the bucket picker helpers (variants / bin-worthwhile / labeller)
#   - custom sort order vs a bucket variant's own calendar order
#
#   powershell -File run.ps1                 (tests the LIVE js/main.js)
#   powershell -File run.ps1 -MainJs <path>  (e.g. a .bak - positive control:
#                                             a pre-nesting file must FAIL the
#                                             nesting asserts)
#
# Added 2026-09-17 (phase Q, "preview"): the two counters behind the search
# bar's "M of N rows / G of T groups" pill keyed their maps by GROUP VALUE on a
# plain {} - the same bug class swept out of the pivot the same day. A group
# literally called constructor / toString / valueOf finds the INHERITED member
# (the bucket is never created and the next .values.push throws), __proto__
# writes its bucket onto Object.prototype itself, and hasOwnProperty shadows the
# method both counters call to walk the map. _previewGroupedAggMatch is called
# OUTSIDE countMatchingRows' own catch, so its throw reaches the caller; the
# groupSet one is caught and the pill reads "-1". Phase Q drives both on a
# fixture holding all five names as group values, as DEPT values (count_distinct
# keys its own map by the cell) and as @@JSON nested values, and checks nothing
# was written onto Object.prototype.
#
#   run.ps1                    fixed main.js            EXPECTED: 594 assertions, 0 failed
#                              (live before the fix, sha 8037202a: 19 failed - every phase-Q
#                               assert except the 3 that a broken build still satisfies)
#   run.ps1 -Mutant <site>     one map back to a plain {}; every count is out of 594 and
#                              every failure is inside phase Q:
#       groups       10 failed   summary + distinct + nested-summary, and Object.prototype
#                                gains rowCount
#       shared        3 failed   the nested-summary case only
#       distinct      2 failed   the 2 count_distinct counts (it under-counts, never throws)
#       groupset      2 failed   the 2 matching-group counts (__proto__ is lost)
#       allgroupset   1 failed   the no-DOM group denominator
#       seen          4 failed   the 4 @@JSON counts (all three per-row dedup maps)
#       hop          19 failed   the READERS back to map.hasOwnProperty(k), which throws on
#                                a null-prototype map - the same 19 as the pre-fix control
#                                but for the opposite reason, so read the details, not the
#                                count: "groups.hasOwnProperty is not a function" here vs
#                                "sharedVals[nGk].push is not a function" there
#   A mutant needs the FIXED main.js (its anchor is the Object.create(null) form) and
#   throws "anchor not found exactly once" against anything else.
#
# If the UNC execution policy refuses the script ("not digitally signed"), run
# its body as a scriptblock from the workstation:
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\groupmode'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot',"`$here = '$dir'")))
# and do NOT pipe the invocation (a lingering Edge child keeps stdout open and
# the pipeline never sees EOF); the script prints its own summary.
#
# Rebuilds from the LIVE app files each run; writes nothing to the webroot.
# Exit code 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '',
      [ValidateSet('', 'groups', 'shared', 'distinct', 'groupset', 'allgroupset', 'seen', 'hop')]
      [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\groupmode' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

Write-Host "[1/3] staging JS + patching main.js ..."
# The same vendor set the pivot_trigger harness stages. The CodeMirror family is
# REQUIRED even though group mode never touches the editor: main.js's ready
# closure initialises the editors unconditionally, so without them init dies at
# "CodeMirror is not defined" and never reaches the PENUMBRA_PIVOT_SPLITS
# assignment - the hooks still exist (they are injected first), so the failure
# surfaces much later as "cannot read 'fy' of undefined" inside a bucket test.
# chart-4.5.1.min.js is deliberately NOT loaded (it spins rAF under virtual time
# and never settles).
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js','penumbra_presets.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
# sticky.html tests the STYLESHEET, which the JS harness cannot see at all - it
# builds the nested wrapper shape by hand against the live main.css + density.css
# and asserts the sticky offsets and the branch/leaf scroll split.
Copy-Item "$app\css\main.css" "$here\main.css" -Force
Copy-Item "$app\css\density.css" "$here\density.css" -Force

Write-Host "      main.js under test: $MainJs"
$src = [IO.File]::ReadAllText($MainJs, (New-Object System.Text.UTF8Encoding($false)))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# --- phase Q mutants (2026-09-17) -----------------------------------------
# One map (or, for 'hop', the three READS) back to the pre-fix form. Each has
# to be its own switch: reverting them together would let one assertion cover
# for another, which is exactly how the 2026-08-30 sweep missed group mode.
function Mutate([string]$s, [string]$old, [string]$new, [string]$tag) {
  $n = ([regex]::Matches($s, [regex]::Escape($old))).Count
  if ($n -ne 1) { throw "mutant '$tag' anchor not found exactly once (found $n) - needs the FIXED main.js: $old" }
  return $s.Replace($old, $new)
}
switch ($Mutant) {
  ''            { }
  'groups'      { $src = Mutate $src 'var groups = Object.create(null);      // key -> { values: [], rowCount: 0 }' 'var groups = {};      // key -> { values: [], rowCount: 0 }' 'groups' }
  'shared'      { $src = Mutate $src 'var sharedVals = Object.create(null);' 'var sharedVals = {};' 'shared' }
  'distinct'    { $src = Mutate $src 'distinct = Object.create(null), count = 0;' 'distinct = {}, count = 0;' 'distinct' }
  'groupset'    { $src = Mutate $src 'var groupSet = Object.create(null);' 'var groupSet = {};' 'groupset' }
  'allgroupset' { $src = Mutate $src 'var allGroupSet = Object.create(null);' 'var allGroupSet = {};' 'allgroupset' }
  'seen'        {
                  $src = Mutate $src 'else { var seen = Object.create(null); keys = [];' 'else { var seen = {}; keys = [];' 'seen/summary'
                  $src = Mutate $src 'var _seenAll = Object.create(null);' 'var _seenAll = {};' 'seen/all'
                  $src = Mutate $src 'var _seenMatch = Object.create(null);' 'var _seenMatch = {};' 'seen/match'
                }
  'hop'         {
                  $src = Mutate $src 'if (!Object.prototype.hasOwnProperty.call(groups, gkey)) continue;' 'if (!groups.hasOwnProperty(gkey)) continue;' 'hop/groups'
                  $src = Mutate $src 'if (Object.prototype.hasOwnProperty.call(groupSet, k)) groupCount++;' 'if (groupSet.hasOwnProperty(k)) groupCount++;' 'hop/groupSet'
                  $src = Mutate $src 'if (Object.prototype.hasOwnProperty.call(allGroupSet, k)) totalGroupCount++;' 'if (allGroupSet.hasOwnProperty(k)) totalGroupCount++;' 'hop/allGroupSet'
                }
}
if ($Mutant) { Write-Host "      MUTANT: $Mutant" -ForegroundColor Magenta }

# Export the closure internals as the closure's FIRST statement: function
# declarations hoist, so this works even if later init throws. Only HOISTED
# FUNCTIONS may be referenced directly here - a `var` would still be undefined
# at anchor time, so anything var-backed is read through a getter closure.
# Hook set 1: everything that predates nested grouping. setLevel0 writes the
# scalar directly so the single-level tests can drive a PRE-NESTING main.js too.
$hooks = @(
  'try { window.__GM = { rebuild: rebuildGroupedView,',
  '  setRows: function (r) { masterRowData = r; },',
  '  setLevel0: function (c) { currentGroupingColumn = c; },',
  '  setAgg: function (a) { currentGroupAgg = a; },',
  '  setSort: function (s) { currentGroupSort = s; },',
  '  setCustomSort: function (o) { customSortOrders = o; _csInvalidateComparators(); },',
  '  bucketSpec: groupBucketSpec,',
  '  variants: _groupBucketVariantsFor, binWorth: _groupBinWorthwhile,',
  '  populate: populateCustomSelect, colsForGrouping: getColumnsForGrouping,',
  '  splitCmp: pivotSplitComparator, sortCmp: getCustomSortComparator,',
  '  parseTok: pivotParseFieldToken, dispLabel: pivotFieldDisplayLabel };',
  '} catch (e) { window.__GM_ERR = String(e); }'
) -join ' '

# Hook set 2: the 2026-08-29 nested-grouping API. Its OWN try/catch, so a
# pre-nesting main.js (the positive control) still exposes __GM and runs the
# single-level and bucket-helper phases - only the nesting assertions fail, and
# they fail LOUDLY rather than the whole run reporting one opaque fatal.
$hooks2 = @(
  'try { window.__GM2 = { setLevels: setGroupingColumns,',
  '  getLevels: function () { return currentGroupingColumns; },',
  '  getLevel0: function () { return currentGroupingColumn; },',
  '  maxLevels: function () { return PENUMBRA_MAX_GROUP_LEVELS; },',
  '  labeler: _groupLevelLabeler };',
  '} catch (e) { window.__GM2_ERR = String(e); }'
) -join ' '

# Hook set 3: the picker + snippet grammar (levels 2-3, comma-joined stacks).
# Own try/catch again, so a build with the tree but not the grammar still runs
# every phase above.
$hooks3 = @(
  'try { window.__GM3 = { dialogLevels: _groupLevelsFromDialog,',
  '  populateLevels: _groupPopulateLevels, syncRows: _groupSyncLevelRows,',
  '  level0Of: groupLevel0Of, getValue: getCustomSelectValue };',
  '} catch (e) { window.__GM3_ERR = String(e); }'
) -join ' '

# Hook set 4: collapse-state persistence across a re-render (2026-08-30).
$hooks4 = @(
  'try { window.__GM4 = { captureOpen: _groupCaptureOpenPaths,',
  '  restoreOpen: _groupRestoreOpenPaths };',
  '} catch (e) { window.__GM4_ERR = String(e); }'
) -join ' '

# Hook set 5: the saved "start expanded to depth" default (2026-08-30).
# stateDepth() reads what the state writer would emit, so the test can assert
# that the default value is OMITTED rather than written as 0.
$hooks5 = @(
  'try { window.__GM5 = {',
  '  setStartDepth: function (d) { currentGroupStartDepth = d; _groupStartDepthApplied = false; },',
  '  getStartDepth: function () { return currentGroupStartDepth; },',
  '  applyStartDepth: _groupApplyStartDepth,',
  '  stateDepth: function () { return currentGroupStartDepth > 0 ? currentGroupStartDepth : undefined; } };',
  '} catch (e) { window.__GM5_ERR = String(e); }'
) -join ' '

# Hook set 6: the grouped -> visualization-builder reader (2026-08-30). Reads
# the config object only; the builder itself needs Chart.js, which this harness
# deliberately does not stage.
$hooks6 = @(
  'try { window.__GM6 = { groupsToViz: groupsToVizConfig, canAgg: _vizCanAgg };',
  '} catch (e) { window.__GM6_ERR = String(e); }'
) -join ' '

# Hook set 7: group-level filtering - top/bottom N, minimum size, "(Other)".
$hooks7 = @(
  'try { window.__GM7 = {',
  '  setLimit: function (l) { currentGroupLimit = _groupNormalizeLimit(l); },',
  '  getLimit: function () { return currentGroupLimit; },',
  # otherLabel is a GETTER: PENUMBRA_GROUP_OTHER_LABEL is a const declared later
  # in the closure, and the hooks run at anchor time - reading it eagerly here
  # hits the temporal dead zone and throws, killing the whole hook set.
  '  normalize: _groupNormalizeLimit,',
  '  otherLabel: function () { return PENUMBRA_GROUP_OTHER_LABEL; } };',
  '} catch (e) { window.__GM7_ERR = String(e); }'
) -join ' '

# Hook set 8: containerization (2026-09-10). The grouped view must NEVER be
# wrapped in #results-wrapper: its bands and its grand-total bar are sticky
# against the VIEWPORT (--pnb-grp-base is the page chrome's height,
# --pnb-grp-foot clears the fixed status bar), so that overflow:auto box would
# become their containing block and a band's top:251px would park it at the
# BOTTOM of its own wrapper. Every path that ENTERS group mode already called
# removeContainerization(); applyTheme() ended in an unconditional
# applyContainerization() and put it back. Both are hoisted declarations, so
# they can be referenced eagerly here.
$hooks8 = @(
  'try { window.__GM8 = { apply: applyContainerization, remove: removeContainerization };',
  '} catch (e) { window.__GM8_ERR = String(e); }'
) -join ' '

# Hook set 9: the group trigger's summary-type normalizer (2026-09-24).
# _groupNormalizeTriggerAggType is a hoisted function declaration, safe to
# reference at anchor time; _GROUP_AGG_LABELS is a var assigned later in the
# closure, so it is read through a GETTER (the __GM7.otherLabel rule).
$hooks9 = @(
  'try { window.__GM9 = { normAgg: _groupNormalizeTriggerAggType,',
  '  labels: function () { return Object.keys(_GROUP_AGG_LABELS); } };',
  '} catch (e) { window.__GM9_ERR = String(e); }'
) -join ' '

$inject  = $anchor + "`r`n    $hooks`r`n    $hooks2`r`n    $hooks3`r`n    $hooks4`r`n    $hooks5`r`n    $hooks6`r`n    $hooks7`r`n    $hooks8`r`n    $hooks9`r`n"
$patched = $src.Substring(0, $src.IndexOf($anchor)) + $inject + $src.Substring($src.IndexOf($anchor) + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[2/3] running harness in headless Edge ..."
# Fresh profile per run: a reused --user-data-dir has served a CACHED copy of
# main_patched.js and made a run "pass" against code already changed.
$udd = Join-Path $here ('edgeprofile_' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
              "--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom', $url)
# -Wait alone HANGS: a lingering Edge child keeps the redirected stdout handle
# open, so the parent never reports exit. PassThru + a bounded WaitForExit, then
# kill the stragglers.
$pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $edgeArgs
$pr.WaitForExit(180000) | Out-Null
if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
# Shared-handle read for the same reason: a surviving child may still hold it.
$fs = [IO.File]::Open($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
$sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
try { Remove-Item $udd -Recurse -Force -ErrorAction Stop } catch { }

$i = $d.IndexOf('<pre id="out">'); $j = $d.IndexOf('</pre>', $i)
if ($i -lt 0) { throw "no <pre id=out> in dump (Edge produced $($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(600,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json
[IO.File]::WriteAllText("$here\result.json", ($parsed | ConvertTo-Json -Depth 6))

# --- Second pass: the stylesheet ------------------------------------------
# Its own Edge run because it must NOT load main.js: it asserts what the CSS
# does on a hand-built DOM, so a JS change can never mask a CSS regression.
Write-Host "      + stylesheet pass (sticky offsets) ..."
$udd2 = Join-Path $here ('edgeprofile_' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$dom2 = Join-Path $here 'dom_sticky.txt'
if (Test-Path $dom2) { Remove-Item $dom2 -Force }
$url2 = 'file:///' + $here.Replace([char]92, [char]47) + '/sticky.html'
$args2 = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
           "--user-data-dir=$udd2",'--virtual-time-budget=20000','--dump-dom', $url2)
$pr2 = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom2 -ArgumentList $args2
$pr2.WaitForExit(120000) | Out-Null
if (-not $pr2.HasExited) { $pr2.Kill(); Start-Sleep -Seconds 2 }
$fs2 = [IO.File]::Open($dom2, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
$sr2 = New-Object IO.StreamReader($fs2); $d2 = $sr2.ReadToEnd(); $sr2.Close(); $fs2.Close()
try { Remove-Item $udd2 -Recurse -Force -ErrorAction Stop } catch { }
$i2 = $d2.IndexOf('<pre id="out">'); $j2 = $d2.IndexOf('</pre>', $i2)
if ($i2 -lt 0) { throw "stylesheet pass: no <pre id=out> in dump" }
$txt2 = [System.Net.WebUtility]::HtmlDecode($d2.Substring($i2 + 14, $j2 - $i2 - 14))
if (-not $txt2.StartsWith('RESULTS_JSON:')) { throw "stylesheet pass did not finish: $($txt2.Substring(0,[Math]::Min(400,$txt2.Length)))" }
$parsed2 = $txt2.Substring(13) | ConvertFrom-Json
if ($parsed2.fatal) { throw "stylesheet pass FATAL: $($parsed2.fatal)" }
# Merge, so the run reports one total the way every other suite here does.
$parsed.results = @($parsed.results) + @($parsed2.results | ForEach-Object {
  $_.name = 'css ' + $_.name; $_
})

# --- Third pass: the PHP runner -------------------------------------------
# The scheduled-send engine groups in PHP, against the SAME fixture the browser
# harness uses - a report that groups differently in email than on screen is
# exactly the failure this catches, and neither of the passes above can see it.
Write-Host "      + PHP pass (runner nesting) ..."
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$extract = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'
# NEVER require schedule_runner.php: its top level opens Oracle, claims tasks and
# SENDS EMAIL. extract_mirror.php lifts its function declarations via PHP's own
# tokenizer into a side-effect-free mirror, regenerated here from the LIVE file.
# This php.ini fails to load two optional extensions and says so on STDERR. In
# PS 5.1 a native command's stderr becomes ErrorRecords - and PIPING it (even to
# Out-Null) or running under $ErrorActionPreference='Stop' turns those into a
# terminating error on an otherwise clean exit. So: no pipe, no 2>&1, and drop
# to 'Continue' for the two native calls.
# 2>$null DISCARDS at the source - not 2>&1, which MERGES stderr into the success
# stream and is what wraps each line in a NativeCommandError. Dropping to
# 'Continue' as well, because a caller that pipes this script through 2>&1 would
# otherwise re-create the same escalation from the outside.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$extractOut = & $php $extract "$app\schedule_runner.php" "$here\mirror.php" 2>$null
# The XLSX assertions need the real theme palette, which lives in the app's
# themes_config.php (pure declarations - no connections, no output). Passed as an
# env var so the test file carries no hard-coded webroot path.
$env:PENUMBRA_APP = $app
$phpOut = & $php "$here\test_nested_php.php" 2>$null
$ErrorActionPreference = $prevEAP
$phpTxt = ($phpOut -join "`n")
$pi = $phpTxt.IndexOf('RESULTS_JSON:')
if ($pi -lt 0) { throw "PHP pass produced no RESULTS_JSON: $($phpTxt.Substring(0,[Math]::Min(400,$phpTxt.Length)))" }
$parsed3 = $phpTxt.Substring($pi + 13) | ConvertFrom-Json
if ($parsed3.fatal) { throw "PHP pass FATAL: $($parsed3.fatal)" }
$parsed.results = @($parsed.results) + @($parsed3.results)

Write-Host "[3/3] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "main.js init errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) -ForegroundColor Green }
  else { $fail++; Write-Host ("  FAIL  " + $r.name) -ForegroundColor Red; Write-Host ("        " + $r.detail) -ForegroundColor DarkYellow }
}
$summary = "{0} assertions, {1} failed" -f $parsed.results.Count, $fail
Write-Host $summary
# Also on disk: Write-Host goes to the HOST, not the pipeline, so a caller that
# captures this script's output cannot see the total at all. summary.txt is the
# one line worth reading back programmatically.
[IO.File]::WriteAllText("$here\summary.txt", $summary)
if ($fail -gt 0) { exit 1 }
