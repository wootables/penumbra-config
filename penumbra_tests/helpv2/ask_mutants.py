# ask_mutants.py (wcag mod 2026-11-07) - targeted mutants for the Ask harness checks T9..T12.
#   py -3 ask_mutants.py --stage DIR            run every mutant (DIR directly holds js\ and help\topics\)
#   py -3 ask_mutants.py --stage DIR --mutant NAME
# Each mutant is a single-point revert applied to a temp copy of the two Ask files; ask_harness.ps1 runs it.
# A mutant passes when exactly the checks it names go red. Writes nothing to the webroot.
import os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
JS, PHPF = os.path.join('js', 'penumbra_help_ask.js'), os.path.join('help', 'topics', 'askHelpLightbox.php')
MUTANTS = {
    'noready':   (JS, "                $('#pnbAskStatus').append($('<span class=\"sr-only pnb-ask-ready\"></span>').text('Answer ready below.'));\n", "", ['T9 answer announced']),
    'noaria':    (JS, ".addClass('is-mine').attr('aria-pressed', 'true');", ".addClass('is-mine');", ['T10 vote aria-pressed']),
    'gowhite':   (PHPF, "color: var(--on-brand, #fff); cursor: pointer;\">Ask</button>", "color: #fff; cursor: pointer;\">Ask</button>", ['T11a Ask button ink']),
    'votewhite': (JS, "background: var(--brand-primary, #336699); color: var(--on-brand, #fff); }'", "background: var(--brand-primary, #336699); color: #fff; }'", ['T11b own vote ink']),
    'fswhite':   (JS, "color: var(--on-brand, #fff); cursor: pointer; max-width: 100%;", "color: #fff; cursor: pointer; max-width: 100%;", ['T11c empty-search button ink']),
    'srcbrand':  (JS, "a.pnb-ask-source { color: var(--brand-text, var(--brand-primary, #336699)); }'", "a.pnb-ask-source { color: var(--brand-primary, #336699); }'", ['T12 source link ink']),
}
args = sys.argv[1:]
stage = args[args.index('--stage') + 1] if '--stage' in args else None
one = args[args.index('--mutant') + 1] if '--mutant' in args else None
if not stage: raise SystemExit('--stage DIR is required')
print('stage: ' + stage)
def run(app):
    out = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                          # a UNC .ps1 is refused by policy: run its text as a script block
                          "& ([scriptblock]::Create((Get-Content -LiteralPath '%s' -Raw))) -App '%s' -Here '%s'" % (os.path.join(HERE, 'ask_harness.ps1'), app, HERE)], capture_output=True, text=True).stdout
    red = [m.group(1).strip() for m in re.finditer(r'^\s+FAIL\s+(.*?)\s+\[', out, re.M)]
    return out, red
ok = bad = 0
for name in ([one] if one else list(MUTANTS)):
    rel, old, new, must = MUTANTS[name]
    d = tempfile.mkdtemp(prefix='pnb_askm_')
    try:
        for r in (JS, PHPF):
            os.makedirs(os.path.dirname(os.path.join(d, r)), exist_ok=True); shutil.copyfile(os.path.join(stage, r), os.path.join(d, r))
        t = open(os.path.join(d, rel), 'rb').read().decode('utf-8')
        if t.count(old) != 1: raise SystemExit('mutant %s: anchor found %d times' % (name, t.count(old)))
        open(os.path.join(d, rel), 'wb').write(t.replace(old, new).encode('utf-8'))
        out, red = run(d)
        if 'RESULT:' not in out: print(out[-800:])
        good = sorted(red) == sorted(must)
        ok += good; bad += (not good)
        print('  %s  mutant %-10s expects %s   [red: %s]' % ('PASS' if good else 'FAIL', name, must, red))
    finally:
        shutil.rmtree(d, ignore_errors=True)
print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
print('RESULT: ' + ('GREEN' if bad == 0 else 'RED'))
