<?php
// AUTO-EXTRACTED from journal_export.php - do not edit.
if (!function_exists('journalCleanKeyValueExport')) {
function journalCleanKeyValueExport($v) {
        if ($v === null) return '';
        $s = (string)$v;
        $s = preg_replace('/@@(HTML|JSON)/i', '', $s);
        $s = preg_replace('/<[^>]*>/', '', $s);
        $s = str_replace(array('&amp;', '&lt;', '&gt;', '&quot;'), array('&', '<', '>', '"'), $s);
        $s = preg_replace('/&#0?39;/', "'", $s);
        // Collapse the SAME character class JavaScript's \s matches. PCRE's \s
        // (without /u) is ASCII-only, so a non-breaking space and friends survived
        // here while the browser collapsed them to a plain space - producing two
        // different ROW_KEYs for one row. The browser then showed the box checked
        // while every server-side consumer (export, API, scheduled email, task
        // search filter) re-derived a key that matched nothing and reported 0.
        // Byte-level divergence, invisible on screen: NBSP renders as a space.
        // JS \s = [\f\n\r\t\v    -     　﻿]
        $ws = '/[\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]+/u';
        $collapsed = preg_replace($ws, ' ', $s);
        // preg_replace returns null on malformed UTF-8; fall back to the ASCII-only
        // form rather than nulling the whole key.
        if ($collapsed !== null) $s = $collapsed;
        else $s = preg_replace('/\s+/', ' ', $s);
        // Everything above is now a plain space, so trim() reaches the edges too
        // (PHP trim's default charlist would not have stripped an NBSP).
        return trim((string)$s);
    }
}

if (!function_exists('journalUpperKey')) {
function journalUpperKey($s) {
        $s = (string)$s;
        return function_exists('mb_strtoupper') ? mb_strtoupper($s, 'UTF-8') : strtoupper($s);
    }
}

if (!function_exists('journalToggleWantExport')) {
function journalToggleWantExport($v) {
        $s = strtolower(trim((string)($v === null ? '' : $v)));
        $s = preg_replace('/^[\'"]|[\'"]$/', '', $s);
        if ($s === '') return null;
        if (preg_match('/^(☑|✓|✔|checked?|yes|y|true|t|on|1|done|complete|x)$/u', $s)) return true;
        if (preg_match('/^(☐|✗|✘|unchecked|no|n|false|f|off|0|empty|none|todo)$/u', $s)) return false;
        return null;
    }
}

if (!function_exists('journalKeySig')) {
function journalKeySig($cols) {
        $parts = array();
        foreach ((array)$cols as $c) {
            if (!is_scalar($c)) continue;
            $u = journalUpperKey(trim((string)$c));
            if ($u !== '') $parts[] = $u;
        }
        return implode("\xE2\x90\x9F", $parts);
    }
}

if (!function_exists('journalParkTag')) {
function journalParkTag($sig) {
        return JOURNAL_PARK_OPEN . $sig . JOURNAL_PARK_CLOSE;
    }
}

if (!function_exists('journalSplitParked')) {
function journalSplitParked($rk) {
        $rk = (string)$rk;
        if (strpos($rk, JOURNAL_PARK_OPEN) !== 0) return array($rk, null);
        $end = strpos($rk, JOURNAL_PARK_CLOSE, strlen(JOURNAL_PARK_OPEN));
        if ($end === false) return array($rk, null);
        return array((string)substr($rk, $end + strlen(JOURNAL_PARK_CLOSE)),
                     (string)substr($rk, strlen(JOURNAL_PARK_OPEN), $end - strlen(JOURNAL_PARK_OPEN)));
    }
}

if (!function_exists('journalCharLen')) {
function journalCharLen($s) {
        return function_exists('mb_strlen') ? mb_strlen((string)$s, 'UTF-8') : (int)preg_match_all('/./us', (string)$s);
    }
}

if (!function_exists('journalRowKeyWidths')) {
function journalRowKeyWidths() {
        $out = array();
        $r = queryViaOci8("SELECT TABLE_NAME, CHAR_USED, CHAR_LENGTH, DATA_LENGTH FROM ALL_TAB_COLUMNS"
            . " WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AND COLUMN_NAME = 'ROW_KEY'"
            . " AND TABLE_NAME IN ('PENUMBRA_JOURNAL', 'PENUMBRA_JOURNAL_TOGGLE')");
        foreach ((array)$r as $c) {
            if (!isset($c['TABLE_NAME'])) continue;
            $n = (isset($c['CHAR_USED']) && strtoupper(trim((string)$c['CHAR_USED'])) === 'C')
                ? (int)$c['CHAR_LENGTH'] : (int)$c['DATA_LENGTH'];
            if ($n > 0) $out[strtoupper(trim((string)$c['TABLE_NAME']))] = $n;
        }
        return $out;
    }
}

if (!function_exists('journalRowKeyCapacity')) {
function journalRowKeyCapacity($fresh = false) {
        static $cap = null;
        if ($cap !== null && !$fresh) return $cap;
        $cap = 1000;
        try {
            $w = journalRowKeyWidths();
            if (isset($w['PENUMBRA_JOURNAL'], $w['PENUMBRA_JOURNAL_TOGGLE'])) $cap = min($w['PENUMBRA_JOURNAL'], $w['PENUMBRA_JOURNAL_TOGGLE']);
        } catch (Exception $e) {
            $cap = 1000;
        }
        return $cap;
    }
}

if (!function_exists('journalOciRun')) {
function journalOciRun($oci, $sql, $binds) {
        $st = oci_parse($oci, $sql);
        if (!$st) { $e = oci_error($oci); throw new Exception('OCI8 parse failed: ' . $e['message']); }
        $refs = array();
        foreach ($binds as $k => $v) { $refs[$k] = $v; oci_bind_by_name($st, $k, $refs[$k]); }
        if (!oci_execute($st, OCI_NO_AUTO_COMMIT)) {
            $e = oci_error($st);
            oci_free_statement($st);
            throw new Exception('OCI8 execute failed: ' . $e['message']);
        }
        $n = (int)oci_num_rows($st);
        oci_free_statement($st);
        return $n;
    }
}

if (!function_exists('journalFiledKey')) {
function journalFiledKey($reportId) {
        $r = queryViaOci8("SELECT ROW_KEY FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND TOGGLE_KEY = :kf AND STATE = "
            . JOURNAL_KEYFILE_STATE . " ORDER BY UPDATED_AT DESC", array(':rid' => (int)$reportId, ':kf' => JOURNAL_KEYFILE_TK));
        return (!empty($r) && isset($r[0]['ROW_KEY'])) ? (string)$r[0]['ROW_KEY'] : null;
    }
}

if (!function_exists('journalSavedKeyCols')) {
function journalSavedKeyCols($reportId) {
        if (!function_exists('readClobViaOci8')) return null;
        try {
            $raw = (string)readClobViaOci8('PENUMBRA_REPORTS', 'STATE_DATA', 'ID', (int)$reportId);
        } catch (Exception $e) {
            return null;
        }
        // The encrypted envelope's first key, read from the head (as manage_journal.php reads it).
        $head = substr(ltrim($raw), 0, 64);
        if (strpos($head, '"encrypted":true') !== false || strpos($head, '"encrypted": true') !== false) return array('enc' => true, 'cols' => array());
        $st = json_decode($raw, true);
        $cols = array();
        if (is_array($st) && isset($st['viewOptions']) && is_array($st['viewOptions'])
                && isset($st['viewOptions']['journalKeyColumns']) && is_array($st['viewOptions']['journalKeyColumns'])) {
            foreach ($st['viewOptions']['journalKeyColumns'] as $c) { if (is_scalar($c) && trim((string)$c) !== '') $cols[] = (string)$c; }
        }
        return array('enc' => false, 'cols' => $cols);
    }
}

if (!function_exists('journalFilingLock')) {
function journalFilingLock($reportId, $savedCols) {
        $sig = journalKeySig($savedCols);
        if ($sig === '' || strlen($sig) > JOURNAL_KEYFILE_MAX_SIG) return true;
        $r = queryViaOci8("SELECT ROW_KEY, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') AS AT FROM PENUMBRA_JOURNAL_TOGGLE"
            . " WHERE REPORT_ID = :hrid AND TOGGLE_KEY = :hkf AND STATE = " . JOURNAL_KEYFILE_STATE . " FOR UPDATE WAIT 30",
            array(':hrid' => (int)$reportId, ':hkf' => JOURNAL_KEYFILE_TK));
        if (empty($r)) return true;
        usort($r, function ($a, $b) { return strcmp((string)$b['AT'], (string)$a['AT']); });   // the newest is the record (journalFiledKey)
        return (string)$r[0]['ROW_KEY'] === $sig;
    }
}

if (!function_exists('journalKeyfileInsert')) {
function journalKeyfileInsert($reportId, $sig) {
        $oci = getOci8Connection();
        try {
            // The report's row is locked first (2026-10-09): two first requests at one moment each found
            // no record and each wrote one, and the plain ones were filed by whichever was read. The
            // second waits now, then finds the first's.
            journalOciRun($oci, "SELECT ID FROM PENUMBRA_REPORTS WHERE ID = :lrid FOR UPDATE WAIT 10", array(':lrid' => (int)$reportId));
            journalOciRun($oci, "INSERT INTO PENUMBRA_JOURNAL_TOGGLE (REPORT_ID, ROW_KEY, TOGGLE_KEY, STATE, UPDATED_BY, UPDATED_AT)"
                . " SELECT :rid, :sig, :kf, " . JOURNAL_KEYFILE_STATE . ", 'penumbra', SYSTIMESTAMP FROM DUAL"
                . " WHERE NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid2 AND TOGGLE_KEY = :kf2 AND STATE = "
                . JOURNAL_KEYFILE_STATE . ")",
                array(':rid' => (int)$reportId, ':sig' => $sig, ':kf' => JOURNAL_KEYFILE_TK, ':rid2' => (int)$reportId, ':kf2' => JOURNAL_KEYFILE_TK));
            oci_commit($oci);
        } catch (Exception $e) {
            @oci_rollback($oci);
            if (strpos($e->getMessage(), 'ORA-00001') === false) throw $e;   // the same row, recorded by a request just now
        }
    }
}

if (!function_exists('journalRefile')) {
function journalRefile($reportId, $fromSig, $toSig) {
        $oci = getOci8Connection();
        $rid = (int)$reportId;
        // The column's own width (2026-10-09: 1500 bytes since Round V, 1000 before), read before the
        // transaction opens: a key too long to take the tag stays plain.
        $cap = journalRowKeyCapacity();
        try {
            // A second record (two first requests at one moment, before the record's write locked the
            // report) is dropped first (2026-10-09): moving this one onto its key failed on it every
            // time, and so did every read and write of the report.
            journalOciRun($oci, "DELETE FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :drid AND TOGGLE_KEY = :dkf AND STATE = "
                . JOURNAL_KEYFILE_STATE . " AND ROW_KEY <> :dold", array(':drid' => $rid, ':dkf' => JOURNAL_KEYFILE_TK, ':dold' => $fromSig));
            $n = journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL_TOGGLE SET ROW_KEY = :knew, UPDATED_AT = SYSTIMESTAMP"
                . " WHERE REPORT_ID = :krid AND TOGGLE_KEY = :kkf AND STATE = " . JOURNAL_KEYFILE_STATE . " AND ROW_KEY = :kold",
                array(':knew' => $toSig, ':krid' => $rid, ':kkf' => JOURNAL_KEYFILE_TK, ':kold' => $fromSig));
            if ($n < 1) { oci_rollback($oci); return false; }
            $ft = journalParkTag($fromSig);
            $tt = journalParkTag($toSig);
            $fmax = $cap - strlen($ft);
            $tl = journalCharLen($tt);
            // File: every plain mark (any state, every column - not the marker) and row note. A mark
            // whose filed copy is there already stays plain (the key would clash, and the whole
            // re-file fail on every read after).
            journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL_TOGGLE T SET ROW_KEY = :ptag || T.ROW_KEY"
                . " WHERE T.REPORT_ID = :prid AND T.TOGGLE_KEY <> :pkf AND SUBSTR(T.ROW_KEY, 1, 1) <> " . JOURNAL_PARK_OPEN_SQL
                . " AND LENGTHB(T.ROW_KEY) <= :pmax"
                . " AND NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL_TOGGLE T2 WHERE T2.REPORT_ID = :prid2"
                . " AND T2.TOGGLE_KEY = T.TOGGLE_KEY AND T2.ROW_KEY = :ptag2 || T.ROW_KEY)",
                array(':ptag' => $ft, ':prid' => $rid, ':pkf' => JOURNAL_KEYFILE_TK, ':pmax' => $fmax, ':prid2' => $rid, ':ptag2' => $ft));
            journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL SET ROW_KEY = :ntag || ROW_KEY"
                . " WHERE REPORT_ID = :nrid AND SCOPE = 'row' AND ROW_KEY IS NOT NULL AND SUBSTR(ROW_KEY, 1, 1) <> " . JOURNAL_PARK_OPEN_SQL
                . " AND LENGTHB(ROW_KEY) <= :nmax",
                array(':ntag' => $ft, ':nrid' => $rid, ':nmax' => $fmax));
            // Give back: what was filed under the saved key is plain again (a mark the key already
            // holds in that column keeps its place, and the filed one stays filed).
            journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL_TOGGLE T SET ROW_KEY = SUBSTR(T.ROW_KEY, :ufrom)"
                . " WHERE T.REPORT_ID = :urid AND SUBSTR(T.ROW_KEY, 1, :ulen) = :utag"
                . " AND NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL_TOGGLE T2 WHERE T2.REPORT_ID = :urid2"
                . " AND T2.TOGGLE_KEY = T.TOGGLE_KEY AND T2.ROW_KEY = SUBSTR(T.ROW_KEY, :ufrom2))",
                array(':ufrom' => $tl + 1, ':urid' => $rid, ':ulen' => $tl, ':utag' => $tt, ':urid2' => $rid, ':ufrom2' => $tl + 1));
            journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL SET ROW_KEY = SUBSTR(ROW_KEY, :vfrom)"
                . " WHERE REPORT_ID = :vrid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :vlen) = :vtag",
                array(':vfrom' => $tl + 1, ':vrid' => $rid, ':vlen' => $tl, ':vtag' => $tt));
            oci_commit($oci);
            return true;
        } catch (Exception $e) {
            @oci_rollback($oci);
            throw $e;
        }
    }
}

if (!function_exists('journalEnsureFiled')) {
function journalEnsureFiled($reportId, $savedCols, $assumeFrom = null, $fromDb = false) {
        $sig = journalKeySig($savedCols);
        if ($sig === '' || !function_exists('getOci8Connection')) return 'ok';
        if (strlen($sig) > JOURNAL_KEYFILE_MAX_SIG) return 'ok';
        try {
            if (!$fromDb) {
                $saved = journalSavedKeyCols($reportId);
                if ($saved === null) throw new Exception('the saved state could not be read');
                if ($saved['enc']) return 'ok';
                if (journalKeySig($saved['cols']) !== $sig) return 'stale';
            }
            $filed = journalFiledKey($reportId);
            if ($filed === null) {
                $from = (is_string($assumeFrom) && $assumeFrom !== '') ? $assumeFrom : $sig;
                journalKeyfileInsert($reportId, $from);
                $filed = journalFiledKey($reportId);
                if ($filed === null || $filed === $sig) return 'created';
            }
            // Another request can move the record between the read and the re-file (2026-10-09): then
            // it is read again, and filed again if it names another key still. This said 'refiled'
            // whatever happened - the marks of whichever key that request filed by read as this one's.
            for ($try = 0; $try < 3; $try++) {
                if ($filed === $sig) return $try ? 'refiled' : 'ok';
                if (journalRefile($reportId, $filed, $sig)) return 'refiled';
                $filed = journalFiledKey($reportId);
                if ($filed === null) throw new Exception('the key record went missing during a re-file');
            }
            throw new Exception('the key record kept moving');
        } catch (Exception $e) {
            $m = 'journal key filing failed - no toggle state is read under this key until it works: ' . $e->getMessage();
            if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m); else error_log('[penumbra] ' . $m);
            return 'error';
        }
    }
}

if (!function_exists('journalExportToggleResolver')) {
function journalExportToggleResolver($shortId, $state, $existingCols = array()) {
        if (!is_array($state)) return null;
        // A memo for one task's per-recipient re-runs (2026-10-09, C8): each recipient's re-run read every mark again.
        // Off unless the scheduler sets $GLOBALS['penumbra_jt_resolver_memo'] (an array) around that call.
        $memoOn = isset($GLOBALS['penumbra_jt_resolver_memo']) && is_array($GLOBALS['penumbra_jt_resolver_memo']);
        $memoKey = $memoOn ? (string)$shortId . '|' . md5(serialize(array(isset($state['viewOptions']) ? $state['viewOptions'] : null, array_values((array)$existingCols)))) : '';
        if ($memoOn && isset($GLOBALS['penumbra_jt_resolver_memo'][$memoKey])) return $GLOBALS['penumbra_jt_resolver_memo'][$memoKey];

        $vo = (isset($state['viewOptions']) && is_array($state['viewOptions'])) ? $state['viewOptions'] : array();
        if (empty($vo['journalEnabled'])) return null;
        $toggles = (isset($vo['journalToggles']) && is_array($vo['journalToggles'])) ? $vo['journalToggles'] : array();
        // The "who and when" columns (2026-10-08): beside each toggle, who marked the row
        // and the day - see whoMeta below.
        $who = !empty($vo['journalToggleWho']);
        // The single toggle of old (viewOptions.journalToggle, before toggle columns were a
        // list): the page shows it as one column, key "done", and so does this now
        // (2026-10-08) - emails, the API and task filters had no toggle column for it.
        if (empty($toggles) && !empty($vo['journalToggle'])) {
            $jt = $vo['journalToggle'];
            $toggles = array(array('key' => 'done',
                'label' => (is_array($jt) && isset($jt['label']) && is_scalar($jt['label']) && (string)$jt['label'] !== '') ? (string)$jt['label'] : 'Done'));
        }
        $keyCols = (isset($vo['journalKeyColumns']) && is_array($vo['journalKeyColumns'])) ? $vo['journalKeyColumns'] : array();
        if (empty($toggles) || empty($keyCols)) return null;
        // The toggles as the page reads them (2026-10-09; main.js, manage_journal.php's
        // journalSanitizeToggleKey): a key lower-cased with anything but a-z 0-9 _ - taken out, 'done'
        // when that leaves nothing, at most 100 characters; a missing label "Done". The raw key ("Done")
        // matched no mark here while the page read them all (stored under "done"), and a label-less toggle
        // was named by its key here and "Done" on the page.
        $toggles = array_map(function ($t) {
            if (!is_array($t)) $t = array();
            $k = strtolower((string)preg_replace('/[^a-zA-Z0-9_\-]/', '', (isset($t['key']) && is_scalar($t['key'])) ? (string)$t['key'] : ''));
            if (strlen($k) > 100) $k = substr($k, 0, 100);
            $t['key'] = ($k === '') ? 'done' : $k;
            if (!isset($t['label']) || !is_scalar($t['label']) || (string)$t['label'] === '') $t['label'] = 'Done';
            return $t;
        }, array_values($toggles));
        // A key column the data does not have (2026-10-09): every row's key read '' for it, no mark
        // matched, and every toggle read 0 - in the API, emails, task filters - while the page fails the key
        // ("(not in this data)") and shows no toggle columns. Here too: none, and a breadcrumb.
        if (is_array($existingCols) && $existingCols) {
            $haveCols = array();
            foreach ($existingCols as $ec) { $haveCols[journalUpperKey((string)$ec)] = true; $haveCols[strtoupper((string)$ec)] = true; }
            $missingKey = array();
            foreach ($keyCols as $kc) {
                $ku = journalUpperKey(trim((string)$kc));
                if ($ku !== '' && !isset($haveCols[$ku])) $missingKey[] = $ku;
            }
            if ($missingKey) {
                $m = 'journal toggles not read - the key column(s) ' . implode(', ', $missingKey) . ' are not in this data.';
                if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m); else error_log('[penumbra] ' . $m);
                return null;
            }
        }

        // Resolve the numeric report id (PENUMBRA_JOURNAL_TOGGLE.REPORT_ID).
        try {
            $r = queryViaOci8("SELECT ID FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID) = :sid", array(':sid' => trim((string)$shortId)));
        } catch (Exception $e) {
            // Distinguish "this report has no toggles" from "the lookup FAILED".
            // Both returned null silently, so a missing table or a transient ORA
            // error degraded a task's "Done = ☐" filter into an always-false literal
            // -> zero rows -> "skipped: no results", with nothing in the log to
            // explain it. Leave a breadcrumb; behaviour is unchanged.
            if (function_exists('log_scheduler')) {
                log_scheduler("  WARNING: journal toggle lookup failed - toggle columns and any filter/snippet condition on them will be inert this run. " . $e->getMessage());
            } else {
                error_log('[penumbra] journal toggle lookup failed: ' . $e->getMessage());
            }
            return null;
        }
        if (empty($r) || !isset($r[0]['ID'])) return null;
        $reportId = (int)$r[0]['ID'];
        // Filed by the key they were written under (2026-10-08): the marks of a key the report
        // no longer uses are filed first - never read here as this key's. If that fails, no
        // toggle is read at all (the breadcrumb is logged). Nor for a state that is not the saved
        // one (2026-10-09: an ?asof= preview, a run that read the report before a save): its key's
        // rows are not the ones the marks are filed by.
        $filing = function_exists('journalEnsureFiled') ? journalEnsureFiled($reportId, $keyCols) : 'ok';
        if ($filing === 'stale' && function_exists('log_scheduler')) {
            log_scheduler('  WARNING: journal toggles not read this run - the report has been saved with other key columns since the run read it.');
        }
        if ($filing === 'error' || $filing === 'stale') return null;

        // Only checked rows are stored (STATE=1); presence == checked. The who and when
        // of each mark are read only when the report shows them.
        try {
            $tr = queryViaOci8(
                $who
                    ? "SELECT TOGGLE_KEY, ROW_KEY, UPDATED_BY, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD') AS UPDATED_ON FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND STATE = 1"
                    : "SELECT TOGGLE_KEY, ROW_KEY FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND STATE = 1",
                array(':rid' => $reportId));
        } catch (Exception $e) {
            // Distinguish "this report has no toggles" from "the lookup FAILED".
            // Both returned null silently, so a missing table or a transient ORA
            // error degraded a task's "Done = ☐" filter into an always-false literal
            // -> zero rows -> "skipped: no results", with nothing in the log to
            // explain it. Leave a breadcrumb; behaviour is unchanged.
            if (function_exists('log_scheduler')) {
                log_scheduler("  WARNING: journal toggle lookup failed - toggle columns and any filter/snippet condition on them will be inert this run. " . $e->getMessage());
            } else {
                error_log('[penumbra] journal toggle lookup failed: ' . $e->getMessage());
            }
            return null;
        } // e.g. tables not installed
        $stateMap = array(); // toggle_key => { row_key => true }
        $whoMap = array();   // toggle_key => { row_key => {by, on} } (the who and when columns)
        foreach ($tr as $srow) {
            $tk = isset($srow['TOGGLE_KEY']) ? (string)$srow['TOGGLE_KEY'] : '';
            if ($tk === '') continue;
            $rk = isset($srow['ROW_KEY']) ? (string)$srow['ROW_KEY'] : '';
            if (defined('JOURNAL_PARK_OPEN') && strpos($rk, JOURNAL_PARK_OPEN) === 0) continue;   // filed under another key (2026-10-08)
            if (!isset($stateMap[$tk])) $stateMap[$tk] = array();
            $stateMap[$tk][$rk] = true;
            if ($who) {
                $whoMap[$tk][$rk] = array('by' => isset($srow['UPDATED_BY']) ? (string)$srow['UPDATED_BY'] : '',
                                         'on' => isset($srow['UPDATED_ON']) ? (string)$srow['UPDATED_ON'] : '');
            }
        }

        // Key columns are looked up UPPERCASE (matching masterRowData keys).
        $keyUpper = array();
        foreach ($keyCols as $kc) { $u = journalUpperKey(trim((string)$kc)); if ($u !== '') $keyUpper[] = $u; }
        if (empty($keyUpper)) return null;

        // Output column = the toggle LABEL, uppercased. Disambiguate a collision
        // with an existing data column (or another toggle) by suffixing _2, _3…
        // Upper-cased as the browser does it (journalUpperKey; 2026-10-09): String.toUpperCase is
        // Unicode-aware and PHP's strtoupper ASCII-only, so "Révisé" was "RéVISé" here - in the API,
        // emails and server snapshots - and "RÉVISÉ" in the browser's snapshots and search. A data
        // column is known by both forms (the ASCII one keeps the aliases below off its name).
        $existing = array();
        foreach ($existingCols as $k) { $existing[journalUpperKey((string)$k)] = true; $existing[strtoupper((string)$k)] = true; }
        $colMeta = array();
        $colNames = array();
        // The who and when columns, "<LABEL> BY" and "<LABEL> ON" (2026-10-08): plain
        // values, so they are kept APART from colMeta / colNames - every toggle rule reads
        // those (1 / 0, Checked / Unchecked bands, the summaries' toggle rule).
        $whoMeta = array();
        $whoNames = array();
        $outByKey = array();   // toggle key => its output names, for the old names below
        foreach ($toggles as $t) {
            $tk = isset($t['key']) ? (string)$t['key'] : '';
            if ($tk === '') continue;
            $name = journalUpperKey(trim((string)(isset($t['label']) && $t['label'] !== '' ? $t['label'] : $tk)));
            if ($name === '') $name = journalUpperKey($tk);
            $base = $name; $n = 2;
            while (isset($existing[$name])) { $name = $base . '_' . $n; $n++; }
            $existing[$name] = true;
            $colMeta[] = array('name' => $name, 'key' => $tk);
            $colNames[] = $name;
            $outByKey[$tk] = array('name' => $name);
            if ($who) {
                foreach (array('by' => ' BY', 'on' => ' ON') as $kind => $sfx) {
                    $wn = $base . $sfx; $wbase = $wn; $wi = 2;
                    while (isset($existing[$wn])) { $wn = $wbase . '_' . $wi; $wi++; }
                    $existing[$wn] = true;
                    $whoMeta[] = array('name' => $wn, 'key' => $tk, 'kind' => $kind);
                    $whoNames[] = $wn;
                    $outByKey[$tk][$kind] = $wn;
                }
            }
        }
        if (empty($colMeta)) return null;

        // A renamed toggle keeps answering to its OLD names (2026-10-08): the browser saves
        // them (viewOptions.journalToggles[].oldLabels) when a renamed toggle is saved, and
        // each maps here to the column the toggle is now - with its who / when columns,
        // "<OLD> BY" / "<OLD> ON" - so a task filter, a snippet, a grouping, a group summary
        // or a template saved under "Done" still reads the column now called "Complete". A
        // name a column holds now - the data's, a toggle's, a who / when column's - is never
        // one, and nor is "Notes" (the row notes column's name). Twin: main.js oldLabelsOf()
        // and journalSearchCols().
        $aliasMap = array();   // UPPER old name => output column name
        // The engines here (task filters, snippets, format() / rewrite(), groupings, band
        // summaries) read a typed name through ASCII-only strtoupper, which keeps an accented
        // letter as typed: "Révisé" and "révisé" read as "RéVISé", "Été révisé" as "ÉTé RéVISé",
        // "été révisé" as "éTé RéVISé" (2026-10-09). Those forms name the column the Unicode form
        // names - this toggle's, or the one it gave way to (a data column's name reads the data
        // column, as in the browser) - and its who / when columns, so every name that found a column
        // before still does; an ASCII name has one form.
        $asciiForms = function ($s) {
            $s = trim((string)$s);
            $f = array(strtoupper($s));
            if (function_exists('mb_strtolower')) $f[] = strtoupper(mb_strtolower($s, 'UTF-8'));
            return array_values(array_unique($f));
        };
        foreach ($toggles as $t) {
            $tk = isset($t['key']) ? (string)$t['key'] : '';
            if ($tk === '' || !isset($outByKey[$tk])) continue;
            $lbl = trim((string)(isset($t['label']) && $t['label'] !== '' ? $t['label'] : $tk));
            $u = journalUpperKey($lbl);
            if ($u === '') continue;
            foreach ($asciiForms($lbl) as $a) {
                if ($a === $u) continue;
                $pairs = array($a => $u);
                if (isset($outByKey[$tk]['by']) && $outByKey[$tk]['by'] === $u . ' BY') $pairs[$a . ' BY'] = $u . ' BY';
                if (isset($outByKey[$tk]['on']) && $outByKey[$tk]['on'] === $u . ' ON') $pairs[$a . ' ON'] = $u . ' ON';
                foreach ($pairs as $an => $to) {
                    if (!isset($existing[$an]) && !isset($aliasMap[$an])) $aliasMap[$an] = $to;
                }
            }
        }
        foreach ($toggles as $t) {
            $tk = isset($t['key']) ? (string)$t['key'] : '';
            if ($tk === '' || !isset($outByKey[$tk]) || empty($t['oldLabels']) || !is_array($t['oldLabels'])) continue;
            foreach ($t['oldLabels'] as $old) {
                if (!is_scalar($old)) continue;
                // ...an old name by its Unicode form and the ASCII-only ones (2026-10-09).
                foreach (array_unique(array_merge(array(journalUpperKey(trim((string)$old))), $asciiForms($old))) as $u) {
                    if ($u === '' || $u === 'NOTES') continue;
                    $pairs = array($u => $outByKey[$tk]['name']);
                    if (isset($outByKey[$tk]['by'])) $pairs[$u . ' BY'] = $outByKey[$tk]['by'];
                    if (isset($outByKey[$tk]['on'])) $pairs[$u . ' ON'] = $outByKey[$tk]['on'];
                    foreach ($pairs as $a => $to) {
                        if (!isset($existing[$a]) && !isset($aliasMap[$a])) $aliasMap[$a] = $to;
                    }
                }
            }
        }

        $built = array('colNames' => $colNames, 'colMeta' => $colMeta, 'keyUpper' => $keyUpper, 'stateMap' => $stateMap,
                       'whoMeta' => $whoMeta, 'whoNames' => $whoNames, 'whoMap' => $whoMap, 'aliasMap' => $aliasMap);
        if ($memoOn) $GLOBALS['penumbra_jt_resolver_memo'][$memoKey] = $built;
        return $built;
    }
}

if (!function_exists('journalExportCanonicalCol')) {
function journalExportCanonicalCol($name, $resolver) {
        if (!is_array($resolver) || empty($resolver['aliasMap']) || !is_array($resolver['aliasMap'])) return null;
        $bare = trim((string)preg_replace('/^\{\s*[\'"]?|[\'"]?\s*\}$/', '', (string)$name));
        // By its Unicode form, then the ASCII-only one the engines read it in (2026-10-09).
        foreach (array(journalUpperKey($bare), strtoupper($bare)) as $u) {
            if (isset($resolver['aliasMap'][$u])) return (string)$resolver['aliasMap'][$u];
        }
        return null;
    }
}

if (!function_exists('journalExportAliasMapFor')) {
function journalExportAliasMapFor($resolver, $present = null, $needTarget = false) {
        if (!is_array($resolver) || empty($resolver['aliasMap']) || !is_array($resolver['aliasMap'])) return array();
        $have = array();
        if ($present !== null) { foreach ((array)$present as $c) { $have[strtoupper((string)$c)] = true; $have[journalUpperKey((string)$c)] = true; } }
        $out = array();
        foreach ($resolver['aliasMap'] as $a => $to) {
            $a = (string)$a;   // a numeric-looking name is an INT array key
            if (isset($have[$a])) continue;
            if ($needTarget && !isset($have[strtoupper((string)$to)])) continue;
            $out[$a] = (string)$to;
        }
        return $out;
    }
}

if (!function_exists('journalExportToggleRowValues')) {
function journalExportToggleRowValues($resolver, $row, $withWho = true) {
        $out = array();
        if (!$resolver || !is_array($resolver) || !is_array($row)) return $out;
        $sep = "\xE2\x90\x9F"; // KEY_SEP = U+241F (UNIT SEPARATOR)
        // The key columns by the row's own names upper-cased, as the browser keys
        // the data (2026-10-07). Server rows keep the SQL's casing, so a key column
        // aliased "Proposal ID" read nothing here and every toggle came out 0 in the
        // API, scheduled emails, templates and task filters. A name that differs only
        // by case keeps the LAST value, as the browser's Map.set does.
        $want = array_flip($resolver['keyUpper']);
        $vals = array();
        // Each column name upper-cased once per run (2026-10-09, C8): mb_strtoupper ran on every column of every row,
        // on every pass. A pure function of the name; bounded.
        static $upName = array();
        if (count($upName) > 20000) $upName = array();
        foreach ($row as $k => $v) {
            $u = isset($upName[$k]) ? $upName[$k] : ($upName[$k] = journalUpperKey($k));
            if (isset($want[$u])) $vals[$u] = $v;
        }
        $parts = array();
        foreach ($resolver['keyUpper'] as $col) {
            $parts[] = journalCleanKeyValueExport(isset($vals[$col]) ? $vals[$col] : null);
        }
        $rk = implode($sep, $parts);
        foreach ($resolver['colMeta'] as $cm) {
            $on = isset($resolver['stateMap'][$cm['key']]) && isset($resolver['stateMap'][$cm['key']][$rk]);
            $out[$cm['name']] = $on ? '1' : '0';
        }
        // The who and when values (2026-10-08): who marked the row, and the day ('' when
        // unmarked). A snapshot takes none ($withWho false): the comparisons know a toggle
        // column, not these.
        if ($withWho && !empty($resolver['whoMeta'])) {
            foreach ($resolver['whoMeta'] as $wm) {
                $w = (isset($resolver['whoMap'][$wm['key']]) && isset($resolver['whoMap'][$wm['key']][$rk])) ? $resolver['whoMap'][$wm['key']][$rk] : null;
                $out[$wm['name']] = ($w && isset($w[$wm['kind']])) ? (string)$w[$wm['kind']] : '';
            }
        }
        return $out;
    }
}

if (!function_exists('journalDecorateRowsWithToggles')) {
function journalDecorateRowsWithToggles($rows, $apiResult) {
        if (!is_array($rows) || empty($rows)) return $rows;
        $jt = (is_array($apiResult) && isset($apiResult['journalToggleResolver']))
            ? $apiResult['journalToggleResolver'] : null;
        if (!$jt) return $rows;
        foreach ($rows as $i => $r) {
            if (!is_array($r)) continue;
            foreach (journalExportToggleRowValues($jt, $r, false) as $n => $v) $rows[$i][$n] = $v;
        }
        return $rows;
    }
}

if (!function_exists('journalStripWhoCols')) {
function journalStripWhoCols($rows, $from) {
        $res = (is_array($from) && isset($from['journalToggleResolver'])) ? $from['journalToggleResolver'] : $from;
        if (!is_array($rows) || !is_array($res) || empty($res['whoNames']) || !is_array($res['whoNames'])) return $rows;
        $drop = array();
        foreach ($res['whoNames'] as $n) $drop[strtoupper((string)$n)] = true;
        $strip = function ($row) use ($drop) {
            if (!is_array($row)) return $row;
            foreach (array_keys($row) as $k) { if (isset($drop[strtoupper((string)$k)])) unset($row[$k]); }
            return $row;
        };
        foreach ($rows as $i => $r) {
            if (!is_array($r)) continue;
            if (isset($r['rows']) && is_array($r['rows'])) {
                foreach ($r['rows'] as $j => $rr) $rows[$i]['rows'][$j] = $strip($rr);
                continue;
            }
            $first = reset($r);
            if (is_array($first)) {
                foreach ($r as $j => $rr) $rows[$i][$j] = $strip($rr);
                continue;
            }
            $rows[$i] = $strip($r);
        }
        return $rows;
    }
}

if (!function_exists('journalExportMapSortCriteria')) {
function journalExportMapSortCriteria($criteria, $resolver) {
        if (!is_array($criteria) || !is_array($resolver) || empty($resolver['colMeta'])) return $criteria;
        $map = array();
        foreach ($resolver['colMeta'] as $cm) $map[strtoupper('__JOURNAL_TOGGLE__' . $cm['key'])] = (string)$cm['name'];
        if (!empty($resolver['whoMeta'])) {
            foreach ($resolver['whoMeta'] as $wm) $map[strtoupper(($wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . $wm['key'])] = (string)$wm['name'];
        }
        if (!empty($resolver['aliasMap']) && is_array($resolver['aliasMap'])) {
            foreach ($resolver['aliasMap'] as $a => $to) { if (!isset($map[strtoupper((string)$a)])) $map[strtoupper((string)$a)] = (string)$to; }
        }
        foreach ($criteria as $i => $c) {
            if (!is_array($c)) continue;
            foreach (array('colIdentifier', 'colIndex') as $f) {
                if (isset($c[$f]) && is_string($c[$f]) && isset($map[strtoupper($c[$f])])) $criteria[$i][$f] = $map[strtoupper($c[$f])];
            }
        }
        return $criteria;
    }
}

if (!function_exists('journalExportToggleGroupBy')) {
function journalExportToggleGroupBy($groupBy, $resolver) {
        if (!is_array($resolver) || empty($resolver['colMeta']) || !is_string($groupBy)) return $groupBy;
        $byKey = array();
        foreach ($resolver['colMeta'] as $cm) $byKey[strtolower((string)$cm['key'])] = $cm['name'];
        $byWho = array();
        if (!empty($resolver['whoMeta'])) {
            foreach ($resolver['whoMeta'] as $wm) $byWho[strtoupper(($wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . $wm['key'])] = $wm['name'];
        }
        $levels = explode(',', $groupBy);
        $changed = false;
        foreach ($levels as $i => $lv) {
            $t = trim($lv);
            $to = null;
            if (isset($byWho[strtoupper($t)])) $to = (string)$byWho[strtoupper($t)];
            elseif (isset($resolver['aliasMap'][strtoupper($t)])) $to = (string)$resolver['aliasMap'][strtoupper($t)];
            elseif (stripos($t, '__JOURNAL_TOGGLE__') === 0) {
                $k = strtolower(substr($t, strlen('__JOURNAL_TOGGLE__')));
                if (isset($byKey[$k])) $to = (string)$byKey[$k];
            }
            if ($to === null || strpos($to, ',') !== false) continue;
            $levels[$i] = $to;
            $changed = true;
        }
        return $changed ? implode(',', array_map('trim', $levels)) : $groupBy;
    }
}

if (!function_exists('journalExportToggleColumns')) {
function journalExportToggleColumns($shortId, $state, &$rows) {
        // whoNames (2026-10-08): the who and when columns appended too - kept through a
        // reorder with the toggles, but never a toggle (colNames is the toggles alone).
        $out = array('colNames' => array(), 'whoNames' => array(), 'rowsDecorated' => 0, 'resolver' => null);
        if (!is_array($rows) || empty($rows) || !is_array($state)) return $out;

        $firstRow = reset($rows);
        $resolver = journalExportToggleResolver($shortId, $state, is_array($firstRow) ? array_keys($firstRow) : array());
        if (!$resolver) return $out;
        $out['colNames'] = $resolver['colNames'];
        $out['whoNames'] = isset($resolver['whoNames']) ? $resolver['whoNames'] : array();
        $out['resolver'] = $resolver;

        foreach ($rows as &$row) {
            if (!is_array($row)) continue;
            foreach (journalExportToggleRowValues($resolver, $row) as $name => $val) {
                $row[$name] = $val;
            }
            $out['rowsDecorated']++;
        }
        unset($row);
        return $out;
    }
}
