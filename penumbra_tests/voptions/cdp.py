"""View Options layout suite (2026-09-25) - the browser driver.

Headless Edge over CDP (a real layout engine and real input events, which
--dump-dom cannot give): loads vo.html once per case, collects the page's
window.__vo, and for phase=input drives REAL mouse clicks and a real Space key
through Input.dispatch*Event, adding R1 / R2 / R4 to that case's asserts.

usage: py -3 cdp.py jobs.json results.json
jobs.json = {"base": "file:///.../vo.html", "viewport": [2400, 1000],
             "cases": [{"name": "...", "query": "phase=wide&w=1677", "shot": "x.png"?}]}
"""
import base64, json, os, random, subprocess, sys, tempfile, time, urllib.request
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

    def click(self, x, y):
        self.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        self.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1})
        self.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "buttons": 0, "clickCount": 1})
        time.sleep(0.05)

    def space(self):
        base = {"key": " ", "code": "Space", "windowsVirtualKeyCode": 32, "nativeVirtualKeyCode": 32}
        self.call("Input.dispatchKeyEvent", dict(base, type="keyDown", text=" "))
        self.call("Input.dispatchKeyEvent", dict(base, type="keyUp"))
        time.sleep(0.05)


def launch(viewport):
    port = random.randint(9400, 9800)
    prof = tempfile.mkdtemp(prefix="pnbedge_vopt_")
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
            "--no-default-browser-check", "--disable-sync", "--disable-extensions",
            "--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1",
            f"--user-data-dir={prof}", f"--window-size={viewport[0]},{viewport[1]}",
            f"--remote-debugging-port={port}", "--remote-allow-origins=*", "about:blank"]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws = None
    for _ in range(150):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=2) as r:
                targets = json.load(r)
            # Org policy can add extension / sync pages to a fresh profile: pick OUR tab by URL.
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


def T(asserts, aid, name, ok, detail=""):
    asserts.append({"id": aid, "name": name, "pass": bool(ok), "detail": str(detail)})


def input_phase(cdp, val):
    a = val.setdefault("asserts", [])
    t = val.get("targets") or {}
    if not t:
        T(a, "R1", "a real click on the Bare Header card toggles its box", False, "no targets")
        return
    box = "document.getElementById('viewOptionBareHeader')"
    sm, st = t["small"], t["strong"]
    cdp.click(sm["x"] + sm["w"] / 2, sm["y"] + sm["h"] / 2)
    on = cdp.eval(box + ".checked")
    cdp.click(st["x"] + min(20, st["w"] / 2), st["y"] + st["h"] / 2)
    off = cdp.eval(box + ".checked")
    changes = cdp.eval("window.__voChanges")
    T(a, "R1", "a real click on the Bare Header DESCRIPTION ticks it and one on its TITLE unticks it (2 change events)",
      on is True and off is False and changes == 2, f"afterDesc={on} afterTitle={off} changes={changes}")
    cdp.eval(box + ".focus()")
    cdp.space()
    kb = cdp.eval(box + ".checked")
    focused = cdp.eval("document.activeElement && document.activeElement.id")
    T(a, "R2", "Space on the focused box ticks it (keyboard path intact)", kb is True and focused == "viewOptionBareHeader",
      f"checked={kb} focused={focused}")
    # The name a screen reader announces, from the browser's own accessibility
    # tree: .view-option-text is display:contents, which must not drop the
    # label's text from it.
    try:
        doc = cdp.call("DOM.getDocument", {"depth": 0})
        nid = cdp.call("DOM.querySelector", {"nodeId": doc["root"]["nodeId"], "selector": "#viewOptionBareHeader"})["nodeId"]
        node = cdp.call("Accessibility.getPartialAXTree", {"nodeId": nid, "fetchRelatives": False})["nodes"][0]
        role = (node.get("role") or {}).get("value", "")
        name = (node.get("name") or {}).get("value", "")
    except Exception as e:
        role, name = "", f"error: {e}"[:200]
    T(a, "R5", "the accessibility tree names the box by its whole card (role checkbox, title + description)",
      role == "checkbox" and name.startswith("Bare Header") and "Applies to everyone" in name, f"role={role} name={name}")
    pg = "document.getElementById('viewOptionPagination')"
    before = cdp.eval(pg + ".checked")
    p2 = t["pagTitle2"]
    cdp.click(p2["x"], p2["y"])
    after = cdp.eval(pg + ".checked")
    T(a, "R4", "a click on the SECOND line of a wrapped title (Pagination Controls) toggles its box",
      before is True and after is False, f"before={before} after={after} at={p2}")


def main():
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    vp = jobs.get("viewport", [2400, 1000])
    proc, cdp = launch(vp)
    results = []
    try:
        cdp.call("Page.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": vp[0], "height": vp[1], "deviceScaleFactor": 1, "mobile": False})
        for case in jobs["cases"]:
            cdp.call("Page.navigate", {"url": jobs["base"] + "?" + case["query"]})
            done = False
            for _ in range(200):
                time.sleep(0.1)
                try:
                    if cdp.eval("window.__voDone === true"):
                        done = True
                        break
                except Exception:
                    pass
            val = cdp.eval("window.__vo") if done else {"asserts": [{"id": "Z9", "name": "the page finished", "pass": False, "detail": "timeout"}]}
            if done and "phase=input" in case["query"]:
                try:
                    input_phase(cdp, val)
                except Exception as e:
                    val.setdefault("asserts", []).append({"id": "R0", "name": "the input phase ran", "pass": False, "detail": str(e)[:300]})
            rec = {"name": case["name"], "query": case["query"], "result": val}
            shot = case.get("shot")
            if shot and done:
                rect = cdp.eval("(function(){var b=document.getElementById('view-options-tab').getBoundingClientRect();return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height};})()")
                clip = {"x": max(0, rect["x"] - 8), "y": max(0, rect["y"] - 8), "width": rect["w"] + 16, "height": rect["h"] + 16, "scale": 1}
                img = cdp.call("Page.captureScreenshot", {"format": "png", "clip": clip, "captureBeyondViewport": True})
                os.makedirs(os.path.dirname(os.path.abspath(shot)), exist_ok=True)
                with open(shot, "wb") as f:
                    f.write(base64.b64decode(img["data"]))
            results.append(rec)
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
