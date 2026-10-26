# =============================================================================
# URLNUM SUITE (2026-10-25) - a ?sort= level on a column named only in digits
#
# A header click keeps jQuery's data('colname') value as the sort level's colIdentifier:
# for a column named 2021 (as a PIVOT query yields) the NUMBER 2021 - on purpose, see
# _pnbStateSortByName's comment in main.js - and the next click and the header menu's
# Clear sort find a level by that value (===). The ?sort= resolver
# (_penumbraResolveUrlSortCriteria: a plain ?sort= URL, a FLAT view link's sort, and every
# re-run while ?sort= is in the URL) named the level with the TEXT '2021', and the state
# load's by-name pass (_pnbStateSortByName) kept it, as it named its column as text. The
# report opened sorted and marked (by the level's place), but the next click on the heading
# started over at ascending and Clear sort did nothing. The fix: the resolver names the
# level as the heading's data() reads it, and the by-name pass gives every level it keeps
# that form (a level saved as text too - the ldsort suite's numsaved); updateHeaderIcons'
# pivot branch String()s an identifier before .includes('::') (hardening).
#
# Each scenario boots the REAL main.js (+ the REAL header menu) through the real run path
# (stubbed query.php) on the vldigit suite's fixture plus a column 0042 (2021, 2022, V_ID,
# V_NAME, V_STATUS, 0042; 60 rows):
#   fA  flat, sorted by clicks (2021 twice: descending); the link built through the real builder
#   fB  fA's link opened: the level the number, marked, rows in order, data(colsort, 2021); the
#       next click takes it off
#   fC  fA's link opened: the header menu's Clear sort (a right-click, the item clicked) clears it
#   uA  ?sort=2021: the number; the next click goes on to descending
#   uB  ?sort=2021|desc,V_NAME then a re-run (Run): the number at both; the next click on 2021
#       takes its level off and keeps V_NAME's
#   uC  ?sort=0042|desc then a re-run: a leading zero keeps the name TEXT (what a click keeps)
#   uJ  a column named [1] too (data() parses it as JSON: an array), ?sort=[1]|desc then a re-run:
#       the level stays TEXT - a number only - at the load, in a link made then, after the re-run
#   pA  a pivot report: its own heading sort marks; a numeric level in its sort does not throw
#   P-* premises (data() really hands back the number); E-* page errors
#
#   py -3 run.py --stage DIR            DIR\js\main.js or DIR\main.js (no fallback to live)
#   py -3 run.py                        the LIVE js\main.js
#   py -3 run.py --control              the build without the fix: EXACTLY the NEW checks red.
#                                       Live main.js until the fix is deployed (refused once it
#                                       has it); --rev REV reads that build from git instead
#                                       (after the deploy: --rev <the fix commit>^).
#   py -3 run.py --stage DIR --mutants  every mutant, each turning EXACTLY its checks red
#   py -3 run.py --mutant NAME          one; --scn a,b a subset; --keep keeps the staging dir
#
# Headless Edge over CDP; stages into %TEMP%\pnb_un_*; writes nothing to the webroot.
# One headless suite at a time on this workstation.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from urllib.parse import quote
import websocket
try: sys.stdout.reconfigure(errors='backslashreplace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
OLDVER = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_presets.js', 'penumbra_calc.js', 'penumbra_colwidths.js', 'penumbra_grouplist.js', 'penumbra_colmenu.js']
CSS = ['main.css', 'penumbra_colmenu.css']
ALL_SCN = ['fA', 'fB', 'fC', 'uA', 'uB', 'uC', 'uJ', 'pA']
QUERY = {'fA': '', 'fB': '', 'fC': '', 'uA': '&sort=2021', 'uB': '&sort=' + quote('2021|desc,V_NAME', safe=''),
         'uC': '&sort=' + quote('0042|desc', safe=''), 'uJ': '&sort=' + quote('[1]|desc', safe=''), 'pA': ''}
# the fix, as the candidate must (and the control must not) have it: the resolver's level
RESOLVED = "criteria.push({ colIdentifier: typeof asClick === 'number' ? asClick : upper, colIndex: hit.idx, direction: dir });"
MARKER = RESOLVED
HEAD_NEW = "        var heading = function (n) { var u = String(n).toUpperCase(), d = $('<th>').attr('data-colname', u).data('colname'); return typeof d === 'number' ? d : u; };\r\n"
HEAD_ANY = "        var heading = function (n) { return $('<th>').attr('data-colname', String(n).toUpperCase()).data('colname'); };\r\n"

# What the build without the fix gets wrong - and ONLY that (the rest are GUARDs: green on both).
NEW = ['B-sort', 'B-nextClick', 'C-cleared', 'U-sort', 'U-nextClick', 'R-load', 'R-rerun', 'R-nextClick', 'H-noThrow']
CHECKS = {'fA': ['P-fA', 'A-click', 'A-built', 'E-fA'],
          'fB': ['P-fB', 'B-applied', 'B-sort', 'B-marked', 'B-colsort', 'B-nextClick', 'E-fB'],
          'fC': ['P-fC', 'C-offered', 'C-cleared', 'E-fC'],
          'uA': ['P-uA', 'U-sort', 'U-marked', 'U-nextClick', 'E-uA'],
          'uB': ['P-uB', 'R-load', 'R-rerun', 'R-rows', 'R-nextClick', 'E-uB'],
          'uC': ['P-uC', 'Z-sort', 'Z-rerun', 'Z-nextClick', 'E-uC'],
          'uJ': ['P-uJ', 'J-sort', 'J-link', 'J-rerun', 'E-uJ'],
          'pA': ['H-pivot', 'H-ownSort', 'H-noThrow', 'E-pA']}

# --- mutants: the fix undone one way at a time (on the FIXED build) -> EXACTLY these checks red ---
KEPT_NEW = ("            kept.push({ colIdentifier: heading(names[i]),\r\n")
KEPT_OLD = ("            kept.push({ colIdentifier: String(c.colIdentifier) === names[i].toUpperCase() ? c.colIdentifier : heading(names[i]),\r\n")
URL_OLD = "criteria.push({ colIdentifier: upper, colIndex: hit.idx, direction: dir });"
MUTANTS = {
    # the resolver's text again (the by-name pass still heals a state load): a re-run's level is text
    'urlstr': ([(RESOLVED, URL_OLD)], ['R-rerun', 'R-nextClick'], ['fA', 'fB', 'fC', 'uA', 'uB', 'uC', 'uJ']),
    # both halves as before (the build before the fix, but for the pivot hardening)
    'keeptext': ([(RESOLVED, URL_OLD), (KEPT_NEW, KEPT_OLD)],
                 ['B-sort', 'B-nextClick', 'C-cleared', 'U-sort', 'U-nextClick', 'R-load', 'R-rerun', 'R-nextClick'],
                 ['fA', 'fB', 'fC', 'uA', 'uB', 'uC', 'uJ']),
    # "digits make a number": 0042 is no number to data() - its re-run level is no longer what a click keeps
    'urlnumber': ([(RESOLVED, "criteria.push({ colIdentifier: /^\\d+$/.test(upper) ? Number(upper) : upper, colIndex: hit.idx, direction: dir });")],
                  ['Z-rerun', 'Z-nextClick'], ['uB', 'uC', 'uJ']),
    # the resolver keeps data()'s value whatever it is (the review's find in the first cut): [1] an array after a
    # re-run (the by-name pass makes a state load's text again)
    'anyurl': ([(RESOLVED, "criteria.push({ colIdentifier: asClick, colIndex: hit.idx, direction: dir });")],
               ['J-rerun'], ['uA', 'uB', 'uC', 'uJ']),
    # ...and the by-name pass's heading() likewise: a state load's [1] an array, and a link names it "1"
    'anyheal': ([(HEAD_NEW, HEAD_ANY)], ['J-sort', 'J-link'], ['uA', 'uB', 'uC', 'uJ']),
    # the pivot branch's .includes on the identifier as it is: a number throws
    'pivstr': ([("                if (String(crit.colIdentifier).includes('::')) {\r\n", "                if (crit.colIdentifier.includes('::')) {\r\n")],
               ['H-noThrow'], ['pA']),
}

# --- args -----------------------------------------------------------------------------------------
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
rev = opt('--rev', None)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if rev and not control: raise SystemExit('--rev is for --control')
if control and stage_dir: raise SystemExit('--control tests the build without the fix: no --stage')
# the fix is LIVE since 52d015b (2026-10-25): the control is the build before it, read from git (--rev REV for another)
if control and not rev: rev = '52d015b^'

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
if control and rev:
    sys.path.insert(0, OLDVER); from oldver import git_show
    cand_path = git_show(rev, 'js/main.js')
elif stage_dir:
    cand_path = next((p for p in (os.path.join(stage_dir, 'js', 'main.js'), os.path.join(stage_dir, 'main.js')) if os.path.isfile(p)), None)
    if not cand_path: raise SystemExit('no main.js in %s (DIR\\js\\main.js or DIR\\main.js): refusing to test live instead' % stage_dir)
else:
    cand_path = os.path.join(APP, 'js', 'main.js')
main_src = read_b(cand_path)
has_fix = MARKER in main_src
if control and has_fix:
    raise SystemExit('the control build has the fix (%s): pass --rev <the fix commit>^ to read the build before it from git' % cand_path)
if (all_mutants or one_mutant) and not has_fix:
    raise SystemExit('mutants need the FIXED build (%s has no fix)' % cand_path)

def hook(src):
    """The ready closure becomes an IIFE with an export hook (the page's sortCriteria, set
    it, the header marks' repaint, the snippet's data() lookup), and hideLoading counts its
    calls (the end of a run / search / apply)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__UN = {'
         ' sortCrit: function () { try { return JSON.parse(JSON.stringify(sortCriteria)); } catch (e) { return null; } },'
         ' setSort: function (s) { sortCriteria = s; },'
         ' icons: function () { updateHeaderIcons(); },'
         ' lookup: function (t, c) { return penumbraDataLookup(t, c); } }; } catch (e) { window.__UN_ERR = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__UN_HIDES = (window.__UN_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:100]))
        src = src.replace(old, new)
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_un_')
os.makedirs(os.path.join(stage, 'c'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, 'c', f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, 'c', f))
shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, 'c', 'harness.html'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'c', 'driver.js'))

def write_build(main_text):
    open(os.path.join(stage, 'c', 'main_un.js'), 'wb').write(main_text.encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
prof = os.path.join(stage, 'profile')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + prof, '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
for _ in range(100):
    try: urllib.request.urlopen('http://127.0.0.1:%d/c/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(query):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == mid: return m.get('result', {})
    try:
        call('Page.enable')
        # every build is written to the same file: never let the browser serve a cached copy
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/c/harness.html?%s' % (hp, query)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__UNDONE ? JSON.stringify(window.__UNRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the scenario (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_suite(main_text, scns):
    write_build(hook(main_text))
    res, obs = [], {}
    for s in scns:
        q = 'scn=%s&id=unfix' % s + QUERY[s]
        if s in ('fB', 'fC'):
            tok = (obs.get('fA') or {}).get('token')
            if not tok:
                res.append(('F-' + s, False, 'no link from fA (run fA first; it built none)')); continue
            q += '&view=' + tok
        r = run_page(q)
        if r.get('fatal'):
            res.append(('F-' + s, False, 'fatal: ' + str(r['fatal'])[:500])); continue
        if r.get('hookErr'):
            res.append(('H-' + s + '-hook', False, 'hook: %s' % r.get('hookErr')))
        o = r.get('obs', {}); obs[s] = o
        got = {a['id']: (a['ok'], a['detail']) for a in r.get('asserts', [])}
        got['E-' + s] = (not r.get('errors'), 'page errors: %s' % (r.get('errors') or 'none'))
        for cid in CHECKS[s]:
            ok, detail = got.pop(cid, (False, 'never published'))
            res.append((cid, ok, detail))
        for cid, (ok, detail) in got.items():
            res.append((cid, ok, '(unlisted) ' + detail))
    return res, obs

def with_deps(scns):
    # fB / fC open fA's link: fA runs first
    out = list(scns)
    if any(s in out for s in ('fB', 'fC')) and 'fA' not in out: out.insert(0, 'fA')
    return [s for s in ALL_SCN if s in out]

try:
    scns = with_deps(scn_arg.split(',') if scn_arg else ALL_SCN)
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the build without the fix)' if control else ''), flush=True)
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            edits, must, ms = MUTANTS[name]
            res, _ = run_suite(mutate(main_src, name), with_deps(ms))
            red = [a for a, ok, _ in res if not ok]
            missing = [m for m in must if m not in red]
            stray = [a for a in red if a not in must]
            good = not missing and not stray
            msg = ('turns exactly %s red' % ' '.join(must)) if good else \
                  ('stayed GREEN on %s; also red: %s' % (' '.join(missing) or '-', ' '.join(stray) or '-'))
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-9s %s' % ('PASS' if good else 'FAIL', name, msg), flush=True)
            if not good:
                for a, ok, d in res:
                    if not ok or a in missing: print('        %s %s %s' % ('red' if not ok else 'GREEN', a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res, obs = run_suite(main_src, scns)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %-14s %s' % ('PASS' if ok else 'FAIL', aid, detail[:500]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        for s in scns:
            o = obs.get(s) or {}
            keep_keys = [k for k in ('sortAtOpen', 'sortRerun', 'afterClick', 'afterClear', 'ownSort', 'build', 'bootErrors') if k in o]
            if keep_keys: print('  obs %-3s %s' % (s, '; '.join('%s=%s' % (k, json.dumps(o[k])) for k in keep_keys))[:900])
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            want = [a for a in NEW if any(a in CHECKS[s] for s in scns)]
            exact = sorted(failed) == sorted(want)
            print('CONTROL: %s (expected red: %s)' % ('red set is EXACTLY the documented bug' if exact else 'red set DIFFERS from NEW', ' '.join(want)))
            print('RESULT: GREEN' if exact else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
