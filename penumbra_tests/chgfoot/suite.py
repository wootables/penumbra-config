"""chgfoot suite body: write the cases, drive them through cdp.py, judge them.

usage: py -3 suite.py <run dir>      (run.ps1 prepares the dir: chg.html, cdp.py,
                                      main.js / main.css / index.php under test,
                                      css/ js/ vendor files, themes.js, themevars.css)
Prints one PASS/FAIL line per check and RESULT: GREEN/RED; writes asserts.json.
"""
import json, os, re, subprocess, sys

run = os.path.abspath(sys.argv[1])
base = 'file:///' + run.replace('\\', '/') + '/chg.html'
tj = open(os.path.join(run, 'themes.js'), encoding='utf-8').read()
themes = [t['id'] for t in json.loads(tj.split('=', 1)[1].strip().rstrip(';'))]

Q = 'id=grantprofiles&surface=pane'
cases = []


def case(name, query, steps=None):
    cases.append({'name': name, 'query': query, 'steps': steps or []})


for w in (1708, 1250, 1123, 1000, 900, 851, 800, 720):
    case(f'p{w}', f'{Q}&w={w}')
case('pcap', f'{Q}&w=1123&capped=1&n=100', [
    {'eval': "(function(){var l=document.querySelector('#auditSegChanges .audit-verlist');l.scrollTop=l.scrollHeight;return true;})()", 'as': 'scrolled'},
    {'eval': 'window.__h.measure()', 'as': 'm'}])
case('pcapmore', f'{Q}&w=1123&capped=1&n=100', [
    {'realclick': '#auditSegChanges [data-audit-vermore]'}, {'wait': 0.5},
    {'eval': 'window.__h.state()', 'as': 'st'}])
case('c1708', f'{Q}&w=1708&compact=1')
case('c720', f'{Q}&w=720&compact=1')
case('d1708', 'id=grantprofiles&surface=dialog&w=1708', [
    {'eval': "window.__h.filter('sql', null)", 'as': 'f'}, {'wait': 0.2},
    {'eval': 'window.__h.filterBar()', 'as': 'fb'}])
for sg in ('pulse', 'events', 'health'):
    case('s' + sg, f'{Q}&w=1123&seg={sg}')
case('pop', f'{Q}&w=1123', [
    {'eval': 'window.__h.selectVer(3)', 'as': 'picked'}, {'wait': 0.2},
    {'realclick': '#auditChangesPopOut'}, {'wait': 0.4},
    {'eval': 'window.__h.state()', 'as': 'st'}])
case('hotC', f'{Q}&w=1123', [
    {'eval': 'window.__h.selectVer(3)', 'as': 'picked'}, {'wait': 0.2},
    {'eval': 'window.__hotY()', 'as': 'ran'}, {'wait': 0.4},
    {'eval': 'window.__h.state()', 'as': 'st'}])
case('hotE', f'{Q}&w=1123&seg=events', [
    {'eval': 'window.__hotY()', 'as': 'ran'}, {'wait': 0.4},
    {'eval': 'window.__h.state()', 'as': 'st'}])
case('tip', f'{Q}&w=1123&tip=1', [
    {'hover': '#auditChangesPopOut'}, {'wait': 1.0},
    {'eval': 'window.__h.tooltip()', 'as': 'tt'}])
case('filt', f'{Q}&w=1123', [
    {'eval': 'window.__h.filterBar()', 'as': 'fb0'},
    {'eval': "window.__h.filter('sql', null)", 'as': 'f1'}, {'wait': 0.2},
    {'eval': 'window.__h.filterBar()', 'as': 'fb1'},
    {'eval': "window.__h.filter('noop', null)", 'as': 'f2'}, {'wait': 0.2},
    {'eval': 'window.__h.filterBar()', 'as': 'fb2'}])
case('keys', f'{Q}&w=1123', [
    {'eval': 'window.__h.state().paneSel', 'as': 'sel0'},
    {'eval': "window.__h.focus('#auditSegChanges .audit-vf-cat')", 'as': 'focused'},
    {'key': 'ArrowDown'}, {'wait': 0.2},
    {'eval': '({ v: window.__h.vfValue(), sel: window.__h.state().paneSel })', 'as': 'afterSelect'},
    {'eval': "window.__h.filter('', null)", 'as': 'reset'},
    # measured from wherever the selection is NOW (a build that hijacks the
    # select's arrow key has already moved it)
    {'eval': '(function(){var s=window.__h.state().paneSel;return {s: s, next: window.__h.nextId(s)};})()', 'as': 'beforeRow'},
    {'eval': "window.__h.focus('#auditSegChanges .audit-ver[aria-pressed=true]')", 'as': 'focusedRow'},
    {'key': 'ArrowDown'}, {'wait': 0.2},
    {'eval': 'window.__h.state()', 'as': 'st'}])
for th in themes:
    case('k|' + th, f'{Q}&w=1123&theme={th}', [
        {'eval': 'window.__h.popStyle()', 'as': 's0'},
        {'hover': '#auditChangesPopOut'}, {'wait': 0.25},
        {'eval': 'window.__h.popStyle()', 'as': 's1'}])

json.dump({'base': base, 'viewport': [2400, 1100], 'cases': cases}, open(os.path.join(run, 'jobs.json'), 'w', encoding='utf-8'))
p = subprocess.run([sys.executable, os.path.join(run, 'cdp.py'), os.path.join(run, 'jobs.json'), os.path.join(run, 'results.json')],
                   capture_output=True, text=True)
if not os.path.exists(os.path.join(run, 'results.json')):
    print('cdp.py wrote no results:', (p.stdout + p.stderr)[-2000:])
    print('RESULT: RED')
    sys.exit(0)
R = {r['name']: r for r in json.load(open(os.path.join(run, 'results.json'), encoding='utf-8'))}

out = []


def A(i, name, ok, detail=''):
    out.append({'id': i, 'name': name, 'pass': bool(ok), 'detail': str(detail)[:500]})


def res(n):
    r = R.get(n)
    return r['result'] if r and isinstance(r.get('result'), dict) and not r['result'].get('error') else None


def st(n, k):
    r = R.get(n)
    return (r or {}).get('steps', {}).get(k)


bad = [n for n in R if res(n) is None]
if bad:
    A('Z0', 'every case rendered', False, '; '.join(f"{n}: {(R[n].get('result') or {}).get('error')}" for n in bad[:6]))
    json.dump(out, open(os.path.join(run, 'asserts.json'), 'w'), indent=1)
    for x in out:
        print(f"  FAIL  {x['id']} {x['name']}  [{x['detail']}]")
    print('RESULT: RED')
    sys.exit(0)


def g(d, *ks, default=None):
    for k in ks:
        if not isinstance(d, dict) or k not in d:
            return default
        d = d[k]
    return d


# ---- F: the footer is gone and its height went to the list and the diff ----
f1 = [(n, res(n)) for n in ('p1708', 'p1123')]
A('F1', 'no footer under the Changes panes; the list and the diff reach the panel bottom (1708, 1123px)',
  all(v['footers'] == 0 and v['footersPane'] == 0 and v['gapBelow'] is not None and v['gapBelow'] <= 0.5 and v['overflow'] <= 0 for _, v in f1),
  ' | '.join(f"{n}: footers={v['footers']} gap={v['gapBelow']} chg={g(v, 'chg', 'h')} panel={g(v, 'root', 'h')}" for n, v in f1))
v = res('pcap')
A('F2', 'a capped history (the old footer wrapped to two lines, 56px): still no footer, nothing below the panes',
  v['footers'] == 0 and v['gapBelow'] is not None and v['gapBelow'] <= 0.5, f"footers={v['footers']} gap={v['gapBelow']}")
v = res('c1708')
A('F3', 'compact console: no footer, the panes run to the bottom', v['footers'] == 0 and v['gapBelow'] is not None and v['gapBelow'] <= 0.5,
  f"footers={v['footers']} gap={v['gapBelow']}")
v = res('d1708')
A('F4', 'the Version History dialog (same renderer): no footer, the panes reach the dialog body bottom',
  v['footersDlg'] == 0 and v.get('dlgGapBelow') is not None and v['dlgGapBelow'] <= 0.5, f"footers={v['footersDlg']} gap={v.get('dlgGapBelow')}")

# ---- P: Pop out on the banner -----------------------------------------------
v = res('p1708')
pp = v['pop'] or {}
A('P1', 'Pop out is a <button type=button> on the banner, on screen while Changes is the view, named "Pop out"',
  pp.get('inBar') and pp.get('tag') == 'BUTTON' and pp.get('type') == 'button' and pp.get('visible') and pp.get('text') == 'Pop out' and pp.get('aria') == 'Pop out',
  f"where={pp.get('where')} tag={pp.get('tag')} type={pp.get('type')} visible={pp.get('visible')} text=[{pp.get('text')}] aria=[{pp.get('aria')}]")
A('P2', 'its tooltip names the hotkey: title starts "(CTRL+SHIFT+Y) " and says what opens; aria-keyshortcuts = Control+Shift+Y',
  str(pp.get('title', '')).startswith('(CTRL+SHIFT+Y) ') and 'full-height dialog' in str(pp.get('title', '')) and pp.get('keys') == 'Control+Shift+Y',
  f"title=[{pp.get('title')}] keys=[{pp.get('keys')}]")
p3 = [(sg, res('s' + sg)['pop']) for sg in ('pulse', 'events', 'health')]
A('P3', 'on Pulse, Events and Health it is on the banner but hidden',
  all(x and x.get('inBar') and x.get('display') == 'none' and not x.get('visible') for _, x in p3),
  ' '.join(f"{sg}: " + (f"inBar={x.get('inBar')} display={x.get('display')} visible={x.get('visible')}" if x else 'missing') for sg, x in p3))
d = res('d1708')
A('P4', 'exactly one Pop out, never inside the Changes pane or the dialog',
  v['popCount'] == 1 and not pp.get('inPane') and not pp.get('inDlg') and d['popInDlg'] == 0,
  f"count={v['popCount']} inPane={pp.get('inPane')} inDlg={pp.get('inDlg')} dialogCopies={d['popInDlg']}")
lines = {n: res(n)['barLines'] for n in ('p1708', 'p1250', 'p1123', 'p1000', 'p900', 'p851', 'p800', 'p720')}
label = {n: res(n)['popLabelShown'] for n in lines}
hts = [(n, g(res(n), 'pop', 'rect', 'h'), g(res(n), 'link', 'h')) for n in ('p1708', 'p720', 'c1708', 'c720')]
p5 = all(x == 1 for x in lines.values()) and all(label[n] for n in ('p1708', 'p1250', 'p1123', 'p1000')) and \
     not any(label[n] for n in ('p900', 'p851', 'p800', 'p720')) and all(a is not None and b is not None and abs(a - b) <= 0.5 for _, a, b in hts)
A('P5', 'the Changes banner holds one line from 1708 to 720px (the word drops below 900px of bar), Pop out as tall as Report metrics (docked + compact)',
  p5, 'lines ' + ' '.join(f"{n[1:]}={x}" for n, x in lines.items()) + ' | label ' + ' '.join(f"{n[1:]}={'Y' if label[n] else 'n'}" for n in label) +
  ' | h ' + ' '.join(f"{n}={a}/{b}" for n, a, b in hts))
s = st('pop', 'st') or {}
A('P6', 'a REAL click opens the dialog on the version being viewed, and the Auditor moves to Events (Pop out hides)',
  s.get('dlgShown') and st('pop', 'picked') and s.get('dlgSel') == st('pop', 'picked') and s.get('selectedTab') == 'events' and s.get('eventsOn') and not s.get('popShown') and s.get('dlgVersions') == 17,
  f"picked={st('pop', 'picked')} dlg={s.get('dlgShown')} dlgSel={s.get('dlgSel')} tab={s.get('selectedTab')} popShown={s.get('popShown')}")
sc, se = st('hotC', 'st') or {}, st('hotE', 'st') or {}
A('P7', 'Ctrl+Shift+Y (the real case) does what Pop out does while it is on screen; on Events it opens the newest entry as before',
  sc.get('dlgShown') and sc.get('dlgSel') == st('hotC', 'picked') and sc.get('selectedTab') == 'events' and
  se.get('dlgShown') and se.get('dlgSel') == se.get('firstId') and se.get('selectedTab') == 'events',
  f"changes: picked={st('hotC', 'picked')} dlgSel={sc.get('dlgSel')} tab={sc.get('selectedTab')} | events: dlgSel={se.get('dlgSel')} newest={se.get('firstId')} tab={se.get('selectedTab')}")
tt = st('tip', 'tt') or {}
A('P8', 'hovering it shows the tooltip (main.js\'s global jQuery UI tooltip) with the hotkey first',
  tt.get('shown') and str(tt.get('text', '')).startswith('(CTRL+SHIFT+Y)'), f"tooltip=[{tt.get('text')}]")
fails, n = [], 0
for th in themes:
    a, b = st('k|' + th, 's0'), st('k|' + th, 's1')
    if not a or not b:
        fails.append(f'{th}=missing')
        continue
    n += 1
    why = []
    if a['text'] < 4.5 or b['text'] < 4.5:
        why.append(f"text {a['text']}/{b['text']}")
    if a['edge'] < 3.0:
        why.append(f"edge {a['edge']}")
    if a['color'] != b['color'] or a['bg'] != b['bg']:
        why.append(f"hover {a['bg']}+{a['color']} -> {b['bg']}+{b['color']}")
    if why:
        fails.append(th + ': ' + ', '.join(why))
A('P9', f'Pop out text >= 4.5:1 and its outline >= 3:1 over the band, and hover changes no colour pair, on all {len(themes)} themes',
  not fails and n == len(themes) and n >= 10, f"themes={n} fails: {'; '.join(fails)}")

# ---- L: Load older versions ends a capped list ----------------------------------
m = st('pcap', 'm') or {}
mo = m.get('more') or {}
A('L1', 'a capped list ENDS with the ceiling note and "Load older versions"; an uncapped list has neither',
  mo.get('inList') and mo.get('afterLast') and 'The history is longer than the 100 entries fetched.' in str(mo.get('note', '')) and mo.get('text') == 'Load older versions' and res('p1123')['more'] is None,
  f"inList={mo.get('inList')} afterLast={mo.get('afterLast')} note=[{mo.get('note')}] uncapped={res('p1123')['more']}")
s = st('pcapmore', 'st') or {}
calls = [c for c in (s.get('ajax') or []) if str(c.get('url', '')).startswith('get_audit_log.php')]
A('L2', 'a REAL click on it refetches 500 entries into the pane: all 260 listed, no ceiling row left',
  len(calls) >= 2 and str(g(calls[-1], 'data', 'limit')) == '500' and s.get('paneVersions') == 260 and s.get('paneMore') == 0 and g(s, 'st', 'root') == '#auditSegChanges',
  f"limits={[g(c, 'data', 'limit') for c in calls]} versions={s.get('paneVersions')} moreRows={s.get('paneMore')} root={g(s, 'st', 'root')}")

# ---- C: the filter count sits under the selects ---------------------------------
fb0, fb1, fb2 = st('filt', 'fb0') or {}, st('filt', 'fb1') or {}, st('filt', 'fb2') or {}
c1 = fb1.get('count') or {}
mt = re.match(r'^Showing (\d+) of (\d+) entries$', str(c1.get('text', '')))
one_row = fb1.get('cat') and fb1.get('user') and abs(fb1['cat']['y'] - fb1['user']['y']) < 1
under = one_row and c1.get('rect') and c1['rect']['y'] >= max(fb1['cat']['b'], fb1['user']['b']) - 0.5
A('C1', 'filtering shows "Showing N of 17 entries" in the filter bar, under the two selects (which share one row); no count unfiltered',
  bool(mt) and int(mt.group(1)) == fb1.get('showing') and int(mt.group(2)) == 17 and c1.get('shown') and c1.get('inBar') and c1.get('role') == 'status' and under and
  not g(fb0, 'count', 'shown'),
  f"text=[{c1.get('text')}] showing={fb1.get('showing')} inBar={c1.get('inBar')} role={c1.get('role')} oneRow={one_row} under={under} unfiltered={g(fb0, 'count', 'shown')}")
c2 = fb2.get('count') or {}
A('C2', 'a filter nothing matches: "Showing 0 of 17 entries" and the no-match note',
  c2.get('text') == 'Showing 0 of 17 entries' and c2.get('shown') and fb2.get('noneShown'), f"text=[{c2.get('text')}] note={fb2.get('noneShown')}")
fd = st('d1708', 'fb') or {}
cd = fd.get('count') or {}
md = re.match(r'^Showing (\d+) of 17 entries$', str(cd.get('text', '')))
A('C3', 'the dialog shows the same count in its own filter bar',
  bool(md) and int(md.group(1)) == fd.get('showing') and cd.get('shown') and cd.get('inBar'), f"text=[{cd.get('text')}] showing={fd.get('showing')}")

# ---- K: the arrow keys ------------------------------------------------------------
ks = st('keys', 'st') or {}
aft = st('keys', 'afterSelect') or {}
A('K1', 'a REAL ArrowDown on the focused filter select steps the select, and leaves the version selection alone',
  st('keys', 'focused') and aft.get('v') not in (None, '') and aft.get('sel') == st('keys', 'sel0'),
  f"focused={st('keys', 'focused')} select=[{aft.get('v')}] selection {st('keys', 'sel0')} -> {aft.get('sel')}")
br = st('keys', 'beforeRow') or {}
A('K2', 'a REAL ArrowDown on the focused version row still moves to the next row',
  st('keys', 'focusedRow') and br.get('next') and ks.get('paneSel') == br.get('next') and ks.get('paneSel') != br.get('s'),
  f"{br.get('s')} -> {ks.get('paneSel')} (next={br.get('next')})")

# ---- X: no script errors ------------------------------------------------------------
errs = []
for nm, r in R.items():
    e = list((r.get('result') or {}).get('errs') or [])
    for k in ('st',):
        e += list(((r.get('steps') or {}).get(k) or {}).get('errs') or []) if isinstance((r.get('steps') or {}).get(k), dict) else []
    if (r.get('steps') or {}).get('_error'):
        e.append('driver: ' + r['steps']['_error'])
    if (r.get('steps') or {}).get('_missing'):
        e.append('missing: ' + ','.join(r['steps']['_missing']))
    if e:
        errs.append(f"{nm}: {'; '.join(sorted(set(e)))}")
A('X1', f'no script errors, no missing targets ({len(R)} cases)', not errs, ' | '.join(errs[:8]))

json.dump(out, open(os.path.join(run, 'asserts.json'), 'w', encoding='utf-8'), indent=1)
for x in out:
    dtl = x['detail'] if len(x['detail']) <= 300 else x['detail'][:300] + '...'
    print(f"  {'PASS' if x['pass'] else 'FAIL'}  {x['id']} {x['name']}  [{dtl}]")
np_ = sum(1 for x in out if x['pass'])
nf = len(out) - np_
print(f'TOTAL pass={np_} fail={nf}')
if nf:
    print('FAILED: ' + ' '.join(x['id'] for x in out if not x['pass']))
print('RESULT: GREEN' if nf == 0 else 'RESULT: RED')
