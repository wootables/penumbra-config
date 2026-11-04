# parens sweep: unit cases on the strip library's pure functions (PenumbraTiles.strip / splitTopLevel) through
# headless Edge against a given penumbra_tiles.js. Prints PASS/FAIL per case.
#   py -3 strip_units.py [tiles.js] [--mutant NAME]     (default: the live js/penumbra_tiles.js)
# (2026-11-03, parennames) + 7 "name:" cases: a name that holds parentheses is one part, inside a group too.
#   On the build before the fix (live 5b20af4) EXACTLY "name: a brace name the opener cut open" fails (the
#   strip already split around a name's own pair at the top level). Mutant fsnamemask (fsParenNameMask
#   never consulted) = exactly that case.
import json, os, subprocess, sys, tempfile, html, shutil, time
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
args = [x for x in sys.argv[1:]]
mutant = None
if '--mutant' in args:
    k = args.index('--mutant'); mutant = args[k + 1]; del args[k:k + 2]
tiles = args[0] if args else os.path.join(APP, 'js', 'penumbra_tiles.js')
MUTANTS = {'fsnamemask': ('        var nameMask = any ? fsParenNameMask(toks) : null;', '        var nameMask = null;')}
CASES = r"""
var T = window.PenumbraTiles, S = T.strip, out = [];
function eq(n, g, w) { out.push((JSON.stringify(g) === JSON.stringify(w) ? 'PASS ' : 'FAIL ') + n + (JSON.stringify(g) === JSON.stringify(w) ? '' : '  got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w))); }
var sp = T.splitTopLevel;
eq('split nested group one part', sp('((A = 1 or B = 2) and C = 3) or D = 4'), { prefix: '', parts: ['((A = 1 or B = 2) and C = 3)', 'D = 4'], or: true });
eq('split prefix kept', sp('__ROW (A = 1 or B = 2) and C = 3'), { prefix: '__ROW ', parts: ['(A = 1 or B = 2)', 'C = 3'], or: false });
eq('split quotes with parens inside', sp("A = 'x (y) z' and B = 2"), { prefix: '', parts: ["A = 'x (y) z'", 'B = 2'], or: false });
eq('split regex with parens inside', sp('A = /^(?:x|y)$/ or B = 2'), { prefix: '', parts: ['A = /^(?:x|y)$/', 'B = 2'], or: true });
eq('split exact literal with parens', sp('A = //(x)// and B = 2'), { prefix: '', parts: ['A = //(x)//', 'B = 2'], or: false });
eq('split value-slot paren is a value', sp('A = (x) or B = 2'), { prefix: '', parts: ['A = (x)', 'B = 2'], or: true });
eq('split unbalanced is text', sp('(A = 1 or B = 2 and C = 3'), { prefix: '', parts: ['(A = 1', 'B = 2', 'C = 3'], or: true });
eq('split empty group', sp('() and A = 1'), { prefix: '', parts: ['()', 'A = 1'], or: false });
eq('split: a closer glued to a word is text (the engines read it the same)', sp('(A = 1 or B = 2)and C = 3'), { prefix: '', parts: ['(A = 1', 'B = 2)and C = 3'], or: true });
eq('add to nested or box wraps whole', S.add('((A = 1 or B = 2) and C = 3) or D = 4', 'E = 5'), '(((A = 1 or B = 2) and C = 3) or D = 4) and E = 5');
eq('remove unwraps nested', S.remove('(((A = 1 or B = 2) and C = 3) or D = 4) and E = 5', 'E = 5'), '((A = 1 or B = 2) and C = 3) or D = 4');
eq('add twice is once', S.add(S.add('A = 1 or B = 2', 'C = 3'), 'C = 3'), '(A = 1 or B = 2) and C = 3');
eq('add to a wrapped box does not re-wrap', S.add('(A = 1 or B = 2) and C = 3', 'D = 4'), '(A = 1 or B = 2) and C = 3 and D = 4');
eq('add to a lone group', S.add('(A = 1 or B = 2)', 'C = 3'), '(A = 1 or B = 2) and C = 3');
eq('remove the or cond from the lone group empties', S.remove('(A = 1 or B = 2)', 'A = 1 or B = 2'), '');
eq('remove the or cond from the plain or text empties', S.remove('A = 1 or B = 2', 'A = 1 or B = 2'), '');
eq('has or cond on plain or text', S.has('A = 1 or B = 2', 'A = 1 or B = 2'), true);
eq('has a branch is false', S.has('A = 1 or B = 2', 'A = 1'), false);
eq('remove a branch leaves the text', S.remove('A = 1 or B = 2', 'B = 2'), 'A = 1 or B = 2');
eq('prefix or add', S.add('__ROW A = 1 or B = 2', 'C = 3'), '__ROW (A = 1 or B = 2) and C = 3');
eq('prefix or remove unwraps', S.remove('__ROW (A = 1 or B = 2) and C = 3', 'C = 3'), '__ROW A = 1 or B = 2');
eq('two groups remain two parts after remove', S.remove('(A = 1 or B = 2) and (C = 3 or D = 4) and E = 5', 'E = 5'), '(A = 1 or B = 2) and (C = 3 or D = 4)');
eq('remove a group cond by its text', S.remove('(A = 1 or B = 2) and C = 3', 'A = 1 or B = 2'), 'C = 3');
eq('cond with quotes holding or is one condition', S.add('X = 1', "A = 'b or c'"), "X = 1 and A = 'b or c'");
eq('cond with spacing differences is one', S.add('(A = 1 or B = 2) and C=3', 'C = 3'), '(A = 1 or B = 2) and C=3');
eq('state rest holds the group', S.state('(A = 1 or B = 2) and COLLEGE = /^(?:Eng)$/', [{ label: 'College', col: 'COLLEGE', mode: 'in', top: 12, az: false }]).rest, ['(A = 1 or B = 2)']);
eq('state claims the chip beside the group', S.state('(A = 1 or B = 2) and COLLEGE = /^(?:Eng)$/', [{ label: 'College', col: 'COLLEGE', mode: 'in', top: 12, az: false }]).sel.COLLEGE, ['Eng']);
eq('state does not claim a chip inside the group', S.state('(COLLEGE = /^(?:Eng)$/ or B = 2)', [{ label: 'College', col: 'COLLEGE', mode: 'in', top: 12, az: false }]).sel.COLLEGE, undefined);
eq('compose keeps the group as rest', S.compose(S.state('(A = 1 or B = 2) and COLLEGE = /^(?:Eng)$/', [{ label: 'College', col: 'COLLEGE', mode: 'in', top: 12, az: false }]), [{ label: 'College', col: 'COLLEGE', mode: 'in', top: 12, az: false }]), 'COLLEGE = /^(?:Eng)$/ and (A = 1 or B = 2)');
eq('value-slot paren in add is literal', S.add('A = (x)', 'B = 2'), 'A = (x) and B = 2');
eq('value-slot paren in remove', S.remove('A = (x) and B = 2', 'B = 2'), 'A = (x)');
eq('unwrap never touches a value paren', S.remove('A = (x) and B = 2', 'B = 2'), 'A = (x)');
// parennames (2026-11-03): a name that holds parentheses is one part, inside a group too
eq('name: a pair before an operator is the name', sp('HR (D) > 50 and A = 1'), { prefix: '', parts: ['HR (D) > 50', 'A = 1'], or: false });
eq('name: two words in the pair', sp('S (NOT X) = yes or A = 1'), { prefix: '', parts: ['S (NOT X) = yes', 'A = 1'], or: true });
eq('name: inside a group', sp('(HR (D) > 50 or A = 1) and B = 2'), { prefix: '', parts: ['(HR (D) > 50 or A = 1)', 'B = 2'], or: false });
eq('name: a brace name the opener cut open', sp('({HR (D)} > 50 or A = 1) and B = 2'), { prefix: '', parts: ['({HR (D)} > 50 or A = 1)', 'B = 2'], or: false });
eq('name: add wraps an or text with a name', S.add('HR (D) > 50 or A = 1', 'B = 2'), '(HR (D) > 50 or A = 1) and B = 2');
eq('name: remove unwraps it again', S.remove('(HR (D) > 50 or A = 1) and B = 2', 'B = 2'), 'HR (D) > 50 or A = 1');
eq('name: a plain group still groups', sp('(A = 1 or B = 2) and HR (D) > 50'), { prefix: '', parts: ['(A = 1 or B = 2)', 'HR (D) > 50'], or: false });
document.getElementById('out').textContent = 'RESULT\n' + out.join('\n');
"""
work = tempfile.mkdtemp(prefix='pnb_stripu_')
shutil.copyfile(os.path.join(APP, 'js', 'jquery-3.7.1.min.js'), os.path.join(work, 'jquery-3.7.1.min.js'))
src = open(tiles, 'rb').read().decode('utf-8')
if mutant:
    old, new = MUTANTS[mutant]
    if src.count(old) != 1: raise SystemExit('mutant %s anchor found %d times' % (mutant, src.count(old)))
    src = src.replace(old, new); print('MUTANT ' + mutant)
open(os.path.join(work, 'penumbra_tiles.js'), 'wb').write(src.encode('utf-8'))
page = ('<!doctype html><html><body><pre id="out">running</pre><script src="jquery-3.7.1.min.js"></script>'
        '<script>window.penumbra_vars = {}; window.__errors = []; window.addEventListener("error", function (e) { window.__errors.push(String(e.message)); });</script>'
        '<script src="penumbra_tiles.js"></script><script>try {' + CASES + '} catch (e) { document.getElementById("out").textContent = "RESULT\\nFATAL " + (e && e.stack || e); }</script></body></html>')
with open(os.path.join(work, 'u.html'), 'w', encoding='utf-8') as fh:
    fh.write(page)
args = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
        '--user-data-dir=' + os.path.join(work, 'profile'), '--timeout=15000', '--dump-dom', 'file:///' + work.replace('\\', '/') + '/u.html']
out = subprocess.run(args, capture_output=True, timeout=120).stdout.decode('utf-8', 'replace')
i = out.find('RESULT'); j = out.find('</pre>', i)
txt = html.unescape(out[i:j]) if i >= 0 else 'no result'
print(txt)
print('%d PASS, %d FAIL' % (txt.count('\nPASS '), txt.count('\nFAIL ')))
for _ in range(5):
    try:
        shutil.rmtree(work); break
    except OSError:
        time.sleep(2)
