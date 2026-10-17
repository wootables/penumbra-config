# =============================================================================
# sftpkey (2026-10-16) - the SFTP/SCP private key of a Drop-a-File task is a
# protected secret like the drop password and the S3 keys.
#
#   run.ps1                      the LIVE webroot (after the deploy)
#   run.ps1 -App <stage>         a stage tree (patch.php --from=<orig> --to=<stage> builds one)
#   run.ps1 ... -Control         the test's own false assertion: must report FAIL: 1
#   run.ps1 ... -Mutants         four targeted mutants; each MUST go red with the exact
#                                count named below (a mutant that stays green, or bites
#                                more checks than named, means the suite no longer pins
#                                what it claims to pin)
#
# WHAT IS UNDER TEST: test_sftpkey.php's header (C crypto helpers and interop, N the
# normaliser, P the save decision, R the runner's reader, T the transport, L the list
# and the save path, A the Auditor masking, E the runner's DROP_FILE block, J/I the
# form, H the help, M the migration CLI, D the shared file). Real code, lifted out
# of the files; the transport is require'd from a scratch copy.
#
# Step 1 lints every PHP file the change touches (php -n -l, plus a broken file as
# the positive control). Step 2 runs the test with openssl loaded: -n means no
# php.ini, and the crypto helpers need the extension.
#
# EXPECTED TAIL: "PASS: 79   FAIL: 0" then "RESULT: GREEN" (79 as of 2026-10-16);
# with -Mutants also "MUTANTS: ALL BITE".
#
# UNC .ps1 files are GPO-blocked here ("not digitally signed") - run the body as a
# scriptblock, never with -File, and never add a bare `exit` (it would kill the caller):
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sftpkey'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <stage> -Mutants
# =============================================================================
param([string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra', [switch]$Control, [switch]$Mutants)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
if (-not $here -and $MyInvocation.MyCommand.Path) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sftpkey' }   # a scriptblock has neither
$phpHome = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p'
$php  = Join-Path $phpHome 'php.exe'
# FORWARD slashes on purpose: php's -d parser reads a leading "\\" as an escape and
# then looks for \oitras...\ext (verified 2026-10-16: the backslash form loads nothing).
$ext  = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext'
$test = Join-Path $here 'test_sftpkey.php'
$phpArgs = @('-n', '-d', "extension_dir=$ext", '-d', 'extension=openssl')
Write-Host "app: $App"

# --- 1. lint ---------------------------------------------------------------
$files = @('db_connection.php', 'manage_schedule.php', 'schedule_runner.php', 'plugins\file_transport.php', 'get_audit_data.php',
           'encrypt_sftp_keys_cli.php', 'index.php', 'help\topics\schedulerHelpLightbox.php')
$lintBad = 0
foreach ($f in $files) {
    $p = Join-Path $App $f
    if (-not (Test-Path -LiteralPath $p)) { Write-Host "LINT  missing: $p"; $lintBad++; continue }
    $out = & $php -n -l $p | Out-String      # php -l reports on stdout; no 2>&1 (a NativeCommandError would stop the script)
    if ($out -notmatch 'No syntax errors') { Write-Host "LINT  FAIL: $f"; Write-Host $out; $lintBad++ } else { Write-Host "LINT  ok:   $f" }
}
$ctl = Join-Path $env:TEMP ('pnb_sftpkey_broken_' + $PID + '.php')
[IO.File]::WriteAllText($ctl, '<?php if (1 { echo 1;')
$ctlOut = & $php -n -l $ctl | Out-String
[IO.File]::Delete($ctl)
if ($ctlOut -match 'No syntax errors') { Write-Host 'LINT  control FAILED: a broken file linted clean'; $lintBad++ } else { Write-Host 'LINT  control ok (a broken file is reported)' }
Write-Host ('LINT: ' + $(if ($lintBad -eq 0) { 'GREEN' } else { "RED ($lintBad)" }))

# --- 2. the test -------------------------------------------------------------
$runArgs = $phpArgs + @($test, "--app=$App")
if ($Control) { $runArgs += '--control' }
& $php @runArgs

# --- 3. mutants --------------------------------------------------------------
# Each breaks ONE decision in memory (see test_sftpkey.php --mutant). Exact counts:
#   plainsave  the save stores the posted key as it is       -> P1 P6 P7 P8 P10 (5)
#   rawkey     the transport reads the stored key            -> T2 T4 T6 (3)
#   nostrip    the list keeps the key in the payload         -> L1 (1)
#   nodecrypt  the runner's reader returns the stored value  -> R2 R4 (2)
if ($Mutants) {
    $expect = [ordered]@{ plainsave = 5; rawkey = 3; nostrip = 1; nodecrypt = 2 }
    $allGood = $true
    foreach ($m in $expect.Keys) {
        $out = & $php @($phpArgs + @($test, "--app=$App", "--mutant=$m")) | Out-String
        $fail = -1
        if ($out -match 'FAIL:\s+(\d+)') { $fail = [int]$Matches[1] }
        if ($out -match 'NOT APPLICABLE') { $fail = -2 }
        $verdict = if ($fail -eq $expect[$m]) { 'OK  ' } else { 'BAD ' }
        if ($fail -ne $expect[$m]) { $allGood = $false }
        Write-Host ("{0} mutant {1,-10} -> FAIL: {2} (expected {3})" -f $verdict, $m, $fail, $expect[$m])
    }
    Write-Host ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
}
