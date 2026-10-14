"""Headless Edge over CDP: render harness pages, collect window.__vo, optional PNG.

usage: py -3 cdp.py jobs.json results.json
jobs.json = {"base": "file:///C:/.../vo.html", "viewport": [1900, 1000],
             "cases": [{"name": "...", "query": "src=orig&theme=...", "shot": "out/x.png"}]}
A case with "hover": true gets a trusted mouse pass once the page is done: the page's
window.__hoverPlan says how many steps; setup(i) returns the targets ({x, y} centres),
the mouse moves onto each, read(target) reports it, and finish(readings, error)
returns the page's final result.
The throwaway Edge profile (a pnbedge_sb_* dir in %TEMP%) is removed once the browser is gone.
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request, base64, random
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


def drop_profile(prof):
    # Edge's helper processes can hold profile files for a moment after the browser exits.
    for _ in range(20):
        shutil.rmtree(prof, ignore_errors=True)
        if not os.path.exists(prof):
            return
        time.sleep(0.25)


def launch(viewport):
    port = random.randint(9400, 9800)
    prof = tempfile.mkdtemp(prefix="pnbedge_sb_")
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
        drop_profile(prof)
        raise RuntimeError("no page target")
    return proc, Cdp(ws), prof


def main():
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    vp = jobs.get("viewport", [1900, 1000])
    proc, cdp, prof = launch(vp)
    results = []
    try:
        cdp.call("Page.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": vp[0], "height": vp[1], "deviceScaleFactor": 1, "mobile": False})
        for case in jobs["cases"]:
            url = jobs["base"] + "?" + case["query"]
            cdp.call("Page.navigate", {"url": url})
            done = False
            for _ in range(150):
                time.sleep(0.1)
                try:
                    if cdp.eval("window.__voDone === true"):
                        done = True
                        break
                except Exception:
                    pass
            val = cdp.eval("window.__vo") if done else {"error": "timeout"}
            if done and case.get("hover"):
                readings, err = [], None
                try:
                    for i in range(int(cdp.eval("window.__hoverPlan.n"))):
                        for t in cdp.eval(f"window.__hoverPlan.setup({i})"):
                            cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": t["x"], "y": t["y"], "button": "none"})
                            readings.append(cdp.eval(f"window.__hoverPlan.read({json.dumps(t)})"))
                except Exception as e:
                    err = str(e)[:300]
                try:
                    val = cdp.eval(f"window.__hoverPlan.finish({json.dumps(readings)}, {json.dumps(err)})")
                except Exception:
                    pass   # the page's own pending hover assert stays FAIL
            if case.get("eval"):
                try:
                    val = {"base": val, "extra": cdp.eval(case["eval"])}
                except Exception as e:
                    val = {"base": val, "extra_error": str(e)}
            rec = {"name": case["name"], "query": case["query"], "result": val}
            shot = case.get("shot")
            if shot and done and isinstance(val, dict):
                sel = case.get("clip", "#view-options-tab")
                rect = cdp.eval(f"(function(){{var e=document.querySelector({json.dumps(sel)});var b=e.getBoundingClientRect();return {{x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}};}})()")
                pad = case.get("pad", 8)
                clip = {"x": max(0, rect["x"] - pad), "y": max(0, rect["y"] - pad), "width": rect["w"] + 2 * pad, "height": rect["h"] + 2 * pad, "scale": 1}
                img = cdp.call("Page.captureScreenshot", {"format": "png", "clip": clip, "captureBeyondViewport": True})
                os.makedirs(os.path.dirname(os.path.abspath(shot)), exist_ok=True)
                with open(shot, "wb") as f:
                    f.write(base64.b64decode(img["data"]))
                rec["shot"] = shot
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
            proc.wait(timeout=10)
        except Exception:
            pass
        drop_profile(prof)
    json.dump(results, open(sys.argv[2], "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
