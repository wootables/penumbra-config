<?php
/**
 * Mixed AND/OR parity: does the SCHEDULER's PHP search filter read a mixed
 * query the same way the browser does?
 *
 * Matters because the Visual Search Builder writes scheduled-task filters too
 * (openForScheduler -> #schedSearchFilter). Before per-row joiners it mangled
 * mixed queries so they never reached a task; now they can, so PHP has to agree.
 *
 * Both engines are supposed to apply AND-precedence: collapse every `and` pair
 * first, then OR the survivors -- `A or B and C` == `A or (B and C)`.
 *
 * Run:  php run.php        (mirror.php = extract_mirror.php of schedule_runner.php;
 *                           NEVER require schedule_runner.php itself - it opens
 *                           Oracle and sends email.)
 */
require __DIR__ . '/mirror.php';
// 2026-09-05: the search engine lives in penumbra_search.php (pure declarations,
// safe to require directly). A mirror lifted from an older runner still carries
// it, hence the guard.
if (!function_exists('php_apply_search_filter')) {
    require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_search.php';
}

$rows = array(
    array('ID' => '1', 'A' => 'yes', 'B' => 'yes', 'C' => 'yes'),
    array('ID' => '2', 'A' => 'yes', 'B' => 'yes', 'C' => 'no'),
    array('ID' => '3', 'A' => 'yes', 'B' => 'no',  'C' => 'yes'),
    array('ID' => '4', 'A' => 'yes', 'B' => 'no',  'C' => 'no'),
    array('ID' => '5', 'A' => 'no',  'B' => 'yes', 'C' => 'yes'),
    array('ID' => '6', 'A' => 'no',  'B' => 'yes', 'C' => 'no'),
    array('ID' => '7', 'A' => 'no',  'B' => 'no',  'C' => 'yes'),
    array('ID' => '8', 'A' => 'no',  'B' => 'no',  'C' => 'no'),
);

function ids($result) {
    $out = array();
    foreach ($result as $r) { $out[] = $r['ID']; }
    sort($out);
    return implode(',', $out);
}

$pass = 0; $fail = 0;
function check($label, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $label\n"; }
    else { $fail++; echo "  FAIL $label\n         got:  $got\n         want: $want\n"; }
}

echo "=== AND-precedence in php_apply_search_filter ===\n";

// The discriminating case. Row 2 is A=yes B=yes C=no:
//   AND-precedence  A or (B and C) -> TRUE  (A alone carries it)
//   left-to-right   (A or B) and C -> FALSE
// So row 2's presence is the whole test: it separates the two readings.
check('A or B and C  (row 2 present => AND-precedence)',
    ids(php_apply_search_filter($rows, 'flat', "A = yes or B = yes and C = yes")),
    '1,2,3,4,5');   // every A=yes (1-4), plus 5 via (B and C)

// Mirror image: the AND run comes first.
check('A and B or C',
    ids(php_apply_search_filter($rows, 'flat', "A = yes and B = yes or C = yes")),
    '1,2,3,5,7');   // (A and B): 1,2 ; C=yes: 1,3,5,7

// Pure chains still behave.
check('A and B and C', ids(php_apply_search_filter($rows, 'flat', "A = yes and B = yes and C = yes")), '1');
check('A or B or C',   ids(php_apply_search_filter($rows, 'flat', "A = yes or B = yes or C = yes")),   '1,2,3,4,5,6,7');
check('A and B',       ids(php_apply_search_filter($rows, 'flat', "A = yes and B = yes")),             '1,2');
check('A or B',        ids(php_apply_search_filter($rows, 'flat', "A = yes or B = yes")),              '1,2,3,4,5,6');

// Two AND runs either side of an OR - the shape the builder emits from
// [and][and][or][and] joiners.
check('A and B or C and (A) ... two and-runs around one or',
    ids(php_apply_search_filter($rows, 'flat', "A = yes and B = yes or C = yes and B = yes")),
    '1,2,5');       // (A and B): 1,2 ; (C and B): 1,5

// Negative control: a query the OLD builder would have produced from the same
// rows after mangling - the `or` clause swallowed into a quoted value. It must
// match NOTHING, which is exactly the silent data loss this change removes.
check('CONTROL mangled form matches nothing',
    ids(php_apply_search_filter($rows, 'flat', "A = yes and B = 'yes or C = yes'")),
    '');

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
