"""Pop-out tooltip hosting - REAL input half (2026-09-25).

    py -3 real_input.py <staged run dir> [<shots dir>]
    (run.ps1 -Real passes the dir it staged)

The browser half dispatches synthetic events. This drives the same harness
(harness.html?real=1) in headless Edge over CDP with REAL input and a real
clock (real show delays, real fades): a real click on "Open in Window" - its
user activation is what lets window.open() through, so there is NO
--disable-popup-blocking here - then real pointer input INSIDE the console
window, which is a page target of its own, and a real click on "Return to Tab".
  X1  a real click on "Open in Window" opens the console window
  X2  a real hover on a Custom Code Shortcuts helper opens its tooltip IN the console window
  X3  a real hover on a Custom Code Functions helper: the same
  X4  a real hover on a function underline in the Custom Code tab: the same
  X5  a real hover on the scheduler cron help: the same
  X6  a real click on a titled console button focuses it; its title tooltip opens in the console window
  X7  a real click on "Return to Tab", then a real hover on the same Shortcuts helper: the tooltip opens in the tab
Screenshots (the console window and the tab while the X2 tooltip is up) go to
<shots dir> when given. Exits 0 when every check passes.
Needs `py -3 -m pip install websocket-client`.
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
SHOTS = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else ''
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9341
prof = tempfile.mkdtemp(prefix='pnbedge_tthr_')
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                         '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
                         '--user-data-dir=' + prof, '--window-size=1800,1000', '--remote-debugging-port=%d' % PORT,
                         '--remote-allow-origins=*', 'about:blank'])


def targets():
    try:
        return json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % PORT, timeout=2))
    except Exception:
        return []


class Conn:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=60)
        self.n = 0

    def call(self, method, **params):
        self.n += 1
        my = self.n
        self.ws.send(json.dumps({'id': my, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == my:
                if 'error' in m:
                    raise RuntimeError(m['error'])
                return m.get('result', {})

    def ev(self, expr, await_promise=False):
        r = self.call('Runtime.evaluate', expression=expr, awaitPromise=await_promise, returnByValue=True)
        if 'exceptionDetails' in r:
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:600])
        return r['result'].get('value')

    def move(self, x, y):
        self.call('Input.dispatchMouseEvent', type='mouseMoved', x=x, y=y, button='none', buttons=0)

    def click(self, x, y):
        self.move(x, y)
        time.sleep(0.05)
        self.call('Input.dispatchMouseEvent', type='mousePressed', x=x, y=y, button='left', buttons=1, clickCount=1)
        time.sleep(0.05)
        self.call('Input.dispatchMouseEvent', type='mouseReleased', x=x, y=y, button='left', buttons=0, clickCount=1)

    def shot(self, path):
        data = self.call('Page.captureScreenshot', format='png')['data']
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data))


results = []


def rec(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:600]))


def fmt(t):
    if not t or t.get('missing'):
        return 'target missing'
    return '%s, %s, described-by %s, rect %s in %s, live region: %s, "%s"' % (
        t.get('where'), 'visible' if t.get('visible') else 'NOT visible', 'ok' if t.get('descOk') else 'BROKEN',
        t.get('rect'), t.get('view'), t.get('live'), t.get('text', '')[:40])


main = pop = None
try:
    ws_url = None
    for _ in range(60):
        pages = [t for t in targets() if t.get('type') == 'page' and t.get('url', '').startswith('about:blank')]
        if pages:
            ws_url = pages[0]['webSocketDebuggerUrl']
            main_id = pages[0]['id']
            break
        time.sleep(0.5)
    if not ws_url:
        raise RuntimeError('no CDP page target')
    main = Conn(ws_url)
    main.call('Page.enable')
    main.call('Page.navigate', url='file:///' + RUN.replace('\\', '/') + '/harness.html?real=1')
    for _ in range(150):
        try:
            if main.ev("document.readyState === 'complete' && document.getElementById('out').textContent === 'READY'"):
                break
        except Exception:
            pass
        time.sleep(0.2)
    else:
        raise RuntimeError('harness never reported READY')
    SHORTCUT = "#snipHelperList .snip-group[data-group=\\'shortcuts\\'] .snip-ico[data-card]"
    FUNCTION = "#snipHelperList .snip-group[data-group=\\'functions\\'] .snip-ico[data-card]"
    UNDERLINE = "#report-options-tab .CodeMirror .cm-function-underline[data-fn=\\'sum\\']"

    def real_click(sel):
        # A real click on the element, in whichever window it lives in right now.
        c = main.ev("__drv.center('%s')" % sel)
        if not c:
            raise RuntimeError('nothing to click: ' + sel)
        (pop if c['where'] == 'console window' else main).click(c['x'], c['y'])
        return c

    def wait_shown(sel, secs=6.0):
        for _ in range(int(secs / 0.1)):
            c = main.ev("__drv.center('%s')" % sel)
            if c and c['x'] > 0 and c['y'] > 0:
                return True
            time.sleep(0.1)
        return False

    # Custom Code through a REAL click on its tab: the first reveal loads and mounts the helper panel.
    real_click("#editorTabs a[href=\\'#report-options-tab\\']")
    if not (wait_shown(SHORTCUT) and wait_shown(UNDERLINE)):
        raise RuntimeError('the Custom Code helper panel / function underlines never appeared')
    time.sleep(0.4)

    # X1 - a REAL click on "Open in Window"; its user activation lets window.open() through.
    c = main.ev("__drv.center('#popOutWindowBtn')")
    main.click(c['x'], c['y'])
    pop_url = None
    for _ in range(60):
        cand = [t for t in targets() if t.get('type') == 'page' and t.get('id') != main_id and 'Admin Console' in t.get('title', '')]
        if cand:
            pop_url = cand[0]['webSocketDebuggerUrl']
            break
        time.sleep(0.25)
    popped = bool(main.ev("__drv.popped()"))
    rec('X1 a real click on "Open in Window" opened the console window (a page target of its own)', bool(pop_url) and popped,
        'console window target %s, _admPip.active=%s' % ('found' if pop_url else 'NOT found', popped))
    if not (pop_url and popped):
        raise RuntimeError('no console window')
    pop = Conn(pop_url)
    pop.call('Page.enable')
    # A window that is not the OS-focused one gets no focus events in headless; emulate it (X6).
    pop.call('Emulation.setFocusEmulationEnabled', enabled=True)
    time.sleep(0.5)

    def park():
        # Bottom-right corner of the console window: over the console, over no tooltip target.
        v = pop.ev("[innerWidth, innerHeight]")
        pop.move(v[0] - 4, v[1] - 4)
        time.sleep(0.5)

    def hover_in_console(label, sel, host, shots=None):
        c = main.ev("__drv.center('%s')" % sel)
        if not c or c.get('where') != 'console window':
            rec(label, False, 'target not in the console window: %s' % c)
            return
        pop.move(c['x'], c['y'])
        t = None
        for _ in range(40):                      # the real 100-600 ms show delay + fade
            time.sleep(0.05)
            t = main.ev("__drv.tip('%s', '%s')" % (sel, host))
            if t and t.get('visible'):
                break
        time.sleep(0.25)                         # let the fade finish before any screenshot
        t = main.ev("__drv.tip('%s', '%s')" % (sel, host))
        in_tab = main.ev("__drv.tabTooltips()")
        if shots and SHOTS:
            pop.shot(os.path.join(SHOTS, shots + '_console_window.png'))
            main.shot(os.path.join(SHOTS, shots + '_tab.png'))
        rec(label, t and t.get('where') == 'console window' and t.get('visible') and t.get('descOk') and in_tab == 0,
            fmt(t) + '; .ui-tooltip in the tab: %s' % in_tab)
        park()

    # (2026-10-22, fnpop) the Custom Code helpers and the function underlines open a CARD - the
    # lazy module's popover (#snipCardPop) - not a jQuery UI tooltip. Real pointer, real timers.
    def card_in(conn, label, sel, want, shots=None, link=None, pop_sel='#snipCardPop'):
        c = main.ev("__drv.center('%s')" % sel)
        if not c or c.get('where') != want:
            rec(label, False, 'target not in the %s: %s' % (want, c))
            return
        conn.move(c['x'] - 2, c['y'])
        time.sleep(0.05)
        conn.move(c['x'], c['y'])
        k = None
        for _ in range(40):                      # the 250 / 350 ms hover delay + the fade
            time.sleep(0.05)
            k = main.ev("__drv.card('%s')" % pop_sel)
            if k and k.get('visible'):
                break
        time.sleep(0.25)
        k = main.ev("__drv.card('%s')" % pop_sel)
        if shots and SHOTS:
            conn.shot(os.path.join(SHOTS, shots + '.png'))
        rec(label, bool(k and k.get('where') == want and k.get('visible') and k.get('inside') and (link is None or k.get('anchor') == link)),
            '%s' % k)

    park()
    card_in(pop, 'X2 a real hover on a Custom Code Shortcuts helper opens its card IN the console window',
            SHORTCUT, 'console window', 'x2_shortcuts')
    park()
    card_in(pop, 'X3 a real hover on a Custom Code Functions helper opens its card IN the console window',
            FUNCTION, 'console window')
    park()
    card_in(pop, 'X4 a real hover on a function underline in the snippet editor opens its card IN the console window, linked to sum',
            UNDERLINE, 'console window', 'x4_underline', link='sum')
    park()

    # X6 - a real click focuses a titled console button; the tooltip rides the forwarded focusin.
    c = main.ev("__drv.center('#tthConsoleBtn')")
    pop.click(c['x'], c['y'])
    park()                                       # pointer off it: only FOCUS can explain a tooltip now
    t = None
    for _ in range(40):
        time.sleep(0.05)
        t = main.ev("__drv.tip('#tthConsoleBtn', 'document')")
        if t and t.get('visible'):
            break
    focused = pop.ev("document.activeElement && document.activeElement.id")
    rec('X6 a real click on a titled console button focuses it and its title tooltip opens IN the console window',
        focused == 'tthConsoleBtn' and t and t.get('where') == 'console window' and t.get('visible'),
        'focused: %s; %s' % (focused, fmt(t)))
    pop.ev("document.activeElement && document.activeElement.blur && document.activeElement.blur(); true")
    time.sleep(0.4)

    # X5 - the Scheduler tab by a REAL click inside the console window, then the cron help.
    real_click("#editorTabs a[href=\\'#scheduler-tab\\']")
    wait_shown('#cronExprHelp')
    park()
    card_in(pop, 'X5 a real hover on the scheduler cron help opens its card IN the console window, linked to the cron help',
            '#cronExprHelp', 'console window', 'x5_cron', link='schedHelp-cron', pop_sel='#pnbHoverCard')
    park()
    real_click("#editorTabs a[href=\\'#report-options-tab\\']")
    wait_shown(SHORTCUT)
    time.sleep(0.3)

    # X7 - a real click on "Return to Tab", then a real hover in the tab.
    c = main.ev("__drv.center('#popOutWindowBtn')")
    pop.click(c['x'], c['y'])
    for _ in range(40):
        time.sleep(0.1)
        if not main.ev("__drv.popped()"):
            break
    time.sleep(0.6)
    back = main.ev("!__drv.popped() && !!document.getElementById('admWrapper')")
    if back:
        card_in(main, 'X7 a real click on "Return to Tab", then a real hover on a function underline: its card opens in the tab',
                UNDERLINE, 'tab', 'x7_tab', link='sum')
    else:
        rec('X7 a real click on "Return to Tab"', False, 'console NOT home')
    errs = main.ev("__drv.errors()") or []
    if errs:
        print('  page errors: ' + ' | '.join(str(e) for e in errs[:6]))
except Exception as e:
    rec('X0 the real-input run completed', False, repr(e))
finally:
    for cn in (pop, main):
        try:
            cn.ws.close()
        except Exception:
            pass
    edge.kill()
    subprocess.run(['powershell', '-NoProfile', '-Command',
                    "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } | "
                    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % os.path.basename(prof)],
                   capture_output=True)

ok = all(r[1] for r in results) and len(results) > 0
for name, passed, detail in results:
    print('  %s  %s  [%s]' % ('PASS' if passed else 'FAIL', name, detail))
print('SUMMARY real pass=%d fail=%d' % (sum(1 for r in results if r[1]), sum(1 for r in results if not r[1])))
print('RESULT: GREEN' if ok else 'RESULT: RED')
sys.exit(0 if ok else 1)
