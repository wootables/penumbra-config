// pvshade suite - page half (2026-10-10). The REAL main.js; a saved pivot with two
// values (Amt = Sum, N = Count of H_AMT) whose first carries settings.aggShade.
//   pvbar    Amt's cells carry a data bar, N's none
//   pvscale  Amt's cells carry a fill, N's none
//   pvnone   no shading at all - and the builder's cog flow: a row with shading,
//            the getter, the menu, None
// pvsum 2026-10-11:
//   pvsum    a COLLAPSED three-field pivot: its two levels of group subtotal rows are
//            shaded, each level on its own scale, and the fill is what shows; a theme
//            recolour keeps them
//   pvlop    lopsided Amt colours by RANK, a run of $0 at the floor; plus the
//            lopsided / floor helpers on fixed vectors (the email's twin: run.py)
//   pvform   a one-sided formula's data bars start at 0, not mid-cell
// window.__HC.addAgg / .shades / .recolor / .regs = addAggregationRow /
// getAggregationShades / _pnbPivotHeatRecolor / _pnbPivotHeatRegs (run.py's hook).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]').length > 0; }, 20000))) throw new Error('no pivot value cells');
    await sleep(500);
  }
  // body value cells only: the Total column (td.pivot-grand-total) is never shaded; the
  // group subtotal rows have their own domains (sumCells, pvsum)
  function cells(i) { return Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-agg-idx="' + i + '"]:not(.pivot-grand-total)')); }
  function hasBar(td) { return /linear-gradient/.test(td.getAttribute('style') || ''); }
  function hasFill(td) { return /background-color/.test(td.getAttribute('style') || ''); }
  function lum(rgb) { return rgb.map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).reduce(function (t, c, i) { return t + c * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function cr(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function rgbOf(td) { var m = /background-color:\s*(?:#([0-9a-f]{6})|rgb\((\d+),\s*(\d+),\s*(\d+)\))/i.exec(td.getAttribute('style') || ''); if (!m) return null; return m[1] ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }) : [+m[2], +m[3], +m[4]]; }
  function num(td) { return parseFloat(td.textContent.replace(/[$,]/g, '')); }
  // a group subtotal row's value cells for value i at level lvl (its Total cells are never shaded)
  function sumCells(i, lvl) { return Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable tbody tr.pivot-group-summary-row[data-pivot-group-summary-level="' + lvl + '"] td[data-agg-idx="' + i + '"]:not(.pivot-grand-total)')); }
  // body value cells by POSITION (a formula cell carries no data-agg-idx: it never drills)
  function posCells(i, nAgg) {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row)'), function (tr) {
      Array.prototype.filter.call(tr.cells, function (td) { return !td.hasAttribute('data-row-field') && !td.classList.contains('pivot-grand-total'); })
        .forEach(function (td, k) { if (k % nAgg === i) out.push(td); });
    });
    return out;
  }
  function surface() { return window.PenumbraHeat.parseColor(window.PenumbraHeat.themeVar('--bg-surface', '#ffffff')) || [255, 255, 255]; }
  // per pivot column: the smallest value's fill near the floor, the largest's strong
  function spread(list, surf) {
    var byCol = {}, info = [];
    list.forEach(function (td) { var k = td.getAttribute('data-col-key'); (byCol[k] = byCol[k] || []).push(td); });
    var keys = Object.keys(byCol);
    var ok = keys.length >= 3 && keys.every(function (k) {
      var l = byCol[k].slice().sort(function (a, b) { return num(a) - num(b); });
      var lo = rgbOf(l[0]), hi = rgbOf(l[l.length - 1]);
      if (!lo || !hi) { info.push(k + ':nofill'); return false; }
      info.push(k + ':' + cr(lo, surf).toFixed(2) + '/' + cr(hi, surf).toFixed(2) + ' n' + l.length);
      return cr(lo, surf) <= 1.3 && cr(hi, surf) >= 3.5;
    });
    return { ok: ok, info: info };
  }
  // _pvLopsided / _pvRankFloor LIFTED from the main.js under test, on fixed vectors;
  // run.py hands the cases and answers to the email's twins (test_pvvec.php)
  var VEC = [
    { id: 'skew', doms: [[0, 1, 2, 3, 1000]], want: true },
    { id: 'even', doms: [[0, 25, 50, 75, 100]], want: false },
    { id: 'top', doms: [[0, 990, 995, 998, 1000]], want: true },
    { id: 'edge20', doms: [[0, 10, 20, 30, 100]], want: false },
    { id: 'edge19', doms: [[0, 10, 19, 30, 100]], want: true },
    { id: 'edge80', doms: [[0, 70, 80, 90, 100]], want: false },
    { id: 'edge81', doms: [[0, 70, 81, 90, 100]], want: true },
    { id: 'two', doms: [[0, 1, 1000], [5, 5, 6, 500]], want: true },
    { id: 'flat', doms: [[7, 7, 7]], want: false },
    { id: 'few', doms: [[1, 100]], want: false },
    { id: 'floor', doms: [[0, 0, 0, 5, 9]], want: true, sorted: [[0, 5, 9]] },
    { id: 'neg', doms: [[-50, -10, 0, 10, 50]], want: false },
    { id: 'dups', doms: [[3, 3, 3, 3]], want: false, sorted: [[3]] },
    { id: 'float', doms: [[0.1, 0.2, 0.30000000000000004, 1e9]], want: true }
  ];
  async function vectors() {
    try {
      var src = await (await fetch('main_hc.js', { cache: 'no-store' })).text();
      var lift = function (name) {
        var i = src.indexOf('function ' + name + '(');
        if (i < 0 || src.indexOf('function ' + name + '(', i + 1) !== -1) throw new Error('lift ' + name + ': not exactly once');
        var d = 0, k = src.indexOf('{', i);
        for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
        return (new Function('return ' + src.slice(i, k + 1)))();
      };
      var lop = lift('_pvLopsided'), floor = lift('_pvRankFloor');
      var out = VEC.map(function (c) {
        var doms = c.doms.map(function (vals) { return { ent: { dom: window.PenumbraHeat.domainFrom(vals, null, null) }, vals: vals }; });
        var l = lop(doms);
        doms.forEach(function (x) { floor(x.ent.dom); });
        return { id: c.id, lop: l, sorted: doms.map(function (x) { return x.ent.dom.sorted; }) };
      });
      return { cases: VEC, out: out };
    } catch (e) { return { err: String(e) }; }
  }
  var S = {
    pvbar: async function () {
      var a = cells(0), n = cells(1);
      R.chk.amtBars = a.length > 4 && a.filter(hasBar).length === a.filter(function (td) { var t = td.textContent.trim(); return t !== '' && !/^\$?0(\.0+)?$/.test(t); }).length;   // every non-zero value cell (zero draws none)
      R.chk.countPlain = n.length > 4 && n.every(function (td) { return !hasBar(td) && !hasFill(td); });
      R.chk.saved = JSON.stringify((window.__STORED.pivot || {}).aggShade) === '["bar",null]';
      var unb = a.filter(function (td) { return !hasBar(td); });
      R.info = { a: a.length, aBars: a.filter(hasBar).length, n: n.length, unbarred: unb.slice(0, 6).map(function (td) { return { t: td.textContent.trim(), row: td.parentNode.className, vis: td.parentNode.style.display, cls: td.className }; }),
        unbarredText: unb.map(function (td) { return td.textContent.trim(); }).filter(function (t) { return t !== '' && t !== '$0' && t !== '0'; }).length };
    },
    pvscale: async function () {
      var a = cells(0), n = cells(1);
      R.chk.amtFills = a.length > 4 && a.filter(hasFill).length === a.filter(function (td) { return td.textContent.trim() !== ''; }).length && !a.some(hasBar);
      R.chk.countPlain = n.length > 4 && n.every(function (td) { return !hasBar(td) && !hasFill(td); });
      // pvscale 2026-10-11: the scale runs the column's OWN min..max, so the ramp is USED -
      // some Amt cell sits at (near) its floor, the surface, and some at the top (>= 3.5:1
      // off the surface). The old log + 0: put the smallest at ~60% of the ramp: no cell
      // came near the floor. (Rows past the first page are in the domain but not drawn,
      // so this reads the drawn cells against the surface, not a column's own pair.)
      var surf = window.PenumbraHeat.parseColor(window.PenumbraHeat.themeVar('--bg-surface', '#ffffff')) || [255, 255, 255];
      var vsSurf = a.map(rgbOf).filter(Boolean).map(function (rgb) { return cr(rgb, surf); });
      var lo = Math.min.apply(null, vsSurf), hi = Math.max.apply(null, vsSurf);
      R.chk.spread = vsSurf.length > 4 && lo <= 1.3 && hi >= 3.5;
      R.info = { a: a.length, aFills: a.filter(hasFill).length, nearestFloor: lo.toFixed(2), top: hi.toFixed(2) };
    },
    pvnone: async function () {
      R.chk.nothing = cells(0).concat(cells(1)).every(function (td) { return !hasBar(td) && !hasFill(td); });
      // the builder: a value row added with shading, the cog shows it, the getter returns it
      var body = document.getElementById('pivot-agg-table-body');
      body.innerHTML = '';
      window.__HC.addAgg('sum', 'H_AMT', null, null, null, 'bar');
      window.__HC.addAgg('count', 'H_AMT', null, null, null, null);
      var cog0 = body.querySelectorAll('tr')[0].querySelector('td.pat-cell-opt'), cog1 = body.querySelectorAll('tr')[1].querySelector('td.pat-cell-opt');
      R.chk.cogShows = !!cog0 && cog0.classList.contains('is-set') && /BAR/.test(cog0.textContent) && !!cog1 && !cog1.classList.contains('is-set');
      R.chk.getter = JSON.stringify(window.__HC.shades()) === '["bar",null]';
      cog1.click();
      var menu = document.querySelector('.pnb-pvshade-menu');
      R.chk.menu = !!menu && menu.querySelectorAll('.pnb-pvshade-opt').length === 3 && !!menu.querySelector('.pnb-pvshade-opt.is-current[data-shade=""]');
      if (menu) menu.querySelector('.pnb-pvshade-opt[data-shade="scale"]').click();
      await sleep(100);
      R.chk.pickSets = JSON.stringify(window.__HC.shades()) === '["bar","scale"]' && !document.querySelector('.pnb-pvshade-menu')
        && body.querySelectorAll('tr')[1].querySelector('td.pat-cell-opt').classList.contains('is-set');
      body.querySelectorAll('tr')[0].querySelector('td.pat-cell-opt').click();
      var m2 = document.querySelector('.pnb-pvshade-menu');
      if (m2) m2.querySelector('.pnb-pvshade-opt[data-shade=""]').click();
      await sleep(100);
      R.chk.noneClears = JSON.stringify(window.__HC.shades()) === '[null,"scale"]';
      body.querySelectorAll('tr')[1].querySelector('td.pat-cell-opt').click();
      var m3 = document.querySelector('.pnb-pvshade-menu');
      if (m3) m3.querySelector('.pnb-pvshade-opt[data-shade=""]').click();
      await sleep(100);
      R.chk.allNoneIsNull = window.__HC.shades() === null;
      R.info = { shades: window.__HC.shades() };
    },
    pvsum: async function () {
      var surf = surface();
      var amt = [0, 1].map(function (l) { return sumCells(0, l).filter(function (td) { return td.textContent.trim() !== ''; }); });
      var n = [0, 1].map(function (l) { return sumCells(1, l).filter(function (td) { var t = td.textContent.trim(); return t !== '' && t !== '0'; }); });
      // every subtotal Amt cell is filled, with the class that lifts the row's !important surface
      R.chk.sumFills = amt[0].length >= 12 && amt[1].length >= 36 && amt[0].concat(amt[1]).every(function (td) { return hasFill(td) && td.classList.contains('pnb-heat-fill') && !hasBar(td); });
      // ...and every N one carries a bar (no class: the row's own background shows around a bar)
      R.chk.sumBars = n[0].length >= 12 && n[1].length >= 36 && n[0].concat(n[1]).every(function (td) { return hasBar(td) && !td.classList.contains('pnb-heat-fill'); });
      // the fill is what SHOWS on the collapsed pivot: the computed background is the inline
      // fill, while a label cell of the same row keeps the opaque surface-alt
      var shown = amt[0].filter(function (td) { return td.offsetParent !== null; });
      var alt = window.PenumbraHeat.parseColor(window.PenumbraHeat.themeVar('--bg-surface-alt', '#eaeaea'));
      var lab = shown.length ? shown[0].parentNode.querySelector('td[data-row-field]') : null;
      var labBg = lab ? window.PenumbraHeat.parseColor(getComputedStyle(lab).backgroundColor) : null;
      var visBody = document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row)');
      R.chk.sumShown = shown.length >= 12 && shown.every(function (td) { return getComputedStyle(td).backgroundColor === td.style.backgroundColor; })
        && JSON.stringify(labBg) === JSON.stringify(alt)
        && Array.prototype.every.call(visBody, function (tr) { return tr.offsetParent === null; });   // collapsed: no body row shows
      // each LEVEL on its own scale, per pivot column: its smallest near the floor, its largest strong
      var s0 = spread(amt[0], surf), s1 = spread(amt[1], surf);
      R.chk.sumSpread = s0.ok && s1.ok;
      // a theme recolour (here into the same theme) keeps every cell: a subtotal cell's style
      // is re-asked on ITS level's domain
      var regs = window.__HC.regs(), nSum = 0;
      Object.keys(regs).forEach(function (id) { regs[id].seen.forEach(function (rep) { if (rep[4] != null) nSum++; }); });
      var all = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable td'));
      var snap = function () { return all.map(function (td) { return td.style.backgroundColor + '|' + td.style.backgroundImage + '|' + td.style.color; }); };
      var before = snap();
      window.__HC.recolor();
      var after = snap(), changed = 0;
      for (var i = 0; i < before.length; i++) if (before[i] !== after[i]) changed++;
      R.chk.recolorKeeps = nSum > 0 && changed === 0;
      R.info = { amt: [amt[0].length, amt[1].length], n: [n[0].length, n[1].length], shown: shown.length, labBg: labBg, alt: alt, s0: s0.info, s1: s1.info, nSum: nSum, changed: changed,
        sample: shown.slice(0, 2).map(function (td) { return [td.getAttribute('style'), getComputedStyle(td).backgroundColor, td.className]; }) };
    },
    pvlop: async function () {
      var surf = surface();
      var a = cells(0).filter(function (td) { return td.textContent.trim() !== ''; });
      var zeros = a.filter(function (td) { return num(td) === 0; });
      var mid = a.filter(function (td) { var v = num(td); return v > 0 && v < 10000; });   // Central / [Blank]: hundreds, beside North's ~10^5
      // RANK: the cells a straight scale leaves at the floor (~1/1000 of North's) are tinted
      R.chk.rank = mid.length >= 12 && mid.every(function (td) { return !!rgbOf(td) && cr(rgbOf(td), surf) >= 1.1; });
      // a run of $0 ranks as ONE value, at the floor: bare surface, not a tint
      R.chk.floor = zeros.length >= 18 && zeros.every(function (td) { return !rgbOf(td) || cr(rgbOf(td), surf) <= 1.01; });
      // the subtotal rows decide for themselves the same way
      var s = sumCells(0, 0).filter(function (td) { var v = num(td); return v > 0 && v < 100000; });
      R.chk.sumRank = s.length >= 4 && s.every(function (td) { return !!rgbOf(td) && cr(rgbOf(td), surf) >= 1.1; });
      var v = await vectors();
      R.chk.vecWant = !v.err && v.out.every(function (o, i) { var c = VEC[i]; return o.lop === c.want && (!c.sorted || JSON.stringify(o.sorted) === JSON.stringify(c.sorted)); });
      R.info = { mid: mid.slice(0, 4).map(function (td) { return td.textContent.trim() + ' ' + (rgbOf(td) ? cr(rgbOf(td), surf).toFixed(2) : 'none'); }), nMid: mid.length,
        zeros: zeros.length, zeroBad: zeros.filter(function (td) { return rgbOf(td) && cr(rgbOf(td), surf) > 1.01; }).length,
        sum: s.map(function (td) { return td.textContent.trim() + ' ' + (rgbOf(td) ? cr(rgbOf(td), surf).toFixed(2) : 'none'); }), vec: v,
        vecBad: v.err ? v.err : v.out.filter(function (o, i) { return o.lop !== VEC[i].want; }).map(function (o) { return o.id; }) };
    },
    pvform: async function () {
      var f = posCells(2, 3).filter(function (td) { return td.textContent.trim() !== ''; });
      var bars = f.filter(hasBar);
      // a formula is ONE-sided: its bars grow from 0 at the cell's left edge
      R.chk.formBars = f.length > 12 && bars.length === f.filter(function (td) { return num(td) > 0; }).length
        && bars.every(function (td) { var st = td.getAttribute('style'); return /linear-gradient\(90deg,#[0-9a-f]{6} 0%,/.test(st) && st.indexOf('transparent 50%') === -1; });
      R.info = { f: f.length, bars: bars.length, sample: bars.slice(0, 2).map(function (td) { return td.textContent.trim() + ' ' + td.getAttribute('style'); }) };
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
