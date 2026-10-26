# =============================================================================
# SCHEDSORT SUITE (2026-10-24) - a SCHEDULED output (email, exports, file drops, snapshots, a custom template, a
# task filter's re-derived output) sorts by the same columns as the page: a report's saved sort read BY NAME.
#
# A save keeps each sort level's colIdentifier as its heading's name in UPPER case and its colIndex as the column's
# place in the page's result. Since ldsort (d1b8d52) the page finds each level again by its name (main.js
# _pnbStateSortByName); since srvsort (3131a68) the ?json=1 API and a report's stub do too, through the PHP twin
# (penumbra_layout.php pnb_sort_state_here). schedule_runner.php apply_state_logic sorted by the saved name as the
# rows' exact key: a column whose name is not all upper case (an MSSQL result, a quoted alias, a calculated column's
# label) never sorted, nor a level renamed in place. schedsort: step 1 reads the sort through the twin
# (penumbra_sched_sort_rows), and a custom template's rows are sorted with the whole state.
#
#   page half    parity.html + parity.js + lifted.js (the candidate main.js's OWN _pnbStateSortByName, the query
#                success handler's header map and its ldsort block): srvsort's corpus + the scheduler's own cases +
#                320 fuzzed -> the columns the page sorts by (Edge over CDP)
#   runner half  sched.php on a MIRROR of schedule_runner.php (pivotparity\extract_mirror.php: its functions only)
#                with the real penumbra_template.php, penumbra_search.php and journal_export.php:
#                  H-sched-<id>   apply_state_logic's rows in the order of the columns the page sorts by
#                  H-grp-<id>     ...grouped by a tie column: the rows within each band
#                  H-tpl-<id>     a custom template's rows (penumbra_tpl_flat_source)
#                  H-filter-<id>  a task filter's re-derived output (apply_search_filter_via_raw)
#                  P-direct-<id>  penumbra_sched_sort_rows itself, on the rows without the tag, == the main rows
#                  O-*-<id>       a state the page reads as before reads exactly as in the reference cut
#                  W-<id>         no warning the reference cut did not raise
#                  H-S2-*         the twin's file missing or empty: by the name as before, never a fatal (and
#                                 H-S2-*-nothrow: a level that is a string no longer throws - PHP 8's TypeError)
#   source       H-S1-* (the calls, where they are), S-lint-* (php -n -l, 8.2)
#
#   py -3 run.py [--stage DIR]       candidate = DIR\<file> where it exists, else the live webroot's
#   py -3 run.py --control           the LIVE files: the NEW checks red, every GUARD green
#   py -3 run.py --stage DIR --mutants | --mutant a,b
#   [--ref DIR]   the files BEFORE schedsort (default: the kit's live\ cut)   [--main FILE]  main.js (default: live)
# Headless Edge over CDP (one page, once per run); stages into %TEMP%\pnb_sch_*; writes nothing to the webroot.
# NEVER loads schedule_runner.php itself (Oracle + it SENDS MAIL): a mirror of its functions. Run it through the
# kit's run_suite.ps1 (one Edge suite at a time across sessions).
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EXT82 = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext'     # forward slashes: -d eats a leading \\
EXTRACT = os.path.join(os.path.dirname(HERE), 'pivotparity', 'extract_mirror.php')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
KIT = os.path.join(HERE, 'stage_20261024')
FILES = {'sr': 'schedule_runner.php', 'tpl': 'penumbra_template.php'}

# --- targeted mutants: (file key, old, new) each once; the checks one of which must go red ---
MUTANTS = {
    # penumbra_sched_sort_rows (schedule_runner.php, CRLF: the anchors are LF and matched with CRLF)
    'm-twin': ([('sr', "        if (is_array($first) && function_exists('pnb_sort_state_here')) {\n", "        if (false) {\n")],
               ['H-sched-mixed', 'H-sched-renamed', 'H-sched-mattpins']),
    'm-key': ([('sr', "                    $cols[] = is_int($crit['colIndex']) ? $keys[$crit['colIndex']] : $crit['colIdentifier'];\n",
                "                    $cols[] = $crit['colIdentifier'];\n")], ['H-sched-mixed', 'H-sched-almpivot', 'H-sched-mattpins']),
    'm-marker': ([('sr', "                    $crit['pnbAsSaved'] = true;\n", "")], ['H-sched-mixed', 'H-sched-almpivot', 'H-sched-lowercase']),
    'm-journal': ([('sr', "                    if (isset($crit['colIndex']) && is_string($crit['colIndex']) && isset($journal[$crit['colIndex']])) $crit['colIndex'] = '__' . $crit['colIndex'];\n", "")],
                  ['H-sched-journal', 'H-sched-journalby', 'H-sched-mixedjournal']),
    'm-skip': ([('sr', "            $read = pnb_sort_state_here($st, $keys, $skip);\n", "            $read = pnb_sort_state_here($st, $keys, array());\n")],
               ['H-sched-journalren', 'H-sched-mixedjournalren', 'H-sched-journalnotes']),
    'm-notsaved': ([('sr', "            $read = pnb_sort_state_here($st, $keys, $skip);\n", "            $read = pnb_sort_state_here($st, $keys, $skip, pnb_layout_calc_names($state));\n")],
                   ['H-sched-calcren', 'H-sched-mixedcalcren', 'H-sched-calcinput']),
    # (no m-tail: the stub's tail, pnb_sort_calc_tail, leaves out a calculated column these rows have - all of them
    # here - so handing it on is an equivalent mutant: the twin's own rule keeps the count right)
    'm-nest': ([('sr', "            $nsCol = $cols[$ci];\n", "            $nsCol = isset($crit['colIdentifier']) ? $crit['colIdentifier'] : null;\n")], ['H-sched-mixednest']),
    # (the custom order by the name as SAVED: a level renamed in place keeps the old name, the order is keyed by the new)
    'm-custom': ([('sr', "                ? get_custom_sort_comparator($customSortOrders, $crit['colIdentifier'])\n",
                   "                ? get_custom_sort_comparator($customSortOrders, isset($state['sortCriteria'][$ci]['colIdentifier']) ? $state['sortCriteria'][$ci]['colIdentifier'] : null)\n")],
                 ['H-sched-mixedcustomren']),
    # (the custom order by the row's key: PHP's ASCII case fold misses an upper-case name outside ASCII - the review's finding 1)
    'm-customkey': ([('sr', "                ? get_custom_sort_comparator($customSortOrders, $crit['colIdentifier'])\n",
                      "                ? get_custom_sort_comparator($customSortOrders, $cols[$ci])\n")],
                    ['H-sched-customunicode']),
    'm-hard': ([('sr', "        if (is_array($first) && !function_exists('pnb_sort_state_here') && is_file(__DIR__ . '/penumbra_layout.php')) @include_once __DIR__ . '/penumbra_layout.php';\n",
                 "        if (is_array($first) && !function_exists('pnb_sort_state_here')) require_once __DIR__ . '/penumbra_layout.php';\n")], ['H-S2-missing']),
    # (the soft include without its file check: a mirror without the twin beside it warns - other suites count those)
    'm-nofile': ([('sr', "!function_exists('pnb_sort_state_here') && is_file(__DIR__ . '/penumbra_layout.php')) @include_once", "!function_exists('pnb_sort_state_here')) @include_once")],
                 ['H-S2-missing-quiet']),
    'm-soft': ([('sr', "        if (is_array($first) && function_exists('pnb_sort_state_here')) {\n", "        if (is_array($first)) {\n")], ['H-S2-missing', 'H-S2-empty']),
    'm-call': ([('sr', "    $data = penumbra_sched_sort_rows($data, $state, $preserveCols);\n", "    $data = penumbra_sched_sort_rows($data, array('sortCriteria' => null) + $state, $preserveCols);\n")],
               ['H-S1-step1', 'H-sched-mixed']),
    # the count of a template's call: the column order it hands on (schedule_runner.php reads it, the template passes it)
    'm-tplread': ([('sr', "            if (!isset($st['columnOrder']) && isset($state['pnbSortColumnOrder'])) $st['columnOrder'] = $state['pnbSortColumnOrder'];\n", "")],
                  ['H-tpl-renamed', 'H-tpl-mattpins', 'H-tpl-mixedren']),
    # penumbra_template.php (LF): a custom template's rows
    'm-tplorder': ([('tpl', "        if (isset($apiResult['columnOrder'])) $st['pnbSortColumnOrder'] = $apiResult['columnOrder'];\n", "")],
                   ['H-tpl-renamed', 'H-tpl-mattpins', 'H-tpl-mixedren']),
    'm-tplskip': ([('tpl', "        $toggleCols[] = $NUM;\n", "")], ['H-tpl-renamed', 'H-tpl-mattpins', 'H-tpl-mixedren']),
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
ref_dir = opt('--ref', os.path.join(KIT, 'live'))
main_js = opt('--main', os.path.join(APP, 'js', 'main.js'))
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
keep = flag('--keep')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
def pick(rel):
    if control or not stage_dir: return os.path.join(APP, rel)
    p = os.path.join(stage_dir, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {k: pick(v) for k, v in FILES.items()}
ref = {k: os.path.join(ref_dir, v) for k, v in FILES.items()}
print('candidate: ' + ', '.join('%s=%s' % (v, cand[k]) for k, v in FILES.items()))
print('reference: ' + ref_dir + '   main.js: ' + main_js)
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape') if os.path.exists(p) else ''
def fs(p): return p.replace('\\', '/')

# ---- the page's own code, lifted out of main.js (srvsort's lift, as it is)
def lift_main(src):
    s = src.replace('\r\n', '\n')
    def once(a, what):
        if s.count(a) != 1: raise SystemExit('main.js: %s found %d times' % (what, s.count(a)))
        return s.find(a)
    a = once('    function _pnbStateSortByName(criteria, nameToIdx, savedCount, notSaved) {\n', '_pnbStateSortByName')
    b = s.find('    // Serialize the ACTIVE flat-table column sort back into the ?sort= grammar\n', a)
    la = once('                    // (2026-10-23, ldsort) A state load\'s saved sort, on the same terms: by name against\n', 'the ldsort block')
    lb = s.find('                    // Carry the previous run\'s column sort across a re-query. The\n', la)
    ha = s.rfind('                    const newColumnNames = Object.keys(data[0]);\n', 0, la)
    hb = s.find('                    // ?sort= URL override: replace the report\'s saved on-load column\n', ha)
    if min(b, lb, ha, hb) < 0 or not (ha < hb < la): raise SystemExit('main.js: the sort code is not where it was (%d %d %d %d)' % (b, lb, ha, hb))
    return ('// lifted.js - generated by schedsort run.py from %s\n(function () {\n  try {\n' % main_js.replace('\\', '/')
            + s[a:b]
            + '    window.__SS = _pnbStateSortByName;\n'
              '    window.__LOADSORT = function (data, decodedState, sortCriteria, pendingPivotSettings, isCalc) {\n'
              '      var isStateLoading = true, notices = [];\n'
              '      var show_text = function (h) { notices.push(String(h)); };\n'
              '      var escapeHtml = function (x) { return String(x); };\n'
              '      window.PenumbraCalc = { isCalc: isCalc };\n'
            + s[ha:hb] + s[la:lb]
            + '      return { sortCriteria: sortCriteria, names: newColumnNames, nameToIdx: columnNameToOriginalIndex, notices: notices };\n    };\n'
              '  } catch (e) { window.__LIFT_ERR = String(e && e.stack || e); }\n})();\n')

stage = tempfile.mkdtemp(prefix='pnb_sch_')
for f in ('parity.html', 'parity.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'jquery-3.7.1.min.js'), os.path.join(stage, 'jquery.js'))
open(os.path.join(stage, 'lifted.js'), 'wb').write(lift_main(read_b(main_js)).encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def page_side():
    hp, dp = free_port(), free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                             '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--remote-debugging-port=%d' % dp,
                             '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        def jget(p, m='GET'):
            return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
        for _ in range(150):
            try: jget('/json/version'); break
            except Exception: time.sleep(0.2)
        t = jget('/json/new?about:blank', 'PUT')
        ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
        n = [0]
        def call(m, p=None):
            n[0] += 1; mid = n[0]
            ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get('id') == mid: return r.get('result', {})
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/parity.html' % hp})
        t0 = time.time()
        while time.time() - t0 < 120:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__PARITY) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fx': [], 'errors': ['timeout (120 s)']}
    finally:
        # the whole tree: a headless Edge left behind holds every other session's Edge suite in its queue
        subprocess.run(['taskkill', '/PID', str(edge.pid), '/T', '/F'], capture_output=True)
        try: srv.kill()
        except Exception: pass

fx_page = page_side()
fxjson = os.path.join(stage, 'parity.json')
open(fxjson, 'w', encoding='utf-8').write(json.dumps(fx_page))
FX = {f['id']: f for f in fx_page.get('fx', [])}
print('page side: %d fixtures, %d errors' % (len(FX), len(fx_page.get('errors', []))))

def lint(path):
    res = subprocess.run([PHP, '-n', '-l', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return res.returncode == 0 and 'No syntax errors' in res.stdout, (res.stdout + res.stderr).strip()[-300:]

# one runner build: a mirror of its schedule_runner.php in its own folder (the twin beside it: 'live', none, or empty),
# sched.php over it with its penumbra_template.php -> {id: result}
def runner(files, twin='live', tag='x'):
    work = os.path.join(stage, 'w_%s_%d' % (tag, len(os.listdir(stage))))
    os.makedirs(work)
    mirror = os.path.join(work, 'runner_mirror.php')
    r1 = subprocess.run([PHP, '-n', '-d', 'memory_limit=1024M', EXTRACT, fs(files['sr']), fs(mirror)], cwd=work,
                        capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    if r1.returncode != 0 or not os.path.exists(mirror):
        return None, 'extract_mirror failed: ' + (r1.stdout + r1.stderr)[-300:]
    if twin == 'live': shutil.copyfile(os.path.join(APP, 'penumbra_layout.php'), os.path.join(work, 'penumbra_layout.php'))
    elif twin == 'empty': open(os.path.join(work, 'penumbra_layout.php'), 'w').close()
    out = os.path.join(work, 'sched.json')
    r2 = subprocess.run([PHP, '-n', '-d', 'memory_limit=1024M', '-d', 'extension_dir=' + EXT82, '-d', 'extension=mbstring',
                         os.path.join(HERE, 'sched.php'), fs(mirror), fs(files['tpl']), fs(APP), fs(fxjson), fs(out)],
                        cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
    if not os.path.exists(out):
        return None, 'sched.php wrote nothing (exit %s): %s' % (r2.returncode, (r2.stdout + r2.stderr)[-600:])
    return json.load(open(out, encoding='utf-8')), None

def is_new(name):
    if name.startswith('H-S1-') or name.endswith('-nothrow'): return True
    m = re.match(r'(?:H-sched|H-grp|H-tpl|H-filter|P-direct)-(.+)$', name)
    return bool(m and FX.get(m.group(1), {}).get('kind') == 'NEW')
def fuzz(name):
    m = re.match(r'[A-Z]+-[A-Za-z]+-(f[zm]\d+)$', name) or re.match(r'[A-Z]-(f[zm]\d+)$', name)
    return bool(m)

def checks(files):
    out = []
    out += [('F-page', False, ' ; '.join(fx_page.get('errors', [])))] if fx_page.get('errors') else []
    out.append(('P-S0-page', len(FX) > 300, '%d fixtures' % len(FX)))
    rc, err = runner(files, 'live', 'cand')
    rr, err2 = runner(ref, 'live', 'ref')
    if rc is None or rr is None:
        out.append(('F-runner', False, (err or '') + ' ' + (err2 or '')))
        return out
    meta = rc.get('__meta', {})
    out.append(('F-load', not meta.get('loadWarn'), 'warnings while loading: %s' % meta.get('loadWarn')))
    for id_, f in FX.items():
        if id_ not in rc: continue
        c, r = rc[id_], rr.get(id_, {})
        want = c['want']
        if f['page']:
            out.append(('H-sched-' + id_, c.get('main') == want, '%s vs want %s plan %s' % (c.get('main'), want, c.get('plan'))))
            if 'grouped' in c:
                g = c['grouped']
                good = isinstance(g, dict) and all(band == [t for t in want if t in set(band)] for band in g.values())
                out.append(('H-grp-' + id_, good, '%s vs want %s' % (g, want)))
            out.append(('H-tpl-' + id_, c.get('tpl') == want and c.get('tplNums') == want, '%s / %s vs want %s' % (c.get('tpl'), c.get('tplNums'), want)))
            out.append(('H-filter-' + id_, c.get('filter') == want, '%s vs want %s' % (c.get('filter'), want)))
        if meta.get('direct'):
            out.append(('P-direct-' + id_, c.get('direct') == c.get('main'), '%s vs main %s' % (c.get('direct'), c.get('main'))))
        if f['kind'] == 'GUARD':
            for k in ('main', 'grouped', 'tpl', 'tplNums', 'filter'):
                if k in c or k in r:
                    out.append(('O-%s-%s' % (k, id_), c.get(k) == r.get(k), '%s vs reference %s' % (c.get(k), r.get(k))))
        cw = c.get('warn') if isinstance(c.get('warn'), dict) else {}   # (PHP writes an empty one as [])
        rw = r.get('warn') if isinstance(r.get('warn'), dict) else {}
        extra = {k: sorted(set(v) - set(rw.get(k, []))) for k, v in cw.items() if k != 'direct'}
        extra = {k: v for k, v in extra.items() if v}
        dw = cw.get('direct', [])
        out.append(('W-' + id_, not extra and not dw, 'new warnings %s %s' % (extra, dw)))
    # ---- H-S2: the twin's file missing or empty (a broken deploy, another suite's mirror): by the name, as before
    for what in ('missing', 'empty'):
        rm, err = runner(files, 'none' if what == 'missing' else 'empty', what)
        if rm is None:
            out.append(('H-S2-' + what, False, err)); continue
        bad = []; threw = []
        for id_ in FX:
            if id_ not in rm or id_ not in rr: continue
            for k in ('main', 'grouped', 'tpl', 'tplNums', 'filter'):
                a, b = rm[id_].get(k), rr[id_].get(k)
                # (where the reference cut's sort threw - a level that is a string - it never got to the template or
                # the filter: no rows to compare those with)
                if k in ('tpl', 'tplNums', 'filter') and isinstance(rr[id_].get('main'), str) and rr[id_]['main'].startswith('THROWS'): continue
                if isinstance(b, str) and b.startswith('THROWS'):
                    if isinstance(a, str) and a.startswith('THROWS'): threw.append('%s/%s' % (id_, k))
                elif a != b: bad.append('%s/%s %s vs %s' % (id_, k, a, b))
        out.append(('H-S2-' + what, not bad and not rm.get('__meta', {}).get('twin'),
                    'the twin\'s file %s: %d differ from the reference cut (%s); twin loaded: %s' % (what, len(bad), '; '.join(bad[:6]), rm.get('__meta', {}).get('twin'))))
        # ...and where the reference cut's sort threw (PHP 8: a level that is a string), it sorts by the rest
        out.append(('H-S2-%s-nothrow' % what, not threw, 'still throws: %s' % ', '.join(threw)))
        # ...without a warning (an error handler sees one even under @: nestsort's W-php counts them). The 'quiet'
        # path runs each state without layoutColumnNames, so ldsrv's own step-2 include never runs there.
        loud = sorted(set('%s: %s' % (id_, w) for id_, v in rm.items() if id_ != '__meta' and isinstance(v.get('warn'), dict)
                          for w in v['warn'].get('quiet', []) if 'penumbra_layout' in w))
        out.append(('H-S2-%s-quiet' % what, not loud, '%d warnings: %s' % (len(loud), loud[:3])))
    # ---- the source: where the calls are
    sr = read_b(files['sr']).replace('\r\n', '\n'); tp = read_b(files['tpl']).replace('\r\n', '\n')
    fa = sr.find('\nfunction penumbra_sched_sort_rows($data, $state, $skip = array()) {\n')
    fb = sr.find('\nfunction apply_state_logic($data, $state, $preserveCols = array()) {\n')
    fn = sr[fa:fb] if 0 <= fa < fb else ''
    asl = sr[fb:sr.find('\nfunction ', fb + 10)] if fb >= 0 else ''
    s1 = asl.find('    $data = penumbra_sched_sort_rows($data, $state, $preserveCols);\n')
    out.append(('H-S1-step1', 0 < s1 < asl.find('    // 2. Column Visibility & Ordering\n') and 'usort(' not in asl[:asl.find('    // 2. Column Visibility & Ordering\n')],
                'apply_state_logic sorts in step 1 through penumbra_sched_sort_rows($data, $state, $preserveCols), before the columns'))
    out.append(('H-S1-twin', bool(fn) and 0 < fn.find('pnb_sort_state_here($st, $keys, $skip)') < fn.find('usort($data')
                and "!function_exists('pnb_sort_state_here') && is_file(__DIR__ . '/penumbra_layout.php')) @include_once __DIR__ . '/penumbra_layout.php';" in fn
                and not re.search(r'\brequire(_once)?\b\s*\(?\s*__DIR__', fn),
                'penumbra_sched_sort_rows reads the sort through pnb_sort_state_here before its usort, the twin loaded softly'))
    out.append(('H-S1-tpl', "        unset($st['visibleColumns'], $st['columnOrder']);\n" in tp
                and "        if (isset($apiResult['columnOrder'])) $st['pnbSortColumnOrder'] = $apiResult['columnOrder'];\n        $toggleCols[] = $NUM;\n        $re = apply_state_logic($full, $st, $toggleCols);\n" in tp
                and tp.count('$re = apply_state_logic(') == 1
                and "if (!isset($st['columnOrder']) && isset($state['pnbSortColumnOrder'])) $st['columnOrder'] = $state['pnbSortColumnOrder'];" in fn,
                'the template hands the column order on for the sort and leaves its row-number tag out, in its one call; the step reads it'))
    for n, p in (('S-lint-sr82', files['sr']), ('S-lint-tpl82', files['tpl'])):
        good, info = lint(p)
        out.append((n, good, '' if good else info))
    return out

def report(res, title):
    bad = [r for r in res if not r[1]]
    print('\n==== %s: %d checks, %d red' % (title, len(res), len(bad)))
    for n, good, info in res:
        print('  %s  %s%s' % ('PASS' if good else 'FAIL', n, '' if good else '   ' + str(info)[:700]))
    return bad

def mutate(name):
    edits, _ = MUTANTS[name]
    d = os.path.join(stage, 'mut_' + name)
    os.makedirs(d, exist_ok=True)
    files = dict(cand)
    texts = {}
    for k, old, new in edits:
        if k not in texts: texts[k] = read_b(files[k])
        crlf = '\r\n' in texts[k]
        o, nw = (old.replace('\n', '\r\n'), new.replace('\n', '\r\n')) if crlf else (old, new)
        c = texts[k].count(o)
        if c != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, k, c, old[:90]))
        texts[k] = texts[k].replace(o, nw)
    for k, t in texts.items():
        p = os.path.join(d, FILES[k]); open(p, 'wb').write(t.encode('utf-8', 'surrogateescape')); files[k] = p
    return files

if one_mutant or all_mutants:
    names = list(MUTANTS) if all_mutants else one_mutant.split(',')
    base = checks(cand)
    base_bad = [r[0] for r in base if not r[1]]
    print('baseline: %d checks, %d red%s' % (len(base), len(base_bad), (': ' + ', '.join(base_bad[:20])) if base_bad else ''))
    bites = 0
    for name in names:
        res = checks(mutate(name))
        red = set(r[0] for r in res if not r[1]) - set(base_bad)
        targets = MUTANTS[name][1]
        hit = [t for t in targets if t in red]
        ok_ = bool(hit)
        bites += ok_
        print('MUTANT %-12s %s   targets red: %s   (all newly red: %d: %s)' % (name, 'BITES' if ok_ else 'DOES NOT BITE', ', '.join(hit) or '-', len(red), ', '.join(sorted(red)[:12])))
    print('TOTAL mutants=%d bite=%d' % (len(names), bites))
    print('RESULT: GREEN' if bites == len(names) and not base_bad else 'RESULT: RED')
else:
    res = checks(cand)
    bad = report(res, 'CONTROL (live)' if control else 'CANDIDATE')
    if control:
        # the fuzz cases are left out here: by the name, some of them are right by luck - and so are a NEW case's
        # bands of two (H-grp: grouped by a tie column, a band holds two rows)
        luck = [r[0] for r in res if is_new(r[0]) and r[1] and r[0].startswith('H-grp-')]
        if luck: print('NEW but green by luck (bands of two): ' + ', '.join(luck))
        new_green = [r[0] for r in res if is_new(r[0]) and r[1] and not fuzz(r[0]) and r[0] not in luck]
        guard_red = [r[0] for r in res if not is_new(r[0]) and not r[1] and not fuzz(r[0])]
        new_red = [r[0] for r in res if is_new(r[0]) and not r[1]]
        print('\nCONTROL: %d NEW checks red (%s ...); NEW but green: %s; GUARD red: %s'
              % (len(new_red), ', '.join(new_red[:8]), ', '.join(new_green) or 'none', ', '.join(guard_red) or 'none'))
        print('RESULT: CONTROL GREEN' if not new_green and not guard_red and new_red else 'RESULT: CONTROL RED')
    else:
        print('TOTAL pass=%d fail=%d' % (len(res) - len(bad), len(bad)))
        print('RESULT: GREEN' if not bad else 'RESULT: RED')
if not keep:
    shutil.rmtree(stage, ignore_errors=True)
else:
    print('kept: ' + stage)
