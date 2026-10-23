# =============================================================================
# TOGGLE WHILE A TEST RUN IS QUEUED (tgltest, 2026-10-22)
#
# run_now queues a Test Run by tagging OPTIONS._test_run_pending and, for a
# PAUSED task, flipping IS_ACTIVE to 1 + OPTIONS._test_run_revert_disable; the
# runner clears both on pickup and puts IS_ACTIVE back to 0. Two holes in
# manage_schedule.php toggle_status, closed here:
#   (1) enabling a paused task while its test was queued was undone by the
#       runner's revert -> enable now drops _test_run_revert_disable (the test
#       still runs; the task stays enabled after it);
#   (2) pausing while a test was queued left _test_run_pending set forever
#       (the runner only selects IS_ACTIVE = 1), so every later Test Run was
#       refused "already queued" -> pause now drops both markers (= cancels the
#       test) and says so (test_run_cancelled).
# A paused task with a queued test (IS_ACTIVE 1 + revert flag) is PAUSED
# everywhere: the toggle's enable gates (DB_DUMP collision, cron-never), the
# Scheduler's dot / form, the Repository details pane.
#
#   SV*  toggle_status, LIFTED by anchors from manage_schedule.php and run in
#        the real PHP 8.2 CLI over a recording fake PDO (no Oracle, no runner)
#   JS*  main.js: the helpers + loadSchedulerTaskList + the dot handler, LIFTED
#        and run in headless Edge with the real jQuery; $.ajax/$.post stubbed
#   ST*  static anchors: the form's task-is-active, penumbra_repository.js,
#        the calendar no longer locks its dot
#
#   py -3 run.py                        live files              EXPECTED: GREEN
#   py -3 run.py --app <dir>            a stage dir (forward slashes ok)
#   py -3 run.py --control              git HEAD~ copies: see --orig
#   py -3 run.py --orig <dir>           pre-change copies       EXPECTED: RED
#   py -3 run.py --app <dir> --mutants  every mutant must turn its checks RED
# Run it from its own folder; needs calfilter\run.py next door (Edge driver).
# =============================================================================
import argparse, importlib.util, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('calfilter', os.path.join(HERE, '..', 'calfilter', 'run.py'))
cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)
PHP = cf.PHP
APP = cf.APP

# name: (file, old, new, checks that MUST go red)
MUTANTS = {
    'wasactive':   ('manage_schedule.php', "$was_active = ((int)$row['IS_ACTIVE'] === 1) && !$tr_revert;", "$was_active = ((int)$row['IS_ACTIVE'] === 1);", ['SV3', 'SV7']),
    'noenclear':   ('manage_schedule.php', "            if ($new_status === 1 && $tr_revert) {\n                unset($tr_opts['_test_run_revert_disable']);\n", "            if ($new_status === 1 && $tr_revert) {\n", ['SV3']),
    'nopsclear':   ('manage_schedule.php', "                unset($tr_opts['_test_run_pending'], $tr_opts['_test_run_revert_disable']);\n", "                unset($tr_opts['_test_run_revert_disable']);\n", ['SV4', 'SV5']),
    'nowrite':     ('manage_schedule.php', "            if ($tr_new_opts !== null) {\n                // NEXT_RUN", "            if (false) {\n                // NEXT_RUN", ['SV3', 'SV4', 'SV5']),
    'nocancflag':  ('manage_schedule.php', "'test_run_cancelled' => $tr_cancelled]", "'test_run_cancelled' => false]", ['SV4']),
    'noaudopts':   ('manage_schedule.php', "            if ($tr_new_opts !== null) $after_row['OPTIONS'] = $tr_new_opts;\n", "", ['SV4']),
    'jsrevert':    ('js/main.js', "return !!task && parseInt(task.IS_ACTIVE) === 1 && !schedTaskTestMarks(task).revert;", "return !!task && parseInt(task.IS_ACTIVE) === 1;", ['JS1', 'JS3']),
    'jsrestore':   ('js/main.js', "                    if (resp.test_run_cancelled) {\n                        $('#testRunTaskBtn')", "                    if (false) {\n                        $('#testRunTaskBtn')", ['JS2']),
    'jscache':     ('js/main.js', "                                    if (resp.test_run_cancelled) delete o._test_run_pending;\n", "", ['JS3']),
    'jstitle':     ('js/main.js', "const newTitle = schedTaskDotTitle(isNowActive, !!resp.test_run_pending);", "const newTitle = schedTaskDotTitle(isNowActive, false);", ['JS4']),
    'form':        ('js/main.js', "$('#saveTaskBtn').data('task-is-active', schedTaskIsActive(task));", "$('#saveTaskBtn').data('task-is-active', parseInt(task.IS_ACTIVE) === 1);", ['ST1']),
    'repo':        ('js/penumbra_repository.js', "                const isActive = taskOn(t);", "                const isActive = parseInt(t.IS_ACTIVE) === 1;", ['ST2']),
    'callock':     ('analytics_all.php', "            if (t._dotBusy) return;\n            var want", "            if (t.pending || t._dotBusy) return;\n            var want", ['ST3']),
}

R = []
def rec(i, name, ok, detail=''):
    R.append({'id': i, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:600]})

def cut(text, a, b):
    i = text.find(a)
    if i < 0 or text.find(a, i + 1) >= 0: raise RuntimeError('anchor not unique: ' + a[:60])
    j = text.find(b, i)
    if j < 0: raise RuntimeError('end anchor missing: ' + b[:60])
    return text[i:j]

# ------------------------------------------------------------------ SV: server
PH_HEAD = r'''<?php
if (!class_exists('PDO')) { class PDO { const FETCH_ASSOC = 2; } }
class FakeStmt { public $sql; public $b = array();
  function __construct($s) { $this->sql = $s; }
  function bindValue($k, $v) { $this->b[$k] = $v; }
  function execute() { $GLOBALS['LOG'][] = array('sql' => preg_replace('/\s+/', ' ', $this->sql), 'b' => $this->b); return true; }
  function fetch($m = null) { return $GLOBALS['ROW']; } }
class FakeConn { function prepare($s) { return new FakeStmt($s); } }
$conn = new FakeConn(); $GLOBALS['LOG'] = array(); $GLOBALS['AUD'] = array();
$GLOBALS['ROW'] = json_decode(getenv('SV_ROW'), true);
$GLOBALS['COLL_CALLS'] = 0;
function find_db_dump_collision($c, $s, $t, $id, $rid) { $GLOBALS['COLL_CALLS']++; return getenv('SV_COLL') === '1' ? array('ID' => 9, 'OWNER_ID' => 'x', 'REPORT_ID' => 'r', 'LAST_RUN' => null, 'CREATED_AT' => null) : false; }
function get_next_run_date_calc($c) { return getenv('SV_NEVER') === '1' ? false : '2026-11-02 08:00:00'; }
function resolve_report_id($c, $r) { return 7; }
function logPenumbraAudit($rid, $act, $before, $after) { $GLOBALS['AUD'][] = array('act' => $act, 'before' => json_decode($before, true), 'after' => json_decode($after, true)); }
function touch_report_updated_at($c, $r) {}
register_shutdown_function(function () { echo "\n@@SV@@" . json_encode(array('log' => $GLOBALS['LOG'], 'aud' => $GLOBALS['AUD'], 'coll' => $GLOBALS['COLL_CALLS'])); });
$action = 'toggle_status';
$_POST = array('task_id' => '5', 'new_status' => getenv('SV_NS'));
'''

def sv_run(block, row, ns, coll=False, never=False):
    d = tempfile.mkdtemp(prefix='pnb_tgl_')
    try:
        p = os.path.join(d, 't.php')
        with open(p, 'w', encoding='utf-8') as f: f.write(PH_HEAD + block + "\n")
        env = dict(os.environ, SV_ROW=json.dumps(row), SV_NS=str(ns), SV_COLL='1' if coll else '0', SV_NEVER='1' if never else '0')
        out = subprocess.run([PHP, '-n', '-d', 'display_errors=1', '-d', 'error_reporting=-1', p], capture_output=True, env=env)
        txt = out.stdout.decode('utf-8', 'replace')
    finally:
        shutil.rmtree(d, ignore_errors=True)
    if '@@SV@@' not in txt: return {'raw': txt[:500]}
    body, tail = txt.split('@@SV@@', 1)
    res = json.loads(tail)
    try: res['reply'] = json.loads(body.strip())
    except Exception: res['reply'] = None; res['raw'] = body[:500]
    upd = [l for l in res['log'] if l['sql'].lstrip().startswith('UPDATE')]
    res['upd'] = upd[0] if len(upd) == 1 else (upd or None)
    res['opts'] = json.loads(upd[0]['b'][':opts']) if len(upd) == 1 and ':opts' in upd[0]['b'] else None
    return res

def row(active, opts, typ='EMAIL'):
    return {'ID': 5, 'REPORT_ID': 'r1', 'TASK_TYPE': typ, 'RECIPIENTS': 'a@x', 'SUBJECT': 's', 'CRON_EXPRESSION': '0 8 * * *',
            'OPTIONS': json.dumps(opts) if opts is not None else None, 'OWNER_ID': 'jdoe', 'IS_ACTIVE': active,
            'NEXT_RUN': '2026-10-22 17:00:00', 'LAST_RUN': None, 'CREATED_AT': '2026-01-01 00:00:00'}

QP = {'foo': 1, '_test_run_pending': True, '_test_run_revert_disable': True}   # a PAUSED task with a queued test
QA = {'foo': 1, '_test_run_pending': True}                                     # an ACTIVE task with a queued test

def sv_checks(ms):
    try:
        block = cut(ms, "    if ($action === 'toggle_status') {", "    // --- TEST RUN (queue a one-time immediate run) ---")
    except Exception as e:
        rec('SV0', 'toggle_status lifted', False, repr(e)); return
    # SV1 control: a plain pause
    r = sv_run(block, row(1, {'foo': 1}), 0)
    u = r.get('upd') or {}
    rec('SV1', 'control: pausing an active task with no test queued = UPDATE IS_ACTIVE only, "Task disabled.", nothing cancelled',
        r.get('reply', {}).get('status') == 'success' and r['reply']['message'] == 'Task disabled.' and 'OPTIONS' not in u.get('sql', '')
        and u.get('b', {}).get(':active') == 0 and not r['reply'].get('test_run_cancelled'), r)
    # SV2 control: enabling a paused task = NEXT_RUN recalculated
    r = sv_run(block, row(0, {'foo': 1}), 1)
    u = r.get('upd') or {}
    rec('SV2', 'control: enabling a paused task recalculates NEXT_RUN (next_run in the reply); OPTIONS untouched',
        r.get('reply', {}).get('status') == 'success' and 'NEXT_RUN' in u.get('sql', '') and 'OPTIONS' not in u.get('sql', '')
        and r['reply'].get('next_run') == '2026-11-02 08:00:00', r)
    # SV3 hole 1: enable a paused task whose test is queued
    r = sv_run(block, row(1, QP), 1)
    u = r.get('upd') or {}; rp = r.get('reply') or {}
    rec('SV3', 'enabling a PAUSED task with a queued test drops _test_run_revert_disable (keeps _test_run_pending + other options), sets IS_ACTIVE 1, leaves NEXT_RUN (the test\'s) alone; reply says the test still runs and the task stays enabled, next_run = the cron\'s',
        rp.get('status') == 'success' and r.get('opts') == {'foo': 1, '_test_run_pending': True} and u.get('b', {}).get(':active') == 1
        and 'NEXT_RUN' not in u.get('sql', '') and 'stays enabled' in rp.get('message', '') and rp.get('test_run_pending') is True
        and rp.get('test_run_cancelled') is False and rp.get('next_run') == '2026-11-02 08:00:00'
        and r['aud'] and r['aud'][0]['act'] == 'SCHEDULE_ENABLE', r)
    # SV4 hole 2: pause a paused-with-queued-test task (dot shows paused; a crafted/stale POST)
    r = sv_run(block, row(1, QP), 0)
    rp = r.get('reply') or {}; aud = (r.get('aud') or [{}])[0]
    rec('SV4', 'pausing a task whose test is queued (revert flavour) drops BOTH markers and IS_ACTIVE 0 = the test is cancelled; reply test_run_cancelled + says so; the audit AFTER snapshot carries the cleaned OPTIONS',
        rp.get('status') == 'success' and r.get('opts') == {'foo': 1} and (r.get('upd') or {}).get('b', {}).get(':active') == 0
        and rp.get('test_run_cancelled') is True and rp.get('test_run_pending') is False and 'cancelled' in rp.get('message', '')
        and aud.get('after', {}).get('OPTIONS') == {'foo': 1} and aud.get('before', {}).get('OPTIONS') == QP, r)
    # SV5 hole 2, active flavour
    r = sv_run(block, row(1, QA), 0)
    rp = r.get('reply') or {}
    rec('SV5', 'pausing an ACTIVE task with a queued test drops _test_run_pending (the runner would never clear it) and says the test was cancelled',
        rp.get('status') == 'success' and r.get('opts') == {'foo': 1} and rp.get('test_run_cancelled') is True and 'cancelled' in rp.get('message', ''), r)
    # SV6 enabling an already-active task with a queued test is a no-op on the markers
    r = sv_run(block, row(1, QA), 1)
    rp = r.get('reply') or {}; u = r.get('upd') or {}
    rec('SV6', 'enabling an already-active task with a queued test leaves OPTIONS and NEXT_RUN alone; reply test_run_pending true, nothing cancelled',
        rp.get('status') == 'success' and 'OPTIONS' not in u.get('sql', '') and 'NEXT_RUN' not in u.get('sql', '')
        and rp.get('test_run_pending') is True and rp.get('test_run_cancelled') is False, r)
    # SV7 the enable gates apply to a paused-with-queued-test task
    rc = sv_run(block, row(1, dict(QP, destination_table='T1', destination_schema='NC_X'), 'DB_DUMP'), 1, coll=True)
    rn = sv_run(block, row(1, QP), 1, never=True)
    rec('SV7', 'a paused task with a queued test still passes the ENABLE gates: a DB_DUMP collision refuses it, a never-running cron refuses it; nothing written',
        (rc.get('reply') or {}).get('status') == 'collision' and rc.get('coll') == 1 and not rc.get('upd')
        and (rn.get('reply') or {}).get('status') == 'error' and 'never runs' in (rn.get('reply') or {}).get('message', '') and not rn.get('upd'),
        {'coll': rc, 'never': rn})

# --------------------------------------------------------------------- JS
PAGE = '''<!doctype html><html><head><meta charset="utf-8"><title>tgltest</title>
<script src="jquery.js"></script></head><body>
<ul id="scheduledTasksList"></ul><span id="schedEventsCount"></span><a id="schedEventsLogLink"></a><div id="schedAddRow"></div><button id="addNewTaskBtn"></button>
<input id="schedTaskId" value=""><button id="saveTaskBtn"></button><button id="testRunTaskBtn"></button>
<table id="serverReportListTable"><tbody><tr class="selected"><td data-col="TASKS"></td></tr></tbody></table>
<div id="serverReportDetailsPane"><div class="detail-label">Scheduled Events</div></div>
<script>
window.__posts = []; window.__shown = []; window.__preview = 0; window.__list = []; window.__reply = null;
function show_text(h) { window.__shown.push(h); }
function handleSessionExpiredError() {}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ''); }
function syncSchedulerListSelection() {}
function updateCronPreview() { window.__preview++; }
function refreshTestRunDirtyState() {}
window.alert = function (m) { window.__shown.push('ALERT ' + m); };
$.ajax = function (o) { if (window.__frozen) return {}; var d = {data: JSON.parse(JSON.stringify(window.__list))}; setTimeout(function () { o.success(d); }, 5); return {}; };
$.post = function (url, data, cb) { window.__posts.push(data); var r = window.__reply; setTimeout(function () { cb(r); }, 5); return {fail: function () {}}; };
$(function () {
/*LIFT*/
window.__load = loadSchedulerTaskList;
window.__ready = true;
});
</script></body></html>'''

def js_lift(main):
    parts = []
    try: parts.append(cut(main, "    // A queued Test Run (run_now) on a PAUSED task flips IS_ACTIVE to 1 and tags", "    // 2. Load Task List"))
    except Exception: pass   # the control build has no helpers
    parts.append(cut(main, "    // 2. Load Task List", "    // 3. Task Item Click"))
    parts.append(cut(main, "    // --- Toggle Task Status Handler (Green Dot) ---", "    // The event type is chosen in the rail BEFORE"))
    return '\n'.join(parts)

def dot(pg, tid):
    return pg.ev("(function(){var d=document.querySelector('#scheduledTasksList .task-status-toggle[data-task-id=\"%d\"]'); return d ? {ch: d.textContent, ns: String($(d).data('new-status')), title: d.title} : null;})()" % tid)

LIST = [
    {'ID': 11, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': '1', 'OPTIONS': '{}', 'SUBJECT': 'a', 'RECIPIENTS': ''},
    {'ID': 12, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': '1', 'OPTIONS': json.dumps(QP), 'SUBJECT': 'b', 'RECIPIENTS': ''},
    {'ID': 13, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': '1', 'OPTIONS': json.dumps(QA), 'SUBJECT': 'c', 'RECIPIENTS': ''},
    {'ID': 14, 'TASK_TYPE': 'EMAIL', 'IS_ACTIVE': '0', 'OPTIONS': '{}', 'SUBJECT': 'd', 'RECIPIENTS': ''},
]

def js_checks(main):
    try: lifted = js_lift(main)
    except Exception as e:
        rec('JS0', 'main.js lifted', False, repr(e)); return
    root = tempfile.mkdtemp(prefix='pnb_tglweb_')
    br = None
    try:
        shutil.copy(os.path.join(APP, 'js', 'jquery-3.7.1.min.js'), os.path.join(root, 'jquery.js'))
        with open(os.path.join(root, 't.html'), 'w', encoding='utf-8') as f: f.write(PAGE.replace('/*LIFT*/', lifted))
        br = cf.Browser(root); pg = br.pg
        pg.call('Page.navigate', url='http://127.0.0.1:%d/t.html?id=r1&t=%d' % (br.hp, int(time.time() * 1000)))
        if not pg.wait("window.__ready === true", 15000):
            rec('JS0', 'page ready', False, pg.ev("document.readyState")); return
        pg.ev("window.__list = %s; window.__load();" % json.dumps(LIST))
        pg.wait("document.querySelectorAll('#scheduledTasksList .task-status-toggle').length === 4", 3000)
        d11, d12, d13, d14 = (dot(pg, i) for i in (11, 12, 13, 14))
        rec('JS1', 'the Scheduler list: a paused task with a queued test (IS_ACTIVE 1 + revert flag) shows a PAUSED dot that enables (new-status 1) and says the test still runs; an active one with a test says a pause cancels it; plain tasks unchanged',
            d11 and d11['ch'] == '●' and d11['title'] == 'Task is Active. Click to Disable.'
            and d12 and d12['ch'] == '○' and d12['ns'] == '1' and 'test run queued' in d12['title'] and 'stays enabled' in d12['title']
            and d13 and d13['ch'] == '●' and d13['ns'] == '0' and 'cancels the queued test' in d13['title']
            and d14 and d14['ch'] == '○' and d14['title'] == 'Task is Inactive. Click to Enable.', [d11, d12, d13, d14])
        # The Repository's cached row: 11 active, 12 paused-with-test, 13 active-with-test
        pg.ev("$('#serverReportListTable tbody tr.selected').data('full-report-data', {TASKS: %s})" % json.dumps(LIST[:3]))
        # open task 13 with its Test Run queued; pause it -> the server cancels the test
        pg.ev("$('#schedTaskId').val('13'); $('#saveTaskBtn').data('task-is-active', true); $('#testRunTaskBtn').prop('disabled', true).addClass('test-run-pending').html('Test Run Queued'); window.__preview = 0; window.__frozen = true;")
        pg.ev("window.__reply = {status: 'success', message: 'Task disabled. Its queued test run was cancelled.', next_run: null, test_run_pending: false, test_run_cancelled: true}; window.__list = [];")
        pg.ev("$('#scheduledTasksList .task-status-toggle[data-task-id=\"13\"]').trigger('click')")
        pg.wait("window.__posts.length === 1 && $('#saveTaskBtn').data('task-is-active') === false", 2000); time.sleep(0.1)
        st = pg.ev("({dis: $('#testRunTaskBtn').prop('disabled'), pend: $('#testRunTaskBtn').hasClass('test-run-pending'), txt: $('#testRunTaskBtn').text(), prev: window.__preview, act: $('#saveTaskBtn').data('task-is-active'), post: window.__posts[0]})")
        rec('JS2', 'pausing the OPEN task whose test is queued: POST new_status 0; on test_run_cancelled the form\'s Test Run button comes back (enabled, "Test Run") and the Next-run preview is redrawn',
            st['post'] and str(st['post'].get('new_status')) == '0' and str(st['post'].get('task_id')) == '13'
            and st['dis'] is False and st['pend'] is False and 'Test Run' in st['txt'] and 'Queued' not in st['txt'] and st['prev'] >= 1 and st['act'] is False, st)
        cache = pg.ev("(function(){var d=$('#serverReportListTable tbody tr.selected').data('full-report-data'); var t=d.TASKS.filter(function(x){return String(x.ID)==='13';})[0]; return {cnt: d.ACTIVE_TASK_COUNT, opts: JSON.parse(t.OPTIONS), badge: $('#serverReportListTable td[data-col=TASKS]').text()};})()")
        rec('JS3', 'the Repository\'s cached task row follows: the cancelled test\'s marker is gone from OPTIONS, and the active count skips the paused task whose test is queued (1 = only #11)',
            cache['cnt'] == 1 and cache['opts'] == {'foo': 1} and cache['badge'].replace(' ', '') == '1/3', cache)
        # enable the paused-with-test task 12 (not open): its test stays queued
        pg.ev("window.__posts = []; window.__reply = {status: 'success', message: 'Task enabled. Its queued test run still runs on the next scheduler cycle, and the task then stays enabled.', next_run: '2026-11-02 08:00:00', test_run_pending: true, test_run_cancelled: false};")
        pg.ev("$('#scheduledTasksList').empty().append('<li class=\"sched-task-item\"><span class=\"task-status-toggle\" data-task-id=\"12\" data-new-status=\"1\">○</span></li>'); $('#scheduledTasksList .task-status-toggle').trigger('click')")
        pg.wait("window.__posts.length === 1 && $('#scheduledTasksList .task-status-toggle').text() === '●'", 2000); time.sleep(0.1)
        d = pg.ev("(function(){var d=$('#scheduledTasksList .task-status-toggle'); return {ch: d.text(), title: d.attr('title'), ns: String(d.data('new-status')), post: window.__posts[0]};})()")
        cache = pg.ev("(function(){var d=$('#serverReportListTable tbody tr.selected').data('full-report-data'); var t=d.TASKS.filter(function(x){return String(x.ID)==='12';})[0]; return {cnt: d.ACTIVE_TASK_COUNT, opts: JSON.parse(t.OPTIONS)};})()")
        rec('JS4', 'enabling the paused task whose test is queued: the dot turns active and its tooltip still mentions the queued test (pausing would cancel it); the cached row drops only the revert flag and counts it active (2)',
            str(d['post'].get('new_status')) == '1' and d['ch'] == '●' and d['ns'] == '0' and 'test run queued' in (d['title'] or '')
            and cache['cnt'] == 2 and cache['opts'] == {'foo': 1, '_test_run_pending': True}, {'dot': d, 'cache': cache})
    except Exception as e:
        rec('JSX', 'JS harness', False, repr(e))
    finally:
        if br: br.close()
        shutil.rmtree(root, ignore_errors=True)

# ------------------------------------------------------------------ ST: static
def st_checks(main, repo, cal):
    rec('ST1', 'the Scheduler form reads the effective state (a paused task with a queued test opens as disabled)',
        main.count("$('#saveTaskBtn').data('task-is-active', schedTaskIsActive(task));") == 1 and "data('task-is-active', parseInt(task.IS_ACTIVE) === 1)" not in main)
    rec('ST2', 'penumbra_repository.js: the details-pane dots + "N of M active" read the effective state via main.js\'s helper',
        "window.penumbraSchedTaskIsActive(t)" in repo and repo.count("                const isActive = taskOn(t);") == 1 and "report.TASKS.filter(taskOn)" in repo
        and 'window.penumbraSchedTaskDotTitle' in repo)
    rec('ST3', 'the calendar no longer locks its dot while a test is queued, and a pause that cancels the test clears its "Test queued"',
        "            if (t._dotBusy) return;\n            var want" in cal and "if (t.pending || t._dotBusy) return;\n            var want" not in cal
        and "if (resp.test_run_cancelled) t.pending = 0;" in cal and "var locked = !!t.pending" not in cal)

def read(p):
    with open(p, 'rb') as f: return f.read().decode('utf-8', 'replace').replace('\r\n', '\n')

def run_build(label, app, mutant=None):
    global R
    R = []
    texts = {f: read(os.path.join(app, f)) for f in ('manage_schedule.php', 'js/main.js', 'js/penumbra_repository.js', 'analytics_all.php')}
    if mutant:
        f, old, new, _ = MUTANTS[mutant]
        if texts[f].count(old) != 1: raise RuntimeError('mutant %s anchor x%d' % (mutant, texts[f].count(old)))
        texts[f] = texts[f].replace(old, new)
    sv_checks(texts['manage_schedule.php'])
    js_checks(texts['js/main.js'])
    st_checks(texts['js/main.js'], texts['js/penumbra_repository.js'], texts['analytics_all.php'])
    npass = sum(1 for r in R if r['pass'])
    print('== %s ==' % label)
    for r in R: print('%s %-4s %s%s' % ('ok  ' if r['pass'] else 'FAIL', r['id'], r['name'], '' if r['pass'] else '   -> ' + r['detail']))
    print('SUMMARY  pass=%d  fail=%d' % (npass, len(R) - npass))
    sys.stdout.flush()
    return [r['id'] for r in R if not r['pass']]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', default=APP); ap.add_argument('--orig'); ap.add_argument('--mutants', action='store_true'); ap.add_argument('--mutant')
    a = ap.parse_args()
    if a.orig:
        fails = run_build('control ' + a.orig, a.orig)
        sys.exit(0 if fails else 1)   # the control MUST be red
    if a.mutants or a.mutant:
        bad = 0
        for n in (list(MUTANTS) if a.mutants else [a.mutant]):
            red = set(run_build('mutant ' + n, a.app, n)); must = set(MUTANTS[n][3])
            if not must <= red: print('MUTANT %s SURVIVED: must=%s red=%s' % (n, sorted(must), sorted(red))); bad += 1
            else: print('MUTANT %s killed (%s)' % (n, ' '.join(sorted(red))))
        sys.exit(1 if bad else 0)
    fails = run_build('build ' + a.app, a.app)
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
