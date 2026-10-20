<?php
// prebuild_caches.php - build the live help chunk cache (cache/help_chunks.json) from the live fragments
// (the web tier cannot write cache/), then prove the stored signature equals the live signature.
// One cache since 2026-10-19 (the v1 help and its separate cache are gone); an argument is ignored.
require "//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra/help_retrieval.php";
$c = pnb_help_build();
if (!$c) { fwrite(STDERR, "build failed\n"); exit(1); }
$paths = pnb_help_cache_paths();
$sig = pnb_help_src_sig();
echo json_encode(array('chunks' => $c['n'], 'ver' => $c['ver'], 'src_mtime' => $c['src_mtime'], 'live_sig' => $sig,
    'match' => ($c['src_mtime'] == $sig), 'cache' => $paths[0], 'written' => is_file($paths[0]), 'size' => @filesize($paths[0]))), "\n";
