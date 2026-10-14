# =============================================================================
# Run the Tags admin tool tests, people side (penumbra_people_tags.php + tags_admin.php).
#   powershell -File run.ps1                 # normal run, against the LIVE app
#   powershell -File run.ps1 -App <dir>      # against a staged copy
#   powershell -File run.ps1 -Mutant         # three targeted mutants; each MUST
#                                            # go RED with the exact fail count
#                                            # named below
#
# WHAT IS UNDER TEST. The pure half of the tool: the tag-name rule (what an admin
# types -> what CK_PEOPLE_TAG_SHAPE accepts), the pasted-list parser, the SQL
# text of every read and write (the idempotent MERGE that never overwrites, the
# rename that merges, the caps), the usage snippets, the flash wording, and a
# few text pins on the page (CSRF, POST-redirect-GET, commit/rollback, audits).
# Offline, php -n. The page's live behaviour was verified by hand on 2026-09-23.
#
# EXPECTED TAIL: "PASS: N   FAIL: 0" then "RESULT: GREEN" (N = 112 as of 2026-09-25: group accounts + the header colour and member label fixes; six mutants).
#
# UNC .ps1 files are GPO-blocked here ("not digitally signed") - run the body as
# a scriptblock rather than with -File. Never add a bare `exit` for the same
# reason: it would kill the caller.
# =============================================================================
param(
    [string]$App = '\' + '\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Mutant
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\peopletags' }   # empty when run as a scriptblock: never fall back to the caller's cwd
if (-not $here -and $MyInvocation.MyCommand.Path) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $here) { $here = '\' + '\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\peopletags' }
$php  = '\' + '\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$test = Join-Path $here 'test_peopletags.php'
$src  = Join-Path $App 'penumbra_people_tags.php'
$page = Join-Path $App 'tags_admin.php'
if (-not $Mutant) {
    & $php -n $test $src $page
    return
}
# --- targeted mutants -------------------------------------------------------
# Each reverts ONE rule the tool relies on. The expected fail count is exact: a
# mutant that stays GREEN, or that goes red in more places than named, means the
# suite no longer pins what it claims to pin.
$text = [IO.File]::ReadAllText($src)
$tmp  = Join-Path $env:TEMP ('pnb_peopletags_mut_' + $PID)
New-Item -ItemType Directory -Force $tmp | Out-Null
$mutants = @(
    @{ Name = 'names no longer upper-cased (CK_PEOPLE_TAG_SHAPE would reject what the page sends)';
       From = '$t = strtoupper(trim((string)$raw));';   To = '$t = trim((string)$raw);';   Expect = 7 },
    @{ Name = 'the add MERGE overwrites an existing membership (value/note/added-by lost on a re-add)';
       From = '" WHEN NOT MATCHED THEN INSERT (EMPLID, TAG, VAL, SOURCE, ADDED_BY, ADDED_AT, NOTE)"';
       To   = '" WHEN MATCHED THEN UPDATE SET T.VAL = :val, T.NOTE = :note WHEN NOT MATCHED THEN INSERT (EMPLID, TAG, VAL, SOURCE, ADDED_BY, ADDED_AT, NOTE)"';   Expect = 2 },
    @{ Name = 'rename loses its collision guard (renaming onto an existing tag would hit the primary key)';
       From = '. " AND EMPLID NOT IN (SELECT EMPLID FROM PENUMBRA_PEOPLE_TAGS WHERE TAG = :newtag)",';   To = ',';   Expect = 2 },
    @{ Name = 'units accept any digit count (a 3-digit code would be stored and match nothing)';
       From = "if (!preg_match('/^(\d{2}|\d{4}|\d{6})$/', `$tok)) {";   To = "if (!preg_match('/^\d{2,6}$/', `$tok)) {";   Expect = 2 },
    @{ Name = 'the account update loses its SOURCE guard (an HR person could be edited from the accounts form)';
       From = '. " DEPT_NAME = :dept, JOB_TITLE = :descr, UPDATED_AT = SYSDATE WHERE EMPLID = :emplid AND SOURCE = ''MANUAL''";';   To = '. " DEPT_NAME = :dept, JOB_TITLE = :descr, UPDATED_AT = SYSDATE WHERE EMPLID = :emplid";';   Expect = 1 },
    @{ Name = 'the members query drops KIND (an account would be labelled like a person again)';
       From = 'P.ACTIVE, P.JOB_TITLE, P.KIND"';   To = 'P.ACTIVE, P.JOB_TITLE"';   Expect = 1 }
)
$allGood = $true
foreach ($m in $mutants) {
    if ($text.IndexOf($m.From) -lt 0) { Write-Host ("MUTANT NOT APPLICABLE (anchor missing): " + $m.Name); $allGood = $false; continue }
    $mutated = $text.Replace($m.From, $m.To)
    $file = Join-Path $tmp 'penumbra_people_tags.php'
    [IO.File]::WriteAllText($file, $mutated)
    $out  = & $php -n $test $file $page 2>&1 | Out-String
    $fail = 0
    if ($out -match 'FAIL:\s+(\d+)') { $fail = [int]$Matches[1] }
    $verdict = if ($fail -eq $m.Expect) { 'OK  ' } else { 'BAD ' }
    if ($fail -ne $m.Expect) { $allGood = $false }
    Write-Host ("{0} mutant '{1}' -> FAIL: {2} (expected {3})" -f $verdict, $m.Name, $fail, $m.Expect)
}
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Write-Host ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
