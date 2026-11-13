# =============================================================================
# PICK LISTS SUITE "picklist" - BROWSER HALF (2026-11-11, PICKLIST_SPEC.md section 6)
#
# The REAL main.js and js/penumbra_fields.js through the real run path, on jrowfeat's 36-row fixture
# (stubbed query.php + manage_journal.php: harness.html is built from jrowfeat's at run time - see
# build_harness - so the fixture and the fake server stay that suite's), with a "Status" pick list.
# driver.js runs one scenario per page and records its asserts.
#
#   py -3 run.py                                   candidate = the live webroot
#   py -3 run.py --dir D                           a build laid out like the webroot (js\main.js,
#                                                  js\penumbra_fields.js, css\penumbra_fields.css,
#                                                  index.php); a file D lacks comes from the live app
#   py -3 run.py --control --dir D                 the build BEFORE pick lists (main.js / index.php without
#                                                  them, no add-on): EXACTLY CONTROL_GREEN pass
#   py -3 run.py --scn a,b    --keep    --verbose
#
# Headless Edge over CDP (jrowfeat's flags); stages into %TEMP%; writes nothing to the webroot.
# Needs Python 3 + websocket-client.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
JRF = r'\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\jrowfeat'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_colmenu.js']
ALL_SCN = ['flat', 'pick', 'conflict', 'failure', 'filter', 'group', 'sort', 'hist', 'kbd', 'who', 'notready', 'nofields', 'setup',
           'rowmenu', 'bulk', 'cards']   # (phase 2, 2026-11-11) the row's menu, a heading's bulk set, cards
ALL_SCN = ALL_SCN + ['date', 'datebox', 'datefilter', 'dategroup', 'datesetup', 'datewho']   # (2026-11-12) date columns, DATE_SPEC.md 3a
ALL_SCN = ALL_SCN + ['datebulk', 'datebands', 'datenest', 'datecards']   # (2026-11-12) 3b: the heading's bulk set, period bands, cards
EXPECT = {
    'flat': ['F-head', 'F-cells', 'F-pill', 'F-toggles', 'F-resolver', 'F-labeller', 'F-values', 'F-friendly', 'F-export', 'F-isolation'],
    'pick': ['P-menu', 'P-save', 'P-shows', 'P-clear', 'P-checked', 'P-same'],
    'conflict': ['C-refused', 'C-toast', 'C-anyway'],
    'failure': ['X-revert'],
    'filter': ['S-equals', 'S-oldlabel', 'S-empty', 'S-notequals'],
    'group': ['G-order', 'G-cell', 'G-moves'],
    'sort': ['O-order'],
    'hist': ['H-pop', 'H-asked'],
    'kbd': ['K-down', 'K-open'],
    'who': ['W-cells', 'W-toggle'],
    'notready': ['N-cell', 'N-add'],
    'nofields': ['Z-none'],
    'setup': ['E-render', 'E-add', 'E-rename', 'E-retire', 'E-remove', 'E-save', 'E-clean'],
    # (phase 2) a table row's right-click: Progress > its options; a heading: Set Progress for N shown rows > (the
    # confirmation, every kept row's key, the toast, Undo, a filtered count, a name with markup escaped); cards: the pill
    # and a field are the cell's button (the picker), the card's menu and the details window carry it
    'rowmenu': ['R-item', 'R-sub', 'R-save', 'R-head'],
    'bulk': ['B-item', 'B-sub', 'B-confirm', 'B-post', 'B-toast', 'B-undo', 'B-filtered', 'B-escape'],
    'cards': ['D-pill', 'D-pick', 'D-shows', 'D-field', 'D-empty', 'D-menu', 'D-details', 'D-label'],
    # (2026-11-12, DATE_SPEC.md 3a) a "Due" date column: the cell, its menu and save; the date box; the filters' date
    # rules and the sort; day bands; the editor, the save by type, the caps, the kept unknown type; "Due set by / on"
    'date': ['T-head', 'T-cells', 'T-resolver', 'T-hlkind', 'T-resolve', 'T-menu', 'T-save', 'T-shows', 'T-checked', 'T-clear', 'T-headbulk', 'T-rowmenu'],
    'datebox': ['X-opens', 'X-keys', 'X-phrase', 'X-bad', 'X-nextfri', 'X-save', 'X-current', 'X-escape', 'X-clear', 'X-outside', 'X-calendar', 'X-centred'],
    'datefilter': ['Y-overdue', 'Y-soon', 'Y-oldname', 'Y-later', 'Y-empty', 'Y-month', 'Y-bucket', 'Y-bucketvars', 'Y-calendar', 'Y-bucketlist', 'Y-sort'],
    'dategroup': ['Q-bands', 'Q-moves'],
    'datesetup': ['V-render', 'V-add', 'V-rename', 'V-save', 'V-caps', 'V-kept', 'V-remove', 'V-cap-btn'],
    'datewho': ['W2-heads', 'W2-search'],
    # (3b) the heading's bulk set; grouped by Due:ym; a card's pill, field and menu
    'datebulk': ['L-item', 'L-sub', 'L-confirm', 'L-post', 'L-toast', 'L-undo', 'L-box', 'L-already', 'L-clear'],
    'datebands': ['M-variants', 'M-bands', 'M-rows', 'M-moves'],
    'datenest': ['N-nested'],
    'datecards': ['DC-pill', 'DC-pick', 'DC-menu'],
}
# The build before pick lists: only the toggle-only checks pass - the toggles' marks, the toggle's who column, no
# field column on a report without one. (Every E-* is red there: the hook cannot find penumbraCleanJournalFields.)
CONTROL_GREEN = ['F-toggles', 'W-toggle', 'Z-none']

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
build_dir = opt('--dir', APP)
scn_arg = opt('--scn')
control = flag('--control')
keep = flag('--keep')
verbose = flag('--verbose')
if args: raise SystemExit('unknown arguments: ' + ' '.join(args))

def pick_file(rel):
    p = os.path.join(build_dir, rel)
    return p if os.path.isfile(p) else os.path.join(APP, rel)
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def lift_panel(index_text):
    a = index_text.find('<div id="journalRowConfig"')
    if a < 0: raise SystemExit('index.php: no #journalRowConfig')
    depth, i = 0, a
    while True:
        o = index_text.find('<div', i); c = index_text.find('</div>', i)
        if c < 0: raise SystemExit('index.php: #journalRowConfig never closes')
        if o != -1 and o < c: depth += 1; i = o + 4
        else:
            depth -= 1; i = c + 6
            if depth == 0: break
    block = index_text[a:i]
    if '<?' in block: raise SystemExit('index.php: PHP inside #journalRowConfig')
    return block

def hook(src):
    """jrowfeat's hook, with the save builder and the pick lists' cleaner exported too."""
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['runTableSearch', 'rebuildTableFromMasterData', 'removeGrouping', 'applyPagination', 'buildStateObject', 'penumbraCleanJournalFields',
             '_pnbHlKind', 'penumbraKeptJournalFields']   # (2026-11-12) date columns
    h = ('\r\n;try { window.__JR = { master: function () { try { return eval("masterRowData"); } catch (e) { return null; } } }; } catch (e) { window.__JR_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__JR[k] = eval(k); } catch (e) { (window.__JR_MISSING = window.__JR_MISSING || []).push(k); } }); } catch (e) { window.__JR_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__JR_HIDES = (window.__JR_HIDES || 0) + 1;\r\n')

PICK = ("{ key: 'status', type: 'pick', label: 'Progress', options: ["
        "{ id: 'o1', label: 'Not started', color: 'grey' }, { id: 'o2', label: 'Waiting on PI', color: 'amber', oldLabels: ['Waiting'] }, "
        "{ id: 'o3', label: 'Done', color: 'green' }, { id: 'o4', label: 'Withdrawn', retired: true }] }")
FIELDS_JS = r"""
  // index.php defines the theme resolver inline (main.js calls it while restoring a report); jrowfeat's harness predates it.
  window.penumbraResolveTheme = window.penumbraResolveTheme || function (t) { return t; };
  // picklist suite: the pick list's server values, the scenario's state, the fake field actions.
  (function () {
    var S = window.__SCN, rows = window.__rowsFixture, K = function (i) { return window.__keyOf(rows[i]); };
    window.__J.fields = { status: {} };
    window.__J.fields.status[K(2)] = { v: 'o2', by: 'lee', at: '2026-11-11 09:00:00' };
    window.__J.fields.status[K(22)] = { v: 'o3', by: 'kim', at: '2026-11-11 09:30:00' };
    window.__J.fields.status[K(6)] = { v: 'o4', by: 'pat', at: '2026-11-10 15:00:00' };
    window.__J.fieldPosts = [];
    var st = window.__STORED;
    if (S !== 'nofields') st.viewOptions.journalFields = [ %PICK% ];
    if (S === 'group') { st.groupBy = 'Progress'; st.visibleColumns = [1, 0, 2, 3, 4]; }
    if (S === 'who') st.viewOptions.journalToggleWho = true;
    if (S === 'notready') window.__FIELD_READY = false;
    // (2026-11-12, DATE_SPEC.md) the date scenarios: a "Due" date column (once "Deadline") beside the pick list; K3 three
    // days ago, K23 in two days, K7 in nine, K10 a value that is not a day
    if (/^date/.test(S)) {
      var dIso = function (n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); var p = function (x) { return (x < 10 ? '0' : '') + x; };
                                return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
      window.__dIso = dIso;
      st.viewOptions.journalFields.push({ key: 'due', type: 'date', label: 'Due', oldLabels: ['Deadline'] });
      window.__J.fields.due = {};
      window.__J.fields.due[K(2)] = { v: dIso(-3), by: 'lee', at: '2026-11-11 09:00:00' };
      window.__J.fields.due[K(22)] = { v: dIso(2), by: 'kim', at: '2026-11-11 09:30:00' };
      window.__J.fields.due[K(6)] = { v: dIso(9), by: 'pat', at: '2026-11-10 15:00:00' };
      window.__J.fields.due[K(9)] = { v: '2026-02-30', by: 'odd', at: '2026-11-10 15:00:00' };
      if (S === 'datesetup') st.viewOptions.journalFields.push({ key: 'owner', type: 'lookup', label: 'Owner', autofill: 'PEOPLE.NAME' });
      if (S === 'dategroup') { st.groupBy = 'Due'; st.visibleColumns = [1, 0, 2, 3, 4]; }
      if (S === 'datebands') { st.groupBy = 'Due:ym'; st.visibleColumns = [1, 0, 2, 3, 4]; }
      if (S === 'datenest') { st.groupBy = 'PROTOCOL TYPE,Due:ym'; st.visibleColumns = [1, 0, 2, 3, 4]; }
      if (S === 'datewho') st.viewOptions.journalToggleWho = true;
    }
  })();
""".replace('%PICK%', PICK)
SERVER_JS = r"""
    // picklist suite: the field actions (manage_journal.php's set_field / set_fields_bulk / field_history / field_status)
    var FM = (J.fields = J.fields || {});
    if (action === 'set_field' && body) {
      J.fieldPosts.push(body);
      if (window.__FIELD_FAIL) return { status: 'error', message: 'Pick lists need an update to the journal tables first.' };
      var fm = FM[body.toggle_key] = FM[body.toggle_key] || {}, cur = fm[body.row_key] ? fm[body.row_key].v : null, held = fm[body.row_key] || {};
      if ((body.prev || null) !== cur) return { status: 'success', conflict: true, v: cur, by: held.by || null, at: held.at || null };
      if ((body.value || null) === cur) return { status: 'success', unchanged: true, v: cur, by: held.by || null, at: held.at || null };
      if (body.value) fm[body.row_key] = { v: body.value, by: 'harness', at: '2026-11-11 12:00:00' }; else delete fm[body.row_key];
      return { status: 'success', unchanged: false, v: body.value || null, by: 'harness', at: '2026-11-11 12:00:00' };
    }
    if (action === 'set_fields_bulk' && body) {
      J.fieldPosts.push(body);
      var bm = FM[body.toggle_key] = FM[body.toggle_key] || {}, ch = [];
      Object.keys(body.values || {}).forEach(function (rk) {
        var c = bm[rk] ? bm[rk].v : null, v = body.values[rk] || null;
        if (c === v) return;
        if (v) bm[rk] = { v: v, by: 'harness', at: '2026-11-11 12:00:00' }; else delete bm[rk];
        ch.push({ row_key: rk, prev: c });
      });
      return { status: 'success', count: ch.length, skipped: Object.keys(body.values || {}).length - ch.length, changed: ch, by: 'harness' };
    }
    if (action === 'field_history') return { status: 'success', events: [{ by: 'lee', at: '2026-11-11 09:00:00', from: null, to: 'o2', from_label: null, to_label: 'Waiting', bulk: false }] };
    if (action === 'field_status') return { status: 'success', ready: window.__FIELD_READY !== false, known: true, can_install: true };
"""

def build_harness(panel, index_text=''):
    # (phase 2) the card view's host, as the index.php under test draws it
    m = re.search(r'<div id="pnbCardsHost"[^\n]*', index_text or '')
    host = m.group(0) if m else ''
    h = open(os.path.join(JRF, 'harness.html'), encoding='utf-8').read()
    edits = [
        ('<link rel="stylesheet" href="main.css">', '<link rel="stylesheet" href="main.css">\n<link rel="stylesheet" href="penumbra_fields.css">'),
        ("    window.__queryResponse = { data: rows };\n  })();", "    window.__queryResponse = { data: rows };\n  })();" + FIELDS_JS),
        ("    if (!action && opts.data) { try { body = JSON.parse(opts.data); action = body.action; } catch (e) { } }",
         "    if (opts.data && typeof opts.data === 'string') { try { body = JSON.parse(opts.data); if (!action) action = body.action; } catch (e) { } }"),
        ("    if (action === 'toggles') return { status: 'success', installed: true, toggles: JSON.parse(JSON.stringify(J.toggles)) };",
         "    if (action === 'toggles') return { status: 'success', installed: true, toggles: JSON.parse(JSON.stringify(J.toggles)),"
         " fields: JSON.parse(JSON.stringify(J.fields || {})), field_ready: window.__FIELD_READY === false ? false : true };" + SERVER_JS),
        # (phase 2) the card view for the cards scenario alone, before the menu engine, as index.php loads them
        ('<script src="main_jr.js"></script>', '<script src="main_jr.js"></script>\n'
         '<script>if (/^(cards|datecards)$/.test(window.__SCN)) document.write(\'<link rel="stylesheet" href="penumbra_cards.css"><script src="penumbra_cards.js"></scr\' + \'ipt>\');</script>\n'
         '<script src="penumbra_colmenu.js"></script>\n<script src="penumbra_fields.js"></script>'),
        ('<div id="groupedResultsContainer" style="display:none"></div>', '<div id="groupedResultsContainer" style="display:none"></div>' + host),
        ('<!--JR_VIEW_OPTIONS-->', panel),
    ]
    for old, new in edits:
        if h.count(old) != 1: raise SystemExit('harness: jrowfeat anchor found %d times: %r' % (h.count(old), old[:80]))
        h = h.replace(old, new)
    return h

stage = tempfile.mkdtemp(prefix='pnb_pl_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
fjs, fcss = os.path.join(build_dir, 'js', 'penumbra_fields.js'), os.path.join(build_dir, 'css', 'penumbra_fields.css')
open(os.path.join(stage, 'penumbra_fields.js'), 'w', encoding='utf-8').write(read_b(fjs) if (os.path.isfile(fjs) and not control) else '/* no add-on in this build */')
open(os.path.join(stage, 'penumbra_fields.css'), 'w', encoding='utf-8').write(read_b(fcss) if (os.path.isfile(fcss) and not control) else '')
# (phase 2) the menu engine and the card view under test (the LIBS copy of the engine is live's)
for _rel, _name in ((os.path.join('js', 'penumbra_colmenu.js'), 'penumbra_colmenu.js'), (os.path.join('js', 'penumbra_cards.js'), 'penumbra_cards.js'),
                    (os.path.join('css', 'penumbra_cards.css'), 'penumbra_cards.css'), (os.path.join('css', 'penumbra_colmenu.css'), 'penumbra_colmenu.css')):
    _p = os.path.join(build_dir, _rel)
    open(os.path.join(stage, _name), 'w', encoding='utf-8').write(read_b(_p if os.path.isfile(_p) else os.path.join(APP, _rel)))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(scn):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?id=jrfix&scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 180:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__JRDONE ? JSON.stringify(window.__JRRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (180 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

try:
    main_path, index_path = pick_file(os.path.join('js', 'main.js')), pick_file('index.php')
    print('main.js:   %s%s\nindex.php: %s\nadd-on:    %s' % (main_path, '   (CONTROL)' if control else '', index_path, 'none' if control else fjs))
    open(os.path.join(stage, 'main_jr.js'), 'wb').write(hook(read_b(main_path)).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'harness.html'), 'w', encoding='utf-8').write(build_harness(lift_panel(read_b(index_path)), read_b(index_path)))
    names = [s for s in ALL_SCN if not scn_arg or s in scn_arg.split(',')]
    p = f = 0; passed = []; failed = []
    for s in names:
        r = run_page(s)
        got = {a['id']: a for a in (r.get('asserts') or [])}
        rows = [(aid, got[aid]['ok'], got[aid]['detail']) if aid in got else (aid, False, 'NOT RECORDED' + (' | fatal: ' + (r.get('fatal') or '')[:300] if r.get('fatal') else ''))
                for aid in EXPECT[s]]
        rows.append(('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing') and not r.get('fatal'),
                     'errors %s hook %s missing %s fatal %s' % (r.get('errors'), r.get('hookErr'), r.get('missing'), (r.get('fatal') or '')[:300])))
        for aid, ok, d in rows:
            print('  %s  %-14s %s' % ('PASS' if ok else 'FAIL', aid, d[:400]))
            if ok: p += 1; passed.append(aid)
            else: f += 1; failed.append(aid)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        want = [a for a in CONTROL_GREEN if any(a in EXPECT[s] or a == 'E-' + s for s in names)]
        good = sorted(passed) == sorted(want)
        print('CONTROL: %s (expected green only: %s)' % ('as expected' if good else 'NOT as expected', ' '.join(want)))
        print('RESULT: GREEN' if good else 'RESULT: RED')
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
