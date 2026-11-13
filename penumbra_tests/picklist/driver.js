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
        { key: 'later', type: 'lookup', label: 'Later' }], [{ key: 'toggle1' }]) : null;   // (2026-11-12) 'date' is a type now
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
    // (2026-11-12) its label: the list's name, not the internal one (the card's options, chips and fields share it)
    var ddt = db ? db.closest('dd') : null; ddt = ddt ? ddt.previousElementSibling : null;
    rec('D-label', !!ddt && ddt.textContent.trim() === 'Progress', ddt ? ddt.outerHTML.slice(0, 160) : 'no dt');
  };

  // ---- date columns (2026-11-12, DATE_SPEC.md phase 3a) --------------------------------------------------------------
  // The fixture's "Due" (once "Deadline"): K3 three days ago (lee), K23 in two days (kim), K7 in nine (pat), K10 a value
  // that is not a day; every other row empty.
  var DSENT = '__JOURNAL_FIELD__due', K10 = keyOf(9);
  function dIso(n) { return window.__dIso(n); }
  function dLong(iso) { return window.moment(iso, 'YYYY-MM-DD').format('ddd, MMM D, YYYY'); }
  function dCell(rk, scope) {
    var bs = (scope || document).querySelectorAll('.journal-field-cell[data-toggle-key="due"]');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk && bs[i].getClientRects().length) return bs[i];
    return null;
  }
  function dServer(rk) { var m = (window.__J.fields || {}).due || {}; return m[rk] ? m[rk].v : null; }
  function box() { return document.getElementById('pnbDateBox'); }
  function boxIn() { return document.getElementById('pnbDateBoxIn'); }
  function boxSays() { var s = document.getElementById('pnbDateBoxSays'); return s ? s.textContent : ''; }
  function typeBox(v) { var i = boxIn(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }
  function posts() { return (window.__J.fieldPosts || []).length; }
  S.date = async function () {
    var th = document.querySelector('#tableHeader th[data-column="' + DSENT + '"]');
    rec('T-head', !!th && th.textContent.trim().indexOf('Due') === 0 && /date column/.test(th.getAttribute('title') || ''), th ? th.outerHTML.slice(0, 200) : 'no head');
    var c3 = dCell(K[3]), c10 = dCell(K10), c1 = dCell(K[1]), al3 = c3 ? c3.getAttribute('aria-label') : '';
    rec('T-cells', !!c3 && c3.classList.contains('is-date') && c3.textContent.trim() === dIso(-3) && al3.indexOf(dLong(dIso(-3)) + ' (3 days ago)') >= 0 && /set by lee/.test(al3)
        && !!c10 && c10.textContent.trim() === '(not a date)' && c10.classList.contains('is-unknown') && !!c1 && c1.classList.contains('is-empty') && c1.textContent.trim() === '',
        [c3 && c3.outerHTML.slice(0, 300), c10 && c10.textContent, c1 && c1.className].join(' | '));
    var F = window.Penumbra.fields;
    rec('T-resolver', F.labelOf('due', K[3]) === dIso(-3) && F.optionOrder('Due') === null && F.valuesFor('Due') === null && F.mapWant('due') === null
        && F.isDateCol('Due') && F.isDateCol(DSENT) && !F.isDateCol('Progress') && F.typeOf('due') === 'date' && F.typeOf('status') === 'pick',
        JSON.stringify([F.labelOf('due', K[3]), F.optionOrder('Due'), F.valuesFor('Due'), F.isDateCol('Due'), F.typeOf('due')]));
    var hk = JR._pnbHlKind;
    rec('T-hlkind', !!hk && hk('Due') === 'date' && hk(DSENT) === 'date' && hk('Progress') === 'text', hk ? [hk('Due'), hk(DSENT), hk('Progress')].join(',') : 'not hooked');
    var H = window.Penumbra.journalHost, rv = function (s) { return (H && H.resolveDate) ? H.resolveDate(s) : 'no resolveDate'; };
    var want = [['2026-11-21', '2026-11-21'], ['11/21/2026', '2026-11-21'], ['21-Nov-26', '2026-11-21'], ['TODAY+14', dIso(14)], ['today', dIso(0)], ['tomorrow', dIso(1)],
                ['2 weeks from now', dIso(14)], ['2026-11', null], ['2026', null], ['this fiscal year', null], ['banana', null], ['1899-12-31', null], ['', null]];
    var bad = want.filter(function (w) { return rv(w[0]) !== w[1]; }).map(function (w) { return w[0] + ' -> ' + rv(w[0]); });
    rec('T-resolve', !bad.length, bad.join('; ') || 'all ' + want.length + ' as expected');
    clickEl(c1);
    await until(function () { return !!actItem('date-pick'); }, 3000);
    var labels = menuLabels(), today = actItem('date-today'), clr = actItem('pick-clear');
    var note = today && today.querySelector('.pnb-hm-note') ? today.querySelector('.pnb-hm-note').textContent : '';
    rec('T-menu', JSON.stringify(labels) === JSON.stringify(['Today', 'Tomorrow', 'In a week', 'Pick a date…', 'Clear']) && !!clr && clr.getAttribute('aria-disabled') === 'true'
        && note === window.moment().format('ddd, MMM D') && today.getAttribute('role') === 'menuitemradio' && today.getAttribute('aria-checked') === 'false',
        JSON.stringify(labels) + ' note ' + note);
    if (today) clickEl(today);
    await until(function () { return posts() > 0; }, 3000);
    await sleep(300);
    var p = lastPost();
    rec('T-save', !!p && p.toggle_key === 'due' && p.row_key === K[1] && p.value === dIso(0) && p.prev === null && dServer(K[1]) === dIso(0), JSON.stringify(p));
    c1 = dCell(K[1]);
    rec('T-shows', !!c1 && c1.textContent.trim() === dIso(0) && /\(today\)/.test(c1.getAttribute('aria-label') || ''), c1 ? c1.outerHTML.slice(0, 300) : 'no cell');
    clickEl(c1);
    await until(function () { return !!actItem('date-today'); }, 3000);
    var nm = menuEl() && menuEl().querySelector('.pnb-hm-name') ? menuEl().querySelector('.pnb-hm-name').textContent : '';
    rec('T-checked', !!actItem('date-today') && actItem('date-today').getAttribute('aria-checked') === 'true' && nm === 'Due: ' + window.moment().format('MMM D, YYYY')
        && actItem('pick-clear').getAttribute('aria-disabled') !== 'true', nm);
    if (actItem('pick-clear')) clickEl(actItem('pick-clear'));
    await until(function () { return posts() > 1; }, 3000);
    await sleep(300);
    p = lastPost(); c1 = dCell(K[1]);
    rec('T-clear', !!p && p.value === null && p.prev === dIso(0) && !!c1 && c1.classList.contains('is-empty'), JSON.stringify(p));
    var hi = window.Penumbra.fields.headerItem(th);
    rec('T-headbulk', !!hi && hi.act === 'fieldBulk' && /^Set Due for \d+ shown rows$/.test(hi.label) && !hi.disabled, 'phase 3b: the heading sets many rows: ' + JSON.stringify(hi));
    // a row's right-click: Due > the cell's items; a pick saves the row's day
    closeMenu();
    await sleep(100);
    var rtr = dCell(K[5]).closest('tr'), rtd = null;
    Array.prototype.forEach.call(rtr.cells, function (cc) { var dc = cc.getAttribute('data-column') || ''; if (!rtd && dc && dc !== '#' && dc.indexOf('__JOURNAL') !== 0) rtd = cc; });
    rclick(rtd);
    await until(function () { return !!actItem('field-due'); }, 3000);
    var di = actItem('field-due');
    if (di) { clickEl(di); await until(function () { return !!subItem('Tomorrow'); }, 3000); }
    var sl = subLabels(), rn0 = posts();
    if (subItem('Tomorrow')) clickEl(subItem('Tomorrow'));
    await until(function () { return posts() > rn0; }, 3000);
    await sleep(250);
    var rp = lastPost();
    rec('T-rowmenu', !!di && itemLabel(di) === 'Due' && JSON.stringify(sl) === JSON.stringify(['Today', 'Tomorrow', 'In a week', 'Pick a date…', 'Clear'])
        && !!rp && rp.row_key === K[5] && rp.value === dIso(1) && rp.prev === dIso(2), JSON.stringify([sl, rp]));
  };
  S.datebox = async function () {
    clickEl(dCell(K[1]));
    await until(function () { return !!actItem('date-pick'); }, 3000);
    clickEl(actItem('date-pick'));
    await until(function () { return !!box(); }, 3000);
    await sleep(100);
    rec('X-opens', !!box() && document.activeElement === boxIn() && boxIn().value === '' && /Empty: Save clears Due on this row/.test(boxSays())
        && box().getAttribute('role') === 'dialog' && !!document.querySelector('#pnbDateBox label[for="pnbDateBoxIn"]'),
        boxSays() + ' | active ' + (document.activeElement && (document.activeElement.id || document.activeElement.className)));
    if (!box()) return;
    // the keys a phrase needs reach the box: a handler that cancels a keypress (the datepicker's constrainInput) eats the key
    var blocked = 'TODAY+14 next/'.split('').filter(function (ch) {
      var ev = new KeyboardEvent('keypress', { key: ch, charCode: ch.charCodeAt(0), keyCode: ch.charCodeAt(0), which: ch.charCodeAt(0), bubbles: true, cancelable: true });
      return !boxIn().dispatchEvent(ev);
    });
    rec('X-keys', blocked.length === 0, 'blocked: ' + JSON.stringify(blocked.join('')));
    var saveB = box().querySelector('.pnb-datebox-save');
    typeBox('TODAY+14'); await sleep(50);
    rec('X-phrase', boxSays() === dLong(dIso(14)) + ' (in 14 days)' && !saveB.disabled, boxSays());
    typeBox('banana'); await sleep(50);
    var n0 = posts();
    keyEl(boxIn(), 'Enter'); await sleep(200);
    rec('X-bad', boxSays() === 'Not a date' && saveB.disabled && !!box() && posts() === n0, boxSays());
    typeBox('next friday'); await sleep(50);
    var nf = window.moment().add(1, 'week').day(5).format('YYYY-MM-DD');
    rec('X-nextfri', boxSays().indexOf(dLong(nf)) === 0, boxSays() + ' | the grammar\'s next friday ' + nf);
    typeBox('TODAY+14'); await sleep(50);   // a phrase is saved as its day (DD4)
    keyEl(boxIn(), 'Enter');
    await until(function () { return posts() > n0; }, 3000); await sleep(300);
    var p = lastPost();
    rec('X-save', !!p && p.toggle_key === 'due' && p.row_key === K[1] && p.value === dIso(14) && !box() && document.activeElement === dCell(K[1])
        && dCell(K[1]).textContent.trim() === dIso(14), JSON.stringify(p) + ' | active ' + (document.activeElement && document.activeElement.className));
    var n1 = posts();
    window.Penumbra.fields.openDateBox('due', K[3], dCell(K[3]));
    await until(function () { return !!box(); }, 2000);
    rec('X-current', !!boxIn() && boxIn().value === dIso(-3) && boxSays() === dLong(dIso(-3)) + ' (3 days ago)', boxIn() ? boxIn().value + ' | ' + boxSays() : 'no box');
    if (boxIn()) keyEl(boxIn(), 'Escape');
    await sleep(150);
    rec('X-escape', !box() && posts() === n1 && document.activeElement === dCell(K[3]), 'active ' + (document.activeElement && document.activeElement.outerHTML.slice(0, 120)));
    window.Penumbra.fields.openDateBox('due', K[3], dCell(K[3]));
    await until(function () { return !!box(); }, 2000);
    typeBox(''); await sleep(50);
    clickEl(box().querySelector('.pnb-datebox-save'));
    await until(function () { return posts() > n1; }, 3000); await sleep(300);
    p = lastPost();
    rec('X-clear', !!p && p.row_key === K[3] && p.value === null && p.prev === dIso(-3) && !box(), JSON.stringify(p));
    window.Penumbra.fields.openDateBox('due', K[5], dCell(K[5]));
    await until(function () { return !!box(); }, 2000);
    var cal = box() ? box().querySelector('.pnb-datebox-cal') : null;
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(100);
    rec('X-outside', !box(), box() ? 'still open' : 'closed');
    rec('X-calendar', !!cal && cal.getAttribute('aria-label') === 'Open the calendar', cal ? cal.outerHTML.slice(0, 160) : 'no calendar button');
    window.Penumbra.fields.openDateBox('due', K[5], null);
    await until(function () { return !!box(); }, 2000);
    var r = box() ? box().getBoundingClientRect() : { left: -1, top: -1, right: 0 };
    rec('X-centred', r.left > 50 && r.top > 8 && r.right < window.innerWidth - 8, JSON.stringify([r.left, r.top, r.right, window.innerWidth]));
    if (boxIn()) keyEl(boxIn(), 'Escape');
  };
  S.datefilter = async function () {
    var a = await search('Due < TODAY'), b = await search('Due >= TODAY and Due <= TODAY+3'), c = await search('Deadline < TODAY');
    var d = await search('Due > TODAY+7'), e = await search('Due = empty');
    var mon = dIso(2).slice(0, 7), mWant = [[2, dIso(-3)], [22, dIso(2)], [6, dIso(9)]].filter(function (x) { return x[1].slice(0, 7) === mon; })
        .map(function (x) { return x[0]; }).sort(function (x, y) { return x - y; });
    var mGot = (await search('Due = ' + mon)).sort(function (x, y) { return x - y; });
    rec('Y-month', JSON.stringify(mGot) === JSON.stringify(mWant), JSON.stringify([mon, mGot, mWant]));
    // (3b) a period of the column: Due:ym = 'Nov 2026'; the builder's buckets, its value list and its calendar
    var mlab = window.moment(dIso(2), 'YYYY-MM-DD').format('MMM YYYY');
    var bWant = [[2, dIso(-3)], [22, dIso(2)], [6, dIso(9)]].filter(function (x) { return window.moment(x[1], 'YYYY-MM-DD').format('MMM YYYY') === mlab; })
        .map(function (x) { return x[0]; }).sort(function (x, y) { return x - y; });
    var bGot = (await search("Due:ym = '" + mlab + "'")).sort(function (x, y) { return x - y; });
    rec('Y-bucket', JSON.stringify(bGot) === JSON.stringify(bWant), JSON.stringify([mlab, bGot, bWant]));
    var API = window._penumbraSearchAPI, bv = (API.getBucketVariants('Due') || []).map(function (v) { return v.sx; });
    rec('Y-bucketvars', bv.indexOf(':ym') >= 0 && bv.indexOf(':fy') >= 0 && bv.indexOf(':hour') < 0 && (API.getBucketVariants('PROTOCOL NO.') || []).every(function (v) { return v.sx !== ':ym'; }), JSON.stringify(bv));
    var di = API.getColumnDateInfo('Due'), dx = API.getColumnDateInfo('__JOURNAL_FIELD__due'), dn = API.getColumnDateInfo('Progress');
    rec('Y-calendar', !!di && di.isDate && di.jqFormat === 'yy-mm-dd' && !!dx && dx.isDate && !!dn && !dn.isDate, JSON.stringify([di, dx, dn]));
    var bl = API._computeColumnAutocompleteValues('Due:ym') || [];
    rec('Y-bucketlist', [dIso(-3), dIso(2), dIso(9)].every(function (d) { return bl.indexOf(window.moment(d, 'YYYY-MM-DD').format('MMM YYYY')) >= 0; }), JSON.stringify(bl));
    await search('');
    rec('Y-overdue', JSON.stringify(a) === '[2]', JSON.stringify(a));
    rec('Y-soon', JSON.stringify(b) === '[22]', JSON.stringify(b));
    rec('Y-oldname', JSON.stringify(c) === '[2]', JSON.stringify(c));
    rec('Y-later', JSON.stringify(d) === '[6]', JSON.stringify(d));
    rec('Y-empty', e.length === FX.length - 4 && e.indexOf(2) < 0 && e.indexOf(9) < 0, e.length + ' rows');
    clickEl(document.querySelector('#tableHeader th[data-column="' + DSENT + '"]'));
    await sleep(600);
    var seq = flatRows().map(function (tr) { var cc = tr.querySelector('td[data-column="' + DSENT + '"]'); return cc ? cc.textContent.trim() : '?'; });
    var days = seq.filter(function (t) { return /^\d{4}-\d{2}-\d{2}$/.test(t); });
    rec('Y-sort', JSON.stringify(days) === JSON.stringify([dIso(-3), dIso(2), dIso(9)]), JSON.stringify(seq.slice(0, 8)) + ' ... ' + JSON.stringify(seq.slice(-3)));
  };
  S.dategroup = async function () {
    await until(function () { return bandNames().length >= 4; }, 5000);
    var names = bandNames(), i3 = names.indexOf(dIso(-3)), i2 = names.indexOf(dIso(2)), i9 = names.indexOf(dIso(9));
    rec('Q-bands', i3 >= 0 && i3 < i2 && i2 < i9 && names.indexOf('(not a date)') >= 0 && names[names.length - 1] === '[Blank]', JSON.stringify(names));
    var blank = bandOf('[Blank]'), c1 = dCell(K[1], blank);
    if (!c1) { var cnt = blank && blank.querySelector('.group-header'); if (cnt) clickEl(cnt); await sleep(300); c1 = dCell(K[1], bandOf('[Blank]')); }
    if (c1) { clickEl(c1); await until(function () { return !!actItem('date-tomorrow'); }, 3000); if (actItem('date-tomorrow')) clickEl(actItem('date-tomorrow')); }
    await until(function () { return bandRowIdx(dIso(1)).indexOf(0) >= 0; }, 4000);
    rec('Q-moves', bandRowIdx(dIso(1)).indexOf(0) >= 0 && bandRowIdx('[Blank]').indexOf(0) < 0, JSON.stringify(bandNames()));
  };
  S.datesetup = async function () {
    if (window.Penumbra.syncJournalRowConfigUI) window.Penumbra.syncJournalRowConfigUI();
    await sleep(200);
    var lst = document.getElementById('journalFieldList'), addD = document.getElementById('journalAddDateBtn');
    var dd = lst ? lst.querySelector('.journal-field-def.is-date[data-key="due"]') : null, kept = lst ? lst.querySelector('.journal-field-def.is-kept[data-kept-key="owner"]') : null;
    rec('V-render', !!dd && /Date/.test(dd.textContent) && dd.querySelector('.journal-field-def-label').value === 'Due' && !!kept && /lookup column this page cannot edit/.test(kept.textContent)
        && !!addD && addD.previousElementSibling === document.getElementById('journalAddFieldBtn') && !addD.disabled,
        (lst ? lst.textContent.replace(/\s+/g, ' ').slice(0, 300) : 'no list') + ' | button ' + (addD ? addD.outerHTML : 'none'));
    if (!addD) return;
    clickEl(addD);
    await until(function () { return (window._penumbraJournalFields || []).length === 3; }, 3000);
    await sleep(300);
    var f3 = (window._penumbraJournalFields || [])[2];
    rec('V-add', !!f3 && f3.type === 'date' && f3.label === 'Due 2' && !f3.options && f3.key !== 'due' && f3.key !== 'owner'
        && !!document.querySelector('#tableHeader th[data-column="__JOURNAL_FIELD__' + (f3 && f3.key) + '"]'), JSON.stringify(f3));
    if (!f3) return;
    var in3 = lst.querySelector('.journal-field-def[data-key="' + f3.key + '"] .journal-field-def-label');
    in3.value = 'Follow-up';
    $(in3).trigger('change');
    await sleep(200);
    f3 = window._penumbraJournalFields[2];
    rec('V-rename', f3.label === 'Follow-up' && JSON.stringify(f3.oldLabels) === '["Due 2"]', JSON.stringify(f3));
    var cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) cm.CodeMirror.setValue('SELECT * FROM JR_FIXTURE'); else $('#sqlQuery').val('SELECT * FROM JR_FIXTURE');
    var st = JR.buildStateObject ? JR.buildStateObject() : null, jf = st && st.viewOptions && st.viewOptions.journalFields, byKey = {};
    (jf || []).forEach(function (f) { byKey[f.key] = f; });
    rec('V-save', !!jf && jf.length === 4 && !!byKey.status && byKey.status.type === 'pick' && byKey.status.options.length === 4
        && JSON.stringify(byKey.due) === JSON.stringify({ key: 'due', type: 'date', label: 'Due', oldLabels: ['Deadline'] })
        && !!byKey[f3.key] && byKey[f3.key].type === 'date' && !byKey[f3.key].options
        && JSON.stringify(byKey.owner) === JSON.stringify({ key: 'owner', type: 'lookup', label: 'Owner', autofill: 'PEOPLE.NAME' }),
        String(JSON.stringify(jf)).slice(0, 500));
    var C = JR.penumbraCleanJournalFields, KP = JR.penumbraKeptJournalFields, many = [];
    for (var i = 1; i <= 5; i++) { many.push({ key: 'p' + i, type: 'pick', label: 'P' + i, options: [] }); many.push({ key: 'd' + i, type: 'date', label: 'D' + i }); }
    var cl = C ? C(many, []) : null;
    rec('V-caps', !!cl && cl.filter(function (f) { return f.type === 'pick'; }).length === 4 && cl.filter(function (f) { return f.type === 'date'; }).length === 4
        && cl.every(function (f) { return f.type !== 'date' || (f.label && !f.options); }), cl ? cl.map(function (f) { return f.key; }).join(',') : 'not hooked');
    var kp = KP ? KP([{ key: 'a', type: 'lookup', label: 'A' }, { key: 'due', type: 'lookup' }, { key: 'toggle1', type: 'multi' }, { key: '__x', type: 'lookup' },
                      { key: 'Bad Key', type: 'lookup' }, { key: 'p', type: 'pick' }, { key: 'd', type: 'date' }, { key: 'b', type: 7 }, { key: 'c', type: 'multi', options: [1, 2] }],
                     [{ key: 'due' }], [{ key: 'toggle1' }]) : null;
    rec('V-kept', !!kp && JSON.stringify(kp.map(function (f) { return f.key; })) === '["a","c"]' && JSON.stringify(kp[1].options) === '[1,2]', JSON.stringify(kp));
    clickEl(lst.querySelector('.journal-field-def[data-key="due"] .journal-field-def-remove'));
    await until(function () { return !document.querySelector('#tableHeader th[data-column="' + DSENT + '"]'); }, 3000);
    var gone = !(window._penumbraJournalFields || []).some(function (f) { return f.key === 'due'; }) && !document.querySelector('#tableHeader th[data-column="' + DSENT + '"]');
    var undo = document.querySelector('#journalFieldStatus .journal-field-undo');
    if (undo) clickEl(undo);
    await until(function () { return !!dCell(K[3]); }, 3000);
    var back = (window._penumbraJournalFields || []).filter(function (f) { return f.key === 'due'; })[0];
    rec('V-remove', gone && !!back && back.type === 'date' && JSON.stringify(back.oldLabels) === '["Deadline"]' && !!dCell(K[3]) && dCell(K[3]).textContent.trim() === dIso(-3),
        JSON.stringify(back) + ' gone=' + gone);
    for (var k = 0; k < 3; k++) { if (!addD.disabled) { clickEl(addD); await sleep(400); } }
    var nd = (window._penumbraJournalFields || []).filter(function (f) { return f.type === 'date'; }).length;
    rec('V-cap-btn', nd === 4 && addD.disabled && !document.getElementById('journalAddFieldBtn').disabled, nd + ' date columns; button ' + (addD.disabled ? 'off' : 'on'));
  };
  S.datewho = async function () {
    var heads = Array.prototype.map.call(document.querySelectorAll('#tableHeader th'), function (h) { return h.textContent.replace(/[▲▼]/g, '').trim(); });
    rec('W2-heads', heads.indexOf('Due set by') >= 0 && heads.indexOf('Due set on') >= 0 && heads.indexOf('Progress by') >= 0 && heads.indexOf('Due by') < 0, JSON.stringify(heads));
    var a = await search('Due set by = lee'), b = await search('Due set on = 2026-11-11');
    await search('');
    rec('W2-search', JSON.stringify(a) === '[2]' && JSON.stringify(b.slice().sort(function (x, y) { return x - y; })) === '[2,22]', JSON.stringify([a, b]));
  };

  // ---- date columns, phase 3b (2026-11-12, DATE_SPEC.md 7) -------------------------------------------------------------
  function dHead() { return document.querySelector('#tableHeader th[data-column="' + DSENT + '"]'); }
  function mon(iso) { return window.moment(iso, 'YYYY-MM-DD').format('MMM YYYY'); }
  // The heading's "Set Due for N shown rows >": the cell's quick days, Pick a date... and Clear, each asked first
  S.datebulk = async function () {
    var asked = [];
    window.confirm = function (m) { asked.push(m); return true; };
    var n = keptRows().length;
    async function openBulk() {
      closeMenu(); await sleep(100);
      rclick(dHead());
      await until(function () { return !!actItem('fieldBulk'); }, 3000);
      var it = actItem('fieldBulk');
      if (it) { clickEl(it); await until(function () { return !!subItem('Tomorrow'); }, 3000); }
      return it;
    }
    var it = await openBulk();
    rec('L-item', !!it && itemLabel(it) === 'Set Due for ' + n + ' shown rows' && it.getAttribute('aria-disabled') !== 'true',
        it ? itemLabel(it) + ' | ' + it.outerHTML.slice(0, 160) : JSON.stringify(menuLabels()));
    if (!it) return;
    rec('L-sub', JSON.stringify(subLabels()) === JSON.stringify(['Today', 'Tomorrow', 'In a week', 'Pick a date…', 'Clear']), JSON.stringify(subLabels()));
    var b0 = bulkPosts().length;
    clickEl(subItem('Tomorrow'));
    await until(function () { return bulkPosts().length > b0; }, 3000);
    await sleep(300);
    var bp = bulkPosts()[b0], ks = bp ? Object.keys(bp.values) : [];
    rec('L-confirm', asked.length === 1 && asked[0].indexOf('Set Due to ' + dLong(dIso(1)) + ' on ' + n + ' rows?') === 0
        && asked[0].indexOf('This replaces dates set by ') > 0 && ['lee', 'kim', 'pat', 'odd'].every(function (w) { return asked[0].indexOf(w) > 0; }), JSON.stringify(asked));
    rec('L-post', !!bp && bp.toggle_key === 'due' && ks.length === n && ks.every(function (k) { return bp.values[k] === dIso(1); }), bp ? ks.length + ' keys, ' + JSON.stringify(bp.values[K[1]]) : 'no post');
    await until(function () { return /DONE:/.test(toastText()); }, 3000);
    var tt = toastText();
    rec('L-toast', tt.indexOf('DONE: ' + n + ' rows set to ' + dLong(dIso(1)) + '.') >= 0 && dServer(K[3]) === dIso(1) && !!dCell(K[3]) && dCell(K[3]).textContent.trim() === dIso(1), tt);
    var undo = document.querySelector('#action_overlay .pnb-field-anyway');
    if (undo) clickEl(undo);
    await until(function () { return bulkPosts().length > b0 + 1; }, 3000);
    await sleep(300);
    var up = bulkPosts()[b0 + 1];
    rec('L-undo', !!up && up.values[K[3]] === dIso(-3) && up.values[K[5]] === dIso(2) && up.values[K[1]] === null && dServer(K[3]) === dIso(-3) && dServer(K[1]) === null,
        up ? JSON.stringify({ k3: up.values[K[3]], k5: up.values[K[5]], k1: up.values[K[1]] }) : 'no undo post');
    // Pick a date... for every row: the box names the rows, a phrase is fixed, the save asks first
    await openBulk();
    var a0 = asked.length, b1 = bulkPosts().length;
    if (subItem('Pick a date…')) clickEl(subItem('Pick a date…'));
    await until(function () { return !!box(); }, 3000);
    await sleep(100);
    var lbl = box() ? box().querySelector('#pnbDateBoxLbl').textContent : '', says0 = boxSays();
    if (boxIn()) { typeBox('TODAY+14'); await sleep(50); keyEl(boxIn(), 'Enter'); }
    await until(function () { return bulkPosts().length > b1; }, 3000);
    await sleep(300);
    var bx = bulkPosts()[b1], bxk = bx ? Object.keys(bx.values) : [];
    rec('L-box', lbl === 'Due for ' + n + ' rows' && says0 === 'Empty: Save clears Due on these ' + n + ' rows.' && !box()
        && asked.length === a0 + 1 && asked[a0].indexOf('Set Due to ' + dLong(dIso(14)) + ' on ' + n + ' rows?') === 0
        && !!bx && bxk.length === n && bxk.every(function (k) { return bx.values[k] === dIso(14); }), JSON.stringify([lbl, says0, asked.slice(a0), bx ? bxk.length : 'no post']));
    // the same day again: nothing to change, nothing asked (the toasts so far closed first: three show at once)
    Array.prototype.forEach.call(document.querySelectorAll('#action_overlay .pnb-toast-x'), function (x) { clickEl(x); });
    await sleep(400);
    await openBulk();
    var a1 = asked.length, b2 = bulkPosts().length;
    if (subItem('Pick a date…')) clickEl(subItem('Pick a date…'));
    await until(function () { return !!box(); }, 3000);
    if (boxIn()) { typeBox(dIso(14)); await sleep(50); keyEl(boxIn(), 'Enter'); }
    await until(function () { return /already have/.test(toastText()); }, 3000);
    rec('L-already', asked.length === a1 && bulkPosts().length === b2 && toastText().indexOf('All ' + n + ' rows already have Due ' + dLong(dIso(14)) + '.') >= 0, toastText() + ' | asked ' + (asked.length - a1));
    await openBulk();
    var a2 = asked.length, b3 = bulkPosts().length;
    if (subItem('Clear')) clickEl(subItem('Clear'));
    await until(function () { return bulkPosts().length > b3; }, 3000);
    await sleep(300);
    var cp = bulkPosts()[b3], cpk = cp ? Object.keys(cp.values) : [];
    rec('L-clear', asked.length === a2 + 1 && asked[a2].indexOf('Clear Due on ' + n + ' rows?') === 0 && !!cp && cpk.length === n && cpk.every(function (k) { return cp.values[k] === null; })
        && !!dCell(K[3]) && dCell(K[3]).classList.contains('is-empty'), JSON.stringify([asked.slice(a2), cp ? cpk.length : 'no post']));
    closeMenu();
  };
  // Grouped by Due:ym (Year > Month): the periods a day allows, a band per month in order, a row moving band
  S.datebands = async function () {
    var gv = (window.Penumbra.headerMenu.groupVariants('Due') || []).map(function (v) { return v.token; });
    var bv = (window._penumbraSearchAPI.getBucketVariants('Due') || []).map(function (v) { return v.sx; });
    rec('M-variants', JSON.stringify(gv) === JSON.stringify(['Due:year', 'Due:fy', 'Due:yq', 'Due:fyq', 'Due:ym', 'Due:quarter', 'Due:fquarter', 'Due:month', 'Due:monthnum', 'Due:dow'])
        && bv.indexOf(':ym') >= 0 && bv.indexOf(':year') >= 0 && bv.indexOf(':hour') < 0, JSON.stringify([gv, bv]));
    await until(function () { return bandNames().length >= 3; }, 5000);
    var names = bandNames(), want = [];
    [dIso(-3), dIso(2), dIso(9)].forEach(function (d) { if (want.indexOf(mon(d)) < 0) want.push(mon(d)); });
    var at = want.map(function (m) { return names.indexOf(m); });
    rec('M-bands', at.every(function (x, i) { return x >= 0 && (i === 0 || x > at[i - 1]); }) && names.indexOf('(not a date)') >= 0 && names[names.length - 1] === '[Blank]'
        && names.length === want.length + 2, JSON.stringify([names, want]));
    rec('M-rows', bandRowIdx(mon(dIso(-3))).indexOf(2) >= 0 && bandRowIdx(mon(dIso(9))).indexOf(6) >= 0 && bandRowIdx('(not a date)').indexOf(9) >= 0
        && bandRowIdx('[Blank]').indexOf(0) >= 0, JSON.stringify([bandRowIdx(mon(dIso(-3))), bandRowIdx(mon(dIso(9))), bandRowIdx('(not a date)')]));
    // K1 (no day) set to a day 40 days on: its month's band, a moment later
    var far = dIso(40);
    window.Penumbra.fields.setField(K[1], 'due', far);
    await until(function () { return bandRowIdx(mon(far)).indexOf(0) >= 0; }, 5000);
    rec('M-moves', bandRowIdx(mon(far)).indexOf(0) >= 0 && bandRowIdx('[Blank]').indexOf(0) < 0, JSON.stringify(bandNames()));
  };
  // Due:ym as a second level (PROTOCOL TYPE, then the month): its bands are months
  S.datenest = async function () {
    var sel = '#groupedResultsContainer .group-wrapper[data-group-depth="1"]';
    await until(function () { return document.querySelectorAll(sel).length > 0; }, 5000);
    var names = [];
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (w) {
      var n = w.querySelector(':scope > .group-header .group-name'), t = n ? n.textContent.trim() : '';
      if (names.indexOf(t) < 0) names.push(t);
    });
    var ok = [dIso(-3), dIso(2), dIso(9)].map(mon).concat(['(not a date)', '[Blank]']);
    rec('N-nested', names.length > 1 && names.indexOf(mon(dIso(-3))) >= 0 && names.indexOf('[Blank]') >= 0 && names.every(function (t) { return ok.indexOf(t) >= 0; }), JSON.stringify(names));
  };
  // A card's pill and field are the cell's button; the card's menu has Due >
  S.datecards = async function () {
    var C = window.Penumbra.cards, PS = DSENT.toUpperCase();
    if (!C) { rec('DC-pill', false, 'no card view in the page'); return; }
    // The harness writes the card view in with document.write, so the journal's first answer can land before
    // penumbra_fields.js runs (index.php's defer order rules that out): asked once more
    if (!window.Penumbra.fields.loaded()) {
      window.Penumbra.journalHost.reload({ quiet: true });
      await until(function () { return window.Penumbra.fields.loaded(); }, 5000);
      await sleep(300);
    }
    C.setReport({ title: 'PROTOCOL NO.', pill: PS, fields: [PS, 'PROTOCOL TYPE'] });
    C.set('cards');
    await until(function () { return document.querySelectorAll('#pnbCardsHost .pnb-card').length > 0; }, 6000);
    await sleep(300);
    function cardOf(rk) {
      var b = document.querySelector('#pnbCardsHost .pnb-card-pill .journal-field-cell[data-toggle-key="due"][data-row-key="' + CSS.escape(rk) + '"]');
      return b ? b.closest('.pnb-card') : null;
    }
    function pillOf(rk) { var c = cardOf(rk); return c ? c.querySelector('.pnb-card-pill.has-field > .journal-field-cell') : null; }
    var p1 = pillOf(K[1]), p3 = pillOf(K[3]), after = p1 ? getComputedStyle(p1, '::after').content : '';
    rec('DC-pill', !!p1 && p1.classList.contains('is-empty') && after.indexOf('+ Due') >= 0 && !!p3 && p3.textContent.trim() === dIso(-3),
        (p1 ? p1.outerHTML.slice(0, 160) : 'no pill') + ' | ' + after + ' | ' + (p3 ? p3.textContent : 'no K3 pill'));
    if (!p1) return;
    clickEl(p1);
    await until(function () { return !!menuItem('Tomorrow'); }, 3000);
    var labs = menuLabels(), n0 = posts();
    if (menuItem('Tomorrow')) clickEl(menuItem('Tomorrow'));
    await until(function () { return posts() > n0; }, 3000);
    await sleep(500);
    var post = lastPost(), p1b = pillOf(K[1]), c1 = cardOf(K[1]);
    var fb = c1 ? c1.querySelector('.pnb-card-fields dd .journal-field-cell') : null;
    rec('DC-pick', JSON.stringify(labs) === JSON.stringify(['Today', 'Tomorrow', 'In a week', 'Pick a date…', 'Clear']) && !!post && post.row_key === K[1] && post.value === dIso(1)
        && !!p1b && p1b.textContent.trim() === dIso(1) && !!fb && fb.textContent.trim() === dIso(1), JSON.stringify([labs, post, p1b ? p1b.textContent : null, fb ? fb.textContent : null]));
    c1.scrollIntoView({ block: 'center' });
    await sleep(250);
    rclick(c1);
    await until(function () { return !!actItem('field-due'); }, 3000);
    var di = actItem('field-due');
    if (di) { clickEl(di); await until(function () { return !!subItem('Pick a date…'); }, 3000); }
    if (subItem('Pick a date…')) clickEl(subItem('Pick a date…'));
    await until(function () { return !!box(); }, 3000);
    await sleep(100);
    // the box sits at the card's own button (the table's cell is laid out of sight), and Escape gives it the focus back
    var r = box() ? box().getBoundingClientRect() : null, v = boxIn() ? boxIn().value : null, pb = pillOf(K[1]), pr = pb ? pb.getBoundingClientRect() : null;
    var atPill = !!r && !!pr && Math.abs(r.left - Math.max(8, Math.min(pr.left, window.innerWidth - r.width - 8))) < 2
        && (Math.abs(r.top - (pr.bottom + 4)) < 2 || Math.abs(r.bottom - (pr.top - 4)) < 2);
    if (boxIn()) keyEl(boxIn(), 'Escape');
    await sleep(150);
    rec('DC-menu', !!di && itemLabel(di) === 'Due' && v === dIso(1) && atPill && !box() && document.activeElement === pillOf(K[1]),
        JSON.stringify([di ? itemLabel(di) : null, v, r && [r.left, r.top, r.bottom], pr && [pr.left, pr.top, pr.bottom], !!box(), document.activeElement && document.activeElement.className]));
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
