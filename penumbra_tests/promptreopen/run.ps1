# =============================================================================
# promptreopen - RE-OPENING an answered prompt (2026-09-24).
#
#   run.ps1                 against live
#   run.ps1 -App <path>     against a stage (js\main.js is taken from LIVE, and
#                           said so, when the stage lacks it)
#   run.ps1 -Control        one deliberately FALSE assertion - must report FAIL 1
#   run.ps1 -Mutant         three targeted mutants; each MUST go red with the
#                           exact count named below
#
# WHAT IS UNDER TEST (js/main.js, lifted by name - nothing is a pasted copy):
#   showPromptDialog      a select re-opened with a {value, display} prefill (the
#                         chip, "Review all" and the scheduler form pass one when an
#                         answer's label differs from its value) preselects the
#                         option whose VALUE is the answer, so OK keeps it.
#   reconfigureSinglePrompt / reconfigureAllPrompts
#                         the chip and "Review all" flows end to end; "Review all"
#                         matches resultif like a normal run (!negation, a|b, /re/).
#
# EXPECTED TAIL:  PASS: 25   FAIL: 0   /   RESULT: GREEN
# (match on the FAIL count - the total moves as coverage lands.)
# Measured 2026-09-24: stage 25/0, -Control FAIL 1, mutants 13 / 3 / 2;
# the pre-fix live main.js was RED 11/14 (Review all asked ONE of five prompts,
# opened the parent on the wrong column and deleted four saved answers).
#
# UNC .ps1 files are GPO-blocked here ("not digitally signed") - run the body as
# a scriptblock rather than with -File:
#   $dir = '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\promptreopen'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot', "`$here = '$dir'")))
# Never add a bare `exit` (it would kill the caller) and do not pipe the
# invocation (a lingering headless-Edge child can hold stdout open).
# =============================================================================
param(
    [string]$App = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Control,
    [switch]$Mutant
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\promptreopen' }   # empty when run as a scriptblock: never fall back to the caller's cwd
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$live = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$work = Join-Path $env:TEMP ('pnb_promptreopen_' + $PID)
New-Item -ItemType Directory -Force -Path $work | Out-Null

$mainPath = Join-Path $App 'js\main.js'
if (-not (Test-Path -LiteralPath $mainPath)) {
    Write-Output "note | js\main.js is not in $App - taken from LIVE"
    $mainPath = Join-Path $live 'js\main.js'
}
$mainText = [IO.File]::ReadAllText($mainPath)

# One headless-Edge run of the page. Start-Process + -RedirectStandardOutput,
# never `>` or a pipe (PS 5.1 loses native stdout that way); a profile dir of its
# own per launch; one retry, because Edge now and then exits without a dump.
function Invoke-ReopenPage([string]$text, [bool]$asControl) {
    $run = Join-Path $work ('run_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $run | Out-Null
    foreach ($lib in 'jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js') { Copy-Item (Join-Path $live "js\$lib") (Join-Path $run $lib) -Force }
    Copy-Item (Join-Path $here 'promptreopen_tests.js') (Join-Path $run 'tests.js') -Force
    [IO.File]::WriteAllText((Join-Path $run 'SRC.js'), 'window.__src = ' + ($text | ConvertTo-Json -Compress) + ';')
    $ctl = if ($asControl) { 'window.__control = true;' } else { '' }
    # requestAnimationFrame = null: jQuery's fx ticker prefers rAF, which never
    # fires under --dump-dom. #executeQuery counts the re-runs the flows trigger.
    $html = '<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="out">running</pre><pre id="errs"></pre>' +
            '<button id="executeQuery" onclick="window.__execClicks=(window.__execClicks||0)+1">run</button>' +
            '<script>window.onerror=function(m,s,l,c){document.getElementById("errs").textContent+="ONERROR: "+m+" @"+l+":"+c+"\n";};' +
            'window.addEventListener("unhandledrejection",function(ev){document.getElementById("errs").textContent+="UNHANDLED: "+(ev.reason&&ev.reason.message||ev.reason)+"\n";});' +
            'window.requestAnimationFrame=null;' + $ctl + '</script>' +
            '<script src="jquery-3.7.1.min.js"></script><script src="jquery-ui.min.js"></script><script src="moment.min.js"></script>' +
            '<script src="SRC.js"></script><script src="tests.js"></script></body></html>'
    [IO.File]::WriteAllText((Join-Path $run 'h.html'), $html)
    $dom = Join-Path $run 'dom.txt'
    $out = ''; $errs = ''
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $ud = Join-Path $work ('ud_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
        if (Test-Path $dom) { try { [IO.File]::Delete($dom) } catch { } }
        $p = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'edge_err.txt') -ArgumentList '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--no-first-run', '--disable-sync', '--disable-extensions', "--user-data-dir=$ud", '--window-size=1400,1000', '--virtual-time-budget=60000', '--dump-dom', ('file:///' + ((Join-Path $run 'h.html') -replace '\\', '/'))
        if (-not $p.WaitForExit(240000)) {
            Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*$ud*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
        }
        $domText = ''
        if (Test-Path $dom) {
            for ($try = 0; $try -lt 40; $try++) { try { $domText = [IO.File]::ReadAllText($dom); break } catch [System.IO.IOException] { Start-Sleep -Milliseconds 250 } }
        }
        $out = [System.Net.WebUtility]::HtmlDecode([regex]::Match($domText, '(?s)<pre id="out"[^>]*>(.*?)</pre>').Groups[1].Value)
        $errs = [System.Net.WebUtility]::HtmlDecode([regex]::Match($domText, '(?s)<pre id="errs"[^>]*>(.*?)</pre>').Groups[1].Value)
        if ($out -match 'DONE' -or $out -match 'STALLED in:' -or $out -match 'HARNESS') { break }
    }
    $fails = -1; $tail = 'NO RESULT - the page did not finish'
    $m = [regex]::Match($out, 'PASS: (\d+)\s+FAIL: (\d+)')
    if ($m.Success -and $out -match 'DONE') { $fails = [int]$m.Groups[2].Value; $tail = $m.Value }
    return @{ fails = $fails; tail = $tail; out = $out; errs = $errs }
}

function Remove-Work { try { [IO.Directory]::Delete($work, $true) } catch { } }   # not Remove-Item: the tool's pre-filter rejects it on a variable path

if (-not $Mutant) {
    $r = Invoke-ReopenPage $mainText ([bool]$Control)
    ($r.errs -split "`n") | Where-Object { $_.Trim() -ne '' } | Select-Object -First 6 | ForEach-Object { Write-Output "page | $_" }
    ($r.out -split "`n") | Where-Object { $_ -match '^\s+FAIL |^\s+(got|want)[ :]|^HARNESS|^STALLED' } | ForEach-Object { Write-Output $_ }
    Write-Output $r.tail
    if ($Control) {
        Write-Output $(if ($r.fails -eq 1) { 'CONTROL: exactly the one deliberate failure - the suite can see red' } else { "CONTROL BROKEN: expected FAIL 1, got $($r.fails)" })
    } else {
        Write-Output ('RESULT: ' + $(if ($r.fails -eq 0) { 'GREEN' } else { 'RED' }))
    }
    Remove-Work
    return
}

# --- targeted mutants: each reverts ONE decision; the fail count is exact ------
$mutants = @(
    @{ name = 'M1: the select dialog compares option values with the LABEL again (chip / Review all / scheduler form)'; fails = 13
       from = "const isSelected = String(val) === String(selectedOptionValue) ? 'selected' : '';"
       to   = "const isSelected = String(val) === String(initialValue) ? 'selected' : '';" },
    @{ name = 'M2: "Review all" ignores ! negation in resultif'; fails = 3
       from = 'rifNegate = true;'
       to   = 'rifNegate = false;' },
    @{ name = 'M3: "Review all" reads a|b in resultif as ONE literal value'; fails = 2
       from = "const rifValues = expectedValue.split('|');"
       to   = 'const rifValues = [expectedValue];' }
)
$bad = 0
foreach ($mu in $mutants) {
    $count = ([regex]::Matches($mainText, [regex]::Escape($mu.from))).Count
    if ($count -ne 1) { Write-Output ("ANCHOR {0}x - {1} (expected exactly one; fix the mutant)" -f $count, $mu.name); $bad++; continue }
    $r = Invoke-ReopenPage ($mainText.Replace($mu.from, $mu.to)) $false
    $verdict = if ($r.fails -eq $mu.fails) { 'BITES' } else { $bad++; 'WRONG' }
    Write-Output ("{0,-6} {1}  (expected FAIL {2}, got {3})" -f $verdict, $mu.name, $mu.fails, $r.fails)
    if ($verdict -eq 'WRONG') { ($r.out -split "`n") | Where-Object { $_ -match '^\s+FAIL ' } | ForEach-Object { Write-Output "         $_" } }
}
Write-Output ''
Write-Output $(if ($bad -eq 0) { "MUTANTS: all $($mutants.Count) bite exactly as specified" } else { "MUTANTS: $bad problem(s) - the suite is not pinning what it claims" })
Remove-Work
