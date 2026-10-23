// dict suite - page half (2026-10-22). The data dictionary (js/penumbra_dict.js) on the REAL
// main.js + column options + header menu, saveconf fixture (mk_harness.py sets the block).
//   dunit   the module's own functions: parse, serialize, blocks, replace, merge, render, clean
//   dlink   engine A draws the link; the dialog: note, rows, tags, source, filter, editor lines
//   dmenu   the header menu's "What this column means": only for a column with an entry; focus
//   dopts   Column options' link: only for a column with an entry; opens the dialog on it
//   dview   a viewer (no admin console): no editor lines, no Generate button
//   dblank  a blank label: no link drawn, the dictionary still found (menu item, has())
//   dsub    a dict| in the subtitle only (engine B): its link opens its own payload
//   dnone   no block: nothing anywhere (guards)
//   dgen    Generate: the sidebar button, the request, the merge, Insert, re-open; encrypted gate
//   dgenerr Generate: a refusal shows in the footer gap, nothing is written
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, errors: [] };
  window.addEventListener('error', function (e) { R.errors.push(String(e.message || e)); });
  // (2026-10-22 c) the lazy half runs inside promises: a throw there is a rejection, not an error
  window.addEventListener('unhandledrejection', function (e) { R.errors.push('rejection: ' + String(e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!safe(fn) && Date.now() - t < ms) await sleep(25); return safe(fn); }
  function safe(fn) { try { return fn(); } catch (e) { return false; } }
  function ok(name, v, info) { R.chk[name] = v === true; if (info !== undefined && v !== true) R.info[name] = info; }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(800);
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function D() { return window.PenumbraDict; }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function menuItem(act) { var m = document.getElementById('pnbHeadMenu'); return m ? m.querySelector('[data-act="' + act + '"]') : null; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function dialog() { var d = document.querySelectorAll('.infobox-overlay'); return d.length ? d[d.length - 1] : null; }
  function dlgBody() { var d = dialog(); return d ? d.querySelector('.infobox-body') : null; }
  function rows() { var b = dlgBody(); return b ? Array.prototype.slice.call(b.querySelectorAll('.pnb-dict-table tbody tr')) : []; }
  function rowKeys() { return rows().map(function (tr) { return tr.getAttribute('data-key'); }); }
  function rowOf(k) { var b = dlgBody(); return b ? b.querySelector('.pnb-dict-table tbody tr[data-key="' + k + '"]') : null; }
  async function closeDialog() { var d = dialog(); if (d) { d.querySelector('.close-lightbox').click(); await until(function () { return !document.querySelector('.infobox-overlay'); }, 3000); } }
  function link(mode) { return document.querySelector('#reportSnippetOutput a.snippet-action[data-action-name="infobox"][data-action-mode="' + mode + '"]'); }

  // ------------------------------------------------------------------ dunit
  async function dunit() {
    var d = D();
    if (d && d.ui) { try { await d.ui(); } catch (e) { R.info.ui = String(e); } }   // (2026-10-22 c) merge / render live in the lazy half
    ok('loaded', !!d && typeof d.parse === 'function');
    if (!d) return;
    var p = d.parse('Grain line one.\n# comment\nA_COL | ? Draft text | source: T.A\nB col  | ! Avoid this\nC | ?! both\nD | text with | a pipe\nE | plain\nA_COL | later wins\n | no name\nnot a column');
    ok('notes', p.note.length === 3 && p.note[0] === 'Grain line one.' && p.note[1] === '| no name' && p.note[2] === 'not a column', p.note);
    ok('entries', p.entries.length === 5, p.entries.map(function (e) { return e.name; }));
    var a = p.entries[0], b = p.entries[1], c = p.entries[2], dd = p.entries[3];
    ok('flags', a.draft === false && b.avoid === true && b.draft === false && c.draft && c.avoid && c.text === 'both', [a, b, c]);
    ok('laterWins', a.text === 'later wins' && a.source === '' && p.entries[0].key === 'A_COL', a);
    ok('source', d.parse('X | t | source: T.X + 1').entries[0].source === 'T.X + 1');
    ok('pipeInText', dd.text === 'text with | a pipe' && dd.source === '', dd);
    ok('keySpace', b.key === 'B COL' && d.keyOf('  b   col ') === 'B COL');
    var round = d.parse(d.serialize(d.parse('N1\nX | ? a | source: T.X\nY | ! b')));
    ok('roundTrip', round.note[0] === 'N1' && round.entries[0].draft && round.entries[0].source === 'T.X' && round.entries[1].avoid && round.entries[1].text === 'b', round);
    var dirty = d.serialize({ note: ['a | b'], entries: [{ name: 'Z', text: 'has ` tick | pipe /* c */\nbreak', source: '', draft: false, avoid: false }] });
    ok('clean', dirty.indexOf('`') === -1 && dirty.indexOf('/*') === -1 && dirty.indexOf('*/') === -1 && dirty.split('\n').length === 2 && d.parse(dirty).entries[0].text.indexOf('|') === -1, dirty);
    var snip = 'x\naction(infobox, "My dict", dict|`\nA | one\n`)\ny';
    var bl = d.blocks(snip);
    ok('blocks', bl.length === 1 && bl[0].label === 'My dict' && snip.slice(bl[0].start, bl[0].end) === 'action(infobox, "My dict", dict|`\nA | one\n`)', bl);
    var rep = d.replaceInSnippet(snip, 'NEW');
    ok('replace', rep === 'x\nNEW\ny', rep);
    ok('append', d.replaceInSnippet('abc\n\n', 'NEW') === 'abc\n\nNEW\n' && d.replaceInSnippet('', 'NEW') === 'NEW\n');
    ok('bare', d.blocks('dict|`A | b`').length === 1 && d.fromSnippet('dict|`A | b`').entries[0].text === 'b');
    var two = d.fromSnippet('action(infobox, D1, dict|`A | one\nB | two`)\naction(infobox, D2, dict|`A | three`)');
    ok('multi', two.entries.length === 2 && two.entries[0].text === 'three' && two.label === 'D1', two);
    // merge: checked kept, draft replaced, new added, gone kept + listed, missing listed, note kept
    var ex = d.parse('Old note.\nA | checked\nB | ? old draft\nGONE | stale');
    var gen = d.parse('New note.\nA | gen a\nB | gen b | source: T.B\nC | gen c');
    var m = d.merge(ex, gen, [{ name: 'A', key: 'A' }, { name: 'B', key: 'B' }, { name: 'C', key: 'C' }, { name: 'Q', key: 'Q' }]);
    var by = {}; m.dict.entries.forEach(function (e) { by[e.key] = e; });
    ok('mergeKept', by.A.text === 'checked' && !by.A.draft, by.A);
    ok('mergeReplaced', by.B.text === 'gen b' && by.B.draft && by.B.source === 'T.B', by.B);
    ok('mergeAdded', by.C.text === 'gen c' && by.C.draft, by.C);
    ok('mergeGone', by.GONE && m.dict.entries[m.dict.entries.length - 1].key === 'GONE' && m.stats.gone.join() === 'GONE', m.stats);
    ok('mergeStats', m.stats.kept === 1 && m.stats.replaced === 1 && m.stats.added === 1 && m.stats.missing.join() === 'Q', m.stats);
    ok('mergeNote', m.dict.note.join() === 'Old note.' && d.merge(null, gen, [{ name: 'C' }]).dict.note.join() === 'New note.');
    // render: escaped, tags, focus
    var h = d.renderHtml(d.parse('<img src=x onerror=alert(1)>\nX<script> | <b>bold</b> | source: <i>s</i>\nY | ! no\nZ | ? draft'), { focus: 'x<script>', columns: ['Y'], author: true });
    var box = document.createElement('div'); box.innerHTML = h;
    ok('escapes', !box.querySelector('img, script, b, i') && h.indexOf('&lt;b&gt;bold') !== -1, h.slice(0, 300));
    ok('renderTags', !!box.querySelector('tr[data-key="Y"] .pnb-dict-avoid') && !!box.querySelector('tr[data-key="Z"] .pnb-dict-draft') && !!box.querySelector('tr.is-focus[data-key="X<SCRIPT>"]'));
    ok('renderGone', !!box.querySelector('tr[data-key="Z"] .pnb-dict-tag[title^="No column"]') && !box.querySelector('tr[data-key="Y"] .pnb-dict-tag[title^="No column"]'));
    var hv = d.renderHtml(d.parse('Z | ? draft'), { columns: ['Y'], author: false });
    ok('renderViewer', hv.indexOf('pnb-dict-missing') === -1 && hv.indexOf('not in results') === -1, hv);
    ok('renderNone', d.renderHtml(null, {}).indexOf('no data dictionary') !== -1);
    // (2026-10-22 b) the [pivot] / [columns] sections
    var pv = d.parse('Col note.\nA | col a\n[pivot]\nCell note.\nSum X | ? adds X | source: sum(X)\n[ PIVOT ]\nSum X | later wins\n[columns]\nB | col b\nA | col a again');
    ok('pvParse', pv.note.join() === 'Col note.' && pv.entries.map(function (e) { return e.key + '=' + e.text; }).join() === 'A=col a again,B=col b'
       && pv.pivot.note.join() === 'Cell note.' && pv.pivot.entries.length === 1 && pv.pivot.entries[0].text === 'later wins' && pv.pivot.entries[0].key === 'SUM X', pv);
    var legacy = d.parse('N\nA | a');
    ok('pvLegacy', !d.hasPivot(legacy) && d.serialize(legacy) === 'N\nA | a', d.serialize(legacy));
    var ser = d.serialize(pv);
    ok('pvSerialize', ser.indexOf('[pivot]\nCell note.\nSum X | later wins\n[columns]\nCol note.\nA | col a again\nB | col b') === 0, ser);
    var rt = d.parse(ser);
    ok('pvRoundTrip', rt.pivot.entries[0].text === 'later wins' && rt.entries.length === 2 && rt.note.join() === 'Col note.');
    var fs = d.fromSnippet('action(infobox, D1, dict|`[pivot]\nV1 | one\n[columns]\nA | a`)\naction(infobox, D2, dict|`[pivot]\nV2 | two`)');
    ok('pvMulti', fs.pivot.entries.map(function (e) { return e.key; }).join() === 'V1,V2' && fs.entries.length === 1, fs);
    // merge: the pivot's values as their own names; a checked value kept, a draft replaced, a gone one listed
    var pex = d.parse('[pivot]\nKeep | checked\nDraft | ? old\nGone | stale\n[columns]\nA | a');
    var pgen = d.parse('[pivot]\nNew cell note.\nKeep | gen keep\nDraft | gen draft\nNew | gen new\n[columns]\nA | gen a');
    var pm = d.merge(pex, pgen, [{ name: 'A', key: 'A' }], [{ name: 'Keep' }, { name: 'Draft' }, { name: 'New' }]);
    var pby = {}; pm.dict.pivot.entries.forEach(function (e) { pby[e.key] = e; });
    ok('pvMerge', pby.KEEP.text === 'checked' && pby.DRAFT.text === 'gen draft' && pby.DRAFT.draft && pby.NEW.text === 'gen new' && pby.GONE && pm.stats.pivot.gone.join() === 'Gone'
       && pm.stats.pivot.kept === 1 && pm.stats.pivot.replaced === 1 && pm.stats.pivot.added === 1 && pm.dict.pivot.note.join() === 'New cell note.' && pm.dict.entries[0].text === 'a', pm.stats);
    var pkeep = d.merge(pex, pgen, [{ name: 'A' }], []);
    ok('pvMergeNoPivot', pkeep.dict.pivot.entries.length === 3 && pkeep.dict.pivot.entries[1].text === 'old', pkeep.dict.pivot);
    var ph = d.renderHtml(pv, { columns: ['A'], pivotValues: ['Sum X', 'Other'], author: true, focus: 'sum x', focusSection: 'pivot' });
    var pbox = document.createElement('div'); pbox.innerHTML = ph;
    var secs = pbox.querySelectorAll('.pnb-dict-sec');
    ok('pvRenderOrder', secs.length === 2 && secs[0].classList.contains('pnb-dict-sec-pivot') && secs[1].querySelector('h4') && /columns underneath/i.test(secs[1].querySelector('h4').textContent), ph.slice(0, 300));
    ok('pvRenderFocus', !!pbox.querySelector('tr.is-focus[data-sec="pivot"][data-key="SUM X"]') && !pbox.querySelector('tr.is-focus[data-sec="columns"]'));
    ok('pvRenderMissing', /these pivot values<\/strong>[^<]*: Other/.test(ph), ph);
    var nh = d.renderHtml(legacy, {});
    ok('pvRenderPlain', nh.indexOf('pnb-dict-sec-pivot') === -1 && nh.indexOf('<h4') === -1);
  }

  // ------------------------------------------------------------------ dlazy (2026-10-22 c)
  async function dlazy() {
    var d = D();
    ok('notLoadedYet', !!d && !d.uiLoaded && !document.querySelector('script[data-pnb-dict-ui]') && !document.querySelector('link[data-pnb-dict-ui]') && typeof d.renderHtml === 'undefined');
    ok('coreAnswers', d.has() === true && !!d.entryFor('V_AMOUNT') && d.generatorAvailable() === true);
    rclick(fth('V_AMOUNT'));
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    ok('menuWithoutUi', !!menuItem('about') && !d.uiLoaded);
    var it = menuItem('about'); if (it) it.click();
    await until(function () { return rows().length > 0; }, 6000);
    var sc = document.querySelectorAll('script[data-pnb-dict-ui]'), ln = document.querySelectorAll('link[data-pnb-dict-ui]');
    ok('loadedOnOpen', d.uiLoaded === true && sc.length === 1 && /penumbra_dict_ui\.js$/.test(sc[0].getAttribute('src')) && ln.length === 1 && /penumbra_dict_ui\.css$/.test(ln[0].getAttribute('href')), [sc.length, ln.length]);
    var td = rowOf('V_AMOUNT') && rowOf('V_AMOUNT').querySelector('td');
    ok('uiCssApplied', !!td && getComputedStyle(td).whiteSpace === 'normal');
    await closeDialog(); closeMenu();
    link('dict').click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('loadedOnce', document.querySelectorAll('script[data-pnb-dict-ui]').length === 1);
    await closeDialog();
  }

  // ------------------------------------------------------------------ dedit (2026-10-22 c)
  function edRow(k) { var b = dlgBody(); return b ? b.querySelector('.pnb-dicted tr[data-key="' + k + '"]') : null; }
  function foot() { var d = dialog(); return d ? d.querySelector('.modal-prompt-buttons') : null; }
  function type(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  async function dedit() {
    var before = window.Penumbra.snippetText();
    link('dict').click();
    await until(function () { return rows().length > 0; }, 4000);
    var eb = dlgBody().querySelector('[data-dd="edit"]');
    ok('editButton', !!eb);
    if (!eb) return;
    eb.click();
    await until(function () { return !!edRow('V_ID'); }, 3000);
    ok('editorRows', ['V_ID', 'V_NAME', 'V_AMOUNT', 'H_OLD', 'H_ZZ'].every(function (k) { return !!edRow(k); }) && edRow('V_NAME').classList.contains('is-draft') && !edRow('V_ID').classList.contains('is-draft'));
    ok('editorValues', edRow('V_AMOUNT').querySelector('[data-ed="text"]').value === 'What was paid, in dollars (<b>not</b> cents).' && edRow('V_AMOUNT').querySelector('[data-ed="source"]').value === 'LR_FIXTURE.AMT'
       && edRow('H_ZZ').querySelector('[data-ed="avoid"]').checked);
    ok('footSwapped', !!foot().querySelector('[data-dd="apply"]') && !!foot().querySelector('[data-dd="cancel"]') && !foot().querySelector('.modal-btn-primary[id$="_ok"]'));
    ok('todoCount', /1 AI draft to check/.test(dlgBody().querySelector('.pnb-dicted-todo').textContent));
    // nothing changed: Cancel leaves without asking
    var asked = 0; window.confirm = function () { asked++; return true; };
    foot().querySelector('[data-dd="cancel"]').click();
    ok('cleanCancel', asked === 0 && rows().length > 0 && !dlgBody().querySelector('.pnb-dicted') && !!foot().querySelector('[id$="_ok"]'));
    // the edits
    dlgBody().querySelector('[data-dd="edit"]').click();
    await until(function () { return !!edRow('V_ID'); }, 3000);
    type(edRow('V_NAME').querySelector('[data-ed="text"]'), 'The vendor\'s legal name, | as on the invoice.');
    edRow('V_NAME').querySelector('[data-ed="check"]').click();
    ok('checkedTag', !edRow('V_NAME').classList.contains('is-draft') && edRow('V_NAME').querySelector('.pnb-dicted-draft').hidden && /Nothing left to check/.test(dlgBody().querySelector('.pnb-dicted-todo').textContent));
    edRow('V_ID').querySelector('[data-ed="avoid"]').checked = true;
    edRow('H_OLD').querySelector('[data-ed="remove"]').click();
    ok('removeMarks', edRow('H_OLD').classList.contains('is-removed') && edRow('H_OLD').querySelector('textarea').disabled && /Keep/.test(edRow('H_OLD').querySelector('[data-ed="remove"]').textContent));
    var sel = dlgBody().querySelector('.pnb-dicted-sec[data-sec="columns"] [data-ed="add"]');
    var opts = Array.prototype.map.call(sel.options, function (o) { return o.value; });
    ok('addOffersMissing', opts.indexOf('V_DATE') !== -1 && opts.indexOf('V_ID') === -1 && opts.indexOf('__other') !== -1, opts);
    sel.value = 'V_DATE'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    ok('addedRow', !!edRow('V_DATE') && document.activeElement === edRow('V_DATE').querySelector('textarea'));
    type(edRow('V_DATE').querySelector('[data-ed="text"]'), 'When it was paid.');
    type(dlgBody().querySelector('.pnb-dicted-sec[data-sec="columns"] [data-ed="note"]'), 'One row per payment.');
    var ta = edRow('V_NAME').querySelector('textarea'), h0 = ta.offsetHeight;
    type(ta, new Array(30).join('Long meaning text that has to wrap onto more lines. '));
    ok('grows', ta.offsetHeight > h0 * 2, [h0, ta.offsetHeight]);
    type(ta, 'The vendor\'s legal name, | as on the invoice.');
    // a dirty Esc asks, and a No keeps the editor open
    window.confirm = function () { asked++; return false; };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(250);
    ok('escAsks', asked === 1 && !!dialog() && !!edRow('V_DATE'));
    foot().querySelector('[data-dd="apply"]').click();
    await until(function () { return !dlgBody().querySelector('.pnb-dicted'); }, 3000);
    var snip = window.Penumbra.snippetText(), d2 = D().fromSnippet(snip), by = {};
    d2.entries.forEach(function (e) { by[e.key] = e; });
    ok('applied', D().blocks(snip).length === 1 && /^Before the block\./.test(snip) && /\nAfter the block\.$/.test(snip) && snip !== before, snip.slice(0, 200));
    ok('appliedValues', by.V_NAME && by.V_NAME.text === 'The vendor\'s legal name, / as on the invoice.' && !by.V_NAME.draft && by.V_ID.avoid && !by.H_OLD && by.V_DATE && by.V_DATE.text === 'When it was paid.'
       && d2.note.join() === 'One row per payment.' && by.H_ZZ.avoid && by.V_AMOUNT.source === 'LR_FIXTURE.AMT', d2);
    ok('backToView', rows().length > 0 && !!rowOf('V_DATE') && !rowOf('H_OLD') && !!foot().querySelector('[id$="_ok"]') && !foot().querySelector('[data-dd="apply"]'));
    ok('applyToast', window.__toasts.some(function (t) { return /updated in Custom Code/.test(t) && /Save the report/.test(t); }));
    // after Apply nothing is dirty: Esc closes without asking
    asked = 0; window.confirm = function () { asked++; return true; };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(function () { return !document.querySelector('.infobox-overlay'); }, 3000);
    ok('escAfterApply', asked === 0 && !document.querySelector('.infobox-overlay'));
  }

  // ------------------------------------------------------------------ pdict (2026-10-22 b)
  async function pdict() {
    await until(function () { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]').length > 0; }, 20000);
    var W = window.Penumbra, pvd = W.dictPivot ? W.dictPivot() : null;
    ok('dictPivotShape', !!pvd && pvd.values.length === 1 && pvd.values[0].label === 'Amt' && pvd.values[0].agg === 'sum' && pvd.values[0].column === 'H_AMT'
       && pvd.rows.length === 2 && pvd.columns.length === 1, pvd);
    ok('labelByIndex', W.dictPivotLabel && W.dictPivotLabel(0) === 'Amt' && W.dictPivotLabel(5) === '');
    ok('pivotEntry', D().pivotEntryFor('amt') && D().pivotEntryFor('amt').draft === true && !D().pivotEntryFor('V_ID'));
    W.openDataDictionary('');
    await until(function () { return rows().length > 0; }, 4000);
    var b = dlgBody(), secs = b ? b.querySelectorAll('.pnb-dict-sec') : [];
    ok('pivotFirst', secs.length === 2 && secs[0].classList.contains('pnb-dict-sec-pivot'), b && b.innerHTML.slice(0, 300));
    ok('pivotRows', rows().filter(function (tr) { return tr.getAttribute('data-sec') === 'pivot'; }).map(function (tr) { return tr.getAttribute('data-key'); }).join() === 'AMT,GRAND TOTAL,OLD VALUE');
    ok('pivotNote', !!(secs[0] && secs[0].querySelector('.pnb-dict-note')) && secs[0].querySelector('.pnb-dict-note').textContent === 'Each cell adds up the payments of its group and status.');
    var old = b && b.querySelector('tr[data-sec="pivot"][data-key="OLD VALUE"] .pnb-dict-tag');
    ok('pivotGone', !!old && /not in the pivot/.test(old.textContent) && !b.querySelector('tr[data-sec="pivot"][data-key="AMT"] .pnb-dict-tag[title^="No value"]') && !b.querySelector('tr[data-sec="pivot"][data-key="GRAND TOTAL"] .pnb-dict-tag'));
    ok('countBoth', /^5 entries$/.test(b.querySelector('.pnb-dict-count').textContent), b && b.querySelector('.pnb-dict-count').textContent);
    await closeDialog();
    // a value cell's menu
    var cell = document.querySelector('#pivotResultTable tbody td[data-agg-idx]');
    rclick(cell);
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    var it = menuItem('pvAbout');
    ok('cellAbout', !!it && /What this value means/.test(it.textContent), document.getElementById('pnbHeadMenu') && document.getElementById('pnbHeadMenu').textContent.slice(0, 300));
    if (it) it.click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('cellFocus', !!(dlgBody() && dlgBody().querySelector('tr.is-focus[data-sec="pivot"][data-key="AMT"]')));
    await closeDialog(); closeMenu();
    // Generate: the pivot travels, its part comes back first and merges by value
    var log = [];
    fakeXhr(200, { status: 'ok', dictionary: '[pivot]\nGen cell note.\nAmt | Gen: adds up H_AMT. | source: sum(H_AMT)\n[columns]\nGen grain.\nV_ID | gen id\nV_NAME | Gen vendor.', sources: 'x' }, log);
    D().openGenerator();
    await until(function () { return !!gen(); }, 3000);
    ok('genSubtitle', /the pivot's 1 value and each of this report's \d+ columns mean,/.test(gq('.pnb-dlg-sub').textContent), gq('.pnb-dlg-sub').textContent);
    ok('genCounts', /4 checked, 1 AI draft/.test(gen().textContent), gen().textContent.slice(0, 400));
    gq('[data-dg="go"]').click();
    await until(function () { return gq('[data-dg="insert"]') && !gq('[data-dg="insert"]').hidden; }, 4000);
    var req = log[0] ? JSON.parse(log[0].body) : {};
    ok('genSendsPivot', !!req.pivot && req.pivot.values[0].label === 'Amt' && /\[pivot\]/.test(req.existing), req.pivot);
    var txt = genText(), p2 = D().fromSnippet(txt);
    ok('genPivotFirst', /dict\|`\n\[pivot\]\n/.test(txt) && txt.indexOf('[columns]') > txt.indexOf('Amt |'), txt.slice(0, 300));
    ok('genPivotMerged', p2.pivot.entries[0].text === 'Gen: adds up H_AMT.' && p2.pivot.entries[0].draft && p2.pivot.note.join() === 'Each cell adds up the payments of its group and status.'
       && p2.pivot.entries.some(function (e) { return e.key === 'OLD VALUE'; }), p2.pivot);
    ok('genColsKept', p2.entries.filter(function (e) { return e.key === 'V_ID'; })[0].text === 'The payment id.', p2.entries);
    ok('genSummary', /^Pivot values: 1 draft rewritten/.test(gq('.pnb-dictgen-sum').textContent) && /Old value/.test(gq('.pnb-dictgen-sum').textContent), gq('.pnb-dictgen-sum').textContent);
    // the header band: the title's generic modal rule neutralized (no rule under it)
    var t = gq('.pnb-dlg-title'), cs = t ? getComputedStyle(t) : null;
    ok('headTitleFlat', !!cs && cs.borderBottomStyle === 'none' && parseFloat(cs.paddingBottom) === 0 && parseFloat(cs.marginBottom) === 0, cs && [cs.borderBottomStyle, cs.paddingBottom, cs.marginBottom]);
    gq('[data-dg="cancel"]').click();
  }

  // ------------------------------------------------------------------ dlink
  async function dlink() {
    var a = link('dict');
    ok('linkRendered', !!a && a.textContent === 'Data dictionary', document.getElementById('reportSnippetOutput').innerHTML.slice(0, 400));
    ok('snippetIntact', /Before the block/.test(document.getElementById('reportSnippetOutput').textContent) && /After the block/.test(document.getElementById('reportSnippetOutput').textContent)
       && document.getElementById('reportSnippetOutput').textContent.indexOf('V_AMOUNT |') === -1, document.getElementById('reportSnippetOutput').textContent.slice(0, 300));
    ok('has', D() && D().has() === true);
    if (!a) return;
    a.click();
    await until(function () { return rows().length > 0; }, 4000);
    var b = dlgBody();
    ok('dialogTitle', !!dialog() && dialog().querySelector('.pnb-dlg-title').textContent === 'Data dictionary');
    ok('rows', rowKeys().join() === 'V_ID,V_NAME,V_AMOUNT,H_OLD,H_ZZ', rowKeys());
    ok('note', !!b && b.querySelector('.pnb-dict-note') && b.querySelector('.pnb-dict-note').textContent === 'One row per vendor payment. A payment can repeat across statuses.' && b.textContent.indexOf('a comment line') === -1);
    ok('draftTag', !!(rowOf('V_NAME') && rowOf('V_NAME').querySelector('.pnb-dict-draft')) && !rowOf('V_AMOUNT').querySelector('.pnb-dict-draft'));
    ok('avoidTag', !!(rowOf('H_ZZ') && rowOf('H_ZZ').querySelector('.pnb-dict-avoid')));
    ok('source', !!(rowOf('V_AMOUNT') && rowOf('V_AMOUNT').querySelector('.pnb-dict-src') && rowOf('V_AMOUNT').querySelector('.pnb-dict-src').textContent === 'Source: LR_FIXTURE.AMT'));
    ok('escaped', !!rowOf('V_AMOUNT') && !rowOf('V_AMOUNT').querySelector('b') && rowOf('V_AMOUNT').textContent.indexOf('<b>not</b>') !== -1, rowOf('V_AMOUNT') && rowOf('V_AMOUNT').innerHTML);
    var f = b && b.querySelector('.pnb-dict-filter');
    if (f) { f.value = 'dollars'; f.dispatchEvent(new Event('input', { bubbles: true })); }
    var shown = rows().filter(function (tr) { return !tr.hidden; }).map(function (tr) { return tr.getAttribute('data-key'); });
    ok('filter', shown.join() === 'V_AMOUNT' && /1 of 5/.test(b.querySelector('.pnb-dict-count').textContent), shown);
    if (f) { f.value = 'zzzz'; f.dispatchEvent(new Event('input', { bubbles: true })); }
    ok('filterEmpty', !!b && !b.querySelector('.pnb-dict-empty').hidden);
    // the editor's own lines: columns with no entry (shown ones and hidden H_* alike), stale entries
    var miss = b && b.querySelector('.pnb-dict-missing');
    ok('missingLine', !!miss && /V_DATE/.test(miss.textContent) && /V_STATUS/.test(miss.textContent) && !/V_AMOUNT/.test(miss.textContent), miss && miss.textContent);
    ok('goneTag', !!(rowOf('H_OLD') && rowOf('H_OLD').querySelector('.pnb-dict-tag[title^="No column"]')) && !rowOf('V_ID').querySelector('.pnb-dict-tag[title^="No column"]'));
    ok('authorBar', !!(b && b.querySelector('.pnb-dict-authorbar button')));
    // (2026-10-22, user) a long meaning WRAPS - main.css's base td rule (nowrap + ellipsis) cut it off
    if (f) { f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); }   // the filter above hid every row
    var mtd = rowOf('V_ID') && rowOf('V_ID').querySelector('.pnb-dict-text');
    if (mtd) {
      var h0 = mtd.getBoundingClientRect().height;
      mtd.firstChild.nodeValue = new Array(40).join('A long description of what this column holds. ');
      var cs = getComputedStyle(mtd), h1 = mtd.getBoundingClientRect().height;
      ok('wraps', cs.whiteSpace === 'normal' && cs.textOverflow !== 'ellipsis' && mtd.scrollWidth <= mtd.clientWidth + 1 && h1 > h0 * 3, [cs.whiteSpace, cs.textOverflow, mtd.scrollWidth, mtd.clientWidth, h0, h1]);
    } else { ok('wraps', false, 'no V_ID meaning cell'); }
    await closeDialog();
  }

  // ------------------------------------------------------------------ dmenu
  async function dmenu() {
    rclick(fth('V_AMOUNT'));
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    var it = menuItem('about');
    ok('aboutItem', !!it && /What this column means/.test(it.textContent));
    var acts = Array.prototype.map.call(document.querySelectorAll('#pnbHeadMenu .pnb-hm-item'), function (e) { return e.getAttribute('data-act'); });
    ok('aboutBeforeFilter', acts.indexOf('about') !== -1 && (acts.indexOf('filter') === -1 || acts.indexOf('about') < acts.indexOf('filter')), acts);
    if (it) it.click();
    await until(function () { return rows().length > 0; }, 4000);
    var fr = dlgBody() && dlgBody().querySelector('tr.is-focus');
    ok('focusRow', !!fr && fr.getAttribute('data-key') === 'V_AMOUNT', fr && fr.getAttribute('data-key'));
    await closeDialog(); closeMenu();
    rclick(fth('V_STATUS'));
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    ok('noItemWithoutEntry', !!document.getElementById('pnbHeadMenu') && !menuItem('about'));
    closeMenu();
    // a cell's menu is the column's too
    var td = document.querySelector('#resultsTable tbody td[data-column] ');
    var vth = fth('V_ID'), col = vth && vth.getAttribute('data-column');
    var cell = col !== null ? document.querySelector('#resultsTable tbody tr td[data-column="' + col + '"]') : null;
    rclick(cell);
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    ok('cellMenuItem', !!menuItem('about'));
    closeMenu();
  }

  // ------------------------------------------------------------------ dopts
  async function dopts() {
    var A = window.Penumbra && window.Penumbra.headerMenu;
    A.openColOpts(fth('V_AMOUNT'), 'V_AMOUNT', 'V_AMOUNT', false, null);
    await until(function () { return !!document.querySelector('.pnb-colopt'); }, 3000);
    var l = document.querySelector('.pnb-colopt [data-co="about"]');
    ok('aboutLink', !!l && l.textContent === 'What this column means');
    if (l) l.click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('linkOpens', !!dlgBody() && !!dlgBody().querySelector('tr.is-focus[data-key="V_AMOUNT"]'));
    ok('popoverClosed', !document.querySelector('.pnb-colopt'));
    await closeDialog();
    A.openColOpts(fth('V_STATUS'), 'V_STATUS', 'V_STATUS', false, null);
    await until(function () { return !!document.querySelector('.pnb-colopt'); }, 3000);
    ok('noLinkWithoutEntry', !!document.querySelector('.pnb-colopt') && !document.querySelector('.pnb-colopt [data-co="about"]'));
    if (A.closeColOpts) A.closeColOpts();
  }

  // ------------------------------------------------------------------ dview
  async function dview() {
    var adm = document.getElementById('admWrapper'); if (adm) adm.parentNode.removeChild(adm);
    var a = link('dict'); if (a) a.click();
    await until(function () { return rows().length > 0; }, 4000);
    var b = dlgBody();
    ok('viewerRows', rows().length === 5);
    ok('noMissing', !!b && !b.querySelector('.pnb-dict-missing'));
    ok('noGoneTag', !!b && !b.querySelector('.pnb-dict-tag[title^="No column"]'));
    ok('noAuthorBar', !!b && !b.querySelector('.pnb-dict-authorbar'));
    ok('draftStillShown', !!(rowOf('V_NAME') && rowOf('V_NAME').querySelector('.pnb-dict-draft')));
    await closeDialog();
    ok('cannotGenerate', D() && D().generatorAvailable() !== true);
    var a2 = link('dict'); if (a2) a2.click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('noEditViewer', !!dlgBody() && !dlgBody().querySelector('[data-dd="edit"]'));
    await closeDialog();
  }

  // ------------------------------------------------------------------ dblank
  async function dblank() {
    ok('noLink', !link('dict') && document.querySelectorAll('#reportSnippetOutput a.snippet-action[data-action-name="infobox"]').length === 0);
    ok('stillHas', D() && D().has() === true);
    rclick(fth('V_ID'));
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    ok('menuItem', !!menuItem('about'));
    var it = menuItem('about'); if (it) it.click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('defaultTitle', !!dialog() && dialog().querySelector('.pnb-dlg-title').textContent === 'Data dictionary');
    await closeDialog(); closeMenu();
  }

  // ------------------------------------------------------------------ dsub
  async function dsub() {
    await until(function () { return !!document.querySelector('#mainReportSubtitle a.snippet-action[data-action-mode="dict"]'); }, 4000);
    var a = document.querySelector('#mainReportSubtitle a.snippet-action[data-action-mode="dict"]');
    ok('subLink', !!a && a.textContent === 'Glossary', document.getElementById('mainReportSubtitle').innerHTML.slice(0, 300));
    ok('notFromSnippet', D() && D().has() === false);
    if (a) a.click();
    await until(function () { return rows().length > 0; }, 4000);
    ok('subPayload', rowKeys().join() === 'V_ID' && rowOf('V_ID').textContent.indexOf('Subtitle meaning of the id.') !== -1, dlgBody() && dlgBody().innerHTML.slice(0, 300));
    // (2026-10-22 c) nowhere to write a subtitle's payload back: Generate, but no Edit
    ok('subNoEdit', !!dlgBody() && !dlgBody().querySelector('[data-dd="edit"]') && !!dlgBody().querySelector('[data-dd="gen"]'));
    await closeDialog();
  }

  // ------------------------------------------------------------------ dnone
  async function dnone() {
    ok('noLink', !link('dict'));
    ok('hasFalse', !D() || D().has() === false);
    rclick(fth('V_AMOUNT'));
    await until(function () { return !!document.getElementById('pnbHeadMenu'); }, 3000);
    ok('noMenuItem', !!document.getElementById('pnbHeadMenu') && !menuItem('about'));
    closeMenu();
  }

  // ------------------------------------------------------------------ dgen
  function fakeXhr(status, body, log) {
    window.XMLHttpRequest = function () {
      var x = this; x.readyState = 0; x.status = 0; x.responseText = ''; x.headers = {};
      x.open = function (m, u) { x.m = m; x.u = u; };
      x.setRequestHeader = function (k, v) { x.headers[k] = v; };
      x.getResponseHeader = function () { return null; };
      x.abort = function () { };
      x.send = function (b) { log.push({ m: x.m, u: x.u, headers: x.headers, body: b }); setTimeout(function () { x.readyState = 4; x.status = status; x.responseText = JSON.stringify(body); x.onreadystatechange && x.onreadystatechange(); }, 50); };
    };
  }
  function gen() { return document.querySelector('.pnb-dictgen-overlay'); }
  function gq(s) { var g = gen(); return g ? g.querySelector(s) : null; }
  // (2026-10-22 c) Generate's result opens in the grid: "Edit as text" shows the raw block
  function genText() {
    var t = gq('.pnb-dictgen-txt'), b = gq('[data-dg="text"]');
    if (t && t.hidden && b) { b.click(); }
    return t ? t.value : '';
  }
  async function dgen() {
    var log = [];
    fakeXhr(200, { status: 'ok', dictionary: 'Fixture rows are vendor payments.\nV_ID | Gen id. | source: LR_FIXTURE.V_ID\nV_NAME | Gen vendor name. | source: LR_FIXTURE.V_NAME\nV_AMOUNT | GEN SHOULD NOT REPLACE\nV_DATE | Gen payment date.\n```', sources: 'table definitions' }, log);
    // the sidebar's button
    if (window.PenumbraSnippetHelp && typeof PenumbraSnippetHelp.mount === 'function') { try { PenumbraSnippetHelp.mount(); } catch (e) { R.info.mount = String(e); } }
    var btn = document.getElementById('snipGenDictBtn');
    ok('sidebarButton', !!btn);
    if (btn) btn.click(); else if (D()) D().openGenerator();
    await until(function () { return !!gen(); }, 3000);
    ok('dialogOpens', !!gen() && /Generate data dictionary/.test(gq('.pnb-dlg-title').textContent));
    ok('existingSaid', !!gen() && /4 checked, 1 AI draft/.test(gen().textContent), gen() && gen().textContent.slice(0, 400));
    ok('noRequestOnOpen', log.length === 0);
    gq('[data-dg="go"]').click();
    await until(function () { return gq('[data-dg="insert"]') && !gq('[data-dg="insert"]').hidden; }, 4000);
    var req = log[0] ? JSON.parse(log[0].body) : {};
    ok('requestShape', log.length === 1 && log[0].m === 'POST' && log[0].u === 'generate_dictionary.php' && log[0].headers['X-Penumbra-Csrf'] === '1'
       && /LR_FIXTURE/.test(req.sql) && /V_AMOUNT \| What was paid/.test(req.existing), log[0] && log[0].headers);
    var names = (req.columns || []).map(function (c) { return c.name; });
    ok('requestColumns', names.indexOf('V_ID') === 0 && names.indexOf('V_STATUS') !== -1 && names.indexOf('#') === -1 && names.every(function (n) { return n.indexOf('__JOURNAL') !== 0; }), names);
    ok('gridShown', !!gq('.pnb-dictgen-grid .pnb-dicted') && !gq('.pnb-dictgen-grid').hidden && gq('.pnb-dictgen-txt').hidden
       && !!gq('.pnb-dicted tr.is-new[data-key="V_NAME"]') && !!gq('.pnb-dicted tr.is-new[data-key="V_DATE"]') && !gq('.pnb-dicted tr.is-new[data-key="V_AMOUNT"]')
       && /rewritten/.test(gq('.pnb-dicted tr[data-key="V_NAME"] .pnb-dicted-gen').textContent) && /new/.test(gq('.pnb-dicted tr[data-key="V_DATE"] .pnb-dicted-gen').textContent));
    var txt = genText(), p = D().fromSnippet(txt), by = {};
    p.entries.forEach(function (e) { by[e.key] = e; });
    ok('keptChecked', by.V_AMOUNT && by.V_AMOUNT.text === 'What was paid, in dollars (<b>not</b> cents).' && !by.V_AMOUNT.draft && by.V_ID.text === 'The payment id (as in RED.', by.V_AMOUNT);
    ok('draftReplaced', by.V_NAME && by.V_NAME.text === 'Gen vendor name.' && by.V_NAME.draft && by.V_NAME.source === 'LR_FIXTURE.V_NAME', by.V_NAME);
    ok('added', by.V_DATE && by.V_DATE.draft && by.V_DATE.text === 'Gen payment date.', by.V_DATE);
    ok('staleKept', !!by.H_OLD && !!by.H_ZZ && by.H_ZZ.avoid);
    ok('noteKept', p.note.join() === 'One row per vendor payment. A payment can repeat across statuses.', p.note);
    ok('summary', /1 new/.test(gq('.pnb-dictgen-sum').textContent) && /1 draft rewritten/.test(gq('.pnb-dictgen-sum').textContent) && /H_OLD/.test(gq('.pnb-dictgen-sum').textContent), gq('.pnb-dictgen-sum').textContent);
    ok('noFence', txt.indexOf('```') === -1 && txt.indexOf('`)') === txt.length - 2);
    // (2026-10-22 c) an edit in the text carries back to the grid, which is what Insert writes
    var ta = gq('.pnb-dictgen-txt');
    ta.value = ta.value.replace('Gen payment date.', 'Edited in text.');
    var tb = gq('[data-dg="text"]'); if (tb) tb.click();   // (live before the editor has no toggle: Insert reads the text)
    var vd = gq('.pnb-dicted tr[data-key="V_DATE"]');
    ok('textBack', !!gq('.pnb-dictgen-grid') && !gq('.pnb-dictgen-grid').hidden && ta.hidden && !!vd && vd.querySelector('textarea').value === 'Edited in text.' && vd.classList.contains('is-draft'), vd && vd.outerHTML.slice(0, 300));
    gq('[data-dg="insert"]').click();
    await until(function () { return !gen(); }, 3000);
    var snip = window.Penumbra.snippetText();
    ok('inserted', D().blocks(snip).length === 1 && /^Before the block\. sum\(V_AMOUNT\)\n/.test(snip) && /\nAfter the block\.$/.test(snip) && /V_DATE \| \? Edited in text\./.test(snip), snip);
    ok('toastSaysSave', window.__toasts.some(function (t) { return /Save the report/.test(t); }));
    ok('currentFollows', D().entryFor('V_DATE') && D().entryFor('V_DATE').text === 'Edited in text.');
    // re-open: the inserted block is now the existing one (round trip through the builder)
    D().openGenerator();
    await until(function () { return !!gen(); }, 3000);
    ok('reopenCounts', !!gen() && /4 checked, 2 AI drafts/.test(gen().textContent), gen() && gen().textContent.slice(0, 300));
    gq('[data-dg="cancel"]').click();
    await until(function () { return !gen(); }, 3000);
    // an encrypted report: the box must be ticked before anything is sent
    window.Penumbra.dictEncrypted = function () { return true; };
    log.length = 0;
    D().openGenerator();
    await until(function () { return !!gen(); }, 3000);
    gq('[data-dg="go"]').click();
    await sleep(300);
    ok('encBlocks', log.length === 0 && /Tick the box/.test(gq('.pnb-dictgen-err').textContent));
    ok('errInFooter', !!gq('.modal-prompt-buttons .pnb-dictgen-err'));
    gq('input[type="checkbox"]').checked = true;
    gq('[data-dg="go"]').click();
    await until(function () { return log.length === 1; }, 3000);
    ok('encSendsWhenTicked', log.length === 1);
    var ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.dispatchEvent(ev);
    await until(function () { return !gen(); }, 3000);
    ok('escCloses', !gen());
  }
  async function dgenerr() {
    var log = [], before = window.Penumbra.snippetText();
    fakeXhr(502, { status: 'error', message: 'The AI service answered HTTP 529.' }, log);
    D().openGenerator();
    await until(function () { return !!gen(); }, 3000);
    gq('[data-dg="go"]').click();
    await until(function () { return /HTTP 529/.test(gq('.pnb-dictgen-err').textContent); }, 3000);
    ok('errorShown', /HTTP 529/.test(gq('.pnb-dictgen-err').textContent));
    ok('noInsert', gq('[data-dg="insert"]').hidden && gq('.pnb-dictgen-out').hidden);
    ok('snippetUntouched', window.Penumbra.snippetText() === before);
    gq('[data-dg="cancel"]').click();
  }

  var RUN = { dlazy: dlazy, dedit: dedit, pdict: pdict, dunit: dunit, dlink: dlink, dmenu: dmenu, dopts: dopts, dview: dview, dblank: dblank, dsub: dsub, dnone: dnone, dgen: dgen, dgenerr: dgenerr };
  (async function () {
    try { await boot(); await RUN[SCN](); }
    catch (e) { R.errors.push('driver: ' + (e && e.stack || e)); }
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
