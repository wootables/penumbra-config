<?php
/**
 * pivotzero, runner half (2026-10-04): the scheduled-email / export builders
 * (generate_pivot_html, generate_pivot_csv_string, pivot_build_xlsx_rows) and
 * the flat summary formula (penumbra_compute_summary).
 *
 *   R  a formula ending in '%' prints (expr) x 100 with 1 decimal + '%' in every
 *      builder, data cells and the Grand Total row; plain formulas unchanged
 *   Z  the email body prints a 0 when the cell has rows (CSV / XLSX always did);
 *      a cell with NO rows stays blank in the email body
 *   S  a '%' summary formula is a percentage (isPercent, 1 decimal)
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_runner.php                     live runner
 *   php -n test_runner.php --runner=<path>     a staged copy
 *   php -n test_runner.php --mutant=<name>     pctparse | pctflag | pctfmt | zerorows | sumpct
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_runner.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

$src = file_get_contents($runner);
$MUTANTS = array(
    // no trailing-% parse: every R check fails (the '%' is an unexpected character)
    'pctparse' => array("    if (substr(\$s, -1) === '%') {", "    if (false) {", 1),
    // the builders never learn which formulas are '%': value x100 printed as a plain number
    'pctflag'  => array("        if (is_array(\$a) && !empty(\$a['pct'])) \$GLOBALS['__pnb_pivot_formula_pct'][\$idx] = true;",
                        "        if (false) \$GLOBALS['__pnb_pivot_formula_pct'][\$idx] = true;", 1),
    // the formatter ignores the flag (same symptom, one layer down)
    'pctfmt'   => array("    if (\$aggType === 'formula' && \$aggIdx !== null && !empty(\$GLOBALS['__pnb_pivot_formula_pct'][\$aggIdx])) {",
                        "    if (false) {", 1),
    // the email body blanks every 0 again (Z HTML only)
    'zerorows' => array("if (\$val === 0 && !pivot_zero_is_meaningful(\$aggType) && !\$_cellHasRows) {",
                        "if (\$val === 0 && !pivot_zero_is_meaningful(\$aggType)) {", 1),
    // the summary formula ignores the '%' (S only)
    'sumpct'   => array("        if (!empty(\$ast['pct'])) {\r\n            return array('kind' => 'num', 'value' => (float)\$v, 'decimals' => 1",
                        "        if (false) {\r\n            return array('kind' => 'num', 'value' => (float)\$v, 'decimals' => 1", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_runner.php';
file_put_contents($tmp, $src);
exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmp) . ' ' . escapeshellarg($mirror), $exOut, $exCode);
@unlink($tmp);
if ($exCode !== 0 || !file_exists($mirror)) { fwrite(STDERR, "extract_mirror failed: " . implode("\n", $exOut) . "\n"); exit(2); }
require_once $mirror;
// The filtered aggregates run on the format-condition engine, which reads a cell with
// penumbra_search.php's _search_get_cell_value() since 2026-10-26 (cfread) - a function
// the mirror cannot carry (extract_mirror.php lifts only what schedule_runner.php
// DECLARES; the runner requires the file itself). Without it this suite died with "Call
// to undefined function" at its first filtered count. Same fix as hideempty: required
// from the runner's own tree when it has one (a staged copy may not), else the live app.
$searchPhp = dirname($runner) . '/penumbra_search.php';
if (!file_exists($searchPhp)) {
    $searchPhp = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_search.php';
}
if (!function_exists('_search_get_cell_value')) { require_once $searchPhp; }
$themesCfg = dirname($runner) . '/themes_config.php';
if (!file_exists($themesCfg)) $themesCfg = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
require_once $themesCfg;
$GLOBALS['theme_styles'] = penumbra_build_theme_styles();
// The CSV builder calls the formula guard from shared_logic.php, which requires
// db_connection.php - so lift just the two guard functions by text.
if (!function_exists('penumbraCsvGuardRow')) {
    $sl = file_get_contents('\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\shared_logic.php');
    $a = strpos($sl, 'function penumbraCsvGuardCell(');
    $b = strpos($sl, '// -- end of the CSV formula guard --');
    if ($a === false || $b === false) { fwrite(STDERR, "CSV guard functions not found in shared_logic.php\n"); exit(2); }
    eval(substr($sl, $a, $b - $a));
}

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  PASS  $label\n"; return; }
    $FAIL++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n";
}

// Pat 2 proposals / 0 awarded / 1 pending; Lee 3 / 2 / 0; Kim 1 / 1 / 0 (C1);
// Ray 2 / 1 / 0 in FY 2025 only; Amy 1 / 1 / 0 in FY 2026 (C2).
function fx() {
    $r = array();
    foreach (array(array('C1','D1','Pat','FY 2025','p1',0,0), array('C1','D1','Pat','FY 2025','p2',0,1),
                   array('C1','D1','Lee','FY 2025','p3',1,0), array('C1','D1','Lee','FY 2025','p4',1,0), array('C1','D1','Lee','FY 2025','p5',0,0),
                   array('C1','D2','Kim','FY 2025','p6',1,0),
                   array('C2','D3','Ray','FY 2025','p7',0,0), array('C2','D3','Ray','FY 2025','p8',1,0),
                   array('C2','D3','Amy','FY 2026','p9',1,0)) as $x) {
        $r[] = array('COLLEGE' => $x[0], 'DEPARTMENT' => $x[1], 'PI' => $x[2], 'FY' => $x[3], 'PROPOSAL' => $x[4],
                     'AWARDED' => (string)$x[5], 'PENDING' => (string)$x[6]);
    }
    return $r;
}
function settings($cols, $f3 = '{Awarded} / {Proposals} %', $f4 = '{Awarded} / ({Proposals} - {Still Pending}) %') {
    return array('v' => 2, 'rows' => array('COLLEGE', 'DEPARTMENT', 'PI'), 'cols' => $cols, 'vals' => 'PROPOSAL',
        'agg' => array('count', 'sum', 'sum', 'formula', 'formula'),
        'aggLabels' => array('Proposals', 'Awarded', 'Still Pending', 'Hit Ratio', 'Decided'),
        'aggColOverrides' => array('PROPOSAL', 'AWARDED', 'PENDING', null, null),
        'aggFormulas' => array(null, null, null, $f3, $f4), 'aggFilters' => null,
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalRowAggs' => null, 'totalColAggs' => null);
}
// Rows keyed by their PI cell (third cell); the last row = FOOT
function cells_html($html) {
    $g = array(); $last = null;
    preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs);
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b[^>]*>(.*?)<\/t[dh]>/is', $tr, $cs)) continue;
        $cells = array();
        foreach ($cs[1] as $c) { $cells[] = trim(html_entity_decode(strip_tags($c), ENT_QUOTES, 'UTF-8')); }
        if (isset($cells[2])) $g[$cells[2]] = $cells;
        $last = $cells;
    }
    $g['FOOT'] = $last; return $g;
}
function cells_csv($csv) {
    $g = array(); $last = null;
    foreach (explode("\n", str_replace("\r", '', $csv)) as $ln) {
        if (trim($ln) === '') continue;
        $cells = str_getcsv($ln); $cells[0] = preg_replace('/^\xEF\xBB\xBF/', '', $cells[0]);
        if (isset($cells[2])) $g[$cells[2]] = $cells;
        $last = $cells;
    }
    $g['FOOT'] = $last; return $g;
}
function cells_xlsx($x) {
    $g = array();
    foreach ($x['dataRows'] as $r) { $r = array_map('strval', $r); if (isset($r[2])) $g[$r[2]] = $r; }
    $g['FOOT'] = empty($x['footerRow']) ? null : array_map('strval', $x['footerRow']);
    return $g;
}
function grids($s) {
    $rows = fx();
    return array('HTML' => cells_html(generate_pivot_html($rows, $s, 'theme-default', true)),
                 'CSV'  => cells_csv(generate_pivot_csv_string($rows, $s)),
                 'XLSX' => cells_xlsx(pivot_build_xlsx_rows($rows, $s)));
}
function vals($g, $k) { return isset($g[$k]) ? array_slice($g[$k], 3) : array('NOROW'); }
function footvals($g) { return ($g['FOOT'] === null) ? array('NOFOOT') : array_values(array_filter(array_slice($g['FOOT'], 1), function ($v) { return $v !== ''; })); }
function show($v) { return '[' . implode(' | ', $v) . ']'; }

echo "R/Z. '%' formulas and zeros with rows, no column field\n";
foreach (grids(settings(array())) as $b => $g) {
    $pat = vals($g, 'Pat');
    ok(array_slice($pat, 3, 2) === array('0.0%', '0.0%'), "R $b: Pat's 0 of 2 prints 0.0% in both % formulas", show($pat));
    ok(array_slice(vals($g, 'Lee'), 3, 2) === array('66.7%', '66.7%'), "R $b: Lee 2 of 3 = 66.7%", show(vals($g, 'Lee')));
    ok(array_slice(vals($g, 'Kim'), 3, 2) === array('100.0%', '100.0%'), "R $b: Kim 1 of 1 = 100.0%", show(vals($g, 'Kim')));
    $f = footvals($g);
    ok(array_slice($f, -2) === array('55.6%', '62.5%'), "R $b: Grand Total row 5/9 = 55.6%, 5/8 = 62.5%", show($f));
    ok(array_slice($pat, 0, 3) === array('2', '0', '1'), "Z $b: Pat's Awarded 0 (cell has rows) prints 0", show($pat));
    ok(vals($g, 'Lee')[2] === '0', "Z $b: Lee's Still Pending 0 prints 0", show(vals($g, 'Lee')));
}

echo "Z. an EMPTY cell (no rows) stays blank in the email body\n";
$h = cells_html(generate_pivot_html(fx(), settings(array('FY')), 'theme-default', true));
// Ray: label cells, then FY 2025 [5 values], FY 2026 [5 values]
$ray = isset($h['Ray']) ? array_slice($h['Ray'], 3) : array('NOROW');
ok(array_slice($ray, 0, 3) === array('2', '1', '0'), "Z HTML: Ray FY 2025 (rows) prints its 0 pending", show($ray));
ok(array_slice($ray, 5, 3) === array('', '', ''), "Z HTML: Ray FY 2026 (no rows) is blank", show($ray));
// A sum reaches the body as a FLOAT 0.0, which the strict `=== 0` never blanked;
// an INTEGER 0 - a filtered count with no matches - was blanked. That is the
// case the has-rows rule changes.
$sf = settings(array());
$sf['agg'] = array('count', 'count', 'sum', 'formula', 'formula');
$sf['aggFilters'] = array(null, 'AWARDED = 1', null, null, null);
$hf = cells_html(generate_pivot_html(fx(), $sf, 'theme-default', true));
$patf = isset($hf['Pat']) ? array_slice($hf['Pat'], 3) : array('NOROW');
ok(isset($patf[1]) && $patf[1] === '0', "Z HTML: a filtered count with no matches (int 0) in a cell with rows prints 0", show($patf));
ok(isset($hf['Lee']) && array_slice($hf['Lee'], 3, 2) === array('3', '2'), "Z HTML: control - the filtered count counts Lee's 2 awarded", isset($hf['Lee']) ? show($hf['Lee']) : 'NOROW');

echo "R. plain formulas keep their old format\n";
foreach (grids(settings(array(), '{Awarded} * 10', '{Proposals} - {Proposals}')) as $b => $g) {
    ok(array_slice(vals($g, 'Lee'), 3, 2) === array('20', '0'), "R $b: no '%' sign; a 0 result with rows prints 0", show(vals($g, 'Lee')));
}

echo "S. a '%' summary formula (flat-table footer / status bar)\n";
$s = penumbra_compute_summary(array('1', '0', '1', '1'), 'formula', false, '{sum} / {count} %');
ok(is_array($s) && abs($s['value'] - 75) < 1e-9 && !empty($s['isPercent']) && $s['decimals'] === 1, "S1 3 of 4 = 75, isPercent, 1 decimal", json_encode($s));
$s2 = penumbra_compute_summary(array('1', '0', '1', '1'), 'formula', false, '{sum} / {count}');
ok(is_array($s2) && abs($s2['value'] - 0.75) < 1e-9 && empty($s2['isPercent']), "S2 control: no '%' = 0.75, not a percentage", json_encode($s2));

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL ? 1 : 0);
