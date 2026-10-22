# penumbra_tests/palmiss/run_js.py - the Quick actions misses log, browser side (2026-10-21).
#
# A minimal page (no main.js): js/penumbra_palette.js from --stage (else live), a report-looking
# body (?id=zzconf, #resultsTable with a SECRETCELL cell, selected), a Help Center TOC with the Ask
# topic and an "Exporting data" topic, window.openHelpCenter stubbed, window.fetch recorded.
# Scenarios: nomatch / abandoned / askhelp / a normal pick (no event) / empty text (no event) /
# the payload's shape (four keys, no cell text, keepalive, the CSRF header, the endpoint).
#
#   py -3 run_js.py [--stage DIR] [--mutants | --mutant NAME]
# Headless Edge over CDP; one headless-Edge suite at a time.
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

MUTANTS = {   # name: (old, new, checks that must go red)
    'leak': ("return { text: text, outcome: outcome, page: page, report: page === 'report' ? reportId() : '' };",
             "return { text: text, outcome: outcome, page: page, report: page === 'report' ? reportId() : '', cell: (document.querySelector('td.selected') || {}).textContent };",
             ['four-keys', 'no-cell-text']),
    'pickall': ("if (picked) { outcome = missHandOff(picked); if (!outcome) { return null; } }",
                "if (picked) { outcome = missHandOff(picked) || 'abandoned'; }", ['normal-pick-silent']),
    'nonomatch': ("? 'abandoned' : 'nomatch'; }", "? 'abandoned' : ''; }", ['nomatch-sent']),
    'noask': ("return (r && r.ask) ? 'askhelp' :", "return (r && r.ask) ? '' :", ['askhelp-sent']),
    'nocsrf': ("'X-Penumbra-Csrf': '1' }", "}", ['csrf-header']),
}

PAGE = r'''<!doctype html><html><head><meta charset="utf-8"><title>palmiss</title></head><body>
<table id="resultsTable"><thead><tr><th>NAME</th></tr></thead><tbody><tr><td class="selected">SECRETCELL</td></tr></tbody></table>
<div id="helpCenterToc"><a class="help-toc-item" data-topic="askHelpLightbox">Ask a question</a><a class="help-toc-item" data-topic="exportHelp">Exporting data</a></div>
<script>
window.__SENT = [];
window.fetch = function (url, opt) { window.__SENT.push({ url: String(url), opt: opt }); return Promise.resolve(new Response('', { status: 204 })); };
window.openHelpCenter = function () { window.__HELP = (window.__HELP || 0) + 1; };
</script>
<script src="js/penumbra_palette.js"></script>
<script>
(async function () {
  var R = { chk: {}, info: {} }, P = window.PenumbraPalette;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function key(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  function inBox(k) { var i = document.querySelector('#pnbPalette input, .pnb-pal-input, [role="combobox"]'); (i || window).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  function bodies() { return window.__SENT.map(function (s) { try { return JSON.parse(s.opt.body); } catch (e) { return null; } }); }
  async function one(text, act) { var n = window.__SENT.length; P.open(text); await wait(500); await act(); await wait(300); if (P.isOpen()) { P.close(); } await wait(100); return bodies().slice(n); }
  try {
    var a = await one('zzqxvw', async function () { P.close(); });
    R.info.nomatch = a; R.chk['nomatch-sent'] = a.length === 1 && a[0].outcome === 'nomatch' && a[0].text === 'zzqxvw';
    R.chk['report-kind'] = a.length === 1 && a[0].page === 'report' && a[0].report === 'zzconf';
    var b = await one('export', async function () { key('Escape'); });
    R.info.abandoned = b; R.chk['abandoned-sent'] = b.length === 1 && b[0].outcome === 'abandoned';
    var c = await one('how do i export data?', async function () { inBox('Enter'); });
    R.info.ask = c; R.chk['askhelp-sent'] = c.length === 1 && c[0].outcome === 'askhelp';
    var h0 = window.__HELP || 0;
    var d = await one('exporting', async function () { inBox('Enter'); });
    R.info.pick = { sent: d, help: (window.__HELP || 0) - h0 }; R.chk['normal-pick-silent'] = d.length === 0 && (window.__HELP || 0) > h0;
    var e = await one('', async function () { P.close(); });
    R.chk['empty-silent'] = e.length === 0;
    var all = bodies();
    R.chk['four-keys'] = all.length > 0 && all.every(function (x) { return x && Object.keys(x).sort().join() === 'outcome,page,report,text'; });
    R.chk['no-cell-text'] = window.__SENT.every(function (s) { return String(s.opt.body).indexOf('SECRETCELL') < 0; });
    R.chk['endpoint'] = window.__SENT.every(function (s) { return s.url === 'log_palette_miss.php' && s.opt.method === 'POST' && s.opt.keepalive === true; });
    R.chk['csrf-header'] = window.__SENT.length > 0 && window.__SENT.every(function (s) { return s.opt.headers && s.opt.headers['X-Penumbra-Csrf'] === '1'; });
    R.chk['one-per-open'] = all.length === 3;
  } catch (err) { R.fatal = String(err && err.stack || err); }
  window.__RESULT = R; window.__DONE = true;
})();
</script></body></html>'''
CHECKS = ['nomatch-sent', 'report-kind', 'abandoned-sent', 'askhelp-sent', 'normal-pick-silent', 'empty-silent', 'four-keys', 'no-cell-text', 'endpoint', 'csrf-header', 'one-per-open']

args = sys.argv[1:]
stage_dir = None; mut = None; allm = False
while args:
    a = args.pop(0)
    if a == '--stage': stage_dir = args.pop(0)
    elif a == '--mutant': mut = args.pop(0)
    elif a == '--mutants': allm = True
    else: raise SystemExit('unknown argument ' + a)
src = os.path.join(stage_dir or APP, 'js', 'penumbra_palette.js')
PAL = open(src, 'rb').read().decode('utf-8', 'surrogateescape')

tmp = tempfile.mkdtemp(prefix='pnb_palmiss_')
os.makedirs(os.path.join(tmp, 'js'))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', tmp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.path.join(tmp, 'p'), '--window-size=1300,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run(pal):
    open(os.path.join(tmp, 'js', 'penumbra_palette.js'), 'wb').write(pal.encode('utf-8', 'surrogateescape'))
    open(os.path.join(tmp, 'index.php.html'), 'w', encoding='utf-8').write(PAGE)
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=60, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; ws.send(json.dumps({'id': n[0], 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == n[0]: return r.get('result', {})
    try:
        call('Page.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True}); call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/index.php.html?id=zzconf' % hp})
        t0 = time.time()
        while time.time() - t0 < 60:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__DONE ? JSON.stringify(window.__RESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout'}
    finally:
        ws.close()
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def report(r, quiet=False):
    red = []
    if r.get('fatal'): print('FAIL  fatal %s' % r['fatal'][:1500]); return ['fatal'] + CHECKS
    for c in CHECKS:
        ok = r['chk'].get(c) is True
        if not ok: red.append(c)
        if not quiet or not ok: print('%s  %s%s' % ('PASS' if ok else 'FAIL', c, '' if ok else '   info ' + json.dumps(r.get('info'))[:600]))
    return red
try:
    if mut or allm:
        bad = 0
        for m in ([mut] if mut else list(MUTANTS)):
            old, new, must = MUTANTS[m]
            if PAL.count(old) != 1: print('FAIL  mutant %s: anchor found %d times' % (m, PAL.count(old))); bad += 1; continue
            r = run(PAL.replace(old, new))
            red = report(r, True)
            good = 'fatal' not in red and all(x in red for x in must)
            bad += not good
            print('%s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('MUTANTS ok=%d bad=%d' % ((1 if mut else len(MUTANTS)) - bad, bad))
    else:
        red = report(run(PAL))
        print('PASS %d   FAIL %d' % (len(CHECKS) - len([x for x in red if x in CHECKS]), len(red)))
finally:
    edge.kill(); srv.kill(); time.sleep(1); shutil.rmtree(tmp, ignore_errors=True)
