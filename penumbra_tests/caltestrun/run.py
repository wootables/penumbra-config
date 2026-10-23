# =============================================================================
# CALENDAR STATUS DOT + TEST RUN SUITE (2026-10-22): every Day / Agenda row on
# calendar.php carries the Repository's status dot (left; toggle_status) and a
# Test run button (right; run_now) whose hover card shows the task's details. A
# test run is real, so the button asks first, in place ("Email 2 recipients
# now?  Run test / Cancel"). Since tgltest (2026-10-22) a queued test no
# longer locks the dot: toggle_status settles it (a pause cancels the test).
#
# WHAT IS UNDER TEST: analytics_all.php, staged by calfilter's harness (the
# calendar CSS / templates / script LIFTED by anchors, rendered by the real PHP
# 8.2 CLI, driven in headless Edge over CDP with real mouse and keys). fetch()
# is stubbed before the page runs: every POST is recorded and answered from
# window.__reply. setTimeout(fn, 30000) is cut to 60 ms so the queued-test poll
# runs inside the suite.
#
#   PH*  the PHP task loop (lifted, run over fixture rows): pending flag; a queued
#        test on a PAUSED task (IS_ACTIVE flipped to 1) still reads paused
#   D*   the row: dot first (role=switch, aria-checked), Test run last; a queued
#        task reads "Test queued" (no POST); its dot stays live
#   H*   the hover card: mouse (delay) and keyboard focus; the row's own tooltip
#        is kept off the button (title="")
#   C*   confirm: no POST until Run test; Cancel / Escape; success -> queued +
#        announced; an error stays in the row; paused / scheduler-paused wording
#   S*   the dot: pause -> paused row, counts follow, row stays; enable -> the
#        next-run badge from next_run; a refusal stays in the row
#   A*   agenda: the controls never open the day; a repainted row still does
#   P*   the poll: a picked-up test goes back to "Test run"
#
#   py -3 run.py                 the live analytics_all.php
#   py -3 run.py --stage <file>  a staged one          EXPECTED: GREEN
#   py -3 run.py --control       = the live file before the feature: RED from PH1 on
#   py -3 run.py --stage <file> --mutants
# Run it from its own folder; needs calfilter\run.py next door.
# =============================================================================
import argparse, datetime, importlib.util, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('calfilter', os.path.join(HERE, '..', 'calfilter', 'run.py'))
cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)

TODAY = datetime.date.today()
D = TODAY.strftime('%Y-%m-%d')
FIXTURE = [
    {'id': 1, 'type': 'EMAIL',    'cron': '0 8 * * *',  'short': 'alpha1', 'title': 'Alpha Weekly Digest', 'subject': 'Digest', 'recipCount': 2, 'owner': 'jdoe',   'active': 1, 'next': D + ' 08:00:00', 'last': D + ' 07:00:00', 'detail': '', 'cond': 0, 'pending': 0},
    {'id': 2, 'type': 'SNAPSHOT', 'cron': '0 9 * * *',  'short': 'beta22', 'title': 'Beta Snapshot',       'subject': None,     'recipCount': 0, 'owner': 'asmith', 'active': 1, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 1},
    {'id': 4, 'type': 'DB_DUMP',  'cron': '0 10 * * *', 'short': 'del4',   'title': 'Delta Dump',          'subject': None,     'recipCount': 0, 'owner': 'jdoe',   'active': 1, 'next': None, 'last': None, 'detail': 'NC_X.T1', 'cond': 0, 'pending': 0},
    {'id': 5, 'type': 'EMAIL',    'cron': '0 11 * * *', 'short': 'eps5',   'title': 'Epsilon Paused',      'subject': 'Old',    'recipCount': 1, 'owner': 'jdoe',   'active': 0, 'next': None, 'last': None, 'detail': '', 'cond': 0, 'pending': 0},
]

MUTANTS = {
    'noconfirm': ("            t._testAsk = true; t._msg = null; calRepaintTask(t, '.cal-de-run');",
                  "            t._testAsk = false; calSchedPost({ action: 'run_now', task_id: t.id });", ['C1']),
    'norevert':  ("        if ($active && is_array($opts) && !empty($opts['_test_run_revert_disable'])) $active = 0;\n", "", ['PH1']),
    'nopending': ("            'pending'    => $pending ? 1 : 0,", "            'pending'    => 0,", ['PH1']),
    'lockback':  ("            if (t._dotBusy) return;\n            var want", "            if (t.pending || t._dotBusy) return;\n            var want", ['S4']),
    'nocancel':  ("                    if (resp.test_run_cancelled) t.pending = 0;\n", "", ['S4']),
    'nostop':    ("        wrap.addEventListener('click', function (e) { e.stopPropagation(); });\n", "", ['A1']),
    'norebuild': ("                            box._rebuild = mk;\n", "", ['A2']),
    'nocount':   ("                    calRecount();\n", "", ['S1']),
    'notitle':   ("        wrap.title = '';", "", ['H1']),
    'nonext':    ("                    if (want && resp.next_run) t.next = resp.next_run;\n", "", ['S2']),
    'noescape':  ("if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }", "if (e.key === 'Escape') { }", ['C2']),
    'nopoll':    ("                x.pending = 0;\n", "", ['P1']),
}

R = []
def rec(i, name, ok, detail=''):
    R.append({'id': i, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:500]})

# ---- PH: the PHP task loop, lifted and run over fixture rows ----
def php_checks(text):
    try:
        loop = cf.cut(text, "    foreach ($rows as $r) {\n        $opts = json_decode(isset($r['OPTIONS'])",
                      "} catch (Exception $e) { error_log(\"analytics_all scheduled-tasks", 'task loop')
    except Exception as e:
        rec('PH1', 'task loop: pending flag + a queued test on a paused task reads paused', False, repr(e)); return
    rows = [
        {'ID': 1, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'OPTIONS': '{"_test_run_pending":true}', 'RECIPIENTS': 'a@x', 'OWNER_ID': 'jdoe'},
        {'ID': 2, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': 1, 'OPTIONS': '{"_test_run_pending":true,"_test_run_revert_disable":true}', 'RECIPIENTS': 'a@x', 'OWNER_ID': 'jdoe'},
        {'ID': 3, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 1, 'OPTIONS': '{}', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe'},
        {'ID': 4, 'TASK_TYPE': 'SNAPSHOT', 'IS_ACTIVE': 0, 'OPTIONS': '', 'RECIPIENTS': '', 'OWNER_ID': 'jdoe'},
    ]
    src = ("<?php\n$rows = json_decode(getenv('PH_ROWS'), true); $schedTasks = array(); $currentUserKey = 'jdoe';\n"
           "$schedTypeLabels = array('EMAIL' => 'Email Report', 'SNAPSHOT' => 'Take a Snapshot');\n"
           "$schedActiveCount = 0; $schedPausedCount = 0; $schedMineCount = 0; $schedTypeCounts = array('EMAIL' => 0, 'SNAPSHOT' => 0);\n"
           "try {\n" + loop + "} catch (Exception $e) {}\n"
           "echo json_encode(array('t' => array_map(function ($t) { return array($t['id'], $t['active'], isset($t['pending']) ? $t['pending'] : null); }, $schedTasks), 'a' => $schedActiveCount, 'p' => $schedPausedCount));\n")
    d = tempfile.mkdtemp(prefix='pnb_ctr_')
    try:
        p = os.path.join(d, 'loop.php')
        with open(p, 'w', encoding='utf-8') as f: f.write(src)
        out = subprocess.run([cf.PHP, '-n', '-d', 'display_errors=1', '-d', 'error_reporting=-1', p], capture_output=True, env=dict(os.environ, PH_ROWS=json.dumps(rows)))
        txt = out.stdout.decode('utf-8', 'replace')
        try: got = json.loads(txt)
        except Exception: got = None
    finally:
        shutil.rmtree(d, ignore_errors=True)
    exp = {'t': [[1, 1, 1], [2, 0, 1], [3, 1, 0], [4, 0, 0]], 'a': 2, 'p': 2}
    rec('PH1', 'task loop: pending flag; a queued test on a paused task (IS_ACTIVE flipped to 1) still reads paused, and counts as paused',
        got == exp, 'got=%s' % (got if got is not None else txt[:400]))

STUB = r'''
window.__posts = []; window.__gets = []; window.__mode = {};
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
  var l = window.__mode.list || {status: 'success', data: []};
  return Promise.resolve({ json: function () { return Promise.resolve(l); } });
};
(function () { var st = window.setTimeout; window.setTimeout = function (fn, ms) { if (ms === 30000) ms = 60; return st.apply(window, [fn, ms].concat([].slice.call(arguments, 2))); }; })();
'''

ROW = "(function(id){ return document.querySelector('#calDayView .cal-day-ev[data-task-id=\"' + id + '\"]'); })"
def row_info(pg, tid):
    return pg.ev(ROW + "(%d) ? (function(b){ var d=b.querySelector('.cal-de-dot'), t=b.querySelector('.cal-de-test'), btn=t&&t.querySelector('button'); return {first: b.firstElementChild===d, role: d&&d.getAttribute('role'), checked: d&&d.getAttribute('aria-checked'), dotDis: d&&d.getAttribute('aria-disabled'), last: !!t && (b.lastElementChild===t || (b.lastElementChild.className==='cal-de-err' && b.lastElementChild.previousElementSibling===t)), text: t?t.textContent.replace(/\\s+/g,' ').trim():'', btnDis: btn&&btn.getAttribute('aria-disabled'), paused: b.classList.contains('paused'), err: (b.querySelector('.cal-de-err')||{}).textContent||'', next: !!b.querySelector('.cal-tag-next'), wrapTitle: t?t.getAttribute('title'):null}; })(" % tid + ROW + "(%d)) : null" % tid)

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

def checks(br, text):
    pg = br.pg
    php_checks(text)
    pg.call('Page.addScriptToEvaluateOnNewDocument', source=STUB)
    show_all_today(br)
    posts = lambda: pg.ev("window.__posts.length")

    # ---- D ----
    r1, r5 = row_info(pg, 1), row_info(pg, 5)
    rec('D1', 'a row: the status dot comes first (role=switch, aria-checked = active), the Test run control last; a paused task\'s dot is unchecked',
        r1 and r1['first'] and r1['role'] == 'switch' and r1['checked'] == 'true' and r1['last'] and 'Test run' in r1['text']
        and r5 and r5['checked'] == 'false' and r5['paused'], 'r1=%s r5=%s' % (r1, r5))
    r2 = row_info(pg, 2)
    t2 = pg.ev("document.querySelector('#calDayView .cal-day-ev[data-task-id=\"2\"] .cal-de-dot').title")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="2"] .cal-de-test button'); time.sleep(0.2)
    rec('D2', 'a task with a queued test: "Test queued" (aria-disabled), clicking it sends nothing; the dot stays live and its tooltip says a pause cancels the test',
        r2 and r2['text'] == 'Test queued' and r2['btnDis'] == 'true' and r2['dotDis'] is None and 'cancels the test' in (t2 or '') and posts() == 0 and row_info(pg, 2)['text'] == 'Test queued',
        'r2=%s title=%r posts=%s' % (r2, t2, posts()))

    # ---- H ----
    hover(pg, '#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn')
    early = pg.ev("(function(){var c=document.getElementById('calTaskCard'); return !!c && !c.hidden;})()")
    shown = pg.wait("(function(){var c=document.getElementById('calTaskCard'); return !!c && !c.hidden;})()", 2000)
    card = pg.ev("(document.getElementById('calTaskCard')||{}).textContent || ''")
    r1 = row_info(pg, 1)
    pg.mouse('mouseMoved', 5, 5); time.sleep(0.15)
    gone = pg.ev("document.getElementById('calTaskCard').hidden")
    rec('H1', 'hovering Test run shows the task card after a short delay (report, schedule, status, last run, recipients, subject, owner, what a test does); leaving hides it; the row tooltip is kept off the button (title="")',
        (not early) and shown and all(s in card for s in ('Email Report · task #1', 'Alpha Weekly Digest [alpha1]', '0 8 * * *', 'Active', 'Recipients2', 'SubjectDigest', 'Ownerjdoe', 'Sends to the real recipients'))
        and 'Last run' in card and gone and r1['wrapTitle'] == '', 'early=%s shown=%s gone=%s title=%r card=%r' % (early, shown, gone, r1['wrapTitle'], card[:300]))
    pg.ev("document.querySelector('#calDayView .cal-day-ev[data-task-id=\"4\"] .cal-de-test-btn').focus()"); time.sleep(0.1)
    kf = pg.ev("(function(){var c=document.getElementById('calTaskCard'), b=document.activeElement; return {shown: !c.hidden, desc: b.getAttribute('aria-describedby'), txt: c.textContent};})()")
    pg.ev("document.activeElement.blur()"); time.sleep(0.05)
    kb = pg.ev("document.getElementById('calTaskCard').hidden")
    rec('H2', 'keyboard focus on Test run shows the card at once and points aria-describedby at it; blur hides it',
        kf['shown'] and kf['desc'] == 'calTaskCard' and 'NC_X.T1' in kf['txt'] and kb, '%s hidden-after=%s' % ({k: v for k, v in kf.items() if k != 'txt'}, kb))

    # ---- C ----
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.2)
    r1 = row_info(pg, 1)
    foc = pg.ev("document.activeElement && document.activeElement.className")
    rec('C1', 'clicking Test run asks first, in the row ("Email 2 recipients now?", Run test / Cancel), focus on Run test, nothing sent yet',
        r1['text'].startswith('Email 2 recipients now?') and 'Run test' in r1['text'] and 'Cancel' in r1['text'] and foc == 'cal-de-run' and posts() == 0,
        'text=%r focus=%r posts=%s' % (r1['text'], foc, posts()))
    pg.key('Escape', 27); time.sleep(0.2)
    esc = row_info(pg, 1)['text']; escfocus = pg.ev("document.activeElement && document.activeElement.className")
    if pg.ev("!!document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-cancel')"):   # Escape did nothing: Cancel so the rest can run
        pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-cancel'); time.sleep(0.15)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.15)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-cancel'); time.sleep(0.15)
    rec('C2', 'Escape and Cancel both put the button back (focus on it), still nothing sent',
        'Test run' in esc and escfocus == 'cal-de-test-btn' and 'Test run' in row_info(pg, 1)['text'] and posts() == 0, 'esc=%r focus=%r posts=%s' % (esc, escfocus, posts()))
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-test-btn'); time.sleep(0.15)
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="1"] .cal-de-run')
    pg.wait("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"1\"] .cal-de-test'); return b && b.textContent.indexOf('Test queued')>=0;})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r1 = row_info(pg, 1)
    live = pg.ev("(document.getElementById('calTaskLive')||{}).textContent||''")
    rec('C3', 'Run test POSTs run_now for that task with the CSRF header; the row then reads "Test queued" (dot still live), and the message is announced',
        p and p.get('action') == 'run_now' and p.get('task_id') == '1' and p.get('__csrf') == '1' and r1['text'] == 'Test queued' and r1['dotDis'] is None and 'Test run queued' in live,
        'post=%s row=%s live=%r' % (p, r1, live))
    pg.ev("window.__mode.run = {status: 'error', message: 'Task not found.'}")
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-test-btn'); time.sleep(0.1)
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
    pg.wait("!document.getElementById('calTaskCard').hidden", 2000)
    c5 = pg.ev("document.getElementById('calTaskCard').textContent")
    pg.mouse('mouseMoved', 5, 5)
    pg.ev("document.getElementById('calRunnerBanner').remove()")
    rec('C5', 'a paused task: "Email 1 recipient now? It stays paused after."; with the scheduler paused the ask and the card both say a test waits for it',
        a5.startswith('Email 1 recipient now? It stays paused after.') and 'scheduler is paused' not in a5 and 'The scheduler is paused: it runs when it resumes.' in a5b
        and 'The scheduler is paused: a test waits until it resumes.' in c5 and 'stays paused' in c5, 'a5=%r a5b=%r card=%r' % (a5, a5b, c5[-200:]))

    # ---- S ----
    n0 = posts()
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="4"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"4\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='false';})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r4 = row_info(pg, 4)
    base = pg.ev("document.getElementById('calSummary').getAttribute('data-base')")
    chipn = pg.ev("(document.querySelector('#calHidePaused .chip-n')||{}).textContent")
    foc = pg.ev("document.activeElement && document.activeElement.className")
    rec('S1', 'clicking an active task\'s dot POSTs toggle_status new_status=0; the row turns paused (dot unchecked) and STAYS; the summary and the Active chip count follow; focus stays on the dot',
        posts() == n0 + 1 and p.get('action') == 'toggle_status' and p.get('task_id') == '4' and p.get('new_status') == '0' and p.get('__csrf') == '1'
        and r4['checked'] == 'false' and r4['paused'] and base == '2 active · 2 paused tasks' and chipn == '2' and foc == 'cal-de-dot',
        'post=%s row=%s base=%r chip=%r focus=%r' % (p, r4, base, chipn, foc))
    pg.ev("window.__mode.next_run = %s" % json.dumps(D + ' 11:00:00'))
    pg.click_sel('#calDayView .cal-day-ev[data-task-id="5"] .cal-de-dot')
    pg.wait("(function(){var d=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"5\"] .cal-de-dot'); return d && d.getAttribute('aria-checked')==='true';})()", 2000)
    time.sleep(0.1)
    p = pg.ev("window.__posts[window.__posts.length-1]"); r5 = row_info(pg, 5)
    rec('S2', 'clicking a paused task\'s dot enables it (new_status=1): dot checked, row no longer paused, and the "next run" badge moves to the next_run the server sent',
        p.get('new_status') == '1' and p.get('task_id') == '5' and r5['checked'] == 'true' and not r5['paused'] and r5['next'], 'post=%s row=%s' % (p, r5))
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

    # ---- A ----
    pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    if pg.ev("document.getElementById('calDayView').style.display !== 'none'"):
        pg.click_sel('#calBack'); time.sleep(0.2); pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    AG = "#calAgenda .cal-day-ev[data-task-id=\"4\"]"
    has = pg.ev("!!document.querySelector('%s .cal-de-dot') && !!document.querySelector('%s .cal-de-test-btn')" % (AG, AG))
    pg.click_sel(AG + ' .cal-de-test-btn'); time.sleep(0.2)
    stayed = pg.ev("document.getElementById('calDayView').style.display === 'none' && !!document.querySelector('%s .cal-de-run')" % AG)
    stayed2 = False
    if stayed:
        pg.click_sel(AG + ' .cal-de-cancel'); time.sleep(0.2)
        stayed2 = pg.ev("document.getElementById('calDayView').style.display === 'none'")
    else:   # the day opened: back to the agenda so A2 still has a row to click
        pg.click_sel('#calBack'); time.sleep(0.2); pg.click_sel('.cal-view-btn[data-cal-view="agenda"]'); time.sleep(0.3)
    rec('A1', 'agenda rows carry the dot and Test run; clicking Test run / Cancel asks in place and never opens the day',
        has and stayed and stayed2, 'has=%s stayed=%s/%s' % (has, stayed, stayed2))
    pg.click_sel(AG + ' .cal-de-title'); time.sleep(0.3)
    opened = pg.ev("document.getElementById('calDayView').style.display !== 'none'")
    rec('A2', 'a repainted agenda row still opens its day on a click (the rebuild keeps the agenda\'s handler)', opened, 'opened=%s' % opened)

    # ---- P: the poll (setTimeout 30000 -> 60 ms) ----
    pg.call('Page.addScriptToEvaluateOnNewDocument', source="window.__mode.list = {status: 'success', data: [{ID: 2, OPTIONS: '{}', LAST_RUN: %s}]};" % json.dumps(D + ' 09:01:00'))
    br.load('cal.html'); cf.open_today(pg)
    ok = pg.wait("(function(){var b=document.querySelector('#calDayView .cal-day-ev[data-task-id=\"2\"] .cal-de-test'); return b && b.textContent.indexOf('Test run')>=0;})()", 3000)
    gets = pg.ev("window.__gets")
    rec('P1', 'a queued test is polled (manage_schedule.php?action=list&report_id=beta22); once the marker is gone the row reads "Test run" again (the dot is never locked)',
        ok and any('action=list&report_id=beta22' in g for g in gets) and row_info(pg, 2)['dotDis'] is None, 'ok=%s gets=%s' % (ok, gets[:3]))

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
    return [r['id'] for r in R if not r['pass']]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage'); ap.add_argument('--control', action='store_true'); ap.add_argument('--mutants', action='store_true'); ap.add_argument('--mutant')
    a = ap.parse_args()
    src = a.stage or os.path.join(cf.APP, 'analytics_all.php')
    text = cf.read(src)
    if a.mutants or a.mutant:
        names = list(MUTANTS) if a.mutants else [a.mutant]
        bad = 0
        for n in names:
            red = set(run_build('mutant ' + n, text, n)); must = set(MUTANTS[n][2])
            if not must <= red: print('MUTANT %s SURVIVED: must=%s red=%s' % (n, sorted(must), sorted(red))); bad += 1
            else: print('MUTANT %s killed (%s)' % (n, ' '.join(sorted(red))))
        sys.exit(1 if bad else 0)
    fails = run_build(('control ' if a.control else 'stage ') + src, text)
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
