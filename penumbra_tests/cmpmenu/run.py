# =============================================================================
# CMPMENU SUITE (2026-10-22) - a snapshot comparison's own right-click menu.
#
# The user: "Snapshot comparisons do not seem to have a right click menu for cells /
# columns - there can be custom functions here too like clear comparison, and show
# before & after (if applicable), edit match criteria". js/penumbra_colmenu.js now
# opens the comparison's own menu on a heading, a cell or a group's band of
# #snapshotComparisonContainer: Copy this value (a changed cell's earlier value too),
# Copy column name, Show before & after (where the control bar shows its toggle),
# Edit match criteria... (the banner's pencil) and Clear snapshot comparison (the
# control bar's Clear).
#
# (cmp38, round 2, same day) the user: "the other functions can also work there, fit to width related
# functions (doesnt have to save for snapshots if it already doesnt), consistent row height, filtering,
# others that would be applicable". A heading or cell also sorts (every group's table), opens Column
# widths (the grouped view's widths, kept as a drag keeps them) and switches Consistent row height; a cell
# filters to / excludes its value (the comparison runs again over the matching rows); a band expands,
# shows only (the comparison's own __SNAP_TYPE = '...' condition) or hides its group. The harness loads
# the filter strip engine (penumbra_tiles.js) and the column widths module, as index.php does.
#
#   browser half only: the cmpfoot harness (the REAL js\main.js, ready closure
#   unwrapped, window.__CF export hook) renders a REAL comparison of a 6-row report
#   against a 6-row snapshot (keys: ID; New / Removed / Modified / Unchanged, 2 rows
#   each), plus the control bar's Clear link and Before & After toggle, a Snapshots
#   button, the menu module and its stylesheet. driver.js right-clicks like a user.
#
#   py -3 run.py [--stage DIR]       the candidate's js\penumbra_colmenu.js (else live)
#   py -3 run.py --control           live js\penumbra_colmenu.js: NEW red, the rest green
#   py -3 run.py --mutant NAME | --mutants     edits on the candidate (must turn their asserts red)
#
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_tiles.js', 'penumbra_colwidths.js']   # (cmp38) the filter strip engine, the column widths module
# the checks the first round added (red on a build with no comparison menu); C0 (the comparison renders) holds anyway
# NEW = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12']
# (cmp38, the first round is live: C3 C4 C7 C9 C10 C11 C12 are old checks now) the menus' new lists, and the new tools
# NEW = ['C1', 'C2', 'C5', 'C6', 'C8', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30']
# (fit39, round 2 is live 2d6c232: its checks are old ones now) Fit to page with only the right-clicked group open -
# a fix in js/penumbra_colwidths.js: --stage DIR takes DIR\js\penumbra_colwidths.js too when it is there
# NEW = ['C31']   (b33aad7 is live: C31 is an old check now)
# (2026-10-23, lnk40) the banner's Copy link in every comparison menu (the exact lists), the two link items, and Fit to
# page's scrollbar buffer (js/penumbra_colwidths.js, through --stage)
# NEW = ['C1', 'C2', 'C5', 'C6', 'C8', 'C23', 'C32']   (lnk40 is live 425d199: old checks now)
# (2026-10-24, dictstat) What this column means in the comparison menu
NEW = ['C34']
# (C33, the scrollbar buffer in a comparison, went to colwidths F15-F17: a comparison's tables give way here)

# --- mutants: name -> (edits on the candidate colmenu.js, assert ids that MUST go red) ---------------
MUTANTS = {
    # --- (2026-10-24, dictstat) What this column means: none in a comparison; after the column's name rather than the sorts
    'd-nocmpabout': ([("            if (ent) { sorts.push(aboutItem(ent)); }", "            if (false) { sorts.push(aboutItem(ent)); }")], ['C34']),
    'd-cmpaboutlast': ([("            if (ent) { sorts.push(aboutItem(ent)); }", "            if (ent) { name.push(aboutItem(ent)); }")], ['C34']),
    # --- (2026-10-23, lnk40) the banner's links: none; offered whether the banner shows them or not; the evergreen item
    # running the plain link
    'k-nolink': ([("        if (lk) { items.push({ act: 'cmpCopyLink'", "        if (false) { items.push({ act: 'cmpCopyLink'")], ['C1', 'C32']),
    'k-linkshown': ([("        return (b && b.style.display !== 'none') ? b : null;\n    }\n    function cmpEditMatch() {", "        return b;\n    }\n    function cmpEditMatch() {")], ['C1', 'C32']),
    'k-everlink': ([("run: function () { ev.click(); } }); }", "run: function () { lk.click(); } }); }")], ['C32']),
    # no comparison menu at all (the dispatcher's branch gone)
    'k-nocmp': ([("        var ct = cmpTarget(e.target);\n", "        var ct = null;\n")], ['C1', 'C2', 'C5']),
    # a changed cell never offers its earlier value
    'k-nowas': ([("                    if (changed) {\n                        var was = cmpWas(td);", "                    if (false) {\n                        var was = cmpWas(td);")], ['C2', 'C4']),
    # the earlier value read from the current one
    'k-wasnow': ([("    function cmpWas(td) { var w = td.querySelector('.snap-ba-was-val');", "    function cmpWas(td) { var w = td.querySelector('.snap-ba-now-val');")], ['C4']),
    # Show before & after offered with no toggle on the page
    'k-baalways': ([("        if (ba && ba.style.display !== 'none') {", "        if (ba) {")], ['C8']),
    # Clear does nothing
    'k-noclear': ([("        if (b) { b.click(); }\n    }\n    // A comparison cell's value", "        if (b) { }\n    }\n    // A comparison cell's value")], ['C11']),
    # --- (cmp38) round 2
    # no sort on a comparison heading
    'k-nosort': ([("            if (A && typeof A.sort === 'function') {\n                // the sort in force HERE", "            if (false) {\n                // the sort in force HERE")], ['C1', 'C13', 'C14']),
    # no Column widths
    'k-nowidth': ([("            if (SW && typeof SW.canFit === 'function' && SW.canFit(th)) {", "            if (false) {")], ['C1', 'C15', 'C16', 'C23']),
    # no row height switch
    'k-norowh': ([("            if (rh) { size.push(rh); }", "            if (false) { size.push(rh); }")], ['C1', 'C17']),
    # a cell's value never offered to the filter box
    'k-nofilter': ([("                if (!isNum && !isJournal(col) && !changed && fs && flatTh(col) && !td.classList.contains('cell-contains-nested-table')) {", "                if (false) {")], ['C6', 'C18', 'C19', 'C24']),
    # (the review) a changed cell offered Filter to / Exclude (a compare-to-live filter would split its pair)
    'k-filterchanged': ([("!isJournal(col) && !changed && fs && flatTh(col)", "!isJournal(col) && fs && flatTh(col)")], ['C2']),
    # (the review) value filters in a column the report's own table lacks by that name
    'k-anycol': ([("&& !changed && fs && flatTh(col) &&", "&& !changed && fs &&")], ['C28']),
    # (the review) the page's sort ticked (and Then sort offered) while the comparison's rows are unsorted
    'k-staletick': ([("                var inForce = !!cbox && cbox === cmpSortBox;", "                var inForce = true;")], ['C1', 'C29', 'C30']),
    # (the second review) the sort read from the headings' marks, which a repaint from elsewhere sets from the page's sort
    'k-marksignal': ([("                var inForce = !!cbox && cbox === cmpSortBox;", "                var inForce = !!(cbox && cbox.querySelector('thead th.sorted'));")], ['C30']),
    # the menu's own sort never remembered: no tick, no Then sort after it
    'k-nosortbox': ([("        cmpSortBox = document.getElementById('snapshotComparisonContainer');", "        cmpSortBox = null;")], ['C13', 'C14']),
    # (the review) named entities left encoded in a formatted cell's raw value
    'k-noentity': ([("                return CMP_ENT[nm] || m;", "                return m;")], ['C24']),
    # (the second review) the cell's text decoded a second time
    'k-textdecode': ([("        if (raw) {\n            v = v.replace(", "        if (true) {\n            v = v.replace(")], ['C24']),
    # a changed cell filters by its whole text (both values) rather than its current one
    # a cell's value read without the search's reading (tags and the @@HTML marker kept)
    'k-cellvalue': ([("        if (v.indexOf('@@HTML') === 0) { v = v.substring(6); }\n        return v.replace(/<[^>]*>/g, '').trim();", "        return v.trim();")], ['C24']),
    # Show only through the filter box's own /^(?:...)$/ form (the live side has no __SNAP_TYPE column)
    'k-onlyfs': ([("run: function () { cmpShowOnly(key); } });", "run: function () { A.filterAdd('__SNAP_TYPE', key, false); } });")], ['C20', 'C25', 'C26']),
    # Show only beside another group's condition rather than in its place
    'k-onlyadd': ([("        F.runSearch(q ? q + ' and ' + term : term);", "        q = String(box.value || '').trim();\n        F.runSearch(q ? q + ' and ' + term : term);")], ['C25']),
    # Show only adds itself to an "or" query
    'k-noor': ([("        if (q && typeof F.searchHasOr === 'function' && F.searchHasOr(q)) {", "        if (false) {")], ['C27']),
    # no Expand / Collapse on a band
    'k-notoggle': ([("            if (!listOn()) {\n                items.push({ act: 'cmpGroupToggle'", "            if (false) {\n                items.push({ act: 'cmpGroupToggle'")], ['C5', 'C22']),
    # no Hide this group
    'k-nohide': ([("            if (x) { items.push({ act: 'cmpGroupHide'", "            if (false) { items.push({ act: 'cmpGroupHide'")], ['C5', 'C21']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
menu_path = os.path.join(APP, 'js', 'penumbra_colmenu.js')
if stage_dir and not control and os.path.exists(os.path.join(stage_dir, 'js', 'penumbra_colmenu.js')):
    menu_path = os.path.join(stage_dir, 'js', 'penumbra_colmenu.js')
main_path = os.path.join(APP, 'js', 'main.js')

def hook(src):
    """The ready closure becomes an IIFE with a name-by-name export hook, and hideLoading
    counts its calls (the end of a comparison render) - the cmpfoot suite's."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = ('\r\n;try { window.__CF = {}; } catch (e) { window.__CF_ERR = String(e); }\r\n'
         'try { var _cfF = { runCmp: "runComparisonAndDisplayGrouped", compress: "compressString" };\r\n'
         '  Object.keys(_cfF).forEach(function (k) { try { window.__CF[k] = eval(_cfF[k]); } catch (e) { (window.__CF_MISSING = window.__CF_MISSING || []).push(_cfF[k]); } }); } catch (e) { window.__CF_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__CF_HIDES = (window.__CF_HIDES || 0) + 1;\r\n')

def mutate(src, name):
    for old, new in MUTANTS[name][0]:
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if src.count(o) == 1: src = src.replace(o, n); break
        else:
            raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, src.count(old), old[:90]))
    return src

# --- staging + browser ----------------------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_cmpm_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colmenu.css'), os.path.join(stage, 'penumbra_colmenu.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colwidths.css'), os.path.join(stage, 'penumbra_colwidths.css'))
# (fit39) a stage's column widths module, when it has one (never under --control)
colw_stage = os.path.join(stage_dir, 'js', 'penumbra_colwidths.js') if stage_dir else ''
if colw_stage and not control and os.path.exists(colw_stage):
    shutil.copyfile(colw_stage, os.path.join(stage, 'penumbra_colwidths.js'))
    print('penumbra_colwidths.js: %s' % colw_stage)
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
idx = read_b(os.path.join(APP, 'index.php'))
m = re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', idx, re.S)
if not m: raise SystemExit('snapshotAnalysisTemplate not found in index.php')
page = open(os.path.join(HERE, 'harness.html'), 'rb').read().decode('utf-8')
if page.count('<!--SNAP_TEMPLATE-->') != 1: raise SystemExit('harness.html: template placeholder missing')
open(os.path.join(stage, 'harness.html'), 'wb').write(page.replace('<!--SNAP_TEMPLATE-->', m.group(0)).encode('utf-8', 'surrogateescape'))
open(os.path.join(stage, 'main_cf.js'), 'wb').write(hook(read_b(main_path)).encode('utf-8', 'surrogateescape'))

def write_menu(text):
    open(os.path.join(stage, 'penumbra_colmenu.js'), 'wb').write(text.encode('utf-8', 'surrogateescape'))

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

def run_page():
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?mode=live&t=%d' % (hp, int(time.time() * 1000))})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            try:
                r = call('Runtime.evaluate', {'expression': 'window.__CFDONE ? JSON.stringify(window.__CFRESULT) : null', 'returnByValue': True})
                v = r.get('result', {}).get('value')
                if v: return json.loads(v)
            except Exception:
                pass
        return {'fatal': 'timeout waiting for the page (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run(menu_text, tag):
    write_menu(menu_text)
    res = run_page()
    out = []
    if res.get('fatal'): out.append(('X', False, 'fatal: ' + str(res['fatal'])[:500]))
    if res.get('hookErr'): out.append(('X-hook', False, 'hook: ' + res['hookErr']))
    for r in res.get('results', []):
        out.append((r['name'].split(' ')[0], bool(r['pass']), r['name'] + '  [' + r.get('detail', '') + ']'))
    if res.get('pageErrors'): print('  [%s] page errors: %s' % (tag, ' | '.join(res['pageErrors'])[:500]), flush=True)
    return out

try:
    src = read_b(menu_path)
    print('penumbra_colmenu.js: %s%s' % (menu_path, '   (CONTROL)' if control else ''))
    if all_mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        ok_n = bad_n = 0
        for name in names:
            must = MUTANTS[name][1]
            res = run(mutate(src, name), name)
            red = [a for a, ok, _ in res if not ok]
            missing = [a for a in must if a not in red]
            good = not missing and not [a for a in red if a.startswith('X')]
            ok_n += good; bad_n += (not good)
            print('  %s  mutant %-12s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns ' + ' '.join(must) + ' red') if good else ('stayed GREEN on ' + ' '.join(missing)), ' '.join(red)), flush=True)
        print('SUMMARY mutants ok=%d bad=%d' % (ok_n, bad_n))
        print('RESULT: GREEN' if bad_n == 0 else 'RESULT: RED')
    else:
        res = run(src, 'menu')
        p = f = 0; failed = []
        for aid, ok, detail in res:
            print('  %s  %s' % ('PASS' if ok else 'FAIL', detail[:600]), flush=True)
            if ok: p += 1
            else: f += 1; failed.append(aid)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            seen = [a for a, _, _ in res]
            new_green = [a for a in NEW if a in seen and a not in failed]
            new_unseen = [a for a in NEW if a not in seen]
            old_red = [a for a in failed if a not in NEW]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
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
