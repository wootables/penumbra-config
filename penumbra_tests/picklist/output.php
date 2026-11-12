<?php
// =============================================================================
// PICK LISTS SUITE "picklist" - SERVER OUTPUT HALF (2026-11-11, PICKLIST_SPEC.md)
//
// A pick list in the ?json=1 API, scheduled emails and task filters: journal_export.php's resolver reads each
// row's option (PENUMBRA_JOURNAL_TOGGLE, STATE = 2, FIELD_VALUE) and names a column of TEXT for each list (its
// option's label, NAME_2 beside a data column), with its who / when columns. They ride in the resolver's
// whoMeta / whoNames (kind 'field'), never a toggle column. A saved sort, grouping, summary, highlight rule or
// layout naming the column by its page name (__JOURNAL_FIELD__<key>) names the output's; a renamed list's old
// names and an option's old labels (= / != only, a current label wins) still find it; the list's order is the
// sort and group order; a report whose only journal column is a pick list gets all of this too.
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring output.php
//        [--app DIR]        the build under test: journal_export.php, penumbra_search.php, schedule_runner.php
//                           (default: the live webroot; a file DIR lacks is read from the live webroot)
//        [--mutant NAME]    a single-point revert of that build: exactly its asserts must go red
//        [--mutants]        every mutant
//        [--control]        DIR is the build BEFORE the change: exactly CONTROL_RED fails
//
// R-* the resolver   X-* snapshot / strip / columns   S-* sort / group / list order   F-* task filters
// H-* schedule_runner.php (summaries, highlight rules, the page's order, saved layout, snippets, wiring)
// =============================================================================
error_reporting(E_ALL);

if (getenv('PNB_PLO_CHILD')) { plo_child(getenv('PNB_PLO_CHILD')); exit(0); }

$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$args = $argv; array_shift($args);
$opt = function ($n, $d = null) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return $d; $v = $args[$i + 1]; array_splice($args, $i, 2); return $v; };
$flag = function ($n) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return false; array_splice($args, $i, 1); return true; };
$app = $opt('--app', $APP);
$oneMutant = $opt('--mutant');
$allMutants = $flag('--mutants');
$control = $flag('--control');
if ($args) { fwrite(STDERR, 'unknown arguments: ' . implode(' ', $args) . "\n"); exit(2); }

// --- mutants: [file, old (the change's text), new (as before / broken), must-red] ---------------------------------
$MUTANTS = array(
    'alone-gate'  => array('journal_export.php', 'if ((empty($toggles) && !$notesRead && !$fieldDefs) || empty($keyCols)) return null;', 'if ((empty($toggles) && !$notesRead) || empty($keyCols)) return null;',
                           array('R-alone', 'S-sort-alone', 'S-group-alone', 'F-alone', 'H-sum-alone', 'H-snipcols', 'H-sniptree')),
    'alone-ret'   => array('journal_export.php', 'if (empty($colMeta) && empty($whoMeta) && $notesSearch === null) return null;', 'if (empty($colMeta) && $notesSearch === null) return null;',
                           array('R-alone', 'S-sort-alone', 'S-group-alone', 'F-alone', 'H-sum-alone', 'H-snipcols', 'H-sniptree')),
    'label'       => array('journal_export.php', 'if ($fo[\'id\'] === $fv) { $flbl = $fo[\'label\']; break; }', 'if (false) { $flbl = $fo[\'label\']; break; }',
                           array('R-values', 'R-alone', 'X-columns', 'F-label', 'F-old', 'F-old-not', 'F-current-wins', 'F-oldname', 'F-retired', 'F-alone', 'F-grouped', 'F-other')),
    'unknown'     => array('journal_export.php', '$flbl = \'(unknown option)\';', '$flbl = $fv;',
                           array('R-values', 'R-alone', 'X-columns')),
    'parked'      => array('journal_export.php', "                if (defined('JOURNAL_PARK_OPEN') && strpos(\$rk, JOURNAL_PARK_OPEN) === 0) continue;   // filed under another key\n                \$flbl", "                \$flbl",
                           array('R-parked')),
    'readfail'    => array('journal_export.php', 'if (!is_array($fr)) $fieldDefs = array();', 'if (!is_array($fr)) $fr = array();',
                           array('R-readfail')),
    'who'         => array('journal_export.php', "            if (\$who) {\n                foreach (array('by' => ' BY', 'on' => ' ON') as \$fkind => \$fsfx) {", "            if (true) {\n                foreach (array('by' => ' BY', 'on' => ' ON') as \$fkind => \$fsfx) {",
                           array('R-nowho', 'R-alone')),
    'clean-tk'    => array('journal_export.php', '|| isset($fTk[$fk]) ||', '||',
                           array('R-clean')),
    'clean-4'     => array('journal_export.php', 'if (count($fieldDefs) >= 4) break;', '',
                           array('R-clean')),
    'alias'       => array('journal_export.php', 'foreach ($fd[\'oldLabels\'] as $fol) {', 'foreach (array() as $fol) {',
                           array('R-alias', 'S-sort', 'S-group', 'F-oldname', 'H-snipcols', 'H-sniptree')),
    'order'       => array('journal_export.php', "'order' => array_merge(\$fLive, \$fRet)", "'order' => array_merge(\$fRet, \$fLive)",
                           array('R-clean', 'S-orders', 'S-orders-sort')),
    'orders-own'  => array('journal_export.php', 'if (isset($have[$own])) { $out[$name] = $out[$have[$own]]; continue; }', '',
                           array('S-orders-own')),
    'sort-map'    => array('journal_export.php', "            foreach (\$resolver['whoMeta'] as \$wm) \$map[strtoupper((\$wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . \$wm['key'])] = (string)\$wm['name'];",
                           "            foreach (\$resolver['whoMeta'] as \$wm) \$map[strtoupper((\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . \$wm['key'])] = (string)\$wm['name'];",
                           array('S-sort', 'S-sort-alone')),
    'sort-gate'   => array('journal_export.php', 'if (!is_array($criteria) || !is_array($resolver) || (empty($resolver[\'colMeta\']) && empty($resolver[\'whoMeta\']))) return $criteria;', 'if (!is_array($criteria) || !is_array($resolver) || empty($resolver[\'colMeta\'])) return $criteria;',
                           array('S-sort-alone')),
    'group-map'   => array('journal_export.php', "\$byWho[strtoupper((\$wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . \$wm['key'])]", "\$byWho[strtoupper((\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . \$wm['key'])]",
                           array('S-group', 'S-group-alone')),
    'group-gate'  => array('journal_export.php', 'if (!is_array($resolver) || (empty($resolver[\'colMeta\']) && empty($resolver[\'whoMeta\'])) || !is_string($groupBy)) return $groupBy;', 'if (!is_array($resolver) || empty($resolver[\'colMeta\']) || !is_string($groupBy)) return $groupBy;',
                           array('S-group-alone')),
    'opt-call'    => array('penumbra_search.php', "    \$parsedQuery = _journal_field_option_conditions(\$parsedQuery, \$toggleResolver);\n", '',
                           array('F-old', 'F-old-not', 'F-oldname', 'F-alone', 'F-grouped')),
    'opt-cur'     => array('penumbra_search.php', "isset(\$fo['cur'][\$want]) || ", '',
                           array('F-current-wins')),
    'opt-ops'     => array('penumbra_search.php', "        if (!in_array(\$op, array('=', '==', '!=', '<>', \"\\xE2\\x89\\xA0\"), true)) continue;\n        \$bare", "        \$bare",
                           array('F-contains')),
    'filter-gate' => array('penumbra_search.php', "if (\$toggleResolver && (!empty(\$toggleResolver['colNames']) || !empty(\$toggleResolver['whoNames']))) {", "if (\$toggleResolver && !empty(\$toggleResolver['colNames'])) {",
                           array('F-alone')),
    'sum-gate'    => array('schedule_runner.php', "if (!is_array(\$resolver) || (empty(\$resolver['colMeta']) && empty(\$resolver['whoMeta'])) || !is_array(\$state)) return \$state;", "if (!is_array(\$resolver) || empty(\$resolver['colMeta']) || !is_array(\$state)) return \$state;",
                           array('H-sum-alone')),
    'sum-map'     => array('schedule_runner.php', "\$from = strtoupper((\$wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . \$wm['key']);", "\$from = strtoupper((\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . \$wm['key']);",
                           array('H-sum', 'H-sum-alone')),
    'hl-map'      => array('schedule_runner.php', "if (!empty(\$jt['whoMeta'])) foreach (\$jt['whoMeta'] as \$wm) \$map[strtoupper((\$wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . \$wm['key'])] = (string)\$wm['name'];", "if (!empty(\$jt['whoMeta'])) foreach (\$jt['whoMeta'] as \$wm) \$map[strtoupper((\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . \$wm['key'])] = (string)\$wm['name'];",
                           array('H-hl')),
    'screen'      => array('schedule_runner.php', "        if (\$fm['kind'] !== 'field') continue;", "        continue;",
                           array('H-order')),
    'places'      => array('schedule_runner.php', "\$page[(string)\$wm['name']] = (\$wm['kind'] === 'field' ? '__JOURNAL_FIELD__' : (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__')) . \$wm['key'];", "\$page[(string)\$wm['name']] = (\$wm['kind'] === 'by' ? '__JOURNAL_BY__' : '__JOURNAL_ON__') . \$wm['key'];",
                           array('H-places', 'H-places-hidden')),
    'snip-gate'   => array('schedule_runner.php', "if (!\$jt || (empty(\$jt['colNames']) && empty(\$jt['whoNames']))) return \$out;", "if (!\$jt || empty(\$jt['colNames'])) return \$out;",
                           array('H-snipcols')),
    'tree-gate'   => array('schedule_runner.php', "if (!is_array(\$tree) || !\$jt || (empty(\$jt['colNames']) && empty(\$jt['whoNames']))) return \$tree;", "if (!is_array(\$tree) || !\$jt || empty(\$jt['colNames'])) return \$tree;",
                           array('H-sniptree')),
    'gs-gate'     => array('schedule_runner.php', "if (\$jtRes && (!empty(\$jtRes['colNames']) || !empty(\$jtRes['whoNames']))) {", "if (\$jtRes && !empty(\$jtRes['colNames'])) {",
                           array('H-wired')),
    'orders-wire' => array('schedule_runner.php', "            if (\$_jfOrders) \$state['customSortOrders'] = \$_jfOrders;\n", '',
                           array('H-wired')),
);
// What the build before the change gets wrong (frozen from its first control run, on the live build of 2026-11-11).
$CONTROL_RED = array('R-names', 'R-values', 'R-parked', 'R-nowho', 'R-alone', 'R-clean', 'R-alias', 'X-columns',
    'S-sort', 'S-sort-alone', 'S-group', 'S-group-alone', 'S-orders', 'S-orders-own', 'S-orders-sort',
    'F-label', 'F-old', 'F-old-not', 'F-current-wins', 'F-oldname', 'F-retired', 'F-empty', 'F-alone', 'F-other', 'F-grouped',
    'H-sum', 'H-sum-alone', 'H-hl', 'H-order', 'H-places', 'H-places-hidden', 'H-snipcols', 'H-sniptree', 'H-wired');
// ...every "as before" assert (R-toggles, R-alone-nokey, R-none, R-noquery, R-readfail, X-snapshot, X-strip, F-regex,
// F-contains, F-bare, F-clean) PASSES on the old build.

$EXPECT = array('P-loaded', 'P-lifted',
    'R-names', 'R-values', 'R-parked', 'R-toggles', 'R-nowho', 'R-alone', 'R-alone-nokey', 'R-none', 'R-noquery', 'R-readfail', 'R-clean', 'R-alias',
    'X-snapshot', 'X-strip', 'X-columns',
    'S-sort', 'S-sort-alone', 'S-group', 'S-group-alone', 'S-orders', 'S-orders-own', 'S-orders-sort',
    'F-label', 'F-old', 'F-old-not', 'F-current-wins', 'F-regex', 'F-contains', 'F-oldname', 'F-retired', 'F-empty', 'F-alone', 'F-bare', 'F-other', 'F-grouped', 'F-clean',
    'H-sum', 'H-sum-alone', 'H-hl', 'H-order', 'H-places', 'H-places-hidden', 'H-snipcols', 'H-sniptree', 'H-wired');

function plo_files($app, $APP) {
    $files = array();
    foreach (array('journal_export.php', 'penumbra_search.php', 'schedule_runner.php') as $f) {
        $p = file_exists($app . '/' . $f) ? $app . '/' . $f : $APP . '/' . $f;
        $files[$f] = file_get_contents($p);
    }
    return $files;
}
function plo_mutate($files, $name, $MUTANTS) {
    list($mf, $old, $new) = $MUTANTS[$name];
    $crlf = strpos($files[$mf], "\r\n") !== false;
    if ($crlf) { $old = str_replace("\n", "\r\n", $old); $new = str_replace("\n", "\r\n", $new); }
    $c = substr_count($files[$mf], $old);
    if ($c !== 1) { fwrite(STDERR, "mutant $name: anchor found $c times\n"); exit(2); }
    $files[$mf] = str_replace($old, $new, $files[$mf]);
    return $files;
}
function plo_run_child($files) {
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_picklist_out_' . getmypid() . '_' . mt_rand(1000, 9999);
    if (!preg_match('/pnb_picklist_out_\d+_\d{4}$/', $dir)) { fwrite(STDERR, "bad temp dir\n"); exit(2); }
    mkdir($dir);
    foreach ($files as $f => $src) file_put_contents($dir . '/' . $f, $src);
    $cmd = '"' . PHP_BINARY . '" -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring "' . __FILE__ . '"';
    $env = array('PNB_PLO_CHILD' => $dir, 'SystemRoot' => getenv('SystemRoot'), 'TEMP' => getenv('TEMP'), 'TMP' => getenv('TMP'));
    $p = proc_open($cmd, array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, null, $env);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    foreach (array_keys($files) as $f) if (file_exists($dir . '/' . $f)) unlink($dir . '/' . $f);
    rmdir($dir);
    $res = json_decode($out, true);
    if (!is_array($res)) return array(array('FATAL', false, substr($out . ' ' . $err, 0, 1500)));
    return $res;
}
function plo_eval($res, $EXPECT) {
    $got = array(); $out = array();
    foreach ($res as $r) $got[$r[0]] = $r;
    foreach ($EXPECT as $id) $out[] = isset($got[$id]) ? $got[$id] : array($id, false, 'NOT RECORDED');
    foreach ($got as $id => $r) if (!in_array($id, $EXPECT, true)) $out[] = array($id, false, 'UNEXPECTED ' . $r[2]);
    return $out;
}

$base = plo_files($app, $APP);
echo 'build: ' . $app . "\n";
if ($allMutants || $oneMutant) {
    $ok = 0; $bad = 0;
    foreach (($oneMutant ? explode(',', $oneMutant) : array_keys($MUTANTS)) as $m) {
        $res = plo_eval(plo_run_child(plo_mutate($base, $m, $MUTANTS)), $EXPECT);
        $red = array(); foreach ($res as $r) if (!$r[1]) $red[] = $r[0];
        $must = $MUTANTS[$m][3]; sort($red); sort($must);
        $good = ($red === $must);
        $good ? $ok++ : $bad++;
        printf("  %s  mutant %-12s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $MUTANTS[$m][3]), implode(' ', $red));
        if (!$good) foreach ($res as $r) if (!$r[1]) printf("        %-16s %s\n", $r[0], substr($r[2], 0, 300));
    }
    printf("SUMMARY mutants ok=%d bad=%d\n%s\n", $ok, $bad, ($bad === 0 && $ok > 0) ? 'RESULT: GREEN' : 'RESULT: RED');
    exit($bad ? 1 : 0);
}
$res = plo_eval(plo_run_child($base), $EXPECT);
$p = 0; $f = 0; $failed = array();
foreach ($res as $r) { printf("  %s  %-16s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 400)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
printf("TOTAL pass=%d fail=%d   failed: %s\n", $p, $f, implode(' ', $failed));
if ($control) {
    if ($CONTROL_RED === null) { echo "CONTROL: not frozen yet - red set: " . implode(' ', $failed) . "\nRESULT: RED\n"; exit(1); }
    $a = $failed; $b = $CONTROL_RED; sort($a); sort($b);
    echo ($a === $b) ? "CONTROL: exactly CONTROL_RED fails\nRESULT: GREEN\n" : "CONTROL: red set differs from CONTROL_RED\nRESULT: RED\n";
    exit($a === $b ? 0 : 1);
}
echo $f ? "RESULT: RED\n" : "RESULT: GREEN\n";
exit($f ? 1 : 0);

// =============================================================================
// THE CHILD: the build's three files, a fake database
// =============================================================================
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = $sql;
    if (stripos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    if (strpos($sql, 'STATE = 2') !== false) {
        if ($GLOBALS['DB']['fieldFail'] !== null) throw new Exception($GLOBALS['DB']['fieldFail']);
        return $GLOBALS['DB']['fields'];
    }
    if (strpos($sql, 'STATE = 1') !== false) return $GLOBALS['DB']['marks'];
    if (stripos($sql, 'FROM PENUMBRA_JOURNAL') !== false) return array();   // row notes: none
    return array();
}
function plo_db_reset() {
    $park = defined('JOURNAL_PARK_OPEN') ? JOURNAL_PARK_OPEN : "\xE2\x90\x82";
    $GLOBALS['Q'] = array();
    $GLOBALS['DB'] = array('fieldFail' => null,
        'marks' => array(array('TOGGLE_KEY' => 'rev', 'ROW_KEY' => 'P-1', 'UPDATED_BY' => 'ann', 'UPDATED_ON' => '2026-11-09')),
        'fields' => array(
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => 'P-1', 'FIELD_VALUE' => 'o2', 'UPDATED_BY' => 'jdoe', 'UPDATED_ON' => '2026-11-10'),
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => 'P-2', 'FIELD_VALUE' => null, 'UPDATED_BY' => 'x', 'UPDATED_ON' => '2026-11-10'),
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => 'P-3', 'FIELD_VALUE' => 'o4', 'UPDATED_BY' => 'kim', 'UPDATED_ON' => '2026-11-08'),
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => 'P-4', 'FIELD_VALUE' => 'o9', 'UPDATED_BY' => 'lee', 'UPDATED_ON' => '2026-11-07'),
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => 'P-5', 'FIELD_VALUE' => 'o3', 'UPDATED_BY' => 'pat', 'UPDATED_ON' => '2026-11-06'),
            array('TOGGLE_KEY' => 'f1', 'ROW_KEY' => $park . 'OLD' . "\xE2\x90\x83" . 'P-2', 'FIELD_VALUE' => 'o1', 'UPDATED_BY' => 'old', 'UPDATED_ON' => '2026-01-01'),
            array('TOGGLE_KEY' => 'f2', 'ROW_KEY' => 'P-1', 'FIELD_VALUE' => 'o2', 'UPDATED_BY' => 'jdoe', 'UPDATED_ON' => '2026-11-10'),
            array('TOGGLE_KEY' => 'rev', 'ROW_KEY' => 'P-2', 'FIELD_VALUE' => 'o1', 'UPDATED_BY' => 'odd', 'UPDATED_ON' => '2026-11-10'),
        ));
}
function plo_rows() {
    $out = array();
    foreach (array(array('P-1', 'Alpha', 'x'), array('P-2', 'Beta', 'y'), array('P-3', 'Gamma', 'y'), array('P-4', 'Delta', 'y'), array('P-5', 'Epsilon', 'y')) as $r) {
        $out[] = array('PROPOSAL ID' => $r[0], 'TITLE' => $r[1], 'STATUS' => $r[2]);
    }
    return $out;
}
function plo_fields() {
    return array(
        array('key' => 'f1', 'type' => 'pick', 'label' => 'Progress', 'oldLabels' => array('Stage'), 'options' => array(
            array('id' => 'o1', 'label' => 'Not started', 'color' => 'grey'),
            array('id' => 'o2', 'label' => 'In progress', 'color' => 'blue', 'oldLabels' => array('Started', 'Done')),
            array('id' => 'o3', 'label' => 'Done', 'color' => 'green'),
            array('id' => 'o4', 'label' => 'Parked', 'retired' => true))),
        array('key' => 'f2', 'type' => 'pick', 'label' => 'Status', 'options' => array(
            array('id' => 'o1', 'label' => 'Open'), array('id' => 'o2', 'label' => 'Closed'))));
}
function plo_state($over = array()) {
    $vo = array('journalEnabled' => true, 'journalKeyColumns' => array('PROPOSAL ID'),
        'journalToggles' => array(array('key' => 'rev', 'label' => 'Reviewed')), 'journalToggleWho' => true,
        'journalFields' => plo_fields());
    foreach ($over as $k => $v) { if ($v === null) unset($vo[$k]); else $vo[$k] = $v; }
    return array('viewOptions' => $vo);
}
function plo_res($over = array()) {
    $rows = plo_rows();
    return journalExportToggleResolver('rpt', plo_state($over), array_keys($rows[0]));
}
function plo_lift($src, $name) {
    $p = strpos($src, "function $name(");
    if ($p === false) return null;
    $toks = token_get_all('<?php ' . substr($src, $p)); $out = ''; $depth = 0; $open = false;
    foreach ($toks as $t) {
        $s = is_array($t) ? $t[1] : $t;
        if (is_array($t) && $t[0] === T_OPEN_TAG) continue;
        $out .= $s;
        if ($s === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $open = true; }
        if ($s === '}') { $depth--; if ($open && $depth === 0) break; }
    }
    return $out;
}

function plo_child($dir) {
    ini_set('display_errors', 'stderr');   // a warning on stdout would spoil the JSON (a control run's build lacks the new keys)
    $R = array();
    $A = function ($id, $ok, $detail = '') use (&$R) { $R[] = array($id, (bool)$ok, is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); };
    require $dir . '/journal_export.php';
    require $dir . '/penumbra_search.php';
    $A('P-loaded', function_exists('journalExportToggleResolver') && function_exists('php_apply_search_filter'), 'the build: ' . $dir);
    $runner = file_get_contents($dir . '/schedule_runner.php');
    $lifted = array();
    foreach (array('penumbra_sched_toggle_summaries', 'penumbra_hl_reads_column', 'penumbra_hl_journal_rules', 'penumbra_sched_journal_screen_order',
                   'penumbra_sched_journal_places', '_snippet_journal_toggles', '_snippet_merge_journal_cols', '_snippet_normalize_toggle_tree',
                   'penumbra_custom_sort_entry', 'get_custom_sort_comparator') as $fn) {
        $src = plo_lift($runner, $fn);
        if ($src !== null && !function_exists($fn)) { eval($src); $lifted[] = $fn; }
    }
    $A('P-lifted', count($lifted) === 10, $lifted);
    $col = function ($rows, $name) { return implode(',', array_map(function ($r) use ($name) { return isset($r[$name]) ? (string)$r[$name] : '-'; }, $rows)); };
    $vals = function ($res, $name) {
        $o = array();
        foreach (plo_rows() as $r) { $v = journalExportToggleRowValues($res, $r); $o[] = array_key_exists($name, $v) ? $v[$name] : '-'; }
        return implode(',', $o);
    };

    // ---- R: the resolver ----------------------------------------------------------------------------------------
    plo_db_reset();
    $res = plo_res();
    $A('R-names', is_array($res) && $res['colNames'] === array('REVIEWED')
        && $res['whoNames'] === array('REVIEWED BY', 'REVIEWED ON', 'PROGRESS', 'PROGRESS BY', 'PROGRESS ON', 'STATUS_2', 'STATUS BY', 'STATUS ON')
        && isset($res['fieldNames']) && $res['fieldNames'] === array('PROGRESS', 'STATUS_2'),
        is_array($res) ? array($res['colNames'], $res['whoNames'], isset($res['fieldNames']) ? $res['fieldNames'] : null) : 'no resolver');
    $A('R-values', is_array($res) && $vals($res, 'PROGRESS') === 'In progress,,Parked,(unknown option),Done'
        && $vals($res, 'PROGRESS BY') === 'jdoe,,kim,lee,pat' && $vals($res, 'PROGRESS ON') === '2026-11-10,,2026-11-08,2026-11-07,2026-11-06'
        && $vals($res, 'STATUS_2') === 'Closed,,,,',
        is_array($res) ? array($vals($res, 'PROGRESS'), $vals($res, 'PROGRESS BY'), $vals($res, 'PROGRESS ON'), $vals($res, 'STATUS_2')) : 'no resolver');
    $A('R-parked', is_array($res) && isset($res['whoMap']['f1']) && count($res['whoMap']['f1']) === 4, 'rows read for f1: ' . (is_array($res) && isset($res['whoMap']['f1']) ? implode(' ', array_keys($res['whoMap']['f1'])) : '-'));
    $A('R-toggles', is_array($res) && $vals($res, 'REVIEWED') === '1,0,0,0,0' && $vals($res, 'REVIEWED BY') === 'ann,,,,',
        'a STATE 2 row under a toggle key marks nothing: ' . (is_array($res) ? $vals($res, 'REVIEWED') : '-'));
    plo_db_reset();
    $r2 = plo_res(array('journalToggleWho' => false));
    $A('R-nowho', is_array($r2) && $r2['whoNames'] === array('PROGRESS', 'STATUS_2'), is_array($r2) ? $r2['whoNames'] : 'no resolver');
    plo_db_reset();
    $alone = plo_res(array('journalToggles' => array(), 'journalToggleWho' => false));
    $A('R-alone', is_array($alone) && $alone['colNames'] === array() && $alone['whoNames'] === array('PROGRESS', 'STATUS_2') && $vals($alone, 'PROGRESS') === 'In progress,,Parked,(unknown option),Done',
        is_array($alone) ? array($alone['colNames'], $alone['whoNames']) : 'no resolver for a report whose only journal column is a pick list');
    plo_db_reset();
    $A('R-alone-nokey', plo_res(array('journalToggles' => array(), 'journalKeyColumns' => array())) === null, 'no key columns: none');
    plo_db_reset();
    $none = plo_res(array('journalToggles' => array(), 'journalFields' => null));
    $A('R-none', $none === null, 'no toggle, no pick list, no notes: none, as before');
    plo_db_reset();
    plo_res(array('journalFields' => null));
    $q2 = 0; foreach ($GLOBALS['Q'] as $q) if (strpos($q, 'STATE = 2') !== false) $q2++;
    $A('R-noquery', $q2 === 0, 'no pick list: their rows are not read (' . $q2 . ' reads)');
    plo_db_reset(); $GLOBALS['DB']['fieldFail'] = 'ORA-00904: "FIELD_VALUE": invalid identifier';
    $rf = plo_res();
    plo_db_reset(); $GLOBALS['DB']['fieldFail'] = 'ORA-00904: "FIELD_VALUE": invalid identifier';
    $rfa = plo_res(array('journalToggles' => array()));
    $A('R-readfail', is_array($rf) && $rf['colNames'] === array('REVIEWED') && $rf['whoNames'] === array('REVIEWED BY', 'REVIEWED ON') && $rfa === null,
        'a table without FIELD_VALUE: the toggles as before, no pick list column; ' . json_encode(is_array($rf) ? $rf['whoNames'] : null) . ' / alone: ' . json_encode($rfa === null));
    plo_db_reset();
    $f = plo_fields();
    $messy = array(
        array('key' => 'd1', 'type' => 'date', 'label' => 'When', 'options' => array()),
        array('key' => 'REV', 'type' => 'pick', 'label' => 'Clash', 'options' => array()),
        array('key' => '__x', 'type' => 'pick', 'label' => 'Reserved', 'options' => array()),
        array('key' => 'F1', 'type' => 'pick', 'label' => 'Progress', 'oldLabels' => array('Stage'), 'options' => array_merge(
            array(array('id' => 'x1', 'label' => 'bad id'), array('id' => 'o2', 'label' => 'In progress', 'oldLabels' => array('Started'))),
            array(array('id' => 'o2', 'label' => 'duplicate')), $f[0]['options'])),
        array('key' => 'f1', 'type' => 'pick', 'label' => 'Again', 'options' => array()),
        array('key' => 'f2', 'type' => 'pick', 'label' => '', 'options' => array(array('id' => 'o1', 'label' => '   '))),
        array('key' => 'f3', 'type' => 'pick', 'label' => 'Three', 'options' => array()),
        array('key' => 'f4', 'type' => 'pick', 'label' => 'Four', 'options' => array()),
        array('key' => 'f5', 'type' => 'pick', 'label' => 'Five', 'options' => array()));
    $rc = plo_res(array('journalFields' => $messy, 'journalToggleWho' => false));
    $rcOrd = function ($n) use ($rc) { return (is_array($rc) && isset($rc['fieldOpts'][$n]['order'])) ? $rc['fieldOpts'][$n]['order'] : null; };
    $A('R-clean', is_array($rc) && isset($rc['fieldNames']) && $rc['fieldNames'] === array('PROGRESS', 'STATUS_2', 'THREE', 'FOUR')
        && $rcOrd('PROGRESS') === array('In progress', 'Not started', 'Done', 'Parked') && $rcOrd('STATUS_2') === array('o1'),
        is_array($rc) ? array(isset($rc['fieldNames']) ? $rc['fieldNames'] : null, $rcOrd('PROGRESS'), $rcOrd('STATUS_2')) : 'no resolver');
    $A('R-alias', is_array($res) && isset($res['aliasMap']['STAGE']) && $res['aliasMap']['STAGE'] === 'PROGRESS'
        && isset($res['aliasMap']['STAGE BY']) && $res['aliasMap']['STAGE BY'] === 'PROGRESS BY' && isset($res['aliasMap']['STAGE ON']) && $res['aliasMap']['STAGE ON'] === 'PROGRESS ON',
        is_array($res) ? $res['aliasMap'] : null);

    // ---- X: a snapshot never carries them; a comparison strips them; the output's columns -------------------------
    $snap = journalDecorateRowsWithToggles(plo_rows(), array('journalToggleResolver' => $res));
    $A('X-snapshot', isset($snap[0]['REVIEWED']) && !isset($snap[0]['PROGRESS']) && !isset($snap[0]['STATUS_2']), array_keys($snap[0]));
    $full = plo_rows(); foreach ($full as $i => $r) foreach (journalExportToggleRowValues($res, $r) as $n => $v) $full[$i][$n] = $v;
    $st = journalStripWhoCols($full, $res);
    $A('X-strip', !isset($st[0]['PROGRESS']) && !isset($st[0]['PROGRESS BY']) && !isset($st[0]['STATUS_2']) && isset($st[0]['REVIEWED']), array_keys($st[0]));
    plo_db_reset();
    $rows = plo_rows();
    $jt = journalExportToggleColumns('rpt', plo_state(), $rows);
    $A('X-columns', in_array('PROGRESS', $jt['whoNames'], true) && in_array('STATUS_2', $jt['whoNames'], true) && $jt['colNames'] === array('REVIEWED')
        && $col($rows, 'PROGRESS') === 'In progress,,Parked,(unknown option),Done' && $col($rows, 'STATUS') === 'x,y,y,y,y',
        array($jt['colNames'], $jt['whoNames'], $col($rows, 'PROGRESS')));

    // ---- S: a saved sort / grouping by the page's names; the list's order ------------------------------------------
    $sc = journalExportMapSortCriteria(array(
        array('colIdentifier' => '__JOURNAL_FIELD__f1', 'colIndex' => '__JOURNAL_FIELD__f1', 'direction' => 'asc'),
        array('colIdentifier' => '__JOURNAL_BY__f1', 'direction' => 'asc'), array('colIdentifier' => 'Stage', 'direction' => 'asc'),
        array('colIdentifier' => '__JOURNAL_TOGGLE__rev', 'direction' => 'asc')), $res);
    $A('S-sort', $sc[0]['colIdentifier'] === 'PROGRESS' && $sc[0]['colIndex'] === 'PROGRESS' && $sc[1]['colIdentifier'] === 'PROGRESS BY'
        && $sc[2]['colIdentifier'] === 'PROGRESS' && $sc[3]['colIdentifier'] === 'REVIEWED', array_map(function ($c) { return $c['colIdentifier']; }, $sc));
    $sca = is_array($alone) ? journalExportMapSortCriteria(array(array('colIdentifier' => '__JOURNAL_FIELD__F1', 'direction' => 'asc')), $alone) : null;
    $A('S-sort-alone', $sca && $sca[0]['colIdentifier'] === 'PROGRESS', $sca);
    $A('S-group', journalExportToggleGroupBy('__JOURNAL_FIELD__f1,TITLE', $res) === 'PROGRESS,TITLE' && journalExportToggleGroupBy('Stage', $res) === 'PROGRESS'
        && journalExportToggleGroupBy('__JOURNAL_ON__f1', $res) === 'PROGRESS ON' && journalExportToggleGroupBy('__JOURNAL_TOGGLE__rev', $res) === 'REVIEWED',
        array(journalExportToggleGroupBy('__JOURNAL_FIELD__f1,TITLE', $res), journalExportToggleGroupBy('Stage', $res), journalExportToggleGroupBy('__JOURNAL_ON__f1', $res)));
    $A('S-group-alone', is_array($alone) && journalExportToggleGroupBy('__JOURNAL_FIELD__f1', $alone) === 'PROGRESS', is_array($alone) ? journalExportToggleGroupBy('__JOURNAL_FIELD__f1', $alone) : 'no resolver');
    $hasOrders = function_exists('journalExportFieldSortOrders');
    $so = $hasOrders ? journalExportFieldSortOrders(array(), $res) : null;
    $A('S-orders', $so === array('PROGRESS' => array('values' => array('Not started', 'In progress', 'Done', 'Parked')), 'STATUS_2' => array('values' => array('Open', 'Closed'))), $so);
    $own = array('__JOURNAL_FIELD__F1' => array('values' => array('Done', 'Not started')), 'status_2' => array('values' => array('Closed')));
    $so2 = $hasOrders ? journalExportFieldSortOrders($own, $res) : null;
    $A('S-orders-own', is_array($so2) && isset($so2['PROGRESS']) && $so2['PROGRESS']['values'] === array('Done', 'Not started') && !isset($so2['STATUS_2']) && $so2['status_2']['values'] === array('Closed'),
        'the report\'s own order for the column wins: ' . json_encode($so2));
    $sorted = null;
    if (is_array($so) && function_exists('get_custom_sort_comparator')) {
        $cmp = get_custom_sort_comparator($so, 'progress');
        $sorted = array('Done', '', 'In progress', '(unknown option)', 'Not started', 'Parked');
        if ($cmp) usort($sorted, $cmp);
    }
    $A('S-orders-sort', $sorted === array('Not started', 'In progress', 'Done', 'Parked', '', '(unknown option)'), 'the runner\'s comparator: ' . json_encode($sorted));

    // ---- F: task filters (php_apply_search_filter, as the runner and ?json=1 &search= call it) --------------------
    $ids = function ($q, $r = null, $mode = 'standard') use ($res) {
        $data = plo_rows();
        if ($mode === 'grouped') $data = array('G' => array('rows' => $data));
        $out = php_apply_search_filter($data, $mode, $q, null, $r === null ? $res : $r);
        if ($mode === 'grouped') $out = isset($out['G']['rows']) ? $out['G']['rows'] : array();
        return implode(',', array_map(function ($x) { return $x['PROPOSAL ID']; }, is_array($out) ? $out : array()));
    };
    $A('F-label', $ids('Progress = "In progress"') === 'P-1', $ids('Progress = "In progress"'));
    $A('F-old', $ids('Progress = Started') === 'P-1' && $ids("Progress = 'started'") === 'P-1', 'an option\'s old label: ' . $ids('Progress = Started') . ' / ' . $ids("Progress = 'started'"));
    $A('F-old-not', $ids('Progress != Started') === 'P-2,P-3,P-4,P-5', $ids('Progress != Started'));
    $A('F-current-wins', $ids('Progress = Done') === 'P-5', 'a label an option has now wins over an old one: ' . $ids('Progress = Done'));
    $A('F-regex', $ids('Progress = /Started/') === '', 'a regex is read as written: ' . $ids('Progress = /Started/'));
    $A('F-contains', $ids('Progress contains Started') === '', 'a contains is read as written: ' . $ids('Progress contains Started'));
    $A('F-oldname', $ids('Stage = Started') === 'P-1', 'a renamed list\'s old name, an option\'s old label: ' . $ids('Stage = Started'));
    $A('F-retired', $ids('Progress = Parked') === 'P-3', $ids('Progress = Parked'));
    $A('F-empty', $ids('Progress = empty') === 'P-2', $ids('Progress = empty'));
    $A('F-alone', is_array($alone) && $ids('Progress = Started', $alone) === 'P-1', is_array($alone) ? $ids('Progress = Started', $alone) : 'no resolver');
    $A('F-bare', $ids('Closed') === '' && $ids('jdoe') === '', 'a bare word reads the data\'s own columns: ' . $ids('Closed') . '|' . $ids('jdoe'));
    $A('F-other', $ids('Status_2 = Closed') === 'P-1' && $ids('Status = x') === 'P-1' && $ids('Status = y') === 'P-2,P-3,P-4,P-5',
        'the list beside a data column of its name: ' . $ids('Status_2 = Closed') . ' / the data column: ' . $ids('Status = x'));
    $A('F-grouped', $ids('Progress = Started', null, 'grouped') === 'P-1', $ids('Progress = Started', null, 'grouped'));
    $fo = php_apply_search_filter(plo_rows(), 'standard', 'Progress != "no such option"', null, $res);
    $A('F-clean', count($fo) === 5 && !isset($fo[0]['PROGRESS']) && !isset($fo[0]['REVIEWED']), 'the rows come back as they were: ' . json_encode(isset($fo[0]) ? array_keys($fo[0]) : null));

    // ---- H: schedule_runner.php -------------------------------------------------------------------------------------
    $sum = function_exists('penumbra_sched_toggle_summaries')
        ? penumbra_sched_toggle_summaries(array('columnSummaries' => array('__JOURNAL_FIELD__F1' => 'count', '__JOURNAL_BY__F1' => 'countDistinct')), $res) : null;
    $A('H-sum', is_array($sum) && isset($sum['columnSummaries']['PROGRESS']) && $sum['columnSummaries']['PROGRESS'] === 'count' && isset($sum['columnSummaries']['PROGRESS BY']), $sum);
    $sum2 = (function_exists('penumbra_sched_toggle_summaries') && is_array($alone)) ? penumbra_sched_toggle_summaries(array('columnSummaries' => array('__JOURNAL_FIELD__F1' => 'count')), $alone) : null;
    $A('H-sum-alone', is_array($sum2) && isset($sum2['columnSummaries']['PROGRESS']), $sum2);
    $hl = null;
    if (function_exists('penumbra_hl_journal_rules')) {
        _snippet_journal_toggles($res);
        $hl = penumbra_hl_journal_rules(array(array('targetColumn' => '__JOURNAL_FIELD__F1', 'condition' => ''), array('targetColumn' => '__JOURNAL_FIELD__NOPE', 'condition' => '')));
        _snippet_journal_toggles(false);
    }
    $A('H-hl', is_array($hl) && count($hl) === 1 && $hl[0]['targetColumn'] === 'PROGRESS', $hl);
    plo_db_reset();
    $rn = plo_res(array('journalRowNotes' => true, 'journalNotesExport' => true));
    $order = null;
    if (function_exists('penumbra_sched_journal_screen_order') && is_array($rn)) {
        $names = array_merge($rn['colNames'], $rn['whoNames'], array($rn['notesName']));
        $order = penumbra_sched_journal_screen_order($rn, $names);
    }
    $A('H-order', $order === array('REVIEWED', 'REVIEWED BY', 'REVIEWED ON', 'PROGRESS', 'PROGRESS BY', 'PROGRESS ON', 'STATUS_2', 'STATUS BY', 'STATUS ON', 'NOTES'), $order);
    $pl = $pl2 = null;
    if (function_exists('penumbra_sched_journal_places')) {
        $journal = penumbra_sched_journal_screen_order($res, array_merge($res['colNames'], $res['whoNames']));
        $keys = array('PROPOSAL ID', 'TITLE', 'STATUS');
        $pl = penumbra_sched_journal_places($keys, $journal, array('columnOrder' => array(0, '__JOURNAL_FIELD__f1', 1, 2)), $keys, $res);
        $pl2 = penumbra_sched_journal_places($keys, $journal, array('columnOrder' => array(0, '__JOURNAL_FIELD__f1', 1, 2),
            'visibleColumns' => array(0, 1, 2)), $keys, $res);
    }
    $pi = is_array($pl) ? array_search('PROGRESS', $pl, true) : false;
    $A('H-places', is_array($pl) && $pi !== false && $pi === array_search('PROPOSAL ID', $pl, true) + 1 && $pl[$pi + 1] === 'PROGRESS BY', 'the saved layout puts it after PROPOSAL ID: ' . json_encode($pl));
    $A('H-places-hidden', is_array($pl2) && !in_array('PROGRESS', $pl2, true) && in_array('PROGRESS BY', $pl2, true), 'a layout that hides it: ' . json_encode($pl2));
    $sc2 = (function_exists('_snippet_merge_journal_cols') && is_array($alone)) ? _snippet_merge_journal_cols(array('PROPOSAL ID', 'TITLE'), $alone) : null;
    $A('H-snipcols', is_array($sc2) && in_array('PROGRESS', $sc2, true) && in_array('STAGE', $sc2, true), $sc2);
    $tree = null;
    if (function_exists('_snippet_normalize_toggle_tree') && is_array($alone)) {
        $alias = journalExportAliasMapFor($alone, array('PROPOSAL ID', 'TITLE'));
        $tree = _snippet_normalize_toggle_tree(array(array('type' => 'condition', 'column' => 'Stage', 'op' => '=', 'value' => 'Done')), $alone, $alias);
    }
    $A('H-sniptree', is_array($tree) && $tree[0]['column'] === 'PROGRESS' && $tree[0]['value'] === 'Done', $tree);
    $w = array(
        substr_count($runner, "if (\$jtRes && (!empty(\$jtRes['colNames']) || !empty(\$jtRes['whoNames']))) {"),
        substr_count($runner, "_journal_field_option_conditions(\$rowParts, \$jtRes)"),
        substr_count($runner, "journalExportFieldSortOrders(isset(\$state['customSortOrders'])"),
        substr_count($runner, "if (\$_jfOrders) \$state['customSortOrders'] = \$_jfOrders;"));
    $A('H-wired', $w === array(1, 1, 1, 1), 'the runner\'s group-summary filter and its sort orders: ' . json_encode($w));

    echo json_encode($R, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
}
