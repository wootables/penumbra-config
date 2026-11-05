<?php
/**
 * outcpy (2026-11-04): the Outage history heading's two marks.
 *  - the export mark draws the main reports' download icon (pnbi-download's
 *    paths), the new copy mark their copy icon (pnbi-copy's);
 *  - the copy menu offers the SAME picks as the export menu (labels, counts,
 *    order), each a button whose data-sel matches the export link's filter;
 *  - the rows ride on the menu as JSON, one per exported episode;
 *  - DRIVEN in headless Edge: open the copy menu, pick "Databases", and the
 *    clipboard gets an HTML table of exactly the database rows plus TSV text;
 *    pick a single connection, and the table holds only it.
 *
 *   php -n -d date.timezone=America/New_York test_outcpy.php --health=<penumbra_health.php> --page=<health.php> [--control] [--mutant]
 *
 * --mutant  the copy filter ignores a category pick: the Databases checks go RED.
 * --control one impossible assertion: fail=1.
 * Fixture and lifts are the outexp suite's (the OUTAGE HISTORY block and the
 * page's export block + menu region, cut by the same anchors).
 */
error_reporting(E_ALL);
set_error_handler(function ($no, $str, $file, $line) { if (!(error_reporting() & $no)) return false; throw new ErrorException($str, 0, $no, $file, $line); });
$HEALTH = $PAGE = null; $MUT = false; $CONTROL = false;
foreach ($argv as $a) {
    if (strpos($a, '--health=') === 0) $HEALTH = substr($a, 9);
    if (strpos($a, '--page=') === 0)   $PAGE = substr($a, 7);
    if ($a === '--mutant')  $MUT = true;
    if ($a === '--control') $CONTROL = true;
}
if (!$HEALTH || !$PAGE) { fwrite(STDERR, "usage: --health=<file> --page=<file> [--control] [--mutant]\n"); exit(2); }
$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'outcpy_' . getmypid(); @mkdir($TMP);
$src = str_replace("\r\n", "\n", file_get_contents($HEALTH));
$s = strpos($src, "/* =====================================================================\n * OUTAGE HISTORY");
$e = strpos($src, "/**\n * Compose the whole picture.");
file_put_contents("$TMP/h.php", '<?php function penumbra_health_cache_file($c) { return ' . var_export("$TMP/penumbra_health_cache.json", true) . '; } $config = array(); ?>' . "\n<?php\n" . substr($src, $s, $e - $s));
require "$TMP/h.php";
function pnb_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
$PASS = 0; $FAIL = 0;
function ok($c, $l, $g = null) { global $PASS, $FAIL; if ($c) { $PASS++; echo "  ok   $l\n"; } else { $FAIL++; echo "  FAIL $l" . ($g === null ? '' : '  (got: ' . json_encode($g) . ')') . "\n"; } }

// The outexp fixture: HR down 27 times, INFOED once + a near miss, the
// scheduler once, SOR once (formula-looking text), SMTP open right now.
$now = time(); $t0 = $now - 3 * 86400;
$bad = function ($t) use ($t0) {
    $p = array(); $nm = array(); $m = (int)(($t - $t0) / 300);
    if ($m % 10 === 1) $p[] = 'database hr down: ORA-12170 "TNS" <timeout>';
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

$pg = str_replace("\r\n", "\n", file_get_contents($PAGE));
$a = strpos($pg, "/* OUTAGE EXPORT (2026-11-02)"); $b = strpos($pg, "/** Seconds as the shortest thing");
$exportSrc = str_replace('exit;', 'throw new Exception("EXIT");', substr($pg, $a, $b - $a));
file_put_contents("$TMP/x.php", "<?php\n" . $exportSrc);
$m1 = strpos($pg, "      <?php if (!empty(\$outExpAll)) {"); $m2 = strpos($pg, "      </span></span>\n      <?php } ?>", $m1);
if ($m1 === false || $m2 === false) { fwrite(STDERR, "menu region anchors not found\n"); exit(2); }
file_put_contents("$TMP/m.php", substr($pg, $m1, $m2 - $m1) . "      </span></span>\n      <?php } ?>");
$_GET = array(); include "$TMP/x.php";
ob_start(); include "$TMP/m.php"; $menu = ob_get_clean();

echo "-- the marks\n";
$dl = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
$cp = '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="m16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h2"/>';
$idx = @file_get_contents(dirname($PAGE) . '/index.php');
if ($idx === false) $idx = file_get_contents('//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra/index.php');
ok(strpos($idx, '<symbol id="pnbi-download" viewBox="0 0 24 24">' . $dl . '</symbol>') !== false
   && strpos($idx, '<symbol id="pnbi-copy" viewBox="0 0 24 24">' . $cp . '</symbol>') !== false, "the paths are the main reports' own pnbi-download / pnbi-copy");
ok(preg_match('/aria-controls="pnbOutExpMenu"[^>]*>\s*<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . preg_quote($dl, '/') . '<\/svg><\/button>/', $menu) === 1, 'the export mark draws the download icon');
ok(strpos($menu, '&#10515;') === false, 'the old arrow glyph is gone');
ok(preg_match('/aria-controls="pnbOutCpyMenu"[^>]*>\s*<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . preg_quote($cp, '/') . '<\/svg><\/button>/', $menu) === 1, 'the copy mark draws the copy icon');
ok(strpos($menu, 'pnbOutCpyMenu') < strpos($menu, 'pnbOutExpMenu'), 'copy sits before download');

echo "-- the same picks\n";
preg_match_all('/<a (?:class="sub" )?href="([^"]+)" download>([^<]+) <span class="n">(\d+)<\/span><\/a>/', $menu, $ex, PREG_SET_ORDER);
preg_match_all('/<button type="button" class="pnb-out-cpi(?: sub)?" data-sel="([^"]+)" data-name="([^"]+)">([^<]+) <span class="n">(\d+)<\/span><\/button>/', $menu, $cx, PREG_SET_ORDER);
$el = array(); foreach ($ex as $x) $el[] = trim($x[2]) . '=' . $x[3];
$cl = array(); foreach ($cx as $x) $cl[] = trim($x[3]) . '=' . $x[4];
ok($el && $el === $cl, 'the copy menu lists the export menu\'s picks, in order, with the same counts', array($el, $cl));
$filt = true;
foreach ($ex as $i => $x) {
    parse_str(parse_url(html_entity_decode($x[1]), PHP_URL_QUERY), $q);
    $want = isset($q['comp']) ? 'comp:' . $q['comp'] : (isset($q['kind']) ? 'kind:' . $q['kind'] : 'all');
    if (!isset($cx[$i]) || html_entity_decode($cx[$i][1]) !== $want) $filt = false;
}
ok($filt, 'each pick filters as its export link does (all | kind: | comp:)');
ok(preg_match('/data-rows="([^"]*)"/', $menu, $rm) === 1, 'the menu carries its rows');
$rows = json_decode(html_entity_decode(isset($rm[1]) ? $rm[1] : "", ENT_QUOTES, 'UTF-8'), true);
ok(is_array($rows) && count($rows) === count($outExpAll) && count($rows) > 25, 'one row per exported episode (past the card\'s 25 cap)', is_array($rows) ? count($rows) : $rows);
ok(is_array($rows) && count($rows[0]) === 12, 'each row: the CSV\'s 11 columns + the connection key');

echo "-- driven in Edge\n";
$js0 = strpos($pg, "/* OUTAGE EXPORT MENU (2026-11-02)");
$js1 = strpos($pg, "})();\n", $js0);
if ($js0 === false || $js1 === false) { fwrite(STDERR, "export menu script not found\n"); exit(2); }
$js = substr($pg, $js0, $js1 + 5 - $js0);
if ($MUT) {
    $needle = "if (sel.indexOf('kind:') === 0) return r[3] === sel.slice(5);";
    if (substr_count($js, $needle) !== 1) { fwrite(STDERR, "mutant anchor not found\n"); exit(2); }
    $js = str_replace($needle, '', $js);
    echo "MUTANT: a category pick copies everything\n";
}
$drive = <<<'JS'
var LOG = [];
window.pnbSay = function (t) { LOG.push('say:' + t); };
window.pnbCopyRich = function (t, h) { LOG.push({ text: t, html: h }); return Promise.resolve(); };
function pick(label) {
    document.querySelector('[aria-controls="pnbOutCpyMenu"]').click();
    var open = !document.getElementById('pnbOutCpyMenu').hidden;
    var b = Array.prototype.filter.call(document.querySelectorAll('.pnb-out-cpi'), function (x) { return x.getAttribute('data-name') === label; })[0];
    b.click();
    return open;
}
var res = {};
res.opened = pick('Databases');
res.closedAfter = document.getElementById('pnbOutCpyMenu').hidden;
setTimeout(function () {
    res.done = document.querySelector('[aria-controls="pnbOutCpyMenu"]').classList.contains('done');
    pick('INFOED');
    setTimeout(function () {
        res.log = LOG;
        document.getElementById('out').textContent = JSON.stringify(res);
    }, 50);
}, 50);
JS;
$page = '<!doctype html><html><head><meta charset="utf-8"></head><body><h2>' . $menu . '</h2><pre id="out">pending</pre><script>' . $js . "\n" . $drive . '</script></body></html>';
file_put_contents("$TMP/h.html", $page);
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe';
if (!is_file($edge)) $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe';
// Edge launched straight from PHP (proc_open or shell_exec) exits 0 and dumps
// NOTHING; launched by PowerShell it dumps the DOM. So PowerShell runs it and
// writes the dump to a file. An argument array: no cmd.exe, no UNC cwd.
$domFile = $TMP . DIRECTORY_SEPARATOR . 'dom.txt';
$ps = "\$o = & '$edge' --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files '--user-data-dir=$TMP\\prof'"
    . " --virtual-time-budget=5000 --dump-dom 'file:///" . str_replace('\\', '/', "$TMP/h.html") . "' 2>\$null | Out-String;"
    . " [IO.File]::WriteAllText('$domFile', \$o)";
$proc = proc_open(array('powershell.exe', '-NoProfile', '-NonInteractive', '-Command', $ps), array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, sys_get_temp_dir());
if (is_resource($proc)) { stream_get_contents($pipes[1]); stream_get_contents($pipes[2]); proc_close($proc); }
$dom = (string)@file_get_contents($domFile);
file_put_contents(sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'outcpy_last_dom.html', $dom);   // for a look when the drive fails
$got = preg_match('/<pre id="out">([^<]*)<\/pre>/', $dom, $om) ? json_decode(html_entity_decode($om[1], ENT_QUOTES, 'UTF-8'), true) : null;
ok(is_array($got) && !empty($got['opened']) && !empty($got['closedAfter']), 'the copy mark opens its menu; a pick closes it', $got ? array_diff_key($got, array('log' => 1)) : substr($dom, 0, 300));
$log = is_array($got) && isset($got['log']) ? $got['log'] : array();
$c1 = isset($log[0]['html']) ? $log[0] : null;
$c2 = null; foreach ($log as $i => $l) { if ($i > 0 && is_array($l) && isset($l['html'])) $c2 = $l; }
$dbN = 0; foreach ((array)$rows as $r) if ($r[3] === 'database') $dbN++;
ok($c1 && substr_count($c1['html'], '<table') === 1 && substr_count($c1['html'], '<tr') === $dbN + 1, "Databases: one table, a header and the $dbN database rows", $c1 ? substr_count($c1['html'], '<tr') : null);
ok($c1 && strpos($c1['html'], '>SMTP<') === false && strpos($c1['html'], '>Scheduler<') === false, 'Databases: no mail or scheduler rows');
ok($c1 && strpos($c1['html'], 'Penumbra outage history: Databases (' . $outWin['label'] . '), ' . $dbN . ' episodes, newest first') !== false, 'the table is titled with the pick, the window and the count');
ok($c1 && strpos($c1['html'], 'ORA-12170 &quot;TNS&quot; &lt;timeout&gt;') !== false && strpos($c1['html'], '<timeout>') === false, 'probe text is escaped in the table');
ok($c1 && preg_match_all('/<th\b[^>]*>([^<]+)<\/th>/', $c1['html'], $th) === 11 && $th[1][0] === 'Started' && $th[1][10] === 'Problem', 'the CSV\'s 11 columns head the table');
$tsv = $c1 ? explode("\n", $c1['text']) : array();
ok(count($tsv) === $dbN + 2 && strpos($tsv[1], "Started\tEnded\tConnection") === 0, 'the text twin is tab-separated: title, header, one line per row');
ok(!empty($got['done']), 'the copy mark shows it copied (.done)');
ok(in_array('say:Copied ' . $dbN . ' rows as a table: Databases', $log, true), 'and says so');
ok($c2 && substr_count($c2['html'], '<tr') === 3 && substr_count($c2['html'], '>INFOED<') === 2, 'a single connection: only its rows (INFOED: its outage and its near miss)', $c2 ? substr_count($c2['html'], '<tr') : null);
if ($CONTROL) ok(false, 'CONTROL: this assertion must fail');
echo "SUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL ? 1 : 0);
