// cind suite - page half (2026-11-06): the REAL main.js and penumbra_colmenu.js on the colmenu harness.
//   mcind   a column's menu marks Column options... with a dot when it holds settings (a format, Click to filter), its
//           tip lists them; a column without stays plain. The status bar's custom layout chip lists the viewer's formats,
//           Click to filter and a sort other than the report's.
//   ggcind  a group's band menu ends with Fit all column widths to contents / to page (a block of their own), which run
//           the widths module on the grouped view's heading; none with every group folded.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function itemOf(act) { var m = menu(); return m ? m.querySelector('.pnb-hm-item[data-act="' + act + '"]') : null; }
  function tops() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer > .group-wrapper')); }
  function diffText() { var d = document.getElementById('sbCustomColsDiff'); return d ? d.textContent.replace(/\s+/g, ' ') : ''; }
  function chipOn() { var c = document.getElementById('sbCustomCols'); return !!c && getComputedStyle(c).display !== 'none'; }
  var S = {
    mcind: async function () {
      // a plain column: no dot
      closeMenu(); rclick(fth('V_NAME')); await sleep(200);
      var o0 = itemOf('options');
      R.info.plain = o0 && o0.outerHTML.slice(0, 300);
      R.chk.plainNoDot = !!o0 && !o0.querySelector('.pnb-hm-dot') && !/Set on this column/.test(o0.getAttribute('title') || '');
      closeMenu();
      R.info.chip0 = { on: chipOn(), diff: diffText() };
      var chip0 = !chipOn() || !/Formats set here|Sorted here/.test(diffText());
      // a format on V_AMOUNT: the dot, its words in the tip, the count for a screen reader
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      await sleep(300);
      rclick(fth('V_AMOUNT')); await sleep(200);
      var o1 = itemOf('options'), t1 = o1 ? (o1.getAttribute('title') || '') : '';
      R.info.amount = { title: t1, aria: o1 && o1.getAttribute('aria-label') };
      R.chk.dotOn = !!o1 && !!o1.querySelector('.pnb-hm-dot') && /Set on this column:\n• Format: Currency/.test(t1)
        && /^Format, summary, shading, filter and links/.test(t1) && (o1.getAttribute('aria-label') || '') === 'Column options..., 1 set';
      // the dot sits after the words, before any note
      var kids = o1 ? Array.prototype.map.call(o1.children, function (c) { return c.className; }) : [];
      R.chk.dotPlace = kids.indexOf('pnb-hm-dot') === kids.indexOf('pnb-hm-label') + 1;
      R.info.kids = kids;
      closeMenu();
      // Click to filter on V_NAME: its dot and words
      window.Penumbra.setColOpt('V_NAME', 'filter', true);
      await sleep(300);
      rclick(fth('V_NAME')); await sleep(200);
      var o2 = itemOf('options'), t2 = o2 ? (o2.getAttribute('title') || '') : '';
      R.chk.dotFilter = !!o2 && !!o2.querySelector('.pnb-hm-dot') && /• Click to filter/.test(t2);
      R.info.name = t2;
      closeMenu();
      // the chip: lit, the formats and the Click to filter named
      await until(function () { return /Click to filter set here/.test(diffText()); }, 3000);
      R.info.chip1 = { on: chipOn(), diff: diffText() };
      R.chk.chipOpts = chip0 && chipOn() && /Formats set here: V_AMOUNT/.test(diffText()) && /Click to filter set here: V_NAME/.test(diffText());
      // a sort the report does not have: named on the chip, the report's none
      $(fth('V_ID')).trigger('click');
      await until(function () { return /Sorted here/.test(diffText()); }, 3000);
      R.info.chip2 = diffText();
      R.chk.chipSort = /Sorted here by V_ID \(ascending\) \(the report has no sort\)/.test(diffText());
      // no Save button in the chip's card any more
      R.chk.noSave = !document.getElementById('sbCustomColsSave') || getComputedStyle(document.getElementById('sbCustomColsSave')).display === 'none';
    },
    // (cind 3) List: the empty space of the selected group's pane opens that group's band menu; not in Stacked, not on a cell
    gglcind: async function () {
      if (!(await until(function () { return tops().length > 0; }, 20000))) throw new Error('never grouped');
      await sleep(400);
      // Stacked first: a group's wrapper (outside its band and table) keeps the browser's menu
      closeMenu();
      var w0 = tops()[0], stackedPrevented = rclick(w0);
      await sleep(150);
      R.chk.stackedNone = !stackedPrevented && !menu();
      // to List, from the band's menu
      closeMenu(); rclick(w0.querySelector(':scope > .group-header')); await sleep(200);
      var gl = itemOf('gList'); if (gl) gl.click();
      if (!(await until(function () { return document.body.classList.contains('pnb-gl-on') && !!document.querySelector('#pnbGroupList .pnb-gl-item.is-active'); }, 8000))) throw new Error('never List');
      await sleep(400);
      closeMenu();
      var act = document.querySelector('#pnbGroupList .pnb-gl-item.is-active');
      var name = act.querySelector('.pnb-gl-name').textContent;
      var sel = document.querySelector('#groupedResultsContainer .group-wrapper.pnb-gl-sel');
      var top = sel; while (top && top.parentNode && top.parentNode.id !== 'groupedResultsContainer') top = top.parentNode.closest('.group-wrapper') || top.parentNode;
      // the pane's own box (the empty space a short table leaves under it), and the selected group's content box
      var prevented = rclick(top); await sleep(200);
      var m = menu(), head = m ? m.textContent : '';
      R.info.pane = { name: name, prevented: prevented, acts: acts(), head: head.slice(0, 80) };
      R.chk.paneMenu = prevented && !!m && head.indexOf(name) >= 0 && acts().indexOf('gStacked') >= 0 && acts().indexOf('gCopyName') >= 0;
      var band = sel.querySelector(':scope > .group-header');
      R.chk.paneMarks = !!band && band.classList.contains('pnb-hm-for');
      closeMenu(); await sleep(100);
      var gc = sel.querySelector(':scope > .group-content');
      var p2 = gc ? rclick(gc) : false; await sleep(200);
      R.chk.contentMenu = p2 && !!menu() && menu().textContent.indexOf(name) >= 0 && acts().indexOf('gStacked') >= 0;
      closeMenu(); await sleep(100);
      // a cell of the table keeps its column's menu
      var td = sel.querySelector('.group-content table tbody td:not(:first-child)');
      rclick(td); await sleep(200);
      R.info.cellActs = acts().slice(0, 6);
      R.chk.cellStays = !!menu() && acts().indexOf('gStacked') < 0 && acts().indexOf('gCopyName') < 0;
      closeMenu();
    },
    ggcind: async function () {
      if (!(await until(function () { return tops().length > 0; }, 20000))) throw new Error('never grouped');
      await sleep(400);
      var W = window.Penumbra.colWidths, calls = [];
      W.fitAll = function (th) { calls.push(['all', th && th.getAttribute('data-colname'), !!(th && th.closest('#groupedResultsContainer'))]); return true; };
      W.fitPage = function (th) { calls.push(['page', th && th.getAttribute('data-colname'), !!(th && th.closest('#groupedResultsContainer'))]); return true; };
      $('#expandAllGroups').trigger('click'); await sleep(300);
      var band = tops()[0].querySelector(':scope > .group-header');
      closeMenu(); rclick(band); await sleep(200);
      var a = acts(), m = menu();
      R.info.acts = a;
      // the last two, after a rule of their own
      var fa = itemOf('gFitAll'), fp = itemOf('gFitPage');
      var prev = fa ? fa.previousElementSibling : null;
      R.chk.bandItems = a.slice(-2).join() === 'gFitAll,gFitPage' || (a.indexOf('gFitPage') === a.indexOf('gFitAll') + 1 && a.indexOf('gFitAll') > a.indexOf('gCollapseAll'));
      R.chk.bandRule = !!prev && prev.classList.contains('pnb-hm-sep');
      R.chk.bandLabels = !!fa && !!fp && fa.querySelector('.pnb-hm-label').textContent === 'Fit all column widths to contents' && fp.querySelector('.pnb-hm-label').textContent === 'Fit all column widths to page';
      if (fa) fa.click();
      await sleep(250);
      closeMenu(); rclick(band); await sleep(200);
      if (itemOf('gFitPage')) itemOf('gFitPage').click();
      await sleep(250);
      R.info.calls = calls;
      R.chk.bandRuns = calls.length === 2 && calls[0][0] === 'all' && calls[1][0] === 'page' && calls[0][2] === true && calls[1][2] === true;
      // every group folded: nothing to measure, no items
      closeMenu();
      $('#collapseAllGroups').trigger('click'); await sleep(300);
      rclick(tops()[0].querySelector(':scope > .group-header')); await sleep(200);
      R.info.foldedActs = acts();
      R.chk.bandFolded = !!menu() && acts().indexOf('gFitAll') < 0 && acts().indexOf('gToggle') >= 0;
      closeMenu();
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('no scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = (window.__errors || []).concat(window.__rejections || []).slice(0, 10);
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
