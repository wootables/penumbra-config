// delimgroup suite - browser half (2026-10-26). Runs ONE scenario (?scn=) against whichever
// main.js / penumbra_colmenu.js the page loaded and publishes
//   window.__DGRESULT = { scn, asserts: [{id, ok, detail}], obs: {...} }, window.__DGDONE = true.
// Ground truth comes from the FIXTURE through this file's own copy of the split rule (pieces()
// below), never from main.js. Scenarios:
//   unit     the split rule, the token, the display label, which delimiters a column offers
//   render   the dialog's entries -> group by PI_LIST:dsemi -> bands, totals, shares, status bar,
//            the search, the counters, the summary preview, (Other), a custom order, the chart
//   nested   STATUS then PI_LIST:dsemi: sub-bands, shares, path totals under a search
//   menu     the header menu's Group by list (As is + buckets) and Copy distinct values' pipe
//   snippet  group_by|pi_list:dsemi from a trigger link
//   bucket   countMatchingRows' groups under a date bucket (AWARD_DATE:month)
(function () {
  var JG = window.__JG || {};
  var SCN = window.__SCN;
  var FX = window.__rowsFixture;
  var R = { scn: SCN, asserts: [], obs: {} };
  var NBSP = String.fromCharCode(160);
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail).slice(0, 700) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JG_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function S(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  function fn(name) { return typeof JG[name] === 'function' ? JG[name] : null; }
  function colId(name) { return String(window.__COLS.indexOf(name)); }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function gth(name) { return document.querySelector('#groupedResultsContainer table thead th[data-colname="' + name + '"]'); }
  function sameSet(a, b) { a = a.slice().sort(); b = b.slice().sort(); return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  function near(a, b) { return Math.abs(Number(a) - Number(b)) < 0.005; }

  // ---- the ground truth: the split rule, written out again -------------------------
  function pieces(raw, ch) {
    var s = String(raw == null ? '' : raw);
    if (s.substring(0, 6) === '@@HTML') s = s.substring(6);
    s = s.replace(/<[^>]*>/g, '');
    var parts = ch === 'nl' ? s.split(/\r\n|\r|\n/) : ch === 'space' ? s.split(/ +/) : s.split(ch);
    var out = [];
    parts.forEach(function (p) {
      p = p.replace(/^[ \t\n\r\0\x0B]+/, '').replace(/[ \t\n\r\0\x0B]+$/, '');
      if (p !== '' && out.indexOf(p) < 0) out.push(p);
    });
    return out;
  }
  function keysOf(r) { var k = pieces(r.PI_LIST, ';'); return k.length ? k : ['[Blank]']; }
  // label -> [V_ID] for the rows given
  function expectBands(rows) {
    var w = Object.create(null);
    rows.forEach(function (r) { keysOf(r).forEach(function (k) { (w[k] = w[k] || []).push(r.V_ID); }); });
    return w;
  }
  function sumAmt(ids) { var t = 0; FX.forEach(function (r) { if (ids.indexOf(r.V_ID) >= 0) t += parseFloat(r.AMT); }); return Math.round(t * 100) / 100; }
  function rowById(id) { for (var i = 0; i < FX.length; i++) if (FX[i].V_ID === id) return FX[i]; return null; }

  // ---- the grouped view ---------------------------------------------------------------
  function idsIn(w) {
    var pos = -1, ths = w.querySelectorAll('table thead th');
    for (var i = 0; i < ths.length; i++) { if (ths[i].getAttribute('data-colname') === 'V_ID') { pos = i; break; } }
    return Array.prototype.map.call(w.querySelectorAll('tbody tr'), function (tr) {
      if (pos >= 0 && tr.cells[pos]) return tr.cells[pos].textContent.trim();
      var c = tr.querySelector('td[data-column="' + colId('V_ID') + '"]');
      return c ? c.textContent.trim() : '';
    });
  }
  function visIdsIn(w) {
    var all = Array.prototype.filter.call(w.querySelectorAll('tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); });
    var pos = -1, ths = w.querySelectorAll('table thead th');
    for (var i = 0; i < ths.length; i++) { if (ths[i].getAttribute('data-colname') === 'V_ID') { pos = i; break; } }
    return all.map(function (tr) { return pos >= 0 && tr.cells[pos] ? tr.cells[pos].textContent.trim() : ''; });
  }
  function bandsAt(depth, root) {
    return Array.prototype.filter.call((root || document).querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="' + depth + '"]'), function (w) {
      return !root || w.parentElement.closest('.group-wrapper') === root;
    });
  }
  function readBands(depth, root) {
    var out = Object.create(null);
    bandsAt(depth, root).forEach(function (w) { out[w.getAttribute('data-group-key')] = idsIn(w); });
    return out;
  }
  function bandsEqual(got, want) {
    var gk = Object.keys(got), wk = Object.keys(want), bad = [];
    if (!sameSet(gk, wk)) bad.push('keys got ' + S(gk.sort()) + ' want ' + S(wk.sort()));
    wk.forEach(function (k) { if (got[k] && !sameSet(got[k], want[k])) bad.push(k + ': got ' + got[k].length + ' rows ' + S(got[k].slice().sort()) + ' want ' + S(want[k].slice().sort())); });
    return bad;
  }
  function grouped() { return document.body.classList.contains('group-mode-active') && $('#groupedResultsContainer').is(':visible'); }
  function col0() { var w = bandsAt(0)[0]; return w ? w.getAttribute('data-group-col') : null; }
  async function groupedBy(tok) { return await until(function () { return grouped() && col0() === tok; }, 15000); }

  // ---- the dialog, driven ----------------------------------------------------------------
  function pickerItems(id) {
    return Array.prototype.map.call(document.querySelectorAll('#' + id + ' .pcs-dropdown .pcs-item'), function (el) {
      return { v: el.getAttribute('data-value'), t: el.firstChild ? el.firstChild.textContent : el.textContent, bucket: el.classList.contains('pcs-item-bucket') };
    });
  }
  function pickCustom(id, value) {
    var items = document.querySelectorAll('#' + id + ' .pcs-dropdown .pcs-item'), hit = null, seen = [];
    for (var i = 0; i < items.length; i++) { seen.push(items[i].getAttribute('data-value')); if (items[i].getAttribute('data-value') === value) hit = items[i]; }
    if (!hit) throw new Error('#' + id + ' offers no "' + value + '" (offers: ' + seen.join(', ') + ')');
    clickEl(document.querySelector('#' + id + ' .pcs-selected'));
    clickEl(hit);
    var got = $('#' + id + ' .pcs-selected').attr('data-value');
    if (got !== value) throw new Error('#' + id + ' holds "' + got + '" after picking "' + value + '"');
  }
  // (grpbucket) each level's second dropdown: #groupingBucket1..3, built by main.js beside the column picker
  function bucketSel(level) { return document.getElementById('groupingBucket' + level); }
  function bucketOpts(level) { var s = bucketSel(level); return (s && s.style.display !== 'none') ? Array.prototype.map.call(s.options, function (o) { return o.value; }) : null; }
  function pickBucket(level, sx) {
    var s = bucketSel(level);
    if (!s || s.style.display === 'none') throw new Error('#groupingBucket' + level + ' is not shown');
    if (!Array.prototype.some.call(s.options, function (o) { return o.value === sx; })) throw new Error('#groupingBucket' + level + ' offers no "' + sx + '" (offers ' + S(bucketOpts(level)) + ')');
    s.value = sx;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function pickVal(id) { return $('#' + id + ' .pcs-selected').attr('data-value'); }
  function pickTxt(id) { return $('#' + id + ' .pcs-selected').text(); }
  async function openDialog() {
    clickEl(document.getElementById('groupTableBtn'));
    return await until(function () { return document.querySelectorAll('#groupingColumnSelector .pcs-dropdown .pcs-item').length > 0; }, 8000);
  }
  async function withSummary() {
    var cb = document.getElementById('groupAggCheckbox');
    if (!cb.checked) { cb.checked = true; $(cb).trigger('change'); }
    await sleep(50);
    pickCustom('groupAggColumn', 'AMT');
    $('#groupAggType').val('sum').trigger('change');
  }
  async function apply(tok) {
    clickEl(document.getElementById('confirmGroupingBtn'));
    var ok = await groupedBy(tok);
    await sleep(400);
    return ok;
  }
  async function search(q) {
    $('#tableSearch').val(q);
    if (fn('runTableSearch')) await JG.runTableSearch();
    await sleep(400);
  }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(500);
  }
  function premise() {
    var n = document.querySelectorAll('#resultsTable tbody tr').length;
    var ok = n === 60 && FX.length === 60 && !!fth('PI_LIST') && !!fth('AWARD_DATE');
    rec('P-' + SCN, ok, 'rows ' + n + '; fixture ' + FX.length + '; PI_LIST row 7 ' + S(FX[6].PI_LIST));
  }

  // ======================================================================== scenarios
  async function scnUnit() {
    // U-pieces: the split rule (the same cases go to the runner's twin in run.py's PHP pass)
    var P = fn('groupDelimPieces'), cases = window.__PIECE_CASES || [];
    var bad = [];
    if (!P) bad.push('groupDelimPieces missing');
    else cases.forEach(function (c) { var got = P(c[0], c[1]); if (S(got) !== S(c[2])) bad.push(S(c) + ' -> ' + S(got)); });
    rec('U-pieces', P && !bad.length, bad.join(' | ') || (cases.length + ' cases'));
    // U-parse: the token
    var T = fn('pivotParseFieldToken'), t1 = T ? T('PI_LIST:dsemi') : {}, t2 = T ? T('pi_list:DSEMI') : {}, t3 = T ? T('PI_LIST:dsemi:fill') : {}, t4 = T ? T('A:B') : {};
    var t5 = T ? T('AWARD_DATE:fy') : {};
    rec('U-parse', t1.base === 'PI_LIST' && t1.delim === 'dsemi' && t1.split === null && t2.delim === 'dsemi' && t2.base === 'pi_list'
      && t3.base === 'PI_LIST:dsemi:fill' && !t3.delim && t4.base === 'A:B' && !t4.delim && t5.split === 'fy' && !t5.delim,
      S([t1, t2, t3, t4, t5]));
    var L = fn('pivotFieldDisplayLabel');
    var labs = L ? [L('PI_LIST:dsemi'), L('NOTES:dnl'), L('TAGS:dspace'), L('X:dtab'), L('KW:dcomma'), L('Y:dpipe'), L('AWARD_DATE:fy')] : [];
    rec('U-label', S(labs) === S(['PI_LIST (split by ;)', 'NOTES (split by new line)', 'TAGS (split by space)', 'X (split by tab)', 'KW (split by ,)', 'Y (split by |)', 'AWARD_DATE (Fiscal Year)']), S(labs));
    // U-spec: the bucket spec a split level hands the renderer
    var B = fn('groupBucketSpec'), sp = B ? B('PI_LIST:dsemi') : null;
    rec('U-spec', !!sp && sp.multi === true && sp.base === 'PI_LIST' && S(sp.labels('a;b;a')) === S(['a', 'b']) && !!sp.split, sp ? S({ base: sp.base, split: sp.split, multi: sp.multi }) : 'null');
    // U-detect: which delimiters each column offers
    var D = fn('_groupDelimVariantsFor'), off = {};
    window.__COLS.forEach(function (c) { off[c] = D ? D(c).map(function (v) { return v.id; }) : null; });
    R.obs.offers = off;
    rec('U-detect', !!D && S(off.PI_LIST) === S(['dsemi']) && S(off.KW) === S(['dcomma']) && S(off.TAGS) === S(['dspace']) && S(off.NOTES) === S(['dnl'])
      && S(off.TEAM) === S(['dsemi']) && S(off.LEADS) === S(['dsemi']) && S(off.MEMO) === '[]' && S(off.PERSON) === '[]' && S(off.STATUS) === '[]' && S(off.V_ID) === '[]' && S(off.AMT) === '[]' && S(off.AWARD_DATE) === '[]', S(off));
    // U-variants: the dialog's entries for a list column and a date column
    var V = fn('_groupBucketVariantsFor'), vp = V ? V('PI_LIST') : [], vd = V ? V('AWARD_DATE') : [];
    var wantN = Object.keys(expectBands(FX)).filter(function (k) { return k !== '[Blank]'; }).length;
    rec('U-variants', vp.length === 1 && vp[0].token === 'PI_LIST:dsemi' && vp[0].label === 'Split by ;' && vp[0].ex === wantN + ' values'
      && vd.some(function (v) { return v.token === 'AWARD_DATE:fy'; }) && !vd.some(function (v) { return v.delim; }), S(vp) + ' / ' + S(vd.map(function (v) { return v.token; })));
  }

  async function scnRender() {
    // ---- the dialog's entries
    var opened = await openDialog();
    var items = pickerItems('groupingColumnSelector');
    // (grpbucket) the column list holds columns only; a column's buckets are the dropdown beside it
    var inList = items.filter(function (x) { return (x.v || '').indexOf(':') >= 0 || x.bucket; }).map(function (x) { return x.v; });
    var offers = {}, offErr = null;
    ['PI_LIST', 'KW', 'TAGS', 'NOTES', 'TEAM', 'STATUS', 'AWARD_DATE'].forEach(function (c) {
      try { pickCustom('groupingColumnSelector', c); offers[c] = bucketOpts(1); } catch (e) { offErr = String(e.message); }
    });
    R.obs.bucketOffers = offers;
    rec('G-picker', opened && !offErr && !inList.length && S(offers.PI_LIST) === S(['', ':dsemi']) && S(offers.KW) === S(['', ':dcomma'])
      && S(offers.TAGS) === S(['', ':dspace']) && S(offers.NOTES) === S(['', ':dnl']) && S(offers.TEAM) === S(['', ':dsemi'])
      && offers.STATUS === null && !!offers.AWARD_DATE && offers.AWARD_DATE.indexOf(':fy') > 0,
      'in the column list: ' + S(inList) + '; offers ' + S(offers) + (offErr ? '; ' + offErr : ''));
    // the second dropdown follows the first: a column with no buckets hides it, another column starts As is
    var picked = true, a = {}, b = {}, c = {}, d = {};
    try {
      pickCustom('groupingColumnSelector', 'PI_LIST'); pickBucket(1, ':dsemi');
      var s1 = bucketSel(1);
      a = { v: pickVal('groupingColumnSelector'), t: pickTxt('groupingColumnSelector'), s: s1.value, o: s1.options[s1.selectedIndex].text };
      pickCustom('groupingColumnSelector', 'STATUS');
      b = { v: pickVal('groupingColumnSelector'), hidden: bucketOpts(1) === null };
      pickCustom('groupingColumnSelector', 'PI_LIST');
      c = { v: pickVal('groupingColumnSelector'), s: bucketSel(1).value };
      pickBucket(1, ':dsemi');
      d = { v: pickVal('groupingColumnSelector'), t: pickTxt('groupingColumnSelector') };
    } catch (e) { picked = false; R.obs.pickErr = String(e.message); }
    rec('G-closed', picked && a.v === 'PI_LIST:dsemi' && a.t === 'PI_LIST' && a.s === ':dsemi' && /^Split by ;/.test(a.o) && d.v === 'PI_LIST:dsemi' && d.t === 'PI_LIST',
      S([a, d]) + (R.obs.pickErr ? ' ' + R.obs.pickErr : ''));
    rec('G-follow', picked && b.v === 'STATUS' && b.hidden === true && c.v === 'PI_LIST' && c.s === '', S([b, c]));
    try { await withSummary(); } catch (e) { R.obs.aggErr = String(e.message); }
    var applied = picked && await apply('PI_LIST:dsemi');
    // ---- the bands
    var want = expectBands(FX), got = readBands(0);
    var bad = bandsEqual(got, want);
    R.obs.bands = got;
    rec('G-bands', applied && !bad.length, applied ? (bad.join(' | ') || Object.keys(got).length + ' bands') : 'not grouped by PI_LIST:dsemi (col0 ' + col0() + ')');
    function inBands(id) { return Object.keys(got).filter(function (k) { return got[k].indexOf(id) >= 0; }).sort(); }
    rec('G-rows', S(inBands('ID-1023')) === S(['Jones, Bo', 'Lee, Cy', 'Smith, Ann']) && S(inBands('ID-1007')) === S(['Kim, Di', 'Lee, Cy'])
      && S(inBands('ID-1013')) === S(['Kim, Di']) && S(inBands('ID-1017')) === S(['Jones, Bo', 'Smith, Ann']) && S(inBands('ID-1010')) === S(['[Blank]'])
      && (got['Smith, Ann'] || []).filter(function (x) { return x === 'ID-1017'; }).length === 1,
      '1023 ' + S(inBands('ID-1023')) + ' 1007 ' + S(inBands('ID-1007')) + ' 1013 ' + S(inBands('ID-1013')) + ' 1017 ' + S(inBands('ID-1017')) + ' 1010 ' + S(inBands('ID-1010')));
    rec('G-nohide', applied && bandsAt(0).every(function (w) { return !w.querySelector(':scope > .group-header .group-hide'); }), bandsAt(0).length + ' bands');
    // ---- totals: each row once in "All groups", each band its own rows
    var bar = document.querySelector('#groupedResultsContainer > .group-grand-total');
    var barN = bar ? bar.querySelector('.group-count').textContent.trim() : null, barV = bar ? bar.getAttribute('data-agg-value') : null;
    var allIds = FX.map(function (r) { return r.V_ID; });
    rec('G-total', barN === '60' && near(barV, sumAmt(allIds)), 'bar count ' + barN + ' value ' + barV + ' want 60 / ' + sumAmt(allIds));
    var sumBad = [];
    bandsAt(0).forEach(function (w) { var k = w.getAttribute('data-group-key'); if (!near(w.getAttribute('data-agg-value'), sumAmt(want[k] || []))) sumBad.push(k + ' ' + w.getAttribute('data-agg-value') + ' want ' + sumAmt(want[k] || [])); });
    rec('G-bandsum', applied && !sumBad.length, sumBad.join(' | ') || 'ok');
    var shares = Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-agg-share'), function (s) { return s.textContent; });
    rec('G-shares', applied && shares.length === 0, S(shares.slice(0, 6)));
    var rc = $('#resultCount').text();
    rec('G-status', rc.indexOf('60 total rows, in ' + Object.keys(want).length + ' groups') >= 0, rc);
    // ---- the chart from this grouping: split too (splitviz), with a notice that the bars count listings
    var gv = fn('groupsToVizConfig') ? JG.groupsToVizConfig() : null;
    rec('C-viz', !!gv && gv.config && gv.config.xAxis === 'PI_LIST:dsemi' && (gv.warnings || []).some(function (w) { return /^PI_LIST \(split by ;\): a row counts once under each value its cell lists, so the bars add up to more than the rows\.$/.test(w); }),
      gv ? S({ x: gv.config.xAxis, w: gv.warnings }) : 'null');
    // ---- the summary preview: groups whose sum clears a threshold, their rows once
    var sums = Object.keys(want).map(function (k) { return sumAmt(want[k]); }).sort(function (a, b) { return a - b; });
    var thr = Math.floor(sums[Math.floor(sums.length / 2)]);
    var lab = fn('getGroupSummaryLabel') ? JG.getGroupSummaryLabel() : 'Sum of AMT';
    var pv = fn('_previewGroupedAggMatch') ? JG._previewGroupedAggMatch(lab + ' > ' + thr) : null;
    var mk = Object.keys(want).filter(function (k) { return sumAmt(want[k]) > thr; }), mrows = [];
    mk.forEach(function (k) { want[k].forEach(function (id) { if (mrows.indexOf(id) < 0) mrows.push(id); }); });
    rec('G-preview', !!pv && pv.groups === mk.length && pv.matching === mrows.length, S(pv) + ' want groups ' + mk.length + ' rows ' + mrows.length + ' (' + lab + ' > ' + thr + ')');
    // ---- a search: the pills, the status bar, the counter
    await search('STATUS = Open');
    var open = FX.filter(function (r) { return r.STATUS === 'Open'; }), wantO = expectBands(open);
    var pillBad = [];
    bandsAt(0).forEach(function (w) {
      var k = w.getAttribute('data-group-key'), x = (wantO[k] || []).length, y = (want[k] || []).length;
      var txt = w.querySelector(':scope > .group-header .group-count').textContent.trim();
      if (x > 0 && txt !== x + ' of ' + y) pillBad.push(k + ' "' + txt + '" want "' + x + ' of ' + y + '"');
      if (x > 0 && !sameSet(visIdsIn(w), wantO[k])) pillBad.push(k + ' shows ' + S(visIdsIn(w)));
    });
    rec('G-searchpills', applied && !pillBad.length, pillBad.join(' | ') || 'ok');
    rc = $('#resultCount').text();
    rec('G-searchstatus', rc.indexOf('with ' + open.length + ' filtered results in ' + Object.keys(wantO).length + ' of ' + Object.keys(want).length + ' groups') >= 0, rc + ' (want ' + open.length + ' rows, ' + Object.keys(wantO).length + ' groups)');
    var cm = window._penumbraSearchAPI && window._penumbraSearchAPI.countMatchingRows ? window._penumbraSearchAPI.countMatchingRows('STATUS = Open') : null;
    rec('K-count', !!cm && cm.matching === open.length && cm.groups === Object.keys(wantO).length, S(cm) + ' want ' + open.length + ' / ' + Object.keys(wantO).length);
    await search('');
    // ---- the top 2 and (Other): each row of the dropped groups once
    await openDialog();
    $('#groupLimitN').val('2').trigger('input').trigger('change');
    $('#groupLimitOther').prop('checked', true).trigger('change');
    await apply('PI_LIST:dsemi');
    await until(function () { return !!document.querySelector('#groupedResultsContainer .group-wrapper[data-group-other]'); }, 5000);
    var order = Object.keys(want).sort(function (a, b) { return a.localeCompare(b); });
    var dropped = order.slice(2), otherWant = [];
    dropped.forEach(function (k) { want[k].forEach(function (id) { if (otherWant.indexOf(id) < 0) otherWant.push(id); }); });
    var ow = document.querySelector('#groupedResultsContainer .group-wrapper[data-group-other]');
    var oIds = ow ? idsIn(ow) : [];
    rec('G-other', !!ow && sameSet(oIds, otherWant) && S(Object.keys(readBands(0)).filter(function (k) { return k !== '(Other)'; })) === S(order.slice(0, 2)),
      'other ' + oIds.length + ' rows (want ' + otherWant.length + ' distinct of ' + dropped.reduce(function (n, k) { return n + want[k].length; }, 0) + ' memberships); kept ' + S(Object.keys(readBands(0))));
    // ---- a custom order on the column orders its values
    await openDialog();
    $('#groupLimitN').val('').trigger('input').trigger('change');
    if (fn('setCso')) JG.setCso({ PI_LIST: { values: ['Park, Ed', 'Ng, Flo', 'Smith, Ann'] } });
    await apply('PI_LIST:dsemi');
    await until(function () { return !document.querySelector('#groupedResultsContainer .group-wrapper[data-group-other]'); }, 5000);
    var firstThree = bandsAt(0).slice(0, 3).map(function (w) { return w.getAttribute('data-group-key'); });
    rec('G-csort', S(firstThree) === S(['Park, Ed', 'Ng, Flo', 'Smith, Ann']), S(firstThree));
    if (fn('setCso')) JG.setCso({});
    R.obs.fixture = FX;
  }

  async function scnNested() {
    await openDialog();
    var ok = true;
    try {
      pickCustom('groupingColumnSelector', 'STATUS');
      await until(function () { return $('#groupLevel2Row').is(':visible'); }, 3000);
      pickCustom('groupingColumnSelector2', 'PI_LIST');
      pickBucket(2, ':dsemi');
      await withSummary();
    } catch (e) { ok = false; R.obs.nestErr = String(e.message); }
    var applied = ok && await apply('STATUS');
    var bad = [], exp = {};
    bandsAt(0).forEach(function (b) {
      var st = b.getAttribute('data-group-key');
      var w = expectBands(FX.filter(function (r) { return r.STATUS === st; }));
      exp[st] = w;
      bandsEqual(readBands(1, b), w).forEach(function (x) { bad.push(st + ' > ' + x); });
    });
    R.obs.nested = {};
    bandsAt(0).forEach(function (b) { R.obs.nested[b.getAttribute('data-group-key')] = readBands(1, b); });
    rec('N-bands', applied && bandsAt(0).length === 3 && !bad.length, applied ? (bad.join(' | ') || 'ok') : 'not grouped (' + R.obs.nestErr + ')');
    var shBad = [];
    bandsAt(0).forEach(function (b) {
      var t = (b.querySelector(':scope > .group-header .group-agg-share') || {}).textContent || '';
      if (!/of total/.test(t) || /of parent/.test(t)) shBad.push('depth 0 ' + b.getAttribute('data-group-key') + ' "' + t + '"');
    });
    bandsAt(1).forEach(function (b) { var s = b.querySelector(':scope > .group-header .group-agg-share'); if (s) shBad.push('depth 1 ' + b.getAttribute('data-group-key') + ' "' + s.textContent + '"'); });
    rec('N-shares', applied && !shBad.length, shBad.slice(0, 5).join(' | ') || 'ok');
    var bar = document.querySelector('#groupedResultsContainer > .group-grand-total');
    var barN = bar ? bar.querySelector('.group-count').textContent.trim() : null;
    rec('N-total', barN === '60' && near(bar.getAttribute('data-agg-value'), sumAmt(FX.map(function (r) { return r.V_ID; }))), 'bar ' + barN);
    var rc = $('#resultCount').text();
    rec('N-status', rc.indexOf('60 total rows, in 3 groups') >= 0, rc);
    // (xlsxfoot) the browser's XLSX outline sheet: rows listed under each group, the last row the All groups bar
    var xb = { err: null };
    try {
      var wb = fn('createXlsxWorkbook') ? await JG.createXlsxWorkbook(false) : null;
      var ws = wb ? wb.getWorksheet('Grouped Data') : null;
      xb.sheet = !!ws;
      if (ws) {
        var lr = ws.getRow(ws.rowCount);
        xb.last = String(lr.getCell(1).value == null ? '' : lr.getCell(1).value);
        xb.listed = 0;
        // data rows (a V_ID cell), not a group's own footer row at the same level
        ws.eachRow(function (r) { if (r.outlineLevel === 2 && (r.values || []).some(function (v) { return /^ID-1[0-9]{3}$/.test(String(v)); })) xb.listed++; });
      }
    } catch (e) { xb.err = String(e && e.message || e); }
    var barTxt = bar ? bar.textContent.replace(/\s+/g, ' ').trim() : null, memb = 0;
    Object.keys(exp).forEach(function (st) { Object.keys(exp[st]).forEach(function (k) { memb += exp[st][k].length; }); });
    rec('B-xlsx', !xb.err && xb.sheet && xb.last === barTxt && /^All groups ?60/.test(xb.last) && xb.listed === memb,
      S(xb) + ' bar ' + S(barTxt) + ' memberships ' + memb);
    // path totals: the inner pills read "x of y" under a search, y = the path's unfiltered rows
    await search('AMT > 2500');
    var pBad = [];
    bandsAt(0).forEach(function (b) {
      var st = b.getAttribute('data-group-key');
      var wf = expectBands(FX.filter(function (r) { return r.STATUS === st && parseFloat(r.AMT) > 2500; }));
      bandsAt(1, b).forEach(function (w) {
        var k = w.getAttribute('data-group-key'), x = (wf[k] || []).length, y = (exp[st][k] || []).length;
        if (!x) return;
        var txt = w.querySelector(':scope > .group-header .group-count').textContent.trim();
        if (txt !== x + ' of ' + y) pBad.push(st + ' > ' + k + ' "' + txt + '" want "' + x + ' of ' + y + '"');
      });
    });
    rec('N-path', applied && !pBad.length, pBad.slice(0, 5).join(' | ') || 'ok');
    await search('');
  }

  // ---- the header menu -------------------------------------------------------------------
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function panelsAll() { return Array.prototype.slice.call(document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function item(act) { var ps = panelsAll(); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function subPanel() { var s = document.querySelectorAll('.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function subActs() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function subLabels() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item .pnb-hm-label'), function (e) { return e.textContent; }) : []; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll(':scope .pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function label(el) { var l = el && el.querySelector('.pnb-hm-label'); return l ? l.textContent : (el ? el.textContent : ''); }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }

  async function scnMenu() {
    var cm = !!(window.Penumbra && window.Penumbra.colMenu);
    // Copy distinct values: a pipe beside the other delimiters
    closeMenu(); rclick(fth('STATUS'));
    if (item('copyMenu')) item('copyMenu').click();   // (2026-10-27, copymenu) the copies are one list, Copy
    if (item('copy')) item('copy').click();
    await sleep(100);
    var cacts = subActs(), cp = item('copy-pipe');
    var seen = [];
    FX.forEach(function (r) { if (seen.indexOf(r.STATUS) < 0) seen.push(r.STATUS); });
    var before = window.__clip.length;
    if (cp) cp.click();
    await sleep(600);
    var clip = window.__clip.length > before ? window.__clip[window.__clip.length - 1] : null;
    rec('H-pipe', cm && !!cp && label(cp) === 'A pipe' && cacts.indexOf('copy-semicolon') >= 0 && cacts.indexOf('copy-pipe') === cacts.indexOf('copy-semicolon') + 1
      && clip !== null && sameSet(clip.split('|'), seen) && clip.indexOf('|') > 0, S(cacts) + ' clip ' + S(clip));
    // a list column: Group by is a list, As is first, its split after it
    closeMenu(); rclick(fth('PI_LIST'));
    var gl = item('groupByList'), top = acts();
    var listOk = !!gl && gl.getAttribute('aria-haspopup') !== null && label(gl) === 'Group by this column' && top.indexOf('groupBy') < 0;
    if (gl) gl.click();
    await sleep(100);
    var sa = subActs(), sl = subLabels();
    rec('H-list', listOk && S(sa) === S(['groupBy', 'groupAs-dsemi']) && S(sl) === S(['As is', 'Split by ;']), S(top.filter(function (a) { return /group/i.test(a); })) + ' / ' + S(sa) + ' ' + S(sl));
    var gs = item('groupAs-dsemi');
    if (gs) gs.click();
    var g1 = await groupedBy('PI_LIST:dsemi');
    rec('H-split', g1 && Object.keys(readBands(0)).length === Object.keys(expectBands(FX)).length, 'col0 ' + col0());
    // grouped by it: the same list, the split ticked; As is regroups the column as it is
    await sleep(300);
    closeMenu(); rclick(gth('PI_LIST'));
    var gl2 = item('groupByList');
    if (gl2) gl2.click();
    await sleep(100);
    var asIs = item('groupBy'), sp2 = item('groupAs-dsemi');
    rec('H-tick', !!gl2 && label(gl2) === 'Group by this column' && !!sp2 && sp2.getAttribute('aria-checked') === 'true' && !!asIs && asIs.getAttribute('aria-checked') === 'false',
      gl2 ? label(gl2) + ' ' + (sp2 && sp2.getAttribute('aria-checked')) + ' ' + (asIs && asIs.getAttribute('aria-checked')) : 'no list');
    if (asIs) asIs.click();
    var g2 = await groupedBy('PI_LIST');
    rec('H-asis', g2, 'col0 ' + col0());
    // a plain column keeps the plain item; a date column lists its periods
    await sleep(300);
    closeMenu(); rclick(gth('STATUS') || fth('STATUS'));
    var pl = item('groupBy');
    rec('H-plain', !!pl && !item('groupByList') && /Group by this column/.test(label(pl)) && pl.getAttribute('aria-haspopup') === null, pl ? label(pl) : 'none: ' + S(acts()));
    closeMenu(); rclick(gth('AWARD_DATE') || fth('AWARD_DATE'));
    var dl = item('groupByList');
    if (dl) dl.click();
    await sleep(100);
    var da = subActs(), dlab = subLabels();
    rec('H-date', !!dl && da[0] === 'groupBy' && da.indexOf('groupAs-fy') > 0 && dlab[0] === 'As is' && dlab.indexOf('By Fiscal Year') > 0 && !da.some(function (a) { return /^groupAs-d(semi|pipe|comma|tab|nl|space)$/.test(a); }),
      S(da) + ' ' + S(dlab));
    closeMenu();
  }

  async function scnSnippet() {
    var a = $('<a class="snippet-action" data-action-name="trigger"></a>').attr('data-action-value', 'group_by|pi_list:dsemi');
    $('#reportSnippetOutput').append(a); a.trigger('click'); a.remove();
    var g = await groupedBy('PI_LIST:dsemi');
    var bad = g ? bandsEqual(readBands(0), expectBands(FX)) : ['not grouped (col0 ' + col0() + ')'];
    rec('K-snippet', g && !bad.length, bad.join(' | ') || 'ok');
  }

  // ---- json (2026-10-26, jsontot): a nested @@JSON grouping counts each row once --------------
  function subsOf(r) {
    var out = [];
    try { JSON.parse(String(r.J_SUBS).substring(6)).forEach(function (x) { var k = String(x.SUB_NAME).trim() || '[Blank]'; if (out.indexOf(k) < 0) out.push(k); }); } catch (e) { }
    return out.length ? out : ['[Blank]'];
  }
  function expectSubs(rows) {
    var w = Object.create(null);
    rows.forEach(function (r) { subsOf(r).forEach(function (k) { (w[k] = w[k] || []).push(r.V_ID); }); });
    return w;
  }
  async function scnJson() {
    await openDialog();
    var picked = true;
    try { pickCustom('groupingColumnSelector', 'SUB_NAME'); await withSummary(); } catch (e) { picked = false; R.obs.jsonErr = String(e.message); }
    var applied = picked && await apply('SUB_NAME');
    var want = expectSubs(FX), got = readBands(0), bad = bandsEqual(got, want);
    R.obs.jbands = got;
    R.obs.jfixture = FX;
    // the premise: the nested grouping itself (unchanged by the round) - a row under each of its nested names
    rec('P-jbands', applied && !bad.length && Object.keys(want).some(function (k) { return want[k].length > 0; })
      && FX.some(function (r) { return subsOf(r).length > 1; }), applied ? (bad.join(' | ') || Object.keys(got).length + ' bands') : 'not grouped (' + R.obs.jsonErr + ')');
    var all = FX.map(function (r) { return r.V_ID; }), memb = 0;
    Object.keys(want).forEach(function (k) { memb += want[k].length; });
    var bar = document.querySelector('#groupedResultsContainer > .group-grand-total');
    var barN = bar ? bar.querySelector('.group-count').textContent.trim() : null;
    rec('J-total', barN === '60' && near(bar.getAttribute('data-agg-value'), sumAmt(all)), 'bar count ' + barN + ' value ' + (bar && bar.getAttribute('data-agg-value')) + ' want 60 / ' + sumAmt(all) + ' (memberships ' + memb + ')');
    var shares = Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-agg-share'), function (s) { return s.textContent; });
    rec('J-shares', applied && shares.length === 0, S(shares.slice(0, 5)));
    var rc = $('#resultCount').text();
    rec('J-status', rc.indexOf('60 total rows, in ' + Object.keys(want).length + ' groups') >= 0, rc + ' (memberships ' + memb + ')');
    // the summary preview: the rows of the groups whose sum clears a threshold, each once
    var sums = Object.keys(want).map(function (k) { return sumAmt(want[k]); }).sort(function (a, b) { return a - b; });
    var thr = Math.floor(sums[Math.floor(sums.length / 2)]);
    var lab = fn('getGroupSummaryLabel') ? JG.getGroupSummaryLabel() : 'Sum of AMT';
    var pv = fn('_previewGroupedAggMatch') ? JG._previewGroupedAggMatch(lab + ' > ' + thr) : null;
    var mk = Object.keys(want).filter(function (k) { return sumAmt(want[k]) > thr; }), mrows = [];
    mk.forEach(function (k) { want[k].forEach(function (id) { if (mrows.indexOf(id) < 0) mrows.push(id); }); });
    rec('J-preview', !!pv && pv.groups === mk.length && pv.matching === mrows.length, S(pv) + ' want groups ' + mk.length + ' rows ' + mrows.length);
    // a search: the status bar and the counter count each matching row once
    await search('STATUS = Open');
    var open = FX.filter(function (r) { return r.STATUS === 'Open'; }), wantO = expectSubs(open);
    rc = $('#resultCount').text();
    rec('J-searchstatus', rc.indexOf('with ' + open.length + ' filtered results in ' + Object.keys(wantO).length + ' of ' + Object.keys(want).length + ' groups') >= 0, rc + ' (want ' + open.length + ' rows)');
    var cm = window._penumbraSearchAPI && window._penumbraSearchAPI.countMatchingRows ? window._penumbraSearchAPI.countMatchingRows('STATUS = Open') : null;
    rec('K-jcount', !!cm && cm.matching === open.length && cm.groups === Object.keys(wantO).length, S(cm) + ' want ' + open.length + ' / ' + Object.keys(wantO).length);
    await search('');
    // the top 2 and (Other): each row of the dropped groups once
    await openDialog();
    $('#groupLimitN').val('2').trigger('input').trigger('change');
    $('#groupLimitOther').prop('checked', true).trigger('change');
    await apply('SUB_NAME');
    await until(function () { return !!document.querySelector('#groupedResultsContainer .group-wrapper[data-group-other]'); }, 5000);
    var order = Object.keys(want).sort(function (a, b) { return a.localeCompare(b); }), otherWant = [];
    order.slice(2).forEach(function (k) { want[k].forEach(function (id) { if (otherWant.indexOf(id) < 0) otherWant.push(id); }); });
    var ow = document.querySelector('#groupedResultsContainer .group-wrapper[data-group-other]'), oIds = ow ? idsIn(ow) : [];
    rec('J-other', !!ow && sameSet(oIds, otherWant), 'other ' + oIds.length + ' rows, want ' + otherWant.length + ' distinct');
  }

  async function scnBucket() {
    window.Penumbra.groupByColumn('AWARD_DATE:month');
    var g = await groupedBy('AWARD_DATE:month');
    var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var open = FX.filter(function (r) { return r.STATUS === 'Open'; }), months = [];
    open.forEach(function (r) { var m = MO[parseInt(r.AWARD_DATE.substring(5, 7), 10) - 1]; if (months.indexOf(m) < 0) months.push(m); });
    var cm = window._penumbraSearchAPI.countMatchingRows('STATUS = Open');
    rec('K-bucket', g && cm.matching === open.length && cm.groups === months.length, S(cm) + ' want ' + open.length + ' rows in ' + months.length + ' months');
    // (grpbucket) reopening the dialog on a token shows the column alone and the bucket beside it - a token the list
    // holds (AWARD_DATE:month) and one it does not (AMT:bin1000, a fixed width)
    await openDialog();
    var r1 = { v: pickVal('groupingColumnSelector'), t: pickTxt('groupingColumnSelector'), s: bucketSel(1) && bucketSel(1).value, opts: bucketOpts(1) };
    window.Penumbra.groupByColumn('AMT:bin1000');
    var g2 = await groupedBy('AMT:bin1000');
    await openDialog();
    var s2 = bucketSel(1);
    var r2 = { v: pickVal('groupingColumnSelector'), t: pickTxt('groupingColumnSelector'), s: s2 && s2.value, o: s2 && s2.selectedIndex >= 0 ? s2.options[s2.selectedIndex].text : null };
    rec('G-reopen', r1.v === 'AWARD_DATE:month' && r1.t === 'AWARD_DATE' && r1.s === ':month' && !!r1.opts && r1.opts[0] === '', S(r1));
    rec('G-reopenbin', g2 && r2.v === 'AMT:bin1000' && r2.t === 'AMT' && r2.s === ':bin1000' && /^Bins of 1,000/.test(r2.o || ''), S(r2));
  }

  // ======================================================================== splitviz (2026-10-26)
  // A chart, the filter strip, Column stats and Copy distinct values split a list column; the list rule's fixes.
  // Ground truth: the fixture through this file's own split rule (pieces(), entities decoded by dec() where the
  // column holds them) - never main.js.
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function dec(t) {
    return String(t).replace(/&(amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-fA-F]+));/g, function (m, nm, d, h) {
      return d ? String.fromCharCode(+d) : h ? String.fromCharCode(parseInt(h, 16)) : (ENT[nm] || m);
    });
  }
  // the list-item condition, written out by hand: the separator or the cell's edge on each side
  var WS = '[ \\t\\n\\r\\x0B]*';
  var SEPS = { dsemi: ';', dcomma: ',', dpipe: '\\|', dtab: '\\t', dnl: '[\\r\\n]', dspace: ' ' };
  function esc(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\x2F'); }
  function itemQ(col, id, vals, ex) {
    return col + ' ' + (ex ? '!=' : '=') + ' /(?:^|' + SEPS[id] + ')' + WS + '(?:' + vals.map(esc).join('|') + ')' + WS + '(?:' + SEPS[id] + '|$)/';
  }
  function master() { return JG.master ? JG.master() : null; }
  function cleanLbl(v) { var s = String(v == null ? '' : v); if (s.substring(0, 6) === '@@HTML') s = s.substring(6); s = dec(s).replace(/<[^>]*>/g, '').trim(); return s || 'Unknown'; }
  function chartKeys(r) { var k = pieces(r.PI_LIST, ';'); return k.length ? k : ['Unknown']; }
  function tally(rows, keysOf2, valOf) {
    var w = Object.create(null);
    rows.forEach(function (r) { keysOf2(r).forEach(function (k) { w[k] = (w[k] || 0) + valOf(r); }); });
    return w;
  }
  function chartMap(d, di) {
    var m = Object.create(null), ds = d && d.datasets && d.datasets[di || 0];
    if (d && d.labels && ds) d.labels.forEach(function (l, i) { m[String(l)] = Number(ds.data[i]); });
    return m;
  }
  function sameMap(a, b) {
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return S(ka) === S(kb) && ka.every(function (k) { return near(a[k], b[k]); });
  }
  function idsOfMaps(ms) { return ms.map(function (m) { return m.get('V_ID'); }).sort(); }
  function idsWhere(pred) { return FX.filter(pred).map(function (r) { return r.V_ID; }).sort(); }
  // the browser's own search engine over the data rows (the query a click or a chip writes)
  function evalQ(q) {
    var M = master(), P = fn('parseAdvancedQuery'), E = fn('evaluateParsedQuery');
    if (!M || !P || !E) return null;
    var cols = Array.from(M[0].keys()), parsed = P(q, cols);
    return idsOfMaps(M.filter(function (m) { return E(m, parsed, cols); }));
  }
  function shownIds() {
    return Array.prototype.map.call(document.querySelectorAll('#resultsTable tbody tr:not(.search-hidden)'), function (tr) {
      var c = tr.querySelector('td[data-column="' + colId('V_ID') + '"]'); return c ? c.textContent.trim() : '';
    }).filter(Boolean).sort();
  }

  async function scnDetect() {
    var D = fn('_groupDelimVariantsFor'), V = fn('_groupBucketVariantsFor'), off = {};
    ['DEPT_ENT', 'TRANS', 'PROJS', 'TITLE_C', 'AMT_K', 'CODES', 'CODES_NL', 'CODES_SP', 'CODES_ONE'].forEach(function (c) { off[c] = D ? D(c).map(function (v) { return v.id; }) : null; });
    R.obs.offers = off;
    rec('D-entity', !!D && S(off.DEPT_ENT) === '[]', S(off.DEPT_ENT));
    rec('D-pair', !!D && S(off.TRANS) === '[]', S(off.TRANS));
    var vp = V ? V('PROJS').map(function (v) { return v.token; }) : null;
    rec('D-projects', !!D && S(off.PROJS) === S(['dcomma']) && S(vp) === S(['PROJS:dcomma']), S(off.PROJS) + ' / ' + S(vp));
    rec('D-titles', !!D && S(off.TITLE_C) === '[]', S(off.TITLE_C));
    rec('D-thousands', !!D && S(off.AMT_K) === '[]', S(off.AMT_K));
    // (sparse, 2026-10-27) a list few cells hold two values of: offered when those cells are packed (?id=dirsearch's
    // JOBCODES_ALL), a new line being its delimiter's own white space; not when spaced, nor for one list alone
    var vc = V ? V('CODES').map(function (v) { return v.token; }) : null;
    rec('D-packed', !!D && S(off.CODES) === S(['dpipe']) && S(vc) === S(['CODES:dpipe']), S(off.CODES) + ' / ' + S(vc));
    rec('D-packednl', !!D && S(off.CODES_NL) === S(['dnl']), S(off.CODES_NL));
    rec('D-spaced', !!D && S(off.CODES_SP) === '[]', S(off.CODES_SP));
    rec('D-onelist', !!D && S(off.CODES_ONE) === '[]', S(off.CODES_ONE));
  }

  // (cpsplit, 2026-10-27) Each value in the lists beyond the header menu: the Copy dialog's box, its memory, Other...
  // under the split, the copy_distinct trigger's COL:dsemi token and the Copy snippet writing it
  async function scnCopy() {
    var want = Object.create(null), wantNl = Object.create(null);
    FX.forEach(function (r) { pieces(r.PI_LIST, ';').forEach(function (p) { want[p] = 1; }); pieces(r.NOTES, 'nl').forEach(function (p) { wantNl[p] = 1; }); });
    want = Object.keys(want); wantNl = Object.keys(wantNl);
    function last(n0) { return window.__clip.length > n0 ? window.__clip[window.__clip.length - 1] : null; }
    function row() { var r = document.getElementById('copySplitRow'); return r ? { shown: r.style.display !== 'none', split: r.getAttribute('data-split'), label: $('#copySplitLabel').text(), ticked: $('#copySplitInput').is(':checked'), col: $('#copyColumnSelector').val() } : null; }
    async function open() { clickEl(document.getElementById('copyActionsBtn')); await sleep(200); }
    async function pick(col, delim, tick) { $('#copyColumnSelector').val(col).trigger('change'); $('#copyDelimiterInput').val(delim); if (tick !== null) $('#copySplitInput').prop('checked', tick); }
    async function copy() { var n0 = window.__clip.length; clickEl(document.getElementById('confirmCopyBtn')); await sleep(400); return last(n0); }
    // Q-box: the box shows for a list column (its separator and label), not for a plain one
    await open();
    var opts = $('#copyColumnSelector option').map(function () { return this.value; }).get();
    await pick('PI_LIST', '|', null); var bPI = row();
    await pick('STATUS', '|', null); var bST = row();
    rec('Q-box', opts.indexOf('PI_LIST') >= 0 && !!bPI && bPI.shown && bPI.split === 'dsemi' && bPI.label === 'Each value in the lists (split by ;)'
      && !!bST && !bST.shown && bST.split === '', S([bPI, bST]));
    // Q-copy: unticked, the cells as they are; ticked, each value the lists hold, once
    await pick('PI_LIST', '|', false); var cWhole = await copy();
    await open(); await pick('PI_LIST', '|', true); var cEach = await copy();
    rec('Q-copy', cWhole !== null && cWhole.split('|').some(function (v) { return v.indexOf(';') >= 0; }) && cEach !== null && sameSet(cEach.split('|'), want),
      'whole ' + S(cWhole && cWhole.slice(0, 120)) + ' each ' + S(cEach && cEach.slice(0, 160)));
    // Q-remember: the dialog reopens with the box as the last copy had it (here: the box unticked since, no copy)
    $('#copySplitInput').prop('checked', false);
    await open(); var rem = row();
    rec('Q-remember', !!rem && rem.col === 'PI_LIST' && rem.ticked && rem.split === 'dsemi', S(rem));
    // Q-other: the header menu's Other... under Each value in the lists opens Copy with the box ticked (the last copy
    // unticked); the plain Other... opens it unticked (the last copy ticked)
    await pick('PI_LIST', '|', false); await copy();
    closeMenu(); rclick(fth('PI_LIST'));
    if (item('copyMenu')) item('copyMenu').click();   // the copies are one list, Copy (copymenu)
    if (item('copy')) item('copy').click();
    await sleep(120);
    if (item('copySplit')) item('copySplit').click();
    await sleep(120);
    var so = item('copy-split-other');
    if (so) so.click();
    await sleep(300);
    var o1 = row();
    closeMenu();
    await pick('PI_LIST', '|', true); await copy();
    closeMenu(); rclick(fth('PI_LIST'));
    if (item('copyMenu')) item('copyMenu').click();
    if (item('copy')) item('copy').click();
    await sleep(120);
    var po = item('copy-other');
    if (po) po.click();
    await sleep(300);
    var o2 = row();
    closeMenu();
    rec('Q-other', !!so && !!o1 && o1.col === 'PI_LIST' && o1.ticked && o1.split === 'dsemi' && !!po && !!o2 && o2.col === 'PI_LIST' && !o2.ticked,
      S({ splitOther: !!so, o1: o1, plainOther: !!po, o2: o2 }));
    // Q-snippet: Copy snippet writes the grouping's token when the box is ticked, the column alone when not
    await open(); await pick('PI_LIST', ',', true);
    var n1 = window.__clip.length; clickEl(document.getElementById('copyCopySnippetBtn')); await sleep(300); var s1 = last(n1);
    await open(); await pick('PI_LIST', ',', false);
    var n2 = window.__clip.length; clickEl(document.getElementById('copyCopySnippetBtn')); await sleep(300); var s2 = last(n2);
    rec('Q-snippet', !!s1 && s1.indexOf("'copy_distinct|PI_LIST:dsemi|,'") >= 0 && !!s2 && s2.indexOf("'copy_distinct|PI_LIST|,'") >= 0, S([s1, s2]));
    // Q-trigger / Q-trignl: the report's buttons - each value once (a new-line list read as stored), the cells as they are
    function btn(label) { return Array.prototype.filter.call(document.querySelectorAll('#reportSnippetOutput a.snippet-action'), function (a) { return a.textContent.trim() === label; })[0] || null; }
    async function press(label) { var a = btn(label); if (!a) return null; var n0 = window.__clip.length; clickEl(a); await sleep(400); return last(n0); }
    var tEach = await press('Each'), tWhole = await press('Whole'), tNl = await press('Notes');
    rec('Q-trigger', tEach !== null && sameSet(tEach.split('|'), want) && tWhole !== null && tWhole.split('|').some(function (v) { return v.indexOf(';') >= 0; }),
      'each ' + S(tEach && tEach.slice(0, 160)) + ' whole ' + S(tWhole && tWhole.slice(0, 120)));
    rec('Q-trignl', tNl !== null && sameSet(tNl.split('|'), wantNl), S(tNl) + ' want ' + S(wantNl));
    // Q-labels (the user: "From the copy flyout, rename: Distinct values -> Distinct column values, 'This value' -> [value],
    // This Row -> This entire row"): a cell's Copy list names its value copy by the value (cut to 28 characters, the
    // whole as its tooltip; an empty cell's (blank)), then the column's name (fltmenu, 5eae534: named by the column
    // itself, above This entire row), This entire row, Distinct column values
    function cellOf(vid, col) {
      var tr = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (r) { var c = r.querySelector('td[data-column="' + colId('V_ID') + '"]'); return !!c && c.textContent.trim() === vid; })[0];
      return tr ? tr.querySelector('td[data-column="' + colId(col) + '"]') : null;
    }
    async function copyList(td) {
      closeMenu(); rclick(td); await sleep(120);
      if (item('copyMenu')) item('copyMenu').click();
      await sleep(150);
      var cc = item('cellCopy'), o = { names: subLabels(), value: cc ? label(cc) : null, tip: cc ? cc.getAttribute('title') : null };
      closeMenu(); return o;
    }
    var td17 = cellOf('ID-1017', 'PI_LIST'), t17 = td17 ? td17.textContent.replace(/\s+/g, ' ').trim() : '';
    var k17 = await copyList(td17), k10 = await copyList(cellOf('ID-1010', 'PI_LIST'));
    var cut17 = t17.length > 28 ? t17.slice(0, 27) + '...' : null;
    rec('Q-labels', !!cut17 && k17.value === cut17 && k17.tip === t17 && k17.names.join('|') === [cut17, 'PI_LIST', 'This entire row', 'Distinct column values'].join('|')
      && k10.value === '(blank)', S({ id1017: k17, id1010: k10, want: cut17 }));
  }

  async function scnChart() {
    var M = master(), VB = fn('vizBucketRowsForAxis'), G = fn('generateChartDataFromMaps');
    // V-rows: one row per value a cell lists, each carrying its value under the token's key
    var ex = (VB && M) ? VB(M, 'PI_LIST:dsemi') : null, wantN = 0;
    FX.forEach(function (r) { wantN += Math.max(1, pieces(r.PI_LIST, ';').length); });
    var r23 = ex ? ex.filter(function (m) { return m.get('V_ID') === 'ID-1023'; }).map(function (m) { return m.get('PI_LIST:DSEMI'); }) : [];
    rec('V-rows', !!ex && ex.length === wantN && ex.every(function (m) { return typeof m.get('PI_LIST:DSEMI') === 'string'; })
      && S(r23) === S(['Smith, Ann', 'Jones, Bo', 'Lee, Cy']), (ex ? ex.length : 'none') + ' want ' + wantN + ' row 23 ' + S(r23));
    // V-count / V-sum: the data builder draws a bar per value; a row counts under each value its list holds
    function build(rows, x, y, gb, agg) { return (G && rows) ? G(rows, x, y, gb, agg, 9999, 'bar', 'value', 'desc', 'default', false, false, null, '', null) : null; }
    var dc = build(M, 'PI_LIST:dsemi', 'AMT', 'none', 'count'), wc = tally(FX, chartKeys, function () { return 1; });
    R.obs.dc = S(dc).slice(0, 600);
    rec('V-count', !!dc && sameMap(chartMap(dc), wc), S(chartMap(dc)) + ' want ' + S(wc));
    var dsum = build(M, 'PI_LIST:dsemi', 'AMT', 'none', 'sum'), wsum = tally(FX, chartKeys, function (r) { return parseFloat(r.AMT); });
    rec('V-sum', !!dsum && sameMap(chartMap(dsum), wsum), S(chartMap(dsum)) + ' want ' + S(wsum));
    // V-series: STATUS across, a series per value of the list
    // (a cell listing nothing is the builder's 'default' series, as any blank series is)
    function seriesKeys(r) { var k = pieces(r.PI_LIST, ';'); return k.length ? k : ['default']; }
    var dser = build(M, 'STATUS', 'AMT', 'PI_LIST:dsemi', 'count'), serBad = [];
    if (!dser || !dser.datasets) serBad.push('no data');
    else Object.keys(tally(FX, seriesKeys, function () { return 1; })).forEach(function (p) {
      var di = -1;
      dser.datasets.forEach(function (d, i) { if (String(d.label) === p) di = i; });
      if (di < 0) { serBad.push('no series ' + p); return; }
      var got = chartMap(dser, di), want = Object.create(null);
      FX.forEach(function (r) { if (seriesKeys(r).indexOf(p) >= 0) want[r.STATUS] = (want[r.STATUS] || 0) + 1; });
      Object.keys(want).forEach(function (s) { if (!near(got[s] || 0, want[s])) serBad.push(p + '/' + s + ' ' + got[s] + ' want ' + want[s]); });
    });
    rec('V-series', !serBad.length, serBad.slice(0, 5).join(' | ') || (dser.datasets.length + ' series'));
    // V-click: a bar's rows are the rows listing its value (the click's criteria through the drill's keep)
    var CC = fn('_buildChartClickCriteria'), KP = fn('_chartDrillKeep'), who = 'Smith, Ann';
    var crit = null, matched = null;
    if (CC && KP && dc && dc.labels) {
      var at = dc.labels.map(String).indexOf(who);
      crit = CC({ data: { labels: dc.labels, datasets: dc.datasets } }, { datasetIndex: 0, index: at },
        { type: 'bar', xAxis: 'PI_LIST:dsemi', yAxis: 'AMT', groupBy: 'none', agg: 'count' });
      matched = crit ? idsOfMaps(KP(M, ['PI_LIST:dsemi', 'none'], crit.rowFilter)) : null;
    }
    var wantWho = idsWhere(function (r) { return chartKeys(r).indexOf(who) >= 0; });
    rec('V-click', !!matched && S(matched) === S(wantWho), S(matched) + ' want ' + S(wantWho));
    // V-view: View in table is the list-item condition, and the search finds those rows
    var q = crit && crit.searchParts ? crit.searchParts[0] : null, wq = itemQ('PI_LIST', 'dsemi', [who]);
    var viewIds = q ? evalQ(q) : null;
    rec('V-view', q === wq && S(viewIds) === S(wantWho), S(q) + ' -> ' + S(viewIds));
    var SP = fn('_chartDrillSearchPart');
    rec('V-unknown', !!SP && SP('PI_LIST:dsemi', 'Unknown') === null && SP('PI_LIST:dsemi', 'Jones, Bo') === itemQ('PI_LIST', 'dsemi', ['Jones, Bo']),
      SP ? S([SP('PI_LIST:dsemi', 'Unknown'), SP('PI_LIST:dsemi', 'Jones, Bo')]) : 'none');
    // V-exclude: unchecking a value keeps a row that lists another
    var kept = KP && M ? idsOfMaps(KP(M, ['PI_LIST:dsemi'], function (pr) { return cleanLbl(pr.get('PI_LIST:DSEMI')) !== who; })) : null;
    var wantKept = idsWhere(function (r) { return chartKeys(r).some(function (k) { return k !== who; }); });
    rec('V-exclude', !!kept && S(kept) === S(wantKept), (kept ? kept.length : 'none') + ' rows, want ' + wantKept.length);
    // V-cntok: a chart note on a split field keys by the field as drawn
    var CT = fn('_cnTok');
    rec('V-cntok', !!CT && CT('pi_list:dsemi') === 'PI_LIST:dsemi' && CT('AWARD_DATE:fy') === 'AWARD_DATE:fy', CT ? S([CT('pi_list:dsemi'), CT('AWARD_DATE:fy')]) : 'none');
    // V-builder: the builder's lists offer the split, worded as the grouping words it; the note while it is picked
    var made = !document.getElementById('vizXAxis');
    if (made) $('<div id="pnbSvBuilder" style="display:none"><select id="vizXAxis"></select><select id="vizYAxis"></select><select id="vizGroupBy"></select>'
      + '<div class="viz-row"><div class="viz-fld" id="vizBinEdgesFld" style="display:none"><input id="vizBinEdges"></div></div></div>').appendTo('body');
    $('#vizXAxis, #vizYAxis, #vizGroupBy').empty();
    var PV = fn('populateVisualizationColumns');
    if (PV) PV();
    function optText(sel, v) { var o = $(sel + ' option').filter(function () { return this.value === v; }); return o.length ? o.first().text() : null; }
    var tx = optText('#vizXAxis', 'PI_LIST:dsemi'), tg = optText('#vizGroupBy', 'PI_LIST:dsemi'), tk = optText('#vizXAxis', 'KW:dcomma');
    $('#vizXAxis').val('PI_LIST:dsemi').trigger('change');
    await sleep(50);
    var note1 = $('#vizSplitNote').closest('.viz-row').css('display') !== 'none' ? $('#vizSplitNote').text() : null;
    $('#vizXAxis').val('STATUS').trigger('change');
    await sleep(50);
    var note2 = $('#vizSplitNote').length && $('#vizSplitNote').closest('.viz-row').css('display') !== 'none' ? $('#vizSplitNote').text() : null;
    $('#vizXAxis option').filter(function () { return this.value === 'TAGS:dspace'; }).remove();
    if (fn('_vizEnsureXOption')) JG._vizEnsureXOption('TAGS:dspace');
    var te = optText('#vizXAxis', 'TAGS:dspace');
    rec('V-builder', /PI_LIST split by ;$/.test(tx || '') && /PI_LIST split by ;$/.test(tg || '') && /KW split by ,$/.test(tk || '') && /TAGS split by space$/.test(te || '')
      && /^PI_LIST is split by ;: a row counts once under each value its cell lists, so the bars add up to more than the rows\.$/.test(note1 || '') && note2 === null,
      S([tx, tg, tk, te, note1, note2]));
    if (made) $('#pnbSvBuilder').remove();
    // V-chart / V-panel: the report's vis() chart drawn split, and its filter panel unchecking one value
    await until(function () { return !!document.querySelector('#reportSnippetOutput canvas'); }, 20000);
    await sleep(800);
    var cv = document.querySelector('#reportSnippetOutput canvas'), ch = (cv && window.Chart && Chart.getChart) ? Chart.getChart(cv) : null;
    var drawn = ch ? chartMap(ch.data) : null;
    rec('V-chart', !!drawn && sameMap(drawn, wc), S(drawn));
    // V-clickui: a click on the drawn bar - the chart's own click handler, its rows through the drill's keep
    var scope = null, crits = null;
    if (ch) {
      var bi = ch.data.labels.map(String).indexOf(who), el = ch.getDatasetMeta(0).data[bi];
      if (el) {
        var rc = cv.getBoundingClientRect(), cx = rc.left + el.x, cy = rc.top + (el.y + el.base) / 2;
        ['mousemove', 'mousedown', 'mouseup', 'click'].forEach(function (t) { cv.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 })); });
        await until(function () { return !!document.querySelector('.chart-drill-popup-scope'); }, 4000);
        var sc = document.querySelector('.chart-drill-popup-scope');
        scope = sc ? sc.textContent.trim() : null;
        crits = Array.prototype.map.call(document.querySelectorAll('.chart-drill-popup-crit'), function (x) { return x.textContent.trim(); });
        $('.chart-drill-popup').remove();
      }
    }
    rec('V-clickui', scope === 'Scope (' + wantWho.length + ' rows)' && S(crits) === S(['PI_LIST:dsemi = ' + who]), S(scope) + ' ' + S(crits));
    var $wrap = cv ? $(cv).closest('.penumbra-chart-filter-wrapper') : $();
    var $it = $wrap.find('.chart-filter-item').filter(function () { return String($(this).attr('data-column')).toUpperCase() === 'PI_LIST:DSEMI' && $(this).attr('data-value') === who; }).first();
    R.obs.panel = { wrap: $wrap.length, items: $wrap.find('.chart-filter-item').length, item: $it.length,
      cols: $wrap.find('.chart-filter-item').map(function () { return $(this).attr('data-column') + '=' + $(this).attr('data-value'); }).get().slice(0, 8) };
    if ($it.length) { $it.find('input[type="checkbox"]').prop('checked', false).trigger('change'); }
    await sleep(900);
    var ch2 = cv && Chart.getChart ? Chart.getChart(cv) : null, after = ch2 ? chartMap(ch2.data) : null;
    var wantAfter = Object.create(null);
    Object.keys(wc).forEach(function (k) { if (k !== who) wantAfter[k] = wc[k]; });
    rec('V-panel', !!after && sameMap(after, wantAfter), S(after) + ' want ' + S(wantAfter));
  }

  async function scnLists() {
    var H = (window.Penumbra && window.Penumbra.headerMenu) || {}, TL = window.PenumbraTiles && window.PenumbraTiles.strip;
    var searches = [];
    function note(q) { var ids = evalQ(q); searches.push({ q: q, ids: ids }); return ids; }
    // L-profile: Column stats over a list column - the values its lists hold, by the rows listing each
    var p = typeof H.colProfile === 'function' ? H.colProfile('PI_LIST') : null;
    var cnt = tally(FX, function (r) { return pieces(r.PI_LIST, ';'); }, function () { return 1; });
    var top = Object.keys(cnt).map(function (k) { return { v: k, n: cnt[k] }; })
      .sort(function (a, b) { return (b.n - a.n) || a.v.localeCompare(b.v); }).slice(0, 5);
    rec('L-profile', !!p && !!p.items && p.items.delim === 'dsemi' && p.items.sym === ';' && p.items.values === Object.keys(cnt).length && S(p.items.top) === S(top) && !p.num,
      p ? S(p.items) + ' num ' + S(p.num) : 'none');
    // L-numlist: a list of numbers is no number - no sum of the lists, its values instead
    var pn = typeof H.colProfile === 'function' ? H.colProfile('PROJS') : null;
    rec('L-numlist', !!pn && !pn.num && !!pn.items && pn.items.delim === 'dcomma', pn ? S({ num: pn.num, items: pn.items && { d: pn.items.delim, v: pn.items.values } }) : 'none');
    // L-menu: its Most common, each a filter to the rows listing the value
    closeMenu(); rclick(fth('PI_LIST'));
    if (item('stats')) item('stats').click();
    await sleep(150);
    var heads = Array.prototype.map.call(document.querySelectorAll('.pnb-hm-sub .pnb-hm-head'), function (h) { return h.textContent.trim(); });
    var t0 = item('stats-top-0'), t0l = t0 ? label(t0) : null;
    if (t0) t0.click();
    await sleep(700);
    var sq = String($('#tableSearch').val() || ''), shown = shownIds(), w0 = idsWhere(function (r) { return pieces(r.PI_LIST, ';').indexOf(top[0].v) >= 0; });
    rec('L-menu', heads.indexOf('In the lists, split by ;') >= 0 && t0l === top[0].v && sq === itemQ('PI_LIST', 'dsemi', [top[0].v]) && S(shown) === S(w0),
      S(heads) + ' ' + S(t0l) + ' q ' + S(sq) + ' rows ' + shown.length + ' want ' + w0.length);
    closeMenu();
    await search('');
    // L-copy: Copy distinct values' "Each value in the lists"
    closeMenu(); rclick(fth('PI_LIST'));
    if (item('copyMenu')) item('copyMenu').click();   // (2026-10-27, copymenu) the copies are one list, Copy
    if (item('copy')) item('copy').click();
    await sleep(120);
    var cs = item('copySplit');
    if (cs) cs.click();
    await sleep(120);
    var subs = subActs(), cpp = item('copy-split-pipe'), before = window.__clip.length;
    if (cpp) cpp.click();
    await sleep(700);
    var clip = window.__clip.length > before ? window.__clip[window.__clip.length - 1] : null;
    rec('L-copy', !!cs && subs.indexOf('copy-split-semicolon') >= 0 && clip !== null && sameSet(clip.split('|'), Object.keys(cnt)), S(subs) + ' clip ' + S(clip));
    closeMenu();
    // L-copynosql (2026-10-27, copymenu 2; the user took For SQL out): "Each value in the lists" holds its delimiters alone
    rec('L-copynosql', !!cs && subs.length > 0 && subs.indexOf('copy-split-sql') < 0, S(subs));
    closeMenu();
    // L-parse / L-state: the strip grammar's split option and its list-item condition
    var pa = TL ? TL.parseArgs(['P|PI_LIST|split=semicolon']) : null, pb = TL ? TL.parseArgs(['P|PI_LIST|split=foo']) : null;
    var pc = TL ? TL.parseArgs(['P|PI_LIST|split|range']) : null, pd = TL ? TL.parseArgs(['P|PI_LIST|split|blank']) : null, pe = TL ? TL.parseArgs(['P|PI_LIST|split']) : null;
    rec('L-parse', !!pa && !pa.error && pa.fields[0].split === 'dsemi' && !!pb && /unknown split=foo/.test(pb.error || '') && !!pc && !!pc.error && !!pd && !!pd.error
      && !!pe && !pe.error && pe.fields[0].split === 'auto', S([pa && pa.fields, pb && pb.error, pc && pc.error, pd && pd.error, pe && pe.fields]));
    var F1 = [{ col: 'PI_LIST', split: 'dsemi' }], Fp = [{ col: 'PI_LIST' }];
    var qi = itemQ('PI_LIST', 'dsemi', ['Smith, Ann', 'Lee, Cy']);
    var st1 = TL && TL.state ? TL.state(qi, F1) : null, st2 = TL && TL.state ? TL.state('PI_LIST = /^(?:Smith, Ann)$/', F1) : null, st3 = TL && TL.state ? TL.state(qi, Fp) : null;
    var cmp = (TL && TL.compose && st1) ? TL.compose(st1, F1) : null;
    rec('L-state', !!st1 && S(st1.sel.PI_LIST) === S(['Smith, Ann', 'Lee, Cy']) && cmp === qi && !!st2 && !st2.sel.PI_LIST && st2.rest.length === 1 && !!st3 && !st3.sel.PI_LIST && st3.rest.length === 1
      && !!TL.itemCond && TL.itemCond('d_list', 'dnl', ['a/b']) === itemQ('D_LIST', 'dnl', ['a/b']), S([st1 && st1.sel, cmp, st2 && st2.rest, st3 && st3.rest]));
    // L-strip: the report's filter_strip() - a chip per value of each list, counted by the rows listing it
    await until(function () { return !!document.querySelector('#reportSnippetOutput .pnb-fstrip'); }, 8000);
    function grp(col) { return document.querySelector('#reportSnippetOutput .pnb-fs-group[data-fs-col="' + col + '"]'); }
    function chips(col) {
      var g = grp(col), o = Object.create(null);
      if (g) Array.prototype.forEach.call(g.querySelectorAll('.pnb-fs-chip'), function (c) { var n = c.querySelector('.pnb-fs-n'); o[c.getAttribute('data-fs-val')] = n ? Number(n.textContent.replace(/,/g, '')) : null; });
      return o;
    }
    function chip(col, v) { var g = grp(col); if (!g) return null; return Array.prototype.filter.call(g.querySelectorAll('.pnb-fs-chip'), function (c) { return c.getAttribute('data-fs-val') === v; })[0] || null; }
    var dl = tally(FX, function (r) { return pieces(dec(r.D_LIST), ';'); }, function () { return 1; });
    var g1 = grp('PI_LIST'), g2 = grp('D_LIST'), c1 = chips('PI_LIST'), c2 = chips('D_LIST');
    rec('L-strip', !!g1 && g1.getAttribute('data-fs-split') === 'dsemi' && !!g2 && g2.getAttribute('data-fs-split') === 'dsemi' && sameMap(c1, cnt) && sameMap(c2, dl),
      S(c1) + ' / ' + S(c2) + ' want ' + S(cnt) + ' / ' + S(dl));
    // L-chip: a chip filters to the rows listing its value; the other groups count under it; a second value joins it
    var ch1 = chip('PI_LIST', 'Smith, Ann');
    if (ch1) clickEl(ch1);
    await sleep(900);
    var q1 = String($('#tableSearch').val() || ''), sh1 = shownIds(), w1 = idsWhere(function (r) { return pieces(r.PI_LIST, ';').indexOf('Smith, Ann') >= 0; });
    var st = chips('STATUS'), wst = Object.create(null);
    FX.forEach(function (r) { if (pieces(r.PI_LIST, ';').indexOf('Smith, Ann') >= 0) wst[r.STATUS] = (wst[r.STATUS] || 0) + 1; });
    var pressed = chip('PI_LIST', 'Smith, Ann');
    rec('L-chip', q1 === itemQ('PI_LIST', 'dsemi', ['Smith, Ann']) && S(sh1) === S(w1) && !!pressed && pressed.getAttribute('aria-pressed') === 'true'
      && Object.keys(wst).every(function (k) { return st[k] === wst[k]; }), S(q1) + ' rows ' + sh1.length + '/' + w1.length + ' status ' + S(st) + ' want ' + S(wst));
    var ch2 = chip('PI_LIST', 'Jones, Bo');
    if (ch2) clickEl(ch2);
    await sleep(900);
    var q2 = String($('#tableSearch').val() || ''), sh2 = shownIds(), w2 = idsWhere(function (r) { var k = pieces(r.PI_LIST, ';'); return k.indexOf('Smith, Ann') >= 0 || k.indexOf('Jones, Bo') >= 0; });
    rec('L-chip2', q2 === itemQ('PI_LIST', 'dsemi', ['Smith, Ann', 'Jones, Bo']) && S(sh2) === S(w2), S(q2) + ' rows ' + sh2.length + '/' + w2.length);
    var ca = document.querySelector('#reportSnippetOutput .pnb-fs-clearall');
    if (ca) clickEl(ca);
    await sleep(900);
    // the searches, for the runner half (penumbra_search.php must find the same rows): no entities in these cells
    // (the server search does not decode them - a finding of this round, not its change)
    note(itemQ('PI_LIST', 'dsemi', ['Smith, Ann']));
    note(itemQ('PI_LIST', 'dsemi', ['Smith, Ann', 'Jones, Bo']));
    note(itemQ('PI_LIST', 'dsemi', ['Smith, Ann'], true));
    note(itemQ('PI_LIST', 'dsemi', ['Lee, Cy']));   // (row 7 is @@HTML<b>Lee, Cy</b>;Kim, Di)
    note(itemQ('KW', 'dcomma', ['red']));
    note(itemQ('NOTES', 'dnl', ['call']));
    note(itemQ('TAGS', 'dspace', ['alpha', 'beta']));
    note(itemQ('PROJS', 'dcomma', [FX[3].PROJS.split(', ')[0]]));
    var badS = [];
    searches.forEach(function (x) {
      var col = x.q.split(' ')[0], m = /\(\?:\^\|(.+?)\)\[/.exec(x.q), id = null;
      Object.keys(SEPS).forEach(function (k) { if (m && SEPS[k] === m[1]) id = k; });
      var vals = /\)\[ \\t\\n\\r\\x0B\]\*\(\?:(.*)\)\[ \\t/.exec(x.q)[1].split('|');
      var want = idsWhere(function (r) {
        var ps = id === 'dnl' ? pieces(r[col], 'nl') : id === 'dspace' ? pieces(r[col], 'space') : pieces(r[col], ({ dsemi: ';', dcomma: ',', dpipe: '|', dtab: '\t' })[id]);
        var hit = ps.some(function (v) { return vals.indexOf(esc(v)) >= 0; });
        return / != /.test(x.q) ? !hit : hit;
      });
      if (S(x.ids) !== S(want)) badS.push(x.q + ' -> ' + (x.ids ? x.ids.length : 'none') + ' want ' + want.length);
    });
    rec('L-search', !badS.length, badS.join(' | ') || searches.length + ' searches');
    R.obs.searches = searches;
    R.obs.lfixture = FX;
  }

  (async function main() {
    try {
      await boot();
      premise();
      if (SCN === 'unit') await scnUnit();
      else if (SCN === 'render') await scnRender();
      else if (SCN === 'nested') await scnNested();
      else if (SCN === 'menu') await scnMenu();
      else if (SCN === 'snippet') await scnSnippet();
      else if (SCN === 'bucket') await scnBucket();
      else if (SCN === 'json') await scnJson();
      else if (SCN === 'detect') await scnDetect();
      else if (SCN === 'chart') await scnChart();
      else if (SCN === 'lists') await scnLists();
      else if (SCN === 'copy') await scnCopy();
    } catch (e) {
      rec('X-' + SCN, false, 'driver threw: ' + String((e && e.stack) || e).slice(0, 600));
    }
    R.missing = window.__JG_MISSING || null;
    R.hookErr = window.__JG_ERR || window.__JG_ERR2 || null;
    R.errors = (window.__errors || []).concat(window.__rejections || []);
    window.__DGRESULT = R;
    window.__DGDONE = true;
  })();
})();
