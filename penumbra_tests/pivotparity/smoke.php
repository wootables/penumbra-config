<?php
// Confirm the extracted mirror loads with NO side effects and exposes the pivot API.
ob_start();
require_once __DIR__ . '/pivot_mirror.php';
$stray = ob_get_clean();

$need = array(
  'pivot_extract_agg_value','pivot_compute_agg_from_values','pivot_sample_stddev',
  'pivot_percentile_of','pivot_percentile_p','pivot_wavg_of','pivot_wavg_weight_col',
  'pivot_wavg_pair','pivot_antimode_from_values','pivot_parse_numeric_values',
  'pivot_parse_field_token','pivot_bin_bucket_label','pivot_bins_bucket_label',
  'pivot_split_bucket_label','pivot_auto_bin_width','pivot_normalize_bin_edges',
  'pivot_bins_labels','pivot_get_agg_label','pivot_parse_value','pivot_resolve_agg_bucket',
  'pivot_split_registry','pivot_split_sort_val','pivot_expand_colkeys_with_gaps',
  'pivot_resolve_auto_bin_width','pivot_field_display_label','cf_agg_fn_names',
);
$missing = array();
foreach ($need as $f) { if (!function_exists($f)) { $missing[] = $f; } }

echo "stray output on include : " . ($stray === '' ? 'NONE (clean)' : strlen($stray) . ' bytes -> ' . substr($stray,0,120)) . "\n";
echo "functions defined       : " . count(get_defined_functions()['user']) . "\n";
echo "missing from pivot API  : " . (empty($missing) ? 'none' : implode(', ', $missing)) . "\n";
echo "sanity stddev([2,4,4,4,5,5,7,9]) = " . pivot_sample_stddev(array(2,4,4,4,5,5,7,9)) . "\n";
echo "sanity percentile p50 [1,2,3,4]  = " . pivot_percentile_of(array(1,2,3,4), 50) . "\n";
