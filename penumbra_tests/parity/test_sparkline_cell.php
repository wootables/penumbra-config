<?php
/**
 * Engine C check for sparkline_cell(): the PER-CELL sparkline in scheduled email
 * and PDF.
 *
 * The parity corpus harness only covers the SNIPPET lane; sparkline_cell is a
 * table RULE, so it needs a row fixture instead of a snippet fixture. This
 * exercises the real extracted engine-C functions end to end:
 *   parse_rewrite_rules()  ->  prepare_rewrite_rules()  ->  apply_rewrite_to_row()
 *
 * Run:  php test_sparkline_cell.php
 */
// Defined BEFORE the require so this stub wins, the same arrangement
// run_engine_c.php uses. The real resolver lives in themes_config.php and is not
// extracted; it turns var(--brand-primary) into the active theme's hex, so the
// stub does that too - a pass-through would let a var() reach the markup and the
// "concrete colour" assertion below would stop meaning anything.
function penumbra_resolve_css_vars($css) {
    return (strpos($css, 'var(') !== false) ? '#cc0000' : $css;
}

require __DIR__ . '/engineC_functions.php';

$PASS = 0; $FAIL = 0;
function ok($name, $cond, $extra = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "PASS  $name\n"; }
    else { $FAIL++; echo "FAIL  $name" . ($extra !== '' ? "   >> $extra" : '') . "\n"; }
}
function eqv($name, $got, $want) {
    ok($name, $got === $want, 'got=' . var_export($got, true) . ' want=' . var_export($want, true));
}
/** Bar heights out of the engine-C markup - the same reduction compare.ps1 uses. */
function heights($html) {
    // Match ANY width: bar width is now fitted to the point count, so hard-coding
    // 3 silently matched nothing and every height assertion "passed" as empty.
    if (!preg_match_all('/<td[^>]*\bwidth="\d+"[^>]*\bheight="(\d+)"/', $html, $m)) return array();
    return array_map('intval', $m[1]);
}

// ── 1. EXTRACTION ────────────────────────────────────────────────────────
$rules = parse_rewrite_rules("sparkline_cell(TREND, Q1|Q2|Q3|Q4)");
eqv('extract: one rule', count($rules), 1);
eqv('extract: target column upper-cased', $rules[0]['targetColumn'], 'TREND');
eqv('extract: source columns split on |', $rules[0]['_spark']['cols'], array('Q1','Q2','Q3','Q4'));
eqv('extract: no template - the content is computed', $rules[0]['template'], null);
ok('extract: colour defaults to a concrete hex (email cannot do var())',
   preg_match('/^#[0-9a-fA-F]{3,8}$/', $rules[0]['_spark']['color']) === 1,
   $rules[0]['_spark']['color']);

$rules2 = parse_rewrite_rules("sparkline_cell(TREND, Q1|Q2, #ff0000)");
eqv('extract: explicit colour survives', $rules2[0]['_spark']['color'], '#ff0000');

// Whitespace and ragged pipes are what people actually type.
$rules3 = parse_rewrite_rules("sparkline_cell( TREND ,  Q1 | Q2 |  | Q3 )");
eqv('extract: pads trimmed and empty segments dropped',
    $rules3[0]['_spark']['cols'], array('Q1','Q2','Q3'));

// It must NOT eat the inline sparkline(), and rewrite() must still work beside it.
$mixed = parse_rewrite_rules("rewrite(A, '{val}!') sparkline_cell(TREND, Q1|Q2) sparkline(AMOUNT)");
eqv('coexist: rewrite + sparkline_cell both extracted', count($mixed), 2);
$kinds = array();
foreach ($mixed as $r) { $kinds[] = isset($r['_spark']) ? 'spark' : 'rewrite'; }
eqv('coexist: one of each, rewrite first', $kinds, array('rewrite', 'spark'));

eqv('guard: a bare name with no parens is ignored', count(parse_rewrite_rules("sparkline_cell")), 0);
eqv('guard: one argument is not enough', count(parse_rewrite_rules("sparkline_cell(TREND)")), 0);
eqv('guard: an empty column list yields no rule', count(parse_rewrite_rules("sparkline_cell(TREND, )")), 0);

// ── 2. APPLICATION ───────────────────────────────────────────────────────
$columns = array('STATE', 'Q1', 'Q2', 'Q3', 'Q4', 'TREND');
$prepared = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, Q1|Q2|Q3|Q4)"), $columns);

// Ratios 1.0 / 0.6 / 0.25 / 0.9 - the same fixture the browser was verified with,
// so a divergence between the engines shows up as different heights here.
$row = array('STATE' => 'North Carolina', 'Q1' => '32171', 'Q2' => '19303',
             'Q3' => '8043', 'Q4' => '28954', 'TREND' => '-');
$out = apply_rewrite_to_row($row, 0, $prepared);

ok('apply: writes the target column', isset($out['TREND']), implode(',', array_keys($out)));
ok('apply: marked @@HTML so formatCellContent renders it',
   isset($out['TREND']) && strpos($out['TREND'], '@@HTML') === 0);
eqv('apply: heights match the browser exactly', heights($out['TREND']), array(20, 12, 5, 18));

// A row of a completely different magnitude must give the SAME shape: each row
// scales to its own maximum, which is the point of a per-row sparkline.
$row2 = array('STATE' => 'California', 'Q1' => '235', 'Q2' => '141',
              'Q3' => '59', 'Q4' => '212', 'TREND' => '-');
$out2 = apply_rewrite_to_row($row2, 1, $prepared);
eqv('apply: each row scales to its OWN max', heights($out2['TREND']), array(20, 12, 5, 18));

// Blank cells are ZERO here, not skipped - positions are fixed, so dropping one
// would slide the next value into its slot.
$row3 = array('STATE' => 'X', 'Q1' => '100', 'Q2' => '', 'Q3' => '50', 'Q4' => '100', 'TREND' => '-');
$out3 = apply_rewrite_to_row($row3, 2, $prepared);
eqv('apply: a blank cell is a ZERO, holding its position',
    heights($out3['TREND']), array(20, 1, 10, 20));

// An all-zero row is legitimate data, not an error.
$row4 = array('STATE' => 'Z', 'Q1' => '0', 'Q2' => '0', 'Q3' => '0', 'Q4' => '0', 'TREND' => '-');
$out4 = apply_rewrite_to_row($row4, 3, $prepared);
eqv('apply: an all-zero row draws four 1px stubs',
    heights($out4['TREND']), array(1, 1, 1, 1));

// Negatives hang below the baseline: same colour, different valign.
$prepNeg = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, Q1|Q2)"), $columns);
$row5 = array('Q1' => '100', 'Q2' => '-50', 'TREND' => '-');
$out5 = apply_rewrite_to_row($row5, 4, $prepNeg);
eqv('apply: negative bar is scaled on magnitude', heights($out5['TREND']), array(20, 10));
ok('apply: negative bar hangs below the baseline (valign top)',
   substr_count($out5['TREND'], 'valign="top"') === 1 &&
   substr_count($out5['TREND'], 'valign="bottom"') === 1);

// ── 3. EMAIL-CLIENT SAFETY ───────────────────────────────────────────────
$html = $out['TREND'];
ok('email-safe: nested tables, not divs', strpos($html, '<table') !== false && strpos($html, '<div') === false);
ok('email-safe: no inline SVG (TCPDF and Outlook cannot render it)', stripos($html, '<svg') === false);
ok('email-safe: bgcolor attribute present alongside the style',
   substr_count($html, 'bgcolor="') === 4);
ok('email-safe: pixel widths, never percentages', strpos($html, '%') === false);
ok('email-safe: colour is html-escaped', strpos($html, '"') !== false && strpos($html, '<script') === false);

// A colour that tries to break out of the attribute must be sanitised away.
$evil = prepare_rewrite_rules(
    parse_rewrite_rules('sparkline_cell(TREND, Q1|Q2, "><script>alert(1)</script>)'), $columns);
if (count($evil)) {
    $eo = apply_rewrite_to_row($row5, 5, $evil);
    ok('email-safe: a script-injecting colour is stripped',
       stripos($eo['TREND'], '<script') === false && stripos($eo['TREND'], 'alert') === false);
} else {
    ok('email-safe: a script-injecting colour is rejected outright', true);
}

// ── 4. MODIFIERS: width fitting, curve=log, scale=shared ─────────────────
$cols4 = array('A', 'B', 'C', 'TREND');
$row3  = array('A' => '10', 'B' => '5', 'C' => '2', 'TREND' => '-');

/** Width of the first bar cell. */
function barw($html) {
    return preg_match('/<td[^>]*\bwidth="(\d+)"[^>]*\bheight="\d+"/', $html, $m) ? (int)$m[1] : 0;
}

$wDefault = apply_rewrite_to_row($row3, 0,
    prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C)"), $cols4));
$w3 = barw($wDefault['TREND']);
ok('width: 3 points get FAT bars, not the 40-point 3px stub', $w3 >= 12, $w3 . 'px');

$wNarrow = apply_rewrite_to_row($row3, 0,
    prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, width=40)"), $cols4));
// The 24px cap keeps two points from becoming slabs at the DEFAULT width, but an
// explicit width= is the author asking for a size and must win - otherwise
// width=300 on a short series silently does nothing.
$wWide = apply_rewrite_to_row($row3, 0,
    prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, width=300)"), $cols4));
ok('width: an explicit width= beats the fat-bar cap',
   barw($wWide['TREND']) > 30, barw($wWide['TREND']) . 'px');
ok('width: width= narrows the bars', barw($wNarrow['TREND']) < $w3, barw($wNarrow['TREND']) . ' vs ' . $w3);

// curve=log lifts values that linear flattens into stubs - the whole point on
// skewed data like this system's.
$rSkew = array('A' => '1000', 'B' => '10', 'C' => '1', 'TREND' => '-');
$lin = apply_rewrite_to_row($rSkew, 0,
    prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C)"), $cols4));
$log = apply_rewrite_to_row($rSkew, 0,
    prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, curve=log)"), $cols4));
$hl = heights($lin['TREND']);
$hg = heights($log['TREND']);
eqv('curve: linear flattens a 1000/10/1 spread', $hl, array(20, 1, 1));
ok('curve=log lifts the small values off the floor',
   $hg[1] > $hl[1] && $hg[2] > $hl[2], implode(',', $hg));
eqv('curve=log still peaks at full height', $hg[0], 20);

// scale=shared: one maximum across ALL rows, so rows become comparable.
// The two rows are the SAME SHAPE at different magnitudes (1 : 0.5 : 0.25), which
// is what makes the scale=row vs scale=shared contrast meaningful. Keep them
// exactly proportional - 10/5/2 is not, and the ratios then differ for a reason
// that has nothing to do with scaling.
$rows = array(
    array('A' => '100', 'B' => '50', 'C' => '25', 'TREND' => '-'),
    array('A' => '20',  'B' => '10', 'C' => '5',  'TREND' => '-')
);
$perRow = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C)"), $cols4, $rows);
$shared = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, scale=shared)"), $cols4, $rows);
$pr0 = heights(apply_rewrite_to_row($rows[0], 0, $perRow)['TREND']);
$pr1 = heights(apply_rewrite_to_row($rows[1], 1, $perRow)['TREND']);
$sh0 = heights(apply_rewrite_to_row($rows[0], 0, $shared)['TREND']);
$sh1 = heights(apply_rewrite_to_row($rows[1], 1, $shared)['TREND']);
eqv('scale=row (default): the small row looks identical to the big one', $pr0, $pr1);
eqv('scale=shared: the big row still peaks at full height', $sh0, array(20, 10, 5));
ok('scale=shared: the small row is now visibly smaller',
   $sh1[0] < 5 && $sh1[0] >= 1, implode(',', $sh1));
// No rowset (the pivot path) must degrade to per-row, never to nothing.
$noRows = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, scale=shared)"), $cols4);
eqv('scale=shared without a rowset degrades to per-row, never to blank',
    heights(apply_rewrite_to_row($rows[1], 1, $noRows)['TREND']), $pr1);

// ── 5. style=line / style=area are BROWSER ONLY ──────────────────────────
// Email and PDF keep drawing bars: TCPDF's writeHTML has no inline <svg> and
// Outlook has neither SVG nor canvas. The contract is that engine C RECOGNISES
// the key and falls back to the same data as bars - it must never leak an <svg>
// into an email, and it must never mistake "style=line" for a colour.
foreach (array('line', 'area', 'bar') as $st) {
    $rules = parse_rewrite_rules("sparkline_cell(TREND, A|B|C, style=$st)");
    $prep  = prepare_rewrite_rules($rules, $cols4);
    $out   = apply_rewrite_to_row($row3, 0, $prep);
    ok("style=$st: engine C still emits bars, never <svg>",
       stripos($out['TREND'], '<svg') === false && strpos($out['TREND'], '<table') !== false);
    eqv("style=$st: heights are unaffected by the style key",
        heights($out['TREND']), array(20, 10, 4));
    ok("style=$st: the key is swallowed, not read as a colour",
       stripos($rules[0]['_spark']['color'], 'style') === false &&
       stripos($rules[0]['_spark']['color'], 'line') === false,
       $rules[0]['_spark']['color']);
}
// style= must still compose with the other modifiers.
$combo = parse_rewrite_rules("sparkline_cell(TREND, A|B|C, style=line, scale=shared, curve=log, #ff0000)");
eqv('style= composes: scale still parsed', $combo[0]['_spark']['scale'], 'shared');
eqv('style= composes: curve still parsed', $combo[0]['_spark']['curve'], 'log');
eqv('style= composes: the bare colour is still the colour', $combo[0]['_spark']['color'], '#ff0000');

// ── 6. The shared-scale TRACK ────────────────────────────────────────────
// scale=shared is honest but illegible on skewed data: a row worth 0.7% of the
// maximum is a line of 1px stubs, indistinguishable from an empty cell. The
// track shows the range being measured against. Only shared scaling draws it -
// per-row scaling always fills the height, so there is nothing to explain.
$trkShared = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C, scale=shared)"), $cols4, $rows);
$trkRow    = prepare_rewrite_rules(parse_rewrite_rules("sparkline_cell(TREND, A|B|C)"), $cols4, $rows);
$tSmall = apply_rewrite_to_row($rows[1], 1, $trkShared)['TREND'];
$tPlain = apply_rewrite_to_row($rows[1], 1, $trkRow)['TREND'];
ok('track: scale=shared draws a range track', strpos($tSmall, 'bgcolor="#f0f0f0"') !== false);
ok('track: the track carries an inline border too (mail drops stylesheets)',
   strpos($tSmall, 'border-bottom:1px solid') !== false);
ok('track: per-row scaling draws NO track', strpos($tPlain, 'bgcolor="#f0f0f0"') === false);
eqv('track: adding it did not disturb the bar heights',
    heights($tSmall), array(4, 2, 1));

// A bare colour in a modifier slot must still mean the colour.
$mix = parse_rewrite_rules("sparkline_cell(TREND, A|B, #00ff00, curve=log, width=90)");
eqv('modifiers: a bare colour still works alongside key=value', $mix[0]['_spark']['color'], '#00ff00');
eqv('modifiers: curve parsed', $mix[0]['_spark']['curve'], 'log');
eqv('modifiers: width parsed', $mix[0]['_spark']['total_w'], 90);
$junk = parse_rewrite_rules("sparkline_cell(TREND, A|B, curve=banana)");
eqv('modifiers: an unknown value is ignored and the default kept',
    $junk[0]['_spark']['curve'], 'linear');
eqv('modifiers: order does not matter',
    parse_rewrite_rules("sparkline_cell(TREND, A|B, width=90, curve=log)")[0]['_spark']['total_w'], 90);

echo "\nRESULT " . ($FAIL === 0 ? 'ALL-PASS' : 'HAS-FAILURES') . "  pass=$PASS fail=$FAIL\n";
exit($FAIL === 0 ? 0 : 1);
