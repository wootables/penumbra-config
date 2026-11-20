<?php
// =============================================================================
// fix7srv - encrypted reports carry their journal switch in the clear (encflag, 2026-11-19)
// The {"encrypted":true,"content":...} envelope hid viewOptions.journalEnabled from the server, which then let EVERY
// viewer read (and write marks on) an encrypted report's journal even while it was OFF - internal notes included.
// The saving page now writes "journal": bool beside the ciphertext; the server reads it. A state sealed before the flag
// keeps the old rule (open), so nobody loses a journal that is on.
// usage: php -n -d extension=mbstring server.php <app dir>     (the old build fails the E-*-off / E-gate / E-restore checks)
// =============================================================================
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', 'stderr');
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
if ($dir === '' || !is_file($dir . '/manage_journal.php')) { fwrite(STDERR, "usage: server.php <app dir>\n"); exit(2); }
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
class FxExit extends Exception {}
// ---- lifting (fix5srv's) ---------------------------------------------------------------------------------------
function fx_block($src, $anchor, $whole) {
    $p = strpos($src, $anchor);
    if ($p === false) return '';
    $toks = token_get_all('<?php ' . substr($src, $p));
    $depth = 0; $out = ''; $started = false;
    foreach ($toks as $t) {
        $s = is_array($t) ? $t[1] : $t;
        if (is_array($t) && $t[0] === T_OPEN_TAG) continue;
        if (!$started) {
            if ($whole) $out .= $s;
            if ($s === '{') { $started = true; $depth = 1; }
            continue;
        }
        if ($s === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) $depth++;
        if ($s === '}') { $depth--; if ($depth === 0) { if ($whole) $out .= '}'; break; } }
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'throw new FxExit()'; continue; }
        $out .= $s;
    }
    return $out;
}
function fx_lift($src, $fn) {
    if (function_exists($fn)) return true;
    $code = fx_block(str_replace("\r\n", "\n", $src), "\nfunction " . $fn . '(', true);
    if ($code === '') return false;
    try { eval($code); } catch (Throwable $e) { fwrite(STDERR, "lift $fn: " . $e->getMessage() . "\n"); return false; }
    return true;
}
function fx_call($src, $f) {
    for ($i = 0; $i < 80; $i++) {
        try { return $f(); }
        catch (Error $e) {
            if (preg_match('/Call to undefined function ([A-Za-z0-9_]+)\(\)/', $e->getMessage(), $m) && fx_lift($src, $m[1])) continue;
            throw $e;
        }
    }
    throw new Exception('too many lifts');
}

$mj = file_get_contents($dir . '/manage_journal.php');
$ss = str_replace("\r\n", "\n", file_get_contents($dir . '/save_server_state.php'));
$rs = str_replace("\r\n", "\n", file_get_contents($dir . '/restore_server_report.php'));
$js = str_replace("\r\n", "\n", file_get_contents($dir . '/js/main.js'));
$bs = str_replace("\r\n", "\n", file_get_contents($dir . '/js/penumbra_bulkset.js'));

// ---- stubs -------------------------------------------------------------------------------------------------------
$GLOBALS['RAW'] = array();   // report ID => STATE_DATA
function readClobViaOci8($t, $c, $k, $id) { return isset($GLOBALS['RAW'][(int)$id]) ? $GLOBALS['RAW'][(int)$id] : ''; }
function queryViaOci8($sql, $b = array()) { return array(); }
function penumbraIsReportOwner($owner, $uid) { return strcasecmp(trim((string)$owner), trim((string)$uid)) === 0; }
function journalCallerHoldsGrant($r, $u) { return false; }
$allowedUsers = array('adm1'); $config = null; $GLOBALS['userGrants'] = array();
if (!defined('JOURNAL_FIELD_VALUE_RE')) define('JOURNAL_FIELD_VALUE_RE', '/^o\d+$/');
foreach (array('journalReportStateFlags', 'journalReportJournalEnabled', 'journalCallerCanReadJournal', 'journalTargetCanOpenJournal',
               'journalToggleWriteRefusal', 'journalFieldWriteRefusal', 'journalSanitizeToggleKey') as $fn) {
    if (!fx_lift($mj, $fn)) fwrite(STDERR, "not lifted: $fn\n");
}
$env = function ($journal = 'none') { $e = array('encrypted' => true, 'content' => 'QUJD', 'scope_tables' => array('T')); if ($journal !== 'none') $e['journal'] = $journal; return json_encode($e); };
$plain = function ($on) { return json_encode(array('query' => 'select 1 from dual', 'viewOptions' => array('journalEnabled' => $on, 'journalToggles' => array(array('key' => 'done', 'label' => 'Done'))))); };
$rep = function ($id, $raw) { $GLOBALS['RAW'][$id] = $raw; return array('ID' => $id, 'OWNER_ID' => 'own1', 'SHORT_ID' => 'rep' . $id); };
$R_OFF = $rep(1, $env(false)); $R_ON = $rep(2, $env(true)); $R_OLD = $rep(3, $env()); $R_PLOFF = $rep(4, $plain(false)); $R_BAD = $rep(5, $env('yes'));

// ---- the flag ------------------------------------------------------------------------------------------------------
$fl = function ($r) { $f = journalReportStateFlags($r); return array($f['enc'], array_key_exists('encOn', $f) ? $f['encOn'] : 'missing'); };
A('E-flag-read', $fl($R_OFF) === array(true, false) && $fl($R_ON) === array(true, true), 'the envelope\'s journal flag is read: ' . json_encode(array($fl($R_OFF), $fl($R_ON))));
A('E-flag-legacy', $fl($R_OLD) === array(true, null) && $fl($R_BAD) === array(true, null) && $fl($R_PLOFF) === array(false, null), 'no flag / not a boolean / a plain state: null: ' . json_encode(array($fl($R_OLD), $fl($R_BAD), $fl($R_PLOFF))));

// ---- reads -------------------------------------------------------------------------------------------------------
$rd = function ($r, $u, $adm = false) { return journalCallerCanReadJournal($r, $u, $adm); };
A('E-read-off', $rd($R_OFF, 'vic') === false, 'flag off: a plain viewer cannot read the journal (it could)');
A('E-read-off-editors', $rd($R_OFF, 'own1') === true && $rd($R_OFF, 'adm1', true) === true, 'flag off: the owner and an admin still read it (the off rule)');
A('E-read-on-same', $rd($R_ON, 'vic') === true, 'flag on: a viewer reads it, as before');
A('E-read-legacy-same', $rd($R_OLD, 'vic') === true, 'sealed before the flag: open, as before');
A('E-read-plain-same', $rd($R_PLOFF, 'vic') === false, 'a plain state, off: closed, as before');

// ---- mention / reply mail ----------------------------------------------------------------------------------------
$tg = function ($r, $u, $page) { $GLOBALS['journalEncPageOn'] = $page; return journalTargetCanOpenJournal($r, $u); };
A('E-mail-off', $tg($R_OFF, 'vic', true) === false && $tg($R_OFF, 'own1', true) === true, 'flag off: a viewer is not mailed even if the page says on; the owner is');
A('E-mail-on', $tg($R_ON, 'vic', false) === true, 'flag on: a viewer is mailed whatever the page says');
A('E-mail-legacy-same', $tg($R_OLD, 'vic', true) === true && $tg($R_OLD, 'vic', false) === false, 'sealed before the flag: the page\'s journal_on, as before');

// ---- writes ------------------------------------------------------------------------------------------------------
$tw = journalToggleWriteRefusal($R_OFF, 'done', 'vic', false);
A('E-write-off', is_string($tw) && stripos($tw, 'off') !== false, 'flag off: marks refused as on a plain off report: ' . json_encode($tw));
$fw = journalFieldWriteRefusal($R_OFF, 'status3', array('o1'), 'vic', false);
A('E-field-off', is_string($fw) && stripos($fw, 'off') !== false, 'flag off: field values refused: ' . json_encode($fw));
A('E-write-on-same', journalToggleWriteRefusal($R_ON, 'done', 'vic', false) === null && journalToggleWriteRefusal($R_OLD, 'done', 'vic', false) === null
    && journalFieldWriteRefusal($R_OLD, 'status3', array('o1'), 'vic', false) === null, 'flag on / sealed before the flag: open, as before');

// ---- save_server_state: the publish gate and the flag's shape ------------------------------------------------------
$gate = null;
if (preg_match('/(\$pnbJrnOn = function \(\$st\) \{.*?\n            \};)\n            \$pnbOldState = json_decode\(\(string\)\$before_state_data, true\);\n            if \((.*?)\) \{\n/s', $ss, $m)) {
    $gate = eval('return function ($decoded_input_state, $pnbOldState) { ' . $m[1] . ' return (bool)(' . $m[2] . '); };');
}
$d = function ($s) { return json_decode($s, true); };
A('E-gate-wired', $gate !== null, 'the gate\'s rule found in save_server_state.php');
if ($gate) {
    A('E-gate-enc', $gate($d($env(true)), $d($plain(false))) === true && $gate($d($env(true)), $d($env(false))) === true,
        'a save that turns an encrypted report\'s journal on (flag) over an off one is gated (it went through unasked)');
    A('E-gate-same', $gate($d($plain(true)), $d($plain(false))) === true && $gate($d($plain(true)), $d($plain(true))) === false
        && $gate($d($env(true)), $d($env())) === false && $gate($d($env()), $d($plain(false))) === false && $gate($d($env(false)), $d($plain(false))) === false,
        'plain on over off gated, as before; on over on, an unknown side, or off: not');
}
A('E-sanitize', (bool)preg_match("/array_key_exists\\('journal', \\\$decoded_input_state\\) && !is_bool\\(\\\$decoded_input_state\\['journal'\\]\\)\\) \\{\n\\s+unset\\(\\\$decoded_input_state\\['journal'\\]\\);/", $ss),
    'save_server_state keeps only a boolean journal flag');

// ---- restore_server_report: the "publishes" warning -----------------------------------------------------------------
$rw = null;
if (preg_match('/(\$pnbJrnOn = function \(\$st\) \{.*?\};)\n(.*?)\n\s*if \(([^\n]*\$pnbJrnOn\(\$before_state_decoded\)[^\n]*)\) \{\n/s', $rs, $m)) {
    $rw = eval('return function ($pnbNew, $before_state_decoded) { $pnbEncNow = is_array($before_state_decoded) && !empty($before_state_decoded[\'encrypted\']); '
        . $m[1] . ' ' . $m[2] . ' return (bool)(' . $m[3] . '); };');
}
A('E-restore-wired', $rw !== null, 'the restore warning\'s rule found');
if ($rw) {
    A('E-restore-enc', $rw($d($env(true)), $d($plain(false))) === true && $rw($d($env()), $d($plain(false))) === true && $rw($d($env(true)), $d($env(false))) === true,
        'a protected version (flag on, or sealed before the flag) over a report whose journal is off warns that it publishes the notes');
    A('E-restore-same', $rw($d($plain(true)), $d($plain(false))) === true && $rw($d($env(false)), $d($plain(false))) === false && $rw($d($plain(true)), $d($plain(true))) === false,
        'a plain version on over off warns, as before; off or already on: not');
}
A('E-restore-words', strpos($rs, 'saved before a protected report recorded whether its Report Journal is on') !== false, 'the older-version wording');

// ---- the pages write the flag -----------------------------------------------------------------------------------
A('E-page-save', (bool)preg_match('/encrypted: true,\n\s+content: encryptedString,\n\s+journal: !!\(stateObject && stateObject\.viewOptions && stateObject\.viewOptions\.journalEnabled\)/', $js),
    'the Save dialog\'s envelope carries journal');
A('E-bulk-save', strpos($bs, 'w.journal = !!(plan.newState && plan.newState.viewOptions && plan.newState.viewOptions.journalEnabled);') !== false,
    'Bulk set\'s password envelope carries journal');

// ---- report ------------------------------------------------------------------------------------------------------
$pass = 0; $fail = array();
foreach ($R as $r) { echo ($r[1] ? '  PASS  ' : '  FAIL  ') . str_pad($r[0], 20) . ' ' . $r[2] . "\n"; if ($r[1]) $pass++; else $fail[] = $r[0]; }
echo 'TOTAL pass=' . $pass . ' fail=' . count($fail) . '   failed: ' . implode(' ', $fail) . "\n";
