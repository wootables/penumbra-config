# =============================================================================
# CALCFIX SUITE (2026-11-26) - the top 20 calculated column / custom groups bugs found after 085d3f4 ("Fix all 20"),
# each pinned where it shows:
#   R-*   the pattern rule (#7, #8): 62 patterns' verdicts in BOTH twins (js PenumbraCalc.rxProblem, php
#         _pnb_calc_grp_rx_problem) and the same words from each
#   E-*   the engines (#4 pass-through value, #7 rule warning, #15 %, #19 @@HTML, #20 N / No) in BOTH twins
#   S-*   the scheduler (#2 dates, #9 sort, #18 band order) on a mirror of the stage's schedule_runner.php (sched.php)
#   U-*   the page (#1 #3 #5 #11 #12 #13 #14 #16 ...): the reviewers' scenarios on the real main.js (ui/ and cg/ harnesses)
#
#   py -3 run.py [--stage DIR] [--only R,E,S,U] [--control]
#   --stage  a folder holding js/main.js, js/penumbra_calc.js, penumbra_calc.php, schedule_runner.php (default: the live app)
#   --control  the live app, expecting EXACTLY CONTROL_RED red (what the build before the fixes gets wrong)
# Headless Edge; PHP CLI; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import html, json, os, re, shutil, subprocess, sys, tempfile, time
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_penumbra\php.exe'
MB = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_penumbra/ext/php_mbstring.dll'   # forward slashes, as the other runs pass it
MIRROR = os.path.join(os.path.dirname(HERE), 'pivotparity', 'extract_mirror.php')
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
control = '--control' in args
if control: args.remove('--control')
STAGE = opt('--stage', APP)
ONLY = set((opt('--only', 'R,E,S,U') or '').split(','))
def f(rel): return os.path.join(STAGE, rel)
print('under test: %s%s' % (STAGE, ' (control)' if control else ''))
RES = []
def chk(name, ok, info=''):
    RES.append((name, bool(ok)))
    print('  %s  %-30s %s' % ('PASS' if ok else 'FAIL', name, '' if ok else str(info)[:400]))

# ---------------------------------------------------------------- R / E: the twins
R_, A_ = 'refuse', 'allow'
RX = [
    ('^.*a.*a.*a.*b$', R_), ('^\\w*\\w*\\w*\\w*\\w*\\w*$', R_), ('.*a.*a.*b', R_), ('^\\w*\\w*\\w*\\w*\\w*!$|^a+$', R_),
    ('\\w{0,50}\\w{0,50}\\w{0,50}\\w{0,50}\\w{0,50}!', R_), ('.{0,40}.{0,40}.{0,40}.{0,40}.{0,40}.{0,40}#', R_),
    ('\\w{0,9}\\w{0,9}\\w{0,9}\\w{0,9}\\w{0,9}!', R_), ('.*a.*a\\w{0,50}b', R_), ('\\d+\\s*\\d+\\s*\\d+x', R_), ('\\d+-?\\d+-?\\d+x', R_),
    ('a?' * 16 + 'a' * 16, R_), ('.*a.*a.*$', R_), ('.*\\s.*\\s.*x', R_), ('.*\\d+\\d+x', R_), ('.*ab.*ab.*abx', R_),
    ('\\w+\\s*\\w+\\s*\\w+!', R_), ('\\w{0,50}\\w{0,50}\\w{0,50}!', R_), ('\\w+\\s*\\w+\\s*\\w+', R_), ('(?:x|y).*a.*a.*b', R_), ('.*NC.*State.*Univ', R_),
    ('.*NC.*State.*', A_), ('^.*univ.*of.*$', A_), ('.*NC.*State.+', A_), ('.*NC.*State', A_), ('^.*a.*a.*b$', A_),
    ('\\w*\\w*\\w*', A_), ('a*\\w*.*', A_), ('(ab)+(cd)+(ef)+', A_), ('\\w{0,50}\\w{0,50}\\w{0,50}', A_), ('^[^\\s]+ [^\\s]+ [^\\s]+$', A_),
    ('^\\d+-\\d+-\\d+$', A_), ('^\\s*\\d+\\s*$', A_), ('^\\w+\\s\\w+\\s\\w+$', A_), ('x{2,}y+z*', A_), ('^\\S+ \\S+ \\S+$', A_), ('^.*foo.*$', A_),
    ('(?=.*a)(?=.*b)', A_), ('^[A-Z]+\\d+[A-Z]*$', A_), (' ', A_), ('^.*$', A_), ('[^,]*,[^,]*,[^,]*', A_), ('\\w+@\\w+\\.\\w+', A_),
    ('^\u00e9+\u00fc+\u00e9+$', A_), ('^\\x41+B+\\x41+$', A_), ('.*\\d+-\\d+-\\d+', A_), ('\\w{0,20}\\w{0,20}\\w{0,20}!', A_),
    ('.*a\\w{0,50}b', A_), ('\\w{0,12}\\w{0,12}\\w{0,12}\\w{0,12}!', A_), ('[a-z]{1,10}[a-z]{1,10}[a-z]{1,10}!', A_),
    ('a?' * 15 + 'a' * 15, A_), ('\\w?' * 8 + '!', A_), ('^NC |STATE', A_), ('\\w+\\s*=\\s*\\w+', A_), ('^\\d{5}(-\\d{4})?$', A_),
    ('\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', A_), ('(?:^|\\s)NC(?:\\s|$)', A_), ('^(?:Dr\\.?\\s+)?[A-Z][a-z]+,\\s*[A-Z]', A_),
    ('.*?NC.*?State.*?', A_), ('^.*NC.*State.*Univ', A_), ('.*univ.*of', A_), ('^(?:.*a.*b|c.*d.*e)$', A_), ('NC State|.*a.*b', A_),
]
SETS = [
    {'id': 'fix', 'rows': [
        {'RATE': '0.25', 'PCTX': '52.5%', 'NEG': '(12%)', 'BUDGET': '1000', 'LINK': '@@HTML<a href="x">1,234.50</a>', 'DLINK': '@@HTML<b>2026-01-05</b>', 'FLAG': 'N', 'AMT': '1234.567', 'SP': 'NC State University'},
        {'RATE': '0.105', 'PCTX': '7%', 'NEG': '3 %', 'BUDGET': '2000', 'LINK': '@@HTML<a>12</a>', 'DLINK': '@@HTML2026-02-01', 'FLAG': 'No', 'AMT': '10', 'SP': 'Duke'},
        {'RATE': '1', 'PCTX': '100%', 'NEG': '(0.5%)', 'BUDGET': '10', 'LINK': '7', 'DLINK': '2026-01-01', 'FLAG': 'F', 'AMT': '0.5', 'SP': 'nc state'}],
     'defs': [
        {'name': 'PCT', 'formula': '{RATE}', 'format': 'percent'}, {'name': 'SHARE', 'formula': '{PCT} * {BUDGET}', 'format': 'currency'},
        {'name': 'P2', 'formula': '{PCTX} * 2', 'format': 'number'}, {'name': 'PPASS', 'formula': '{PCTX}', 'format': 'percent'},
        {'name': 'N2', 'formula': '{NEG} * 100', 'format': 'number'}, {'name': 'L2', 'formula': '{LINK} + 1', 'format': 'number'},
        {'name': 'D2', 'formula': 'DAYS({DLINK}, "2026-01-01")', 'format': 'number'}, {'name': 'F2', 'formula': 'IF({FLAG}, "yes", "no")', 'format': 'text'},
        {'name': 'CUR', 'formula': '{AMT}', 'format': 'currency'}, {'name': 'CUR2', 'formula': '{CUR} * 1000', 'format': 'number'},
        {'name': 'G', 'format': 'text', 'groups': {'col': 'SP', 'sets': [
            {'name': 'NCSU', 'values': [], 'rule': {'op': 'matches', 'v': '.*NC.*State.*'}},
            {'name': 'Bad', 'values': [], 'rule': {'op': 'matches', 'v': '\\w{0,50}\\w{0,50}\\w{0,50}\\w{0,50}\\w{0,50}!'}}], 'rest': 'other', 'other': 'Other'}}]}]
WANT = {   # set fix, column -> its cell on each row
    'PCT': ['25%', '10.5%', '100%'], 'SHARE': ['$250.00', '$210.00', '$10.00'],          # #4
    'P2': ['1.05', '0.14', '2'], 'PPASS': ['52.5%', '7%', '100%'], 'N2': ['-12', '3', '-0.5'],   # #15
    'L2': ['1235.5', '13', '8'], 'D2': ['4', '31', '0'],                                  # #19
    'F2': ['no', 'no', 'yes'],                                                           # #20 (a lone F is text, as on the page)
    'CUR': ['$1,234.57', '$10.00', '$0.50'], 'CUR2': ['1234567', '10000', '500'],        # #4
    'G': ['NCSU', 'Other', 'NCSU'],                                                      # #7
}
TAG = {'PCT': '4', 'SHARE': '4', 'P2': '15', 'PPASS': '15', 'N2': '15', 'L2': '19', 'D2': '19', 'F2': '20', 'CUR': '4', 'CUR2': '4', 'G': '7'}
if ONLY & {'R', 'E'}:
    w = tempfile.mkdtemp(prefix='pnb_cf_')
    shutil.copyfile(f(os.path.join('js', 'penumbra_calc.js')), os.path.join(w, 'penumbra_calc.js'))
    shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colfmt.js'), os.path.join(w, 'penumbra_colfmt.js'))
    shutil.copyfile(os.path.join(HERE, 'eng.html'), os.path.join(w, 'eng.html'))
    cases = {'sets': SETS, 'rx': RX}
    open(os.path.join(w, 'cases.js'), 'w', encoding='utf-8').write('window.CF_SETS = ' + json.dumps(SETS) + ';\nwindow.CF_RX = ' + json.dumps(RX) + ';\n')
    json.dump(cases, open(os.path.join(w, 'cases.json'), 'w', encoding='utf-8'))
    p = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
                        '--user-data-dir=' + os.path.join(w, 'prof'), '--allow-file-access-from-files', '--virtual-time-budget=30000', '--dump-dom',
                        'file:///' + os.path.join(w, 'eng.html').replace('\\', '/')], capture_output=True, timeout=300)
    m = re.search(r'<pre id="out">(.*?)</pre>', p.stdout.decode('utf-8', 'replace'), re.S)
    js = json.loads(html.unescape(m.group(1))) if m else {'fatal': 'no output'}
    r = subprocess.run([PHP, '-n', '-d', 'extension=' + MB, os.path.join(HERE, 'eng.php'), f('penumbra_calc.php'), os.path.join(w, 'cases.json')], capture_output=True, timeout=300)
    _pt = r.stdout.decode('utf-8', 'replace')
    try: ph = json.loads(_pt[_pt.index('{'):])   # past any startup line PHP printed
    except Exception: ph = {'fatal': (r.stdout + r.stderr).decode('utf-8', 'replace')[-600:]}
    chk('E-js-ran', not js.get('fatal'), js.get('fatal'))
    chk('E-php-ran', not ph.get('fatal'), ph.get('fatal'))
    if 'R' in ONLY:
        jr, pr = js.get('rx') or [], ph.get('rx') or []
        for i, (pat, want) in enumerate(RX):
            a = jr[i] if i < len(jr) else 'MISSING'
            b = pr[i] if i < len(pr) else 'MISSING'
            ga = R_ if a else A_
            gb = R_ if b else A_
            chk('R-%02d' % i, ga == want and gb == want and a == b, 'pattern %r want %s js=%r php=%r' % (pat, want, a, b))
    if 'E' in ONLY:
        js0 = (js.get('sets') or [{}])[0]; ph0 = (ph.get('sets') or [{}])[0]
        for col, want in WANT.items():
            ga = [row.get(col) for row in js0.get('rows', [])]
            gb = [row.get(col) for row in ph0.get('rows', [])]
            chk('E-%s-%s' % (TAG[col], col), ga == want and gb == want, 'want %s js=%s php=%s' % (want, ga, gb))
        wj = (js0.get('warn') or {}).get('G', '') if isinstance(js0.get('warn'), dict) else ''
        wp = (ph0.get('warn') or {}).get('G', '') if isinstance(ph0.get('warn'), dict) else ''
        rw = re.compile(r'the rule of Bad is not used: its repeats could split a long cell')
        chk('E-7-ruleWarn', bool(rw.search(wj or '')) and bool(rw.search(wp or '')) and wj == wp, 'js=%r php=%r' % (wj, wp))

# ---------------------------------------------------------------- S: the scheduler (a mirror of its functions)
if 'S' in ONLY:
    w = tempfile.mkdtemp(prefix='pnb_cfs_')
    mir = os.path.join(w, 'sr_mirror.php')
    r = subprocess.run([PHP, '-n', MIRROR, f('schedule_runner.php'), mir], capture_output=True, timeout=300)
    chk('S-mirror', os.path.exists(mir), (r.stdout + r.stderr).decode('utf-8', 'replace')[-300:])
    if os.path.exists(mir):
        r = subprocess.run([PHP, '-n', '-d', 'extension=' + MB, '-d', 'memory_limit=1G', os.path.join(HERE, 'sched.php'), mir, f('penumbra_calc.php')], capture_output=True, timeout=600)
        out = r.stdout.decode('utf-8', 'replace')
        got = 0
        for line in out.splitlines():
            mm = re.match(r'^(ok|BAD)\s+(#\d+)\s+(.*)$', line)
            if not mm: continue
            got += 1
            name = 'S-%s-%s' % (mm.group(2)[1:], re.sub(r'[^A-Za-z0-9]+', '_', mm.group(3)).strip('_')[:40])
            chk(name, mm.group(1) == 'ok', line)
        chk('S-ran', got >= 27 and 'Fatal' not in out, out[-400:] + r.stderr.decode('utf-8', 'replace')[-300:])

# ---------------------------------------------------------------- U: the page (the reviewers' scenarios)
UI = [('unver', '&id=zzconf&rc=tri', '3'), ('rmver', '&id=zzconf&rc=tri', '3'), ('rmsave', '&id=zzconf&rc=two', '3'), ('rmdep', '&id=zzconf&rc=dep', '3'),
      ('knobsave', '&id=zzconf&rc=adj', '5'), ('keepknob', '&id=zzconf&rc=adj', '12'), ('vlremove', '&id=zzconf&rc=two', '13'), ('vlkeepcol', '&id=zzconf', '14'),
      ('rename', '&id=zzconf', '11'), ('deprm', '&id=zzconf', '16'), ('search', '&id=zzconf&rc=adj&adm=0', '1'), ('hiddenback', '&id=zzconf', '6')]
def cg_checks(scn, info):
    out = []
    if scn == 'hfilter':
        f1, aa, gb, ge = info.get('f1') or {}, info.get('afterAdd') or {}, info.get('groupedBefore') or {}, info.get('groupedAfterEdit') or {}
        out.append(('afterAddKeepsFilter', aa.get('box') == f1.get('box') and aa.get('rows') == f1.get('rows'), json.dumps([f1, aa])))
        out.append(('editKeepsGroupedFilter', ge.get('box') == gb.get('box') and ge.get('total') == gb.get('total')
                    and all(' of ' in h for h in (ge.get('heads') or [])), json.dumps([gb, ge])))
        out.append(('realRunStartsOver', (info.get('afterPlainRun') or {}).get('box') == '', json.dumps(info.get('afterPlainRun'))))
    elif scn == 'hhide':
        b, a = info.get('before') or {}, info.get('after') or {}
        out.append(('hiddenBandsKept', a.get('box') == b.get('box') and a.get('shownBands') == ['Pacific', 'Atlantic'], json.dumps([b, a])))
    elif scn == 'hrename':
        out.append(('editKeepsFilter', info.get('searchE') == '{REG} = Atlantic' and info.get('visibleE') == info.get('visibleBefore'), json.dumps([info.get('searchE'), info.get('visibleE')])))
        out.append(('renameKeepsFilter', info.get('search2') == '{REGION} = Atlantic' and info.get('visibleAfter') == info.get('visibleBefore'), json.dumps([info.get('search2'), info.get('visibleAfter')])))
        out.append(('renameKeepsSort', '"REGION"' in str(info.get('sortAfter')) and 'Sort dropped' not in str(info.get('toast')), json.dumps([info.get('sortAfter'), info.get('toast')])))
    return out
if 'U' in ONLY:
    for scn, q, tag in UI:
        cmd = [sys.executable, '-I', os.path.join(HERE, 'ui', 'runh.py'), '--scn', scn, '--cand', STAGE, '--tag', 'cf_' + scn, '--q', q]
        p = subprocess.run(cmd, capture_output=True, timeout=900, cwd=os.path.join(HERE, 'ui'))
        op = os.path.join(HERE, 'ui', 'out', 'out_cf_%s.json' % scn)
        try: d = json.load(open(op, encoding='utf-8')) if os.path.exists(op) and os.path.getmtime(op) > time.time() - 900 else None
        except Exception: d = None
        if not d or d.get('fatal'):
            chk('U-%s-%s-ran' % (tag, scn), False, (d or {}).get('fatal') or (p.stdout + p.stderr).decode('utf-8', 'replace')[-400:]); continue
        for k, v in (d.get('chk') or {}).items():
            chk('U-%s-%s-%s' % (tag, scn, k), v is True, json.dumps(d.get('info'))[:300])
    for scn in ('hfilter', 'hhide', 'hrename'):
        cmd = [sys.executable, '-I', os.path.join(HERE, 'cg', 'page', 'runh.py'), '--scn', scn, '--main', f(os.path.join('js', 'main.js')), '--calc', f(os.path.join('js', 'penumbra_calc.js'))]
        p = subprocess.run(cmd, capture_output=True, timeout=900, cwd=os.path.join(HERE, 'cg', 'page'))
        op = os.path.join(HERE, 'cg', 'page', 'out_%s.json' % scn)
        try: d = json.load(open(op, encoding='utf-8')) if os.path.exists(op) and os.path.getmtime(op) > time.time() - 900 else None
        except Exception: d = None
        if not d or d.get('fatal'):
            chk('U-1-%s-ran' % scn, False, (d or {}).get('fatal') or (p.stdout + p.stderr).decode('utf-8', 'replace')[-400:]); continue
        for k, v, info in cg_checks(scn, d.get('info') or {}):
            chk('U-1-%s-%s' % (scn, k), v, info)

# the reviewers' consumer probes (cons/): #6 a report column hidden in the loaded layout, #10 Year / Month of a formatted date
if 'U' in ONLY:
    env = dict(os.environ); env['CF_CAND'] = STAGE; env['CF_STAGE'] = tempfile.mkdtemp(prefix='pnb_cfc_')
    p = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'cons', 'runp.py'), '--build', 'p_hidecalc', 'p_grp2'], capture_output=True, timeout=1200,
                       cwd=os.path.join(HERE, 'cons'), env=env)
    def cons(name):
        op = os.path.join(HERE, 'cons', 'out', name + '.json')
        try: return json.load(open(op, encoding='utf-8')).get('out') if os.path.exists(op) and os.path.getmtime(op) > time.time() - 1200 else None
        except Exception: return None
    hc, g2 = cons('p_hidecalc'), cons('p_grp2')
    why = (p.stdout + p.stderr).decode('utf-8', 'replace')[-300:]
    if not hc: chk('U-6-hidecalc-ran', False, why)
    else:
        vis = hc.get('visible') or {}
        chk('U-6-hidecalc-staysHidden', vis.get('PCT') is False, json.dumps(hc))
        chk('U-6-hidecalc-saveKeepsHidden', 21 not in (hc.get('savedVisible') or []), json.dumps(hc.get('savedVisible')))
        chk('U-6-hidecalc-shownStaysShown', vis.get('MONEY') is True, json.dumps(vis))
    if not g2: chk('U-10-grp2-ran', False, why)
    else:
        t = g2.get('t') or {}
        def n(k): return (t.get(k) or {}).get('n') if isinstance(t.get(k), dict) else None
        def names(k): return (t.get(k) or {}).get('names') or [] if isinstance(t.get(k), dict) else []
        day = re.compile(r'\d{1,2}, \d{4}$')
        chk('U-10-grp2-monthOfPatternDate', n('DUE:month') is not None and 2 <= n('DUE:month') <= 70 and not any(day.search(x) for x in names('DUE:month')), json.dumps(t.get('DUE:month')))
        chk('U-10-grp2-yearOfFormattedColumn', n('H_DATE:year') is not None and n('H_DATE:year') <= 10, json.dumps(t.get('H_DATE:year')))
        chk('U-10-grp2-yearOfSlashPattern', n('DUEM:year') == 5, json.dumps(t.get('DUEM:year')))
        chk('U-10-grp2-plainLevelShowsText', n('DUE') == 263, json.dumps(t.get('DUE')))

fails = [n for n, ok in RES if not ok]
print('TOTAL pass=%d fail=%d   failed: %s' % (len(RES) - len(fails), len(fails), ' '.join(fails)))
if control:
    # what the build before the fixes (085d3f4 + cb31519) gets wrong, frozen from the first control run (2026-11-26): every
    # R and most E/S/U checks; the others are guards both builds pass
    CONTROL_RED = ["R-00", "R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08", "R-09", "R-10", "R-11", "R-12", "R-13", "R-14", "R-15", "R-16", "R-17", "R-18", "R-19", "R-20", "R-21", "R-22", "R-23", "R-24", "R-25", "R-26", "R-27", "R-28", "R-29", "R-30", "R-31", "R-32", "R-33", "R-34", "R-35", "R-36", "R-37", "R-38", "R-39", "R-40", "R-41", "R-42", "R-43", "R-44", "R-45", "R-46", "R-47", "R-48", "R-49", "R-50", "R-51", "R-52", "R-53", "R-54", "R-55", "R-56", "R-57", "R-58", "R-59", "R-60", "R-61", "E-4-SHARE", "E-15-P2", "E-15-PPASS", "E-15-N2", "E-19-L2", "E-19-D2", "E-20-F2", "E-4-CUR2", "E-7-G", "E-7-ruleWarn", "S-2-rows_hold_the_date", "S-2-filter_DUE_2026_04_01", "S-2-sort_by_DUE", "S-2-Month_buckets", "S-2-a_month_is_one_group", "S-2-pattern_is_the_column_format", "S-2-raw_format_for_the_chart_page", "S-2-email_cell_draws_the_pattern", "S-2-an_Automatic_report_format_gives_way_as_", "S-2-its_raw_entry_replaced", "S-2-Min_in_the_pattern", "S-2-Max_in_the_pattern", "S-2-a_pivot_is_left_to_its_builder", "S-9-Percent_sorts_by_number_desc", "S-9-page_number_rule", "S-18-unlisted_after_the_order_as_the_page_ord", "U-3-unver-reportColumnKept", "U-3-rmver-reportVersionBack", "U-3-rmver-saveKeepsReportTriple", "U-3-rmsave-reportKeepsHalf", "U-3-rmdep-savedComplete", "U-5-knobsave-defaultUnchanged", "U-12-keepknob-reportFixReaches", "U-13-vlremove-sameCalcColumns", "U-14-vlkeepcol-keptColumnThere", "U-11-rename-renamedKeepsPlace", "U-11-rename-renamedKeepsSort", "U-16-deprm-b2MarkedNotShown", "U-16-deprm-toldAboutB2", "U-1-search-searchKeptAfterKnob", "U-1-search-searchKeptAfterAdd", "U-1-hfilter-afterAddKeepsFilter", "U-1-hfilter-editKeepsGroupedFilter", "U-1-hhide-hiddenBandsKept", "U-1-hrename-editKeepsFilter", "U-1-hrename-renameKeepsFilter", "U-1-hrename-renameKeepsSort", "U-6-hidecalc-staysHidden", "U-6-hidecalc-saveKeepsHidden", "U-10-grp2-monthOfPatternDate", "U-10-grp2-yearOfFormattedColumn"]
    print('control red: %s' % json.dumps(fails))
    miss = [n for n in CONTROL_RED if n not in fails]; extra = [n for n in fails if n not in CONTROL_RED]
    if miss: print('expected red, green here: %s' % ' '.join(miss))
    if extra: print('red here, not expected: %s' % ' '.join(extra))
    print('RESULT: ' + ('GREEN (exactly CONTROL_RED red)' if not miss and not extra else 'RED'))
else:
    print('RESULT: ' + ('GREEN' if not fails else 'RED'))
