# =============================================================================
# bigperf recut (2026-10-19): cut the live files into orig<N>, build stage<N> from them,
# prove the change set is the tested one.
#
#   py -3 recut.py N [REF]     REF = the stage<K> whose change set is the tested one (default 2)
#
#   - copies the live js/main.js, js/penumbra_a11y.js, js/penumbra_cellsel.js,
#     css/main.css, index.php into orig<N> (+ SHA256SUMS_orig<N>.txt)
#   - stage<N>/js/main.js and css/main.css = patch_bp.py over orig<N> (anchors x1 or nothing)
#   - stage<N>/js/penumbra_a11y.js and penumbra_cellsel.js = REF's whole-file copies, ONLY
#     if the live file is still the one REF was made from (orig<K>); else it stops
#   - the sorted +/- lines of orig<N> -> stage<N> must equal orig<K> -> stage<K>, per file
# Prints CHANGESET IDENTICAL and RECUT OK, or stops with what differs. Writes only in the kit.
# =============================================================================
import difflib, hashlib, os, shutil, subprocess, sys

KIT = os.path.dirname(os.path.abspath(__file__))
LIVE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
CUT = ['js/main.js', 'js/penumbra_a11y.js', 'js/penumbra_cellsel.js', 'css/main.css', 'index.php']
PATCHED = ['js/main.js', 'css/main.css']
WHOLE = ['js/penumbra_a11y.js', 'js/penumbra_cellsel.js']

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def lines(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape').splitlines()
def changeset(a, b):
    return sorted(l for l in difflib.unified_diff(lines(a), lines(b), lineterm='', n=0)
                  if l[:1] in '+-' and not l.startswith(('+++', '---')))

def main():
    if len(sys.argv) < 2: raise SystemExit('usage: recut.py N [REF]')
    n, ref = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '2')
    orig, stage = os.path.join(KIT, 'orig' + n), os.path.join(KIT, 'stage' + n)
    rorig, rstage = os.path.join(KIT, 'orig' + ref), os.path.join(KIT, 'stage' + ref)
    if os.path.exists(orig) or os.path.exists(stage): raise SystemExit('orig%s / stage%s exist already: pick another N' % (n, n))
    for rel in CUT:
        os.makedirs(os.path.dirname(os.path.join(orig, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(LIVE, rel), os.path.join(orig, rel))
    with open(os.path.join(KIT, 'SHA256SUMS_orig%s.txt' % n), 'w', encoding='ascii', newline='\n') as f:
        for rel in CUT: f.write('%s *%s\n' % (sha(os.path.join(orig, rel)), rel))
    for rel in CUT: print('cut  %s  %s' % (sha(os.path.join(orig, rel))[:16], rel))
    for rel in WHOLE:
        if sha(os.path.join(orig, rel)) != sha(os.path.join(rorig, rel)):
            raise SystemExit('STOP: live %s moved since orig%s - merge the change into the module first' % (rel, ref))
    r = subprocess.run([sys.executable, os.path.join(KIT, 'patch_bp.py'), orig, stage], capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr)
    if r.returncode != 0: raise SystemExit('STOP: patch_bp.py failed\n' + r.stdout + r.stderr)
    for rel in WHOLE:
        os.makedirs(os.path.dirname(os.path.join(stage, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(rstage, rel), os.path.join(stage, rel))
    bad = []
    for rel in PATCHED + WHOLE:
        a = changeset(os.path.join(rorig, rel), os.path.join(rstage, rel))
        b = changeset(os.path.join(orig, rel), os.path.join(stage, rel))
        print('changeset %-26s %4d lines  %s' % (rel, len(b), 'identical' if a == b else 'DIFFERENT'))
        if a != b: bad.append(rel)
    for rel in PATCHED + WHOLE: print('stage %s  %s' % (sha(os.path.join(stage, rel))[:16], rel))
    if bad: raise SystemExit('STOP: the change set differs for ' + ', '.join(bad))
    print('CHANGESET IDENTICAL')
    print('RECUT OK  orig%s / stage%s' % (n, n))

if __name__ == '__main__':
    main()
