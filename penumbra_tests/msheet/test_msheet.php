<?php
/**
 * penumbra_tests/msheet - multi-worksheet imports, SERVER half (2026-10-02).
 *
 * WHAT CHANGED. A workbook dropped on the page used to import its FIRST sheet
 * only. Now every VISIBLE worksheet with a header row and a data row is read:
 * one such sheet imports exactly as before; two or more are STACKED - a
 * WORKSHEET column holding the tab name first, then the union of the sheets'
 * columns, every row carrying every column. The browser parser (js/main.js
 * parseXLSXToObjects) and the imports/ folder parsers here (shared_logic.php
 * parseImportXlsx / parseImportXmlSpreadsheet) are TWINS. This file tests the
 * server one; run.py drives the browser one and hands its parsed rows here
 * (--browser-json) for the PARITY section.
 *
 * WHAT THE OLD SERVER READER GOT WRONG, found building this suite: it took the
 * first WORKSHEET RELATIONSHIP in xl/_rels/workbook.xml.rels, and Excel writes
 * that file in no particular order (three_tabs.xlsx lists rId3 first). So a
 * multi-tab Excel workbook in imports/ was read from an arbitrary tab - for
 * single.xlsx the empty "Sheet3", i.e. nothing at all. Tab order now comes from
 * xl/workbook.xml, as SheetJS reads it. A one-tab workbook was the only shape
 * the old reader got right; onetab.xlsx / onetab2003.xls prove the new reader
 * returns it BYTE FOR BYTE.
 *
 * Fixtures are authored by REAL Excel through COM (make_fixtures.ps1), so the
 * namespaces, r:ids, shared strings and sheet states are Excel's own.
 *
 *   php -n -d extension_dir=<php>\ext -d extension=zip test_msheet.php [options]
 *     --app DIR            shared_logic.php + js/main.js under test (default: live webroot)
 *     --candidate FILE     the shared_logic.php under test (default: DIR\shared_logic.php)
 *     --baseline FILE      the pre-change shared_logic.php (default: the newest
 *                          shared_logic.php.bak-*-msheet in the app dir)
 *     --browser-json FILE  the browser half's parsed rows per fixture (run.py writes it)
 *     --control            run the BASELINE as the candidate: exactly CONTROL_RED must fail
 *     --mutant NAME        one single-point edit of the candidate: exactly its asserts fail
 *     --mutants            every mutant in turn
 * Prints one PASS/FAIL line per assert and a summary; exit 1 when the run does
 * not match what the mode expects.
 */
error_reporting(E_ALL);
$HERE = __DIR__;
$PHP_ARGS = array_slice($argv, 1);
function opt_val($name, $default = null) {
    global $PHP_ARGS;
    $i = array_search($name, $PHP_ARGS, true);
    if ($i === false) return $default;
    $v = isset($PHP_ARGS[$i + 1]) ? $PHP_ARGS[$i + 1] : null;
    array_splice($PHP_ARGS, $i, 2);
    return $v;
}
function opt_flag($name) {
    global $PHP_ARGS;
    $i = array_search($name, $PHP_ARGS, true);
    if ($i === false) return false;
    array_splice($PHP_ARGS, $i, 1);
    return true;
}
$APP = opt_val('--app', '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra');
$CAND = opt_val('--candidate', $APP . '\\shared_logic.php');
$BASE = opt_val('--baseline', null);
$BJSON = opt_val('--browser-json', null);
$ONE_MUTANT = opt_val('--mutant', null);
$ALL_MUTANTS = opt_flag('--mutants');
$CONTROL = opt_flag('--control');
if (!empty($PHP_ARGS)) { fwrite(STDERR, "unknown arguments: " . implode(' ', $PHP_ARGS) . "\n"); exit(2); }
if (!class_exists('ZipArchive')) { fwrite(STDERR, "FATAL: ZipArchive missing - run with -d extension_dir=<php>\\ext -d extension=zip\n"); exit(2); }
if ($BASE === null) {
    require_once '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\_oldver\\oldver.php';   // .bak copies come from git since 2026-10-14
    $baks = oldver_glob($APP . '\\shared_logic.php.bak-*-msheet');
    if (!$baks) { fwrite(STDERR, "FATAL: no baseline - pass --baseline <shared_logic.php before the change>\n"); exit(2); }
    sort($baks);
    $BASE = end($baks);
}
$FIX = $HERE . DIRECTORY_SEPARATOR . 'fixtures' . DIRECTORY_SEPARATOR;

// ----------------------------------------------------------------------------
// Lifting. shared_logic.php cannot be require'd on its own (it expects the
// app's db layer), so the functions under test are lifted by TOKENIZER - the
// whole top-level declaration, brace-matched. A renamed lift lets the BASELINE's
// parsers live beside the candidate's in one process.
// ----------------------------------------------------------------------------
function lift_functions($src, $names, $rename = array()) {
    $want = array_flip($names);
    $toks = token_get_all($src);
    $n = count($toks);
    $out = array();
    $depth = 0;
    for ($i = 0; $i < $n; $i++) {
        $t = $toks[$i];
        if (is_string($t)) {
            if ($t === '{') $depth++; elseif ($t === '}') $depth--;
            continue;
        }
        if ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; continue; }
        if ($t[0] !== T_FUNCTION || $depth !== 0) continue;
        $j = $i + 1;
        while ($j < $n && is_array($toks[$j]) && $toks[$j][0] === T_WHITESPACE) $j++;
        if ($j >= $n || !is_array($toks[$j]) || $toks[$j][0] !== T_STRING || !isset($want[$toks[$j][1]])) continue;
        $name = $toks[$j][1];
        $code = ''; $d = 0; $started = false;
        for ($k = $i; $k < $n; $k++) {
            $tk = $toks[$k];
            $text = is_string($tk) ? $tk : $tk[1];
            if (is_array($tk) && $tk[0] === T_STRING && isset($rename[$tk[1]])) $text = $rename[$tk[1]];
            $code .= $text;
            if ($text === '{' || (is_array($tk) && ($tk[0] === T_CURLY_OPEN || $tk[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $d++; $started = true; }
            elseif ($text === '}') { $d--; if ($started && $d === 0) break; }
        }
        $out[$name] = $code;
        $i = $k;
    }
    return $out;
}

$PARSERS = array('parseImportFile', 'parseImportCsv', 'parseImportJson', 'parseImportXlsx', '_importXlsxColToIndex',
                 'parseImportXmlSpreadsheet', 'parseImportHtmlTable',
                 // new with the change (absent from the baseline)
                 '_importStackSheets', '_importXlsxSheetRows', '_importXmlssSheetHidden', '_importXmlssSheetRows');

// ----------------------------------------------------------------------------
// Mutants: single-point edits of the candidate. Each must turn EXACTLY its own
// asserts red - a mutant that kills nothing means its asserts are vacuous, one
// that kills more means the asserts are restating one fact.
// ----------------------------------------------------------------------------
$MUTANTS = array(
    'order' => array(array(array('foreach ($tabs as $tab) {', 'foreach (array_reverse($tabs) as $tab) {')),
        array('T-keys', 'T-tabs', 'T-golden', 'X-xls', 'C-golden', 'K-golden', 'B-three_tabs.xlsx', 'B-collide.xlsx', 'B-case.xlsx')),
    'hidden' => array(array(array("if (\$tab['hidden']) continue;", 'if (false) continue;')),
        array('T-rows', 'T-keys', 'T-tabs', 'T-hidden', 'T-golden', 'X-xls', 'B-three_tabs.xlsx')),
    'union' => array(array(array('if (!isset($known[$u])) { $known[$u] = true; $columns[] = (string)$h; }',
                                 'if (!isset($known[$u]) && $s === $sheets[0]) { $known[$u] = true; $columns[] = (string)$h; }')),
        array('T-keys', 'T-golden', 'X-xls', 'L-golden', 'B-three_tabs.xlsx', 'B-legacy2003.xls')),
    'blank' => array(array(array('$row[$c] = (isset($own[$u]) && array_key_exists($own[$u], $r)) ? $r[$own[$u]] : \'\';',
                                 'if (isset($own[$u]) && array_key_exists($own[$u], $r)) $row[$c] = $r[$own[$u]];')),
        array('T-keys', 'T-every', 'T-golden', 'X-xls', 'C-golden', 'L-golden', 'B-three_tabs.xlsx', 'B-collide.xlsx', 'B-legacy2003.xls')),
    'collide' => array(array(array('for ($n = 2; isset($known[strtoupper($sheetCol)]); $n++) {', 'for ($n = 2; false; $n++) {')),
        array('C-golden', 'B-collide.xlsx')),
    'single' => array(array(array("if (count(\$sheets) === 1) return \$sheets[0]['rows'];", "if (false) return \$sheets[0]['rows'];")),
        array('S-golden', 'O-same', 'O-golden', 'O2-same', 'B-single.xlsx', 'B-onetab.xlsx', 'B-onetab2003.xls')),
    'fallback' => array(array(array("\$sheetXml = \$zip->getFromName(!empty(\$tabs) ? \$tabs[0]['part'] : \$firstSheetFile);",
                                    "return false;")),
        array('H-golden', 'B-hiddenfirst.xlsx')),
    'xmlhidden' => array(array(array('if (_importXmlssSheetHidden($ws)) continue;', 'if (false) continue;')),
        array('L-golden', 'B-legacy2003.xls')),
    // B-case survives this one BY DESIGN: the parity compare uppercases keys, which
    // folds the duplicated spellings back together. K-golden is the one that sees it.
    'case' => array(array(array('$u = strtoupper((string)$h);', '$u = (string)$h;')),
        array('K-golden')),
);

// What the BASELINE gets wrong (frozen from the first control run against the
// pre-change shared_logic.php, 2026-10-02). Everything else - the preconditions,
// the one-tab identity, the parity of the one-tab fixtures - passes on BOTH
// builds, which is what proves the fixtures and the read-out are not the bug.
// T-every and T-hidden pass on the baseline VACUOUSLY: it returns Mar's two
// rows alone, which share one column list and hold no hidden-tab data. The
// 'blank' and 'hidden' mutants are what give those two their teeth.
// The B-* parity of a control compares the baseline server reader with the
// BASELINE browser parser (run.py --control drives both halves on the old
// build): B-legacy2003.xls passes there because both old readers took only the
// first worksheet of an XML 2003 file, East, and agree on it.
$CONTROL_RED = array('T-rows', 'T-keys', 'T-tabs', 'T-golden', 'S-golden', 'C-golden', 'H-golden',
                     'L-golden', 'K-golden', 'X-xls', 'X-twin',
                     'B-three_tabs.xlsx', 'B-single.xlsx', 'B-collide.xlsx', 'B-hiddenfirst.xlsx', 'B-case.xlsx');

function apply_mutant($src, $edits, $name) {
    foreach ($edits as $e) {
        $c = substr_count($src, $e[0]);
        if ($c !== 1) { fwrite(STDERR, "FATAL: mutant '$name' anchor found $c times (needs the FIXED build): " . substr($e[0], 0, 90) . "\n"); exit(2); }
        $src = str_replace($e[0], $e[1], $src);
    }
    return $src;
}

// ----------------------------------------------------------------------------
// One run = the candidate (possibly mutated) lifted with a unique prefix, so
// several runs share one process. Returns array(id => array(ok, detail)).
// ----------------------------------------------------------------------------
$RUN_SEQ = 0;
function run_suite($candSrc, $baseSrc, $mainJs, $browser) {
    global $PARSERS, $FIX, $RUN_SEQ;
    $RUN_SEQ++;
    $p = 'r' . $RUN_SEQ . '_';
    $res = array();
    $rec = function ($id, $ok, $detail = '') use (&$res) { $res[$id] = array((bool)$ok, (string)$detail); };

    // The sheet column: a define in the candidate (absent from the baseline).
    $sheetCol = null;
    if (preg_match("/define\\('PENUMBRA_IMPORT_SHEET_COLUMN',\\s*'([^']+)'\\)/", $candSrc, $m)) $sheetCol = $m[1];
    if (!defined('PENUMBRA_IMPORT_SHEET_COLUMN')) define('PENUMBRA_IMPORT_SHEET_COLUMN', $sheetCol !== null ? $sheetCol : 'WORKSHEET');

    $rename = array();
    foreach ($PARSERS as $f) $rename[$f] = $p . $f;
    $cand = lift_functions($candSrc, $PARSERS, $rename);
    $code = implode("\n\n", $cand);
    $oldRename = array();
    foreach ($PARSERS as $f) $oldRename[$f] = $p . 'old_' . $f;
    $old = lift_functions($baseSrc, $PARSERS, $oldRename);
    $code .= "\n\n" . implode("\n\n", $old);
    eval($code);
    $parse = function ($file, $ext = null) use ($p, $FIX) {
        if ($ext === null) $ext = pathinfo($file, PATHINFO_EXTENSION);
        $f = $p . 'parseImportFile';
        return $f($FIX . $file, $ext);
    };
    $parseOld = function ($file, $ext = null) use ($p, $FIX) {
        if ($ext === null) $ext = pathinfo($file, PATHINFO_EXTENSION);
        $f = $p . 'old_parseImportFile';
        return $f($FIX . $file, $ext);
    };
    $j = function ($v) { return json_encode($v); };
    $keysOf = function ($rows) { return (is_array($rows) && isset($rows[0])) ? array_map('strval', array_keys($rows[0])) : null; };

    // ---- preconditions: the fixtures exist and reach the old reader's trap ----
    $need = array('three_tabs.xlsx', 'single.xlsx', 'collide.xlsx', 'hiddenfirst.xlsx', 'legacy2003.xls', 'onetab.xlsx', 'onetab2003.xls', 'case.xlsx');
    $missing = array();
    foreach ($need as $f) if (!is_file($FIX . $f)) $missing[] = $f;
    $rec('P-fixtures', !$missing, $missing ? 'missing: ' . implode(', ', $missing) : 'all 8 present');
    $o3 = $parseOld('three_tabs.xlsx');
    $rec('P-old-rels', is_array($o3) && count($o3) === 2 && isset($o3[0]['ID']) && (string)$o3[0]['ID'] === '3001',
         'the OLD reader reads three_tabs.xlsx from its first worksheet RELATIONSHIP (Mar): ' . $j($o3));
    $oS = $parseOld('single.xlsx');
    $rec('P-old-single', $oS === false, 'the OLD reader reads single.xlsx from the empty Sheet3: ' . $j($oS));

    // ---- three_tabs.xlsx: Jan, Feb (+NOTE), Mar (no NAME); Lookup hidden; Notes empty; Template headers only
    $T = $parse('three_tabs.xlsx');
    $TG = array(
        array('WORKSHEET' => 'Jan', 'ID' => '1001', 'NAME' => 'Alpha', 'AMOUNT' => '120', 'NOTE' => ''),
        array('WORKSHEET' => 'Jan', 'ID' => '1002', 'NAME' => 'Bravo', 'AMOUNT' => '80', 'NOTE' => ''),
        array('WORKSHEET' => 'Jan', 'ID' => '1003', 'NAME' => 'Charlie', 'AMOUNT' => '45', 'NOTE' => ''),
        array('WORKSHEET' => 'Feb', 'ID' => '2001', 'NAME' => 'Delta', 'AMOUNT' => '300', 'NOTE' => 'late'),
        array('WORKSHEET' => 'Feb', 'ID' => '2002', 'NAME' => 'Echo', 'AMOUNT' => '10', 'NOTE' => ''),
        array('WORKSHEET' => 'Mar', 'ID' => '3001', 'NAME' => '', 'AMOUNT' => '75', 'NOTE' => ''),
        array('WORKSHEET' => 'Mar', 'ID' => '3002', 'NAME' => '', 'AMOUNT' => '60', 'NOTE' => ''));
    $rec('T-rows', is_array($T) && count($T) === 7, 'rows: ' . (is_array($T) ? count($T) : $j($T)));
    $rec('T-keys', $keysOf($T) === array('WORKSHEET', 'ID', 'NAME', 'AMOUNT', 'NOTE'), 'first row keys: ' . $j($keysOf($T)));
    $every = is_array($T) && count($T) > 0;
    if ($every) foreach ($T as $r) if (array_map('strval', array_keys($r)) !== $keysOf($T)) { $every = false; break; }
    $rec('T-every', $every, 'every row carries the first row\'s columns, in order');
    $tabs = is_array($T) ? array_map(function ($r) { return isset($r['WORKSHEET']) ? $r['WORKSHEET'] : '?'; }, $T) : array();
    $rec('T-tabs', $tabs === array('Jan', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar'), 'WORKSHEET in row order: ' . $j($tabs));
    $hid = is_array($T) && !in_array('Lookup', $tabs, true) && $keysOf($T) !== null && !in_array('CODE', $keysOf($T), true);
    $rec('T-hidden', $hid, 'the hidden Lookup tab is not stacked');
    $rec('T-empty', is_array($T) && !in_array('Notes', $tabs, true) && !in_array('Template', $tabs, true), 'the empty and headers-only tabs add no rows');
    $rec('T-golden', $T === $TG, $j($T));

    // ---- single.xlsx: one data tab + two empty tabs - no WORKSHEET, exactly the data tab
    $S = $parse('single.xlsx');
    $SG = array(array('ID' => '1', 'NAME' => 'One', 'AMOUNT' => '10'), array('ID' => '2', 'NAME' => 'Two', 'AMOUNT' => '20'),
                array('ID' => '3', 'NAME' => 'Three', 'AMOUNT' => '30'));
    $rec('S-golden', $S === $SG, $j($S));

    // ---- onetab: the old reader's one correct shape, byte for byte
    $O = $parse('onetab.xlsx');
    $OO = $parseOld('onetab.xlsx');
    $OG = array(array('ID' => '1', 'NAME' => 'One', 'AMOUNT' => '10', 'Mixed Case' => 'a'),
                array('ID' => '2', 'NAME' => 'Two', 'AMOUNT' => '', 'Mixed Case' => 'b'),
                array('ID' => '3', 'NAME' => '', 'AMOUNT' => '30', 'Mixed Case' => ''));
    $rec('O-same', $O !== false && $j($O) === $j($OO), 'new ' . $j($O) . ' | old ' . $j($OO));
    $rec('O-golden', $O === $OG, $j($O));
    $O2 = $parse('onetab2003.xls');
    $O2O = $parseOld('onetab2003.xls');
    $rec('O2-same', $O2 !== false && $j($O2) === $j($O2O), 'new ' . $j($O2) . ' | old ' . $j($O2O));

    // ---- collide.xlsx: tab A has its own WORKSHEET column -> ours is WORKSHEET_2
    $C = $parse('collide.xlsx');
    $CG = array(array('WORKSHEET_2' => 'A', 'WORKSHEET' => 'north', 'ID' => '1'),
                array('WORKSHEET_2' => 'A', 'WORKSHEET' => 'south', 'ID' => '2'),
                array('WORKSHEET_2' => 'B', 'WORKSHEET' => '', 'ID' => '3'));
    $rec('C-golden', $C === $CG, $j($C));

    // ---- hiddenfirst.xlsx: data only on a HIDDEN first tab -> the old answer (that tab, alone)
    $H = $parse('hiddenfirst.xlsx');
    $HG = array(array('ID' => '7', 'NAME' => 'Seven'), array('ID' => '8', 'NAME' => 'Eight'));
    $rec('H-golden', $H === $HG, $j($H));

    // ---- legacy2003.xls (XML Spreadsheet 2003): East, West (+OWNER), Codes hidden
    $L = $parse('legacy2003.xls');
    $LG = array(array('WORKSHEET' => 'East', 'REGION_ID' => '11', 'TOTAL' => '500', 'OWNER' => ''),
                array('WORKSHEET' => 'East', 'REGION_ID' => '12', 'TOTAL' => '250', 'OWNER' => ''),
                array('WORKSHEET' => 'West', 'REGION_ID' => '21', 'TOTAL' => '900', 'OWNER' => 'kim'));
    $rec('L-golden', $L === $LG, $j($L));

    // ---- case.xlsx: Amount/Name on One, AMOUNT/name on Two -> one column each, first spelling
    $K = $parse('case.xlsx');
    $KG = array(array('WORKSHEET' => 'One', 'Amount' => '5', 'Name' => 'x'), array('WORKSHEET' => 'Two', 'Amount' => '6', 'Name' => 'y'));
    $rec('K-golden', $K === $KG, $j($K));

    // ---- an OOXML workbook saved with a .xls name takes the dispatcher's second reader
    $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'msheet_ooxml_' . getmypid() . '_' . $RUN_SEQ . '.xls';
    copy($FIX . 'three_tabs.xlsx', $tmp);
    $fnf = $p . 'parseImportFile';
    $X = $fnf($tmp, 'xls');
    @unlink($tmp);
    $rec('X-xls', $X === $TG, $j($X));

    // ---- TWIN: the column name agrees with js/main.js
    $jsCol = null;
    if ($mainJs !== null && preg_match("/var PENUMBRA_IMPORT_SHEET_COLUMN = '([^']+)';/", $mainJs, $mm)) $jsCol = $mm[1];
    $rec('X-twin', $sheetCol !== null && $jsCol !== null && $sheetCol === $jsCol && $sheetCol === 'WORKSHEET',
         'shared_logic.php ' . $j($sheetCol) . ' | js/main.js ' . $j($jsCol));

    // ---- PARITY with the browser half (run.py): the same file must give the same
    // table on both sides. Keys compared UPPERCASED: the browser has always
    // uppercased headers and the server has always kept their case (pre-existing,
    // and the [IMPORT] tail resolves either).
    if ($browser !== null) {
        $up = function ($rows) {
            if (!is_array($rows)) return $rows;
            return array_map(function ($r) { $o = array(); foreach ($r as $k => $v) $o[strtoupper((string)$k)] = (string)$v; return $o; }, $rows);
        };
        foreach (array('three_tabs.xlsx', 'single.xlsx', 'collide.xlsx', 'hiddenfirst.xlsx', 'legacy2003.xls', 'onetab.xlsx', 'onetab2003.xls', 'case.xlsx') as $f) {
            if (!isset($browser[$f])) { $rec('B-' . $f, false, 'the browser half recorded nothing for ' . $f); continue; }
            $srv = $up($parse($f));
            $brw = $browser[$f];
            $okp = ($j($srv) === $j($brw));
            $rec('B-' . $f, $okp, $okp ? (count($brw) . ' rows, identical') : ('server ' . $j($srv) . ' | browser ' . $j($brw)));
        }
    }
    return $res;
}

function report($title, $res, $mustFail) {
    $bad = 0; $unexpected = array();
    echo "== $title\n";
    foreach ($res as $id => $r) {
        $expectFail = in_array($id, $mustFail, true);
        $match = ($r[0] !== $expectFail);
        if (!$match) { $bad++; $unexpected[] = $id; }
        printf("  %s %-20s %s%s\n", $r[0] ? 'PASS' : 'FAIL', $id, $expectFail ? '(expected FAIL) ' : '', $match ? '' : '  <== UNEXPECTED');
        if (!$r[0] || !$match) echo "       " . substr($r[1], 0, 900) . "\n";
    }
    foreach ($mustFail as $id) if (!isset($res[$id])) { $bad++; $unexpected[] = "$id (not recorded)"; }
    $pass = count(array_filter($res, function ($r) { return $r[0]; }));
    printf("   -> %d asserts, %d passed, %d failed; %s\n", count($res), $pass, count($res) - $pass,
           $bad ? ('MISMATCH: ' . implode(', ', $unexpected)) : 'as expected');
    return $bad;
}

$candSrc = @file_get_contents($CAND);
$baseSrc = @file_get_contents($BASE);
$mainJs = @file_get_contents($APP . '\\js\\main.js');
if ($candSrc === false || $baseSrc === false) { fwrite(STDERR, "FATAL: cannot read candidate ($CAND) or baseline ($BASE)\n"); exit(2); }
if ($mainJs === false) $mainJs = null;
$browser = null;
if ($BJSON !== null) {
    $browser = json_decode(@file_get_contents($BJSON), true);
    if (!is_array($browser)) { fwrite(STDERR, "FATAL: --browser-json unreadable: $BJSON\n"); exit(2); }
}
echo "candidate: $CAND\nbaseline:  $BASE\nmain.js:   " . ($mainJs === null ? '(none)' : $APP . '\\js\\main.js') . "\nbrowser:   " . ($BJSON === null ? '(not given - parity skipped)' : $BJSON) . "\n";

$bad = 0;
if ($CONTROL) {
    $red = $CONTROL_RED;
    if ($browser === null) $red = array_values(array_filter($red, function ($id) { return strpos($id, 'B-') !== 0; }));
    $bad += report('CONTROL (the baseline as the candidate)', run_suite($baseSrc, $baseSrc, $mainJs, $browser), $red);
} elseif ($ONE_MUTANT !== null || $ALL_MUTANTS) {
    $names = $ALL_MUTANTS ? array_keys($MUTANTS) : array($ONE_MUTANT);
    foreach ($names as $mn) {
        if (!isset($MUTANTS[$mn])) { fwrite(STDERR, "unknown mutant: $mn\n"); exit(2); }
        $must = $MUTANTS[$mn][1];
        if ($browser === null) $must = array_values(array_filter($must, function ($id) { return strpos($id, 'B-') !== 0; }));
        $bad += report("MUTANT $mn", run_suite(apply_mutant($candSrc, $MUTANTS[$mn][0], $mn), $baseSrc, $mainJs, $browser), $must);
    }
} else {
    $bad += report('CANDIDATE', run_suite($candSrc, $baseSrc, $mainJs, $browser), array());
}
echo $bad ? "RESULT: MISMATCH ($bad)\n" : "RESULT: OK\n";
exit($bad ? 1 : 0);
