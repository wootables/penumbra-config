<?php
// AUTO-EXTRACTED from manage_schedule.php - do not edit.
if (!function_exists('ensureHeartbeatRow')) {
function ensureHeartbeatRow($conn, $heartbeatReportId) {
    $sql = "SELECT ID, TO_CHAR(LAST_RUN, 'YYYY-MM-DD HH24:MI:SS') AS LAST_RUN, OPTIONS
            FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS
            WHERE REPORT_ID = :rid AND TASK_TYPE = 'HEARTBEAT'";
    $check = $conn->prepare($sql);
    $check->bindValue(':rid', $heartbeatReportId);
    $check->execute();
    $row = $check->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        if (is_resource($row['OPTIONS'])) $row['OPTIONS'] = stream_get_contents($row['OPTIONS']);
        return $row;
    }
    // Create sentinel row
    $ins = $conn->prepare("INSERT INTO NC_REPORTING.PENUMBRA_SCHEDULED_TASKS
        (REPORT_ID, TASK_TYPE, RECIPIENTS, SUBJECT, CRON_EXPRESSION, OPTIONS, OWNER_ID, IS_ACTIVE, CREATED_AT)
        VALUES (:rid, 'HEARTBEAT', 'SYSTEM', 'Scheduler Heartbeat', '* * * * *', NULL, 'SYSTEM', 0, SYSDATE)");
    $ins->bindValue(':rid', $heartbeatReportId);
    $ins->execute();
    // Re-fetch with formatted date
    $check2 = $conn->prepare($sql);
    $check2->bindValue(':rid', $heartbeatReportId);
    $check2->execute();
    $row2 = $check2->fetch(PDO::FETCH_ASSOC);
    if ($row2 && is_resource($row2['OPTIONS'])) $row2['OPTIONS'] = stream_get_contents($row2['OPTIONS']);
    return $row2;
}
}

if (!function_exists('penumbra_schedule_target_short_id')) {
function penumbra_schedule_target_short_id($conn) {
    // SECURITY: when a task_id is present, ALWAYS authorize against the TASK's OWN report
    // (resolved from the task row) - NOT a separately-supplied report_id. The save(update),
    // toggle_status, run_now and delete actions all operate on task_id, so authorizing on a
    // caller-supplied report_id would let a scheduler-grant holder pair their granted
    // report_id with someone else's task_id and hijack it (IDOR). report_id is only the
    // authority for task-LESS actions (create, list). A non-numeric/absent task_id falls
    // through to report_id, but the task actions bind :id numerically so they match no row.
    $tid = isset($_POST['task_id']) ? $_POST['task_id'] : (isset($_GET['task_id']) ? $_GET['task_id'] : '');
    if ($tid !== '' && $tid !== null && is_numeric($tid)) {
        try {
            // JOIN ON THE SHORT ID, NOT THE NUMBER. PENUMBRA_SCHEDULED_TASKS.REPORT_ID
            // is the report's SHORT_ID *string* (see resolve_report_id below), so the
            // old `ON r.ID = t.REPORT_ID` made Oracle coerce that VARCHAR to a number
            // and raise ORA-01722 the moment it met a non-numeric id - which is nearly
            // every row. The catch below then returned '', the gate failed closed, and
            // NON-ADMIN SCHEDULER-GRANT HOLDERS WERE SILENTLY DENIED EVERY TASK-SCOPED
            // ACTION (save/toggle_status/run_now/delete). Fixed 2026-08-10.
            //
            // The numeric branch is CASE-guarded exactly as analytics_all.php does it,
            // so a legacy row that really does hold a numeric id still resolves and a
            // non-numeric one can never reach TO_NUMBER.
            //
            // Still resolves the TASK'S OWN report (WHERE t.ID = :tid), which is the
            // IDOR protection described above - this fix does not widen that.
            // DETERMINISTIC, AND ORDERED THE SAME WAY resolve_report_id() IS.
            //
            // The OR can match two DIFFERENT reports for one task - a report whose
            // SHORT_ID is literally "261" and the report whose numeric ID is 261 - and
            // a bare fetchColumn() would take whichever row the optimizer returned
            // first. Harmless in a display query (analytics_all.php uses the plain OR),
            // NOT harmless in an authorization gate.
            //
            // The tie-break MUST mirror resolve_report_id() below, which every ACTION
            // path uses: for a numeric REPORT_ID it returns the NUMERIC report id, and
            // only otherwise looks the value up as a SHORT_ID. Preferring the short-id
            // match for a numeric value would authorize against one report while the
            // action operated on another. Hence: numeric value -> numeric match wins;
            // anything else -> short-id match wins.
            //
            // rename_report_short_id.php additionally REFUSES all-numeric short ids, so
            // this collision cannot be created going forward; the ordering is the
            // belt-and-braces for legacy rows. (Verified 2026-08-10: zero numeric task
            // REPORT_IDs, zero numeric SHORT_IDs, zero tasks resolving to >1 report.)
            $s = $conn->prepare(
                "SELECT SHORT_ID FROM (
                     SELECT TRIM(r.SHORT_ID) AS SHORT_ID,
                            CASE WHEN REGEXP_LIKE(TRIM(t.REPORT_ID), '^[0-9]+$')
                                 THEN CASE WHEN r.ID = TO_NUMBER(TRIM(t.REPORT_ID)) THEN 0 ELSE 1 END
                                 ELSE CASE WHEN TRIM(r.SHORT_ID) = TRIM(t.REPORT_ID) THEN 0 ELSE 1 END
                            END AS PREF
                       FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS t
                       JOIN PENUMBRA_REPORTS r
                         ON TRIM(r.SHORT_ID) = TRIM(t.REPORT_ID)
                         OR r.ID = CASE WHEN REGEXP_LIKE(TRIM(t.REPORT_ID), '^[0-9]+$')
                                        THEN TO_NUMBER(TRIM(t.REPORT_ID)) END
                      WHERE t.ID = :tid
                      ORDER BY PREF
                 ) WHERE ROWNUM = 1"
            );
            $s->bindValue(':tid', (int)$tid, PDO::PARAM_INT);
            $s->execute();
            $r = $s->fetchColumn();
            return ($r !== false && $r !== null) ? trim($r) : '';
        } catch (Exception $e) { return ''; }
    }
    $rid = isset($_POST['report_id']) ? $_POST['report_id'] : (isset($_GET['report_id']) ? $_GET['report_id'] : '');
    if ($rid !== '' && $rid !== null) {
        if (!is_numeric($rid)) return trim((string)$rid);              // already a SHORT_ID
        try {
            $s = $conn->prepare("SELECT SHORT_ID FROM PENUMBRA_REPORTS WHERE ID = :id");
            $s->bindValue(':id', (int)$rid, PDO::PARAM_INT);
            $s->execute();
            $r = $s->fetchColumn();
            return ($r !== false && $r !== null) ? trim($r) : '';
        } catch (Exception $e) { return ''; }
    }
    return '';
}
}

if (!function_exists('resolve_report_id')) {
function resolve_report_id($conn, $short_id) {
    if (is_numeric($short_id) && $short_id !== '') {
        return (int)$short_id;
    }
    
    // If it's a string, look it up
    if (!empty($short_id)) {
        try {
            $stmt = $conn->prepare("SELECT ID FROM NC_REPORTING.PENUMBRA_REPORTS WHERE TRIM(SHORT_ID) = :sid");
            $stmt->bindValue(':sid', trim($short_id));
            $stmt->execute();
            $res = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($res) {
                return (int)$res['ID'];
            }
        } catch (Exception $e) {
            error_log("Failed to resolve report ID: " . $e->getMessage());
        }
    }
    return null;
}
}

if (!function_exists('log_scheduler_event')) {
function log_scheduler_event($conn, $action, $message, $user, $report_id = null) {
    try {
        $sql = "INSERT INTO NC_REPORTING.PENUMBRA_AUDIT (ACTION, REPORT_ID, USER_ID, SOURCE_DATA, BEFORE, AFTER) VALUES (:act, :rid, :usr, :src, NULL, NULL)";
        $stmt = $conn->prepare($sql);
        $source_json = json_encode(['message' => $message]);
        
        $stmt->bindValue(':act', $action);
        $stmt->bindValue(':rid', $report_id);
        $stmt->bindValue(':usr', $user);
        $stmt->bindValue(':src', $source_json);
        $stmt->execute();
    } catch (Exception $e) {
        error_log("Scheduler Audit Fail: " . $e->getMessage());
    }
}
}

if (!function_exists('encrypt_scheduler_password')) {
function encrypt_scheduler_password($plaintext) {
    if (empty($plaintext)) return null;
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', SCHEDULER_SECRET_KEY, 0, $iv);
    return base64_encode($encrypted . '::' . $iv);
}
}

if (!function_exists('get_next_run_date_calc')) {
function get_next_run_date_calc($cron_expr) {
    $parts = preg_split('/\s+/', trim($cron_expr));
    if (count($parts) !== 5) return false;
    $now = time();
    for ($i = 1; $i < 525600; $i++) { 
        $check_ts = $now + ($i * 60);
        $check_ts = $check_ts - ($check_ts % 60); 
        $min = (int)date('i', $check_ts); $hour = (int)date('G', $check_ts);
        $day = (int)date('j', $check_ts); $mon = (int)date('n', $check_ts);
        $dow = (int)date('w', $check_ts);
        if (check_cron_part_calc($parts[0], $min) && check_cron_part_calc($parts[1], $hour) && 
            check_cron_part_calc($parts[2], $day) && check_cron_part_calc($parts[3], $mon) && 
            // Day-of-week 7 is Sunday in standard cron (and in cron_describe.php /
            // the client validator, which accept 0-7); date('w') only ever yields
            // 0-6, so a "7" expression previously matched nothing and fell through
            // to the +1 hour fallback below - an hourly task by accident.
            (check_cron_part_calc($parts[4], $dow) || ($dow === 0 && check_cron_part_calc($parts[4], 7)))) {
            return date('Y-m-d H:i:s', $check_ts);
        }
    }
    return date('Y-m-d H:i:s', strtotime('+1 hour')); 
}
}

if (!function_exists('check_cron_part_calc')) {
function check_cron_part_calc($pattern, $value) {
    if ($pattern === '*') return true;
    if (strpos($pattern, '/') !== false) {
        list($base, $step) = explode('/', $pattern);
        $step = (int)$step;
        if ($base === '*') {
            return ($value % $step) === 0;
        }
        $base = (int)$base;
        return ($value >= $base) && (($value - $base) % $step) === 0;
    }
    if (strpos($pattern, ',') !== false) {
        $parts = array_map(function($p) { return (int)trim($p); }, explode(',', $pattern));
        return in_array($value, $parts, true);
    }
    if (strpos($pattern, '-') !== false) {
        list($min, $max) = explode('-', $pattern);
        return ($value >= (int)$min && $value <= (int)$max);
    }
    return (int)$pattern === $value;
}
}

if (!function_exists('touch_report_updated_at')) {
function touch_report_updated_at($conn, $numeric_report_id) {
    if (!$numeric_report_id) return;
    try {
        $stmt = $conn->prepare("UPDATE NC_REPORTING.PENUMBRA_REPORTS SET UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :id");
        $stmt->bindValue(':id', $numeric_report_id);
        $stmt->execute();
    } catch (Exception $e) {
        error_log("touch_report_updated_at failed: " . $e->getMessage());
    }
}
}

if (!function_exists('penumbra_sched_prune_email_only')) {
function penumbra_sched_prune_email_only($task_type, $options) {
    if ($task_type === 'EMAIL' || !is_array($options)) return $options;
    $email_only = array('attach_csv', 'attach_xlsx', 'attach_pdf', 'no_body', 'include_link',
                        'no_links', 'include_snippet', 'body_preamble', 'recipient_vars',
                        'subscriptions_enabled', 'subscriptions_notify', 'subscriptions_condition', 'changes_only',
                        'link_text', 'link_text_compare', 'link_text_full', 'link_text_chart');
    if ($task_type !== 'DROP_FILE') $email_only[] = 'theme_override';
    foreach ($email_only as $k) unset($options[$k]);
    return $options;
}
}

if (!function_exists('get_db_dump_default_schema')) {
function get_db_dump_default_schema() {
    global $dbrw_user;
    return !empty($dbrw_user) ? strtoupper(trim($dbrw_user)) : null;
}
}

if (!function_exists('validate_db_dump_identifier')) {
function validate_db_dump_identifier($name) {
    if (!is_string($name) || $name === '') return false;
    return (bool)preg_match('/^[A-Z][A-Z0-9_]{0,29}$/', $name);
}
}

if (!function_exists('find_db_dump_collision')) {
function find_db_dump_collision($conn, $schema, $table, $exclude_task_id = null, $ignore_transient_report_id = null) {
    $sql = "SELECT ID, REPORT_ID, OWNER_ID, OPTIONS,
                   TO_CHAR(LAST_RUN, 'YYYY-MM-DD HH24:MI:SS') AS LAST_RUN,
                   TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
            FROM   NC_REPORTING.PENUMBRA_SCHEDULED_TASKS
            WHERE  TASK_TYPE = 'DB_DUMP'
              AND  IS_ACTIVE = 1";
    if ($exclude_task_id) {
        $sql .= " AND ID != :exclude_id";
    }
    $stmt = $conn->prepare($sql);
    if ($exclude_task_id) $stmt->bindValue(':exclude_id', $exclude_task_id);
    $stmt->execute();
    $needle_table = strtoupper($table);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $raw  = is_resource($row['OPTIONS']) ? stream_get_contents($row['OPTIONS']) : $row['OPTIONS'];
        $opts = json_decode($raw, true);
        if (!is_array($opts)) continue;
        // A transient one-time Test Run of the SAME report is not a real
        // conflict: it's the same query/config (usually the very draft the
        // user just tested), runs once within ~5 minutes, and deletes itself.
        // Without this, the natural "Test Run the draft, then Add the task"
        // flow gets refused citing a task # that appears in no list. Cross-
        // REPORT transients still block (different query on the same table).
        if ($ignore_transient_report_id !== null
            && !empty($opts['_test_run_transient'])
            && trim((string)$row['REPORT_ID']) === trim((string)$ignore_transient_report_id)) {
            continue;
        }
        $t = isset($opts['destination_table']) ? strtoupper(trim($opts['destination_table'])) : '';
        // Not a bare === : "FOO" and "FOO_X" conflict too, because a dump DROPs
        // "<dest>_X" before every run and would eat the other task's destination.
        // Shared with the runner's execution-time re-check - see db_connection.php.
        if ($t !== '' && penumbra_dbdump_destinations_conflict($t, $needle_table)) {
            return $row;
        }
    }
    return null;
}
}

if (!function_exists('build_db_dump_destination_map')) {
function build_db_dump_destination_map($conn) {
    $map = [];
    try {
        $stmt = $conn->query("
            SELECT ID, REPORT_ID, OWNER_ID, OPTIONS,
                   TO_CHAR(LAST_RUN, 'YYYY-MM-DD HH24:MI:SS')   AS LAST_RUN,
                   TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
            FROM   NC_REPORTING.PENUMBRA_SCHEDULED_TASKS
            WHERE  TASK_TYPE = 'DB_DUMP' AND IS_ACTIVE = 1");
        if (!$stmt) return $map;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $raw  = is_resource($r['OPTIONS']) ? stream_get_contents($r['OPTIONS']) : $r['OPTIONS'];
            $opts = json_decode($raw, true);
            if (!is_array($opts)) continue;
            // Transient one-time Test Run rows are invisible in every task
            // list, so annotating OTHER tasks' collision_info with them would
            // cite a task # the user can't see. They live for <= ~5 minutes;
            // leave them out of the advisory map (save-time enforcement still
            // sees cross-report transients).
            if (!empty($opts['_test_run_transient'])) continue;
            $t = isset($opts['destination_table']) ? strtoupper(trim($opts['destination_table'])) : '';
            if ($t === '') continue;
            if (!isset($map[$t])) $map[$t] = [];
            $map[$t][] = [
                'task_id'    => (int)$r['ID'],
                'report_id'  => $r['REPORT_ID'],
                'owner_id'   => $r['OWNER_ID'],
                'last_run'   => $r['LAST_RUN'],
                'created_at' => $r['CREATED_AT'],
            ];
        }
    } catch (Exception $e) {
        error_log("build_db_dump_destination_map failed: " . $e->getMessage());
    }
    return $map;
}
}
