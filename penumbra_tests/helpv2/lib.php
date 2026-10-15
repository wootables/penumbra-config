<?php
/**
 * lib.php - shared helpers for the helpv2 suite (lint, equivalence, coverage, runner).
 */

/** Read a file or die with a clear message. */
function hv_read($path) {
    $s = @file_get_contents($path);
    if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
    return $s;
}

/** First existing path among <app>/<rel> and <live>/<rel>, or null. */
function hv_locate($rel, $app, $live) {
    foreach (array($app, $live) as $root) {
        if ($root !== '' && is_file($root . '/' . $rel)) return $root . '/' . $rel;
    }
    return null;
}

/** Strip PHP blocks, HTML comments, scripts and styles so attribute scans see only live HTML. */
function hv_html_only($s) {
    $s = preg_replace('/<\?php.*?\?>/s', ' ', $s);
    $s = preg_replace('/<!--.*?-->/s', ' ', $s);
    $s = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', ' ', $s);
    return $s;
}

/**
 * Cut a rendered (or raw) help document into its blocks: every `.help-topic`
 * div and every `*-tips-storage` div, consumed by div depth. Returns
 * array(id => array('lines' => [...], 'first' => n)), in document order.
 */
function hv_blocks($html) {
    $lines = preg_split('/\r\n|\n|\r/', $html);
    $n = count($lines);
    $blocks = array();
    $re = '/<div id="([A-Za-z0-9_-]+)" (?:class="help-topic"|hidden)/';
    for ($i = 0; $i < $n; $i++) {
        if (!preg_match($re, $lines[$i], $m)) continue;
        $id = $m[1];
        if (substr($id, -13) !== '-tips-storage' && strpos($lines[$i], 'class="help-topic"') === false) continue;
        $depth = 0; $j = $i; $body = array();
        do {
            $l = $lines[$j];
            $depth += preg_match_all('/<div\b/i', $l) - preg_match_all('/<\/div>/i', $l);
            $body[] = $l;
            $j++;
        } while ($depth > 0 && $j < $n);
        $blocks[$id] = array('lines' => $body, 'first' => $i + 1, 'closed' => ($depth === 0));
        $i = $j - 1;
    }
    return $blocks;
}

/**
 * Normalise a block for comparison: drop the v2-only attributes, surrounding whitespace
 * and blank lines. Leading whitespace goes too: a PHP closing tag swallows the newline
 * after it, so a gate line's indentation lands in front of the next line's markup.
 */
function hv_normalise_lines($lines) {
    $out = array();
    foreach ($lines as $l) {
        $l = preg_replace('/ data-audience="[a-z]+"/', '', $l);
        $l = preg_replace('/ data-aliases="[^"]*"/', '', $l);
        // The scheduler topics print live date() examples (SYSDATE rows, {SEND_TIME});
        // two renders a minute apart must still compare equal.
        $l = preg_replace('/\b\d{1,2}:\d{2} [AP]M\b/', 'H:MM', $l);
        $l = preg_replace('/\b\d{2}-[A-Z]{3}-\d{2}\b/', 'DD-MON-YY', $l);
        $l = preg_replace('/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/', 'Month D, YYYY', $l);
        $l = trim($l);
        if ($l === '') continue;
        $out[] = $l;
    }
    return $out;
}

/**
 * Every hover-tip KEY the UI consumes: data-tip="key" in index.php and any js/*.js
 * module (static markup or jQuery attr('data-tip', 'key')). Sentences used as literal
 * tooltip text (the pivot aggregate headers) are not keys and are skipped.
 * Returns key => source file. Files are read from --app first, then --live.
 */
function hv_tip_consumers($app, $live) {
    $cons = array();
    $re = '/data-tip=\\\\?["\']([a-z0-9][a-z0-9_-]*)\\\\?["\']|attr\(\s*["\']data-tip["\']\s*,\s*["\']([a-z0-9][a-z0-9_-]*)["\']\s*\)/';
    $files = array();
    $idx = hv_locate('index.php', $app, $live); if ($idx) $files['index.php'] = $idx;
    $seen = array();
    foreach (array($app, $live) as $root) {
        if ($root === '' || !is_dir($root . '/js')) continue;
        foreach (glob($root . '/js/*.js') as $f) { $b = basename($f); if (isset($seen[$b])) continue; $seen[$b] = 1; $files['js/' . $b] = $f; }
    }
    foreach ($files as $rel => $path) {
        $s = @file_get_contents($path); if ($s === false) continue;
        if ($rel === 'index.php') $s = hv_html_only($s);
        if (preg_match_all($re, $s, $m, PREG_SET_ORDER)) foreach ($m as $hit) { $k = $hit[1] !== '' ? $hit[1] : (isset($hit[2]) ? $hit[2] : ''); if ($k !== '' && !isset($cons[$k])) $cons[$k] = $rel; }
    }
    return $cons;
}

/** Count words in a text fragment (tags stripped). */
function hv_words($html) {
    $t = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    return preg_match_all('/\S+/u', $t);
}

/** Run php -l on a file; returns '' when clean, else the message. */
function hv_php_lint($php, $file) {
    $cmd = escapeshellarg($php) . ' -n -l ' . escapeshellarg($file) . ' 2>&1';
    $out = (string)shell_exec($cmd);
    return (strpos($out, 'No syntax errors') !== false) ? '' : trim($out);
}

/** Render through render.php in a child process. */
function hv_render($php, $app, $what, $flags) {
    $cmd = escapeshellarg($php) . ' -n ' . escapeshellarg(__DIR__ . '/render.php')
         . ' --app=' . escapeshellarg($app) . ' --what=' . $what . ' ' . $flags . ' 2>&1';
    return (string)shell_exec($cmd);
}

/** Tiny assertion collector. */
class HvReport {
    public $results = array();
    public function check($id, $ok, $detail = '') {
        $this->results[] = array('id' => $id, 'ok' => (bool)$ok, 'detail' => $detail);
        printf("  %-5s %-8s %s\n", $ok ? 'PASS' : 'FAIL', $id, $detail);
    }
    public function warn($id, $detail) {
        $this->results[] = array('id' => $id, 'ok' => true, 'warn' => true, 'detail' => $detail);
        printf("  %-5s %-8s %s\n", 'WARN', $id, $detail);
    }
    public function failed() {
        $f = array();
        foreach ($this->results as $r) if (!$r['ok']) $f[] = $r['id'];
        return $f;
    }
}
