<?php
// AUTO-EXTRACTED from penumbra_render_charts.php - do not edit.
if (!function_exists('penumbra_vis_log')) {
function penumbra_vis_log($msg) {
    if (function_exists('log_scheduler')) { log_scheduler('  ' . $msg); }
    elseif (!empty($GLOBALS['penumbra_vis_log_to_stderr'])) { fwrite(STDERR, $msg . PHP_EOL); }
}
}

if (!function_exists('penumbra_vis_token_name')) {
function penumbra_vis_token_name($n) {
    $s = '';
    $n = (int)$n;
    do { $s = chr(65 + ($n % 26)) . $s; $n = intdiv($n, 26) - 1; } while ($n >= 0);
    return $s;
}
}

if (!function_exists('penumbra_vis_token')) {
function penumbra_vis_token($n) {
    return '__PENUMBRA_VISIMG_' . penumbra_vis_token_name($n) . '__';
}
}

if (!function_exists('penumbra_vis_call_end')) {
function penumbra_vis_call_end($text, $open) {
    $len = strlen($text);
    $depth = 0; $inSQ = false; $inDQ = false;
    for ($j = $open; $j < $len; $j++) {
        $c = $text[$j];
        if ($inSQ) { if ($c === '\\' && $j + 1 < $len) { $j++; continue; } if ($c === "'") $inSQ = false; continue; }
        if ($inDQ) { if ($c === '\\' && $j + 1 < $len) { $j++; continue; } if ($c === '"') $inDQ = false; continue; }
        if ($c === "'") { $inSQ = true; }
        elseif ($c === '"') { $inDQ = true; }
        elseif ($c === '(') { $depth++; }
        elseif ($c === ')') { $depth--; if ($depth === 0) return $j; }
    }
    return -1;
}
}

if (!function_exists('penumbra_vis_extract')) {
function penumbra_vis_extract($text) {
    $calls = array();
    $out = '';
    $len = strlen($text);
    $i = 0;
    while ($i < $len) {
        $c = $text[$i];
        if (($c === 'v' || $c === 'V') && $i + 4 <= $len && strcasecmp(substr($text, $i, 3), 'vis') === 0 && $text[$i + 3] === '(') {
            $prevOk = ($i === 0) || !(ctype_alnum($text[$i - 1]) || $text[$i - 1] === '_');
            if ($prevOk) {
                $end = penumbra_vis_call_end($text, $i + 3);
                if ($end >= 0) {
                    $tok = penumbra_vis_token(count($calls));
                    $calls[$tok] = substr($text, $i, $end - $i + 1);
                    $out .= $tok;
                    $i = $end + 1;
                    continue;
                }
            }
        }
        $out .= $c;
        $i++;
    }
    return array('text' => $out, 'calls' => $calls);
}
}

if (!function_exists('penumbra_vis_plan_walk')) {
function penumbra_vis_plan_walk($text, $from, $to, $ctx, &$ev) {
    $i = $from;
    while ($i < $to) {
        $c = $text[$i];
        if (!(ctype_alnum($c) || $c === '_')) { $i++; continue; }
        // The whole word, so "xvis(" and "2vis(" are not calls (the engine's word-boundary rule).
        $s = $i;
        while ($i < $to && (ctype_alnum($text[$i]) || $text[$i] === '_')) $i++;
        if ($i >= $to || $text[$i] !== '(') continue;
        $name = strtolower(substr($text, $s, $i - $s));
        $end = penumbra_vis_call_end($text, $i);
        if ($end < 0 || $end >= $to) continue;       // unterminated: the engine leaves it as text too
        if ($name === 'vis') {
            $ev[] = array('kind' => 'vis', 'text' => substr($text, $s, $end - $s + 1),
                          'web' => $ctx['web'], 'slide' => $ctx['slide'], 'action' => $ctx['action'], 'other' => $ctx['other']);
            $i = $end + 1;
            continue;
        }
        $inner = $ctx;
        if ($name === 'slide') {
            $ev[] = array('kind' => 'slide', 'text' => '',
                          'web' => $ctx['web'], 'slide' => $ctx['slide'], 'action' => $ctx['action'], 'other' => $ctx['other']);
            $inner['slide'] = true;
        } elseif ($name === 'web') {
            $inner['web'] = true;
        } elseif ($name === 'noweb') {
            // transparent: see the doc comment
        } elseif ($name === 'action') {
            $inner['action'] = true;
        } else {
            $inner['other'] = true;
        }
        penumbra_vis_plan_walk($text, $i + 1, $end, $inner, $ev);
        $i = $end + 1;
    }
}
}

if (!function_exists('penumbra_vis_live_plan')) {
function penumbra_vis_live_plan($text) {
    $text = (string)$text;
    $ev = array();
    penumbra_vis_plan_walk($text, 0, strlen($text), array('web' => false, 'slide' => false, 'action' => false, 'other' => false), $ev);
    $plan = array('calls' => array(), 'pages' => array(), 'certain' => true, 'live' => 0);
    $page = 0;
    foreach ($ev as $e) {
        $p = 0;
        if (!$e['slide'] && !$e['action']) {                   // the browser draws it as a page of its own
            $page++;
            $p = $page;
            if ($e['other']) $plan['certain'] = false;
        }
        if ($e['kind'] === 'vis' && !$e['web']) {              // web() is removed before the email extracts its charts
            $plan['calls'][] = $e['text'];
            $plan['pages'][] = $p;
        }
    }
    $plan['live'] = $page;
    return $plan;
}
}

if (!function_exists('penumbra_vis_chart_pages')) {
function penumbra_vis_chart_pages($calls, $images, $plan, &$why = '') {
    $why = '';
    if (empty($plan['certain'])) {
        $why = 'a chart or slide sits inside a snippet function (case, info ...), so its page on the live report depends on the data';
        return array();
    }
    $toks = array_keys($calls);
    $planCalls = (isset($plan['calls']) && is_array($plan['calls'])) ? $plan['calls'] : array();
    if (array_values($calls) !== $planCalls || !isset($plan['pages']) || !is_array($plan['pages']) || count($plan['pages']) !== count($toks)) {
        $why = 'the email draws ' . count($toks) . ' vis() call(s) and the snippet reads as ' . count($planCalls) . ', so the live report\'s page numbers cannot be trusted';
        return array();
    }
    $out = array();
    $doubt = false;
    foreach ($toks as $k => $tok) {
        $p = (int)$plan['pages'][$k];
        if ($p <= 0) continue;                                 // no page of its own on the live report
        if (!isset($images[$tok])) { $doubt = true; continue; } // not drawn here: the browser draws no page for a chart that fails either
        if (!$doubt) $out[$tok] = $p;
    }
    if ($doubt) $why = 'a chart did not draw, so the page numbers after it are not certain';
    return $out;
}
}

if (!function_exists('penumbra_vis_chart_links')) {
function penumbra_vis_chart_links($calls, $images, $reportMeta) {
    $link = (isset($GLOBALS['penumbra_vis_chart_link']) && is_array($GLOBALS['penumbra_vis_chart_link'])) ? $GLOBALS['penumbra_vis_chart_link'] : array();
    if (empty($link['base']) || !is_string($link['base']) || !$images) return array();
    $plan = (is_array($reportMeta) && isset($reportMeta['visPlan']) && is_array($reportMeta['visPlan'])) ? $reportMeta['visPlan'] : null;
    if ($plan === null) { penumbra_vis_log('Charts: no full-screen links - the snippet was not numbered'); return array(); }
    $why = '';
    $pages = penumbra_vis_chart_pages($calls, $images, $plan, $why);
    if (!$pages) {
        if ($why !== '') penumbra_vis_log('Charts: no full-screen links - ' . $why);
        return array();
    }
    $out = array();
    foreach ($pages as $tok => $page) {
        $out[$tok] = array('page' => (int)$page, 'href' => $link['base'] . '&fullscreen=true&fspages=' . (int)$page,
                           'color' => isset($link['color']) ? (string)$link['color'] : '', 'font' => isset($link['font']) ? (string)$link['font'] : '',
                           'caption' => (isset($link['caption']) && is_string($link['caption'])) ? $link['caption'] : '');
    }
    penumbra_vis_log('Charts: full-screen links for ' . count($out) . ' of ' . count($images) . ' drawn chart(s) (live pages ' . implode(', ', array_values($pages)) . ')'
        . ($why !== '' ? ' - ' . $why : ''));
    return $out;
}
}

if (!function_exists('penumbra_vis_asset_list')) {
function penumbra_vis_asset_list() {
    return array(
        // boot set (the same list every headless harness stages)
        'js/jquery-3.7.1.min.js', 'js/jquery-ui.min.js', 'js/moment.min.js', 'js/pako.min.js',
        'js/codemirror.min.js', 'js/sql.min.js', 'js/show-hint.js', 'js/foldcode.js', 'js/foldgutter.js',
        'js/brace-fold.js', 'js/comment-fold.js', 'js/placeholder.js', 'js/penumbra_snippet_help.js',
        'js/purify.min.js', 'js/penumbra_template.js',
        // lazy chart set (main.js loadScript()s these by their literal js/ paths)
        'js/chart-4.5.1.min.js', 'js/chartjs-plugin-datalabels-2.0.0.min.js', 'js/chartjs-chart-treemap-3.1.0.min.js',
        'js/penumbra_charts.js', 'js/penumbra_geo_us.js',
        // the theme variables
        'css/main.css'
    );
}
}

if (!function_exists('penumbra_vis_theme_class')) {
function penumbra_vis_theme_class($theme) {
    $t = trim((string)$theme);
    return preg_match('/^theme-[a-z0-9-]{1,40}$/i', $t) ? strtolower($t) : 'theme-default';
}
}

if (!function_exists('penumbra_vis_hook_line')) {
function penumbra_vis_hook_line() {
    return "\r\n    try { window.__RENDER = { render: renderReportSnippet, setRows: function (r) { masterRowData = r; }, getEditor: function () { return snippetEditor; }, setLoading: function (v) { isStateLoading = !!v; }, setCustomSorts: function (o) { customSortOrders = (o && typeof o === 'object') ? o : {}; _csInvalidateComparators(); }, applyTheme: function (t) { applyTheme(t); } }; } catch (e) { window.__RENDER_ERR = String(e); }\r\n";
}
}

if (!function_exists('penumbra_vis_assets_sync')) {
function penumbra_vis_assets_sync($queueDir, $webroot) {
    $src = rtrim($webroot, '/\\') . DIRECTORY_SEPARATOR . 'js';
    $dst = rtrim($queueDir, '/\\') . DIRECTORY_SEPARATOR . 'js';
    if (!is_dir($dst) && !@mkdir($dst, 0777, true)) {
        return array('ok' => false, 'error' => 'cannot create ' . $dst, 'copied' => array());
    }
    $copied = array();
    $root = rtrim($webroot, '/\\');
    $qdir = rtrim($queueDir, '/\\');
    foreach (penumbra_vis_asset_list() as $f) {
        $s = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $f);
        $d = $qdir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $f);
        $dd = dirname($d);
        if (!is_dir($dd) && !@mkdir($dd, 0777, true)) return array('ok' => false, 'error' => 'cannot create ' . $dd, 'copied' => $copied);
        clearstatcache(true, $s); clearstatcache(true, $d);
        if (!is_file($s)) return array('ok' => false, 'error' => 'missing app asset ' . $f, 'copied' => $copied);
        if (is_file($d) && filesize($d) === filesize($s) && filemtime($d) === filemtime($s)) continue;
        if (!@copy($s, $d . '.tmp')) return array('ok' => false, 'error' => 'copy failed for ' . $f, 'copied' => $copied);
        @unlink($d);
        if (!@rename($d . '.tmp', $d)) return array('ok' => false, 'error' => 'rename failed for ' . $f, 'copied' => $copied);
        @touch($d, filemtime($s));
        $copied[] = $f;
    }
    $m = $src . DIRECTORY_SEPARATOR . 'main.js';
    $r = $dst . DIRECTORY_SEPARATOR . 'main_render.js';
    $stampF = $dst . DIRECTORY_SEPARATOR . 'main_render.stamp';
    clearstatcache(true, $m); clearstatcache(true, $r); clearstatcache(true, $stampF);
    if (!is_file($m)) return array('ok' => false, 'error' => 'missing app asset js/main.js', 'copied' => $copied);
    $stamp = filesize($m) . ':' . filemtime($m) . ':' . PENUMBRA_VIS_HOOK_VERSION;
    $have = is_file($stampF) ? trim((string)@file_get_contents($stampF)) : '';
    if ($have !== $stamp || !is_file($r)) {
        $js = @file_get_contents($m);
        if ($js === false) return array('ok' => false, 'error' => 'main.js unreadable', 'copied' => $copied);
        $anchor = '$(document).ready(function () {';
        $p = strpos($js, $anchor);
        if ($p === false || $p > 200) return array('ok' => false, 'error' => 'main.js ready() anchor not found - update penumbra_render_charts.php', 'copied' => $copied);
        $patched = substr($js, 0, $p + strlen($anchor)) . penumbra_vis_hook_line() . substr($js, $p + strlen($anchor));
        if (@file_put_contents($r . '.tmp', $patched) === false) return array('ok' => false, 'error' => 'cannot write main_render.js', 'copied' => $copied);
        @unlink($r);
        if (!@rename($r . '.tmp', $r)) return array('ok' => false, 'error' => 'rename failed for main_render.js', 'copied' => $copied);
        @file_put_contents($stampF, $stamp);
        $copied[] = 'main_render.js';
    }
    return array('ok' => true, 'error' => '', 'copied' => $copied);
}
}

if (!function_exists('penumbra_vis_col_props')) {
function penumbra_vis_col_props($rows, $cols) {
    $props = array();
    $sample = min(count($rows), 100);
    foreach ($cols as $ci => $name) {
        $cur = 0; $num = 0; $seen = 0;
        for ($i = 0; $i < $sample; $i++) {
            $v = isset($rows[$i][$ci]) ? trim((string)$rows[$i][$ci]) : '';
            if ($v === '') continue;
            $seen++;
            if (strpos($v, '$') !== false) $cur++;
            if (is_numeric(str_replace(array('$', ',', '%'), '', $v))) $num++;
        }
        $props[$ci + 1] = array(
            'isCurrency' => ($seen > 0 && $cur > $seen * 0.5),
            'isNumeric'  => ($seen > 0 && $num > $seen * 0.5),
            'isBoolean'  => false,
            'isDate'     => false
        );
    }
    return $props;
}
}

if (!function_exists('penumbra_vis_page_html')) {
function penumbra_vis_page_html($calls, $data, $columns, $opts = array()) {
    if (!is_array($opts)) $opts = array();
    $theme = penumbra_vis_theme_class(isset($opts['theme']) ? $opts['theme'] : '');
    $customSorts = (isset($opts['customSorts']) && is_array($opts['customSorts'])) ? $opts['customSorts'] : array();
    $cols = array();
    foreach ((array)$columns as $c) { $cols[] = strtoupper((string)$c); }
    if (!$cols && is_array($data) && $data) { $first = reset($data); if (is_array($first)) foreach (array_keys($first) as $k) $cols[] = strtoupper((string)$k); }
    $rows = array();
    $n = 0;
    foreach ((array)$data as $r) {
        if ($n++ >= PENUMBRA_VIS_MAX_ROWS) break;
        $row = array();
        foreach ($cols as $c) {
            $v = null;
            if (is_array($r)) {
                if (isset($r[$c])) $v = $r[$c];
                else { foreach ($r as $k => $val) { if (strtoupper((string)$k) === $c) { $v = $val; break; } } }
            }
            $row[] = ($v === null || !is_scalar($v)) ? '' : (string)$v;
        }
        $rows[] = $row;
    }
    $nameToIndex = array();
    foreach ($cols as $i => $c) { $nameToIndex[$c] = $i + 1; }
    $slots = array();
    $s = 0;
    foreach ($calls as $tok => $call) { $slots[] = '<span class="pnb-vis-slot" data-slot="s' . $s . '">' . $call . '</span>'; $s++; }
    $payload = array(
        'columns'     => $cols,
        'rows'        => $rows,
        'props'       => penumbra_vis_col_props($rows, $cols),
        'nameToIndex' => $nameToIndex,
        'snippet'     => implode("\n", $slots),
        'rowsTotal'   => is_array($data) ? count($data) : 0,
        'customSorts' => (object)$customSorts,
        'theme'       => $theme
    );
    $json = json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) return false;
    $scripts = '';
    $boot = array('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js', 'show-hint.js',
                  'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js', 'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js');
    foreach ($boot as $f) { $scripts .= '<script src="js/' . $f . '"></script>' . "\n"; }
    // The column a "%" chart width resolves against: 900 as ever, or the fluid
    // reference (PENUMBRA_VIS_FLUID_WIDTH) when the caller lays the email out fluid.
    $bw = (isset($opts['baseWidth']) && (int)$opts['baseWidth'] >= 200 && (int)$opts['baseWidth'] <= 4000) ? (int)$opts['baseWidth'] : (int)PENUMBRA_VIS_BASE_WIDTH;
    // main.css brings the theme classes (body.theme-x sets --brand-primary, the
    // fonts and --text-main the chart code reads); the rules below then pin the
    // page itself to a white sheet, which is what the email shows the chart on,
    // and keep the boot DOM out of the picture.
    return '<!doctype html>
<html><head><meta charset="utf-8"><title>penumbra chart render</title>
<link rel="stylesheet" href="css/main.css">
<style>
html,body{margin:0 !important;padding:0 !important;background:#ffffff !important;background-image:none !important;font-size:12px}
#reportSnippetOutput{display:block !important;width:' . $bw . 'px !important;max-width:none !important;min-height:0 !important;margin:0 !important;padding:0 !important;background:transparent !important}
#editorTabs,#pivotLightbox,#pivot-output-container,#groupedResultsContainer,#errorBox,#mainReportSubtitle,#resultsTable,#tableSearch{display:none !important}
.CodeMirror{position:absolute !important;left:-9999px !important;top:0 !important;width:600px !important;height:200px !important}
</style></head>
<body class="' . htmlspecialchars($theme, ENT_QUOTES) . '">
<!-- The boot DOM every headless harness uses (penumbra_tests\pivot_trigger\harness.html):
     main.js binds the pivot-builder elements DIRECTLY at ready time, so they must exist. -->
<div id="editorTabs"></div><div id="reportSnippetOutput"></div><div id="mainReportSubtitle"></div>
<textarea id="sqlQuery"></textarea><textarea id="reportSnippet"></textarea><textarea id="subquerySql"></textarea>
<table id="resultsTable"><thead id="tableHeader"><tr><th data-colname="#">#</th></tr></thead><tbody></tbody></table>
<div id="errorBox"></div>
<input id="tableSearch" value="">
<div id="pivot-output-container" style="display:none"></div>
<div id="groupedResultsContainer" style="display:none"></div>
<div id="pivotLightbox" style="display:none">
  <div id="pivot-source-columns"></div>
  <div id="pivot-rows"></div><div id="pivot-cols"></div><div id="pivot-vals"></div>
  <select id="pivot-aggregation-selector"><option value="">-</option><option value="sum">sum</option></select>
  <table><tbody id="pivot-agg-table-body"></tbody></table>
  <select id="pivot-rows-layout-select"><option value="nested">nested</option><option value="nested-static">nested-static</option><option value="flat">flat</option></select>
  <select id="pivot-cols-layout-select"><option value="nested">nested</option><option value="flat">flat</option></select>
  <select id="pivot-sort-order"><option value="asc">asc</option><option value="desc">desc</option></select>
  <input id="pivot-sticky-cols" value="3">
  <input type="checkbox" id="pivot-row-total-override-toggle">
  <div id="pivot-row-total-override-container" style="display:none"><div id="pivot-row-total-slots"></div><div id="pivot-row-total-tokens"></div></div>
  <select id="pivot-rank-dir"><option value="none">none</option><option value="top">top</option><option value="bottom">bottom</option></select>
  <input id="pivot-rank-n" value="10"><select id="pivot-rank-agg"><option value="sum">sum</option><option value="count">count</option></select>
  <select id="pivot-rank-scope"><option value="">Overall</option></select>
  <input type="checkbox" id="pivot-rank-other" checked><label id="pivot-rank-other-label"></label>
  <input type="checkbox" id="pivot-no-breakdown"><input type="checkbox" id="pivot-start-expanded">
  <select id="pivotPresetSelect"><option value=""></option></select><button id="pivotDeletePresetBtn"></button><input type="checkbox" id="pivotAutoRunPreset">
  <button id="generatePivotBtn">Generate</button>
  <select id="pivotSnippetTargetSelect" style="display: none;"></select>
  <button id="updatePivotSnippetBtn" type="button" style="display: none;">&#x27F3; Update Snippet</button>
  <button id="copyPivotSnippetBtn">Snippet</button>
  <button id="pivotSavePresetBtn"></button>
</div>
<pre id="out">running</pre>
' . $scripts . '<script>
  // Boot stubs (same as the harnesses): no server, no animation, no observers.
  window.penumbra_vars = {
    isAdmin: true, isGlobalAdmin: true, currentUserKey: "render", shibboleth: { ouc: "", dept: "" },
    tables: { oracle: [], pins: [], infoed: [], hr: [], fin: [] },
    imports: [], reports: [], themes: {}, prompts: {}, grants: []
  };
  jQuery.ajax = function () { var d = jQuery.Deferred(); d.resolve({}); return d.promise(); };
  jQuery.getJSON = jQuery.ajax; jQuery.post = jQuery.ajax; jQuery.get = jQuery.ajax;
  jQuery.fx.off = true;
  window.ResizeObserver = function () { this.observe = function () {}; this.unobserve = function () {}; this.disconnect = function () {}; };
  window.IntersectionObserver = window.ResizeObserver;
  if (!window.matchMedia) {
    window.matchMedia = function () { return { matches: false, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} }; };
  }
  window.__errors = [];
  window.onerror = function (m, src, line) { window.__errors.push(String(m) + " @" + String(src).split("/").pop() + ":" + line); return true; };
  // Chart.js is loaded lazily by main.js; the moment its UMD assigns window.Chart,
  // switch animation off globally so the first frame is the finished chart.
  (function () {
    var stored;
    try {
      Object.defineProperty(window, "Chart", { configurable: true, enumerable: true,
        get: function () { return stored; },
        set: function (v) { stored = v; try { if (v && v.defaults) { v.defaults.animation = false; } } catch (e) {} } });
    } catch (e) {}
  })();
  window.__PAGE = ' . $json . ';
</script>
<script src="js/main_render.js"></script>
<script>
(function () {
  var out = document.getElementById("out");
  function finish(o) { try { o.pageErrors = (window.__errors || []).slice(0, 10); } catch (e) {} out.textContent = "RESULT_JSON:" + JSON.stringify(o); }
  function b64(dataUrl) { var i = dataUrl.indexOf(","); return i < 0 ? "" : dataUrl.substring(i + 1); }
  var P = window.__PAGE;
  // Nothing drawn at all: every pixel transparent on a 24x24 downscale.
  function isBlank(cv) {
    try {
      var s = document.createElement("canvas"); s.width = 24; s.height = 24;
      var x = s.getContext("2d"); x.drawImage(cv, 0, 0, 24, 24);
      var d = x.getImageData(0, 0, 24, 24).data;
      for (var i = 3; i < d.length; i += 4) { if (d[i] > 0) return false; }
      return true;
    } catch (e) { return false; }
  }
  // Wait until the slot canvases stop changing (a second render would swap
  // them for new, undrawn ones) and each one has its Chart instance.
  // diag rides back in the result: how many times the snippet output was
  // written (a second write = another render) and how often the canvases
  // changed while settling - the scheduler log prints it when it is not 1 / 0.
  var diag = { slotWrites: 0, swaps: 0, polls: 0 };
  function settle() {
    return new Promise(function (res) {
      var last = null, same = 0, tries = 0;
      (function poll() {
        var cvs = Array.prototype.slice.call(document.querySelectorAll("#reportSnippetOutput .pnb-vis-slot canvas"));
        var sig = cvs.map(function (c) { return c.id; }).join(",");
        var ready = cvs.every(function (c) { return !!(window.Chart && window.Chart.getChart && window.Chart.getChart(c)); });
        if (sig === last && ready) { same++; } else { if (last !== null && sig !== last) diag.swaps++; same = 0; last = sig; }
        tries++; diag.polls = tries;
        if (same >= 3 || tries > 80) { res(); return; }
        setTimeout(poll, 100);
      })();
    });
  }
  function collect() {
    var charts = [];
    $("#reportSnippetOutput .pnb-vis-slot").each(function () {
      var $s = $(this), rec = { slot: $s.attr("data-slot"), ok: false };
      var cv = $s.find("canvas")[0];
      if (cv) {
        try {
          var ch = (window.Chart && window.Chart.getChart) ? window.Chart.getChart(cv) : null;
          // The final frame, synchronously: an animate=true chart (fycompprop,
          // 2026-09-29) is otherwise captured on its first, empty frame.
          if (ch) { try { ch.stop(); ch.update("none"); } catch (e) {} }
          var cfg = $(cv).data("vizConfig") || {};
          var c2 = document.createElement("canvas"); c2.width = cv.width; c2.height = cv.height;
          var ctx = c2.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c2.width, c2.height); ctx.drawImage(cv, 0, 0);
          rec.w = Math.round(ch && ch.width ? ch.width : cv.width); rec.h = Math.round(ch && ch.height ? ch.height : cv.height);
          rec.title = String(cfg.title || "");
          rec.wspec = String(cfg.width == null ? "" : cfg.width);
          rec.labels = (ch && ch.data && ch.data.labels) ? ch.data.labels.slice(0, 40).map(String) : [];
          rec.colors = (ch && ch.data && ch.data.datasets) ? ch.data.datasets.slice(0, 6).map(function (d) { var b = d.borderColor; return typeof b === "string" ? b : (Array.isArray(b) ? String(b[0]) : String(typeof b)); }) : [];
          if (isBlank(cv)) {
            rec.error = "blank canvas (nothing drawn" + (ch ? "" : ", no chart instance") + ")";
          } else {
            rec.png = b64(cv.toDataURL("image/png"));
            rec.jpeg = b64(c2.toDataURL("image/jpeg", 0.92));
            rec.ok = rec.png.length > 0;
          }
        } catch (e) { rec.error = "capture: " + (e && e.message ? e.message : e); }
      } else {
        rec.error = (($s.text() || "").trim().substring(0, 300)) || "no canvas was drawn";
      }
      charts.push(rec);
    });
    try {
      diag.brand = (getComputedStyle(document.body).getPropertyValue("--brand-primary") || "").trim();
      diag.bodyClass = String(document.body.className || "");
      diag.dataTheme = String(document.body.getAttribute("data-theme") || "");
    } catch (e) {}
    finish({ charts: charts, slots: $("#reportSnippetOutput .pnb-vis-slot").length, diag: diag });
  }
  function run() {
    var R = window.__RENDER;
    if (!R || typeof R.render !== "function") { finish({ fatal: "render hook unavailable: " + (window.__RENDER_ERR || "n/a") }); return; }
    var maps = P.rows.map(function (r, i) {
      var m = new Map(); m.set("#", String(i + 1));
      for (var c = 0; c < P.columns.length; c++) { m.set(P.columns[c], r[c] == null ? "" : String(r[c])); }
      return m;
    });
    // This page has no report id, so main.js treats it as the landing page and
    // puts the landing default theme on <body> at boot (theme-wolfpack, seen
    // 2026-09-29: every render came back in NC State red whatever the theme of the report
    // is). Strip every theme class and apply the page theme through
    // main.js itself, which also drops the derived-palette cache.
    try {
      var keep = String(document.body.className || "").split(/\s+/).filter(function (c) { return c && !/^theme-/.test(c) && c !== "is-dark" && c !== "registry-theme"; });
      document.body.className = keep.join(" ");
      document.body.removeAttribute("data-theme");
      var applied = false;
      try { if (typeof R.applyTheme === "function") { R.applyTheme(P.theme); applied = true; } } catch (e) {}
      if (P.theme !== "theme-default" && !document.body.classList.contains(P.theme)) document.body.classList.add(P.theme);
      if (!applied) { try { if (typeof window.penumbraResetPaletteCache === "function") window.penumbraResetPaletteCache(); } catch (e) {} }
    } catch (e) {}
    R.setRows(maps);
    try { if (typeof R.setCustomSorts === "function") R.setCustomSorts(P.customSorts || {}); } catch (e) {}
    $("#resultsTable").data("columnNameToOriginalIndex", P.nameToIndex).data("columnProperties", P.props);
    var ed = R.getEditor();
    if (!ed || typeof ed.setValue !== "function") { finish({ fatal: "snippet editor unavailable" }); return; }
    // The live-edit handler of the editor would re-render one second after setValue
    // and replace the canvases while they are captured (the blank charts of
    // 2026-09-29 19:57): raise the loading flag it checks first, and drop the
    // change handlers of the editor as well.
    try { if (typeof R.setLoading === "function") R.setLoading(true); } catch (e) {}
    try { if (ed._handlers && ed._handlers.change) ed._handlers.change = []; } catch (e) {}
    try {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var n = m.addedNodes[i];
            if (n.nodeType === 1 && (n.classList.contains("pnb-vis-slot") || (n.querySelector && n.querySelector(".pnb-vis-slot")))) { diag.slotWrites++; break; }
          }
        });
      }).observe(document.getElementById("reportSnippetOutput"), { childList: true, subtree: true });
    } catch (e) {}
    ed.setValue(P.snippet);
    var p;
    try { p = R.render(maps, false, { ignorePendingViewState: true }); } catch (e) { finish({ fatal: "render threw: " + (e && e.message ? e.message : e) }); return; }
    Promise.resolve(p)
      .then(settle)
      .then(collect, function (e) { finish({ fatal: "render rejected: " + (e && e.message ? e.message : e) }); });
  }
  if (document.readyState === "complete") { setTimeout(run, 0); } else { window.addEventListener("load", function () { setTimeout(run, 0); }); }
})();
</script>
</body></html>';
}
}

if (!function_exists('penumbra_vis_parse_dom')) {
function penumbra_vis_parse_dom($dom) {
    $dom = (string)$dom;
    $i = strpos($dom, '<pre id="out">');
    if ($i === false) return array('ok' => false, 'error' => 'no result block in the rendered page (' . strlen($dom) . ' bytes)');
    $j = strpos($dom, '</pre>', $i);
    if ($j === false) return array('ok' => false, 'error' => 'unterminated result block');
    $txt = html_entity_decode(substr($dom, $i + 14, $j - $i - 14), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $txt = trim($txt);
    if (strpos($txt, 'RESULT_JSON:') !== 0) return array('ok' => false, 'error' => 'page did not finish: ' . substr($txt, 0, 200));
    $o = json_decode(substr($txt, 12), true);
    if (!is_array($o)) return array('ok' => false, 'error' => 'result block is not JSON');
    if (isset($o['fatal'])) return array('ok' => false, 'error' => (string)$o['fatal'], 'pageErrors' => isset($o['pageErrors']) ? $o['pageErrors'] : array());
    return array('ok' => true, 'error' => '', 'charts' => isset($o['charts']) && is_array($o['charts']) ? $o['charts'] : array(),
                 'pageErrors' => isset($o['pageErrors']) && is_array($o['pageErrors']) ? $o['pageErrors'] : array(),
                 'diag' => isset($o['diag']) && is_array($o['diag']) ? $o['diag'] : array());
}
}

if (!function_exists('penumbra_vis_render_calls')) {
function penumbra_vis_render_calls($calls, $data, $columns, $webroot = null, $pageOpts = array()) {
    $t0 = microtime(true);
    $q = penumbra_render_queue_dir();
    if ($webroot === null) {
        // The app root (this file lives in it); a test points it at the live app.
        $webroot = isset($GLOBALS['PENUMBRA_VIS_WEBROOT_OVERRIDE']) ? $GLOBALS['PENUMBRA_VIS_WEBROOT_OVERRIDE'] : dirname(__FILE__);
    }
    $sync = penumbra_vis_assets_sync($q, $webroot);
    if (!$sync['ok']) return array('ok' => false, 'error' => 'render assets: ' . $sync['error'], 'images' => array(), 'ms' => 0);
    if ($sync['copied']) penumbra_vis_log('Charts: refreshed render assets (' . implode(', ', $sync['copied']) . ')');
    $html = penumbra_vis_page_html($calls, $data, $columns, $pageOpts);
    if ($html === false) return array('ok' => false, 'error' => 'the report rows could not be encoded for the render page', 'images' => array(), 'ms' => 0);
    $r = penumbra_render_html_to_dom($html, array('budget' => PENUMBRA_VIS_BUDGET_MS, 'width' => 1200, 'height' => 900), PENUMBRA_VIS_TIMEOUT_SEC);
    if (!$r['ok']) return array('ok' => false, 'error' => $r['error'], 'images' => array(), 'ms' => $r['ms']);
    $p = penumbra_vis_parse_dom($r['dom']);
    if (!$p['ok']) {
        $extra = !empty($p['pageErrors']) ? ' [page: ' . implode('; ', array_slice($p['pageErrors'], 0, 3)) . ']' : '';
        return array('ok' => false, 'error' => $p['error'] . $extra, 'images' => array(), 'ms' => $r['ms']);
    }
    $tokens = array_keys($calls);
    $images = array();
    foreach ($p['charts'] as $c) {
        $slot = isset($c['slot']) ? (string)$c['slot'] : '';
        $idx = (strlen($slot) > 1 && $slot[0] === 's') ? (int)substr($slot, 1) : -1;
        if ($idx < 0 || !isset($tokens[$idx])) continue;
        if (empty($c['ok'])) { penumbra_vis_log('Charts: chart ' . ($idx + 1) . ' not drawn - ' . (isset($c['error']) ? $c['error'] : 'unknown')); continue; }
        $png = isset($c['png']) ? base64_decode($c['png'], true) : false;
        if ($png === false || strlen($png) < 100 || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n") { penumbra_vis_log('Charts: chart ' . ($idx + 1) . ' produced no usable image'); continue; }
        $jpeg = isset($c['jpeg']) ? base64_decode($c['jpeg'], true) : false;
        if ($jpeg === false || strlen($jpeg) < 100 || substr($jpeg, 0, 2) !== "\xFF\xD8") $jpeg = null;
        try { $rand = bin2hex(random_bytes(6)); } catch (Exception $e) { $rand = substr(md5(uniqid('', true)), 0, 12); }
        // The width the author gave vis(): a "49%" is remembered as 49.0 so a fluid
        // email can show the picture at that share of its own width (0 = pixels).
        $wpct = 0.0;
        if (isset($c['wspec']) && preg_match('/^\s*(\d+(?:\.\d+)?)\s*%\s*$/', (string)$c['wspec'], $wm) && (float)$wm[1] > 0 && (float)$wm[1] <= 100) $wpct = (float)$wm[1];
        $images[$tokens[$idx]] = array(
            'cid'    => 'pnbvis-' . $rand . '@penumbra',
            'png'    => $png,
            'jpeg'   => $jpeg,
            'width'  => max(1, (int)(isset($c['w']) ? $c['w'] : 0)),
            'height' => max(1, (int)(isset($c['h']) ? $c['h'] : 0)),
            'wpct'   => $wpct,
            'alt'    => isset($c['title']) ? (string)$c['title'] : '',
            // what the page drew (for the suite and the log; never mailed)
            'labels' => (isset($c['labels']) && is_array($c['labels'])) ? array_slice($c['labels'], 0, 40) : array(),
            'colors' => (isset($c['colors']) && is_array($c['colors'])) ? array_slice($c['colors'], 0, 6) : array()
        );
    }
    if (!empty($p['pageErrors'])) penumbra_vis_log('Charts: page errors: ' . implode('; ', array_slice($p['pageErrors'], 0, 3)));
    $dg = $p['diag'];
    if ($dg && ((isset($dg['slotWrites']) && (int)$dg['slotWrites'] !== 1) || !empty($dg['swaps']))) {
        penumbra_vis_log('Charts: page diag: the snippet output was written ' . (int)$dg['slotWrites'] . ' time(s), canvases swapped ' . (int)$dg['swaps'] . ' time(s) while settling (' . (int)$dg['polls'] . ' polls)');
    }
    return array('ok' => true, 'error' => '', 'images' => $images, 'ms' => (int)round((microtime(true) - $t0) * 1000),
                 'brand' => isset($dg['brand']) ? (string)$dg['brand'] : '', 'bodyClass' => isset($dg['bodyClass']) ? (string)$dg['bodyClass'] : '');
}
}

if (!function_exists('penumbra_vis_render_snippet')) {
function penumbra_vis_render_snippet($text, $data, $columns, $reportMeta = array()) {
    $GLOBALS['penumbra_vis_images'] = array();
    $ex = penumbra_vis_extract($text);
    if (empty($ex['calls'])) return $text;
    $n = count($ex['calls']);
    $images = array();
    $why = '';
    $r = null;
    $fluid = penumbra_vis_fluid_layout();
    if (!function_exists('penumbra_render_html_to_dom')) {
        $why = 'the render client is missing';
    } elseif (!penumbra_render_worker_alive()) {
        $why = 'the render worker is not running (stale heartbeat in ' . penumbra_render_queue_dir() . ')';
    } elseif ($GLOBALS['penumbra_vis_render_count'] >= PENUMBRA_VIS_MAX_RENDERS) {
        $why = 'the render cap for this run (' . PENUMBRA_VIS_MAX_RENDERS . ') was reached';
    } else {
        $GLOBALS['penumbra_vis_render_count']++;
        // The report's theme (its palettes derive from the theme's brand colour)
        // and its saved custom sort orders (a label-sorted axis follows them).
        $pageOpts = array(
            'theme'       => isset($reportMeta['theme']) ? $reportMeta['theme'] : '',
            'customSorts' => (isset($reportMeta['customSortOrders']) && is_array($reportMeta['customSortOrders'])) ? $reportMeta['customSortOrders'] : array()
        );
        // Dashboard layout: the snippet has a row of its own as wide as the email, so a
        // "%" chart is drawn against the larger fluid reference and shown at that share
        // of whatever width the reader's window gives it (2026-10-06).
        if ($fluid) $pageOpts['baseWidth'] = (int)PENUMBRA_VIS_FLUID_WIDTH;
        // Named in the log so a wrong or missing hand-over shows up on the box
        // (2026-09-29: the call sites once read a variable that was out of scope,
        // and isset() kept quiet about it).
        penumbra_vis_log('Charts: theme ' . penumbra_vis_theme_class($pageOpts['theme']) . ', custom sort orders for '
            . (count($pageOpts['customSorts']) ? implode(', ', array_keys($pageOpts['customSorts'])) : 'no column'));
        $r = penumbra_vis_render_calls($ex['calls'], $data, $columns, null, $pageOpts);
        if ($r['ok']) $images = $r['images']; else $why = $r['error'];
        // The PDF is not themed (its table is plain), so when one is attached
        // and the email theme is not the default, draw the charts a second time
        // in the default theme for the PDF's chart pages (pdfpng / pdfjpeg).
        if ($r['ok'] && !empty($reportMeta['pdfCharts']) && $images && penumbra_vis_theme_class($pageOpts['theme']) !== 'theme-default') {
            if ($GLOBALS['penumbra_vis_render_count'] < PENUMBRA_VIS_MAX_RENDERS) {
                $GLOBALS['penumbra_vis_render_count']++;
                $pdfOpts = $pageOpts; $pdfOpts['theme'] = 'theme-default';
                $p2 = penumbra_vis_render_calls($ex['calls'], $data, $columns, null, $pdfOpts);
                if ($p2['ok']) {
                    $got = 0;
                    foreach ($p2['images'] as $tok => $pimg) {
                        if (!isset($images[$tok])) continue;
                        $images[$tok]['pdfpng'] = $pimg['png'];
                        $images[$tok]['pdfjpeg'] = $pimg['jpeg'];
                        $images[$tok]['pdfcolors'] = $pimg['colors'];
                        $got++;
                    }
                    penumbra_vis_log('Charts: PDF copies drawn in the default theme (' . $got . ' of ' . count($images) . ') in ' . $p2['ms'] . ' ms');
                } else {
                    penumbra_vis_log('Charts: PDF copies not drawn (' . $p2['error'] . ') - the PDF takes the themed charts');
                }
            } else {
                penumbra_vis_log('Charts: PDF copies skipped - the render cap for this run was reached; the PDF takes the themed charts');
            }
        }
    }
    if ($why !== '') {
        penumbra_vis_log('Charts: ' . $n . ' vis() call' . ($n === 1 ? '' : 's') . ' dropped from the email - ' . $why);
    } else {
        penumbra_vis_log('Charts: rendered ' . count($images) . ' of ' . $n . ' vis() call' . ($n === 1 ? '' : 's') . ' in ' . $r['ms'] . ' ms'
            . ' (page brand ' . ($r['brand'] !== '' ? $r['brand'] : 'unset') . ', body class "' . $r['bodyClass'] . '")');
    }
    // A drawn chart that is a page of its own on the live report links to that
    // page's full-screen view (2026-10-06); the rest keep the plain picture.
    $links = penumbra_vis_chart_links($ex['calls'], $images, $reportMeta);
    $nFluid = 0;
    foreach ($ex['calls'] as $tok => $call) {
        $img = isset($images[$tok]) ? $images[$tok] : null;
        if ($img !== null && isset($links[$tok])) {
            $img['page'] = $links[$tok]['page'];
            $img['href'] = $links[$tok]['href'];
            $img['linkColor'] = $links[$tok]['color'];
            $img['linkFont'] = $links[$tok]['font'];
            $img['linkCaption'] = $links[$tok]['caption'];
        }
        // A "%" chart of a Dashboard-layout email scales with the email's width.
        if ($img !== null && $fluid && !empty($img['wpct'])) { $img['fluid'] = true; $nFluid++; }
        $GLOBALS['penumbra_vis_images'][$tok] = $img;
    }
    if ($nFluid) penumbra_vis_log('Charts: ' . $nFluid . ' of ' . count($images) . ' drawn chart(s) have a % width and scale with the email (drawn against ' . (int)PENUMBRA_VIS_FLUID_WIDTH . 'px, shown at that share of the reader\'s window)');
    return $ex['text'];
}
}

if (!function_exists('penumbra_vis_img_tag')) {
function penumbra_vis_img_tag($img, $inCell = false) {
    $linked = !empty($img['href']);
    // A linked chart is a block (its caption sits under it), so it takes the cell styling too.
    $block = $inCell || $linked;
    $tag = '<img src="cid:' . htmlspecialchars($img['cid'], ENT_QUOTES) . '" width="' . (int)$img['width'] . '" height="' . (int)$img['height'] . '"'
         . ($linked ? ' border="0"' : '')
         . ' alt="' . htmlspecialchars($img['alt'], ENT_QUOTES) . '"'
         . ' style="' . ($block ? 'display:block; margin:0;' : 'display:inline-block; vertical-align:top; margin:4px 0;') . ' max-width:100%; height:auto; border:0;">';
    return $linked ? penumbra_vis_linked_chart($img, $tag, $inCell) : $tag;
}
}

if (!function_exists('penumbra_vis_linked_chart')) {
function penumbra_vis_linked_chart($img, $imgTag, $inCell) {
    $href = htmlspecialchars((string)$img['href'], ENT_QUOTES);
    $title = 'Open this chart in full view';
    $color = (isset($img['linkColor']) && preg_match('/^#[0-9a-fA-F]{3,8}$/', (string)$img['linkColor'])) ? 'color:' . $img['linkColor'] . '; ' : '';
    $font = (isset($img['linkFont']) && preg_match('/^[A-Za-z0-9 ,\-]{1,60}$/', (string)$img['linkFont'])) ? $img['linkFont'] . ', ' : '';
    $capText = (isset($img['linkCaption']) && is_string($img['linkCaption']) && trim($img['linkCaption']) !== '')
        ? htmlspecialchars(trim($img['linkCaption']), ENT_QUOTES, 'UTF-8') : 'Open to full view';
    $pic = '<a href="' . $href . '" title="' . $title . '" style="text-decoration:none; border:0;">' . $imgTag . '</a>';
    $cap = '<a href="' . $href . '" title="' . $title . '" style="' . $color . 'text-decoration:underline;">' . $capText . '</a>';
    $capStyle = 'padding:3px 0 0; font-family:' . $font . 'Arial, sans-serif; font-size:12px; line-height:16px; font-weight:normal; text-align:left;';
    if ($inCell) return $pic . '<div style="' . $capStyle . '">' . $cap . '</div>';
    return '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:4px 0;"><tr><td style="padding:0;">' . $pic . '</td></tr>'
         . '<tr><td style="' . $capStyle . '">' . $cap . '</td></tr></table>';
}
}

if (!function_exists('penumbra_vis_fluid_layout')) {
function penumbra_vis_fluid_layout() {
    return isset($GLOBALS['penumbra_snippet_layout']) && $GLOBALS['penumbra_snippet_layout'] === 'dashboard';
}
}

if (!function_exists('penumbra_vis_png_width')) {
function penumbra_vis_png_width($png) {
    if (!is_string($png) || strlen($png) < 24 || substr($png, 0, 8) !== "\x89PNG\r\n\x1a\n") return 0;
    $d = unpack('Nw', substr($png, 16, 4));
    return (int)$d['w'];
}
}

if (!function_exists('penumbra_vis_fluid_img_tag')) {
function penumbra_vis_fluid_img_tag($img, $linked) {
    $p = (float)$img['wpct'];
    $w = max(1, (int)$img['width']);
    $aw = max(1, (int)round($p / 100 * (int)PENUMBRA_VIS_BASE_WIDTH));
    $ah = max(1, (int)round((int)$img['height'] * $aw / $w));
    $nat = penumbra_vis_png_width(isset($img['png']) ? $img['png'] : '');
    if ($nat < 1) $nat = 2 * $w;
    return '<img src="cid:' . htmlspecialchars($img['cid'], ENT_QUOTES) . '" width="' . $aw . '" height="' . $ah . '"'
         . ($linked ? ' border="0"' : '')
         . ' alt="' . htmlspecialchars($img['alt'], ENT_QUOTES) . '"'
         . ' style="display:block; margin:0; width:100%; max-width:' . $nat . 'px; height:auto; border:0;">';
}
}

if (!function_exists('penumbra_vis_fluid_rows_html')) {
function penumbra_vis_fluid_rows_html($imgs) {
    $gap = (int)PENUMBRA_VIS_ROW_GAP;
    $rows = array(); $cur = array(); $sum = 0.0;
    foreach ($imgs as $img) {
        $p = (float)$img['wpct'];
        if ($cur && $sum + $p > 100.0001) { $rows[] = $cur; $cur = array(); $sum = 0.0; }
        $cur[] = $img; $sum += $p;
    }
    if ($cur) $rows[] = $cur;
    $html = '';
    foreach ($rows as $row) {
        $html .= '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin:4px 0;"><tr>';
        $total = 0.0;
        foreach ($row as $k => $img) {
            if ($k > 0) $html .= '<td width="' . $gap . '" style="width:' . $gap . 'px; padding:0; font-size:0; line-height:0;">&nbsp;</td>';
            $p = (float)$img['wpct'];
            $total += $p;
            $linked = !empty($img['href']);
            $tag = penumbra_vis_fluid_img_tag($img, $linked);
            $html .= '<td valign="top" width="' . rtrim(rtrim(sprintf('%.2f', $p), '0'), '.') . '%" style="padding:0;">' . ($linked ? penumbra_vis_linked_chart($img, $tag, true) : $tag) . '</td>';
        }
        if ($total < 99.99) $html .= '<td style="padding:0;">&nbsp;</td>';
        $html .= '</tr></table>';
    }
    return $html;
}
}

if (!function_exists('penumbra_vis_row_html')) {
function penumbra_vis_row_html($imgs) {
    $groups = array(); $cur = array(); $kind = null;
    foreach ($imgs as $img) {
        $f = !empty($img['fluid']) && !empty($img['wpct']);
        if ($kind !== null && $f !== $kind) { $groups[] = array($kind, $cur); $cur = array(); }
        $kind = $f; $cur[] = $img;
    }
    if ($cur) $groups[] = array($kind, $cur);
    $html = '';
    foreach ($groups as $g) { $html .= $g[0] ? penumbra_vis_fluid_rows_html($g[1]) : penumbra_vis_fixed_rows_html($g[1]); }
    return $html;
}
}

if (!function_exists('penumbra_vis_fixed_rows_html')) {
function penumbra_vis_fixed_rows_html($imgs) {
    $budget = (int)PENUMBRA_VIS_BASE_WIDTH;
    $gap = (int)PENUMBRA_VIS_ROW_GAP;
    $rows = array(); $cur = array(); $w = 0;
    foreach ($imgs as $img) {
        $iw = (int)$img['width'];
        $need = $cur ? ($w + $gap + $iw) : $iw;
        if ($cur && $need > $budget) { $rows[] = $cur; $cur = array(); $need = $iw; }
        $cur[] = $img; $w = $need;
    }
    if ($cur) $rows[] = $cur;
    $html = '';
    foreach ($rows as $row) {
        if (count($rows) === 1 && count($row) === 1) { $html .= penumbra_vis_img_tag($row[0]); continue; }
        $html .= '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:4px 0;"><tr>';
        $last = count($row) - 1;
        foreach ($row as $k => $img) {
            $html .= '<td valign="top" width="' . (int)$img['width'] . '" style="' . ($k < $last ? 'padding:0 ' . $gap . 'px 0 0;' : 'padding:0;') . '">' . penumbra_vis_img_tag($img, true) . '</td>';
        }
        $html .= '</tr></table>';
    }
    return $html;
}
}

if (!function_exists('penumbra_vis_apply_tokens')) {
function penumbra_vis_apply_tokens($text) {
    if (empty($GLOBALS['penumbra_vis_images']) || strpos($text, '__PENUMBRA_VISIMG_') === false) return $text;
    $store = $GLOBALS['penumbra_vis_images'];
    $isTok = function ($s) use ($store) { return preg_match('/^__PENUMBRA_VISIMG_[A-Z]+__$/', $s) === 1 && array_key_exists($s, $store); };
    $parts = preg_split('/(__PENUMBRA_VISIMG_[A-Z]+__)/', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
    $out = '';
    $n = count($parts);
    $i = 0;
    while ($i < $n) {
        $p = $parts[$i];
        if (!$isTok($p)) { $out .= $p; $i++; continue; }
        $run = array($p);
        $j = $i + 1;
        while ($j + 1 < $n && preg_match('/^\s*$/', $parts[$j]) && $isTok($parts[$j + 1])) { $run[] = $parts[$j + 1]; $j += 2; }
        $imgs = array();
        foreach ($run as $tok) { if (is_array($store[$tok])) $imgs[] = $store[$tok]; }
        if (count($imgs) >= 2) $out .= penumbra_vis_row_html($imgs);
        elseif (count($imgs) === 1) $out .= (!empty($imgs[0]['fluid']) && !empty($imgs[0]['wpct'])) ? penumbra_vis_row_html($imgs) : penumbra_vis_img_tag($imgs[0]);
        $i = $j;
    }
    return $out;
}
}

if (!function_exists('penumbra_vis_take_images')) {
function penumbra_vis_take_images() {
    $out = array();
    foreach ($GLOBALS['penumbra_vis_images'] as $img) { if (is_array($img)) $out[] = $img; }
    $GLOBALS['penumbra_vis_images'] = array();
    return $out;
}
}

if (!function_exists('penumbra_vis_inline_parts')) {
function penumbra_vis_inline_parts($images) {
    $parts = array();
    $n = 1;
    foreach ((array)$images as $img) {
        if (!is_array($img) || empty($img['png']) || empty($img['cid'])) continue;
        $cid = str_replace(array('"', "\r", "\n", '<', '>'), '', (string)$img['cid']);
        $name = 'chart' . $n++ . '.png';
        $part  = "Content-Type: image/png;\r\n name=\"{$name}\"\r\n";
        $part .= "Content-ID: <{$cid}>\r\n";
        $part .= "Content-Disposition: inline;\r\n filename=\"{$name}\"\r\n";
        $part .= "Content-Transfer-Encoding: base64\r\n";
        $part .= "\r\n";
        $part .= chunk_split(base64_encode($img['png']), 76, "\r\n");
        $parts[$cid] = $part;
    }
    return $parts;
}
}

if (!function_exists('penumbra_vis_html_part')) {
function penumbra_vis_html_part($html, $inlineParts = array()) {
    $htmlPart = "Content-Type: text/html; charset=UTF-8\r\n"
              . "Content-Transfer-Encoding: quoted-printable\r\n"
              . "\r\n"
              . quoted_printable_encode($html) . "\r\n";
    $used = array();
    foreach ((array)$inlineParts as $cid => $part) {
        if (strpos($html, 'cid:' . $cid) !== false) $used[$cid] = $part;
    }
    if (!$used) return $htmlPart;
    $rel = '----=_Rel_' . md5(uniqid(mt_rand(), true));
    $out  = "Content-Type: multipart/related;\r\n boundary=\"{$rel}\"; type=\"text/html\"\r\n";
    $out .= "\r\n";
    $out .= "--{$rel}\r\n" . $htmlPart;
    foreach ($used as $part) { $out .= "--{$rel}\r\n" . $part; }
    $out .= "--{$rel}--\r\n";
    return $out;
}
}

if (!function_exists('penumbra_vis_pdf_charts')) {
function penumbra_vis_pdf_charts($images) {
    $gd = function_exists('imagecreatefrompng');
    $out = array();
    foreach ((array)$images as $img) {
        if (!is_array($img) || empty($img['png'])) continue;
        // The default-theme copies drawn for the PDF, when the run made them.
        $png  = !empty($img['pdfpng']) ? $img['pdfpng'] : $img['png'];
        $jpeg = !empty($img['pdfpng']) ? (isset($img['pdfjpeg']) ? $img['pdfjpeg'] : null) : (isset($img['jpeg']) ? $img['jpeg'] : null);
        $usePng = $gd || empty($jpeg);
        $out[] = array(
            'data'   => $usePng ? $png : $jpeg,
            'type'   => $usePng ? 'PNG' : 'JPEG',
            'width'  => (int)$img['width'],
            'height' => (int)$img['height'],
            'title'  => (string)$img['alt']
        );
    }
    return $out;
}
}
