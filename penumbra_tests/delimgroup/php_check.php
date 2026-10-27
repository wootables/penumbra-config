<?php
// delimgroup suite - the runner half (2026-10-26). NEVER require()s schedule_runner.php (its
// top level opens Oracle, claims tasks and SENDS EMAIL): $argv[1] is the tokenizer-lifted
// mirror of its functions (pivotparity\extract_mirror.php), $argv[2] the JSON run.py wrote:
//   { rows: the browser's fixture, cases: the split rule's cases, bands: the browser's
//     PI_LIST:dsemi bands (label -> [V_ID]), nested: STATUS -> label -> [V_ID] }
// The runner must group EXACTLY as the screen did. Prints RESULTS_JSON:{results:[...]}.
$results = array();
function ok($id, $cond, $detail) { global $results; $results[] = array('id' => $id, 'ok' => (bool)$cond, 'detail' => substr((string)$detail, 0, 700)); }
function S($v) { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
// generate_xlsx_string() zips its sheets and php -n has no zip extension: keep the entries instead (groupmode's stub)
if (!class_exists('ZipArchive')) {
    class ZipArchive {
        const OVERWRITE = 8; const CREATE = 1;
        public static $entries = array();
        public function open($f, $flags = 0) { self::$entries = array(); return true; }
        public function addFromString($name, $content) { self::$entries[$name] = $content; return true; }
        public function close() { return true; }
    }
}
try {
    require $argv[1];
    $appDir = getenv('PENUMBRA_APP');
    if (!function_exists('_search_get_virtual_columns') && $appDir && is_file($appDir . '/penumbra_search.php')) require $appDir . '/penumbra_search.php';
    $in = json_decode(file_get_contents($argv[2]), true);
    $rows = $in['rows'];
    $cols = array_keys($rows[0]);
    $idx = range(0, count($cols) - 1);
    $base = array('visibleColumns' => $idx, 'columnOrder' => $idx);
    // label -> [V_ID] of a grouped map ("A > B" keys split back into a tree when nested)
    // (a flat result - the build before the change does not group - holds rows, not groups: none read)
    $ids = function ($grp) { $o = array(); if (is_array($grp)) foreach ($grp as $r) { if (is_array($r) && isset($r['V_ID'])) $o[] = $r['V_ID']; } sort($o); return $o; };
    $groupsOf = function ($res) { return ($res['viewMode'] === 'grouped' && is_array($res['data'])) ? $res['data'] : array(); };
    $cmpBands = function ($got, $want) {
        $bad = array();
        $gk = array_map('strval', array_keys($got)); $wk = array_map('strval', array_keys($want)); sort($gk); sort($wk);
        if ($gk !== $wk) $bad[] = 'keys got ' . S($gk) . ' want ' . S($wk);
        foreach ($want as $k => $v) { $v2 = $v; sort($v2); if (isset($got[$k]) && $got[$k] !== $v2) $bad[] = $k . ': got ' . S($got[$k]) . ' want ' . S($v2); }
        return $bad;
    };
    // the row total, -1 where the build has none (the build before the change): every assert still runs
    $rt = function ($data) { return function_exists('penumbra_grouped_row_total') ? penumbra_grouped_row_total($data) : -1; };
    $hasTag = function ($data) {
        foreach ($data as $g) { if (!is_array($g)) continue; foreach ((isset($g['rows']) ? $g['rows'] : $g) as $r) { if (is_array($r)) foreach (array_keys($r) as $k) { if (strpos((string)$k, "\0") !== false) return true; } } }
        return false;
    };

    // X-pieces: the split rule, case for case the browser's
    $bad = array();
    if (!function_exists('penumbra_group_delim_pieces')) $bad[] = 'penumbra_group_delim_pieces missing';
    else foreach ($in['cases'] as $c) { $g = penumbra_group_delim_pieces($c[0], $c[1]); if ($g !== $c[2]) $bad[] = S($c) . ' -> ' . S($g); }
    ok('X-pieces', !$bad, $bad ? implode(' | ', $bad) : count($in['cases']) . ' cases');

    // X-parse: the token and its label
    $t1 = pivot_parse_field_token('PI_LIST:dsemi'); $t2 = pivot_parse_field_token('PI_LIST:dsemi:fill'); $t3 = pivot_parse_field_token('AWARD_DATE:fy');
    ok('X-parse', $t1['base'] === 'PI_LIST' && isset($t1['delim']) && $t1['delim'] === 'dsemi' && $t1['split'] === null
        && $t2['base'] === 'PI_LIST:dsemi:fill' && empty($t2['delim']) && $t3['split'] === 'fy' && empty($t3['delim'])
        && pivot_field_display_label('PI_LIST:dsemi') === 'PI_LIST (split by ;)' && pivot_field_display_label('NOTES:dnl') === 'NOTES (split by new line)',
        S(array($t1, $t2, $t3, pivot_field_display_label('PI_LIST:dsemi'))));

    // X-group: the same bands as the screen
    $res = apply_state_logic($rows, $base + array('groupBy' => 'PI_LIST:dsemi'));
    $got = array(); foreach ($groupsOf($res) as $k => $g) $got[(string)$k] = $ids($g);
    $bad = $cmpBands($got, $in['bands']);
    ok('X-group', $res['viewMode'] === 'grouped' && !$bad, $res['viewMode'] . ' ' . ($bad ? implode(' | ', array_slice($bad, 0, 4)) : count($got) . ' groups'));
    ok('X-notag', !$hasTag($res['data']), 'a row still carries the row index key');
    ok('X-total', $res['viewMode'] === 'grouped' && $rt($res['data']) === count($rows), 'row total ' . $rt($res['data']) . ' want ' . count($rows));

    // X-nested: STATUS then PI_LIST:dsemi, leaf for leaf
    $resN = apply_state_logic($rows, $base + array('groupBy' => 'STATUS,PI_LIST:dsemi'));
    $gotN = array();
    foreach ($groupsOf($resN) as $k => $g) { $p = explode(' > ', (string)$k, 2); $gotN[$p[0]][isset($p[1]) ? $p[1] : ''] = $ids($g); }
    $bad = array();
    foreach ($in['nested'] as $st => $w) { $bad = array_merge($bad, array_map(function ($x) use ($st) { return $st . ' > ' . $x; }, $cmpBands(isset($gotN[$st]) ? $gotN[$st] : array(), $w))); }
    if (count($gotN) !== count($in['nested'])) $bad[] = 'statuses got ' . S(array_keys($gotN)) . ' want ' . S(array_keys($in['nested']));
    ok('X-nested', !$bad, $bad ? implode(' | ', array_slice($bad, 0, 4)) : 'ok');
    ok('X-nesttotal', $resN['viewMode'] === 'grouped' && $rt($resN['data']) === count($rows) && !$hasTag($resN['data']), 'row total ' . $rt($resN['data']));

    // X-other: the top 2 and (Other) - each row of the dropped groups once
    $resO = apply_state_logic($rows, $base + array('groupBy' => 'PI_LIST:dsemi', 'groupLimit' => array('n' => 2, 'dir' => 'top', 'other' => true)));
    $labels = array_keys($in['bands']); $labels = array_map('strval', $labels);
    $kept = array_slice(array_values(array_filter(array_map('strval', array_keys($groupsOf($resO))), function ($k) { return $k !== '(Other)'; })), 0, 2);
    $want = array();
    foreach ($in['bands'] as $k => $v) { if (!in_array((string)$k, $kept, true)) foreach ($v as $id) $want[$id] = true; }
    $want = array_keys($want); sort($want);
    $gO = $groupsOf($resO); $gotO = isset($gO['(Other)']) ? $ids($gO['(Other)']) : array();
    ok('X-other', $resO['viewMode'] === 'grouped' && count($resO['data']) === 3 && $gotO === $want && !$hasTag($resO['data']), 'other ' . count($gotO) . ' rows, want ' . count($want) . ' distinct; kept ' . S($kept));

    // X-plain: a plain grouping is untouched - its row total is the sum of its groups
    $resP = apply_state_logic($rows, $base + array('groupBy' => 'STATUS'));
    $sum = 0; foreach ($resP['data'] as $g) $sum += count($g);
    ok('X-plain', count($resP['data']) === 3 && $sum === count($rows) && $rt($resP['data']) === $sum, 'groups ' . count($resP['data']) . ' rows ' . $sum);
    // xlsxfoot (2026-10-26): the scheduled XLSX outline sheet of a split grouping counts each row ONCE in its footer
    // and in a parent band's (N), as the screen's All groups bar and branch pills do - also after a recipient's filter
    // and a summary filter re-run the grouping; stale indexes are never used.
    if (!function_exists('penumbra_build_theme_styles') && $appDir && is_file($appDir . '/themes_config.php')) require $appDir . '/themes_config.php';
    if (function_exists('penumbra_build_theme_styles')) $GLOBALS['theme_styles'] = penumbra_build_theme_styles();
    $GLOBALS['total_exemptions'] = array();
    $xl = function ($res) {
        ZipArchive::$entries = array();
        try { @generate_xlsx_string($res, 'theme-default'); } catch (Throwable $e) { return array('', '', get_class($e) . ': ' . $e->getMessage()); }
        $e = ZipArchive::$entries;
        return array(isset($e['xl/worksheets/sheet1.xml']) ? $e['xl/worksheets/sheet1.xml'] : '', isset($e['xl/sharedStrings.xml']) ? $e['xl/sharedStrings.xml'] : '', '');
    };
    // the footer's AMT cell: the last row of the sheet, AMT's column from the rows' own column order
    $footOf = function ($sheet, $res) {
        $first = null;
        foreach ($res['data'] as $g) { foreach ($g as $r) { $first = $r; break 2; } }
        if (!$first) return null;
        $ci = array_search('AMT', array_keys($first), true);
        if ($ci === false || !preg_match_all('/<row r="(\d+)"[^>]*>(.*?)<\/row>/s', $sheet, $m)) return null;
        $n = end($m[1]); $last = end($m[2]);
        if (!preg_match('/<c r="' . chr(65 + $ci) . $n . '"[^>]*>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v>/', $last, $c)) return null;
        return (float)$c[1];
    };
    $sumIds = function ($res) { $t = array(); foreach ($res['data'] as $g) foreach ($g as $r) $t[$r['V_ID']] = (float)$r['AMT']; return round(array_sum($t), 2); };
    $listed = function ($res) { $t = 0; foreach ($res['data'] as $g) foreach ($g as $r) $t += (float)$r['AMT']; return round($t, 2); };
    $stX = $base + array('groupBy' => 'STATUS,PI_LIST:dsemi', 'columnSummaries' => array('AMT' => 'sum'));
    $resX = apply_state_logic($rows, $stX);
    list($shX, $ssX, $errX) = $xl($resX);
    $allAmt = 0; foreach ($rows as $r) $allAmt += (float)$r['AMT']; $allAmt = round($allAmt, 2);
    $fX = $footOf($shX, $resX);
    ok('X-xfoot', $fX !== null && abs($fX - $allAmt) < 0.01, 'footer ' . var_export($fX, true) . ' want ' . $allAmt . ' (as listed ' . $listed($resX) . ') ' . $errX);
    $nOpen = 0; foreach ($rows as $r) if ($r['STATUS'] === 'Open') $nOpen++;
    $bm = array(); preg_match('/Open   \((\d+)\)/', $ssX . $shX, $bm);
    ok('X-xband', isset($bm[1]) && (int)$bm[1] === $nOpen, 'Open band (' . (isset($bm[1]) ? $bm[1] : 'none') . ') want ' . $nOpen);
    // a recipient's filter re-runs the grouping on fewer rows (AMT > 1000 changes every group's rows)
    $apiX = array_merge($stX, $resX, array('rawData' => $rows));
    $fl = apply_search_filter_via_raw($apiX, 'AMT > 1000');
    list($shF, $ssF, $errF) = $xl($fl);
    $fF = $footOf($shF, $fl);
    $wantF = 0; foreach ($rows as $r) if ((float)$r['AMT'] > 1000) $wantF += (float)$r['AMT']; $wantF = round($wantF, 2);
    ok('X-xfilter', $fF !== null && abs($fF - $wantF) < 0.01, 'footer ' . var_export($fF, true) . ' want ' . $wantF . ' (as listed ' . $listed($fl) . ') ' . $errF);
    // ...and a summary filter drops whole groups after the same row filter
    $sums = array(); foreach ($fl['data'] as $k => $g) { $t = 0; foreach ($g as $r) $t += (float)$r['AMT']; $sums[] = $t; }
    sort($sums); $thr = floor($sums[(int)(count($sums) / 2)]);
    $stS = $stX + array('groupAgg' => array('column' => 'AMT', 'type' => 'sum'));
    $resS = apply_state_logic($rows, $stS);
    $apiS = array_merge($stS, $resS, array('rawData' => $rows));
    $fs = apply_search_filter_via_raw($apiS, 'AMT > 1000 AND Sum of AMT > ' . $thr);
    list($shS, $ssS, $errS) = $xl($fs);
    $fS = $footOf($shS, $fs);
    $wantS = $sumIds($fs);
    ok('X-xsumfilter', count($fs['data']) >= 2 && $listed($fs) > $wantS && $fS !== null && abs($fS - $wantS) < 0.01,
        'footer ' . var_export($fS, true) . ' want ' . $wantS . ' (as listed ' . $listed($fs) . ', ' . count($fs['data']) . ' groups) ' . $errS);
    // indexes taken from another map are never used: a group changed since gives none
    $mod = $resX; foreach ($mod['data'] as $k => $g) { array_shift($mod['data'][$k]); break; }
    ok('X-xstale', function_exists('penumbra_grouped_row_ids') && is_array(penumbra_grouped_row_ids($resX)) && penumbra_grouped_row_ids($mod) === null,
        function_exists('penumbra_grouped_row_ids') ? 'fresh ' . gettype(penumbra_grouped_row_ids($resX)) . ', changed ' . gettype(penumbra_grouped_row_ids($mod)) : 'penumbra_grouped_row_ids missing');

    // json (2026-10-26, jsontot): the nested @@JSON grouping - the same groups as the screen, each row once in the
    // total and in (Other), no row index left on a row
    if (!empty($in['jrows'])) {
        $jr = $in['jrows'];
        $jidx = range(0, count(array_keys($jr[0])) - 1);
        $jb = array('visibleColumns' => $jidx, 'columnOrder' => $jidx);
        $resJ = apply_state_logic($jr, $jb + array('groupBy' => 'SUB_NAME'));
        $gotJ = array(); foreach ($groupsOf($resJ) as $k => $g) $gotJ[(string)$k] = $ids($g);
        $bad = $cmpBands($gotJ, $in['jbands']);
        ok('X-jgroup', $resJ['viewMode'] === 'grouped' && !$bad, $resJ['viewMode'] . ' ' . ($bad ? implode(' | ', array_slice($bad, 0, 4)) : count($gotJ) . ' groups'));
        ok('X-jtotal', $rt($resJ['data']) === count($jr) && !$hasTag($resJ['data']), 'row total ' . $rt($resJ['data']) . ' want ' . count($jr) . ($hasTag($resJ['data']) ? '; a row still carries the row index key' : ''));
        $resJO = apply_state_logic($jr, $jb + array('groupBy' => 'SUB_NAME', 'groupLimit' => array('n' => 2, 'dir' => 'top', 'other' => true)));
        $gJO = $groupsOf($resJO);
        $keptJ = array_slice(array_values(array_filter(array_map('strval', array_keys($gJO)), function ($k) { return $k !== '(Other)'; })), 0, 2);
        $wantJ = array();
        foreach ($in['jbands'] as $k => $v) { if (!in_array((string)$k, $keptJ, true)) foreach ($v as $id) $wantJ[$id] = true; }
        $wantJ = array_keys($wantJ); sort($wantJ);
        $gotJO = isset($gJO['(Other)']) ? $ids($gJO['(Other)']) : array();
        ok('X-jother', count($gJO) === 3 && $gotJO === $wantJ && !$hasTag($resJO['data']), 'other ' . count($gotJO) . ' rows (' . count(isset($gJO['(Other)']) ? $gJO['(Other)'] : array()) . ' listed), want ' . count($wantJ) . ' distinct; kept ' . S($keptJ));
    }
    // X-search (splitviz, 2026-10-26): the list-item conditions the lists scenario's chips and clicks write, through the
    // server's own search engine (penumbra_search.php: the scheduler's, the ?json=1 lane's) - the rows the browser found
    if (!empty($in['searches']) && !empty($in['lrows']) && function_exists('php_apply_search_filter')) {
        $bad = array();
        foreach ($in['searches'] as $x) {
            $got = array();
            foreach (php_apply_search_filter($in['lrows'], 'standard', $x['q']) as $r) { $got[] = $r['V_ID']; }
            sort($got);
            $want = is_array($x['ids']) ? $x['ids'] : array();
            sort($want);
            if ($got !== $want || $x['ids'] === null) $bad[] = $x['q'] . ' -> ' . count($got) . ' want ' . ($x['ids'] === null ? 'none (no browser engine)' : count($want));
        }
        ok('X-search', !$bad, $bad ? implode(' | ', $bad) : count($in['searches']) . ' searches');
    } else {
        ok('X-search', false, 'no searches from the lists scenario' . (function_exists('php_apply_search_filter') ? '' : ' (php_apply_search_filter missing)'));
    }
} catch (Throwable $e) {
    ok('X-fatal', false, get_class($e) . ': ' . $e->getMessage() . ' @' . basename($e->getFile()) . ':' . $e->getLine());
}
echo 'RESULTS_JSON:' . json_encode(array('results' => $results), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
