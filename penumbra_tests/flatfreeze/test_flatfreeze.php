<?php
/**
 * FLAT-TABLE FROZEN COLUMNS - the runner half (2026-09-18).
 *
 * A report can freeze the first N visible columns of its FLAT table
 * (STATE_DATA.frozenCols, set from the Settings panel's Freeze control). On
 * screen that is generated position:sticky CSS (js/main.js, "FROZEN COLUMNS -
 * FLAT TABLE"); in a scheduled XLSX it is the sheet's pane xSplit, written by
 * generate_xlsx_string() in schedule_runner.php from
 * penumbra_flat_frozen_cols() - the PHP twin of main.js's
 * penumbraClampFrozenCols() + the '#' rule.
 *
 * THE '#' RULE: the count is "the first N VISIBLE columns", and in the browser
 * a visible '#' row-number column is one of them. The runner never emits a '#'
 * column, so a saved layout that shows '#' costs the sheet one: the SAME data
 * columns end up frozen as on the author's screen. run.ps1's browser half
 * asserts the identical case table against the real main.js, so the two
 * engines are held to one set of numbers.
 *
 * WHAT RUNS: schedule_runner.php is a CLI entry point that opens Oracle and
 * SENDS EMAIL, so it is never require()d. pivotparity\extract_mirror.php lifts
 * its top-level functions with PHP's tokenizer into a side-effect-free file;
 * this test requires THAT and calls the real generate_xlsx_string(), then
 * unzips the workbook and reads the pane out of xl/worksheets/sheetN.xml.
 *
 *   Part A  penumbra_flat_frozen_cols(): the shared case table
 *   Part B  the pane XML of real workbooks (flat, grouped, no count)
 *   Part M  targeted mutants - each one rewrites ONE line of the runner and
 *           must turn specific asserts red (always run, unless --control)
 *
 *   php test_flatfreeze.php --app=<app dir> [--runner=<file>] [--control]
 *     --runner   a staged schedule_runner.php (default: <app>/schedule_runner.php)
 *     --control  test the runner WITHOUT the feature (the deploy's .bak, or
 *                --runner=<pre-feature file>): must report failures, which is
 *                what proves this harness can fail at all
 *
 * EXPECTED TAIL on the feature build:  PASS 38   FAIL 0   (32 asserts + 6 mutants)
 * EXPECTED TAIL with --control:        PASS 6    FAIL 26  - the six are the
 *   "nothing changed for a report with no count" guards (B01 B05 B07-B10).
 *   Measured 2026-09-18 against the staged build and the pre-feature runner.
 */

$opt = array('app' => '', 'runner' => '', 'control' => false, 'child' => false, 'mirror' => '');
foreach (array_slice($argv, 1) as $a) {
    if (preg_match('/^--(app|runner|mirror)=(.*)$/', $a, $m)) $opt[$m[1]] = $m[2];
    elseif ($a === '--control') $opt['control'] = true;
    elseif ($a === '--child') $opt['child'] = true;
}
if ($opt['app'] === '') { fwrite(STDERR, "usage: test_flatfreeze.php --app=<dir> [--runner=<file>] [--control]\n"); exit(2); }
$APP = rtrim(str_replace('\\', '/', $opt['app']), '/');
$HERE = str_replace('\\', '/', dirname(__FILE__));
// The tokenizer-based extractor lives with the pivot parity suite; fall back to
// its absolute home so a copy of this test run from anywhere else still finds it.
$EXTRACTOR = dirname($HERE) . '/pivotparity/extract_mirror.php';
if (!is_file($EXTRACTOR)) $EXTRACTOR = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/penumbra_tests/pivotparity/extract_mirror.php';

// ---------------------------------------------------------------------------
// The shared case table. [frozenCols, visibleColumns (null = key absent),
// data columns in the sheet, expected xSplit]. The browser half carries the
// SAME rows (driver.js, phase K) - change one, change both.
// ---------------------------------------------------------------------------
function ff_cases() {
    $H = array('#', 0, 1, 2, 3, 4);      // '#' shown + five data columns
    $N = array(0, 1, 2, 3, 4);           // '#' hidden
    return array(
        array('K01 nothing saved',                        null,  $H, 5, 0),
        array('K02 count 0',                              0,     $H, 5, 0),
        array('K03 count 1 with # shown: # WAS the one',  1,     $H, 5, 0),
        array('K04 count 2 with # shown',                 2,     $H, 5, 1),
        array('K05 count 5 with # shown',                 5,     $H, 5, 4),
        array('K06 count 9 is capped at 5',               9,     $H, 5, 4),
        array('K07 count 1 with # hidden',                1,     $N, 5, 1),
        array('K08 count 5 with # hidden: never ALL',     5,     $N, 5, 4),
        array('K09 count 5, # shown, two data columns',   5,     array('#', 0, 1), 2, 1),
        array('K10 count 3, # hidden, ONE data column',   3,     array(0), 1, 0),
        array('K11 count 2, # shown, ONE data column',    2,     array('#', 0), 1, 0),
        array('K12 junk count',                           'abc', $H, 5, 0),
        array('K13 negative count',                       -3,    $H, 5, 0),
        array('K14 numeric string',                       '3',   $H, 5, 2),
        array('K15 float truncates like parseInt',        2.7,   $H, 5, 1),
        array('K16 no visibleColumns key = default layout, # shown', 2, null, 5, 1),
        array('K17 EMPTY visibleColumns = default layout too',       2, array(), 5, 1),
        array('K18 column count unknown (0): cap only',   4,     $N, 0, 4),
        // Twelve columns, so the never-all clamp is out of the picture and the
        // cap (K19) and the # rule (K20) each decide the answer ALONE. On five
        // columns the clamp lands on 4 whatever those two do, which is how the
        // first draft's mutants for both stayed green.
        array('K19 count 9 over twelve columns: the cap by itself',      9, array(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11), 12, 5),
        array('K20 count 5 over twelve columns, # shown: the # rule by itself', 5, array('#', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11), 12, 4),
    );
}

// ---------------------------------------------------------------------------
// CHILD: one runner build, one JSON line of results on stdout.
// ---------------------------------------------------------------------------
if ($opt['child']) {
    $R = array();
    $rec = function ($id, $pass, $detail = '') use (&$R) { $R[] = array('id' => $id, 'pass' => (bool)$pass, 'detail' => (string)$detail); };
    set_error_handler(function ($no, $str, $file, $line) { throw new ErrorException($str, 0, $no, $file, $line); });
    try {
        ob_start();
        require $APP . '/themes_config.php';
        require $opt['mirror'];
        ob_end_clean();
    } catch (Throwable $e) {
        @ob_end_clean();
        echo json_encode(array('fatal' => 'load: ' . $e->getMessage(), 'results' => array())); exit(0);
    }
    $GLOBALS['theme_styles'] = penumbra_build_theme_styles();
    $GLOBALS['total_exemptions'] = array('AMOUNT');

    // ---- Part A ----------------------------------------------------------
    $have = function_exists('penumbra_flat_frozen_cols');
    $rec('A00 penumbra_flat_frozen_cols() exists in the runner', $have);
    foreach (ff_cases() as $c) {
        list($name, $count, $vis, $cols, $want) = $c;
        $state = array();
        if ($count !== null) $state['frozenCols'] = $count;
        if ($vis !== null) $state['visibleColumns'] = $vis;
        if (!$have) { $rec($name, false, 'function missing'); continue; }
        try { $got = penumbra_flat_frozen_cols($state, $cols); $rec($name, $got === $want, 'got ' . var_export($got, true) . ' want ' . $want); }
        catch (Throwable $e) { $rec($name, false, 'threw: ' . $e->getMessage()); }
    }
    if ($have) {
        try { $rec('A19 a non-array state is 0, not a warning', penumbra_flat_frozen_cols(null, 5) === 0); }
        catch (Throwable $e) { $rec('A19 a non-array state is 0, not a warning', false, 'threw: ' . $e->getMessage()); }
    } else { $rec('A19 a non-array state is 0, not a warning', false, 'function missing'); }

    // ---- Part B ----------------------------------------------------------
    $rows = array();
    for ($i = 1; $i <= 6; $i++) $rows[] = array('COLLEGE' => 'College ' . $i, 'DEPT' => 'Dept ' . $i, 'PI' => 'Person ' . $i, 'AMOUNT' => (string)($i * 1000));
    $sheets = function ($api) {
        $bin = generate_xlsx_string($api, 'theme-default');
        if (!is_string($bin) || $bin === '') return array('err' => 'empty workbook');
        $tmp = tempnam(sys_get_temp_dir(), 'ffx');
        file_put_contents($tmp, $bin);
        $zip = new ZipArchive();
        if ($zip->open($tmp) !== true) { @unlink($tmp); return array('err' => 'not a zip'); }
        $out = array();
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $n = $zip->getNameIndex($i);
            if (preg_match('#^xl/worksheets/sheet\d+\.xml$#', $n)) $out[$n] = $zip->getFromIndex($i);
        }
        $zip->close(); @unlink($tmp);
        ksort($out);
        return $out;
    };
    $pane = function ($xml) { return preg_match('/<pane\b[^>]*>/', $xml, $m) ? $m[0] : '(no pane)'; };
    $flat = function ($extra) use ($rows) { return array_merge(array('data' => $rows, 'viewMode' => 'standard'), $extra); };
    $try = function ($id, $api, $check) use ($rec, $sheets, $pane) {
        try {
            $s = $sheets($api);
            if (isset($s['err'])) { $rec($id, false, $s['err']); return; }
            $res = $check($s);
            $rec($id, $res[0], $res[1]);
        } catch (Throwable $e) { $rec($id, false, 'threw: ' . $e->getMessage() . ' @' . basename($e->getFile()) . ':' . $e->getLine()); }
    };
    $H = array('#', 0, 1, 2, 3);
    $N = array(0, 1, 2, 3);

    $try('B01 control: no count = header row only, the pane it has always written', $flat(array('visibleColumns' => $H)), function ($s) use ($pane) {
        $p = $pane(reset($s));
        return array($p === '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>', $p);
    });
    $try('B02 count 2 with # shown: ONE data column, split lands at B2', $flat(array('frozenCols' => 2, 'visibleColumns' => $H)), function ($s) use ($pane) {
        $p = $pane(reset($s));
        return array($p === '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>', $p);
    });
    $try('B03 the selection follows the split into the bottom-right pane', $flat(array('frozenCols' => 2, 'visibleColumns' => $H)), function ($s) {
        $x = reset($s);
        $ok = strpos($x, '<selection pane="bottomRight" activeCell="B2" sqref="B2"/>') !== false;
        return array($ok, $ok ? 'ok' : 'selection: ' . (preg_match('/<selection\b[^>]*>/', $x, $m) ? $m[0] : '(none)'));
    });
    $try('B04 count 3 with # hidden: three columns, split at D2', $flat(array('frozenCols' => 3, 'visibleColumns' => $N)), function ($s) use ($pane) {
        $p = $pane(reset($s));
        return array($p === '<pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/>', $p);
    });
    $try('B05 count 1 with # shown freezes no sheet column', $flat(array('frozenCols' => 1, 'visibleColumns' => $H)), function ($s) use ($pane) {
        $p = $pane(reset($s));
        return array(strpos($p, 'xSplit') === false && strpos($p, 'ySplit="1"') !== false, $p);
    });
    $try('B06 count 5 over four sheet columns leaves one to scroll', $flat(array('frozenCols' => 5, 'visibleColumns' => $N)), function ($s) use ($pane) {
        $p = $pane(reset($s));
        return array(strpos($p, 'xSplit="3"') !== false && strpos($p, 'topLeftCell="D2"') !== false, $p);
    });
    $try('B07 the sheet is well-formed and sheetViews still precedes cols and sheetData', $flat(array('frozenCols' => 2, 'visibleColumns' => $H)), function ($s) {
        $x = reset($s);
        $dom = new DOMDocument();
        $ok = @$dom->loadXML($x);
        $a = strpos($x, '<sheetViews>'); $b = strpos($x, '<cols>'); $c = strpos($x, '<sheetData>');
        return array($ok && $a !== false && $b !== false && $c !== false && $a < $b && $b < $c, 'wellformed=' . var_export($ok, true) . " views=$a cols=$b data=$c");
    });
    $try('B08 exactly one pane per sheet', $flat(array('frozenCols' => 2, 'visibleColumns' => $H)), function ($s) {
        $n = preg_match_all('/<pane\b/', reset($s));
        return array($n === 1, 'panes=' . $n);
    });
    // Grouped output: per-group sheets, and the nested outline sheet. Neither
    // freezes columns - the grouped view has none on screen either.
    $grouped = array('data' => array('Engineering' => array_slice($rows, 0, 3), 'Science' => array_slice($rows, 3, 3)),
                     'viewMode' => 'grouped', 'frozenCols' => 3, 'visibleColumns' => $N);
    $try('B09 grouped (one sheet per group): every sheet stays at the header row only', $grouped, function ($s) use ($pane) {
        $bad = array();
        foreach ($s as $n => $x) { if (strpos($pane($x), 'xSplit') !== false) $bad[] = basename($n); }
        return array(count($s) === 2 && !$bad, 'sheets=' . count($s) . ' withXSplit=' . implode(',', $bad));
    });
    if (defined('PENUMBRA_GROUP_PATH_SEP')) {
        $sep = PENUMBRA_GROUP_PATH_SEP;
        $nested = array('data' => array('Engineering' . $sep . 'Civil' => array_slice($rows, 0, 3), 'Engineering' . $sep . 'Mech' => array_slice($rows, 3, 3)),
                        'viewMode' => 'grouped', 'frozenCols' => 3, 'visibleColumns' => $N);
        $try('B10 nested grouping (outline sheet): no column split through the merged bands', $nested, function ($s) use ($pane) {
            $p = $pane(reset($s));
            return array(count($s) === 1 && strpos($p, 'xSplit') === false, 'sheets=' . count($s) . ' ' . $p);
        });
    } else { $rec('B10 nested grouping (outline sheet): no column split through the merged bands', false, 'PENUMBRA_GROUP_PATH_SEP not lifted'); }

    echo json_encode(array('results' => $R));
    exit(0);
}

// ---------------------------------------------------------------------------
// PARENT: build the mirrors, run the children, judge.
// ---------------------------------------------------------------------------
$runner = $opt['runner'] !== '' ? str_replace('\\', '/', $opt['runner']) : $APP . '/schedule_runner.php';
if ($opt['control'] && $opt['runner'] === '') {
    require_once '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\_oldver\\oldver.php';   // .bak copies come from git since 2026-10-14
    $baks = oldver_glob($APP . '/schedule_runner.php.bak-*-flatfreeze');
    if (!$baks) { fwrite(STDERR, "--control needs schedule_runner.php.bak-*-flatfreeze (made by the deploy) or --runner=<pre-feature file>\n"); exit(2); }
    sort($baks); $runner = end($baks);
}
if (!is_file($runner)) { fwrite(STDERR, "runner not found: $runner\n"); exit(2); }
if (!is_file($EXTRACTOR)) { fwrite(STDERR, "extractor not found: $EXTRACTOR\n"); exit(2); }
echo "runner under test: $runner" . ($opt['control'] ? '   (CONTROL)' : '') . "\n";

// The children are started through cmd.exe, which refuses a UNC current
// directory and says so on every exec. Nothing here is cwd-relative.
@chdir(sys_get_temp_dir());
$work = sys_get_temp_dir() . '/pnb_flatfreeze_' . substr(md5(uniqid('', true)), 0, 8);
mkdir($work);
$phpFlags = '-n -d memory_limit=1024M -d date.timezone=America/New_York -d extension_dir=' . escapeshellarg(str_replace('\\', '/', dirname(PHP_BINARY)) . '/ext') . ' -d extension=zip -d extension=mbstring';
$src = file_get_contents($runner);

function ff_run($label, $source, $work, $phpFlags, $APP, $EXTRACTOR) {
    $in = "$work/runner_$label.php"; $mirror = "$work/mirror_$label.php";
    file_put_contents($in, $source);
    exec('"' . PHP_BINARY . '" -n -d memory_limit=1024M ' . escapeshellarg($EXTRACTOR) . ' ' . escapeshellarg($in) . ' ' . escapeshellarg($mirror) . ' 2>&1', $o, $rc);
    if ($rc !== 0 || !is_file($mirror)) return array('fatal' => 'extract failed: ' . implode(' ', $o), 'results' => array());
    $o = array();
    exec('"' . PHP_BINARY . '" ' . $phpFlags . ' ' . escapeshellarg(__FILE__) . ' --child --app=' . escapeshellarg($APP) . ' --mirror=' . escapeshellarg($mirror) . ' 2>&1', $o, $rc);
    $line = trim(implode("\n", $o));
    $j = json_decode($line, true);
    if (!is_array($j)) return array('fatal' => 'child said: ' . substr($line, 0, 600), 'results' => array());
    return $j;
}

$pass = 0; $fail = 0;
$main = ff_run('main', $src, $work, $phpFlags, $APP, $EXTRACTOR);
if (isset($main['fatal'])) { echo "  FAIL  child did not finish: {$main['fatal']}\n"; $fail++; }
foreach ($main['results'] as $r) {
    if ($r['pass']) { $pass++; echo "  PASS  {$r['id']}  [{$r['detail']}]\n"; }
    else { $fail++; echo "  FAIL  {$r['id']}  [{$r['detail']}]\n"; }
}

// ---- Part M: targeted mutants ----------------------------------------------
// Each rewrites ONE line of the runner under test and names the asserts that
// must go red. A mutant that stays green means those asserts do not bite.
if (!$opt['control']) {
    $mutants = array(
        'M1 drop the # rule' => array(
            "    if (\$numShown) \$n--;", "    ",
            array('K03', 'K04', 'K14', 'K20', 'B02', 'B05')),
        'M2 drop the never-all clamp' => array(
            "    if (\$colCount > 0 && \$n >= \$colCount) \$n = \$colCount - 1;", "    ",
            array('K08', 'K09', 'K10', 'K11', 'B06')),
        'M3 drop the cap' => array(
            "    if (\$n > 5) \$n = 5;", "    ",
            array('K19')),
        'M4 default layout hides #' => array(
            "    \$numShown = true;", "    \$numShown = false;",
            array('K16', 'K17')),
        'M5 freeze grouped sheets too' => array(
            "(\$viewMode === 'standard') ? penumbra_flat_frozen_cols(\$apiResult, \$colCount) : 0;", "penumbra_flat_frozen_cols(\$apiResult, \$colCount);",
            array('B09', 'B10')),
        'M6 split one column early' => array(
            "_xlsx_col_letter(\$_frzCols) . '2'; // first unfrozen cell", "_xlsx_col_letter(\$_frzCols - 1) . '2';",
            array('B02', 'B03', 'B04', 'B06')),
    );
    $k = 0;
    foreach ($mutants as $label => $m) {
        $k++;
        $n = substr_count($src, $m[0]);
        if ($n !== 1) { $fail++; echo "  FAIL  $label: anchor found $n times, expected 1\n"; continue; }
        $res = ff_run('m' . $k, str_replace($m[0], $m[1], $src), $work, $phpFlags, $APP, $EXTRACTOR);
        if (isset($res['fatal'])) { $fail++; echo "  FAIL  $label: {$res['fatal']}\n"; continue; }
        $red = array();
        foreach ($res['results'] as $r) { if (!$r['pass']) $red[] = substr($r['id'], 0, 3); }
        $missing = array_values(array_diff($m[2], $red));
        $ok = count($missing) === 0;
        if ($ok) { $pass++; echo "  PASS  $label turns " . implode(' ', $m[2]) . " red  [red: " . implode(' ', $red) . "]\n"; }
        else { $fail++; echo "  FAIL  $label: stayed green on " . implode(' ', $missing) . "  [red: " . implode(' ', $red) . "]\n"; }
    }
}

// best-effort cleanup
foreach (glob("$work/*") as $f) @unlink($f);
@rmdir($work);
echo sprintf("PASS %d   FAIL %d\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);
