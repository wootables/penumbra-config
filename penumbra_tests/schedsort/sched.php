<?php
// schedsort suite - the scheduler's half (2026-10-24).
//   php -n -d extension_dir=<ext> -d extension=mbstring sched.php <mirror.php> <penumbra_template.php> <app dir> <parity.json> <out.json>
// <mirror.php>: pivotparity\extract_mirror.php over a schedule_runner.php (the candidate's or the reference cut's) -
// the runner's top-level functions only: the runner itself is NEVER included (its top level connects to Oracle,
// claims tasks and SENDS MAIL). The mirror's __DIR__ is its own folder: the twin (penumbra_layout.php) beside it, or
// not (run.py's H-S2 runs). For each fixture of the page's corpus (parity.js through the candidate main.js's own
// code), the rows a scheduled run has - the query's columns, the report's calculated columns (calcsrv puts them at
// the end, as the page does), a tag column the order is read by, then the journal's columns - and the state as the
// run hands it on (the journal's sort levels mapped onto their labels, journalExportMapSortCriteria):
//   main     apply_state_logic($rows, $state, the journal's columns in the page's order) - the email, exports, file
//            drops, snapshots
//   grouped  the same, grouped by a tie column: the rows within each band
//   tpl      penumbra_tpl_flat_source (a custom template's rows: the full rows, re-sorted from rawData)
//   filter   apply_search_filter_via_raw with a task filter every row passes (the output re-derived from rawData)
//   direct   penumbra_sched_sort_rows on the rows WITHOUT the tag (only where the mirror has it)
//   want     the rows in the order of the columns the page sorts by (its plan), compared as the runner compares:
//            a nested table by its rows, a custom order by its list, a number as a number, else naturally; ties
//            keep the query's order
// The tag (SCHEDSORT_TAG, the row's place in the query's order) is a key the page never had: the callers hand it
// on with the journal's columns, as they hand those on. Writes { id: {...} } to <out.json>; prints TOTAL / RESULT.
error_reporting(E_ALL);
$WARN = array();
set_error_handler(function ($no, $str, $file, $line) { global $WARN, $CUR; $WARN[$CUR][] = preg_replace('/\s+on line \d+$/', '', $str); return true; });
$CUR = 'load';
list(, $MIRROR, $TPL, $APP, $FXJSON, $OUT) = $argv;
$TAG = 'SCHEDSORT_TAG';
ob_start();   // the mirror's log_scheduler echoes
require $MIRROR;
require $TPL;
if (!function_exists('php_parse_search_query')) require $APP . '/penumbra_search.php';
require $APP . '/journal_export.php';
ob_end_clean();
$fx = json_decode((string)@file_get_contents($FXJSON), true);
if (!is_array($fx) || empty($fx['fx'])) { echo "FAIL F-sched no corpus\nTOTAL pass=0 fail=1\nRESULT: RED\n"; exit; }
$HAS_DIRECT = function_exists('penumbra_sched_sort_rows');

function up($s) { return function_exists('mb_strtoupper') ? mb_strtoupper((string)$s, 'UTF-8') : strtoupper((string)$s); }
function intdiv2($x) { return (int)floor($x / 2); }
// Every column its own order over the rows (none the identity or its reverse, none like another's): a name with
// TIE in it in pairs, the journal's toggle 1/0, a nested table as 1..8 rows - so the order the rows come out in
// names the columns they were sorted by.
function values_for($id, $keys, $nest, $toggle) {
    mt_srand(crc32('schedsort:' . $id));
    $n = 8; $seen = array(); $cols = array();
    $ident = implode(',', range(0, $n - 1)); $rev = implode(',', range($n - 1, 0, -1));
    foreach ($keys as $k) {
        $ks = (string)$k;
        for ($try = 0; $try < 200; $try++) {
            $p = range(0, $n - 1);
            for ($i = $n - 1; $i > 0; $i--) { $j = mt_rand(0, $i); $t = $p[$i]; $p[$i] = $p[$j]; $p[$j] = $t; }
            $sig = implode(',', $p);
            if ($sig !== $ident && $sig !== $rev && !isset($seen[$sig])) break;
        }
        $seen[$sig] = true;
        $vals = array();
        foreach ($p as $r => $rank) {
            if ($ks === (string)$toggle) $vals[$r] = (string)($rank % 2);
            // (the text runs the other way: sorted as text, a nested column comes out reversed)
            elseif (in_array($ks, $nest, true)) $vals[$r] = '@@JSON' . json_encode(array_fill(0, $rank + 1, array('x' => 7 - $rank)));
            elseif (stripos($ks, 'TIE') !== false) $vals[$r] = 't' . intdiv2($rank);
            else $vals[$r] = 'a' . sprintf('%02d', $rank);
        }
        $cols[$ks] = $vals;
    }
    return $cols;
}
// the order the page's plan gives, as the runner compares values
function want_order($rows, $plan, $custom, $nest) {
    $cmps = array();
    foreach ($plan as $p) {
        $col = $p[0]; $entry = null;
        if (is_array($custom)) foreach ($custom as $k => $e) if (up($k) === up($col)) { $entry = $e; break; }
        $cmps[] = array($col, $p[1] === 'desc' ? -1 : 1, $entry, in_array((string)$col, $nest, true));
    }
    $idx = range(0, count($rows) - 1);
    usort($idx, function ($a, $b) use ($rows, $cmps) {
        foreach ($cmps as $c) {
            list($col, $dir, $entry, $isNest) = $c;
            $va = isset($rows[$a][$col]) ? trim((string)$rows[$a][$col]) : '';
            $vb = isset($rows[$b][$col]) ? trim((string)$rows[$b][$col]) : '';
            if ($isNest) $r = penumbra_nested_row_count($va) <=> penumbra_nested_row_count($vb);
            elseif ($va === '' || $vb === '') $r = ($va === '' ? ($vb === '' ? 0 : -1) : 1);
            elseif ($entry) {
                $order = array();
                foreach (array_values($entry['values']) as $i => $v) { $lk = strtolower(trim((string)$v)); if (!isset($order[$lk])) $order[$lk] = $i; }
                $max = count($entry['values']);
                $ia = isset($order[strtolower($va)]) ? $order[strtolower($va)] : $max; $ib = isset($order[strtolower($vb)]) ? $order[strtolower($vb)] : $max;
                $r = $ia !== $ib ? ($ia < $ib ? -1 : 1) : ($ia === $max ? strnatcasecmp($va, $vb) : 0);
            }
            elseif (is_numeric($va) && is_numeric($vb)) $r = ((float)$va == (float)$vb) ? 0 : ((float)$va < (float)$vb ? -1 : 1);
            else $r = strnatcasecmp($va, $vb);
            if ($r !== 0) return $r * $dir;
        }
        return $a - $b;
    });
    return $idx;
}
function tags_of($rows) {
    global $TAG;
    if (!is_array($rows)) return 'NOT ROWS';
    $o = array();
    foreach ($rows as $r) $o[] = (is_array($r) && array_key_exists($TAG, $r)) ? (int)$r[$TAG] : -1;
    return $o;
}
function bands_of($groups) {
    if (!is_array($groups)) return 'NOT GROUPS';
    $o = array();
    foreach ($groups as $label => $g) {
        $rows = (is_array($g) && isset($g['rows']) && is_array($g['rows'])) ? $g['rows'] : $g;
        $o[(string)$label] = tags_of($rows);
    }
    return $o;
}

$out = array();
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error']) || empty($f['sched'])) continue;
    if ($f['mb'] && !function_exists('mb_strtoupper')) continue;
    $res = array();
    // ---- the rows: the query's columns, the report's calculated ones, the tag; the journal's after them
    $qkeys = array_keys(json_decode($f['rowNow'], true));
    $calc = $f['calc'];
    $jl = array_map('strtolower', $f['journal']);
    // the toggle's output column: its label upper-cased (journalExportToggleResolver), 'DONE' for the default
    $JT = up(isset($f['jlabel']) ? $f['jlabel'] : 'Done');
    $jnames = array();
    if ($jl) {
        $jnames[] = $JT;
        if (in_array('done by', $jl, true)) { $jnames[] = $JT . ' BY'; $jnames[] = $JT . ' ON'; }
        if (in_array('notes', $jl, true)) $jnames[] = 'NOTES';
    }
    $vals = values_for($id, array_merge($qkeys, $calc, $jnames), $f['nest'], $JT);
    $raw = array();
    for ($r = 0; $r < 8; $r++) {
        $row = array();
        foreach (array_merge($qkeys, $calc) as $k) $row[$k] = $vals[(string)$k][$r];
        $row[$TAG] = $r;
        $raw[] = $row;
    }
    // ---- the journal's columns, from a resolver as journalExportToggleResolver builds one (its marks by row key)
    $resolver = null; $screen = array();
    if ($jnames) {
        $keyCol = null;
        foreach ($qkeys as $k) if (stripos((string)$k, 'TIE') === false && !in_array((string)$k, $f['nest'], true)) { $keyCol = $k; break; }
        $resolver = array('colNames' => array($JT), 'colMeta' => array(array('name' => $JT, 'key' => 'k1')),
                          'whoNames' => array(), 'whoMeta' => array(), 'keyUpper' => array(up($keyCol)),
                          'stateMap' => array('k1' => array()), 'whoMap' => array('k1' => array()), 'aliasMap' => array(), 'notesMap' => array());
        if (in_array($JT . ' BY', $jnames, true)) {
            $resolver['whoNames'] = array($JT . ' BY', $JT . ' ON');
            $resolver['whoMeta'] = array(array('name' => $JT . ' BY', 'key' => 'k1', 'kind' => 'by'), array('name' => $JT . ' ON', 'key' => 'k1', 'kind' => 'on'));
        }
        if (in_array('NOTES', $jnames, true)) $resolver['notesName'] = 'NOTES';
        foreach ($raw as $r => $row) {
            $rk = journalExportRowKey($resolver, $row);
            if ($vals[$JT][$r] === '1') $resolver['stateMap']['k1'][$rk] = true;
            if (isset($vals[$JT . ' BY'])) $resolver['whoMap']['k1'][$rk] = array('by' => $vals[$JT . ' BY'][$r], 'on' => $vals[$JT . ' ON'][$r]);
            if (isset($vals['NOTES'])) $resolver['notesMap'][$rk] = $vals['NOTES'][$r];
        }
        $names = array_merge($resolver['colNames'], $resolver['whoNames']);
        if (!empty($resolver['notesName'])) $names[] = $resolver['notesName'];
        $screen = penumbra_sched_journal_screen_order($resolver, $names);
    }
    $flat = array(); $flatNoTag = array();
    foreach ($raw as $row) {
        if ($resolver) foreach (journalExportToggleRowValues($resolver, $row) as $n => $v) $row[$n] = $v;
        $flat[] = $row;
        unset($row[$TAG]);
        $flatNoTag[] = $row;
    }
    // ---- the state as the run hands it on
    $state = $f['state'];
    if ($resolver && !empty($state['sortCriteria']) && is_array($state['sortCriteria'])) {
        $state['sortCriteria'] = journalExportMapSortCriteria($state['sortCriteria'], $resolver);
    }
    $keep = array_merge($screen, array($TAG));
    // ---- the page's plan on these rows: a column by its name; the journal's headings by their labels; '#' none
    $plan = array();
    foreach ($f['plan'] as $p) {
        if (isset($p['col'])) $plan[] = array($p['col'], $p['dir']);
        elseif ($p['virt'] === '__JOURNAL_TOGGLE__k1') $plan[] = array($JT, $p['dir']);
        elseif ($p['virt'] === '__JOURNAL_BY__k1') $plan[] = array($JT . ' BY', $p['dir']);
    }
    $custom = isset($state['customSortOrders']) ? $state['customSortOrders'] : null;
    $res['want'] = want_order($flat, $plan, $custom, $f['nest']);
    $res['plan'] = $plan;
    // ---- main: apply_state_logic as the run calls it
    $CUR = $id . ':main';
    ob_start();
    try { $p = apply_state_logic($flat, $state, $keep); $res['main'] = tags_of($p['data']); $res['mainView'] = $p['viewMode']; }
    catch (Throwable $e) { $res['main'] = 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); $p = null; }
    ob_end_clean();
    // ---- the same without the column names (ldsrv's step-2 include never runs then): any warning here is step 1's
    $CUR = $id . ':quiet';
    $sq = $state; unset($sq['layoutColumnNames']);
    ob_start();
    try { apply_state_logic($flat, $sq, $keep); } catch (Throwable $e) { }
    ob_end_clean();
    // ---- grouped by a tie column
    $tie = null;
    foreach ($qkeys as $k) if (stripos((string)$k, 'TIE') !== false) { $tie = $k; break; }
    if ($tie !== null) {
        $CUR = $id . ':grouped';
        $sg = $state; $sg['groupBy'] = (string)$tie;
        ob_start();
        try { $pg = apply_state_logic($flat, $sg, $keep); $res['grouped'] = $pg['viewMode'] === 'grouped' ? bands_of($pg['data']) : 'VIEW ' . $pg['viewMode']; }
        catch (Throwable $e) { $res['grouped'] = 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
        ob_end_clean();
    }
    if (is_array($p)) {
        $api = array_merge($state, $p, array('rawData' => $raw, 'journalToggleCols' => $keep, 'journalToggleResolver' => $resolver));
        // ---- a custom template's rows
        $CUR = $id . ':tpl';
        ob_start();
        try {
            $t = penumbra_tpl_flat_source($api);
            $res['tpl'] = tags_of($t['rows']);
            $res['tplNums'] = array_map(function ($x) { return $x - 1; }, array_values($t['rowNums']));
        } catch (Throwable $e) { $res['tpl'] = 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
        ob_end_clean();
        // ---- a task filter every row passes: the output re-derived from rawData
        $CUR = $id . ':filter';
        ob_start();
        try { $fr = apply_search_filter_via_raw($api, $TAG . ' >= 0'); $res['filter'] = tags_of($fr['data']); }
        catch (Throwable $e) { $res['filter'] = 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
        ob_end_clean();
    }
    // ---- the step itself, without the tag (the candidate's)
    if ($HAS_DIRECT) {
        $CUR = $id . ':direct';
        ob_start();
        try {
            $d = penumbra_sched_sort_rows($flatNoTag, $state, $screen);
            $at = array();
            foreach ($flatNoTag as $i => $r) $at[json_encode($r)] = $i;
            $res['direct'] = array();
            foreach ($d as $r) $res['direct'][] = isset($at[json_encode($r)]) ? $at[json_encode($r)] : -1;
        } catch (Throwable $e) { $res['direct'] = 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
        ob_end_clean();
    }
    $res['warn'] = array();
    foreach (array('main', 'quiet', 'grouped', 'tpl', 'filter', 'direct') as $w) if (!empty($WARN[$id . ':' . $w])) $res['warn'][$w] = array_values(array_unique($WARN[$id . ':' . $w]));
    $out[$id] = $res;
}
$out['__meta'] = array('direct' => $HAS_DIRECT, 'twin' => function_exists('pnb_sort_state_here'), 'mb' => function_exists('mb_strtoupper'),
                       'loadWarn' => isset($WARN['load']) ? $WARN['load'] : array(), 'php' => PHP_VERSION);
file_put_contents($OUT, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR));
echo "fixtures " . (count($out) - 1) . "\nTOTAL done\n";
