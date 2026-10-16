/* repoorder suite (2026-10-02) - BROWSER HALF driver.
 *
 * Mocks $.ajax for get_server_reports.php, opens the REAL repository module and
 * records asserts into window.__RORESULT (run.py polls window.__RODONE):
 *   P-loaded       the candidate module parsed and exposed window.PenumbraRepo
 *   P-fixture      the opening payload is in neither date nor title order
 *   J-initial      the opening list shows the payload's order (no date re-sort)
 *   P-title-asc    a Title header click sorts A-Z (the sort itself works)
 *   J-reset        the third Title click (sort removed) restores the payload order
 *   P-rebuild      a column change while sorted keeps the sort + adds the column
 *   J-rebuild      ...and clearing the sort afterwards still restores the payload order
 *   J-loadmore     Load More appends its rows (server order, duplicates skipped)
 *   J-loadmore-reset  sort + clear afterwards = opening rows then appended rows
 *   J-search       search results are still shown newest-updated first (unchanged)
 *   J-restore      clearing the search brings back the pre-search rows in order
 *   K-cancel / K-escape / K-save (2026-10-15, WCAG 2.4.3)  the details pane's inline tag editor
 *                  puts focus back on that report's Edit-tags pencil after its redraw
 *   W-key / W-zero / W-reset (2026-10-15, WCAG 2.1.1)  column widths without a mouse: + / - on a focused
 *                  header step its width, 0 drops it, the chooser's "Reset to defaults" clears them all (no second reset button)
 *   E-errors       no page errors anywhere
 */
(function () {
    'use strict';
    var asserts = [];
    function t(id, ok, detail) { asserts.push({ id: id, ok: !!ok, detail: String(detail || '') }); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ora(day, mon) { return pad(day) + '-' + mon + '-26 09.00.00.000000 AM'; }
    function rep(id, sid, title, upd) {
        return { ID: String(id), SHORT_ID: sid, TITLE: title, OWNER_ID: 'owner' + (id % 3), AUTHORIZED: 'public',
                 CREATED_AT: upd, UPDATED_AT: upd, STATE_DATA: '', LAST_ACCESSED_AT: null, LAST_ACCESSED_BY: null,
                 SNAPSHOT_COUNT: 0, LAST_SNAPSHOT_AT: null, LAST_SNAPSHOT_BY: null, LAST_ROW_COUNT: null,
                 LAST_COL_COUNT: null, LAST_QUERY_MS: null, LAST_RUN_AT: null, TASKS: [], ACTIVE_TASK_COUNT: 0,
                 PRESET_COUNTS: {}, EDITORS: [] };
    }

    // Opening list: 30 rows (as the server sends them: 15 of mine, 15 of others').
    // UPDATED_AT and TITLE are permutations, so neither sort can pass for the payload.
    var INITIAL = [];
    for (var i = 0; i < 30; i++) {
        INITIAL.push(rep(1000 + i, 'ra' + pad(i), 'Report ' + String.fromCharCode(65 + ((i * 11) % 26)) + pad(i), ora(((i * 7) % 30) + 1, 'SEP')));
    }
    // Load More (mode=loadmore = UPDATED_AT desc): 17 new rows + 3 already on screen.
    var MORE = [], MORE_NEW = [];
    var dupAt = { 0: 1004, 7: 1009, 12: 1020 };
    for (var j = 0, k = 0; j < 20; j++) {
        if (dupAt[j]) { MORE.push(INITIAL[dupAt[j] - 1000]); continue; }
        var r = rep(2000 + k, 'rb' + pad(k), 'Older ' + String.fromCharCode(90 - k) + pad(k), ora(25 - k, 'AUG'));
        MORE.push(r); MORE_NEW.push(2000 + k); k++;
    }
    // Search: deliberately NOT date ordered; the client sorts these newest first.
    var SEARCH = [[3000, 5], [3001, 20], [3002, 1], [3003, 15], [3004, 10], [3005, 25]].map(function (p) {
        return rep(p[0], 'rs' + p[0], 'Found ' + p[0], ora(p[1], 'JUL'));
    });
    var SEARCH_WANT = [3005, 3001, 3003, 3004, 3000, 3002];
    var INIT_IDS = INITIAL.map(function (r) { return +r.ID; });

    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    var calls = [];
    var $ = window.jQuery;
    $.ajax = function (o) {
        var d = (o && o.data) || {};
        calls.push((o && o.url) + ' ' + JSON.stringify(d));
        var resp = { status: 'success', data: [] };
        if (o && o.url === 'get_server_reports.php') {
            if (d.mode === 'initial') { resp = { status: 'success', data: clone(INITIAL), total_count: 100 }; }
            else if (d.mode === 'loadmore') { resp = { status: 'success', data: clone(MORE), total_count: 100 }; }
            else if (d.mode === 'search') { resp = { status: 'success', data: clone(SEARCH), total_count: 6 }; }
        }
        var dfd = $.Deferred(), aborted = false;
        var xhr = dfd.promise({ abort: function () { aborted = true; }, readyState: 1, status: 200 });
        setTimeout(function () {
            if (aborted) { return; }
            if (o.success) { o.success(resp, 'success', xhr); }
            dfd.resolve(resp, 'success', xhr);
            if (o.complete) { o.complete(xhr, 'success'); }
        }, 15);
        return xhr;
    };

    function domIds() {
        return $('#serverReportListTable tbody > tr[data-numeric-id]').map(function () { return +this.getAttribute('data-numeric-id'); }).get();
    }
    function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
    function show(a) { return a.length + ' rows: ' + a.slice(0, 12).join(',') + (a.length > 12 ? ',...' : ''); }
    function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
    async function waitFor(fn, ms) {
        var t0 = Date.now();
        while (Date.now() - t0 < (ms || 8000)) { try { if (fn()) { return true; } } catch (e) { } await sleep(25); }
        return false;
    }
    function clickHead(key) { $('#serverReportListTable thead th[data-colkey="' + key + '"]').trigger('click'); }
    function titleOrder(ids) {
        var byId = {};
        $('#serverReportListTable tbody > tr[data-numeric-id]').each(function () { byId[this.getAttribute('data-numeric-id')] = this.getAttribute('data-title'); });
        return ids.slice().sort(function (a, b) { return byId[a].toLowerCase().localeCompare(byId[b].toLowerCase()); });
    }

    async function run() {
        t('P-loaded', window.PenumbraRepo && typeof window.PenumbraRepo.open === 'function', 'window.PenumbraRepo ' + typeof window.PenumbraRepo);
        if (!window.PenumbraRepo) { return; }
        var byDate = INITIAL.slice().sort(function (a, b) { return moment(b.UPDATED_AT, 'DD-MMM-YY hh.mm.ss.SSSSSS A') - moment(a.UPDATED_AT, 'DD-MMM-YY hh.mm.ss.SSSSSS A'); }).map(function (r) { return +r.ID; });
        var byTitle = INITIAL.slice().sort(function (a, b) { return a.TITLE.toLowerCase().localeCompare(b.TITLE.toLowerCase()); }).map(function (r) { return +r.ID; });
        t('P-fixture', !same(byDate, INIT_IDS) && !same(byTitle, INIT_IDS), 'date-sorted ' + show(byDate));

        window.PenumbraRepo.open();
        var ok = await waitFor(function () { return domIds().length === 30; });
        t('J-initial', ok && same(domIds(), INIT_IDS), (ok ? '' : 'TIMEOUT ') + 'got ' + show(domIds()) + ' | want ' + show(INIT_IDS));

        clickHead('TITLE');
        t('P-title-asc', same(domIds(), titleOrder(INIT_IDS)), 'got ' + show(domIds()));
        clickHead('TITLE'); clickHead('TITLE');      // desc, then removed
        t('J-reset', same(domIds(), INIT_IDS), 'got ' + show(domIds()));

        // A column change while sorted re-renders every row (rebuildTable).
        clickHead('TITLE');
        $('#repoColsBtn').trigger('click');
        await waitFor(function () { return $('.rc-check[data-key="OWNER_ID"]').length > 0; }, 3000);
        $('.rc-check[data-key="OWNER_ID"]').prop('checked', true).trigger('change');
        var hasOwner = $('#serverReportListTable thead th[data-colkey="OWNER_ID"]').length === 1;
        t('P-rebuild', hasOwner && same(domIds(), titleOrder(INIT_IDS)), 'owner column ' + hasOwner + ', got ' + show(domIds()));
        clickHead('TITLE'); clickHead('TITLE');
        t('J-rebuild', same(domIds(), INIT_IDS), 'got ' + show(domIds()));
        $('#repoColsBtn').trigger('click');

        var WANT_MORE = INIT_IDS.concat(MORE_NEW);
        $('#loadMoreReportsBtn').trigger('click');
        ok = await waitFor(function () { return domIds().length === WANT_MORE.length; });
        await sleep(50);
        t('J-loadmore', ok && same(domIds(), WANT_MORE), (ok ? '' : 'TIMEOUT ') + 'got ' + show(domIds().slice(28)) + ' (from row 29)');
        clickHead('TITLE'); clickHead('TITLE'); clickHead('TITLE');
        t('J-loadmore-reset', same(domIds(), WANT_MORE), 'got ' + show(domIds()));

        $('#reportFilterInput').val('zzq').trigger('keyup');
        ok = await waitFor(function () { var d = domIds(); return d.length === 6 && d[0] >= 3000; });
        t('J-search', ok && same(domIds(), SEARCH_WANT), (ok ? '' : 'TIMEOUT ') + 'got ' + show(domIds()) + ' | want ' + SEARCH_WANT.join(','));

        $('#reportFilterInput').val('').trigger('keyup');
        ok = await waitFor(function () { return domIds().length === WANT_MORE.length; });
        t('J-restore', ok && same(domIds(), WANT_MORE), (ok ? '' : 'TIMEOUT ') + 'got ' + show(domIds()));

        // ---- W-*: column widths without a mouse (WCAG 2.1.1, 2026-10-15) ----
        // A focused header takes the report grid's keys (+ / - step 20px, 0 drops its saved width);
        // reset-all is the chooser's "Reset to defaults" (user 2026-10-15: no second reset button).
        function savedWidths() { try { return (JSON.parse(localStorage.getItem('penumbra_repo_columns') || '{}') || {}).widths || {}; } catch (e) { return {}; } }
        function key(el, k) { var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev; }
        var thT = $('#serverReportListTable thead th[data-colkey="TITLE"]')[0];
        if (thT) {
            thT.focus();
            var w0 = thT.offsetWidth, ev1 = key(thT, '+'), w1 = savedWidths().TITLE;
            var fixed = $('#serverReportListTable').hasClass('sr-colfixed');
            key(thT, '-'); key(thT, '-');
            var w2 = savedWidths().TITLE;
            // w1 is the measured width + 20 (the measure can drift a few px from w0 between runs that share a
            // browser profile, so it is held to +-10); the two presses of - then take exactly 40 off it.
            t('W-key', ev1.defaultPrevented && typeof w1 === 'number' && Math.abs(w1 - (w0 + 20)) <= 10 && w2 === w1 - 40 && fixed && thT.style.width === w2 + 'px',
              'w0=' + w0 + ' after + saved=' + w1 + ' after - - saved=' + w2 + ' style=' + thT.style.width + ' fixed=' + fixed + ' prevented=' + ev1.defaultPrevented);
            key(thT, '0');
            var sw = savedWidths();
            t('W-zero', !Object.prototype.hasOwnProperty.call(sw, 'TITLE') && Object.keys(sw).length > 0, 'saved after 0: ' + JSON.stringify(sw));
            key(thT, '+');   // a saved TITLE width again, so the reset has something to clear
            $('#repoColsBtn').trigger('click');
            await waitFor(function () { return $('#repoColsReset').length > 0; }, 3000);
            var rb = $('#repoColsReset')[0], extra = $('#repoColWidthsReset').length;
            if (rb) { rb.focus(); $(rb).trigger('click'); }
            await waitFor(function () { return Object.keys(savedWidths()).length === 0; }, 3000);
            var sw2 = savedWidths(), thT2 = $('#serverReportListTable thead th[data-colkey="TITLE"]')[0];
            t('W-reset', !!rb && extra === 0 && Object.keys(sw2).length === 0 && !!thT2 && thT2.style.width === '' && !$('#serverReportListTable').hasClass('sr-colfixed'),
              'button=' + !!rb + ' extra reset buttons=' + extra + ' saved after=' + JSON.stringify(sw2) + ' style="' + (thT2 ? thT2.style.width : 'no th') + '"');
            if (!$('#repoColsPanel').attr('hidden')) { $('#repoColsBtn').trigger('click'); }
        } else { t('W-key', false, 'no TITLE header'); t('W-zero', false, 'no TITLE header'); t('W-reset', false, 'no TITLE header'); }

        // ---- K-*: the details pane's inline tag editor hands focus back (WCAG 2.4.3, 2026-10-15) ----
        // Cancel, Escape and Save redraw the pane; focus must land on THAT report's Edit-tags pencil, not <body>.
        penumbra_vars.isGlobalAdmin = true; penumbra_vars.tagVocabulary = ['ALPHA', 'BETA'];
        if (typeof window.show_text !== 'function') { window.show_text = function () {}; }   // main.js's toast, used by a Save
        var $first = $('#serverReportListTable tbody > tr[data-numeric-id]').first();
        var sid = String($first.data('report-id'));
        $first.trigger('click');
        function pencil() { return $('#serverReportDetailsPane .repo-tag-edit').filter(function () { return this.getAttribute('data-tag-short-id') === sid; })[0]; }
        function where() { var a = document.activeElement; return a ? (a.tagName + '.' + (a.className || '') + (a === document.body ? ' (body)' : '')) : 'null'; }
        async function openEd() {
            var p = pencil(); if (!p) { return false; }
            $(p).trigger('click');
            return await waitFor(function () { return $('#serverReportDetailsPane .repo-tag-editor .repo-tag-input').length === 1; }, 3000);
        }
        var hasPencil = await waitFor(function () { return !!pencil(); }, 3000);
        ok = hasPencil && await openEd();
        if (ok) { $('#serverReportDetailsPane .repo-tag-cancel').trigger('click'); }
        t('K-cancel', ok && pencil() && document.activeElement === pencil(), (hasPencil ? '' : 'NO PENCIL ') + 'focus on ' + where());
        ok = hasPencil && await openEd();
        if (ok) { $('#serverReportDetailsPane .repo-tag-input').trigger($.Event('keydown', { key: 'Escape' })); }
        t('K-escape', ok && pencil() && document.activeElement === pencil(), 'focus on ' + where());
        ok = hasPencil && await openEd();
        if (ok) {
            var $save = $('#serverReportDetailsPane .repo-tag-save');
            $save[0].focus();
            $save.trigger('click');
            ok = await waitFor(function () { return $('#serverReportDetailsPane .repo-tag-editor').length === 0; }, 3000);
            await sleep(30);
        }
        t('K-save', ok && pencil() && document.activeElement === pencil(), (ok ? '' : 'TIMEOUT ') + 'focus on ' + where());
    }

    window.RO = {
        start: function () {
            run().catch(function (e) { window.__ERR.push('driver: ' + (e && e.stack || e)); }).then(function () {
                setTimeout(function () {
                    t('E-errors', window.__ERR.length === 0, window.__ERR.slice(0, 5).join(' || '));
                    window.__RORESULT = { asserts: asserts, calls: calls };
                    window.__RODONE = true;
                }, 100);
            });
        }
    };
})();
