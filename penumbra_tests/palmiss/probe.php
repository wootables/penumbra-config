<?php
// Child of run.php: requires the (possibly mutated) lib, prints {check: true | detail} as JSON.
require $argv[1];
$tmp = $argv[2];
if (!defined('PDO::FETCH_ASSOC') && !class_exists('PDO')) { class PDO { const FETCH_ASSOC = 2; } }

/** PENUMBRA_PALETTE_MISSES in memory: rows carry an AGE in days; only the lib's statements parse. */
class FakeConn {
    public $rows = array(); public $log = array();
    public function prepare($sql) { $this->log[] = $sql; return new FakeSt($this, $sql); }
}
class FakeSt {
    private $c; private $sql; private $b = array(); private $out = array();
    public function __construct($c, $sql) { $this->c = $c; $this->sql = $sql; }
    public function bindValue($k, $v) { $this->b[$k] = $v; }
    public function execute() {
        $s = $this->sql;
        if (preg_match('/^INSERT INTO PENUMBRA_PALETTE_MISSES \(USER_KEY, TYPED, OUTCOME, PAGE_KIND, REPORT_SID\) VALUES \(:u, :t, :o, :p, :r\)$/', $s)) {
            $this->c->rows[] = array('USER_KEY' => $this->b[':u'], 'TYPED' => $this->b[':t'], 'OUTCOME' => $this->b[':o'], 'PAGE_KIND' => $this->b[':p'], 'REPORT_SID' => $this->b[':r'], 'age' => 0);
        } elseif (preg_match('/^DELETE FROM PENUMBRA_PALETTE_MISSES WHERE CREATED_AT < SYSDATE - (\d+)$/', $s, $m)) {
            $this->c->rows = array_values(array_filter($this->c->rows, function ($r) use ($m) { return $r['age'] <= (float)$m[1]; }));
        } elseif (preg_match('/FROM PENUMBRA_PALETTE_MISSES WHERE CREATED_AT >= SYSDATE - (\d+) ORDER BY CREATED_AT DESC/', $s, $m)) {
            $r = array_filter($this->c->rows, function ($r) use ($m) { return $r['age'] <= (float)$m[1]; });
            usort($r, function ($a, $b) { return $a['age'] <=> $b['age']; });
            foreach ($r as $x) { $x['AT'] = date('Y-m-d H:i', (int)(1790000000 - $x['age'] * 86400)); unset($x['age']); $this->out[] = $x; }
        } else {
            throw new Exception('unknown SQL: ' . $s);
        }
        return true;
    }
    public function fetch($mode = null) { return array_shift($this->out) ?: false; }
}

$R = array();
$t = function ($name, $cond, $detail = '') use (&$R) { $R[$name] = $cond ? true : ($detail === '' ? false : $detail); };

// ---- clean: four keys, caps, whitelists; table data in the payload never survives
$ev = pnbPmClean(array('text' => "  filter   smith \n", 'outcome' => 'nomatch', 'page' => 'report', 'report' => 'zzconf', 'cells' => 'SECRETCELL', 'row' => array('x')));
$t('clean-four-keys', is_array($ev) && array_keys($ev) === array('text', 'outcome', 'page', 'report'), json_encode($ev));
$t('clean-trim', $ev && $ev['text'] === 'filter smith', json_encode($ev));
$t('clean-cap-80', ($c = pnbPmClean(array('text' => str_repeat('a', 300), 'outcome' => 'find', 'page' => 'home'))) && mb_strlen($c['text']) === 80);
$t('clean-bad-outcome', pnbPmClean(array('text' => 'x', 'outcome' => 'picked:theme', 'page' => 'home')) === null);
$t('clean-empty-text', pnbPmClean(array('text' => '   ', 'outcome' => 'nomatch', 'page' => 'home')) === null);
$t('clean-report-only-on-report', ($c = pnbPmClean(array('text' => 'x', 'outcome' => 'nomatch', 'page' => 'dashboard', 'report' => 'dash-1'))) && $c['report'] === '');
$t('clean-bad-report-id', ($c = pnbPmClean(array('text' => 'x', 'outcome' => 'nomatch', 'page' => 'report', 'report' => "a' OR 1=1"))) && $c['report'] === '');

// ---- handle: method, sign-in, size, store
$conn = new FakeConn();
$rl = "$tmp/rl";
$body = json_encode(array('text' => 'pivot by month', 'outcome' => 'nomatch', 'page' => 'report', 'report' => 'zzconf', 'cells' => 'SECRETCELL'));
$t('handle-get-refused', pnbPmHandle('GET', $body, 'u1', $conn, $rl) === 'method');
$t('handle-anon-refused', pnbPmHandle('POST', $body, '', $conn, $rl) === 'anon');
$t('handle-big-refused', pnbPmHandle('POST', str_repeat('x', 3000), 'u1', $conn, $rl) === 'size');
$t('handle-stored', ($h = pnbPmHandle('POST', $body, 'u1', $conn, $rl)) === 'stored' && count($conn->rows) === 1, $h);
$t('handle-no-data-stored', strpos(json_encode($conn->rows), 'SECRETCELL') === false, json_encode($conn->rows));
$t('handle-db-fail-quiet', pnbPmHandle('POST', $body, 'u9', null, $rl) === 'db');

// ---- purge: a 31-day row goes on the next write, and on the next read
$conn = new FakeConn();
$conn->rows[] = array('USER_KEY' => 'old', 'TYPED' => 'old one', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'home', 'REPORT_SID' => '', 'age' => 31);
$conn->rows[] = array('USER_KEY' => 'new', 'TYPED' => 'recent', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'home', 'REPORT_SID' => '', 'age' => 29);
pnbPmHandle('POST', json_encode(array('text' => 'x', 'outcome' => 'find', 'page' => 'home')), 'u2', $conn, $rl);
$t('purge-on-write', count($conn->rows) === 2 && !in_array('old', array_column($conn->rows, 'USER_KEY'), true), json_encode($conn->rows));
$conn = new FakeConn();
$conn->rows[] = array('USER_KEY' => 'old', 'TYPED' => 'old one', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'home', 'REPORT_SID' => '', 'age' => 45);
$conn->rows[] = array('USER_KEY' => 'new', 'TYPED' => 'recent', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'home', 'REPORT_SID' => '', 'age' => 3);
$loaded = pnbPmLoad($conn);
$t('purge-on-read', count($conn->rows) === 1 && $conn->rows[0]['USER_KEY'] === 'new', json_encode($conn->rows));
$t('read-30-days', is_array($loaded) && count($loaded) === 1);

// ---- rate limit: 60 an hour per user, the 61st refused, another user unaffected, the next hour fresh
@mkdir("$tmp/rl2");
$okN = 0; for ($i = 0; $i < 60; $i++) $okN += pnbPmAllow('rate.user', "$tmp/rl2", 60, 1000000) ? 1 : 0;
$t('limit-60-allowed', $okN === 60, "allowed $okN");
$t('limit-61st-refused', pnbPmAllow('rate.user', "$tmp/rl2", 60, 1000100) === false);
$t('limit-per-user', pnbPmAllow('other.user', "$tmp/rl2", 60, 1000100) === true);
$t('limit-next-hour', pnbPmAllow('rate.user', "$tmp/rl2", 60, 1003700) === true);
$t('limit-default-60', PNB_PM_MAX_PER_HOUR === 60);
foreach (glob("$tmp/rl2/*") as $f) @unlink($f); @rmdir("$tmp/rl2");

// ---- grouping + the card
$rows = array(
    array('USER_KEY' => 'a', 'TYPED' => 'Pivot by month', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'report', 'REPORT_SID' => 'zz1', 'AT' => '2026-10-20 10:00'),
    array('USER_KEY' => 'b', 'TYPED' => 'pivot  by month?', 'OUTCOME' => 'askhelp', 'PAGE_KIND' => 'home', 'REPORT_SID' => '', 'AT' => '2026-10-21 09:00'),
    array('USER_KEY' => 'a', 'TYPED' => 'pivot by month', 'OUTCOME' => 'nomatch', 'PAGE_KIND' => 'report', 'REPORT_SID' => 'zz1', 'AT' => '2026-10-19 08:00'),
    array('USER_KEY' => 'c', 'TYPED' => '<script>x</script>', 'OUTCOME' => 'abandoned', 'PAGE_KIND' => 'admin', 'REPORT_SID' => '', 'AT' => '2026-10-18 08:00'),
);
$g = pnbPmGroup($rows);
$t('group-normalised', count($g) === 2 && $g[0]['count'] === 3 && count($g[0]['users']) === 2, json_encode($g));
$t('group-last-seen', $g[0]['last'] === '2026-10-21 09:00');
$t('group-outcome-mix', $g[0]['outcomes'] === array('nomatch' => 2, 'askhelp' => 1));
ob_start(); pnbPmCardBody($rows); $html = ob_get_clean();
$t('card-escapes', strpos($html, '<script>') === false && strpos($html, '&lt;script&gt;') !== false);
$t('card-drill-events', substr_count($html, '<details>') === 2 && substr_count($html, '<li>') === 4);
$t('card-mix-text', strpos($html, 'no match 2, Ask help 1') !== false, substr($html, 0, 300));
ob_start(); pnbPmCardBody(null); $h0 = ob_get_clean();
$t('card-no-table', strpos($h0, 'Not collecting yet') !== false);
ob_start(); pnbPmCardBody(array()); $h1 = ob_get_clean();
$t('card-empty', strpos($h1, 'No unmatched searches in the last 30 days') !== false);

echo json_encode($R);
