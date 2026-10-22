// pvfix suite - page half (2026-10-20 d): the pivot's right-click menu and a two-sided Color
// scale, on the REAL main.js, js/penumbra_colmenu.js and js/penumbra_colfmt.js (mk_harness.py).
//   pfmenu  Amt (sum) and Chg (its % change) under each V_STATUS: every value cell carries its
//           value's index; a Chg heading offers Shading, Format and Highlight; a heading over
//           both values offers none; Highlight... opens the rule editor beside the heading, a
//           rule typed in rebuilds the pivot ONCE (the typing paused) and colors Amt's cells,
//           the editor stays open, Reset takes the rules off; Chg's own Color scale
//   pfneg   Amt shaded both ways from zero over lopsided values (North x1000, West negated):
//           each side by rank - the farthest negative the far color, the positives spread, the
//           largest the brand color; the engine's rankSides on vectors (+ the email's twin,
//           test_pvfix.php, from R.info.vec)
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  function bodyCells() { return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody td'), function (td) { return !td.hasAttribute('data-row-field') && !td.hasAttribute('data-grand-total'); }); }
  function valCells() { return bodyCells().filter(function (td) { return td.hasAttribute('data-pv-ai') || td.hasAttribute('data-agg-idx'); }); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]').length > 0; }, 20000))) throw new Error('no pivot value cells');
    await sleep(600);
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function P() { return window.Penumbra && window.Penumbra.pivotMenu; }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function panelsAll() { return Array.prototype.slice.call(document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function item(act) { var ps = panelsAll(); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function txt(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .col-sort-icon, .sort-rank, .pivot-collapse-toggle, button'), function (n) { n.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function heads() { return Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable thead th')); }
  function head(t) { return heads().filter(function (h) { return !h.hasAttribute('data-row-field') && !h.classList.contains('pivot-grand-total') && txt(h) === t; })[0] || null; }
  function popover() { return document.querySelector('.sp-sumtype-menu.pnb-colopt'); }
  function hlEd() { var p = popover(); return p ? p.querySelector('.pnb-hl-ed') : null; }
  function hlQ(sel) { var e = hlEd(); return e ? e.querySelector(sel) : null; }
  function q2(sel) { var p = popover(); return p ? p.querySelector(sel) : null; }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function setInput(el, v) { el.value = v; fire(el, 'input'); }
  function num(td) { var t = String(td.textContent || '').replace(/[\s$,%]/g, ''), neg = /^\(.*\)$/.test(t); t = t.replace(/[()]/g, ''); var v = parseFloat(t); return isFinite(v) ? (neg ? -v : v) : null; }
  function probe(css, prop) { var d = document.createElement('div'); d.style.cssText = css; document.body.appendChild(d); var v = getComputedStyle(d)[prop]; d.remove(); return v; }
  function hexOf(td) { var m = /background-color:\s*(#[0-9a-fA-F]{6})/.exec(td.getAttribute('style') || ''); return m ? m[1].toLowerCase() : null; }
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function dist(a, b) { var x = rgb(a), y = rgb(b); return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)); }
  function underHeads() {
    var t = document.getElementById('pivotResultTable'), hr = t.tHead.rows, last = hr[hr.length - 1];
    var vh = Array.prototype.filter.call(last.cells, function (c) { return !c.hasAttribute('data-row-field'); }), K = vh.length, out = [];
    Array.prototype.forEach.call(t.tBodies[0].rows, function (tr) {
      var L = tr.cells.length - K;
      if (L < 0) return;
      for (var j = 0; j < K; j++) {
        var td = tr.cells[L + j];
        if (!vh[j].classList.contains('pivot-grand-total') && td && !td.hasAttribute('data-row-field')) out.push({ td: td, head: txt(vh[j]) });
      }
    });
    return out;
  }
  function cellsOf(h) { return underHeads().filter(function (x) { return x.head === h; }).map(function (x) { return x.td; }); }
  function cssHex(css) { var m = /background-color:(#[0-9a-fA-F]{6})/.exec(css || ''); return m ? m[1].toLowerCase() : null; }

  var S = {
    pfmenu: async function () {
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      await step('index', async function () {
        // the cells under the value headings - by position from the right, as the menu takes
        // them - but a Grand Total column's (no heading of a value: the menu offers it none)
        var vc = underHeads().map(function (x) { return x.td; });
        var withAi = vc.filter(function (td) { return td.hasAttribute('data-pv-ai'); });
        var chg = vc.filter(function (td) { return td.getAttribute('data-pv-ai') === '1'; });
        R.chk.pvAi = vc.length > 0 && withAi.length === vc.length && chg.length > 0 && chg.every(function (td) { return !td.hasAttribute('data-agg-idx'); })
          && vc.filter(function (td) { return td.getAttribute('data-pv-ai') === '0'; }).every(function (td) { return td.getAttribute('data-agg-idx') === '0'; });
        R.info.pvAi = { cells: vc.length, withAi: withAi.length, chg: chg.length };
      });
      await step('items', async function () {
        closeMenu(); rclick(head('Chg'));
        var a1 = acts();
        R.chk.chgItems = ['pvShade', 'pvFormat', 'pvHighlight'].every(function (x) { return a1.indexOf(x) >= 0; });
        closeMenu(); rclick(head('Open'));
        var a2 = acts();
        R.chk.spanItems = a2.length > 0 && ['pvShade', 'pvFormat', 'pvHighlight'].every(function (x) { return a2.indexOf(x) < 0; });
        closeMenu(); rclick(head('Amt'));
        var a3 = acts();
        R.chk.amtItems = ['pvShade', 'pvFormat', 'pvHighlight'].every(function (x) { return a3.indexOf(x) >= 0; }) && a3.indexOf('pvHighlight') > a3.indexOf('pvFormat');
        R.info.acts = { chg: a1, span: a2, amt: a3 };
      });
      var h0 = 0, rebuilds = -1;
      await step('open', async function () {
        var it = item('pvHighlight');
        if (!it) return;
        it.click();
        await until(function () { return !!popover(); }, 2000);
        var p = popover();
        R.chk.hlOpens = !!p && !!p.querySelector('[data-sec="highlight"] [data-co="hl-add"]') && !p.querySelector('[data-sec="format"]') && !p.querySelector('[data-sec="shade"]')
          && /Amt/.test((p.querySelector('.pnb-colopt-title') || {}).textContent || '') && !menu();
      });
      await step('add', async function () {
        var add = q2('[data-co="hl-add"]');
        if (!add) return;
        add.click();
        await sleep(120);
        var v = hlQ('[data-co="hl-v"]'), cs = hlQ('[data-co="hl-col"]'), os = hlQ('[data-co="hl-op"]');
        R.info.ed = { col: cs && cs.value, op: os && os.value };
        if (!v) return;
        // a threshold between the Amt cells: their median, typed a digit at a time (every prefix
        // is a value that reads)
        var nums0 = cellsOf('Amt').map(num).filter(function (n) { return n !== null; }).sort(function (a, b) { return a - b; });
        var T = String(Math.round(nums0[(nums0.length - 1) >> 1] || 0));
        h0 = window.__HC_HIDES || 0;
        // the rebuilds ASKED for (Generate itself folds a burst of clicks into one build)
        var M = window.Penumbra.pivotMenu, orig = M.rebuild, asked = 0;
        M.rebuild = function () { asked++; return orig.apply(this, arguments); };
        // 400 ms apart: past the editor's own 300 ms pause, so each prefix is handed over - only
        // the menu's wait (600 ms) folds them into one rebuild
        for (var k = 1; k <= T.length; k++) { setInput(v, T.slice(0, k)); if (k < T.length) await sleep(400); }
        await until(function () { return (window.__HC_HIDES || 0) > h0; }, 5000);
        await sleep(1500);
        rebuilds = (window.__HC_HIDES || 0) - h0;
        M.rebuild = orig;
        var s = P().settings(), hl = s && s.aggHighlight, TV = Number(T);
        R.chk.hlStored = !!hl && Array.isArray(hl[0]) && hl[0].length === 1 && hl[0][0].w === 'Amt > ' + T && /pnb-hl-amber/.test(hl[0][0].css) && !hl[1];
        R.chk.hlDebounced = asked === 1 && rebuilds >= 1 && T.length >= 2;
        var amt = cellsOf('Amt'), chg = cellsOf('Chg');
        var on = amt.filter(function (td) { return num(td) > TV; }), off = amt.filter(function (td) { var n = num(td); return n !== null && n <= TV; });
        R.chk.hlDrawn = on.length > 0 && off.length > 0 && on.every(function (td) { return getComputedStyle(td).backgroundColor === amber; })
          && off.every(function (td) { return getComputedStyle(td).backgroundColor !== amber; }) && chg.every(function (td) { return getComputedStyle(td).backgroundColor !== amber; });
        R.chk.hlStaysOpen = !!popover() && popover().isConnected;
        R.info.add = { T: T, asked: asked, rebuilds: rebuilds, hl: hl, on: on.length, off: off.length };
      });
      await step('reset', async function () {
        var d = hlQ('[data-co="hl-done"]');
        if (d) { d.click(); await sleep(150); }
        var rs = q2('.pnb-colopt-reset');
        if (!rs) return;
        var h1 = window.__HC_HIDES || 0;
        rs.click();
        await until(function () { return (window.__HC_HIDES || 0) > h1; }, 5000);
        await sleep(800);
        var s = P().settings();
        R.chk.hlReset = !(s && s.aggHighlight) && bodyCells().every(function (td) { return getComputedStyle(td).backgroundColor !== amber; });
        R.info.reset = { hl: s && s.aggHighlight };
      });
      await step('chgShade', async function () {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await sleep(100);
        closeMenu(); rclick(head('Chg'));
        var sh = item('pvShade');
        if (!sh) return;
        sh.click(); await sleep(250);
        var sc = item('pvShade-scale');
        if (!sc) return;
        var h2 = window.__HC_HIDES || 0;
        sc.click();
        await until(function () { return (window.__HC_HIDES || 0) > h2; }, 8000);
        await sleep(600);
        var s = P().settings();
        var chg = cellsOf('Chg').filter(function (td) { return num(td) !== null; });
        var amt = cellsOf('Amt');
        R.chk.chgShade = !!s && Array.isArray(s.aggShade) && s.aggShade[1] === 'scale' && !s.aggShade[0]
          && chg.length > 0 && chg.some(function (td) { return !!hexOf(td); }) && amt.every(function (td) { return !hexOf(td); });
        R.info.chgShade = { shade: s && s.aggShade, chg: chg.length, filled: chg.filter(function (td) { return !!hexOf(td); }).length };
      });
      // (pvfix 2) Back from the Highlight card: at once with no change; after a change still in its pause,
      // the change made, the pivot rebuilt once, the menu on the rebuilt table's heading
      await step('backPlain', async function () {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        closeMenu(); rclick(head('Amt'));
        var it = item('pvHighlight');
        if (!it) return;
        it.click();
        await until(function () { return !!popover(); }, 2000);
        var bk = q2('[data-co="back"]');
        if (!bk) return;
        bk.click();
        await until(function () { return !!menu(); }, 3000);
        R.chk.backPlain = !popover() && !!menu() && menu().getAttribute('aria-label') === 'Amt';
        closeMenu();
      });
      await step('backBtn', async function () {
        closeMenu(); rclick(head('Amt'));
        var it = item('pvHighlight');
        if (!it) return;
        it.click();
        await until(function () { return !!popover(); }, 2000);
        var add = q2('[data-co="hl-add"]');
        if (!add) return;
        add.click();
        await sleep(120);
        var v = hlQ('[data-co="hl-v"]');
        if (!v) return;
        var M = window.Penumbra.pivotMenu, orig = M.rebuild, asked = 0;
        M.rebuild = function () { asked++; return orig.apply(this, arguments); };
        var tb0 = document.getElementById('pivotResultTable');
        v.focus(); setInput(v, '1000');
        var bk = q2('[data-co="back"]');
        if (bk) bk.click();   // inside the editor's own pause: nothing handed over yet
        await until(function () { return document.getElementById('pivotResultTable') !== tb0 && !!menu(); }, 10000);
        await sleep(400);
        M.rebuild = orig;
        var s = P().settings(), hl = s && s.aggHighlight, h = head('Amt');
        R.chk.backBtn = asked === 1 && !popover() && !!menu() && menu().getAttribute('aria-label') === 'Amt'
          && document.getElementById('pivotResultTable') !== tb0 && !!h && h.classList.contains('pnb-hm-for')
          && !!hl && Array.isArray(hl[0]) && hl[0].length === 1 && hl[0][0].w === 'Amt > 1000';
        R.info.backBtn = { asked: asked, rebuilt: document.getElementById('pivotResultTable') !== tb0, menu: menu() ? menu().getAttribute('aria-label') : null, hl: hl, onHead: !!h && h.classList.contains('pnb-hm-for') };
        closeMenu();
      });
      // (pvfix 2) a % change cell's menu: copy and filter (its row and its column's data-pv-ck). (2026-10-21, brk)
      // and its breakdown since - the cells it is computed from: the pvdrv suite's checks
      await step('chgCell', async function () {
        var cells = cellsOf('Chg').filter(function (td) { return td.hasAttribute('data-pv-ck'); });
        var td = cells[cells.length > 3 ? 3 : 0];
        if (!td) return;
        closeMenu(); rclick(td);
        var a = acts(), ttl = menu() ? menu().getAttribute('aria-label') : '';
        var rk = td.parentNode.getAttribute('data-pivot-row'), ck = td.getAttribute('data-pv-ck');
        R.chk.chgCellMenu = !!menu() && a.indexOf('pvCopy') >= 0 && a.indexOf('pvCellFilter') >= 0
          && /row and column/.test((item('pvCellFilter') || {}).textContent || '') && !!rk && !!ck && ttl.indexOf(' / ') > 0;
        R.info.chgCell = { acts: a, title: ttl, rk: rk, ck: ck };
        var f = item('pvCellFilter');
        if (!f) return;
        f.click();
        function left() {
          return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (x) {
            return !x.classList.contains('pivot-grand-total') && x.parentNode.style.display !== 'none';
          });
        }
        await until(function () { var v = left(); return v.length > 0 && v.every(function (x) { return x.getAttribute('data-row-key') === rk && x.getAttribute('data-col-key') === ck; }); }, 20000);
        var lf = left(), sv = document.getElementById('tableSearch').value;
        R.chk.chgCellFilter = lf.length > 0 && lf.every(function (x) { return x.getAttribute('data-row-key') === rk && x.getAttribute('data-col-key') === ck; })
          && /H_GROUP/i.test(sv) && /V_STATUS/i.test(sv);
        R.info.chgFilter = { left: lf.length, search: sv };
      });
    },

    pfneg: async function () {
      var H = window.PenumbraHeat;
      // the scale's three anchors in this theme: the far negative, the middle, the far positive
      var lin = H.colorizer(H.domainFrom([-1, 0, 1], null, '0'), { ramp: 'diverging', curve: 'linear', mode: 'fill', text: 'keep' });
      var NEG = cssHex(lin(-1)), MID = cssHex(lin(0)), POS = cssHex(lin(1));
      await step('cells', async function () {
        var amt = cellsOf('Amt').filter(function (td) { return num(td) !== null; });
        var byCol = {};
        amt.forEach(function (td) { var k = td.getAttribute('data-col-key') || '?'; (byCol[k] = byCol[k] || []).push(td); });
        var keys = Object.keys(byCol), negOk = true, spreadOk = true, topOk = true, orderOk = true, info = [], compared = 0;
        R.chk.negBuilt = amt.some(function (td) { return num(td) < 0; }) && keys.length >= 2;
        keys.forEach(function (k) {
          var cs = byCol[k], neg = cs.filter(function (td) { return num(td) < 0; }), pos = cs.filter(function (td) { return num(td) > 0; });
          pos.sort(function (a, b) { return num(a) - num(b); });
          neg.sort(function (a, b) { return num(a) - num(b); });
          if (neg.length) { var dn = hexOf(neg[0]) ? dist(hexOf(neg[0]), MID) / dist(NEG, MID) : 0; if (!(dn >= 0.6)) negOk = false; info.push(k + ' neg ' + dn.toFixed(2)); }
          if (pos.length >= 3) {
            var med = pos[(pos.length - 1) >> 1], dm = hexOf(med) ? dist(hexOf(med), MID) / dist(POS, MID) : 0;
            if (!(dm >= 0.25)) spreadOk = false;
            if (hexOf(pos[pos.length - 1]) !== POS) topOk = false;
            compared++;
            for (var i = 1; i < pos.length; i++) if (num(pos[i]) > num(pos[i - 1]) && !(dist(hexOf(pos[i]) || MID, MID) > dist(hexOf(pos[i - 1]) || MID, MID))) orderOk = false;
            info.push(k + ' med ' + dm.toFixed(2) + ' top ' + hexOf(pos[pos.length - 1]));
          }
        });
        R.chk.negFar = negOk && keys.length > 0;
        R.chk.posSpread = spreadOk && keys.length > 0;
        R.chk.topFull = topOk && compared > 0;
        R.chk.posOrder = orderOk && compared > 0;
        R.info.cols = info;
        R.info.anchors = [NEG, MID, POS];
      });
      // the engine on vectors: rankSides colours each side by rank; without it, rank with a
      // middle stays the straight two-sided scale (a snippet's heatmap(curve=rank, mid=) unchanged)
      await step('engine', async function () {
        var vals = [-10, 1, 2, 2, 3, 100], dom = H.domainFrom(vals, null, '0');
        var rs = H.colorizer(dom, { ramp: 'diverging', curve: 'rank', rankSides: true, mode: 'fill', text: 'auto' });
        var nf = H.colorizer(dom, { ramp: 'diverging', curve: 'rank', mode: 'fill', text: 'auto' });
        var ref = H.colorizer(H.domainFrom([-1, 0, 1], null, '0'), { ramp: 'diverging', curve: 'linear', mode: 'fill', text: 'auto' });
        // positives 1, 2, 2, 3, 100: ranks 1/5, (2.5)/5 for the tie, 4/5, 5/5; the one negative 1
        R.chk.engRank = rs(1) === ref(0.2) && rs(2) === ref(0.5) && rs(3) === ref(0.8) && rs(100) === ref(1) && rs(-10) === ref(-1) && rs(0) === ref(0);
        R.chk.engNoFlag = nf(2) === ref(0.02) && nf(100) === ref(1) && nf(-10) === ref(-0.1);
        R.info.eng = { rs2: rs(2), want: ref(0.5), nf2: nf(2) };
        // vectors for the email's twin (test_pvfix.php): each value's css under rankSides
        var vecs = [];
        [[-10, 1, 2, 2, 3, 100], [-500, -400, -3, 0, 0, 7, 9, 12, 40000], [5, 6, 7, -1]].forEach(function (vs) {
          var d = H.domainFrom(vs, null, '0'), f = H.colorizer(d, { ramp: 'diverging', curve: 'rank', rankSides: true, mode: 'fill', text: 'auto' });
          vecs.push({ vals: vs, css: vs.map(function (v) { return f(v); }) });
        });
        R.info.vec = vecs;
      });
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
