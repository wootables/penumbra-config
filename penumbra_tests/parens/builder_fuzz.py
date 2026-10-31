# =============================================================================
# PARENS SUITE, builder round trips (2026-10-31 sweep): filter text -> rows -> the builder's wire text, and that
# text through the rows again must be a fixed point. No engine on the page (the dashboard's case): the text
# splitter decides the groups. Uses builder_run.py's harness boot with its own page script.
#   py -3 builder_fuzz.py [--stage DIR]      EXPECTED: GREEN
# =============================================================================
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import builder_run as B

CASES = [
    ('(A = 1 or B = 2) and C = 3', '(A = 1 or B = 2) and C = 3'),
    ('A = 1 and (B = 2 or C = 3) and D = 4', 'A = 1 and (B = 2 or C = 3) and D = 4'),
    ('(A = 1 or B = 2) and (C = 3 or D = 4)', '(A = 1 or B = 2) and (C = 3 or D = 4)'),
    ('__ROW (A = 1 or B = 2) and C = 3', '(A = 1 or B = 2) and C = 3'),   # no nested column on this page: the builder unticks __ROW
    ('(A >= 1 and A <= 5) or B = 2', 'A >= 1 and A <= 5 or B = 2'),
    ('(A = 1 or A = 2) and B = 3', '(A = 1 or A = 2) and B = 3'),
    ("A = 'x y' and (B = 2 or C = 3)", "A = 'x y' and (B = 2 or C = 3)"),
    ('(A = /^(?:x|y)$/ or B = 2) and C = 3', '(A = /^(?:x|y)$/ or B = 2) and C = 3'),
    ('(A = 1)', 'A = 1'),
    ('() and A = 1', 'A = 1'),
    ('( A = 1 or B = 2 ) and C = 3', '(A = 1 or B = 2) and C = 3'),
    ('(A = 1 or B = 2) C = 3', '(A = 1 or B = 2) and C = 3'),
    ('A = 1 (B = 2 or C = 3)', 'A = 1 and (B = 2 or C = 3)'),
    ('(A = 1 or B = 2) and C = 3 or D = 4', '(A = 1 or B = 2) and C = 3 or D = 4'),
    ('A = 1 or (B = 2 and C = 3)', 'A = 1 or (B = 2 and C = 3)'),
    ('D = (x) and A = 1', 'D = (x) and A = 1'),
    ('(A = 1 or B = 2) and D = (x)', '(A = 1 or B = 2) and D = (x)'),
    ('(A != 1 or B != 2) and C = 3', '(A != 1 or B != 2) and C = 3'),
    ('(A = empty or B = 2) and C = 3', '(A = empty or B = 2) and C = 3'),
    ('(A > 1 or B < 2) and C = 3', '(A > 1 or B < 2) and C = 3'),
]
SCRIPT = """
(function () {
  function report(txt) { document.getElementById('out').textContent = txt; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var CASES = %s, out = { cases: [], errors: [] };
  delete window._penumbraSearchAPI.parseQuery;   // no engine: the text decides
  function openWith(q) { $('#tableSearch').val(q); window.openSearchBuilder(); return wait(100); }
  function st() { var s = window.__presetOpts.getState(); return s ? s.query : null; }
  function toggles() { return $('#sbConditionsContainer .sb-condition-row').map(function () { return $(this).find('.sb-row-group').attr('aria-pressed') === 'true'; }).get(); }
  (async function () {
    try {
      for (var i = 0; i < CASES.length; i++) {
        var text = CASES[i][0];
        await openWith(text);
        var q1 = st(), t1 = toggles(), guarded = $('#sbSubmitBtn').prop('disabled');
        await openWith(q1 || '');
        var q2 = st();
        out.cases.push({ text: text, q1: q1, q2: q2, toggles: t1, guarded: guarded });
      }
      out.errors = window.__errors.slice(0, 6);
      report('RESULTS_JSON:' + JSON.stringify(out));
    } catch (e) { report('RESULTS_JSON:' + JSON.stringify({ fatal: String(e && e.stack || e), errors: window.__errors.slice(0, 6) })); }
  })();
})();
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default='')
    a = ap.parse_args()
    def pick(rel):
        p = os.path.join(a.stage, rel.replace('/', os.sep)) if a.stage else ''
        return p if p and os.path.isfile(p) else os.path.join(B.APP, rel.replace('/', os.sep))
    page = open(os.path.join(B.HERE, 'builder.html'), encoding='utf-8').read()
    i = page.index('<script src="search_builder.js"></script>') + len('<script src="search_builder.js"></script>')
    j = page.index('</body></html>')
    page = page[:i] + '\n<script>' + SCRIPT % json.dumps(CASES) + '</script>\n' + page[j:]
    tmp = os.path.join(B.HERE, 'builder_fuzz.html')
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    orig = B.run_edge
    def run_edge(js_text, content_text):
        # the same boot, this page instead of builder.html
        import shutil
        real = os.path.join(B.HERE, 'builder.html')
        bak = real + '.fuzzbak'
        shutil.copyfile(real, bak)
        try:
            shutil.copyfile(tmp, real)
            return orig(js_text, content_text)
        finally:
            shutil.copyfile(bak, real); os.remove(bak)
    r = run_edge(B.read(pick('js/search_builder.js')), B.read(pick('search_builder_content.php')))
    if r.get('fatal'):
        print('FATAL', r['fatal']); sys.exit(1)
    reds = 0
    for c in r['cases']:
        want = dict(CASES)[c['text']]
        ok = c['q1'] == want and c['q2'] == c['q1'] and not c['guarded']
        if not ok:
            reds += 1
            print('  RED   %r -> %r (want %r); again -> %r; toggles %s; guarded %s' % (c['text'], c['q1'], want, c['q2'], c['toggles'], c['guarded']))
    print('builder fuzz: %d cases, %d red, errors %s: %s' % (len(r['cases']), reds, r.get('errors'), 'GREEN' if not reds and not r.get('errors') else 'FAIL'))
    sys.exit(0 if not reds and not r.get('errors') else 1)


if __name__ == '__main__':
    main()
