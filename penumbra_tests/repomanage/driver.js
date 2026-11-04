/* repomanage suite (2026-11-03) - BROWSER HALF driver. Records asserts into window.__RXRESULT (run.py polls __RXDONE).
 *   P-loaded    the module parsed, the list drew its 12 rows
 *   S-default   docked page, never-dragged divider: the details pane opens at 600px (SPLIT_PAGE_DETAILS)
 *   S-floor     End on the splitter (list as wide as allowed): the details pane stops at 460px (SPLIT_DETAILS_MIN)
 *   S-css       the CSS default/floor: details flex-grow 2.5, min-width 460px, border-box
 *   M-arm       Manage Mode arms: the SEL + STATUS columns show
 *   M-frame     the Manage bar's 3px frame; the band's inset edges on the SEL (left) and STATUS (right) cells
 *   M-headEdge  the band's edge on the HEADING row is the heading text colour, not the brand
 *   M-natural   under saved column widths SEL / STATUS take 42 / 128px (not the auto-layout slack)
 *   M-fit       a saved width too wide for the list: Manage Mode shrinks it to fit (table <= the scroller)
 *   M-nosave    ...and only for display: the saved width is unchanged
 *   X-shut      Erase data is off the everyday row (no purge button there) and its row starts shut
 *   X-open      the toggle opens the row (aria-expanded true) and the sticky offset grows with the bar
 *   X-close     a second click shuts it
 *   X-rearm     open it, disarm, re-arm: it starts shut again
 *   E-errors    no page errors anywhere
 */
(function () {
    'use strict';
    var asserts = [];
    function t(id, ok, detail) { asserts.push({ id: id, ok: !!ok, detail: String(detail || '') }); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function rep(id, sid, title, day) {
        var upd = pad(day) + '-SEP-26 09.00.00.000000 AM';
        return { ID: String(id), SHORT_ID: sid, TITLE: title, OWNER_ID: 'owner' + (id % 3), AUTHORIZED: 'public',
                 CREATED_AT: upd, UPDATED_AT: upd, STATE_DATA: '', LAST_ACCESSED_AT: null, LAST_ACCESSED_BY: null,
                 SNAPSHOT_COUNT: 0, LAST_SNAPSHOT_AT: null, LAST_SNAPSHOT_BY: null, LAST_ROW_COUNT: null,
                 LAST_COL_COUNT: null, LAST_QUERY_MS: null, LAST_RUN_AT: null, TASKS: [], ACTIVE_TASK_COUNT: 0,
                 PRESET_COUNTS: {}, EDITORS: [] };
    }
    var INITIAL = [];
    for (var i = 0; i < 12; i++) { INITIAL.push(rep(2000 + i, 'rx' + pad(i), 'Report ' + pad(i), i + 1)); }
    var $ = window.jQuery;
    $.ajax = function (o) {
        var d = (o && o.data) || {}, resp = { status: 'success', data: [] };
        if (o && o.url === 'get_server_reports.php' && d.mode === 'initial') {
            resp = { status: 'success', data: JSON.parse(JSON.stringify(INITIAL)), total_count: 12 };
        }
        var dfd = $.Deferred(), xhr = dfd.promise({ abort: function () { }, readyState: 1, status: 200 });
        setTimeout(function () { if (o.success) { o.success(resp, 'success', xhr); } dfd.resolve(resp, 'success', xhr); if (o.complete) { o.complete(xhr, 'success'); } }, 15);
        return xhr;
    };
    var PREF_KEY = 'penumbra_repo_columns';
    try { localStorage.clear(); } catch (e) { }

    function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
    async function waitFor(fn, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { try { if (fn()) { return true; } } catch (e) { } await sleep(25); } return false; }
    function rows() { return document.querySelectorAll('#serverReportListTable tbody > tr[data-numeric-id]').length; }
    function head(key) { return document.querySelector('#serverReportListTable thead th[data-colkey="' + key + '"]'); }
    function cell(key) { return document.querySelector('#serverReportListTable tbody > tr[data-numeric-id] td[data-col="' + key + '"]'); }
    function pane() { return document.getElementById('serverReportDetailsPane'); }
    function cs(el) { return getComputedStyle(el); }
    function chooserOpen() { var p = document.getElementById('repoColsPanel'); return !!p && !p.hasAttribute('hidden') && p.style.display !== 'none'; }
    async function toggleManage() {
        if (!chooserOpen()) { $('#repoColsBtn').trigger('click'); await sleep(80); }
        $('#repoManageBtn').trigger('click');
        await sleep(80);
        if (chooserOpen()) { $('#repoColsBtn').trigger('click'); }
        await sleep(400);
    }
    function bulkH() { var sc = document.querySelector('.sr-list-scroll'); return sc ? parseFloat(sc.style.getPropertyValue('--sr-bulk-h')) || 0 : 0; }
    function near(a, b, tol) { return Math.abs(a - b) <= (tol || 2); }

    async function run() {
        t('P-loaded', window.PenumbraRepo && typeof window.PenumbraRepo.open === 'function', 'window.PenumbraRepo ' + typeof window.PenumbraRepo);
        if (!window.PenumbraRepo) { return; }
        window.PenumbraRepo.open();
        if (!await waitFor(function () { return rows() === 12; })) { t('P-loaded', false, 'rows ' + rows()); return; }
        await sleep(300);

        // ---- split ----
        var lay = document.getElementById('serverReportLayout');
        var dw = pane().offsetWidth;
        t('S-default', near(dw, 600), 'details ' + dw + ' layout ' + (lay && lay.clientWidth));
        var sp = document.getElementById('srSplitter');
        if (sp) { sp.focus(); $(sp).trigger($.Event('keydown', { key: 'End', keyCode: 35 })); await sleep(150); }
        dw = pane().offsetWidth;
        // the JS clamp itself (the CSS min-width alone would also stop the pane at 460): the list's assigned basis and
        // the splitter's aria-valuemax both leave exactly SPLIT_DETAILS_MIN + the 6px bar
        var lw = lay ? lay.clientWidth : 0, basis = (document.getElementById('serverReportListPane').style.flex || '').split(' ').pop();
        var vmax = sp ? +sp.getAttribute('aria-valuemax') : 0;
        t('S-floor', !!sp && near(dw, 460) && basis === (lw - 466) + 'px' && vmax === lw - 466, 'details ' + dw + ' basis ' + basis + ' valuemax ' + vmax + ' want ' + (lw - 466));
        var pcs = cs(pane());
        t('S-css', pcs.flexGrow === '2.5' && pcs.minWidth === '460px' && pcs.boxSizing === 'border-box', pcs.flexGrow + ' ' + pcs.minWidth + ' ' + pcs.boxSizing);
        try { localStorage.removeItem('penumbra_repo_split_page'); } catch (e) { }

        // ---- saved column widths: one too wide for the list once Manage Mode adds its two columns ----
        var scroller = document.querySelector('.sr-list-scroll');
        var big = Math.max(300, Math.min(1500, scroller.clientWidth - 120));
        localStorage.setItem(PREF_KEY, JSON.stringify({ widths: { TITLE: big } }));
        await toggleManage();
        t('M-arm', !!head('SEL') && !!head('STATUS'), 'SEL ' + !!head('SEL') + ' STATUS ' + !!head('STATUS'));
        if (!head('SEL')) { return; }
        var bar = document.getElementById('srBulkBar');
        var selS = cs(cell('SEL')).boxShadow, stS = cs(cell('STATUS')).boxShadow;
        t('M-frame', cs(bar).borderTopWidth === '3px' && cs(bar).borderLeftWidth === '3px' && / 3px 0px 0px 0px inset/.test(selS) && /-3px 0px 0px 0px inset/.test(stS),
          'bar ' + cs(bar).borderTopWidth + ' | SEL ' + selS + ' | STATUS ' + stS);
        var hs = cs(head('SEL')), hcol = hs.color;
        t('M-headEdge', hs.boxShadow.indexOf(hcol) === 0 && hs.boxShadow.split(hcol).length === 3, 'color ' + hcol + ' | shadow ' + hs.boxShadow);
        // the width the plan ASSIGNS (cell borders can render a px or two over it); auto-layout slack measured 74px here
        var sw = head('SEL').style.width, stw = head('STATUS').style.width;
        t('M-natural', sw === '42px' && stw === '128px', 'SEL ' + sw + ' STATUS ' + stw + ' (rendered ' + head('SEL').offsetWidth + ' / ' + head('STATUS').offsetWidth + ')');
        var tw = document.getElementById('serverReportListTable').offsetWidth, tit = head('TITLE').offsetWidth;
        t('M-fit', tw <= scroller.clientWidth + 1 && tit < big, 'table ' + tw + ' scroller ' + scroller.clientWidth + ' TITLE ' + tit + ' saved ' + big);
        var savedNow = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
        t('M-nosave', !!savedNow.widths && savedNow.widths.TITLE === big, JSON.stringify(savedNow.widths));

        // ---- Erase data row ----
        var er = document.getElementById('srEraseRow'), tg = document.getElementById('srEraseToggle');
        var inRow = document.querySelectorAll('.sr-bulk-actions .sr-purge-btn').length;
        t('X-shut', !!er && !!tg && er.hidden && inRow === 0 && document.querySelectorAll('#srEraseRow .sr-purge-btn').length === 6,
          'row ' + !!er + ' toggle ' + !!tg + ' hidden ' + (er && er.hidden) + ' purge on everyday row ' + inRow);
        if (!er || !tg) { return; }
        var h0 = bulkH();
        $(tg).trigger('click'); await sleep(100);
        var h1 = bulkH();
        t('X-open', !er.hidden && tg.getAttribute('aria-expanded') === 'true' && h1 > h0 + 10 && near(h1, bar.offsetHeight, 1),
          'hidden ' + er.hidden + ' expanded ' + tg.getAttribute('aria-expanded') + ' h ' + h0 + '->' + h1 + ' bar ' + bar.offsetHeight);
        $(tg).trigger('click'); await sleep(100);
        t('X-close', er.hidden && tg.getAttribute('aria-expanded') === 'false' && near(bulkH(), h0, 1), 'hidden ' + er.hidden + ' h ' + bulkH());
        $(tg).trigger('click'); await sleep(100);
        await toggleManage();   // off
        await toggleManage();   // on again
        er = document.getElementById('srEraseRow'); tg = document.getElementById('srEraseToggle');
        t('X-rearm', !!head('SEL') && !!er && er.hidden && tg.getAttribute('aria-expanded') === 'false', 'manage ' + !!head('SEL') + ' hidden ' + (er && er.hidden));
        await toggleManage();
    }

    window.RX = {
        start: function () {
            run().catch(function (e) { window.__ERR.push('driver: ' + (e && e.stack || e)); }).then(function () {
                setTimeout(function () {
                    t('E-errors', window.__ERR.length === 0, window.__ERR.slice(0, 5).join(' || '));
                    window.__RXRESULT = { asserts: asserts };
                    window.__RXDONE = true;
                }, 100);
            });
        }
    };
})();
