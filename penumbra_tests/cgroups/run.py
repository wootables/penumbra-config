# =============================================================================
# CGROUPS SUITE (2026-11-25) - CUSTOM GROUPS, the twins: js/penumbra_calc.js's custom groups (grpText, cleanGroups,
# grpCompile, grpIndex, grpOne, grpCell, groupOrder) against penumbra_calc.php's (_pnb_calc_grp_*, pnb_calc_group_orders)
# over the same ~220 rows (entities, @@HTML, @@JSON, blanks, case, lists, unicode, numbers) and seven sets of
# definitions (values, rules, the rest, blanks, splits, cleaning, chains with formulas, the limits): every appended
# cell, every row's column order and every column's group order, byte for byte.
#   browser half  grpparity.html + grpcorpus.js: the module ALONE, in headless Edge (--dump-dom)
#   server half   grpparity.php: penumbra_calc.php over the browser's rows and definitions          P-*
# The page half (the editor, the hidden column, the grouping dialog's entries, the lock, the header menu) is
# calccol's scenario cgrp: py -3 ..\calccol\run.py --scn cgrp.
#
#   py -3 run.py [--stage DIR] [--mutants | --mutant NAME]
# DIR is an app layout (js/penumbra_calc.js, penumbra_calc.php); missing files come from the live app.
# Writes nothing to the webroot; stages into %TEMP%\pnb_cg_*.
# =============================================================================
import html, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_penumbra\php.exe'
MB = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_penumbra/ext/php_mbstring.dll'
# (file, old, new): the twin's rules broken one at a time; each must turn the parity red
MUTANTS = {
    'p-keep': ('php', "    return $g['rest'] === 'keep' ? $t : $g['other'];", "    return $g['other'];"),
    'p-case': ('php', "function _pnb_calc_grp_key($s) { return _pnb_calc_lower((string)$s); }", "function _pnb_calc_grp_key($s) { return (string)$s; }"),
    'p-firstwins': ('php', "        if ($best !== -1 && $r['i'] >= $best) break;\n", ""),
    'p-blankrule': ('php', "    if ($t === '') return $best;\n    foreach ($c->rules", "    foreach ($c->rules"),
    # (calcfix) re-anchored: the text functions' fText reads the same line (it was found twice)
    'p-html': ('php', "    if (substr($s, 0, 6) === '@@JSON') return '';\n    if (substr($s, 0, 6) === '@@HTML') $s = (string)preg_replace('/<[^>]*>/', '', substr($s, 6));\n    return _pnb_calc_trim(", "    if (substr($s, 0, 6) === '@@JSON') return '';\n    return _pnb_calc_trim("),
    'p-splitdedupe': ('php', "        foreach ($got as $x) { if (!isset($seen[$x['o']])) { $seen[$x['o']] = true; $outs[] = $x['o']; } }", "        foreach ($got as $x) { $outs[] = $x['o']; }"),
    'p-splitorder': ('php', "        usort($got, function ($a, $b) { return $a['r'] - $b['r']; });\n", ""),
    'p-ruletrim': ('php', "    return $v;\n}\n/** (cgroups sweep) A picked VALUE", "    return _pnb_calc_trim($v);\n}\n/** (cgroups sweep) A picked VALUE"),
    'p-limit': ('php', "            if ($sv === null || $total >= PNB_CALC_GRP_MAX_VALUES) continue;", "            if ($sv === null) continue;"),
    'p-order': ('php', "            if (!in_array($v, $vals, true)) $vals[] = $v;\n", ""),
    'j-unent': ('js', "        return unEnt(s).trim();\n    }\n    function grpKey", "        return s.trim();\n    }\n    function grpKey"),
    'j-json': ('js', "        if (s.substring(0, 6) === '@@JSON') return '';\n", ""),
    # (2026-11-25, cgroups sweep) the sweep's rules, each broken
    'p-rxcheck': ('php', "            $why = _pnb_calc_grp_rx_problem($s['rule']['v']);\n", "            $why = null;\n"),   # (calcfix #7) re-anchored
    'p-rxtrans': ('php', "_pnb_calc_grp_rx_php($s['rule']['v'])", "$s['rule']['v']"),
    # (calcfix) re-anchored: MATCHES in formulas (calctext) compiles with the same flags, so the bare flags were found twice
    'p-rxflags': ('php', "_pnb_calc_grp_rx_php($s['rule']['v']) . \"\\x01iD\";", "_pnb_calc_grp_rx_php($s['rule']['v']) . \"\\x01iu\";"),
    'p-valstr': ('php', "$sv = _pnb_calc_grp_val_str($v);", "$sv = _pnb_calc_grp_str($v, PNB_CALC_GRP_TEXT_MAX);"),
    'p-piece': ('php', "            $o = _pnb_calc_esc_lit(_pnb_calc_grp_piece($o));", "            $o = _pnb_calc_esc_lit($o);"),
    'p-astext': ('php', "$get($node['col'], true)", "$get($node['col'])"),
    'p-trim': ('php', "$r = @preg_replace('/^[\\x{0009}", "$r = @preg_replace('/^[\\x{0085}\\x{0009}"),
    'p-applied': ('php', "        if ($only !== null && !isset($only[$d['name']])) continue;\n", ""),
    'j-rxcheck': ('js', "                why = grpRxProblem(s.rule.v);\n", "                why = null;\n"),   # (calcfix #7) re-anchored
    'j-piece': ('js', "                o = escLit(grpPieceSafe(o));", "                o = escLit(o);"),
    'j-valstr': ('js', "                var s = grpValStr(v);", "                var s = grpStr(v, GRP_TEXT_MAX);"),
    'j-astext': ('js', "grpCell(node.m, get(node.col, true))", "grpCell(node.m, get(node.col))"),
}
args = sys.argv[1:]
def opt(name):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return None
stage_dir = opt('--stage'); one = opt('--mutant'); allm = '--mutants' in args
if allm: args.remove('--mutants')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
def pick(rel):
    p = os.path.join(stage_dir, rel) if stage_dir else None
    return p if p and os.path.exists(p) else os.path.join(APP, rel)
SRC = {'js': pick(os.path.join('js', 'penumbra_calc.js')), 'php': pick('penumbra_calc.php')}
LAYOUT = pick('penumbra_layout.php')   # the encrypted-report stub's tail (pnb_sort_calc_tail) names custom groups columns too  T-*
print('under test: %s' % json.dumps(SRC))

def run_once(texts, tag):
    st = tempfile.mkdtemp(prefix='pnb_cg_')
    try:
        for f in ('grpparity.html', 'grpcorpus.js', 'grpparity.php'): shutil.copy(os.path.join(HERE, f), os.path.join(st, f))
        open(os.path.join(st, 'penumbra_calc.js'), 'wb').write(texts['js'].encode('utf-8', 'surrogateescape'))
        open(os.path.join(st, 'penumbra_calc_under_test.php'), 'wb').write(texts['php'].encode('utf-8', 'surrogateescape'))
        prof = os.path.join(st, 'prof')
        url = 'file:///' + os.path.join(st, 'grpparity.html').replace('\\', '/')
        p = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof, '--allow-file-access-from-files',
                            '--virtual-time-budget=20000', '--dump-dom', url], capture_output=True, timeout=240)
        m = re.search(r'<pre id="out">(.*?)</pre>', p.stdout.decode('utf-8', 'replace'), re.S)
        if not m or not m.group(1).strip(): return ['  FAIL  F-browser  the browser side wrote nothing'], False
        jf = os.path.join(st, 'js.json')
        open(jf, 'w', encoding='utf-8').write(html.unescape(m.group(1)))
        r = subprocess.run([PHP, '-n', '-d', 'extension=' + MB, os.path.join(st, 'grpparity.php'), os.path.join(st, 'penumbra_calc_under_test.php'), jf], capture_output=True, timeout=240)
        out = r.stdout.decode('utf-8', 'replace').splitlines()
        return out, any(l.startswith('RESULT: GREEN') for l in out)
    finally:
        shutil.rmtree(st, ignore_errors=True)

texts = {k: open(v, 'rb').read().decode('utf-8', 'surrogateescape') for k, v in SRC.items()}
if allm or one:
    ok = bad = 0
    for name in ([one] if one else list(MUTANTS)):
        f, old, new = MUTANTS[name]
        if texts[f].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, texts[f].count(old), old[:80]))
        t = dict(texts); t[f] = t[f].replace(old, new)
        _, green = run_once(t, name)
        good = not green
        ok += good; bad += (not good)
        print('  %s  mutant %-14s turns the parity %s' % ('PASS' if good else 'FAIL', name, 'red' if good else 'GREEN (survives)'))
    print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
    print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
else:
    out, green = run_once(texts, 'plain')
    print('\n'.join(out))
    st = tempfile.mkdtemp(prefix='pnb_cg_')
    try:
        open(os.path.join(st, 'calc.php'), 'wb').write(texts['php'].encode('utf-8', 'surrogateescape'))
        t = subprocess.run([PHP, '-n', '-d', 'extension=' + MB, os.path.join(HERE, 'tailcheck.php'), LAYOUT, os.path.join(st, 'calc.php')], capture_output=True, timeout=120)
        print(t.stdout.decode('utf-8', 'replace'))
    finally:
        shutil.rmtree(st, ignore_errors=True)
