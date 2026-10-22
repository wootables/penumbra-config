# =============================================================================
# POP-OUT TOOLTIP HOSTING SUITE (2026-09-25)
#
# "When using 'Open in Window' from the admin console, the shortcut
# helpers/functions tooltips show behind the window."  jQuery UI's tooltip
# widget appends each tooltip (and its aria-live region) to the body of the
# document it captured at CREATION, and flip/fits it against the global window.
# main.js now decides per OPEN from the target's own document (a prototype
# patch beside _pipRetargetUiWidgets), and closes any tooltip still open on a
# console element before the console changes windows (_pipCloseTooltips).
#
# Headless Edge runs the REAL main.js (ready closure unwrapped, window.__TTH
# export hook), the REAL jQuery UI / penumbra_snippet_help.js / main.css, and
# the REAL "Open in Window" button opens a real window.open() window
# (--disable-popup-blocking). Two pages: harness.html (phases S D P R) and
# harness.html?mountpopped=1 (phase M: the Custom Code panel first built inside
# the console window). See driver.js for every assert.
#
#   run.ps1                        the live js\main.js
#   run.ps1 -MainJs <path>         a stage build
#   run.ps1 -StageDir <dir>        a stage dir (js\ css\): its files win over live (2026-10-22, fnpop)
#   run.ps1 -Control               the pre-fix build (js\main.js.bak-*-tiphost, or -MainJs): RED
#   run.ps1 -Mutant <name>         ONE line put back on the fix build
#   run.ps1 -Mutants               every mutant against the asserts it MUST turn red
#   run.ps1 -Real [-Shots <dir>]   also real_input.py: REAL clicks and hovers over CDP
#                                  in both windows (screenshots into -Shots)
#   -Keep keeps the staging dirs.  Prints RESULT: GREEN/RED (never exits).
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<dir>\run.ps1'))) -Mutants
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$StageDir = '', [string]$MainJs = '', [string]$Here = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control,
      [switch]$Real, [string]$Shots = '', [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\tiphost' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$css  = "$app\css"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control -and -not $MainJs) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $b = Get-BakItem "$js\main.js.bak-*-tiphost" | Select-Object -Last 1
  if (-not $b) { throw '-Control needs js\main.js.bak-*-tiphost (made by the deploy), or pass -MainJs <pre-fix build>' }
  $MainJs = $b.FullName
}
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not (Test-Path -LiteralPath $MainJs)) { throw "main.js under test not found: $MainJs" }
$mainSrc = [IO.File]::ReadAllText($MainJs, $utf8)

# --- mutants ------------------------------------------------------------------
# name = @{ edits = @(@(old, new), ...); red = asserts that MUST go red }. Anchors must match once.
$mutantDefs = [ordered]@{
  # the tooltip goes back to the CREATION document's body
  'noappendto' = @{ edits = @(,@('return (doc && doc.body) || this.document[0].body;', 'return this.document[0].body;')); red = @('P4','P7','Q2') }
  # collision is checked against the tab's window again
  'nowithin'   = @{ edits = @(,@('            pos.within = doc.defaultView;', '')); red = @('P7') }
  # the screen-reader live region stays where the widget was created
  'nolive'     = @{ edits = @(,@('                try { doc.body.appendChild(live); } catch (err) { }', '')); red = @('P4L') }
  # the whole patch skipped at boot (e.g. the idempotence guard misfiring)
  'noinstall'  = @{ edits = @(,@('        if (!proto || proto._pnbOwnDocument) return;', '        if (!proto || !proto._pnbOwnDocument) return;')); red = @('P4','P7','P4L','Q2') }
  # an open console tooltip is not closed before the console leaves the tab / comes back
  'noclosemount'   = @{ edits = @(,@('            _pipCloseTooltips(wrapperEl);   // or they are stranded in the tab', '')); red = @('Q1') }
  'nocloserestore' = @{ edits = @(,@('            _pipCloseTooltips(wrapperEl);   // or they close with the window, still "open"', '')); red = @('Q2') }
}
function Apply-Mutant([string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  $text = $mainSrc
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIX build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- staging ------------------------------------------------------------------
function Stage([string]$mainText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_tth_' + $tag + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
  New-Item -ItemType Directory -Force $run | Out-Null
  foreach ($f in @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js',
                   'show-hint.js','foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js',
                   'purify.min.js','penumbra_template.js','penumbra_a11y.js','penumbra_userseg.js','penumbra_snippet_help.js')) {
    $sf = if ($StageDir -and (Test-Path -LiteralPath "$StageDir\js\$f")) { "$StageDir\js\$f" } else { "$js\$f" }; Copy-Item $sf "$run\$f" -Force
  }
  foreach ($f in @('jquery-ui.css','codemirror.min.css','show-hint.css','main.css','penumbra_snippet_help.css')) { $sf = if ($StageDir -and (Test-Path -LiteralPath "$StageDir\css\$f")) { "$StageDir\css\$f" } else { "$css\$f" }; Copy-Item $sf "$run\$f" -Force }
  Copy-Item "$here\harness.html" "$run\harness.html" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  # Unwrap the ready closure so the harness runs it synchronously, with an
  # export hook at its top (function declarations are hoisted, so eval by NAME
  # finds them there; a name an older build lacks costs only its own entry).
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $NL = "`r`n"
  $hook = 'try { window.__TTH = {}; var _tthF = { ensureSnippetHelp: "ensureSnippetHelp" }; Object.keys(_tthF).forEach(function (k) { try { window.__TTH[k] = eval(_tthF[k]); } catch (e) { (window.__TTH_MISSING = window.__TTH_MISSING || []).push(_tthF[k]); } }); } catch (e) { window.__TTH_ERR = String(e); }'
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

function Invoke-Pages([string]$mainText, [string]$tag) {
  $run = Stage $mainText $tag
  $all = @()
  $res = Invoke-Edge $run '' "$tag/main"; $all += $res
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
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $res = Invoke-Pages (Apply-Mutant $name) $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    $extra = @($red | Where-Object { $mutantDefs[$name].red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-11} turns {1} red   [red: {2}]{3}" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' '), $(if ($extra.Count) { '  (also: ' + ($extra -join ' ') + ')' } else { '' })) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-11} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

$text = if ($Mutant) { Apply-Mutant $Mutant } else { $mainSrc }
Write-Host "[1/2] browser     main.js: $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: expect RED)' })"
$p = 0; $f = 0
$res = Invoke-Pages $text 'run'
Show $res ([ref]$p) ([ref]$f)
Write-Host ("SUMMARY browser pass={0} fail={1}" -f $p, $f)

$rOk = $true
if ($Real) {
  # REAL input over CDP (real_input.py): a real click opens the console window,
  # real hovers inside it, a real click on Return to Tab. -Shots <dir> keeps
  # screenshots of both windows while a helper tooltip is up.
  $run = Stage $text 'real'
  Write-Host "[2/2] real input  $run"
  & py -3 (Join-Path $here 'real_input.py') $run $Shots
  $rOk = ($LASTEXITCODE -eq 0)
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} }
}
Write-Host $(if ($f -eq 0 -and $p -gt 0 -and $rOk) { 'RESULT: GREEN' } else { 'RESULT: RED' })
