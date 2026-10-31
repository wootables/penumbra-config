# =============================================================================
# PARENS SUITE, the builder half (2026-10-30, phase 2): group rows in the Visual Filter Builder.
# A row's ( ) toggle groups it with the row above; a run of grouped rows and the row above it is
# one pair of parentheses on the wire, attached by the first row's and / or. One level: a filter
# that nests groups inside groups opens as TEXT (the notice in the footer gap, Filter disabled);
# Clear All or adding a condition lifts that. Plain text, a paren in a value (`D = (x)`) and an
# unbalanced paren open as flat rows. The page's engine (_penumbraSearchAPI.parseQuery) decides
# whether the text groups at all; without it the text does, by the engine's own rule.
#
#   builder.html boots the REAL js/search_builder.js with the real lightbox markup in headless
#   Edge and drives openSearchBuilder; this script asserts on what it prints.
#
#   py -3 builder_run.py                 live search_builder.js + content      EXPECTED: GREEN
#   py -3 builder_run.py --stage DIR     DIR\js\search_builder.js, DIR\search_builder_content.php
#   py -3 builder_run.py --control       the two files at CONTROL_REV (phase 1): EXACTLY CONTROL_RED red
#   py -3 builder_run.py --stage DIR --mutants   each mutant EXACTLY its asserts red
#   --all = target + control + mutants
# =============================================================================
import argparse, html, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
# Phase 1 (live 778acc9): the builder guarded EVERY grouped filter as text and had no group rows.
CONTROL_REV = '778acc9'
GQ = '(A = 1 or B = 2) and C = 3'
# (phase 1 guarded the grouped text: no rows, no toggle element, the preview = the text as typed, so
# g1-preview and g6-preview stay green there; every rows / toggles / head / box / preset assert goes red)
CONTROL_RED = ['g1-rows', 'g1-toggles', 'g1-head', 'g1-last', 'g1-hidden', 'g1-enabled', 'g1-notice',
               'g2a-rows', 'g2a-toggles', 'g2a-preview', 'g2-box', 'g3a-rows', 'g3a-toggles', 'g3b-rows', 'g3b-toggles', 'g3b-preview', 'g3-box',
               'g4-notice', 'g5-notice', 'g6-rows', 'g6-toggles', 'g7-rows', 'g7-toggles', 'g7-value',
               'g9a-grouped', 'g9a-query', 'g9-rows', 'g9-toggles', 'g9-preview',
               'g10-rows', 'g10-toggles', 'g10-preview', 'g11-rows', 'g11-toggles', 'g11-preview', 'g12-rows', 'g12-toggles', 'g12-preview']

# name: (old, new, the asserts that MUST go red - exactly). Each old must occur exactly once.
MUTANTS = {
    'noclose': ("            items.push(run.length === 1 ? run[0] : { frag: '(' + join(run) + ')', joiner: run[0].joiner, group: true });",
                "            items.push.apply(items, run);",
                # (g3a / g3b follow: the box text g2 left behind has no parens, and the engine stub still
                # says 'one', so the text split cannot place the group and that filter opens as text)
                ['g1-preview', 'g2a-preview', 'g2-box', 'g3a-rows', 'g3a-toggles', 'g3b-rows', 'g3b-toggles', 'g3b-preview', 'g3-box',
                 'g6-preview', 'g9a-query', 'g9-preview', 'g12-preview']),
    'noflag':  ("                grouped: getRowGrouped($r)\n            };",
                "                grouped: false\n            };",
                ['g9a-grouped', 'g9-toggles', 'g9-preview']),
    'nonest':  ("        if (nested) return { nested: true };",
                "        if (false) return { nested: true };",
                ['g5-notice', 'g5-disabled']),   # (the walk still stops at the inner `(`, so no row is built either way)
}


def log(s):
    print(s, flush=True)


def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_parensb_' } | "
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
    work = tempfile.mkdtemp(prefix='pnb_parensb_')
    try:
        for f in ('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'purify.min.js'):
            shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
        shutil.copyfile(os.path.join(HERE, 'builder.html'), os.path.join(work, 'builder.html'))
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
        url = 'file:///' + work.replace('\\', '/') + '/builder.html'
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
    def grouped(c, rows, toggles, preview):
        s = st(c)
        chk(c + '-rows', s.get('rows') == rows, 'rows=%s' % s.get('rows'))
        chk(c + '-toggles', s.get('toggles') == toggles, 'toggles=%s' % s.get('toggles'))
        if preview is not None:
            chk(c + '-preview', s.get('preview') == preview, 'preview=%r' % s.get('preview'))
    def guarded(c):
        s = st(c)
        chk(c + '-rows', s.get('rows') == 0, 'rows=%s' % s.get('rows'))
        chk(c + '-notice', 'nests' in (s.get('notice') or ''), 'notice=%r' % s.get('notice'))
        chk(c + '-disabled', s.get('disabled') is True, 'disabled=%s' % s.get('disabled'))
    s = st('g1')
    grouped('g1', 3, [False, True, False], GQ)
    chk('g1-head', s.get('head') == [True, False, False], 'head=%s' % s.get('head'))
    chk('g1-last', s.get('last') == [False, True, False], 'last=%s' % s.get('last'))
    chk('g1-hidden', s.get('hiddenToggle') is True, 'row 1 toggle hidden=%s' % s.get('hiddenToggle'))
    chk('g1-enabled', s.get('disabled') is False, 'disabled=%s' % s.get('disabled'))
    chk('g1-notice', not s.get('notice'), 'notice=%r' % s.get('notice'))
    grouped('g2a', 3, [False, True, True], '(A = 1 or (B = 2 and C = 3))')
    chk('g2-box', st('g2').get('box') == '(A = 1 or B = 2 and C = 3)', 'box=%r' % st('g2').get('box'))
    grouped('g3a', 3, [False, True, True], None)
    grouped('g3b', 3, [False, False, True], 'A = 1 or (B = 2 and C = 3)')
    chk('g3-box', st('g3').get('box') == 'A = 1 or (B = 2 and C = 3)', 'box=%r' % st('g3').get('box'))
    guarded('g4')
    guarded('g5')
    grouped('g6', 3, [False, True, False], GQ)
    s = st('g7')
    grouped('g7', 2, [False, False], None)
    chk('g7-value', s.get('firstValue') == '(x)', 'firstValue=%r' % s.get('firstValue'))
    s = st('g8')
    grouped('g8', 3, [False, False, False], None)
    chk('g8-notice', not s.get('notice'), 'notice=%r' % s.get('notice'))
    s = st('g9a')
    chk('g9a-grouped', s.get('grouped') == [False, True, False], 'saved grouped=%s' % s.get('grouped'))
    chk('g9a-query', s.get('query') == GQ, 'saved query=%r' % s.get('query'))
    grouped('g9', 3, [False, True, False], GQ)
    grouped('g10', 2, [False, False], 'B = 2 and C = 3')
    grouped('g11', 2, [False, False], 'A = 1 and B = 2')
    grouped('g12', 3, [False, True, False], GQ)
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
    log('parens builder: %s (%.0f s)' % ('GREEN' if ok else 'FAIL', time.time() - t0))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
