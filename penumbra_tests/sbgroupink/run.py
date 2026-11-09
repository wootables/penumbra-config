# =============================================================================
# SBGROUPINK SUITE (wcag mod 2026-11-07, M16): the Visual Filter Builder's ( ) group toggle reads on every theme.
# The ON state was #fff on --brand-secondary (1.1 to 4.3:1); its hover ink was bare --brand-secondary.
# harness.html loads css/search_builder.css and, per theme, the theme's tokens (themes.js, built here from
# themes_config.php's vars + cssVars and the body.theme-* blocks of css/main.css), then measures WCAG contrast.
#
#   py -3 run.py                    live css/search_builder.css
#   py -3 run.py --stage DIR        DIR\css\search_builder.css (DIR directly holds css\)
#   py -3 run.py --control          live, expecting both checks RED (before the fix)
#   py -3 run.py --stage DIR --mutants | --mutant NAME
# Headless Edge --dump-dom in %TEMP%\pnb_sbgi_*; writes nothing to the webroot. One headless suite at a time.
# =============================================================================
import html, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE): EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
CHECKS = ['C1 on-state ink 4.5:1 on every theme', 'C2 hover ink 4.5:1 on every theme']
MUTANTS = {
    'onwhite':     ("    color: var(--on-brand, #fff);\r\n}", "    color: #fff;\r\n}", ['C1 on-state ink 4.5:1 on every theme']),
    'hoversec':    ("    color: var(--brand-text, var(--brand-primary, #336699));   /* readable brand text (wcag mod 2026-11-07) */",
                    "    color: var(--brand-secondary, #4a7cb8);", ['C2 hover ink 4.5:1 on every theme']),
}
# onsecondary is written as old -> new below (the fill back on --brand-secondary)
MUTANTS['onsecondary'] = ("    background: var(--brand-primary, #336699);\r\n    border-color: var(--brand-primary, #336699);\r\n    color: var(--on-brand, #fff);",
                          "    background: var(--brand-secondary, #4a7cb8);\r\n    border-color: var(--brand-primary, #336699);\r\n    color: var(--on-brand, #fff);",
                          ['C1 on-state ink 4.5:1 on every theme'])

def themes():
    src = open(os.path.join(APP, 'themes_config.php'), encoding='utf-8').read()
    css = open(os.path.join(APP, 'css', 'main.css'), encoding='utf-8', errors='replace').read()
    out = []
    for b in re.split(r"\n\s*\$themes\['", src)[1:]:
        tid = b.split("'")[0]
        head = b.split("'xlsx'")[0]
        v = dict(re.findall(r"'([\w-]+)'\s*=>\s*'(#[0-9a-fA-F]{3,8})'", head))
        if 'brand-primary' not in v: continue
        cv = b.split("'cssVars'")
        if len(cv) > 1:
            v.update(dict(re.findall(r"'([\w-]+)'\s*=>\s*'(#[0-9a-fA-F]{3,8})'", cv[1].split('\n    );')[0])))
        m = re.search(r'\nbody\.' + re.escape(tid) + r'\s*\{([^}]*)\}', css)
        if m:
            v.update(dict(re.findall(r'--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})', m.group(1))))
        out.append({'id': tid, 'vars': v})
    return out

def run(css_text):
    work = tempfile.mkdtemp(prefix='pnb_sbgi_')
    try:
        open(os.path.join(work, 'search_builder.css'), 'wb').write(css_text.encode('utf-8'))
        open(os.path.join(work, 'themes.js'), 'w', encoding='utf-8').write('window.PNB_THEMES = ' + json.dumps(themes()) + ';\n')
        shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(work, 'harness.html'))
        url = 'file:///' + work.replace('\\', '/') + '/harness.html'
        p = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
                              '--user-data-dir=' + os.path.join(work, 'profile'), '--virtual-time-budget=5000', '--dump-dom', url],
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        out, _ = p.communicate(timeout=180)
        d = out.decode('utf-8', 'replace'); i = d.find('<pre id="out">'); j = d.find('</pre>', i)
        txt = html.unescape(d[i + 14:j]) if i >= 0 else ''
        if not txt.startswith('RESULTS_JSON:'): return {'fatal': 'FAIL harness wrote nothing: ' + d[:300]}
        return json.loads(txt[13:])
    finally:
        shutil.rmtree(work, ignore_errors=True)

args = sys.argv[1:]
stage = args[args.index('--stage') + 1] if '--stage' in args else None
one = args[args.index('--mutant') + 1] if '--mutant' in args else None
control = '--control' in args
path = os.path.join(stage if (stage and not control) else APP, 'css', 'search_builder.css')
print('candidate: ' + path)
base = open(path, 'rb').read().decode('utf-8')
if '--mutants' in args or one:
    good = bad = 0
    for name in ([one] if one else list(MUTANTS)):
        old, new, must = MUTANTS[name]
        if base.count(old) != 1: raise SystemExit('mutant %s: anchor found %d times' % (name, base.count(old)))
        r = run(base.replace(old, new))
        red = sorted(k for k, v in r.items() if not str(v).startswith('PASS'))
        ok = red == sorted(must); good += ok; bad += (not ok)
        print('  %s  mutant %-12s red: %s' % ('PASS' if ok else 'FAIL', name, red))
    print('SUMMARY mutants ok=%d bad=%d' % (good, bad)); print('RESULT: ' + ('GREEN' if bad == 0 else 'RED'))
else:
    r = run(base); f = 0
    for k in CHECKS:
        v = str(r.get(k, r.get('fatal', 'FAIL missing')))
        passed = v.startswith('PASS'); f += (not passed)
        print('  %s  %s  [%s]' % ('PASS' if passed else 'FAIL', k, v[5:600]))
    if control:
        print('CONTROL: %d of %d red (expected %d)' % (f, len(CHECKS), len(CHECKS))); print('RESULT: ' + ('GREEN' if f == len(CHECKS) else 'RED'))
    else:
        print('TOTAL pass=%d fail=%d' % (len(CHECKS) - f, f)); print('RESULT: ' + ('GREEN' if f == 0 else 'RED'))
