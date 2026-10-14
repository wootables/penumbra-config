<?php
// autofillterm - the type-ahead term of get_autofill_values.php (2026-09-24).
// Usage: php -n test_autofillterm.php <path to get_autofill_values.php> [mutant]
// Lifts penumbraAutofillTermWhere() out of the endpoint with the tokenizer (the endpoint
// itself is NEVER included: it opens a database connection and exits), optionally mutates
// it, then checks the clauses/params it builds and what they would match.
$target = isset($argv[1]) ? $argv[1] : '';
$mutant = isset($argv[2]) ? $argv[2] : '';
$pass = 0; $fail = 0;
function ok($cond, $name, $got = null, $want = null) {
    global $pass, $fail;
    if ($cond) { $pass++; echo "  ok    $name\n"; return; }
    $fail++; echo "  FAIL  $name\n";
    if ($want !== null) echo "        want: " . json_encode($want) . "\n";
    if ($got !== null) echo "        got:  " . json_encode($got) . "\n";
}
function finish() {
    global $pass, $fail;
    echo "\nPASS: $pass   FAIL: $fail\n";
    echo ($fail === 0 ? "RESULT: GREEN\n" : "RESULT: RED\n");
    exit($fail === 0 ? 0 : 1);
}

// ---- lift the function -----------------------------------------------------------------
$src = @file_get_contents($target);
if ($src === false) { ok(false, "read $target"); finish(); }
$toks = token_get_all($src);
$fn = null;
for ($i = 0, $n = count($toks); $i < $n; $i++) {
    if (!is_array($toks[$i]) || $toks[$i][0] !== T_FUNCTION) continue;
    $j = $i + 1;
    while ($j < $n && is_array($toks[$j]) && $toks[$j][0] === T_WHITESPACE) $j++;
    if (!is_array($toks[$j]) || $toks[$j][1] !== 'penumbraAutofillTermWhere') continue;
    $depth = 0; $started = false; $buf = '';
    for ($k = $i; $k < $n; $k++) {
        $t = is_array($toks[$k]) ? $toks[$k][1] : $toks[$k];
        $buf .= $t;
        if ($t === '{' || (is_array($toks[$k]) && in_array($toks[$k][0], array(T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES), true))) { $depth++; $started = true; }
        elseif ($t === '}') { $depth--; if ($started && $depth === 0) break; }
    }
    $fn = $buf;
    break;
}
ok($fn !== null, 'penumbraAutofillTermWhere() is defined in the target');
if ($fn === null) finish();

// ---- mutants: each must turn exactly its own tests red --------------------------------
$muts = array(
    'contiguous' => array("preg_split('/[\\s,]+/'", "preg_split('/(?!)/'"),        // no word split at all
    'nocomma'    => array("'/[\\s,]+/'", "'/\\s+/'"),                               // commas stay inside words
    'nocap'      => array('array_slice($words, 0, 10)', '$words'),                  // unbounded clause count
    'nofallback' => array('$words = array((string)$term);', '$words = array();'),    // separators-only term matches nothing
    'noupper'    => array("strtoupper(\$w)", "\$w"),                                // lower-case typed text vs UPPER(label)
    'nounder'    => array("':term_' . \$i . '_'", "':term_' . \$i"),                // placeholders lose the trailing _
);
if ($mutant !== '') {
    if (!isset($muts[$mutant])) { ok(false, "unknown mutant $mutant"); finish(); }
    $m = $muts[$mutant];
    $cnt = substr_count($fn, $m[0]);
    ok($cnt === 1, "mutant $mutant anchor found once", $cnt, 1);
    $fn = str_replace($m[0], $m[1], $fn);
}
eval($fn);

// ---- helpers ---------------------------------------------------------------------------
// What the database does with the clauses: every param '%W%' must be inside UPPER(label).
function matches($label, $term) {
    list($clauses, $params) = penumbraAutofillTermWhere('LABEL', $term);
    if (count($clauses) !== count($params)) return null;
    $u = strtoupper($label);
    foreach ($params as $p) {
        $w = substr($p, 1, -1);
        if ($w === '' ) continue;
        if (strpos($u, $w) === false) return false;
    }
    return true;
}
function oldMatch($label, $term) {   // the endpoint before 2026-09-24: one contiguous LIKE
    return strpos(strtoupper($label), strtoupper($term)) !== false;
}

echo "A. clauses and params\n";
list($c, $p) = penumbraAutofillTermWhere('CONCAT(A, B)', 'limon');
ok($c === array('UPPER(CONCAT(A, B)) LIKE :term_0_'), 'one word = one clause on the whole label expression', $c);
ok($p === array(':term_0_' => '%LIMON%'), 'one word = %WORD% upper-cased', $p);
list($c, $p) = penumbraAutofillTermWhere('L', 'Rusty Earl');
ok(array_values($p) === array('%RUSTY%', '%EARL%'), 'two words = two params in typed order', $p);
ok(count($c) === 2 && $c[1] === 'UPPER(L) LIKE :term_1_', 'second clause uses :term_1_', $c);
list($c, $p) = penumbraAutofillTermWhere('L', 'Earl, Rusty');
ok(array_values($p) === array('%EARL%', '%RUSTY%'), '"Earl, Rusty" splits on the comma and the space', $p);
list($c, $p) = penumbraAutofillTermWhere('L', 'Rusty,Earl');
ok(array_values($p) === array('%RUSTY%', '%EARL%'), '"Rusty,Earl" splits on a bare comma', $p);
list($c, $p) = penumbraAutofillTermWhere('L', "  limon \t");
ok(array_values($p) === array('%LIMON%'), 'stray spaces and tabs around one word are dropped', $p);
list($c, $p) = penumbraAutofillTermWhere('L', ',');
ok(array_values($p) === array('%,%'), 'a term of separators only is matched whole, as before', $p);
list($c, $p) = penumbraAutofillTermWhere('L', '   ');
ok(array_values($p) === array('%   %'), 'a blank term is matched whole, as before', $p);
list($c, $p) = penumbraAutofillTermWhere('L', 'a b c d e f g h i j k l');
ok(count($c) === 10 && count($p) === 10, '12 words are capped at 10 clauses', count($c), 10);
list($c, $p) = penumbraAutofillTermWhere('L', "O'Brien smith-jones bplimon@ncsu.edu 0012");
ok(array_values($p) === array("%O'BRIEN%", '%SMITH-JONES%', '%BPLIMON@NCSU.EDU%', '%0012%'), 'apostrophes, hyphens, emails and digits stay inside their word', $p);

echo "B. placeholders survive the MS-SQL positional swap\n";
list($c, $p) = penumbraAutofillTermWhere('L', 'a b c d e f g h i j');
$keys = array_keys($p);
$keys[] = ':cnd_10_'; $keys[] = ':cnd_11_';   // the condition binds that follow in the endpoint
$prefix = array();
foreach ($keys as $a) foreach ($keys as $b) if ($a !== $b && strpos($b, $a) === 0) $prefix[] = "$a < $b";
ok(!$prefix, 'no placeholder name is the start of another (str_replace swaps them one by one)', $prefix);
$sql = 'SELECT DISTINCT L AS label FROM T WHERE ' . implode(' AND ', $c) . ' AND X = :cnd_10_ AND Y = :cnd_11_';
$all = $p; $all[':cnd_10_'] = 'x'; $all[':cnd_11_'] = 'y';
$pos = $sql; $vals = array(); $i = 1;
foreach ($all as $k => $v) { $pos = str_replace($k, '?', $pos); $vals[$i++] = $v; }   // the endpoint's own loop
ok(substr_count($pos, '?') === count($all) && strpos($pos, ':') === false, 'every placeholder became exactly one ? and none is left', $pos);
list($c1, $p1) = penumbraAutofillTermWhere('L', 'a b c d e f g h i j k l m');
ok(count(array_unique(array_keys($p1))) === count($p1), 'placeholder names are unique', array_keys($p1));

echo "C. what the suggestions match (Earl,Rusty with legal name Earl,Theo)\n";
$rusty = 'Earl,Rusty (Earl,Theo) - rearl@ncsu.edu - 001234567';
foreach (array('Rusty Earl', 'earl rusty', 'Earl, Rusty', 'Rusty, Earl', 'theo', 'Theo Earl', 'Earl,Theo', 'rearl', '001234', 'EARL') as $t) {
    ok(matches($rusty, $t) === true, "\"$t\" finds $rusty");
}
foreach (array('Rusty Smith', 'Theodore', 'Earl Jones', 'rearl2') as $t) {
    ok(matches($rusty, $t) === false, "\"$t\" does not find it");
}
$plain = 'Limon,Bruce Patrick - bplimon@ncsu.edu - 000000042';
ok(matches($plain, 'Bruce Limon') === true, '"Bruce Limon" finds Limon,Bruce Patrick (the middle name no longer blocks it)');
ok(matches($plain, 'bruce patrick limon') === true, 'first, middle, last in natural order');
ok(oldMatch($plain, 'Bruce Limon') === false, 'control: the old contiguous match missed "Bruce Limon"');

echo "D. never fewer suggestions than before\n";
$labels = array($rusty, $plain, '060401 - ORI-Ofc of Sponsored Programs', 'UP02 - Unpaid Research Scholar', 'VET 0000NA', 'A - Active', 'Smith-Jones,Mary Ann - msj@ncsu.edu - 000000001');
$terms = array('lim', 'Limon,Bruce', 'Bruce Patrick', 'Sponsored Programs', 'ORI-Ofc', 'Unpaid Research', 'VET 0000', 'A - Act', 'Mary Ann', 'smith-jones,mary', 'Ofc of', ' - ', '00');
$lost = array();
foreach ($labels as $l) foreach ($terms as $t) if (oldMatch($l, $t) && matches($l, $t) !== true) $lost[] = "$t -> $l";
ok(!$lost, 'every old match is still a match (' . count($labels) * count($terms) . ' label/term pairs)', $lost);

echo "E. case\n";
list($c, $p) = penumbraAutofillTermWhere('L', 'jos' . "\xC3\xA9" . ' ruiz');
ok(array_values($p) === array('%JOS' . "\xC3\xA9" . '%', '%RUIZ%'), 'ASCII upper-cased, other bytes passed through as before', $p);

finish();
