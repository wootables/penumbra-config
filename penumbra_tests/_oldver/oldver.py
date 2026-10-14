# =============================================================================
# oldver.py - old versions of webroot files for -Control runs, read from GIT.
#
# Since 2026-10-14 deploys make no <file>.bak-<stamp> copies (git is the backup),
# and the in-tree .bak files were moved out. Suites that used to glob the webroot
# for "<APP>\js\main.js.bak-*-<tag>" call bak_glob() with the SAME pattern instead:
#   1. real files matching the pattern (the webroot, a stage dir, ...), then
#   2. entries of bak_index.tsv whose webroot-relative path matches it:
#        git  -> the blob is written to _oldver\cache\<sha>\<basename> (same basename,
#                so "startswith('main.js.bak-')" checks keep working)
#        file -> a plain path (none left: never-committed .baks live on git branch bak-archive)
#   A real file shadows an index entry with the same name. Sorted by basename, like
#   sorted(glob.glob(...)) on one folder, so "newest = last" still holds.
# New-style controls (no .bak ever existed) use git_show(rev, rel): the file at a
# commit, e.g. git_show('abc1234^', 'js/main.js') = the build before commit abc1234.
#
#   import sys; sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver')
#   from oldver import bak_glob, bak_path, git_show
# =============================================================================
import fnmatch, glob, hashlib, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
WEBROOT = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
GIT_DIR = r'\\oitras.oit.ncsu.edu\d$\Utilities\penumbra_git'
INDEX = os.path.join(HERE, 'bak_index.tsv')
CACHE = os.path.join(HERE, 'cache')
_index = None


def _norm(p):
    return p.replace('\\', '/').lower()


def _rel(path):
    """webroot-relative path ('js/main.js.bak-*-x') or None when not under the webroot."""
    root = _norm(WEBROOT).rstrip('/') + '/'
    n = _norm(path)
    return path.replace('\\', '/')[len(root):] if n.startswith(root) else None


def _load():
    global _index
    if _index is None:
        _index = []
        with open(INDEX, encoding='utf-8') as f:
            for line in f:
                if line.startswith('#') or not line.strip(): continue
                rel, kind, ref = line.rstrip('\r\n').split('\t')
                _index.append((rel, kind, ref))
    return _index


def _git(*args):
    r = subprocess.run(['git', '--git-dir=' + GIT_DIR] + list(args), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise SystemExit('oldver: git %s failed: %s' % (' '.join(args), r.stderr.decode('utf-8', 'replace').strip()))
    return r.stdout


def _blob_to_file(sha, basename):
    d = os.path.join(CACHE, sha)
    p = os.path.join(d, basename)
    if os.path.isfile(p): return p
    data = _git('cat-file', 'blob', sha)
    if hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest() != sha:
        raise SystemExit('oldver: blob %s came back with the wrong hash' % sha)
    os.makedirs(d, exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'wb') as f: f.write(data)
    os.replace(tmp, p)
    return p


def bak_glob(pattern):
    """Drop-in for sorted(glob.glob(pattern)) on a webroot .bak pattern."""
    found = {}
    for p in glob.glob(pattern):
        found[os.path.basename(p).lower()] = p
    rel_pat = _rel(pattern)
    if rel_pat is not None:
        rp = rel_pat.lower()
        for rel, kind, ref in _load():
            if not fnmatch.fnmatchcase(rel.lower(), rp): continue
            base = rel.rsplit('/', 1)[-1]
            if base.lower() in found: continue
            found[base.lower()] = _blob_to_file(ref, base) if kind == 'git' else os.path.normpath(ref)
    return [found[k] for k in sorted(found, key=lambda k: os.path.basename(found[k]))]


def bak_path(path):
    """Drop-in for 'path if os.path.exists(path) else None' on one exact .bak path."""
    if os.path.exists(path): return path
    hits = bak_glob(glob.escape(path))
    return hits[-1] if hits else None


def git_show(rev, rel):
    """The file 'rel' (webroot-relative) as it was at 'rev' - git show <rev>:<rel>, as a path."""
    rel = rel.replace('\\', '/')
    sha = _git('rev-parse', '%s:%s' % (rev, rel)).decode().strip()
    return _blob_to_file(sha, rel.rsplit('/', 1)[-1])
