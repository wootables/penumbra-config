# cellsel round 3 (2026-10-09): REAL input (CDP Input.dispatchMouseEvent / dispatchKeyEvent), which the
# synthetic events in driver.js cannot prove: a real press focuses the cell, a real ArrowDown then moves
# it (and scrolls nothing), Shift+arrows select, a real drag selects, and with no cell focused ArrowDown
# scrolls the page as ever. Runs on the NEWEST %TEMP%\pnb_cs_* stage: run run.py (any scenario) first.
#   py -3 real_input.py      -> prints a JSON of booleans (all must be true)
import json, os, glob, subprocess, socket, sys, time, urllib.request, websocket
stage = sorted(glob.glob(os.path.join(os.environ['TEMP'], 'pnb_cs_*')), key=os.path.getmtime)[-1]
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
def fp():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = fp(), fp()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.path.join(stage, 'p3'), '--window-size=1400,800',
    '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
    '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'): return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(100):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)
out = {}
try:
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]; ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(x):
        r = call('Runtime.evaluate', {'expression': x, 'returnByValue': True, 'awaitPromise': True})
        return r.get('result', {}).get('value')
    call('Emulation.setFocusEmulationEnabled', {'enabled': True})
    call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=boot' % hp})
    for _ in range(600):
        time.sleep(0.25)
        if ev('window.__HCDONE ? 1 : 0'): break
    helper = """
      window.__cell = function (r, n) { var rows = [].filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (t) { return t.style.display !== 'none' && !t.classList.contains('search-hidden'); });
        var id = document.querySelector('#tableHeader th[data-colname="' + n + '"]').getAttribute('data-column'); return rows[r].querySelector('td[data-column="' + id + '"]'); };
      window.__pt = function (r, n) { var c = __cell(r, n); c.scrollIntoView({block: 'center'}); var b = c.getBoundingClientRect(); return [b.left + 8, b.top + b.height / 2]; };
      1"""
    ev(helper)
    def mouse(kind, x, y, buttons=0):
        call('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'left' if kind != 'mouseMoved' else ('left' if buttons else 'none'), 'buttons': buttons, 'clickCount': 1})
    def keyp(k, code, vk, mods=0):
        call('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'modifiers': mods})
        call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'modifiers': mods})
    # 1. nothing clicked: ArrowDown scrolls the page as ever
    ev('window.scrollTo(0, 0); 1'); time.sleep(0.2)
    y0 = ev('scrollY'); keyp('ArrowDown', 'ArrowDown', 40); time.sleep(0.4); y1 = ev('scrollY')
    out['unfocusedArrowScrolls'] = (y1 or 0) > (y0 or 0)
    # 2. a real click on a cell focuses it; ArrowDown moves the active cell
    x, y = ev('__pt(3, "V_NAME")')
    mouse('mousePressed', x, y, 1); mouse('mouseReleased', x, y, 0); time.sleep(0.2)
    out['clickFocusesCell'] = ev('document.activeElement === __cell(3, "V_NAME")')
    out['noRingAfterClick'] = ev('!document.body.classList.contains("pnb-csel-kb")')
    keyp('ArrowDown', 'ArrowDown', 40); time.sleep(0.2)
    out['arrowMovesCell'] = ev('document.activeElement === __cell(4, "V_NAME")')
    out['ringAfterKey'] = ev('getComputedStyle(document.activeElement).outlineStyle === "solid"')
    keyp('ArrowDown', 'ArrowDown', 40, 8); keyp('ArrowRight', 'ArrowRight', 39, 8); time.sleep(0.2)   # Shift (modifier 8)
    out['shiftArrowsSelect'] = ev('Penumbra.cellSel.count() === 4')
    out['readout'] = ev('(document.getElementById("pnbCellSelReadout") || {}).textContent || ""')
    # 3. a real drag
    ax, ay = ev('__pt(10, "V_AMOUNT")')
    bx, by = ev('(function(){ var c = __cell(12, "V_AMOUNT"); var b = c.getBoundingClientRect(); return [b.left + 8, b.top + b.height / 2]; })()')
    ax, ay = ev('(function(){ var c = __cell(10, "V_AMOUNT"); var b = c.getBoundingClientRect(); return [b.left + 8, b.top + b.height / 2]; })()')
    mouse('mousePressed', ax, ay, 1); mouse('mouseMoved', (ax + bx) / 2, (ay + by) / 2, 1); mouse('mouseMoved', bx, by, 1); mouse('mouseReleased', bx, by, 0); time.sleep(0.2)
    out['realDrag3'] = ev('Penumbra.cellSel.count() === 3')
    out['nativeSelEmpty'] = ev('String(getSelection()).trim() === ""')
    # 4. click outside the table: arrows scroll again
    mouse('mousePressed', 5, 5, 1); mouse('mouseReleased', 5, 5, 0); time.sleep(0.2)
    ev('window.scrollTo(0, 0); 1'); time.sleep(0.2)
    y0 = ev('scrollY'); keyp('ArrowDown', 'ArrowDown', 40); time.sleep(0.4); y1 = ev('scrollY')
    out['afterOutsideArrowScrolls'] = (y1 or 0) > (y0 or 0) and ev('Penumbra.cellSel.count() === 0')
    out['dbg'] = {'y0': y0, 'y1': y1, 'max': ev('document.documentElement.scrollHeight - innerHeight'), 'count': ev('Penumbra.cellSel.count()'),
                  'ae': ev('(document.activeElement.id || document.activeElement.tagName) + "." + document.activeElement.className'),
                  'at55': ev('(function(){var e=document.elementFromPoint(5,5); return e ? (e.id||e.tagName)+"."+e.className : null})()'),
                  'wrap': ev('(function(){var w=document.getElementById("results-wrapper"); return w ? [w.scrollTop, w.scrollHeight, w.clientHeight] : null})()')}
    # 5. (round 4) auto-scroll: hold a drag at the bottom edge of the results box - the BOX scrolls
    #    (the flat table scrolls inside #results-wrapper, not the page) and the block grows with it
    ev('Penumbra.cellSel.clear(); var w = document.getElementById("results-wrapper"); w.scrollTop = 0; window.scrollTo(0, 0); 1'); time.sleep(0.3)
    sx, sy = ev('(function(){ var c = __cell(1, "V_AMOUNT"); var b = c.getBoundingClientRect(); return [b.left + 8, b.top + b.height / 2]; })()')
    wb = ev('(function(){ var w = document.getElementById("results-wrapper").getBoundingClientRect(); var sb = document.getElementById("pnbStatusBar").getBoundingClientRect(); return Math.min(w.bottom, sb.top) - 6; })()')
    mouse('mousePressed', sx, sy, 1); mouse('mouseMoved', sx, sy + 40, 1)
    for _ in range(25):
        mouse('mouseMoved', sx, wb, 1); time.sleep(0.06)
    st1 = ev('document.getElementById("results-wrapper").scrollTop'); n1 = ev('Penumbra.cellSel.count()')
    mouse('mouseReleased', sx, wb, 0); time.sleep(0.2)
    out['autoScrollsBox'] = (st1 or 0) > 40 and (n1 or 0) > 12
    out['autoScrollInfo'] = {'scrollTop': st1, 'count': n1}
    out['errors'] = ev('JSON.stringify(window.__errors)')
finally:
    edge.kill(); srv.kill()
print(json.dumps(out, indent=1))
