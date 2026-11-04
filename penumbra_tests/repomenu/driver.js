/* repomenu suite (2026-11-03, menufix) - BROWSER HALF driver.
 *
 * Mocks $.ajax for get_server_reports.php, opens the REAL repository module, right-clicks its list and records asserts
 * into window.__RMRESULT (run.py polls window.__RMDONE):
 *   P-loaded    the module parsed, the list drew its 12 rows
 *   H-head      a heading's menu: Sort ascending, Sort descending, List options... (its name the heading's)
 *   H-sortAsc   Sort ascending sorts the list A-Z by that column; H-tick: it is ticked when the menu opens again
 *   H-sortDesc  Sort descending, Z-A; H-clear: Clear sort (offered while sorted) puts the server's order back
 *   H-cols      List options... opens the column chooser (live's right-click did only that)
 *   H-noSort    a heading that does not sort (Fav: data-sortkind none / no-sort) offers List options... alone
 *   R-row       a row's menu: Open, Open in a new tab, Copy link, Copy report ID, Add to favorites
 *   R-title     its name: the report's title and short ID
 *   R-tab       Open in a new tab opens index.php?id=<short id> in a new tab
 *   R-link      Copy link copies the report's whole address (index.php?id=...); R-id: Copy report ID its short ID
 *   R-fav       Add to favorites stars the row; the menu then offers Remove from favorites
 *   R-admin     Metrics for this report: a global admin only
 *   R-deleted   a deleted report's row: Copy report ID alone (nothing to open)
 *   R-shift     Shift+right-click keeps the browser's menu
 *   R-kbd       the keyboard (Shift+F10: no pointer) drops the menu under the row, its first item focused
 *   R-off       the menu engine rolled back (no Penumbra.colMenu): a heading opens List options, a row the browser's menu
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
    // 12 rows in the server's order: neither title nor id order
    var INITIAL = [];
    for (var i = 0; i < 12; i++) { INITIAL.push(rep(1000 + i, 'rm' + pad(i), 'Report ' + String.fromCharCode(65 + ((i * 5) % 12)) + pad(i), ((i * 7) % 28) + 1)); }
    INITIAL[1].SNAPSHOT_COUNT = 2;   // (menufix2) its menu offers View snapshots
    INITIAL[0].TAGS = ['ALPHA', 'BETA'];   // (menufix4) tag pills in its row
    var INIT_IDS = INITIAL.map(function (r) { return +r.ID; });
    var $ = window.jQuery;
    $.ajax = function (o) {
        var d = (o && o.data) || {}, resp = { status: 'success', data: [] };
        if (o && o.url === 'get_server_reports.php' && d.mode === 'initial') { resp = { status: 'success', data: JSON.parse(JSON.stringify(INITIAL)), total_count: 12 }; }
        var dfd = $.Deferred(), xhr = dfd.promise({ abort: function () { }, readyState: 1, status: 200 });
        setTimeout(function () { if (o.success) { o.success(resp, 'success', xhr); } dfd.resolve(resp, 'success', xhr); if (o.complete) { o.complete(xhr, 'success'); } }, 15);
        return xhr;
    };
    // what the items hand over: a new tab, the clipboard
    var opened = [], clip = [];
    window.open = function (u, w) { opened.push([String(u), String(w)]); return null; };
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (s) { clip.push(String(s)); return Promise.resolve(); } } }); } catch (e) { }

    function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
    async function waitFor(fn, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { try { if (fn()) { return true; } } catch (e) { } await sleep(25); } return false; }
    function domIds() { return $('#serverReportListTable tbody > tr[data-numeric-id]').map(function () { return +this.getAttribute('data-numeric-id'); }).get(); }
    function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
    function head(key) { return document.querySelector('#serverReportListTable thead th[data-colkey="' + key + '"]'); }
    function row(i) { return document.querySelectorAll('#serverReportListTable tbody > tr[data-numeric-id]')[i || 0]; }
    function menu() { return document.getElementById('pnbHeadMenu'); }
    function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
    function item(a) { var m = menu(); return m ? m.querySelector('[data-act="' + a + '"]') : null; }
    function name() { var m = menu(), n = m ? m.querySelector('.pnb-hm-name') : null; return n ? n.textContent : ''; }
    function close() { if (window.Penumbra && window.Penumbra.colMenu) { window.Penumbra.colMenu.close(); } }
    function rclick(el, o) {
        o = o || {};
        var r = el.getBoundingClientRect();
        var ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: o.kbd ? 0 : 2, shiftKey: !!o.shift,
            clientX: o.kbd ? 0 : Math.round(r.left + 8), clientY: o.kbd ? 0 : Math.round(r.top + 6) });
        (o.target || el).dispatchEvent(ev);
        return ev.defaultPrevented;
    }
    async function pick(el, a) { close(); rclick(el); var it = item(a); if (!it) { close(); return false; } it.click(); await sleep(150); return true; }
    function colOrder(key) {
        var by = {};
        INITIAL.forEach(function (r) { by[r.ID] = String(r[key]).toLowerCase(); });
        return INIT_IDS.slice().sort(function (a, b) { return by[a].localeCompare(by[b]); });
    }
    function chooserOpen() { var p = document.getElementById('repoColsPanel'); return !!p && !p.hasAttribute('hidden') && p.style.display !== 'none'; }
    function closeChooser() { if (chooserOpen()) { $('#repoColsBtn').trigger('click'); } }

    async function run() {
        t('P-loaded', window.PenumbraRepo && typeof window.PenumbraRepo.open === 'function', 'window.PenumbraRepo ' + typeof window.PenumbraRepo);
        if (!window.PenumbraRepo) { return; }
        window.PenumbraRepo.open();
        var ok = await waitFor(function () { return domIds().length === 12; });
        if (!ok) { t('P-loaded', false, 'the list never drew its 12 rows: ' + domIds().length); return; }

        // (menufix4) the details panel before a report is picked, and the popup's empty space: the list's menu, no Clear all
        var pane0 = document.getElementById('serverReportDetailsPane');
        var pe = !!pane0 && rclick(pane0), pa0 = acts(), pn0 = name();
        t('L-pane', pe && pn0 === 'Reports' && pa0.indexOf('repoColumns') >= 0 && pa0.indexOf('repoOpen') < 0 && pa0.indexOf('clearPrefs') < 0, pa0.join() + ' | ' + pn0);
        close();
        var lbx = document.querySelector('#openReportListLightbox .lightbox-content');
        var gp = lbx ? rclick(lbx, { target: lbx }) : false, ga = acts();
        t('L-gap', gp && name() === 'Reports' && ga.indexOf('repoColumns') >= 0, ga.join() + ' | prevented ' + gp);
        close();
        // a heading
        var th = head('TITLE');
        var pv = rclick(th), a = acts();
        t('H-head', pv && a.join() === 'repoSortAsc,repoSortDesc,repoColumns' && name() === 'Report Description' && !chooserOpen(), a.join() + ' | ' + name() + ' | chooser ' + chooserOpen());   // (menufix2: List options... inside Columns)
        close(); closeChooser();
        var want = colOrder('TITLE');
        ok = await pick(th, 'repoSortAsc');
        t('H-sortAsc', ok && same(domIds(), want), domIds().join());
        rclick(th);
        t('H-tick', !!item('repoSortAsc') && item('repoSortAsc').getAttribute('aria-checked') === 'true' && item('repoSortDesc').getAttribute('aria-checked') === 'false', acts().join());
        close();
        ok = await pick(th, 'repoSortDesc');
        t('H-sortDesc', ok && same(domIds(), want.slice().reverse()), domIds().join());
        ok = await pick(th, 'repoSortClear');
        t('H-clear', ok && same(domIds(), INIT_IDS), domIds().join());
        close(); rclick(th); var cIt = item('repoColumns'); if (cIt) { cIt.click(); await sleep(150); }
        var lo = document.querySelector('.pnb-hm-sub [data-act="repoCols"]'); ok = !!lo; if (lo) { lo.click(); }
        await sleep(150);
        t('H-cols', chooserOpen() || (!ok && (rclick(th), chooserOpen())), 'chooser ' + chooserOpen());
        closeChooser(); close();
        var fav = head('SHORT_ID');   // a heading that does not sort (the selection column's: no-sort), its name as shown
        fav.classList.add('no-sort');
        rclick(fav);
        t('H-noSort', acts().join() === 'repoColumns' && name() === 'Short ID', acts().join() + ' | ' + name());
        fav.classList.remove('no-sort');
        close(); closeChooser();

        // a row
        var tr = row(0), rid = tr.getAttribute('data-report-id'), rtitle = tr.getAttribute('data-title');
        pv = rclick(tr, { target: tr.querySelector('td[data-col="TITLE"]') || tr });
        a = acts();
        t('R-row', pv && a.join() === 'repoOpen,repoOpenTab,repoCopyLink,repoCopyId,repoFav,repoMetrics,repoCalendar,repoColumns' && /Add to favorites/.test(item('repoFav').textContent), a.join());   // (menufix2: the panel's tools, Columns)
        t('R-title', name() === rtitle + ' (' + rid + ')', name());
        close();
        ok = await pick(tr, 'repoOpenTab');
        t('R-tab', ok && opened.length === 1 && opened[0][0] === 'index.php?id=' + rid && opened[0][1] === '_blank', JSON.stringify(opened));
        ok = await pick(tr, 'repoCopyLink');
        await sleep(50);
        var want2 = new URL('index.php?id=' + rid, location.href).href;
        t('R-link', ok && clip[clip.length - 1] === want2, clip[clip.length - 1] + ' want ' + want2);
        ok = await pick(tr, 'repoCopyId');
        await sleep(50);
        t('R-id', ok && clip[clip.length - 1] === rid, clip[clip.length - 1]);
        ok = await pick(tr, 'repoFav');
        await sleep(100);
        tr = row(0);
        var starred = !!tr.querySelector('.favorite-icon.is-favorite');
        rclick(tr);
        t('R-fav', ok && starred && !!item('repoFav') && /Remove from favorites/.test(item('repoFav').textContent), 'starred ' + starred + ' | ' + (item('repoFav') ? item('repoFav').textContent : 'none'));
        close();
        if (starred) { $(tr.querySelector('.favorite-icon')).trigger('click'); await sleep(50); }
        // a global admin: Metrics
        // (menufix2) a global admin: the owner, the Tags and Grants tools, Manage mode - none for anyone else
        var ADM = ['repoOwner', 'repoTagsAdmin', 'repoGrants', 'repoManage'];
        rclick(row(1)); var va = acts(); var noAdmin = ADM.every(function (x) { return va.indexOf(x) < 0; }); close();
        penumbra_vars.isGlobalAdmin = true;
        rclick(row(1));
        var aa = acts(), adminHas = ADM.every(function (x) { return aa.indexOf(x) >= 0; });
        close();
        penumbra_vars.isGlobalAdmin = false;
        t('R-admin', noAdmin && adminHas, 'viewer ' + va.join() + ' | admin ' + aa.join());
        // a deleted report's row
        var dr = row(2);
        dr.classList.add('sr-row-deleted');
        rclick(dr);
        t('R-deleted', acts().join() === 'repoCopyId,repoColumns', acts().join());
        close();
        dr.classList.remove('sr-row-deleted');
        // Shift: the browser's own menu
        pv = rclick(row(3), { shift: true });
        t('R-shift', !pv && !menu(), 'prevented ' + pv + ' menu ' + !!menu());
        close();
        // the keyboard: under the row, the first item focused
        var r3 = row(3);
        r3.focus();
        pv = rclick(r3, { kbd: true });
        var m = menu(), mr = m ? m.getBoundingClientRect() : null, rr = r3.getBoundingClientRect();
        t('R-kbd', pv && !!mr && (Math.abs(mr.top - rr.bottom) <= 3 || (mr.top < rr.bottom && mr.bottom <= window.innerHeight - 2 && mr.bottom > rr.top)) && document.activeElement === item('repoOpen'),   // (menufix2: a long menu is lifted to stay on screen)
            mr ? ('menu ' + Math.round(mr.top) + ' row bottom ' + Math.round(rr.bottom) + ' focus ' + (document.activeElement && document.activeElement.getAttribute('data-act'))) : 'no menu');
        close();
        // (menufix4) a tag pill: its reports, its name; no row menu, no browser menu
        var pill = row(0).querySelector('.repo-tag-pill');
        var tp = pill ? rclick(pill) : false, ta = acts(), tn = name();
        var ts = item('tagShow'); if (ts) { ts.click(); await sleep(300); }
        var fi = document.getElementById('reportFilterInput');
        t('T-tag', !!pill && tp && tn === 'ALPHA' && ta[0] === 'tagShow' && ta[1] === 'tagCopy' && ta.indexOf('repoOpen') < 0 && ta.indexOf('clearPrefs') < 0 && !!fi && fi.value === 'tag:ALPHA',
          ta.join() + ' | ' + tn + ' | filter ' + (fi ? fi.value : null));
        close();
        if (fi) { fi.value = ''; $(fi).trigger('keyup'); await waitFor(function () { return domIds().length === 12; }, 4000); }
        // (menufix4) Manage mode: its bar's menu (the bar's own buttons, Turn off Manage mode), a row's Select this report
        penumbra_vars.isGlobalAdmin = true;
        rclick(head('TITLE')); var mmi = item('repoManage'); if (mmi) { mmi.click(); await sleep(300); }
        var r0 = row(0), bx = r0 ? r0.querySelector('.repo-sel') : null;
        rclick(r0); var ra = acts(), rs = item('repoSel');
        if (rs) { rs.click(); await sleep(200); }
        t('B-sel', ra[0] === 'repoSel' && !!bx && bx.checked, ra.join() + ' | checked ' + (bx && bx.checked));
        close();
        var bar = document.getElementById('srBulkBar');
        var bp = bar ? rclick(bar) : false, ba = acts(), dl = item('repoBulkDelete');
        t('B-bar', bp && name() === 'Manage mode' && ba.indexOf('repoBulkClear') === 0 && !!dl && dl.getAttribute('aria-disabled') !== 'true' && ba.indexOf('repoManage') > 0 && ba.indexOf('repoColumns') > ba.indexOf('repoManage') && ba.indexOf('clearPrefs') < 0,
          ba.join() + ' | delete ' + (dl ? dl.getAttribute('aria-disabled') : null));
        var to = item('repoManage'); if (to) { to.click(); await sleep(300); }
        t('B-off', !!to && !head('SEL'), 'manage still on ' + !!head('SEL'));
        close();
        penumbra_vars.isGlobalAdmin = false;
        rclick(row(2)); var na = acts(); close();
        t('N-noClear', na.length > 3 && na.indexOf('clearPrefs') < 0, na.join());
        // (menufix2) the details panel: the selected report's menu, the row's own; its tools where they apply
        var vh = [];
        window.Penumbra = window.Penumbra || {};
        var vhKeep = window.Penumbra.openVersionHistory;
        window.Penumbra.openVersionHistory = function (a, id, title) { vh.push(id + '|' + title); };
        $(row(1)).trigger('click');
        await sleep(200);
        var pane = document.getElementById('serverReportDetailsPane');
        rclick(row(1)); var rowActs = acts(); close();
        var pp = pane ? rclick(pane, { target: pane.querySelector('h3, h2, div') || pane }) : false, pa = acts(), pn = name();
        t('P-pane', pp && pa.join() === rowActs.join() && pn === row(1).getAttribute('data-title') + ' (' + row(1).getAttribute('data-report-id') + ')', pa.join() + ' | ' + pn + ' | row ' + rowActs.join());
        var hi = item('repoHistory'); if (hi) { hi.click(); await sleep(100); }
        t('P-tools', pa.indexOf('repoHistory') >= 0 && pa.indexOf('repoSnaps') >= 0 && vh.length === 1 && vh[0] === row(1).getAttribute('data-report-id') + '|' + row(1).getAttribute('data-title')
            && pa.indexOf('repoSnaps') > pa.indexOf('repoMetrics'), pa.join() + ' | ' + vh.join());
        window.Penumbra.openVersionHistory = vhKeep;
        close();
        rclick(row(0)); var r0 = acts(); close();
        t('P-snapGate', r0.indexOf('repoSnaps') < 0 && pa.indexOf('repoSnaps') >= 0, r0.join());
        // Columns: the list's columns, ticked as they show; a pick hides one (the list redrawn without it)
        rclick(head('TITLE'));
        var ci = item('repoColumns'); if (ci) { ci.click(); await sleep(150); }
        var subs = Array.prototype.map.call(document.querySelectorAll('.pnb-hm-sub .pnb-hm-item'), function (e) { return e.getAttribute('data-act') + ':' + e.getAttribute('aria-checked'); });
        var tg = document.querySelector('.pnb-hm-sub [data-act="repoCol-TAGS"]'), had = !!head('TAGS');
        if (tg) { tg.click(); await sleep(250); }
        t('C-columns', subs.indexOf('repoCol-TAGS:true') >= 0 && subs.indexOf('repoCol-OWNER_ID:false') >= 0 && subs[subs.length - 1].indexOf('repoCols:') === 0 && had && !head('TAGS'), subs.join() + ' | tags gone ' + (had && !head('TAGS')));
        close();
        rclick(head('TITLE')); ci = item('repoColumns'); if (ci) { ci.click(); await sleep(150); }
        tg = document.querySelector('.pnb-hm-sub [data-act="repoCol-TAGS"]'); if (tg) { tg.click(); await sleep(250); }
        close();
        // Manage mode: a global admin's, ticked as it is; a pick turns it on (the selection column shows)
        penumbra_vars.isGlobalAdmin = true;
        rclick(head('TITLE'));
        var mi = item('repoManage'), mOff = !!mi && mi.getAttribute('aria-checked') === 'false';
        if (mi) { mi.click(); await sleep(300); }
        var on1 = !!head('SEL');
        rclick(head('TITLE')); mi = item('repoManage'); var mOn = !!mi && mi.getAttribute('aria-checked') === 'true'; if (mi) { mi.click(); await sleep(300); }
        penumbra_vars.isGlobalAdmin = false;
        t('M-manage', mOff && on1 && mOn && !head('SEL'), 'off ' + mOff + ' on ' + on1 + ' ticked ' + mOn + ' after ' + !!head('SEL'));
        close();
        // the engine rolled back: a heading opens List options, a row keeps the browser's menu
        var keep = window.Penumbra && window.Penumbra.colMenu;
        if (window.Penumbra) { window.Penumbra.colMenu = undefined; }
        try {
            closeChooser();
            var hp = rclick(head('TITLE'));
            await sleep(150);
            var ch = chooserOpen();
            closeChooser();
            var rp = rclick(row(4));
            t('R-off', hp && ch && !rp && !menu(), 'heading prevented ' + hp + ' chooser ' + ch + ' row prevented ' + rp);
        } finally { if (window.Penumbra) { window.Penumbra.colMenu = keep; } }
    }

    window.RM = {
        start: function () {
            run().catch(function (e) { window.__ERR.push('driver: ' + (e && e.stack || e)); }).then(function () {
                setTimeout(function () {
                    t('E-errors', window.__ERR.length === 0, window.__ERR.slice(0, 5).join(' || '));
                    window.__RMRESULT = { asserts: asserts };
                    window.__RMDONE = true;
                }, 100);
            });
        }
    };
})();
