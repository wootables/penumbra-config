"""picklist suite, phase 2 mutants (2026-11-11): each a single-point revert of a build (--dir: js/penumbra_fields.js,
css/penumbra_fields.css, js/penumbra_colmenu.js, js/penumbra_cards.js, js/main.js; a file it lacks comes from the live
webroot), run through run.py's phase 2 scenarios (rowmenu, bulk, cards): exactly its `must` checks go red.

    py -3 mutants_p2.py --dir DIR [NAME,NAME]
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
SUITE = HERE
_a = sys.argv[1:]
if '--dir' not in _a: sys.exit('usage: mutants_p2.py --dir DIR [NAME,NAME]')
_i = _a.index('--dir'); STAGE = _a[_i + 1]; del _a[_i:_i + 2]
FILES = ['js/penumbra_fields.js', 'css/penumbra_fields.css', 'js/penumbra_colmenu.js', 'js/penumbra_cards.js', 'js/main.js']
D_ALL = ['D-pill', 'D-pick', 'D-shows', 'D-field', 'D-empty', 'D-menu', 'D-details']
B_ALL = ['B-item', 'B-sub', 'B-confirm', 'B-post', 'B-toast', 'B-undo', 'B-filtered', 'B-escape']

M = {
    'rowitems': ('js/penumbra_colmenu.js',
                 "if (tr && window.Penumbra.fields && typeof window.Penumbra.fields.rowMenuItems === 'function') { window.Penumbra.fields.rowMenuItems(tr).forEach(function (it) { items.push(it); }); }",
                 '', 'rowmenu,cards', ['R-item', 'R-sub', 'R-save', 'R-head', 'D-menu']),
    'headitem': ('js/penumbra_colmenu.js', "        if (fhi) { items.push(fhi); items.push('-'); }\n", '', 'rowmenu,bulk', ['R-head'] + B_ALL),
    'shownkeys': ('js/main.js', "            shownKeys: function (tbl) { return shownRowKeys(toggleReachTables(tbl)); },   // (picklist phase 2) a pick list heading's rows\r\n",
                  '', 'bulk', B_ALL),
    'escape': ('js/penumbra_fields.js', "setFieldsBulk(fk, values, opt ? 'set to ' + esc(opt.label) : 'cleared');", "setFieldsBulk(fk, values, opt ? 'set to ' + opt.label : 'cleared');",
               'bulk', ['B-escape']),
    'already': ('js/penumbra_fields.js', "            if (v === id) { already++; return; }", "            if (v === id) { already++; delete values[rk]; return; }",
                'bulk', ['B-post', 'B-toast']),
    'whose': ('js/penumbra_fields.js', "            if (v && m.by && m.by !== mine) others[m.by] = 1;\n", '', 'bulk', ['B-confirm']),
    'retired': ('js/penumbra_fields.js', "            if (!o.retired) items.push({ act: 'bulk-' + o.id,", "            items.push({ act: 'bulk-' + o.id,", 'bulk', ['B-sub']),
    'grpcount': ('js/penumbra_fields.js', "var keys = tbl ? h.shownKeys(tbl) : [], n = keys.length;", "var keys = tbl ? h.shownKeys(tbl) : [], n = keys.length + 1;", 'bulk', ['B-item', 'B-filtered']),
    'pill': ('js/penumbra_cards.js', "        if (h.field) return (filled(td) || fieldSettable(td, h)) ? ", "        if (false) return (filled(td) || fieldSettable(td, h)) ? ", 'cards', D_ALL),
    'takepill': ('js/penumbra_cards.js', "        if (!r.pill && cfg.pill) r.pill = takeField(cfg.pill);\n", '', 'cards', D_ALL),
    'fieldslot': ('js/penumbra_cards.js', "        if ((cfg.fields || []).some(function (n) { return by[n] && by[n].field; })) {", "        if (false) {", 'cards', ['D-field', 'D-empty']),
    'settable': ('js/penumbra_cards.js', "if (filled(tf) || fieldSettable(tf, r.fields[i])) fh += ", "if (filled(tf)) fh += ", 'cards', ['D-field', 'D-empty']),
    'cardmenu': ('js/penumbra_cards.js', "            if (/^field-/.test(it.act)) { out.push(it); return; }   // (picklist phase 2) the row's pick lists: Status >\n", '', 'cards', ['D-menu']),
    'details': ('js/penumbra_cards.js', "            if (c.field && (!c.hidden || onCard[c.name])) { var tcf = cellOf(tr, c);", "            if (false) { var tcf = cellOf(tr, c);", 'cards', ['D-details']),
    'emptycss': ('css/penumbra_fields.css', "    content: '+ ' attr(data-field-label); opacity: .65; font-size: .92em; }", "    opacity: .65; font-size: .92em; }", 'cards', ['D-pill']),
    'labelattr': ('js/penumbra_fields.js', "            + ' data-field-label=\"' + esc(def.label) + '\"'   // (phase 2) a card's empty pill says what it sets (css)\n", '', 'cards', ['D-pill']),
}


def run(name):
    f, old, new, scns, must = M[name]
    d = tempfile.mkdtemp(prefix='pnb_p2m_')
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
        r = subprocess.run([sys.executable, '-u', os.path.join(SUITE, 'run.py'), '--dir', d, '--scn', scns], capture_output=True, cwd=SUITE,
                           env=dict(os.environ, PYTHONIOENCODING='utf-8'), timeout=1500)
        out = r.stdout.decode('utf-8', 'replace')
        red = sorted(set(re.findall(r'^\s+FAIL\s+(\S+)', out, re.M)))
        dead = [x for x in red if x.startswith('E-') or x.startswith('F-')]
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
