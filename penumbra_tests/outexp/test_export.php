<?php
// Export harness: lifts the OUTAGE HISTORY block from --health and the export
// block + menu region from --page, renders over a fixture ledger, then follows
// every menu link through the export and checks rows == the menu's count.
error_reporting(E_ALL);
set_error_handler(function ($no, $str, $file, $line) { if (!(error_reporting() & $no)) return false; throw new ErrorException($str, 0, $no, $file, $line); });
$HEALTH = $PAGE = null; $MUT = false;
foreach ($argv as $a) {
    if (strpos($a, '--health=') === 0) $HEALTH = substr($a, 9);
    if (strpos($a, '--page=') === 0)   $PAGE = substr($a, 7);
    if ($a === '--mutant') $MUT = true;
}
$TMP = __DIR__ . '/tmp'; @unlink("$TMP/penumbra_outages.json"); @unlink("$TMP/penumbra_monitor_mutes.json");
$src = str_replace("\r\n", "\n", file_get_contents($HEALTH));
$s = strpos($src, "/* =====================================================================\n * OUTAGE HISTORY");
$e = strpos($src, "/**\n * Compose the whole picture.");
file_put_contents("$TMP/h.php", '<?php function penumbra_health_cache_file($c) { return "' . addslashes($TMP) . '/penumbra_health_cache.json"; } $config = array(); ?>' . "\n<?php\n" . substr($src, $s, $e - $s));
require "$TMP/h.php";
function pnb_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$PASS = 0; $FAIL = 0;
function ok($c, $l, $g = null) { global $PASS, $FAIL; if ($c) { $PASS++; echo "  ok   $l\n"; } else { $FAIL++; echo "  FAIL $l" . ($g === null ? '' : '  (got: ' . json_encode($g) . ')') . "\n"; } }

// Fixture: 3 days of ticks. HR down twice, INFOED down once + a near miss,
// the scheduler once, SMTP open right now. 27 HR outages so the card's 25 cap is crossed.
$now = time(); $t0 = $now - 3 * 86400;
$bad = function ($t) use ($t0) {
    $p = array(); $nm = array(); $m = (int)(($t - $t0) / 300);
    if ($m % 10 === 1) $p[] = 'database hr down: ORA-12170 "TNS" timeout';
    if ($m >= 100 && $m < 104) $p[] = 'database infoed down';
    if ($m >= 200 && $m < 203) $nm[] = 'database infoed degraded (2 failed connect attempt(s) before one succeeded)';
    if ($m >= 300 && $m < 302) $p[] = 'scheduler heartbeat is 712s old';
    if ($m >= 400 && $m < 402) $p[] = 'database sor down =HYPERLINK("x")';
    return array($p, $nm);
};
for ($t = $t0; $t <= $now - 300; $t += 300) { list($p, $nm) = $bad($t); penumbra_outage_record($p, $t, null, $nm); }
penumbra_outage_record(array('smtp handshake failed'), $now - 60, null, array());

$isAdmin = true;
$outWin = penumbra_health_window('', '7');
$outg = penumbra_outage_history(array('limit' => 25), $config);
ok(count($outg['episodes']) === 25 && $outg['total'] > 25, 'the card read is capped at 25 (so the export must not use it)', array(count($outg['episodes']), $outg['total']));

$pg = str_replace("\r\n", "\n", file_get_contents($PAGE));
$a = strpos($pg, "/* OUTAGE EXPORT (2026-11-02)"); $b = strpos($pg, "/** Seconds as the shortest thing");
$exportSrc = substr($pg, $a, $b - $a);
if ($MUT) $exportSrc = str_replace("'limit' => PHP_INT_MAX", "'limit' => 25", $exportSrc);
$exportSrc = str_replace('exit;', 'throw new Exception("EXIT");', $exportSrc);
$exportSrc = str_replace(array(" header(", " http_response_code("), array(" @header(", " @http_response_code("), $exportSrc);   // CLI: the test has already printed
file_put_contents("$TMP/x.php", "<?php\n" . $exportSrc);
$m1 = strpos($pg, "      <?php if (!empty(\$outExpAll)) {"); $m2 = strpos($pg, "      </span></span>\n      <?php } ?>", $m1);
file_put_contents("$TMP/m.php", substr($pg, $m1, $m2 - $m1) . "      </span></span>\n      <?php } ?>");

function run_export($q) {
    global $config, $isAdmin, $outWin, $outg, $TMP;
    $_GET = $q; ob_start();
    try { include "$TMP/x.php"; } catch (Exception $e) { if ($e->getMessage() !== 'EXIT') { ob_end_clean(); throw $e; } }
    return ob_get_clean();
}
// Menu render (no out_export in the request).
$_GET = array(); include "$TMP/x.php";
ob_start(); include "$TMP/m.php"; $menu = ob_get_clean();
ok(strpos($menu, 'class="pnb-out-exp"') !== false && strpos($menu, 'hidden>') !== false, 'the heading carries the export mark, menu hidden', $menu);
preg_match_all('/<a (?:class="sub" )?href="([^"]+)" download>([^<]+) <span class="n">(\d+)<\/span><\/a>/', $menu, $mm, PREG_SET_ORDER);
$labels = array(); foreach ($mm as $x) $labels[] = trim($x[2]);
ok($labels === array('Everything', 'SMTP', 'Databases', 'HR', 'SOR', 'INFOED', 'Scheduler'), 'menu: everything, one-connection categories as the connection, Databases with its connections under it', $labels);
foreach ($mm as $x) {
    parse_str(parse_url(html_entity_decode($x[1]), PHP_URL_QUERY), $q);
    $csv = run_export($q);
    $rows = explode("\r\n", rtrim($csv, "\r\n"));
    ok(substr($csv, 0, 3) === "\xEF\xBB\xBF" && strpos($rows[0], '"Started","Ended","Connection"') === 3, trim($x[2]) . ': BOM + header row');
    ok(count($rows) - 1 === (int)$x[3], trim($x[2]) . ': rows == the menu count (' . $x[3] . ')', count($rows) - 1);
}
$all = run_export(array('out_export' => 'csv'));
ok(strpos($all, '"database hr down: ORA-12170 ""TNS"" timeout"') !== false, 'quotes doubled');
ok(strpos($all, '"\'=HYPERLINK(""x"")') === false && strpos($all, '"database sor down =HYPERLINK(""x"")"') !== false, 'mid-text = untouched');
ok(preg_match('/"still open","SMTP","smtp","outage"/', $all) === 1, 'the open SMTP outage is a row, still open');
ok(preg_match('/"INFOED","database","near miss"/', $all) === 1, 'the near miss is a row, typed near miss');
$inf = run_export(array('out_export' => 'csv', 'comp' => 'db:infoed'));
ok(substr_count($inf, '"INFOED"') === 2, 'INFOED export holds its outage AND its near miss', substr_count($inf, '"INFOED"'));
$isAdmin = false; $_GET = array('out_export' => 'csv'); ob_start();
try { include "$TMP/x.php"; } catch (Exception $e) { } $deny = ob_get_clean();
ok($deny === 'An admin session is required.', 'non-admin is refused', $deny);
$isAdmin = true;
echo "SUMMARY  pass=$PASS  fail=$FAIL\n";
// Preview page for a headless screenshot: the tip pinned open, the menu shown.
if (in_array('--preview', $argv, true)) {
    $pg2 = $pg; $i1 = strpos($pg2, "  /* The (i) as two short groups"); $i2 = strpos($pg2, "  // An open outage is listed whatever the window", $i1);
    eval(substr($pg2, $i1, $i2 - $i1));
    $tip = '<span class="pnb-i" tabindex="0" role="button" aria-expanded="true"><span class="pnb-i-tip" role="tooltip">' . $outInfo . '</span></span>';
    $html = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../stage/css/main.css"></head><body style="background:var(--bg-body,#f4f4f4);padding:20px;font-family:system-ui">'
          . '<div class="pnb-hub-grid" style="display:block;width:900px"><div class="pnb-adm-card" style="min-height:520px"><h2>OUTAGE HISTORY (last 7d) ' . $tip
          . '<span class="pnb-sum">HR 99.2%, 2h down</span><span class="pnb-h2-r">4 outages &middot; 2 near misses &middot; coverage 100%</span>'
          . str_replace(array('aria-expanded="false"', ' hidden>'), array('aria-expanded="true"', '>'), $menu) . '</h2></div></div></body></html>';
    file_put_contents(__DIR__ . '/preview.html', $html);
}
