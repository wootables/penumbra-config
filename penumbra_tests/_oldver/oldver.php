<?php
// =============================================================================
// oldver.php - old versions of webroot files for --control runs, read from GIT.
// PHP twin of oldver.py (read its header).
//   require '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\_oldver\\oldver.php';
//   oldver_glob("$APP/x.php.bak-*-tag")   drop-in for glob() + sort()
//   oldver_path("$APP/x.php.bak-<stamp>") drop-in for "is_file($p) ? $p : null"
//   oldver_git_show('abc1234^', 'x.php')  the file at a commit (git show <rev>:<rel>), a path
// =============================================================================
const OLDVER_WEBROOT = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
const OLDVER_GIT_DIR = '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\penumbra_git';

function oldver_index() {
    static $idx = null;
    if ($idx === null) {
        $idx = [];
        foreach (file(__DIR__ . '/bak_index.tsv', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if ($line[0] === '#') continue;
            $idx[] = explode("\t", $line);
        }
    }
    return $idx;
}

function oldver_git(array $args, $outFile = null) {
    $cmd = array_merge(['git', '--git-dir=' . OLDVER_GIT_DIR], $args);
    $spec = [1 => $outFile !== null ? ['file', $outFile, 'wb'] : ['pipe', 'w'], 2 => ['pipe', 'w']];
    $p = proc_open($cmd, $spec, $pipes);
    $out = $outFile === null ? stream_get_contents($pipes[1]) : '';
    $err = stream_get_contents($pipes[2]);
    if (proc_close($p) !== 0) { fwrite(STDERR, 'oldver: git ' . implode(' ', $args) . " failed: $err\n"); exit(2); }
    return trim($out);
}

function oldver_blob_file($sha, $base) {
    $d = __DIR__ . "/cache/$sha";
    $p = "$d/$base";
    if (is_file($p)) return $p;
    if (!is_dir($d)) mkdir($d, 0777, true);
    oldver_git(['cat-file', 'blob', $sha], "$p.tmp");
    $data = file_get_contents("$p.tmp");
    if (sha1('blob ' . strlen($data) . "\0" . $data) !== $sha) { unlink("$p.tmp"); fwrite(STDERR, "oldver: blob $sha came back with the wrong hash\n"); exit(2); }
    rename("$p.tmp", $p);
    return $p;
}

function oldver_glob($pattern) {
    $found = [];
    foreach (glob($pattern) ?: [] as $p) $found[strtolower(basename($p))] = $p;
    $root = strtolower(str_replace('\\', '/', OLDVER_WEBROOT)) . '/';
    $n = str_replace('\\', '/', $pattern);
    if (strpos(strtolower($n), $root) === 0) {
        $relPat = strtolower(substr($n, strlen($root)));
        foreach (oldver_index() as [$rel, $kind, $ref]) {
            if (!fnmatch($relPat, strtolower($rel), FNM_NOESCAPE)) continue;
            $base = basename($rel);
            if (isset($found[strtolower($base)])) continue;
            $found[strtolower($base)] = $kind === 'git' ? oldver_blob_file($ref, $base) : $ref;
        }
    }
    $out = array_values($found);
    usort($out, function ($a, $b) { return strcmp(basename($a), basename($b)); });
    return $out;
}

function oldver_path($path) {
    if (is_file($path)) return $path;
    $hits = oldver_glob($path);   // .bak names hold no * ? [ - the path is its own pattern
    return $hits ? end($hits) : null;
}

function oldver_git_show($rev, $rel) {
    $rel = str_replace('\\', '/', $rel);
    return oldver_blob_file(oldver_git(['rev-parse', "$rev:$rel"]), basename($rel));
}
