# =============================================================================
# Run the maintenance-framework tests (penumbra_maintenance.php).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -App <path>    # run against a stage instead of live
#   powershell -File run.ps1 -Mutant        # four targeted mutants; each MUST
#                                           # go RED with the exact fail count
#                                           # named below
#
# WHAT IS UNDER TEST. The scheduler runner launches Penumbra's self-maintenance
# jobs (today: people_sync, the employee directory refresh) inline at the end
# of a cycle, once a day. The registry of jobs is code; config only schedules
# them; a .request file runs one now. All of that is decided by the pure
# functions in penumbra_maintenance.php, and this suite pins them. The runner's
# I/O half (penumbra_maintenance_tick) runs here too, over two fake jobs in a
# scratch app folder through its registry seam, and the per-run result file it
# writes (maint_<job>.result: exit code, duration, exception - what the health
# hub and the Jobs tool show as "last run") is read back (2026-09-23).
#
# -n (skip php.ini): nothing here needs an extension.
#
# EXPECTED TAIL: "PASS: 128   FAIL: 0" then "RESULT: GREEN"  (count as of 2026-09-23 pm, checks added)
#
# UNC .ps1 files are GPO-blocked here ("not digitally signed") - run the body as
# a scriptblock rather than with -File. Never add a bare `exit` for the same
# reason: it would kill the caller.
# =============================================================================
param(
    [string]$App = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Mutant
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\maintenance' }   # empty when run as a scriptblock: never fall back to the caller's cwd
if (-not $here -and $MyInvocation.MyCommand.Path) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
# Invoked as a scriptblock (the UNC workaround) neither of the above exists.
if (-not $here) { $here = '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\maintenance' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$test = Join-Path $here 'test_maintenance.php'
$src  = Join-Path $App 'penumbra_maintenance.php'

if (-not $Mutant) {
    & $php -n $test $src $App
    return
}

# --- targeted mutants -------------------------------------------------------
# Each reverts ONE decision the framework makes. The expected fail count is
# exact: a mutant that stays GREEN, or that goes red in more places than named,
# means the suite is no longer pinning what it claims to pin.
$text = [IO.File]::ReadAllText($src)
$tmp  = Join-Path $env:TEMP ('pnb_maint_mut_' + $PID)
New-Item -ItemType Directory -Force $tmp | Out-Null

$mutants = @(
    @{ Name = 'once-per-day marker ignored (a job would relaunch every 5-minute cycle)';
       From = 'if (trim((string)$lastYmd) === $today) {';   To = 'if (false) {';   Expect = 9 },
    @{ Name = 'registry check removed (any name in config would be launched)';
       From = 'if (!isset($jobs[$name])) {';   To = 'if (false) {';   Expect = 3 },
    @{ Name = 'run-now requests ignored (the .request file would do nothing)';
       From = 'if (!$on || !isset($jobs[$name]) || isset($out[''launch''][$name])) continue;';   To = 'continue;';   Expect = 8 },
    @{ Name = 'checks read stops filtering (a hand-edited or corrupt file could hand the hub a non-string or a blank warning)';
       From = 'foreach ($r[''warnings''] as $x) { if (is_string($x) && trim($x) !== '''') $w[] = $x; }';   To = 'foreach ($r[''warnings''] as $x) { $w[] = $x; }';   Expect = 2 }
)

$allGood = $true
foreach ($m in $mutants) {
    if ($text.IndexOf($m.From) -lt 0) { Write-Host ("MUTANT NOT APPLICABLE (anchor missing): " + $m.Name); $allGood = $false; continue }
    $mutated = $text.Replace($m.From, $m.To)
    $file = Join-Path $tmp 'penumbra_maintenance.php'
    [IO.File]::WriteAllText($file, $mutated)
    $out  = & $php -n $test $file $App 2>&1 | Out-String
    $fail = 0
    if ($out -match 'FAIL:\s+(\d+)') { $fail = [int]$Matches[1] }
    $verdict = if ($fail -eq $m.Expect) { 'OK  ' } else { 'BAD ' }
    if ($fail -ne $m.Expect) { $allGood = $false }
    Write-Host ("{0} mutant '{1}' -> FAIL: {2} (expected {3})" -f $verdict, $m.Name, $fail, $m.Expect)
}
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Write-Host ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
