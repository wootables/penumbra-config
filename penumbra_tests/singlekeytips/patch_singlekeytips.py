r"""Single-key hints (2026-09-25): every edit to the five EXISTING files, as data.

    py -3 patch_singlekeytips.py forward SRC_DIR OUT_DIR    apply every hunk (deploy build)
    py -3 patch_singlekeytips.py reverse SRC_DIR OUT_DIR    undo every hunk (rollback build)
    py -3 patch_singlekeytips.py check   SRC_DIR            report which way SRC_DIR stands

SRC_DIR / OUT_DIR hold js/main.js, js/penumbra_dashboard.js, js/penumbra_a11y.js,
css/main.css, health.php, help_content.php and README.md (the app layout).
Every hunk is "replace OLD with NEW" (an insertion is a NEW that starts with
OLD). Forward needs OLD exactly once and NEW absent; reverse needs NEW exactly
once and puts OLD back. Anything else aborts BEFORE a byte is written, naming
the hunk - so the same script re-applies cleanly to a newer live file (another
session deployed meanwhile) and a rollback removes exactly these edits and
nothing deployed on top of them. Line endings follow each file (main.js,
penumbra_dashboard.js, main.css and help_content.php are CRLF; penumbra_a11y.js,
health.php and README.md LF); main.js's two NUL bytes and every other byte are
carried through untouched.
"""
import os
import sys

HUNKS = {}

# ----------------------------------------------------------------- js/main.js
HUNKS['js/main.js'] = [
('tooltip content',
"""    $(document).tooltip({
        position: {
            my: "left+20 top+25",
""",
"""    $(document).tooltip({
        // Single-key hints (2026-09-25): a control that answers to a single key
        // names that key in its tooltip while the Settings switch is on - "(P or
        // CTRL+SHIFT+P) Create a Pivot Table" (_pnbSingleKeyTip, beside
        // PNB_SINGLE_KEYS). Decided HERE, as a tooltip opens: nothing runs at
        // load and no listener is added, the switch is followed live (in every
        // tab), the title attribute is never written, and the titles that get
        // rebuilt (journalBtnTitle, the admin-hidden marker) keep the hint.
        // Every other title - and any surprise - gets jQuery UI's stock
        // content: the title as escaped text.
        content: function () {
            var t = $(this).attr('title') || '';
            try { t = _pnbSingleKeyTip(this, t); } catch (e) { }
            return $('<a>').text(t).html();
        },
        position: {
            my: "left+20 top+25",
"""),
('map comment',
"""    // window.penumbraSingleKeysOff). "?" lists them. The map is the single
    // source for both the handler and the cheat sheet, so they cannot drift.
    // Order = cheat sheet order. admin: true rows are hidden from viewers.
""",
"""    // window.penumbraSingleKeysOff). "?" lists them. The map is the single
    // source for the handler, the cheat sheet and the tooltips, so they cannot
    // drift: `tip` (2026-09-25) is the control a key works, by #id - run fires
    // that selector, and the global tooltip names the key on it while the
    // switch is on (_pnbSingleKeyTip). Letters match either case (Caps Lock).
    // Order = cheat sheet order. admin: true rows are hidden from viewers.
"""),
('map tips',
"""        's': { label: 'Open or close the Settings panel (columns, theme, density)', run: function () { toggleSettingsPanel(); return true; } },
        'p': { label: 'Pivot table builder', run: function () { return _pnbTriggerIcon('#pivotBtn'); } },
        'v': { label: 'Visualization builder', run: function () { return _pnbTriggerIcon('#visualizeBtn'); } },
        'g': { label: 'Group the table', run: function () { return _pnbTriggerIcon('#groupTableBtn'); } },
        'd': { label: 'Download the report data', run: function () { return _pnbTriggerIcon('#downloadBtn'); } },
        'c': { label: 'Copy table data to the clipboard', run: function () { return _pnbTriggerIcon('#copyActionsBtn'); } },
        'e': { label: 'Email the table data', run: function () { return _pnbTriggerIcon('#emailTableBtn'); } },
        'n': { label: 'Report journal (shared notes)', run: function () { return _pnbTriggerIcon('#journalBtn'); } },
        'j': { label: 'Next page of rows', run: function () { return _pnbPageKey('#nextPageBtn'); } },
        'k': { label: 'Previous page of rows', run: function () { return _pnbPageKey('#prevPageBtn'); } },
        't': { label: 'Scroll to the top', run: function () { return _pnbScrollEdge(-1); } },
        'b': { label: 'Scroll to the bottom', run: function () { return _pnbScrollEdge(1); } },
        'h': { label: 'Show or hide the report header', run: function () { return _pnbTriggerIcon('#headerToggleHandle'); } },
        'x': { label: 'Clear the table search', run: function () { return _pnbTriggerIcon('#clearTableSearch'); } },
        'a': { label: 'AI assistant panel', admin: true, run: function () { return _pnbTriggerIcon('#toggleAiPanel'); } }
""",
"""        's': { label: 'Open or close the Settings panel (columns, theme, density)', tip: '#settingsPanelHandle', run: function () { toggleSettingsPanel(); return true; } },
        'p': { label: 'Pivot table builder', tip: '#pivotBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'v': { label: 'Visualization builder', tip: '#visualizeBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'g': { label: 'Group the table', tip: '#groupTableBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'd': { label: 'Download the report data', tip: '#downloadBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'c': { label: 'Copy table data to the clipboard', tip: '#copyActionsBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'e': { label: 'Email the table data', tip: '#emailTableBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'n': { label: 'Report journal (shared notes)', tip: '#journalBtn', run: function () { return _pnbTriggerIcon(this.tip); } },
        'j': { label: 'Next page of rows', tip: '#nextPageBtn', run: function () { return _pnbPageKey(this.tip); } },
        'k': { label: 'Previous page of rows', tip: '#prevPageBtn', run: function () { return _pnbPageKey(this.tip); } },
        't': { label: 'Scroll to the top', run: function () { return _pnbScrollEdge(-1); } },
        'b': { label: 'Scroll to the bottom', run: function () { return _pnbScrollEdge(1); } },
        'h': { label: 'Show or hide the report header', tip: '#headerToggleHandle', run: function () { return _pnbTriggerIcon(this.tip); } },
        'x': { label: 'Clear the table search', tip: '#clearTableSearch', run: function () { return _pnbTriggerIcon(this.tip); } },
        'a': { label: 'AI assistant panel', admin: true, tip: '#toggleAiPanel', run: function () { return _pnbTriggerIcon(this.tip); } }
"""),
('tip function',
"""        if (_pnbHotkeyUiBusy()) return false;
        return !!def.run();
    }
""",
r"""        if (_pnbHotkeyUiBusy()) return false;
        return !!def.run();
    }

    // Tooltip hint (2026-09-25), asked by the global tooltip's content callback
    // (top of this file) as each tooltip opens. The control an entry's `tip`
    // names gets that key in front of its title while the switch is on: inside
    // the title's own "(HOTKEY)" prefix when it has one - "(P or CTRL+SHIFT+P)
    // Create a Pivot Table" - else as "(X) Clear search". Any other title comes
    // back as it is. Cheap by design: an element with no id returns at once,
    // and the switch is read only for the dozen keyed controls.
    function _pnbSingleKeyTip(el, title) {
        var id = el && el.id;
        if (!id || !title) return title;
        var sel = '#' + id;
        for (var k in PNB_SINGLE_KEYS) {
            var d = PNB_SINGLE_KEYS[k];
            if (d.tip !== sel) continue;
            if (d.admin && !(typeof penumbra_vars !== 'undefined' && penumbra_vars.isAdmin)) return title;
            if (window.penumbraSingleKeysOff && window.penumbraSingleKeysOff()) return title;
            var cap = k.toUpperCase();
            return /^\([^()]{1,30}\) /.test(title) ? '(' + cap + ' or ' + title.slice(1) : '(' + cap + ') ' + title;
        }
        return title;
    }
"""),
('sheet intro',
"""        var html = '<p class="pnb-keys-intro">Shortcuts never fire while you are typing in a field or the SQL editor. Single keys also stand down while a dialog is open.</p>';
""",
"""        var html = '<p class="pnb-keys-intro">Shortcuts never fire while you are typing in a field or the SQL editor. Single keys also stand down while a dialog is open. While they are on, each toolbar button names its single key in its tooltip, and Caps Lock makes no difference.</p>';
"""),
('sheet dashboards row',
"""            row(['R', 'H', 'K', 'E', 'A', 'S', 'P'], 'Dashboards: refresh, home, kiosk, edit, access, settings, pause (single keys)'),
""",
"""            row(['R', 'H', 'K', 'E', 'A', 'S', 'P'], 'Dashboards: refresh, help, kiosk, edit, add a tile, settings, pause (single keys)'),
"""),
('keys either case',
"""        // Single-key shortcuts (see PNB_SINGLE_KEYS): one printable key, no
        // modifier, not while typing, honouring the Settings switch (WCAG 2.1.4).
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !e.isComposing &&
            typeof e.key === 'string' && e.key.length === 1 && e.key !== '/' && PNB_SINGLE_KEYS[e.key]) {
            if (_pnbIsTypingTarget(e.target)) return;                                   // the caret owns the key
            if (window.penumbraSingleKeysOff && window.penumbraSingleKeysOff()) return;   // switched off
            if (_pnbRunSingleKey(e.key)) { e.preventDefault(); e.stopPropagation(); }
""",
"""        // Single-key shortcuts (see PNB_SINGLE_KEYS): one printable key, no
        // modifier, not while typing, honouring the Settings switch (WCAG 2.1.4).
        // Either case (2026-09-25): Caps Lock sends "P", and the tooltips print
        // the key as a capital, as the dashboards' do.
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !e.isComposing &&
            typeof e.key === 'string' && e.key.length === 1 && e.key !== '/' && PNB_SINGLE_KEYS[e.key.toLowerCase()]) {
            if (_pnbIsTypingTarget(e.target)) return;                                   // the caret owns the key
            if (window.penumbraSingleKeysOff && window.penumbraSingleKeysOff()) return;   // switched off
            if (_pnbRunSingleKey(e.key.toLowerCase())) { e.preventDefault(); e.stopPropagation(); }
"""),
('settings toggle sync',
"""            try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
            if (window.penumbraRefreshShortcutSheet) window.penumbraRefreshShortcutSheet();
""",
"""            try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
            if (window.penumbraSingleKeysSync) window.penumbraSingleKeysSync();   // the "/" badges follow
            if (window.penumbraRefreshShortcutSheet) window.penumbraRefreshShortcutSheet();
"""),
('sheet toggle sync',
"""                try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
                $('#spSingleKeysToggle').prop('checked', this.checked);
""",
"""                try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
                if (window.penumbraSingleKeysSync) window.penumbraSingleKeysSync();   // the "/" badges follow
                $('#spSingleKeysToggle').prop('checked', this.checked);
"""),
]

# --------------------------------------------------------- js/penumbra_a11y.js
HUNKS['js/penumbra_a11y.js'] = [
('keys sync',
"""    // WCAG 2.1.4: one app-wide off switch for single printable-key shortcuts
    // ("/" on the report page and repository, R/H/K/E/A/S/P on dashboards, r
    // and 1-4 on Health). Pages consult it before acting on such a key; the
    // Settings panel, the dashboard help panel and the Health log strip write it.
    window.penumbraSingleKeysOff = function () {
        try { return !!window.localStorage && localStorage.getItem('pnb_single_keys') === 'off'; } catch (e) { return false; }
    };
""",
"""    // WCAG 2.1.4: one app-wide off switch for single printable-key shortcuts
    // ("/" and the PNB_SINGLE_KEYS letters on the report page, "/" in the
    // repository, R/H/K/E/A/S/P on dashboards, r and 1-4 on Health). Pages
    // consult it before acting on such a key; the Settings panel, the keyboard
    // cheat sheet, the dashboard help panel and the Health log strip write it.
    window.penumbraSingleKeysOff = function () {
        try { return !!window.localStorage && localStorage.getItem('pnb_single_keys') === 'off'; } catch (e) { return false; }
    };
    // ...and its visible hints (2026-09-25): the "/" badges in the search boxes
    // hide under html.pnb-keys-off (main.css), set here at load on every page
    // and again by the report page's two switches when they flip. No listener:
    // a flip in another tab shows here on the next page load.
    window.penumbraSingleKeysSync = function () {
        var root = document.documentElement;
        if (root && root.classList) { root.classList.toggle('pnb-keys-off', window.penumbraSingleKeysOff()); }
    };
    window.penumbraSingleKeysSync();
"""),
]

# ---------------------------------------------------------------- css/main.css
HUNKS['css/main.css'] = [
('slash badges',
"""#tableSearchContainer.has-text #tableSearchKey {
    display: none;
}
""",
"""#tableSearchContainer.has-text #tableSearchKey {
    display: none;
}
/* Single-key shortcuts switched off (2026-09-25): a "/" badge would name a
   key that does nothing, so it goes - the report search bar's, the home
   filter's (not while it is the clear button) and the repository's.
   html.pnb-keys-off comes from penumbra_a11y.js. !important: the repository's
   keyup handler shows its badge with an inline display. */
html.pnb-keys-off #tableSearchKey,
html.pnb-keys-off #pnlFilterKey:not(.is-clear),
html.pnb-keys-off #openReportListLightbox .repo-search-key {
    display: none !important;
}
"""),
]

# ---------------------------------------------------- js/penumbra_dashboard.js
HUNKS['js/penumbra_dashboard.js'] = [
('help link fn',
"""    var DASH_HELP_LINK = '<button type="button" class="dash-btn dash-help-link" id="dashHelpBtn" aria-keyshortcuts="h" ' +
                         'title="Help for dashboards: tiles, address parameters, title tokens, keyboard, kiosk (H)">? Help</button>';
""",
"""    // Its "(H)" and aria-keyshortcuts follow the single-key switch (keyHints()).
    function dashHelpLink(kh) {
        return '<button type="button" class="dash-btn dash-help-link" id="dashHelpBtn"' + kh.attr('h') + ' ' +
               'title="Help for dashboards: tiles, address parameters, title tokens, keyboard, kiosk' + kh.tip('h') + '">? Help</button>';
    }
"""),
('toggle label',
"""                'Single-key shortcuts (R, H, K, E, A, S, P here; / on reports; r and 1 to 4 on Health)</label>' +
""",
"""                'Single-key shortcuts (R, H, K, E, A, S, P here; on a report press ? for its keys; r and 1 to 4 on Health)</label>' +
"""),
('toggle rerender',
"""    $(document).on('change', '#dashKeysToggle', function () {
        try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
    });
""",
"""    $(document).on('change', '#dashKeysToggle', function () {
        try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
        renderHead();   // the header's key hints follow the switch at once
    });
"""),
('keyHints fn',
"""    function dashKeysOff() {
        try { return localStorage.getItem('pnb_single_keys') === 'off'; } catch (e) { return false; }
    }
""",
"""    function dashKeysOff() {
        try { return localStorage.getItem('pnb_single_keys') === 'off'; } catch (e) { return false; }
    }
    // Single-key hints (2026-09-25): a header button names its key - in its
    // tooltip and its aria-keyshortcuts - only while that key works: the
    // shared switch on (WCAG 2.1.4) and a dashboard open (the list page has no
    // keys). Read once per render so every button agrees.
    function keyHints() {
        var on = !!V.shortId && !dashKeysOff();
        return {
            tip: function (k) { return on ? ' (' + k.toUpperCase() + ')' : ''; },
            attr: function (k) { return on ? ' aria-keyshortcuts="' + k + '"' : ''; }
        };
    }
"""),
('list page help',
"""                : '') + DASH_HELP_LINK);
""",
"""                : '') + dashHelpLink(keyHints()));
"""),
('refresh btn',
"""        var btns = '<button type="button" class="dash-btn" id="dashRefreshBtn" title="Re-fetch every tile (R)" aria-keyshortcuts="r">&#8635; Refresh</button>';
""",
"""        var kh = keyHints();
        var btns = '<button type="button" class="dash-btn" id="dashRefreshBtn" title="Re-fetch every tile' + kh.tip('r') + '"' + kh.attr('r') + '>&#8635; Refresh</button>';
"""),
('kiosk btn',
"""                    'title="Chrome-free wall-display view of this dashboard, auto-refreshing (K)" aria-keyshortcuts="k">&#9974;&#xFE0E; Kiosk</a>';
""",
"""                    'title="Chrome-free wall-display view of this dashboard, auto-refreshing' + kh.tip('k') + '"' + kh.attr('k') + '>&#9974;&#xFE0E; Kiosk</a>';
"""),
('pause btn',
"""                    'title="' + (_refreshPaused ? 'Resume the automatic refresh (P)' : 'Pause the automatic refresh so nothing changes while you read (P)') + '" aria-keyshortcuts="p">' +
""",
"""                    'title="' + (_refreshPaused ? 'Resume the automatic refresh' : 'Pause the automatic refresh so nothing changes while you read') + kh.tip('p') + '"' + kh.attr('p') + '>' +
"""),
('settings btn',
"""                ? '<button type="button" class="dash-btn" id="dashSettingsBtn" title="Title, access, theme, refresh and kiosk cycle (S)" aria-keyshortcuts="s">Settings</button>' +
""",
"""                ? '<button type="button" class="dash-btn" id="dashSettingsBtn" title="Title, access, theme, refresh and kiosk cycle' + kh.tip('s') + '"' + kh.attr('s') + '>Settings</button>' +
"""),
('add btn',
"""                  '<button type="button" class="dash-btn" id="dashAddTileBtn" title="Add a tile (A)" aria-keyshortcuts="a">+ Add tile</button>' +
""",
"""                  '<button type="button" class="dash-btn" id="dashAddTileBtn" title="Add a tile' + kh.tip('a') + '"' + kh.attr('a') + '>+ Add tile</button>' +
"""),
('done btn',
"""                  '<button type="button" class="dash-btn" id="dashDoneBtn" title="Leave edit mode (E). While editing: click a tile, then arrow keys resize it and Shift+Left/Right move it" aria-keyshortcuts="e">Done</button>'
""",
"""                  '<button type="button" class="dash-btn" id="dashDoneBtn" title="Leave edit mode' + kh.tip('e') + '. While editing: click a tile, then arrow keys resize it and Shift+Left/Right move it"' + kh.attr('e') + '>Done</button>'
"""),
('edit btn',
"""                : '<button type="button" class="dash-btn" id="dashEditBtn" title="Rearrange, resize, add and edit tiles (E)" aria-keyshortcuts="e">&#9998; Edit</button>';
""",
"""                : '<button type="button" class="dash-btn" id="dashEditBtn" title="Rearrange, resize, add and edit tiles' + kh.tip('e') + '"' + kh.attr('e') + '>&#9998; Edit</button>';
"""),
('help btn',
"""        btns += DASH_HELP_LINK;
""",
"""        btns += dashHelpLink(kh);
"""),
]

# ----------------------------------------------------------------- health.php
HUNKS['health.php'] = [
('r either case',
"""        if (e.key === 'r') { load(); e.preventDefault(); return; }
""",
"""        if (e.key === 'r' || e.key === 'R') { load(); e.preventDefault(); return; }   // either case (Caps Lock)
"""),
]

# ----------------------------------------------------------- help_content.php
HUNKS['help_content.php'] = [
('dashboards keyboard',
"""Hover a header button for its key: <kbd>R</kbd> refreshes every tile,""",
"""Hover a header button for its key (buttons name their keys only while single-key shortcuts are on): <kbd>R</kbd> refreshes every tile,"""),
('settings on',
"""it also lists the Ctrl and function-key shortcuts and, for report editors, the admin console keys.""",
"""it also lists the Ctrl and function-key shortcuts and, for report editors, the admin console keys. While the switch is on, each toolbar button names its single key in its tooltip, as in <em>(P or CTRL+SHIFT+P) Create a Pivot Table</em>, and Caps Lock makes no difference."""),
('settings off',
"""and the Health page's r and 1 to 4. The Ctrl+Shift shortcuts always stay on.""",
"""and the Health page's r and 1 to 4. With it off, tooltips stop naming single keys and the <kbd>/</kbd> badges leave the search boxes. The Ctrl+Shift shortcuts always stay on."""),
]

# ------------------------------------------------------------------ README.md
HUNKS['README.md'] = [
('a11y row',
"""(`penumbraToggleShortcutSheet`, a `.help-lightbox` in `PNB_LIGHTBOXES`, opened by ? or the Settings row's ? button; the admin section renders only for editors).""",
r"""(`penumbraToggleShortcutSheet`, a `.help-lightbox` in `PNB_LIGHTBOXES`, opened by ? or the Settings row's ? button; the admin section renders only for editors). The same map feeds the toolbar tooltips (2026-09-25): an entry's `tip` names its control by `#id` (its `run` fires that same selector), and the global `$(document).tooltip`'s `content` callback puts the key into the title's `(HOTKEY)` prefix - `(P or CTRL+SHIFT+P) Create a Pivot Table`, or `(X) Clear search` - while the switch is on (`_pnbSingleKeyTip`). It is decided as the tooltip opens: nothing runs at load, no listener is added, the title attribute is never written (so `journalBtnTitle()` and the admin-hidden marker, which rebuild titles, keep the hint), and a throw falls back to the stock escaped title. Letters match either case (Caps Lock sends "P"), as on dashboards and the Health page. The dashboard header names its keys (the tooltip's "(R)" and `aria-keyshortcuts`) only while the switch is on and a dashboard is open (`keyHints()` in penumbra_dashboard.js); its help panel's checkbox re-renders the header. With the switch off the "/" badges go too: `window.penumbraSingleKeysSync()` (penumbra_a11y.js, run at load on every page and by the report page's two switches - no listener, so another tab's flip shows on the next load) sets `html.pnb-keys-off`, and main.css hides `#tableSearchKey`, `#pnlFilterKey` (not while it is the `.is-clear` button) and the repository's `.repo-search-key` (`!important` against repository.js's inline `.toggle()`). Suite `penumbra_tests\singlekeytips`."""),
('suite entry',
r"""& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\colwidths\run.ps1'))) -Mutants
""",
r"""& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\colwidths\run.ps1'))) -Mutants
# Single-key hints (2026-09-25): the report toolbar's tooltips name a control's single key while
# the switch is on - "(P or CTRL+SHIFT+P) Create a Pivot Table" - through the global jQuery UI
# tooltip's content callback (_pnbSingleKeyTip); letters work with Caps Lock on; the dashboard
# header's "(R)" and aria-keyshortcuts follow the switch; the Health page takes "R" too. Three
# headless-Edge pages: the REAL main.js with the toolbar markup LIFTED from the index.php under
# test, the REAL penumbra_dashboard.js, and the log console LIFTED from the health.php under
# test. real_input.py repeats hover and keys with REAL input over CDP and measures the cost (the
# content callback per tooltip against jQuery UI's stock one; the page's listeners against the
# build before the feature). `-Control` runs the pre-feature .baks (RED); `-Mutants` runs every
# mutant against the asserts it must turn red.
& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips\run.ps1')))
& ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips\run.ps1'))) -Mutants
"""),
]


def eol_of(text):
    crlf = text.count('\r\n')
    lf = text.count('\n') - crlf
    if crlf and lf:
        raise SystemExit('mixed line endings (%d CRLF, %d LF) - refusing to guess' % (crlf, lf))
    return '\r\n' if crlf else '\n'


def run(mode, src, out):
    plans = {}
    for rel, hunks in HUNKS.items():
        p = os.path.join(src, *rel.split('/'))
        text = open(p, 'rb').read().decode('utf-8')
        eol = eol_of(text)
        state = []
        for name, old, new in hunks:
            o = old.replace('\n', eol)
            n = new.replace('\n', eol)
            state.append((name, o, n, text.count(o), text.count(n)))
        plans[rel] = (p, text, eol, state)

    if mode == 'check':
        for rel, (p, text, eol, state) in plans.items():
            for name, o, n, no, nn in state:
                way = 'APPLIED' if nn == 1 else ('absent' if no == 1 else 'OLD x%d NEW x%d' % (no, nn))
                print('%-26s %-22s %s' % (rel, name, way))
        return

    errors = []
    for rel, (p, text, eol, state) in plans.items():
        for name, o, n, no, nn in state:
            if mode == 'forward' and (no != 1 or nn != 0):
                errors.append('%s [%s]: old x%d, new x%d (need 1 / 0)' % (rel, name, no, nn))
            if mode == 'reverse':
                want_old = 1 if o in n else 0
                if nn != 1 or no != want_old:
                    errors.append('%s [%s]: new x%d, old x%d (need 1 / %d)' % (rel, name, nn, no, want_old))
    if errors:
        print('ABORT - nothing written:')
        for e in errors:
            print('  ' + e)
        sys.exit(2)

    for rel, (p, text, eol, state) in plans.items():
        new = text
        for name, o, n, no, nn in state:
            new = new.replace(n, o) if mode == 'reverse' else new.replace(o, n)
        dst = os.path.join(out, *rel.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'wb').write(new.encode('utf-8'))
        print('%-26s %s %2d hunk(s) -> %s  (%d -> %d bytes, %s)' % (
            rel, mode, len(state), dst, len(text.encode('utf-8')), len(new.encode('utf-8')),
            'CRLF' if eol == '\r\n' else 'LF'))


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('forward', 'reverse', 'check'):
        raise SystemExit(__doc__)
    run(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
