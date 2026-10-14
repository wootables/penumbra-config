<?php
/**
 * Which pivot value cells a format(cell, TARGET, ...) rule selects in the
 * scheduled email body (generate_pivot_html), 2026-09-26 - twin of the browser's
 * _cellRuleHits (fyreports harness K).
 *
 * A target that is an aggregation's display LABEL selects only those columns.
 * The Values field (e.g. AMOUNT) selects every value cell only when no
 * aggregation carries that name: ?id=fycompawd labels Sum(AMOUNT) "Amount", so
 * format(cell, Amount, 1=1, 'border-left: ...') styled every column instead of
 * the Amount columns. Only data cells take cell rules in the email body.
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_fmttarget.php                        live runner
 *   php -n test_fmttarget.php --runner=<path>        a staged copy
 *   php -n test_fmttarget.php --mutant=celltarget    the label check undone
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_fmttarget.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }
$src = file_get_contents($runner);
$MUTANTS = array(
    'celltarget' => array("!isset(\$_cellRuleLabelSet[\$valFieldUpper]) && ", "", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_fmttarget.php';
file_put_contents($tmp, $src);
exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmp) . ' ' . escapeshellarg($mirror), $exOut, $exCode);
@unlink($tmp);
if ($exCode !== 0 || !file_exists($mirror)) { fwrite(STDERR, "extract_mirror failed: " . implode("\n", $exOut) . "\n"); exit(2); }
require_once $mirror;
$themesCfg = dirname($runner) . '/themes_config.php';
if (!file_exists($themesCfg)) $themesCfg = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
require_once $themesCfg;
$GLOBALS['theme_styles'] = penumbra_build_theme_styles();

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  PASS  $label\n"; return; }
    $FAIL++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n";
}

// The FY comparison fixture (test_gtvalues.php's): AMOUNT is money, AWARDS a count.
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100',1), array('FY 2025','02 Aug','$200',2), array('FY 2025','03 Sep','$300',3),
                   array('FY 2026','01 Jul','$110',1), array('FY 2026','03 Sep','$330',3),
                   array('FY 2027','01 Jul','$120',1)) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2], 'AWARDS' => (string)$x[3]);
    }
    return $r;
}
function settings($aggs, $labels, $overrides) {
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => 'AMOUNT', 'agg' => $aggs,
        'aggLabels' => $labels, 'aggColOverrides' => $overrides,
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalRowAggs' => null, 'totalColAggs' => null);
}
function rule($target) {
    return array(array('type' => 'cell', 'targetColumn' => strtoupper($target), 'condition' => null, 'style' => 'border-left: 5px solid #ff0000'));
}
// For the row labelled $label: one boolean per cell - does it carry the 5px border?
function styled_row($html, $label) {
    if (!preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs)) return null;
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b([^>]*)>(.*?)<\/t[dh]>/is', $tr, $cs, PREG_SET_ORDER)) continue;
        if (trim(html_entity_decode(strip_tags($cs[0][2]), ENT_QUOTES, 'UTF-8')) !== $label) continue;
        $out = array();
        foreach ($cs as $c) { $out[] = (bool)preg_match('/border-left:\s*5px/i', $c[1]); }
        return $out;
    }
    return null;
}
function show($v) { return $v === null ? 'NULL' : '[' . implode(' ', array_map(function ($b) { return $b ? '1' : '0'; }, $v)) . ']'; }
function html_for($aggs, $labels, $overrides, $target) {
    return generate_pivot_html(fx(), settings($aggs, $labels, $overrides), 'theme-default', true, rule($target));
}

echo "A. a target that is an aggregation LABEL selects only that aggregation\n";
// Row cells: label, per FY [a0, a1, a2], then the Grand Total three (no cell rules there in email).
$r = styled_row(html_for(array('sum', 'pct_change', 'sum'), array('Amount', '%Δ', 'Awards'), array('AMOUNT', null, 'AWARDS'), 'Amount'), '01 Jul');
$want = array(false, true, false, false, true, false, false, true, false, false, false, false, false);
ok($r === $want, 'A1 "Amount" (also the Values field) styles only the Amount columns', show($r) . ' want ' . show($want));

echo "B. guard: a Values-field target no aggregation is named after styles every value cell\n";
$r = styled_row(html_for(array('sum', 'pct_change', 'sum'), array('Amt', '%Δ', 'Awards'), array('AMOUNT', null, 'AWARDS'), 'AMOUNT'), '01 Jul');
$want = array(false, true, true, true, true, true, true, true, true, true, false, false, false);
ok($r === $want, 'B1 AMOUNT styles all nine value cells', show($r) . ' want ' . show($want));

echo "C. two columns sharing a label are both styled\n";
// Row cells: label, per FY [Amount, %Δ, Count, %Δ], then the Grand Total four.
$r = styled_row(html_for(array('sum', 'pct_change', 'sum', 'pct_change'), array('Amount', '%Δ', 'Count', '%Δ'), array('AMOUNT', null, 'AWARDS', null), '%Δ'), '01 Jul');
ok(is_array($r) && $r[2] && $r[4] && $r[6] && $r[8] && $r[10] && $r[12] && !$r[1] && !$r[3], 'C1 both %Δ columns in every FY', show($r));

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
