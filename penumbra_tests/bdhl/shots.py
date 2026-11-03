# bdhl: a screenshot of a pivot cell's breakdown with the pbh rules, from the REAL code (the suite's harness)
#   py -3 shots.py --stage DIR OUT.png
import base64, json, os, sys, time
out_png = sys.argv.pop()
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'run.py'), encoding='utf-8').read()
src = src[:src.index('try:\n    texts = ')]
exec(compile(src, 'run.py', 'exec'))
try:
    write_stage({k: read_b(v) for k, v in cand.items()})
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(x): return call('Runtime.evaluate', {'expression': x, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')
    call('Network.setCacheDisabled', {'cacheDisabled': True})
    call('Emulation.setDeviceMetricsOverride', {'width': 1300, 'height': 820, 'deviceScaleFactor': 1, 'mobile': False})
    call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=' % hp + (os.environ.get('PNB_SCN') or 'pbh')})
    t0 = time.time()
    while time.time() - t0 < 120 and not ev('window.__HCDONE === true'): time.sleep(0.5)
    ev("""(async function () {
      var tr = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr[data-pivot-row]'), function (t) { return t.getAttribute('data-pivot-row') === 'North|||Tier 1'; })[0];
      tr.querySelector('td.pivot-grand-total[data-row-key]').click();
      await new Promise(function (r) { setTimeout(r, 900); });
      if ((new URLSearchParams(location.search)).get('scn') === 'pbhfmt') {
        var t2 = document.querySelector('.infobox-overlay table.pnb-breakdown'), th2 = Array.prototype.filter.call(t2.tHead.rows[0].cells, function (h) { return /V_AMOUNT/.test(h.textContent); })[0];
        var r2 = th2.getBoundingClientRect();
        th2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r2.left + 8, clientY: r2.top + 8 }));
        await new Promise(function (r) { setTimeout(r, 200); });
        document.querySelector('#pnbHeadMenu [data-act="bdFormat"]').click();
        await new Promise(function (r) { setTimeout(r, 250); });
        var ty = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="type"]'); ty.value = 'currency'; ty.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function (r) { setTimeout(r, 300); });
        var dp = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="dp"]'); dp.value = '1'; dp.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(function (r) { setTimeout(r, 500); });
      }
      if ((new URLSearchParams(location.search)).get('scn') === 'pbhui') {
        var t = document.querySelector('.infobox-overlay table.pnb-breakdown'), th = Array.prototype.filter.call(t.tHead.rows[0].cells, function (h) { return /V_AMOUNT/.test(h.textContent); })[0];
        var r = th.getBoundingClientRect();
        th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 8, clientY: r.top + 8 }));
        await new Promise(function (r) { setTimeout(r, 200); });
        document.querySelector('#pnbHeadMenu [data-act="bdHighlight"]').click();
        await new Promise(function (r) { setTimeout(r, 250); });
        document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="hl-add"]').click();
        await new Promise(function (r) { setTimeout(r, 150); });
        var v = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="hl-v"]'); v.value = '50,000'; v.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(function (r) { setTimeout(r, 800); });
      }
      return document.querySelectorAll('.infobox-overlay').length;
    })()""")
    shot = call('Page.captureScreenshot', {'format': 'png'})
    open(out_png, 'wb').write(base64.b64decode(shot['data']))
    print('wrote', out_png)
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
