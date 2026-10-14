"""Headless Edge over CDP for the ownerview suite: load ov.html once per case,
collect window.__vo. (searchbar/cdp.py's shape, plus the cache rule: Network.enable
+ Network.setCacheDisabled before EVERY navigate.)

usage: py -3 cdp.py jobs.json results.json
jobs.json = {"base": "file:///C:/.../ov.html", "cases": [{"name": "...", "query": "case=...&id=r1"}]}
"""
import json, os, random, shutil, subprocess, sys, tempfile, time, urllib.request
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


def launch():
    port = random.randint(9400, 9800)
    prof = tempfile.mkdtemp(prefix="pnbedge_ov_")
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
            "--no-default-browser-check", "--disable-sync", "--disable-extensions",
            "--allow-file-access-from-files", "--window-size=1400,900",
            f"--user-data-dir={prof}", f"--remote-debugging-port={port}", "--remote-allow-origins=*", "about:blank"]
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
    return proc, Cdp(ws), prof


def main():
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    proc, cdp, prof = launch()
    results = []
    try:
        cdp.call("Page.enable")
        for case in jobs["cases"]:
            url = jobs["base"] + "?" + case["query"]
            cdp.call("Network.enable")
            cdp.call("Network.setCacheDisabled", {"cacheDisabled": True})
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
            results.append({"name": case["name"], "query": case["query"], "result": val})
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
        # Our own profile only: the mkdtemp leaf this run created.
        if os.path.basename(prof).startswith("pnbedge_ov_"):
            shutil.rmtree(prof, ignore_errors=True)
    json.dump(results, open(sys.argv[2], "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
