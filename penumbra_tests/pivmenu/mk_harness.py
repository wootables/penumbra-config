# pivmenu harness (2026-10-17): the pvshade harness (the REAL main.js, a saved pivot:
# H_GROUP > H_GROUP2 down, V_STATUS across, sum of H_AMT) PLUS the pivot builder lifted
# from the index.php under test (so a rebuild runs the real Generate), a visible Pivot
# toolbar button, the tile engine (the search strip's grammar) and the menu module.
import os, re
PVSHADE = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pvshade\harness.html'


def lift_builder(index_src):
    s = index_src.replace('\r\n', '\n')
    i = s.find('<div id="pivotLightbox" class="help-lightbox">')
    if i < 0:
        raise SystemExit('lift: the pivot builder not found in index.php')
    j = s.find('\n</div>\n', i)
    if j < 0:
        raise SystemExit('lift: the pivot builder has no end')
    b = s[i:j + 7]
    b = re.sub(r'<\?php\s*/\*.*?\*/\s*\?>', '', b, flags=re.S)
    if '<?' in b:
        k = b.index('<?')
        raise SystemExit('lift: PHP left in the pivot builder: %r' % b[k:k + 120])
    return b.replace('<div id="pivotLightbox" class="help-lightbox">', '<div id="pivotLightbox" class="help-lightbox" style="display:none">', 1)


def build(index_src):
    src = open(PVSHADE, encoding='utf-8').read()

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<table id="pivot-agg-table"><thead><tr><th class="pat-opt"></th></tr></thead><tbody id="pivot-agg-table-body"></tbody></table>\n',
        '<button id="pivotBtn" type="button">Pivot</button>\n' + lift_builder(index_src) + '\n')
    rep('<script src="help_stub.js"></script>\n', '<script src="penumbra_tiles.js"></script>\n<script src="help_stub.js"></script>\n')
    rep('<script src="driver.js"></script>\n', '<link rel="stylesheet" href="penumbra_colmenu.css">\n<script src="penumbra_colmenu.js"></script>\n<script src="driver.js"></script>\n')
    return src
