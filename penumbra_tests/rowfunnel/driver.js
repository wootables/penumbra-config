// rowfunnel suite - page half (2026-10-17). The status bar's row count opens the Rows card
// (main.js _sbRowsRender): where the rows on screen come from. The REAL main.js (run.py's
// hook adds window.__pnbRf.search(text) = what a snippet's search action does, and counts
// hideLoading() in window.__HC_HIDES) on the colmenu harness's 300-row fixture, the bar's
// lead segment lifted from the index.php under test.
//
// THE ORACLE for every per-part count is the real search: before the card is read, the
// driver runs the search for each run of parts so far (A, A and B, A and B and C) and
// records what the table then shows; the card's line for part k must say that number.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function seg() { return document.getElementById('sbRowsSeg') || document.querySelector('#pnbStatusBar .sb-lead'); }
  function btn() { return document.getElementById('sbRowsBtn'); }
  function pop() { return document.getElementById('sbRowsPop'); }
  function isOpen() { var s = seg(), p = pop(); return !!s && s.classList.contains('sb-open') && !!p && p.offsetHeight > 0; }
  function num(s) { var v = parseInt(String(s == null ? '' : s).replace(/[^\d]/g, ''), 10); return isNaN(v) ? null : v; }
  function visibleFlat() {
    var t = document.querySelectorAll('#resultsTable tbody tr'), v = 0;
    for (var i = 0; i < t.length; i++) if (!t[i].classList.contains('search-hidden')) v++;
    return v;
  }
  // the card as a list of lines
  function lines() {
    var p = pop();
    if (!p) return [];
    return Array.prototype.map.call(p.querySelectorAll('.sb-rf-step'), function (li) {
      var q = li.querySelector('.sb-rf-q'), n = li.querySelector('.sb-rf-n'), d = li.querySelector('.sb-rf-d'), x = li.querySelector('.sb-rf-x');
      var m = /sb-rf-(src|add|search|view)/.exec(li.className);
      return { kind: m ? m[1] : '', code: q ? q.textContent : null, lab: (li.querySelector('.sb-rf-lab') || li).textContent.replace(/\s+/g, ' ').trim(),
               n: n ? n.textContent.trim() : '', d: d ? d.textContent.trim() : '', x: x };
    });
  }
  function brief(ls) { return ls.map(function (l) { return l.kind + ':' + (l.code !== null ? '[' + l.code + ']' : l.lab) + '=' + l.n + (l.d ? '(' + l.d + ')' : '') + (l.x ? 'x' : ''); }); }
  function searchLines() { return lines().filter(function (l) { return l.kind === 'search'; }); }
  function box() { return pop() ? pop().querySelector('.sb-rf-box') : null; }
  // (2026-10-19, rfx) where each search line's x sits: in the search's chip, right after its
  // text (gap = the x's left minus the text's right), and each line's count, by its right edge
  function xPlace() {
    var p = pop();
    if (!p) return [];
    return Array.prototype.map.call(p.querySelectorAll('.sb-rf-step.sb-rf-search'), function (li) {
      var x = li.querySelector('.sb-rf-x'), q = li.querySelector('.sb-rf-q'), chip = li.querySelector('.sb-rf-chip');
      if (!x || !q) return { missing: true };
      var xr = x.getBoundingClientRect(), qr = q.getBoundingClientRect(), mid = (xr.top + xr.bottom) / 2;
      return { inChip: !!chip && x.parentNode === chip && q.parentNode === chip && x.previousElementSibling === q,
               gap: Math.round(xr.left - qr.right), level: mid >= qr.top - 1 && mid <= qr.bottom + 1, toEdge: Math.round(li.getBoundingClientRect().right - xr.right) };
    });
  }
  function valRights() {
    var p = pop();
    return p ? Array.prototype.map.call(p.querySelectorAll('.sb-rf-step .sb-rf-val'), function (v) { return Math.round(v.getBoundingClientRect().right); }) : [];
  }

  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1 && $('#sbRows').text().trim() !== ''; }, 200000)))
      throw new Error('boot: never loaded (rows text "' + $('#sbRows').text() + '")');
    await sleep(700);
    window.show_text = function () { };
    R.info.rowsText = $('#sbRows').text();
  }
  // the real search, as a snippet's search action runs it, then the bar's coalesced refresh
  async function search(text) {
    var h = window.__HC_HIDES || 0;
    window.__pnbRf.search(text);
    if (!(await until(function () { return (window.__HC_HIDES || 0) > h; }, 90000))) throw new Error('search never finished: ' + text);
    await sleep(300);
  }
  async function clickRows() { var s = seg(); if (s) $(s).find('#sbRows').trigger('click'); await sleep(80); }
  async function openCard() { if (!isOpen()) await clickRows(); return isOpen(); }
  function closeCard() { if (isOpen()) $(document.body).trigger('click'); }
  // the oracle: what the table shows for each run of parts so far
  async function oracle(parts, viewCount) {
    var out = [];
    for (var k = 0; k < parts.length; k++) {
      await search(parts.slice(0, k + 1).join(' and '));
      out.push(viewCount());
    }
    return out;
  }
  function groupedFiltered() { var m = /with ([\d,]+) filtered results/.exec($('#resultCount').text()); return m ? num(m[1]) : null; }
  function sameNums(ls, want) { return ls.length === want.length && ls.every(function (l, i) { return num(l.n) === want[i]; }); }

  var A = 'V_STATUS = Open', B = "H_GROUP2 = 'Tier 1'", C = 'H_FLAG = Y';
  // (rfx) 59 characters, one line in the card now; 141, two lines inside its chip
  var MID = "V_STATUS = Open or V_STATUS = Closed or H_GROUP2 = 'Tier 1'";
  var LONG = MID + " or H_GROUP2 = 'Tier 2' or H_FLAG = Y or V_STATUS = Pending or H_GROUP2 = 'Tier 3'";

  var S = {
    // 300 rows, no search, 200 a page: the button shows, the card opens on a click of the count
    fbase: async function () {
      R.chk.btnHiddenAtFirst = !!btn() && window.__BTN_HIDDEN_AT_BOOT === true;
      await boot();
      R.chk.btnShown = !!btn() && !btn().hidden && seg().classList.contains('sb-click');
      R.chk.opens = await openCard();
      R.chk.expanded = !!btn() && btn().getAttribute('aria-expanded') === 'true';
      var ls = lines();
      R.info.lines = brief(ls);
      R.chk.heading = !!pop() && /Where these rows come from/.test((pop().querySelector('.sb-pop-h') || {}).textContent || '');
      R.chk.srcLine = ls.length >= 1 && ls[0].kind === 'src' && /Query returned/.test(ls[0].lab) && num(ls[0].n) === 300;
      R.chk.pageLine = ls.length === 2 && ls[1].kind === 'view' && /Page 1 of 2/.test(ls[1].lab) && ls[1].n === '1–200';
      R.chk.noBox = isOpen() && !box();
      R.chk.liveStatus = document.getElementById('sbRows').getAttribute('role') === 'status';
      // Rows = All: one line for the whole set
      $('#rowsPerPageSelector').val('all').trigger('change');
      await until(function () { var l = lines(); return l.length && /On screen/.test(l[l.length - 1].lab); }, 20000);
      var l2 = lines();
      R.info.linesAll = brief(l2);
      R.chk.allLine = l2.length === 2 && /On screen/.test(l2[1].lab) && l2[1].n === 'all 300';
      closeCard();
      await sleep(80);
      R.chk.closes = !isOpen() && !!btn() && btn().getAttribute('aria-expanded') === 'false';
    },
    // three AND parts: one line each, each saying what the real search keeps; x takes one out
    fsearch: async function () {
      await boot();
      var want = await oracle([A, B, C], visibleFlat);
      R.info.oracle = want;
      R.chk.oracleNarrows = want[0] < 300 && want[1] < want[0] && want[2] < want[1] && want[2] > 0;
      R.chk.opens = await openCard();
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.threeLines = ls.length === 3 && ls[0].code === A && ls[1].code === B && ls[2].code === C;
      R.chk.counts = sameNums(ls, want);
      R.chk.drops = ls.length === 3 && num(ls[0].d) === 300 - want[0] && num(ls[1].d) === want[0] - want[1] && num(ls[2].d) === want[1] - want[2];
      // "...from the search", or "...from the filter" since penumbra_tests\filterword (2026-10-19)
      R.chk.eachX = ls.length === 3 && ls.every(function (l) { return !!l.x; }) && /Remove .*V_STATUS = Open.* from the (?:search|filter)/.test(ls[0].x.getAttribute('aria-label') || '');
      R.chk.clearAll = !!document.getElementById('sbRfClear');
      // (rfx) each x in its search's chip at the end of the text, level with it; every count in one column
      var xp = xPlace(), vr = valRights();
      R.info.xPlace = xp; R.info.valRights = vr;
      R.chk.xInChip = xp.length === 3 && xp.every(function (p) { return p.inChip === true; });
      R.chk.xAtTextEnd = xp.length === 3 && xp.every(function (p) { return !p.missing && p.gap >= 0 && p.gap <= 6 && p.level; });
      R.chk.numsAligned = vr.length >= 5 && vr.every(function (v) { return Math.abs(v - vr[0]) <= 1; });
      if (ls.length !== 3) return;   // no card here (the control): the rest cannot run
      // the x on the first part: the search becomes the other two, exactly as typed
      var h = window.__HC_HIDES;
      ls[0].x.focus();
      $(ls[0].x).trigger('click');
      await until(function () { return window.__HC_HIDES > h && searchLines().length === 2; }, 60000);
      await sleep(300);
      R.info.afterX = { box: $('#tableSearch').val(), lines: brief(lines()), focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName) };
      R.chk.xRewrites = $('#tableSearch').val() === B + ' and ' + C;
      R.chk.xStaysOpen = isOpen();
      var two = searchLines();
      R.chk.xRecounts = two.length === 2 && num(two[1].n) === visibleFlat() && two[0].code === B;
      R.chk.xFocus = !!document.activeElement && document.activeElement.classList.contains('sb-rf-x') && pop().contains(document.activeElement);
      // Clear the whole search
      h = window.__HC_HIDES;
      $('#sbRfClear').trigger('click');
      await until(function () { return window.__HC_HIDES > h && searchLines().length === 0; }, 60000);
      await sleep(300);
      R.chk.clearDone = $('#tableSearch').val() === '' && visibleFlat() === 300 && searchLines().length === 0 && isOpen();
      R.chk.clearFocus = !!document.activeElement && document.activeElement.id === 'sbRowsPopHead';
    },
    // an OR: one line, the view's own count, its x clears the search
    for: async function () {
      await boot();
      var q = 'V_STATUS = Open or V_STATUS = Closed';
      await search(q);
      var v = visibleFlat();
      R.chk.opens = await openCard();
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.oneLine = ls.length === 1 && ls[0].code === q && num(ls[0].n) === v && v > 0 && v < 300;
      R.chk.noClearAll = isOpen() && !document.getElementById('sbRfClear');
      if (!ls.length) return;
      var h = window.__HC_HIDES;
      $(ls[0].x).trigger('click');
      await until(function () { return window.__HC_HIDES > h; }, 60000);
      await sleep(300);
      R.chk.xClears = $('#tableSearch').val() === '' && visibleFlat() === 300;
    },
    // a search the parts cannot account for (__ALL is a pivot's; the flat search reads it as a
    // word): one line with the view's own count, never per-part numbers
    fmismatch: async function () {
      await boot();
      var q = '__ALL ' + A;
      await search(q);
      var v = visibleFlat();
      R.info.visible = v;
      R.chk.opens = await openCard();
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.oneLine = ls.length === 1 && ls[0].code === q && num(ls[0].n) === v;
    },
    // the box edited but not run: the card describes the search the rows reflect
    fpending: async function () {
      await boot();
      await search(A);
      var v = visibleFlat();
      $('#tableSearch').val(A + ' and ' + B);
      R.chk.opens = await openCard();
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.applied = ls.length === 1 && ls[0].code === A && num(ls[0].n) === v;
    },
    // grouped by H_GROUP: the parts, then the groups
    gsearch: async function () {
      await boot();
      R.chk.opens = await openCard();
      var l0 = lines();
      R.info.lines0 = brief(l0);
      R.chk.groupsLine = l0.length === 2 && l0[1].kind === 'view' && /Groups/.test(l0[1].lab) && num(l0[1].n) > 1;
      closeCard();
      var want = await oracle([A, B], groupedFiltered);
      R.info.oracle = want;
      R.chk.opens2 = await openCard();
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.counts = want[0] !== null && want[1] !== null && sameNums(ls, want);
      var g = lines().filter(function (l) { return l.kind === 'view'; })[0];
      var m = /in ([\d,]+) of ([\d,]+) groups/.exec($('#resultCount').text());
      R.chk.groupsOf = !!g && !!m && g.n === num(m[1]).toLocaleString() + ' of ' + num(m[2]).toLocaleString();
    },
    // a pivot: its rows; a search is one line with the source rows it keeps
    pbase: async function () {
      await boot();
      R.chk.opens = await openCard();
      var ls = lines();
      R.info.lines = brief(ls);
      var m = /([\d,]+) pivot rows/.exec($('#resultCount').text());
      R.chk.pivotLine = !!m && ls.some(function (l) { return l.kind === 'view' && /Pivot rows/.test(l.lab) && num(l.n) === num(m[1]); });
      R.chk.srcLine = ls.length >= 1 && num(ls[0].n) === 300;
      closeCard();
      await search(A);
      var star = $('#resultCount span[title*="source transaction"]').attr('title') || '';
      var sm = /([\d,]+) of ([\d,]+) source transactions? match/.exec(star);
      R.info.star = star;
      R.chk.opens2 = await openCard();
      var s = searchLines();
      R.info.lines2 = brief(lines());
      R.chk.searchLine = !!sm && s.length === 1 && s[0].code === A && num(s[0].n) === num(sm[1]);
    },
    // limit on (saved so), exactly 200 rows, an editor: the box, the switch, the saved note
    rcap: async function () {
      await boot();
      var w = document.getElementById('sbRowLimitWarn');
      R.chk.iconShows = !!w && w.style.display !== 'none';
      R.chk.opens = await openCard();
      var b = box();
      R.info.box = b ? b.textContent : null;
      R.chk.warnBox = !!b && b.classList.contains('sb-rf-warn') && /Row limit reached/.test(b.textContent) && /stopped the query at 200 rows/.test(b.textContent);
      R.chk.savedSentence = !!b && /saved with the limit on, so everyone who opens it gets at most 200 rows/.test(b.textContent);
      R.chk.switchBtn = !!document.getElementById('sbRfLimitOff');
      R.chk.saveFoot = !!b && /Then save the report/.test(b.textContent);
      // (rfx) the box takes the card's width and never sets it: the card is as wide with it as without
      if (b) {
        var wA = pop().offsetWidth;
        b.style.display = 'none';
        var wB = pop().offsetWidth;
        b.style.display = '';
        R.info.boxWiden = [wA, wB];
        R.chk.boxNoWiden = wA === wB;
      }
      var q = window.__queryDone;
      $('#sbRfLimitOff').trigger('click');
      await until(function () { return window.__queryDone > q; }, 60000);
      await sleep(400);
      R.chk.limitOff = !$('#toggleLimitBtn').hasClass('is-active');
      R.chk.reran = window.__queryDone > q;
      R.chk.closedAfter = window.__queryDone > q && !isOpen();
    },
    // the same for a viewer: no switch, who has it
    rcapv: async function () {
      await boot();
      R.chk.opens = await openCard();
      var b = box();
      R.info.box = b ? b.textContent : null;
      R.chk.warnBox = !!b && /Row limit reached/.test(b.textContent);
      R.chk.noSwitch = isOpen() && !document.getElementById('sbRfLimitOff') && !document.getElementById('sbRfSave');
      R.chk.whoCan = !!b && /owner or an editor can turn the limit off/.test(b.textContent);
    },
    // a viewer whose cap comes only from this link's ?rowlimit=true: the link without it
    rcapurl: async function () {
      await boot();
      R.chk.iconShows = document.getElementById('sbRowLimitWarn').style.display !== 'none';
      R.chk.opens = await openCard();
      var a = document.getElementById('sbRfNoUrlLimit');
      R.info.href = a ? a.getAttribute('href') : null;
      R.chk.urlLink = !!a && !/rowlimit/.test(a.getAttribute('href')) && /scn=rcapurl/.test(a.getAttribute('href'));
      R.chk.noSavedSentence = !!box() && !/saved with the limit on/.test(box().textContent);
    },
    // an editor with the limit off here, the report saved with it on, 300 rows: say so
    rsaved: async function () {
      await boot();
      R.chk.limitOffHere = !$('#toggleLimitBtn').hasClass('is-active');
      R.chk.opens = await openCard();
      var b = box();
      R.info.box = b ? b.textContent : null;
      R.chk.infoBox = !!b && b.classList.contains('sb-rf-info') && /Saved with the row limit on/.test(b.textContent) && /at most 200 of these 300 rows/.test(b.textContent);
      window.__saveClicks = 0;
      $('#saveQuery').off('click').on('click', function () { window.__saveClicks++; });
      $('#sbRfSave').trigger('click');
      await sleep(100);
      R.chk.saveOpens = window.__saveClicks === 1 && !isOpen();
    },
    // 150 rows with the limit on: no icon, no box (as before)
    r150: async function () {
      await boot();
      R.chk.noIcon = document.getElementById('sbRowLimitWarn').style.display === 'none';
      R.chk.opens = await openCard();
      R.chk.noBox = isOpen() && !box();
      R.chk.srcLine = num((lines()[0] || {}).n) === 150;
    },
    // keys: the button opens it, Escape closes it with the focus back on the button; a click
    // inside the card keeps it, one outside closes it
    rkbd: async function () {
      await boot();
      if (!btn()) return;
      btn().focus();
      btn().click();   // what Enter / Space do on a button
      await sleep(80);
      R.chk.btnOpens = isOpen() && btn().getAttribute('aria-expanded') === 'true';
      var head = document.getElementById('sbRowsPopHead');
      head.focus();
      $(head).trigger('click');
      await sleep(80);
      R.chk.insideKeeps = isOpen();
      head.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(80);
      R.chk.escCloses = !isOpen() && btn().getAttribute('aria-expanded') === 'false';
      R.chk.escFocus = document.activeElement === btn();
      btn().click();
      await sleep(80);
      $('#resultsHeader').trigger('click');
      await sleep(80);
      R.chk.outsideCloses = !isOpen();
    },
    // the repository page: no report, so nothing to open
    rrepo: async function () {
      await boot();
      R.chk.btnHidden = !!btn() && btn().hidden;
      R.chk.notClickable = !seg().classList.contains('sb-click');
      await clickRows();
      R.chk.staysShut = !isOpen();
    },
    // a narrow window (run.py: 480px): the lead segment clips its content there, the open card is not
    rnarrow: async function () {
      await boot();
      R.info.width = window.innerWidth;
      R.chk.narrow = window.innerWidth <= 600;
      $('#saveStateLightbox').hide();   // harness furniture (the saveconf fields) that sits over the foot of a narrow page
      R.chk.opens = await openCard();
      if (!R.chk.opens) return;
      var r = pop().getBoundingClientRect();
      var el = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + Math.min(30, r.height / 2));
      R.info.rect = { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), hit: el ? (el.id || el.className) : null };
      R.chk.cardVisible = !!el && pop().contains(el) && r.width >= 280 && r.right <= window.innerWidth + 1;
      // (rfx) a long search: the wider card still stops short of the window's edge
      await search(LONG);
      await openCard();
      var r2 = pop().getBoundingClientRect();
      R.info.rectLong = { l: Math.round(r2.left), r: Math.round(r2.right), w: Math.round(r2.width), vw: window.innerWidth };
      R.chk.fitsNarrow = isOpen() && r2.left >= 0 && r2.right <= window.innerWidth - 8;
    },
    // (2026-10-19, rfx) the card is as wide as its own lines, not the count under it: a
    // 59-character search on one line behind the harness's short count, the same width when the
    // count under it grows or shrinks, past the old 420px cap and within the new 600px one; a
    // 141-character search wraps inside its chip, the keyword beside its first line
    fwide: async function () {
      await boot();
      $('#saveStateLightbox').hide();   // harness furniture: its backdrop covers the page's foot
      await search(MID);
      R.chk.opens = await openCard();
      if (!R.chk.opens) return;
      var q = pop().querySelector('.sb-rf-search .sb-rf-q');
      var lh = q ? parseFloat(getComputedStyle(q).lineHeight) || 16 : 16;
      var w1 = pop().offsetWidth;
      R.info.lines = brief(lines());
      R.info.mid = { card: w1, codeH: q ? Math.round(q.getBoundingClientRect().height) : null, lh: lh, seg: seg().offsetWidth };
      R.chk.oneLine = searchLines().length === 1 && !!q && q.textContent === MID && q.getBoundingClientRect().height <= lh * 1.5;
      R.chk.wider = w1 > 450 && w1 <= 630;   // the old cap: 420 + padding and border; the new: 600 + the same
      var rows = document.getElementById('sbRows'), was = rows.textContent;
      rows.textContent = '3,778 total rows, with 614 filtered results in 1 of 19 groups, 509 innermost';
      var w2 = pop().offsetWidth;
      rows.textContent = '9';
      var w3 = pop().offsetWidth;
      rows.textContent = was;
      R.info.byCount = [w1, w2, w3];
      R.chk.notByCount = w1 === w2 && w1 === w3;
      await search(LONG);
      await openCard();
      var q2 = pop().querySelector('.sb-rf-search .sb-rf-q'), kw = pop().querySelector('.sb-rf-search .sb-rf-kw'), x = pop().querySelector('.sb-rf-search .sb-rf-x');
      if (!q2 || !kw || !x) { R.info.long = 'no search line'; return; }
      var pr = pop().getBoundingClientRect(), qr = q2.getBoundingClientRect(), kr = kw.getBoundingClientRect(), xr = x.getBoundingClientRect();
      R.info.long = { card: Math.round(pr.width), codeH: Math.round(qr.height), kwTop: Math.round(kr.top), codeTop: Math.round(qr.top), kwRight: Math.round(kr.right), codeLeft: Math.round(qr.left), xRight: Math.round(xr.right), cardRight: Math.round(pr.right) };
      R.chk.longWraps = q2.textContent === LONG && qr.height > lh * 1.5 && pr.width <= 631 && pr.right <= window.innerWidth;
      R.chk.kwBeside = Math.abs(kr.top - qr.top) <= 6 && kr.right <= qr.left;
      R.chk.xInsideCard = xr.right <= pr.right - 8;
    },
    // (not in SCN) a picture: PNB_SHOT=<png> PNB_SHOT_SCN=rxshot py -3 run.py --stage DIR --scn rxshot
    // (two AND parts) or rxshot2 (the 59-character search, one line)
    rxshot: async function () {
      await boot();
      $('#saveStateLightbox').hide();
      await search(A + ' and ' + B);
      R.chk.opens = await openCard();
    },
    rxshot2: async function () {
      await boot();
      $('#saveStateLightbox').hide();
      await search(MID);
      R.chk.opens = await openCard();
    },
    // (for a picture) 200 rows, the limit saved on, an editor, a two-part search, the card open
    rcapshot: async function () {
      await boot();
      $('#saveStateLightbox').hide();   // harness furniture: its backdrop dims the page
      await search(A + ' and ' + B);
      R.chk.opens = await openCard();
    },
    // 20,000 rows, three parts: per-part lines, within the budget
    rbig: async function () {
      await boot();
      await search([A, B, C].join(' and '));
      var t0 = performance.now();
      $('#sbRows').trigger('click');
      var ms = performance.now() - t0;
      R.info.ms = Math.round(ms);
      var ls = searchLines();
      R.info.lines = brief(lines());
      R.chk.threeLines = ls.length === 3 && num(ls[2].n) === visibleFlat();
      R.chk.fast = ms < 1500 && isOpen();
    }
  };
  (async function () {
    try {
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); R.chk.__fatal = R.fatal; }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    if (R.fatal) R.errors.push('driver: ' + R.fatal.slice(0, 300));
    window.__HCRESULT = R; window.__HCDONE = true;
    var o = document.getElementById('out'); if (o) o.textContent = 'DONE';
  })();
})();
