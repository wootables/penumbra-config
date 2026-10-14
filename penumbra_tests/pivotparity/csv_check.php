<?php
// Verify the headline claim directly: does the CSV attachment carry a Grand
// Total column for wavg / stddev / pNN the way it does for sum?
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

$rows = array(
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '10', 'AMOUNT' => '1000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '20', 'AMOUNT' => '9000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '50', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '60', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Sciences',    'FY' => '2024', 'RATE' => '5',  'AMOUNT' => '100'),
    array('COLLEGE' => 'Sciences',    'FY' => '2025', 'RATE' => '80', 'AMOUNT' => '9900'),
);
foreach (array('sum', 'avg', 'wavg@AMOUNT', 'stddev', 'p50', 'median', 'antimode', 'range') as $agg) {
    $set = array('rows'=>array('COLLEGE'),'cols'=>array('FY'),'vals'=>'RATE','agg'=>array($agg),
                 'rowLayout'=>'flat','colLayout'=>'flat','sortOrder'=>'asc');
    $csv = generate_pivot_csv_string($rows, $set);
    $x   = pivot_build_xlsx_rows($rows, $set);
    $line = preg_split('/\r\n|\n/', trim($csv));
    $hdr  = preg_replace('/^\xEF\xBB\xBF/', '', $line[0]);
    $hasCsvGT  = (stripos($hdr, 'Grand Total') !== false);
    $hasXlsxGT = !empty($x['hasGrandTotalCol']);
    printf("%-13s CSV grand-total col: %-3s | XLSX: %-3s   csv header: %s\n",
        $agg, $hasCsvGT ? 'YES' : 'NO', $hasXlsxGT ? 'YES' : 'NO', $hdr);
}
