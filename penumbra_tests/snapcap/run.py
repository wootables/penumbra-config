# =============================================================================
# SNAPCAP SUITE (2026-10-23) - a capture of the page made during a snapshot VIEW writes the REPORT's column layout.
#
# A snapshot view draws the frozen rows under a fresh #tableHeader: the snapshot's columns, all shown, in its captured
# order, numbered its own way (rebuildTableFromMasterData). buildStateObject reads visibleColumns / columnOrder off
# that header, and the view link's captureColumnLayoutByName() takes the snapshot's by name, so a Save, a ?state= link
# and a link to the view made during a Load As View (no ?snap= in the URL: Save and the view link stay available)
# reopened the report with the snapshot's layout - its hidden columns shown, in another order. The report's own
# layout is in the view's stash (originalDataBeforeSnapshot.columnLayout, by name). The ways back to live data gave
# it back only in the flat case.
#
#   phase 1 (?id=snapcap): ?mode=ov (Load As View over the flat report: captures, back to live data, a snapshot
#   without NOTE, Run from a view), ovg (the report grouped), ovp (its pivot), ovlive (a live action from a view),
#   ovcol (a column hidden during a view), lz (a ?snap=56 tab: its query never ran)
#   phase 2 (?mode=saved / state / view): each capture opened in a fresh page - the Save's state preloaded as a saved
#   report is, the ?state= link, the view link over the report as saved - and the column layout it comes back in.
#   The harness is snapsort's (a copy) plus savecmp's Server Save dialog fields.
#
#   py -3 run.py [--stage DIR]       the candidate's js\main.js from DIR, else live
#   py -3 run.py --control           live js\main.js: red on the checks of each fix it does not hold (NEW_SETS), the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate main.js (must turn their asserts red)
#   --pages ov,lz,R-ov-saved         only these pages (a phase 2 page runs its phase 1 page first)
#   --main FILE                      this main.js (a file, not a folder)
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot. One Edge suite at a time.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_tiles.js', 'penumbra_colwidths.js', 'penumbra_presets.js']
CSS = ['main.css', 'penumbra_colmenu.css', 'penumbra_colwidths.css', 'penumbra_presets.css']
# Each fix's checks, red on a main.js without it (the rest are what the page always did, green everywhere).
NEW_SETS = [
    ('snapcap', 'function _pnbSnapStateLayout(',
     ['C1', 'C2', 'C3', 'C4', 'C6', 'C7', 'G1', 'G2', 'G3', 'P1', 'P2', 'L1', 'L2', 'K1', 'Z1', 'Z2',
      'R-ov-saved', 'R-ov-state', 'R-ov-view', 'R-lz-state']),
]
PHASE1 = {
    'ov': 'harness.html?mode=ov&id=snapcap',
    'ovg': 'harness.html?mode=ovg&id=snapcap',
    'ovp': 'harness.html?mode=ovp&id=snapcap',
    'ovlive': 'harness.html?mode=ovlive&id=snapcap',
    'ovcol': 'harness.html?mode=ovcol&id=snapcap',
    'lz': 'harness.html?mode=lz&id=snapcap&snap=56',
}
# phase 2: (page id, the phase 1 page whose capture it opens, the capture)
PHASE2 = [('R-ov-saved', 'ov', 'saved'), ('R-ov-state', 'ov', 'state'), ('R-ov-view', 'ov', 'view'), ('R-lz-state', 'lz', 'state')]
ALL_PAGES = list(PHASE1.keys()) + [p for p, _, _ in PHASE2]

# --- mutants: name -> (edits on the candidate main.js, assert ids that MUST go red, pages to run) ------------------
MUTANTS = {}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
main_file = opt('--main', None)
one_mutant = opt('--mutant', None)
only = opt('--pages', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def pick(rel):
    if stage_dir and not control and os.path.exists(os.path.join(stage_dir, rel)): return os.path.join(stage_dir, rel)
    return os.path.join(APP, rel)
main_path = main_file if (main_file and not control) else pick(os.path.join('js', 'main.js'))
menu_path = pick(os.path.join('js', 'penumbra_colmenu.js'))


def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, plus reads of the page's sort, the stored
    layout, the view's stash and the snapshot flag; hideLoading counts its calls (a render's end)."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { compress: "compressString", decompress: "decompressString", loadSnap: "loadSnapshotData", restore: "restoreOriginalData",'
         ' exitLive: "_exitSnapshotForLiveAction", exitHome: "_exitSnapshotToHome", uhi: "updateHeaderIcons", bso: "buildStateObject",'
         ' bvu: "buildViewStateURL", ser: "_penumbraSerializeSortForUrl", clearAll: "performClearAllAction" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n'
         'window.__CF.sc = function () { return JSON.parse(JSON.stringify(sortCriteria)); };\r\n'
         'window.__CF.viewing = function () { return isViewingSnapshot; };\r\n'
         'window.__CF.stored = function () { return _pnbStoredLayout === null ? null : JSON.parse(JSON.stringify(_pnbStoredLayout)); };\r\n'
         'window.__CF.stash = function () { if (!originalDataBeforeSnapshot) return null; var s = originalDataBeforeSnapshot, o = {}; Object.keys(s).forEach(function (k) { if (k !== "masterRowData" && k !== "groupedHTML" && k !== "pivotHTML") o[k] = s[k]; }); return JSON.parse(JSON.stringify(o)); };\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        olds = old if isinstance(old, tuple) else (old,)
        done = False
        for alt in olds:
            for o, n in ((alt, new), (alt.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
                if src.count(o) == 1: src = src.replace(o, n); done = True; break
            if done: break
        if not done:
            raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(olds[0]), olds[0][:90]))
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_snapcap_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
shutil.copyfile(menu_path, os.path.join(stage, 'penumbra_colmenu.js'))
idx = read_b(os.path.join(APP, 'index.php'))
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.replace('<!--SNAP_TEMPLATE-->', m.group(0)).encode('utf-8', 'surrogateescape'))

def write_main(text):
    open(os.path.join(stage, 'main_cf.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                         '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
for _ in range(100):
    try: urllib.request.urlopen('http://127.0.0.1:%d/harness.html' % hp, timeout=5).read(); break
    except Exception: time.sleep(0.2)

def run_page(path):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(method, params=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid: return msg.get('result', {})
    try:
        call('Page.enable')
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__CFDONE ? JSON.stringify(window.__CFRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the page (240 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def collect(res, tag):
    out = []
    if res.get('fatal'): out.append(('X-' + tag, False, '[%s] fatal: %s' % (tag, str(res['fatal'])[:600])))
    if res.get('hookErr'): out.append(('X-' + tag + '-hook', False, '[%s] hook: %s' % (tag, res['hookErr'])))
    for r in res.get('results', []):
        out.append((r['name'].split(' ')[0], bool(r['pass']), r['name'] + '  [' + r.get('detail', '') + ']'))
    if res.get('pageErrors'): print('  [%s] page errors: %s' % (tag, ' | '.join(res['pageErrors'])[:600]), flush=True)
    if res.get('info'): print('  [%s] info: %s' % (tag, json.dumps(res['info'])[:1500]), flush=True)
    return out

def phase2_path(mode, exp, art):
    if mode == 'saved':
        if not art.get('save'): return None
        return 'harness.html?mode=saved&exp=%s&id=snapcap#pre=%s' % (exp, urllib.parse.quote(art['save'], safe=''))
    if mode == 'state':
        u = art.get('state')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=state&exp=%s' % exp
    if mode == 'view':
        u = art.get('view')
        if not u or '?' not in u: return None
        return 'harness.html?' + u.split('?', 1)[1] + '&mode=view&exp=%s' % exp
    return None

def run(main_text, pages):
    write_main(main_text)
    want = set(pages)
    for pid, src1, _ in PHASE2:
        if pid in want: want.add(src1)
    out, arts = [], {}
    for key in PHASE1:
        if key not in want: continue
        res = run_page(PHASE1[key])
        out += collect(res, key)
        arts[key] = res.get('artifacts') or {}
    for pid, src1, mode in PHASE2:
        if pid not in want: continue
        path = phase2_path(mode, src1, arts.get(src1) or {})
        if not path:
            out.append((pid, False, '%s: phase 1 handed over nothing to open' % pid)); continue
        out += collect(run_page(path), pid)
    return out

try:
    src = read_b(main_path)
    print('main.js: %s%s' % (main_path, '   (CONTROL)' if control else ''))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            edits, must, pages = MUTANTS[name]
            res = run(mutate(src, name), pages)
            red = [a for a, ok, _ in res if not ok]
            missing = [a for a in must if a not in red]
            good = not missing and not [a for a in red if a.startswith('X')]
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-14s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run(src, only.split(',') if only else ALL_PAGES)
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:1200]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            NEW = []
            for name, marker, ids in NEW_SETS:
                held = marker in src
                print('CONTROL: %s is %s in this main.js%s' % (name, 'IN' if held else 'NOT', '' if held else ' (its checks must be red)'))
                if not held: NEW += ids
            seen = [a for a, _, _ in res]
            new_green = [a for a in NEW if a in seen and a not in failed]
            new_unseen = [a for a in NEW if a not in seen]
            old_red = [a for a in failed if a not in NEW]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            skip = []
            for name, marker, ids in NEW_SETS:
                if marker not in src:
                    skip += ids
                    print('NOTE: %s is not in this main.js: its checks (%s) show the page as it was before it - not counted' % (name, ' '.join(ids)))
            counted = [a for a in failed if a not in skip]
            print('RESULT: GREEN' if not counted and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    if keep: print('kept: ' + stage)
    else: shutil.rmtree(stage, ignore_errors=True)
