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
 *     no prefs at all. Hence the $prefOr callable.
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
 * @return array
 *
 * Returned keys are documented where they are built, below. The important
 * invariants:
 *   - timeFilter / timeFilterA are the ONLY definition of "the window". Both
 *     ends are CALENDAR-DAY aligned, never rolling SYSDATE-N: the trend buckets
 *     by TRUNC(TIMESTAMP), so a rolling "last N*24 hours" makes the chart's bars
 *     sum to something other than the KPI card above them (a 7d window cuts
 *     today's bar off at the current clock time and steals part of day 8).
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
    $rangeParam = isset($get['range']) ? strtolower(trim($get['range'])) : (string)$prefOr('range', '30');
    if (!in_array($rangeParam, array('7','30','90','all','custom'), true)) $rangeParam = '30';

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
    } else {
        $windowDays      = ($rangeParam === 'all') ? null : (int)$rangeParam;
        $rangeLabelLong  = ($rangeParam === 'all') ? 'All time' : 'Last ' . $windowDays . ' days';
        $rangeLabelShort = ($rangeParam === 'all') ? 'all-time' : $windowDays . 'd';
    }
    // "vs the prior Jul 1 - Jul 31" is nonsense; say the length instead.
    $priorLabel = ($rangeParam === 'custom') ? $windowDays . ' days' : $rangeLabelShort;

    // ---- Window SQL -------------------------------------------------------
    if ($rangeParam === 'custom') {
        $fromLit   = "TO_DATE('" . $customFrom . "','YYYY-MM-DD')";
        $toLitExcl = "TO_DATE('" . $customTo   . "','YYYY-MM-DD')+1";
        $timeFilter  = 'AND ' . $col  . ' >= ' . $fromLit . ' AND ' . $col  . ' < ' . $toLitExcl;
        $timeFilterA = 'AND ' . $colA . ' >= ' . $fromLit . ' AND ' . $colA . ' < ' . $toLitExcl;
        $priorFilter = 'AND ' . $col . ' < ' . $fromLit . ' AND ' . $col . ' >= ' . $fromLit . '-' . (int)$windowDays;
    } elseif ($windowDays === null) {
        $timeFilter = ''; $timeFilterA = ''; $priorFilter = '';
    } else {
        $timeFilter  = 'AND ' . $col  . ' >= TRUNC(SYSDATE)-' . ($windowDays - 1);
        $timeFilterA = 'AND ' . $colA . ' >= TRUNC(SYSDATE)-' . ($windowDays - 1);
        $priorFilter = 'AND ' . $col . ' <  TRUNC(SYSDATE)-' . ($windowDays - 1)
                     . ' AND ' . $col . ' >= TRUNC(SYSDATE)-' . ($windowDays * 2 - 1);
    }

    // Trend bucketing: one bar per DAY while the window is short enough to
    // read, one per MONTH beyond that (and for all-time, which has no length).
    $trendDaily = ($windowDays !== null && $windowDays <= $TREND_DAILY_MAX);
    // End of the trend's daily axis: today for the presets, the "to" date for a
    // custom range. Without this the daily loop always walks back from TODAY and
    // a historical custom window charts the wrong days.
    $trendEndTs    = ($rangeParam === 'custom') ? $customEndTs : strtotime(date('Y-m-d') . ' 12:00:00');
    $windowStartTs = ($windowDays === null) ? null : strtotime('-' . ($windowDays - 1) . ' days', $trendEndTs);

    // ---- Comparison window ------------------------------------------------
    // The hidden filter_submitted marker is what makes the checkbox untickable:
    // an UNCHECKED box posts nothing at all, so without it "the admin just
    // unticked Compare" is indistinguishable from "first load" and the saved
    // preference ticks it straight back on.
    $formSubmitted = isset($get['filter_submitted']);
    $cmpOn = false; $cmpFrom = ''; $cmpTo = ''; $cmpStartTs = null; $cmpEndTs = null; $cmpDays = 0;
    $cmpRequested = $formSubmitted ? isset($get['cmp']) : (bool)$prefOr('cmp', false);
    $cmpRawFrom   = isset($get['cfrom']) ? trim($get['cfrom']) : (string)$prefOr('cfrom', '');
    $cmpRawTo     = isset($get['cto'])   ? trim($get['cto'])   : (string)$prefOr('cto', '');
    $cmpFormFrom  = penumbra_an_ymd_ok($cmpRawFrom) ? $cmpRawFrom : '';
    $cmpFormTo    = penumbra_an_ymd_ok($cmpRawTo)   ? $cmpRawTo   : '';
    if ($cmpRequested && $cmpFormFrom !== '' && $cmpFormTo !== '') {
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
        'timeFilter', 'timeFilterA', 'priorFilter',
        'trendDaily', 'trendEndTs', 'windowStartTs', 'TREND_DAILY_MAX',
        'cmpOn', 'cmpFrom', 'cmpTo', 'cmpFormFrom', 'cmpFormTo', 'cmpStartTs', 'cmpEndTs', 'cmpDays', 'cmpPresets',
        'dowParam', 'hourParam', 'whenFilter', 'whenFilterA', 'whenLabel',
        'DOW_KEYS', 'DOW_LABELS', 'formSubmitted'
    );
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
 * Render the active-filter chip strip.
 *
 * "Is this page filtered?" used to be answerable only by reading a grey run-on
 * sentence that said the same amount of words whether one filter was on or
 * none were. Every departure from the defaults is now a chip with its own
 * dismiss button, and the strip itself changes color the moment anything is
 * active - legible before a single word is read.
 *
 * Each chip's 'k' is the KEY its × passes to window.penumbraClearFilter(), so
 * the strip is the only place the "what is on" list is spelled out and removing
 * a filter cannot drift from setting it.
 *
 * @param array $chips  each: k, label, value, on (bool)
 */
function penumbra_filter_bar($chips)
{
    $activeCount = 0;
    foreach ($chips as $c) { if (!empty($c['on'])) $activeCount++; }
    ?>
    <div class="filter-bar<?php echo $activeCount > 0 ? ' is-filtered' : ''; ?>" role="region" aria-label="Active filters">
        <span class="fb-lead">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            <?php if ($activeCount > 0): ?>
                <?php echo (int)$activeCount; ?> filter<?php echo $activeCount === 1 ? '' : 's'; ?> on
            <?php else: ?>
                unfiltered
            <?php endif; ?>
        </span>
        <?php foreach ($chips as $c): ?>
            <span class="chip<?php echo !empty($c['on']) ? ' on' : ''; ?>">
                <span class="chip-k"><?php echo htmlspecialchars($c['label']); ?></span>
                <span class="chip-v" title="<?php echo htmlspecialchars($c['value']); ?>"><?php echo htmlspecialchars($c['value']); ?></span>
                <?php if (!empty($c['on'])): ?>
                    <button type="button" class="chip-x" data-clear="<?php echo htmlspecialchars($c['k']); ?>"
                            title="Remove this filter"
                            aria-label="Remove filter: <?php echo htmlspecialchars($c['label'] . ' ' . $c['value']); ?>">&times;</button>
                <?php endif; ?>
            </span>
        <?php endforeach; ?>
        <?php if ($activeCount > 0): ?>
            <button type="button" class="fb-clear" data-clear="all" title="Reset every filter to its default">Clear all</button>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * The From/To pair + server-computed quick spans, used by both the custom range
 * and the comparison window.
 *
 * data-manual marks these OUT of any generic change->submit binding: "changed"
 * and "ready to run" have to be different moments, because a half-filled pair
 * means nothing and submitting it would just undo the selection.
 */
function penumbra_date_pair($idPrefix, $nameFrom, $nameTo, $valFrom, $valTo, $presets, $todayYmd, $quickClass)
{
    ?>
    <div class="cr-row">
        <label for="<?php echo $idPrefix; ?>From">From</label>
        <input type="date" id="<?php echo $idPrefix; ?>From" name="<?php echo $nameFrom; ?>" data-manual
               max="<?php echo $todayYmd; ?>" value="<?php echo htmlspecialchars($valFrom); ?>">
    </div>
    <div class="cr-row">
        <label for="<?php echo $idPrefix; ?>To">To</label>
        <input type="date" id="<?php echo $idPrefix; ?>To" name="<?php echo $nameTo; ?>" data-manual
               max="<?php echo $todayYmd; ?>" value="<?php echo htmlspecialchars($valTo); ?>">
    </div>
    <?php if (!empty($presets)): ?>
    <div class="cr-quick">
        <?php foreach ($presets as $label => $dates): ?>
            <button type="button" class="cr-q <?php echo htmlspecialchars($quickClass); ?>"
                    data-from="<?php echo $dates[0]; ?>" data-to="<?php echo $dates[1]; ?>"
                    title="<?php echo htmlspecialchars($dates[0] . ' to ' . $dates[1]); ?>"><?php echo htmlspecialchars($label); ?></button>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
    <?php
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
    .sidebar .crumb { font-size: 11px; color: var(--text-muted); margin-bottom: 14px; display: block; }
    .sidebar .crumb a { color: var(--brand-primary); text-decoration: none; }
    .filter-group { margin-bottom: 18px; }
    .filter-group label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 6px; }
    .filter-group input, .filter-group select { width: 100%; padding: 5px 8px; font-size: 12px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; }
    .check-list { display: flex; flex-direction: column; gap: 4px; }
    .check-list label { font-size: 12px; color: var(--text-main); text-transform: none; letter-spacing: 0; display: flex; align-items: center; gap: 8px; }
    .check-list label input { margin: 0; width: auto; }
    .filter-note { font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }

    /* Non-default filter group: an accent rail flush with the sidebar's edge,
       so "which of these did I change" is answerable without reading values.
       The negative margin cancels .sidebar's 18px padding; the rail is 3px so
       15px of padding puts the content back where it was. */
    .filter-group.on { border-left: 3px solid var(--brand-primary); margin-left: -30px; padding-left: 27px; }
    .filter-group.on > label { color: var(--brand-text, var(--brand-primary)); }
    .sidebar h2 .fcount {
        margin-left: auto; font-size: 10px; font-weight: 700; line-height: 1.6;
        min-width: 17px; text-align: center; padding: 0 6px; border-radius: 999px;
        background: var(--brand-primary); color: var(--pivot-header-font, #fff);
    }

    .main { padding: 22px 28px; min-width: 0; }
    .main-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
    .main-head h1, .main-head h2 { margin: 0; font-size: 20px; color: var(--text-main); }   /* h2 since 2026-09-09: the admin bar owns the page's h1 */
    .main-head .range { font-size: 12px; color: var(--text-muted); }

    /* In-table filter buttons (unity tags / report pills) - click fills the
       matching sidebar field and re-runs. Moved here from analytics_all
       2026-08-19 so analytics.php's clickable unity tags dress identically. */
    .fbtn { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; text-align: left; border-bottom: 1px dotted transparent; }
    .fbtn:hover { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
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
    .chip-x:hover { color: var(--an-danger); background: rgba(0,0,0,0.07); }
    body.is-dark .chip-x:hover { background: rgba(255,255,255,0.12); }
    .chip-x:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 1px; }
    .fb-clear {
        margin-left: auto; font-size: 11px; cursor: pointer; color: var(--text-main);
        background: var(--bg-surface); border: 1px solid var(--border-color);
        border-radius: 4px; padding: 3px 10px;
    }
    .fb-clear:hover { border-color: var(--an-danger); color: var(--an-danger); }

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
    .list-more .lm-note.at-cap { color: var(--an-danger); }
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
       pass cleanly underneath. */
    table.dt th { position: sticky; top: 0; z-index: 2; }
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
                r.__pnbText = (r.innerText || r.textContent || '').replace(/\s+/g, ' ').toLowerCase();
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
        if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function cellText(el) {
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
                .map(function (th) { return cellText(th).replace(/[⇅↑↓]/g, '').trim(); });
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
            a.download = 'penumbra-' + (btn.dataset.csv || 'table') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
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
})();
    <?php
}

// NO CLOSING TAG ON PURPOSE. This file is included before analytics_all.php
// writes its preference cookie; a trailing "?" + ">" plus the newline after it
// would emit whitespace, and setcookie() after ANY output is a silent no-op
// ("headers already sent"). The same hazard is why that file's own close tag
// must never be spelled out inside a comment.
