# =============================================================================
# PARENS SUITE, the builder's names (2026-11-03, parennames): a column name that holds parentheses.
# `HR (D) > 50` is one condition row, inside a group too: a pair whose closer is followed straight by
# an operator is part of the name (sbParenNameMask, as the engines' penumbraParenNameMask), never a
# group of its own - so a grouped filter on such a column is no longer "nested" (the text guard).
# builder_names.html (made from builder.html) drives the REAL js/search_builder.js; the page's
# columns include 'HR (D)' and 'S (NOT X)'.
#
#   py -3 builder_names.py                 live search_builder.js + content      EXPECTED: GREEN
#   py -3 builder_names.py --stage DIR     DIR\js\search_builder.js, DIR\search_builder_content.php
#   py -3 builder_names.py --control       the two files at CONTROL_REV (before the fix): EXACTLY CONTROL_RED
#   py -3 builder_names.py --stage DIR --mutants   each mutant EXACTLY its asserts red
#   --all = target + control + mutants
# =============================================================================
import argparse, html, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
# The build before the fix (live 5b20af4, 2026-11-03).
CONTROL_REV = '5b20af4'
# (live mangles `HR (D) > 50 and A = 1` into four rows and guards n1 / n3 as nested; n4 / n5 hold there too)
CONTROL_RED = ['n1-rows', 'n1-toggles', 'n1-notice', 'n1-preview', 'n2-rows', 'n2-toggles', 'n2-preview', 'n3-rows', 'n3-toggles', 'n3-notice', 'n3-preview']

# name: (old, new, the asserts that MUST go red - exactly). Each old must occur exactly once.
MUTANTS = {
    'nomask': ("        var nameParens = any ? sbParenNameMask(toks, OPS) : null;",
               "        var nameParens = null;",
               CONTROL_RED),   # the mask never consulted = the build before the fix
}


def log(s):
    print(s, flush=True)


def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_parensbn_' } | "
          "Measure-Object | ForEach-Object { $_.Count }")
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60).stdout
        return int((out or '0').strip() or 0)
    except Exception:
        return 0


def content_body(php_text):
    i = php_text.find('?>')
    if i < 0:
        raise SystemExit('search_builder_content.php: no closing PHP tag')
    return php_text[i + 2:]


def run_edge(js_text, content_text):
    work = tempfile.mkdtemp(prefix='pnb_parensbn_')
    try:
        for f in ('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'purify.min.js'):
            shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
        shutil.copyfile(os.path.join(HERE, 'builder_names.html'), os.path.join(work, 'builder_names.html'))
        with open(os.path.join(work, 'search_builder.js'), 'w', encoding='utf-8', newline='') as f:
            f.write(js_text)
        with open(os.path.join(work, 'content.js'), 'w', encoding='utf-8', newline='') as f:
            f.write('window.__SB_CONTENT = ' + json.dumps(content_body(content_text), ensure_ascii=True) + ';\n')
        waited = 0
        while other_headless_edge() and waited < 1200:
            if waited == 0:
                log('      another headless Edge is running - waiting (up to 20 min) ...')
            time.sleep(15)
            waited += 15
        url = 'file:///' + work.replace('\\', '/') + '/builder_names.html'
        args = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
                '--user-data-dir=' + os.path.join(work, 'profile'), '--virtual-time-budget=20000', '--dump-dom', url]
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


def asserts(r):
    if r.get('fatal'):
        return [('H-boot', False, r['fatal'])]
    out = [('H-boot', not r.get('errors'), 'page errors: %s' % r.get('errors'))]
    def st(c):
        return r.get(c) or {}
    def chk(name, ok, detail):
        out.append((name, bool(ok), detail))
    def rows(c, n, toggles, preview):
        s = st(c)
        chk(c + '-rows', s.get('rows') == n, 'rows=%s' % s.get('rows'))
        chk(c + '-toggles', s.get('toggles') == toggles, 'toggles=%s' % s.get('toggles'))
        chk(c + '-notice', not s.get('notice'), 'notice=%r' % s.get('notice'))
        if preview is not None:
            chk(c + '-preview', s.get('preview') == preview, 'preview=%r' % s.get('preview'))
    rows('n1', 3, [False, True, False], '({HR (D)} > 50 or A = 1) and B = 2')
    rows('n2', 2, [False, False], '{HR (D)} > 50 and A = 1')
    rows('n3', 3, [False, True, False], '({S (NOT X)} = yes or A = 1) and B = 2')
    rows('n4', 3, [False, True, False], '(A = 1 or B = 2) and C = 3')
    s = st('n5')
    chk('n5-rows', s.get('rows') == 0, 'rows=%s' % s.get('rows'))
    chk('n5-notice', 'nests' in (s.get('notice') or ''), 'notice=%r' % s.get('notice'))
    return out


def report(title, results, expect_red=None):
    reds = [n for n, ok, _ in results if not ok]
    log('--- %s: %d asserts, %d red' % (title, len(results), len(reds)))
    for n, ok, d in results:
        if not ok:
            log('  RED   %s: %s' % (n, d[:300]))
    if expect_red is None:
        v = not reds
        log('  %s' % ('GREEN' if v else 'FAIL'))
    else:
        v = sorted(reds) == sorted(expect_red)
        if not v:
            log('  missing %s / extra %s' % (sorted(set(expect_red) - set(reds)), sorted(set(reds) - set(expect_red))))
        log('  %s' % ('EXACT' if v else 'NOT EXACT'))
    return v


def read(p):
    with open(p, 'rb') as f:
        return f.read().decode('utf-8')


def git_show(rel):
    env = dict(os.environ, GIT_DIR=GIT_DIR)
    b = subprocess.run(['git', 'show', CONTROL_REV + ':' + rel], capture_output=True, env=env, timeout=120)
    if b.returncode != 0 or not b.stdout:
        raise SystemExit('git show %s:%s failed: %s' % (CONTROL_REV, rel, b.stderr.decode('utf-8', 'replace')))
    return b.stdout.decode('utf-8')


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
    ap.add_argument('--control', action='store_true')
    ap.add_argument('--mutants', action='store_true')
    ap.add_argument('--mutant', default='')
    ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    def pick(rel):
        if a.stage:
            p = os.path.join(a.stage, rel.replace('/', os.sep))
            if os.path.isfile(p):
                return p
        return os.path.join(APP, rel.replace('/', os.sep))
    js, ct = pick('js/search_builder.js'), pick('search_builder_content.php')
    js_text, ct_text = read(js), read(ct)
    ok = True
    t0 = time.time()
    only_mutants = bool(a.mutant) or (a.mutants and not a.all)
    if not (a.control and not a.all) and not only_mutants:
        log('builder: %s\n         %s' % (js, ct))
        ok = report('target', asserts(run_edge(js_text, ct_text))) and ok
    if a.control or a.all:
        ok = report('CONTROL (%s)' % CONTROL_REV, asserts(run_edge(git_show('js/search_builder.js'), git_show('search_builder_content.php'))), CONTROL_RED) and ok
    names = [a.mutant] if a.mutant else (sorted(MUTANTS) if (a.mutants or a.all) else [])
    if names:
        for name in names:
            apply_mutant(js_text, name)
        failed = []
        for name in names:
            v = report('MUTANT %s' % name, asserts(run_edge(apply_mutant(js_text, name), ct_text)), MUTANTS[name][2])
            if not v:
                failed.append(name)
        log('mutants: %d run, %d exact' % (len(names), len(names) - len(failed)) + (' - not exact: %s' % failed if failed else ''))
        ok = ok and not failed
    log('parens builder names: %s (%.0f s)' % ('GREEN' if ok else 'FAIL', time.time() - t0))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
