# Flat-table frozen columns - the REAL-FRAMES half (2026-09-18).
#
# run.ps1's browser half runs under --dump-dom, which renders no frames: it has
# to stub ResizeObserver and rAF, so it can prove WHAT is observed but not that
# the observer's callback fires. This drives the same staged page (harness.html
# ?frames=1 - no stubs) in headless Edge over CDP, where frames are real:
#
#   F1  a frozen column gets wider (longer cell text, nothing calls apply()):
#       the ResizeObserver re-writes the next column's `left` to match
#   F2  the wrapper gets narrow: the width guard pauses the freeze, and resumes
#       it when the wrapper is wide again - again with no call from anywhere
#   F3  a real mouse hover: the row highlight still reaches the frozen cells
#   F4  a real wheel-less horizontal scroll: frozen cells hold position over
#       ten frames while the rest of the row moves
#   F6  (2026-10-01) the status bar's frozen-columns chip reads "2 frozen", then
#       "2 frozen · paused" and back, through F2's resize alone
#   F7  (2026-10-01) a breakdown table's frozen offsets follow a column that grows,
#       through main.js's own ResizeObserver
#   + screenshots (--shots DIR): default theme and dark-blue, scrolled sideways
#
#   py -3 frames_check.py --dir <staged run dir from run.ps1 -Keep> [--shots DIR] [--port 9347]
#
# Needs: pip install websocket-client. Prints PASS/FAIL lines and RESULT: GREEN/RED.
import argparse, base64, json, os, subprocess, sys, tempfile, time, urllib.request, uuid

import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'


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


FRAMES = 'new Promise(function (r) { var n = %d; (function t() { if (n-- <= 0) return r(true); requestAnimationFrame(t); })(); })'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--shots', default='')
    ap.add_argument('--port', type=int, default=9347)
    a = ap.parse_args()

    prof = os.path.join(tempfile.gettempdir(), 'pnbedge_ff_' + uuid.uuid4().hex[:8])
    url = 'file:///' + a.dir.replace('\\', '/') + '/harness.html?frames=1'
    proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                             '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                             '--user-data-dir=' + prof, '--window-size=1400,1000',
                             '--remote-debugging-port=%d' % a.port, '--remote-allow-origins=*', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    results = []

    def rec(name, ok, detail=''):
        results.append(bool(ok))
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
        c.send('Page.navigate', url=url)
        for _ in range(240):
            time.sleep(0.25)
            if c.ev('!!(window.__drv && document.getElementById("out").textContent === "READY")'):
                break
        else:
            raise RuntimeError('harness never reached READY: ' + str(c.ev('document.getElementById("out").textContent')))
        if not c.ev('!!(window.Penumbra && window.Penumbra.flatFreeze)'):
            raise RuntimeError('window.Penumbra.flatFreeze is missing (pre-feature main.js?)')
        rec('F0 the page runs on the REAL ResizeObserver and rAF', c.ev('/native code/.test(String(window.ResizeObserver)) && /native code/.test(String(window.requestAnimationFrame))'))

        c.ev('__drv.runQuery(__drv.makeRows(30)).then(function () { return true; })')
        c.ev('Penumbra.flatFreeze.set(0, 2); __drv.wrap().scrollIntoView(); true')
        c.ev(FRAMES % 3)

        # ---- F1: the frozen '#' column widens; nothing calls apply() --------
        before = c.ev('(function () { var t = __drv.ths(); return { left: parseFloat(getComputedStyle(t[1]).left), w0: t[0].getBoundingClientRect().width }; })()')
        c.ev('__drv.cell(0, 1).textContent = "1234567890123456"; true')
        c.ev(FRAMES % 4)
        after = c.ev('(function () { var t = __drv.ths(); return { left: parseFloat(getComputedStyle(t[1]).left), w0: t[0].getBoundingClientRect().width, td: parseFloat(getComputedStyle(__drv.cell(3, 2)).left) }; })()')
        import math
        rec('F1 a frozen column grew and the ResizeObserver moved the next column\'s offset to match, header and body',
            after['w0'] > before['w0'] + 20 and after['left'] == math.floor(after['w0']) and after['td'] == after['left'] and after['left'] > before['left'],
            'w0 %.1f -> %.1f, left %s -> %s, body %s' % (before['w0'], after['w0'], before['left'], after['left'], after['td']))

        # ---- F2: the width guard, driven by the wrapper's own resize ---------
        # (chip = the status bar's frozen-columns chip, #sbFrozen, read for F6)
        CHIP = '(function () { var c = document.getElementById("sbFrozen"); return c ? { txt: c.textContent.trim(), off: c.classList.contains("sb-off"), shown: getComputedStyle(c).display !== "none" } : null; })()'
        chip0 = c.ev(CHIP)
        c.ev('__drv.wrap().style.width = "240px"; true')
        c.ev(FRAMES % 4)
        paused = c.ev('(function () { var s = Penumbra.flatFreeze.state(); return { paused: s.paused, css: s.css.length, pos: getComputedStyle(__drv.cell(0, 1)).position }; })()')
        chipP = c.ev(CHIP)
        c.ev('__drv.wrap().style.width = "900px"; true')
        c.ev(FRAMES % 4)
        resumed = c.ev('(function () { var s = Penumbra.flatFreeze.state(); return { paused: s.paused, pos: getComputedStyle(__drv.cell(0, 1)).position }; })()')
        chipR = c.ev(CHIP)
        rec('F2 narrowing the wrapper pauses the freeze and widening it resumes - with no call from anywhere',
            paused['paused'] is True and paused['css'] == 0 and paused['pos'] == 'static' and resumed['paused'] is False and resumed['pos'] == 'sticky',
            json.dumps(paused) + ' -> ' + json.dumps(resumed))
        # ---- F6 (2026-10-01): the status bar chip follows the same resize -----
        rec('F6 the status bar\'s frozen-columns chip follows the pause and the resume through the real ResizeObserver alone',
            bool(chip0) and chip0['shown'] and chip0['txt'] == '2 frozen' and not chip0['off'] and
            chipP['txt'] == '2 frozen · paused' and chipP['off'] and chipR['txt'] == '2 frozen' and not chipR['off'],
            json.dumps(chip0) + ' -> ' + json.dumps(chipP) + ' -> ' + json.dumps(chipR))

        # ---- F7 (2026-10-01): a breakdown's frozen offsets follow a width change
        # through main.js's own ResizeObserver - a column width (a session width
        # from js/penumbra_colwidths.js, or new content) and nothing calls back.
        if c.ev('!!(window.__FF && window.__FF.chartDrill && Penumbra.flatFreeze.breakdown)'):
            c.ev('Penumbra.flatFreeze.set(0, 3); window.__FF.chartDrill(__drv.makeRows(20).map(function (o) { return new Map(Object.entries(o)); }), ["C11 = x"], [], null); true')
            c.ev(FRAMES % 4)
            BDL = ('(function () { var t = document.querySelector("table.pnb-breakdown"), h = t.tHead.rows[0].cells;'
                   ' return { w1: h[1].getBoundingClientRect().width, left2: parseFloat(getComputedStyle(h[2]).left), pos2: getComputedStyle(h[2]).position }; })()')
            b0 = c.ev(BDL)
            c.ev('(function () { var s = document.createElement("style"); s.id = "f7wide"; s.textContent = "table.pnb-breakdown > * > tr > :nth-child(2){min-width:300px!important}"; document.head.appendChild(s); return true; })()')
            c.ev(FRAMES % 4)
            b1 = c.ev(BDL)
            c.ev('document.getElementById("f7wide").remove(); $(".infobox-overlay").remove(); Penumbra.flatFreeze.set(0, 2); true')
            c.ev(FRAMES % 2)
            rec('F7 a frozen breakdown column grew and the column after it moved its sticky offset to match - the real ResizeObserver alone',
                b0['pos2'] == 'sticky' and b1['w1'] >= 299 and b1['left2'] > b0['left2'] + 50 and abs(b1['left2'] - (b0['left2'] + (b1['w1'] - b0['w1']))) <= 1.5,
                json.dumps(b0) + ' -> ' + json.dumps(b1))
        else:
            rec('F7 a frozen breakdown column follows a width change', False, 'this build has no breakdown freeze or the chart-drill hook is missing')

        # ---- F3: a real hover --------------------------------------------------
        c.ev('__drv.wrap().scrollLeft = 300; true')
        c.ev(FRAMES % 3)
        pt = c.ev('(function () { var r = __drv.cell(4, 2).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()')
        c.send('Input.dispatchMouseEvent', type='mouseMoved', x=pt['x'], y=pt['y'])
        c.ev(FRAMES % 3)
        hov = c.ev('(function () { var row = __drv.cell(4, 1).parentNode; var cs = function (i) { return getComputedStyle(__drv.cell(4, i)).backgroundColor; };'
                   ' return { hovered: row.matches(":hover"), frozen1: cs(1), frozen2: cs(2), plain: cs(7), other: getComputedStyle(__drv.cell(6, 1)).backgroundColor }; })()')
        rec('F3 a real hover: the row highlight reaches the frozen cells too (same colour as the rest of the row)',
            hov['hovered'] and hov['frozen1'] == hov['plain'] and hov['frozen2'] == hov['plain'] and hov['frozen1'] != hov['other'], json.dumps(hov))
        c.send('Input.dispatchMouseEvent', type='mouseMoved', x=5, y=5)

        # ---- F4: frame by frame while scrolling --------------------------------
        track = c.ev('(function () { var w = __drv.wrap(), out = []; w.scrollLeft = 0;'
                     ' return new Promise(function (res) { var i = 0; (function step() {'
                     '   var wl = w.getBoundingClientRect().left + w.clientLeft;'
                     '   out.push([w.scrollLeft, Math.round((__drv.cell(2, 1).getBoundingClientRect().left - wl) * 10) / 10, Math.round((__drv.cell(2, 6).getBoundingClientRect().left - wl) * 10) / 10]);'
                     '   if (++i > 10) return res(out); w.scrollLeft = i * 40; requestAnimationFrame(step); })(); }); })()')
        stuck = all(abs(t[1]) <= 1.5 for t in track[2:])
        moved = track[-1][2] < track[1][2] - 300
        rec('F4 over ten real frames of sideways scrolling the frozen cell never leaves the edge while column 6 travels', stuck and moved,
            'frozen offsets=' + str([t[1] for t in track]) + ' col6=' + str([t[2] for t in track][::5]))

        # ---- screenshots -------------------------------------------------------
        if a.shots:
            os.makedirs(a.shots, exist_ok=True)
            c.ev('Penumbra.flatFreeze.set(0, 3); __drv.wrap().scrollLeft = 260; __drv.wrap().scrollIntoView(); true')
            for name, cls in (('default', ''), ('dark-blue', 'theme-dark-blue is-dark')):
                c.ev('document.body.className = %s; true' % json.dumps(cls))
                c.ev(FRAMES % 4)
                # The clip is in DOCUMENT coordinates; the rect is in viewport ones.
                box = c.ev('(function () { var r = __drv.wrap().getBoundingClientRect(); return { x: r.left + window.scrollX - 8, y: r.top + window.scrollY - 8, width: r.width + 16, height: Math.min(r.height, 300) + 16 }; })()')
                shot = c.send('Page.captureScreenshot', format='png', captureBeyondViewport=True,
                              clip={'x': box['x'], 'y': box['y'], 'width': box['width'], 'height': box['height'], 'scale': 1})
                path = os.path.join(a.shots, 'flatfreeze_%s.png' % name)
                with open(path, 'wb') as f:
                    f.write(base64.b64decode(shot['data']))
                print('  shot  ' + path)
        errs = c.ev('JSON.stringify((window.__errors || []).concat(window.__rejections || []).slice(0, 5))')
        rec('F5 no page errors along the way', errs == '[]', errs)
    except Exception as e:  # noqa
        rec('frames check ran to the end', False, repr(e)[:400])
    finally:
        try:
            proc.kill()
        except Exception:
            pass
        # Edge leaves children on the throw-away profile; take ONLY those down.
        subprocess.run(['powershell', '-NoProfile', '-Command',
                        "Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % os.path.basename(prof)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ok = bool(results) and all(results)
    print('SUMMARY frames pass=%d fail=%d' % (sum(results), len(results) - sum(results)))
    print('RESULT: GREEN' if ok else 'RESULT: RED')


if __name__ == '__main__':
    main()
