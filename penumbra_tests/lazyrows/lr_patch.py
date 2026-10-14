# Lazy rows (2026-09-30) - every edit to an existing
# file as exact (old -> new) text pairs, so the change re-stages in one command
# on ANY newer live copy and can be taken out again without touching anyone
# else's later work.
#
#   py -3 hc_patch.py forward <in_dir> <out_dir>   apply (every OLD must match exactly once)
#   py -3 hc_patch.py reverse <in_dir> <out_dir>   remove (every NEW must match exactly once)
#   py -3 hc_patch.py check   <dir>                report which state each edit is in
#
# Files are read and written as BYTES (main.js is CRLF with 2 NULs; index.php is
# LF) - the edit texts below carry their own line endings per file.
import os, sys

EDITS = []   # (file, name, old, new)

def edit(fname, name, old, new):
    EDITS.append((fname, name, old, new))

# Line-ending helpers: main.js is CRLF.
def crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')

for _ef in ('lr_edits.py',):
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), _ef), encoding='utf-8').read())

def load(d, f):
    return open(os.path.join(d, f), 'rb').read().decode('utf-8', 'surrogateescape')

def save(d, f, s):
    os.makedirs(os.path.dirname(os.path.join(d, f)), exist_ok=True)
    open(os.path.join(d, f), 'wb').write(s.encode('utf-8', 'surrogateescape'))

def run(mode, src, dst=None):
    files = sorted(set(e[0] for e in EDITS))
    texts = {f: load(src, f) for f in files}
    bad = 0
    for f, name, old, new in EDITS:
        s = texts[f]
        a, b = (old, new) if mode == 'forward' else (new, old)
        if mode == 'check':
            no, nn = s.count(old), s.count(new)
            inner = 1 if old in new else 0   # an insert-style edit: OLD lives inside NEW
            state = 'APPLIED' if (nn == 1 and no == inner) else ('ABSENT' if (no == 1 and nn == 0) else 'CONFLICT old=%d new=%d' % (no, nn))
            print('  %-10s %-34s %s' % (f, name, state))
            continue
        n = s.count(a)
        if n != 1:
            print('  FAIL %-10s %-34s anchor found %d times' % (f, name, n)); bad += 1
            continue
        texts[f] = s.replace(a, b)
        print('  ok   %-10s %s' % (f, name))
    if mode == 'check':
        return 0
    if bad:
        print('NOTHING WRITTEN: %d anchor failure(s)' % bad)
        return 1
    for f in files:
        save(dst, f, texts[f])
    print('wrote %d file(s) to %s' % (len(files), dst))
    return 0

if __name__ == '__main__':
    mode = sys.argv[1]
    sys.exit(run(mode, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
