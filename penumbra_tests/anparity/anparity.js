/*
 * penumbra_tests/anparity/anparity.js - parity check for the metrics pages
 * (analytics.php / analytics_all.php), written 2026-10-01 for step 2 of folding
 * report metrics into Platform Metrics: every refactor increment must leave
 * every number on both pages exactly where it was.
 *
 * Runs IN A SIGNED-IN ADMIN BROWSER TAB on www3 (the pages need IIS, Oracle and
 * SSO). It fetch()es each page (DOMParser, so no page script runs: no beacon,
 * no audit row), and reduces it to FACTS - every number the page shows, keyed:
 *   kpi:<label>      value | sub-line            spark:<i>   a card's series
 *   js:<name>#<n>    the JSON each chart is fed  (const NAME = ...; lines)
 *   table:<i>:<head> every row, cells joined     h3:<i>      panel headings
 *   chips / tabs / ctx / empty:<i> / form:<id>   (the filter state echoed)
 * Nothing time-stamped is read (titles are skipped), so a re-render of the same
 * data gives the same facts.
 *
 * USE (from the Chrome MCP javascript_tool, the file sent as base64 because
 * the tool refuses source containing "="):
 *   eval(atob('<base64 of this file>'));          // defines window.pnbAP
 *   pnbAP.start('B1', pnbAP.cases())               // async; poll pnbAP.status
 *   pnbAP.start('B2', pnbAP.cases())               // run it twice: volatile keys
 *   pnbAP.compare('B1', 'B2')                      // -> volatile set
 *   ... swap the increment in ...
 *   pnbAP.start('A1', pnbAP.cases())
 *   pnbAP.compare('B2', 'A1')                      // must be 0 non-volatile diffs
 *   pnbAP.restore()                                // Platform's saved filters back
 * Platform cases carry filter_submitted=1 and a full state, so they never
 * depend on the saved-filter cookie - but each one REWRITES that cookie (the
 * page saves what it shows). pnbAP.start() reads the saved state first and
 * pnbAP.restore() puts it back. Never include a Platform case whose Report
 * filter matches exactly one report: that one redirects (by design).
 */
(function () {
    var BASE = 'https://www3.acs.ncsu.edu/sponsor_migration/penumbra/';
    var AP = { store: {}, status: 'idle', saved: null };

    function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

    function factsOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html');
        var f = {};
        Array.prototype.forEach.call(d.querySelectorAll('.kpi'), function (k) {
            var l = k.querySelector('.l'), v = k.querySelector('.v'), s = k.querySelector('.s') || k.querySelector('.d');
            if (l && v) f['kpi:' + norm(l.textContent)] = norm(v.textContent) + ' | ' + (s ? norm(s.textContent) : '');
        });
        Array.prototype.forEach.call(d.querySelectorAll('canvas[data-spark]'), function (c, i) {
            f['spark:' + i] = c.getAttribute('data-spark');
        });
        var re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([\[{"'].*?);\s*$/gm, m, seen = {};
        while ((m = re.exec(html)) !== null) {
            seen[m[1]] = (seen[m[1]] || 0) + 1;
            f['js:' + m[1] + '#' + seen[m[1]]] = m[2];
        }
        Array.prototype.forEach.call(d.querySelectorAll('table.dt'), function (t, i) {
            var box = t.closest('.panel, .card, section') || t.parentNode;
            var h = box ? box.querySelector('h3') : null;
            var head = h ? norm((h.childNodes[0] || {}).textContent || h.textContent).slice(0, 40) : '';
            f['table:' + i + ':' + head] = Array.prototype.map.call(t.querySelectorAll('tbody tr'), function (r) {
                return Array.prototype.map.call(r.cells, function (c) { return norm(c.textContent); }).join(' ¦ ');
            }).join('\n');
        });
        Array.prototype.forEach.call(d.querySelectorAll('h3'), function (h, i) { f['h3:' + i] = norm(h.textContent); });
        Array.prototype.forEach.call(d.querySelectorAll('.empty'), function (e, i) { f['empty:' + i] = norm(e.textContent); });
        // Since increment 4 (shared panel-body renderers, 2026-10-01) the MARKUP
        // counts too, not just the numbers: every data table's rows as
        // whitespace-normalised HTML (attributes included - a filter button's
        // data-value is behaviour), the screen-reader tables behind the charts,
        // and the empty-state texts.
        Array.prototype.forEach.call(d.querySelectorAll('table.dt tbody'), function (tb, i) {
            f['dthtml:' + i] = norm(tb.innerHTML).replace(/>\s+</g, '><');
        });
        Array.prototype.forEach.call(d.querySelectorAll('.sr-only table'), function (t, i) {
            f['sr:' + i] = norm(t.innerHTML).replace(/>\s+</g, '><');
        });
        Array.prototype.forEach.call(d.querySelectorAll('.chart-empty, tr.empty-row'), function (e, i) { f['cempty:' + i] = norm(e.textContent); });
        f.chips = Array.prototype.map.call(d.querySelectorAll('.filter-bar .chip'), function (c) { return norm(c.textContent); }).join(' / ');
        f.tabs = Array.prototype.map.call(d.querySelectorAll('.tab-btn'), function (b) { return norm(b.textContent); }).join(' / ');
        var ctx = d.querySelector('.ctx');
        if (ctx) f.ctx = norm(ctx.textContent);
        Array.prototype.forEach.call(d.querySelectorAll('.sidebar input[id], .sidebar select[id]'), function (el) {
            f['form:' + el.id] = (el.type === 'checkbox') ? String(el.hasAttribute('checked')) : String(el.getAttribute('value') || (el.tagName === 'SELECT' ? (el.querySelector('option[selected]') || {}).value : '') || '');
        });
        return f;
    }

    AP.cases = function () {
        var ids = ['int-col-mat', 'rj0qa05h', 'iacucred', 'nwde', '__HOME__', 'rpt'];
        var rep = ['', 'range=custom&from=2026-08-01&to=2026-08-31',
            'filter_submitted=1&range=custom&from=2026-08-01&to=2026-08-31&cmp=1&cfrom=2026-07-01&cto=2026-07-31',
            'range=all', 'range=90&excl_admins=1', 'range=custom&from=2026-09-01&to=2026-09-30&dow=TUE&hour=10',
            'range=custom&from=2026-09-01&to=2026-09-30&ouc=06', 'range=24h', 'noadm&range=all'];
        var out = [];
        ids.forEach(function (id) { rep.forEach(function (q) { out.push('analytics.php?id=' + encodeURIComponent(id) + (q ? '&' + q : '')); }); });
        // Every Platform case names ALL FOUR date boxes: a box left out is filled
        // from the saved-filter cookie, which the previous Platform case just
        // rewrote - the first self-test (B1 vs B2, 2026-10-01) showed exactly
        // those remembered dates differing between two runs of one build.
        var fs = 'analytics_all.php?filter_submitted=1&';
        var rem = '&from=2026-01-05&to=2026-01-09&cfrom=2025-12-01&cto=2025-12-05';
        var remC = '&cfrom=2025-12-01&cto=2025-12-05';
        ['range=30&actions_preset=all' + rem,
         'range=custom&from=2026-08-01&to=2026-08-31&actions_preset=all' + remC,
         'range=custom&from=2026-08-01&to=2026-08-31&cmp=1&cfrom=2026-07-01&cto=2026-07-31&actions_preset=view&excl_admins=1&excl_automation=1',
         'range=all&actions_preset=errors' + rem,
         'range=90&user=mrgrady&actions_preset=all' + rem,
         'range=custom&from=2026-09-01&to=2026-09-30&ouc=06&actions_preset=change' + remC,
         'range=custom&from=2026-09-01&to=2026-09-30&report=IACUC&actions_preset=all' + remC,
         'range=24h&excl_automation=1&actions_preset=deliver' + rem
        ].forEach(function (q) { out.push(fs + q); });
        return out;
    };

    AP.readSaved = function () {
        return fetch(BASE + 'analytics_all.php', { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
            var d = new DOMParser().parseFromString(html, 'text/html');
            var form = d.querySelector('form.console-shell');
            var keep = ['range', 'from', 'to', 'cmp', 'cfrom', 'cto', 'actions_preset', 'excl_admins', 'excl_automation'];
            var p = new URLSearchParams();
            p.set('filter_submitted', '1');
            if (form) Array.prototype.forEach.call(form.elements, function (el) {
                if (!el.name || keep.indexOf(el.name) < 0) return;
                if (el.type === 'checkbox') { if (el.hasAttribute('checked')) p.set(el.name, el.value || '1'); return; }
                if (el.tagName === 'SELECT') { var o = el.querySelector('option[selected]'); if (o) p.set(el.name, o.value); return; }
                // The date boxes go back BLANK when they were blank: every Platform
                // case remembers its own dates, and a restore that left them out
                // kept the last case's (2026-10-01, E2b).
                if (el.getAttribute('value')) p.set(el.name, el.getAttribute('value'));
                else if (['from', 'to', 'cfrom', 'cto'].indexOf(el.name) >= 0) p.set(el.name, '');
            });
            AP.saved = 'analytics_all.php?' + p.toString();
            return AP.saved;
        });
    };
    AP.restore = function () {
        if (!AP.saved) return Promise.resolve('nothing saved');
        return fetch(BASE + AP.saved, { credentials: 'same-origin' }).then(function (r) { return 'restored ' + r.status; });
    };

    AP.start = function (label, urls, conc) {
        conc = conc || 2;
        var res = {}, i = 0, done = 0, t0 = Date.now();
        AP.store[label] = res;
        AP.status = label + ' 0/' + urls.length;
        function one() {
            if (i >= urls.length) return Promise.resolve();
            var u = urls[i++];
            return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow' }).then(function (r) {
                return r.text().then(function (t) { res[u] = { status: r.status, finalUrl: r.url.replace(BASE, ''), facts: factsOf(t), bytes: t.length }; });
            }).catch(function (e) { res[u] = { status: 'ERR ' + e, facts: {} }; }).then(function () {
                done++;
                AP.status = label + ' ' + done + '/' + urls.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's';
                return one();
            });
        }
        var pre = AP.saved ? Promise.resolve() : AP.readSaved();
        AP.running = pre.then(function () {
            var w = [];
            for (var k = 0; k < conc; k++) w.push(one());
            return Promise.all(w);
        }).then(function () { AP.status = label + ' DONE ' + done + '/' + urls.length + ' in ' + Math.round((Date.now() - t0) / 1000) + 's'; });
        return AP.status;
    };

    AP.compare = function (a, b, ignore) {
        var A = AP.store[a], B = AP.store[b], ig = ignore || {}, diffs = [], keys = 0, pages = 0, statusDiff = [];
        Object.keys(A || {}).forEach(function (u) {
            if (!B || !B[u]) { diffs.push({ u: u, k: '(page missing in ' + b + ')' }); return; }
            pages++;
            if (A[u].status !== B[u].status || A[u].finalUrl !== B[u].finalUrl) statusDiff.push(u + ' ' + A[u].status + '/' + B[u].status);
            var fa = A[u].facts, fb = B[u].facts, all = {};
            Object.keys(fa).concat(Object.keys(fb)).forEach(function (k) { all[k] = 1; });
            Object.keys(all).forEach(function (k) {
                keys++;
                if (fa[k] === fb[k] || ig[u + '\u0001' + k]) return;
                diffs.push({ u: u, k: k, a: String(fa[k]).slice(0, 160), b: String(fb[k]).slice(0, 160) });
            });
        });
        return { pages: pages, keys: keys, diffs: diffs, statusDiff: statusDiff };
    };
    // Keys that differ between two runs of the SAME build: live data moving.
    AP.volatile = function (a, b) {
        var ig = {};
        AP.compare(a, b).diffs.forEach(function (d) { ig[d.u + '\u0001' + d.k] = 1; });
        return ig;
    };
    AP.factsOf = factsOf;
    window.pnbAP = AP;
})();
