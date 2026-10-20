# =============================================================================
# STATUS BAR COLUMNS CARD SUITE (2026-10-19, colscard)
#
# The user's four asks for the bar's "Cols x of y":
#   1. no "no nesting" / "no pivot" resting chip where it means nothing (the report
#      was never saved with one and the viewer never made one)
#   2. the count opens a card like every other segment's, listing every chip the
#      Cols segment can show - the ones not in use too - while the chips keep their
#      own cards for the details
#   3. the card opens the Column & Settings panel
#   4. the gear after the chips is gone (index.php, the admin chrome, main.css)
#
#   static half   T1-T4: the markup, the stylesheet, the admin chrome and the help
#                 topic under test (no gear anywhere, the card's shell after the count,
#                 the resting chips hidden in the markup, the help says Columns card)
#   browser half  driver.js under --dump-dom on the REAL main.js + main.css +
#                 penumbra_presets.js + penumbra_calc.js with the bar's segments LIFTED
#                 from the index.php under test, two pages:
#                   ?scn=main  C0-C19 (the card, its lines, the resting chips, one card
#                              at a time, Escape, keys, a viewer, the repository page)
#                   ?scn=calc  K1-K3 (&calc=HALF|{AMOUNT}/2: its line, the calc chip's
#                              popover over the card, its "list" button opens the panel)
#
#   run.ps1 -MainJs <p> -IndexPhp <p> -MainCss <p> [-CalcJs <p>] [-AdminChrome <p>] [-HelpTopic <p>]
#   (each defaults to the LIVE file)            EXPECTED on the new build: GREEN, 0 fails
#   CONTROL: the pre-change files (orig) = RED on T1-T4 and on most of C/K
#   run.ps1 ... -Mutant <name>   one line of main.js / main.css / penumbra_calc.js broken
#   run.ps1 ... -Mutants         every mutant in turn, each checked against the asserts it
#                                MUST turn red. A mutant that stays green = asserts that do not bite.
#   -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colscard'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Run it as a CHILD powershell (a runner's output is lost in-process). Prints
# RESULT: GREEN/RED instead of exiting. Stages into %TEMP%\pnb_clc_*; writes
# nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$CalcJs = '',
      [string]$AdminChrome = '', [string]$HelpTopic = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colscard' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not $MainJs)      { $MainJs      = "$js\main.js" }
if (-not $MainCss)     { $MainCss     = "$app\css\main.css" }
if (-not $IndexPhp)    { $IndexPhp    = "$app\index.php" }
if (-not $CalcJs)      { $CalcJs      = "$js\penumbra_calc.js" }
if (-not $AdminChrome) { $AdminChrome = "$app\penumbra_admin_chrome.php" }
if (-not $HelpTopic)   { $HelpTopic   = "$app\help\topics\userSettingsHelpLightbox.php" }
foreach ($p in @($MainJs, $MainCss, $IndexPhp, $CalcJs, $AdminChrome, $HelpTopic)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$SRC = @{
  main = [IO.File]::ReadAllText($MainJs, $utf8)
  css  = [IO.File]::ReadAllText($MainCss, $utf8)
  calc = [IO.File]::ReadAllText($CalcJs, $utf8)
}
$NL = "`r`n"
$LF = "`n"

# --- mutants -------------------------------------------------------------------
# name = @{ file = main|css|calc; edits = @( @(old, new), ... ); red = the assert ids that MUST go red }.
# Every anchor must be found exactly once (the NEW build is required). Single-quoted:
# the anchors hold jQuery's $( . PARENTHESIZE every side built with + .
$mutantDefs = [ordered]@{
  'restnest'   = @{ file = 'main'; edits = @(,@('            else $n.css(''display'', ''none'');', '            else $n.text(''no nesting'').addClass(''sb-off'').css(''display'', '''');')); red = @('C2') }
  'restpivot'  = @{ file = 'main'; edits = @(,@('            $p.css(''display'', _sbPivotChipShown(pivotActive, _hasPresets) ? '''' : ''none'');', '            $p.css(''display'', '''');')); red = @('C2','C14') }
  'seen'       = @{ file = 'main'; edits = @(,@(('            if (pivotActive) _sbPivotSeen = true;' + $NL), '')); red = @('C15') }
  'presetsync' = @{ file = 'main'; edits = @(,@(('                $p.css(''display'', _sbPivotChipShown(!!(currentPivotSettings && $(''#pivot-output-container'').is('':visible'')), has) ? '''' : ''none'');' + $NL), '')); red = @('C14') }
  'defpivot'   = @{ file = 'main'; edits = @(,@('            return !!(pivotActive || hasPresets || _sbPivotSeen || _sbReportDefaultPivot());', '            return !!(pivotActive || hasPresets || _sbPivotSeen);')); red = @('C14') }
  'panelclick' = @{ file = 'main'; edits = @(,@(('            e.stopPropagation();' + $NL + '            _sbColsToggle();'), '            if (typeof toggleSettingsPanel === ''function'') toggleSettingsPanel();')); red = @('C4','C6','C10') }
  'nostop'     = @{ file = 'main'; edits = @(,@(('            // Stopped here, or the document''s outside-click handler would shut the card at once.' + $NL + '            e.stopPropagation();' + $NL), '')); red = @('C4') }
  'noclose'    = @{ file = 'main'; edits = @(,@(('            $(''#sbColsSeg'').removeClass(''sb-cl-open'');   // (colscard) the Columns card' + $NL), '')); red = @('C10') }
  'noesc'      = @{ file = 'main'; edits = @(,@(('            [''sb-cl-open'', ''#sbColsOpen'', ''#sbColsPop''],' + $NL), '')); red = @('C11') }
  'repo'       = @{ file = 'main'; edits = @(,@('            var ready = total > 0 && !repo && !!document.getElementById(''sbColsPop'');', '            var ready = total > 0 && !!document.getElementById(''sbColsPop'');')); red = @('C19') }
  'norefresh'  = @{ file = 'main'; edits = @(,@('function _sbFrozenRefresh() { updateFrozenChip(); _sbColsResync(); _sbUpdateOverflow(); _sbColsRefresh(); }', 'function _sbFrozenRefresh() { updateFrozenChip(); _sbColsResync(); _sbUpdateOverflow(); }')); red = @('C9') }
  'viewer'     = @{ file = 'main'; edits = @(,@('            if (!body.contains(''restrict-pivot'') || pOn) {', '            if (true) {')); red = @('C18') }
  'settings'   = @{ file = 'main'; edits = @(,@(('            _sbCloseAllPops();' + $NL + '            _sbOpenSettings();' + $NL), ('            _sbCloseAllPops();' + $NL))); red = @('C8') }
  'snapgive'   = @{ file = 'main'; edits = @(,@('#sbAsOf, #sbAsOfPop'').length) { _sbCloseAllPops(); return; }', '#sbAsOf, #sbAsOfPop'').length) { return; }')); red = @('C10') }
  # (never name a mutant 'keys': a key named Keys shadows the dictionary's .Keys)
  'keydown'    = @{ file = 'main'; edits = @(,@('            if ($(this).hasClass(''sb-cl-ready'')) _sbColsToggle();', '            if (false) _sbColsToggle();')); red = @('C12') }
  'hidden'     = @{ file = 'main'; edits = @(,@(('            if (hiddenTh.length) rows.push({ key: ''hidden'', label: ''Hidden'', on: true, value: _sbClNames(hiddenTh.slice(0, 4).map(function (th) { return _sbFrzLabel(th); }), hiddenTh.length) });' + $NL), '')); red = @('C9') }
  'nestline'   = @{ file = 'main'; edits = @(,@('            rows.push({ key: ''nested'', label: ''Nested'', on: nest.length > 0, value: nest.length ? nest.length + '': '' + _sbClNames(nest) : ''none'' });', '            rows.push({ key: ''nested'', label: ''Nested'', on: false, value: ''none'' });')); red = @('C16') }
  'calcclose'  = @{ file = 'main'; edits = @(,@(('                    _sbCloseAllPops();' + $NL + '                    if (window.PenumbraCalc && typeof window.PenumbraCalc.openChipMenu'), '                    if (window.PenumbraCalc && typeof window.PenumbraCalc.openChipMenu')); red = @('K2') }
  'calclist'   = @{ file = 'calc'; edits = @(,@(('                if (P && typeof P.openSettingsPanel === ''function'') P.openSettingsPanel();' + $LF + '                else if (ob)'), '                if (ob)')); red = @('K3') }
  'caretcss'   = @{ file = 'css'; edits = @(,@(('#pnbStatusBar #sbColsSeg.sb-cl-ready .sb-cols-open .sb-cl-caret { display: inline-block; }' + $NL), '')); red = @('C3') }
  'cardcss'    = @{ file = 'css'; edits = @(,@(('#pnbStatusBar #sbColsSeg.sb-cl-open #sbColsPop { display: block; }' + $NL), '')); red = @('C4') }
  # round 2 (2026-10-19): the closing sweep
  'emsnap'     = @{ file = 'main'; edits = @(,@('(_tsIsSnap ? ''Snapshot - frozen data'' : ''Live query'')', '(_tsIsSnap ? ''Snapshot &mdash; frozen data'' : ''Live query'')')); red = @('T5') }
  'popcss'     = @{ file = 'css'; edits = @(,@('#pnbCalcPop button {', '#pnbCalcPopX button {')); red = @('K4') }
  'pivtitle'   = @{ file = 'main'; edits = @(,@('                $p.attr(''title'', _sbReportDefaultPivot()', '                $p.attr(''title'', false')); red = @('C14') }
  # round 2: the two reviews' fixes
  'calcguard'  = @{ file = 'main'; edits = @(,@(('            if (isViewingSnapshot || isViewingImportedFile) return [];' + $NL), '')); red = @('K5') }
  'snapkeys'   = @{ file = 'main'; edits = @(,@(('            if ($(e.target).closest(''#sbSnapshot, #sbAsOf'').length) { _sbCloseAllPops(); return; }' + $NL), '')); red = @('C20') }
  'focusclose' = @{ file = 'main'; edits = @(,@(('            if (spx && $(''#settingsPanel'').hasClass(''is-open'')) { try { spx.focus({ preventScroll: true }); } catch (err) { spx.focus(); } }' + $NL), '')); red = @('C21') }
  'resyncclick'= @{ file = 'main'; edits = @(,@(('            _sbColsResync();   // (round 2) the count and the offer as the table is NOW' + $NL), '')); red = @('C22') }
  'resyncevent'= @{ file = 'main'; edits = @(,@('function _sbFrozenRefresh() { updateFrozenChip(); _sbColsResync(); _sbUpdateOverflow(); _sbColsRefresh(); }', 'function _sbFrozenRefresh() { updateFrozenChip(); _sbUpdateOverflow(); _sbColsRefresh(); }')); red = @('C23') }
  'inuse'      = @{ file = 'main'; edits = @(,@('            if (!body.contains(''restrict-pivot'') || pOn) {', '            if (!body.contains(''restrict-pivot'')) {')); red = @('C24') }
  'place'      = @{ file = 'main'; edits = @(,@(('                _sbColsPlace();' + $NL), '')); red = @('C25') }
}

function Apply-Mutant([hashtable]$texts, [string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  $def = $mutantDefs[$name]
  $out = @{ main = $texts.main; css = $texts.css; calc = $texts.calc }
  $t = $out[$def.file]
  foreach ($e in $def.edits) {
    if (@($e).Count -ne 2 -or -not ($e[0] -is [string]) -or -not ($e[1] -is [string])) { throw "mutant '$name': an edit is not an (old, new) pair of strings - parenthesize each side built with +" }
    $n = ([regex]::Matches($t, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times in $($def.file), expected 1 (needs the NEW build): $($e[0])" }
    $t = $t.Replace($e[0], $e[1])
  }
  $out[$def.file] = $t
  return $out
}

# --- the static half -------------------------------------------------------------
function Invoke-Static([hashtable]$texts) {
  $res = @()
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $css = $texts.css
  $adm = [IO.File]::ReadAllText($AdminChrome, $utf8)
  $hlp = [IO.File]::ReadAllText($HelpTopic, $utf8)
  $sm = [regex]::Match($idx, '(?s)<div class="sb-seg sb-opt" id="sbColsSeg">.*?(?=\s*<div class="sb-spring">)')
  $seg = $sm.Value
  # The count's span ends after its caret; what follows it is the card.
  $om = [regex]::Match($seg, '(?s)id="sbColsOpen".*?<svg class="sb-caret sb-cl-caret"[^>]*>.*?</svg>\s*</span>\s*(<div[^>]*>)')
  $afterOpen = if ($om.Success) { $om.Groups[1].Value } else { '' }
  $res += [pscustomobject]@{ name = 'T1 index.php: no gear in the Cols segment; the count carries a caret and the card shell (heading, list, the panel button) follows it; the nesting and pivot chips are hidden in the markup'; pass = (
      $sm.Success -and -not $idx.Contains('sb-cols-gear') -and $om.Success -and
      $afterOpen.StartsWith('<div class="sb-pop sb-cl-pop" id="sbColsPop"') -and $seg.Contains('id="sbColsList"') -and $seg.Contains('id="sbColsSettings"') -and
      [regex]::IsMatch($seg, '<span class="sb-chip" id="sbNested" style="display:none;"></span>') -and
      [regex]::IsMatch($seg, '<span class="sb-chip sb-off" id="sbPivot"[^>]*style="display:none;"')); detail = "segment=$($sm.Success) gear=$($idx.Contains('sb-cols-gear')) next=[$($afterOpen.Substring(0, [Math]::Min(60, $afterOpen.Length)))]" }
  $res += [pscustomobject]@{ name = 'T2 main.css: no gear rules; the card opens off .sb-cl-open and the caret shows off .sb-cl-ready; the repository page keeps the count alone'; pass = (
      -not $css.Contains('sb-cols-gear') -and $css.Contains('#pnbStatusBar #sbColsSeg.sb-cl-open #sbColsPop { display: block; }') -and
      $css.Contains('#pnbStatusBar #sbColsSeg.sb-cl-ready .sb-cols-open .sb-cl-caret { display: inline-block; }') -and
      $css.Contains('body.pnb-repo-mode #sbColsSeg > :not(#sbColsOpen),') -and $css.Contains('body.pnb-repo-mode #sbColsOpen .sb-cl-caret,')); detail = "gear=$($css.Contains('sb-cols-gear'))" }
  $res += [pscustomobject]@{ name = 'T3 the admin chrome: its gear is gone too, the count stays the one opener'; pass = (
      -not $adm.Contains('sb-cols-gear') -and -not $adm.Contains('sbColsGear') -and $adm.Contains("var openers = ['sbColsOpen', 'settingsPanelHandle'];")); detail = "gear=$($adm.Contains('sb-cols-gear')) id=$($adm.Contains('sbColsGear'))" }
  $sb = [regex]::Match($hlp, '(?s)<h4 id="us-statusbar".*?<h4 id="us-columns"').Value
  $res += [pscustomobject]@{ name = 'T4 the help: the Status Bar section names the Columns card and no gear; nesting hides when there is none; a +N calculated row; the panel''s "Open it" line has no gear'; pass = (
      $sb.Length -gt 0 -and -not [regex]::IsMatch($sb, '\bgear\b') -and $sb.Contains('Columns card') -and $sb.Contains('<em>+N calculated</em>') -and
      -not $sb.Contains('<em>no nesting</em> otherwise') -and -not $hlp.Contains('cell or its gear')); detail = "section=$($sb.Length) gear=$([regex]::IsMatch($sb, '\bgear\b'))" }
  # T5 (round 2) the user's rule: no em-dash in UI copy. The bar's markup (the "—" that
  # stands for "no value" aside), the string literals of main.js's status bar (comments
  # may keep theirs; the lone '—' placeholder is fine; a spaced en-dash separator is not)
  # and the snapshot card's two lines.
  $EM = [string][char]0x2014; $EN = [string][char]0x2013
  $bar = [regex]::Match($idx, '(?s)<div id="pnbStatusBar".*?</body>').Value
  $barHits = @([regex]::Matches(($bar -replace '>&mdash;</span>', '>'), ('&mdash;|' + $EM)) | ForEach-Object { $bar.Substring([Math]::Max(0, $_.Index - 40), [Math]::Min(80, $bar.Length - [Math]::Max(0, $_.Index - 40))) })
  $main = $texts.main
  $sbi = $main.IndexOf('(function initPenumbraStatusBar() {')
  $sbe = if ($sbi -ge 0) { $main.IndexOf('refreshAll();   // paint for any report already rendered', $sbi) } else { -1 }
  $sbRegion = if ($sbi -ge 0 -and $sbe -gt $sbi) { $main.Substring($sbi, $sbe - $sbi) } else { '' }
  $lits = @([regex]::Matches($sbRegion, "'(?:[^'\\\r\n]|\\.)*'") | ForEach-Object { $_.Value } | Where-Object { ($_.Contains($EM) -or $_.Contains('&mdash;') -or $_.Contains(' ' + $EN + ' ')) -and $_ -ne ("'" + $EM + "'") })
  $snap = @(('</strong> ' + $EM + ' not live data.'), ('saved report data ' + $EM + ' not live.')) | Where-Object { $main.Contains($_) }
  $res += [pscustomobject]@{ name = 'T5 no em-dash in the status bar''s copy: its markup (the "no value" placeholder aside), main.js''s status bar strings (no spaced en-dash separator either), the snapshot card''s lines'; pass = (
      $bar.Length -gt 0 -and $sbRegion.Length -gt 0 -and $barHits.Count -eq 0 -and $lits.Count -eq 0 -and @($snap).Count -eq 0); detail = "bar=$($barHits.Count) [$(($barHits | Select-Object -First 2) -join ' | ')] js=$($lits.Count) [$(($lits | Select-Object -First 3) -join ' | ')] snap=$(@($snap).Count)" }
  return ,$res
}

# --- one staged page set ---------------------------------------------------------
function New-Run([hashtable]$texts) {
  $run = Join-Path $env:TEMP ('pnb_clc_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js','penumbra_a11y.js','penumbra_presets.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $texts.css, $utf8)
  [IO.File]::WriteAllText("$run\penumbra_calc.js", $texts.calc, $utf8)
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  # The bar's segments as the page ships them, from the index.php UNDER TEST; its
  # <?php /* */ ?> comments are dropped, any other PHP is an error.
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $sm = [regex]::Match($idx, '(?s)<div class="sb-seg sb-lead">.*?(?=\s*<div class="sb-spring">)')
  if (-not $sm.Success -or -not $sm.Value.Contains('id="sbColsSeg"')) { throw 'the status bar segments were not found in the index.php under test' }
  $seg = [regex]::Replace($sm.Value, '(?s)<\?php\s*/\*.*?\*/\s*\?>', '')
  if ($seg.Contains('<?')) { throw 'the lifted status bar segments hold PHP beyond comments - the harness cannot lift them verbatim' }
  $harness = [regex]::Replace($harness, '(?s)<!-- BAR_SEGMENTS:.*?<!-- /BAR_SEGMENTS -->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $seg })
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure exports
  $mainText = $texts.main
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__CLC = {',
    '  setName: function (v) { currentLoadedStateName = v; },',
    '  getEditor: function () { return editor; },',
    '  setPivot: function (s) { currentPivotSettings = s; },',
    '  setGroup: function (c) { currentGroupingColumn = c; currentGroupingColumns = c ? [c] : []; },',
    '  setSnap: function (v) { isViewingSnapshot = !!v; }',
    '}; } catch (e) { window.__CLC_ERR = String(e); }'
  ) -join $NL
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_clc.js", $patched, $utf8)
  return $run
}

function Remove-Run([string]$run) {
  if ((Split-Path $run -Leaf) -notlike 'pnb_clc_*' -or (Split-Path $run -Parent) -ne $env:TEMP.TrimEnd('\')) { throw "refusing to delete '$run'" }
  if ($Keep) { Write-Host "kept: $run"; return }
  try { [IO.Directory]::Delete($run, $true) } catch {}
}

function Invoke-Dump([string]$run, [string]$query, [string]$tag) {
  $prof = Join-Path $run ('profile_' + $tag)
  $dom  = Join-Path $run ('dom_' + $tag + '.txt')
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html' + $query
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=90000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -WorkingDirectory $run -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run ('err_' + $tag + '.txt')) -ArgumentList $edgeArgs
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
      if ($parsed.hookErr) { Write-Warning "[$tag] hook: $($parsed.hookErr)" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  return ,$out
}

function Invoke-Pages([string]$run) {
  $res = @()
  $res += Invoke-Dump $run '?scn=main' 'main'
  $res += Invoke-Dump $run ('?scn=calc&calc=' + [Uri]::EscapeDataString('HALF|{AMOUNT}/2')) 'calc'
  return ,$res
}

function Show-Results($res, [string]$label) {
  $p = 0; $f = 0
  foreach ($r in $res) {
    if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $f++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
  Write-Host ("SUMMARY {0} pass={1} fail={2}" -f $label, $p, $f)
  return @($p, $f)
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $mt = Apply-Mutant $SRC $name
    $run = New-Run $mt
    # Assign first: @(Invoke-Static ...) would nest its result array as ONE element, whose
    # failures then never show (an array's .pass is never -not'ed to true).
    $st = Invoke-Static $mt
    $pg = Invoke-Pages $run
    $res = @($st) + @($pg)
    Remove-Run $run
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-10} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-10} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "main.js:      $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
Write-Host "main.css:     $MainCss"
Write-Host "index.php:    $IndexPhp"
Write-Host "calc module:  $CalcJs"
Write-Host "admin chrome: $AdminChrome"
Write-Host "help topic:   $HelpTopic"
$texts = if ($Mutant) { Apply-Mutant $SRC $Mutant } else { $SRC }
$green = $true
Write-Host '[1/2] static half'
$c = Show-Results (Invoke-Static $texts) 'static'
if ($c[1] -ne 0) { $green = $false }
$run = New-Run $texts
try {
  Write-Host '[2/2] browser half (--dump-dom, two pages)'
  $c = Show-Results (Invoke-Pages $run) 'browser'
  if ($c[1] -ne 0 -or $c[0] -eq 0) { $green = $false }
} finally { Remove-Run $run }
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
