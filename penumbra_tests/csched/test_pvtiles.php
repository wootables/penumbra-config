<?php
/**
 * (pvsched, 2026-11-05, the user: "Email + PDF tiles") a pivot saved showing its tiles: its scheduled email's body as the
 * tiles and its PDF a tile a page. The runner is NEVER required (Oracle, mail): its functions come from a MIRROR the
 * suite extracts from the candidate runner (pivotparity/extract_mirror.php: top-level functions and defines only).
 *   php test_pvtiles.php <mirror.php> <penumbra_cards_email.php> <themes_config.php> <penumbra_search.php> <runner (source)>
 *                        <pdf_generator.php> <tcpdf.php> <penumbra_cards.js>
 * Each check prints "  PASS|FAIL  <id>  <detail>" as test_csched.php's.
 */
error_reporting(E_ALL);
$out = array();
function ok($id, $pass, $detail = '') { global $out; $out[] = sprintf("  %s  %-26s %s", $pass ? 'PASS' : 'FAIL', $id, $pass ? '' : $detail); }
list(, $MIR, $INC, $THM, $SRCH, $RUN, $PDFP, $TCPDF, $CJS) = $argv + array_fill(0, 9, '');
$ERRS = array();
set_error_handler(function ($no, $msg, $file, $line) use (&$ERRS, $INC, $MIR) {
    if (realpath($file) === realpath($INC) || realpath($file) === realpath($MIR)) $ERRS[] = basename($file) . ':' . $line . ' ' . $msg;
    return true;
});
require $MIR;
if (is_file($SRCH) && !function_exists('_search_decode_entities')) require $SRCH;
require_once $THM;
$theme_styles = function_exists('penumbra_build_theme_styles') ? penumbra_build_theme_styles() : array();
require $INC;
$run = is_file($RUN) ? file_get_contents($RUN) : '';
$cjs = is_file($CJS) ? file_get_contents($CJS) : '';
$have = function_exists('penumbra_cards_pivot_tiles') && function_exists('penumbra_cards_email_tiles_html') && function_exists('penumbra_cards_pdf_tile_pages') && function_exists('penumbra_cards_tiles_cfg');

// ---- fixtures: three colleges x two years, AMT; two measures (Amt, N); a format rule on Amt; two row fields -------------
$rows = array();
foreach (array('Eng', 'Sci', 'Hum') as $c) foreach (array('2024', '2025') as $y) foreach (array(1, 2) as $k)
    $rows[] = array('COLLEGE' => $c, 'DEPT' => $c . ($k === 1 ? '-A' : '-B'), 'FY' => $y, 'AMT' => (string)(($c === 'Eng' ? 100 : ($c === 'Sci' ? 40 : 7)) * $k + ($y === '2025' ? 5 : 0)));
$set = array('rows' => array('COLLEGE'), 'cols' => array('FY'), 'vals' => 'AMT', 'agg' => array('sum', 'count'), 'aggLabels' => array('Amt', 'N'),
             'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc');
$set2 = array('rows' => array('COLLEGE', 'DEPT'), 'cols' => array('FY'), 'vals' => 'AMT', 'agg' => array('sum'), 'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc');
$fmt = function_exists('parse_format_rules') ? parse_format_rules("format(cell, Amt, Amt > 200, 'color: #c62828')") : array();
$cfgOf = function ($tiles, $extra = array()) { return penumbra_cards_tiles_cfg(array('viewOptions' => array('cards' => array_merge(array('open' => 1, 'tiles' => $tiles), $extra)))); };
$capOf = function ($data, $s, $fr = array()) {
    $GLOBALS['penumbra_pivot_capture'] = array();
    $h = generate_pivot_html($data, $s, 'theme-default', true, $fr);
    $c = $GLOBALS['penumbra_pivot_capture']; unset($GLOBALS['penumbra_pivot_capture']);
    return array($h, $c);
};

// ---- the record: the HTML byte-for-byte the same, the cells as written ------------------------------------------------
$off1 = generate_pivot_html($rows, $set, 'theme-default', true);
list($on1, $cap1) = $capOf($rows, $set);
$offF = generate_pivot_html($rows, $set, 'theme-default', true, $fmt);
list($onF, $capF) = $capOf($rows, $set, $fmt);
$off2 = generate_pivot_html($rows, $set2, 'theme-default', true);
list($on2, $cap2) = $capOf($rows, $set2);
ok('P-pvSame', $on1 === $off1 && $onF === $offF && $on2 === $off2 && strlen($off1) > 1000 && !isset($GLOBALS['penumbra_pivot_capture']), json_encode(array(strlen($off1), strlen($on1), strlen($offF), strlen($onF))));
$r0 = isset($cap1['rows'][0]) ? $cap1['rows'][0] : null;
ok('P-pvCapture', is_array($cap1) && isset($cap1['rows']) && count($cap1['rows']) === 3 && $cap1['measures'] === array('Amt', 'N')
    && $r0 && $r0['parts'] === array('Eng') && $r0['labels'] === array('Eng') && count($r0['cells']) === 4 && (string)$r0['cells'][0]['col'] === '2024' && $r0['cells'][0]['agg'] === 0
    && $r0['cells'][0]['html'] === '300' && $r0['cells'][1]['html'] === '2' && count($r0['totals']) === 2 && $r0['totals'][0]['html'] === '610'
    && $cap1['foot']['label'] === 'Grand Total' && count($cap1['foot']['cells']) === 4 && count($cap1['foot']['totals']) === 2 && $cap1['foot']['totals'][0]['html'] === '912',
    json_encode($r0) . ' foot ' . json_encode(isset($cap1['foot']) ? $cap1['foot'] : null));
$hlEng = isset($capF['rows'][0]['cells'][0]['hl']) ? $capF['rows'][0]['cells'][0]['hl'] : '';
$hlHum = isset($capF['rows'][1]['cells'][0]['hl']) ? $capF['rows'][1]['cells'][0]['hl'] : '';
ok('P-pvCaptureHl', stripos($hlEng, 'color: #c62828') !== false && stripos($hlHum, '#c62828') === false && strpos($hlEng, 'background-color') === false, json_encode(array($hlEng, $hlHum)));

// ---- the tiles: pvTile's choices --------------------------------------------------------------------------------------
$txt = function ($h) { return function_exists('_pnb_pv_txt') ? _pnb_pv_txt($h) : trim(strip_tags((string)$h)); };
$fl = function ($t) use ($txt) { return array_map(function ($f) use ($txt) { return $f['label'] . '=' . $txt($f['html']); }, $t['fields']); };
$t1 = array();
if ($have) {
    $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard'));
    $t1 = (array)penumbra_cards_pivot_tiles($rows, $set, 'theme-default');
}
$last = $t1 ? $t1[count($t1) - 1] : null;
ok('P-pvTiles', count($t1) === 4 && $t1[0]['title'] === 'Eng' && $t1[1]['title'] === 'Hum' && $t1[2]['title'] === 'Sci' && $t1[0]['sub'] === '' && !$t1[0]['total']
    && $txt($t1[0]['big']['html']) === '610' && $t1[0]['big']['label'] === 'Total Amt'
    && $fl($t1[0]) === array('2024 Amt=300', '2024 N=2', '2025 Amt=310', '2025 N=2')
    && $last && $last['total'] && $last['title'] === 'Grand Total' && $txt($last['big']['html']) === '912' && $last['big']['label'] === 'Total Amt'
    && $fl($last) === array('2024 Amt=441', '2024 N=6', '2025 Amt=471', '2025 N=6'),
    json_encode(array_map(function ($t) use ($txt, $fl) { return array($t['title'], $t['big'] ? $txt($t['big']['html']) . '|' . $t['big']['label'] : null, $fl($t), $t['total']); }, $t1)));
// a setup: N the big number, Amt's total the pill, Amt's bar, Amt's fields alone, the path as the title
$t2 = array();
if ($have) {
    $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard', 'big' => 'N', 'pill' => 'Amt', 'bar' => 'Amt', 'fields' => array('Amt'), 'title' => 'path'));
    $t2 = (array)penumbra_cards_pivot_tiles($rows, $set, 'theme-default');
}
ok('P-pvSetup', count($t2) === 4 && $txt($t2[0]['big']['html']) === '4' && $t2[0]['big']['label'] === 'Total N' && $t2[0]['pill'] && $t2[0]['pill']['text'] === '610'
    && $t2[0]['bar'] && (int)round($t2[0]['bar']['w']) === 100 && $t2[1]['bar'] && (int)round($t2[1]['bar']['w']) < (int)round($t2[2]['bar']['w'])
    && $fl($t2[0]) === array('2024 Amt=300', '2025 Amt=310') && $t2[3]['total'] && $t2[3]['bar'] === null && $t2[3]['pill'] === null && $txt($t2[3]['big']['html']) === '912',
    json_encode(array_map(function ($t) use ($txt, $fl) { return array($t['title'], $t['big'] ? $txt($t['big']['html']) . '|' . $t['big']['label'] : null, $t['pill'], $t['bar'], $fl($t)); }, $t2)));
// two row fields, one measure: the parent as the subtitle (or the pill), 'Total' the big number's word, no measure in a label
$t3 = $t4 = array();
if ($have) {
    $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard'));
    $t3 = (array)penumbra_cards_pivot_tiles($rows, $set2, 'theme-default');
    $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard', 'pill' => 'parent'));
    $t4 = (array)penumbra_cards_pivot_tiles($rows, $set2, 'theme-default');
}
ok('P-pvParent', count($t3) === 7 && $t3[0]['title'] === 'Eng-A' && $t3[0]['sub'] === 'Eng' && $t3[0]['big']['label'] === 'Total' && $fl($t3[0]) === array('2024=100', '2025=105')
    && $t4 && $t4[0]['sub'] === '' && $t4[0]['pill'] && $t4[0]['pill']['text'] === 'Eng' && $t3[6]['total'],
    json_encode(array(count($t3), $t3 ? array($t3[0]['title'], $t3[0]['sub'], $t3[0]['big']['label'], $fl($t3[0])) : null, $t4 ? $t4[0]['pill'] : null)));
// the format rule's colour on Eng's Amt values (and only there)
$tF = array();
if ($have) { $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard')); $tF = (array)penumbra_cards_pivot_tiles($rows, $set, 'theme-default', $fmt); }

// ---- the email: the mail-safe cards, the size saved, the Grand Total last, the budget's cut -------------------------------
$em = $have ? penumbra_cards_email_tiles_html($t1, $cfgOf(array('size' => 'standard')), 'theme-default', 0) : null;
$cardsIn = function ($h) { preg_match_all('#<td valign="top" width="\d+%" style="padding:5px;"><div style="border:1px solid [^"]*border-radius:8px;[^"]*">(.*?)</div></td>#s', (string)$h, $m); return $m[1]; };
$ec = $em ? $cardsIn($em['html']) : array();
$titleOf = function ($c) { return preg_match('#^<div style="font-weight:bold;[^"]*">(.*?)</div>#s', $c, $m) ? html_entity_decode($m[1], ENT_QUOTES, 'UTF-8') : null; };
ok('P-pvEmail', $em && $em['shown'] === 4 && $em['total'] === 4 && !$em['truncated'] && count($ec) === 4 && $titleOf($ec[0]) === 'Eng' && $titleOf($ec[3]) === 'Grand Total'
    && strpos($ec[0], '>610</span> <span') !== false && strpos($ec[0], '>Total Amt</span>') !== false && strpos($ec[0], 'white-space:nowrap;">2024 Amt</td>') !== false
    && !preg_match('/\sclass=/', $em['html']) && strpos($em['html'], 'var(--') === false && stripos($em['html'], '<dl') === false && substr_count($em['html'], '<td valign="top" width="33%"') === 4,
    $em ? substr($em['html'], 0, 700) : 'no include');
$emF = ($have && $tF) ? penumbra_cards_email_tiles_html($tF, $cfgOf(array('size' => 'standard')), 'theme-default', 0) : null;
$ecF = $emF ? $cardsIn($emF['html']) : array();
ok('P-pvEmailHl', count($ecF) === 4 && strpos($ecF[0], 'color:#c62828;">300</span>') !== false && strpos($ecF[1], '#c62828') === false, $ecF ? substr($ecF[0], 0, 900) : '');
// (mailhid's rule) a value its highlight paints in its own fill mails blank, its label kept (int-col-mat's diagonal "$0")
$fmtH = function_exists('parse_format_rules') ? parse_format_rules("format(cell, Amt, Amt > 200, 'color: #00ff41; background-color: #00ff41')") : array();
$tH = array();
if ($have) { $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard')); $tH = (array)penumbra_cards_pivot_tiles($rows, $set, 'theme-default', $fmtH); }
$emH = ($have && $tH) ? penumbra_cards_email_tiles_html($tH, $cfgOf(array('size' => 'standard')), 'theme-default', 0) : null;
$ecH = $emH ? $cardsIn($emH['html']) : array();
ok('P-pvEmailHid', count($ecH) === 4 && strpos($ecH[0], 'white-space:nowrap;">2024 Amt</td><td valign="top" style="padding:2px 0;font-size:11px;color:') !== false
    && preg_match('#>2024 Amt</td><td valign="top" style="[^"]*">&nbsp;</td>#', $ecH[0]) && strpos($ecH[0], '>300</span>') === false && strpos($ecH[1], '>21</span>') !== false,
    $ecH ? substr($ecH[0], 0, 900) : '');
// (hidfix, 2026-11-05, the user's scheduled int-col-mat tiles email) the report's own rule form: the fill "!important",
// the text not. The runner resolves both to one colour and the priority stays on the fill: still hidden (the browser's
// mailHid never reads a priority); two colours stay two however they are ruled
ok('P-hidImp', function_exists('_pnb_cm_hid') && _pnb_cm_hid(array('background-color' => '#336699 !important', 'color' => '#336699'))
    && _pnb_cm_hid(array('background-color' => '#336699', 'color' => '#336699 ! IMPORTANT')) && !_pnb_cm_hid(array('background-color' => '#ffebee !important', 'color' => '#c62828'))
    && !_pnb_cm_hid(array('background-color' => '!important', 'color' => '')), '');
$prepI = function_exists('prepare_format_rules') ? prepare_format_rules(parse_format_rules("format(cell, AMT, AMT = 0, 'background-color: var(--brand-primary) !important; color: var(--brand-primary)')"), array('NAME', 'AMT'), null, 'theme-default') : null;
$fI = $prepI ? evaluate_row_formatting(array('NAME' => 'A', 'AMT' => 0), 0, $prepI['row'], $prepI['cell'], isset($prepI['heat']) ? $prepI['heat'] : array()) : null;
$cssI = ($fI && isset($fI['cells']['AMT'])) ? $fI['cells']['AMT'] : null;
ok('P-hidImpFlat', is_array($cssI) && isset($cssI['background-color']) && stripos((string)$cssI['background-color'], 'important') !== false && _pnb_cm_hid($cssI), json_encode($cssI));
$fmtI = function_exists('parse_format_rules') ? parse_format_rules("format(cell, Amt, Amt > 200, 'background-color: var(--brand-primary) !important; color: var(--brand-primary)')") : array();
$tI = array();
if ($have) { $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard')); $tI = (array)penumbra_cards_pivot_tiles($rows, $set, 'theme-default', $fmtI); }
$emI = ($have && $tI) ? penumbra_cards_email_tiles_html($tI, $cfgOf(array('size' => 'standard')), 'theme-default', 0) : null;
$ecI = $emI ? $cardsIn($emI['html']) : array();
ok('P-pvEmailHidImp', count($ecI) === 4 && preg_match('#>2024 Amt</td><td valign="top" style="[^"]*">&nbsp;</td>#', $ecI[0]) && strpos($ecI[0], '>300</span>') === false
    && strpos($emI['html'], '!important') === false && strpos($ecI[1], '>21</span>') !== false, $ecI ? substr($ecI[0], 0, 900) : '');
// (tilegap, 2026-11-06, the user: "the boxes are not consistent sizes if the columns had no value so it looks different
// from the browser") a column with no value keeps its line, blank, as the tile on screen lists it: every tile as many
// lines as it has fields; with no labels the blank goes (the screen's empty value takes no line); the PDF page lists it
$rowsG = array_values(array_filter($rows, function ($r) { return !($r['COLLEGE'] === 'Hum' && $r['FY'] === '2025'); }));
$tG = array();
if ($have) { $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard')); $tG = (array)penumbra_cards_pivot_tiles($rowsG, $set, 'theme-default'); }
$fldG = array(); $humT = null;
foreach ($tG as $t) { $fldG[] = count($t['fields']); if ($t['title'] === 'Hum') $humT = $t; }
$humBlank = $humT ? count(array_filter($humT['fields'], function ($f) { return _pnb_pv_txt($f['html']) === ''; })) : 0;
$emG = ($have && $tG) ? penumbra_cards_email_tiles_html($tG, $cfgOf(array('size' => 'standard')), 'theme-default', 0) : null;
$ecG = $emG ? $cardsIn($emG['html']) : array();
$linesG = array_map(function ($c) { return substr_count($c, 'white-space:nowrap;">'); }, $ecG);
$humG = ''; foreach ($ecG as $c) if (strpos($c, '>Hum</div>') !== false) $humG = $c;
ok('P-pvBlankCol', count($ecG) === 4 && $humBlank > 0 && $linesG === $fldG && count(array_unique($linesG)) === 1
    && preg_match('#white-space:nowrap;">2025 Amt</td><td valign="top" style="[^"]*">(<span style="[^"]*"></span>|&nbsp;)</td>#', $humG) === 1,
    json_encode(array('lines' => $linesG, 'fields' => $fldG, 'humBlank' => $humBlank)) . ' ' . substr($humG, 0, 700));
$emGn = ($have && $tG) ? penumbra_cards_email_tiles_html($tG, $cfgOf(array('size' => 'standard', 'nolabels' => 1)), 'theme-default', 0) : null;
$ecGn = $emGn ? $cardsIn($emGn['html']) : array();
$humGn = ''; foreach ($ecGn as $c) if (strpos($c, '>Hum</div>') !== false) $humGn = $c;
ok('P-pvBlankColNoLabels', count($ecGn) === 4 && $humT && $humBlank > 0 && substr_count($humGn, '<td valign="top" style="padding:2px 0;') === count($humT['fields']) - $humBlank
    && strpos($humGn, 'white-space:nowrap;">') === false, substr($humGn, 0, 700));
$pdG = $tG ? penumbra_cards_pdf_tile_pages($tG, 'Gap report') : null;
$pgHum = ''; if ($pdG) foreach ($pdG['pages'] as $pg) if (strpos($pg, '>Hum</td>') !== false) $pgHum = $pg;
ok('P-pvPdfBlankCol', $pgHum !== '' && $humT && substr_count($pgHum, '<td width="32%"') === count($humT['fields'])
    && preg_match('#>2025 Amt</td><td width="68%" style="[^"]*"></td>#', $pgHum) === 1, substr($pgHum, 0, 900));
$emL = $have ? penumbra_cards_email_tiles_html($t1, $cfgOf(array('size' => 'large', 'nolabels' => 1)), 'theme-default', 0) : null;
ok('P-pvEmailSize', $emL && substr_count($emL['html'], '<td valign="top" width="50%"') === 4 && strpos($emL['html'], 'white-space:nowrap;') === false && strpos($emL['html'], 'font-size:22px') !== false,
    $emL ? substr($emL['html'], 0, 400) : '');
$one = ($em && $ec) ? strlen('<td valign="top" width="33%" style="padding:5px;"><div') + strlen($ec[0]) : 0;
$emC = $have ? penumbra_cards_email_tiles_html($t1, $cfgOf(array('size' => 'standard')), 'theme-default', 2 * $one + 300) : null;
ok('P-pvEmailCut', $emC && $emC['truncated'] && $emC['shown'] >= 1 && $emC['shown'] < 4 && $emC['total'] === 4, json_encode($emC ? array($emC['shown'], $emC['total'], $emC['truncated']) : null));

// ---- the PDF: a tile a page, TCPDF-safe, the cap's last page ------------------------------------------------------------
$pp = $have ? penumbra_cards_pdf_tile_pages($t1, 'Tiles <R>') : null;
$pg = $pp ? $pp['pages'] : array();
ok('P-pvPdfPages', count($pg) === 4 && strpos($pg[0], 'Card 1 of 4') !== false && strpos($pg[0], 'Tiles &lt;R&gt;') !== false && strpos($pg[0], '>Eng</td>') !== false
    && strpos($pg[3], 'Card 4 of 4') !== false && strpos($pg[3], '>Grand Total</td>') !== false && strpos($pg[0], '>2024 Amt</td>') !== false && strpos($pg[0], '>300</td>') !== false
    && !array_filter($pg, function ($h) { return strpos($h, 'border-radius') !== false || strpos($h, 'class=') !== false || strpos($h, 'var(--') !== false; }),
    $pg ? substr($pg[0], 0, 700) : json_encode($pp));
$pc = $have ? penumbra_cards_pdf_tile_pages($t1, 'R', 2) : null;
ok('P-pvPdfCap', $pc && count($pc['pages']) === 3 && $pc['shown'] === 2 && $pc['total'] === 4 && $pc['truncated']
    && strpos(end($pc['pages']), 'Showing 2 of 4 cards - 2 cards were left out to keep this PDF a workable size.') !== false, json_encode($pc ? array($pc['shown'], $pc['total']) : null));
// the runner's PDF ask: tiles over a pivot saved showing them (the task's context), else null - never the flat cards
$pf = $pn = $px = $pz = 'unset';
if ($have) {
    $GLOBALS['penumbra_cards_tiles'] = $cfgOf(array('size' => 'standard'));
    $GLOBALS['penumbra_cards_tiles_ctx'] = array('settings' => $set, 'theme' => 'theme-default', 'format' => array(), 'rewrite' => array());
    $GLOBALS['penumbra_cards_email'] = null;
    $pf = penumbra_cards_pdf_for($rows, 'pivot', 'R');
    $GLOBALS['penumbra_cards_tiles_ctx'] = null;
    $pn = penumbra_cards_pdf_for($rows, 'pivot', 'R');
    $GLOBALS['penumbra_cards_tiles_ctx'] = array('settings' => $set, 'theme' => 'theme-default', 'format' => array(), 'rewrite' => array());
    $GLOBALS['penumbra_cards_tiles'] = null;
    $px = penumbra_cards_pdf_for($rows, 'pivot', 'R');
    $GLOBALS['penumbra_cards_email'] = array('title' => 'COLLEGE', 'sub' => array(), 'big' => 'AMT', 'pill' => '', 'bar' => '', 'fields' => array(), 'nolabels' => false, 'lists' => array(), 'size' => 'standard');
    $pz = penumbra_cards_pdf_for($rows, 'pivot', 'R');
    $GLOBALS['penumbra_cards_email'] = null;
}
ok('P-pvPdfFor', is_array($pf) && count($pf) === 4 && $pn === null && $px === null && $pz === null, json_encode(array(is_array($pf) ? count($pf) : $pf, $pn, $px, is_array($pz) ? count($pz) : $pz)));
// a real TCPDF render: the cover, then the tile pages
$pdfOk = false; $pdfInfo = '';
if ($have && $pg && is_file($PDFP) && is_file($TCPDF)) {   // the candidate plugin, live's TCPDF behind it (test_csched.php's way)
    $src = str_replace("__DIR__ . '/lib/tcpdf/tcpdf.php'", var_export($TCPDF, true), file_get_contents($PDFP));
    $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_pvt_' . getmypid() . '.php'; file_put_contents($tmp, $src);
    require_once $tmp;
    if (function_exists('penumbra_generate_pdf')) {
        $o = array('orientation' => 'landscape', 'paper_size' => 'letter', 'timestamp' => 'November 5, 2026, 2:30 pm', 'row_text' => 'Rows: 12');
        $bin = penumbra_generate_pdf('<table><tr><td>the table</td></tr></table>', 'Tile Report', $o + array('card_pages' => $pg));
        preg_match_all('#/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]#', (string)$bin, $mb, PREG_SET_ORDER);
        $orient = array_map(function ($x) { return ((float)$x[3] - (float)$x[1]) > ((float)$x[4] - (float)$x[2]) ? 'L' : 'P'; }, $mb);
        $pdfOk = $orient === array('L', 'P', 'P', 'P', 'P');   // the cover, then a portrait page per tile
        $pdfInfo = json_encode(array($orient, is_string($bin) ? strlen($bin) : $bin));
        if (getenv('PNB_PVT_OUT') && is_string($bin)) file_put_contents(getenv('PNB_PVT_OUT'), $bin);   // a look at it
    } else $pdfInfo = 'no penumbra_generate_pdf';
    @unlink($tmp);
}
ok('P-pvPdfRender', $pdfOk, $pdfInfo);

// ---- the saved setup -------------------------------------------------------------------------------------------------
$c0 = $have ? penumbra_cards_tiles_cfg(array('viewOptions' => array('cards' => array('tiles' => array('size' => 'large'))))) : 'x';
$c1 = $have ? $cfgOf(array('size' => 'xl', 'big' => 'total', 'pill' => '<b>x</b>', 'fields' => array('Amt', '', 'N'), 'nolabels' => 1, 'title' => 'path'), array('pivot' => array('big' => 'N'), 'size' => 'compact')) : null;
$c2 = $have ? penumbra_cards_tiles_cfg(array('viewOptions' => array('cards' => array('open' => 1, 'pivot' => array('big' => 'N', 'bar' => 'Amt'), 'size' => 'compact')))) : null;
ok('P-pvCfg', $c0 === null && is_array($c1) && $c1['size'] === 'xl' && $c1['big'] === '' && $c1['pill'] === '' && $c1['fields'] === array('Amt', 'N') && $c1['nolabels'] && $c1['title'] === 'path'
    && is_array($c2) && $c2['big'] === 'N' && $c2['bar'] === 'Amt' && $c2['size'] === 'compact', json_encode(array($c0, $c1, $c2)));

// ---- the runner's wiring (by source: the runner is never required) and the browser's saved tiles ----------------------------
$runN = str_replace("\r\n", "\n", $run);
ok('S-pvWired', strpos($runN, "\$GLOBALS['penumbra_cards_tiles'] = function_exists('penumbra_cards_tiles_cfg') ? penumbra_cards_tiles_cfg(\$state) : null;") !== false
    && strpos($runN, "log_scheduler(\"Processing Task #\$taskId ({\$task['SUBJECT']})...\");\n            \$GLOBALS['penumbra_cards_tiles_ctx'] = null;") !== false
    && strpos($runN, "\$GLOBALS['penumbra_cards_tiles_ctx'] = array('settings' => (isset(\$apiResult['pivot']) ? \$apiResult['pivot'] : null), 'theme' => &\$themeName, 'format' => &\$emailFormatRules, 'rewrite' => &\$emailRewriteRules);") !== false
    && strpos($runN, "\$_tilesHere = penumbra_cards_pivot_tiles(\$data, \$pivotSettings, \$themeName, \$formatRules, \$rewriteRules);") !== false
    && substr_count($runN, 'if ($_pcap !== null)') === 12,
    'the tiles cfg, the per-task context reset and record, the body branch, the 12 recorders + the finish');
ok('S-pvSaved', strpos($cjs, "if (H.inPivot()) { var tv = { size: curSize() }, tp = cleanPivot(pvSetup()), tk; if (tp) for (tk in tp) tv[tk] = tp[tk]; return { open: 1, tiles: tv }; }") !== false,
    'cards.js savedView saves a pivot\'s tiles (size + setup)');
ok('P-pvNoWarnings', empty($ERRS), implode(' | ', array_slice(array_unique($ERRS), 0, 4)));
echo implode("\n", $out) . "\n";
