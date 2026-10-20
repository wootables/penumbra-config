# =============================================================================
# FILTER WORDING (2026-10-19): cut hunks.json from orig -> stage for the PROSE
# files (help topics, tip stores, the AI prompt): every file that differs and is
# not edited by edits_code.py, except the generated optionsHelpLightbox.php
# (regenerate that one from help/snippets.php instead).
#
#   py -3 mkhunks.py ORIG_ROOT STAGE_ROOT      writes hunks.json beside this script
#
# A hunk is PHRASE-level: the changed words of one line plus the fewest neighbouring
# words that make the old text occur exactly ONCE in the orig file (so another
# session's edit elsewhere in the same paragraph does not break it). Changes close
# together in a line share one hunk. A line added or removed whole falls back to a
# line hunk widened with neighbouring lines. The result is proven: applying every
# hunk to orig must give the stage byte for byte, or nothing is written.
# =============================================================================
import difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edits_code import ENTRIES

SKIP = {'help/topics/optionsHelpLightbox.php'}
TOK = re.compile(r'\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]')

def files_under(root):
    out = []
    for d, _dirs, fs in os.walk(root):
        for f in fs:
            out.append(os.path.relpath(os.path.join(d, f), root).replace('\\', '/'))
    return sorted(out)

def line_hunks(a_text, A, B, i1, i2, j1, j2):
    """whole lines, widened until unique (inserted / deleted lines)"""
    lo, hi = (max(0, i1 - 1), i2) if i1 == i2 else (i1, i2)
    while not (''.join(A[lo:hi]) and a_text.count(''.join(A[lo:hi])) == 1):
        if lo == 0 and hi == len(A): raise SystemExit('cannot make a unique anchor')
        if lo > 0: lo -= 1
        if not (''.join(A[lo:hi]) and a_text.count(''.join(A[lo:hi])) == 1) and hi < len(A): hi += 1
    pre, post = i1 - lo, hi - i2
    return [[''.join(A[lo:hi]), ''.join(B[j1 - pre:j2 + post])]]

def phrase_hunks(a_text, la, lb):
    """the changed spans of one line pair, each with the fewest context tokens that make it unique"""
    ta, tb = TOK.findall(la), TOK.findall(lb)
    assert ''.join(ta) == la and ''.join(tb) == lb
    sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
    ops = [o for o in sm.get_opcodes() if o[0] != 'equal']
    # merge spans with fewer than 8 equal tokens between them
    spans = []
    for _t, i1, i2, j1, j2 in ops:
        if spans and i1 - spans[-1][1] < 8:
            s = spans[-1]; spans[-1] = [s[0], i2, s[2], j2]
        else:
            spans.append([i1, i2, j1, j2])
    out = []
    prev_hi = 0
    for n, (i1, i2, j1, j2) in enumerate(spans):
        nxt_lo = spans[n + 1][0] if n + 1 < len(spans) else len(ta)
        k = 2
        while True:
            lo, hi = max(prev_hi, i1 - k), min(nxt_lo, i2 + k)
            old = ''.join(ta[lo:hi])
            if a_text.count(old) == 1: break
            if lo == prev_hi and hi == nxt_lo: return None      # cannot isolate inside the line
            k += 2
        pre, post = i1 - lo, hi - i2
        out.append([old, ''.join(tb[j1 - pre:j2 + post])])
        prev_hi = hi
    return out

def hunks_for(a_text, b_text):
    A = a_text.splitlines(keepends=True)
    B = b_text.splitlines(keepends=True)
    sm = difflib.SequenceMatcher(None, A, B, autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal': continue
        if op == 'replace' and (i2 - i1) == (j2 - j1):
            for k in range(i2 - i1):
                ph = phrase_hunks(a_text, A[i1 + k], B[j1 + k])
                out.extend(ph if ph is not None else line_hunks(a_text, A, B, i1 + k, i1 + k + 1, j1 + k, j1 + k + 1))
        else:
            out.extend(line_hunks(a_text, A, B, i1, i2, j1, j2))
    return out

def apply(text, hs):
    for old, new in hs:
        if text.count(old) != 1: return None
        text = text.replace(old, new)
    return text

def main():
    ro, rs = sys.argv[1], sys.argv[2]
    code = {rel for rel, _o, _n, _c in ENTRIES}
    result = {}
    for rel in files_under(rs):
        if rel in code or rel in SKIP: continue
        po, ps = os.path.join(ro, rel), os.path.join(rs, rel)
        if not os.path.exists(po): print('NEW FILE (not handled): ' + rel); continue
        a = open(po, 'rb').read().decode('utf-8', 'surrogateescape')
        b = open(ps, 'rb').read().decode('utf-8', 'surrogateescape')
        if a == b: continue
        hs = hunks_for(a, b)
        got = apply(a, hs)
        if got != b: raise SystemExit('PROOF FAILED for %s: the hunks do not rebuild the stage (nothing written)' % rel)
        result[rel] = hs
        print('%-48s %3d hunks (longest anchor %d chars)' % (rel, len(hs), max(len(h[0]) for h in hs)))
    with open(os.path.join(HERE, 'hunks.json'), 'wb') as f:
        f.write(json.dumps(result, ensure_ascii=False, indent=1).encode('utf-8'))
    print('wrote hunks.json: %d files, %d hunks' % (len(result), sum(len(v) for v in result.values())))

if __name__ == '__main__':
    main()
