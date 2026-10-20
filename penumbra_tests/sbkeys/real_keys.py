# Status-bar keys - the REAL-KEYS half (2026-10-01).
#
# The browser half (driver.js under --dump-dom) dispatches synthetic keydowns,
# which never fire a native click: it can show that nothing above a control took
# the key, not that the control then does its job. This drives the same staged
# page (harness.html?real=1) in headless Edge over CDP with Input.dispatchKeyEvent
# - real key presses on a really focused control, real activation:
#
#   R1  Enter on "Save my customizations..." (custom-layout card) clicks it, the
#       click reaches Save (#saveQuery), and the Settings panel stays shut
#   R2  Space on it does the same
#   R3  Enter and Space on "Open the pivot builder..." (pivot card) click it
#   R4  Enter on a sort button in the grouping card presses it
#   R5  Enter on the custom-layout chip opens its card and not the panel
#   R6  Enter on the Cols count opens its Columns card, not the panel; Enter on the
#       card's "Open the Column & Settings panel..." opens the panel (2026-10-19,
#       colscard: the count opened the panel itself until then, and so did a gear)
#   R7  Escape on a focused button in the pivot card closes the card and puts
#       focus back on the pivot chip; the key never reaches the document
#   R8  Escape in the Data popover closes it, focus on its segment
#   R9  Enter on the snapshot chip opens its card
#   R10 no page errors
#
#   py -3 real_keys.py --dir <staged run dir from run.ps1 -Keep> [--port N] [--json]
#
# Needs: pip install websocket-client. Prints PASS/FAIL lines and RESULT: GREEN/RED
# (--json: one REAL_JSON: line for run.ps1 instead).
import argparse, json, os, socket, subprocess, tempfile, time, urllib.request, uuid

import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
KEYS = {'Enter': ('Enter', 13, '\r'), 'Space': (' ', 32, ' '), 'Escape': ('Escape', 27, None)}


class Cdp:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=60)
        self.n = 0

    def send(self, method, **params):
        self.n += 1
        my = self.n
        self.ws.send(json.dumps({'id': my, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == my:
                if 'error' in msg:
                    raise RuntimeError(method + ': ' + json.dumps(msg['error']))
                return msg.get('result', {})

    def ev(self, expr):
        r = self.send('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True)
        if 'exceptionDetails' in r:
            raise RuntimeError('page threw: ' + json.dumps(r['exceptionDetails'])[:600])
        return r.get('result', {}).get('value')

    def press(self, name):
        key, vk, text = KEYS[name]
        code = 'Space' if name == 'Space' else name
        down = {'type': 'keyDown' if text else 'rawKeyDown', 'key': key, 'code': code,
                'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk}
        if text:
            down['text'] = text
            down['unmodifiedText'] = text
        self.send('Input.dispatchKeyEvent', **down)
        self.send('Input.dispatchKeyEvent', type='keyUp', key=key, code=code, windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk)
        self.ev('new Promise(function (r) { setTimeout(function () { r(true); }, 60); })')


# Page-side helpers, installed once: click counters on the controls under test
# (capture listeners on the element itself, so they count the click whatever
# the app's own handlers do with it) and a reset between checks.
SETUP = r'''(function () {
  window.__clicks = {};
  ['sbCustomColsSave', 'saveQuery', 'sbPivotOpenBuilder', 'sbColsSettings'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () { window.__clicks[id] = (window.__clicks[id] || 0) + 1; }, true);
  });
  // Save itself would open the save dialog this page does not have.
  $('#saveQuery').off('click');
  window.__state = function () {
    var a = document.activeElement;
    return { panel: __drv.panelOpen(), clicks: JSON.parse(JSON.stringify(window.__clicks)), focus: a ? (a.id || a.className || a.tagName) : 'none',
             cc: __drv.colsCard('sb-cc-open', 'sbCustomColsPop'), pp: __drv.colsCard('sb-pp-open', 'sbPivotPop'),
             grp: __drv.colsCard('sb-grp-open', 'sbGroupPop'), snap: __drv.colsCard('sb-snap-open', 'sbSnapshotPop'),
             cl: __drv.colsCard('sb-cl-open', 'sbColsPop'),
             data: __drv.segCard('sbDataSeg', 'sbDataPop'), docEsc: window.__docEsc };
  };
  return true;
})()'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--port', type=int, default=0)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    if not a.port:
        # A port nobody holds right now: other sessions' suites run their own
        # headless Edge, and a fixed port could hand this run THEIR page.
        s = socket.socket()
        s.bind(('127.0.0.1', 0))
        a.port = s.getsockname()[1]
        s.close()

    prof = os.path.join(tempfile.gettempdir(), 'pnbedge_sbk_' + uuid.uuid4().hex[:8])
    url = 'file:///' + a.dir.replace('\\', '/') + '/harness.html?real=1'
    proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                             '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                             '--user-data-dir=' + prof, '--window-size=1400,1000',
                             '--remote-debugging-port=%d' % a.port, '--remote-allow-origins=*', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    results = []

    def rec(name, ok, detail=''):
        results.append({'name': name, 'pass': bool(ok), 'detail': str(detail)[:600]})
        if not a.json:
            print(('  PASS  ' if ok else '  FAIL  ') + name + '  [' + str(detail) + ']')

    try:
        ws_url = None
        for _ in range(80):
            try:
                pages = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json' % a.port, timeout=2).read())
                # Org policy opens extension/welcome targets too - take OUR blank page.
                for p in pages:
                    if p.get('type') == 'page' and p.get('url', '').startswith('about:blank'):
                        ws_url = p['webSocketDebuggerUrl']
                if ws_url:
                    break
            except Exception:
                pass
            time.sleep(0.25)
        if not ws_url:
            raise RuntimeError('no CDP page target')
        c = Cdp(ws_url)
        c.send('Page.enable')
        c.send('Runtime.enable')
        c.send('Network.enable')
        c.send('Network.setCacheDisabled', cacheDisabled=True)
        c.send('Page.navigate', url=url)
        for _ in range(240):
            time.sleep(0.25)
            try:
                if c.ev('!!(window.__drv && document.getElementById("out").textContent === "READY")'):
                    break
            except Exception:
                pass
        else:
            raise RuntimeError('harness never reached READY: ' + str(c.ev('document.getElementById("out").textContent')))
        c.ev(SETUP)
        st = lambda: c.ev('__state()')

        def reset():
            c.ev('__drv.closeAll(); __drv.forceChips(); true')

        # ---- R1 / R2: Save my customizations... -------------------------------
        reset()
        c.ev('$("#sbCustomCols").trigger("click"); document.getElementById("sbCustomColsSave").focus(); true')
        s0 = st()
        c.press('Enter')
        s1 = st()
        rec('R1 a REAL Enter on "Save my customizations..." clicks it and reaches Save; the Settings panel stays shut',
            s0['cc'] and s0['focus'] == 'sbCustomColsSave' and s1['clicks'].get('sbCustomColsSave') == 1 and s1['clicks'].get('saveQuery') == 1 and not s1['panel'],
            'before=%s after=%s' % (json.dumps(s0), json.dumps(s1)))
        reset()
        c.ev('$("#sbCustomCols").trigger("click"); document.getElementById("sbCustomColsSave").focus(); true')
        c.press('Space')
        s2 = st()
        rec('R2 a REAL Space on it does the same',
            s2['clicks'].get('sbCustomColsSave') == 2 and s2['clicks'].get('saveQuery') == 2 and not s2['panel'], json.dumps(s2))

        # ---- R3: Open the pivot builder... ------------------------------------
        reset()
        c.ev('$("#sbColsSeg").addClass("sb-pp-open"); document.getElementById("sbPivotOpenBuilder").focus(); true')
        c.press('Enter')
        s3a = st()
        reset()
        c.ev('$("#sbColsSeg").addClass("sb-pp-open"); document.getElementById("sbPivotOpenBuilder").focus(); true')
        c.press('Space')
        s3b = st()
        rec('R3 a REAL Enter and a REAL Space on "Open the pivot builder..." each click it; the panel stays shut',
            s3a['clicks'].get('sbPivotOpenBuilder') == 1 and not s3a['panel'] and s3b['clicks'].get('sbPivotOpenBuilder') == 2 and not s3b['panel'],
            'Enter=%s Space=%s' % (json.dumps(s3a), json.dumps(s3b)))

        # ---- R4: a grouping card's sort button --------------------------------
        reset()
        c.ev('$(".sb-grp-sort").removeClass("sb-grp-sort-on"); $("#sbGroup").trigger("click"); document.querySelector(".sb-grp-sort[data-sort=count][data-dir=desc]").focus(); true')
        c.press('Enter')
        on = c.ev('document.querySelector(".sb-grp-sort[data-sort=count][data-dir=desc]").classList.contains("sb-grp-sort-on")')
        s4 = st()
        rec('R4 a REAL Enter on "Most items" in the grouping card presses it; the panel stays shut', on and not s4['panel'], 'pressed=%s %s' % (on, json.dumps(s4)))

        # ---- R5: the custom-layout chip ---------------------------------------
        reset()
        c.ev('document.getElementById("sbCustomCols").focus(); true')
        c.press('Enter')
        s5 = st()
        rec('R5 a REAL Enter on the custom-layout chip opens its card and not the panel', s5['cc'] and not s5['panel'], json.dumps(s5))

        # ---- R6: the Cols count opens its Columns card; the card's button the panel
        reset()
        c.ev('document.getElementById("sbColsOpen").focus(); true')
        c.press('Enter')
        s6a = st()
        c.ev('document.getElementById("sbColsSettings").focus(); true')
        c.press('Enter')
        s6b = st()
        c.ev('$("#settingsPanel").removeClass("is-open"); $("#settingsPanelOverlay").removeClass("is-open"); true')
        rec('R6 a REAL Enter on the Cols count opens its Columns card, not the panel; a REAL Enter on the card\'s "Open the Column & Settings panel..." clicks it and opens the panel, the card shut',
            s6a['cl'] and not s6a['panel'] and s6b['clicks'].get('sbColsSettings') == 1 and s6b['panel'] and not s6b['cl'],
            'count=%s button=%s' % (json.dumps(s6a), json.dumps(s6b)))

        # ---- R7: Escape in the pivot card ---------------------------------------
        reset()
        c.ev('$("#sbColsSeg").addClass("sb-pp-open"); document.getElementById("sbPivotOpenBuilder").focus(); true')
        e0 = st()
        c.press('Escape')
        s7 = st()
        rec('R7 a REAL Escape on a button in the pivot card closes the card, puts focus on the pivot chip, and never reaches the document',
            e0['pp'] and not s7['pp'] and s7['focus'] == 'sbPivot' and s7['docEsc'] == e0['docEsc'], 'before=%s after=%s' % (json.dumps(e0), json.dumps(s7)))

        # ---- R8: Escape in the Data popover ---------------------------------------
        reset()
        c.ev('document.getElementById("sbDataSeg").focus(); true')
        c.press('Enter')
        d0 = st()
        c.press('Escape')
        s8 = st()
        rec('R8 a REAL Enter opens the Data popover and a REAL Escape closes it again, focus on its segment, nothing below hearing it',
            d0['data'] and not s8['data'] and s8['focus'] == 'sbDataSeg' and s8['docEsc'] == d0['docEsc'], 'open=%s closed=%s' % (json.dumps(d0), json.dumps(s8)))

        # ---- R9: the snapshot chip ---------------------------------------------------
        reset()
        c.ev('document.getElementById("sbSnapshot").focus(); true')
        c.press('Enter')
        s9 = st()
        rec('R9 a REAL Enter on the snapshot chip opens its card and not the panel', s9['snap'] and not s9['panel'], json.dumps(s9))

        errs = c.ev('JSON.stringify((window.__errors || []).concat(window.__rejections || []).slice(0, 5))')
        rec('R10 no page errors along the way', errs == '[]', errs)
    except Exception as e:  # noqa
        rec('R0 the real-keys run got to the end', False, repr(e)[:400])
    finally:
        try:
            proc.kill()
        except Exception:
            pass
        # Edge leaves children on the throw-away profile; take ONLY those down.
        subprocess.run(['powershell', '-NoProfile', '-Command',
                        "Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % os.path.basename(prof)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if a.json:
        print('REAL_JSON:' + json.dumps(results))
    else:
        ok = bool(results) and all(r['pass'] for r in results)
        print('SUMMARY real pass=%d fail=%d' % (sum(1 for r in results if r['pass']), sum(1 for r in results if not r['pass'])))
        print('RESULT: GREEN' if ok else 'RESULT: RED')


if __name__ == '__main__':
    main()
