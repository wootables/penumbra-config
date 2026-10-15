<?php
/**
 * test_vischarts.php <moduleDir> <queue> <webroot> <outDir>
 *
 * The vis()-charts pipeline (penumbra_render_charts.php) end to end: unit tests
 * of the extractor / tokens / MIME builders / DOM parser, then a REAL render
 * through a worker that run.ps1 has started on <queue> (this workstation's
 * Edge), then the PDF plugin drawing the result. <moduleDir> holds the copies
 * under test (penumbra_render_charts.php, penumbra_render_client.php,
 * plugins/pdf_generator.php + plugins/lib/tcpdf); <webroot> is the live app
 * (its js/ is what the render page mirrors); <outDir> receives the images and
 * the PDF for eyeballing. Prints RESULTS_JSON:{...} as its last line.
 */
error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
$modDir  = isset($argv[1]) ? $argv[1] : '';
$queue   = isset($argv[2]) ? $argv[2] : '';
$webroot = isset($argv[3]) ? $argv[3] : '';
$outDir  = isset($argv[4]) ? $argv[4] : '';
if (!is_dir($outDir)) @mkdir($outDir, 0777, true);

$GLOBALS['LOGS'] = array();
function log_scheduler($m) { $GLOBALS['LOGS'][] = $m; }
$GLOBALS['PENUMBRA_RENDER_QUEUE_OVERRIDE'] = $queue;
$GLOBALS['PENUMBRA_VIS_WEBROOT_OVERRIDE'] = $webroot;
require $modDir . DIRECTORY_SEPARATOR . 'penumbra_render_charts.php';

$R = array();
function ok($name, $cond, $detail = '') {
    $GLOBALS['R'][] = array('name' => $name, 'pass' => (bool)$cond, 'detail' => is_string($detail) ? substr($detail, 0, 500) : substr(json_encode($detail), 0, 500));
}
function logs_from($n) { return implode(' | ', array_slice($GLOBALS['LOGS'], $n)); }
function png_dims($png) { if (strlen($png) < 24) return null; $d = unpack('Nw/Nh', substr($png, 16, 8)); return $d['w'] . 'x' . $d['h']; }
$TOK = function ($n) { return penumbra_vis_token($n); };

// ══════ U. units ══════
// U1 extraction keeps parens inside a quoted title and leaves the surrounding text
$s1 = "Hello vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Awards (by college)') tail";
$e1 = penumbra_vis_extract($s1);
ok('extract: one call -> token A, quoted parens kept inside the call', count($e1['calls']) === 1 && $e1['text'] === 'Hello ' . $TOK(0) . ' tail'
    && $e1['calls'][$TOK(0)] === "vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Awards (by college)')", $e1);
// U2 two calls in order, word boundary, case, unterminated
$s2 = "a VIS(pie, X, Y) b xvis(no) c vis(line, Q, R) d vis(bar";
$e2 = penumbra_vis_extract($s2);
ok('extract: two calls A,B in document order; xvis( is not a call; an unterminated call stays', count($e2['calls']) === 2
    && $e2['text'] === 'a ' . $TOK(0) . ' b xvis(no) c ' . $TOK(1) . ' d vis(bar'
    && $e2['calls'][$TOK(0)] === 'VIS(pie, X, Y)' && $e2['calls'][$TOK(1)] === 'vis(line, Q, R)', $e2);
// U3 nested inside another call
$e3 = penumbra_vis_extract("case(1 = 1, vis(pie, X, Y), '')");
ok('extract: a call nested in case() becomes a token in place', $e3['text'] === 'case(1 = 1, ' . $TOK(0) . ", '')" && count($e3['calls']) === 1, $e3);
// U4 escaped quote + double quotes
$e4 = penumbra_vis_extract("vis(bar, X, Y, none, sum, 10, 'it\\'s (a) title', false, true) and vis(bar, X, Y, none, sum, 10, \"two (2)\")");
ok('extract: an escaped quote and a double-quoted title with parens are scanned correctly', count($e4['calls']) === 2
    && $e4['calls'][$TOK(0)] === "vis(bar, X, Y, none, sum, 10, 'it\\'s (a) title', false, true)" && $e4['calls'][$TOK(1)] === 'vis(bar, X, Y, none, sum, 10, "two (2)")', $e4);
// U4b UNBALANCED parens inside quotes: the only case that tells a quote-aware scan
// from a plain paren counter (balanced parens in a title fool neither).
$e4b = penumbra_vis_extract("vis(bar, X, Y, none, sum, 10, 'smile :)') tail vis(bar, X, Y, none, sum, 10, \"open (\") end");
ok('extract: an unbalanced paren inside a quoted title does not end the call early (quote-aware scan)', count($e4b['calls']) === 2
    && $e4b['text'] === $TOK(0) . ' tail ' . $TOK(1) . ' end'
    && $e4b['calls'][$TOK(0)] === "vis(bar, X, Y, none, sum, 10, 'smile :)')" && $e4b['calls'][$TOK(1)] === 'vis(bar, X, Y, none, sum, 10, "open (")', $e4b);
// U5 no call at all
$e5 = penumbra_vis_extract('plain text, no charts, visible words like vision(');
ok('extract: text without a call is returned unchanged', $e5['text'] === 'plain text, no charts, visible words like vision(' && !$e5['calls'], $e5);
// U6 token names are letters only
ok('tokens: A, Z, AA, AB, ZZ, AAA', penumbra_vis_token_name(0) === 'A' && penumbra_vis_token_name(25) === 'Z' && penumbra_vis_token_name(26) === 'AA'
    && penumbra_vis_token_name(27) === 'AB' && penumbra_vis_token_name(701) === 'ZZ' && penumbra_vis_token_name(702) === 'AAA',
    penumbra_vis_token_name(0) . penumbra_vis_token_name(25) . penumbra_vis_token_name(26) . penumbra_vis_token_name(27) . penumbra_vis_token_name(701) . penumbra_vis_token_name(702));
// U7 apply + take
$imgA = array('cid' => 'pnbvis-abc@penumbra', 'png' => "\x89PNG\r\n\x1a\n" . str_repeat('x', 200), 'jpeg' => "\xFF\xD8" . str_repeat('y', 100), 'width' => 800, 'height' => 180, 'alt' => 'A "quoted" <title>');
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $imgA, $TOK(1) => null);
$a7 = penumbra_vis_apply_tokens('x ' . $TOK(0) . ' y ' . $TOK(1) . ' z');
ok('apply: a drawn token becomes an <img cid> with width/height/escaped alt; a dropped one vanishes',
    $a7 === 'x <img src="cid:pnbvis-abc@penumbra" width="800" height="180" alt="A &quot;quoted&quot; &lt;title&gt;" style="display:inline-block; vertical-align:top; margin:4px 0; max-width:100%; height:auto; border:0;"> y  z', $a7);
$t7 = penumbra_vis_take_images();
ok('take: returns the drawn images as a list and resets the store', count($t7) === 1 && $t7[0]['cid'] === 'pnbvis-abc@penumbra' && $GLOBALS['penumbra_vis_images'] === array(), $t7);
// U7b adjacent charts share a row (a table), packed by width against the 900px column
$mk = function ($cid, $w) { return array('cid' => $cid, 'png' => "\x89PNG\r\n\x1a\n" . str_repeat('x', 50), 'jpeg' => null, 'width' => $w, 'height' => 100, 'alt' => $cid); };
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $mk('a@p', 441), $TOK(1) => $mk('b@p', 441), $TOK(2) => null, $TOK(3) => $mk('d@p', 700), $TOK(4) => $mk('e@p', 150));
$row = penumbra_vis_apply_tokens('x ' . $TOK(0) . "\n" . $TOK(1) . ' y');
ok('pack: two adjacent 441px charts become ONE table row with two cells and block images',
    preg_match('#^x <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:4px 0;"><tr><td valign="top" width="441" style="padding:0 8px 0 0;"><img src="cid:a@p" width="441" height="100" alt="a@p" style="display:block; margin:0; max-width:100%; height:auto; border:0;"></td><td valign="top" width="441" style="padding:0;"><img src="cid:b@p"[^>]*></td></tr></table> y$#', $row) === 1, $row);
$row2 = penumbra_vis_apply_tokens($TOK(0) . "\n\n" . $TOK(2) . "\n" . $TOK(3) . ' ' . $TOK(4));
ok('pack: a dropped chart leaves the run; 441 + 700 do not fit one row, 700 + 150 do -> a single-cell row then a two-cell row',
    substr_count($row2, '<table ') === 2 && preg_match('#<td valign="top" width="441" style="padding:0;"><img src="cid:a@p"#', $row2) === 1
    && preg_match('#<td valign="top" width="700" style="padding:0 8px 0 0;"><img src="cid:d@p"[^>]*></td><td valign="top" width="150" style="padding:0;"><img src="cid:e@p"#', $row2) === 1, $row2);
$sep = penumbra_vis_apply_tokens($TOK(0) . ' and ' . $TOK(1));
ok('pack: charts with text between them stay inline images', substr_count($sep, '<table ') === 0 && substr_count($sep, '<img ') === 2 && strpos($sep, 'display:inline-block') !== false, $sep);
$GLOBALS['penumbra_vis_images'] = array();
ok('apply: text without tokens (and an empty store) is untouched', penumbra_vis_apply_tokens('no tokens here 1234') === 'no tokens here 1234', '');
// U8 inline parts
$imgB = array('cid' => "pnbvis-d\"e<f>\r\n@penumbra", 'png' => "\x89PNG\r\n\x1a\n" . str_repeat('q', 50), 'jpeg' => null, 'width' => 400, 'height' => 300, 'alt' => '');
$parts = penumbra_vis_inline_parts(array($imgA, $imgB, array('cid' => 'x', 'png' => ''), 'junk'));
ok('inline parts: one part per image with a PNG; headers name, Content-ID, inline disposition, base64 body',
    count($parts) === 2 && isset($parts['pnbvis-abc@penumbra']) && isset($parts['pnbvis-def@penumbra'])
    && strpos($parts['pnbvis-abc@penumbra'], "Content-Type: image/png;\r\n name=\"chart1.png\"\r\nContent-ID: <pnbvis-abc@penumbra>\r\nContent-Disposition: inline;\r\n filename=\"chart1.png\"\r\nContent-Transfer-Encoding: base64\r\n\r\n") === 0
    && strpos($parts['pnbvis-abc@penumbra'], chunk_split(base64_encode($imgA['png']), 76, "\r\n")) !== false
    && strpos($parts['pnbvis-def@penumbra'], 'name="chart2.png"') !== false, array_keys($parts));
// U9 html part
$legacy = "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n" . quoted_printable_encode('<p>hi</p>') . "\r\n";
ok('html part: with no images it is byte-for-byte the part the runner always wrote', penumbra_vis_html_part('<p>hi</p>', array()) === $legacy && penumbra_vis_html_part('<p>hi</p>', $parts) === $legacy, '');
$html9 = '<p>see <img src="cid:pnbvis-abc@penumbra"> only</p>';
$hp = penumbra_vis_html_part($html9, $parts);
$qp9 = quoted_printable_encode($html9);
ok('html part: a referenced image makes a multipart/related wrapper holding the HTML part and that image only',
    preg_match('/^Content-Type: multipart\/related;\r\n boundary="(----=_Rel_[0-9a-f]{32})"; type="text\/html"\r\n\r\n--\1\r\nContent-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n/', $hp, $m9)
    && strpos($hp, $qp9 . "\r\n--" . $m9[1] . "\r\nContent-Type: image/png;") !== false
    && substr_count($hp, 'Content-ID:') === 1 && strpos($hp, '<pnbvis-abc@penumbra>') !== false && strpos($hp, 'chart2.png') === false
    && substr($hp, -strlen("--" . $m9[1] . "--\r\n")) === "--" . $m9[1] . "--\r\n", $hp);
// U10 parse_dom
$d10 = '<html><body><pre id="out">RESULT_JSON:{&quot;charts&quot;:[{&quot;slot&quot;:&quot;s0&quot;,&quot;ok&quot;:true,&quot;w&quot;:800,&quot;h&quot;:180,&quot;png&quot;:&quot;AAAA&quot;}],&quot;pageErrors&quot;:[&quot;a &lt;b&gt; &amp; c&quot;]}</pre></body></html>';
$p10 = penumbra_vis_parse_dom($d10);
ok('parse: RESULT_JSON is read out of the dumped DOM with entities decoded', $p10['ok'] && count($p10['charts']) === 1 && $p10['charts'][0]['w'] === 800 && $p10['pageErrors'][0] === 'a <b> & c', $p10);
$p10b = penumbra_vis_parse_dom('<html><body><pre id="out">running</pre></body></html>');
$p10c = penumbra_vis_parse_dom('<html><body>nothing</body></html>');
$p10d = penumbra_vis_parse_dom('<pre id="out">RESULT_JSON:{"fatal":"render hook unavailable: x","pageErrors":["e1"]}</pre>');
ok('parse: an unfinished page, a missing block and a fatal each fail with their own message',
    !$p10b['ok'] && strpos($p10b['error'], 'did not finish') !== false && !$p10c['ok'] && strpos($p10c['error'], 'no result block') !== false
    && !$p10d['ok'] && $p10d['error'] === 'render hook unavailable: x' && $p10d['pageErrors'] === array('e1'), array($p10b['error'], $p10c['error'], $p10d['error']));
// U11 page html
$rows11 = array(array('college' => 'Eng', 'amount' => '$1,000.00', 'note' => '</script><b>'), array('college' => 'Sci', 'amount' => '$20.50', 'note' => ''));
$pg = penumbra_vis_page_html(array($TOK(0) => 'vis(bar, college, amount)', $TOK(1) => 'vis(pie, college, amount)'), $rows11, array('college', 'amount', 'note'));
ok('page: carries the rows (uppercase columns), the props, both slots in order and the render script',
    // (the rows expectation is built with json_encode: the JSON spells '<' as
    // a backslash-u escape, which a hand-written literal cannot carry reliably)
    is_string($pg) && strpos($pg, '"columns":["COLLEGE","AMOUNT","NOTE"]') !== false
    && strpos($pg, '"rows":' . json_encode(array(array('Eng', '$1,000.00', '</script><b>'), array('Sci', '$20.50', '')), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES)) !== false
    && strpos($pg, '</script><b>') === false
    && strpos($pg, '"props":{"1":{"isCurrency":false,"isNumeric":false,"isBoolean":false,"isDate":false},"2":{"isCurrency":true,"isNumeric":true,') !== false
    && strpos($pg, '"nameToIndex":{"COLLEGE":1,"AMOUNT":2,"NOTE":3}') !== false
    && strpos($pg, '"snippet":' . json_encode('<span class="pnb-vis-slot" data-slot="s0">vis(bar, college, amount)</span>' . "\n" . '<span class="pnb-vis-slot" data-slot="s1">vis(pie, college, amount)</span>', JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES)) !== false
    && strpos($pg, '<script src="js/main_render.js"></script>') !== false && strpos($pg, '<pre id="out">running</pre>') !== false
    && strpos($pg, '<link rel="stylesheet" href="css/main.css">') !== false && strpos($pg, '<body class="theme-default">') !== false && strpos($pg, '"customSorts":{}') !== false
    && substr_count($pg, '</script>') === 18, is_string($pg) ? substr($pg, strpos($pg, 'window.__PAGE'), 400) : 'false');
// U11b theme + custom sorts ride into the page; a bad theme name falls back
$pg2 = penumbra_vis_page_html(array($TOK(0) => 'vis(bar, month, amount)'), $rows11, array('college', 'amount', 'note'), array('theme' => 'theme-wolfpack', 'customSorts' => array('MONTH' => array('values' => array('Jul', 'Aug')))));
$pg3 = penumbra_vis_page_html(array(), $rows11, array('college'), array('theme' => 'theme-x y"><script>'));
ok('page: the theme class and the custom sort orders reach the page; an invalid theme name falls back to theme-default',
    strpos($pg2, '<body class="theme-wolfpack">') !== false && strpos($pg2, '"customSorts":{"MONTH":{"values":["Jul","Aug"]}}') !== false && strpos($pg2, '"theme":"theme-wolfpack"') !== false
    && strpos($pg3, '<body class="theme-default">') !== false && strpos($pg3, '<script>', strpos($pg3, '<body')) === strpos($pg3, '<script>', strpos($pg3, '<body')), array(substr($pg2, strpos($pg2, '<body'), 40), substr($pg3, strpos($pg3, '<body'), 40)));
// U12 pdf charts shape
$pc = penumbra_vis_pdf_charts(array($imgA, $imgB, 'junk'));
$gd = function_exists('imagecreatefrompng');
$imgP = $imgA; $imgP['pdfpng'] = "\x89PNG\r\n\x1a\n" . str_repeat('p', 60); $imgP['pdfjpeg'] = "\xFF\xD8" . str_repeat('j', 40);
$pcP = penumbra_vis_pdf_charts(array($imgP));
ok('pdf charts: the default-theme copies (pdfpng / pdfjpeg) win over the themed ones when the run made them',
    count($pcP) === 1 && $pcP[0]['data'] === ($gd ? $imgP['pdfpng'] : $imgP['pdfjpeg']), $pcP[0]['type']);
ok('pdf charts: PNG with GD / JPEG without (here: ' . ($gd ? 'GD' : 'no GD') . '), PNG when there is no JPEG, sizes and titles carried', count($pc) === 2
    && $pc[0]['type'] === ($gd ? 'PNG' : 'JPEG') && $pc[0]['data'] === ($gd ? $imgA['png'] : $imgA['jpeg']) && $pc[0]['width'] === 800 && $pc[0]['title'] === $imgA['alt']
    && $pc[1]['type'] === 'PNG' && $pc[1]['data'] === $imgB['png'] && $pc[1]['height'] === 300, $pc);
// U13 no worker: the calls are dropped with a log line and no render is attempted
$saveQ = $GLOBALS['PENUMBRA_RENDER_QUEUE_OVERRIDE'];
$emptyQ = $outDir . DIRECTORY_SEPARATOR . 'noworker'; @mkdir($emptyQ, 0777, true); @unlink($emptyQ . DIRECTORY_SEPARATOR . 'worker.heartbeat');
$GLOBALS['PENUMBRA_RENDER_QUEUE_OVERRIDE'] = $emptyQ;
$n13 = count($GLOBALS['LOGS']); $c13 = $GLOBALS['penumbra_vis_render_count'];
$r13 = penumbra_vis_render_snippet('pre vis(bar, X, Y) post', $rows11, array('college', 'amount', 'note'));
$a13 = penumbra_vis_apply_tokens($r13);
ok('no worker: the call is tokenised, logged as dropped (stale heartbeat), and vanishes on apply; no render counted',
    $r13 === 'pre ' . $TOK(0) . ' post' && $a13 === 'pre  post' && strpos(logs_from($n13), '1 vis() call dropped') !== false && strpos(logs_from($n13), 'not running') !== false
    && $GLOBALS['penumbra_vis_render_count'] === $c13 && penumbra_vis_take_images() === array(), logs_from($n13));
$GLOBALS['PENUMBRA_RENDER_QUEUE_OVERRIDE'] = $saveQ;
// U14 the cap
$saveCount = $GLOBALS['penumbra_vis_render_count'];
$GLOBALS['penumbra_vis_render_count'] = PENUMBRA_VIS_MAX_RENDERS;
$n14 = count($GLOBALS['LOGS']);
$r14 = penumbra_vis_render_snippet('vis(bar, X, Y)', $rows11, array('college'));
ok('cap: past the per-run render cap the call is dropped with a log line', $r14 === $TOK(0) && strpos(logs_from($n14), 'render cap') !== false && penumbra_vis_apply_tokens($r14) === '', logs_from($n14));
$GLOBALS['penumbra_vis_render_count'] = $saveCount;
penumbra_vis_take_images();

// ══════ E. the real thing ══════
$alive = penumbra_render_worker_alive();
ok('worker: heartbeat alive on the test queue', $alive, $queue);
$colleges = array('Eng', 'Sci', 'Ag', 'CHASS', 'Vet');
$rows = array();
for ($i = 0; $i < 40; $i++) {
    $rows[] = array('COLLEGE' => $colleges[$i % 5], 'FY' => (string)(2023 + ($i % 3)), 'AMOUNT' => '$' . number_format(1000 + $i * 137.5, 2), 'STATUS' => ($i % 4 === 0) ? 'Closed' : 'Active');
}
$cols = array('COLLEGE', 'FY', 'AMOUNT', 'STATUS');
// Chart 5 is the fycompprop shape that came back BLANK on 2026-09-29 19:57: a
// percentage width (the draw waits for the header width to settle), animate=true
// (arg 14) and a combo series list - the render page must neutralise the editor's
// live-edit re-render and finish every draw before it captures.
$combo = '[{"col":"AMOUNT","type":"bar","agg":"sum","color":"auto","filterExpression":"FY = 2025","label":"FY 2025","values":"none"},'
       . '{"col":"AMOUNT","type":"bar","agg":"sum","color":"auto","filterExpression":"FY = 2024","label":"FY 2024","values":"none"},'
       . '{"col":"AMOUNT","type":"line","agg":"running_total","color":"auto","filterExpression":"FY = 2025","label":"FY 2025 YTD","values":"none"}]';
$snippet = "<b>Header</b> vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Awards (by college)', false, true) middle "
         . "vis(doughnut, STATUS, none, none, count, 10, 'Status share', true, true, 400, 300)\n"
         . "vis(line, FY, AMOUNT, COLLEGE, sum, 10, 'Trend', true, false, 700, 240) and vis(nosuchtype, COLLEGE, AMOUNT, none, sum, 10, 'Broken') end.\n"
         . "vis('combo', 'COLLEGE', 'none', 'none', 'sum', 12, 'Combo at 49%', true, true, '49%', 320, 'top', 'auto', true, false, false, 'top', 'label', 'asc', 'default', false, 'Bars and a running line', '', '', false, false, false, false, '', '', '" . $combo . "')";
$n0 = count($GLOBALS['LOGS']);
$t0 = microtime(true);
$text = penumbra_vis_render_snippet($snippet, $rows, $cols);
$ms = (int)round((microtime(true) - $t0) * 1000);
$store = $GLOBALS['penumbra_vis_images'];
$drawn = array(); foreach ($store as $tok => $img) { if (is_array($img)) $drawn[$tok] = $img; }
ok('render: every vis() became a token and the text kept its prose', $text === "<b>Header</b> " . $TOK(0) . " middle " . $TOK(1) . "\n" . $TOK(2) . " and " . $TOK(3) . " end.\n" . $TOK(4), $text);
ok('render: the four well-formed charts came back as images (' . $ms . ' ms)', isset($drawn[$TOK(0)]) && isset($drawn[$TOK(1)]) && isset($drawn[$TOK(2)]) && isset($drawn[$TOK(4)]), logs_from($n0));
ok('render: the log says how many were drawn', preg_match('/rendered [45] of 5 vis\(\) calls in \d+ ms/', logs_from($n0)) === 1, logs_from($n0));
foreach (array(0 => array(800, 180, 'Awards (by college)'), 1 => array(400, 300, 'Status share'), 2 => array(700, 240, 'Trend')) as $k => $exp) {
    $img = isset($drawn[$TOK($k)]) ? $drawn[$TOK($k)] : null;
    ok("render: chart " . ($k + 1) . " is {$exp[0]}x{$exp[1]} CSS px, a 2x PNG, a JPEG copy, titled '{$exp[2]}'",
        $img && $img['width'] === $exp[0] && $img['height'] === $exp[1] && png_dims($img['png']) === ($exp[0] * 2) . 'x' . ($exp[1] * 2)
        && substr($img['jpeg'], 0, 2) === "\xFF\xD8" && strlen($img['png']) > 3000 && $img['title'] === $exp[2] && preg_match('/^pnbvis-[0-9a-f]{12}@penumbra$/', $img['cid']),
        $img ? array('w' => $img['width'], 'h' => $img['height'], 'png' => png_dims($img['png']), 'pngBytes' => strlen($img['png']), 'jpegBytes' => strlen((string)$img['jpeg']), 'title' => isset($img['title']) ? $img['title'] : null) : 'missing');
    // WCAG 1.1.1 (2026-10-15): the alt describes the chart (type, title, counts), not the title alone.
    ok("render: chart " . ($k + 1) . " alt names its type, its title and its counts",
        $img && preg_match('/^[A-Z][a-z ]* chart: ' . preg_quote($exp[2], '/') . '\. \d+ (data series, \d+ categories|rows)\.$/', $img['alt']) === 1,
        $img ? $img['alt'] : 'missing');
    if ($img) { file_put_contents($outDir . DIRECTORY_SEPARATOR . 'chart' . ($k + 1) . '.png', $img['png']); if ($img['jpeg']) file_put_contents($outDir . DIRECTORY_SEPARATOR . 'chart' . ($k + 1) . '.jpg', $img['jpeg']); }
}
// A drawn chart is never a tiny PNG: the blank canvases of 2026-09-29 19:57 came
// back as ~2 KB each (a 441x320 canvas at 2x with nothing on it).
$c5 = isset($drawn[$TOK(4)]) ? $drawn[$TOK(4)] : null;
ok('render: the 49% combo with animate=true is drawn, 441x320 CSS px, and its PNG is a real picture (> 15 KB, not a blank canvas)',
    $c5 && $c5['width'] === 441 && $c5['height'] === 320 && strlen($c5['png']) > 15000 && png_dims($c5['png']) === '882x640',
    $c5 ? array('w' => $c5['width'], 'h' => $c5['height'], 'pngBytes' => strlen($c5['png']), 'dims' => png_dims($c5['png'])) : ('missing: ' . logs_from($n0)));
if ($c5) { file_put_contents($outDir . DIRECTORY_SEPARATOR . 'chart5_combo49.png', $c5['png']); }
$broken = isset($store[$TOK(3)]) ? $store[$TOK(3)] : 'absent';
ok('render: the unknown chart type is either dropped with a logged reason or drawn - never a leftover token', array_key_exists($TOK(3), $store) && (is_array($broken) || strpos(logs_from($n0), 'chart 4 not drawn') !== false), is_array($broken) ? 'drawn ' . $broken['width'] . 'x' . $broken['height'] : logs_from($n0));
$applied = penumbra_vis_apply_tokens($text);
ok('apply: the body now carries an <img cid> per drawn chart and no token', strpos($applied, '__PENUMBRA_VISIMG_') === false && substr_count($applied, '<img src="cid:pnbvis-') === count($drawn)
    && strpos($applied, '<img src="cid:' . $drawn[$TOK(0)]['cid'] . '" width="800" height="180" alt="' . htmlspecialchars($drawn[$TOK(0)]['alt'], ENT_QUOTES) . '"') !== false, $applied);
$images = penumbra_vis_take_images();
ok('take: the images list matches the drawn charts and the store is empty again', count($images) === count($drawn) && $GLOBALS['penumbra_vis_images'] === array(), count($images));
$inline = penumbra_vis_inline_parts($images);
$body = penumbra_vis_html_part('<html><body>' . $applied . '</body></html>', $inline);
ok('mime: the related wrapper carries exactly the drawn images', substr_count($body, 'Content-ID: <pnbvis-') === count($images) && strpos($body, 'multipart/related') === 0 + strpos($body, 'multipart/related'), substr($body, 0, 300));
$half = penumbra_vis_html_part('<html><body><img src="cid:' . $images[0]['cid'] . '"></body></html>', $inline);
ok('mime: a body that lost all but one chart (truncation) ships only that one', substr_count($half, 'Content-ID: <pnbvis-') === 1, '');
file_put_contents($outDir . DIRECTORY_SEPARATOR . 'email_body.txt', $body);

// ══════ F. the real fycompprop shape (blank in the 19:57 send of 2026-09-29) ══════
// Its 27 rows (as the scheduler hands them, currency strings and all) and its two
// vis() calls verbatim: combo, '49%' wide, animate=true, six series with per-series
// filters and {FY_CURRENT}-style labels, palette mono.
$fyCsv = @file_get_contents(dirname(__FILE__) . DIRECTORY_SEPARATOR . 'fixture_fycomp.csv');
$fyLines = $fyCsv ? preg_split('/\r?\n/', trim($fyCsv)) : array();
$fyCols = $fyLines ? explode('|', array_shift($fyLines)) : array();
$fyRows = array();
foreach ($fyLines as $ln) { if ($ln === '') continue; $v = explode('|', $ln); $r = array(); foreach ($fyCols as $ci => $cn) { $r[$cn] = isset($v[$ci]) ? $v[$ci] : ''; } $fyRows[] = $r; }
ok('fycomp fixture: 27 rows x 11 columns loaded', count($fyRows) === 27 && count($fyCols) === 11, count($fyRows) . 'x' . count($fyCols));
$fySeries = function ($col) {
    return '[{"col":"' . $col . '","type":"bar","agg":"sum","color":"auto","filterExpression":"FY_AGO = 0","label":"{FY_CURRENT}","values":"none"},'
         . '{"col":"' . $col . '","type":"bar","agg":"sum","color":"auto","filterExpression":"FY_AGO = 1","label":"{FY_PRIOR}","values":"none"},'
         . '{"col":"' . $col . '","type":"bar","agg":"sum","color":"auto","filterExpression":"FY_AGO = 2","label":"{FY_PRIOR2}","values":"none"},'
         . '{"col":"' . $col . '","type":"line","agg":"running_total","color":"auto","filterExpression":"FY_AGO = 0","label":"{FY_CURRENT} YTD","values":"none"},'
         . '{"col":"' . $col . '","type":"line","agg":"running_total","color":"auto","filterExpression":"FY_AGO = 1","label":"{FY_PRIOR} YTD","values":"none"},'
         . '{"col":"' . $col . '","type":"line","agg":"running_total","color":"auto","filterExpression":"FY_AGO = 2","label":"{FY_PRIOR2} YTD","values":"none"}]';
};
$fyCall = function ($col, $title) use ($fySeries) {
    return "vis('combo', 'MONTH', 'none', 'none', 'sum', 12, '" . $title . "', true, true, '49%', 320, 'top', 'auto', true, false, false, 'top', 'label', 'asc', 'default', false, 'Bars: each month. Lines: fiscal year to date.', '', '', false, false, false, false, '', '', '"
         . $fySeries($col) . "', 'none', false, false, '', '', '', '', '', false, '{\"palette\":\"mono\"}')";
};
$fySnippet = "<div class=\"fycomp-note\">Proposals logged through September 25, 2026.</div>\n\n" . $fyCall('AMOUNT', 'Total proposed by month') . "\n" . $fyCall('PROPOSALS', 'Number of proposals by month');
$nF = count($GLOBALS['LOGS']);
// The report's own theme (Wolfpack, brand #990000) and its saved custom sort
// order for MONTH, exactly as the runner hands them over from the report state.
$fyMonths = array('Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun');
$fyText = penumbra_vis_render_snippet($fySnippet, $fyRows, $fyCols, array('theme' => 'theme-wolfpack', 'pdfCharts' => true, 'customSortOrders' => array('MONTH' => array('values' => $fyMonths))));
$fyStore = $GLOBALS['penumbra_vis_images'];
$fyDrawn = array(); foreach ($fyStore as $tok => $img) { if (is_array($img)) $fyDrawn[$tok] = $img; }
ok('fycomp: both combo charts come back drawn (' . logs_from($nF) . ')', count($fyDrawn) === 2, logs_from($nF));
$fy1 = isset($fyDrawn[$TOK(0)]) ? $fyDrawn[$TOK(0)] : null;
// The mono palette is a fixed NC State ramp, so its colours do not move with the
// theme; the PDF copy is checked for presence here and for its colours on the
// automatic palette below.
ok('fycomp: with a PDF attached the charts are drawn a second time in the default theme (pdfpng present, log line)',
    $fy1 && !empty($fy1['pdfpng']) && substr($fy1['pdfpng'], 0, 8) === "\x89PNG\r\n\x1a\n" && strlen($fy1['pdfpng']) > 15000
    && preg_match('/PDF copies drawn in the default theme \(2 of 2\) in \d+ ms/', logs_from($nF)) === 1,
    $fy1 ? array('pdfBytes' => strlen((string)(isset($fy1['pdfpng']) ? $fy1['pdfpng'] : '')), 'log' => logs_from($nF)) : 'missing');
if ($fy1 && !empty($fy1['pdfpng'])) { file_put_contents($outDir . DIRECTORY_SEPARATOR . 'fycomp1_pdfcopy.png', $fy1['pdfpng']); }
$fyPdf = penumbra_vis_pdf_charts(array_values($fyDrawn));
ok('fycomp: the PDF hand-off carries the default-theme copies', count($fyPdf) === 2 && $fy1 && ($fyPdf[0]['data'] === ($gd ? $fy1['pdfpng'] : $fy1['pdfjpeg'])), count($fyPdf));
// The browser draws these with labels Jul..Jun and a first bar series bordered
// rgba(107, 0, 0, 1) (read off the live report 2026-09-29 20:30): same code,
// same theme, same sort order -> the same values here.
ok('fycomp: the months follow the saved custom sort order (Jul .. Jun), as on screen', $fy1 && $fy1['labels'] === $fyMonths, $fy1 ? $fy1['labels'] : 'missing');
ok('fycomp: the mono palette derives from the Wolfpack brand colour, as on screen (first bar series rgba(107, 0, 0, 1))', $fy1 && isset($fy1['colors'][0]) && $fy1['colors'][0] === 'rgba(107, 0, 0, 1)', $fy1 ? $fy1['colors'] : 'missing');
$k = 1;
foreach (array($TOK(0) => 'Total proposed by month', $TOK(1) => 'Number of proposals by month') as $tok => $title) {
    $img = isset($fyDrawn[$tok]) ? $fyDrawn[$tok] : null;
    ok("fycomp: chart $k is 441x320 CSS px, a 2x PNG that is a real picture (> 15 KB), titled '$title'",
        $img && $img['width'] === 441 && $img['height'] === 320 && png_dims($img['png']) === '882x640' && strlen($img['png']) > 15000 && $img['title'] === $title && strpos($img['alt'], 'chart: ' . $title . '.') !== false,
        $img ? array('w' => $img['width'], 'h' => $img['height'], 'dims' => png_dims($img['png']), 'pngBytes' => strlen($img['png']), 'alt' => $img['alt']) : 'missing');
    if ($img) { file_put_contents($outDir . DIRECTORY_SEPARATOR . 'fycomp' . $k . '.png', $img['png']); }
    $k++;
}
$fyApplied = penumbra_vis_apply_tokens($fyText);
ok('fycomp: the prose survives and the two adjacent 49% charts share ONE table row, side by side as in the Dashboard layout',
    strpos($fyApplied, 'Proposals logged through') !== false && substr_count($fyApplied, '<img src="cid:') === count($fyDrawn) && strpos($fyApplied, '__PENUMBRA_VISIMG_') === false
    && substr_count($fyApplied, '<table role="presentation"') === 1 && substr_count($fyApplied, '<td valign="top" width="441"') === 2, substr($fyApplied, 0, 400));
penumbra_vis_take_images();
// The automatic palette DOES derive from the theme's brand colour: the synthetic
// bar chart under Wolfpack must differ from the plain default render above, and
// its PDF copy must equal that default render. (Runs after the fycomp
// substitution above: a render resets the image store.)
$defaultBarColor = (isset($drawn[$TOK(0)]['colors'][0])) ? $drawn[$TOK(0)]['colors'][0] : null;
$nT = count($GLOBALS['LOGS']);
$thText = penumbra_vis_render_snippet($snippet, $rows, $cols, array('theme' => 'theme-wolfpack', 'pdfCharts' => true));
$thStore = $GLOBALS['penumbra_vis_images'];
$th1 = (isset($thStore[$TOK(0)]) && is_array($thStore[$TOK(0)])) ? $thStore[$TOK(0)] : null;
ok('theme: on the automatic palette the Wolfpack render colours the bar from its brand, unlike the default render (' . $defaultBarColor . ')',
    $th1 && $defaultBarColor && isset($th1['colors'][0]) && $th1['colors'][0] !== $defaultBarColor && preg_match('/^(rgba?\(|#)/', $th1['colors'][0]) === 1,
    $th1 ? $th1['colors'] : ('missing: ' . logs_from($nT)));
ok('theme: the PDF copy of that chart is drawn in the default theme (its bar colour equals the default render)',
    $th1 && !empty($th1['pdfpng']) && isset($th1['pdfcolors'][0]) && $th1['pdfcolors'][0] === $defaultBarColor,
    $th1 ? array('pdfcolors' => isset($th1['pdfcolors']) ? $th1['pdfcolors'] : null, 'default' => $defaultBarColor) : 'missing');
if ($th1 && !empty($th1['png'])) { file_put_contents($outDir . DIRECTORY_SEPARATOR . 'chart1_wolfpack.png', $th1['png']); }
penumbra_vis_take_images();

// ══════ G. the email header builder, lifted out of the runner (run.ps1 extracts it) ══════
// generate_report_html() puts the snippet in the header's right-hand column, or,
// under the Dashboard header layout, in a full-width row under the header text.
$mirror = dirname(__FILE__) . DIRECTORY_SEPARATOR . 'runner_mirror.php';
if (is_file($mirror)) {
    $themesCfg = $webroot . DIRECTORY_SEPARATOR . 'themes_config.php';
    if (is_file($themesCfg)) { require_once $themesCfg; }
    require_once $mirror;
    if (function_exists('generate_report_html')) {
        $hdrRows = array(array('COLLEGE' => 'Eng', 'AMOUNT' => '1'));
        $snip = '<img src="cid:one@p" width="441" height="320">';
        $GLOBALS['penumbra_snippet_layout'] = '';
        $hDef = penumbra_vis_call_header($hdrRows, $snip);
        $GLOBALS['penumbra_snippet_layout'] = 'dashboard';
        $hDash = penumbra_vis_call_header($hdrRows, $snip);
        $GLOBALS['penumbra_snippet_layout'] = '';
        ok('header: default layout keeps the snippet in the right-hand column of the first row',
            is_string($hDef) && preg_match('#<td valign=\'top\' align=\'right\' style=\'padding:15px 15px 15px 0; white-space:nowrap;[^>]*>' . preg_quote($snip, '#') . '</td>\s*</tr>\s*</table>#', $hDef) === 1
            && strpos($hDef, "rowspan='2'") === false, is_string($hDef) ? substr($hDef, strpos($hDef, '<table'), 700) : $hDef);
        ok('header: Dashboard layout gives the snippet a full-width row under the header text, the accent stripe spanning both rows',
            is_string($hDash) && preg_match('#<td rowspan=\'2\' style=\'width:5px;#', $hDash) === 1 && strpos($hDash, "align='right'") === false
            && preg_match('#</td>\s*</tr>\s*<tr><td valign=\'top\' style=\'padding:0 15px 15px 15px; font-size:14px; font-weight:bold; color:[^\']*\'>' . preg_quote($snip, '#') . '</td></tr>\s*</table>#', $hDash) === 1,
            is_string($hDash) ? substr($hDash, strpos($hDash, '<table'), 900) : $hDash);
    } else {
        ok('header: generate_report_html lifted from the runner', false, 'not in the mirror');
    }
} else {
    ok('header: runner mirror present (run the suite through run.ps1)', false, $mirror);
}
function penumbra_vis_call_header($rows, $snip) {
    try {
        return generate_report_html($rows, 'standard', 'theme-wolfpack', 'Header test', true, 'http://example.test/?id=x', true, null, '', '', '', null, array(), null, array(), array(), $snip, '', '', null);
    } catch (\Throwable $e) { return 'THREW: ' . $e->getMessage(); }
}

// ══════ L. which page of the live report is each chart (2026-10-06) ══════
// The email's "Open to full view" link is ?fullscreen=true&fspages=N. A number that is wrong by one opens
// ANOTHER chart, so penumbra_vis_live_plan() only numbers what it is sure of. Every expectation in L1 was
// read off the app's own engine: section O renders the same snippets through main_render.js and compares.
$LPcases = array(
    'plain'        => "A vis(bar,X,Y) B vis(pie,X,Y) C",
    'slide'        => "vis(bar,X,Y) slide(vis(pie,X,Y)) vis(line,X,Y)",
    'slideText'    => "slide('hello') vis(pie,X,Y)",
    'web'          => "web(vis(bar,X,Y)) vis(pie,X,Y)",
    'webSlide'     => "web(slide(vis(bar,X,Y))) vis(pie,X,Y)",
    'noweb'        => "noweb(vis(bar,X,Y)) vis(pie,X,Y)",
    'mix'          => "web(vis(bar,X,Y)) noweb(vis(line,X,Y)) vis(pie,X,Y)",
    'action'       => "action(infobox, Open, \"raw|vis(bar,X,Y)\") vis(pie,X,Y)",
    'case'         => "case(1 = 1, vis(bar,X,Y), '') vis(pie,X,Y)",
    'boundary'     => "xvis(bar,X,Y) 2vis(bar,X,Y) VIS(pie,X,Y)",
    'quoted'       => "vis(bar, X, Y, none, sum, 10, 'smile :)') vis(pie,X,Y)",
    'prose'        => "Totals(FY24) and (see below) vis(pie,X,Y)",
    'unterminated' => "vis(bar vis(pie,X,Y)",
    'none'         => "plain text, no charts, words like vision(",
);
$LPplan = array();
foreach ($LPcases as $lk => $ls) { $LPplan[$lk] = penumbra_vis_live_plan($ls); }
ok('plan: two plain charts are pages 1 and 2, certain, calls kept verbatim',
    $LPplan['plain']['pages'] === array(1, 2) && $LPplan['plain']['certain'] === true && $LPplan['plain']['live'] === 2
    && $LPplan['plain']['calls'] === array('vis(bar,X,Y)', 'vis(pie,X,Y)'), $LPplan['plain']);
ok('plan: a slide() is a page of its own and the chart inside it belongs to the slide (1, 0, 3)',
    $LPplan['slide']['pages'] === array(1, 0, 3) && $LPplan['slide']['live'] === 3 && count($LPplan['slide']['calls']) === 3, $LPplan['slide']);
ok('plan: a slide with no chart still takes a page (the chart after it is page 2)', $LPplan['slideText']['pages'] === array(2), $LPplan['slideText']);
ok('plan: a chart in web() is a page on screen but leaves the email (the email chart is page 2 of 2)',
    $LPplan['web']['pages'] === array(2) && $LPplan['web']['live'] === 2 && count($LPplan['web']['calls']) === 1, $LPplan['web']);
ok('plan: a slide in web() is a page on screen too', $LPplan['webSlide']['pages'] === array(2) && $LPplan['webSlide']['live'] === 2, $LPplan['webSlide']);
ok('plan: noweb() is transparent - its chart is page 1 and the next one page 2 (hidden by CSS, still a carousel page)',
    $LPplan['noweb']['pages'] === array(1, 2) && $LPplan['noweb']['certain'] === true, $LPplan['noweb']);
ok('plan: web chart (page 1, not mailed) + noweb chart + plain chart -> the email charts are pages 2 and 3',
    $LPplan['mix']['pages'] === array(2, 3) && $LPplan['mix']['live'] === 3, $LPplan['mix']);
ok('plan: a chart in an action() argument has no page of its own and does not move the next one (0, 1)',
    $LPplan['action']['pages'] === array(0, 1) && $LPplan['action']['live'] === 1 && count($LPplan['action']['calls']) === 2, $LPplan['action']);
ok('plan: a chart inside case() makes the plan uncertain (its branch may or may not exist on screen)', $LPplan['case']['certain'] === false, $LPplan['case']);
ok('plan: word boundary and case follow the engine (xvis( and 2vis( are not calls, VIS( is)',
    $LPplan['boundary']['calls'] === array('VIS(pie,X,Y)') && $LPplan['boundary']['pages'] === array(1), $LPplan['boundary']);
ok('plan: an unbalanced paren inside a quoted title does not end the call, and prose parentheses are not calls',
    $LPplan['quoted']['calls'][0] === "vis(bar, X, Y, none, sum, 10, 'smile :)')" && $LPplan['quoted']['pages'] === array(1, 2)
    && $LPplan['prose']['pages'] === array(1) && $LPplan['prose']['certain'] === true && $LPplan['none']['calls'] === array() && $LPplan['none']['live'] === 0, array($LPplan['quoted'], $LPplan['prose']));
// The plan's chart list must be the list the engine extracts after noweb() is unwrapped and web() removed.
if (function_exists('_snippet_remove_balanced_call') && function_exists('_snippet_unwrap_balanced_call')) {
    $lpDiff = array();
    foreach ($LPcases as $lk => $ls) {
        $viaEngine = array_values(penumbra_vis_extract(_snippet_remove_balanced_call(_snippet_unwrap_balanced_call($ls, 'noweb'), 'web'))['calls']);
        $viaPlan = penumbra_vis_live_plan(_snippet_unwrap_balanced_call($ls, 'noweb'))['calls'];
        if ($viaEngine !== $viaPlan) $lpDiff[] = $lk;
    }
    ok('plan: for every shape the plan lists exactly the vis() calls the engine extracts for the email', !$lpDiff, $lpDiff);
} else {
    ok('plan: the engine helpers are in the runner mirror', false, 'missing');
}
// L2 token -> page
$lCalls = array($TOK(0) => 'vis(bar,X,Y)', $TOK(1) => 'vis(pie,X,Y)', $TOK(2) => 'vis(line,X,Y)');
$lPlan = array('calls' => array_values($lCalls), 'pages' => array(1, 2, 3), 'certain' => true, 'live' => 3);
$lImgs = array($TOK(0) => array(), $TOK(1) => array(), $TOK(2) => array());
$lWhy = '';
$lp = penumbra_vis_chart_pages($lCalls, $lImgs, $lPlan, $lWhy);
ok('pages: each drawn chart maps to its live page', $lp === array($TOK(0) => 1, $TOK(1) => 2, $TOK(2) => 3) && $lWhy === '', array($lp, $lWhy));
$lp2 = penumbra_vis_chart_pages($lCalls, array($TOK(0) => array(), $TOK(2) => array()), $lPlan, $lWhy);
ok('pages: a chart that did not draw is no page on screen either - nothing after it is numbered, what came before keeps its number',
    $lp2 === array($TOK(0) => 1) && strpos($lWhy, 'did not draw') !== false, array($lp2, $lWhy));
$lPlanBad = $lPlan; $lPlanBad['calls'][1] = 'vis(pie,X,Z)';
$lp3 = penumbra_vis_chart_pages($lCalls, $lImgs, $lPlanBad, $lWhy);
ok('pages: a plan whose calls differ from the email\'s (same count, other text) is refused with a reason', $lp3 === array() && strpos($lWhy, 'cannot be trusted') !== false, $lWhy);
$lPlanShort = $lPlan; array_pop($lPlanShort['calls']); array_pop($lPlanShort['pages']);
$lp3b = penumbra_vis_chart_pages($lCalls, $lImgs, $lPlanShort, $lWhy);
ok('pages: a plan with fewer calls than the email draws is refused too', $lp3b === array() && strpos($lWhy, 'cannot be trusted') !== false, $lWhy);
$lPlanU = $lPlan; $lPlanU['certain'] = false;
$lp4 = penumbra_vis_chart_pages($lCalls, $lImgs, $lPlanU, $lWhy);
ok('pages: an uncertain plan numbers nothing and says why', $lp4 === array() && strpos($lWhy, 'inside a snippet function') !== false, $lWhy);
$lPlanZ = $lPlan; $lPlanZ['pages'] = array(1, 0, 2);
$lp5 = penumbra_vis_chart_pages($lCalls, $lImgs, $lPlanZ, $lWhy);
ok('pages: a chart with no page of its own (inside a slide) is skipped, the others keep theirs', $lp5 === array($TOK(0) => 1, $TOK(2) => 2), $lp5);
// L3 the links
$lLinkBase = 'https://www3.example.test/penumbra/index.php?id=rpt1&FY=2025&q=a%26b';
$GLOBALS['penumbra_vis_chart_link'] = array('base' => $lLinkBase, 'color' => '#990000', 'font' => 'Verdana');
$nL = count($GLOBALS['LOGS']);
$lk = penumbra_vis_chart_links($lCalls, $lImgs, array('visPlan' => $lPlan));
ok('links: href = the report URL + &fullscreen=true&fspages=N, with the caption colour and font carried, and a log line',
    count($lk) === 3 && $lk[$TOK(1)]['href'] === $lLinkBase . '&fullscreen=true&fspages=2' && $lk[$TOK(2)]['page'] === 3
    && $lk[$TOK(0)]['color'] === '#990000' && $lk[$TOK(0)]['font'] === 'Verdana' && strpos(logs_from($nL), 'full-screen links for 3 of 3') !== false, array($lk, logs_from($nL)));
ok('links: without a plan nothing is linked and the log says why',
    penumbra_vis_chart_links($lCalls, $lImgs, array()) === array() && strpos(logs_from($nL), 'was not numbered') !== false, logs_from($nL));
$GLOBALS['penumbra_vis_chart_link'] = array();
$nL2 = count($GLOBALS['LOGS']);
ok('links: no hand-over (the task has no live-report link) -> no links and no log noise',
    penumbra_vis_chart_links($lCalls, $lImgs, array('visPlan' => $lPlan)) === array() && count($GLOBALS['LOGS']) === $nL2, logs_from($nL2));
// L4 the markup
$lImg = array('cid' => 'pnbvis-l@penumbra', 'png' => 'x', 'jpeg' => null, 'width' => 441, 'height' => 320, 'alt' => 'Chart L',
              'href' => 'https://www3.example.test/p/index.php?id=rpt1&FY=2025&fullscreen=true&fspages=2', 'linkColor' => '#990000', 'linkFont' => 'Verdana');
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $lImg);
$lLone = penumbra_vis_apply_tokens('x ' . $TOK(0) . ' y');
$lHref = 'https://www3.example.test/p/index.php?id=rpt1&amp;FY=2025&amp;fullscreen=true&amp;fspages=2';
$lExp = 'x <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:4px 0;"><tr><td style="padding:0;">'
      . '<a href="' . $lHref . '" title="Open this chart in full view" style="text-decoration:none; border:0;">'
      . '<img src="cid:pnbvis-l@penumbra" width="441" height="320" border="0" alt="Chart L. Opens the chart in full view." style="display:block; margin:0; max-width:100%; height:auto; border:0;"></a></td></tr>'
      . '<tr><td style="padding:3px 0 0; font-family:Verdana, Arial, sans-serif; font-size:12px; line-height:16px; font-weight:normal; text-align:left;">'
      . '<a href="' . $lHref . '" title="Open this chart in full view" style="color:#990000; text-decoration:underline;">Open to full view</a></td></tr></table> y';
ok('markup: a linked lone chart is a two-row table - the picture is a link (block, border 0), "Open to full view" sits under it, ampersands escaped', $lLone === $lExp, $lLone);
$lImg2 = $lImg; $lImg2['cid'] = 'pnbvis-m@penumbra'; $lImg2['href'] = 'https://x.test/?a="1"&b=<2>';
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $lImg, $TOK(1) => $lImg2);
$lRow = penumbra_vis_apply_tokens($TOK(0) . "\n" . $TOK(1));
ok('markup: two linked charts in one row keep their cells; each cell holds its linked picture and its own caption; quotes and angle brackets in a URL are escaped',
    substr_count($lRow, '<table ') === 1 && substr_count($lRow, '<td valign="top" width="441"') === 2 && substr_count($lRow, 'Open to full view</a></div></td>') === 2
    && strpos($lRow, 'href="https://x.test/?a=&quot;1&quot;&amp;b=&lt;2&gt;"') !== false && strpos($lRow, '"1"') === false, $lRow);
$lImg3 = $lImg; $lImg3['linkColor'] = 'red;background:url(x)'; $lImg3['linkFont'] = 'x"onload=1';
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $lImg3);
$lBad = penumbra_vis_apply_tokens($TOK(0));
ok('markup: a caption colour or font that is not plain is dropped, never written into the style attribute',
    strpos($lBad, 'onload') === false && strpos($lBad, 'url(') === false && strpos($lBad, 'font-family:Arial, sans-serif;') !== false && strpos($lBad, 'Open to full view') !== false, $lBad);
$lImg4 = $lImg; unset($lImg4['href']);
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $lImg4, $TOK(1) => $lImg);
$lMix = penumbra_vis_apply_tokens($TOK(0) . ' and ' . $TOK(1));
ok('markup: a chart without a link keeps the plain inline image while its neighbour is linked',
    strpos($lMix, '<img src="cid:pnbvis-l@penumbra" width="441" height="320" alt="Chart L" style="display:inline-block; vertical-align:top; margin:4px 0; max-width:100%; height:auto; border:0;"> and <table') === 0, $lMix);
$GLOBALS['penumbra_vis_images'] = array();

// ══════ A. alt text never empty (WCAG 1.1.1 / 2.4.4, 2026-10-15) ══════
// An untitled chart used to get alt="" (read as decorative) and, linked to its
// full view, a link with no accessible name. Mutants: noaltfallback, nolinkname, noaltpage.
$aImg = array('cid' => 'pnbvis-u@penumbra', 'png' => 'x', 'jpeg' => null, 'width' => 441, 'height' => 320, 'alt' => '', 'title' => '');
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $aImg);
$aPlain = penumbra_vis_apply_tokens($TOK(0));
ok('alt: an untitled chart with no description is alt="Chart", never empty', strpos($aPlain, ' alt="Chart" ') !== false && strpos($aPlain, 'alt=""') === false, $aPlain);
$aT = $aImg; $aT['title'] = 'Only a title';
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $aT);
$aTitled = penumbra_vis_apply_tokens($TOK(0));
ok('alt: a title with no description reads "Chart: <title>"', strpos($aTitled, ' alt="Chart: Only a title" ') !== false, $aTitled);
$aL = $aImg; $aL['href'] = 'https://x.test/?id=r&fullscreen=true';
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $aL);
$aLinked = penumbra_vis_apply_tokens($TOK(0));
ok('alt: a linked untitled chart names its link (the picture is the link\'s only content)',
    preg_match('#<a href="[^"]*"[^>]*><img [^>]*alt="Chart\. Opens the chart in full view\."[^>]*></a>#', $aLinked) === 1 && strpos($aLinked, 'alt=""') === false, $aLinked);
$aF = $aImg; $aF['wpct'] = 49.0;
$aFluid = penumbra_vis_fluid_img_tag($aF, true);
ok('alt: the fluid ("%") picture follows the same rule (linked: named)', strpos($aFluid, ' alt="Chart. Opens the chart in full view." ') !== false, $aFluid);
ok('alt: the helper collapses whitespace and caps the length', function_exists('penumbra_vis_alt_text') && penumbra_vis_alt_text("  a \n b  ") === 'a b' && strlen(penumbra_vis_alt_text(str_repeat('x', 400))) === 300, '');
$GLOBALS['penumbra_vis_images'] = array();
// A real untitled chart: the render page describes it (type and counts) from the chart itself.
$nA = count($GLOBALS['LOGS']);
$aText = penumbra_vis_render_snippet('vis(bar, COLLEGE, AMOUNT, none, sum, 10)', $rows, $cols);
$aImgs = array(); foreach ($GLOBALS['penumbra_vis_images'] as $img) { if (is_array($img)) $aImgs[] = $img; }
ok('alt: a real untitled vis() chart is described by the page ("Bar chart. 1 data series, N categories.")',
    count($aImgs) === 1 && preg_match('/^[A-Z][a-z ]* chart\. \d+ data series, \d+ categories\.$/', $aImgs[0]['alt']) === 1 && $aImgs[0]['title'] === '',
    count($aImgs) ? $aImgs[0]['alt'] : logs_from($nA));
$GLOBALS['penumbra_vis_images'] = array();

// ══════ O. the oracle: the plan against the app's OWN carousel list ══════
// Each snippet is rendered whole through the real engine A (main_render.js, the page the email already uses)
// and the page list is read from the app's penumbraCollectCarouselEntries() - the function the carousel
// and the cog menu's Direct Link number their pages with. One page, every snippet in turn.
$oV = function ($type, $title) { return "vis($type, COLLEGE, AMOUNT, none, sum, 10, '$title')"; };
$oBattery = array(
    array('id' => 'plain',       'snippet' => "A " . $oV('bar', 'T1') . " B " . $oV('pie', 'T2') . " C"),
    array('id' => 'slide',       'snippet' => $oV('bar', 'T1') . " slide(" . $oV('pie', 'T2') . ") " . $oV('line', 'T3')),
    array('id' => 'slideText',   'snippet' => "slide('<h2>Hello</h2>') " . $oV('bar', 'T1')),
    array('id' => 'slideTwo',    'snippet' => "slide(" . $oV('bar', 'T1') . " " . $oV('pie', 'T2') . ") " . $oV('line', 'T3')),
    array('id' => 'web',         'snippet' => "web(" . $oV('bar', 'T1') . ") " . $oV('pie', 'T2')),
    array('id' => 'webSlide',    'snippet' => "web(slide(" . $oV('bar', 'T1') . ")) " . $oV('pie', 'T2')),
    array('id' => 'noweb',       'snippet' => "noweb(" . $oV('bar', 'T1') . ") " . $oV('pie', 'T2')),
    array('id' => 'nowebSlide',  'snippet' => "noweb(slide(" . $oV('bar', 'T1') . ")) " . $oV('pie', 'T2')),
    array('id' => 'mix',         'snippet' => "web(" . $oV('bar', 'T1') . ") noweb(" . $oV('line', 'T2') . ") " . $oV('pie', 'T3')),
    array('id' => 'html',        'snippet' => "<div class=\"a\"><p>x</p>" . $oV('bar', 'T1') . "</div><div>" . $oV('pie', 'T2') . "</div>"),
    array('id' => 'action',      'snippet' => "action(infobox, Open, \"raw|" . $oV('bar', 'T9') . "\") " . $oV('pie', 'T2')),
    array('id' => 'caseBoth',    'snippet' => "case(1 = 1, " . $oV('bar', 'T1') . ", '') " . $oV('pie', 'T2')),
    array('id' => 'caseElse',    'snippet' => "case(1 = 2, " . $oV('bar', 'T1') . ", '') " . $oV('pie', 'T2')),
    array('id' => 'badType',     'snippet' => "vis(nosuchtype, COLLEGE, AMOUNT, none, sum, 10, 'Bad') " . $oV('pie', 'T2')),
    array('id' => 'noColumn',    'snippet' => "vis(bar, NOPE, AMOUNT, none, sum, 10, 'Empty') " . $oV('pie', 'T2')),
);
$oJs = <<<'JS'
<script>
(function () {
  var out = document.getElementById("out");
  var started = false;
  var CASES = __CASES__;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function topCanvases() { return Array.prototype.filter.call(document.querySelectorAll("#reportSnippetOutput canvas"), function (c) { return !(c.closest && c.closest(".penumbra-slide-frame")); }); }
  async function settle() {
    var last = "", same = 0;
    for (var i = 0; i < 60; i++) {
      var cs = topCanvases();
      var sig = cs.map(function (c) { return c.id; }).join(",");
      var ready = cs.every(function (c) { return !!(window.Chart && window.Chart.getChart && window.Chart.getChart(c)); });
      if (sig === last && ready) { same++; } else { same = 0; last = sig; }
      if (same >= 3) return;
      await wait(100);
    }
  }
  async function runAll() {
    var R = window.__RENDER, P = window.__PAGE, res = [];
    var maps = P.rows.map(function (r, i) {
      var m = new Map(); m.set("#", String(i + 1));
      for (var c = 0; c < P.columns.length; c++) { m.set(P.columns[c], r[c] == null ? "" : String(r[c])); }
      return m;
    });
    var ed = R.getEditor();
    for (var k = 0; k < CASES.length; k++) {
      try {
        ed.setValue(CASES[k].snippet);
        await Promise.resolve(R.render(maps, false, { ignorePendingViewState: true }));
        await settle();
        var es = window.penumbraCollectCarouselEntries();
        res.push({ id: CASES[k].id,
          entries: es.filter(function (e) { return !e.fromInfobox; }).map(function (e) { return e.kind === "slide" ? { k: "slide", charts: e.chartTitles } : { k: "chart", t: String(e.title) }; }),
          infobox: es.filter(function (e) { return !!e.fromInfobox; }).length });
      } catch (e) { res.push({ id: CASES[k].id, error: String(e) }); }
    }
    out.textContent = "RESULT_JSON:" + JSON.stringify({ oracleBatch: res });
  }
  new MutationObserver(function () {
    var t = out.textContent || "";
    if (!started && t.indexOf("RESULT_JSON:") === 0) { started = true; runAll(); }
  }).observe(out, { childList: true, characterData: true, subtree: true });
})();
</script>
JS;
$oAlive = penumbra_render_worker_alive();
$oEntries = array();
$oErr = '';
if ($oAlive) {
    $oSync = penumbra_vis_assets_sync($queue, $webroot);
    $oHtml = penumbra_vis_page_html(array($TOK(0) => 'x'), $rows, $cols, array('theme' => 'theme-default'));
    if (!$oSync['ok'] || $oHtml === false) { $oErr = 'assets or page: ' . (!$oSync['ok'] ? $oSync['error'] : 'page html'); }
    else {
        $oHtml = str_replace('</body></html>', str_replace('__CASES__', json_encode($oBattery, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES), $oJs) . '</body></html>', $oHtml);
        $oR = penumbra_render_html_to_dom($oHtml, array('budget' => 120000, 'width' => 1200, 'height' => 900), 240);
        if (!$oR['ok']) { $oErr = 'render: ' . $oR['error']; }
        else {
            $oDom = (string)$oR['dom'];
            $oi = strpos($oDom, '<pre id="out">'); $oj = ($oi === false) ? false : strpos($oDom, '</pre>', $oi);
            $oTxt = ($oi === false || $oj === false) ? '' : trim(html_entity_decode(substr($oDom, $oi + 14, $oj - $oi - 14), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $oJson = (strpos($oTxt, 'RESULT_JSON:') === 0) ? json_decode(substr($oTxt, 12), true) : null;
            if (!is_array($oJson) || !isset($oJson['oracleBatch'])) { $oErr = 'no oracle batch in the page (' . substr($oTxt, 0, 160) . ')'; }
            else { foreach ($oJson['oracleBatch'] as $oc) { $oEntries[$oc['id']] = $oc; } }
        }
    }
} else { $oErr = 'worker not alive'; }
ok('oracle: the real engine rendered all ' . count($oBattery) . ' snippets and listed their carousel pages', $oErr === '' && count($oEntries) === count($oBattery), $oErr !== '' ? $oErr : array_keys($oEntries));
$oBad = array();
foreach ($oBattery as $obc) {
    $oid = $obc['id'];
    if (in_array($oid, array('caseBoth', 'caseElse', 'badType', 'noColumn'), true)) continue;
    $oPlan = penumbra_vis_live_plan($obc['snippet']);
    $oEnts = isset($oEntries[$oid]['entries']) ? $oEntries[$oid]['entries'] : null;
    if (!is_array($oEnts) || !$oPlan['certain']) { $oBad[] = $oid . ': no oracle list or an uncertain plan'; continue; }
    if (count($oEnts) !== $oPlan['live']) $oBad[] = $oid . ': the plan counts ' . $oPlan['live'] . ' live pages, the engine lists ' . count($oEnts);
    foreach ($oPlan['calls'] as $ok2 => $oCall) {
        $op = $oPlan['pages'][$ok2];
        $ot = preg_match("/'([^']*)'\\)$/", $oCall, $om) ? $om[1] : '?';
        if ($op > 0) {
            if (!isset($oEnts[$op - 1]) || $oEnts[$op - 1]['k'] !== 'chart' || $oEnts[$op - 1]['t'] !== $ot) {
                $oBad[] = $oid . ': ' . $ot . ' is page ' . $op . ' in the plan, the engine has ' . json_encode(isset($oEnts[$op - 1]) ? $oEnts[$op - 1] : null);
            }
        } else {
            foreach ($oEnts as $oen) { if ($oen['k'] === 'chart' && $oen['t'] === $ot) $oBad[] = $oid . ': ' . $ot . ' has no page in the plan but the engine lists it as one'; }
        }
    }
}
ok('oracle: for every certain snippet the plan agrees with the app\'s own carousel list (page count, and each emailed chart\'s number -> that chart)', $oErr === '' && !$oBad, $oBad ? $oBad : $oErr);
$oTitles = function ($id) use ($oEntries) {
    if (!isset($oEntries[$id]['entries'])) return null;
    $t = array(); foreach ($oEntries[$id]['entries'] as $e) { $t[] = $e['k'] === 'slide' ? '#slide' : $e['t']; } return $t;
};
ok('oracle: slides, web(), noweb() and action() read as the plan says (slide = one page holding its charts; noweb stays a page; the infobox chart is appended, not counted)',
    $oTitles('slide') === array('T1', '#slide', 'T3') && $oTitles('slideTwo') === array('#slide', 'T3') && $oTitles('noweb') === array('T1', 'T2')
    && $oTitles('nowebSlide') === array('#slide', 'T2') && $oTitles('web') === array('T1', 'T2') && $oTitles('mix') === array('T1', 'T2', 'T3')
    && $oTitles('action') === array('T2') && isset($oEntries['action']) && $oEntries['action']['infobox'] === 1, array_map($oTitles, array('slide', 'slideTwo', 'noweb', 'nowebSlide', 'web', 'mix', 'action')));
ok('oracle: why a conditional chart is uncertain - the same snippet has two pages or one depending on the branch (plan: uncertain)',
    $oTitles('caseBoth') === array('T1', 'T2') && $oTitles('caseElse') === array('T2')
    && penumbra_vis_live_plan($oBattery[11]['snippet'])['certain'] === false && penumbra_vis_live_plan($oBattery[12]['snippet'])['certain'] === false, array($oTitles('caseBoth'), $oTitles('caseElse')));
ok('oracle: why a chart that fails to draw gates the numbers after it - a bad type or a missing column is NOT a page, so the chart after it moves up one',
    $oTitles('badType') === array('T2') && $oTitles('noColumn') === array('T2'), array($oTitles('badType'), $oTitles('noColumn')));

// ══════ M. through the engine itself (execute_email_snippet from the runner mirror) ══════
if (function_exists('execute_email_snippet') && $alive) {
    if (!function_exists('penumbra_resolve_css_vars')) { function penumbra_resolve_css_vars($css) { return $css; } }
    $GLOBALS['total_exemptions'] = array('TOTAL', 'AMOUNT', 'COUNT', 'AMT', 'CNT', 'COST');
    $GLOBALS['config'] = array();
    $GLOBALS['strip_links'] = false;
    $mBase = 'https://www3.example.test/penumbra/index.php?id=rpt1&FY=2025';
    $GLOBALS['penumbra_vis_chart_link'] = array('base' => $mBase, 'color' => '#990000', 'font' => 'Verdana');
    $mHrefs = function ($html) { preg_match_all('/<a href="([^"]*fullscreen=true[^"]*)"/', $html, $mm); return array_values(array_unique(array_map('html_entity_decode', $mm[1]))); };
    // M1 a slide before the chart, a web() chart before the next: live pages 1 (M1), 2 (the slide holding M2), 3 (web M3), 4 (M4)
    $nM = count($GLOBALS['LOGS']);
    $m1 = execute_email_snippet("Intro vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'M1') slide(vis(pie, COLLEGE, AMOUNT, none, sum, 10, 'M2')) web(vis(line, COLLEGE, AMOUNT, none, sum, 10, 'M3')) vis(doughnut, STATUS, none, none, count, 10, 'M4') end", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
    $m1h = $mHrefs($m1);
    ok('engine: the two emailed charts link to their pages on the live report (M1 = 1, M4 = 4: the slide and the web() chart before it count)',
        $m1h === array($mBase . '&fullscreen=true&fspages=1', $mBase . '&fullscreen=true&fspages=4') && substr_count($m1, 'Open to full view</a>') === 2
        && substr_count($m1, 'cid:pnbvis-') === 2 && strpos($m1, '__PENUMBRA_VISIMG_') === false, array($m1h, logs_from($nM)));
    penumbra_vis_take_images();
    // M2 a snippet button the email drops whole (it holds action()): its chart leaves BOTH lists
    $mBtn = '<span class="penumbra-snippet-btn" style="">action(infobox, Open, "raw|vis(bar, COLLEGE, AMOUNT, none, sum, 10, \'B\')")</span>';
    $nM2 = count($GLOBALS['LOGS']);
    $m2 = execute_email_snippet($mBtn . " vis(pie, COLLEGE, AMOUNT, none, sum, 10, 'P1')", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
    ok('engine: a dropped button and the chart inside it do not break the numbering (the chart after it is page 1 and keeps its link)',
        $mHrefs($m2) === array($mBase . '&fullscreen=true&fspages=1') && strpos($m2, 'penumbra-snippet-btn') === false, array($mHrefs($m2), logs_from($nM2)));
    penumbra_vis_take_images();
    // M3 a conditional chart: the plan is uncertain, so the charts are plain pictures and the log says why
    $nM3 = count($GLOBALS['LOGS']);
    $m3 = execute_email_snippet("Intro case(1 = 1, vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'C1'), '') and vis(pie, COLLEGE, AMOUNT, none, sum, 10, 'C2')", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
    ok('engine: a chart inside case() leaves every chart of the email unlinked (plain pictures) and the log says why',
        strpos($m3, 'fullscreen=true') === false && strpos($m3, 'Open to full view') === false && substr_count($m3, 'cid:pnbvis-') === 2 && strpos(logs_from($nM3), 'inside a snippet function') !== false, logs_from($nM3));
    penumbra_vis_take_images();
    // M4 the task has no live-report link: the markup is byte-for-byte the one of before (inline images)
    $GLOBALS['penumbra_vis_chart_link'] = array();
    $m4 = execute_email_snippet("A vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'N1') and vis(pie, COLLEGE, AMOUNT, none, sum, 10, 'N2') end", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
    ok('engine: with the header link off the charts are the plain inline pictures of before - no link, no caption, no table',
        strpos($m4, 'fullscreen=true') === false && strpos($m4, 'Open to full view') === false && substr_count($m4, 'display:inline-block; vertical-align:top; margin:4px 0;') === 2 && strpos($m4, '<table') === false, $m4);
    penumbra_vis_take_images();
    // M5 a chart that cannot draw: it is no page on screen, so the charts after it get no link, the one before keeps its own
    $GLOBALS['penumbra_vis_chart_link'] = array('base' => $mBase, 'color' => '#990000', 'font' => 'Verdana');
    $nM5 = count($GLOBALS['LOGS']);
    $m5 = execute_email_snippet("vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'G1') vis(nosuchtype, COLLEGE, AMOUNT, none, sum, 10, 'Bad') vis(pie, COLLEGE, AMOUNT, none, sum, 10, 'G3')", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
    ok('engine: after a chart that cannot draw only the chart before it keeps a link (the one after it would point one page too far)',
        $mHrefs($m5) === array($mBase . '&fullscreen=true&fspages=1') && substr_count($m5, 'cid:pnbvis-') === 2 && strpos(logs_from($nM5), 'did not draw') !== false, array($mHrefs($m5), logs_from($nM5)));
    penumbra_vis_take_images();
    $GLOBALS['penumbra_vis_chart_link'] = array();
} else {
    ok('engine: execute_email_snippet is in the runner mirror and the worker is alive', false, function_exists('execute_email_snippet') ? 'worker not alive' : 'not in the mirror');
}

// ══════ N. "%" charts scale with the email (2026-10-06) ══════
// The report draws a "%" chart at that share of its container and redraws it whenever the container
// changes; an email cannot redraw, so under the Dashboard layout (a full-width snippet row) the chart is
// drawn against a 1200px reference column and shown at that share of the reader's window, never wider
// than its own pixels. Fixed-size charts and the default layout keep their size.
$nPng = function ($w, $h) { return "\x89PNG\r\n\x1a\n" . pack('N', 13) . 'IHDR' . pack('NN', $w, $h) . "\x08\x06\x00\x00\x00" . str_repeat("\0", 20); };
$nImg = function ($cid, $w, $h, $p, $href = '') use ($nPng) {
    $i = array('cid' => $cid, 'png' => $nPng($w * 2, $h * 2), 'jpeg' => null, 'width' => $w, 'height' => $h, 'alt' => $cid, 'wpct' => (float)$p, 'fluid' => true);
    if ($href !== '') { $i['href'] = $href; $i['linkColor'] = '#990000'; $i['linkFont'] = 'Verdana'; }
    return $i;
};
ok('fluid: the PNG width is read from its header; anything else is 0', penumbra_vis_png_width($nPng(1176, 640)) === 1176 && penumbra_vis_png_width('not a png at all, long enough to pass the length test') === 0 && penumbra_vis_png_width('') === 0, penumbra_vis_png_width($nPng(1176, 640)));
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $nImg('f1@p', 588, 320, 49));
$nLone = penumbra_vis_apply_tokens('x ' . $TOK(0) . ' y');
$nLoneExp = 'x <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin:4px 0;"><tr>'
          . '<td valign="top" width="49%" style="padding:0;"><img src="cid:f1@p" width="441" height="240" alt="f1@p" style="display:block; margin:0; width:100%; max-width:1176px; height:auto; border:0;"></td>'
          . '<td style="padding:0;">&nbsp;</td></tr></table> y';
ok('fluid: a lone 49% chart is a 100%-wide table with a 49% cell (+ a cell that takes the rest), the picture fills its cell, never wider than its own 1176 pixels; width/height attributes keep the 900px-column size in the chart\'s proportions',
    $nLone === $nLoneExp, $nLone);
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $nImg('a@p', 588, 320, 49, 'https://x.test/?id=r&fullscreen=true&fspages=1'), $TOK(1) => $nImg('b@p', 588, 320, 49));
$nTwo = penumbra_vis_apply_tokens($TOK(0) . "\n" . $TOK(1));
ok('fluid: two adjacent 49% charts share ONE row - two 49% cells, an 8px spacer, a closing cell; the linked one carries its caption under it in its own cell',
    substr_count($nTwo, '<table ') === 1 && substr_count($nTwo, '<td valign="top" width="49%"') === 2 && substr_count($nTwo, '<td width="8"') === 1
    && substr_count($nTwo, 'Open to full view</a></div></td>') === 1 && preg_match('#</td><td width="8"[^>]*>&nbsp;</td><td valign="top" width="49%" style="padding:0;"><img src="cid:b@p"#', $nTwo) === 1
    && substr($nTwo, -strlen('<td style="padding:0;">&nbsp;</td></tr></table>')) === '<td style="padding:0;">&nbsp;</td></tr></table>', $nTwo);
$nRowsOf = function ($pcts) use ($nImg, $TOK) {
    $imgs = array(); $k = 0; foreach ($pcts as $p) { $imgs[$TOK($k)] = $nImg('c' . $k . '@p', 400, 200, $p); $k++; }
    $GLOBALS['penumbra_vis_images'] = $imgs;
    $in = implode("\n", array_keys($imgs));
    $out = penumbra_vis_apply_tokens($in);
    $rows = array();
    foreach (preg_split('#</table>#', $out, -1, PREG_SPLIT_NO_EMPTY) as $tbl) { $rows[] = substr_count($tbl, '<td valign="top"'); }
    return $rows;
};
ok('fluid: the packing follows the report\'s own row (the percentages add up to 100 or less): 50+50 and 33.3 x 3 share a row, 60+60 do not, 50+50+50 is a pair and a single',
    $nRowsOf(array(50, 50)) === array(2) && $nRowsOf(array(33.3, 33.3, 33.3)) === array(3) && $nRowsOf(array(60, 60)) === array(1, 1) && $nRowsOf(array(50, 50, 50)) === array(2, 1)
    && $nRowsOf(array(25, 25, 25, 25)) === array(4), array($nRowsOf(array(50, 50)), $nRowsOf(array(60, 60)), $nRowsOf(array(50, 50, 50))));
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $nImg('h@p', 1200, 240, 100));
$nFull = penumbra_vis_apply_tokens($TOK(0));
ok('fluid: a 100% chart is one 100% cell with nothing after it (no closing cell), fallback size 900 x 180, never wider than its own 2400 pixels',
    strpos($nFull, '<td valign="top" width="100%" style="padding:0;"><img src="cid:h@p" width="900" height="180" alt="h@p" style="display:block; margin:0; width:100%; max-width:2400px; height:auto; border:0;"></td></tr></table>') !== false
    && substr_count($nFull, '&nbsp;') === 0, $nFull);
$nFixed = $nImg('p@p', 700, 240, 0); unset($nFixed['fluid']);
$nPctOnly = $nImg('q@p', 441, 320, 49); unset($nPctOnly['fluid']);
$GLOBALS['penumbra_vis_images'] = array($TOK(0) => $nFixed, $TOK(1) => $nImg('r@p', 588, 320, 49), $TOK(2) => $nPctOnly);
$nMix = penumbra_vis_apply_tokens($TOK(0) . ' ' . $TOK(1) . ' ' . $TOK(2));
ok('fluid: a run of mixed kinds is cut where the kind changes - a fixed chart keeps its plain inline picture, the "%" chart gets the fluid row, and a "%" chart that was NOT drawn fluid (default layout) is a plain picture too',
    strpos($nMix, '<img src="cid:p@p" width="700" height="240" alt="p@p" style="display:inline-block; vertical-align:top; margin:4px 0; max-width:100%; height:auto; border:0;">') === 0
    && substr_count($nMix, '<td valign="top" width="49%"') === 1 && substr_count($nMix, '<table ') === 1
    && substr($nMix, -strlen('<img src="cid:q@p" width="441" height="320" alt="q@p" style="display:inline-block; vertical-align:top; margin:4px 0; max-width:100%; height:auto; border:0;">')) === '<img src="cid:q@p" width="441" height="320" alt="q@p" style="display:inline-block; vertical-align:top; margin:4px 0; max-width:100%; height:auto; border:0;">', $nMix);
$GLOBALS['penumbra_vis_images'] = array();
// The page is drawn against the reference width it is given
$nPg = penumbra_vis_page_html(array($TOK(0) => 'vis(bar, college, amount)'), $rows11, array('college', 'amount', 'note'), array('baseWidth' => 1200));
$nPg0 = penumbra_vis_page_html(array($TOK(0) => 'vis(bar, college, amount)'), $rows11, array('college', 'amount', 'note'));
$nPg1 = penumbra_vis_page_html(array($TOK(0) => 'vis(bar, college, amount)'), $rows11, array('college', 'amount', 'note'), array('baseWidth' => 99999));
ok('fluid: the render page takes its column width from baseWidth (1200), 900 without it, and ignores a silly value',
    strpos($nPg, '#reportSnippetOutput{display:block !important;width:1200px !important') !== false && strpos($nPg0, 'width:900px !important') !== false && strpos($nPg1, 'width:900px !important') !== false
    && strpos($nPg, 'rec.wspec = String(cfg.width == null') !== false, array(strpos($nPg, 'width:1200px'), strpos($nPg0, 'width:900px')));
if ($alive) {
    $GLOBALS['penumbra_snippet_layout'] = 'dashboard';
    $nN = count($GLOBALS['LOGS']);
    $nSnip = "vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Half A', false, true, '49%', 300)\nvis(pie, STATUS, none, none, count, 10, 'Half B', true, true, '49%', 300)\n"
           . "vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Full', false, true, '100%', 240) and vis(line, FY, AMOUNT, COLLEGE, sum, 10, 'Fixed', true, false, 700, 240)";
    $nText = penumbra_vis_render_snippet($nSnip, $rows, $cols, array());
    $nStore = $GLOBALS['penumbra_vis_images'];
    $nA = isset($nStore[$TOK(0)]) ? $nStore[$TOK(0)] : null; $nB = isset($nStore[$TOK(1)]) ? $nStore[$TOK(1)] : null;
    $nC = isset($nStore[$TOK(2)]) ? $nStore[$TOK(2)] : null; $nD = isset($nStore[$TOK(3)]) ? $nStore[$TOK(3)] : null;
    ok('fluid (real render, Dashboard layout): the 49% charts are drawn against 1200px - 588 x 300 CSS px, a 1176 x 600 PNG - and marked fluid with their 49%; the 100% chart is 1200 wide; the 700px chart stays 700 and is not fluid',
        $nA && $nB && $nC && $nD && $nA['width'] === 588 && $nA['height'] === 300 && png_dims($nA['png']) === '1176x600' && $nA['wpct'] === 49.0 && !empty($nA['fluid'])
        && $nB['width'] === 588 && !empty($nB['fluid']) && $nC['width'] === 1200 && $nC['wpct'] === 100.0 && !empty($nC['fluid'])
        && $nD['width'] === 700 && empty($nD['fluid']) && $nD['wpct'] === 0.0,
        array($nA ? array($nA['width'], $nA['height'], png_dims($nA['png']), $nA['wpct'], !empty($nA['fluid'])) : 'missing A', $nC ? array($nC['width'], $nC['wpct']) : 'missing C', $nD ? array($nD['width'], $nD['wpct']) : 'missing D', logs_from($nN)));
    ok('fluid (real render): the log says how many charts scale with the email and what they were drawn against', strpos(logs_from($nN), '3 of 4 drawn chart(s) have a % width and scale with the email (drawn against 1200px') !== false, logs_from($nN));
    $nApplied = penumbra_vis_apply_tokens($nText);
    ok('fluid (real render): the two 49% charts are one fluid row, the 100% chart a row of its own, and the 700px chart a plain inline picture',
        substr_count($nApplied, '<td valign="top" width="49%"') === 2 && substr_count($nApplied, '<td valign="top" width="100%"') === 1 && substr_count($nApplied, 'max-width:1176px') === 2
        && substr_count($nApplied, 'max-width:2400px') === 1 && substr_count($nApplied, 'width="441" height="225"') === 2 && strpos($nApplied, 'width="700" height="240"') !== false
        && substr_count($nApplied, 'display:inline-block; vertical-align:top') === 1, $nApplied);
    penumbra_vis_take_images();
    // the same snippet under the default layout is drawn against 900 and stays fixed
    $GLOBALS['penumbra_snippet_layout'] = '';
    $nText0 = penumbra_vis_render_snippet("vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'Half A', false, true, '49%', 300)", $rows, $cols, array());
    $nS0 = $GLOBALS['penumbra_vis_images']; $nA0 = isset($nS0[$TOK(0)]) ? $nS0[$TOK(0)] : null;
    ok('fluid (real render): under the default layout the same 49% chart is drawn against 900px (441 wide), is not fluid and is the plain inline picture of before',
        $nA0 && $nA0['width'] === 441 && empty($nA0['fluid']) && $nA0['wpct'] === 49.0 && strpos(penumbra_vis_apply_tokens($nText0), 'display:inline-block') !== false && strpos(penumbra_vis_apply_tokens($nText0), '<table') === false,
        $nA0 ? array($nA0['width'], !empty($nA0['fluid'])) : 'missing');
    penumbra_vis_take_images();
    if (function_exists('execute_email_snippet')) {
        // through the engine, links on: the fluid cells carry the links and the new caption
        $GLOBALS['penumbra_snippet_layout'] = 'dashboard';
        $GLOBALS['penumbra_vis_chart_link'] = array('base' => $mBase, 'color' => '#990000', 'font' => 'Verdana');
        $nE = execute_email_snippet("Intro vis(bar, COLLEGE, AMOUNT, none, sum, 10, 'E1', false, true, '49%', 300) vis(pie, STATUS, none, none, count, 10, 'E2', true, true, '49%', 300) end", $rows, $cols, 'flat', array(), array('renderCharts' => true), false);
        ok('fluid (engine): in a Dashboard-layout email the two 49% charts are fluid cells, each linked to its own page, each with the "Open to full view" caption under it',
            $mHrefs($nE) === array($mBase . '&fullscreen=true&fspages=1', $mBase . '&fullscreen=true&fspages=2') && substr_count($nE, '<td valign="top" width="49%"') === 2 && substr_count($nE, 'Open to full view</a>') === 2
            && substr_count($nE, 'Open full screen') === 0, array($mHrefs($nE), substr($nE, 0, 300)));
        penumbra_vis_take_images();
        $GLOBALS['penumbra_vis_chart_link'] = array();
    }
    $GLOBALS['penumbra_snippet_layout'] = '';
} else {
    ok('fluid: the worker is alive for the real renders', false, 'worker not alive');
}

// ══════ T. EVERY chart type, in an email (2026-10-13, chart invariants sweep, check 8) ══════
// penumbra_tests\chartinv exports the Builder's OWN vis() call for each of its chart types and
// its 160-row fixture (fixture_alltypes_codes.txt / fixture_alltypes.csv, rewritten each run).
// Each call must come back from the real worker render as a real picture - not dropped, not a
// blank canvas. Three renders of six, so no page runs into the virtual-time budget.
$tFxText = @file_get_contents(dirname(__FILE__) . DIRECTORY_SEPARATOR . 'fixture_alltypes.csv');
$tCodeText = @file_get_contents(dirname(__FILE__) . DIRECTORY_SEPARATOR . 'fixture_alltypes_codes.txt');
if (!$tFxText || !$tCodeText) {
    ok('all types: the chartinv exports are present (run penumbra_tests\\chartinv first)', false, 'missing fixture_alltypes*.txt/csv');
} elseif (!$alive) {
    ok('all types: the worker is alive for the real renders', false, 'worker not alive');
} else {
    $tLines = preg_split('/\r?\n/', trim($tFxText));
    $tCols = explode('|', array_shift($tLines));
    $tRows = array();
    foreach ($tLines as $ln) { if ($ln === '') continue; $v = explode('|', $ln); $r = array(); foreach ($tCols as $ci => $cn) { $r[$cn] = isset($v[$ci]) ? $v[$ci] : ''; } $tRows[] = $r; }
    $tCalls = array();
    foreach (preg_split('/\r?\n/', trim($tCodeText)) as $ln) { $tab = strpos($ln, "\t"); if ($tab) $tCalls[] = array(substr($ln, 0, $tab), substr($ln, $tab + 1)); }
    ok('all types: ' . count($tCalls) . ' Builder vis() calls and ' . count($tRows) . ' rows loaded', count($tCalls) >= 18 && count($tRows) === 160, count($tCalls) . ' / ' . count($tRows));
    foreach (array_chunk($tCalls, 6) as $batch) {
        $nT = count($GLOBALS['LOGS']);
        penumbra_vis_render_snippet(implode("\n", array_map(function ($c) { return $c[1]; }, $batch)), $tRows, $tCols, array());
        $tStore = $GLOBALS['penumbra_vis_images'];
        foreach ($batch as $k => $c) {
            $img = isset($tStore[$TOK($k)]) ? $tStore[$TOK($k)] : null;
            // a blank 900-wide canvas at 2x is ~2-4 KB; any drawn chart is several times that
            ok('all types: ' . $c[0] . ' is drawn in the email as a real picture',
                is_array($img) && strlen($img['png']) > 9000 && substr($img['png'], 0, 4) === "\x89PNG",
                is_array($img) ? array('pngBytes' => strlen($img['png']), 'w' => $img['width'], 'h' => $img['height']) : ('not drawn: ' . logs_from($nT)));
            if (is_array($img)) file_put_contents($outDir . DIRECTORY_SEPARATOR . 'type_' . $c[0] . '.png', $img['png']);
        }
        penumbra_vis_take_images();
    }
}

// assets
$jsDir = $queue . DIRECTORY_SEPARATOR . 'js';
$libs = penumbra_vis_asset_list();
$allThere = true; foreach ($libs as $f) { if (!is_file($queue . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $f))) { $allThere = false; break; } }
$mr = @file_get_contents($jsDir . DIRECTORY_SEPARATOR . 'main_render.js');
ok('assets: the mirror holds every library and the stylesheet plus main_render.js with ONE hook line right after the ready() anchor',
    $allThere && $mr !== false && substr_count($mr, 'window.__RENDER = {') === 1 && strpos($mr, '$(document).ready(function () {' . penumbra_vis_hook_line()) !== false
    && strlen($mr) === filesize($webroot . '/js/main.js') + strlen(penumbra_vis_hook_line()), array('all' => $allThere, 'mr' => $mr === false ? 'missing' : strlen($mr)));
$s2 = penumbra_vis_assets_sync($queue, $webroot);
ok('assets: a second sync copies nothing', $s2['ok'] && $s2['copied'] === array(), $s2);
@unlink($jsDir . DIRECTORY_SEPARATOR . 'main_render.stamp');
$s3 = penumbra_vis_assets_sync($queue, $webroot);
ok('assets: with the stamp gone only main_render.js is rebuilt', $s3['ok'] && $s3['copied'] === array('main_render.js'), $s3);
ok('assets: a missing library is reported, not ignored', !penumbra_vis_assets_sync($queue, $outDir)['ok'] && strpos(penumbra_vis_assets_sync($queue, $outDir)['error'], 'missing app asset') !== false, penumbra_vis_assets_sync($queue, $outDir)['error']);
ok('queue: the request files were cleaned up', count(glob($queue . DIRECTORY_SEPARATOR . 'r2*')) === 0, implode(',', array_map('basename', glob($queue . DIRECTORY_SEPARATOR . 'r2*'))));

// PDF
$pdfPlugin = $modDir . DIRECTORY_SEPARATOR . 'plugins' . DIRECTORY_SEPARATOR . 'pdf_generator.php';
if (is_file($pdfPlugin)) {
    // TCPDF's static initialiser names curl constants; this workstation PHP
    // loads no extensions (the ini's extension_dir is the box's D:), so
    // define them (values as php_curl does) - the box has extension=curl.
    if (!defined('CURLOPT_CONNECTTIMEOUT')) {
        $curlConsts = array('CURLOPT_CONNECTTIMEOUT' => 78, 'CURLOPT_MAXREDIRS' => 68, 'CURLOPT_PROTOCOLS' => 181, 'CURLOPT_FAILONERROR' => 45,
            'CURLOPT_FOLLOWLOCATION' => 52, 'CURLOPT_RETURNTRANSFER' => 19913, 'CURLOPT_URL' => 10002, 'CURLINFO_HTTP_CODE' => 2097154,
            'CURLPROTO_HTTP' => 1, 'CURLPROTO_HTTPS' => 2, 'CURLPROTO_FTP' => 4, 'CURLPROTO_FTPS' => 8,
            'CURLOPT_SSL_VERIFYHOST' => 81, 'CURLOPT_SSL_VERIFYPEER' => 64, 'CURLOPT_TIMEOUT' => 13, 'CURLOPT_USERAGENT' => 10018);
        foreach ($curlConsts as $cn => $cv) { if (!defined($cn)) define($cn, $cv); }
    }
    require $pdfPlugin;
    $nP = count($GLOBALS['LOGS']);
    $pdf = penumbra_generate_pdf('<table border="1"><tr><th>College</th><th>Amount</th></tr><tr><td>Eng</td><td>$1,000</td></tr></table>', 'Chart test', array('charts' => penumbra_vis_pdf_charts($images), 'row_text' => '1 row'));
    $pages = (is_string($pdf) && preg_match_all('/\/Count (\d+)/', $pdf, $mm)) ? max(array_map('intval', $mm[1])) : 0;
    // Letter landscape: the four charts (47.6 + 79.4 + 63.5 + 84.7 mm tall plus
    // gaps and the heading) do not fit one page, so they spill onto a second
    // charts page: cover + 2 chart pages + data = 4 pages, 4 images.
    ok('pdf: charts make a PDF with chart pages (cover + 2 chart pages + data = 4 pages) holding 4 ' . ($gd ? 'PNG' : 'JPEG') . ' images', is_string($pdf) && strpos($pdf, '%PDF-') === 0 && $pages === 4
        && ($gd ? substr_count($pdf, '/DCTDecode') === 0 : substr_count($pdf, '/DCTDecode') === 4)
        && strpos(logs_from($nP), count($images) . ' chart(s) drawn') !== false, array('pages' => $pages, 'dct' => is_string($pdf) ? substr_count($pdf, '/DCTDecode') : -1, 'len' => is_string($pdf) ? strlen($pdf) : 'false', 'log' => logs_from($nP)));
    if (is_string($pdf)) file_put_contents($outDir . DIRECTORY_SEPARATOR . 'charts.pdf', $pdf);
    $pdf0 = penumbra_generate_pdf('<table><tr><td>x</td></tr></table>', 'No charts', array());
    $pages0 = (is_string($pdf0) && preg_match_all('/\/Count (\d+)/', $pdf0, $mm0)) ? max(array_map('intval', $mm0[1])) : 0;
    ok('pdf: without charts the document is the same two pages as before', is_string($pdf0) && $pages0 === 2 && strpos($pdf0, '/DCTDecode') === false, $pages0);
    $nB = count($GLOBALS['LOGS']);
    $pdfB = penumbra_generate_pdf('<table><tr><td>x</td></tr></table>', 'Bad', array('charts' => array(array('data' => 'not an image', 'type' => 'JPEG', 'width' => 100, 'height' => 50, 'title' => ''), penumbra_vis_pdf_charts($images)[0])));
    $pagesB = (is_string($pdfB) && preg_match_all('/\/Count (\d+)/', $pdfB, $mmB)) ? max(array_map('intval', $mmB[1])) : 0;
    ok('pdf: an unreadable image is skipped with a log line and the good one still draws', is_string($pdfB) && $pagesB === 3 && strpos(logs_from($nB), 'unreadable image') !== false && strpos(logs_from($nB), '1 chart(s) drawn') !== false, logs_from($nB));
    // An alpha PNG handed straight to the plugin: with GD it draws, without GD it
    // is skipped (TCPDF would throw and destroy the document) and, with nothing
    // left to draw, no charts page is added at all.
    $nC = count($GLOBALS['LOGS']);
    $pdfC = penumbra_generate_pdf('<table><tr><td>x</td></tr></table>', 'Alpha', array('charts' => array(array('data' => $images[0]['png'], 'type' => 'PNG', 'width' => $images[0]['width'], 'height' => $images[0]['height'], 'title' => ''))));
    $pagesC = (is_string($pdfC) && preg_match_all('/\/Count (\d+)/', $pdfC, $mmC)) ? max(array_map('intval', $mmC[1])) : 0;
    ok('pdf: an alpha PNG ' . ($gd ? 'draws through GD' : 'is skipped without GD (logged) and no empty charts page is added'),
        is_string($pdfC) && ($gd ? ($pagesC === 3 && strpos(logs_from($nC), '1 chart(s) drawn') !== false)
                                 : ($pagesC === 2 && strpos(logs_from($nC), 'needs GD') !== false && strpos(logs_from($nC), '0 chart(s) drawn') !== false)), array('pages' => $pagesC, 'log' => logs_from($nC)));
} else {
    ok('pdf: plugin copy present under test', false, $pdfPlugin);
}

echo 'RESULTS_JSON:' . json_encode(array('results' => $R, 'logs' => array_slice($GLOBALS['LOGS'], 0, 40))) . "\n";
