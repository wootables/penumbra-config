// acrow driver (2026-10-01): stubs + probes for the Visual Search Builder's value
// list. run.py drives the page over CDP: TRUSTED mouse / key events for the
// gestures, these helpers to set up rows and read state. Loaded BEFORE
// search_builder.js (the builder reads the stubs lazily, on open).
(function () {
    'use strict';
    var errs = window.__errs = [];
    window.addEventListener('error', function (e) { errs.push('error: ' + (e && e.message ? e.message : String(e))); });
    var _ce = console.error;
    console.error = function () { errs.push('console: ' + [].slice.call(arguments).join(' ')); return _ce.apply(console, arguments); };
    // A headless confirm() HANGS the renderer: never let one through.
    window.confirm = function () { window.__confirms = (window.__confirms || 0) + 1; return true; };
    window.alert = function (m) { errs.push('alert: ' + m); };

    var calls = window.__calls = { count: [], run: 0, preview: [], submit: [], sched: [] };
    // '[1,2]' is JSON-looking (jQuery .data() turned it into an array); 'X|Y' holds
    // a real pipe (typed form 'X\|Y'). TOG is a journal toggle column (two states);
    // CITY's values hold spaces (a typed space after a click must stay a space).
    // FRUIT has 22 values: with the scheduler's 20 recipient tokens its list scrolls
    // (a scrollbar narrows the header's action line).
    var VALUES = { NAME: ['Alice', 'Alan', 'Albert', 'Bob', '[1,2]', 'X|Y'], CODE: ['C1', 'C2'],
                   TOG: ['☐', '☑'], CITY: ['New York', 'New Haven', 'Newark'],
                   FRUIT: ['Apple', 'Apricot', 'Avocado', 'Banana', 'Blackberry', 'Blueberry', 'Cherry', 'Coconut', 'Cranberry', 'Date',
                           'Fig', 'Grape', 'Guava', 'Kiwi', 'Lemon', 'Lime', 'Mango', 'Melon', 'Nectarine', 'Orange', 'Papaya', 'Peach'] };
    // Every mousedown's click count (e.detail), so a test can show the browser
    // really counted a press as the 2nd of a double-click / double-tap.
    var md = window.__md = [];
    document.addEventListener('mousedown', function (e) { md.push(e.detail); }, true);
    // Round 4: where everything sits right AFTER the builder handled a press (window,
    // bubble phase: after its delegated handlers), before any timer runs - the row
    // count line is emptied by a tick and only refilled 200 ms later.
    window.addEventListener('mousedown', function () {
        try { window.__pressGeo = window.T && T.geo ? T.geo() : null; } catch (err) { window.__pressGeo = null; }
    }, false);
    window._penumbraSearchAPI = {
        getColumns: function () {
            return ['NAME', 'CODE', 'TOG', 'CITY', 'FRUIT'].concat(VALUES.SPONSOR ? ['SPONSOR'] : [])
                .map(function (n) { return { name: n, visible: true }; });
        },
        getColumnAutocompleteValues: function (c) { return (VALUES[c] || []).slice(); },
        countMatchingRows: function (q) { calls.count.push(q); return { matching: 1, total: 6 }; },
        runTableSearch: function () { calls.run++; },
        getCurrentReportId: function () { return 'acrow'; },
        getColumnDateInfo: function () { return null; },
        isToggleColumn: function (c) { return c === 'TOG'; }
    };

    // The hosts' own Escape handling, registered before the builder as on the pages.
    // Report + scheduler (index.php, js/main.js): a CAPTURE listener on the document
    // whose popup check (section A0) does not know the builder's value list; its
    // section C fades every open lightbox, the builder's included, and stops the key.
    // Dashboard (penumbra_dashboard.js, "Escape closes the builder"): a CAPTURE
    // listener on the window that leaves Escape to an open value list or date picker.
    window.__host = '';
    document.addEventListener('keydown', function (e) {
        if (window.__host === 'dash' || e.key !== 'Escape' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        var $lb = $('#searchBuilderLightbox');
        if (!$lb.is(':visible')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        $lb.fadeOut();
    }, true);
    window.addEventListener('keydown', function (e) {
        if (window.__host !== 'dash' || (e.key !== 'Escape' && e.key !== 'Esc')) return;
        var lb = document.getElementById('searchBuilderLightbox');
        if (!lb || !$(lb).is(':visible')) return;
        if ($('#sbAutocompleteDropdown').is(':visible') || $('#ui-datepicker-div').is(':visible')) return;
        e.preventDefault();
        e.stopPropagation();
        $(lb).fadeOut();
    }, true);
    // The preset chip: capture its options so a test can call getState().
    window.__preset = null;
    window.PenumbraPresets = {
        NS: { SEARCH: 'search' },
        create: function (o) { window.__preset = o; return { setLoaded: function () {}, refresh: function () {} }; },
        list: function () { return []; },
        reportId: function () { return 'acrow'; },
        getPin: function () { return null; }
    };
    // search_builder.js lazy-loads its markup; serve search_builder_content.php's
    // markup (past its PHP header, written to sbc.html by run.py).
    var realGet = $.get;
    $.get = function (url) {
        if (url === 'search_builder_content.php') {
            var a = [].slice.call(arguments); a[0] = 'sbc.html';
            return realGet.apply($, a);
        }
        return realGet.apply($, arguments);
    };

    function row(i) { return $('#sbConditionsContainer .sb-condition-row').eq(i || 0); }
    function box(i) { return row(i).find('.sb-value-input').not('.sb-value-input-secondary'); }
    function dd() { return $('#sbAutocompleteDropdown'); }
    function dv() { return $(this).attr('data-value'); }
    function item(v) { return dd().find('.sb-ac-item').filter(function () { return $(this).attr('data-value') === v; }).first(); }
    function open() { return dd().length > 0 && dd().is(':visible'); }
    function center(el, dx) {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: Math.round(dx === undefined ? r.left + r.width / 2 : r.left + dx), y: Math.round(r.top + r.height / 2), w: r.width, h: r.height };
    }
    function describe(el) {
        if (!el) return null;
        return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).join('.') : '');
    }

    var T = window.T = {};
    T.open = function (host) {
        window.__host = host;
        if (host === 'report') {
            $('#searchBuilderIcon').trigger('click');
        } else if (host === 'sched') {
            $('#schedEventType').val('EMAIL');
            window._penumbraSearchBuilder.openForScheduler(function (q) { calls.sched.push(q); });
        } else if (host === 'dash') {
            // As penumbra_dashboard.js opens it (openDashBuilder).
            window.openSearchBuilder({
                target: '#dashSearchInput', includePresets: false, submitLabel: 'Apply',
                submitTitle: 'Apply this filter to every tile whose report has its columns',
                previewText: function (q) { calls.preview.push(q); return 'reaches: ' + q; },
                onSubmit: function (q) { calls.submit.push(q); }
            });
        }
        return true;
    };
    T.isOpen = function () {
        var $lb = $('#searchBuilderLightbox');
        return !!($lb.length && $lb.is(':visible') && parseFloat($lb.css('opacity')) >= 1 && row(0).length);
    };
    T.setup = function (q) { window._penumbraSearchBuilder.populateFromQuery(q); return row(0).length; };
    // Round 4: what grows or shrinks BELOW the value box. A SPONSOR column of long
    // names (3 or 4 ticked wrap the query preview); pivot view, whose row count line
    // spells out the source transactions and wraps (emptied on every tick, refilled
    // 200 ms later). Called after T.open, before T.setup.
    T.longValues = function () {
        VALUES.SPONSOR = ['National Science Foundation', 'National Institutes of Health', 'Department of Energy',
                          'Department of Defense', 'NC Department of Agriculture', 'US Department of Agriculture'];
        return true;
    };
    T.pivotCount = function () {
        if (!document.getElementById('pivot-output-container')) {
            // display:block - main.css hides the container until a pivot renders
            $('body').append('<div id="pivot-output-container" style="position:absolute;left:-9999px;top:0;width:10px;height:10px;display:block"></div>');
        }
        window._penumbraSearchAPI.countMatchingRows = function (q) {
            calls.count.push(q);
            return q === '# > 0' ? { matching: 12345, total: 12345, pivotTotal: 1234 }
                                 : { matching: 567, total: 12345, pivotTotal: 1234, pivotMatching: 89 };
        };
        return true;
    };
    // The heights below the box (evidence that the count / preview really wrapped).
    T.below = function () {
        function h(sel) { var e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : null; }
        return { count: h('#searchBuilderLightbox .sb-preview-header'), preview: h('#sbQueryPreview') };
    };
    // The value row at a screen point, and the rows drawn highlighted (the arrow keys' /
    // the mouse's .sb-ac-active, or :hover) inside the list's visible area.
    T.itemAt = function (x, y) {
        var el = document.elementFromPoint(x, y);
        el = el && el.closest ? el.closest('#sbAutocompleteDropdown .sb-ac-item') : null;
        return el ? el.getAttribute('data-value') : null;
    };
    T.lit = function () {
        var d = dd()[0];
        if (!d) return [];
        var b = d.getBoundingClientRect();
        return dd().find('.sb-ac-item').filter(function () {
            var r = this.getBoundingClientRect();
            return r.bottom > b.top && r.top < b.bottom && ($(this).hasClass('sb-ac-active') || $(this).is(':hover'));
        }).map(dv).get();
    };
    T.rows = function () { return $('#sbConditionsContainer .sb-condition-row').length; };
    // Empty the value box WITHOUT an input event and focus it: the next trusted
    // keystrokes are the user's first.
    T.clearBox = function (i) { box(i).val('').trigger('focus'); return document.activeElement === box(i)[0]; };
    T.prepBox = function (i, text) { box(i).val(text).trigger('focus'); return document.activeElement === box(i)[0]; };
    T.dbl = function (i) { box(i).trigger('dblclick'); return open(); };
    T.op = function (i, op) { row(i).find('.sb-op-select').val(op).trigger('change'); return row(i).find('.sb-op-select').val(); };
    T.col = function (i, col) { row(i).find('.sb-col-select').val(col).trigger('change'); return row(i).find('.sb-col-select').val(); };
    T.remove = function (i) { row(i).find('.sb-remove-row-btn').trigger('click'); return T.rows(); };
    // The list moves to another box inside the first box's blur delay.
    T.rehost = function (i, text) { box(i)[0].focus(); box(i).val(text).trigger('input'); return open(); };
    // A click that still reaches the checkbox node after the row's mousedown
    // (what a stale cached search_builder.css lets through).
    T.cbclick = function (v) { var cb = item(v).find('.sb-ac-checkbox')[0]; if (!cb) return false; cb.click(); return true; };
    // Submit with the list still open (no blur first), read back in the SAME turn.
    T.submitSync = function () {
        $('#sbSubmitBtn').trigger('click');
        var s = T.state(0);
        return { open: s.open, set: s.set, box: s.box, target: $('#tableSearch').val() };
    };
    T.getState = function () {
        if (!window.__preset || typeof window.__preset.getState !== 'function') return null;
        var st = window.__preset.getState();
        return st ? { query: st.query, conditions: st.conditions } : null;
    };
    T.rect = function (part, v, i) {
        var $it = item(v);
        if (part === 'cb') return center($it.find('.sb-ac-checkbox')[0]);
        if (part === 'label') return center($it.find('.sb-ac-item-label')[0]);
        if (part === 'top4') {   // a row's upper edge (4px in), where a hurried hand lands
            var c = center($it.find('.sb-ac-item-label')[0]);
            return c ? { x: c.x, y: Math.round($it[0].getBoundingClientRect().top + 4), w: c.w, h: c.h } : null;
        }
        if (part === 'pad') return center($it[0], 4);   // the row's own left padding: the target is the item div
        if (part === 'box') return center(box(i)[0], 12);
        if (part === 'submit') return center($('#sbSubmitBtn')[0]);
        if (part === 'neutral') return center($('#sbQueryPreview')[0]);
        if (part === 'show') return center(dd().find('.sb-ac-show-selected')[0]);
        if (part === 'clear') return center(dd().find('.sb-ac-clear-selected')[0]);
        if (part === 'hint') return center(dd().find('.sb-ac-hint')[0], 12);
        if (part === 'counts') return center(dd().find('.sb-ac-counts')[0], 12);
        return null;
    };
    // What sits above the rows, and the rows: the value box, the list, the header.
    T.geo = function () {
        var b = box(0)[0], d = dd()[0], h = d ? d.querySelector('.sb-ac-filter-bar') : null;
        function top(el) { return el ? Math.round(el.getBoundingClientRect().top) : null; }
        return { box: top(b), list: top(d), header: h ? Math.round(h.getBoundingClientRect().height) : null,
                 vw: window.innerWidth, tops: T.tops() };
    };
    T.hit = function (x, y) { return describe(document.elementFromPoint(x, y)); };
    // Where each value row sits on screen (a tick must not move them).
    T.tops = function () {
        return dd().find('.sb-ac-item').map(function () { return $(this).attr('data-value') + '@' + Math.round(this.getBoundingClientRect().top); }).get();
    };
    T.cbStyle = function () {
        var cb = dd().find('.sb-ac-checkbox')[0];
        return cb ? getComputedStyle(cb).pointerEvents : null;
    };
    T.state = function (i) {
        var $r = row(i), $b = box(i), isOpen = open();
        var set = $r.data('sb-multi-values');
        return {
            set: Array.isArray(set) ? set.slice() : null,
            box: $b.val(),
            ph: $b.attr('placeholder'),
            rowMulti: $r.hasClass('sb-row-multi'),
            rowLink: $r.find('.sb-clear-multi-link').is(':visible'),
            boxMulti: $b.hasClass('sb-value-input-multi'),
            open: isOpen,
            checked: isOpen ? dd().find('.sb-ac-item-checked').map(dv).get() : null,
            ticks: isOpen ? dd().find('.sb-ac-checkbox:checked').closest('.sb-ac-item').map(dv).get() : null,
            shown: isOpen ? dd().find('.sb-ac-item').map(dv).get() : null,
            cbs: isOpen ? dd().find('.sb-ac-checkbox').length : null,
            active: isOpen ? dd().find('.sb-ac-item.sb-ac-active').map(dv).get() : [],
            header: isOpen ? $.trim(dd().find('.sb-ac-filter-bar').text() || '') : null,
            counts: isOpen ? $.trim(dd().find('.sb-ac-counts').text() || '') : null,
            hint: isOpen ? $.trim(dd().find('.sb-ac-hint').text() || '') : null,
            md: md.slice(),
            preview: $('#sbQueryPreview').text(),
            col: $r.find('.sb-col-select').val(),
            op: $r.find('.sb-op-select').val(),
            lb: $('#searchBuilderLightbox').is(':visible'),
            focus: document.activeElement === $b[0],
            submitLabel: $('#sbSubmitBtn').text(),
            targets: { report: $('#tableSearch').val(), sched: $('#schedSearchFilter').val(), dash: $('#dashSearchInput').val() },
            calls: { run: calls.run, sched: calls.sched.slice(), submit: calls.submit.slice(),
                     lastCount: calls.count.length ? calls.count[calls.count.length - 1] : null,
                     lastPreview: calls.preview.length ? calls.preview[calls.preview.length - 1] : null },
            errs: errs.slice()
        };
    };

    // --- Round 5 (2026-10-02): picking a row's column again reopens its value list;
    // the column cell holds its tip on one line. ---
    // How many times the value list was drawn (every render is one .html() on it).
    var renders = 0;
    var realHtml = $.fn.html;
    $.fn.html = function () {
        if (arguments.length && this.length && this[0] && this[0].id === 'sbAutocompleteDropdown') renders++;
        return realHtml.apply(this, arguments);
    };
    T.renders = function () { return renders; };
    function colSel(i) { return row(i).find('.sb-col-select')[0]; }
    T.colRect = function (i) { return center(colSel(i)); };
    // Which box hosts the open list, and where the focus is.
    T.where = function (i) {
        var h = dd().data('sbHostInput'), $r = row(i);
        return { host: !h ? null : h === box(i)[0] ? 'from' : h === $r.find('.sb-value-input-secondary')[0] ? 'to' : 'other',
                 focusSel: document.activeElement === colSel(i), focusBox: document.activeElement === box(i)[0],
                 to: $r.find('.sb-value-input-secondary').val() };
    };
    // A pick from row i's column <select> as the browser reports it, all in ONE turn,
    // read back in that turn (+ the renders it made):
    //   'chromium' the press that opens the popup (mousedown, focus, mouseup, click:
    //              detail 1), then the pick: [input + change when the value moves] and
    //              a click on the select with detail 0 (recorded in Edge 154 with trusted
    //              input: that click comes alone, no mouseup before it)
    //   'firefox'  the same press, then [change] and a click on the chosen <option>
    //   'user'     the press alone (its click has detail 1)
    //   'jq'       the press, then a jQuery .trigger('click') on the select
    //   'dismiss'  the press, then the select loses focus (Esc / a click elsewhere: no click)
    T.repick = function (i, how, toVal) {
        var sel = colSel(i);
        if (!sel) return null;
        var r0 = renders, rc = sel.getBoundingClientRect();
        function mouse(type, target, detail) {
            target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: detail,
                clientX: rc.left + 10, clientY: rc.top + rc.height / 2, button: 0 }));
        }
        mouse('mousedown', sel, 1); sel.focus(); mouse('mouseup', sel, 1); mouse('click', sel, 1);
        if (how === 'jq') $(sel).trigger('click');
        else if (how === 'dismiss') sel.blur();
        else if (how === 'chromium' || how === 'firefox') {
            if (toVal !== undefined && toVal !== null && toVal !== sel.value) {
                sel.value = toVal;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (how === 'firefox') mouse('click', sel.options[sel.selectedIndex], 1);
            else mouse('click', sel, 0);
        }
        var s = T.state(i), w = T.where(i);
        return { open: s.open, box: s.box, set: s.set, checked: s.checked, col: s.col, host: w.host,
                 focusSel: w.focusSel, focusBox: w.focusBox, renders: renders - r0 };
    };
    // A date column (the date tip), a nested sub-table column (the nested tip) and a
    // long column name. Called before T.open (the builder reads the columns on open).
    T.dateCols = function () {
        var api = window._penumbraSearchAPI, base = api.getColumns;
        api.getColumns = function () {
            return base.apply(this, arguments).concat([{ name: 'APPROVAL BEGIN', visible: true },
                { name: 'PRINCIPAL_INVESTIGATOR_HOME_DEPARTMENT_NAME', visible: true }]);
        };
        api.getColumnDateInfo = function (c) { return c === 'APPROVAL BEGIN' ? { isDate: true, jqFormat: 'mm/dd/yy', isUpper: false } : null; };
        api.buildVirtualColumnNames = function () { return ['SUBAWARDS.PI_NAME']; };
        return true;
    };
    // The four rows of the user's screenshot and its neighbours: a plain row, a between
    // row on the date column (From / To dates, the date tip), a nested column (the
    // nested tip) and a long column name.
    T.fourRows = function () {
        T.setup('NAME = Alice');
        $('#sbAddConditionBtn').trigger('click').trigger('click').trigger('click');
        T.col(1, 'APPROVAL BEGIN'); T.op(1, 'between');
        T.col(2, 'SUBAWARDS.PI_NAME'); T.op(2, 'equals');
        T.col(3, 'PRINCIPAL_INVESTIGATOR_HOME_DEPARTMENT_NAME'); T.op(3, 'contains');
        return T.rows();
    };
    T.fourVals = function () {
        var $r = $('#sbConditionsContainer .sb-condition-row');
        $r.eq(1).find('.sb-value-input').not('.sb-value-input-secondary').val('01/01/2020');
        $r.eq(1).find('.sb-value-input-secondary').val('12/31/2024');
        $r.eq(2).find('.sb-value-input').not('.sb-value-input-secondary').val('Smith');
        $r.eq(3).find('.sb-value-input').not('.sb-value-input-secondary').val('Physics');
        $r.find('.sb-value-input').first().trigger('input');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        return true;
    };
    // Where everything in the builder sits (px, one decimal) and how many lines each
    // tip and each row's action links take.
    T.layout = function () {
        function R(el) {
            if (!el) return null;
            var r = el.getBoundingClientRect();
            function f(x) { return Math.round(x * 10) / 10; }
            return { l: f(r.left), r: f(r.right), t: f(r.top), b: f(r.bottom), w: f(r.width), h: f(r.height) };
        }
        function textBox(el) {   // the text's own extent: one rect per line
            if (!el || !el.firstChild) return null;
            var rg = document.createRange(); rg.selectNodeContents(el);
            var tops = {}, right = -1e9;
            [].forEach.call(rg.getClientRects(), function (q) { if (q.width > 0) { tops[Math.round(q.top)] = 1; right = Math.max(right, q.right); } });
            return { lines: Object.keys(tops).length, right: Math.round(right * 10) / 10 };
        }
        var dlg = $('#searchBuilderLightbox .sb-lightbox-content')[0];
        var out = { vw: window.innerWidth, dlg: R(dlg), dlgScroll: dlg ? [dlg.scrollWidth, dlg.clientWidth] : null,
                    title: R($('.pnb-dlg-title')[0]), close: R($('#searchBuilderLightbox .pnb-dlg-head .close-lightbox')[0]),
                    logic: R($('.sb-logic-toggle')[0]), preview: R($('#sbQueryPreview')[0]), rows: [] };
        $('#sbConditionsContainer .sb-condition-row').each(function () {
            var $r = $(this), tip = $r.find('.sb-date-tip:visible, .sb-nested-tip:visible')[0] || null;
            var acts = $r.find('.sb-value-actions')[0];
            var tb = textBox(tip), ab = acts ? textBox(acts) : null;
            var cs = tip ? getComputedStyle(tip) : null;
            out.rows.push({ col: $r.find('.sb-col-select').val(), op: $r.find('.sb-op-select').val(), row: R(this),
                scroll: [this.scrollWidth, this.clientWidth], wrapper: R($r.find('.sb-col-wrapper')[0]),
                wrapperMin: getComputedStyle($r.find('.sb-col-wrapper')[0]).minWidth,
                tip: tip ? { cls: tip.className, lines: tb && tb.lines, right: tb && tb.right, ws: cs.whiteSpace } : null,
                opSel: R($r.find('.sb-op-select')[0]), v1: R($r.find('.sb-value-input').not('.sb-value-input-secondary')[0]),
                v2: R($r.find('.sb-value-input-secondary:visible')[0]), actsLines: ab ? ab.lines : 0,
                remove: R($r.find('.sb-remove-row-btn')[0]) });
        });
        return out;
    };
})();
