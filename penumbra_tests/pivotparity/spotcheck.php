<?php
// Independent spot-check of the two suspected REAL divergences, straight against
// the extracted mirror - no harness, no Edge, no canon layer in the way.
require_once __DIR__ . '/pivot_mirror.php';

echo "--- 1. min/max on a cell with no numeric values ---\n";
$empty = array('count' => 3, 'sum' => 0, 'numericCount' => 0,
               'min' => 1e308, 'max' => -1e308,
               'distinct' => array('a','b'), 'values' => array('a','b','c'), 'wpairs' => array());
printf("  PHP min      : %s\n", var_export(pivot_extract_agg_value($empty, 'min'), true));
printf("  PHP max      : %s\n", var_export(pivot_extract_agg_value($empty, 'max'), true));
printf("  PHP range    : %s\n", var_export(pivot_extract_agg_value($empty, 'range'), true));
echo "  (JS now returns Infinity / -Infinity so the renderer blanks the cell)\n";

echo "\n--- 2. scientific notation in a data cell ---\n";
foreach (array('1e3', '1E3', '2.5e2', '1e', '0x10', '1_000', '+5', '5.', '.5', 'INF', 'NaN') as $s) {
    $p = pivot_parse_value($s);
    printf("  %-8s PHP pivot_parse_value -> %s\n", "'$s'", var_export($p, true));
}
echo "  (JS parseAccountingNumber rejects anything its ^[-+]?(\\d+(\\.\\d*)?|\\.\\d+)$ test fails)\n";

echo "\n--- 3. does the same value bucket differently? ---\n";
foreach (array('1e3', '1000') as $s) {
    printf("  %-7s bin(w=10) -> %-22s binlog -> %s\n", "'$s'",
        pivot_bin_bucket_label('bin', $s, 10), pivot_bin_bucket_label('binlog', $s, null));
}
