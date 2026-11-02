# wsmenu: pictures of the menu (not checks) - the report page's menu with its Recent reports list, its Admin list, a
# dark theme, an admin tool's menu at Easy Read; round 2: a report's Theme list, a dashboard's menu + its Admin list. py -3 shots.py --app DIR --out DIR
import base64, json, os, sys, time
sys.argv = [sys.argv[0]] + sys.argv[1:]
OUT = None
if '--out' in sys.argv:
    i = sys.argv.index('--out'); OUT = sys.argv[i + 1]; del sys.argv[i:i + 2]
os.environ['PNB_WSM_SHOTS'] = '1'
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'run.py'), encoding='utf-8').read()
cut = src.find("try:\n    texts = load_texts()")
exec(compile(src[:cut], 'run.py', 'exec'))   # the runner's setup: stage, server, Edge, Pg (no scenarios)

def shot(p, name, clip=None):
    r = p.call('Page.captureScreenshot', {'format': 'png'} if not clip else {'format': 'png', 'clip': clip})
    open(os.path.join(OUT, name), 'wb').write(base64.b64decode(r['data']))
    print('wrote', name)

try:
    os.makedirs(OUT, exist_ok=True)
    write_stage(load_texts())
    now = int(time.time() * 1000)
    seed = ('localStorage.setItem("pnb_recent_reports", JSON.stringify([{id:"awd01",title:"Awards by sponsor",ts:%d},{id:"prop7",title:"Proposals in routing",ts:%d},'
            '{id:"exp22",title:"Expiring agreements",ts:%d}])); localStorage.setItem("penumbra_favorite_server_reports", JSON.stringify([{id:"pin1",title:"PI workload"}])); 1'
            % (now - 300000, now - 7200000, now - 2 * 86400000))
    for theme, fname in (('', 'menu_light'), ('theme-dark-blue', 'menu_dark')):
        p, ok = rpt('id=lrfix&scn=shot')
        p.ev(seed)
        if theme:
            p.ev('document.body.classList.add("%s", "is-dark"); 1' % theme)
        left = p.ev('window.__ws.gap("#resultsHeader", "left")')
        p.rclick(left)
        p.click(p.ev('window.__ws.itemAt("recent", 0)'))
        time.sleep(0.4)
        shot(p, fname + '_recent.png', {'x': 0, 'y': 0, 'width': 760, 'height': 520, 'scale': 1})
        p.key('Escape')
        p.rclick(left)
        p.click(p.ev('window.__ws.itemAt("admin", 0)'))
        time.sleep(0.4)
        shot(p, fname + '_admin.png', {'x': 0, 'y': 0, 'width': 760, 'height': 700, 'scale': 1})
        p.close()
    # (round 2) a report's Theme list, and a dashboard's menu with its Admin list
    p, ok = rpt('id=lrfix&scn=shot')
    p.ev(seed)
    left = p.ev('window.__ws.gap("#resultsHeader", "left")')
    p.rclick(left)
    p.click(p.ev('window.__ws.itemAt("theme", 0)'))
    time.sleep(0.4)
    shot(p, 'menu_theme.png', {'x': 0, 'y': 0, 'width': 760, 'height': 560, 'scale': 1})
    p.close()
    p = Pg('dash.html?admin=1')
    p.wait('!!(window.__ws && document.getElementById("dashGap"))', 30)
    p.ev(seed)
    time.sleep(0.4)
    p.rclick(p.ev('window.__ws.center("#dashGap")'))
    time.sleep(0.3)
    shot(p, 'menu_dashboard.png')
    p.click(p.ev('window.__ws.itemAt("admin", 0)'))
    time.sleep(0.4)
    shot(p, 'menu_dashboard_admin.png')
    p.close()
    p = Pg('adm.html?admin=1&tool=health&dz=easy-read')
    p.wait(READY_D, 30)
    time.sleep(0.4)
    p.rclick(p.ev('window.__ws.center("#intro")'))
    p.click(p.ev('window.__ws.itemAt("admin", 0)'))
    time.sleep(0.4)
    shot(p, 'menu_admin_tool.png', {'x': 0, 'y': 0, 'width': 1300, 'height': 640, 'scale': 1})
    p.close()
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
