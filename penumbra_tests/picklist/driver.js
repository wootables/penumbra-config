// picklist suite - browser half (2026-11-11, PICKLIST_SPEC.md). Runs ONE scenario (?scn=) against the main.js and
// js/penumbra_fields.js the page loaded, on jrowfeat's 36-row fixture (key PROTOCOL NO. + PROTOCOL TYPE, one toggle
// "Reviewed", row notes on) with a "Progress" pick list: Not started (o1), Waiting on PI (o2, once "Waiting"), Done (o3),
// Withdrawn (o4, retired). The fake server (harness.html) holds K3 = Waiting on PI, K5 = Done, K7 = Withdrawn.
// Publishes window.__JRRESULT = { scn, asserts, errors, ... } and window.__JRDONE = true for run.py.
(function () {
  var JR = window.__JR || {};
  var SCN = window.__SCN;
  var FX = window.__rowsFixture;
  var R = { scn: SCN, asserts: [] };
  var SENT = '__JOURNAL_FIELD__status', TSENT = '__JOURNAL_TOGGLE__toggle1';
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JR_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 })); }
  function keyEl(el, key, extra) {
    var o = { key: key, bubbles: true, cancelable: true };
    for (var k in (extra || {})) o[k] = extra[k];
    el.dispatchEvent(new KeyboardEvent('keydown', o));
  }
  function keyOf(i) { return window.__keyOf(FX[i]); }
  var K = { 1: keyOf(0), 3: keyOf(2), 5: keyOf(22), 7: keyOf(6) };
  var LBL = { o1: 'Not started', o2: 'Waiting on PI', o3: 'Done', o4: 'Withdrawn' };
  function serverVal(rk) { var m = (window.__J.fields || {}).status || {}; return m[rk] ? m[rk].v : null; }
  function wantLabel(rk) { var v = serverVal(rk); return v ? LBL[v] : ''; }
  function rowIndexOf(tr) {
    var a = tr.getAttribute('data-row-index');
    if (a !== null && a !== '') return parseInt(a, 10);
    var h = tr.querySelector(":scope > td[data-column='#']");
    return h ? parseInt(h.textContent, 10) - 1 : NaN;
  }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  function flatCellFor(rk) {
    var bs = document.querySelectorAll('#resultsTable .journal-field-cell');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i];
    return null;
  }
  function anyCellFor(rk, scope) {
    var bs = (scope || document).querySelectorAll('.journal-field-cell');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk && bs[i].getClientRects().length) return bs[i];
    return null;
  }
  function menuEl() { return document.querySelector('.pnb-hm[role="menu"]'); }
  function menuLabels() {
    var m = menuEl();
    return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (it) { return (it.querySelector('.pnb-hm-label') || it).textContent.trim(); }) : null;
  }
  function menuItem(label) {
    var m = menuEl(), its = m ? m.querySelectorAll('.pnb-hm-item') : [];
    for (var i = 0; i < its.length; i++) if ((its[i].querySelector('.pnb-hm-label') || its[i]).textContent.trim() === label) return its[i];
    return null;
  }
  async function pick(btn, label) {
    clickEl(btn);
    await until(function () { return !!menuItem(label); }, 3000);
    var it = menuItem(label);
    if (!it) return false;
    clickEl(it);
    await sleep(250);
    return true;
  }
  function lastPost() { var p = window.__J.fieldPosts || []; return p.length ? p[p.length - 1] : null; }
  function toastText() { var t = document.getElementById('action_overlay'); return t ? t.textContent : ''; }
  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }
  async function search(q) {
    $('#tableSearch').val(q);
    if (JR.runTableSearch) JR.runTableSearch();
    await sleep(400);
    return flatRows().filter(function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none'; }).map(rowIndexOf);
  }
  function bandNames() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer > .group-wrapper > .group-header .group-name'), function (n) { return n.textContent.trim(); });
  }
  function bandOf(name) {
    var ws = document.querySelectorAll('#groupedResultsContainer > .group-wrapper');
    for (var i = 0; i < ws.length; i++) { var n = ws[i].querySelector(':scope > .group-header .group-name'); if (n && n.textContent.trim() === name) return ws[i]; }
    return null;
  }
  function bandRowIdx(name) {
    var w = bandOf(name);
    return w ? Array.prototype.map.call(w.querySelectorAll('.group-content > table > tbody > tr[data-row-index]'), rowIndexOf) : [];
  }

  var S = {};
  // The column, its cells and what they show; the toggles' as before; the readers main.js asks.
  S.flat = async function () {
    var hdr = document.getElementById('tableHeader');
    var cols = Array.prototype.map.call(hdr.children, function (th) { return th.getAttribute('data-column'); });
    var ti = cols.indexOf(TSENT), fi = cols.indexOf(SENT), ni = cols.indexOf('__JOURNAL_NOTES');
    var th = hdr.querySelector('th[data-column="' + SENT + '"]');
    rec('F-head', fi > ti && fi < ni && th && th.textContent.replace(/[▲▼]/g, '').trim() === 'Progress' && th.classList.contains('journal-field-col'),
        'header: ' + cols.join(',') + ' | text ' + (th ? th.textContent : 'none'));
    var bad = [], n = 0;
    flatRows().forEach(function (tr) {
      var idx = rowIndexOf(tr), rk = keyOf(idx), tds = tr.querySelectorAll(':scope > td[data-column="' + SENT + '"]');
      if (tds.length !== 1) { bad.push('row ' + (idx + 1) + ': ' + tds.length + ' cells'); return; }
      var b = tds[0].querySelector('.journal-field-cell');
      var txt = tds[0].textContent.trim(), want = wantLabel(rk);
      if (!b || b.getAttribute('data-row-key') !== rk) bad.push('row ' + (idx + 1) + ': key');
      if (txt !== want) bad.push('row ' + (idx + 1) + ': "' + txt + '" want "' + want + '"');
      if ((tds[0].getAttribute('data-field-value') || '') !== (serverVal(rk) || '')) bad.push('row ' + (idx + 1) + ': data-field-value');
      n++;
    });
    rec('F-cells', !bad.length && n === 36, bad.slice(0, 5).join('; ') || n + ' rows');
    var c3 = flatCellFor(K[3]), c7 = flatCellFor(K[7]), c1 = flatCellFor(K[1]);
    var p3 = c3 && c3.querySelector('.pnb-pick-pill');
    rec('F-pill', p3 && p3.getAttribute('data-pick-color') === 'amber' && c7 && c7.classList.contains('is-retired') && c1 && c1.classList.contains('is-empty')
        && /Progress, row .*: Waiting on PI, set by lee/.test(c3.getAttribute('aria-label') || ''),
        (c3 ? c3.outerHTML.slice(0, 300) : 'no K3 cell'));
    // the toggles as before
    var tb3 = document.querySelector('#resultsTable .journal-toggle-box[data-row-key="' + CSS.escape(K[3]) + '"]');
    var tb1 = document.querySelector('#resultsTable .journal-toggle-box[data-row-key="' + CSS.escape(K[1]) + '"]');
    rec('F-toggles', tb3 && tb3.getAttribute('aria-checked') === 'true' && tb1 && tb1.getAttribute('aria-checked') === 'false'
        && document.querySelectorAll('#resultsTable td[data-column="' + TSENT + '"] .journal-field-cell').length === 0,
        'K3 ' + (tb3 && tb3.getAttribute('aria-checked')) + ' K1 ' + (tb1 && tb1.getAttribute('aria-checked')));
    // what main.js's readers get
    var P = window.Penumbra, master = JR.master ? JR.master() : null;
    var m3 = master && master[2], m1 = master && master[0], m7 = master && master[6];
    var v3 = P.journalSearchColumnValue(m3, 'PROGRESS'), v1 = P.journalSearchColumnValue(m1, SENT.toUpperCase());
    rec('F-resolver', v3 && v3.kind === 'text' && v3.value === 'Waiting on PI' && typeof v3.mapWant === 'function' && v1 && v1.value === '',
        JSON.stringify(v3) + ' / ' + JSON.stringify(v1));
    var lab = P.journalToggleGroupLabel('PROGRESS');
    rec('F-labeller', !!lab && lab(m3) === 'Waiting on PI' && lab(m7) === 'Withdrawn' && lab(m1) === '[Blank]' && P.journalToggleGroupLabel(SENT) !== null,
        lab ? [lab(m3), lab(m7), lab(m1)].join(' | ') : 'no labeller');
    rec('F-values', JSON.stringify(P.journalFieldValues('PROGRESS')) === JSON.stringify(['Not started', 'Waiting on PI', 'Done'])
        && P.journalFieldValues('REVIEWED') === null && JSON.stringify(P.journalToggleValues('PROGRESS')) === 'null',
        JSON.stringify(P.journalFieldValues('PROGRESS')));
    rec('F-friendly', P.journalFriendlyCol(SENT) === 'Progress' && P.journalColKind('Progress') === 'field' && P.journalColKind('Status') === null, P.journalFriendlyCol(SENT) + ' / ' + P.journalColKind('Progress') + ' / the real STATUS column: ' + P.journalColKind('Status'));
    var td3 = c3 && c3.closest('td');
    rec('F-export', td3 && P.journalExportCell(td3) === null && td3.textContent.trim() === 'Waiting on PI', 'export cell ' + (td3 && P.journalExportCell(td3)));
    // the toggle readers never see the field
    var tv = P.journalSearchColumnValue(m3, 'REVIEWED');
    rec('F-isolation', tv && tv.kind === 'toggle' && tv.on === true && !Object.prototype.hasOwnProperty.call(window._penumbraToggleState, 'status')
        && !(window._penumbraJournalToggles || []).some(function (t) { return t.key === 'status'; }),
        JSON.stringify(tv) + ' toggle state keys ' + Object.keys(window._penumbraToggleState).join(','));
  };
  // The picker: the options that can be picked, Clear; a pick saved with the value the page showed as prev.
  S.pick = async function () {
    var c1 = flatCellFor(K[1]);
    clickEl(c1);
    await until(function () { return !!menuEl(); }, 3000);
    var labels = menuLabels();
    var clr = menuItem('Clear');
    rec('P-menu', JSON.stringify(labels) === JSON.stringify(['Not started', 'Waiting on PI', 'Done', 'Clear']) && clr && clr.getAttribute('aria-disabled') === 'true'
        && c1.getAttribute('aria-expanded') === 'true', JSON.stringify(labels));
    clickEl(menuItem('Done'));
    await until(function () { return (window.__J.fieldPosts || []).length > 0; }, 3000);
    await sleep(200);
    var post = lastPost(), cell = flatCellFor(K[1]);
    rec('P-save', post && post.toggle_key === 'status' && post.row_key === K[1] && post.value === 'o3' && post.prev === null
        && JSON.stringify(post.key_cols) === JSON.stringify(['PROTOCOL NO.', 'PROTOCOL TYPE']),
        JSON.stringify(post));
    rec('P-shows', cell && cell.textContent.trim() === 'Done' && serverVal(K[1]) === 'o3' && window._penumbraFieldState.status[K[1]].v === 'o3' && cell === c1,
        (cell ? cell.textContent : 'no cell') + ' | same element ' + (cell === c1));
    await pick(flatCellFor(K[1]), 'Clear');
    await sleep(200);
    post = lastPost();
    rec('P-clear', post && post.value === null && post.prev === 'o3' && flatCellFor(K[1]).textContent.trim() === '' && serverVal(K[1]) === null, JSON.stringify(post));
    // picking what the row holds sends nothing
    var n = window.__J.fieldPosts.length;
    clickEl(flatCellFor(K[5]));
    await until(function () { return !!menuItem('Done'); }, 3000);
    var dn = menuItem('Done');
    rec('P-checked', dn && dn.getAttribute('aria-checked') === 'true', dn ? dn.outerHTML.slice(0, 200) : 'none');
    clickEl(dn);
    await sleep(300);
    rec('P-same', window.__J.fieldPosts.length === n, 'posts ' + n + ' -> ' + window.__J.fieldPosts.length);
  };
  // Someone changed the row since the page loaded: not saved, theirs shown, "Set ... anyway" sends theirs as prev.
  S.conflict = async function () {
    window.__J.fields.status[K[3]] = { v: 'o1', by: 'pat', at: '2026-11-11 10:42:00' };
    await pick(flatCellFor(K[3]), 'Done');
    await sleep(300);
    var post = lastPost(), cell = flatCellFor(K[3]);
    rec('C-refused', post && post.prev === 'o2' && post.value === 'o3' && serverVal(K[3]) === 'o1' && cell.textContent.trim() === 'Not started',
        JSON.stringify(post) + ' | cell ' + cell.textContent);
    var any = document.querySelector('.pnb-field-anyway');
    rec('C-toast', !!any && /Set Done anyway/.test(any.textContent) && /changed to Not started by pat/.test(toastText()), toastText().slice(0, 300));
    if (any) clickEl(any);
    await sleep(400);
    post = lastPost();
    rec('C-anyway', post && post.prev === 'o1' && post.value === 'o3' && serverVal(K[3]) === 'o3' && flatCellFor(K[3]).textContent.trim() === 'Done', JSON.stringify(post));
  };
  // A refused save puts the value back and says why.
  S.failure = async function () {
    window.__FIELD_FAIL = true;
    await pick(flatCellFor(K[1]), 'Done');
    await sleep(300);
    rec('X-revert', flatCellFor(K[1]).textContent.trim() === '' && !window._penumbraFieldState.status[K[1]] && /need an update/.test(toastText()), toastText().slice(0, 200));
  };
  // Filter: = / != / empty / an old option label.
  S.filter = async function () {
    var a = await search('Progress = "Waiting on PI"');
    var b = await search('Progress = Waiting');
    var c = await search('Progress = empty');
    var d = await search('Progress != Done');
    rec('S-equals', a.length === 1 && a[0] === 2, JSON.stringify(a));
    rec('S-oldlabel', b.length === 1 && b[0] === 2, JSON.stringify(b));
    rec('S-empty', c.length === 33, c.length + ' rows');
    rec('S-notequals', d.length === 35 && d.indexOf(22) < 0, d.length + ' rows');
  };
  // Saved grouped by the pick list: bands in option order, [Blank] last; a pick moves the row.
  S.group = async function () {
    await until(function () { return bandNames().length >= 4; }, 5000);
    var names = bandNames();
    rec('G-order', JSON.stringify(names) === JSON.stringify(['Waiting on PI', 'Done', 'Withdrawn', '[Blank]']), JSON.stringify(names));
    var blank = bandOf('[Blank]'), c1 = anyCellFor(K[1], blank);
    if (!c1) { var cnt = blank && blank.querySelector('.group-header'); if (cnt) clickEl(cnt); await sleep(300); c1 = anyCellFor(K[1], bandOf('[Blank]')); }
    rec('G-cell', !!c1, c1 ? 'found K1 in [Blank]' : 'K1 not shown in [Blank]');
    if (c1) await pick(c1, 'Done');
    await until(function () { return bandRowIdx('Done').indexOf(0) >= 0; }, 4000);
    rec('G-moves', bandRowIdx('Done').indexOf(0) >= 0 && bandRowIdx('[Blank]').indexOf(0) < 0, 'Done band rows ' + JSON.stringify(bandRowIdx('Done')));
  };
  // A sort on the column: the options' order, the blanks after them.
  S.sort = async function () {
    var th = document.querySelector('#tableHeader th[data-column="' + SENT + '"]');
    clickEl(th);
    await sleep(600);
    var seq = flatRows().map(function (tr) { var c = tr.querySelector('td[data-column="' + SENT + '"]'); return c ? c.textContent.trim() : '?'; });
    rec('O-order', JSON.stringify(seq.slice(0, 4)) === JSON.stringify(['Waiting on PI', 'Done', 'Withdrawn', '']), JSON.stringify(seq.slice(0, 6)));
  };
  // Hover history: field_history's events, the option labels as they were.
  S.hist = async function () {
    var c3 = flatCellFor(K[3]);
    c3.focus();
    await until(function () { var p = document.getElementById('pnbFieldHistPop'); return p && p.style.display !== 'none' && /to Waiting/.test(p.textContent); }, 3000);
    var p = document.getElementById('pnbFieldHistPop');
    rec('H-pop', p && /Waiting on PI, set by lee/.test(p.textContent) && /not set to Waiting/.test(p.textContent), p ? p.textContent.slice(0, 200) : 'none');
    rec('H-asked', (window.__ajaxLog || []).some(function (u) { return /action=field_history&report_id=jrfix&row_key=/.test(u) && /toggle_key=status/.test(u); }), (window.__ajaxLog || []).filter(function (u) { return /history/.test(u); }).join(' '));
  };
  // Up / Down between the column's cells; Alt+Down opens the picker.
  S.kbd = async function () {
    var c1 = flatCellFor(K[1]);
    c1.focus();
    keyEl(c1, 'ArrowDown');
    await sleep(80);
    var nxt = document.activeElement;
    rec('K-down', nxt && nxt.classList.contains('journal-field-cell') && nxt.getAttribute('data-row-key') === keyOf(1), nxt ? nxt.getAttribute('data-row-key') : 'none');
    keyEl(nxt, 'ArrowDown', { altKey: true });
    await until(function () { return !!menuEl(); }, 2000);
    rec('K-open', !!menuEl(), JSON.stringify(menuLabels()));
  };
  // The who / when columns read the pick list's values.
  S.who = async function () {
    var r3 = flatRows()[2];
    var by = r3.querySelector('td[data-column="__JOURNAL_BY__status"]'), on = r3.querySelector('td[data-column="__JOURNAL_ON__status"]');
    rec('W-cells', by && by.textContent === 'lee' && on && on.textContent === '2026-11-11', (by ? by.textContent : 'no by') + ' / ' + (on ? on.textContent : 'no on'));
    var tby = r3.querySelector('td[data-column="__JOURNAL_BY__toggle1"]');
    rec('W-toggle', tby && tby.textContent === 'pat', tby ? tby.textContent : 'no toggle by');
  };
  // The table has no FIELD_VALUE yet: cells disabled with the reason, Add pick list says what to run.
  S.notready = async function () {
    if (window.Penumbra.syncJournalRowConfigUI) window.Penumbra.syncJournalRowConfigUI();
    await sleep(200);
    var c3 = flatCellFor(K[3]);
    rec('N-cell', c3 && c3.disabled && /need an update/.test(c3.getAttribute('title') || ''), c3 ? c3.getAttribute('title') : 'none');
    clickEl(document.getElementById('journalAddFieldBtn'));
    await sleep(300);
    rec('N-add', /ALTER TABLE NC_REPORTING\.PENUMBRA_JOURNAL_TOGGLE ADD \(FIELD_VALUE/.test($('#journalFieldStatus').text()) && window._penumbraJournalFields.length === 1,
        $('#journalFieldStatus').text().slice(0, 200));
  };
  // A report with no pick list: no column, the toggles as before.
  S.nofields = async function () {
    rec('Z-none', !document.querySelector('[data-column^="__JOURNAL_FIELD__"]') && document.querySelectorAll('#resultsTable .journal-toggle-box[aria-checked="true"]').length === 2,
        document.querySelectorAll('[data-column^="__JOURNAL_FIELD__"]').length + ' field cells');
  };
  // The setup editor: add a pick list, rename an option (its old name kept), retire one some rows hold, remove one none
  // hold, the save writes them and the restore reads them back.
  S.setup = async function () {
    if (window.Penumbra.syncJournalRowConfigUI) window.Penumbra.syncJournalRowConfigUI();
    await sleep(200);
    var lst = document.getElementById('journalFieldList');
    rec('E-render', lst && lst.querySelectorAll('.journal-field-def').length === 1 && lst.querySelectorAll('.journal-field-opt:not(.is-retired)').length === 3
        && /Retired: 1 row/.test(lst.textContent), lst ? lst.textContent.replace(/\s+/g, ' ').slice(0, 200) : 'no list');
    clickEl(document.getElementById('journalAddFieldBtn'));
    await until(function () { return (window._penumbraJournalFields || []).length === 2; }, 3000);
    await sleep(300);
    var f2 = window._penumbraJournalFields[1];
    rec('E-add', f2 && f2.label === 'Status 2' && f2.options.length === 3 && f2.key !== 'status' && f2.key !== 'toggle1'
        && document.querySelector('#tableHeader th[data-column="__JOURNAL_FIELD__' + f2.key + '"]'),
        JSON.stringify(f2));
    var o1 = lst.querySelector('.journal-field-def[data-key="status"] li[data-id="o1"] .journal-field-opt-label');
    o1.value = 'Queued';
    $(o1).trigger('change');
    await sleep(200);
    var d1 = window._penumbraJournalFields[0];
    rec('E-rename', d1.options[0].label === 'Queued' && JSON.stringify(d1.options[0].oldLabels) === '["Not started"]', JSON.stringify(d1.options[0]));
    clickEl(lst.querySelector('.journal-field-def[data-key="status"] li[data-id="o2"] .journal-field-opt-remove'));
    await sleep(200);
    d1 = window._penumbraJournalFields[0];
    var o2 = d1.options.filter(function (o) { return o.id === 'o2'; })[0];
    rec('E-retire', o2 && o2.retired === true && flatCellFor(K[3]).textContent.trim() === 'Waiting on PI' && flatCellFor(K[3]).classList.contains('is-retired'),
        JSON.stringify(o2));
    clickEl(document.querySelector('#journalFieldList .journal-field-def[data-key="status"] li[data-id="o1"] .journal-field-opt-remove'));
    await sleep(200);
    d1 = window._penumbraJournalFields[0];
    rec('E-remove', !d1.options.some(function (o) { return o.id === 'o1'; }), JSON.stringify(d1.options.map(function (o) { return o.id; })));
    if (JR.buildStateObject) {
      var cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) cm.CodeMirror.setValue('SELECT * FROM JR_FIXTURE');
      else $('#sqlQuery').val('SELECT * FROM JR_FIXTURE');
      var st = JR.buildStateObject();
      var jf = st && st.viewOptions && st.viewOptions.journalFields;
      rec('E-save', jf && jf.length === 2 && jf[0].key === 'status' && jf[0].options.some(function (o) { return o.id === 'o2' && o.retired === true; })
          && jf[1].type === 'pick', String(JSON.stringify(jf || (st ? st.viewOptions : 'no state'))).slice(0, 300));
    } else rec('E-save', false, 'buildStateObject not hooked');
    var clean = JR.penumbraCleanJournalFields ? JR.penumbraCleanJournalFields([
        { key: 'toggle1', type: 'pick', label: 'Clash' }, { key: 'Stage!', type: 'pick', label: '', options: [{ id: 'o1', label: 'A', color: 'pink' }, { id: 'x', label: 'B' }, { id: 'o1', label: 'dup' }] },
        { key: 'later', type: 'date', label: 'Later' }], [{ key: 'toggle1' }]) : null;
    rec('E-clean', clean && clean.length === 1 && clean[0].key === 'stage' && clean[0].label === 'Status' && clean[0].options.length === 1 && clean[0].options[0].color === '',
        JSON.stringify(clean));
  };

  // ---- phase 2 (2026-11-11): the row's menu, a heading's bulk set, cards -------------------------------------------
  function rclick(el) {
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, button: 2, buttons: 2,
      clientX: Math.round(r.left + Math.min(8, r.width / 2)), clientY: Math.round(r.top + r.height / 2) }));
  }
  function actItem(act, root) { root = root || menuEl(); return root ? root.querySelector('.pnb-hm-item[data-act="' + act + '"]') : null; }
  function itemLabel(it) { return it ? (it.querySelector('.pnb-hm-label') || it).textContent.trim() : null; }
  function subEl() { var s = document.querySelectorAll('.pnb-hm.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function subLabels() { var m = subEl(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), itemLabel) : null; }
  function subItem(label) { var m = subEl(), its = m ? m.querySelectorAll('.pnb-hm-item') : []; for (var i = 0; i < its.length; i++) if (itemLabel(its[i]) === label) return its[i]; return null; }
  function closeMenu() { var CM = window.Penumbra.colMenu; if (CM && CM.close) CM.close(); }
  function bulkPosts() { return (window.__J.fieldPosts || []).filter(function (p) { return p && p.values; }); }
  function keptRows() { return flatRows().filter(function (tr) { return !tr.classList.contains('search-hidden'); }); }
  function headTh() { return document.querySelector('#tableHeader th[data-column="' + SENT + '"]'); }
  S.rowmenu = async function () {
    var tr = flatCellFor(K[1]).closest('tr'), td = null;
    Array.prototype.forEach.call(tr.cells, function (c) { var d = c.getAttribute('data-column') || ''; if (!td && d && d !== '#' && d.indexOf('__JOURNAL') !== 0) td = c; });
    rclick(td);
    await until(function () { return !!actItem('field-status'); }, 3000);
    var it = actItem('field-status');
    rec('R-item', it && itemLabel(it) === 'Progress' && it.getAttribute('aria-haspopup') === 'menu', it ? it.outerHTML.slice(0, 200) : JSON.stringify(menuLabels()));
    if (!it) return;
    clickEl(it);
    await until(function () { return !!subItem('Done'); }, 3000);
    rec('R-sub', JSON.stringify(subLabels()) === JSON.stringify(['Not started', 'Waiting on PI', 'Done', 'Clear']), JSON.stringify(subLabels()));
    if (subItem('Done')) clickEl(subItem('Done'));
    await until(function () { return (window.__J.fieldPosts || []).length > 0; }, 3000);
    await sleep(250);
    var post = lastPost();
    rec('R-save', post && post.row_key === K[1] && post.value === 'o3' && post.prev === null && flatCellFor(K[1]).textContent.trim() === 'Done', JSON.stringify(post));
    closeMenu();
    await sleep(100);
    rclick(headTh());
    await until(function () { return !!menuEl(); }, 3000);
    await sleep(100);
    rec('R-head', !document.querySelector('.pnb-hm-item[data-act^="field-"]') && !!actItem('fieldBulk'), JSON.stringify(menuLabels()));
  };
  S.bulk = async function () {
    var asked = [];
    window.confirm = function (m) { asked.push(m); return true; };
    rclick(headTh());
    await until(function () { return !!actItem('fieldBulk'); }, 3000);
    var it = actItem('fieldBulk'), first = menuEl() ? menuEl().querySelector('.pnb-hm-item') : null, n = keptRows().length;
    rec('B-item', it && itemLabel(it) === 'Set Progress for ' + n + ' shown rows' && first === it, (it ? itemLabel(it) : 'none') + ' | rows ' + n + ' | first ' + (first ? first.getAttribute('data-act') : '-'));
    if (!it) return;
    clickEl(it);
    await until(function () { return !!subItem('Done'); }, 3000);
    rec('B-sub', JSON.stringify(subLabels()) === JSON.stringify(['Not started', 'Waiting on PI', 'Done', 'Clear']), JSON.stringify(subLabels()));
    if (subItem('Done')) clickEl(subItem('Done'));
    await until(function () { return bulkPosts().length > 0; }, 3000);
    await sleep(300);
    var bp = bulkPosts()[0], ks = bp ? Object.keys(bp.values) : [];
    rec('B-confirm', asked.length === 1 && asked[0].indexOf('Set Progress to Done on ' + (n - 1) + ' rows?') === 0 && asked[0].indexOf('(1 already is Done.)') > 0
        && asked[0].indexOf('lee') > 0 && asked[0].indexOf('pat') > 0 && asked[0].indexOf('kim') < 0, JSON.stringify(asked));
    rec('B-post', bp && bp.toggle_key === 'status' && ks.length === n && ks.every(function (k) { return bp.values[k] === 'o3'; })
        && JSON.stringify(bp.key_cols) === JSON.stringify(['PROTOCOL NO.', 'PROTOCOL TYPE']), bp ? ks.length + ' keys' : 'no post');
    await until(function () { return /DONE:/.test(toastText()); }, 3000);
    var tt = toastText();
    rec('B-toast', tt.indexOf('DONE: ' + (n - 1) + ' rows set to Done (1 already was).') >= 0 && serverVal(K[3]) === 'o3' && flatCellFor(K[3]).textContent.trim() === 'Done', tt);
    var undo = document.querySelector('#action_overlay .pnb-field-anyway');
    if (undo) clickEl(undo);
    await until(function () { return bulkPosts().length > 1; }, 3000);
    await sleep(300);
    var up = bulkPosts()[1];
    rec('B-undo', up && up.values[K[3]] === 'o2' && up.values[K[7]] === 'o4' && up.values[K[1]] === null && !(K[5] in up.values) && serverVal(K[3]) === 'o2' && serverVal(K[1]) === null,
        up ? JSON.stringify({ k3: up.values[K[3]], k7: up.values[K[7]], k1: up.values[K[1]], k5: K[5] in up.values, n: Object.keys(up.values).length }) : 'no undo post');
    closeMenu();
    await search('Progress = empty');
    var m = keptRows().length;
    rclick(headTh());
    await until(function () { return !!actItem('fieldBulk'); }, 3000);
    rec('B-filtered', m > 0 && m < n && itemLabel(actItem('fieldBulk')) === 'Set Progress for ' + m + ' shown rows', itemLabel(actItem('fieldBulk')) + ' | kept ' + m);
    closeMenu();
    // an option named with markup: the menu and the toast write it as text
    var f0 = window._penumbraJournalFields[0];
    window._penumbraJournalFields = [{ key: f0.key, type: 'pick', label: f0.label, options: f0.options.map(function (o) { return o.id === 'o1' ? { id: 'o1', label: '<b>Bold</b>', color: o.color } : o; }) }];
    await sleep(200);
    rclick(headTh());
    await until(function () { return !!actItem('fieldBulk'); }, 3000);
    clickEl(actItem('fieldBulk'));
    await until(function () { return !!subItem('<b>Bold</b>'); }, 3000);
    var nb = bulkPosts().length;
    if (subItem('<b>Bold</b>')) clickEl(subItem('<b>Bold</b>'));
    await until(function () { return bulkPosts().length > nb && /DONE:/.test(toastText()); }, 3000);
    await sleep(300);
    rec('B-escape', toastText().indexOf('set to <b>Bold</b>') >= 0 && !document.querySelector('#action_overlay b'), toastText());
  };
  S.cards = async function () {
    var C = window.Penumbra.cards, PS = SENT.toUpperCase();
    if (!C) { rec('D-pill', false, 'no card view in the page'); return; }
    C.setReport({ title: 'PROTOCOL NO.', pill: PS, fields: [PS, 'PROTOCOL TYPE'] });
    C.set('cards');
    await until(function () { return document.querySelectorAll('#pnbCardsHost .pnb-card').length > 0; }, 6000);
    await sleep(300);
    function cardOf(rk) {
      var b = document.querySelector('#pnbCardsHost .pnb-card-pill .journal-field-cell[data-row-key="' + CSS.escape(rk) + '"]');
      return b ? b.closest('.pnb-card') : null;
    }
    var c1 = cardOf(K[1]), pill = c1 ? c1.querySelector('.pnb-card-pill.has-field > .journal-field-cell') : null;
    var after = pill ? getComputedStyle(pill, '::after').content : '';
    rec('D-pill', pill && pill.classList.contains('is-empty') && after.indexOf('+ Progress') >= 0, (pill ? pill.outerHTML.slice(0, 160) : 'no pill; cards ' + document.querySelectorAll('#pnbCardsHost .pnb-card').length) + ' | ' + after);
    if (!pill) return;
    clickEl(pill);
    await until(function () { return !!menuItem('Done'); }, 3000);
    var det0 = !!document.querySelector('#pnbCardDetails:not([hidden])');
    if (menuItem('Done')) clickEl(menuItem('Done'));
    await until(function () { return (window.__J.fieldPosts || []).length > 0; }, 3000);
    await sleep(500);
    var post = lastPost();
    rec('D-pick', post && post.row_key === K[1] && post.value === 'o3' && !det0, JSON.stringify(post) + ' | details ' + det0);
    c1 = cardOf(K[1]);
    var p2 = c1 ? c1.querySelector('.pnb-card-pill .journal-field-cell') : null;
    rec('D-shows', p2 && p2.textContent.trim() === 'Done' && !p2.classList.contains('is-empty'), p2 ? p2.outerHTML.slice(0, 200) : 'no card');
    var fb = c1 ? c1.querySelector('.pnb-card-fields dd .journal-field-cell') : null;
    rec('D-field', fb && fb.textContent.trim() === 'Done' && fb.getAttribute('data-row-key') === K[1], fb ? fb.outerHTML.slice(0, 160) : 'none');
    var other = Array.prototype.filter.call(document.querySelectorAll('#pnbCardsHost .pnb-card'), function (c) {
      var b = c.querySelector('.pnb-card-pill .journal-field-cell'); return b && b.classList.contains('is-empty');
    })[0];
    rec('D-empty', other && !!other.querySelector('.pnb-card-fields dd .journal-field-cell.is-empty'), other ? other.querySelector('.pnb-card-fields') && other.querySelector('.pnb-card-fields').innerHTML.slice(0, 200) : 'no empty card');
    rclick(c1);
    await until(function () { return !!menuEl(); }, 3000);
    await sleep(150);
    rec('D-menu', !!actItem('field-status'), JSON.stringify(menuLabels()));
    closeMenu();
    await sleep(100);
    C.openDetails(c1);
    // the window's list of fields (its head carries the pill too: the list's own copy is the check)
    await until(function () { return !!document.querySelector('#pnbCardDetails .pnb-cdet-fields dd .journal-field-cell'); }, 3000);
    var db = document.querySelector('#pnbCardDetails .pnb-cdet-fields dd .journal-field-cell');
    rec('D-details', db && db.getAttribute('data-row-key') === K[1] && db.textContent.trim() === 'Done', db ? db.outerHTML.slice(0, 160) : 'none');
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__JR_ERR, window.__JR_ERR2].filter(Boolean).join('; ');
    R.missing = window.__JR_MISSING || [];
    window.__JRRESULT = R;
    window.__JRDONE = true;
    var o = document.getElementById('out'); if (o) o.textContent = 'DONE';
  })();
})();
