<?php
// prebuild_caches.php v1|v2 - build the live help chunk cache of one version from the live files
// (the web tier cannot write cache/), then prove the stored signature equals the live signature.
$v2 = isset($argv[1]) && $argv[1] === 'v2';
define('PNB_HELP_V2_FORCE', $v2);
require "//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra/help_retrieval.php";
$c = pnb_help_build();
if (!$c) { fwrite(STDERR, "build failed\n"); exit(1); }
$paths = pnb_help_cache_paths();
$sig = pnb_help_src_sig();
echo json_encode(array('mode' => $v2 ? 'v2' : 'v1', 'chunks' => $c['n'], 'ver' => $c['ver'], 'src_mtime' => $c['src_mtime'], 'live_sig' => $sig,
    'match' => ($c['src_mtime'] == $sig), 'cache' => $paths[0], 'written' => is_file($paths[0]), 'size' => @filesize($paths[0]))), "\n";
