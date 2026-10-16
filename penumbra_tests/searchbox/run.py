# =============================================================================
# SEARCH BOX SUITE (2026-10-06): the report search bar and the scheduler's
# Search Filter as ONE field with flat segments (the dashboard filter box's
# look), the "/" badge gone (its "/" is named in the placeholder - that part is
# the singlekeytips suite's: L1 L2 B* S3 O1 boot the real main.js), and the
# column ARROW at the right edge: the list of every column, as a double-click
# into the empty box shows it; a pick adds `and COLUMN ` after what is typed.
# (The dashboard box's arrow: dashsearch builder.html section A1b.)
#
#   static   S1 index.php: both boxes are .pnb-sbox with an arrow, no "/" badge
#            S2 main.css: the .pnb-sbox block, no #tableSearchKey rule left
#            S3 help_content.php: the arrow and Alt+Down in the search help
#   look     sbox.html (index.php markup LIFTED, the css under test), EVERY
#            registry theme x standard / compact / easy-read, empty and with
#            text, both boxes: K1 the arrow (role, name, Alt+Down title, right
#            edge) K2 every segment spans the field's inner height K3 flat
#            segments with hairline dividers K4 no text under a segment K5 run +
#            clear only with text, order cols / clear / run from the edge K6 the
#            field keeps the theme's fill and boundary K7 glyphs in --text-muted
#            K8 a REAL hover colours a segment K9 REAL focus: brand border + glow
#   behave   the REAL search_builder.js over a stub API, REAL mouse and keys
#            (CDP): A the arrow lists every column (+ saved searches on the
#            report box) and focuses the box  B a second click closes it, the
#            focus never leaves the box  C a pick in the empty box = COL + its
#            values  D with text: still every column; a pick appends
#            "and COL "; a value completes it  E after a trailing "or", no extra
#            "and"  F Alt+Down = the arrow, first item highlighted; Enter picks
#            (a saved search replaces the box and runs)  G typing afterwards is
#            the ordinary type-ahead again
#   colvals  (2026-10-13) the box ENDS with a column: the arrow lists THAT
#            column's values (as Ctrl+Space after the name). H the arrow stays
#            at the edge for it, clear beside it, its title names the column
#            H2 a value after it: the arrow gives way again  V0 typed text that
#            ends with a column shows the arrow  V1 a click = its values, a
#            space after the name  V2 a value completes it  V3 Alt+Down, any
#            case  V4 a SELECTION gets the columns, the pick replaces it
#
#   py -3 run.py                    the live files          EXPECTED: GREEN
#   py -3 run.py --control          the .bak-20261006-searchbox files (pre-feature): RED
#   py -3 run.py --stage <dir>      a flat stage folder (index.php main.css density.css
#                                   search_builder.css search_builder.js help_content.php;
#                                   each one missing there comes from the app)
#   py -3 run.py --mutant <name> / --mutants   (anchors are checked first)
# Run it from its own folder (Git Bash mangles a \\server\d$ path argument):
#   cd '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\searchbox' ; py -3 run.py
# Needs py -3 + websocket-client and the PHP 8.2 CLI (themes). Stages into %TEMP%;
# writes nothing to the webroot.
# =============================================================================
import argparse, base64, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
STAMP = '20261006-searchbox'
FILES = {'index': 'index.php', 'css': r'css\main.css', 'density': r'css\density.css', 'sbcss': r'css\search_builder.css',
         'sb': r'js\search_builder.js', 'help': 'help_content.php'}
CR = '\r\n'

# name: (file, old, new, asserts that MUST go red). Each old must occur exactly once in the FEATURE build.
MUTANTS = {
    'segabs':    ('css', '.pnb-sbox > .pnb-sbox-seg {' + CR + '    position: absolute;', '.pnb-sbox > .pnb-sbox-seg {' + CR + '    position: static;', ['K2', 'K4']),
    'segheight': ('css', '    bottom: 1px;                 /* the field\'s full height, inside its 1px border */' + CR, '', ['K2']),
    'segflat':   ('css', '    background: transparent;' + CR + '    color: var(--text-muted, #777);' + CR + '    font-family: var(--report-font, sans-serif);',
                  '    background: var(--bg-surface-alt, #eee);' + CR + '    color: var(--text-muted, #777);' + CR + '    font-family: var(--report-font, sans-serif);', ['K3']),
    'padright':  ('css', '.pnb-sbox.has-text > #schedSearchFilter {' + CR + '    padding-right: 57px !important;', '.pnb-sbox.has-text > #schedSearchFilter {' + CR + '    padding-right: 31px !important;', ['K4']),
    'textonly':  ('css', '.pnb-sbox > .pnb-sbox-seg.search-clear {' + CR + '    right: 1px;' + CR + '    display: none;', '.pnb-sbox > .pnb-sbox-seg.search-clear {' + CR + '    right: 1px;', ['K5']),
    'colsstay':  ('css', '.pnb-sbox.has-text > .pnb-sbox-seg.pnb-sbox-cols {' + CR + '    display: none;', '.pnb-sbox.has-text > .pnb-sbox-seg.pnb-sbox-cols {' + CR + '    display: flex;', ['K1', 'K5', 'H2']),
    'sbplain':   ('css', '    border-radius: 4px 0 0 4px;' + CR + '    background: color-mix(in srgb, var(--brand-primary, #336699) 10%, transparent);' + CR + '    color: var(--brand-text, var(--brand-primary, #336699));',
                  '    border-radius: 4px 0 0 4px;', ['K10']),
    'fillgone':  ('css', '.pnb-sbox > #schedSearchFilter {' + CR + '    width: 100%;', '.pnb-sbox > #schedSearchFilter {' + CR + '    background: transparent !important;' + CR + '    width: 100%;', ['K6']),
    'nohover':   ('css', '.pnb-sbox > .pnb-sbox-seg:hover {' + CR + '    color: var(--brand-text, var(--brand-primary, #336699));', '.pnb-sbox > .pnb-sbox-seg:hover {' + CR + '    color: var(--text-muted, #777);', ['K8']),
    'noglow':    ('css', '    border-color: var(--brand-primary, #336699) !important;' + CR + '    box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary, #336699) 25%, transparent);' + CR + '}',
                  '}', ['K9']),
    'nocols':    ('index', '                <span class="pnb-sbox-seg pnb-sbox-cols" id="tableSearchCols"', '                <span class="pnb-sbox-seg" id="tableSearchColsGone"', ['S1', 'K1']),
    'allmode':   ('sb', '                var allMode = _acAllAsked;', '                var allMode = false;', ['D1']),
    'appendoff': ('sb', '                if (_acAllShown && ui.item) {', '                if (false) {', ['D2']),
    'orjoin':    ('sb', "(/(?:^|\\s)(?:and|or)$/i.test(baseA)", "(/(?:^|\\s)(?:and)$/i.test(baseA)", ['E1']),
    'toggle':    ('sb', "        $(this).data('pnbWasOpen', columnListOpen($in));", "        $(this).data('pnbWasOpen', false);", ['B1']),
    'mdblur':    ('sb', "        if (e.button !== 0) return;" + CR + "        e.preventDefault();", "        if (e.button !== 0) return;", ['B3']),
    'altstop':   ('sb', '                event.preventDefault();' + CR + '                event.stopImmediatePropagation();' + CR + '                _openColumnList();',
                  '                event.preventDefault();' + CR + '                _openColumnList();', ['F2']),
    'althelp':   ('help', 'or <code>Alt+Down</code></td>', 'or <code>Alt+Up</code></td>', ['S3']),
    # colvals (2026-10-13)
    'valsoff':   ('sb', '            if (_arrowColumn()) {', '            if (false) {', ['V1', 'V3']),
    'valshow':   ('css', '.pnb-sbox.has-text.pnb-sbox-vals > .pnb-sbox-seg.pnb-sbox-cols {' + CR + '    display: flex;',
                  '.pnb-sbox.has-text.pnb-sbox-vals > .pnb-sbox-seg.pnb-sbox-cols {' + CR + '    display: none;', ['H', 'V0']),
    'clearstep': ('css', '.pnb-sbox.has-text.pnb-sbox-vals > .pnb-sbox-seg.search-clear {' + CR + '    right: 27px;',
                  '.pnb-sbox.has-text.pnb-sbox-vals > .pnb-sbox-seg.search-clear {' + CR + '    right: 1px;', ['H']),
    'nospace':   ('sb', "                if (!/\\s$/.test(text)) { text += ' '; $input.val(text); }" + CR, '', ['V1', 'V2']),
    'selrepl':   ('sb', '            if (selS != null && selE != null && selS !== selE) {', '            if (false) {', ['V4']),
    'casefold':  ('sb', ".replace(/^(['\"])(.*)\\1$/, '$2').toUpperCase();", ".replace(/^(['\"])(.*)\\1$/, '$2');", ['V3']),
    'needvals':  ('sb', "                if (!vals || !vals.length) found = '';", "                if (false) found = '';", ['V5']),
    'closekeep': ('sb', "                $input.removeData('sb-smart-sel').removeData('sb-smart-is-col');" + CR + "                _syncArrowMode();", '                _syncArrowMode();', ['V6']),
    # (2026-10-15) the WCAG Moderate pass: tab stops + the named Alt+Down twin
    'notabstop': ('index', 'id="tableSearchCols" role="button" tabindex="0"', 'id="tableSearchCols" role="button"', ['S4']),
    'nokeysc':   ('index', 'aria-label="Search report table" aria-keyshortcuts="Alt+ArrowDown"', 'aria-label="Search report table"', ['S4']),
    'syncoff':   ('sb', "            $acBox.toggleClass('pnb-sbox-vals', !!col);", "            $acBox.toggleClass('pnb-sbox-vals', false);", ['H', 'V0']),
}

R = []
def rec(id_, name, ok, detail=''):
    R.append({'id': id_, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:400]})

def read(p):
    with open(p, 'rb') as f: return f.read().decode('utf-8')

# --------------------------------------------------------------------- CDP
def free(port):
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', port)); s.close(); return r != 0
def pick_port(base):
    for p in range(base, base + 200):
        if free(p): return p
    raise RuntimeError('no free port')

class Page:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=60, suppress_origin=True); self.n = 0
    def call(self, method, **params):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == mid:
                if 'error' in m: raise RuntimeError(method + ': ' + json.dumps(m['error']))
                return m.get('result', {})
    def ev(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True)
        if 'exceptionDetails' in r: raise RuntimeError('JS: ' + json.dumps(r['exceptionDetails'])[:500])
        return r.get('result', {}).get('value')
    def wait(self, expr, ms=8000):
        t0 = time.time()
        while time.time() - t0 < ms / 1000:
            try:
                if self.ev(expr): return True
            except Exception: pass
            time.sleep(0.08)
        return False
    def mouse(self, typ, x, y, buttons=0, count=1):
        self.call('Input.dispatchMouseEvent', type=typ, x=x, y=y, button='left', buttons=buttons, clickCount=count)
    def move(self, x, y): self.mouse('mouseMoved', x, y)
    def click(self, x, y, count=1):
        self.move(x, y); self.mouse('mousePressed', x, y, 1, count); time.sleep(0.03); self.mouse('mouseReleased', x, y, 0, count)
    def key(self, k, code, alt=False):
        mods = 1 if alt else 0
        self.call('Input.dispatchKeyEvent', type='rawKeyDown', key=k, code=k, windowsVirtualKeyCode=code, nativeVirtualKeyCode=code, modifiers=mods)
        self.call('Input.dispatchKeyEvent', type='keyUp', key=k, code=k, windowsVirtualKeyCode=code, nativeVirtualKeyCode=code, modifiers=mods)
    def center(self, sel):
        return self.ev("(function(){var e=document.querySelector(%s); if(!e||!e.getClientRects().length) return null; var b=e.getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2];})()" % json.dumps(sel))

class Browser:
    def __init__(self, root):
        self.hp, self.dp = pick_port(8820), pick_port(9360)
        self.srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(self.hp), '--bind', '127.0.0.1', '--directory', root],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.prof = tempfile.mkdtemp(prefix='pnbedge_sbx_')
        self.edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                                      '--disable-sync', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
                                      '--user-data-dir=' + self.prof, '--window-size=1400,900', '--remote-debugging-port=%d' % self.dp,
                                      '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws = None
        for _ in range(150):
            try:
                for t in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % self.dp)):
                    if t.get('type') == 'page' and t.get('url', '').startswith('about:blank'): ws = t['webSocketDebuggerUrl']
                if ws: break
            except Exception: pass
            time.sleep(0.2)
        if not ws: raise RuntimeError('Edge did not start')
        self.pg = Page(ws)
        self.pg.call('Network.enable'); self.pg.call('Network.setCacheDisabled', cacheDisabled=True)
        self.pg.call('Page.enable'); self.pg.call('Emulation.setFocusEmulationEnabled', enabled=True)
    def load(self):
        self.pg.call('Page.navigate', url='http://127.0.0.1:%d/sbox.html?t=%d' % (self.hp, int(time.time() * 1000)))
        time.sleep(0.2)
        if not self.pg.wait("window.__ready === true || document.title === 'ERROR'", 20000): raise RuntimeError('harness did not load')
        err = self.pg.ev('window.__err || null')
        if err: raise RuntimeError('harness: ' + err)
    def close(self):
        for p in (self.edge, self.srv):
            try: p.kill()
            except Exception: pass
        time.sleep(0.5); shutil.rmtree(self.prof, ignore_errors=True)

# --------------------------------------------------------------------- staging
def stage(files_src, mutant):
    run = tempfile.mkdtemp(prefix='pnb_sbx_')
    os.makedirs(os.path.join(run, 'v'))
    for f in ('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js'): shutil.copy(os.path.join(APP, 'js', f), run)
    for f in ('jquery-ui.css', 'penumbra_tiles.css', 'penumbra_presets.css'): shutil.copy(os.path.join(APP, 'css', f), run)
    shutil.copy(os.path.join(HERE, 'sbox.html'), run)
    out = subprocess.run([PHP, '-n', os.path.join(HERE, 'gen.php'), run, APP], capture_output=True, text=True)
    if 'themes' not in out.stdout: raise RuntimeError('gen.php: ' + out.stdout + out.stderr)
    text = {k: read(p) for k, p in files_src.items()}
    if mutant:
        fk, old, new, _red = MUTANTS[mutant]
        n = text[fk].count(old)
        if n != 1: raise RuntimeError("mutant '%s' anchor found %d times (needs the FEATURE build): %s" % (mutant, n, old[:80]))
        text[fk] = text[fk].replace(old, new)
    names = {'index': 'index.php', 'css': 'main.css', 'density': 'density.css', 'sbcss': 'search_builder.css', 'sb': 'search_builder.js'}
    for k, n in names.items():
        with open(os.path.join(run, 'v', n), 'wb') as f: f.write(text[k].encode('utf-8'))
    return run, text

# --------------------------------------------------------------------- checks
def static_checks(t):
    idx, css, help_ = t['index'], t['css'], t['help']
    has = lambda s: s in idx
    rec('S1', 'index.php: both boxes are .pnb-sbox with a column arrow; the "/" badge is gone',
        has('<span class="search-wrapper pnb-sbox">') and has('<div class="pnb-sbox" style="width: 100%;">') and has('id="tableSearchCols"') and has('id="schedSearchCols"') and 'tableSearchKey' not in idx,
        'arrow=%s/%s badge=%s' % (has('id="tableSearchCols"'), has('id="schedSearchCols"'), 'tableSearchKey' in idx))
    rec('S2', 'main.css: the .pnb-sbox block is there and no #tableSearchKey rule is left', '.pnb-sbox > .pnb-sbox-seg {' in css and '#tableSearchKey' not in css,
        'block=%s key=%s' % ('.pnb-sbox > .pnb-sbox-seg {' in css, '#tableSearchKey' in css))
    rec('S3', 'help: the search help names the arrow and Alt+Down', 'pnb-help-arrow' in help_ and 'or <code>Alt+Down</code></td>' in help_, 'arrow=%s alt=%s' % ('pnb-help-arrow' in help_, 'or <code>Alt+Down</code></td>' in help_))
    # (2026-10-15, WCAG 2.1.1 / 4.1.2) every role=button segment is a tab stop, and both fields name the arrow's Alt+Down twin
    import re as _re
    segs = ['searchHelpIcon', 'searchBuilderIcon', 'tableSearchCols', 'schedSearchBuilderIcon', 'schedSearchCols']
    def _tag(i):
        m = _re.search(r'<[a-z]+\b[^>]*\bid="' + i + r'"[^>]*>', idx)
        return m.group(0) if m else ''
    notab = [i for i in segs if 'role="button"' not in _tag(i) or 'tabindex="0"' not in _tag(i)]
    nokey = [i for i in ('tableSearch', 'schedSearchFilter') if 'aria-keyshortcuts="Alt+ArrowDown"' not in _tag(i)]
    rec('S4', 'index.php: the role=button segments are tab stops (tabindex=0); both fields carry aria-keyshortcuts=Alt+ArrowDown', not notab and not nokey, 'notab=%s nokey=%s' % (notab, nokey))

def close(a, b, tol=0.6): return abs(a - b) <= tol

def look_checks(br, themes):
    pg = br.pg
    bad = {k: [] for k in ('K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K10')}
    combos = 0
    for th in themes:
        for den in ('standard', 'compact', 'easy-read'):
            pg.ev('__combo(%s, %s)' % (json.dumps(th), json.dumps(den)))
            muted = pg.ev("(function(){var d=document.createElement('span'); d.style.color='var(--text-muted)'; document.body.appendChild(d); var c=getComputedStyle(d).color; d.remove(); return c;})()")
            brandt = pg.ev("(function(){var d=document.createElement('span'); d.style.color='var(--brand-text, var(--brand-primary))'; document.body.appendChild(d); var c=getComputedStyle(d).color; d.remove(); return c;})()")
            for text in (False, True):
                pg.ev('__text(%s)' % ('true' if text else 'false'))
                for box in ('report', 'sched'):
                    combos += 1
                    k = '%s/%s/%s/%s' % (th, den, 'text' if text else 'empty', box)
                    L = pg.ev('__look(%s)' % json.dumps(box))
                    segs = L['segs']; shown = [s for s in segs if s['shown']]
                    cols = [s for s in segs if 'pnb-sbox-cols' in s['cls']]
                    a = cols[0] if cols else None
                    # the arrow: at the right edge of the EMPTY box; gone once the box holds a search
                    if not (a and a['role'] == 'button' and a['label'] and (a['title'] or '').startswith('(Alt+Down)') and not any(s['id'] == 'tableSearchKey' for s in segs)
                            and ((not text and a['shown'] and close(a['right'], 1)) or (text and not a['shown']))):
                        bad['K1'].append(k + ' ' + json.dumps(a)[:160])
                    for s in shown:
                        if not (close(s['top'], 1) and close(s['bottom'], 1)): bad['K2'].append('%s #%s top=%.1f bottom=%.1f' % (k, s['id'], s['top'], s['bottom']))
                    sb = [s for s in shown if 'pnb-sbox-sb' in s['cls']]
                    right = [s for s in shown if 'pnb-sbox-sb' not in s['cls']]
                    for s in shown:
                        side_ok = (s['br'] == '1px solid') if 'pnb-sbox-sb' in s['cls'] else (s['bl'] == '1px solid')
                        flat = s['bg'] == 'rgba(0, 0, 0, 0)' or 'pnb-sbox-sb' in s['cls']   # the magnifier's tint is K10
                        if not (flat and s['bt'] == '0px' and s['bb'] == '0px' and side_ok): bad['K3'].append('%s #%s bg=%s bl=%s br=%s' % (k, s['id'], s['bg'], s['bl'], s['br']))
                    # K10 the magnifier is a button: a brand glyph on a 10% brand tint
                    if not sb or not (sb[0]['color'] == brandt and ('/ 0.1)' in sb[0]['bg'] or ', 0.1)' in sb[0]['bg'])):
                        bad['K10'].append('%s color=%s (brand %s) bg=%s' % (k, sb[0]['color'] if sb else None, brandt, sb[0]['bg'] if sb else None))
                    if not sb or L['pl'] < sb[0]['left'] + sb[0]['width'] - 0.5 or (right and L['pr'] < L['w'] - min(s['left'] for s in right) - 0.5):
                        bad['K4'].append('%s pl=%s pr=%s w=%s' % (k, L['pl'], L['pr'], L['w']))
                    ids = [s['id'] for s in sorted(right, key=lambda s: s['right'])]
                    if box == 'report': want = ['clearTableSearch', 'tableSearchPlay'] if text else ['tableSearchCols']
                    else: want = ['clearSchedSearch', 'schedSearchPlay'] if text else ['schedSearchCols']
                    if ids != want: bad['K5'].append('%s %s' % (k, ids))
                    elif not close(sorted(right, key=lambda s: s['right'])[0]['right'], 1): bad['K5'].append('%s %s not at the edge' % (k, ids[0]))
                    if not (L['bg'] == L['plainBg'] and L['border'] == '1px solid' and L['borderColor'] == L['plainBorderColor']):
                        bad['K6'].append('%s bg=%s/%s border=%s %s/%s' % (k, L['bg'], L['plainBg'], L['border'], L['borderColor'], L['plainBorderColor']))
                    for s in right:
                        if s['color'] != muted: bad['K7'].append('%s #%s %s != %s' % (k, s['id'], s['color'], muted))
    names = {'K1': 'the column arrow: role=button, a name, an "(Alt+Down)" title, at the right edge of the EMPTY box and gone once it holds a search; no "/" badge',
             'K2': 'every segment spans the field\'s inner height (1px in from top and bottom)',
             'K3': 'flat segments: transparent, no top/bottom border, a 1px solid divider on the inner side',
             'K4': 'the text never runs under a segment (the padding covers them)',
             'K5': 'empty: the arrow alone at the edge; with text: clear in the arrow\'s place at the edge, then run',
             'K6': 'the field keeps the theme\'s own fill and boundary (as a plain text field)',
             'K7': 'the right-hand segment glyphs in the theme\'s --text-muted',
             'K10': 'the magnifier reads as a button: a brand glyph on a 10% brand tint'}
    for kid in sorted(bad):
        rec(kid, names[kid] + ' - every theme x density, empty and with text, both boxes', not bad[kid], '%d of %d bad: %s' % (len(bad[kid]), combos, '; '.join(bad[kid][:3])))
    # K8 hover / K9 focus, real input, a light and a dark theme
    k8, k9 = [], []
    for th in ('theme-default', 'theme-wolfpack-dark', 'theme-midnight'):
        pg.ev("__combo(%s, 'standard'); __text(false); document.activeElement && document.activeElement.blur(); true" % json.dumps(th))
        for sel in ('#tableSearchCols', '#schedSearchCols', '#searchBuilderIcon', '#schedSearchBuilderIcon'):
            c = pg.center(sel)
            if not c: k8.append(th + ' ' + sel + ' not shown'); continue
            prop = 'backgroundColor' if 'BuilderIcon' in sel else 'color'
            before = pg.ev("getComputedStyle(document.querySelector(%s)).%s" % (json.dumps(sel), prop))
            pg.move(c[0], c[1]); time.sleep(0.3)
            after = pg.ev("getComputedStyle(document.querySelector(%s)).%s" % (json.dumps(sel), prop))
            brand = pg.ev("(function(){var d=document.createElement('span'); d.style.color='var(--brand-text, var(--brand-primary))'; document.body.appendChild(d); var c=getComputedStyle(d).color; d.remove(); return c;})()")
            if prop == 'backgroundColor': ok8 = ('/ 0.2)' in after or ', 0.2)' in after) and after != before
            else: ok8 = after == brand and after != before
            if not ok8: k8.append('%s %s %s %s -> %s (brand %s)' % (th, sel, prop, before, after, brand))
            pg.move(5, 5); time.sleep(0.2)
        for sel in ('#tableSearch', '#schedSearchFilter'):
            c = pg.center(sel); pg.click(c[0] - 40, c[1]); time.sleep(0.25)
            st = pg.ev("(function(){var e=document.querySelector(%s), cs=getComputedStyle(e); var d=document.createElement('span'); d.style.color='var(--brand-primary)'; document.body.appendChild(d); var b=getComputedStyle(d).color; d.remove(); return [document.activeElement===e, cs.borderTopColor, b, cs.boxShadow];})()" % json.dumps(sel))
            if not (st[0] and st[1] == st[2] and st[3] and st[3] != 'none'): k9.append('%s %s %s' % (th, sel, st))
            pg.ev('document.activeElement && document.activeElement.blur(); true'); time.sleep(0.1)
    rec('K8', 'a REAL mouse hover turns the arrow the theme\'s brand colour and deepens the magnifier\'s tint (light + dark themes)', not k8, '; '.join(k8[:3]))
    rec('K9', 'REAL focus: the field\'s border takes the brand colour, with a glow', not k9, '; '.join(k9[:3]))

_jit = [0]
def behave_checks(br):
    pg = br.pg
    def items(): return pg.ev("$('ul.ui-autocomplete:visible li').map(function(){return $(this).text().trim();}).get()") or []
    def is_open(): return bool(pg.ev("$('ul.ui-autocomplete:visible').length > 0"))
    def val(sel): return pg.ev("$(%s).val()" % json.dumps(sel))
    def pick(text):
        c = pg.ev("(function(){var li=$('ul.ui-autocomplete:visible li').filter(function(){return $(this).text().trim()===%s;}).first()[0]; if(!li) return null; var b=li.getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2];})()" % json.dumps(text))
        if not c: return False
        # jQuery UI's menu ignores a hover at the pixel of the last one: vary it, as a hand does
        _jit[0] = (_jit[0] + 7) % 40
        pg.click(c[0] - 20 + _jit[0], c[1]); return True
    COLS = ['COLLEGE', 'DEPARTMENT', 'PI_NAME', 'AMOUNT', 'AWARD_DATE', 'STATUS', 'SPONSOR']
    VALS = ['Agriculture', 'Engineering', 'Humanities', 'Sciences']
    res = {}
    def r(id_, box, ok, detail=''):
        res.setdefault(id_, []).append((box, ok, detail))
    for box, inp, arrow in (('report', '#tableSearch', '#tableSearchCols'), ('sched', '#schedSearchFilter', '#schedSearchCols')):
        br.load(); pg.ev("__combo('theme-default','standard'); true")
        c = pg.center(arrow)
        if not c:
            for i in ('A', 'B1', 'B2', 'B3', 'C', 'H', 'D1', 'D2', 'D3', 'E1', 'F1', 'F2', 'F3', 'G', 'H2', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'): r(i, box, False, 'no arrow')
            continue
        pg.click(c[0], c[1]); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.1)
        it = items(); foc = pg.ev("document.activeElement === $(%s)[0]" % json.dumps(inp))
        r('A', box, all(x in it for x in COLS) and foc and (box != 'report' or it[:2] == ['Saved Searches', '\u2605 Big awards']), json.dumps(it)[:200] + ' focus=%s' % foc)
        pg.ev("window.__blurs = 0; $(%s).on('blur.sbxprobe', function(){ window.__blurs++; }); true" % json.dumps(inp))
        pg.click(c[0], c[1]); time.sleep(0.3)
        r('B1', box, not is_open(), json.dumps(items())[:120])
        r('B2', box, pg.ev("document.activeElement === $(%s)[0]" % json.dumps(inp)), pg.ev('document.activeElement.id'))
        pg.click(c[0], c[1]); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.1)
        r('B3', box, pg.ev('window.__blurs') == 0, 'blur events: %s' % pg.ev('window.__blurs'))
        pick('COLLEGE'); time.sleep(0.4)
        r('C', box, val(inp) == 'COLLEGE ' and items() == VALS, repr(val(inp)) + ' ' + json.dumps(items())[:120])
        pg.key('Escape', 27); time.sleep(0.2)
        # H (2026-10-13): that pick wrote "COLLEGE ", a box that ENDS with a column, so the
        # arrow stays at the edge (now for COLLEGE's values, its title says so), clear beside it
        clr = '#clearTableSearch' if box == 'report' else '#clearSchedSearch'
        def edge():
            return pg.ev("(function(){var a=document.querySelector(%s), x=document.querySelector(%s), i=document.querySelector(%s); var ib=i.getBoundingClientRect(), xb=x.getBoundingClientRect(), ab=a.getBoundingClientRect(); return [a.getClientRects().length, x.getClientRects().length, ib.right - xb.right, ib.right - ab.right, a.getAttribute('title')];})()" % (json.dumps(arrow), json.dumps(clr), json.dumps(inp)))
        hc = edge()
        r('H', box, hc[0] == 1 and hc[1] > 0 and abs(hc[3] - 1) <= 0.6 and abs(hc[2] - 27) <= 0.6 and hc[4] == '(Alt+Down) Show the values of COLLEGE',
          'arrow rects=%s clear rects=%s clear inset=%s arrow inset=%s title=%r' % tuple(hc))
        # D/E with text in the box: the arrow is gone, Alt+Down is the way to the full list
        pg.ev("$(%s).val('STATUS = Active').trigger('focus'); true" % json.dumps(inp))
        pg.key('ArrowDown', 40, alt=True); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.1)
        it = items()
        r('D1', box, all(x in it for x in COLS), json.dumps(it)[:200])
        pick('COLLEGE'); time.sleep(0.4)
        r('D2', box, val(inp) == 'STATUS = Active and COLLEGE ', repr(val(inp)))
        it = items(); ok3 = it == VALS
        pick('Engineering'); time.sleep(0.3)
        r('D3', box, ok3 and val(inp) == 'STATUS = Active and COLLEGE Engineering', json.dumps(it)[:100] + ' ' + repr(val(inp)))
        # H2: a value follows the column now: the arrow gives way to the clear again
        pg.key('Escape', 27); time.sleep(0.2)
        hc = edge()
        r('H2', box, hc[0] == 0 and hc[1] > 0 and abs(hc[2] - 1) <= 0.6, 'arrow rects=%s clear rects=%s clear inset=%s arrow inset=%s title=%r' % tuple(hc))
        pg.ev("$(%s).val('STATUS = Active or ').trigger('focus'); true" % json.dumps(inp))
        pg.key('ArrowDown', 40, alt=True); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.1)
        pick('AMOUNT'); time.sleep(0.4)
        r('E1', box, val(inp) == 'STATUS = Active or AMOUNT ', repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        pg.ev("$(%s).val('PI_NAME Smith').trigger('focus'); true" % json.dumps(inp))
        pg.key('ArrowDown', 40, alt=True); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        it = items()
        r('F1', box, all(x in it for x in COLS), json.dumps(it)[:200])
        act = pg.ev("$('ul.ui-autocomplete:visible .ui-state-active').text().trim()")
        first = [x for x in it if x not in ('Saved Searches', 'Visible Columns', 'Hidden Columns')][:1]
        r('F2', box, bool(first) and act == first[0], (act, first))
        ex0 = pg.ev('window.__exec')
        pg.key('Enter', 13); time.sleep(0.4)
        if box == 'report': r('F3', box, val(inp) == 'AMOUNT > 100000' and pg.ev('window.__exec') == ex0 + 1, repr(val(inp)) + ' exec %s->%s' % (ex0, pg.ev('window.__exec')))
        else: r('F3', box, val(inp) == 'PI_NAME Smith and COLLEGE ', repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        pg.ev("$(%s).val('').trigger('focus'); true" % json.dumps(inp))
        pg.call('Input.insertText', text='DEP'); time.sleep(0.6)
        it = items(); okg = it == ['Visible Columns', 'DEPARTMENT']
        pick('DEPARTMENT'); time.sleep(0.4)
        r('G', box, okg and val(inp) == 'DEPARTMENT ', json.dumps(it) + ' ' + repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        # V (2026-10-13): REAL typing that ends with a column name. The host's own has-text
        # (main.js / the scheduler's handler, not in this harness) is set as they set it.
        hostcls = "$(%s).toggleClass('has-text', !!$(%s).val()); true" % (json.dumps('#tableSearchContainer' if box == 'report' else '#schedSearchFilter'), json.dumps(inp))
        if box == 'sched': hostcls = "$('#schedSearchFilter').closest('div').toggleClass('has-text', !!$('#schedSearchFilter').val()); true"
        def typein(text):
            pg.ev("$(%s).val('').trigger('focus'); true" % json.dumps(inp))
            pg.call('Input.insertText', text=text); time.sleep(0.5)
            pg.key('Escape', 27); time.sleep(0.15)
            pg.ev(hostcls); time.sleep(0.1)
        typein('STATUS = Active and COLLEGE')
        hc = edge()
        r('V0', box, hc[0] == 1 and abs(hc[3] - 1) <= 0.6 and abs(hc[2] - 27) <= 0.6, 'arrow rects=%s clear rects=%s clear inset=%s arrow inset=%s title=%r' % tuple(hc))
        c2 = pg.center(arrow)
        if c2: pg.click(c2[0] + 1, c2[1]); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        it = items(); foc = pg.ev("document.activeElement === $(%s)[0]" % json.dumps(inp))
        r('V1', box, bool(c2) and it == VALS and val(inp) == 'STATUS = Active and COLLEGE ' and foc, json.dumps(it)[:160] + ' ' + repr(val(inp)) + ' focus=%s' % foc)
        pick('Humanities'); time.sleep(0.4)
        r('V2', box, val(inp) == 'STATUS = Active and COLLEGE Humanities', repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        typein('PI_NAME = x or status')
        pg.key('ArrowDown', 40, alt=True); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        it = items()
        r('V3', box, it == ['Active', 'Closed', 'Pending'] and val(inp) == 'PI_NAME = x or status ', json.dumps(it)[:160] + ' ' + repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        typein('COLLEGE = Engineering and STATUS')
        pg.ev("$(%s)[0].setSelectionRange(0, 7); true" % json.dumps(inp))
        c3 = pg.center(arrow)
        if c3: pg.click(c3[0] - 1, c3[1]); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        it = items(); ok4 = all(x in it for x in COLS) and not any(x in it for x in VALS)
        pick('DEPARTMENT'); time.sleep(0.4)
        r('V4', box, bool(c3) and ok4 and val(inp) == 'DEPARTMENT = Engineering and STATUS', json.dumps(it)[:160] + ' ' + repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        # V5 (sweep): a column with NO value list (SPONSOR) is not a values arrow: the arrow
        # gives way to the clear, and Alt+Down lists the columns with nothing appended
        typein('STATUS = Active and SPONSOR')
        hc = edge()
        pg.key('ArrowDown', 40, alt=True); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        it = items()
        r('V5', box, hc[0] == 0 and abs(hc[2] - 1) <= 0.6 and all(x in it for x in COLS) and val(inp) == 'STATUS = Active and SPONSOR',
          'arrow rects=%s clear inset=%s ' % (hc[0], hc[2]) + json.dumps(it)[:120] + ' ' + repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        # V6 (final sweep): a selection's column list, closed unused, leaves nothing behind: the caret
        # after the column then Ctrl+Space lists THAT column's values (not the columns again)
        typein('COLLEGE = Engineering and STATUS')
        pg.ev("$(%s)[0].setSelectionRange(0, 7); true" % json.dumps(inp))
        c6 = pg.center(arrow)
        if c6: pg.click(c6[0] + 2, c6[1]); pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.15)
        open6 = is_open()
        pg.key('Escape', 27); time.sleep(0.2)
        pg.ev("(function(e){e.setSelectionRange(e.value.length, e.value.length);})($(%s)[0]); true" % json.dumps(inp))
        pg.call('Input.dispatchKeyEvent', type='rawKeyDown', key=' ', code='Space', windowsVirtualKeyCode=32, nativeVirtualKeyCode=32, modifiers=2)
        pg.call('Input.dispatchKeyEvent', type='keyUp', key=' ', code='Space', windowsVirtualKeyCode=32, nativeVirtualKeyCode=32, modifiers=2)
        pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.4)
        it = items()
        r('V6', box, open6 and it == ['Active', 'Closed', 'Pending'], 'first list open=%s then ' % open6 + json.dumps(it)[:160] + ' ' + repr(val(inp)))
        pg.key('Escape', 27); time.sleep(0.2)
        # V7 (guard): a double-click on a value inside a regex alternation still replaces just that
        # value when one is picked (the pick reads the selection before the list closes)
        typein('COLLEGE /(?:Agriculture|Humanities)/')
        pg.ev("(function(e){var p=e.value.indexOf('Humanities')+3; e.setSelectionRange(p,p); $(e).trigger('dblclick');})($(%s)[0]); true" % json.dumps(inp))
        pg.wait("$('ul.ui-autocomplete:visible').length > 0", 3000); time.sleep(0.2)
        it7 = items(); pick('Sciences'); time.sleep(0.4)
        r('V7', box, val(inp) == 'COLLEGE /(?:Agriculture|Sciences)/', json.dumps(it7)[:120] + ' ' + repr(val(inp)))
        pg.key('Escape', 27)
    names = {'A': 'the arrow lists every column (saved searches first on the report box) and puts the focus in the box',
             'B1': 'a second click on the arrow closes the list', 'B2': '...and the focus stays in the box',
             'B3': 'clicking the arrow never blurs the box (its mousedown keeps the focus)',
             'C': 'a column picked in the empty box is written as "COL " and its values open next',
             'H': '...and, the box ending with that column, the arrow stays at the edge for its values (title names it), clear beside it',
             'H2': 'a value after the column: the arrow gives way to the clear, at the box\'s edge',
             'V0': 'typed text that ends with a column shows the arrow at the edge, clear beside it',
             'V1': 'a click on it lists THAT column\'s values (a space goes after the name), focus kept',
             'V2': '...a value picked completes the condition',
             'V3': 'Alt+Down does the same after an "or", the name in any case',
             'V4': 'with the name SELECTED the arrow lists the columns and the pick replaces the selection',
             'V7': '(guard) a double-click on a value inside a regex alternation still replaces just that value',
             'V6': 'the column list for a selection, closed unused, leaves nothing behind: Ctrl+Space after the column then lists its values',
             'V5': 'a column with no value list is not a values arrow: clear at the edge, Alt+Down lists the columns, nothing appended',
             'D1': 'with text in the box (the arrow gone) Alt+Down still lists every column, unfiltered',
             'D2': 'a pick from it ADDS a condition: "<text> and COL " - nothing typed is lost',
             'D3': '...its values open next and a value completes the condition',
             'E1': 'after a trailing "or" the column joins it (no extra "and")',
             'F1': 'Alt+Down opens the same full list', 'F2': '...with its FIRST item highlighted (the widget\'s own Down does not run as well)',
             'F3': 'Enter picks the highlighted item (a saved search replaces the report box and runs; a column is added)',
             'G': 'typing afterwards is the ordinary type-ahead again (filtered; its pick replaces the typed word)'}
    for i in ('A', 'B1', 'B2', 'B3', 'C', 'H', 'D1', 'D2', 'D3', 'E1', 'F1', 'F2', 'F3', 'G', 'H2', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'):
        lst = res.get(i, [])
        rec(i, names[i] + ' - report bar and scheduler', lst and all(x[1] for x in lst), '; '.join('%s: %s' % (x[0], x[2]) for x in lst if not x[1]))

def run_build(files_src, mutant=None, quiet=False):
    del R[:]
    run, text = stage(files_src, mutant)
    try:
        static_checks(text)
        themes = [t['id'] for t in json.loads(read(os.path.join(run, 'themes.js')).split('=', 1)[1].strip().rstrip(';'))]
        br = Browser(run)
        try:
            br.load()
            look_checks(br, themes)
            behave_checks(br)
        finally:
            br.close()
    except Exception as e:
        rec('Z0', 'the suite ran', False, repr(e))
    finally:
        shutil.rmtree(run, ignore_errors=True)
    if not quiet:
        for x in R: print(('  PASS  ' if x['pass'] else '  FAIL  ') + x['id'] + ' ' + x['name'] + ('' if x['pass'] else '\n          ' + x['detail']))
    return [x['id'] for x in R if not x['pass']], len(R)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', default=APP); ap.add_argument('--stage', default='')
    ap.add_argument('--control', action='store_true'); ap.add_argument('--mutant', default=''); ap.add_argument('--mutants', action='store_true')
    a = ap.parse_args()
    files = {}
    for k, rel in FILES.items():
        p = os.path.join(a.app, rel)
        if a.control:
            p = bak_path(os.path.join(a.app, rel) + '.bak-' + STAMP)   # the app dir, else git / the de-bloat folders
            if not p: raise SystemExit('--control: no %s.bak-%s' % (rel, STAMP))
        if a.stage and os.path.exists(os.path.join(a.stage, os.path.basename(rel))): p = os.path.join(a.stage, os.path.basename(rel))
        files[k] = p
    print('files: ' + ('CONTROL ' if a.control else '') + json.dumps({k: v for k, v in files.items()})[:600])
    if a.mutants:
        text = {k: read(p) for k, p in files.items()}
        bad = [n for n, m in MUTANTS.items() if text[m[0]].count(m[1]) != 1]
        if bad: print('ANCHORS missing / repeated: ' + ', '.join(bad)); print('RESULT: RED'); return
        print('ANCHORS all %d mutants apply exactly once' % len(MUTANTS))
        ok = 0
        for n, m in MUTANTS.items():
            red, total = run_build(files, n, quiet=True)
            bites = all(x in red for x in m[3])
            ok += bites
            print('MUTANT %-10s %s   red: %s' % (n, 'BITES' if bites else 'SURVIVES (wanted ' + ' '.join(m[3]) + ')', ' '.join(red) or '-'))
        print('MUTANTS %d / %d bite' % (ok, len(MUTANTS)))
        print('RESULT: ' + ('GREEN' if ok == len(MUTANTS) else 'RED'))
        return
    red, total = run_build(files, a.mutant or None)
    print('TOTAL pass=%d fail=%d' % (total - len(red), len(red)))
    print('RESULT: ' + ('GREEN' if not red else 'RED'))

if __name__ == '__main__':
    main()
