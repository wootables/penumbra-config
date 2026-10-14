<?php
/**
 * route.php <app dir> - the server half of dashboard search (2026-09-29):
 *   1. corpus.json through penumbra_route_dash_search() (the SAME corpus the
 *      browser half runs through main.js penumbraRouteDashSearch - parity by
 *      construction: both must match the expected results)
 *   2. penumbra_search_known_columns()
 *   3. index.php's REAL &dsearch= step, cut out of the file by its markers and
 *      run against a fake $response / $_GET, then filtered by the real engine.
 * Prints PASS/FAIL lines and "N assertions, M failed". Exit 1 on any failure.
 */
$APP = isset($argv[1]) ? rtrim($argv[1], "/\\") : '';
if ($APP === '' || !is_file($APP . '/penumbra_search.php') || !is_file($APP . '/index.php')) {
    fwrite(STDERR, "usage: php route.php <dir holding penumbra_search.php and index.php>\n");
    exit(2);
}
require_once $APP . '/penumbra_search.php';
// journal_export.php: the toggle columns index.php's ?json=1 writes into its rows.
// Its only database calls go through queryViaOci8(), stubbed from $STUB_JOURNAL
// (toggle key => the row keys checked): the report-id lookup and the STATE = 1 rows.
$STUB_JOURNAL = array();
if (!function_exists('queryViaOci8')) {
    function queryViaOci8($sql, $binds = array()) {
        global $STUB_JOURNAL;
        if (stripos($sql, 'FROM PENUMBRA_REPORTS') !== false) { return array(array('ID' => 7)); }
        $out = array();
        if (stripos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) {
            foreach ($STUB_JOURNAL as $tk => $keys) { foreach ($keys as $rk) { $out[] = array('TOGGLE_KEY' => $tk, 'ROW_KEY' => $rk); } }
        }
        return $out;
    }
}
$haveJournal = is_file($APP . '/journal_export.php');
if ($haveJournal) { require_once $APP . '/journal_export.php'; }
$pass = 0; $fail = 0;
function ok($name, $cond, $detail = '') {
    global $pass, $fail;
    if ($cond) { $pass++; echo "  PASS  $name\n"; }
    else { $fail++; echo "  FAIL  $name\n        $detail\n"; }
}
if (!function_exists('penumbra_route_dash_search') || !function_exists('penumbra_search_known_columns')) {
    echo "FATAL: routing helpers missing from $APP/penumbra_search.php\n";
    exit(1);
}

// ---- 1. the shared corpus
// A "rows" case gives the report's ROWS instead of a column list: the column
// list is derived the way index.php's &dsearch= step derives it (main.html does
// the same through the report page's own derivation).
// A "journal" case: the report has journal toggles, so its rows first get the
// toggle columns exactly as index.php's ?json=1 writes them in.
$corpus = json_decode(file_get_contents(__DIR__ . '/corpus.json'), true);
foreach ($corpus as $c) {
    $in = isset($c['raw']) ? $c['raw'] : json_encode($c['dsearch']);
    $rows = isset($c['rows']) ? $c['rows'] : null;
    if ($rows !== null && isset($c['journal'])) {
        if (!$haveJournal) { ok('corpus: ' . $c['name'], false, 'journal_export.php missing from ' . $APP); continue; }
        $STUB_JOURNAL = $c['journal']['checked'];
        journalExportToggleColumns('corpus', array('viewOptions' => array('journalEnabled' => true,
            'journalToggles' => $c['journal']['toggles'], 'journalKeyColumns' => $c['journal']['keys'])), $rows);
    }
    $r = penumbra_route_dash_search($in, $rows !== null ? penumbra_search_known_columns($rows) : $c['cols']);
    $got = array('ok' => $r['ok'], 'text' => $r['text'], 'applied' => $r['applied'], 'skipped' => $r['skipped']);
    $want = array('ok' => $c['ok'], 'text' => $c['text'], 'applied' => $c['applied'], 'skipped' => $c['skipped']);
    ok('corpus: ' . $c['name'], $got === $want, 'got ' . json_encode($got) . ' want ' . json_encode($want));
}

// ---- 2. the column list the parser would recognize
$kc = penumbra_search_known_columns(array(array('A' => '1', 'NOTE' => 'x')));
ok('known columns: the row keys plus #', $kc === array('A', 'NOTE', '#'), json_encode($kc));
$kc2 = penumbra_search_known_columns(array(array('A' => '1', 'SUB' => '@@JSON[{"SPECIES":"Chicken","N":"2"}]')));
ok('known columns: @@JSON sub-table columns count', in_array('SPECIES', array_map('strtoupper', $kc2), true), json_encode($kc2));
ok('known columns: no rows = none', penumbra_search_known_columns(array()) === array());

// ---- 3. index.php's own &dsearch= step
$src = file_get_contents($APP . '/index.php');
$s = strpos($src, '// columns (2026-09-30)');
$e = ($s === false) ? false : strpos($src, '// Optional row cap (&limit=N)', $s);
if ($s === false || $e === false) {
    ok('index.php: the &dsearch= step is present', false, 'markers not found');
} else {
    $block = substr($src, $s, $e - $s);
    $block = str_replace("__DIR__ . '/penumbra_search.php'", var_export($APP . '/penumbra_search.php', true), $block);
    $run = function ($response, $get) use ($block) {
        $_GET = $get;
        $journal_toggle_resolver = null;   // set by index.php's journal step (section 4 runs that)
        eval($block);
        return $response;
    };
    $rowsA = array(
        array('COLLEGE' => 'Eng', 'AMOUNT' => '10', 'STATUS' => 'Open'),
        array('COLLEGE' => 'Sci', 'AMOUNT' => '20', 'STATUS' => 'Open'),
        array('COLLEGE' => 'Eng', 'AMOUNT' => '3',  'STATUS' => 'Closed')
    );
    $rowsB = array(array('NAME' => 'Ada', 'AMOUNT' => '7'), array('NAME' => 'Bob', 'AMOUNT' => '2'));
    $ds = json_encode(array('p' => '', 'f' => array(array('COLLEGE', 'COLLEGE = Eng'), array('AMOUNT', 'AMOUNT > 5'))));

    $r1 = $run(array('data' => $rowsA), array('dsearch' => $ds));
    ok('index.php: both conditions filter a report that has both columns', count($r1['data']) === 1 && $r1['data'][0]['AMOUNT'] === '10', json_encode($r1['data']));
    ok('index.php: nothing skipped there', isset($r1['search_skipped']) && $r1['search_skipped'] === array(), json_encode(isset($r1['search_skipped']) ? $r1['search_skipped'] : null));

    $r2 = $run(array('data' => $rowsB), array('dsearch' => $ds));
    ok('index.php: a report without COLLEGE keeps the AMOUNT condition (not zero rows)', count($r2['data']) === 1 && $r2['data'][0]['NAME'] === 'Ada', json_encode($r2['data']));
    ok('index.php: and names COLLEGE as skipped', $r2['search_skipped'] === array('COLLEGE'), json_encode($r2['search_skipped']));

    $r3 = $run(array('data' => array()), array('dsearch' => $ds));
    ok('index.php: no rows = nothing to route, nothing reported', $r3['data'] === array() && $r3['search_skipped'] === array(), json_encode($r3));

    $r4 = $run(array('data' => $rowsA), array());
    ok('index.php: no &dsearch= = rows untouched and no key added', count($r4['data']) === 3 && !array_key_exists('search_skipped', $r4), json_encode(array_keys($r4)));
    // The column envelope (2026-09-30): the list the routing reads, before the search steps.
    ok('index.php: the envelope names the columns the routing reads', isset($r1['columns']) && $r1['columns'] === array('COLLEGE', 'AMOUNT', 'STATUS', '#'), json_encode(isset($r1['columns']) ? $r1['columns'] : null));
    $r5 = $run(array('data' => $rowsB), array('dsearch' => json_encode(array('p' => '', 'f' => array(array('NAME', 'NAME Zed'))))));
    ok('index.php: a filter that leaves no rows still names the columns', $r5['data'] === array() && isset($r5['columns']) && $r5['columns'] === array('NAME', 'AMOUNT', '#'), json_encode($r5));
    ok('index.php: no rows at all = no columns key', !array_key_exists('columns', $r3), json_encode(array_keys($r3)));
    // No rows at all, WITH the driver's metadata (2026-10-01): the envelope and the routing read it.
    $meta = array(array('name' => 'COLLEGE', 'native_type' => 'VARCHAR2'), array('name' => 'AMOUNT', 'native_type' => 'NUMBER'));
    $r10 = $run(array('data' => array(), 'columns_meta' => $meta), array('dsearch' => $ds));
    ok('index.php: no rows + metadata = the envelope names the columns', $r10['data'] === array() && isset($r10['columns']) && $r10['columns'] === array('COLLEGE', 'AMOUNT', '#'), json_encode($r10));
    ok('index.php: ... and the routing reads them (both present, nothing skipped)', $r10['search_skipped'] === array(), json_encode($r10['search_skipped']));
    $r11 = $run(array('data' => array(), 'columns_meta' => array(array('name' => 'NAME'), array('name' => 'AMOUNT'))), array('dsearch' => $ds));
    ok('index.php: no rows + metadata = a fragment on a column the report lacks is still named skipped', $r11['search_skipped'] === array('COLLEGE') && $r11['columns'] === array('NAME', 'AMOUNT', '#'), json_encode($r11));
    $r12 = $run(array('data' => array(), 'columns_meta' => array(array('native_type' => 'NUMBER'), array('name' => ''))), array('dsearch' => $ds));
    ok('index.php: metadata without names = no columns key, nothing routed (as with no metadata)', !array_key_exists('columns', $r12) && $r12['search_skipped'] === array(), json_encode($r12));
    $r13 = $run(array('data' => array(), 'columns_meta' => $meta), array());
    ok('index.php: no &dsearch= with no rows = the envelope alone, no search_skipped key', $r13['columns'] === array('COLLEGE', 'AMOUNT', '#') && !array_key_exists('search_skipped', $r13), json_encode(array_keys($r13)));
    ok('index.php: with rows the envelope still comes from the rows, not the metadata', $run(array('data' => $rowsB, 'columns_meta' => $meta), array())['columns'] === array('NAME', 'AMOUNT', '#'));
    ok('columns from metadata: null / not an array / no names = none', penumbra_search_columns_from_meta(null) === array() && penumbra_search_columns_from_meta('x') === array() && penumbra_search_columns_from_meta(array(array('x' => 1))) === array());
    ok('columns from metadata: names once, in order, then #', penumbra_search_columns_from_meta(array(array('name' => 'A'), array('name' => 'B'), array('name' => 'A'))) === array('A', 'B', '#'));
    // Sliced columns (BASE__PT1..n) merge through shared_logic.php's one plan when it is
    // loaded; it is not loaded here, so a stub plan with its real shape proves the wiring.
    if (!function_exists('penumbraSliceMergePlan')) {
        function penumbraSliceMergePlan($keys) {
            return array('keys' => $keys, 'active' => array('NOTE__PT1' => array('base' => 'NOTE', 'order' => array(1 => 'NOTE__PT1', 2 => 'NOTE__PT2')), 'NOTE__PT2' => false));
        }
    }
    $slicedMeta = array(array('name' => 'ID'), array('name' => 'NOTE__PT1'), array('name' => 'NOTE__PT2'));
    ok('columns from metadata: sliced parts merge into their base through the merge plan', penumbra_search_columns_from_meta($slicedMeta) === array('ID', 'NOTE', '#'), json_encode(penumbra_search_columns_from_meta($slicedMeta)));

    $ds5 = json_encode(array('p' => '', 'f' => array(array('', 'STATUS = Closed'), array('DEPT', 'DEPT = Ops'))));
    $r5 = $run(array('data' => $rowsA), array('dsearch' => $ds5));
    ok('index.php: a fragment with no column still filters while another is skipped', count($r5['data']) === 1 && $r5['data'][0]['STATUS'] === 'Closed' && $r5['search_skipped'] === array('DEPT'), json_encode($r5));

    $r6 = $run(array('data' => $rowsA), array('dsearch' => '{broken'));
    ok('index.php: a malformed list filters nothing', count($r6['data']) === 3, json_encode($r6['data']));

    // The literal rule the routing exists to avoid, measured on the same engine:
    $lit = php_apply_search_filter($rowsB, 'standard', 'COLLEGE = Eng and AMOUNT > 5');
    ok('control: plain search with the missing column matches NO row', count($lit) === 0, json_encode($lit));

    // Nested (@@JSON sub-table) columns: the same rows mainload.html loads into
    // the framed report page. SPECIES = Chicken is in P1, P3 and P4; with __ROW
    // the Chicken and the N = 1 must be the SAME sub-row: P3 only.
    $rowsN = array(
        array('PROJ' => 'P1', 'SUB' => '@@JSON[{"SPECIES":"Chicken","N":"2"}]'),
        array('PROJ' => 'P2', 'SUB' => '@@JSON[{"SPECIES":"Duck","N":"1"}]'),
        array('PROJ' => 'P3', 'SUB' => '@@JSON[{"SPECIES":"Chicken","N":"1"},{"SPECIES":"Goose","N":"5"}]'),
        array('PROJ' => 'P4', 'SUB' => '@@JSON[{"SPECIES":"Goose","N":"1"},{"SPECIES":"Chicken","N":"5"}]')
    );
    $projs = function ($rows) { return implode(',', array_map(function ($r) { return $r['PROJ']; }, $rows)); };
    $r7 = $run(array('data' => $rowsN), array('dsearch' => json_encode(array('p' => '', 'f' => array(array('SPECIES', 'SPECIES = Chicken'))))));
    ok('index.php: a nested-column condition filters a data tile (P1,P3,P4)', $projs($r7['data']) === 'P1,P3,P4' && $r7['search_skipped'] === array(), json_encode(array($projs($r7['data']), $r7['search_skipped'])));
    $r8 = $run(array('data' => $rowsN), array('dsearch' => json_encode(array('p' => '__ROW ', 'f' => array(array('SPECIES', 'SPECIES = Chicken'), array('N', 'N = 1'))))));
    ok('index.php: __ROW holds nested conditions to one sub-row (P3)', $projs($r8['data']) === 'P3' && $r8['search_skipped'] === array(), json_encode(array($projs($r8['data']), $r8['search_skipped'])));
    // A sub-table that is empty in the first row: its columns still count when a
    // later row (of the first 10, as on the report page) has them - and the
    // engine then filters on them instead of reading a literal.
    $rowsL = array(
        array('PROJ' => 'L1', 'SUB' => null),
        array('PROJ' => 'L2', 'SUB' => '@@JSON[]'),
        array('PROJ' => 'L3', 'SUB' => '@@JSON[{"SPECIES":"Duck"}]'),
        array('PROJ' => 'L4', 'SUB' => '@@JSON[{"SPECIES":"Chicken"}]')
    );
    $r9 = $run(array('data' => $rowsL), array('dsearch' => json_encode(array('p' => '', 'f' => array(array('SPECIES', 'SPECIES = Duck'))))));
    ok('index.php: a nested column first seen in row 3 is routed and filters (L3)', $projs($r9['data']) === 'L3' && $r9['search_skipped'] === array(), json_encode(array($projs($r9['data']), $r9['search_skipped'])));
    $lit2 = php_apply_search_filter($rowsL, 'standard', 'SPECIES = Duck');
    ok('engine: plain search on that late nested column filters too (L3), not a literal', $projs($lit2) === 'L3', $projs($lit2));
}

// ---- 4. index.php's journal step + its &search= / &dsearch= steps, END TO END
// (queryViaOci8 stubbed): the toggle columns are written into the rows, then read
// the way the report page reads a toggle - "Done = ☑" / "unchecked" are the
// stored 1 / 0. Row notes never reach these rows: a NOTES condition is skipped.
$s4 = strpos($src, '// --- JOURNAL TOGGLE STATUS');
$e4 = ($s4 === false) ? false : strpos($src, '// Optional row cap (&limit=N)', $s4);
if (!$haveJournal || $s4 === false || $e4 === false) {
    ok('index.php: the journal step and the search steps are present', false, $haveJournal ? 'markers not found' : 'journal_export.php missing from ' . $APP);
} else {
    $block4 = str_replace(array("__DIR__ . '/journal_export.php'", "__DIR__ . '/penumbra_search.php'"),
        array(var_export($APP . '/journal_export.php', true), var_export($APP . '/penumbra_search.php', true)),
        substr($src, $s4, $e4 - $s4));
    $runJ = function ($get) use ($block4) {
        $_GET = $get;
        $response = array('data' => array(
            array('PROJ' => 'P1', 'AMOUNT' => '10'), array('PROJ' => 'P2', 'AMOUNT' => '20'),
            array('PROJ' => 'P3', 'AMOUNT' => '30'), array('PROJ' => 'P4', 'AMOUNT' => '40')));
        $state = array('viewOptions' => array('journalEnabled' => true,
            'journalToggles' => array(array('key' => 'done', 'label' => 'Done')), 'journalKeyColumns' => array('PROJ')));
        eval($block4);
        return $response;
    };
    $STUB_JOURNAL = array('done' => array('P1', 'P3'));
    $pj = function ($r) { return implode(',', array_map(function ($x) { return $x['PROJ']; }, $r['data'])); };
    $dj = function ($col, $text) { return json_encode(array('p' => '', 'f' => array(array($col, $text)))); };
    $j0 = $runJ(array('id' => 'jr'));
    ok('journal: ?json=1 writes the toggle column into the rows (1/0)', implode(',', array_map(function ($x) { return isset($x['DONE']) ? $x['DONE'] : '-'; }, $j0['data'])) === '1,0,1,0', json_encode($j0['data']));
    $j1 = $runJ(array('id' => 'jr', 'dsearch' => $dj('DONE', 'Done = ☑')));
    ok('journal dsearch: Done = ☑ reads the toggle (P1,P3), nothing skipped', $pj($j1) === 'P1,P3' && $j1['search_skipped'] === array(), $pj($j1) . ' ' . json_encode($j1['search_skipped']));
    $j2 = $runJ(array('id' => 'jr', 'dsearch' => $dj('DONE', 'Done = unchecked')));
    ok('journal dsearch: Done = unchecked (P2,P4)', $pj($j2) === 'P2,P4', $pj($j2));
    $j3 = $runJ(array('id' => 'jr', 'dsearch' => $dj('DONE', 'Done = 1')));
    ok('journal dsearch: the stored form Done = 1 still works (P1,P3)', $pj($j3) === 'P1,P3', $pj($j3));
    $j4 = $runJ(array('id' => 'jr', 'dsearch' => $dj('NOTES', 'Notes > 0')));
    ok('journal dsearch: Notes is not in machine output - rows untouched, NOTES skipped', $pj($j4) === 'P1,P2,P3,P4' && $j4['search_skipped'] === array('NOTES'), $pj($j4) . ' ' . json_encode($j4['search_skipped']));
    $j5 = $runJ(array('id' => 'jr', 'search' => 'Done = ☑'));
    ok('journal &search=: Done = ☑ reads the toggle too (P1,P3)', $pj($j5) === 'P1,P3', $pj($j5));
}

echo ($pass + $fail) . " assertions, $fail failed\n";
exit($fail > 0 ? 1 : 0);
