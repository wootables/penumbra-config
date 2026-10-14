"""Column widths - REAL input half (2026-09-24).

    py -3 real_input.py <staged run dir>     (run.ps1 -Real passes the dir it staged)

The browser half dispatches synthetic events, which cannot show what a real
browser does with the click that follows a drag (which element it lands on) or
with a real double-click. This drives the same harness (harness.html?real=1)
in headless Edge over CDP with Input.dispatchMouseEvent / dispatchKeyEvent -
real hit-testing, real rAF frames, the real ResizeObserver - and exits 0 when
every check passes. Needs `py -3 -m pip install websocket-client`.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9336
prof = tempfile.mkdtemp(prefix='pnbedge_cwr_')
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


def mouse(kind, x, y, buttons=0, clicks=1, ack=True):
    p = dict(type=kind, x=x, y=y, button='left' if kind != 'mouseMoved' or buttons else 'none',
             buttons=buttons, clickCount=clicks)
    if ack:
        call('Input.dispatchMouseEvent', **p)
        time.sleep(0.05)
    else:
        send('Input.dispatchMouseEvent', **p)


def key(k, code, vk, text=None, modifiers=0):
    p = dict(type='keyDown', key=k, code=code, windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk, modifiers=modifiers)
    if text:
        p['text'] = text
    call('Input.dispatchKeyEvent', **p)
    call('Input.dispatchKeyEvent', type='keyUp', key=k, code=code, windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk, modifiers=modifiers)
    time.sleep(0.1)


def drain(seconds):
    # Swallow the acks of fire-and-forget moves.
    end = time.time() + seconds
    ws.settimeout(0.2)
    while time.time() < end:
        try:
            ws.recv()
        except Exception:
            pass
    ws.settimeout(120)


results = []


def rec(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:400]))


def load():
    url = 'file:///' + RUN.replace('\\', '/') + '/harness.html?real=1&keepls=1'
    call('Page.navigate', url=url)
    for _ in range(100):
        try:
            if ev("document.readyState === 'complete' && document.getElementById('out').textContent === 'READY' && !!(window.Penumbra && window.Penumbra.colWidths && window.Penumbra.colWidths.state().host)"):
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def rect(expr):
    return ev('(function(){var r=(' + expr + ').getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width};})()')


try:
    call('Page.enable')
    call('Runtime.enable')
    ok = load()
    rec('X0 the harness loads with the module bound', ok)
    ev("localStorage.clear(); __CWH.setName('rreal'); __CWH.hydrate(); true")
    ev("__drv.runQuery(__drv.makeRows(20)).then(function(){return true;})", True)
    ev("document.getElementById('results-wrapper').scrollIntoView(); window.scrollBy(0, -60); true")
    time.sleep(0.3)
    TH = "__drv.thOf('TITLE')"
    r0 = rect(TH)
    w0 = r0['w']
    x, y = r0['r'] - 3, (r0['t'] + r0['b']) / 2

    hit = ev("(function(){var el=document.elementFromPoint(%f,%f);return el?(el.closest('th')===%s):false;})()" % (x, y, TH))
    cur = ev("getComputedStyle(%s,'::after').cursor" % TH)
    rec('X1 the right-edge strip is under the pointer and shows the col-resize cursor', hit and cur == 'col-resize', 'hit=%s cursor=%s' % (hit, cur))

    # A real drag, +100px.
    mouse('mouseMoved', x, y)
    mouse('mousePressed', x, y, buttons=1)
    for i in range(1, 11):
        mouse('mouseMoved', x + i * 10, y, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    mid = ev("({shield: !!document.querySelector('.pnb-colw-shield'), w: %s.getBoundingClientRect().width, label: (document.querySelector('.pnb-colw-label')||{}).textContent})" % TH)
    mouse('mouseReleased', x + 100, y)
    time.sleep(0.3)
    after = ev("({w: %s.getBoundingClientRect().width, sort: __drv.sortState('TITLE'), shield: !!document.querySelector('.pnb-colw-shield'), stored: __drv.entry('rreal')})" % TH)
    want = round(w0 + 100)
    rec('X2 mid-drag: the shield is up, the label reads the new width and the table has not moved',
        mid['shield'] and abs(mid['w'] - w0) < 0.6 and mid['label'] == '%d px' % want, json.dumps(mid))
    rec('X3 a REAL drag sets the width on release and the click that follows does NOT sort',
        abs(after['w'] - want) <= 1 and after['sort'] == 'none' and not after['shield'] and (after['stored'] or {}).get('widths', {}).get('TITLE') == want,
        json.dumps(after) + ' want %d' % want)

    # A real double-click on the (new) edge = fit to content.
    r1 = rect(TH)
    x1 = r1['r'] - 3
    time.sleep(0.6)
    mouse('mouseMoved', x1, y)
    mouse('mousePressed', x1, y, buttons=1, clicks=1)
    mouse('mouseReleased', x1, y, clicks=1)
    mouse('mousePressed', x1, y, buttons=1, clicks=2)
    mouse('mouseReleased', x1, y, clicks=2)
    time.sleep(0.3)
    fit = ev("({w: %s.getBoundingClientRect().width, sort: __drv.sortState('TITLE'), stored: __drv.entry('rreal')})" % TH)
    rec('X4 a REAL double-click on the edge fits the column to its content, and does not sort',
        abs(fit['w'] - w0) <= 1.5 and fit['sort'] == 'none' and not fit['stored'], json.dumps(fit))

    # A real click in the middle of the header still sorts.
    time.sleep(0.8)
    r2 = rect(TH)
    cx = (r2['l'] + r2['r']) / 2
    mouse('mouseMoved', cx, y)
    mouse('mousePressed', cx, y, buttons=1)
    mouse('mouseReleased', cx, y)
    time.sleep(0.3)
    s1 = ev("__drv.sortState('TITLE')")
    for _ in range(2):
        mouse('mousePressed', cx, y, buttons=1)
        mouse('mouseReleased', cx, y)
        time.sleep(0.2)
    s2 = ev("__drv.sortState('TITLE')")
    rec('X5 control: a REAL click in the middle of the header sorts, as before', s1 == 'ascending' and s2 == 'none', 'first=%s after3=%s' % (s1, s2))

    # Real keys on the focused header.
    ev("%s.focus(); true" % TH)
    wk = ev("%s.getBoundingClientRect().width" % TH)
    key('+', 'Equal', 187, text='+', modifiers=8)
    wp = ev("%s.getBoundingClientRect().width" % TH)
    key('0', 'Digit0', 48, text='0')
    wz = ev("%s.getBoundingClientRect().width" % TH)
    rec('X6 REAL keys on the focused header: + widens by 20, 0 fits it again', abs(wp - (round(wk) + 20)) <= 1 and abs(wz - w0) <= 1.5,
        '%.1f -> %.1f -> %.1f' % (wk, wp, wz))

    # A real Escape during a real drag.
    time.sleep(0.6)
    r3 = rect(TH)
    x3 = r3['r'] - 3
    cls0 = ev("document.body.className")
    mouse('mouseMoved', x3, y)
    mouse('mousePressed', x3, y, buttons=1)
    for i in range(1, 7):
        mouse('mouseMoved', x3 + i * 10, y, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.3)
    key('Escape', 'Escape', 27)
    esc_shield = ev("!!document.querySelector('.pnb-colw-shield')")
    mouse('mouseReleased', x3 + 60, y)
    time.sleep(0.3)
    esc = ev("({w: %s.getBoundingClientRect().width, stored: __drv.entry('rreal'), cls: document.body.className})" % TH)
    rec('X7 a REAL Escape mid-drag cancels it and nothing else happens (release lands nowhere)',
        not esc_shield and abs(esc['w'] - w0) <= 1.5 and not esc['stored'] and esc['cls'] == cls0, 'shieldAfterEsc=%s %s' % (esc_shield, json.dumps(esc)))

    # 2026-09-30: the grouped view and a pivot's row labels, with real input.
    ev("window.Penumbra.colWidthsHost.clearUser(); window.Penumbra.colWidths.apply(); true")
    ev("document.getElementById('groupedResultsContainer').style.width = '1000px'; __drv.buildGroups(['C11']).then(function(){return true;})", True)
    time.sleep(0.4)
    GTH = "__drv.gth(__drv.groupTables()[0], 'NAME')"
    ev("%s.scrollIntoView({block: 'center'}); true" % GTH)
    time.sleep(0.3)
    g0 = rect(GTH)
    gy = (g0['t'] + g0['b']) / 2
    gx = g0['r'] - 3
    mouse('mouseMoved', gx, gy)
    mouse('mousePressed', gx, gy, buttons=1)
    for i in range(1, 9):
        mouse('mouseMoved', gx + i * 10, gy, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    mouse('mouseReleased', gx + 80, gy)
    time.sleep(0.3)
    gd = ev("({w: %s.getBoundingClientRect().width, sorts: __CWH.getSort().length, stored: window.Penumbra.colWidthsHost.widthFor('NAME')})" % GTH)
    want_g = round(g0['w'] + 80)
    rec('X10 a REAL drag on a grouped-view header sets the shared width, and the click after it does not sort',
        abs(gd['w'] - want_g) <= 1 and gd['stored'] == want_g and gd['sorts'] == 0, json.dumps(gd) + ' want %d' % want_g)
    time.sleep(0.6)
    g1 = rect(GTH)
    gx1 = g1['r'] - 3
    mouse('mouseMoved', gx1, gy)
    mouse('mousePressed', gx1, gy, buttons=1, clicks=1)
    mouse('mouseReleased', gx1, gy, clicks=1)
    mouse('mousePressed', gx1, gy, buttons=1, clicks=2)
    mouse('mouseReleased', gx1, gy, clicks=2)
    time.sleep(0.3)
    gf = ev("({w: %s.getBoundingClientRect().width, sorts: __CWH.getSort().length, stored: window.Penumbra.colWidthsHost.widthFor('NAME')})" % GTH)
    rec('X11 a REAL double-click on a grouped-view header edge fits the column again, and does not sort',
        abs(gf['w'] - g0['w']) <= 1.5 and gf['stored'] is None and gf['sorts'] == 0, json.dumps(gf) + ' natural %.1f' % g0['w'])
    ev("document.getElementById('groupedResultsContainer').style.display = 'none'; true")
    time.sleep(0.6)

    ev("__drv.mountPivot(['C11', 'NAME'], ['C10']).then(function(){return true;})", True)
    time.sleep(0.4)
    PTH = "__drv.plv(1)"
    ev("%s.scrollIntoView({block: 'center'}); true" % PTH)
    time.sleep(0.3)
    p0 = rect(PTH)
    py_ = (p0['t'] + p0['b']) / 2
    px_ = p0['r'] - 3
    # What a real press there hits (a covered header would fail for a reason
    # that has nothing to do with the module - say so).
    hit_p = ev("(function(x,y){var e=document.elementFromPoint(x,y);return e?(e.closest&&e.closest('th')===%s?'header':e.tagName+'#'+e.id):'none';})(%f,%f)" % (PTH, px_, py_))
    mouse('mouseMoved', px_, py_)
    mouse('mousePressed', px_, py_, buttons=1)
    for i in range(1, 7):
        mouse('mouseMoved', px_ + i * 10, py_, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    mouse('mouseReleased', px_ + 60, py_)
    time.sleep(0.3)
    pd = ev("({w: %s.getBoundingClientRect().width, sorts: __CWH.getSort().length, stored: window.Penumbra.colWidthsHost.widthFor('PIVOT:NAME')})" % PTH)
    want_p = round(p0['w'] + 60)
    rec('X12 a REAL drag on a pivot row-label header lands as PIVOT:NAME, and the click after it does not sort the pivot',
        hit_p == 'header' and abs(pd['w'] - want_p) <= 1 and pd['stored'] == want_p and pd['sorts'] == 0,
        json.dumps(pd) + ' want %d, press hit %s' % (want_p, hit_p))
    time.sleep(0.6)
    ev("window.Penumbra.colWidthsHost.clearUser(); window.Penumbra.colWidths.apply(); %s.focus(); true" % PTH)
    pk0 = ev("%s.getBoundingClientRect().width" % PTH)
    key('+', 'Equal', 187, text='+', modifiers=8)
    pk1 = ev("%s.getBoundingClientRect().width" % PTH)
    focused = ev("document.activeElement === %s" % PTH)
    rec('X13 a pivot row-label header takes REAL keyboard focus and + widens it by 20', focused and abs(pk1 - (round(pk0) + 20)) <= 1,
        'focused=%s %.1f -> %.1f' % (focused, pk0, pk1))
    ev("window.Penumbra.colWidthsHost.clearUser(); window.Penumbra.colWidths.apply(); true")

    # 2026-10-01: a pivot's ONE value column - a REAL drag far below its numbers
    # stops at the widest one, says so, and the click after it does not sort.
    ev("__drv.mountPivot(['C11', 'NAME'], []).then(function(){return true;})", True)
    time.sleep(0.4)
    VTH = "__drv.pval()"
    ev("%s.scrollIntoView({block: 'center'}); true" % VTH)
    time.sleep(0.3)
    v0 = rect(VTH)
    vy = (v0['t'] + v0['b']) / 2
    vx = v0['r'] - 3
    hit_v = ev("(function(x,y){var e=document.elementFromPoint(x,y);return e?(e.closest&&e.closest('th')===%s?'header':e.tagName+'#'+e.id):'none';})(%f,%f)" % (VTH, vx, vy))
    vfloor = ev("window.Penumbra.colWidths.valueFloor(document.getElementById('pivotResultTable'))")
    mouse('mouseMoved', vx, vy)
    mouse('mousePressed', vx, vy, buttons=1)
    for i in range(1, 9):
        mouse('mouseMoved', vx - i * 25, vy, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    vlabel = ev("(function(){var l=document.querySelector('.pnb-colw-label');return l?l.textContent:'';})()")
    mouse('mouseReleased', vx - 200, vy)
    time.sleep(0.3)
    vd = ev("({w: %s.getBoundingClientRect().width, sorts: __CWH.getSort().length, stored: window.Penumbra.colWidthsHost.widthFor('PIVOT:=AMOUNT'), clipped: Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable > tbody > tr > td:not([data-row-field]):not([colspan]), #pivotResultTable > tfoot > tr > td:not([data-row-field]):not([colspan])'), function(c){return c.offsetParent && c.scrollWidth > c.clientWidth + 1;}).length})" % VTH)
    rec('X14 a REAL drag on a pivot\'s one value column, far below its numbers, stops at the widest one (the guide says so), clips nothing and does not sort',
        hit_v == 'header' and vd['stored'] == vfloor and abs(vd['w'] - vfloor) <= 1 and vlabel == '%d px (widest number)' % vfloor and vd['clipped'] == 0 and vd['sorts'] == 0,
        json.dumps(vd) + ' floor %s label "%s" press hit %s' % (vfloor, vlabel, hit_v))
    time.sleep(0.6)
    ev("window.Penumbra.colWidthsHost.clearUser(); window.Penumbra.colWidths.apply(); true")

    # Round 4 (2026-10-01): FY across - a REAL drag on ONE FY header sizes all
    # four together, the guide says so, the Grand Total stays, no sort.
    ev("__drv.mountPivot(['C11', 'NAME'], ['C10']).then(function(){return true;})", True)
    time.sleep(0.4)
    ZTH = "__drv.zheads().cols[1]"
    ev("%s.scrollIntoView({block: 'center'}); true" % ZTH)
    time.sleep(0.3)
    z0 = rect(ZTH)
    zy = (z0['t'] + z0['b']) / 2
    zx = z0['r'] - 3
    hit_z = ev("(function(x,y){var e=document.elementFromPoint(x,y);return e?(e.closest&&e.closest('th')===%s?'header':e.tagName+'#'+e.id):'none';})(%f,%f)" % (ZTH, zx, zy))
    gt0 = ev("__drv.zheads().total.getBoundingClientRect().width")
    mouse('mouseMoved', zx, zy)
    mouse('mousePressed', zx, zy, buttons=1)
    for i in range(1, 6):
        mouse('mouseMoved', zx + i * 10, zy, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    zlabel = ev("(function(){var l=document.querySelector('.pnb-colw-label');return l?l.textContent:'';})()")
    mouse('mouseReleased', zx + 50, zy)
    time.sleep(0.3)
    zd = ev("({ws: __drv.zheads().cols.map(function(x){return Math.round(x.getBoundingClientRect().width);}), gt: __drv.zheads().total.getBoundingClientRect().width, sorts: __CWH.getSort().length, stored: window.Penumbra.colWidthsHost.widthFor('PIVOT:=AMOUNT')})")
    want_z = round(z0['w'] + 50)
    rec('X15 a REAL drag on one FY header sizes all four FY columns to one width (the guide says "all 4 columns"), the Grand Total stays, no sort',
        hit_z == 'header' and zd['stored'] == want_z and all(abs(w - want_z) <= 1 for w in zd['ws']) and zlabel == '%d px (all 4 columns)' % want_z and
        abs(zd['gt'] - gt0) <= 2 and zd['sorts'] == 0,
        json.dumps(zd) + ' want %d label "%s" gt before %.1f press hit %s' % (want_z, zlabel, gt0, hit_z))
    time.sleep(0.6)
    ev("window.Penumbra.colWidthsHost.clearUser(); window.Penumbra.colWidths.apply(); true")

    # Round 5 (2026-10-01): a TWO-row header - a REAL drag on a year header
    # shares the year's new width evenly between its leaves; a REAL drag on a
    # leaf sizes it alone (its year follows).
    ev("__drv.mountPivot(['C11', 'NAME'], ['C10'], {aggs: ['sum', 'count']}).then(function(){return true;})", True)
    time.sleep(0.4)
    YTH = "__drv.mgrid().groups[1].th"
    ev("%s.scrollIntoView({block: 'center'}); true" % YTH)
    time.sleep(0.3)
    y0 = rect(YTH)
    yy = (y0['t'] + y0['b']) / 2
    yx = y0['r'] - 3
    hit_y = ev("(function(x,y){var e=document.elementFromPoint(x,y);return e?(e.closest&&e.closest('th')===%s?'header':e.tagName+'#'+e.id):'none';})(%f,%f)" % (YTH, yx, yy))
    others_y = ev("[0,2,3,4].map(function(i){return Math.round(__drv.mgrid().groups[i].th.getBoundingClientRect().width);})")
    mouse('mouseMoved', yx, yy)
    mouse('mousePressed', yx, yy, buttons=1)
    for i in range(1, 5):
        mouse('mouseMoved', yx + i * 10, yy, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    ylabel = ev("(function(){var l=document.querySelector('.pnb-colw-label');return l?l.textContent:'';})()")
    mouse('mouseReleased', yx + 40, yy)
    time.sleep(0.3)
    yd = ev("(function(){var g=__drv.mgrid(), h=window.Penumbra.colWidthsHost; return {year: Math.round(g.groups[1].th.getBoundingClientRect().width), stored: [h.widthFor('PIVOT:=AMOUNT@1.0'), h.widthFor('PIVOT:=AMOUNT@1.1')], others: [0,2,3,4].map(function(i){return Math.round(g.groups[i].th.getBoundingClientRect().width);}), sorts: __CWH.getSort().length};})()")
    want_y = round(y0['w'] + 40)
    rec('X16 a REAL drag on a year header (two-row pivot) shares the new width evenly between its 2 leaves; the other years stay put; no sort',
        hit_y == 'header' and abs(yd['year'] - want_y) <= 1 and None not in yd['stored'] and sum(yd['stored']) == want_y and abs(yd['stored'][0] - yd['stored'][1]) <= 1 and
        all(abs(a - b) <= 1 for a, b in zip(yd['others'], others_y)) and ylabel == '%d px (2 columns)' % want_y and yd['sorts'] == 0,
        json.dumps(yd) + ' want %d label "%s" press hit %s' % (want_y, ylabel, hit_y))
    time.sleep(0.6)
    LTH = "__drv.mgrid().groups[2].leaves[1].th"
    # The pivot's box is narrower than the pivot: bring the leaf into view sideways too.
    ev("%s.scrollIntoView({block: 'center', inline: 'center'}); true" % LTH)
    time.sleep(0.3)
    l0 = rect(LTH)
    ly = (l0['t'] + l0['b']) / 2
    lx = l0['r'] - 3
    hit_l = ev("(function(x,y){var e=document.elementFromPoint(x,y);return e?(e.closest&&e.closest('th')===%s?'header':e.tagName+'#'+e.id):'none';})(%f,%f)" % (LTH, lx, ly))
    sib0 = ev("Math.round(__drv.mgrid().groups[2].leaves[0].th.getBoundingClientRect().width)")
    mouse('mouseMoved', lx, ly)
    mouse('mousePressed', lx, ly, buttons=1)
    for i in range(1, 4):
        mouse('mouseMoved', lx + i * 10, ly, buttons=1, ack=False)
        time.sleep(0.03)
    drain(0.4)
    mouse('mouseReleased', lx + 30, ly)
    time.sleep(0.3)
    ld = ev("(function(){var g=__drv.mgrid(), G=g.groups[2]; return {leaf: Math.round(G.leaves[1].th.getBoundingClientRect().width), sibling: Math.round(G.leaves[0].th.getBoundingClientRect().width), year: Math.round(G.th.getBoundingClientRect().width), stored: window.Penumbra.colWidthsHost.widthFor('PIVOT:=AMOUNT@2.1'), sorts: __CWH.getSort().length};})()")
    want_l = round(l0['w'] + 30)
    rec('X17 a REAL drag on a leaf (FY 2025 Count) sizes it alone: its sibling stays, the year grows with it, no sort',
        hit_l == 'header' and ld['stored'] == want_l and abs(ld['leaf'] - want_l) <= 1 and abs(ld['sibling'] - sib0) <= 1 and
        abs(ld['year'] - (ld['leaf'] + ld['sibling'])) <= 2 and ld['sorts'] == 0,
        json.dumps(ld) + ' want %d sibling before %d press hit %s' % (want_l, sib0, hit_l))
    time.sleep(0.6)
    ev("window.Penumbra.colWidthsHost.clearUser(); $('#pivot-output-container').empty().hide(); true")

    # The custom-layout pill: a width of its own lights it; its Reset (which
    # reloads the page) returns the widths too.
    ev("window.Penumbra.colWidthsHost.setUser('TITLE', 250); true")
    time.sleep(0.2)
    pill = ev("(function(){var c=document.getElementById('sbCustomCols');c.scrollIntoView();return getComputedStyle(c).display;})()")
    txt = ev("document.getElementById('sbCustomColsDiff').textContent")
    pr = rect("document.getElementById('sbCustomCols')")
    mouse('mouseMoved', (pr['l'] + pr['r']) / 2, (pr['t'] + pr['b']) / 2)
    mouse('mousePressed', (pr['l'] + pr['r']) / 2, (pr['t'] + pr['b']) / 2, buttons=1)
    mouse('mouseReleased', (pr['l'] + pr['r']) / 2, (pr['t'] + pr['b']) / 2)
    time.sleep(0.3)
    br = rect("document.getElementById('sbCustomColsReset')")
    before = ev("JSON.stringify(__drv.entry('rreal'))")
    mouse('mouseMoved', (br['l'] + br['r']) / 2, (br['t'] + br['b']) / 2)
    mouse('mousePressed', (br['l'] + br['r']) / 2, (br['t'] + br['b']) / 2, buttons=1)
    mouse('mouseReleased', (br['l'] + br['r']) / 2, (br['t'] + br['b']) / 2)
    time.sleep(1.0)
    reloaded = load()
    stored = ev("localStorage.getItem('penumbra_column_prefs')")
    rec('X8 the pill names the width; its Reset reloads the page with the width gone from storage',
        pill != 'none' and 'Column widths set here: TITLE' in (txt or '') and '250' in (before or '') and reloaded and (not stored or '"widths"' not in stored),
        'pill=%s text=%s before=%s reloaded=%s stored=%s' % (pill, txt, before, reloaded, stored))
    errors = ev("window.__errors.concat(window.__rejections).slice(0,5)")
    rec('X9 no page errors', not errors, json.dumps(errors))
finally:
    try:
        ws.close()
    except Exception:
        pass
    edge.kill()
    time.sleep(0.5)
    subprocess.run(['powershell', '-NoProfile', '-Command',
                    "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*pnbedge_cwr_*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"],
                   capture_output=True)

npass = sum(1 for r in results if r[1])
for name, ok, detail in results:
    print('  %s  %s  [%s]' % ('PASS' if ok else 'FAIL', name, detail))
print('SUMMARY real pass=%d fail=%d' % (npass, len(results) - npass))
sys.exit(0 if npass == len(results) and results else 1)
