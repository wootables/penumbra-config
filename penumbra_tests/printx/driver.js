// printx suite - page half (2026-10-10 print sweep). The REAL main.js + main.css;
// run.py switches the page to PRINT media (Emulation.setEmulatedMedia) once the
// driver says it is ready (window.__PX_READY), then the driver reads computed
// styles as they would print.
//   xflat   a flat table with a data bar + a color scale (&shade=), paged 200 of 300:
//           bars and fills print, plain cells white / black, auto layout, the help
//           icons and the chart cog gone, the stamp filled on beforeprint
//   pdark   the pivot in a dark theme (theme-charcoal-gold): the Grand Total label
//           cell prints light with black text; a canvas prints on the dark card
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
  }
  async function toPrint() {
    window.__PX_READY = true;
    if (!(await until(function () { return window.__PX_PRINT === true; }, 20000))) throw new Error('print media never set');
    await sleep(300);
  }
  function cellsOf(name) {
    var ths = Array.prototype.slice.call(document.querySelectorAll('#tableHeader th'));
    var i = ths.findIndex(function (t) { return t.dataset.colname === name; });
    return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr')).filter(function (tr) { return tr.style.display !== 'none'; })
      .map(function (tr) { return tr.children[i]; }).filter(Boolean);
  }
  function rgb(c) { var m = String(c).match(/\d+/g); return m ? m.slice(0, 3).join(',') : ''; }
  var S = {
    xflat: async function () {
      // the stamp, as beforeprint fills it (Ctrl+P and the dialog's Print alike)
      window.dispatchEvent(new Event('beforeprint'));
      var stamp = document.getElementById('pnbPrintStamp').textContent;
      R.chk.stampText = /^Printed /.test(stamp) && /200 of 300 rows \(this page only\)/.test(stamp);
      var stampScreen = getComputedStyle(document.getElementById('pnbPrintStamp')).display;
      await toPrint();
      var bar = cellsOf('V_AMOUNT').slice(0, 10), fill = cellsOf('H_NUM').slice(0, 10), plain = cellsOf('V_NAME').slice(0, 10);
      R.chk.barPrints = bar.length === 10 && bar.every(function (td) { return /linear-gradient/.test(getComputedStyle(td).backgroundImage); });
      R.chk.barExact = bar.length && getComputedStyle(bar[0]).printColorAdjust === 'exact';
      R.chk.fillPrints = fill.length > 0 && fill.some(function (td) { return /background-color/.test(td.getAttribute('style') || '') && rgb(getComputedStyle(td).backgroundColor) !== '255,255,255'; });
      R.chk.plainWhite = plain.every(function (td) { var cs = getComputedStyle(td); return rgb(cs.backgroundColor) === '255,255,255' && rgb(cs.color) === '0,0,0'; });
      R.chk.autoLayout = getComputedStyle(document.getElementById('resultsTable')).tableLayout === 'auto';
      R.chk.iconsGone = ['pxHelp', 'searchHelpIcon', 'pxCog'].every(function (id) { return getComputedStyle(document.getElementById(id)).display === 'none'; });
      R.chk.stampShown = stampScreen === 'none' && getComputedStyle(document.getElementById('pnbPrintStamp')).display === 'block';
      R.chk.headerGrey = rgb(getComputedStyle(document.querySelector('#tableHeader th[data-colname="V_NAME"]')).backgroundColor) === '240,240,240';
      R.info = { stamp: stamp, bar0: bar[0] && getComputedStyle(bar[0]).backgroundImage.slice(0, 90), pca: bar[0] && getComputedStyle(bar[0]).printColorAdjust };
    },
    pdark: async function () {
      document.body.classList.add('is-dark', 'theme-charcoal-gold');
      await sleep(200);
      await toPrint();
      var gt = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable td, #pivotResultTable th')).filter(function (x) { return /^Grand Total$/i.test(x.textContent.trim()); })[0];
      var cs = gt && getComputedStyle(gt);
      R.chk.gtLabel = !!gt && ['255,255,255', '238,238,238'].indexOf(rgb(cs.backgroundColor)) !== -1 && rgb(cs.color) === '0,0,0';
      var cv = getComputedStyle(document.getElementById('pxCanvas'));
      R.chk.canvasCard = rgb(cv.backgroundColor) !== '' && rgb(cv.backgroundColor) !== '255,255,255' && cv.backgroundColor !== 'rgba(0, 0, 0, 0)' && cv.printColorAdjust === 'exact';
      var cells = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable tbody td')).slice(0, 12);
      R.chk.darkCellsWhite = cells.length > 0 && cells.every(function (td) { var c = getComputedStyle(td); return (/background-color/.test(td.getAttribute('style') || '')) || (rgb(c.backgroundColor) === '255,255,255' && rgb(c.color) === '0,0,0'); });
      R.info = { gt: gt && { tag: gt.tagName, cls: String(gt.className), bg: cs.backgroundColor, color: cs.color }, canvas: cv.backgroundColor };
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
