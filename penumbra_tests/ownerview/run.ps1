# =============================================================================
# OWNERVIEW SUITE (2026-10-01): report owners see the outlines admins see, and
# &noadm is a plain viewer even for an admin who owns the report.
#
#   php (test.php)  index.php's role block, owner promotion, view gate, journal
#                   block, Owner pill and the role pills it renders, over
#                   admin/user x owner/not x grant/grant+scheduler/none x &noadm/not
#                   x authorized/not x journal on/off:
#                   P1 editor flag  P2 scheduler flag  P3 the report opens  P4 body
#                   class  P5 journal badge preloaded  P6 Owner pill  P7 the role
#                   pills  P8 journal API access (manage_journal.php's own gate: a
#                   grant alone is not enough); D1/D2 dashboard.php builder / view;
#                   Q1 query.php's author copy flag, Q2 its view check (unchanged:
#                   owner + grant still VIEW); S1-S7 static pins (the flag, the
#                   console + penumbra_vars + ?asof= on the editor flag, the copy, the
#                   help, journalAccess emitted); S8 help_content.php RENDERED for a
#                   non-admin and an admin (View Options + Journal topics reach both);
#                   S9 the help's remaining editors copy
#   browser (ov.html, headless Edge over CDP)  code sliced from the files under
#                   test: J1-J8 the journal peek (a global admin, a non-admin owner /
#                   grant editor, &noadm, a viewer, journal on, a live badge, a grant
#                   holder the journal API refuses); M1-M3 View Options markers (the
#                   editors' wording, mechanics, none under &noadm); G1-G6 the journal
#                   publish gate (the wipe is offered to a global admin only; a
#                   refused count is asked about, never read as zero); U1-U3 the
#                   journal panel's copy (via main.js's rule and the module's
#                   fallback; the @mention e-mail caveat); F1-F3 the fallback rule;
#                   R1/R2 shared presets' can_write under &noadm; Z1 the JS parses
#
#   run.ps1                      LIVE files (before the deploy this is the CONTROL: RED)
#   run.ps1 -App <dir>           a stage: flat, or app-shaped (js\ beside); a file it
#                                lacks comes from live
#   run.ps1 -IndexPhp <p> -MainJs <p> -JournalJs <p> -PresetsJs <p> -QueryPhp <p>
#           -DashPhp <p> -HelpPhp <p>      (each overrides -App for that file)
#   run.ps1 -Mutant <name> | -Mutants      anchors checked first; -CheckAnchors alone
#                                          checks only them. Each mutant names the
#                                          assert ids it must turn RED (BITES/MISSED).
#   run.ps1 -Summary <file>      a plain run's summary file name (default summary.txt;
#                                e.g. summary_control.txt for the control)
#
# UNC NOTE: -File against a UNC path is GPO-blocked. Run the body as a scriptblock,
# ONE run per PowerShell call, output to a file:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ownerview'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <stage> *> <log>
# Prints RESULT: GREEN/RED (never exits). Writes summary.txt / summary_mutant_<name>.txt /
# summary_mutants.txt here; works in %TEMP%\pnb_ov_<8 hex> (removed afterwards unless
# -Keep). Writes nothing to the webroot. Needs py -3 + websocket-client, PHP 8.2.
# =============================================================================
param([string]$App = '', [string]$IndexPhp = '', [string]$MainJs = '', [string]$JournalJs = '', [string]$PresetsJs = '',
      [string]$QueryPhp = '', [string]$DashPhp = '', [string]$HelpPhp = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$CheckAnchors, [switch]$Keep, [string]$Summary = 'summary.txt')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ownerview' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Pick([string]$explicit, [string]$name, [string]$sub) {
  if ($explicit) { return $explicit }
  if ($App) { foreach ($p in @((Join-Path $App $name), (Join-Path $App ($sub + $name)))) { if (Test-Path -LiteralPath $p) { return $p } } }
  return (Join-Path $live ($sub + $name))
}
$paths = [ordered]@{
  idx  = Pick $IndexPhp  'index.php' ''
  dash = Pick $DashPhp   'dashboard.php' ''
  qry  = Pick $QueryPhp  'query.php' ''
  help = Pick $HelpPhp   'help_content.php' ''
  js   = Pick $MainJs    'main.js' 'js\'
  jrn  = Pick $JournalJs 'penumbra_journal.js' 'js\'
  pre  = Pick $PresetsJs 'penumbra_presets.js' 'js\'
}
$outName = @{ idx = 'index.php'; dash = 'dashboard.php'; qry = 'query.php'; help = 'help_content.php'; js = 'main.js'; jrn = 'penumbra_journal.js'; pre = 'penumbra_presets.js' }
$src0 = @{}; foreach ($k in @($paths.Keys)) { $src0[$k] = [IO.File]::ReadAllText($paths[$k], $utf8) }
# (2026-10-19) help_content.php is a shim over help/topics + help/tips: the help text under test is every fragment, raw
if (-not $HelpPhp) { $src0['help'] = (@(Get-ChildItem -LiteralPath "$live\help\topics" -Filter *.php) + @(Get-ChildItem -LiteralPath "$live\help\tips" -Filter *.php) | ForEach-Object { [IO.File]::ReadAllText($_.FullName, $utf8) }) -join "`n" }

# --- mutants: ONE single-point edit each, exact-once in the FEATURE build. main.js
# (2026-10-19) helpvo / helpjrn / helpbadges retired with the v1 help (S8's $isAdmin gating and the badges wording were v1's).
# is CRLF; index.php, dashboard.php, query.php and the two modules are LF.
$C = "`r`n"
$mPeek = '            return !!penumbra_vars.isAdmin' + $C + '                && !!penumbra_vars.journalAccess' + $C + '                && !isNoAdmView' + $C + '                && !!window._penumbraJournalHidden'
$mFb   = 'return !!pVars().isAdmin && !!pVars().journalAccess && !pVars().noadm && !!window._penumbraJournalHidden && !!reportId();'
$mMail = ' Anyone else you @mention still gets the note by email, but cannot open the journal until it is switched on.'
$mutantDefs = [ordered]@{
  'promoteroles' = @{ t = 'idx';  red = @('P1', 'P4', 'P5', 'P7'); edits = @(,@('if ($pnbEditorRolesOn && !$canEditLoadedReport && penumbraIsReportOwner($owner_id, $currentUserKey)) {', 'if (!$canEditLoadedReport && penumbraIsReportOwner($owner_id, $currentUserKey)) {')) }
  'grantroles'   = @{ t = 'idx';  red = @('P1', 'P4'); edits = @(,@('$canEditLoadedReport = $isAdmin || ($pnbEditorRolesOn && $loadedShortId', '$canEditLoadedReport = $isAdmin || ($loadedShortId')) }
  'schedroles'   = @{ t = 'idx';  red = @('P2'); edits = @(,@('$canScheduleLoadedReport = $isAdmin || ($pnbEditorRolesOn && $loadedShortId', '$canScheduleLoadedReport = $isAdmin || ($loadedShortId')) }
  'ownerpill'    = @{ t = 'idx';  red = @('P6', 'P7'); edits = @(,@('if ($pnbEditorRolesOn && isset($owner_id) && isset($currentUserKey)', 'if (isset($owner_id) && isset($currentUserKey)')) }
  'viewbyrole'   = @{ t = 'idx';  red = @('P3'); edits = @(,@('if ($canEditLoadedReport || $pnbViewByRole || checkAuthorization(', 'if ($canEditLoadedReport || checkAuthorization(')) }
  'jrnadmin'     = @{ t = 'idx';  red = @('P5'); edits = @(,@('$pnbJrnWanted = ($canEditLoadedReport && $pnbJrnAccess) || $pnbJrnEnabled;', '$pnbJrnWanted = $isAdmin || $pnbJrnEnabled;')) }
  'jrnaccess'    = @{ t = 'idx';  red = @('P5'); edits = @(,@('$pnbJrnWanted = ($canEditLoadedReport && $pnbJrnAccess) || $pnbJrnEnabled;', '$pnbJrnWanted = $canEditLoadedReport || $pnbJrnEnabled;')) }
  'accessowner'  = @{ t = 'idx';  red = @('P5', 'P8'); edits = @(,@('$pnbJrnAccess = $isAdmin || penumbraIsReportOwner($owner_id, $currentUserKey)', '$pnbJrnAccess = $isAdmin')) }
  'dashnoadm'    = @{ t = 'dash'; red = @('D1'); edits = @(,@('(!$noadm && $dash[''OWNER_ID''] === $currentUserKey)', '($dash[''OWNER_ID''] === $currentUserKey)')) }
  'querynoadm'   = @{ t = 'qry';  red = @('Q1'); edits = @(,@('|| (!$noadm && (', '|| (true && (')) }
  'peekglobal'   = @{ t = 'js';   red = @('J2', 'J7', 'U1'); edits = @(,@($mPeek, $mPeek.Replace('penumbra_vars.isAdmin', 'penumbra_vars.isGlobalAdmin'))) }
  'peeknoadm'    = @{ t = 'js';   red = @('J4'); edits = @(,@($mPeek, $mPeek.Replace($C + '                && !isNoAdmView', ''))) }
  'peekaccess'   = @{ t = 'js';   red = @('J8', 'F3'); edits = @(,@($mPeek, $mPeek.Replace($C + '                && !!penumbra_vars.journalAccess', ''))) }
  'wipeall'      = @{ t = 'js';   red = @('G1'); edits = @(,@('var canWipe = !!penumbra_vars.isGlobalAdmin;', 'var canWipe = true;')) }
  'gateerror'    = @{ t = 'js';   red = @('G6'); edits = @(,@("if (!resp || resp.status !== 'success') { askUnknown(); return; }", '')) }
  'oldnote'      = @{ t = 'js';   red = @('M1', 'S4'); edits = @(,@("var PNB_USER_HIDDEN_NOTE = 'EDITORS ONLY: View Options hide this from this report\'s viewers.';", "var PNB_USER_HIDDEN_NOTE = 'ADMIN ONLY: View Options hide this from non-admin viewers.';")) }
  'fallback'     = @{ t = 'jrn';  red = @('F1', 'U2'); edits = @(,@($mFb, 'return isGlobalAdmin() && !pVars().noadm && !!window._penumbraJournalHidden;')) }
  'fbnoadm'      = @{ t = 'jrn';  red = @('F2', 'F3'); edits = @(,@($mFb, 'return !!pVars().isAdmin && !!pVars().journalAccess && !!window._penumbraJournalHidden && !!reportId();')) }
  'fbaccess'     = @{ t = 'jrn';  red = @('F2', 'F3'); edits = @(,@($mFb, 'return !!pVars().isAdmin && !pVars().noadm && !!window._penumbraJournalHidden && !!reportId();')) }
  'mailcopy'     = @{ t = 'jrn';  red = @('U3'); edits = @(,@($mMail, '')) }
  'presetclamp'  = @{ t = 'pre';  red = @('R1'); edits = @(,@('e.canWrite = !!json.can_write && !(typeof penumbra_vars !== ''undefined'' && penumbra_vars && penumbra_vars.noadm);', 'e.canWrite = !!json.can_write;')) }
}
function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

$cases = @('parse', 'gadmin', 'editor', 'grantonly', 'noadm', 'noadmeditor', 'viewer', 'jon', 'gatefail', 'panel', 'panelfb', 'fallback', 'presets')

function Invoke-Suite($s) {
  $tag = [Guid]::NewGuid().ToString('N').Substring(0, 8)
  $run = Join-Path $env:TEMP ('pnb_ov_' + $tag)
  New-Item -ItemType Directory -Force $run | Out-Null
  $res = @()
  try {
    foreach ($k in @($s.Keys)) { [IO.File]::WriteAllText((Join-Path $run $outName[$k]), $s[$k], $utf8) }
    foreach ($f in @('ov.html', 'cdp.py', 'test.php')) { Copy-Item -LiteralPath (Join-Path $here $f) -Destination (Join-Path $run $f) -Force }
    Copy-Item -LiteralPath "$live\js\jquery-3.7.1.min.js" -Destination (Join-Path $run 'jquery.js') -Force

    # PHP half. Through cmd so php's stderr never becomes a PowerShell error, from
    # %TEMP% because cmd refuses a UNC working directory.
    Push-Location $env:TEMP
    try { $pout = @(cmd /c "`"$php`" -n `"$run\test.php`" `"$run`" 2>&1") } finally { Pop-Location }
    $tail = @($pout | Where-Object { $_ -match '^\d+ assertions, \d+ failed$' })
    foreach ($ln in $pout) {
      if ($ln -match '^A\|([^|]*)\|([01])\|([^|]*)\|(.*)$') { $res += [pscustomobject]@{ id = $Matches[1]; name = $Matches[3]; pass = ($Matches[2] -eq '1'); detail = $Matches[4] } }
      elseif ($ln -match '^FATAL\|(.*)$') { $res += [pscustomobject]@{ id = 'ZP'; name = 'test.php ran'; pass = $false; detail = $Matches[1] } }
    }
    if (-not $tail.Count -and -not @($res | Where-Object { $_.id -eq 'ZP' }).Count) {
      $res += [pscustomobject]@{ id = 'ZP'; name = 'test.php ran'; pass = $false; detail = (($pout | Select-Object -Last 5) -join ' / ') }
    }

    # Browser half.
    $jobs = @{ base = 'file:///' + ($run -replace '\\', '/') + '/ov.html'; cases = @($cases | ForEach-Object { @{ name = $_; query = "case=$_&id=r1" } }) }
    [IO.File]::WriteAllText((Join-Path $run 'jobs.json'), ($jobs | ConvertTo-Json -Depth 5), $utf8)
    Push-Location $env:TEMP
    try { $pyOut = @(cmd /c "py -3 `"$run\cdp.py`" `"$run\jobs.json`" `"$run\results.json`" 2>&1") } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $run 'results.json'))) {
      $res += [pscustomobject]@{ id = 'ZB'; name = 'cdp.py ran'; pass = $false; detail = ($pyOut -join ' / ') }
    } else {
      foreach ($rec in ([IO.File]::ReadAllText((Join-Path $run 'results.json'), $utf8) | ConvertFrom-Json)) {
        $as = @($rec.result.asserts)
        if (-not $as.Count -or $null -eq $as[0]) { $res += [pscustomobject]@{ id = "Z-$($rec.name)"; name = "case $($rec.name) produced no asserts"; pass = $false; detail = [string]$rec.result.error }; continue }
        foreach ($a in $as) { $res += [pscustomobject]@{ id = $a.id; name = $a.name; pass = [bool]$a.pass; detail = [string]$a.detail } }
      }
    }
  } finally {
    # Remove ONLY this run's own leaf under %TEMP% (a wrong target here once took
    # out every session's scratch files - assert the leaf before deleting).
    $leaf = Split-Path -Leaf $run; $parent = Split-Path -Parent $run
    if (-not $Keep -and $leaf -match '^pnb_ov_[0-9a-f]{8}$' -and $parent -eq $env:TEMP.TrimEnd('\')) { try { [IO.Directory]::Delete($run, $true) } catch { } }
    elseif ($Keep) { Write-Host "kept: $run" }
  }
  return ,$res
}

function Write-Summary([string]$file, [string[]]$lines) { [IO.File]::WriteAllLines((Join-Path $here $file), $lines, $utf8) }

foreach ($k in @($paths.Keys)) { Write-Host ("{0,-5} {1}" -f $k, $paths[$k]) }
if ($CheckAnchors -or $Mutants) {
  $stale = @()
  foreach ($nm in $mutantDefs.Keys) { try { [void](Apply-Mutant $src0[$mutantDefs[$nm].t] $nm) } catch { $stale += $_.Exception.Message } }
  if ($stale.Count) { $stale | ForEach-Object { Write-Host "ANCHOR $_" }; Write-Host 'RESULT: RED'; return }
  Write-Host "ANCHORS all $($mutantDefs.Count) mutants apply exactly once"
  if ($CheckAnchors) { Write-Host 'RESULT: GREEN'; return }
}
if ($Mutant -or $Mutants) {
  $names = if ($Mutants) { @($mutantDefs.Keys) } else { @($Mutant) }
  $bite = 0; $sum = New-Object System.Collections.Generic.List[string]
  foreach ($nm in $names) {
    if (-not $mutantDefs.Contains($nm)) { throw "unknown mutant '$nm' (known: $(@($mutantDefs.Keys) -join ', '))" }
    $sx = @{}; foreach ($k in $src0.Keys) { $sx[$k] = $src0[$k] }
    $tk = $mutantDefs[$nm].t; $sx[$tk] = Apply-Mutant $src0[$tk] $nm
    $all = Invoke-Suite $sx
    $red = @($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id } | Select-Object -Unique)
    $miss = @($mutantDefs[$nm].red | Where-Object { $red -notcontains $_ })
    $nf = @($all | Where-Object { -not $_.pass }).Count
    $line = if ($miss.Count -eq 0) { $bite++; "MUTANT {0,-13} BITES   red: {1}   ({2} failed of {3})" -f $nm, ($red -join ' '), $nf, $all.Count }
            else { "MUTANT {0,-13} MISSED  {1} stayed green; red: {2}" -f $nm, ($miss -join ' '), ($red -join ' ') }
    Write-Host $line; $sum.Add($line)
  }
  $sum.Add("MUTANTS $bite / $($names.Count) bite")
  Write-Host "MUTANTS $bite / $($names.Count) bite"
  $r = if ($bite -eq $names.Count) { 'RESULT: GREEN' } else { 'RESULT: RED' }
  $sum.Add($r); Write-Host $r
  Write-Summary $(if ($Mutants) { 'summary_mutants.txt' } else { "summary_mutant_$Mutant.txt" }) $sum.ToArray()
  return
}
$all = Invoke-Suite $src0
$lines = New-Object System.Collections.Generic.List[string]
foreach ($k in @($paths.Keys)) { $lines.Add(("{0,-5} {1}" -f $k, $paths[$k])) }
foreach ($x in @($all | Where-Object { -not $_.pass })) { $d = [string]$x.detail; if ($d.Length -gt 400) { $d = $d.Substring(0, 400) + '...' }; $lines.Add(('  FAIL {0}  {1}  [{2}]' -f $x.id, $x.name, $d)) }
foreach ($g in @($all | Group-Object id | Sort-Object Name)) {
  $gp = @($g.Group | Where-Object { $_.pass }).Count
  $lines.Add(('  {0} {1,-4} {2,4}/{3,-4} {4}' -f $(if ($gp -eq $g.Count) { 'PASS' } else { 'FAIL' }), $g.Name, $gp, $g.Count, ($g.Group[0].name -replace ':.*$', '')))
}
$p = @($all | Where-Object { $_.pass }).Count; $f = @($all | Where-Object { -not $_.pass }).Count
$lines.Add("TOTAL pass=$p fail=$f")
if ($f) { $lines.Add('FAILED ids: ' + (@($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id } | Select-Object -Unique) -join ' ')) }
$lines.Add($(if ($f -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' }))
$lines | ForEach-Object { Write-Host $_ }
Write-Summary $Summary $lines.ToArray()
