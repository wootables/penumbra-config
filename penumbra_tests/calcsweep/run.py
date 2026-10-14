# =============================================================================
# CALCULATED COLUMNS BUG SWEEP SUITE "calcsweep" (2026-10-10)
#
# js/penumbra_calc.js ALONE in a page (probe.html?id=zzprobe + probe.js): the
# cases the 2026-10-10 sweep found, plus the neighbours that must not move.
#   ROUND           decimal-text rounding (the old 1e-12 nudge broke values past
#                   |v| x 10^places = 5e11), half away from zero
#   numbers         at most 15 significant digits (no .470001 binary noise)
#   TRUE / FALSE    a comparison's written FALSE reads as false in another IF
#   chaining        a column may use ANY other calculated column (dependency
#                   order, not list order); a loop is refused by the dialog and
#                   left out (named) by applyRows
#   the dialog      an edit keeps the column's place; a rename carries the
#                   columns that use it ({OLD} -> {NEW})
#
#   py -3 run.py                      the live js\penumbra_calc.js
#   py -3 run.py --calc FILE          any build (the stage)
#   py -3 run.py --control [--calc F] the build before (newest .bak-*-calcsweep, or F):
#                                     EXACTLY CONTROL_RED fails
#   py -3 run.py --mutants            single edits of the build under test, each must turn its cases red
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import glob, json, os, shutil, subprocess, sys, tempfile
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14

# What the build before the sweep gets wrong (frozen from the first control run, live 0570df0e).
CONTROL_RED = ['round-big2', 'round-big2b', 'round-6pl', 'fmt-num-noise', 'if-FALSE-text', 'if-false-lc', 'chain-bool',
               'edit-keeps-order', 'edit-dep-still-works', 'edit-col-order', 'rename-dep', 'forward-ref-order', 'cycle-refused',
               'cycle-named', 'summable-exact', 'iscalc', 'no-whitelist-push', 'strip-all-levels', 'strip-pivot-filter', 'strip-notice', 'link-deps']

MUTANTS = {
    'nudge': ([("            var r = Math.round(Number(str + 'e' + pl));", "            var r = Math.round(a * Math.pow(10, pl) * (1 + 1e-12));")],
              ['round-big2', 'round-big2b', 'round-6pl']),
    'noise': ([("        if (a >= 1) places = Math.max(0, Math.min(places, 15 - (Math.floor(Math.log10(a)) + 1)));\n", "")], ['fmt-num-noise']),
    'falsy': ([("        if (t === 'FALSE') return false;\n", "")], ['if-FALSE-text', 'if-false-lc', 'chain-bool']),
    'listorder': ([("        entries.forEach(function (e) { if (!e.why) resolve(e); });",
                    "        entries.forEach(function (e) { if (!e.why) { e.cc.refs.forEach(function (r) { if (byName[r] && byName[r].ix > e.ix) e.why = 'later'; }); if (!e.why) resolve(e); } });")],
                  ['forward-ref-order']),
    'keyorder': ([("            for (var u = 0; u < use.length; u++) row[use[u].def.name] = '';\n", "")], ['forward-ref-order']),
    'editmoves': ([("            if (editing && x.name === editing) { list.push(r.def); placed = true; return; }",
                    "            if (editing && x.name === editing) return;")], ['edit-keeps-order', 'edit-col-order']),
    'norename': ([("        var fix = function (x) { return renamed ? renameRefs(x, editing, r.def.name) : x; };",
                   "        var fix = function (x) { return x; };")], ['rename-dep']),
    'noloopcheck': ([("        if (loop) return { error: 'That would make a loop: '", "        if (false) return { error: 'That would make a loop: '")],
                    ['cycle-refused']),
    # the Save strip
    'stripgroup': ([("            if (keepLv.length !== levels.length) {", "            if (false) {")], ['strip-all-levels']),
    'stripmaps': ([("            Object.keys(m).forEach(function (c) { if (nm[String(c).toUpperCase()] === true) delete m[c]; });\n", "")], ['strip-all-levels']),
    'pivotfilter': ([("                names.forEach(function (n) { if (f && new RegExp(", "                names.forEach(function (n) { if (false && new RegExp(")],
                    ['strip-pivot-filter']),
    'pivotsubstr': ([("new RegExp('(^|[^A-Z0-9_])' + n + '([^A-Z0-9_]|$)', 'i')", "new RegExp(n, 'i')")], ['strip-pivot-filter']),
    'linkdeps': ([("                u.searchParams.append('calc', urlValue(x)); inLink[r] = true;", "                inLink[r] = true;")], ['link-deps']),
    'whitelistpush': ([("            if (x.def.format !== 'text') summableNames[x.def.name] = true;",
                        "            if (x.def.format !== 'text') { summableNames[x.def.name] = true; window.penumbra_vars.totalExemptions.push(x.def.name); }")],
                      ['no-whitelist-push']),
}
CR = '\n'

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
calc = opt('--calc')
control = flag('--control'); mutants = flag('--mutants'); one = opt('--mutant')
if args: raise SystemExit('unknown arguments: ' + ' '.join(args))
if control and not calc:
    baks = bak_glob(os.path.join(APP, 'js', 'penumbra_calc.js.bak-*-calcsweep'))
    if not baks: raise SystemExit('--control needs js\\penumbra_calc.js.bak-*-calcsweep (made by the deploy), or --calc <the build before>')
    calc = baks[-1]
calc = calc or os.path.join(APP, 'js', 'penumbra_calc.js')
print('under test: ' + calc + ('   (CONTROL)' if control else ''))
src = open(calc, 'rb').read().decode('utf-8')

def run_build(js):
    d = tempfile.mkdtemp(prefix='pnb_csw_')
    try:
        for f in ('probe.html', 'probe.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(d, f))
        open(os.path.join(d, 'penumbra_calc.js'), 'wb').write(js.encode('utf-8'))
        p = subprocess.run([sys.executable, os.path.join(HERE, 'runpage.py'), d, 'probe.html?id=zzprobe', '90'], capture_output=True, text=True)
        try: return json.loads(p.stdout.strip().splitlines()[-1])
        except Exception: return {'fatal': 'no result: ' + p.stdout[-300:] + p.stderr[-300:]}
    finally: shutil.rmtree(d, ignore_errors=True)

def reds(res):
    out = [c['id'] for c in res.get('cases', []) if not c['ok']]
    if res.get('errors') or res.get('fatal'): out.append('E-page')
    return out

if mutants or one:
    ok = bad = 0
    for name in ([one] if one else list(MUTANTS)):
        edits, must = MUTANTS[name]
        js = src
        for o, n in edits:
            if js.count(o) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, js.count(o), o[:100]))
            js = js.replace(o, n)
        red = reds(run_build(js)); miss = [m for m in must if m not in red]
        ok += not miss; bad += bool(miss)
        print('  %s  mutant %-13s %s   [red: %s]' % ('PASS' if not miss else 'FAIL', name, ('turns ' + ' '.join(must) + ' red') if not miss else ('stayed GREEN on ' + ' '.join(miss)), ' '.join(red)), flush=True)
    print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
    print('RESULT: GREEN' if bad == 0 and ok else 'RESULT: RED')
else:
    res = run_build(src)
    p = f = 0; failed = []
    for c in res.get('cases', []):
        print('  %s  %-22s got=%s want=%s%s' % ('PASS' if c['ok'] else 'FAIL', c['id'], json.dumps(c['got']), json.dumps(c['want']), ('  # ' + c['note']) if c.get('note') else ''))
        if c['ok']: p += 1
        else: f += 1; failed.append(c['id'])
    if res.get('errors') or res.get('fatal'):
        print('  FAIL  E-page  errors=%s fatal=%s' % (res.get('errors'), res.get('fatal'))); f += 1; failed.append('E-page')
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        exact = sorted(failed) == sorted(CONTROL_RED)
        print('CONTROL: %s (expected red: %s)' % ('as expected' if exact else 'NOT as expected', ' '.join(CONTROL_RED)))
        print('RESULT: GREEN' if exact else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
