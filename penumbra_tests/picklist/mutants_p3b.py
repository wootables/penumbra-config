"""picklist suite, date columns phase 3b (2026-11-12, DATE_SPEC.md 7): each mutant a single-point revert of a build (--dir:
js/main.js, js/penumbra_fields.js, css/penumbra_fields.css; a file it lacks comes from the live webroot), run through
run.py's scenarios that should catch it: exactly its `must` checks go red.

    py -3 mutants_p3b.py --dir DIR [NAME,NAME]
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
_a = sys.argv[1:]
if '--dir' not in _a: sys.exit('usage: mutants_p3b.py --dir DIR [NAME,NAME]')
_i = _a.index('--dir'); STAGE = _a[_i + 1]; del _a[_i:_i + 2]
FILES = ['js/penumbra_fields.js', 'css/penumbra_fields.css', 'js/penumbra_colmenu.js', 'js/penumbra_cards.js', 'js/main.js']
MJ, PF = 'js/main.js', 'js/penumbra_fields.js'
LALL = ['L-item', 'L-sub', 'L-confirm', 'L-post', 'L-toast', 'L-undo', 'L-box', 'L-already', 'L-clear']

M = {
    # penumbra_fields.js: the heading's bulk set, the date box for many rows, the box at a card
    'bulkgate': (PF, "        if (!def) return null;\n        var grp = !!th.closest(", "        if (!def || isDate(def)) return null;\n        var grp = !!th.closest(",
                 'datebulk', LALL),   # no item: the rest unrecorded
    'bulkdate': (PF, "        if (isDate(def)) return dateBulkItems(fk, keys);\n", "", 'datebulk', LALL[1:] + ['E-datebulk']),
    'bulkwords': (PF, "(isDate(def) ? 'dates' : 'values')", "'values'", 'datebulk', ['L-confirm']),
    'already': (PF, "toast(dt ? 'All '", "toast(false ? 'All '", 'datebulk', ['L-already']),
    'boxbulk': (PF, "        if (b.bulk) { bulkSet(b.fk, b.bulk, v ? dayOpt(b.iso) : null); return; }", "        if (false) { }", 'datebulk', ['L-box', 'L-already', 'L-clear']),   # L-clear then clears the 4 dated rows, not N
    'cardanchor': (PF, "        if (!bulk && anchor && !shownCell(anchor)) {", "        if (false) {", 'datecards', ['DC-menu']),
    # main.js: period bands, the search's period conditions, the builder
    'jvariants': (MJ, "        if (_pnbJournalDateColumn(col)) {", "        if (false) {", 'datebands,datefilter', ['M-variants', 'Y-bucketvars']),
    'jgroupload': (MJ, "|| (window.Penumbra.journalFieldBucketLabel && window.Penumbra.journalFieldBucketLabel(t))));", "|| false));",
                   'datebands', ['M-bands', 'M-rows', 'M-moves']),
    'jbandpath': (MJ, "            _jToggleLabel = window.Penumbra.journalFieldBucketLabel(selectedColumn);", "            _jToggleLabel = null;",
                  'datebands', ['M-bands', 'M-rows', 'M-moves']),
    'jlevel': (MJ, "            _jLab = window.Penumbra.journalFieldBucketLabel(token);", "            _jLab = null;", 'datenest', ['N-nested']),
    'jstale': (MJ, " || window.Penumbra.journalFieldBucketLabel(gcol);   // (3b) Due:ym", ";   // (3b) Due:ym", 'datebands', ['M-moves']),
    'jbucketpart': (MJ, "        if (jv && jv.kind === 'text') return penumbraSearchBucketTest(b, c.op, c.value, jv.value, testCondition);", "",
                    'datefilter', ['Y-bucket']),
    'jcalendar': (MJ, "            if (colName && _pnbJournalDateColumn(colName)) {", "            if (false) {", 'datefilter', ['Y-calendar']),
    'jbucketvals': (MJ, "                if (jv && jv.kind === 'text') raw = jv.value;", "", 'datefilter', ['Y-bucketlist']),
    'jbucketname': (MJ, "                if (f && f.type === 'date' && f.label) { var u = String(f.label).toUpperCase(); if (!(u in map)) map[u] = String(f.label); }", "",
                    'datefilter', ['Y-bucketlist']),
}


def run(name):
    f, old, new, scns, must = M[name]
    d = tempfile.mkdtemp(prefix='pnb_p3bm_')
    try:
        for rel in FILES:
            os.makedirs(os.path.join(d, os.path.dirname(rel)), exist_ok=True)
            src_f = os.path.join(STAGE, rel)
            shutil.copyfile(src_f if os.path.isfile(src_f) else os.path.join(APP, rel), os.path.join(d, rel))
        p = os.path.join(d, f)
        src = open(p, 'rb').read().decode('utf-8', 'surrogateescape')
        n = src.count(old)
        if n != 1:
            return False, 'anchor found %d times' % n
        open(p, 'wb').write(src.replace(old, new).encode('utf-8', 'surrogateescape'))
        r = subprocess.run([sys.executable, '-u', os.path.join(HERE, 'run.py'), '--dir', d, '--scn', scns], capture_output=True, cwd=HERE,
                           env=dict(os.environ, PYTHONIOENCODING='utf-8'), timeout=1500)
        out = r.stdout.decode('utf-8', 'replace')
        red = sorted(set(re.findall(r'^\s+FAIL\s+(\S+)', out, re.M)))
        ok = sorted(must) == red
        return ok, 'red: %s' % ' '.join(red)
    finally:
        shutil.rmtree(d, ignore_errors=True)


names = _a[0].split(',') if _a else list(M)
good = bad = 0
for nm in names:
    ok, why = run(nm)
    good += ok
    bad += (not ok)
    print('  %s  mutant %-11s turns %s red   [%s]' % ('PASS' if ok else 'FAIL', nm, ' '.join(M[nm][4]), why), flush=True)
print('SUMMARY mutants ok=%d bad=%d' % (good, bad))
print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
