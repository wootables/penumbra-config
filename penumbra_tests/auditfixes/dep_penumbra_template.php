<?php
// AUTO-EXTRACTED from penumbra_template.php - do not edit.
if (!function_exists('penumbra_tpl_allowed_exts')) {
function penumbra_tpl_allowed_exts() {
    return array('txt', 'csv', 'tsv', 'md', 'json', 'xml', 'cstm');
}
}

if (!function_exists('penumbra_tpl_drop_options_error')) {
function penumbra_tpl_drop_options_error($options) {
    if (!is_array($options) || empty($options['drop_format_custom'])) return null;
    $tpl = isset($options['drop_custom_template']) ? (string)$options['drop_custom_template'] : '';
    if (penumbra_tpl_js_trim($tpl) === '') {
        return 'Custom Template is ticked but the row template is empty - an empty template writes a file of blank lines.';
    }
    if (strlen($tpl) > 20000) return 'The custom row template is too long (20,000 characters at most).';
    $hdr = isset($options['drop_custom_header']) ? (string)$options['drop_custom_header'] : '';
    if (strlen($hdr) > 4000) return 'The custom header line is too long (4,000 characters at most).';
    $ext = strtolower(trim(isset($options['drop_custom_ext']) ? (string)$options['drop_custom_ext'] : 'txt'));
    if (!in_array($ext, penumbra_tpl_allowed_exts(), true)) {
        return 'Custom template file type must be one of: .' . implode(', .', penumbra_tpl_allowed_exts()) . '.';
    }
    // Every format of one task shares the filename pattern, so two formats with
    // one extension are one file: the second delivery overwrites the first.
    foreach (array('csv' => 'drop_format_csv', 'json' => 'drop_format_json') as $e => $k) {
        if ($ext === $e && !empty($options[$k])) {
            return 'The custom template file type .' . $e . ' collides with the ' . strtoupper($e)
                 . ' format - both would be written to the same filename. Pick another file type or untick ' . strtoupper($e) . '.';
        }
    }
    return null;
}
}

if (!function_exists('penumbra_tpl_js_trim')) {
function penumbra_tpl_js_trim($s, $side = 0) {
    $s = (string)$s;
    $n = strlen($s);
    if ($n === 0) return '';
    $f = ord($s[0]);
    $l = ord($s[$n - 1]);
    // Printable ASCII at both ends: nothing to strip (the per-cell fast path).
    if ($f > 0x20 && $f < 0x80 && $l > 0x20 && $l < 0x80) return $s;
    $rx = ($side === 1) ? '/^[\s\x{FEFF}]+/u'
        : (($side === 2) ? '/[\s\x{FEFF}]+\z/u' : '/^[\s\x{FEFF}]+|[\s\x{FEFF}]+\z/u');
    $r = @preg_replace($rx, '', $s);
    if ($r === null) { // not valid UTF-8: the ASCII set only, and never NUL
        $ascii = " \t\n\r\x0B\x0C";
        return ($side === 1) ? ltrim($s, $ascii) : (($side === 2) ? rtrim($s, $ascii) : trim($s, $ascii));
    }
    return $r;
}
}

if (!function_exists('penumbra_tpl_upper')) {
function penumbra_tpl_upper($s) {
    $s = (string)$s;
    return function_exists('mb_strtoupper') ? mb_strtoupper($s, 'UTF-8') : strtoupper($s);
}
}

if (!function_exists('penumbra_tpl_parse_call')) {
function penumbra_tpl_parse_call($str, $start, $fn = 'string') {
    $len = strlen($str);
    $i = $start + strlen($fn) + 1; // past 'fnname('
    $rawArgs = array();
    $current = '';
    $depth = 0;
    $quote = null;
    while ($i < $len) {
        $ch = $str[$i];
        if ($quote !== null) {
            $current .= $ch;
            if ($ch === $quote) $quote = null;
            $i++;
            continue;
        }
        if ($ch === "'" || $ch === '"') { $quote = $ch; $current .= $ch; $i++; continue; }
        if ($ch === '(') { $depth++; $current .= $ch; $i++; continue; }
        if ($ch === ')') {
            if ($depth === 0) {
                $rawArgs[] = $current;
                $i++;
                // calc(): the first arg is an EXPRESSION, parsed once here; args holds the rest.
                if ($fn === 'calc') {
                    $args = array();
                    foreach (array_slice($rawArgs, 1) as $ra) $args[] = penumbra_tpl_classify_arg($ra);
                    return array(
                        'node' => array('type' => 'call', 'fn' => $fn, 'expr' => penumbra_tpl_calc_parse($rawArgs[0]),
                                        'args' => $args, 'raw' => substr($str, $start, $i - $start)),
                        'end'  => $i
                    );
                }
                $args = array();
                foreach ($rawArgs as $ra) $args[] = penumbra_tpl_classify_arg($ra);
                return array(
                    'node' => array('type' => 'call', 'fn' => $fn, 'args' => $args, 'raw' => substr($str, $start, $i - $start)),
                    'end'  => $i
                );
            }
            $depth--; $current .= $ch; $i++;
            continue;
        }
        if ($ch === ',' && $depth === 0) { $rawArgs[] = $current; $current = ''; $i++; continue; }
        $current .= $ch;
        $i++;
    }
    return null; // ran out of input - unbalanced call
}
}

if (!function_exists('penumbra_tpl_classify_arg')) {
function penumbra_tpl_classify_arg($raw) {
    $t = penumbra_tpl_js_trim($raw);
    if ($t === '') return array('type' => 'literal', 'value' => '', 'raw' => $raw);
    $n = strlen($t);
    $q = $t[0];
    if (($q === "'" || $q === '"') && $n >= 2 && $t[$n - 1] === $q) {
        return array('type' => 'literal', 'value' => substr($t, 1, -1), 'raw' => $t);
    }
    // \z, not $: a PHP $ also matches before a trailing newline, a JS $ does not.
    if (preg_match('/^\{[^}]+\}\z/', $t)) {
        return array('type' => 'ref', 'name' => substr($t, 1, -1), 'raw' => $t);
    }
    if (preg_match('/^(string|data|calc)\(/', $t, $m)) {
        $sub = penumbra_tpl_parse_call($t, 0, $m[1]);
        if ($sub && $sub['end'] === $n) return $sub['node'];
        return array('type' => 'literal', 'value' => $t, 'raw' => $t);
    }
    if (preg_match('/^-?\d+(\.\d+)?\z/', $t)) {
        return array('type' => 'literal', 'value' => $t, 'raw' => $t);
    }
    return array('type' => 'ref', 'name' => $t, 'raw' => $t, 'bare' => true);
}
}

if (!function_exists('penumbra_tpl_next_call_token')) {
function penumbra_tpl_next_call_token($str, $from) {
    if ($from > strlen($str)) return null;
    $best = null;
    foreach (array('string', 'data', 'calc') as $fn) {
        $tok = $fn . '(';
        $i = strpos($str, $tok, $from);
        while ($i !== false) {
            if ($i === 0 || !preg_match('/[A-Za-z0-9_$]/', $str[$i - 1])) {
                if ($best === null || $i < $best['idx']) $best = array('idx' => $i, 'fn' => $fn);
                break;
            }
            $i = strpos($str, $tok, $i + strlen($tok));
        }
    }
    return $best;
}
}

if (!function_exists('penumbra_tpl_parse')) {
function penumbra_tpl_parse($template) {
    $str = (string)$template;
    $len = strlen($str);
    $segments = array();
    $pos = 0;
    $textStart = 0;
    while ($pos < $len) {
        $hit = penumbra_tpl_next_call_token($str, $pos);
        if (!$hit) break;
        $parsed = penumbra_tpl_parse_call($str, $hit['idx'], $hit['fn']);
        if (!$parsed) { // unbalanced - leave the text verbatim
            $pos = $hit['idx'] + strlen($hit['fn']) + 1;
            continue;
        }
        if ($hit['idx'] > $textStart) {
            $segments[] = array('type' => 'text', 'value' => substr($str, $textStart, $hit['idx'] - $textStart));
        }
        $segments[] = $parsed['node'];
        $pos = $textStart = $parsed['end'];
    }
    if ($textStart < $len || count($segments) === 0) {
        $segments[] = array('type' => 'text', 'value' => (string)substr($str, $textStart));
    }
    return $segments;
}
}

if (!function_exists('penumbra_tpl_has_calls')) {
function penumbra_tpl_has_calls($segments) {
    foreach ((array)$segments as $s) { if ($s['type'] === 'call') return true; }
    return false;
}
}

if (!function_exists('penumbra_tpl_collect_refs')) {
function penumbra_tpl_collect_refs($segments) {
    $out = array();
    $walk = null;
    $walkCalc = function ($ast) use (&$walk, &$walkCalc, &$out) {
        if (!$ast) return;
        if ($ast['k'] === 'col') $out[] = penumbra_tpl_upper($ast['n']);
        elseif ($ast['k'] === 'call') $walk($ast['node'], false);
        $walkCalc(isset($ast['a']) ? $ast['a'] : null);
        $walkCalc(isset($ast['b']) ? $ast['b'] : null);
    };
    $walk = function ($node, $isOpName) use (&$walk, &$walkCalc, &$out) {
        if (!$node) return;
        if ($node['type'] === 'ref' && !$isOpName) $out[] = penumbra_tpl_upper($node['name']);
        if ($node['type'] === 'call' && $node['fn'] === 'calc') {
            if (isset($node['expr']['ast'])) $walkCalc($node['expr']['ast']);
            foreach ($node['args'] as $a) $walk($a, false);
            return;
        }
        if ($node['type'] === 'call' && !empty($node['args'])) {
            if ($node['fn'] === 'data') return; // data() args are keys, not column refs
            foreach ($node['args'] as $idx => $a) $walk($a, $idx === 0);
        }
    };
    foreach ((array)$segments as $s) { if ($s['type'] === 'call') $walk($s, false); }
    return $out;
}
}

if (!function_exists('penumbra_tpl_eval_node')) {
function penumbra_tpl_eval_node($node, $resolveRef, $resolveData) {
    if (!$node) return '';
    if ($node['type'] === 'literal') return $node['value'];
    if ($node['type'] === 'ref') {
        $v = $resolveRef ? call_user_func($resolveRef, $node['name']) : null;
        return ($v === null) ? $node['raw'] : (string)$v;
    }
    if ($node['fn'] === 'calc') return penumbra_tpl_calc_eval_call($node, $resolveRef, $resolveData);
    $args = isset($node['args']) ? $node['args'] : array();
    if ($node['fn'] === 'data') {
        if (!$resolveData) return $node['raw'];
        // data() args are key text, never column refs.
        $argVals = array();
        foreach ($args as $n) {
            if ($n['type'] === 'literal') $argVals[] = $n['value'];
            elseif ($n['type'] === 'ref') $argVals[] = $n['name'];
            else $argVals[] = (string)penumbra_tpl_eval_node($n, $resolveRef, $resolveData);
        }
        try {
            return (string)call_user_func($resolveData, $argVals);
        } catch (\Throwable $e) {
            return $node['raw'];
        }
    }
    if (count($args) < 2) return '[Error: string requires a type and a subject]';
    // The op name is taken as written - never resolved as a column ref (a column
    // literally named REPLACE must not hijack it).
    $opNode = $args[0];
    if ($opNode['type'] === 'literal') {
        $opName = $opNode['value'];
    } else {
        $opName = (isset($opNode['name']) && $opNode['name'] !== '') ? $opNode['name']
                : (isset($opNode['raw']) ? $opNode['raw'] : '');
    }
    $call = array($opName, (string)penumbra_tpl_eval_node($args[1], $resolveRef, $resolveData));
    for ($i = 2; $i < count($args); $i++) {
        $call[] = (string)penumbra_tpl_eval_node($args[$i], $resolveRef, $resolveData);
    }
    // The shared PHP twin of PenumbraTemplate.stringOp. Errors come back already
    // bracketed ("[Error: ...]"), which is what the browser prints for them.
    return (string)_snippet_string($call);
}
}

if (!function_exists('penumbra_tpl_calc_num')) {
function penumbra_tpl_calc_num($v) {
    if ($v === null) return null;
    $s = penumbra_tpl_js_trim((string)$v);
    if ($s === '') return null;
    $neg = ($s[0] === '(' && substr($s, -1) === ')');
    $c = penumbra_tpl_js_trim(preg_replace('/[$,()%\x02]/', '', $s));
    if (!preg_match('/^[-+]?(\d+(\.\d*)?|\.\d+)\z/', $c)) return null;
    $n = (float)$c;
    if (!is_finite($n)) return null;
    return $neg ? -$n : $n;
}
}

if (!function_exists('penumbra_tpl_calc_char_name')) {
function penumbra_tpl_calc_char_name($ch) {
    return preg_match('/^[\x21-\x7e]\z/', $ch) ? '"' . $ch . '"' : 'a character';
}
}

if (!function_exists('penumbra_tpl_calc_parse')) {
function penumbra_tpl_calc_parse($src) {
    $s = (string)$src;
    $n = strlen($s);
    $tk = array();
    $i = 0;
    while ($i < $n) {
        $ch = $s[$i];
        if ($ch === ' ' || $ch === "\t" || $ch === "\n" || $ch === "\r") { $i++; continue; }
        if ($ch === '{') {
            $j = strpos($s, '}', $i + 1);
            if ($j === false) return array('error' => 'a column name is missing its closing }');
            $nm = substr($s, $i + 1, $j - $i - 1);
            if (penumbra_tpl_js_trim($nm) === '') return array('error' => 'empty braces {} - put a column name inside');
            $tk[] = array('t' => 'col', 'v' => $nm, 'raw' => substr($s, $i, $j - $i + 1)); $i = $j + 1; continue;
        }
        if ($ch === "'" || $ch === '"') {
            $k = strpos($s, $ch, $i + 1);
            if ($k === false) return array('error' => 'quoted text is missing its closing ' . $ch);
            $tk[] = array('t' => 'str', 'v' => substr($s, $i + 1, $k - $i - 1), 'raw' => substr($s, $i, $k - $i + 1)); $i = $k + 1; continue;
        }
        if (preg_match('/\G(\d+(\.\d*)?|\.\d+)/', $s, $m, 0, $i)) {
            $tk[] = array('t' => 'num', 'v' => $m[0], 'raw' => $m[0]); $i += strlen($m[0]); continue;
        }
        if (preg_match('/\G[A-Za-z_][A-Za-z0-9_]*/', $s, $m, 0, $i)) {
            $w = $m[0];
            if (($w === 'string' || $w === 'data' || $w === 'calc') && $i + strlen($w) < $n && $s[$i + strlen($w)] === '(') {
                $sub = penumbra_tpl_parse_call($s, $i, $w);
                if (!$sub) return array('error' => $w . '( is missing its closing )');
                $tk[] = array('t' => 'call', 'node' => $sub['node'], 'raw' => $sub['node']['raw']); $i = $sub['end']; continue;
            }
            return array('error' => 'unknown word "' . $w . '" - write a column in braces: {' . $w . '}');
        }
        if (strpos('+-*/()', $ch) !== false) { $tk[] = array('t' => 'op', 'v' => $ch, 'raw' => $ch); $i++; continue; }
        return array('error' => penumbra_tpl_calc_char_name($ch) . ' is not part of a calculation');
    }
    if (!count($tk)) return array('error' => 'nothing to work out - e.g. calc({A} - {B})');
    $st = array('tk' => $tk, 'p' => 0, 'depth' => 0);
    try {
        $ast = penumbra_tpl_calc_add($st);
        if ($st['p'] < count($tk)) {
            $r = $tk[$st['p']];
            if ($r['t'] === 'op') throw new \DomainException('unexpected ' . $r['raw']);
            throw new \DomainException('an operator is missing before ' . $r['raw']);
        }
        return array('ast' => $ast);
    } catch (\DomainException $e) {
        return array('error' => $e->getMessage());
    }
}
}

if (!function_exists('penumbra_tpl_calc_is_op')) {
function penumbra_tpl_calc_is_op($st, $v) {
    $t = isset($st['tk'][$st['p']]) ? $st['tk'][$st['p']] : null;
    return $t !== null && $t['t'] === 'op' && $t['v'] === $v;
}
}

if (!function_exists('penumbra_tpl_calc_primary')) {
function penumbra_tpl_calc_primary(&$st) {
    $t = isset($st['tk'][$st['p']]) ? $st['tk'][$st['p']] : null;
    if ($t === null) throw new \DomainException('it ends too soon - a value is missing at the end');
    if ($t['t'] === 'num')  { $st['p']++; return array('k' => 'num', 'v' => $t['v']); }
    if ($t['t'] === 'col')  { $st['p']++; return array('k' => 'col', 'n' => $t['v']); }
    if ($t['t'] === 'str')  { $st['p']++; return array('k' => 'str', 'v' => $t['v']); }
    if ($t['t'] === 'call') { $st['p']++; return array('k' => 'call', 'node' => $t['node']); }
    if (penumbra_tpl_calc_is_op($st, '(')) {
        $st['p']++;
        $e = penumbra_tpl_calc_add($st);
        if (!penumbra_tpl_calc_is_op($st, ')')) throw new \DomainException('a ( is missing its closing )');
        $st['p']++;
        return $e;
    }
    throw new \DomainException('unexpected ' . $t['raw']);
}
}

if (!function_exists('penumbra_tpl_calc_unary')) {
function penumbra_tpl_calc_unary(&$st) {
    if (++$st['depth'] > 100) throw new \DomainException('more than 100 ( or signs nested');
    try {
        if (penumbra_tpl_calc_is_op($st, '-')) { $st['p']++; return array('k' => 'neg', 'a' => penumbra_tpl_calc_unary($st)); }
        if (penumbra_tpl_calc_is_op($st, '+')) { $st['p']++; return penumbra_tpl_calc_unary($st); }
        return penumbra_tpl_calc_primary($st);
    } finally { $st['depth']--; }
}
}

if (!function_exists('penumbra_tpl_calc_mul')) {
function penumbra_tpl_calc_mul(&$st) {
    $a = penumbra_tpl_calc_unary($st);
    while (penumbra_tpl_calc_is_op($st, '*') || penumbra_tpl_calc_is_op($st, '/')) {
        $op = $st['tk'][$st['p']++]['v'];
        $a = array('k' => 'bin', 'op' => $op, 'a' => $a, 'b' => penumbra_tpl_calc_unary($st));
    }
    return $a;
}
}

if (!function_exists('penumbra_tpl_calc_add')) {
function penumbra_tpl_calc_add(&$st) {
    $a = penumbra_tpl_calc_mul($st);
    while (penumbra_tpl_calc_is_op($st, '+') || penumbra_tpl_calc_is_op($st, '-')) {
        $op = $st['tk'][$st['p']++]['v'];
        $a = array('k' => 'bin', 'op' => $op, 'a' => $a, 'b' => penumbra_tpl_calc_mul($st));
    }
    return $a;
}
}

if (!function_exists('penumbra_tpl_calc_value')) {
function penumbra_tpl_calc_value($ast, $resolveRef, $resolveData) {
    switch ($ast['k']) {
        case 'num': return (float)$ast['v'];
        case 'str': return penumbra_tpl_calc_num($ast['v']);
        case 'col':
            $v = $resolveRef ? call_user_func($resolveRef, $ast['n']) : null;
            if ($v === null) throw new \UnexpectedValueException('[Error: calc: unknown column {' . $ast['n'] . '}]');
            return penumbra_tpl_calc_num($v);
        case 'call':
            $t = (string)penumbra_tpl_eval_node($ast['node'], $resolveRef, $resolveData);
            if (strpos($t, '[Error: ') === 0) throw new \UnexpectedValueException($t);
            return penumbra_tpl_calc_num($t);
        case 'neg':
            $x = penumbra_tpl_calc_value($ast['a'], $resolveRef, $resolveData);
            return ($x === null) ? null : -$x;
    }
    // bin - both sides are worked out, so an error on either side shows
    $a = penumbra_tpl_calc_value($ast['a'], $resolveRef, $resolveData);
    $b = penumbra_tpl_calc_value($ast['b'], $resolveRef, $resolveData);
    if ($a === null || $b === null) return null;
    if ($ast['op'] === '+') $r = $a + $b;
    elseif ($ast['op'] === '-') $r = $a - $b;
    elseif ($ast['op'] === '*') $r = $a * $b;
    else { if ($b == 0) return null; $r = $a / $b; }
    return is_finite($r) ? (float)$r : null;
}
}

if (!function_exists('penumbra_tpl_calc_digits')) {
function penumbra_tpl_calc_digits($a) {
    $s = '0e+0';
    for ($p = 0; $p <= 16; $p++) {
        $s = str_replace(',', '.', sprintf('%.' . $p . 'e', $a));
        if ((float)$s === $a) break;
    }
    preg_match('/^(\d)(?:\.(\d+))?e([+-]?\d+)\z/', $s, $m);
    $d = rtrim($m[1] . (isset($m[2]) ? $m[2] : ''), '0');
    return array($d === '' ? '0' : $d, (int)$m[3]);
}
}

if (!function_exists('penumbra_tpl_calc_increment')) {
function penumbra_tpl_calc_increment($s) {
    $i = strlen($s) - 1;
    while ($i >= 0) {
        if ($s[$i] === '9') { $s[$i] = '0'; $i--; } else { $s[$i] = chr(ord($s[$i]) + 1); return $s; }
    }
    return '1' . $s;
}
}

if (!function_exists('penumbra_tpl_calc_format')) {
function penumbra_tpl_calc_format($v, $places) {
    if ($v === null) return '';
    list($d, $e) = penumbra_tpl_calc_digits(abs($v));
    $q = ($places === null) ? 6 : $places;
    if ($d !== '0' && $e >= 0) $q = max(0, min($q, 15 - ($e + 1)));
    $k = $e + $q + 1;
    $up = false;
    if ($k >= strlen($d)) $sc = $d . str_repeat('0', $k - strlen($d));
    elseif ($k <= 0) { $sc = '0'; $up = ($k === 0 && $d[0] >= '5'); }
    else { $sc = substr($d, 0, $k); $up = ($d[$k] >= '5'); }
    if ($up) $sc = penumbra_tpl_calc_increment($sc);
    $sc = preg_replace('/^0+(?=\d)/', '', $sc);
    while (strlen($sc) < $q + 1) $sc = '0' . $sc;
    $ip = substr($sc, 0, strlen($sc) - $q);
    $fp = (string)substr($sc, strlen($sc) - $q);
    if ($places === null) $fp = rtrim($fp, '0');
    else while (strlen($fp) < $places) $fp .= '0';
    $out = $ip . ($fp !== '' ? '.' . $fp : '');
    return ($v < 0 && preg_match('/[1-9]/', $out)) ? '-' . $out : $out;
}
}

if (!function_exists('penumbra_tpl_calc_eval_call')) {
function penumbra_tpl_calc_eval_call($node, $resolveRef, $resolveData) {
    if (isset($node['expr']['error'])) return '[Error: calc: ' . $node['expr']['error'] . ']';
    $args = isset($node['args']) ? $node['args'] : array();
    if (count($args) > 1) return '[Error: calc takes an expression and, optionally, the decimal places]';
    $places = null;
    if (count($args) === 1) {
        $pt = penumbra_tpl_js_trim((string)penumbra_tpl_eval_node($args[0], $resolveRef, $resolveData));
        if (!preg_match('/^\d+\z/', $pt) || (int)$pt > 10) return '[Error: calc: decimal places must be a whole number from 0 to 10]';
        $places = (int)$pt;
    }
    try {
        return penumbra_tpl_calc_format(penumbra_tpl_calc_value($node['expr']['ast'], $resolveRef, $resolveData), $places);
    } catch (\UnexpectedValueException $e) {
        return $e->getMessage();
    }
}
}

if (!function_exists('penumbra_tpl_resolve_data')) {
function penumbra_tpl_resolve_data($argVals, $ctx) {
    $key = isset($argVals[0]) ? (string)$argVals[0] : '';
    if ($key === '') $key = 'search'; // the browser's default key
    $key = penumbra_tpl_js_trim(strtolower($key));
    switch ($key) {
        case 'title':     return isset($ctx['title']) ? (string)$ctx['title'] : '';
        case 'count':     return isset($ctx['count']) ? (string)$ctx['count'] : '0';
        case 'timestamp': return isset($ctx['timestamp']) ? (string)$ctx['timestamp'] : '';
        case 'url':       return isset($ctx['url']) ? (string)$ctx['url'] : '';
    }
    if (!function_exists('_snippet_data')) return '';
    $v = _snippet_data(array($key),
        (isset($ctx['promptValues']) && is_array($ctx['promptValues'])) ? $ctx['promptValues'] : array(),
        (isset($ctx['reportMeta']) && is_array($ctx['reportMeta'])) ? $ctx['reportMeta'] : array());
    // \x02 guards are engine C's number-pass armor, not content.
    return str_replace("\x02", '', (string)$v);
}
}

if (!function_exists('penumbra_tpl_cell_text')) {
function penumbra_tpl_cell_text($cell) {
    if ($cell === null) return '';
    if (is_bool($cell)) return $cell ? 'true' : 'false';
    if (!is_string($cell)) return is_scalar($cell) ? (string)$cell : '';
    if ($cell === '') return '';
    // Line ends, as the browser's template reads the cell (_readTemplateCellText, main.js): a cell keeps its line
    // breaks (2026-10-10, the user: "do it as-shown with a real newline if a newline is in the cell (not wrapping)" -
    // they reached a template glued, "line1\nline2" as "line1line2"). \r\n and a lone \r are \n, as the HTML parser
    // makes them; an @@HTML cell's <br> (and </br>, which the parser reads as one) is a line break, and a \n right
    // before it is the \r\n it ended. tplparity pins both sides, so changing one means changing both. A template puts
    // a field back on one line with string(regex_replace, {COL}, '\s*\n\s*', ' ').
    if (strpos($cell, "\r") !== false) $cell = str_replace(array("\r\n", "\r"), "\n", $cell);
    if (strpos($cell, '@@HTML') === 0 && stripos($cell, 'br') !== false) {
        $cell = preg_replace('~\n?</?br\b[^>]*>~i', "\n", $cell);
    }
    if (function_exists('db_dump_clean_value')) {
        $v = db_dump_clean_value($cell);
    } elseif (strpos($cell, '@@HTML') === 0) {
        $v = html_entity_decode(strip_tags(substr($cell, 6)), ENT_QUOTES, 'UTF-8');
    } else {
        $v = (strpos($cell, '&') !== false) ? html_entity_decode($cell, ENT_QUOTES, 'UTF-8') : $cell;
    }
    return penumbra_tpl_js_trim((string)$v);
}
}

if (!function_exists('penumbra_tpl_nested_raw')) {
function penumbra_tpl_nested_raw($cell) {
    if (!is_string($cell)) return null;
    $i = strpos($cell, '@@JSON');
    return ($i === false) ? null : (string)substr($cell, $i + 6);
}
}

if (!function_exists('penumbra_tpl_nested_array')) {
function penumbra_tpl_nested_array($cell) {
    $raw = penumbra_tpl_nested_raw($cell);
    if ($raw === null) return null;
    $p = json_decode($raw, true);
    if (!is_array($p) || count($p) === 0) return null;
    if (array_keys($p) !== range(0, count($p) - 1)) return null; // a JSON object, not an array
    return is_array($p[0]) ? $p : null;
}
}

if (!function_exists('penumbra_tpl_nested_value')) {
function penumbra_tpl_nested_value($v) {
    if ($v === null) return '';
    if (is_bool($v)) return $v ? 'true' : 'false';
    if (is_array($v)) {
        $j = json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return ($j === false) ? '' : $j;
    }
    $sv = (string)$v;
    if (substr($sv, 0, 6) === '@@HTML') {
        $sv = penumbra_tpl_js_trim(preg_replace('/<[^>]*>/', '', substr($sv, 6)));
    }
    return $sv;
}
}

if (!function_exists('penumbra_tpl_flatten_groups')) {
function penumbra_tpl_flatten_groups($grouped, $onlyKeys = null) {
    $rows = array();
    if (!is_array($grouped)) return $rows;
    foreach ($grouped as $gKey => $group) {
        if ($onlyKeys !== null && !isset($onlyKeys[(string)$gKey])) continue;
        $gRows = (is_array($group) && isset($group['rows']) && is_array($group['rows'])) ? $group['rows'] : $group;
        if (!is_array($gRows)) continue;
        foreach ($gRows as $r) { if (is_array($r)) $rows[] = $r; }
    }
    return $rows;
}
}

if (!function_exists('penumbra_tpl_flat_source')) {
function penumbra_tpl_flat_source($apiResult) {
    $data = isset($apiResult['data']) ? $apiResult['data'] : array();
    $viewMode = isset($apiResult['viewMode']) ? $apiResult['viewMode'] : 'standard';
    $rows = null;

    // {#}: the app's '#' column is the row's position in QUERY order (it indexes
    // masterRowData) and does not renumber when the table is sorted, so each row
    // is tagged with its rawData position before the sort moves it.
    $NUM = '__PNB_TPL_ROWNUM__';

    if (isset($apiResult['rawData']) && is_array($apiResult['rawData']) && function_exists('apply_state_logic')) {
        $full = array();
        $resolver = isset($apiResult['journalToggleResolver']) ? $apiResult['journalToggleResolver'] : null;
        $toggleCols = (isset($apiResult['journalToggleCols']) && is_array($apiResult['journalToggleCols']))
            ? $apiResult['journalToggleCols'] : array();
        $useToggles = $resolver && function_exists('journalExportToggleRowValues');
        $qn = 0;
        foreach ($apiResult['rawData'] as $_tr) {
            if (!is_array($_tr)) continue;
            $qn++;
            if ($useToggles) {
                foreach (journalExportToggleRowValues($resolver, $_tr) as $tn => $tv) { $_tr[$tn] = $tv; }
            }
            $_tr[$NUM] = $qn;
            $full[] = $_tr;
        }
        $st = $apiResult;
        unset($st['visibleColumns'], $st['columnOrder']);
        $re = apply_state_logic($full, $st, $toggleCols);
        if (isset($re['viewMode']) && $re['viewMode'] === 'grouped') {
            // A group-summary search filter drops whole GROUPS from 'data' but
            // leaves their rows in rawData - keep only the groups that survived.
            $keep = null;
            if ($viewMode === 'grouped' && is_array($data)) {
                $keep = array();
                foreach ($data as $gk => $_g) $keep[(string)$gk] = true;
            }
            $rows = penumbra_tpl_flatten_groups($re['data'], $keep);
        } else {
            $rows = array();
            foreach ((array)$re['data'] as $r) { if (is_array($r)) $rows[] = $r; }
        }
    }
    if ($rows === null) {
        $rows = ($viewMode === 'grouped') ? penumbra_tpl_flatten_groups($data) : array();
        if ($viewMode !== 'grouped') { foreach ((array)$data as $r) { if (is_array($r)) $rows[] = $r; } }
    }

    $rowNums = array();
    foreach ($rows as $i => $r) {
        if (array_key_exists($NUM, $r)) { $rowNums[$i] = (int)$r[$NUM]; unset($rows[$i][$NUM]); }
        else { $rowNums[$i] = $i + 1; }
    }
    $columns = empty($rows) ? array() : array_keys($rows[0]);
    // A renamed toggle's old names (2026-10-08): {Done} reads the column now called Complete
    // (the browser's _jTplAlias), unless the rows have a column of their own by the old name.
    $aliases = array();
    if (function_exists('journalExportAliasMapFor') && isset($apiResult['journalToggleResolver'])) {
        foreach (journalExportAliasMapFor($apiResult['journalToggleResolver'], $columns, true) as $a => $to) {
            $aliases[penumbra_tpl_upper($a)] = penumbra_tpl_upper($to);
        }
    }

    // getNestedColumnPlan(): sub-keys discovered from the first 50 rows.
    $plan = array();
    $sampleMax = min(count($rows), 50);
    foreach ($columns as $name) {
        if ((string)$name === '' || (string)$name === '#') continue;
        $subs = array();
        for ($i = 0; $i < $sampleMax; $i++) {
            $arr = penumbra_tpl_nested_array(isset($rows[$i][$name]) ? $rows[$i][$name] : null);
            if (!$arr) continue;
            foreach ($arr as $item) {
                if (is_array($item)) { foreach (array_keys($item) as $k) $subs[(string)$k] = true; }
            }
        }
        if (!empty($subs)) $plan[] = array('parentName' => (string)$name, 'subNames' => array_map('strval', array_keys($subs)));
    }

    return array('mode' => 'flat', 'columns' => array_map('strval', $columns), 'rows' => $rows,
                 'rowNums' => $rowNums, 'nested' => $plan, 'count' => count($rows), 'aliases' => $aliases);
}
}

if (!function_exists('penumbra_tpl_html_table_grid')) {
function penumbra_tpl_html_table_grid($html) {
    if (!class_exists('DOMDocument')) return null;
    $pos = stripos((string)$html, '<table');
    if ($pos === false) return null;
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    // The XML declaration is what makes libxml read the bytes as UTF-8.
    $ok = $doc->loadHTML('<?xml encoding="UTF-8"?><html><body>' . substr($html, $pos) . '</body></html>',
        LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_COMPACT | LIBXML_PARSEHUGE);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    if (!$ok) return null;
    $table = $doc->getElementsByTagName('table')->item(0);
    if (!$table) return null;

    $sections = array('thead' => array(), 'tbody' => array(), 'tfoot' => array());
    foreach ($table->childNodes as $child) {
        if ($child->nodeType !== XML_ELEMENT_NODE) continue;
        $tag = strtolower($child->nodeName);
        if ($tag === 'tr') { $sections['tbody'][] = $child; continue; }
        if (!isset($sections[$tag])) continue;
        foreach ($child->childNodes as $tr) {
            if ($tr->nodeType === XML_ELEMENT_NODE && strtolower($tr->nodeName) === 'tr') $sections[$tag][] = $tr;
        }
    }
    $all = array_merge($sections['thead'], $sections['tbody'], $sections['tfoot']);

    $mem = array();
    foreach ($all as $ri => $tr) {
        $ci = 0;
        foreach ($tr->childNodes as $cell) {
            if ($cell->nodeType !== XML_ELEMENT_NODE) continue;
            $tag = strtolower($cell->nodeName);
            if ($tag !== 'td' && $tag !== 'th') continue;
            $rs = $cell->getAttribute('rowspan');
            $cs = $cell->getAttribute('colspan');
            $rowspan = ($rs === '') ? 1 : (int)$rs;
            $colspan = ($cs === '') ? 1 : (int)$cs;
            $text = penumbra_tpl_js_trim($cell->textContent);
            // The browser tests the slot's TEXT for truthiness, so a slot held by
            // an EMPTY spanned cell reads as free. Mirrored, quirk and all.
            while (isset($mem[$ri][$ci]) && $mem[$ri][$ci] !== '') $ci++;
            for ($r = 0; $r < $rowspan; $r++) {
                for ($c = 0; $c < $colspan; $c++) $mem[$ri + $r][$ci + $c] = $text;
            }
            $ci += $colspan;
        }
    }
    $grid = array();
    for ($r = 0; isset($mem[$r]); $r++) {
        $row = array();
        for ($c = 0; isset($mem[$r][$c]); $c++) $row[] = $mem[$r][$c];
        $grid[] = $row;
    }
    return array('grid' => $grid, 'head' => count($sections['thead']), 'body' => count($sections['tbody']));
}
}

if (!function_exists('penumbra_tpl_pivot_source')) {
function penumbra_tpl_pivot_source($apiResult, $themeName) {
    if (!function_exists('generate_pivot_html')) return null;
    $flat = isset($apiResult['data']) && is_array($apiResult['data']) ? $apiResult['data'] : array();
    if (empty($flat) || empty($apiResult['pivot'])) return null;
    $html = generate_pivot_html($flat, $apiResult['pivot'], $themeName, false);
    $g = penumbra_tpl_html_table_grid($html);
    if (!$g || $g['head'] < 1 || count($g['grid']) <= $g['head']) return null;

    $headGrid = array_slice($g['grid'], 0, $g['head']);
    $headers = array();
    $width = count($headGrid[0]);
    for ($c = 0; $c < $width; $c++) {
        $parts = array();
        for ($r = 0; $r < count($headGrid); $r++) {
            $t = isset($headGrid[$r][$c]) ? $headGrid[$r][$c] : '';
            $above = ($r > 0 && isset($headGrid[$r - 1][$c])) ? $headGrid[$r - 1][$c] : null;
            if ($t !== '' && ($r === 0 || $t !== $above)) $parts[] = $t;
        }
        $headers[] = implode('-', $parts);
    }
    return array('mode' => 'pivot', 'columns' => $headers, 'rows' => array_slice($g['grid'], $g['head']),
                 'nested' => array(), 'count' => $g['body']);
}
}

if (!function_exists('penumbra_tpl_build_source')) {
function penumbra_tpl_build_source($apiResult, $themeName = 'theme-default') {
    $viewMode = isset($apiResult['viewMode']) ? $apiResult['viewMode'] : 'standard';
    if ($viewMode === 'pivot' && !empty($apiResult['pivot'])) {
        return penumbra_tpl_pivot_source($apiResult, $themeName);
    }
    return penumbra_tpl_flat_source($apiResult);
}
}

if (!function_exists('penumbra_tpl_subst')) {
function penumbra_tpl_subst($txt, $lookup) {
    if (strpos($txt, '{') === false) return $txt;
    return preg_replace_callback('/\{[^}]+\}/', function ($m) use ($lookup) {
        $v = call_user_func($lookup, penumbra_tpl_upper(substr($m[0], 1, -1)));
        return ($v === null) ? $m[0] : $v;
    }, $txt);
}
}

if (!function_exists('penumbra_tpl_render_body')) {
function penumbra_tpl_render_body($template, $source, $resolveData, $budgetSeconds = 180) {
    $lines = array();
    $t0 = microtime(true);
    $segments = penumbra_tpl_parse($template);
    $hasCalls = penumbra_tpl_has_calls($segments);

    $renderWith = function ($lookup) use ($template, $segments, $hasCalls, $resolveData) {
        if (!$hasCalls) return penumbra_tpl_subst($template, $lookup);
        $out = '';
        foreach ($segments as $seg) {
            $out .= ($seg['type'] === 'text')
                ? penumbra_tpl_subst($seg['value'], $lookup)
                : penumbra_tpl_eval_node($seg, function ($name) use ($lookup) {
                      return call_user_func($lookup, penumbra_tpl_upper($name));
                  }, $resolveData);
        }
        return $out;
    };
    $tick = function ($n) use ($t0, $budgetSeconds) {
        if (($n & 0xFF) === 0 && (microtime(true) - $t0) > $budgetSeconds) {
            throw new RuntimeException('custom template render exceeded ' . (int)$budgetSeconds . ' s after ' . $n . ' rows');
        }
    };

    if ($source['mode'] === 'pivot') {
        $index = array(); // UPPER header -> FIRST column index (findIndex)
        foreach ($source['columns'] as $i => $h) {
            $u = penumbra_tpl_upper($h);
            if (!array_key_exists($u, $index)) $index[$u] = $i;
        }
        foreach ($source['rows'] as $n => $row) {
            $tick($n);
            $lines[] = $renderWith(function ($key) use ($index, $row) {
                if (!array_key_exists($key, $index)) return null;
                return isset($row[$index[$key]]) ? (string)$row[$index[$key]] : '';
            });
        }
        return $lines;
    }

    // Flat / grouped, with nested {Parent-Sub} parallel-zip expansion.
    $plan = $source['nested'];
    $nestedKeys = array();     // UPPER "PARENT-SUB" -> parentName
    $parentByUpper = array();  // UPPER parent -> plan entry
    foreach ($plan as $p) {
        $parentByUpper[penumbra_tpl_upper($p['parentName'])] = $p;
        foreach ($p['subNames'] as $sub) $nestedKeys[penumbra_tpl_upper($p['parentName'] . '-' . $sub)] = $p['parentName'];
    }
    $referenced = array();     // parentName -> plan entry, in template order
    if (!empty($nestedKeys)) {
        $used = array();
        if (preg_match_all('/\{[^}]+\}/', $template, $mm)) {
            foreach ($mm[0] as $ph) $used[] = penumbra_tpl_upper(substr($ph, 1, -1));
        }
        if ($hasCalls) { foreach (penumbra_tpl_collect_refs($segments) as $r) $used[] = $r; }
        foreach ($used as $ph) {
            if (array_key_exists($ph, $nestedKeys) && !isset($referenced[$nestedKeys[$ph]])) {
                $referenced[$nestedKeys[$ph]] = $parentByUpper[penumbra_tpl_upper($nestedKeys[$ph])];
            }
        }
    }

    foreach ($source['rows'] as $n => $row) {
        $tick($n);
        $plain = array('#' => (string)(isset($source['rowNums'][$n]) ? $source['rowNums'][$n] : $n + 1));
        foreach ($source['columns'] as $name) {
            $u = penumbra_tpl_upper($name);
            $cell = array_key_exists($name, $row) ? $row[$name] : null;
            if (isset($parentByUpper[$u])) {
                // A bare {Parent} on a nested column emits its raw JSON text.
                $rawText = penumbra_tpl_nested_raw($cell);
                $plain[$u] = ($rawText !== null) ? $rawText : '';
            } else {
                $plain[$u] = penumbra_tpl_cell_text($cell);
            }
        }
        if (!empty($source['aliases'])) {   // a renamed toggle's old names (2026-10-08)
            foreach ($source['aliases'] as $a => $to) {
                if (!array_key_exists($a, $plain) && array_key_exists($to, $plain)) $plain[$a] = $plain[$to];
            }
        }
        $mk = function ($extra) use ($plain, $nestedKeys) {
            return function ($key) use ($extra, $plain, $nestedKeys) {
                if ($extra !== null && array_key_exists($key, $extra)) return $extra[$key];
                if (array_key_exists($key, $plain)) return $plain[$key];
                if (array_key_exists($key, $nestedKeys)) return ''; // known nested placeholder, no data this row
                return null;
            };
        };

        if (empty($referenced)) { $lines[] = $renderWith($mk(null)); continue; }

        $subRows = array();
        $maxRows = 0;
        foreach ($referenced as $pName => $entry) {
            $arr = penumbra_tpl_nested_array(array_key_exists($pName, $row) ? $row[$pName] : null);
            $list = array();
            if ($arr) {
                foreach ($arr as $item) {
                    if (!is_array($item)) continue;
                    $m = array();
                    foreach ($entry['subNames'] as $sub) {
                        $m[penumbra_tpl_upper($pName . '-' . $sub)] =
                            array_key_exists($sub, $item) ? penumbra_tpl_nested_value($item[$sub]) : '';
                    }
                    $list[] = $m;
                }
            }
            $subRows[$pName] = $list;
            if (count($list) > $maxRows) $maxRows = count($list);
        }
        if ($maxRows === 0) { $lines[] = $renderWith($mk(array())); continue; }
        for ($ni = 0; $ni < $maxRows; $ni++) {
            $extra = array();
            foreach ($referenced as $pName => $entry) {
                $subMap = isset($subRows[$pName][$ni]) ? $subRows[$pName][$ni] : null;
                foreach ($entry['subNames'] as $sub) {
                    $k = penumbra_tpl_upper($pName . '-' . $sub);
                    $extra[$k] = ($subMap !== null && isset($subMap[$k])) ? $subMap[$k] : '';
                }
            }
            $lines[] = $renderWith($mk($extra));
        }
    }
    return $lines;
}
}

if (!function_exists('penumbra_tpl_unescape')) {
function penumbra_tpl_unescape($s) {
    return preg_replace_callback('/\\\\([\\\\tn])/', function ($m) {
        return ($m[1] === 't') ? "\t" : (($m[1] === 'n') ? "\n" : $m[0]);
    }, (string)$s);
}
}

if (!function_exists('penumbra_tpl_render_header')) {
function penumbra_tpl_render_header($headerStr, $source, $resolveData) {
    $headerStr = (string)$headerStr;
    if ($headerStr === '') return '';
    $names = array();
    foreach ($source['columns'] as $c) $names[penumbra_tpl_upper($c)] = (string)$c;
    foreach ($source['nested'] as $p) {
        foreach ($p['subNames'] as $sub) $names[penumbra_tpl_upper($p['parentName'] . '-' . $sub)] = $p['parentName'] . '-' . $sub;
    }
    $lookup = function ($key) use ($names) { return array_key_exists($key, $names) ? $names[$key] : null; };
    $out = '';
    foreach (penumbra_tpl_parse($headerStr) as $seg) {
        $out .= ($seg['type'] === 'text')
            ? penumbra_tpl_subst($seg['value'], $lookup)
            : penumbra_tpl_eval_node($seg, function ($name) use ($lookup) {
                  return call_user_func($lookup, penumbra_tpl_upper($name));
              }, $resolveData);
    }
    return $out;
}
}

if (!function_exists('generate_custom_template_string')) {
function generate_custom_template_string($apiResult, $options, $ctx = array()) {
    $header  = isset($options['drop_custom_header']) ? (string)$options['drop_custom_header'] : '';
    $body    = isset($options['drop_custom_template']) ? (string)$options['drop_custom_template'] : '';
    $newline = !(isset($options['drop_custom_newline']) && $options['drop_custom_newline'] === false);
    $ext     = strtolower(trim(isset($options['drop_custom_ext']) ? (string)$options['drop_custom_ext'] : 'txt'));
    if (!in_array($ext, penumbra_tpl_allowed_exts(), true)) $ext = 'txt';
    if (penumbra_tpl_js_trim($body) === '') return '';

    $source = penumbra_tpl_build_source($apiResult, isset($ctx['themeName']) ? $ctx['themeName'] : 'theme-default');
    if (!$source || empty($source['rows'])) return '';
    $ctx['count'] = $source['count'];
    $resolveData = function ($argVals) use ($ctx) { return penumbra_tpl_resolve_data($argVals, $ctx); };

    // \t / \n escapes become real tabs / line breaks BEFORE parsing, as in the browser.
    $lines = penumbra_tpl_render_body(penumbra_tpl_unescape($body), $source, $resolveData,
        isset($ctx['budget']) ? (int)$ctx['budget'] : 180);
    if (count($lines) === 0) return '';
    $headerLine = penumbra_tpl_render_header(penumbra_tpl_unescape($header), $source, $resolveData);

    $text = implode($newline ? "\n" : '', $lines);
    if ($headerLine !== '') $text = $headerLine . "\n" . $text;
    // UTF-8 BOM on every type but .json, exactly as the browser download: without
    // it Notepad can read a short ASCII file as UTF-16. The JSON spec forbids one.
    return (($ext === 'json') ? '' : "\xEF\xBB\xBF") . $text;
}
}
