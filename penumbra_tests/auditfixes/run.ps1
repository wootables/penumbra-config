# =============================================================================
# Audit-fix test suite (2026-08-22)  -  PHP unit tests + JS harness
#
# Run the BODY as a scriptblock (UNC scripts are GPO-blocked):
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditfixes\run.ps1')); & $sb
# Never pipe the invocation (a lingering Edge child keeps stdout open).
#
# Must end:  SUMMARY php_exit=0 php_pass=37 php_fail=0 js_pass=34 js_fail=0 -> GREEN
# (counts as of 2026-09-19 - they move as tests are added; GREEN is the invariant).
# GREEN needs EACH half to print its own "N passed, M failed" line with N > 0: a half
# that dies part-way, or runs nothing, is RED even when its exit code or fail count
# reads 0. The old last line, "php_exit=255 js_fail=0", hid for weeks that the PHP
# half died on assertion 15 of 30.
#
# Mutation control: set $env:AF_SRC_RUNNER / $env:AF_SRC_MANAGE / $env:AF_SRC_MAINJS
# to a .bak before running and the suite MUST go red.
# Dependency control: $env:AF_SKIP_DEP = 'penumbra_search.php' leaves that include
# un-lifted, and the PHP half MUST stop on a NAMED "dependency not lifted" FATAL (RED).
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditfixes'
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$extract = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity\extract_engine_c.php'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$srcRunner = if ($env:AF_SRC_RUNNER) { $env:AF_SRC_RUNNER } else { "$app\schedule_runner.php" }
$srcManage = if ($env:AF_SRC_MANAGE) { $env:AF_SRC_MANAGE } else { "$app\manage_schedule.php" }
$srcMain   = if ($env:AF_SRC_MAINJS) { $env:AF_SRC_MAINJS } else { "$app\js\main.js" }

# The extractor lifts only what each SOURCE declares and never follows require_once
# (following it would drag in db_connection.php, whose top level loads the config and
# DB credentials). So every helper schedule_runner.php gets from an include is missing
# from runner_functions.php, and evaluate_custom_condition() reaches helpers in these
# four through the snippet engine (tokenizer probe, 2026-09-19). Each is side-effect
# free - pure declarations, plus one define() in themes_config.php that only the
# browser-side emitter reads - so lifting its functions is loading it minus any
# top-level code. Lifted from the LIVE files every run, like the runner; tests.php
# names any helper that is still missing.
$deps = @('penumbra_search.php', 'journal_export.php', 'penumbra_template.php', 'themes_config.php', 'penumbra_render_charts.php')  # charts: execute_email_snippet ends with penumbra_vis_apply_tokens() (2026-09-29)
$skipDeps = @(if ($env:AF_SKIP_DEP) { $env:AF_SKIP_DEP -split '[,;]' | ForEach-Object { $_.Trim() } | Where-Object { $_ } })

Write-Host "[1/4] extracting functions ($srcRunner, $srcManage, + $($deps.Count) runner includes) ..."
& $php -n $extract $srcRunner "$here\runner_functions.php" | Out-Host
if ($LASTEXITCODE -ne 0) { throw "extracting $srcRunner failed (exit $LASTEXITCODE)" }
& $php -n $extract $srcManage "$here\manage_functions.php" | Out-Host
if ($LASTEXITCODE -ne 0) { throw "extracting $srcManage failed (exit $LASTEXITCODE)" }
Get-ChildItem $here -File -Filter 'dep_*' | Remove-Item -Force
foreach ($dep in $deps) {
    if ($skipDeps -contains $dep) { Write-Host "  NOT lifting $dep (AF_SKIP_DEP)"; continue }
    & $php -n $extract "$app\$dep" "$here\dep_$dep" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "extracting $dep failed (exit $LASTEXITCODE)" }
}

Write-Host "[2/4] PHP unit tests ..."
# 2>$null, never 2>&1 (PS 5.1 turns a native command's stderr into ErrorRecords, which
# 'Stop' escalates on an otherwise clean exit), and 'Continue' around the call in case a
# caller pipes this script through 2>&1 - the same guard as groupmode\run.ps1.
$ErrorActionPreference = 'Continue'
$phpOut = @(& $php -n -d memory_limit=512M "$here\tests.php" 2>$null)
$phpExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
$phpOut | Out-Host
# Read the half's OWN verdict line. The exit code alone cannot tell "died part-way"
# (255 and no line) from "ran nothing" (0 and "0 passed").
$phpPass = $null; $phpFail = $null
foreach ($l in $phpOut) { if ("$l" -match '^(\d+) passed, (\d+) failed$') { $phpPass = [int]$Matches[1]; $phpFail = [int]$Matches[2] } }
$phpRan   = @($phpOut | Where-Object { "$_" -match '^(PASS|FAIL)  ' }).Count
$phpFatal = @($phpOut | Where-Object { "$_" -match '^(FATAL|PHP Fatal error|Fatal error)' }) | Select-Object -First 1

Write-Host "[3/4] staging JS + patching main.js ($srcMain) ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$app\js\$f" "$here\$f" -Force }
$src = [IO.File]::ReadAllText($srcMain)
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found" }
$inject  = $anchor + "`r`n    try { window.__AF = { parseAdvancedQuery: parseAdvancedQuery, evaluateParsedQuery: evaluateParsedQuery, validatePromptInput: validatePromptInput, splitValidateRules: (typeof splitValidateRules === 'function' ? splitValidateRules : null), validateCronExpression: validateCronExpression, calculateNextCronRun: (typeof calculateNextCronRun === 'function' ? calculateNextCronRun : null) }; } catch (e) { window.__AF_ERR = String(e); }`r`n"
$patched = $src.Substring(0, $src.IndexOf($anchor)) + $inject + $src.Substring($src.IndexOf($anchor) + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[4/4] JS harness in headless Edge ..."
$udd = Join-Path $here 'edgeprofile'
$dom = Join-Path $here 'js.dom.txt'
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness_js.html'
# -Wait hung here: the page finishes in seconds, but a lingering Edge child on this
# profile kept the redirected stdout open, so SUMMARY never printed (2026-09-17). The
# main process does not exit on its own either, so poll for the FINISHED dump (capped
# at 120s), then stop only processes on THIS profile and read the dump with a
# share-everything handle - tiles\run.ps1's pattern, minus sitting out the cap.
$pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList `
  '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files', `
  "--user-data-dir=$udd",'--virtual-time-budget=8000','--dump-dom',$url
$readDom = {
    try {
        $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $sr = New-Object IO.StreamReader($fs); $t = $sr.ReadToEnd(); $sr.Close(); $fs.Close(); $t
    } catch { '' }
}
$deadline = [DateTime]::Now.AddSeconds(120)
while ([DateTime]::Now -lt $deadline) {
    if ($pr.HasExited -or "$(& $readDom)".Contains('</html>')) { break }
    Start-Sleep -Milliseconds 500
}
if (-not $pr.HasExited) { $pr.Kill() }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$d = "$(& $readDom)"
$i = $d.IndexOf('<pre id="out">'); $j = if ($i -ge 0) { $d.IndexOf('</pre>', $i) } else { -1 }
$txt = if ($j -gt $i) { [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14)) } else { '(no <pre id="out"> in the dumped DOM)' }
Write-Host $txt
# Same rule as the PHP half: the harness's own "N passed, M failed" line. (The old parse
# read JS_FAIL= through $Matches, which keeps a STALE value from the caller's session
# when the line is missing - a silent js_fail=0.)
$jsPass = $null; $jsFail = $null
if ($txt -match '(?m)^(\d+) passed, (\d+) failed\s*$') { $jsPass = [int]$Matches[1]; $jsFail = [int]$Matches[2] }

$show = { param($v) if ($null -eq $v) { '?' } else { "$v" } }
$red = @()
if ($null -eq $phpPass) {
    $red += "PHP half printed no 'N passed, M failed' line - it stopped after $phpRan assertion(s)" + $(if ($phpFatal) { ": $phpFatal" } else { " (php exit $phpExit)" })
} elseif ($phpPass + $phpFail -eq 0) {
    $red += 'PHP half ran 0 assertions'
} elseif ($phpFail -gt 0) {
    $red += "$phpFail PHP assertion(s) failed"
} elseif ($phpExit -ne 0) {
    $red += "php exit $phpExit"
}
if ($null -eq $jsPass) {
    $red += "JS half printed no 'N passed, M failed' line - the harness never reported"
} elseif ($jsPass + $jsFail -eq 0) {
    $red += 'JS half ran 0 assertions'
} elseif ($jsFail -gt 0) {
    $red += "$jsFail JS assertion(s) failed"
}
$verdict = if ($red.Count) { 'RED: ' + ($red -join '; ') } else { 'GREEN' }
Write-Host ("SUMMARY php_exit={0} php_pass={1} php_fail={2} js_pass={3} js_fail={4} -> {5}" -f $phpExit, (& $show $phpPass), (& $show $phpFail), (& $show $jsPass), (& $show $jsFail), $verdict)
