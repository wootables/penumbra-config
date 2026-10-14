<?php
/**
 * Extract every TOP-LEVEL function definition from a PHP file into a standalone
 * include, so engine C can be exercised without running schedule_runner.php's
 * main loop (which would connect to Oracle and start firing scheduled tasks).
 *
 * Uses token_get_all() rather than brace counting: braces inside strings/comments
 * are single tokens, so nesting can't be miscounted (schedule_runner.php is full
 * of HTML/CSS string literals containing { }).
 *
 * Each function is wrapped in if (!function_exists()) so the harness can override
 * any of them with a stub.
 */
if ($argc < 3) { fwrite(STDERR, "usage: php extract_engine_c.php <source.php> <out.php>\n"); exit(1); }
$src = file_get_contents($argv[1]);
if ($src === false) { fwrite(STDERR, "cannot read {$argv[1]}\n"); exit(1); }

$tokens = token_get_all($src);
$out = array();
$names = array();
$n = count($tokens);
$i = 0;

// No brace-depth tracking: every named function is captured and its body then
// SKIPPED wholesale, so nested/inner code can never confuse the scan. (Depth
// tracking drifted and found only 18 of ~214.)
while ($i < $n) {
    $t = $tokens[$i];
    if (is_array($t) && $t[0] === T_FUNCTION) {
        // Look ahead for a NAME (skip whitespace / & by-ref). An anonymous
        // function (T_FUNCTION followed by '(') is an expression, not a decl.
        $j = $i + 1;
        while ($j < $n && ((is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) || $tokens[$j] === '&')) $j++;
        if ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
            $fname = $tokens[$j][1];
            // Capture raw text from 'function' to the matching closing brace.
            $start = $i;
            $k = $j;
            $braces = 0;
            $started = false;
            $buf = '';
            while ($k < $n) {
                $tk = $tokens[$k];
                $txt = is_array($tk) ? $tk[1] : $tk;
                $buf .= $txt;
                // String interpolation "{$x}" / "${x}" opens with an ARRAY token
                // (T_CURLY_OPEN) but closes with a PLAIN '}'. Counting only plain
                // '{' therefore went negative and truncated functions mid-string.
                if ($tk === '{') { $braces++; $started = true; }
                elseif (is_array($tk) && ($tk[0] === T_CURLY_OPEN || $tk[0] === T_DOLLAR_OPEN_CURLY_BRACES)) { $braces++; }
                elseif ($tk === '}') { $braces--; if ($started && $braces === 0) break; }
                elseif ($tk === ';' && !$started) { break; } // abstract/interface decl
                $k++;
            }
            // Rebuild including the 'function' keyword and any & / whitespace
            $head = '';
            for ($m = $start; $m < $j; $m++) { $head .= is_array($tokens[$m]) ? $tokens[$m][1] : $tokens[$m]; }
            $body = $head . $buf;
            $out[]   = "if (!function_exists('" . $fname . "')) {\n" . $body . "\n}\n";
            $names[] = $fname;
            $i = $k + 1;
            continue;
        }
    }
    $i++;
}

file_put_contents($argv[2], "<?php\n// AUTO-EXTRACTED from " . basename($argv[1]) . " - do not edit.\n" . implode("\n", $out));
fwrite(STDOUT, "extracted " . count($names) . " functions\n");
file_put_contents($argv[2] . '.names.txt', implode("\n", $names));
