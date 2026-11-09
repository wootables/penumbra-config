# =============================================================================
# WCAGMOD_CARDMAIL SUITE (wcag mod 2026-11-07, finding M25) - the scheduled email's cards carry the data bar's words
#
# test.php runs penumbra_cards_email.php on its own (php -n; the runner is NEVER required: Oracle and mail).
#   py -3 run.py                  candidate = LIVE
#   py -3 run.py --stage DIR      a stage in the app layout (DIR\penumbra_cards_email.php)
#   py -3 run.py --control        live: expects every NEW check red, every other green
#   py -3 run.py --mutants | --mutant NAME     (with --stage DIR: mutate the stage; copies in %TEMP%)
# Writes nothing to the webroot.
# =============================================================================
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
NEW = {'P-barWords', 'P-tileWords'}   # P-barHidden, P-barListed, P-barIsBig, P-tileSameSkip, P-noWarnings hold on live (no words there)
MUTANTS = {
    'm-flat': ([("if ($bv !== '' && !_pnb_cm_hid($rc['css'])", "if (false && $bv !== '' && !_pnb_cm_hid($rc['css'])")], ['P-barWords']),
    'm-hid': ([("if ($bv !== '' && !_pnb_cm_hid($rc['css']) && ", "if ($bv !== '' && ")], ['P-barHidden']),
    'm-listed': ([("&& !in_array($bar, array_merge(array($title, $pill, $big), $sub, $fields), true))", ")")], ['P-barListed', 'P-barIsBig']),
    'm-tile': ([("if ($bl !== '' && !($t['big']", "if (false && $bl !== '' && !($t['big']")], ['P-tileWords']),
    'm-tilebig': ([("!($t['big'] && _pnb_pv_txt($t['big']['html']) === $t['bar']['text']) && ", "")], ['P-tileSameSkip']),
}

args = sys.argv[1:]
def opt(name):
    if name in args: i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return None
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage = opt('--stage'); one = opt('--mutant'); allm = flag('--mutants'); control = flag('--control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
root = APP if control else (stage or APP)
inc = os.path.join(root, 'penumbra_cards_email.php')
print('candidate: %s' % inc)

def run(path):
    lint = subprocess.run([PHP, '-n', '-l', path], capture_output=True, text=True)
    out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test.php'), path], capture_output=True, text=True, encoding='utf-8')
    res = [('P-lint', lint.returncode == 0, lint.stdout.strip())]
    for ln in out.stdout.splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)$', ln)
        if m: res.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
    if out.stderr.strip(): res.append(('P-stderr', False, out.stderr.strip()[:400]))
    return res

if allm or one:
    src = open(inc, 'rb').read().decode('utf-8')
    tmp = tempfile.mkdtemp(prefix='pnb_wmcm_'); good = bad = 0
    for name in ([one] if one else list(MUTANTS)):
        edits, must = MUTANTS[name]; t = src
        for old, new in edits:
            if t.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, t.count(old), old[:90]))
            t = t.replace(old, new)
        p = os.path.join(tmp, 'penumbra_cards_email.php'); open(p, 'wb').write(t.encode('utf-8'))
        red = [a for a, ok, _ in run(p) if not ok]
        g = all(x in red for x in must) and 'P-lint' not in red
        good += g; bad += (not g)
        print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if g else 'FAIL', name, ' '.join(must), ' '.join(red)))
    shutil.rmtree(tmp, ignore_errors=True)
    print('SUMMARY mutants ok=%d bad=%d' % (good, bad)); print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
else:
    res = run(inc); p = f = 0
    for a, ok, d in res:
        print('  %s  %-22s %s' % ('PASS' if ok else 'FAIL', a, d[:600])); p += ok; f += (not ok)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(a for a, ok, _ in res if not ok)))
    if control:
        red = {a for a, ok, _ in res if not ok}
        ng = sorted(a for a in NEW if a not in red); orr = sorted(a for a in red if a not in NEW)
        print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(ng) or 'none'))
        print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(orr) or 'none'))
        print('RESULT: GREEN' if not ng and not orr else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 else 'RESULT: RED')
