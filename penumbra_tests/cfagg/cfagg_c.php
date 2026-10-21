<?php
/**
 * Engine C side of the format() aggregate-condition parity check.
 *   php -n cfagg_c.php <appDir> <extracted engineC_functions.php> <corpus.json> <out.json>
 * Runs every corpus condition through evaluate_aggregate_condition_php() and, as a
 * cross-check of the real consumer, through parse_format_rules() + prepare_format_rules()
 * as a format(header, NAME, <cond>, 'color:red') rule (kept = 1 when the condition held).
 * The extract is patched IN A COPY to record the text the final numeric gate reads.
 */
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');
date_default_timezone_set('America/New_York');

if ($argc < 5) { fwrite(STDERR, "usage: php cfagg_c.php <appDir> <extract.php> <corpus.json> <out.json>\n"); exit(1); }
$appDir = rtrim($argv[1], '/\\');
$extractFile = $argv[2];
$corpusFile = $argv[3];
$outFile = $argv[4];

// _cf_test_condition() calls _sr_resolve_keyword_date() for text-valued conditions
// (see run_engine_c.php): load penumbra_search.php from the same app tree.
$searchFile = $appDir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
if (is_file($searchFile)) require $searchFile;
if (!function_exists('_sr_resolve_keyword_date')) { echo "FATAL: penumbra_search.php not loaded ($searchFile)\n"; exit(1); }

$src = file_get_contents($extractFile);
if ($src === false) { echo "FATAL: cannot read $extractFile\n"; exit(1); }
$anchor = <<<'EOT'
if (!preg_match('/^\s*(-?\d*\.?\d+)\s*([<>=!]+)\s*(-?\d*\.?\d+)\s*$/', $cond, $cm)) {
EOT;
$hits = substr_count($src, $anchor);
if ($hits !== 1) { echo "FATAL: the final-gate anchor hit $hits times in the extract (want 1) - update cfagg_c.php\n"; exit(1); }
$src = str_replace($anchor, '$GLOBALS[\'__EAC_FINAL\'] = $cond; ' . $anchor, $src);
$inst = dirname($outFile) . DIRECTORY_SEPARATOR . 'engineC_cfagg_instrumented.php';
file_put_contents($inst, $src);
unset($src);
require_once $inst;

foreach (array('evaluate_aggregate_condition_php', 'parse_format_rules', 'prepare_format_rules') as $fn) {
    if (!function_exists($fn)) { echo "FATAL: $fn missing from the extract\n"; exit(1); }
}
$GLOBALS['total_exemptions'] = array('TOTAL','AMOUNT','COUNT','AMT','CNT','COST');
$GLOBALS['config'] = array();
$GLOBALS['strip_links'] = false;

$corpus = json_decode(file_get_contents($corpusFile), true);
if (!is_array($corpus)) { echo "FATAL: corpus did not parse\n"; exit(1); }
$columns = $corpus['columns'];
$rows = $corpus['rows'];   // null stays PHP null, as OCI_RETURN_NULLS delivers it

$out = array();
foreach ($corpus['cases'] as $c) {
    $res = array('id' => $c['id']);
    $GLOBALS['__EAC_FINAL'] = null;
    try {
        $res['result'] = (bool)evaluate_aggregate_condition_php($c['cond'], $rows);
        $res['final'] = $GLOBALS['__EAC_FINAL'];
        $rules = parse_format_rules("format(header, NAME, " . $c['cond'] . ", 'color:red')");
        $prep = prepare_format_rules($rules, $columns, $rows);
        $res['kept'] = count($prep['header']);
        $res['parsed'] = count($rules);
    } catch (Throwable $e) {
        $res['error'] = get_class($e) . ': ' . $e->getMessage();
    }
    $out[] = $res;
}
file_put_contents($outFile, json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
echo "engine C: " . count($out) . " conditions\n";
