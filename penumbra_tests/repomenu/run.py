# =============================================================================
# REPOMENU SUITE (2026-11-03, menufix) - the Repository list's right-click menus
# (js/penumbra_repository.js repoMenu, drawn by js/penumbra_colmenu.js Penumbra.colMenu.openItems).
#
# The user: "do the fix all" of the right-click menu map - a list heading opened the List options popover (no sort),
# a report row the browser's menu. Now a heading: Sort ascending / descending / Clear sort and List options...; a row:
# Open, Open in a new tab, Copy link, Copy report ID, Add to / Remove from favorites (Metrics for a global admin).
#
#   BROWSER   harness.html + driver.js: the REAL penumbra_repository.js (repo_cand.js) and penumbra_colmenu.js
#             (menu_cand.js) open the Repository lightbox against a stubbed get_server_reports.php (driver.js mocks
#             $.ajax, as repoorder's does). H-* a heading, R-* a row, E-errors no page errors.
#
#   py -3 run.py [--app DIR]          candidate = DIR\js\penumbra_repository.js + DIR\js\penumbra_colmenu.js (else live)
#   py -3 run.py --control            LIVE's pair: exactly CONTROL_RED red - proven 2026-11-03 before the deploy (5b124ce);
#                                     live has the menus since, so a control now reads all green (expected)
#   py -3 run.py --mutants | --mutant NAME   single-point edits (MUTANTS): each must turn its own asserts red
#
# Headless Edge over CDP; stages into %TEMP%\pnb_rmenu_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js']
EXPECT = ['P-loaded', 'H-head', 'H-sortAsc', 'H-tick', 'H-sortDesc', 'H-clear', 'H-cols', 'H-noSort',
          'R-row', 'R-title', 'R-tab', 'R-link', 'R-id', 'R-fav', 'R-admin', 'R-deleted', 'R-shift', 'R-kbd',
          'P-pane', 'P-tools', 'P-snapGate', 'C-columns', 'M-manage',
          'L-pane', 'L-gap', 'T-tag', 'B-sel', 'B-bar', 'B-off', 'N-noClear', 'R-off', 'E-errors']   # (menufix2: P-, C-, M-; menufix4: L-, T-, B-, N-)
# live: no list menus - a heading's right-click opens List options (H-cols passes: it is that popover), a row keeps the
# browser's menu (R-shift / R-off describe that), no errors
# (menufix2) --control is LIVE: menufix's build (5b124ce), red on what this round changed or added
CONTROL_RED_MF2 = ['H-head', 'H-cols', 'H-noSort', 'R-row', 'R-admin', 'R-deleted', 'P-pane', 'P-tools', 'P-snapGate', 'C-columns', 'M-manage']
# (menufix4) --control is LIVE: menufix2's build plus menufix3's (c53d600) - red on this round's
CONTROL_RED_MF4 = ['L-pane', 'L-gap', 'T-tag', 'B-sel', 'B-bar', 'B-off', 'N-noClear', 'H-head', 'H-noSort', 'M-manage', 'R-deleted', 'R-row']   # (the last five: live's menus end with Clear all)
CONTROL_RED_MF = ['H-head', 'H-sortAsc', 'H-tick', 'H-sortDesc', 'H-clear', 'H-noSort', 'R-row', 'R-title', 'R-tab', 'R-link', 'R-id', 'R-fav', 'R-admin', 'R-deleted', 'R-kbd']
# Each mutant: (file key, exact old, new) and the asserts that must go red
MUTANTS = {
    'rm-norow': ([('repo', "            if (repoMenu(this, e, false)) { e.preventDefault(); }", "")], ['R-row', 'R-title', 'R-tab', 'R-link', 'R-id', 'R-fav', 'R-admin', 'R-deleted', 'R-kbd']),
    'rm-nohead': ([('repo', "            if (repoMenu(this, e, true)) { return; }   // (2026-11-03, menufix)", "            // (2026-11-03, menufix)")], ['H-head', 'H-sortAsc', 'H-tick', 'H-sortDesc', 'H-clear', 'H-noSort']),
    'rm-sortdir': ([('repo', "label: 'Sort ascending', checked: now === 'asc', run: to('asc') });", "label: 'Sort ascending', checked: now === 'asc', run: to('desc') });")], ['H-sortAsc', 'H-tick']),
    'rm-tick': ([('repo', "label: 'Sort ascending', checked: now === 'asc',", "label: 'Sort ascending', checked: false,")], ['H-tick']),
    'rm-noclear': ([('repo', "                if (now) { items.push({ act: 'repoSortClear'", "                if (false) { items.push({ act: 'repoSortClear'")], ['H-clear']),
    'rm-nosortkind': ([('repo', "            if (key && kind && kind !== 'none' && !el.classList.contains('no-sort')) {", "            if (key) {")], ['H-noSort']),
    'rm-link': ([('repo', "run: function () { repoCopy(abs, 'Link copied.'); } });", "run: function () { repoCopy(url, 'Link copied.'); } });")], ['R-link']),
    'rm-tab': ([('repo', "run: function () { window.open(url + noadm, '_blank'); } });", "run: function () { window.open(url + noadm, '_self'); } });")], ['R-tab']),
    'rm-fav': ([('repo', "run: function () { $(star).trigger('click'); } });", "run: function () { } });")], ['R-fav']),
    'rm-admin': ([('repo', "        if (V.isGlobalAdmin) {\n            out.push({ act: 'repoOwner'", "        if (true) {\n            out.push({ act: 'repoOwner'")], ['R-admin']),   # (menufix2: the admin's tools)
    'rm-deleted': ([('repo', "            if (!deleted) {\n                items.push({ act: 'repoOpen'", "            if (true) {\n                items.push({ act: 'repoOpen'")], ['R-deleted']),
    'rm-shift': ([('repo', "            if (e.shiftKey && e.button === 2) { return; }   // the browser's own menu, as every other menu leaves it", "")], ['R-shift']),
    'rm-kbd': ([('repo', "        if (kbd) { var r = el.getBoundingClientRect(); x = r.left + 6; y = where === 'pane' ? r.top + 6 : r.bottom; }", "")], ['R-kbd']),
    # (menufix2) no panel menu; no tools; the snapshots offered with none; a column pick that changes nothing; Manage mode for all
    'mf2-pane': ([('repo', "            if (repoMenu(this, e, 'pane')) { e.preventDefault(); }", "")], ['P-pane', 'P-tools']),
    'mf2-tools': ([('repo', "                var tools = repoToolItems(report, $tr);", "                var tools = [];")], ['R-row', 'P-tools']),
    'mf2-snaps': ([('repo', "        if ((parseInt(report.SNAPSHOT_COUNT, 10) || 0) > 0) {", "        if (true) {")], ['R-row', 'P-snapGate']),
    'mf2-col': ([('repo', "                    p2.visible[k] = !on;", "                    p2.visible[k] = on;")], ['C-columns']),
    'mf2-manage': ([('repo', "        if (V.isGlobalAdmin) {\n            out.push({ act: 'repoManage'", "        if (true) {\n            out.push({ act: 'repoManage'")], ['R-admin', 'R-row']),
    # (menufix4) the panel always the report's; no bar menu; no pill menu; no row selection; Clear all back
    'mf4-list': ([('repo', "        if (where === 'pane' && !(_srDetailReport && _srDetailReport.SHORT_ID)) { where = 'list'; }   // (menufix4) no report shown yet", "")], ['L-pane']),
    'mf4-gap': ([('repo', "            if (repoMenu(this, e, 'list')) { e.preventDefault(); }", "")], ['L-gap']),
    'mf4-bar': ([('repo', "            if (repoMenu(this, e, 'bulk')) { e.preventDefault(); e.stopPropagation(); }", "")], ['B-bar', 'B-off']),
    'mf4-tag': ([('repo', "            if (repoMenu(this, e, 'tag')) { e.preventDefault(); e.stopPropagation(); }", "")], ['T-tag']),
    'mf4-sel': ([('repo', "            if (box && manageOn()) {", "            if (false) {")], ['B-sel']),
    'mf4-clear': ([('menu', "        if (!c && cur && !cur.bd && !cur.cmp && !cur.noClear) { c = clearItem(); }", "        if (!c && cur && !cur.bd && !cur.cmp) { c = clearItem(); }")], ['N-noClear']),
    'rm-fallback': ([('repo', "        if (!CM || typeof CM.openItems !== 'function') { return false; }", "        if (false) { return false; }")], ['R-off']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
app_dir = opt('--app', APP)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if control: app_dir = APP
def pick(rel):
    p = os.path.join(app_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
PATHS = {'repo': pick(os.path.join('js', 'penumbra_repository.js')), 'menu': pick(os.path.join('js', 'penumbra_colmenu.js')),
         'mcss': pick(os.path.join('css', 'penumbra_colmenu.css'))}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
TEXTS = {k: read_b(v) for k, v in PATHS.items()}

def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_rmenu_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('driver.js', 'harness.html'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))

_edge = {}
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (_edge['dp'], p), method=m), timeout=15).read().decode())
def start_browser():
    if _edge: return
    hp, dp = free_port(), free_port()
    _edge.update(hp=hp, dp=dp)
    _edge['srv'] = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _edge['proc'] = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                                      '--disable-sync', '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'),
                                      '--window-size=1500,900', '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(150):
        try: jget('/json/version'); return
        except Exception: time.sleep(0.2)

POLL = '(function () { return JSON.stringify({ done: !!window.__RMDONE, res: window.__RMDONE ? window.__RMRESULT : null }); })()'
def run_browser(texts):
    start_browser()
    for k, name in (('repo', 'repo_cand.js'), ('menu', 'menu_cand.js'), ('mcss', 'menu_cand.css')):
        open(os.path.join(stage, name), 'wb').write(texts[k].encode('utf-8', 'surrogateescape'))
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})   # every build is written to the same files
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html' % _edge['hp']})
        t0 = time.time()
        while time.time() - t0 < 90:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': POLL, 'returnByValue': True}).get('result', {}).get('value')
            if not v: continue
            st = json.loads(v)
            if st['done']: return st['res']['asserts']
        return [{'id': 'E-errors', 'ok': False, 'detail': 'timeout (90 s)'}]
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (_edge['dp'], t['id']), timeout=10).read()
        except Exception: pass

def evaluate(got):
    by = {}
    for a in got: by.setdefault(a['id'], a)
    out = [(aid, bool(by.get(aid) and by[aid]['ok']), by[aid]['detail'] if aid in by else 'NOT RECORDED') for aid in EXPECT]
    out += [(aid, False, 'UNEXPECTED ID ' + a['detail']) for aid, a in by.items() if aid not in EXPECT]
    return out

try:
    print('candidate: %s\n           %s%s' % (PATHS['repo'], PATHS['menu'], '   (CONTROL: live)' if control else ''))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS)
        bad = []
        for m in names:
            res = evaluate(run_browser(mutate(TEXTS, m)))
            red = sorted(a for a, ok, _ in res if not ok)
            must = sorted(MUTANTS[m][1])
            ok = all(x in red for x in must)
            print('MUTANT %-14s %s  red: %s' % (m, 'KILLED' if ok else 'SURVIVED', ' '.join(red)))
            if not ok: bad.append(m)
        print('RESULT: GREEN' if not bad else 'RESULT: RED (survived: %s)' % ' '.join(bad))
    else:
        res = evaluate(run_browser(TEXTS))
        p = f = 0; failed = []
        for aid, ok, d in res:
            print('  %s  %-12s %s' % ('PASS' if ok else 'FAIL', aid, str(d)[:300]))
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            good = sorted(failed) == sorted(CONTROL_RED_MF4)
            print('CONTROL: %s' % ('as expected (%d red)' % len(failed) if good else 'NOT as expected: red %s' % ' '.join(sorted(failed))))
            print('RESULT: GREEN' if good else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 else 'RESULT: RED')
finally:
    try: _edge['proc'].kill()
    except Exception: pass
    try: _edge['srv'].kill()
    except Exception: pass
    shutil.rmtree(stage, ignore_errors=True)
