# stale_anchors.py RUN_PY STAGE [file-key=relpath ...] - every mutant of a suite's run.py whose anchor is not found
# exactly once in the candidate (STAGE, live for what it lacks). Reads MUTANTS from the file's AST: nothing runs.
# An anchor written with LF that matches once as CRLF counts as found (the viewlink runner retries it that way).
import ast, os, sys
run, stage = sys.argv[1], sys.argv[2]
LIVE = r'R:\inetpub\wwwroot\sponsor_migration\penumbra'
files = {'lib': 'penumbra_calc.php', 'sr': 'schedule_runner.php', 'calc': os.path.join('js', 'penumbra_calc.js'),
         'main': os.path.join('js', 'main.js'), 'ix': 'index.php', 'menu': os.path.join('js', 'penumbra_colmenu.js')}
for a in sys.argv[3:]:
    k, v = a.split('=', 1); files[k] = v
tree = ast.parse(open(run, encoding='utf-8').read())
M = None
for node in tree.body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'MUTANTS' for t in node.targets):
        M = ast.literal_eval(node.value)
if M is None: sys.exit('no MUTANTS')
texts = {}
def text(k):
    if k not in texts:
        p = os.path.join(stage, files[k])
        if not os.path.exists(p): p = os.path.join(LIVE, files[k])
        texts[k] = open(p, 'rb').read().decode('utf-8', 'surrogateescape')
    return texts[k]
LF, CRLF = chr(10), chr(13) + chr(10)
bad = []
for name, spec in M.items():
    for f, old, new in spec[0]:
        if f not in files: bad.append((name, f, 'unknown file key', '')); continue
        n = text(f).count(old)
        if n != 1 and text(f).count(old.replace(LF, CRLF)) == 1: n = 1
        if n != 1: bad.append((name, f, n, old[:110]))
print('mutants', len(M), 'stale', len(bad))
for b in bad: print('  %s [%s] x%s: %r' % b)
