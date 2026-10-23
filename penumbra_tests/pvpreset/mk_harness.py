# pvpreset harness (2026-10-22): the pvshade harness (the REAL main.js, a saved pivot: H_GROUP >
# H_GROUP2 down, V_STATUS across, sum of H_AMT, Frozen 2) PLUS the pivot builder lifted from the
# index.php under test (pivmenu's lift) and the shared preset engine with its css, loaded before
# main.js as index.php loads it - so the builder's Presets chip mounts on the real
# _pivotBuildSnapshotFromBuilder (getState) and _pivotApplySnapshot (applyState).
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
PVSHADE = os.path.join(os.path.dirname(HERE), 'pvshade', 'harness.html')


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
    if b.count('id="pivotPresetMount"') != 1:
        raise SystemExit('lift: the Presets chip slot (#pivotPresetMount) not found once in the builder')
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
    rep('<link rel="stylesheet" href="penumbra_colwidths.css">\n', '<link rel="stylesheet" href="penumbra_colwidths.css">\n<link rel="stylesheet" href="penumbra_presets.css">\n')
    rep('<script src="help_stub.js"></script>\n', '<script src="penumbra_presets.js"></script>\n<script src="help_stub.js"></script>\n')
    return src
