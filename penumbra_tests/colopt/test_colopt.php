<?php
// colopt suite - PHP half (2026-10-12).
//   php test_colopt.php calc  <penumbra_calc.php> <fx.json>
//       the date formatter twin (_pnb_colfmt_date_value) on the browser module's own
//       answers (dates x patterns), and the calc engine (pnb_calc_evaluate) on the
//       browser's calculated cells as the page SHOWS them; clean_def; formula text escaping
//   php test_colopt.php pivot <mirror.php> <themes_config.php> <fx.json>
//       settings.aggFormat through generate_pivot_html (the emailed pivot, from a
//       side-effect-free mirror of schedule_runner.php): the page's pivot values, text for
//       text, and fixed cases worked out by hand
$mode = $argv[1];
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function show($v) { return $v === null ? 'null' : '"' . $v . '"'; }

if ($mode === 'calc') {
    require_once $argv[2];
    $fx = json_decode(file_get_contents($argv[3]), true);
    $par = isset($fx['parity']) ? $fx['parity'] : null;
    if (!$par || empty($par['dates'])) { ok(false, 'C-fixture', 'no browser answers (fparity did not run)'); }
    else {
        $bad = array(); $n = 0;
        foreach ($par['dates'] as $d) {
            $n++;
            $php = _pnb_colfmt_date_value($d[0], $d[1]);
            if ($php !== $d[2]) $bad[] = show($d[0]) . ' ' . $d[1] . ' js=' . show($d[2]) . ' php=' . show($php);
        }
        ok($n >= 200 && !$bad, 'C-dates', "$n cases, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 4)));
        $bad = array(); $n = 0;
        foreach ($par['calc'] as $c) {
            $n++;
            list($f, $fmt, $row, $js) = $c;
            $cc = pnb_calc_compile($f);
            $get = function ($k) use ($row) { return isset($row[$k]) ? $row[$k] : null; };
            $php = $cc['ok'] ? pnb_calc_evaluate($cc['ast'], $get, $fmt) : '';
            if ($php !== $js) $bad[] = "$f [$fmt] js=" . show($js) . ' php=' . show($php);
        }
        ok($n >= 40 && !$bad, 'C-calc', "$n cells, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 4)));
    }
    // a date pattern keeps its case; a bad one is 'text'; the others as before
    $d1 = pnb_calc_clean_def(array('name' => 'a', 'formula' => '1', 'format' => 'DATE:MMM D, YYYY'));
    $d2 = pnb_calc_clean_def(array('name' => 'a', 'formula' => '1', 'format' => 'date:MMM <D>'));
    $d3 = pnb_calc_clean_def(array('name' => 'a', 'formula' => '1', 'format' => 'CURRENCY'));
    $d4 = pnb_calc_clean_def(array('name' => 'a', 'formula' => '1', 'format' => 'nonsense'));
    ok($d1['format'] === 'date:MMM D, YYYY' && $d2['format'] === 'text' && $d3['format'] === 'currency' && $d4['format'] === 'number', 'C-cleanDef',
       $d1['format'] . ' / ' . $d2['format'] . ' / ' . $d3['format'] . ' / ' . $d4['format']);
    // formula text is escaped as the database's cells are
    $cc = pnb_calc_compile('"<b>&\'" & {A}');
    $v = pnb_calc_evaluate($cc['ast'], function ($k) { return 'R&amp;D'; }, 'text');
    ok($v === '&lt;b&gt;&amp;&#039;R&amp;D', 'C-escape', show($v));
    $cc = pnb_calc_compile('IF({A} = "O\'Brien", "yes", "no")');
    $v = pnb_calc_evaluate($cc['ast'], function ($k) { return 'O&#039;Brien'; }, 'text');
    ok($v === 'yes', 'C-quoteEquals', show($v));
    // a date format on a date result; the email totals none of them (the runner's rule)
    $cc = pnb_calc_compile('{D} + 30');
    $v = pnb_calc_evaluate($cc['ast'], function ($k) { return '10/5/2026'; }, 'date:dddd, MMMM Do YYYY');
    ok($v === 'Wednesday, November 4th 2026', 'C-dateResult', show($v));
}

if ($mode === 'pivot') {
    require_once $argv[2];
    require_once $argv[3];
    if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
    set_error_handler(function () { return true; }, E_ALL);
    $fx = json_decode(file_get_contents($argv[4]), true);
    $VALRX = '/^-?\$?[\d,]+(\.\d+)?%?$/';
    function texts_of($html, $rx) {
        preg_match_all('/<td\b[^>]*>(.*?)<\/td>/is', $html, $m);
        $out = array();
        foreach ($m[1] as $inner) {
            $t = trim(html_entity_decode(strip_tags($inner), ENT_QUOTES, 'UTF-8'));
            if (preg_match($rx, $t)) $out[] = $t;
        }
        sort($out, SORT_STRING);
        return $out;
    }
    foreach (array('pvfmt', 'pvfmt2', 'pvtie') as $sc) {
        $i = isset($fx[$sc]) ? $fx[$sc] : null;
        if (!$i || empty($i['rows'])) { ok(false, "V-$sc", 'no browser pivot (the scenario did not run)'); continue; }
        $html = generate_pivot_html($i['rows'], $i['settings'], 'theme-default', true);
        $php = texts_of($html, $VALRX);
        $js = $i['texts'];
        sort($js, SORT_STRING);
        $diff = array_merge(array_diff($js, $php), array_diff($php, $js));
        ok(count($js) > 20 && $php === $js, "V-$sc-sameValues", count($js) . ' js / ' . count($php) . ' php; differ: ' . implode(' ', array_slice(array_values(array_unique($diff)), 0, 8)));
    }
    // fixed cases, by hand: A = 1234.5 + 0.25 (2 rows), B = 10 (1 row); total 1244.75
    $rows = array(array('G' => 'A', 'V' => '1234.5'), array('G' => 'A', 'V' => '0.25'), array('G' => 'B', 'V' => '10'));
    function pv($rows, $agg, $fmt) {
        $s = array('rows' => array('G'), 'cols' => array(), 'vals' => 'V', 'agg' => $agg, 'aggLabels' => null, 'aggColOverrides' => array_fill(0, count($agg), 'V'),
                   'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc', 'aggFormat' => $fmt);
        return texts_of(generate_pivot_html($rows, $s, 'theme-default', true), '/^-?\$?[\d,]+(\.\d+)?%?$/');
    }
    $a = pv($rows, array('sum', 'count', 'avg'), array('currency:0', 'currency', 'percent:1'));
    ok(in_array('$1,235', $a, true) && in_array('$10', $a, true) && in_array('2', $a, true) && !in_array('$2', $a, true) && in_array('61,737.5%', $a, true), 'F-currency-count-percent', implode(' ', $a));
    $b = pv($rows, array('sum', 'count', 'avg'), array('number:2', null, 'auto:0'));
    ok(in_array('1,234.75', $b, true) && in_array('10.00', $b, true) && in_array('617', $b, true), 'F-number2-auto0', implode(' ', $b));
    $c = pv($rows, array('sum', 'pct_grand_total'), array(null, 'number:2'));
    ok(in_array('99.20%', $c, true) && in_array('0.80%', $c, true), 'F-pctDecimals', implode(' ', $c));
    $d = pv($rows, array('sum'), null);
    ok(in_array('1,234.75', $d, true) && !preg_grep('/\$/', $d), 'F-noneAsBefore', implode(' ', $d));
    // the fixed decimals' rounding: the page's own cases (fparity), answer for answer
    $dt = isset($fx['parity']['decText']) ? $fx['parity']['decText'] : null;
    if (!$dt) ok(false, 'F-decText', 'no browser cases');
    else {
        $bad = array();
        foreach ($dt as $c) { $p = pivot_dec_text($c[0], $c[1], $c[2]); if ($p !== $c[3]) $bad[] = json_encode($c) . ' php=' . $p; }
        ok(!$bad, 'F-decText', implode(' ; ', $bad));
    }
}
echo "TOTAL pass=$pass fail=$fail\n";
