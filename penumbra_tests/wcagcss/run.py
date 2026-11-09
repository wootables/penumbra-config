"""wcagcss - the November WCAG Moderate CSS + health-log fixes (wcag mod 2026-11-07), headless Edge.

  py -3 run.py [--stage DIR] [--mutant NAME | --mutants] [--keep]

  DIR directly holds css\\main.css and health.php (default: the LIVE webroot). js\\penumbra_help_ask.js,
  help\\topics\\askHelpLightbox.php and themes_config.php are read from DIR when present, else from live.

CHECKS (one line each in the page's <pre id="out">, per theme where it says so):
  C11-*-<theme>  M11  the Ask button, your own vote and "Ask the help instead" >= 4.5:1 on every theme:
                      white on the deep fill on the seven DEEPFILL (bright-brand) themes, the theme's
                      --on-brand ink on the six light-brand themes
  C18-cursor     M18  Amber Terminal's title cursor: pnbHdrCursor, a finite count <= 5 (not infinite)
  C18-static     M18  ... and the cursor itself is still there (a static block once the blinks end)
  C19-open       M19  a log re-read keeps an opened "x N" run open (class on + aria-expanded)
  C19-focus      M19  ... and gives focus back to the count button that had it
  C19-newest     M19  ... the run key survives "newest first" (the earliest time keys the run)
  C19-nosteal    M19  ... and never pulls focus in from outside the log
  C20-*-<theme>  M20  a known-window outage row: opacity 1, every cell >= 4.5:1, the component muted
  C21-<theme>    M21  the Outage history export icon at rest: opacity 1 and >= 3:1

MUTANTS (single-point reverts of the stage; each must turn exactly its own checks red):
  m11 (C11 on the 7 DEEPFILL themes), m11ink (C11 on the 6 light-brand themes), m18 (C18-cursor), m19open (C19-open, C19-newest), m19focus (C19-focus), m20 (C20), m21 (C21)
"""
import argparse, os, re, shutil, subprocess, sys, tempfile, time, uuid

LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
HERE = os.path.dirname(os.path.abspath(__file__))
EDGE = next((p for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                         r'C:\Program Files\Microsoft\Edge\Application\msedge.exe') if os.path.exists(p)), None)

# name: (file, new text in the stage, the original text it reverts to)
MUTANTS = {
    'm11': ('css/main.css', '    .pnb-ask-from-search\r\n) {\r\n    --brand-primary: var(--pnb-fill);',
                            '    .pnb-ask-from-search\r\n) {\r\n    --brand-primary-x: var(--pnb-fill);'),
    'm11ink': ('css/main.css', '    color: var(--on-brand) !important;\r\n}', '    --x-m11ink: 0;\r\n}'),
    'm18': ('css/main.css', 'animation: pnbHdrCursor 1.1s steps(1) 5;', 'animation: pnbHdrCursor 1.1s steps(1) infinite;'),
    'm19open': ('health.php', 'if (keepOpen[gk]) {', 'if (false) {'),
    'm19focus': ('health.php', 'if (keepFocus !== null) { try', 'if (false) { try'),
    'm20': ('css/main.css', '.pnb-row.kw .c, .pnb-row.kw .d { color: var(--text-muted); }', '.pnb-row.kw { opacity: .72; }'),
    'm21': ('css/main.css', 'cursor: pointer;   /* full muted ink', 'cursor: pointer; opacity: .7;   /* full muted ink'),
}
B7 = '(tangerine|hello-kitty|neon-pulse|amethyst|midnight|solarized-dark|solarized-light)'
L6 = '(charcoal-gold|light-sepia|gruvbox|terminal|matrix|blueprint)'
EXPECT = {'m11': r'^C11-\w+-theme-' + B7 + '$', 'm11ink': r'^C11-\w+-theme-' + L6 + '$', 'm18': r'^C18-cursor$', 'm19open': r'^C19-(open|newest)$', 'm19focus': r'^C19-focus$',
          'm20': r'^C20-', 'm21': r'^C21-'}


def pick(stage, rel):
    p = os.path.join(stage, rel)
    return p if os.path.exists(p) else os.path.join(LIVE, rel)


def run_once(stage, mutant=None, keep=False):
    tmp = os.path.join(tempfile.gettempdir(), 'wcagcss_' + uuid.uuid4().hex[:6])
    os.makedirs(tmp)
    try:
        css = open(os.path.join(stage, 'css', 'main.css'), 'rb').read()
        hp = open(os.path.join(stage, 'health.php'), 'rb').read()
        if mutant:
            f, new, old = MUTANTS[mutant]
            src = css if f == 'css/main.css' else hp
            n = src.count(new.encode())
            if n != 1:
                raise SystemExit('mutant %s anchor matched %d times' % (mutant, n))
            src = src.replace(new.encode(), old.encode())
            if f == 'css/main.css': css = src
            else: hp = src
        open(os.path.join(tmp, 'main.css'), 'wb').write(css)
        h = hp.decode('utf-8')
        a = h.find('    function render(d) {'); b = h.find("    /* A count on a tab's label; 0 removes it.")
        if a < 0 or b < a: raise SystemExit('FAIL lift: the log render() block was not found in health.php')
        logjs = h[a:b]
        js = open(pick(stage, r'js\penumbra_help_ask.js'), encoding='utf-8').read()
        ask = []
        for pat in (r'\.pnb-ask-vote \{[^}]*\}', r'\.pnb-ask-vote\.is-mine \{[^}]*\}', r'\.pnb-ask-from-search \{[^}]*\}'):
            m = re.search(pat, js)
            if not m: raise SystemExit('FAIL lift: %s not in penumbra_help_ask.js' % pat)
            ask.append(m.group(0))
        lb = open(pick(stage, r'help\topics\askHelpLightbox.php'), encoding='utf-8').read()
        m = re.search(r'id="pnbAskGo" style="([^"]*)"', lb)
        if not m: raise SystemExit('FAIL lift: #pnbAskGo style not in askHelpLightbox.php')
        emit = os.path.join(tmp, 'emit.php')
        open(emit, 'w').write("<?php require %r; ob_start(); penumbra_emit_theme_css(); $c = ob_get_clean();\n"
                              "echo json_encode(penumbra_get_active_theme_ids()), \"\\n\", $c;\n" % pick(stage, 'themes_config.php'))
        r = subprocess.run([PHP, '-n', emit], capture_output=True, text=True, timeout=120)
        ids, _, themecss = r.stdout.partition('\n')
        if not ids.startswith('['): raise SystemExit('FAIL theme emit: ' + r.stdout[:300] + r.stderr[:300])
        page = open(os.path.join(HERE, 'harness.html'), encoding='utf-8').read()
        page = (page.replace('%%THEMECSS%%', themecss).replace('%%ASKCSS%%', ' '.join(ask))
                    .replace('%%ASKGOSTYLE%%', m.group(1)).replace('%%THEMES%%', ids).replace('%%LOGJS%%', logjs))
        open(os.path.join(tmp, 'h.html'), 'w', encoding='utf-8').write(page)
        dom = os.path.join(tmp, 'dom.txt')
        with open(dom, 'wb') as fo:
            subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                            '--user-data-dir=' + os.path.join(tmp, 'prof'), '--virtual-time-budget=10000', '--dump-dom',
                            'file:///' + tmp.replace('\\', '/') + '/h.html'], stdout=fo, stderr=subprocess.DEVNULL, timeout=180)
        time.sleep(1)
        t = open(dom, encoding='utf-8', errors='replace').read()
        m = re.search(r'<pre id="out">([^<]*)', t)
        lines = [l for l in (m.group(1).split('\n') if m else []) if l.strip()]
        res = []
        for l in lines:
            mm = re.match(r'(ok|FAIL|INFO)\s+(\S+)\s?(.*)', l.replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&'))
            if mm: res.append((mm.group(1), mm.group(2), mm.group(3)))
        return res
    finally:
        if not keep and os.path.basename(tmp).startswith('wcagcss_'):
            shutil.rmtree(tmp, ignore_errors=True)
        elif keep:
            print('kept', tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default=LIVE)
    ap.add_argument('--mutant'); ap.add_argument('--mutants', action='store_true'); ap.add_argument('--keep', action='store_true')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    print('STAGE: ' + a.stage)
    if a.mutants:
        bad = 0
        for name in MUTANTS:
            res = run_once(a.stage, name)
            red = sorted(c for s, c, _ in res if s == 'FAIL')
            want = [c for s, c, _ in res if s != 'INFO' and re.search(EXPECT[name], c)]
            ok = bool(red) and set(red) <= set(want)   # red, and only within its own checks (a theme with headroom may stay green)
            bad += not ok
            print('%-9s %s  red=%d  (%s)' % (name, 'KILLS ITS OWN' if ok else 'WRONG', len(red), ', '.join(red[:8]) + (' ...' if len(red) > 8 else '')))
            if not ok: print('          expected red: ' + ', '.join(sorted(want)))
        print('RESULT: ' + ('GREEN' if not bad else 'RED')); sys.exit(1 if bad else 0)
    res = run_once(a.stage, a.mutant, a.keep)
    if a.mutant: print('MUTANT ' + a.mutant)
    p = sum(1 for s, _, _ in res if s == 'ok'); f = sum(1 for s, _, _ in res if s == 'FAIL')
    for s, c, m in res:
        if not a.quiet or s != 'ok': print('  %-4s %s  %s' % (s, c, m))
    if not res: f += 1; print('  FAIL no output from the page')
    print('SUMMARY  pass=%d  fail=%d' % (p, f)); print('RESULT: ' + ('RED' if f else 'GREEN'))
    sys.exit(1 if f else 0)


if __name__ == '__main__':
    main()
