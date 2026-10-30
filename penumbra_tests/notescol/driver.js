// notescol suite - browser half (2026-10-14). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__JRRESULT = { scn, asserts: [{id, ok, detail}], errors: [...] } + window.__JRDONE = true.
// The Notes column as text: the newest note previewed in the cell; with
// viewOptions.journalNotesExport (?nx=1) the notes go into copies / downloads /
// emails (getExportData, generateWysiwygHtml); the author edits their own newest
// note from the card (?me=lee).
//
// GROUND TRUTH: the fake journal server (window.__J) and the strings below,
// written out by hand from the fixture - never computed by the code under test.
(function () {
  var JR = window.__JR || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JR_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }

  var K3 = window.__NOTED, K7 = window.__FILEROW;
  var FLAT3 = '2026-10-01 Pat Doe: First look done.\n  ↳ 2026-10-01 Lee Roe: Agreed.\n2026-10-01 Lee Roe: Follow up next week.';
  var FLAT7 = '2026-10-02 kim: [file: scan.pdf]';

  function notesTd(rk) {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i].parentNode;
    return null;
  }
  function anyEmptyNotesTd() {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn:not(.has-notes)');
    return bs.length ? bs[0].parentNode : null;
  }
  function card() { return document.querySelector('.journal-pvnote-card'); }
  async function openCard(rk) {
    var td = notesTd(rk);
    if (!td) throw new Error('no notes cell for ' + rk);
    clickEl(td.querySelector('.journal-notes-btn'));
    await until(function () { var c = card(); return c && c.getAttribute('data-pvn-key') === rk && c.querySelector('.journal-rownote-item'); }, 3000);
    await sleep(100);
    return card();
  }
  function composerText(c) { var i = c.querySelector('.journal-rownote-input'); return i ? i.innerText.replace(/ /g, ' ').replace(/\n+$/, '') : null; }
  function postBtn(c) { return c.querySelector('.journal-rownote-post'); }
  function lastPost() { var p = window.__J.posts; return p.length ? p[p.length - 1] : null; }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }

  var S = {};
  // ---- the cell: the newest note on one line -------------------------------------------------
  S.preview = async function () {
    var td = notesTd(K3), pv = td ? td.querySelector('.journal-notes-preview') : null;
    var cnt = td ? (td.querySelector('.journal-notes-count') || {}).textContent : null;
    rec('V-preview', !!pv && pv.textContent === 'Follow up next week.' && cnt === '3',
        'preview "' + (pv && pv.textContent) + '" count "' + cnt + '"');
    var btn = td ? td.querySelector('.journal-notes-btn') : null;
    rec('V-tip', !!btn && /^3 notes on this row - click to view\. Newest: Follow up next week\.$/.test(btn.getAttribute('aria-label') || ''), btn && btn.getAttribute('aria-label'));
    var pv7 = notesTd(K7) ? notesTd(K7).querySelector('.journal-notes-preview') : null;
    rec('V-preview-file', !!pv7 && pv7.textContent === '[file: scan.pdf]', pv7 && pv7.textContent);
    var e = anyEmptyNotesTd();
    rec('V-nopreview', !!e && !e.querySelector('.journal-notes-preview') && (e.querySelector('.journal-notes-count') || {}).textContent === '', 'a row with no notes: icon only');
    var cs = pv ? getComputedStyle(pv) : null;
    rec('V-oneline', !!cs && cs.whiteSpace === 'nowrap' && cs.textOverflow === 'ellipsis' && pv.getBoundingClientRect().width <= parseFloat(getComputedStyle(pv).fontSize) * 22 + 1,
        cs ? cs.whiteSpace + ' / ' + cs.textOverflow + ' / ' + pv.getBoundingClientRect().width : 'none');
    // the switch: there, off, and usable (row notes are on)
    var sw = document.getElementById('journalNotesExportEnable');
    rec('V-switch', !!sw && !sw.checked && !sw.disabled, sw ? 'checked ' + sw.checked + ' disabled ' + sw.disabled : 'missing');
    // off by default: every export is as it was
    var out = window.Penumbra && window.Penumbra.journalNotesOut ? window.Penumbra.journalNotesOut() : null;
    rec('V-off-out', out === false, 'journalNotesOut ' + out);
    rec('V-off-cell', window.Penumbra.journalExportCell(td) === null, 'a Notes cell exports null');
    var nth = document.querySelector('#tableHeader th.journal-notes-col'), dth = document.querySelector('#tableHeader th[data-column="0"]');
    rec('V-off-skipfn', !!JR.penumbraNotesColSkipped && JR.penumbraNotesColSkipped(nth) === true && JR.penumbraNotesColSkipped(td) === true && JR.penumbraNotesColSkipped(dth) === false,
        'the XLSX / PDF / SQL / HTML exports skip the Notes heading and cells (and nothing else)');
    var csv = JR.getExportData('csv').content;
    rec('V-off-csv', csv.split('\n')[0].indexOf('Notes') < 0 && csv.indexOf('First look') < 0, csv.split('\n')[0]);
    var html = JR.getExportData('html', { allPages: true }).content;
    rec('V-off-html', html.indexOf('First look') < 0 && html.indexOf('journal-notes-btn') < 0 && !/>\s*Notes\s*</.test(html), 'no notes in the HTML copy');
  };

  // ---- a Notes column made narrower than its preview (2026-10-14, user: "spills over") -------------
  // The rule penumbra_colwidths.js writes for a resized column (min = max = width, !important).
  S.resize = async function () {
    var hdr = document.getElementById('tableHeader');
    var idx = Array.prototype.indexOf.call(hdr.children, hdr.querySelector('th[data-column="__JOURNAL_NOTES"]')) + 1;
    function widthRule(w) {
      var st = document.getElementById('nc-colw') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'nc-colw' }));
      st.textContent = '#resultsTable > thead > tr > th:nth-child(' + idx + '),#resultsTable > tbody > tr > td:nth-child(' + idx + '):not([colspan])'
        + '{box-sizing:border-box!important;width:' + w + 'px!important;min-width:' + w + 'px!important;max-width:' + w + 'px!important}';
    }
    widthRule(90);
    await sleep(150);
    var td = notesTd(K3), pv = td.querySelector('.journal-notes-preview'), nxt = td.nextElementSibling;
    var tr = td.getBoundingClientRect(), pr = pv.getBoundingClientRect(), nr = nxt.getBoundingClientRect();
    var btn = td.querySelector('.journal-notes-btn').getBoundingClientRect();
    rec('W-clip', Math.round(tr.width) === 90 && btn.right <= tr.right + 0.5 && pr.right <= tr.right + 0.5 && tr.right <= nr.left + 0.5 && getComputedStyle(td).overflow === 'hidden',
        'cell ' + Math.round(tr.left) + '-' + Math.round(tr.right) + ', button right ' + Math.round(btn.right) + ', preview right ' + Math.round(pr.right) + ', next cell left ' + Math.round(nr.left));
    rec('W-ellipsis', pr.width > 0 && pv.scrollWidth > pv.clientWidth + 1 && getComputedStyle(pv).textOverflow === 'ellipsis',
        'preview ' + pv.clientWidth + ' of ' + pv.scrollWidth + ' px shown, cut with an ellipsis');
    var svg = td.querySelector('.journal-notes-btn svg').getBoundingClientRect(), cnt = td.querySelector('.journal-notes-count').getBoundingClientRect();
    rec('W-icon', svg.width >= 13.5 && cnt.width > 0 && cnt.right <= tr.right, 'icon ' + svg.width + ' px, count ' + cnt.width + ' px: never squeezed');
    widthRule(600);
    await sleep(150);
    tr = td.getBoundingClientRect(); pr = pv.getBoundingClientRect();
    rec('W-wide', pv.scrollWidth <= pv.clientWidth + 1 && pv.textContent === 'Follow up next week.' && pr.right <= tr.right,
        'a wide column shows the whole line: ' + pv.clientWidth + ' of ' + pv.scrollWidth);
  };

  // ---- the row height setting (2026-10-14, user: "it can wrap if the settings allow it") ------------
  // Consistent height (default): one line cut at the column edge; a hovered cut-off cell expands and
  // the note wraps (.cell-to-expand). Rows that grow (body.disable-auto-expand): every note wraps.
  S.wrap = async function () {
    var LONG = 'Asked the PI about the no-cost extension; the sponsor wants the revised budget and the progress report before the end of the month, so this stays open until both arrive.';
    window.__J.notes[K3][2].NOTE_TEXT = LONG;
    await new Promise(function (r) { window.Penumbra.loadJournalRowNotes(r); });
    await sleep(400);
    var td = notesTd(K3), pv = td.querySelector('.journal-notes-preview');
    var lh = function () { return parseFloat(getComputedStyle(pv).fontSize) * 1.3; };
    var inCell = function () { var a = td.getBoundingClientRect(), b = pv.getBoundingClientRect(); return b.right <= a.right + 0.5 && b.bottom <= a.bottom + 0.5; };
    rec('R-compact', pv.getBoundingClientRect().height < lh() * 1.4 && pv.scrollWidth > pv.clientWidth && inCell(),
        'one line (' + Math.round(pv.getBoundingClientRect().height) + ' px), cut (' + pv.clientWidth + ' of ' + pv.scrollWidth + ')');
    // hover, as a pointer does: jQuery's delegated mouseenter rides mouseover
    td.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    await until(function () { return td.classList.contains('cell-to-expand'); }, 1500);
    await sleep(50);
    var hh = pv.getBoundingClientRect().height;
    rec('R-hover', td.classList.contains('cell-to-expand') && hh > lh() * 1.6 && pv.scrollWidth <= pv.clientWidth + 1,
        'expanded ' + td.classList.contains('cell-to-expand') + ', ' + Math.round(hh) + ' px tall');
    td.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    await sleep(100);
    document.body.classList.add('disable-auto-expand');
    await sleep(150);
    window.__DBG = function () { var c = getComputedStyle(td), b = getComputedStyle(td.querySelector('.journal-notes-btn')), q = getComputedStyle(pv); return 'td w=' + c.width + ' min=' + c.minWidth + ' max=' + c.maxWidth + ' ws=' + c.whiteSpace + ' wb=' + c.wordBreak + ' | btn w=' + b.width + ' maxw=' + b.maxWidth + ' ws=' + b.whiteSpace + ' | pv w=' + q.width + ' maxw=' + q.maxWidth + ' ws=' + q.whiteSpace + ' disp=' + q.display + ' | has=' + td.matches(':has(.journal-notes-preview)') + ' table w=' + document.getElementById('resultsTable').getBoundingClientRect().width; };
    var gh = pv.getBoundingClientRect().height, tw = td.getBoundingClientRect().width;
    rec('R-grow', gh > lh() * 1.6 && pv.scrollWidth <= pv.clientWidth + 1 && tw > 150 && inCell(),
        'rows that grow: ' + Math.round(gh) + ' px tall, cell ' + Math.round(tw) + ' px wide (not squeezed to a word)' + (window.__DBG ? ' | ' + window.__DBG() : ''));
    var hdr = document.getElementById('tableHeader');
    var idx = Array.prototype.indexOf.call(hdr.children, hdr.querySelector('th[data-column="__JOURNAL_NOTES"]')) + 1;
    var st = document.head.appendChild(document.createElement('style'));
    st.textContent = '#resultsTable > thead > tr > th:nth-child(' + idx + '),#resultsTable > tbody > tr > td:nth-child(' + idx + '):not([colspan])'
      + '{box-sizing:border-box!important;width:120px!important;min-width:120px!important;max-width:120px!important}';
    await sleep(150);
    var nh = pv.getBoundingClientRect().height, nw = td.getBoundingClientRect().width;
    rec('R-grow-narrow', Math.round(nw) === 120 && nh > gh && inCell() && pv.scrollWidth <= pv.clientWidth + 1,
        'a 120 px column: ' + Math.round(nh) + ' px tall, inside the cell ' + inCell());
    st.remove();
    document.body.classList.remove('disable-auto-expand');
    await sleep(150);
    rec('R-back', pv.getBoundingClientRect().height < lh() * 1.4 && pv.scrollWidth > pv.clientWidth, 'back to one line');
  };

  // ---- round 7: the journal panel's Edit, the Up arrow, the placeholder tip ----------------------
  function panelEl() { return document.getElementById('journalLightbox'); }
  async function openPanel() {
    if (!window.PenumbraJournal || !window.PenumbraJournal.open) throw new Error('no PenumbraJournal');
    window.PenumbraJournal.open();
    await until(function () { return document.querySelectorAll('#journalNotesList .journal-note').length > 0; }, 4000);
    await sleep(200);
  }
  function placeholderOf(el) { return getComputedStyle(el, '::before').content || ''; }
  function upKey(el) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', keyCode: 38, bubbles: true, cancelable: true })); }
  S.panel = async function () {
    await openPanel();
    var eds = Array.prototype.map.call(document.querySelectorAll('#journalNotesList .journal-note-edit-btn'), function (b) { return b.closest('.journal-note').getAttribute('data-note-id'); }).sort();
    rec('P-buttons', JSON.stringify(eds) === JSON.stringify(['802', '902', '903']), 'Edit on every note of lee\'s (2026-10-29: not only the newest): ' + JSON.stringify(eds));
    var box = document.getElementById('journalNoteText');
    rec('P-hint', /\u2191 edits your last note/.test(placeholderOf(box)), placeholderOf(box));
    box.focus(); upKey(box); await sleep(150);
    var btn = document.getElementById('journalPostBtn');
    rec('P-up', box.innerText.replace(/\n+$/, '') === 'Budget review\nnext Monday' && btn.textContent === 'Save' && /Editing your note/.test(document.getElementById('journalReplyBanner').textContent),
        'Up in the empty box: ' + JSON.stringify(box.innerText) + ' / ' + btn.textContent);
    box.innerHTML = 'Budget review moved to Tuesday';
    var before = window.__J.posts.length;
    btn.click();
    await until(function () { return window.__J.posts.length > before; }, 3000);
    var p = lastPost();
    rec('P-save', !!p && p.action === 'edit' && String(p.note_id) === '802' && p.note_text === 'Budget review moved to Tuesday', JSON.stringify(p));
    await until(function () { return /moved to Tuesday/.test(document.getElementById('journalNotesList').textContent); }, 3000);
    await sleep(200);
    rec('P-after', btn.textContent === 'Post Note' && !$.trim(box.textContent) && !document.querySelector('#journalComposer.is-editing'),
        'button ' + btn.textContent + ', box ' + JSON.stringify(box.textContent));
    box.focus(); box.textContent = 'a draft'; box.classList.remove('is-empty'); upKey(box); await sleep(120);
    rec('P-up-typed', btn.textContent === 'Post Note' && box.textContent === 'a draft', 'Up in a box with text does nothing: ' + btn.textContent);
    box.textContent = ''; box.classList.add('is-empty');
    // the row note from the panel: the table's cell follows
    $(document.querySelector('#journalNotesList .journal-note[data-note-id="902"] .journal-note-edit-btn')).trigger('click');
    await sleep(120);
    rec('P-row', box.innerText.replace(/\n+$/, '') === 'Follow up\nnext week.' && btn.textContent === 'Save', JSON.stringify(box.innerText));
    box.innerHTML = 'Row note edited from the panel';
    before = window.__J.posts.length; btn.click();
    await until(function () { return window.__J.posts.length > before; }, 3000);
    await until(function () { var pv = notesTd(K3) && notesTd(K3).querySelector('.journal-notes-preview'); return pv && /edited from the panel/.test(pv.textContent); }, 4000);
    var pv = notesTd(K3).querySelector('.journal-notes-preview');
    rec('P-row-preview', /Row note edited from the panel/.test(pv.textContent), 'the table cell: ' + pv.textContent);
  };
  // An edit left open when the panel closes is dropped on the next open (final sweep 2026-10-14):
  // the banner went and the box stayed in edit mode - a "Save" that silently rewrote the note.
  S.panelreopen = async function () {
    await openPanel();
    var box = document.getElementById('journalNoteText');
    box.focus(); box.textContent = 'my draft'; box.classList.remove('is-empty');
    $(document.querySelector('#journalNotesList .journal-note[data-note-id="802"] .journal-note-edit-btn')).trigger('click');
    await sleep(120);
    var during = document.getElementById('journalPostBtn').textContent;
    $('#journalLightbox').hide();
    window.PenumbraJournal.open();
    await until(function () { return document.querySelectorAll('#journalNotesList .journal-note').length > 0; }, 4000);
    await sleep(200);
    var btn = document.getElementById('journalPostBtn').textContent, banner = document.getElementById('journalReplyBanner');
    rec('P-reopen', during === 'Save' && btn === 'Post Note' && box.textContent === 'my draft' && !document.querySelector('#journalComposer.is-editing')
        && (banner.style.display === 'none' || !/Editing/.test(banner.textContent)),
        'during the edit ' + during + '; reopened: ' + btn + ', box ' + JSON.stringify(box.textContent));
  };
  S.panelnone = async function () {
    await openPanel();
    var box = document.getElementById('journalNoteText');
    var hint0 = /\u2191/.test(placeholderOf(box));   // (the hint shows in the EMPTY box: read before Up fills it)
    box.focus(); upKey(box); await sleep(120);
    // (2026-10-29) pat's notes are no conversation's newest, and still pat's to edit: Edit on both, the tip, Up takes pat's newest (901)
    var pe = Array.prototype.map.call(document.querySelectorAll('#journalNotesList .journal-note-edit-btn'), function (b) { return b.closest('.journal-note').getAttribute('data-note-id'); }).sort();
    rec('P-own', JSON.stringify(pe) === JSON.stringify(['801', '901']) && hint0 && document.getElementById('journalPostBtn').textContent === 'Save'
        && box.textContent === 'First look done.', 'pat\'s own notes: Edit on ' + JSON.stringify(pe) + ', Up: ' + document.getElementById('journalPostBtn').textContent + ' ' + JSON.stringify(box.textContent));
  };
  S.cardup = async function () {
    var c = await openCard(K3);
    var inp = c.querySelector('.journal-rownote-input');
    rec('U-hint', /\u2191 edits your last note/.test(placeholderOf(inp)), placeholderOf(inp));
    inp.focus(); upKey(inp); await sleep(150);
    rec('U-up', composerText(c) === 'Follow up\nnext week.' && postBtn(c).textContent === 'Save', 'Up in the empty card box: ' + JSON.stringify(composerText(c)));
    $(c.querySelector('.journal-rownote-edit-cancel')).trigger('click'); await sleep(80);
    inp.textContent = 'typing'; inp.classList.remove('is-empty'); upKey(inp); await sleep(120);
    rec('U-typed', postBtn(c).textContent === 'Post' && inp.textContent === 'typing', 'Up with text: ' + postBtn(c).textContent);
  };

  // ---- round 4 (2026-10-14 bug sweep) -----------------------------------------------------------
  // The real XLSX builder (ExcelJS) with notes on: a Notes column holding the flattened notes.
  S.xlsx = async function () {
    var wb = await JR.createXlsxWorkbook(false);
    var ws = wb && wb.getWorksheet('Report Data');
    var head = [], col = -1, hit = null;
    if (ws) {
      ws.getRow(1).eachCell(function (c, i) { head.push(String(c.value)); if (String(c.value) === 'Notes') col = i; });
      ws.eachRow(function (row, r) { if (r > 1 && col > 0 && row.getCell(col).value === FLAT3) hit = r; });
    }
    rec('K-xlsx-on', col > 0 && hit !== null, 'header ' + head.join(' | ') + ' | the notes in row ' + hit);
  };
  // Ctrl+C on a selected Notes cell: the notes (switch on), else the newest note it shows - never "3" + the note.
  S.cellcopy = async function () {
    var cs = window.Penumbra.cellSel;
    var v = cs && cs._cellText ? cs._cellText(notesTd(K3)) : null;
    rec('K-cell-off', v === 'Follow up next week.', JSON.stringify(v));
  };
  S.cellcopyon = async function () {
    var cs = window.Penumbra.cellSel;
    var v = cs && cs._cellText ? cs._cellText(notesTd(K3)) : null;
    rec('K-cell-on', v === FLAT3, JSON.stringify(v));
  };
  // A theme's button hover recolours the button: the preview follows (it stayed dark on Wolfpack Red's red).
  S.hovercol = async function () {
    var st = document.head.appendChild(document.createElement('style'));
    st.textContent = '#resultsTable button.journal-notes-btn.is-open:not(:disabled){background:#b30000!important;color:rgb(234, 234, 234)!important}';
    var b = notesTd(K3).querySelector('.journal-notes-btn'); b.classList.add('is-open');
    await sleep(50);
    var pc = getComputedStyle(b.querySelector('.journal-notes-preview')).color, bc = getComputedStyle(b).color;
    rec('K-hover', pc === bc && bc === 'rgb(234, 234, 234)', 'preview ' + pc + ' / button ' + bc);
  };

  // ---- search reads the notes (round 3, 2026-10-14: "search by even the last note has no effect") -------
  // K3's notes: "First look done." (Pat), "Agreed." (Lee, a reply), "Follow up\nnext week." (Lee);
  // K7's: a file only. No data cell of the fixture holds "agreed", "follow" or "look done".
  async function search(q) {
    $('#tableSearch').val(q);
    await JR.runTableSearch();
    await sleep(150);
    var keys = [];
    document.querySelectorAll('#resultsTable > tbody > tr:not(.search-hidden)').forEach(function (tr) {
      var b = tr.querySelector('td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
      if (b && tr.style.display !== 'none') keys.push(b.getAttribute('data-row-key'));
    });
    return keys;
  }
  S.search = async function () {
    var all = (await search('')).length;
    var r = await search('agreed');
    rec('S-word', r.length === 1 && r[0] === K3, 'a word from a reply: ' + r.length + ' row(s)');
    r = await search('!= agreed');
    rec('S-word-not', r.length === all - 1 && r.indexOf(K3) < 0, '"!= agreed": ' + r.length + ' of ' + all);
    r = await search('Notes = follow');
    rec('S-col-text', r.length === 1 && r[0] === K3, '"Notes = follow" (the newest note): ' + r.length);
    r = await search('Notes != follow');
    rec('S-col-not', r.length === all - 1 && r.indexOf(K3) < 0, '"Notes != follow": ' + r.length + ' of ' + all);
    r = await search('Notes = /scan\\.pdf/');
    rec('S-col-regex', r.length === 1 && r[0] === K7, 'a regex finds the file-only note: ' + r.length);
    r = await search('Notes > 0');
    rec('S-col-count', r.length === 2 && r.indexOf(K3) >= 0 && r.indexOf(K7) >= 0, '"Notes > 0" still counts: ' + r.length);
    r = await search('Notes = empty');
    rec('S-col-empty', r.length === all - 2, '"Notes = empty": ' + r.length + ' of ' + all);
    // a column the viewer hides is not searched (as a hidden data column is not)
    document.querySelectorAll('#tableHeader > th[data-column="__JOURNAL_NOTES"], #resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"]').forEach(function (c) { c.style.display = 'none'; });
    r = await search('agreed');
    rec('S-hidden', r.length === 0, 'Notes hidden: "agreed" finds ' + r.length);
  };
  async function copyOptions() {
    clickEl(document.getElementById('copyActionsBtn'));
    await sleep(200);
    return Array.prototype.map.call(document.querySelectorAll('#copyColumnSelector option'), function (o) { return o.value; });
  }
  S.copycol = async function () {
    var o = await copyOptions();
    rec('C-off', o.length > 3 && o.indexOf('Notes') < 0 && o.indexOf('Reviewed') >= 0, 'switch off: ' + o.join(' | '));
  };
  S.copycolon = async function () {
    var o = await copyOptions();
    rec('C-on', o.indexOf('Notes') >= 0, 'switch on: ' + o.join(' | '));
  };

  // ---- the report includes notes: copies, downloads, emails ---------------------------------
  S.exportcsv = async function () {
    var out = window.Penumbra.journalNotesOut();
    rec('X-out', out === true, 'journalNotesOut ' + out);
    var nth = document.querySelector('#tableHeader th.journal-notes-col'), dth = document.querySelector('#tableHeader th[data-column="0"]');
    rec('X-skipfn', !!JR.penumbraNotesColSkipped && JR.penumbraNotesColSkipped(nth) === false && JR.penumbraNotesColSkipped(notesTd(K3)) === false && JR.penumbraNotesColSkipped(dth) === false,
        'the XLSX / PDF / SQL / HTML exports keep the Notes column');
    rec('X-cell', window.Penumbra.journalExportCell(notesTd(K3)) === FLAT3 && window.Penumbra.journalExportCell(notesTd(K7)) === FLAT7
        && window.Penumbra.journalExportCell(anyEmptyNotesTd()) === '', JSON.stringify(window.Penumbra.journalExportCell(notesTd(K3))));
    var csv = JR.getExportData('csv').content;
    var head = csv.split('\n')[0];
    rec('X-csv-head', /(^|[,;\t])"?Notes"?([,;\t]|$)/.test(head), head);
    rec('X-csv-cell', csv.indexOf('"' + FLAT3 + '"') >= 0 && csv.indexOf(FLAT7) >= 0, 'the notes, quoted (they hold line breaks)');
    var js = JR.getExportData('json').content, rowsJ = null;
    try { rowsJ = JSON.parse(js); } catch (e) { }
    var hitJ = rowsJ && [].concat(rowsJ).some(function (r) { return r && r.Notes === FLAT3; });
    rec('X-json', !!hitJ, 'a JSON row with Notes = the flattened notes');
    var html = JR.getExportData('html', { allPages: true }).content;
    var box = document.createElement('div'); box.innerHTML = html;
    var t = box.querySelector('table');
    var ths = t ? Array.prototype.map.call(t.querySelectorAll('thead th'), function (h) { return h.textContent.trim(); }) : [];
    var ni = ths.indexOf('Notes');
    var bodyRows = t ? Array.prototype.slice.call(t.querySelectorAll('tbody tr')) : [];
    var aligned = bodyRows.length > 0 && bodyRows.every(function (tr) { return tr.children.length === ths.length; });
    var cellHtml = null;
    bodyRows.forEach(function (tr) { var c = tr.children[ni]; if (c && /First look done/.test(c.textContent)) cellHtml = c.innerHTML; });
    rec('X-html', ni >= 0 && aligned && cellHtml === FLAT3.replace(/&/g, '&amp;').replace(/\n/g, '<br>'),
        'Notes at ' + ni + ' of ' + ths.length + ', rows aligned ' + aligned + ', cell ' + JSON.stringify(cellHtml));
    rec('X-html-nobtn', html.indexOf('journal-notes-btn') < 0 && html.indexOf('journal-notes-preview') < 0, 'no button markup in the copy');
    // parity with the server's journalNotesFlatten() (run.py wrote its output on the same fixture)
    var par = null;
    try { par = await (await fetch('parity.json', { cache: 'no-store' })).json(); } catch (e) { }
    var mine = par ? window.Penumbra.journalNotesFlatten(par.notes) : null;
    rec('X-parity', !!par && par.flat.length > 50 && mine === par.flat, par ? JSON.stringify(mine) + ' vs ' + JSON.stringify(par.flat) : 'no parity.json');
  };

  // ---- the switch: saved with the report only when on, and only with row notes ---------------
  S.setup = async function () {
    var sw = document.getElementById('journalNotesExportEnable');
    if (!sw) throw new Error('no #journalNotesExportEnable');
    var vo0 = (JR.buildStateObject().viewOptions || {});
    rec('T-default', !('journalNotesExport' in vo0), 'not saved while off: ' + JSON.stringify(vo0.journalNotesExport));
    sw.checked = true; $(sw).trigger('change');
    var vo1 = (JR.buildStateObject().viewOptions || {});
    var st = (document.getElementById('journalToggleStatus') || {}).textContent || '';
    rec('T-on', window._penumbraJournalNotesExport === true && vo1.journalNotesExport === true && /Notes are included/.test(st) && window.Penumbra.journalNotesOut() === true,
        'flag ' + window._penumbraJournalNotesExport + ', saved ' + vo1.journalNotesExport + ', status "' + st + '"');
    await sleep(50);
    var csv = JR.getExportData('csv').content;
    rec('T-on-live', csv.split('\n')[0].indexOf('Notes') >= 0, 'a download right away carries it');
    var rn = document.getElementById('journalRowNotesEnable');
    rn.checked = false; $(rn).trigger('change');
    await sleep(200);
    var vo2 = (JR.buildStateObject().viewOptions || {});
    rec('T-rownotes-off', sw.disabled && sw.checked && !('journalNotesExport' in vo2) && !vo2.journalRowNotes && window.Penumbra.journalNotesOut() === false,
        'disabled ' + sw.disabled + ' (keeps ' + sw.checked + '), saved ' + JSON.stringify(vo2.journalNotesExport));
    rn.checked = true; $(rn).trigger('change');
    await sleep(200);
    rec('T-rownotes-back', !sw.disabled && sw.checked && (JR.buildStateObject().viewOptions || {}).journalNotesExport === true, 'back with row notes');
    sw.checked = false; $(sw).trigger('change');
    rec('T-off', window._penumbraJournalNotesExport === false && !('journalNotesExport' in (JR.buildStateObject().viewOptions || {})), 'off again: not saved');
  };
  S.restore = async function () {
    var sw = document.getElementById('journalNotesExportEnable');
    rec('T-restore', !!sw && sw.checked && !sw.disabled && window._penumbraJournalNotesExport === true, sw ? 'checked ' + sw.checked : 'missing');
  };

  // ---- edit your own newest note -----------------------------------------------------------
  S.edit = async function () {
    var c = await openCard(K3);
    var eb = c.querySelectorAll('.journal-rownote-edit-btn');
    var owners = Array.prototype.map.call(eb, function (b) { return b.closest('.journal-rownote-item').getAttribute('data-note-id'); }).sort();
    rec('D-button', JSON.stringify(owners) === JSON.stringify(['902', '903']), 'Edit buttons on ' + JSON.stringify(owners) + ' (2026-10-29: every note of lee\'s, the older 903 too)');
    var e902 = c.querySelector('.journal-rownote-item[data-note-id="902"] .journal-rownote-edit-btn');
    if (!e902) return;
    clickEl(e902);
    await sleep(100);
    var banner = c.querySelector('.journal-rownote-reply-banner');
    rec('D-mode', composerText(c) === 'Follow up\nnext week.' && postBtn(c).textContent === 'Save' && /Editing your note/.test(banner.textContent)
        && banner.style.display !== 'none' && c.querySelector('.journal-attach-btn').style.display === 'none',
        'composer ' + JSON.stringify(composerText(c)) + ', button ' + postBtn(c).textContent + ', banner ' + banner.textContent);
    var inp = c.querySelector('.journal-rownote-input');
    inp.innerHTML = 'Follow up Monday @pat';
    var before = window.__J.posts.length;
    clickEl(postBtn(c));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    var p = lastPost();
    rec('D-post', !!p && p.action === 'edit' && String(p.note_id) === '902' && p.note_text === 'Follow up Monday @pat'
        && JSON.stringify(p.mentions) === JSON.stringify([{ user: 'pat', name: '' }]), JSON.stringify(p));
    await until(function () { return /Follow up Monday/.test(c.querySelector('.journal-rownote-list').textContent); }, 3000);
    await sleep(400);
    rec('D-after', postBtn(c).textContent === 'Post' && (composerText(c) || '') === '' && /Note updated/.test(c.querySelector('.journal-rownote-status').textContent)
        && !c.querySelector('.journal-rownote-panel.is-editing'), 'button ' + postBtn(c).textContent + ', composer ' + JSON.stringify(composerText(c))
        + ', status "' + c.querySelector('.journal-rownote-status').textContent + '"');
    var pv = notesTd(K3) ? notesTd(K3).querySelector('.journal-notes-preview') : null;
    rec('D-preview', !!pv && pv.textContent === 'Follow up Monday @pat', 'the cell now reads ' + (pv && pv.textContent));
    rec('D-count', window.__J.posts.filter(function (x) { return x.action === 'add'; }).length === 0 && notesTd(K3).querySelector('.journal-notes-count').textContent === '3', 'no new note was added');
  };
  S.editnone = async function () {
    var c = await openCard(K3);
    var po = Array.prototype.map.call(c.querySelectorAll('.journal-rownote-edit-btn'), function (b) { return b.closest('.journal-rownote-item').getAttribute('data-note-id'); });
    rec('D-own', JSON.stringify(po) === JSON.stringify(['901']) && c.querySelectorAll('.journal-rownote-reply-btn').length === 3,
        'pat\'s note is not the newest and still pat\'s to edit (2026-10-29): Edit on ' + JSON.stringify(po) + ', Reply buttons ' + c.querySelectorAll('.journal-rownote-reply-btn').length);
  };
  S.edit409 = async function () {
    window.__J.editFail = true;
    var c = await openCard(K3);
    var eb = c.querySelector('.journal-rownote-edit-btn');
    if (!eb) throw new Error('no Edit button');
    clickEl(eb); await sleep(100);
    c.querySelector('.journal-rownote-input').innerHTML = 'Too late';
    var before = window.__J.posts.length;
    clickEl(postBtn(c));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    await sleep(300);
    rec('D-409', postBtn(c).textContent === 'Post' && composerText(c) === 'Too late' && /only the newest note/.test(c.querySelector('.journal-rownote-status').textContent)
        && c.querySelector('.journal-rownote-status').getAttribute('data-kind') === 'error' && !c.querySelector('.journal-rownote-panel.is-editing'),
        'button ' + postBtn(c).textContent + ', composer ' + JSON.stringify(composerText(c)) + ', status "' + c.querySelector('.journal-rownote-status').textContent + '"');
  };
  S.editcancel = async function () {
    var c = await openCard(K3);
    var inp = c.querySelector('.journal-rownote-input');
    inp.innerHTML = 'my draft';
    var rb = c.querySelectorAll('.journal-rownote-reply-btn')[0];
    clickEl(rb); await sleep(50);
    clickEl(c.querySelector('.journal-rownote-item[data-note-id="902"] .journal-rownote-edit-btn')); await sleep(100);   // (2026-10-29: 903 is lee's too)
    var mid = composerText(c);
    clickEl(c.querySelector('.journal-rownote-edit-cancel')); await sleep(100);
    var banner = c.querySelector('.journal-rownote-reply-banner');
    rec('D-cancel', mid === 'Follow up\nnext week.' && composerText(c) === 'my draft' && postBtn(c).textContent === 'Post'
        && /Replying to/.test(banner.textContent) && window.__J.posts.length === 0,
        'during ' + JSON.stringify(mid) + ', after ' + JSON.stringify(composerText(c)) + ', banner "' + banner.textContent + '", posts ' + window.__J.posts.length);
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
