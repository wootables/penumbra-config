# =============================================================================
# AUDITOR TAB SUITE (2026-09-25): the "Audit trail" banner, the view heights,
# and the report's ERRORS (Health's Report errors card, Pulse's Errors tile,
# the browser-error reporter's view-transition filter)
#
# ah.html renders the REAL renderAuditSegBar, _auditPaintHealth and
# renderAuditSegPulse (+ helpers, sliced out of the main.js under test) into the
# REAL #auditor-tab lifted from the index.php under test, under index.php's
# stylesheet set with the css\main.css under test, in headless Edge over CDP.
# inst.html runs the REAL client-error installer lifted from that index.php.
#
#   A1 A2  admin Health: no scrollbar at 1708px / 1123px (a 1366 laptop), with
#          int-col-mat's two browser errors (= the fourth card)
#   A3     Health is exactly as tall as Pulse          A4  non-admin Health: none
#   A5     an Unresolved card scrolls, but sits wholly visible on top
#   A6     compact: content-sized, no scrollbar       A7  Events keeps 325px
#   A8     a busy Pulse (8 action-mix rows) has no scrollbar at 1708px
#   B1-B8  the banner (title + icon tabs + solid metrics button; a band with a
#          4px accent edge; >= 12px / 600 pills; one line at 1708 / 900 / 720;
#          compact <= 30px; every text pair >= 4.5:1 on all 18 themes)
#   H1     Report errors card: no query failures + int-col-mat's browser errors
#          ("2 browser errors, latest Sep 13, not counted", newest row in the
#          title), no alarm - also from an OLD get_audit_log.php (no errkinds)
#   H2     a query timeout in 72 h RAISES the flag: Unresolved card headlined by
#          it (never by a newer browser error), Report errors card red, 1 · 72 H
#   H3     the four cards sit in one row, no scrollbar, at 1293px (125% scaling)
#   H4     older failures (outside 72 h): "2 timeouts / too-big results, latest
#          Sep 18", no alarm, one row, no scrollbar at 1708 / 1293 / 1123px - and
#          a NOISY report's longer lines ("1,595 timeouts...") clip to one line
#   H5     the counts are the server's ALL-TIME ones (31 on record, 2 in the list)
#   H6     nothing on record = NO Report errors card: the three cards as before,
#          one row, no scrollbar at 900px (a fourth card wraps there)
#   P1     Pulse's Errors tile is a <button> into Events > Security & errors,
#          "last: Sep 13" when none today, a tooltip naming every type
#   P2     ...and looks exactly like its neighbour tile on all 18 themes
#   P3     Total views -> Events (Views) and Updates -> Changes are buttons too,
#          tooltips say where, and all three look like the plain tiles (18 themes)
#   P4     the REAL click delegates (sliced from main.js): Total views = Events
#          pre-filtered to Views, Updates = the Changes segment, Errors = Events >
#          Security & errors
#   E0 C1-C3  the installer: still ES5; the browser's own view-transition
#          aborts are NOT sent, everything else is
#   C4-C7  (2026-10-21, inst.html?part=ro, a fresh page) its ResizeObserver
#          notice is NOT sent - dispatched (both wordings, no Error object) AND a
#          REAL one this Edge raises from an observer resizing what it watches -
#          while the same words thrown by a script and an error event without an
#          Error object saying anything else still are
#   L1     log_client_error.php drops the same notices (PHP, 14 cases) - through the
#          SHARED rule in db_connection.php since 2026-09-25 evening (suite errbenign);
#          its gate admits error events as well as rejections since 2026-10-21
#   G1     get_audit_log.php: ATT_QUERY in 72 h, ATT_LAST over the alarm set
#          (no CLIENT_ERROR), ERR_LAST -> err_last, the per-kind counts -> errkinds
#   N1-N3  (2026-10-21, ev.html) the Events list as the REAL loadAuditLog paints it
#          (the whole audit module sliced from main.js, as chgfoot does; only $.ajax
#          is faked): a CLIENT_ERROR row the server flags BENIGN (the ResizeObserver
#          notice, an old "Transition was skipped") wears the NEUTRAL badge and its
#          tooltip says why, while a real browser error and a denial stay red (N1);
#          that badge IS the plain neutral one (RENAME's), not the red one, its text
#          >= 4.5:1, on all 18 themes (N2); an older get_audit_log.php (no BENIGN)
#          leaves every CLIENT_ERROR red, and a plain viewer's scrubbed rows (no
#          message) still go neutral by the flag (N3)
#   G2     get_audit_log.php: the list query selects BENIGN through the SAME SQL
#          twin (penumbraBenignClientErrorSql()), as a number 0 / 1, never unset
#   G3     (2026-10-21) get_audit_log.php: Pulse's action mix leaves the browser's
#          harmless notices out, through the same twin (errbenign S1 pins what it
#          matches: the notices only, so a real browser error still counts)
#   H7-H9 R1 (2026-10-30, qfail) runs that failed outright (QUERY_FAIL): four in
#          72 h RAISE the flag - Unresolved headlined by QUERY FAIL, Report errors
#          "4 failed runs, latest Oct 30", red, 4 · 72 H (H7); mixed with a
#          timeout + a too-big result: "6 failed runs / timeouts / too-big results"
#          (H8); an old get_audit_log.php (no errkinds) counts them from the rows
#          (H9); the REAL ribbon says "4 failed runs, query timeouts or too-big
#          results (last 72 h)" (R1). G1 also pins QUERY_FAIL in ATT_QUERY and
#          ERR_QLAST, and ERR_QERR -> errkinds.qerr.
#
#   run.ps1                  live files           EXPECTED: GREEN 45 / 0
#   run.ps1 -Control         the build before the Auditor tab work (per file,
#                            its .bak-20260925-auditortab, else -auditerrors,
#                            else -auditbenign)              EXPECTED: RED
#   run.ps1 -ControlBn       main.js + get_audit_log.php at 705b22d, the build
#                            before the neutral badge   EXPECTED: RED on exactly N1 N2 N3 G2 G3
#   run.ps1 -ControlMix      get_audit_log.php at 528f6d0, the build before the
#                            action-mix change          EXPECTED: RED on exactly G3
#   run.ps1 -MainCss <p> -MainJs <p> -IndexPhp <p> -LogPhp <p> -AuditPhp <p> -DbPhp <p>
#   run.ps1 -Mutant <name> / -Mutants   anchors checked first (-CheckAnchors)
#   -Keep keeps the staging dir.  -Here <dir> runs a copy.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditortab'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Needs py -3 with websocket-client and the PHP 8.2 CLI. Writes nothing to the webroot.
# =============================================================================
param([string]$MainCss = '', [string]$MainJs = '', [string]$IndexPhp = '', [string]$LogPhp = '', [string]$AuditPhp = '', [string]$DbPhp = '',
      [string]$App = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$CheckAnchors, [switch]$Control, [switch]$ControlBn, [switch]$ControlMix, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\auditortab' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control) {
  # The build before ANY of the Auditor tab work: the oldest of the day's two stamps per file.
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  function Get-ControlFile([string]$rel) {
    foreach ($st in @('auditortab', 'auditerrors', 'auditbenign')) { $p = Resolve-Bak "$app\$rel.bak-20260925-$st"; if ($p) { return $p } }
    throw "-Control: no .bak-20260925-auditortab / -auditerrors for $rel"
  }
  $MainCss = Get-ControlFile 'css\main.css'; $MainJs = Get-ControlFile 'js\main.js'; $IndexPhp = Get-ControlFile 'index.php'
  $LogPhp = Get-ControlFile 'log_client_error.php'; $AuditPhp = Get-ControlFile 'get_audit_log.php'; $DbPhp = Get-ControlFile 'db_connection.php'
}
if ($ControlBn) {
  # The build before the neutral badge for the browser's harmless notices (2026-10-21).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))
  $MainJs = Get-GitVersion '705b22d' 'js/main.js'; $AuditPhp = Get-GitVersion '705b22d' 'get_audit_log.php'
}
if ($ControlMix) {
  # The build before Pulse's action mix left the harmless notices out (2026-10-21).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))
  $AuditPhp = Get-GitVersion '528f6d0' 'get_audit_log.php'
}
$cssPath = if ($MainCss) { $MainCss } else { "$app\css\main.css" }
$jsPath  = if ($MainJs) { $MainJs } else { "$app\js\main.js" }
$idxPath = if ($IndexPhp) { $IndexPhp } else { "$app\index.php" }
$logPath = if ($LogPhp) { $LogPhp } else { "$app\log_client_error.php" }
$audPath = if ($AuditPhp) { $AuditPhp } else { "$app\get_audit_log.php" }
$dbPath  = if ($DbPhp) { $DbPhp } else { "$app\db_connection.php" }
$src0 = @{
  css = [IO.File]::ReadAllText($cssPath, $utf8); js = [IO.File]::ReadAllText($jsPath, $utf8); idx = [IO.File]::ReadAllText($idxPath, $utf8)
  log = [IO.File]::ReadAllText($logPath, $utf8); aud = [IO.File]::ReadAllText($audPath, $utf8); db = [IO.File]::ReadAllText($dbPath, $utf8)
}

# --- mutants. main.css + main.js are CRLF; the PHP files are LF. Strings built
# first: in PowerShell `'a' + 'b', 'c'` is 'a' + ('b','c').
$C = "`r`n"; $L = "`n"
$mPulse  = '#admWrapper:not(.compact-admin-mode) #auditMainRow:has(#auditSegPulse.on)'
$mHealth = '#admWrapper:not(.compact-admin-mode) #auditMainRow:has(#auditSegHealth.on) {'
$mShared = $mPulse + ',' + $C + $mHealth
$mAlone  = $mPulse + ' {'
$mFloor  = $mHealth + $C + '    min-height: 290px;'
$mFloor270 = $mHealth + $C + '    min-height: 270px;'
$mBandBg = '    background: linear-gradient(90deg, color-mix(in srgb, var(--brand-primary, #336699) 13%, var(--bg-surface, #fff)), color-mix(in srgb, var(--brand-primary, #336699) 3%, var(--bg-surface, #fff)) 60%);' + $C
$mAccent = '    border-left: 4px solid var(--brand-primary, #336699);' + $C + '    border-radius: 6px;' + $C + '    background: linear-gradient'
$mAccent0 = '    border-radius: 6px;' + $C + '    background: linear-gradient'
$mPillFont = '#auditSegBar .audit-seg { font-size: 12px; }'
$mPillFont11 = '#auditSegBar .audit-seg { font-size: 11px; }'
$mLinkBg = '    border-radius: 999px;' + $C + '    background: var(--brand-primary, #336699);' + $C + '    color: var(--on-brand, #fff);' + $C + '    font-size: 12px;'
$mLinkBg0 = '    border-radius: 999px;' + $C + '    background: transparent;' + $C + '    color: var(--on-brand, #fff);' + $C + '    font-size: 12px;'
$mHintRule = '@container pnb-audit-bar (max-width: 1119px) {' + $C + '    .audit-seg-hint { display: none; }' + $C + '}' + $C
$mTitleRule = '@container pnb-audit-bar (max-width: 799px) {' + $C + '    .audit-seg-title-t { display: none; }' + $C
$mTitleRule0 = '@container pnb-audit-bar (max-width: 799px) {' + $C
$mTitleColor = '(all 18 themes measured). */' + $C + '    color: color-mix(in srgb, var(--brand-text, var(--brand-primary, #336699)) 65%, var(--text-main, #222));'
$mTitleColor0 = '(all 18 themes measured). */' + $C + '    color: var(--brand-text, var(--brand-primary, #336699));'
$mBadgeSel = '.audit-seg[aria-selected="true"] .seg-n:not(:empty) {' + $C + '    background: var(--on-brand, #fff);' + $C + '    color: var(--brand-primary, #336699);'
$mBadgeSel0 = '.audit-seg[aria-selected="true"] .seg-n:not(:empty) {' + $C + '    background: color-mix(in srgb, var(--on-brand, #fff) 24%, transparent);' + $C + '    color: var(--on-brand, #fff);'
$mCompactBar = '.compact-admin-mode #auditSegBar { padding: 3px 8px 3px 10px; gap: 4px; }' + $C
$mIcons  = '                     _auditSegIco(s.ico) + s.label +'
$mIcons0 = '                     s.label +'
$mTitleAria  = "var h = '<span class=`"audit-seg-title`" aria-hidden=`"true`">' +"
$mTitleAria0 = "var h = '<span class=`"audit-seg-title`">' +"
# --- the errors work (2026-09-25 pm) ---
$mQueryCount  = 'att.sched_fail + (att.query || 0)) : 0;'
$mQueryCount0 = 'att.sched_fail) : 0;'
$mHeadline  = " && data.bad[li].ACTION !== 'CLIENT_ERROR') { latestBad"
$mHeadline0 = ') { latestBad'
$mListCounts  = 'var ek = (_auditKpisCache && _auditKpisCache.errkinds) || {'
$mListCounts0 = 'var ek = null || {'
$mClip = '.audit-hcard .audit-hclip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' + $C
$mAlways  = '        if (nQ || nB || q72) {'
$mAlways0 = '        if (true) {'
$mTileBtn  = '''<button type="button" class="audit-tile audit-tile-go'''
$mTileBtn0 = '''<div class="audit-tile audit-tile-go'''
$mBerr  = "(ek.blast ? ', latest ' + ek.blast : '') + ', not counted'"
$mBerr0 = "' on record' + (ek.blast ? ', latest ' + ek.blast : '') + ' - not counted'"
$mTileBg  = '    border-radius: 4px;' + $C + '    background: var(--bg-surface-alt, #f8f9fa);' + $C + '    box-shadow: none;'
$mTileBg0 = '    border-radius: 4px;' + $C + '    box-shadow: none;'
$mBenignJs = '            if (benignRejection(r, msg)) { return; }' + $L
$mViews  = "'Report opens, all time. Click to list them in Events.', 'data-audit-goto-events=`"view`"');"
$mViews0 = "'Report opens, all time. Click to list them in Events.');"
$mUpd  = "'Report state edits, all time. Click to see them in Changes.', 'data-audit-goto-seg=`"changes`"');"
$mUpd0 = "'Report state edits, all time. Click to see them in Changes.', 'data-audit-goto-events=`"change`"');"
$mBenignPhp  = 'return penumbraClientErrorIsBenign($message);   // the ONE rule (db_connection.php)'
$mBenignPhp0 = 'return false;'
# --- the ResizeObserver notice (2026-10-21) ---
$mNotice    = '            if (benignNotice(ev)) { return; }' + $L
$mNoticeErr  = 'return !!ev && !ev.error' + $L
$mNoticeErr0 = 'return !!ev' + $L
$mNoticeMsg  = '            && /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(String(ev.message || ''''));'
$mNoticeMsg0 = '            && true;'
$mGate  = "if (`$kind !== 'unhandledrejection' && `$kind !== 'error') return false;"
$mGate0 = "if (`$kind !== 'unhandledrejection') return false;"
$mAlarm  = 'ACTION IN ($alarmList) THEN TIMESTAMP END), ''YYYYMMDDHH24MISS'') AS ATT_LAST'
$mAlarm0 = 'ACTION IN ($badList) THEN TIMESTAMP END), ''YYYYMMDDHH24MISS'') AS ATT_LAST'
# --- the neutral badge for the browser's harmless notices (2026-10-21) ---
$mBnFlag  = 'const benign = Number(log.BENIGN) === 1;'
$mBnFlag0 = 'const benign = false;'
$mBnAll0  = "const benign = log.ACTION === 'CLIENT_ERROR';"
$mBnMsg0  = "const benign = !!(log.SOURCE_DATA && /^(ResizeObserver loop|Transition was)/i.test(String(log.SOURCE_DATA.message || '')));"
$mBnCls   = "const badgeClass = benign ? 'action-default' : actionBadgeClass(log.ACTION);"
$mBnCls0  = "const badgeClass = benign ? 'action-danger' : actionBadgeClass(log.ACTION);"
$mBnTip   = "(benign ? 'A harmless browser notice, not counted as an error. ' : '') +"
$mBnTip0  = "'' +"
$mBnTd    = 'title="${escapeHtml(actionTitle)}"><span class="audit-action-badge ${badgeClass}">'
$mBnTd0   = 'title="Click to filter the log to ${escapeHtml(log.ACTION)} events"><span class="audit-action-badge ${badgeClass}">'
$mBnCol   = '                        {$benignCol}' + $L
$mBnSql   = '$benignCol = "CASE WHEN " . penumbraBenignClientErrorSql() . " THEN 1 ELSE 0 END AS BENIGN,";'
$mBnSql0  = "`$benignCol = `"CASE WHEN ACTION = 'CLIENT_ERROR' THEN 1 ELSE 0 END AS BENIGN,`";"
$mBnCast  = "        `$row['BENIGN'] = (isset(`$row['BENIGN']) && (int)`$row['BENIGN'] === 1) ? 1 : 0;" + $L
$mMix     = 'WHERE REPORT_ID = :report_id AND NOT " . penumbraBenignClientErrorSql() . "'
$mMix0    = 'WHERE REPORT_ID = :report_id'
# --- runs that failed outright, QUERY_FAIL (2026-10-30) ---
$mQfFilter  = "e.ACTION === 'QUERY_TOOBIG' || e.ACTION === 'QUERY_FAIL'; });"
$mQfFilter0 = "e.ACTION === 'QUERY_TOOBIG'; });"
$mQfCount   = ' + (ek.qerr || 0), nB = ek.browser || 0;'
$mQfCount0  = ', nB = ek.browser || 0;'
$mQfWords   = "        if (ek.qerr) qKinds.push('failed runs');" + $C
$mQfRibbon  = "parts.push(att.query === 1 ? '1 failed run, query timeout or too-big result' : att.query.toLocaleString() + ' failed runs, query timeouts or too-big results');"
$mQfRibbon0 = "parts.push(att.query === 1 ? '1 query timeout or too-big result' : att.query.toLocaleString() + ' query timeouts or too-big results');"
$mQfAtt     = "('QUERY_TIMEOUT','QUERY_TOOBIG','QUERY_FAIL') AND TIMESTAMP >= SYSDATE - 3"
$mQfAtt0    = "('QUERY_TIMEOUT','QUERY_TOOBIG') AND TIMESTAMP >= SYSDATE - 3"
$mQfCol     = "                'qerr'    => isset(`$kpiRow['ERR_QERR'])    ? (int)`$kpiRow['ERR_QERR']    : 0," + $L
$mutantDefs = [ordered]@{
  'nohealth'     = @{ t = 'css'; edits = @(,@($mShared, $mAlone)); red = @('A1', 'A2', 'A3') }
  'floor270'     = @{ t = 'css'; edits = @(,@($mFloor, $mFloor270)); red = @('A1', 'A2') }
  'nobandbg'     = @{ t = 'css'; edits = @(,@($mBandBg, '')); red = @('B2') }
  'noaccent'     = @{ t = 'css'; edits = @(,@($mAccent, $mAccent0)); red = @('B2') }
  'smallpills'   = @{ t = 'css'; edits = @(,@($mPillFont, $mPillFont11)); red = @('B3') }
  'linkplain'    = @{ t = 'css'; edits = @(,@($mLinkBg, $mLinkBg0)); red = @('B4', 'B8') }
  'nohintrule'   = @{ t = 'css'; edits = @(,@($mHintRule, '')); red = @('B5') }
  'notitlerule'  = @{ t = 'css'; edits = @(,@($mTitleRule, $mTitleRule0)); red = @('B6') }
  'brandtitle'   = @{ t = 'css'; edits = @(,@($mTitleColor, $mTitleColor0)); red = @('B8') }
  'washbadge'    = @{ t = 'css'; edits = @(,@($mBadgeSel, $mBadgeSel0)); red = @('B8') }
  'compactbar'   = @{ t = 'css'; edits = @(,@($mCompactBar, '')); red = @('B7') }
  'noicons'      = @{ t = 'js';  edits = @(,@($mIcons, $mIcons0)); red = @('B1') }
  'titlespoken'  = @{ t = 'js';  edits = @(,@($mTitleAria, $mTitleAria0)); red = @('B1') }
  'noquerycount' = @{ t = 'js';  edits = @(,@($mQueryCount, $mQueryCount0)); red = @('H2') }
  'clientheadline' = @{ t = 'js'; edits = @(,@($mHeadline, $mHeadline0)); red = @('H2') }
  'listcounts'   = @{ t = 'js';  edits = @(,@($mListCounts, $mListCounts0)); red = @('H5') }
  'tilediv'      = @{ t = 'js';  edits = @(,@($mTileBtn, $mTileBtn0)); red = @('P1') }
  'berrtext'     = @{ t = 'js';  edits = @(,@($mBerr, $mBerr0)); red = @('H1') }
  'noclip'       = @{ t = 'css'; edits = @(,@($mClip, '')); red = @('H4') }
  'alwayscard'   = @{ t = 'js';  edits = @(,@($mAlways, $mAlways0)); red = @('H6') }
  'tilestyle'    = @{ t = 'css'; edits = @(,@($mTileBg, $mTileBg0)); red = @('P2') }
  'benignoff'    = @{ t = 'idx'; edits = @(,@($mBenignJs, '')); red = @('C1') }
  'viewsplain'   = @{ t = 'js';  edits = @(,@($mViews, $mViews0)); red = @('P3', 'P4') }
  'updatesevents' = @{ t = 'js'; edits = @(,@($mUpd, $mUpd0)); red = @('P3', 'P4') }
  'benignphp'    = @{ t = 'log'; edits = @(,@($mBenignPhp, $mBenignPhp0)); red = @('L1') }
  'noticeoff'    = @{ t = 'idx'; edits = @(,@($mNotice, '')); red = @('C4', 'C6', 'C7') }
  'noticeerrobj' = @{ t = 'idx'; edits = @(,@($mNoticeErr, $mNoticeErr0)); red = @('C5', 'C7') }
  'noticeany'    = @{ t = 'idx'; edits = @(,@($mNoticeMsg, $mNoticeMsg0)); red = @('C5', 'C7') }
  'gaterej'      = @{ t = 'log'; edits = @(,@($mGate, $mGate0)); red = @('L1') }
  'alarmclient'  = @{ t = 'aud'; edits = @(,@($mAlarm, $mAlarm0)); red = @('G1') }
  'bnoff'        = @{ t = 'js';  edits = @(,@($mBnFlag, $mBnFlag0)); red = @('N1', 'N2', 'N3') }
  'bnall'        = @{ t = 'js';  edits = @(,@($mBnFlag, $mBnAll0)); red = @('N1', 'N2', 'N3') }
  'bnmsg'        = @{ t = 'js';  edits = @(,@($mBnFlag, $mBnMsg0)); red = @('N3') }
  'bnred'        = @{ t = 'js';  edits = @(,@($mBnCls, $mBnCls0)); red = @('N1', 'N2', 'N3') }
  'bnnotip'      = @{ t = 'js';  edits = @(,@($mBnTip, $mBnTip0)); red = @('N1') }
  'bntdtitle'    = @{ t = 'js';  edits = @(,@($mBnTd, $mBnTd0)); red = @('N1') }
  'bnnocol'      = @{ t = 'aud'; edits = @(,@($mBnCol, '')); red = @('G2') }
  'bnsqlown'     = @{ t = 'aud'; edits = @(,@($mBnSql, $mBnSql0)); red = @('G2') }
  'bnnocast'     = @{ t = 'aud'; edits = @(,@($mBnCast, '')); red = @('G2') }
  'mixall'       = @{ t = 'aud'; edits = @(,@($mMix, $mMix0)); red = @('G3') }
  'qffilter'     = @{ t = 'js';  edits = @(,@($mQfFilter, $mQfFilter0)); red = @('H9') }
  'qfcount'      = @{ t = 'js';  edits = @(,@($mQfCount, $mQfCount0)); red = @('H7', 'H8', 'H9') }
  'qfwords'      = @{ t = 'js';  edits = @(,@($mQfWords, '')); red = @('H8') }
  'qfribbon'     = @{ t = 'js';  edits = @(,@($mQfRibbon, $mQfRibbon0)); red = @('R1') }
  'qfatt'        = @{ t = 'aud'; edits = @(,@($mQfAtt, $mQfAtt0)); red = @('G1') }
  'qfcol'        = @{ t = 'aud'; edits = @(,@($mQfCol, '')); red = @('G1') }
}
function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

function Invoke-Cases($s) {
  $run = Join-Path $env:TEMP ('pnb_at_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force "$run\css", "$run\js" | Out-Null
  foreach ($f in @('jquery-ui.css', 'penumbra_tiles.css', 'density.css', 'search_builder.css', 'penumbra_presets.css', 'penumbra_colwidths.css')) { Copy-Item "$app\css\$f" "$run\css\$f" -Force }
  foreach ($f in @('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js')) { Copy-Item "$app\js\$f" "$run\js\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $s.css, $utf8)
  [IO.File]::WriteAllText("$run\main.js", $s.js, $utf8)
  [IO.File]::WriteAllText("$run\index.php", $s.idx, $utf8)
  [IO.File]::WriteAllText("$run\log_client_error.php", $s.log, $utf8)
  [IO.File]::WriteAllText("$run\db_connection.php", $s.db, $utf8)
  foreach ($f in @('ah.html', 'inst.html', 'ev.html', 'cdp.py', 'gen.php', 'benign_test.php')) { Copy-Item "$here\$f" "$run\$f" -Force }
  $gen = & $php -n "$run\gen.php" $run $app 2>&1
  if (-not (Test-Path "$run\themes.js")) { throw "gen.php wrote no themes.js: $gen" }
  $tj = [IO.File]::ReadAllText("$run\themes.js")
  $themes = @([regex]::Matches($tj, '"id"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
  $p = 'idx=index.php&js=main.js&css=main.css&realbar=1'
  $cases = New-Object System.Collections.ArrayList
  foreach ($cs0 in @(
    @('h1708', 'seg=health&admin=1&w=1708'), @('h900', 'seg=health&admin=1&w=900'), @('h720', 'seg=health&admin=1&w=720'),
    @('hc1708', 'seg=health&admin=1&cerr=1&w=1708'), @('hc1123', 'seg=health&admin=1&cerr=1&w=1123'), @('hc1293', 'seg=health&admin=1&cerr=1&w=1293'),
    @('hq1708', 'seg=health&admin=1&cerr=1&qerr=1&w=1708'), @('hcn1708', 'seg=health&admin=1&cerr=1&noek=1&w=1708'), @('hm1708', 'seg=health&admin=1&cerr=1&cerrmany=1&w=1708'),
    @('ho1708', 'seg=health&admin=1&qold=1&cerr=1&w=1708'), @('ho1293', 'seg=health&admin=1&qold=1&cerr=1&w=1293'), @('ho1123', 'seg=health&admin=1&qold=1&cerr=1&w=1123'),
    @('hom1123', 'seg=health&admin=1&qold=1&qmany=1&cerr=1&w=1123'),
    @('hf1708', 'seg=health&admin=1&qfail=1&ribbon=1&w=1708'), @('hfm1708', 'seg=health&admin=1&qfail=1&qold=1&cerr=1&w=1708'), @('hfn1708', 'seg=health&admin=1&qfail=1&noek=1&w=1708'),
    @('p1708', 'seg=pulse&w=1708'), @('u1708', 'seg=health&admin=0&w=1708'), @('e1708', 'seg=health&admin=1&errors=1&w=1708'),
    @('c1708', 'seg=health&admin=1&w=1708&compact=1'), @('v1708', 'seg=events&w=1708'))) {
    [void]$cases.Add(@{ name = $cs0[0]; query = "$p&$($cs0[1])&theme=theme-hello-kitty" })
  }
  foreach ($th in $themes) { foreach ($sg in @('health', 'events', 'pulse')) { [void]$cases.Add(@{ name = "k|$th|$sg"; query = "$p&seg=$sg&admin=1&w=1708&theme=$th" }) } }
  $base = 'file:///' + ($run -replace '\\', '/')
  [IO.File]::WriteAllText("$run\jobs.json", (@{ base = "$base/ah.html"; viewport = @(2400, 1000); cases = $cases } | ConvertTo-Json -Depth 5), $utf8)
  [IO.File]::WriteAllText("$run\jobs_inst.json", (@{ base = "$base/inst.html"; viewport = @(1200, 800); cases = @(@{ name = 'inst'; query = 'idx=index.php' }, @{ name = 'instro'; query = 'idx=index.php&part=ro' }) } | ConvertTo-Json -Depth 5), $utf8)
  $pyOut = & py -3 "$run\cdp.py" "$run\jobs.json" "$run\results.json" 2>&1
  if (-not (Test-Path "$run\results.json")) { throw "cdp.py wrote no results: $pyOut" }
  $pyOut2 = & py -3 "$run\cdp.py" "$run\jobs_inst.json" "$run\results_inst.json" 2>&1
  if (-not (Test-Path "$run\results_inst.json")) { throw "cdp.py (installer) wrote no results: $pyOut2" }
  # The Events list (2026-10-21): the REAL loadAuditLog, rows with the server's BENIGN flag.
  $pe = 'idx=index.php&js=main.js&css=main.css&id=hitratio&w=1708'
  $evCases = New-Object System.Collections.ArrayList
  foreach ($cs0 in @(@('ev', ''), @('evold', '&srv=old'), @('evviewer', '&viewer=1'))) { [void]$evCases.Add(@{ name = $cs0[0]; query = "$pe$($cs0[1])&theme=theme-hello-kitty" }) }
  foreach ($th in $themes) { [void]$evCases.Add(@{ name = "ev|$th"; query = "$pe&theme=$th" }) }
  [IO.File]::WriteAllText("$run\jobs_ev.json", (@{ base = "$base/ev.html"; viewport = @(2400, 1000); cases = $evCases } | ConvertTo-Json -Depth 5), $utf8)
  $pyOut3 = & py -3 "$run\cdp.py" "$run\jobs_ev.json" "$run\results_ev.json" 2>&1
  if (-not (Test-Path "$run\results_ev.json")) { throw "cdp.py (Events) wrote no results: $pyOut3" }
  $res = @{}
  foreach ($rec in ([IO.File]::ReadAllText("$run\results.json", $utf8) | ConvertFrom-Json)) { $res[$rec.name] = $rec.result }
  foreach ($rec in ([IO.File]::ReadAllText("$run\results_inst.json", $utf8) | ConvertFrom-Json)) { if ($rec.name -eq 'instro') { $res['__instro'] = $rec.result } else { $res['__inst'] = $rec.result } }
  foreach ($rec in ([IO.File]::ReadAllText("$run\results_ev.json", $utf8) | ConvertFrom-Json)) { $res[$rec.name] = $rec.result }
  $res['__benign'] = (& $php -n "$run\benign_test.php" "$run\log_client_error.php" "$run\db_connection.php" 2>&1 | Out-String)
  $res['__themes'] = $themes
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch { } } else { Write-Host "kept: $run" }
  return $res
}

function Get-Asserts($m, $s) {
  $out = @()
  foreach ($k in @('h1708', 'h900', 'h720', 'hc1708', 'hc1123', 'hc1293', 'hq1708', 'hcn1708', 'hm1708', 'ho1708', 'ho1293', 'ho1123', 'hom1123', 'hf1708', 'hfm1708', 'hfn1708', 'p1708', 'u1708', 'e1708', 'c1708', 'v1708')) {
    if ($null -eq $m[$k] -or $m[$k].error) { $out += [pscustomobject]@{ id = 'Z0'; name = "case $k rendered"; pass = $false; detail = $(if ($m[$k]) { $m[$k].error } else { 'no result' }) } }
  }
  if ($out.Count) { return ,$out }
  $h = $m['h1708']; $n = $m['h900']; $sm = $m['h720']; $pu = $m['p1708']; $u = $m['u1708']; $e = $m['e1708']; $cp = $m['c1708']; $v = $m['v1708']
  $hc = $m['hc1708']; $hl = $m['hc1123']; $h13 = $m['hc1293']; $hq = $m['hq1708']
  $out += [pscustomobject]@{ id = 'A1'; name = 'admin Health at 1708px has no scrollbar (with int-col-mat''s browser errors)'; pass = ($h.overflow -le 0) -and ($hc.overflow -le 0); detail = "plain=$($h.overflow) withBrowserErrors=$($hc.overflow) floor=$($h.rowMinH)" }
  $out += [pscustomobject]@{ id = 'A2'; name = 'admin Health at 1123px (a 1366 laptop) has no scrollbar, the cards in one row'; pass = ($hl.overflow -le 0) -and ($hl.healthCards.rows -eq 1); detail = "overflow=$($hl.overflow) rows=$($hl.healthCards.rows)" }
  $out += [pscustomobject]@{ id = 'A3'; name = 'Health is exactly as tall as Pulse'; pass = ([Math]::Abs($h.row.h - $pu.row.h) -le 0.5); detail = "health row=$($h.row.h) pulse row=$($pu.row.h)" }
  $out += [pscustomobject]@{ id = 'A4'; name = 'a non-admin owner''s Health has no scrollbar'; pass = ($u.overflow -le 0); detail = "overflow=$($u.overflow)" }
  $out += [pscustomobject]@{ id = 'A5'; name = 'an Unresolved card scrolls the view but sits wholly visible on top'; pass = ($e.overflow -gt 0) -and ($e.firstKidRoom -ge 0) -and ($e.kids[0] -like 'audit-hcard sev-bad*'); detail = "overflow=$($e.overflow) room=$($e.firstKidRoom)" }
  $out += [pscustomobject]@{ id = 'A6'; name = 'compact is content-sized (120px floor), no scrollbar'; pass = ($cp.rowMinH -eq '120px') -and ($cp.overflow -le 0); detail = "floor=$($cp.rowMinH) overflow=$($cp.overflow)" }
  $out += [pscustomobject]@{ id = 'A7'; name = 'Events keeps its own 325px floor'; pass = ($v.rowMinH -eq '325px'); detail = "floor=$($v.rowMinH)" }
  $out += [pscustomobject]@{ id = 'A8'; name = 'a busy Pulse (8 action-mix rows) has no scrollbar at 1708px'; pass = ($pu.overflow -le 0); detail = "panel=$($pu.panelClient) content=$($pu.panelScroll)" }
  $bi = $h.barInfo
  $out += [pscustomobject]@{ id = 'B1'; name = 'the banner: aria-hidden "Audit trail" title, 4 tabs each with an aria-hidden icon, one selected, "Report metrics" with an icon'; pass = $bi.titleHidden -and ($bi.titleText -eq 'Audit trail') -and ($bi.tabs -eq 4) -and ($bi.tabIcons -eq 4) -and ($bi.selected -eq 1) -and ($bi.linkText -like 'Report metrics*') -and $bi.linkIcon; detail = "title=[$($bi.titleText)] hidden=$($bi.titleHidden) tabs=$($bi.tabs) icons=$($bi.tabIcons) selected=$($bi.selected) link=[$($bi.linkText)]" }
  $out += [pscustomobject]@{ id = 'B2'; name = 'it IS a band: a background gradient and a 4px accent edge'; pass = ($bi.bgImage -like 'linear-gradient*') -and ($bi.borderLeft -eq '4px'); detail = "bg=$($bi.bgImage) edge=$($bi.borderLeft)" }
  $out += [pscustomobject]@{ id = 'B3'; name = 'the pills read: >= 12px and >= 600 weight'; pass = ($bi.pillFont -ge 12) -and ($bi.pillWeight -ge 600); detail = "font=$($bi.pillFont) weight=$($bi.pillWeight)" }
  $out += [pscustomobject]@{ id = 'B4'; name = 'the metrics link is a solid brand button'; pass = [bool]$bi.linkIsBrand; detail = "brandFill=$($bi.linkIsBrand)" }
  $out += [pscustomobject]@{ id = 'B5'; name = 'one line at 1708 (hint shown) and at 900 (hint dropped, title word kept)'; pass = ($h.barLines -eq 1) -and $h.hintShown -and ($n.barLines -eq 1) -and (-not $n.hintShown) -and $n.titleWordShown; detail = "1708 lines=$($h.barLines) hint=$($h.hintShown) | 900 lines=$($n.barLines) hint=$($n.hintShown) word=$($n.titleWordShown)" }
  $out += [pscustomobject]@{ id = 'B6'; name = 'one line at 720 (title word dropped, shield kept)'; pass = ($sm.barLines -eq 1) -and (-not $sm.titleWordShown); detail = "lines=$($sm.barLines) word=$($sm.titleWordShown)" }
  $out += [pscustomobject]@{ id = 'B7'; name = 'the compact bar is slim: <= 30px (41 docked)'; pass = ($cp.bar.h -le 30) -and ($cp.bar.h -lt $h.bar.h); detail = "compact=$($cp.bar.h) docked=$($h.bar.h)" }
  $fails = @(); $cnt = 0; $tileBad = @()
  foreach ($th in $m['__themes']) {
    foreach ($sg in @('health', 'events')) {
      $r = $m["k|$th|$sg"]
      if ($null -eq $r -or $null -eq $r.contrast) { $fails += "$th/$sg=missing"; continue }
      foreach ($pr in $r.contrast.PSObject.Properties) { $cnt++; if ([double]$pr.Value -lt 4.5) { $fails += "$th/$sg/$($pr.Name)=$($pr.Value)" } }
    }
    $rp = $m["k|$th|pulse"]
    if ($null -eq $rp -or $null -eq $rp.errTile -or -not $rp.errTile.same) { $tileBad += "$th=$(if ($rp -and $rp.errTile) { $rp.errTile.diff } else { 'missing' })" }
  }
  $out += [pscustomobject]@{ id = 'B8'; name = "every banner text pair >= 4.5:1 on all $(@($m['__themes']).Count) themes, Health and Events selected"; pass = ($fails.Count -eq 0) -and ($cnt -gt 100); detail = "pairs=$cnt fails: $($fails -join ' ')" }
  # --- the errors work ---
  function RepCard($r) { if ($r -and $r.healthCards) { return @($r.healthCards.cards | Where-Object { $_.head -like 'Report errors*' })[0] } return $null }
  $rc = RepCard $hc; $rcn = RepCard $m['hcn1708']
  $bt1 = if ($rc -and $rc.clips) { [string](@($rc.clips)[-1].title) } else { '' }
  $out += [pscustomobject]@{ id = 'H1'; name = 'Report errors card: "2 browser errors, latest Sep 13, not counted" (newest row in the title), no alarm - also from an old get_audit_log.php'; pass = ($hc.healthCards.n -eq 4) -and ($null -ne $rc) -and ($rc.cls -like '*sev-ok*') -and ($rc.text -like '*No failed runs, query timeouts or too-big results*') -and ($rc.text -like '*2 browser errors, latest Sep 13, not counted*') -and ($bt1 -like '*Newest: Sep 13 * CLIENT ERROR*') -and ($rc.goto -eq 'bad') -and ($null -eq $hc.unresolved) -and ($null -ne $rcn) -and ($rcn.text -like '*2 browser errors, latest Sep 13, not counted*'); detail = "cards=$($hc.healthCards.n) cls=$($rc.cls) unresolved=$($null -ne $hc.unresolved) text=$($rc.text) | title=$bt1 | fallback=$($rcn.text)" }
  $rq = if ($hq.healthCards) { @($hq.healthCards.cards | Where-Object { $_.head -like 'Report errors*' })[0] } else { $null }
  $out += [pscustomobject]@{ id = 'H2'; name = 'a query timeout in 72 h raises the flag: Unresolved card headlined by it (not a newer browser error), Report errors red at 1 in 72 h'; pass = ($null -ne $hq.unresolved) -and ($hq.unresolved -like '*QUERY TIMEOUT*') -and ($hq.unresolved -notlike '*CLIENT ERROR*') -and ($null -ne $rq) -and ($rq.cls -like '*sev-bad*') -and ($rq.head -like '*1 * 72 H*') -and ($rq.text -like '*1 query timeout, latest Sep 25*'); detail = "unresolved=$($hq.unresolved) | card=$($rq.cls) $($rq.head)" }
  $out += [pscustomobject]@{ id = 'H3'; name = 'the four cards sit in one row with no scrollbar at 1293px (125% scaling)'; pass = ($h13.overflow -le 0) -and ($h13.healthCards.rows -eq 1) -and ($h13.healthCards.n -eq 4); detail = "overflow=$($h13.overflow) rows=$($h13.healthCards.rows) cards=$($h13.healthCards.n)" }
  $o = @($m['ho1708'], $m['ho1293'], $m['ho1123'], $m['hom1123']); $oc = @($o | ForEach-Object { RepCard $_ })
  $h4 = ($oc.Count -eq 4) -and (@($o | Where-Object { $_.overflow -le 0 -and $_.healthCards.rows -eq 1 -and $_.healthCards.n -eq 4 -and $null -eq $_.unresolved }).Count -eq 4) -and
        (@($oc[0..2] | Where-Object { $_ -and $_.cls -like '*sev-ok*' -and $_.text -like '*2 timeouts / too-big results, latest Sep 18*' }).Count -eq 3) -and
        ($null -ne $oc[3]) -and ($oc[3].text -like '*1,595 timeouts / too-big results, latest Sep 18*') -and ($oc[3].text -like '*1,031 browser errors, latest Sep 13, not counted*')
  $out += [pscustomobject]@{ id = 'H4'; name = 'older failures (outside 72 h): "2 timeouts / too-big results, latest Sep 18", no alarm, one row, no scrollbar at 1708 / 1293 / 1123px, a noisy report''s lines clipped'; pass = $h4; detail = (@(0, 1, 2, 3) | ForEach-Object { "$(@('1708', '1293', '1123', '1123 noisy')[$_]): overflow=$($o[$_].overflow) rows=$($o[$_].healthCards.rows) cut=$(if ($oc[$_]) { (@($oc[$_].clips) | ForEach-Object { $_.cut }) -join '/' })" }) -join ' | ' }
  $rm = RepCard $m['hm1708']
  $out += [pscustomobject]@{ id = 'H5'; name = 'the counts are the server''s all-time ones: "31 browser errors" with only 2 among the rows fetched'; pass = ($null -ne $rm) -and ($rm.text -like '*31 browser errors, latest Sep 13, not counted*'); detail = "text=$($rm.text)" }
  $out += [pscustomobject]@{ id = 'H6'; name = 'nothing on record = no Report errors card: three cards as before, one row, no scrollbar at 900px'; pass = ($h.healthCards.n -eq 3) -and (@($h.healthCards.cards | Where-Object { $_.head -like 'Report errors*' }).Count -eq 0) -and ($n.healthCards.n -eq 3) -and ($n.healthCards.rows -eq 1) -and ($n.overflow -le 0); detail = "1708 cards=$($h.healthCards.n) | 900 cards=$($n.healthCards.n) rows=$($n.healthCards.rows) overflow=$($n.overflow)" }
  # --- runs that failed outright, QUERY_FAIL (2026-10-30) ---
  $hf = $m['hf1708']; $rf = RepCard $hf; $rfm = RepCard $m['hfm1708']; $rfn = RepCard $m['hfn1708']
  $out += [pscustomobject]@{ id = 'H7'; name = 'four failed runs in 72 h raise the flag: Unresolved headlined by QUERY FAIL, Report errors red, "4 failed runs, latest Oct 30", 4 · 72 H'; pass = ($null -ne $hf.unresolved) -and ($hf.unresolved -like '*QUERY FAIL*') -and ($null -ne $rf) -and ($rf.cls -like '*sev-bad*') -and ($rf.head -like '*4 * 72 H*') -and ($rf.text -like '*4 failed runs, latest Oct 30*'); detail = "unresolved=$($hf.unresolved) | card=$($rf.cls) $($rf.head) | text=$($rf.text)" }
  $out += [pscustomobject]@{ id = 'H8'; name = 'mixed with a timeout and a too-big result: "6 failed runs / timeouts / too-big results, latest Oct 30"'; pass = ($null -ne $rfm) -and ($rfm.text -like '*6 failed runs / timeouts / too-big results, latest Oct 30*'); detail = "text=$($rfm.text)" }
  $out += [pscustomobject]@{ id = 'H9'; name = 'an old get_audit_log.php (no errkinds): the card counts the QUERY_FAIL rows itself, "4 failed runs, latest Oct 30"'; pass = ($null -ne $rfn) -and ($rfn.text -like '*4 failed runs, latest Oct 30*'); detail = "text=$($rfn.text)" }
  $out += [pscustomobject]@{ id = 'R1'; name = 'the REAL ribbon names them: "4 failed runs, query timeouts or too-big results (last 72 h)", "Show the 4 events"'; pass = ($null -ne $hf.ribbon) -and ($hf.ribbon -like '*Needs attention:*4 failed runs, query timeouts or too-big results (last 72 h)*') -and ($hf.ribbon -like '*Show the 4 events*'); detail = "ribbon=$($hf.ribbon)" }
  $et = $pu.errTile
  $out += [pscustomobject]@{ id = 'P1'; name = 'Pulse''s Errors tile is a <button> into Events > Security & errors, "last: Sep 13", a tooltip naming every type'; pass = ($null -ne $et) -and ($et.tag -eq 'BUTTON') -and ($et.goto -eq 'bad') -and ($et.sub -eq 'last: Sep 13') -and ($et.title -like '*browser errors*') -and ($et.title -like '*query timeouts*'); detail = "tag=$($et.tag) goto=$($et.goto) sub=[$($et.sub)] title=[$($et.title)]" }
  $out += [pscustomobject]@{ id = 'P2'; name = 'the Errors tile looks exactly like its neighbour tile on all themes'; pass = ($tileBad.Count -eq 0); detail = "differs: $($tileBad -join ' ')" }
  $gt = @($pu.goTiles); $gv = @($gt | Where-Object { $_.k -eq 'Total views' })[0]; $gu = @($gt | Where-Object { $_.k -eq 'Updates' })[0]; $ge = @($gt | Where-Object { $_.k -eq 'Errors' })[0]
  $lookBad = @()
  foreach ($th in $m['__themes']) { $rp = $m["k|$th|pulse"]; foreach ($t3 in @($rp.goTiles)) { if (-not $t3.same) { $lookBad += "$th/$($t3.k)" } } }
  $p3 = ($gt.Count -eq 3) -and ($null -ne $gv) -and ($gv.ev -eq 'view') -and ($gv.title -like '*Click to list them in Events*') -and ($null -ne $gu) -and ($gu.seg -eq 'changes') -and ($gu.title -like '*Click to see them in Changes*') -and ($null -ne $ge) -and ($ge.ev -eq 'bad') -and ($lookBad.Count -eq 0)
  $out += [pscustomobject]@{ id = 'P3'; name = 'Total views -> Events (Views) and Updates -> Changes are buttons too, tooltips say where, all three look like the plain tiles on all themes'; pass = $p3; detail = "buttons=$(($gt | ForEach-Object { $_.k + '>' + $(if ($_.ev) { 'events:' + $_.ev } else { 'seg:' + $_.seg }) }) -join ', ') look-differs: $($lookBad -join ' ')" }
  $ck = $pu.clicks
  $p4 = ($null -ne $ck) -and ($ck.views.seg -eq 'events') -and ($ck.views.loads -eq 1) -and ($ck.views.fam -eq 'view') -and ($ck.updates.seg -eq 'changes') -and ($ck.updates.loads -eq 0) -and ($ck.errors.seg -eq 'events') -and ($ck.errors.fam -eq 'bad')
  $out += [pscustomobject]@{ id = 'P4'; name = 'the real click delegates: Total views = Events pre-filtered to Views, Updates = the Changes segment, Errors = Events > Security & errors'; pass = $p4; detail = $(if ($ck) { "views=$($ck.views.seg)/$($ck.views.fam)/$($ck.views.loads) updates=$($ck.updates.seg)/$($ck.updates.loads) errors=$($ck.errors.seg)/$($ck.errors.fam)" } else { 'no click record' }) }
  $ia = @(); if ($m['__inst'] -and $m['__inst'].asserts) { $ia = @($m['__inst'].asserts) }
  foreach ($id in @('E0', 'C1', 'C2', 'C3')) {
    $x = @($ia | Where-Object { $_.id -eq $id })[0]
    if ($null -eq $x) { $z = @($ia | Where-Object { $_.id -like 'Z*' })[0]; $out += [pscustomobject]@{ id = $id; name = "installer check $id ran"; pass = $false; detail = $(if ($z) { $z.detail } else { 'missing' }) } }
    else { $out += [pscustomobject]@{ id = $id; name = $x.name; pass = [bool]$x.pass; detail = $x.detail } }
  }
  # The ResizeObserver notice (2026-10-21): inst.html?part=ro, its own page load.
  $ir = @(); if ($m['__instro'] -and $m['__instro'].asserts) { $ir = @($m['__instro'].asserts) }
  foreach ($id in @('C4', 'C5', 'C6', 'C7')) {
    $x = @($ir | Where-Object { $_.id -eq $id })[0]
    if ($null -eq $x) { $z = @($ir | Where-Object { $_.id -like 'Z*' })[0]; $out += [pscustomobject]@{ id = $id; name = "installer check $id ran"; pass = $false; detail = $(if ($z) { $z.detail } elseif ($m['__instro'] -and $m['__instro'].error) { $m['__instro'].error } else { 'missing' }) } }
    else { $out += [pscustomobject]@{ id = $id; name = $x.name; pass = [bool]$x.pass; detail = $x.detail } }
  }
  $bt = [string]$m['__benign']
  $out += [pscustomobject]@{ id = 'L1'; name = 'log_client_error.php drops the browser''s own notices (view-transition aborts, the ResizeObserver notice), keeps everything else (14 cases)'; pass = ($bt -match 'RESULT: GREEN') -and (([regex]::Matches($bt, '(?m)^PASS')).Count -eq 14); detail = (($bt -split "`n" | Where-Object { $_ -cmatch '^(FAIL|RESULT|LIFT)' }) -join ' ').Trim() }
  $a = $s.aud
  $g = @()
  if ($a -notmatch "COUNT\(CASE WHEN ACTION IN \('QUERY_TIMEOUT','QUERY_TOOBIG','QUERY_FAIL'\) AND TIMESTAMP >= SYSDATE - 3 THEN 1 END\) AS ATT_QUERY") { $g += 'no ATT_QUERY (with QUERY_FAIL)' }
  if ($a -notmatch "TO_CHAR\(MAX\(CASE WHEN ACTION IN \('QUERY_TIMEOUT','QUERY_TOOBIG','QUERY_FAIL'\) THEN TIMESTAMP END\), 'Mon FMDD'\) AS ERR_QLAST") { $g += 'ERR_QLAST without QUERY_FAIL' }
  if ($a -notmatch "COUNT\(CASE WHEN ACTION = 'QUERY_FAIL' THEN 1 END\) AS ERR_QERR,") { $g += 'no ERR_QERR' }
  if ($a -notmatch "'qerr'\s*=>\s*isset\(\`$kpiRow\['ERR_QERR'\]\)") { $g += 'errkinds.qerr missing' }
  if ($a -notmatch "MAX\(CASE WHEN ACTION IN \(\`$alarmList\) THEN TIMESTAMP END\), 'YYYYMMDDHH24MISS'\) AS ATT_LAST") { $g += 'ATT_LAST not over $alarmList' }
  if ($a -notmatch "array_diff\(penumbraErrorActions\(\), array\('CLIENT_ERROR'\)\)") { $g += '$alarmList keeps CLIENT_ERROR' }
  if ($a -notmatch "'query'\s*=>\s*isset\(\`$kpiRow\['ATT_QUERY'\]\)") { $g += 'attention.query missing' }
  if ($a -notmatch "AS ERR_LAST" -or $a -notmatch "\`$kpis\['err_last'\]") { $g += 'err_last missing' }
  foreach ($col in @('ERR_QTO', 'ERR_QBIG', 'ERR_QLAST', 'ERR_BROWSER', 'ERR_BLAST')) { if ($a -notmatch "AS $col,") { $g += "no $col" } }
  if ($a -notmatch "\`$kpis\['errkinds'\] = array\(") { $g += 'errkinds missing' }
  $out += [pscustomobject]@{ id = 'G1'; name = 'get_audit_log.php: ATT_QUERY in 72 h, ATT_LAST over the alarm set (no CLIENT_ERROR), ERR_LAST -> err_last, per-kind counts -> errkinds'; pass = ($g.Count -eq 0); detail = $(if ($g.Count) { $g -join '; ' } else { 'all present' }) }
  # --- the neutral badge for the browser's harmless notices (2026-10-21, ev.html) ---
  function EvRow($r, $k) { if ($r -and $r.rows) { return @($r.rows | Where-Object { $_.k -eq $k })[0] } return $null }
  function EvErr($r) { if ($null -eq $r) { return 'no result' } if ($r.error) { return [string]$r.error } if ($r.errs -and @($r.errs).Count) { return 'script errors: ' + (@($r.errs) -join ' / ') } return '' }
  $tipB = 'A harmless browser notice, not counted as an error. Click to filter the log to CLIENT_ERROR events'
  $tipR = 'Click to filter the log to CLIENT_ERROR events'
  $neutral = 'audit-action-badge action-default'; $red = 'audit-action-badge action-danger'
  $ev = $m['ev']; $e1 = EvErr $ev
  $ro = EvRow $ev 'ro'; $vt = EvRow $ev 'vt'; $re = EvRow $ev 'real'; $dn = EvRow $ev 'denied'
  $n1 = ($e1 -eq '') -and ($ev.n -eq 7) -and ($null -ne $ro) -and ($null -ne $vt) -and ($null -ne $re) -and ($null -ne $dn) -and
        ($ro.cls -eq $neutral) -and ($ro.title -eq $tipB) -and ($vt.cls -eq $neutral) -and ($vt.title -eq $tipB) -and
        ($re.cls -eq $red) -and ($re.title -eq $tipR) -and ($dn.cls -eq $red) -and
        (@(@($ro, $vt, $re) | Where-Object { $_.label -eq 'CLIENT ERROR' -and $_.q -eq 'CLIENT_ERROR' -and $_.action -eq 'CLIENT_ERROR' }).Count -eq 3)
  $out += [pscustomobject]@{ id = 'N1'; name = 'Events (the REAL loadAuditLog): the ResizeObserver notice and an old "Transition was skipped" (BENIGN) wear the neutral badge, the tooltip says why; a real browser error and a denial stay red; label + click-to-filter unchanged'; pass = $n1; detail = $(if ($e1) { $e1 } else { "rows=$($ev.n) ro=$($ro.cls -replace 'audit-action-badge ', '') [$($ro.title)] vt=$($vt.cls -replace 'audit-action-badge ', '') real=$($re.cls -replace 'audit-action-badge ', '') [$($re.title)] denied=$($dn.cls -replace 'audit-action-badge ', '')" }) }
  $n2bad = @(); $n2cnt = 0; $n2min = 99.0
  foreach ($th in $m['__themes']) {
    $r = $m["ev|$th"]; $er = EvErr $r
    if ($er) { $n2bad += "$th=$er"; continue }
    $a1 = EvRow $r 'ro'; $rn = EvRow $r 'rename'; $rr = EvRow $r 'real'
    if ($null -eq $a1 -or $null -eq $rn -or $null -eq $rr) { $n2bad += "$th=rows missing"; continue }
    $n2cnt++
    if ($a1.cls -ne $neutral -or $a1.color -ne $rn.color -or $a1.bg -ne $rn.bg -or $a1.border -ne $rn.border) { $n2bad += "$th=not the plain neutral badge ($($a1.cls) $($a1.bg) vs $($rn.bg))" }
    if ($a1.color -eq $rr.color -and $a1.bg -eq $rr.bg) { $n2bad += "$th=same as the red badge" }
    if ([double]$a1.ratio -lt $n2min) { $n2min = [double]$a1.ratio }
    if ([double]$a1.ratio -lt 4.5) { $n2bad += "$th=text $($a1.ratio):1" }
  }
  $nTh = @($m['__themes']).Count
  $out += [pscustomobject]@{ id = 'N2'; name = "the harmless notice's badge IS the plain neutral one (RENAME's), not the red one, text >= 4.5:1 on its fill, on all $nTh themes"; pass = ($n2bad.Count -eq 0) -and ($n2cnt -gt 0) -and ($n2cnt -eq $nTh); detail = "themes=$n2cnt/$nTh min=$($n2min):1 $(if ($n2bad.Count) { 'fails: ' + ($n2bad -join ' | ') })" }
  $eo = $m['evold']; $ew = $m['evviewer']; $e3 = (@((EvErr $eo), (EvErr $ew)) | Where-Object { $_ }) -join ' | '
  $o3 = @('ro', 'vt', 'real' | ForEach-Object { EvRow $eo $_ }); $w3 = @('ro', 'vt', 'real' | ForEach-Object { EvRow $ew $_ })
  $n3 = ($e3 -eq '') -and (@($o3 | Where-Object { $_ -and $_.cls -eq $red -and $_.title -eq $tipR }).Count -eq 3) -and
        ($o3.Count -eq 3) -and ($w3.Count -eq 3) -and ($w3[0].cls -eq $neutral) -and ($w3[1].cls -eq $neutral) -and ($w3[2].cls -eq $red) -and
        ($w3[0].msg -notlike '*ResizeObserver*') -and ($w3[0].title -eq $tipB)
  $out += [pscustomobject]@{ id = 'N3'; name = 'an older get_audit_log.php (no BENIGN) leaves every CLIENT_ERROR red; a plain viewer''s scrubbed rows (no message) still go neutral by the server''s flag'; pass = $n3; detail = $(if ($e3) { $e3 } else { "old: $((@($o3) | ForEach-Object { $_.k + '=' + ($_.cls -replace 'audit-action-badge ', '') }) -join ' ') | viewer: $((@($w3) | ForEach-Object { $_.k + '=' + ($_.cls -replace 'audit-action-badge ', '') }) -join ' ') msg=[$($w3[0].msg)]" }) }
  $g2 = @()
  if (-not $a.Contains('$benignCol = "CASE WHEN " . penumbraBenignClientErrorSql() . " THEN 1 ELSE 0 END AS BENIGN,";')) { $g2 += 'BENIGN not through penumbraBenignClientErrorSql()' }
  $sel = [regex]::Match($a, '(?s)\$log_sql = "SELECT(.*?)FROM PENUMBRA_AUDIT')
  if (-not $sel.Success -or -not $sel.Groups[1].Value.Contains('{$benignCol}')) { $g2 += 'the list query does not select it' }
  if (-not $a.Contains("`$row['BENIGN'] = (isset(`$row['BENIGN']) && (int)`$row['BENIGN'] === 1) ? 1 : 0;")) { $g2 += 'not a number 0 / 1' }
  if ($a -match "unset\([^)]*\['BENIGN'\]") { $g2 += 'unset somewhere' }
  $out += [pscustomobject]@{ id = 'G2'; name = 'get_audit_log.php: the Events list query selects BENIGN through the SAME SQL twin (penumbraBenignClientErrorSql()), a number 0 / 1, never unset'; pass = ($g2.Count -eq 0); detail = $(if ($g2.Count) { $g2 -join '; ' } else { 'all present' }) }
  $mixQ = [regex]::Match($a, '(?s)\$mix_stmt = \$oracleConn->prepare\((.*?)\);')
  $g3 = $mixQ.Success -and $mixQ.Groups[1].Value.Contains('GROUP BY ACTION') -and $mixQ.Groups[1].Value.Contains('WHERE REPORT_ID = :report_id AND NOT " . penumbraBenignClientErrorSql() . "')
  $out += [pscustomobject]@{ id = 'G3'; name = 'get_audit_log.php: Pulse''s action mix leaves the browser''s harmless notices out, through the SAME SQL twin (penumbraBenignClientErrorSql())'; pass = $g3; detail = $(if ($g3) { 'present' } elseif (-not $mixQ.Success) { 'the action mix query not found' } else { 'the mix counts every CLIENT_ERROR row' }) }
  return ,$out
}

Write-Host "main.css:  $cssPath"; Write-Host "main.js:   $jsPath"; Write-Host "index.php: $idxPath"; Write-Host "log_client_error.php: $logPath"; Write-Host "get_audit_log.php: $audPath"; Write-Host "db_connection.php: $dbPath"
if ($CheckAnchors -or $Mutants) {
  $stale = @()
  foreach ($nm in $mutantDefs.Keys) { try { [void](Apply-Mutant $src0[$mutantDefs[$nm].t] $nm) } catch { $stale += $_.Exception.Message } }
  if ($stale.Count) { $stale | ForEach-Object { Write-Host "ANCHOR $_" }; Write-Host 'RESULT: RED'; return }
  Write-Host "ANCHORS all $($mutantDefs.Count) mutants apply exactly once"
  if ($CheckAnchors) { Write-Host 'RESULT: GREEN'; return }
}
if ($Mutant -or $Mutants) {
  $names = if ($Mutants) { @($mutantDefs.Keys) } else { @($Mutant) }
  $bite = 0
  foreach ($nm in $names) {
    if (-not $mutantDefs.Contains($nm)) { throw "unknown mutant '$nm' (known: $(($mutantDefs.Keys) -join ', '))" }
    $sx = @{}; foreach ($k in $src0.Keys) { $sx[$k] = $src0[$k] }
    $tk = $mutantDefs[$nm].t; $sx[$tk] = Apply-Mutant $src0[$tk] $nm
    $all = Get-Asserts (Invoke-Cases $sx) $sx
    $red = @($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id })
    $miss = @($mutantDefs[$nm].red | Where-Object { $red -notcontains $_ })
    if ($miss.Count -eq 0) { $bite++; Write-Host ("MUTANT {0,-15} BITES   red: {1}" -f $nm, ($red -join ' ')) }
    else { Write-Host ("MUTANT {0,-15} MISSED  {1} stayed green; red: {2}" -f $nm, ($miss -join ' '), ($red -join ' ')) }
  }
  Write-Host "MUTANTS $bite / $($names.Count) bite"
  Write-Host $(if ($bite -eq $names.Count) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}
$all = Get-Asserts (Invoke-Cases $src0) $src0
foreach ($x in $all) { $d = [string]$x.detail; if ($d.Length -gt 300) { $d = $d.Substring(0, 300) + '...' }; Write-Host ('  {0}  {1} {2}  [{3}]' -f $(if ($x.pass) { 'PASS' } else { 'FAIL' }), $x.id, $x.name, $d) }
$p = @($all | Where-Object { $_.pass }).Count; $f = @($all | Where-Object { -not $_.pass }).Count
Write-Host "TOTAL pass=$p fail=$f"
if ($f) { Write-Host ('FAILED: ' + (@($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id }) -join ' ')) }
Write-Host $(if ($f -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
