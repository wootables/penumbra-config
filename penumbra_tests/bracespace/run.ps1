# =============================================================================
# bracespace - "{ DEPT }" is "{DEPT}" in every Search Filter engine (2026-09-23).
#
#   & $sb                     # against live
#   & $sb -App <dir>          # against a stage (needs penumbra_search.php, schedule_runner.php, js\main.js)
#   & $sb -Mutant             # a control + targeted mutants; each MUST go red by exactly its count
#
# Three engines, one case table: B = penumbra_search.php, C = schedule_runner.php
# (parse_format_condition, lifted with parity\extract_engine_c.php - the runner is NEVER
# required), A = main.js parseAdvancedQuery / evaluateParsedQuery in headless Edge (exported
# by a patch at the ready closure's first statement, like parity\run_parity.ps1). Plus the
# hazard the fix had to handle: a per-recipient filter "DEPT_NAME = { DEPT }" must be
# substituted like {DEPT}, never read as the report's own DEPT column (every row to everyone).
# Since 2026-09-23 22:xx also the grammar the two PHP engines were aligned to: {COLUMN} VALUE =
# implicit contains (penumbra_search.php had two global terms) and the `contains` word operator
# (neither PHP engine had it) with the browser's WORD_OPS exclusions.
#
# EXPECTED TAIL: "PASS: 117   FAIL: 0" then "RESULT: GREEN"  (count as of 2026-10-16: 78 PHP + 39 browser)
#
# RED ON PAGE ERRORS (2026-10-17): an uncaught error while main.js boots in the harness
# (window.onerror -> RESULTS_JSON pageErrors) is ONE extra FAIL under section A, so the tail
# reads "PASS: 117   FAIL: 1" / "RESULT: RED" with the message on the FAIL line. It used to be a
# parenthetical "(main.js init errors, may matter: ...)" note that counted nothing, which is how
# the ready closure dying at journalWatch() (0e8e581, 2026-10-02) sat unnoticed until
# 2026-10-16: the exports are hoisted declarations, so a half-booted main.js still answered
# every case. Proof: -App <stage> whose js\main.js has tBodies -> tBodiez must go RED.
#
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create((Get-Content -Raw '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\bracespace\run.ps1'))
# Never add a bare `exit` (it would kill the caller).
# =============================================================================
param(
    [string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [switch]$Mutant
)
$ErrorActionPreference = 'Stop'
# Hard-coded, not $PSScriptRoot: that is empty when the body runs as a scriptblock.
$here   = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\bracespace'
$parity = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity'
$php    = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge   = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$libs = @('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
          'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
          'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js')

# Unique per RUN, not per process: two runs back to back in one PowerShell session shared a
# folder, and a lingering Edge child from the first still held its dump file open.
$work = Join-Path $env:TEMP ('pnb_bracespace_' + $PID + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
foreach ($l in $libs) { Copy-Item -LiteralPath (Join-Path $parity $l) -Destination (Join-Path $work $l) -Force }
Copy-Item -LiteralPath (Join-Path $here 'harness.html') -Destination (Join-Path $work 'harness.html') -Force
Copy-Item -LiteralPath (Join-Path $here 'tests.js') -Destination (Join-Path $work 'tests.js') -Force

function Invoke-BraceSuite([string]$appDir, [switch]$Quiet) {
    $lines = New-Object System.Collections.Generic.List[string]
    # --- PHP engines (B + C) ---
    $ex = Join-Path $work 'engineC.php'
    & $php -n (Join-Path $parity 'extract_engine_c.php') (Join-Path $appDir 'schedule_runner.php') $ex | Out-Null
    $phpOut = & $php -n (Join-Path $here 'test_bracespace.php') $appDir $ex 2>&1 | Out-String
    $pp = 0; $pf = 0
    if ($phpOut -match 'PASS:\s+(\d+)\s+FAIL:\s+(\d+)') { $pp = [int]$Matches[1]; $pf = [int]$Matches[2] } else { $pf = 999 }
    foreach ($l in ($phpOut -split "`r?`n")) { if ($l -match '^\s+(ok|FAIL)\s|^[A-Z]\. |want:|got:|Fatal|Warning') { $lines.Add($l) } }
    # --- browser engine (A) ---
    $src = [IO.File]::ReadAllText((Join-Path $appDir 'js\main.js'))
    $anchor = '$(document).ready(function () {'
    if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update bracespace\run.ps1" }
    $inject = $anchor + "`r`n    try { window.__BS = { paq: parseAdvancedQuery, epq: evaluateParsedQuery, sgsq: splitGroupSummaryQuery, canon: _pnbCanonBraceTokens }; } catch (e) { window.__BS_ERR = String(e); }`r`n"
    $i0 = $src.IndexOf($anchor)
    [IO.File]::WriteAllText((Join-Path $work 'main_patched.js'), $src.Substring(0, $i0) + $inject + $src.Substring($i0 + $anchor.Length), (New-Object System.Text.UTF8Encoding($false)))
    # A fresh dump file per Edge launch: a lingering child of the previous launch may still hold
    # the old one open, so it is never reused or deleted mid-run.
    $dom = Join-Path $work ('dom_' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $url = 'file:///' + $work.Replace([char]92, [char]47) + '/harness.html'
    $proc = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList `
        '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
        "--user-data-dir=$(Join-Path $work 'edgeprofile')", '--virtual-time-budget=20000', '--dump-dom', $url
    # Wait for the marker IN THE DUMP, not for process exit (a lingering Edge child can hold stdout open).
    $sw = [Diagnostics.Stopwatch]::StartNew(); $txt = $null
    while ($sw.Elapsed.TotalSeconds -lt 150) {
        try {
            $fs = [IO.File]::Open($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
            try { $d = (New-Object IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Dispose() }
            if ($d.Contains('</pre>') -and $d.TrimEnd().EndsWith('</html>')) { $txt = $d; break }
        } catch { }
        if ($proc.HasExited -and $sw.Elapsed.TotalSeconds -gt 5) { try { $txt = [IO.File]::ReadAllText($dom) } catch { }; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $proc.HasExited) { try { $proc.Kill() } catch { } }
    $jp = 0; $jf = 0
    if (-not $txt) { $jf = 999; $lines.Add('  FAIL browser harness: no dump within 150 s') }
    else {
        $a = $txt.IndexOf('<pre id="out">'); $b = $txt.IndexOf('</pre>', $a)
        $body = [System.Net.WebUtility]::HtmlDecode($txt.Substring($a + 14, $b - $a - 14))
        if (-not $body.StartsWith('RESULTS_JSON:')) { $jf = 999; $lines.Add('  FAIL browser harness: ' + $body.Substring(0, [Math]::Min(300, $body.Length))) }
        else {
            $res = $body.Substring(13) | ConvertFrom-Json
            $lines.Add('A. main.js (browser) parseAdvancedQuery / evaluateParsedQuery / _pnbCanonBraceTokens')
            # Uncaught errors while main.js booted = the ready closure died part-way. The exports
            # still answer (hoisted declarations), so every case below can pass against a half-booted
            # main.js; the boot itself is therefore ONE failure (2026-10-17 - a note before that).
            if ($res.pageErrors -and @($res.pageErrors).Count) { $jf++; $lines.Add('  FAIL main.js boot: uncaught error(s) - the ready closure died, the cases below ran against a half-booted main.js: ' + (@($res.pageErrors) -join ' | ')) }
            foreach ($r in $res.results) {
                if ($r.ok) { $jp++; $lines.Add('  ok   ' + $r.label) }
                else { $jf++; $lines.Add('  FAIL ' + $r.label); $lines.Add('       want: ' + ($r.want | ConvertTo-Json -Compress)); $lines.Add('       got:  ' + ($r.got | ConvertTo-Json -Compress)) }
            }
        }
    }
    return @{ Pass = $pp + $jp; Fail = $pf + $jf; Lines = $lines }
}

try {
    if (-not $Mutant) {
        $r = Invoke-BraceSuite $App
        $r.Lines | ForEach-Object { Write-Host $_ }
        Write-Host ''
        Write-Host ("PASS: {0}   FAIL: {1}" -f $r.Pass, $r.Fail)
        Write-Host ('RESULT: ' + $(if ($r.Fail -eq 0) { 'GREEN' } else { 'RED' }))
        return
    }

    # --- mutants: a private copy of the three files, one mutation at a time ---
    $mapp = Join-Path $work 'app'
    foreach ($f in @('penumbra_search.php', 'schedule_runner.php', 'js\main.js')) {
        $dst = Join-Path $mapp $f
        New-Item -ItemType Directory -Force (Split-Path -Parent $dst) | Out-Null
        Copy-Item -LiteralPath (Join-Path $App $f) -Destination $dst -Force
    }
    $c = Invoke-BraceSuite $mapp
    $allGood = ($c.Fail -eq 0)
    Write-Host ("CONTROL (unmutated copy) -> PASS {0} FAIL {1} {2}" -f $c.Pass, $c.Fail, $(if ($allGood) { 'GREEN' } else { 'NOT GREEN - fix before trusting the mutants' }))
    $NEWJS  = "/^\{\s*['""]?|['""]?\s*\}`$/g"
    $OLDJS  = "/^\{['""]?|['""]?\}`$/g"
    $NEWB   = "'/^\\{\\s*[\'""]?|[\'""]?\\s*\\}`$/'"
    $OLDB   = "'/^\\{[\'""]?|[\'""]?\\}`$/'"
    $NEWC   = "'/^\{\s*[\'""]?|[\'""]?\s*\}`$/'"
    $OLDC   = "'/^\{[\'""]?|[\'""]?\}`$/'"
    # Anchors carrying $1 and quotes: single-quoted here-strings, nothing to escape.
    $CANON_JS = @'
return String(text == null ? '' : text).replace(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, '{$1}');
'@
    $CANON_PHP = @'
return preg_replace('/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/', '{$1}', $text);
'@
    $CANON_PHP_QUOTED = @'
return preg_replace_callback('#("[^"]*"|\'[^\']*\')|\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}#', function ($m) { return (isset($m[1]) && $m[1] !== '') ? $m[1] : '{' . $m[2] . '}'; }, $text);
'@
    $CANON_JS = $CANON_JS.TrimEnd("`r", "`n"); $CANON_PHP = $CANON_PHP.TrimEnd("`r", "`n"); $CANON_PHP_QUOTED = $CANON_PHP_QUOTED.TrimEnd("`r", "`n")
    $mutants = @(
        @{ Name = 'browser parser keeps the spaces (old brace strip)'; File = 'js\main.js'; Expect = 12;
           From = "const colNameRaw = firstToken.replace($NEWJS, '').toUpperCase();"; To = "const colNameRaw = firstToken.replace($OLDJS, '').toUpperCase();" },
        @{ Name = 'browser getCellValue keeps the spaces (hand-built condition + value-side reference)'; File = 'js\main.js'; Expect = 4;
           From = "const cleanColName = String(colName).replace($NEWJS, '').toUpperCase();"; To = "const cleanColName = String(colName).replace($OLDJS, '').toUpperCase();" },
        @{ Name = 'browser canonicalizer is a no-op'; File = 'js\main.js'; Expect = 6;
           From = $CANON_JS; To = "return String(text == null ? '' : text);" },
        @{ Name = 'B parser keeps the spaces'; File = 'penumbra_search.php'; Expect = 12;
           From = "`$colNameRaw = strtoupper(preg_replace($NEWB, '', `$firstToken));"; To = "`$colNameRaw = strtoupper(preg_replace($OLDB, '', `$firstToken));" },
        @{ Name = 'B evaluator strip keeps the spaces'; File = 'penumbra_search.php'; Expect = 1;
           From = "`$colName = preg_replace($NEWB, '', `$part['column']);"; To = "`$colName = preg_replace($OLDB, '', `$part['column']);" },
        @{ Name = 'B value-side reference keeps the spaces'; File = 'penumbra_search.php'; Expect = 3;
           From = "_search_get_cell_value(preg_replace($NEWB, '', `$phMatch[0]), `$rowUpper)"; To = "_search_get_cell_value(`$phMatch[1], `$rowUpper)" },
        @{ Name = 'php_apply_search_filter substitutes WITHOUT normalizing (the hazard)'; File = 'penumbra_search.php'; Expect = 2;
           From = '$resolvedFilter = penumbraCanonicalBraceTokens($searchFilter);'; To = '$resolvedFilter = $searchFilter;' },
        @{ Name = 'the PHP canonicalizer skips quoted spans again (a quoted "{ DEPT }" escapes substitution)'; File = 'penumbra_search.php'; Expect = 4;
           From = $CANON_PHP; To = $CANON_PHP_QUOTED },
        @{ Name = 'the PHP canonicalizer is a no-op'; File = 'penumbra_search.php'; Expect = 9;
           From = $CANON_PHP; To = 'return $text;' },
        @{ Name = 'C parser keeps the spaces'; File = 'schedule_runner.php'; Expect = 12;
           From = "`$colName = strtoupper(preg_replace($NEWC, '', `$t0));"; To = "`$colName = strtoupper(preg_replace($OLDC, '', `$t0));" },
        @{ Name = 'C _cf_get_cell_value keeps the spaces'; File = 'schedule_runner.php'; Expect = 4;
           From = "`$key = strtoupper(preg_replace($NEWC, '', (string)`$colName));"; To = "`$key = strtoupper(preg_replace($OLDC, '', (string)`$colName));" },
        @{ Name = 'the group-summary resolver substitutes without normalizing'; File = 'schedule_runner.php'; Expect = 1;
           From = '$searchFilter = penumbraCanonicalBraceTokens($searchFilter);   // "{ DEPT }" = "{DEPT}" before substituting'; To = '' },
        @{ Name = 'the runner no longer normalizes the options it loads'; File = 'schedule_runner.php'; Expect = 1;
           From = '$options[$cbKey] = penumbraCanonicalBraceTokens($options[$cbKey]);'; To = '$options[$cbKey] = $options[$cbKey];' },
        @{ Name = 'the scheduler form tests the RAW filter for recipient variables'; File = 'js\main.js'; Expect = 1;
           From = "if (re.test(_pnbCanonBraceTokens(`$('#schedSearchFilter').val() || ''))) return true;"; To = "if (re.test(String(`$('#schedSearchFilter').val() || ''))) return true;" },
        # --- the grammar alignment (2026-09-23 night) ---
        @{ Name = 'B loses the {COLUMN} VALUE fallback (two global terms again)'; File = 'penumbra_search.php'; Expect = 1;
           From = '} elseif ($opKey === null && $operatorToken !== null) {'; To = '} elseif (false) {' },
        @{ Name = 'B loses the contains word operator'; File = 'penumbra_search.php'; Expect = 3;
           From = "`n        'contains' => 'contains',`n        '>=' => '>=',"; To = "`n        '>=' => '>=',"},
        @{ Name = 'B lets a bare contains lead a global search'; File = 'penumbra_search.php'; Expect = 2;
           From = '$isPart1Op = ($part1 === ''contains'') ? null : $part1AnyOp;'; To = '$isPart1Op = $part1AnyOp;' },
        @{ Name = 'B reads "X contains Y" as a literal comparison'; File = 'penumbra_search.php'; Expect = 1;
           From = '$isPart2Op = ($part2 !== null && $part2 !== ''contains'') ?'; To = '$isPart2Op = ($part2 !== null) ?' },
        @{ Name = 'C loses the contains word operator'; File = 'schedule_runner.php'; Expect = 3;
           From = "        'contains' => 'contains',`n        '>=' => '>=', '=>' => '>=',"; To = "        '>=' => '>=', '=>' => '>=',"},
        @{ Name = 'C lets a bare contains lead a global search'; File = 'schedule_runner.php'; Expect = 2;
           From = '$t0IsOp = ($t0 === ''contains'') ? null : $t0AnyOp;'; To = '$t0IsOp = $t0AnyOp;' },
        @{ Name = 'C reads "X contains Y" as a literal comparison'; File = 'schedule_runner.php'; Expect = 1;
           From = 'if ($t1 !== null && $t1 !== ''contains'') {'; To = 'if ($t1 !== null) {' }
    )
    $latin1 = [Text.Encoding]::GetEncoding(28591)
    foreach ($m in $mutants) {
        $target = Join-Path $mapp $m.File
        $orig = [IO.File]::ReadAllBytes($target)
        $text = $latin1.GetString($orig)
        $from = $m.From; $to = $m.To
        if ($text.IndexOf("`r`n") -ge 0) { $from = $from.Replace("`n", "`r`n"); $to = $to.Replace("`n", "`r`n") }
        $hits = ($text.Length - $text.Replace($from, '').Length) / $from.Length
        if ($hits -ne 1) { Write-Host ("MUTANT NOT APPLICABLE (anchor found {0}x, need 1): {1}" -f $hits, $m.Name); $allGood = $false; continue }
        [IO.File]::WriteAllBytes($target, $latin1.GetBytes($text.Replace($from, $to)))
        $r = Invoke-BraceSuite $mapp
        [IO.File]::WriteAllBytes($target, $orig)
        if ($r.Fail -ne $m.Expect) { $allGood = $false }
        Write-Host ("{0} mutant '{1}' -> FAIL: {2} (expected {3})" -f $(if ($r.Fail -eq $m.Expect) { 'OK  ' } else { 'BAD ' }), $m.Name, $r.Fail, $m.Expect)
        if ($r.Fail -ne $m.Expect) { $r.Lines | Where-Object { $_ -match 'FAIL' } | Select-Object -First 12 | ForEach-Object { Write-Host ('       ' + $_) } }
    }
    Write-Host ('MUTANTS: ' + $(if ($allGood) { 'ALL BITE' } else { 'PROBLEM' }))
} finally {
    try { [IO.Directory]::Delete($work, $true) } catch { }
}
