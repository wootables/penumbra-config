# =============================================================================
# FILTER WORDING (2026-10-19): the "search box" is the "filter box" in every
# user-facing word (help, tooltips, messages, emails); ids, classes, saved names,
# data(search), search|, &search= stay. Re-applies to ANY copy of the app files
# (the live webroot moves often: main.js, index.php, the help).
#
#   py -3 patch.py SRC_ROOT OUT_ROOT       read each file from SRC_ROOT (app layout),
#                                          write the patched copy to OUT_ROOT/<rel>
#   py -3 patch.py SRC_ROOT --check        counts only, nothing written
#   py -3 patch.py SRC_ROOT OUT_ROOT --code-only   only edits_code.py (no hunks)
#
# Two kinds of edit, both exact:
#   edits_code.py  ENTRIES (rel, old, new, count): phrase edits to the code files;
#                  old must occur exactly `count` times when its turn comes.
#   hunks.json     {rel: [[old, new], ...]}: whole-line hunks cut by mkhunks.py from
#                  orig -> stage for the help topics / tips / AI prompt (the prose
#                  the agents and I edited); old must occur exactly ONCE.
# Any miss or repeat = a PROBLEM line and NOTHING is written. A file already
# patched (every old gone, every new there) is reported, not re-patched.
# Anchors are written with \n; a CRLF file gets \r\n.
# =============================================================================
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edits_code import ENTRIES

def eol_of(t):
    return '\r\n' if t.count('\r\n') * 2 > t.count('\n') else '\n'

def conv(s, eol):
    return s.replace('\r\n', '\n').replace('\n', eol)

def load_hunks():
    p = os.path.join(HERE, 'hunks.json')
    if not os.path.exists(p): return {}
    with open(p, 'rb') as f: return json.loads(f.read().decode('utf-8'))

def plan(code_only=False):
    """{rel: [(kind, old, new, count), ...]} in application order."""
    out = {}
    for rel, old, new, n in ENTRIES:
        out.setdefault(rel, []).append(('phrase', old, new, n))
    if not code_only:
        for rel, hs in load_hunks().items():
            for old, new in hs:
                out.setdefault(rel, []).append(('hunk', old, new, 1))
    return out

def apply_file(t, edits, rel, problems, verbose=True):
    eol = eol_of(t)
    done_already = all(t.count(conv(new, eol)) >= 1 and t.count(conv(old, eol)) == 0 for _k, old, new, _n in edits)
    if done_already:
        problems.append('%s: already patched (every old gone, every new there)' % rel)
        return t
    for i, (kind, old, new, n) in enumerate(edits):
        o, nw = conv(old, eol), conv(new, eol)
        c = t.count(o)
        if verbose:
            print('  %-44s %-6s #%-3d x%d%s' % (rel, kind, i + 1, c, '' if c == n else '   <-- want %d' % n))
        if c != n:
            problems.append('%s: %s #%d found %d times (want %d): %r' % (rel, kind, i + 1, c, n, old[:90]))
            continue
        t = t.replace(o, nw)
    return t

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    if not args: raise SystemExit('usage: patch.py SRC_ROOT OUT_ROOT|--check [--code-only] [--quiet]')
    src = args[0]
    check = '--check' in flags
    if not check and len(args) < 2: raise SystemExit('usage: patch.py SRC_ROOT OUT_ROOT|--check')
    out = None if check else args[1]
    results, problems = [], []
    for rel, edits in plan('--code-only' in flags).items():
        p = os.path.join(src, rel)
        if not os.path.exists(p): problems.append('%s: missing in %s' % (rel, src)); continue
        raw = open(p, 'rb').read()
        t = raw.decode('utf-8', 'surrogateescape')
        nt = apply_file(t, edits, rel, problems, verbose='--quiet' not in flags)
        results.append((rel, nt.encode('utf-8', 'surrogateescape'), raw))
    if problems:
        for x in problems: print('PROBLEM: ' + x)
        raise SystemExit('nothing written')
    if check:
        print('CHECK OK: %d files, nothing written' % len(results)); return
    for rel, data, raw in results:
        d = os.path.join(out, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        with open(d, 'wb') as f: f.write(data)
        print('wrote %s (%+d bytes)' % (d, len(data) - len(raw)))

if __name__ == '__main__':
    main()
