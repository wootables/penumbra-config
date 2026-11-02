// sharednote suite - browser half (2026-11-01). Runs ONE scenario (?scn=) against whichever main.js the page
// loaded and publishes window.__JRRESULT = { scn, asserts: [{id, ok, detail}], errors } + window.__JRDONE.
// The Notes column as a Shared note (?mode=shared): one note a table row, anyone edits it from the text it holds.
//   L-*  the cell          K-*  the note card: Edit, Save, Cancel / Escape     N-*  a row with no note: write one
//   F-*  someone saved first (409)   R-*  clearing it   X-*  copies / downloads / search read its text
//   T-*  the View Options type: saved, restored, needs row notes   I-*  the cards' panel (journalInlineNotes)
//   C-*  a Discussion report exactly as before (green on the control too)
// GROUND TRUTH: the fake server (harness.html window.__J) and the strings below, written by hand.
(function () {
  var JR = window.__JR || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function key(el, k, opts) { el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, opts || {}))); }

  var K3 = window.__NOTED, K7 = window.__FILEROW, J = window.__J;
  var BASE3 = 'Follow up\nnext week.';

  function notesTd(rk) {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i].parentNode;
    return null;
  }
  function emptyRowKey() {
    var b = document.querySelector('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn:not(.has-notes):not([disabled])');
    return b ? b.getAttribute('data-row-key') : null;
  }
  function card() { return document.querySelector('.journal-pvnote-card'); }
  function box() { var c = card(); return c ? c.querySelector('.pnb-sharednote') : null; }
  function ta() { var b = box(); return b ? b.querySelector('.pnb-sharednote-input') : null; }
  // (sharedmention, 2026-11-01) the box is the note composer's mention field: its text through getText / setText
  function val(el) { return !el ? null : (el._mentionMf ? el._mentionMf.getText() : (el.tagName === 'TEXTAREA' ? el.value : el.textContent)); }   // (a textarea: the build before)
  function setVal(el, t) { if (el._mentionMf) el._mentionMf.setText(t); else if (el.tagName === 'TEXTAREA') el.value = t; else el.textContent = t; }
  function preview(rk) { var td = notesTd(rk), p = td && td.querySelector('.journal-notes-preview'); return p ? p.textContent : null; }
  function count(rk) { var td = notesTd(rk), c = td && td.querySelector('.journal-notes-count'); return c ? c.textContent : null; }
  function lastPost() { return J.posts.length ? J.posts[J.posts.length - 1] : null; }
  async function openCard(rk) {
    var td = notesTd(rk);
    if (!td) throw new Error('no notes cell for ' + rk);
    clickEl(td.querySelector('.journal-notes-btn'));
    await until(function () { var c = card(); return c && c.getAttribute('data-pvn-key') === rk; }, 3000);
    await sleep(150);
    return card();
  }
  async function save() { clickEl(box().querySelector('.pnb-sharednote-save')); await sleep(250); await until(function () { return !box() || !box()._snSaving; }, 3000); await sleep(250); }
  async function boot() {
    await until(function () { return window.__queryDone >= 1 && (window.__JR_HIDES || 0) >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }

  var S = {};
  // ---- the cell --------------------------------------------------------------------------------
  S.cell = async function () {
    rec('L-preview', preview(K3) === 'Follow up · next week.', 'K3 (its newest root note, line breaks as ·): ' + JSON.stringify(preview(K3)));
    rec('L-nocount', count(K3) === '', 'no count on a Shared note: ' + JSON.stringify(count(K3)));
    var b = notesTd(K3).querySelector('.journal-notes-btn');
    rec('L-tip', (b.getAttribute('aria-label') || '') === 'This row\'s note - click to see or edit it: Follow up · next week.', b.getAttribute('aria-label'));
    var ek = emptyRowKey(), eb = ek && notesTd(ek).querySelector('.journal-notes-btn');
    rec('L-empty', !!eb && eb.getAttribute('aria-label') === 'Write this row\'s note' && !notesTd(ek).querySelector('.journal-notes-preview'), eb && eb.getAttribute('aria-label'));
  };
  // ---- the card: view, Edit, Save ----------------------------------------------------------------
  S.card = async function () {
    await openCard(K3);
    var b = box();
    var txt = b && b.querySelector('.pnb-sharednote-text'), meta = b && b.querySelector('.pnb-sharednote-meta');
    rec('K-view', !!txt && txt.innerHTML === 'Follow up<br>next week.' && !card().querySelector('.journal-rownote-item') && !card().querySelector('.journal-rownote-input'),
        'the one note, line breaks kept, no thread / composer: ' + (txt && txt.innerHTML));
    rec('K-meta', !!meta && /^Last edited by Lee Roe, /.test(meta.textContent), meta && meta.textContent);
    var eb = b && b.querySelector('.pnb-sharednote-editbtn');
    rec('K-editbtn', !!eb && document.activeElement === eb && !ta(), 'opens on its Edit (focused), no box yet');
    clickEl(eb); await sleep(100);
    rec('K-box', !!ta() && val(ta()) === BASE3 && document.activeElement === ta() && b.classList.contains('is-editing'), 'Edit: a box holding the note, focused: ' + JSON.stringify(ta() && val(ta())));
    setVal(ta(), 'Follow up\nnext week.\nphone: 555-0100');
    await save();
    var p = lastPost();
    rec('K-post', !!p && p.action === 'edit' && String(p.note_id) === '902' && p.base_text === BASE3 && p.note_text === 'Follow up\nnext week.\nphone: 555-0100',
        'the edit carries the text it started from: ' + JSON.stringify(p));
    rec('K-after', !ta() && !!box() && box().querySelector('.pnb-sharednote-text').innerHTML === 'Follow up<br>next week.<br>phone: 555-0100'
        && /^Last edited by Kim Lo, /.test(box().querySelector('.pnb-sharednote-meta').textContent), 'saved: the box closes, the card shows it, as Kim\'s');
    await until(function () { return preview(K3) === 'Follow up · next week. · phone: 555-0100'; }, 2000);
    rec('K-cell', preview(K3) === 'Follow up · next week. · phone: 555-0100', 'the cell follows: ' + JSON.stringify(preview(K3)));
  };
  S.cancel = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(80);
    setVal(ta(), 'not this');
    key(ta(), 'Escape'); await sleep(120);
    rec('K-esc', !!card() && !ta() && J.posts.length === 0, 'Escape in the box cancels the edit, the card stays: card ' + !!card() + ' box ' + !!ta());
    rec('K-esc-focus', document.activeElement === box().querySelector('.pnb-sharednote-editbtn'), 'the focus back on Edit');
    clickEl(card().querySelector('.journal-rownote-close')); await sleep(120);
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(80);
    setVal(ta(), 'typed, then closed');
    clickEl(card().querySelector('.journal-rownote-close')); await sleep(120);
    await openCard(K3);
    rec('K-draft', !!ta() && val(ta()) === 'typed, then closed' && J.posts.length === 0, 'a card closed mid-edit: back on the next open, unsaved: ' + JSON.stringify(ta() && val(ta())));
    clickEl(box().querySelector('.pnb-sharednote-cancel')); await sleep(80);
    clickEl(card().querySelector('.journal-rownote-close')); await sleep(120);
    await openCard(K3);
    rec('K-cancel', !ta() && J.posts.length === 0, 'Cancel drops it: the next open is on the note');
  };
  // ---- a row with no note -----------------------------------------------------------------------
  S.blank = async function () {
    var ek = emptyRowKey();
    await openCard(ek);
    rec('N-open', !!ta() && val(ta()) === '' && document.activeElement === ta(), 'a row with no note opens on the box');
    setVal(ta(), 'address: 12 Elm St\nphone: 555-0100');
    key(ta(), 'Enter', { ctrlKey: true }); await sleep(300);
    await until(function () { return !box() || !box()._snSaving; }, 3000); await sleep(250);
    var p = lastPost();
    rec('N-post', !!p && p.action === 'add' && p.scope === 'row' && p.row_key === ek && p.note_text === 'address: 12 Elm St\nphone: 555-0100' && !('base_text' in p),
        'Ctrl+Enter: the row\'s first note is added: ' + JSON.stringify(p));
    await until(function () { return preview(ek) === 'address: 12 Elm St · phone: 555-0100'; }, 2000);
    rec('N-cell', preview(ek) === 'address: 12 Elm St · phone: 555-0100' && !ta(), 'the cell shows it: ' + JSON.stringify(preview(ek)));
  };
  // ---- mentions in the box (sharedmention) ----------------------------------------------------------
  S.mention = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(120);
    var t = ta();
    rec('M-field', !!t && t.isContentEditable && !!t._mentionMf && t.classList.contains('journal-note-input'), 'the box is the composer\'s mention field');
    t.innerHTML = 'call <span class="journal-mention-pill" contenteditable="false" data-uid="pat">Pat Doe</span> about it';
    await save();
    var p = lastPost();
    rec('M-post', !!p && p.note_text === 'call @pat about it' && JSON.stringify(p.mentions) === '[{"user":"pat","name":""}]', 'a picked name goes as @uid, and is mentioned: ' + JSON.stringify(p));
    await sleep(300);
    var pill = box().querySelector('.pnb-sharednote-text .journal-mention-chip');   // the note's text shows a chip (the editor, a pill)
    rec('M-view', !!pill && pill.getAttribute('data-uid') === 'pat', 'the note shows the mention as a chip');
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(120);
    J.sneak = function () { J.notes[K3].forEach(function (n) { if (n.ID === '902') { n.NOTE_TEXT = 'pat changed it'; n.AUTHOR_NAME = 'Pat Doe'; n.CREATED_AT = moment().add(3, 'minutes').format('YYYY-MM-DD HH:mm:ss'); } }); };
    setVal(ta(), 'mine');
    await save();
    var st = box().querySelector('.pnb-sharednote-status');
    rec('M-clock', !!st && /^Changed by Pat Doe just now: /.test(st.textContent), 'a server clock ahead of the page\'s reads as now: ' + (st && st.textContent));
  };
  // ---- files (sharedfiles) ------------------------------------------------------------------------------------
  function mkFile(name, type, size) { return new File([new Uint8Array(size || 10)], name, { type: type || 'application/pdf' }); }
  function pick(input, files) { var dt = new DataTransfer(); files.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
  function staged() { var b = box(); return b ? Array.prototype.map.call(b.querySelectorAll('.pnb-sharednote-pick'), function (x) { return x.firstChild.textContent.trim(); }) : []; }
  function setNames() { var b = box(); return b ? Array.prototype.map.call(b.querySelectorAll('.pnb-sharednote-files-set .pnb-sharednote-file'), function (x) { return x.querySelector('.journal-attach-name').textContent.trim() + (x.querySelector('.pnb-sharednote-filedel') ? ' x' : ''); }) : []; }
  function rightOf(a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.left >= rb.right - 1 && ra.top < rb.bottom && ra.bottom > rb.top; }
  S.files = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(120);
    var at = box().querySelector('.pnb-sharednote-attach'), sv = box().querySelector('.pnb-sharednote-save');
    rec('G-row', !!at && rightOf(at, ta()) && rightOf(sv, ta()) && at.getBoundingClientRect().top < sv.getBoundingClientRect().top, 'Attach over Save, both on the box\'s right');
    var inp = box().querySelector('.pnb-sharednote-files');
    pick(inp, [mkFile('budget.pdf'), mkFile('map.png', 'image/png'), mkFile('virus.exe', 'application/octet-stream')]); await sleep(80);
    var st = box().querySelector('.pnb-sharednote-status');
    rec('G-staged', JSON.stringify(staged()) === '["budget.pdf","map.png"]' && /virus\.exe/.test(st.textContent), 'two picked, the .exe refused out loud: ' + JSON.stringify(staged()) + ' / ' + st.textContent);
    clickEl(box().querySelector('.pnb-sharednote-unpick[data-i="1"]')); await sleep(50);
    rec('G-unpick', JSON.stringify(staged()) === '["budget.pdf"]', JSON.stringify(staged()));
    pick(inp, [mkFile('photo.jpg', 'image/jpeg')]); await sleep(50);
    setVal(ta(), 'Follow up\nnext week.\nsee the files');
    var n0 = J.posts.length;
    await save(); await sleep(600);
    var ps = J.posts.slice(n0);
    rec('G-post', ps.length === 3 && ps[0].action === 'edit' && ps[0].base_text === BASE3 && ps[1].parent_id === '902' && ps[1].attachment.name === 'budget.pdf' && ps[2].parent_id === '902' && ps[2].attachment.name === 'photo.jpg' && ps[1].note_text === '',
        'the text, then each file as a reply to the note: ' + JSON.stringify(ps.map(function (x) { return [x.action, x.parent_id || '', x.attachment ? x.attachment.name : '']; })));
    await until(function () { return setNames().length === 2; }, 2000);
    rec('G-set', !ta() && JSON.stringify(setNames()) === '["budget.pdf x","photo.jpg x"]', 'the box closed; the row\'s files, each removable by its author: ' + JSON.stringify(setNames()));
    await until(function () { return /\[2 files\]$/.test(preview(K3) || ''); }, 2000);
    rec('G-cell', preview(K3) === 'Follow up · next week. · see the files · [2 files]', JSON.stringify(preview(K3)));
    clickEl(box().querySelector('.pnb-sharednote-file .pnb-sharednote-filedel')); await sleep(400);
    await until(function () { return setNames().length === 1; }, 2000);
    var dp = J.posts[J.posts.length - 1];
    rec('G-remove', dp.action === 'delete' && JSON.stringify(setNames()) === '["photo.jpg x"]' && /budget\.pdf/.test(window.__confirms[window.__confirms.length - 1] || ''), 'x asks, then deletes that file\'s note: ' + JSON.stringify(dp) + ' ' + JSON.stringify(setNames()));
  };
  S.filesonly = async function () {
    var ek = emptyRowKey();
    await openCard(ek);
    pick(box().querySelector('.pnb-sharednote-files'), [mkFile('scan1.pdf'), mkFile('scan2.pdf')]); await sleep(80);
    var n0 = J.posts.length;
    await save(); await sleep(600);
    var ps = J.posts.slice(n0);
    rec('H-first', ps.length === 2 && ps[0].action === 'add' && !ps[0].parent_id && ps[0].attachment.name === 'scan1.pdf' && ps[1].parent_id && ps[1].parent_id === String(5000 + n0 + 1) && ps[1].attachment.name === 'scan2.pdf',
        'no note yet: the first file IS the note, the second answers it: ' + JSON.stringify(ps.map(function (x) { return [x.action, x.parent_id || '', x.attachment ? x.attachment.name : '']; })));
    await until(function () { return setNames().length === 2; }, 2000);
    rec('H-set', JSON.stringify(setNames()) === '["scan1.pdf","scan2.pdf x"]' && !box().querySelector('.pnb-sharednote-text'), 'no text; the note\'s own file stays with the note: ' + JSON.stringify(setNames()));
    rec('H-cell', preview(ek) === '[file: scan1.pdf]', JSON.stringify(preview(ek)));
  };
  S.paste = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(120);
    var t = ta(); t.focus();
    var dt = new DataTransfer(); dt.items.add(mkFile('image.png', 'image/png'));
    t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await sleep(120);
    rec('G-paste', staged().length === 1 && /^pasted-\d{4}-\d\d-\d\d-\d{4}\.png$/.test(staged()[0]) && val(ta()) === BASE3, 'a pasted image joins the picked files, renamed; the text as it was: ' + JSON.stringify(staged()));
    var rc = ta().getBoundingClientRect();   // the drop's point: on the box (the page reads where it lands from the card's own box)
    var dt2 = new DataTransfer(); dt2.items.add(mkFile('dropped.xlsx', 'application/vnd.ms-excel')); dt2.items.add(mkFile('dropped2.csv', 'text/csv'));
    var x = rc.left + 20, y = rc.top + 10;
    document.body.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt2, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt2, clientX: x, clientY: y, bubbles: true, cancelable: true })); await sleep(120);
    rec('G-drop', JSON.stringify(staged().slice(1)) === '["dropped.xlsx","dropped2.csv"]', 'files dropped on the card join them, every one: ' + JSON.stringify(staged()) + ' | at ' + Math.round(x) + ',' + Math.round(y) + ' card ' + getComputedStyle(card()).visibility + ' types ' + JSON.stringify(Array.from(dt2.types)));
    J.failFile = 'dropped2.csv';
    await save(); await sleep(600);
    var st = box() && box().querySelector('.pnb-sharednote-status');
    rec('G-fail', !!ta() && JSON.stringify(staged()) === '["dropped2.csv"]' && !!st && /dropped2\.csv/.test(st.textContent) && st.getAttribute('data-kind') === 'error',
        'a file refused stays picked with its reason; the others are in: ' + JSON.stringify(staged()) + ' / ' + (st && st.textContent));
  };
  S.layout = async function () {
    await openCard(K3);
    var c = card(), inp = c.querySelector('.journal-rownote-input'), at = c.querySelector('.journal-rownote-compose .journal-attach-btn'), po = c.querySelector('.journal-rownote-post');
    rec('C-layout', !!inp && !!at && !!po && rightOf(at, inp) && rightOf(po, inp) && at.getBoundingClientRect().top < po.getBoundingClientRect().top, 'Discussion: Attach over Post on the box\'s right, as in the journal panel');
    // the cards' notes panel (a card ~340px wide): Discussion's composer, then a Shared note's box
    var I = window.Penumbra.journalInlineNotes, host = document.createElement('div');
    host.id = 'pnbCardsHost'; host.style.cssText = 'position:fixed;left:10px;top:10px;width:340px;background:#fff;z-index:99999';
    host.className = 'is-large';   // (cfb8) a Large card: the buttons beside the box (a Medium card's go under it: the -medium checks)
    function under(x, i) { return !!x && !!i && x.getBoundingClientRect().top >= i.getBoundingClientRect().bottom - 1; }
    document.body.appendChild(host);
    host.innerHTML = I.html(K3, 'Notes'); var p = host.firstChild; I.compose(p, ''); await sleep(120);
    var i2 = p.querySelector('.journal-rownote-input'), a2 = p.querySelector('.journal-attach-btn'), c2 = p.querySelector('.journal-rownote-inlinecancel'), p2 = p.querySelector('.journal-rownote-post');
    rec('C-layout-card', !!i2 && !!a2 && !!c2 && !!p2 && rightOf(a2, i2) && rightOf(c2, i2) && rightOf(p2, i2) && a2.getBoundingClientRect().top < c2.getBoundingClientRect().top && c2.getBoundingClientRect().top < p2.getBoundingClientRect().top,
        'a card\'s composer: Attach over Cancel over Post on the box\'s right');
    // (cfb8, the user: on a Medium card the box beside its buttons was too narrow) a Medium card (no size class): the box the
    // card's width, its buttons across under it - Attach on the left, Cancel and Post on the right, one line
    host.className = ''; await sleep(80);
    rec('C-layout-medium', under(a2, i2) && under(c2, i2) && under(p2, i2) && Math.abs(c2.getBoundingClientRect().top - p2.getBoundingClientRect().top) < 3 && Math.abs(a2.getBoundingClientRect().top - p2.getBoundingClientRect().top) < 3
        && a2.getBoundingClientRect().right < c2.getBoundingClientRect().left && c2.getBoundingClientRect().right <= p2.getBoundingClientRect().left + 1 && i2.getBoundingClientRect().width > 300,
        'a Medium card\'s composer: the box the card\'s width, Attach / Cancel / Post across under it');
    host.className = 'is-large';
    I.close(p, false);
    var sh = document.getElementById('journalNotesModeShared'); sh.checked = true; sh.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300);
    host.innerHTML = I.html(K3, 'Notes'); p = host.firstChild; I.compose(p, ''); await sleep(120);
    var i3 = p.querySelector('.pnb-sharednote-input'), a3 = p.querySelector('.pnb-sharednote-attach'), s3 = p.querySelector('.pnb-sharednote-save');
    rec('G-layout-card', !!i3 && !!a3 && !!s3 && rightOf(a3, i3) && rightOf(s3, i3), 'a Shared note in a card: Attach and Save on the box\'s right');
    host.className = ''; await sleep(80);   // (cfb8) a Medium card: Attach and Save under the box, Attach on the left
    rec('G-layout-medium', under(a3, i3) && under(s3, i3) && a3.getBoundingClientRect().right < s3.getBoundingClientRect().left && i3.getBoundingClientRect().width > 300, 'a Shared note in a Medium card: Attach and Save under the box');
    host.className = 'is-large';
    I.close(p, false); host.remove();
  };
  // ---- a small card's Edit opens its details (sharedcard) ------------------------------------------------------
  // window.Penumbra.cards stands in for penumbra_cards.js's two calls the page makes: size() and openDetails(card),
  // which draws #pnbCardDetails with the row's notes panel (.pnb-cdet-notes), as the card module does.
  S.smallcard = async function () {
    var I = window.Penumbra.journalInlineNotes, keep = window.Penumbra.cards, size = 'standard';
    window.Penumbra.cards = { size: function () { return size; }, openDetails: function (card) {
      var dl = document.getElementById('pnbCardDetails');
      if (!dl) { dl = document.createElement('div'); dl.id = 'pnbCardDetails'; dl.style.cssText = 'position:fixed;left:400px;top:10px;width:500px;background:#fff;z-index:99999'; document.body.appendChild(dl); }
      dl.innerHTML = '<div class="pnb-cdet-notes">' + I.html(K3, 'Notes') + '</div>';
      return true;
    } };
    var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:10px;top:10px;width:340px;background:#fff;z-index:99999';
    document.body.appendChild(host);
    function cardBox() { host.innerHTML = '<div class="pnb-card"><div class="pnb-card-notes">' + I.html(K3, 'Notes') + '</div></div>'; return host.querySelector('.pnb-sharednote'); }
    function detBox() { var dl = document.getElementById('pnbCardDetails'); return dl ? dl.querySelector('.pnb-cdet-notes .pnb-sharednote') : null; }
    function reset() { var dl = document.getElementById('pnbCardDetails'); if (dl) dl.remove(); }
    var res = {};
    for (var k = 0; k < 2; k++) {
      size = k ? 'compact' : 'standard'; reset();
      var cb = cardBox();
      clickEl(cb.querySelector('.pnb-sharednote-editbtn')); await sleep(150);
      var db = detBox();
      res[size] = !!db && db.classList.contains('is-editing') && !!db.querySelector('.pnb-sharednote-input') && !cb.classList.contains('is-editing') && document.activeElement === db.querySelector('.pnb-sharednote-input');
      if (db) I.close(db, false);
    }
    rec('S-standard', res.standard, 'a standard card\'s Edit: its details open, the box editing there (focused), not on the card');
    rec('S-compact', res.compact, 'a compact card\'s Edit: the same');
    size = 'large'; reset();
    var cl = cardBox();
    clickEl(cl.querySelector('.pnb-sharednote-editbtn')); await sleep(150);
    rec('S-large', !detBox() && cl.classList.contains('is-editing'), 'a large card edits in place');
    I.close(cl, false);
    size = 'standard'; reset();
    var cc = cardBox();
    var ok = I.compose(cc, 'from the menu'); await sleep(150);
    var dc = detBox();
    rec('S-compose', ok === true && !!dc && dc.classList.contains('is-editing') && /from the menu$/.test(val(dc.querySelector('.pnb-sharednote-input'))), 'the card menu\'s Edit this card\'s note: in the details too, with its text');
    if (dc) I.close(dc, false);
    size = 'standard'; reset();
    var cd = cardBox();
    cd.querySelector('.pnb-sharednote-text').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window })); await sleep(150);
    rec('S-dblclick', !!detBox() && detBox().classList.contains('is-editing'), 'a double-click on the note: the same');
    reset(); host.remove(); window.Penumbra.cards = keep;
  };
  // ---- someone saved first ------------------------------------------------------------------------
  S.conflict = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(80);
    setVal(ta(), 'mine');
    J.sneak = function () { J.notes[K3].forEach(function (n) { if (n.ID === '902') { n.NOTE_TEXT = 'pat changed it'; n.AUTHOR_NAME = 'Pat Doe'; n.CREATED_BY = 'pat'; n.CREATED_AT = '2026-11-01 11:58:00'; } }); };
    await save();
    var st = box().querySelector('.pnb-sharednote-status');
    rec('F-word', !!st && st.getAttribute('data-kind') === 'warn' && /^Changed by Pat Doe .*Save again to replace it with yours, or Cancel to keep theirs\.$/.test(st.textContent), st && st.textContent);
    await until(function () { var t = box().querySelector('.pnb-sharednote-text'); return t && t.textContent === 'pat changed it'; }, 2000);
    rec('F-theirs', box().querySelector('.pnb-sharednote-text').textContent === 'pat changed it' && !!ta() && val(ta()) === 'mine',
        'theirs above, mine kept in the box: ' + JSON.stringify(box().querySelector('.pnb-sharednote-text').textContent) + ' / ' + JSON.stringify(ta() && val(ta())));
    await save();
    var p = lastPost();
    rec('F-again', !!p && p.base_text === 'pat changed it' && p.note_text === 'mine' && !ta(), 'Save again replaces theirs, from their text: ' + JSON.stringify(p));
  };
  // ---- clearing ------------------------------------------------------------------------------------
  S.clear = async function () {
    await openCard(K3);
    clickEl(box().querySelector('.pnb-sharednote-editbtn')); await sleep(80);
    setVal(ta(), '  \n ');
    await save();
    var p = lastPost();
    rec('R-post', !!p && p.action === 'edit' && p.note_text === '' && p.base_text === BASE3, 'an empty box saves as a clear: ' + JSON.stringify(p));
    await until(function () { return preview(K3) === 'First look done.'; }, 2000);
    rec('R-after', preview(K3) === 'First look done.', 'the row\'s next note (an older root) is its note now: ' + JSON.stringify(preview(K3)));
  };
  // ---- copies, downloads, search --------------------------------------------------------------------
  S.export = async function () {
    rec('X-text', window.Penumbra.journalRowNotesText(K3) === BASE3, JSON.stringify(window.Penumbra.journalRowNotesText(K3)));
    var csv = JR.getExportData('csv').content;
    rec('X-csv', csv.indexOf('"Follow up\nnext week."') >= 0 && csv.indexOf('Lee Roe:') < 0, 'the CSV cell is the note itself (no date / author)');
    var par = null;
    try { par = await (await fetch('parity.json', { cache: 'no-store' })).json(); } catch (e) { }
    var mine = par ? window.Penumbra.journalNotesFlatten(par.notes) : null;
    rec('X-parity', !!par && typeof par.text === 'string' && par.text.length > 20 && mine === par.text, par ? JSON.stringify(mine) + ' vs ' + JSON.stringify(par.text) : 'no parity.json');
    var st = window.Penumbra.journalRowNotesSearchText;
    var row = null; for (var i = 0; i < window.__rowsFixture.length; i++) if (window.__keyOf(window.__rowsFixture[i]) === K3) row = window.__rowsFixture[i];
    var stx = st ? st(new Map(Object.entries(row))) : null;   // a row as the table keeps it (a Map)
    rec('X-search', stx === BASE3, 'the search reads the note\'s text: ' + JSON.stringify(stx));
  };
  // ---- the type in View Options -----------------------------------------------------------------------
  S.setup = async function () {
    var sh = document.getElementById('journalNotesModeShared'), di = document.getElementById('journalNotesModeDiscussion');
    rec('T-default', !!sh && !!di && di.checked && !sh.checked && !sh.disabled, sh ? 'discussion ' + di.checked + ' shared ' + sh.checked + ' disabled ' + sh.disabled : 'no radios');
    if (!sh) return;
    sh.checked = true; sh.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400);
    var vo = (JR.buildStateObject() || {}).viewOptions || {};
    rec('T-on', window._penumbraJournalNotesMode === 'shared' && vo.journalNotesMode === 'shared', 'saved: ' + JSON.stringify(vo.journalNotesMode));
    await until(function () { return count(K3) === ''; }, 2000);
    rec('T-live', count(K3) === '' && preview(K3) === 'Follow up · next week.', 'the cells redrawn as a Shared note: count ' + JSON.stringify(count(K3)));
    di.checked = true; di.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400);
    vo = (JR.buildStateObject() || {}).viewOptions || {};
    rec('T-off', !('journalNotesMode' in vo) && count(K3) === '3', 'Discussion is not written: ' + JSON.stringify(vo.journalNotesMode) + ' count ' + count(K3));
    var rn = document.getElementById('journalRowNotesEnable');
    rn.checked = false; rn.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300);
    rec('T-needs-notes', sh.disabled && di.disabled, 'no row notes: the type is not offered');
  };
  S.restore = async function () {
    var sh = document.getElementById('journalNotesModeShared');
    rec('T-restore', !!sh && sh.checked && window._penumbraJournalNotesMode === 'shared', sh ? 'checked ' + sh.checked : 'no radio');
  };
  // ---- the cards' panel (penumbra_cards.js draws it through this API) ---------------------------------
  S.inline = async function () {
    var I = window.Penumbra.journalInlineNotes;
    var host = document.createElement('div'); host.id = 'snInline'; document.body.appendChild(host);
    host.innerHTML = I.html(K3, 'Contacts');
    var p = host.firstChild;
    rec('I-html', p.classList.contains('pnb-sharednote') && p.classList.contains('journal-rownote-inline') && p.querySelector('.journal-rownote-inlinelbl').textContent === 'Contacts'
        && p.querySelector('.pnb-sharednote-text').innerHTML === 'Follow up<br>next week.' && !!p.querySelector('.pnb-sharednote-editbtn'), p.outerHTML.slice(0, 300));
    var ok = I.compose(p, 'call Tuesday'); await sleep(80);
    var t = p.querySelector('.pnb-sharednote-input');
    rec('I-compose', ok === true && !!t && val(t) === BASE3 + '\ncall Tuesday' && p.classList.contains('is-composing'), 'Add a note (menu / Quick actions): the text on a line of its own: ' + JSON.stringify(t && val(t)));
    I.close(p, false); await sleep(50);
    host.innerHTML = I.html(K3, 'Contacts'); p = host.firstChild;
    clickEl(p.querySelector('.pnb-sharednote-editbtn')); await sleep(80);
    t = p.querySelector('.pnb-sharednote-input');
    rec('I-draft', !!t && val(t) === BASE3 + '\ncall Tuesday', 'a panel redrawn away keeps the edit as a draft: ' + JSON.stringify(t && val(t)));
    rec('I-escape', I.escape(t) === true && !p.querySelector('.pnb-sharednote-input'), 'the cards\' Escape folds the box');
  };
  // ---- Discussion, as before ---------------------------------------------------------------------------
  S.discussion = async function () {
    rec('C-cell', count(K3) === '3' && preview(K3) === 'Follow up next week.', 'count ' + count(K3) + ' preview ' + JSON.stringify(preview(K3)));
    await openCard(K3);
    rec('C-card', !box() && card().querySelectorAll('.journal-rownote-item').length === 3 && !!card().querySelector('.journal-rownote-input'), 'the thread and its composer');
    rec('C-flat', window.Penumbra.journalRowNotesText(K3).indexOf('2026-10-01 Pat Doe: First look done.') === 0, JSON.stringify(window.Penumbra.journalRowNotesText(K3)));
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
    document.getElementById('out').textContent = 'DONE';
  })();
})();
