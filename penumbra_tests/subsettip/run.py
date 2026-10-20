# =============================================================================
# SUBSETTIP SUITE (2026-10-02)
#
# The Copy, Download and Email dialogs each carry "Tip: Use the Visual Search
# Builder to create a subset of the data to <copy|download|email>." whose link
# closes the dialog and opens the builder on the report search bar; the email
# dialog's admin-only "schedule these emails ... Scheduler Tab" tip and its
# #linkToSchedulerFromEmail handler are gone (the Snapshots one stays).
#
# Browser: the three dialogs LIFTED from the index.php under test (PHP tags
# stripped), the main.css + js/search_builder.js under test, the live
# penumbra_a11y.js, jQuery + jQuery UI, and search_builder_content.php past its
# PHP header; a stub _penumbraSearchAPI. Headless Edge over CDP, REAL mouse.
#   T1-<d>  one tip in the dialog, visible, its wording names the action
#   T2-<d>  open-time focus is NOT on the tip link (the a11y layer skips titled controls)
#   T3-<d>  clicking the link hides the dialog
#   T4-<d>  ... and opens the builder (Search mode = the report search bar)
#   T5-<d>  ... and the builder still holds focus 1.5 s later (no restore steal)
#   T6-<d>  closing the builder hands focus back to the toolbar button that opened the dialog
#   T7-<d>  body.restrict-search (Search Bar off for this viewer): the tip is hidden
#   (round 2, 2026-10-02 16:5x: the tip also goes while the search box holds text)
#   T8-<d>  text put in the box by a SILENT script write (no input event, no .has-text): hidden
#   T9-<d>  box emptied silently with .has-text left STALE on: the tip is back
#   E       no page errors
# Static:
#   S1 no #linkToSchedulerFromEmail in index.php   S2 nor in main.js
#   S3 the old tip's wording is gone   S4 the Snapshots tip + handler stay (both files)
#   S5 the email tip is not behind a PHP gate   S6 main.js + search_builder.js parse
#   S7 the Copy dialog's "Choose a format to copy..." line and the <hr> under it are gone
#
#   py -3 run.py --app <dir>              files under test from <dir> (index.php, js/, css/)
#   py -3 run.py --app <dir> --mutant M   M in MUTANTS below; must turn its asserts RED
#   py -3 run.py --shots <dir>            also save copy_tip.png / copy_text.png there
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
CR = '\r\n'
DLG = {'copy': ('copyActionsLightbox', 'openCopy', 'to copy.'),
       'download': ('downloadActionsLightbox', 'openDownload', 'to download.'),
       'email': ('emailLightbox', 'openEmail', 'to email.')}
def ALL(*ts): return [t + '-' + d for t in ts for d in ('copy', 'download', 'email')]
HIDE = "        $(this).closest('.help-lightbox').hide();" + CR
MUTANTS = {
    # the dialog fades instead of hiding: its close-time focus restore RACES the builder's own
    # focus (lost in 1 of 3 dialogs on 10-02), so any T5 red kills it
    'fadeout': ('js/search_builder.js', [(HIDE, "        $(this).closest('.help-lightbox').fadeOut();" + CR)], ALL('T5', 'T6')),
    # no handler: the link is a dead '#'
    'nohandler': ('js/search_builder.js', [("    $(document).on('click', '.pnb-subset-tip-link', function(e) {",
                                            "    $(document).on('click', '.pnb-subset-tip-link-x', function(e) {")],
                  ALL('T3', 'T4', 'T5', 'T6')),
    # no restrict-search rule: a viewer without the Search Bar is offered the builder anyway
    'nocss': ('css/main.css', [("body.restrict-search .pnb-subset-tip," + CR, "")],
              ALL('T7')),
    # keyed to .has-text instead of the box's value: silent writes leave it wrong both ways
    'hastext': ('css/main.css', [("body:has(#tableSearch:not(:placeholder-shown)) .pnb-subset-tip {",
                                  "body:has(#tableSearchContainer.has-text) .pnb-subset-tip {")], ALL('T8', 'T9')),
    # no search-box selector: the tip shows over a search already in place
    'notext': ('css/main.css', [("body.restrict-search .pnb-subset-tip," + CR + "body:has(#tableSearch:not(:placeholder-shown)) .pnb-subset-tip {",
                                 "body.restrict-search .pnb-subset-tip {")], ALL('T8')),
    # untitled links: the a11y layer's open-time focus lands on the tip (email too here: main.js's
    # own #emailInputReal focus is not in the harness)
    # (the builder is "Visual Search Builder", or "Visual Filter Builder" since penumbra_tests\filterword
    # 2026-10-19: the anchor stops before the name and the title attribute is renamed away)
    'notitle': ('index.php', [(' title="Close this dialog and open the Visual ', ' data-was-title="')], ALL('T2')),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
APP = opt('--app', LIVE)
mutant = opt('--mutant', None)
shots = opt('--shots', None)

def rd(rel, app=APP): return open(os.path.join(app, rel), 'rb').read().decode('utf-8', 'surrogateescape')
files = {r: rd(r) for r in ('index.php', 'js/search_builder.js', 'css/main.css', 'js/main.js')}
if mutant:
    rel, edits, _ = MUTANTS[mutant]
    for old, new in edits:
        n = files[rel].count(old)
        if n < 1 or (rel != 'index.php' and n != 1): raise SystemExit("mutant %s: anchor hits %d" % (mutant, n))
        files[rel] = files[rel].replace(old, new)

res = []
def ok(i, name, cond, detail=''): res.append((i, name, bool(cond), detail))

# ---- static ----------------------------------------------------------------
ix, mj = files['index.php'], files['js/main.js']
ok('S1', 'no #linkToSchedulerFromEmail in index.php', 'linkToSchedulerFromEmail' not in ix)
ok('S2', 'no #linkToSchedulerFromEmail in main.js', 'linkToSchedulerFromEmail' not in mj)
ok('S3', 'the old tip wording is gone', 'schedule these emails with dynamic parameters' not in ix)
ok('S4', 'the Snapshots tip + handler stay', ix.count('id="linkToSchedulerFromSnapshot"') == 1 and mj.count("'#linkToSchedulerFromSnapshot'") == 1)
em = ix[ix.index('<div id="emailLightbox"'):]
em = em[:em.index('pnb-subset-tip')] if 'pnb-subset-tip' in em else em[:2000]
ok('S5', 'the email tip is not behind a PHP gate', '<?php if' not in em[em.index('Enter one or more email'):])
cp = ix[ix.index('<div id="copyActionsLightbox"'):ix.index('<div id="copyOptionsContainer"')]
ok('S7', 'the Copy intro line and its <hr> are gone', 'Choose a format to copy' not in ix and '<hr' not in cp)

def lift(start, end):
    a = ix.index(start); b = ix.index(end, a)
    return re.sub(r'<\?php.*?\?>', '', ix[a:b], flags=re.S)
dialogs = (lift('<div id="copyActionsLightbox"', '<!-- Lazy-populated popup for "Create direct download link"')
           + lift('<div id="emailLightbox"', '<div id="visualizationLightbox"'))
search = lift('<div id="resultsHeader">', '<div id="paginatorContainer"') + '</div>'
sbc = rd('search_builder_content.php', LIVE)
sbc = sbc[sbc.index('?>') + 2:]

stage = tempfile.mkdtemp(prefix='pnb_subsettip_')
for f in ('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'penumbra_a11y.js'): shutil.copyfile(os.path.join(LIVE, 'js', f), os.path.join(stage, f))
for f in ('jquery-ui.css', 'search_builder.css'): shutil.copyfile(os.path.join(LIVE, 'css', f), os.path.join(stage, f))
def wr(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
wr('main.css', files['css/main.css']); wr('search_builder.js', files['js/search_builder.js'])
wr('main.js', mj); wr('search_builder_content.php', sbc)
wr('h.html', '''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="jquery-ui.css"><link rel="stylesheet" href="main.css"><link rel="stylesheet" href="search_builder.css">
</head><body>
<div style="padding:10px"><button id="openCopy">Copy</button> <button id="openDownload">Download</button> <button id="openEmail">Email</button></div>
''' + search + '''
<div id="searchBuilderContainer"></div>
''' + dialogs + '''
<script>window.ERR = []; window.onerror = function (m, s, l) { ERR.push(m + ' @' + String(s).split('/').pop() + ':' + l); };
window.SEARCHES = 0;
window._penumbraSearchAPI = {
  getColumns: function () { return [{ name: 'COLLEGE', visible: true }, { name: 'AMOUNT', visible: true }]; },
  buildVirtualColumnNames: function () { return []; }, getPivotAggregateColumns: function () { return []; },
  getGroupSummaryColumns: function () { return []; }, getPivotSharedNames: function () { return []; },
  countMatchingRows: function () { return { total: 2, matched: 2, count: 2 }; }, getColumnAutocompleteValues: function () { return []; },
  getColumnDateInfo: function () { return null; }, getCurrentReportId: function () { return 'h1'; },
  isToggleColumn: function () { return false; }, takeSrcModifier: function (q) { return { src: false, query: q }; },
  runTableSearch: function () { SEARCHES++; }, handleSessionExpired: function () { ERR.push('session expired'); }
};</script>
<script src="jquery-3.7.1.min.js"></script><script src="jquery-ui.min.js"></script>
<script src="penumbra_a11y.js"></script><script src="search_builder.js"></script>
<script>
$('#tableSearchContainer').show();
$('#openCopy').on('click', function () { $('#copyActionsLightbox').css('display', 'flex').hide().fadeIn(); });
$('#openDownload').on('click', function () { $('#downloadActionsLightbox').css('display', 'flex').hide().fadeIn(); });
$('#openEmail').on('click', function () { $('#emailLightbox').css('display', 'flex').hide().fadeIn(); });
window.READY = true;
</script></body></html>''')

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'profile'), '--window-size=1400,1000',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

try:
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=120, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    def ev(expr):
        return call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')
    def click(sel):
        r = ev("(function(){var e=document.querySelector(%s);if(!e)return null;var b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2,b.width];})()" % json.dumps(sel))
        if not r or not r[2]: return False
        x, y = r[0], r[1]
        call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})
        call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'buttons': 1, 'clickCount': 1})
        call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'buttons': 0, 'clickCount': 1})
        return True
    def key_escape():
        for typ in ('rawKeyDown', 'keyUp'):
            call('Input.dispatchKeyEvent', {'type': typ, 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
    call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
    call('Page.navigate', {'url': 'http://127.0.0.1:%d/h.html' % hp})
    for _ in range(100):
        if ev('window.READY === true'): break
        time.sleep(0.1)
    # S6: both scripts parse (main.js is never run here, only compiled)
    parse = ev("Promise.all(['main.js','search_builder.js'].map(function(f){return fetch(f).then(function(r){return r.text();}).then(function(s){try{new Function(s);return f+':ok';}catch(e){return f+':'+e;}});})).then(function(a){return a.join(' ');})")
    ok('S6', 'main.js + search_builder.js parse', parse == 'main.js:ok search_builder.js:ok', parse)

    def dlg_state(did):
        return ev("""(function(){var d=document.getElementById(%s);var t=d.querySelectorAll('.pnb-subset-tip');
          var a=document.activeElement;var sb=document.getElementById('searchBuilderLightbox');
          return {disp:getComputedStyle(d).display,tips:t.length,tipVis:t.length?getComputedStyle(t[0]).display!=='none'&&t[0].offsetParent!==null:false,
            text:t.length?t[0].textContent.replace(/\\s+/g,' ').trim():'',
            focusTip:!!(a&&a.classList&&a.classList.contains('pnb-subset-tip-link')),focus:a?(a.id||a.tagName+'.'+a.className):'',
            sbDisp:sb?getComputedStyle(sb).display:'absent',sbFocus:!!(sb&&sb.contains(a)),sbLabel:$('#sbSubmitBtn').text()};})()""" % json.dumps(did))

    for d, (did, opener, verb) in DLG.items():
        click('#' + opener); time.sleep(1.0)
        s = dlg_state(did)
        ok('T1-' + d, 'one visible tip naming the action', s['tips'] == 1 and s['tipVis'] and ('Visual Search Builder' in s['text'] or 'Visual Filter Builder' in s['text']) and s['text'].endswith(verb), s['text'])
        ok('T2-' + d, 'open-time focus is not on the tip link', not s['focusTip'], s['focus'])
        clicked = click('#%s .pnb-subset-tip-link' % did); time.sleep(0.25)
        s1 = dlg_state(did)
        time.sleep(1.5)
        s2 = dlg_state(did)
        ok('T3-' + d, 'the link hides the dialog', clicked and s2['disp'] == 'none', s2['disp'])
        # the report mode's button: "Search", or "Filter" since penumbra_tests\filterword (2026-10-19)
        ok('T4-' + d, 'the builder opens on the search bar', s2['sbDisp'] != 'none' and s2['sbDisp'] != 'absent' and s2['sbLabel'] in ('Search', 'Filter'), '%s/%s' % (s2['sbDisp'], s2['sbLabel']))
        ok('T5-' + d, 'the builder holds focus 1.5 s on', s2['sbFocus'], s2['focus'])
        if s2['sbDisp'] not in ('none', 'absent'):
            click('#searchBuilderLightbox .close-lightbox'); time.sleep(1.2)
        s3 = ev("document.activeElement ? document.activeElement.id : ''")
        ok('T6-' + d, 'closing the builder returns focus to the opener', s3 == opener, s3)
        ev("$('.help-lightbox').hide(); true"); time.sleep(0.3)
    ev("document.body.classList.add('restrict-search'); true")
    for d, (did, opener, verb) in DLG.items():
        click('#' + opener); time.sleep(0.9)
        s = dlg_state(did)
        ok('T7-' + d, 'Search Bar off: the tip is hidden', s['disp'] != 'none' and s['tips'] == 1 and not s['tipVis'], 'disp=%s vis=%s' % (s['disp'], s['tipVis']))
        ev("$('.help-lightbox').hide(); true"); time.sleep(0.3)
    ev("document.body.classList.remove('restrict-search'); true")
    def shot(name):
        if not shots: return
        import base64
        r = ev("(function(){var b=document.querySelector('#copyActionsLightbox .lightbox-content').getBoundingClientRect();return [b.left,b.top,b.width,Math.min(b.height,330)];})()")
        png = call('Page.captureScreenshot', {'format': 'png', 'clip': {'x': r[0], 'y': r[1], 'width': r[2], 'height': r[3], 'scale': 1}})
        os.makedirs(shots, exist_ok=True)
        open(os.path.join(shots, name), 'wb').write(base64.b64decode(png['data']))
    for d, (did, opener, verb) in DLG.items():
        # the silent writes main.js makes (snapshot restore, report reset): no input event, .has-text untouched
        ev("$('#tableSearchContainer').removeClass('has-text'); $('#tableSearch').val('COLLEGE = Eng'); true")
        click('#' + opener); time.sleep(0.9)
        s = dlg_state(did)
        ok('T8-' + d, 'search box holds text: the tip is hidden', s['disp'] != 'none' and s['tips'] == 1 and not s['tipVis'], 'disp=%s vis=%s' % (s['disp'], s['tipVis']))
        if d == 'copy': shot('copy_text.png')
        ev("$('#tableSearch').val(''); $('#tableSearchContainer').addClass('has-text'); true"); time.sleep(0.2)
        s = dlg_state(did)
        ok('T9-' + d, 'box emptied (stale .has-text): the tip is back', s['disp'] != 'none' and s['tipVis'], 'disp=%s vis=%s' % (s['disp'], s['tipVis']))
        if d == 'copy': shot('copy_tip.png')
        ev("$('.help-lightbox').hide(); $('#tableSearchContainer').removeClass('has-text'); true"); time.sleep(0.3)
    errs = ev('ERR')
    ok('E', 'no page errors', not errs, '; '.join(errs or []))
finally:
    try: edge.kill()
    except Exception: pass
    srv.kill()
    time.sleep(0.5)
    shutil.rmtree(stage, ignore_errors=True)

red = [r for r in res if not r[2]]
for i, name, p, det in res:
    print('%-4s %-11s %s%s' % ('PASS' if p else 'FAIL', i, name, ('   [' + str(det) + ']') if (det and not p) else ''))
print('%s %d / %d%s' % ('GREEN' if not red else 'RED', len(res) - len(red), len(red), (' (mutant %s)' % mutant) if mutant else ''))
if mutant:
    allowed = set(MUTANTS[mutant][2]); got = set(r[0] for r in red)
    # killed = something red, and nothing red outside what this mutant may break
    print('MUTANT %s: %s (allowed red %s, got red %s)' % (mutant, 'KILLED' if got and got <= allowed | {'E'} else 'SURVIVED/OFF', sorted(allowed), sorted(got)))
