"""Headless Edge over CDP: render chg.html cases, run their steps, collect results.

usage: py -3 cdp.py jobs.json results.json
jobs.json = {"base": "file:///C:/.../chg.html", "viewport": [2400, 1100],
             "cases": [{"name": "...", "query": "surface=pane&w=1708",
                        "steps": [{"eval": "window.__h.measure()", "as": "m"},
                                  {"realclick": "#auditChangesPopOut"}, {"wait": 0.3},
                                  {"hover": "#auditChangesPopOut"},
                                  {"shot": "out/x.png", "clip": "#auditor-tab", "pad": 8}]}]}
A step's "as" stores its value under that key in the case's "steps" dict.
realclick / hover = real Input.dispatchMouseEvent at the element's centre.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request, base64, random
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


class Cdp:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=60)
        self.n = 0

    def call(self, method, params=None, timeout=60):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
        raise TimeoutError(method)

    def eval(self, expr, timeout=60):
        res = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
        if "exceptionDetails" in res:
            raise RuntimeError(json.dumps(res["exceptionDetails"])[:800])
        return res.get("result", {}).get("value")


def launch(viewport):
    port = random.randint(9400, 9800)
    prof = tempfile.mkdtemp(prefix="pnbedge_chg_")
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
            "--no-default-browser-check", "--disable-sync", "--disable-extensions",
            "--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--force-prefers-no-reduced-motion",
            f"--user-data-dir={prof}", f"--window-size={viewport[0]},{viewport[1]}",
            f"--remote-debugging-port={port}", "--remote-allow-origins=*", "about:blank"]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws = None
    for _ in range(100):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=2) as r:
                targets = json.load(r)
            pages = [t for t in targets if t.get("type") == "page" and t.get("url", "").startswith("about:blank")]
            if pages:
                ws = pages[0]["webSocketDebuggerUrl"]
                break
        except Exception:
            pass
        time.sleep(0.2)
    if not ws:
        proc.kill()
        raise RuntimeError("no page target")
    return proc, Cdp(ws)


def centre(cdp, sel):
    r = cdp.eval(f"(function(){{var e=document.querySelector({json.dumps(sel)});if(!e)return null;e.scrollIntoView({{block:'nearest'}});var b=e.getBoundingClientRect();return {{x:b.left+b.width/2,y:b.top+b.height/2}};}})()")
    return r


def mouse(cdp, kind, x, y, buttons=0, click=0):
    p = {"type": kind, "x": x, "y": y, "buttons": buttons}
    if kind in ("mousePressed", "mouseReleased"):
        p.update({"button": "left", "clickCount": click or 1})
    cdp.call("Input.dispatchMouseEvent", p)


def run_steps(cdp, steps, rec):
    for st in steps:
        if "wait" in st:
            time.sleep(st["wait"])
        elif "eval" in st:
            try:
                v = cdp.eval(st["eval"])
            except Exception as e:
                v = {"error": str(e)}
            if st.get("as"):
                rec["steps"][st["as"]] = v
        elif "realclick" in st:
            c = centre(cdp, st["realclick"])
            if not c:
                rec["steps"].setdefault("_missing", []).append(st["realclick"])
                continue
            mouse(cdp, "mouseMoved", c["x"], c["y"])
            time.sleep(0.05)
            mouse(cdp, "mousePressed", c["x"], c["y"], 1, 1)
            time.sleep(0.05)
            mouse(cdp, "mouseReleased", c["x"], c["y"], 0, 1)
            time.sleep(0.1)
        elif "key" in st:
            # A real key press on whatever has focus (keyDown + keyUp).
            k = st["key"]
            vk = {"ArrowDown": 40, "ArrowUp": 38, "Enter": 13, "Escape": 27}.get(k, 0)
            for kind in ("rawKeyDown", "keyUp"):
                cdp.call("Input.dispatchKeyEvent", {"type": kind, "key": k, "code": k, "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk})
            time.sleep(0.1)
        elif "hover" in st:
            c = centre(cdp, st["hover"])
            if not c:
                rec["steps"].setdefault("_missing", []).append(st["hover"])
                continue
            mouse(cdp, "mouseMoved", c["x"] - 3, c["y"] - 1)
            time.sleep(0.05)
            mouse(cdp, "mouseMoved", c["x"], c["y"])
        elif "shot" in st:
            sel = st.get("clip", "#auditor-tab")
            if st.get("rect"):
                x0, y0, w0, h0 = st["rect"]
                img = cdp.call("Page.captureScreenshot", {"format": "png", "clip": {"x": x0, "y": y0, "width": w0, "height": h0, "scale": 1}, "captureBeyondViewport": False})
                os.makedirs(os.path.dirname(os.path.abspath(st["shot"])), exist_ok=True)
                with open(st["shot"], "wb") as f:
                    f.write(base64.b64decode(img["data"]))
                rec.setdefault("shots", []).append(st["shot"])
                continue
            rect = cdp.eval(f"(function(){{var e=document.querySelector({json.dumps(sel)});var b=e.getBoundingClientRect();return {{x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}};}})()")
            pad = st.get("pad", 8)
            extra = st.get("extra", 0)
            clip = {"x": max(0, rect["x"] - pad), "y": max(0, rect["y"] - pad), "width": rect["w"] + 2 * pad, "height": rect["h"] + 2 * pad + extra, "scale": 1}
            img = cdp.call("Page.captureScreenshot", {"format": "png", "clip": clip, "captureBeyondViewport": st.get("beyond", True)})
            os.makedirs(os.path.dirname(os.path.abspath(st["shot"])), exist_ok=True)
            with open(st["shot"], "wb") as f:
                f.write(base64.b64decode(img["data"]))
            rec.setdefault("shots", []).append(st["shot"])


def main():
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    vp = jobs.get("viewport", [2400, 1100])
    proc, cdp = launch(vp)
    results = []
    try:
        cdp.call("Page.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": vp[0], "height": vp[1], "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Emulation.setFocusEmulationEnabled", {"enabled": True})
        for case in jobs["cases"]:
            url = jobs["base"] + "?" + case["query"]
            cdp.call("Page.navigate", {"url": url})
            done = False
            for _ in range(200):
                time.sleep(0.1)
                try:
                    if cdp.eval("window.__voDone === true"):
                        done = True
                        break
                except Exception:
                    pass
            val = cdp.eval("window.__vo") if done else {"error": "timeout"}
            rec = {"name": case["name"], "query": case["query"], "result": val, "steps": {}}
            if done and isinstance(val, dict) and not val.get("error"):
                try:
                    run_steps(cdp, case.get("steps", []), rec)
                except Exception as e:
                    rec["steps"]["_error"] = str(e)
            results.append(rec)
            print(case["name"], "ok" if done else "TIMEOUT", flush=True)
    finally:
        try:
            cdp.call("Browser.close", timeout=5)
        except Exception:
            pass
        time.sleep(0.5)
        try:
            proc.kill()
        except Exception:
            pass
    json.dump(results, open(sys.argv[2], "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
