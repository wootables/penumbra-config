# fbucket 2: screenshots of the filter box's list with buckets and of openBucketRow (staged files), for the review:
#   py -3 shot2.py --stage DIR --out DIR
import argparse, base64, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run as RUN

ap = argparse.ArgumentParser(); ap.add_argument('--stage'); ap.add_argument('--out'); a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
F = RUN.files_from(a.stage, None)
work = RUN.stage_dir(F)
RUN.wait_edge()
prof = os.path.join(work, 'profile_s'); dp = RUN.free_port()
edge = RUN.subprocess.Popen([RUN.EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
                             '--allow-file-access-from-files', '--user-data-dir=' + prof, '--remote-debugging-port=%d' % dp,
                             '--remote-allow-origins=*', 'about:blank'], stdout=RUN.subprocess.DEVNULL, stderr=RUN.subprocess.DEVNULL)
def jget(p, m='GET'):
    return RUN.json.loads(RUN.urllib.request.urlopen(RUN.urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
def shot(pg, name, clip=None):
    kw = {'format': 'png'}
    if clip: kw['clip'] = dict(clip, scale=1); kw['captureBeyondViewport'] = True
    r = pg.call('Page.captureScreenshot', **kw)
    p = os.path.join(a.out, name); open(p, 'wb').write(base64.b64decode(r['data'])); print('wrote', p)
def menu_clip(pg, sel):
    r = pg.ev("(function(){var b=$(%s)[0].getBoundingClientRect(), w=$(%s).autocomplete('widget')[0].getBoundingClientRect(), sx=window.scrollX, sy=window.scrollY;"
              "var top=Math.min(b.top, w.top), bot=Math.max(b.bottom, w.bottom);"
              "return {x: Math.max(0, Math.min(b.left, w.left) - 12 + sx), y: Math.max(0, top - 12 + sy), width: Math.max(b.right, w.right) - Math.min(b.left, w.left) + 24,"
              " height: bot - top + 24};})()" % (RUN.J(sel), RUN.J(sel)))
    return r
def typein(pg, sel, text, start=''):
    pg.ev('T.focusBox(%s, %s)' % (RUN.J(sel), RUN.J(start))); time.sleep(0.1)
    pg.call('Input.insertText', text=text); pg.wait('!!T.menu(%s)' % RUN.J(sel), 2500); time.sleep(0.4)
try:
    for _ in range(150):
        try: jget('/json/version'); break
        except Exception: time.sleep(0.2)
    pg = RUN.Page(jget('/json/new?about:blank', 'PUT')['webSocketDebuggerUrl'])
    pg.call('Page.enable'); pg.call('Runtime.enable'); pg.size(1366, 900)
    pg.call('Page.navigate', url='file:///' + work.replace('\\', '/') + '/builder.html')
    pg.wait("typeof window.T === 'object' && document.readyState === 'complete'", 30000); time.sleep(0.8)
    print(pg.ev('T.boot()'))
    # the app's jQuery UI stylesheet (index.php loads css/jquery-ui.css; the harness page does not), first, as the app orders it
    jqui = RUN.read(os.path.join(RUN.APP, 'css', 'jquery-ui.css'))
    pg.ev("var s=document.createElement('style'); s.textContent=%s; document.head.insertBefore(s, document.head.firstChild); true" % RUN.J(jqui))
    pg.ev("$('body').css('background', '#e9edf2'); $('#tableSearchContainer').prependTo('body').css({margin: '24px', width: '460px'}); $('#tableSearch').css({width: '100%', padding: '6px 8px', 'font-size': '13px'}); window.scrollTo(0, 0); T.boxes()")
    W = '#tableSearch'
    # 1: typing a column: its buckets right under it
    typein(pg, W, 'AMT'); shot(pg, 'box_typed_column.png', menu_clip(pg, W))
    # 2: typing a token's start: the buckets it begins
    typein(pg, W, 'D:f'); shot(pg, 'box_token_start.png', menu_clip(pg, W))
    # 3: a pick writes the token and lists its values
    c = pg.ev('T.itemAt(%s, %s)' % (RUN.J(W), RUN.J('D by Fiscal Year')))
    if c: pg.click(c['x'], c['y']); time.sleep(0.7)
    shot(pg, 'box_bucket_values.png', menu_clip(pg, W))
    # 4: the arrow's list (Alt+Down on the empty box): every column with its buckets
    pg.ev('T.focusBox(%s, "")' % RUN.J(W)); time.sleep(0.1)
    pg.call('Input.dispatchKeyEvent', type='rawKeyDown', key='ArrowDown', code='ArrowDown', windowsVirtualKeyCode=40, modifiers=1)
    pg.call('Input.dispatchKeyEvent', type='keyUp', key='ArrowDown', code='ArrowDown', windowsVirtualKeyCode=40, modifiers=1)
    pg.wait('!!T.menu(%s)' % RUN.J(W), 2500); time.sleep(0.4)
    shot(pg, 'box_all_columns.png', menu_clip(pg, W))
    pg.ev('T.closeMenus()')
    # 5: the palette's Filter COLUMN by... lands here: the builder with the box's condition and the bucket's row, its values open
    pg.ev("T.openBucket('N = alpha', 'AWARD DATE', ':fy')"); pg.wait('T.isOpen()', 8000); time.sleep(0.8)
    shot(pg, 'builder_bucket_row.png')
    print('errors', pg.ev('T.errors()'))
finally:
    try: edge.kill()
    except Exception: pass
    time.sleep(1); RUN.shutil.rmtree(work, ignore_errors=True)
