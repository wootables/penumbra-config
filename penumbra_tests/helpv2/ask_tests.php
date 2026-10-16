<?php
/**
 * ask_tests.php - the Ask page's pure half (help/ask.php) against a scratch state dir and a stub model
 * (phase 6, 2026-10-15). No network, no key: the model is a closure that records the prompt it was given.
 *
 *   php -n ask_tests.php --app=<stage or live> --orig=<dir with v1 help_content.php> --out=<scratch dir>
 *
 *   A1  a question with passages: one model call, a help-only prompt, the answer + its sources + a card
 *   A2  the same question in other words: the card answers, no model call, asked = 2
 *   A3  votes: one per person; score = up - down; a card at the retire score stops answering and is answered afresh
 *   A4  limits: the per-person minute limit and the shared day budget both refuse with 429 (clock injected)
 *   A5  no passages: a pasted SELECT and a question the help never mentions are answered at once, no model, no card
 *   A6  audience: chunks of an audience the reader may not read never reach the model or the sources
 *   A7  the answer is text only: tags stripped, entities decoded, length capped
 *   A8  the store: valid JSON, no tmp leftovers, unique ids, eviction keeps the cap
 *   A9  validation and permissions: empty, too long, unknown action, remove by a non-admin
 *   A10 the log: JSON lines, hashed users only, never the raw key
 * Exit = failures.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'out:'));
if (empty($o['app']) || empty($o['orig']) || empty($o['out'])) { fwrite(STDERR, "usage: --app=<dir> --orig=<dir> --out=<dir>\n"); exit(2); }
$app = rtrim(str_replace('\\', '/', $o['app']), '/'); $orig = rtrim(str_replace('\\', '/', $o['orig']), '/'); $out = rtrim(str_replace('\\', '/', $o['out']), '/');
if (!is_dir($out)) mkdir($out, 0777, true);
$R = new HvReport();

define('PNB_HELP_V2_FORCE', true);
define('PNB_HELP_SRC', $orig . '/help_content.php');
define('PNB_HELP_CACHE', $out . '/help_chunks.json');
define('PNB_HELP_CACHE_ALT', $out . '/help_chunks_alt.json');
define('PNB_HELP_CACHE_V2', $out . '/help_chunks_v2.json');
define('PNB_HELP_CACHE_V2_ALT', $out . '/help_chunks_v2_alt.json');
require $app . '/help_retrieval.php';          // requires help/manifest.php, which requires help/ask.php
$cache = pnb_help_build();
if (!$cache || empty($cache['chunks'])) { echo "  ask tests: the help chunks did not build\n"; echo "ask RED: build\n"; exit(1); }

function ask_rrmdir($d) { if (!is_dir($d)) return; foreach (scandir($d) as $f) { if ($f === '.' || $f === '..') continue; $p = "$d/$f"; if (is_dir($p)) ask_rrmdir($p); else @unlink($p); } @rmdir($d); }
function ask_dir($out, $name) { $d = "$out/ask_$name"; ask_rrmdir($d); mkdir($d, 0777, true); return $d; }
$calls = array(); $stubReply = 'ok';
$stub = function ($system, $user) use (&$calls, &$stubReply) { $calls[] = array('system' => $system, 'user' => $user); return $stubReply; };
$retrieve = function ($q, $topK, $auds) { return pnb_help_retrieve_chunks($q, $topK, $auds, 'ask'); };
$T0 = 1760000000;
function ctx($dir, $uid, $extra = array()) {
    global $retrieve, $stub, $T0;
    return array_merge(array('uid' => $uid, 'is_admin' => false, 'audiences' => array('viewer', 'writer', 'admin'), 'dir' => $dir,
        'config' => array('help_ask_per_minute' => 50, 'help_ask_per_day' => 500), 'now' => $T0, 'retrieve' => $retrieve, 'model' => $stub), $extra);
}
function store($dir) { return json_decode((string)@file_get_contents($dir . '/help_ask_cards.json'), true); }
function cardIn($dir, $id) { $d = store($dir); if (!$d) return null; foreach ($d['cards'] as $c) if ($c['id'] === $id) return $c; return null; }
$topics = pnb_help_v2_topics();

// ---------------------------------------------------------------- A1 / A2 / A3: one dir, one story
$d1 = ask_dir($out, 'story');
$stubReply = "Open the **Scheduler** tab and set the cron to `0 8 * * 1`.\n- pick the recipients\n- save\n[Scheduler]";
$q1 = 'How do I schedule an email report to go out every Monday?';
$r = pnb_ask_handle('ask', array('q' => $q1), ctx($d1, 'alice'));
$b = $r['body']; $card1 = isset($b['card']) ? $b['card'] : null;
$srcIds = array(); if (!empty($b['sources'])) foreach ($b['sources'] as $s) $srcIds[] = $s['id'];
$sys = count($calls) ? $calls[0]['system'] : ''; $usr = count($calls) ? $calls[0]['user'] : '';
$okA1 = $r['http'] === 200 && $b['status'] === 'success' && empty($b['cached']) && !empty($b['model']) && $b['answer'] === $stubReply
    && $card1 && preg_match('/^[a-f0-9]{12}$/', $card1['id']) && count($calls) === 1
    && stripos($sys, 'answer only from the passages') !== false && stripos($sys, 'never write sql') !== false
    && strpos($usr, 'HELP PASSAGES:') === 0 && strpos($usr, "\nQUESTION: " . $q1) !== false && strpos($usr, '[Topic: ') !== false
    && stripos($usr, 'DATABASE SCHEMA') === false && stripos($usr, 'CREATE TABLE') === false
    && in_array('schedulerHelpLightbox', $srcIds, true);
$R->check('A1', $okA1, $okA1 ? ('one model call, help-only prompt (' . strlen($usr) . ' chars), sources ' . implode(',', $srcIds) . ', card ' . $card1['id'])
    : ('http ' . $r['http'] . ' ' . json_encode(array('status' => $b['status'], 'cached' => isset($b['cached']) ? $b['cached'] : null, 'model' => isset($b['model']) ? $b['model'] : null, 'calls' => count($calls), 'sources' => $srcIds, 'msg' => isset($b['message']) ? $b['message'] : null))));

$r = pnb_ask_handle('ask', array('q' => 'how can I schedule an email report every monday'), ctx($d1, 'bob'));
$b = $r['body'];
$okA2 = $r['http'] === 200 && !empty($b['cached']) && count($calls) === 1 && $card1 && $b['card']['id'] === $card1['id'] && (int)$b['card']['asked'] === 2 && $b['answer'] === $stubReply;
$R->check('A2', $okA2, $okA2 ? 'the card answered the rephrased question (asked 2), the model stayed silent' : ('http ' . $r['http'] . ' cached=' . json_encode(isset($b['cached']) ? $b['cached'] : null) . ' calls=' . count($calls) . ' asked=' . (isset($b['card']['asked']) ? $b['card']['asked'] : '?')));

$id1 = $card1 ? $card1['id'] : '';
$v1 = pnb_ask_handle('vote', array('id' => $id1, 'v' => 'up'), ctx($d1, 'bob'))['body'];
$v2 = pnb_ask_handle('vote', array('id' => $id1, 'v' => 'up'), ctx($d1, 'bob'))['body'];      // the same person again: still one
$v3 = pnb_ask_handle('vote', array('id' => $id1, 'v' => 'down'), ctx($d1, 'carol'))['body'];
$v4 = pnb_ask_handle('vote', array('id' => $id1, 'v' => 'none'), ctx($d1, 'carol'))['body'];
pnb_ask_handle('vote', array('id' => $id1, 'v' => 'down'), ctx($d1, 'dave'));
pnb_ask_handle('vote', array('id' => $id1, 'v' => 'down'), ctx($d1, 'erin'));
pnb_ask_handle('vote', array('id' => $id1, 'v' => 'down'), ctx($d1, 'frank'));              // score 1 - 3 = -2: retired
$retiredCard = cardIn($d1, $id1);
$callsBefore = count($calls);
$stubReply = 'A fresh answer. [Scheduler]';
$r = pnb_ask_handle('ask', array('q' => $q1), ctx($d1, 'alice'));
$b = $r['body'];
$okA3 = $v1['card']['up'] === 1 && $v1['card']['mine'] === 'up' && $v2['card']['up'] === 1 && $v3['card']['down'] === 1 && $v3['card']['score'] === 0
    && $v4['card']['down'] === 0 && $v4['card']['mine'] === null && $retiredCard && !empty($retiredCard['retired'])
    && $r['http'] === 200 && empty($b['cached']) && count($calls) === $callsBefore + 1 && $b['card']['id'] === $id1 && $b['card']['up'] === 0 && $b['card']['down'] === 0
    && (int)$b['card']['asked'] === 3 && $b['answer'] === 'A fresh answer. [Scheduler]';
$R->check('A3', $okA3, $okA3 ? 'one vote per person, score up - down, retired at -2, then answered afresh (asked 3, votes reset)'
    : json_encode(array('v1' => isset($v1['card']) ? array($v1['card']['up'], $v1['card']['mine']) : $v1, 'v2up' => isset($v2['card']['up']) ? $v2['card']['up'] : null, 'v3' => isset($v3['card']) ? array($v3['card']['down'], $v3['card']['score']) : $v3, 'v4' => isset($v4['card']) ? array($v4['card']['down'], $v4['card']['mine']) : $v4, 'retired' => $retiredCard ? !empty($retiredCard['retired']) : null, 'regen' => array($r['http'], isset($b['cached']) ? $b['cached'] : null, count($calls) - $callsBefore, isset($b['card']) ? $b['card'] : null))));

// ---------------------------------------------------------------- A4 limits (own dirs, injected clock)
$d4 = ask_dir($out, 'limits');
$stubReply = 'Yes. [Download]';
$qs = array('how do I download a report as an excel file', 'how do I make a pivot table from the data', 'how do I copy rows to the clipboard', 'how do I change the theme in my settings');
$c4 = ctx($d4, 'alice', array('config' => array('help_ask_per_minute' => 2, 'help_ask_per_day' => 500)));
$h = array();
foreach (array(0, 1, 2) as $i) { $x = pnb_ask_handle('ask', array('q' => $qs[$i]), $c4); $h[] = $x['http'] . (isset($x['body']['model']) && $x['body']['model'] === false ? 'nomodel' : ''); }
$c4b = $c4; $c4b['now'] = $T0 + 61;
$x = pnb_ask_handle('ask', array('q' => $qs[2]), $c4b); $h[] = $x['http'];
$cOther = ctx($d4, 'zed', array('config' => array('help_ask_per_minute' => 2, 'help_ask_per_day' => 500)));
$x = pnb_ask_handle('ask', array('q' => $qs[3]), $cOther); $h[] = $x['http'];            // another person has a minute of their own
$d4b = ask_dir($out, 'budget');
$cDay = ctx($d4b, 'alice', array('config' => array('help_ask_per_minute' => 50, 'help_ask_per_day' => 1)));
$y1 = pnb_ask_handle('ask', array('q' => $qs[0]), $cDay); $y2 = pnb_ask_handle('ask', array('q' => $qs[1]), $cDay);
$cDay2 = $cDay; $cDay2['now'] = $T0 + 86400;
$y3 = pnb_ask_handle('ask', array('q' => $qs[1]), $cDay2);
$okA4 = $h === array('200', '200', '429', 200, 200) && $y1['http'] === 200 && $y2['http'] === 429 && !empty($y2['body']['quota']) && $y3['http'] === 200;
$R->check('A4', $okA4, $okA4 ? 'minute: 200 200 429, then 200 a minute later and 200 for another person; day budget: 200 429(quota) then 200 the next day'
    : ('minute ' . json_encode($h) . ' day ' . json_encode(array($y1['http'], $y2['http'], isset($y2['body']['quota']) ? $y2['body']['quota'] : null, $y3['http'])) . ' last msg ' . json_encode(isset($x['body']['message']) ? $x['body']['message'] : '')));

// ---------------------------------------------------------------- A5 no passages
$d5 = ask_dir($out, 'nopass');
$callsBefore = count($calls);
$s1 = pnb_ask_handle('ask', array('q' => "select award_id, amount\nfrom awards where amount > 500000"), ctx($d5, 'alice'));
$s2 = pnb_ask_handle('ask', array('q' => 'zzqx florp wibble grondle'), ctx($d5, 'alice'));
$st5 = store($d5);
$okA5 = $s1['http'] === 200 && $s1['body']['model'] === false && stripos($s1['body']['answer'], 'SQL') !== false && $s1['body']['card'] === null
    && $s2['http'] === 200 && $s2['body']['model'] === false && stripos($s2['body']['answer'], 'no passage') !== false
    && count($calls) === $callsBefore && (!$st5 || count($st5['cards']) === 0);
$R->check('A5', $okA5, $okA5 ? 'a pasted SELECT and an unknown question were answered at once: no model call, no card' : json_encode(array($s1['http'], isset($s1['body']['model']) ? $s1['body']['model'] : null, $s2['http'], isset($s2['body']['model']) ? $s2['body']['model'] : null, count($calls) - $callsBefore, $st5 ? count($st5['cards']) : 0)));

// ---------------------------------------------------------------- A6 audience filter
$d6 = ask_dir($out, 'aud');
$stubReply = 'Use the tag. [Query Prompts]';
$qw = 'how do I use the PROMPT tag in the SQL editor to ask the user for a value';
$all = pnb_ask_handle('ask', array('q' => $qw), ctx($d6, 'writer1'));
$viewerOnly = pnb_ask_handle('ask', array('q' => $qw . ' please'), ctx($d6, 'viewer1', array('audiences' => array('viewer'))));
function srcAuds($body, $topics) { $a = array(); if (!empty($body['sources'])) foreach ($body['sources'] as $s) { $id = $s['id']; $a[$id] = isset($topics[$id]) ? $topics[$id]['audience'] : (substr($id, -13) === '-tips-storage' ? 'viewer' : '?'); } return $a; }
$aAll = srcAuds($all['body'], $topics); $aView = srcAuds($viewerOnly['body'], $topics);
$allHasWriter = in_array('writer', $aAll, true) || in_array('admin', $aAll, true);
$viewClean = !in_array('writer', $aView, true) && !in_array('admin', $aView, true) && !in_array('?', $aView, true);
// The writer's card must not answer a viewer (in any wording), nor be listed to one; a writer sees it listed.
$listV = pnb_ask_handle('cards', array(), ctx($d6, 'viewer2', array('audiences' => array('viewer'))))['body']['cards'];
$listW = pnb_ask_handle('cards', array(), ctx($d6, 'writer2'))['body']['cards'];
$writerCardId = isset($all['body']['card']['id']) ? $all['body']['card']['id'] : '';
$listedToViewer = false; foreach ($listV as $c) if ($c['id'] === $writerCardId) $listedToViewer = true;
$listedToWriter = false; foreach ($listW as $c) if ($c['id'] === $writerCardId) $listedToWriter = true;
$okA6 = $all['http'] === 200 && $allHasWriter && $viewerOnly['http'] === 200 && $viewClean && empty($viewerOnly['body']['cached']) && !$listedToViewer && $listedToWriter;
$R->check('A6', $okA6, $okA6 ? ('all audiences: ' . json_encode($aAll) . '; viewer only: ' . json_encode($aView) . '; the writer card is listed to a writer, not to a viewer') : json_encode(array('all' => array($all['http'], $aAll), 'viewer' => array($viewerOnly['http'], $aView, isset($viewerOnly['body']['cached']) ? $viewerOnly['body']['cached'] : null), 'listedToViewer' => $listedToViewer, 'listedToWriter' => $listedToWriter)));

// ---------------------------------------------------------------- A7 text only
$d7 = ask_dir($out, 'clean');
$stubReply = "<script>alert(1)</script>Use <b>bold</b> &amp; `code` [Scheduler]\n\n\n\n" . str_repeat('x', 2000);
$t7 = pnb_ask_handle('ask', array('q' => $q1), ctx($d7, 'alice'));
$a7 = isset($t7['body']['answer']) ? $t7['body']['answer'] : '';
$okA7 = $t7['http'] === 200 && strpos($a7, '<') === false && strpos($a7, 'alert(1)') !== false && strpos($a7, 'bold & `code`') !== false
    && strpos($a7, "\n\n\n") === false && pnb_ask_len($a7) <= 1500 + 4 && substr($a7, -3) === '...';
$R->check('A7', $okA7, $okA7 ? ('tags out, entities decoded, capped at ' . pnb_ask_len($a7) . ' chars') : ('http ' . $t7['http'] . ' answer=' . json_encode(pnb_ask_cut($a7, 120)) . ' len=' . pnb_ask_len($a7)));

// ---------------------------------------------------------------- A8 the store
$d8 = ask_dir($out, 'evict');
$stubReply = 'Yes. [Download]';
$c8 = ctx($d8, 'alice', array('config' => array('help_ask_per_minute' => 50, 'help_ask_per_day' => 500, 'help_ask_max_cards' => 3)));
$asked8 = 0;
foreach (array_merge($qs, array($q1, $qw)) as $q) { $x = pnb_ask_handle('ask', array('q' => $q), $c8); if ($x['http'] === 200 && !empty($x['body']['model'])) $asked8++; }
$st8 = store($d8); $ids = array(); if ($st8) foreach ($st8['cards'] as $c) $ids[] = $c['id'];
$tmpLeft = glob($d8 . '/*.tmp*'); $tmpLeft1 = glob($d1 . '/*.tmp*');
$okA8 = $st8 && is_array($st8['cards']) && $asked8 >= 4 && count($st8['cards']) === 3 && count(array_unique($ids)) === count($ids) && !$tmpLeft && !$tmpLeft1 && store($d1) !== null;
$R->check('A8', $okA8, $okA8 ? ($asked8 . ' answers, 3 cards kept (cap 3), ids unique, no tmp leftovers, every store valid JSON') : json_encode(array('asked' => $asked8, 'cards' => $st8 ? count($st8['cards']) : null, 'ids' => $ids, 'tmp' => array($tmpLeft, $tmpLeft1))));

// ---------------------------------------------------------------- A9 validation and permissions
$d9 = ask_dir($out, 'valid');
$e1 = pnb_ask_handle('ask', array('q' => ''), ctx($d9, 'alice'));
$e2 = pnb_ask_handle('ask', array('q' => str_repeat('a', 600)), ctx($d9, 'alice'));
$e3 = pnb_ask_handle('bogus', array(), ctx($d9, 'alice'));
$e4 = pnb_ask_handle('ask', array('q' => array('not', 'a', 'string')), ctx($d9, 'alice'));
$stubReply = 'Yes. [Scheduler]';
$ok9 = pnb_ask_handle('ask', array('q' => $q1), ctx($d9, 'alice'));
$id9 = isset($ok9['body']['card']['id']) ? $ok9['body']['card']['id'] : '';
$e5 = pnb_ask_handle('remove', array('id' => $id9), ctx($d9, 'alice'));                          // not an admin
$e6 = pnb_ask_handle('remove', array('id' => 'nope'), ctx($d9, 'root', array('is_admin' => true)));
$e7 = pnb_ask_handle('vote', array('id' => 'zz', 'v' => 'up'), ctx($d9, 'alice'));
$e8 = pnb_ask_handle('vote', array('id' => 'abcdefabcdef', 'v' => 'up'), ctx($d9, 'alice'));
$e9 = pnb_ask_handle('remove', array('id' => $id9), ctx($d9, 'root', array('is_admin' => true)));
$gone = cardIn($d9, $id9) === null;
$codes = array($e1['http'], $e2['http'], $e3['http'], $e4['http'], $e5['http'], $e6['http'], $e7['http'], $e8['http'], $e9['http']);
$okA9 = $codes === array(400, 400, 400, 400, 403, 400, 400, 404, 200) && $gone;
$R->check('A9', $okA9, $okA9 ? 'empty 400, long 400, unknown action 400, non-string 400, remove by a viewer 403, bad id 400, bad vote id 400, unknown card 404, admin remove 200 and gone' : ('codes ' . json_encode($codes) . ' gone=' . json_encode($gone)));

// ---------------------------------------------------------------- A11 the editor-rights notice (the owner's rule, 2026-10-15)
$d11 = ask_dir($out, 'notice');
$stubReply = 'Use the tag. [Query Prompts]';
$n1 = pnb_ask_handle('ask', array('q' => $qw), ctx($d11, 'viewer3', array('role' => 'viewer')));          // writer passages, a viewer asks
$p11 = count($calls) ? $calls[count($calls) - 1]['user'] : '';
$n2 = pnb_ask_handle('ask', array('q' => $qw . ' thanks'), ctx($d11, 'writer3', array('role' => 'writer')));   // the card, a writer asks
$listV11 = pnb_ask_handle('cards', array(), ctx($d11, 'viewer4', array('role' => 'viewer')))['body']['cards'];
$listW11 = pnb_ask_handle('cards', array(), ctx($d11, 'writer4', array('role' => 'writer')))['body']['cards'];
$stubReply = 'Open Manage mode. [Report Repository]';
$qa = 'how do I use manage mode in the report repository to delete and retire reports';
$n3 = pnb_ask_handle('ask', array('q' => $qa), ctx($d11, 'writer5', array('role' => 'writer')));           // admin passages, a writer asks
$n4 = pnb_ask_handle('ask', array('q' => $qa), ctx($d11, 'admin1', array('role' => 'admin', 'is_admin' => true)));   // the card, an admin asks
$stubReply = 'Yes. [Download]';
$n5 = pnb_ask_handle('ask', array('q' => $qs[0]), ctx($d11, 'viewer3', array('role' => 'viewer')));       // viewer passages, a viewer asks
$okA11 = $n1['http'] === 200 && isset($n1['body']['notice']) && stripos($n1['body']['notice'], 'report owner') !== false && $n1['body']['card']['ta'] === 'writer'
    && strpos($p11, 'READER: a viewer') !== false && strpos($p11, 'Ask your report owner') !== false
    && $n2['http'] === 200 && !empty($n2['body']['cached']) && $n2['body']['notice'] === ''
    && count($listV11) === 1 && stripos($listV11[0]['notice'], 'report owner') !== false && count($listW11) === 1 && $listW11[0]['notice'] === ''
    && $n3['http'] === 200 && isset($n3['body']['notice']) && stripos($n3['body']['notice'], 'administrator') !== false && $n3['body']['card']['ta'] === 'admin'
    && $n4['http'] === 200 && !empty($n4['body']['cached']) && $n4['body']['notice'] === ''
    && $n5['http'] === 200 && $n5['body']['notice'] === '';
$R->check('A11', $okA11, $okA11 ? 'a viewer hears "ask your report owner" on writer passages (prompt and card alike), a writer does not; admin passages tell a writer to ask an administrator; viewer passages carry no notice'
    : json_encode(array('n1' => array($n1['http'], isset($n1['body']['notice']) ? $n1['body']['notice'] : null, isset($n1['body']['card']['ta']) ? $n1['body']['card']['ta'] : null, isset($n1['body']['sources']) ? $n1['body']['sources'] : null), 'prompt' => array(strpos($p11, 'READER: a viewer') !== false, strpos($p11, 'Ask your report owner') !== false), 'n2' => array($n2['http'], isset($n2['body']['cached']) ? $n2['body']['cached'] : null, isset($n2['body']['notice']) ? $n2['body']['notice'] : null), 'lists' => array(count($listV11), $listV11 ? $listV11[0]['notice'] : null, count($listW11), $listW11 ? $listW11[0]['notice'] : null), 'n3' => array($n3['http'], isset($n3['body']['notice']) ? $n3['body']['notice'] : null, isset($n3['body']['card']['ta']) ? $n3['body']['card']['ta'] : null, isset($n3['body']['sources']) ? $n3['body']['sources'] : null), 'n4' => array($n4['http'], isset($n4['body']['cached']) ? $n4['body']['cached'] : null, isset($n4['body']['notice']) ? $n4['body']['notice'] : null), 'n5' => array($n5['http'], isset($n5['body']['notice']) ? $n5['body']['notice'] : null))));

// ---------------------------------------------------------------- A10 the log
$log = @file_get_contents($d1 . '/help_ask_log.jsonl');
$lines = $log === false ? array() : array_values(array_filter(explode("\n", $log), 'strlen'));
$badLine = 0; $rawKey = 0; $hashOk = true;
foreach ($lines as $ln) { $j = json_decode($ln, true); if (!is_array($j)) { $badLine++; continue; } if (!isset($j['u']) || !preg_match('/^[a-f0-9]{16}$/', $j['u'])) $hashOk = false; if (preg_match('/\b(alice|bob|carol|dave|erin|frank)\b/', $ln)) $rawKey++; }
$okA10 = count($lines) >= 8 && $badLine === 0 && $rawKey === 0 && $hashOk;
$R->check('A10', $okA10, $okA10 ? (count($lines) . ' log lines, all JSON, users hashed, no raw key') : json_encode(array('lines' => count($lines), 'bad' => $badLine, 'raw' => $rawKey, 'hash' => $hashOk)));

$failed = $R->failed();
echo $failed ? ('ask RED: ' . implode(' ', $failed) . "\n") : "ask GREEN\n";
exit(count($failed));
