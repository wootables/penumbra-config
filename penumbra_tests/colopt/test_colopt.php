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
    if (!empty($argv[5])) require_once $argv[5];   // (2026-10-20 c) the search engine the runner loads at its top
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
    // (2026-10-20 c) a pivot value's Highlight rules in the email: the cells each rule painted on
    // the page's body (pvhlseed) are the cells it paints in the emailed pivot, text for text (each
    // rule's style is one no other cell carries), and the PDF's pivot (isEmail off) has none
    $hi = isset($fx['pvhlseed']) ? $fx['pvhlseed'] : null;
    if (!$hi || empty($hi['rows'])) { ok(false, 'H-pvhlEmail', 'no browser pivot (pvhlseed did not run)'); ok(false, 'H-pvhlPdf', 'no browser pivot'); }
    else {
        $eh = generate_pivot_html($hi['rows'], $hi['settings'], 'theme-default', true);
        preg_match_all("/<td style='([^']*)'>(.*?)<\/td>/s", $eh, $em, PREG_SET_ORDER);
        $got = array('amber' => array(), 'red' => array(), 'under' => array(), 'blue' => array());
        foreach ($em as $c) {
            $t = trim(html_entity_decode(strip_tags($c[2]), ENT_QUOTES, 'UTF-8'));
            // what the cell SHOWS: the last declaration of each property wins, as in CSS
            $eff = array();
            foreach (explode(';', $c[1]) as $_d) {
                $_k = strpos($_d, ':');
                if ($_k === false) continue;
                $eff[strtolower(trim(substr($_d, 0, $_k)))] = strtolower(trim(substr($_d, $_k + 1)));
            }
            $bgc = isset($eff['background-color']) ? $eff['background-color'] : '';
            if ($bgc === '#fbe8a6') $got['amber'][] = $t;
            if (isset($eff['color']) && $eff['color'] === '#c62828') $got['red'][] = $t;
            if (isset($eff['text-decoration']) && strpos($eff['text-decoration'], 'underline') !== false) $got['under'][] = $t;
            if ($bgc === '#d6e5fa') $got['blue'][] = $t;
        }
        $bad = array();
        foreach ($got as $k => $list) {
            sort($list, SORT_STRING);
            $want = $hi[$k];
            sort($want, SORT_STRING);
            if ($list !== $want || !$want) $bad[] = "$k: page " . count($want) . ' email ' . count($list) . ' e.g. ' . implode(' ', array_slice(array_merge(array_diff($want, $list), array_diff($list, $want)), 0, 4));
        }
        ok(!$bad, 'H-pvhlEmail', implode(' ; ', $bad));
        $ph = generate_pivot_html($hi['rows'], $hi['settings'], 'theme-default', false);
        ok(strpos($eh, '#fbe8a6') !== false && strpos($ph, '#fbe8a6') === false && strpos($ph, '#d6e5fa') === false && strpos($ph, 'text-decoration: underline') === false,
           'H-pvhlPdf', 'email amber ' . (int)(strpos($eh, '#fbe8a6') !== false) . ' pdf amber ' . (int)(strpos($ph, '#fbe8a6') !== false));
    }
    // the fixed decimals' rounding: the page's own cases (fparity), answer for answer
    $dt = isset($fx['parity']['decText']) ? $fx['parity']['decText'] : null;
    if (!$dt) ok(false, 'F-decText', 'no browser cases');
    else {
        $bad = array();
        foreach ($dt as $c) { $p = pivot_dec_text($c[0], $c[1], $c[2]); if ($p !== $c[3]) $bad[] = json_encode($c) . ' php=' . $p; }
        ok(!$bad, 'F-decText', implode(' ; ', $bad));
    }
}
if ($mode === 'hl') {
    // (2026-10-20 b) the report's formats and highlight rules in the scheduled email:
    //   php test_colopt.php hl <mirror.php> <penumbra_calc.php> <themes_config.php> <fx.json> <penumbra_search.php>
    // the page's own answers (driver.js hrep: K.unitFix, K.whenFix, K.emailFix) against the
    // email's engines - the format twin, the CSS gate, the condition engine - and the email of
    // the hrep rows drawn by generate_report_html, cell for cell; the PDF's table (isEmail off)
    // none of it; a dark theme's tints; the grouped email; nothing left over between reports
    require_once $argv[3];
    require_once $argv[6];   // the search engine the runner loads at its top (pure functions)
    require_once $argv[2];
    require_once $argv[4];
    if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
    set_error_handler(function () { return true; }, E_ALL);
    $fx = json_decode(file_get_contents($argv[5]), true);
    $hr = isset($fx['hrep']) ? $fx['hrep'] : null;
    $need = array('penumbra_state_highlight_rules', 'penumbra_state_column_formats', 'penumbra_hl_clean_css', 'penumbra_hl_theme_fills',
                  'penumbra_num_text', '_pnb_colfmt_value', 'generate_report_html', 'parse_format_condition', 'evaluate_format_condition');
    $missing = array_values(array_filter($need, function ($f) { return !function_exists($f); }));
    $names = array('fmtParity', 'numParity', 'cssParity', 'whenParity', 'stateRules', 'emailPaints', 'emailFmt', 'emailFooter', 'pdfPlain', 'darkFill', 'groupedEmail', 'noLeak');
    if ($missing || !$hr || empty($hr['email']) || empty($hr['unit']) || empty($hr['when'])) {
        foreach ($names as $n) ok(false, $n, $missing ? 'missing: ' . implode(' ', $missing) : 'no browser fixture (hrep did not run)');
    } else {
        $u = $hr['unit'];
        $bad = array(); $n = 0;
        foreach ($u['fmt'] as $c) { $n++; $p = _pnb_colfmt_value($c[0], $c[1]); if ($p !== $c[2]) $bad[] = show($c[0]) . ' ' . $c[1] . ' js=' . show($c[2]) . ' php=' . show($p); }
        ok($n > 1500 && !$bad, 'fmtParity', "$n cases, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 6)));
        $bad = array(); $n = 0;
        foreach ($u['num'] as $c) { $n++; $t = penumbra_num_text((float)$c[0]); $p = _pnb_colfmt_value($t, $c[1]); if ($p !== $c[2]) $bad[] = json_encode($c[0]) . " ($t) " . $c[1] . ' js=' . show($c[2]) . ' php=' . show($p); }
        ok($n >= 90 && !$bad, 'numParity', "$n cases, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 6)));
        $bad = array(); $n = 0;
        foreach ($u['css'] as $c) { $n++; $p = penumbra_hl_clean_css($c[0]); $want = str_replace("'", '"', $c[1]); if ($p !== $want) $bad[] = show($c[0]) . ' js=' . show($want) . ' php=' . show($p); }
        ok($n >= 20 && !$bad, 'cssParity', "$n cases, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 6)));
        // the condition engine: each of Basic's forms (and a few typed ones) matches the same rows
        $all = $hr['rowsAll'];
        $cols = array_keys($all[0]);
        $shownCols = array_keys($hr['email']['rows'][0]);
        $bad = array(); $n = 0;
        foreach ($hr['when'] as $c) {
            $n++;
            list($w, $ids) = $c;
            if ($w === null) { $bad[] = 'a pick wrote no condition'; continue; }
            $p = $w === '' ? null : parse_format_condition($w, $cols);
            // a term naming no column tests the cells a row SHOWS (the page: its shown columns; the
            // email: its rows hold no others) - the email's columns, then
            $glob = false;
            foreach ((array)$p as $t) if (is_array($t) && isset($t['type']) && $t['type'] === 'global') $glob = true;
            $got = array();
            foreach ($all as $i => $r) {
                $rw = $glob ? array_intersect_key($r, array_flip($shownCols)) : $r;
                $rw['#'] = $i + 1;
                if ($w === '' || evaluate_format_condition($rw, $p)) $got[] = $r['V_ID'];
            }
            $js = $ids; sort($js); sort($got);
            if ($got !== $js) $bad[] = "[$w] js " . count($js) . ' php ' . count($got) . ' e.g. ' . implode(',', array_slice(array_merge(array_diff($js, $got), array_diff($got, $js)), 0, 3));
        }
        $sizes = array_map(function ($c) { return is_array($c[1]) ? count($c[1]) : -1; }, $hr['when']);
        ok($n >= 35 && !$bad && count(array_filter($sizes, function ($s) { return $s > 0 && $s < 300; })) >= 25, 'whenParity',
           "$n conditions, " . count($bad) . ' differ: ' . implode(' ; ', array_slice($bad, 0, 5)) . ' sizes ' . implode(',', $sizes));
        // STATE_DATA.columnHighlights -> format() rules: a column's bottom rule first, one with no
        // style it takes dropped, a name a condition cannot hold skipped, ten a column
        $st = array('columnHighlights' => array(
            'v_amount' => array(array('id' => 'a', 'w' => 'V_AMOUNT > 1', 'css' => 'color: red', 'row' => false),
                                array('id' => 'b', 'w' => '', 'css' => 'font-weight: bold', 'row' => true),
                                array('id' => 'c', 'w' => 'V_AMOUNT > 2', 'css' => 'width: 10px', 'row' => false)),
            'BAD{COL' => array(array('id' => 'd', 'w' => '', 'css' => 'color: red')),
            'V_X' => array_fill(0, 12, array('id' => 'e', 'w' => 'V_X > 1', 'css' => "font-family: 'A B'", 'row' => 'yes'))));
        $rr = penumbra_state_highlight_rules($st);
        ok(count($rr) === 12 && $rr[0]['type'] === 'row' && $rr[0]['targetColumn'] === null && $rr[0]['condition'] === null && $rr[0]['style'] === 'font-weight: bold'
           && $rr[1]['type'] === 'cell' && $rr[1]['targetColumn'] === 'V_AMOUNT' && $rr[1]['condition'] === 'V_AMOUNT > 1' && $rr[1]['style'] === 'color: red'
           && $rr[2]['type'] === 'cell' && $rr[2]['targetColumn'] === 'V_X' && $rr[11]['style'] === 'font-family: "A B"'
           && penumbra_state_highlight_rules(array('columnHighlights' => 'x')) === array() && penumbra_state_highlight_rules(null) === array(), 'stateRules', json_encode($rr));
        // the email of the hrep rows, as the scheduler draws it (its body: isEmail)
        $E = $hr['email'];
        $page = array();
        foreach ($E['page'] as $pg) $page[$pg['id']] = $pg;
        $GLOBALS['penumbra_column_summaries'] = array('V_AMOUNT' => 'sum');
        $GLOBALS['penumbra_highlight_rules'] = penumbra_state_highlight_rules($E['state']);
        $GLOBALS['penumbra_column_formats'] = penumbra_state_column_formats($E['state']);
        $emHtml = generate_report_html($E['rows'], 'standard', 'theme-default', 'Highlight rules in the email', false, '', true);
        $em = hl_email_rows($emHtml);
        if (getenv('PNB_EMAIL_OUT')) file_put_contents(getenv('PNB_EMAIL_OUT'), $emHtml);   // shots.py: the email as mailed
        $badP = array(); $badF = array(); $fills = 0;
        foreach ($em['body'] as $row) {
            $id = $row['text'][0];
            if (!isset($page[$id])) { $badP[] = "no page row $id"; continue; }
            $pg = $page[$id];
            $fill = strpos($row['style'][2], 'background-color: #fbe8a6') !== false;
            $fills += $fill ? 1 : 0;
            $strike = strpos($row['tr'], 'line-through') !== false && strpos($row['style'][4], 'line-through') !== false;
            $ital = strpos($row['style'][1], 'font-style: italic') !== false;
            if ($fill !== $pg['fill'] || $strike !== $pg['strike'] || $ital !== $pg['italic'])
                $badP[] = "$id fill " . (int)$fill . '/' . (int)$pg['fill'] . ' strike ' . (int)$strike . '/' . (int)$pg['strike'] . ' italic ' . (int)$ital . '/' . (int)$pg['italic'];
            if ($row['text'][2] !== $pg['amt']) $badF[] = "$id email " . show($row['text'][2]) . ' page ' . show($pg['amt']);
        }
        ok(count($em['body']) === 300 && $fills > 20 && $fills < 280 && !$badP, 'emailPaints', count($em['body']) . " rows, $fills filled, " . count($badP) . ' differ: ' . implode(' ; ', array_slice($badP, 0, 4)));
        ok(count($em['body']) === 300 && !$badF, 'emailFmt', count($badF) . ' differ: ' . implode(' ; ', array_slice($badF, 0, 4)));
        $foot = isset($em['foot'][2]) ? $em['foot'][2] : null;
        ok($foot !== null && preg_match('/^\$[\d,]+$/', $foot) && ($E['foot'] === null || $E['foot'] === $foot), 'emailFooter', 'email ' . show($foot) . ' page ' . show($E['foot']) . ' foot ' . json_encode($em['foot']));
        // the PDF's table (generate_report_html with isEmail off): none of it - not yet
        $pd = hl_email_rows($pdfHtml = generate_report_html($E['rows'], 'standard', 'theme-default', 'T', false, '', false));
        $raw = 0;
        foreach ($pd['body'] as $i => $row) if ($row['text'][2] === $E['rows'][$i]['V_AMOUNT']) $raw++;
        $pf = isset($pd['foot'][2]) ? $pd['foot'][2] : '';
        ok(count($pd['body']) === 300 && $raw === 300 && strpos($pdfHtml, '#fbe8a6') === false && strpos($pdfHtml, 'line-through') === false
           && strpos($pdfHtml, 'font-style: italic') === false && preg_match('/\.\d\d$/', $pf), 'pdfPlain', "raw $raw foot " . show($pf));
        // a dark theme's email: the dark tints (main.css body.is-dark), never the light one
        $dk = hl_email_rows($dkHtml = generate_report_html($E['rows'], 'standard', 'theme-dark-blue', 'Highlight rules in the email', false, '', true));
        if (getenv('PNB_EMAIL_OUT')) file_put_contents(getenv('PNB_EMAIL_OUT') . '.dark.html', $dkHtml);
        $dFill = 0;
        foreach ($dk['body'] as $row) if (strpos($row['style'][2], 'background-color: #4d3f12') !== false) $dFill++;
        ok($dFill === $fills && $fills > 0 && strpos($dkHtml, '#fbe8a6') === false, 'darkFill', "dark $dFill light $fills");
        // the grouped email: the same cells painted and formatted, group by group
        $g = array();
        foreach ($E['rows'] as $r) $g[$r['V_STATUS']][] = $r;
        $gh = generate_report_html($g, 'grouped', 'theme-default', 'T', false, '', true, null, '', '', '', null, array(), null);
        preg_match_all("/<tr style='([^']*)'>(.*?)<\/tr>/s", $gh, $trs, PREG_SET_ORDER);
        $gn = 0; $gBad = array();
        foreach ($trs as $tr) {
            preg_match_all("/<td style='([^']*)'>(.*?)<\/td>/s", $tr[2], $tds, PREG_SET_ORDER);
            if (count($tds) !== 5) continue;
            $id = trim(strip_tags($tds[0][2]));
            if (!isset($page[$id])) continue;
            $gn++;
            $fill = strpos($tds[2][1], 'background-color: #fbe8a6') !== false;
            $txt = trim(html_entity_decode(strip_tags($tds[2][2]), ENT_QUOTES, 'UTF-8'));
            if ($fill !== $page[$id]['fill'] || $txt !== $page[$id]['amt']) $gBad[] = "$id " . (int)$fill . ' ' . show($txt);
        }
        ok($gn === 300 && !$gBad, 'groupedEmail', "$gn rows, " . count($gBad) . ' differ: ' . implode(' ; ', array_slice($gBad, 0, 4)));
        // the long-lived runner: a report without rules gets none of the last one's
        apply_state_logic(array(), array('columnHighlights' => $E['state']['columnHighlights'], 'columnFormats' => $E['state']['columnFormats']));
        $a = count($GLOBALS['penumbra_highlight_rules']) . '/' . count($GLOBALS['penumbra_column_formats']);
        apply_state_logic(array(), array());
        ok($a === '3/1' && $GLOBALS['penumbra_highlight_rules'] === array() && $GLOBALS['penumbra_column_formats'] === array(), 'noLeak', $a);
    }
}
if ($mode === 'hlhd') {
    // (2026-10-24, hlhead) a report's HEADER rules in the scheduled email:
    //   php test_colopt.php hlhd <mirror.php> <penumbra_calc.php> <themes_config.php> <penumbra_search.php>
    // STATE_DATA.columnHighlights' header rules (hd) as format(header) rules: always; an aggregate decided over the
    // email's rows (as format(header) is); a row condition lit while a row of the email matches (the row rules' own
    // test); the header's properties only; a cell rule beside them still paints its cells; the grouped email's tables
    require_once $argv[3];
    require_once $argv[5];
    require_once $argv[2];
    require_once $argv[4];
    if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
    set_error_handler(function () { return true; }, E_ALL);
    $names = array('stateHd', 'stateAnyFlag', 'emailAlways', 'emailAggOn', 'emailAggOff', 'emailAnyOn', 'emailAnyOff', 'emailHeadCss', 'emailCellsStill', 'groupedHeads', 'emailFillShows', 'emailInk', 'emailBadFill', 'emailImpFill', 'pdfUntouched');
    $need = array('penumbra_state_highlight_rules', 'penumbra_hl_any_row_headers', 'generate_report_html');
    $missing = array_values(array_filter($need, function ($f) { return !function_exists($f); }));
    if ($missing) {
        foreach ($names as $n) ok(false, $n, 'missing: ' . implode(' ', $missing));
    } else {
        $sts = array('Open', 'Closed', 'Pending');
        $rows = array();
        for ($i = 1; $i <= 12; $i++) $rows[] = array('V_ID' => (string)$i, 'V_NAME' => $i === 3 ? 'Alpha Co' : 'Vendor ' . $i,
                                                   'V_AMOUNT' => (string)($i * 1000), 'V_STATUS' => $sts[$i % 3], 'V_DATE' => '1/' . $i . '/2026');
        $state = array('columnHighlights' => array(
            'V_ID' => array(array('id' => 'a', 'w' => '', 'css' => 'background-color: #fbe8a6', 'row' => false, 'hd' => true)),
            'V_NAME' => array(array('id' => 'b', 'w' => 'V_NAME = //Alpha Co//', 'css' => 'color: #c62828', 'row' => false, 'hd' => true)),
            'V_STATUS' => array(array('id' => 'c', 'w' => 'V_STATUS = //Nope//', 'css' => 'color: #2e7d32', 'row' => false, 'hd' => true),
                                array('id' => 'h', 'w' => '', 'css' => 'background-color: #fde68a !important', 'row' => false, 'hd' => true)),
            'V_AMOUNT' => array(array('id' => 'd', 'w' => 'sum(V_AMOUNT) > 1', 'css' => 'font-weight: bold; font-size: 20px', 'row' => false, 'hd' => true),
                                array('id' => 'e', 'w' => 'V_AMOUNT > 6000', 'css' => 'font-style: italic', 'row' => false)),
            'V_DATE' => array(array('id' => 'f', 'w' => 'sum(V_AMOUNT) < 0', 'css' => 'color: #1565c0', 'row' => false, 'hd' => true),
                              array('id' => 'g', 'w' => '', 'css' => 'background-color: lightyelow', 'row' => false, 'hd' => true))));
        $rr = penumbra_state_highlight_rules($state);
        $by = array();
        foreach ($rr as $r) $by[$r['style']] = $r;
        $a = isset($by['background-color: #fbe8a6']) ? $by['background-color: #fbe8a6'] : null;
        ok($a && $a['type'] === 'header' && $a['targetColumn'] === 'V_ID' && $a['condition'] === null
           && isset($by['font-style: italic']) && $by['font-style: italic']['type'] === 'cell' && $by['font-style: italic']['targetColumn'] === 'V_AMOUNT', 'stateHd', json_encode($rr));
        ok(!empty($by['color: #c62828']['hlAnyRow']) && !empty($by['color: #2e7d32']['hlAnyRow']) && empty($by['font-weight: bold; font-size: 20px']['hlAnyRow'])
           && empty($a['hlAnyRow']) && empty($by['font-style: italic']['hlAnyRow']), 'stateAnyFlag', json_encode($rr));
        $GLOBALS['penumbra_highlight_rules'] = $rr;
        $GLOBALS['penumbra_column_formats'] = array();
        $GLOBALS['penumbra_column_summaries'] = array();
        $html = generate_report_html($rows, 'standard', 'theme-default', 'Header rules in the email', false, '', true);
        $th = hd_ths($html);
        $g = function ($n) use ($th) { return isset($th[$n]) ? $th[$n] : null; };
        ok($g('V_ID') !== null && strpos($g('V_ID'), 'background-color: #fbe8a6') !== false, 'emailAlways', show($g('V_ID')));
        ok($g('V_AMOUNT') !== null && strpos($g('V_AMOUNT'), 'font-weight: bold') !== false, 'emailAggOn', show($g('V_AMOUNT')));
        ok($g('V_DATE') !== null && strpos($g('V_DATE'), '#1565c0') === false, 'emailAggOff', show($g('V_DATE')));
        ok($g('V_NAME') !== null && strpos($g('V_NAME'), 'color: #c62828') !== false, 'emailAnyOn', show($g('V_NAME')));
        ok($g('V_STATUS') !== null && strpos($g('V_STATUS'), '#2e7d32') === false, 'emailAnyOff', show($g('V_STATUS')));
        ok($g('V_AMOUNT') !== null && strpos($g('V_AMOUNT'), 'font-size: 20px') === false, 'emailHeadCss', show($g('V_AMOUNT')));
        ok(substr_count($html, 'font-style: italic') === 6, 'emailCellsStill', substr_count($html, 'font-style: italic'));
        // (the review) a fill turns the theme's gradient off; a highlight rule's fill with no text color of its own gives the
        // header the table's text color (dataFont) - one more than a header without a fill has
        $df = isset($theme_styles['theme-default']['dataFont']) ? (string)$theme_styles['theme-default']['dataFont'] : '';
        ok($g('V_ID') !== null && strpos($g('V_ID'), 'background-image: none;') !== false && strpos((string)$g('V_AMOUNT'), 'background-image') === false, 'emailFillShows', show($g('V_ID')));
        ok($df !== '' && $g('V_ID') !== null && substr_count($g('V_ID'), ' color: ' . $df . ';') === substr_count((string)$g('V_AMOUNT'), ' color: ' . $df . ';') + 1,
           'emailInk', show($g('V_ID')) . ' / ' . $df);
        // (the second review) a fill a client throws away (a typo) leaves the gradient on and gives no text color; a typed
        // !important is a color still
        ok($g('V_DATE') !== null && strpos($g('V_DATE'), 'background-image') === false
           && substr_count($g('V_DATE'), ' color: ' . $df . ';') === substr_count((string)$g('V_AMOUNT'), ' color: ' . $df . ';'), 'emailBadFill', show($g('V_DATE')));
        ok($g('V_STATUS') !== null && strpos($g('V_STATUS'), 'background-image: none;') !== false, 'emailImpFill', show($g('V_STATUS')));
        // the PDF's table (generate_report_html with $isEmail false - the per-recipient PDFs): a format(header) fill as it
        // was, no header extras; the same rule in the email takes the gradient off
        $fhd = array(array('type' => 'header', 'targetColumn' => 'V_ID', 'condition' => null, 'style' => 'background-color: #fbe8a6'));
        $pdfTh = hd_ths(generate_report_html($rows, 'standard', 'theme-default', 'T', false, '', false, null, '', '', '', null, array(), null, $fhd));
        $emTh = hd_ths(generate_report_html($rows, 'standard', 'theme-default', 'T', false, '', true, null, '', '', '', null, array(), null, $fhd));
        $pv = isset($pdfTh['V_ID']) ? $pdfTh['V_ID'] : null;
        $ev = isset($emTh['V_ID']) ? $emTh['V_ID'] : null;
        ok($pv !== null && strpos($pv, 'background-color: #fbe8a6') !== false && strpos($pv, 'background-image') === false
           && $ev !== null && strpos($ev, 'background-image: none;') !== false, 'pdfUntouched', show($pv) . ' / ' . show($ev));
        $grp = array();
        foreach ($rows as $r) $grp[$r['V_STATUS']][] = $r;
        $gh = generate_report_html($grp, 'grouped', 'theme-default', 'T', false, '', true, null, '', '', '', null, array(), null);
        preg_match_all("/<th style='([^']*)'>V_ID<\/th>/", $gh, $gm);
        $gLit = count(array_filter($gm[1], function ($s) { return strpos($s, 'background-color: #fbe8a6') !== false; }));
        ok(count($gm[1]) === 3 && $gLit === 3, 'groupedHeads', count($gm[1]) . ' headers, ' . $gLit . ' lit');
    }
}
/** The email's data table (the one headed V_ID): each body row's tr style, its cells' styles and
 *  texts; the footer's cells' texts (the summary badge and the label left out). */
function hl_email_rows($html) {
    $out = array('body' => array(), 'foot' => array());
    $at = strpos($html, '>V_ID</th>');
    if ($at === false) return $out;
    $t0 = strrpos(substr($html, 0, $at), '<table');
    $t1 = strpos($html, '</table>', $at);
    $tb = substr($html, $t0, $t1 - $t0);
    if (preg_match('/<tbody>(.*?)<\/tbody>/s', $tb, $m)) {
        preg_match_all("/<tr style='([^']*)'>(.*?)<\/tr>/s", $m[1], $trs, PREG_SET_ORDER);
        foreach ($trs as $tr) {
            preg_match_all("/<td style='([^']*)'>(.*?)<\/td>/s", $tr[2], $tds, PREG_SET_ORDER);
            $row = array('tr' => $tr[1], 'style' => array(), 'text' => array());
            foreach ($tds as $td) { $row['style'][] = $td[1]; $row['text'][] = trim(html_entity_decode(strip_tags($td[2]), ENT_QUOTES, 'UTF-8')); }
            $out['body'][] = $row;
        }
    }
    if (preg_match('/<tfoot>(.*?)<\/tfoot>/s', $tb, $f)) {
        preg_match_all('/<td style="[^"]*">(.*?)<\/td>/s', $f[1], $fts);
        foreach ($fts[1] as $t) $out['foot'][] = trim(html_entity_decode(strip_tags(preg_replace('/<span\b[^>]*>.*?<\/span>/s', '', $t)), ENT_QUOTES, 'UTF-8'));
    }
    return $out;
}
/** (2026-10-24, hlhead) The email's header cells: each column's first <th>'s style, by its name. */
function hd_ths($html) {
    $out = array();
    if (preg_match_all("/<th style='([^']*)'>([^<]*)<\/th>/", $html, $m, PREG_SET_ORDER)) {
        foreach ($m as $x) { $n = html_entity_decode($x[2], ENT_QUOTES, 'UTF-8'); if (!isset($out[$n])) $out[$n] = $x[1]; }
    }
    return $out;
}
echo "TOTAL pass=$pass fail=$fail\n";
