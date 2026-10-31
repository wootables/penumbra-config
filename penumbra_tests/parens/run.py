# =============================================================================
# PARENS SUITE (2026-10-30): parentheses group conditions in the filter text, the same way
# in all THREE engines. `(A or B) and C` used to read as search text (`(A` a literal, `C)`
# a value): now a `(` / `)` outside quotes, regex, //exact// and {column}, never in a value
# slot, and balanced, opens / closes a group that is reduced on its own (AND first, then OR).
# Unbalanced parens still read as before; a paren in a value slot (`D = (x)`) stays a value.
#
# How: corpus.json (rows + queries with the rows each must return) goes through
#   browser  harness.html boots the REAL main.js in headless Edge (hooks patched in as the
#            closure's first statement) - parseAdvancedQuery + evaluateParsedQuery with the
#            page's own column list
#   search   php_side.php: php_apply_search_filter (penumbra_search.php, pure declarations)
#   format   php_side.php: parse_format_condition + evaluate_format_condition, lifted out of
#            schedule_runner.php by pivotparity\extract_mirror.php (never the runner itself)
# and this script compares each with the corpus.
#
#   H-boot       the browser half booted (no fatal; the column list holds #, K, V)
#   B-<slug>     the BROWSER returns exactly the expected rows
#   Q-<slug>     the SEARCH engine (penumbra_search.php) returns exactly the expected rows
#   F-<slug>     the FORMAT engine (schedule_runner.php) returns exactly the expected rows
#                (queries marked noFormat, nested columns, have no F assert)
#
#   py -3 run.py                        the live files                          EXPECTED: GREEN
#   py -3 run.py --stage DIR            DIR\js\main.js, DIR\penumbra_search.php,
#                                       DIR\schedule_runner.php (missing -> live)  EXPECTED: GREEN
#   py -3 run.py --control              the three files at CONTROL_REV (before this round):
#                                       EXACTLY the CONTROL_RED asserts fail (every paren query)
#   py -3 run.py --stage DIR --mutants  every mutant on DIR's files: EXACTLY its asserts red
#   py -3 run.py --mutant NAME          one (anchors are checked first: each must occur once)
#   --all = target + --control + --mutants in one run
# Needs py -3 and the PHP 8.2 CLI. Stages into %TEMP% (pnb_parens_*); writes nothing to the
# webroot. One headless suite at a time on this workstation: it waits while another runs.
# =============================================================================
import argparse, html, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = os.path.dirname(HERE)
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
EXTRACT = os.path.join(TESTS, 'pivotparity', 'extract_mirror.php')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js']
REL = {'main': 'js/main.js', 'search': 'penumbra_search.php', 'runner': 'schedule_runner.php'}

# The last commit before this round (live at 10d2ee6, 2026-10-30).
CONTROL_REV = '10d2ee6'

CORPUS_FILE = os.path.join(HERE, 'corpus.json')
for _i, _a in enumerate(sys.argv):
    if _a == '--corpus' and _i + 1 < len(sys.argv):
        CORPUS_FILE = os.path.join(HERE, sys.argv[_i + 1]) if not os.path.isabs(sys.argv[_i + 1]) else sys.argv[_i + 1]
with open(CORPUS_FILE, encoding='utf-8') as _f:
    CORPUS = json.load(_f)
PAREN = [q['slug'] for q in CORPUS['queries'] if q.get('paren')]
NOFMT = set(q['slug'] for q in CORPUS['queries'] if q.get('noFormat'))
B_PAREN = ['B-' + s for s in PAREN]
Q_PAREN = ['Q-' + s for s in PAREN]
F_PAREN = ['F-' + s for s in PAREN if s not in NOFMT]
CONTROL_RED = B_PAREN + Q_PAREN + F_PAREN

# name: (file key, old, new, the asserts that MUST go red - exactly). Each old must occur exactly once.
MUTANTS = {
    'js-nogroup':    ('main', "        return (any && depth === 0) ? { grouped: true, tokens: out } : { grouped: false, tokens: tokens };",
                              "        return { grouped: false, tokens: tokens };", B_PAREN),
    'js-valueslot':  ('main', "            var valueSlot = t > 0 && operatorKeys.indexOf(tokens[t - 1]) !== -1;",
                              "            var valueSlot = false;", ['B-value-slot', 'B-value-slot-and']),
    # (row-only-group: EVERY nested column sits inside the group, so a collector that does not walk into
    # groups finds none and falls back to the flat evaluation, which matches rows 1 and 3 too.)
    'js-rowleaves':  ('main', "        var _rowLeaves = penumbraQueryLeaves(parsedQuery);",
                              "        var _rowLeaves = parsedQuery;", ['B-row-only-group']),
    'php-nogroup':   ('search', "    return ($any && $depth === 0) ? array('grouped' => true, 'tokens' => $out) : array('grouped' => false, 'tokens' => $tokens);",
                                "    return array('grouped' => false, 'tokens' => $tokens);", Q_PAREN),
    'php-valueslot': ('search', "        $valueSlot = $t > 0 && in_array($tokens[$t - 1], $operatorKeys, true);",
                                "        $valueSlot = false;", ['Q-value-slot', 'Q-value-slot-and']),
    'php-rowleaves': ('search', "    foreach (_search_query_leaves($parsedQuery) as $part) {",
                                "    foreach ($parsedQuery as $part) {", ['Q-row-only-group']),
    'php-virt':      ('search', "        if ($_qp['type'] === 'global' || $_qp['type'] === 'condition' || $_qp['type'] === 'group') {",
                                "        if ($_qp['type'] === 'global' || $_qp['type'] === 'condition') {", ['Q-grp-only-nested']),
    'cf-nogroup':    ('runner', "    return ($any && $depth === 0) ? array('grouped' => true, 'tokens' => $out) : array('grouped' => false, 'tokens' => $tokens);",
                                "    return array('grouped' => false, 'tokens' => $tokens);", F_PAREN),
    'cf-valueslot':  ('runner', "        $valueSlot = $t > 0 && in_array($tokens[$t - 1], $operatorKeys, true);",
                                "        $valueSlot = false;", ['F-value-slot', 'F-value-slot-and']),
    'cf-noeval':     ('runner', "            $results[] = evaluate_format_condition($rowData, $part['parts']);",
                                "            $results[] = false;", None),   # filled at run time: every F paren query that has a group node
}


def log(s):
    print(s, flush=True)


def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_parens_' } | "
          "Measure-Object | ForEach-Object { $_.Count }")
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60).stdout
        return int((out or '0').strip() or 0)
    except Exception:
        return 0


def browser_half(mainjs_text):
    work = tempfile.mkdtemp(prefix='pnb_parens_')
    try:
        for f in LIBS:
            shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
        shutil.copyfile(os.path.join(APP, 'js', 'penumbra_tiles.js'), os.path.join(work, 'penumbra_tiles.js'))
        shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(work, 'harness.html'))
        with open(os.path.join(work, 'corpus.js'), 'w', encoding='utf-8', newline='') as f:
            f.write('window.CORPUS = ' + json.dumps(CORPUS, ensure_ascii=True) + ';\n')
        src = mainjs_text
        anchor = '$(document).ready(function () {'
        if anchor not in src[:200]:
            raise SystemExit('main.js closure anchor not found - update run.py')
        hooks = ('try { window.__SE = { parseQ: parseAdvancedQuery, evalQ: evaluateParsedQuery, '
                 'flatCols: penumbraFlatSearchColumns, setRows: function (r) { masterRowData = r; } }; } '
                 'catch (e) { window.__SE_ERR = String(e); }')
        i = src.index(anchor)
        src = src[:i] + anchor + '\r\n    ' + hooks + '\r\n' + src[i + len(anchor):]
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
            return {'fatal': 'harness did not finish: ' + txt[:400]}
        return json.loads(txt[13:])
    finally:
        for _ in range(5):
            try:
                shutil.rmtree(work)
                break
            except OSError:
                time.sleep(2)


def server_half(search_text, runner_text):
    tmp = tempfile.mkdtemp(prefix='pnb_parens_php_')
    try:
        sp = os.path.join(tmp, 'penumbra_search.php')
        rp = os.path.join(tmp, 'schedule_runner.php')
        mp = os.path.join(tmp, 'mirror.php')
        with open(sp, 'wb') as f:
            f.write(search_text.encode('utf-8'))
        with open(rp, 'wb') as f:
            f.write(runner_text.encode('utf-8'))
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', EXTRACT, rp, mp], capture_output=True, timeout=300)
        if r.returncode != 0 or not os.path.isfile(mp):
            return {'fatal': 'extract_mirror: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:1500]}
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', '-d', 'date.timezone=America/New_York',
                            os.path.join(HERE, 'php_side.php'), sp, mp, CORPUS_FILE],
                           capture_output=True, timeout=300)
        if r.returncode != 0:
            return {'fatal': (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}
        try:
            return json.loads(r.stdout.decode('utf-8'))
        except ValueError:
            return {'fatal': 'php_side.php printed no JSON: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:2000]}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def show(v):
    return json.dumps(v, ensure_ascii=True)


def browser_asserts(js):
    out = []
    cols = [str(c).upper() for c in js.get('cols', [])]
    out.append(('H-boot', not js.get('fatal') and all(c in cols for c in ('#', 'K', 'V')),
                'fatal=%s cols=%s pageErrors=%s' % (js.get('fatal'), cols, js.get('pageErrors'))))
    for q in CORPUS['queries']:
        got = js.get('q', {}).get(q['slug'])
        if q.get('expect') is None:   # parity only: the browser's reading is the reference
            out.append(('B-' + q['slug'], isinstance(got, list), '%s: browser %s (parity only)' % (q['q'], show(got))))
            continue
        out.append(('B-' + q['slug'], got == q['expect'], '%s: browser %s, expected %s' % (q['q'], show(got), show(q['expect']))))
    return out


def server_asserts(srv, js=None):
    if srv.get('fatal'):
        return [('S-fatal', False, srv['fatal'])]
    out = []
    def want(q):
        return q['expect'] if q.get('expect') is not None else (js or {}).get('q', {}).get(q['slug'])
    for q in CORPUS['queries']:
        got = srv.get('q', {}).get(q['slug'])
        out.append(('Q-' + q['slug'], got == want(q), '%s: search engine %s, expected %s' % (q['q'], show(got), show(want(q)))))
    for q in CORPUS['queries']:
        if q['slug'] in NOFMT:
            continue
        got = srv.get('f', {}).get(q['slug'])
        out.append(('F-' + q['slug'], got == want(q), '%s: format engine %s, expected %s' % (q['q'], show(got), show(want(q)))))
    return out


def report(title, results, expect_red=None):
    reds = [n for n, ok, _ in results if not ok]
    log('--- %s: %d asserts, %d red' % (title, len(results), len(reds)))
    for n, ok, d in results:
        if not ok:
            log('  RED   %s\n        %s' % (n, d[:600]))
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


def read(path):
    with open(path, 'rb') as f:
        return f.read().decode('utf-8')


def git_show(rel):
    env = dict(os.environ, GIT_DIR=GIT_DIR)
    blob = subprocess.run(['git', 'show', CONTROL_REV + ':' + rel], capture_output=True, env=env, timeout=120)
    if blob.returncode != 0 or not blob.stdout:
        raise SystemExit('git show %s:%s failed: %s' % (CONTROL_REV, rel, blob.stderr.decode('utf-8', 'replace')))
    return blob.stdout.decode('utf-8')


def apply_mutant(texts, name):
    key, old, new, _ = MUTANTS[name]
    text = texts[key]
    if '\r\n' in text:
        old, new = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    n = text.count(old)
    if n != 1:
        raise SystemExit("mutant '%s' anchor found %d times in %s, expected 1: %s" % (name, n, REL[key], old[:160]))
    out = dict(texts)
    out[key] = text.replace(old, new)
    return out


def run_target(title, texts, expect_red=None, js_cache=None):
    js = js_cache if js_cache is not None else browser_half(texts['main'])
    srv = server_half(texts['search'], texts['runner'])
    v, reds = report(title, browser_asserts(js) + server_asserts(srv, js), expect_red)
    return v, reds, js


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default='')
    ap.add_argument('--mainjs', default='')
    ap.add_argument('--search', default='')
    ap.add_argument('--runner', default='')
    ap.add_argument('--control', action='store_true')
    ap.add_argument('--mutants', action='store_true')
    ap.add_argument('--mutant', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--corpus', default='')   # read at import (CORPUS_FILE); listed so argparse accepts it
    a = ap.parse_args()

    def pick(key, override):
        if override:
            return override
        if a.stage:
            p = os.path.join(a.stage, REL[key].replace('/', os.sep))
            if os.path.isfile(p):
                return p
        return os.path.join(APP, REL[key].replace('/', os.sep))
    paths = {'main': pick('main', a.mainjs), 'search': pick('search', a.search), 'runner': pick('runner', a.runner)}
    texts = {k: read(p) for k, p in paths.items()}
    log('parens: %d rows, %d queries (%d paren)' % (len(CORPUS['rows']), len(CORPUS['queries']), len(PAREN)))
    for k in ('main', 'search', 'runner'):
        log('  %-8s %s' % (k, paths[k]))
    # The cf-noeval mutant's expected reds: every F paren query (a group evaluated as false
    # changes each of them; a one-part group is unwrapped, so `single`, `bare-group` and `dangling` stay).
    # ... plus global-in-group, grouped but not paren-marked (the old engines happened to read it right).
    MUTANTS['cf-noeval'] = MUTANTS['cf-noeval'][:3] + ([s for s in F_PAREN if s not in ('F-single', 'F-bare-group', 'F-empty-group', 'F-dangling')] + ['F-global-in-group'],)

    ok = True
    only_mutants = bool(a.mutant) or (a.mutants and not a.all)
    only_control = a.control and not a.all
    t0 = time.time()
    js_target = None
    if not only_mutants and not only_control:
        v, _, js_target = run_target('target', texts)
        log('  (%.0f s)' % (time.time() - t0))
        ok = ok and v
    if a.control or a.all:
        ctl = {k: git_show(REL[k]) for k in REL}
        v, _, _ = run_target('CONTROL (%s)' % CONTROL_REV, ctl, CONTROL_RED)
        ok = ok and v
    names = [a.mutant] if a.mutant else (sorted(MUTANTS) if (a.mutants or a.all) else [])
    if names:
        for name in names:
            apply_mutant(texts, name)   # every anchor first
        if js_target is None:
            js_target = browser_half(texts['main'])
        failed = []
        for name in names:
            mt = apply_mutant(texts, name)
            cache = js_target if MUTANTS[name][0] != 'main' else None
            v, _, _ = run_target('MUTANT %s' % name, mt, MUTANTS[name][3] or [], js_cache=cache)
            if not v or MUTANTS[name][3] is None:
                failed.append(name)
        log('mutants: %d run, %d exact' % (len(names), len(names) - len(failed)) + (' - not exact: %s' % failed if failed else ''))
        ok = ok and not failed
    log('parens: %s (%.0f s)' % ('GREEN' if ok else 'FAIL', time.time() - t0))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
