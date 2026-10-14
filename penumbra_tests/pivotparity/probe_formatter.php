<?php
// Theory: the HTML builder pre-blanks the sentinel into an EMPTY STRING and then
// hands that string to pivot_format_value(), which no longer recognizes it as
// the sentinel and re-numifies it: (float)'' === 0.0 -> "$0".
// The XLSX builder passes the RAW sentinel straight in, so its guard fires.
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require_once __DIR__ . '/pivot_mirror.php';

$cases = array(
    "RAW sentinel (what XLSX passes)" => 1e308,
    "EMPTY STRING (what HTML passes)" => '',
    "null"                            => null,
    "genuine zero"                    => 0,
    "real value"                      => 10,
);
printf("%-34s %-14s %s\n", 'value handed to pivot_format_value', 'php type', "rendered (min, currency)");
echo str_repeat('-', 82) . "\n";
foreach ($cases as $label => $v) {
    printf("%-34s %-14s '%s'\n", $label, gettype($v),
        strip_tags(pivot_format_value($v, 'min', true, 0, false)));
}
echo "\nzero_is_meaningful('min') = " . var_export(pivot_zero_is_meaningful('min'), true) . "\n";
echo "zero_is_meaningful('sum') = " . var_export(pivot_zero_is_meaningful('sum'), true) . "\n";
