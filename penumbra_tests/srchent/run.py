# =============================================================================
# SRCHENT SUITE (2026-10-26): the server search engine reads a cell EXACTLY as the
# report page's search does. penumbra_search.php's _search_get_cell_value() used to
# strip @@HTML + strip_tags() + trim() WITHOUT decoding entities, while main.js's
# evaluateParsedQuery getCellValue decodes them first (decodeHtmlEntities: amp lt gt
# quot apos, nbsp as a plain space, &#d; / &#xh; as one UTF-16 unit) - so a filter on
# "Crop &amp; Soil" matched on screen and missed in scheduled sends, the ?json=1 lane
# and dashboards. The tag strip (/<[^>]*>/ vs strip_tags), the trim (JS trim() vs
# PHP trim()) and the nested @@JSON values (an @@HTML one stripped on screen, raw on
# the server) are aligned in the same round.
#
# How: corpus.json (built by mk_corpus.py) goes through BOTH engines -
#   browser  harness.html boots the REAL main.js in headless Edge (hooks patched in
#            as the closure's first statement; getCellValue named so it can be
#            called) and prints every cell read, every row's nested values, and
#            every query's rows (parseAdvancedQuery + evaluateParsedQuery with the
#            page's own column list, penumbraFlatSearchColumns)
#   server   php_side.php: _search_get_cell_value, _search_get_virtual_columns,
#            _search_get_structured_virtual_data and php_apply_search_filter
# and this script compares them. Edge runs ONCE per invocation; the control and the
# mutants only re-run the PHP half.
#
#   H-boot       the browser half booted (no fatal, the page's column list holds #, SUB, AMT2)
#   B-<slug>     the BROWSER returns exactly the query's expected rows (the corpus is right)
#   R-<rid>      the server reads every cell of that row exactly as the browser
#                (a lone UTF-16 surrogate on screen = U+FFFD on the server, by design)
#   R-utf8       every server read is UTF-8
#   N-<rid>-virt / N-<rid>-row   a row's nested values: getVirtualColumnsForRow /
#                getStructuredVirtualData (the __ROW path) = the server's two readers
#   Q-<slug>     the SERVER returns exactly the query's expected rows
#
#   py -3 run.py                     the live penumbra_search.php           EXPECTED: GREEN
#   py -3 run.py --stage DIR         DIR\penumbra_search.php                EXPECTED: GREEN
#   py -3 run.py --control           penumbra_search.php at CONTROL_REV (before this round):
#                                    EXACTLY the CONTROL_RED asserts fail
#   py -3 run.py --stage DIR --mutants   every mutant on DIR's file: EXACTLY its asserts red
#   py -3 run.py --mutant NAME       one (anchors are checked first: each must occur once)
#   --all = target + --control + --mutants in one run (one Edge run)
#   --mainjs / --tilesjs FILE        another main.js / penumbra_tiles.js for the browser half
# Needs py -3 and the PHP 8.2 CLI. Stages into %TEMP% (pnb_srchent_*); writes nothing
# to the webroot. One headless suite at a time on this workstation: it waits while
# another headless Edge runs.
# =============================================================================
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js']

# The last penumbra_search.php before this round (96ae478, live at 4247670).
CONTROL_REV = '96ae478'
# What that build gets wrong, each one a reading rule this round adds (see corpus.json).
CONTROL_RED = ['N-nested-row', 'N-nested-virt', 'Q-astral', 'Q-athtml', 'Q-bigtag', 'Q-bom', 'Q-comment', 'Q-containamp', 'Q-dollar', 'Q-entitygone', 'Q-eqamp', 'Q-exactamp', 'Q-ff', 'Q-ideo', 'Q-link', 'Q-linkglobal', 'Q-lonelt', 'Q-ltgtempty', 'Q-nbsp160', 'Q-nbspmid', 'Q-nbspraw', 'Q-nesthtml', 'Q-nestnbsp', 'Q-nul', 'Q-onepass', 'Q-padded', 'Q-pair', 'Q-pct', 'Q-phamp', 'Q-quotedgt', 'Q-quotes', 'Q-regexamp', 'Q-rowhtml', 'Q-unknown', 'R-amp', 'R-astral', 'R-athtml', 'R-bigtag', 'R-bom', 'R-comment', 'R-dollar', 'R-ff', 'R-hexround', 'R-hugedec', 'R-ideo', 'R-link', 'R-lone', 'R-lonelt', 'R-ltgt', 'R-nbsp160', 'R-nbspent', 'R-nbspmid', 'R-nbspraw', 'R-nested', 'R-nul', 'R-onepass', 'R-pair', 'R-pathob', 'R-pct', 'R-quotedgt', 'R-quotes', 'R-rawamp', 'R-unknown']

# name: (old, new, the asserts that MUST go red - exactly). Lines join with \n here;
# they are matched as CRLF in a CRLF file. Each old must occur exactly once.
MUTANTS = {
    'nodecode':   (r"    $raw = _search_decode_entities(isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '');",
                   r"    $raw = isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '';", ['Q-astral', 'Q-athtml', 'Q-bigtag', 'Q-containamp', 'Q-dollar', 'Q-entitygone', 'Q-eqamp', 'Q-exactamp', 'Q-link', 'Q-linkglobal', 'Q-lonelt', 'Q-ltgtempty', 'Q-nbsp160', 'Q-nbspmid', 'Q-onepass', 'Q-padded', 'Q-pair', 'Q-phamp', 'Q-quotes', 'Q-regexamp', 'Q-unknown', 'R-amp', 'R-astral', 'R-athtml', 'R-bigtag', 'R-dollar', 'R-hexround', 'R-hugedec', 'R-link', 'R-lone', 'R-lonelt', 'R-ltgt', 'R-nbsp160', 'R-nbspent', 'R-nbspmid', 'R-nested', 'R-onepass', 'R-pair', 'R-pathob', 'R-quotes', 'R-rawamp', 'R-unknown']),
    'named':      (r"'/&(amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-fA-F]+));/'", r"'/&(amp|lt|gt|quot|apos|nbsp);/'", ['Q-astral', 'Q-athtml', 'Q-dollar', 'Q-nbsp160', 'Q-pair', 'Q-unknown', 'R-astral', 'R-athtml', 'R-dollar', 'R-hexround', 'R-hugedec', 'R-lone', 'R-nbsp160', 'R-pair', 'R-unknown']),
    'htmldecode': (r"    $out = preg_replace_callback('/&(amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-fA-F]+));/', '_search_decode_entity', $s);",
                   r"    $out = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');", ['Q-astral', 'Q-nbspmid', 'Q-pair', 'Q-unknown', 'R-astral', 'R-hexround', 'R-hugedec', 'R-lone', 'R-nbspmid', 'R-pair', 'R-unknown']),
    'twopass':    (r"_search_decode_entities(isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '')",
                   r"_search_decode_entities(_search_decode_entities(isset($rowUpper[$key]) ? (string)$rowUpper[$key] : ''))", ['Q-onepass', 'R-onepass']),
    'nbspchar':   (r"'nbsp' => ' ');", r"'nbsp' => " + '"' + r"\xC2\xA0" + '"' + ");", ['Q-nbspmid', 'R-nbspmid']),
    'mask16':     (r"if (strlen($digits) <= 15) return (int)$digits & 0xFFFF;", r"if (strlen($digits) <= 15) return (int)$digits;", ['Q-astral', 'R-astral', 'R-utf8']),
    'hugedec':    (r"return is_finite($f) ? (int)fmod($f, 65536.0) : 0;", r"return (int)$digits & 0xFFFF;", ['R-hugedec']),
    'hextrunc':   (r"if ($rest[0] === '1' && (($m & 1) || strpos($rest, '1', 1) !== false)) $m++;", r"", ['R-hexround']),
    'hexhalfup':  (r"if ($rest[0] === '1' && (($m & 1) || strpos($rest, '1', 1) !== false)) $m++;", r"if ($rest[0] === '1') $m++;", ['R-hexround']),
    'nopair':     (r"        $out = preg_replace_callback('/\xED([\xA0-\xAF])([\x80-\xBF])\xED([\xB0-\xBF])([\x80-\xBF])/', '_search_join_surrogates', $out);",
                   r"", ['Q-pair', 'R-pair']),
    'pairorder':  (r"'/\xED([\xA0-\xAF])([\x80-\xBF])\xED([\xB0-\xBF])([\x80-\xBF])/'",
                   r"'/\xED([\xA0-\xBF])([\x80-\xBF])\xED([\xA0-\xBF])([\x80-\xBF])/'", ['R-lone']),
    'lonedrop':   (r"        $out = preg_replace('/\xED[\xA0-\xBF][\x80-\xBF]/', " + '"' + r"\xEF\xBF\xBD" + '"' + ", $out);",
                   r"        $out = preg_replace('/\xED[\xA0-\xBF][\x80-\xBF]/', '', $out);", ['Q-lone', 'R-lone']),
    'striptags':  (r"        $raw = preg_replace('/<[^>]*>/', '', $raw);", r"        $raw = strip_tags($raw);", ['Q-bigtag', 'Q-comment', 'Q-pct', 'Q-quotedgt', 'R-bigtag', 'R-comment', 'R-nested', 'R-pct', 'R-quotedgt']),
    'phptrim':    (r"    return _search_js_trim($raw);", r"    return trim($raw);", ['Q-bom', 'Q-ff', 'Q-ideo', 'Q-nbsp160', 'Q-nbspraw', 'Q-nul', 'R-bom', 'R-ff', 'R-hugedec', 'R-ideo', 'R-nbsp160', 'R-nbspraw', 'R-nul']),
    'trimnul':    (r'    $s = trim($s, " \t\n\r\x0B\x0C");', r'    $s = trim($s, " \t\n\r\x0B\x0C\0");', ['Q-nul', 'R-hugedec', 'R-nul']),
    'prefilter':  (r"    if ($s === '' || (ord($s[0]) < 0xC2 && ord(substr($s, -1)) < 0x80)) {",
                   r"    if ($s === '' || ord($s[0]) < 0xC2 || ord(substr($s, -1)) < 0x80) {", ['Q-bom', 'R-bom']),
    'mongol':     (r"\x{205F}\x{3000}\x{FEFF}]';", r"\x{205F}\x{3000}\x{FEFF}\x{180E}]';", ['Q-mongol', 'R-mongol']),
    'htmlfirst':  ("    $raw = _search_decode_entities(isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '');\n\n"
                   "    // Strip @@HTML prefix\n    if (strpos($raw, '@@HTML') === 0) {\n        $raw = substr($raw, 6);\n    }",
                   "    $raw = isset($rowUpper[$key]) ? (string)$rowUpper[$key] : '';\n\n"
                   "    // Strip @@HTML prefix\n    if (strpos($raw, '@@HTML') === 0) {\n        $raw = substr($raw, 6);\n    }\n"
                   "    $raw = _search_decode_entities($raw);", ['Q-athtml', 'R-athtml']),
    'nestraw':    (r"    return _search_js_trim(preg_replace('/<[^>]*>/', '', substr($s, 6)));", r"    return $s;", ['N-nested-row', 'N-nested-virt', 'Q-nesthtml', 'Q-nestnbsp', 'Q-rowhtml']),
    'nestdecode': (r"    $s = ($val === null) ? '' : (string)$val;", r"    $s = _search_decode_entities(($val === null) ? '' : (string)$val);", ['N-nested-row', 'N-nested-virt', 'Q-nesthtml', 'Q-nestnbsp', 'Q-nestnodec', 'Q-nestraw', 'Q-rowhtml']),
    'nesttrim':   ("    if (strpos($s, '@@HTML') !== 0) {\n        return $s;", "    if (strpos($s, '@@HTML') !== 0) {\n        return trim($s);", ['N-nested-row', 'N-nested-virt', 'Q-nestspaced']),
    'nestvirt':   (r"                $virtualCols[$upperKey][] = _search_nested_value(isset($jsonRow[$key]) ? $jsonRow[$key] : '');",
                   "                $val = isset($jsonRow[$key]) ? $jsonRow[$key] : '';\n"
                   "                $virtualCols[$upperKey][] = ($val === null) ? '' : (string)$val;", ['N-nested-virt', 'Q-nesthtml', 'Q-nestnbsp']),
    'nestrow':    (r"                $rowMap[strtoupper($k)] = _search_nested_value(isset($jsonRow[$k]) ? $jsonRow[$k] : '');",
                   "                $val = isset($jsonRow[$k]) ? $jsonRow[$k] : '';\n"
                   "                $rowMap[strtoupper($k)] = ($val === null) ? '' : (string)$val;", ['N-nested-row', 'Q-rowhtml']),
}


def log(s):
    print(s, flush=True)


def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_srchent_' } | "
          "Measure-Object | ForEach-Object { $_.Count }")
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60).stdout
        return int((out or '0').strip() or 0)
    except Exception:
        return 0


def browser_half(mainjs, tilesjs):
    work = tempfile.mkdtemp(prefix='pnb_srchent_')
    try:
        for f in LIBS:
            shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
        shutil.copyfile(tilesjs, os.path.join(work, 'penumbra_tiles.js'))
        shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(work, 'harness.html'))
        with open(os.path.join(HERE, 'corpus.json'), encoding='ascii') as f:
            corpus_text = f.read()
        with open(os.path.join(work, 'corpus.js'), 'w', encoding='ascii', newline='') as f:
            f.write('window.CORPUS = ' + corpus_text.strip() + ';\n')
        with open(mainjs, encoding='utf-8', newline='') as f:
            src = f.read()
        anchor = '$(document).ready(function () {'
        if anchor not in src[:200]:
            raise SystemExit('main.js closure anchor not found - update run.py')
        gcv = 'const getCellValue = (colName) => {'
        if src.count(gcv) != 1:
            raise SystemExit('getCellValue anchor found %d times in main.js, expected 1' % src.count(gcv))
        hooks = ('try { window.__SE = { parseQ: parseAdvancedQuery, evalQ: evaluateParsedQuery, '
                 'virt: getVirtualColumnsForRow, struct: getStructuredVirtualData, flatCols: penumbraFlatSearchColumns, '
                 'setRows: function (r) { masterRowData = r; } }; } catch (e) { window.__SE_ERR = String(e); }')
        i = src.index(anchor)
        src = src[:i] + anchor + '\r\n    ' + hooks + '\r\n' + src[i + len(anchor):]
        src = src.replace(gcv, 'const getCellValue = window.__SE_gcv = (colName) => {')
        with open(os.path.join(work, 'main_patched.js'), 'w', encoding='utf-8', newline='') as f:
            f.write(src)
        waited = 0
        while other_headless_edge() and waited < 1200:
            if waited == 0:
                log('      another headless Edge is running - waiting (up to 20 min) ...')
            time.sleep(15)
            waited += 15
        url = 'file:///' + work.replace('\\', '/') + '/harness.html'
        args = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
                '--user-data-dir=' + os.path.join(work, 'profile'), '--virtual-time-budget=60000', '--dump-dom', url]
        p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            out, _ = p.communicate(timeout=300)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill', '/PID', str(p.pid), '/T', '/F'], capture_output=True)
            raise SystemExit('headless Edge timed out')
        d = out.decode('utf-8', 'replace')
        i = d.find('<pre id="out">')
        j = d.find('</pre>', i)
        if i < 0:
            raise SystemExit('no <pre id=out> in the dump (%d bytes)' % len(d))
        txt = html.unescape(d[i + 14:j])
        if not txt.startswith('RESULTS_JSON:'):
            raise SystemExit('harness did not finish: ' + txt[:400])
        return json.loads(txt[13:])
    finally:
        for _ in range(5):
            try:
                shutil.rmtree(work)
                break
            except OSError:
                time.sleep(2)


def server_half(search_php):
    r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', os.path.join(HERE, 'php_side.php'), search_php,
                        os.path.join(HERE, 'corpus.json')], capture_output=True, timeout=300)
    if r.returncode != 0:
        return {'fatal': (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}
    try:
        return json.loads(r.stdout.decode('utf-8'))
    except ValueError:
        return {'fatal': 'php_side.php printed no JSON: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}


def lone_to_fffd(v):
    # A lone UTF-16 surrogate (json.loads keeps one; a real pair is already one character).
    if isinstance(v, str):
        return ''.join(chr(0xFFFD) if 0xD800 <= ord(ch) <= 0xDFFF else ch for ch in v)
    if isinstance(v, list):
        return [lone_to_fffd(x) for x in v]
    if isinstance(v, dict):
        return {k: lone_to_fffd(x) for k, x in v.items()}
    return v


def show(v):
    return json.dumps(v, ensure_ascii=True)


def browser_asserts(js, corpus):
    out = []
    cols = [c.upper() for c in js.get('cols', [])]
    out.append(('H-boot', not js.get('fatal') and all(c in cols for c in ('#', 'SUB', 'AMT2')),
                'fatal=%s cols=%s pageErrors=%s' % (js.get('fatal'), cols, js.get('pageErrors'))))
    for q in corpus['queries']:
        got = js.get('q', {}).get(q['slug'])
        out.append(('B-' + q['slug'], got == q['expect'], '%s: browser %s, expected %s' % (q['q'], show(got), show(q['expect']))))
    return out


def server_asserts(js, srv, corpus):
    if srv.get('fatal'):
        return [('S-fatal', False, srv['fatal'])]
    out = []
    jr, sr = lone_to_fffd(js.get('reads', {})), srv.get('reads', {})
    for row in corpus['rows']:
        rid = row['RID']
        bad = [c for c in corpus['columns'] if (jr.get(rid) or {}).get(c) != (sr.get(rid) or {}).get(c)]
        out.append(('R-' + rid, not bad, '; '.join('%s raw %s: browser %s, server %s' % (
            c, show(row[c]), show((jr.get(rid) or {}).get(c)), show((sr.get(rid) or {}).get(c))) for c in bad)))
    out.append(('R-utf8', not srv.get('notutf8'), 'not UTF-8: %s' % srv.get('notutf8')))
    jv, sv, js_, ss = lone_to_fffd(js.get('virt', {})), srv.get('virt', {}), lone_to_fffd(js.get('struct', {})), srv.get('struct', {})
    for row in corpus['rows']:
        rid = row['RID']
        if '@@JSON' not in row.get('SUBS', ''):
            continue
        a, b = jv.get(rid) or {}, sv.get(rid) or {}
        out.append(('N-%s-virt' % rid, a == b, 'browser %s, server %s' % (show(a), show(b))))
        a, b = js_.get(rid) or [], ss.get(rid) or []
        out.append(('N-%s-row' % rid, a == b, 'browser %s, server %s' % (show(a), show(b))))
    for q in corpus['queries']:
        got = srv.get('q', {}).get(q['slug'])
        out.append(('Q-' + q['slug'], got == q['expect'], '%s: server %s, expected %s (browser %s)' % (
            q['q'], show(got), show(q['expect']), show(js.get('q', {}).get(q['slug'])))))
    return out


def report(title, results, expect_red=None):
    reds = [n for n, ok, _ in results if not ok]
    log('--- %s: %d asserts, %d red' % (title, len(results), len(reds)))
    for n, ok, d in results:
        if not ok:
            log('  RED   %s\n        %s' % (n, d[:900]))
    if expect_red is None:
        verdict = not reds
        log('  %s' % ('GREEN' if verdict else 'FAIL'))
    else:
        verdict = sorted(reds) == sorted(expect_red)
        if not verdict:
            log('  EXPECTED red %s' % sorted(expect_red))
            log('  missing %s / extra %s' % (sorted(set(expect_red) - set(reds)), sorted(set(reds) - set(expect_red))))
        log('  %s' % ('EXACT' if verdict else 'NOT EXACT'))
    return verdict, reds


def apply_mutant(text, name):
    old, new, _ = MUTANTS[name]
    if '\r\n' in text:
        old, new = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    n = text.count(old)
    if n != 1:
        raise SystemExit("mutant '%s' anchor found %d times, expected 1: %s" % (name, n, old[:160]))
    return text.replace(old, new)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default='')
    ap.add_argument('--search', default='')
    ap.add_argument('--mainjs', default=os.path.join(APP, 'js', 'main.js'))
    ap.add_argument('--tilesjs', default=os.path.join(APP, 'js', 'penumbra_tiles.js'))
    ap.add_argument('--control', action='store_true')
    ap.add_argument('--mutants', action='store_true')
    ap.add_argument('--mutant', default='')
    ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    target = a.search or (os.path.join(a.stage, 'penumbra_search.php') if a.stage else os.path.join(APP, 'penumbra_search.php'))
    with open(os.path.join(HERE, 'corpus.json'), encoding='ascii') as f:
        corpus = json.load(f)
    log('srchent: %d rows, %d queries' % (len(corpus['rows']), len(corpus['queries'])))
    log('  main.js            %s' % a.mainjs)
    log('  penumbra_search    %s' % target)
    t0 = time.time()
    js = browser_half(a.mainjs, a.tilesjs)
    log('  browser half: %.0f s' % (time.time() - t0))
    b = browser_asserts(js, corpus)
    ok_b, _ = report('browser (the corpus is right)', b)
    ok = ok_b
    only_mutants = bool(a.mutant) or (a.mutants and not a.all)
    if not (a.control and not a.all) and not only_mutants:
        v, _ = report('server: ' + target, server_asserts(js, server_half(target), corpus))
        ok = ok and v
    if a.control or a.all:
        tmp = tempfile.mkdtemp(prefix='pnb_srchent_ctl_')
        try:
            ctl = os.path.join(tmp, 'penumbra_search.php')
            env = dict(os.environ, GIT_DIR=GIT_DIR)
            blob = subprocess.run(['git', 'show', CONTROL_REV + ':penumbra_search.php'], capture_output=True, env=env, timeout=120)
            if blob.returncode != 0 or not blob.stdout:
                raise SystemExit('git show %s:penumbra_search.php failed: %s' % (CONTROL_REV, blob.stderr.decode('utf-8', 'replace')))
            with open(ctl, 'wb') as f:
                f.write(blob.stdout)
            v, _ = report('CONTROL (%s)' % CONTROL_REV, server_asserts(js, server_half(ctl), corpus), CONTROL_RED or [])
            ok = ok and v and CONTROL_RED is not None
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    names = [a.mutant] if a.mutant else (sorted(MUTANTS) if (a.mutants or a.all) else [])
    if names:
        with open(target, 'rb') as f:
            base = f.read().decode('utf-8')
        tmp = tempfile.mkdtemp(prefix='pnb_srchent_mut_')
        try:
            failed = []
            for name in names:
                path = os.path.join(tmp, 'penumbra_search.php')
                with open(path, 'wb') as f:
                    f.write(apply_mutant(base, name).encode('utf-8'))
                v, reds = report('MUTANT %s' % name, server_asserts(js, server_half(path), corpus), MUTANTS[name][2] or [])
                if not v or MUTANTS[name][2] is None:
                    failed.append(name)
            log('mutants: %d run, %d exact' % (len(names), len(names) - len(failed)) + (' - not exact: %s' % failed if failed else ''))
            ok = ok and not failed
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    log('RESULT: %s' % ('PASS' if ok else 'FAIL'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
