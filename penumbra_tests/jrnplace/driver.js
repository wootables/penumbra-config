// jrnplace suite - browser half (2026-10-26). Runs ONE scenario (?scn=) against the main.js the page loaded and
// publishes window.__HCRESULT = { scn, chk: {name: bool}, info: {...}, errors: [...] } and window.__HCDONE = true.
// The stored report (harness.html) has its journal on (row notes keyed on V_ID; a toggle 'k1' with its who / when in
// some) and a saved column order that names the journal's columns. run.py asserts every chk (L-*) and no page errors
// (E-*); on the live build before the fix the NEW checks are red, the GUARDs green.
(function () {
  var SCN = window.__SCN, K = window.__K;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function J(x) { return JSON.stringify(x); }
  var V = K.SHOWN, H = K.H, N = K.N, T = K.T, TB = K.TB, TO = K.TO;

  // ---- the flat table's headings (data-colname: a journal column's is its own name) ------------------------------
  function heads() { return Array.prototype.filter.call(document.querySelectorAll('#tableHeader > th'), function (t) { return t.getAttribute('data-column') !== '#'; }); }
  function orderNow() { return heads().map(function (t) { return t.getAttribute('data-colname'); }); }
  function shownNow() { return heads().filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-colname'); }); }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  function th(name) { return document.querySelector('#tableHeader > th[data-colname="' + name + '"]'); }
  // every one of the first n rows holds its cells in the header's order, and a hidden heading's cells are hidden
  function aligned(n) {
    var ids = Array.prototype.map.call(document.querySelectorAll('#tableHeader > th'), function (t) { return t.getAttribute('data-column'); });
    var hid = {}; Array.prototype.forEach.call(document.querySelectorAll('#tableHeader > th'), function (t) { if (t.style.display === 'none') hid[t.getAttribute('data-column')] = 1; });
    var rows = flatRows().slice(0, n);
    return rows.length > 0 && rows.every(function (tr) {
      var cs = Array.prototype.slice.call(tr.children);
      return J(cs.map(function (c) { return c.getAttribute('data-column'); })) === J(ids)
        && cs.every(function (c) { var jc = String(c.getAttribute('data-column') || ''); return jc.indexOf('__JOURNAL') !== 0 || (c.style.display === 'none') === !!hid[jc]; });
    });
  }
  function snap() { return { order: orderNow(), shown: shownNow() }; }
  function layoutIs(order, shown) { return J(orderNow()) === J(order) && J(shownNow()) === J(shown); }
  function jcols() { return K.toggle ? [T, TB, TO, N] : [N]; }
  function painted() { return jcols().every(function (c) { return !!th(c); }) && flatRows().length === 300 && !!flatRows()[0].querySelector(':scope > td[data-column="' + N + '"]'); }

  async function boot() {
    var ok = await until(function () {
      if (window.__queryDone < 1 || hides() < 1) return false;
      if (K.group) return document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]').length >= 5 && $('#groupedResultsContainer').is(':visible') && painted();
      return $('#resultsTable').is(':visible') && painted();
    }, 150000);
    if (!ok) throw new Error('boot: the report (or its journal columns) never finished loading (150 s): ' + J({ q: window.__queryDone, hides: hides(), rows: flatRows().length, heads: orderNow().slice(0, 6) }));
    await sleep(600); await frames(4);
  }
  // the real Save-to-server handler, end to end: the STATE_DATA it POSTed
  async function serverSave() {
    $('#serverSaveIdInput').val('ldfix'); $('#serverSaveTitleInput').val('Journal place fixture');
    $('#serverSaveOverwriteCheckbox').prop('checked', true);
    var before = window.__savePosts.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    await until(function () { return window.__savePosts.length > before; }, 8000);
    await sleep(250);
    var post = window.__savePosts[before];
    if (!post) return null;
    try { return JSON.parse(post.state_data); } catch (e) { return null; }
  }
  // a re-run of the query (the Run button); done when the overlay is down and the journal painted again
  async function requery() {
    var q0 = window.__queryDone, h0 = hides();
    $('#executeQuery').trigger('click');
    var ok = await until(function () { return window.__queryDone > q0 && hides() > h0 && painted(); }, 60000);
    await sleep(600); await frames(4);
    return ok;
  }
  // a heading moved through the header menu's own path (as Move / Swap do: the viewer's layout is written)
  async function moveTo(name, afterName) {
    var hm = window.Penumbra.headerMenu, lay = hm.layout();
    var i = lay.cols.findIndex(function (c) { return c.colName === name; });
    if (i < 0) return false;
    var me = lay.cols.splice(i, 1)[0];
    if (afterName === null) lay.cols.push(me);
    else lay.cols.splice(lay.cols.findIndex(function (c) { return c.colName === afterName; }) + 1, 0, me);
    var ok = hm.applyLayout(lay);
    await sleep(250); await frames(3);
    return ok;
  }
  function prefs() { try { return (JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}').ldfix) || null; } catch (e) { return null; } }
  // (the scenario's own diagnostics FIRST: run.py prints the first 900 characters)
  function info(extra) { R.info = Object.assign({}, extra || {}, { now: snap(), stored: { order: (window.__STORED || {}).columnOrder, vis: (window.__STORED || {}).visibleColumns } }); }

  var END = V.concat(H, [N]);                                              // Notes after the last saved column
  var MID = ['V_AMOUNT', 'V_ID', N, 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'];
  var S = {};
  // NEW: Notes moved to the end and saved: at the end for a viewer with no layout of their own
  S.repend = async function () {
    R.chk.layout = layoutIs(END, V.concat([N]));
    R.chk.cells = aligned(25);
    info();
  };
  // NEW: the SQL put V_NEW in front since (every saved place shifted): Notes after V_ID, Done and its who / when after
  // H_CODE (the last saved column) - by name; V_NEW (new since: appended, hidden) after them
  S.repmid = async function () {
    R.chk.layout = layoutIs(MID.concat(H, [T, TB, TO, 'V_NEW']), MID.concat([T, TB, TO]));
    R.chk.cells = aligned(25);
    info();
  };
  // NEW: listed in the saved order but hidden: hidden (heading and cells), at its place
  S.rephid = async function () {
    var td = flatRows()[0].querySelector(':scope > td[data-column="' + N + '"]');
    R.chk.layout = layoutIs(END, V);
    R.chk.cellHidden = !!td && td.style.display === 'none';
    R.chk.cells = aligned(25);
    info();
  };
  // GUARD: a report saved before the notes were on (its order does not name them): right after '#', shown
  S.repnone = async function () {
    R.chk.layout = layoutIs([N].concat(V, H), [N].concat(V));
    R.chk.cells = aligned(25);
    info();
  };
  // GUARD: saved right after '#'
  S.repfirst = async function () {
    R.chk.layout = layoutIs([N].concat(V, H), [N].concat(V));
    info();
  };
  // GUARD: the viewer's own layout names Notes (first): it wins over the report's (last)
  S.minewins = async function () {
    R.chk.layout = layoutIs([N].concat(V, H), [N].concat(V));
    info({ prefs: prefs() });
  };
  // NEW: the viewer's own layout (V_STATUS moved first) was saved before Notes existed: Notes where the report has it
  S.mineunl = async function () {
    var mine = ['V_STATUS'].concat(V.slice(0, 5));
    R.chk.layout = layoutIs(mine.concat(H, [N]), mine.concat([N]));
    R.chk.cells = aligned(25);
    info({ prefs: prefs() });
  };
  // NEW: the viewer hid Notes (their own layout: last, hidden) - hidden again on their next visit (the report: shown, first)
  S.minehid = async function () {
    R.chk.layout = layoutIs(END, V);
    R.chk.cells = aligned(25);
    info({ prefs: prefs() });
  };
  // GUARD: the viewer shows Notes after V_ID (their own layout); the report hid it at the end: theirs wins
  S.mineshow = async function () {
    R.chk.layout = layoutIs(MID.concat(H), MID);
    info({ prefs: prefs() });
  };
  // GUARD: a view link with its own column layout names Notes after V_ID: the link wins over the report's (last)
  S.linkwins = async function () {
    R.chk.layout = layoutIs(MID.concat(H), MID);
    R.chk.cells = aligned(25);
    info();
  };
  // a heading already in the row stays where the viewer put it through a repaint (GUARD), and a fresh paint (a
  // reload's) puts it where the move wrote the viewer's layout (GUARD) - after loading at the report's place (NEW)
  S.stays = async function () {
    R.chk.atLoad = layoutIs(END, V.concat([N]));
    var mv = await moveTo(N, 'V_ID');
    window.Penumbra.journalPaintFor([], true);
    await sleep(200); await frames(2);
    R.chk.staysMoved = mv && layoutIs(MID.concat(H), MID) && aligned(25);
    var p1 = prefs();
    Array.prototype.forEach.call(document.querySelectorAll('[data-column="' + N + '"]'), function (el) { el.parentNode.removeChild(el); });
    window.Penumbra.journalPaintFor([], true);
    await sleep(200); await frames(2);
    R.chk.freshMine = !!p1 && (p1.order || []).indexOf(N) === (p1.order || []).indexOf('V_ID') + 1 && layoutIs(MID.concat(H), MID) && aligned(25);
    info({ prefs: p1 });
  };
  // the header menu's Reset all: nothing to reset at load (NEW: Notes right after '#' read as moved, the report has it
  // last); after Notes moves, Reset all puts it back last (GUARD: it already read the report's order)
  S.resetall = async function () {
    var hm = window.Penumbra.headerMenu;
    R.chk.cleanAtLoad = hm.customized() === false;
    var mv = await moveTo(N, 'V_ID');
    R.chk.changed = mv && hm.customized() === true;
    hm.resetAll(); await sleep(300); await frames(2);
    R.chk.backToReport = layoutIs(END, V.concat([N])) && aligned(25);
    info();
  };
  // NEW: Reset this column on Notes (moved after V_ID): back where the report has it (it used to keep its place)
  S.resetcol = async function () {
    var hm = window.Penumbra.headerMenu;
    var mv = await moveTo(N, 'V_ID');
    var moved = snap();
    hm.resetColumn(N); await sleep(300); await frames(2);
    R.chk.backByReport = mv && J(moved.order) === J(MID.concat(H)) && layoutIs(END, V.concat([N])) && aligned(25);
    info({ moved: moved });
  };
  // NEW: a Run after the load (the header built again, the journal's columns placed again): still where the report has it
  S.requery = async function () {
    var rq = await requery();
    R.chk.afterRun = rq && layoutIs(END, V.concat([N])) && aligned(25);
    info();
  };
  // NEW: a report saved grouped: the flat table and every group's table hold Notes at the end
  S.grouped = async function () {
    await until(function () { return !!document.querySelector('#groupedResultsContainer .group-content > table > thead th[data-column="' + N + '"]'); }, 8000);
    var leaf = document.querySelector('#groupedResultsContainer .group-content > table');
    var lh = leaf ? Array.prototype.filter.call(leaf.querySelectorAll(':scope > thead > tr:last-child > th'), function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-colname'); }) : [];
    R.chk.flat = layoutIs(END, V.concat([N]));
    R.chk.groups = lh.length > 0 && lh[lh.length - 1] === N && lh.indexOf(N) === lh.length - 1;
    info({ leafHeads: lh });
  };
  // the user's own steps (10-26): Notes opens right after '#' (GUARD), moves to the end (GUARD), and a Save writes it
  // at the end of the report's order, shown (GUARD) - flowload opens what it posted
  S.flowsave = async function () {
    R.chk.startsFirst = layoutIs([N].concat(V, H), [N].concat(V));
    var mv = await moveTo(N, null);
    R.chk.moved = mv && layoutIs(END, V.concat([N]));
    var p = await serverSave();
    R.chk.savedAtEnd = !!p && Array.isArray(p.columnOrder) && p.columnOrder[p.columnOrder.length - 1] === N
      && Array.isArray(p.visibleColumns) && p.visibleColumns.indexOf(N) >= 0 && !!p.viewOptions && p.viewOptions.journalRowNotes === true;
    info({ posted: p });
  };
  // NEW: ...opened again with no layout of the viewer's own (Clear All Custom Preferences, or a new viewer): at the end
  S.flowload = async function () {
    R.chk.layout = layoutIs(END, V.concat([N]));
    R.chk.cells = aligned(25);
    info();
  };
  // NEW (toggles): Done and its who / when moved to the end and saved: at the end, Notes still first
  S.tgend = async function () {
    R.chk.layout = layoutIs([N].concat(V, H, [T, TB, TO]), [N].concat(V, [T, TB, TO]));
    R.chk.cells = aligned(25);
    info();
  };
  // NEW (toggles): the who / when columns saved first (before Done) and hidden: right after '#' - not after Done - hidden
  S.tghid = async function () {
    R.chk.layout = layoutIs([TB, TO, T, N].concat(V, H), [T, N].concat(V));
    R.chk.cells = aligned(25);
    info();
  };
  // the user's steps with the toggle: Done (alone) moved to the end and saved (GUARDs)
  S.tgflowsave = async function () {
    R.chk.startsFirst = layoutIs([T, TB, TO, N].concat(V, H), [T, TB, TO, N].concat(V));
    var mv = await moveTo(T, null);
    R.chk.moved = mv && layoutIs([TB, TO, N].concat(V, H, [T]), [TB, TO, N].concat(V, [T]));
    var p = await serverSave();
    R.chk.savedAtEnd = !!p && Array.isArray(p.columnOrder) && p.columnOrder[p.columnOrder.length - 1] === T && J(p.columnOrder.slice(0, 3)) === J([TB, TO, N])
      && !!p.viewOptions && Array.isArray(p.viewOptions.journalToggles) && p.viewOptions.journalToggles.length === 1;
    info({ posted: p });
  };
  // NEW (toggles): ...opened again with no layout of the viewer's own: Done at the end, its who / when and Notes first
  S.tgflowload = async function () {
    R.chk.layout = layoutIs([TB, TO, N].concat(V, H, [T]), [TB, TO, N].concat(V, [T]));
    R.chk.cells = aligned(25);
    info();
  };

  (async function () {
    try {
      window.__STEP = 'boot';
      await boot();
      window.__STEP = 'scenario';
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
      try { if (!R.info || !Object.keys(R.info).length) info(); } catch (x) { }
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR].filter(Boolean).join('; ');
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
