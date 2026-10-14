<?php
/**
 * penumbra_tests/tablecase - allow-list case-normalization seam.
 *
 * Guards the 2026-09-01 fix for "RED_PT_SUBMITTED_PROPOSALS_v2": a mis-cased
 * config entry made a table permanently unqueryable, because every allow-list
 * check compares an ALREADY-UPPERCASED needle against the raw config strings
 * with a case-SENSITIVE in_array().
 *
 * Loads the real penumbraNormalizeTableList() out of db_connection.php by
 * tokenizer extraction - db_connection.php cannot simply be require'd here
 * (it wants a live config + DB creds).
 */

$pass = 0; $fail = 0; $failures = array();
function ok($cond, $label) {
    global $pass, $fail, $failures;
    if ($cond) { $pass++; } else { $fail++; $failures[] = $label; }
}

// ---- Extract the helper from the live source (no DB, no config) ----
$src = @file_get_contents('\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\db_connection.php');
if ($src === false) {
    $src = @file_get_contents('C:/inetpub/wwwroot/sponsor_migration/penumbra/db_connection.php');
}
if ($src === false) { fwrite(STDERR, "FATAL: cannot read db_connection.php\n"); exit(2); }

$tokens = token_get_all($src);
$fnSrc = null;
for ($i = 0; $i < count($tokens); $i++) {
    if (is_array($tokens[$i]) && $tokens[$i][0] === T_FUNCTION) {
        // find the name
        for ($j = $i + 1; $j < count($tokens); $j++) {
            if (is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                if ($tokens[$j][1] !== 'penumbraNormalizeTableList') break;
                // capture from 'function' to its matching closing brace
                $depth = 0; $started = false; $buf = '';
                for ($k = $i; $k < count($tokens); $k++) {
                    $t = $tokens[$k];
                    $txt = is_array($t) ? $t[1] : $t;
                    $buf .= $txt;
                    if ($txt === '{') { $depth++; $started = true; }
                    elseif ($txt === '}') { $depth--; if ($started && $depth === 0) break 3; }
                }
            }
            if (!is_array($tokens[$j]) && $tokens[$j] === '(') break;
        }
    }
}
// $buf holds the function source when the break 3 fired
if (!isset($buf) || strpos($buf, 'penumbraNormalizeTableList') === false) {
    fwrite(STDERR, "FATAL: could not extract penumbraNormalizeTableList()\n"); exit(2);
}
eval($buf);
ok(function_exists('penumbraNormalizeTableList'), 'helper extracted and defined');

// ---- 1. The actual bug: the mis-cased entry now matches ----
$list = penumbraNormalizeTableList(array('STATS_COMBINED_V2', 'RED_PT_SUBMITTED_PROPOSALS_v2', 'DUAL'));
ok(in_array('RED_PT_SUBMITTED_PROPOSALS_V2', $list), 'mis-cased entry matches the uppercased needle');
ok(!in_array('RED_PT_SUBMITTED_PROPOSALS_v2', $list), 'lowercase form no longer present');
ok(in_array('STATS_COMBINED_V2', $list), 'already-uppercase entry survives unchanged');
ok(in_array('DUAL', $list), 'DUAL survives (audit/permission guard depends on it)');

// ---- 2. JSON SHAPE: index.php + grants_admin.php json_encode these ----
// A gap in the integer keys encodes as a JSON object and breaks the browser.
$dupes = penumbraNormalizeTableList(array('AWARD', 'award', 'AWARD ', 'SUBAWARD'));
ok($dupes === array_values($dupes), 'result is a packed list (no key gaps)');
$json = json_encode($dupes);
ok(substr($json, 0, 1) === '[', 'json_encode yields an ARRAY, not an object: ' . $json);
ok(count($dupes) === 2, 'case/whitespace duplicates collapse to one entry');

// ---- 3. Whitespace + junk: the other silent-disable typo classes ----
$ws = penumbraNormalizeTableList(array('  PADDED_NAME  ', "\tTABBED\t"));
ok(in_array('PADDED_NAME', $ws), 'leading/trailing spaces trimmed');
ok(in_array('TABBED', $ws), 'tabs trimmed');

$junk = penumbraNormalizeTableList(array('GOOD', '', '   ', null, 42, array('x')));
ok($junk === array('GOOD'), 'empties/nulls/non-strings dropped, list stays packed');
ok(json_encode($junk) === '["GOOD"]', 'filtered result still encodes as an array');

// ---- 4. Degenerate inputs must not fatal (config could be malformed) ----
ok(penumbraNormalizeTableList(array()) === array(), 'empty array in, empty array out');
ok(penumbraNormalizeTableList('not-an-array') === array(), 'non-array input returns empty (deny-by-default)');
ok(penumbraNormalizeTableList(null) === array(), 'null input returns empty (deny-by-default)');

// ---- 5. Deny-by-default is PRESERVED: normalization must not widen access ----
$allow = penumbraNormalizeTableList(array('AWARD', 'SUBAWARD'));
ok(!in_array('PS_JOB', $allow), 'a table absent from config is still absent after normalization');
ok(!in_array('', $allow), 'empty string never becomes a member (would match a blank needle)');
ok(count($allow) === 2, 'normalization adds no members');

// ---- 6. The real config, end to end ----
$cfgPath = 'D:/Utilities/PHP_8.2-p/penumbra_config.php';
if (!is_file($cfgPath)) { $cfgPath = '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_config.php'; }
if (is_file($cfgPath)) {
    $raw = file_get_contents($cfgPath);
    // The entry had TWO defects: lowercase "v2", and "PROPOSALS" where the real
    // NC_REPORTING table is "PROPOSAL" (singular). Both are fixed; assert neither
    // spelling can come back.
    ok(strpos($raw, 'RED_PT_SUBMITTED_PROPOSALS_v2') === false, 'config no longer holds the lowercase _v2 entry');
    ok(strpos($raw, 'RED_PT_SUBMITTED_PROPOSALS') === false, 'config no longer holds the plural "PROPOSALS" misspelling');
    ok(strpos($raw, 'RED_PT_SUBMITTED_PROPOSAL_V2') !== false, 'config holds the real table name RED_PT_SUBMITTED_PROPOSAL_V2');
    // every name inside allowed_tables must already be canonical
    // Capture the WHOLE allowed_tables block, not just its first connection:
    // the inner per-connection lists close with tab indentation, the outer
    // block closes with 4 spaces. A non-greedy match stops at the first inner
    // close and would check only 'ieprd' (62 of ~130 names).
    if (preg_match('/\'allowed_tables\'\s*=>\s*\[(.*)\n    \],/s', $raw, $m)) {
        preg_match_all('/"([A-Za-z0-9_.]+)"/', $m[1], $names);
        $bad = array();
        foreach ($names[1] as $n) { if ($n !== strtoupper($n)) { $bad[] = $n; } }
        ok(empty($bad), 'every allowed_tables entry is uppercase (found: ' . implode(',', $bad) . ')');
        ok(count($names[1]) > 100, 'sanity: parsed all five connections (' . count($names[1]) . ' names)');
        // Prove the block really spans all five connections, not just ieprd.
        $seen = 0;
        foreach (array('ieprd', 'pins', 'infoed', 'hr', 'fin') as $c) {
            if (strpos($m[1], "'" . $c . "'") !== false) { $seen++; }
        }
        ok($seen === 5, 'captured block covers all 5 connection keys (saw ' . $seen . ')');
        // Spot-check a known member of the LAST connection in the block.
        ok(in_array('PS_NC_PROJECT_PI', $names[1]), 'block reaches the final fin entry');
    } else {
        ok(false, 'could not parse allowed_tables block out of config');
    }
} else {
    fwrite(STDERR, "NOTE: config not readable from here; skipped section 6\n");
}

echo "\n=== tablecase ===\npass=$pass fail=$fail\n";
if ($fail) { echo "FAILURES:\n - " . implode("\n - ", $failures) . "\n"; }
