# =============================================================================
# FIND IN RESULTS round 2 (2026-10-19): the grouped view and the pivot - the help.
#   py -3 patch2.py SRC_ROOT OUT_ROOT      help/topics/searchHelpLightbox.php only
#   py -3 patch2.py SRC_ROOT --check
# (Round 2 changes no main.js, index.php or cellsel: the module and its stylesheet
# are whole new copies, taken from stage4\.)
# =============================================================================
import os, sys

def eol_of(t):
    return '\r\n' if t.count('\r\n') * 2 > t.count('\n') else '\n'

def conv(s, eol):
    return s.replace('\r\n', '\n').replace('\n', eol)

HELP_OLD = """            <li>For now Find covers the flat table. In the grouped view, a pivot or a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find.</li>
"""
HELP_NEW = """            <li>It works in the grouped view and in a pivot too. A match inside a collapsed group opens that group (the List layout picks it), a group's name is found in its heading, and a collapsed pivot group expands.</li>
            <li>A pivot has no <strong>Filter to N rows</strong>: its cells are mostly sums. In a dialog, <kbd>Ctrl</kbd>+<kbd>F</kbd> is still your browser's own find.</li>
"""

PATCHES = [
    (os.path.join('help', 'topics', 'searchHelpLightbox.php'), 'It works in the grouped view and in a pivot too', [('round2', HELP_OLD, HELP_NEW)]),
]

def main():
    src, out = sys.argv[1], sys.argv[2]
    check = (out == '--check')
    results, problems = [], []
    for rel, marker, edits in PATCHES:
        t = open(os.path.join(src, rel), 'rb').read().decode('utf-8', 'surrogateescape')
        eol = eol_of(t)
        if marker in t: problems.append('%s: already patched' % rel); continue
        for name, old, new in edits:
            o = conv(old, eol); n = t.count(o)
            print('  %-42s %-8s anchor x%d' % (rel, name, n))
            if n != 1: problems.append('%s: %s anchor x%d' % (rel, name, n)); continue
            t = t.replace(o, conv(new, eol))
        results.append((rel, t))
    if problems:
        for x in problems: print('PROBLEM: ' + x)
        raise SystemExit('nothing written')
    if check: print('CHECK OK (nothing written)'); return
    for rel, t in results:
        d = os.path.join(out, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        open(d, 'wb').write(t.encode('utf-8', 'surrogateescape'))
        print('wrote ' + d)

main()
