# =============================================================================
# autofillterm - how get_autofill_values.php turns the typed text of a type-ahead into
# WHERE clauses (2026-09-24): every word, split on spaces and commas, must appear in the
# display text in any order ("Rusty Earl" finds "Earl,Rusty - ..."), capped at 10 words,
# placeholders :term_N_ safe for the MS-SQL positional swap, never fewer matches than the
# old single contiguous LIKE.
#
#   & $sb                     # against live
#   & $sb -App <dir>          # against a stage (needs get_autofill_values.php)
#   & $sb -Mutant             # each mutant MUST go red by exactly its count
#
# PHP only: penumbraAutofillTermWhere() is lifted with the tokenizer - the endpoint itself is
# never included (it opens a database connection and exits).
#
# EXPECTED TAIL: "PASS: 34   FAIL: 0" then "RESULT: GREEN"  (count as of 2026-09-24)
# Before the change (live 2026-09-24 17:25) the lift fails: "PASS: 0   FAIL: 1".
#
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create((Get-Content -Raw '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\autofillterm\run.ps1'))
# Never add a bare `exit` (it would kill the caller).
# =============================================================================
param(
    [string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Mutant
)
$ErrorActionPreference = 'Stop'
# Hard-coded, not $PSScriptRoot: that is empty when the body runs as a scriptblock.
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\autofillterm'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$target = Join-Path $App 'get_autofill_values.php'

function Invoke-Term([string]$mut) {
    $args2 = @((Join-Path $here 'test_autofillterm.php'), $target)
    if ($mut) { $args2 += $mut }
    $out = & $php -n @args2 2>&1 | Out-String
    $p = -1; $f = -1
    if ($out -match 'PASS:\s+(\d+)\s+FAIL:\s+(\d+)') { $p = [int]$Matches[1]; $f = [int]$Matches[2] }
    return @{ out = $out; pass = $p; fail = $f }
}

if (-not $Mutant) {
    $r = Invoke-Term ''
    $r.out
} else {
    # Exact red counts, measured 2026-09-24. A mutant that stays green is a finding.
    $want = [ordered]@{ contiguous = 14; nocomma = 3; nocap = 1; nofallback = 2; noupper = 18; nounder = 3 }
    $bad = 0
    $base = Invoke-Term ''
    "control (no mutant): PASS $($base.pass) FAIL $($base.fail)"
    if ($base.fail -ne 0) { $bad++ }
    foreach ($k in $want.Keys) {
        $r = Invoke-Term $k
        $okm = ($r.fail -eq $want[$k])
        "mutant {0,-11} FAIL {1,3}  (want {2,3})  {3}" -f $k, $r.fail, $want[$k], $(if ($okm) { 'ok' } else { 'WRONG' })
        if (-not $okm) { $bad++ }
    }
    if ($bad -eq 0) { 'MUTANTS: ALL BITE EXACTLY' } else { "MUTANTS: $bad WRONG" }
}
