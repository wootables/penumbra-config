<?php
// penumbra_unseal.php - decrypt an enc:v1: sealed value from penumbra_config.php (CLI-only).
//
// Companion to penumbra_seal.php, for "which account/key is this?" moments now that
// usernames are sealed too. Requires read access to BOTH halves - the enc string
// (D: config) and the key (C:/inetpub/penumbra_config.key) - i.e. the same trust the
// app itself has, so this tool does not weaken the split-drive model.
//
// On the server:
//   php.exe penumbra_unseal.php            (paste enc:v1:..., Enter, Ctrl+Z, Enter)
//
// From a workstation over the admin shares (extension_dir MUST use forward slashes):
//   & "\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe" -n `
//     -d 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext' -d extension=openssl `
//     "\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_unseal.php" `
//     -k "//oitras.oit.ncsu.edu/c$/inetpub/penumbra_config.key"
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
$opt = getopt('k:');
$keyPath = isset($opt['k']) ? $opt['k'] : 'C:/inetpub/penumbra_config.key';
$key = @file_get_contents($keyPath);
if ($key === false || strlen($key) !== 32) { fwrite(STDERR, "key unreadable: $keyPath\n"); exit(1); }
fwrite(STDERR, "Paste the enc:v1: string, press Enter, then EOF (Ctrl+Z then Enter on Windows):\n");
$s = trim((string)stream_get_contents(STDIN));
if (strncmp($s, 'enc:v1:', 7) !== 0) { fwrite(STDERR, "not an enc:v1: string\n"); exit(1); }
$raw = base64_decode(substr($s, 7), true);
$pt = ($raw !== false && strlen($raw) > 28)
    ? openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16))
    : false;
if ($pt === false) { fwrite(STDERR, "decrypt failed (wrong key or corrupted string)\n"); exit(1); }
echo $pt . PHP_EOL;
