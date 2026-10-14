# Round 3 (2026-10-02, a tick that creates or empties a band): adds the grp3-* mutants to
# mutants.json, every anchor checked against the build they were made for (the staged main.js).
#   py -3 mk_mutants_grp3.py <main.js> <mutants.json>
# must = None until frozen from an EXPLORE run (run.py prints the red set).
import sys, json
src = open(sys.argv[1], 'rb').read().decode('utf-8', 'surrogateescape')
N = '\r\n'
M = [
 # name, [(old, new)], must-red, scenarios
 # a band the tick CREATES opens (with the bands above it)
 ('grp3-noopen', [("                    if (isNew && src.shown) { openBandPath(dw); openedAny = true; }",
                   "                    void isNew;")], None, ['firsttick', 'alltick', 'nestfirst', 'lasttick']),
 # ... and the reader is shown where the row went
 ('grp3-noreveal', [("            if (reveal) {" + N + "                revealVertically(reveal.tr, sc);",
                     "            if (false) {" + N + "                revealVertically(reveal.tr, sc);")], None, ['firsttick', 'alltick', 'lasttick', 'nestfirst', 'lastdesc']),
 # ... also when the band it left is GONE (the last mark unticked)
 ('grp3-nogone', [("                    if (!reveal && src.shown && (isNew || !bandsAfter[src.path])) reveal = { tr: dtrs[dj], band: isNew ? dw : null };",
                   "                    if (!reveal && src.shown && isNew) reveal = { tr: dtrs[dj], band: isNew ? dw : null };")], None, ['lasttick', 'lastdesc', 'firsttick']),
 # the reveal scrolls inside the band's own box first
 ('grp3-noinner', [("            if (box && box.scrollHeight > box.clientHeight) {" + N + "                var br = box.getBoundingClientRect(), er = el.getBoundingClientRect();",
                    "            if (false) {" + N + "                var br = box.getBoundingClientRect(), er = el.getBoundingClientRect();")], None, ['lasttick', 'lastdesc', 'firsttick']),
 # ... and below the band headers parked at the top of the page
 ('grp3-nocover', [("            var r = el.getBoundingClientRect(), pad = 8, topEdge = vr.top + pad + stickyCover(el);",
                    "            var r = el.getBoundingClientRect(), pad = 8, topEdge = vr.top + pad;")], None, ['lastdesc', 'nestfirst', 'firsttick']),
 # bands created by state landing follow "start expanded to"
 ('grp3-nodepth', [("            if (typeof currentGroupStartDepth === 'number' && currentGroupStartDepth > 0) {",
                    "            if (false) {")], None, ['latebands', 'firsttick']),
 # the band a row went into lights up its header
 ('grp3-noflash', [("            for (var fb = 0; fb < destBands.length; fb++) flashBandHeader(destBands[fb]);",
                    "            void destBands;")], None, ['firsttick']),
]
out = json.load(open(sys.argv[2], encoding='utf-8'))
for name, edits, must, scn in M:
    for old, new in edits:
        n = src.count(old)
        if n != 1: raise SystemExit('%s: anchor found %d times: %r' % (name, n, old[:80]))
    keep = out.get(name, {}).get('must') if name in out else None
    out[name] = {'edits': edits, 'must': must if must is not None else keep, 'scn': scn}
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
print('anchors ok:', len(M), 'grp3 mutants;', len(out), 'in all')
