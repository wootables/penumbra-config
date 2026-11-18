<?php
/**
 * analytics_shared.php - machinery common to the two analytics pages.
 *
 * Included by:
 *   analytics.php      (per-report)
 *   analytics_all.php  (platform-wide, admin-only)
 *
 * WHY THIS FILE EXISTS: the window parsing, the reveal/filter/export controls
 * and the active-filter chips were built for analytics_all.php first. Copying
 * them into analytics.php would have produced the failure mode this codebase
 * keeps re-learning - two implementations of one behaviour that drift until a
 * fix lands in only one of them (see the snippet engines, the group-agg
 * builders, the runner's pivot builders). One definition, two callers.
 *
 * WHAT IS **NOT** HERE: anything either page does differently on purpose.
 *   - analytics_all reads saved filter prefs from a cookie; analytics.php has
 *     no prefs at all. Hence the $prefOr callable. (The cookie's reader is
 *     here since 2026-10-01 only so the report page's "Platform Metrics" crumb
 *     can hand back the one Platform-only checkbox - see
 *     penumbra_an_platform_prefs().)
 *   - analytics_all filters by user/report and drives a <form>; analytics.php
 *     is scoped to one REPORT_ID and drives plain URL params. Hence the two JS
 *     seams (penumbraSubmitFilters / penumbraClearFilter) that each page
 *     implements for itself.
 *
 * CONTRACT FOR THE SHARED JS (each page MUST define both before the shared
 * block runs, or the controls are inert):
 *   window.penumbraSubmitFilters(extraParams)  navigate, merging extraParams
 *   window.penumbraClearFilter(key)            reset one filter, then navigate
 */

// ===========================================================================
// Window parsing: presets, custom range, comparison window, weekday/hour scope
// ===========================================================================

/**
 * Validate a YYYY-MM-DD string.
 *
 * Strict pattern + checkdate() is what lets every date below be INLINED into
 * SQL as a TO_DATE literal instead of bound. That matters because these
 * fragments ride into ~15 queries, several of them inside COUNT(CASE WHEN ...),
 * and a placeholder bound to a query that does not contain it is ORA-01036 -
 * which the per-query catch blocks swallow into a silently empty card.
 */
function penumbra_an_ymd_ok($s)
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string)$s, $m)) return false;
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}

/**
 * Parse every time-related filter into one state array.
 *
 * @param array    $get     usually $_GET
 * @param callable $prefOr  function($key, $default) - saved-preference lookup.
 *                          Pass a function that always returns $default when
 *                          the page has no preference store.
 * @param array    $opts    'alias'          => table alias for the *A variants
 *                                              (default 'a')
 *                          'trendDailyMax'  => days before the trend switches
 *                                              to monthly buckets (default 120)
 *                          'last24h'        => also accept range=24h, the one
 *                                              ROLLING window (default false).
 *                                              Opt in only if the page draws
 *                                              the hourly trend - see below.
 * @return array
 *
 * Returned keys are documented where they are built, below. The important
 * invariants:
 *   - timeFilter / timeFilterA are the ONLY definition of "the window". Both
 *     ends are CALENDAR-DAY aligned, never rolling SYSDATE-N: the trend buckets
 *     by TRUNC(TIMESTAMP), so a rolling "last N*24 hours" makes the chart's bars
 *     sum to something other than the KPI card above them (a 7d window cuts
 *     today's bar off at the current clock time and steals part of day 8).
 *     The single exception is range=24h ("Last 24 hours", opt-in): it means
 *     exactly SYSDATE-1 .. now, and the page buckets it by clock HOUR
 *     (penumbra_an_hour_axis()), keeping the partial first and last hours, so
 *     the bars still sum to the card. A page with only a daily trend must not
 *     opt in: one TRUNC(TIMESTAMP) bar per day cannot hold a rolling window.
 *   - priorFilter is EITHER the automatic preceding equal-length window OR the
 *     admin's chosen comparison window. Callers do not need to know which: the
 *     KPI mega-query already computes a second set of counts through it in the
 *     same round trip, so a comparison costs zero extra queries.
 *   - whenFilter is orthogonal to both and belongs in the WHERE clause, never
 *     inside a COUNT(CASE WHEN ...).
 */
function penumbra_an_parse_window($get, $prefOr, $opts = array())
{
    $alias         = isset($opts['alias']) ? $opts['alias'] : 'a';
    $TREND_DAILY_MAX = isset($opts['trendDailyMax']) ? (int)$opts['trendDailyMax'] : 120;
    $col  = 'TIMESTAMP';
    $colA = $alias . '.TIMESTAMP';

    // ---- Range ------------------------------------------------------------
    // '24h' only when the caller opted in: a page that did not would parse it
    // and then draw a daily trend that cannot hold it (see the invariants).
    // (2026-11-17, metricsweep) ?range[]=x reached trim() as an array and the
    // page died with a blank 500. Anything that is not a string is "not sent".
    foreach (array('range', 'from', 'to', 'cfrom', 'cto', 'dow', 'hour') as $gk) {
        if (isset($get[$gk]) && !is_string($get[$gk])) unset($get[$gk]);
    }
    $rangeAllowed = array('7','30','90','all','custom');
    if (!empty($opts['last24h'])) $rangeAllowed[] = '24h';
    $rangeParam = isset($get['range']) ? strtolower(trim($get['range'])) : (string)$prefOr('range', '30');
    // A plain day count the menu does not offer (?range=1, ?range=14) used to
    // become 30 days without a word. It is now that many days ending today,
    // shown as the custom range it is.
    if (isset($get['range']) && !in_array($rangeParam, $rangeAllowed, true)
        && ctype_digit($rangeParam) && (int)$rangeParam >= 1 && (int)$rangeParam <= 3660) {
        $rdNoon = strtotime(date('Y-m-d') . ' 12:00:00');
        $get['to']   = date('Y-m-d', $rdNoon);
        $get['from'] = date('Y-m-d', strtotime('-' . ((int)$rangeParam - 1) . ' days', $rdNoon));
        $rangeParam  = 'custom';
    }
    if (!in_array($rangeParam, $rangeAllowed, true)) $rangeParam = '30';
    $isLast24h = ($rangeParam === '24h');

    // ---- Custom range (both endpoints INCLUSIVE) --------------------------
    // An incomplete or malformed pair falls back to the 30-day default rather
    // than rendering an empty page: "custom with nothing typed yet" is the
    // normal state the instant the option is selected.
    $customFrom = ''; $customTo = '';
    if ($rangeParam === 'custom') {
        $rawFrom = isset($get['from']) ? trim($get['from']) : (string)$prefOr('from', '');
        $rawTo   = isset($get['to'])   ? trim($get['to'])   : (string)$prefOr('to', '');
        if (penumbra_an_ymd_ok($rawFrom) && penumbra_an_ymd_ok($rawTo)) {
            // YYYY-MM-DD sorts lexicographically, so this also fixes a pair
            // typed backwards instead of returning zero rows and looking broken.
            if (strcmp($rawFrom, $rawTo) > 0) { $sw = $rawFrom; $rawFrom = $rawTo; $rawTo = $sw; }
            $customFrom = $rawFrom;
            $customTo   = $rawTo;
            // (2026-11-17, metricsweep) A "to" past today is today. The days
            // that have not happened yet made the window longer than its data,
            // so every delta compared 17 days with a full 30 and the trend drew
            // a tail of empty days. A range wholly in the future is left alone.
            $ymdToday = date('Y-m-d');
            if (strcmp($customTo, $ymdToday) > 0 && strcmp($customFrom, $ymdToday) <= 0) $customTo = $ymdToday;
        } else {
            $rangeParam = '30';
        }
    }
    // Values for the date INPUTS, which are NOT the values that build SQL:
    // these stay populated while a preset is selected so switching back to
    // "Custom range" restores the last window instead of two empty boxes.
    $formFrom = $customFrom;
    $formTo   = $customTo;
    if ($formFrom === '' && $formTo === '') {
        $kf = isset($get['from']) ? trim($get['from']) : (string)$prefOr('from', '');
        $kt = isset($get['to'])   ? trim($get['to'])   : (string)$prefOr('to', '');
        if (penumbra_an_ymd_ok($kf)) $formFrom = $kf;
        if (penumbra_an_ymd_ok($kt)) $formTo   = $kt;
    }

    // Timestamps are anchored at NOON so no date-only step can be shifted by a
    // DST transition (a midnight anchor minus N days can land at 23:00 the day
    // before).
    $customStartTs = ($rangeParam === 'custom') ? strtotime($customFrom . ' 12:00:00') : null;
    $customEndTs   = ($rangeParam === 'custom') ? strtotime($customTo   . ' 12:00:00') : null;

    if ($rangeParam === 'custom') {
        $windowDays      = (int)round(($customEndTs - $customStartTs) / 86400) + 1;
        $rangeLabelLong  = date('M j, Y', $customStartTs) . ' - ' . date('M j, Y', $customEndTs);
        $rangeLabelShort = date('M j', $customStartTs) . ' - ' . date('M j', $customEndTs);
    } elseif ($isLast24h) {
        // A length of 1, not null: null means ALL-TIME to every caller (no
        // prior window, no deltas), and this window has both.
        $windowDays      = 1;
        $rangeLabelLong  = 'Last 24 hours';
        $rangeLabelShort = '24h';
    } else {
        $windowDays      = ($rangeParam === 'all') ? null : (int)$rangeParam;
        $rangeLabelLong  = ($rangeParam === 'all') ? 'All time' : 'Last ' . $windowDays . ' days';
        $rangeLabelShort = ($rangeParam === 'all') ? 'all-time' : $windowDays . 'd';
    }
    // "vs the prior Jul 1 - Jul 31" is nonsense; say the length instead.
    $priorLabel = ($rangeParam === 'custom') ? $windowDays . ' days' : $rangeLabelShort;

    // ---- Window SQL -------------------------------------------------------
    // $windowEndLit: the window's exclusive END as SQL, or '' when the window
    // runs up to now (every preset, 24h, all-time). Only a custom range can end
    // in the past - and a list of REPORTS (not of events) must then also drop
    // the reports that did not exist yet, or "no views in the window" lists
    // everything created after it.
    $windowEndLit = '';
    if ($rangeParam === 'custom') {
        $fromLit   = "TO_DATE('" . $customFrom . "','YYYY-MM-DD')";
        $toLitExcl = "TO_DATE('" . $customTo   . "','YYYY-MM-DD')+1";
        $timeFilter  = 'AND ' . $col  . ' >= ' . $fromLit . ' AND ' . $col  . ' < ' . $toLitExcl;
        $timeFilterA = 'AND ' . $colA . ' >= ' . $fromLit . ' AND ' . $colA . ' < ' . $toLitExcl;
        $priorFilter = 'AND ' . $col . ' < ' . $fromLit . ' AND ' . $col . ' >= ' . $fromLit . '-' . (int)$windowDays;
        // (2026-11-17, metricsweep3) A range that ends TODAY holds only part of
        // today, so its prior window stops at the same time of day on its own
        // last day: N-1 days and a morning against N-1 days and a morning, not
        // against N full days.
        if ($customTo === date('Y-m-d')) {
            $priorFilter = 'AND ' . $col . ' < ' . $fromLit . '-1+(SYSDATE-TRUNC(SYSDATE)) AND ' . $col . ' >= ' . $fromLit . '-' . (int)$windowDays;
        }
        $windowEndLit = $toLitExcl;
    } elseif ($isLast24h) {
        // Exactly the last 24 hours by the DATABASE clock - the clock that
        // stamps TIMESTAMP (a column default) - so PHP/Oracle skew cannot shift
        // it. The prior window is the 24 hours before that, the same length to
        // the second. DATE arithmetic is wall-clock: SYSDATE-1 is this time
        // yesterday, even across a DST change.
        $timeFilter  = 'AND ' . $col  . ' >= SYSDATE-1';
        $timeFilterA = 'AND ' . $colA . ' >= SYSDATE-1';
        $priorFilter = 'AND ' . $col . ' < SYSDATE-1 AND ' . $col . ' >= SYSDATE-2';
    } elseif ($windowDays === null) {
        $timeFilter = ''; $timeFilterA = ''; $priorFilter = '';
    } else {
        $timeFilter  = 'AND ' . $col  . ' >= TRUNC(SYSDATE)-' . ($windowDays - 1);
        $timeFilterA = 'AND ' . $colA . ' >= TRUNC(SYSDATE)-' . ($windowDays - 1);
        // (2026-11-17, metricsweep3) The prior window ends at THIS time of day,
        // N days ago: the current window is N-1 days plus today so far, and it
        // used to be compared with N whole days, so every delta read low until
        // the evening (at 1 pm: +80% where the like-for-like figure was +113%).
        $priorFilter = 'AND ' . $col . ' <  SYSDATE-' . $windowDays
                     . ' AND ' . $col . ' >= TRUNC(SYSDATE)-' . ($windowDays * 2 - 1);
    }

    // Trend bucketing: one bar per HOUR for the rolling 24h window, one per DAY
    // while the window is short enough to read, one per MONTH beyond that (and
    // for all-time, which has no length). At most one of the two flags is set.
    $trendHourly = $isLast24h;
    $trendDaily  = (!$trendHourly && $windowDays !== null && $windowDays <= $TREND_DAILY_MAX);
    // End of the trend's daily axis: today for the presets, the "to" date for a
    // custom range. Without this the daily loop always walks back from TODAY and
    // a historical custom window charts the wrong days.
    $trendEndTs    = ($rangeParam === 'custom') ? $customEndTs : strtotime(date('Y-m-d') . ' 12:00:00');
    // The first DAY of the window. None for all-time, and none for 24h, which
    // does not start on a day boundary (nothing may step back from it by days).
    $windowStartTs = ($windowDays === null || $isLast24h) ? null : strtotime('-' . ($windowDays - 1) . ' days', $trendEndTs);

    // ---- Comparison window ------------------------------------------------
    // The hidden filter_submitted marker is what makes the checkbox untickable:
    // an UNCHECKED box posts nothing at all, so without it "the admin just
    // unticked Compare" is indistinguishable from "first load" and the saved
    // preference ticks it straight back on.
    $formSubmitted = isset($get['filter_submitted']);
    $cmpOn = false; $cmpFrom = ''; $cmpTo = ''; $cmpStartTs = null; $cmpEndTs = null; $cmpDays = 0;
    // (2026-11-17, metricsweep2) An explicit ?cmp= means what it says even on a
    // link built by hand, without the form's marker (it used to be dropped).
    $cmpRequested = $formSubmitted ? isset($get['cmp'])
                  : (isset($get['cmp']) ? ((string)$get['cmp'] !== '0' && (string)$get['cmp'] !== '') : (bool)$prefOr('cmp', false));
    $cmpRawFrom   = isset($get['cfrom']) ? trim($get['cfrom']) : (string)$prefOr('cfrom', '');
    $cmpRawTo     = isset($get['cto'])   ? trim($get['cto'])   : (string)$prefOr('cto', '');
    $cmpFormFrom  = penumbra_an_ymd_ok($cmpRawFrom) ? $cmpRawFrom : '';
    $cmpFormTo    = penumbra_an_ymd_ok($cmpRawTo)   ? $cmpRawTo   : '';
    // $cmpPaused: a comparison the admin chose, NOT applied because the window
    // is 24h. A comparison window is whole days; 24h already has an exact prior
    // (the 24 hours before it) and an hourly trend that a day-aligned overlay
    // could not sit under. Paused rather than dropped: the page keeps carrying
    // the choice, so the next day-based range picks it straight back up.
    $cmpPaused = false;
    if ($isLast24h) {
        $cmpPaused = ($cmpRequested && $cmpFormFrom !== '' && $cmpFormTo !== '');
    } elseif ($cmpRequested && $cmpFormFrom !== '' && $cmpFormTo !== '') {
        $cmpFrom = $cmpFormFrom; $cmpTo = $cmpFormTo;
        if (strcmp($cmpFrom, $cmpTo) > 0) { $sw = $cmpFrom; $cmpFrom = $cmpTo; $cmpTo = $sw; }
        $cmpStartTs = strtotime($cmpFrom . ' 12:00:00');
        $cmpEndTs   = strtotime($cmpTo   . ' 12:00:00');
        $cmpDays    = (int)round(($cmpEndTs - $cmpStartTs) / 86400) + 1;
        $cmpOn      = true;
        $cFromLit   = "TO_DATE('" . $cmpFrom . "','YYYY-MM-DD')";
        $cToLitExcl = "TO_DATE('" . $cmpTo   . "','YYYY-MM-DD')+1";
        $priorFilter = 'AND ' . $col . ' >= ' . $cFromLit . ' AND ' . $col . ' < ' . $cToLitExcl;
        $priorLabel  = date('M j, Y', $cmpStartTs) . ' - ' . date('M j, Y', $cmpEndTs);
    }
    // Comparison quick presets, computed off the MAIN window so they always
    // mean something relative to what is on screen. Absent for all-time, which
    // has no length to step back by.
    $cmpPresets = array();
    if ($windowStartTs !== null) {
        $prevEnd   = strtotime('-1 day', $windowStartTs);
        $prevStart = strtotime('-' . ($windowDays - 1) . ' days', $prevEnd);
        $cmpPresets['Previous period'] = array(date('Y-m-d', $prevStart), date('Y-m-d', $prevEnd));
        $cmpPresets['Same period last year'] = array(
            date('Y-m-d', strtotime('-1 year', $windowStartTs)),
            date('Y-m-d', strtotime('-1 year', $trendEndTs))
        );
    }

    // ---- Weekday / hour scope (the heatmap's click-through) ---------------
    // TRIM + UPPER on TO_CHAR(...,'DY') because the format is NLS-dependent and
    // pads to the longest day name under some settings.
    $DOW_KEYS   = array('MON','TUE','WED','THU','FRI','SAT','SUN');
    $DOW_LABELS = array('MON'=>'Mon','TUE'=>'Tue','WED'=>'Wed','THU'=>'Thu','FRI'=>'Fri','SAT'=>'Sat','SUN'=>'Sun');
    $dowParam = isset($get['dow']) ? strtoupper(trim($get['dow'])) : '';
    if (!in_array($dowParam, $DOW_KEYS, true)) $dowParam = '';
    $hourParam = '';
    if (isset($get['hour']) && trim($get['hour']) !== '' && ctype_digit(trim($get['hour']))) {
        $h = (int)trim($get['hour']);
        if ($h >= 0 && $h <= 23) $hourParam = (string)$h;
    }
    $whenFilter = ''; $whenFilterA = ''; $whenLabel = '';
    if ($dowParam !== '') {
        $whenFilter  .= " AND UPPER(TRIM(TO_CHAR(" . $col  . ", 'DY'))) = '" . $dowParam . "'";
        $whenFilterA .= " AND UPPER(TRIM(TO_CHAR(" . $colA . ", 'DY'))) = '" . $dowParam . "'";
    }
    if ($hourParam !== '') {
        $hh = str_pad($hourParam, 2, '0', STR_PAD_LEFT);
        $whenFilter  .= " AND TO_CHAR(" . $col  . ", 'HH24') = '" . $hh . "'";
        $whenFilterA .= " AND TO_CHAR(" . $colA . ", 'HH24') = '" . $hh . "'";
    }
    if ($dowParam !== '' || $hourParam !== '') {
        $bits = array();
        if ($dowParam  !== '') $bits[] = $DOW_LABELS[$dowParam];
        if ($hourParam !== '') $bits[] = str_pad($hourParam, 2, '0', STR_PAD_LEFT) . ':00';
        $whenLabel = implode(' ', $bits);
    }

    return compact(
        'rangeParam', 'windowDays', 'rangeLabelLong', 'rangeLabelShort', 'priorLabel',
        'customFrom', 'customTo', 'formFrom', 'formTo', 'customStartTs', 'customEndTs',
        'timeFilter', 'timeFilterA', 'priorFilter', 'windowEndLit',
        'trendDaily', 'trendHourly', 'trendEndTs', 'windowStartTs', 'TREND_DAILY_MAX',
        'cmpOn', 'cmpPaused', 'cmpFrom', 'cmpTo', 'cmpFormFrom', 'cmpFormTo', 'cmpStartTs', 'cmpEndTs', 'cmpDays', 'cmpPresets',
        'dowParam', 'hourParam', 'whenFilter', 'whenFilterA', 'whenLabel',
        'DOW_KEYS', 'DOW_LABELS', 'formSubmitted'
    );
}

/**
 * The parsed window turned back into query parameters, plus the page-level
 * filters both metrics pages read the same way (2026-10-01). A report's metrics
 * is Platform Metrics narrowed to one report, so the move between them keeps
 * what the admin is looking at: a Platform list's report link carries this
 * down, and the report page's sidebar crumb ("Platform Metrics") carries it
 * back up. Before this, the drill-down opened the report on the default 30
 * days whatever window Platform was showing.
 *
 * The round trip is exact: penumbra_an_parse_window() on the result resolves
 * the same window, comparison (a paused one stays paused) and weekday/hour
 * scope as $w, whatever preferences the receiving page has saved, because
 * filter_submitted makes every checkbox mean what the address says. The date
 * boxes' remembered values ride along only when $w has them, so a receiving
 * page keeps its own remembered dates otherwise.
 *
 * @param array $w      penumbra_an_parse_window()'s array
 * @param array $extra  page-level filters, e.g. excl_admins / user / ouc. true
 *                      is sent as '1'; '', null and false drop the key, so a
 *                      caller passes its state without guarding each one.
 * @return array        for http_build_query(); the caller escapes the finished
 *                      URL for its attribute
 */
function penumbra_an_carry_params($w, $extra = array())
{
    $p = array('filter_submitted' => '1', 'range' => (string)$w['rangeParam']);
    if ($w['formFrom'] !== '') $p['from'] = $w['formFrom'];
    if ($w['formTo']   !== '') $p['to']   = $w['formTo'];
    if ($w['cmpOn'] || $w['cmpPaused']) $p['cmp'] = '1';
    if ($w['cmpFormFrom'] !== '') $p['cfrom'] = $w['cmpFormFrom'];
    if ($w['cmpFormTo']   !== '') $p['cto']   = $w['cmpFormTo'];
    if ($w['dowParam']  !== '') $p['dow']  = $w['dowParam'];
    if ($w['hourParam'] !== '') $p['hour'] = $w['hourParam'];
    foreach ($extra as $key => $val) {
        if ($val === null || $val === false || $val === '') continue;
        $p[$key] = ($val === true) ? '1' : (string)$val;
    }
    return $p;
}

/**
 * Platform Metrics' saved filter preferences: the cookie analytics_all.php
 * rewrites on EVERY render, so it always holds what the admin last looked at
 * there. analytics_all.php resolves its filters from it; analytics.php reads it
 * for one thing only - the Platform-only "Hide automation" setting its
 * "Platform Metrics" crumb must hand back (filter_submitted would otherwise
 * switch it off). Never a filter source for analytics.php itself.
 */
function penumbra_an_platform_pref_cookie()
{
    return 'penumbra_an_all_prefs';
}
/**
 * (2026-11-17, metricsweep2) A saved window that was RELATIVE when it was saved
 * stays relative. The cookie holds dates, so "Year to date" picked on Monday
 * came back on Tuesday still ending Monday, and "Previous period" no longer
 * preceded the window it was compared with. 'saved_on' (the day the cookie was
 * written) says what the dates meant that day:
 *   - a window that ended on the day it was saved ends today: This month,
 *     Year to date and Fiscal YTD keep their start rule, anything else keeps
 *     its length;
 *   - "Last month" stays last month;
 *   - a comparison that was the window's Previous period, or the same period a
 *     year before, is re-derived from the window as it now stands.
 * Dates typed by hand that match none of these are left exactly as saved.
 */
function penumbra_an_roll_prefs($p)
{
    // (2026-11-17, metricsweep4) Two gaps closed. (a) 'qr': the quick range's NAME,
    // saved when one was clicked, decides its dates outright - in January "This
    // month" and "Year to date" are the same dates, and guessing from dates
    // turned a saved Year to date into This month. (b) A comparison is re-derived
    // under a PRESET range too ("Last 30 days" + Previous period kept
    // yesterday's dates); it used to be handled only for custom ranges.
    $ok = function ($k) use ($p) { return isset($p[$k]) && is_string($p[$k]) && penumbra_an_ymd_ok($p[$k]); };
    if (!is_array($p) || !$ok('saved_on')) return $p;
    $today = date('Y-m-d');
    $on    = $p['saved_on'];
    if ($on === $today) return $p;
    $noon = function ($ymd) { return strtotime($ymd . ' 12:00:00'); };
    $ymd  = function ($ts)  { return date('Y-m-d', $ts); };
    $days = function ($a, $b) use ($noon) { return (int)round(($noon($b) - $noon($a)) / 86400); };
    $range = isset($p['range']) ? (string)$p['range'] : '';
    // The window as it was on the day it was saved ($from/$to), and as it is now ($nf/$nt).
    if ($range === 'custom') {
        if (!$ok('from') || !$ok('to')) return $p;
        $from = $p['from']; $to = $p['to']; $nf = $from; $nt = $to;
        $quick = penumbra_quick_ranges();
        $fy = function ($ymdStr) { $y = (int)substr($ymdStr, 0, 4); return (((int)substr($ymdStr, 5, 2) >= 7) ? $y : $y - 1) . '-07-01'; };
        $lmOn = strtotime('first day of last month', $noon($on));
        if (isset($p['qr']) && is_string($p['qr']) && isset($quick[$p['qr']])) {
            $nf = $quick[$p['qr']][0]; $nt = $quick[$p['qr']][1];                          // the named quick range, as of today
        } elseif ($to === $on) {
            $nt = $today;
            if     ($from === substr($on, 0, 4) . '-01-01' && substr($on, 5, 2) !== '01') $nf = substr($today, 0, 4) . '-01-01';   // Year to date
            elseif ($from === $fy($on) && substr($on, 5, 2) !== '07') $nf = $fy($today);                                           // Fiscal YTD
            elseif ($from === substr($on, 0, 8) . '01') $nf = substr($today, 0, 8) . '01';                                         // This month
            else $nf = $ymd(strtotime('-' . $days($from, $to) . ' days', $noon($today)));                                          // N days ending today
        } elseif ($from === date('Y-m-01', $lmOn) && $to === date('Y-m-t', $lmOn)) {           // Last month
            $lm = strtotime('first day of last month', $noon($today));
            $nf = date('Y-m-01', $lm); $nt = date('Y-m-t', $lm);
        }
    } elseif (ctype_digit($range) && (int)$range >= 1) {
        $n = (int)$range;
        $from = $ymd(strtotime('-' . ($n - 1) . ' days', $noon($on)));    $to = $on;
        $nf   = $ymd(strtotime('-' . ($n - 1) . ' days', $noon($today))); $nt = $today;
    } else {
        return $p;   // all time, 24 hours: nothing dated to roll
    }
    if (!empty($p['cmp']) && $ok('cfrom') && $ok('cto')) {
        $len = $days($from, $to);
        $prevEnd = $ymd(strtotime('-1 day', $noon($from)));
        if ($p['cto'] === $prevEnd && $p['cfrom'] === $ymd(strtotime('-' . $len . ' days', $noon($prevEnd)))) {
            $nlen = $days($nf, $nt);
            $p['cto']   = $ymd(strtotime('-1 day', $noon($nf)));
            $p['cfrom'] = $ymd(strtotime('-' . $nlen . ' days', $noon($p['cto'])));
        } elseif ($p['cfrom'] === $ymd(strtotime('-1 year', $noon($from))) && $p['cto'] === $ymd(strtotime('-1 year', $noon($to)))) {
            $p['cfrom'] = $ymd(strtotime('-1 year', $noon($nf)));
            $p['cto']   = $ymd(strtotime('-1 year', $noon($nt)));
        }
    }
    if ($range === 'custom') { $p['from'] = $nf; $p['to'] = $nt; }
    return $p;
}
function penumbra_an_platform_prefs()
{
    $name = penumbra_an_platform_pref_cookie();
    // is_string: a client can send name[]=x, which PHP hands over as an array
    // (json_decode() would throw a TypeError on it).
    if (!isset($_COOKIE[$name]) || !is_string($_COOKIE[$name])) return array();
    $decoded = json_decode($_COOKIE[$name], true);
    return is_array($decoded) ? $decoded : array();
}

/**
 * The hourly axis for range=24h: one bucket per clock hour, from the hour the
 * window starts in through the current hour, keyed exactly as the trend query
 * groups: TO_CHAR(TRUNC(TIMESTAMP,'HH24'),'YYYY-MM-DD HH24').
 *
 * The window is SYSDATE-1 .. now, so the FIRST and LAST buckets are partial
 * hours and there are normally 25 of them. Keeping both partial ends is what
 * makes the bars sum to the KPI card; trimming to 24 whole hours would drop up
 * to an hour of the window without saying so. The first label carries the
 * minute the window opens at, so its short bar explains itself.
 *
 * 'prior' is the same wall-clock hour one day earlier: the bucket of the prior
 * window (SYSDATE-2 .. SYSDATE-1) that lines up under this one. Oracle DATE
 * arithmetic is wall-clock, so the step back is strtotime('-1 day'), not 86400
 * seconds - the two differ by an hour across a DST change. It is NULL when that
 * hour never existed (02:00 the day after the spring change: strtotime rolls it
 * to 03:00, which would draw the 03 bucket twice) - the caller draws a gap.
 *
 * Keys are DE-DUPLICATED: on the autumn DST night 01:00-01:59 happens twice and
 * TRUNC(TIMESTAMP,'HH24') folds both into one bucket, which must be drawn once,
 * not twice. (The spring night simply has no 02 bucket.)
 *
 * Two known edges, both cosmetic and confined to the dashed line or one bar:
 *   - on the spring-change day itself the window is 23 real hours but the
 *     prior window is 24, and the prior's 02 bucket has no slot to sit in;
 *   - the axis runs on PHP's clock and the window on Oracle's, so a few seconds
 *     of skew at an hour boundary can strand one bucket's rows off the axis -
 *     the same tolerance the daily trend already accepts at midnight.
 * The KPI cards and their deltas come from SQL and are exact either way.
 *
 * @param int $nowTs  "now"; tests pass a fixed clock
 * @return array  list of array('key' => ..., 'prior' => ...|null, 'label' => ...)
 */
function penumbra_an_hour_axis($nowTs)
{
    $startTs = strtotime('-1 day', $nowTs);
    $axis = array();
    $seen = array();
    for ($t = strtotime(date('Y-m-d H:00:00', $startTs)); $t <= $nowTs; $t += 3600) {
        $key = date('Y-m-d H', $t);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $p = strtotime('-1 day', $t);
        $axis[] = array(
            'key'   => $key,
            'prior' => (date('H', $p) === date('H', $t)) ? date('Y-m-d H', $p) : null,
            'label' => empty($axis) ? date('M j H:i', $startTs) : date('M j H:00', $t),
        );
    }
    return $axis;
}

/**
 * Build the trend overlay series (the dashed "prior"/comparison line).
 *
 * Aligned by POSITION FROM THE END of both windows: day N of the comparison
 * sits under day N of the main one, counting back from each window's last day.
 * That is the only alignment that stays honest when the two windows differ in
 * length.
 *   - comparison SHORTER: leading positions get NULL, which Chart.js draws as a
 *     gap (spanGaps stays false). Filling them with 0 would invent a quiet
 *     stretch that never existed; borrowing earlier days would plot data from
 *     outside the window the admin chose.
 *   - comparison LONGER: only its last $wd days are drawn.
 *
 * @param array $byBucket  'YYYY-MM-DD' => count, from the prior-window query
 * @param int   $wd        length of the MAIN window in days
 * @param array $w         the array returned by penumbra_an_parse_window()
 * @return array
 */
function penumbra_an_overlay_series($byBucket, $wd, $w)
{
    $out = array();
    $overlayEndTs   = $w['cmpOn'] ? $w['cmpEndTs']   : strtotime('-' . $wd . ' days', $w['trendEndTs']);
    $overlayStartTs = $w['cmpOn'] ? $w['cmpStartTs'] : null;
    for ($i = $wd - 1; $i >= 0; $i--) {
        $ts = strtotime("-$i days", $overlayEndTs);
        if ($overlayStartTs !== null && $ts < $overlayStartTs) { $out[] = null; continue; }
        $d = date('Y-m-d', $ts);
        $out[] = isset($byBucket[$d]) ? $byBucket[$d] : 0;
    }
    return $out;
}

// ===========================================================================
// Panel builders shared by both metrics pages (step 2 of folding report
// metrics into Platform Metrics, 2026-10-01). Each page passes its SCOPE as
// a WHERE predicate WITHOUT the window - the report page: its report's OPENs
// (REPORT_ID = :rid AND ACTION='OPEN' ...), Platform: every report under its
// filters (1=1 ... $sysSql ... $reportFilter) - plus exactly that predicate's
// binds (an unused bind is ORA-01036, which the catch would swallow into an
// empty chart). The window comes from the penumbra_an_parse_window() array,
// so a chart can never span a different window than the cards beside it.
// ===========================================================================

/**
 * The trend chart's series: one bar per clock hour for "Last 24 hours" (over
 * $hourAxis - the partial first and last hours are what make the bars sum to
 * the card), one per day while the window is short enough to read (with the
 * prior window, or the chosen comparison, as the dashed overlay - see
 * penumbra_an_overlay_series()), one per month beyond that and for all-time
 * (no overlay). A NULL prior hour is an hour that never existed (DST): a gap
 * in the dashed line, never a borrowed neighbour and never an invented 0.
 *
 * @param callable $run       the page's query helper: ($sql, $binds) -> rows
 * @param string   $where     scope predicate, without the window
 * @param array    $binds     exactly the binds $where holds
 * @param array    $w         penumbra_an_parse_window()'s array
 * @param array    $hourAxis  penumbra_an_hour_axis() for 24h, else array()
 * @param string   $logLabel  page name for the error log line
 * @return array   array($series, $prior, $labels)
 */
function penumbra_an_trend_series($run, $where, $binds, $w, $hourAxis, $logLabel)
{
    $series = array(); $prior = array(); $labels = array();
    $count = function ($bucketSql, $groupSql, $windowSql, $ordered) use ($run, $where, $binds) {
        $rows = $run("SELECT TO_CHAR($bucketSql) AS BUCKET, COUNT(*) AS CNT
                        FROM PENUMBRA_AUDIT
                       WHERE $where $windowSql
                       GROUP BY $groupSql" . ($ordered ? "\n                       ORDER BY 1" : ''), $binds);
        $by = array();
        foreach ($rows as $r) $by[$r['BUCKET']] = (int)$r['CNT'];
        return $by;
    };
    try {
        if ($w['trendHourly']) {
            $by      = $count("TRUNC(TIMESTAMP, 'HH24'), 'YYYY-MM-DD HH24'", "TRUNC(TIMESTAMP, 'HH24')", $w['timeFilter'], false);
            $byPrior = $count("TRUNC(TIMESTAMP, 'HH24'), 'YYYY-MM-DD HH24'", "TRUNC(TIMESTAMP, 'HH24')", $w['priorFilter'], false);
            foreach ($hourAxis as $hb) {
                $series[] = isset($by[$hb['key']]) ? $by[$hb['key']] : 0;
                $prior[]  = ($hb['prior'] === null) ? null
                          : (isset($byPrior[$hb['prior']]) ? $byPrior[$hb['prior']] : 0);
                $labels[] = $hb['label'];
            }
        } elseif ($w['trendDaily']) {
            // Walk back from the window's LAST day (trendEndTs), not from today -
            // a custom range that ends in the past charts its own days.
            $wd = (int)$w['windowDays'];
            $by = $count("TRUNC(TIMESTAMP), 'YYYY-MM-DD'", 'TRUNC(TIMESTAMP)', $w['timeFilter'], false);
            for ($i = $wd - 1; $i >= 0; $i--) {
                $ts = strtotime("-$i days", $w['trendEndTs']);
                $d  = date('Y-m-d', $ts);
                $series[] = isset($by[$d]) ? $by[$d] : 0;
                $labels[] = date('M j', $ts);
            }
            $prior = penumbra_an_overlay_series(
                $count("TRUNC(TIMESTAMP), 'YYYY-MM-DD'", 'TRUNC(TIMESTAMP)', $w['priorFilter'], false), $wd, $w);
        } else {
            // Monthly: all-time ('' window) or a custom range too long for days.
            // (2026-11-17, metricsweep) Every month from the first to the last,
            // empty ones as 0: the axis used to be only the months the query
            // returned, so January and June sat side by side with no gap.
            $by = $count("TRUNC(TIMESTAMP, 'MM'), 'YYYY-MM'", "TRUNC(TIMESTAMP, 'MM')", $w['timeFilter'], true);
            if (!empty($by)) {
                $mKeys  = array_keys($by); sort($mKeys);
                $mFirst = ($w['rangeParam'] === 'custom') ? min(date('Y-m', $w['customStartTs']), $mKeys[0]) : $mKeys[0];
                $mLast  = max(date('Y-m', $w['trendEndTs']), $mKeys[count($mKeys) - 1]);
                $mGuard = 0;
                for ($m = $mFirst; strcmp($m, $mLast) <= 0 && $mGuard < 1200; $m = date('Y-m', strtotime($m . '-01 +1 month')), $mGuard++) {
                    $series[] = isset($by[$m]) ? $by[$m] : 0;
                    $labels[] = $m;   // YYYY-MM
                }
            }
        }
    } catch (Exception $e) {
        error_log("$logLabel trend query failed: " . $e->getMessage());
    }
    return array($series, $prior, $labels);
}

/**
 * The weekday x hour heatmap: counts by TO_CHAR(TIMESTAMP,'DY') x 'HH24'
 * (server-local time). Oracle 'DY' is NLS-dependent; under US NLS it is
 * MON..SUN, and anything else is ignored rather than mis-filed.
 *
 * @param string $where  scope predicate INCLUDING the window (each page
 *                       decides whether its own weekday/hour scope applies:
 *                       the report page's heatmap honours it, Platform's is
 *                       the picker and does not)
 * @return array  array($rows [day 0=Mon][hour] => count, $total)
 */
function penumbra_an_heatmap($run, $where, $binds, $logLabel)
{
    $heat = array_fill(0, 7, array_fill(0, 24, 0));
    $dayOrder = array('MON' => 0, 'TUE' => 1, 'WED' => 2, 'THU' => 3, 'FRI' => 4, 'SAT' => 5, 'SUN' => 6);
    $total = 0;
    try {
        $rows = $run(
            "SELECT TO_CHAR(TIMESTAMP, 'DY')   AS DY,
                    TO_CHAR(TIMESTAMP, 'HH24') AS HR,
                    COUNT(*) AS CNT
               FROM PENUMBRA_AUDIT
              WHERE $where
              GROUP BY TO_CHAR(TIMESTAMP, 'DY'), TO_CHAR(TIMESTAMP, 'HH24')",
            $binds
        );
        foreach ($rows as $r) {
            $dy = strtoupper(trim($r['DY']));
            $hr = (int)$r['HR'];
            if (isset($dayOrder[$dy]) && $hr >= 0 && $hr < 24) {
                $heat[$dayOrder[$dy]][$hr] = (int)$r['CNT'];
                $total += (int)$r['CNT'];
            }
        }
    } catch (Exception $e) {
        error_log("$logLabel heatmap query failed: " . $e->getMessage());
    }
    return array($heat, $total);
}

/**
 * The dashboard-pull detector: OPENs a dashboard embed tile (or a tile's
 * open-in-full link) made, stamped by logPenumbraAudit as
 * {"message":"via dashboard <id>"} inside SOURCE_DATA - the JSON-key anchor
 * cannot false-match a referrer URL that merely contains "dashboard". KNOWN
 * GAP: live JSON tiles (?json=1 value/cell pulls) are not audited at all, so
 * they appear nowhere - neither here nor in Views.
 */
function penumbra_an_dash_like()
{
    return "SOURCE_DATA LIKE '%\"message\":\"via dashboard%'";
}

/**
 * THE COUNTER CATALOG (step 2, increment 2, 2026-10-01): every count either
 * metrics page shows, defined ONCE. A page asks for counters by name under its
 * own column aliases (penumbra_an_counts()), so "views", "unique viewers" or
 * "errors" cannot mean one thing on Platform and another on a report's page.
 *
 * Window-relative counters read the parsed window ($w): the plain name is the
 * window, *_prior the prior window or the chosen comparison. Rules worth
 * keeping:
 *   - 'errors' is the AUTHORITATIVE error total, counted from the canonical
 *     action set (penumbraErrorCondSql(): penumbraErrorActions() minus the
 *     harmless browser aborts of before 2026-09-25). The named buckets
 *     (badpass, denied, timeouts, ...) only feed breakdown lines - summing them
 *     under-counts as soon as the canonical set gains an action, which is what
 *     once made the all-reports Errors badge read 3 against a 9-row list.
 *   - 'sched_*' are SCHEDULER actions only: EMAIL / EMAIL_FAIL ('emails',
 *     'email_fails') are a report's manual Email dialog (query.php log_email);
 *     the runner never writes them, and counting them as runs conjured a Sched
 *     Runs card for reports that were merely emailed by hand (2026-09-04).
 *   - 'views_all' and 'sched_runs_all' ignore the window on purpose (all-time
 *     cards); the run-size aggregates ('sized_runs' ...) too: "how big is this
 *     report" wants every sample, and ROW_COUNT is NULL except on measured
 *     OPENs, which MEDIAN/COUNT(col) already skip.
 *   - 'events' / 'event_users' count every row in scope (the WHERE names the
 *     action): Platform's Home Visits card.
 */
function penumbra_an_counter_sql($name, $w)
{
    $t = $w['timeFilter'];
    $p = $w['priorFilter'];
    $schedFail = "'SCHEDULE_RUN_FAIL','SCHEDULE_FAIL','SCHEDULE_NOAUTH'";
    $schedRun  = "'SCHEDULE_RUN_OK',$schedFail,'SCHEDULE_SKIPPED'";
    switch ($name) {
        case 'views':                return "COUNT(CASE WHEN ACTION='OPEN' $t THEN 1 END)";
        case 'views_prior':          return "COUNT(CASE WHEN ACTION='OPEN' $p THEN 1 END)";
        case 'views_all':            return "COUNT(CASE WHEN ACTION='OPEN' THEN 1 END)";
        case 'viewers':              return "COUNT(DISTINCT CASE WHEN ACTION='OPEN' $t THEN USER_ID END)";
        case 'viewers_prior':        return "COUNT(DISTINCT CASE WHEN ACTION='OPEN' $p THEN USER_ID END)";
        case 'reports_viewed':       return "COUNT(DISTINCT CASE WHEN ACTION='OPEN' $t THEN REPORT_ID END)";
        case 'reports_viewed_prior': return "COUNT(DISTINCT CASE WHEN ACTION='OPEN' $p THEN REPORT_ID END)";
        case 'dash_views':           return "COUNT(CASE WHEN ACTION='OPEN' $t AND " . penumbra_an_dash_like() . " THEN 1 END)";
        case 'dash_views_prior':     return "COUNT(CASE WHEN ACTION='OPEN' $p AND " . penumbra_an_dash_like() . " THEN 1 END)";
        case 'exports':              return "COUNT(CASE WHEN ACTION='EXPORT' $t THEN 1 END)";
        case 'exports_prior':        return "COUNT(CASE WHEN ACTION='EXPORT' $p THEN 1 END)";
        case 'reports_exported':     return "COUNT(DISTINCT CASE WHEN ACTION='EXPORT' $t THEN REPORT_ID END)";
        case 'updates':              return "COUNT(CASE WHEN ACTION='UPDATE' $t THEN 1 END)";
        case 'updates_prior':        return "COUNT(CASE WHEN ACTION='UPDATE' $p THEN 1 END)";
        case 'reports_updated':      return "COUNT(DISTINCT CASE WHEN ACTION='UPDATE' $t THEN REPORT_ID END)";
        case 'badpass':              return "COUNT(CASE WHEN ACTION='BADPASS' $t THEN 1 END)";
        case 'denied':               return "COUNT(CASE WHEN ACTION IN ('DENIED','DENIED_SCOPE','DENIED_IMPORT','PRESET_DENIED') $t THEN 1 END)";
        case 'toobig':               return "COUNT(CASE WHEN ACTION='QUERY_TOOBIG' $t THEN 1 END)";
        case 'emails':               return "COUNT(CASE WHEN ACTION='EMAIL' $t THEN 1 END)";
        case 'email_fails':          return "COUNT(CASE WHEN ACTION='EMAIL_FAIL' $t THEN 1 END)";
        case 'sched_ok':             return "COUNT(CASE WHEN ACTION='SCHEDULE_RUN_OK' $t THEN 1 END)";
        case 'sched_fails':          return "COUNT(CASE WHEN ACTION IN ($schedFail) $t THEN 1 END)";
        case 'sched_skips':          return "COUNT(CASE WHEN ACTION='SCHEDULE_SKIPPED' $t THEN 1 END)";
        // (2026-11-17, metricsweep4) Runs that RAN. A skipped send writes one row
        // per skip, so a task that skipped 1,410 sends and ran 89 times read as
        // 1,499 runs. 'sched_skips' reports them beside the count; 'sched_runs_all'
        // keeps them, because it is only the "was this ever scheduled?" test.
        case 'sched_runs':           return "COUNT(CASE WHEN ACTION IN ('SCHEDULE_RUN_OK',$schedFail) $t THEN 1 END)";
        case 'sched_runs_all':       return "COUNT(CASE WHEN ACTION IN ($schedRun) THEN 1 END)";
        case 'timeouts':             return "COUNT(CASE WHEN ACTION='QUERY_TIMEOUT' $t THEN 1 END)";
        case 'query_fails':          return "COUNT(CASE WHEN ACTION='QUERY_FAIL' $t THEN 1 END)";
        case 'client_errors':        return "COUNT(CASE WHEN ACTION='CLIENT_ERROR' AND NOT " . penumbraBenignClientErrorSql() . " $t THEN 1 END)";
        case 'errors':               return "COUNT(CASE WHEN " . penumbraErrorCondSql() . " $t THEN 1 END)";
        case 'events':               return "COUNT(CASE WHEN 1=1 $t THEN 1 END)";
        case 'events_prior':         return "COUNT(CASE WHEN 1=1 $p THEN 1 END)";
        case 'event_users':          return "COUNT(DISTINCT CASE WHEN 1=1 $t THEN USER_ID END)";
        case 'sized_runs':           return 'COUNT(ROW_COUNT)';
        case 'med_rows':             return 'ROUND(MEDIAN(ROW_COUNT))';
        case 'med_cols':             return 'ROUND(MEDIAN(COL_COUNT))';
        case 'max_rows':             return 'MAX(ROW_COUNT)';
        case 'max_cells':            return 'MAX(ROW_COUNT * COL_COUNT)';
        case 'med_ms':               return 'ROUND(MEDIAN(QUERY_MS))';
        case 'max_ms':               return 'MAX(QUERY_MS)';
    }
    throw new InvalidArgumentException("unknown metrics counter '$name'");
}

/**
 * Run the named counters over one scope in ONE scan of the audit table.
 *
 * @param array $columns  page alias => catalog name, in the order the page
 *                        wants them (the aliases are what the page reads)
 * @return array  the row (alias => value), or array() when the query returned
 *                nothing. Errors are NOT caught here: each page's own
 *                try/catch around its counter block decides what a failed
 *                query costs, exactly as it did when the SQL was inline.
 */
function penumbra_an_counts($run, $where, $binds, $w, $columns)
{
    $sel = array();
    foreach ($columns as $alias => $name) $sel[] = penumbra_an_counter_sql($name, $w) . ' AS ' . $alias;
    $rows = $run("SELECT\n            " . implode(",\n            ", $sel) . "\n         FROM PENUMBRA_AUDIT WHERE $where", $binds);
    return empty($rows) ? array() : $rows[0];
}

/**
 * Top departments + Top colleges for one scope (step 2, increment 3,
 * 2026-10-01): the views each person made in the scope, rolled up to the
 * department the scheduler substitutes for {DEPT} and one level more to the
 * college (the OUC's 2-digit prefix). ONE per-user aggregate and ONE batched
 * directory lookup (penumbraLookupDepartments(), penumbra_directory.php) serve
 * both panels and the Department column of the page's people table
 * (penumbra_an_dept_decorate()). The rollups themselves live in
 * penumbra_directory.php (penumbraRankDepartments / penumbraRankColleges).
 *
 * @param string $where   the page's scope over PENUMBRA_AUDIT; its OPENs that
 *                        carry a user are counted
 * @param array  $also    names to look up besides the viewers: Platform's users
 *                        table counts every action, so an update-only user is
 *                        in it without ever being a viewer
 * @param int    $cap     0 = every viewer (the report page); N = the N heaviest
 *                        only (Platform: 1000 = two directory chunks), and
 *                        'capped' says the cap was reached, for the subtitle
 * @param int    $rankMax rows ranked for the client (revealed in steps)
 * @return array 'depts', 'colleges' (ranked rows), 'map' (lower unity id =>
 *               split), 'total' (viewers counted), 'matched' (viewers the
 *               directory places in a department), 'capped', and 'looked'
 *               (there was someone to look up, so the map is real).
 *               The aggregate's DB error is NOT caught here - the page's own
 *               try/catch decides, as when the SQL was inline; the directory
 *               lookup never throws (it logs and reads as "not found").
 */
function penumbra_an_departments($run, $conn, $where, $binds, $also = array(), $cap = 0, $rankMax = 250)
{
    $rows = $run(
        "SELECT USER_ID, COUNT(*) AS VIEWS
           FROM PENUMBRA_AUDIT
          WHERE ACTION='OPEN' AND USER_ID IS NOT NULL AND $where
          GROUP BY USER_ID" . ($cap > 0 ? "
          ORDER BY VIEWS DESC FETCH FIRST " . (int)$cap . " ROWS ONLY" : ''),
        $binds
    );
    $viewsByUser = array();
    foreach ($rows as $r) $viewsByUser[$r['USER_ID']] = (int)$r['VIEWS'];
    $out = array('depts' => array(), 'colleges' => array(), 'map' => array(), 'total' => count($viewsByUser),
                 'matched' => 0, 'capped' => ($cap > 0 && count($viewsByUser) >= $cap), 'looked' => false);
    $names = array_keys($viewsByUser);
    foreach ($also as $u) $names[] = $u;
    if (empty($names)) return $out;
    $out['looked']   = true;
    $out['map']      = penumbraLookupDepartments($conn, $names);
    $out['depts']    = penumbraRankDepartments($viewsByUser, $out['map'], $rankMax);
    $out['colleges'] = penumbraRankColleges($viewsByUser, $out['map'], $rankMax);
    foreach ($viewsByUser as $uname => $ignored) {
        $key = strtolower(trim((string)$uname));
        if (isset($out['map'][$key]) && $out['map'][$key]['dept'] !== '') $out['matched']++;
    }
    return $out;
}

/**
 * The Department column of a people table (the report page's Top viewers,
 * Platform's users table) from the map penumbra_an_departments() already
 * holds - no extra query. 'dept' is the display label; the OUC rides along in
 * 'ouc' (real unit numbers only) for the cell's title and its filter button,
 * so the column doesn't print the unit number twice.
 */
function penumbra_an_dept_decorate(array $rows, array $map)
{
    foreach ($rows as &$row) {
        $key = strtolower(trim((string)$row['user']));
        $row['dept'] = isset($map[$key]) ? penumbraDepartmentLabel($map[$key]) : '';
        $row['ouc']  = (isset($map[$key]) && penumbraOucIsReal($map[$key]['ouc'])) ? $map[$key]['ouc'] : '';
    }
    unset($row);
    return $rows;
}

/**
 * THE REPORT SCOPE of the metrics engine (step 2, the one engine, 2026-10-01):
 * which report a report-scoped metrics page is narrowed to and what the visitor
 * may see of it - the rules analytics.php has always applied, in one place:
 *   can_view        admin, the owner, or anyone the report is shared with (its
 *                   AUTHORIZED list: 'public', a Unity ID or an OUC - the
 *                   checkAuthorization() index.php uses). If you can open the
 *                   report, you can see its metrics.
 *   can_see_people  admin, the owner, or a report EDITOR (a user_grants entry
 *                   matching the report - the repository's Editors column).
 *                   The person-level panels (who viewed, from which address,
 *                   the activity feed) and the user / department / IP filters
 *                   name people, so they are for these three only.
 * $editorRolesOn (2026-10-02): the caller passes !$noadm. Under ?noadm the page
 * previews a PLAIN viewer - the app-wide rule since that day (index.php's
 * $pnbEditorRolesOn): ownership and report grants stop conferring the
 * person-level tier, as they stop conferring editing, but the owner still
 * VIEWS (can_view is untouched). db_connection.php has already cleared
 * $isAdmin for it.
 * Returns array('status' => 200 | 400 | 404 | 403, 'row' => the PENUMBRA_REPORTS
 * row (ID, SHORT_ID, TITLE, OWNER_ID, AUTHORIZED, CREATED, MODIFIED),
 * 'can_view', 'can_see_people', 'is_owner', 'is_editor', 'editors' (list of
 * array('user', 'sched'))). The caller answers a non-200 status (and exits).
 */
function penumbra_an_report_scope($conn, $shortId, $isAdmin, $userKey, $userOuc, $config, $editorRolesOn = true)
{
    $out = array('status' => 200, 'row' => null, 'can_view' => false, 'can_see_people' => false,
                 'is_owner' => false, 'is_editor' => false, 'editors' => array());
    $shortId = trim((string)$shortId);
    if ($shortId === '') { $out['status'] = 400; return $out; }
    try {
        $stmt = $conn->prepare("SELECT ID, SHORT_ID, TITLE, OWNER_ID, AUTHORIZED,
                                       TO_CHAR(CREATED_AT,  'YYYY-MM-DD HH24:MI') AS CREATED,
                                       TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS MODIFIED
                                  FROM PENUMBRA_REPORTS
                                 WHERE TRIM(SHORT_ID) = :sid");
        $stmt->bindValue(':sid', $shortId, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log('penumbra_an_report_scope lookup failed: ' . $e->getMessage());
        $row = null;
    }
    if (!$row) { $out['status'] = 404; return $out; }
    $out['row'] = $row;
    $out['is_owner'] = penumbraIsReportOwner($row['OWNER_ID'], $userKey);
    $out['can_view'] = $isAdmin || $out['is_owner'] || checkAuthorization($row['AUTHORIZED'], $userKey, $userOuc);
    if (!$out['can_view']) { $out['status'] = 403; return $out; }
    // Grant-based editors beyond the owner (admins edit everything and are not listed).
    if (function_exists('penumbraNormalizeGrants') && function_exists('penumbraReportGrantMatches')
        && isset($config['user_grants']) && is_array($config['user_grants'])) {
        try {
            $sidTrim = trim((string)$row['SHORT_ID']); $ownerTrim = trim((string)$row['OWNER_ID']);
            foreach (array_keys($config['user_grants']) as $gu) {
                if (strcasecmp($gu, $ownerTrim) === 0) continue;
                $g = penumbraNormalizeGrants($config, $gu);
                if (penumbraReportGrantMatches($g, $sidTrim)) {
                    $out['editors'][] = array('user' => $gu, 'sched' => function_exists('penumbraReportGrantAllowsScheduler')
                                                                     && penumbraReportGrantAllowsScheduler($g, $sidTrim));
                }
            }
        } catch (Exception $e) {
            error_log('penumbra_an_report_scope editors-list build failed: ' . $e->getMessage());
        }
    }
    foreach ($out['editors'] as $re) { if (strcasecmp($re['user'], (string)$userKey) === 0) { $out['is_editor'] = true; break; } }
    $out['can_see_people'] = $isAdmin || ($editorRolesOn && ($out['is_owner'] || $out['is_editor']));
    return $out;
}

/*
 * THE REPORT'S OWN CARDS (the one engine, E2a, 2026-10-01): the counters,
 * sparklines and card list a report's metrics page has always shown, moved
 * out of analytics.php unchanged so the engine's report scope can show the
 * same cards. $w is the parsed window (penumbra_an_parse_window()); $exclSql /
 * $exclBinds the exclusion + scope seam (the visibility toggles and the
 * user / department / IP filters). $logLabel names the page in error_log lines.
 */

/**
 * The window's START as a SQL instant, for the one query that needs "before the
 * window" rather than "inside it" (new viewers). Derived from the SAME source as
 * the window's own filter so the two can never describe different boundaries
 * (24h's start is SYSDATE-1 - the same instant its time filter opens at).
 */
function penumbra_an_window_start_lit($w)
{
    return ($w['rangeParam'] === 'custom')
        ? "TO_DATE('" . $w['customFrom'] . "','YYYY-MM-DD')"
        : ($w['trendHourly'] ? 'SYSDATE-1'
        : (($w['windowDays'] === null) ? 'TO_DATE(\'0001-01-01\',\'YYYY-MM-DD\')' : 'TRUNC(SYSDATE)-' . ($w['windowDays'] - 1)));
}

/**
 * Usage counters (exclusion + scope seam and the weekday/hour scope apply):
 * TOTAL_VIEWS all-time, the windowed views / viewers / exports / dashboard
 * pulls with their prior-window twins (the counter catalog), NEW_VIEWERS_WINDOW
 * (opened inside the window, never before its start - skipped for all time,
 * where "new" has no meaning) and the last UPDATE's who/when (informational, so
 * the exclusions deliberately do not apply). One try: a DB error keeps what was
 * counted before it and logs "<page> KPI query failed".
 */
function penumbra_an_report_counters($run, $rid, $w, $exclSql, $exclBinds, $logLabel)
{
    $ridBinds = array(':rid' => (int)$rid);
    $whenFilter = $w['whenFilter']; $timeFilter = $w['timeFilter'];
    $k = array('TOTAL_VIEWS'=>0,'VIEWS_WINDOW'=>0,'VIEWS_PRIOR'=>0,'UNIQUE_VIEWERS'=>0,
               'NEW_VIEWERS_WINDOW'=>0,
               'EXPORT_COUNT'=>0,'EXPORT_PRIOR'=>0,
               'DASH_WINDOW'=>0,'DASH_PRIOR'=>0,
               'LAST_UPDATE_USER'=>null,'LAST_UPDATE_AT'=>null);
    try {
        $k = array_merge($k, penumbra_an_counts($run, "REPORT_ID = :rid $whenFilter $exclSql",
            array_merge($ridBinds, $exclBinds), $w, array(
                'TOTAL_VIEWS'    => 'views_all',
                'VIEWS_WINDOW'   => 'views',
                'VIEWS_PRIOR'    => 'views_prior',
                'UNIQUE_VIEWERS' => 'viewers',
                'EXPORT_COUNT'   => 'exports',
                'EXPORT_PRIOR'   => 'exports_prior',
                'DASH_WINDOW'    => 'dash_views',
                'DASH_PRIOR'     => 'dash_views_prior',
            )));
        if ($w['windowDays'] !== null) {
            $windowStartLit = penumbra_an_window_start_lit($w);
            $rows = $run(
                "SELECT COUNT(*) AS CNT FROM (
                    SELECT USER_ID FROM PENUMBRA_AUDIT
                     WHERE REPORT_ID = :rid AND ACTION='OPEN' AND USER_ID IS NOT NULL $timeFilter $whenFilter $exclSql
                    MINUS
                    SELECT USER_ID FROM PENUMBRA_AUDIT
                     WHERE REPORT_ID = :rid AND ACTION='OPEN' AND USER_ID IS NOT NULL AND TIMESTAMP < $windowStartLit)",
                array_merge($ridBinds, $exclBinds)
            );
            $k['NEW_VIEWERS_WINDOW'] = !empty($rows) ? (int)$rows[0]['CNT'] : 0;
        }
        $rows = $run(
            "SELECT * FROM (
                SELECT USER_ID, TO_CHAR(TIMESTAMP, 'YYYY-MM-DD HH24:MI') AS TS
                  FROM PENUMBRA_AUDIT
                 WHERE REPORT_ID = :rid AND ACTION='UPDATE'
                 ORDER BY TIMESTAMP DESC
             ) WHERE ROWNUM = 1",
            $ridBinds
        );
        if (!empty($rows)) {
            $k['LAST_UPDATE_USER'] = $rows[0]['USER_ID'];
            $k['LAST_UPDATE_AT']   = $rows[0]['TS'];
        }
    } catch (Exception $e) {
        error_log("$logLabel KPI query failed: " . $e->getMessage());
    }
    return $k;
}

/**
 * SECURITY + DELIVERY + EDIT counters over the WHOLE report - never filtered by
 * the exclusion toggles or the weekday/hour scope (BADPASS is a security
 * signal; EMAIL / SCHEDULE_* rows are system activity logged under the runner
 * or the owner; UPDATEs are almost always by the owner or an admin, so
 * excluding them would pin the Updates card at zero). SCHED_ALLTIME doubles as
 * the "ever scheduled?" test behind the Sched Runs card; the run-size
 * aggregates ride the same scan, all-time, once the size columns exist. Also
 * the latest scheduler run and the distinct BADPASS addresses in the window
 * (parsed in PHP - a small set; they flag rows in Top IPs).
 * @return array($sys, $bpIps)
 */
function penumbra_an_report_system($run, $rid, $w, $logLabel, $scopeSql = '', $scopeBinds = array())
{
    $ridBinds = array(':rid' => (int)$rid);
    // (2026-11-17, metricsweep) $scopeSql / $scopeBinds: the page's user /
    // department / IP filter. With one of those or a weekday/hour scope on, the
    // Errors and Updates cards are re-counted under it, because the Errors tab
    // the card opens applies them and the two must show the same number. The
    // Hide toggles still never apply, and the scheduler and run-size figures
    // stay whole-report.
    $sysScope = trim($w['whenFilter'] . ' ' . $scopeSql);
    $sys = array('BADPASS_COUNT'=>0,'BADPASS_IP_COUNT'=>0,'DENIED_COUNT'=>0,'EMAIL_COUNT'=>0,'EMAILFAIL_COUNT'=>0,
                 'UPDATE_COUNT'=>0,
                 'SCHED_OK_COUNT'=>0,'SCHED_FAIL_COUNT'=>0,'SCHED_SKIP_COUNT'=>0,'SCHED_ALLTIME'=>0,
                 'TIMEOUT_COUNT'=>0,'QFAIL_COUNT'=>0,'CLIENT_ERR_COUNT'=>0,'ERR_TOTAL_COUNT'=>0,
                 'TOOBIG_COUNT'=>0,'ERR_SCHED_FAIL'=>0,
                 'LAST_RUN_ACTION'=>null,'LAST_RUN_AT'=>null,
                 'SIZED_RUNS'=>0,'MED_ROWS'=>0,'MED_COLS'=>0,'MAX_ROWS'=>0,'MAX_CELLS'=>0,'MED_MS'=>0,'MAX_MS'=>0);
    $sysCols = penumbraAuditHasMetrics() ? array(
        'SIZED_RUNS' => 'sized_runs', 'MED_ROWS' => 'med_rows', 'MED_COLS' => 'med_cols', 'MAX_ROWS' => 'max_rows',
        'MAX_CELLS'  => 'max_cells',  'MED_MS'   => 'med_ms',   'MAX_MS'   => 'max_ms',
    ) : array();
    try {
        $sys = array_merge($sys, penumbra_an_counts($run, "REPORT_ID = :rid", $ridBinds, $w, $sysCols + array(
            'BADPASS_COUNT'    => 'badpass',
            'DENIED_COUNT'     => 'denied',
            'UPDATE_COUNT'     => 'updates',
            'EMAIL_COUNT'      => 'emails',
            'EMAILFAIL_COUNT'  => 'email_fails',
            'SCHED_OK_COUNT'   => 'sched_ok',
            'SCHED_FAIL_COUNT' => 'sched_fails',
            'SCHED_SKIP_COUNT' => 'sched_skips',
            'TIMEOUT_COUNT'    => 'timeouts',
            'QFAIL_COUNT'      => 'query_fails',
            'CLIENT_ERR_COUNT' => 'client_errors',
            'ERR_TOTAL_COUNT'  => 'errors',
            'TOOBIG_COUNT'     => 'toobig',
            'SCHED_ALLTIME'    => 'sched_runs_all',
        )));
        // (2026-11-17, metricsweep2) ERR_SCHED_FAIL is the Errors card's run-fail
        // figure; SCHED_FAIL_COUNT stays the Sched Runs card's. One key served
        // both, so re-counting it under a user filter (a scheduler row is never
        // that user's) took the failures out of Sched Runs: 71 runs became 61
        // with "no failures".
        $sys['ERR_SCHED_FAIL'] = $sys['SCHED_FAIL_COUNT'];
        if ($sysScope !== '') {
            $sys = array_merge($sys, penumbra_an_counts($run, "REPORT_ID = :rid $sysScope", array_merge($ridBinds, $scopeBinds), $w, array(
                'BADPASS_COUNT'    => 'badpass',
                'DENIED_COUNT'     => 'denied',
                'UPDATE_COUNT'     => 'updates',
                'EMAILFAIL_COUNT'  => 'email_fails',
                'ERR_SCHED_FAIL'   => 'sched_fails',
                'TOOBIG_COUNT'     => 'toobig',
                'TIMEOUT_COUNT'    => 'timeouts',
                'QFAIL_COUNT'      => 'query_fails',
                'CLIENT_ERR_COUNT' => 'client_errors',
                'ERR_TOTAL_COUNT'  => 'errors',
            )));
        }
        if ((int)$sys['SCHED_ALLTIME'] > 0) {
            $rows = $run(
                "SELECT * FROM (
                    SELECT ACTION, TO_CHAR(TIMESTAMP, 'YYYY-MM-DD HH24:MI') AS TS
                      FROM PENUMBRA_AUDIT
                     WHERE REPORT_ID = :rid
                       AND ACTION IN ('SCHEDULE_RUN_OK','SCHEDULE_RUN_FAIL','SCHEDULE_FAIL','SCHEDULE_NOAUTH','SCHEDULE_SKIPPED')
                     ORDER BY TIMESTAMP DESC
                 ) WHERE ROWNUM = 1",
                $ridBinds
            );
            if (!empty($rows)) {
                $sys['LAST_RUN_ACTION'] = $rows[0]['ACTION'];
                $sys['LAST_RUN_AT']     = $rows[0]['TS'];
            }
        }
    } catch (Exception $e) {
        error_log("$logLabel system KPI query failed: " . $e->getMessage());
    }
    $bpIps = array();
    try {
        if ((int)$sys['BADPASS_COUNT'] > 0) {
            $rows = $run(
                "SELECT TO_CHAR(SUBSTR(SOURCE_DATA, 1, 4000)) AS SD
                   FROM PENUMBRA_AUDIT WHERE REPORT_ID = :rid AND ACTION='BADPASS' " . $w['timeFilter'] . " " . $sysScope,
                array_merge($ridBinds, $scopeBinds)
            );
            foreach ($rows as $r) {
                $sd = json_decode(isset($r['SD']) ? $r['SD'] : '', true);
                $ip = isset($sd['ip_address']) ? $sd['ip_address'] : (isset($sd['ip']) ? $sd['ip'] : null);
                if ($ip) $bpIps[$ip] = true;
            }
            $sys['BADPASS_IP_COUNT'] = count($bpIps);
        }
    } catch (Exception $e) {
        error_log("$logLabel BADPASS IP query failed: " . $e->getMessage());
    }
    return array($sys, $bpIps);
}

/**
 * The card sparklines, bucketed to MATCH the window: hourly with the 24h trend
 * (the same $hourAxis keys, so a card's spark is the chart in miniature), daily
 * whenever the trend is daily, monthly (last 24 months) otherwise. Anchored to
 * the window's LAST day, not today, so a custom range that ended in the past
 * plots its own days. Two queries - the usage series (exclusion seam applies)
 * and the system series (it does not; ERRS is the canonical error condition) -
 * plus Total Views' own monthly series when the window is not already monthly.
 * Returns every value the page reads afterwards (Top viewers buckets its row
 * sparks on the same keys/expression/cut): sparkLen, sparkTitle, sparkKeys,
 * sparkBucketExpr, sparkTimeCut, sparkHourly, sparkDaily, and the series
 * sparkOpens, sparkUnique, sparkExports, sparkDash, sparkErrors, sparkUpdates,
 * sparkRuns, sparkOpensMonthly (+ sparkTitleMonthly).
 */
function penumbra_an_report_sparks($run, $rid, $w, $hourAxis, $exclSql, $exclBinds, $logLabel, $scopeSql = '', $scopeBinds = array())
{
    $ridBinds = array(':rid' => (int)$rid);
    $whenFilter = $w['whenFilter']; $timeFilter = $w['timeFilter'];
    $dashLike = penumbra_an_dash_like();
    $sparkHourly = $w['trendHourly'];
    $sparkDaily  = $w['trendDaily'];
    $sparkLen    = $sparkHourly ? count($hourAxis) : ($sparkDaily ? (int)$w['windowDays'] : 24);
    $sparkTitle  = $sparkHourly ? ('hourly · ' . htmlspecialchars($w['rangeLabelLong']))
                 : ($sparkDaily ? ('daily · ' . htmlspecialchars($w['rangeLabelLong'])) : 'monthly · last 24 months');
    $sparkKeys = array();
    $mAnchor = date('Y-m-01', $w['trendEndTs']);
    // (2026-11-17, metricsweep) Two anchors. The WINDOW's cards plot the 24
    // months ending in the window's last month; Total Views is an all-time
    // number and always plots the 24 months ending now. One anchor (the
    // window's) with a cut of "24 months back from today" drew a flat line for
    // any custom range that ended in an earlier month.
    $mAnchorNow = date('Y-m-01');
    $sparkPast  = ($w['rangeParam'] === 'custom' && $mAnchor !== $mAnchorNow);
    if (!$sparkHourly && !$sparkDaily && $sparkPast) {
        $sparkTitle = 'monthly · 24 months to ' . date('M Y', $w['trendEndTs']);
    }
    if ($sparkHourly) {
        foreach ($hourAxis as $hb) $sparkKeys[] = $hb['key'];
    } else {
        for ($i = $sparkLen - 1; $i >= 0; $i--) {
            $sparkKeys[] = $sparkDaily ? date('Y-m-d', strtotime("-$i days", $w['trendEndTs']))
                                       : date('Y-m', strtotime("$mAnchor -$i months"));
        }
    }
    $sparkBucketExpr = $sparkHourly ? "TO_CHAR(TRUNC(TIMESTAMP, 'HH24'), 'YYYY-MM-DD HH24')"
                     : ($sparkDaily ? "TO_CHAR(TRUNC(TIMESTAMP), 'YYYY-MM-DD')"
                                    : "TO_CHAR(TRUNC(TIMESTAMP, 'MM'), 'YYYY-MM')");
    // The daily (and hourly) cut is the window's own filter with its leading
    // "AND " removed - literally the predicate the cards count over.
    $sparkTimeCut    = ($sparkHourly || $sparkDaily) ? substr($timeFilter, 4)
                     : "TIMESTAMP >= ADD_MONTHS(TO_DATE('$mAnchor','YYYY-MM-DD'), -23)"
                       . " AND TIMESTAMP < ADD_MONTHS(TO_DATE('$mAnchor','YYYY-MM-DD'), 1) " . $timeFilter;

    $sparkOpens = $sparkUnique = $sparkUpdates = $sparkExports = array_fill(0, $sparkLen, 0);
    $sparkErrors = $sparkRuns = $sparkDash = array_fill(0, $sparkLen, 0);
    try {
        $rows = $run(
            "SELECT $sparkBucketExpr AS BUCKET,
                    COUNT(CASE WHEN ACTION='OPEN'   THEN 1 END) AS OPENS,
                    COUNT(DISTINCT CASE WHEN ACTION='OPEN' THEN USER_ID END) AS UNIQ,
                    COUNT(CASE WHEN ACTION='EXPORT' THEN 1 END) AS EXPS,
                    COUNT(CASE WHEN ACTION='OPEN' AND $dashLike THEN 1 END) AS DASHN
               FROM PENUMBRA_AUDIT WHERE REPORT_ID = :rid AND $sparkTimeCut $whenFilter $exclSql
              GROUP BY $sparkBucketExpr",
            array_merge($ridBinds, $exclBinds)
        );
        $by = array();
        foreach ($rows as $r) $by[$r['BUCKET']] = $r;
        foreach ($sparkKeys as $idx => $kk) {
            $sparkOpens[$idx]   = isset($by[$kk]['OPENS']) ? (int)$by[$kk]['OPENS'] : 0;
            $sparkUnique[$idx]  = isset($by[$kk]['UNIQ'])  ? (int)$by[$kk]['UNIQ']  : 0;
            $sparkExports[$idx] = isset($by[$kk]['EXPS'])  ? (int)$by[$kk]['EXPS']  : 0;
            $sparkDash[$idx]    = isset($by[$kk]['DASHN']) ? (int)$by[$kk]['DASHN'] : 0;
        }

        // System series (no exclusion). ERRS is the same error family the feed's
        // "Errors" chip and the Errors KPI count - single source
        // penumbraErrorActions(), through penumbraErrorCondSql() so the harmless
        // browser aborts stay out.
        $errCondSql = penumbraErrorCondSql();
        $rows = $run(
            "SELECT $sparkBucketExpr AS BUCKET,
                    COUNT(CASE WHEN $errCondSql THEN 1 END) AS ERRS,
                    COUNT(CASE WHEN ACTION='UPDATE'  THEN 1 END) AS UPDS,
                    COUNT(CASE WHEN ACTION IN ('SCHEDULE_RUN_OK','SCHEDULE_RUN_FAIL','SCHEDULE_FAIL','SCHEDULE_NOAUTH') THEN 1 END) AS SRUNS   /* runs that ran, as the card counts them: no skipped sends (metricsweep5) */
               FROM PENUMBRA_AUDIT WHERE REPORT_ID = :rid AND $sparkTimeCut $whenFilter
              GROUP BY $sparkBucketExpr",
            $ridBinds
        );
        $by = array();
        foreach ($rows as $r) $by[$r['BUCKET']] = $r;
        foreach ($sparkKeys as $idx => $kk) {
            $sparkErrors[$idx]  = isset($by[$kk]['ERRS'])  ? (int)$by[$kk]['ERRS']  : 0;
            $sparkUpdates[$idx] = isset($by[$kk]['UPDS'])  ? (int)$by[$kk]['UPDS']  : 0;
            $sparkRuns[$idx]    = isset($by[$kk]['SRUNS']) ? (int)$by[$kk]['SRUNS'] : 0;
        }
        // (2026-11-17, metricsweep2) The Errors and Updates cards follow the
        // user / department / IP filter since the first sweep; their sparklines
        // did not, so "Errors 0" sat over a line with bumps. Scheduler runs
        // stay whole-report, as their card does.
        if (trim($scopeSql) !== '') {
            $rows = $run(
                "SELECT $sparkBucketExpr AS BUCKET,
                        COUNT(CASE WHEN $errCondSql THEN 1 END) AS ERRS,
                        COUNT(CASE WHEN ACTION='UPDATE'  THEN 1 END) AS UPDS
                   FROM PENUMBRA_AUDIT WHERE REPORT_ID = :rid AND $sparkTimeCut $whenFilter $scopeSql
                  GROUP BY $sparkBucketExpr",
                array_merge($ridBinds, $scopeBinds)
            );
            $by = array();
            foreach ($rows as $r) $by[$r['BUCKET']] = $r;
            foreach ($sparkKeys as $idx => $kk) {
                $sparkErrors[$idx]  = isset($by[$kk]['ERRS']) ? (int)$by[$kk]['ERRS'] : 0;
                $sparkUpdates[$idx] = isset($by[$kk]['UPDS']) ? (int)$by[$kk]['UPDS'] : 0;
            }
        }
    } catch (Exception $e) {
        error_log("$logLabel spark series query failed: " . $e->getMessage());
    }

    // Total Views is an ALL-TIME number, so its spark is always the monthly
    // series (last 24 months) - in "all time" mode that is sparkOpens already,
    // otherwise one extra tiny aggregate.
    $sparkOpensMonthly = $sparkOpens;
    $sparkTitleMonthly = 'monthly · last 24 months';
    if ($sparkDaily || $sparkHourly || $sparkPast) {
        $sparkOpensMonthly = array_fill(0, 24, 0);
        try {
            $rows = $run(
                "SELECT TO_CHAR(TRUNC(TIMESTAMP, 'MM'), 'YYYY-MM') AS BUCKET, COUNT(*) AS CNT
                   FROM PENUMBRA_AUDIT
                  WHERE REPORT_ID = :rid AND ACTION='OPEN'
                    AND TIMESTAMP >= ADD_MONTHS(TRUNC(SYSDATE,'MM'), -23) $exclSql
                  GROUP BY TO_CHAR(TRUNC(TIMESTAMP, 'MM'), 'YYYY-MM')",
                array_merge($ridBinds, $exclBinds)
            );
            $by = array();
            foreach ($rows as $r) $by[$r['BUCKET']] = (int)$r['CNT'];
            for ($i = 23; $i >= 0; $i--) {
                $mk = date('Y-m', strtotime("$mAnchorNow -$i months"));
                $sparkOpensMonthly[23 - $i] = isset($by[$mk]) ? $by[$mk] : 0;
            }
        } catch (Exception $e) {
            error_log("$logLabel monthly spark query failed: " . $e->getMessage());
        }
    }
    return compact('sparkHourly', 'sparkDaily', 'sparkLen', 'sparkTitle', 'sparkKeys', 'sparkBucketExpr', 'sparkTimeCut',
                   'sparkOpens', 'sparkUnique', 'sparkExports', 'sparkDash', 'sparkErrors', 'sparkUpdates', 'sparkRuns',
                   'sparkOpensMonthly', 'sparkTitleMonthly');
}

/**
 * The report's card list (the one engine, E2a, 2026-10-01): label, value,
 * sub-line, sparkline, warning and click target of every card on a report's
 * metrics page, from penumbra_an_report_counters() ($k),
 * penumbra_an_report_system() ($sys) and penumbra_an_report_sparks() ($sp).
 * Moved out of analytics.php VERBATIM (the body below is the page's block;
 * only the variable names it read come in as arguments). 'go' is where a click
 * on the card lands: a panel anchor, or 'feed:<family>' which selects that
 * chip on Recent activity; cards without a detail surface omit it.
 * $canSeePeople: "last by <user>" names a person - the owner/editor/admin
 * tier only.
 */
function penumbra_an_report_kpis($k, $sys, $sp, $w, $canSeePeople, $schedRunsWindow)
{
    extract($sp);
    $windowDays      = $w['windowDays'];
    $rangeLabelShort = $w['rangeLabelShort'];
    $whenLabel       = $w['whenLabel'];
    $can_see_people  = $canSeePeople;
    // "Views" KPI: windowed; show delta when prior-period data exists; suppress for "all time".
    if ($windowDays === null) {
        $viewsSub = 'all time';
    } else {
        $delta = (int)$k['VIEWS_PRIOR'] > 0
            ? (((int)$k['VIEWS_WINDOW'] - (int)$k['VIEWS_PRIOR']) / (int)$k['VIEWS_PRIOR']) * 100
            : null;
        // (2026-11-17, metricsweep) Name the window the number was measured
        // against: the chosen comparison when one is on, else the prior window
        // by its LENGTH ("vs prior Nov 1 - Nov 15" named the current one).
        $vsLabel = !empty($w['cmpOn']) ? 'vs ' . $w['priorLabel'] : 'vs prior ' . $w['priorLabel'];
        $noPrior = !empty($w['cmpOn']) ? 'nothing in ' . $w['priorLabel'] . ' to compare with' : 'no prior period';
        $viewsSub = $delta === null
            ? $noPrior
            : sprintf('%s%.1f%% %s', $delta >= 0 ? '+' : '', $delta, $vsLabel);
    }

    $uniqSub = $windowDays === null
        ? 'distinct users · all time'
        : (int)$k['NEW_VIEWERS_WINDOW'] . ' new in ' . $rangeLabelShort;

    // "last by <user>" names a person, so the name is only shown to the
    // owner/editor/admin tier; everyone else just gets the timestamp.
    if ($k['LAST_UPDATE_USER']) {
        $lastUpdSub = $can_see_people
            ? 'last by ' . $k['LAST_UPDATE_USER'] . ' · ' . $k['LAST_UPDATE_AT']
            : 'last · ' . $k['LAST_UPDATE_AT'];
    } else {
        $lastUpdSub = 'no updates in ' . $rangeLabelShort;
    }

    // Errors card: every failure class in the window - failed password attempts,
    // access denials, email failures, scheduled-run failures. Sub lists only the
    // non-zero components so the common all-clear case stays quiet.
    // Total comes from the canonical action set, NOT from summing the named buckets -
    // see the ERR_TOTAL_COUNT comment in the query above.
    $errTotal = (int)$sys['ERR_TOTAL_COUNT'];
    $errBits = array();
    if ((int)$sys['BADPASS_COUNT'] > 0) {
        $errBits[] = sprintf('%d badpass (%d IP%s)', $sys['BADPASS_COUNT'],
            $sys['BADPASS_IP_COUNT'], (int)$sys['BADPASS_IP_COUNT'] === 1 ? '' : 's');
    }
    if ((int)$sys['DENIED_COUNT'] > 0)    $errBits[] = $sys['DENIED_COUNT'] . ' denied';
    if ((int)$sys['EMAILFAIL_COUNT'] > 0) $errBits[] = $sys['EMAILFAIL_COUNT'] . ' email-fail';
    $errSchedFail = isset($sys['ERR_SCHED_FAIL']) ? (int)$sys['ERR_SCHED_FAIL'] : (int)$sys['SCHED_FAIL_COUNT'];
    $errTooBig    = isset($sys['TOOBIG_COUNT']) ? (int)$sys['TOOBIG_COUNT'] : 0;
    if ($errSchedFail > 0) $errBits[] = $errSchedFail . ' run-fail';
    if ((int)$sys['TIMEOUT_COUNT'] > 0)    $errBits[] = $sys['TIMEOUT_COUNT'] . ' timeout';
    // Named since 2026-11-17: a result too large to buffer was most of "other".
    if ($errTooBig > 0)                    $errBits[] = $errTooBig . ' too-big';
    // Runs that died with a database error (QUERY_FAIL, 2026-10-30) - named, as
    // an outage is the one time this bucket is large.
    if ((int)$sys['QFAIL_COUNT'] > 0)      $errBits[] = $sys['QFAIL_COUNT'] . ' query-fail';
    // Browser-side JS errors on THIS report (CLIENT_ERROR, 2026-08-18) - named rather
    // than lumped into 'other', matching the all-reports tab.
    if ((int)$sys['CLIENT_ERR_COUNT'] > 0) $errBits[] = $sys['CLIENT_ERR_COUNT'] . ' browser';
    // Anything in the canonical set without a named bucket still has to show, or the
    // breakdown would not reconcile with the total on the card.
    $errNamed = (int)$sys['BADPASS_COUNT'] + (int)$sys['DENIED_COUNT'] + (int)$sys['EMAILFAIL_COUNT']
              + $errSchedFail + $errTooBig + (int)$sys['TIMEOUT_COUNT'] + (int)$sys['QFAIL_COUNT'] + (int)$sys['CLIENT_ERR_COUNT'];
    if ($errTotal > $errNamed) $errBits[] = ($errTotal - $errNamed) . ' other';
    $errorsSub = empty($errBits) ? ('none in ' . $rangeLabelShort) : implode(' · ', $errBits);

    // Exports sub mirrors the Views card: all-time has no prior period, otherwise
    // show the % change vs the immediately preceding equal-length window.
    if ($windowDays === null) {
        $exportsSub = 'downloads · all time';
    } else {
        $eDelta = (int)$k['EXPORT_PRIOR'] > 0
            ? (((int)$k['EXPORT_COUNT'] - (int)$k['EXPORT_PRIOR']) / (int)$k['EXPORT_PRIOR']) * 100
            : null;
        $exportsSub = $eDelta === null
            ? 'downloads · ' . $noPrior
            : sprintf('%s%.1f%% %s', $eDelta >= 0 ? '+' : '', $eDelta, $vsLabel);
    }
    // Manual sends from the report's Email dialog ride here, next to the other
    // "took the data somewhere" action, not on the scheduler card (2026-09-04).
    if ((int)$sys['EMAIL_COUNT'] > 0) {
        $exportsSub .= ' · ' . number_format((int)$sys['EMAIL_COUNT']) . ' emailed by hand';
    }

    $kpis = [
        // "all-time" stops being the whole truth once a weekday/hour scope is on:
        // this counter is unwindowed but it IS scoped, so the sub-line has to say
        // which. A card that reads "all-time" while showing Tuesdays-only is worse
        // than no card.
        // 'go' = where a click on the card lands (2026-09-04): a panel anchor on
        // this page, or 'feed:<family>' which selects that chip on Recent activity.
        // 'goLabel' is the footer text, 'goTitle' the hover tooltip. Cards without
        // a detail surface (Run Size) simply omit them and render inert.
        ['label'=>'Total Views',                       'value'=>number_format((int)$k['TOTAL_VIEWS']),      'sub'=>'OPENs all-time' . ($whenLabel !== '' ? ' · ' . $whenLabel . ' only' : ''),   'spark'=>$sparkOpensMonthly, 'stitle'=>'OPENs · ' . $sparkTitleMonthly,
         'go'=>'feed:view', 'goLabel'=>'recent opens', 'goTitle'=>'Show the OPEN rows in Recent activity'],
        ['label'=>'Views (' . $rangeLabelShort . ')',  'value'=>number_format((int)$k['VIEWS_WINDOW']),     'sub'=>$viewsSub,          'spark'=>$sparkOpens,        'stitle'=>'OPENs · ' . $sparkTitle,
         'go'=>'#panel-trend', 'goLabel'=>'views over time', 'goTitle'=>'Jump to the Views over time chart'],
    ];
    // Dashboard pulls - only when the report actually appears on dashboards
    // (matching the scheduler card's no-permanent-zero philosophy). The count is a
    // SUBSET of Views above: embed-tile renders + tile open-in-full clicks, i.e.
    // the 'via dashboard' OPENs the mix's Dashboards slice shows.
    if ((int)$k['DASH_WINDOW'] > 0 || (int)$k['DASH_PRIOR'] > 0) {
        $dDelta = $k['DASH_PRIOR'] > 0
            ? ($k['DASH_WINDOW'] - $k['DASH_PRIOR']) / $k['DASH_PRIOR'] * 100 : null;
        $dashSub = $dDelta === null
            ? 'via dashboard tiles · no prior period'
            : sprintf('via dashboard tiles · %s%.1f%%', $dDelta >= 0 ? '+' : '', $dDelta);
        $kpis[] = ['label'=>'Dashboard pulls', 'value'=>number_format((int)$k['DASH_WINDOW']),
                   'sub'=>$dashSub, 'spark'=>$sparkDash, 'stitle'=>'dashboard-framed OPENs · ' . $sparkTitle,
                   'go'=>'#panel-mix', 'goLabel'=>'consumption mix', 'goTitle'=>'Jump to the Consumption mix (Dashboards slice)'];
    }
    $kpis = array_merge($kpis, [
        ['label'=>'Unique Viewers',                    'value'=>number_format((int)$k['UNIQUE_VIEWERS']),   'sub'=>$uniqSub,           'spark'=>$sparkUnique,       'stitle'=>'distinct viewers · ' . $sparkTitle,
         'go'=>'#panel-viewers', 'goLabel'=>'top viewers', 'goTitle'=>'Jump to the Top viewers table'],
        ['label'=>'Exports (' . $rangeLabelShort . ')','value'=>number_format((int)$k['EXPORT_COUNT']),     'sub'=>$exportsSub,        'spark'=>$sparkExports,      'stitle'=>'EXPORTs · ' . $sparkTitle,
         'go'=>'feed:share', 'goLabel'=>'export & email rows', 'goTitle'=>'Show the EXPORT and EMAIL rows in Recent activity'],
        ['label'=>'Updates',                           'value'=>number_format((int)$sys['UPDATE_COUNT']),   'sub'=>$lastUpdSub,        'spark'=>$sparkUpdates,      'stitle'=>'UPDATEs · ' . $sparkTitle,
         'go'=>'feed:change', 'goLabel'=>'change rows', 'goTitle'=>'Show the CREATE / UPDATE / ROLLBACK / snapshot rows in Recent activity'],
        ['label'=>'Errors',                            'value'=>number_format($errTotal),                   'sub'=>$errorsSub, 'warn'=>$errTotal>0, 'spark'=>$sparkErrors, 'stitle'=>'errors · ' . $sparkTitle,
         'go'=>'feed:bad', 'goLabel'=>'error rows', 'goTitle'=>'Show the failure rows in Recent activity'],
    ]);

    // Run size - only for reports we have actually measured (same no-permanent-zero
    // rule as the scheduler card below). Headline is the MEDIAN, not the last or the
    // max: one unusually large run should not redefine what the report "is", and the
    // median is also what a cap would sensibly be set against.
    //
    // Cells, not rows, drives the warning - 6,000 x 83 and 40,000 x 12 cost the
    // browser the same, and ~500k cells is about a 10-second freeze (measured
    // 2026-08-20, ~18us/cell). See README section 4.
    if ((int)$sys['SIZED_RUNS'] > 0) {
        $medRows  = (int)$sys['MED_ROWS'];
        $medCols  = (int)$sys['MED_COLS'];
        $sizedN   = (int)$sys['SIZED_RUNS'];
        $maxCells = (int)$sys['MAX_CELLS'];
        $medMs    = (int)$sys['MED_MS'];
        $maxMs    = (int)$sys['MAX_MS'];
        $fmtMs = function ($ms) { return $ms >= 1000 ? round($ms / 1000, 1) . 's' : $ms . 'ms'; };

        $sizeBits = array();
        // Columns belong in the sub, not the headline: every other card's value is a
        // single number and the .v style is sized for one, so "4,569 × 9" wrapped
        // across two lines. Label carries the unit instead, matching "Views (30D)".
        $sizeBits[] = number_format($medCols) . ' column' . ($medCols === 1 ? '' : 's');
        // Say the denominator: "median of 1 run" is an honest thing to admit, and
        // without it the card looks like settled fact on its very first sample.
        $sizeBits[] = 'median of ' . number_format($sizedN) . ' measured run' . ($sizedN === 1 ? '' : 's');
        if ((int)$sys['MAX_ROWS'] > $medRows) {
            $sizeBits[] = 'peak ' . number_format((int)$sys['MAX_ROWS']) . ' rows';
        }
        $sizeBits[] = 'query ' . $fmtMs($medMs) . ($maxMs > $medMs ? ' (peak ' . $fmtMs($maxMs) . ')' : '');
        if ($maxCells >= 500000)      { $sizeBits[] = 'slow to display'; }
        elseif ($maxCells >= 250000)  { $sizeBits[] = 'large render'; }

        // A LITERAL multiplication sign, not &times; - the card renderer runs every
        // field through htmlspecialchars(), so an entity would show as raw text.
        // 'spark'/'stitle' are NOT optional: the renderer reads both unconditionally
        // and the JS does JSON.parse(dataset.spark).map(...), so a missing key becomes
        // null.map() - a TypeError that aborts the forEach and silently kills the
        // sparklines on every OTHER card too. Empty array = no trend drawn, which is
        // honest here (a size-over-time series is a separate piece of work).
        $kpis[] = ['label'  => 'Run Size (rows)',
                   'value'  => number_format($medRows),
                   'sub'    => implode(' · ', $sizeBits),
                   'warn'   => ($maxCells >= 500000),
                   'spark'  => array(),
                   'stitle' => 'median rows × columns over ' . number_format($sizedN) . ' measured run'
                             . ($sizedN === 1 ? '' : 's')];
    }

    // Scheduler card - only for reports that have ever had scheduler activity
    // (a never-scheduled report shouldn't carry a permanent zero card).
    // The headline number is RUNS, not emails - DB_DUMP/report tasks send no
    // email, so an email count under-represents scheduler activity; emails ride
    // in the sub-line instead.
    if ((int)$sys['SCHED_ALLTIME'] > 0) {
        $schedRuns = $schedRunsWindow; // same number the mix's Automation slice shows
        // EMAIL_COUNT / EMAILFAIL_COUNT are deliberately NOT here: they are the
        // manual Email dialog (see the SCHED_ALLTIME comment) and read as
        // "the scheduler sent 5 emails" when it sent none. Per-recipient counts
        // for scheduled sends live only in the SCHEDULE_RUN_OK message text.
        $delivBits = array();
        if ((int)$sys['SCHED_SKIP_COUNT'] > 0) $delivBits[] = $sys['SCHED_SKIP_COUNT'] . ' skipped';
        $delivBits[] = (int)$sys['SCHED_FAIL_COUNT'] > 0 ? $sys['SCHED_FAIL_COUNT'] . ' run-fail' : 'no failures';
        if ($sys['LAST_RUN_ACTION']) {
            $lr = 'FAIL';
            if ($sys['LAST_RUN_ACTION'] === 'SCHEDULE_RUN_OK')  $lr = 'OK';
            if ($sys['LAST_RUN_ACTION'] === 'SCHEDULE_SKIPPED') $lr = 'skipped';
            $delivBits[] = 'last ' . $lr . ' ' . $sys['LAST_RUN_AT'];
        }
        $delivWarn = ((int)$sys['SCHED_FAIL_COUNT'] > 0)
            || ($sys['LAST_RUN_ACTION'] !== null && $sys['LAST_RUN_ACTION'] !== 'SCHEDULE_RUN_OK' && $sys['LAST_RUN_ACTION'] !== 'SCHEDULE_SKIPPED');
        $kpis[] = ['label'=>'Sched Runs (' . $rangeLabelShort . ')', 'value'=>number_format($schedRuns),
                   'sub'=>implode(' · ', $delivBits), 'warn'=>$delivWarn, 'spark'=>$sparkRuns, 'stitle'=>'scheduler runs · ' . $sparkTitle,
                   'go'=>'feed:sched', 'goLabel'=>'scheduler rows', 'goTitle'=>'Show the SCHEDULE_* rows in Recent activity'];
    }
    return $kpis;
}

/**
 * The report's cards inside the one engine (E2b, 2026-10-01): each card's click
 * target re-pointed at the engine's own surfaces. $map is old 'go' =>
 * array(go, goLabel, goTitle). A target the engine does not have yet (the
 * Recent activity feed's 'feed:<family>' chips) is dropped, so that card
 * renders without a footer and is not a click target - like Run Size - until
 * the surface lands. Everything else on a card is left exactly as built.
 */
function penumbra_an_kpis_retarget($kpis, $map)
{
    foreach ($kpis as $i => $c) {
        if (empty($c['go'])) continue;
        if (isset($map[$c['go']])) {
            list($kpis[$i]['go'], $kpis[$i]['goLabel'], $kpis[$i]['goTitle']) = $map[$c['go']];
        } else {
            unset($kpis[$i]['go'], $kpis[$i]['goLabel'], $kpis[$i]['goTitle']);
        }
    }
    return $kpis;
}

/**
 * Top IPs (the one engine, E3a, 2026-10-01): the client addresses the report
 * was opened from in the window, busiest first (at most $fetch - the page's
 * $IP_FETCH), each tagged flagged (in $bpIps, penumbra_an_report_system()'s
 * BADPASS addresses) / campus / private / external. Moved out of analytics.php
 * verbatim. Aggregated IN SQL:
 * the old version fetched every OPEN row's SOURCE_DATA into PHP and parsed
 * JSON per row, which on ?range=all for a hot report (or __HOME__) shipped
 * the biggest scan in the app to the web tier. REGEXP_SUBSTR pulls just the
 * ip_address value out of the JSON server-side; rows whose SOURCE_DATA has no
 * ip fall into the NULL group and are dropped by the HAVING.
 * PERSON-LEVEL: the caller gates it. A database error is logged as
 * "$logLabel top IPs query failed: ..." and leaves the rows built so far.
 */
function penumbra_an_report_top_ips($run, $rid, $w, $exclSql, $exclBinds, $bpIps, $fetch, $logLabel)
{
    $timeFilter = $w['timeFilter'];
    $whenFilter = $w['whenFilter'];
    $ridBinds   = array(':rid' => $rid);
    $IP_FETCH   = (int)$fetch;
    $top_ips    = [];
    try {
        $ipRe   = '"ip_address"[[:space:]]*:[[:space:]]*"([^"]+)"';
        $ipExpr = "TO_CHAR(REGEXP_SUBSTR(SOURCE_DATA, '$ipRe', 1, 1, NULL, 1))";
        $rows = $run(
            "SELECT $ipExpr AS IP, COUNT(*) AS HITS, COUNT(DISTINCT USER_ID) AS USERS
               FROM PENUMBRA_AUDIT
              WHERE REPORT_ID = :rid AND ACTION='OPEN' $timeFilter $whenFilter $exclSql AND SOURCE_DATA IS NOT NULL
              GROUP BY $ipExpr
             HAVING $ipExpr IS NOT NULL
              ORDER BY HITS DESC FETCH FIRST $IP_FETCH ROWS ONLY",
            array_merge($ridBinds, $exclBinds)
        );
        foreach ($rows as $r) {
            $ip = (string)$r['IP'];
            // 'flagged' (had failed-access attempts this window) outranks the
            // location tags. Campus = NCSU ranges; private = RFC1918 only -
            // note 172.16-31 specifically, NOT all of 172/8 (172.32+ is public).
            if (isset($bpIps[$ip])) {
                $tag = 'flagged';
            } elseif (strpos($ip, '10.') === 0 || strpos($ip, '152.') === 0) {
                $tag = 'campus';
            } elseif (strpos($ip, '192.168.') === 0 || preg_match('/^172\.(1[6-9]|2[0-9]|3[01])\./', $ip)
                      || $ip === '::1' || $ip === '127.0.0.1'
                      || stripos($ip, 'fe80:') === 0 || preg_match('/^f[cd]/i', $ip)) {
                // ::1 / 127.x / fe80:: link-local / fc-fd ULA - the server's own
                // beacons (DEV_API, scheduler) arrive on these; "external" would
                // misread as off-campus traffic.
                $tag = 'private';
            } else {
                $tag = 'external';
            }
            $top_ips[] = ['ip' => $ip, 'hits' => (int)$r['HITS'], 'users' => (int)$r['USERS'], 'tag' => $tag];
        }
    } catch (Exception $e) {
        error_log("$logLabel top IPs query failed: " . $e->getMessage());
    }
    return $top_ips;
}

/**
 * How many rows the activity feed fetches (the one engine, E3a, 2026-10-01):
 * 200 by default; ?feed=N asks for deeper history when "Load older" runs out,
 * clamped to 50..2000 because every render pays for every fetched row's CLOB
 * reads. Returns array(fetch, max).
 */
function penumbra_an_feed_fetch_size($get)
{
    $FEED_FETCH = 200;
    $FEED_MAX   = 2000;
    if (isset($get['feed'])) {
        $FEED_FETCH = (int)$get['feed'];
        if ($FEED_FETCH < 50)        $FEED_FETCH = 50;
        if ($FEED_FETCH > $FEED_MAX) $FEED_FETCH = $FEED_MAX;
    }
    return array($FEED_FETCH, $FEED_MAX);
}

/**
 * The activity feed's family for one audit row (the one engine, E3a): view /
 * change / share / sched / journal / bad / other - the feed's chips (they
 * mirror get_audit_log.php's families). $msg = the row's message, for the
 * harmless browser aborts recorded before 2026-09-25 (not errors).
 */
function penumbra_an_feed_family($a, $msg = null)
{
    if ($a === 'OPEN') return 'view';
    // The browser's harmless page-animation aborts recorded before 2026-09-25
    // are not errors (penumbraErrorCondSql() leaves them out of every count).
    if ($a === 'CLIENT_ERROR' && $msg !== null && penumbraClientErrorIsBenign($msg)) return 'other';
    $bad = penumbraErrorActions(); // single source (db_connection.php)
    if (in_array($a, $bad, true) || $a === 'AUDIT_ACK') return 'bad';
    if (in_array($a, array('CREATE','UPDATE','DELETE','ROLLBACK'), true) || strpos($a, 'SNAPSHOT') === 0) return 'change';
    if ($a === 'EXPORT' || $a === 'EMAIL') return 'share';
    // (2026-11-17, metricsweep3) An upload made by hand is a change, like a save;
    // only the scheduler's own import refreshes belong under Scheduler.
    if (in_array($a, array('IMPORT_CREATE', 'IMPORT_APPEND', 'IMPORT_UPDATE', 'IMPORT_DELETE', 'IMPORT_RENAME'), true)) return 'change';
    if (strpos($a, 'SCHEDULE') === 0 || strpos($a, 'IMPORT') === 0) return 'sched';
    if (strpos($a, 'JOURNAL') === 0) return 'journal';
    return 'other';
}

/**
 * The report's activity feed (the one engine, E3a, 2026-10-01): its newest
 * audit rows (at most $fetch, see penumbra_an_feed_fetch_size()) under the
 * report page's scope ($scopeSql / $scopeBinds: user / department / IP and,
 * since 2026-10-03, the visibility toggles), each as ts / user / action / fam /
 * meta, where meta is the compact detail: address + browser + message from
 * SOURCE_DATA (the message salvaged when the JSON arrived truncated), the
 * scheduler's summary from AFTER / BEFORE, an UPDATE's state size change.
 * Moved out of analytics.php verbatim. PERSON-LEVEL: the caller gates it. A
 * database error is logged as "$logLabel feed query failed: ...".
 *
 * $noticeAddrs (2026-10-03): a scheduler failure's meta ends with what became
 * of its failure email, via penumbra_health.php's reader when the caller has
 * loaded it (analytics_all.php does) - who for true, a recipient count for false.
 *
 * $rid === null (2026-10-03): ALL reports - Platform Metrics' Activity tab.
 * $scopeSql is then Platform's own seam (system placeholders out, the
 * visibility toggles, user / department, the Report search; all unaliased) and
 * each row also carries 'report' (short id) and 'title'. Two steps so the CLOB
 * previews are read for the newest $fetch rows only, never for the table: the
 * inner query ranks ROWIDs alone, the outer reads those rows' previews.
 * (Since 2026-10-03 the report scope's caller passes the toggles too; the
 * report-scope SQL itself is unchanged.)
 */
function penumbra_an_report_feed($run, $rid, $scopeSql, $scopeBinds, $fetch, $logLabel, $noticeAddrs = false)
{
    $allReports = ($rid === null);
    $ridBinds   = $allReports ? array() : array(':rid' => $rid);
    $FEED_FETCH = (int)$fetch;
    $feed       = [];
    $withNotice = function_exists('penumbra_failure_notice_cols');
    // An OPEN row's run size (2026-11-14): real NUMBER columns stamped after the
    // response, so reading them costs no CLOB. Guarded like every other reader -
    // an install without the columns just shows no size.
    $withMetrics = function_exists('penumbraAuditHasMetrics') && penumbraAuditHasMetrics();
    try {
        if ($allReports) {
            $rows = $run(
                "SELECT TO_CHAR(a.TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') AS TS, a.ID AS AID, a.USER_ID, a.ACTION,"
                        . ($withMetrics ? " a.ROW_COUNT AS RC, a.COL_COUNT AS CC, a.QUERY_MS AS QMS," : '') . "
                        TRIM(r.SHORT_ID) AS RSHORT, r.TITLE AS RTITLE,
                        TO_CHAR(SUBSTR(a.SOURCE_DATA, 1, 2000)) AS SD,
                        JSON_VALUE(a.SOURCE_DATA, '\$.task_id') AS SD_TASK,"
                        . ($withNotice ? "\n                        " . penumbra_failure_notice_cols('a') . "," : '') . "
                        TO_CHAR(SUBSTR(a.\"AFTER\", 1, 2000)) AS AF,
                        TO_CHAR(SUBSTR(a.\"BEFORE\", 1, 2000)) AS BF,
                        DBMS_LOB.GETLENGTH(a.\"BEFORE\") AS BLEN,
                        DBMS_LOB.GETLENGTH(a.\"AFTER\")  AS ALEN
                   FROM PENUMBRA_AUDIT a
                   LEFT JOIN PENUMBRA_REPORTS r ON r.ID = a.REPORT_ID
                  WHERE a.ROWID IN (SELECT rid FROM (SELECT ROWID AS rid FROM PENUMBRA_AUDIT
                                                      WHERE 1=1 $scopeSql
                                                      ORDER BY TIMESTAMP DESC FETCH FIRST $FEED_FETCH ROWS ONLY))
                  ORDER BY a.TIMESTAMP DESC",
                $scopeBinds
            );
        } else {
        $rows = $run(
            "SELECT TO_CHAR(TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') AS TS, ID AS AID, USER_ID, ACTION,"
                    . ($withMetrics ? " ROW_COUNT AS RC, COL_COUNT AS CC, QUERY_MS AS QMS," : '') . "
                    TO_CHAR(SUBSTR(SOURCE_DATA, 1, 2000)) AS SD,
                    JSON_VALUE(SOURCE_DATA, '\$.task_id') AS SD_TASK,"
                    . ($withNotice ? "\n                    " . penumbra_failure_notice_cols('') . "," : '') . "
                    TO_CHAR(SUBSTR(\"AFTER\", 1, 2000)) AS AF,
                    TO_CHAR(SUBSTR(\"BEFORE\", 1, 2000)) AS BF,
                    DBMS_LOB.GETLENGTH(\"BEFORE\") AS BLEN,
                    DBMS_LOB.GETLENGTH(\"AFTER\")  AS ALEN
               FROM PENUMBRA_AUDIT WHERE REPORT_ID = :rid $scopeSql
              ORDER BY TIMESTAMP DESC FETCH FIRST $FEED_FETCH ROWS ONLY",
            array_merge($ridBinds, $scopeBinds)
        );
        }
        // Keep any one Detail chunk readable in a table cell
        $clip = function ($s, $max = 200) {
            $s = (string)$s;
            return (mb_strlen($s) > $max) ? mb_substr($s, 0, $max) . '…' : $s;
        };
        $fmtChars = function ($n) {
            $n = (int)$n;
            return ($n >= 1000) ? (round($n / 1000, 1) . 'k') : (string)$n;
        };
        foreach ($rows as $r) {
            $sdRaw = isset($r['SD']) ? (string)$r['SD'] : '';
            $sd = json_decode($sdRaw, true);
            $parts = [];
            $famMsg = null;   // the row's message, for penumbra_an_feed_family()'s harmless-abort check
            $taskId = '';     // a scheduler row's task, for its "scheduler" link (2026-10-03)
            if (is_array($sd)) {
                if (!empty($sd['ip_address'])) $parts[] = $sd['ip_address'];
                if (!empty($sd['browser'])) {
                    $b = $sd['browser']; $short = '';
                    if      (preg_match('/Edg\/(\d+)/',     $b, $m)) $short = 'Edge ' . $m[1];
                    elseif  (preg_match('/Chrome\/(\d+)/',  $b, $m)) $short = 'Chrome ' . $m[1];
                    elseif  (preg_match('/Firefox\/(\d+)/', $b, $m)) $short = 'Firefox ' . $m[1];
                    elseif  (strpos($b, 'Safari') !== false)         $short = 'Safari';
                    if ($short) $parts[] = $short;
                }
                if (!empty($sd['message'])) { $parts[] = $clip($sd['message']); $famMsg = (string)$sd['message']; }
            } else if ($sdRaw !== '' && preg_match('/"message"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/', $sdRaw, $m)) {
                // SOURCE_DATA longer than the SUBSTR above arrives truncated
                // mid-JSON (rich scheduler-run payloads: DB_DUMP context, query
                // excerpts, ...) and json_decode fails - which used to leave the
                // Detail cell completely empty. The runner writes 'message' as the
                // FIRST key, so it survives truncation - salvage it.
                $mv = json_decode('"' . $m[1] . '"');
                if (is_string($mv) && $mv !== '') { $parts[] = $clip($mv); $famMsg = $mv; }
            }

            // Scheduler events log their structured detail in AFTER (BEFORE for
            // deletes), not SOURCE_DATA - surface a compact summary: draft-test
            // flag, type + task #, subject, schedule. Handles both lowercase keys
            // (SCHEDULE_TEST_RUN detail) and uppercase row-shaped keys
            // (SCHEDULE_NEW/UPDATE/DELETE), and regex-salvages when the JSON was
            // truncated by the SUBSTR (the compact keys are written first).
            if (strpos((string)$r['ACTION'], 'SCHEDULE_') === 0) {
                $afRaw = (isset($r['AF']) && $r['AF'] !== null && $r['AF'] !== '')
                    ? (string)$r['AF']
                    : ((isset($r['BF']) && $r['BF'] !== null) ? (string)$r['BF'] : '');
                if ($afRaw !== '') {
                    $af = json_decode($afRaw, true);
                    $afStr = function ($k) use ($af, $afRaw) {
                        if (is_array($af)) {
                            $v = isset($af[$k]) ? $af[$k] : (isset($af[strtoupper($k)]) ? $af[strtoupper($k)] : null);
                            return (is_string($v) || is_numeric($v)) ? (string)$v : null;
                        }
                        if (preg_match('/"' . preg_quote($k, '/') . '"\s*:\s*(?:"((?:[^"\\\\]|\\\\.)*)"|(-?\d+))/i', $afRaw, $mm)) {
                            if (isset($mm[2]) && $mm[2] !== '') return $mm[2];
                            $v = json_decode('"' . $mm[1] . '"');
                            return is_string($v) ? $v : null;
                        }
                        return null;
                    };
                    $schedBits = [];
                    $isDraftTest = is_array($af) ? !empty($af['one_time_new_task'])
                                                 : (strpos($afRaw, '"one_time_new_task":true') !== false);
                    if ($isDraftTest) $schedBits[] = 'one-time draft test';
                    $tt  = $afStr('task_type');
                    $tid = $afStr('task_id');
                    if ($tid === null || $tid === '') $tid = $afStr('id');
                    if ($tid !== null && ctype_digit((string)$tid)) $taskId = (string)$tid;
                    if ($tt !== null && $tt !== '') $schedBits[] = $tt . (($tid !== null && $tid !== '') ? ' task #' . $tid : '');
                    $subj = $afStr('subject');
                    if ($subj !== null && $subj !== '') $schedBits[] = '"' . $clip($subj, 80) . '"';
                    $crn = $afStr('cron');
                    if ($crn === null || $crn === '') $crn = $afStr('cron_expression');
                    if ($crn !== null && $crn !== '') $schedBits[] = $clip($crn, 40);
                    if (!empty($schedBits)) $parts[] = implode(' · ', $schedBits);
                }
            }

            // A run row (SCHEDULE_RUN_OK / _FAIL ...) has no AFTER - its task is in
            // the runner's own context in SOURCE_DATA, read by JSON_VALUE (SD_TASK):
            // a run's payload (dump detail, error text) is often longer than the
            // 2000-char SD preview, which then cannot be decoded - live 2026-10-03,
            // 0 of 38 SCHEDULE_RUN_OK rows found their task from SD.
            if ($taskId === '' && strpos((string)$r['ACTION'], 'SCHEDULE_') === 0) {
                $sdTask = isset($r['SD_TASK']) ? trim((string)$r['SD_TASK']) : '';
                if ($sdTask === '' && is_array($sd) && isset($sd['task_id'])) $sdTask = (string)$sd['task_id'];
                if ($sdTask !== '' && ctype_digit($sdTask)) $taskId = $sdTask;
            }

            // OPEN rows (2026-11-14): what the open already recorded and the list
            // never showed - the run's size and time (stamped after the response,
            // so a failed or still-running open has none), the prompt values in
            // AFTER (positional, values only: no prompt names are stored), and the
            // display settings in SOURCE_DATA.ui. Nothing new is written.
            if ((string)$r['ACTION'] === 'OPEN') {
                if (isset($r['RC']) && $r['RC'] !== null && $r['RC'] !== '') {
                    $sz = number_format((int)$r['RC']) . ' row' . ((int)$r['RC'] === 1 ? '' : 's');
                    if (isset($r['CC']) && $r['CC'] !== null && $r['CC'] !== '') $sz .= ' × ' . (int)$r['CC'] . ' cols';
                    if (isset($r['QMS']) && $r['QMS'] !== null && $r['QMS'] !== '') {
                        $ms = (int)$r['QMS'];
                        $sz .= ' · ' . ($ms >= 1000 ? round($ms / 1000, 1) . ' s' : $ms . ' ms');
                    }
                    $parts[] = $sz;
                }
                $afOpen = (isset($r['AF']) && $r['AF'] !== null) ? json_decode((string)$r['AF'], true) : null;
                if (is_array($afOpen) && isset($afOpen['params']) && is_array($afOpen['params']) && !empty($afOpen['params'])) {
                    $pv = array();
                    foreach ($afOpen['params'] as $p) {
                        if (is_array($p)) {
                            $p = implode('/', array_map(function ($x) { return is_scalar($x) ? (string)$x : '…'; }, $p));
                        } elseif ($p === null) {
                            $p = '(blank)';
                        } elseif (is_bool($p)) {
                            $p = $p ? 'true' : 'false';
                        }
                        $p = (string)$p;
                        $pv[] = ($p === '') ? '(blank)' : $clip($p, 40);
                    }
                    // (pdedupe 2026-11-15) a prompt used more than once in the SQL binds
                    // its answer at every use. Rows written since then carry a label per
                    // bind: the values are grouped by prompt (a multi-select's or a date
                    // range's binds join with /) and each prompt is shown once, by name.
                    // Older rows have values only: when the list is one block repeated
                    // (a, b, a, b - a UNION's two halves) the block is shown once.
                    $lbls = (isset($afOpen['labels']) && is_array($afOpen['labels']) && count($afOpen['labels']) === count($pv)) ? array_values($afOpen['labels']) : null;
                    if ($lbls !== null) {
                        $grp = array(); $order = array();
                        foreach ($pv as $i => $v) {
                            $l = (string)$lbls[$i];
                            if (!isset($grp[$l])) { $grp[$l] = array(); $order[] = $l; }
                            $grp[$l][] = $v;
                        }
                        $pv = array();
                        foreach ($order as $l) {
                            $vals = $grp[$l]; $n = count($vals);
                            // the same prompt used k times pushed its values k times over
                            for ($k = $n; $k >= 2; $k--) {
                                if ($n % $k) continue;
                                $blk = array_slice($vals, 0, $n / $k);
                                if (array_merge(...array_fill(0, $k, $blk)) === $vals) { $vals = $blk; break; }
                            }
                            $pv[] = ($l !== '' ? $clip($l, 30) . ' ' : '') . implode('/', $vals);
                        }
                    } else {
                        $n = count($pv);
                        for ($len = 1; $len <= intdiv($n, 2); $len++) {
                            if ($n % $len) continue;
                            $blk = array_slice($pv, 0, $len);
                            if (array_merge(...array_fill(0, $n / $len, $blk)) === $pv) { $pv = $blk; break; }
                        }
                    }
                    $parts[] = 'prompts: ' . $clip(implode(', ', $pv), 160);
                }
                if (is_array($sd) && isset($sd['ui']) && is_array($sd['ui']) && !empty($sd['ui']['t'])) {
                    $uiBits = preg_replace('/^theme-/', '', (string)$sd['ui']['t']);
                    if (!empty($sd['ui']['d']) && $sd['ui']['d'] !== 'standard') $uiBits .= ', ' . $sd['ui']['d'];
                    $parts[] = $uiBits;
                }
            }

            // UPDATE rows: the BEFORE/AFTER payloads open with the multi-hundred-KB
            // 'report' state object, so the 2000-char SUBSTR can never reach the
            // scalar keys and a key-level diff is off the table. A size delta from
            // DBMS_LOB.GETLENGTH is cheap and still answers "how big a change?" -
            // the full diff lives in the report's Auditor tab.
            if ((string)$r['ACTION'] === 'UPDATE' && isset($r['BLEN'], $r['ALEN']) && $r['BLEN'] !== null && $r['ALEN'] !== null) {
                $dl = (int)$r['ALEN'] - (int)$r['BLEN'];
                $parts[] = 'state Δ ' . ($dl >= 0 ? '+' : '-') . $fmtChars(abs($dl))
                         . ' chars (' . $fmtChars($r['ALEN']) . ' total)';
            }

            if ($withNotice) {
                $nt = penumbra_failure_notice_text(penumbra_failure_notice((string)$r['ACTION'], $r), $noticeAddrs);
                if ($nt !== '') $parts[] = $nt;
            }

            $row = [
                'ts'     => $r['TS'],
                'user'   => isset($r['USER_ID']) ? $r['USER_ID'] : '(unknown)',
                'action' => $r['ACTION'],
                'fam'    => penumbra_an_feed_family((string)$r['ACTION'], $famMsg),
                'meta'   => implode(' · ', $parts),
                // For the Detail cell's links (2026-10-03): an UPDATE / ROLLBACK opens
                // Version History on this exact version (aid = the version entry's
                // id), a SCHEDULE_* row opens the report's Scheduler on its task.
                'aid'    => isset($r['AID']) ? (int)$r['AID'] : 0,
                'taskId' => $taskId,
            ];
            if ($allReports) {
                $row['report'] = (isset($r['RSHORT']) && $r['RSHORT'] !== null) ? (string)$r['RSHORT'] : '';
                $row['title']  = (isset($r['RTITLE']) && $r['RTITLE'] !== null) ? (string)$r['RTITLE'] : '';
            }
            $feed[] = $row;
        }
    } catch (Exception $e) {
        error_log("$logLabel feed query failed: " . $e->getMessage());
    }
    return $feed;
}

/**
 * Per-person sparklines (the one engine, E3b, 2026-10-01): each id's OPENs of
 * report $rid, bucketed like the card sparks ($sp = penumbra_an_report_sparks()'s
 * axis). The same follow-up query the old report page's Top viewers ran (its
 * builder, removed 2026-10-02, is frozen in the anengine suite as the reference
 * these sparks are proven against): no exclusion fragment - the list handed
 * in is already filtered - and no weekday/hour scope, the sparks show the
 * window. Ids go in IN-lists of 900 (Oracle stops at 1000) OR'd together.
 * Returns id => series in the ids' order; an id with no opens gets zeros, and
 * so does everyone when the database fails ("$logLabel user sparks query
 * failed: ..." in the error log).
 */
function penumbra_an_user_sparks($run, $rid, $ids, $sp, $logLabel, $seamSql = '')
{   // $seamSql (2026-11-17): the page's counting rule, so a viewer's spark sums to their Views
    $out = array();
    foreach ($ids as $u) $out[(string)$u] = array_fill(0, $sp['sparkLen'], 0);
    if (empty($out)) return $out;
    try {
        $ors = array(); $binds = array(':rid' => $rid); $i = 0;
        foreach (array_chunk(array_keys($out), 900) as $chunk) {
            $ph = array();
            foreach ($chunk as $u) { $key = ':u' . $i++; $ph[] = $key; $binds[$key] = $u; }
            $ors[] = 'USER_ID IN (' . implode(',', $ph) . ')';
        }
        $rows = $run(
            "SELECT USER_ID, {$sp['sparkBucketExpr']} AS BUCKET, COUNT(*) AS CNT
               FROM PENUMBRA_AUDIT
              WHERE REPORT_ID = :rid AND ACTION='OPEN'
                AND (" . implode(' OR ', $ors) . ")
                AND {$sp['sparkTimeCut']} $seamSql
              GROUP BY USER_ID, {$sp['sparkBucketExpr']}",
            $binds
        );
        $byUser = array();
        foreach ($rows as $r) $byUser[(string)$r['USER_ID']][$r['BUCKET']] = (int)$r['CNT'];
        foreach ($out as $u => $series) {
            foreach ($sp['sparkKeys'] as $idx => $kk) {
                if (isset($byUser[$u][$kk])) $out[$u][$idx] = $byUser[$u][$kk];
            }
        }
    } catch (Exception $e) {
        error_log("$logLabel user sparks query failed: " . $e->getMessage());
    }
    return $out;
}

/**
 * A report's current self-service subscribers (the one engine, E4b, 2026-10-01):
 * across its ACTIVE subscription-enabled EMAIL schedules - the STATE number that
 * gives the SUBSCRIBE / UNSUBSCRIBE events context. Returns array('tasks' => n,
 * 'subs' => n), or null when no schedule offers subscriptions or the lookup
 * fails (the meta line is then simply not shown). Moved out of analytics.php
 * verbatim; $oracleConn is the page's PDO connection.
 */
function penumbra_an_report_subscribers($oracleConn, $shortId)
{
    $sub_ctx = null;
    try {
        $subStmt = $oracleConn->prepare("SELECT OPTIONS FROM PENUMBRA_SCHEDULED_TASKS
                                         WHERE TRIM(REPORT_ID) = :sid AND TASK_TYPE = 'EMAIL' AND IS_ACTIVE = 1");
        $subStmt->bindValue(':sid', trim((string)$shortId));
        $subStmt->execute();
        $subTaskCount = 0;
        $subTotal = 0;
        while ($subRow = $subStmt->fetch(PDO::FETCH_ASSOC)) {
            $subOptsRaw = is_resource($subRow['OPTIONS']) ? stream_get_contents($subRow['OPTIONS']) : $subRow['OPTIONS'];
            $subOpts = json_decode((string)$subOptsRaw, true);
            if (!is_array($subOpts) || empty($subOpts['subscriptions_enabled']) || !empty($subOpts['_test_run_transient'])) continue;
            $subTaskCount++;
            if (isset($subOpts['subscribers']) && is_array($subOpts['subscribers'])) $subTotal += count($subOpts['subscribers']);
        }
        if ($subTaskCount > 0) $sub_ctx = array('tasks' => $subTaskCount, 'subs' => $subTotal);
    } catch (Exception $subCtxEx) { /* meta line simply not shown */ }
    return $sub_ctx;
}

/**
 * The REPORT's theme as an inline script for right after <body> (the one engine,
 * E4b, 2026-10-01). The report metrics page opened from the report itself
 * follows the report's own resolution - ?theme > its per-report pref
 * (penumbra_pref_theme[id]; the 'report-default' sentinel skips the global) >
 * the global pref (penumbra_user_theme) > the report's saved default
 * ($reportDefaultTheme, from its STATE_DATA) > theme-default - the priority
 * main.js uses for the report view (analytics.php's client script, run here at
 * the top so nothing paints in another palette first). Reached from Platform
 * Metrics (platform=1) a page takes the family chain instead -
 * penumbra_admin_theme_script().
 */
function penumbra_an_report_theme_script($reportDefaultTheme)
{
    echo "<script>\n";
    penumbra_emit_themes_js();
    echo 'window.PNB_REPORT_DEFAULT_THEME = ' . json_encode((string)$reportDefaultTheme) . ";\n";
    ?>
(function () {
    var ALL = (window.PENUMBRA_THEME_IDS || []);
    function apply(t) {
        t = window.penumbraResolveTheme(t);
        var meta = (window.PENUMBRA_THEMES || {})[t] || {};
        var b = document.body;
        b.classList.remove.apply(b.classList, ALL.concat(['is-dark', 'registry-theme']));
        if (t && t !== 'theme-default') {
            b.classList.add(t);
            if (meta.isDark) b.classList.add('is-dark');
            if (meta.modern) b.classList.add('registry-theme');
        }
    }
    function resolveTheme() {
        var qp = new URLSearchParams(window.location.search);
        if (qp.get('theme')) return qp.get('theme');
        var id = qp.get('id');
        var hasPref = false, pref = null;
        try {
            var prefs = JSON.parse(localStorage.getItem('penumbra_pref_theme') || '{}');
            if (id && Object.prototype.hasOwnProperty.call(prefs, id)) { hasPref = true; pref = prefs[id]; }
        } catch (e) { }
        if (hasPref && pref !== 'report-default') return pref;
        if (!hasPref) {
            try { var g = localStorage.getItem('penumbra_user_theme'); if (g) return g; } catch (e) { }
        }
        if (window.PNB_REPORT_DEFAULT_THEME) return window.PNB_REPORT_DEFAULT_THEME;
        return 'theme-default';
    }
    apply(resolveTheme());
})();
</script>
<?php
}

/**
 * The Consumption mix (step 2, increment 4, 2026-10-01): how the data reached
 * people in the window, as the five channels the donut draws IN THIS ORDER (its
 * palette is index-matched to the keys): Views (OPENs minus the dashboard
 * pulls, never below 0), Dashboards ('via dashboard' OPENs - embed tiles and
 * tile click-throughs; live JSON tiles are unaudited and appear in neither
 * slice), Exports, Emails (sent BY HAND from a report's Email dialog - the
 * scheduler never writes ACTION='EMAIL'), Automation (scheduled runs). The
 * channels overlap a little on purpose (an EMAIL task's run counts under
 * Automation too), and every slice renders, a zero slice is information too.
 * No query: each page passes its own KPI counters, so the donut always agrees
 * with the cards.
 */
function penumbra_an_mix($views, $dash, $exports, $emails, $automation)
{
    return array(
        'Views'      => max(0, (int)$views - (int)$dash),
        'Dashboards' => (int)$dash,
        'Exports'    => (int)$exports,
        'Emails'     => (int)$emails,
        'Automation' => (int)$automation,
    );
}

// ===========================================================================
// Presentational helpers
// ===========================================================================

/**
 * "25 of 312 users" for a card header.
 *
 * Replaces "25 loaded+", which announced that more existed without ever saying
 * how much more - the one fact you need to decide whether expanding is worth
 * it. Collapses to a plain count when the whole list is on screen. The total
 * comes from a COUNT query mirroring the list's own predicates; if that query
 * failed it falls back to the rendered count, so this can under-report but
 * never invent.
 */
function penumbra_loaded_of($shown, $total, $noun)
{
    $shown = (int)$shown; $total = (int)$total;
    if ($total > $shown) {
        return number_format($shown) . ' of ' . number_format($total) . ' ' . htmlspecialchars($noun);
    }
    return number_format($shown) . ' ' . htmlspecialchars($noun);
}

/**
 * Does this table need reveal controls at all?
 *
 * Single source for the header toolbar and the footer, which must agree: a
 * "Show more" at the top of a table with no footer (or vice versa) is a control
 * with nothing to control.
 */
function penumbra_list_more_needed($total, $capped, $step)
{
    return ($total > $step || $capped);
}

/**
 * The shared "Show more / Show all" footer under a capped table.
 *
 * Every row is already in the DOM; the footer only controls how many are
 * VISIBLE. It renders nothing when the whole result set fits in one step and
 * the server had no more to give. $step is per-table because rollup cards are
 * much shorter than row-level ones. The buttons' second mode (raise ?rows= and
 * reload) is wired in the shared JS.
 */
function penumbra_list_more_footer($total, $capped, $noun, $step)
{
    if (!penumbra_list_more_needed($total, $capped, $step)) return;
    ?>
    <div class="list-more" data-step="<?php echo (int)$step; ?>" data-total="<?php echo (int)$total; ?>"
         data-capped="<?php echo $capped ? '1' : '0'; ?>" data-noun="<?php echo htmlspecialchars($noun); ?>">
        <button type="button" class="lm-btn lm-more">Show more</button>
        <button type="button" class="lm-btn lm-all">Show all</button>
        <span class="lm-note" aria-live="polite"></span>
    </div>
    <?php
}

/**
 * Card/panel-header toolbar: quick filter + reveal controls + CSV.
 *
 * The footer controls are a scroll away once a table is long - which is exactly
 * when someone wants them - so the reveal pair is mirrored here, next to the
 * row count, wired to the SAME per-table state.
 *
 * "Show all" is the escape hatch: reveal every fetched row, or - when the server
 * hit its own fetch cap - reload with a bigger ?rows= plus expandall=1 so the
 * list comes back already expanded. Without expandall the reload lands back on
 * one step and the button looks like it did nothing.
 *
 * The quick filter appears once a table is long enough that scanning it by eye
 * is the slow part; below that it is pure chrome. It is NOT a form field (no
 * name attribute) - it never reaches the server.
 *
 * CSV sits outside the reveal condition: a 6-row table is still worth exporting.
 */
function penumbra_table_tools($total, $capped, $noun, $step, $csvName, $opts = array())
{
    $FILTER_MIN = isset($opts['filterMin']) ? (int)$opts['filterMin'] : 10;
    $showCsv    = !isset($opts['csv']) || $opts['csv'];
    // The toolbar carries the reveal metadata too, so a panel can have header
    // controls WITHOUT a footer (the dense side panels have no room for one).
    // The controller reads whichever of the two exists.
    ?>
    <span class="tbl-tools" data-step="<?php echo (int)$step; ?>"
          data-capped="<?php echo $capped ? '1' : '0'; ?>" data-noun="<?php echo htmlspecialchars($noun); ?>">
        <?php if ($total >= $FILTER_MIN): ?>
            <input type="search" class="tt-filter" placeholder="Filter <?php echo htmlspecialchars($noun); ?>&hellip;"
                   aria-label="Filter these <?php echo htmlspecialchars($noun); ?> by text"
                   autocomplete="off" spellcheck="false">
        <?php endif; ?>
        <?php if (penumbra_list_more_needed($total, $capped, $step)): ?>
            <button type="button" class="tt-btn lm-more" title="Reveal <?php echo (int)$step; ?> more rows">Show more</button>
            <button type="button" class="tt-btn lm-all" title="Reveal every <?php echo htmlspecialchars($noun); ?> in this view">Show all</button>
        <?php endif; ?>
        <?php if ($showCsv): ?>
            <button type="button" class="tt-btn tt-csv" data-csv="<?php echo htmlspecialchars($csvName); ?>"
                    title="Download these rows as a CSV file">CSV</button>
        <?php endif; ?>
    </span>
    <?php
}

/**
 * Count badge for a tab label.
 *
 * Its own background + glyph color, never inherited: a theme's `button:hover`
 * fill sets `color` on the BUTTON, and inheritance loses to a direct
 * declaration on the span - so the badge stays legible on every hover fill.
 */
function penumbra_tab_badge($n, $danger = false)
{
    if ((int)$n <= 0) return '';
    return ' <span class="tab-badge' . ($danger ? '' : ' neutral') . '">' . number_format((int)$n) . '</span>';
}

/**
 * Report OWNER_ID -> campus email address, or '' when it cannot be trusted.
 *
 * THE CHARACTER WHITELIST IS LOAD-BEARING, NOT COSMETIC. This value is rendered
 * into a data- attribute, collected by the bulk mailer and posted to share.php,
 * where it lands in a To: header. A stored OWNER_ID carrying CR/LF would inject
 * headers; one carrying a comma or semicolon would smuggle extra recipients past
 * the count cap. Same rule as submit_home_form.php's owner lookup and
 * report_auth.php's penumbraFeedbackTargetAllowed().
 *
 * Returning '' is a real answer: the caller must SKIP that report and say so,
 * never fall back to guessing an address.
 */
function penumbra_owner_email($ownerId)
{
    $o = strtolower(trim((string)$ownerId));
    if ($o === '' || $o === 'system' || $o === '__system__' || $o === 'noone') return '';
    // Already a full address (some legacy rows). FILTER_VALIDATE_EMAIL alone is
    // NOT enough: it accepts RFC-legal exotica like a QUOTED local part
    // ("a"@b.com), and quotes in a To: header are a parser's problem, not a
    // mailbox. Require the plain shape as well.
    if (strpos($o, '@') !== false) {
        $plain = preg_match('/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/', $o);
        return ($plain && filter_var($o, FILTER_VALIDATE_EMAIL)) ? $o : '';
    }
    if (!preg_match('/^[a-z0-9._-]+$/', $o)) return '';
    return $o . '@ncsu.edu';
}

/**
 * "This table is filtered" tags for a table card's header (2026-09-23).
 *
 * The chip bar says what the PAGE is filtered by, but a table a screen further
 * down said nothing - and tables do not all honour the same filters: Dead
 * Reports reads the User filter as the report's OWNER, the Errors list ignores
 * the visibility toggles, the activity feed ignores the date window. So each
 * table names, beside its own title, the active filters that shaped it, and
 * - in a quieter dashed tag - the active filters it does NOT apply. A table
 * that silently ignores a filter the page shows as on is the worst case.
 *
 * The date window is deliberately NOT a tag: every table header already
 * prints it (or, like the feed, lists it as not applied).
 *
 * @param array $applied     active filters this table honours: each a string,
 *                           or array(label, value) joined with a space
 * @param array $notApplied  active page filters this table ignores (same shape)
 * @return string  HTML; '' when neither list has anything in it
 */
function penumbra_an_filter_tags($applied, $notApplied = array())
{
    $fmt = function ($f) {
        return is_array($f) ? trim(implode(' ', $f)) : trim((string)$f);
    };
    $on  = array_values(array_filter(array_map($fmt, (array)$applied), 'strlen'));
    $off = array_values(array_filter(array_map($fmt, (array)$notApplied), 'strlen'));
    if (empty($on) && empty($off)) return '';
    $out = '<span class="an-ftags">';
    if (!empty($on)) {
        $txt = implode(' · ', $on);
        $out .= '<span class="an-ftag" title="' . htmlspecialchars('This table is filtered by: ' . $txt) . '">'
              . '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>'
              . '<span class="sr-only">Filtered by </span><span class="an-ftag-t">' . htmlspecialchars($txt) . '</span></span>';
    }
    if (!empty($off)) {
        $txt = implode(' · ', $off);
        $out .= '<span class="an-ftag off" title="' . htmlspecialchars('On for this page, but NOT applied to this table: ' . $txt) . '">'
              . '<span class="an-ftag-t">not applied: ' . htmlspecialchars($txt) . '</span></span>';
    }
    return $out . '</span>';
}

/**
 * Quick spans offered inside the custom-range panel.
 *
 * Computed SERVER-side so they line up with the server-local timestamps every
 * query and the heatmap use - a client-side new Date() would drift for a viewer
 * in another timezone. Fiscal year runs Jul 1 - Jun 30.
 */
function penumbra_quick_ranges()
{
    $todayYmd    = date('Y-m-d');
    $lastMonthTs = strtotime('first day of last month');
    $fiscalYear  = ((int)date('n') >= 7) ? (int)date('Y') : ((int)date('Y') - 1);
    return array(
        'This month'   => array(date('Y-m-01'), $todayYmd),
        'Last month'   => array(date('Y-m-01', $lastMonthTs), date('Y-m-t', $lastMonthTs)),
        'Year to date' => array(date('Y-01-01'), $todayYmd),
        'Fiscal YTD'   => array($fiscalYear . '-07-01', $todayYmd),
    );
}

/*
 * Panel bodies both metrics pages render the same way (step 2, increment 4,
 * 2026-10-01). Each page keeps its own wrapper, heading and - where the two
 * pages word it differently - its own empty state; only the markup that was
 * byte-identical in both lives here.
 */

/**
 * The Consumption mix body: the donut's canvas and its screen-reader table, or
 * the empty state when every channel is 0. The donut is drawn by the page's
 * script from the same $mix (const mix).
 */
function penumbra_an_mix_body(array $mix, $rangeLabelShort)
{
    if (array_sum($mix) === 0): ?>
<div class="chart-empty">No activity in this date range</div>
<?php else: ?>
<canvas id="mixChart" aria-hidden="true"></canvas>
<div class="sr-only">
    <table>
        <caption>Consumption mix (<?php echo htmlspecialchars($rangeLabelShort); ?>)</caption>
        <thead><tr><th scope="col">Channel</th><th scope="col">Count</th></tr></thead>
        <tbody>
        <?php foreach ($mix as $mn => $mc): ?>
            <tr><td><?php echo htmlspecialchars($mn); ?></td><td><?php echo (int)$mc; ?></td></tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif;
}

// ===========================================================================
// Display Settings (2026-10-11): which themes / densities / row heights are used
// ===========================================================================
//
// Two sources, deliberately side by side:
//   VIEWERS  - what each report run was actually shown with. The browser keeps
//              these prefs in localStorage; since 2026-10-11 main.js posts them
//              with the query and query.php writes them into the OPEN row's
//              SOURCE_DATA.ui ({t, d, rx} + ts/ds/rs = why it differs from the
//              report's default). Nothing before that date carries them.
//   DEFAULTS - what report authors saved (PENUMBRA_REPORTS.STATE_DATA theme /
//              density / rowExpandDefault). Present state, so not windowed.
// Both are ONE scan each: GROUPING SETS give every per-setting count, the
// "changed from the default" counts and the grand total in a single pass.

/** The first day OPEN rows carry SOURCE_DATA.ui - the subtitle says so for windows reaching before it. */
function penumbra_an_ui_since() { return '2026-10-11'; }

/**
 * Viewer settings for one scope of PENUMBRA_AUDIT.
 *
 * @param string $where  the page's windowed scope (already AND-joinable; the
 *                       OPEN action and the ui-key prefilter are added here)
 * @return array 'opens' / 'people' (rows that carry settings), 'changed' =
 *               array(opens, people) for runs where ANY setting differed from
 *               the report's default, and per key t / d / rx / ts / ds / rs:
 *               value => array(opens, people), largest first.
 */
function penumbra_an_ui_usage($run, $where, $binds, $logLabel)
{
    $out = array('opens' => 0, 'people' => 0, 'changed' => array(0, 0),
                 't' => array(), 'd' => array(), 'rx' => array(), 'ts' => array(), 'ds' => array(), 'rs' => array());
    try {
        $rows = $run(
            'SELECT T, D, RX, TS, DS, RS, ANYC,
                    GROUPING(T) AS G_T, GROUPING(D) AS G_D, GROUPING(RX) AS G_RX,
                    GROUPING(TS) AS G_TS, GROUPING(DS) AS G_DS, GROUPING(RS) AS G_RS, GROUPING(ANYC) AS G_ANYC,
                    COUNT(*) AS N, COUNT(DISTINCT USER_ID) AS U
               FROM (SELECT USER_ID, T, D, RX, TS, DS, RS,
                            CASE WHEN TS IS NOT NULL OR DS IS NOT NULL OR RS IS NOT NULL THEN \'Y\' ELSE \'N\' END AS ANYC
                       FROM (SELECT USER_ID,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.t\'  RETURNING VARCHAR2(60)) AS T,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.d\'  RETURNING VARCHAR2(20)) AS D,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.rx\' RETURNING VARCHAR2(5))  AS RX,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.ts\' RETURNING VARCHAR2(10)) AS TS,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.ds\' RETURNING VARCHAR2(10)) AS DS,
                                    JSON_VALUE(SOURCE_DATA, \'$.ui.rs\' RETURNING VARCHAR2(10)) AS RS
                               FROM PENUMBRA_AUDIT
                              WHERE ACTION = \'OPEN\' AND SOURCE_DATA LIKE \'%"ui":{%\' AND ' . $where . '))
              GROUP BY GROUPING SETS ((T), (D), (RX), (TS), (DS), (RS), (ANYC), ())',
            $binds
        );
        foreach ($rows as $r) {
            $n = (int)$r['N']; $u = (int)$r['U'];
            $g = array('t' => (int)$r['G_T'], 'd' => (int)$r['G_D'], 'rx' => (int)$r['G_RX'],
                       'ts' => (int)$r['G_TS'], 'ds' => (int)$r['G_DS'], 'rs' => (int)$r['G_RS'], 'anyc' => (int)$r['G_ANYC']);
            if (array_sum($g) === 7) { $out['opens'] = $n; $out['people'] = $u; continue; }   // the () set
            foreach ($g as $key => $grouped) {
                if ($grouped) continue;
                $val = $r[strtoupper($key)];
                if ($key === 'anyc') { if ($val === 'Y') $out['changed'] = array($n, $u); break; }
                if ($val === null || $val === '') break;   // a source key is NULL when unchanged
                // (2026-11-17, metricsweep3) A renamed theme is one theme: opens
                // recorded under the old id (theme-charcoal-gold) made a second,
                // raw-named row beside Graphite & Brass. Opens add up; people take
                // the larger of the two, since they are largely the same people.
                $vk = ($key === 't') ? penumbra_an_ui_theme_id($val) : (string)$val;
                if (isset($out[$key][$vk])) { $out[$key][$vk] = array($out[$key][$vk][0] + $n, max($out[$key][$vk][1], $u)); }
                else { $out[$key][$vk] = array($n, $u); }
                break;
            }
        }
        foreach (array('t', 'd', 'rx', 'ts', 'ds', 'rs') as $key) {
            uasort($out[$key], function ($a, $b) { return $b[0] - $a[0]; });
        }
    } catch (Exception $e) {
        error_log("$logLabel display-settings usage query failed: " . $e->getMessage());
    }
    return $out;
}

/**
 * Saved report defaults (present state). $reportFilterA / $reportBinds are the
 * page's report + tag filter in its `r`-aliased form; placeholders and the
 * system rows are left out.
 *
 * @return array 'reports' => total, and t / d / rx => value => count, largest first
 */
function penumbra_an_ui_defaults($run, $sysShortIdSql, $reportFilterA, $reportBinds, $logLabel)
{
    $out = array('reports' => 0, 't' => array(), 'd' => array(), 'rx' => array());
    try {
        $rows = $run(
            'SELECT T, D, RX, GROUPING(T) AS G_T, GROUPING(D) AS G_D, GROUPING(RX) AS G_RX, COUNT(*) AS N
               FROM (SELECT NVL(JSON_VALUE(r.STATE_DATA, \'$.theme\' RETURNING VARCHAR2(60)), \'theme-default\') AS T,
                            NVL(JSON_VALUE(r.STATE_DATA, \'$.density\' RETURNING VARCHAR2(20)), \'standard\') AS D,
                            NVL(JSON_VALUE(r.STATE_DATA, \'$.rowExpandDefault\' RETURNING VARCHAR2(10)), \'unset\') AS RX
                       FROM PENUMBRA_REPORTS r
                      WHERE TRIM(r.SHORT_ID) NOT IN (' . $sysShortIdSql . ')
                        AND (r.OWNER_ID IS NULL OR r.OWNER_ID <> \'__SYSTEM__\') ' . $reportFilterA . ')
              GROUP BY GROUPING SETS ((T), (D), (RX), ())',
            $reportBinds
        );
        foreach ($rows as $r) {
            $n = (int)$r['N'];
            if ((int)$r['G_T'] && (int)$r['G_D'] && (int)$r['G_RX']) { $out['reports'] = $n; continue; }
            if (!(int)$r['G_T'])  { $k = penumbra_an_ui_theme_id($r['T']); $out['t'][$k] = (isset($out['t'][$k]) ? $out['t'][$k] : 0) + $n; }
            elseif (!(int)$r['G_D'])  { $out['d'][(string)$r['D']] = $n; }
            elseif (!(int)$r['G_RX']) { $rx = strtolower((string)$r['RX']); $rx = ($rx === 'true' || $rx === '1') ? '1' : (($rx === 'false' || $rx === '0') ? '0' : 'unset'); $out['rx'][$rx] = (isset($out['rx'][$rx]) ? $out['rx'][$rx] : 0) + $n; }
        }
        foreach (array('t', 'd', 'rx') as $key) arsort($out[$key]);
    } catch (Exception $e) {
        error_log("$logLabel display-settings defaults query failed: " . $e->getMessage());
    }
    return $out;
}

/** A saved theme value as its registry id (aliases and bare names resolve; unknown values pass through). */
function penumbra_an_ui_theme_id($raw)
{
    $s = strtolower(trim((string)$raw));
    if ($s === '') return 'theme-default';
    if (!function_exists('penumbra_get_themes')) return $s;
    $themes = penumbra_get_themes();
    if (isset($themes[$s])) return $s;
    if (strpos($s, 'theme-') !== 0 && isset($themes['theme-' . $s])) return 'theme-' . $s;
    $aliases = penumbra_build_alias_map();
    return isset($aliases[$s]) ? $aliases[$s] : $s;
}

/** Plain-text label for one value of one setting. */
function penumbra_an_ui_label($key, $val)
{
    if ($key === 't') {
        $themes = function_exists('penumbra_get_themes') ? penumbra_get_themes() : array();
        return isset($themes[$val]['label']) ? $themes[$val]['label'] : $val;
    }
    if ($key === 'd') {
        $m = array('standard' => 'Standard', 'compact' => 'Compact', 'easy-read' => 'Easy Read');
        return isset($m[$val]) ? $m[$val] : $val;
    }
    $m = array('1' => 'On', '0' => 'Off', 'unset' => 'Not set');
    return isset($m[$val]) ? $m[$val] : $val;
}

/** Rows a Display Settings list shows before its "Show N more" (every row is already in the page). */
function penumbra_an_ui_show() { return 6; }

/** One ranked bar list of the Display Settings card; rows past the first few fold behind a toggle. */
function penumbra_an_ui_list($key, array $rows, $of, $isDef)
{
    $show = penumbra_an_ui_show();
    $i = 0;
    echo '<ul class="ui-list' . ($isDef ? ' is-def' : '') . '">';
    foreach ($rows as $val => $v) {
        $n = $isDef ? (int)$v : (int)$v[0];
        $label = penumbra_an_ui_label($key, (string)$val);
        if ($isDef) {
            $tip = number_format($n) . ($n === 1 ? ' report' : ' reports') . ' default to ' . $label
                 . ($key === 'rx' && (string)$val === 'unset' ? ' (each viewer\'s own choice applies)' : '');
            $num = number_format($n);
        } else {
            $p = (int)$v[1];
            $tip = number_format($n) . ' report opens by ' . number_format($p) . ($p === 1 ? ' person' : ' people');
            $num = ($of > 0 ? round($n * 100 / $of) : 0) . '%<small>' . number_format($p) . ($p === 1 ? ' person' : ' people') . '</small>';
        }
        echo '<li' . ($i >= $show ? ' class="ui-x"' : '') . ' title="' . htmlspecialchars($tip) . '">'
           . '<span class="ui-name">' . htmlspecialchars($label) . '</span>'
           . '<span class="ui-bar' . ($isDef ? ' def' : '') . '" aria-hidden="true"><i style="width:' . max(2, round($n * 100 / max(1, $of))) . '%"></i></span>'
           . '<span class="ui-num">' . $num . '</span></li>';
        $i++;
    }
    echo '</ul>';
    if ($i > $show) {
        $more = 'Show ' . ($i - $show) . ' more';
        echo '<button type="button" class="ui-more" aria-expanded="false" data-more="' . $more . '" data-less="Show fewer">' . $more . '</button>';
    }
}

/**
 * The Display Settings card body: Theme | Density | Consistent Row Height,
 * each a panel with two sections - what viewers used (people + opens, and how
 * often they left the report's default and why) and what the reports
 * themselves default to. Long lists fold after penumbra_an_ui_show() rows;
 * the toggle is client-side only.
 */
function penumbra_an_ui_body(array $use, array $def)
{
    $cols = array(
        array('t',  'ts', 'Theme'),
        array('d',  'ds', 'Density'),
        array('rx', 'rs', 'Consistent Row Height'),
    );
    $whyLabels = array('pin' => 'their setting for that report', 'mine' => 'their own default',
                       'url' => 'the link they followed', 'set' => 'changed and not saved');
    $opens  = (int)$use['opens'];
    $people = (int)$use['people'];
    $pct = function ($n, $of) { return $of > 0 ? round($n * 100 / $of) . '%' : '0%'; };
    ?>
<div class="ui-grid">
<?php foreach ($cols as $c): list($key, $srcKey, $title) = $c; ?>
    <section class="ui-col">
        <h4><?php echo htmlspecialchars($title); ?></h4>
        <div class="ui-sec">
            <div class="ui-sub"><span>What viewers used</span><?php if ($opens > 0): ?><span class="ui-sub-n"><?php echo number_format($people) . ($people === 1 ? ' person' : ' people') . ' &middot; ' . number_format($opens) . ($opens === 1 ? ' open' : ' opens'); ?></span><?php endif; ?></div>
            <?php if ($opens === 0): ?>
                <div class="ui-none">Nothing recorded yet</div>
            <?php else: ?>
            <?php penumbra_an_ui_list($key, $use[$key], $opens, false); ?>
            <?php
                $chg = 0; foreach ($use[$srcKey] as $nu) $chg += $nu[0];
            ?>
            <div class="ui-changed<?php echo $chg > 0 ? ' is-on' : ''; ?>">
                <strong><?php echo $pct($chg, $opens); ?></strong> of opens differed from the report's default<?php
                if ($chg > 0) {
                    $parts = array();
                    foreach ($use[$srcKey] as $src => $nu) {
                        $parts[] = htmlspecialchars((isset($whyLabels[$src]) ? $whyLabels[$src] : $src)) . ' ' . number_format($nu[0]);
                    }
                    echo '<div class="ui-why">by ' . implode(' &middot; ', $parts) . '</div>';
                }
            ?>
            </div>
            <?php endif; ?>
        </div>
        <div class="ui-sec ui-sec-def">
            <div class="ui-sub"><span>Report defaults</span><?php if ($def['reports'] > 0): ?><span class="ui-sub-n"><?php echo number_format($def['reports']); ?> reports</span><?php endif; ?></div>
            <?php if (empty($def[$key])): ?>
                <div class="ui-none">No reports</div>
            <?php else: ?>
            <?php penumbra_an_ui_list($key, $def[$key], (int)$def['reports'], true); ?>
            <?php endif; ?>
        </div>
    </section>
<?php endforeach; ?>
</div>
<script>
(function () {
    if (window.__pnbUiMore) return; window.__pnbUiMore = 1;
    document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.ui-more') : null;
        if (!b) return;
        var ul = b.previousElementSibling, open = !ul.classList.contains('ui-open');
        ul.classList.toggle('ui-open', open);
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.textContent = open ? b.getAttribute('data-less') : b.getAttribute('data-more');
    });
})();
</script>
<?php
}

/**
 * One person's latest Display Settings for the report page's Top Users table:
 * $raw is that person's newest OPEN's SOURCE_DATA.ui (JSON text, from the
 * users query itself - no extra round trip), $at when it was. A setting that
 * differed from the report's default carries its reason and is marked.
 */
function penumbra_an_ui_cell($raw, $at)
{
    $ui = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($ui)) {
        echo '<span style="color:var(--text-muted);" title="No settings recorded (opens before ' . htmlspecialchars(date('M j, Y', strtotime(penumbra_an_ui_since()))) . ' do not carry them)">-</span>';
        return;
    }
    $why = array('pin' => 'their setting for this report', 'mine' => 'their own default',
                 'url' => 'the link they followed', 'set' => 'changed and not saved');
    $bits = array(); $tips = array();
    foreach (array(array('t', 'ts', 'Theme'), array('d', 'ds', 'Density'), array('rx', 'rs', 'Row height')) as $k) {
        list($key, $src, $name) = $k;
        if (!isset($ui[$key]) || $ui[$key] === '') continue;
        $val = (string)$ui[$key];
        if ($key === 't') $val = penumbra_an_ui_theme_id($val);
        $label = penumbra_an_ui_label($key, $val);
        if ($key === 'rx') $label = 'Rows ' . strtolower($label);
        $s = isset($ui[$src]) ? (string)$ui[$src] : '';
        $bits[] = '<span class="ui-cv' . ($s !== '' ? ' is-chg' : '') . '">' . htmlspecialchars($label) . '</span>';
        $tips[] = $name . ': ' . $label . ($s !== '' ? ' - not the report\'s default (' . (isset($why[$s]) ? $why[$s] : $s) . ')' : '');
    }
    if (empty($bits)) { echo '<span style="color:var(--text-muted);">-</span>'; return; }
    echo '<span class="ui-cell" title="' . htmlspecialchars('Latest open ' . $at . "\n" . implode("\n", $tips)) . '">' . implode('<i aria-hidden="true">&middot;</i>', $bits) . '</span>';
}

/**
 * The heatmap's screen-reader table: one row per weekday (Monday first, the
 * order penumbra_an_heatmap() builds), one cell per hour. $caption is plain
 * text (escaped here); each page words it its own way.
 */
function penumbra_an_heat_sr_table(array $heatRows, $caption)
{
    $dayNames = array('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'); ?>
<div class="sr-only">
    <table>
        <caption><?php echo htmlspecialchars($caption); ?></caption>
        <thead><tr><th scope="col">Day</th><?php for ($h = 0; $h < 24; $h++): ?><th scope="col"><?php echo str_pad($h, 2, '0', STR_PAD_LEFT); ?>:00</th><?php endfor; ?></tr></thead>
        <tbody>
        <?php foreach ($heatRows as $di => $hrs): ?>
            <tr><th scope="row"><?php echo $dayNames[$di]; ?></th><?php for ($h = 0; $h < 24; $h++): ?><td><?php echo (int)$hrs[$h]; ?></td><?php endfor; ?></tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php
}

/**
 * Top departments rows (penumbra_an_departments()['depts']): a real unit is a
 * filter button (data-filter="ouc"), a named unit without a real OUC is plain
 * text, the "(not in directory)" bucket is muted.
 */
function penumbra_an_dept_rows(array $depts)
{
    foreach ($depts as $d): ?>
<tr>
    <td>
        <?php if ($d['known'] && $d['ouc'] !== ''): ?>
            <button type="button" class="fbtn" data-filter="ouc" data-value="<?php echo htmlspecialchars($d['ouc']); ?>" title="Filter the whole page to OUC <?php echo htmlspecialchars($d['ouc']); ?>"><span class="pill"><?php echo htmlspecialchars($d['ouc']); ?></span> <?php echo htmlspecialchars($d['label']); ?></button>
        <?php elseif ($d['known']): ?>
            <?php echo htmlspecialchars($d['label']); ?>
        <?php else: ?>
            <span style="color:var(--text-muted); font-style:italic;"><?php echo htmlspecialchars($d['dept']); ?></span>
        <?php endif; ?>
    </td>
    <td class="num"><?php echo number_format($d['views']); ?></td>
    <td class="num"><?php echo number_format($d['users']); ?></td>
</tr>
<?php endforeach;
}

/**
 * Top colleges rows (penumbra_an_departments()['colleges']): a known college is
 * a filter button on its 2-digit prefix; an unknown prefix shows its code pill
 * beside the muted label, the "(not in directory)" bucket just the label.
 */
function penumbra_an_college_rows(array $colleges)
{
    foreach ($colleges as $c): ?>
<tr>
    <td>
        <?php if ($c['known']): ?>
            <button type="button" class="fbtn" data-filter="ouc" data-value="<?php echo htmlspecialchars($c['code']); ?>" title="Filter the whole page to college prefix <?php echo htmlspecialchars($c['code']); ?>"><span class="pill"><?php echo htmlspecialchars($c['code']); ?></span> <?php echo htmlspecialchars($c['label']); ?></button>
        <?php else: ?>
            <?php if ($c['code'] !== ''): ?><span class="pill"><?php echo htmlspecialchars($c['code']); ?></span> <?php endif; ?>
            <span style="color:var(--text-muted); font-style:italic;"><?php echo htmlspecialchars($c['label']); ?></span>
        <?php endif; ?>
    </td>
    <td class="num"><?php echo number_format($c['views']); ?></td>
    <td class="num"><?php echo number_format($c['users']); ?></td>
</tr>
<?php endforeach;
}

// ===========================================================================
// Shared CSS
// ===========================================================================

/**
 * Styles for everything this file renders. Emitted INSIDE each page's own
 * <style> block, after that page's base rules, so a page-local override still
 * wins on source order where it needs to.
 *
 * Deliberately scoped to the shared class names only - neither page's layout,
 * panels or KPI cards are touched from here.
 */
/**
 * The analytics console SHELL - sidebar + sticky wrapper + filter groups +
 * main column. Extracted from analytics_all.php 2026-08-19 so analytics.php
 * (per-report metrics) renders the IDENTICAL left-sidebar layout: drilling
 * from Platform Metrics into a report's metrics keeps the same frame. Emit
 * inside the page's <style> block, right beside penumbra_an_shared_css().
 * The sticky offset var --pnb-adm-offset is measured by each page's JS from
 * the sticky admin bar (0 when the page has no bar, e.g. a non-admin on
 * analytics.php).
 */
function penumbra_an_shell_css()
{
    ?>
    /* ================= shared shell: analytics_shared.php ================ */
    .console-shell { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 67px); }
    @media (max-width: 900px) { .console-shell { grid-template-columns: 1fr; } }

    /* padding-left 30px (not 18): the left-edge settings handle (~14px wide)
       overlaps the first pixels of the column - the extra room lets it
       breathe instead of sitting on the filter labels (2026-08-19). */
    .sidebar { background: var(--bg-surface-alt); border-right: 1px solid var(--border-color); padding: 18px 18px 18px 30px; }
    /* Sticky goes on an INNER wrapper, not the aside: the aside is the painted
       grid column and must keep stretching to the row's full height. +18px =
       the aside's own padding, i.e. exactly where the wrapper already sits at
       scroll 0 - equal natural and stuck offsets mean zero travel before it
       pins. max-height keeps a long filter stack scrollable above the
       always-on footer status bar. */
    .sidebar-sticky {
        position: sticky;
        top: calc(var(--pnb-adm-offset, 68px) + 18px);
        max-height: calc(100vh - var(--pnb-adm-offset, 68px) - 18px - var(--pnb-statusbar-h, 30px) - 12px);
        overflow-y: auto;
        scrollbar-width: thin;
    }
    @media (max-width: 900px) { .sidebar-sticky { position: static; max-height: none; overflow: visible; } }
    .sidebar h2 { font-size: 13px; margin: 0 0 14px; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
    .sidebar h2 .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary); }
    .filter-group { margin-bottom: 18px; }
    /* .fg-label: the visible name of a role=group filter (Compare, Visibility) -
       a <label> with no control is an orphan (WCAG 1.3.1, 2026-10-15), so those
       groups name themselves with aria-labelledby onto this span instead. */
    .filter-group label, .filter-group .fg-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 6px; }
    .filter-group input, .filter-group select { width: 100%; padding: 5px 8px; font-size: 12px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; }
    .check-list { display: flex; flex-direction: column; gap: 4px; }
    .check-list label { font-size: 12px; color: var(--text-main); text-transform: none; letter-spacing: 0; display: flex; align-items: center; gap: 8px; }
    .check-list label input { margin: 0; width: auto; }
    /* display:flex above out-specifies the UA sheet's [hidden] - restate it. */
    .check-list[hidden] { display: none; }
    .filter-note { font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }

    /* Non-default filter group: an accent rail flush with the sidebar's edge,
       so "which of these did I change" is answerable without reading values.
       The negative margin cancels .sidebar's 18px padding; the rail is 3px so
       15px of padding puts the content back where it was. */
    .filter-group.on { border-left: 3px solid var(--brand-primary); margin-left: -30px; padding-left: 27px; }
    .filter-group.on > label, .filter-group.on > .fg-label { color: var(--brand-text, var(--brand-primary)); }
    .sidebar h2 .fcount {
        margin-left: auto; font-size: 10px; font-weight: 700; line-height: 1.6;
        min-width: 17px; text-align: center; padding: 0 6px; border-radius: 999px;
        background: var(--brand-primary); color: var(--pivot-header-font, #fff);
    }

    .main { padding: 22px 28px; min-width: 0; }
    .main-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
    .main-head h1, .main-head h2 { margin: 0; font-size: 20px; color: var(--text-main); }   /* h2 since 2026-09-09: the admin bar owns the page's h1 */
    .main-head .range { font-size: 12px; color: var(--text-muted); }

    /* ---- Sticky page head (2026-09-23) -------------------------------------
       The title + the active-filter bar (+ the tab strip on Platform Metrics,
       the report strip on a report's metrics) stay pinned under the admin bar
       while the tables scroll, so "what am I looking at, and what is it
       filtered by?" never scrolls away. Full-bleed across .main's 28px side
       padding so rows cannot show through beside it. The 10px top padding is
       cancelled by the negative margin, so the resting layout does not move -
       it only keeps the title off the admin bar once stuck. The background is
       the page's own, read at runtime into --an-page-bg (some themes paint
       body.theme-* directly instead of through --bg-body). The last child's
       bottom margin collapses OUT of this box, so it ends at that child's
       edge - the tab strip's rule, or the report strip's border. --an-sticky-h
       (its height, 0 when not sticky) is what sticky table headers and
       scroll-to targets add to --pnb-adm-offset. Static on narrow and very
       short windows, like .sidebar-sticky, where a pinned block would eat the
       screen. */
    .an-sticky {
        position: sticky; top: var(--pnb-adm-offset, 0px); z-index: 20;
        margin: -10px -28px 0; padding: 10px 28px 0;
        background: var(--an-page-bg, var(--bg-body, #fff));
    }
    .an-sticky.is-stuck { box-shadow: 0 8px 10px -8px rgba(0, 0, 0, 0.3); }
    body.is-dark .an-sticky.is-stuck { box-shadow: 0 8px 10px -8px rgba(0, 0, 0, 0.75); }
    @media (max-width: 900px), (max-height: 560px) { .an-sticky { position: static; } }

    /* In-table filter buttons (unity tags / report pills) - click fills the
       matching sidebar field and re-runs. Moved here from analytics_all
       2026-08-19 so analytics.php's clickable unity tags dress identically. */
    .fbtn { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; text-align: left; border-bottom: 1px dotted transparent; }
    .fbtn:hover { color: var(--brand-text, var(--brand-primary)); border-bottom-color: var(--brand-primary); }
    .fbtn:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 2px; border-radius: 2px; }
    .fbtn .pill:hover { background: color-mix(in srgb, var(--brand-primary) 18%, transparent); }
    <?php
}

function penumbra_an_shared_css()
{
    ?>
    /* ================= shared: analytics_shared.php ====================== */

    /* ---- Active-filter bar ---------------------------------------------- */
    .filter-bar {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        margin: 0 0 14px; padding: 7px 10px;
        border: 1px solid var(--border-color); border-radius: 6px;
        background: var(--bg-surface-alt);
    }
    .filter-bar.is-filtered {
        border-color: var(--brand-primary);
        background: color-mix(in srgb, var(--brand-primary) 8%, var(--bg-surface-alt));
        box-shadow: inset 3px 0 0 var(--brand-primary);
    }
    .filter-bar .fb-lead {
        display: inline-flex; align-items: center; gap: 6px; margin-right: 2px;
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);
    }
    .filter-bar.is-filtered .fb-lead { color: var(--brand-text, var(--brand-primary)); font-weight: 700; }
    .filter-bar .fb-lead svg { width: 13px; height: 13px; }
    .chip {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; color: var(--text-main);
        background: var(--bg-surface); border: 1px solid var(--border-color);
        border-radius: 999px; padding: 2px 9px;
    }
    .chip.on { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 13%, var(--bg-surface)); padding-right: 3px; }
    .chip .chip-k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); }
    .chip .chip-v { font-weight: 600; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-x {
        border: none; background: none; cursor: pointer; color: var(--text-muted);
        font-size: 14px; line-height: 1; padding: 1px 5px; border-radius: 999px;
    }
    .chip-x:hover { color: var(--an-danger-text, var(--an-danger)); background: rgba(0,0,0,0.07); }
    body.is-dark .chip-x:hover { background: rgba(255,255,255,0.12); }
    .chip-x:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 1px; }
    .fb-clear {
        margin-left: auto; font-size: 11px; cursor: pointer; color: var(--text-main);
        background: var(--bg-surface); border: 1px solid var(--border-color);
        border-radius: 4px; padding: 3px 10px;
    }
    .fb-clear:hover { border-color: var(--an-danger); color: var(--an-danger-text, var(--an-danger)); }

    /* ---- Table header toolbar ------------------------------------------- */
    /* .h3-right groups the meta line and the toolbar on the RIGHT of a
       space-between header, instead of becoming a third flex child that would
       push the row count into the middle. */
    .h3-right { display: flex; align-items: center; gap: 10px; min-width: 0; flex-shrink: 0; }
    .h3-right small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tbl-tools { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .tt-btn {
        font: inherit; font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
        background: var(--bg-surface-alt); border: 1px solid var(--border-color);
        color: var(--text-muted); border-radius: 4px; padding: 3px 8px; cursor: pointer; white-space: nowrap;
    }
    .tt-btn:hover { border-color: var(--brand-primary); color: var(--brand-text, var(--brand-primary)); }
    .tt-btn:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 1px; }
    .tt-btn[hidden] { display: none; }
    /* Narrow at rest, wider on focus - the header is a crowded row and this only
       needs room while in use. */
    .tt-filter {
        font: inherit; font-size: 11px; width: 108px; padding: 3px 7px;
        background: var(--bg-surface); border: 1px solid var(--border-color);
        color: var(--text-main); border-radius: 4px; box-sizing: border-box;
        transition: width 0.12s ease;
    }
    .tt-filter:focus { width: 190px; outline: none; border-color: var(--brand-primary); }
    .tt-filter.has-value { border-color: var(--brand-primary); }
    @media (prefers-reduced-motion: reduce) { .tt-filter { transition: none; } }

    /* ---- Show more / Show all footer ------------------------------------ */
    .list-more { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-top: 1px solid var(--border-color); background: var(--bg-surface-alt); }
    .list-more button { background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; padding: 4px 12px; font-size: 11px; cursor: pointer; }
    .list-more button:hover { border-color: var(--brand-primary); }
    .list-more button[hidden] { display: none; }
    .list-more .lm-note { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
    /* The server's own fetch cap is a hard stop - say so rather than leaving a
       button that would return the same rows again. */
    .list-more .lm-note.at-cap { color: var(--an-danger-text, var(--an-danger)); }
    /* Spelled out because a `display: table-row` rule anywhere in the cascade
       would out-specify the UA sheet's [hidden] and leave every hidden row on
       screen. */
    table.dt tr[hidden] { display: none; }

    /* ---- Custom range / comparison date pair ----------------------------- */
    .custom-range { margin-top: 8px; display: block; }
    .custom-range[hidden] { display: none; }
    .cr-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
    .cr-row label { margin: 0; width: 34px; flex-shrink: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
    .cr-row input { flex: 1; min-width: 0; padding: 4px 7px; font-size: 12px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; }
    .cr-quick { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .cr-q {
        font-size: 10px; padding: 2px 7px; border-radius: 999px; cursor: pointer;
        background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main);
    }
    .cr-q:hover { border-color: var(--brand-primary); color: var(--brand-text, var(--brand-primary)); }
    .cr-q:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 1px; }

    /* ---- Tab count badges ------------------------------------------------ */
    .tab-badge {
        display: inline-block; margin-left: 6px; padding: 0 6px;
        font-size: 10px; font-weight: 700; line-height: 1.6; border-radius: 999px;
        background: var(--an-danger); color: #fff; vertical-align: 1px;
    }
    .tab-badge.neutral { background: var(--brand-primary); color: var(--on-brand, var(--pivot-header-font, #fff)); font-weight: 600; }   /* on-brand token (2026-09-09): white was 2.5:1 on light-brand themes */

    /* ---- Sticky table headers -------------------------------------------- */
    /* "Show all" can put several hundred rows in one panel, and a column header
       that has scrolled off is a table you have to count columns in. The fill is
       opaque (main.css styles the bare `th` with background:!important), so rows
       pass cleanly underneath. No card is a scroll container, so this sticks to
       the VIEWPORT - which is why `top` must clear the admin bar AND the sticky
       page head. It was `top: 0` until 2026-09-23, i.e. pinned UNDER the admin
       bar (z 30) ever since that bar arrived on 2026-08-19, invisible. */
    table.dt th { position: sticky; top: calc(var(--pnb-adm-offset, 0px) + var(--an-sticky-h, 0px) + var(--an-cardhead-h, 0px)); z-index: 2; }

    /* ---- Sticky card strips (2026-10-03, the user's call) ----------------- */
    /* A table card's strips above its header row - the title strip (title,
       filter tags, count, quick filter, CSV), the Activity feed's chip strip,
       Unviewed Reports' selection strip while it shows - pin under the page
       head too, so the controls stay in reach in a long list. The script
       ("Sticky card strips" in the shared JS) stacks them (each one's top = the
       ones above it) and publishes their total as --an-cardhead-h on the CARD,
       which the header row above adds. Each sticks within its own card, so it
       leaves with it. Opaque, or rows would show through. Static where the
       page head is static (narrow / very short windows). */
    .an-cardhead { position: sticky; top: calc(var(--pnb-adm-offset, 0px) + var(--an-sticky-h, 0px)); z-index: 3; }
    .card > h3.an-cardhead { background: var(--bg-surface); }
    @media (max-width: 900px), (max-height: 560px) { .an-cardhead { position: static; } }

    /* ---- "This table is filtered" tags (2026-09-23) ---------------------- */
    /* penumbra_an_filter_tags(). They sit right after a card's title: the
       wrapper's auto right margin keeps them beside it and pushes .h3-right
       (count + tools) to the far edge, in any space-between header. Resets
       the uppercase/letter-spacing the per-report panel headers carry. */
    .an-ftags { display: inline-flex; align-items: center; gap: 4px; min-width: 0; margin: 0 auto 0 8px; flex: 0 1 auto; overflow: hidden; }
    .an-ftag {
        display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 360px;
        font-size: 10px; font-weight: 600; line-height: 1.5; letter-spacing: 0; text-transform: none;
        padding: 1px 8px; border-radius: 999px; white-space: nowrap;
        color: var(--brand-text, var(--brand-primary));
        background: color-mix(in srgb, var(--brand-primary) 12%, var(--bg-surface));
        border: 1px solid var(--brand-primary);
    }
    .an-ftag svg { width: 10px; height: 10px; flex: 0 0 10px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .an-ftag-t { overflow: hidden; text-overflow: ellipsis; }
    .an-ftag.off { color: var(--text-muted); background: transparent; border-style: dashed; border-color: var(--border-color); font-weight: 500; }

    /* ---- Hover to read a clipped cell (2026-10-03) ------------------------
       main.css .cell-to-expand relaxes the <td>; these are the wrappers that
       clip on their own inside one (see the hover script in the shared JS). */
    table.dt td.cell-to-expand .rlink-t,
    table.dt td.cell-to-expand .ip-pill {
        white-space: normal; overflow: visible; text-overflow: clip;
        overflow-wrap: anywhere; max-width: none;
    }
    <?php
}

// ===========================================================================
// Shared JS
// ===========================================================================

/**
 * The per-table controller (reveal + quick filter + CSV) and the chip handler.
 *
 * Emitted inside each page's own <script>. Requires the two seams documented at
 * the top of this file; without them the controls render but do nothing, which
 * is why both pages define them before this block runs.
 *
 * @param array $opts 'listNext' => next deeper ?rows= slice
 *                    'listMax'  => hard server ceiling
 *                    'atCap'    => bool, the current fetch is already at it
 */
function penumbra_an_shared_js($opts = array())
{
    $listNext = isset($opts['listNext']) ? (int)$opts['listNext'] : 0;
    $listMax  = isset($opts['listMax'])  ? (int)$opts['listMax']  : 0;
    $atCap    = !empty($opts['atCap']);
    ?>
/* ============== shared: analytics_shared.php (tables + chips) ==============
 * One controller per table CARD/PANEL, not per footer: the quick filter has to
 * exist on short tables too, and those render no footer at all. A card holds
 * exactly one table.dt, which is what lets the header controls, the footer
 * controls and the filter share a single state without id plumbing.
 * ======================================================================== */
(function () {
    const LIST_NEXT  = <?php echo $listNext; ?>;
    const LIST_MAX   = <?php echo $listMax; ?>;
    const AT_CAP     = <?php echo $atCap ? 'true' : 'false'; ?>;
    // Set by "Show all" when it has to go back to the server: without it the
    // reload lands on one step again and the click looks like it did nothing.
    const EXPAND_ALL = new URLSearchParams(window.location.search).get('expandall') === '1';

    const reveals = [];
    document.querySelectorAll('[data-pnb-table]').forEach(function (card) {
        const table = card.querySelector('table.dt');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const foot   = card.querySelector('.list-more');
        // Reveal metadata comes from the footer when there is one, otherwise
        // from the header toolbar. Neither present means nothing was ever
        // hidden: step Infinity keeps every row visible and every reveal branch
        // inert, while the quick filter still works.
        const meta   = foot || card.querySelector('.tbl-tools');
        const step   = meta ? (parseInt(meta.dataset.step, 10) || 25) : Infinity;
        const capped = meta ? meta.dataset.capped === '1' : false;
        const noun   = meta ? (meta.dataset.noun || 'rows') : 'rows';
        const note   = foot ? foot.querySelector('.lm-note') : null;
        const moreBtns  = Array.prototype.slice.call(card.querySelectorAll('.lm-more'));
        const allBtns   = Array.prototype.slice.call(card.querySelectorAll('.lm-all'));
        const filterBox = card.querySelector('.tt-filter');
        let shown = step;
        let terms = [];

        function rows() {
            return Array.prototype.slice.call(tbody.querySelectorAll('tr'))
                .filter(function (r) { return !r.classList.contains('empty-row'); });
        }
        if (EXPAND_ALL) shown = rows().length;

        // Row text is cached on the element: the filter re-runs per keystroke
        // and innerText forces layout, which on a 1,000-row table is the
        // difference between instant and janky.
        function rowText(r) {
            if (r.__pnbText === undefined) {
                // data-find: text the row should match but does not show (the
                // Tables tab's report names, inside a closed <details>).
                r.__pnbText = ((r.innerText || r.textContent || '') + ' ' + (r.getAttribute('data-find') || '')).replace(/\s+/g, ' ').toLowerCase();
            }
            return r.__pnbText;
        }
        function matches(r) {
            if (!terms.length) return true;
            const t = rowText(r);
            return terms.every(function (q) { return t.indexOf(q) !== -1; });
        }
        function filtering() { return terms.length > 0; }
        // "Nothing left to fetch" must be a property of the DATA, not of a
        // button's hidden state - or the handler navigates on any click that
        // reaches it, and something always can.
        function hasDeeper() { return capped && !AT_CAP && LIST_NEXT > 0; }

        function setAll(btns, text, hide, title) {
            btns.forEach(function (b) {
                b.textContent = text;
                b.hidden = hide;
                if (title) b.title = title;
            });
        }
        let status = null, said = false, sayTimer = null;
        function sayCount(text) {
            if (!status) {
                status = document.createElement('div');
                status.className = 'sr-only an-filter-status';
                status.setAttribute('role', 'status');
                status.setAttribute('aria-live', 'polite');
                card.appendChild(status);
            }
            said = filtering();
            if (sayTimer) clearTimeout(sayTimer);
            sayTimer = setTimeout(function () { sayTimer = null; if (status.textContent !== text) status.textContent = text; }, 500);
        }
        // (2026-11-17, tabreload) A click on the tab that is already open swaps fresh rows into this
        // table's tbody (analytics_all.php reloadTab); the reveal, the filter and the counts re-run on them.
        card.addEventListener('pnb:rows-swapped', function () { applyReveal(); });
        function applyReveal() {
            const all = rows();
            // While a filter is active the reveal cutoff is lifted entirely. You
            // filtered in order to SEE the matches, and paging through a set you
            // just narrowed to three rows is theatre. It also leaves `shown`
            // untouched, so clearing the box restores the level you had.
            const cutoff = filtering() ? Infinity : shown;
            let matched = 0;
            all.forEach(function (r) {
                if (!matches(r)) { r.hidden = true; return; }
                r.hidden = (matched >= cutoff);
                matched++;
            });
            const vis  = Math.min(cutoff, matched);
            const left = matched - vis;

            if (note) {
                if (filtering()) {
                    // Say plainly that the search covers LOADED rows only - a
                    // filter that silently searches 25 of 300 rows is a filter
                    // that lies about what isn't there.
                    note.textContent = matched + ' of ' + all.length + ' loaded ' + noun + ' match'
                                     + (capped ? ' · only loaded rows are searched' : '');
                } else {
                    note.textContent = 'showing ' + vis + ' of ' + all.length + (capped ? '+' : '') + ' ' + noun
                                     + (capped && AT_CAP ? ' · server cap of ' + LIST_MAX.toLocaleString() + ' reached, narrow the filters to see more' : '');
                }
                note.classList.toggle('at-cap', capped && AT_CAP && !filtering());
            } else if (filterBox) {
                // WCAG 4.1.3 (2026-10-15): a table with no footer said nothing
                // when its quick filter ran. A card-level status says the count
                // once typing settles; clearing the box says so too.
                if (filtering()) sayCount(matched + ' of ' + all.length + ' ' + noun + ' match');
                else if (said) sayCount('Filter cleared, ' + all.length + ' ' + noun);
            }

            if (!filtering() && left > 0) {
                setAll(moreBtns, 'Show ' + Math.min(step, left) + ' more', false, 'Reveal ' + Math.min(step, left) + ' more rows');
                setAll(allBtns, 'Show all (' + matched + ')', false, 'Reveal every row already loaded');
            } else if (hasDeeper()) {
                setAll(moreBtns, 'Load ' + (LIST_NEXT - all.length) + ' more', false,
                       filtering() ? 'Fetch more rows from the server so the filter can search them' : 'Fetch a deeper slice from the server');
                setAll(allBtns, filtering() ? 'Load all to search' : 'Load all', false,
                       'Fetch every remaining row (up to ' + LIST_MAX.toLocaleString() + ') and expand');
            } else {
                setAll(moreBtns, 'Show more', true);
                setAll(allBtns, 'Show all', true);
            }
            if (window.penumbraOnRowsRevealed) window.penumbraOnRowsRevealed(card);
        }
        function reload(extra) {
            moreBtns.concat(allBtns).forEach(function (b) { b.disabled = true; });
            setAll(moreBtns, 'Loading…', false);
            setAll(allBtns, 'Loading…', false);
            window.penumbraSubmitFilters(extra);
        }
        moreBtns.forEach(function (b) {
            b.addEventListener('click', function () {
                if (!filtering() && shown < rows().length) { shown += step; applyReveal(); return; }
                if (hasDeeper()) reload({ rows: String(LIST_NEXT) });
            });
        });
        allBtns.forEach(function (b) {
            b.addEventListener('click', function () {
                if (!filtering() && shown < rows().length) { shown = rows().length; applyReveal(); return; }
                if (hasDeeper()) reload({ rows: String(LIST_MAX), expandall: '1' });
            });
        });
        if (filterBox) {
            filterBox.addEventListener('input', function () {
                const raw = filterBox.value.trim().toLowerCase();
                terms = raw ? raw.split(/\s+/) : [];
                filterBox.classList.toggle('has-value', raw !== '');
                applyReveal();
            });
            // Escape clears the box rather than closing anything - the page-level
            // Escape handling is elsewhere.
            filterBox.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape' || filterBox.value === '') return;
                e.stopPropagation();
                filterBox.value = '';
                filterBox.dispatchEvent(new Event('input'));
            });
        }
        reveals.push(applyReveal);
        applyReveal();
    });
    // Re-apply after a column sort so "top 25" means top 25 of the sorted order.
    window.penumbraReapplyReveals = function () { reveals.forEach(function (f) { f(); }); };

    // ---- CSV export ---------------------------------------------------------
    // Exports what the table HOLDS, not what it shows: hidden (not-yet-revealed)
    // rows are included, because "showing 25 of 300" is a display state, not a
    // data state. Column order and sort order follow the DOM.
    function csvCell(v) {
        v = String(v == null ? '' : v);
        // Spreadsheet formula injection: a cell opening with = + - @ (or a
        // control char) is executed by Excel/Sheets on open, and these values
        // are user-authored. Neutralize the lead character.
        // (2026-11-17, metricsweep) Not the "-" placeholder and not a plain
        // signed number (-5.2, +12%): neither is a formula, and the apostrophe
        // showed in the sheet and turned the number into text.
        if (/^[=@\t\r]/.test(v) || /^[+\-](?!$)(?![\d.,]+\s*%?$)/.test(v)) v = "'" + v;
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function cellText(el) {
        // data-csv: the cell's value when it shows more than that (a Tables-tab
        // name cell whose <details> may be open on its report list).
        if (el.hasAttribute && el.hasAttribute('data-csv')) return el.getAttribute('data-csv');
        return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    document.querySelectorAll('.tt-csv').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const card  = btn.closest('[data-pnb-table]');
            const table = card ? card.querySelector('table.dt') : null;
            if (!table) return;
            // .no-export columns (e.g. a selection checkbox) are skipped in BOTH
            // header and body, or every row leads with an empty field.
            const keep = function (cell) { return !cell.classList.contains('no-export'); };
            const lines = [];
            const head = Array.prototype.slice.call(table.querySelectorAll('thead th')).filter(keep)
                // The sort icon (and a multi-sort's rank digit) is an element, so it is
                // dropped as one - a glyph list would miss the rank (2026-10-03).
                .map(function (th) {
                    const c = th.cloneNode(true);
                    c.querySelectorAll('.sort-icon, .sort-arrow').forEach(function (e) { e.remove(); });
                    return cellText(c).replace(/[⇅↑↓▲▼]/g, '').trim();
                });
            lines.push(head.map(csvCell).join(','));
            table.querySelectorAll('tbody tr').forEach(function (tr) {
                if (tr.classList.contains('empty-row')) return;
                lines.push(Array.prototype.slice.call(tr.children).filter(keep).map(function (td) {
                    return csvCell(cellText(td));
                }).join(','));
            });
            // U+FEFF as a code point, never a literal (an invisible BOM in this
            // file's source is a trap): without it Excel reads the CSV as the
            // system code page and mangles non-ASCII text.
            const blob = new Blob([String.fromCharCode(0xFEFF) + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = 'penumbra-' + (btn.dataset.csv || 'table') + '-' + (function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })(new Date()) + '.csv';   // (metricsweep7) the local date: toISOString is UTC, tomorrow after 7 pm
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
    });

    // ---- Filter chips -------------------------------------------------------
    // Delegated, so a chip rendered anywhere on the page works. The page decides
    // what "clear" means for its own filter model.
    document.addEventListener('click', function (e) {
        const btn = e.target.closest ? e.target.closest('[data-clear]') : null;
        if (!btn || !window.penumbraClearFilter) return;
        window.penumbraClearFilter(btn.dataset.clear);
    });

    // ---- Sticky page head (2026-09-23) --------------------------------------
    // Three jobs, see .an-sticky in penumbra_an_shell_css():
    //   --an-sticky-h  its height while it is actually sticky (0 when the
    //                  narrow/short media query makes it static), which the
    //                  sticky table headers and every scroll-to target add to
    //                  the admin bar's --pnb-adm-offset;
    //   --an-page-bg   the page's REAL background colour - several themes paint
    //                  body.theme-* directly, so --bg-body alone would show a
    //                  mismatched band;
    //   .is-stuck      a shadow only once it has pinned, never at rest.
    (function () {
        const head = document.querySelector('.an-sticky');
        if (!head) return;
        const root = document.documentElement;
        const CLEAR = /^(transparent|rgba\(0, 0, 0, 0\))$/;
        function syncBg() {
            let bg = getComputedStyle(document.body).backgroundColor;
            if (!bg || CLEAR.test(bg)) bg = getComputedStyle(root).backgroundColor;
            if (bg && !CLEAR.test(bg)) root.style.setProperty('--an-page-bg', bg);
            else root.style.removeProperty('--an-page-bg');
        }
        function isSticky() { return getComputedStyle(head).position === 'sticky'; }
        function syncHeight() {
            root.style.setProperty('--an-sticky-h', (isSticky() ? Math.round(head.getBoundingClientRect().height) : 0) + 'px');
        }
        let queued = false;
        function syncStuck() {
            queued = false;
            const top = parseFloat(getComputedStyle(head).top) || 0;
            head.classList.toggle('is-stuck', isSticky() && head.getBoundingClientRect().top <= top + 0.5);
        }
        function onScroll() {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(syncStuck);
        }
        syncBg(); syncHeight(); syncStuck();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () { syncHeight(); syncStuck(); });
        // Chips wrap to a second line on a narrow window or a long filter set.
        if (window.ResizeObserver) new ResizeObserver(function () { syncHeight(); syncStuck(); }).observe(head);
        // A live theme switch (the chrome settings panel) re-classes <body>.
        if (window.MutationObserver) new MutationObserver(syncBg).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    })();

    // ---- Sticky card strips (2026-10-03) ------------------------------------
    // See .an-cardhead in penumbra_an_shared_css(). Per table card: its strips
    // (direct children h3 / .feed-head / .bulk-bar, in order) each get the
    // class and a top that stacks under the ones above; --an-cardhead-h on the
    // card is their total while they actually stick (0 when the media query
    // makes them static), which the table's header row adds to its own top. A
    // hidden strip (the selection strip with nothing ticked) measures 0. Kept
    // in step by a ResizeObserver on every strip - a wrap, a filter tag, the
    // selection strip appearing - and on window resizes.
    (function () {
        const BASE = 'var(--pnb-adm-offset, 0px) + var(--an-sticky-h, 0px)';
        const cards = Array.prototype.filter.call(document.querySelectorAll('.card'), function (c) { return !!c.querySelector('table.dt'); });
        if (!cards.length) return;
        function strips(card) {
            return Array.prototype.filter.call(card.children, function (el) { return el.matches('h3, .feed-head, .bulk-bar'); });
        }
        function sync(card) {
            const list = strips(card);
            if (!list.length) return;
            list.forEach(function (el) { el.classList.add('an-cardhead'); });
            const sticky = getComputedStyle(list[0]).position === 'sticky';
            let acc = 0;
            list.forEach(function (el) {
                el.style.top = 'calc(' + BASE + ' + ' + acc + 'px)';
                acc += el.offsetHeight;   // display:none = 0
            });
            card.style.setProperty('--an-cardhead-h', (sticky ? acc : 0) + 'px');
        }
        function syncAll() { cards.forEach(sync); }
        syncAll();
        window.addEventListener('resize', syncAll);
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(function (entries) {
                const seen = new Set();
                entries.forEach(function (e) { const c = e.target.closest('.card'); if (c && !seen.has(c)) { seen.add(c); sync(c); } });
            });
            cards.forEach(function (c) { strips(c).forEach(function (el) { ro.observe(el); }); });
        }
        // ...and a strip that HIDES (the selection strip's [hidden], toggled by its
        // own script): a ResizeObserver does not reliably report a box going
        // display:none, which left the header row parked below a vanished strip.
        if (window.MutationObserver) {
            const mo = new MutationObserver(function (records) {
                const seen = new Set();
                records.forEach(function (r) { const c = r.target.closest('.card'); if (c && !seen.has(c)) { seen.add(c); sync(c); } });
            });
            cards.forEach(function (c) { strips(c).forEach(function (el) { mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); }); });
            // ...and a TAB that opens: a card in a hidden panel measured 0 at load,
            // and when its panel shows, the ResizeObserver is the only thing left to
            // re-measure it - which a hidden browser tab never delivers (live
            // 2026-10-03: the Activity header row sat under its strip). Re-sync
            // whenever a tab's aria-selected changes, however it was switched
            // (click, arrow keys, a #hash on load). A timer, not rAF: rAF does not
            // run in a hidden document either.
            const tabMo = new MutationObserver(function () { setTimeout(syncAll, 0); });
            document.querySelectorAll('[role="tab"]').forEach(function (b) { tabMo.observe(b, { attributes: true, attributeFilter: ['aria-selected'] }); });
        }
    })();

    // ---- Hover to read a clipped cell (2026-10-03) --------------------------
    // main.css clips every td (max-width 350px, nowrap, ellipsis), so a long
    // Detail, title or IP ended in "..." with no way to read the rest. Same
    // gesture as the report grid's fixed-row-height hover (main.js
    // _pnbCellExpandEnter): settle 50ms on a cell, and if the cell - or a
    // clipping wrapper inside it (.rlink-t, .ip-pill) - overflows, add
    // .cell-to-expand (main.css) so it wraps in place; leaving removes it.
    // Delegated on document: the Show more / filter controller re-renders rows.
    (function () {
        let timer = null, open = null;
        function clipped(td) {
            if (td.scrollWidth > td.clientWidth + 1) return true;
            const inner = td.querySelectorAll('*');
            for (let i = 0; i < inner.length; i++) {
                if (inner[i].scrollWidth > inner[i].clientWidth + 1 && getComputedStyle(inner[i]).overflow !== 'visible') return true;
            }
            return false;
        }
        function close() { if (open) { open.classList.remove('cell-to-expand'); open = null; } }
        document.addEventListener('mouseover', function (ev) {
            const td = ev.target.closest ? ev.target.closest('table.dt tbody td') : null;
            if (td === open) return;
            if (timer) { clearTimeout(timer); timer = null; }
            close();
            if (!td) return;
            timer = setTimeout(function () {
                timer = null;
                if (clipped(td)) { td.classList.add('cell-to-expand'); open = td; }
            }, 50);
        });
        document.addEventListener('mouseleave', function () { if (timer) clearTimeout(timer); timer = null; close(); });
        // WCAG 2.1.1 (2026-10-15): the keyboard gets the same reveal. Focus on
        // a control inside a clipped cell (a title link, a filter button)
        // expands that cell; focus leaving it closes it again.
        document.addEventListener('focusin', function (ev) {
            const td = ev.target.closest ? ev.target.closest('table.dt tbody td') : null;
            if (td === open) return;
            if (timer) { clearTimeout(timer); timer = null; }
            close();
            if (td && clipped(td)) { td.classList.add('cell-to-expand'); open = td; }
        });
        document.addEventListener('focusout', function (ev) {
            if (open && !(ev.relatedTarget && open.contains(ev.relatedTarget)) && open.contains(ev.target)) close();
        });
    })();
})();
    <?php
}

// ============================================================================
// TABLES TAB (2026-10-14): which tables the reports read, per connection.
// ============================================================================
// Bump when penumbra_an_table_refs() changes, so the cached map is rebuilt.
define('PENUMBRA_AN_TABLES_V', 'tbl2');

/**
 * The tables one report reads, each placed on its connection - for the Tables
 * tab ONLY. It reads the report through penumbraExtractReportTables(), the
 * extractor the SQL allow-list gate uses, and never feeds anything back into
 * it: the gate's scope is not this function's business, and nothing here may
 * narrow or widen what a report is allowed to run.
 *
 * What it adds on top, all measured on the live catalogue (2026-10-14):
 *   - prompt display text is dropped first. message= / label= / forcedefault=
 *     are prose ("From date", "3 years ago from today"), and the scan read the
 *     word after "from" as a table (DATE, TODAY).
 *   - SQL carried inside a string literal is scanned too. A noquote prompt's
 *     options hold whole queries as text ('select ... from STATS_COMBINED_V2'),
 *     which the gate's literal stripping (rightly) never looks at - one report
 *     came back with no tables at all.
 *   - TABLE.COLUMN (an autofill= target) counts as TABLE; SCHEMA.TABLE as TABLE.
 *   - [IMPORT; name=X] counts as the import X on the "imports" connection,
 *     instead of a table called IMPORT.
 *   - DUAL is not a table anyone needs listed.
 *
 * @param string $stateJson PENUMBRA_REPORTS.STATE_DATA
 * @param array  $lists     conn key => array(UPPER NAME => true), in ROUTING order
 *                          (getConnectionForTable's: pins, infoed, hr, fin, ieprd),
 *                          so a name on two lists lands where it would run.
 * @return array list of array('conn' => key|'?', 'table' => NAME); '?' = on no list
 */
function penumbra_an_table_refs($stateJson, $lists)
{
    if (!is_string($stateJson) || $stateJson === '') return array();
    $state = json_decode($stateJson, true);
    if (!is_array($state)) return array();
    $names = array();
    $imports = array();
    if (isset($state['scope_tables']) && is_array($state['scope_tables'])) {
        // Encrypted report: its plaintext table list is all there is.
        $names = penumbraExtractReportTables($stateJson);
    } else {
        $q = (isset($state['query']) && is_string($state['query'])) ? $state['query'] : '';
        if ($q === '') return array();
        if (preg_match_all('/\[\s*IMPORT\s*;[^\]]*?\bname\s*=\s*([^;\]]+)/i', $q, $im)) {
            foreach ($im[1] as $nm) { $nm = strtoupper(trim($nm, " \t\r\n\"'")); if ($nm !== '') $imports[$nm] = true; }
        }
        $clean = preg_replace_callback('/\[[^\[\]]*\]/', function ($m) {
            $t = preg_replace('/\b(?:message|label|forcedefault|default|placeholder|title|help|tip)\s*=\s*[^;\]]*/i', ' ', $m[0]);
            // autofill=TABLE.COLUMN names a column; the table is what is read.
            return preg_replace('/\b(autofill\s*=\s*[A-Za-z0-9_$#]+)\.[A-Za-z0-9_$#.]+/i', '$1', $t);
        }, $q);
        if ($clean === null) $clean = $q;
        $state['query'] = $clean;
        $names = penumbraExtractReportTables(json_encode($state));
        if (preg_match_all("/'((?:''|[^'])*)'/", $clean, $lits)) {
            foreach ($lits[1] as $lit) {
                $lit = str_replace("''", "'", $lit);
                if (preg_match('/^\s*(?:SELECT|WITH)\b/i', $lit) && preg_match('/\bFROM\b/i', $lit)) {
                    $names = array_merge($names, penumbraExtractSqlTables(str_replace(array('[', ']'), ' ', $lit)));
                }
            }
        }
    }
    $out = array();
    foreach ($names as $n) {
        $n = strtoupper(trim((string)$n));
        if ($n === '' || $n === 'DUAL' || $n === 'IMPORT') continue;
        $cand = array($n);
        if (strpos($n, '.') !== false) {
            $parts = explode('.', $n);
            $cand = array($parts[0], $parts[count($parts) - 1]);
        }
        $conn = '?'; $name = $n;
        foreach ($cand as $c) {
            foreach ($lists as $k => $l) {
                if (isset($l[$c])) { $conn = $k; $name = $c; break 2; }
            }
        }
        $out[$conn . '|' . $name] = array('conn' => $conn, 'table' => $name);
    }
    foreach (array_keys($imports) as $nm) $out['imports|' . $nm] = array('conn' => 'imports', 'table' => (string)$nm);
    return array_values($out);
}

/**
 * Where the report -> tables map is cached between page loads: the server's
 * temp folder, OUTSIDE the webroot (cache/ is web-served). Named per app folder
 * so a second copy of the app never reads this one's map.
 */
function penumbra_an_tables_cache_file()
{
    return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'penumbra_an_tables_' . md5(__DIR__) . '.json';
}

/**
 * report id => its table refs, for every report in $catalogue. Only reports
 * edited since the last build are re-read (a STATE_DATA read per report is the
 * one real cost); the rest come from the cache. The cache is keyed by each
 * report's UPDATED_AT and by the allow lists themselves, so an edit, a new
 * table on a list or a change here (PENUMBRA_AN_TABLES_V) rebuilds what it
 * must. Fails soft both ways: no cache = read everything, a failed write =
 * the same next time.
 *
 * @param array    $catalogue  rid => array('updated' => string, ...)
 * @param callable $readStates function(array $rids): array rid => STATE_DATA
 * @param array    $lists      as penumbra_an_table_refs()
 * @param string   $cacheFile  '' = no cache
 */
function penumbra_an_table_map($catalogue, $readStates, $lists, $cacheFile)
{
    $sig = PENUMBRA_AN_TABLES_V . ':' . md5(json_encode($lists));
    $cache = array();
    // try as well as @: an error handler that throws ignores the @.
    try {
        if ($cacheFile !== '' && is_file($cacheFile)) {
            $raw = @file_get_contents($cacheFile);
            $dec = is_string($raw) ? json_decode($raw, true) : null;
            if (is_array($dec) && isset($dec['sig'], $dec['rows']) && $dec['sig'] === $sig && is_array($dec['rows'])) $cache = $dec['rows'];
        }
    } catch (Throwable $e) { $cache = array(); }
    $map = array(); $miss = array();
    foreach ($catalogue as $rid => $c) {
        $k = (string)$rid;
        if (isset($cache[$k]['u'], $cache[$k]['r']) && $cache[$k]['u'] === (string)$c['updated'] && is_array($cache[$k]['r'])) {
            $map[$rid] = $cache[$k]['r'];
        } else {
            $miss[] = (int)$rid;
        }
    }
    if ($miss) {
        $states = $readStates($miss);
        foreach ($miss as $rid) {
            $map[$rid] = penumbra_an_table_refs(isset($states[$rid]) ? $states[$rid] : '', $lists);
        }
    }
    // MERGED into the old rows, not replacing them: a tag- or report-filtered
    // catalogue is a subset, and dropping the rest would make the next
    // unfiltered load re-read them all. A deleted report's row lingers (a few
    // bytes) until the allow lists or PENUMBRA_AN_TABLES_V next change.
    if ($cacheFile !== '' && $miss) {
        $rows = $cache;
        foreach ($catalogue as $rid => $c) $rows[(string)$rid] = array('u' => (string)$c['updated'], 'r' => $map[$rid]);
        try { @file_put_contents($cacheFile, json_encode(array('sig' => $sig, 'rows' => $rows)), LOCK_EX); } catch (Throwable $e) {}
    }
    return $map;
}

/**
 * Roll the per-report numbers up to tables, grouped by connection.
 *
 * A report that reads three tables counts toward all three, so a column summed
 * down a card is NOT the platform total - the tab says so. Users per table are
 * DISTINCT across its reports (a person who opened two of its reports counts
 * once), which is why the opens arrive per (report, user) and not per report.
 *
 * @param array $catalogue rid => array('short','title','owner','updated')
 * @param array $refs      rid => table refs (penumbra_an_table_map)
 * @param array $opens     rows array('RID','U','V','LAST_SEEN') - OPENs per report and user
 * @param array $errs      rid => error count
 * @return array conn => array('tables' => NAME => stats, 'reports' => n), conns in display order
 */
function penumbra_an_tables_rollup($catalogue, $refs, $opens, $errs)
{
    $rep = array();
    foreach ($catalogue as $rid => $c) $rep[$rid] = array('views' => 0, 'users' => array(), 'last' => '', 'errors' => isset($errs[$rid]) ? (int)$errs[$rid] : 0);
    foreach ($opens as $o) {
        $rid = (int)$o['RID'];
        if (!isset($rep[$rid])) continue;
        $rep[$rid]['views'] += (int)$o['V'];
        $u = isset($o['U']) ? strtolower(trim((string)$o['U'])) : '';
        if ($u !== '') $rep[$rid]['users'][$u] = true;
        $l = isset($o['LAST_SEEN']) ? (string)$o['LAST_SEEN'] : '';
        if ($l > $rep[$rid]['last']) $rep[$rid]['last'] = $l;
    }
    $out = array();
    foreach ($refs as $rid => $list) {
        if (!isset($rep[$rid])) continue;
        foreach ($list as $ref) {
            $ck = $ref['conn']; $t = $ref['table'];
            if (!isset($out[$ck])) $out[$ck] = array('tables' => array(), 'rids' => array());
            if (!isset($out[$ck]['tables'][$t])) $out[$ck]['tables'][$t] = array('rids' => array(), 'views' => 0, 'users' => array(), 'opened' => 0, 'errors' => 0, 'last' => '');
            $s =& $out[$ck]['tables'][$t];
            if (isset($s['rids'][$rid])) { unset($s); continue; }
            $s['rids'][$rid] = true;
            $s['views']  += $rep[$rid]['views'];
            $s['errors'] += $rep[$rid]['errors'];
            $s['users']  += $rep[$rid]['users'];
            if ($rep[$rid]['views'] > 0) $s['opened']++;
            if ($rep[$rid]['last'] > $s['last']) $s['last'] = $rep[$rid]['last'];
            unset($s);
            $out[$ck]['rids'][$rid] = true;
        }
    }
    $order = array('ieprd', 'infoed', 'pins', 'hr', 'fin', 'imports', '?');
    $sorted = array();
    foreach ($order as $ck) {
        if (!isset($out[$ck])) continue;
        $tables = array();
        foreach ($out[$ck]['tables'] as $t => $s) {
            $reports = array();
            foreach (array_keys($s['rids']) as $rid) {
                $c = $catalogue[$rid];
                $reports[] = array('short' => $c['short'], 'title' => $c['title'], 'owner' => $c['owner'],
                                   'views' => $rep[$rid]['views'], 'users' => count($rep[$rid]['users']), 'last' => $rep[$rid]['last']);
            }
            usort($reports, function ($a, $b) {
                if ($a['views'] !== $b['views']) return $b['views'] - $a['views'];
                return strcasecmp((string)$a['title'], (string)$b['title']);
            });
            $tables[$t] = array('reports' => $reports, 'views' => $s['views'], 'users' => count($s['users']),
                                'opened' => $s['opened'], 'errors' => $s['errors'], 'last' => $s['last']);
        }
        uksort($tables, function ($a, $b) use ($tables) {
            if ($tables[$a]['views'] !== $tables[$b]['views']) return $tables[$b]['views'] - $tables[$a]['views'];
            if (count($tables[$a]['reports']) !== count($tables[$b]['reports'])) return count($tables[$b]['reports']) - count($tables[$a]['reports']);
            return strcmp((string)$a, (string)$b);
        });
        $sorted[$ck] = array('tables' => $tables, 'reports' => count($out[$ck]['rids']));
    }
    return $sorted;
}

/** Card heading for a connection key on the Tables tab. */
function penumbra_an_conn_label($ck)
{
    $labels = array('ieprd' => 'IEPrd (Oracle)', 'infoed' => 'InfoEd (SQL Server)', 'pins' => 'PINS (SQL Server)',
                    'hr' => 'HR (Oracle)', 'fin' => 'FIN (Oracle)', 'imports' => 'Imports', '?' => 'Not on any connection');
    return isset($labels[$ck]) ? $labels[$ck] : strtoupper((string)$ck);
}

// NO CLOSING TAG ON PURPOSE. This file is included before analytics_all.php
// writes its preference cookie; a trailing "?" + ">" plus the newline after it
// would emit whitespace, and setcookie() after ANY output is a silent no-op
// ("headers already sent"). The same hazard is why that file's own close tag
// must never be spelled out inside a comment.
