# =============================================================================
# COPYHTML SUITE (2026-09-30)
#
# Copy as HTML copied only the page on screen, while Copy as CSV / TSV / JSON
# copy every search-visible row: generateWysiwygHtml copies what the table
# LOOKS like and skips display:none rows, and pagination hides every other
# page that way. The fix lays the flat table out as Rows = All for the length
# of the copy (_pnbAllPagesLayout: stripes, the totals row in place of the
# "View Last Page" link), reads the other pages' rows where they are,
# display:none (opts.offPageRows), and puts the page back; the copy stops at
# PENUMBRA_COPY_HTML_MAX_BYTES with a note. The email embed keeps carrying ONE
# page on purpose.
#
# Browser only: the REAL main.js through the REAL run path on the hiddencols
# fixture (300 rows, 200 per page, a totals row, @@HTML links), copied through
# the Copy dialog's own button. Scenarios:
#   p1 page 1   p2 page 2   rpp25 25 per page, page 3 (after page 2)   search ?search= (215 rows)
#   fmt format() + heatmap() + rewrite(), page 2   none Rows = None   all Rows = All
#   group grouped by H_GROUP   cap page 2 on a build whose cap is 40,000 bytes
# Asserts:
#   O-*  the copy == the ORACLE (the old one-page copy taken with Rows = All), byte for byte
#   N-*  rows in the copy == search-visible rows
#   R-*  the page is put back exactly (every row's display, the stripes, the tfoot, the label)
#   T-*  the toast is the plain success one
#   M-*  the email path (getExportData('html'), no opts) is byte-identical to the BASELINE
#        build's, and a paginated one carries exactly the displayed page
#   G-group  the grouped copy is byte-identical to the baseline build's
#   C-*  the cap: the note and its counts, the copy is a prefix of the full copy, the toast,
#        the page put back (R-cap)
#   L-*  the copy costs at most MAX_RECALCS style recalcs however many rows it reads - the
#        browser's own RecalcStyleCount, read over CDP just before and after the click.
#        (Showing each other-page row to read it cost ~4 recalcs of the whole table per
#        row: 4,800 recalcs, 40-56 s for 1,172 rows of a 5,000-row report. LayoutCount
#        stayed at 1 - it was never layout. Read in place: 1-4 recalcs.)
#   S-email-site  the email call site still passes no opts
#   E-*  no page errors
#
#   py -3 run.py                      candidate = live js\main.js, baseline = newest js\main.js.bak-*-copyhtml
#   py -3 run.py --candidate F --baseline B
#   py -3 run.py --control            the baseline as the candidate: RED on exactly the O-/N- asserts
#                                     of the paginated scenarios and C-note C-prefix C-toast
#   py -3 run.py --mutants            every mutant against the asserts it must turn red
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = [('p1', ''), ('p2', ''), ('rpp25', ''), ('search', '&search=H_FLAG%20%3D%20N'), ('fmt', ''),
       ('none', ''), ('all', ''), ('group', '')]
PAGED = ['p1', 'p2', 'rpp25', 'search', 'fmt', 'none']      # more than one page: the old copy fell short
FLAT = PAGED + ['all']
CAP_OLD = 'var PENUMBRA_COPY_HTML_MAX_BYTES = 50 * 1024 * 1024;'
CAP_NEW = 'var PENUMBRA_COPY_HTML_MAX_BYTES = 40000;'
EMAIL_SITE = "                tableHtml = getExportData('html').content;\r\n"
CRLF = '\r\n'
MAX_RECALCS = 10
FLAT_LOOP = "                    processRow($(this), $tbodyClone, !!opts.offPageRows && this.style.display === 'none');\r\n"
MUTANTS = {
    # other-page rows are skipped again: the copy is the page on screen
    'nooffpage': ([(FLAT_LOOP, "                    processRow($(this), $tbodyClone);\r\n")],
                  ['O-p1', 'O-p2', 'O-rpp25', 'O-search', 'O-fmt', 'N-p1', 'N-p2', 'N-rpp25', 'N-search', 'N-fmt']),
    # an off-page row's clone keeps the display:none it was read with - pasted rows would be hidden
    'nodisplayfix': ([("            if (offPage) $trClone[0].style.display = 'table-row';   // what it computes once shown\r\n", "")],
                     ['O-p1', 'O-p2', 'O-rpp25', 'O-search', 'O-fmt']),
    # each other-page row SHOWN for its read (and hidden again): same HTML, a layout per row
    'showread': ([(FLAT_LOOP, "                    { const _sh = !!opts.offPageRows && this.style.display === 'none'; if (_sh) this.style.display = ''; processRow($(this), $tbodyClone, false); if (_sh) this.style.display = 'none'; }\r\n")],
                 ['L-p1', 'L-p2', 'L-rpp25', 'L-fmt']),
    # v1: each other-page row shown for its read and LEFT shown until the end (here: left
    # shown for good, so R-* go red too) - the build that took 37 s for 751 rows x 83 columns
    'showkeep': ([(FLAT_LOOP, "                    { const _sh = !!opts.offPageRows && this.style.display === 'none'; if (_sh) this.style.display = ''; processRow($(this), $tbodyClone, false); }\r\n")],
                 ['L-p1', 'L-p2', 'L-rpp25', 'L-fmt']),
    # restore() puts nothing back
    'norestore': ([("                    if (s[2] === null) s[0].removeAttribute(s[1]);\r\n                    else s[0].setAttribute(s[1], s[2]);\r\n", "")],
                  ['R-p1', 'R-rpp25', 'R-search', 'R-none']),    # on the LAST page there is nothing visible to undo
    # the tfoot is left swapped (visible on every page that is not the last)
    'nofootrestore': ([("                    keep(this, 'style');\r\n", "")],
                      ['R-p1', 'R-rpp25', 'R-search']),
    # the stripes are left as Rows = All had them - Rows = None never stripes its rows
    'nostriperestore': ([("                    keep(r, 'class');\r\n", "")],
                        ['R-none', 'M-none']),
    # no Rows = All striping: other-page rows keep the stripes of whenever they were last shown
    'nostripe': ([("                    r.classList.add(k % 2 === 0 ? 'zebra-light' : 'zebra-dark');\r\n", "")],
                 ['O-rpp25']),
    # putting back in insertion order: every attribute is saved once, so the reverse walk is
    # belt and braces - redundant by design, must stay GREEN
    'eq-forward': ([("                for (let i = saved.length - 1; i >= 0; i--) {\r\n",
                     "                for (let i = 0; i < saved.length; i++) {\r\n")], []),
    # no tfoot swap: a copy from any page but the last carries the link row, not the totals
    'nofoot': ([("                    $(this).toggle($(this).hasClass('total-row-data'));\r\n", "")],
               ['O-p1', 'O-rpp25', 'O-search']),
    # the Copy path without its cap
    'nobudget': ([("{ allPages: true, budget: PENUMBRA_COPY_HTML_MAX_BYTES, notice: 'copy' }", "{ allPages: true, notice: 'copy' }")],
                 ['C-note', 'C-prefix', 'C-toast']),
    # the Copy path with the email's wording at the cut
    'nonotice': ([("{ allPages: true, budget: PENUMBRA_COPY_HTML_MAX_BYTES, notice: 'copy' }", "{ allPages: true, budget: PENUMBRA_COPY_HTML_MAX_BYTES }")],
                 ['C-note']),
    # the email embed copies every page too
    'email-allpages': ([(EMAIL_SITE, "                tableHtml = getExportData('html', { allPages: true }).content;\r\n")],
                       ['S-email-site']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
cand_path = opt('--candidate', os.path.join(APP, 'js', 'main.js'))
base_path = opt('--baseline', None)
control = flag('--control')
mutants = flag('--mutants')
one_mutant = opt('--mutant', None)
verbose = flag('--verbose')     # with --mutant(s): print every red assert's detail
if not base_path:
    baks = bak_glob(os.path.join(APP, 'js', 'main.js.bak-*-copyhtml'))
    if not baks: raise SystemExit('needs --baseline <main.js before the change> (the deploy leaves js\\main.js.bak-<stamp>-copyhtml)')
    base_path = baks[-1]
if control:
    cand_path = base_path

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = (CRLF + ';try { window.__HC = { master: function () { return masterRowData; },'
         ' getExportData: function (f, o) { return getExportData(f, o); },'
         ' applyPagination: function () { return applyPagination(); },'
         ' lastRun: function () { return lastWysiwygRun(); },'
         ' setPage: function (p) { currentPage = p; applyPagination(); },'
         ' getPage: function () { return currentPage; } };'
         ' var __pnbHcToast = show_text; show_text = function (t) { (window.__toasts = window.__toasts || []).push(String(t)); return __pnbHcToast.apply(this, arguments); };'
         ' } catch (e) { window.__HC_ERR = String(e); }' + CRLF)
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {' + CRLF
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;' + CRLF)
def capped(src):
    # the cap scenario's build: a 40,000-byte cap (a build without the cap is left as it is)
    return src.replace(CAP_OLD, CAP_NEW) if src.count(CAP_OLD) == 1 else src
# Lazy rows (B1, 2026-09-30) rewrote the flat loop (batched fills of off-page rows):
# the same three mutants, B1-shaped - used when the pre-B1 anchor is absent.
B1_OFF = "                    const _off = !!opts.offPageRows && _tr.style.display === 'none';\r\n"
B1_READ = "                    processRow($(_tr), $tbodyClone, _off);\r\n"
MUTANTS_B1 = {
    'nooffpage': [(B1_OFF, "                    const _off = false;\r\n")],
    'showread': [(B1_READ, "                    { if (_off) _tr.style.display = ''; processRow($(_tr), $tbodyClone, false); if (_off) _tr.style.display = 'none'; }\r\n")],
    'showkeep': [(B1_READ, "                    { if (_off) _tr.style.display = ''; processRow($(_tr), $tbodyClone, false); }\r\n")],
}
def mutate(src, name):
    edits = MUTANTS[name][0]
    if name in MUTANTS_B1 and any(src.count(old) != 1 for old, _ in edits):
        edits = MUTANTS_B1[name]
    for old, new in edits:
        if src.count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times (needs the FIXED build)" % (name, src.count(old)))
        src = src.replace(old, new)
    return src

stage = tempfile.mkdtemp(prefix='pnb_ch_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
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
    def ev(expr):
        return call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')
    def counts():
        m = {x['name']: x['value'] for x in call('Performance.getMetrics').get('metrics', [])}
        return m.get('LayoutCount', 0), m.get('RecalcStyleCount', 0)
    try:
        call('Performance.enable')
        # Every build is written to the same main_hc.js: never let the browser serve a
        # cached copy (heuristic freshness once handed a mutant the previous build).
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        m0 = lay = None
        while time.time() - t0 < 300:
            time.sleep(0.1)
            st = json.loads(ev('JSON.stringify([!!window.__HC_PRECOPY, !!window.__HC_GO, !!window.__HC_COPIED, !!window.__HC_METRICS_TAKEN, !!window.__HCDONE])') or '[false,false,false,false,false]')
            if st[0] and not st[1]:
                m0 = counts(); ev('window.__HC_GO = true')
            elif st[2] and not st[3]:
                m1 = counts()
                lay = {'layouts': m1[0] - m0[0], 'recalcs': m1[1] - m0[1]} if m0 else None
                ev('window.__HC_METRICS_TAKEN = true')
            elif st[4]:
                r = json.loads(ev('JSON.stringify(window.__HCRESULT)'))
                if lay: r.update(lay)
                return r
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(text, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(text).encode('utf-8', 'surrogateescape'))
    return {scn: run_page(scn, extra) for scn, extra in [s for s in SCN + [('cap', '')] if s[0] in scns]}

def fmt_diff(r):
    d = r.get('diff')
    return (' | first diff at %s: copy %r / oracle %r' % (d['at'], d['a'][70:150], d['b'][70:150])) if d else ''

def evaluate(base, cand, cap, cand_text):
    out = []
    add = lambda aid, ok, detail: out.append((aid, bool(ok), detail))
    for scn, _ in SCN:
        r, b = cand.get(scn, {}), base.get(scn, {})
        if r.get('fatal') or b.get('fatal'):
            add('F-' + scn, False, (r.get('fatal') or b.get('fatal'))[:300]); continue
        if scn in FLAT:
            add('O-' + scn, r.get('copyEqOracle'), 'copy %s (%d rows, %d chars) vs Rows = All %s (%d rows)%s' % (
                r.get('copyHash'), r.get('copyRowCount', -1), r.get('copyLen', -1), r.get('oracleHash'), r.get('oracleRowCount', -1), fmt_diff(r)))
            add('N-' + scn, r.get('copyRowCount') == r.get('searchVisible'), 'rows in the copy %s, search-visible %s, foot %s' % (
                r.get('copyRowCount'), r.get('searchVisible'), r.get('copyFoot')))
            add('R-' + scn, r.get('before') == r.get('after') == r.get('afterEmail'), 'page put back (%s; %s touched)' % (r.get('pageInfo'), r.get('touched')))
            add('T-' + scn, r.get('toast') == 'SUCCESS: Copied table to clipboard.', 'toast %r' % r.get('toast'))
            add('L-' + scn, r.get('recalcs') is not None and r['recalcs'] <= MAX_RECALCS, 'style recalcs during the copy: %s (layouts %s; %s rows read off-page)' % (
                r.get('recalcs'), r.get('layouts'), r.get('searchVisible', 0) - r.get('displayed', 0)))
            m_ok = r.get('emailHash') == b.get('emailHash')
            if scn in PAGED and scn != 'none':
                m_ok = m_ok and r.get('emailRowCount') == r.get('displayed')
            add('M-' + scn, m_ok, 'email path %s (%s rows) vs baseline %s; displayed %s' % (
                r.get('emailHash'), r.get('emailRowCount'), b.get('emailHash'), r.get('displayed')))
        if scn == 'group':
            add('G-group', r.get('copyHash') == b.get('copyHash') and r.get('copyEqOracle'), 'grouped copy %s vs baseline %s, == no-opts copy %s' % (
                r.get('copyHash'), b.get('copyHash'), r.get('copyEqOracle')))
            add('T-group', r.get('toast') == 'SUCCESS: Copied table to clipboard.', 'toast %r' % r.get('toast'))
            add('M-group', r.get('emailHash') == b.get('emailHash'), 'email path %s vs baseline %s' % (r.get('emailHash'), b.get('emailHash')))
        add('E-' + scn, not r.get('errors') and not r.get('hookErr') and not r.get('clipErr'), 'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), r.get('clipErr')))
    c = cap.get('cap', {})
    if c.get('fatal'):
        add('F-cap', False, c['fatal'][:300])
    else:
        n, tot = c.get('copyRowCount', -1), c.get('searchVisible', -1)
        om = tot - n
        want = 'Showing %s of %s rows - %s %s left out to keep this copy under the size limit.' % (
            format(n, ','), format(tot, ','), format(om, ','), 'row was' if om == 1 else 'rows were')
        add('C-note', c.get('note') == want, 'note %r (want %r)' % (c.get('note'), want))
        add('C-prefix', c.get('prefixOk') and 0 < n < tot, '%s of %s rows, a prefix of the full copy: %s' % (n, tot, c.get('prefixOk')))
        add('C-toast', ('Copied %s of %s rows as HTML' % (format(n, ','), format(tot, ','))) in (c.get('toast') or ''), 'toast %r' % c.get('toast'))
        add('L-cap', c.get('recalcs') is not None and c['recalcs'] <= MAX_RECALCS, 'style recalcs during the capped copy: %s (layouts %s)' % (c.get('recalcs'), c.get('layouts')))
        add('R-cap', c.get('before') == c.get('after'), 'page put back (%s)' % c.get('pageInfo'))
        add('E-cap', not c.get('errors') and not c.get('hookErr') and not c.get('clipErr'), 'errors %s %s %s' % (c.get('errors'), c.get('hookErr'), c.get('clipErr')))
    add('S-email-site', cand_text.count(EMAIL_SITE) == 1, 'the email embed calls getExportData(\'html\') with no opts (%d site)' % cand_text.count(EMAIL_SITE))
    return out

try:
    base_text = read_b(base_path)
    cand_text = read_b(cand_path)
    print('candidate: %s%s' % (cand_path, '   (CONTROL: the build before the change)' if control else ''))
    print('baseline:  %s' % base_path)
    names = [s[0] for s in SCN]
    base = run_build(base_text, names)
    if mutants or one_mutant:
        ok = bad = 0
        for name in ([one_mutant] if one_mutant else list(MUTANTS)):
            must = MUTANTS[name][1]
            mt = mutate(cand_text, name)
            res = evaluate(base, run_build(mt, names), run_build(capped(mt), ['cap']), mt)
            red = [a for a, p, _ in res if not p]
            good = (not [m for m in must if m not in red]) if must else (not red)
            ok += good; bad += (not good)
            print('  %s  mutant %-15s %s   [red: %s]' % ('PASS' if good else 'FAIL', name,
                  ('turns %s red' % ' '.join(must)) if must else 'redundant by design: must stay GREEN', ' '.join(red)))
            if verbose:
                for aid, passed, detail in res:
                    if not passed: print('        %-13s %s' % (aid, detail[:400]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        cand = run_build(cand_text, names)
        cap = run_build(capped(cand_text), ['cap'])
        res = evaluate(base, cand, cap, cand_text)
        p = f = 0; failed = []
        for aid, passed, detail in res:
            print('  %s  %-13s %s' % ('PASS' if passed else 'FAIL', aid, detail))
            if passed: p += 1
            else: f += 1; failed.append(aid)
        times = ', '.join('%s %s ms' % (s, cand[s].get('copyMs')) for s in names if s in cand)
        print('copy times (candidate): %s' % times)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
