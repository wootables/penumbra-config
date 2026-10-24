// ldlayout suite - browser half (2026-10-23). Runs ONE scenario (?scn=) against the main.js the page loaded and
// publishes window.__HCRESULT = { scn, chk: {name: bool}, info: {...}, errors: [...] } and window.__HCDONE = true.
// The stored report (harness.html) was saved against the 20-column fixture: V_AMOUNT moved first, the six V_ columns
// shown, the H_ ones hidden. Its result has changed since (a column in front, columns moved, one dropped or renamed).
// run.py asserts every chk (L-*) and no page errors (E-*); on the live build before the fix the NEW checks are red,
// the GUARDs green.
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function J(x) { return JSON.stringify(x); }
  var BASE = window.__BASE, H = BASE.slice(6);
  var SHOWN = ['V_AMOUNT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'];
  var ORD = [2, 0, 1].concat(BASE.map(function (n, i) { return i; }).slice(3)), VIS = ['#', 2, 0, 1, 3, 4, 5];
  function up(a) { return a.map(function (n) { return String(n).toUpperCase(); }); }

  // ---- the flat table's headings -------------------------------------------------------------------------------
  function heads() { return Array.prototype.filter.call(document.querySelectorAll('#tableHeader > th'), function (t) { return t.getAttribute('data-column') !== '#'; }); }
  function orderNow() { return heads().map(function (t) { return t.getAttribute('data-colname'); }); }
  function shownNow() { return heads().filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-colname'); }); }
  function numShown() { var t = document.querySelector('#tableHeader > th[data-column="#"]'); return !!t && t.style.display !== 'none'; }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  // the cell under a heading (by name) in the first row
  function cell0(name) {
    var th = document.querySelector('#tableHeader > th[data-colname="' + name + '"]'), r = flatRows()[0];
    if (!th || !r) return null;
    var td = r.querySelector(':scope > td[data-column="' + th.getAttribute('data-column') + '"]');
    return td ? String(td.textContent).trim() : null;
  }
  // the layout a by-PLACE read gives (the build before the fix): each saved place -> the column there now
  function byPlace(order, vis, cur) {
    var o = order.map(function (i) { return cur[i]; }).filter(function (n) { return n !== undefined; });
    var seen = {}; o.forEach(function (n) { seen[n] = 1; });
    cur.forEach(function (n) { if (!seen[n]) o.push(n); });
    var v = {}; vis.forEach(function (i) { if (cur[i] !== undefined) v[cur[i]] = 1; });
    return { order: up(o), shown: up(o.filter(function (n) { return v[n]; })), num: vis.indexOf('#') >= 0 };
  }
  function layoutIs(exp) { return J(orderNow()) === J(exp.order) && J(shownNow()) === J(exp.shown) && numShown() === exp.num; }
  function snap() { return { order: orderNow(), shown: shownNow(), num: numShown() }; }
  // the result's columns NOW (the page reads Object.keys of a row: a number-like name first)
  var CUR = window.__colsNow || [];
  var FRONT = { order: SHOWN.concat(H, ['V_NEW']), shown: SHOWN, num: true };

  async function boot() {
    var grouped = SCN === 'group';
    var ok = await until(function () {
      if (window.__queryDone < 1 || hides() < 1) return false;
      if (grouped) return document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]').length >= 5 && $('#groupedResultsContainer').is(':visible');
      return $('#resultsTable').is(':visible') && flatRows().length === 300;
    }, 150000);
    if (!ok) throw new Error('boot: the report never finished loading (150 s)');
    await sleep(500); await frames(4);
  }
  // the real Save-to-server handler, end to end: the STATE_DATA it POSTed
  async function serverSave() {
    $('#serverSaveIdInput').val('ldfix'); $('#serverSaveTitleInput').val('Saved layout fixture');
    $('#serverSaveOverwriteCheckbox').prop('checked', true);
    var before = window.__savePosts.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    await until(function () { return window.__savePosts.length > before; }, 8000);
    await sleep(250);
    var post = window.__savePosts[before];
    if (!post) return null;
    try { return JSON.parse(post.state_data); } catch (e) { return null; }
  }
  // the real Save-locally handler: the URL it stored (savedQueries)
  async function localSave(name, pass) {
    $('#localSaveNameInput').val(name);
    $('#enableLocalReportPassword').prop('checked', !!pass);
    $('#localSavePassword').val(pass || ''); $('#localSavePasswordConfirm').val(pass || '');
    $('#confirmLocalSaveBtn').prop('disabled', false).trigger('click');
    var hit = null;
    await until(function () {
      var list = []; try { list = JSON.parse(localStorage.getItem('savedQueries') || '[]'); } catch (e) { }
      hit = list.filter(function (q) { return q.name === name; })[0] || null;
      return !!hit;
    }, 8000);
    await sleep(150);
    return hit ? hit.url : null;
  }
  function stateOfUrl(url) {
    var m = /[?&]state=([^&#]+)/.exec(String(url || ''));
    if (!m) return null;
    try { return JSON.parse(HC.decomp(m[1])); } catch (e) { return { __err: String(e) }; }
  }
  function targetLen(url) { try { var u = new URL(url, location.href); return (u.pathname + u.search).length; } catch (e) { return String(url).length; } }
  // a re-run of the query (the Run button), optionally with other rows; done when the overlay is down
  async function requery(data, want) {
    if (data) window.__queryResponse = { data: data };
    var q0 = window.__queryDone, h0 = hides();
    $('#executeQuery').trigger('click');
    var ok = await until(function () { return window.__queryDone > q0 && hides() > h0 && (want ? want() : true); }, 60000);
    await sleep(600); await frames(4);
    return ok;
  }

  // the by-name layouts the scenarios expect (the layout the report was saved with, over the result as it is now)
  var EXP = {
    front: FRONT, saveload: FRONT, viewnolay: FRONT, jrnentry: FRONT,
    moved: { order: SHOWN.concat(H), shown: SHOWN, num: true },
    gone: { order: ['V_AMOUNT', 'V_ID', 'V_DATE', 'V_LINK', 'V_STATUS'].concat(H), shown: ['V_AMOUNT', 'V_ID', 'V_DATE', 'V_LINK', 'V_STATUS'], num: true },
    gonenew: { order: ['V_AMOUNT', 'V_ID', 'V_DATE', 'V_LINK', 'V_STATUS'].concat(H, ['V_NEW']), shown: ['V_AMOUNT', 'V_ID', 'V_DATE', 'V_LINK', 'V_STATUS'], num: true },
    renamed: { order: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'].concat(H), shown: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'], num: true },
    numname: { order: SHOWN.concat(H, ['2021']), shown: SHOWN, num: true },
    same: { order: SHOWN.concat(H), shown: SHOWN, num: true },
    oldsame: { order: SHOWN.concat(H), shown: SHOWN, num: true },
    hashoff: { order: SHOWN.concat(H, ['V_NEW']), shown: SHOWN, num: false },
    mycalcload: { order: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'].concat(H, ['MYCALC']), shown: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS', 'MYCALC'], num: true },
    // by place, as the build before the fix (a state with no names, names that do not cover its lists, or none of
    // its shown columns left)
    oldfront: byPlace(ORD, VIS, CUR)
  };
  ['badnames', 'partial', 'holey', 'allgone', 'netthrow'].forEach(function (k) {
    if (SCN === k) EXP[k] = byPlace(window.__STORED.columnOrder, window.__STORED.visibleColumns, CUR);
  });
  function info(extra) { R.info = Object.assign({ now: snap(), cur: CUR.length }, extra || {}); }

  var S = {};
  // NEW: each of these opens in the layout it was saved with, by name (the build before: by place, shifted)
  ['front', 'moved', 'gone', 'gonenew', 'numname', 'hashoff', 'jrnentry', 'saveload', 'viewnolay'].forEach(function (k) {
    S[k] = async function () {
      R.chk.layout = layoutIs(EXP[k]);
      R.chk.idCell = cell0('V_ID') === 'ID-1001';
      info({ want: EXP[k], byPlace: byPlace((window.__STORED && window.__STORED.columnOrder) || ORD, (window.__STORED && window.__STORED.visibleColumns) || VIS, CUR) });
    };
  });
  // GUARD: renamed in place (as many columns as then) - its place and visibility kept, as by place; nothing moved;
  // a state saved before the names, or one whose names do not cover its places, or none of its shown ones left: by
  // place, exactly as before
  ['renamed', 'same', 'oldsame', 'oldfront', 'badnames', 'partial', 'holey', 'allgone', 'netthrow', 'mycalcload'].forEach(function (k) {
    S[k] = async function () {
      R.chk.layout = layoutIs(EXP[k]);
      info({ want: EXP[k] });
    };
  });
  // NEW: two columns sharing a name but for its case (V_AMOUNT at 2, v_amount at 3 when saved; both headings read
  // V_AMOUNT): each to its own place now (3 and 4), in its own order - V_AMOUNT shown first, v_amount hidden
  S.casedup = async function () {
    var ids = heads().map(function (t) { return t.getAttribute('data-column'); });
    var shownIds = heads().filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-column'); });
    var f0 = window.__rowsFixture[0];
    var td = flatRows()[0] ? flatRows()[0].querySelector(':scope > td[data-column="3"]') : null;
    R.chk.eachItsOwn = J(shownIds) === J(['3', '1', '2', '5', '6', '7']) && ids[3] === '4' && J(ids.slice(0, 5)) === J(['3', '1', '2', '4', '5'])
      && !!td && String(td.textContent).trim() === f0.V_AMOUNT && ids[ids.length - 1] === '0';
    info({ ids: ids, shownIds: shownIds });
  };
  // NEW: a grouped report: every group's table shows the saved columns, by name
  S.group = async function () {
    var th = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper.group-leaf table thead tr:last-child th'));
    var first = document.querySelector('#groupedResultsContainer .group-wrapper.group-leaf');
    var t = first ? Array.prototype.slice.call(first.querySelectorAll(':scope > .group-content > table > thead th')) : [];
    var shown = t.filter(function (x) { return x.style.display !== 'none' && x.getAttribute('data-column') !== '#' && x.getAttribute('data-colname'); }).map(function (x) { return x.getAttribute('data-colname'); });
    R.chk.groupsByName = J(shown) === J(SHOWN);
    R.chk.flatByName = layoutIs(FRONT);
    info({ gshown: shown, leaves: th.length });
  };
  // a Save of an old report (no names): the two lists as before (GUARD), and the name at each place now (NEW)
  S.save = async function () {
    var p = await serverSave();
    R.chk.posted = !!p;
    R.chk.listsAsBefore = !!p && J(p.columnOrder) === J(ORD) && J(p.visibleColumns) === J(VIS);
    R.chk.namesWritten = !!p && J(p.layoutColumnNames) === J(up(BASE));
    info({ posted: p });
  };
  // a Save made after a run that came back empty (no table to read): the stored layout, its names too (NEW)
  S.carry = async function () {
    var rq = await requery([], function () { return !document.querySelector('#tableHeader th'); });
    var p = await serverSave();
    R.chk.emptyRun = rq && !document.querySelector('#tableHeader th');
    R.chk.listsCarried = !!p && J(p.columnOrder) === J(ORD) && J(p.visibleColumns) === J(VIS);
    R.chk.namesCarried = !!p && J(p.layoutColumnNames) === J(up(BASE));
    info({ posted: p && { columnOrder: p.columnOrder, visibleColumns: p.visibleColumns, layoutColumnNames: p.layoutColumnNames } });
  };
  // this viewer's own calculated column (MYCALC, place 20): shown here; a Save leaves it out of the lists (GUARD) and
  // out of the names (NEW), so the names still cover the places the lists use
  S.mycalc = async function () {
    var shown = shownNow();
    var p = await serverSave();
    R.chk.calcHere = shown.indexOf('MYCALC') >= 0;
    R.chk.listsStripped = !!p && J(p.columnOrder) === J(ORD) && J(p.visibleColumns) === J(VIS);
    R.chk.namesStripped = !!p && J(p.layoutColumnNames) === J(up(BASE));
    info({ shown: shown, posted: p && { columnOrder: p.columnOrder, visibleColumns: p.visibleColumns, layoutColumnNames: p.layoutColumnNames, calc: p.calcColumns } });
  };
  // GUARD: a view link with its own column layout (by name) wins, as it always has: its columns, its order
  S.viewlink = async function () {
    var o = ['V_STATUS', 'V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK'].concat(H);
    R.chk.linkLayout = layoutIs({ order: o, shown: ['V_STATUS', 'V_ID', 'V_NAME'], num: true });
    info({ want: o });
  };
  // the header menu's Reset all: nothing to reset right after the load (GUARD); after V_ID and V_NAME swap places and
  // V_STATUS is hidden, it puts the report's layout back - by name (NEW: by place it put the shifted one back). (A
  // column the report's layout does not list - V_NEW - keeps its place in a Reset all, so only report columns move.)
  S.reset = async function () {
    var hm = window.Penumbra.headerMenu;
    R.chk.cleanAtLoad = hm.customized() === false;
    var lay = hm.layout();
    var a = lay.cols.findIndex(function (c) { return c.colName === 'V_ID'; }), b = lay.cols.findIndex(function (c) { return c.colName === 'V_NAME'; });
    var tmp = lay.cols[a]; lay.cols[a] = lay.cols[b]; lay.cols[b] = tmp;
    lay.cols.forEach(function (c) { if (c.colName === 'V_STATUS') c.visible = false; });
    hm.applyLayout(lay); await sleep(200); await frames(2);
    var moved = snap();
    R.chk.changed = hm.customized() === true && J(moved.order) !== J(FRONT.order) && moved.shown.indexOf('V_STATUS') < 0;
    hm.resetAll(); await sleep(300); await frames(2);
    R.chk.resetByName = layoutIs(FRONT);
    info({ moved: moved });
  };
  // Reset this column (V_ID, moved to the end): back after V_AMOUNT, its place in the report's order by name (NEW)
  S.resetcol = async function () {
    var hm = window.Penumbra.headerMenu;
    var lay = hm.layout();
    var idx = lay.cols.findIndex(function (c) { return c.colName === 'V_ID'; });
    var me = lay.cols.splice(idx, 1)[0]; lay.cols.push(me);
    hm.applyLayout(lay); await sleep(200); await frames(2);
    var moved = snap();
    hm.resetColumn('V_ID'); await sleep(300); await frames(2);
    R.chk.backByName = J(orderNow()) === J(FRONT.order);
    info({ moved: moved });
  };
  // the custom layout chip: this viewer's own layout IS the report's (by name) over the moved result - the chip stays
  // hidden (NEW: by place the report's layout read as other columns, and the chip said they differ)
  S.pill = async function () {
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed')); await sleep(300); await frames(2);
    R.chk.chipHidden = $('#sbCustomCols').css('display') === 'none';
    R.chk.layoutMine = layoutIs(EXP.moved);
    info({ diff: String($('#sbCustomColsDiff').text() || '').slice(0, 300) });
  };
  // GUARD: this viewer's own saved column layout wins over the report's, as always
  S.prefs = async function () {
    R.chk.prefsWin = layoutIs({ order: ['V_STATUS', 'V_ID', 'V_NEW', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK'].concat(H), shown: ['V_STATUS', 'V_ID', 'V_NEW'], num: false });
    info();
  };
  // GUARD: a ?state= link carrying the sender's own calculated column KCALC (it loads as this viewer's own) with
  // V_AMOUNT renamed in place: the name changed in place, so it keeps its place and stays shown, as by place - the
  // viewer's own calculated columns are left out of the count on both sides (the link's names hold KCALC too)
  S.statecalc = async function () {
    var want = { order: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'].concat(H, ['KCALC']),
                 shown: ['V_AMT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS', 'KCALC'], num: true };
    R.chk.fromLink = /[?&]state=/.test(location.search) && !(window.penumbra_vars && window.penumbra_vars.preloadedState);
    R.chk.layout = layoutIs(want);
    info({ want: want });
  };
  // the Share button's ?state= link (unsaved work): with nothing to squeeze it carries the names (NEW); when the
  // sharer's filter would not fit beside them, the link goes without the names and the filter rides (GUARD: before
  // the names the filter always fitted here)
  S.sharefit = async function () {
    var LIMIT = 2000, cm = document.querySelector('.CodeMirror'), ed = cm && cm.CodeMirror;
    async function share() {
      window.__SHARE = null;
      $('#shareQuery').trigger('click');
      await until(function () { return !!window.__SHARE; }, 5000);
      return window.__SHARE;
    }
    var s1 = await share(), st1 = s1 && stateOfUrl(s1.url);
    R.chk.shareKeepsNames = !!st1 && J(st1.layoutColumnNames) === J(up(BASE)) && !/Left out to fit/.test(s1.note);
    // a filter (never applied: Share reads the box) and the longest query that leaves room for it WITHOUT the names
    var filter = 'V_NAME = "' + new Array(21).join('Alpha Bravo ') + '"';
    var piece = ('&search=' + encodeURIComponent(filter)).length;
    var seed = 11; function hex(n) { var s = ''; for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; s += (seed >> 16 & 15).toString(16); } return s; }
    var pad = hex(4000);
    function lens(n) {
      ed.setValue('SELECT * FROM LD_FIXTURE -- ' + pad.slice(0, n));
      var st = HC.build(); if (!st || st.__err) return null;
      var lean = {}; Object.keys(st).forEach(function (k) { if (k !== 'layoutColumnNames') lean[k] = st[k]; });
      var f = function (o) { return targetLen((location.pathname.split('/').pop() || 'index.php') + '?state=' + HC.compress(JSON.stringify(o))); };
      return { full: f(st), lean: f(lean), names: !!st.layoutColumnNames };
    }
    var lo = 0, hi = 4000, best = null;
    if (ed) {
      while (lo < hi) { var mid = (lo + hi + 1) >> 1, m = lens(mid); if (m && m.lean + piece <= LIMIT - 100) lo = mid; else hi = mid - 1; }
      best = lens(lo);
    }
    R.info.cal = { pad: lo, piece: piece, lens: best };
    R.chk.calibrated = !!best && best.lean + piece <= LIMIT - 100 && (!best.names || (best.full <= LIMIT && best.full + piece > LIMIT));
    $('#tableSearch').val(filter);
    var s2 = await share(), st2 = s2 && stateOfUrl(s2.url);
    R.chk.filterRides = !!s2 && /[?&]search=/.test(s2.url) && targetLen(s2.url) <= LIMIT && !/Left out to fit[^<]*filter/.test(s2.note);
    R.chk.leanWhenSqueezed = !!st2 && st2.layoutColumnNames === undefined && /LD_FIXTURE -- /.test(st2.query || '');
    R.info.share = { len1: s1 && targetLen(s1.url), len2: s2 && targetLen(s2.url), note2: s2 && String(s2.note).replace(/<[^>]+>/g, ' ').slice(0, 240) };
  };
  // a Run after the load keeps the layout it opened in (GUARD: the re-run's own by-name carry-over) - the saved one,
  // by name (NEW)
  S.requery = async function () {
    var before = snap();
    var rq = await requery(null, function () { return flatRows().length === 300 && !!document.querySelector('#tableHeader th'); });
    R.chk.kept = rq && J(snap()) === J(before);
    R.chk.byNameAfter = layoutIs(FRONT);
    info({ before: before });
  };
  // ?state= links: a link carries the names (NEW); a local save near the URL limit still saves - the names are the
  // first thing left out (GUARD: before the fix there were none); an encrypted local save never carries them (GUARD)
  S.urlfit = async function () {
    var LIMIT = 2000;
    var v1 = HC.viewUrl(), s1 = stateOfUrl(v1);
    R.chk.linkHasNames = !!s1 && J(s1.layoutColumnNames) === J(up(BASE));
    var u1 = await localSave('ldsmall'), ls1 = stateOfUrl(u1);
    R.chk.localHasNames = !!ls1 && J(ls1.layoutColumnNames) === J(up(BASE));
    // the longest query whose link fits WITHOUT the names (a pad of random hex the compressor cannot shrink)
    var cm = document.querySelector('.CodeMirror'), ed = cm && cm.CodeMirror;
    var seed = 7; function hex(n) { var s = ''; for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; s += (seed >> 16 & 15).toString(16); } return s; }
    var pad = hex(4000);
    function lens(n) {
      ed.setValue('SELECT * FROM LD_FIXTURE -- ' + pad.slice(0, n));
      var st = HC.build(); if (!st || st.__err) return null;
      var lean = {}; Object.keys(st).forEach(function (k) { if (k !== 'layoutColumnNames') lean[k] = st[k]; });
      var f = function (o) { return targetLen((location.pathname.split('/').pop() || 'index.php') + '?state=' + HC.compress(JSON.stringify(o))); };
      return { full: f(st), lean: f(lean), names: !!st.layoutColumnNames };
    }
    var lo = 0, hi = 4000, best = null;
    if (ed) {
      while (lo < hi) { var mid = (lo + hi + 1) >> 1, m = lens(mid); if (m && m.lean <= LIMIT - 3) lo = mid; else hi = mid - 1; }
      best = lens(lo);
    }
    R.info.cal = { pad: lo, lens: best };
    // on a build that writes the names, the near-limit state must be over the limit WITH them (else this proves nothing)
    R.chk.calibrated = !!best && best.lean <= LIMIT && (!best.names || best.full > LIMIT);
    // the Local Save tab's size guard measures the link the save will write
    var me2 = HC.measure();
    R.chk.nearMeasureFits = typeof me2 === 'number' && me2 <= LIMIT;
    R.info.measure = me2;
    var v2 = HC.viewUrl(), s2 = stateOfUrl(v2);
    R.chk.nearLinkFits = !!v2 && targetLen(v2) <= LIMIT && !!s2 && s2.layoutColumnNames === undefined && /LD_FIXTURE -- /.test(s2.query || '');
    var u2 = await localSave('ldnear'), ls2 = stateOfUrl(u2);
    R.chk.nearLocalSaves = !!u2 && targetLen(u2) <= LIMIT && !!ls2 && ls2.layoutColumnNames === undefined;
    // an encrypted local save of a short state: sealed without the names
    ed.setValue('SELECT * FROM LD_FIXTURE');
    var u3 = await localSave('ldenc', 'pw-ldlayout-1'), ls3 = stateOfUrl(u3), plain = null;
    try { if (ls3 && ls3.encrypted) plain = JSON.parse(await HC.decrypt('pw-ldlayout-1', ls3.content)); } catch (e) { plain = { __err: String(e) }; }
    R.chk.encryptedLean = !!plain && !plain.__err && Array.isArray(plain.columnOrder) && plain.layoutColumnNames === undefined;
    R.info.urls = { v1: targetLen(v1), u1: u1 && targetLen(u1), v2: v2 && targetLen(v2), u2: u2 && targetLen(u2), enc: !!(ls3 && ls3.encrypted), plainKeys: plain && Object.keys(plain).slice(0, 30),
                    status: String($('#localSaveStatus').text() || '').slice(0, 200) };
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
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
