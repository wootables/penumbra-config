<?php
// gen_about.php - fixture feed for the browser half of the subtip suite: runs the REAL
// penumbra_sub_task_about() (cron_describe.php under --app) over a few task shapes and
// prints them as JSON, so tests.js renders exactly what the server would send.
//   php.exe -n -d date.timezone=America/New_York gen_about.php --app=<dir>
$APP = null;
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = rtrim(substr($a, 6), "\\/"); }
require $APP . '/cron_describe.php';
$now = mktime(9, 0, 0, 10, 7, 2026);
$out = array(
    // The live hitratio task (#1345): CSV, live link, one relative-date prompt, monthly.
    'hit' => penumbra_sub_task_about(array('attach_csv' => true, 'include_link' => true, 'include_snippet' => false, 'skip_empty' => true,
        'prompt_answers' => array('submitted' => 'first day of 5 fiscal years ago..last day of last fiscal year'),
        'subscriptions_enabled' => true, 'subscriptions_notify' => true), '2026-11-01 08:40:00', $now),
    // A change analysis that leaves out unchanged rows, personalized by OUC, with a skip condition.
    'chg' => penumbra_sub_task_about(array('changes_only' => true, 'attach_xlsx' => true, 'attach_pdf' => true, 'include_snippet' => true,
        'search_filter' => "LEAD_UNIT = /^{OUC}/ AND __SNAP_TYPE != 'Unchanged Rows'", 'skip_no_change' => true,
        'skip_custom_condition' => true, 'custom_condition_expr' => 'sum(AMOUNT) < 1000',
        'subscriptions_enabled' => true, 'subscriptions_notify' => false), '2026-10-08 07:00:00', $now),
    // Hostile values: markup in every free-text fact.
    'xss' => penumbra_sub_task_about(array('search_filter' => 'A = "<img src=x onerror=window.__xss=1>"',
        'prompt_answers' => array('<b>n</b>' => '<script>window.__xss=2</script>'),
        'skip_custom_condition' => true, 'custom_condition_expr' => 'count() > 0 <svg onload=window.__xss=3>'), '', $now),
);
echo json_encode($out);
