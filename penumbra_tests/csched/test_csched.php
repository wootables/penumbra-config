<?php
// csched suite (2026-11-01): the scheduled email's cards - penumbra_cards_email.php run on its own (the runner is never
// required: Oracle and mail), with the runner's delimiter split LIFTED from its text, the real theme registry and search
// decoder; plus source checks on the runner's wiring. Prints "  PASS|FAIL  <id>  <detail>" lines.
// usage: php test_csched.php <include> <schedule_runner.php> <themes_config.php> <penumbra_search.php> <penumbra_cards.js>
error_reporting(E_ALL); ini_set('display_errors', '1');
list(, $INC, $RUN, $THM, $SRCH, $CJS) = $argv + array_fill(0, 6, '');
$out = array();
function ok($id, $pass, $detail = '') { global $out; $out[] = sprintf("  %s  %-26s %s", $pass ? 'PASS' : 'FAIL', $id, $pass ? '' : $detail); }
$run = is_file($RUN) ? file_get_contents($RUN) : '';
$cjs = is_file($CJS) ? file_get_contents($CJS) : '';

// the runner's split, lifted (brace-counted from "function NAME(")
function lift($src, $name) {
    $i = strpos($src, "function $name(");
    if ($i === false) return '';
    $j = strpos($src, '{', $i); $d = 0; $n = strlen($src);
    for ($k = $j; $k < $n; $k++) { $c = $src[$k]; if ($c === '{') $d++; elseif ($c === '}') { $d--; if ($d === 0) return substr($src, $i, $k - $i + 1); } }
    return '';
}
if (preg_match("/define\('PENUMBRA_GROUP_PATH_SEP',[^;]*\);/", $run, $m)) eval($m[0]);
if (is_file($SRCH) && !function_exists('_search_decode_entities')) require $SRCH;
foreach (array('penumbra_group_delim_def', 'penumbra_delim_decode_entities', 'penumbra_group_delim_pieces', 'penumbra_sched_notes_col') as $f) { $code = lift($run, $f); if ($code !== '' && !function_exists($f)) eval($code); }
if (is_file($THM)) require_once $THM;
$have = is_file($INC);
if ($have) require $INC;
// every warning / notice the include raises from here on is a failure (the runner would log each one)
$ERRS = array();
set_error_handler(function ($no, $msg, $file, $line) use (&$ERRS, $INC) { if (realpath($file) === realpath($INC)) $ERRS[] = basename($file) . ':' . $line . ' ' . $msg; return true; });
if (!$have || !function_exists('penumbra_cards_email_html')) {
    echo "  FAIL  F-include                 no penumbra_cards_email.php at $INC\n"; exit(0);
}

// ---- the saved view ------------------------------------------------------------------------------
$st = function ($c) { return array('viewOptions' => array('cards' => $c)); };
ok('P-cfgNoOpen', penumbra_cards_email_cfg($st(array('title' => 'A', 'sent' => array('title' => 'A')))) === null);
ok('P-cfgNoSent', penumbra_cards_email_cfg($st(array('open' => 1, 'title' => 'A'))) === null);
ok('P-cfgNone', penumbra_cards_email_cfg(array()) === null && penumbra_cards_email_cfg($st(array('open' => 1, 'sent' => array('pill' => 'S')))) === null);
$c = penumbra_cards_email_cfg($st(array('open' => 1, 'size' => 'xl', 'sent' => array('title' => 'v_id', 'sub' => array('a', 'b', 'c'), 'big' => '<b>x', 'fields' => array_map(function ($i) { return 'f' . $i; }, range(1, 20)),
    'nolabels' => 1, 'lists' => array('f1' => 'dsemi', 'f2' => 'dbogus', '<i>' => 'dpipe')))));
ok('P-cfgParse', is_array($c) && $c['title'] === 'V_ID' && $c['sub'] === array('A', 'B') && $c['big'] === '' && count($c['fields']) === 16 && $c['fields'][0] === 'F1'
    && $c['nolabels'] === true && $c['lists'] === array('F1' => 'dsemi') && $c['size'] === 'xl', json_encode($c));
$c2 = penumbra_cards_email_cfg($st(array('open' => true, 'size' => 'huge', 'sent' => array('title' => 'A'))));
ok('P-cfgSize', is_array($c2) && $c2['size'] === 'standard' && $c2['nolabels'] === false, json_encode($c2));
// (csz, the user) the size the cards showed when saved (sent.size) wins over the report's; none (saved before) or a bad one: the report's
$sz4 = array_map(function ($z) use ($st) { $x = array('title' => 'A'); if ($z !== null) $x['size'] = $z; $r = penumbra_cards_email_cfg($st(array('open' => 1, 'size' => 'large', 'sent' => $x))); return $r ? $r['size'] : null; }, array('xl', 'standard', null, 'huge'));
ok('P-cfgSentSize', $sz4 === array('xl', 'standard', 'large', 'large'), json_encode($sz4));

// ---- the theme ---------------------------------------------------------------------------------------
$T = penumbra_get_themes();
$roleOk = function ($id) use ($T) { $r = penumbra_cards_email_theme($id); $v = isset($T[$id]['vars']) ? $T[$id]['vars'] : array(); if (!isset($v['bg-surface'], $v['text-main'], $v['bg-surface-alt'], $v['border-color'], $v['brand-primary'], $v['bg-body'], $v['text-muted'])) return false;
    return $r['card'] === $v['bg-surface'] && $r['text'] === $v['text-main'] && $r['alt'] === $v['bg-surface-alt'] && $r['border'] === $v['border-color'] && $r['brand'] === $v['brand-primary'] && $r['paper'] === $v['bg-body'] && $r['muted'] === $v['text-muted']; };
ok('P-themeDefault', $roleOk('theme-default'), json_encode(penumbra_cards_email_theme('theme-default')));
ok('P-themeDark', $roleOk('theme-dark-blue') && penumbra_cards_email_theme('theme-dark-blue')['card'] !== penumbra_cards_email_theme('theme-default')['card']);
ok('P-themeUnknown', penumbra_cards_email_theme('theme-no-such') === penumbra_cards_email_theme('theme-default'));
$allOk = true; $bad = array(); foreach (array_keys($T) as $id) { if (!$roleOk($id) && isset($T[$id]['vars']['bg-surface'])) { $allOk = false; $bad[] = $id; } }
ok('P-themeAll', $allOk, implode(',', $bad));
// parity with js/penumbra_cards.js: MAIL_THEME's roles and defaults, MAIL_SIZE (cmsize: the cards a row, padding, type)
$jsTheme = array(); $jsSize = array();
if (preg_match('/var MAIL_THEME = \{(.*?)\};/s', $cjs, $m)) { preg_match_all("/(\w+): \['([\w-]+)', '(#[0-9a-fA-F]+)'\]/", $m[1], $mm, PREG_SET_ORDER); foreach ($mm as $x) $jsTheme[$x[1]] = array($x[2], $x[3]); }
if (preg_match('/var MAIL_SIZE = \{(.*?)\r?\n    \};/s', $cjs, $m)) { preg_match_all("/(\w+): \{ cols: (\d), pad: '([^']+)', title: (\d+), sub: (\d+), big: (\d+), field: (\d+), label: (\d+) \}/", $m[1], $mm, PREG_SET_ORDER);
    foreach ($mm as $x) $jsSize[$x[1]] = array('cols' => (int)$x[2], 'pad' => $x[3], 'title' => (int)$x[4], 'sub' => (int)$x[5], 'big' => (int)$x[6], 'field' => (int)$x[7], 'label' => (int)$x[8]); }
ok('P-parityTheme', $jsTheme && $jsTheme === $GLOBALS['PENUMBRA_CARDS_MAIL_THEME'], json_encode($jsTheme));
ok('P-paritySize', count($jsSize) === 4 && isset($GLOBALS['PENUMBRA_CARDS_MAIL_SIZE']) && $jsSize === $GLOBALS['PENUMBRA_CARDS_MAIL_SIZE'], json_encode($jsSize));

// ---- the cards -----------------------------------------------------------------------------------------
$rows = array(
    array('ID' => 'ID-1', 'NAME' => 'Ann', 'STATUS' => 'Open', 'AMT' => '$1,000.00', 'NUM' => '10', 'PEOPLE' => 'Palmtag, Scott; Smith, Jo;Smith, Jo', 'PCT' => '40%', 'NOTE' => 'x'),
    array('ID' => 'ID-2', 'NAME' => 'Ben', 'STATUS' => 'Closed', 'AMT' => '$2,000.00', 'NUM' => '20', 'PEOPLE' => '@@HTML<a href="#">Kumar, Ravi;Okafor, Ada</a>', 'PCT' => '75%', 'NOTE' => ''),
    array('ID' => '', 'NAME' => 'Cy', 'STATUS' => 'Open', 'AMT' => '$3,000.00', 'NUM' => '30', 'PEOPLE' => 'Kumar, Ravi', 'PCT' => '', 'NOTE' => ''),
    array('ID' => 'ID-4', 'NAME' => '', 'STATUS' => '', 'AMT' => '', 'NUM' => '0', 'PEOPLE' => '', 'PCT' => '', 'NOTE' => ''),
    array('ID' => 'ID-5', 'NAME' => 'Eli', 'STATUS' => 'Open', 'AMT' => '$5,000.00', 'NUM' => '50', 'PEOPLE' => 'Byrne, Cara|Tanaka, Yui', 'PCT' => '', 'NOTE' => ''),
);
$CSS = array(1 => array('STATUS' => array('background-color' => '#ffebee', 'color' => '#c62828')), 4 => array('NUM' => array('background-image' => 'linear-gradient(90deg, #ff9800 0%, #ff9800 33%, transparent 33%)')));
$ROWCSS = array(2 => array('background-color' => '#fff3e0'));
$calls = 0;
$cellFn = function ($row, $idx, $cols) use ($CSS, $ROWCSS, &$calls) {
    $calls++;
    $o = array('row' => isset($ROWCSS[$idx]) ? $ROWCSS[$idx] : array(), 'cells' => array());
    foreach ($cols as $c) { if (!array_key_exists($c, $row)) continue; $raw = $row[$c];
        $o['cells'][strtoupper($c)] = array('raw' => $raw, 'html' => (substr($raw, 0, 6) === '@@HTML' ? substr($raw, 6) : htmlspecialchars($raw)), 'css' => isset($CSS[$idx][$c]) ? $CSS[$idx][$c] : array()); }
    return $o;
};
$cfg = penumbra_cards_email_cfg($st(array('open' => 1, 'sent' => array('title' => 'ID', 'sub' => array('NAME'), 'pill' => 'STATUS', 'big' => 'AMT', 'bar' => 'NUM',
    'fields' => array('PEOPLE', 'GONE', 'NOTE'), 'lists' => array('PEOPLE' => 'dsemi')))));
$r = penumbra_cards_email_html($rows, false, $cfg, 'theme-default', $cellFn, 0);
$h = $r['html'];
$cards = function ($h) { preg_match_all('/<div style="border:1px solid [^"]*border-radius:8px;[^"]*">(.*?)<\/div><\/td>/s', $h, $m); return $m[1]; };
$cs = $cards($h);
$th = penumbra_cards_email_theme('theme-default');
ok('P-count', count($cs) === 5 && $r['shown'] === 5 && $r['total'] === 5 && !$r['truncated'] && $calls === 5, count($cs) . ' ' . json_encode(array($r['shown'], $r['total'], $calls)));
ok('P-cols', substr_count($h, '<tr><td valign="top" width="33%"') === 2, (string)substr_count($h, '<tr><td valign="top" width="33%"'));   // (cmsize) Standard: three a row
ok('P-title', strpos($cs[0], '>ID-1</span></div>') !== false && strpos($cs[2], '(blank)') !== false, substr($cs[2], 0, 200));
ok('P-sub', strpos($cs[0], 'color:' . $th['muted'] . ';margin:0 0 4px;"><span style="">Ann</span></div>') !== false && strpos($cs[3], 'margin:0 0 4px;') === false);
ok('P-pillRuled', strpos($cs[1], 'border-radius:10px;font-size:11px;border:1px solid transparent;color:#c62828;background-color:#ffebee;">Closed</span>') !== false, substr($cs[1], 0, 400));   // (cfb8) the rule's colours, the outline clear
// (cedge, 2026-11-03) the status edge: the Closed card's border-left in its pill's rule colour - the dark red text over
// the pale fill (the more colourful); no other card one. The pick: a green fill over white text = the fill (on a white
// card and a dark one); white text alone on a white card = none (the card's own colour)
preg_match_all('/<div style="(border:1px solid [^"]*border-radius:8px;[^"]*)">/', $h, $_esm); $_es = $_esm[1];
ok('P-edge', count($_es) === 5 && substr($_es[1], -strlen('border-left:4px solid #c62828;')) === 'border-left:4px solid #c62828;'
    && strpos($_es[0] . $_es[2] . $_es[3] . $_es[4], 'border-left') === false, json_encode($_es));
$_eg = function_exists('_pnb_cm_edge') ? array(_pnb_cm_edge(array('background-color' => '#2e7d32', 'color' => '#ffffff'), '#ffffff'), _pnb_cm_edge(array('background-color' => '#2e7d32', 'color' => '#ffffff'), '#1e1e1e'),
    _pnb_cm_edge(array('color' => '#ffffff'), '#ffffff'), _pnb_cm_edge(array('color' => 'rgb(198, 40, 40)', 'background-color' => 'rgba(198, 40, 40, 0.1)'), '#ffffff')) : null;
ok('P-edgePick', $_eg === array('#2e7d32', '#2e7d32', '', 'rgb(198, 40, 40)'), json_encode($_eg));
ok('P-pillThemed', strpos($cs[0], 'border-radius:10px;font-size:11px;border:1px solid ' . $th['text'] . ';color:' . $th['text'] . ';">Open</span>') !== false && strpos($cs[3], 'border-radius:10px') === false);   // (cfb8) outlined as on screen, no fill
ok('P-big', strpos($cs[0], 'font-size:19px;font-weight:bold;color:' . $th['text'] . ';">$1,000.00</span> <span style="font-size:11px;color:' . $th['muted'] . ';">AMT</span>') !== false);
// bars: the rank among 10 20 30 0 50 (abs, sorted 0 10 20 30 50): 10 -> 25%, 30 -> 75%; row 5's own gradient 33% in its colour; 0 draws a 1% floor? no: 0 -> rank 0 -> max(1) width
preg_match_all('/<td width="(\d+)%" style="height:6px;font-size:0;line-height:0;background-color:([^;]+);"/', $h, $bm, PREG_SET_ORDER);
$bw = array_map(function ($x) { return $x[1] . '@' . $x[2]; }, $bm);
// (csw2) a Percent format's bar: the shown percentage (the raw fraction's rank before), as js barOf
$pf = function ($row, $idx, $cols) { $o = array('row' => array(), 'cells' => array()); foreach ($cols as $c) { if (!array_key_exists($c, $row)) continue; $raw = $row[$c];
    $o['cells'][strtoupper($c)] = array('raw' => $raw, 'html' => htmlspecialchars($c === 'NUM' ? rtrim(rtrim(number_format($raw * 100, 1), '0'), '.') . '%' : $raw), 'css' => array()); } return $o; };
$pr = array(); foreach (array('0.125', '0.5', '0.8') as $i => $v) $pr[] = array('ID' => 'P' . $i, 'NUM' => $v);
$ph = penumbra_cards_email_html($pr, false, penumbra_cards_email_cfg($st(array('open' => 1, 'sent' => array('title' => 'ID', 'bar' => 'NUM')))), 'theme-default', $pf, 0);
preg_match_all('/<td width="(\d+)%" style="height:6px;/', $ph['html'], $pm);
ok('P-pctShown', $pm[1] === array('13', '50', '80'), json_encode($pm[1]));
ok('P-bars', $bw === array('25@' . $th['brand'], '50@' . $th['brand'], '75@' . $th['brand'], '1@' . $th['brand'], '33@#ff9800'), json_encode($bw));
ok('P-chips', substr_count($cs[0], 'border-radius:9px;') === 2 && strpos($cs[0], '>Palmtag, Scott</span>') !== false && strpos($cs[0], '>Smith, Jo</span>') !== false
    && strpos($cs[0], 'background-color:' . $th['alt'] . ';color:' . $th['text'] . ';">Palmtag') !== false, substr($cs[0], 0, 900));
ok('P-chipsHtmlKept', substr_count($cs[1], 'border-radius:9px;') === 0 && strpos($cs[1], '<a href="#">Kumar, Ravi;Okafor, Ada</a>') !== false);
ok('P-chipsOther', substr_count($cs[4], 'border-radius:9px;') === 1 && strpos($cs[4], '>Byrne, Cara|Tanaka, Yui</span>') !== false);   // dsemi: a pipe is not its delimiter - one value, one chip (the screen's oneValue)
ok('P-hiddenLeftOff', strpos($h, 'GONE') === false);
ok('P-labels', strpos($cs[0], 'white-space:nowrap;">PEOPLE</td>') !== false && strpos($cs[0], '>NOTE</td>') !== false && strpos($cs[1], '>NOTE</td>') === false);
ok('P-rowCss', strpos($h, 'font-family:Verdana,sans-serif;background-color:#fff3e0;">') !== false);
ok('P-cardThemed', strpos($h, 'border:1px solid ' . $th['border'] . ';border-radius:8px;padding:11px 12px;background-color:' . $th['card'] . ';color:' . $th['text'] . ';') !== false
    && strpos($h, 'background-color:' . $th['paper'] . ';color:' . $th['text'] . ';padding:6px;') !== false);
ok('P-plain', !preg_match('/\sclass=|var\(--/', $h));
$cfgN = $cfg; $cfgN['nolabels'] = true;
ok('P-nolabels', strpos(penumbra_cards_email_html($rows, false, $cfgN, 'theme-default', $cellFn, 0)['html'], 'white-space:nowrap;') === false);
$cfgC = $cfg; $cfgC['size'] = 'compact'; $hc = penumbra_cards_email_html($rows, false, $cfgC, 'theme-default', $cellFn, 0)['html'];
ok('P-compact', substr_count($hc, '<tr><td valign="top" width="25%"') === 2 && strpos($hc, 'height:6px') === false && strpos($hc, 'border-radius:9px') === false && strpos($hc, 'margin:0 0 4px;') === false);
$cfgX = $cfg; $cfgX['size'] = 'xl'; $hx = penumbra_cards_email_html($rows, false, $cfgX, 'theme-default', $cellFn, 0)['html'];
ok('P-xl', substr_count($hx, '<tr><td valign="top" width="100%"') === 5);
// (cmsize, the user: the sizes were not respected) Large is not Standard: two a row, its own type and padding; Extra large's
$cfgL = $cfg; $cfgL['size'] = 'large'; $hl = penumbra_cards_email_html($rows, false, $cfgL, 'theme-default', $cellFn, 0)['html'];
ok('P-large', substr_count($hl, '<tr><td valign="top" width="50%"') === 3 && strpos($hl, 'font-size:15px;font-weight:bold;') !== false && strpos($hl, 'font-size:22px;font-weight:bold;') !== false
    && strpos($hl, 'padding:14px 16px;') !== false && strpos($hl, 'padding:2px 0;font-size:12px;') !== false && strpos($hl, 'font-size:13px;font-weight:bold;') === false, substr($hl, 0, 300));
ok('P-xlType', strpos($hx, 'font-size:17px;font-weight:bold;') !== false && strpos($hx, 'font-size:26px;font-weight:bold;') !== false && strpos($hx, 'padding:18px 20px;') !== false
    && strpos($hx, 'padding:2px 0;font-size:13px;') !== false);
$one = preg_match('/<td valign="top" width="33%" style="padding:5px;"><div.*?<\/div><\/td>/s', $h, $om) ? strlen($om[0]) : 2000;
$rb = penumbra_cards_email_html($rows, false, $cfg, 'theme-default', $cellFn, 2 * $one + 400);   // room for about two cards
ok('P-budget', $rb['truncated'] && $rb['shown'] >= 2 && $rb['shown'] < 5 && $rb['total'] === 5 && count($cards($rb['html'])) === $rb['shown'], json_encode(array($rb['shown'], $rb['total'], $rb['truncated'])));
// grouped: a path's levels by the runner's separator; the theme's group palette
$sep = defined('PENUMBRA_GROUP_PATH_SEP') ? PENUMBRA_GROUP_PATH_SEP : "\x1f";
$grp = array('Engineering' . $sep . 'Civil' => array($rows[0], $rows[1]), 'Science' => array($rows[4]), 'Empty' => array());
$rg = penumbra_cards_email_html($grp, true, $cfg, 'theme-dark-blue', $cellFn, 0); $hg = $rg['html'];
$pal = $T['theme-dark-blue']['emailGroup'];
preg_match_all('/<div style="margin:14px 0 6px;[^"]*"><span style="[^"]*">([^<]*)<\/span> <span style="[^"]*">(\d+)<\/span><\/div>/', $hg, $gm, PREG_SET_ORDER);
ok('P-groupHeads', count($gm) === 2 && $gm[0][1] === 'Engineering / Civil' && $gm[0][2] === '2' && $gm[1][1] === 'Science' && $gm[1][2] === '1', json_encode($gm));
ok('P-groupPalette', strpos($hg, 'background-color:' . $pal['headerBg'] . ';') !== false && strpos($hg, 'color:' . $pal['nameColor'] . ';">Engineering') !== false && strpos($hg, 'background-color:' . $pal['countBg'] . ';color:' . $pal['countColor'] . ';">2<') !== false);
// (cleft) the group's summary on its heading, on the right, as the table email's; none for a group without one; the
// runner's text (its column htmlspecialchars'd) shown once escaped, never twice
$aggFn = function ($rows, $path) { return $path === 'Science' ? null : 'Sum of A&amp;B: ' . count($rows); };
$ra = penumbra_cards_email_html($grp, true, $cfg, 'theme-dark-blue', $cellFn, 0, $aggFn); $ha = $ra['html'];
preg_match_all('/<td align="right"[^>]*>([^<]*)<\/td>/', $ha, $am);
ok('P-groupAgg', $am[1] === array('Sum of A&amp;B: 2') && substr_count($ha, 'margin:14px 0 6px;') === 2 && count($cards($ha)) === 3, json_encode($am[1]));
ok('P-groupCards', count($cards($hg)) === 3 && $rg['total'] === 3 && strpos($hg, 'background-color:' . $T['theme-dark-blue']['vars']['bg-surface'] . ';') !== false);

// ---- the runner's wiring (source) ------------------------------------------------------------------
ok('S-require', substr_count($run, "require_once dirname(__FILE__) . '/penumbra_cards_email.php';") === 1);
ok('S-globalGuarded', strpos($run, "\$GLOBALS['penumbra_cards_email'] = function_exists('penumbra_cards_email_cfg') ? penumbra_cards_email_cfg(\$state) : null;") !== false);
ok('S-bodyOnly', strpos($run, "(\$isEmail && \$viewMode !== 'pivot' && !empty(\$data) && !empty(\$GLOBALS['penumbra_cards_email']) && function_exists('penumbra_cards_email_html'))") !== false);
ok('S-sameCell', strpos($run, "\$cellValue = isset(\$rwMap[\$colUpper]) ? \$rwMap[\$colUpper] : (\$hlEmail ? penumbra_email_cell_format(\$colUpper, \$cell) : \$cell);\r\n                \$o['cells']") !== false
    && strpos($run, "'html' => penumbra_notes_cell_html(formatCellContent(\$cellValue), \$colName)") !== false);
ok('S-budget', strpos($run, "penumbra_cards_email_html(\$data, \$viewMode === 'grouped', \$_cardsCfg, \$themeName, \$_cardsCell, \$_truncLimit ? max(1, \$_truncLimit - strlen(\$html)) : 0") !== false   // (cleft) up to the budget
    && strpos($run, '" cards &mdash; "') !== false);
ok('S-aggWired', strpos($run, "return compute_group_agg_summary(\$rows, \$groupAgg['column'], \$groupAgg['type'], isset(\$groupAgg['groupByCol']) ? \$groupAgg['groupByCol'] : null, \$path);") !== false
    && strpos($run, "strlen(\$html)) : 0, \$_cardsAgg);") !== false);   // (cleft) the summary to the card email's headings
ok('S-tableKept', substr_count($run, "    } else if (empty(\$data)) {\r\n        \$html .= \"<p>No results found.</p>\";") === 1);
foreach (array('inc' => $INC, 'runner' => $RUN) as $k => $p) { $l = shell_exec(escapeshellarg(PHP_BINARY) . ' -n -l ' . escapeshellarg($p) . ' 2>&1'); ok('P-lint-' . $k, strpos((string)$l, 'No syntax errors') !== false, trim((string)$l)); }
// (csz, the user) each card's notes: the runner's Notes column (penumbra_sched_notes_col, lifted), under its name, not on Small,
// none without the column named
$rowsN = array_map(function ($r) { $r['NOTES'] = ''; return $r; }, $rows); $rowsN[0]['NOTES'] = "2026-10-01 Ann: first\n2026-10-02 Ben: second";
$hn0 = penumbra_cards_email_html($rowsN, false, $cfg, 'theme-default', $cellFn, 0)['html'];
if (function_exists('penumbra_sched_notes_col')) penumbra_sched_notes_col('NOTES');
$hn = penumbra_cards_email_html($rowsN, false, $cfg, 'theme-default', $cellFn, 0)['html'];
$cfgCn = $cfg; $cfgCn['size'] = 'compact'; $hnc = penumbra_cards_email_html($rowsN, false, $cfgCn, 'theme-default', $cellFn, 0)['html'];
if (function_exists('penumbra_sched_notes_col')) penumbra_sched_notes_col('');
$csN = $cards($hn);
ok('P-notes', function_exists('penumbra_sched_notes_col') && strpos($hn0, 'Ann: first') === false && substr_count($hn, 'Ann: first') === 1 && isset($csN[0], $csN[1])
    && strpos($csN[0], 'margin:0 0 2px;">NOTES</div>2026-10-01 Ann: first') !== false && strpos($csN[1], '>NOTES</div>') === false && strpos($hnc, 'Ann: first') === false, isset($csN[0]) ? substr($csN[0], -300) : '');
// (cnest sweep) a grouped body cut by size heads only the groups it has cards of (they ran on, uncounted, past the budget)
$grpM = array(); for ($gi = 0; $gi < 8; $gi++) $grpM['Group ' . $gi] = array($rows[$gi % 5]);
$rm = penumbra_cards_email_html($grpM, true, $cfg, 'theme-default', $cellFn, 2 * $one + 400); $segs = explode('<div style="margin:14px 0 6px;', $rm['html']); array_shift($segs);
ok('P-cutNoHeads', $rm['truncated'] && count($segs) >= 1 && count($segs) < 8 && count(array_filter($segs, function ($s) { return strpos(explode('<div style="margin:14px 0 6px;', $s)[0], 'border-radius:8px') === false; })) === 0,
    json_encode(array($rm['shown'], $rm['total'], count($segs))));
// the bar's rank: the same answers as the scan it replaced (ties share their run's middle), in a binary search
$refRank = function ($v, $vals) { $n = count($vals); if ($n < 2) return 100; $a = 0; while ($a < $n && $vals[$a] < $v) $a++; $b = $a; while ($b < $n && $vals[$b] <= $v) $b++; return (($a + $b - 1) / 2) / ($n - 1) * 100; };
mt_srand(7); $same = true;
for ($k = 0; $k < 200 && $same; $k++) { $vs = array(); $m = mt_rand(0, 30); for ($j = 0; $j < $m; $j++) $vs[] = mt_rand(0, 9); sort($vs); for ($j = -1; $j <= 10 && $same; $j++) $same = abs(_pnb_cm_rank($j, $vs) - $refRank($j, $vs)) < 1e-9; }
ok('P-rankSame', $same);
$big = range(0, 19999); $t0 = microtime(true); for ($j = 0; $j < 20000; $j++) _pnb_cm_rank($j, $big); $dt = microtime(true) - $t0;
ok('P-rankFast', $dt < 1.5, sprintf('%.2fs for 20,000 ranks over 20,000 values', $dt));
// a change analysis (the was/now groups) mails tables, never cards
ok('S-changeNoCards', strpos($run, "                    \$viewMode = 'grouped';\r\n                    \$GLOBALS['penumbra_cards_email'] = null;") !== false);
// ---- (cpdf, 2026-11-05, the user: "card per page if the report was saved in cards mode") the scheduled PDF's cards --------
list(, , , , , , $PDFP, $TCPDF) = $argv + array_fill(0, 8, '');
$pcfg = array('title' => 'NAME', 'sub' => array('ID'), 'big' => 'AMT', 'pill' => 'STATUS', 'bar' => 'NUM', 'fields' => array('PEOPLE'), 'nolabels' => false, 'lists' => array(), 'size' => 'standard');
$pCell = function ($raw, $col) { $s = (string)$raw; if (substr($s, 0, 6) === '@@HTML') $s = strip_tags(substr($s, 6)); return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
$havePdf = function_exists('penumbra_cards_pdf_pages');
$pp = $havePdf ? penumbra_cards_pdf_pages($rows, false, $pcfg, 'Card <Report>', $pCell) : null;
$pg = ($pp && isset($pp['pages'])) ? $pp['pages'] : array();
$labelsOn = function ($h) { foreach (array('ID', 'NAME', 'STATUS', 'AMT', 'NUM', 'PEOPLE', 'PCT', 'NOTE') as $c) if (strpos($h, '>' . $c . '</td>') === false) return false; return true; };
ok('P-pdfPages', count($pg) === 5 && $pp['shown'] === 5 && $pp['total'] === 5 && !$pp['truncated']
    && strpos($pg[0], 'Card 1 of 5') !== false && strpos($pg[0], 'Card &lt;Report&gt;') !== false && strpos($pg[0], '>Ann</td>') !== false && strpos($pg[4], 'Card 5 of 5') !== false
    && strpos($pg[1], '>Closed</td>') !== false && strpos($pg[1], '$2,000.00</span>') !== false && strpos($pg[1], '>AMT</span>') !== false && strpos($pg[1], '>ID-2</div>') !== false
    && strpos($pg[3], '(blank)') !== false && $labelsOn($pg[0]) && $labelsOn($pg[3]),
    $pg ? substr($pg[1], 0, 900) : json_encode($pp));
ok('P-pdfPill', count($pg) === 5 && preg_match('#<td width="16%" align="center" style="font-size:8pt;font-weight:bold;color:[^;]+;border:0\.5px solid [^;]+;">Closed</td>#', $pg[1])
    && strpos($pg[3], 'align="center" style="font-size:8pt;font-weight:bold;') === false && strpos($pg[0], '<td width="13%" align="center"') !== false, $pg ? substr($pg[1], 0, 700) : '');   // Closed: 8 + 1.3 x 6; Open: 13%; a blank status: none
ok('P-pdfSafe', count($pg) === 5 && !array_filter($pg, function ($h) { return strpos($h, 'border-radius') !== false || strpos($h, 'class=') !== false || strpos($h, 'var(--') !== false || stripos($h, '<script') !== false; }));
$brand = penumbra_cards_email_theme('theme-default')['brand'];
ok('P-pdfBar', count($pg) === 5 && strpos($pg[4], 'bgcolor="' . $brand . '"') !== false && strpos($pg[3], 'bgcolor="' . $brand . '"') === false, $brand);   // NUM 50 the largest; 0: none
$gp = $havePdf ? penumbra_cards_pdf_pages(array('G1' . (defined('PENUMBRA_GROUP_PATH_SEP') ? PENUMBRA_GROUP_PATH_SEP : ' > ') . 'A' => array($rows[0], $rows[1]), 'G2' => array($rows[2]), 'G3' => array()), true, $pcfg, 'R', $pCell) : null;
$gpp = ($gp && isset($gp['pages'])) ? $gp['pages'] : array();
ok('P-pdfGrouped', count($gpp) === 3 && strpos($gpp[0], '>G1 / A</div>') !== false && strpos($gpp[1], '>G1 / A</div>') !== false && strpos($gpp[2], '>G2</div>') !== false && strpos($gpp[2], 'Card 3 of 3') !== false,
    $gpp ? substr($gpp[0], 0, 600) : json_encode($gp));
$cp = $havePdf ? penumbra_cards_pdf_pages($rows, false, $pcfg, 'R', $pCell, 2) : null;
$cpp = ($cp && isset($cp['pages'])) ? $cp['pages'] : array();
ok('P-pdfCap', count($cpp) === 3 && $cp['shown'] === 2 && $cp['total'] === 5 && $cp['truncated'] && strpos($cpp[1], 'Card 2 of 5') !== false
    && strpos($cpp[2], 'Showing 2 of 5 cards - 3 cards were left out to keep this PDF a workable size. Open the report for the full data.') !== false, json_encode($cp ? array($cp['shown'], $cp['total'], end($cpp)) : null));
ok('P-pdfNone', $havePdf && penumbra_cards_pdf_pages(array(), false, $pcfg, 'R', $pCell) === null && penumbra_cards_pdf_pages(array('G' => array()), true, $pcfg, 'R', $pCell) === null);
// the runner's ask: the saved cards (the email body's own global), never a pivot; the table without them
$keepG = isset($GLOBALS['penumbra_cards_email']) ? $GLOBALS['penumbra_cards_email'] : null;
$GLOBALS['penumbra_cards_email'] = $pcfg;
$f1 = function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for($rows, 'standard', 'R') : null;
$f2 = function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for($rows, 'pivot', 'R') : 'x';
$f3 = function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for(array('G1' => array($rows[0])), 'grouped', 'R') : null;
$GLOBALS['penumbra_cards_email'] = null;
$f4 = function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for($rows, 'standard', 'R') : 'x';
$GLOBALS['penumbra_cards_email'] = $keepG;
ok('P-pdfFor', is_array($f1) && count($f1) === 5 && $f2 === null && is_array($f3) && count($f3) === 1 && strpos($f3[0], '>G1</div>') !== false && $f4 === null, json_encode(array(is_array($f1) ? count($f1) : $f1, $f2, $f4)));
// the notes: the runner's Notes column on a block of its own, not in the list
if (function_exists('penumbra_sched_notes_col')) penumbra_sched_notes_col('NOTE');
$np = $havePdf ? penumbra_cards_pdf_pages($rows, false, $pcfg, 'R', $pCell) : null;
if (function_exists('penumbra_sched_notes_col')) penumbra_sched_notes_col('');
$npp = ($np && isset($np['pages'])) ? $np['pages'] : array();
ok('P-pdfNotes', function_exists('penumbra_sched_notes_col') && count($npp) === 5 && strpos($npp[0], '>NOTE</td>') === false && strpos($npp[0], '>NOTE</div><div style="font-size:9pt;') !== false
    && strpos($npp[1], '>NOTE</div>') === false, $npp ? substr($npp[0], -400) : '');
// rendered: the staged plugin (live's TCPDF behind it) - the cover landscape, then a portrait page per card; no
// card_pages: the cover and the table, as before
$pdfInfo = function ($bin) {
    preg_match_all('#/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]#', (string)$bin, $m, PREG_SET_ORDER);
    return array_map(function ($x) { return ((float)$x[3] - (float)$x[1]) > ((float)$x[4] - (float)$x[2]) ? 'L' : 'P'; }, $m);
};
$rendered = null; $tableOnly = null;
if (is_file($PDFP) && is_file($TCPDF)) {
    $src = file_get_contents($PDFP);
    $src = str_replace("__DIR__ . '/lib/tcpdf/tcpdf.php'", var_export($TCPDF, true), $src);
    $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_cpdf_' . getmypid() . '.php'; file_put_contents($tmp, $src);
    require_once $tmp;
    if (function_exists('penumbra_generate_pdf')) {
        $o = array('orientation' => 'landscape', 'paper_size' => 'letter', 'timestamp' => 'November 5, 2026, 2:30 pm', 'row_text' => 'Rows: 5');
        $rendered = penumbra_generate_pdf('<table><tr><td>the table</td></tr></table>', 'Card Report', $o + array('card_pages' => $pg));
        $tableOnly = penumbra_generate_pdf('<table><tr><td>the table</td></tr></table>', 'Card Report', $o + array('card_pages' => null));
        if (getenv('PNB_CPDF_OUT') && $rendered) file_put_contents(getenv('PNB_CPDF_OUT'), $rendered);   // a look at it
    }
    @unlink($tmp);
}
$ri = $rendered ? $pdfInfo($rendered) : array(); $ti = $tableOnly ? $pdfInfo($tableOnly) : array();
ok('P-pdfRender', $ri === array('L', 'P', 'P', 'P', 'P', 'P'), json_encode(array($ri, $rendered ? strlen($rendered) : 0)));
ok('P-pdfTableKept', $ti === array('L', 'L'), json_encode($ti));
// the runner's four PDF sites ask for the cards (function_exists-guarded): the send, a recipient's rows, a recipient's
// filtered rows, a file drop
$W = "'card_pages' => (function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for(";
ok('S-pdfWired', substr_count($run, $W) === 3 && substr_count($run, "'card_pages'  => (function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for(\$processedData, \$viewMode, \$reportTitle) : null)") === 1
    && substr_count($run, $W . "\$processedData, \$viewMode, \$reportTitle) : null)") === 1 && substr_count($run, $W . "\$prData, \$prViewMode, \$reportTitle) : null)") === 1
    && substr_count($run, $W . "\$prFilteredData, \$prfViewMode, \$reportTitle) : null)") === 1);
// (cpdf sweep) a per-recipient change analysis (its own rows' and its filtered rows') sends the was/now tables, never cards
ok('S-pdfChange', substr_count($run, "\$GLOBALS['penumbra_cards_email'] = null;   // (cpdf sweep) this recipient's was/now tables, never cards") === 2
    && strpos($run, "\$prViewMode = 'grouped';\r\n                                    \$GLOBALS['penumbra_cards_email'] = null;") !== false
    && strpos($run, "\$prfViewMode = 'grouped';\r\n                                        \$GLOBALS['penumbra_cards_email'] = null;") !== false);
// (cpdf sweep) each value in its column's report format first, as the email's cards (the runner's penumbra_email_cell_format:
// a stand-in here, as the runner is never required)
if (!function_exists('penumbra_email_cell_format')) { function penumbra_email_cell_format($c, $v) { return $c === 'AMT' ? 'fmt:' . $v : $v; } }
$GLOBALS['penumbra_cards_email'] = $pcfg;
$ff = function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for($rows, 'standard', 'R') : null;
$GLOBALS['penumbra_cards_email'] = $keepG;
ok('P-pdfFormat', is_array($ff) && count($ff) === 5 && strpos($ff[1], 'fmt:$2,000.00</span>') !== false && strpos($ff[1], '>fmt:$2,000.00</td>') !== false && strpos($ff[1], 'fmt:ID-2') === false, $ff ? substr($ff[1], 0, 500) : '');
// (cpdf sweep) an array-valued cell: no PHP 8 "Array to string conversion" (P-noWarnings below reads the include's warnings)
$rowsArr = $rows; $rowsArr[0]['PEOPLE'] = array('Palmtag, Scott', 'Smith, Jo'); $rowsArr[1]['AMT'] = array(1, 2);
$pa = $havePdf ? penumbra_cards_pdf_pages($rowsArr, false, $pcfg, 'R', function ($raw, $col) { return is_array($raw) ? 'list' : htmlspecialchars((string)$raw); }) : null;
ok('P-pdfArray', is_array($pa) && count($pa['pages']) === 5);
// (csweep3) array cells in the email's cards and the PDF's: a list column's array cell shows its html (no chips of the
// word "Array", no PHP 8 "Array to string conversion"); an EMPTY array cell is blank (the title "(blank)", no big number)
$aCell = function ($row, $idx, $cols) {
    $o = array('row' => array(), 'cells' => array());
    foreach ($cols as $c) { if (!array_key_exists($c, $row)) continue; $raw = $row[$c];
        $o['cells'][strtoupper($c)] = array('raw' => $raw, 'html' => is_array($raw) ? ($raw ? 'list:' . count($raw) : '') : htmlspecialchars((string)$raw), 'css' => array()); }
    return $o;
};
$rowsA = $rows; $rowsA[0]['PEOPLE'] = array('Palmtag, Scott', 'Smith, Jo'); $rowsA[2]['ID'] = array();
$e0 = count($ERRS);
$ea = penumbra_cards_email_html($rowsA, false, $cfg, 'theme-default', $aCell, 0);
$eaw = array_slice($ERRS, $e0); $eac = $cards($ea['html']);
$pb = $havePdf ? penumbra_cards_pdf_pages(array(array('ID' => 'ID-9', 'NAME' => array(), 'STATUS' => 'Open', 'AMT' => array(), 'NUM' => '', 'PEOPLE' => '', 'PCT' => '', 'NOTE' => '')), false, $pcfg, 'R',
    function ($raw, $col) { return is_array($raw) ? '' : htmlspecialchars((string)$raw); }) : null;
$pb0 = (is_array($pb) && isset($pb['pages'][0])) ? $pb['pages'][0] : '';
ok('P-arrayCells', count($eac) === 5 && empty($eaw) && strpos($eac[0], 'list:2') !== false && strpos($eac[0], '>Array</span>') === false && strpos($eac[2], '(blank)') !== false
    && $pb0 !== '' && strpos($pb0, '(blank)') !== false && strpos($pb0, '>AMT</span>') === false,
    json_encode(array(count($eac), $eaw, $eac ? substr($eac[2], 0, 260) : null, substr($pb0, 0, 260))));
// (mailhid, 2026-11-05, the user's emailed pivot cards) a value its highlight paints in its own fill (text colour =
// background colour, spaced and cased apart) mails blank: its line kept, its label, no span, no colour; a list ruled in two
// colours keeps them on every chip
$hidFn = function ($row, $idx, $cols) use ($cellFn) {
    $o = $cellFn($row, $idx, $cols);
    if ($idx === 0) { $o['cells']['NOTE']['css'] = array('color' => '#00803F', 'background-color' => ' #00803f'); $o['cells']['PEOPLE']['css'] = array('color' => '#c62828', 'background-color' => '#ffebee'); }
    return $o;
};
$hc = $cards(penumbra_cards_email_html($rows, false, $cfg, 'theme-default', $hidFn, 0)['html']); $hc0 = isset($hc[0]) ? $hc[0] : '';
ok('P-hidBlank', count($hc) === 5 && preg_match('#white-space:nowrap;">NOTE</td><td valign="top" style="[^"]*">&nbsp;</td></tr>#', $hc0) === 1 && strpos($hc0, '>x</span>') === false && stripos($hc0, '#00803f') === false, substr($hc0, -420));
ok('P-hidKept', substr_count($hc0, 'color:#c62828;background-color:#ffebee;">') === 2 && strpos($hc0, 'color:#c62828;background-color:#ffebee;">Palmtag, Scott</span>') !== false, substr($hc0, 0, 600));
ok('P-noWarnings', empty($ERRS), implode(' | ', array_slice(array_unique($ERRS), 0, 4)));
echo implode("\n", $out) . "\n";
