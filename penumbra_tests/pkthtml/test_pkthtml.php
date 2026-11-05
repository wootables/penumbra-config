<?php
/**
 * pkthtml (2026-11-04): the escalation packet carries the outage history,
 * as lines in the text and as a TABLE in its HTML twin, and the Copy button
 * puts both on the clipboard.
 *
 *   php -n -d date.timezone=America/New_York test_pkthtml.php --app=<dir> [--control] [--mutant]
 *
 * --app     the folder holding health.php + penumbra_health.php (+ analytics_shared.php,
 *           penumbra_logs.php beside them for the hubcard render)
 * --control one impossible assertion: must report fail=1
 * --mutant  the packet ignores its $history: the history assertions go RED
 *
 * penumbra_outage_packet() is LIFTED from the shipped penumbra_health.php by
 * the tokenizer; the page-level checks render the real health.php through the
 * hubcard suite (a child process) and read the button it draws.
 */
$APP = ''; $CONTROL = false; $MUTANT = false;
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0) $APP = rtrim(substr($a, 6), '/\\');
    elseif ($a === '--control') $CONTROL = true;
    elseif ($a === '--mutant')  $MUTANT = true;
}
if ($APP === '') { fwrite(STDERR, "usage: --app=<dir> [--control] [--mutant]\n"); exit(2); }
$pass = 0; $fail = 0;
function ok($c, $m) { global $pass, $fail; if ($c) { $pass++; echo "  ok   $m\n"; } else { $fail++; echo "  FAIL $m\n"; } }
function lift($src, $name) {
    $t = token_get_all($src); $n = count($t);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1; while ($j < $n && is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) $j++;
        if (!is_array($t[$j]) || $t[$j][1] !== $name) continue;
        $d = 0; $s = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) { if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $d++; $s = true; } $buf .= $tok[1]; }
            else { if ($tok === '{') { $d++; $s = true; } elseif ($tok === '}') $d--; $buf .= $tok; }
            if ($s && $d === 0) return $buf;
        }
    }
    fwrite(STDERR, "$name not found\n"); exit(2);
}
$src = file_get_contents("$APP/penumbra_health.php");
$page = file_get_contents("$APP/health.php");
if ($src === false || $page === false) { fwrite(STDERR, "cannot read the sources\n"); exit(2); }
$fn = lift($src, 'penumbra_outage_packet');
if ($MUTANT) {
    $needle = 'foreach ((array)$history as $h) {';
    if (substr_count($fn, $needle) !== 1) { fwrite(STDERR, "mutant anchor not found\n"); exit(2); }
    $fn = str_replace($needle, 'foreach (array() as $h) {', $fn);
    echo "MUTANT: the packet ignores its history\n";
}
eval($fn);

$T = mktime(14, 0, 0, 11, 4, 2026);
$open = array('key' => 'db:IEPRD', 'component' => 'IEPRD database', 'kind' => 'database', 'started_at' => $T - 1800,
              'duration' => 1800, 'duration_max' => 2100, 'checks' => 6, 'problem' => 'database IEPRD down', 'ongoing' => true);
$hist = array(
    $open,
    array('key' => 'near:db:IEPRD', 'component' => 'IEPRD database', 'kind' => 'database', 'near_miss' => true, 'started_at' => $T - 86400,
          'ended_at' => $T - 86400 + 600, 'duration' => 300, 'duration_max' => 600, 'checks' => 2, 'problem' => 'slow: 4100 ms <fallback> & "retry"'),
    array('key' => 'db:IEPRD', 'component' => 'IEPRD database', 'kind' => 'database', 'recurring' => true, 'muted' => true, 'started_at' => $T - 2 * 86400,
          'recovered_by' => $T - 2 * 86400 + 900, 'duration' => 600, 'duration_max' => 900, 'checks' => 3, 'problem' => 'ORA-12541: TNS:no listener'),
);
$snap = array('components' => array());

echo "-- text packet\n";
$plain0 = penumbra_outage_packet($open, $snap);
ok(strpos($plain0, 'Outage history') === false, 'called the old way (two args), the text is unchanged: no history section');
$txt = penumbra_outage_packet($open, $snap, $hist, 'Last 7 days');
ok(strpos($txt, 'Penumbra outage: IEPRD database') === 0, 'the text still starts with the component');
ok(strpos($txt, "\nOutage history for IEPRD database (Last 7 days): 3 episodes, newest first") !== false, 'the text names the history, its window and its count');
ok(substr_count($txt, "\n  ") === 3 && strpos($txt, 'still open | 35m | outage | 6 checks | database IEPRD down') !== false, 'one line per episode, the open one marked still open');
ok(strpos($txt, '| near miss | 2 checks |') !== false && strpos($txt, '| outage, known window, muted | 3 checks | ORA-12541') !== false, 'near misses and known/muted windows say so');
$none = penumbra_outage_packet($open, $snap, array(), 'Last 24 hours');
ok(strpos($none, 'Outage history for IEPRD database (Last 24 hours): nothing else recorded') !== false, 'an empty window says nothing else recorded');

echo "-- html packet\n";
$html = penumbra_outage_packet($open, $snap, $hist, 'Last 7 days', true);
ok(strpos($html, '<div') === 0 && substr($html, -6) === '</div>', 'the html twin is one wrapped fragment');
ok(strpos($html, 'Penumbra outage: IEPRD database') !== false && strpos($html, 'Problem: database IEPRD down') !== false, 'it carries the same summary lines');
ok(substr_count($html, '<table') === 1 && substr_count($html, '<tr') === 4, 'the history is ONE table: a header row and three episode rows');
ok(preg_match_all('/<th\b[^>]*>(\w+)<\/th>/', $html, $m) === 6 && implode(',', $m[1]) === 'Started,Ended,Lasted,Type,Checks,Problem', 'its columns: Started, Ended, Lasted, Type, Checks, Problem');
ok(strpos($html, 'slow: 4100 ms &lt;fallback&gt; &amp; &quot;retry&quot;') !== false && strpos($html, '<fallback>') === false, 'probe text is escaped');
ok(strpos($html, '<style') === false && strpos($html, 'border:1px solid') !== false, 'inline styles only (mail clients drop <style>)');
ok(preg_match('/<tr style="background:#fde8e8"><td[^>]*>Wed 4 Nov 13:30<\/td><td[^>]*>still open<\/td>/', $html) === 1, 'the open episode is the first row, tinted, still open');
$hnone = penumbra_outage_packet($open, $snap, array(), 'Last 24 hours', true);
ok(strpos($hnone, '<table') === false && strpos($hnone, 'nothing else recorded') !== false, 'an empty window draws no table');

echo "-- the page\n";
ok(strpos($page, 'data-packet-html="<?php echo pnb_h($packetHtml); ?>"') !== false, 'the Copy button carries the html twin, attribute-escaped');
ok(strpos($page, "copyRich(copy.getAttribute('data-packet') || '', copy.getAttribute('data-packet-html') || '')") !== false, 'the click copies text AND html');
ok(strpos($page, "'text/html': new Blob([h], { type: 'text/html' })") !== false && strpos($page, "return navigator.clipboard.write([item])['catch'](function () { return copyText(t); });") !== false,
   'both types go on the clipboard, with the text alone as the fallback');
// Render the real page block through the hubcard suite and read the button.
$php = PHP_BINARY; $out = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pkthtml_' . getmypid() . '.html';
$hub = dirname(__FILE__) . '/../hubcard/test_hubcard.php';
$cmd = escapeshellarg($php) . ' -n -d date.timezone=America/New_York ' . escapeshellarg($hub)
     . ' ' . escapeshellarg("--health=$APP/penumbra_health.php") . ' ' . escapeshellarg("--page=$APP/health.php") . ' ' . escapeshellarg("--html=$out");
$res = shell_exec($cmd . ' 2>&1');
ok(strpos((string)$res, 'fail=0') !== false, 'the hubcard suite renders the page green');
$r = @file_get_contents($out); @unlink($out);
ok($r !== false && preg_match('/class="pnb-out-copy" data-packet="([^"]+)" data-packet-html="([^"]+)"/', $r, $bm) === 1, 'the rendered open outage has a Copy button with both packets');
$bt = isset($bm[1]) ? html_entity_decode($bm[1], ENT_QUOTES, 'UTF-8') : '';
$bh = isset($bm[2]) ? html_entity_decode($bm[2], ENT_QUOTES, 'UTF-8') : '';
ok(strpos($bt, "\nOutage history for www3 delivery (") !== false, "the rendered text packet lists the connection's history");
ok(strpos($bh, '<table') !== false && preg_match('/<td[^>]*>still open<\/td>/', $bh) === 1, 'the rendered html packet holds the table with the open outage');
if ($CONTROL) ok(false, 'CONTROL: this assertion must fail');
echo "\nSUMMARY  pass=$pass  fail=$fail\n";
exit($fail ? 1 : 0);
