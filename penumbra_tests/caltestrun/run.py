# =============================================================================
# CALENDAR STATUS DOT + TEST RUN SUITE (2026-10-22): every Day / Agenda row on
# calendar.php carries the Repository's status dot (left; toggle_status) and a
# Test run button (right; run_now) whose hover card shows the task's details. A
# test run is real, so the button asks first, in place ("Email 2 recipients
# now?  Run test / Cancel"). Since tgltest (2026-10-22) a queued test no
# longer locks the dot: toggle_status settles it (a pause cancels the test).
#
# calfix (2026-11-04) closes the 10-22 review: the ask counts subscribers and
# drops opted-out recipients; a held / double Enter or click cannot send the
# test (focus on Cancel, repeat keys and detail>1 ignored, a 400 ms guard); the
# dot and the test share one busy flag; the card divides by density zoom, opens
# on keyboard focus only, is hoverable, follows a scroll and leaves no stale
# aria-describedby; "Test queued" keeps its surface under a theme's hover fill;
# a poll pickup keeps focus; the confirm belongs to ONE row and a render drops
# it; the live region exists at load; label-in-name; a print rule; the Active
# chip's tooltip count follows; an offline runner is named; "queued" needs
# IS_ACTIVE = 1 and a near NEXT_RUN; the poll asks by the stored REPORT_ID and
# reads IS_ACTIVE / NEXT_RUN back, in one loop; an enable without next_run
# drops the stale one.
#
# WHAT IS UNDER TEST: analytics_all.php, staged by calfilter's harness (the
# calendar CSS / templates / script LIFTED by anchors, rendered by the real PHP
# 8.2 CLI, driven in headless Edge over CDP with real mouse and keys). fetch()
# is stubbed before the page runs: every POST is recorded and answered from
# window.__reply. setTimeout(fn, 30000) is cut to 60 ms so the queued-test poll
# runs inside the suite.
#
#   PH*  the PHP task loop (lifted, run over fixture rows)
#   D*   the row: dot first, Test run last; a queued task reads "Test queued"
#   L*   the live region exists before anything is said
#   H*   the hover card
#   C*   the confirm
#   S*   the dot
#   R*   CSS: a theme's hover fill, print, the dot's colour
#   A*   agenda
#   P*   the poll
#
#   py -3 run.py                 the live analytics_all.php
#   py -3 run.py --stage <file>  a staged one          EXPECTED: GREEN
#   py -3 run.py --stage <file> --mutants
# Needs calfilter\run.py next door (or CALFILTER_RUN pointing at it).
# =============================================================================
import argparse, datetime, importlib.util, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
CFP = os.environ.get('CALFILTER_RUN') or os.path.join(HERE, '..', 'calfilter', 'run.py')
spec = importlib.util.spec_from_file_location('calfilter', CFP)
cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)

TODAY = datetime.date.today()
D = TODAY.strftime('%Y-%m-%d')
FIXTURE = [
    {'id': 1, 'type': 'EMAIL',    'cron': '0 8 * * *',  'short': 'alpha1', 'rid': 'alpha1', 'title': 'Alpha Weekly Digest', 'subject': 'Digest', 'recipCount': 2, 'subCount': 3, 'owner': 'jdoe',   'active': 1, 'next': D + ' 08:00:00', 'last': D + ' 07:00:00', 'detail': '', 'cond': 0, 'pending': 0},
    {'id': 2, 'type': 'SNAPSHOT', 'cron': '0 9 * * *',  'short': 'beta22', 'rid': 'B22LEG', 'title': 'Beta Snapshot',       'subject': None,     'recipCount': 0, 'subCount': 0, 'owner': 'asmith', 'active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 1},
    {'id': 4, 'type': 'DB_DUMP',  'cron': '0 10 * * *', 'short': 'del4',   'rid': 'del4',   'title': 'Delta Dump',          'subject': None,     'recipCount': 0, 'subCount': 0, 'owner': 'jdoe',   'active': 1, 'next': None, 'last': None, 'detail': 'NC_X.T1', 'cond': 0, 'pending': 0},
    {'id': 5, 'type': 'EMAIL',    'cron': '0 11 * * *', 'short': 'eps5',   'rid': 'eps5',   'title': 'Epsilon Paused',      'subject': 'Old',    'recipCount': 1, 'subCount': 0, 'owner': 'jdoe',   'active': 0, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 0},
    {'id': 7, 'type': 'EMAIL',    'cron': '0 13,15 * * *', 'short': 'mul7', 'rid': 'mul7',  'title': 'Mu Twice Daily',      'subject': 'Twice',  'recipCount': 1, 'subCount': 0, 'owner': 'jdoe',   'active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 0},
    {'id': 8, 'type': 'SNAPSHOT', 'cron': '0 14 * * *', 'short': 'eta8',   'rid': 'eta8',   'title': 'Eta Paused Stale',    'subject': None,     'recipCount': 0, 'subCount': 0, 'owner': 'jdoe',   'active': 0, 'next': D + ' 14:00:00', 'last': None, 'detail': '', 'cond': 0, 'pending': 0},
    {'id': 9, 'type': 'SNAPSHOT', 'cron': '0 16 * * *', 'short': None,     'rid': 'iota9',  'title': None,                  'subject': None,     'recipCount': 0, 'subCount': 0, 'owner': 'jdoe',   'active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 1},
]

MUTANTS = {
    # (pre-calfix suite's set, re-anchored)
    'noconfirm': ("            t._testAsk = rowKey; t._askAt = Date.now(); t._msg = null; calRepaintTask(t, '.cal-de-cancel');",
                  "            t._testAsk = false; calSchedPost({ action: 'run_now', task_id: t.id });", ['C1']),
    'norevert':  ("        if ($active && is_array($opts) && !empty($opts['_test_run_revert_disable'])) $active = 0;\n", "", ['PH1']),
    'nopending': ("            'pending'    => $pending ? 1 : 0,", "            'pending'    => 0,", ['PH1']),
    'lockback':  ("            if (t._dotBusy) return;\n            var want", "            if (t.pending || t._dotBusy) return;\n            var want", ['S4']),   # = tgltest's callock anchor, unchanged
    'dotwaits':  ("            if (t._testBusy) return;   // one request per task", "            if (false) return;   // one request per task", ['S7']),
    'nocancel':  ("                    if (resp.test_run_cancelled) t.pending = 0;\n", "", ['S4']),
    'nostop':    ("        wrap.addEventListener('click', function (e) { e.stopPropagation(); });\n", "", ['A1']),
    'norebuild': ("                            box._rebuild = mk;\n", "", ['A2']),
    'nocount':   ("                    calRecount();\n", "", ['S1']),
    'notitle':   ("        wrap.title = '';", "", ['H1']),
    'nonext':    ("                    if (want) t.next = resp.next_run || null;\n", "", ['S2']),
    'noescape':  ("if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }", "if (e.key === 'Escape') { }", ['C2']),
    'nopoll':    ("                x.pending = 0;\n", "", ['P1']),
    # calfix (2026-11-04)
    'nonear':    (" && $active === 1 && !empty($r['NEXT_NEAR']);", ";", ['PH1']),
    'nosupp':    ("                if (isset($supSet[$p])) continue;\n", "", ['PH2']),
    'nosubs':    ("                    $subSeen[$se] = true; $subCount++;", "                    $subSeen[$se] = true;", ['PH2']),
    'norid':     ("            'rid'        => isset($r['REPORT_ID']) ? trim((string)$r['REPORT_ID']) : '',", "            'rid'        => '',", ['PH2']),
    'nowho':     ("        if (t.type === 'EMAIL') s = calWho(t) ? 'Email ' + calWho(t) + ' now?' : 'Send this email now?';",
                  "        if (t.type === 'EMAIL') s = t.recipCount ? 'Email ' + t.recipCount + ' recipient' + (t.recipCount === 1 ? '' : 's') + ' now?' : 'Send this email now?';", ['C1']),
    'focusrun':  ("t._msg = null; calRepaintTask(t, '.cal-de-cancel');", "t._msg = null; calRepaintTask(t, '.cal-de-run');", ['C1']),
    'noguard':   ("Date.now() - (t._askAt || 0) < 400 || ", "", ['C6']),
    'norepeat':  ("            run.addEventListener('keydown', function (e) { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });\n", "", ['C6']),
    'nodetail':  ("                if ((e && e.detail > 1) || Date.now()", "                if (Date.now()", ['C6']),
    'askall':    ("        if (t._testAsk && t._testAsk === rowKey) {", "        if (t._testAsk) {", ['C7']),
    'nooffline': ("        else if (calRunnerOffline()) s += ' The scheduler is not responding: it runs when the scheduler is back.';\n", "", ['C5']),
    'nobusy':    ("            if (t.pending || calBusy(t) || (e && e.detail > 1)) return;", "            if (t.pending || t._testBusy || (e && e.detail > 1)) return;", ['S5']),
    'nonull':    ("                    if (want) t.next = resp.next_run || null;", "                    if (want && resp.next_run) t.next = resp.next_run;", ['S6']),
    'nochip':    ("        if (hc) hc.title = 'Only active tasks", "        if (false) hc.title = 'Only active tasks", ['S1']),
    'nozoom':    ("        var z = (typeof window.pnbZoom === 'function') ? window.pnbZoom() : 1;", "        var z = 1;", ['H5']),
    'nohover':   ("            calCard.addEventListener('mouseenter', function () { if (calCardTimer) { clearTimeout(calCardTimer); calCardTimer = null; } });\n", "", ['H3']),
    'nostale':   ("        if (calCardBtn && calCardBtn !== btn) calCardBtn.removeAttribute('aria-describedby');\n", "", ['H3']),
    'nofv':      ("            if (kb) calShowCard(btn, t);", "            calShowCard(btn, t);", ['H4']),
    'noscroll':  ("        if (!r || r.bottom < 0 || r.top > document.documentElement.clientHeight) calHideCard(); else calPlaceCard();", "        calHideCard();", ['H6']),
    'nolive':    ("    calEnsureLive();\n    function calSay", "    function calSay", ['L1']),
    'nolabel':   ("        btn.setAttribute('aria-label', word + ': ' + taskLabel(t)", "        btn.setAttribute('aria-label', 'Test run: ' + taskLabel(t)", ['D2']),
    'nowolf':    ("    .cal-day-ev .cal-de-test button[aria-disabled=\"true\"]:hover { background: var(--bg-surface);", "    .cal-day-ev .cal-de-test button[aria-disabled=\"true\"]:hover { ", ['R1']),
    'noprint':   ("    @media print { .cal-day-ev .cal-de-dot, .cal-day-ev .cal-de-test, .cal-task-card { display: none !important; } }\n", "", ['R2']),
    'nopollrid': ("        waiting.forEach(function (x) { shorts[x.rid || x.short] = true; });", "        waiting.forEach(function (x) { shorts[x.short] = true; });", ['P1']),
    'nokeepfocus': ("        if (!focusSel && focusAt >= 0 && act && act.className) focusSel = '.' + String(act.className).split(' ')[0];\n", "", ['P2']),
    'noreadback': ("                x.next = r.NEXT_RUN || null;\n", "", ['P3']),
    'noisactive': ("                if (o && o._test_run_pending && String(r.IS_ACTIVE) === '1') return;", "                if (o && o._test_run_pending) return;", ['P4']),
}

R = []
def rec(i, name, ok, detail=''):
    R.append({'id': i, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:600]})

# ---- PH: the PHP task loop, lifted and run over fixture rows ----
def run_loop(loop, rows):
    src = ("<?php\n$rows = json_decode(getenv('PH_ROWS'), true); $schedTasks = array(); $currentUserKey = 'jdoe';\n"
           "$schedTypeLabels = array('EMAIL' => 'Email Report', 'SNAPSHOT' => 'Take a Snapshot');\n"
           "$schedActiveCount = 0; $schedPausedCount = 0; $schedMineCount = 0; $schedTypeCounts = array('EMAIL' => 0, 'SNAPSHOT' => 0);\n"
           "try {\n" + loop + "} catch (Exception $e) {}\n"
           "echo json_encode(array('t' => $schedTasks, 'a' => $schedActiveCount, 'p' => $schedPausedCount));\n")
    d = tempfile.mkdtemp(prefix='pnb_ctr_')
    try:
        p = os.path.join(d, 'loop.php')
        with open(p, 'w', encoding='utf-8') as f: f.write(src)
        out = subprocess.run([cf.PHP, '-n', '-d', 'display_errors=1', '-d', 'error_reporting=-1', p], capture_output=True, env=dict(os.environ, PH_ROWS=json.dumps(rows)))
        txt = out.stdout.decode('utf-8', 'replace')
        try: return json.loads(txt), txt
        except Exception: return None, txt
    finally:
        shutil.rmtree(d, ignore_errors=True)

def php_checks(text):
    try:
        loop = cf.cut(text, "    foreach ($rows as $r) {\n        $opts = json_decode(isset($r['OPTIONS'])",
                      "} catch (Exception $e) { error_log(\"analytics_all scheduled-tasks", 'task loop')
    except Exception as e:
        rec('PH1', 'task loop', False, repr(e)); rec('PH2', 'task loop', False, repr(e)); return
    rows = [
        {'ID': 1, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'OPTIONS': '{"_test_run_pending":true}', 'RECIPIENTS': 'a@x', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '1'},
        {'ID': 2, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'OPTIONS': '{"_test_run_pending":true,"_test_run_revert_disable":true}', 'RECIPIENTS': 'a@x', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '1'},
        {'ID': 3, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 1, 'OPTIONS': '{}', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0'},
        {'ID': 4, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 0, 'OPTIONS': '', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0'},
        {'ID': 5, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 1, 'OPTIONS': '{"_test_run_pending":true}', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0'},
        {'ID': 6, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 0, 'OPTIONS': '{"_test_run_pending":true}', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '1'},
    ]
    got, txt = run_loop(loop, rows)
    sm = None
    if got: sm = {'t': [[t['id'], t['active'], t.get('pending')] for t in got['t']], 'a': got['a'], 'p': got['p']}
    exp = {'t': [[1, 1, 1], [2, 0, 1], [3, 1, 0], [4, 0, 0], [5, 1, 0], [6, 0, 0]], 'a': 3, 'p': 3}
    rec('PH1', 'task loop: "queued" = the marker on a row the runner can still pick up (IS_ACTIVE = 1, NEXT_RUN near); a queued test on a paused task still reads paused; a stranded marker (far NEXT_RUN, inactive row) is not queued',
        sm == exp, 'got=%s' % (sm if sm is not None else txt[:400]))
    subs = [{'email': 'jdoe@ncsu.edu'}, {'email': 'z@x.edu'}, {'email': 'Z@x.edu'}, {'email': ''}, 'bad']
    rows2 = [
        {'ID': 11, 'REPORT_ID': ' 123 ', 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'RECIPIENTS': 'a@x.edu; jdoe, Jane <B@x.edu>; c@x.edu,,', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0',
         'OPTIONS': json.dumps({'suppressed': ['C@X.EDU'], 'subscriptions_enabled': True, 'subscribers': subs})},
        {'ID': 12, 'REPORT_ID': 'abc12', 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'RECIPIENTS': 'a@x.edu; jdoe, Jane <B@x.edu>; c@x.edu', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0',
         'OPTIONS': json.dumps({'suppressed': ['c@x.edu'], 'subscriptions_enabled': False, 'subscribers': subs})},
        {'ID': 13, 'REPORT_ID': 'abc13', 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 1, 'RECIPIENTS': 'a@x.edu', 'OWNER_ID': 'jdoe', 'NEXT_NEAR': '0', 'OPTIONS': '{}'},
    ]
    got, txt = run_loop(loop, rows2)
    sm = [[t['id'], t.get('recipCount'), t.get('subCount'), t.get('rid')] for t in got['t']] if got else None
    exp = [[11, 3, 1, '123'], [12, 3, 0, 'abc12'], [13, 0, 0, 'abc13']]
    rec('PH2', 'task loop: recipients = typed minus opted-out (Unity IDs and "Name <a@b>" resolved, case-blind); subscribers counted only with subscriptions on, once per address and not when typed; rid = the stored REPORT_ID',
        sm == exp, 'got=%s' % (sm if sm is not None else txt[:400]))

STUB = r'''
window.__posts = []; window.__gets = []; window.__mode = {}; window.__errs = []; window.__listN = 0;
window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rej: ' + String(e.reason && (e.reason.stack || e.reason))); });
window.__reply = function (p) {
  if (p.action === 'run_now') return window.__mode.run || {status: 'success', message: 'Test run queued - it will execute within ~5 minutes on the next scheduler cycle, then resume its normal schedule.', test_run_pending: true};
  if (p.action === 'toggle_status') return window.__mode.toggle || {status: 'success', message: p.new_status === '1' ? 'Task enabled. Next run: x' : 'Task disabled.', next_run: window.__mode.next_run || null};
  return {status: 'error', message: 'unexpected'};
};
window.fetch = function (url, opts) {
  opts = opts || {};
  if ((opts.method || 'GET') === 'POST') {
    var p = {}; new URLSearchParams(opts.body).forEach(function (v, k) { p[k] = v; });
    p.__csrf = (opts.headers || {})['X-Penumbra-Csrf'] || '';
    window.__posts.push(p);
    var body = window.__reply(p);
    return new Promise(function (res) { setTimeout(function () { res({ json: function () { return Promise.resolve(body); } }); }, 40); });
  }
  window.__gets.push(String(url));
  window.__listN++;
  var l = window.__mode.lists ? (!window.__mode.flip ? window.__mode.lists[0] : window.__mode.lists[1]) : (window.__mode.list || {status: 'success', data: []});
  return Promise.resolve({ json: function () { return Promise.resolve(l); } });
};
(function () { var st = window.setTimeout; window.setTimeout = function (fn, ms) { if (ms === 30000) ms = 60; return st.apply(window, [fn, ms].concat([].slice.call(arguments, 2))); }; })();
'''

ROW = "(function(id){ return document.querySelector('#calDayView .cal-day-ev[data-task-id=\"' + id + '\"]'); })"
def row_info(pg, tid):
    return pg.ev(ROW + "(%d) ? (function(b){ var d=b.querySelector('.cal-de-dot'), t=b.querySelector('.cal-de-test'), btn=t&&t.querySelector('button'); return {first: b.firstElementChild===d, role: d&&d.getAttribute('role'), checked: d&&d.getAttribute('aria-checked'), dotDis: d&&d.getAttribute('aria-disabled'), last: !!t && (b.lastElementChild===t || (b.lastElementChild.className==='cal-de-err' && b.lastElementChild.previousElementSibling===t)), text: t?t.textContent.replace(/\\s+/g,' ').trim():'', btnDis: btn&&btn.getAttribute('aria-disabled'), label: btn&&btn.getAttribute('aria-label'), paused: b.classList.contains('paused'), err: (b.querySelector('.cal-de-err')||{}).textContent||'', next: !!b.querySelector('.cal-tag-next'), wrapTitle: t?t.getAttribute('title'):null}; })(" % tid + ROW + "(%d)) : null" % tid)

CARD_ON = "(function(){var c=document.getElementById('calTaskCard'); return !!c && !c.hidden;})()"
def kb_focus(pg, sel):
    # A key press first, so a programmatic focus counts as keyboard (:focus-visible).
    pg.key('Shift', 16)
    pg.ev("document.querySelector(%s).focus()" % json.dumps(sel)); time.sleep(0.1)

def show_all_today(br):
    pg = br.pg
    br.load('cal.html')
    pg.ev("localStorage.clear()")
    br.load('cal.html')
    if pg.ev("!!document.getElementById('calHidePaused')"): pg.click_sel('#calHidePaused')
    cf.open_today(pg)

def hover(pg, sel):
    c = pg.center(sel)
    if not c: raise RuntimeError('not drawn: ' + sel)
    pg.mouse('mouseMoved', c[0], c[1]); return c

def away(pg, s=0.4):
    pg.mouse('mouseMoved', 5, 5); time.sleep(s)

def checks(br, text):
    pg = br.pg
    php_checks(text)
    pg.call('Page.addScriptToEvaluateOnNewDocument', source=STUB)
    show_all_today(br)
    posts = lambda: pg.ev("window.__posts.length")

    # ---- L ----
    lv = pg.ev("(function(){var l=document.getElementById('calTaskLive'); return l ? [l.getAttribute('role'), l.getAttribute('aria-live')] : null;})()")
    rec('L1', 'the live region (role=status, polite) is in the page from load, before anything is announced', lv == ['status', 'polite'], 'live=%s' % lv)

    # ---- D ----
    r1, r5 = row_info(pg, 1), row_info(pg, 5)
    rec('D1', 'a row: the status dot comes first (role=switch, aria-checked = active), the Test run control last; a paused task\'s dot is unchecked',
        r1 and r1['first'] and r1['role'] == 'switch' and r1['checked'] == 'true' and r1['last'] and 'Test run' in r1['text']
        and r5 and r5['checked'] == 'false' and r5['paused'], 'r1=%s r5=%s' % (r1, r5))
    r2 = row_info(pg, 2)
    t2 = pg.ev("document.querySelector('#calDayView .cal-day-ev[data-task-id=\"2\"] .cal-de-dot').title")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="2"] .cal-de-test button'); time.sleep(0.2)
    rec('D2', 'a queued test: "Test queued" (aria-disabled; its accessible name starts with those words), clicking it sends nothing; the dot stays live and its tooltip says a pause cancels the test; "Test run"\'s name starts with "Test run"',
        r2 and r2['text'] == 'Test queued' and r2['btnDis'] == 'true' and (r2['label'] or '').startswith('Test queued: Beta Snapshot') and r1['label'].startswith('Test run: Alpha')
        and r2['dotDis'] is None and 'cancels the test' in (t2 or '') and posts() == 0 and row_info(pg, 2)['text'] == 'Test queued',
        'r2=%s title=%r posts=%s' % (r2, t2, posts()))
    away(pg)

    # ---- H ----
    hover(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
    early = pg.ev(CARD_ON)
    shown = pg.wait(CARD_ON, 2000)
    card = pg.ev("(document.getElementById('calTaskCard')||{}).textContent || ''")
    r1 = row_info(pg, 1)
    away(pg)
    gone = pg.ev("document.getElementById('calTaskCard').hidden")
    rec('H1', 'hovering Test run shows the task card after a short delay (report, schedule, status, last run, recipients AND subscribers, subject, owner, what a test does); leaving hides it; the row tooltip is kept off the button (title="")',
        (not early) and shown and all(s in card for s in ('Email Report · task #1', 'Alpha Weekly Digest [alpha1]', '0 8 * * *', 'Active', 'Recipients2', 'Subscribers3', 'SubjectDigest', 'Ownerjdoe', 'Sends to the real recipients and subscribers.'))
        and 'Last run' in card and gone and r1['wrapTitle'] == '', 'early=%s shown=%s gone=%s title=%r card=%r' % (early, shown, gone, r1['wrapTitle'], card[:300]))
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="4"] .cal-de-test-btn')
    kf = pg.ev("(function(){var c=document.getElementById('calTaskCard'), b=document.activeElement; return {shown: !c.hidden, desc: b.getAttribute('aria-describedby'), txt: c.textContent};})()")
    pg.ev("document.activeElement.blur()"); time.sleep(0.05)
    kb = pg.ev("document.getElementById('calTaskCard').hidden")
    rec('H2', 'keyboard focus on Test run shows the card at once and points aria-describedby at it; blur hides it',
        kf['shown'] and kf['desc'] == 'calTaskCard' and 'NC_X.T1' in kf['txt'] and kb, '%s hidden-after=%s' % ({k: v for k, v in kf.items() if k != 'txt'}, kb))
    # H3: hoverable + no stale describedby
    hover(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); pg.wait(CARD_ON, 2000)
    cc = pg.ev("(function(){var b=document.getElementById('calTaskCard').getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2];})()")
    pg.mouse('mouseMoved', cc[0], cc[1]); time.sleep(0.45)
    stay = pg.ev(CARD_ON)
    away(pg)
    left = pg.ev("document.getElementById('calTaskCard').hidden")
    # task 4's card opens below task 4, so task 1's button (above it) stays reachable
    hover(pg, '#calDayView .cal-day-ev[data-task-id="4"] .cal-de-test-btn'); pg.wait(CARD_ON, 2000)
    hover(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
    pg.wait("document.getElementById('calTaskCard').textContent.indexOf('Alpha Weekly') >= 0", 2000)
    descs = pg.ev("Array.prototype.map.call(document.querySelectorAll('[aria-describedby=\"calTaskCard\"]'), function (b) { return b.closest('.cal-day-ev').getAttribute('data-task-id'); })")
    away(pg)
    rec('H3', 'the card is hoverable: the pointer can move from the button onto it and it stays, leaving it hides it; moving to another Test run leaves aria-describedby on that button only',
        stay and left and descs == ['1'], 'stay=%s hidden-after=%s describedby=%s' % (stay, left, descs))
    # H4: a mouse click does not pop the card at once (keyboard focus only)
    c = pg.center('#calDayView .cal-day-ev[data-task-id="2"] .cal-de-test-btn')
    pg.mouse('mouseMoved', c[0], c[1]); pg.mouse('mousePressed', c[0], c[1], 1, 1); pg.mouse('mouseReleased', c[0], c[1], 0, 1)
    atonce = pg.ev(CARD_ON)
    away(pg)
    pg.ev("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
    rec('H4', 'a mouse click on Test queued (focus by pointer) does not open the card at once; only the hover delay does', not atonce, 'shown-at-once=%s' % atonce)
    # H5: density zoom
    pg.ev("document.body.style.zoom = '1.5'; window.pnbZoom = function () { return 1.5; }")
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
    geo = pg.ev("(function(){var c=document.getElementById('calTaskCard'), b=document.activeElement.getBoundingClientRect(), r=c.getBoundingClientRect(); return {shown: !c.hidden, bt: b.top, bb: b.bottom, br: b.right, ct: r.top, cb: r.bottom, cr: r.right};})()")
    pg.ev("document.activeElement.blur(); document.body.style.zoom = ''; delete window.pnbZoom")
    zok = geo['shown'] and (abs(geo['ct'] - (geo['bb'] + 9)) < 3 or abs(geo['cb'] - (geo['bt'] - 9)) < 3) and abs(geo['cr'] - geo['br']) < 3
    rec('H5', 'under density zoom (body zoom 1.5, window.pnbZoom) the card still sits 6 CSS px under (or over) its button, right edges lined up', zok, 'geo=%s' % geo)
    # H6: a scroll moves the card with the button
    pg.ev("document.body.style.paddingBottom = '2400px'; window.scrollTo(0, 0)")
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
    pg.ev("window.scrollBy(0, 40)"); time.sleep(0.15)
    sc = pg.ev("(function(){var c=document.getElementById('calTaskCard'), b=document.activeElement.getBoundingClientRect(), r=c.getBoundingClientRect(); return {shown: !c.hidden, bb: b.bottom, bt: b.top, ct: r.top, cb: r.bottom};})()")
    pg.ev("document.activeElement.blur(); document.body.style.paddingBottom = ''; window.scrollTo(0, 0)")
    rec('H6', 'a page scroll keeps the card open and moves it with its button', sc['shown'] and (abs(sc['ct'] - (sc['bb'] + 6)) < 3 or abs(sc['cb'] - (sc['bt'] - 6)) < 3), 'after-scroll=%s' % sc)

    # ---- C ----
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.2)
    r1 = row_info(pg, 1)
    foc = pg.ev("document.activeElement && document.activeElement.className")
    rec('C1', 'clicking Test run asks first, in the row ("Email 2 recipients and 3 subscribers now?", Run test / Cancel), focus on CANCEL, nothing sent yet',
        r1['text'].startswith('Email 2 recipients and 3 subscribers now?') and 'Run test' in r1['text'] and 'Cancel' in r1['text'] and foc == 'cal-de-cancel' and posts() == 0,
        'text=%r focus=%r posts=%s' % (r1['text'], foc, posts()))
    pg.key('Escape', 27); time.sleep(0.2)
    esc = row_info(pg, 1)['text']; escfocus = pg.ev("document.activeElement && document.activeElement.className")
    if pg.ev("!!document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-cancel')"):
        pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-cancel'); time.sleep(0.15)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.15)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-cancel'); time.sleep(0.15)
    rec('C2', 'Escape and Cancel both put the button back (focus on it), still nothing sent',
        'Test run' in esc and escfocus == 'cal-de-test-btn' and 'Test run' in row_info(pg, 1)['text'] and posts() == 0, 'esc=%r focus=%r posts=%s' % (esc, escfocus, posts()))
    # C6: a held / double Enter or a double click cannot send the test (a step that
    # finds its control gone = the test WAS sent: C6 fails, not the harness)
    try:
        RUN = '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-run'
        kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
        pg.key('Enter', 13); time.sleep(0.05); pg.key('Enter', 13); time.sleep(0.2)
        dbl_enter = (posts(), row_info(pg, 1)['text'])
        pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
        pg.ev("document.querySelector(%s).click()" % json.dumps(RUN)); time.sleep(0.1)
        fast = (posts(), pg.ev("!!document.querySelector(%s)" % json.dumps(RUN)))
        time.sleep(0.5)
        pg.ev("document.querySelector(%s).focus()" % json.dumps(RUN))
        pg.call('Input.dispatchKeyEvent', type='keyDown', text='\r', unmodifiedText='\r', key='Enter', code='Enter', windowsVirtualKeyCode=13, nativeVirtualKeyCode=13, autoRepeat=True)
        pg.call('Input.dispatchKeyEvent', type='keyUp', key='Enter', code='Enter', windowsVirtualKeyCode=13, nativeVirtualKeyCode=13)
        time.sleep(0.15)
        rep = posts()
        c = pg.center(RUN)
        pg.mouse('mouseMoved', c[0], c[1]); pg.mouse('mousePressed', c[0], c[1], 1, 2); pg.mouse('mouseReleased', c[0], c[1], 0, 2); time.sleep(0.15)
        dbl = posts()
        if pg.ev("!!document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-cancel')"):
            pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-cancel'); time.sleep(0.15)
    except Exception as e:
        dbl_enter, fast, rep, dbl = (repr(e)[:200], ''), None, None, None
    rec('C6', 'nothing is sent by: Enter twice on Test run (the second lands on Cancel), a Run test click within 400 ms of the ask opening, a held (repeat) Enter on Run test, or the second click of a double click',
        dbl_enter[0] == 0 and 'Test run' in dbl_enter[1] and fast == (0, True) and rep == 0 and dbl == 0,
        'enter-twice=%s fast=%s repeat-posts=%s dblclick-posts=%s' % (dbl_enter, fast, rep, dbl))
    # C7: the confirm belongs to the row that asked; a render drops it
    rows7 = lambda: pg.ev("Array.prototype.map.call(document.querySelectorAll('#calDayView .cal-day-ev[data-task-id=\"7\"]'), function (b) { return !!b.querySelector('.cal-de-run'); })")
    pg.center('#calDayView .cal-day-ev[data-task-id="7"] .cal-de-test-btn'); time.sleep(0.5)   # the 1 PM row scrolls in (smoothly): measure again once it has
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="7"] .cal-de-test-btn'); time.sleep(0.15)
    one = rows7()
    pg.click_sel('#calBack'); time.sleep(0.2); cf.open_today(pg); time.sleep(0.2)
    after = rows7()
    rec('C7', 'a task with two rows today: Test run on one asks on THAT row only; leaving the day and coming back shows no confirm',
        one == [True, False] and after == [False, False], 'rows=%s after-view-change=%s texts=%s busy=%s errs=%s' % (one, after,
        pg.ev("Array.prototype.map.call(document.querySelectorAll('#calDayView .cal-day-ev[data-task-id=\"7\"] .cal-de-test'), function (b) { return b.textContent; })"),
        pg.ev("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"7\"] .cal-de-test-btn'); return b && b.getAttribute('aria-disabled');})()"), pg.ev("window.__errs")))
    time.sleep(0.3)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.45)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-run')
    pg.wait("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-test'); return b && b.textContent.indexOf('Test queued')>=0;})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r1 = row_info(pg, 1)
    live = pg.ev("(document.getElementById('calTaskLive')||{}).textContent||''")
    rec('C3', 'Run test POSTs run_now for that task with the CSRF header; the row then reads "Test queued" (dot still live), and the message is announced',
        p and p.get('action') == 'run_now' and p.get('task_id') == '1' and p.get('__csrf') == '1' and r1['text'] == 'Test queued' and r1['dotDis'] is None and 'Test run queued' in live,
        'post=%s row=%s live=%r' % (p, r1, live))
    pg.ev("window.__mode.run = {status: 'error', message: 'Task not found.'}")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-test-btn'); time.sleep(0.45)
    a4 = row_info(pg, 4)['text']
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-run'); time.sleep(0.4)
    r4 = row_info(pg, 4)
    rec('C4', 'DB dump wording ("Write to NC_X.T1 now?"); a refusal stays in the row as text and the button comes back',
        a4.startswith('Write to NC_X.T1 now?') and r4['err'] == 'Task not found.' and 'Test run' in r4['text'], 'ask=%r row=%s' % (a4, r4))
    pg.ev("window.__mode.run = null")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn'); time.sleep(0.1)
    a5 = row_info(pg, 5)['text']
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-cancel'); time.sleep(0.1)
    pg.ev("(function(){var b=document.createElement('div'); b.id='calRunnerBanner'; b.setAttribute('data-runner-state','paused'); document.body.appendChild(b);})()")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn'); time.sleep(0.1)
    a5b = row_info(pg, 5)['text']
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-cancel'); time.sleep(0.1)
    hover(pg, '#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn')
    pg.wait(CARD_ON, 2000)
    c5 = pg.ev("document.getElementById('calTaskCard').textContent")
    away(pg)
    pg.ev("document.getElementById('calRunnerBanner').setAttribute('data-runner-state','offline')")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn'); time.sleep(0.1)
    a5c = row_info(pg, 5)['text']
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-cancel'); time.sleep(0.1)
    hover(pg, '#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn')
    pg.wait(CARD_ON, 2000)
    c5c = pg.ev("document.getElementById('calTaskCard').textContent")
    away(pg)
    pg.ev("document.getElementById('calRunnerBanner').remove()")
    rec('C5', 'a paused task: "Email 1 recipient now? It stays paused after."; a paused scheduler and an OFFLINE one are each named in the ask and the card',
        a5.startswith('Email 1 recipient now? It stays paused after.') and 'scheduler is' not in a5 and 'The scheduler is paused: it runs when it resumes.' in a5b
        and 'The scheduler is paused: a test waits until it resumes.' in c5 and 'stays paused' in c5
        and 'The scheduler is not responding' in a5c and 'The scheduler is not responding' in c5c,
        'a5=%r a5b=%r a5c=%r card=%r cardoff=%r' % (a5, a5b, a5c, c5[-120:], c5c[-120:]))

    # ---- S ----
    n0 = posts()
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"4\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='false';})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r4 = row_info(pg, 4)
    base = pg.ev("document.getElementById('calSummary').getAttribute('data-base')")
    chipn = pg.ev("(document.querySelector('#calHidePaused .chip-n')||{}).textContent")
    chipt = pg.ev("document.getElementById('calHidePaused').title")
    foc = pg.ev("document.activeElement && document.activeElement.className")
    rec('S1', 'clicking an active task\'s dot POSTs toggle_status new_status=0; the row turns paused and STAYS; the summary, the Active chip count AND its tooltip\'s paused count follow; focus stays on the dot',
        posts() == n0 + 1 and p.get('action') == 'toggle_status' and p.get('task_id') == '4' and p.get('new_status') == '0' and p.get('__csrf') == '1'
        and r4['checked'] == 'false' and r4['paused'] and base == '4 active · 3 paused tasks' and chipn == '4' and 'the 3 paused ones' in (chipt or '') and foc == 'cal-de-dot',
        'post=%s row=%s base=%r chip=%r title=%r focus=%r' % (p, r4, base, chipn, chipt, foc))
    pg.ev("window.__mode.next_run = %s" % json.dumps(D + ' 11:00:00'))
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"5\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='true';})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r5 = row_info(pg, 5)
    rec('S2', 'clicking a paused task\'s dot enables it (new_status=1): dot checked, row no longer paused, and the "next run" badge moves to the next_run the server sent',
        p.get('new_status') == '1' and p.get('task_id') == '5' and r5['checked'] == 'true' and not r5['paused'] and r5['next'], 'post=%s row=%s' % (p, r5))
    pg.ev("window.__mode.next_run = null")
    pg.ev("window.__mode.toggle = {status: 'collision', message: 'Cannot enable: destination is already targeted.'}")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-dot'); time.sleep(0.4)
    r4 = row_info(pg, 4)
    pg.ev("window.__mode.toggle = {status: 'success', message: 'Task disabled. Its queued test run was cancelled.', next_run: null, test_run_pending: false, test_run_cancelled: true}")
    n0 = posts()
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="2"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"2\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='false';})()", 2000)
    time.sleep(0.1)
    p2 = pg.ev("window.__posts[window.__posts.length-1]"); r2 = row_info(pg, 2)
    pg.ev("window.__mode.toggle = null")
    rec('S4', 'pausing a task whose test is queued POSTs toggle_status new_status=0; on test_run_cancelled the row turns paused and goes back to "Test run"',
        posts() == n0 + 1 and p2.get('task_id') == '2' and p2.get('new_status') == '0' and r2['checked'] == 'false' and r2['paused'] and 'Test run' in r2['text'] and 'queued' not in r2['text'],
        'post=%s row=%s' % (p2, r2))
    rec('S3', 'a refused toggle (collision) leaves the dot as it was and shows the server\'s reason in the row',
        r4['checked'] == 'false' and r4['err'] == 'Cannot enable: destination is already targeted.', 'row=%s' % r4)
    # S5: one busy flag for the dot and the test
    n0 = posts()
    s5 = pg.ev("""(function(){
        var row = document.querySelector('#calDayView .cal-day-ev[data-task-id="7"]');
        row.querySelector('.cal-de-dot').click();
        var row2 = document.querySelector('#calDayView .cal-day-ev[data-task-id="7"]');
        var b = row2.querySelector('.cal-de-test-btn'), dis = b.getAttribute('aria-disabled');
        b.click();
        return {dis: dis, asked: !!document.querySelector('#calDayView .cal-de-run')};
    })()""")
    time.sleep(0.3)
    rec('S5', 'while the dot\'s request is in flight the same task\'s Test run is disabled and a click on it opens nothing (one busy flag)',
        s5['dis'] == 'true' and not s5['asked'] and posts() == n0 + 1, 's5=%s posts=+%d' % (s5, posts() - n0))
    # S7: the dot waits while a test is being queued (the other half of the busy flag)
    time.sleep(0.3)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-test-btn'); time.sleep(0.45)
    n0 = posts()
    s7 = pg.ev("""(function(){
        var row = document.querySelector('#calDayView .cal-day-ev[data-task-id="5"]');
        row.querySelector('.cal-de-run').click();
        var d = document.querySelector('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-dot'), dis = d.getAttribute('aria-disabled');
        d.click();
        return {dis: dis};
    })()""")
    time.sleep(0.3)
    acts = pg.ev("window.__posts.slice(%d).map(function (p) { return p.action; })" % n0)
    rec('S7', 'while a test is being queued the same task\'s dot is disabled and a click on it sends no toggle', s7['dis'] == 'true' and acts == ['run_now'], 's7=%s posts=%s' % (s7, acts))
    # S6: an enable without next_run drops the stale one
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="8"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"8\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='true';})()", 2000)
    time.sleep(0.1)
    r8 = row_info(pg, 8)
    rec('S6', 'enabling a task whose reply has no next_run shows no "next run" badge from its stale pre-pause NEXT_RUN',
        r8['checked'] == 'true' and not r8['next'], 'row=%s' % r8)

    # ---- R: CSS ----
    pg.ev("(function(){var s=document.createElement('style'); s.id='wolf'; s.textContent='.cal-day-ev button:hover:not(:disabled) { background: rgb(179, 0, 0); }'; document.head.appendChild(s);})()")
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')   # task 1 reads "Test queued" since C3
    pg.ev("document.activeElement.blur()")
    hover(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.1)
    bg = pg.ev("getComputedStyle(document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-test-btn')).backgroundColor")
    txt1 = row_info(pg, 1)['text']
    away(pg)
    pg.ev("document.getElementById('wolf').remove()")
    rec('R1', 'a hovered "Test queued" keeps its surface under a theme\'s (0,3,1) button:hover:not(:disabled) fill (Wolfpack\'s red)', txt1 == 'Test queued' and bg != 'rgb(179, 0, 0)', 'text=%r bg=%s' % (txt1, bg))
    rec('R2', 'CSS: a print rule hides the dot, Test run and the card; the active dot uses --accent-success',
        '@media print { .cal-day-ev .cal-de-dot, .cal-day-ev .cal-de-test, .cal-task-card { display: none !important; } }' in text
        and '.cal-de-dot[aria-checked="true"]::before { border-color: var(--accent-success' in text, '')

    # ---- A ----
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    if pg.ev("document.getElementById('calDayView').style.display !== 'none'"):
        pg.click_sel('#calBack'); time.sleep(0.2); pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    AG = "#calAgenda .cal-day-ev[data-task-id=\"4\"]"
    has = pg.ev("!!document.querySelector('%s .cal-de-dot') && !!document.querySelector('%s .cal-de-test-btn')" % (AG, AG))
    pg.click_sel(AG + ' .cal-de-test-btn'); time.sleep(0.2)
    stayed = pg.ev("document.getElementById('calDayView').style.display === 'none' && !!document.querySelector('%s .cal-de-run')" % AG)
    nasks = pg.ev("document.querySelectorAll('#calAgenda .cal-de-run').length")
    stayed2 = False
    if stayed:
        pg.click_sel(AG + ' .cal-de-cancel'); time.sleep(0.2)
        stayed2 = pg.ev("document.getElementById('calDayView').style.display === 'none'")
    else:
        pg.click_sel('#calBack'); time.sleep(0.2); pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    rec('A1', 'agenda rows carry the dot and Test run; clicking Test run / Cancel asks in place (on that one day\'s row of the 7) and never opens the day',
        has and stayed and stayed2 and nasks == 1, 'has=%s stayed=%s/%s asks=%s' % (has, stayed, stayed2, nasks))
    pg.click_sel(AG + ' .cal-de-title'); time.sleep(0.3)
    opened = pg.ev("document.getElementById('calDayView').style.display !== 'none'")
    rec('A2', 'a repainted agenda row still opens its day on a click (the rebuild keeps the agenda\'s handler)', opened, 'opened=%s' % opened)
    errs = pg.ev("window.__errs")
    rec('X1', 'no page errors through the run', not errs, 'errs=%s' % errs)

    # ---- P: the poll (setTimeout 30000 -> 60 ms) ----
    first = {'status': 'success', 'data': [{'ID': 2, 'OPTIONS': '{"_test_run_pending":true}', 'IS_ACTIVE': '1', 'NEXT_RUN': D + ' 09:00:00'},
                                           {'ID': 9, 'OPTIONS': '{"_test_run_pending":true}', 'IS_ACTIVE': '0', 'NEXT_RUN': None}]}
    second = {'status': 'success', 'data': [{'ID': 2, 'OPTIONS': '{}', 'IS_ACTIVE': '1', 'NEXT_RUN': D + ' 21:00:00', 'LAST_RUN': D + ' 09:01:00'},
                                            {'ID': 9, 'OPTIONS': '{"_test_run_pending":true}', 'IS_ACTIVE': '0', 'NEXT_RUN': None}]}
    pg.call('Page.addScriptToEvaluateOnNewDocument', source="window.__mode.lists = %s; window.__mode.flip = false;" % json.dumps([first, second]))
    br.load('cal.html')
    pg.ev("localStorage.clear()"); br.load('cal.html')
    if pg.ev("document.querySelector('#calHidePaused') && document.querySelector('#calHidePaused').getAttribute('aria-pressed') === 'true'"):
        pg.click_sel('#calHidePaused'); time.sleep(0.2)
    cf.open_today(pg)
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="2"] .cal-de-test-btn')
    still = row_info(pg, 2)['text']   # the first list keeps it queued
    pg.ev("window.__mode.flip = true")   # the runner picks it up only now, with focus on the button
    ok = still == 'Test queued' and pg.wait("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"2\"] .cal-de-test'); return b && b.textContent.indexOf('Test run')>=0;})()", 4000)
    gets = pg.ev("window.__gets")
    foc = pg.ev("(function(){var a=document.activeElement; return a ? [a.className, a.closest('.cal-day-ev') && a.closest('.cal-day-ev').getAttribute('data-task-id')] : null;})()")
    rec('P1', 'a queued test is polled by the STORED report id (report_id=B22LEG, not the short id) and an orphan task\'s by its own (iota9); once the marker is gone the row reads "Test run" again',
        ok and any('action=list&report_id=B22LEG' in g for g in gets) and any('report_id=iota9' in g for g in gets) and not any('report_id=beta22' in g for g in gets),
        'ok=%s gets=%s' % (ok, gets[:4]))
    rec('P2', 'the pickup repaint keeps keyboard focus on that row\'s Test run button (not <body>)', foc == ['cal-de-test-btn', '2'], 'focus=%s' % foc)
    pg.ev("document.activeElement.blur()")
    kb_focus(pg, '#calDayView .cal-day-ev[data-task-id="2"] .cal-de-test-btn')
    c2 = pg.ev("document.getElementById('calTaskCard').textContent")
    pg.ev("document.activeElement.blur()")
    rec('P3', 'the pickup reads NEXT_RUN back: the card\'s Next run is the runner\'s new one (9:00 PM), not "not set"', 'Next run' in c2 and '9:00 PM' in c2, 'card=%r' % c2[:240])
    r9 = pg.ev("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"9\"]'); return b ? [b.querySelector('.cal-de-test').textContent.replace(/\\s+/g,' ').trim(), b.classList.contains('paused')] : null;})()")
    rec('P4', 'a marker on a row the runner cannot pick up (IS_ACTIVE 0: stranded) is not queued: the row goes back to "Test run" and reads paused',
        r9 == ['▶ Test run', True] or r9 == ['Test run', True], 'r9=%s' % r9)

def run_build(label, text, mutant=None):
    global R
    R = []
    if mutant:
        old, new, _ = MUTANTS[mutant]
        if text.count(old) != 1: raise RuntimeError('mutant %s anchor x%d' % (mutant, text.count(old)))
        text = text.replace(old, new)
    cf.FIXTURE[:] = FIXTURE
    run = None; br = None
    try:
        run, staged = cf.stage(text, None)
        br = cf.Browser(run)
        checks(br, staged)
    except Exception as e:
        rec('X0', 'harness', False, repr(e))
    finally:
        if br: br.close()
        if run: shutil.rmtree(run, ignore_errors=True)
    npass = sum(1 for r in R if r['pass'])
    print('== %s ==' % label)
    for r in R: print('%s %-3s %s%s' % ('ok  ' if r['pass'] else 'FAIL', r['id'], r['name'], '' if r['pass'] else '   -> ' + r['detail']))
    print('SUMMARY  pass=%d  fail=%d' % (npass, len(R) - npass))
    sys.stdout.flush()
    return [r['id'] for r in R if not r['pass']]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage'); ap.add_argument('--control', action='store_true'); ap.add_argument('--mutants', action='store_true'); ap.add_argument('--mutant')
    a = ap.parse_args()
    src = a.stage or os.path.join(cf.APP, 'analytics_all.php')
    text = cf.read(src)
    if a.mutants or a.mutant:
        names = list(MUTANTS) if a.mutants else a.mutant.split(',')
        bad = 0
        for n in names:
            red = set(run_build('mutant ' + n, text, n)); must = set(MUTANTS[n][2])
            if not must <= red: print('MUTANT %s SURVIVED: must=%s red=%s' % (n, sorted(must), sorted(red))); bad += 1
            else: print('MUTANT %s killed (%s)' % (n, ' '.join(sorted(red))))
            sys.stdout.flush()
        sys.exit(1 if bad else 0)
    fails = run_build(('control ' if a.control else 'stage ') + src, text)
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
