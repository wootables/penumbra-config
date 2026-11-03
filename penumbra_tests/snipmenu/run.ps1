# =============================================================================
# CUSTOM CODE PANEL ROW MENU SUITE (2026-11-02, snipmenu)
#
# User: "shortcut helpers left+right click menu: insert at beginning, append to
# end, insert at cursor (if exists inside editor), anything else?, how to use >
# [function hover help text]".
#
# Headless Edge runs the REAL main.js (ready closure unwrapped), the REAL jQuery
# UI / CodeMirror / main.css / penumbra_colmenu.css and the REAL lazy
# js/penumbra_snippet_help.js through main.js's own loader; the console pops out
# with the REAL "Open in Window" button. Harness + staging come from the fnpop
# suite. See driver.js for every assert (N1..N15).
#
#   run.ps1                        the live app
#   run.ps1 -App <dir>             a stage dir holding js\ and css\ (any file it lacks comes from live)
#   run.ps1 -Control               the pre-snipmenu files (-App <orig dir>): RED
#   run.ps1 -Mutant <name>         ONE edit put back on the fix build
#   run.ps1 -Mutants               every mutant against the asserts it MUST turn red
#   -Keep keeps the staging dirs.  Prints RESULT: GREEN/RED (never exits).
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<dir>\run.ps1'))) -Mutants
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$App = '', [string]$Here = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\snipmenu' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Src([string]$rel) { $p = Join-Path $App $rel; if (Test-Path -LiteralPath $p) { return $p } return (Join-Path $live $rel) }

$files = @{ main = [IO.File]::ReadAllText((Src 'js\main.js'), $utf8); module = [IO.File]::ReadAllText((Src 'js\penumbra_snippet_help.js'), $utf8);
            css = [IO.File]::ReadAllText((Src 'css\penumbra_snippet_help.css'), $utf8) }
# The ids of the generated Custom Code topic (its headings, and action_feedback's block): every
# card's link must land on one (K1). openHelpCenter's jump takes any id in the topic.
$topic = [IO.File]::ReadAllText((Src 'help\topics\optionsHelpLightbox.php'), $utf8)
$anchors = @([regex]::Matches($topic, '\sid="([A-Za-z0-9_-]+)"') | ForEach-Object { '"' + $_.Groups[1].Value + '"' })
$anchorsJson = '[' + ($anchors -join ',') + ']'
# (fnpop 3) every help topic's ids, { topic: [ids] }: a Scheduler tip's link must land on one (U1).
$helpIds = @()
foreach ($hf in (Get-ChildItem -LiteralPath (Split-Path (Src 'help\topics\optionsHelpLightbox.php')) -Filter '*.php')) {
  $ids = @([regex]::Matches([IO.File]::ReadAllText($hf.FullName, $utf8), '\sid="([A-Za-z0-9_-]+)"') | ForEach-Object { '"' + $_.Groups[1].Value + '"' })
  $helpIds += '"' + $hf.BaseName + '":[' + ($ids -join ',') + ']'
}
$helpIdsJson = '{' + ($helpIds -join ',') + '}'
# (fnpop 3) index.php's REAL Scheduler tab, PHP stripped, for the harness: its tips are what U tests.
function Get-SchedTab([string]$html) {
  $at = $html.IndexOf('<div id="scheduler-tab">')
  if ($at -lt 0) { return $null }
  $i = $at + '<div id="scheduler-tab">'.Length; $depth = 1
  $re = [regex]'<div\b|</div>'
  while ($depth -gt 0) {
    $m = $re.Match($html, $i)
    if (-not $m.Success) { return $null }
    if ($m.Value -eq '</div>') { $depth-- } else { $depth++ }
    $i = $m.Index + $m.Length
  }
  $inner = $html.Substring($at + '<div id="scheduler-tab">'.Length, $i - 6 - $at - '<div id="scheduler-tab">'.Length)
  return [regex]::Replace($inner, '(?s)<\?(php|=).*?\?>', '')
}
$schedTab = Get-SchedTab ([IO.File]::ReadAllText((Src 'index.php'), $utf8))
if (-not $schedTab) { throw 'the Scheduler tab was not found in index.php' }

# --- mutants ------------------------------------------------------------------
# name = @{ file; edits = @(@(old, new), ...); red = asserts that MUST go red }. Anchors must match once.
$mutantDefs = [ordered]@{
  # no right-click menu
  'noctx'     = @{ file = 'module'; edits = @(,@('            if (rowMenu.open(item, x, y, kbd)) { e.preventDefault(); }', '')); red = @('N1','N13') }
  # Shift+right-click opens this menu too (the browser's is gone)
  'noshift'   = @{ file = 'module'; edits = @(,@("            if (!item || (e.shiftKey && e.button === 2)) { return; }", "            if (!item) { return; }")); red = @('N11') }
  # a click on a row with no tray opens nothing again
  'noleft'    = @{ file = 'module'; edits = @(,@('                rowMenu.open(this, r.left + 24, r.bottom, false);', '')); red = @('N5') }
  # Insert at the beginning welds the helper onto the old first line
  'nostartnl' = @{ file = 'module'; edits = @(,@("            ins = text + (empty ? '' : '\n');", "            ins = text;")); red = @('N2') }
  # Append to the end welds the helper onto the old last line
  'noendnl'   = @{ file = 'module'; edits = @(,@("            ins = (empty || pos.ch === 0 || text.charAt(0) === '\n' ? '' : '\n') + text;", "            ins = text;")); red = @('N3') }
  # the menu built in the main page while the console is popped out
  'nodoc'     = @{ file = 'module'; edits = @(@("            var m = doc.createElement('div');
            m.className = 'pnb-hm snip-row-menu';", "            var m = d.createElement('div');
            m.className = 'pnb-hm snip-row-menu';"), @('            doc.body.appendChild(m);
            var off = [];', '            d.body.appendChild(m);
            var off = [];')); red = @('N13') }
  # main.js's Escape no longer closes the menu first
  'noesc'     = @{ file = 'module'; edits = @(,@('        if (rowMenu.isOpen()) { rowMenu.closeAndRefocus(); return true; }', '')); red = @('N8') }
  # How to use opens nothing
  'nopin'     = @{ file = 'module'; edits = @(,@('                        if (c) { cardPop.pin(item, ico, c.help + (c.fn ? cardMoreHtml(c.fn) : '''')); }', '')); red = @('N9') }
  # Copy copies the placeholder text, not the realized recipe
  'norealcopy' = @{ file = 'module'; edits = @(,@('run: function () { copyToClipboard(realizeColumns(text()), item.ownerDocument); } });', 'run: function () { copyToClipboard(text(), item.ownerDocument); } });')); red = @('N10') }
}
function Apply-Mutant([string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  $set = @{ main = $files.main; module = $files.module; css = $files.css }
  $f = $mutantDefs[$name].file
  foreach ($e in $mutantDefs[$name].edits) {
    $old = $e[0]; $new = $e[1]
    if ($f -eq 'main') { $old = $old.Replace("`r`n", "`n").Replace("`n", "`r`n"); $new = $new.Replace("`r`n", "`n").Replace("`n", "`r`n") }
    else { $old = $old.Replace("`r`n", "`n"); $new = $new.Replace("`r`n", "`n") }
    $n = ([regex]::Matches($set[$f], [regex]::Escape($old))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times in $f, expected 1 (needs the FIX build): $old" }
    $set[$f] = $set[$f].Replace($old, $new)
  }
  return $set
}

# --- staging ------------------------------------------------------------------
function Stage($set, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_snipmenu_' + $tag + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
  New-Item -ItemType Directory -Force $run | Out-Null
  foreach ($f in @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js',
                   'show-hint.js','foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js',
                   'purify.min.js','penumbra_template.js','penumbra_a11y.js','penumbra_userseg.js')) {
    Copy-Item (Src "js\$f") "$run\$f" -Force
  }
  foreach ($f in @('jquery-ui.css','codemirror.min.css','show-hint.css','main.css','penumbra_colmenu.css')) { Copy-Item (Src "css\$f") "$run\$f" -Force }
  [IO.File]::WriteAllText("$run\penumbra_snippet_help.js", $set.module, $utf8)
  [IO.File]::WriteAllText("$run\penumbra_snippet_help.css", $set.css, $utf8)
  $h = [IO.File]::ReadAllText("$here\harness.html", $utf8).Replace('__ANCHORS_JSON__', $anchorsJson).Replace('__HELPIDS_JSON__', $helpIdsJson)
  $b0 = $h.IndexOf('<!--SCHED_TAB_BEGIN-->'); $b1 = $h.IndexOf('<!--SCHED_TAB_END-->')
  if ($b0 -lt 0 -or $b1 -lt 0) { throw 'harness has no SCHED_TAB markers' }
  $h = $h.Substring(0, $b0) + $schedTab + $h.Substring($b1 + '<!--SCHED_TAB_END-->'.Length)
  [IO.File]::WriteAllText("$run\harness.html", $h, $utf8)
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  $mainText = $set.main
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $NL = "`r`n"
  $hook = 'try { window.__TTH = {}; var _tthF = { ensureSnippetHelp: "ensureSnippetHelp", addEmailCapsule: "addEmailCapsule", addAccessCapsule: "addAccessCapsule", penumbraDirVars: "penumbraDirVars", penumbraDirMerge: "penumbraDirMerge" }; Object.keys(_tthF).forEach(function (k) { try { window.__TTH[k] = eval(_tthF[k]); } catch (e) { (window.__TTH_MISSING = window.__TTH_MISSING || []).push(_tthF[k]); } }); } catch (e) { window.__TTH_ERR = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_tth.js", $patched, $utf8)
  return $run
}

function Invoke-Edge([string]$run, [string]$query, [string]$tag) {
  $prof = Join-Path $run ('profile_' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
  $dom  = Join-Path $run ('dom_' + [Guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html' + $query
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--disable-popup-blocking',
                '--no-first-run','--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1800,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=120000','--dump-dom', $url)
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

function Invoke-Pages($set, [string]$tag) {
  $run = Stage $set $tag
  $all = @()
  foreach ($q in @('')) { $res = Invoke-Edge $run $q "$tag$q"; $all += $res }
  if ($Keep) { Write-Host "kept: $run" } else { try { [IO.Directory]::Delete($run, $true) } catch {} }
  return ,$all
}

function Show([object[]]$res, [ref]$pass, [ref]$fail) {
  foreach ($r in $res) {
    if ($r.pass) { $pass.Value++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $fail.Value++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
}

if ($Mutants) {
  Write-Host "[mutants] app: $App"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $res = Invoke-Pages (Apply-Mutant $name) $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-11} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-11} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

$set = if ($Mutant) { Apply-Mutant $Mutant } else { @{ main = $files.main; module = $files.module; css = $files.css } }
Write-Host "[1/1] browser     app: $App$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: expect RED)' })"
$p = 0; $f = 0
$res = Invoke-Pages $set 'run'
Show $res ([ref]$p) ([ref]$f)
Write-Host ("SUMMARY browser pass={0} fail={1}" -f $p, $f)
Write-Host $(if ($f -eq 0 -and $p -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
