"""penumbra_tests/railfade - the floating button strip fades while it covers table text.

Guards js/penumbra_railfade.js + css/penumbra_railfade.css (railfade, 2026-11-23):
the strip (#floating-button-container) gets .pnb-rail-yield while it sits over
TEXT in a table cell, a grouped view's heading row or a card - not over a cell's
blank end, the page background, or while hidden / dragged / under a dialog - and
the CSS brings it back to full strength on hover, focus and drag.

    py -3 -I test_railfade.py [--app=<dir>] [--no-mutants] [--control]

--app: a stage dir holding js/penumbra_railfade.js and css/penumbra_railfade.css
(default: the live app). JS side: headless Edge --dump-dom on a file:// harness
under C:\\Temp\\railfade_<pid> (no spaces in any path), with --virtual-time-budget
so the module's own timers (MutationObserver -> check) run before the dump. A
control page proves the dump capture works before anything is judged.

TARGETED MUTANTS of the module are each run and must each be caught (every anchor
must hit exactly once). There is no OLD-build arm: before railfade the file did not
exist, so every check fails trivially. --control adds one false assertion (must FAIL).

EXPECTED TAIL: "PASS 39   FAIL 0" (fewer passes is a failure too; about 30 s,
nearly all of it Edge start-ups).
"""
import json, os, re, shutil, subprocess, sys, time

LIVE = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
APP = LIVE
for a in sys.argv[1:]:
    if a.startswith('--app='):
        APP = a[6:]
NO_MUT = '--no-mutants' in sys.argv
CONTROL = '--control' in sys.argv
WORK = r'C:\Temp\railfade_%d' % os.getpid()

PASS = 0
FAIL = 0
FAILED = []


def ok(cond, label, quiet=False):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        FAILED.append(label)
        if not quiet:
            print('    FAIL  ' + label)


def pick(rel):
    for base in (APP, LIVE):
        p = os.path.join(base, rel)
        if os.path.isfile(p):
            return p
    sys.stderr.write('FATAL: cannot find %s under %s or %s\n' % (rel, APP, LIVE))
    sys.exit(2)


def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def edge_dump(html_path, query=''):
    """Dump the DOM of a file:// page. Edge's launcher exits at once and the browser
    child writes to an inherited handle, so (as in railvh) PowerShell Start-Process
    redirects it to a FILE, read once it stops growing."""
    url = 'file:///' + html_path.replace('\\', '/') + query
    out = os.path.join(os.path.dirname(html_path), 'dom.txt')
    err = os.path.join(os.path.dirname(html_path), 'edge.err')
    prof = os.path.join(os.path.dirname(html_path), 'prof')
    try:
        os.remove(out)
    except OSError:
        pass
    args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
            '--disable-sync', '--disable-extensions', '--allow-file-access-from-files', '--hide-scrollbars',
            '--window-size=1200,800', '--virtual-time-budget=8000',
            '--user-data-dir=' + prof, '--dump-dom', url]
    cmd = ("Start-Process -FilePath '" + EDGE + "' -Wait -NoNewWindow -RedirectStandardOutput " + out +
           " -RedirectStandardError " + err + " -ArgumentList '" + "','".join(args) + "'")
    subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', cmd], cwd=r'C:\Temp')
    last, stable = -1, 0
    for _ in range(100):
        size = os.path.getsize(out) if os.path.isfile(out) else 0
        if size > 0 and size == last:
            stable += 1
            if stable >= 2:
                break
        else:
            stable = 0
        last = size
        time.sleep(0.2)
    return read(out) if os.path.isfile(out) else ''


HARNESS = r"""<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="penumbra_railfade.css">
<style>
  /* the harness reads computed opacity at once: no fade in between */
  #floating-button-container { transition: none !important; }
  html, body { margin: 0; padding: 0; font: 14px/20px Arial, sans-serif; overflow: hidden; }
  .area { position: absolute; }
  table { border-collapse: collapse; table-layout: fixed; }
  td, th { padding: 0 4px; height: 30px; white-space: nowrap; overflow: hidden; text-align: left; }
  #floating-button-container { position: fixed; width: 52px; height: 60px; z-index: 9997; visibility: visible; }
  #floating-button-container button { display: block; width: 38px; height: 38px; margin: 11px 7px; }
</style></head>
<body>
<div class="area" style="left:0;top:0"><table id="tA"><colgroup><col style="width:300px"></colgroup>
  <tr><td>alice.anderson@example.edu</td></tr><tr><td>bob.brown@example.edu</td></tr>
  <tr><td>carol.chen@example.edu</td></tr><tr><td>dan.diaz@example.edu</td></tr></table></div>
<div class="area" style="left:0;top:250px"><table id="tB"><colgroup><col style="width:400px"></colgroup>
  <tr><td>ab</td></tr><tr><td>cd</td></tr><tr><td>ef</td></tr><tr><td>  </td></tr></table></div>
<div class="area" style="left:700px;top:0"><table id="tD"><colgroup><col style="width:300px"></colgroup>
  <thead><tr><th style="height:90px">Principal investigator email address</th></tr></thead></table></div>
<div class="area group-header" id="gh" style="left:700px;top:250px;width:300px;height:90px">Department of Chemistry &mdash; Distinct of NAME: 12</div>
<div class="area pnb-card" id="card" style="left:700px;top:450px;width:300px;height:90px">Card title text that runs long enough</div>
<div class="area" id="dlg" style="left:0;top:450px;width:400px;height:200px;z-index:10000;background:#fff">
  <table><colgroup><col style="width:380px"></colgroup><tr><td>dialog row text that is long enough</td></tr></table></div>
<div id="floating-button-container" class="pnb-rail" style="left:1100px;top:700px"><button type="button">x</button></div>
<pre id="out">PENDING</pre>
<script>window.__errs = []; window.onerror = function (m) { window.__errs.push(String(m)); };</script>
<script src="penumbra_railfade.js"></script>
<script>
(function () {
  var R = {}, rail = document.getElementById('floating-button-container');
  var RF = (window.Penumbra && window.Penumbra.railFade) || null;
  function at(l, t) { rail.style.left = l + 'px'; rail.style.top = t + 'px'; }
  function op() { return getComputedStyle(rail).opacity; }
  function probe(name, l, t) {
    at(l, t);
    var v = RF ? RF.check() : null;
    R[name] = { faded: v, cls: rail.classList.contains('pnb-rail-yield'), op: op() };
  }
  R.api = !!RF;
  R.off = /railfade=off/.test(location.search);
  probe('cellText', 20, 20);          // over the email text of table A
  probe('cellBlank', 250, 260);       // over the blank end of table B's 400px cells (text "ab")
  probe('background', 500, 300);      // page background, no table
  probe('th', 760, 15);               // over a heading cell's text
  probe('groupHeader', 760, 245);     // a grouped view's heading row
  probe('card', 760, 445);            // a card
  probe('underDialog', 20, 452);      // a dialog drawn over the strip (and over a table)
  // hidden / dragged strips never fade, even over text
  at(20, 20); rail.classList.add('pnb-rail-empty'); R.empty = RF ? RF.check() : null; rail.classList.remove('pnb-rail-empty');
  rail.classList.add('pnb-dragging'); R.dragging = RF ? RF.check() : null; rail.classList.remove('pnb-dragging');
  R.backOver = RF ? RF.check() : null;
  // the CSS: faded value, and full strength on hover / focus / drag
  var rules = [];
  for (var s of document.styleSheets) { try { for (var r of s.cssRules) { if (r.selectorText) rules.push([r.selectorText, r.style.opacity]); } } catch (e) {} }
  function has(sel, val) { return rules.some(function (x) { return x[0].indexOf(sel) >= 0 && x[1] === val; }); }
  R.css = { faded: has('.pnb-rail-yield', '0.22'), hover: has('.pnb-rail-yield:hover', '1'), focus: has('.pnb-rail-yield:focus-within', '1'), drag: has('.pnb-rail-yield.pnb-dragging', '1') };
  rail.focus && rail.querySelector('button').focus();
  R.focusOp = op();
  rail.querySelector('button').blur();
  // its own triggers: once the load-time checks are over (load + LATE_MS), move the strip off
  // the text (no check() call) and let the timers run - only the strip's observer sees a move
  setTimeout(function () {
   at(500, 300);
   setTimeout(function () {
    R.asyncOff = rail.classList.contains('pnb-rail-yield');
    at(20, 20);
    setTimeout(function () {
      R.asyncOn = rail.classList.contains('pnb-rail-yield');
      R.errs = window.__errs.slice();
      document.getElementById('out').textContent = 'RESULT ' + JSON.stringify(R);
    }, 600);
   }, 600);
  }, 2500);
})();
</script>
</body></html>
"""


def run(js_src, css_src, query=''):
    if os.path.isdir(WORK):
        shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    with open(os.path.join(WORK, 'penumbra_railfade.js'), 'w', encoding='utf-8', newline='') as f:
        f.write(js_src)
    with open(os.path.join(WORK, 'penumbra_railfade.css'), 'w', encoding='utf-8', newline='') as f:
        f.write(css_src)
    h = os.path.join(WORK, 'harness.html')
    with open(h, 'w', encoding='utf-8', newline='') as f:
        f.write(HARNESS)
    dom = edge_dump(h, query)
    m = re.search(r'RESULT (\{.*?\})</pre>', dom, re.S)
    if not m:
        return None
    return json.loads(m.group(1).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"'))


def checks(R):
    """Every check as (label, bool)."""
    if R is None:
        return [('harness produced a RESULT', False)]
    g = lambda k: R.get(k) or {}
    return [
        ('module exposes Penumbra.railFade', R.get('api') is True),
        ('no page errors', R.get('errs') == []),
        ('over cell text: faded', g('cellText').get('faded') is True),
        ('over cell text: class on', g('cellText').get('cls') is True),
        ('over cell text: opacity 0.22', g('cellText').get('op') == '0.22'),
        ("over a cell's blank end: solid", g('cellBlank').get('faded') is False),
        ("over a cell's blank end: class off", g('cellBlank').get('cls') is False),
        ("over a cell's blank end: opacity 1", g('cellBlank').get('op') == '1'),
        ('over the page background: solid', g('background').get('faded') is False),
        ('over a heading cell: faded', g('th').get('faded') is True),
        ('over a group heading: faded', g('groupHeader').get('faded') is True),
        ('over a card: faded', g('card').get('faded') is True),
        ('under a dialog: solid', g('underDialog').get('faded') is False),
        ('hidden strip (pnb-rail-empty): solid', R.get('empty') is False),
        ('dragged strip: solid', R.get('dragging') is False),
        ('back over text after both: faded', R.get('backOver') is True),
        ('CSS: faded strip at 0.22', (R.get('css') or {}).get('faded') is True),
        ('CSS: full strength on hover', (R.get('css') or {}).get('hover') is True),
        ('CSS: full strength on focus', (R.get('css') or {}).get('focus') is True),
        ('CSS: full strength while dragged', (R.get('css') or {}).get('drag') is True),
        ('a focused button: opacity 1', R.get('focusOp') == '1'),
        ('own trigger: moved off text, fades back in', R.get('asyncOff') is False),
        ('own trigger: moved onto text, fades', R.get('asyncOn') is True),
    ]


# (label, file 'js'|'css', anchor, replacement, a check that must fail)
MUTANTS = [
    ('text-anywhere', 'js', "                if (rs[j].width > 0 && rs[j].height > 0 && clip(rs[j], area)) { return true; }",
     "                return true;", "over a cell's blank end: solid"),
    ('ignore-hidden', 'js', "        if (rail.classList.contains('pnb-rail-empty') || rail.classList.contains('pnb-dragging')) { return false; }",
     "", 'hidden strip (pnb-rail-empty): solid'),
    ('not-topmost', 'js', "        if (!st.length || !rail.contains(st[0])) { return null; }",
     "        if (!st.length) { return null; } for (var q = 0; q < st.length; q++) { if (!rail.contains(st[q])) { return st[q]; } }",
     'under a dialog: solid'),
    ('cells-only', 'js', "    var UNIT = 'td, th, .group-header, .pnb-card';", "    var UNIT = 'td, th';", 'over a group heading: faded'),
    ('no-strip-observer', 'js', "        new MutationObserver(soon).observe(rail, { attributes: true, attributeFilter: ['class', 'style'] });",
     "", 'own trigger: moved off text, fades back in'),
    ('no-hover', 'css', "#floating-button-container.pnb-rail-yield:hover,\n", "", 'CSS: full strength on hover'),
    ('no-focus', 'css', "#floating-button-container.pnb-rail-yield:focus-within,\n", "", 'a focused button: opacity 1'),
]


def main():
    js_src = read(pick(r'js\penumbra_railfade.js'))
    css_src = read(pick(r'css\penumbra_railfade.css'))
    print('railfade suite (' + APP + ')')
    os.makedirs(WORK, exist_ok=True)
    ctl = os.path.join(WORK, 'control.html')
    with open(ctl, 'w', encoding='utf-8') as f:
        f.write('<!doctype html><html><body><pre id="out">CTRL_OK</pre></body></html>')
    if 'CTRL_OK' not in edge_dump(ctl):
        sys.stderr.write('FATAL: headless Edge --dump-dom returned nothing for the control page (capture broken, not the code under test)\n')
        sys.exit(2)

    R = run(js_src, css_src)
    for label, good in checks(R):
        ok(good, label)
    # &railfade=off: the module does nothing (no API, never fades)
    Roff = run(js_src, css_src, '?railfade=off')
    ok(Roff is not None and Roff.get('off') is True and Roff.get('api') is False, '&railfade=off: no module')
    ok(Roff is not None and Roff.get('asyncOn') is False, '&railfade=off: never fades')

    if not NO_MUT:
        print('mutants')
        for label, which, anchor, repl, must in MUTANTS:
            src = js_src if which == 'js' else css_src
            hits = src.count(anchor)
            ok(hits == 1, 'mutant %s: anchor hits exactly once (hits=%d)' % (label, hits))
            if hits != 1:
                continue
            mut = src.replace(anchor, repl)
            Rm = run(mut if which == 'js' else js_src, mut if which == 'css' else css_src)
            failed = [l for l, good in checks(Rm) if not good]
            ok(must in failed, 'mutant %s: caught by "%s" (failed: %s)' % (label, must, ', '.join(failed) or 'NOTHING'))

    if CONTROL:
        ok(False, 'CONTROL: deliberately false (must FAIL)')
    shutil.rmtree(WORK, ignore_errors=True)
    print('PASS %d   FAIL %d' % (PASS, FAIL))
    if FAILED:
        print('failed: ' + ', '.join(FAILED))
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
