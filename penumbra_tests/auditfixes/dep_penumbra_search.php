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
        if ((preg_match($_sbMonthTok, $a) && preg_match($_sbYearTok, $b)) ||
            (preg_match($_sbYearTok, $a) && preg_match($_sbMonthTok, $b))) {
            array_splice($tokens, $mi + 1, 2, array($a . ' ' . $b));
        }
    }

    // The word operator in any case (`TITLE Contains grant`), like the browser.
    foreach ($tokens as $_wi => $_wt) {
        if (strcasecmp($_wt, 'contains') === 0) $tokens[$_wi] = 'contains';
    }

    $tokenCount = count($tokens);
    $pos = 0; // current position (replaces closure `i` from JS)

    // --- Parse one expression starting at $pos ---
    // We use a while loop + helper instead of recursion/closures for PHP 5.3 compat

    $queryTree = array();

    while ($pos < $tokenCount) {
        $condition = null;
        $currentTokens = array_slice($tokens, $pos);
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
            $part1 = $tokens[$pos];
            $part2 = ($pos + 1 < $tokenCount) ? $tokens[$pos + 1] : null;
            $part3 = ($pos + 2 < $tokenCount) ? $tokens[$pos + 2] : null;

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
                $queryTree[] = array(
                    'type' => 'logical',
                    'op'   => $nextLower
                );
                $pos++;
            } elseif (count($queryTree) > 0) {
                $lastEntry = $queryTree[count($queryTree) - 1];
                if ($lastEntry['type'] !== 'logical') {
                    // Implicit AND between adjacent conditions
                    $queryTree[] = array('type' => 'logical', 'op' => 'and');
                }
            }
        }
    }

    return $queryTree;
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
    if ($requireRowMatch) {
        return _php_evaluate_with_row_match($row, $parsedQuery, $columns);
    }

    // Normal path: compute virtual cols and call inner function
    $needsVirtual = false;
    foreach ($parsedQuery as $_qp) {
        if ($_qp['type'] === 'global' || $_qp['type'] === 'condition') {
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

    // Collect column names referenced in conditions
    $referencedCols = array();
    foreach ($parsedQuery as $part) {
        if ($part['type'] === 'condition' && isset($part['column'])) {
            $col = strtoupper(preg_replace('/^\\{\\s*[\'"]?|[\'"]?\\s*\\}$/', '', $part['column']));
            $referencedCols[$col] = true;
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
                $val = isset($jsonRow[$key]) ? $jsonRow[$key] : '';
                $virtualCols[$upperKey][] = ($val === null) ? '' : (string)$val;
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
        if ($n++ >= 10) {
            break;
        }
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
                $val = isset($jsonRow[$k]) ? $jsonRow[$k] : '';
                $rowMap[strtoupper($k)] = ($val === null) ? '' : (string)$val;
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
    $raw = isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '';

    // Strip @@HTML prefix
    if (strpos($raw, '@@HTML') === 0) {
        $raw = substr($raw, 6);
    }

    // Strip HTML tags and trim
    return trim(strip_tags($raw));
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
        array('Y-m-d', 'day'),
        array('Y-n-j', 'day'),
        array('d-M-y', 'day'),
        array('j-M-y', 'day'),
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
function php_apply_search_filter($data, $viewMode, $searchFilter, $recipientVars = null, $toggleResolver = null) {
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
    if ($toggleResolver && !empty($toggleResolver['colNames'])) {
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
    _search_journal_skip($journalNames);

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
        $rowNum = 0;
        foreach ($data as $row) {
            $rowNum++;
            if (is_array($row)) {
                // Inject # (1-based row number) for evaluation, matching front-end behavior
                $evalRow = $row;
                $evalRow['#'] = (string)$rowNum;
                if ($toggleResolver) {
                    foreach (journalExportToggleRowValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if ($notesSearch !== null) {
                    foreach (journalExportNotesSearchValues($toggleResolver, $row) as $tn => $tv) $evalRow[$tn] = $tv;
                }
                if (php_evaluate_search_row($evalRow, $parsedQuery, $columns, $requireRowMatch)) {
                    $filtered[] = $row; // Keep original row without injected # / toggles
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
