# =============================================================================
# CALCCOL SUITE (2026-10-10) - calculated columns: js/penumbra_calc.js + its
# main.js hooks (rows on arrival, a view link's state, buildStateObject, Save).
#   engine half  engine.html?id=zzcalc&calc=URLCOL|{A}+{B} + engine.js: the module
#                ALONE - parser, values, ROUND / IF, formats, refusals, the &calc=
#                value, applyRows, stripFromState, the store, Keep / Remove   N-*
#   page half    harness.html (mk_harness.py, from saveconf's) + driver.js: the REAL
#                main.js + the module - &calc= on the table, the dialog's add /
#                edit / remove re-running the query, a view link's state, Save
#                stripping them                               L-<scn>-<check>, E-<scn>
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME]
# Headless Edge over CDP; stages into %TEMP%\pnb_cc_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request, urllib.parse
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
CALC_URL = '&'.join('calc=' + urllib.parse.quote(v, safe='') for v in
                    ['HALF|{H_NUM} / 2', 'DBL|{V_AMOUNT} * 2|currency', 'FLAG|IF({V_STATUS} = "open", "yes", "no")|text', 'BAD|{NOPE} + 1'])
SCN = ['curl', 'cadd', 'cstate', 'cclear', 'cadj']
SCN_Q = {'curl': '&' + CALC_URL}
CHK = {
    # (2026-10-18, calcadj) an adjustable value: the dialog's row, the panel's knob, Enter re-runs,
    # the view state, the header menu's Adjust... panel, the reset
    'cadj': ['row', 'preview', 'added', 'panelKnob', 'changed', 'stateCarries', 'menuItem', 'menuEditItem', 'menuPanel', 'menuPanelPlaced', 'menuChanged',
             'boxSprings', 'typedKept', 'menuEditOpens', 'resetFocus', 'reset',   # round 2 (2026-10-19): Edit item, the panel placed, the box springs, typing survives a run, focus after reset
             'noQuery'],   # round 3: a knob change replays the last answer, no query
    'curl': ['halfShown', 'dblCurrency', 'flagText', 'badLeftOut', 'atEnd', 'panelFromLink', 'summable'],
    'cadd': ['addButton', 'dialog', 'layout', 'cheatPlain', 'adjOneLine', 'noEarlyError', 'chips', 'chipInserts', 'preview', 'reran', 'added', 'listAfterAdd', 'edited', 'removed', 'listAfterRemove',
             'editFocus', 'removeFocus'],   # moderate 2026-10-15: WCAG 2.4.3; cheatPlain / adjOneLine 2026-10-19 (calcadj round 2)
    'cclear': ['before', 'listed', 'cleared'],
    'cstate': ['stateShown', 'viewStateCarries', 'saveStrips'],
}
ENGINE = ['add', 'accounting', 'pctIn', 'divZero', 'textIsBlank', 'blankIsBlank', 'missingIsBlank', 'leadPartial', 'precedence', 'parens',
          'unary', 'doubleNeg', 'leftAssoc', 'divAssoc', 'caseCols', 'floatNoise', 'round2', 'roundNeg', 'roundTens', 'roundBlank', 'roundCase',
          'ifText', 'ifTextNo', 'numCompare', 'moneyCompare', 'ifLazy', 'ifBlank', 'ifZero', 'ifNested', 'bareCompare', 'bangEq', 'blankEqEmpty',
          'ifColValue', 'fmtCurrency', 'fmtCurrencyNeg', 'fmtCurrencyNegZero', 'fmtPercent', 'fmtNumber', 'fmtBig', 'fmtTextKeeps', 'fmtTextNumber',
          'errMissingOp', 'errBrace', 'errEmptyBrace', 'errUnknownFn', 'errRoundArgs', 'errIfArgs', 'errBareName', 'errAtAt', 'errEmpty', 'errLong',
          'errEndsSoon', 'errStrayChar', 'errQuote', 'refs', 'urlFull', 'urlNoFmt', 'urlSpaceName', 'urlNoFormula', 'urlBadName', 'urlPipeInText',
          'urlRoundTrip', 'applyCopies', 'applyValue', 'applyBlank', 'applyChain', 'applyAtEnd', 'applySkipsClash', 'applySkipsBad', 'applyNotices',
          'applySummable', 'applyEmpty', 'stripCount', 'stripState', 'stripVisible', 'stripOrder', 'stripSort', 'urlActive', 'dialogOpens',
          'previewRows', 'storeSaved', 'dialogClosed', 'panelListed', 'dialogRefusesClash', 'dialogRefusesMissing', 'escCloses', 'keepSaves',
          'removeDrops', 'noEval', 'urlWinsOverSaved',
          'catNames', 'catBlank', 'catNumber', 'catDate', 'catCompare', 'dIso', 'dUs', 'dOracle', 'dLong', 'dTime', 'dLeap', 'dBadDay',
          'dText', 'dMinus', 'dPlus', 'dPlusFirst', 'dMinusN', 'dCompare', 'dNumNotDate', 'dToday', 'dSince', 'dTodayCurrencyFmt',
          'errDaysArgs', 'errTodayArgs', 'errUnknownLists', 'errAmpLink',
          # (2026-10-18, calcadj) adjustable values
          'inpToken', 'inpMissing', 'inpInText', 'inpErrEmpty', 'inpCompile', 'urlInput', 'urlInputRoundTrip', 'urlInputNoFmt', 'cleanInputClamp', 'cleanInputBad',
          'applyInputs', 'applyNoInput', 'inputsListed', 'setInput', 'setInputStored', 'setInputBad', 'inputsFor', 'knobHtml', 'setInputClamp', 'setInputBackToDefault',
          'clearInputs', 'panelKnob', 'panelKnobChange', 'dialogAdjRow', 'dialogAdjMissing', 'dialogAdjBadVal', 'dialogAdjBadBounds', 'dialogAdjClash', 'dialogAdjPreview',
          'dialogAdjSaved', 'dialogAdjEditOpen', 'dialogAdjEditKeepsKnob', 'dialogAdjEditResets',
          # round 2 (2026-10-19)
          'stripCarrier', 'dupInput', 'applyBoxSame', 'adjErrOpens']
MUTANTS = {
    # the module (LF)
    'e-precedence': ([('calc', "while (isOp(tk[p], '+') || isOp(tk[p], '-')) { var op = tk[p++].v; a = { k: 'bin', op: op, a: a, b: mul() }; }",
                       "while (isOp(tk[p], '+') || isOp(tk[p], '-')) { var op = tk[p++].v; a = { k: 'bin', op: op, a: a, b: unary() }; }")], ['N-precedence'], []),
    # 2026-10-10 calcsweep: ROUND shifts the DECIMAL text (roundHalfAway); the mutant is the plain float multiply.
    'e-roundnudge': ([('calc', "var r = Math.round(Number(str + 'e' + pl));", "var r = Math.round(a * Math.pow(10, pl));")], ['N-round2'], []),
    'e-numcmp': ([('calc', "if (na !== null && nb !== null) c = na < nb", "if (false) c = na < nb")], ['N-numCompare'], []),
    'e-case': ([('calc', "var sa = va === null ? '' : String(va).toLowerCase(), sb = vb === null ? '' : String(vb).toLowerCase();",
                 "var sa = va === null ? '' : String(va), sb = vb === null ? '' : String(vb);")], ['N-ifText'], []),
    'e-atat': ([('calc', "if (s.indexOf('@@') !== -1) throw new CalcError('Text may not contain @@.');", "")], ['N-errAtAt'], []),
    'e-blank': ([('calc', "if (a === null || b === null) return null;\n", "")], ['N-blankIsBlank'], []),
    'e-negzero': ([('calc', "(v < 0 && Number(Math.abs(v).toFixed(2)) !== 0 ? '-' : '')", "(v < 0 ? '-' : '')")], ['N-fmtCurrencyNegZero'], []),
    'e-stripsort': ([('calc', "        if (Array.isArray(state.sortCriteria)) {\n", "        if (false) {\n")], ['N-stripSort'], []),
    'e-clash': ([('calc', "if (byUpper[d.name] !== undefined) e.why = 'a column named ' + d.name + ' is already in the report';", "if (false) e.why = '';")],
                ['N-applySkipsClash'], []),
    'e-urlwins': ([('calc', "put(savedDefs(), 'saved'); put(stateDefs, 'state'); put(urlDefs, 'url');", "put(urlDefs, 'url'); put(stateDefs, 'state'); put(savedDefs(), 'saved');")],
                  ['N-urlWinsOverSaved'], []),
    # main.js (CRLF)
    'm-ingest': ([('main', "                        try { data = window.PenumbraCalc.applyRows(data) || data; } catch (_calcErr) { console.warn('calculated columns:', _calcErr); }\r\n", "")],
                 ['L-curl-halfShown', 'L-cstate-stateShown'], ['curl', 'cstate']),
    'm-visible': ([('main', "                                if (raw && !(_calcSeen && _calcSeen.has(d.name))) visibleColumnsSet.add(raw);\r\n", "")],
                  ['L-curl-halfShown', 'L-cstate-stateShown'], ['curl', 'cstate']),
    'm-state': ([('main', "                    window.PenumbraCalc.fromState(decodedState.calcColumns, penumbra_vars.preloadedState ? 'report' : 'state');\r\n", "")], ['L-cstate-stateShown'], ['cstate']),
    'm-bso': ([('main', "            if (_calc.length) state.calcColumns = _calc;\r\n", "")], ['L-cstate-viewStateCarries'], ['cstate']),
    'e-chiprefresh': ([('calc', "        if (t.closest('#pnbCalcCols code, #pnbCalcAdjTok')) { setTimeout(preview, 0); return; }   // main.js puts it at the cursor\n", "")], ['L-cadd-preview'], ['cadd']),
    'e-chipfield': ([('calc', "<textarea id=\"pnbCalcFormula\" class=\"pnb-tpl-field\" spellcheck", "<textarea id=\"pnbCalcFormula\" spellcheck")], ['L-cadd-chips'], ['cadd']),
    # calcfn (2026-10-10): text & dates
    'e-catprec': ([('calc', "            while (isOp(tk[p], '&')) { p++; a = { k: 'cat', a: a, b: add() }; }\n",
                    "            while (isOp(tk[p], '&')) { p++; a = { k: 'cat', a: a, b: mul() }; }\n")], ['N-catNumber'], []),
    'e-feb31': ([('calc', "        if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;   // 31-FEB is not a date\n", "")], ['N-dBadDay'], []),
    'e-datecmp': ([('calc', "                else if (dva && dvb) c = dva.d < dvb.d ? -1 : (dva.d > dvb.d ? 1 : 0);   // two dates, as dates\n", "")], ['N-dCompare'], []),
    'e-oracle': ([('calc', "        if ((m = /^(\\d{1,2})-([A-Za-z]{3})-(\\d{2}|\\d{4})(?: .*)?$/.exec(s))) return MON[m[2].toUpperCase()] ? mkDate(yr(m[3]), MON[m[2].toUpperCase()], +m[1]) : null;\n", "")], ['N-dOracle'], []),
    'e-datefmt': ([('calc', "        if (typeof v === 'object' && typeof v.d === 'number') return dateText(v);   // a date (calcfn)\n", "")], ['N-dPlus'], []),
    'm-clear': ([('main', "            if (window.PenumbraCalc && typeof window.PenumbraCalc.clearSaved === 'function') window.PenumbraCalc.clearSaved();\r\n", "")], ['L-cclear-cleared'], ['cclear']),
    # (2026-10-13) Clear lists an ad-hoc page's columns (penumbra_calc.js keeps them off the store): without it
    # the confirm never comes - "Nothing is saved" - and the column stays
    'm-adhoclist': ([('main', "                    if (d && d.src === 'saved' && d.name && calcNames.indexOf(d.name) === -1) calcNames.push(d.name);\r\n", "")],
                    ['L-cclear-listed', 'L-cclear-cleared'], ['cclear']),
    'm-listrefresh': ([('main', "        if ($('#settingsPanel').hasClass('is-open')) populateSettingsColumns();\r\n", "")], ['L-cadd-listAfterAdd'], ['cadd']),
    'e-listwait': ([('calc', "            if (runs > start && (!!th === !!present)) {\n", "            if (false) {\n")], ['L-cadd-listAfterAdd'], ['cadd']),
    'm-strip': ([('main', "            window.PenumbraCalc.stripFromState(stateObject, $('#resultsTable').data('columnNameToOriginalIndex'));\r\n", "")], ['L-cstate-saveStrips'], ['cstate']),
    # moderate (2026-10-15, WCAG 2.4.3): the rebuilt list no longer puts focus back
    'e-nofocusback': ([('calc', "        if (key) restoreListFocus(key, list);\n", "")], ['L-cadd-editFocus', 'L-cadd-removeFocus'], ['cadd']),
    # ... Save forgets the Edit button that opened the dialog
    # (anchor retargeted 2026-10-19: the colmenu round added `, after = ...` to the line on 10-16)
    'e-noopener': ([('calc', "        var back = openerKey, after = editing ? null : afterAdd;\n", "        var back = null, after = editing ? null : afterAdd;\n")], ['L-cadd-editFocus'], ['cadd']),
    # (2026-10-18, calcadj) adjustable values: {@NAME} not read as a value by the parser (the
    # tokenizer mutant instead made {@R} a column named @R, which the engine page read from its
    # row fixture all the same and then died on a missing value: a FATAL, not a red check)
    'e-inptoken': ([('calc', "            if (t.t === 'inp') { p++; return { k: 'inp', n: t.v }; }\n", "            if (false) { p++; return { k: 'inp', n: t.v }; }\n")], ['N-inpCompile', 'N-inpToken'], []),
    # ... a move not kept as the viewer's override
    'e-inpoverride': ([('calc', "        if (n === inp.def) delete m[name]; else m[name] = n;\n", "        delete m[name];\n")], ['N-setInput', 'L-cadj-changed'], ['cadj']),
    # ... the highest not enforced on a definition's value
    'e-inpclamp': ([('calc', "        if (mx !== null) { o.max = mx; if (o.value > mx) o.value = mx; }\n", "        if (mx !== null) { o.max = mx; }\n")], ['N-cleanInputClamp'], []),
    # ... a view link carrying the default, not the value the viewer sees
    'e-inpeffective': ([('calc', "        return activeDefs().map(function (d) { return plain(d, true); });\n", "        return activeDefs().map(function (d) { return plain(d); });\n")],
                       ['N-setInput', 'L-cadj-stateCarries'], ['cadj']),
    # ... a formula naming a value no column carries kept (a blank column instead of left out)
    'e-inpnoinput': ([('calc', "            if (!e.why && noInp.length) e.why = 'no column carries an adjustable value named ' + noInp.map(function (n) { return '{@' + n + '}'; }).join(', ');\n", "")],
                     ['N-applyNoInput'], []),
    # ... Enter in the knob's box does nothing
    'e-knobenter': ([('calc', "            applyBox(e.target.getAttribute('data-calc-input'), e.target.value);\n            return;\n", "            return;\n")], ['L-cadj-changed'], ['cadj']),
    # the header menu (LF): no Adjust... item
    'n-adjitem': ([('menu', "        if (adj.length) {\n            body.push({ act: 'calcAdj',", "        if (false) {\n            body.push({ act: 'calcAdj',")],
                  ['L-cadj-menuItem'], ['cadj']),
    # round 2 (2026-10-19): the panel not placed (it sat at the page's end); no Edit item
    'n-panelplace': ([('menu', "        place(el, lastAt.x, lastAt.y);\n        // Back returns to THIS menu's spot", "        // Back returns to THIS menu's spot")], ['L-cadj-menuPanelPlaced'], ['cadj']),
    # (round 3: the items live in the Calculated column list)
    'n-edititem': ([('menu', "            body.push({ act: 'calcEdit', label: 'Edit...',", "            if (false) body.push({ act: 'calcEdit', label: 'Edit...',")],
                   ['L-cadj-menuEditItem', 'L-cadj-menuEditOpens'], ['cadj']),
    # round 3: a knob change asks the database again (main.js: the arm never fresh / the module: never armed)
    'm-replay': ([('main', "        _pnbScratchArmAt = Date.now();\r\n        return true;\r\n", "        return true;\r\n")], ['L-cadj-noQuery'], ['cadj']),
    'e-noreplay': ([('calc', "            if (window.Penumbra && typeof window.Penumbra.replayNextRun === 'function') { try { window.Penumbra.replayNextRun(); } catch (e) { } }\n", "")],
                   ['L-cadj-noQuery'], ['cadj']),
    # ... the cheat sheet's labels as gradient headers again; the box not springing to the bound; a run wiping the typed box; the reset dropping focus
    'e-cheatth': ([('calc', "background:none !important;border:0;cursor:default;height:auto;}' +", "}' +")], ['L-cadd-cheatPlain'], ['cadd']),
    'e-boxspring': ([('calc', "        Array.prototype.forEach.call(document.querySelectorAll('[data-calc-input=\"' + name + '\"]'), function (el) { el.value = trimNum(inp.value, 10); });\n",
                      "        Array.prototype.forEach.call(document.querySelectorAll('[data-calc-input=\"' + name + '\"]'), function (el) { if (el !== document.activeElement) el.value = trimNum(inp.value, 10); });\n")],
                    ['L-cadj-boxSprings'], ['cadj']),
    'e-typedlost': ([('calc', "                if (knobBack.typed !== null && knobBack.attr === 'data-calc-input') kb.value = knobBack.typed;\n", "")], ['L-cadj-typedKept'], ['cadj']),
    'e-resetfocus': ([('calc', "            if (bx0) { try { bx0.focus(); } catch (err) { } }\n", "")], ['L-cadj-resetFocus'], ['cadj']),
    # ... a ticked column's carrier not saved with it; two carriers of one name
    'e-stripcarrier': ([('calc', "                    if (who && appliedBy[who] && !keep[who]) { keep[who] = true; added.push(who); grew = true; }\n", "")], ['N-stripCarrier'], []),
    'e-dupinput': ([('calc', "            if (carried[e.input.name]) delete e.input; else carried[e.input.name] = e.name;\n", "            carried[e.input.name] = e.name;\n")], ['N-dupInput'], []),
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
if scn_only: SCN = [scn_only]
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'calc': os.path.join('js', 'penumbra_calc.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js')}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape') if os.path.exists(p) else ''

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    h = '\r\n;try { window.__HC = {}; window.__HC.bso = buildStateObject; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cc_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('main.css', 'density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
# (calcadj) the cadj scenario's header menu: the tile engine it needs and the menu's css (the menu itself is a text under test)
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_tiles.js'), os.path.join(stage, 'penumbra_tiles.js'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colmenu.css'), os.path.join(stage, 'penumbra_colmenu.css'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
subprocess.run([sys.executable, os.path.join(HERE, 'mk_harness.py')], check=True, stdout=subprocess.DEVNULL)
for f in ('harness.html', 'driver.js', 'engine.html', 'engine.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
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
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_calc.js'), 'wb').write(texts['calc'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_colmenu.js'), 'wb').write(texts['menu'].encode('utf-8', 'surrogateescape'))

def run_engine():
    r = run_page('engine.html?id=zzcalc&calc=' + urllib.parse.quote('URLCOL|{A}+{B}', safe=''))
    if r.get('fatal'): return [('F-engine', False, r['fatal'][:400])]
    out = [('E-engine', not r.get('errors'), 'errors %s' % r.get('errors'))]
    chk = r.get('chk') or {}
    for c in ENGINE:
        v = chk.get(c)
        out.append(('N-' + c, v is True, '%s%s' % (v, ('   info %s' % json.dumps((r.get('info') or {}).get(c))[:200]) if v is not True else '')))
    return out

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, SCN_Q.get(s, '')))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:300]) if v is not True else '')))
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
            res = run_engine() + (run_browser(scns) if scns else [])
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-15s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_engine() + run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # live has no module: the engine page cannot run at all, and the page
            # scenarios find nothing to add; only a page that boots cleanly may pass
            absent = {'L-cstate-saveStrips'}   # nothing to strip without the module: holds trivially
            # (since calccol is LIVE, --control-v1 tests the live round-1 module: only the
            # round-2 dialog checks may be red)
            sane = [a for a, passed, _ in res if passed and not a.startswith('E-') and a not in absent]
            print('CONTROL: %d checks red (expected); checks that hold WITHOUT the change: %s' % (f, ' '.join(sane) or 'none'))
            print('RESULT: GREEN' if not sane and f > 0 else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
