/*
 * anparity cards (2026-10-01, the one engine E2b): the engine's report scope
 * (analytics.php?id=...&engine=1) must show EXACTLY the report page's card set.
 * For each report case it renders the report page, the engine with the same
 * address, and the report page again, back to back (data can move between the
 * renders; the engine passes when it equals either), and compares per card:
 * label (and the order of the cards), value, sub-line, the spark series, the
 * spark's title (window + bucket) and the warning state. Click targets differ
 * BY DESIGN (re-pointed at the engine's surfaces) and are checked on their
 * own: the engine never carries a report-page anchor (#panel-...) or a feed
 * chip (feed:...) it cannot honour, and every target it does carry exists on
 * the engine page. Needs anparity.js (pnbAP.cases) loaded first.
 *
 *   pnbAP.cards('K1', pnbAP.cardCases())        // poll pnbAP.status
 *   pnbAP.cardsStore.K1                         // { pass, fail[], retried, cards, targets }
 *   pnbAP.cards('K0', urls, 'zzeng7new_')       // BEFORE a swap: the engine through a
 *       TEMP report page whose engine include points at a temp engine copy
 * cardCases() = the report cases of pnbAP.cases() plus, per report, a user
 * filter, "Hide my own views", and all three toggles with a department.
 */
(function () {
    var AP = window.pnbAP;
    var BASE = 'https://www3.acs.ncsu.edu/sponsor_migration/penumbra/';
    function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
    function cardsOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html'), f = {}, order = [], targets = [], bad = [];
        Array.prototype.forEach.call(d.querySelectorAll('.kpi'), function (k) {
            var l = k.querySelector('.l'), v = k.querySelector('.v'), s = k.querySelector('.s') || k.querySelector('.d');
            var c = k.querySelector('canvas[data-spark]'), sp = k.querySelector('.spark');
            if (!l || !v) return;
            var lab = norm(l.textContent);
            order.push(lab);
            f['card:' + lab] = [norm(v.textContent), s ? norm(s.textContent) : '', c ? c.getAttribute('data-spark') : '-',
                                sp ? norm(sp.getAttribute('title')) : '-', k.classList.contains('warn') ? 'warn' : ''].join(' | ');
            var go = k.getAttribute('data-go');
            if (go !== null) {
                targets.push(go);
                // a feed chip is a target only where the engine has the feed (E3b-2's Activity tab)
                if (/^#panel-/.test(go) || (/^feed:/.test(go) && !d.getElementById('card-feed'))
                    || (go.charAt(0) === '#' && !d.getElementById(go.slice(1)))) bad.push(lab + ' -> ' + go);
            }
        });
        f['#order'] = order.join(' / ');
        return { facts: f, targets: targets, bad: bad };
    }
    function grab(u) {
        return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
            return r.text().then(function (t) { var c = cardsOf(t); c.status = r.status; return c; });
        }).catch(function (e) { return { status: 'ERR ' + e, facts: {}, targets: [], bad: [] }; });
    }
    function diff(a, b) {
        var all = {}, out = [];
        Object.keys(a.facts).concat(Object.keys(b.facts)).forEach(function (k) { all[k] = 1; });
        Object.keys(all).forEach(function (k) { if (a.facts[k] !== b.facts[k]) out.push(k); });
        return out;
    }
    // A render that did not arrive, or a 200 with no cards, never passes; a
    // refusal (403 for a plain viewer on a placeholder) passes only when both
    // pages refuse alike.
    function real(x) { return typeof x.status === 'number' && (x.status !== 200 || Object.keys(x.facts).length > 1); }
    // ---- PEOPLE (E3b-1): the engine's Users tab vs the report page ------------
    // The user's call: the engine keeps its Top Users table (+ a per-viewer
    // trend spark) where the page has Top viewers, and shows the page's Top
    // IPs under it. So: Top IPs rows must be the same rows (any order - ties in
    // HITS have no defined order between two queries); every Top viewer must
    // appear in the engine's table with the same views and the same spark
    // (unless the engine's list is at its cap), and anyone the engine lists who
    // is not a viewer must show 0 views.
    function peopleOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html'), v = {}, ips = [], vRows = 0, engine = !!d.getElementById('card-users');
        function cells(tr) { return Array.prototype.map.call(tr.cells, function (c) { return c; }); }
        if (engine) {
            Array.prototype.forEach.call(d.querySelectorAll('#card-users table.dt tbody tr'), function (tr) {
                var c = cells(tr); if (c.length < 6) return; vRows++;
                var cv = c[4].querySelector('canvas');
                v[norm(c[0].textContent)] = norm(c[2].textContent) + ' | ' + (cv ? cv.getAttribute('data-spark') : '-');
            });
            Array.prototype.forEach.call(d.querySelectorAll('#card-ips table.dt tbody tr'), function (tr) {
                var c = cells(tr); if (c.length === 4) ips.push(c.map(function (x) { return norm(x.textContent); }).join(' | '));
            });
        } else {
            Array.prototype.forEach.call(d.querySelectorAll('section.panel'), function (sec) {
                var h = sec.querySelector('h3'); if (!h) return;
                var title = norm(h.textContent);
                Array.prototype.forEach.call(sec.querySelectorAll('table.dt tbody tr:not(.empty-row)'), function (tr) {
                    var c = cells(tr);
                    if (title.indexOf('Top viewers') === 0 && c.length === 5) { vRows++; var cv = c[3].querySelector('canvas'); v[norm(c[0].textContent)] = norm(c[2].textContent) + ' | ' + (cv ? cv.getAttribute('data-spark') : '-'); }
                    if (title.indexOf('Top IPs') === 0 && c.length === 4) ips.push(c.map(function (x) { return norm(x.textContent); }).join(' | '));
                });
            });
        }
        ips.sort();
        return { viewers: v, rows: vRows, ips: ips };
    }
    function grabP(u) {
        return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
            return r.text().then(function (t) { var p = peopleOf(t); p.status = r.status; return p; });
        }).catch(function (e) { return { status: 'ERR ' + e, viewers: {}, rows: 0, ips: [] }; });
    }
    function peopleDiff(P, E, cap) {
        var out = [];
        if (P.ips.join('\n') !== E.ips.join('\n')) out.push('ips: page ' + P.ips.length + ' rows, engine ' + E.ips.length + ' (first page ' + (P.ips[0] || '-') + ' / engine ' + (E.ips[0] || '-') + ')');
        Object.keys(P.viewers).forEach(function (u) {
            if (!(u in E.viewers)) { if (E.rows < cap) out.push('viewer ' + u + ' missing from the engine'); return; }
            if (P.viewers[u] !== E.viewers[u]) out.push('viewer ' + u + ': page ' + P.viewers[u].slice(0, 80) + ' / engine ' + E.viewers[u].slice(0, 80));
        });
        Object.keys(E.viewers).forEach(function (u) {
            if (!(u in P.viewers) && E.viewers[u].split(' | ')[0] !== '0') out.push('engine lists ' + u + ' with views ' + E.viewers[u].split(' | ')[0] + ' - not a viewer on the page');
        });
        return out;
    }
    AP.people = function (label, urls, enginePrefix, tries, cap) {
        tries = tries || 4; enginePrefix = enginePrefix || ''; cap = cap || 100;
        urls = urls.filter(function (u) { return u.indexOf('analytics.php?') === 0; });
        var res = { pass: 0, fail: [], retried: 0, viewers: 0, ips: 0 }, i = 0, t0 = Date.now();
        AP.peopleStore = AP.peopleStore || {};
        AP.peopleStore[label] = res;
        AP.status = label + ' 0/' + urls.length;
        function oneCase(u, attempt) {
            return grabP(u).then(function (L1) {
                return grabP(enginePrefix + u + '&engine' + String.fromCharCode(61) + '1').then(function (E) {
                    return grabP(u).then(function (L2) {
                        var ok = function (L) { return typeof L.status === 'number' && L.status === E.status; };
                        var d1 = peopleDiff(L1, E, cap), d2 = peopleDiff(L2, E, cap);
                        if (typeof E.status === 'number' && ((ok(L1) && !d1.length) || (ok(L2) && !d2.length))) {
                            res.pass++; res.viewers += Object.keys(L1.viewers).length; res.ips += L1.ips.length; if (attempt) res.retried++;
                            return;
                        }
                        if (attempt + 1 < tries) return oneCase(u, attempt + 1);
                        res.fail.push({ i: urls.indexOf(u), status: [L1.status, E.status, L2.status], d1: d1.slice(0, 4) });
                    });
                });
            });
        }
        AP.running = (function next() {
            if (i >= urls.length) {
                AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail, ' + res.retried + ' retried, ' + res.viewers + ' viewers, ' + res.ips + ' ip rows, ' + Math.round((Date.now() - t0) / 1000) + 's';
                return Promise.resolve();
            }
            var u = urls[i++];
            return oneCase(u, 0).then(function () { AP.status = label + ' ' + i + '/' + urls.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; return next(); });
        })();
        return AP.status;
    };

    // ---- FEED (E3b-2): the engine's Activity tab vs the report page's feed -----
    // Same rows (time, user, action, detail, family), same chips (label +
    // count, in order), same fetch-more state; a plain viewer sees it
    // restricted on both. The feed is the report's NEWEST rows, so it moves
    // whenever anyone opens the report - the three back-to-back renders and the
    // retries absorb that.
    function feedOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html'), rows = [], chips = [];
        Array.prototype.forEach.call(d.querySelectorAll('#feedTable tbody tr:not(.empty-row)'), function (tr) {
            rows.push(Array.prototype.map.call(tr.cells, function (c) { return norm(c.textContent); }).join(' | ') + ' | ' + tr.getAttribute('data-fam'));
        });
        Array.prototype.forEach.call(d.querySelectorAll('.feed-chip'), function (c) { chips.push(c.getAttribute('data-fam') + '=' + norm(c.textContent)); });
        var restricted = !d.getElementById('feedTable') && !d.querySelector('.feed-chips');
        var m = html.match(/const FEED_MORE\s*=\s*(true|false)/);
        return { rows: rows, chips: chips.join(' / '), restricted: restricted, more: m ? m[1] : '?' };
    }
    function grabF(u) {
        return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
            return r.text().then(function (t) { var f = feedOf(t); f.status = r.status; return f; });
        }).catch(function (e) { return { status: 'ERR ' + e, rows: [], chips: '', restricted: true, more: '?' }; });
    }
    function feedDiff(P, E) {
        var out = [];
        if (P.restricted !== E.restricted) out.push('restricted: page ' + P.restricted + ' / engine ' + E.restricted);
        if (P.chips !== E.chips) out.push('chips: page ' + P.chips + ' / engine ' + E.chips);
        if (P.more !== E.more) out.push('fetch-more: page ' + P.more + ' / engine ' + E.more);
        if (P.rows.join('\n') !== E.rows.join('\n')) {
            var k = 0; while (k < P.rows.length && P.rows[k] === E.rows[k]) k++;
            out.push('rows: page ' + P.rows.length + ', engine ' + E.rows.length + '; first difference at ' + k + ': ' + String(P.rows[k]).slice(0, 120) + ' / ' + String(E.rows[k]).slice(0, 120));
        }
        return out;
    }
    AP.feed = function (label, urls, enginePrefix, tries) {
        tries = tries || 4; enginePrefix = enginePrefix || '';
        urls = urls.filter(function (u) { return u.indexOf('analytics.php?') === 0; });
        var res = { pass: 0, fail: [], retried: 0, rows: 0 }, i = 0, t0 = Date.now();
        AP.feedStore = AP.feedStore || {};
        AP.feedStore[label] = res;
        AP.status = label + ' 0/' + urls.length;
        function oneCase(u, attempt) {
            return grabF(u).then(function (L1) {
                return grabF(enginePrefix + u + '&engine' + String.fromCharCode(61) + '1').then(function (E) {
                    return grabF(u).then(function (L2) {
                        var ok = function (L) { return typeof L.status === 'number' && L.status === E.status; };
                        var d1 = feedDiff(L1, E), d2 = feedDiff(L2, E);
                        if (typeof E.status === 'number' && ((ok(L1) && !d1.length) || (ok(L2) && !d2.length))) {
                            res.pass++; res.rows += E.rows.length; if (attempt) res.retried++;
                            return;
                        }
                        if (attempt + 1 < tries) return oneCase(u, attempt + 1);
                        res.fail.push({ i: urls.indexOf(u), status: [L1.status, E.status, L2.status], d1: d1.slice(0, 4) });
                    });
                });
            });
        }
        AP.running = (function next() {
            if (i >= urls.length) {
                AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail, ' + res.retried + ' retried, ' + res.rows + ' rows, ' + Math.round((Date.now() - t0) / 1000) + 's';
                return Promise.resolve();
            }
            var u = urls[i++];
            return oneCase(u, 0).then(function () { AP.status = label + ' ' + i + '/' + urls.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; return next(); });
        })();
        return AP.status;
    };

    // ---- CHROME (E4b): the report page's theme route, info strip, auto-refresh --
    // Per report case: the engine's strip (owner, created, last modified,
    // authorized, subscribers, editors) reads exactly like the page's; opened
    // from the report it carries the page's saved default theme and no family
    // script, and with platform=1 the family script and no report default; the
    // refresh toggle and the live dot are there.
    function chromeOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html'), meta = {};
        Array.prototype.forEach.call(d.querySelectorAll('.ctx .meta, .an-ctx-meta .meta'), function (m) {
            var t = norm(m.textContent), k = t.split(':')[0];
            meta[k] = t;
        });
        var th = html.match(/window\.PNB_REPORT_DEFAULT_THEME\s*=\s*("(?:[^"\\]|\\.)*")/);
        // The family script DEFINES window.pnbApplyTheme; the admin bar's settings
        // panel only calls it (if defined) - so look for the definition.
        return { meta: meta, theme: th ? th[1] : null, family: html.indexOf('window.pnbApplyTheme = function') >= 0,
                 toggle: !!d.getElementById('anRefreshToggle'), dot: !!d.getElementById('anLiveDot') };
    }
    function grabC(u) {
        return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
            return r.text().then(function (t) { var c = chromeOf(t); c.status = r.status; return c; });
        }).catch(function (e) { return { status: 'ERR ' + e, meta: {}, theme: null, family: false, toggle: false, dot: false }; });
    }
    AP.chrome = function (label, urls, enginePrefix) {
        enginePrefix = enginePrefix || '';
        urls = urls.filter(function (u) { return u.indexOf('analytics.php?') === 0 && u.indexOf('platform') < 0; });
        var res = { pass: 0, fail: [], metas: 0 }, i = 0, t0 = Date.now(), eq = String.fromCharCode(61);
        AP.chromeStore = AP.chromeStore || {};
        AP.chromeStore[label] = res;
        AP.status = label + ' 0/' + urls.length;
        function oneCase(u) {
            return grabC(u).then(function (P) {
                return grabC(enginePrefix + u + '&engine' + eq + '1').then(function (E) {
                    return grabC(enginePrefix + u + '&engine' + eq + '1&platform' + eq + '1').then(function (F) {
                        var bad = [];
                        if (P.status !== E.status) bad.push('status ' + P.status + '/' + E.status);
                        if (P.status === 200) {
                            if (JSON.stringify(P.meta) !== JSON.stringify(E.meta)) bad.push('strip: page ' + JSON.stringify(P.meta).slice(0, 160) + ' / engine ' + JSON.stringify(E.meta).slice(0, 160));
                            if (P.theme !== E.theme) bad.push('saved theme: page ' + P.theme + ' / engine ' + E.theme);
                            if (E.family) bad.push('the engine opened from the report ran the family theme script');
                            if (!F.family || F.theme !== null) bad.push('platform=1: family ' + F.family + ', report default ' + F.theme);
                            if (!E.toggle || !E.dot) bad.push('refresh toggle ' + E.toggle + ', live dot ' + E.dot);
                        }
                        if (!bad.length) { res.pass++; res.metas += Object.keys(E.meta).length; return; }
                        res.fail.push({ i: urls.indexOf(u), bad: bad.slice(0, 4) });
                    });
                });
            });
        }
        AP.running = (function next() {
            if (i >= urls.length) {
                AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail, ' + res.metas + ' strip items, ' + Math.round((Date.now() - t0) / 1000) + 's';
                return Promise.resolve();
            }
            var u = urls[i++];
            return oneCase(u).then(function () { AP.status = label + ' ' + i + '/' + urls.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; return next(); });
        })();
        return AP.status;
    };

    // ERRORS COLUMNS (E4c): at report scope the engine's Errors list has no
    // Report column (every row is the report, and there is no Report filter for
    // its button to fill) and every row has one cell per heading; at Platform
    // scope the column stays. Give it pnbAP.cases() (report AND Platform cases);
    // a case whose window has no errors has no table and proves nothing, so the
    // status counts the tables actually read (report scope / Platform).
    function errColsOf(html) {
        var d = new DOMParser().parseFromString(html, 'text/html'), t = d.querySelector('#card-errors table');
        if (!t) return null;
        var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return norm(th.textContent).split(' ')[0]; });
        var rows = t.querySelectorAll('tbody tr'), off = 0;
        Array.prototype.forEach.call(rows, function (tr) { if (tr.querySelectorAll('td').length !== heads.length) off++; });
        return { heads: heads.join('|'), rows: rows.length, off: off, rptBtns: t.querySelectorAll('[data-filter="report"]').length };
    }
    AP.errcols = function (label, urls, enginePrefix) {
        enginePrefix = enginePrefix || '';
        var eq = String.fromCharCode(61), res = { pass: 0, fail: [], repTables: 0, platTables: 0, rows: 0 }, i = 0, t0 = Date.now(), work = [];
        urls.forEach(function (u, k) {
            if (u.indexOf('analytics.php?') === 0 && u.indexOf('platform') < 0) work.push({ k: k, u: enginePrefix + u + '&engine' + eq + '1', rep: true });
            else if (u.indexOf('analytics_all.php') === 0) work.push({ k: k, u: enginePrefix + u, rep: false });
        });
        AP.errStore = AP.errStore || {};
        AP.errStore[label] = res;
        AP.status = label + ' 0/' + work.length;
        function oneCase(w) {
            return fetch(BASE + w.u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
                return r.text().then(function (t) {
                    var c = r.status === 200 ? errColsOf(t) : null, bad = [];
                    if (r.status !== 200 && !(w.rep && r.status === 403)) bad.push('status ' + r.status);
                    if (c) {
                        if (w.rep) res.repTables++; else res.platTables++;
                        res.rows += c.rows;
                        var want = w.rep ? 'Time|User|IP|Action|Detail' : 'Time|User|IP|Report|Action|Detail';
                        if (c.heads !== want) bad.push('headings ' + c.heads);
                        if (c.off) bad.push(c.off + ' rows without one cell per heading');
                        if (w.rep && c.rptBtns) bad.push(c.rptBtns + ' report filter buttons');
                    }
                    if (bad.length) res.fail.push({ i: w.k, bad: bad }); else res.pass++;
                });
            }).catch(function (e) { res.fail.push({ i: w.k, bad: ['ERR ' + e] }); });
        }
        AP.running = (function next() {
            if (i >= work.length) {
                AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail, ' + res.repTables + ' report-scope tables, '
                          + res.platTables + ' Platform tables, ' + res.rows + ' rows, ' + Math.round((Date.now() - t0) / 1000) + 's';
                return Promise.resolve();
            }
            var w = work[i++];
            return oneCase(w).then(function () { AP.status = label + ' ' + i + '/' + work.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; return next(); });
        })();
        return AP.status;
    };

    // IP cases (E4a): per report, the address filter alone over all time and
    // with Hide admin activity over 30 days - run the cards / people / feed
    // checks on them (pnbAP.cards('KI', pnbAP.ipCases(ip))). The default is
    // the address the test workstation reaches the app from.
    AP.ipCases = function (ip) {
        var eq = String.fromCharCode(61), out = [];
        ip = ip || '10.50.52.60';
        ['int-col-mat', 'rj0qa05h', 'iacucred', 'nwde', '__HOME__', 'rpt'].forEach(function (id) {
            var b = 'analytics.php?id' + eq + encodeURIComponent(id);
            out.push(b + '&range' + eq + 'all&ip' + eq + encodeURIComponent(ip));
            out.push(b + '&range' + eq + '30&excl_admins' + eq + '1&ip' + eq + encodeURIComponent(ip));
        });
        return out;
    };
    AP.cardCases = function () {
        var out = AP.cases().filter(function (u) { return u.indexOf('analytics.php?') === 0; });
        var eq = String.fromCharCode(61);
        ['int-col-mat', 'rj0qa05h', 'iacucred', 'nwde', '__HOME__', 'rpt'].forEach(function (id) {
            var b = 'analytics.php?id' + eq + encodeURIComponent(id);
            out.push(b + '&range' + eq + 'all&user' + eq + 'mrgrady');
            out.push(b + '&range' + eq + '30&excl_me' + eq + '1');
            out.push(b + '&range' + eq + 'all&excl_admins' + eq + '1&excl_me' + eq + '1&ouc' + eq + '06');
        });
        return out;
    };
    // HIDE MY OWN VIEWS ON PLATFORM (the switch, 2026-10-02): over a fixed past
    // window (live data cannot move it), Platform with excl_me=1 must equal
    // Platform minus Platform filtered to me, card by card - Report Views,
    // Dashboard Pulls, Unique Visitors (I am one or none of them), Home Visits,
    // Exports; Updates and Errors are counters the toggles never touch (by
    // design: edits are almost all by owners and admins, so Hide admin activity
    // would pin Updates at zero - the report page made the same call), and
    // Active Reports can only shrink. My row leaves the Users tab, the box shows
    // checked, and a bare visit afterwards remembers it (the cookie). Run the
    // live build first as the control: before the switch Platform ignores it.
    function kpiNums(d) {
        var out = {};
        Array.prototype.forEach.call(d.querySelectorAll('.kpi'), function (k) {
            var l = k.querySelector('.l'), v = k.querySelector('.v');
            if (l && v) out[norm(l.textContent)] = parseInt(norm(v.textContent).replace(/,/g, ''), 10);
        });
        return out;
    }
    function boxOn(d, name) { var b = d.querySelector('input[name="' + name + '"]'); return b ? b.hasAttribute('checked') : null; }
    function getDoc(u) {
        return fetch(BASE + u, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' }).then(function (r) {
            return r.text().then(function (t) { return { status: r.status, d: new DOMParser().parseFromString(t, 'text/html') }; });
        });
    }
    AP.exclMe = function (label, prefix, me) {
        prefix = prefix || ''; me = me || 'bplimon';
        var eq = String.fromCharCode(61);
        var base = 'analytics_all.php?filter_submitted' + eq + '1&range' + eq + 'custom&from' + eq + '2026-09-01&to' + eq + '2026-09-15&cfrom' + eq + '2026-08-01&cto' + eq + '2026-08-15';
        var res = { pass: 0, fail: [], nums: {} };
        AP.exclStore = AP.exclStore || {};
        AP.exclStore[label] = res;
        AP.status = label + ' running';
        function check(ok, what) { if (ok) res.pass++; else res.fail.push(what); }
        AP.running = getDoc(prefix + base).then(function (A) {
            return getDoc(prefix + base + '&user' + eq + me).then(function (U) {
                return getDoc(prefix + base + '&excl_me' + eq + '1').then(function (M) {
                    return getDoc(prefix + 'analytics_all.php').then(function (B) {
                        check(A.status === 200 && U.status === 200 && M.status === 200 && B.status === 200, 'status ' + [A.status, U.status, M.status, B.status].join('/'));
                        var a = kpiNums(A.d), u = kpiNums(U.d), m = kpiNums(M.d);
                        res.nums = { all: a, mine: u, hidden: m };
                        ['Report Views', 'Dashboard Pulls', 'Unique Visitors', 'Home Visits', 'Exports'].forEach(function (k) {
                            if (!(k in a)) return;
                            check(m[k] === a[k] - u[k], k + ': hidden ' + m[k] + ' vs all ' + a[k] + ' - mine ' + u[k]);
                        });
                        ['Updates', 'Errors'].forEach(function (k) {
                            check(k in a && m[k] === a[k], k + ': hidden ' + m[k] + ' vs all ' + a[k] + ' (never touched by the toggles)');
                        });
                        check('Active Reports' in a && m['Active Reports'] <= a['Active Reports'], 'Active Reports can only shrink: ' + m['Active Reports'] + ' vs ' + a['Active Reports']);
                        check(u['Report Views'] > 0, 'the window has views of mine to hide (' + u['Report Views'] + ') - else this proves nothing');
                        var mineRow = function (d) { return !!d.querySelector('#card-users [data-filter="user"][data-value="' + me + '"]'); };
                        check(mineRow(A.d) && !mineRow(M.d), 'my row: in the Users tab without it ' + mineRow(A.d) + ', with it ' + mineRow(M.d));
                        check(boxOn(M.d, 'excl_me') === true && boxOn(A.d, 'excl_me') === false, 'the box: checked ' + boxOn(M.d, 'excl_me') + ' with it, ' + boxOn(A.d, 'excl_me') + ' without');
                        check(boxOn(B.d, 'excl_me') === true, 'a bare visit afterwards remembers it (cookie): ' + boxOn(B.d, 'excl_me'));
                        AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail';
                    });
                });
            });
        }).catch(function (e) { res.fail.push('ERR ' + e); AP.status = label + ' DONE (error)'; });
        return AP.status;
    };

    // ROUND TRIP (the switch): Platform with all three visibility toggles on ->
    // its first report link -> that report's page (all three checked) -> its
    // crumb back up -> Platform (all three still checked). Before the switch the
    // report link dropped Hide automation, so coming back up switched Platform's
    // off - run the live build first as the control.
    AP.roundTrip = function (label, prefix) {
        prefix = prefix || '';
        var eq = String.fromCharCode(61), T = ['excl_admins', 'excl_automation', 'excl_me'];
        var plat = 'analytics_all.php?filter_submitted' + eq + '1&range' + eq + '30&excl_admins' + eq + '1&excl_automation' + eq + '1&excl_me' + eq + '1'
                 + '&from' + eq + '2026-01-05&to' + eq + '2026-01-09&cfrom' + eq + '2025-12-01&cto' + eq + '2025-12-05';
        var res = { pass: 0, fail: [], steps: [] };
        AP.tripStore = AP.tripStore || {};
        AP.tripStore[label] = res;
        AP.status = label + ' running';
        function check(ok, what) { if (ok) res.pass++; else res.fail.push(what); }
        function params(href) { var o = {}; new URL(href, BASE).searchParams.forEach(function (v, k) { o[k] = v; }); return o; }
        AP.running = getDoc(prefix + plat).then(function (P0) {
            var a = P0.d.querySelector('a.rlink');
            check(P0.status === 200 && !!a, 'Platform renders with a report link (' + P0.status + ')');
            if (!a) return;
            var down = a.getAttribute('href'), dp = params(down);
            res.steps.push('down: ' + T.map(function (k) { return k + ' ' + (dp[k] || '-'); }).join(', ') + ', platform ' + (dp.platform || '-'));
            T.forEach(function (k) { check(dp[k] === '1', 'the report link carries ' + k); });
            check(dp.platform === '1' && dp.filter_submitted === '1', 'the report link carries platform=1 and filter_submitted=1');
            return getDoc(prefix + down).then(function (R) {
                T.forEach(function (k) { check(boxOn(R.d, k) === true, 'the report page shows ' + k + ' checked (' + boxOn(R.d, k) + ')'); });
                var c = R.d.querySelector('.sidebar .crumb a');
                check(R.status === 200 && !!c, 'the report page renders its crumb (' + R.status + ')');
                if (!c) return;
                var up = c.getAttribute('href'), upp = params(up);
                res.steps.push('up: ' + T.map(function (k) { return k + ' ' + (upp[k] || '-'); }).join(', '));
                T.forEach(function (k) { check(upp[k] === '1', 'the crumb carries ' + k); });
                return getDoc(prefix + up).then(function (P1) {
                    T.forEach(function (k) { check(boxOn(P1.d, k) === true, 'back on Platform ' + k + ' is still checked (' + boxOn(P1.d, k) + ')'); });
                });
            });
        }).then(function () { AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail'; })
          .catch(function (e) { res.fail.push('ERR ' + e); AP.status = label + ' DONE (error)'; });
        return AP.status;
    };

    AP.cards = function (label, urls, enginePrefix, tries) {
        tries = tries || 4;
        enginePrefix = enginePrefix || '';
        urls = urls.filter(function (u) { return u.indexOf('analytics.php?') === 0; });
        var res = { pass: 0, fail: [], retried: 0, cards: 0, targets: 0 }, i = 0, t0 = Date.now();
        AP.cardsStore = AP.cardsStore || {};
        AP.cardsStore[label] = res;
        AP.status = label + ' 0/' + urls.length;
        function oneCase(u, attempt) {
            return grab(u).then(function (L1) {
                return grab(enginePrefix + u + '&engine' + String.fromCharCode(61) + '1').then(function (E) {
                    return grab(u).then(function (L2) {
                        var d1 = diff(L1, E), d2 = diff(L2, E);
                        if (real(E) && E.bad.length === 0 && ((real(L1) && L1.status === E.status && !d1.length) || (real(L2) && L2.status === E.status && !d2.length))) {
                            res.pass++; res.cards += Object.keys(E.facts).length - 1; res.targets += E.targets.length;
                            if (attempt) res.retried++;
                            return;
                        }
                        if (attempt + 1 < tries) return oneCase(u, attempt + 1);
                        res.fail.push({ i: urls.indexOf(u), status: [L1.status, E.status, L2.status], bad: E.bad, d1: d1.slice(0, 8),
                            sample: d1.slice(0, 3).map(function (k) { return k + ' :: ' + String(L1.facts[k]).slice(0, 160) + ' -> ' + String(E.facts[k]).slice(0, 160); }) });
                    });
                });
            });
        }
        AP.running = (function next() {
            if (i >= urls.length) {
                AP.status = label + ' DONE ' + res.pass + ' pass, ' + res.fail.length + ' fail, ' + res.retried + ' retried, '
                          + res.cards + ' cards, ' + res.targets + ' targets, ' + Math.round((Date.now() - t0) / 1000) + 's';
                return Promise.resolve();
            }
            var u = urls[i++];
            return oneCase(u, 0).then(function () {
                AP.status = label + ' ' + i + '/' + urls.length + ' ' + Math.round((Date.now() - t0) / 1000) + 's';
                return next();
            });
        })();
        return AP.status;
    };
})();
