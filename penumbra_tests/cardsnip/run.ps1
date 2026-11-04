# =============================================================================
# CARDSNIP SUITE (2026-11-02) - the card view from a snippet
#
# cards|... triggers (on / off / toggle / a size word), a layout_switch Cards position (and flat beside it = the
# table without cards), a toggle_switch on cards|large, data(cards) / data(cardsize) in the report snippet
# (engine A) and the subtitle (engine B), and the controls following the viewer's own Table / Cards switch.
# Browser half: the switch motion harness + the REAL js\penumbra_cards.js. Engine C (scheduled email):
# enginec.php over the functions extract_engine_c.php lifts from schedule_runner.php (never its main loop).
#
#   run.ps1 -App <dir>          a stage tree (js\main.js, js\penumbra_cards.js, schedule_runner.php)
#   run.ps1 -Control -App <dir> the pre-change tree: every new check must be RED
#   run.ps1 -Mutants -App <dir> every mutant, each against the checks it MUST turn red
#
# UNC NOTE: -File against a UNC path is GPO-blocked. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\cardsnip'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <dir>
# ONE suite run per PowerShell call, output to a FILE. Prints RESULT: GREEN/RED. Stages into %TEMP%.
# =============================================================================
param([string]$App = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep, [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\cardsnip' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$extract = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity\extract_engine_c.php'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$NL = "`r`n"
$srcMain  = [IO.File]::ReadAllText("$App\js\main.js", $utf8)
$srcCards = [IO.File]::ReadAllText("$App\js\penumbra_cards.js", $utf8)
$srcRun   = [IO.File]::ReadAllText("$App\schedule_runner.php", $utf8)

# name = @{ file = main|cards|runner; edits = @(@(old, new), ...); red = check ids that MUST go red }
$mutantDefs = [ordered]@{
  'noexec'    = @{ file = 'main';  edits = @(,@("                    case 'cards': {$NL                        var _cvC", "                    case 'cards_x': {$NL                        var _cvC")); red = @('C1','C3','C7') }
  'nomatch'   = @{ file = 'main';  edits = @(,@("trig.slice(trig.indexOf('|') + 1)) ? 0.5 : false;", "trig.slice(trig.indexOf('|') + 1)) ? 0 : false;")); red = @('C1','C3') }
  'cardswin'  = @{ file = 'main';  edits = @(,@("trig.slice(trig.indexOf('|') + 1)) ? 0.5 : false;", "trig.slice(trig.indexOf('|') + 1)) ? 2 : false;")); red = @('C8') }
  'noflatsw'  = @{ file = 'main';  edits = @(,@("        if (cardsSw && /^(flat|table)$/.test(kind) && _pnbCardsOnNow()) return false;$NL", '')); red = @('C1','C5') }
  'noflatoff' = @{ file = 'main';  edits = @(,@("        if (/^(flat|table)$/i.test(trig.split('|')[0]) && _pnbLsHasCards(`$swc) && _pnbCardsOnNow()) {", "        if (false) {")); red = @('C2','C8b') }
  'nodataA'   = @{ file = 'main';  edits = @(,@("            case 'cards':$NL                return { kind: 'raw', v: _pnbCardsOnNow() };$NL", '')); red = @('C1','C5') }
  'nosizeA'   = @{ file = 'main';  edits = @(,@("                return { kind: 'str', v: _pnbCardSizeWord() };", "                return { kind: 'str', v: 'medium' };")); red = @('C3','C4') }
  'nodataB'   = @{ file = 'main';  edits = @(,@("                                case 'cards': return String(_pnbCardsOnNow());", '')); red = @('E1') }
  'nodetect'  = @{ file = 'main';  edits = @(,@("        if (kind === 'cards') return true;   // (cardsnip) read from the card view$NL", '')); red = @('B1','C4') }
  'noactive'  = @{ file = 'main';  edits = @(,@("        if (kind === 'cards') return _pnbCardsCmdActive(rest);   // (cardsnip)$NL", '')); red = @('C4') }
  'nobad'     = @{ file = 'main';  edits = @(,@("            else if (!o.bad) o.bad = w;", '')); red = @('C6') }
  'norender'  = @{ file = 'main';  edits = @(,@("                if (_snippetReferencesData(['cards', 'cardsize'])) renderReportSnippet(null, false);", '')); red = @('C1','C5') }
  'bigpause'  = @{ file = 'main';  edits = @(,@("renderReportSnippet(null, false);   // (csw2)", "renderReportSnippet(null, true);   // (csw2)")); red = @('V1'); big = $true }   # (csw2) a view pick as a live edit
  'notell'    = @{ file = 'cards'; edits = @(,@("        paintGrpSize();   // (bdlay3) the grouping chip's Card size line, on a board (after m-pager's two lines)`n        tellView();   // (cardsnip)`n", "        paintGrpSize();   // (bdlay3) the grouping chip's Card size line, on a board (after m-pager's two lines)`n")); red = @('C5','C1') }
  'nosizetell'= @{ file = 'cards'; edits = @(,@("        paintSize();`n        tellView();   // (cardsnip)`n", "        paintSize();`n")); red = @('C9') }
  # (dname) engine A loses the name as written: ?Unit= / [PROMPT name=Region] answer 'undefined' again
  'noraw'     = @{ file = 'main';  edits = @(,@("penumbraDataLookup(dataType, colParam, args[2], (args[0] || '').replace(/^['`"]|['`"]`$/g, ''));", 'penumbraDataLookup(dataType, colParam, args[2]);')); red = @('D1') }
  'promptlow' = @{ file = 'main';  edits = @(,@('                            if (parsed.name === nameKey) {', '                            if (parsed.name === dataType) {')); red = @('D3') }
  'nocardsC'  = @{ file = 'runner'; edits = @(,@("        if (`$lower === 'cards') return (`$_cc && (`$data === null || !empty(`$data))) ? 'true' : 'false';", "        if (`$lower === 'cards') return '';")); red = @('X1','X2') }   # (cleft) re-anchored
  'pivotC'    = @{ file = 'runner'; edits = @(,@("(`$viewMode !== 'pivot' && !empty(`$GLOBALS['penumbra_cards_email']))", "(!empty(`$GLOBALS['penumbra_cards_email']))")); red = @('X3') }
  'noviewC'   = @{ file = 'runner'; edits = @(,@('            return _snippet_data($args, $promptValues, $reportMeta, $viewMode, $data);', '            return _snippet_data($args, $promptValues, $reportMeta);')); red = @('X3') }   # (cleft) re-anchored
  # (cleft) the second card sweep's leftovers: off|xl keeps the size; the toggle's active test reads it; no rows = no cards
  'offsize'   = @{ file = 'main';  edits = @(,@("                        if (!_cvWant && _cvO.size && _cvC.size() !== _cvO.size) _cvC.setSize(_cvO.size);", '')); red = @('C10') }
  'offactive' = @{ file = 'main';  edits = @(,@("return !_pnbCardsOnNow() && (!o.size || (!!_pnbCardsApi() && _pnbCardsApi().size() === o.size));", 'return !_pnbCardsOnNow();')); red = @('C11') }
  'emptyC'    = @{ file = 'runner'; edits = @(,@("return (`$_cc && (`$data === null || !empty(`$data))) ? 'true' : 'false';", "return `$_cc ? 'true' : 'false';")); red = @('X5') }
}

function Apply-Edits([string]$text, $edits, [string]$name) {
  foreach ($e in $edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1: $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

function Invoke-Browser([string]$mainText, [string]$cardsText, [string]$tag, [string]$q = '') {
  $run = Join-Path $env:TEMP ('pnb_cs_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js','show-hint.js',
            'foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { $p = "$App\js\$f"; if (-not (Test-Path $p)) { $p = "$live\js\$f" }; Copy-Item $p "$run\$f" -Force }
  Copy-Item "$live\css\main.css" "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  Copy-Item "$here\harness.html" "$run\harness.html" -Force
  [IO.File]::WriteAllText("$run\penumbra_cards.js", $cardsText, $utf8)
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SM = { motion: function () { return typeof _pnbMotion === "undefined" ? undefined : _pnbMotion; }, groupCol: function () { return currentGroupingColumn; } }; } catch (e) { window.__SM_ERR = String(e); }',
    'try { var _smF = { render: "renderReportSnippet", subtitle: "renderReportSubtitle", lookup: "penumbraDataLookup" }; window.__SM.snipEd = function () { try { return snippetEditor; } catch (e) { return null; } }; Object.keys(_smF).forEach(function (k) { try { window.__SM[k] = eval(_smF[k]); } catch (e) { (window.__SM_MISSING = window.__SM_MISSING || []).push(_smF[k]); } }); } catch (e) { window.__SM_ERR2 = String(e); }'
  ) -join $NL
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sm.js", $patched, $utf8)
  $prof = Join-Path $run 'profile'; $dom = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html?mode=cards&Unit=Chem' + $q
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run','--no-default-browser-check',
                '--disable-sync','--disable-extensions','--window-size=1400,1000',"--user-data-dir=$prof",'--virtual-time-budget=120000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'err.txt') -ArgumentList $edgeArgs
  $pr.WaitForExit(300000) | Out-Null
  if (-not $pr.HasExited) { try { $pr.Kill() } catch {} }
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  $d = ''
  for ($t = 0; $t -lt 40; $t++) {
    try { $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); if ($d.Contains('</pre>')) { break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  $out = @()
  $a = $d.IndexOf('<pre id="out">'); $b = if ($a -ge 0) { $d.IndexOf('</pre>', $a) } else { -1 }
  if ($a -lt 0 -or $b -lt 0) { $out += [pscustomobject]@{ name = "[$tag] page produced a result block"; pass = $false; detail = "no dump - see $run" } }
  else {
    $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
    if (-not $txt.StartsWith('RESULTS_JSON:')) { $out += [pscustomobject]@{ name = "[$tag] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(400, $txt.Length)) } }
    else {
      $parsed = $txt.Substring(13) | ConvertFrom-Json
      if ($parsed.fatal) { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.hookErr) { Write-Warning "[$tag] hook: $($parsed.hookErr)" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

function Invoke-EngineC([string]$runText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_csc_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  [IO.File]::WriteAllText("$run\schedule_runner.php", $runText, $utf8)
  & $php -n -d display_errors=stderr $extract "$run\schedule_runner.php" "$run\fns.php" 2>&1 | Out-Null
  $o = & $php -n -d display_errors=stderr "$here\enginec.php" "$run\fns.php" 2>&1
  $out = @()
  $j = ($o | Where-Object { "$_".StartsWith('RESULTS_JSON:') } | Select-Object -First 1)
  if (-not $j) { $out += [pscustomobject]@{ name = "[$tag] engine C ran"; pass = $false; detail = (($o | Select-Object -First 6) -join ' | ') } }
  else { foreach ($r in ("$j".Substring(13) | ConvertFrom-Json)) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } } }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} }
  return ,$out
}

function Invoke-All([string]$m, [string]$c, [string]$r, [string]$tag) {
  $res = @()
  $res += Invoke-Browser $m $c "$tag/browser"
  $res += Invoke-Browser $m $c "$tag/big" '&rows=1001&big=1'   # (csw2) the big pass
  $res += Invoke-EngineC $r "$tag/C"
  return ,$res
}

if ($Mutants) {
  Write-Host "[mutants] app: $App"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $def = $mutantDefs[$name]
    $m = $srcMain; $c = $srcCards; $r = $srcRun
    if ($def.file -eq 'main') { $m = Apply-Edits $m $def.edits $name } elseif ($def.file -eq 'cards') { $c = Apply-Edits $c $def.edits $name } else { $r = Apply-Edits $r $def.edits $name }
    $res = if ($def.file -eq 'runner') { Invoke-EngineC $r "$name/C" } else { Invoke-Browser $m $c "$name/browser" }
    if ($def.big) { $res += Invoke-Browser $m $c "$name/big" '&rows=1001&big=1' }   # (csw2)
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($def.red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-11} turns {1} red   [red: {2}]" -f $name, ($def.red -join ' '), ($red -join ' ')) }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-11} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "app: $App$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: the pre-change tree, every new check must be RED)' })"
if ($Mutant) {
  if (-not $mutantDefs.Contains($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutantDefs.Keys) -join ', '))" }
  $def = $mutantDefs[$Mutant]
  if ($def.file -eq 'main') { $srcMain = Apply-Edits $srcMain $def.edits $Mutant } elseif ($def.file -eq 'cards') { $srcCards = Apply-Edits $srcCards $def.edits $Mutant } else { $srcRun = Apply-Edits $srcRun $def.edits $Mutant }
}
$res = Invoke-All $srcMain $srcCards $srcRun 'run'
$p = 0; $f = 0; $failed = @()
foreach ($r in $res) {
  if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") }
  else { $f++; $failed += ($r.name -split ' ')[0]; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") }
}
Write-Host ("TOTAL pass={0} fail={1}   failed: {2}" -f $p, $f, ($failed -join ' '))
Write-Host $(if ($f -eq 0 -and $p -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
