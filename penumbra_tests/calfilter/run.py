# =============================================================================
# CALENDAR FILTER BAR SUITE (2026-10-08): calendar.php's page-level chip bar
# carries the calendar's own filters - one chip per task type (the old legend,
# all on by default, the OFF set remembered per browser; Shift+click = only
# that type), the Hide paused toggle (moved up from the toolbar), a search box
# (title / short id / subject / owner / destination / #id, filters as you
# type, Enter does NOT submit the page's GET form) and a Reset. The Metrics
# "Range: Last 30 days" chip, which never applied to the calendar, is gone.
#
# WHAT IS UNDER TEST: analytics_all.php, LIFTED by anchors - the calendar CSS,
# the filter-bar template, the calendar card template and the calendar
# <script> - rendered by the REAL PHP 8.2 CLI over a fixture of five tasks
# (2 EMAIL of which 1 paused, 2 SNAPSHOT of which 1 paused every minute, 1 SNAPSHOT, 1 DROP_FILE, 1 DB_DUMP, all daily),
# then driven in headless Edge over CDP with real clicks and typed text.
#
#   P*  the PHP side: no Range / remembered-preference chip, 4 type chips with counts, the scope chip
#   D*  the default state (fresh profile): all on, paused hidden, 4 of 5 shown
#   T*  type chips: toggle, persist across a reload, Shift+click solo
#   Q*  search: title / #id / destination / owner, Enter is inert, the x
#   H*  the Active (n) status chip: selected (default) = active only; deselected = paused too (1 filter on)
#   Y*  the "Owned by me" / "Not owned by me" chips (the viewer = jdoe in the harness); Y4 the search box does not jump
#   E*  nothing matches: the day view's message, an empty today cell
#   R*  Reset: every type back on, the search cleared
#   M*  the month grid obeys the same predicate as the day view
#   A*  Next 7 days agenda (same predicate, row click opens the day)
#   O*  owner chip from a task's "by X"
#   U*  filters ride in the URL (replaceState); a bookmarked URL wins on load
#   K*  "/" focuses the search
#   W*  week view (7 columns, every run, Prev/Next/Today move a week)
#   N*  the next-run badge (NEXT_RUN; active tasks only)
#   L*  the controls line up under the app's global button rule
#   A4  the agenda pages a week at a time; C1 dropping the scope keeps the calendar's URL filters; V1 600px viewport
#
#   py -3 run.py                    the live analytics_all.php   EXPECTED: GREEN
#   py -3 run.py --control          analytics_all.php.bak-20261008-calfilter
#                                   (pre-feature): RED on P1 and everything after
#   py -3 run.py --stage <file>     a staged analytics_all.php
#   py -3 run.py --mutant <name> / --mutants   (anchors are checked first)
# Run it from its own folder (Git Bash mangles a \\server\d$ path argument):
#   cd '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\calfilter' ; py -3 run.py
# Needs py -3 + websocket-client and the PHP 8.2 CLI. Stages into %TEMP%;
# writes nothing to the webroot.
# =============================================================================
import argparse, datetime, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
STAMP = '20261008-calfilter'

# name: (old, new, asserts that MUST go red). Each old must occur exactly once in the FEATURE build.
MUTANTS = {
    'typeoff':   ("        if (typesOff[t.type]) return false;", "        if (false) return false;", ['T1', 'T2', 'T3', 'M1']),
    'notitle':   ("[t.title, t.short, t.subject", "[t.short, t.subject", ['Q1']),
    'enter':     ("        if (e.key === 'Enter') e.preventDefault();", "        if (e.key === 'Enter') {}", ['Q3']),
    'rangechip': ("return !empty($c['on']) && in_array($c['k'], array('report', 'user'), true); }", "return true; }", ['P1']),
    'prefchip':  ("return !empty($c['on']) && in_array($c['k'], array('report', 'user'), true); }", "return !empty($c['on']); }", ['P1']),
    'persist':   ("localStorage.setItem('penumbra_cal_types_off', JSON.stringify(Object.keys(typesOff)));", "localStorage.setItem('penumbra_cal_types_off', '[]');", ['T1', 'T2']),
    'daytext':   ("'No tasks matching the current filters run on this day.'", "'No tasks are scheduled to run on this day.'", ['E1']),
    'agpage':    ("        if (view === 'agenda') { agStart = new Date(agStart.getFullYear(), agStart.getMonth(), agStart.getDate() + 7 * dir); setView('agenda'); return; }", "", ['A4']),
    'userlabel': ("'label' => $anCalMode ? 'Owner' : 'User', 'value' => $userSearch", "'label' => 'User', 'value' => $userSearch", ['S2']),
    'noroll':    ("    document.addEventListener('visibilitychange', rollDay);", "", ['D2']),
    'rollpaged': ("        if (agStart.getTime() === old.getTime()) agStart = new Date(now.getTime());", "        agStart = new Date(now.getTime());", ['D3']),
    'typesone':  ("        var n = serverOn + (Object.keys(typesOff).length ? 1 : 0) + (query !== '' ? 1 : 0) + ((ownerQ !== '' || notMe) ? 1 : 0) + ((hideChk && !hidePaused) ? 1 : 0);", "        var n = serverOn + Object.keys(typesOff).length + (query !== '' ? 1 : 0) + ((ownerQ !== '' || notMe) ? 1 : 0) + ((hideChk && !hidePaused) ? 1 : 0);", ['T3', 'U2']),
    'scopeclear':("        ['report_id', 'report', 'user', 'filter_submitted'].forEach(function (k) { p.delete(k); });", "        ['filter_submitted'].forEach(function (k) { p.delete(k); });", ['C1', 'C2']),
    'clearlate': ("    var GRID = document.getElementById('calGrid');\n    if (!GRID) return; // no tasks -> empty state only; toolbar still shows the month", "    var GRID = document.getElementById('calGrid');\n    if (!GRID) { window.penumbraClearFilter = window.__origClear; return; }", ['C2']),
    'gridpred':  ("            if (!taskVisible(TASKS[i])) continue;  // the filter bar: paused / type / search", "            if (hidePaused && !TASKS[i].active) continue;", ['T1', 'T3', 'Q1', 'E1', 'M1']),
    'noshown':   ("                ? base + ' · ' + shown + ' shown' : base;", "                ? base : base;", ['D1', 'Q1']),
    'ownerpred': ("        if (ownerQ !== '' && String(t.owner || '').toLowerCase() !== ownerQ.toLowerCase()) return false;", "        if (false) return false;", ['O1']),
    'aghourly':  ("                    entries.forEach(function (r) {", "                    runs.map(function (mm) { return { t: entries[0].t, hour: Math.floor(mm / 60), minutes: [mm % 60] }; }).forEach(function (r) {", ['A5']),
    'agendapred':("            var evs = collectDay(y, m0, dd), runs = [], entries = [];", "            var evs = (function(){ var out=[]; for (var i2=0;i2<TASKS.length;i2++){ var tm=dayOccurrences(TASKS[i2], y, m0, dd); if (tm.length) out.push({t:TASKS[i2], times:tm}); } return out; })(), runs = [], entries = [];", ['A2']),
    'urlread':   ("        if (p.has('off')) {", "        if (false) {", ['U2']),
    'urlwrite':  ("        if (off.length) p.set('off', off.join(','));", "", ['U1']),
    'slash':     ("        e.preventDefault(); searchEl.focus(); searchEl.select();", "        e.preventDefault();", ['K1']),
    'viewurl':   ("        if (view === 'agenda' || view === 'week') p.set('view', view);", "", ['U1', 'W3']),
    'nextrun':   ("        return !!n && n.getFullYear() === y && n.getMonth() === m0 && n.getDate() === d && (n.getHours() * 60 + n.getMinutes()) === minOfDay;", "        return false;", ['N1']),
    'nextpaused':("        t._next  = (t.active && t.next) ? parseSqlDate(t.next) : null;", "        t._next  = t.next ? parseSqlDate(t.next) : null;", ['N1']),
    'weekcap':   ("                for (var e = 0; e < evs.length; e++) cell.appendChild(buildChip(evs[e], cy, cm0, cdd));", "                for (var e = 0; e < Math.min(evs.length, MAX_CHIPS); e++) cell.appendChild(buildChip(evs[e], cy, cm0, cdd));", ['W1']),
    'backmonth': ("    if (back) back.addEventListener('click', function () { setView(view); });", "    if (back) back.addEventListener('click', function () { setView('month'); });", ['A3', 'W3']),
    'pausedinv': ("        if (hideChk) { hideChk.classList.toggle('on', hidePaused); hideChk.setAttribute('aria-pressed', hidePaused ? 'true' : 'false'); }", "        if (hideChk) { hideChk.classList.toggle('on', !hidePaused); hideChk.setAttribute('aria-pressed', hidePaused ? 'false' : 'true'); }", ['D1', 'H1']),
    'statuslead':("+ ((hideChk && !hidePaused) ? 1 : 0);", ";", ['H1', 'U2']),
    'resetactive':("        query = ''; ownerQ = ''; notMe = false; hidePaused = true;   // Active back on, like the types", "        query = ''; ownerQ = ''; notMe = false;", ['R1', 'U3']),
    'notmepred': ("        if (notMe && meKey !== '' && String(t.owner || '').toLowerCase() === meKey.toLowerCase()) return false;", "", ['Y3']),
    'notmeexcl': ("    function setNotMe(v) { notMe = !!v; if (notMe) ownerQ = ''; applyFilters(); }", "    function setNotMe(v) { notMe = !!v; applyFilters(); }", ['Y3']),
    'resetauto': ("    .cal-filter-bar .cal-fb-reset { margin-left: 0; }", "", ['Y4', 'Y5']),
    'sboxpill':  ("border: 1px solid var(--border-strong, var(--border-color)); border-radius: 5px; color: var(--text-main); }", "border: 1px solid var(--border-strong, var(--border-color)); border-radius: 999px; color: var(--text-main); }", ['L1']),
    'sboxinput': ("border: 0 !important; outline: 0; box-shadow: none !important;", "outline: 0; box-shadow: none !important;", ['L1']),
    'sboxspec':  ("    #calSearchBox #calSearch { flex: 1 1 auto;", "    .cal-search input { flex: 1 1 auto;", ['L5']),
    'resetgone': ("    .cal-fb-reset[hidden] { display: inline-block; visibility: hidden; }", "    .cal-fb-reset[hidden] { display: none; }", ['Y4']),
    'mineclick': ("    if (mineBtn) mineBtn.addEventListener('click', function () { setOwner(ownerIsMe() ? '' : meKey); });", "", ['Y1']),
    'minedup':   ("        if (ownerQ === '' || ownerIsMe()) { if (chip && chip.parentNode) chip.parentNode.removeChild(chip); return; }", "        if (ownerQ === '') { if (chip && chip.parentNode) chip.parentNode.removeChild(chip); return; }", ['Y1']),
    'minecount': ("strcasecmp(trim((string)$r['OWNER_ID']), trim($currentUserKey)) === 0) $schedMineCount++;", "strcmp(trim((string)$r['OWNER_ID']), trim($currentUserKey)) === 0) $schedMineCount++;", ['Y1']),
    'pausedmem': ("        hidePaused = true;\n        try { localStorage.removeItem('penumbra_cal_hide_paused'); } catch (e) {}", "        try { hidePaused = localStorage.getItem('penumbra_cal_hide_paused') !== '0'; } catch (e) { hidePaused = true; }", ['H2']),
    'pausedclk': ("            hidePaused = !hidePaused;", "            hidePaused = hidePaused;", ['H1']),
    'vbradius':  ("border: none; border-radius: 0; margin: 0; min-height: 0;", "border: none; margin: 0; min-height: 0;", ['L2']),
}

R = []
def rec(id_, name, ok, detail=''):
    R.append({'id': id_, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:400]})

def read(p):
    with open(p, 'rb') as f: return f.read().decode('utf-8')

def cut(src, start, end, label, start_alt=None):
    i = src.find(start)
    if i < 0 and start_alt: i = src.find(start_alt)
    if i < 0: raise RuntimeError('anchor missing: ' + label + ' start')
    j = src.find(end, i)
    if j < 0: raise RuntimeError('anchor missing: ' + label + ' end')
    return src[i:j]

# --------------------------------------------------------------------- CDP
def free(port):
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', port)); s.close(); return r != 0
def pick_port(base):
    for p in range(base, base + 200):
        if free(p): return p
    raise RuntimeError('no free port')

class Page:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=60, suppress_origin=True); self.n = 0
    def call(self, method, **params):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == mid:
                if 'error' in m: raise RuntimeError(method + ': ' + json.dumps(m['error']))
                return m.get('result', {})
    def ev(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True)
        if 'exceptionDetails' in r: raise RuntimeError('JS: ' + json.dumps(r['exceptionDetails'])[:500])
        return r.get('result', {}).get('value')
    def wait(self, expr, ms=8000):
        t0 = time.time()
        while time.time() - t0 < ms / 1000:
            try:
                if self.ev(expr): return True
            except Exception: pass
            time.sleep(0.08)
        return False
    def mouse(self, typ, x, y, buttons=0, count=1, mods=0):
        self.call('Input.dispatchMouseEvent', type=typ, x=x, y=y, button='left', buttons=buttons, clickCount=count, modifiers=mods)
    def click(self, x, y, shift=False):
        mods = 8 if shift else 0
        self.mouse('mouseMoved', x, y, mods=mods); self.mouse('mousePressed', x, y, 1, 1, mods); time.sleep(0.03); self.mouse('mouseReleased', x, y, 0, 1, mods)
    def key(self, k, code):
        # keyDown WITH text (not rawKeyDown): only then does the browser run the
        # form's implicit submission on Enter, which is what Q3 must prove inert.
        txt = chr(13) if k == 'Enter' else ''
        self.call('Input.dispatchKeyEvent', type='keyDown', text=txt, unmodifiedText=txt, key=k, code=k, windowsVirtualKeyCode=code, nativeVirtualKeyCode=code)
        self.call('Input.dispatchKeyEvent', type='keyUp', key=k, code=k, windowsVirtualKeyCode=code, nativeVirtualKeyCode=code)
    def center(self, sel):
        return self.ev("(function(){var e=document.querySelector(%s); if(!e||!e.getClientRects().length) return null; e.scrollIntoView({block:'center'}); var b=e.getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2];})()" % json.dumps(sel))
    def click_sel(self, sel, shift=False):
        c = self.center(sel)
        if not c: raise RuntimeError('not drawn: ' + sel)
        self.click(c[0], c[1], shift); time.sleep(0.25)

class Browser:
    def __init__(self, root):
        self.hp, self.dp = pick_port(8840), pick_port(9380)
        self.srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(self.hp), '--bind', '127.0.0.1', '--directory', root],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.prof = tempfile.mkdtemp(prefix='pnbedge_cf_', dir=r'C:\Temp' if os.path.isdir(r'C:\Temp') else None)
        self.edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                                      '--disable-sync', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
                                      '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
                                      '--user-data-dir=' + self.prof, '--window-size=1400,1000', '--remote-debugging-port=%d' % self.dp,
                                      '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws = None
        for _ in range(150):
            try:
                for t in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % self.dp)):
                    if t.get('type') == 'page' and t.get('url', '').startswith('about:blank'): ws = t['webSocketDebuggerUrl']
                if ws: break
            except Exception: pass
            time.sleep(0.2)
        if not ws: raise RuntimeError('Edge did not start')
        self.pg = Page(ws)
        self.pg.call('Network.enable'); self.pg.call('Network.setCacheDisabled', cacheDisabled=True)
        self.pg.call('Page.enable'); self.pg.call('Emulation.setFocusEmulationEnabled', enabled=True)
    def load(self, page):
        self.pg.call('Page.navigate', url='http://127.0.0.1:%d/%s?t=%d' % (self.hp, page, int(time.time() * 1000)))
        time.sleep(0.2)
        if not self.pg.wait("document.readyState === 'complete' && !!document.getElementById('calTitle')", 20000): raise RuntimeError('page did not load')
        time.sleep(0.2)
    def close(self):
        for p in (self.edge, self.srv):
            try: p.kill()
            except Exception: pass
        time.sleep(0.5); shutil.rmtree(self.prof, ignore_errors=True)

# --------------------------------------------------------------------- staging
TODAY = datetime.date.today(); TOMORROW = TODAY + datetime.timedelta(days=1)
FIXTURE = [
    {'id': 1, 'type': 'EMAIL',     'cron': '0 8 * * *',  'short': 'alpha1', 'title': 'Alpha Weekly Digest', 'subject': 'Digest', 'recipCount': 2, 'owner': 'jdoe',  'active': 1, 'next': TODAY.strftime('%Y-%m-%d') + ' 08:00:00', 'last': None, 'detail': '', 'cond': 0},
    {'id': 2, 'type': 'SNAPSHOT',  'cron': '0 9 * * *',  'short': 'beta22', 'title': 'Beta Snapshot',       'subject': None,     'recipCount': 0, 'owner': 'asmith','active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 0},
    {'id': 3, 'type': 'DROP_FILE', 'cron': '30 9 * * *', 'short': 'gam3',   'title': 'Gamma Drop',          'subject': None,     'recipCount': 0, 'owner': 'asmith','active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 1},
    {'id': 4, 'type': 'DB_DUMP',   'cron': '0 10 * * *', 'short': 'del4',   'title': 'Delta Dump',          'subject': None,     'recipCount': 0, 'owner': 'jdoe',  'active': 1, 'next': TOMORROW.strftime('%Y-%m-%d') + ' 10:00:00', 'last': None, 'detail': 'NC_X.T1', 'cond': 0},
    {'id': 6, 'type': 'SNAPSHOT',  'cron': '* * * * *',  'short': 'zeta6',  'title': 'Zeta Every Minute',   'subject': None,     'recipCount': 0, 'owner': 'asmith','active': 0, 'next': None, 'last': None, 'detail': '', 'cond': 0},
    {'id': 5, 'type': 'EMAIL',     'cron': '0 11 * * *', 'short': 'eps5',   'title': 'Epsilon Paused',      'subject': 'Old',    'recipCount': 1, 'owner': 'jdoe',  'active': 0, 'next': TODAY.strftime('%Y-%m-%d') + ' 11:00:00', 'last': None, 'detail': '', 'cond': 0},
]

PRELUDE = r'''<?php
$anCalMode = true; $anReportScope = false; $userSearch = ''; $reportSearch = ''; $currentUserKey = 'JDoe';
$schedTypeLabels = array('EMAIL' => 'Email Report', 'SNAPSHOT' => 'Take a Snapshot', 'DROP_FILE' => 'Drop a File', 'DB_DUMP' => 'Dump to Data Source');
$schedTasks = getenv('CF_EMPTY') === '1' ? array() : json_decode(getenv('CF_TASKS'), true);
$schedActiveCount = 0; $schedPausedCount = 0;
$schedTypeCounts = array('EMAIL' => 0, 'SNAPSHOT' => 0, 'DROP_FILE' => 0, 'DB_DUMP' => 0); $schedMineCount = 0;
foreach ($schedTasks as &$t) { $t['typeLabel'] = $schedTypeLabels[$t['type']]; if ($t['active']) $schedActiveCount++; else $schedPausedCount++; $schedTypeCounts[$t['type']]++; if (strcasecmp((string)$t['owner'], $currentUserKey) === 0) $schedMineCount++; } unset($t);
$chips = array(array('k' => 'range', 'label' => 'Range', 'value' => 'Last 30 days', 'on' => false));
$activeFilterCount = 0;
if (getenv('CF_SCOPE') === '1') { $chips[] = array('k' => 'report', 'label' => 'Report', 'value' => 'alpha1 (exact)', 'on' => true); $activeFilterCount = 1; }
$chips[] = array('k' => 'excl_automation', 'label' => 'Hiding', 'value' => 'automation / API', 'on' => true); $activeFilterCount++;
?>'''

SHELL_HEAD = '''<!doctype html><html><head><meta charset="utf-8"><title>calfilter</title><style>
:root { --bg-surface:#fff; --bg-surface-alt:#f3f3f3; --border-color:#ccc; --text-main:#222; --text-muted:#777; --brand-primary:#336699; --an-danger:#c00; }
body { font-family: sans-serif; margin: 16px; }
button { padding: 8px 15px; font-size: 12px; margin-top: 5px; border-radius: 10px; }
input[type="text"], input[type="search"] { border: 1px solid #888; }   /* main.css's text-field rule */
body.theme-wolfpack-dark input[type="search"] { background-color: #333 !important; color: #e0e0e0 !important; border: 1px solid #555 !important; }   /* a dark theme's rule, (0,1,2) + !important */
.filter-bar { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:0 0 14px; padding:7px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-surface-alt); }
.filter-bar.is-filtered { border-color: var(--brand-primary); }
.filter-bar .fb-lead { display:inline-flex; align-items:center; gap:6px; font-size:10px; text-transform:uppercase; color:var(--text-muted); }
.filter-bar .fb-lead svg { width:13px; height:13px; }
.chip { display:inline-flex; align-items:center; gap:5px; font-size:11px; color:var(--text-main); background:var(--bg-surface); border:1px solid var(--border-color); border-radius:999px; padding:2px 9px; }
.chip.on { border-color: var(--brand-primary); }
.chip .chip-k { font-size:9px; text-transform:uppercase; color:var(--text-muted); }
.chip-x { border:none; background:none; cursor:pointer; color:var(--text-muted); font-size:14px; line-height:1; padding:1px 5px; border-radius:999px; }
.fb-clear { margin-left:auto; font-size:11px; cursor:pointer; border:1px solid var(--border-color); border-radius:4px; padding:3px 10px; }   /* the SHARED rule, incl. its auto margin */
.card { border:1px solid #ccc; padding:14px; }
.empty { color:#777; }
'''

def stage(src_text, mutant):
    text = src_text
    if mutant:
        old, new, _red = MUTANTS[mutant]
        n = text.count(old)
        if n != 1: raise RuntimeError("mutant '%s' anchor found %d times (needs the FEATURE build): %s" % (mutant, n, old[:80]))
        text = text.replace(old, new)
    css = cut(text, '    /* ---- Calendar tab ----', '    /* Shared machinery LAST', 'calendar css')
    bar = cut(text, '        <?php\n        // Calendar mode (2026-10-08)', '        <!-- Real tab semantics', 'filter bar',
              start_alt='        <div class="filter-bar<?php echo $activeFilterCount')
    card = cut(text, '            <div class="card">\n                <div class="cal-toolbar">', '        <?php endif; /* !$anReportScope: the calendar panel */ ?>', 'calendar card')
    js_start = text.find('/* ============================ Calendar tab')
    if js_start < 0: raise RuntimeError('anchor missing: calendar script')
    js_end = text.find('})();\n</script>', js_start)
    if js_end < 0: raise RuntimeError('anchor missing: calendar script end')
    js = text[js_start:js_end + len('})();\n</script>')]
    prelude = PRELUDE
    if "if ($currentUserKey !== '' && isset($r['OWNER_ID']) && " in text:   # a pre-feature control has no count line
        cnt = text[text.index("if ($currentUserKey !== '' && isset($r['OWNER_ID']) && "):]
        cnt = cnt[:cnt.index('$schedMineCount++;') + len('$schedMineCount++;')]
        prelude = PRELUDE.replace("if (strcasecmp((string)$t['owner'], $currentUserKey) === 0) $schedMineCount++;",
                                  cnt.replace("$r['OWNER_ID']", "$t['owner']"))
    tpl = (prelude + SHELL_HEAD + css + '</style></head><body>\n'
           '<form class="console-shell an-cal-mode" method="get" action="calendar.php"><input type="hidden" name="filter_submitted" value="1">\n'
           '<?php if ($activeFilterCount): ?><input type="hidden" name="report_id" id="fReportExact" value="alpha1"><?php endif; ?>\n'
           + bar + '\n<div id="panel-calendar">\n' + card + '\n</div></form>\n'
           '<script>window.PNB_CAL_MODE = true; window.__submitted = 0; window.__cleared = []; window.__fakeNow = null; (function(){ var R = Date; function F(a,b,c,d,e,f,g){ if (!(this instanceof F)) return String(new R()); if (arguments.length === 0) return window.__fakeNow === null ? new R() : new R(window.__fakeNow); switch (arguments.length) { case 1: return new R(a); case 2: return new R(a,b); case 3: return new R(a,b,c); case 4: return new R(a,b,c,d); case 5: return new R(a,b,c,d,e); case 6: return new R(a,b,c,d,e,f); default: return new R(a,b,c,d,e,f,g); } } F.prototype = R.prototype; F.now = function(){ return window.__fakeNow === null ? R.now() : window.__fakeNow; }; F.UTC = R.UTC; F.parse = R.parse; window.Date = F; })();\n'
           "document.querySelector('form.console-shell').addEventListener('submit', function (e) { e.preventDefault(); window.__submitted++; });\n"
           "document.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-clear]') : null; if (b) { window.__cleared.push(b.dataset.clear); if (window.penumbraClearFilter) window.penumbraClearFilter(b.dataset.clear); } });\n"
           '</script>\n<script>\n' + js + '\n</body></html>\n')
    run = tempfile.mkdtemp(prefix='pnb_cf_')
    tpl_path = os.path.join(run, 'page.php')
    with open(tpl_path, 'wb') as f: f.write(tpl.encode('utf-8'))
    for scope, name, empty in (('0', 'cal.html', '0'), ('1', 'scope.html', '0'), ('1', 'empty.html', '1')):
        env = dict(os.environ, CF_TASKS=json.dumps(FIXTURE), CF_SCOPE=scope, CF_EMPTY=empty)
        out = subprocess.run([PHP, '-n', '-d', 'display_errors=1', '-d', 'error_reporting=-1', '-d', 'date.timezone=America/New_York', tpl_path], capture_output=True, env=env)
        html = out.stdout.decode('utf-8', 'replace')
        if out.returncode != 0 or 'Warning:' in html or 'Fatal error' in html or 'Notice:' in html or 'Deprecated:' in html:
            raise RuntimeError('php render (%s): rc=%d\n%s\n%s' % (name, out.returncode, html[:1500], out.stderr.decode('utf-8', 'replace')[:500]))
        with open(os.path.join(run, name), 'wb') as f: f.write(html.encode('utf-8'))
    return run, text

# --------------------------------------------------------------------- checks
DAY_ROWS = "Array.from(document.querySelectorAll('#calDayView .cal-day-ev')).map(function(e){return e.className.match(/cal-type-\\w+/)[0].replace('cal-type-','') + ':' + e.querySelector('.cal-de-title').textContent;})"
LEAD = "document.getElementById('calFbLead').textContent.trim()"
PRESSED = "Array.from(document.querySelectorAll('.cal-type-chip')).map(function(b){return b.getAttribute('data-cal-type')+'='+b.getAttribute('aria-pressed')+'/'+(b.classList.contains('on')?'on':'off');}).join(' ')"
SUMMARY = "document.getElementById('calSummary').textContent.replace(/\\s+/g,' ').trim()"

def open_today(pg):
    pg.click_sel('.cal-cell.today')
    if not pg.wait("document.getElementById('calDayView').style.display !== 'none'", 3000): raise RuntimeError('day view did not open')

def type_text(pg, text):
    pg.click_sel('#calSearch')
    pg.ev("document.getElementById('calSearch').value = ''")
    pg.call('Input.insertText', text=text)
    pg.ev("document.getElementById('calSearch').dispatchEvent(new Event('input'))")
    time.sleep(0.35)

def checks(br, text):
    pg = br.pg
    # ---- P: the PHP side (static render) ----
    br.load('cal.html')
    bar_html = pg.ev("document.getElementById('calFilterBar') ? document.getElementById('calFilterBar').outerHTML : (document.querySelector('.filter-bar')||{}).outerHTML || ''")
    chips = pg.ev("Array.from(document.querySelectorAll('.cal-type-chip')).map(function(b){return b.getAttribute('data-cal-type')+':'+b.querySelector('.chip-n').textContent;}).join(' ')")
    rec('S2', 'the ?user= scope chip is labelled Owner in calendar mode (the task query reads it as OWNER_ID)',
        "'label' => $anCalMode ? 'Owner' : 'User', 'value' => $userSearch" in text, 'anchor present=%s' % ("'label' => $anCalMode ? 'Owner' : 'User'" in text))
    rec('P1', 'calendar mode: no Range chip; 4 type chips with counts; search box; Hide paused; no legend left',
        'Range' not in bar_html and 'Hiding' not in bar_html and pg.ev(LEAD) == 'unfiltered' and chips == 'EMAIL:2 SNAPSHOT:2 DROP_FILE:1 DB_DUMP:1' and pg.ev("!!document.getElementById('calSearch')") and pg.ev("!!document.getElementById('calHidePaused')")
        and not pg.ev("!!document.querySelector('.cal-legend')") and '<div class="cal-legend">' not in text,
        'range=%s hiding=%s lead=%s chips=%s legend=%s' % ('Range' in bar_html, 'Hiding' in bar_html, pg.ev(LEAD), chips, '<div class="cal-legend">' in text))
    br.load('scope.html')
    rec('P2', 'an inbound report scope chip still renders first, with its x, and counts toward the lead',
        pg.ev("(function(){var c=document.querySelector('#calFilterBar .chip'); return !!c && c.textContent.indexOf('Report')>=0 && c.textContent.indexOf('alpha1')>=0 && !!c.querySelector('.chip-x[data-clear=\"report\"]');})()")
        and pg.ev(LEAD) == '1 filter on' and pg.ev("document.getElementById('calFilterBar').classList.contains('is-filtered')")
        and pg.ev("!!document.querySelector('#calFilterBar .fb-clear[data-clear=\"all\"]')"),
        'lead=%s' % pg.ev(LEAD))
    pg.click_sel('.cal-type-chip[data-cal-type="DB_DUMP"]')
    rec('P3', 'a type switched off on top of the scope chip reads "2 filters on"', pg.ev(LEAD) == '2 filters on', pg.ev(LEAD))
    pg.click_sel('.cal-type-chip[data-cal-type="DB_DUMP"]')
    pg.ev("localStorage.clear()")

    # ---- D: defaults ----
    br.load('cal.html')
    open_today(pg)
    rows = pg.ev(DAY_ROWS)
    rec('D1', 'fresh profile: every type on, the Active (4) chip SELECTED = paused hidden, lead unfiltered, Reset hidden, today lists the 4 active tasks, summary says 4 shown',
        pg.ev(PRESSED) == 'EMAIL=true/on SNAPSHOT=true/on DROP_FILE=true/on DB_DUMP=true/on' and pg.ev("document.getElementById('calHidePaused').classList.contains('on') && document.getElementById('calHidePaused').getAttribute('aria-pressed') === 'true' && document.querySelector('#calHidePaused .chip-v').textContent === 'Active' && document.querySelector('#calHidePaused .chip-n').textContent === '4'")
        and not pg.ev("!!document.querySelector('#calHidePaused input')")
        and pg.ev(LEAD) == 'unfiltered' and pg.ev("document.getElementById('calFbReset').hidden") and len(rows) == 4 and 'email:Epsilon Paused' not in rows
        and pg.ev(SUMMARY) == '4 active · 2 paused tasks · 4 shown',
        'pressed=%s rows=%s summary=%s' % (pg.ev(PRESSED), rows, pg.ev(SUMMARY)))

    # ---- T: type chips ----
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    rows = pg.ev(DAY_ROWS)
    rec('T1', 'click Email: its chip reads off (aria-pressed=false), no email task in the day view, "1 filter on", Reset shown, the OFF set stored',
        rows == ['snapshot:Beta Snapshot', 'drop_file:Gamma Drop', 'db_dump:Delta Dump'] and pg.ev(PRESSED).startswith('EMAIL=false/off') and pg.ev(LEAD) == '1 filter on'
        and not pg.ev("document.getElementById('calFbReset').hidden") and pg.ev("localStorage.getItem('penumbra_cal_types_off')") == '["EMAIL"]'
        and pg.ev(SUMMARY) == '4 active · 2 paused tasks · 3 shown',
        'rows=%s pressed=%s lead=%s ls=%s' % (rows, pg.ev(PRESSED), pg.ev(LEAD), pg.ev("localStorage.getItem('penumbra_cal_types_off')")))
    br.load('cal.html')
    open_today(pg)
    rows = pg.ev(DAY_ROWS)
    rec('T2', 'reload: Email stays off (chip off before the first render, day view without it)',
        pg.ev(PRESSED).startswith('EMAIL=false/off') and rows == ['snapshot:Beta Snapshot', 'drop_file:Gamma Drop', 'db_dump:Delta Dump'] and pg.ev(LEAD) == '1 filter on',
        'pressed=%s rows=%s' % (pg.ev(PRESSED), rows))
    pg.click_sel('.cal-type-chip[data-cal-type="SNAPSHOT"]', shift=True)
    only = pg.ev(DAY_ROWS); only_p = pg.ev(PRESSED); only_lead = pg.ev(LEAD)
    pg.click_sel('.cal-type-chip[data-cal-type="SNAPSHOT"]', shift=True)
    back = pg.ev(DAY_ROWS)
    rec('T3', 'Shift+click Snapshot: only snapshots and the lead says ONE filter; Shift+click again: every type back on',
        only == ['snapshot:Beta Snapshot'] and only_p == 'EMAIL=false/off SNAPSHOT=true/on DROP_FILE=false/off DB_DUMP=false/off' and only_lead == '1 filter on'
        and len(back) == 4 and pg.ev(PRESSED) == 'EMAIL=true/on SNAPSHOT=true/on DROP_FILE=true/on DB_DUMP=true/on' and pg.ev(LEAD) == 'unfiltered'
        and pg.ev("localStorage.getItem('penumbra_cal_types_off')") == '[]',
        'only=%s/%s lead=%s back=%s' % (only, only_p, only_lead, back))

    # ---- Q: search ----
    type_text(pg, 'WEEKLY')
    rows = pg.ev(DAY_ROWS)
    rec('Q1', 'typing "WEEKLY" (case-insensitive, the title only - the short id is alpha1) leaves the one task, the x shows, "1 filter on", summary 1 shown',
        rows == ['email:Alpha Weekly Digest'] and not pg.ev("document.getElementById('calSearchClear').hidden") and pg.ev(LEAD) == '1 filter on'
        and pg.ev(SUMMARY) == '4 active · 2 paused tasks · 1 shown',
        'rows=%s lead=%s summary=%s' % (rows, pg.ev(LEAD), pg.ev(SUMMARY)))
    type_text(pg, '#4'); r_id = pg.ev(DAY_ROWS)
    type_text(pg, 'nc_x'); r_dest = pg.ev(DAY_ROWS)
    type_text(pg, 'asmith'); r_own = pg.ev(DAY_ROWS)
    type_text(pg, 'beta22'); r_short = pg.ev(DAY_ROWS)
    rec('Q2', 'search by #id, destination table, owner and short id',
        r_id == ['db_dump:Delta Dump'] and r_dest == ['db_dump:Delta Dump'] and r_own == ['snapshot:Beta Snapshot', 'drop_file:Gamma Drop'] and r_short == ['snapshot:Beta Snapshot'],
        'id=%s dest=%s own=%s short=%s' % (r_id, r_dest, r_own, r_short))
    before = pg.ev('location.href')
    pg.click_sel('#calSearch'); pg.key('Enter', 13); time.sleep(0.3)
    rec('Q3', 'Enter in the search box neither submits the GET form nor navigates',
        pg.ev('window.__submitted') == 0 and pg.ev('location.href') == before and pg.ev(DAY_ROWS) == ['snapshot:Beta Snapshot'],
        'submitted=%s href=%s' % (pg.ev('window.__submitted'), pg.ev('location.href')))
    pg.click_sel('#calSearchClear')
    rows = pg.ev(DAY_ROWS)
    rec('Q4', 'the x clears the search: 4 tasks again, x hidden, lead unfiltered, the page did not reload',
        len(rows) == 4 and pg.ev("document.getElementById('calSearchClear').hidden") and pg.ev(LEAD) == 'unfiltered' and pg.ev('window.__cleared.length') == 0
        and pg.ev("document.getElementById('calSearch').value") == '',
        'rows=%s cleared=%s' % (rows, pg.ev('window.__cleared')))

    # ---- H: hide paused ----
    pg.click_sel('#calHidePaused')
    rows = pg.ev(DAY_ROWS)
    rec('H1', 'deselect Active: the paused email and the every-minute snapshot join the day view (6), the chip reads deselected (.on gone / aria-pressed false), "1 filter on", Reset shown, the summary says 6 shown, nothing stored',
        len(set(rows)) == 6 and len(rows) == 24 + 5 and 'email:Epsilon Paused' in rows and 'snapshot:Zeta Every Minute' in rows and not pg.ev("document.querySelector('.cal-chip-paused').classList.contains('on')")
        and pg.ev("document.getElementById('calHidePaused').getAttribute('aria-pressed')") == 'false' and pg.ev(LEAD) == '1 filter on' and not pg.ev("document.getElementById('calFbReset').hidden")
        and pg.ev(SUMMARY) == '4 active · 2 paused tasks · 6 shown' and pg.ev("localStorage.getItem('penumbra_cal_hide_paused')") is None,
        'rows=%s summary=%s' % (rows, pg.ev(SUMMARY)))

    pg.ev("localStorage.setItem('penumbra_cal_hide_paused', '0')")   # a browser that toggled it under the old build
    br.load('cal.html')
    open_today(pg)
    rec('H2', 'a reload starts with Active SELECTED again (the chip is per-visit), even with a stale remembered "show paused" key, which is dropped',
        pg.ev("document.getElementById('calHidePaused').classList.contains('on')") and len(pg.ev(DAY_ROWS)) == 4
        and pg.ev("localStorage.getItem('penumbra_cal_hide_paused')") is None,
        'on=%s rows=%s key=%r' % (pg.ev("document.getElementById('calHidePaused').classList.contains('on')"), pg.ev(DAY_ROWS), pg.ev("localStorage.getItem('penumbra_cal_hide_paused')")))
    pg.click_sel('#calHidePaused')   # deselect Active again: E expects paused shown

    # ---- E: nothing matches ----
    type_text(pg, 'zzz-nothing')
    msg = pg.ev("(document.querySelector('#calDayView .cal-day-empty')||{}).textContent || ''")
    pg.click_sel('#calBack')
    today_chips = pg.ev("document.querySelectorAll('.cal-cell.today .cal-ev').length")
    rec('E1', 'no match: the day view says the filters are why; today\'s cell in the month grid is empty',
        msg == 'No tasks matching the current filters run on this day.' and today_chips == 0 and pg.ev("document.querySelector('.cal-cell.today').classList.contains('no-runs')"),
        'msg=%r chips=%s' % (msg, today_chips))

    # ---- R: reset ----
    pg.click_sel('.cal-type-chip[data-cal-type="DB_DUMP"]')
    pg.click_sel('#calFbReset')
    open_today(pg)
    rows = pg.ev(DAY_ROWS)
    rec('R1', 'Reset: every type on, Active back on (4 rows, like the types), the search empty, Reset hidden, lead unfiltered',
        pg.ev(PRESSED) == 'EMAIL=true/on SNAPSHOT=true/on DROP_FILE=true/on DB_DUMP=true/on' and pg.ev("document.getElementById('calSearch').value") == ''
        and pg.ev("document.getElementById('calFbReset').hidden") and pg.ev(LEAD) == 'unfiltered' and len(rows) == 4 and pg.ev("document.getElementById('calHidePaused').classList.contains('on')"),
        'pressed=%s rows=%s' % (pg.ev(PRESSED), rows))

    # ---- A: agenda (next 7 days) ----
    br.load('cal.html'); pg.ev("localStorage.clear()"); br.load('cal.html')
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    days = pg.ev("document.querySelectorAll('#calAgendaView .cal-ag-day').length")
    first = pg.ev("(document.querySelector('#calAgendaView .cal-ag-day b')||{}).textContent")
    rows0 = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day:first-child .cal-day-ev .cal-de-title')).map(function(e){return e.textContent;})")
    rec('A1', 'Next 7 days: agenda shows, 7 day rows, Today first with the 4 active tasks in time order, month hidden, the button pressed',
        pg.ev("document.getElementById('calAgendaView').style.display !== 'none'") and pg.ev("document.getElementById('calMonthView').style.display === 'none'")
        and days == 7 and first == 'Today' and rows0 == ['Alpha Weekly Digest', 'Beta Snapshot', 'Gamma Drop', 'Delta Dump']
        and pg.ev("document.querySelector('.cal-view-btn[data-cal-view=\"agenda\"]').getAttribute('aria-pressed')") == 'true',
        'days=%s first=%s rows=%s' % (days, first, rows0))
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    rows1 = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day:first-child .cal-day-ev .cal-de-title')).map(function(e){return e.textContent;})")
    type_text(pg, 'zzz-nothing')
    msg = pg.ev("(document.querySelector('#calAgendaView .cal-day-empty')||{}).textContent || ''")
    rec('A2', 'the agenda obeys the filter bar: Email off drops Alpha; no match -> the 7-day message',
        rows1 == ['Beta Snapshot', 'Gamma Drop', 'Delta Dump'] and msg == 'No tasks matching the current filters run in these 7 days.',
        'rows=%s msg=%r' % (rows1, msg))
    pg.click_sel('#calFbReset')
    pg.click_sel('#calAgendaView .cal-ag-day:first-child .cal-day-ev')
    in_day = pg.ev("document.getElementById('calDayView').style.display !== 'none' && document.getElementById('calAgendaView').style.display === 'none'")
    back_txt = pg.ev("document.getElementById('calBack').textContent")
    pg.click_sel('#calBack')
    rec('A3', 'a click on an agenda row opens that day; the Back button says "Back to list" and returns to the agenda',
        in_day and back_txt.strip().endswith('Back to list') and pg.ev("document.getElementById('calAgendaView').style.display !== 'none'")
        and pg.ev("document.querySelector('.cal-view-btn[data-cal-view=\"agenda\"]').classList.contains('on')"),
        'in_day=%s back=%r' % (in_day, back_txt))
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')

    # ---- A4: the agenda pages by a week ----
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    t0 = pg.ev("document.getElementById('calTitle').textContent")
    pg.click_sel('#calNext')
    t1 = pg.ev("document.getElementById('calTitle').textContent")
    first1 = pg.ev("(document.querySelector('#calAgendaView .cal-ag-day b')||{}).textContent")
    still = pg.ev("document.getElementById('calAgendaView').style.display === ''")
    pg.click_sel('#calPrev'); pg.click_sel('#calPrev')
    first2 = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day b')).map(function(b){return b.textContent;}).slice(-2)")
    pg.click_sel('#calToday')
    t3 = pg.ev("document.getElementById('calTitle').textContent")
    rec('A4', 'Next in the list pages 7 days ahead (stays a list, first row is a weekday, title moves); Prev twice lands on last week (ends Yesterday); Today brings the window back',
        still and t1 != t0 and first1 not in ('Today', 'Tomorrow') and first2[-1] == 'Yesterday' and t3 == t0,
        't0=%r t1=%r first1=%r first2=%s t3=%r' % (t0, t1, first1, first2, t3))
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')

    # ---- C: dropping the scope in calendar mode ----
    pg.ev("localStorage.clear()")
    pg.call('Page.navigate', url='http://127.0.0.1:%d/scope.html?report_id=alpha1&t=2&off=EMAIL&view=week' % br.hp)
    pg.wait("document.readyState === 'complete' && !!document.getElementById('calTitle')", 20000); time.sleep(0.3)
    pg.click_sel('#calFilterBar .chip-x[data-clear="report"]')
    pg.wait("location.search.indexOf('report_id') === -1 && document.readyState === 'complete' && !!document.getElementById('calTitle')", 8000); time.sleep(0.3)
    nav = pg.ev("location.pathname + location.search")
    rec('C1', 'the scope chip x (calendar mode): navigates to the bare calendar keeping the calendar own URL filters (off, view), dropping report_id - not the Metrics form serialisation',
        isinstance(nav, str) and nav.startswith('/scope.html?') and 'report_id' not in nav and 'filter_submitted' not in nav and 'off=EMAIL' in nav and 'view=week' in nav
        and pg.ev("document.getElementById('calWeekView').style.display === ''"),
        repr(nav))
    pg.call('Page.navigate', url='http://127.0.0.1:%d/empty.html?report_id=alpha1&t=3&off=EMAIL' % br.hp)
    pg.wait("document.readyState === 'complete' && !!document.getElementById('calTitle')", 20000); time.sleep(0.3)
    no_grid = not pg.ev("!!document.getElementById('calGrid')")
    pg.click_sel('#calFilterBar .chip-x[data-clear="report"]')
    pg.wait("location.search.indexOf('report_id') === -1 && document.readyState === 'complete'", 8000); time.sleep(0.3)
    nav2 = pg.ev("location.pathname + location.search")
    rec('C2', 'a scope that owns NO tasks (no grid, the script exits early): the x still goes to the bare calendar with off= kept - the live 10-08 bug',
        no_grid and isinstance(nav2, str) and 'report_id' not in nav2 and 'filter_submitted' not in nav2 and 'off=EMAIL' in nav2, 'nogrid=%s nav=%r' % (no_grid, nav2))
    pg.ev("localStorage.clear()")

    # ---- V: narrow viewport ----
    br.load('cal.html')
    pg.call('Emulation.setDeviceMetricsOverride', width=600, height=900, deviceScaleFactor=1, mobile=False)
    time.sleep(0.3)
    geo = pg.ev("(function(){ var b=document.getElementById('calFilterBar').getBoundingClientRect(), s=document.getElementById('calSearchBox').getBoundingClientRect(); return {vw: innerWidth, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, searchW: s.width, barW: b.width, searchInBar: s.left >= b.left && s.right <= b.right, cell: document.querySelector('#calGrid .cal-cell').getBoundingClientRect().width}; })()")
    pg.call('Emulation.clearDeviceMetricsOverride')
    rec('V1', 'at 600px: no horizontal scroll, the search box takes the bar\'s full width, grid cells narrow',
        geo['vw'] == 600 and not geo['hscroll'] and geo['searchW'] >= geo['barW'] - 40 and geo['searchInBar'] and geo['cell'] < 100, str(geo))

    # ---- A5: the agenda summarises per hour ----
    pg.click_sel('#calHidePaused')   # paused shown: Zeta (* * * * *) joins
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    ag = pg.ev("(function(){ var rows = Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day:first-child .cal-day-ev')); var zeta = rows.filter(function(r){ return r.querySelector('.cal-de-title').textContent === 'Zeta Every Minute'; }); return { rows: rows.length, zeta: zeta.length, firstTime: zeta.length ? zeta[0].querySelector('.cal-de-time').textContent : null, lastTime: zeta.length ? zeta[zeta.length-1].querySelector('.cal-de-time').textContent : null, label: document.querySelector('#calAgendaView .cal-ag-day:first-child .cal-ag-label').textContent }; })()")
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')
    pg.click_sel('#calHidePaused')   # Active back on
    rec('A5', 'an every-minute task takes 24 hourly rows in the agenda ("60 runs (:00–:59)"), not 1,440; the day label still counts every run',
        ag['zeta'] == 24 and ag['rows'] == 24 + 5 and ag['firstTime'] == '60 runs (:00–:59)' and ag['lastTime'] == '60 runs (:00–:59)' and '1445 runs' in ag['label'],
        str(ag))

    # ---- O: owner chip ----
    open_today(pg)
    pg.click_sel('#calDayView .cal-day-ev:nth-child(2) .cal-de-owner')   # Beta's "by asmith" (jdoe is the viewer: see Y1)
    rows = pg.ev(DAY_ROWS)
    chip = pg.ev("(document.getElementById('calOwnerChip')||{}).textContent || ''")
    rec('O1', 'click "by asmith": only asmith tasks, an Owner chip in the bar, "1 filter on", Reset shown',
        rows == ['snapshot:Beta Snapshot', 'drop_file:Gamma Drop'] and 'Owner' in chip and 'asmith' in chip and pg.ev(LEAD) == '1 filter on'
        and not pg.ev("document.getElementById('calFbReset').hidden"),
        'rows=%s chip=%r lead=%s' % (rows, chip, pg.ev(LEAD)))
    pg.click_sel('#calOwnerChip .chip-x')
    rec('O2', 'the chip\'s x lets go: 4 tasks, chip gone, unfiltered, no reload',
        len(pg.ev(DAY_ROWS)) == 4 and not pg.ev("!!document.getElementById('calOwnerChip')") and pg.ev(LEAD) == 'unfiltered' and pg.ev('window.__cleared.length') == 0,
        'rows=%s' % pg.ev(DAY_ROWS))

    # ---- Y: Owned by me ---- (today's day view is still open from O)
    mine0 = pg.ev("(function(){var b=document.getElementById('calMineChip'); return b ? [b.classList.contains('on'), b.getAttribute('aria-pressed'), b.querySelector('.chip-n').textContent, b.getAttribute('data-owner')] : null;})()")
    pg.click_sel('#calMineChip')
    rows = pg.ev(DAY_ROWS)
    mine1 = pg.ev("(function(){var b=document.getElementById('calMineChip'); return [b.classList.contains('on'), b.getAttribute('aria-pressed'), !!document.getElementById('calOwnerChip'), document.getElementById('calFbLead').textContent.trim()];})()")
    pg.click_sel('#calMineChip')
    rows2 = pg.ev(DAY_ROWS)
    pg.click_sel('#calDayView .cal-day-ev:nth-child(1) .cal-de-owner')   # Alpha: "by jdoe" = me, different case
    mine2 = pg.ev("(function(){var b=document.getElementById('calMineChip'); return [b.classList.contains('on'), !!document.getElementById('calOwnerChip')];})()")
    pg.click_sel('#calFbReset')
    mine3 = pg.ev("document.getElementById('calMineChip').classList.contains('on')")
    rec('Y1', 'Owned by me (viewer JDoe, 3 owned incl. the paused one): unselected at load with the count; a click keeps only jdoe\'s tasks and reads selected, the generic Owner chip stays away, "1 filter on"; a second click clears; "by jdoe" on a row selects it too (case-insensitive); Reset clears it',
        mine0 == [False, 'false', '3', 'JDoe'] and rows == ['email:Alpha Weekly Digest', 'db_dump:Delta Dump'] and mine1 == [True, 'true', False, '1 filter on']
        and len(rows2) == 4 and mine2 == [True, False] and mine3 is False,
        'mine0=%s rows=%s mine1=%s rows2=%s mine2=%s mine3=%s' % (mine0, rows, mine1, rows2, mine2, mine3))
    pg.click_sel('#calDayView .cal-day-ev:nth-child(2) .cal-de-owner')   # Beta: asmith
    other = pg.ev("(function(){var b=document.getElementById('calMineChip'); var c=document.getElementById('calOwnerChip'); return [b.classList.contains('on'), c ? c.textContent : null];})()")
    pg.click_sel('#calOwnerChip .chip-x')
    rec('Y2', 'another owner picked from a row: the Owner chip shows (asmith), Owned by me stays unselected',
        other == [False, 'Ownerasmith×'], str(other))

    nm0 = pg.ev("(function(){var b=document.getElementById('calNotMineChip'); return b ? [b.classList.contains('on'), b.querySelector('.chip-n').textContent] : null;})()")
    pg.click_sel('#calNotMineChip')
    rows = pg.ev(DAY_ROWS)
    nm1 = pg.ev("(function(){var b=document.getElementById('calNotMineChip'), m=document.getElementById('calMineChip'); return [b.classList.contains('on'), m.classList.contains('on'), !!document.getElementById('calOwnerChip'), document.getElementById('calFbLead').textContent.trim()];})()")
    pg.click_sel('#calMineChip')
    nm2 = pg.ev("(function(){var b=document.getElementById('calNotMineChip'), m=document.getElementById('calMineChip'); return [b.classList.contains('on'), m.classList.contains('on')];})()")
    rows2 = pg.ev(DAY_ROWS)
    pg.click_sel('#calNotMineChip')
    nm3 = pg.ev("(function(){var b=document.getElementById('calNotMineChip'), m=document.getElementById('calMineChip'); return [b.classList.contains('on'), m.classList.contains('on')];})()")
    pg.click_sel('#calFbReset')
    nm4 = pg.ev("document.getElementById('calNotMineChip').classList.contains('on')")
    rec('Y3', 'Not owned by me (3 of 6): unselected at load with the count; a click keeps the other owners\' tasks, "1 filter on", no Owner chip; Owned by me takes over (mutually exclusive) and back; Reset clears it',
        nm0 == [False, '3'] and rows == ['snapshot:Beta Snapshot', 'drop_file:Gamma Drop'] and nm1 == [True, False, False, '1 filter on']
        and nm2 == [False, True] and rows2 == ['email:Alpha Weekly Digest', 'db_dump:Delta Dump'] and nm3 == [True, False] and nm4 is False,
        'nm0=%s rows=%s nm1=%s nm2=%s rows2=%s nm3=%s nm4=%s' % (nm0, rows, nm1, nm2, rows2, nm3, nm4))
    x0 = pg.ev("document.getElementById('calSearch').getBoundingClientRect().left")
    type_text(pg, 'Al')
    x1 = pg.ev("document.getElementById('calSearch').getBoundingClientRect().left")
    reset_vis = pg.ev("(function(){var r=document.getElementById('calFbReset'); return [r.hidden, getComputedStyle(r).visibility, getComputedStyle(r).display];})()")
    pg.click_sel('#calSearchClear')
    x2 = pg.ev("document.getElementById('calSearch').getBoundingClientRect().left")
    reset_hid = pg.ev("(function(){var r=document.getElementById('calFbReset'); return [r.hidden, getComputedStyle(r).visibility, getComputedStyle(r).display];})()")
    rec('Y4', 'typing does not move the search box (the lead keeps its width, Reset is invisible rather than gone while nothing is on)',
        x0 == x1 == x2 and reset_vis[:2] == [False, 'visible'] and reset_hid[:2] == [True, 'hidden'] and reset_hid[2] != 'none',
        'x=%s/%s/%s vis=%s hid=%s' % (x0, x1, x2, reset_vis, reset_hid))
    pg.click_sel('#calHidePaused')
    x3 = pg.ev("document.getElementById('calSearch').getBoundingClientRect().left")
    gap = pg.ev("document.getElementById('calFbReset').getBoundingClientRect().left - document.getElementById('calSearch').getBoundingClientRect().right")
    pg.click_sel('#calHidePaused')
    rec('Y5', 'deselecting Active (the lead grows) does not move the box either; the box sits right against Reset (one auto margin, not two)',
        x3 == x0 and 0 <= gap <= 12, 'x0=%s x3=%s gap=%s' % (x0, x3, gap))

    # ---- U: filters in the URL ----
    pg.click_sel('.cal-type-chip[data-cal-type="SNAPSHOT"]')
    type_text(pg, 'Al')
    pg.click_sel('#calDayView .cal-day-ev .cal-de-owner')
    pg.click_sel('#calHidePaused')
    pg.click_sel('#calBack'); pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    qs = pg.ev('location.search')
    rec('U1', 'every filter rides in the URL (replaceState): off, q, owner, paused=1 (shown), view=agenda, and the page\'s own ?t= kept',
        'off=SNAPSHOT' in qs and 'q=Al' in qs and 'owner=jdoe' in qs and 'paused=1' in qs and 'view=agenda' in qs and 't=' in qs and pg.ev('window.__submitted') == 0,
        qs)
    pg.ev("localStorage.clear()")
    pg.call('Page.navigate', url='http://127.0.0.1:%d/cal.html?t=1&off=EMAIL,DB_DUMP&q=gamma&paused=1&view=agenda&notme=1' % br.hp)
    pg.wait("document.readyState === 'complete' && !!document.getElementById('calTitle')", 20000); time.sleep(0.3)
    rows = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day:first-child .cal-day-ev .cal-de-title')).map(function(e){return e.textContent;})")
    rec('U2', 'a bookmarked URL wins on load: Email + DB dump off, search "gamma" in the box, paused shown (Active deselected), agenda open, notme=1 lights Not owned by me, lead 4 filters on (the types are ONE filter, the status another)',
        pg.ev(PRESSED) == 'EMAIL=false/off SNAPSHOT=true/on DROP_FILE=true/on DB_DUMP=false/off' and pg.ev("document.getElementById('calSearch').value") == 'gamma'
        and not pg.ev("document.getElementById('calHidePaused').classList.contains('on')") and pg.ev("document.getElementById('calAgendaView').style.display !== 'none'")
        and rows == ['Gamma Drop'] and pg.ev(LEAD) == '4 filters on' and pg.ev("document.getElementById('calNotMineChip').classList.contains('on')"),
        'pressed=%s q=%s rows=%s lead=%s' % (pg.ev(PRESSED), pg.ev("document.getElementById('calSearch').value"), rows, pg.ev(LEAD)))
    pg.click_sel('#calFbReset')
    rec('U3', 'Reset clears off/q/owner AND the status from the URL and the bar; the view stays', 'off=' not in pg.ev('location.search') and 'q=' not in pg.ev('location.search')
        and 'view=agenda' in pg.ev('location.search') and 'paused=' not in pg.ev('location.search') and 'notme=' not in pg.ev('location.search') and pg.ev(LEAD) == 'unfiltered'
        and pg.ev("document.getElementById('calHidePaused').classList.contains('on')"), pg.ev('location.search'))
    pg.ev("localStorage.clear()")

    # ---- W: week view ----
    br.load('cal.html')
    pg.click_sel('.cal-view-btn[data-cal-view="week"]')
    title0 = pg.ev("document.getElementById('calTitle').textContent")
    cols = pg.ev("document.querySelectorAll('#calWeek .cal-cell').length")
    today_chips = pg.ev("document.querySelectorAll('#calWeek .cal-cell.today .cal-ev').length")
    more = pg.ev("document.querySelectorAll('#calWeek .cal-more').length")
    rec('W1', 'Week: 7 day columns, today holds all 4 active runs (no "+more" cap), week shown, month hidden, title is a date range',
        cols == 7 and today_chips == 4 and more == 0 and pg.ev("document.getElementById('calWeekView').style.display !== 'none'")
        and pg.ev("document.getElementById('calMonthView').style.display === 'none'") and ('–' in title0),
        'cols=%s today=%s more=%s title=%r' % (cols, today_chips, more, title0))
    pg.click_sel('#calNext')
    title1 = pg.ev("document.getElementById('calTitle').textContent")
    still_week = pg.ev("document.getElementById('calWeekView').style.display !== 'none'")
    no_today = pg.ev("document.querySelectorAll('#calWeek .cal-cell.today').length")
    pg.click_sel('#calToday')
    title2 = pg.ev("document.getElementById('calTitle').textContent")
    rec('W2', 'Next in week view moves one week (title changes, no today cell), Today brings this week back, still in week view',
        still_week and title1 != title0 and no_today == 0 and title2 == title0 and pg.ev("document.getElementById('calWeekView').style.display !== 'none'"),
        't0=%r t1=%r t2=%r' % (title0, title1, title2))
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    wk_after = pg.ev("Array.from(document.querySelectorAll('#calWeek .cal-cell.today .cal-ev')).map(function(e){return e.className.match(/cal-type-\\w+/)[0];})")
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    pg.click_sel('#calWeek .cal-cell.today')
    back_txt = pg.ev("document.getElementById('calBack').textContent")
    pg.click_sel('#calBack')
    rec('W3', 'the week obeys the filter bar; a day click opens it, "Back to week" returns to the week; view=week rides in the URL',
        wk_after == ['cal-type-snapshot', 'cal-type-drop_file', 'cal-type-db_dump'] and back_txt.strip().endswith('Back to week')
        and pg.ev("document.getElementById('calWeekView').style.display !== 'none'") and 'view=week' in pg.ev('location.search'),
        'after=%s back=%r url=%s' % (wk_after, back_txt, pg.ev('location.search')))
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')

    # ---- N: next run badge ----
    open_today(pg)
    tagged = pg.ev("Array.from(document.querySelectorAll('#calDayView .cal-day-ev')).filter(function(e){return !!e.querySelector('.cal-tag-next');}).map(function(e){return e.querySelector('.cal-de-title').textContent;})")
    pg.click_sel('#calBack')
    chip_next = pg.ev("Array.from(document.querySelectorAll('#calGrid .cal-cell.today .cal-ev.is-next .cal-ev-label')).map(function(e){return e.textContent;})")
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    ag_next = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day')).map(function(d,i){return Array.from(d.querySelectorAll('.cal-day-ev')).filter(function(e){return !!e.querySelector('.cal-tag-next');}).map(function(e){return i + ':' + e.querySelector('.cal-de-title').textContent;}).join(',');}).filter(Boolean)")
    pg.click_sel('#calHidePaused')
    ag_paused = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-day-ev')).filter(function(e){return !!e.querySelector('.cal-tag-next');}).map(function(e){return e.querySelector('.cal-de-title').textContent;})")
    pg.click_sel('#calHidePaused')
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')
    rec('N1', 'next run: Alpha (NEXT_RUN today 8:00) is tagged in the day view and marked in the month chip; Delta is tagged on TOMORROW\'s agenda row only; a paused task\'s stale NEXT_RUN is never tagged',
        tagged == ['Alpha Weekly Digest'] and chip_next == ['Alpha Weekly Digest'] and ag_next == ['0:Alpha Weekly Digest', '1:Delta Dump']
        and ag_paused == ['Alpha Weekly Digest', 'Delta Dump'],
        'day=%s chip=%s agenda=%s withpaused=%s' % (tagged, chip_next, ag_next, ag_paused))

    # ---- L: the controls line up under the app's global button rule ----
    type_text(pg, 'a')
    geo = pg.ev("""(function(){ var i=document.getElementById('calSearchBox').getBoundingClientRect(), x=document.getElementById('calSearchClear').getBoundingClientRect(); var cs=getComputedStyle(document.getElementById('calSearchBox')); var ins=getComputedStyle(document.getElementById('calSearch'));
        var vb=Array.from(document.querySelectorAll('.cal-view-btn')).map(function(b){var r=b.getBoundingClientRect(); return [r.top,r.height,getComputedStyle(b).borderRadius, getComputedStyle(b).marginTop];});
        var chips=Array.from(document.querySelectorAll('#calFilterBar .chip')).map(function(c){var r=c.getBoundingClientRect(); return [r.top+r.height/2, getComputedStyle(c).marginTop];});
        return {xmid: x.top + x.height/2, imid: i.top + i.height/2, inside: x.left >= i.left && x.right <= i.right && x.top >= i.top && x.bottom <= i.bottom, vb: vb, chips: chips,
                shape: [cs.borderRadius, Math.round(i.height), !!document.querySelector('#calSearchBox svg'), ins.borderTopWidth, ins.borderRadius, cs.borderTopColor === getComputedStyle(document.body).getPropertyValue('--brand-primary').trim() || cs.borderTopColor]}; })()""")
    pg.click_sel('#calSearchClear')
    vb = geo['vb']; chips = geo['chips']
    mids = [c[0] for c in chips]
    rec('L1', 'search box: the admin tools\' shape (5px radius, 26px tall, magnifier at the left, borderless input inside, brand border while it holds text); the × centred inside it',
        abs(geo['xmid'] - geo['imid']) <= 1.5 and geo['inside'] and geo['shape'][0] == '5px' and geo['shape'][1] == 26 and geo['shape'][2] is True and geo['shape'][3] == '0px' and geo['shape'][4] == '0px',
        'xmid=%.1f imid=%.1f inside=%s shape=%s' % (geo['xmid'], geo['imid'], geo['inside'], geo['shape']))
    rec('L2', 'view switch: the three buttons share one top and height, square corners, no margin-top',
        len(vb) == 3 and len(set(round(b[0]) for b in vb)) == 1 and len(set(round(b[1]) for b in vb)) == 1 and all(b[2] == '0px' and b[3] == '0px' for b in vb), str(vb))
    open_today(pg); pg.click_sel('#calDayView .cal-day-ev:nth-child(2) .cal-de-owner')   # asmith (jdoe = the viewer -> no Owner chip)
    ox = pg.ev("(function(){var x=document.querySelector('#calOwnerChip .chip-x'), c=document.getElementById('calOwnerChip'); if(!x) return null; var r=x.getBoundingClientRect(), cr=c.getBoundingClientRect(); return [getComputedStyle(x).marginTop, Math.abs((r.top+r.height/2)-(cr.top+cr.height/2))];})()")
    pg.click_sel('#calOwnerChip .chip-x'); pg.click_sel('#calBack')
    rec('L4', 'the owner chip x: no margin-top from the global button rule, centred in its chip', ox is not None and ox[0] == '0px' and ox[1] <= 1.5, str(ox))
    dark = pg.ev("(function(){ document.body.classList.add('theme-wolfpack-dark'); var cs = getComputedStyle(document.getElementById('calSearch')); var out = [cs.borderTopWidth, cs.backgroundColor]; document.body.classList.remove('theme-wolfpack-dark'); return out; })()")
    rec('L5', 'under a dark theme (its input[type=search] rule is !important at higher specificity) the inner input stays borderless and transparent: the box is the field',
        dark[0] == '0px' and dark[1] in ('rgba(0, 0, 0, 0)', 'transparent'), str(dark))
    rec('L3', 'bar chips (types, paused): one baseline, no margin-top', len(mids) >= 5 and max(mids) - min(mids) <= 1.5 and all(c[1] == '0px' for c in chips), str(chips))

    # ---- D2: midnight roll-over ----
    br.load('cal.html')
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]')
    t0 = pg.ev("document.getElementById('calTitle').textContent")
    lab0 = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day b')).map(function(b){return b.textContent;}).slice(0,2)")
    pg.ev("window.__fakeNow = Date.now() + 86400000; document.dispatchEvent(new Event('visibilitychange'))")
    time.sleep(0.3)
    t1 = pg.ev("document.getElementById('calTitle').textContent")
    lab1 = pg.ev("Array.from(document.querySelectorAll('#calAgendaView .cal-ag-day b')).map(function(b){return b.textContent;}).slice(0,2)")
    pg.click_sel('.cal-view-btn[data-cal-view="month"]')
    today_num = pg.ev("(document.querySelector('#calGrid .cal-cell.today .cal-daynum')||{}).textContent")
    real_next = pg.ev("new Date(window.__fakeNow).getDate() + ''")
    pg.click_sel('.cal-view-btn[data-cal-view="week"]')
    wk_today = pg.ev("document.querySelectorAll('#calWeek .cal-cell.today').length")
    pg.ev("window.__fakeNow = null")
    rec('D2', 'a tab left open past midnight: when it comes back into view the agenda starts on the NEW today (title moves a day, labels still Today / Tomorrow), the month and week today-cells move with it',
        lab0 == ['Today', 'Tomorrow'] and lab1 == ['Today', 'Tomorrow'] and t1 != t0 and today_num == real_next and wk_today == 1,
        't0=%r t1=%r lab0=%s lab1=%s cell=%r expect=%r wk=%s' % (t0, t1, lab0, lab1, today_num, real_next, wk_today))
    br.load('cal.html')
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); pg.click_sel('#calNext')
    t2 = pg.ev("document.getElementById('calTitle').textContent")
    pg.ev("window.__fakeNow = Date.now() + 86400000; document.dispatchEvent(new Event('visibilitychange'))")
    time.sleep(0.3)
    t3 = pg.ev("document.getElementById('calTitle').textContent")
    pg.ev("window.__fakeNow = null")
    rec('D3', 'a paged agenda is left where the user put it when the day rolls', t2 == t3, 't2=%r t3=%r' % (t2, t3))

    # ---- K: "/" focuses the search ----
    br.load('cal.html')
    pg.ev("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    pg.call('Input.dispatchKeyEvent', type='keyDown', key='/', code='Slash', text='/', unmodifiedText='/', windowsVirtualKeyCode=191)
    pg.call('Input.dispatchKeyEvent', type='keyUp', key='/', code='Slash', windowsVirtualKeyCode=191)
    time.sleep(0.2)
    focused = pg.ev("document.activeElement === document.getElementById('calSearch')")
    val = pg.ev("document.getElementById('calSearch').value")
    pg.call('Input.insertText', text='a/b'); time.sleep(0.2)
    rec('K1', '"/" from the page focuses the search without typing a slash; a slash typed INSIDE the box stays text',
        focused and val == '' and pg.ev("document.getElementById('calSearch').value") == 'a/b', 'focused=%s val=%r now=%r' % (focused, val, pg.ev("document.getElementById('calSearch').value")))
    pg.click_sel('#calSearchClear')

    # ---- M: month grid ---- (Active is selected again after R1)
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    cls = pg.ev("Array.from(document.querySelectorAll('.cal-cell.today .cal-ev')).map(function(e){return e.className.match(/cal-type-\\w+/)[0];})")
    more = pg.ev("(document.querySelector('.cal-cell.today .cal-more')||{}).textContent || ''")
    rec('M1', 'month grid, paused hidden + Email off: today shows the 3 other types and no "+more"',
        cls == ['cal-type-snapshot', 'cal-type-drop_file', 'cal-type-db_dump'] and more == '',
        'cls=%s more=%r' % (cls, more))
    pg.click_sel('.cal-type-chip[data-cal-type="EMAIL"]')
    cls = pg.ev("Array.from(document.querySelectorAll('.cal-cell.today .cal-ev')).map(function(e){return e.className.match(/cal-type-\\w+/)[0];})")
    more = pg.ev("(document.querySelector('.cal-cell.today .cal-more')||{}).textContent || ''")
    rec('M2', 'Email back on: 3 chips + "+1 more" (MAX_CHIPS unchanged)', len(cls) == 3 and more == '+1 more', 'cls=%s more=%r' % (cls, more))
    pg.ev("localStorage.clear()")

# --------------------------------------------------------------------- main
def run_build(label, src_text, mutant=None):
    global R
    R = []
    run, text = stage(src_text, mutant)
    br = None
    try:
        br = Browser(run)
        checks(br, text)
    except Exception as e:
        rec('X0', 'harness', False, repr(e))
    finally:
        if br: br.close()
        shutil.rmtree(run, ignore_errors=True)
    npass = sum(1 for r in R if r['pass']); nfail = len(R) - npass
    print('== %s ==' % label)
    for r in R: print('%s %-3s %s%s' % ('ok  ' if r['pass'] else 'FAIL', r['id'], r['name'], '' if r['pass'] else '   -> ' + r['detail']))
    print('SUMMARY  pass=%d  fail=%d' % (npass, nfail))
    return [r['id'] for r in R if not r['pass']]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--control', action='store_true'); ap.add_argument('--stage'); ap.add_argument('--mutant'); ap.add_argument('--mutants', action='store_true')
    a = ap.parse_args()
    src = os.path.join(APP, 'analytics_all.php')
    if a.stage: src = a.stage
    if a.control: src = bak_path(os.path.join(APP, 'analytics_all.php.bak-' + STAMP)) or os.path.join(APP, 'analytics_all.php.bak-' + STAMP)
    text = read(src)
    if a.mutants or a.mutant:
        names = list(MUTANTS) if a.mutants else [a.mutant]
        for n in names:
            old = MUTANTS[n][0]
            if text.count(old) != 1: print('ANCHOR %s: found %d times' % (n, text.count(old))); sys.exit(2)
        bad = 0
        for n in names:
            red = set(run_build('mutant ' + n, text, n)); must = set(MUTANTS[n][2])
            if not must <= red: print('MUTANT %s SURVIVED: must=%s red=%s' % (n, sorted(must), sorted(red))); bad += 1
            else: print('MUTANT %s killed (%s)' % (n, ' '.join(sorted(red))))
        sys.exit(1 if bad else 0)
    fails = run_build('control' if a.control else ('stage ' + src if a.stage else 'live'), text)
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
