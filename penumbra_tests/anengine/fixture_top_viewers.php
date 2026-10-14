<?php
// FROZEN 2026-10-02 (the metrics engine follow-up 2): penumbra_an_report_top_viewers() as it
// was in analytics_shared.php when it was REMOVED - the old report page (analytics.php before the
// switch, 20261002-eng14) was its only caller. anengine keeps it as the reference: increment 6
// proves it equals the old page block it was moved from, section 8 proves the engine's
// penumbra_an_user_sparks() gives its sparks id for id. Never edit; lifted by the tokenizer.
function penumbra_an_report_top_viewers($run, $rid, $w, $exclSql, $exclBinds, $sp, $fetch, $logLabel)
{
    $timeFilter      = $w['timeFilter'];
    $whenFilter      = $w['whenFilter'];
    $sparkLen        = $sp['sparkLen'];
    $sparkBucketExpr = $sp['sparkBucketExpr'];
    $sparkTimeCut    = $sp['sparkTimeCut'];
    $sparkKeys       = $sp['sparkKeys'];
    $report_id_num   = $rid;
    $ridBinds        = array(':rid' => $rid);
    $VIEWER_FETCH    = (int)$fetch;
    $top_viewers     = [];
    try {
        $rows = $run(
            "SELECT USER_ID, COUNT(*) AS VIEWS,
                    TO_CHAR(MAX(TIMESTAMP), 'YYYY-MM-DD HH24:MI') AS LAST_SEEN
               FROM PENUMBRA_AUDIT
              WHERE REPORT_ID = :rid AND ACTION='OPEN' AND USER_ID IS NOT NULL $timeFilter $whenFilter $exclSql
              GROUP BY USER_ID
              ORDER BY VIEWS DESC FETCH FIRST $VIEWER_FETCH ROWS ONLY",
            array_merge($ridBinds, $exclBinds)
        );
        $top_user_ids = [];
        foreach ($rows as $r) {
            $top_user_ids[] = $r['USER_ID'];
            $top_viewers[] = [
                'user'  => $r['USER_ID'],
                'views' => (int)$r['VIEWS'],
                'last'  => $r['LAST_SEEN'],
                'spark' => array_fill(0, $sparkLen, 0),
            ];
        }

        // Single follow-up query for sparklines of just the top users. No
        // exclusion fragment needed - the user list above is already filtered.
        if (!empty($top_user_ids)) {
            $userPh = [];
            $userBinds = array(':rid' => $report_id_num);
            foreach ($top_user_ids as $i => $u) {
                $key = ":u$i";
                $userPh[]  = $key;
                $userBinds[$key] = $u;
            }
            $rows = $run(
                "SELECT USER_ID, $sparkBucketExpr AS BUCKET, COUNT(*) AS CNT
                   FROM PENUMBRA_AUDIT
                  WHERE REPORT_ID = :rid AND ACTION='OPEN'
                    AND USER_ID IN (" . implode(',', $userPh) . ")
                    AND $sparkTimeCut
                  GROUP BY USER_ID, $sparkBucketExpr",
                $userBinds
            );
            $byUser = [];
            foreach ($rows as $r) $byUser[$r['USER_ID']][$r['BUCKET']] = (int)$r['CNT'];
            foreach ($top_viewers as &$tv) {
                foreach ($sparkKeys as $idx => $kk) {
                    $tv['spark'][$idx] = isset($byUser[$tv['user']][$kk]) ? $byUser[$tv['user']][$kk] : 0;
                }
            }
            unset($tv);
        }
    } catch (Exception $e) {
        error_log("$logLabel top viewers query failed: " . $e->getMessage());
    }
    return $top_viewers;
}
