# wcagmod_mutants.py (wcag mod 2026-11-07) - targeted mutants for the M22 / M23 checks (gantt_test + gantt_a11y_test).
#   py -3 wcagmod_mutants.py --stage DIR [--mutant NAME] [--control]
# DIR directly holds js\penumbra_charts.js and js\penumbra_a11y.js. Each mutant is a single-point revert on a temp
# copy, run through run.ps1 -ChartsJs/-A11yJs (as a script block: UNC .ps1 files are GPO-refused). --control runs the
# LIVE files and lists what is red. A mutant passes when exactly the named checks go red. ONE run at a time: run.ps1
# rebuilds SRC.js and the harness copies in this folder.
import os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
CH, AY = os.path.join('js', 'penumbra_charts.js'), os.path.join('js', 'penumbra_a11y.js')
MUTANTS = {
    'galpha':   (CH, "                    ctx.fillStyle = textColor;   // full alpha: 0.75 dimmed it under 4.5:1 (wcag mod 2026-11-07)",
                     "                    ctx.fillStyle = textColor; ctx.globalAlpha = 0.75;",
                 ['wcagmod gnote: drawn at full alpha']),
    'gnonote':  (CH, "            if (config.data) config.data._a11yNote = note;", "",
                 ['wcagmod gnote: the note reaches the a11y data (data._a11yNote)']),
    'gcaption': (AY, "'chart data' + (data._a11yNote ? '. ' + esc(data._a11yNote) : '') + '</caption>", "'chart data</caption>",
                 ['wcagmod gcaption: the note is in the caption', 'wcagmod gcaption: the note is escaped']),
    'glum':     (CH, "            return _gvRatio(lf, _gvRel([31, 31, 31])) >= _gvRatio(lf, 1) ? '#1f1f1f' : '#ffffff';",
                     "            return (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255 > 0.52 ? '#1f1f1f' : '#ffffff';",
                 ['wcagmod gink: a mid-tone bar on a light page takes dark ink (white was 3:1)']),
    'gnobg':    (CH, "            var bg = _gvBackdrop(chart);", "            var bg = [255, 255, 255];",
                 ['wcagmod gink: the same mid-tone bar over a dark backdrop takes white (alpha over the canvas background)']),
}
args = sys.argv[1:]
stage = args[args.index('--stage') + 1] if '--stage' in args else None
one = args[args.index('--mutant') + 1] if '--mutant' in args else None
control = '--control' in args
def run(charts, a11y):
    cmd = "& ([scriptblock]::Create([IO.File]::ReadAllText('%s'))) -ChartsJs '%s' -A11yJs '%s'" % (os.path.join(HERE, 'run.ps1'), charts, a11y)
    out = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], capture_output=True, text=True).stdout
    red = [m.group(1).strip() for m in re.finditer(r'^\s+FAIL\s+(.*?)(?:\s+>>.*)?$', out, re.M) if not re.match(r'\S+_test\s', m.group(1))]
    errs = re.findall(r'^\s+ERROR\s+(.*)$', out, re.M)
    summ = (re.findall(r'SUMMARY.*', out) or ['(no summary)'])[-1]
    return out, red, errs, summ
if control:
    app = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
    out, red, errs, summ = run(os.path.join(app, CH), os.path.join(app, AY))
    print('CONTROL (live) ' + summ); [print('  red: ' + r) for r in red]; [print('  ERROR ' + e) for e in errs]
    sys.exit(0)
if not stage: raise SystemExit('--stage DIR is required')
print('stage: ' + stage)
ok = bad = 0
for name in ([one] if one else list(MUTANTS)):
    rel, old, new, must = MUTANTS[name]
    d = tempfile.mkdtemp(prefix='pnb_wcm_')
    try:
        for r in (CH, AY):
            os.makedirs(os.path.dirname(os.path.join(d, r)), exist_ok=True); shutil.copyfile(os.path.join(stage, r), os.path.join(d, r))
        t = open(os.path.join(d, rel), 'rb').read().decode('utf-8')
        if t.count(old) != 1: raise SystemExit('mutant %s: anchor found %d times' % (name, t.count(old)))
        open(os.path.join(d, rel), 'wb').write(t.replace(old, new).encode('utf-8'))
        out, red, errs, summ = run(os.path.join(d, CH), os.path.join(d, AY))
        good = sorted(red) == sorted(must) and not errs
        ok += good; bad += (not good)
        print('  %s  mutant %-9s %s   [red: %s]%s' % ('PASS' if good else 'FAIL', name, summ, red, (' ERRORS: %s' % errs) if errs else ''))
    finally:
        shutil.rmtree(d, ignore_errors=True)
print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
print('RESULT: ' + ('GREEN' if bad == 0 else 'RED'))
