# =============================================================================
# Penumbra INFOBOX BACKTICKS suite (2026-09-27)
#
# `text in backticks` is the snippet author's "leave this alone" marker (the help
# documents it for years: `2027` instead of "2,027"). Each engine masks backtick
# contents as __PROTECTED_STRING_n__ and restores them in its own final pass over
# its own output. An action(infobox) payload LEAVES the engine before that pass:
# it is stored in _infoboxContentRegistry and rendered at click time. It printed
# "__PROTECTED_STRING_0__" (?id=fycompawd's Things to Know, 2026-09-27). Fix:
# penumbraUnmaskBackticks() puts them back into the stored copy - WITH backticks
# for raw| (engine B protects them again at click time), as plain text for tile|
# / embed| specs and for a toast, which nothing processes afterwards - and the
# dialog drops the backticks itself when it skips engine B (no rows, no calls).
#
#   A1-A6  engine A (renderReportSnippet): raw| payload, the dialog text, the real
#          link click, tile| spec, the final-pass guard, a toast
#   B1-B3  engine B (resolveInfoboxSnippet: subtitles, a box inside a box)
#   Z1-Z2  the dialog's no-rows path
#
#   powershell -File run.ps1                     live js/main.js
#   powershell -File run.ps1 -MainJs <path>      a staged copy
#   powershell -File run.ps1 -Mutant <name>      one behaviour reverted (below)
# Control = the pre-fix main.js (main.js.bak-20260927-ibticks once deployed):
# every A/B/Z check but the guards (A5, Z2, "no page errors") must FAIL there.
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ibticks'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ibticks' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }

Write-Host "[1/3] staging JS + patching main.js ..."
Write-Host "      main.js under test: $MainJs"
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js','penumbra_tiles.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
$u8 = New-Object System.Text.UTF8Encoding($false)
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One single-point change each. The anchor must occur exactly once, or the run
# throws: a mutant that silently stopped applying would read as a vacuous pass.
$mutants = @{
  'unmaskA'   = @('snippet: penumbraUnmaskBackticks(data, protectedStrings, true),', 'snippet: data,')
  'tileA'     = @('penumbraInfoboxTileLink(mode, penumbraUnmaskBackticks(data, protectedStrings, false), linkText', 'penumbraInfoboxTileLink(mode, data, linkText')
  'toast'     = @('const cleanMsg = penumbraUnmaskBackticks(stripWrappingQuotePair(decodeHtmlEntities(message)), protectedStrings, false);', 'const cleanMsg = stripWrappingQuotePair(decodeHtmlEntities(message));')
  'unmaskB'   = @('snippet: penumbraUnmaskBackticks(ibData, protectedStrings, true)', 'snippet: ibData')
  'tileB'     = @('penumbraInfoboxTileLink(ibMode, penumbraUnmaskBackticks(ibData, protectedStrings, false), linkText', 'penumbraInfoboxTileLink(ibMode, ibData, linkText')
  'zerogate'  = @('contentToRender = contentToRender.replace(/`([^`]+)`/g, function (m, c) { return c; });', '/* MUTANT zerogate */')
  'keepticks' = @('return keepBackticks ? ''`'' + protectedStrings[i] + ''`'' : String(protectedStrings[i]);', 'return String(protectedStrings[i]);')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}

# Hooks at the top of the ready closure: engine A as the parity suite drives it
# (a real CodeMirror, rows through the real sourceDataMaps parameter), engine B,
# the dialog, the registry. Assignments only - the lets they touch are read when
# CALLED, long after their temporal dead zone.
$hooks = @(
  'try { window.__IB = {',
  '  A: async function (text, maps) {',
  '    if (!snippetEditor || typeof snippetEditor.getWrapperElement !== ''function'') { snippetEditor = CodeMirror.fromTextArea(document.getElementById(''reportSnippet''), { lineNumbers: false }); }',
  '    snippetEditor.setValue(text); allResolvedPrompts = []; pendingPivotSettings = null; pendingGroupByColumn = null; window._penumbraAutoloadFired = true;',
  '    var el = document.getElementById(''reportSnippetOutput''); el.innerHTML = '''';',
  '    await renderReportSnippet(maps, false, { ignorePendingViewState: true }); return el.innerHTML; },',
  '  B: function (text, maps, cols) { allResolvedPrompts = []; return resolveInfoboxSnippet(text, maps, cols); },',
  '  show: showInfoboxDialog,',
  '  registry: function () { return _infoboxContentRegistry; } };',
  '} catch (e) { window.__IB_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running harness headless ..."
$udd = Join-Path $env:TEMP ('pnbibt_' + [guid]::NewGuid().ToString('N').Substring(0,6))
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
try { Remove-Item -LiteralPath $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json

Write-Host "[3/3] results"
if ($parsed.fatal) { Write-Host "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0 -or $parsed.fatal) { exit 1 }
