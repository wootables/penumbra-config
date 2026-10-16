# =============================================================================
# SINGLE-KEY HINTS SUITE (2026-09-25)
#
# While the single-key switch is on (localStorage pnb_single_keys, WCAG 2.1.4)
# the report toolbar's tooltips name each control's single key - "(P or
# CTRL+SHIFT+P) Create a Pivot Table" - through the page's ONE global jQuery UI
# tooltip (its content callback asks _pnbSingleKeyTip as a tooltip opens);
# letters work with Caps Lock on; with the switch off nothing names a single
# key: not the tooltips, not the dashboard header ("(R)" + aria-keyshortcuts),
# not the "/" badges in the search boxes (html.pnb-keys-off, set by
# penumbra_a11y.js). The Health page takes R as well as r.
#
#   report page   the REAL main.js (ready closure unwrapped, window.__SKT export
#                 hook), penumbra_a11y.js and main.css, with the toolbar markup
#                 LIFTED from the index.php under test: phases T K S B (driver.js),
#                 then a page load with the switch already off (phase O).
#   dashboard     the REAL penumbra_dashboard.js over penumbra_tiles.js, fed the
#                 help_content.php under test: a dashboard (view + editor + the
#                 help panel's switch), the dashboards home, a dashboard opened
#                 with the switch off (D1-D11).
#   health        the log console LIFTED from the health.php under test (H0-H5).
#   static        php -l of health.php / help_content.php and the help wording.
#   real input    -Real also runs real_input.py over CDP: a REAL hover and a REAL
#                 keyboard focus open the tooltip, a REAL "P" opens the pivot
#                 builder, and the COST: the content callback per tooltip against
#                 jQuery UI's stock one, and the page's event listeners (native +
#                 jQuery) against the build before the feature (-BaseMainJs /
#                 -BaseA11yJs, default the deploy's .bak-*-singlekeytips).
#
#   run.ps1                    the live files          EXPECTED: all GREEN (see README)
#   run.ps1 -Control           the pre-feature .baks (made by the deploy): RED
#   run.ps1 -MainJs <p> -MainCss <p> -A11yJs <p> -DashJs <p> -HealthPhp <p> -HelpPhp <p> [-IndexPhp <p>]
#                              a stage build
#   run.ps1 -Mutant <name>     ONE line put back / broken on the feature build
#   run.ps1 -Mutants           every mutant in turn against the asserts it MUST turn red
#   -Keep keeps the staging dirs;  -Here <dir> runs a copy of this suite from elsewhere.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$A11yJs = '', [string]$DashJs = '',
      [string]$HealthPhp = '', [string]$HelpPhp = '', [string]$IndexPhp = '', [string]$Here = '',
      [string]$BaseMainJs = '', [string]$BaseA11yJs = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Real, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

. ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
function LastBak([string]$live) {
  $b = Get-BakItem "$live.bak-*-singlekeytips" | Select-Object -Last 1
  if ($b) { return $b.FullName } else { return '' }
}
if ($Control) {
  # The files the deploy of this feature replaced (byte-identical to the pre-feature build).
  if (-not $MainJs)    { $MainJs    = LastBak "$js\main.js" }
  if (-not $MainCss)   { $MainCss   = LastBak "$app\css\main.css" }
  if (-not $A11yJs)    { $A11yJs    = LastBak "$js\penumbra_a11y.js" }
  if (-not $DashJs)    { $DashJs    = LastBak "$js\penumbra_dashboard.js" }
  if (-not $HealthPhp) { $HealthPhp = LastBak "$app\health.php" }
  if (-not $HelpPhp)   { $HelpPhp   = LastBak "$app\help_content.php" }
  foreach ($p in @($MainJs, $MainCss, $A11yJs, $DashJs, $HealthPhp, $HelpPhp)) { if (-not $p) { throw '-Control needs the .bak-*-singlekeytips files (made by the deploy), or pass every path' } }
}
if (-not $MainJs)    { $MainJs    = "$js\main.js" }
if (-not $MainCss)   { $MainCss   = "$app\css\main.css" }
if (-not $A11yJs)    { $A11yJs    = "$js\penumbra_a11y.js" }
if (-not $DashJs)    { $DashJs    = "$js\penumbra_dashboard.js" }
if (-not $HealthPhp) { $HealthPhp = "$app\health.php" }
if (-not $HelpPhp)   { $HelpPhp   = "$app\help_content.php" }
if (-not $IndexPhp)  { $IndexPhp  = "$app\index.php" }
foreach ($p in @($MainJs, $MainCss, $A11yJs, $DashJs, $HealthPhp, $HelpPhp, $IndexPhp)) { if (-not (Test-Path -LiteralPath $p)) { throw "file under test not found: $p" } }

$src = @{
  main   = [IO.File]::ReadAllText($MainJs, $utf8)
  css    = [IO.File]::ReadAllText($MainCss, $utf8)
  a11y   = [IO.File]::ReadAllText($A11yJs, $utf8)
  dash   = [IO.File]::ReadAllText($DashJs, $utf8)
  health = [IO.File]::ReadAllText($HealthPhp, $utf8)
}
$NL = "`r`n"; $LF = "`n"

# --- mutants -----------------------------------------------------------------
# name = @{ file = main|css|a11y|dash|health; edits = @(@(old, new), ...); red = asserts that MUST go red }
# Every anchor must be found exactly once (the FEATURE build is required).
$mutantDefs = [ordered]@{
  # main.js: the tooltip hint
  'nocontent'   = @{ file = 'main'; edits = @(,@('try { t = _pnbSingleKeyTip(this, t); } catch (e) { }', '')); red = @('T1','T2','T4','T6','T8','T9') }
  'stickytitle' = @{ file = 'main'; edits = @(,@('try { t = _pnbSingleKeyTip(this, t); } catch (e) { }', "try { t = _pnbSingleKeyTip(this, t); `$(this).data('ui-tooltip-title', t); } catch (e) { }")); red = @('T3') }
  'noswitch'    = @{ file = 'main'; edits = @(,@('            if (window.penumbraSingleKeysOff && window.penumbraSingleKeysOff()) return title;', '')); red = @('T5','O2') }
  'noadmin'     = @{ file = 'main'; edits = @(,@("            if (d.admin && !(typeof penumbra_vars !== 'undefined' && penumbra_vars.isAdmin)) return title;", '')); red = @('T7') }
  'noprefix'    = @{ file = 'main'; edits = @(,@("return /^\([^()]{1,30}\) /.test(title) ? '(' + cap + ' or ' + title.slice(1) : '(' + cap + ') ' + title;", "return '(' + cap + ') ' + title;")); red = @('T1','T2','T4') }
  'notip'       = @{ file = 'main'; edits = @(,@("'p': { label: 'Pivot table builder', tip: '#pivotBtn', run:", "'p': { label: 'Pivot table builder', run:")); red = @('T1','T2','K1','K2') }
  # main.js: keys
  'nocaps'      = @{ file = 'main'; edits = @(,@("e.key !== '/' && PNB_SINGLE_KEYS[e.key.toLowerCase()]) {", "e.key !== '/' && PNB_SINGLE_KEYS[e.key]) {")); red = @('K2','K3') }
  'notyping'    = @{ file = 'main'; edits = @(,@('            if (_pnbIsTypingTarget(e.target)) return;                                   // the caret owns the key', '')); red = @('K4') }
  # main.js: the cheat sheet and the two switches
  'sheetintro'  = @{ file = 'main'; edits = @(,@(' While they are on, each toolbar button names its single key in its tooltip, and Caps Lock makes no difference.', '')); red = @('S1') }
  'sheetrow'    = @{ file = 'main'; edits = @(,@("'Dashboards: refresh, help, kiosk, edit, add a tile, settings, pause (single keys)'", "'Dashboards: refresh, home, kiosk, edit, access, settings, pause (single keys)'")); red = @('S2') }
  # (Parentheses around every concatenation: PowerShell's comma binds TIGHTER than +.)
  'nosync1'     = @{ file = 'main'; edits = @(,@(($NL + '            if (window.penumbraSingleKeysSync) window.penumbraSingleKeysSync();   // the "/" badges follow'), '')); red = @('B2') }
  'nosync2'     = @{ file = 'main'; edits = @(,@(($NL + '                if (window.penumbraSingleKeysSync) window.penumbraSingleKeysSync();   // the "/" badges follow'), '')); red = @('S3') }
  # main.js: the search box's placeholder names its "/" (2026-10-06, the badge became the column arrow)
  'nophload'    = @{ file = 'main'; edits = @(,@(($NL + '    _pnbSearchPlaceholder();'), '')); red = @('L1') }
  'nophfocus'   = @{ file = 'main'; edits = @(,@(('    $("#tableSearch").on("focus blur", _pnbSearchPlaceholder);' + $NL), '')); red = @('L2') }
  'nophsync1'   = @{ file = 'main'; edits = @(,@(($NL + '            if (window.penumbraSearchPlaceholder) window.penumbraSearchPlaceholder();   // and the search box''s "/" hint'), '')); red = @('B2') }
  'nophsync2'   = @{ file = 'main'; edits = @(,@(($NL + '                if (window.penumbraSearchPlaceholder) window.penumbraSearchPlaceholder();   // and the search box''s "/" hint'), '')); red = @('S3') }
  # penumbra_a11y.js + main.css: the "/" badges
  'noloadsync'  = @{ file = 'a11y'; edits = @(,@(($LF + '    window.penumbraSingleKeysSync();'), '')); red = @('O1') }
  'noimportant' = @{ file = 'css';  edits = @(,@(('html.pnb-keys-off #openReportListLightbox .repo-search-key {' + $NL + '    display: none !important;'), ('html.pnb-keys-off #openReportListLightbox .repo-search-key {' + $NL + '    display: none;'))); red = @('B2') }
  'noisclear'   = @{ file = 'css';  edits = @(,@('html.pnb-keys-off #pnlFilterKey:not(.is-clear),', 'html.pnb-keys-off #pnlFilterKey,')); red = @('B3') }
  # penumbra_dashboard.js
  'dashalways'  = @{ file = 'dash'; edits = @(,@('        var on = !!V.shortId && !dashKeysOff();', '        var on = true;')); red = @('D5','D6','D10','D11') }
  'dashlist'    = @{ file = 'dash'; edits = @(,@('        var on = !!V.shortId && !dashKeysOff();', '        var on = !dashKeysOff();')); red = @('D10') }
  'dashnorender'= @{ file = 'dash'; edits = @(,@("        renderHead();   // the header's key hints follow the switch at once", '')); red = @('D5') }
  # health.php
  'segkeys'     = @{ file = 'main'; edits = @(,@("    `$(document).on('keydown', '#searchHelpIcon, .pnb-sbox > .pnb-sbox-seg[role=""button""]', function (e) {", "    `$(document).on('keydown', '#noSuchSegment', function (e) {")); red = @('G1') }   # (2026-10-15)
  'healthcaps'  = @{ file = 'health'; edits = @(,@("if (e.key === 'r' || e.key === 'R') {", "if (e.key === 'r') {")); red = @('H2') }
}

function Apply-Mutant([string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  $def = $mutantDefs[$name]
  $out = @{}; foreach ($k in $src.Keys) { $out[$k] = $src[$k] }
  $text = $out[$def.file]
  foreach ($e in $def.edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  $out[$def.file] = $text
  return $out
}

# --- helpers -----------------------------------------------------------------
function New-RunDir([string]$tag) {
  $d = Join-Path $env:TEMP ('pnb_skt_' + $tag + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
  New-Item -ItemType Directory -Force $d | Out-Null
  return $d
}
function Invoke-Edge([string]$run, [string]$page, [string]$query, [string]$tag) {
  $prof = Join-Path $run ('profile_' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
  $dom  = Join-Path $run ('dom_' + [Guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/' + $page + $query
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=90000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'err.txt') -ArgumentList $edgeArgs
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
  $out = @()
  $a = $d.IndexOf('<pre id="out">'); $b = if ($a -ge 0) { $d.IndexOf('</pre>', $a) } else { -1 }
  if ($a -lt 0 -or $b -lt 0) { $out += [pscustomobject]@{ name = "[$tag] page produced a result block"; pass = $false; detail = "no dump ($($d.Length) bytes) - see $run" } }
  else {
    $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
    if (-not $txt.StartsWith('RESULTS_JSON:')) { $out += [pscustomobject]@{ name = "[$tag] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(400, $txt.Length)) } }
    else {
      $parsed = $txt.Substring(13) | ConvertFrom-Json
      if ($parsed.fatal)   { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.hookErr) { Write-Host "  [$tag] hook: $($parsed.hookErr)" -ForegroundColor DarkYellow }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  return ,$out
}

# The report page's markup, LIFTED from the index.php under test.
function Lift([string]$idx, [string]$pattern, [string]$what) {
  $m = [regex]::Match($idx, $pattern)
  if (-not $m.Success) { throw "cannot lift $what from $IndexPhp" }
  return [regex]::Replace($m.Value, '(?s)<\?php.*?\?>', '')
}
function Stage-Report([hashtable]$files, [string]$mainPath, [string]$a11yText, [string]$tag) {
  $run = New-RunDir $tag
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $files.css, $utf8)
  [IO.File]::WriteAllText("$run\penumbra_a11y.js", $a11yText, $utf8)
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $h = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $lifts = [ordered]@{
    'headerToggleHandle'  = '(?s)<div id="headerToggleHandle".*?</div>'
    'toggleAiPanel'       = '(?s)<button id="toggleAiPanel".*?</button>'
    'resultsHeader'       = '(?s)<div id="resultsHeader">.*?\n</div>(?=\s*\n<\?php /\* Split header)'
    'settingsPanelHandle' = '(?s)<div id="settingsPanelHandle".*?</div>'
    'spToggles'           = '(?s)<div class="sp-section sp-toggles">.*?id="spSingleKeysToggle".*?</label>\s*</div>\s*</div>'
    'pnlFilterKey'        = '<span class="pnl-search-key" id="pnlFilterKey"[^>]*>/</span>'
  }
  foreach ($k in $lifts.Keys) {
    $v = Lift $idx $lifts[$k] $k
    $h = $h.Replace("<!-- LIFT:$k -->", $v)
  }
  if ($h -match '<!-- LIFT:') { throw 'a LIFT placeholder was left unfilled' }
  [IO.File]::WriteAllText("$run\harness.html", $h, $utf8)

  # closure exports
  $mainText = $files.main
  if ($mainPath) { $mainText = [IO.File]::ReadAllText($mainPath, $utf8) }
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SKT = { getEditor: function () { return editor; } }; } catch (e) { window.__SKT_ERR = String(e); }',
    'try { var _sktF = { tip: "_pnbSingleKeyTip", markHidden: "penumbraMarkUserHidden", runKey: "_pnbRunSingleKey" }; } catch (e) {}'
  ) -join $NL
  # By NAME through eval, so a function an older build lacks costs only its own entry.
  $hook2 = 'try { Object.keys(_sktF).forEach(function (k) { try { window.__SKT[k] = eval(_sktF[k]); } catch (e) { (window.__SKT_MISSING = window.__SKT_MISSING || []).push(_sktF[k]); } }); } catch (e) { window.__SKT_ERR2 = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $hook2 + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_skt.js", $patched, $utf8)
  return $run
}
function Stage-Dash([hashtable]$files, [string]$tag) {
  $run = New-RunDir $tag
  foreach ($f in @('jquery-3.7.1.min.js','purify.min.js','penumbra_tiles.js')) { Copy-Item "$js\$f" "$run\$f" -Force }
  foreach ($f in @('penumbra_tiles.css','penumbra_dashboard.css')) { Copy-Item "$app\css\$f" "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\dash_under_test.js", $files.dash, $utf8)
  # Base64 of the raw bytes, decoded as UTF-8 in the page: 1.4 MB is past
  # ConvertTo-Json's length cap, and bytes sidestep every escaping question.
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($HelpPhp))
  [IO.File]::WriteAllText("$run\help_frag.js", "window.__HELP = new TextDecoder('utf-8').decode(Uint8Array.from(atob('" + $b64 + "'), function (c) { return c.charCodeAt(0); }));", $utf8)
  Copy-Item "$here\dash.html" "$run\dash.html" -Force
  return $run
}
function Stage-Health([hashtable]$files, [string]$tag) {
  $run = New-RunDir $tag
  $m = [regex]::Match($files.health, "(?s)\(function \(\) \{\n    var body   = document\.getElementById\('logBody'\);.*?\n\}\)\(\);")
  if (-not $m.Success) { throw "cannot lift the log console script from $HealthPhp" }
  [IO.File]::WriteAllText("$run\health_log.js", $m.Value, $utf8)
  [IO.File]::WriteAllText("$run\penumbra_a11y.js", $files.a11y, $utf8)
  Copy-Item "$here\health.html" "$run\health.html" -Force
  return $run
}
function Drop([string]$run) { if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" } }

# Every page this suite drives, for one set of sources. $which = report,off,dash,health.
function Invoke-Pages([hashtable]$files, [string[]]$which, [string]$tag) {
  $all = @()
  if ($which -contains 'report' -or $which -contains 'off') {
    $run = Stage-Report $files '' $files.a11y "r$tag"
    if ($which -contains 'report') { $res = Invoke-Edge $run 'harness.html' '' "$tag/report"; $all += $res }
    if ($which -contains 'off')    { $res = Invoke-Edge $run 'harness.html' '?keys=off' "$tag/off"; $all += $res }
    $script:lastReportRun = $run
    if (-not $Real) { Drop $run }
  }
  if ($which -contains 'dash') {
    $run = Stage-Dash $files "d$tag"
    foreach ($q in @('?mode=view', '?mode=list', '?mode=view&keys=off')) { $res = Invoke-Edge $run 'dash.html' $q "$tag/dash$q"; $all += $res }
    Drop $run
  }
  if ($which -contains 'health') {
    $run = Stage-Health $files "h$tag"
    $res = Invoke-Edge $run 'health.html' '' "$tag/health"; $all += $res
    Drop $run
  }
  return ,$all
}

function Invoke-Static {
  $res = @()
  foreach ($f in @($HealthPhp, $HelpPhp)) {
    $l = (& $php -n -l $f) -join ' '
    $res += [pscustomobject]@{ name = 'I1 php -l ' + (Split-Path $f -Leaf); pass = ($l -match 'No syntax errors'); detail = $l }
  }
  $help = [IO.File]::ReadAllText($HelpPhp, $utf8)
  $res += [pscustomobject]@{ name = 'I2 User Settings help: the tooltips name the single keys while the switch is on, Caps Lock makes no difference'
    pass = $help.Contains('While the switch is on, each toolbar button names its single key in its tooltip') -and $help.Contains('Caps Lock makes no difference'); detail = '' }
  $res += [pscustomobject]@{ name = 'I3 ...and with it off, the tooltips and the "/" badges stop naming single keys'
    pass = $help.Contains('With it off, tooltips stop naming single keys and the <kbd>/</kbd> badges leave the search boxes.'); detail = '' }
  return ,$res
}

function Show([object[]]$res, [ref]$pass, [ref]$fail) {
  foreach ($r in $res) {
    if ($r.pass) { $pass.Value++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $fail.Value++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $def = $mutantDefs[$name]
    $mt = Apply-Mutant $name
    $which = @()
    if (@('main','css','a11y') -contains $def.file) {
      if (@($def.red | Where-Object { $_ -notlike 'O*' }).Count) { $which += 'report' }
      if (@($def.red | Where-Object { $_ -like 'O*' }).Count) { $which += 'off' }
    }
    if ($def.file -eq 'dash')   { $which += 'dash' }
    if ($def.file -eq 'health') { $which += 'health' }
    # Through a variable: @(Invoke-Pages ...) would wrap the returned array as ONE element.
    $res = Invoke-Pages $mt $which $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($def.red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($def.red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

$files = if ($Mutant) { Apply-Mutant $Mutant } else { $src }
Write-Host "[1/3] browser      main.js:  $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
Write-Host "                   a11y.js:  $A11yJs   main.css: $MainCss"
Write-Host "                   dash.js:  $DashJs"
Write-Host "                   health:   $HealthPhp   help: $HelpPhp   index.php: $IndexPhp"
$bPass = 0; $bFail = 0
$res = Invoke-Pages $files @('report','off','dash','health') 'run'
Show $res ([ref]$bPass) ([ref]$bFail)
Write-Host ("SUMMARY browser pass={0} fail={1}" -f $bPass, $bFail)

$iPass = 0; $iFail = 0
if (-not $Mutant) {
  Write-Host "[2/3] static"
  $st = Invoke-Static
  Show $st ([ref]$iPass) ([ref]$iFail)
  Write-Host ("SUMMARY static pass={0} fail={1}" -f $iPass, $iFail)
}

$rOk = $true
if ($Real) {
  $runDir = $script:lastReportRun
  if (-not $BaseMainJs) { $BaseMainJs = LastBak "$js\main.js" }
  if (-not $BaseA11yJs) { $BaseA11yJs = LastBak "$js\penumbra_a11y.js" }
  $baseDir = ''
  if ($BaseMainJs -and $BaseA11yJs) {
    $baseDir = Stage-Report $files $BaseMainJs ([IO.File]::ReadAllText($BaseA11yJs, $utf8)) 'base'
    Write-Host "[3/3] real input   $runDir   (base: $BaseMainJs)"
  } else { Write-Host "[3/3] real input   $runDir   (no base build: the listener comparison is skipped)" }
  & py -3 (Join-Path $here 'real_input.py') $runDir $baseDir
  $rOk = ($LASTEXITCODE -eq 0)
  if (-not $Keep) { foreach ($d in @($runDir, $baseDir)) { if ($d) { try { [IO.Directory]::Delete($d, $true) } catch {} } } }
}

$green = ($bFail -eq 0 -and $bPass -gt 0) -and ($iFail -eq 0) -and $rOk
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
