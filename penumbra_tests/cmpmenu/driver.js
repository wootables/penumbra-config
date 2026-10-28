// cmpmenu suite - browser half (2026-10-22). The REAL main.js renders a REAL snapshot comparison (the cmpfoot
// fixture: keys ID; ID 3 changed its AMOUNT, ID 4 its QTY; 5-6 new, 7-8 removed, 1-2 unchanged), and the menu
// module opens the comparison's own menu on its headings, cells and bands. Right-clicks are dispatched like a
// user's; the items are clicked; the clipboard is a recorder.
// (cmp38, round 2, same day) the tools that work on a comparison as on a grouped view: sort (every group's
// table), Column widths (the grouped view's, kept in the viewer's widths as a drag is), Consistent row height,
// a cell's Filter to / Exclude (the comparison runs again over the matching rows, both sides) and a band's
// Expand / Show only / Hide (Show only: the comparison's own __SNAP_TYPE = '...' condition, through the
// page's typed-search path). The harness's comparison is a compare-to-live one: a search re-runs it.
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {};
  var COLS = window.__COLS, LIVE = window.__LIVE, SNAP = window.__SNAP;
  function J(x) { return JSON.stringify(x); }
  window.__clip = [];
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (t) { window.__clip.push(String(t)); return Promise.resolve(); } } });
  } catch (e) { window.__clipErr = String(e); }
  function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }

  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && document.querySelectorAll('#resultsTable tbody tr').length === LIVE.length; }, 30000);
    await sleep(400);
  }
  function snapObj(rows, name, ageDays) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: COLS.slice(),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  function wrappers() { return Array.prototype.slice.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper')); }
  function wrapperOf(group) { return wrappers().filter(function (w) { return w.getAttribute('data-group-key') === group; })[0] || null; }
  function bandOf(group) { var w = wrapperOf(group); return w ? w.querySelector('.group-header') : null; }
  function keys() { return wrappers().map(function (w) { return w.getAttribute('data-group-key'); }); }
  function headIn(w, name) {
    if (!w) return null;
    return Array.prototype.slice.call(w.querySelectorAll('thead th[data-colname]')).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0] || null;
  }
  function cellIn(w, id, name) {
    var idTh = headIn(w, 'ID'), th = headIn(w, name);
    if (!idTh || !th) return null;
    var idCol = idTh.getAttribute('data-column'), col = th.getAttribute('data-column');
    var tr = Array.prototype.slice.call(w.querySelectorAll('tbody tr')).filter(function (r) {
      var c = r.querySelector('td[data-column="' + idCol + '"]');
      return c && String(c.textContent).trim() === id;
    })[0];
    return tr ? tr.querySelector('td[data-column="' + col + '"]') : null;
  }
  // a group's IDs in the order its table shows them
  function idsOf(group) {
    var w = wrapperOf(group), idTh = headIn(w, 'ID');
    if (!idTh) return null;
    var c = idTh.getAttribute('data-column');
    return Array.prototype.map.call(w.querySelectorAll('tbody tr'), function (r) { var td = r.querySelector('td[data-column="' + c + '"]'); return td ? String(td.textContent).trim() : '?'; });
  }
  function allIds() { return [idsOf('New Rows'), idsOf('Removed Rows'), idsOf('Modified Rows'), idsOf('Unchanged Rows')]; }
  // the groups open, as a person has them before right-clicking in one (a hidden heading cannot take the focus back)
  function openAll() { wrappers().forEach(function (x) { var c = x.querySelector('.group-content'); if (c) c.style.display = 'block'; }); }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function panelsAll() { return Array.prototype.slice.call(document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('[data-act]'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function item(a) { var ps = panelsAll(); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + a + '"]'); if (x) return x; } return null; }
  function label(a) { var it = item(a), l = it ? it.querySelector('.pnb-hm-label') : null; return l ? l.textContent : null; }
  function ticked(a) { var it = item(a); return !!it && it.getAttribute('aria-checked') === 'true'; }
  function subPanel() { var s = document.querySelectorAll('.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function subActs() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('[data-act]'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function title() { var m = menu(); return m ? m.getAttribute('aria-label') : null; }
  function subLine() { var s = document.getElementById('pnbHeadMenuStats'); return s ? String(s.textContent || '') : ''; }
  function rclick(el, kbd) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: kbd ? 0 : 2,
      clientX: kbd ? 0 : Math.round(r.left + 6), clientY: kbd ? 0 : Math.round(r.top + 6) }));
  }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  // an act inside the Column widths list is reached through it
  var SUBS = { fit: 'width', fitAll: 'width', fitPage: 'width', resetWidth: 'width', resetWidths: 'width' };
  // (2026-10-27, copymenu) a cell's copies are one list, Copy (a heading's Copy column name stays alone)
  ['cmpCopy', 'cmpCopyWas', 'cmpCopyRow', 'cmpCopyName'].forEach(function (a) { SUBS[a] = 'cmpCopyMenu'; });
  function openSub(a) { var it = item(a); if (!it || it.getAttribute('aria-disabled') === 'true') return false; it.click(); return true; }
  async function choose(el, act) {
    closeMenu();
    rclick(el);
    if (!item(act) && SUBS[act]) { openSub(SUBS[act]); await sleep(80); }
    var it = item(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; }
    it.click();
    await sleep(200);
    return true;
  }
  function HM() { return window.Penumbra.headerMenu; }
  function box() { return document.getElementById('tableSearch'); }
  // a search re-runs a compare-to-live comparison: a new container, then a quiet DOM
  async function settle(c0) {
    await waitFor(function () { return document.getElementById('snapshotComparisonContainer') !== c0; }, 8000);
    var last = '', still = 0, t0 = Date.now();
    while (Date.now() - t0 < 4000 && still < 4) {
      await sleep(100);
      var s = keys().join('|') + '#' + document.querySelectorAll('#snapshotComparisonContainer tbody tr').length;
      if (s === last) still++; else { still = 0; last = s; }
    }
    openAll();
  }
  async function search(q) {
    var c0 = document.getElementById('snapshotComparisonContainer');
    window.Penumbra.findHost.runSearch(q);
    await settle(c0);
  }
  async function chooseRerun(el, act) {
    var c0 = document.getElementById('snapshotComparisonContainer');
    var ran = await choose(el, act);
    if (ran) await settle(c0);
    return ran;
  }
  var ALL4 = J(['New Rows', 'Removed Rows', 'Modified Rows', 'Unchanged Rows']);

  async function main() {
    await waitBoot();
    // (cmp38, the review) the report's own table sorted first: the page keeps that sort, a comparison renders unsorted
    var fname = document.querySelector('#tableHeader th[data-colname="NAME"]');
    if (fname && window.Penumbra.headerMenu) { HM().sort(fname, 'asc'); await sleep(300); }
    var staleKeys = J(HM().sortKeys());
    var h0 = window.__CF_HIDES || 0;
    H.runCmp(snapObj(SNAP, 'Fixture snapshot', 3), ['ID']);
    var ok = await waitFor(function () {
      return document.body.classList.contains('snapshot-comparison-active') && wrappers().length > 0 && (window.__CF_HIDES || 0) > h0;
    }, 30000);
    var ba = document.getElementById('snapBaToggleBtn');
    rec('C0 a compare-to-live comparison renders (keys: ID), Before & After offered (rows changed)', ok && !!ba && ba.style.display !== 'none' && J(keys()) === ALL4,
      'wrappers=' + J(keys()) + ' ba=' + (ba ? ba.style.display : 'none') + ' reportSort=' + staleKeys + ' marked=' + document.querySelectorAll('#snapshotComparisonContainer thead th.sorted').length);
    if (!ok) return;
    await sleep(300);
    openAll();
    await sleep(100);
    var w = wrapperOf('Modified Rows'), th = headIn(w, 'AMOUNT');

    // C1 a heading: the comparison's own menu - sort, widths, row height, the column's name, then the comparison's items
    // (the report table's sort on NAME is not on these rows: no Then sort here)
    closeMenu();
    var opened = rclick(th);
    var a1 = acts();
    rec('C1 a heading opens the comparison menu: Sort, Column widths, Consistent row height, Copy column name, Show before & after, Edit match criteria..., Clear snapshot comparison (no Then sort under the report table\'s sort)',
      opened && !!menu() && title() === 'AMOUNT' && J(a1) === J(['sortAsc', 'sortDesc', 'width', 'rowHeight', 'cmpCopyName', 'cmpBeforeAfter', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear']) && /Snapshot comparison/.test(subLine()),
      'opened=' + opened + ' title=' + title() + ' acts=' + J(a1) + ' sub=' + subLine());
    closeMenu();

    // C2 a changed cell: its value and earlier value to copy, the column's tools, the comparison's items - no Filter
    // to / Exclude (its two values differ: a compare-to-live filter runs on both sides and would split the pair)
    var td3 = cellIn(w, '3', 'AMOUNT');
    rclick(td3);
    var a2 = acts(), l2 = openSub('cmpCopyMenu') ? subActs() : [];   // (2026-10-27, copymenu) the copies are one list, Copy
    // C38 (2026-10-27, copymenu 3) the list opens under a static heading, Copy (no act)
    var hd2 = (function () { var p = subPanel(), f = p ? p.firstElementChild : null; return f ? [f.className, f.getAttribute('role') || '', f.textContent.trim(), f.getAttribute('data-act') || ''] : []; })();
    rec('C38 a comparison cell\'s Copy list opens under a static Copy heading', hd2.length === 4 && /(^| )pnb-hm-head( |$)/.test(hd2[0]) && hd2[1] === 'presentation' && hd2[2] === 'Copy' && hd2[3] === '', J(hd2));
    rec('C2 a changed cell offers Copy (this value, the earlier value, the column name, this row; no Filter to / Exclude), then the column\'s tools; its group under the name',
      !!td3 && td3.classList.contains('snap-cell-modified') && J(a2) === J(['cmpCopyMenu', 'sortAsc', 'sortDesc', 'width', 'rowHeight', 'cmpBeforeAfter', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear'])
        && J(l2) === J(['cmpCopy', 'cmpCopyWas', 'cmpCopyName', 'cmpCopyRow']) && /Modified Rows/.test(subLine()),   // (2026-10-27, fltmenu) the name before the row
      'cell=' + (td3 ? td3.className : null) + ' acts=' + J(a2) + ' list=' + J(l2) + ' sub=' + subLine());
    closeMenu();

    // C24 the value a cell filters by: read as the search reads the stored value, as the report table's cell menu
    // does - tags stripped; the cell's TEXT is the page's decode of the stored value already (never decoded twice),
    // a formatted cell's raw value (data-pnb-raw, as stored) is decoded once
    var nt = cellIn(wrapperOf('Unchanged Rows'), '2', 'NOTE'), nt0 = nt ? nt.textContent : '';
    var t24 = [];
    function filterTitle() { var f = item('cellFilter'); return f ? f.getAttribute('title') : null; }
    if (nt) {
      nt.textContent = 'Jane Doe <jd@x.edu>';
      closeMenu(); rclick(nt);
      t24.push(filterTitle(), label('cellFilter'));
      closeMenu();
      nt.textContent = 'R&amp;D';
      rclick(nt);
      t24.push(filterTitle());
      closeMenu();
      nt.setAttribute('data-pnb-raw', 'R&amp;D &lt;b&gt;');
      rclick(nt);
      t24.push(filterTitle());
      closeMenu();
      nt.setAttribute('data-pnb-raw', '@@HTML<b>1234.5</b>');
      rclick(nt);
      t24.push(filterTitle());
      closeMenu();
      nt.removeAttribute('data-pnb-raw');
      nt.textContent = nt0;
    }
    rec('C24 a cell filters by its value as the search reads it: tags stripped from its text, its text never decoded again, a formatted cell\'s raw value decoded once',
      J(t24) === J(['Jane Doe', 'Filter to "Jane Doe"', 'R&amp;D', 'R&D', '1234.5']), 'got=' + J(t24));

    // C28 no Filter to / Exclude in a column the report's own table does not have by that name (a snapshot-only
    // column, a compared journal toggle shown by its label): the live side's search cannot read it
    // (the same cell offers them under its real name first: the check is never vacuous)
    var wn = wrapperOf('Unchanged Rows'), noteTh = headIn(wn, 'NOTE'), a28a = [], a28 = [];
    if (noteTh) {
      closeMenu(); rclick(cellIn(wn, '1', 'NOTE'));
      a28a = acts();
      closeMenu();
      noteTh.setAttribute('data-colname', 'OLDNOTE');
      rclick(cellIn(wn, '1', 'OLDNOTE'));
      a28 = acts();
      closeMenu();
      noteTh.setAttribute('data-colname', 'NOTE');
    }
    rec('C28 a cell offers Filter to / Exclude under its column\'s real name, and none under a name the report\'s table lacks (Copy this value stays)',
      a28a.indexOf('cellFilter') === 0 && a28a.indexOf('cellExclude') === 1 && a28.length > 0 && a28.indexOf('cmpCopyMenu') === 0 && a28.indexOf('cellFilter') < 0 && a28.indexOf('cellExclude') < 0,
      'real=' + J(a28a.slice(0, 3)) + ' renamed=' + J(a28));

    // C3 / C4 the copies: the current value and the snapshot's
    await choose(td3, 'cmpCopy');
    await sleep(100);
    var c3 = lastClip();
    rec('C3 Copy this value copies the current value', c3 === '$300.00', 'clip=' + J(c3) + ' err=' + (window.__clipErr || ''));
    await choose(td3, 'cmpCopyWas');
    await sleep(100);
    var c4 = lastClip();
    rec('C4 Copy the earlier value copies the snapshot\'s value', c4 === '$150.00', 'clip=' + J(c4));
    // C35 (2026-10-27, copymenu) Copy > This row: each column shown as "Name: value", one per line, a changed cell's current
    // value with the earlier one after it, "(was: ...)"; the group column (__SNAP_TYPE) and '#' left out
    function headTxt(h) { var c = h.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .sr-only, button, [aria-hidden="true"], [class*="grip"]'), function (n) { n.remove(); }); return (c.textContent || '').replace(/\s+/g, ' ').trim() || h.getAttribute('data-colname'); }
    var tr3 = td3 ? td3.closest('tr') : null, want35 = [];
    if (tr3) Array.prototype.forEach.call(td3.closest('table').querySelectorAll('thead th'), function (h) {
      var id = h.getAttribute('data-column'), nm = h.getAttribute('data-colname');
      if (id === null || id === '__SNAP_TYPE' || nm === '#' || h.style.display === 'none') return;
      var c = tr3.querySelector('td[data-column="' + id + '"]');
      if (!c) return;
      if (c.classList.contains('snap-cell-modified')) {
        var nw = c.querySelector('.snap-ba-now-only'), wv = c.querySelector('.snap-ba-was-val'), wt = wv ? String(wv.innerText || wv.textContent || '').trim() : '';
        want35.push(headTxt(h) + ': ' + String((nw || c).innerText || '').trim() + (wt === '' ? ' (was blank)' : ' (was: ' + wt + ')'));
      } else want35.push(headTxt(h) + ': ' + String(c.innerText || '').trim());
    });
    await choose(td3, 'cmpCopyRow');
    await sleep(100);
    var c35 = lastClip() || '';
    rec('C35 Copy > This row copies the row as Name: value lines, a changed value with its earlier one after it, the group column left out',
      want35.length >= 3 && c35 === want35.join('\n') && c35.indexOf('AMOUNT: $300.00 (was: $150.00)') >= 0 && c35.indexOf('Modified Rows') < 0,
      'clip=' + J(c35) + ' want=' + J(want35.join('\n')));
    // C36 (2026-10-27, copymenu; the review) a changed cell's two values read as This row reads any cell: a nested table by its
    // rows, the earlier one under "was:" (that view is hidden until Show before & after: never its rendered text - the sort
    // arrows, the totals, the raw JSON); a value now blank says "(blank)"
    var keep36 = td3 ? td3.innerHTML : '', c36 = '', c36b = '';
    function nest36(k, v) {
      return '<div class="nested-json-container data-grid-table"><div class="nested-json-header"><div class="nested-json-cell">' + k + '<span class="sort-icon">&#9650;&#9660;</span></div></div>'
        + '<div class="nested-json-row"><div class="nested-json-cell">' + v + '</div></div><div class="nested-json-row nested-total-row"><div class="nested-json-cell"><strong>TOTAL</strong></div></div></div>'
        + '<div class="raw-json-data" style="display:none">[{"' + k + '":"' + v + '"}]</div>';
    }
    if (td3) {
      td3.innerHTML = '<span class="snap-ba-now-only">' + nest36('KEY', 'a1') + '</span><span class="snap-ba-pair"><span class="snap-ba-label">[was:]</span> <span class="snap-ba-was-val">' + nest36('KEY', 'a0')
        + '</span><br><span class="snap-ba-label">[now:]</span> <span class="snap-ba-now-val">' + nest36('KEY', 'a1') + '</span></span>';
      await choose(td3, 'cmpCopyRow'); await sleep(100);
      c36 = lastClip() || '';
      td3.innerHTML = '<span class="snap-ba-now-only"></span><span class="snap-ba-pair"><span class="snap-ba-label">[was:]</span> <span class="snap-ba-was-val">$150.00</span><br><span class="snap-ba-label">[now:]</span> <span class="snap-ba-now-val"></span></span>';
      await choose(td3, 'cmpCopyRow'); await sleep(100);
      c36b = lastClip() || '';
      td3.innerHTML = keep36;
    }
    rec('C36 This row reads a changed nested table by its rows, the earlier one under was:, and a value now blank as (blank)',
      /(^|\n)AMOUNT:\n  KEY: a1\n  was:\n    KEY: a0(\n|$)/.test(c36) && /(^|\n)AMOUNT: \(blank\) \(was: \$150\.00\)(\n|$)/.test(c36b),
      'nested=' + J(c36) + ' blank=' + J(c36b));

    // C5 a group's band: the group's items (expand, show only, hide) and the comparison's, under the group's name
    var hd = w.querySelector('.group-header');
    closeMenu();
    rclick(hd);
    var a5 = acts();
    rec('C5 a group\'s band opens the comparison menu under the group\'s name: Expand, Show only, Hide this group, then the comparison\'s items',
      !!menu() && title() === 'Modified Rows' && J(a5) === J(['cmpGroupToggle', 'cmpGroupOnly', 'cmpGroupHide', 'cmpBeforeAfter', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear']),
      'title=' + title() + ' acts=' + J(a5));
    closeMenu();

    // C6 an unchanged cell (in a changed row, and in an unchanged row): no earlier value
    var nm3 = cellIn(w, '3', 'NAME'), wu = wrapperOf('Unchanged Rows'), nm1 = wu ? cellIn(wu, '1', 'NAME') : null;
    rclick(nm3);
    var a6a = acts(), l6 = openSub('cmpCopyMenu') ? subActs() : [];   // (2026-10-27, copymenu) its Copy list: no earlier value
    closeMenu();
    rclick(nm1);
    var a6b = acts();
    closeMenu();
    await choose(nm1, 'cmpCopy');
    await sleep(100);
    var c6 = lastClip();
    rec('C6 an unchanged cell offers its value (filter, copy) and the column\'s tools, in a changed row too, never an earlier value',
      J(a6a) === J(['cellFilter', 'cellExclude', 'cmpCopyMenu', 'sortAsc', 'sortDesc', 'width', 'rowHeight', 'cmpBeforeAfter', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear'])
        && J(l6) === J(['cmpCopy', 'cmpCopyName', 'cmpCopyRow']) && J(a6b) === J(a6a)
        && c6 === 'Alpha' && /Unchanged Rows/.test(String(nm1 ? nm1.parentNode.textContent : '')),
      'changedRow=' + J(a6a) + ' list=' + J(l6) + ' unchangedRow=' + J(a6b) + ' clip=' + J(c6));

    // C7 Show before & after: the control bar's toggle, ticked while on; again, off
    await choose(th, 'cmpBeforeAfter');
    var onNow = document.body.classList.contains('snap-show-before-after');
    closeMenu(); rclick(th);
    var baTicked = ticked('cmpBeforeAfter');
    closeMenu();
    await choose(th, 'cmpBeforeAfter');
    var offNow = !document.body.classList.contains('snap-show-before-after');
    rec('C7 Show before & after turns the earlier values on (ticked), and off again', onNow && baTicked && offNow,
      'on=' + onNow + ' ticked=' + baTicked + ' off=' + offNow);

    // C8 only where it applies: no toggle on the control bar (no row changed) - no item
    ba.style.display = 'none';
    closeMenu(); rclick(th);
    var a8 = acts();
    closeMenu();
    ba.style.display = '';
    rec('C8 Show before & after is left out where the control bar has no toggle',
      J(a8) === J(['sortAsc', 'sortDesc', 'width', 'rowHeight', 'cmpCopyName', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear']), 'acts=' + J(a8));

    // C9 Edit match criteria...: the banner's pencil (its own handler reopens the snapshot dialog)
    var spy = 0;
    function spyFn(e) { if (e.target && e.target.closest && e.target.closest('.snap-modify-link')) { spy++; e.preventDefault(); e.stopImmediatePropagation(); } }
    document.addEventListener('click', spyFn, true);
    await choose(th, 'cmpEditMatch');
    await sleep(150);
    document.removeEventListener('click', spyFn, true);
    rec('C9 Edit match criteria... runs the comparison banner\'s Modify comparison control', spy === 1,
      'spy=' + spy + ' links=' + document.querySelectorAll('.snap-modify-link').length);

    // C32 (lnk40; the user: "copy link / copy evergreen link can be in the right click menu while in a snapshot comparison")
    // the banner's Copy link and Copy evergreen link, each where the banner shows it, each run through the banner's own
    // button (the spy stops the click there: the link builders want a saved report)
    var lkB = document.querySelector('#snapAnalysisDock .snap-banner-link'), evB = document.querySelector('#snapAnalysisDock .snap-banner-link-evergreen');
    var lkShown = !!lkB && lkB.style.display !== 'none', evShown0 = !!evB && evB.style.display !== 'none';
    var hits = { lk: 0, ev: 0 };
    function spy32(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.snap-banner-link')) { hits.lk++; e.stopImmediatePropagation(); e.preventDefault(); }
      else if (t.closest('.snap-banner-link-evergreen')) { hits.ev++; e.stopImmediatePropagation(); e.preventDefault(); }
    }
    document.addEventListener('click', spy32, true);
    closeMenu(); rclick(th);
    var a32a = acts();
    closeMenu();
    var ranLk = await choose(th, 'cmpCopyLink');
    if (evB) evB.style.display = '';
    closeMenu(); rclick(td3);
    var a32b = acts();
    closeMenu();
    var ranEv = await choose(td3, 'cmpCopyEvergreen');
    if (evB) evB.style.display = 'none';
    closeMenu(); rclick(th);
    var a32c = acts();
    closeMenu();
    document.removeEventListener('click', spy32, true);
    rec('C32 the banner\'s Copy link and Copy evergreen link, each where the banner shows it, each running the banner\'s own button',
      lkShown && !evShown0 && a32a.indexOf('cmpCopyLink') > a32a.indexOf('cmpEditMatch') && a32a.indexOf('cmpCopyEvergreen') < 0 && ranLk && hits.lk === 1
        && a32b.indexOf('cmpCopyLink') > 0 && a32b.indexOf('cmpCopyEvergreen') === a32b.indexOf('cmpCopyLink') + 1 && ranEv && hits.ev === 1 && a32c.indexOf('cmpCopyEvergreen') < 0,
      'shown=' + [lkShown, evShown0].join('/') + ' acts=' + J(a32a.slice(-4)) + ' withEver=' + J(a32b.slice(-4)) + ' hits=' + J(hits) + ' after=' + J(a32c.slice(-3)));

    // C34 (dictstat, 2026-10-24; the user: "now that we have data dictionaries should we add an entry to show column
    // definition if one exists?") What this column means, where the report's data dictionary names the column: after the
    // sorts, as the report's own heading has it, on a heading and a cell; its click opens the dictionary at the ENTRY's
    // name (the stand-in dictionary names AMOUNT as "Amount"); none for a column it does not name (NAME).
    var w34 = wrapperOf('Modified Rows'), th34 = headIn(w34, 'AMOUNT'), td34 = cellIn(w34, '3', 'AMOUNT'), name34 = headIn(w34, 'NAME');
    var realDict = window.PenumbraDict, realOpen34 = window.Penumbra.openDataDictionary, opened34 = [];
    window.PenumbraDict = { entryFor: function (c, l) {
      return (String(c).toUpperCase() === 'AMOUNT' || String(l).toUpperCase() === 'AMOUNT') ? { name: 'Amount', key: 'AMOUNT', text: 'What was paid.', source: '', draft: false, avoid: false } : null;
    } };
    window.Penumbra.openDataDictionary = function (f) { opened34.push(f); };
    closeMenu(); rclick(th34);
    var a34a = acts();
    closeMenu(); rclick(td34);
    var a34b = acts(), lbl34 = label('about');
    closeMenu();
    var ran34 = await choose(th34, 'about');
    closeMenu(); rclick(name34);
    var a34c = acts();
    closeMenu();
    if (realDict === undefined) { delete window.PenumbraDict; } else { window.PenumbraDict = realDict; }
    window.Penumbra.openDataDictionary = realOpen34;
    rec('C34 What this column means where the report\'s data dictionary names the column, after the sorts (a heading and a cell), opening the dictionary at the entry\'s name; none for a column it does not name',
      J(a34a.slice(0, 4)) === J(['sortAsc', 'sortDesc', 'about', 'width']) && a34b.indexOf('about') === a34b.indexOf('sortDesc') + 1 && a34b.indexOf('sortDesc') > 0
        && lbl34 === 'What this column means' && ran34 && J(opened34) === J(['Amount']) && !!name34 && a34c.indexOf('about') < 0 && a34c.indexOf('sortAsc') === 0,
      'heading=' + J(a34a) + ' cell=' + J(a34b) + ' label=' + lbl34 + ' ran=' + ran34 + ' opened=' + J(opened34) + ' name=' + J(a34c));

    // C10 from the keyboard (Shift+F10 / the Menu key on a focused heading): the menu takes the focus; Esc gives it back
    closeMenu();
    th.setAttribute('tabindex', '0');
    th.focus();
    var focusedBefore = document.activeElement === th;
    rclick(th, true);
    var inMenu = !!menu() && menu().contains(document.activeElement);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(50);
    rec('C10 the keyboard opens it on the focused heading, and Escape returns the focus there', inMenu && !menu() && document.activeElement === th,
      'inMenu=' + inMenu + ' open=' + !!menu() + ' focus=' + (document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : null)
        + ' thRects=' + th.getClientRects().length + ' grc=' + (document.getElementById('groupedResultsContainer') || {}).style.display + ' focusedBefore=' + focusedBefore);

    // C23 the '#' heading: sort, widths (every column's: nothing of its own), row height - no name to copy
    var numTh = headIn(w, '#');
    closeMenu(); rclick(numTh);
    var a23 = acts();
    openSub('width'); await sleep(80);
    var s23 = subActs();
    closeMenu();
    rec('C23 the # heading: Sort, Column widths (Fit all, Fit to page, Reset all), Consistent row height, the comparison\'s items',
      !!numTh && J(a23) === J(['sortAsc', 'sortDesc', 'width', 'rowHeight', 'cmpBeforeAfter', 'cmpEditMatch', 'cmpCopyLink', 'cmpClear']) && J(s23) === J(['fitAll', 'fitPage', 'resetWidths']),
      'acts=' + J(a23) + ' widths=' + J(s23));

    // C13 the sort: every group's table, as a click on a heading sorts them; the choice ticked, Clear sort offered
    var nmTh = headIn(w, 'NAME');
    var s0 = J(allIds());
    var ran13 = await choose(nmTh, 'sortDesc');
    await sleep(200);
    var sDesc = J(allIds());
    closeMenu(); rclick(nmTh);
    var tick13 = ticked('sortDesc') && !ticked('sortAsc') && !!item('sortClear');
    closeMenu();
    await choose(nmTh, 'sortAsc');
    await sleep(200);
    var sAsc = J(allIds());
    rec('C13 Sort descending / ascending on a comparison heading sorts every group\'s table (the choice ticked, Clear sort offered)',
      ran13 && sDesc === J([['6', '5'], ['8', '7'], ['4', '3'], ['2', '1']]) && tick13 && sAsc === J([['5', '6'], ['7', '8'], ['3', '4'], ['1', '2']]),
      'before=' + s0 + ' desc=' + sDesc + ' ticked=' + tick13 + ' asc=' + sAsc);

    // C14 Then sort: under the sort on NAME, another heading offers the next level; Clear sort takes each level off
    closeMenu(); rclick(th);
    var a14 = acts();
    closeMenu();
    var ran14 = await choose(th, 'thenDesc');
    var k1 = J(HM().sortKeys());
    closeMenu(); rclick(th);
    var then1 = ticked('thenDesc') && !!item('sortClear');
    closeMenu();
    await choose(th, 'sortClear');
    var k2 = J(HM().sortKeys());
    await choose(nmTh, 'sortClear');
    var k3 = J(HM().sortKeys());
    rec('C14 Then sort adds a second level from another comparison heading; Clear sort takes each level off',
      ran14 && a14.indexOf('thenAsc') > a14.indexOf('sortDesc') && a14.indexOf('thenDesc') > a14.indexOf('thenAsc') && a14.indexOf('sortClear') < 0
        && k1 === J(['NAME', 'AMOUNT']) && then1 && k2 === J(['NAME']) && k3 === '[]',
      'acts=' + J(a14) + ' keys=' + [k1, k2, k3].join(' -> ') + ' ticked=' + then1);

    // C15 Column widths on a heading: the column's own and every column's
    closeMenu(); rclick(th);
    openSub('width'); await sleep(80);
    var s15 = subActs();
    closeMenu();
    rec('C15 Column widths on a comparison heading: Fit width to contents, Fit all column widths, Fit to page, Reset this column\'s width, Reset all column widths',
      J(s15) === J(['fit', 'fitAll', 'fitPage', 'resetWidth', 'resetWidths']), 'widths=' + J(s15));

    // C16 the widths run: kept in the viewer's widths (the grouped view's, as a drag on an edge is), and reset
    var CW = window.Penumbra.colWidthsHost;
    var u0 = J(CW.userDiff());
    var ran16 = await choose(th, 'fit');
    await sleep(300);
    var u1 = CW.userDiff().slice();
    closeMenu(); rclick(th); openSub('width'); await sleep(80);
    var resetOn = !!item('resetWidth') && item('resetWidth').getAttribute('aria-disabled') !== 'true';
    closeMenu();
    await choose(th, 'resetWidth');
    await sleep(300);
    var u2 = CW.userDiff().slice();
    await choose(th, 'fitPage');
    await sleep(400);
    var u3 = CW.userDiff().slice();
    await choose(th, 'resetWidths');
    await sleep(400);
    var u4 = CW.userDiff().slice();
    rec('C16 Fit width to contents keeps the width in your layout and Reset this column\'s width puts it back; Fit to page and Reset all column widths likewise',
      ran16 && u0 === '[]' && u1.indexOf('AMOUNT') >= 0 && resetOn && u2.indexOf('AMOUNT') < 0 && u3.length >= 2 && u4.length === 0,
      'before=' + u0 + ' fit=' + J(u1) + ' resetOn=' + resetOn + ' reset=' + J(u2) + ' page=' + J(u3) + ' resetAll=' + J(u4));

    // C31 (fit39; the user: "fit to page seems to do nothing") Fit to page with ONLY the right-clicked group open, as
    // a person has a comparison (every group starts closed; main.css hides a closed group's box): every column a
    // share, the widths changed, the open table filling its box - then Reset all column widths, every group open again
    wrappers().forEach(function (x) { if (x.getAttribute('data-group-key') !== 'Modified Rows') { var c = x.querySelector('.group-content'); if (c) c.style.display = ''; } });
    await sleep(100);
    var mt31 = wrapperOf('Modified Rows').querySelector('.group-content > table');
    function colWs(t) { return Array.prototype.filter.call(t.querySelectorAll('thead th[data-colname]'), function (h) { return getComputedStyle(h).display !== 'none'; }).map(function (h) { return Math.round(h.getBoundingClientRect().width); }); }
    var firstShut = getComputedStyle(wrapperOf('New Rows').querySelector('.group-content')).display === 'none';
    var w31a = colWs(mt31), ran31 = await choose(th, 'fitPage');
    await sleep(300);
    var w31b = colWs(mt31), u31 = CW.state().user, k31 = Object.keys(u31);
    var shares31 = k31.length >= 2 && k31.every(function (k) { return /%$/.test(String(u31[k])); });
    var box31 = mt31.parentNode, fills31 = Math.abs(mt31.getBoundingClientRect().width - box31.clientWidth) <= 6 && box31.scrollWidth <= box31.clientWidth + 1;
    await choose(th, 'resetWidths');
    await sleep(300);
    openAll();
    rec('C31 Fit to page with only the right-clicked group open (the first one closed, as a comparison starts): every column sized as a share, the open table filling its box',
      firstShut && ran31 && shares31 && J(w31b) !== J(w31a) && fills31 && CW.userDiff().length === 0,
      'firstClosed=' + firstShut + ' ran=' + ran31 + ' widths ' + J(w31a) + ' > ' + J(w31b) + ' shares=' + JSON.stringify(u31) + ' fills=' + fills31 + ' reset=' + J(CW.userDiff()));

    // C17 Consistent row height: the page's switch, ticked as it stands, from a comparison heading; and back
    var b0 = document.body.classList.contains('disable-auto-expand');
    closeMenu(); rclick(th);
    var has17 = !!item('rowHeight'), rh0 = ticked('rowHeight');
    closeMenu();
    await choose(th, 'rowHeight');
    var b1 = document.body.classList.contains('disable-auto-expand');
    closeMenu(); rclick(th);
    var rh1 = ticked('rowHeight');
    closeMenu();
    await choose(th, 'rowHeight');
    var b2 = document.body.classList.contains('disable-auto-expand');
    rec('C17 Consistent row height switches the page\'s row height from a comparison heading (ticked as it stands), and back',
      has17 && rh0 === !b0 && b1 === !b0 && rh1 === !b1 && b2 === b0,
      'item=' + has17 + ' class=' + [b0, b1, b2].join('>') + ' ticked=' + [rh0, rh1].join('>'));

    // C22 a band's Expand this group opens it; Collapse this group closes it again
    var wu2 = wrapperOf('Unchanged Rows'), hu = wu2.querySelector('.group-header'), cu = wu2.querySelector('.group-content');
    wu2.classList.remove('open'); cu.style.display = 'none';
    closeMenu(); rclick(hu);
    var l22a = label('cmpGroupToggle'), it22 = item('cmpGroupToggle');
    if (it22) it22.click();
    await sleep(250);
    var open1 = wu2.classList.contains('open') && cu.style.display !== 'none';
    closeMenu(); rclick(hu);
    var l22b = label('cmpGroupToggle');
    it22 = item('cmpGroupToggle');
    if (it22) it22.click();
    await sleep(250);
    var open2 = wu2.classList.contains('open');
    closeMenu();
    openAll();
    rec('C22 a band\'s Expand this group opens it, then Collapse this group closes it', l22a === 'Expand this group' && open1 && l22b === 'Collapse this group' && !open2,
      'labels=' + J([l22a, l22b]) + ' open=' + [open1, open2].join('>'));

    // C29 a sort from before a re-run is not on the re-rendered rows: the menu ticks none, offers no Clear sort
    // and no Then sort (the page still holds it)
    var ran29 = await choose(headIn(wrapperOf('Modified Rows'), 'NAME'), 'sortDesc');
    await sleep(200);
    var k29a = J(HM().sortKeys()), o29a = J(idsOf('New Rows'));
    await search("NAME != 'Zulu'");
    closeMenu(); rclick(headIn(wrapperOf('Modified Rows'), 'NAME'));
    var t29 = [ticked('sortAsc'), ticked('sortDesc'), !!item('sortClear')];
    closeMenu(); rclick(headIn(wrapperOf('Modified Rows'), 'AMOUNT'));
    var then29 = !!item('thenAsc') || !!item('thenDesc');
    closeMenu();
    var k29b = J(HM().sortKeys()), o29b = J(idsOf('New Rows'));
    await search('');
    // the page's sort back to none, through the menu: a sort on the rows, then Clear sort
    await choose(headIn(wrapperOf('Modified Rows'), 'NAME'), 'sortAsc');
    await choose(headIn(wrapperOf('Modified Rows'), 'NAME'), 'sortClear');
    var k29c = J(HM().sortKeys());
    rec('C29 after a re-run the rows come back unsorted and the menu ticks no sort (no Clear sort, no Then sort)',
      ran29 && k29a === J(['NAME']) && o29a === J(['6', '5']) && k29b === k29a && o29b === J(['5', '6']) && J(t29) === J([false, false, false]) && !then29 && k29c === '[]',
      'keys=' + [k29a, k29b, k29c].join(' -> ') + ' newRows=' + o29a + ' -> ' + o29b + ' ticks=' + J(t29) + ' then=' + then29);

    // C30 a fresh render under the page's sort, its headings marked from that sort by a repaint from elsewhere (the
    // journal's repaint does it, by the report table's column numbers): not the comparison's sort - no tick, no
    // Clear sort, no Then sort
    var fname2 = document.querySelector('#tableHeader th[data-colname="NAME"]');
    HM().sort(fname2, 'asc');   // the page's sort (made on the report's table)
    await sleep(300);
    await search("NAME != 'Zulu'");   // a re-run: a new render, unsorted, under that sort
    var nm30 = headIn(wrapperOf('Modified Rows'), 'NAME');
    if (nm30) nm30.classList.add('sorted');   // ...its name marked, as such a repaint marks it
    var marked30 = document.querySelectorAll('#snapshotComparisonContainer thead th.sorted').length, k30 = J(HM().sortKeys());
    closeMenu(); rclick(nm30);
    var t30 = [ticked('sortAsc'), ticked('sortDesc'), !!item('sortClear')];
    closeMenu(); rclick(headIn(wrapperOf('Modified Rows'), 'AMOUNT'));
    var then30 = !!item('thenAsc') || !!item('thenDesc');
    closeMenu();
    if (nm30) nm30.classList.remove('sorted');
    // ...until the menu sorts this render: then its tick and Clear sort show (the check is never vacuous)
    var ran30 = await choose(nm30, 'sortDesc');
    await sleep(200);
    closeMenu(); rclick(headIn(wrapperOf('Modified Rows'), 'NAME'));
    var pos30 = ticked('sortDesc') && !!item('sortClear');
    closeMenu();
    await choose(headIn(wrapperOf('Modified Rows'), 'NAME'), 'sortClear');
    await search('');
    HM().sort(fname2, null);
    await sleep(300);
    rec('C30 a re-run render under the page\'s sort, its headings marked from it elsewhere, is not taken as sorted (no tick, Clear sort or Then sort) until the menu sorts it',
      marked30 > 0 && k30 === J(['NAME']) && J(t30) === J([false, false, false]) && !then30 && ran30 && pos30 && J(HM().sortKeys()) === '[]',
      'marked=' + marked30 + ' keys=' + k30 + ' ticks=' + J(t30) + ' then=' + then30 + ' sorted=' + ran30 + '/' + pos30 + ' after=' + J(HM().sortKeys()));

    // C18 a cell's Filter to: the comparison runs again over the rows that match, on both sides
    var ran18 = await chooseRerun(cellIn(wrapperOf('Modified Rows'), '3', 'NAME'), 'cellFilter');
    var k18 = J(keys()), i18 = J(idsOf('Modified Rows')), q18 = box().value;
    await search('');
    var k18b = J(keys());
    rec('C18 a cell\'s Filter to runs the comparison again over the matching rows: Modified Rows holds ID 3 alone (both sides filtered)',
      ran18 && k18 === J(['Modified Rows']) && i18 === J(['3']) && /NAME/.test(q18) && /Charlie/.test(q18) && !/!=/.test(q18) && k18b === ALL4,
      'groups=' + k18 + ' ids=' + i18 + ' box=' + J(q18) + ' cleared=' + k18b);

    // C19 a cell's Exclude: the value's rows leave, every other row stays
    var ran19 = await chooseRerun(cellIn(wrapperOf('Unchanged Rows'), '1', 'NAME'), 'cellExclude');
    var s19 = J([keys(), idsOf('Unchanged Rows'), idsOf('Modified Rows')]), q19 = box().value;
    await search('');
    rec('C19 a cell\'s Exclude leaves its value out: Unchanged Rows keeps ID 2, the other groups stay',
      ran19 && s19 === J([JSON.parse(ALL4), ['2'], ['3', '4']]) && /!=/.test(q19) && /Alpha/.test(q19),
      'after=' + s19 + ' box=' + J(q19));

    // C20 Show only this group: the comparison's own group condition - one group renders, its rows in full
    var ran20 = await chooseRerun(bandOf('Modified Rows'), 'cmpGroupOnly');
    var a20 = [J(keys()), box().value, J(idsOf('Modified Rows'))];
    await search('');
    rec('C20 Show only this group writes the comparison\'s own group condition: Modified Rows alone renders, both its rows',
      ran20 && a20[0] === J(['Modified Rows']) && a20[1] === "__SNAP_TYPE = 'Modified Rows'" && a20[2] === J(['3', '4']), 'after=' + J(a20));

    // C25 ...in place of another group's condition
    await search("__SNAP_TYPE = 'New Rows' and __SNAP_TYPE = 'Modified Rows'");
    var k25a = J(keys());
    var ran25 = await chooseRerun(bandOf('Modified Rows'), 'cmpGroupOnly');
    var a25 = [k25a, J(keys()), box().value];
    await search('');
    rec('C25 Show only this group takes the place of another group\'s condition', ran25 && a25[0] === J(['New Rows', 'Modified Rows']) && a25[1] === J(['Modified Rows'])
      && a25[2] === "__SNAP_TYPE = 'Modified Rows'", 'states=' + J(a25));

    // C26 ...beside the filter box's data conditions, which stay
    await search("NAME != 'Zulu'");
    var k26a = J(keys());
    var ran26 = await chooseRerun(bandOf('Modified Rows'), 'cmpGroupOnly');
    var a26 = [k26a, J(keys()), box().value, J(idsOf('Modified Rows'))];
    await search('');
    rec('C26 Show only this group keeps the filter box\'s data conditions', ran26 && a26[0] === ALL4 && a26[1] === J(['Modified Rows'])
      && a26[2] === "NAME != 'Zulu' and __SNAP_TYPE = 'Modified Rows'" && a26[3] === J(['3', '4']), 'states=' + J(a26));

    // C27 ...and leaves an "or" query alone (one more condition would bind to its last branch), saying why
    await search("NAME = 'Alpha' or NAME = 'Bravo'");
    var k27 = J(keys()), q27a = box().value, c27 = document.getElementById('snapshotComparisonContainer');
    // the notice as the page is asked for it (on screen it may queue behind earlier steps' Undo cards: three show at once)
    var said = [], st0 = window.show_text;
    window.show_text = function (h) { said.push(String(h)); return st0.apply(this, arguments); };
    var ran27 = await choose(bandOf('Unchanged Rows'), 'cmpGroupOnly');
    await sleep(700);
    window.show_text = st0;
    var q27b = box().value, same27 = document.getElementById('snapshotComparisonContainer') === c27;
    var told27 = said.some(function (h) { return /holds an "or" query/.test(h); });
    await search('');
    rec('C27 Show only this group leaves an "or" query in the box as it is, and says why', ran27 && k27 === J(['Unchanged Rows']) && q27b === q27a && same27 && told27,
      'ran=' + ran27 + ' groups=' + k27 + ' box=' + J([q27a, q27b]) + ' same=' + same27 + ' told=' + told27 + ' said=' + J(said.map(function (h) { return h.slice(0, 80); })));

    // C21 Hide this group: the band's x - the group leaves, its condition in the filter box
    var ran21 = await chooseRerun(bandOf('New Rows'), 'cmpGroupHide');
    var k21 = J(keys()), q21 = box().value;
    await search('');
    var k21b = J(keys());
    rec('C21 Hide this group runs the band\'s x: New Rows leaves, its condition in the filter box', ran21 && k21 === J(['Removed Rows', 'Modified Rows', 'Unchanged Rows'])
      && q21 === "__SNAP_TYPE != 'New Rows'" && k21b === ALL4, 'groups=' + k21 + ' box=' + J(q21) + ' cleared=' + k21b);

    // C11 Clear snapshot comparison: the page's own Clear - back to the report's table
    th = headIn(wrapperOf('Modified Rows'), 'AMOUNT');
    await choose(th, 'cmpClear');
    var cleared = await waitFor(function () { return !document.body.classList.contains('snapshot-comparison-active'); }, 8000);
    await sleep(300);
    var rt = document.getElementById('resultsTable');
    rec('C11 Clear snapshot comparison leaves the comparison for the report\'s table', cleared && !document.querySelector('#snapshotComparisonContainer .group-wrapper') && !!rt && rt.style.display !== 'none',
      'cleared=' + cleared + ' wrappers=' + wrappers().length);

    // C12 after it: a heading of the report's table opens its usual menu, not the comparison's
    var fth = document.querySelector('#tableHeader th[data-colname="AMOUNT"]');
    closeMenu();
    rclick(fth);
    var a12 = acts();
    closeMenu();
    rec('C12 once cleared, the report\'s headings open their usual menu', cleared && a12.length > 0 && a12.indexOf('cmpClear') < 0 && a12.indexOf('sortAsc') >= 0, 'acts=' + J(a12.slice(0, 8)));
  }

  (async function () {
    try {
      if (!H.runCmp || !H.compress) { finish('hook: a comparison entry point is not exported'); return; }
      await main();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
