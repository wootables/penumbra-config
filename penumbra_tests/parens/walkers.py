# =============================================================================
# PARENS SUITE, the walkers (2026-10-31 sweep): the helpers that read a parsed tree by position must read
# through groups the same way in the browser and on the server.
#   JS  (headless Edge, the real main.js with hooks): splitGroupSummaryQuery, penumbraQuerySide,
#       penumbraCollapseLogicals, penumbraQueryLeaves, over parseAdvancedQuery's trees
#   PHP (penumbra_search.php + the runner's mirror): _cf_split_group_summary_query (twin of the JS split),
#       _journal_normalize_toggle_conditions (walks into groups), _search_query_leaves
#   py -3 walkers.py [--stage DIR]      EXPECTED: GREEN
# =============================================================================
import argparse, html, json, os, shutil, subprocess, sys, tempfile, time
HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = os.path.dirname(HERE)
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EXTRACT = os.path.join(TESTS, 'pivotparity', 'extract_mirror.php')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(EDGE):
    EDGE = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js']
COLS = ['#', 'ID', 'A', 'B', 'C', 'AMOUNT', 'Sum of AMOUNT', 'Txns']   # the aggregate labels are columns in the pivot search's list
AGG = ['SUM OF AMOUNT', 'TXNS']
QUERIES = {
    'flat':        'A = 1 and Sum of AMOUNT > 5 and B = 2',
    'grp-sum':     '(Sum of AMOUNT > 5 or A = 1) and B = 2',
    'grp-sumonly': 'B = 2 and (Sum of AMOUNT > 5 and Sum of AMOUNT < 9)',
    'grp-nested':  '((Sum of AMOUNT > 5 or A = 1) and C = 3) or B = 2',
    'grp-mixed':   '(A = 1 or Txns > 2) and B = 2',
    'grp-src':     '(A = 1 or B = 2) and Txns > 2',
    'grp-agg':     'A = 1 and (Txns > 2 or Sum of AMOUNT > 5)',
    'empty-mid':   'A = 1 () and B = 2',
    'global-grp':  '(zq or A = 1) and B = 2',
    'brace-space': '({ A } = 1 or {B} = 2) and {C} = 3',
}
# Expected: the summary split lifts every `Sum of AMOUNT` condition out (ANDed), what remains of a group stays
EXPECT_GSPLIT = {
    'flat':        {'rows': 'A = 1 and B = 2', 'sum': 1},
    'grp-sum':     {'rows': 'A = 1 and B = 2', 'sum': 1},
    'grp-sumonly': {'rows': 'B = 2', 'sum': 2},
    'grp-nested':  {'rows': '(A = 1 and C = 3) or B = 2', 'sum': 1},
    'grp-mixed':   {'rows': '(A = 1 or Txns > 2) and B = 2', 'sum': 0},
    'empty-mid':   {'rows': 'A = 1 and B = 2', 'sum': 0},
}
EXPECT_SIDE = {'grp-mixed': 'mixed', 'grp-src': 'src', 'grp-agg': 'agg', 'global-grp': 'src'}


def log(s):
    print(s, flush=True)


def other_headless_edge():
    ps = ("Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
          "Where-Object { $_.CommandLine -match '--headless' -and $_.CommandLine -notmatch 'pnb_parensw_' } | "
          "Measure-Object | ForEach-Object { $_.Count }")
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True, timeout=60).stdout
        return int((out or '0').strip() or 0)
    except Exception:
        return 0


def render(parts):
    # a parsed list back to text, groups in parentheses, for the comparisons
    out = []
    for p in parts:
        if p.get('type') == 'logical':
            out.append(p['op'])
        elif p.get('type') == 'group':
            out.append('(' + render(p['parts']) + ')')
        elif p.get('type') == 'condition':
            out.append('%s %s %s' % (p.get('column'), p.get('op'), p.get('value')))
        elif p.get('type') == 'global':
            out.append(str(p.get('value')))
        else:
            out.append('%s %s %s' % (p.get('leftValue'), p.get('op'), p.get('value')))
    return ' '.join(out)


def browser_half(mainjs):
    work = tempfile.mkdtemp(prefix='pnb_parensw_')
    try:
        for f in LIBS:
            shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(work, f))
        shutil.copyfile(os.path.join(APP, 'js', 'penumbra_tiles.js'), os.path.join(work, 'penumbra_tiles.js'))
        h = open(os.path.join(HERE, 'harness.html'), encoding='utf-8').read()
        i = h.index('<script src="corpus.js"></script>')
        j = h.index('</body></html>')
        tail = """<script src="main_patched.js"></script>
<script>
$(function () { setTimeout(function () {
  var W = window.__W, Q = %s, COLS = %s, AGG = %s, out = { trees: {}, gsplit: {}, side: {}, gside: {}, collapse: {}, leaves: {}, errors: [] };
  function enc(x) { return JSON.parse(JSON.stringify(x)); }
  try {
    if (!W) throw new Error('hooks unavailable: ' + (window.__W_ERR || 'n/a'));
    Object.keys(Q).forEach(function (k) {
      var tree = W.parseQ(Q[k], COLS);
      out.trees[k] = enc(tree);
      var gs = W.gsplit(tree, 'SUM OF AMOUNT');
      out.gsplit[k] = { rows: enc(gs.rowParts), sum: gs.summaryConds.length };
      out.side[k] = tree.map(function (p) { return W.side(p, AGG); });
      out.gside[k] = null;
      for (var gi = 0; gi < tree.length; gi++) { if (tree[gi].type === 'group') { out.gside[k] = W.side(tree[gi], AGG); break; } }
      out.leaves[k] = W.leaves(tree).length;
    });
    out.collapse.dbl = enc(W.collapse([{ type: 'condition', column: 'A', op: '=', value: '1' }, { type: 'logical', op: 'and' }, { type: 'logical', op: 'or' }, { type: 'condition', column: 'B', op: '=', value: '2' }]));
  } catch (e) { out.errors.push(String(e && e.stack || e)); }
  document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(out);
}, 30); });
</script>
""" % (json.dumps(QUERIES), json.dumps(COLS), json.dumps(AGG))
        h = h[:i] + tail + h[j:]
        with open(os.path.join(work, 'harness.html'), 'w', encoding='utf-8', newline='') as f:
            f.write(h)
        src = open(mainjs, 'rb').read().decode('utf-8')
        anchor = '$(document).ready(function () {'
        hooks = ('try { window.__W = { parseQ: parseAdvancedQuery, gsplit: splitGroupSummaryQuery, side: penumbraQuerySide, '
                 'collapse: penumbraCollapseLogicals, leaves: penumbraQueryLeaves }; } catch (e) { window.__W_ERR = String(e); }')
        k = src.index(anchor)
        src = src[:k] + anchor + '\r\n    ' + hooks + '\r\n' + src[k + len(anchor):]
        with open(os.path.join(work, 'main_patched.js'), 'w', encoding='utf-8', newline='') as f:
            f.write(src)
        waited = 0
        while other_headless_edge() and waited < 1200:
            if waited == 0:
                log('      another headless Edge is running - waiting ...')
            time.sleep(15); waited += 15
        url = 'file:///' + work.replace('\\', '/') + '/harness.html'
        args = [EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--allow-file-access-from-files',
                '--user-data-dir=' + os.path.join(work, 'profile'), '--virtual-time-budget=30000', '--dump-dom', url]
        d = subprocess.run(args, capture_output=True, timeout=300).stdout.decode('utf-8', 'replace')
        i = d.find('<pre id="out">'); j = d.find('</pre>', i)
        txt = html.unescape(d[i + 14:j])
        if not txt.startswith('RESULTS_JSON:'):
            return {'fatal': txt[:400]}
        return json.loads(txt[13:])
    finally:
        for _ in range(5):
            try:
                shutil.rmtree(work); break
            except OSError:
                time.sleep(2)


def server_half(search_php, runner_php):
    tmp = tempfile.mkdtemp(prefix='pnb_parensw_php_')
    try:
        mp = os.path.join(tmp, 'mirror.php')
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', EXTRACT, runner_php, mp], capture_output=True, timeout=300)
        if r.returncode != 0:
            return {'fatal': 'extract_mirror: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:800]}
        side = os.path.join(tmp, 'side.php')
        with open(side, 'w', encoding='utf-8') as f:
            f.write("""<?php
error_reporting(E_ALL); ini_set('display_errors', '1');
require_once $argv[2]; if (!function_exists('php_apply_search_filter')) require_once $argv[1];   // the mirror first (the runner carries the search engine)
if (!function_exists('journalToggleWantExport')) { function journalToggleWantExport($v) { $v = strtolower(trim((string)$v)); if (in_array($v, array('1', 'yes', 'true', 'checked'), true)) return true; if (in_array($v, array('0', 'no', 'false', 'unchecked'), true)) return false; return null; } }
$Q = json_decode($argv[3], true); $cols = json_decode($argv[4], true);
$out = array('trees' => array(), 'gsplit' => array(), 'cfsplit' => array(), 'leaves' => array(), 'toggle' => null);
foreach ($Q as $k => $q) {
    $t = php_parse_search_query($q, $cols); $out['trees'][$k] = $t;
    $g = _cf_split_group_summary_query($t, 'SUM OF AMOUNT');
    $out['gsplit'][$k] = array('rows' => $g['rowParts'], 'sum' => count($g['summaryConds']));
    $f = parse_format_condition($q, $cols);
    $out['cfsplit'][$k] = ($f === $t);
    $out['leaves'][$k] = count(_search_query_leaves($t));
}
$tg = php_parse_search_query('(Done = yes or A = 1) and B = 2', array('Done', 'A', 'B'));
$n = _journal_normalize_toggle_conditions($tg, array('colNames' => array('Done')));
$out['toggle'] = $n;
echo json_encode($out);
""")
        r = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', '-d', 'display_errors=1', side, search_php, mp, json.dumps(QUERIES), json.dumps(COLS)], capture_output=True, timeout=300)
        if r.returncode != 0:
            return {'fatal': 'php rc=%d: %s' % (r.returncode, (r.stdout + r.stderr).decode('utf-8', 'replace')[:1500] or '(no output)')}
        try:
            return json.loads(r.stdout.decode('utf-8'))
        except ValueError:
            return {'fatal': 'no JSON: ' + (r.stdout + r.stderr).decode('utf-8', 'replace')[:1500]}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default='')
    a = ap.parse_args()
    def pick(rel):
        p = os.path.join(a.stage, rel.replace('/', os.sep)) if a.stage else ''
        return p if p and os.path.isfile(p) else os.path.join(APP, rel.replace('/', os.sep))
    js = browser_half(pick('js/main.js'))
    srv = server_half(pick('penumbra_search.php'), pick('schedule_runner.php'))
    res = []
    def chk(n, ok, d):
        res.append((n, bool(ok), d))
    chk('H-boot', not js.get('fatal') and not js.get('errors'), '%s %s' % (js.get('fatal'), js.get('errors')))
    chk('S-boot', not srv.get('fatal'), srv.get('fatal'))
    if not js.get('fatal') and not srv.get('fatal'):
        for k in QUERIES:
            chk('T-' + k, js['trees'][k] == srv['trees'][k], 'js %s | php %s' % (render(js['trees'][k]), render(srv['trees'][k])))
            chk('F-' + k, srv['cfsplit'][k], 'parse_format_condition differs from php_parse_search_query')
            jg, sg = js['gsplit'][k], srv['gsplit'][k]
            chk('G-' + k, render(jg['rows']) == render(sg['rows']) and jg['sum'] == sg['sum'], 'js %s (%d) | php %s (%d)' % (render(jg['rows']), jg['sum'], render(sg['rows']), sg['sum']))
            if k in EXPECT_GSPLIT:
                chk('E-' + k, render(jg['rows']) == EXPECT_GSPLIT[k]['rows'] and jg['sum'] == EXPECT_GSPLIT[k]['sum'], 'got %s (%d), want %s (%d)' % (render(jg['rows']), jg['sum'], EXPECT_GSPLIT[k]['rows'], EXPECT_GSPLIT[k]['sum']))
            chk('L-' + k, js['leaves'][k] == srv['leaves'][k], 'js %s php %s' % (js['leaves'][k], srv['leaves'][k]))
        for k, want in EXPECT_SIDE.items():
            got = js['gside'].get(k)   # the side of the (first) group part
            chk('S-' + k, got == want, 'group side %s (parts %s) want %s' % (got, js['side'][k], want))
        chk('C-collapse', render(js['collapse']['dbl']) == 'A = 1 and B = 2', render(js['collapse']['dbl']))
        tg = srv['toggle']
        inner = tg[0]['parts'][0] if tg and tg[0].get('type') == 'group' else None
        chk('J-toggle', inner is not None and inner.get('value') == '1', 'toggle inside a group: %s' % json.dumps(inner))
    reds = [n for n, ok, d in res if not ok]
    for n, ok, d in res:
        if not ok:
            log('  RED   %s\n        %s' % (n, str(d)[:600]))
    log('walkers: %d asserts, %d red: %s' % (len(res), len(reds), 'GREEN' if not reds else 'FAIL'))
    sys.exit(0 if not reds else 1)


if __name__ == '__main__':
    main()
