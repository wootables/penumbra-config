<?php
// ai_stream_tests.php - the Anthropic SSE consumer of ai_assist.php (quick actions round 19a, 2026-10-21). The endpoint runs
// on include, so the two functions are lifted out of the file's text by name and evaluated; a canned stream is fed in
// uneven chunks (cut mid-line and mid-JSON) and the state is checked: the reply, the usage, the stop reason, an error event.
//   php -n ai_stream_tests.php --file <ai_assist.php>   prints T1..T6 and SSE: GREEN | RED
$o = getopt('', array('file:'));
if (empty($o['file'])) { fwrite(STDERR, "usage: --file <ai_assist.php>\n"); exit(2); }
$src = file_get_contents($o['file']);
if ($src === false) { fwrite(STDERR, "cannot read\n"); exit(2); }

function lift($src, $name) {
    $at = strpos($src, "\nfunction $name(");
    if ($at === false) return null;
    $i = strpos($src, '{', $at); $depth = 0; $n = strlen($src);
    for ($j = $i; $j < $n; $j++) {
        $c = $src[$j];
        if ($c === '{') $depth++;
        else if ($c === '}') { $depth--; if ($depth === 0) return substr($src, $at + 1, $j - $at); }
    }
    return null;
}
$fails = array(); $n = 0;
function chk($id, $ok, $note) { global $fails, $n; $n++; printf("  %s  %-4s %s\n", $ok ? 'PASS' : 'FAIL', $id, $note); if (!$ok) $fails[] = $id; }

$fState = lift($src, 'penumbra_ai_sse_state'); $fConsume = lift($src, 'penumbra_ai_sse_consume');
chk('T1', $fState && $fConsume, 'the state and the consumer are in the file');
if (!($fState && $fConsume)) { echo "SSE: RED\n"; exit(1); }
eval($fState . "\n" . $fConsume);

// the stream as the API sends it: event lines, data lines, blank separators; the JSON on one line each
$events = array(
    'event: message_start', 'data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":120,"cache_read_input_tokens":98000,"cache_creation_input_tokens":0,"output_tokens":1}}}', '',
    'event: content_block_start', 'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}', '',
    'event: content_block_delta', 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"(not the answer)"}}', '',
    'event: content_block_start', 'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}', '',
    'event: content_block_delta', 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Group the rows "}}', '',
    'event: content_block_delta', 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"by status.\n\n```penumbra-actions\n[{\"id\":\"combo:group\",\"args\":{\"column\":\"V_STATUS\"}}]\n```"}}', '',
    'event: content_block_stop', 'data: {"type":"content_block_stop","index":1}', '',
    'event: message_delta', 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":57}}', '',
    'event: message_stop', 'data: {"type":"message_stop"}', '',
);
$stream = implode("\r\n", $events) . "\r\n";
$want = "Group the rows by status.\n\n```penumbra-actions\n[{\"id\":\"combo:group\",\"args\":{\"column\":\"V_STATUS\"}}]\n```";

// T2: the whole stream in one chunk
$st = penumbra_ai_sse_state(); penumbra_ai_sse_consume($stream, $st);
chk('T2', $st['reply'] === $want && $st['in'] === 120 && $st['cache_read'] === 98000 && $st['out'] === 57 && $st['stop'] === 'end_turn' && $st['error'] === '' && $st['events'] >= 8,
    'one chunk: the text deltas only (not the thinking), the usage, the stop reason');
// T3: the same stream in 7-byte chunks (every line and every JSON cut somewhere)
$st = penumbra_ai_sse_state();
for ($i = 0; $i < strlen($stream); $i += 7) { penumbra_ai_sse_consume(substr($stream, $i, 7), $st); }
chk('T3', $st['reply'] === $want && $st['out'] === 57 && $st['stop'] === 'end_turn', 'tiny chunks: a line cut anywhere still reads whole');
// T4: chunks cut exactly at a line boundary and in the middle of the JSON text
$st = penumbra_ai_sse_state(); $cut = strpos($stream, 'Group the') + 4;
penumbra_ai_sse_consume(substr($stream, 0, $cut), $st); penumbra_ai_sse_consume(substr($stream, $cut), $st);
chk('T4', $st['reply'] === $want, 'a cut inside a delta\'s JSON: the remainder waits for the next chunk');
// T5: an error event ends the answer
$st = penumbra_ai_sse_state();
penumbra_ai_sse_consume("event: error\ndata: {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}\n\n", $st);
chk('T5', $st['error'] === 'Overloaded' && $st['reply'] === '', 'an error event is kept as the error, no reply');
// T6: junk lines and a non-SSE body (an HTTP error JSON) leave the state empty
$st = penumbra_ai_sse_state();
penumbra_ai_sse_consume("{\"type\":\"error\",\"error\":{\"message\":\"not a stream\"}}\n: keep-alive\n\ndata: not json\n", $st);
chk('T6', $st['events'] === 0 && $st['reply'] === '' && $st['error'] === '', 'a plain JSON body or junk is no event');

echo ($fails ? 'SSE: RED ' . implode(' ', $fails) : 'SSE: GREEN') . "\n";
exit($fails ? 1 : 0);
