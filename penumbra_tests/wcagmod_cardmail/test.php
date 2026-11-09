<?php
// wcagmod_cardmail (wcag mod 2026-11-07, finding M25): the scheduled email's cards (penumbra_cards_email.php, run on its own;
// the runner is never required) carry the data bar's words as a small text line ("Field: value", as the card on screen
// labels its bar), none when the field is listed on the card; a pivot tile's as its bar's label, none when the big number
// shows that measure. Prints "  PASS|FAIL  <id>  <detail>" lines.
// usage: php -n test.php <penumbra_cards_email.php>
error_reporting(E_ALL); ini_set('display_errors', '1');
$INC = isset($argv[1]) ? $argv[1] : '';
function ok($id, $pass, $detail = '') { printf("  %s  %-26s %s\n", $pass ? 'PASS' : 'FAIL', $id, $pass ? '' : $detail); }
if (!is_file($INC)) { echo "  FAIL  F-include                 no include at $INC\n"; exit(0); }
require $INC;
$WARN = array();
set_error_handler(function ($no, $msg, $file, $line) use (&$WARN) { $WARN[] = basename($file) . ':' . $line . ' ' . $msg; return true; });
$th = penumbra_cards_email_theme('theme-default');
$line = function ($s) use ($th) { return '<div style="font-size:11px;color:' . $th['muted'] . ';margin:0 0 6px;">' . $s . '</div>'; };

// ---- flat cards ----------------------------------------------------------------------------------
$rows = array(
    array('ID' => 'ID-1', 'NAME' => 'Ann', 'NUM' => '10'),
    array('ID' => 'ID-2', 'NAME' => 'Ben', 'NUM' => '20'),
    array('ID' => 'ID-3', 'NAME' => 'Cy', 'NUM' => '30'),
);
$HID = array(2 => array('NUM' => array('color' => '#ffffff', 'background-color' => '#ffffff')));   // row 3's value hidden by its highlight
$cellFn = function ($row, $idx, $cols) use ($HID) {
    $o = array('row' => array(), 'cells' => array());
    foreach ($cols as $c) { if (!array_key_exists($c, $row)) continue; $o['cells'][strtoupper($c)] = array('raw' => $row[$c], 'html' => htmlspecialchars($row[$c]), 'css' => isset($HID[$idx][$c]) ? $HID[$idx][$c] : array()); }
    return $o;
};
$st = function ($sent) { return array('viewOptions' => array('cards' => array('open' => 1, 'sent' => $sent))); };
$cards = function ($h) { preg_match_all('/<div style="border:1px solid [^"]*border-radius:8px;[^"]*">(.*?)<\/div><\/td>/s', $h, $m); return $m[1]; };
$r = penumbra_cards_email_html($rows, false, penumbra_cards_email_cfg($st(array('title' => 'ID', 'bar' => 'NUM', 'fields' => array('NAME')))), 'theme-default', $cellFn, 0);
$cs = $cards($r['html']);
ok('P-barWords', count($cs) === 3 && strpos($cs[0], '</tr></table>' . $line('NUM: 10')) !== false && strpos($cs[1], $line('NUM: 20')) !== false, isset($cs[0]) ? substr($cs[0], 0, 900) : '');
ok('P-barHidden', count($cs) === 3 && strpos($cs[2], 'NUM: 30') === false && strpos($cs[2], 'margin:0 0 6px;') === false, isset($cs[2]) ? substr($cs[2], 0, 900) : '');   // (mailhid's rule) a value its highlight hides: no words either
$r2 = penumbra_cards_email_html($rows, false, penumbra_cards_email_cfg($st(array('title' => 'ID', 'bar' => 'NUM', 'fields' => array('NUM', 'NAME')))), 'theme-default', $cellFn, 0);
$cs2 = $cards($r2['html']);
ok('P-barListed', count($cs2) === 3 && strpos($r2['html'], 'margin:0 0 6px;') === false && strpos($cs2[0], 'height:6px') !== false, substr($r2['html'], 0, 600));
$r3 = penumbra_cards_email_html($rows, false, penumbra_cards_email_cfg($st(array('title' => 'ID', 'bar' => 'NUM', 'big' => 'NUM'))), 'theme-default', $cellFn, 0);
ok('P-barIsBig', strpos($r3['html'], 'margin:0 0 6px;') === false && strpos($r3['html'], 'height:6px') !== false);

// ---- pivot tiles ---------------------------------------------------------------------------------
$cell = function ($col, $agg, $v) { return array('col' => $col, 'agg' => $agg, 'html' => $v, 'hl' => ''); };
$tot = function ($agg, $v) { return array('agg' => $agg, 'html' => $v, 'hl' => ''); };
$cap = array('measures' => array('Amt', 'N'), 'rows' => array(
    array('parts' => array('Eng'), 'labels' => array('Eng'), 'cells' => array($cell('2024', 0, '$100'), $cell('2024', 1, '3')), 'totals' => array($tot(0, '$100'), $tot(1, '3'))),
    array('parts' => array('Sci'), 'labels' => array('Sci'), 'cells' => array($cell('2024', 0, '$300'), $cell('2024', 1, '5')), 'totals' => array($tot(0, '$300'), $tot(1, '5'))),
));
$tcfg = function ($big, $bar) { return penumbra_cards_tiles_cfg(array('viewOptions' => array('cards' => array('open' => 1, 'pivot' => array('big' => $big, 'bar' => $bar))))); };
$t1 = penumbra_cards_pivot_tiles_from($cap, $tcfg('N', 'Amt'));
$h1 = penumbra_cards_email_tiles_html($t1, $tcfg('N', 'Amt'), 'theme-default', 0);
ok('P-tileWords', is_array($t1) && strpos($h1['html'], '</tr></table>' . $line('Total Amt: $100')) !== false && strpos($h1['html'], $line('Total Amt: $300')) !== false, substr($h1['html'], 0, 900));
$t2 = penumbra_cards_pivot_tiles_from($cap, $tcfg('Amt', 'Amt'));
$h2 = penumbra_cards_email_tiles_html($t2, $tcfg('Amt', 'Amt'), 'theme-default', 0);
ok('P-tileSameSkip', is_array($t2) && strpos($h2['html'], 'height:6px') !== false && strpos($h2['html'], 'margin:0 0 6px;') === false, substr($h2['html'], 0, 900));
ok('P-noWarnings', !$WARN, implode(' | ', $WARN));
