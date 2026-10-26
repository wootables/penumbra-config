<?php
// dict suite - engine C (2026-10-22): a scheduled email's snippet with a data dictionary in it.
// The email strips action() (no links in mail); the dict| block must leave with its call: no
// "NAME | meaning" lines, no backtick, no dict| in the mail, and the text around it intact.
//   php -n email_tests.php <dir with runner_functions.php + dep_*.php>   (run.py extracts them)
$dir = $argv[1];
require $dir . '/runner_functions.php';
foreach (glob($dir . '/dep_*.php') as $f) require $f;
$pass = 0; $fail = 0;
function t($name, $ok, $info = '') { global $pass, $fail; if ($ok) { $pass++; } else { $fail++; echo "FAIL $name " . (is_string($info) ? substr($info, 0, 400) : json_encode($info)) . "\n"; } }

$data = array(array('V_ID' => '1', 'V_AMOUNT' => '10'), array('V_ID' => '2', 'V_AMOUNT' => '32.5'));
$cols = array('V_ID', 'V_AMOUNT');
$block = "action(infobox, Data dictionary, dict|`\nOne row per payment. Don't sum (twice.\nV_ID | The vendor's id, count() of them. | source: T.V_ID\nV_AMOUNT | ! Paid, \"dollars\", 50% (or so.\n`)";
$snip = "Total: sum(V_AMOUNT)\n" . $block . "\nRows: count()";
$out = execute_email_snippet($snip, $data, $cols, 'flat', array(), array('renderCharts' => false));
t('aroundIntact', strpos($out, 'Total:') !== false && strpos($out, '42.5') !== false && strpos($out, 'Rows:') !== false && strpos($out, '2') !== false, $out);
t('blockGone', strpos($out, 'V_ID |') === false && strpos($out, 'dict|') === false && strpos($out, '`') === false && strpos($out, 'One row per payment') === false, $out);
t('noLinkText', stripos($out, 'Data dictionary') === false, $out);
$plain = execute_email_snippet($snip, $data, $cols, 'flat', array(), array('renderCharts' => false), true);
t('plainBlockGone', strpos($plain, 'V_ID |') === false && strpos($plain, 'dict|') === false && strpos($plain, 'Total:') !== false, $plain);
// a blank label too
$out2 = execute_email_snippet("A\naction(infobox, , dict|`X | y`)\nB", $data, $cols, 'flat', array(), array('renderCharts' => false));
t('blankLabel', strpos($out2, 'X | y') === false && strpos($out2, 'A') !== false && strpos($out2, 'B') !== false, $out2);
// (2026-10-24 sweep) an apostrophe inside the block must not pair with one after it and shield a
// commented-out rule from the // stripper (parse_format_rules / _heatmap_ / _rewrite_)
$dead = "action(infobox, D, dict|`\nV_ID | The vendor's id\n`)\n// format(cell, V_AMOUNT, V_AMOUNT > 0, 'color:red')\nDon't worry.";
$live = str_replace('// format(', 'format(', $dead);
t('commentedRuleStaysDead', count(parse_format_rules($dead)) === 0, json_encode(parse_format_rules($dead)));
t('liveRuleStillRead', count(parse_format_rules($live)) >= 1, json_encode(parse_format_rules($live)));
$deadRw = "action(infobox, D, dict|`\nV_ID | The vendor's id\n`)\n// rewrite(V_ID, 'x{val}')\nDon't.";
t('commentedRewriteStaysDead', count(parse_rewrite_rules($deadRw)) === 0, json_encode(parse_rewrite_rules($deadRw)));
// positive control: a bare block (no action() around it) DOES reach the mail - the searches above can see a leak
$leak = execute_email_snippet("dict|`X | y`", $data, $cols, 'flat', array(), array('renderCharts' => false));
t('controlLeakVisible', strpos($leak, 'X | y') !== false, $leak);
echo "SUMMARY pass=$pass fail=$fail\n";
