<?php
/**
 * split_help.php - one-time splitter: help_content.php (v1, one 1.6 MB file)
 * -> help/topics/<id>.php + help/tips/<id>.php fragments (v2).
 *
 *   php split_help.php --src <help_content.php> --out <stage dir> [--verify]
 *
 * Binary-safe and CRLF-preserving: lines are split keeping their own line
 * ending, and every byte of a block is copied as-is. The only edits:
 *   - topic-level `<?php if ($isAdmin): ?>` / `<?php if (true): ... ?>` ... `<?php endif; ?>`
 *     wrappers are DROPPED (the manifest's `audience` + pnb_help_show() replace them);
 *   - wrappers INSIDE a topic become `<?php if (pnb_help_show('<audience>')): ?>`;
 *   - the opening `.help-topic` div gains data-audience="<audience>".
 * --verify rebuilds the source from header + prefaces + untouched blocks and
 * compares it to the source with the top-level wrapper lines removed: a byte
 * mismatch means the parser lost or duplicated something.
 *
 * Writes split_report.json (one row per block) and manifest_topics.txt (the
 * generated topic arrays for help/manifest.php) next to the fragments.
 */

$opts = getopt('', array('src:', 'out:', 'report-dir:', 'verify'));
if (empty($opts['src']) || empty($opts['out'])) { fwrite(STDERR, "usage: --src <help_content.php> --out <stage dir> [--report-dir <dir>] [--verify]\n"); exit(2); }
$srcPath = $opts['src'];
$outDir  = rtrim($opts['out'], '/\\');
$verify  = isset($opts['verify']);
// split_report.json + manifest_topics.txt are build artefacts: keep them OUT of the deployable help/ tree.
$reportDir = isset($opts['report-dir']) ? rtrim($opts['report-dir'], '/\\') : $outDir . '/help';
if (!is_dir($reportDir)) mkdir($reportDir, 0777, true);

// Audience per block. Derived from the v1 gating (see the plan note) with three
// deliberate overrides: dashboards is a VIEWER feature that v1 had trapped
// inside a writer-only wrapper, journal is viewer-facing, repository is admin.
$AUDIENCE = array(
    'whatIsPenumbraLightbox'           => 'viewer',
    'searchHelpLightbox'               => 'viewer',
    'sqlHelpLightbox'                  => 'writer',
    'optionsHelpLightbox'              => 'writer',
    'auditorHelpLightbox'              => 'writer',
    'viewoptionsHelpLightbox'          => 'writer',
    'schedulerHelpLightbox'            => 'writer',
    'schedOnCompletionHelpLightbox'    => 'writer',
    'journalHelpLightbox'              => 'viewer',
    'schedulerPromptHelpLightbox'      => 'writer',
    'customConditionHelpLightbox'      => 'writer',
    'accessListHelpLightbox'           => 'writer',
    'saveIdHelpLightbox'               => 'writer',
    'dashboardsHelpLightbox'           => 'viewer',
    'repositoryHelpLightbox'           => 'admin',
    'versionHistoryHelpLightbox'       => 'writer',
    'savePrefsHelpLightbox'            => 'writer',
    'saveSecurityHelpLightbox'         => 'writer',
    'searchFilterHelpLightbox'         => 'writer',
    'userSettingsHelpLightbox'         => 'viewer',
    'groupingHelpLightbox'             => 'viewer',
    'columnSummariesHelpLightbox'      => 'viewer',
    'pivotBuilderHelpLightbox'         => 'viewer',
    'visualizationBuilderHelpLightbox' => 'viewer',
    'snapshotsHelpLightbox'            => 'viewer',
    'emailHelpLightbox'                => 'viewer',
    'downloadHelpLightbox'             => 'viewer',
    'copyHelpLightbox'                 => 'viewer',
    'powerFeaturesHelpLightbox'        => 'viewer',
);
// Inner wrappers (inside a topic body) and the audience they become.
// `$isAdmin` inner blocks describe scheduler / snippet authoring = writer;
// `if (true)` inner blocks were "report writers" by their own comments.
$INNER_ADMIN_AUDIENCE = 'writer';
$INNER_TRUE_AUDIENCE  = 'writer';

// Post rules: per-topic edits applied to the body lines after the wrapper conversion.
// The Data Visualization topic's "For Administrators" section (and its jump link) was the
// one such section v1 never gated, unlike the pivot and snapshot ones; gate it the same way.
$POST_RULES = array(
    'visualizationBuilderHelpLightbox' => function (array $body) {
        $gateOpen = "<?php if (pnb_help_show('writer')): ?>";
        $gateClose = "<?php endif; ?>";
        // (a) the jump-link row: the separator before the link sits at the END of the previous line
        $iLink = null; foreach ($body as $k => $l) if (strpos($l, 'data-jump-to="vbh-admin"') !== false) { $iLink = $k; break; }
        if ($iLink === null) throw new Exception('viz: vbh-admin jump link not found');
        $sep = '<span style="opacity: 0.25; margin: 0 4px;">|</span>';
        $prev = $body[$iLink - 1];
        if (!preg_match('/<\/a>' . preg_quote($sep, '/') . '\s*$/', $prev)) throw new Exception('viz: separator before the vbh-admin link not where expected');
        $body[$iLink - 1] = preg_replace('/<\/a>' . preg_quote($sep, '/') . '(\s*)$/', '</a>' . $gateOpen . $sep . '$1', $prev, 1);
        $eol = (substr($body[$iLink], -2) === "\r\n") ? "\r\n" : "\n";
        $indent = preg_match('/^(\s*)/', $body[$iLink], $im) ? $im[1] : '';
        array_splice($body, $iLink + 1, 0, array($indent . $gateClose . $eol));
        // (b) the section: from the <hr> above the FOR ADMINISTRATORS banner to the last paragraph before the closing divs
        $iBanner = null; foreach ($body as $k => $l) if (strpos($l, '<!-- FOR ADMINISTRATORS') !== false) { $iBanner = $k; break; }
        if ($iBanner === null) throw new Exception('viz: FOR ADMINISTRATORS banner not found');
        $iHr = $iBanner - 1; while ($iHr > 0 && strpos($body[$iHr], '<hr') === false) $iHr--;
        if (strpos($body[$iHr], '<hr') === false || $iBanner - $iHr > 4) throw new Exception('viz: hr above the admin banner not found');
        $indentHr = preg_match('/^(\s*)/', $body[$iHr], $im) ? $im[1] : '';
        $eolHr = (substr($body[$iHr], -2) === "\r\n") ? "\r\n" : "\n";
        $iEnd = count($body) - 1; $closers = 0;
        while ($iEnd > 0 && $closers < 2) { if (strpos($body[$iEnd], '</div>') !== false) $closers++; $iEnd--; }
        while ($iEnd > 0 && trim($body[$iEnd]) === '') $iEnd--;
        if (strpos($body[$iEnd], '</p>') === false) throw new Exception('viz: admin section does not end with a paragraph: ' . trim($body[$iEnd]));
        $between = implode('', array_slice($body, $iHr, $iEnd - $iHr + 1));
        if (strpos($between, 'Report cloning') === false || strpos($between, 'id="vbh-admin"') === false) throw new Exception('viz: admin section span unexpected');
        array_splice($body, $iEnd + 1, 0, array($indentHr . $gateClose . $eolHr));
        array_splice($body, $iHr, 0, array($indentHr . $gateOpen . $eolHr));
        return $body;
    },
);

$raw = file_get_contents($srcPath);
if ($raw === false) { fwrite(STDERR, "cannot read $srcPath\n"); exit(2); }
$lines = preg_split('/(?<=\n)/', $raw);           // each line keeps its own ending
$n = count($lines);
$crIn = substr_count($raw, "\r");

// --- 1. file header: the opening PHP block, open and close tags each on their own line ---
$headerEnd = -1;
for ($i = 0; $i < min(40, $n); $i++) {
    if (preg_match('/^\?>\s*$/', $lines[$i])) { $headerEnd = $i; break; }
}
if ($headerEnd < 0 || !preg_match('/^<\?php\s*$/', $lines[0])) { fwrite(STDERR, "header not found\n"); exit(2); }
$header = array_slice($lines, 0, $headerEnd + 1);

// --- 2. walk the body ---
$reTopicOpen = '/^(\s*)<div id="([A-Za-z0-9_-]+)" class="help-topic">/';
$reTipsOpen  = '/^(\s*)<div id="([a-z]+-tips-storage)" hidden>/';
$reWrapOpen  = '/^\s*<\?php if \((\$isAdmin|true)\):\s*(\/\*.*?\*\/)?\s*\?>\s*$/s';
$reWrapClose = '/^\s*<\?php endif; \?>\s*$/';

$blocks = array();            // ordered
$preface = array();           // gap lines waiting for the next block
$wrapperOpen = null;          // array(cond, comment, line) while a top-level wrapper is open
$removedWrapperLines = array(); // line indexes dropped (for --verify)
$i = $headerEnd + 1;
while ($i < $n) {
    $line = $lines[$i];
    if (preg_match($reTopicOpen, $line, $m) || preg_match($reTipsOpen, $line, $m)) {
        $id = $m[2];
        $isTips = (substr($id, -13) === '-tips-storage');
        // consume the block by div depth
        $depth = 0; $j = $i; $body = array();
        do {
            $l = $lines[$j];
            $depth += preg_match_all('/<div\b/i', $l) - preg_match_all('/<\/div>/i', $l);
            $body[] = $l;
            $j++;
        } while ($depth > 0 && $j < $n);
        if ($depth !== 0) { fwrite(STDERR, "block $id did not close (depth $depth)\n"); exit(2); }
        $blocks[] = array(
            'id' => $id, 'tips' => $isTips, 'first' => $i + 1, 'last' => $j,
            'preface' => $preface, 'body' => $body,
            'wrapper' => $wrapperOpen,
        );
        $preface = array();
        $i = $j;
        continue;
    }
    if (preg_match($reWrapOpen, $line, $m)) {
        if ($wrapperOpen) { fwrite(STDERR, "nested top-level wrapper at line " . ($i + 1) . "\n"); exit(2); }
        $wrapperOpen = array('cond' => $m[1], 'comment' => isset($m[2]) ? trim($m[2]) : '', 'line' => $i + 1);
        $removedWrapperLines[] = $i;
        $i++; continue;
    }
    if (preg_match($reWrapClose, $line)) {
        if (!$wrapperOpen) { fwrite(STDERR, "endif without wrapper at line " . ($i + 1) . "\n"); exit(2); }
        $wrapperOpen = null;
        $removedWrapperLines[] = $i;
        $i++; continue;
    }
    // gap line: blank or comment; anything else is unexpected at top level
    if (!preg_match('/^\s*$/', $line) && !preg_match('/^\s*<!--/', $line) && !preg_match('/-->\s*$/', $line) && !preg_match('/^\s*[^<]*$/', $line)) {
        fwrite(STDERR, "unexpected top-level line " . ($i + 1) . ": " . substr(trim($line), 0, 80) . "\n"); exit(2);
    }
    $preface[] = $line;
    $i++;
}
if ($wrapperOpen) { fwrite(STDERR, "wrapper opened at line {$wrapperOpen['line']} never closed\n"); exit(2); }
$tail = $preface; // whatever trails the last block (kept out of the fragments; reported)

// --- 3. --verify: header + prefaces + bodies == source minus the dropped wrapper lines ---
if ($verify) {
    $rebuilt = implode('', $header);
    foreach ($blocks as $b) { $rebuilt .= implode('', $b['preface']) . implode('', $b['body']); }
    $rebuilt .= implode('', $tail);
    $expect = '';
    $drop = array_flip($removedWrapperLines);
    foreach ($lines as $k => $l) { if (!isset($drop[$k])) $expect .= $l; }
    if ($rebuilt !== $expect) {
        // locate first difference
        $len = min(strlen($rebuilt), strlen($expect));
        for ($p = 0; $p < $len && $rebuilt[$p] === $expect[$p]; $p++) {}
        fwrite(STDERR, "VERIFY FAILED at byte $p: rebuilt=" . json_encode(substr($rebuilt, $p, 60)) . " expect=" . json_encode(substr($expect, $p, 60)) . "\n");
        exit(1);
    }
    echo "verify: rebuilt == source minus " . count($removedWrapperLines) . " wrapper lines (" . strlen($expect) . " bytes)\n";
}

// --- 4. write fragments ---
$report = array();
$eol = "\r\n";
$convertedTotal = 0;
foreach ($blocks as $b) {
    $id = $b['id'];
    $aud = $b['tips'] ? 'viewer' : (isset($AUDIENCE[$id]) ? $AUDIENCE[$id] : null);
    if ($aud === null) { fwrite(STDERR, "no audience for topic $id - add it to \$AUDIENCE\n"); exit(2); }
    // wrapper-derived expectation, for the report
    $derived = 'viewer';
    if ($b['wrapper']) { $derived = ($b['wrapper']['cond'] === '$isAdmin') ? 'writer-or-admin' : 'writer(if true)'; }

    $body = $b['body'];
    $converted = 0;
    foreach ($body as $k => $l) {
        $new = $l;
        if (strpos($new, '<?php if ($isAdmin): ?>') !== false) {
            $new = str_replace('<?php if ($isAdmin): ?>', "<?php if (pnb_help_show('$INNER_ADMIN_AUDIENCE')): ?>", $new); $converted++;
        }
        if (preg_match('/<\?php if \(true\):/', $new)) {
            $new = preg_replace('/<\?php if \(true\):/', "<?php if (pnb_help_show('$INNER_TRUE_AUDIENCE')):", $new, 1); $converted++;
        }
        if (strpos($new, '$isAdmin') !== false) { fwrite(STDERR, "unconverted \$isAdmin in $id line " . ($b['first'] + $k) . "\n"); exit(2); }
        $body[$k] = $new;
    }
    $convertedTotal += $converted;
    $postRule = 0;
    if (isset($POST_RULES[$id])) {
        try { $body = $POST_RULES[$id]($body); $postRule = 1; }
        catch (Exception $e) { fwrite(STDERR, 'post rule failed: ' . $e->getMessage() . "\n"); exit(2); }
    }
    if (!$b['tips']) {
        // stamp the audience on the opening tag (first line of the body)
        $body[0] = preg_replace('/(<div id="' . preg_quote($id, '/') . '" class="help-topic")>/', '$1 data-audience="' . $aud . '">', $body[0], 1, $cnt);
        if ($cnt !== 1) { fwrite(STDERR, "could not stamp audience on $id\n"); exit(2); }
    }

    $rel = ($b['tips'] ? 'help/tips/' : 'help/topics/') . $id . '.php';
    $path = $outDir . '/' . $rel;
    // (the condition is written without its $ so a lint for leftover $isAdmin reads never trips on this comment)
    $wrapNote = $b['wrapper'] ? (' v1 wrapper: if (' . ltrim($b['wrapper']['cond'], '$') . ')' . ($b['wrapper']['comment'] !== '' ? ' ' . str_replace('$', '', $b['wrapper']['comment']) : '')) : ' v1: ungated';
    $wrapNote = str_replace(array("\r", "\n"), ' ', $wrapNote);
    $head = '<?php' . $eol
          . '// ' . $rel . ' - Help Center ' . ($b['tips'] ? 'hover-tip store' : 'topic') . ' (v2). Audience: ' . $aud . '.' . $eol
          . '// Split from help_content.php lines ' . $b['first'] . '-' . $b['last'] . ' on 2026-10-14;' . $wrapNote . '.' . $eol
          . '// Served only through help/loader.php (the Help Center fetches help_content.php).' . $eol
          . "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }" . $eol
          . '?>' . $eol;
    $content = $head . implode('', $b['preface']) . implode('', $body);
    if (file_put_contents($path, $content) === false) { fwrite(STDERR, "cannot write $path\n"); exit(2); }
    $txt = preg_replace('/<[^>]+>/', ' ', implode('', $body));
    $report[] = array(
        'id' => $id, 'file' => $rel, 'tips' => $b['tips'], 'audience' => $aud, 'v1_gating' => $derived,
        'src_lines' => $b['first'] . '-' . $b['last'], 'bytes' => strlen($content), 'words' => str_word_count($txt),
        'inner_wrappers_converted' => $converted, 'post_rule' => $postRule, 'preface_lines' => count($b['preface']),
    );
}
file_put_contents($reportDir . '/split_report.json', json_encode(array(
    'source' => basename($srcPath), 'source_bytes' => strlen($raw), 'source_cr' => $crIn, 'source_lines' => $n,
    'blocks' => count($blocks), 'wrapper_lines_dropped' => count($removedWrapperLines), 'inner_wrappers_converted' => $convertedTotal,
    'tail_lines' => count($tail), 'rows' => $report,
), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

// --- 5. manifest topic arrays (generated from the v1 manifest + the audience map) ---
$manifestSrc = dirname($srcPath) . '/help_manifest.php';
$gen = '';
if (file_exists($manifestSrc)) {
    require_once $manifestSrc;
    if (function_exists('penumbra_help_manifest')) {
        foreach (penumbra_help_manifest() as $g) {
            $gen .= "            array(\n                'label'  => " . var_export($g['label'], true) . ",\n                'topics' => array(\n";
            foreach ($g['topics'] as $t) {
                $id = $t['id'];
                $aud = isset($AUDIENCE[$id]) ? $AUDIENCE[$id] : 'viewer';
                $gen .= "                    array('id' => " . var_export($id, true) . ", 'title' => " . var_export($t['title'], true) . ",\n";
                $gen .= "                        'audience' => " . var_export($aud, true) . ", 'aliases' => array(),\n";
                if (!empty($t['new']))   $gen .= "                        'new' => true,\n";
                if (!empty($t['extra'])) $gen .= "                        'extra' => " . str_replace("\n", '', var_export($t['extra'], true)) . ",\n";
                $gen .= "                        'keywords' => " . var_export(isset($t['keywords']) ? $t['keywords'] : '', true) . "),\n";
            }
            $gen .= "                ),\n            ),\n";
        }
    }
}
file_put_contents($reportDir . '/manifest_topics.txt', $gen);

printf("blocks: %d (topics %d, tip stores %d); wrapper lines dropped: %d; inner wrappers converted: %d; tail lines: %d\n",
    count($blocks), count(array_filter($blocks, function ($b) { return !$b['tips']; })), count(array_filter($blocks, function ($b) { return $b['tips']; })),
    count($removedWrapperLines), $convertedTotal, count($tail));
foreach ($report as $r) printf("  %-34s %-6s %-16s %-11s %7d bytes %6d words  inner=%d\n", $r['id'], $r['audience'], $r['v1_gating'], $r['src_lines'], $r['bytes'], $r['words'], $r['inner_wrappers_converted']);
