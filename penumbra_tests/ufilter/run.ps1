# =============================================================================
# PROFILE-POPOVER LIST FILTER SUITE "ufilter" (2026-10-14)
#
# The small filter box in the status bar's profile card ("Your reports" header
# row - it replaced the admin-only "Ctrl+O opens the repository" tip). The
# engine lives in js/penumbra_userseg.js (applyFilter / filterOnOpen, one
# engine for index.php's card and the admin chrome twin); the markup is
# penumbra_userseg_filter_html() in penumbra_admin_chrome.php.
#
#   F1       the header row holds the box (search type, label, aria-controls, glyph)
#   F2-F3    opening the card: lists rendered, focus in an EMPTY box, every row shown
#   F4-F7    title / short id / several terms (AND) / case
#   F8-F9    "No matches" per list while a term hides every row; clearing restores
#   F10      the pinned-snapshots list follows the same box (name and tooltip)
#   F11      a re-render (pin toggle) keeps the filter applied
#   F12-F14  Enter opens the first match, only while something is typed; ArrowDown
#            moves focus to it
#   F15-F16  Escape closes the card (focus back on the avatar); reopening resets
#   F17-F18  the autofocus guard: a phone (coarse pointer AND a phone-narrow viewport)
#            is not auto-focused, a touch laptop (coarse pointer, wide viewport) is -
#            the user's own machine reports hover:none + pointer:coarse at 1884px
#   F19      no page errors
#
# The harness is the CHROME mount (vanilla wireChromeBar) with the REAL main.css
# and the REAL PHP helper output (php.exe evaluates it from the
# penumbra_admin_chrome.php under test - a build without the helper gets the old
# plain header). Headless Edge --dump-dom; stages into %TEMP%\pnb_ufl_*; writes
# nothing to the webroot.
#
#   run.ps1                              live files          EXPECTED: 19 / 0
#   run.ps1 -UsersegJs <p> [-MainCss <p>] [-ChromePhp <p>]   other copies (a stage build)
#   run.ps1 -Control [-ControlRev <rev>] the build BEFORE the feature, from git (default
#                                        $ControlRev below = the commit that shipped it, ^):
#                                        F1 F2 F4..F18 must be red (F3, F19 stay green)
#   run.ps1 -Mutant <name> / -Mutants    one line of penumbra_userseg.js put back/broken;
#                                        each must turn exactly its own asserts red
#   -Keep                                keeps the staging dir
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ufilter'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# =============================================================================
param([string]$UsersegJs = '', [string]$MainCss = '', [string]$ChromePhp = '', [string]$Here = '',
      [switch]$Control, [string]$ControlRev = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ufilter' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$NL = "`n"   # penumbra_userseg.js is LF

# The commit that shipped the feature; its parent is the control build.
$SHIP_COMMIT = '2c6c79b'
if (-not $ControlRev) { $ControlRev = if ($SHIP_COMMIT -eq 'HEAD') { 'HEAD' } else { "$SHIP_COMMIT^" } }
$CONTROL_RED = @('F1','F2','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18')

if (-not $UsersegJs) { $UsersegJs = "$app\js\penumbra_userseg.js" }
if (-not $MainCss)   { $MainCss   = "$app\css\main.css" }
if (-not $ChromePhp) { $ChromePhp = "$app\penumbra_admin_chrome.php" }
if ($Control) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))
  $UsersegJs = Get-GitVersion $ControlRev 'js/penumbra_userseg.js'
  $ChromePhp = Get-GitVersion $ControlRev 'penumbra_admin_chrome.php'
}
foreach ($p in @($UsersegJs, $MainCss, $ChromePhp)) { if (-not (Test-Path -LiteralPath $p)) { throw "file under test not found: $p" } }
$src0 = [IO.File]::ReadAllText($UsersegJs, $utf8)

# --- mutants -----------------------------------------------------------------
# name = @{ edits = @( @(old, new), ... ); red = the assert ids that MUST go red }.
# Every anchor must be found exactly once (the FIXED build is required).
$mutantDefs = [ordered]@{
  'nohide'      = @{ edits = @(,@('        if (hide && !has) { el.className += '' '' + FILTER_HIDE; }', '        if (false) { el.className += '' '' + FILTER_HIDE; }')); red = @('F4','F5','F6','F7','F8','F10','F11','F12','F14') }
  'norerender'  = @{ edits = @(,@(('            applyFilter();   // rows were just rebuilt: narrow them to the box again' + $NL), '')); red = @('F11') }
  'noreset'     = @{ edits = @(,@(('        inp.value = '''';' + $NL + '        applyFilter();' + $NL), ('        applyFilter();' + $NL))); red = @('F16') }
  'noid'        = @{ edits = @(@('(row.getAttribute(''data-title'') || '''') + '' '' + (row.getAttribute(''data-id'') || '''') + '' ''', '(row.getAttribute(''data-title'') || '''') + '' '''),
                               @('(a ? (a.textContent || '''') + '' '' + (a.getAttribute(''title'') || '''') : '''')', '(a ? (a.textContent || '''') : '''')')); red = @('F5','F10') }
  'enteralways' = @{ edits = @(,@(('            if (!filterTerms(e.target.value).length) { return; }' + $NL), '')); red = @('F13') }
  'nofocus'     = @{ edits = @(,@(('        try { inp.focus({ preventScroll: true }); } catch (e2) { try { inp.focus(); } catch (e3) {} }' + $NL), '')); red = @('F2','F16') }
  'noempty'     = @{ edits = @(,@('            if (active && rows.length && !shown) {', '            if (false) {')); red = @('F8','F10') }
  'nokeys'      = @{ edits = @(,@('        if (!e.target || e.target.id !== FILTER_ID) { return; }', '        if (true) { return; }')); red = @('F12','F14') }
  # the autofocus guard (2026-10-14 follow-up, 2nd commit): phone = coarse pointer AND narrow viewport
  'noguard'     = @{ edits = @(,@(('        try { if (window.matchMedia && window.matchMedia(''(pointer: coarse) and (max-width: 768px)'').matches) { return; } } catch (e) {}' + $NL), '')); red = @('F17') }
  'pointeronly' = @{ edits = @(,@('window.matchMedia(''(pointer: coarse) and (max-width: 768px)'').matches', 'window.matchMedia(''(pointer: coarse)'').matches')); red = @('F17','F18') }
}

function Apply-Mutant([string]$text, [string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  foreach ($e in $mutantDefs[$name].edits) {
    if (@($e).Count -ne 2 -or -not ($e[0] -is [string]) -or -not ($e[1] -is [string])) { throw "mutant '$name': an edit is not an (old, new) pair of strings" }
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIXED build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- one staged page -----------------------------------------------------------
function New-Run([string]$usersegText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_ufl_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  Copy-Item -LiteralPath $MainCss "$run\main.css" -Force
  Copy-Item -LiteralPath "$here\driver.js" "$run\driver.js" -Force
  [IO.File]::WriteAllText("$run\penumbra_userseg.js", $usersegText, $utf8)

  # The header row from the REAL PHP helper: its source is lifted out of the
  # penumbra_admin_chrome.php under test and eval'd with the one helper it
  # calls (including the file itself would pull in the app's config / db).
  $evalPhp = @'
<?php
$src = file_get_contents($argv[1]);
if (!preg_match('/\nfunction penumbra_userseg_filter_html\(.*?\n\}\n/s', $src, $m)) { fwrite(STDERR, "helper not found\n"); exit(2); }
function penumbra_admin_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
eval($m[0]);
echo penumbra_userseg_filter_html($argv[2], $argv[3]);
'@
  [IO.File]::WriteAllText("$run\helper_eval.php", $evalPhp, $utf8)
  $pp = Start-Process -FilePath $php -PassThru -NoNewWindow -Wait -RedirectStandardOutput "$run\row.html" -RedirectStandardError "$run\row_err.txt" `
        -ArgumentList @('-n', "`"$run\helper_eval.php`"", "`"$ChromePhp`"", '"Your reports"', '"sbReportsList sbSnapPinsList"')
  $row = ''
  if ($pp.ExitCode -eq 0) { $row = [IO.File]::ReadAllText("$run\row.html", $utf8).Trim() }
  if (-not $row -or -not $row.Contains('sbUserFilter')) {
    Write-Host "  [$tag] no filter helper in $ChromePhp - the old plain header is used" -ForegroundColor DarkYellow
    $row = '<div class="sb-pop-h sb-mt">Your reports</div>'
  }
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  if (-not $harness.Contains('<!-- FILTER_ROW -->')) { throw 'harness.html has no FILTER_ROW marker' }
  $harness = $harness.Replace('<!-- FILTER_ROW -->', $row)
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)
  return $run
}

function Remove-Run([string]$run) {
  # A recursive delete only ever goes to a run dir this script made.
  if ((Split-Path $run -Leaf) -notlike 'pnb_ufl_*' -or (Split-Path $run -Parent) -ne $env:TEMP.TrimEnd('\')) { throw "refusing to delete '$run'" }
  if ($Keep) { Write-Host "kept: $run"; return }
  try { [IO.Directory]::Delete($run, $true) } catch {}
}

# --- headless Edge, --dump-dom -------------------------------------------------------
function Invoke-Dump([string]$run, [string]$tag) {
  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html'
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=15000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'err.txt') -ArgumentList $edgeArgs
  $pr.WaitForExit(180000) | Out-Null
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
      if ($parsed.fatal) { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  return ,$out
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
  Write-Host "[mutants] penumbra_userseg.js: $UsersegJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $run = New-Run (Apply-Mutant $src0 $name) $name
    $res = Invoke-Dump $run $name
    Remove-Run $run
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "penumbra_userseg.js: $UsersegJs$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { "   (CONTROL $ControlRev)" })"
Write-Host "main.css:            $MainCss"
Write-Host "chrome php:          $ChromePhp"
$text = if ($Mutant) { Apply-Mutant $src0 $Mutant } else { $src0 }
$run = New-Run $text 'browser'
$green = $true
try {
  $res = Invoke-Dump $run 'browser'
  $c = Show-Results $res 'browser'
  if ($Control) {
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($CONTROL_RED | Where-Object { $red -notcontains $_ })
    if ($missing.Count) { $green = $false; Write-Host ("  control stayed GREEN on: " + ($missing -join ' ')) -ForegroundColor Red }
    else { Write-Host ("  control: every expected assert is red (" + ($CONTROL_RED -join ' ') + ")") -ForegroundColor Green }
  } elseif ($c[1] -ne 0 -or $c[0] -eq 0) { $green = $false }
} finally { Remove-Run $run }
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
