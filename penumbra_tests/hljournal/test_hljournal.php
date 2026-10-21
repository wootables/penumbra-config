<?php
// hljournal suite - email half (2026-10-20 e, hl phase 4): the report's rules on and about the journal's
// columns in a scheduled email, on a side-effect-free mirror of schedule_runner.php (pivotparity's
// extract_mirror.php; never require the runner: it connects and SENDS MAIL).
//   php -n test_hljournal.php <mirror.php> <penumbra_calc.php> <themes_config.php> <penumbra_search.php> <journal_export.php>
// A toggle Done (key k1, the email's DONE 1/0), its who / when columns (DONE BY, DONE ON) and the Notes
// as text (the report sends them: NOTES); the rules filed under the internal names.
require_once $argv[4];
require_once $argv[5];
require_once $argv[1];
require_once $argv[2];
require_once $argv[3];
if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
set_error_handler(function () { return true; }, E_ALL);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function email_rows($html) {
    $out = array();
    $at = strpos($html, '>V_ID</th>');
    if ($at === false) return $out;
    $t0 = strrpos(substr($html, 0, $at), '<table');
    $t1 = strpos($html, '</table>', $at);
    $tb = substr($html, $t0, $t1 - $t0);
    if (preg_match('/<tbody>(.*?)<\/tbody>/s', $tb, $m)) {
        preg_match_all("/<tr style='([^']*)'>(.*?)<\/tr>/s", $m[1], $trs, PREG_SET_ORDER);
        foreach ($trs as $tr) {
            preg_match_all("/<td style='([^']*)'>(.*?)<\/td>/s", $tr[2], $tds, PREG_SET_ORDER);
            $row = array('tr' => $tr[1], 'style' => array(), 'text' => array());
            foreach ($tds as $td) { $row['style'][] = $td[1]; $row['text'][] = trim(html_entity_decode(strip_tags($td[2]), ENT_QUOTES, 'UTF-8')); }
            $out[] = $row;
        }
    }
    return $out;
}

// (the round's own: penumbra_hl_journal_rules - without it, live's email, the other checks still run)
$hasMap = function_exists('penumbra_hl_journal_rules');
$need = array('penumbra_state_highlight_rules', 'generate_report_html', '_snippet_journal_toggles');
$missing = array_values(array_filter($need, function ($f) { return !function_exists($f); }));
$names = array('E-map', 'E-row', 'E-who', 'E-strike', 'E-notesOff', 'E-pdf', 'E-noJournal');
if ($missing) {
    foreach ($names as $n) ok(false, $n, 'missing: ' . implode(' ', $missing));
    echo "TOTAL pass=$pass fail=$fail\n";
    exit;
}
$jt = array('colNames' => array('DONE'), 'colMeta' => array(array('key' => 'k1', 'name' => 'DONE', 'label' => 'Done')),
            'keyUpper' => array('V_ID'), 'stateMap' => array(),
            'whoMeta' => array(array('key' => 'k1', 'kind' => 'by', 'name' => 'DONE BY'), array('key' => 'k1', 'kind' => 'on', 'name' => 'DONE ON')),
            'whoNames' => array('DONE BY', 'DONE ON'), 'whoMap' => array(), 'aliasMap' => array(),
            'notesName' => 'NOTES', 'notesMap' => array(), 'notesSearch' => 'NOTES', 'notesCount' => array());
$rows = array();
for ($i = 1; $i <= 9; $i++) {
    $done = ($i % 3 === 0);
    $rows[] = array('V_ID' => 'ID-' . (1000 + $i), 'V_NAME' => 'Name ' . $i, 'DONE' => $done ? '1' : '0',
                    'DONE BY' => $done ? ($i === 3 ? 'harness' : 'pat') : '', 'DONE ON' => $done ? '2026-10-15' : '',
                    'NOTES' => ($i === 2 || $i === 3) ? '2026-10-14 harness: budget sent to the PI' : '');
}
$amber = 'var(--pnb-hl-amber, #fbe8a6)';
$state = array('columnHighlights' => array(
    '__JOURNAL_TOGGLE__K1' => array(array('id' => 'a1', 'w' => 'Done = ☑', 'css' => 'background-color: ' . $amber, 'row' => true)),
    '__JOURNAL_BY__K1' => array(array('id' => 'a2', 'w' => '{Done by} = //harness//', 'css' => 'font-style: italic', 'row' => false)),
    '__JOURNAL_NOTES' => array(array('id' => 'a3', 'w' => 'Notes > 0', 'css' => 'color: #c62828', 'row' => false)),
    'V_NAME' => array(array('id' => 'a4', 'w' => 'Notes contains budget', 'css' => 'font-weight: bold', 'row' => false),
                      array('id' => 'a5', 'w' => 'Done = ☐', 'css' => 'text-decoration: line-through', 'row' => false)),
    '__JOURNAL_TOGGLE__ZZ' => array(array('id' => 'a6', 'w' => '', 'css' => 'color: #123456', 'row' => false))
));
_snippet_journal_toggles($jt);
$rules = penumbra_state_highlight_rules($state);
$mapped = $hasMap ? penumbra_hl_journal_rules($rules) : array();
$sum = array_map(function ($r) { return (isset($r['targetColumn']) ? $r['targetColumn'] : '(row)') . ' | ' . $r['condition']; }, $mapped);
ok(count($mapped) === 3 && in_array('(row) | Done = ☑', $sum, true) && in_array('DONE BY | {Done by} = //harness//', $sum, true) && in_array('V_NAME | Done = ☐', $sum, true),
   'E-map the internal names take the email\'s (DONE BY), a rule reading the Notes and one on a toggle the email has not are left out', json_encode($sum));

$GLOBALS['penumbra_highlight_rules'] = $rules;
$GLOBALS['penumbra_column_formats'] = array();
$GLOBALS['penumbra_column_summaries'] = array();
$html = generate_report_html($rows, 'standard', 'theme-default', 'Journal highlights', false, '', true);
$em = email_rows($html);
$bad = array(); $who = array(); $strike = array(); $notes = 0;
foreach ($em as $k => $row) {
    $src = $rows[$k];
    $fill = strpos($row['tr'], '#fbe8a6') !== false;
    if ($fill !== ($src['DONE'] === '1')) $bad[] = $src['V_ID'] . ' fill ' . (int)$fill;
    $it = strpos($row['style'][3], 'font-style: italic') !== false;
    if ($it !== ($src['DONE BY'] === 'harness')) $who[] = $src['V_ID'] . ' italic ' . (int)$it;
    $st = strpos($row['style'][1], 'line-through') !== false;
    if ($st !== ($src['DONE'] === '0')) $strike[] = $src['V_ID'] . ' strike ' . (int)$st;
    foreach ($row['style'] as $s) { if (strpos($s, 'c62828') !== false || strpos($s, 'font-weight: bold') !== false) $notes++; }
}
ok(count($em) === 9 && !$bad, 'E-row the toggle\'s whole-row rule colors the rows the email has checked', count($em) . ' rows; ' . implode(' ; ', $bad));
ok(count($em) === 9 && !$who, 'E-who a rule on Done by draws on the email\'s DONE BY cells', implode(' ; ', $who));
ok(count($em) === 9 && !$strike, 'E-strike a data column\'s rule naming the toggle (Done = ☐) draws', implode(' ; ', $strike));
ok(count($em) === 9 && $notes === 0, 'E-notesOff a rule that tests the Notes draws nothing in the email (the page\'s only)', "$notes styles");
$pdf = email_rows(generate_report_html($rows, 'standard', 'theme-default', 'T', false, '', false));
$pf = 0;
foreach ($pdf as $row) { if (strpos($row['tr'], '#fbe8a6') !== false) $pf++; foreach ($row['style'] as $s) if (strpos($s, 'italic') !== false && strpos($s, 'font-style: italic') !== false) $pf++; }
ok(count($pdf) === 9 && $pf === 0, 'E-pdf the PDF\'s table (isEmail off) draws none of them', "$pf");
// a report with no journal: the rules filed under its columns' names are left out, the others stay
_snippet_journal_toggles(false);
$plain = $hasMap ? penumbra_hl_journal_rules($rules) : array();
$ps = array_map(function ($r) { return (isset($r['targetColumn']) ? $r['targetColumn'] : '(row)') . ' | ' . $r['condition']; }, $plain);
ok(count($plain) === 3 && in_array('(row) | Done = ☑', $ps, true) && in_array('V_NAME | Notes contains budget', $ps, true) && in_array('V_NAME | Done = ☐', $ps, true),
   'E-noJournal no journal: nothing filed under a journal column, the Notes read as a data column', json_encode($ps));
echo "TOTAL pass=$pass fail=$fail\n";
