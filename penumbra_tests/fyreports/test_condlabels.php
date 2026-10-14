<?php
/**
 * format(cell) CONDITIONS on a label two value columns share, in the scheduled
 * email body (generate_pivot_html), 2026-09-26 - twin of the browser's
 * _condLabelSrc (fyreports harness V).
 *
 * ?id=fycompawd labels Amount's and Count's % Change both "%Δ". The email
 * builds ONE pseudo-row per column group, where "%Δ" could hold only the LAST
 * column's value, so format(cell, %Δ, %Δ > 0, 'color: green') coloured Amount's
 * %Δ by Count's sign (the browser swapped the two). Now a cell reads its OWN
 * value under its own label, and a shared label named from another column reads
 * the one on that column's base (Count -> Count's %Δ), else the first.
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_condlabels.php                        live runner
 *   php -n test_condlabels.php --runner=<path>        a staged copy
 *   php -n test_condlabels.php --mutant=condlabel     one pseudo-row per group again
 *   php -n test_condlabels.php --mutant=condgroup     a shared label = its first column
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_condlabels.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }
$src = file_get_contents($runner);
$MUTANTS = array(
    'condlabel' => array('if (max($_condLblCount) > 1) {', 'if (false) {', 1),
    'condgroup' => array('if ($group($k) === $group($c)) { $pick = $k; break; }', 'if (false) { $pick = $k; break; }', 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_condlabels.php';
file_put_contents($tmp, $src);
exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmp) . ' ' . escapeshellarg($mirror), $exOut, $exCode);
@unlink($tmp);
if ($exCode !== 0 || !file_exists($mirror)) { fwrite(STDERR, "extract_mirror failed: " . implode("\n", $exOut) . "\n"); exit(2); }
require_once $mirror;
$themesCfg = dirname($runner) . '/themes_config.php';
if (!file_exists($themesCfg)) $themesCfg = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
require_once $themesCfg;
$GLOBALS['theme_styles'] = penumbra_build_theme_styles();
// Conditions run on the format-condition engine, which calls a penumbra_search.php
// function the mirror cannot carry (see ..\hideempty\test_hideempty.php).
$searchPhp = dirname($runner) . '/penumbra_search.php';
if (!file_exists($searchPhp)) $searchPhp = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_search.php';
if (!function_exists('_sr_resolve_keyword_date')) { require_once $searchPhp; }

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  PASS  $label\n"; return; }
    $FAIL++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n";
}

// Amount and Count move in OPPOSITE directions, so the two %Δ columns disagree:
// Jul Amount +50% / Count -50%, Aug Amount -50% / Count +400%.
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100',4), array('FY 2025','02 Aug','$200',1),
                   array('FY 2026','01 Jul','$150',2), array('FY 2026','02 Aug','$100',5)) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2], 'AWARDS' => (string)$x[3]);
    }
    return $r;
}
function settings($aggs, $labels, $overrides) {
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => 'AMOUNT', 'agg' => $aggs,
        'aggLabels' => $labels, 'aggColOverrides' => $overrides,
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalRowAggs' => array(), 'totalColAggs' => null);
}
// For the row labelled $label: one tag per cell - g(reen) / r(ed) / - for the text
// colour a rule set, plus B for bold and U for underline.
function tags_row($html, $label) {
    if (!preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs)) return null;
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b([^>]*)>(.*?)<\/t[dh]>/is', $tr, $cs, PREG_SET_ORDER)) continue;
        if (trim(html_entity_decode(strip_tags($cs[0][2]), ENT_QUOTES, 'UTF-8')) !== $label) continue;
        $out = array();
        foreach (array_slice($cs, 1) as $c) {
            $st = preg_match('/style=([\'"])(.*?)\1/is', $c[1], $sm) ? $sm[2] : '';
            $col = '-';
            if (preg_match_all('/(?<![-\w])color:\s*([^;]+)/i', $st, $cm)) {
                $last = strtolower(trim(end($cm[1])));
                if ($last === 'green') $col = 'g'; elseif ($last === 'red') $col = 'r';
            }
            $out[] = $col . (preg_match('/font-weight:\s*bold/i', $st) ? 'B' : '') . (preg_match('/text-decoration:\s*underline/i', $st) ? 'U' : '');
        }
        return $out;
    }
    return null;
}
function show($v) { return $v === null ? 'NULL' : '[' . implode(' ', $v) . ']'; }

$SNIP = "format(cell, %Δ, %Δ > 0, 'color: green')\n"
      . "format(cell, %Δ, %Δ < 0, 'color: red')\n"
      . "format(cell, Amount, %Δ < 0, 'font-weight: bold')\n"
      . "format(cell, Count, %Δ < 0, 'text-decoration: underline')";
$rules = parse_format_rules($SNIP);
ok(count($rules) === 4, 'setup: the four format() rules parse', 'got ' . count($rules));
$html = generate_pivot_html(fx(), settings(array('sum', 'pct_change', 'sum', 'pct_change'), array('Amount', '%Δ', 'Count', '%Δ'),
    array('AMOUNT', null, 'AWARDS', null)), 'theme-default', true, $rules);
// Cells after the label: FY 2025 [Amount %Δ Count %Δ], FY 2026 [Amount %Δ Count %Δ] (no Grand Total column).
$jul = tags_row($html, '01 Jul');
$aug = tags_row($html, '02 Aug');

echo "A. a %Δ cell is tested against its OWN value\n";
ok(is_array($jul) && $jul[5] === 'g' && $jul[7] === 'r', 'A1 Jul FY 2026: Amount %Δ +50% green, Count %Δ -50% red', show($jul));
ok(is_array($aug) && $aug[5] === 'r' && $aug[7] === 'g', 'A2 Aug FY 2026: Amount %Δ -50% red, Count %Δ +400% green', show($aug));
ok(is_array($jul) && $jul[1] === '-' && $jul[3] === '-', 'A3 guard: FY 2025 has no prior year - neither colour', show($jul));

echo "B. a shared label named from ANOTHER column reads the one on that column's base\n";
ok(is_array($jul) && $jul[4] === '-' && $aug[4] === '-B', 'B1 Amount is bold only where Amount\'s %Δ < 0 (Aug)', show($jul) . ' / ' . show($aug));
ok(is_array($jul) && $jul[6] === '-U' && $aug[6] === '-', 'B2 Count is underlined only where Count\'s %Δ < 0 (Jul)', show($jul) . ' / ' . show($aug));

echo "C. guard: unique labels are unchanged\n";
$rulesC = parse_format_rules("format(cell, Chg, Chg > 0, 'color: green')\nformat(cell, Amount, Chg < 0, 'font-weight: bold')");
$htmlC = generate_pivot_html(fx(), settings(array('sum', 'pct_change'), array('Amount', 'Chg'), array('AMOUNT', null)), 'theme-default', true, $rulesC);
$julC = tags_row($htmlC, '01 Jul'); $augC = tags_row($htmlC, '02 Aug');
ok(is_array($julC) && $julC[3] === 'g' && $augC[3] === '-' && $julC[2] === '-' && $augC[2] === '-B', 'C1 one % Change column: green on +50%, Amount bold on -50%', show($julC) . ' / ' . show($augC));

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
