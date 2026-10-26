# =============================================================================
# LDSORT SUITE (2026-10-23) - a report's SAVED sort at load, by name
#
# A save keeps each sort level's colIndex: the column's place in the result when the report was saved. The state
# load trusted it verbatim (sortCriteria = decodedState.sortCriteria), while a re-query's carry-over re-resolves each
# level by NAME against the new header map. After the report's SQL added or moved a column, the saved place held
# another column: the report opened sorted, and marked, by a column its author never chose, and the page's re-sorts
# (_pnbResortGroupedView / _pnbResortFlatView: the place and the name must agree) left it off after a regroup or
# Remove Grouping while sortCriteria still held it. The fix: _pnbStateSortByName in the query success handler, on a
# state load, after the ?sort= override - by name; a gone name dropped with the re-query's NOTICE unless the result
# has as many columns as the saved column order (renamed in place: the place kept, under the column's name now);
# '#' and journal columns as they are; a pivot's chain as saved. Kit: penumbra_tests\ldsort\stage_20261023.
# (2026-10-25, urlnum) A ?sort= level on a column named 2021 was the TEXT '2021' (numurl pinned it as a GUARD): the
# next click on the heading started over at ascending and the header menu's Clear sort did nothing. The resolver now
# names it as the heading's data() reads it (the NUMBER 2021), and the by-name pass gives every level it keeps that
# form - one saved as text too (numsaved). URLNUM_NEW: the checks a build without that fix fails.
#
# Each scenario loads the REAL main.js (+ the live grouping module) through the REAL run path (a stubbed query.php)
# from a stored state (harness.html) and publishes named checks:
#   L-<scn>-<check>  must hold on the candidate
#   E-<scn>          no page errors
#
#   py -3 run.py                        candidate = LIVE js\main.js
#   py -3 run.py --stage DIR            DIR\js\main.js
#   py -3 run.py --live-control         the LIVE build: the NEW checks red, the GUARDs green (a build with the fix
#                                       already: every check green)
#   py -3 run.py --live-control --rev REV   the same on the build at a git revision (e.g. <the urlnum commit>^)
#   py -3 run.py --stage DIR --mutant a,b / --mutants [--verbose]
#   --scn a,b                           a subset of scenarios
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js',
        'penumbra_colwidths.js', 'penumbra_grouplist.js', 'penumbra_presets.js', 'penumbra_calc.js']
CSS = ['main.css', 'density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css']
MARKER = 'function _pnbStateSortByName('
SCN = [('flat', ''), ('group', ''), ('multi', ''), ('gone', ''), ('allgone', ''), ('renamed', ''), ('renamedrq', ''),
       ('casename', ''), ('numname', ''), ('hash', ''), ('journal', ''), ('urlsort', '&sort=V_NAME%7Cdesc'), ('pivot', ''),
       ('requery', ''), ('taken', ''),
       # v2 (the review's finds): two columns sharing a name but for its case, a ?sort= on a column named 2021, a
       # renamed level onto it, a viewer's own calculated column, a nameless level, two levels on one column, a pivot
       # report under a pinned grouping (&id=: the calc store and the presets are kept per report)
       ('casedup', ''), ('numurl', '&sort=2021%7Cdesc'), ('numrenamed', ''), ('mycalc', '&id=ldcalc'), ('nameless', ''),
       ('dup', ''), ('pivotgrp', '&id=ldpiv'),
       # v3 (2026-10-25, urlnum): a level saved as the text '2021' - a save made from a ?sort= view before urlnum
       ('numsaved', '')]
# every check a scenario must publish (a missing one fails)
CHK = {
    'flat': ['sortByName', 'rowsByName', 'marksByName', 'page1', 'noNotice', 'regroupSorted', 'regroupMarks', 'removeSorted'],
    'group': ['sortByName', 'groupsByName', 'groupMarks', 'noNotice', 'regroupKeeps', 'removeKeeps'],
    'multi': ['sortByName', 'rowsByName', 'marksByName', 'noNotice'],
    'gone': ['dropped', 'notice', 'rowsByName', 'marksByName'],
    'allgone': ['emptied', 'natural', 'unmarked', 'notice'],
    'renamed': ['keptByPlace', 'noNotice', 'healed', 'clickDesc'],
    'renamedrq': ['requeryKeeps', 'requeryNoNotice'],
    'casename': ['keptByPlace', 'noNotice', 'healed', 'clickDesc'],
    'numname': ['sortByName', 'numberForm', 'rowsByName', 'marksByName', 'noNotice', 'clickDesc'],
    'hash': ['hashKept'],
    'journal': ['virtualKept', 'sortByName', 'rowsByName'],
    'urlsort': ['urlWins', 'noNotice'],
    'pivot': ['chainAsSaved', 'noNotice'],
    'requery': ['carried', 'noNotice'],
    'taken': ['sortByName', 'notice'],
    'casedup': ['atItsPlace', 'noNotice'],
    'numurl': ['urlNumber', 'noNotice', 'clickOff'],
    'numrenamed': ['keptByPlace', 'numberForm', 'clickDesc'],
    'mycalc': ['calcThere', 'keptByPlace', 'noNotice', 'healed'],
    'nameless': ['leftOut', 'noNotice'],
    'dup': ['oneLevel', 'noNotice', 'clickDesc'],
    'pivotgrp': ['grouped', 'chainAsSaved', 'noNotice'],
    'numsaved': ['numberForm', 'rowsByName', 'marksByName', 'noNotice', 'clickDesc'],
}
# the checks the build before the fix fails (the rest are GUARDs: green on both)
NEW = ['L-flat-sortByName', 'L-flat-rowsByName', 'L-flat-marksByName', 'L-flat-page1', 'L-flat-regroupSorted', 'L-flat-regroupMarks',
       'L-flat-removeSorted',
       'L-group-sortByName', 'L-group-groupsByName', 'L-group-groupMarks', 'L-group-regroupKeeps', 'L-group-removeKeeps',
       'L-multi-sortByName', 'L-multi-rowsByName', 'L-multi-marksByName',
       'L-gone-dropped', 'L-gone-notice', 'L-gone-rowsByName', 'L-gone-marksByName',
       'L-allgone-emptied', 'L-allgone-natural', 'L-allgone-unmarked', 'L-allgone-notice',
       'L-renamed-healed', 'L-renamed-clickDesc', 'L-renamedrq-requeryKeeps', 'L-renamedrq-requeryNoNotice',
       'L-casename-healed', 'L-casename-clickDesc',
       # (numberForm is a GUARD: the build before keeps the saved number as it is; it is there for ld-strheal)
       'L-numname-sortByName', 'L-numname-rowsByName', 'L-numname-marksByName', 'L-numname-clickDesc',
       'L-journal-sortByName', 'L-journal-rowsByName',
       'L-taken-sortByName', 'L-taken-notice',
       'L-numrenamed-numberForm', 'L-numrenamed-clickDesc', 'L-mycalc-healed', 'L-nameless-leftOut', 'L-dup-oneLevel', 'L-dup-clickDesc']
# (2026-10-25, urlnum) ...and the checks a build without urlnum's fix fails (the ?sort= resolver's text level, and one
# saved as text): red there, whatever ldsort's own fix
URLNUM_NEW = ['L-numurl-urlNumber', 'L-numurl-clickOff', 'L-numsaved-numberForm', 'L-numsaved-clickDesc']
URLNUM_MARKER = "criteria.push({ colIdentifier: typeof asClick === 'number' ? asClick : upper, colIndex: hit.idx, direction: dir });"

# the load's own block (patch_ldsort.py BLOCK), cut out of a candidate for the reorder mutant
BLOCK_HEAD = '\r\n                    // (2026-10-23, ldsort) A state load\'s saved sort, on the same terms: by name against\r\n'
BLOCK_TAIL = "                        } catch (_ldSortErr) { console.warn('Saved sort check skipped:', _ldSortErr); }\r\n                    }\r\n"
URL_HEAD = "                    // ?sort= URL override: replace the report's saved on-load column\r\n"
def before_url(t):
    i = t.find(BLOCK_HEAD); j = t.find(BLOCK_TAIL, i)
    if i < 0 or j < 0 or t.count(URL_HEAD) != 1: raise SystemExit("mutant 'ld-beforeurl': anchors not found")
    block = t[i + 2:j + len(BLOCK_TAIL)]
    t = t[:i] + t[j + len(BLOCK_TAIL):]
    return t.replace(URL_HEAD, block + '\r\n' + URL_HEAD)

# name: ([(old, new)] or a function of the text, the checks that must go red, the scenarios to run)
MUTANTS = {
    # the load's pass off: the saved sort trusted by its place again
    'ld-off': ([('                    if (isStateLoading && Array.isArray(sortCriteria) && sortCriteria.length && !pendingPivotSettings && !(decodedState && decodedState.pivot)) {\r\n',
                 '                    if (false && isStateLoading && Array.isArray(sortCriteria) && sortCriteria.length && !pendingPivotSettings && !(decodedState && decodedState.pivot)) {\r\n')],
               ['L-flat-sortByName', 'L-flat-rowsByName', 'L-group-regroupKeeps', 'L-gone-notice'], ['flat', 'group', 'gone']),
    # a pivot's chain re-resolved as if it named source columns (both pivot gates off)
    'ld-nopivot': ([(' && !pendingPivotSettings && !(decodedState && decodedState.pivot)) {\r\n                        try {\r\n                            var _ldOrder',
                     ') {\r\n                        try {\r\n                            var _ldOrder')],
                   ['L-pivot-chainAsSaved', 'L-pivotgrp-chainAsSaved'], ['pivot', 'pivotgrp']),
    # ...a pivot REPORT's, when a pinned grouping takes its load (the saved view's gate off)
    'ld-pivotstate': ([(' && !(decodedState && decodedState.pivot)) {\r\n', ') {\r\n')],
                      ['L-pivotgrp-chainAsSaved'], ['pivotgrp']),
    # '#' and journal columns looked up by name (and dropped)
    'ld-novirtual': ([("        var isVirtual = function (c) { return c.colIndex === '#' || (typeof c.colIndex === 'string' && c.colIndex.indexOf('__') === 0); };\r\n",
                       "        var isVirtual = function (c) { return false; };\r\n")],
                     ['L-hash-hashKept', 'L-journal-virtualKept'], ['hash', 'journal']),
    # a gone name always dropped (the renamed-in-place fallback off; casename resolves by name, never through it)
    'ld-nofallback': ([('                if (savedCount !== ours || at < 0', '                if (true || savedCount !== ours || at < 0')],
                      ['L-renamed-keptByPlace', 'L-renamed-noNotice', 'L-renamedrq-requeryKeeps', 'L-renamedrq-requeryNoNotice'], ['renamed', 'renamedrq']),
    # the fallback without its column count: a gone column's place kept (it holds another column)
    'ld-nocount': ([('                if (savedCount !== ours || at < 0', '                if (at < 0')],
                   ['L-gone-dropped', 'L-gone-notice', 'L-allgone-emptied'], ['gone', 'allgone']),
    # the count with the viewer's own calculated columns in it (a save leaves them out)
    'ld-countmine': ([('        var ours = names.filter(function (n, i) { return !mine(i); }).length;\r\n', '        var ours = names.length;\r\n')],
                     ['L-mycalc-keptByPlace', 'L-mycalc-noNotice', 'L-mycalc-healed'], ['mycalc']),
    # the fallback onto a place another level names by name
    'ld-notaken': ([(' || named[at] || mine(at)) {', ' || mine(at)) {')],
                   ['L-taken-sortByName', 'L-taken-notice'], ['taken']),
    # by name alone: the saved place is not kept when the column there has the level's name
    'ld-placefirst': ([('            return (at >= 0 && at < names.length && names[at].toUpperCase() === u) ? at : byName[u];\r\n',
                        '            return byName[u];\r\n')],
                      ['L-casedup-atItsPlace'], ['casedup']),
    # a second level on one column kept
    'ld-nodedupe': ([('            if (used[i]) return;\r\n', '')],
                    ['L-dup-oneLevel'], ['dup']),
    # a level with no name looked up anyway (as "UNDEFINED")
    'ld-nameless': ([("        var isLevel = function (c) { return !!c && typeof c === 'object' && c.colIdentifier !== undefined && c.colIdentifier !== null && String(c.colIdentifier) !== ''; };\r\n",
                      "        var isLevel = function (c) { return !!c && typeof c === 'object'; };\r\n")],
                    ['L-nameless-leftOut'], ['nameless']),
    # a level keeps the name it was saved with, whatever it is
    'ld-noheal': ([('            kept.push({ colIdentifier: heading(names[i]),\r\n',
                    '            kept.push({ colIdentifier: c.colIdentifier,\r\n')],
                  ['L-renamed-healed', 'L-renamed-clickDesc', 'L-casename-healed', 'L-renamedrq-requeryKeeps', 'L-numrenamed-numberForm',
                   'L-numsaved-numberForm', 'L-numsaved-clickDesc'],
                  ['renamed', 'casename', 'renamedrq', 'numrenamed', 'numsaved']),
    # (2026-10-25, urlnum; it replaces ld-healall, which pinned the ?sort= level's text) a level that names its column
    # as text already is kept as it is - the build before urlnum: a saved '2021' stays text
    'ld-keepnamed': ([('            kept.push({ colIdentifier: heading(names[i]),\r\n',
                       '            kept.push({ colIdentifier: String(c.colIdentifier) === names[i].toUpperCase() ? c.colIdentifier : heading(names[i]),\r\n')],
                     ['L-numsaved-numberForm', 'L-numsaved-clickDesc'], ['numsaved']),
    # (2026-10-25, urlnum) both halves of urlnum off: the ?sort= level the text '2021' again, passed as it is
    'ld-urltext': ([("criteria.push({ colIdentifier: typeof asClick === 'number' ? asClick : upper, colIndex: hit.idx, direction: dir });",
                     "criteria.push({ colIdentifier: upper, colIndex: hit.idx, direction: dir });"),
                    ('            kept.push({ colIdentifier: heading(names[i]),\r\n',
                     '            kept.push({ colIdentifier: String(c.colIdentifier) === names[i].toUpperCase() ? c.colIdentifier : heading(names[i]),\r\n')],
                   ['L-numurl-urlNumber', 'L-numurl-clickOff', 'L-numsaved-numberForm', 'L-numsaved-clickDesc'], ['numurl', 'numsaved']),
    # the heading's name as a string (not as jQuery's data() reads it: 2021 a number)
    'ld-strheal': ([("        var heading = function (n) { var u = String(n).toUpperCase(), d = $('<th>').attr('data-colname', u).data('colname'); return typeof d === 'number' ? d : u; };\r\n",
                     "        var heading = function (n) { return String(n).toUpperCase(); };\r\n")],
                   ['L-numrenamed-numberForm', 'L-numrenamed-clickDesc'], ['numrenamed']),
    # no NOTICE for a dropped level
    'ld-nonotice': ([('                            if (_ldSort.dropped.length) {\r\n', '                            if (false) {\r\n')],
                    ['L-gone-notice', 'L-allgone-notice', 'L-taken-notice'], ['gone', 'allgone', 'taken']),
    # every level ascending
    'ld-asc': ([("colIndex: i, direction: c.direction === 'desc' ? 'desc' : 'asc' });", "colIndex: i, direction: 'asc' });")],
               ['L-flat-sortByName', 'L-flat-rowsByName', 'L-multi-sortByName'], ['flat', 'multi']),
    # the pass before the ?sort= override: the saved sort it replaces is reported
    'ld-beforeurl': (before_url, ['L-urlsort-noNotice'], ['urlsort']),
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
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
rev = opt('--rev', None)
all_mutants = flag('--mutants')
verbose = flag('--verbose')
live_control = flag('--live-control')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
if live_control and (stage_dir or all_mutants or one_mutant): raise SystemExit('--live-control runs the live build alone')
if rev and not live_control: raise SystemExit('--rev is for --live-control')
main_path = os.path.join(stage_dir or APP, 'js', 'main.js')
# (2026-10-25, urlnum) --live-control --rev REV: the build at a git revision in the live one's place
if rev:
    sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import git_show
    main_path = git_show(rev, 'js/main.js')

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    # the page's sort; every show_text (the NOTICEs); the chain the pivot branch replays; the grouped rebuilds
    h = ('\r\n;try { window.__HC = {'
         ' getSort: function () { try { return JSON.parse(JSON.stringify(sortCriteria)); } catch (e) { return null; } } }; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { var __pnbST = show_text; show_text = function (t) { (window.__NOTICES = window.__NOTICES || []).push(String(t)); return __pnbST.apply(this, arguments); }; } catch (e) { window.__HC_ERR2 = String(e); }\r\n'
         'try { var __pnbRP = penumbraReplayPivotSortChain; penumbraReplayPivotSortChain = function (c) { (window.__REPLAYS = window.__REPLAYS || []).push(JSON.parse(JSON.stringify(c || null))); return __pnbRP.apply(this, arguments); }; } catch (e) { window.__HC_ERR3 = String(e); }\r\n'
         'try { var __pnbRGV = rebuildGroupedView; rebuildGroupedView = function () { window.__REBUILDS = (window.__REBUILDS || 0) + 1; return __pnbRGV.apply(this, arguments); }; } catch (e) { window.__HC_ERR4 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(text, name):
    edits = MUTANTS[name][0]
    if callable(edits): return edits(text)
    for old, new in edits:
        if text.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times: %r" % (name, text.count(old), old[:90]))
        text = text.replace(old, new)
    return text

stage = tempfile.mkdtemp(prefix='pnb_ld_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(scn, extra):
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 240:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        st = call('Runtime.evaluate', {'expression': 'JSON.stringify({step: window.__STEP || null, errs: (window.__errors || []).concat(window.__rejections || []).slice(0, 3), hides: window.__HC_HIDES || 0, q: window.__queryDone})', 'returnByValue': True}).get('result', {}).get('value')
        return {'fatal': 'timeout (240 s) at %s' % st}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    return {s: run_page(s, x) for s, x in SCN if s in scns}

def evaluate(res, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r = res.get(s, {})
        if r.get('fatal') and not r.get('chk'):
            add('F-' + s, False, (r.get('fatal') or '')[:400]); continue
        add('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing') and not r.get('fatal'),
            'errors %s %s %s %s' % (r.get('errors'), r.get('hookErr'), r.get('missing'), (r.get('fatal') or '')[:300]))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:420]) if v is not True else ''))
    return out

try:
    names = [s for s, _ in SCN]
    if scn_arg: names = [s for s in names if s in scn_arg.split(',')]
    text = read_b(main_path)
    print('candidate: %s (%s the fix; %s urlnum\'s)' % (main_path, 'with' if MARKER in text else 'WITHOUT', 'with' if URLNUM_MARKER in text else 'WITHOUT'))
    if all_mutants or one_mutant:
        if MARKER not in text: raise SystemExit('mutants need a build with the fix (--stage)')
        ok = bad = 0
        for m in (one_mutant.split(',') if one_mutant else list(MUTANTS)):
            _, must, scns = MUTANTS[m]
            res = evaluate(run_build(mutate(text, m), scns), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-30s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
    else:
        res = evaluate(run_build(text, names), names)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-32s %s' % ('PASS' if passed else 'FAIL', a, d[:480]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if live_control:
            expect = ([] if MARKER in text else NEW) + ([] if URLNUM_MARKER in text else URLNUM_NEW)
            print('CONTROL: the fix is %s live main.js, urlnum\'s %s - %d checks expected RED' % ('in' if MARKER in text else 'not in',
                  'in' if URLNUM_MARKER in text else 'not', len(expect)))
            seen = [a for a, _, _ in res]
            new_green = [a for a in expect if a in seen and a not in failed]
            new_unseen = [a for a in expect if a not in seen and a.split('-')[1] in names]
            old_red = [a for a in failed if a not in expect]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            if MARKER not in text:
                red = [a for a in NEW if a in failed]
                if red: print('NOTE: the fix is not in this build: %d of its checks are red as on the build before it' % len(red))
            if URLNUM_MARKER not in text:
                red = [a for a in URLNUM_NEW if a in failed]
                if red: print('NOTE: urlnum\'s fix is not in this build: %d of its checks are red as on the build before it' % len(red))
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
