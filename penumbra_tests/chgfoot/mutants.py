"""chgfoot mutants: each breaks ONE thing the feature build does.

usage: py -3 mutants.py list
       py -3 mutants.py check <main.js> <main.css>        every anchor exactly once
       py -3 mutants.py apply <name> <main.js> <main.css> rewrite the two files in place
       py -3 mutants.py red <name>                        the checks it must turn red
Anchors are written with \\n; each is converted to the file's own line ending.
"""
import io, sys

M = {
    # the footer line comes back under the panes
    'footerback': ('js',
        """'<div class="audit-diff-body"><div class="audit-diff-note">Pick an entry on the left to see exactly what that save changed.</div></div></div></div>');""",
        """'<div class="audit-diff-body"><div class="audit-diff-note">Pick an entry on the left to see exactly what that save changed.</div></div></div></div>' + '<div class="audit-foot-note">Latest versions</div>');""",
        ['F1', 'F2', 'F3', 'F4']),
    # Pop out never shown / always shown
    'popnever': ('js',
        """$('#auditChangesPopOut').prop('hidden', _auditSeg !== 'changes');""",
        """$('#auditChangesPopOut').prop('hidden', true);""",
        ['P1', 'P6', 'P7']),
    'popalways': ('js',
        """$('#auditChangesPopOut').prop('hidden', _auditSeg !== 'changes');""",
        """$('#auditChangesPopOut').prop('hidden', false);""",
        ['P3']),
    # the tooltip loses the hotkey / the attribute goes
    'nohotkeytitle': ('js',
        """'title="(CTRL+SHIFT+Y) Pop out this version history""",
        """'title="Pop out this version history""",
        ['P2', 'P8']),
    'nokeysattr': ('js',
        """hidden aria-label="Pop out" aria-keyshortcuts="Control+Shift+Y" ' +""",
        """hidden aria-label="Pop out" ' +""",
        ['P2']),
    'noarialabel': ('js',
        """hidden aria-label="Pop out" aria-keyshortcuts="Control+Shift+Y" ' +""",
        """hidden aria-keyshortcuts="Control+Shift+Y" ' +""",
        ['P1']),
    # the UA [hidden] loses to the button's own display
    'nohiddencss': ('css',
        """#auditSegBar .audit-seg-pop[hidden] { display: none; }""",
        """""",
        ['P3']),
    # the click handler looks for the selection inside the pane, as it did from the footer
    'staleclosest': ('js',
        """var cur = $(this).closest('#auditMainRow').find('#auditSegChanges .audit-ver[aria-pressed="true"]').attr('data-audit-ver');""",
        """var cur = $(this).closest('#auditSegChanges').find('.audit-ver[aria-pressed="true"]').attr('data-audit-ver');""",
        ['P6', 'P7']),
    # Ctrl+Shift+Y ignores the button again
    'hotkeyplain': ('js',
        """if ($vhPop.length && $vhPop.is(':visible')) { $vhPop.trigger('click'); return; }""",
        """""",
        ['P7']),
    # the label never drops
    'nolabeldrop': ('css',
        """@container pnb-audit-bar (max-width: 899px) {""",
        """@container pnb-audit-bar (max-width: 1px) {""",
        ['P5']),
    # compact keeps the docked size
    'compactsize': ('css',
        """.compact-admin-mode #auditSegBar .audit-seg-pop { padding: 1px 9px; font-size: 10.5px; }""",
        """""",
        ['P5']),
    # the icon-only label leaves the box instead of going to zero width (1px short)
    'labelnone': ('css',
        """    #auditSegBar .audit-seg-pop-t { width: 0; overflow: hidden; white-space: nowrap; }""",
        """    #auditSegBar .audit-seg-pop-t { display: none; }""",
        ['P5']),
    # the outline in the bare brand (2.4-3.0:1 on three themes)
    'edgebrand': ('css',
        """    border: 1px solid var(--brand-text, var(--brand-primary, #336699));""",
        """    border: 1px solid var(--brand-primary, #336699);""",
        ['P9']),
    # without the id weight the themed button / button:hover fills get through
    'classweight': ('css',
        """#auditSegBar .audit-seg-pop {\n    display: inline-flex;""",
        """.audit-seg-pop {\n    display: inline-flex;""",
        ['P9']),
    # the filter bar as a wrapping flex row: the two 50% selects wrap
    'flexfilter': ('css',
        """       filter count, while there is one, takes a row of its own under them. */""",
        """       filter count, while there is one, takes a row of its own under them. */ display: flex !important; flex-wrap: wrap;""",
        ['C1']),
    # no count element
    'nocount': ('js',
        """'</select><span class="audit-vf-count" role="status"></span></div>';""",
        """'</select></div>';""",
        ['C1', 'C2', 'C3']),
    # no ceiling row
    'nomore': ('js',
        """var more = _auditChangesFetched >= _auditChangesLimit""",
        """var more = false""",
        ['L1', 'L2']),
    # the arrow handler takes every key in the list again
    'arrowsall': ('js',
        """if (!$(e.target).closest('.audit-verrows').length) return;""",
        """""",
        ['K1']),
}


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def eol(text, s):
    return s.replace('\n', '\r\n') if '\r\n' in text else s


def wr(p, t):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(t)


def main():
    a = sys.argv[1:]
    if not a or a[0] not in ('list', 'check', 'apply', 'red'):
        print(__doc__)
        sys.exit(2)
    if a[0] == 'list':
        print(' '.join(M))
        return
    if a[0] == 'red':
        print(' '.join(M[a[1]][3]))
        return
    if a[0] == 'check':
        src = {'js': rd(a[1]), 'css': rd(a[2])}
        stale = []
        for n, (t, old, new, red) in M.items():
            c = src[t].count(eol(src[t], old))
            if c != 1:
                stale.append(f'{n}: anchor found {c} times, expected 1 (needs the FEATURE build)')
        for s in stale:
            print('ANCHOR ' + s)
        print('ANCHORS all %d mutants apply exactly once' % len(M) if not stale else 'ANCHORS STALE')
        sys.exit(1 if stale else 0)
    name, js, css = a[1], a[2], a[3]
    t, old, new, red = M[name]
    p = js if t == 'js' else css
    s = rd(p)
    old, new = eol(s, old), eol(s, new)
    if s.count(old) != 1:
        print(f'mutant {name}: anchor found {s.count(old)} times')
        sys.exit(1)
    wr(p, s.replace(old, new))
    print(f'mutant {name} applied to {t}')


if __name__ == '__main__':
    main()
