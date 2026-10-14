<?php
/**
 * Reproduce the reported mismatch: an EMPTY min cell renders blank in the XLSX
 * attachment but "$0" in the HTML email body.
 *
 * The earlier builder_diff fixture never caught this because every row/column
 * combination in it had at least one row - so no cell was ever empty, and the
 * sentinel path was never taken. This fixture deliberately leaves holes in the
 * grid (Sci has no 2024 row, Eng has no 2026 row).
 */
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

// Deliberately sparse: Eng has 2024+2025, Sci has 2025 only, nobody has 2026
// except Sci. Every hole is an empty min cell.
$rows = array(
    array('COLLEGE'=>'Eng', 'FY'=>'2024', 'AMT'=>'10'),
    array('COLLEGE'=>'Eng', 'FY'=>'2025', 'AMT'=>'50'),
    array('COLLEGE'=>'Sci', 'FY'=>'2025', 'AMT'=>'0'),   // a GENUINE zero
    array('COLLEGE'=>'Sci', 'FY'=>'2026', 'AMT'=>'80'),
);
$set = array('rows'=>array('COLLEGE'), 'cols'=>array('FY'), 'vals'=>'AMT',
             'agg'=>array('min'), 'rowLayout'=>'flat', 'colLayout'=>'flat', 'sortOrder'=>'asc');

echo "grid: Eng has 2024,2025 (no 2026) | Sci has 2025,2026 (no 2024)\n";
echo "so Eng/2026 and Sci/2024 are EMPTY cells; Sci/2025 is a GENUINE 0\n\n";

echo "=== what pivot_extract_agg_value returns for an empty cell ===\n";
$pd = pivot_process_data($rows, array('COLLEGE'), array('FY'), 'AMT', null, null, array('min'));
foreach (array('Eng','Sci') as $rk) {
    foreach (array('2024','2025','2026') as $ck) {
        $cd = isset($pd['data'][$rk][$ck]) ? $pd['data'][$rk][$ck] : null;
        $v  = pivot_extract_agg_value($cd, 'min');
        printf("  %-4s %-5s cellExists=%-3s min=%-12s formatted=%s\n",
            $rk, $ck, $cd ? 'yes' : 'NO', var_export($v, true),
            "'" . pivot_format_value($v, 'min', true, 0, false) . "'");
    }
}

echo "\n=== HTML builder: the Eng row ===\n";
$html = generate_pivot_html($rows, $set, 'theme-default', true);
if (preg_match('#<tr[^>]*>(?:(?!</tr>).)*?>Eng</td>(?:(?!</tr>).)*?</tr>#s', $html, $m)) {
    preg_match_all('#<td[^>]*>(.*?)</td>#s', $m[0], $c);
    $cells = array_map(function ($v) { return trim(strip_tags($v)); }, $c[1]);
    echo "  cells: " . json_encode($cells) . "\n";
} else { echo "  (Eng row not found)\n"; }

echo "\n=== XLSX builder: the Eng row ===\n";
$x = pivot_build_xlsx_rows($rows, $set);
foreach ($x['dataRows'] as $r) {
    if (isset($r[0]) && trim((string)$r[0]) === 'Eng') { echo "  cells: " . json_encode($r) . "\n"; }
}

echo "\n=== CSV builder: the Eng row ===\n";
$csv = generate_pivot_csv_string($rows, $set);
foreach (preg_split('/\r\n|\n/', trim($csv)) as $ln) {
    if (strpos($ln, 'Eng') === 0) { echo "  " . $ln . "\n"; }
}
echo "\nEXPECTED: the empty cell prints BLANK in all three; the genuine 0 prints 0.\n";
