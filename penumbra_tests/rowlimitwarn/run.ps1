# =============================================================================
# STATUS BAR ROW-LIMIT WARNING SUITE (2026-09-25)
#
# The footer status bar's Rows segment carries #sbRowLimitWarn, a warning
# triangle that is meant to show when the row limiter may have trimmed the
# result (limit on, exactly 200 rows back). Nothing ever switched it on: the
# flat and grouped counts draw their warning INSIDE #resultCount (a titled span
# around an svg), the header copy of #resultCount is display:none since the bar
# took the readout over, and the bar mirrors that element's TEXT - which drops
# the span. main.js syncRowLimitWarn() (in initPenumbraStatusBar, called from
# updateRows) now switches the icon from that span, copies its words into the
# title and aria-label, warns for a pivot built from a 200-row limited fetch,
# and never for frozen snapshot data. Browser-only; no PHP half.
#
#   static half   the index.php under test: the icon ships hidden, as a LABELLED
#                 image (role=img + aria-label - the a11y module's decorative-svg
#                 sweep would otherwise aria-hide it).
#   browser half  the REAL js\main.js (ready closure unwrapped, window.__SL export
#                 hook) against the REAL css\main.css, with the status bar's lead
#                 segment LIFTED from the index.php under test. One pass (phase W).
#
#   run.ps1                      live files             EXPECTED: static 1 / 0, wide 9 / 0 (TOTAL 10 / 0)
#   run.ps1 -Control             the pre-fix .baks      EXPECTED: RED, TOTAL 4 / 6 - static 0 / 1; wide 4 / 5 (W0 W2
#                                W3 Z pass; W1 W4 W5 W6 W7 fail - the count holds its span, the icon never shows).
#                                Measured on LIVE 2026-09-25 09:50, as were all 8 mutants.
#   run.ps1 -MainJs <p> -MainCss <p> -IndexPhp <p>      any other copies (a stage build)
#   run.ps1 -Mutant <name>       ONE line of main.js broken, on the fixed build
#   run.ps1 -Mutants             every mutant in turn, each checked against the asserts it MUST turn red
#   -Keep keeps the staging dirs.  -Here <dir> runs a copy of the suite from somewhere else.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\rowlimitwarn'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\rowlimitwarn' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control) {
  # The files the deploy of this fix replaced (it shipped with the Bare header
  # option, one stamp for both). Against them W0 passes (a fixture), W1 W4-W7
  # fail - the icon never shows - and S1 fails (no role / label).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  function LastBak($pattern) { Get-BakItem $pattern | Select-Object -Last 1 }
  $bm = LastBak "$js\main.js.bak-*-bareheader"; $bi = LastBak "$app\index.php.bak-*-bareheader"; $bc = LastBak "$app\css\main.css.bak-*-bareheader"
  if (-not $MainJs)   { if (-not $bm) { throw '-Control needs js\main.js.bak-*-bareheader (made by the deploy), or pass -MainJs' }; $MainJs = $bm.FullName }
  if (-not $IndexPhp) { if ($bi) { $IndexPhp = $bi.FullName } }
  if (-not $MainCss)  { if ($bc) { $MainCss = $bc.FullName } }
}
if (-not $MainJs)   { $MainJs   = "$js\main.js" }
if (-not $MainCss)  { $MainCss  = "$app\css\main.css" }
if (-not $IndexPhp) { $IndexPhp = "$app\index.php" }
foreach ($p in @($MainJs, $MainCss, $IndexPhp)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$src0 = [IO.File]::ReadAllText($MainJs, $utf8)
$css0 = [IO.File]::ReadAllText($MainCss, $utf8)
$idx0 = [IO.File]::ReadAllText($IndexPhp, $utf8)
$NL = "`r`n"

# --- mutants -----------------------------------------------------------------
# name = @{ edits = @( @(old, new), ... ) ; red = assert ids that MUST go red }. main.js only.
$mutantDefs = [ordered]@{
  'nosync'        = @{ edits = @(,@("            syncRowLimitWarn(`$rc, `$star);$NL", "")); red = @('W1') }
  'nohide'        = @{ edits = @(,@("            `$w.css('display', note ? '' : 'none');", "            if (note) `$w.css('display', '');")); red = @('W2') }
  'fixedtitle'    = @{ edits = @(,@("            var note = `$rc.find('span[title^=`"Row limit`"]').attr('title') || '';", "            var note = `$rc.find('span[title^=`"Row limit`"]').length ? 'Row limit enabled (200 rows). This may not be the full result set.' : '';")); red = @('W1') }
  'nopivot'       = @{ edits = @(,@("                if (m && m[1].replace(/\D/g, '') === '200') note = SB_PIVOT_LIMIT_NOTE;", "")); red = @('W5') }
  'firstnumber'   = @{ edits = @(,@("var m = /([\d,.\s]+) source transactions?/.exec(", "var m = /^([\d,.\s]+)/.exec(")); red = @('W5') }
  'nolimiter'     = @{ edits = @(,@("            if (!note && `$star.length && `$('#toggleLimitBtn').hasClass('is-active') &&", "            if (!note && `$star.length &&")); red = @('W5') }
  'nosnapguard'   = @{ edits = @(,@("                    !(typeof isViewingSnapshot !== 'undefined' && isViewingSnapshot)) {", "                    true) {")); red = @('W6') }
  'noaria'        = @{ edits = @(,@("            if (note) `$w.attr({ title: note, 'aria-label': note });", "            if (note) `$w.attr({ title: note });")); red = @('W7') }
}

function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIXED build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- static half: the index.php under test -------------------------------------
function Get-LeadSegment {
  # The Rows segment of the status bar: row count + the warning icon. PHP blocks
  # (the maintainers' notes) are stripped; the segment holds no nested <div>.
  $m = [regex]::Match($idx0, '(?s)<div class="sb-seg sb-lead">.*?</div>')
  if (-not $m.Success) { return '' }
  return [regex]::Replace($m.Value, '(?s)<\?php.*?\?>\s*', '')
}
function Test-IndexPhp {
  $out = @()
  $lead = Get-LeadSegment
  $svg = [regex]::Match($lead, '<svg[^>]*id="sbRowLimitWarn"[^>]*>')
  $out += [pscustomobject]@{ name = 'S1 the row-limit icon ships hidden, as a LABELLED image (role=img + aria-label), so the a11y sweep leaves it for screen readers'
    pass = $svg.Success -and ($svg.Value -match 'role="img"') -and ($svg.Value -match 'aria-label="Row limit[^"]*"') -and ($svg.Value -match 'display:\s*none')
    detail = $(if ($svg.Success) { $svg.Value.Substring(0, [Math]::Min(260, $svg.Value.Length)) } else { 'no #sbRowLimitWarn in the lead segment' }) }
  return ,$out
}

# --- one browser run ---------------------------------------------------------
function Invoke-Browser([string]$mainText, [string]$cssText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_rl_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $cssText, $utf8)
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  # The lead segment comes from the index.php UNDER TEST, so the harness cannot
  # drift from the page.
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $lead = Get-LeadSegment
  if ($lead) { $harness = [regex]::Replace($harness, '<!-- SB_LEAD:.*?-->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $lead }) }
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure exports: the editor, and a setter for the closure's snapshot flag
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SL = { getEditor: function () { return editor; } }; } catch (e) { window.__SL_ERR = String(e); }',
    'try { var _slF = { setSnap: "(function (v) { isViewingSnapshot = v; })" }; } catch (e) {}'
  ) -join $NL
  $hook2 = 'try { Object.keys(_slF).forEach(function (k) { try { window.__SL[k] = eval(_slF[k]); } catch (e) { (window.__SL_MISSING = window.__SL_MISSING || []).push(k); } }); } catch (e) { window.__SL_ERR2 = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $hook2 + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sl.js", $patched, $utf8)

  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html'
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=60000','--dump-dom', $url)
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
$tPass = 0; $tFail = 0
$text = $src0
if ($Mutant) {
  if (-not $mutantDefs.Contains($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutantDefs.Keys) -join ', '))" }
  $text = Apply-Mutant $src0 $Mutant
} else { Write-Host '[static] the index.php under test'; $c = Show-Results (Test-IndexPhp) 'static'; $tPass += $c[0]; $tFail += $c[1] }
Write-Host '[browser] wide pass'
$res = Invoke-Browser $text $css0 'wide'
$c = Show-Results $res 'wide'; $tPass += $c[0]; $tFail += $c[1]
Write-Host ("TOTAL pass={0} fail={1}" -f $tPass, $tFail)
Write-Host $(if ($tFail -eq 0 -and $tPass -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
