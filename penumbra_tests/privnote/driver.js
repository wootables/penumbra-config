// privnote suite - browser half (2026-11-13, PRIVATE_NOTES_SPEC.md section 6). Runs ONE scenario (?scn=)
// against whichever main.js the page loaded and publishes
//   window.__JRRESULT = { scn, asserts: [{id, ok, detail}], errors: [...] } + window.__JRDONE = true.
// The viewer is lee (?me=lee). ?pv=1: K3 holds pat's public root 901 (lee replied 903), lee's public root 905,
// lee's PRIVATE root 902 mentioning pat, and pat's reply 904 in it - oldest first.
//
// GROUND TRUTH: the fake journal server (window.__J) and the strings below, written out by hand from the
// fixture - never computed by the code under test.
(function () {
  var JR = window.__JR || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JR_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function change(el) { el.dispatchEvent(new Event('change', { bubbles: true })); }

  var K3 = window.__NOTED;
  var FLATPV = '2026-10-01 Pat Doe: First look done.\n  ↳ 2026-10-01 Lee Roe: Agreed.\n2026-10-01 Lee Roe: Lee public note.';

  function notesTd(rk) {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i].parentNode;
    return null;
  }
  function card() { return document.querySelector('.journal-pvnote-card'); }
  async function openCard(rk, needItems) {
    var td = notesTd(rk);
    if (!td) throw new Error('no notes cell for ' + rk);
    clickEl(td.querySelector('.journal-notes-btn'));
    await until(function () { var c = card(); return c && c.getAttribute('data-pvn-key') === rk && (!needItems || c.querySelector('.journal-rownote-item')); }, 3000);
    await sleep(120);
    return card();
  }
  function item(id) { var c = card(); return c ? c.querySelector('.journal-rownote-item[data-note-id="' + id + '"]') : null; }
  function postBtn(c) { return c.querySelector('.journal-rownote-post'); }
  function lastPost() { var p = window.__J.posts; return p.length ? p[p.length - 1] : null; }
  function shown(el) { return !!el && el.style.display !== 'none' && !el.hidden; }
  async function post(c) {
    var before = window.__J.posts.length;
    clickEl(postBtn(c));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    await sleep(300);
    return lastPost();
  }
  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }
  async function openPanel() {
    if (!window.PenumbraJournal || !window.PenumbraJournal.open) throw new Error('no PenumbraJournal');
    window.PenumbraJournal.open();
    await until(function () { return document.querySelectorAll('#journalNotesList .journal-note').length > 0; }, 4000);
    await sleep(250);
  }
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

  var S = {};
  // ---- the note card: what a private thread looks like, and writing one ------------------------------------
  S.card = async function () {
    var c = await openCard(K3, true);
    var box = c.querySelector('.journal-rownote-private');
    rec('PV-box', !!box && !box.checked && shown(box.closest('.journal-private-toggle')), box ? 'unticked, shown' : 'missing');
    var locked = Array.prototype.map.call(c.querySelectorAll('.journal-rownote-item.is-private'), function (e) { return e.getAttribute('data-note-id'); }).sort();
    rec('PV-lock', JSON.stringify(locked) === '["902","904"]' && !!item('902').querySelector('.journal-rownote-author .journal-priv-lock')
        && !item('901').querySelector('.journal-priv-lock') && !item('905').querySelector('.journal-rownote-author .journal-priv-lock'), JSON.stringify(locked));
    var aud = item('902').querySelector('.journal-rownote-aud');
    rec('PV-aud', !!aud && aud.textContent === 'Private: you, Pat Doe' && !item('904').querySelector('.journal-rownote-aud') && !item('905').querySelector('.journal-rownote-aud'),
        aud ? JSON.stringify(aud.textContent) : 'none');
    var flips = []; c.querySelectorAll('.journal-rownote-priv-btn').forEach(function (b) { flips.push(b.closest('.journal-rownote-item').getAttribute('data-note-id') + '=' + b.getAttribute('data-priv')); });
    flips.sort();
    rec('PV-flipbtn', JSON.stringify(flips) === '["902=0","905=1"]' && /Make your note visible to everyone/.test(item('902').querySelector('.journal-rownote-priv-btn').getAttribute('aria-label')),
        'the thread\'s author flips it (roots of lee\'s only): ' + JSON.stringify(flips));
    var line = c.querySelector('.journal-rownote-privline');
    rec('PV-line-off', !!line && line.hidden, line ? 'hidden ' + line.hidden + ' "' + line.textContent + '"' : 'missing');
    box.checked = true; change(box); await sleep(60);
    rec('PV-line-me', !line.hidden && line.textContent === 'Only you will see this.', JSON.stringify(line.textContent));
    var inp = c.querySelector('.journal-rownote-input');
    inp.textContent = '@pat budget figures'; inp.classList.remove('is-empty');
    change(box); await sleep(60);
    rec('PV-line-mention', line.textContent === 'Only you and @pat will see this.', JSON.stringify(line.textContent));
    var p = await post(c);
    rec('PV-post', !!p && p.action === 'add' && p['private'] === 1 && !p.parent_id && p.note_text === '@pat budget figures', JSON.stringify(p));
    var box2 = card().querySelector('.journal-rownote-private'), line2 = card().querySelector('.journal-rownote-privline');
    // (privbox) the box remembers its last setting on the report: the next note starts private too
    rec('PV-post-keep', !!box2 && box2.checked && !line2.hidden && line2.textContent === 'Only you will see this.',
        'the next note starts as the box was left: ticked ' + (box2 && box2.checked) + ', line ' + JSON.stringify(line2 && line2.textContent));
    clickEl(item('904').querySelector('.journal-rownote-reply-btn')); await sleep(120);
    c = card();
    var tg = c.querySelector('.journal-private-toggle'), ln = c.querySelector('.journal-rownote-privline');
    rec('PV-reply', !!tg && !shown(tg) && !ln.hidden && ln.textContent === 'Replying in a private thread: you, Pat Doe.', 'box shown ' + shown(tg) + ', line ' + JSON.stringify(ln.textContent));
    c.querySelector('.journal-rownote-input').textContent = 'a quiet reply';
    p = await post(c);
    rec('PV-reply-post', !!p && p.action === 'add' && String(p.parent_id) === '902' && !('private' in p), JSON.stringify(p));
    c = card(); tg = c.querySelector('.journal-private-toggle'); ln = c.querySelector('.journal-rownote-privline');
    rec('PV-reply-after', shown(tg) && tg.querySelector('input').checked && !ln.hidden && ln.textContent === 'Only you will see this.',
        'reply mode over: the box back, still ticked (privbox) ' + shown(tg) + ' / ' + tg.querySelector('input').checked + ', line ' + JSON.stringify(ln.textContent));
    clickEl(item('902').querySelector('.journal-rownote-edit-btn')); await sleep(120);
    c = card(); tg = c.querySelector('.journal-private-toggle'); ln = c.querySelector('.journal-rownote-privline');
    rec('PV-edit', !shown(tg) && ln.hidden && postBtn(c).textContent === 'Save', 'an edit keeps the note\'s privacy: box shown ' + shown(tg) + ', line hidden ' + ln.hidden);
  };

  // ---- the author's flip both ways (D2), the questions (D6) ---------------------------------------------------
  S.flip = async function () {
    await openCard(K3, true);
    var n0 = window.__confirms.length, before = window.__J.posts.length;
    clickEl(item('905').querySelector('.journal-rownote-priv-btn'));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    var q = window.__confirms[n0] || '', p = lastPost();
    rec('PV-flip-ask', q === 'Only you will see it from now on. Emails already sent can\'t be recalled, and anyone with the report open may still see it until their page next checks for notes.', JSON.stringify(q));
    rec('PV-flip-post', !!p && p.action === 'set_private' && String(p.note_id) === '905' && p['private'] === 1, JSON.stringify(p));
    await until(function () { var x = item('905'); return x && x.classList.contains('is-private'); }, 3000);
    await sleep(150);
    var it = item('905'), st = card().querySelector('.journal-rownote-status');
    rec('PV-flip-after', !!it && it.classList.contains('is-private') && !!it.querySelector('.journal-rownote-priv-btn[data-priv="0"]')
        && st.textContent === 'Made private: only you can see this thread now.' && document.activeElement === it.querySelector('.journal-rownote-priv-btn'),
        'lock ' + (it && it.classList.contains('is-private')) + ', status ' + JSON.stringify(st.textContent) + ', focus on its button ' + (it && document.activeElement === it.querySelector('.journal-rownote-priv-btn')));
    n0 = window.__confirms.length; before = window.__J.posts.length;
    clickEl(item('902').querySelector('.journal-rownote-priv-btn'));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    q = window.__confirms[n0] || ''; p = lastPost();
    rec('PV-unflip-ask', q === 'Make this thread visible to everyone who can open the report? This also shows 1 reply by Pat Doe, written while the thread was private.', JSON.stringify(q));
    rec('PV-unflip-post', !!p && p.action === 'set_private' && String(p.note_id) === '902' && p['private'] === 0, JSON.stringify(p));
    await until(function () { var x = item('902'); return x && !x.classList.contains('is-private'); }, 3000);
    await sleep(150);
    rec('PV-unflip-after', !item('902').classList.contains('is-private') && !item('904').classList.contains('is-private') && !item('902').querySelector('.journal-rownote-aud')
        && card().querySelector('.journal-rownote-status').textContent === 'Made visible to everyone who can open the report.', 'the thread is public: no lock, no audience line');
  };

  // ---- what leaves the page --------------------------------------------------------------------------------
  S.output = async function () {
    var t = window.Penumbra.journalRowNotesText(K3);
    rec('PV-out-text', t === FLATPV, JSON.stringify(t));
    var td = notesTd(K3);
    rec('PV-out-cell', window.Penumbra.journalExportCell(td) === FLATPV, 'copies, downloads and emails read the same text');
    rec('PV-newest', window.Penumbra.journalRowNewestOutputNote(K3) === 'Lee public note.', JSON.stringify(window.Penumbra.journalRowNewestOutputNote(K3)));
    var pv = td.querySelector('.journal-notes-preview');
    rec('PV-preview-own', !!pv && pv.textContent === 'Got it, quietly.', 'the cell previews the newest note its viewer may see: ' + (pv && pv.textContent));
    var btn = td.querySelector('.journal-notes-btn');
    rec('PV-tip', /^5 notes \(2 private\) on this row - click to view\. Newest: Got it, quietly\.$/.test(btn.getAttribute('aria-label') || ''), btn.getAttribute('aria-label'));
  };
  S.cellcopy = async function () {
    var cs = window.Penumbra.cellSel;
    var v = cs && cs._cellText ? cs._cellText(notesTd(K3)) : null;
    rec('PV-cell-copy', v === 'Lee public note.', 'a copied cell (notes kept out of copies): the newest note that may leave: ' + JSON.stringify(v));
  };
  S.search = async function () {
    var r = await search('quietly');
    rec('PV-search', r.length === 1 && r[0] === K3, 'the page\'s own search finds a private note its viewer holds: ' + JSON.stringify(r));
  };

  // ---- a Shared-note report ------------------------------------------------------------------------------
  S.shared = async function () {
    var n = window.Penumbra.journalSharedNoteOf(K3);
    rec('PV-shared-of', !!n && String(n.ID) === '905', 'the row\'s note is its newest PUBLIC root: ' + (n && n.ID));
    var c = await openCard(K3, false);
    rec('PV-shared-nobox', !!c && !c.querySelector('.journal-rownote-private'), 'no Private box on a row\'s Shared note');
  };

  // ---- the Journal panel ---------------------------------------------------------------------------------
  S.panel = async function () {
    await openPanel();
    var tg = document.getElementById('journalPrivateToggle'), box = document.getElementById('journalPrivateBox');
    rec('PV-panel-box', !!tg && !!box && !box.checked && shown(tg), tg ? 'there' : 'missing');
    var locked = Array.prototype.map.call(document.querySelectorAll('#journalNotesList .journal-note.is-private'), function (e) { return e.getAttribute('data-note-id'); }).sort();
    rec('PV-panel-lock', JSON.stringify(locked) === '["902","904"]', JSON.stringify(locked));
    var aud = document.querySelector('#journalNotesList .journal-note[data-note-id="902"] .journal-note-aud');
    rec('PV-panel-aud', !!aud && aud.textContent === 'Private: you, Pat Doe', aud ? JSON.stringify(aud.textContent) : 'none');
    var flips = []; document.querySelectorAll('#journalNotesList .journal-note-priv-btn').forEach(function (b) { flips.push(b.closest('.journal-note').getAttribute('data-note-id') + '=' + b.getAttribute('data-priv')); });
    flips.sort();
    rec('PV-panel-flips', JSON.stringify(flips) === '["802=1","902=0","905=1"]', JSON.stringify(flips));
    box.checked = true; change(box); await sleep(60);
    var line = document.getElementById('journalPrivLine');
    rec('PV-panel-line', !!line && !line.hidden && line.textContent === 'Only you will see this.', line ? JSON.stringify(line.textContent) : 'missing');
    document.getElementById('journalNoteText').textContent = 'a private report note';
    document.getElementById('journalNoteText').classList.remove('is-empty');
    var before = window.__J.posts.length;
    clickEl(document.getElementById('journalPostBtn'));
    await until(function () { return window.__J.posts.length > before; }, 3000);
    var p = lastPost();
    rec('PV-panel-post', !!p && p.action === 'add' && p['private'] === 1 && !p.parent_id, JSON.stringify(p));
    await sleep(400);
    var box3 = document.getElementById('journalPrivateBox'), line3 = document.getElementById('journalPrivLine');
    rec('PV-panel-keep', !!box3 && box3.checked && !!line3 && !line3.hidden && line3.textContent === 'Only you will see this.',
        'the next note starts as the box was left (privbox): ticked ' + (box3 && box3.checked) + ', line ' + JSON.stringify(line3 && line3.textContent));
  };

  // ---- (privbox, 2026-11-13) the box remembers its last setting per report, in this browser --------------------
  // The harness clears the stored setting as each scenario page loads; K3's card and the Journal panel share it.
  S.sticky = async function () {
    var KEY = 'penumbra_journal_private';
    var stored = function () { try { return localStorage.getItem(KEY); } catch (e) { return 'ERR'; } };
    async function closeCard() { var c = card(); if (c) clickEl(c.querySelector('.journal-rownote-close')); await until(function () { return !card(); }, 2000); await sleep(100); }
    var c = await openCard(K3, true);
    var box = c.querySelector('.journal-rownote-private');
    rec('PV-sticky-off', !!box && !box.checked && stored() === null, 'never ticked on this report: unticked, nothing stored (' + stored() + ')');
    box.checked = true; change(box); await sleep(60);
    rec('PV-sticky-store', stored() === '{"jrfix":1}', 'a tick is remembered for this report: ' + stored());
    await closeCard();
    c = await openCard(K3, true);
    box = c.querySelector('.journal-rownote-private');
    var line = c.querySelector('.journal-rownote-privline');
    rec('PV-sticky-open', !!box && box.checked && !line.hidden && line.textContent === 'Only you will see this.',
        'the card opened again: ticked ' + (box && box.checked) + ', line ' + JSON.stringify(line && line.textContent) + ' hidden ' + (line && line.hidden));
    await closeCard();
    await openPanel();
    var pbox = document.getElementById('journalPrivateBox'), pline = document.getElementById('journalPrivLine');
    rec('PV-sticky-panel', !!pbox && pbox.checked && !!pline && !pline.hidden && pline.textContent === 'Only you will see this.',
        'the Journal panel shares it: ticked ' + (pbox && pbox.checked) + ', line ' + JSON.stringify(pline && pline.textContent));
    pbox.checked = false; change(pbox); await sleep(60);
    rec('PV-sticky-clear', stored() === null && pline.hidden, 'unticked in the panel: nothing stored (' + stored() + '), line hidden ' + pline.hidden);
    clickEl(document.querySelector('#journalLightbox .close-lightbox'));
    await until(function () { return !$('#journalLightbox').is(':visible'); }, 2000); await sleep(150);
    c = await openCard(K3, true);
    box = c.querySelector('.journal-rownote-private');
    rec('PV-sticky-off-again', !!box && !box.checked, 'unticked in the panel: the card starts public (' + (box && box.checked) + ')');
    await closeCard();
    localStorage.setItem(KEY, '{"another-report":1}');
    c = await openCard(K3, true);
    box = c.querySelector('.journal-rownote-private');
    rec('PV-sticky-other', !!box && !box.checked, 'another report left ticked: this one starts public (' + (box && box.checked) + ')');
    await closeCard();
    localStorage.setItem(KEY, '{"jrfix":1}');
    var getI = Storage.prototype.getItem, setI = Storage.prototype.setItem, errs = window.__errors.length;
    Storage.prototype.getItem = function () { throw new Error('storage refused'); };
    Storage.prototype.setItem = function () { throw new Error('storage refused'); };
    try {
      c = await openCard(K3, true);
      box = c.querySelector('.journal-rownote-private');
      var atOpen = !!box && !box.checked;
      box.checked = true; change(box); await sleep(60);
      line = c.querySelector('.journal-rownote-privline');
      rec('PV-sticky-nostorage', atOpen && box.checked && line.textContent === 'Only you will see this.' && window.__errors.length === errs,
          'storage refused: unticked at open ' + atOpen + ', a tick still works ' + JSON.stringify(line.textContent) + ', page errors ' + (window.__errors.length - errs));
    } finally { Storage.prototype.getItem = getI; Storage.prototype.setItem = setI; }
  };

  // ---- no flag in the table yet; the delete question --------------------------------------------------------
  S.noready = async function () {
    var c = await openCard(K3, true);
    rec('PV-noready', !c.querySelector('.journal-rownote-private') && !c.querySelector('.journal-rownote-priv-btn'), 'no box, no flip until the column exists');
  };
  S['delete'] = async function () {
    await openCard(K3, true);
    var n0 = window.__confirms.length;
    clickEl(item('902').querySelector('.journal-rownote-del'));
    await sleep(200);
    var q = window.__confirms[n0] || '';
    rec('PV-del-private', q === 'Delete this note and its 1 reply (written by someone else)? The whole thread is deleted. It is private, so no copy of its text is kept in the audit log.', JSON.stringify(q));
    await until(function () { return !!item('905'); }, 3000);
    n0 = window.__confirms.length;
    clickEl(item('905').querySelector('.journal-rownote-del'));
    await sleep(200);
    q = window.__confirms[n0] || '';
    rec('PV-del-public', q === 'Delete this note? A copy is kept in the audit log.', JSON.stringify(q));
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
