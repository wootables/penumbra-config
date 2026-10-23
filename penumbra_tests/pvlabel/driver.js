// pvlabel suite - page half (2026-10-22): a saved pivot whose aggregation labels, Grand Total
// labels or value field are tag-shaped (an author's or a shared preset's) shows them as TEXT, on
// the REAL main.js (mk_harness.py). window.__pwn is set by any payload that runs; window.__INJ
// lists any element added to the page carrying one of the payloads' on* attributes.
//   plflat  the one-level header: every value's sub-heading and the Grand Total's read as typed;
//           'R&D' unchanged; the column menu's title, a sort click, Copy as HTML, and a rebuild
//           through the builder (its rows and tokens show the labels as text) keep them text
//           (+ the Copy dialog: its column list, placeholder chips and Copied-values notice)
//   plnest  the nested header (V_STATUS > H_FLAG): the same headings, the column values still there
//   pllvl   a tag-shaped row field name (a column's): the level menu's "Show <field>" as text
//   plval   no column field: the heading over the values is the field's name, as text
//   plval1  the same with one value: "sum(<field>)"
//   plval2  one value and a two-type Grand Total: the same heading, spanning two rows
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  var PL = window.__PL;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  function cells() { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]'); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return cells().length > 0; }, 20000))) {
      var pc = document.getElementById('pivot-output-container');
      throw new Error('no pivot value cells: pivot ' + (pc ? pc.style.display + ' ' + pc.innerHTML.slice(0, 300) : 'none') + ' errors ' + JSON.stringify(window.__errors || []).slice(0, 300));
    }
    await sleep(800);   // an <img src=x>'s error event comes after its failed load
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function txt(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .col-sort-icon, .sort-rank, .pivot-collapse-toggle, button'), function (n) { n.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function subs(gt) {
    return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable thead th.pivot-sub-header'), function (th) { return th.classList.contains('pivot-grand-total') === gt; });
  }
  function subTexts(gt) { return subs(gt).map(txt); }
  // the value sub-headings repeat [a1, a2] under every column value
  function dataSubsOk() {
    var t = subTexts(false);
    return t.length >= 4 && t.length % 2 === 0 && t.every(function (x, i) { return x === (i % 2 ? PL.a2 : PL.a1); });
  }
  function gtSubsOk() { var t = subTexts(true); return t.length === 2 && t[0] === PL.t1 && t[1] === PL.t2; }
  function tagsInHead() { return document.querySelectorAll('#pivotResultTable thead img, #pivotResultTable thead svg, #pivotResultTable thead b').length; }
  function clean() { return window.__pwn === undefined && window.__PWN === undefined && window.__INJ.length === 0; }
  function asText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function menuName() { var m = document.querySelector('#pnbHeadMenu .pnb-hm-name'); return m ? m.textContent : null; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function rclick(el) {
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function valHead() {
    var th = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable thead tr:first-child th'), function (h) { return !h.hasAttribute('data-row-field'); })[0];
    return th ? txt(th) : null;
  }
  function info() {
    R.info.data = subTexts(false).slice(0, 4);
    R.info.gt = subTexts(true);
    R.info.pwn = window.__pwn || window.__PWN;
    R.info.inj = window.__INJ.slice(0, 5);
    R.info.tags = tagsInHead();
  }

  var S = {
    plflat: async function () {
      await step('render', async function () {
        R.chk.subText = dataSubsOk();
        R.chk.gtText = gtSubsOk();
        R.chk.noTags = tagsInHead() === 0;
        var rd = subs(false).filter(function (th) { return txt(th) === PL.a2; })[0];
        var sp = rd && rd.querySelector('.pivot-header-text');
        R.chk.plainSame = !!sp && sp.innerHTML === 'R&amp;D' && sp.textContent === 'R&D';
        R.info.rdHtml = sp ? sp.innerHTML : null;
        info();
      });
      await step('menu', async function () {
        var th = subs(false)[0];
        rclick(th);
        await sleep(300);
        R.info.menuName = menuName();
        R.chk.menuTitle = menuName() === PL.a1;
        closeMenu();
      });
      await step('sort', async function () {
        subs(false)[0].click();
        await sleep(600);
        R.chk.sortKeeps = dataSubsOk() && gtSubsOk();
      });
      await step('copy', async function () {
        $('input[name="copyFormat"][value="html"]').prop('checked', true);
        var n = window.__clip.length;
        $('#confirmCopyBtn').trigger('click');
        await until(function () { return window.__clip.slice(n).some(function (c) { return /^\[html\]/.test(c); }); }, 15000);
        await sleep(200);
        var h = window.__clip.slice(n).filter(function (c) { return /^\[html\]/.test(c); })[0] || '';
        R.info.copyLen = h.length;
        R.info.copyHead = (h.match(/<thead[\s\S]{0,900}/) || [''])[0];
        R.chk.copyText = h.indexOf(asText(PL.a1)) !== -1 && h.indexOf(asText(PL.t1)) !== -1 && h.indexOf('R&amp;D') !== -1 &&
          !/<(img|svg)\b/i.test(h) && h.indexOf('<b>bold') === -1;
      });
      // the Copy dialog reads the headings back (getFlatPivotHeaders: "Closed-<label>"): its column
      // list, its placeholder chips and its Copied-values notice name them as text
      await step('copydlg', async function () {
        $('#copyActionsBtn').trigger('click');
        await sleep(400);
        var opts = Array.prototype.map.call(document.querySelectorAll('#copyColumnSelector option'), function (o) { return { v: o.value, t: o.textContent }; });
        R.info.opts = opts.slice(0, 10);
        function opt(s) { return opts.filter(function (o) { return o.t.indexOf(s) !== -1 && o.v === o.t; })[0]; }
        R.chk.copyDlg = !!opt(PL.a1) && !!opt(PL.t1) && !!opts.filter(function (o) { return o.t === 'Open-R&D'; })[0];
        var codes = Array.prototype.map.call(document.querySelectorAll('#templatePlaceholders code'), function (e) { return e.textContent; });
        R.info.codes = codes.slice(0, 10);
        R.chk.copyPh = codes.some(function (c) { return c.indexOf('{Closed-' + PL.a1 + '}') === 0; }) && codes.some(function (c) { return c.indexOf(PL.t1) !== -1; });
        var o1 = opt(PL.a1);   // none on live (the label's option is missing): no copy, its alert is not the point
        if (o1) {
          $('input[name="copyFormat"][value="single_col"]').prop('checked', true);
          $('#copyColumnSelector').val(o1.v);
          $('#confirmCopyBtn').trigger('click');
          await until(function () { return document.body.textContent.indexOf('unique values from') !== -1; }, 8000);
        }
        R.info.note = (document.body.textContent.match(/Copied \d+ unique values from[^\n]{0,120}/) || [null])[0];
        R.chk.copyNote = !!o1 && document.body.textContent.indexOf('unique values from "' + o1.v + '"') !== -1;
      });
      await step('builder', async function () {
        $('#pivotBtn').trigger('click');
        await sleep(500);
        var lbls = Array.prototype.map.call(document.querySelectorAll('#pivot-agg-table-body .pat-cell-lbl .pat-cell-text'), function (e) { return e.textContent; });
        var toks = Array.prototype.map.call(document.querySelectorAll('.pivot-row-total-token .pivot-agg-token-label'), function (e) { return e.textContent; });
        R.info.builder = { lbls: lbls, toks: toks };
        R.chk.builderShows = lbls[0] === PL.a1 && lbls[1] === PL.a2 && toks[0] === PL.t1 && toks[1] === PL.t2;
        var h0 = window.__HC_HIDES || 0;
        $('#generatePivotBtn').trigger('click');
        await until(function () { return (window.__HC_HIDES || 0) > h0 && cells().length > 0; }, 30000);
        await sleep(800);
        R.info.rebuilt = (window.__HC_HIDES || 0) > h0;
        R.chk.rebuildText = R.info.rebuilt && dataSubsOk() && gtSubsOk() && tagsInHead() === 0;
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    },
    plnest: async function () {
      await step('render', async function () {
        R.chk.subText = dataSubsOk();
        R.chk.gtText = gtSubsOk();
        R.chk.noTags = tagsInHead() === 0;
        var heads = Array.prototype.map.call(document.querySelectorAll('#pivotResultTable thead th:not(.pivot-sub-header):not([data-row-field])'), txt);
        R.info.heads = heads;
        R.chk.colHeads = ['Closed', 'Open', 'Pending', 'N', 'Y'].every(function (v) { return heads.indexOf(v) !== -1; });
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    },
    pllvl: async function () {
      await step('render', async function () {
        await until(function () { return document.querySelectorAll('.pivot-collapse-dropdown .pivot-collapse-level-btn').length > 0; }, 8000);
        var t = Array.prototype.map.call(document.querySelectorAll('.pivot-collapse-dropdown .pivot-collapse-level-btn'), function (a) { return a.textContent; });
        R.info.levels = t;
        R.chk.lvlText = t.length === 3 && t[0].indexOf('Show H_GROUP only') !== -1 && t[1].indexOf('Show ' + PL.r1) !== -1;
        R.chk.leafText = t.length === 3 && t[2].indexOf('Show ' + PL.r2) !== -1;
        R.chk.noTags = tagsInHead() === 0 && document.querySelectorAll('.pivot-collapse-dropdown img, .pivot-collapse-dropdown svg').length === 0;
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    },
    plval: async function () {
      await step('render', async function () {
        R.info.valHead = valHead();
        R.chk.valHead = valHead() === PL.v1;
        R.chk.noTags = tagsInHead() === 0;
        R.chk.subText = subTexts(false).join('|') === 'Amt|N';
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    },
    plval1: async function () {
      await step('render', async function () {
        R.info.valHead = valHead();
        R.chk.valHead = valHead() === 'sum(' + PL.v1 + ')';
        R.chk.noTags = tagsInHead() === 0;
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    },
    plval2: async function () {
      await step('render', async function () {
        var th = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable thead tr:first-child th'), function (h) { return !h.hasAttribute('data-row-field'); })[0];
        R.info.valHead = valHead();
        R.info.span = th ? th.getAttribute('rowspan') : null;
        R.chk.valHead = valHead() === 'sum(' + PL.v1 + ')' && R.info.span === '2';
        R.chk.noTags = tagsInHead() === 0;
      });
      await sleep(500);
      R.chk.noScript = clean();
      info();
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('no scenario ' + SCN);
      await S[SCN]();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = (window.__errors || []).concat(window.__rejections || []).slice(0, 10);
    window.__HCRESULT = R;
    window.__HCDONE = true;
  })();
})();
