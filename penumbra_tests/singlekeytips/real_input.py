"""Single-key hints - REAL input and COST half (2026-09-25).

    py -3 real_input.py <staged report run dir> [<staged BASE run dir>]
    (run.ps1 -Real passes the dirs it staged)

The browser half dispatches synthetic events. This drives the same harness
(harness.html?real=1) in headless Edge over CDP: real pointer hit-testing and
the tooltip's real 600 ms show delay, a real Tab into the toolbar, real key
presses (Input.dispatchKeyEvent) - and measures what the feature costs, with a
real clock (no virtual time here):
  P1  the content callback per tooltip, against jQuery UI's stock callback, on
      a keyed control, an unkeyed one and a titled element with no id
  P2  a whole tooltip open + close, with the page's callback vs the stock one
  P3  every event listener on the page after the same boot + query - native
      (DOMDebugger.getEventListeners over the whole document, plus window) and
      jQuery's - against the BASE build (the files before the feature)
Exits 0 when every check passes. Needs `py -3 -m pip install websocket-client`.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
BASE = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else ''
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9337
prof = tempfile.mkdtemp(prefix='pnbedge_sktr_')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                         '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                         '--user-data-dir=' + prof, '--window-size=1400,1000', '--remote-debugging-port=%d' % PORT,
                         '--remote-allow-origins=*', 'about:blank'])
ws_url = None
for _ in range(60):
    try:
        tl = json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % PORT, timeout=2))
        pages = [t for t in tl if t.get('type') == 'page' and t.get('url', '').startswith('about:blank')]
        if pages:
            ws_url = pages[0]['webSocketDebuggerUrl']
            break
    except Exception:
        pass
    time.sleep(0.5)
if not ws_url:
    edge.kill()
    sys.exit('no CDP page target')
ws = websocket.create_connection(ws_url, timeout=120)
_id = [0]


def send(method, **params):
    _id[0] += 1
    ws.send(json.dumps({'id': _id[0], 'method': method, 'params': params}))
    return _id[0]


def call(method, **params):
    my = send(method, **params)
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == my:
            if 'error' in m:
                raise RuntimeError(m['error'])
            return m.get('result', {})


def ev(expr, await_promise=False):
    r = call('Runtime.evaluate', expression=expr, awaitPromise=await_promise, returnByValue=True)
    if 'exceptionDetails' in r:
        raise RuntimeError(json.dumps(r['exceptionDetails'])[:600])
    return r['result'].get('value')


def obj(expr):
    r = call('Runtime.evaluate', expression=expr, returnByValue=False)
    return r['result'].get('objectId')


def mouse(kind, x, y, buttons=0):
    call('Input.dispatchMouseEvent', type=kind, x=x, y=y, button='none' if kind == 'mouseMoved' else 'left',
         buttons=buttons, clickCount=1)
    time.sleep(0.05)


def key(k, code, vk, text=None, modifiers=0):
    p = dict(type='keyDown', key=k, code=code, windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk, modifiers=modifiers)
    if text:
        p['text'] = text
    call('Input.dispatchKeyEvent', **p)
    call('Input.dispatchKeyEvent', type='keyUp', key=k, code=code, windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk, modifiers=modifiers)
    time.sleep(0.15)


results = []


def rec(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:500]))


def load(run_dir):
    url = 'file:///' + run_dir.replace('\\', '/') + '/harness.html?real=1'
    call('Page.navigate', url=url)
    for _ in range(150):
        try:
            if ev("document.readyState === 'complete' && document.getElementById('out').textContent === 'READY' && !!(window.jQuery && jQuery(document).data('ui-tooltip'))"):
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def boot(run_dir):
    ok = load(run_dir)
    if ok:
        ev("localStorage.setItem('pnb_single_keys','on'); true")
        ev("__drv.runQuery(60).then(function(){return true;})", True)
        time.sleep(1.0)
        ev("document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0,0); true")
    return ok


def center(sel):
    return ev("(function(){var r=document.querySelector(%s).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()" % json.dumps(sel))


def visible_tip():
    return ev("(function(){var t=jQuery('.ui-tooltip:visible .ui-tooltip-content').last();return t.length?t.text():null;})()")


def listeners():
    """Every listener on the page: native (document subtree + window) and jQuery's."""
    doc = obj('document')
    win = obj('window')
    n_doc = len(call('DOMDebugger.getEventListeners', objectId=doc, depth=-1, pierce=True).get('listeners', []))
    n_win = len(call('DOMDebugger.getEventListeners', objectId=win).get('listeners', []))
    jq = ev("""(function(){
        var n = 0, types = {};
        function add(el){ var e = jQuery._data(el, 'events'); if (!e) return; Object.keys(e).forEach(function(t){ n += e[t].length; types[t] = (types[t]||0) + e[t].length; }); }
        add(window); add(document);
        var all = document.querySelectorAll('*'); for (var i = 0; i < all.length; i++) add(all[i]);
        return { n: n, keydown: types.keydown || 0, mouseover: types.mouseover || 0, focusin: types.focusin || 0 };
    })()""")
    return {'native_doc': n_doc, 'native_win': n_win, 'jq': jq['n'], 'jq_keydown': jq['keydown'], 'jq_mouseover': jq['mouseover'], 'jq_focusin': jq['focusin']}


try:
    call('Page.enable')
    call('Runtime.enable')
    call('DOM.enable')
    ok = boot(RUN)
    rec('X0 the harness boots and a 60-row run puts the toolbar on screen', ok and ev("jQuery('#pivotBtn').is(':visible')"), 'booted=%s' % ok)

    # X1: a REAL hover - hit-testing and the tooltip's own 600 ms show delay.
    # (The harness page is tall: bring the toolbar into the 1000px viewport first.)
    ev("document.getElementById('pivotBtn').scrollIntoView({block: 'center'}); true")
    time.sleep(0.3)
    c = center('#pivotBtn')
    mouse('mouseMoved', 5, 5)
    mouse('mouseMoved', c['x'], c['y'])
    hit = ev("(function(){var el=document.elementFromPoint(%f,%f);return !!(el && el.closest && el.closest('#pivotBtn'));})()" % (c['x'], c['y']))
    early = visible_tip()
    time.sleep(1.0)
    tip = visible_tip()
    rec('X1 a REAL hover on the pivot icon shows "(P or CTRL+SHIFT+P) Create a Pivot Table" after the usual delay',
        hit and tip == '(P or CTRL+SHIFT+P) Create a Pivot Table', 'hit=%s at+0=%r at+1s=%r' % (hit, early, tip))
    mouse('mouseMoved', 5, 5)
    time.sleep(0.5)
    gone = visible_tip()
    title_back = ev("document.getElementById('pivotBtn').getAttribute('title')")
    rec('X2 moving away closes it and the title attribute is untouched', gone is None and title_back == '(CTRL+SHIFT+P) Create a Pivot Table',
        'after=%r title=%r' % (gone, title_back))

    # X3: a REAL Tab from the download icon lands on the pivot icon: its tooltip opens on focus.
    ev("document.getElementById('downloadBtn').focus(); true")
    time.sleep(0.2)
    key('Tab', 'Tab', 9)
    time.sleep(1.0)
    act = ev("document.activeElement && document.activeElement.id")
    ftip = visible_tip()
    rec('X3 a REAL Tab onto the pivot icon opens its tooltip on focus, with the key', act == 'pivotBtn' and ftip == '(P or CTRL+SHIFT+P) Create a Pivot Table',
        'active=%r tip=%r' % (act, ftip))
    ev("document.activeElement.blur(); jQuery(document).tooltip('close'); true")
    time.sleep(0.3)

    # X4: REAL keys - "P" as Caps Lock sends it (no Shift), then "p", then Shift+P.
    ev("""(function(){ window.__cnt = 0; jQuery('#pivotBtn').off('click').on('click.skt', function(e){ window.__cnt++; e.stopPropagation(); e.preventDefault(); return false; }); return true; })()""")
    key('P', 'KeyP', 80, text='P')
    n1 = ev('window.__cnt')
    key('p', 'KeyP', 80, text='p')
    n2 = ev('window.__cnt')
    key('P', 'KeyP', 80, text='P', modifiers=8)
    n3 = ev('window.__cnt')
    rec('X4 REAL keys: P (Caps Lock), p and Shift+P each open the pivot builder once', n1 == 1 and n2 == 2 and n3 == 3, 'counts %s %s %s' % (n1, n2, n3))
    ev("localStorage.setItem('pnb_single_keys','off'); true")
    key('P', 'KeyP', 80, text='P')
    n4 = ev('window.__cnt')
    ev("localStorage.setItem('pnb_single_keys','on'); true")
    rec('X5 REAL P with the switch off does nothing', n4 == 3, 'count %s' % n4)

    # P1: the callback itself, real clock, against jQuery UI's stock callback.
    bench = ev("""(function(){
        var fn = jQuery(document).tooltip('option', 'content');
        var stock = jQuery.ui.tooltip.prototype.options.content;
        var cell = document.createElement('span'); cell.setAttribute('title', 'A titled table cell with a long value that got cut short by the column width'); document.body.appendChild(cell);
        var keyed = document.getElementById('pivotBtn'), unkeyed = document.getElementById('snapshotBtn');
        function us(f, el, n) { var t0 = performance.now(); for (var i = 0; i < n; i++) f.call(el); return (performance.now() - t0) * 1000 / n; }
        var N = 20000, out = {};
        [['cell', cell], ['keyed', keyed], ['unkeyed', unkeyed]].forEach(function (p) { us(fn, p[1], 2000); us(stock, p[1], 2000); });
        [['cell', cell], ['keyed', keyed], ['unkeyed', unkeyed]].forEach(function (p) {
            var a = [], b = [];
            for (var r = 0; r < 5; r++) { a.push(us(stock, p[1], N)); b.push(us(fn, p[1], N)); }
            a.sort(function(x,y){return x-y;}); b.sort(function(x,y){return x-y;});
            out[p[0]] = { stock: Math.round(a[2] * 100) / 100, page: Math.round(b[2] * 100) / 100 };
        });
        cell.remove();
        return out;
    })()""")
    worst = max(bench[k]['page'] - bench[k]['stock'] for k in bench)
    rec('P1 the content callback costs microseconds per tooltip (median of 5 x 20,000 calls, us/call) - overhead under 20 us',
        worst < 20, json.dumps(bench) + ' worst overhead %.2f us' % worst)

    # P2: a whole tooltip open + close, the page's callback vs the stock one swapped in.
    # A closed tooltip is removed only after its hide animation, i.e. after the loop
    # yields - so every batch starts from a clean page, and the order alternates,
    # or whichever variant ran second would pay for the first one's leftovers.
    cyc = ev("""(async function(){
        var $b = jQuery('#pivotBtn'), inst = jQuery(document).tooltip('instance');
        var page = jQuery(document).tooltip('option', 'content'), stock = jQuery.ui.tooltip.prototype.options.content;
        function clean() { jQuery('.ui-tooltip').remove(); if (inst && inst.liveRegion) inst.liveRegion.empty(); }
        function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
        function cycles(n) { var t0 = performance.now(); for (var i = 0; i < n; i++) { $b.trigger('mouseover'); $b.trigger('mouseleave'); } return (performance.now() - t0) / n; }
        clean(); cycles(30); await sleep(100); clean();
        var a = [], b = [];
        for (var r = 0; r < 6; r++) {
            var order = (r % 2) ? ['page', 'stock'] : ['stock', 'page'];
            for (var k = 0; k < 2; k++) {
                jQuery(document).tooltip('option', 'content', order[k] === 'page' ? page : stock);
                clean(); await sleep(50);
                (order[k] === 'page' ? b : a).push(cycles(100));
            }
        }
        jQuery(document).tooltip('option', 'content', page);
        clean();
        a.sort(function(x,y){return x-y;}); b.sort(function(x,y){return x-y;});
        function med(v) { return Math.round(((v[2] + v[3]) / 2) * 1000) / 1000; }
        return { stock_ms: med(a), page_ms: med(b) };
    })()""", True)
    rec('P2 a whole tooltip open + close (ms, median of 6 x 100, alternating) - the hint adds under 0.1 ms to it',
        cyc['page_ms'] - cyc['stock_ms'] < 0.1, json.dumps(cyc))

    errors = ev("window.__errors.concat(window.__rejections).slice(0,5)")
    rec('X9 no page errors', not errors, json.dumps(errors))

    # P3: every listener, this build vs the build before the feature, after the same boot + run.
    if BASE:
        time.sleep(0.2)
        mine_ok = boot(RUN)
        time.sleep(1.5)
        mine = listeners()
        base_ok = boot(BASE)
        time.sleep(1.5)
        base = listeners()
        rec('P3 no listener added: the page holds exactly as many event listeners (native and jQuery) as the build before the feature',
            mine_ok and base_ok and mine == base, 'this build %s | before %s' % (json.dumps(mine), json.dumps(base)))
    else:
        print('  SKIP  P3 listener comparison (no base build given)')
finally:
    try:
        ws.close()
    except Exception:
        pass
    edge.kill()
    time.sleep(0.5)
    subprocess.run(['powershell', '-NoProfile', '-Command',
                    "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*pnbedge_sktr_*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"],
                   capture_output=True)

npass = sum(1 for r in results if r[1])
for name, ok, detail in results:
    print('  %s  %s  [%s]' % ('PASS' if ok else 'FAIL', name, detail))
print('SUMMARY real pass=%d fail=%d' % (npass, len(results) - npass))
sys.exit(0 if npass == len(results) and results else 1)
