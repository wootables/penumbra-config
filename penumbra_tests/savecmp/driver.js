// savecmp suite - browser half (2026-10-23). A capture of the page made while a snapshot comparison is on screen -
// the real Server Save (its POST kept by the stubbed $.ajax), a ?state= link (buildViewStateURL) and a link to the
// view (PenumbraViewLink.build) - must write the REPORT's own view: the grouping it was in when the comparison began
// (or none) and the report table's own sort, never the comparison's __SNAP_TYPE grouping or a sort by the
// comparison's own column numbers. Phase 1 pages (?mode=grouped|flat) make the captures during REAL comparisons
// (compare-to-live; A-vs-B too) and hand them to run.py; phase 2 pages (?mode=saved|state|view) open each in a fresh
// page and read the view it comes back in.
//
// (cmprq, 2026-10-23) A NEW QUERY run while a comparison is on screen (the Run button: a changed prompt answer, F9 and
// the status bar's limit-off click it too) must bring the REPORT's own view back: the grouping recorded as the
// comparison began, with all its settings, or none, and the report table's own sort - F8 and F10 on the flat page,
// Q0-Q7 on ?mode=rqgrouped, Q8 on ?mode=rqsnapab (a ?snapab= boot: the view its state armed).
//
// The fixture: the report table numbers its columns ID 0, DEPT 1, NAME 2, AMOUNT 3, QTY 4, NOTE 5; a compare-to-live
// comparison counts '#' first (ID 1 ... QTY 5, NOTE 6), so its QTY heading is the report's NOTE number. The report
// is sorted by NOTE descending (its column 5); grouped: by DEPT, summed AMOUNT, groups Z-A, one level open, List, top 2.
(function () {
  var R = [], ART = {}, INFO = {};
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 900) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, exp: window.__EXP, results: R, artifacts: ART, info: INFO, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(','), window.__PRE_ERR].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload).slice(0, 4000);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {};
  var COLS = window.__COLS, LIVE = window.__LIVE, SNAP = window.__SNAP;
  var MODE = window.__MODE, EXPECT = window.__EXP;
  function J(x) { return JSON.stringify(x); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  function flatRows() { return document.querySelectorAll('#resultsTable tbody tr').length; }
  function grpWrappers() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper')); }
  function cmpOn() { return document.body.classList.contains('snapshot-comparison-active'); }
  function box() { return document.getElementById('snapshotComparisonContainer'); }
  function cmpWrappers() { return Array.prototype.slice.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper')); }
  function cmpWrapperOf(g) { return cmpWrappers().filter(function (w) { return w.getAttribute('data-group-key') === g; })[0] || null; }
  function headIn(w, name) {
    if (!w) return null;
    return Array.prototype.slice.call(w.querySelectorAll('thead th[data-colname]')).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0] || null;
  }
  function cmpTh(name) { return headIn(cmpWrapperOf('Modified Rows'), name); }
  function clickTh(th, shift) {
    if (!th) return false;
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!shift }));
    return true;
  }
  // a SERVER snapshot (its serverId): a link made during its comparison is the comparison's own link (viewlink)
  function snapObj(rows, name, ageDays, serverId) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '', serverId: serverId,
      columnNames: COLS.slice(),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  // the page's sort, as [name, column number, direction]: the number is the one its cells are read by
  function scOf(list) { return (list || []).map(function (c) { return [String(c.colIdentifier), String(c.colIndex), c.direction]; }); }
  function crit() { return J(scOf(H.sc())); }
  // the parts of a state this suite checks, in one order, nested objects flattened
  function viewOf(st) {
    if (!st) return null;
    var o = {};
    if (st.groupBy !== undefined) o.groupBy = st.groupBy;
    if (st.groupAgg !== undefined) o.groupAgg = st.groupAgg ? [st.groupAgg.column, st.groupAgg.type] : st.groupAgg;
    if (st.groupSort !== undefined) o.groupSort = st.groupSort ? st.groupSort.key + '|' + st.groupSort.dir : st.groupSort;
    if (st.groupStartDepth !== undefined) o.groupStartDepth = st.groupStartDepth;
    if (st.groupLayout !== undefined) o.groupLayout = st.groupLayout;
    if (st.groupLimit !== undefined) o.groupLimit = st.groupLimit ? [st.groupLimit.n, st.groupLimit.dir, st.groupLimit.other, st.groupLimit.minRows] : st.groupLimit;
    if (st.pivot !== undefined) o.pivot = st.pivot;
    o.sortCriteria = scOf(st.sortCriteria);
    return o;
  }
  var RS = scOf(window.__REPORT_SORT);   // [['NOTE', '5', 'desc']]
  var RG = window.__REPORT_GROUP;
  var EXP_G = viewOf(Object.assign({}, RG, { sortCriteria: window.__REPORT_SORT }));
  var EXP_F = viewOf({ sortCriteria: window.__REPORT_SORT });
  // the grouping a view link carries ({by, agg, sort, depth, layout, limit}), flattened as viewOf flattens a state's
  function vgOf(g) {
    if (!g) return null;
    var x = viewOf({ groupBy: g.by, groupAgg: g.agg, groupSort: g.sort, groupStartDepth: g.depth, groupLayout: g.layout, groupLimit: g.limit });
    delete x.sortCriteria;   // a link's grouping has none (its sort is v.sc)
    return x;
  }
  var EXP_VG = (function () { var x = viewOf(RG); delete x.sortCriteria; return x; })();
  // the page's live grouping globals, as the load left them
  function grpNow() {
    var g = H.grp();
    return J({ cols: g.cols, agg: g.agg ? [g.agg.column, g.agg.type] : null, sort: g.sort ? g.sort.key + '|' + g.sort.dir : null, depth: g.depth, layout: g.layout,
               limit: g.limit ? [g.limit.n, g.limit.dir, g.limit.other, g.limit.minRows] : null });
  }
  var EXP_GRP_NOW = J({ cols: ['DEPT'], agg: ['AMOUNT', 'sum'], sort: 'label|desc', depth: 1, layout: 'list', limit: [2, 'top', true, 0] });
  function idsIn(sel, col) {
    return Array.prototype.map.call(document.querySelectorAll(sel), function (r) { var td = r.querySelector('td[data-column="' + col + '"]'); return td ? String(td.textContent).trim() : '?'; });
  }
  function reportIds() { return J(idsIn('#resultsTable tbody tr', '0')); }
  function groupIds(key) {
    var w = grpWrappers().filter(function (x) { return x.getAttribute('data-group-key') === key; })[0];
    return w ? J(idsIn('#groupedResultsContainer .group-wrapper[data-group-key="' + key + '"] tbody tr', '0')) : 'none';
  }
  function notices() { var d = document.getElementById('action_overlay'); return d ? String(d.textContent || '') : ''; }
  function marks(sel) {
    return J(Array.prototype.map.call(document.querySelectorAll(sel), function (t) { return t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort'); }));
  }
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && flatRows() === LIVE.length; }, 30000);
    await sleep(500);
  }
  async function openCmp() {
    var h0 = window.__CF_HIDES || 0;
    H.runCmp(snapObj(SNAP, 'Fixture snapshot', 3, 55), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && cmpWrappers().length === 4 && (window.__CF_HIDES || 0) > h0; }, 30000);
    await sleep(300);
    return ok;
  }
  async function openAb() {
    var h0 = window.__CF_HIDES || 0;
    H.runAb(snapObj(SNAP, 'Snapshot A', 5, 56), snapObj(LIVE, 'Snapshot B', 1, 57), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && cmpWrappers().length === 4 && (window.__CF_HIDES || 0) > h0; }, 30000);
    await sleep(300);
    return ok;
  }
  // the comparison's own Clear (the control bar's link)
  async function clearCmp() {
    var h0 = window.__CF_HIDES || 0;
    document.getElementById('removeGroupingLink').click();
    var ok = await waitFor(function () { return !cmpOn() && (window.__CF_HIDES || 0) > h0 && !box(); }, 15000);
    await sleep(500);
    return ok;
  }
  // the real Server Save (the dialog's Save to Server button): the state it posts
  async function serverSave() {
    var n0 = window.__posts.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    var ok = await waitFor(function () { return window.__posts.length > n0; }, 10000);
    await sleep(300);
    if (!ok) return null;
    try { return JSON.parse(window.__posts[n0].data).state_data; } catch (e) { return null; }
  }
  function stateOfUrl(u) {
    if (!u) return null;
    try { return JSON.parse(H.decompress(new URLSearchParams(String(u).split('?')[1]).get('state'))); } catch (e) { return null; }
  }
  // the grouping dialog's Presets chip (js/penumbra_presets.js), as a person uses it
  function chip() { return document.querySelector('#groupPresetMount .pnb-preset-chip'); }
  function pop() { return document.querySelector('#groupPresetMount .pnb-preset-pop'); }
  async function presetSave(name) {
    var p = pop();
    if (!p || !chip()) return 'no chip';
    if (p.hidden) { chip().click(); await sleep(80); }
    var b = pop().querySelector('.pnb-preset-save');
    if (!b) return 'no save item';
    window.prompt = function () { return name; };
    try { b.click(); } finally { window.prompt = function () { return null; }; }
    await sleep(150);
    return 'clicked';
  }
  function storedPreset(name) {
    var E = window.PenumbraPresets;
    try { return E ? E.get(E.NS.GROUP, E.reportId(), name) : null; } catch (e) { return null; }
  }
  async function openGroupingDialog() {
    $('#groupTableBtn').trigger('click');
    await sleep(200);
    return H.lvls();
  }
  function closeGroupingDialog() { $('#groupingLightbox').hide(); }

  // ---- cmprq: a new query run during a comparison ----
  // the Run button (or what else starts a query: trigger); then the view its success draws: grouped (its groups) or
  // flat (every row), no comparison left
  async function runQuery(trigger) {
    var q0 = window.__queryDone, h0 = window.__CF_HIDES || 0;
    if (trigger) trigger(); else document.getElementById('executeQuery').click();
    var ok = await waitFor(function () { return window.__queryDone > q0; }, 20000);
    ok = ok && await waitFor(function () {
      return !cmpOn() && !box() && (window.__CF_HIDES || 0) > h0
        && (($('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0) || (!$('#groupedResultsContainer').is(':visible') && flatRows() === LIVE.length));
    }, 20000);
    await sleep(800);
    return ok;
  }
  // the comparison's own grouping dialog, as a person uses it: opened (it holds __SNAP_TYPE), a group sort chosen in
  // its list (the page's group sort follows the list at once) and a layout picked; its Apply flips the layout in place
  async function cmpDialog(gsort, layout) {
    var lv = await openGroupingDialog();
    $('#groupSortSelect').val(gsort).trigger('change');
    var r = document.querySelector('#groupLayoutRow input[name="groupLayoutChoice"][value="' + layout + '"]');
    if (r) { r.checked = true; $(r).trigger('change'); }
    $('#confirmGroupingBtn').trigger('click');
    await sleep(250);
    closeGroupingDialog();
    return lv;
  }
  function grpOn() {
    return $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0 && !box() && document.body.classList.contains('group-mode-active');
  }
  // the grouped view as a reader sees it: the grouping globals (and whether its layout was chosen), the page's sort, the
  // groups in order and which are open, each group's rows in order, and the sorted headings' marks in every group
  function gview() {
    var top = $('#groupedResultsContainer').children('.group-wrapper').get();
    var rows = {};
    grpWrappers().forEach(function (w) {
      var trs = w.querySelectorAll(':scope > .group-content > table > tbody > tr');
      if (trs.length) rows[w.getAttribute('data-group-key')] = Array.prototype.map.call(trs, function (r) { var td = r.querySelector('td[data-column="0"]'); return td ? String(td.textContent).trim() : '?'; });
    });
    return { on: grpOn(), grp: grpNow(), chosen: H.chosen(), sort: crit(),
             groups: top.map(function (w) { return w.getAttribute('data-group-key'); }),
             open: top.filter(function (w) { return w.classList.contains('open'); }).map(function (w) { return w.getAttribute('data-group-key'); }),
             rows: rows, marks: marks('#groupedResultsContainer .group-wrapper thead th.sorted') };
  }
  // what differs between two of them, for a detail
  function vdiff(a, b) {
    var out = [];
    Object.keys(a).forEach(function (k) { if (J(a[k]) !== J(b[k])) out.push(k + ': ' + J(a[k]) + ' -> ' + J(b[k])); });
    return out.join('; ') || 'same';
  }
  // the report sorted by NOTE descending through its own headings (a click: ascending, the next: descending), when an
  // earlier step (or a page without the fix) left another sort
  async function sortToReport() {
    for (var i = 0; i < 3 && crit() !== J(RS); i++) {
      var heads = document.querySelectorAll(grpOn() ? '#groupedResultsContainer .group-wrapper thead th[data-colname]' : '#tableHeader th[data-colname]');
      var th = Array.prototype.slice.call(heads).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === 'NOTE'; })[0];
      if (!clickTh(th)) break;
      await sleep(300);
    }
    return crit() === J(RS);
  }
  // grouped by DEPT again, when an earlier step (or a page without the fix) left the report flat
  async function regroupIfFlat() {
    if (grpOn()) return true;
    window.Penumbra.groupByColumn('DEPT');
    var ok = await waitFor(grpOn, 10000);
    await sleep(400);
    return ok;
  }
  // what a run said (the dock is emptied before it)
  function quiet(s) { return !/grouping dropped|sort dropped/i.test(s); }

  // ============================ phase 1: the grouped report =============================================
  async function phaseGrouped() {
    await waitBoot();
    var g0 = await waitFor(function () { return $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0; }, 20000);
    await sleep(300);
    var st0 = H.bso();
    rec('G0 the report boots grouped by DEPT (summed AMOUNT, Z-A, one level open, List, top 2) and sorted by NOTE descending (its column 5): a capture writes that view',
      g0 && J(viewOf(st0)) === J(EXP_G) && grpNow() === EXP_GRP_NOW && crit() === J(RS),
      'grouped=' + g0 + ' view=' + J(viewOf(st0)) + ' globals=' + grpNow() + ' sort=' + crit());

    // G1 a comparison opens over it: a capture, no heading clicked yet, writes the report's own view
    var on1 = await openCmp();
    var st1 = H.bso();
    rec('G1 a comparison opens: a capture writes the report\'s own grouping (DEPT and its settings) and sort, not __SNAP_TYPE',
      on1 && J(viewOf(st1)) === J(EXP_G), 'cmp=' + on1 + ' view=' + J(viewOf(st1)));

    // G2 a click on the comparison's QTY heading (the comparison's column 5) takes the page's sort over: a capture still
    // writes the report table's NOTE descending, and the page's sort stays the comparison's
    var qCol = cmpTh('QTY') ? cmpTh('QTY').getAttribute('data-column') : '?';
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var c2 = crit();
    var st2 = H.bso();
    rec('G2 a comparison heading click (QTY, its column 5) takes the sort over: a capture writes the report\'s NOTE descending by its column 5, the page keeps the comparison\'s sort',
      qCol === '5' && c2 === J([['QTY', '5', 'asc']]) && J(viewOf(st2)) === J(EXP_G) && crit() === c2,
      'col=' + qCol + ' pageSort=' + c2 + ' view=' + J(viewOf(st2)) + ' after=' + crit());

    // G3 the real Server Save during the comparison posts that view
    var sd3 = await serverSave();
    var st3 = null; try { st3 = JSON.parse(sd3); } catch (e) {}
    ART.save = sd3;
    rec('G3 the Server Save during the comparison posts the report\'s own view (grouped by DEPT with its settings, NOTE descending by its column 5)',
      !!st3 && J(viewOf(st3)) === J(EXP_G) && cmpOn() && crit() === c2,
      'posted=' + !!st3 + ' view=' + J(viewOf(st3)) + ' cmp=' + cmpOn() + ' pageSort=' + crit());

    // G4 a ?state= link (the Share button on unsaved work, the Copy dialog's url) during the comparison
    var u4 = H.bvu(true), st4 = stateOfUrl(u4);
    ART.state = u4;
    rec('G4 a ?state= link made during the comparison carries the report\'s own view',
      !!st4 && J(viewOf(st4)) === J(EXP_G), 'url=' + String(u4).slice(0, 60) + ' view=' + J(viewOf(st4)));

    // G5 ?sort= of the report's view during the comparison is none (it is grouped); a link to the view made now is the
    // comparison's own link plus the view (viewlink, live since a3591f9: m 'keep', no grouping or sort of its own) and
    // carries nothing of __SNAP_TYPE - that link's own round trip is viewlink's vcmpB
    var ser5 = H.ser();
    var b5 = window.PenumbraViewLink ? window.PenumbraViewLink.build() : null, v5 = b5 && b5.view;
    rec('G5 during the comparison ?sort= of the grouped report\'s view is none, and a link to the view is the comparison\'s own with nothing of __SNAP_TYPE',
      ser5 === '' && !!v5 && v5.m === 'keep' && !v5.g && !v5.sc && !v5.o && /[?&]snapcmp=55(&|$)/.test(String(b5.url)) && J(v5).indexOf('__SNAP_TYPE') < 0 && cmpOn(),
      'ser=' + J(ser5) + ' v=' + J(v5 && { m: v5.m, g: v5.g, sc: v5.sc, s: v5.s, o: v5.o }) + ' url=' + String(b5 && b5.url).slice(0, 120) + ' err=' + J(b5 && b5.error));

    // G6 the Save dialog's Last Stop Changes card shows the sort the save writes: NOTE descending, not QTY
    H.lsc();
    var card6 = String($('#serverSaveSortSummary').text() || '').replace(/\s+/g, ' ').trim();
    rec('G6 the Save dialog\'s sort card during the comparison shows the report\'s NOTE descending, not the comparison\'s QTY',
      /NOTE/.test(card6) && /▼/.test(card6) && !/QTY/.test(card6), 'card=' + J(card6));

    // G7 the grouping dialog opened during the comparison holds its __SNAP_TYPE: its Presets chip refuses to save it
    var lv7 = await openGroupingDialog();
    var had7 = /grouped by change type/.test(notices());
    var did7 = await presetSave('cmpgroup');
    var p7 = storedPreset('cmpgroup');
    var said7 = notices();
    closeGroupingDialog();
    rec('G7 the grouping dialog\'s Presets chip during the comparison refuses to save its __SNAP_TYPE grouping, and says why',
      J(lv7) === J(['__SNAP_TYPE']) && did7 === 'clicked' && !p7 && !had7 && /grouped by change type/.test(said7),
      'levels=' + J(lv7) + ' save=' + did7 + ' stored=' + J(p7) + ' said=' + J(said7.slice(-220)));

    // G8 the captures changed nothing: the page's sort is still the comparison's; a capture's sort is its own copy
    // (editing it leaves the sort the comparison's end puts back); Clear puts the report's sort and grouping back
    var st8 = H.bso();
    if (st8 && st8.sortCriteria && st8.sortCriteria[0]) st8.sortCriteria[0].direction = 'asc';
    if (st8 && st8.sortCriteria) st8.sortCriteria.push({ colIdentifier: 'ID', colIndex: 0, direction: 'asc' });
    var c8a = crit();
    var cl8 = await clearCmp();
    // Clear regroups through the grouping dialog's Apply: wait for its groups
    await waitFor(function () { return H.grp().cols.length > 0 && $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0 && !box(); }, 10000);
    await sleep(300);
    var c8 = crit(), gr8 = grpNow();
    INFO.afterClear = gr8;
    rec('G8 the captures leave the page as it was (the comparison\'s sort on), a capture\'s sort is a copy, and Clear puts the report\'s NOTE descending and DEPT back',
      c8a === c2 && cl8 && c8 === J(RS) && J(JSON.parse(gr8).cols) === J(['DEPT']),
      'pageSort=' + c8a + ' cleared=' + cl8 + ' back=' + c8 + ' grouping=' + gr8);

    // G9 after Clear a capture writes the report's grouping and sort as before the comparison (the start depth and the
    // limit Clear's regroup leaves out are recorded in the detail, a follow-up: it reads them from the dialog)
    var st9 = H.bso(), v9 = viewOf(st9), e9 = JSON.parse(J(EXP_G));
    delete v9.groupStartDepth; delete v9.groupLimit; delete e9.groupStartDepth; delete e9.groupLimit;
    rec('G9 after Clear a capture writes the report\'s grouping (DEPT, summed AMOUNT, Z-A, List) and sort as before the comparison',
      J(v9) === J(e9), 'view=' + J(viewOf(st9)));

    // G10 outside a comparison the grouping dialog's Presets chip saves a grouping of the report as it always did
    var lv10 = await openGroupingDialog();
    var did10 = await presetSave('deptgroup');
    var p10 = storedPreset('deptgroup');
    closeGroupingDialog();
    rec('G10 outside a comparison the grouping dialog\'s Presets chip saves the DEPT grouping',
      J(lv10) === J(['DEPT']) && did10 === 'clicked' && !!p10 && J(p10.levels) === J(['DEPT']),
      'levels=' + J(lv10) + ' save=' + did10 + ' stored=' + J(p10));

    // G11 an A-vs-B comparison (the other renderer) over the grouped report, a heading clicked: a capture writes the
    // view a capture made before it wrote
    var stB = H.bso();
    var on11 = await openAb();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c11 = crit();
    var st11 = H.bso();
    var cl11 = await clearCmp();
    rec('G11 an A-vs-B comparison with a heading clicked: a capture writes the report\'s own grouping and sort (as before it)',
      on11 && c11 === J([['NAME', '2', 'asc']]) && !!stB && J(viewOf(st11)) === J(viewOf(stB)) && viewOf(stB).groupBy === 'DEPT' && cl11,
      'ab=' + on11 + ' pageSort=' + c11 + ' before=' + J(viewOf(stB)) + ' during=' + J(viewOf(st11)) + ' cleared=' + cl11);

    // G12 (the review) the grouping removed (Remove Grouping: the page's grouping column outlives it) and an earlier
    // comparison's record left behind (as restoreOriginalData leaves one - set here): a comparison of the now flat
    // report, compare-to-live and A-vs-B, writes no grouping, and its Clear leaves the report flat
    var out12 = [];
    var runs12 = [['live', openCmp], ['ab', openAb]];
    for (var i12 = 0; i12 < runs12.length; i12++) {
      // grouped by DEPT (the header menu's Group by: its Apply runs a moment later), then Remove Grouping
      if (!document.body.classList.contains('group-mode-active')) window.Penumbra.groupByColumn('DEPT');
      var grp12 = await waitFor(function () { return H.grp().cols.length > 0 && grpWrappers().length > 0 && !box() && document.body.classList.contains('group-mode-active'); }, 10000);
      await sleep(300);
      document.getElementById('removeGroupingLink').click();
      var flat12 = await waitFor(function () { return !$('#groupedResultsContainer').is(':visible') && !document.body.classList.contains('group-mode-active'); }, 10000);
      await sleep(500);
      var linger12 = J(H.grp().cols), stF = H.bso();
      H.setPre({ column: 'NAME', agg: null, sort: { key: 'label', dir: 'asc' }, startDepth: 0, limit: null, layout: 'stacked' });
      var on12 = await runs12[i12][1]();
      var st12 = H.bso();
      var cl12 = await clearCmp();
      await sleep(400);
      out12.push({ kind: runs12[i12][0], grouped: grp12, flat: flat12, lingering: linger12, before: viewOf(stF), on: on12, view: viewOf(st12), cleared: cl12,
                   after: JSON.parse(grpNow()).cols, shown: $('#groupedResultsContainer').is(':visible') });
    }
    var ok12 = out12.every(function (o) {
      return o.grouped && o.flat && o.lingering === J(['DEPT']) && o.before.groupBy === undefined && o.on && o.cleared && o.view
        && o.view.groupBy === undefined && J(o.view) === J(o.before) && J(o.after) === '[]' && !o.shown;
    });
    rec('G12 Remove Grouping, then a comparison (compare-to-live, A-vs-B) with an earlier record left behind: a capture writes no grouping, and Clear leaves the report flat',
      ok12, 'runs=' + J(out12));

    // G13 (the review) a lazy exit to the home screen (_exitSnapshotToHome) during a sorted comparison leaves its
    // grouping column and the kept report sort behind, its view emptied: a capture then writes the page's sort (the exit
    // emptied it) and no grouping - not the sort the comparison had kept
    var on13 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var rs13 = H.rs();
    H.exitHome();
    await sleep(300);
    var st13 = H.bso();
    rec('G13 after a lazy exit to the home screen left a sorted comparison\'s column behind, a capture writes the page\'s (empty) sort and no grouping, not the kept one',
      on13 && !!rs13 && rs13.length > 0 && J(H.grp().cols) === J(['__SNAP_TYPE']) && !box() && !!st13 && J(viewOf(st13)) === J({ sortCriteria: [] }),
      'cmp=' + on13 + ' kept=' + J(scOf(rs13)) + ' cols=' + J(H.grp().cols) + ' box=' + !!box() + ' view=' + J(viewOf(st13)));
  }

  // ============================ phase 1: the flat report ================================================
  async function phaseFlat() {
    await waitBoot();
    var st0 = H.bso(), ser0 = H.ser();
    var b0 = window.PenumbraViewLink ? window.PenumbraViewLink.build() : null, v0 = b0 && b0.view;
    rec('F0 the flat report boots sorted by NOTE descending (its column 5): a capture writes no grouping and that sort, ?sort= NOTE|desc, a view link flat with it',
      J(viewOf(st0)) === J(EXP_F) && ser0 === 'NOTE|desc' && !!v0 && v0.m === 'flat' && v0.o === 'NOTE|desc' && reportIds() === J(['3', '2', '1', '4', '5', '6']),
      'view=' + J(viewOf(st0)) + ' ser=' + J(ser0) + ' v=' + J(v0 && { m: v0.m, o: v0.o }) + ' rows=' + reportIds());

    // F1 a comparison, its QTY heading clicked (the comparison's column 5 = the report's NOTE number)
    var on1 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var c1 = crit();
    var st1 = H.bso();
    rec('F1 a comparison with its QTY heading clicked: a capture writes no grouping (not __SNAP_TYPE) and the report\'s NOTE descending by its column 5',
      on1 && c1 === J([['QTY', '5', 'asc']]) && J(viewOf(st1)) === J(EXP_F), 'cmp=' + on1 + ' pageSort=' + c1 + ' view=' + J(viewOf(st1)));

    // F2 ?sort= of the report's view (a view link's flat sort, the download link, the Share button's extras)
    var ser2 = H.ser();
    rec('F2 ?sort= during the comparison serializes the report table\'s own sort (NOTE|desc), not none',
      ser2 === 'NOTE|desc', 'ser=' + J(ser2));

    // F3 the real Server Save
    var sd3 = await serverSave();
    var st3 = null; try { st3 = JSON.parse(sd3); } catch (e) {}
    ART.save = sd3;
    rec('F3 the Server Save during the comparison posts the report\'s own view (no grouping, NOTE descending by its column 5)',
      !!st3 && J(viewOf(st3)) === J(EXP_F) && cmpOn(), 'posted=' + !!st3 + ' view=' + J(viewOf(st3)));

    // F4 a ?state= link
    var u4 = H.bvu(true), st4 = stateOfUrl(u4);
    ART.state = u4;
    rec('F4 a ?state= link made during the comparison carries the report\'s own view', !!st4 && J(viewOf(st4)) === J(EXP_F), 'view=' + J(viewOf(st4)));

    // F5 a link to the view during the comparison: the comparison's own link plus the view (viewlink's 'keep'), nothing
    // of __SNAP_TYPE and no sort of the comparison's
    var b5 = window.PenumbraViewLink ? window.PenumbraViewLink.build() : null, v5 = b5 && b5.view;
    rec('F5 a link to the view during the comparison is the comparison\'s own with nothing of __SNAP_TYPE and no sort of the comparison\'s',
      !!v5 && v5.m === 'keep' && !v5.g && !v5.sc && !v5.o && /[?&]snapcmp=55(&|$)/.test(String(b5.url)) && J(v5).indexOf('__SNAP_TYPE') < 0,
      'v=' + J(v5 && { m: v5.m, o: v5.o, s: v5.s, g: v5.g, sc: v5.sc }) + ' url=' + String(b5 && b5.url).slice(0, 120) + ' err=' + J(b5 && b5.error));

    // F6 the Save dialog's sort card
    H.lsc();
    var card6 = String($('#serverSaveSortSummary').text() || '').replace(/\s+/g, ' ').trim();
    rec('F6 the Save dialog\'s sort card during the comparison shows the report\'s NOTE descending, not the comparison\'s QTY',
      /NOTE/.test(card6) && /▼/.test(card6) && !/QTY/.test(card6), 'card=' + J(card6));

    // F7 Clear: a capture is the one from before the comparison, whole
    var cl7 = await clearCmp();
    var st7 = H.bso();
    rec('F7 after Clear a capture is the one from before the comparison, whole (nothing else in it changed)',
      cl7 && J(st7) === J(st0), 'cleared=' + cl7 + ' same=' + (J(st7) === J(st0)) + ' view=' + J(viewOf(st7)));

    // F8 (cmprq) a new query run during a sorted comparison (no Clear) ends it: the report comes back flat in its own
    // NOTE descending (its column 5: rows and marks), not in the comparison's QTY carried across by name (column 4), and
    // the report sort the comparison had kept is handed back, none left over; a capture writes that view
    var on8 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var c8a = crit();
    $('#action_overlay').empty();
    var ran8 = await runQuery();
    var rs8 = H.rs(), c8 = crit(), st8 = H.bso(), say8 = notices(), mk8 = marks('#tableHeader th.sorted');
    rec('F8 a new query run during a sorted comparison brings the flat report back in its own NOTE descending (its column 5, rows and marks), the comparison\'s kept sort handed back; a capture writes that view',
      on8 && c8a === J([['QTY', '5', 'asc']]) && ran8 && rs8 === null && c8 === J(RS) && reportIds() === J(['3', '2', '1', '4', '5', '6']) && mk8 === J(['NOTE:descending'])
        && !$('#groupedResultsContainer').is(':visible') && J(H.grp().cols) === '[]' && !!st8 && J(viewOf(st8)) === J(EXP_F) && quiet(say8),
      'cmp=' + on8 + ' took=' + c8a + ' query=' + ran8 + ' kept=' + J(rs8 && scOf(rs8)) + ' pageSort=' + c8 + ' rows=' + reportIds() + ' marks=' + mk8
        + ' cols=' + J(H.grp().cols) + ' view=' + J(viewOf(st8)) + ' said=' + J(say8.slice(0, 200)));

    // F9 an A-vs-B comparison over the flat report, a heading clicked (its NAME = column 2): a capture writes the view
    // a capture made before it wrote
    var stB = H.bso();
    var on9 = await openAb();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c9 = crit();
    var st9 = H.bso();
    var cl9 = await clearCmp();
    rec('F9 an A-vs-B comparison with a heading clicked: a capture writes the report\'s own view (no grouping, its sort, as before it)',
      on9 && c9 === J([['NAME', '2', 'asc']]) && !!stB && J(viewOf(st9)) === J(viewOf(stB)) && cl9,
      'ab=' + on9 + ' pageSort=' + c9 + ' before=' + J(viewOf(stB)) + ' during=' + J(viewOf(st9)) + ' cleared=' + cl9);

    // F10 (cmprq) an A-vs-B comparison of the flat report (the other renderer), its NAME heading clicked, then a new
    // query: the report comes back flat in its own NOTE descending (rows and marks), no kept sort left over
    var pre10 = crit();
    var on10 = await openAb();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c10a = crit();
    $('#action_overlay').empty();
    var ran10 = await runQuery();
    var say10 = notices(), mk10 = marks('#tableHeader th.sorted'), rs10 = H.rs();
    rec('F10 an A-vs-B comparison of the flat report with its NAME heading clicked, then a new query: the report comes back flat in its own NOTE descending (rows and marks), no kept sort left over',
      on10 && c10a === J([['NAME', '2', 'asc']]) && ran10 && crit() === J(RS) && reportIds() === J(['3', '2', '1', '4', '5', '6']) && mk10 === J(['NOTE:descending'])
        && rs10 === null && J(H.grp().cols) === '[]' && !$('#groupedResultsContainer').is(':visible') && quiet(say10),
      'before=' + pre10 + ' ab=' + on10 + ' took=' + c10a + ' query=' + ran10 + ' pageSort=' + crit() + ' rows=' + reportIds() + ' marks=' + mk10
        + ' kept=' + J(rs10 && scOf(rs10)) + ' cols=' + J(H.grp().cols) + ' said=' + J(say10.slice(0, 200)));
  }

  // ============================ phase 1 (cmprq): new queries run during comparisons of the grouped report ===
  async function phaseRqGrouped() {
    await waitBoot();
    var g0 = await waitFor(grpOn, 20000);
    await sleep(300);
    var v0 = gview();
    rec('Q0 the report boots grouped by DEPT (summed AMOUNT, Z-A, one level open, top 2, List - its saver\'s choice) and sorted by NOTE descending (its column 5) in every group',
      g0 && v0.grp === EXP_GRP_NOW && v0.chosen === true && v0.sort === J(RS) && J(v0.rows.West) === J(['2', '4']) && J(v0.rows.North) === J(['5', '6'])
        && marks('#groupedResultsContainer .group-wrapper[data-group-key="North"] thead th.sorted') === J(['NOTE:descending']),
      'grouped=' + g0 + ' view=' + J(v0));

    // Q1 a compare-to-live comparison: its QTY heading takes the sort over, and its own grouping dialog sorts the groups
    // by count and flips the layout to Stacked; then a new query. The report comes back as Q0 found it: grouped by DEPT
    // with every setting (summary, Z-A, the open level, the top 2, List and that it was chosen), NOTE descending in every
    // group (rows and marks), the comparison's kept sort handed back, nothing said about anything dropped
    var on1 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var lv1 = await cmpDialog('count|asc', 'stacked');
    var mid1 = H.grp(), c1a = crit();
    $('#action_overlay').empty();
    var ran1 = await runQuery();
    var v1 = gview(), say1 = notices(), rs1 = H.rs();
    rec('Q1 a new query run during a comparison of the grouped report (a heading took the sort over, its dialog changed the group sort and the layout) brings the report back as it was: grouped by DEPT with every setting, NOTE descending in every group',
      on1 && J(lv1) === J(['__SNAP_TYPE']) && mid1.layout === 'stacked' && (mid1.sort.key + '|' + mid1.sort.dir) === 'count|asc' && c1a === J([['QTY', '5', 'asc']])
        && ran1 && J(v1) === J(v0) && rs1 === null && quiet(say1),
      'cmp=' + on1 + ' dialog=' + J(lv1) + ' during=' + J({ layout: mid1.layout, sort: mid1.sort }) + ' took=' + c1a + ' query=' + ran1 + ' kept=' + J(rs1)
        + ' said=' + J(say1.slice(0, 160)) + ' changed=' + vdiff(v0, v1));

    // Q2 the grouping a regroup made: Remove Grouping, then the header menu's group by DEPT (no summary, A-Z, collapsed, no
    // limit, Stacked as the group count chose it - nobody's choice). A comparison whose own dialog picks List (a choice
    // now) and sorts the groups by count; then a new query: back as it was - Stacked, and still nobody's choice
    var gA = await regroupIfFlat();
    document.getElementById('removeGroupingLink').click();
    await waitFor(function () { return !$('#groupedResultsContainer').is(':visible') && !document.body.classList.contains('group-mode-active'); }, 10000);
    await sleep(500);
    window.Penumbra.groupByColumn('DEPT');
    var g2 = await waitFor(grpOn, 10000);
    await sleep(400);
    var v2a = gview();
    var on2 = await openCmp();
    var lv2 = await cmpDialog('count|desc', 'list');
    var mid2 = H.grp(), ch2 = H.chosen();
    $('#action_overlay').empty();
    var ran2 = await runQuery();
    var v2 = gview(), say2 = notices();
    rec('Q2 a regroup by DEPT (Stacked as the group count chose it); a comparison whose dialog picks List and sorts the groups by count; a new query brings the grouping back as it was, Stacked and nobody\'s choice',
      gA && g2 && v2a.grp === J({ cols: ['DEPT'], agg: null, sort: 'label|asc', depth: 0, layout: 'stacked', limit: null }) && v2a.chosen === false
        && on2 && J(lv2) === J(['__SNAP_TYPE']) && mid2.layout === 'list' && ch2 === true && (mid2.sort.key + '|' + mid2.sort.dir) === 'count|desc'
        && ran2 && J(v2) === J(v2a) && quiet(say2),
      'before=' + J({ grp: v2a.grp, chosen: v2a.chosen, sort: v2a.sort }) + ' cmp=' + on2 + ' dialog=' + J(lv2) + ' during=' + J({ layout: mid2.layout, sort: mid2.sort, chosen: ch2 })
        + ' query=' + ran2 + ' said=' + J(say2.slice(0, 160)) + ' changed=' + vdiff(v2a, v2));

    // Q3 an A-vs-B comparison (the other renderer) of the grouped report, its NAME heading clicked; then a new query:
    // back as it was, in the sort it had before, in every group
    var g3 = await regroupIfFlat();
    var v3a = gview();
    var on3 = await openAb();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c3a = crit();
    $('#action_overlay').empty();
    var ran3 = await runQuery();
    var v3 = gview(), say3 = notices(), rs3 = H.rs();
    rec('Q3 a new query run during an A-vs-B comparison of the grouped report (its NAME heading clicked) brings the report back as it was, grouped by DEPT and sorted as before in every group',
      g3 && v3a.on && on3 && c3a === J([['NAME', '2', 'asc']]) && ran3 && J(v3) === J(v3a) && rs3 === null && quiet(say3),
      'before=' + J({ grp: v3a.grp, sort: v3a.sort }) + ' ab=' + on3 + ' took=' + c3a + ' query=' + ran3 + ' kept=' + J(rs3) + ' said=' + J(say3.slice(0, 160)) + ' changed=' + vdiff(v3a, v3));

    // Q4 a new query with no comparison on screen: the grouped report comes back as it was (the re-query path as always)
    var g4 = await regroupIfFlat();
    var v4a = gview();
    $('#action_overlay').empty();
    var ran4 = await runQuery();
    var v4 = gview(), say4 = notices();
    rec('Q4 a new query with no comparison on screen brings the grouped report back as it was',
      g4 && v4a.on && ran4 && J(v4) === J(v4a) && quiet(say4),
      'before=' + J({ grp: v4a.grp, sort: v4a.sort }) + ' query=' + ran4 + ' said=' + J(say4.slice(0, 160)) + ' changed=' + vdiff(v4a, v4));

    // Q5 a snapshot loaded as a VIEW over the grouped report (the table shows its rows), an A-vs-B comparison on it with
    // its NAME heading clicked, then a new query: a run from a snapshot view keeps none of its grouping (as it always has,
    // though the comparison recorded one as it began), and the table's own sort comes back, not the comparison's
    // (2026-10-24, snapgrp) ...a main.js with snapgrp gives the report its own view back from a run from a view: grouped
    // as it was before the view (the run re-arms the grouping the view kept), in its own sort - by marker (H.snapgrp)
    var g5 = await regroupIfFlat();
    var s5 = await sortToReport();
    var sort5 = crit(), v5a = gview();
    H.loadSnap(snapObj(SNAP, 'Viewed snapshot', 2, 58));
    var vw5 = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && reportIds().indexOf('"7"') >= 0; }, 15000);
    await sleep(400);
    var on5 = await openAb();
    var pre5 = H.pre();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c5a = crit();
    $('#action_overlay').empty();
    var ran5 = await runQuery();
    var say5 = notices(), rs5 = H.rs(), mk5 = marks('#tableHeader th.sorted');
    if (H.snapgrp) {
      var v5 = gview();
      // (snapgrp: while a view is on screen the page is out of group mode - the view keeps the report's grouping for the
      // way back - so the comparison opened on it records none)
      rec('Q5 a new query run during an A-vs-B comparison opened on a snapshot view brings the report back as it was before the view - grouped by DEPT (snapgrp: every way back gives the report\'s own view back) - in the table\'s own sort, not the comparison\'s',
        g5 && s5 && sort5 === J(RS) && vw5 && on5 && pre5 === null && c5a === J([['NAME', '2', 'asc']]) && ran5 && !H.viewing()
          && v5a.on && J(v5) === J(v5a) && crit() === J(RS) && rs5 === null && quiet(say5),
        'sortBefore=' + sort5 + ' view=' + vw5 + ' ab=' + on5 + ' record=' + J(pre5 && pre5.column) + ' took=' + c5a + ' query=' + ran5 + ' viewing=' + H.viewing()
          + ' pageSort=' + crit() + ' kept=' + J(rs5) + ' said=' + J(say5.slice(0, 160)) + ' changed=' + vdiff(v5a, v5));
    } else
    rec('Q5 a new query run during an A-vs-B comparison opened on a snapshot view brings the report back flat (a run from a snapshot view keeps no grouping), in the table\'s own sort, not the comparison\'s',
      g5 && s5 && sort5 === J(RS) && vw5 && on5 && !!pre5 && String(pre5.column) === 'DEPT' && c5a === J([['NAME', '2', 'asc']]) && ran5 && !H.viewing()
        && !$('#groupedResultsContainer').is(':visible') && J(H.grp().cols) === '[]' && crit() === J(RS) && reportIds() === J(['3', '2', '1', '4', '5', '6'])
        && mk5 === J(['NOTE:descending']) && rs5 === null && quiet(say5),
      'sortBefore=' + sort5 + ' view=' + vw5 + ' ab=' + on5 + ' record=' + J(pre5 && pre5.column) + ' took=' + c5a + ' query=' + ran5 + ' viewing=' + H.viewing()
        + ' grouped=' + $('#groupedResultsContainer').is(':visible') + ' cols=' + J(H.grp().cols) + ' pageSort=' + crit() + ' rows=' + reportIds() + ' marks=' + mk5
        + ' kept=' + J(rs5) + ' said=' + J(say5.slice(0, 160)));

    // Q6 a pivot left armed by a run that never completed (planted here, as a run whose prompt was cancelled leaves one)
    // while the report is grouped; a comparison of it; then a new query: the report comes back in the grouping the
    // comparison recorded, not as that pivot
    var g6 = await regroupIfFlat();
    var v6a = gview();
    H.setPendPivot({ rows: ['DEPT'], cols: [], vals: ['AMOUNT'], agg: 'sum' });
    var on6 = await openCmp();
    $('#action_overlay').empty();
    var ran6 = await runQuery();
    var v6 = gview(), say6 = notices();
    rec('Q6 a pivot left armed by a run that never completed does not come back over the grouping a comparison recorded: a new query brings the report back grouped as it was',
      g6 && v6a.on && on6 && ran6 && J(v6) === J(v6a) && !$('#pivot-output-container').is(':visible') && quiet(say6),
      'before=' + J({ grp: v6a.grp, sort: v6a.sort }) + ' cmp=' + on6 + ' query=' + ran6 + ' pivot=' + $('#pivot-output-container').is(':visible')
        + ' said=' + J(say6.slice(0, 160)) + ' changed=' + vdiff(v6a, v6));

    // Q7 a table opened from the console (performClearAllAction: a new query that starts from no sort) while a comparison
    // of the grouped report is on screen, one of its headings having taken the sort over: the table opens flat and
    // unsorted, as it always has - it keeps nothing of the report's view
    var g7 = await regroupIfFlat();
    var s7 = await sortToReport();
    var on7 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(250);
    var c7a = crit();
    $('#action_overlay').empty();
    var ran7 = await runQuery(function () { H.clearAll('SAVECMP_FIXTURE', window.__QUERY); });
    var say7 = notices(), mk7 = marks('#tableHeader th.sorted');
    rec('Q7 a table opened from the console during a comparison of the grouped report (a heading took the sort over) opens flat and unsorted, as it always has',
      g7 && s7 && on7 && c7a === J([['QTY', '5', 'asc']]) && ran7 && !$('#groupedResultsContainer').is(':visible') && J(H.grp().cols) === '[]'
        && crit() === '[]' && reportIds() === J(['1', '2', '3', '4', '5', '6']) && mk7 === '[]' && quiet(say7),
      'grouped=' + g7 + ' sorted=' + s7 + ' cmp=' + on7 + ' took=' + c7a + ' query=' + ran7 + ' groupedAfter=' + $('#groupedResultsContainer').is(':visible')
        + ' cols=' + J(H.grp().cols) + ' pageSort=' + crit() + ' rows=' + reportIds() + ' marks=' + mk7 + ' said=' + J(say7.slice(0, 200)));
  }

  // ============================ phase 1 (cmprq): a ?snapab= boot, then a new query ======================
  // The saved grouped report opened with &snapab=55,56: the state arms its grouping and sort, and the boot draws the
  // A-vs-B of the two stored snapshots without ever running the report's own query (isStateLoading stays on).
  async function phaseRqSnapab() {
    var on0 = await waitFor(function () { return cmpOn() && cmpWrappers().length === 4; }, 30000);
    await sleep(800);
    var q0 = window.__queryDone, p0 = H.pend();
    clickTh(cmpTh('NAME'));
    await sleep(250);
    var c0 = crit();
    $('#action_overlay').empty();
    var ran8 = await runQuery();
    var v8 = gview(), say8 = notices();
    rec('Q8 a ?snapab= link of the grouped report (its A-vs-B drawn before the report\'s query ever ran), a heading clicked, then a new query: the report comes back in its saved view, grouped by DEPT with every setting and NOTE descending in every group',
      on0 && q0 === 0 && !!p0 && p0.g === 'DEPT' && p0.sl === true && c0 === J([['NAME', '2', 'asc']]) && ran8 && v8.on && v8.grp === EXP_GRP_NOW && v8.chosen === true
        && v8.sort === J(RS) && J(v8.rows.West) === J(['2', '4']) && J(v8.rows.North) === J(['5', '6']) && quiet(say8),
      'ab=' + on0 + ' queriesBefore=' + q0 + ' armed=' + J(p0) + ' took=' + c0 + ' query=' + ran8 + ' view=' + J(v8) + ' said=' + J(say8.slice(0, 200)));
  }

  // ============================ phase 2: a capture opened in a fresh page ===============================
  async function phaseLoad() {
    var tag = { saved: 'a Save', state: 'a ?state= link', view: 'a link to the view' }[MODE] || MODE;
    var id = 'R-' + (EXPECT === 'grouped' ? 'G' : 'F') + '-' + MODE;
    await waitBoot();
    if (EXPECT === 'grouped') {
      var g = await waitFor(function () { return $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0; }, 15000);
      await sleep(400);
      var west = groupIds('West'), north = groupIds('North'), say = notices();
      var mk = marks('#groupedResultsContainer .group-wrapper[data-group-key="North"] thead th.sorted');
      rec(id + ' ' + tag + ' made during a comparison of the grouped report opens grouped by DEPT (its settings) and sorted by NOTE descending, its column 5',
        g && grpNow() === EXP_GRP_NOW && crit() === J(RS) && west === J(['2', '4']) && north === J(['5', '6']) && mk === J(['NOTE:descending'])
          && !/grouping dropped/i.test(say) && !/__SNAP_TYPE/.test($('#tableSearch').val() || ''),
        'grouped=' + g + ' globals=' + grpNow() + ' sort=' + crit() + ' West=' + west + ' North=' + north + ' marks=' + mk + ' box=' + J($('#tableSearch').val()) + ' said=' + J(say.slice(0, 160)));
    } else {
      await sleep(300);
      var mkf = marks('#tableHeader th.sorted'), sayf = notices();
      rec(id + ' ' + tag + ' made during a comparison of the flat report opens flat and sorted by NOTE descending, its column 5',
        !$('#groupedResultsContainer').is(':visible') && J(H.grp().cols) === '[]' && crit() === J(RS) && reportIds() === J(['3', '2', '1', '4', '5', '6']) && mkf === J(['NOTE:descending'])
          && !/__SNAP_TYPE/.test($('#tableSearch').val() || '') && !/grouping dropped/i.test(sayf),
        'grouped=' + $('#groupedResultsContainer').is(':visible') + ' cols=' + J(H.grp().cols) + ' sort=' + crit() + ' rows=' + reportIds() + ' marks=' + mkf + ' box=' + J($('#tableSearch').val()) + ' said=' + J(sayf.slice(0, 160)));
    }
  }

  (async function () {
    try {
      var need = ['runCmp', 'runAb', 'compress', 'decompress', 'bso', 'bvu', 'ser', 'lsc', 'lvls', 'exitHome', 'sc', 'rs', 'grp', 'setPre',
                  'loadSnap', 'clearAll', 'chosen', 'pre', 'viewing', 'pend', 'setPendPivot'];
      var miss = need.filter(function (k) { return !H[k]; });
      if (miss.length) { finish('hook: not exported: ' + miss.join(', ')); return; }
      if (MODE === 'grouped') await phaseGrouped();
      else if (MODE === 'flat') await phaseFlat();
      else if (MODE === 'rqgrouped') await phaseRqGrouped();
      else if (MODE === 'rqsnapab') await phaseRqSnapab();
      else await phaseLoad();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
