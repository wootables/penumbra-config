# =============================================================================
# ROWFUNNEL SUITE (2026-10-17) - the status bar's row count opens the Rows card: where the
# rows on screen come from (main.js initPenumbraStatusBar: _sbRowsRender / _sbRfModel /
# _sbRfParts / _sbRfLimitHtml / _sbRowsSync, the lead segment's #sbRowsBtn in index.php,
# css/main.css .sb-rf-*, the Status Bar help's Rows entry in v1 and v2).
#   page half   harness.html (mk_harness.py, from colmenu's) + driver.js: the REAL main.js, the
#               lead segment lifted from the index.php under test. The per-part counts are
#               checked against the REAL search run for each run of parts     L-<scn>-<check>, E-<scn>
#   static      the button in the lead segment, the lift, the help                     S-*
# --control runs LIVE: every NEW check red there, every other one green (the guards say what
# live already does: the row-limit icon at exactly 200 rows, none at 150, the live status).
# ROUND 2 (2026-10-19, rfx): each search line's x at the end of its own text, in the search's
# chip; every count in one column; the card as wide as its own lines (up to 600px, never past
# the window), not the row count's width under it; the boxes never widen it. NEW is now that
# round's checks (round 1's are guards: all green on live since 2026-10-17).
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_rf_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['fbase', 'fsearch', 'for', 'fmismatch', 'fpending', 'gsearch', 'pbase', 'rcap', 'rcapv', 'rcapurl', 'rsaved', 'r150',
       'rkbd', 'rrepo', 'rnarrow', 'rbig', 'fwide']
CHK = {
    'fbase': ['btnHiddenAtFirst', 'btnShown', 'opens', 'expanded', 'heading', 'srcLine', 'pageLine', 'noBox', 'liveStatus', 'allLine', 'closes'],
    'fsearch': ['oracleNarrows', 'opens', 'threeLines', 'counts', 'drops', 'eachX', 'clearAll', 'xInChip', 'xAtTextEnd', 'numsAligned',
                'xRewrites', 'xStaysOpen', 'xRecounts', 'xFocus', 'clearDone', 'clearFocus'],
    'for': ['opens', 'oneLine', 'noClearAll', 'xClears'],
    'fmismatch': ['opens', 'oneLine'],
    'fpending': ['opens', 'applied'],
    'gsearch': ['opens', 'groupsLine', 'opens2', 'counts', 'groupsOf'],
    'pbase': ['opens', 'pivotLine', 'srcLine', 'opens2', 'searchLine'],
    'rcap': ['iconShows', 'opens', 'warnBox', 'savedSentence', 'switchBtn', 'saveFoot', 'boxNoWiden', 'limitOff', 'reran', 'closedAfter'],
    'rcapv': ['opens', 'warnBox', 'noSwitch', 'whoCan'],
    'rcapurl': ['iconShows', 'opens', 'urlLink', 'noSavedSentence'],
    'rsaved': ['limitOffHere', 'opens', 'infoBox', 'saveOpens'],
    'r150': ['noIcon', 'opens', 'noBox', 'srcLine'],
    'rkbd': ['btnOpens', 'insideKeeps', 'escCloses', 'escFocus', 'outsideCloses'],
    'rrepo': ['btnHidden', 'notClickable', 'staysShut'],
    'rnarrow': ['narrow', 'opens', 'cardVisible', 'fitsNarrow'],
    'rbig': ['threeLines', 'fast'],
    'fwide': ['opens', 'oneLine', 'wider', 'notByCount', 'longWraps', 'kwBeside', 'xInsideCard'],
    # (not in SCN) the card left open for a picture: PNB_SHOT=<png> [PNB_SHOT_SCN=rcapshot] py -3 run.py --stage DIR --scn rcapshot
    'rcapshot': ['opens'],
    'rxshot': ['opens'],
    'rxshot2': ['opens'],
}
URLX = {'rcapurl': '&rowlimit=true', 'rsaved': '&rowlimit=false'}
NARROW = {'rnarrow': 480}
# what live already does (green there too); everything else is new
GUARDS = {'L-fsearch-oracleNarrows', 'L-rcap-iconShows', 'L-rcapurl-iconShows', 'L-r150-noIcon', 'L-fbase-liveStatus',
          'L-rsaved-limitOffHere', 'L-rnarrow-narrow', 'L-rrepo-notClickable', 'L-rrepo-staysShut', 'S-liveStatus'}
STATIC = ['S-btn', 'S-lift', 'S-help2', 'S-help2words', 'S-liveStatus']   # S-help1 (the v1 Rows entry) retired 2026-10-19 with the v1 help
NEW1 = ({'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} | set(STATIC)) - GUARDS   # round 1 (2026-10-17)
# round 2 (2026-10-19, rfx): red on live; its guards (green there too) are L-fwide-opens, -longWraps,
# -xInsideCard, L-rcap-boxNoWiden and L-rnarrow-fitsNarrow (each held up by a mutant below)
NEW = {'L-fsearch-xInChip', 'L-fsearch-xAtTextEnd', 'L-fsearch-numsAligned', 'L-fwide-oneLine', 'L-fwide-wider',
       'L-fwide-notByCount', 'L-fwide-kwBeside'}
MUTANTS = {
    # the bar never tells the segment there is a count: no button, no card
    'm-nosync': ([('main', "            _sbRowsSync(txt);   // the Rows card: opens while there is a count, repaints while open\n", "")],
                 ['L-fbase-btnShown', 'L-fbase-opens'], ['fbase']),
    # per-part counts shown without checking them against the view
    'm-noverify': ([('main', "c[c.length - 1] === visible", "true")], ['L-fmismatch-oneLine'], ['fmismatch']),
    # each part counted on every row, not on the rows the parts before it kept
    'm-cumul': ([('main', "                idx = next;\n                counts.push(idx.length);", "                counts.push(next.length);")],
                ['L-fsearch-threeLines', 'L-fsearch-counts'], ['fsearch']),
    # the x puts the other parts back together with OR
    'm-xjoin': ([('main', "P.parts.slice(0, k).concat(P.parts.slice(k + 1)).join(' and ')).trim();",
                  "P.parts.slice(0, k).concat(P.parts.slice(k + 1)).join(' or ')).trim();")], ['L-fsearch-xRewrites'], ['fsearch']),
    # the editor gate upside down
    'm-editor': ([('main', "            var editor = !!pv.isAdmin;", "            var editor = !pv.isAdmin;")],
                 ['L-rcap-switchBtn', 'L-rcapv-noSwitch'], ['rcap', 'rcapv']),
    # the saved row limit never read
    'm-savedon': ([('main', "            return st.noLimit !== true;", "            return false;")],
                  ['L-rcap-savedSentence', 'L-rcap-saveFoot', 'L-rsaved-infoBox'], ['rcap', 'rsaved']),
    # Escape hands the focus to the segment, not its button
    'm-escfocus': ([('main', "                    : (this.id === 'sbRowsSeg' ? document.getElementById('sbRowsBtn') : this);", "                    : this;")],
                   ['L-rkbd-escFocus'], ['rkbd']),
    # the outside-click test left on the old list: a click in the card shuts it
    'm-outside': ([('main', "            if ($(e.target).closest(POP_SEGS).length) return;\n",
                    "            if ($(e.target).closest('#sbDataSeg, #sbUserSeg, #sbLoadSeg').length) return;\n")],
                  ['L-rkbd-insideKeeps', 'L-fsearch-xStaysOpen'], ['rkbd', 'fsearch']),
    # the focus not put back after a repaint
    'm-focus': ([('main', "            if (!keep) return;\n            var t = keep.id", "            return;\n            var t = keep.id")],
                ['L-fsearch-xFocus', 'L-fsearch-clearFocus'], ['fsearch']),
    # the click opens the card with no count to explain
    'm-ready': ([('main', "            if (this.id === 'sbRowsSeg' && !this.classList.contains('sb-rows-ready')) return;   // no count yet: nothing to explain\n", "")],
                ['L-rrepo-staysShut'], ['rrepo']),
    # the box's text counted instead of the search the rows reflect
    'm-applied': ([('main', "&& penumbraTakeSrcModifier(box).query !== _flatSearchAppliedFor) {", "&& false) {")], ['L-fpending-applied'], ['fpending']),
    # the limit box not tied to the icon
    'm-capnote': ([('main', "var note = (w && w.style.display !== 'none') ? (w.getAttribute('title') || '') : '';",
                    "var note = w ? (w.getAttribute('title') || '') : '';")], ['L-r150-noBox'], ['r150']),
    # the page line's range
    'm-page': ([('main', "text: _sbRfFmt((pg - 1) * per + 1) + '–' + _sbRfFmt(Math.min(pg * per, shown)) });", "text: _sbRfFmt(pg * per) });")],
               ['L-fbase-pageLine'], ['fbase']),
    # the link without ?rowlimit never offered
    'm-urllink': ([('main', "} else if (!savedOn && _penumbraRowLimitOverride() === true) {", "} else if (false) {")], ['L-rcapurl-urlLink'], ['rcapurl']),
    # the grouped and pivot views read as the flat table
    'm-grouped': ([('main', "            if ($('#groupedResultsContainer').is(':visible')) return 'grouped';\n", "")], ['L-gsearch-groupsLine'], ['gsearch']),
    'm-pivot': ([('main', "            if ($('#pivot-output-container').is(':visible')) return 'pivot';\n", "")], ['L-pbase-pivotLine'], ['pbase']),
    # the narrow screen's clip left on the open card
    'c-overflow': ([('css', "#pnbStatusBar .sb-seg.sb-lead.sb-open { overflow: visible; }\n", "")], ['L-rnarrow-cardVisible'], ['rnarrow']),
    # the button not hidden until there is a count
    'i-hidden': ([('index', ' aria-label="Where these rows come from" hidden>', ' aria-label="Where these rows come from">')],
                 ['S-btn', 'L-fbase-btnHiddenAtFirst'], ['fbase']),
    # ---- round 2 (2026-10-19, rfx) ----
    # the x back out past the count, at the line's end
    'm-xout': ([('main', "'</code>' + x + '</span>'", "'</code></span>'"),
                ('main', "+ (val ? '<span class=\"sb-rf-val\">' + val + '</span>' : '') + '</li>';",
                 "+ (val ? '<span class=\"sb-rf-val\">' + val + '</span>' : '') + x + '</li>';")],
               ['L-fsearch-xInChip', 'L-fsearch-xAtTextEnd', 'L-fsearch-numsAligned'], ['fsearch']),
    # the card shrink-to-fit again: as wide as the count under it allows
    'c-width': ([('css', "#pnbStatusBar .sb-rows-pop { width: max-content; ", "#pnbStatusBar .sb-rows-pop { ")],
                ['L-fwide-oneLine', 'L-fwide-wider', 'L-fwide-notByCount'], ['fwide']),
    # the old 420px cap
    'c-max': ([('css', "max-width: min(600px, calc(100vw - 48px)); }", "max-width: 420px; }")], ['L-fwide-oneLine', 'L-fwide-wider'], ['fwide']),
    # the cap without the window: off the edge of a narrow one
    'c-vwclamp': ([('css', "max-width: min(600px, calc(100vw - 48px)); }", "max-width: 600px; }")], ['L-rnarrow-fitsNarrow'], ['rnarrow']),
    # the boxes' paragraphs set the card's width
    'c-contain': ([('css', "    contain: inline-size;   /* takes the card's width, never sets it */\n", "")], ['L-rcap-boxNoWiden'], ['rcap']),
    # the keyword and the chip as plain inline boxes: a long chip drops under the keyword
    'c-chipflex': ([('css', "#pnbStatusBar .sb-rf-search .sb-rf-lab { display: flex; align-items: baseline; gap: 5px; }\n", "")],
                   ['L-fwide-kwBeside'], ['fwide']),
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
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php'), 'help2': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php')}
cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
if stage_dir and not control:
    for k, v in RELS.items():
        if os.path.exists(os.path.join(stage_dir, v)): cand[k] = os.path.join(stage_dir, v)
sys.path.insert(0, HERE)
import mk_harness
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    def one(old, new):
        nonlocal out
        if out.count(old) != 1: raise SystemExit('hook anchor x%d: %r' % (out.count(old), old[:60]))
        out = out.replace(old, new)
    one('    function hideLoading() {', '    function hideLoading() {\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
    # what a snippet's search action does (the action runner's case 'search')
    one('    async function runTableSearch() {',
        "    window.__pnbRf = { search: function (t) { previousSearchValue = ''; $('#tableSearch').val(t).trigger('input'); return runTableSearch(); } };\n"
        '    async function runTableSearch() {')
    return out

def mutate(texts, name):
    t = dict(texts)
    for key, old, new in MUTANTS[name][0]:
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[key].count(old) != 1 and t[key].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[key].count(old) != 1: raise SystemExit("mutant '%s': anchor found %d times in %s: %r" % (name, t[key].count(old), key, old[:90]))
        t[key] = t[key].replace(old, new)
    return t

def static_checks(texts):
    out = []
    idx = texts['index']
    m = re.search(mk_harness.LEAD_RX, idx)
    leadseg = m.group(0) if m else ''
    b = re.search(r'<button[^>]*id="sbRowsBtn"[^>]*>', leadseg)
    bt = b.group(0) if b else ''
    out.append(('S-btn', bool(bt) and ' hidden' in bt and 'aria-expanded="false"' in bt and 'aria-controls="sbRowsPop"' in bt
                and 'aria-label="Where these rows come from"' in bt and 'type="button"' in bt, bt[:200] or 'no #sbRowsBtn in the lead segment'))
    out.append(('S-lift', all(x in leadseg for x in ('id="sbRows"', 'id="sbRowLimitWarn"', 'id="sbRowsBtn"')) and '<div' not in leadseg[5:],
                'lead segment %d chars' % len(leadseg)))
    out.append(('S-liveStatus', bool(re.search(r'<span[^>]*id="sbRows"[^>]*role="status"[^>]*aria-live="polite"', leadseg)), 'the live row count'))
    # (2026-10-19) S-help1 pinned the v1 help's Rows entry; the v1 help is gone and S-help2 pins the topic
    h2 = texts['help2']
    m2 = re.search(r'<td[^>]*><strong>Rows</strong></td><td[^>]*>(.*?)</td>', h2)
    cell = m2.group(1) if m2 else ''
    words = len(re.sub(r'<[^>]+>', ' ', cell).split())
    out.append(('S-help2', 'Click it for where the rows come from' in cell and 'turn it off and run again' in cell, cell[:120]))
    out.append(('S-help2words', 'Click it for where' in cell and words <= 70 and '&mdash;' not in cell and '\u2014' not in cell, '%d words' % words))
    return out

stage = tempfile.mkdtemp(prefix='pnb_rf_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path, width=None, scn=None):
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        if width: call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 820, 'deviceScaleFactor': 1, 'mobile': False})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 400:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                shot = os.environ.get('PNB_SHOT')
                if shot and os.environ.get('PNB_SHOT_SCN', scn) == scn:
                    import base64
                    # the card and the bar under it (the whole page when the card is not open)
                    rc = call('Runtime.evaluate', {'expression': 'JSON.stringify((function () { var p = document.getElementById("sbRowsPop"); var r = p && p.offsetHeight ? p.getBoundingClientRect() : null; return r ? { y: Math.max(0, r.top - 14), w: Math.min(window.innerWidth, Math.max(r.right + 260, 720)), h: window.innerHeight - Math.max(0, r.top - 14) } : null; })())', 'returnByValue': True}).get('result', {}).get('value')
                    rc = json.loads(rc) if rc else None
                    shot_p = {'format': 'png'}
                    if rc: shot_p['clip'] = {'x': 0, 'y': rc['y'], 'width': rc['w'], 'height': rc['h'], 'scale': 1.5}
                    d = call('Page.captureScreenshot', shot_p).get('data')
                    if d: open(shot, 'wb').write(base64.b64decode(d))
                return json.loads(v)
        return {'fatal': 'timeout (400 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, URLX.get(s, '')), NARROW.get(s), s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600] + '   info %s' % json.dumps(r.get('info'))[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        info = json.dumps(r.get('info'), ensure_ascii=False)
        print('  info %s: %s' % (s, info[:1100]))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s' % v))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            mt = mutate(texts, m)
            write_stage(mt)
            res = static_checks(mt) + run_browser(scns)
            red = [a for a, p, _ in res if not p]
            dead = [a[2:] for a in red if a.startswith('F-')]
            good = not [x for x in must if x not in red and not [d for d in dead if x.startswith('L-' + d + '-')]]
            okc += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = static_checks(texts) + run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen and (a.startswith('S-') or a.split('-')[1] in SCN))
            old_red = sorted(a for a in red if a not in NEW and not a.startswith('E-') and not a.startswith('F-'))
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
    shutil.rmtree(stage, ignore_errors=True)
