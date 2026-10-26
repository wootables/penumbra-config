# =============================================================================
# VLDIGIT SUITE (2026-10-25) - a view link's sort on a column named only in digits
#
# A header click keeps jQuery's data('colname') value as the sort level's colIdentifier:
# for a column named 2021 (as a PIVOT query yields) the NUMBER 2021 - on purpose, see
# _pnbStateSortByName's comment in main.js. The view link's one validator
# (_pnbViewLinkClean: run when "Copy a link to this view" builds the link AND when the
# link is opened) passed every colIdentifier through _pnbViewName, which takes strings
# only, so a grouped (or pivot) view sorted by such a column was linked - and opened -
# without that sort level. The fix: a finite number passes on its text and stays a
# number (the next click and the header menu find the level by that value); anything
# else must still be a name (tag-shaped / oversized / empty text and every other kind
# of value refused, as a link is anyone's input to any viewer).
#
# Each scenario boots the REAL main.js through the real run path (stubbed query.php) on
# the digitcol suite's fixture (2021, 2022, V_ID, V_NAME, V_STATUS; 60 rows):
#   gA  grouped by V_STATUS, sorted by clicks (2021 twice: descending; Shift+click V_NAME),
#       the link built through the real builder
#   gB  gA's link opened on the report (flat, no sort of its own): the 2021 level as the
#       number, marked, the rows in order, the next click; the view captured again
#       (B-rtView: the same view as gA's, compared here)
#   gC  the validator alone on tokens made here: numbers kept as numbers, text as before,
#       everything else refused; a pivot view's level too
#   P-* premises (data() really hands back the number); A-/B-/C-* checks; E-* page errors
#
#   py -3 run.py --stage DIR            DIR\js\main.js or DIR\main.js (no fallback to live)
#   py -3 run.py                        the LIVE js\main.js
#   py -3 run.py --control              the build without the fix: EXACTLY the NEW checks red.
#                                       The fix is LIVE since 0a37b30: the control reads 0a37b30^
#                                       from git (--rev REV for another build; refused if it has the fix).
#   py -3 run.py --stage DIR --mutants  every mutant, each turning EXACTLY its checks red
#   py -3 run.py --mutant NAME          one; --scn a,b a subset; --keep keeps the staging dir
#
# Headless Edge over CDP; stages into %TEMP%\pnb_vd_*; writes nothing to the webroot.
# One headless suite at a time on this workstation.
# =============================================================================
import base64, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request, zlib
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
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
ALL_SCN = ['gA', 'gB', 'gC']
# the fix, as the candidate must (and the control must not) have it
MARKER = "var scId = function (x) { return typeof x === 'number' ? (isFinite(x) && !!_pnbViewName(String(x))) : !!_pnbViewName(x); };"

# What the build without the fix gets wrong - and ONLY that (the rest are GUARDs: green on both).
NEW = ['A-carries', 'B-sort', 'B-marked', 'B-rows', 'B-nextClick', 'B-rtView', 'C-numbersKept', 'C-pivotKept']
CHECKS = {'gA': ['P-gA', 'A-click', 'A-built', 'A-carries', 'A-nextClick', 'E-gA'],
          'gB': ['P-gB', 'B-applied', 'B-sort', 'B-marked', 'B-rows', 'B-nextClick', 'B-rtView', 'E-gB'],
          'gC': ['C-decoded', 'C-numbersKept', 'C-textKept', 'C-refusedText', 'C-refusedShape', 'C-pivotKept', 'E-gC']}

# --- the validator's own tokens (zlib = pako.inflate's default format), base64url ----------------
def tok_text(txt): return base64.urlsafe_b64encode(zlib.compress(txt.encode('utf-8'), 9)).decode().rstrip('=')
# each level's colIndex is its place in this list (driver.js reads what came through by it)
SC_MIX = [2021, '2022', 0, -1.5, 'V_NAME',                              # 0-4 kept: numbers as numbers, text as text
          '<img src=x onerror=window.__pwn=1>', 'A' * 201, '',          # 5-7 refused: tag-shaped, oversized, empty
          [2021], True, None, {'a': 1}, '__NONE__', '__INF__']          # 8-13 refused: array, true, null, object, none, Infinity
LEVELS = []
for _i, _x in enumerate(SC_MIX):
    _lv = {'direction': 'desc' if _i in (0, 3) else 'asc', 'colIndex': _i}
    if _x != '__NONE__': _lv['colIdentifier'] = _x
    LEVELS.append(_lv)
T_MIX = tok_text(json.dumps({'v': 1, 'm': 'group', 'g': {'by': 'V_STATUS'}, 'sc': LEVELS}).replace('"__INF__"', '1e999'))
T_PIV = tok_text(json.dumps({'v': 1, 'm': 'pivot', 'p': {'v': 2, 'rows': ['V_STATUS'], 'cols': ['2022'], 'vals': '2021', 'agg': ['sum']},
                             'sc': [{'colIdentifier': 2021, 'direction': 'desc'}, {'colIdentifier': 'Closed', 'direction': 'asc'}]}))

# --- mutants: the fix undone one way at a time (on the FIXED build) -> EXACTLY these checks red ---
SCID = MARKER
MUTANTS = {
    # numbers refused again (the build before the fix): the link drops the level, both ways
    'numdrop': ([(SCID, "var scId = function (x) { return !!_pnbViewName(x); };")],
                NEW, ['gA', 'gB', 'gC']),
    # the level kept as TEXT (String() before validating): no longer what a click keeps - the next click starts over,
    # and String() turns any value into a name (an array, true, null, an object, a missing one: "undefined")
    'strfix': ([("&& scId(x.colIdentifier) &&", "&& !!_pnbViewName(String(x.colIdentifier)) &&"),
                ("var o = { colIdentifier: x.colIdentifier, direction: x.direction }; if (x.colIndex !== undefined) o.colIndex = x.colIndex; return o; });\r\n            if (scl.length) v.sc = scl;",
                 "var o = { colIdentifier: String(x.colIdentifier), direction: x.direction }; if (x.colIndex !== undefined) o.colIndex = x.colIndex; return o; });\r\n            if (scl.length) v.sc = scl;")],
               ['A-carries', 'B-sort', 'B-nextClick', 'B-rtView', 'C-numbersKept', 'C-pivotKept', 'C-refusedText', 'C-refusedShape'], ['gA', 'gB', 'gC']),
    # "anything not text is a number": the global isFinite() coerces, so an array, true and null pass
    'anyshape': ([(SCID, SCID.replace("typeof x === 'number' ?", "typeof x !== 'string' ?"))], ['C-refusedShape'], ['gC']),
    # text unchecked: oversized and empty names pass (tag-shaped text is refused before, by _pnbViewData)
    'nolen': ([(SCID, SCID.replace(": !!_pnbViewName(x); };", ": typeof x === 'string'; };"))], ['C-refusedText'], ['gC']),
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
# the fix is LIVE since 0a37b30 (2026-10-25): the control is the build before it, read from git (--rev REV for another)
if control and not rev: rev = '0a37b30^'

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
    """The ready closure becomes an IIFE with an export hook (the page's sortCriteria), and
    hideLoading counts its calls (the end of a run / search / apply)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__JG = { sortCrit: function () { try { return eval("sortCriteria"); } catch (e) { return null; } } }; } catch (e) { window.__JG_ERR = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__VD_HIDES = (window.__VD_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build): %s" % (name, n, old[:100]))
        src = src.replace(old, new)
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_vd_')
os.makedirs(os.path.join(stage, 'c'))
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, 'c', f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'c', 'main.css'))
shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, 'c', 'harness.html'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'c', 'driver.js'))

def write_build(main_text):
    open(os.path.join(stage, 'c', 'main_vd.js'), 'wb').write(main_text.encode('utf-8', 'surrogateescape'))

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
                r = call('Runtime.evaluate', {'expression': 'window.__VDDONE ? JSON.stringify(window.__VDRESULT) : null', 'returnByValue': True})
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

def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def run_suite(main_text, scns):
    write_build(hook(main_text))
    res, obs = [], {}
    for s in scns:
        q = 'scn=%s&id=vdfix' % s
        if s == 'gB':
            tok = (obs.get('gA') or {}).get('token')
            if not tok:
                res.append(('F-gB', False, 'no link from gA (run gA first; it built none)')); continue
            q += '&view=' + tok
        if s == 'gC': q += '&t1=' + quote(T_MIX, safe='') + '&t2=' + quote(T_PIV, safe='')
        r = run_page(q)
        if r.get('fatal'):
            res.append(('F-' + s, False, 'fatal: ' + str(r['fatal'])[:500])); continue
        if r.get('hookErr'):
            res.append(('H-' + s, False, 'hook: %s' % r.get('hookErr')))
        o = r.get('obs', {}); obs[s] = o
        got = {a['id']: (a['ok'], a['detail']) for a in r.get('asserts', [])}
        if s == 'gB':
            # gA's link carries the 2021 level as the NUMBER (int here, not '2021'), and gB captures the same view again
            av, bv = (obs.get('gA') or {}).get('view') or {}, o.get('view') or {}
            sc0 = (av.get('sc') or [{}])[0]
            num21 = type(sc0.get('colIdentifier')) is int and sc0.get('colIdentifier') == 2021
            diff = {k: [av.get(k), bv.get(k)] for k in sorted(set(av) | set(bv)) if not same(av.get(k), bv.get(k))}
            got['B-rtView'] = (num21 and same(av, bv), 'gA sort %s (2021 a number: %s); differs: %s' % (json.dumps(av.get('sc')), num21, json.dumps(diff)[:500]))
        got['E-' + s] = (not r.get('errors'), 'page errors: %s' % (r.get('errors') or 'none'))
        for cid in CHECKS[s]:
            ok, detail = got.pop(cid, (False, 'never published'))
            res.append((cid, ok, detail))
        for cid, (ok, detail) in got.items():
            res.append((cid, ok, '(unlisted) ' + detail))
    return res, obs

try:
    scns = scn_arg.split(',') if scn_arg else ALL_SCN
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the build without the fix)' if control else ''), flush=True)
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            edits, must, ms = MUTANTS[name]
            res, _ = run_suite(mutate(main_src, name), ms)
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
            print('  %s  %-16s %s' % ('PASS' if ok else 'FAIL', aid, detail[:500]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        for s in scns:
            o = obs.get(s) or {}
            keep_keys = [k for k in ('sortAtOpen', 'afterClick', 'decoded', 'pivot', 'build', 'bootErrors') if k in o]
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
