// notesfresh suite - browser half (2026-10-16). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__JRRESULT = { scn, asserts: [{id, ok, detail}], errors: [...] } + window.__JRDONE = true.
// Row notes kept current without a refresh button:
//   F-*  a note card opens at once on the page's notes, then reads that row again
//        (row_notes_one) and redraws only when something changed - a new note tinted
//        and counted, an edit or a delete shown, the table's Notes cell following.
//   B-*  a tab come back to (focus / shown) whose notes were last known current 2+
//        minutes ago asks notes_version; only a different answer reads row_notes
//        again (and an open card follows). Round 2 (live E2E): keyed on that age,
//        not a blur..focus clock - a brief focus in between no longer resets it.
//
// GROUND TRUTH: the fake journal server (window.__J, harness.html) and the strings
// below, written out by hand from the fixture - never computed by the code under test.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JR_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }

  var K3 = window.__NOTED, K7 = window.__FILEROW, J = window.__J;
  var KIM = { ID: '904', REPORT_ID: 7, SCOPE: 'row', ROW_KEY: K3, NOTE_TEXT: 'Kim checked the budget.', CREATED_BY: 'kim', AUTHOR_NAME: 'Kim Poe', CREATED_AT: '2026-10-16 09:00:00', PARENT_ID: null };

  function notesTd(rk) {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i].parentNode;
    return null;
  }
  function cellCount(rk) { var td = notesTd(rk); var c = td && td.querySelector('.journal-notes-count'); return c ? c.textContent : null; }
  function cellPreview(rk) { var td = notesTd(rk); var p = td && td.querySelector('.journal-notes-preview'); return p ? p.textContent : null; }
  function card() { return document.querySelector('.journal-pvnote-card'); }
  function items(c) { return c ? Array.prototype.slice.call(c.querySelectorAll('.journal-rownote-item')) : []; }
  function ids(c) { return items(c).map(function (e) { return e.getAttribute('data-note-id'); }).join(','); }
  function texts(c) { return items(c).map(function (e) { var t = e.querySelector('.journal-rownote-text'); return t ? t.textContent : ''; }); }
  function status(c) { var s = c && c.querySelector('.journal-rownote-status'); return s ? s.textContent : null; }
  function calls(prefix) { return (J.calls || []).filter(function (a) { return String(a).indexOf(prefix) === 0; }); }
  function clickCard(rk) {
    var td = notesTd(rk);
    if (!td) throw new Error('no notes cell for ' + rk);
    clickEl(td.querySelector('.journal-notes-btn'));
  }
  async function openCard(rk) {
    clickCard(rk);
    await until(function () { var c = card(); return c && c.getAttribute('data-pvn-key') === rk && c.querySelector('.journal-rownote-item'); }, 3000);
    return card();
  }
  // The clock for "away 2+ minutes": Date.now runs ahead by what the scenario adds.
  var _now = Date.now, _skew = 0;
  Date.now = function () { return _now.call(Date) + _skew; };
  async function awayFor(ms, how) {
    if (how === 'hidden') {
      var hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return hidden; } });
      document.dispatchEvent(new Event('visibilitychange'));
      _skew += ms;
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    } else {
      window.dispatchEvent(new Event('blur'));
      _skew += ms;
      window.dispatchEvent(new Event('focus'));
    }
    await sleep(250);
  }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }

  var S = {};
  // ---- a card opens: at once from the page's copy, then that row re-read -----------------
  S.cardnew = async function () {
    J.oneDelay = 300;                                   // the re-read answers late: the card must not wait for it
    J.notes[K3].push(KIM); J.counts[K3] = 4;            // Kim wrote since this page loaded
    var before = calls('row_notes').length;
    clickCard(K3);
    await sleep(80);
    var c = card();
    rec('F-instant', !!c && ids(c) === '901,903,902', 'before the re-read lands: ' + (c ? ids(c) : 'no card'));
    await until(function () { return ids(card()).indexOf('904') >= 0; }, 3000);
    c = card();
    rec('F-new', ids(c) === '901,903,902,904' && texts(c)[3] === 'Kim checked the budget.', 'ids ' + ids(c));
    var it = c && c.querySelector('.journal-rownote-item[data-note-id="904"]'), old = c && c.querySelector('.journal-rownote-item[data-note-id="902"]');
    var bgNew = it ? getComputedStyle(it).backgroundColor : '', bgOld = old ? getComputedStyle(old).backgroundColor : '';
    rec('F-tint', !!it && it.classList.contains('journal-rownote-new') && !old.classList.contains('journal-rownote-new') && bgNew !== bgOld,
        'new ' + (it && it.className) + ' bg ' + bgNew + ' vs ' + bgOld);
    rec('F-status', status(c) === '1 new note.', 'status "' + status(c) + '"');
    rec('F-rail', /<b>4<\/b> notes/.test((c.querySelector('.journal-rownote-railmeta') || {}).innerHTML || ''), (c.querySelector('.journal-rownote-railmeta') || {}).innerHTML);
    await sleep(150);
    rec('F-cell', cellCount(K3) === '4' && cellPreview(K3) === 'Kim checked the budget.', 'cell count ' + cellCount(K3) + ' preview ' + cellPreview(K3));
    var one = calls('row_notes_one');
    rec('F-one-call', one.length === 1 && one[0] === 'row_notes_one|row|' + K3 && calls('row_notes').length - one.length === before && J.posts.length === 0,
        'calls ' + JSON.stringify(J.calls.slice(-4)));
    await sleep(2300);
    rec('F-tint-fades', !c.querySelector('.journal-rownote-new'), 'tint gone after 2.2 s');
  };
  // nothing changed: one small read, no redraw, no message
  S.cardsame = async function () {
    var c = await openCard(K3);
    var first = items(c)[0];
    first.__mark = 1;
    await until(function () { return calls('row_notes_one').length >= 1; }, 2000);
    await sleep(300);
    rec('F-same-call', calls('row_notes_one').length === 1, 'calls ' + JSON.stringify(J.calls.slice(-3)));
    rec('F-same-noredraw', items(c)[0] === first && first.__mark === 1 && !c.querySelector('.journal-rownote-new') && status(c) === '',
        'same nodes ' + (items(c)[0] === first) + ' status "' + status(c) + '"');
  };
  // a colleague's edit and a delete
  S.cardedit = async function () {
    J.notes[K3] = J.notes[K3].map(function (n) { var o = JSON.parse(JSON.stringify(n)); if (o.ID === '902') o.NOTE_TEXT = 'Follow up on Monday.'; return o; });
    var c = await openCard(K3);
    await until(function () { return texts(card()).indexOf('Follow up on Monday.') >= 0; }, 3000);
    c = card();
    rec('F-edit-text', texts(c)[2] === 'Follow up on Monday.', JSON.stringify(texts(c)));
    rec('F-edit-notint', !c.querySelector('.journal-rownote-new') && status(c) === '', 'an edited note is not "new": status "' + status(c) + '"');
    await sleep(150);
    rec('F-edit-cell', cellPreview(K3) === 'Follow up on Monday.' && cellCount(K3) === '3', 'cell ' + cellPreview(K3) + ' / ' + cellCount(K3));
  };
  S.carddel = async function () {
    J.notes[K3] = J.notes[K3].filter(function (n) { return n.ID !== '903'; }); J.counts[K3] = 2;
    var c = await openCard(K3);
    await until(function () { return ids(card()) === '901,902'; }, 3000);
    c = card();
    rec('F-del', ids(c) === '901,902' && !c.querySelector('.journal-rownote-new'), 'ids ' + ids(c));
    await sleep(150);
    rec('F-del-cell', cellCount(K3) === '2', 'cell count ' + cellCount(K3));
  };
  // the last note on a row deleted: the row has none
  S.cardgone = async function () {
    J.notes[K7] = []; delete J.counts[K7];
    var c = await openCard(K7);
    await until(function () { return !card().querySelector('.journal-rownote-item'); }, 3000);
    c = card();
    rec('F-gone', !c.querySelector('.journal-rownote-item') && !!c.querySelector('.journal-rownote-empty'), 'list: ' + (c.querySelector('.journal-rownote-list') || {}).textContent);
    await sleep(150);
    rec('F-gone-cell', !cellCount(K7) && !cellPreview(K7), 'cell count "' + cellCount(K7) + '" preview "' + cellPreview(K7) + '"');
  };
  // the re-read lands after its card closed and another opened: the other card is untouched,
  // the first row's count still follows
  S.cardmoved = async function () {
    J.oneDelay = 400;
    J.notes[K3].push(KIM); J.counts[K3] = 4;
    clickCard(K3);
    await sleep(60);
    var c7 = await openCard(K7);
    await sleep(900);
    rec('F-moved-card', card() === c7 && c7.getAttribute('data-pvn-key') === K7 && ids(c7) === '950' && !c7.querySelector('.journal-rownote-new'),
        'card ' + (card() && card().getAttribute('data-pvn-key') === K7 ? 'K7' : 'other') + ' ids ' + ids(card()));
    rec('F-moved-count', cellCount(K3) === '4', 'K3 cell count ' + cellCount(K3));
  };

  // ---- the tab comes back --------------------------------------------------------------
  S.tabback = async function () {
    var base = calls('row_notes').length;
    await awayFor(30000, 'blur');
    rec('B-short', calls('notes_version').length === 0, 'away 30 s: ' + JSON.stringify(J.calls.slice(-2)));
    await awayFor(130000, 'blur');
    rec('B-same', calls('notes_version').length === 1 && calls('row_notes').length - calls('row_notes_one').length === base,
        'nothing changed: one version check, no reload. ' + JSON.stringify(J.calls.slice(-3)));
    await awayFor(30000, 'blur');
    rec('B-quiet', calls('notes_version').length === 1, 'a check that found them current counts as current: 30 s later asks nothing. ' + JSON.stringify(J.calls.slice(-2)));
    J.notes[K3].push(KIM); J.counts[K3] = 4; J.ver = 'v2';
    await awayFor(130000, 'blur');
    await until(function () { return cellCount(K3) === '4'; }, 3000);
    rec('B-reload', calls('notes_version').length === 2 && calls('row_notes').length - calls('row_notes_one').length === base + 1 && cellCount(K3) === '4',
        'changed: version, then row_notes; cell ' + cellCount(K3) + ' ' + JSON.stringify(J.calls.slice(-3)));
    await awayFor(130000, 'blur');
    rec('B-rebase', calls('notes_version').length === 3 && calls('row_notes').length - calls('row_notes_one').length === base + 1,
        'the reload took the new version: no second reload. ' + JSON.stringify(J.calls.slice(-3)));
  };
  S.tabhidden = async function () {
    J.notes[K3].push(KIM); J.counts[K3] = 4; J.ver = 'v2';
    await awayFor(130000, 'hidden');
    await until(function () { return cellCount(K3) === '4'; }, 3000);
    rec('B-hidden', calls('notes_version').length === 1 && cellCount(K3) === '4', 'hidden tab back: ' + JSON.stringify(J.calls.slice(-3)));
  };
  // Round 2: a glance back in between (focus after 20 s) does not cancel the later check.
  S.tabglance = async function () {
    J.notes[K3].push(KIM); J.counts[K3] = 4; J.ver = 'v2';
    await awayFor(20000, 'blur');
    await awayFor(110000, 'blur');
    await until(function () { return cellCount(K3) === '4'; }, 3000);
    rec('B-glance', calls('notes_version').length === 1 && cellCount(K3) === '4', 'after a glance back at 20 s: ' + JSON.stringify(J.calls.slice(-3)));
  };
  S.tabcard = async function () {
    var c = await openCard(K3);
    await sleep(300);
    J.notes[K3].push(KIM); J.counts[K3] = 4; J.ver = 'v2';
    await awayFor(130000, 'blur');
    await until(function () { return ids(card()).indexOf('904') >= 0; }, 3000);
    rec('B-card', card() === c && ids(c) === '901,903,902,904', 'the open card follows: ' + ids(card()));
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
