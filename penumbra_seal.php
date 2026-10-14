<?php
// penumbra_seal.php - seal a secret value for penumbra_config.php (CLI-only).
//
// Config secrets are AES-256-GCM sealed as enc:v1:base64(iv[12]|tag[16]|ct) with the
// 32-byte key at C:/inetpub/penumbra_config.key (decrypted by the $dec() helper at the
// top of penumbra_config.php). This tool prints the sealed string for a new/changed
// secret. The plaintext is read from STDIN so it never lands in shell history.
//
// On the server:
//   php.exe penumbra_seal.php              (type/paste value, Enter, Ctrl+Z, Enter)
//
// From a workstation over the admin shares (extension_dir MUST use forward slashes -
// the backslash UNC form fails to load the DLLs):
//   & "\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe" -n `
//     -d 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext' -d extension=openssl `
//     "\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_seal.php" `
//     -k "//oitras.oit.ncsu.edu/c$/inetpub/penumbra_config.key"
//
// After sealing, paste the printed enc:v1:... string into penumbra_config.php as
// $dec('enc:v1:...') and re-apply the hardened ACL if your editor recreated the file.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
$opt = getopt('k:');
$keyPath = isset($opt['k']) ? $opt['k'] : 'C:/inetpub/penumbra_config.key';
$key = @file_get_contents($keyPath);
if ($key === false || strlen($key) !== 32) { fwrite(STDERR, "key unreadable: $keyPath\n"); exit(1); }
fwrite(STDERR, "Enter the secret, press Enter, then EOF (Ctrl+Z then Enter on Windows):\n");
$pt = stream_get_contents(STDIN);
if ($pt === false) { fwrite(STDERR, "no input\n"); exit(1); }
$pt = rtrim($pt, "\r\n");
if ($pt === '') { fwrite(STDERR, "empty input\n"); exit(1); }
$iv = random_bytes(12);
$tag = '';
$ct = openssl_encrypt($pt, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
if ($ct === false) { fwrite(STDERR, "encrypt failed\n"); exit(1); }
echo 'enc:v1:' . base64_encode($iv . $tag . $ct) . PHP_EOL;
