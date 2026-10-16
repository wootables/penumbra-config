/* bulkset suite - browser half (2026-10-13). Runs in harness.html with jQuery, the
 * module under test (js/penumbra_bulkset.js) and main.js's OWN crypto helpers
 * (lifted verbatim by run.py into window.__mainCrypto) for the parity checks.
 * window.__run() resolves to [{id, ok, info}].
 */
(function () {
    'use strict';
    var R = [];
    function ok(id, cond, info) { R.push({ id: id, ok: !!cond, info: cond ? '' : String(info === undefined ? '' : (typeof info === 'string' ? info : JSON.stringify(info))).slice(0, 400) }); }
    function eq(id, a, b) { var A = JSON.stringify(a), B = JSON.stringify(b); ok(id, A === B, 'got ' + A + ' want ' + B); }
    function sortKeys(o) { var out = {}; Object.keys(o || {}).sort().forEach(function (k) { out[k] = o[k]; }); return out; }

    function fixtures() {
        var baseState = {
            query: 'SELECT * FROM NC_REPORTING.AWARDS', reportTitle: 'Awards FY26', reportSubtitle: 'By OSP',
            theme: 'theme-default', density: 'standard', rowsPerPage: '100', rowExpandDefault: false,
            resolverLinksDefault: true, sortCriteria: [{ col: 'AMT', dir: 'desc' }],
            viewOptions: { hideEmail: true, clickToFilter: true }, columnWidths: { A: 120 }, pivot: { rows: ['X'] }
        };
        return {
            baseState: baseState,
            plain: function (o) {
                return $.extend({ id: 11, short_id: 'awards26', title: 'Awards FY26', owner_id: 'jdoe', authorized: 'jdoe,Mary Smith <msmith@ncsu.edu>,06',
                    updated_at: '2026-10-13 09:00:00.123456', state_data: JSON.stringify(baseState), tags: ['CVM'], encrypted: false,
                    snaps: 0, enc_snaps: 0, tasks: 0, pw_tasks: 0 }, o || {});
            }
        };
    }
    var ctx0 = function (spec, extra) {
        return $.extend({ spec: spec, currentPassword: '', scan: { snaps: true, tasks: true },
            themeLabels: { 'theme-default': 'Default Light', 'theme-dark-blue': 'Dark Blue' }, tagHolders: { NIH: ['kwong', 'pchan (+scheduler)'] } }, extra || {});
    };

    async function run() {
        var C = window.PenumbraBulkSet && window.PenumbraBulkSet.core;
        ok('A0 module loaded with its core', !!C, 'window.PenumbraBulkSet.core missing');
        if (!C) { return R; }
        var F = fixtures();

        // ---------------- A: access list rules (mirror of report_auth.php extractAuthIdentifier)
        eq('A1 authKey: Name <ncsu email> -> unity id', C.authKey('Mary Smith <MSmith@ncsu.edu>'), 'msmith');
        eq('A2 authKey: bare ncsu email -> unity id', C.authKey('JDoe@NCSU.edu'), 'jdoe');
        eq('A3 authKey: external email kept whole', C.authKey('Pat <pat@gmail.com>'), 'pat@gmail.com');
        eq('A4 authKey: OUC / keyword lower-cased', C.authKey(' Public '), 'public');
        eq('A5 add: a name already there by another spelling is not added twice', C.applyAccess('jdoe,06', { mode: 'add', items: ['jdoe@ncsu.edu', 'kwong'] }), 'jdoe,06,kwong');
        eq('A6 remove: matches by identifier (email form removes the bare id)', C.applyAccess('jdoe,Mary Smith <msmith@ncsu.edu>,06', { mode: 'remove', items: ['msmith@ncsu.edu'] }), 'jdoe,06');
        eq('A7 replace: the typed list, de-duplicated', C.applyAccess('jdoe,06', { mode: 'replace', items: ['a1', 'A1@ncsu.edu', 'b2'] }), 'a1,b2');
        eq('A8 nothing left -> adminonly (what the server stores for an empty list)', C.applyAccess('jdoe', { mode: 'remove', items: ['jdoe'] }), 'adminonly');
        eq('A9 adding a name drops a lone adminonly', C.applyAccess('adminonly', { mode: 'add', items: ['kwong'] }), 'kwong');
        ok('A10 sameAccess ignores order and spelling', C.sameAccess('jdoe,06', '06,JDoe@ncsu.edu'));
        ok('A11 sameAccess: empty equals adminonly', C.sameAccess('', 'adminonly'));
        eq('A12 typed list splits on commas, semicolons and new lines', C.splitTypedAccess('a1, b2;c3\nMary Smith <m@ncsu.edu>'), ['a1', 'b2', 'c3', 'Mary Smith <m@ncsu.edu>']);

        // ---------------- T: tags
        eq('T1 splitTags upper-cases and de-dupes', C.splitTags('nih, Nih cvm|usda'), ['NIH', 'CVM', 'USDA']);
        eq('T2 add keeps existing, appends new', C.applyTags(['CVM'], { mode: 'add', tags: ['NIH', 'CVM'] }), ['CVM', 'NIH']);
        eq('T3 remove', C.applyTags(['CVM', 'NIH'], { mode: 'remove', tags: ['CVM'] }), ['NIH']);
        eq('T4 replace', C.applyTags(['CVM', 'NIH'], { mode: 'replace', tags: ['USDA'] }), ['USDA']);

        // ---------------- S: state edits ("absent means default")
        var s0 = F.baseState, s0copy = JSON.stringify(s0);
        var s1 = C.applyState(s0, { theme: { mode: 'set', value: 'theme-dark-blue' }, density: { mode: 'clear' }, rowsPerPage: { mode: 'set', value: 500 },
            rowExpandDefault: 'on', resolverLinksDefault: 'off', sort: 'clear' });   // resolverLinksDefault: not an edit any more (ignored)
        eq('S1 theme set', s1.theme, 'theme-dark-blue');
        ok('S2 density clear removes the key', !('density' in s1), s1.density);
        eq('S3 rows per page stored as a string', s1.rowsPerPage, '500');
        eq('S4 row height on; Deep Link Vendor Codes is not edited (per column since 10-13, a saved default is ignored)', [s1.rowExpandDefault, s1.resolverLinksDefault], [true, true]);
        eq('S5 sort clear = []', s1.sortCriteria, []);
        eq('S6 untouched keys ride through unchanged', [s1.query, s1.columnWidths, s1.pivot, s1.viewOptions, s1.reportSubtitle], [s0.query, s0.columnWidths, s0.pivot, s0.viewOptions, s0.reportSubtitle]);
        ok('S7 the input state is not mutated', JSON.stringify(s0) === s0copy);
        var s2 = C.applyState(s0, { view: { hideEmail: 'show', hideSearch: 'hide', clickToFilter: 'off', bareHeader: 'on' }, headerLayout: 'split' });
        eq('S8 view options: show deletes hide*, hide sets it; flag off deletes, on sets', sortKeys(s2.viewOptions), { bareHeader: true, headerLayout: 'split', hideSearch: true });
        var s3 = C.applyState(s2, { headerLayout: 'default' });
        ok('S9 header layout default = key removed', !('headerLayout' in s3.viewOptions), s3.viewOptions);
        var s4 = C.applyState({ query: 'x' }, { view: { hideViz: 'hide' } });
        eq('S10 a state without viewOptions gets one only for what changed', s4.viewOptions, { hideViz: true });
        var s5 = C.applyState(s0, { subtitle: { find: 'OSP', repl: 'Sponsored Programs' }, title: 'New title' });
        eq('S11 subtitle find/replace + title -> reportTitle', [s5.reportSubtitle, s5.reportTitle], ['By Sponsored Programs', 'New title']);
        eq('S12 replaceAll is literal (no regex)', C.replaceAll('a.b.c', '.', '-'), 'a-b-c');
        eq('S13 every View Options key buildStateObject writes is editable here', C.VIEW_OPTS.map(function (o) { return o.key; }).sort(),
            ['bareHeader', 'clickToFilter', 'hideClipboard', 'hideColumns', 'hideEmail', 'hideExport', 'hideGrouping', 'hidePagination', 'hidePivot', 'hideSearch', 'hideSnapshots', 'hideViz']);

        // ---------------- G: password gates
        var scanOk = { snaps: true, tasks: true };
        eq('G1 add on a plain report with no tasks: allowed', C.passwordGate(F.plain(), 'add', scanOk), '');
        ok('G2 add on a report with scheduled tasks: skipped', /scheduled task/.test(C.passwordGate(F.plain({ tasks: 2 }), 'add', scanOk)));
        ok('G3 add on a protected report: skipped', /already has a password/.test(C.passwordGate(F.plain({ encrypted: true }), 'add', scanOk)));
        ok('G4 change on an unprotected report: skipped', /no password/.test(C.passwordGate(F.plain(), 'change', scanOk)));
        ok('G5 change with encrypted snapshots: skipped', /encrypted snapshot/.test(C.passwordGate(F.plain({ encrypted: true, enc_snaps: 3 }), 'change', scanOk)));
        ok('G6 remove with tasks keeping the password: skipped', /keep/.test(C.passwordGate(F.plain({ encrypted: true, pw_tasks: 1 }), 'remove', scanOk)));
        ok('G7 change when the snapshot scan failed: skipped (fail closed)', /could not check/.test(C.passwordGate(F.plain({ encrypted: true }), 'change', { snaps: false, tasks: true })));
        eq('G8 change, nothing in the way: allowed', C.passwordGate(F.plain({ encrypted: true, snaps: 4, tasks: 2 }), 'change', scanOk), '');
        ok('G9 batch id matches the server rule', /^[A-Za-z0-9_-]{1,40}$/.test(C.newBatchId()), C.newBatchId());

        // ---------------- X: crypto parity with main.js
        var M = window.__mainCrypto;
        ok('X0 main.js crypto lifted', !!(M && M.encryptState && M.decryptState), window.__mainCryptoErr || 'missing');
        if (M) {
            var plainTxt = JSON.stringify({ query: 'select 1 from dual', note: 'naïve ✓ ' + 'x'.repeat(70000) });
            var e1 = await M.encryptState('s3cret', plainTxt);
            eq('X1 main.js ciphertext opens here', await C.decryptState('s3cret', e1), plainTxt);
            var e2 = await C.encryptState('s3cret', plainTxt);
            ok('X2 this ciphertext has main.js format', /^PENUMBRA_GCM::[A-Za-z0-9+/=]+$/.test(e2));
            eq('X3 this ciphertext opens in main.js', await M.decryptState('s3cret', e2), plainTxt);
            var bad = null; try { await C.decryptState('wrong', e2); } catch (e) { bad = e.message; }
            ok('X4 a wrong password is refused', bad && /Incorrect Password/.test(bad), bad);
        }

        // ---------------- P: plans + payloads
        var p, b;
        p = await C.planReport(F.plain(), ctx0({ theme: { mode: 'set', value: 'theme-dark-blue' } }));
        b = await C.buildPayload(p, 'bsTEST');
        var st = JSON.parse(b.state_data);
        eq('P1 theme change: status update, one change', [p.status, p.changes.map(function (c) { return c.label; })], ['update', ['Theme']]);
        eq('P2 payload carries the conflict guard, batch, overwrite, unchanged title and access', [b.base_updated_at, b.bulk_batch, b.overwrite, b.title, b.authorized],
            ['2026-10-13 09:00:00.123456', 'bsTEST', true, 'Awards FY26', 'jdoe,Mary Smith <msmith@ncsu.edu>,06']);
        ok('P3 no tags in the payload when tags are not touched (server leaves them)', !('tags' in b) && !('tags_base' in b), b);
        eq('P4 only the theme moved inside the state', $.extend({}, st, { theme: 'theme-default' }), F.baseState);
        eq('P5 preview names the theme by label', [p.changes[0].before, p.changes[0].after], ['Default Light', 'Dark Blue']);

        p = await C.planReport(F.plain(), ctx0({ theme: { mode: 'set', value: 'theme-default' } }));
        eq('P6 a value already in place: already matches, not saved', p.status, 'same');

        p = await C.planReport(F.plain(), ctx0({ tags: { mode: 'add', tags: ['NIH'] } }));
        b = await C.buildPayload(p, 'bsTEST');
        eq('P7 tags add: tags + tags_base (three-way merge on the server)', [b.tags, b.tags_base], [['CVM', 'NIH'], ['CVM']]);
        ok('P8 adding a tag with grant holders warns who becomes an editor', p.warnings.some(function (w) { return /NIH/.test(w) && /kwong/.test(w); }), p.warnings);
        eq('P9 tags-only change sends the stored state byte-for-byte', b.state_data, F.plain().state_data);

        p = await C.planReport(F.plain(), ctx0({ access: { mode: 'add', items: ['public'] } }));
        ok('P10 becoming public is warned', p.warnings.some(function (w) { return /PUBLIC/.test(w); }), p.warnings);
        p = await C.planReport(F.plain(), ctx0({ access: { mode: 'add', items: ['kwong', 'jdoe@ncsu.edu'] }, tags: { mode: 'remove', tags: ['CVM'] } }));
        eq('P10b the preview shows just what is added / removed', p.changes.map(function (c) { return c.label + '=' + c.delta; }), ['Access list=+ kwong', 'Tags=- CVM']);
        p = await C.planReport(F.plain(), ctx0({ access: { mode: 'replace', items: ['kwong'] } }));
        eq('P10c a replace shows the whole before -> after instead', [p.changes[0].delta, p.changes[0].after], ['', 'kwong']);
        p = await C.planReport(F.plain(), ctx0({ access: { mode: 'add', items: ['jdoe@ncsu.edu'] } }));
        eq('P11 adding a name already there: already matches', p.status, 'same');
        p = await C.planReport(F.plain({ authorized: '' }), ctx0({ theme: { mode: 'set', value: 'theme-dark-blue' } }));
        b = await C.buildPayload(p, 'bsTEST');
        ok('P12 empty stored list: sent as adminonly and said so', b.authorized === 'adminonly' && p.warnings.some(function (w) { return /adminonly/.test(w); }), [b.authorized, p.warnings]);
        p = await C.planReport(F.plain({ authorized: '' }), ctx0({ sort: 'clear', theme: { mode: 'set', value: 'theme-default' }, rowsPerPage: { mode: 'set', value: '100' } }));
        ok('P13 an empty stored list alone never makes a report "changed"', p.status === 'update' && p.changes.every(function (c) { return c.label !== 'Access list'; }), p.changes);

        // A state that is opened but ends up unchanged goes back EXACTLY as stored (PHP-style
        // escaped slashes here, which a re-serialize would rewrite).
        var escState = JSON.stringify($.extend({}, F.baseState, { query: 'SELECT a/b FROM t' })).replace(/\//g, '\\/');
        p = await C.planReport(F.plain({ state_data: escState }), ctx0({ theme: { mode: 'set', value: 'theme-default' }, access: { mode: 'add', items: ['kwong'] } }));
        b = await C.buildPayload(p, 'bsTEST');
        ok('P13b opened but unchanged state: sent byte-for-byte as stored', p.status === 'update' && b.state_data === escState, [p.status, b.state_data && b.state_data.slice(0, 60)]);

        p = await C.planReport(F.plain(), ctx0({ titleReplace: { find: 'FY26', repl: 'FY27' } }));
        b = await C.buildPayload(p, 'bsTEST');
        eq('P14 title replace moves the column AND state.reportTitle', [b.title, JSON.parse(b.state_data).reportTitle], ['Awards FY27', 'Awards FY27']);
        p = await C.planReport(F.plain(), ctx0({ titleReplace: { find: 'Awards FY26', repl: '' } }));
        ok('P15 a title that would be empty: skipped', p.status === 'skip' && /empty/.test(p.reason), p);

        // Protected reports.
        if (M) {
            var encWrap = JSON.stringify({ encrypted: true, content: await M.encryptState('old-pw', JSON.stringify(F.baseState)), scope_tables: ['NC_REPORTING.AWARDS'] });
            var enc = F.plain({ encrypted: true, state_data: encWrap, snaps: 2, tasks: 1 });

            p = await C.planReport(enc, ctx0({ access: { mode: 'add', items: ['kwong'] } }));
            b = await C.buildPayload(p, 'bsTEST');
            ok('P20 protected, access only: no password needed, wrapper (with scope_tables) sent as stored', p.status === 'update' && b.state_data === encWrap && b.scope_source_query === '', [p.status, p.reason]);

            p = await C.planReport(enc, ctx0({ density: { mode: 'set', value: 'compact' } }));
            ok('P21 protected, state change, no password: skipped', p.status === 'skip' && /current password/.test(p.reason), p.reason);
            p = await C.planReport(enc, ctx0({ density: { mode: 'set', value: 'compact' } }, { currentPassword: 'nope' }));
            ok('P22 wrong password: skipped', p.status === 'skip' && /does not open/.test(p.reason), p.reason);

            p = await C.planReport(enc, ctx0({ density: { mode: 'set', value: 'compact' } }, { currentPassword: 'old-pw' }));
            b = await C.buildPayload(p, 'bsTEST');
            var w = JSON.parse(b.state_data);
            var opened = JSON.parse(await M.decryptState('old-pw', w.content));
            ok('P23 right password: resealed with the SAME password (main.js opens it), density changed', w.encrypted === true && opened.density === 'compact' && opened.query === F.baseState.query, opened);
            eq('P24 resealed: plaintext query sent once for scope_tables', b.scope_source_query, F.baseState.query);

            p = await C.planReport(F.plain({ encrypted: true, state_data: encWrap }), ctx0({ password: { mode: 'change', value: 'new-pw' } }, { currentPassword: 'old-pw' }));
            b = await C.buildPayload(p, 'bsTEST');
            w = JSON.parse(b.state_data);
            var openNew = {}; try { openNew = JSON.parse(await M.decryptState('new-pw', w.content)); } catch (e) { openNew = { query: 'NOT OPENED: ' + e.message }; }
            var oldErr = null; try { await M.decryptState('old-pw', w.content); } catch (e) { oldErr = e.message; }
            ok('P25 change password: opens with the new one, not the old', openNew.query === F.baseState.query && !!oldErr, [openNew.query, oldErr]);

            p = await C.planReport(F.plain({ encrypted: true, state_data: encWrap }), ctx0({ password: { mode: 'remove' } }, { currentPassword: 'old-pw' }));
            b = await C.buildPayload(p, 'bsTEST');
            eq('P26 remove password: plain state saved', JSON.parse(b.state_data), F.baseState);

            p = await C.planReport(enc, ctx0({ password: { mode: 'change', value: 'new-pw' } }, { currentPassword: 'old-pw' }));
            eq('P27 change allowed when the report has tasks but none keeps the password', p.status, 'update');
            p = await C.planReport($.extend({}, enc, { enc_snaps: 2 }), ctx0({ password: { mode: 'change', value: 'new-pw' } }, { currentPassword: 'old-pw' }));
            ok('P28 change with encrypted snapshots: skipped, nothing else saved either', p.status === 'skip' && /snapshot/.test(p.reason), p.reason);

            p = await C.planReport(F.plain(), ctx0({ password: { mode: 'add', value: 'pw1' } }));
            b = await C.buildPayload(p, 'bsTEST');
            w = JSON.parse(b.state_data);
            ok('P29 add password: sealed with it, query sent for scope_tables', w.encrypted === true && JSON.parse(await M.decryptState('pw1', w.content)).query === F.baseState.query && b.scope_source_query === F.baseState.query, b.scope_source_query);
            p = await C.planReport(F.plain({ snaps: 3 }), ctx0({ password: { mode: 'add', value: 'pw1' } }));
            ok('P30 add password with existing snapshots: warned they stay unencrypted', p.warnings.some(function (x) { return /unencrypted/.test(x); }), p.warnings);
        }

        // ---------------- B: bug sweep 2026-10-13 (each one was a real defect in the first live build)
        var malformed = F.plain({ encrypted: true, state_data: JSON.stringify({ encrypted: true, content: 'PENUMBRA_GCM::%%not base64%%' }) });
        var bp = null;
        try { bp = await C.planReport(malformed, ctx0({ density: { mode: 'set', value: 'compact' } }, { currentPassword: 'x' })); } catch (e) { bp = { status: 'THREW ' + e.message }; }
        ok('B1 a malformed protected report is skipped, never a thrown error (the preview used to hang)', bp && bp.status === 'skip', bp && bp.status);
        p = await C.planReport(F.plain({ title: '  Awards\tFY26 ' }), ctx0({ titleReplace: { find: 'zzz', repl: 'y' } }));
        eq('B2 a title the find text is not in is left exactly as it is (no phantom cleanup)', [p.status, p.newTitle], ['same', '  Awards\tFY26 ']);
        var encT = F.plain({ encrypted: true, title: 'Locked FY26', state_data: JSON.stringify({ encrypted: true, content: 'PENUMBRA_GCM::AAAA' }) });
        p = await C.planReport(encT, ctx0({ titleReplace: { find: 'zzz', repl: 'y' } }));
        eq('B3 a protected report whose title is untouched is not skipped for its password', p.status, 'same');
        p = await C.planReport(encT, ctx0({ titleReplace: { find: 'FY26', repl: 'FY27' } }));
        ok('B4 ...but one whose title changes needs it (reportTitle is inside the ciphertext)', p.status === 'skip' && /current password/.test(p.reason), p.reason);
        p = await C.planReport(F.plain({ state_data: JSON.stringify($.extend({}, F.baseState, { rowsPerPage: 100 })) }), ctx0({ rowsPerPage: { mode: 'set', value: '100' } }));
        eq('B5 rows/page stored as the number 100 already matches "100"', p.status, 'same');
        var noVo = $.extend({}, F.baseState); delete noVo.viewOptions;
        p = await C.planReport(F.plain({ state_data: JSON.stringify(noVo) }), ctx0({ view: { hideExport: 'show' }, theme: { mode: 'set', value: 'theme-dark-blue' } }));
        b = await C.buildPayload(p, 'bsTEST');
        ok('B6 a report with no viewOptions does not get an empty one', p.status === 'update' && !('viewOptions' in JSON.parse(b.state_data)), b.state_data);
        if (M) {
            var noQ = { reportSnippet: '<b>x</b>', theme: 'theme-default' };
            var wrapQ = JSON.stringify({ encrypted: true, content: await M.encryptState('pq', JSON.stringify(noQ)), scope_tables: ['NC_REPORTING.T1'] });
            p = await C.planReport(F.plain({ encrypted: true, state_data: wrapQ }), ctx0({ theme: { mode: 'set', value: 'theme-dark-blue' } }, { currentPassword: 'pq' }));
            b = await C.buildPayload(p, 'bsTEST');
            eq('B7 resealing keeps the report\'s scope_tables (no plain query to recompute them from)', JSON.parse(b.state_data).scope_tables, ['NC_REPORTING.T1']);
        }

        // ---------------- D: the dialog, driven
        await dialogTests();
        await dialogSweepTests();
        return R;
    }

    // Mock $.ajax: bulk_settings_read.php returns fixtures, save_server_state.php records.
    function installAjax(saveResponder) {
        var calls = [];
        var F = fixtures();
        $.ajax = function (o) {
            var d = $.Deferred();
            var body = o.data ? JSON.parse(o.data) : null;
            calls.push({ url: o.url, body: body });
            setTimeout(function () {
                if (o.url === 'bulk_settings_read.php') {
                    d.resolve({
                        status: 'success', missing: [], scan: { snaps: true, tasks: true },
                        themes: [{ id: 'theme-default', label: 'Default Light' }, { id: 'theme-dark-blue', label: 'Dark Blue' }],
                        vocabulary: ['CVM', 'NIH'], tag_holders: {},
                        reports: [
                            F.plain(),
                            F.plain({ id: 12, short_id: 'second', title: 'Second', state_data: JSON.stringify($.extend({}, F.baseState, { theme: 'theme-dark-blue' })) }),
                            F.plain({ id: 13, short_id: 'locked', title: 'Locked', encrypted: true, state_data: JSON.stringify({ encrypted: true, content: 'PENUMBRA_GCM::AAAA' }) })
                        ]
                    });
                } else {
                    var r = saveResponder(body);
                    if (r.status === 200) { d.resolve(r.json); } else { d.reject({ status: r.status, responseJSON: r.json }); }
                }
            }, 5);
            return d.promise();
        };
        return calls;
    }
    function wait(cond, ms) {
        var t0 = Date.now();
        return new Promise(function (res) {
            (function poll() { if (cond() || Date.now() - t0 > (ms || 4000)) { res(cond()); } else { setTimeout(poll, 20); } })();
        });
    }

    async function dialogTests() {
        var B = window.PenumbraBulkSet;
        var calls = installAjax(function (body) {
            if (body.short_id === 'second') { return { status: 409, json: { success: false, conflict: true, updated_by: 'kwong', updated_by_name: 'Kim Wong', updated_when: '2026-10-13 10:00' } }; }
            return { status: 200, json: { success: true, updated_at: 'x' } };
        });
        var done = null;
        var docEsc = 0;
        $(document).on('keydown.bstest', function (e) { if (e.key === 'Escape') { docEsc++; } });

        B.open({ targets: [{ numericId: 11, shortId: 'awards26' }, { numericId: 12, shortId: 'second' }, { numericId: 13, shortId: 'locked' }], onDone: function (r) { done = r; } });
        var up = await wait(function () { return $('.pbs-dlg .pbs-step-edit').length > 0; });
        ok('D1 dialog opens after the read', up);
        if (!up) { return; }
        var $d = $('.pbs-overlay');
        eq('D2 read posted the numeric ids', calls[0] && calls[0].body, { ids: [11, 12, 13] });
        ok('D3 every field starts at Leave unchanged', $d.find('.pbs-mode').toArray().every(function (s) { return s.value === ''; }));
        ok('D3b no Deep Link Vendor Codes row (set per column since 10-13)', !$d.find('.pbs-mode[data-field="resolverLinksDefault"]').length && !/Deep link/i.test($d.text()));
        ok('D4 protected selection shows the current-password row', !$d.find('.pbs-curpw-row').prop('hidden'));

        // --- WCAG 2.5.3 / 4.1.2 / 1.3.1 / 3.3.2 (2026-10-15): every control's accessible name ---
        // A simplified accname: aria-labelledby (ids' text) > aria-label > a wrapping <label>; a placeholder never counts.
        function accName(el) {
            var lb = el.getAttribute('aria-labelledby');
            if (lb) { return lb.split(/\s+/).map(function (id) { var n = document.getElementById(id); return n ? n.textContent : ''; }).join(' ').replace(/\s+/g, ' ').trim(); }
            var al = el.getAttribute('aria-label'); if (al && al.trim()) { return al.trim(); }
            var w = el.closest('label'); return w ? w.textContent.replace(/\s+/g, ' ').trim() : '';
        }
        function rowLabel($row) { var $l = $row.find('> .pbs-label').clone(); $l.find('.pbs-hint').remove(); return $.trim($l.text()); }
        var badMode = $d.find('.pbs-mode').toArray().filter(function (s) {
            var vis = rowLabel($(s).closest('.pbs-row')), nm = accName(s);
            return !vis || nm.indexOf(vis) !== 0;
        }).map(function (s) { return s.getAttribute('data-field') + ' -> "' + accName(s) + '" vs "' + rowLabel($(s).closest('.pbs-row')) + '"'; });
        eq('D22 each change select is named by its row\'s visible label', badMode, []);
        var badVal = $d.find('.pbs-val select, .pbs-val input, .pbs-val textarea, .pbs-curpw').toArray().filter(function (el) { return !accName(el); })
            .map(function (el) { return el.className; });
        eq('D23 every value control has a name beyond its placeholder', badVal, []);
        var nm = function (sel) { return accName($d.find(sel)[0] || document.createElement('i')); };
        eq('D24 the value names carry their row', [nm('.pbs-row[data-row="theme"] .pbs-value'), nm('.pbs-row[data-row="density"] .pbs-value'), nm('.pbs-row[data-row="rowsPerPage"] .pbs-value'),
            nm('.pbs-row[data-row="titleReplace"] .pbs-find'), nm('.pbs-row[data-row="titleReplace"] .pbs-repl'), nm('.pbs-pw1'), nm('.pbs-pw2'), nm('.pbs-curpw')],
            ['Theme value', 'Density value', 'Rows / page value', 'Title find text', 'Title replace with', 'New password', 'Confirm new password', 'Current password']);

        $d.find('.pbs-preview-btn').trigger('click');
        ok('D5 Preview with nothing chosen says so', /Nothing to change/.test($d.find('.pbs-status').text()), $d.find('.pbs-status').text());

        $d.find('.pbs-mode[data-field="access"]').val('replace').trigger('change');
        $d.find('.pbs-access-items').val('kwong');
        $d.find('.pbs-preview-btn').trigger('click');
        await wait(function () { return /REPLACE/.test($d.find('.pbs-status').text()) || !$d.find('.pbs-step-preview').prop('hidden'); }, 3000);
        ok('D6 Replace needs the typed REPLACE', /REPLACE/.test($d.find('.pbs-status').text()), $d.find('.pbs-status').text());
        if (!$d.find('.pbs-step-preview').prop('hidden')) { $d.find('.pbs-back-btn').trigger('click'); }
        $d.find('.pbs-mode[data-field="access"]').val('').trigger('change');

        $d.find('.pbs-mode[data-field="tags"]').val('add').trigger('change');
        $d.find('.pbs-tags-items').val('NEWTAG');
        $d.find('.pbs-preview-btn').trigger('click');
        ok('D7 an unknown tag is refused (new tags start in the Tags tool)', /NEWTAG/.test($d.find('.pbs-status').text()), $d.find('.pbs-status').text());
        $d.find('.pbs-mode[data-field="tags"]').val('').trigger('change');

        $d.find('.pbs-mode[data-field="theme"]').val('set').trigger('change');
        ok('D8 choosing Set shows the value control', !$d.find('.pbs-row[data-row="theme"] .pbs-val').prop('hidden'));
        $d.find('.pbs-row[data-row="theme"] .pbs-value').val('theme-dark-blue');
        $d.find('.pbs-mode[data-field="view:hideExport"]').val('hide').trigger('change');
        $d.find('.pbs-preview-btn')[0].focus();   // a keyboard user presses it (moderate 2026-10-15: D25-D27)
        $d.find('.pbs-preview-btn').trigger('click');
        var pv = await wait(function () { return !$d.find('.pbs-step-preview').prop('hidden'); });
        ok('D9 preview shows', pv);
        var rows = $d.find('.pbs-step-preview tbody tr');
        eq('D10 one row per report, with its result', rows.map(function () { return $(this).find('.pbs-st').contents().first().text(); }).get(), ['Will save', 'Will save', 'Skipped']);
        ok('D11 the protected report says why it was skipped', /current password/.test(rows.eq(2).text()), rows.eq(2).text());
        ok('D12 the field summary shows a mixed selection', /Theme/.test($d.find('.pbs-fieldsum').text()), $d.find('.pbs-fieldsum').text());
        eq('D13 Apply names the count', $d.find('.pbs-apply-btn').text(), 'Apply to 2 reports');
        // WCAG 2.4.3 (moderate 2026-10-15): the pressed button is hidden by the step change, so
        // focus moves to the new step (the preview's summary line) instead of dropping to the page
        var ae = document.activeElement;
        ok('D25 Preview: focus lands on the preview summary', !!ae && $(ae).is('.pbs-step-preview .pbs-summary') && ae.getAttribute('tabindex') === '-1',
            ae && (ae.tagName + '.' + ae.className));

        // Escape in the preview steps back, and the repository underneath never sees it.
        $d.find('.pbs-apply-btn')[0].focus();
        var ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.body.dispatchEvent(ev);
        ok('D14 Escape steps back to the form', !$d.find('.pbs-step-edit').prop('hidden') && $('.pbs-overlay').length === 1);
        eq('D15 Escape does not reach the page underneath', docEsc, 0);
        ae = document.activeElement;
        ok('D26 Escape from Apply: focus on the Preview button, not the page', !!ae && $(ae).is('.pbs-preview-btn'), ae && (ae.tagName + '.' + ae.className));
        $d.find('.pbs-preview-btn').trigger('click');
        await wait(function () { return !$d.find('.pbs-step-preview').prop('hidden'); });
        $d.find('.pbs-back-btn')[0].focus();
        $d.find('.pbs-back-btn').trigger('click');
        ae = document.activeElement;
        ok('D27 Back: focus on the Preview button, not the page', !$d.find('.pbs-step-edit').prop('hidden') && !!ae && $(ae).is('.pbs-preview-btn'), ae && (ae.tagName + '.' + ae.className));
        $d.find('.pbs-preview-btn').trigger('click');
        await wait(function () { return !$d.find('.pbs-step-preview').prop('hidden'); });

        $d.find('.pbs-apply-btn')[0].focus();
        $d.find('.pbs-apply-btn').trigger('click');
        ae = document.activeElement;
        ok('D28 Apply: focus on the run\'s progress line', !!ae && $(ae).is('.pbs-step-run .pbs-progress'), ae && (ae.tagName + '.' + ae.className));
        var fin = await wait(function () { return !$d.find('.pbs-step-done').prop('hidden') && /saved/.test($d.find('.pbs-step-done').text()); }, 6000);
        ok('D16 the run finishes', fin);
        var saves = calls.filter(function (c) { return c.url === 'save_server_state.php'; });
        eq('D17 only the reports that change are saved, in order', saves.map(function (c) { return c.body.short_id; }), ['awards26', 'second']);
        var batches = saves.map(function (c) { return c.body.bulk_batch; });
        ok('D18 one batch id for the whole run', batches[0] && batches[0] === batches[1], batches);
        ok('D19 the conflict is reported with who and when', /Kim Wong/.test($d.find('.pbs-step-done').text()), $d.find('.pbs-step-done').text());
        $d.find('.pbs-close-btn').trigger('click');
        ok('D20 Close removes the dialog', $('.pbs-overlay').length === 0);
        eq('D21 onDone: saved + the ones to keep ticked (conflict, skipped)', done && [done.saved, done.keepTicked.slice().sort()], [['awards26'], ['locked', 'second']]);
        $(document).off('keydown.bstest');
    }

    async function dialogSweepTests() {
        var B = window.PenumbraBulkSet;
        // B8: a 403 mid-run (signed out) stops the run instead of failing every report in turn.
        var calls = installAjax(function () { return { status: 403, json: {} }; });
        var done = null;
        B.open({ targets: [{ numericId: 11 }, { numericId: 12 }, { numericId: 13 }], onDone: function (r) { done = r; } });
        await wait(function () { return $('.pbs-dlg .pbs-step-edit').length > 0; });
        var $d = $('.pbs-overlay');
        $d.find('.pbs-mode[data-field="rowsPerPage"]').val('set').trigger('change');
        $d.find('.pbs-row[data-row="rowsPerPage"] .pbs-value').val('500');

        // B9: Tab never leaves the dialog: from the last control it wraps to the first, and
        // focus outside the dialog is pulled back in.
        var f = $d.find('select, input, textarea, button').filter(function () { return !this.disabled && this.offsetParent !== null; });
        f.last()[0].focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        ok('B9 Tab on the last control wraps to the first', document.activeElement === f[0], document.activeElement && document.activeElement.className);
        f[0].focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        ok('B10 Shift+Tab on the first wraps to the last', document.activeElement === f.last()[0], document.activeElement && document.activeElement.className);
        var outside = $('<button type="button" id="bsOutside">x</button>').appendTo('body')[0];
        outside.focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        ok('B11 focus outside the dialog is pulled back in', $d[0].contains(document.activeElement), document.activeElement && document.activeElement.id);
        $(outside).remove();

        $d.find('.pbs-preview-btn').trigger('click');
        await wait(function () { return !$d.find('.pbs-step-preview').prop('hidden'); });
        $d.find('.pbs-apply-btn').trigger('click');
        // The run and done steps share one panel: wait for the RESULT, not the panel.
        await wait(function () { return !$d.find('.pbs-close-btn').prop('hidden'); }, 6000);
        var saves = calls.filter(function (c) { return c.url === 'save_server_state.php'; });
        eq('B12 a 403 stops the run after the first save', saves.length, 1);
        ok('B13 the rest are reported as not attempted', /not attempted/.test($d.find('.pbs-step-done').text()), $d.find('.pbs-step-done').text().slice(0, 300));
        $d.find('.pbs-close-btn').trigger('click');
        eq('B14 all of them stay ticked (two failed or not attempted, the protected one skipped)', done && done.keepTicked.slice().sort(), ['awards26', 'locked', 'second']);
    }

    window.__run = function () { return run().catch(function (e) { R.push({ id: 'Z fatal', ok: false, info: String(e && e.stack || e) }); return R; }); };
})();
