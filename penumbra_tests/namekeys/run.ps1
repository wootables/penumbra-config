# =============================================================================
# NAME-KEYED MAPS SUITE (2026-09-18)
#
# The third tier of the Object.prototype-member key sweep. The first three rounds
# (2026-09-17) fixed maps keyed by CELL VALUES (pivot, grouped search preview,
# drill-down "(Other)"). These maps are keyed by a user-controlled NAME instead:
#
#   - a query's column ALIASES. query.php keeps their case (a quoted Oracle alias,
#     any MSSQL alias), so a row can carry an own key "hasOwnProperty": the result
#     handler's data[0].hasOwnProperty('Error') threw, the page sat on the loading
#     overlay (reproduced LIVE 2026-09-17 on SELECT 1 AS "hasOwnProperty" FROM DUAL),
#     and columnNameToOriginalIndex - a plain {} - dropped a column aliased
#     __proto__ (its cells carried data-column="[object Object]") and broke the
#     totals footer's colNameToOrigIdx.hasOwnProperty() read.
#   - a report's NAME: the per-report localStorage prefs (theme, density, row
#     expand, resolver links, rows per page, column layout), keyed by a local
#     save name, a server short id (the rename regex allows hasOwnProperty) or a
#     shared link's state name. Once "hasOwnProperty" was stored, JSON.parse
#     handed it back on every load and every report's boot died in the state
#     loader ("Error processing state from preloaded ID"); a report called
#     __proto__ never recorded, and its column prefs wrote summaries/summaryBadges
#     onto Object.prototype itself.
#   - a JSON import's RAW keys (parseJSONToObjects read row.hasOwnProperty(key)
#     before uppercasing).
#   - search_builder.js _acCache, keyed by builder column names - a pivot's custom
#     aggregate label and a journal toggle label reach it verbatim.
#
# Ruled SAFE and guarded here, not converted: import NAMES (every path sanitises
# to [A-Z0-9_] and uppercases) and CSV/XLSX/JSON import headers (uppercased).
# Also SAFE by code reading (no assert): snapshot rowData keys (every writer
# uppercases), pivot rowCtx/contextOverrides (fields are uppercased row-map keys).
#
# Drives the REAL code: main.js with its ready closure unwrapped into an IIFE plus
# an export hook (window.__NK), search_builder.js with one (window.__SB). Three
# page loads, because the boot readers run once per load: main (phases A Q J I P
# C W), landing (poisoned prefs, no ?id=) and report (poisoned prefs, ?id=plainrep
# booted through the state loader). One prototype name per fixture: a
# hasOwnProperty throw fires first and hides whatever __proto__ did.
#
#   run.ps1                     live files                        EXPECTED: 59 / 0
#   run.ps1 -Control            the pre-fix .baks (after deploy)  EXPECTED: 16 / 43 - the 16 are the
#                               SAFE-ruling guards, the reach checks, the plain-column control and the
#                               Object.prototype scrubs; every bug assert fails
#   run.ps1 -MainJs <p> -SbJs <p>   any other copies (e.g. a stage build)
#   run.ps1 -Mutant <name>      ONE map back to its pre-fix form, on the FIXED build. Measured 2026-09-18,
#                               each out of 59 - '*decl' fails only the __proto__ record asserts (the
#                               .call reads still cope with hasOwnProperty), '*read' throws on EVERY
#                               lookup of a null-prototype map, so it fails more and for the opposite
#                               reason. Read the IDs, not the counts:
#       prefhelper   46/13  every pref map's __proto__ record (P4 P5 P8 P10 P12 P14 P15 C1-C5 W1)
#       themedecl    56/3   P4 P5 P14            themeread    45/14  P1-P3 P5 P16 L1 R1-R8
#       densitydecl  58/1   P8                   densityread  50/9   P7 P16 L2 R3-R8
#       resolverdecl 58/1   P10                  resolverread 51/8   Q0 Q1 P9 R4-R8
#       expanddecl   57/2   P12 P15              expandread   55/4   P11 R5 R6 R8
#       colprefsdecl 54/5   C1-C5                rowsdecl     58/1   W1
#       errgate      55/4   Q1-Q4                errcheck     55/4   Q1-Q4 (each error-check read alone)
#       cnidecl      57/2   Q5 Q6                cniread      55/4   Q0 Q1 Q4 Q8 (even plain columns)
#       jsonread     57/2   J1 J2
#       acdecl       58/1   A1                   acclear      58/1   A3            acread 55/4 A1-A4
#   -Pages main,landing,report  run a subset; -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\namekeys'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutant cnidecl
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$SbJs = '', [string]$Mutant = '', [string]$Pages = 'main,landing,report', [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\namekeys' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if ($Control) {
  # The files the deploy of this fix replaced (byte-identical to the pre-fix build).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $bm = Get-BakItem "$js\main.js.bak-*-namekeys" | Select-Object -Last 1
  $bs = Get-BakItem "$js\search_builder.js.bak-*-namekeys" | Select-Object -Last 1
  if (-not $bm -or -not $bs) { throw '-Control needs js\main.js.bak-*-namekeys and js\search_builder.js.bak-*-namekeys (made by the deploy)' }
  $MainJs = $bm.FullName; $SbJs = $bs.FullName
}
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $SbJs)   { $SbJs   = "$js\search_builder.js" }
foreach ($p in @($MainJs, $SbJs)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }
Write-Host "[1/3] staging  main.js: $MainJs"
Write-Host "               search_builder.js: $SbJs$(if ($Mutant) { "   + MUTANT $Mutant" })"

$run = Join-Path $env:TEMP ('pnb_namekeys_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $run | Out-Null
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
Copy-Item "$here\harness.html" "$run\harness.html" -Force
Copy-Item "$here\driver.js" "$run\driver.js" -Force

$src = [IO.File]::ReadAllText($MainJs, $utf8)
$sb  = [IO.File]::ReadAllText($SbJs, $utf8)

# --- per-map mutants ---------------------------------------------------------
# Each one puts ONE map back the way it was before 2026-09-18, on the FIXED
# build: '*decl' = its declaration back to a plain {} (every parse site of a
# pref map), '*read' = its membership reads back to map.hasOwnProperty(k). A
# read mutant throws on EVERY lookup (a null-prototype object has no inherited
# hasOwnProperty), so it fails more asserts than the decl mutant and for the
# opposite reason - compare the details, not the counts.
# Entry: @(file 'main'|'sb', old, new, expected count)
$CALL = 'Object.prototype.hasOwnProperty.call'
$NL = "`r`n"
function PrefDecl($key, $count) { return ,@('main', "_spPrefMap($key)", "JSON.parse(localStorage.getItem($key) || '{}')", $count) }
function Read($obj, $arg) { return ,@('main', "$CALL($obj, $arg)", "$obj.hasOwnProperty($arg)", 1) }
$mutants = @{
  'prefhelper'   = @(,@('main', "        return Object.assign(Object.create(null), JSON.parse(localStorage.getItem(lsKey) || '{}'));", "        return JSON.parse(localStorage.getItem(lsKey) || '{}');", 1))
  'themedecl'    = @((PrefDecl "'penumbra_pref_theme'" 11), @('main', 'catch (e) { themePrefs = Object.create(null); }', 'catch (e) { themePrefs = {}; }', 1))
  'themeread'    = @((Read '_tp' '_tpKey'), (Read 'themePrefs' '_spPrefKey()'), (Read 'tp' 'tpKey'), (Read '_saveThemePrefs' '_spk'),
                     (Read 'themePrefs' 'earlyKey'), (Read 'themePrefs' 'currentLoadedStateName'))
  'densitydecl'  = @((PrefDecl "'penumbra_pref_density'" 7), @('main', 'catch (e) { densityPrefs = Object.create(null); }', 'catch (e) { densityPrefs = {}; }', 1))
  'densityread'  = @((Read 'densityPrefs' '_spPrefKey()'), (Read '_saveDensityPrefs' '_spk'), (Read 'dPrefs' "'__landing__'"), (Read 'densityPrefs' 'currentLoadedStateName'))
  'resolverdecl' = @(,(PrefDecl "'penumbra_resolver_prefs'" 3))
  'resolverread' = @(,(Read 'prefs' '_spPrefKey()'))
  'expanddecl'   = @((PrefDecl "'penumbra_pref_rowExpand'" 5), @('main', 'catch (e) { _rep = Object.create(null); }', 'catch (e) { _rep = {}; }', 1))
  'expandread'   = @(,(Read 'rowExpandPrefs' 'currentLoadedStateName'))
  'colprefsdecl' = @(,(PrefDecl "'penumbra_column_prefs'" 7))
  'rowsdecl'     = @(,(PrefDecl 'REPORT_PREFS_KEY' 3))
  'errgate'      = @(,@('main', "($CALL(data[0], 'Error') || $CALL(data[0], 'ERROR'))", "(data[0].hasOwnProperty('Error') || data[0].hasOwnProperty('ERROR'))", 1))
  'errcheck'     = @(,@('main', "if ($CALL(firstRow, 'Error') || $CALL(firstRow, 'ERROR')) {", "if (firstRow.hasOwnProperty('Error') || firstRow.hasOwnProperty('ERROR')) {", 1))
  'cnidecl'      = @(,@('main', 'const columnNameToOriginalIndex = Object.create(null);', 'const columnNameToOriginalIndex = {};', 1))
  'cniread'      = @(,(Read 'colNameToOrigIdx' 'name'))
  'jsonread'     = @(,@('main', "shadows the method.$NL                if ($CALL(row, key)) {", "shadows the method.$NL                if (row.hasOwnProperty(key)) {", 1))
  'acdecl'       = @(,@('sb', '    var _acCache = Object.create(null);   //', '    var _acCache = {};        //', 1))
  'acclear'      = @(,@('sb', "function clearAutocompleteCache() {$NL        _acCache = Object.create(null);", "function clearAutocompleteCache() {$NL        _acCache = {};", 1))
  'acread'       = @(,@('sb', "if ($CALL(_acCache, colName)) return _acCache[colName];", 'if (_acCache.hasOwnProperty(colName)) return _acCache[colName];', 1))
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  foreach ($m in $mutants[$Mutant]) {
    $file = $m[0]; $old = $m[1]; $new = $m[2]; $want = [int]$m[3]
    $text = if ($file -eq 'sb') { $sb } else { $src }
    $n = ([regex]::Matches($text, [regex]::Escape($old))).Count
    if ($n -ne $want) { throw "mutant '$Mutant' anchor found $n times, expected $want (needs the FIXED build): $old" }
    $text = $text.Replace($old, $new)
    if ($file -eq 'sb') { $sb = $text } else { $src = $text }
  }
}

# --- closure exports ---------------------------------------------------------
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
$hook = @(
  'try { window.__NK = {',
  '  getName: function () { return currentLoadedStateName; }, setName: function (v) { currentLoadedStateName = v; },',
  '  setPivotSettings: function (s) { currentPivotSettings = s; },',
  '  getCni: function () { return $("#resultsTable").data("columnNameToOriginalIndex"); },',
  '  getEditor: function () { return editor; }, spPrefKey: _spPrefKey,',
  '  getRowExpand: function () { return isRowExpandActive; }, getResolver: function () { return resolverLinksEnabled; },',
  '  getReportTheme: function () { return currentReportTheme; }, setReportTheme: function (t) { currentReportTheme = t; }',
  '}; } catch (e) { window.__NK_ERR = String(e); }',
  'try { var _nkF = { parseJSON: "parseJSONToObjects", parseCSV: "parseCSVToObjects", importFile: "importFileData",',
  '  totals: "updateTotalRow", openSP: "openSettingsPanel", layout: "applyLayoutPreferences", loadResolver: "loadResolverPref",',
  '  saveResolver: "saveResolverPref", dataLookup: "penumbraDataLookup", infobox: "resolveInfoboxSnippet",',
  '  persistSummaries: "persistColumnSummaries", persistBadge: "persistSummaryBadgePref", saveColPrefs: "saveColumnPrefs",',
  '  loadColPrefs: "loadColumnPrefs", resolveSummaries: "penumbraResolveSummaries" }; } catch (e) {}'
) -join "`r`n"
# Functions are exported by NAME through eval so a missing one (an older build)
# costs only that entry, not the whole hook.
$hook2 = 'try { Object.keys(_nkF).forEach(function (k) { try { window.__NK[k] = eval(_nkF[k]); } catch (e) { (window.__NK_MISSING = window.__NK_MISSING || []).push(_nkF[k]); } }); } catch (e) { window.__NK_ERR2 = String(e); }'
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + ';(function () {' + "`r`n" + $hook + "`r`n" + $hook2 + "`r`n" + $src.Substring($i + $anchor.Length)
$j = $patched.LastIndexOf('});')
if ($j -lt 0) { throw 'closure tail not found' }
$patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
[IO.File]::WriteAllText("$run\main_nk.js", $patched, $utf8)

$sbTail = '})(jQuery);'
$k = $sb.LastIndexOf($sbTail)
if ($k -lt 0) { throw 'search_builder.js tail not found' }
$sbHook = 'try { window.__SB = { getAC: getAutocompleteValues, clearAC: clearAutocompleteCache, avail: getAvailableColumns }; } catch (e) { window.__SB_ERR = String(e); }'
$sbPatched = $sb.Substring(0, $k) + $sbHook + "`r`n" + $sb.Substring($k)
[IO.File]::WriteAllText("$run\sb_nk.js", $sbPatched, $utf8)

# --- pages -------------------------------------------------------------------
# landing: no ?id=, the prefs a report literally named hasOwnProperty leaves behind
# report : ?id=plainrep boots a saved report through the state loader
$poisonTheme   = '{"hasOwnProperty":"theme-dark","plainrep":"theme-dark","__landing__":"theme-dark"}'
$poisonDensity = '{"hasOwnProperty":"compact","plainrep":"compact","__landing__":"compact"}'
$poisonExpand  = '{"hasOwnProperty":false,"plainrep":false}'
$poisonResolver = '{"hasOwnProperty":true,"plainrep":false}'
$seed = @{ penumbra_pref_theme = $poisonTheme; penumbra_pref_density = $poisonDensity; penumbra_pref_rowExpand = $poisonExpand; penumbra_resolver_prefs = $poisonResolver } | ConvertTo-Json -Compress
$pageDefs = @{
  'main'    = '?suite=main'
  'landing' = '?suite=landing&seed=' + [Uri]::EscapeDataString($seed)
  'report'  = '?suite=report&id=plainrep&seed=' + [Uri]::EscapeDataString($seed)
}

Write-Host "[2/3] running headless Edge ..."
$all = @()
foreach ($pg in ($Pages -split ',')) {
  $pg = $pg.Trim(); if (-not $pg) { continue }
  $prof = Join-Path $run ("profile_" + $pg)
  $dom  = Join-Path $run ("dom_" + $pg + ".txt")
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html' + $pageDefs[$pg]
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions',"--user-data-dir=$prof",
                '--virtual-time-budget=60000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run "err_$pg.txt") -ArgumentList $edgeArgs
  $pr.WaitForExit(300000) | Out-Null
  if (-not $pr.HasExited) { try { $pr.Kill() } catch {} }
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  $d = ''
  for ($t = 0; $t -lt 40; $t++) {
    try {
      $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
      $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close()
      if ($d.Contains('</pre>')) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  $a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
  if ($a -lt 0) { Write-Host "  [$pg] no <pre id=out> in dump ($($d.Length) bytes) - see $run" -ForegroundColor Red; $all += [pscustomobject]@{ name = "[$pg] page produced a result block"; pass = $false; detail = 'no dump' }; continue }
  $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
  if (-not $txt.StartsWith('RESULTS_JSON:')) { Write-Host "  [$pg] harness did not finish: $($txt.Substring(0, [Math]::Min(600, $txt.Length)))" -ForegroundColor Red; $all += [pscustomobject]@{ name = "[$pg] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(300, $txt.Length)) }; continue }
  $parsed = $txt.Substring(13) | ConvertFrom-Json
  if ($parsed.hookErr) { Write-Warning "[$pg] hook: $($parsed.hookErr)" }
  if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$pg] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
  foreach ($r in $parsed.results) { $all += [pscustomobject]@{ name = "[$pg] " + $r.name; pass = [bool]$r.pass; detail = $r.detail } }
}

Write-Host "[3/3] results"
$pass = 0; $fail = 0
foreach ($r in $all) {
  if ($r.pass) { $pass++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
  else { $fail++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
}
Write-Host ("SUMMARY pass={0} fail={1}" -f $pass, $fail)
Write-Host $(if ($fail -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
