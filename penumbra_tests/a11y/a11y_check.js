/**
 * penumbra_a11y.js - Penumbra's shared accessibility layer (WCAG 2.1 AA).
 *
 * Loaded on EVERY page: index.php (deferred, BEFORE main.js), dashboard.php,
 * and the admin chrome's status bar (analytics, analytics_all, health, grants,
 * notice). Vanilla JS on purpose - the analytics and admin pages have no
 * jQuery - and ES5 on purpose, so the cscript parse check stays available.
 *
 * What lives here (moved out of main.js on 2026-09-08):
 *   - skip link        injected on pages that have a main landmark but no link
 *   - decorative <svg> aria-hidden sweep (WCAG 1.1.1)
 *   - keyboard stamps  role=button + tabindex + Enter/Space on the app's
 *                      click-only icon/action patterns (WCAG 2.1.1)
 *   - modal dialogs    the .help-lightbox / .query-prompt-lightbox family and
 *                      the appended-at-runtime .modal-prompt-overlay prompts:
 *                      role/aria-modal, opener tracking, focus in, Tab trap,
 *                      focus restore (WCAG 2.4.3 / 2.1.2)
 *   - [role=menu]      focus on open, arrow-key roving, Escape (APG menu)
 *   - enhanceChartA11y role=img + label + sr-only data table for Chart.js
 *                      canvases (WCAG 1.1.1) - call it after every new Chart()
 *
 * main.js keeps its page-specific keyboard code (tab bar, group headers, pivot
 * chips, sortable headers, the control-bar focus ring) and sets
 * window.__pnbA11ySuspended = true while a theme switch repaints, which pauses
 * the body observer here. window._pnbA11yAttach(doc) is still exported for the
 * popped-out admin console, and window._pnbAll / window._admPip are honoured
 * when main.js defines them.
 *
 * Opt-ins for page code:
 *   [data-pnb-modal]   put on any dialog container that is toggled hidden/shown
 *                      to get the full modal contract without the lightbox class
 *   PenumbraA11y.sweep()  force an immediate re-sweep after a large render - and
 *                      after making a node ALREADY on the page one of the targets
 *                      below (a class or role added to it): since 2026-10-19 the
 *                      body observer sweeps only the nodes that were added
 */
(function (window, document) {
    'use strict';
    if (!window || !document || window.PenumbraA11y) { return; }

    var A11y = { version: '2026-10-19' };

    // WCAG 2.1.4: one app-wide off switch for single printable-key shortcuts
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
    window.PenumbraA11y = A11y;
    var hasMO = typeof window.MutationObserver === 'function';

    // ---------------------------------------------------------------- helpers
    function onReady(fn) {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { fn(); }); }
        else { fn(); }
    }
    function keyOf(e) { return e.which || e.keyCode || 0; }
    function isActivate(e) { var k = keyOf(e); return k === 13 || k === 32 || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'; }
    function isEscape(e) { return keyOf(e) === 27 || e.key === 'Escape' || e.key === 'Esc'; }
    function isTab(e) { return keyOf(e) === 9 || e.key === 'Tab'; }
    function closestOf(node, sel) {
        if (!node) { return null; }
        if (node.nodeType !== 1) { node = node.parentNode; }
        return (node && node.closest) ? node.closest(sel) : null;
    }
    function viewOf(el) { return (el && el.ownerDocument && el.ownerDocument.defaultView) || window; }
    // Synthetic activation that works for HTML AND SVG targets (SVG elements have no .click()).
    function fireClick(el) {
        if (!el || !el.dispatchEvent) { return; }
        var view = viewOf(el);
        el.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, view: view }));
    }
    function shown(el) {
        if (!el || !el.getClientRects || !el.getClientRects().length) { return false; }
        return viewOf(el).getComputedStyle(el).visibility !== 'hidden';
    }
    function canFocus(el) {
        return !!(el && el.ownerDocument && el.ownerDocument.contains(el) && el.offsetParent !== null && typeof el.focus === 'function');
    }
    A11y.fireClick = fireClick;

    // Last pointer / key gesture in THIS document. A dialog that opens with no
    // gesture behind it (a chart embed's persistent carousel opening on load, a
    // prompt dialog raised by a report autoload) must not pull focus into a
    // frame that does not have it: the host page (a dashboard tile's frame)
    // would lose the viewer's focus on every refresh. Top-level documents are
    // unaffected - there, an auto-opened dialog still takes focus as before.
    var lastGestureAt = 0;
    document.addEventListener('mousedown', function () { lastGestureAt = Date.now(); }, true);
    document.addEventListener('keydown', function () { lastGestureAt = Date.now(); }, true);
    function stealsHostFocus() {
        var inFrame = false;
        try { inFrame = (window !== window.top); } catch (e) { inFrame = true; }
        if (!inFrame) { return false; }
        var focused = false;
        try { focused = !!(document.hasFocus && document.hasFocus()); } catch (e2) { }
        return !focused && (Date.now() - lastGestureAt) > 1500;
    }
    A11y.stealsHostFocus = stealsHostFocus;

    // One debounced body observer drives every sweep below (the sweeps are
    // idempotent, so running them together costs nothing extra). It sweeps only
    // what was ADDED since the last sweep (2026-10-19): a whole-document sweep
    // walks every element five times - 0.2 s on a 25,000-row report (480,000
    // elements) - and ran 400 ms after ANY node came or went: a page turn, a
    // search, the search box's suggestions, a tooltip. Nodes added while the
    // observers are paused (main.js: a build, a lazy fill, a theme switch) wait
    // for the sweep its resume nudge starts. Past SWEEP_ROOTS_MAX added roots, one
    // whole-document sweep is the cheaper (a report's build). jQuery UI's live
    // regions and tooltips hold plain text: skipped. A11y.sweep() = the whole document.
    var sweeps = [], sweepPending = false, sweepRoots = [], sweepAll = false, sweepSeq = 0;
    var SWEEP_ROOTS_MAX = 5000;
    var SWEEP_SKIP = '.ui-helper-hidden-accessible, .ui-tooltip';
    function runSweeps(root) { for (var i = 0; i < sweeps.length; i++) { try { sweeps[i](root); } catch (e) { } } }
    A11y.sweep = function () { runSweeps(); };
    // Every element matching sel AT root and under it (the whole document when no root).
    function inAndUnder(root, sel) {
        if (!root) { return document.querySelectorAll(sel); }
        var out = root.firstElementChild ? Array.prototype.slice.call(root.querySelectorAll(sel)) : [];
        if (root.matches && root.matches(sel)) { out.unshift(root); }
        return out;
    }
    function sweepAdded() {
        sweepPending = false;
        var roots = sweepRoots, all = sweepAll;
        sweepRoots = []; sweepAll = false;
        if (all) { runSweeps(); return; }
        var stamp = ++sweepSeq, i;
        for (i = 0; i < roots.length; i++) { roots[i].__pnbA11yRoot = stamp; }
        for (i = 0; i < roots.length; i++) {
            var n = roots[i];
            if (!n.isConnected) { continue; }
            // a root inside another one is swept with it
            var p = n.parentNode, inner = false;
            while (p && p !== document.body) { if (p.__pnbA11yRoot === stamp) { inner = true; break; } p = p.parentNode; }
            if (!inner) { runSweeps(n); }
        }
    }
    function startObserver() {
        if (!hasMO || !document.body) { return; }
        new MutationObserver(function (muts) {
            for (var m = 0; m < muts.length && !sweepAll; m++) {
                var ad = muts[m].addedNodes;
                for (var a = 0; a < ad.length; a++) {
                    var n = ad[a];
                    if (n.nodeType !== 1 || (n.closest && n.closest(SWEEP_SKIP))) { continue; }
                    if (sweepRoots.length >= SWEEP_ROOTS_MAX) { sweepAll = true; sweepRoots = []; break; }
                    sweepRoots.push(n);
                }
            }
            if (window.__pnbA11ySuspended) { return; } // paused (main.js: a build, a lazy fill, a theme switch); its nudge resumes
            if (sweepPending || (!sweepAll && !sweepRoots.length)) { return; }
            sweepPending = true;
            setTimeout(sweepAdded, 400);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // -------------------------------------------------------------- skip link
    // WCAG 2.4.1: index.php carries its own skip link in markup; the standalone
    // pages get one here, pointed at their main landmark (given an id and a
    // programmatic tab stop so the jump lands focus, not just the scroll).
    function ensureSkipLink() {
        if (!document.body || document.querySelector('.pnb-skip-link')) { return; }
        var main = document.querySelector('main, [role="main"]');
        if (!main) { return; }
        if (!main.id) { main.id = 'pnbMain'; }
        if (!main.hasAttribute('tabindex')) { main.setAttribute('tabindex', '-1'); }
        var a = document.createElement('a');
        a.className = 'pnb-skip-link';
        a.href = '#' + main.id;
        a.textContent = 'Skip to main content';
        document.body.insertBefore(a, document.body.firstChild);
    }

    // -------------------------------------------------------- decorative svgs
    // WCAG 1.1.1: the app renders hundreds of inline decorative <svg> icons
    // (toolbar glyphs, list/action icons repeated per row). With no role/label
    // they add screen-reader noise ("graphic" announced over and over). Mark
    // every svg that has no semantic role="img", no aria-label(ledby), and no
    // <title> child as aria-hidden + focusable=false; labelled svgs are left alone.
    function sweepSvgs(root) {
        var svgs = inAndUnder(root, 'svg:not([aria-hidden="true"])');
        for (var i = 0; i < svgs.length; i++) {
            var s = svgs[i];
            if (s.getAttribute('role') === 'img') { continue; }
            if (s.getAttribute('aria-label') || s.getAttribute('aria-labelledby')) { continue; }
            if (s.querySelector('title')) { continue; }
            s.setAttribute('aria-hidden', 'true');
            s.setAttribute('focusable', 'false');
        }
    }
    sweeps.push(sweepSvgs);
    A11y.sweepSvgs = sweepSvgs;

    // WCAG 1.3.1: the table sort glyphs ("\u25b2\u25bc") are decorative - the th
    // carries aria-sort - so keep screen readers from reading "up-pointing
    // triangle" on every header (2026-09-09).
    function sweepSortIcons(root) {
        var els = inAndUnder(root, '.sort-icon:not([aria-hidden])');
        for (var i = 0; i < els.length; i++) { els[i].setAttribute('aria-hidden', 'true'); }
    }
    sweeps.push(sweepSortIcons);
    A11y.sweepSortIcons = sweepSortIcons;

    // -------------------------------------------------------- keyboard stamps
    // WCAG 2.1.1: the row/list action icons and a few other click-only
    // <div>/<span>/<svg> controls have delegated click handlers but no button
    // semantics or tab stop. Give them role=button + tabindex so they are
    // focusable/announced, plus a delegated Enter/Space handler that fires the
    // same click. (main.js handles its own [data-pnb-ktoggle], .export-icon and
    // .pivot-collapse-toggle keys - keep those OUT of this list.)
    var SELK = '.action-icon, .item-icon[data-action], .remove-access, .group-hide, .sp-sort-item, .chart-drill-popup-item, .chart-drill-popup-secondary, .favorite-icon, .delete-report-btn, .task-status-toggle, .tab-help-icon';
    function enhanceIcons(root) {
        var els = inAndUnder(root, SELK);
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (!el.getAttribute('role')) { el.setAttribute('role', 'button'); }
            if (!el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); }
            // WCAG 4.1.2: a role=button needs an accessible name. Most icons carry
            // a title; those that don't (e.g. item-icon "more-options") get one
            // derived from their data-action so they aren't a nameless "button".
            if (!el.getAttribute('aria-label') && !el.getAttribute('title') && !(el.textContent || '').replace(/\s+/g, '')) {
                var da = el.getAttribute('data-action');
                if (da) { el.setAttribute('aria-label', da.replace(/[-_]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })); }
            }
            // The "?" help icons carry text ('?'), so the nameless-derive above
            // skips them - but '?' is a useless accessible name.
            if (el.classList.contains('tab-help-icon') && !el.getAttribute('aria-label') && !el.getAttribute('title')) {
                el.setAttribute('aria-label', 'Help');
            }
        }
    }
    sweeps.push(enhanceIcons);
    A11y.enhanceIcons = enhanceIcons;
    A11y.stampSelector = SELK;
    // Enter/Space also activate menu items that are not native buttons or links
    // (the chart context menu's <li>s, for instance); a native control inside a
    // stamped element (a checkbox in a list row) keeps its own keys.
    var ACTIVATE_SEL = SELK + ', [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
    document.addEventListener('keydown', function (e) {
        var t = closestOf(e.target, ACTIVATE_SEL);
        if (!t || !isActivate(e)) { return; }
        var inner = closestOf(e.target, 'input, select, textarea');
        if (inner && inner !== t && t.contains(inner)) { return; }
        e.preventDefault();
        fireClick(t);
    });

    // ----------------------------------------------- modal dialogs (lightboxes)
    // The .help-lightbox / .query-prompt-lightbox dialogs (email, grouping,
    // pivot builder, visualization, copy/download, manage data, snapshots,
    // prompt generator, repository, journal, and the analytics pages' own
    // dialogs) are overlays toggled display:none<->flex. A MutationObserver on
    // each (so it works no matter how the dialog is opened or closed) provides
    // the modal focus contract WCAG needs:
    //   on open  -> save the trigger; mark role=dialog + aria-modal; make the X
    //               reachable; move focus in (unless the dialog already did); trap Tab.
    //   on close -> restore focus to the trigger (closing by ANY path flips
    //               display:none, which the observer sees).
    // Escape-to-close and the X are the pages' own, so the trap always has an exit.
    (function () {
        if (!hasMO) { return; }
        var SEL = '.help-lightbox, .query-prompt-lightbox, [data-pnb-modal]';
        var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        var seq = 0, lastExternalFocus = null, lastInputKbd = false;
        // Remember the control the user last interacted with OUTSIDE any dialog -
        // the real opener - because the observer fires after a dialog may have
        // moved focus in. Captures mousedown/keydown/focusin (capture phase) and
        // resolves to the focusable control, so it works for the SVG toolbar
        // icons too (which set activeElement but fire no focusin event).
        function recordTrigger(e) {
            // Track input modality so focus restored on dialog close shows the ring
            // only for keyboard users (mirrors native :focus-visible intent).
            if (e.type === 'keydown') { lastInputKbd = true; }
            else if (e.type === 'mousedown') { lastInputKbd = false; }
            var el = e.target;
            if (!el || !el.closest || el.closest(SEL)) { return; }
            // A menu item is transient (the menu hides as it acts), so the real
            // opener is whatever opened the menu - keep that.
            if (el.closest('[role="menu"]')) { return; }
            lastExternalFocus = el.closest('a[href], button, input, select, textarea, [tabindex], [role="button"], .export-icon') || el;
        }
        // Bound per DOCUMENT, not once on `document`: while the admin console is
        // popped out, dialogs and their triggers live in that window, and these
        // are NATIVE listeners so main.js's _pipForwardEvents (which replays
        // through jQuery's dispatch) never reaches them. _mountConsoleIn calls
        // window._pnbA11yAttach(pipDoc) so the trigger tracking and the Tab trap
        // work there too.
        function attachTo(doc) {
            doc.addEventListener('mousedown', recordTrigger, true);
            doc.addEventListener('keydown', recordTrigger, true);
            doc.addEventListener('focusin', recordTrigger, true);
            doc.addEventListener('keydown', trapKeydown);
        }
        // The element that currently has focus, in whichever window holds it.
        function activeEl() {
            var p = window._admPip;
            if (p && p.active && p.win && !p.win.closed) {
                try { if (p.win.document.hasFocus()) { return p.win.document.activeElement; } } catch (err) { }
            }
            return document.activeElement;
        }
        // Every dialog across both documents.
        function allDialogs() {
            return window._pnbAll ? window._pnbAll(SEL).get() : Array.prototype.slice.call(document.querySelectorAll(SEL));
        }
        function focusables(dialog) {
            var nodes = dialog.querySelectorAll(FOCUSABLE), out = [];
            var view = viewOf(dialog);
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].offsetParent !== null && view.getComputedStyle(nodes[i]).visibility !== 'hidden') { out.push(nodes[i]); }
            }
            return out;
        }
        function onOpen(dialog) {
            // A dialog raised from INSIDE another dialog (the help topics' "open
            // the cheat sheet" links) names its own way back on the element: the
            // trigger tracker only records controls outside every dialog (2026-09-09).
            dialog.__modalTrigger = dialog.__pnbReturnTo || lastExternalFocus || activeEl();
            dialog.__pnbReturnTo = null;
            dialog.__openKbd = lastInputKbd;
            if (!dialog.getAttribute('role')) { dialog.setAttribute('role', 'dialog'); }
            if (dialog.getAttribute('aria-modal') !== 'true') { dialog.setAttribute('aria-modal', 'true'); dialog.__pnbModalStamped = true; }
            if (!dialog.getAttribute('aria-label') && !dialog.getAttribute('aria-labelledby')) {
                var h = dialog.querySelector('h1, h2, h3, h4');
                if (h) { if (!h.id) { h.id = 'pnbDlgTitle_' + (++seq); } dialog.setAttribute('aria-labelledby', h.id); }
            }
            var closers = dialog.querySelectorAll('.close-lightbox');
            for (var c = 0; c < closers.length; c++) {
                if (!closers[c].hasAttribute('tabindex')) { closers[c].setAttribute('tabindex', '0'); }
                if (!closers[c].getAttribute('role')) { closers[c].setAttribute('role', 'button'); }
                if (!closers[c].getAttribute('aria-label')) { closers[c].setAttribute('aria-label', 'Close dialog'); }
            }
            if (stealsHostFocus()) { return; }   // auto-opened inside an unfocused frame: leave the host's focus alone
            setTimeout(function () {
                if (dialog.__modalOpen && !dialog.contains(activeEl())) {
                    var f = focusables(dialog);
                    var target = null;
                    for (var fi = 0; fi < f.length; fi++) {
                        if (f[fi].classList.contains('close-lightbox')) { continue; }
                        // Also skip a control that carries its OWN title: programmatically
                        // focusing it makes the global jQuery UI tooltip fire on open (e.g.
                        // the snapshot UI's "New Snapshot" button), popping a tooltip while
                        // the pointer is nowhere near it. Land on the first benign control.
                        if (f[fi].hasAttribute('title')) { continue; }
                        target = f[fi];
                        break;
                    }
                    if (target) { target.focus({ focusVisible: dialog.__openKbd }); }
                    else {
                        // No untitled control -> focus the dialog container rather than pop
                        // a tooltip on open. The container isn't Tab-reachable, so this only
                        // affects open-time focus.
                        var box = dialog.querySelector('.lightbox-content') || dialog;
                        box.setAttribute('tabindex', '-1');
                        box.focus({ focusVisible: dialog.__openKbd });
                    }
                }
            }, 60);
        }
        function onClose(dialog) {
            var t = dialog.__modalTrigger;
            dialog.__modalTrigger = null;
            // Only strip what we stamped: a dialog that ships aria-modal in its own
            // markup (the dashboards' panels, for instance) keeps it.
            if (dialog.__pnbModalStamped) { dialog.removeAttribute('aria-modal'); dialog.__pnbModalStamped = false; }
            // t.ownerDocument.contains(t), not document.contains(t): the trigger is
            // usually a console control, which lives in the pop-out window while
            // popped - the main document does not contain it.
            var tDoc = t && t.ownerDocument;
            if (t && tDoc && tDoc.contains(t) && t.offsetParent !== null && typeof t.focus === 'function') {
                t.focus({ focusVisible: !!dialog.__openKbd });
                return;
            }
            // No usable trigger (it is gone, or hidden): land in the dialog
            // underneath, if one is still open, so Tab stays trapped there.
            var open = allDialogs().filter(function (d) { return d !== dialog && d.__modalOpen; });
            if (open.length) {
                var under = open[open.length - 1];
                var box = under.querySelector('.lightbox-content') || under;
                box.setAttribute('tabindex', '-1');
                try { box.focus({ focusVisible: false }); } catch (err) { }
            }
        }
        function check(dialog) {
            var open = viewOf(dialog).getComputedStyle(dialog).display !== 'none';
            if (open && !dialog.__modalOpen) { dialog.__modalOpen = true; onOpen(dialog); }
            else if (!open && dialog.__modalOpen) { dialog.__modalOpen = false; onClose(dialog); }
        }
        function trapKeydown(e) {
            // Enter/Space on a <span> close control activates it (real <button>s already do).
            if (isActivate(e) && e.target && e.target.classList &&
                e.target.classList.contains('close-lightbox') && e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                fireClick(e.target);
                return;
            }
            // Trap Tab inside the open dialog that currently holds focus.
            if (!isTab(e)) { return; }
            var ae = activeEl();
            var ds = allDialogs(), dialog = null;
            for (var i = 0; i < ds.length; i++) {
                if (ds[i].__modalOpen && ds[i].contains(ae)) { dialog = ds[i]; break; }
            }
            if (!dialog) { return; }
            var f = focusables(dialog);
            if (!f.length) { e.preventDefault(); return; }
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && ae === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
        }
        attachTo(document);
        // Called again by main.js's _mountConsoleIn for the pop-out document.
        window._pnbA11yAttach = attachTo;

        // Observers are attached to NODES, so a dialog that later moves into the
        // pop-out document keeps being watched. Dialogs created after load are
        // picked up by the shared sweep.
        var obs = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) { check(muts[i].target); }
        });
        function watchDialogs(root) {
            var all = inAndUnder(root, SEL);
            for (var j = 0; j < all.length; j++) {
                var d = all[j];
                if (d.__pnbWatched) { continue; }
                d.__pnbWatched = true;
                check(d);
                obs.observe(d, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
            }
        }
        sweeps.push(watchDialogs);
        // A dialog REMOVED while open (the chart carousel tears its overlay
        // down) never flips display:none, so the attribute observer cannot see
        // it close: watch body's direct children for removals and restore focus.
        onReady(function () {
            if (!document.body) { return; }
            new MutationObserver(function (muts) {
                for (var m = 0; m < muts.length; m++) {
                    var rm = muts[m].removedNodes;
                    for (var r = 0; r < rm.length; r++) {
                        var n = rm[r];
                        if (n.nodeType !== 1) { continue; }
                        var list = (n.matches && n.matches(SEL)) ? [n] : (n.querySelectorAll ? Array.prototype.slice.call(n.querySelectorAll(SEL)) : []);
                        for (var k = 0; k < list.length; k++) {
                            if (list[k].__modalOpen) { list[k].__modalOpen = false; onClose(list[k]); }
                        }
                    }
                }
            }).observe(document.body, { childList: true });
        });
    })();

    // ----------------------------------------- modal dialogs (prompt overlays)
    // WCAG 2.4.3 / 2.1.2 for the dynamically-appended prompt dialogs
    // (.modal-prompt-overlay), which are appended/removed at runtime. On open:
    // role=dialog + aria-modal + label from the <h3>, move focus in, remember the
    // trigger. While open: trap Tab inside. On close (node removed): return focus
    // to the trigger. (Escape-to-cancel is main.js's global keydown handler.)
    (function () {
        if (!hasMO) { return; }
        var seqM = 0, lastFocusBeforeModal = null;
        var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        function focusablesIn(ov) {
            return Array.prototype.filter.call(ov.querySelectorAll(FOCUSABLE), function (el) {
                return el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
            });
        }
        function onOpen(ov) {
            if (ov.__pnbModal) { return; }
            ov.__pnbModal = true;
            ov.setAttribute('role', 'dialog');
            ov.setAttribute('aria-modal', 'true');
            var h = ov.querySelector('h3');
            if (h && !ov.getAttribute('aria-label') && !ov.getAttribute('aria-labelledby')) {
                if (!h.id) { h.id = 'pnbDlgT' + (++seqM); }
                ov.setAttribute('aria-labelledby', h.id);
            }
            ov.__pnbTrigger = lastFocusBeforeModal || document.activeElement;
            if (stealsHostFocus()) { return; }   // see stealsHostFocus()
            // Initial focus: prefer an explicit [autofocus] target, then a data-entry
            // field. Otherwise focus the dialog CONTAINER - NOT the first focusable,
            // which is the header close button (auto-focusing it pops the global
            // jQuery UI tooltip "Close (Esc)" at the pointer on open).
            setTimeout(function () {
                var f = focusablesIn(ov);
                var field = f.filter(function (el) { return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName); })[0];
                var target = ov.querySelector('[autofocus]') || field;
                if (!target) {
                    target = ov.querySelector('.modal-prompt-box') || ov;
                    target.setAttribute('tabindex', '-1');
                }
                try { target.focus(); } catch (e) { if (f.length) { f[0].focus(); } }
            }, 30);
        }
        function start() {
            if (!document.body) { return; }
            new MutationObserver(function (muts) {
                for (var m = 0; m < muts.length; m++) {
                    var ad = muts[m].addedNodes;
                    for (var a = 0; a < ad.length; a++) {
                        var n = ad[a];
                        if (n.nodeType !== 1) { continue; }
                        if (n.classList && n.classList.contains('modal-prompt-overlay')) { onOpen(n); }
                        else if (n.querySelector) { var inner = n.querySelector('.modal-prompt-overlay'); if (inner) { onOpen(inner); } }
                    }
                    var rm = muts[m].removedNodes;
                    for (var ri = 0; ri < rm.length; ri++) {
                        var rn = rm[ri];
                        if (rn.nodeType === 1 && rn.classList && rn.classList.contains('modal-prompt-overlay') && rn.__pnbTrigger) {
                            var trg = rn.__pnbTrigger;
                            if (canFocus(trg)) { trg.focus(); }
                        }
                    }
                }
            }).observe(document.body, { childList: true });
        }
        onReady(start);
        document.addEventListener('focusin', function (e) {
            if (!e.target.closest || !e.target.closest('.modal-prompt-overlay')) { lastFocusBeforeModal = e.target; }
        }, true);
        document.addEventListener('keydown', function (e) {
            if (!isTab(e)) { return; }
            var ovs = document.querySelectorAll('.modal-prompt-overlay'), ov = null;
            for (var i = ovs.length - 1; i >= 0; i--) { if (ovs[i].offsetParent !== null) { ov = ovs[i]; break; } }
            if (!ov) { return; }
            var f = focusablesIn(ov);
            if (!f.length) { e.preventDefault(); return; }
            var first = f[0], last = f[f.length - 1];
            if (!ov.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }, true);
    })();

    // ------------------------------------------------------------ role=menu
    // APG menu keyboard pattern for every [role=menu]: focus moves into the menu
    // on open, Up/Down (+ Left/Right/Home/End) rove between items via roving
    // tabindex, and Escape restores focus to the opener. Two kinds of menu:
    //   dynamic    - built visible on open and removed on close (the sort and
    //                chart-drill pop-ups): Escape removes the node itself;
    //   persistent - in the markup and toggled hidden/shown (admin tools, the
    //                presets and status-bar popovers, the viz actions panel):
    //                Escape only returns focus; the page's own handler closes it.
    // (Enter/Space activation on menuitems is the stamp handler above or native.)
    (function () {
        var lastFocusBeforeMenu = null, lastActivationAt = 0;
        function menuItems(menu) {
            return Array.prototype.filter.call(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'), function (el) { return el.offsetParent !== null && !el.disabled && el.getAttribute('aria-disabled') !== 'true'; });
        }
        function openMenu(menu, dynamic) {
            if (menu.__pnbMenu) { return; }
            menu.__pnbMenu = true;
            if (dynamic) { menu.__pnbDynamic = true; }
            menu.__menuOpener = lastFocusBeforeMenu || document.activeElement;
            var it = menuItems(menu);
            for (var i = 0; i < it.length; i++) { it[i].setAttribute('tabindex', i === 0 ? '0' : '-1'); }
            // Dynamic menus always take focus. A persistent one only when it was
            // just activated (a hover-opened popover must not steal focus).
            var wantFocus = dynamic || (Date.now() - lastActivationAt) < 1500;
            if (it.length && wantFocus) {
                setTimeout(function () {
                    var it2 = menuItems(menu);
                    if (it2.length && (dynamic || !menu.contains(document.activeElement))) { it2[0].focus(); }
                }, 0);
            }
        }
        function attrChanged(muts) {
            for (var i = 0; i < muts.length; i++) {
                var menu = muts[i].target;
                var vis = shown(menu);
                if (vis === !!menu.__pnbMenuVisible) { continue; }
                menu.__pnbMenuVisible = vis;
                if (vis) { openMenu(menu, false); }
                else {
                    // Hidden while focus was still inside (an item was activated, or
                    // the page closed it): hand focus back to the opener.
                    if (menu.contains(document.activeElement) && canFocus(menu.__menuOpener)) { menu.__menuOpener.focus(); }
                    menu.__pnbMenu = false;
                }
            }
        }
        var attrObs = hasMO ? new MutationObserver(attrChanged) : null;
        function watchMenus(root) {
            if (!attrObs) { return; }
            var all = inAndUnder(root, '[role="menu"]');
            for (var i = 0; i < all.length; i++) {
                var m = all[i];
                if (m.__pnbMenuWatched) { continue; }
                m.__pnbMenuWatched = true;
                m.__pnbMenuVisible = shown(m);
                if (m.__pnbMenuVisible && !m.__pnbMenu) { openMenu(m, false); }
                attrObs.observe(m, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
            }
        }
        sweeps.push(watchMenus);
        function start() {
            if (!hasMO || !document.body) { return; }
            // Menus appended to <body> on open (the sort/drill pop-ups) are handled
            // at once, without waiting for the debounced sweep.
            new MutationObserver(function (muts) {
                for (var m = 0; m < muts.length; m++) {
                    var ad = muts[m].addedNodes;
                    for (var a = 0; a < ad.length; a++) {
                        var n = ad[a];
                        if (n.nodeType !== 1) { continue; }
                        var menu = (n.getAttribute && n.getAttribute('role') === 'menu') ? n : (n.querySelector && n.querySelector('[role="menu"]'));
                        if (!menu) { continue; }
                        if (shown(menu)) { openMenu(menu, true); }
                        else { watchMenus(n); }
                    }
                }
            }).observe(document.body, { childList: true });
        }
        onReady(start);
        document.addEventListener('focusin', function (e) {
            if (!e.target.closest || !e.target.closest('[role="menu"]')) { lastFocusBeforeMenu = e.target; }
        }, true);
        document.addEventListener('mousedown', function () { lastActivationAt = Date.now(); }, true);
        document.addEventListener('keydown', function (e) { if (isActivate(e)) { lastActivationAt = Date.now(); } }, true);
        document.addEventListener('keydown', function (e) {
            var item = closestOf(e.target, '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]');
            if (!item) { return; }
            var menu = item.closest('[role="menu"]');
            if (!menu) { return; }
            if (isEscape(e)) {
                var opener = menu.__menuOpener;
                if (menu.__pnbDynamic) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (menu.parentNode) { menu.parentNode.removeChild(menu); }
                }
                if (canFocus(opener)) { opener.focus(); }
                return;
            }
            var k = keyOf(e);
            var it = menuItems(menu), idx = it.indexOf(item), to = -1;
            if (k === 40 || k === 39 || e.key === 'ArrowDown' || e.key === 'ArrowRight') { to = idx + 1; }
            else if (k === 38 || k === 37 || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { to = idx - 1; }
            else if (k === 36 || e.key === 'Home') { to = 0; }
            else if (k === 35 || e.key === 'End') { to = it.length - 1; }
            else { return; }
            if (!it.length) { return; }
            e.preventDefault();
            if (to < 0) { to = it.length - 1; }
            if (to >= it.length) { to = 0; }
            for (var j = 0; j < it.length; j++) { it[j].setAttribute('tabindex', j === to ? '0' : '-1'); }
            if (it[to]) { it[to].focus(); }
        });
    })();

    // ------------------------------------------------------ chart text alt
    // Chart.js renders to <canvas>, which is invisible to screen readers (WCAG
    // 1.1.1). Call this right after each on-screen chart is created: it marks the
    // canvas role="img" with a generated label and builds an sr-only data table
    // from the chart's own data, linked via aria-describedby. Fully wrapped in
    // try/catch so an a11y hiccup can never break a chart from rendering.
    // A canvas the page has deliberately marked aria-hidden (decorative sparkline
    // beside its own value, or a chart with a hand-written table) is left alone.
    // ------------------------------------------------ series without colour
    // WCAG 1.4.1 / 1.4.11 (2026-09-09): grouped line series differed by colour
    // alone, and a pale palette entry (the classic yellow) could put a 2px
    // stroke under 3:1 against the surface. Runs once per chart from the hook
    // below: with two or more line/radar series each gets its own point shape
    // and every series after the first a dash pattern, and any stroke under
    // 3:1 is pulled toward the surface's ink (black on light, white on dark)
    // until it clears. Builders that set pointStyle / borderDash themselves
    // are left alone; one silent update() repaints.
    var POINT_STYLES = ['circle', 'rect', 'triangle', 'rectRot', 'cross', 'star', 'crossRot', 'rectRounded'];
    var DASHES = [[], [6, 3], [2, 2], [8, 3, 2, 3], [4, 4], [10, 4], [1, 3], [12, 3, 3, 3]];
    function parseColor(s) {
        if (typeof s !== 'string') { return null; }
        var t = s.trim();
        var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
        if (m) {
            var h = m[1];
            if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
        }
        m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(t);
        if (m) { return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]; }
        return null;
    }
    function relLum(c) {
        var a = [0, 1, 2].map(function (i) { var v = c[i] / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function contrastOf(a, b) { var l1 = relLum(a), l2 = relLum(b); var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
    function surfaceBehind(el) {
        var n = el;
        while (n && n.nodeType === 1) {
            var c = parseColor(getComputedStyle(n).backgroundColor);
            if (c && c[3] > 0.5) { return c; }
            n = n.parentElement;
        }
        return [255, 255, 255, 1];
    }
    window.penumbraDistinguishSeries = function (chart) {
        try {
            var cfg = chart && chart.config; if (!cfg) { return false; }
            var data = cfg.data || (cfg._config && cfg._config.data) || {};
            var sets = data.datasets || [];
            var baseType = String(cfg.type || (cfg._config && cfg._config.type) || '').toLowerCase();
            var lines = [];
            for (var i = 0; i < sets.length; i++) {
                var t = String(sets[i].type || baseType).toLowerCase();
                if (t === 'line' || t === 'radar') { lines.push(sets[i]); }
            }
            if (!lines.length) { return false; }
            var changed = false;
            var bg = chart.canvas ? surfaceBehind(chart.canvas) : [255, 255, 255, 1];
            var ink = relLum(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
            for (var k = 0; k < lines.length; k++) {
                var ds = lines[k];
                if (ds._pnbStyled) { continue; }
                ds._pnbStyled = true;
                if (lines.length > 1) {
                    if (ds.pointStyle === undefined) { ds.pointStyle = POINT_STYLES[k % POINT_STYLES.length]; changed = true; }
                    if (ds.borderDash === undefined && k > 0) { ds.borderDash = DASHES[k % DASHES.length]; changed = true; }
                }
                var stroke = parseColor(ds.borderColor);
                if (stroke && stroke[3] > 0.5 && contrastOf(stroke, bg) < 3) {
                    var c = stroke.slice(0, 3);
                    for (var step = 0; step < 24 && contrastOf(c, bg) < 3; step++) {
                        c = [c[0] + (ink[0] - c[0]) * 0.1, c[1] + (ink[1] - c[1]) * 0.1, c[2] + (ink[2] - c[2]) * 0.1];
                    }
                    ds.borderColor = 'rgb(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ')';
                    changed = true;
                }
            }
            if (changed && typeof chart.update === 'function') { chart.update('none'); }
            return changed;
        } catch (e) { return false; }
    };
    A11y.distinguishSeries = window.penumbraDistinguishSeries;

    var chartSeq = 0;
    window.enhanceChartA11y = function (chart) {
        try {
            if (!chart || !chart.canvas) { return; }
            var canvas = chart.canvas;
            if (canvas.getAttribute('aria-hidden') === 'true' || canvas.getAttribute('data-a11y') === 'off') { return; }
            try { window.penumbraDistinguishSeries(chart); } catch (e0) { }
            function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
            var cfg = chart.config || {};
            var type = cfg.type || (cfg._config && cfg._config.type) || 'data';
            var data = cfg.data || (cfg._config && cfg._config.data) || {};
            var opts = cfg.options || (cfg._config && cfg._config.options) || {};
            var labels = data.labels || [];
            var datasets = data.datasets || [];
            var title = '';
            try { var tt = opts.plugins && opts.plugins.title && opts.plugins.title.text; if (tt) { title = (Array.isArray(tt) ? tt.join(' ') : String(tt)); } } catch (e) { }
            // Every canvas needs its own id: the table is found and replaced by id
            // on re-render, and id-less tile canvases must not share one.
            if (!canvas.id) { canvas.id = 'pnbChart' + (++chartSeq); }
            var tableId = canvas.id + '-a11y-table';
            // The a11y data table is a real <table> (display:table) so screen
            // readers announce its rows/columns. But a <table> ignores the
            // .sr-only width:1px/height:1px clamp - table layout can't shrink a
            // box below its content - so .sr-only goes on a wrapping <div> (a
            // block box DOES collapse to 1px and clip its contents), keeping the
            // table semantics AT relies on without inflating any scroll area.
            var wrapId = tableId + '-wrap';
            var priorWrap = document.getElementById(wrapId);
            if (priorWrap && priorWrap.parentNode) { priorWrap.parentNode.removeChild(priorWrap); }
            var prior = document.getElementById(tableId); // legacy: pre-wrapper bare tables
            if (prior && prior.parentNode) { prior.parentNode.removeChild(prior); }
            // A cloned slide (chart carousel) can carry a stale copy right after the canvas.
            var sib = canvas.nextElementSibling;
            if (sib && sib.classList && sib.classList.contains('pnb-chart-a11y') && sib.parentNode) { sib.parentNode.removeChild(sib); }
            // A builder can hand over its own rows when the Chart.js data is not
            // the story (gauge fractions, gantt [start,end] pairs, map tiles):
            // data._a11yRows = { columns: [...], rows: [[...], ...] }. Without
            // that, the table is built from labels x datasets; a [a, b] pair
            // reads as "a to b" rather than JSON.
            function cellText(v) {
                if (v == null) { return ''; }
                if (Array.isArray(v)) { return (v.length === 2 && v[0] != null && typeof v[0] !== 'object') ? (String(v[0]) + ' to ' + String(v[1])) : v.map(cellText).join(', '); }
                if (typeof v === 'object') { return (v.y != null ? String(v.y) : (v.v != null ? String(v.v) : JSON.stringify(v))); }
                return String(v);
            }
            var custom = (data._a11yRows && data._a11yRows.rows && data._a11yRows.rows.length) ? data._a11yRows : null;
            // Treemaps carry their data as dataset.tree (chartjs-chart-treemap):
            // objects keyed by `key` and grouped by `groups`, no labels at all.
            if (!custom && datasets.length && Array.isArray(datasets[0].tree) && datasets[0].tree.length) {
                var tree = datasets[0].tree, ds0 = datasets[0];
                var keyF = ds0.key || '_value';
                var grp = Array.isArray(ds0.groups) ? ds0.groups : [];
                var labelF = grp.length ? grp[grp.length - 1] : '_label';
                var groupF = grp.length > 1 ? grp[0] : null;
                custom = { columns: groupF ? ['Label', 'Group', 'Value'] : ['Label', 'Value'], rows: tree.map(function (o) {
                    return groupF ? [o[labelF], o[groupF], o[keyF]] : [o[labelF], o[keyF]]; }) };
            }
            var hasData = custom ? true : !!(labels.length && datasets.length);
            var rowCount = custom ? custom.rows.length : labels.length;
            if (hasData) {
                var h = '<div id="' + wrapId + '" class="sr-only pnb-chart-a11y"><table id="' + tableId + '"><caption>' + (title ? esc(title) + ' - ' : '') + 'chart data</caption><thead><tr>';
                if (custom) {
                    var cols = custom.columns || [];
                    for (var c = 0; c < cols.length; c++) { h += '<th scope="col">' + esc(cols[c]) + '</th>'; }
                    h += '</tr></thead><tbody>';
                    for (var r = 0; r < custom.rows.length; r++) {
                        var row = custom.rows[r] || [];
                        h += '<tr>';
                        for (var cc = 0; cc < row.length; cc++) { h += (cc === 0 ? '<th scope="row">' : '<td>') + esc(cellText(row[cc])) + (cc === 0 ? '</th>' : '</td>'); }
                        h += '</tr>';
                    }
                } else {
                    h += '<th scope="col">Category</th>';
                    for (var d = 0; d < datasets.length; d++) { h += '<th scope="col">' + esc(datasets[d].label || ('Series ' + (d + 1))) + '</th>'; }
                    h += '</tr></thead><tbody>';
                    for (var i = 0; i < labels.length; i++) {
                        h += '<tr><th scope="row">' + esc(String(labels[i])) + '</th>';
                        for (var d2 = 0; d2 < datasets.length; d2++) {
                            var v = (datasets[d2].data && datasets[d2].data[i] != null) ? datasets[d2].data[i] : '';
                            h += '<td>' + esc(cellText(v)) + '</td>';
                        }
                        h += '</tr>';
                    }
                }
                h += '</tbody></table></div>';
                canvas.insertAdjacentHTML('afterend', h);
                canvas.setAttribute('aria-describedby', tableId);
            }
            // The name uses the chart the user chose (data._chartType, set by the
            // builders), not the Chart.js primitive it is drawn with - a gauge is
            // a doughnut underneath, a gantt is a bar chart.
            var typeName = String(data._chartType || type);
            var lbl = typeName.charAt(0).toUpperCase() + typeName.slice(1) + ' chart';
            if (title) { lbl += ': ' + title; }
            lbl += '. ' + (custom ? (rowCount + ' rows') : (datasets.length + ' data series, ' + labels.length + ' categories')) + (hasData ? '; full data in the adjacent table.' : '.');
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', lbl);
        } catch (e) { }
    };
    A11y.enhanceChart = window.enhanceChartA11y;

    // ------------------------------------------------------------------ boot
    onReady(function () {
        ensureSkipLink();
        runSweeps();
        startObserver();
    });
})(window, document);
