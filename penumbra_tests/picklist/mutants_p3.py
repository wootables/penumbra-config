"""picklist suite, date columns (2026-11-12, DATE_SPEC.md phase 3a): each mutant a single-point revert of a build (--dir:
js/main.js, js/penumbra_fields.js, css/penumbra_fields.css; a file it lacks comes from the live webroot), run through
run.py's date scenario that should catch it: exactly its `must` checks go red.

    py -3 mutants_p3.py --dir DIR [NAME,NAME]
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
if '--dir' not in _a: sys.exit('usage: mutants_p3.py --dir DIR [NAME,NAME]')
_i = _a.index('--dir'); STAGE = _a[_i + 1]; del _a[_i:_i + 2]
FILES = ['js/penumbra_fields.js', 'css/penumbra_fields.css', 'js/penumbra_colmenu.js', 'js/penumbra_cards.js', 'js/main.js']
MJ, PF = 'js/main.js', 'js/penumbra_fields.js'

M = {
    # main.js
    'cleandate': (MJ, "if (!f || (f.type !== 'pick' && f.type !== 'date') || per[f.type] >= 4) return;", "if (!f || f.type !== 'pick' || per[f.type] >= 4) return;",
                  'datesetup', ['V-render', 'V-add', 'V-rename', 'V-save', 'V-caps', 'V-kept', 'V-remove', 'V-cap-btn']),   # V-add fails: the rest unrecorded
    'cleanper': (MJ, "if (!f || (f.type !== 'pick' && f.type !== 'date') || per[f.type] >= 4) return;", "if (!f || (f.type !== 'pick' && f.type !== 'date') || out.length >= 4) return;",
                 'datesetup', ['V-caps']),
    'keptload': (MJ, "                window._penumbraJournalFieldsKept = penumbraKeptJournalFields(", "                window._penumbraJournalFieldsKeptX = penumbraKeptJournalFields(",
                 'datesetup', ['V-render', 'V-save']),
    'savetype': (MJ, "                if (f.type === 'date') {\r\n                    var dd = { key: f.key, type: 'date', label: f.label || 'Due' };",
                 "                if (false) {\r\n                    var dd = { key: f.key, type: 'date', label: f.label || 'Due' };", 'datesetup', ['V-save']),
    'keptsave': (MJ, "            }).concat(_pnbJfKept);", "            });", 'datesetup', ['V-save']),
    'hlkind': (MJ, "((jk === 'on' || jDate) ? 'date' : 'text')", "(jk === 'on' ? 'date' : 'text')", 'date', ['T-hlkind']),
    'setby': (MJ, "var fset = fdefs[fi].type === 'date' ? ' set' : '';", "var fset = '';", 'datewho', ['W2-search']),
    'sethead': (MJ, "paintWhoHead(fwth, fields[i].label, fwh ? 'on' : 'by', fields[i].type === 'date');", "paintWhoHead(fwth, fields[i].label, fwh ? 'on' : 'by');",
                'datewho', ['W2-heads']),
    'granular': (MJ, "if (!p || !p.date || !p.date.isValid() || (p.granularity !== 'day' && p.granularity !== 'second')) return null;",
                 "if (!p || !p.date || !p.date.isValid()) return null;", 'date', ['T-resolve']),
    'daycmp': (MJ, "            if (_csDc) { _csComparatorCache[cacheKey] = _csDc; return _csDc; }", "            if (false) { }", 'dategroup', ['Q-bands']),
    # penumbra_fields.js
    'optof': (PF, "if (!def || !id || !def.options) return null;", "if (!def || !id) return null;", 'date',
              ['T-cells', 'T-save', 'T-shows', 'T-checked', 'T-clear', 'T-rowmenu', 'E-date']),   # a save repaints the cell: it throws first
    'labelof': (PF, "        if (isDate(def)) return isoOk(v) ? v : '(not a date)';   // (2026-11-12) a date column's text is its day\n", "",
                'datefilter', ['Y-overdue', 'Y-soon', 'Y-oldname', 'Y-later', 'Y-month', 'Y-bucket', 'Y-bucketlist']),
    'cell': (PF, "        if (isDate(def)) {   // (2026-11-12) a date column: its day as text", "        if (false) {   // (2026-11-12) a date column: its day as text",
             'date', ['T-cells', 'T-shows']),
    'items': (PF, "return isDate(defOf(fk)) ? dateItems(fk, rk, anchor) : pickItems(fk, rk);", "return pickItems(fk, rk);",
              'date', ['T-menu', 'T-save', 'T-shows', 'T-checked', 'T-clear', 'T-rowmenu', 'E-date']),   # pickItems on a date column throws
    'fixphrase': (PF, "setField(b.rk, b.fk, v ? b.iso : null);", "setField(b.rk, b.fk, v ? v : null);", 'datebox', ['X-save']),
    'nopreview': (PF, "_box.$el.find('.pnb-datebox-save').prop('disabled', !!v && !iso);", "_box.$el.find('.pnb-datebox-save').prop('disabled', false);",
                  'datebox', ['X-bad']),
    'constrain': (PF, "showOn: 'button', buttonText: 'Calendar',\n                                 constrainInput: false,", "showOn: 'button', buttonText: 'Calendar',\n                                 ", 'datebox', ['X-keys']),
    'escape': (PF, "        e.stopPropagation();\n        closeDateBox(true);\n    }, true);", "        e.stopPropagation();\n    }, true);", 'datebox', ['X-escape']),
    'focusback': (PF, "        if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }\n    }\n    // (2026-11-12) a cell the reader can see",
                  "    }\n    // (2026-11-12) a cell the reader can see", 'datebox', ['X-save', 'X-escape']),
    'outside': (PF, "        closeDateBox(false);\n    });\n\n    P.fields = {", "    });\n\n    P.fields = {", 'datebox', ['X-outside']),
    'addcap': (PF, "$('#journalAddDateBtn').prop('disabled', lock || defsOf('date').length >= MAX_FIELDS);", "$('#journalAddDateBtn').prop('disabled', lock);",
               'datesetup', ['V-cap-btn']),
    'renderdate': (PF, "            if (isDate(d[i])) { html += dateDefHtml(d[i]); continue; }   // (2026-11-12) a date column\n", "",
                   'datesetup', ['V-render', 'V-add', 'V-rename', 'V-save', 'V-caps', 'V-kept', 'V-remove', 'V-cap-btn', 'E-datesetup']),   # V-add fails: the rest unrecorded
}


def run(name):
    f, old, new, scns, must = M[name]
    d = tempfile.mkdtemp(prefix='pnb_p3m_')
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
        dead = [x for x in red if x.startswith('F-') and x[2:] in scns.split(',')]
        ok = sorted(must) == red
        return ok, 'red: %s%s' % (' '.join(red), ('  DEAD ' + ' '.join(dead)) if dead else '')
    finally:
        shutil.rmtree(d, ignore_errors=True)


names = _a[0].split(',') if _a else list(M)
good = bad = 0
for nm in names:
    ok, why = run(nm)
    good += ok
    bad += (not ok)
    print('  %s  mutant %-10s turns %s red   [%s]' % ('PASS' if ok else 'FAIL', nm, ' '.join(M[nm][4]), why), flush=True)
print('SUMMARY mutants ok=%d bad=%d' % (good, bad))
print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
