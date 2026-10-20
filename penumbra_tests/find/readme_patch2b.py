# find round 2b (2026-10-19): the README rows - 41 mutants (section 3) and why a style-only change
# re-places the bar (section 5).
#   py -3 readme_patch2b.py SRC_README OUT_README      (anchors must hit once; nothing written otherwise)
import sys

PAIRS = [
    ('mutants',
     "# `--mutants` runs all 40. About 70 s; the mutants several minutes. Run it from a LOCAL folder\n",
     "# `--mutants` runs all 41. About 70 s; the mutants several minutes. Run it from a LOCAL folder\n"),
    ('restyle',
     "  60 ms) and ignores its own classes (pnb-find*, pnb-csel*) and style changes that keep the\n"
     "  display. The bar drops to the bottom of the results box when it would cover the current match;\n",
     "  60 ms) and ignores its own classes (pnb-find*, pnb-csel*) and style changes that keep the\n"
     "  display - those only re-place the bar (the List layout draws the picked band's crumb a frame\n"
     "  after the pick, through a style variable on the container, which slid a long group name under\n"
     "  the bar). The bar drops to the bottom of the results box when it would cover the current match;\n"),
]

def main():
    src, out = sys.argv[1], sys.argv[2]
    t = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
    if "those only re-place the bar" in t: raise SystemExit('already patched')
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
