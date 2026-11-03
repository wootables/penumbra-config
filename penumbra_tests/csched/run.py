# =============================================================================
# CSCHED SUITE (2026-11-01, the card gap list's item 7, part 3) - the scheduled email's cards
#
# A report saved showing cards (viewOptions.cards.open + .sent, js/penumbra_cards.js savedView) emails those cards:
# penumbra_cards_email.php, wired into schedule_runner.php's generate_report_html (the email body alone). test_csched.php
# runs the include on its own (the runner is NEVER required: Oracle and mail) with the runner's delimiter split lifted,
# the real theme registry, and checks the runner's wiring by source; the theme roles' parity with the browser's.
#
#   py -3 run.py                  candidate = LIVE (penumbra_cards_email.php, schedule_runner.php, js/penumbra_cards.js)
#   py -3 run.py --stage DIR      a stage in the app layout (each file from DIR when there, else live)
#   py -3 run.py --control        live: expects every new check red (no include there yet)
#   py -3 run.py --mutants | --mutant NAME     (with --stage DIR: mutate the stage)
# Writes nothing to the webroot (mutants run on copies in %TEMP%).
# =============================================================================
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
ABSENT = {'P-lint-runner'}   # holds on live too
# (cmsize, 2026-11-01) the include is live (csched 4bb5714): the control now expects THIS round's checks red on live and
# every other green; P-budget measures a card by the new layout (either way on live)
NEW = {'P-paritySize', 'P-cols', 'P-compact', 'P-big', 'P-cardThemed', 'P-large', 'P-xlType'}
NEW = set()   # (cmsize is LIVE since 3fd86cf: the control expects every check green)
NEW = {'P-pillThemed', 'P-pillRuled'}   # (cfb8: the pill outlined as on screen)
NEW = set()   # (cfb8 is LIVE since e1c835f: the control expects every check green)
NEW = {'P-cfgSentSize', 'P-notes'}   # (csz: the size shown at save, the notes)
NEW = set()   # (csz is LIVE since 4cda1d2: the control expects every check green)
NEW = {'P-cutNoHeads', 'P-rankFast', 'S-changeNoCards'}   # (cnest sweep: the cut's headings, the rank's search, change analysis as tables)
NEW = set()   # (cnest is LIVE since ab526da: the control expects every check green)
NEW = {'P-pctShown'}   # (csw2: a Percent format's bar by its shown text)
NEW = set()   # (csw2 is LIVE since a7d63c3: the control expects every check green)
EITHER = {'P-budget'}
MUTANTS = {
    'm-open': ([('inc', "    if (!$c || empty($c['open']) || !isset($c['sent']) || !is_array($c['sent'])) return null;", "    if (!$c || !isset($c['sent']) || !is_array($c['sent'])) return null;")], ['P-cfgNoOpen']),
    'm-theme': ([('inc', "        $o[$role] = (is_string($v) && preg_match(", "        $o[$role] = (false && preg_match(")], ['P-themeDark', 'P-themeAll']),
    'm-paritydef': ([('inc', "'text' => array('text-main', '#222222')", "'text' => array('text-main', '#000000')")], ['P-parityTheme']),
    'm-cols': ([('inc', "'compact' => array('cols' => 4,", "'compact' => array('cols' => 3,")], ['P-compact', 'P-paritySize']),
    # (cmsize) Large laid out as Standard (the user's report) / the title's type fixed / the padding fixed
    'm-large': ([('inc', "'large' => array('cols' => 2, 'pad' => '14px 16px', 'title' => 15,", "'large' => array('cols' => 2, 'pad' => '11px 12px', 'title' => 13,")], ['P-large', 'P-paritySize']),
    'm-type': ([('inc', "'<div style=\"font-size:' . $ms['title'] . 'px;font-weight:bold;", "'<div style=\"font-size:14px;font-weight:bold;")], ['P-large', 'P-xlType']),
    # (cfb8, the user: the pill not honoured) the pill filled again, no outline
    'm-pill': ([('inc', "'border:1px solid ' . ($ps !== '' ? 'transparent' : $th['text']) . ';' . ($ps !== '' ? $ps : 'color:' . $th['text'] . ';')", "($ps !== '' ? $ps : 'background-color:' . $th['alt'] . ';color:' . $th['text'] . ';')")], ['P-pillThemed', 'P-pillRuled']),
    # (csz) the size shown at save ignored / no notes on the cards
    'm-sentsize': ([('inc', "(isset($x['size']) && in_array($x['size'],", "(false && in_array($x['size'],")], ['P-cfgSentSize']),
    'm-notes': ([('inc', "            if ($notes !== '' && _pnb_cm_text($C($notes)['raw']) !== '') $h .= ", "            if (false) $h .= ")], ['P-notes']),
    'm-pad': ([('inc', "border-radius:8px;padding:' . $ms['pad'] . ';", "border-radius:8px;padding:10px 12px;")], ['P-cardThemed', 'P-large', 'P-xlType']),
    'm-chips': ([('inc', "$id = ($chips && isset($cfg['lists'][$n])) ? $cfg['lists'][$n] : '';", "$id = '';")], ['P-chips']),
    'm-htmlchips': ([('inc', "if ($id === '' || substr($raw, 0, 2) === '@@' || strpos($raw, '<') !== false ||", "if ($id === '' ||")], ['P-chipsHtmlKept']),
    'm-hidden': ([('inc', "    $pick = function ($n) use ($have) { return ($n !== '' && isset($have[$n])) ? $n : ''; };", "    $pick = function ($n) use ($have) { return $n; };")], ['P-noWarnings']),
    'm-budget': ([('inc', "            if ($budget > 0 && $bytes + strlen($card) > $budget) { $cut = true; continue; }\n", "")], ['P-budget']),
    'm-heads': ([('inc', "        if ($sc['name'] !== null) {\n", "        if (false) {\n")], ['P-groupHeads']),
    'm-rank': ([('inc', "    return (($a + $lo - 1) / 2) / ($n - 1) * 100;", "    return $lo / $n * 100;")], ['P-bars', 'P-rankSame']),   # (cnest: re-anchored)
    # (cnest sweep) the cut's headings / the rank's scan back / change analysis as cards
    'cn-heads': ([('inc', "        if ($cut && !$cells) continue;   // (cnest sweep)", "        // (cnest sweep)")], ['P-cutNoHeads']),
    'cn-scan': ([('inc', "    $lo = 0; $hi = $n; while ($lo < $hi) { $md = ($lo + $hi) >> 1; if ($vals[$md] < $v) $lo = $md + 1; else $hi = $md; }", "    $lo = 0; while ($lo < $n && $vals[$lo] < $v) $lo++; for ($w = 0; $w < $n; $w++) { $vals[$w] = $vals[$w]; }")], ['P-rankFast']),
    'cn-change': ([('run', "                    $GLOBALS['penumbra_cards_email'] = null;   // (cnest sweep)", "                    // (cnest sweep)")], ['S-changeNoCards']),
    # (csw2) the bar's shown percentage: not passed / not read
    'w2-pctcall': ([('inc', "$vals, $rc['html']);", "$vals);")], ['P-pctShown']),
    'w2-pctread': ([('inc', "    if ($st !== '' && preg_match", "    if (false && preg_match")], ['P-pctShown']),
    'm-labels': ([('inc', "($cfg['nolabels'] ? '' :", "(false ? '' :")], ['P-nolabels']),
    'm-rowcss': ([('inc', "            $cs = (is_array($f['row']) && isset($f['row']['background-color']))", "            $cs = (false && isset($f['row']['background-color']))")], ['P-rowCss']),
    # schedule_runner.php
    'm-pdf': ([('run', "($isEmail && $viewMode !== 'pivot' && !empty($data)", "($viewMode !== 'pivot' && !empty($data)")], ['S-bodyOnly']),
    'm-guard': ([('run', "function_exists('penumbra_cards_email_cfg') ? penumbra_cards_email_cfg($state) : null;", "penumbra_cards_email_cfg($state);")], ['S-globalGuarded']),
    'm-cell': ([('run', "'html' => penumbra_notes_cell_html(formatCellContent($cellValue), $colName),", "'html' => formatCellContent($cellValue),")], ['S-sameCell']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
root = APP if control else (stage_dir or APP)
def pick(rel):
    p = os.path.join(root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {'inc': pick('penumbra_cards_email.php'), 'run': pick('schedule_runner.php'), 'cjs': pick(os.path.join('js', 'penumbra_cards.js'))}
THM = os.path.join(APP, 'themes_config.php'); SRCH = os.path.join(APP, 'penumbra_search.php')

def run_test(paths):
    out = subprocess.run([PHP, '-n', os.path.join(HERE, 'test_csched.php'), paths['inc'], paths['run'], THM, SRCH, paths['cjs']], capture_output=True, text=True, encoding='utf-8', errors='replace')
    res = []
    for line in (out.stdout or '').splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)', line)
        if m: res.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
    if not res: res.append(('F-run', False, ((out.stdout or '') + (out.stderr or ''))[-600:]))
    return res

def mutated(name):
    d = tempfile.mkdtemp(prefix='pnb_csched_')
    paths = {}
    for k, p in cand.items():
        dst = os.path.join(d, k + os.path.splitext(p)[1]); shutil.copyfile(p, dst); paths[k] = dst
    for f, old, new in MUTANTS[name][0]:
        t = open(paths[f], 'rb').read().decode('utf-8', 'surrogateescape')
        o = old.replace('\n', '\r\n') if (f == 'run' and '\r\n' in t) else old
        n = new.replace('\n', '\r\n') if (f == 'run' and '\r\n' in t) else new
        if t.count(o) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t.count(o), old[:80]))
        open(paths[f], 'wb').write(t.replace(o, n).encode('utf-8', 'surrogateescape'))
    return d, paths

print('candidate: %s' % cand)
if all_mutants or one_mutant:
    okc = bad = 0
    for m in ([one_mutant] if one_mutant else list(MUTANTS)):
        d, paths = mutated(m)
        try: res = run_test(paths)
        finally: shutil.rmtree(d, ignore_errors=True)
        red = [a for a, p, _ in res if not p]
        must = MUTANTS[m][1]
        good = not [x for x in must if x not in red]
        okc += good; bad += (not good)
        print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
    print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
    print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
else:
    res = run_test(cand)
    p = f = 0; failed = []
    for a, passed, d in res:
        print('  %s  %-26s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
        if passed: p += 1
        else: f += 1; failed.append(a)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        seen = {a for a, _, _ in res}
        new_green = sorted(a for a, passed, _ in res if passed and a in NEW)
        old_red = sorted(a for a, passed, _ in res if not passed and a not in NEW and a not in EITHER)
        unseen = sorted(NEW - seen)
        print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
        print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
        print('CONTROL: new checks not seen: %s' % (' '.join(unseen) or 'none'))
        print('RESULT: GREEN' if not new_green and not old_red and not unseen else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
