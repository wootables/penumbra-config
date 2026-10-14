import json, subprocess, time, urllib.request, tempfile, os, shutil, threading, functools, http.server, socketserver
import websocket
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
class Browser:
    def __init__(self, site, port=9351, size="1300,800"):
        class Q(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=site))   # threaded: a queued script request must not be dropped
        self.base = 'http://127.0.0.1:%d/' % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.prof = tempfile.mkdtemp(prefix="pnbedge_")
        self.p = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-extensions",
            "--user-data-dir=" + self.prof, "--window-size=" + size, "--remote-debugging-port=%d" % port, "--remote-allow-origins=*", "about:blank"])
        wsu = None
        for _ in range(80):
            try:
                ts = json.load(urllib.request.urlopen("http://127.0.0.1:%d/json" % port))
                pg = [t for t in ts if t.get("type") == "page" and t.get("url") == "about:blank"]
                if pg: wsu = pg[0]["webSocketDebuggerUrl"]; break
            except Exception: pass
            time.sleep(0.25)
        self.ws = websocket.create_connection(wsu, timeout=60); self.n = 0
        self.cmd("Network.enable"); self.cmd("Network.setCacheDisabled", cacheDisabled=True); self.cmd("Runtime.enable")
        self.errors = []
    def cmd(self, m, wait=True, **pa):
        self.n += 1; i = self.n; self.ws.send(json.dumps({"id": i, "method": m, "params": pa}))
        if not wait: return None
        while True:
            r = json.loads(self.ws.recv())
            if r.get("method") == "Runtime.exceptionThrown": self.errors.append(r["params"]["exceptionDetails"].get("exception", {}).get("description", "")[:200])
            if r.get("id") == i: return r.get("result", r)
    def ev(self, js):
        r = self.cmd("Runtime.evaluate", expression=js, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r: return {"__err": r["exceptionDetails"].get("exception", {}).get("description", "")[:300]}
        return r["result"].get("value")
    def load(self, url, ready="window.ready"):
        # Wait for THIS page: the previous page's window.ready is still true until
        # the navigation commits, and an evaluate that straddles it errors out.
        self.ev("window.ready = false")
        self.cmd("Page.navigate", url=self.base + url)
        want = url.split('?')[0]
        for attempt in range(3):
            for _ in range(100):
                r = self.ev("location.pathname.slice(-%d) === %s && !!(%s)" % (len(want), json.dumps(want), ready))
                if r is True: break
                time.sleep(0.1)
            if r is True: break
            self.cmd("Page.reload", ignoreCache=True)     # a script that failed to load: try the page again
        if r is not True: raise RuntimeError('page never became ready: %s %s' % (url, self.errors[-3:]))
        time.sleep(0.3)
    def mouse(self, t, x, y, buttons=0, cc=0, wait=True):
        pa = dict(type=t, x=x, y=y, button="left" if t != "mouseMoved" or buttons else "none", buttons=buttons)
        if cc: pa["clickCount"] = cc
        return self.cmd("Input.dispatchMouseEvent", wait=wait, **pa)
    def drag(self, x0, y0, x1, y1, steps=14):
        self.mouse("mouseMoved", x0, y0); time.sleep(0.05)
        self.mouse("mousePressed", x0, y0, 1, 1); time.sleep(0.08)
        for k in range(1, steps + 1):
            self.mouse("mouseMoved", x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, 1); time.sleep(0.03)
        time.sleep(0.15)
        self.mouse("mouseReleased", x1, y1, 0, 1); time.sleep(0.25)
    def click(self, x, y):
        self.mouse("mouseMoved", x, y); self.mouse("mousePressed", x, y, 1, 1); time.sleep(0.05); self.mouse("mouseReleased", x, y, 0, 1); time.sleep(0.15)
    def close(self):
        try: self.p.kill()
        except Exception: pass
        self.httpd.shutdown(); time.sleep(0.4); shutil.rmtree(self.prof, ignore_errors=True)
