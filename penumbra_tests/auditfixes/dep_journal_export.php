<?php
// AUTO-EXTRACTED from journal_export.php - do not edit.
if (!function_exists('journalNotesFlatten')) {
function journalNotesFlatten($notes) {
        if (!is_array($notes) || !$notes) return '';
        $has = array();
        foreach ($notes as $n) { if (is_array($n) && isset($n['ID'])) $has[(string)$n['ID']] = true; }
        $top = array(); $replies = array();
        foreach ($notes as $n) {
            if (!is_array($n)) continue;
            $pid = isset($n['PARENT_ID']) ? (string)$n['PARENT_ID'] : '';
            if ($pid !== '' && $pid !== '0' && isset($has[$pid])) $replies[$pid][] = $n;
            else $top[] = $n;
        }
        $line = function ($n) {
            $t = preg_replace('/\r\n|\r|\n/', ' ', isset($n['NOTE_TEXT']) ? (string)$n['NOTE_TEXT'] : '');
            $t = preg_replace('/^[ \t]+|[ \t]+$/', '', $t);
            $f = isset($n['ATTACH_NAME']) ? (string)$n['ATTACH_NAME'] : '';
            if ($f !== '') $t .= ($t !== '' ? ' ' : '') . '[file: ' . $f . ']';
            $who = (isset($n['AUTHOR_NAME']) && (string)$n['AUTHOR_NAME'] !== '') ? (string)$n['AUTHOR_NAME']
                 : (isset($n['CREATED_BY']) ? (string)$n['CREATED_BY'] : '');
            return substr(isset($n['CREATED_AT']) ? (string)$n['CREATED_AT'] : '', 0, 10) . ' ' . $who . ': ' . $t;
        };
        $out = array();
        foreach ($top as $n) {
            $out[] = $line($n);
            $id = isset($n['ID']) ? (string)$n['ID'] : '';
            if ($id !== '' && isset($replies[$id])) { foreach ($replies[$id] as $r) $out[] = "  \xE2\x86\xB3 " . $line($r); }
        }
        return implode("\n", $out);
    }
}

if (!function_exists('journalSharedNoteText')) {
function journalSharedNoteText($notes) {
        if (!is_array($notes) || !$notes) return '';
        $best = null;
        foreach ($notes as $n) {
            if (!is_array($n)) continue;
            $pid = isset($n['PARENT_ID']) ? (string)$n['PARENT_ID'] : '';
            if ($pid === '' || $pid === '0') $best = $n;
        }
        if ($best === null) return '';
        $t = preg_replace('/\r\n|\r/', "\n", isset($best['NOTE_TEXT']) ? (string)$best['NOTE_TEXT'] : '');
        return preg_replace('/^[ \t\n]+|[ \t\n]+$/', '', $t);
    }
}

if (!function_exists('journalNoteCellSafe')) {
function journalNoteCellSafe($s) {
        $s = (string)$s;
        if (strpos($s, '@@') === false) return $s;
        $r = preg_replace('/@(?=@(?:HTML|JSON))/i', "@\xE2\x81\xA0", $s);
        return ($r === null) ? str_replace('@@', "@\xE2\x81\xA0@", $s) : $r;
    }
}

if (!function_exists('journalHasPrivateColumn')) {
function journalHasPrivateColumn() {
        static $has = null;
        if ($has !== null) return $has;
        try {
            $r = queryViaOci8("SELECT COUNT(*) AS CNT FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'PENUMBRA_JOURNAL' AND COLUMN_NAME = 'IS_PRIVATE'");
            $has = isset($r[0]['CNT']) && (int)$r[0]['CNT'] > 0;
        } catch (Exception $e) { $has = false; }
        return $has;
    }
}

if (!function_exists('journalNoteThreadId')) {
function journalNoteThreadId($n) {
        $p = (is_array($n) && isset($n['PARENT_ID'])) ? trim((string)$n['PARENT_ID']) : '';
        if ($p !== '' && $p !== '0') return $p;
        return (is_array($n) && isset($n['ID'])) ? trim((string)$n['ID']) : '';
    }
}

if (!function_exists('journalNoteIsPrivate')) {
function journalNoteIsPrivate($n) {
        return is_array($n) && isset($n['IS_PRIVATE']) && trim((string)$n['IS_PRIVATE']) !== '' && (int)$n['IS_PRIVATE'] !== 0;
    }
}

if (!function_exists('journalMentionUids')) {
function journalMentionUids($csv) {
        $out = array();
        foreach (explode(',', strtolower((string)$csv)) as $u) {
            $u = trim($u);
            if ($u !== '' && !in_array($u, $out, true)) $out[] = $u;
        }
        return $out;
    }
}

if (!function_exists('journalThreadAudiences')) {
function journalThreadAudiences($rows) {
        $priv = array();
        foreach ((array)$rows as $n) { if (journalNoteIsPrivate($n)) $priv[journalNoteThreadId($n)] = true; }
        if (!$priv) return array();
        $aud = array();
        foreach ((array)$rows as $n) {
            $t = journalNoteThreadId($n);
            if (!isset($priv[$t])) continue;
            if (!isset($aud[$t])) $aud[$t] = array();
            $by = strtolower(trim((string)(isset($n['CREATED_BY']) ? $n['CREATED_BY'] : '')));
            if ($by !== '') $aud[$t][$by] = true;
            foreach (journalMentionUids(isset($n['MENTIONS']) ? $n['MENTIONS'] : '') as $u) $aud[$t][$u] = true;
        }
        return $aud;
    }
}

if (!function_exists('journalVisibleNotes')) {
function journalVisibleNotes($rows, $uid) {
        if (!is_array($rows) || !$rows) return is_array($rows) ? $rows : array();
        $aud = journalThreadAudiences($rows);
        if (!$aud) return $rows;
        $me = strtolower(trim((string)$uid));
        $out = array();
        foreach ($rows as $n) {
            $t = journalNoteThreadId($n);
            if (isset($aud[$t]) && ($me === '' || !isset($aud[$t][$me]))) continue;
            $out[] = $n;
        }
        return $out;
    }
}

if (!function_exists('journalThreadAudienceList')) {
function journalThreadAudienceList($rows) {
        $aud = array();
        foreach ((array)$rows as $n) {
            $by = strtolower(trim((string)(isset($n['CREATED_BY']) ? $n['CREATED_BY'] : '')));
            if ($by !== '') $aud[$by] = true;
            foreach (journalMentionUids(isset($n['MENTIONS']) ? $n['MENTIONS'] : '') as $u) $aud[$u] = true;
        }
        $list = array_keys($aud);
        $list = array_map('strval', $list);
        sort($list, SORT_STRING);
        return $list;
    }
}

if (!function_exists('journalNoteCounts')) {
function journalNoteCounts($rows) {
        $total = 0; $unseen = 0; $latest = null;
        foreach ((array)$rows as $n) {
            $total++;
            if (isset($n['UNSEEN_FLAG']) && (int)$n['UNSEEN_FLAG'] === 1) $unseen++;
            $at = isset($n['CREATED_AT']) ? (string)$n['CREATED_AT'] : '';
            if ($at !== '' && ($latest === null || strcmp($at, $latest) > 0)) $latest = $at;
        }
        return array('TOTAL' => $total, 'UNSEEN' => $unseen, 'LATEST_AT' => $latest);
    }
}

if (!function_exists('journalPrivateCapRefusal')) {
function journalPrivateCapRefusal($reportId, $uid, $adding = 1) {
        $r = queryViaOci8("SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND NVL(IS_PRIVATE, 0) <> 0 AND UPPER(CREATED_BY) = UPPER(:cby)",
            array(':rid' => (int)$reportId, ':cby' => (string)$uid));
        $mine = (!empty($r) && isset($r[0]['C'])) ? (int)$r[0]['C'] : 0;
        if ($mine + max(1, (int)$adding) <= JOURNAL_MAX_PRIVATE_NOTES_PER_AUTHOR) return null;
        if ((int)$adding > 1) {
            return 'You can keep at most ' . JOURNAL_MAX_PRIVATE_NOTES_PER_AUTHOR . ' private notes on one report. You have ' . $mine
                . ' on this one, and making this thread private would add ' . (int)$adding . ' of yours. Delete some of your private notes, or keep this thread visible to everyone.';
        }
        return 'You can keep at most ' . JOURNAL_MAX_PRIVATE_NOTES_PER_AUTHOR . ' private notes on one report, and you have ' . $mine
            . ' on this one. Delete some of them, or make a thread visible to everyone, to add another private note.';
    }
}

if (!function_exists('journalNoteMentionTag')) {
function journalNoteMentionTag($noteId, $uid) {
        $cfg = (isset($GLOBALS['config']) && is_array($GLOBALS['config'])) ? $GLOBALS['config'] : array();
        $k = isset($cfg['scheduler_secret_key']) ? (string)$cfg['scheduler_secret_key'] : '';
        if ($k === '') return null;
        return substr(hash_hmac('sha256', 'pnb-jmention|' . (int)$noteId . '|' . strtolower(trim((string)$uid)), $k), 0, 24);
    }
}

if (!function_exists('journalNoteMentionTags')) {
function journalNoteMentionTags($noteId, $uids) {
        $o = array();
        foreach ((array)$uids as $u) { $t = journalNoteMentionTag($noteId, $u); if ($t !== null && !in_array($t, $o, true)) $o[] = $t; }
        return $o;
    }
}

if (!function_exists('journalNoteMentionHistory')) {
function journalNoteMentionHistory($reportId, $noteId) {
        try {
            $rows = queryViaOci8(
                "SELECT a.\"BEFORE\" AS B, a.\"AFTER\" AS A FROM NC_REPORTING.PENUMBRA_AUDIT a
                  WHERE a.ID IN (SELECT ID FROM (SELECT ID FROM NC_REPORTING.PENUMBRA_AUDIT
                                  WHERE REPORT_ID = :rid AND ACTION = 'JOURNAL_EDIT' AND DBMS_LOB.INSTR(\"AFTER\", :nd) = 1
                                  ORDER BY \"TIMESTAMP\" DESC, ID DESC) WHERE ROWNUM <= 500)",
                array(':rid' => (int)$reportId, ':nd' => '{"id":' . (int)$noteId . ','));
        } catch (Exception $e) {
            error_log('[PENUMBRA JOURNAL] mention history not read for note ' . (int)$noteId . ': ' . $e->getMessage());
            return null;
        }
        if (!is_array($rows)) return null;
        $uids = array(); $tags = array();
        foreach ($rows as $r) {
            foreach (array('B', 'A') as $side) {
                $j = json_decode(isset($r[$side]) ? (string)$r[$side] : '', true);
                if (!is_array($j) || !isset($j['id']) || (int)$j['id'] !== (int)$noteId) continue;
                if (isset($j['mentions']) && is_string($j['mentions'])) { foreach (journalMentionUids($j['mentions']) as $u) $uids[$u] = true; }
                if (isset($j['mentions']) && is_array($j['mentions'])) {
                    foreach ($j['mentions'] as $m) { if (is_array($m) && isset($m['user']) && is_scalar($m['user'])) $uids[strtolower(trim((string)$m['user']))] = true; }
                }
                if (isset($j['mt']) && is_array($j['mt'])) { foreach ($j['mt'] as $t) { if (is_string($t)) $tags[$t] = true; } }
            }
        }
        return array('uids' => $uids, 'tags' => $tags);
    }
}

if (!function_exists('journalOffSinceScan')) {
function journalOffSinceScan($reportId) {
        $needle = '"journalEnabled":true';   // every version is written by PHP's json_encode: no space after the colon
        // a version's state as a decoded, unencrypted object (the wrappers put 'report' first)
        $plain = function ($head) {
            $h = (string)$head;
            if (strpos($h, '{"report":{"encrypted":true') === 0) return false;
            return strpos($h, '{"report":{') === 0 || strpos($h, '{"report":[') === 0;
        };
        foreach (array(array(0, 12), array(12, JOURNAL_OFF_SINCE_SCAN)) as $win) {
            $rows = queryViaOci8(
                "SELECT a.ID, a.ACTION, TO_CHAR(a.\"TIMESTAMP\", 'YYYY-MM-DD HH24:MI:SS') AS AT,
                        CASE WHEN a.\"BEFORE\" IS NULL THEN -1 WHEN DBMS_LOB.INSTR(a.\"BEFORE\", :n1) > 0 THEN 1 ELSE 0 END AS B_ON,
                        CASE WHEN a.\"AFTER\" IS NULL THEN -1 WHEN DBMS_LOB.INSTR(a.\"AFTER\", :n2) > 0 THEN 1 ELSE 0 END AS A_ON,
                        DBMS_LOB.SUBSTR(a.\"BEFORE\", 40, 1) AS B_HEAD, DBMS_LOB.SUBSTR(a.\"AFTER\", 40, 1) AS A_HEAD
                   FROM NC_REPORTING.PENUMBRA_AUDIT a
                  WHERE a.ID IN (SELECT ID FROM (SELECT ID, ROWNUM AS RN FROM (SELECT ID FROM NC_REPORTING.PENUMBRA_AUDIT
                                     WHERE REPORT_ID = :rid AND ACTION IN ('CREATE', 'UPDATE', 'ROLLBACK', 'RESTORE')
                                     ORDER BY \"TIMESTAMP\" DESC, ID DESC) WHERE ROWNUM <= :hi) WHERE RN > :lo)
                  ORDER BY a.\"TIMESTAMP\" DESC, a.ID DESC",
                array(':n1' => $needle, ':n2' => $needle, ':rid' => (int)$reportId, ':hi' => $win[1], ':lo' => $win[0]));
            if (!is_array($rows)) return null;
            foreach ($rows as $r) {
                // off after it, as the live state (or the newer version) is
                if ((int)$r['A_ON'] !== 0 || !$plain($r['A_HEAD'])) return null;
                $act = strtoupper(trim((string)$r['ACTION']));
                if ($act === 'CREATE') return array('off_since' => null, 'never_on' => true);
                if ($act !== 'UPDATE' && $act !== 'ROLLBACK') return null;   // a RESTORE (a re-insert): what came before it is not here
                if ((int)$r['B_ON'] === -1 || !$plain($r['B_HEAD'])) return null;
                if ((int)$r['B_ON'] === 1) return array('off_since' => (string)$r['AT'], 'never_on' => false);
            }
            if (count($rows) < $win[1] - $win[0]) return null;   // the whole history read, and no CREATE in it
        }
        return null;
    }
}

if (!function_exists('journalPublishCounts')) {
function journalPublishCounts($reportId, $uid) {
        $out = array('total' => 0, 'since_off' => null, 'off_since' => null, 'never_on' => false);
        $vis = null;
        if (journalHasPrivateColumn()) {
            $rows = array();
            foreach (array(true, false) as $wp) {   // a table from before threads has no PARENT_ID
                try {
                    $rows = queryViaOci8("SELECT ID" . ($wp ? ', PARENT_ID' : '') . ", CREATED_BY, MENTIONS, IS_PRIVATE, TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT"
                        . " FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid", array(':rid' => (int)$reportId));
                    break;
                } catch (Exception $e) {
                    if ($wp && stripos($e->getMessage(), 'ORA-00904') !== false) continue;
                    throw $e;
                }
            }
            $vis = journalVisibleNotes(is_array($rows) ? $rows : array(), $uid);
            $out['total'] = count($vis);
        } else {
            $r = queryViaOci8("SELECT COUNT(*) AS TOTAL FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid", array(':rid' => (int)$reportId));
            $out['total'] = isset($r[0]['TOTAL']) ? (int)$r[0]['TOTAL'] : 0;
        }
        try {
            $os = journalOffSinceScan($reportId);
            if (is_array($os) && $os['never_on']) {
                $out['never_on'] = true; $out['since_off'] = $out['total'];
            } elseif (is_array($os) && is_string($os['off_since']) && $os['off_since'] !== '') {
                $n = null;
                if (is_array($vis)) {
                    $n = 0;
                    foreach ($vis as $vn) { if (isset($vn['CREATED_AT']) && strcmp((string)$vn['CREATED_AT'], $os['off_since']) >= 0) $n++; }
                } else {
                    $cr = queryViaOci8("SELECT COUNT(*) AS N FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND CREATED_AT >= TO_TIMESTAMP(:os, 'YYYY-MM-DD HH24:MI:SS')",
                        array(':rid' => (int)$reportId, ':os' => $os['off_since']));
                    $n = isset($cr[0]['N']) ? (int)$cr[0]['N'] : null;
                }
                if ($n !== null) { $out['off_since'] = $os['off_since']; $out['since_off'] = $n; }
            }
        } catch (Throwable $e) {
            error_log('[PENUMBRA JOURNAL] publish gate: off_since read failed: ' . $e->getMessage());
        }
        return $out;
    }
}

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

if (!function_exists('journalKeyfileEncWrite')) {
function journalKeyfileEncWrite($reportId, $pageCols) {
        try {
            if (!is_array($pageCols)) return;
            $ps = journalKeySig($pageCols);
            if ($ps === '' || strlen($ps) > JOURNAL_KEYFILE_MAX_SIG) return;
            $filed = journalFiledKey($reportId);
            if ($filed === null || $filed === $ps) return;
            if (substr($filed, -strlen(JOURNAL_KEYFILE_ENC)) === JOURNAL_KEYFILE_ENC) return;   // marked already
            $oci = getOci8Connection();
            journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL_TOGGLE SET ROW_KEY = :mnew WHERE REPORT_ID = :mrid AND TOGGLE_KEY = :mkf AND STATE = "
                . JOURNAL_KEYFILE_STATE . " AND ROW_KEY = :mold",
                array(':mnew' => $filed . JOURNAL_KEYFILE_ENC, ':mrid' => (int)$reportId, ':mkf' => JOURNAL_KEYFILE_TK, ':mold' => $filed));
            oci_commit($oci);
        } catch (Throwable $e) {
            error_log('[penumbra] journal key record: the encrypted-write mark failed: ' . $e->getMessage());
        }
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
            // (2026-11-17, rekeyzero) A plain row at STATE 0 - a mark made and cleared under the saved key - gives way to
            // the filed mark or value coming back onto it: it blocked the give-back below for good, so the mark stayed
            // filed under the other key and the row read unmarked.
            journalOciRun($oci, "DELETE FROM PENUMBRA_JOURNAL_TOGGLE Z WHERE Z.REPORT_ID = :zrid AND Z.STATE = 0 AND Z.TOGGLE_KEY <> :zkf"
                . " AND SUBSTR(Z.ROW_KEY, 1, 1) <> " . JOURNAL_PARK_OPEN_SQL
                . " AND EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL_TOGGLE T WHERE T.REPORT_ID = :zrid2 AND T.TOGGLE_KEY = Z.TOGGLE_KEY"
                . " AND T.STATE IN (1, 2) AND T.ROW_KEY = :ztag || Z.ROW_KEY)",   // a mark, a field value - never the filing marker
                array(':zrid' => $rid, ':zkf' => JOURNAL_KEYFILE_TK, ':zrid2' => $rid, ':ztag' => $tt));
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
            // (2026-11-18, encfile) The record is marked: while the report was encrypted, a page wrote under other key columns
            // than the recorded ones (journalKeyfileEncWrite). Its plain marks and notes are then two keys' - the recorded
            // key's from before and the encrypted page's - and nothing tells them apart, so NOTHING is filed: they stay
            // where they are, and the record becomes the key the report is saved with now (the encrypted page's newest
            // writes read as that key's, as the page showed them). 'held'; audited. A mark whose key did not change is only
            // taken off.
            if (is_string($filed) && substr($filed, -strlen(JOURNAL_KEYFILE_ENC)) === JOURNAL_KEYFILE_ENC) {
                $encBase = (string)substr($filed, 0, -strlen(JOURNAL_KEYFILE_ENC));
                $oci = getOci8Connection();
                try {
                    journalOciRun($oci, "UPDATE PENUMBRA_JOURNAL_TOGGLE SET ROW_KEY = :enew, UPDATED_AT = SYSTIMESTAMP WHERE REPORT_ID = :erid AND TOGGLE_KEY = :ekf AND STATE = "
                        . JOURNAL_KEYFILE_STATE . " AND ROW_KEY = :eold",
                        array(':enew' => $sig, ':erid' => (int)$reportId, ':ekf' => JOURNAL_KEYFILE_TK, ':eold' => $filed));
                    oci_commit($oci);
                } catch (Exception $e) {
                    @oci_rollback($oci);
                    throw $e;
                }
                if ($encBase !== $sig) {
                    $m = 'journal key filing held: the key columns changed while the report was encrypted, so its marks and notes were left as they are (no re-file) and are read as the saved key\'s.';
                    if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m); else error_log('[penumbra] ' . $m);
                    if (function_exists('logPenumbraAudit')) {
                        try {
                            logPenumbraAudit((int)$reportId, 'JOURNAL_REKEY', null, json_encode(array('held' => true,
                                'from_cols' => explode("\xE2\x90\x9F", $encBase), 'to_cols' => explode("\xE2\x90\x9F", $sig))),
                                'Key columns changed while the report was encrypted: its row marks and notes were left as they are (not filed under the old key)');
                        } catch (Throwable $ae) { }
                    }
                }
                $filed = journalFiledKey($reportId);
                if ($filed === null) throw new Exception('the key record went missing');
                if ($encBase !== $sig && $filed === $sig) return 'held';
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

if (!function_exists('journalUnreadCols')) {
function journalUnreadCols($set = null) {
        if (is_array($set)) $GLOBALS['penumbra_jt_unread'] = $set;
        return (isset($GLOBALS['penumbra_jt_unread']) && is_array($GLOBALS['penumbra_jt_unread'])) ? $GLOBALS['penumbra_jt_unread'] : array();
    }
}

if (!function_exists('journalUnreadNames')) {
function journalUnreadNames($vo, $existingCols, $what) {
        $vo = is_array($vo) ? $vo : array();
        $have = array();
        foreach ((array)$existingCols as $c) { $have[journalUpperKey((string)$c)] = true; $have[strtoupper((string)$c)] = true; }
        $out = array();
        $add = function ($n) use (&$out, $have) {
            $n = trim((string)$n);
            if ($n === '') return;
            foreach (array(journalUpperKey($n), strtoupper($n)) as $u) { if (!isset($have[$u])) $out[$u] = true; }
        };
        $olds = function ($a) { $o = array(); if (is_array($a)) { foreach ($a as $x) { if (is_scalar($x) && trim((string)$x) !== '') $o[] = (string)$x; } } return $o; };
        $who = !empty($vo['journalToggleWho']);
        if (in_array('toggles', $what, true)) {
            $tg = (isset($vo['journalToggles']) && is_array($vo['journalToggles'])) ? $vo['journalToggles'] : array();
            if (!$tg && !empty($vo['journalToggle'])) $tg = array(is_array($vo['journalToggle']) ? $vo['journalToggle'] : array());
            foreach ($tg as $t) {
                $l = (is_array($t) && isset($t['label']) && is_scalar($t['label']) && (string)$t['label'] !== '') ? (string)$t['label'] : 'Done';
                foreach (array_merge(array($l), $olds(is_array($t) && isset($t['oldLabels']) ? $t['oldLabels'] : null)) as $n) {
                    $add($n);
                    if ($who) { $add($n . ' BY'); $add($n . ' ON'); }
                }
            }
        }
        if (in_array('fields', $what, true) && isset($vo['journalFields']) && is_array($vo['journalFields'])) {
            foreach ($vo['journalFields'] as $fd) {
                if (!is_array($fd) || !isset($fd['type']) || ($fd['type'] !== 'pick' && $fd['type'] !== 'date')) continue;
                $isDate = ($fd['type'] === 'date');
                $l = (isset($fd['label']) && is_scalar($fd['label']) && trim((string)$fd['label']) !== '') ? (string)$fd['label'] : ($isDate ? 'Due' : 'Status');
                foreach (array_merge(array($l), $olds(isset($fd['oldLabels']) ? $fd['oldLabels'] : null)) as $n) {
                    $add($n);
                    if ($who) { $add($n . ($isDate ? ' SET BY' : ' BY')); $add($n . ($isDate ? ' SET ON' : ' ON')); }
                }
            }
        }
        if (in_array('notes', $what, true) && !empty($vo['journalRowNotes'])) $add('Notes');
        return $out;
    }
}

if (!function_exists('journalUnreadTree')) {
function journalUnreadTree($tree, $unread) {
        if (!is_array($tree) || !$unread) return $tree;
        foreach ($tree as $k => $node) {
            if (!is_array($node) || !isset($node['type'])) continue;
            if ($node['type'] === 'group' && isset($node['parts']) && is_array($node['parts'])) { $tree[$k]['parts'] = journalUnreadTree($node['parts'], $unread); continue; }
            if ($node['type'] !== 'condition' || !isset($node['column'])) continue;
            $u = strtoupper(trim((string)preg_replace('/^\{\s*[\'"]?|[\'"]?\s*\}$/', '', (string)$node['column'])));
            if (!isset($unread[$u])) continue;
            journalUnreadWarn($u);
            // "0 = 1": false in both engines, whatever the condition's operator was
            $tree[$k] = array('type' => 'literal', 'leftValue' => '0', 'op' => '=', 'value' => '1', 'journalUnread' => $u);
        }
        return $tree;
    }
}

if (!function_exists('journalUnreadWarn')) {
function journalUnreadWarn($u) {
        if (!isset($GLOBALS['penumbra_run_journal_warnings']) || !is_array($GLOBALS['penumbra_run_journal_warnings'])) $GLOBALS['penumbra_run_journal_warnings'] = array();
        if (isset($GLOBALS['penumbra_run_journal_warnings'][$u])) return;
        $m = 'the journal column ' . $u . ' could not be read this run, so the condition on it matched no row';
        $GLOBALS['penumbra_run_journal_warnings'][$u] = $m;
        if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m . '.');
    }
}

if (!function_exists('journalExportToggleResolver')) {
function journalExportToggleResolver($shortId, $state, $existingCols = array()) {
        if (!is_array($state)) return null;
        // A memo for one task's per-recipient re-runs (2026-10-09, C8): each recipient's re-run read every mark again.
        // Off unless the scheduler sets $GLOBALS['penumbra_jt_resolver_memo'] (an array) around that call.
        $memoOn = isset($GLOBALS['penumbra_jt_resolver_memo']) && is_array($GLOBALS['penumbra_jt_resolver_memo']);
        $memoKey = $memoOn ? (string)$shortId . '|' . md5(serialize(array(isset($state['viewOptions']) ? $state['viewOptions'] : null, array_values((array)$existingCols)))) : '';
        // (2026-11-18, failclosed) the columns THIS call cannot read (journalUnreadCols): none yet - a remembered resolver's own
        if (function_exists('journalUnreadCols')) {
            journalUnreadCols(($memoOn && isset($GLOBALS['penumbra_jt_unread_memo'][$memoKey]) && is_array($GLOBALS['penumbra_jt_unread_memo'][$memoKey]))
                ? $GLOBALS['penumbra_jt_unread_memo'][$memoKey] : array());
        }
        if ($memoOn && isset($GLOBALS['penumbra_jt_resolver_memo'][$memoKey])) return $GLOBALS['penumbra_jt_resolver_memo'][$memoKey];
        if (function_exists('journalUnreadCols')) journalUnreadCols(array());   // not remembered: this call's own

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
        // Row notes as a column of text (2026-10-14): only when the report's editors ask for it
        // ("Include notes in downloads and emails"; off by default) - the notes are the viewers'
        // own words, and an email goes to people who may never open the journal.
        $notesOut = !empty($vo['journalRowNotes']) && !empty($vo['journalNotesExport']);
        // ...and read whenever row notes are on (2026-10-14, notescol7), so a task's search filter
        // can find rows by their notes ("Notes = budget", a bare word, "Notes > 2") as the page's
        // search does - whether or not the output carries the column.
        $notesRead = !empty($vo['journalRowNotes']);
        // Pick lists (2026-11-11, PICKLIST_SPEC.md): the saved lists (viewOptions.journalFields), cleaned as main.js's
        // penumbraCleanJournalFields restores them - type 'pick', at most 4, a key a toggle column has (or '__...')
        // skipped, at most 30 options with ids o1..o9999, labels trimmed to 60 characters, the last 10 old names. Each is
        // a column of TEXT (its option's label), read from the STATE = 2 rows below: it rides with the who / when columns
        // (whoMeta, kind 'field'), which no toggle rule (1 / 0, Checked / Unchecked) reads.
        $fieldDefs = array();   // key => array('key', 'label', 'oldLabels', 'options' => [{id, label, retired, oldLabels}])
        if (isset($vo['journalFields']) && is_array($vo['journalFields'])) {
            $fCut = function ($s) { return function_exists('mb_substr') ? (string)mb_substr($s, 0, 60, 'UTF-8') : substr($s, 0, 60); };
            $fClip = function ($v, $d) use ($fCut) {
                $s = (is_scalar($v) && (string)$v !== '') ? (string)$v : $d;
                $s = $fCut(trim($s));
                return ($s === '') ? $d : $s;
            };
            $fOld = function ($a) use ($fCut) {
                $o = array();
                if (is_array($a)) { foreach ($a as $x) { if (is_string($x) && trim($x) !== '') $o[] = $fCut(trim($x)); } }
                return array_slice($o, -10);
            };
            $fTk = array();
            foreach ($toggles as $t) {
                $k = strtolower((string)preg_replace('/[^a-zA-Z0-9_\-]/', '', (is_array($t) && isset($t['key']) && is_scalar($t['key'])) ? (string)$t['key'] : ''));
                $fTk[($k === '') ? 'done' : $k] = true;
            }
            $fPer = array('pick' => 0, 'date' => 0);   // (2026-11-12, DATE_SPEC.md) at most four of each type
            foreach ($vo['journalFields'] as $fd) {
                if (!is_array($fd) || !isset($fd['type']) || ($fd['type'] !== 'pick' && $fd['type'] !== 'date')) continue;
                if ($fPer[$fd['type']] >= 4) continue;
                $fk = strtolower((string)preg_replace('/[^a-zA-Z0-9_\-]/', '', (isset($fd['key']) && is_scalar($fd['key'])) ? (string)$fd['key'] : ''));
                if (strlen($fk) > 100) $fk = substr($fk, 0, 100);
                if ($fk === '' || isset($fieldDefs[$fk]) || isset($fTk[$fk]) || strpos($fk, '__') === 0) continue;
                $fPer[$fd['type']]++;
                if ($fd['type'] === 'date') {   // a date column: a label, no options; its values pass through as days
                    $fieldDefs[$fk] = array('key' => $fk, 'type' => 'date', 'label' => $fClip(isset($fd['label']) ? $fd['label'] : null, 'Due'),
                                            'oldLabels' => $fOld(isset($fd['oldLabels']) ? $fd['oldLabels'] : null), 'options' => array());
                    continue;
                }
                $fopts = array();
                $fids = array();
                foreach ((isset($fd['options']) && is_array($fd['options'])) ? $fd['options'] : array() as $fo) {
                    if (count($fopts) >= 30) break;
                    if (!is_array($fo) || !isset($fo['id']) || !is_string($fo['id']) || !preg_match('/^o[1-9][0-9]{0,3}$/', $fo['id']) || isset($fids[$fo['id']])) continue;
                    $fids[$fo['id']] = true;
                    $fopts[] = array('id' => $fo['id'], 'label' => $fClip(isset($fo['label']) ? $fo['label'] : null, $fo['id']),
                                     'retired' => !empty($fo['retired']), 'oldLabels' => $fOld(isset($fo['oldLabels']) ? $fo['oldLabels'] : null));
                }
                $fieldDefs[$fk] = array('key' => $fk, 'type' => 'pick', 'label' => $fClip(isset($fd['label']) ? $fd['label'] : null, 'Status'),
                                        'oldLabels' => $fOld(isset($fd['oldLabels']) ? $fd['oldLabels'] : null), 'options' => $fopts);
            }
        }
        if ((empty($toggles) && !$notesRead && !$fieldDefs) || empty($keyCols)) return null;
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
                if (function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadNames($vo, $existingCols, array('toggles', 'fields', 'notes')));   // (failclosed)
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
            if (function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadNames($vo, $existingCols, array('toggles', 'fields', 'notes')));   // (failclosed)
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
        if (($filing === 'error' || $filing === 'stale') && function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadNames($vo, $existingCols, array('toggles', 'fields', 'notes')));   // (failclosed)
        if ($filing === 'error' || $filing === 'stale') return null;

        // Only checked rows are stored (STATE=1); presence == checked. The who and when
        // of each mark are read only when the report shows them. No toggle: nothing to read.
        if (empty($toggles)) $tr = array();
        else try {
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
            if (function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadNames($vo, $existingCols, array('toggles', 'fields', 'notes')));   // (failclosed)
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

        // Pick lists (2026-11-11): each row's option - STATE = 2, the option's id in FIELD_VALUE (manage_journal.php's
        // set_field; a cleared row is STATE 0 and is never read) - kept in whoMap as {field: the option's label, by, on}
        // (a pick list's key is never a toggle's). Read only when the report has a pick list. A table without FIELD_VALUE
        // (ORA-00904), or a failed read, leaves the pick lists' columns out this run, with a breadcrumb; the toggles and
        // the notes are read as before.
        if ($fieldDefs) {
            try {
                $fr = queryViaOci8(
                    "SELECT TOGGLE_KEY, ROW_KEY, FIELD_VALUE, UPDATED_BY, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD') AS UPDATED_ON FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND STATE = 2",
                    array(':rid' => $reportId));
            } catch (Exception $e) {
                $fr = null;
                $m = (stripos($e->getMessage(), 'ORA-00904') !== false)
                    ? 'journal pick lists not read - the toggle table has no FIELD_VALUE column; their columns are left out this run.'
                    : 'journal pick lists not read - their columns are left out this run. ' . $e->getMessage();
                if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m); else error_log('[penumbra] ' . $m);
                if (function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadCols() + journalUnreadNames($vo, $existingCols, array('fields')));   // (failclosed)
            }
            if (!is_array($fr)) $fieldDefs = array();
            else foreach ($fr as $frow) {
                $fk = isset($frow['TOGGLE_KEY']) ? (string)$frow['TOGGLE_KEY'] : '';
                $rk = isset($frow['ROW_KEY']) ? (string)$frow['ROW_KEY'] : '';
                $fv = isset($frow['FIELD_VALUE']) ? (string)$frow['FIELD_VALUE'] : '';
                if ($fk === '' || $fv === '' || !isset($fieldDefs[$fk])) continue;
                if (defined('JOURNAL_PARK_OPEN') && strpos($rk, JOURNAL_PARK_OPEN) === 0) continue;   // filed under another key
                if ($fieldDefs[$fk]['type'] === 'date') {   // (2026-11-12) a day, as stored; anything else as the page shows it
                    $flbl = (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $fv, $fdm) && checkdate((int)$fdm[2], (int)$fdm[3], (int)$fdm[1])) ? $fv : '(not a date)';
                } else {
                    $flbl = '(unknown option)';   // an id the list no longer has, as the page shows it
                    foreach ($fieldDefs[$fk]['options'] as $fo) { if ($fo['id'] === $fv) { $flbl = $fo['label']; break; } }
                }
                $whoMap[$fk][$rk] = array('field' => $flbl,
                                          'by' => isset($frow['UPDATED_BY']) ? (string)$frow['UPDATED_BY'] : '',
                                          'on' => isset($frow['UPDATED_ON']) ? (string)$frow['UPDATED_ON'] : '');
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
        // Pick lists (2026-11-11): each named by its label upper-cased (NAME_2... beside a column of that name), after
        // the toggles as the page paints them, with its who / when columns ("<LABEL> BY" / "<LABEL> ON") when the report
        // shows them. In whoMeta / whoNames: kind 'field', its who / when entries carrying 'field' => true. fieldOpts,
        // by output name: the options' labels in the list's order, retired ones last (the page's sort and group order),
        // the labels now ('cur') and the old ones ('old' => the label now), all upper-cased as the page reads them.
        $fieldNames = array();
        $fieldOpts = array();
        $fieldDates = array();   // (2026-11-18, daysort) a date column's output name => true
        foreach ($fieldDefs as $fd) {
            $fk = $fd['key'];
            $name = journalUpperKey($fd['label']);
            if ($name === '') $name = journalUpperKey($fk);
            $base = $name; $n = 2;
            while (isset($existing[$name])) { $name = $base . '_' . $n; $n++; }
            $existing[$name] = true;
            $whoMeta[] = array('name' => $name, 'key' => $fk, 'kind' => 'field');
            $whoNames[] = $name;
            $fieldNames[] = $name;
            // (2026-11-12, DATE_SPEC.md DD6) a date column's who / when columns are "<LABEL> SET BY" / "SET ON": "DUE ON"
            // would read as the due day itself
            $fIsDate = ($fd['type'] === 'date');
            $fSfx = $fIsDate ? array('by' => ' SET BY', 'on' => ' SET ON') : array('by' => ' BY', 'on' => ' ON');
            $outByKey[$fk] = array('name' => $name, 'sfx' => $fSfx);
            if ($who) {
                foreach ($fSfx as $fkind => $fsfx) {
                    $fwn = $base . $fsfx; $fwb = $fwn; $fwi = 2;
                    while (isset($existing[$fwn])) { $fwn = $fwb . '_' . $fwi; $fwi++; }
                    $existing[$fwn] = true;
                    $whoMeta[] = array('name' => $fwn, 'key' => $fk, 'kind' => $fkind, 'field' => true);
                    $whoNames[] = $fwn;
                    $outByKey[$fk][$fkind] = $fwn;
                }
            }
            if ($fIsDate) $fieldDates[$name] = true;
            if ($fIsDate) continue;   // no options: its order is the days' own (natural text order, chronological for ISO)
            $fLive = array(); $fRet = array(); $fCur = array(); $fOldMap = array();
            foreach ($fd['options'] as $fo) {
                if ($fo['retired']) $fRet[] = $fo['label']; else $fLive[] = $fo['label'];
                $fCur[journalUpperKey($fo['label'])] = true;
            }
            foreach ($fd['options'] as $fo) {
                foreach ($fo['oldLabels'] as $fol) { $fu = journalUpperKey($fol); if (!isset($fOldMap[$fu])) $fOldMap[$fu] = $fo['label']; }
            }
            $fieldOpts[$name] = array('key' => $fk, 'order' => array_merge($fLive, $fRet), 'cur' => $fCur, 'old' => $fOldMap);
        }
        // The Notes column (2026-10-14): named "NOTES" as the page names it, or NOTES_2... beside a
        // data column of that name; each row's notes flattened as the page's copy does.
        $notesName = null;     // the output column: only with "Include notes in downloads and emails"
        $notesSearch = null;   // the name a search reads them by: whenever row notes are on
        $notesMap = array();
        $notesCount = array(); // row key => number of notes (replies too), as the page counts them
        if ($notesRead) {
            $nr = null;
            // Private notes (2026-11-13, privnote) are left out of every server output - exports, the API,
            // scheduled email, task filters, search - for everyone, their audience included: one email body
            // goes to every recipient, and this resolver's memo is shared across a task's recipients.
            $privCol = function_exists('journalHasPrivateColumn') && journalHasPrivateColumn();
            // (2026-11-18, thrdpriv) ...a WHOLE private thread: the page reads a thread as private when any of its notes is
            // (journalVisibleNotes), and this read left out the flagged notes only - a public reply in a private thread
            // (a flag changed under it, a mixed thread) went out in exports, the API, scheduled email and search. The
            // thread's notes all share its row key, so they are all in this read: the SQL asks for threads with no flagged
            // note, and the rule itself runs over the rows read (journalVisibleNotes, as nobody: no private thread).
            $privThreadSql = "AND NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL p WHERE p.REPORT_ID = j.REPORT_ID AND p.IS_PRIVATE <> 0"
                           . " AND (p.ID = NVL(NULLIF(j.PARENT_ID, 0), j.ID) OR p.PARENT_ID = NVL(NULLIF(j.PARENT_ID, 0), j.ID)))";
            foreach (array(true, false) as $withParent) {   // a table from before threads or attachments has no PARENT_ID / ATTACH_NAME
                try {
                    $nr = queryViaOci8(
                        "SELECT ID, ROW_KEY, NOTE_TEXT, CREATED_BY, AUTHOR_NAME" . ($withParent ? ', PARENT_ID, ATTACH_NAME' : '') . ($privCol ? ', IS_PRIVATE' : '') . ",
                                TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
                           FROM PENUMBRA_JOURNAL j
                          WHERE REPORT_ID = :rid AND SCOPE = 'row' AND ROW_KEY IS NOT NULL" . ($privCol ? " AND NVL(IS_PRIVATE, 0) = 0" : '') . "
                          " . (($privCol && $withParent) ? $privThreadSql : '') . "
                          ORDER BY CREATED_AT ASC, ID ASC",
                        array(':rid' => $reportId));
                    break;
                } catch (Exception $e) {
                    $nr = null;
                    if ($withParent && stripos($e->getMessage(), 'ORA-00904') !== false) continue;
                    $m = 'journal row notes not read - the Notes column is left out this run. ' . $e->getMessage();
                    if (function_exists('log_scheduler')) log_scheduler('  WARNING: ' . $m); else error_log('[penumbra] ' . $m);
                    if (function_exists('journalUnreadCols')) journalUnreadCols(journalUnreadCols() + journalUnreadNames($vo, $existingCols, array('notes')));   // (failclosed)
                    break;
                }
            }
            if (is_array($nr) && $privCol && function_exists('journalVisibleNotes')) $nr = journalVisibleNotes($nr, '');   // (thrdpriv)
            if (is_array($nr)) {
                $byKey = array();
                foreach ($nr as $n) {
                    if (function_exists('journalNoteIsPrivate') && journalNoteIsPrivate($n)) continue;   // (privnote) never out of the page
                    $rk = isset($n['ROW_KEY']) ? (string)$n['ROW_KEY'] : '';
                    if ($rk === '' || (defined('JOURNAL_PARK_OPEN') && strpos($rk, JOURNAL_PARK_OPEN) === 0)) continue;   // filed under another key
                    $byKey[$rk][] = $n;
                }
                foreach ($byKey as $rk => $list) { $notesMap[(string)$rk] = journalNoteCellSafe(journalNotesFlatten($list)); $notesCount[(string)$rk] = count($list); }   // (notemark)
                // A Shared note (2026-11-01, sharednote): the row's note as its own text, as the page reads it.
                if (isset($vo['journalNotesMode']) && $vo['journalNotesMode'] === 'shared') { foreach ($byKey as $rk => $list) $notesMap[(string)$rk] = journalNoteCellSafe(journalSharedNoteText($list)); }   // (notemark)
                $notesSearch = 'NOTES'; $nn = 2;
                while (isset($existing[$notesSearch])) { $notesSearch = 'NOTES_' . $nn; $nn++; }
                $existing[$notesSearch] = true;
                if ($notesOut) $notesName = $notesSearch;
            }
        }
        if (empty($colMeta) && empty($whoMeta) && $notesSearch === null) return null;

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

        // A pick list's names as a toggle's (2026-11-11): its label's ASCII-only forms, and a renamed list's old names
        // (viewOptions.journalFields[].oldLabels) with their who / when columns. Twin: main.js journalSearchCols.
        foreach ($fieldDefs as $fd) {
            $fk = $fd['key'];
            if (!isset($outByKey[$fk])) continue;
            $fpairs = array();
            $fsx = $outByKey[$fk]['sfx'];   // (2026-11-12) ' BY' / ' ON', or a date column's ' SET BY' / ' SET ON'
            $fu = journalUpperKey(trim($fd['label']));
            if ($fu !== '') {
                foreach ($asciiForms($fd['label']) as $fa) {
                    if ($fa === $fu) continue;
                    $fpairs[$fa] = $fu;
                    if (isset($outByKey[$fk]['by']) && $outByKey[$fk]['by'] === $fu . $fsx['by']) $fpairs[$fa . $fsx['by']] = $fu . $fsx['by'];
                    if (isset($outByKey[$fk]['on']) && $outByKey[$fk]['on'] === $fu . $fsx['on']) $fpairs[$fa . $fsx['on']] = $fu . $fsx['on'];
                }
            }
            foreach ($fd['oldLabels'] as $fol) {
                foreach (array_unique(array_merge(array(journalUpperKey(trim((string)$fol))), $asciiForms($fol))) as $fa) {
                    if ($fa === '' || $fa === 'NOTES' || isset($fpairs[$fa])) continue;
                    $fpairs[$fa] = $outByKey[$fk]['name'];
                    if (isset($outByKey[$fk]['by'])) $fpairs[$fa . $fsx['by']] = $outByKey[$fk]['by'];
                    if (isset($outByKey[$fk]['on'])) $fpairs[$fa . $fsx['on']] = $outByKey[$fk]['on'];
                }
            }
            foreach ($fpairs as $fa => $fto) {
                $fa = (string)$fa;   // a numeric-looking name is an INT array key
                if (!isset($existing[$fa]) && !isset($aliasMap[$fa])) $aliasMap[$fa] = (string)$fto;
            }
        }
        $built = array('colNames' => $colNames, 'colMeta' => $colMeta, 'keyUpper' => $keyUpper, 'stateMap' => $stateMap,
                       'whoMeta' => $whoMeta, 'whoNames' => $whoNames, 'whoMap' => $whoMap, 'aliasMap' => $aliasMap,
                       // Kept apart from whoNames: a search or a snippet never reads it (the page's
                       // "Notes" there is a COUNT of notes).
                       'notesName' => $notesName, 'notesMap' => $notesMap,
                       // The search's (2026-10-14): read by journalExportNotesSearchValues().
                       'notesSearch' => $notesSearch, 'notesCount' => $notesCount);
        // The pick lists' output names, and their options by output name (2026-11-11): the task filters' old option
        // labels (penumbra_search.php) and the list's sort order (journalExportFieldSortOrders) read them.
        $built['fieldNames'] = $fieldNames;
        $built['fieldOpts'] = $fieldOpts;
        // (2026-11-18, daysort) ...and the date columns' names: the scheduled sort orders their days as the page does,
        // a value that is not a day after the days (schedule_runner.php penumbra_sched_sort_rows).
        $built['fieldDates'] = $fieldDates;
        // (2026-11-18, failclosed) the pick lists' or notes' names this call could not read: a memo hit sets them again
        $built['unread'] = function_exists('journalUnreadCols') ? journalUnreadCols() : array();
        if ($memoOn) $GLOBALS['penumbra_jt_unread_memo'][$memoKey] = $built['unread'];
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
        $rk = journalExportRowKey($resolver, $row);
        // (2026-11-17, dupkeys) A key more than one row of this output shares (journalExportToggleColumns counts them): its
        // marks, values and notes belong to no one row. The page hides the columns then ("N rows share a key"); the API
        // and the scheduled output marked every such row alike. Such a row reads blank here.
        if (!empty($resolver['dupKeys']) && isset($resolver['dupKeys'][$rk])) {
            foreach ($resolver['colMeta'] as $cm) $out[$cm['name']] = '';
            if ($withWho && !empty($resolver['whoMeta'])) { foreach ($resolver['whoMeta'] as $wm) $out[$wm['name']] = ''; }
            if ($withWho && !empty($resolver['notesName'])) $out[$resolver['notesName']] = '';
            return $out;
        }
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
        // The row's notes as text (2026-10-14), with the who / when values: a snapshot takes none.
        if ($withWho && !empty($resolver['notesName'])) {
            $out[$resolver['notesName']] = isset($resolver['notesMap'][$rk]) ? (string)$resolver['notesMap'][$rk] : '';
        }
        return $out;
    }
}

if (!function_exists('journalExportNotesSearchValues')) {
function journalExportNotesSearchValues($resolver, $row) {
        if (!is_array($resolver) || empty($resolver['notesSearch']) || !is_array($row)) return array();
        $rk = journalExportRowKey($resolver, $row);
        return array(
            (string)$resolver['notesSearch'] => isset($resolver['notesMap'][$rk]) ? (string)$resolver['notesMap'][$rk] : '',
            JOURNAL_NOTES_COUNT_KEY => (string)(isset($resolver['notesCount'][$rk]) ? (int)$resolver['notesCount'][$rk] : 0),
        );
    }
}

if (!function_exists('journalExportRowKey')) {
function journalExportRowKey($resolver, $row) {
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
        return implode($sep, $parts);
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
        // (2026-11-18, chgfields) ...and the pick-list and date columns the running task names in its change columns
        return function_exists('journalAddNamedFields') ? journalAddNamedFields($rows, $apiResult) : $rows;
    }
}

if (!function_exists('journalTaskChangeCols')) {
function journalTaskChangeCols($set = false) {
        static $cols = null;
        if ($set !== false) $cols = is_array($set) ? $set : null;
        return $cols;
    }
}

if (!function_exists('journalWatchedColOf')) {
function journalWatchedColOf($name, $resolver) {
        if (!is_array($resolver)) return null;
        $s = trim((string)$name);
        if ($s === '') return null;
        $to = function_exists('journalExportCanonicalCol') ? journalExportCanonicalCol($s, $resolver) : null;
        $u = journalUpperKey($to !== null ? $to : $s);
        if (!empty($resolver['whoMeta']) && is_array($resolver['whoMeta'])) {
            foreach ($resolver['whoMeta'] as $wm) {
                if (!is_array($wm) || !isset($wm['kind'], $wm['name'], $wm['key']) || $wm['kind'] === 'field') continue;
                if (journalUpperKey((string)$wm['name']) !== $u) continue;
                foreach ($resolver['whoMeta'] as $fm) {   // a pick list's or a date column's who / when: the field
                    if (is_array($fm) && isset($fm['kind'], $fm['key'], $fm['name']) && $fm['kind'] === 'field' && (string)$fm['key'] === (string)$wm['key']) return journalUpperKey((string)$fm['name']);
                }
                if (!empty($resolver['colMeta'])) {
                    foreach ($resolver['colMeta'] as $cm) { if ((string)$cm['key'] === (string)$wm['key']) return journalUpperKey((string)$cm['name']); }
                }
            }
        }
        return $u;
    }
}

if (!function_exists('journalNamedToggleCols')) {
function journalNamedToggleCols($resolver, $cols) {
        $out = array();
        if (!is_array($resolver) || !is_array($cols) || empty($resolver['colMeta']) || !is_array($resolver['colMeta'])) return $out;
        $tg = array();
        foreach ($resolver['colMeta'] as $cm) { if (is_array($cm) && isset($cm['name'], $cm['key'])) $tg[journalUpperKey((string)$cm['name'])] = $cm; }
        $want = array(); $skip = array();
        foreach ($cols as $c) {
            if (!is_scalar($c)) continue;
            $s = trim((string)$c);
            $ign = ($s !== '' && $s[0] === '!');
            if ($ign) $s = ltrim(substr($s, 1));
            $u = journalWatchedColOf($s, $resolver);
            if ($u === null || !isset($tg[$u])) continue;
            if ($ign) $skip[$u] = true; else $want[$u] = true;
        }
        foreach ($want as $u => $t) { if (!isset($skip[$u])) $out[(string)$tg[$u]['name']] = (string)$tg[$u]['key']; }
        return $out;
    }
}

if (!function_exists('journalNamedFieldCols')) {
function journalNamedFieldCols($resolver, $cols) {
        $out = array();
        if (!is_array($resolver) || !is_array($cols) || empty($resolver['whoMeta']) || !is_array($resolver['whoMeta'])) return $out;
        $fields = array();
        foreach ($resolver['whoMeta'] as $wm) {
            if (is_array($wm) && isset($wm['kind'], $wm['name'], $wm['key']) && $wm['kind'] === 'field') $fields[journalUpperKey((string)$wm['name'])] = $wm;
        }
        if (!$fields) return $out;
        $want = array(); $skip = array();
        foreach ($cols as $c) {
            if (!is_scalar($c)) continue;
            $s = trim((string)$c);
            $ign = ($s !== '' && $s[0] === '!');
            if ($ign) $s = ltrim(substr($s, 1));
            if ($s === '') continue;
            $to = function_exists('journalExportCanonicalCol') ? journalExportCanonicalCol($s, $resolver) : null;
            $u = journalUpperKey($to !== null ? $to : $s);
            if (!isset($fields[$u]) && function_exists('journalWatchedColOf')) $u = (string)journalWatchedColOf($s, $resolver);   // (chgtoggle) "STATUS BY" = STATUS
            if (!isset($fields[$u])) continue;
            if ($ign) $skip[$u] = true; else $want[$u] = true;
        }
        foreach ($want as $u => $t) {
            if (!isset($skip[$u])) $out[(string)$fields[$u]['name']] = (string)$fields[$u]['key'];
        }
        return $out;
    }
}

if (!function_exists('journalAddNamedFields')) {
function journalAddNamedFields($rows, $from) {
        $res = (is_array($from) && isset($from['journalToggleResolver'])) ? $from['journalToggleResolver'] : $from;
        if (!is_array($rows) || !$rows || !is_array($res)) return $rows;
        $named = journalNamedFieldCols($res, journalTaskChangeCols());
        // (2026-11-18, chgtoggle) ...and the toggle columns it names: a watched toggle the saved layout hides was in no row a
        // signature read (the processed rows lost it, the unprocessed ones never carry one), so "Skip if no changes"
        // skipped every run whatever was ticked. '1' / '0' as the output has them ('' for a key rows share).
        $namedT = function_exists('journalNamedToggleCols') ? journalNamedToggleCols($res, journalTaskChangeCols()) : array();
        if (!$named && !$namedT) return $rows;
        foreach ($rows as $i => $r) {
            if (!is_array($r)) continue;
            $rk = journalExportRowKey($res, $r);
            $dup = !empty($res['dupKeys']) && isset($res['dupKeys'][$rk]);
            foreach ($named as $name => $fk) {
                $w = (!$dup && isset($res['whoMap'][$fk]) && isset($res['whoMap'][$fk][$rk])) ? $res['whoMap'][$fk][$rk] : null;
                $rows[$i][$name] = ($w && isset($w['field'])) ? (string)$w['field'] : '';
            }
            foreach ($namedT as $name => $tk) {
                $rows[$i][$name] = $dup ? '' : ((isset($res['stateMap'][$tk]) && isset($res['stateMap'][$tk][$rk])) ? '1' : '0');
            }
        }
        return $rows;
    }
}

if (!function_exists('journalStripWhoCols')) {
function journalStripWhoCols($rows, $from) {
        $res = (is_array($from) && isset($from['journalToggleResolver'])) ? $from['journalToggleResolver'] : $from;
        if (!is_array($rows) || !is_array($res)) return $rows;
        $drop = array();
        if (!empty($res['whoNames']) && is_array($res['whoNames'])) { foreach ($res['whoNames'] as $n) $drop[strtoupper((string)$n)] = true; }
        // The Notes column too (2026-10-14): a new note is not a change in the data.
        if (!empty($res['notesName'])) $drop[strtoupper((string)$res['notesName'])] = true;
        // (2026-11-18, chgfields) ...but a pick-list or date column the running task names in its change columns stays
        if (function_exists('journalNamedFieldCols') && function_exists('journalTaskChangeCols')) {
            foreach (journalNamedFieldCols($res, journalTaskChangeCols()) as $kn => $kk) unset($drop[strtoupper((string)$kn)]);
        }
        if (!$drop) return $rows;
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
        if (!is_array($criteria) || !is_array($resolver) || (empty($resolver['colMeta']) && empty($resolver['whoMeta']))) return $criteria;
        $map = array();
        foreach ($resolver['colMeta'] as $cm) $map[strtoupper('__JOURNAL_TOGGLE__' . $cm['key'])] = (string)$cm['name'];
        if (!empty($resolver['whoMeta'])) {
            // ...and a pick list's (2026-11-11): kind 'field', __JOURNAL_FIELD__<key>.
            foreach ($resolver['whoMeta'] as $wm) $map[strtoupper(($wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : ($wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . $wm['key'])] = (string)$wm['name'];
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
        if (!is_array($resolver) || (empty($resolver['colMeta']) && empty($resolver['whoMeta'])) || !is_string($groupBy)) return $groupBy;
        $byKey = array();
        foreach ($resolver['colMeta'] as $cm) $byKey[strtolower((string)$cm['key'])] = $cm['name'];
        $byWho = array();
        if (!empty($resolver['whoMeta'])) {
            // ...and a pick list's, __JOURNAL_FIELD__<key> (2026-11-11).
            foreach ($resolver['whoMeta'] as $wm) $byWho[strtoupper(($wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : ($wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . $wm['key'])] = $wm['name'];
        }
        $levels = explode(',', $groupBy);
        $changed = false;
        foreach ($levels as $i => $lv) {
            $t = trim($lv);
            $to = null;
            // (2026-11-12, DATE_SPEC.md 3b) a column by a date period (__JOURNAL_FIELD__due:ym): its name, the period kept
            $sfx = '';
            if (!isset($byWho[strtoupper($t)]) && preg_match('/^(.+):(year|fy|yq|fyq|ym|quarter|fquarter|month|monthnum|dow|hour)$/i', $t, $pm)) {
                $t = trim($pm[1]);
                $sfx = ':' . strtolower($pm[2]);
            }
            if (isset($byWho[strtoupper($t)])) $to = (string)$byWho[strtoupper($t)];
            elseif (isset($resolver['aliasMap'][strtoupper($t)])) $to = (string)$resolver['aliasMap'][strtoupper($t)];
            elseif (stripos($t, '__JOURNAL_TOGGLE__') === 0) {
                $k = strtolower(substr($t, strlen('__JOURNAL_TOGGLE__')));
                if (isset($byKey[$k])) $to = (string)$byKey[$k];
            }
            if ($to === null || strpos($to, ',') !== false) continue;
            $levels[$i] = $to . $sfx;
            $changed = true;
        }
        return $changed ? implode(',', array_map('trim', $levels)) : $groupBy;
    }
}

if (!function_exists('journalExportFieldSortOrders')) {
function journalExportFieldSortOrders($customSortOrders, $resolver) {
        $out = is_array($customSortOrders) ? $customSortOrders : array();
        if (!is_array($resolver) || empty($resolver['fieldOpts']) || !is_array($resolver['fieldOpts']) || empty($resolver['whoMeta'])) return $out;
        $have = array();
        foreach ($out as $k => $v) $have[strtoupper((string)$k)] = $k;
        foreach ($resolver['whoMeta'] as $wm) {
            if (!isset($wm['kind']) || $wm['kind'] !== 'field') continue;
            $name = (string)$wm['name'];
            if (isset($have[strtoupper($name)])) continue;
            $own = strtoupper('__JOURNAL_FIELD__' . $wm['key']);
            if (isset($have[$own])) { $out[$name] = $out[$have[$own]]; continue; }
            $fo = isset($resolver['fieldOpts'][$name]) ? $resolver['fieldOpts'][$name] : null;
            if ($fo && !empty($fo['order'])) $out[$name] = array('values' => array_values($fo['order']));
        }
        return $out;
    }
}

if (!function_exists('journalExportFieldOrderCmp')) {
function journalExportFieldOrderCmp($customSortOrders, $resolver, $name) {
        if (!is_array($resolver) || empty($resolver['fieldOpts']) || !is_array($resolver['fieldOpts']) || $name === null || (string)$name === '') return null;
        $want = strtoupper((string)$name);
        $pick = false;
        foreach ($resolver['fieldOpts'] as $fn => $fo) { if (strtoupper((string)$fn) === $want) { $pick = true; break; } }
        if (!$pick) return null;
        $entry = null;
        foreach (journalExportFieldSortOrders($customSortOrders, $resolver) as $k => $e) { if (strtoupper((string)$k) === $want) { $entry = $e; break; } }
        if (!is_array($entry) || empty($entry['values']) || !is_array($entry['values'])) return null;
        $values = array_values($entry['values']);
        $orderMap = array();
        foreach ($values as $i => $v) { $k = strtolower(trim((string)$v)); if (!isset($orderMap[$k])) $orderMap[$k] = $i; }   // first one wins
        $maxIndex = count($values);
        return function ($a, $b) use ($orderMap, $maxIndex) {
            $al = strtolower(trim((string)$a)); $bl = strtolower(trim((string)$b));
            $ai = isset($orderMap[$al]) ? $orderMap[$al] : $maxIndex;
            $bi = isset($orderMap[$bl]) ? $orderMap[$bl] : $maxIndex;
            if ($ai !== $bi) return ($ai < $bi) ? -1 : 1;
            if ($ai === $maxIndex) return strnatcasecmp((string)$a, (string)$b);
            return 0;
        };
    }
}

if (!function_exists('journalExportDupKeys')) {
function journalExportDupKeys($resolver, $rows) {
        $seenK = array(); $dupK = array();
        if (!is_array($resolver) || empty($resolver['keyUpper']) || !is_array($rows)) return $dupK;
        foreach ($rows as $r0) {
            if (!is_array($r0)) continue;
            $k0 = journalExportRowKey($resolver, $r0);
            if (str_replace("\xE2\x90\x9F", '', $k0) === '') continue;
            if (isset($seenK[$k0])) $dupK[$k0] = true; else $seenK[$k0] = true;
        }
        return $dupK;
    }
}

if (!function_exists('journalExportInternalNameMap')) {
function journalExportInternalNameMap($resolver) {
        $map = array();
        if (!is_array($resolver)) return $map;
        if (!empty($resolver['colMeta'])) foreach ($resolver['colMeta'] as $cm) $map[strtoupper('__JOURNAL_TOGGLE__' . $cm['key'])] = (string)$cm['name'];
        if (!empty($resolver['whoMeta'])) {
            foreach ($resolver['whoMeta'] as $wm) {
                $map[strtoupper(($wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : ($wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . $wm['key'])] = (string)$wm['name'];
            }
        }
        if (!empty($resolver['notesName'])) $map['__JOURNAL_NOTES'] = (string)$resolver['notesName'];
        return $map;
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
        // The Notes column (2026-10-14) rides with the who / when columns: kept at the end through
        // a reorder or a re-filter, and stripped from a DB dump - the callers' lists are these.
        if (!empty($resolver['notesName'])) $out['whoNames'][] = $resolver['notesName'];
        // (2026-11-17, dupkeys) The keys more than one row of the output shares: journalExportToggleRowValues reads them blank.
        // (2026-11-18, pvdupkeys) Counted by journalExportDupKeys, which the scheduled pivot's resolver shares.
        $resolver['dupKeys'] = journalExportDupKeys($resolver, $rows);
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
