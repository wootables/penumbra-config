# =============================================================================
# SCHEDULER ROW-LIMIT BANNER SUITE (2026-10-02)
#
# The scheduler form's #schedRowLimitWarning ("Row limit is on (max 200 rows)...")
# used to show whenever the limiter was on, even for a 12-row report. main.js now
# sizes it by liveQueryRowCount - the rows the report's query last returned on
# the page (set on the query's return, a known 0 on the zero-row path, null after
# clearResultsUI): hidden under 150, "may not always deliver the full result set"
# at 150-199, an at-the-cap wording at 200+, and index.php's own wording (now
# "may not always") when the count is unknown. DB_DUMP keeps its own wording.
# Round 2 (same day, 16:5x, "schedrowdump"): DB_DUMP's "Enforce row limit" banner
# is sized the same way against the dump's OWN cap - hidden under 75% of it, "may
# not always load" up to it, "reaches it" at or over it; exactly 200 rows is only
# a floor there (the report's limiter may have cut it), so it gets the unknown
# wording when the cap is higher.
#
#   static half   index.php: the banner ships hidden, in the unknown-count wording,
#                 no em dash. help_content.php: the Automatic Row Limiter block
#                 names the 150-row threshold; the DB Dump row-limit help names 75%.
#   browser half  the REAL js\main.js (ready closure unwrapped, window.__SL export
#                 hook) against the REAL css\main.css, with the banner LIFTED from
#                 the index.php under test. Real query runs through a fake
#                 query.php (one pass, phase B).
#
#   run.ps1                      live files             EXPECTED: static 3 / 0, browser 15 / 0 (TOTAL 18 / 0)
#   run.ps1 -Control             round 1's .baks        EXPECTED: RED - every banner-sizing assert fails
#   run.ps1 -Control2            round 2's .baks        EXPECTED: RED on exactly S3 B11 B12 B13 (round 1 = dump unsized)
#   run.ps1 -MainJs <p> -MainCss <p> -IndexPhp <p> -HelpPhp <p>      any other copies (a stage build)
#   run.ps1 -Mutant <name>       ONE line of main.js broken, on the fixed build
#   run.ps1 -Mutants             every mutant in turn, each checked against the asserts it MUST turn red
#   -Keep keeps the staging dirs.  -Here <dir> runs a copy of the suite from somewhere else.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\schedrowwarn'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$HelpPhp = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Control2, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\schedrowwarn' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control -or $Control2) {
  # The files a deploy of this change replaced: round 1 (-Control) or round 2 (-Control2,
  # which left index.php alone - the live one is used).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  function LastBak($pattern) { Get-BakItem $pattern | Select-Object -Last 1 }
  $tagB = if ($Control2) { 'schedrowdump' } else { 'schedrowwarn' }
  $bm = LastBak "$js\main.js.bak-*-$tagB"; $bi = LastBak "$app\index.php.bak-*-$tagB"; $bh = LastBak "$app\help_content.php.bak-*-$tagB"
  if (-not $MainJs)   { if (-not $bm) { throw "-Control needs js\main.js.bak-*-$tagB (made by the deploy), or pass -MainJs" }; $MainJs = $bm.FullName }
  if (-not $IndexPhp) { if ($bi) { $IndexPhp = $bi.FullName } }
  if (-not $HelpPhp)  { if ($bh) { $HelpPhp = $bh.FullName } }
}
if (-not $MainJs)   { $MainJs   = "$js\main.js" }
if (-not $MainCss)  { $MainCss  = "$app\css\main.css" }
if (-not $IndexPhp) { $IndexPhp = "$app\index.php" }
if (-not $HelpPhp)  { $HelpPhp  = "$app\help\topics\sqlHelpLightbox.php" }   # (2026-10-19) the v1 help is gone; S3 reads the Scheduler topic
foreach ($p in @($MainJs, $MainCss, $IndexPhp, $HelpPhp)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$src0  = [IO.File]::ReadAllText($MainJs, $utf8)
$css0  = [IO.File]::ReadAllText($MainCss, $utf8)
$idx0  = [IO.File]::ReadAllText($IndexPhp, $utf8)
$help0 = [IO.File]::ReadAllText($HelpPhp, $utf8)
$NL = "`r`n"

# --- mutants -----------------------------------------------------------------
# name = @{ edits = @( @(old, new), ... ) ; red = assert ids that MUST go red }. main.js only.
$mutantDefs = [ordered]@{
  'nothreshold' = @{ edits = @(,@('            (n !== null && n < SCHED_ROW_WARN_MIN_ROWS)) {', '            false) {')); red = @('B2', 'B3', 'B8') }
  'min200'      = @{ edits = @(,@('    var SCHED_ROW_WARN_MIN_ROWS = 150;', '    var SCHED_ROW_WARN_MIN_ROWS = 200;')); red = @('B3', 'B4') }
  'nonear'      = @{ edits = @(,@('        } else if (n !== null && n < 200) {', '        } else if (n !== null && n < 0) {')); red = @('B3', 'B4') }
  'nocount'     = @{ edits = @(,@(('                    liveQueryRowCount = data.length;' + $NL), '')); red = @('B2') }
  'norefresh'   = @{ edits = @(,@(('liveQueryRowCount = data.length;' + $NL + '                    if (window.updateSchedRowLimitWarning) {'), ('liveQueryRowCount = data.length;' + $NL + '                    if (false) {'))); red = @('B2') }
  'nozero'      = @{ edits = @(,@(('                        liveQueryRowCount = 0;' + $NL), '')); red = @('B8') }
  'noclear'     = @{ edits = @(,@(('        liveQueryRowCount = null;' + $NL + '        //Bruce'), '        //Bruce')); red = @('B9') }
  'masterrows'  = @{ edits = @(,@('        var n = liveQueryRowCount;', '        var n = masterRowData.length || null;')); red = @('B8') }
  # round 2: DB_DUMP enforce
  'dumpnosize'  = @{ edits = @(,@('            var exact = dn !== null && dn !== 200;', '            var exact = false;')); red = @('B11', 'B12') }
  'dumpfloor'   = @{ edits = @(,@('            var exact = dn !== null && dn !== 200;', '            var exact = dn !== null;')); red = @('B13') }
  'dumpbuffer'  = @{ edits = @(,@('            if (exact && dn < dumpLimit * SCHED_ROW_WARN_MIN_ROWS / 200) {', '            if (exact && dn < SCHED_ROW_WARN_MIN_ROWS) {')); red = @('B12') }
}

function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIXED build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- static half ---------------------------------------------------------------
function Get-SchedWarn {
  # The banner holds no nested <div>; PHP blocks are stripped.
  $m = [regex]::Match($idx0, '(?s)<div id="schedRowLimitWarning".*?</div>')
  if (-not $m.Success) { return '' }
  return [regex]::Replace($m.Value, '(?s)<\?php.*?\?>\s*', '')
}
function Get-LeadSegment {
  $m = [regex]::Match($idx0, '(?s)<div class="sb-seg sb-lead">.*?</div>')
  if (-not $m.Success) { return '' }
  return [regex]::Replace($m.Value, '(?s)<\?php.*?\?>\s*', '')
}
function Test-Static {
  $out = @()
  $w = Get-SchedWarn
  $words = [regex]::Replace($w, '(?s)<[^>]+>', ' ')
  $out += [pscustomobject]@{ name = 'S1 index.php: the banner ships hidden, in the unknown-count wording ("may not always deliver the full result set"), with no em dash'
    pass = ($w -ne '') -and ($w -match 'style="display:none') -and ($words -match 'Row limit is on \(max 200 rows\)') -and ($words -match 'may not always deliver the full result set') -and -not ($w -match '&mdash;|&ndash;|\u2014|\u2013')
    detail = $(if ($w) { ([regex]::Replace($words, '\s+', ' ')).Trim() } else { 'no #schedRowLimitWarning in index.php' }) }
  $m = [regex]::Match($help0, '(?s)<h4 id="sql-rowlimiter"[^>]*>Automatic Row Limiter</h4>.*?<h4 ')
  $out += [pscustomobject]@{ name = 'S2 help_content.php: the Automatic Row Limiter help names the scheduler banner and its 150-row threshold'
    pass = $m.Success -and ($m.Value -match 'Scheduler form warns') -and ($m.Value -match '150 rows')
    detail = $(if ($m.Success) { 'block ' + $m.Value.Length + ' chars' } else { 'no Automatic Row Limiter block' }) }
  $helpSched = [IO.File]::ReadAllText((Join-Path (Split-Path -Parent $HelpPhp) 'schedulerHelpLightbox.php'), $utf8)
  $d = [regex]::Match($helpSched, '(?s)<strong>This choice replaces the report''s own limiter</strong>.*?</table>')
  $out += [pscustomobject]@{ name = 'S3 help_content.php: the DB Dump row-limit help says the warning stays silent under 75% of the dump''s cap'
    pass = $d.Success -and ($d.Value -match 'under 75% of it') -and ($d.Value -match 'may not always load the full result set')
    detail = $(if ($d.Success) { 'paragraph ' + $d.Value.Length + ' chars' } else { 'no DB Dump limiter paragraph' }) }
  return ,$out
}

# --- one browser run ---------------------------------------------------------
function Invoke-Browser([string]$mainText, [string]$cssText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_srw_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $cssText, $utf8)
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  # The banner and the status bar's lead segment come from the index.php UNDER
  # TEST, so the harness cannot drift from the page.
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $lead = Get-LeadSegment
  if ($lead) { $harness = [regex]::Replace($harness, '<!-- SB_LEAD:.*?-->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $lead }) }
  $sw = Get-SchedWarn
  if ($sw) { $harness = [regex]::Replace($harness, '<!-- SCHED_WARN:.*?-->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $sw }) }
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure export: the editor
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = 'try { window.__SL = { getEditor: function () { return editor; } }; } catch (e) { window.__SL_ERR = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sl.js", $patched, $utf8)

  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html'
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
  $m = [regex]::Match($d, '(?s)<pre id="out"[^>]*>(.*?)</pre>')
  if (-not $m.Success) { $out += [pscustomobject]@{ name = "[$tag] page produced a result block"; pass = $false; detail = "no dump ($($d.Length) bytes) - see $run" } }
  else {
    $txt = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
    if (-not $txt.StartsWith('RESULTS_JSON:')) { $out += [pscustomobject]@{ name = "[$tag] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(400, $txt.Length)) } }
    else {
      $parsed = $txt.Substring(13) | ConvertFrom-Json
      if ($parsed.fatal)   { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.hookErr) { Write-Warning "[$tag] hook: $($parsed.hookErr)" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $res = Invoke-Browser (Apply-Mutant $src0 $name) $css0 $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

# Returns @(pass, fail). NOT $script: counters - the body runs as a scriptblock.
function Show-Results($res, [string]$label) {
  $p = 0; $f = 0
  foreach ($r in $res) {
    if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $f++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
  Write-Host ("SUMMARY {0} pass={1} fail={2}" -f $label, $p, $f)
  return @($p, $f)
}

Write-Host "main.js:   $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
Write-Host "main.css:  $MainCss"
Write-Host "index.php: $IndexPhp"
Write-Host "help:      $HelpPhp"
$tPass = 0; $tFail = 0
$text = $src0
if ($Mutant) {
  if (-not $mutantDefs.Contains($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutantDefs.Keys) -join ', '))" }
  $text = Apply-Mutant $src0 $Mutant
} else { Write-Host '[static] index.php + help_content.php under test'; $c = Show-Results (Test-Static) 'static'; $tPass += $c[0]; $tFail += $c[1] }
Write-Host '[browser] phase B'
$res = Invoke-Browser $text $css0 'browser'
$c = Show-Results $res 'browser'; $tPass += $c[0]; $tFail += $c[1]
Write-Host ("TOTAL pass={0} fail={1}" -f $tPass, $tFail)
Write-Host $(if ($tFail -eq 0 -and $tPass -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
