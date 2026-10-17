# =============================================================================
# COLMENU SUITE (2026-10-16) - the table header's right-click menu
# (js/penumbra_colmenu.js + css/penumbra_colmenu.css + main.js window.Penumbra.headerMenu,
# penumbra_calc.js openDialog(name, {seed, onAdded}), penumbra_colwidths.js fit/resetAll).
#   page half   harness.html (mk_harness.py, from colopt's) + driver.js: the REAL main.js,
#               column options, calculated column and column width modules
#                                                                   L-<scn>-<check>, E-<scn>
#   static      index.php loads the module behind its .off switch; the help names it  S-*
# --control runs LIVE (no module: EMPTY files): every NEW check red there, every other
# one green (they describe what live already does: a cell's menu is the browser's).
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_cm_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js']
SCN = ['mflat', 'mkbd', 'mopts', 'mcalc', 'mgroupby', 'gmenu', 'mrestr', 'mexcl', 'mcopy', 'mjournal', 'mmore', 'mfitnest']
CHK = {
    'mflat': ['opens', 'prevented', 'titleName', 'statsLine', 'statsAllUnique', 'statsEmpty', 'statsToggle', 'statsNotes', 'statsFiltered', 'itemsAll', 'sortAsc', 'sortChecked', 'sortDesc', 'sortClear', 'moveRight', 'cellsFollow', 'saved',
              'toastUndo', 'noSavedToast', 'undo', 'edgeDisabled', 'moveStart', 'moveEnd', 'tipNotEarly', 'tipThird', 'tipStored', 'tipOnce',
              'tipOpens', 'hide', 'hideSaved', 'skipHidden', 'showList', 'showHere', 'showFilled', 'swapList', 'swapDone', 'lastNotHidable'],
    'mkbd': ['opensBelow', 'focusFirst', 'arrowMoves', 'enterRuns', 'focusBack', 'escCloses', 'escFocusBack', 'outsideCloses'],
    'mopts': ['optsPopover', 'optsTitle', 'optsNoFreeze', 'optsOpener', 'optsCloses', 'optsBack', 'freezeItem', 'freezes', 'unfreezeItem', 'unfreezes',
              'noFreezePast5', 'fitItem', 'fits', 'resetItem', 'resets', 'fitsLong', 'fitsLongCut', 'fitCapped'],
    'mcalc': ['dialog', 'seeded', 'placedRight', 'placeSaved', 'calcStart'],
    'mgroupby': ['groupItem', 'grouped'],
    'gmenu': ['opens', 'noFreeze', 'groupItems', 'sortsGroups', 'fitGroup', 'moveAll', 'groupsKept', 'hideAll', 'regroup', 'ungroup'],
    'mrestr': ['sortOnly', 'noLayout'],
    'mexcl': ['cellNative', 'numNative', 'compareNative'],
    'mfitnest': ['nestGrow', 'nestCompact', 'fitLines'],
    'mjournal': ['jrnPainted', 'jrnMoves', 'jrnStaysUnsaved', 'jrnSwap', 'jrnSaved'],
    'mmore': ['thenItems', 'thenSort', 'filterList', 'filterApply', 'filterReopen', 'filterBack', 'filterEsc', 'filterClear', 'filterBlank',
              'statsNum', 'statsDate', 'statsTop', 'only', 'showAll', 'resetCol', 'copyName', 'builders', 'toolHidden'],
    'mcopy': ['copyItem', 'copySubmenu', 'copyComma', 'copyNewline', 'copyTab', 'copyFiltered', 'copyKeeps', 'copyOther'],
    # (not in SCN) the menu left open for a picture: PNB_SHOT=<png> py -3 run.py --stage DIR --scn mshot
    'mshot': ['open'],
}
# what this change brings: everything but the checks of what live already does
GUARDS = {'L-mexcl-cellNative', 'L-mexcl-numNative', 'L-mexcl-compareNative', 'L-mshot-open'}
NEW_R1 = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - GUARDS | {'S-indexLoads', 'S-helpNamed'}
# round 2 (2026-10-16): the counts under the name, the measuring Fit
NEW_R2 = {'L-mflat-statsLine', 'L-mflat-statsEmpty', 'L-mflat-statsFiltered', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup', 'S-helpFit'}
# round 3 (2026-10-16): Fit's cap, journal counts, Copy distinct values
NEW = {'L-mopts-fitCapped', 'L-mflat-statsToggle', 'L-mflat-statsNotes', 'S-helpCopy'} | {'L-mcopy-' + c for c in CHK['mcopy']}
# round 4 (same deploy): "all unique" / "none empty" (statsLine and statsFiltered read the new words), Swap...
NEW_R34 = NEW | {'L-mflat-statsAllUnique', 'L-mflat-statsLine', 'L-mflat-statsFiltered', 'L-mflat-swapList', 'L-mflat-swapDone', 'S-helpSwap'}
# round 5 (2026-10-16): journal columns a fixed block; the popover's Back
NEW_R5 = {'L-mopts-optsBack', 'S-helpBack'}
# round 6 (2026-10-16): journal columns movable (mjournal rewritten), the eight new items
NEW_R6 = {'S-helpBack', 'S-helpMore'} | {'L-mjournal-' + c for c in CHK['mjournal']} | {'L-mmore-' + c for c in CHK['mmore']}
# round 7 (2026-10-16): Fit measures nested sub-tables and multi-line cells as they lay out
NEW = {'L-mfitnest-' + c for c in CHK['mfitnest']}
MUTANTS = {
    # --- the module
    'j-menu': ([('menu', "        if (!th || !api()) { return; }\n        e.preventDefault();", "        if (!th || !api() || true) { return; }\n        e.preventDefault();")],
               ['L-mflat-opens', 'L-mflat-prevented'], ['mflat']),
    'j-skiphidden': ([('menu', "            for (j = i - 1; j >= 0; j--) { if (movable(cols[j])) { return j; } }", "            if (i > 0) { return i - 1; }")],
                     ['L-mflat-skipHidden'], ['mflat']),
    'j-tiponce': ([('menu', "        if (isMove && moves > 2 && !tipSeen()) {\n            markTipSeen();", "        if (isMove && moves > 2) {")],
                  ['L-mflat-tipOnce', 'L-mflat-tipStored'], ['mflat']),
    'j-tipearly': ([('menu', "moves > 2 && !tipSeen()", "moves > 1 && !tipSeen()")], ['L-mflat-tipNotEarly'], ['mflat']),
    'j-grouped': ([('menu', "        return (g && th.closest('thead')) ? th : null;", "        return null;")], ['L-gmenu-opens'], ['gmenu']),
    'j-restrict': ([('menu', "        var restricted = A.restricted(), layout", "        var restricted = false, layout")], ['L-mrestr-noLayout'], ['mrestr']),
    'j-kbdplace': ([('menu', "            x = r.left; y = r.bottom;", "            x = r.left; y = r.top - 400;")], ['L-mkbd-opensBelow'], ['mkbd']),
    'j-focusback': ([('menu', "            if (t) { try { t.focus({ preventScroll: true }); } catch (e) { } }", "")], ['L-mkbd-focusBack', 'L-mkbd-escFocusBack'], ['mkbd']),
    'j-showhere': ([('menu', "                l.cols.splice(a < 0 ? l.cols.length : a + 1, 0, it);", "                l.cols.push(it);")], ['L-mflat-showHere'], ['mflat']),
    'j-calcplace': ([('menu', "                A.applyLayout(l);\n            }\n        });", "            }\n        });")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    # --- main.js
    'm-fromheader': ([('main', "        if (opts.fromHeader) {\n            window.Penumbra.refreshSettingsColumns();\n            return _asyncRerender;\n        }\n", "")],
                     ['L-mflat-noSavedToast'], ['mflat']),
    'm-sortrun': ([('main', "        else return;\n        _pnbRunHeaderSort($h.closest('table'));", "        else return;")],
                  ['L-mflat-sortAsc', 'L-mflat-sortDesc', 'L-gmenu-sortsGroups'], ['mflat', 'gmenu']),
    'm-hdrfreeze': ([('main', "            freeze: !hdr && _pnbFreezeState(col) ?", "            freeze: _pnbFreezeState(col) ?")], ['L-mopts-optsNoFreeze'], ['mopts']),
    'm-opener': ([('main', "        _all('.pnb-hm-opener.is-open').removeClass('is-open pnb-hm-opener');\n", "")], ['L-mopts-optsCloses'], ['mopts']),
    # --- the calculated column module, the width module
    'j-calcafter': ([('calc', "                    if (after) { try { after(name); } catch (e) { } }\n", "")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    'j-calcseed': ([('calc', "esc(d ? d.formula : (opts.seed || ''))", "esc(d ? d.formula : '')")], ['L-mcalc-seeded'], ['mcalc']),
    'j-fit': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));\n            return true;", "            return true;")], ['L-mopts-fits', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut'], ['mopts']),
    # --- (round 2) the measuring Fit, the counts
    'j-fitauto': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "            setWidth(c, 'auto');")], ['L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup'], ['mopts', 'gmenu']),
    # --- (round 3) Fit's cap, journal counts, Copy distinct values
    'j-fitcap': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "            setWidth(c, clampW(w, c));")], ['L-mopts-fitCapped'], ['mopts']),
    'm-statsjournal': ([('main', "        var jrn = !!(P.journalFriendlyCol && P.journalSearchColumnValue && P.journalFriendlyCol(String(col)));",
                         "        var jrn = false;")], ['L-mflat-statsToggle', 'L-mflat-statsNotes'], ['mflat']),
    'm-quickdelim': ([('main', "                const delimiter = (_pnbQuick && typeof _pnbQuick.delim === 'string') ? _pnbQuick.delim : ($('#copyDelimiterInput').val() || ';');",
                       "                const delimiter = $('#copyDelimiterInput').val() || ';';")], ['L-mcopy-copyComma', 'L-mcopy-copyNewline', 'L-mcopy-copyTab'], ['mcopy']),
    'm-quickkeep': ([('main', "        if (_pnbQuick) return;\n        lastCopySettings = {", "        lastCopySettings = {")], ['L-mcopy-copyKeeps'], ['mcopy']),
    'j-copyother': ([('menu', "            run: function () { A.copyDistinct(col, null); } });", "            run: function () { A.copyDistinct(col, ';'); } });")],
                    ['L-mcopy-copyOther'], ['mcopy']),
    # --- (round 4) the quick read, Swap...
    'j-allunique': ([('menu', "        var uq = (s.values > 1 && s.unique === s.values) ? 'all unique' : n(s.unique) + ' unique';",
                      "        var uq = n(s.unique) + ' unique';")], ['L-mflat-statsAllUnique'], ['mflat']),
    'j-noneempty': ([('menu', "(s.empty === 0 ? 'none empty' : n(s.empty) + ' empty')", "(n(s.empty) + ' empty')")],
                    ['L-mflat-statsLine', 'L-mflat-statsFiltered', 'L-mflat-statsAllUnique'], ['mflat']),
    'j-swaphalf': ([('menu', "                l.cols[i] = l.cols[j];\n                l.cols[j] = a;", "                l.cols[i] = l.cols[j];")],
                   ['L-mflat-swapDone'], ['mflat']),
    'j-swapself': ([('menu', "            if (!movable(c) || c.colName === col) { return; }", "            if (!movable(c)) { return; }")],
                   ['L-mflat-swapList'], ['mflat']),
    # --- (round 5) the journal block, Back
    'm-back': ([('main', "            back: (hdr && typeof hdr.back === 'function') ? { label: 'Back to the column menu', run: hdr.back } : null", "            back: null")],
               ['L-mopts-optsBack'], ['mopts']),
    'j-backrun': ([('mod', "            e.preventDefault();\n            cfg.back.run();", "            e.preventDefault();")], ['L-mopts-optsBack'], ['mopts']),
    # --- (round 6) journal columns movable; the new items
    'm-jplace': ([('main', "        function placeHead(headRow, prev, th) {\n            if (th.parentNode === headRow) return th;", "        function placeHead(headRow, prev, th) {")],
                 ['L-mjournal-jrnStaysUnsaved'], ['mjournal']),
    'm-jrow': ([('main', "                placeAfter(anchor, cell);\n            }\n        }", "                placeAfter(hash, cell);\n            }\n        }")],
               ['L-mjournal-jrnMoves'], ['mjournal']),
    'm-jsaved': ([('main', "            if (!order) return null;\n            for (var k = order.indexOf(col) - 1;", "            return null;\n            for (var k = order.indexOf(col) - 1;")],
                 ['L-mjournal-jrnSaved'], ['mjournal']),
    'm-thensort': ([('main', "        if (then && (dir === 'asc' || dir === 'desc')) {", "        if (false) {")], ['L-mmore-thenSort'], ['mmore']),
    'm-filterkeep': ([('main', "        if (values && values.length) st.sel[C] = values.slice();", "        if (false) st.sel[C] = values.slice();")], ['L-mmore-filterApply'], ['mmore']),
    'j-filterinit': ([('menu', "        var on = vals.map(function (v) { return any ? !!v.on : true; });", "        var on = vals.map(function (v) { return true; });")],
                     ['L-mmore-filterReopen'], ['mmore']),
    'j-panelesc': ([('menu', "        if (panel && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); closePanel(true); return; }\n", "")],
                   ['L-mmore-filterEsc'], ['mmore']),
    'm-statsnum': ([('main', "            out.num = { min: nums[0], max: nums[nums.length - 1],", "            out.num = { min: nums[nums.length - 1], max: nums[0],")], ['L-mmore-statsNum'], ['mmore']),
    'm-statsdate': ([('main', "                    if (!dMin || k < dMin.k) dMin = { k: k, t: t };", "                    if (!dMin) dMin = { k: k, t: t };")], ['L-mmore-statsDate'], ['mmore']),
    'j-only': ([('menu', "                l.cols.forEach(function (c) { c.visible = c.colName === col; });", "                l.cols.forEach(function (c) { c.visible = true; });")],
               ['L-mmore-only'], ['mmore']),
    'm-resetpos': ([('main', "        if (to !== i) penumbraApplyHeaderLayout(lay);\n", "")], ['L-mmore-resetCol'], ['mmore']),
    'j-copyname': ([('menu', "            navigator.clipboard.writeText(name).then(", "            navigator.clipboard.writeText(String(name).toLowerCase()).then(")],
                   ['L-mmore-copyName'], ['mmore']),
    'j-toolon': ([('menu', "    function toolOn(id) { var b = document.getElementById(id); return !!b && b.getClientRects().length > 0; }",
                   "    function toolOn(id) { return !!document.getElementById(id); }")], ['L-mmore-toolHidden'], ['mmore']),
    'm-blankoffer': ([('main', "return e.v !== '' || e.all > 0 || e.on;", "return true;")], ['L-mmore-filterList', 'L-mmore-filterApply'], ['mmore']),
    # --- (round 7) Fit as the cell lays out
    'j-fittable': ([('colw', "            if (st.display === 'table' || st.display === 'inline-table') {", "            if (false) {")],
                   ['L-mfitnest-nestGrow', 'L-mfitnest-nestCompact'], ['mfitnest']),
    'j-fitbr': ([('colw', "            if (n.tagName === 'BR') { flushLine(acc); continue; }", "            if (n.tagName === 'BR') { continue; }")],
                ['L-mfitnest-fitLines'], ['mfitnest']),
    'j-fitfixed': ([('colw', "        if (st.tableLayout === 'fixed') { w = widest * n; }   // fixed: the columns share the width equally\n", "")],
                   ['L-mfitnest-nestCompact'], ['mfitnest']),
    'j-fitgroup': ([('colw', "        var tables = c.view === 'group' ? document.querySelectorAll('#groupedResultsContainer table') : [c.th.closest('table')];",
                     "        var tables = [c.th.closest('table')];")], ['L-gmenu-fitGroup'], ['gmenu']),
    'm-statshidden': ([('main', "            if (rows[i].classList.contains('search-hidden')) continue;\n            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);",
                        "            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);")], ['L-mflat-statsFiltered'], ['mflat']),
    'm-statsempty': ([('main', "            else seen.add(t);", "            seen.add(t);")], ['L-mflat-statsEmpty'], ['mflat']),
    'j-statsline': ([('menu', "        if (!A || typeof A.colStats !== 'function') { return ''; }", "        if (true) { return ''; }")], ['L-mflat-statsLine'], ['mflat']),
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
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': 'help_content.php', 'topic': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php')}
sys.path.insert(0, HERE)
import mk_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        # main.js mixes line endings: an anchor written with LF may sit in a CRLF stretch
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cm_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
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

def run_page(path):
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if os.environ.get('PNB_SHOT'):
                    import base64
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot))
                return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
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

def static_checks(texts):
    idx, hlp = texts['index'], texts['help']
    return [
        ('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_colmenu.off')" in idx and 'src="js/penumbra_colmenu.js?v=' in idx
         and 'href="css/penumbra_colmenu.css?v=' in idx, ''),
        # (round 5) the popover's Back, the journal block
        ('S-helpBack', 'with a Back button to this menu' in hlp and 'returns to this menu' in texts['topic']
         and 'journal columns move too' in hlp and 'move like any other and stay where you put them' in texts['topic'], ''),
        # (round 6) the new items in both help files
        ('S-helpMore', all(x in texts['topic'] for x in ('Then sort ascending', 'Filter by value...', 'Column stats...', 'Show only this column',
                                                           'Reset this column', 'Copy column name', 'Pivot by this column...'))
         and all(x in hlp for x in ('Then sort ascending / descending', 'Filter by value...', 'Column stats...', 'Reset this column', 'Chart this column...')), ''),
        # (round 4) Swap..., the quick read
        ('S-helpSwap', '<em>Swap...</em>' in hlp and '<em>Swap...</em>' in texts['topic'] and '<em>all unique</em>' in texts['topic']
         and 'all unique when none repeats' in hlp, ''),
        # (round 3) Copy distinct values, the cap, the journal counts
        ('S-helpCopy', 'Copy distinct values...' in hlp and 'Copy distinct values...' in texts['topic'] and "60% of the table's visible width" in hlp
         and "60% of the table's visible width" in texts['topic'] and 'checked and unchecked boxes' in texts['topic'], ''),
        # the v2 topic (the Help Center, help/v2.on) and the classic help both name it
        # (round 2) the help says Fit measures, and names the counts
        ('S-helpFit', 'widest value on screen' in hlp and 'widest value on screen' in texts['topic']
         and 'how many different values' in texts['topic'] and 'and empty cells' in hlp, ''),
        ('S-helpNamed', 'data-colmenu-help' in hlp and 'id="us-colmenu" data-colmenu-help' in texts['topic']
         and 'data-jump-to="us-colmenu"' in texts['topic'], ''),
    ]

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        full = bool(os.environ.get('PNB_INFO'))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:None if full else 600]) if (v is not True or full) else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            dead = [a[2:] for a in red if a.startswith('F-')]
            good = not [x for x in must if x not in red and not [d for d in dead if x.startswith('L-' + d + '-')]]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd if os.environ.get('PNB_INFO') else dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            old_red = sorted(a for a in red if a not in NEW and not a.startswith('F-'))
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
