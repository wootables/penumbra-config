# =============================================================================
# CDASH SUITE (2026-11-01, the card gap list's item 7, part 1) - an embed tile drawn as cards
#
# A dashboard's embed tile has View: Table | Cards (+ the card size) for Show = the whole report or the table alone;
# penumbra_tiles.js viewParams puts cards=1&cardsize= (or cards=0) on the framed report's address and the open link,
# a tile saved before sends nothing; the infobox embed| grammar takes view= / cards= / cardsize=.
#   harness.html: the REAL penumbra_dashboard.js + penumbra_tiles.js against stubbed endpoints   L-<scn>-<check>, E-<scn>
#
#   py -3 run.py                 candidate = LIVE (penumbra_dashboard.js, penumbra_tiles.js)
#   py -3 run.py --stage DIR     a stage in the app layout (each file from DIR when there, else live)
#   py -3 run.py --control       live files, expecting RED on everything new (before the deploy)
#   py -3 run.py --mutants | --mutant NAME     (with --stage DIR: mutate the stage)
# Headless Edge over CDP; stages into %TEMP%\pnb_cdash_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'chart-4.5.1.min.js', 'purify.min.js']
CSS = ['main.css', 'penumbra_tiles.css', 'penumbra_dashboard.css']
SCN = ['render', 'editor', 'infobox']
CHK = {
    'render': ['cardsUrl', 'tableUrl', 'legacyUrl', 'headerNone', 'tableOnlyCards', 'openCards', 'openLegacy'],
    'editor': ['legacyShown', 'legacyKept', 'viewShown', 'sizeHidden', 'sizeShows', 'headerHides', 'tableShows', 'appliedUrl', 'saved', 'reedit', 'backToTable', 'headerNoView'],
    'infobox': ['parseCards', 'parseZero', 'badSizeDropped', 'urlCards', 'urlZero', 'urlNoSize', 'urlHeaderNone', 'jsonCase', 'promptReserved', 'openUrlCards'],
}
# hold on live too: an old tile and a header send no view; a header tile saves none
ABSENT = {'L-render-legacyUrl', 'L-render-headerNone', 'L-render-openLegacy', 'L-infobox-urlHeaderNone', 'L-editor-headerHides', 'L-editor-headerNoView'}
MUTANTS = {
    'noview': ([('tiles', "        src += viewParams(spec);   // (cdash) Table or Cards\n", "")], ['L-render-cardsUrl', 'L-render-tableUrl', 'L-infobox-urlCards'], ['render', 'infobox']),
    'nozero': ([('tiles', "        if (spec.view === 'table') { return '&cards=0'; }\n", "")], ['L-render-tableUrl', 'L-infobox-urlZero'], ['render', 'infobox']),
    'nosize': ([('tiles', "        return '&cards=1' + (CARD_SIZES.indexOf(spec.cardSize) !== -1 ? '&cardsize=' + spec.cardSize : '');", "        return '&cards=1';")],
               ['L-render-cardsUrl', 'L-infobox-urlCards'], ['render', 'infobox']),
    'anysize': ([('tiles', "(CARD_SIZES.indexOf(spec.cardSize) !== -1 ? '&cardsize=' + spec.cardSize : '')", "(spec.cardSize ? '&cardsize=' + spec.cardSize : '')"),
                 ('tiles', "            if (spec.view !== 'cards' || CARD_SIZES.indexOf(spec.cardSize) === -1) { delete spec.cardSize; }\n", "")],
                ['L-infobox-badSizeDropped', 'L-infobox-urlNoSize'], ['infobox']),
    'header': ([('tiles', "        if (spec.type !== 'embed' || (show !== 'both' && show !== 'table')) { return ''; }\n", "        if (spec.type !== 'embed') { return ''; }\n")],
               ['L-render-headerNone', 'L-infobox-urlHeaderNone'], ['render', 'infobox']),
    'noopen': ([('tiles', "        href += viewParams(spec);   // (cdash) the report opens as the tile shows it\n", "")], ['L-render-openCards', 'L-infobox-openUrlCards'], ['render', 'infobox']),
    'noparse': ([('tiles', "                else if (lk === 'view') { spec.view = v; }   // (cdash) view=cards|table\n", "")], ['L-infobox-parseCards'], ['infobox']),
    'noreserve': ([('tiles', "limit: 1, cards: 1, cardsize: 1 };", "limit: 1 };")], ['L-infobox-promptReserved'], ['infobox']),
    'nocase': ([('tiles', "            spec.view = String(spec.view || '').toLowerCase();   // (cdash)\n", "            spec.view = String(spec.view || '');   // (cdash)\n")], ['L-infobox-jsonCase'], ['infobox']),
    'nosave': ([('dash', "                            if (tv === 'cards' || tv === 'table') { next.view = tv; } else { delete next.view; }\r\n", "")], ['L-editor-saved', 'L-editor-appliedUrl'], ['editor']),   # (cnest: re-anchored)
    # (cnest sweep) an old tile keeps no view: the editor's The report's view, an edit that leaves it alone
    'cn-legacy': ([('dash', "if (tv === 'cards' || tv === 'table') { next.view = tv; } else { delete next.view; }", "next.view = tv === 'cards' ? 'cards' : 'table';")], ['L-editor-legacyKept'], ['editor']),
    'cn-legopt': ([('dash', "(t.view === 'cards' || t.view === 'table' ? '' : ' selected') + '>The report&#39;s view</option>' +", "' disabled>The report&#39;s view</option>' +")], ['L-editor-legacyShown', 'L-editor-viewShown'], ['editor']),
    'noshowtoggle': ([('dash', "                $('#teViewField').toggle(!isChart && $(this).val() !== 'header');   // (cdash)\r\n", "")], ['L-editor-headerHides'], ['editor']),
    'nosizetoggle': ([('dash', "            $ov.on('change', '#teView', function () { $('#teCardSize').toggle($(this).val() === 'cards'); });   // (cdash)\r\n", "")], ['L-editor-sizeShows'], ['editor']),
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
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {'dash': pick(os.path.join('js', 'penumbra_dashboard.js')), 'tiles': pick(os.path.join('js', 'penumbra_tiles.js'))}
if control: cand = {'dash': os.path.join(APP, 'js', 'penumbra_dashboard.js'), 'tiles': os.path.join(APP, 'js', 'penumbra_tiles.js')}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cdash_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in CSS: shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(HERE, 'harness.html'), os.path.join(stage, 'harness.html'))
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

def run_page(scn):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s' % (hp, scn)})
        t0 = time.time()
        while time.time() - t0 < 90:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (90 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_browser(texts, scns):
    open(os.path.join(stage, 'dash_hc.js'), 'wb').write(texts['dash'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_tiles.js'), 'wb').write(texts['tiles'].encode('utf-8', 'surrogateescape'))
    out = []
    for s in scns:
        r = run_page(s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:500]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('candidate: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            res = run_browser(mutate(texts, m), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        res = run_browser(texts, SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, d[:400]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            harness = [a for a in failed if a.startswith('E-') or a.startswith('F-')]
            green_new = [a for a, passed, _ in res if passed and a.startswith('L-') and a not in ABSENT]
            red_old = [a for a in failed if a in ABSENT]
            print('CONTROL: harness problems: %s' % (' '.join(harness) or 'none'))
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(green_new) or 'none'))
            print('CONTROL: checks that hold on live, red: %s' % (' '.join(red_old) or 'none'))
            print('RESULT: GREEN' if not harness and not green_new and not red_old else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
