# fbucket: screenshots of the real builder (staged files) for the review: py -3 shot.py --stage DIR --out DIR
import argparse, base64, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run as RUN

ap = argparse.ArgumentParser(); ap.add_argument('--stage'); ap.add_argument('--out'); a = ap.parse_args()
F = RUN.files_from(a.stage, None)
work = RUN.stage_dir(F)
RUN.wait_edge()
prof = os.path.join(work, 'profile_s'); dp = RUN.free_port()
edge = RUN.subprocess.Popen([RUN.EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
                             '--allow-file-access-from-files', '--user-data-dir=' + prof, '--remote-debugging-port=%d' % dp,
                             '--remote-allow-origins=*', 'about:blank'], stdout=RUN.subprocess.DEVNULL, stderr=RUN.subprocess.DEVNULL)
def jget(p, m='GET'):
    return RUN.json.loads(RUN.urllib.request.urlopen(RUN.urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
def shot(pg, name):
    r = pg.call('Page.captureScreenshot', format='png')
    p = os.path.join(a.out, name); open(p, 'wb').write(base64.b64decode(r['data'])); print('wrote', p)
try:
    for _ in range(150):
        try: jget('/json/version'); break
        except Exception: time.sleep(0.2)
    pg = RUN.Page(jget('/json/new?about:blank', 'PUT')['webSocketDebuggerUrl'])
    pg.call('Page.enable'); pg.call('Runtime.enable'); pg.size(1366, 860)
    pg.call('Page.navigate', url='file:///' + work.replace('\\', '/') + '/builder.html')
    pg.wait("typeof window.T === 'object' && document.readyState === 'complete'", 30000); time.sleep(0.8)
    print(pg.ev('T.boot()'))
    pg.ev("$('body').css('background', '#e9edf2'); true")
    # Before: a plain row in the dialog as it is today
    pg.ev("T.open('')"); pg.wait('T.isOpen()', 8000); time.sleep(0.4)
    pg.ev("T.setCol(0, 'N')"); time.sleep(0.3); pg.ev('T.hideAc()'); pg.ev("T.setOp(0, 'equals')"); pg.ev("T.setVal(0, 'alpha')"); time.sleep(0.3); pg.ev('T.hideAc()')
    shot(pg, 'builder_plain.png')
    # After: three rows - a fiscal-year set, a list value, a day-of-week set with its list open
    pg.ev("T.open(\"{AWARD DATE:fy} = /^(?:FY25|FY26)$/ and L:dsemi = 'Jones, Jacob' and D:dow = /^(?:Sat|Sun)$/\")")
    pg.wait('T.isOpen()', 8000); time.sleep(0.6); pg.ev('T.hideAc()')
    shot(pg, 'builder_buckets.png')
    pg.ev("T.row(0).find('.sb-value-input').not('.sb-value-input-secondary').focus().trigger('dblclick'); true"); time.sleep(0.6)
    shot(pg, 'builder_bucket_values.png')
    pg.ev("T.hideAc(); $(T.row(2).find('.sb-bucket-select')).focus(); true"); time.sleep(0.2)
    print(RUN.json.dumps(pg.ev('T.state(0)')), RUN.json.dumps(pg.ev('T.state(2)')))
    print('errors', pg.ev('T.errors()'))
finally:
    try: edge.kill()
    except Exception: pass
    time.sleep(1); RUN.shutil.rmtree(work, ignore_errors=True)
