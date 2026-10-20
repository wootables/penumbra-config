# find round 2c (2026-10-19): the README rows - 42 mutants (section 3) and Esc on a group's name
# (section 5).
#   py -3 readme_patch2c.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

PAIRS = [
    ('mutants',
     "# `--mutants` runs all 41. About 70 s; the mutants several minutes. Run it from a LOCAL folder\n",
     "# `--mutants` runs all 42. About 70 s; the mutants several minutes. Run it from a LOCAL folder\n"),
    ('bandesc',
     "  Filter is not offered when the search already holds the term (as one of its AND parts). In a\n"
     "  dialog Ctrl+F stays the browser's.\n",
     "  Filter is not offered when the search already holds the term (as one of its AND parts). A\n"
     "  group's name has no row: Esc there hands no cell over (the focus goes back), and close() must\n"
     "  never read `hit.tr` unguarded. In a dialog Ctrl+F stays the browser's.\n"),
]

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if "never read `hit.tr` unguarded" in t: raise SystemExit('already patched')
    if '\r\n' in t: raise SystemExit('the README has CRLF: the anchors are LF')
    for name, old, new in PAIRS:
        n = t.count(old)
        print('  %-8s anchor x%d' % (name, n))
        if n != 1: raise SystemExit('nothing written')
    for name, old, new in PAIRS:
        t = t.replace(old, new)
    open(out, 'wb').write(t.encode('utf-8', 'surrogateescape'))
    print('wrote ' + out)

main()
