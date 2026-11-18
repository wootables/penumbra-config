<?php
// AUTO-EXTRACTED from penumbra_search.php - do not edit.
if (!function_exists('_sr_resolve_keyword_date')) {
function _sr_resolve_keyword_date($raw) {
    $trimVal = trim((string)$raw);
    if ($trimVal === '') return null;
    if (preg_match('/^(?:SYSDATE|NOW|TODAY)(?:\(\))?\s*([+-]\s*\d+)?$/i', $trimVal, $dateMatch)) {
        $dateOffset = isset($dateMatch[1]) ? (int)str_replace(' ', '', $dateMatch[1]) : 0;
        return strtoupper(date('d-M-y', strtotime("{$dateOffset} days")));
    }
    return null;
}
}

if (!function_exists('_sr_resolve_relative_date')) {
function _sr_resolve_relative_date($raw) {
    $trimVal = trim((string)$raw);
    if ($trimVal === '') return null;

    // 1. Strict keywords (TODAY, SYSDATE-7, NOW+1)
    $kw = _sr_resolve_keyword_date($trimVal);
    if ($kw !== null) return $kw;

    // 1b. Fiscal year (NC State: FY runs Jul 1 -> Jun 30, labeled by the calendar
    // year it ENDS). Optional "first|last day of" + a FY reference; with the
    // prefix returns the start/end date, without it the FY number. strtotime has
    // no fiscal concept, so this must run before the natural-language fallback.
    if (preg_match('/^(?:(first|last)\s+day\s+of\s+)?(?:(this|last|next)\s+|(\d+)\s+)?fiscal\s+years?(?:\s+(ago|from\s+now|ahead))?$/i', $trimVal, $fy)) {
        $FY_START_MONTH = 7; // July
        $curY  = (int)date('Y');
        $curMo = (int)date('n');
        $curFYStartYear = ($curMo >= $FY_START_MONTH) ? $curY : $curY - 1;
        $fyRel = 0;
        if (!empty($fy[2])) {
            $fyRel = (strtolower($fy[2]) === 'last') ? -1 : ((strtolower($fy[2]) === 'next') ? 1 : 0);
        } elseif (!empty($fy[3])) {
            $fyN  = (int)$fy[3];
            $fyDir = isset($fy[4]) ? strtolower(trim($fy[4])) : 'ago';
            $fyRel = ($fyDir !== '' && $fyDir !== 'ago') ? $fyN : -$fyN;
        }
        $fyStartYear = $curFYStartYear + $fyRel;
        $fyMode = isset($fy[1]) ? strtolower($fy[1]) : '';
        if ($fyMode === 'first') {
            return strtoupper(date('d-M-y', mktime(0, 0, 0, $FY_START_MONTH, 1, $fyStartYear)));
        } elseif ($fyMode === 'last') {
            return strtoupper(date('d-M-y', mktime(0, 0, 0, $FY_START_MONTH, 0, $fyStartYear + 1)));
        }
        return (string)($fyStartYear + 1);
    }

    // 2. Natural language. Only apply if it is NOT already a hardcoded DD-MON-YY
    // date and NOT a plain number.
    // CRITICAL: do NOT blanket-strtotime every remaining value - a bare word like
    // "MAY"/"FRIDAY" or a surname "May"/"Day" is a legitimate TEXT value that
    // strtotime would silently turn into a date. Only coerce a recognised
    // relative phrase or a value that carries a digit.
    if (!preg_match('/^\d{1,2}-[a-zA-Z]{3}-(\d{2}|\d{4})$/', $trimVal) && !is_numeric($trimVal)) {
        $isRelativeDatePhrase =
               preg_match('/^(?:yesterday|tomorrow)$/i', $trimVal)
            || preg_match('/^(?:first|last)\s+day\s+of\s+(?:last|this|next)\s+(?:month|year|quarter)$/i', $trimVal)
            || preg_match('/^(?:last|next)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i', $trimVal);
        if ($isRelativeDatePhrase || preg_match('/\d/', $trimVal)) {
            // Year/quarter boundaries computed explicitly - strtotime's
            // 'first day of last year' is month arithmetic and 'quarter' is not
            // a relunit at all (the client resolves these via moment startOf/endOf).
            if (preg_match('/^(first|last)\s+day\s+of\s+(last|this|next)\s+(year|quarter)$/i', $trimVal, $fl)) {
                $flEdge = strtolower($fl[1]);
                $flShift = (strtolower($fl[2]) === 'last') ? -1 : ((strtolower($fl[2]) === 'next') ? 1 : 0);
                $flY = (int)date('Y');
                if (strtolower($fl[3]) === 'year') {
                    $flY += $flShift;
                    $flTs = ($flEdge === 'first') ? mktime(0, 0, 0, 1, 1, $flY) : mktime(0, 0, 0, 12, 31, $flY);
                } else {
                    $flQ = (int)(floor(((int)date('n') - 1) / 3) * 3 + 1) + $flShift * 3;
                    if ($flQ < 1) { $flQ += 12; $flY -= 1; }
                    if ($flQ > 12) { $flQ -= 12; $flY += 1; }
                    $flTs = ($flEdge === 'first') ? mktime(0, 0, 0, $flQ, 1, $flY) : mktime(0, 0, 0, $flQ + 3, 0, $flY);
                }
                return strtoupper(date('d-M-y', $flTs));
            }
            // Normalize: strip a trailing "from today"/"from now"
            // (e.g. "3 years ago from today" -> "3 years ago")
            $strtotimeVal = preg_replace('/\s+from\s+(?:today|now)\s*$/i', '', $trimVal);
            $ts = strtotime($strtotimeVal);
            if ($ts !== false) {
                return strtoupper(date('d-M-y', $ts));
            }
        }
    }

    return null;
}
}

if (!function_exists('_sr_empl_id4')) {
function _sr_empl_id4($vars) {
    if (!is_array($vars) || !isset($vars['empl_id'])) return '';
    $id = trim((string)$vars['empl_id']);
    return ($id === '') ? '' : substr($id, -4);
}
}

if (!function_exists('php_parse_search_query')) {
function php_parse_search_query($query, $columns) {
    // "0" is a search (2026-10-09): PHP reads the string "0" as false, and a search for 0 matched every row.
    if ($query === null || $query === false || trim((string)$query) === '') {
        return array();
    }
    // (2026-11-17, trailjoin parity) A joiner left at the end ("AMT > 5 AND") joins nothing: dropped, as the browser's
    // parseAdvancedQuery has done since 2026-11-13 (trailjoin). Here it still read as a condition with no right side,
    // which no row passes - so a filter that showed rows on the page sent an EMPTY scheduled email. Not when the word
    // is a VALUE (STATE = OR): after an operator it is what the column is compared with (orvalue, 2026-11-14).
    $query = (string)$query;
    if (!preg_match('/(?:[=<>]|\b(?:eq|ne|gt|lt|contains))\s+(?:and|or)\s*$/i', $query)) {
        $query = preg_replace('/\s+(?:and|or)\s*$/i', '', $query);
    }
    if (trim($query) === '') { return array(); }

    // --- Operator map (sorted longest-first for matching priority) ---
    // `contains` is a WORD operator (2026-09-23, as in main.js parseAdvancedQuery): it counts
    // only after a column - a bare `contains` stays a search term (fallbacks 3a / 3b below).
    $operators = array(
        'contains' => 'contains',
        '>=' => '>=',
        '=>' => '>=',
        '<=' => '<=',
        '=<' => '<=',
        '!=' => '!=',
        '<>' => '!=',
        '!/' => '!/',
        '==' => '=',
        'eq' => '=',
        'ne' => '!=',
        'gt' => '>',
        'lt' => '<',
        '='  => '=',
        '>'  => '>',
        '<'  => '<'
    );
    $operatorKeys = array_keys($operators);
    // Already sorted longest-first above, but be explicit
    usort($operatorKeys, '_search_sort_by_length_desc');

    // --- Build column map (uppercase key → original name), sorted longest-first ---
    $columnMap = array();
    foreach ($columns as $c) {
        $columnMap[strtoupper($c)] = $c;
    }
    $columnKeys = array_keys($columnMap);
    usort($columnKeys, '_search_sort_by_length_desc');

    // --- Space operators only OUTSIDE protected delimiters ---
    // Regex matches: //exact//, !/regex/flags, /regex/flags, "quoted", 'quoted', or bare operators
    $processedQuery = preg_replace_callback(
        '#(//.*?//|!?/(?:\\\\/|[^/])+/[iI]?|"[^"]*"|\'[^\']*\')|(>=|<=|<>|!=|==|>|<|=)#',
        '_search_space_operators_callback',
        $query
    );

    // --- Tokenize ---
    // Match: {COLUMN}, //exact//, !/regex/, /regex/, "quoted", 'quoted', or non-whitespace
    preg_match_all('#\\{[^}]+\\}|//.*?//|!?/.*?/[iI]?|"[^"]+"|\'[^\']+\'|\\S+#', $processedQuery, $matches);
    $tokens = isset($matches[0]) ? $matches[0] : array();

    // The word operator in any case (`TITLE Contains grant`), like the browser.
    foreach ($tokens as $_wi => $_wt) {
        if (strcasecmp($_wt, 'contains') === 0) $tokens[$_wi] = 'contains';
    }

    // Parentheses (2026-10-30): see _search_split_paren_tokens. Groups are parsed on a stack.
    // Before the date join below (2026-10-31): `Feb 2025)` gives its closer up first, then joins.
    $pqSplit = _search_split_paren_tokens($tokens, $operatorKeys);
    $pqGroups = $pqSplit['grouped'];
    if ($pqGroups) $tokens = $pqSplit['tokens'];
    $pqOpen = array();   // the lists outside each open group

    // Allow an UNQUOTED month-name + year as a single date value after a comparison
    // operator (e.g. `DATE >= Feb 2025` / `DATE >= 2025 February`), mirroring
    // js/main.js parseAdvancedQuery. The tokenizer split the pair on the space;
    // rejoin it in the value slot so _cf_parse_date sees "Feb 2025" whole. Quoted
    // and no-space forms (2025-02, 02/2025) already work. Only fires immediately
    // after an operator token, so column / global / contains tokens are untouched.
    $_sbMonthTok = '/^(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)$/i';
    $_sbYearTok  = '/^\d{4}$/';
    for ($mi = 0; $mi + 2 < count($tokens); $mi++) {
        if (!in_array($tokens[$mi], $operatorKeys, true)) continue;
        $a = $tokens[$mi + 1]; $b = $tokens[$mi + 2];
        // A day + month name + year (`DATE = 5 Mar 25`, `5 March 2025`) joins first.
        if ($mi + 3 < count($tokens) && preg_match('/^\d{1,2}$/', $a) && preg_match($_sbMonthTok, $b) && preg_match('/^(?:\d{2}|\d{4})$/', $tokens[$mi + 3])) {
            array_splice($tokens, $mi + 1, 3, array($a . ' ' . $b . ' ' . $tokens[$mi + 3]));
            continue;
        }
        if ((preg_match($_sbMonthTok, $a) && preg_match($_sbYearTok, $b)) ||
            (preg_match($_sbYearTok, $a) && preg_match($_sbMonthTok, $b))) {
            array_splice($tokens, $mi + 1, 2, array($a . ' ' . $b));
        }
    }

    $tokenCount = count($tokens);
    $pos = 0; // current position (replaces closure `i` from JS)

    // --- Parse one expression starting at $pos ---
    // We use a while loop + helper instead of recursion/closures for PHP 5.3 compat

    $queryTree = array();

    while ($pos < $tokenCount) {
        $condition = null;
        if ($pqGroups && $tokens[$pos] === '(') {
            $pqOpen[] = $queryTree;
            $queryTree = array();
            $pos++;
            continue;
        }
        if ($pqGroups && $tokens[$pos] === ')') {
            // Close the group: one part stands alone, several become a 'group' node (reduced on
            // its own, AND first then OR); an empty group leaves nothing behind.
            $pos++;
            if (!empty($pqOpen)) {
                $pqInner = _search_trim_logicals($queryTree);
                $queryTree = array_pop($pqOpen);
                if (!empty($pqInner)) {
                    if (!empty($queryTree) && $queryTree[count($queryTree) - 1]['type'] !== 'logical') $queryTree[] = array('type' => 'logical', 'op' => 'and');
                    $queryTree[] = (count($pqInner) === 1) ? $pqInner[0] : array('type' => 'group', 'parts' => $pqInner);
                }
            }
            // The connector after the group, as after a condition.
            if ($pos < $tokenCount) {
                $nextLower = strtolower($tokens[$pos]);
                if ($nextLower === 'and' || $nextLower === 'or') {
                    // an empty group left a joiner behind (2026-10-31): this word takes its place
                    if (!empty($queryTree) && $queryTree[count($queryTree) - 1]['type'] === 'logical') $queryTree[count($queryTree) - 1]['op'] = $nextLower;
                    else $queryTree[] = array('type' => 'logical', 'op' => $nextLower);
                    $pos++;
                } elseif ($nextLower !== ')' && !empty($queryTree) && $queryTree[count($queryTree) - 1]['type'] !== 'logical') {
                    $queryTree[] = array('type' => 'logical', 'op' => 'and');
                }
            }
            continue;
        }
        $currentTokens = array_slice($tokens, $pos);
        if ($pqGroups) {
            // A paren token ends the expression: `(STATUS)` is STATUS, not STATUS contains `)`.
            foreach ($currentTokens as $pqIdx => $pqTok) {
                if ($pqTok === '(' || $pqTok === ')') { $currentTokens = array_slice($currentTokens, 0, $pqIdx); break; }
            }
        }
        $ctLen = count($currentTokens);

        $firstToken = $currentTokens[0];

        // --- 1. Check for {COLUMN} syntax ---
        if (substr($firstToken, 0, 1) === '{' && substr($firstToken, -1) === '}') {
            $colNameRaw = strtoupper(preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $firstToken));

            $operatorToken = ($ctLen > 1) ? $currentTokens[1] : null;
            $valueToken = ($ctLen > 2) ? $currentTokens[2] : null;
            $opKey = ($operatorToken !== null) ? _search_find_op_key($operatorToken, $operatorKeys) : null;

            if ($opKey !== null && $valueToken !== null) {
                $condition = array(
                    'type'   => 'condition',
                    'column' => $colNameRaw,
                    'op'     => $operators[$opKey],
                    'value'  => $valueToken
                );
                $pos += 3;
            } elseif ($opKey === null && $operatorToken !== null) {
                // 2-token fallback: {COLUMN} VALUE -> implicit contains (2026-09-23), as in the
                // browser's parseAdvancedQuery and the runner's parse_format_condition. Without it
                // "{DEPT} Chemistry" fell through to two GLOBAL terms here, so a scheduled Search
                // Filter kept different rows than the same filter on screen.
                $condition = array(
                    'type'   => 'condition',
                    'column' => $colNameRaw,
                    'op'     => 'contains',
                    'value'  => $operatorToken
                );
                $pos += 2;
            }
        }

        // --- 1a. A bucket of a column (2026-11-06, fbucket): LOG_DATE:fy = FY26, {AWARD DATE:ym} >= 'Jan 2025',
        // PI_LIST:dsemi 'Jones, Jacob' - main.js parseAdvancedQuery's step 0b; the condition's column is its token.
        // Step 1 read {AWARD DATE:fy} as a name of its own: that condition takes its bucket here.
        $sbk = _search_bucket_of($firstToken, $columnMap);
        if ($sbk !== null && $condition !== null && $condition['type'] === 'condition') {
            $condition['column'] = $sbk['token'];
            $condition['bucket'] = $sbk;
        } elseif ($sbk !== null && $condition === null) {
            $sbkOp = ($ctLen > 1) ? _search_find_op_key($currentTokens[1], $operatorKeys) : null;
            if ($sbkOp !== null && $ctLen > 2) {
                $condition = array('type' => 'condition', 'column' => $sbk['token'], 'op' => $operators[$sbkOp], 'value' => $currentTokens[2], 'bucket' => $sbk);
                $pos += 3;
            } elseif ($sbkOp === null && $ctLen > 1) {
                $condition = array('type' => 'condition', 'column' => $sbk['token'], 'op' => 'contains', 'value' => $currentTokens[1], 'bucket' => $sbk);
                $pos += 2;
            }
        }

        // --- 1b. Check for quoted column names ---
        if ($condition === null) {
            $fFirst = substr($firstToken, 0, 1);
            $fLast  = substr($firstToken, -1);
            if (($fFirst === "'" && $fLast === "'") || ($fFirst === '"' && $fLast === '"')) {
                $unquotedCol = strtoupper(substr($firstToken, 1, -1));
                if (isset($columnMap[$unquotedCol])) {
                    $operatorToken = ($ctLen > 1) ? $currentTokens[1] : null;
                    $valueToken = ($ctLen > 2) ? $currentTokens[2] : null;
                    $opKey = ($operatorToken !== null) ? _search_find_op_key($operatorToken, $operatorKeys) : null;

                    if ($opKey !== null && $valueToken !== null) {
                        $condition = array(
                            'type'   => 'condition',
                            'column' => $columnMap[$unquotedCol],
                            'op'     => $operators[$opKey],
                            'value'  => $valueToken
                        );
                        $pos += 3;
                    } elseif ($opKey === null && $ctLen > 1) {
                        $condition = array(
                            'type'   => 'condition',
                            'column' => $columnMap[$unquotedCol],
                            'op'     => 'contains',
                            'value'  => $currentTokens[1]
                        );
                        $pos += 2;
                    }
                }
            }
        }

        // --- 1c. Special handling for # (row number) column ---
        // Must be checked before standard column detection (mirrors JS parseAdvancedQuery)
        if ($condition === null && $firstToken === '#') {
            $operatorToken = ($ctLen > 1) ? $currentTokens[1] : null;
            $valueToken = ($ctLen > 2) ? $currentTokens[2] : null;
            $opKey = ($operatorToken !== null) ? _search_find_op_key($operatorToken, $operatorKeys) : null;

            if ($opKey !== null && $valueToken !== null) {
                // Explicit: # = 5, # > 10, # >= 1
                $condition = array('type' => 'condition', 'column' => '#', 'op' => $operators[$opKey], 'value' => $valueToken);
                $pos += 3;
            } elseif ($ctLen > 1 && $currentTokens[1] !== null) {
                // Implicit: # 5, # 1-200, # 1,5,10
                $condition = array('type' => 'condition', 'column' => '#', 'op' => '=', 'value' => $currentTokens[1]);
                $pos += 2;
            }
        }

        // --- 2. Standard multi-word column detection (longest match first) ---
        if ($condition === null) {
            foreach ($columnKeys as $colKey) {
                $colKeyWords = explode(' ', $colKey);
                $colWordCount = count($colKeyWords);
                $match = true;

                if ($ctLen < $colWordCount) {
                    $match = false;
                } else {
                    for ($j = 0; $j < $colWordCount; $j++) {
                        $cleaned = preg_replace('/^[\'"]|[\'"]$/', '', $currentTokens[$j]);
                        if (strtoupper($cleaned) !== $colKeyWords[$j]) {
                            $match = false;
                            break;
                        }
                    }
                }

                if ($match) {
                    $operatorTokenIndex = $colWordCount;
                    $opToken = ($operatorTokenIndex < $ctLen) ? $currentTokens[$operatorTokenIndex] : null;
                    $opFound = ($opToken !== null) ? _search_find_op_key($opToken, $operatorKeys) : null;
                    $valueTokenIndex = $operatorTokenIndex + 1;

                    if ($opFound !== null && $valueTokenIndex < $ctLen) {
                        $condition = array(
                            'type'   => 'condition',
                            'column' => $columnMap[$colKey],
                            'op'     => $operators[$opFound],
                            'value'  => $currentTokens[$valueTokenIndex]
                        );
                        $pos += $colWordCount + 2;
                        break;
                    } elseif ($opFound === null && $operatorTokenIndex < $ctLen) {
                        $condition = array(
                            'type'   => 'condition',
                            'column' => $columnMap[$colKey],
                            'op'     => 'contains',
                            'value'  => $currentTokens[$operatorTokenIndex]
                        );
                        $pos += $colWordCount + 1;
                        break;
                    }
                }
            }
        }

        // --- 3. Fallback logic ---
        if ($condition === null) {
            $part1 = $currentTokens[0];
            $part2 = ($ctLen > 1) ? $currentTokens[1] : null;
            $part3 = ($ctLen > 2) ? $currentTokens[2] : null;

            // 3a. Literal comparison fallback (e.g., "1 = 1", "0 < 1")
            // part1 is NOT an operator, part2 IS an operator, part3 exists.
            // The word operator never leads a literal or global expression - a bare `contains`
            // is a search term - but part1 = "contains" still blocks a literal, exactly as in
            // the browser (its literal test asks operatorKeys, its op-led test skips WORD_OPS).
            $part1AnyOp = _search_find_op_key($part1, $operatorKeys);
            $isPart1Op = ($part1 === 'contains') ? null : $part1AnyOp;
            $isPart2Op = ($part2 !== null && $part2 !== 'contains') ? _search_find_op_key($part2, $operatorKeys) : null;

            if ($part1AnyOp === null && $isPart2Op !== null && $part3 !== null) {
                $condition = array(
                    'type'      => 'literal',
                    'leftValue' => $part1,
                    'op'        => $operators[$isPart2Op],
                    'value'     => $part3
                );
                $pos += 3;
            }
            // 3b. Operator-first global (e.g., "= value", "!= value")
            elseif ($isPart1Op !== null && $part2 !== null) {
                $condition = array(
                    'type'  => 'global',
                    'op'    => $operators[$isPart1Op],
                    'value' => $part2
                );
                $pos += 2;
            }
            // 3c. Bare text → global contains
            else {
                $condition = array(
                    'type'  => 'global',
                    'op'    => 'contains',
                    'value' => $part1
                );
                $pos += 1;
            }
        }

        // Only add conditions with non-empty values
        if ($condition !== null && isset($condition['value']) && trim($condition['value']) !== '') {
            $queryTree[] = $condition;
        }

        // --- Check for AND/OR logical keywords ---
        if ($pos < $tokenCount) {
            $nextLower = strtolower($tokens[$pos]);
            if ($nextLower === 'and' || $nextLower === 'or') {
                if (!empty($queryTree) && $queryTree[count($queryTree) - 1]['type'] === 'logical') {
                    $queryTree[count($queryTree) - 1]['op'] = $nextLower;   // an empty group's joiner (2026-10-31)
                } else {
                    $queryTree[] = array(
                        'type' => 'logical',
                        'op'   => $nextLower
                    );
                }
                $pos++;
            } elseif (count($queryTree) > 0 && !($pqGroups && $tokens[$pos] === ')')) {
                $lastEntry = $queryTree[count($queryTree) - 1];
                if ($lastEntry['type'] !== 'logical') {
                    // Implicit AND between adjacent conditions
                    $queryTree[] = array('type' => 'logical', 'op' => 'and');
                }
            }
        }
    }
    while (!empty($pqOpen)) {   // an opener never closed (the balance check makes this unreachable)
        $pqRest = $queryTree;
        $queryTree = array_pop($pqOpen);
        if (!empty($queryTree) && !empty($pqRest) && $queryTree[count($queryTree) - 1]['type'] !== 'logical') $queryTree[] = array('type' => 'logical', 'op' => 'and');
        $queryTree = array_merge($queryTree, $pqRest);
    }
    // An empty group at the start or end (`() and A`, `A and ()`) left a dangling and / or (2026-10-31)
    if ($pqGroups) $queryTree = _search_trim_logicals($queryTree);

    return $queryTree;
}
}

if (!function_exists('_search_paren_name_mask')) {
function _search_paren_name_mask($tokens, $operatorKeys) {
    $ch = array(); $hit = false; $n = count($tokens);
    for ($t = 0; $t < $n; $t++) $ch[$t] = str_split((string)$tokens[$t]);
    // A brace name the opener cut open: its `{` to its `}`, over several tokens.
    for ($t = 0; $t < $n; $t++) {
        $s = (string)$tokens[$t];
        $lead = preg_match('/^\(+/', $s, $m) ? strlen($m[0]) : 0;
        if (substr($s, $lead, 1) !== '{' || strpos($s, '}', $lead) !== false) continue;
        $e = $t + 1;
        while ($e < $n && strpos((string)$tokens[$e], '}') === false) $e++;
        if ($e >= $n) continue;   // never closed: no name
        for ($b = $t; $b <= $e; $b++) {
            $to = ($b === $e) ? strpos((string)$tokens[$e], '}') : count($ch[$b]);
            for ($k = ($b === $t) ? $lead + 1 : 0; $k < $to; $k++) {
                if ($ch[$b][$k] === '(') { $ch[$b][$k] = "\xEE\x80\x80"; $hit = true; }
                elseif ($ch[$b][$k] === ')') { $ch[$b][$k] = "\xEE\x80\x81"; $hit = true; }
            }
        }
        $t = $e;
    }
    // The parens the split cuts off, paired in order; a pair followed by an operator is a name's.
    $ev = array(); $stack = array(); $named = array();
    for ($t = 0; $t < $n; $t++) {
        $tok = implode('', $ch[$t]);
        $slot = $t > 0 && in_array($tokens[$t - 1], $operatorKeys, true);   // (not $valueSlot: *-valueslot anchor that line)
        if (($slot && $tok[0] === '(') || !preg_match('/^\(|\)$/', $tok) || preg_match('#^(?:\{|//|!?/|"|\')#', $tok)) continue;
        $len = count($ch[$t]);
        $open = 0; while ($open < $len && $ch[$t][$open] === '(') $open++;
        $close = 0; while ($close < $len - $open && $ch[$t][$len - 1 - $close] === ')') $close++;
        for ($k = 0; $k < $len; $k++) {
            if ($open + $close < $len && $k >= $open && $k < $len - $close) continue;   // the core
            if ($ch[$t][$k] === '(') { $stack[] = count($ev); $ev[] = array($t, $k); continue; }
            if (empty($stack)) return null;
            $o = array_pop($stack);
            $ev[] = array($t, $k);
            if ($k === $len - 1 && $t + 1 < $n && in_array($tokens[$t + 1], $operatorKeys, true)) $named[] = array($o, count($ev) - 1);
        }
    }
    if (!empty($stack)) return null;
    foreach ($named as $p) {
        for ($x = $p[0]; $x <= $p[1]; $x++) {
            $tt = $ev[$x][0]; $kk = $ev[$x][1];
            if ($ch[$tt][$kk] === '(') { $ch[$tt][$kk] = "\xEE\x80\x80"; $hit = true; }
            elseif ($ch[$tt][$kk] === ')') { $ch[$tt][$kk] = "\xEE\x80\x81"; $hit = true; }
        }
    }
    if (!$hit) return null;
    $outM = array();
    for ($t = 0; $t < $n; $t++) $outM[] = implode('', $ch[$t]);
    return $outM;
}
}

if (!function_exists('_search_paren_unmask')) {
function _search_paren_unmask($s) { return str_replace(array("\xEE\x80\x80", "\xEE\x80\x81"), array('(', ')'), (string)$s); }
}

if (!function_exists('_search_split_paren_tokens')) {
function _search_split_paren_tokens($tokens, $operatorKeys) {
    // (2026-11-03) A NAME's own parentheses group nothing (_search_paren_name_mask): masked, the
    // split runs on the rest and the names come back as written; all of them a name's = the old reading.
    $pnMask = _search_paren_name_mask($tokens, $operatorKeys);
    if ($pnMask !== null) {
        $pnRes = _search_split_paren_tokens($pnMask, $operatorKeys);
        return $pnRes['grouped'] ? array('grouped' => true, 'tokens' => array_map('_search_paren_unmask', $pnRes['tokens'])) : array('grouped' => false, 'tokens' => $tokens);
    }
    $out = array(); $any = false; $n = count($tokens);
    for ($t = 0; $t < $n; $t++) {
        $tok = $tokens[$t];
        $valueSlot = $t > 0 && in_array($tokens[$t - 1], $operatorKeys, true);
        if (($valueSlot && $tok[0] === '(') || !preg_match('/^\(|\)$/', $tok) || preg_match('#^(?:\{|//|!?/|"|\')#', $tok)) { $out[] = $tok; continue; }
        $open = preg_match('/^\(+/', $tok, $m) ? $m[0] : '';
        $close = preg_match('/\)+$/', $tok, $m) ? $m[0] : '';
        $core = (string)substr($tok, strlen($open), strlen($tok) - strlen($open) - strlen($close));
        if ($core === '') { $open = $tok; $close = ''; }   // nothing but parens: one token each
        for ($o = 0; $o < strlen($open); $o++) $out[] = $open[$o];
        if ($core !== '') $out[] = $core;
        for ($c = 0; $c < strlen($close); $c++) $out[] = $close[$c];
        $any = true;
    }
    if ($any) {
        // `({ A }` (2026-10-31): a brace name the opener had cut open is one token again
        for ($j = 0; $j < count($out); $j++) {
            if (substr($out[$j], 0, 1) !== '{' || strpos($out[$j], '}') !== false) continue;
            $e = $j + 1;
            while ($e < count($out) && $out[$e] !== '(' && $out[$e] !== ')' && strpos($out[$e], '}') === false) $e++;
            if ($e < count($out) && $out[$e] !== '(' && $out[$e] !== ')') array_splice($out, $j, $e - $j + 1, array(implode(' ', array_slice($out, $j, $e - $j + 1))));
        }
    }
    $depth = 0;
    if ($any) {
        foreach ($out as $tk) {
            if ($tk === '(') $depth++;
            elseif ($tk === ')' && --$depth < 0) break;
        }
    }
    return ($any && $depth === 0) ? array('grouped' => true, 'tokens' => $out) : array('grouped' => false, 'tokens' => $tokens);
}
}

if (!function_exists('_search_trim_logicals')) {
function _search_trim_logicals($parts) {
    $a = 0; $b = count($parts);
    while ($a < $b && $parts[$a]['type'] === 'logical') $a++;
    while ($b > $a && $parts[$b - 1]['type'] === 'logical') $b--;
    return array_slice($parts, $a, $b - $a);
}
}

if (!function_exists('_search_query_leaves')) {
function _search_query_leaves($parts) {
    $out = array();
    foreach ((array)$parts as $p) {
        if (!is_array($p) || !isset($p['type']) || $p['type'] === 'logical') continue;
        if ($p['type'] === 'group') { foreach (_search_query_leaves($p['parts']) as $q) $out[] = $q; }
        else $out[] = $p;
    }
    return $out;
}
}

if (!function_exists('_search_sort_by_length_desc')) {
function _search_sort_by_length_desc($a, $b) {
    return strlen($b) - strlen($a);
}
}

if (!function_exists('_search_space_operators_callback')) {
function _search_space_operators_callback($matches) {
    // $matches[1] = protected group (regex, exact, quoted) - return as-is
    // $matches[2] = bare operator - surround with spaces
    if (isset($matches[1]) && $matches[1] !== '') {
        return $matches[1];
    }
    return ' ' . $matches[2] . ' ';
}
}

if (!function_exists('penumbraCanonicalBraceTokens')) {
function penumbraCanonicalBraceTokens($text) {
    if (!is_string($text) || strpos($text, '{') === false) return $text;
    return preg_replace('/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/', '{$1}', $text);
}
}

if (!function_exists('penumbraStripSrcModifier')) {
function penumbraStripSrcModifier($filter) {
    $filter = (string)$filter;
    if (!preg_match('/^(?:__(?:ALL|ROW|SRC)\s+)*/i', $filter, $m) || !preg_match('/__SRC\s/i', $m[0])) return $filter;
    return preg_replace('/__SRC\s+/i', '', $m[0]) . substr($filter, strlen($m[0]));
}
}

if (!function_exists('_search_find_op_key')) {
function _search_find_op_key($token, $operatorKeys) {
    foreach ($operatorKeys as $opKey) {
        if ($opKey === $token) {
            return $opKey;
        }
    }
    return null;
}
}

if (!function_exists('php_evaluate_search_row')) {
function php_evaluate_search_row($row, $parsedQuery, $columns, $requireRowMatch = false) {
    if (!$parsedQuery || count($parsedQuery) === 0) {
        return true;
    }
    // (2026-11-15) a dangling and / or ("AMT > 5 AND") is ignored, as the page (main.js) ignores it: the row
    // evaluated FALSE here, so a scheduled email with that filter came out empty while the page showed rows
    // (pivotparity filterRow2 / filterRow2B). Trimmed here, not in the parser: the subscription condition's
    // check reads the dangling AND to refuse it as incomplete.
    $parsedQuery = _search_trim_logicals($parsedQuery);
    if (count($parsedQuery) === 0) return true;
    if ($requireRowMatch) {
        return _php_evaluate_with_row_match($row, $parsedQuery, $columns);
    }

    // Normal path: compute virtual cols and call inner function
    $needsVirtual = false;
    foreach ($parsedQuery as $_qp) {
        if ($_qp['type'] === 'global' || $_qp['type'] === 'condition' || $_qp['type'] === 'group') {
            $needsVirtual = true;
            break;
        }
    }
    $virtualCols = $needsVirtual ? _search_get_virtual_columns($row) : array();
    return _php_evaluate_search_row_with_virtual($row, $parsedQuery, $columns, $virtualCols);
}
}

if (!function_exists('_php_evaluate_search_row_with_virtual')) {
function _php_evaluate_search_row_with_virtual($row, $parsedQuery, $columns, $virtualCols) {
    // Build a case-insensitive lookup map of the row
    $rowUpper = array();
    foreach ($row as $k => $v) {
        $rowUpper[strtoupper($k)] = $v;
    }

    $results = array();
    $ops = array();

    foreach ($parsedQuery as $part) {
        if ($part['type'] === 'logical') {
            $ops[] = $part['op'];
            continue;
        }
        if ($part['type'] === 'group') {
            // Parentheses (2026-10-30): the group is reduced as a query of its own, AND first then OR.
            $results[] = _php_evaluate_search_row_with_virtual($row, $part['parts'], $columns, $virtualCols);
            continue;
        }

        $matched = false;

        // --- Literal comparison ---
        if ($part['type'] === 'literal') {
            $leftVal = (string)$part['leftValue'];
            $matched = php_test_search_condition($part['op'], $part['value'], $leftVal, $row, $columns);
        }
        // --- Global search (all columns) ---
        elseif ($part['type'] === 'global') {
            $isNegation = ($part['op'] === '!=' || $part['op'] === '<>' || $part['op'] === '!/');
            $jSkip = _search_journal_skip();

            if ($isNegation) {
                // Negation: row matches only if NO column matches the positive version
                $positiveOp = ($part['op'] === '!/') ? 'contains' : '=';
                $anyMatched = false;
                foreach ($columns as $colName) {
                    if ($jSkip && isset($jSkip[strtoupper((string)$colName)])) continue;   // the journal's columns (2026-10-09)
                    $cellText = _search_get_cell_value($colName, $rowUpper);
                    if (php_test_search_condition($positiveOp, $part['value'], $cellText, $row, $columns)) {
                        $anyMatched = true;
                        break;
                    }
                }
                // Also check virtual columns from @@JSON cells
                if (!$anyMatched && !empty($virtualCols)) {
                    foreach ($virtualCols as $vColValues) {
                        foreach ($vColValues as $vVal) {
                            if (php_test_search_condition($positiveOp, $part['value'], $vVal, $row, $columns)) {
                                $anyMatched = true;
                                break 2;
                            }
                        }
                    }
                }
                // ...nor the row's notes (2026-10-14).
                $_sn = _search_notes_col();
                if (!$anyMatched && $_sn && isset($rowUpper[$_sn['name']]) && (string)$rowUpper[$_sn['name']] !== ''
                        && php_test_search_condition($positiveOp === '=' ? 'contains' : $positiveOp, $part['value'], (string)$rowUpper[$_sn['name']], $row, $columns)) {
                    $anyMatched = true;
                }
                $matched = !$anyMatched;
            } else {
                // Positive: row matches if ANY column matches
                foreach ($columns as $colName) {
                    if ($jSkip && isset($jSkip[strtoupper((string)$colName)])) continue;   // the journal's columns (2026-10-09)
                    $cellText = _search_get_cell_value($colName, $rowUpper);
                    if (php_test_search_condition($part['op'], $part['value'], $cellText, $row, $columns)) {
                        $matched = true;
                        break;
                    }
                }
                // Also check virtual columns from @@JSON cells
                if (!$matched && !empty($virtualCols)) {
                    foreach ($virtualCols as $vColValues) {
                        foreach ($vColValues as $vVal) {
                            if (php_test_search_condition($part['op'], $part['value'], $vVal, $row, $columns)) {
                                $matched = true;
                                break 2;
                            }
                        }
                    }
                }
                // ...and the row's notes (2026-10-14): a word anywhere in them ("=" is "contains" there).
                $_sn = _search_notes_col();
                if (!$matched && $_sn && isset($rowUpper[$_sn['name']]) && (string)$rowUpper[$_sn['name']] !== ''
                        && php_test_search_condition($part['op'] === '=' ? 'contains' : $part['op'], $part['value'], (string)$rowUpper[$_sn['name']], $row, $columns)) {
                    $matched = true;
                }
            }
        }
        // --- Column-specific condition ---
        elseif ($part['type'] === 'condition') {
            if (isset($part['bucket'])) {   // a bucket of a column (2026-11-06, fbucket): the cell's bucket in place of its text
                $results[] = _search_bucket_part($part, $rowUpper, $row, $columns, $virtualCols);
                continue;
            }
            $colName = preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $part['column']);
            $upperCol = strtoupper($colName);

            // Virtual columns take priority over main columns (matches JS behavior)
            if (!empty($virtualCols) && isset($virtualCols[$upperCol])) {
                // Match if ANY nested value satisfies the condition
                foreach ($virtualCols[$upperCol] as $vVal) {
                    if (php_test_search_condition($part['op'], $part['value'], $vVal, $row, $columns)) {
                        $matched = true;
                        break;
                    }
                }
            } elseif (($_snc = _search_notes_col()) && $upperCol === $_snc['name']) {
                // The journal's Notes (2026-10-14): the count or the text, as on the page.
                $matched = _search_notes_condition($part, $rowUpper, $row, $columns);
            } else {
                // Fall back to main column
                $cellText = _search_get_cell_value($colName, $rowUpper);
                $matched = !empty($part['journalToggle'])
                    ? _journal_toggle_dual_test($part, $cellText, $row, $columns)   // (2026-10-09)
                    : php_test_search_condition($part['op'], $part['value'], $cellText, $row, $columns);
            }
        }

        $results[] = $matched;
    }

    // --- Combine results: AND first, then OR ---
    // Process AND operators (left to right)
    for ($i = 0; $i < count($ops); $i++) {
        if ($ops[$i] === 'and') {
            // A dangling trailing "and" ("AMT > 5 AND") has no right-hand result: PHP 8
            // warned "Undefined array key" once PER ROW and the null read as false. Keep
            // the false (the browser's undefined is falsy too), drop the warning - as the
            // runner's evaluate_format_condition does (2026-09-24, pivotparity filterRow2B).
            if (!array_key_exists($i + 1, $results)) $results[$i + 1] = false;
            $results[$i + 1] = ($results[$i] && $results[$i + 1]);
            $results[$i] = 'processed';
        }
    }
    // OR: any remaining non-processed result being true means match
    $orResults = array();
    foreach ($results as $r) {
        if ($r !== 'processed') {
            $orResults[] = $r;
        }
    }

    if (count($orResults) === 0) {
        return false;
    }
    foreach ($orResults as $r) {
        if ($r) return true;
    }
    return false;
}
}

if (!function_exists('_php_evaluate_with_row_match')) {
function _php_evaluate_with_row_match($row, $parsedQuery, $columns) {
    $sources = _search_get_structured_virtual_data($row);
    if (empty($sources)) {
        // No @@JSON data - fall through to normal evaluation
        $virtualCols = _search_get_virtual_columns($row);
        return _php_evaluate_search_row_with_virtual($row, $parsedQuery, $columns, $virtualCols);
    }

    // Collect column names referenced in conditions (through every group: parentheses, 2026-10-30)
    $referencedCols = array();
    foreach (_search_query_leaves($parsedQuery) as $part) {
        if ($part['type'] === 'condition' && isset($part['column'])) {
            $col = strtoupper(preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $part['column']));
            $referencedCols[$col] = true;
            if (isset($part['bucket'])) $referencedCols[strtoupper((string)$part['bucket']['base'])] = true;   // (fbucket)
        }
    }

    // Find which sources are referenced by at least one targeted condition
    $referencedSourceIdxs = array();
    for ($si = 0; $si < count($sources); $si++) {
        foreach ($referencedCols as $col => $dummy) {
            if (in_array($col, $sources[$si]['columns'])) {
                $referencedSourceIdxs[] = $si;
                break;
            }
        }
    }

    // If no conditions target any nested column, fall through to normal eval
    if (empty($referencedSourceIdxs)) {
        $virtualCols = _search_get_virtual_columns($row);
        return _php_evaluate_search_row_with_virtual($row, $parsedQuery, $columns, $virtualCols);
    }

    // Get the full flattened virtual columns (for non-iterated sources)
    $fullVirtual = _search_get_virtual_columns($row);

    // Iterate each referenced source's rows
    foreach ($referencedSourceIdxs as $srcIdx) {
        $iterSource = $sources[$srcIdx];

        foreach ($iterSource['rows'] as $singleRow) {
            // Build projected virtual cols: start with full arrays
            $projected = $fullVirtual; // PHP copies arrays

            // Override columns from THIS source with single-row values
            foreach ($singleRow as $col => $val) {
                $projected[$col] = array($val); // single-element array
            }

            // Evaluate with projected virtual columns
            $passed = _php_evaluate_search_row_with_virtual($row, $parsedQuery, $columns, $projected);

            if ($passed) {
                return true;
            }
        }
    }

    // No sub-table row satisfied the query
    return false;
}
}

if (!function_exists('_search_get_virtual_columns')) {
function _search_get_virtual_columns($row) {
    $virtualCols = array();
    foreach ($row as $colName => $cellValue) {
        $strVal = ($cellValue === null) ? '' : (string)$cellValue;
        $jsonIdx = strpos($strVal, '@@JSON');
        if ($jsonIdx === false) continue;

        $jsonStr = substr($strVal, $jsonIdx + 6);
        $jsonData = json_decode($jsonStr, true);
        if (!is_array($jsonData) || !isset($jsonData[0]) || !is_array($jsonData[0])) continue;

        $keys = array_keys($jsonData[0]);
        foreach ($keys as $key) {
            $upperKey = strtoupper($key);
            if (!isset($virtualCols[$upperKey])) {
                $virtualCols[$upperKey] = array();
            }
            foreach ($jsonData as $jsonRow) {
                $virtualCols[$upperKey][] = _search_nested_value(isset($jsonRow[$key]) ? $jsonRow[$key] : '');
            }
        }
    }
    return $virtualCols;
}
}

if (!function_exists('_search_virtual_column_names')) {
function _search_virtual_column_names($rows) {
    $names = array();
    $n = 0;
    foreach ((array)$rows as $row) {
        // (2026-11-17, nestsample parity) The first ten rows, and on past them (to 5,000) until one holds a nested
        // table - the rule main.js buildVirtualColumnNames() has had since 2026-11-14 (nestsample). This reader still
        // stopped at ten, so where the first nested table came later the report page knew SPECIES as a column and
        // this engine (the scheduled filter, index.php's ?json=1 dashboard routing) did not: the same filter kept
        // rows on the page and was skipped, or matched nothing, here.
        if ($n >= 5000 || ($n >= 10 && $names)) {
            break;
        }
        $n++;
        if (!is_array($row)) {
            continue;
        }
        foreach (_search_get_virtual_columns($row) as $vName => $vValues) {
            $vName = (string)$vName;
            if (!in_array($vName, $names, true)) {
                $names[] = $vName;
            }
        }
    }
    return $names;
}
}

if (!function_exists('_search_get_structured_virtual_data')) {
function _search_get_structured_virtual_data($row) {
    $sources = array();
    foreach ($row as $colName => $cellValue) {
        $strVal = ($cellValue === null) ? '' : (string)$cellValue;
        $jsonIdx = strpos($strVal, '@@JSON');
        if ($jsonIdx === false) continue;

        $jsonStr = substr($strVal, $jsonIdx + 6);
        $jsonData = json_decode($jsonStr, true);
        if (!is_array($jsonData) || empty($jsonData) || !is_array($jsonData[0])) continue;

        $keys = array_keys($jsonData[0]);
        $columns = array();
        foreach ($keys as $k) {
            $columns[] = strtoupper($k);
        }

        $rows = array();
        foreach ($jsonData as $jsonRow) {
            $rowMap = array();
            foreach ($keys as $k) {
                $rowMap[strtoupper($k)] = _search_nested_value(isset($jsonRow[$k]) ? $jsonRow[$k] : '');
            }
            $rows[] = $rowMap;
        }

        $sources[] = array('columns' => $columns, 'rows' => $rows);
    }
    return $sources;
}
}

if (!function_exists('_search_get_cell_value')) {
function _search_get_cell_value($colName, $rowUpper) {
    $key = strtoupper($colName);
    $raw = _search_decode_entities(isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '');

    // Strip @@HTML prefix
    if (strpos($raw, '@@HTML') === 0) {
        $raw = substr($raw, 6);
    }

    // Strip HTML tags (the browser's /<[^>]*>/g: a "<" with no ">" after it stays) and trim
    if (strpos($raw, '<') !== false) {
        $raw = preg_replace('/<[^>]*>/', '', $raw);
    }
    return _search_js_trim($raw);
}
}

if (!function_exists('_search_nested_value')) {
function _search_nested_value($val) {
    $s = ($val === null) ? '' : (string)$val;
    if (strpos($s, '@@HTML') !== 0) {
        return $s;
    }
    return _search_js_trim(preg_replace('/<[^>]*>/', '', substr($s, 6)));
}
}

if (!function_exists('_search_decode_entities')) {
function _search_decode_entities($s) {
    if (strpos($s, '&') === false) {
        return $s;
    }
    $out = preg_replace_callback('/&(amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-fA-F]+));/', '_search_decode_entity', $s);
    if ($out === null) {
        return $s;
    }
    // A surrogate came out as its 3 bytes (\xED\xA0-\xBF ..), which no real UTF-8
    // holds: join a high one to the low one right after it, then mark the halves left.
    if (strpos($out, "\xED") !== false) {
        $out = preg_replace_callback('/\xED([\xA0-\xAF])([\x80-\xBF])\xED([\xB0-\xBF])([\x80-\xBF])/', '_search_join_surrogates', $out);
        $out = preg_replace('/\xED[\xA0-\xBF][\x80-\xBF]/', "\xEF\xBF\xBD", $out);
    }
    return $out;
}
}

if (!function_exists('_search_decode_entity')) {
function _search_decode_entity($m) {
    static $named = array('amp' => '&', 'lt' => '<', 'gt' => '>', 'quot' => '"', 'apos' => "'", 'nbsp' => ' ');
    if (isset($m[3]) && $m[3] !== '') {
        $c = _search_js_char_code($m[3], 16);
    } elseif (isset($m[2]) && $m[2] !== '') {
        $c = _search_js_char_code($m[2], 10);
    } else {
        return $named[$m[1]];
    }
    if ($c < 0x80) return chr($c);
    if ($c < 0x800) return chr(0xC0 | ($c >> 6)) . chr(0x80 | ($c & 0x3F));
    return chr(0xE0 | ($c >> 12)) . chr(0x80 | (($c >> 6) & 0x3F)) . chr(0x80 | ($c & 0x3F));
}
}

if (!function_exists('_search_join_surrogates')) {
function _search_join_surrogates($m) {
    $cp = 0x10000 + ((((ord($m[1]) & 0x0F) << 6) | (ord($m[2]) & 0x3F)) << 10)
        + (((ord($m[3]) & 0x0F) << 6) | (ord($m[4]) & 0x3F));
    return chr(0xF0 | ($cp >> 18)) . chr(0x80 | (($cp >> 12) & 0x3F))
        . chr(0x80 | (($cp >> 6) & 0x3F)) . chr(0x80 | ($cp & 0x3F));
}
}

if (!function_exists('_search_js_char_code')) {
function _search_js_char_code($digits, $base) {
    $digits = ltrim($digits, '0');
    if ($base === 10) {
        if (strlen($digits) <= 15) return (int)$digits & 0xFFFF;
        $f = (float)$digits;   // strtod: correctly rounded, as parseInt is
        return is_finite($f) ? (int)fmod($f, 65536.0) : 0;
    }
    if (strlen($digits) <= 13) return (int)hexdec('0' . $digits) & 0xFFFF;
    $bits = '';
    foreach (str_split($digits) as $h) {
        $bits .= sprintf('%04b', hexdec($h));
    }
    $bits = ltrim($bits, '0');
    $k = strlen($bits) - 53;
    if ($k <= 0) return bindec($bits) & 0xFFFF;
    if ($k >= 16) return 0;
    $m = bindec(substr($bits, 0, 53));
    $rest = substr($bits, 53);
    if ($rest[0] === '1' && (($m & 1) || strpos($rest, '1', 1) !== false)) $m++;
    return ($m << $k) & 0xFFFF;
}
}

if (!function_exists('_search_js_trim')) {
function _search_js_trim($s) {
    $s = trim($s, " \t\n\r\x0B\x0C");
    if ($s === '' || (ord($s[0]) < 0xC2 && ord(substr($s, -1)) < 0x80)) {
        return $s;
    }
    $ws = '[\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]';
    $t = preg_replace('/^' . $ws . '+|' . $ws . '+$/u', '', $s);
    return ($t === null) ? $s : $t;
}
}

if (!function_exists('php_test_search_condition')) {
function php_test_search_condition($op, $searchValue, $cellText, $row = null, $columns = null) {
    // 1. Strip quotes from searchValue
    $compareValue = trim(preg_replace('/^[\'"]|[\'"]$/', '', (string)$searchValue));

    // 2. Resolve {COLUMN} placeholders
    if (preg_match('/^\\{([^}]+)\\}$/', $compareValue, $phMatch)) {
        if ($row !== null) {
            $rowUpper = array();
            foreach ($row as $k => $v) {
                $rowUpper[strtoupper($k)] = $v;
            }
            // Same brace strip as a column name: spaces / quotes inside the braces are dropped.
            $compareValue = _search_get_cell_value(preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $phMatch[0]), $rowUpper);
        }
    }

    // 3. Empty check
    if (strtolower($compareValue) === 'empty') {
        return ($op === '=') ? ($cellText === '') : ($cellText !== '');
    }

    // 4. Exact match: //pattern// (literal, not regex - escape metacharacters)
    if (substr($compareValue, 0, 2) === '//' && substr($compareValue, -2) === '//') {
        $pattern = preg_quote(substr($compareValue, 2, -2), '/');
        // Anchored match, case-insensitive
        $result = @preg_match('/^' . $pattern . '$/i', $cellText);
        if ($result === false) return false; // safety fallback
        $matched = ($result === 1);
        return ($op === '!=' || $op === '<>') ? !$matched : $matched;
    }

    // 5. Free regex: /pattern/ or !/ operator
    if ($op === '!/' || (substr($compareValue, 0, 1) === '/' && strlen($compareValue) > 1)) {
        if ($op === '!/') {
            $pattern = $compareValue;
            $flags = 'i';
        } else {
            // Extract pattern between slashes, check for trailing flag
            $lastSlash = strrpos($compareValue, '/');
            if ($lastSlash > 0) {
                $pattern = substr($compareValue, 1, $lastSlash - 1);
                $trailingFlag = substr($compareValue, $lastSlash + 1);
                // Case-sensitive if ends with uppercase I
                $flags = ($trailingFlag === 'I') ? '' : 'i';
            } else {
                $pattern = substr($compareValue, 1);
                $flags = 'i';
            }
        }

        // A "/" inside the pattern is fine to the browser's RegExp; escape it for the
        // PHP delimiter (as _cf_test_condition does) or `COL !/ a/b` never compiles.
        $result = @preg_match('/' . str_replace('/', '\\/', $pattern) . '/' . $flags, $cellText);
        if ($result === false) return false; // invalid regex
        $matched = ($result === 1);
        return ($op === '!=' || $op === '<>' || $op === '!/') ? !$matched : $matched;
    }

    // 6. Numeric comparison
    // Strict numeric check: only treat as number if it looks purely numeric/currency/percentage
    // Uses same regex as JS isNumericStr: proper thousands formatting required

    // 6a. Range/list logic FIRST (e.g., "1-5" or "1,5,10")
    // Only if compareValue contains comma or dash but is NOT itself a standalone number
    $isRangeCandidate = !_search_is_numeric_str($compareValue)
        && (strpos($compareValue, ',') !== false || strpos($compareValue, '-') !== false);

    if (_search_is_numeric_str($cellText) && $isRangeCandidate) {
        // Ensure compareValue contains only valid range chars
        if (preg_match('/^[\\d,\\-\\.\\$%\\s]+$/', $compareValue)) {
            $cellNum = (float)preg_replace('/[\\$,%]/', '', $cellText);
            if (!is_nan($cellNum)) {
                $isInList = _search_num_in_range_list($cellNum, $compareValue);
                if ($op === '=' || $op === 'contains') return $isInList;
                if ($op === '!=' || $op === '<>') return !$isInList;
            }
        }
    }

    // 6b. Standard numeric comparison
    if (_search_is_numeric_str($cellText) && _search_is_numeric_str($compareValue)) {
        $cellNum = (float)preg_replace('/[\\$,%]/', '', $cellText);
        $searchNum = (float)preg_replace('/[\\$,%]/', '', $compareValue);

        if (!is_nan($cellNum) && !is_nan($searchNum)) {
            switch ($op) {
                case '=':       return $cellNum == $searchNum;
                case '!=':      return $cellNum != $searchNum;
                case '>':       return $cellNum > $searchNum;
                case '<':       return $cellNum < $searchNum;
                case '>=':      return $cellNum >= $searchNum;
                case '<=':      return $cellNum <= $searchNum;
                // No 'contains' here: the browser's numeric switch has none, so
                // `AMT contains 5` falls through to the TEXT test ('$1,234.56' holds a 5).
                // This used to answer numeric equality (false there).
            }
        }
    }

    // 6c. Accounting-format fallback (the browser's and _cf_test_condition's branch): if
    // either side is a parenthesized accounting negative, compare numerically - '(5)' is
    // -5. Without it '(5)' reached the text branch, where the slug match made it EQUAL 5.
    if (preg_match('/^\([\d,.\$%]+\)$/', trim($cellText)) || preg_match('/^\([\d,.\$%]+\)$/', $compareValue)) {
        $acctCell = _search_parse_num($cellText);
        $acctSearch = _search_parse_num($compareValue);
        if ($acctCell !== false && $acctSearch !== false) {
            switch ($op) {
                case '=':  return $acctCell == $acctSearch;
                case '!=': return $acctCell != $acctSearch;
                case '>':  return $acctCell > $acctSearch;
                case '<':  return $acctCell < $acctSearch;
                case '>=': return $acctCell >= $acctSearch;
                case '<=': return $acctCell <= $acctSearch;
            }
        }
    }

    // 7. Date comparison (skip for 'contains' - date comparison only for =, !=, >, <, >=, <=).
    // The browser's parseSearchDate: a strict parse of the search value, else a KEYWORD
    // date (TODAY / NOW / SYSDATE +-N - search deliberately has no English phrases, see
    // _sr_resolve_keyword_date); the cell side stays strict. Both sides floor to the
    // SEARCH value's granularity, so "> 2024" means after the year 2024 and "= 2025-02"
    // any day in that month (moment's isAfter / isSame with a unit).
    if ($op !== 'contains') {
        $searchDate = _search_parse_date($compareValue);
        if ($searchDate === false) {
            $relResolved = _sr_resolve_keyword_date($compareValue);
            if ($relResolved !== null) $searchDate = _search_parse_date($relResolved);
        }
        if ($searchDate !== false) {
            $cellDate = _search_parse_date($cellText);
            if ($cellDate !== false) {
                $g  = $searchDate['gran'];
                $cv = _search_date_floor($cellDate['ts'], $g);
                $sv = _search_date_floor($searchDate['ts'], $g);
                switch ($op) {
                    case '=':  return $cv === $sv;
                    case '!=': return $cv !== $sv;
                    case '>':  return $cv >  $sv;
                    case '<':  return $cv <  $sv;
                    case '>=': return $cv >= $sv;
                    case '<=': return $cv <= $sv;
                }
            }
        }
    }

    // 8. Text comparison
    $cleanCell = strtolower(trim($cellText));
    $cleanSearch = strtolower(trim($compareValue));

    if ($op === 'contains') {
        return ($cleanSearch === '') ? true : (strpos($cleanCell, $cleanSearch) !== false);
    }
    if ($op === '=') {
        if ($cleanCell === $cleanSearch) return true;
        // Slugify fallback: strip non-alphanumeric, compare
        $slugCell = preg_replace('/[^a-z0-9]/', '', $cleanCell);
        $slugSearch = preg_replace('/[^a-z0-9]/', '', $cleanSearch);
        return $slugCell === $slugSearch;
    }
    if ($op === '!=') {
        return $cleanCell !== $cleanSearch;
    }

    return false;
}
}

if (!function_exists('_search_is_numeric_str')) {
function _search_is_numeric_str($str) {
    return (bool)preg_match('/^[-+]?\\$?(\\d{1,3}(,\\d{3})*|\\d+)(\\.\\d+)?%?$/', (string)$str);
}
}

if (!function_exists('_search_parse_num')) {
function _search_parse_num($str) {
    $s = trim(str_replace("\x02", '', (string)$str));
    if (preg_match('/^\([\d,.\$%]+\)$/', $s)) {
        $s = '-' . trim($s, '()');
    }
    $s = preg_replace('/[\$,%]/', '', $s);
    if (!is_numeric($s)) return false;
    return (float)$s;
}
}

if (!function_exists('_search_parse_date')) {
function _search_parse_date($str) {
    static $cache = array();
    $s = trim(str_replace("\x02", '', (string)$str));
    if ($s === '') return false;
    if (array_key_exists($s, $cache)) return $cache[$s];

    // Fast reject: supported formats start with a digit or a month name (JS _couldBeDate).
    if (($s[0] < '0' || $s[0] > '9') && !preg_match('/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i', $s)) {
        if (count($cache) < 5000) $cache[$s] = false;
        return false;
    }

    // Oracle timestamp "DD-MMM-YY HH:MI:SS..." -> keep just the DD-MMM-YY part.
    $probe = $s;
    if (preg_match('/^\d{2}-[A-Za-z]{3}-\d{2}\s/', $probe)) {
        $probe = substr($probe, 0, 9);
    }

    static $formats = array(
        array('Y-m-d H:i:s.u', 'second'),
        array('Y-m-d H:i:s',   'second'),
        array('m/d/Y', 'day'),
        array('n/j/Y', 'day'),
        array('m/d/y', 'day'),
        array('n/j/y', 'day'),
        array('Y-m-d', 'day'),
        array('Y-n-j', 'day'),
        array('d-M-y', 'day'),
        array('j-M-y', 'day'),
        array('d-M-Y', 'day'),
        array('j M y', 'day'),
        array('j M Y', 'day'),
        array('m/Y', 'month'),
        array('Y-m', 'month'),
        array('F Y', 'month'),
        array('M Y', 'month'),
        array('Y F', 'month'),
        array('Y M', 'month'),
        array('Y', 'year'),
    );

    $result = false;
    foreach ($formats as $f) {
        if ($f[0] === 'Y' && !preg_match('/^\d{4}$/', $probe)) continue;
        // Any 'Y' year takes 4 digits and 'y' 2, as moment's strict YYYY / YY:
        // PHP's 'Y' alone reads 03/05/25 as the year 25. A day + month name takes
        // a 3-letter month and one separator, as DD-MMM-YY / D MMM YYYY do
        // (PHP's 'M' also reads "March", its space also matches none).
        if (strpos($f[0], 'Y') !== false && !preg_match('/(?<!\d)\d{4}(?!\d)/', $probe)) continue;
        if (preg_match('/^[dj][ -]M/', $f[0]) && !preg_match('/^\d{1,2}[ -][A-Za-z]{3}[ -]\d+$/', $probe)) continue;
        $dt = DateTime::createFromFormat('!' . $f[0], $probe);
        if ($dt === false) continue;
        // Reject loose matches (trailing data / impossible dates); PHP 8.2 returns
        // false from getLastErrors() when the parse was clean.
        $errs = DateTime::getLastErrors();
        if ($errs !== false && (((int)$errs['warning_count'] > 0) || ((int)$errs['error_count'] > 0))) {
            continue;
        }
        if (strpos($f[0], 'y') !== false && (int)$dt->format('Y') === 2069) {
            $dt->modify('-100 years');
        }
        $result = array('ts' => $dt->getTimestamp(), 'gran' => $f[1]);
        break;
    }

    if (count($cache) >= 5000) $cache = array();
    $cache[$s] = $result;
    return $result;
}
}

if (!function_exists('_search_date_floor')) {
function _search_date_floor($ts, $gran) {
    switch ($gran) {
        case 'second': return $ts;
        case 'month':  return mktime(0, 0, 0, (int)date('n', $ts), 1, (int)date('Y', $ts));
        case 'year':   return mktime(0, 0, 0, 1, 1, (int)date('Y', $ts));
        case 'day':
        default:       return mktime(0, 0, 0, (int)date('n', $ts), (int)date('j', $ts), (int)date('Y', $ts));
    }
}
}

if (!function_exists('_search_range_bound')) {
function _search_range_bound($s) {
    $t = trim(preg_replace('/[\\$,%]/', '', (string)$s));
    return preg_match('/^[-+]?(\\d+\\.?\\d*|\\.\\d+)/', $t, $m) ? (float)$m[0] : NAN;
}
}

if (!function_exists('_search_num_in_range_list')) {
function _search_num_in_range_list($num, $rangeListStr) {
    $items = explode(',', (string)$rangeListStr);
    foreach ($items as $item) {
        $item = trim($item);
        if (strpos($item, '-') !== false) {
            $parts = explode('-', $item, 2);
            $min = _search_range_bound($parts[0]);
            $max = _search_range_bound($parts[1]);
            if (!is_nan($min) && !is_nan($max) && $num >= $min && $num <= $max) {
                return true;
            }
        } else {
            $sNum = _search_range_bound($item);
            if (!is_nan($sNum) && $num == $sNum) {
                return true;
            }
        }
    }
    return false;
}
}

if (!function_exists('_journal_normalize_toggle_conditions')) {
function _journal_normalize_toggle_conditions($parsedQuery, $toggleResolver) {
    if (!$toggleResolver || empty($parsedQuery) || empty($toggleResolver['colNames'])) return $parsedQuery;
    $names = array();
    foreach ($toggleResolver['colNames'] as $n) $names[strtoupper((string)$n)] = true;
    foreach ($parsedQuery as $i => $part) {
        if (isset($part['type']) && $part['type'] === 'group') { $parsedQuery[$i]['parts'] = _journal_normalize_toggle_conditions($part['parts'], $toggleResolver); continue; }
        if (!isset($part['type']) || $part['type'] !== 'condition' || !isset($part['column'])) continue;
        $colName = preg_replace('/^\{\s*[\'"]?|[\'"]?\s*\}$/', '', (string)$part['column']);
        if (!isset($names[strtoupper($colName)])) continue;
        $want = journalToggleWantExport(isset($part['value']) ? $part['value'] : '');
        $op = isset($part['op']) ? (string)$part['op'] : '';
        // The clean boolean form ("Done = ☑", "Done != yes") is an equality on the stored 1 / 0. Anything
        // else - "Done > 0", a contains, a regex: the search builder's two ticked boxes are an alternation
        // of the ☐ / ☑ glyphs - is tested against BOTH forms of the cell, negated once, as the page does
        // (main.js's toggle branch; 2026-10-09: it matched no row here, and "!=" every row).
        if ($want !== null && in_array($op, array('=', '==', '!=', '<>', "\xE2\x89\xA0"), true)) {
            $parsedQuery[$i]['value'] = $want ? '1' : '0';
        } else {
            $parsedQuery[$i]['journalToggle'] = true;
        }
    }
    return $parsedQuery;
}
}

if (!function_exists('_journal_field_option_conditions')) {
function _journal_field_option_conditions($parsedQuery, $toggleResolver) {
    if (!is_array($toggleResolver) || empty($parsedQuery) || empty($toggleResolver['fieldOpts']) || !is_array($toggleResolver['fieldOpts'])) return $parsedQuery;
    $up = function ($s) { return function_exists('journalUpperKey') ? journalUpperKey($s) : strtoupper((string)$s); };
    foreach ($parsedQuery as $i => $part) {
        if (isset($part['type']) && $part['type'] === 'group' && isset($part['parts']) && is_array($part['parts'])) {
            $parsedQuery[$i]['parts'] = _journal_field_option_conditions($part['parts'], $toggleResolver);
            continue;
        }
        if (!isset($part['type']) || $part['type'] !== 'condition' || !isset($part['column']) || !isset($part['value']) || !is_scalar($part['value'])) continue;
        $op = isset($part['op']) ? trim((string)$part['op']) : '';
        if (!in_array($op, array('=', '==', '!=', '<>', "\xE2\x89\xA0"), true)) continue;
        $bare = trim((string)preg_replace('/^\{\s*[\'"]?|[\'"]?\s*\}$/', '', (string)$part['column']));
        $fo = null;
        foreach (array($up($bare), strtoupper($bare)) as $u) {
            if (isset($toggleResolver['fieldOpts'][$u])) { $fo = $toggleResolver['fieldOpts'][$u]; break; }
        }
        if (!$fo) continue;
        $want = $up(trim(preg_replace('/^[\'"]|[\'"]$/', '', trim((string)$part['value']))));
        if ($want === '' || isset($fo['cur'][$want]) || !isset($fo['old'][$want])) continue;
        $parsedQuery[$i]['value'] = (string)$fo['old'][$want];
    }
    return $parsedQuery;
}
}

if (!function_exists('_journal_toggle_dual_test')) {
function _journal_toggle_dual_test($part, $cellText, $row, $columns) {
    $op = isset($part['op']) ? (string)$part['op'] : '=';
    $val = isset($part['value']) ? $part['value'] : '';
    $on = ((string)$cellText === '1');
    $posOp = $op; $posVal = $val;
    if ($op === '!=' || $op === '<>' || $op === "\xE2\x89\xA0") { $posOp = '='; }
    elseif ($op === '!/') { $posOp = '='; $posVal = '/' . $val . '/'; }
    $hit = php_test_search_condition($posOp, $posVal, $on ? '1' : '0', $row, $columns)
        || php_test_search_condition($posOp, $posVal, $on ? "\xE2\x98\x91" : "\xE2\x98\x90", $row, $columns);
    return ($posOp !== $op) ? !$hit : $hit;
}
}

if (!function_exists('_search_journal_skip')) {
function _search_journal_skip($set = null) {
    static $skip = array();
    if (is_array($set)) $skip = $set;
    return $skip;
}
}

if (!function_exists('_search_notes_col')) {
function _search_notes_col($set = null) {
    static $c = null;
    if ($set !== null) $c = ($set === false) ? null : $set;
    return $c;
}
}

if (!function_exists('_search_notes_register')) {
function _search_notes_register($resolver, &$columns, &$journalNames) {
    _search_notes_col(false);
    if (!is_array($resolver) || empty($resolver['notesSearch'])) return null;
    $n = (string)$resolver['notesSearch'];
    if (!in_array(strtoupper($n), array_map('strtoupper', $columns), true)) $columns[] = $n;
    $journalNames[strtoupper($n)] = true;
    _search_notes_col(array('name' => strtoupper($n), 'count' => strtoupper(JOURNAL_NOTES_COUNT_KEY)));
    return $n;
}
}

if (!function_exists('_search_notes_condition')) {
function _search_notes_condition($part, $rowUpper, $row, $columns) {
    $sn = _search_notes_col();
    $text = isset($rowUpper[$sn['name']]) ? (string)$rowUpper[$sn['name']] : '';
    $count = isset($rowUpper[$sn['count']]) ? (int)$rowUpper[$sn['count']] : 0;
    $op = (string)$part['op'];
    $raw = isset($part['value']) ? (string)$part['value'] : '';
    $nv = strtolower(preg_replace('/^[\'"]|[\'"]$/', '', trim($raw)));
    if ($nv === 'empty') return ($op === '=') ? $count === 0 : $count !== 0;
    if (preg_match('/^-?\d+(\.\d+)?$/', $nv) && substr(trim($raw), 0, 1) !== '/') {
        return php_test_search_condition($op, $raw, (string)$count, $row, $columns);
    }
    if ($op === '=' || $op === '==') return php_test_search_condition('contains', $raw, $text, $row, $columns);
    if ($op === '!=' || $op === '<>' || $op === "\xE2\x89\xA0") return !php_test_search_condition('contains', $raw, $text, $row, $columns);
    return php_test_search_condition($op, $raw, $text, $row, $columns);
}
}

if (!function_exists('_journal_alias_toggle_conditions')) {
function _journal_alias_toggle_conditions($parsedQuery, $aliasCols) {
    if (empty($parsedQuery) || empty($aliasCols)) return $parsedQuery;
    foreach ($parsedQuery as $i => $part) {
        if (!isset($part['type']) || $part['type'] !== 'condition' || !isset($part['column'])) continue;
        $bare = strtoupper(trim((string)preg_replace('/^\{\s*[\'"]?|[\'"]?\s*\}$/', '', (string)$part['column'])));
        if (isset($aliasCols[$bare])) $parsedQuery[$i]['column'] = $aliasCols[$bare];
    }
    return $parsedQuery;
}
}

if (!function_exists('penumbraRecipientListRegex')) {
function penumbraRecipientListRegex($pipeList) {
    $parts = array();
    foreach (explode('|', (string)$pipeList) as $p) {
        $p = trim($p);
        if ($p === '*') return '(.*)';   // a campus-wide account (2026-09-25): every unit, whatever else is listed
        if ($p !== '') $parts[] = preg_quote($p, '/');
    }
    return $parts ? '(' . implode('|', $parts) . ')' : '(?!)';
}
}

if (!function_exists('penumbraRecipientListSqlIn')) {
function penumbraRecipientListSqlIn($pipeList) {
    $parts = array();
    foreach (explode('|', (string)$pipeList) as $p) { $p = trim($p); if ($p !== '') $parts[] = "'" . str_replace("'", "''", $p) . "'"; }
    return $parts ? '(' . implode(',', $parts) . ')' : '(NULL)';
}
}

if (!function_exists('penumbraRecipientListFilterMap')) {
function penumbraRecipientListFilterMap($recipientVars) {
    $g = function ($k) use ($recipientVars) { return (is_array($recipientVars) && isset($recipientVars[$k])) ? (string)$recipientVars[$k] : ''; };
    return array(
        '{OUCS2D}' => penumbraRecipientListRegex($g('oucs2d')),
        '{OUCS4D}' => penumbraRecipientListRegex($g('oucs4d')),
        '{OUCS6D}' => penumbraRecipientListRegex($g('oucs6d') !== '' ? $g('oucs6d') : $g('oucs')),
        '{OUCS}'   => penumbraRecipientListRegex($g('oucs')),
    );
}
}

if (!function_exists('penumbra_search_filter_set')) {
function penumbra_search_filter_set($s) {
    return $s !== null && $s !== false && !is_array($s) && trim((string)$s) !== '';
}
}

if (!function_exists('php_apply_search_filter')) {
function php_apply_search_filter($data, $viewMode, $searchFilter, $recipientVars = null, $toggleResolver = null, $numsIn = null, &$numsOut = null) {
    if (!penumbra_search_filter_set($searchFilter)) {
        return $data;
    }

    // "{ DEPT }" = "{DEPT}" BEFORE the recipient variables below are substituted.
    $resolvedFilter = penumbraCanonicalBraceTokens($searchFilter);

    // Resolve per-recipient variables if provided
    if ($recipientVars !== null && is_array($recipientVars)) {
        $varMap = array(
            '{FNAME}'    => isset($recipientVars['fname'])    ? $recipientVars['fname']    : '',
            '{LNAME}'    => isset($recipientVars['lname'])    ? $recipientVars['lname']    : '',
            '{USERNAME}' => isset($recipientVars['username']) ? $recipientVars['username'] : '',
            '{EMAIL}'    => isset($recipientVars['email'])    ? $recipientVars['email']    : '',
            '{OUC2D}'    => isset($recipientVars['ouc2d'])    ? $recipientVars['ouc2d']    : '',
            '{OUC4D}'    => isset($recipientVars['ouc4d'])    ? $recipientVars['ouc4d']    : '',
            '{OUC6D}'    => isset($recipientVars['ouc6d'])    ? $recipientVars['ouc6d']    : '',
            '{DEPT}'     => isset($recipientVars['dept'])     ? $recipientVars['dept']     : '',
            '{OUC}'      => isset($recipientVars['ouc'])      ? $recipientVars['ouc']      : '',
            '{EMPL_ID}'  => isset($recipientVars['empl_id'])  ? $recipientVars['empl_id']  : '',
            '{EMPL_ID4}' => _sr_empl_id4($recipientVars),
            // The five HR facts added 2026-09-23 (PENUMBRA_PEOPLE through the directory resolver).
            '{JOBCODE}'        => isset($recipientVars['jobcode'])        ? $recipientVars['jobcode']        : '',
            '{JOBCODE_PREFIX}' => isset($recipientVars['jobcode_prefix']) ? $recipientVars['jobcode_prefix'] : '',
            '{EMPL_CLASS}'     => isset($recipientVars['empl_class'])     ? $recipientVars['empl_class']     : '',
            '{EMPL_STATUS}'    => isset($recipientVars['empl_status'])    ? $recipientVars['empl_status']    : '',
            '{PI_ELIGIBLE}'    => isset($recipientVars['pi_eligible'])    ? (string)$recipientVars['pi_eligible'] : ''
        ) + penumbraRecipientListFilterMap($recipientVars);   // {OUCS} family as regex groups (2026-09-23 night)
        foreach ($varMap as $placeholder => $value) {
            $resolvedFilter = str_ireplace($placeholder, $value, $resolvedFilter);
        }
    }

    // Determine columns from the first row of data
    $columns = array();
    if ($viewMode === 'grouped') {
        // Grouped data: array of groups, each group has rows
        // Find first non-empty group to get columns
        foreach ($data as $group) {
            if (is_array($group) && !empty($group)) {
                // Check if group is an array of rows (numeric keys) or has a 'rows' key
                $firstRow = null;
                if (isset($group['rows']) && is_array($group['rows']) && !empty($group['rows'])) {
                    $firstRow = $group['rows'][0];
                } elseif (isset($group[0]) && is_array($group[0])) {
                    $firstRow = $group[0];
                }
                if ($firstRow !== null) {
                    $columns = array_keys($firstRow);
                    break;
                }
            }
        }
    } else {
        // Standard or pivot: flat array of rows
        if (!empty($data) && is_array($data)) {
            $firstRow = reset($data);
            if (is_array($firstRow)) {
                $columns = array_keys($firstRow);
            }
        }
    }

    if (empty($columns)) {
        return $data;
    }

    // Add # to columns so the parser recognizes it as a valid column
    if (!in_array('#', $columns)) {
        $columns[] = '#';
    }

    // Add virtual column names from @@JSON cells so the parser recognizes them
    // (e.g., SPECIES, COUNT from nested sub-tables). Without this, queries like
    // "SPECIES = Chicken" fall through to global search and fail to match.
    // Read from the first 10 rows, as the report page reads them (see
    // _search_virtual_column_names); grouped data: its first 10 rows in group order.
    $sampleRows = array();
    if ($viewMode === 'grouped') {
        foreach ($data as $group) {
            if (!is_array($group) || empty($group)) {
                continue;
            }
            if (isset($group['rows']) && is_array($group['rows'])) {
                $groupRows = $group['rows'];
            } elseif (isset($group[0]) && is_array($group[0])) {
                $groupRows = $group;
            } else {
                continue;
            }
            foreach ($groupRows as $groupRow) {
                if (is_array($groupRow)) {
                    $sampleRows[] = $groupRow;
                    if (count($sampleRows) >= 10) {
                        break 2;
                    }
                }
            }
        }
    } elseif (!empty($data) && is_array($data)) {
        $sampleRows = $data;
    }
    $upperColumns = array_map('strtoupper', $columns);
    foreach (_search_virtual_column_names($sampleRows) as $vColName) {
        if (!in_array($vColName, $upperColumns, true)) {
            $columns[] = $vColName;
            $upperColumns[] = $vColName;
        }
    }

    // Journal toggle columns are filter-time VIRTUAL columns: registered here so
    // the parser recognizes "Done", and evaluated per row below - but never
    // written into the rows themselves, so rawData (snapshots, change diffs,
    // DB dumps) stays clean. Same shape as the synthetic '#' column above.
    // Without this the condition degrades to a literal comparison that is always
    // false, which reads as a legitimately empty report rather than an error.
    // The who and when columns ("Done by", "Done on", 2026-10-08) the same way: plain
    // values, so never put through the toggle value rewrite above.
    $aliasCols = array();
    $journalNames = array();   // UPPER => true: a bare term skips them (_search_journal_skip, 2026-10-09)
    if ($toggleResolver && (!empty($toggleResolver['colNames']) || !empty($toggleResolver['whoNames']))) {   // (2026-11-11) a pick list alone too
        $whoNames = (isset($toggleResolver['whoNames']) && is_array($toggleResolver['whoNames'])) ? $toggleResolver['whoNames'] : array();
        foreach (array_merge($toggleResolver['colNames'], $whoNames) as $tName) {
            // Skipped by a bare term whether or not the rows already carry it (2026-10-09): the ?json=1 API appends
            // the toggle columns before &search=, and "1" matched every marked row there. The resolver never names a
            // toggle like a data column (it suffixes _2, _3), so no data column is skipped.
            $journalNames[strtoupper((string)$tName)] = true;
            if (!in_array(strtoupper($tName), array_map('strtoupper', $columns))) {
                $columns[] = $tName;
            }
        }
        // ...and a renamed toggle's OLD names (2026-10-08), read as the column they stand
        // for: the parsed conditions are pointed at it below. One this data has a column
        // of its own by stays that column's.
        if (function_exists('journalExportAliasMapFor')) {
            $aliasCols = journalExportAliasMapFor($toggleResolver, $columns);
            foreach (array_keys($aliasCols) as $aName) { $columns[] = (string)$aName; $journalNames[strtoupper((string)$aName)] = true; }
        }
    }

    // ...and the Notes column (2026-10-14): searched as on the page, whether or not the
    // output carries it (the resolver reads the notes whenever row notes are on).
    $notesSearch = function_exists('journalExportNotesSearchValues') ? _search_notes_register($toggleResolver, $columns, $journalNames) : null;

    // __SRC (a browser pivot-view modifier) means nothing here: every name is a column.
    $resolvedFilter = penumbraStripSrcModifier($resolvedFilter);

    // Detect __ROW modifier: require nested-column conditions to match within same sub-table row
    $requireRowMatch = false;
    if (preg_match('/^__ROW\s+/i', $resolvedFilter)) {
        $requireRowMatch = true;
        $resolvedFilter = preg_replace('/^__ROW\s+/i', '', $resolvedFilter);
    }

    $parsedQuery = php_parse_search_query($resolvedFilter, $columns);
    if (empty($parsedQuery)) {
        return $data;
    }
    // A condition on a renamed toggle's old name reads the column it stands for (2026-10-08).
    $parsedQuery = _journal_alias_toggle_conditions($parsedQuery, $aliasCols);
    // "Done = ☑" -> "Done = 1" (the stored form). Must run AFTER parsing so we
    // only rewrite values whose column is actually a toggle.
    $parsedQuery = _journal_normalize_toggle_conditions($parsedQuery, $toggleResolver);
    // A pick list's option by an old label reads as its label now (2026-11-11).
    $parsedQuery = _journal_field_option_conditions($parsedQuery, $toggleResolver);
    _search_journal_skip($journalNames);
    // An auto-width bin (AMOUNT:bin, 2026-11-06 fbucket): the width these rows give, as the grouping's own
    $parsedQuery = _search_bucket_auto_widths($parsedQuery, $data, $viewMode);

    // Filter based on viewMode
    if ($viewMode === 'grouped') {
        $filtered = array();
        $globalRowNum = 0; // Global row counter across all groups
        foreach ($data as $groupKey => $group) {
            // Determine group row structure
            $rows = null;
            $hasRowsKey = false;
            if (isset($group['rows']) && is_array($group['rows'])) {
                $rows = $group['rows'];
                $hasRowsKey = true;
            } elseif (is_array($group) && isset($group[0]) && is_array($group[0])) {
                $rows = $group;
            }

            if ($rows === null) {
                continue;
            }

            $filteredRows = array();
            foreach ($rows as $row) {
                $globalRowNum++;
                // Inject # (1-based row number) for evaluation, matching front-end behavior
                $evalRow = $row;
                $evalRow['#'] = (string)$globalRowNum;
                if ($toggleResolver) {
                    foreach (journalExportToggleRowValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if ($notesSearch !== null) {
                    foreach (journalExportNotesSearchValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if (php_evaluate_search_row($evalRow, $parsedQuery, $columns, $requireRowMatch)) {
                    $filteredRows[] = $row; // Keep original row without injected # / toggles
                }
            }

            // Only keep non-empty groups
            if (!empty($filteredRows)) {
                if ($hasRowsKey) {
                    $newGroup = $group;
                    $newGroup['rows'] = array_values($filteredRows);
                    $filtered[$groupKey] = $newGroup;
                } else {
                    $filtered[$groupKey] = array_values($filteredRows);
                }
            }
        }
        _search_journal_skip(array());
        _search_notes_col(false);
        return $filtered;
    } else {
        // Standard or pivot: filter flat array of rows
        $filtered = array();
        $numsOut = array();
        $rowNum = 0;
        foreach ($data as $row) {
            $rowNum++;
            if (is_array($row)) {
                // Inject # (1-based row number) for evaluation, matching front-end behavior
                // (hashc) a row's own number where the caller has one (rows an earlier filter kept)
                $num = (is_array($numsIn) && isset($numsIn[$rowNum - 1])) ? (int)$numsIn[$rowNum - 1] : $rowNum;
                $evalRow = $row;
                $evalRow['#'] = (string)$num;
                if ($toggleResolver) {
                    foreach (journalExportToggleRowValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if ($notesSearch !== null) {
                    foreach (journalExportNotesSearchValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if (php_evaluate_search_row($evalRow, $parsedQuery, $columns, $requireRowMatch)) {
                    $filtered[] = $row; // Keep original row without injected # / toggles
                    $numsOut[] = $num;
                }
            }
        }
        _search_journal_skip(array());
        _search_notes_col(false);
        return array_values($filtered);
    }
}
}

if (!function_exists('penumbra_route_dash_search')) {
function penumbra_route_dash_search($dsearch, $columns) {
    $out = array('text' => '', 'applied' => array(), 'skipped' => array(), 'ok' => false);
    $spec = json_decode((string)$dsearch, true);
    if (!is_array($spec) || !isset($spec['f']) || !is_array($spec['f'])) {
        return $out;
    }
    $out['ok'] = true;
    $have = array();
    foreach ((array)$columns as $c) {
        $have[strtoupper(trim((string)$c))] = true;
    }
    $keep = array();
    foreach ($spec['f'] as $fr) {
        if (!is_array($fr)) {
            continue;
        }
        $col = strtoupper(trim(isset($fr[0]) && is_scalar($fr[0]) ? (string)$fr[0] : ''));
        $txt = trim(isset($fr[1]) && is_scalar($fr[1]) ? (string)$fr[1] : '');
        if ($txt === '') {
            continue;
        }
        // (2026-11-17, metricsweep5) A parenthesised group has no column of its own, so
        // it used to be kept for every report: on a report without one of its
        // columns it compared literal text, matched nothing, and the tile read 0
        // with no "not filtered" mark. The names compared inside it are checked;
        // if this report lacks one, the group is skipped and reported as skipped.
        // (metricsweep6) names are read from the group with its quoted values and /patterns/ taken out first:
        // (URL = "x?id=5" ...) and (NOTE = /a=b/ ...) used to yield ID and A as columns the report lacks.
        $grpBare = preg_replace('/"[^"]*"|\'[^\']*\'|\/(?:\\\\.|[^\/\\\\])*\/[A-Za-z]*/', ' ', $txt);
        if ($col === '' && isset($txt[0]) && $txt[0] === '(' && is_string($grpBare) && preg_match_all('/([A-Za-z_][A-Za-z0-9_]*)\s*(?:!=|<>|>=|<=|=|>|<)/', $grpBare, $grpNames)) {
            $grpMissing = array();
            foreach ($grpNames[1] as $gn) { $gu = strtoupper($gn); if (!isset($have[$gu])) $grpMissing[$gu] = true; }
            if ($grpMissing) {
                foreach (array_keys($grpMissing) as $gm) { if (!in_array($gm, $out['skipped'], true)) $out['skipped'][] = $gm; }
                continue;
            }
        }
        if ($col === '' || isset($have[$col])) {
            $keep[] = $txt;
            if ($col !== '' && !in_array($col, $out['applied'], true)) {
                $out['applied'][] = $col;
            }
        } elseif (!in_array($col, $out['skipped'], true)) {
            $out['skipped'][] = $col;
        }
    }
    if ($keep) {
        // Only the leading search modifiers are accepted as a prefix.
        $prefix = (isset($spec['p']) && is_string($spec['p'])) ? $spec['p'] : '';
        if (!preg_match('/^(?:\s*__(?:ROW|ALL|SRC)\s+)*$/i', $prefix)) {
            $prefix = '';
        }
        $out['text'] = $prefix . implode(' and ', $keep);
    }
    return $out;
}
}

if (!function_exists('penumbra_search_known_columns')) {
function penumbra_search_known_columns($data) {
    if (empty($data) || !is_array($data)) {
        return array();
    }
    $first = reset($data);
    if (!is_array($first)) {
        return array();
    }
    $cols = array_keys($first);
    $cols[] = '#';
    foreach (_search_virtual_column_names($data) as $vName) {
        $cols[] = $vName;
    }
    return $cols;
}
}

if (!function_exists('penumbra_search_columns_from_meta')) {
function penumbra_search_columns_from_meta($meta) {
    $cols = array();
    if (!is_array($meta)) {
        return $cols;
    }
    foreach ($meta as $m) {
        $name = (is_array($m) && isset($m['name']) && is_scalar($m['name'])) ? trim((string)$m['name']) : '';
        if ($name !== '' && !in_array($name, $cols, true)) {
            $cols[] = $name;
        }
    }
    if (!$cols) {
        return $cols;
    }
    if (function_exists('penumbraSliceMergePlan')) {
        $plan = penumbraSliceMergePlan($cols);
        if (is_array($plan) && isset($plan['active']) && is_array($plan['active'])) {
            $merged = array();
            foreach ($cols as $c) {
                $a = array_key_exists($c, $plan['active']) ? $plan['active'][$c] : null;
                if ($a === false) {
                    continue;
                }
                $n = (is_array($a) && isset($a['base'])) ? (string)$a['base'] : $c;
                if (!in_array($n, $merged, true)) {
                    $merged[] = $n;
                }
            }
            $cols = $merged;
        }
    }
    $cols[] = '#';
    return $cols;
}
}

if (!function_exists('penumbra_nested_row_count')) {
function penumbra_nested_row_count($value) {
    if ($value === null) return 0;
    $s = (string)$value;
    $p = strpos($s, '@@JSON');
    if ($p === false) return 0;
    $d = json_decode(substr($s, $p + 6));
    if (json_last_error() === JSON_ERROR_NONE) {
        if (is_array($d)) return count($d);
        return is_object($d) ? 1 : 0;
    }
    return _penumbra_json_rows($s, $p + 6);
}
}

if (!function_exists('_penumbra_json_rows')) {
function _penumbra_json_rows($s, $i) {
    $n = strlen($s);
    while ($i < $n && (($o = ord($s[$i])) === 32 || $o === 9 || $o === 10 || $o === 13)) $i++;
    if ($i >= $n) return 0;
    $o = ord($s[$i]);
    if ($o === 123) return 1;                                  // {
    if ($o !== 91) return 0;                                   // not [
    $depth = 0; $inStr = false; $esc = false; $want = false; $count = 0;
    for (; $i < $n; $i++) {
        $o = ord($s[$i]);
        if ($inStr) {
            if ($esc) $esc = false;
            elseif ($o === 92) $esc = true;                    // a backslash
            elseif ($o === 34) $inStr = false;                 // "
            continue;
        }
        if ($o === 32 || $o === 9 || $o === 10 || $o === 13) continue;
        if ($want && $depth === 1 && $o !== 93) { $count++; $want = false; }   // an item starts
        if ($o === 34) $inStr = true;
        elseif ($o === 91 || $o === 123) { if (++$depth === 1) $want = true; }
        elseif ($o === 93 || $o === 125) { if (--$depth === 0) break; }
        elseif ($o === 44 && $depth === 1) $want = true;       // ,
    }
    return $count;
}
}

if (!function_exists('_search_bucket_suffix')) {
function _search_bucket_suffix($sx) {
    static $dates = array('year', 'fy', 'yq', 'fyq', 'ym', 'quarter', 'fquarter', 'month', 'monthnum', 'dow', 'hour');
    static $delims = array('dsemi', 'dpipe', 'dcomma', 'dtab', 'dnl', 'dspace');
    $sx = (string)$sx;
    $b = array('sx' => $sx, 'split' => null, 'kind' => null, 'width' => null, 'edges' => null, 'delim' => null);
    if (in_array($sx, $dates, true)) { $b['split'] = $sx; $b['kind'] = 'date'; return $b; }
    if ($sx === 'binlog' || $sx === 'bin') { $b['split'] = $sx; $b['kind'] = 'bin'; return $b; }
    if (preg_match('/^bin([1-9]\d{0,14})$/D', $sx, $m)) { $b['split'] = 'bin'; $b['kind'] = 'bin'; $b['width'] = (int)$m[1]; return $b; }
    if (preg_match('/^bins(\d{1,15}(?:_\d{1,15})*)$/D', $sx, $m)) {
        $e = _search_bucket_edges(explode('_', $m[1]));
        if ($e === null) return null;
        $b['sx'] = 'bins' . implode('_', $e); $b['split'] = 'bins'; $b['kind'] = 'bin'; $b['edges'] = $e;
        return $b;
    }
    if (in_array($sx, $delims, true)) { $b['kind'] = 'list'; $b['delim'] = $sx; return $b; }
    return null;
}
}

if (!function_exists('_search_bucket_edges')) {
function _search_bucket_edges($list) {
    if (!is_array($list) || !count($list)) return null;
    $out = array();
    foreach ($list as $v) {
        if (!preg_match('/^\d+$/D', (string)$v)) return null;
        $n = (int)round((float)$v);
        if (!in_array($n, $out, true)) $out[] = $n;
    }
    if (!count($out) || count($out) > 40) return null;
    sort($out, SORT_NUMERIC);
    return $out;
}
}

if (!function_exists('_search_bucket_of')) {
function _search_bucket_of($tok, $columnMap) {
    $t = (string)$tok;
    if (strpos($t, ':') === false || !is_array($columnMap)) return null;
    $c0 = substr($t, 0, 1); $cz = substr($t, -1);
    if ($c0 === '{' && $cz === '}') $t = preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $t);
    elseif (strlen($t) > 1 && ($c0 === "'" || $c0 === '"') && $cz === $c0) $t = substr($t, 1, -1);
    elseif ($c0 === '/' || $c0 === '!' || $c0 === '{' || $c0 === "'" || $c0 === '"') return null;
    if (isset($columnMap[strtoupper($t)])) return null;   // a column whose own name holds a colon
    $at = strrpos($t, ':');
    if ($at === false || $at < 1) return null;
    $base = _search_js_trim(substr($t, 0, $at));
    $bu = strtoupper($base);
    if ($base === '' || !isset($columnMap[$bu])) return null;
    $b = _search_bucket_suffix(strtolower(_search_js_trim((string)substr($t, $at + 1))));
    if ($b === null) return null;
    $b['base'] = $columnMap[$bu];
    $b['token'] = $b['base'] . ':' . $b['sx'];
    return $b;
}
}

if (!function_exists('_search_bucket_clean')) {
function _search_bucket_clean($s) {
    $s = (string)$s;
    if (substr($s, 0, 6) === '@@HTML' || substr($s, 0, 6) === '@@JSON') $s = substr($s, 6);
    if (strpos($s, '<') !== false) $s = preg_replace('/<[^>]*>/', '', $s);
    return _search_js_trim($s);
}
}

if (!function_exists('_search_bucket_num')) {
function _search_bucket_num($raw) {
    $str = trim((string)$raw);
    if ($str === '') return false;
    $isNegative = (substr($str, 0, 1) === '(' && substr($str, -1) === ')');
    $clean = preg_replace('/[$,()%\x02]/u', '', $str);
    if ($clean === null) return false;
    $clean = trim($clean);
    if ($clean === '' || !preg_match('/^[-+]?(\d+(\.\d*)?|\.\d+)$/D', $clean)) return false;
    $num = (float)$clean;
    if (!is_finite($num)) return false;
    return $isNegative ? -$num : $num;
}
}

if (!function_exists('_search_bucket_int')) {
function _search_bucket_int($n) { return number_format(round($n)); }
}

if (!function_exists('_search_bucket_compact')) {
function _search_bucket_compact($n) {
    static $U = array(array(1000000000, 'B'), array(1000000, 'M'), array(1000, 'K'));
    foreach ($U as $u) {
        if (abs($n) >= $u[0]) {
            $v = $n / $u[0];
            if ($v == floor($v)) return ((string)(int)$v) . $u[1];
            if (round($v * 10) / 10 == $v) return rtrim(rtrim(number_format($v, 1, '.', ''), '0'), '.') . $u[1];
            break;
        }
    }
    return number_format(round($n));
}
}

if (!function_exists('_search_bucket_compact_parse')) {
function _search_bucket_compact_parse($s) {
    if (!preg_match('/^\$?\s*(-?[\d,]*\.?\d+)\s*([KMB])?$/iD', trim((string)$s), $m)) return null;
    $n = (float)str_replace(',', '', $m[1]);
    $u = strtoupper(isset($m[2]) ? $m[2] : '');
    if ($u === 'K') $n *= 1000; elseif ($u === 'M') $n *= 1000000; elseif ($u === 'B') $n *= 1000000000;
    return $n;
}
}

if (!function_exists('_search_bucket_date_label')) {
function _search_bucket_date_label($split, $s) {
    static $rank = array('year' => 0, 'month' => 1, 'day' => 2, 'second' => 3);
    static $minGran = array('year' => 0, 'fy' => 1, 'yq' => 1, 'fyq' => 1, 'ym' => 1, 'quarter' => 1, 'fquarter' => 1,
        'month' => 1, 'monthnum' => 1, 'dow' => 2, 'hour' => 3);
    static $MO = array('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec');
    static $DW = array('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
    $s = _search_bucket_clean($s);
    if ($s === '' || !isset($minGran[$split])) return $s;
    $p = _search_parse_date($s);
    if ($p === false) return $s;
    if (!isset($rank[$p['gran']]) || $rank[$p['gran']] < $minGran[$split]) return $s;
    $ts = $p['ts'];
    $y = (int)date('Y', $ts); $m1 = (int)date('n', $ts); $h = (int)date('G', $ts);
    $fy = ($m1 >= 7) ? $y + 1 : $y;
    $fy2 = 'FY' . substr((string)$fy, -2);
    $fq = intdiv(($m1 + 5) % 12, 3) + 1;   // Jul = FQ1
    $q = intdiv($m1 - 1, 3) + 1;
    switch ($split) {
        case 'year':     return (string)$y;
        case 'fy':       return $fy2;
        case 'yq':       return $y . ' Q' . $q;
        case 'fyq':      return $fy2 . ' Q' . $fq;
        case 'ym':       return $MO[$m1 - 1] . ' ' . $y;
        case 'quarter':  return 'Q' . $q;
        case 'fquarter': return 'FQ' . $fq;
        case 'month':    return $MO[$m1 - 1];
        case 'monthnum': return str_pad((string)$m1, 2, '0', STR_PAD_LEFT);
        case 'dow':      return $DW[((int)date('N', $ts)) - 1];
        case 'hour':     return str_pad((string)$h, 2, '0', STR_PAD_LEFT) . ':00';
    }
    return $s;
}
}

if (!function_exists('_search_bucket_bin_label')) {
function _search_bucket_bin_label($split, $s, $width) {
    $s = _search_bucket_clean($s);
    if ($s === '') return '';
    $n = _search_bucket_num($s);
    if ($n === false) return $s;
    if ($split === 'binlog') {
        if (!($n >= 1)) return '< 1';
        $lo = 1;
        while ($n >= $lo * 10 && $lo < 1e15) $lo *= 10;
        return _search_bucket_int($lo) . ' – ' . _search_bucket_int($lo * 10 - 1);
    }
    $w = ($width && $width > 0) ? $width : 1;
    $lo2 = floor($n / $w) * $w;
    return _search_bucket_int($lo2) . ' – ' . _search_bucket_int($lo2 + $w - 1);
}
}

if (!function_exists('_search_bucket_bins_label')) {
function _search_bucket_bins_label($s, $edges) {
    $s = _search_bucket_clean($s);
    if ($s === '') return '';
    if (!is_array($edges) || !count($edges)) return $s;
    $n = _search_bucket_num($s);
    if ($n === false) return $s;
    $last = count($edges) - 1;
    if ($n < $edges[0]) return 'below ' . _search_bucket_compact($edges[0]);
    for ($i = $last; $i >= 0; $i--) {
        if ($n >= $edges[$i]) {
            return ($i === $last)
                ? 'above ' . _search_bucket_compact($edges[$i])
                : _search_bucket_compact($edges[$i]) . ' – ' . _search_bucket_compact($edges[$i + 1]);
        }
    }
    return 'below ' . _search_bucket_compact($edges[0]);
}
}

if (!function_exists('_search_bucket_labels')) {
function _search_bucket_labels($b, $text) {
    static $CH = array('dsemi' => ';', 'dpipe' => '|', 'dcomma' => ',', 'dtab' => "\t");
    $s = (string)$text;
    if ($b['delim'] !== null) {
        if ($b['delim'] === 'dnl') $parts = preg_split('/\r\n|\r|\n/', $s);
        elseif ($b['delim'] === 'dspace') $parts = preg_split('/ +/', $s);
        else $parts = explode($CH[$b['delim']], $s);
        $out = array(); $seen = array();   // '#'-prefixed keys: a value like "2025" must not become an int key
        foreach ((array)$parts as $p) {
            $p = trim($p, " \t\n\r\0\x0B");
            if ($p === '' || isset($seen['#' . $p])) continue;
            $seen['#' . $p] = true;
            $out[] = $p;
        }
        return $out;
    }
    if ($b['split'] === 'bins') $l = _search_bucket_bins_label($s, $b['edges']);
    elseif ($b['kind'] === 'bin') $l = _search_bucket_bin_label($b['split'], $s, $b['width']);
    else $l = _search_bucket_date_label($b['split'], $s);
    $l = (string)$l;
    return ($l === '') ? array() : array($l);
}
}

if (!function_exists('_search_bucket_sort_val1')) {
function _search_bucket_sort_val1($split, $s) {
    static $MO = array('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec');
    static $DW = array('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
    if ($split === 'bins') {
        if (preg_match('/^below /u', $s)) return -1e12;
        if (preg_match('/^above (.+)$/uD', $s, $m)) return _search_bucket_compact_parse($m[1]);
        if (preg_match('/^(.+?) – (.+)$/uD', $s, $m)) return _search_bucket_compact_parse($m[1]);
        return null;
    }
    if ($split === 'bin' || $split === 'binlog') {
        if (preg_match('/^< /u', $s)) return -1e12;
        if (preg_match('/^(-?[\d,]+)/', $s, $m)) return (float)str_replace(',', '', $m[1]);
        return null;
    }
    switch ($split) {
        case 'year':     return preg_match('/^\d{4}$/D', $s) ? (int)$s : null;
        case 'fy':       if (!preg_match('/^FY(\d{2})$/iD', $s, $m)) return null; $y = (int)$m[1]; return $y + ($y <= 68 ? 2000 : 1900);
        case 'yq':       return preg_match('/^(\d{4}) Q([1-4])$/D', $s, $m) ? ((int)$m[1]) * 10 + (int)$m[2] : null;
        case 'fyq':      if (!preg_match('/^FY(\d{2}) Q([1-4])$/iD', $s, $m)) return null; $y = (int)$m[1]; $y += ($y <= 68 ? 2000 : 1900); return $y * 10 + (int)$m[2];
        case 'ym':
            if (!preg_match('/^([A-Za-z]{3}) (\d{4})$/D', $s, $m)) return null;
            $i = array_search($m[1], $MO, true);
            return ($i === false) ? null : ((int)$m[2]) * 100 + $i + 1;
        case 'quarter':  return preg_match('/^Q([1-4])$/iD', $s, $m) ? (int)$m[1] : null;
        case 'fquarter': return preg_match('/^FQ([1-4])$/iD', $s, $m) ? (int)$m[1] : null;
        case 'month':    $i = array_search($s, $MO, true); return ($i === false) ? null : $i + 1;
        case 'monthnum': return preg_match('/^(0[1-9]|1[0-2])$/D', $s) ? (int)$s : null;
        case 'dow':      $i = array_search($s, $DW, true); return ($i === false) ? null : $i;
        case 'hour':     return preg_match('/^([01]\d|2[0-3]):00$/D', $s, $m) ? (int)$m[1] : null;
    }
    return null;
}
}

if (!function_exists('_search_bucket_cap')) {
function _search_bucket_cap($m) { return strtoupper(substr($m[0], 0, 1)) . strtolower(substr($m[0], 1)); }
}

if (!function_exists('_search_bucket_sort_val')) {
function _search_bucket_sort_val($split, $s) {
    $s = (string)$s;
    if ($split === null || $s === '') return null;
    $n = _search_bucket_sort_val1($split, $s);
    if ($n === null) {
        $t = preg_replace_callback('/[A-Za-z]+/', '_search_bucket_cap', $s);
        $n = ($t !== null && $t !== $s) ? _search_bucket_sort_val1($split, $t) : null;
    }
    return ($n === null || is_nan((float)$n)) ? null : (float)$n;
}
}

if (!function_exists('_search_bucket_order')) {
function _search_bucket_order($b, $op, $value, $label) {
    if ($b['delim'] !== null || !in_array($op, array('>', '<', '>=', '<='), true)) return null;
    $v = _search_js_trim((string)$value);
    $q = substr($v, 0, 1);
    if (strlen($v) > 1 && ($q === "'" || $q === '"') && substr($v, -1) === $q) $v = _search_js_trim(substr($v, 1, -1));
    $a = _search_bucket_sort_val($b['split'], $label);
    $c = _search_bucket_sort_val($b['split'], $v);
    if ($a === null || $c === null) return null;
    if ($op === '>') return $a > $c;
    if ($op === '<') return $a < $c;
    if ($op === '>=') return $a >= $c;
    return $a <= $c;
}
}

if (!function_exists('_search_bucket_test')) {
function _search_bucket_test($b, $op, $value, $text, $row, $columns) {
    $ls = _search_bucket_labels($b, $text);
    if ($b['delim'] === null) {
        $l = count($ls) ? $ls[0] : '';
        $o = _search_bucket_order($b, $op, $value, $l);
        return ($o !== null) ? $o : (bool)php_test_search_condition($op, $value, $l, $row, $columns);
    }
    if (!count($ls)) return (bool)php_test_search_condition($op, $value, '', $row, $columns);
    $neg = ($op === '!=' || $op === '<>' || $op === '!/');
    foreach ($ls as $l) {
        if ((bool)php_test_search_condition($op, $value, $l, $row, $columns) !== $neg) return !$neg;
    }
    return $neg;
}
}

if (!function_exists('_search_bucket_part')) {
function _search_bucket_part($part, $rowUpper, $row, $columns, $virtualCols) {
    $b = $part['bucket'];
    $up = strtoupper((string)$b['base']);
    if (!empty($virtualCols) && isset($virtualCols[$up])) {
        foreach ($virtualCols[$up] as $vVal) {
            if (_search_bucket_test($b, $part['op'], $part['value'], $vVal, $row, $columns)) return true;
        }
        return false;
    }
    return _search_bucket_test($b, $part['op'], $part['value'], _search_get_cell_value($b['base'], $rowUpper), $row, $columns);
}
}

if (!function_exists('_search_bucket_nice_width')) {
function _search_bucket_nice_width($min, $max) {
    $range = $max - $min;
    if (!($range > 0)) return 1;
    $raw = $range / 10;
    $p = pow(10, floor(log10($raw)));
    $w = 10 * $p;
    if ($raw <= 1 * $p) $w = 1 * $p; elseif ($raw <= 2 * $p) $w = 2 * $p; elseif ($raw <= 5 * $p) $w = 5 * $p;
    return max(1, (int)round($w));
}
}

if (!function_exists('_search_bucket_auto_width')) {
function _search_bucket_auto_width($data, $viewMode, $base) {
    $key = strtoupper((string)$base); $min = INF; $max = -INF; $realKey = null;
    $rowsets = array();
    if ($viewMode === 'grouped') {
        foreach ((array)$data as $group) {
            if (!is_array($group)) continue;
            if (isset($group['rows']) && is_array($group['rows'])) $rowsets[] = $group['rows'];
            elseif (isset($group[0]) && is_array($group[0])) $rowsets[] = $group;
        }
    } else {
        $rowsets[] = (array)$data;
    }
    foreach ($rowsets as $rows) {
        foreach ($rows as $r) {
            if (!is_array($r)) continue;
            if ($realKey === null || !array_key_exists($realKey, $r)) {
                $realKey = null;
                foreach ($r as $k => $unused) { if (strtoupper((string)$k) === $key) { $realKey = $k; break; } }
                if ($realKey === null) continue;
            }
            $n = _search_bucket_num(_search_bucket_clean((string)$r[$realKey]));
            if ($n === false) continue;
            if ($n < $min) $min = $n;
            if ($n > $max) $max = $n;
        }
    }
    return ($min <= $max) ? _search_bucket_nice_width($min, $max) : 1;
}
}

if (!function_exists('_search_bucket_auto_widths')) {
function _search_bucket_auto_widths($parts, $data, $viewMode) {
    foreach ($parts as $i => $p) {
        if (!is_array($p) || !isset($p['type'])) continue;
        if ($p['type'] === 'group' && isset($p['parts'])) { $parts[$i]['parts'] = _search_bucket_auto_widths($p['parts'], $data, $viewMode); continue; }
        if (!isset($p['bucket']) || $p['bucket']['split'] !== 'bin' || $p['bucket']['width'] !== null) continue;
        $parts[$i]['bucket']['width'] = _search_bucket_auto_width($data, $viewMode, $p['bucket']['base']);
    }
    return $parts;
}
}
