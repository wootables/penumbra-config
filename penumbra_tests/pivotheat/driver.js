// pivotheat suite - page half (2026-10-10). The REAL main.js on the saveconf
// fixture (the shade suite's harness), the report's pivot (H_GROUP > H_GROUP2 down,
// V_STATUS across, sum of H_AMT) with a heatmap() from the report snippet, and a
// THEME SWITCH made the way the Settings panel makes one (#spThemeSelector).
//   pbar   heatmap(pivot, style=bar): after the switch to a dark theme every bar is
//          re-tinted for the dark text (AA), and back on light it is the light tint again
//   pfill  heatmap(pivot): the fills follow the theme; every cell keeps AA text
//   pfmt   + format(cell, Amt, Amt > 0, 'color: #008000'): the format() colour still
//          wins after the recolour (the fill under it changes)
//   plazy  a Collapsible pivot built on demand: rows built AFTER the switch carry the
//          new theme's bars, like the recoloured ones
//   plain  no heat: no registry attribute on the table, nothing recoloured
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1 && document.querySelector('#pivotResultTable tbody td'); }, 150000))) throw new Error('boot: no pivot');
    await sleep(700);
  }
  function parseColor(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (m) { var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    return null;
  }
  function lum(c) { function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b); }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function key(c) { return c ? c.r + ',' + c.g + ',' + c.b : 'none'; }
  // the pivot's heat cells, shown, with their bar / fill colour and their text colour
  function heatCells() {
    var tds = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable tbody td[style]'));
    return tds.filter(function (td) { return td.offsetParent !== null && (td.style.backgroundImage || td.style.backgroundColor); }).map(function (td) {
      var cs = getComputedStyle(td);
      return { td: td, bar: parseColor(cs.backgroundImage), fill: td.style.backgroundColor ? parseColor(cs.backgroundColor) : null, text: parseColor(cs.color) };
    });
  }
  // the colour the TEXT sits on: the bar's tint for a bar, the fill for a fill
  function under(c) { return c.bar || c.fill; }
  function worst(cells) {
    var w = Infinity, at = null;
    cells.forEach(function (c) { var u = under(c); if (!u || !c.text) return; var r = ratio(u, c.text); if (r < w) { w = r; at = key(u) + ' / ' + key(c.text); } });
    return { ratio: w === Infinity ? 0 : Math.round(w * 100) / 100, at: at };
  }
  function lens(c) { return (c.td.style.backgroundImage.match(/[\d.]+%/g) || []).join(); }
  function tints(cells) { var s = {}; cells.forEach(function (c) { s[key(under(c))] = 1; }); return Object.keys(s).sort(); }
  async function switchTheme(id) {
    window.PENUMBRA_THEMES['theme-dark-blue'] = { id: 'theme-dark-blue', label: 'Dark Blue', isDark: true, modern: true };
    var sel = document.getElementById('spThemeSelector');
    if (!sel.querySelector('option[value="' + id + '"]')) { var o = document.createElement('option'); o.value = id; o.textContent = id; sel.appendChild(o); }
    jQuery(sel).val(id).trigger('change');
    await sleep(600);
  }

  async function switchDensity(id) {
    var sel = document.getElementById('spDensitySelector');
    if (!sel.querySelector('option[value="' + id + '"]')) { var o = document.createElement('option'); o.value = id; o.textContent = id; sel.appendChild(o); }
    jQuery(sel).val(id).trigger('change');
    await sleep(900);   // applyDensity's own 100 ms, then the snippet re-render
  }

  var SC = {
    // A DENSITY switch the way the Settings panel makes one (#spDensitySelector -> applyDensity,
    // whose snippet re-render runs 100 ms later): no rebuild of the pivot, its groups as they were.
    pdens: async function () {
      await boot();
      // close the first group: a rebuild would open it again (startExpanded)
      var tg = document.querySelector('#pivotResultTable .pivot-collapse-toggle');
      if (tg) jQuery(tg).trigger('click');
      await sleep(400);
      var shown = function () { return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (r) { return r.style.display !== 'none'; }).length; };
      var t0 = document.getElementById('pivotResultTable'); t0.__mark = 1;
      var g0 = window.__GEN || 0, rows0 = shown(), heat0 = heatCells().length;
      await switchDensity('compact');
      var t1 = document.getElementById('pivotResultTable');
      R.info.dens = { sameTable: !!(t1 && t1.__mark), builds: (window.__GEN || 0) - g0, rows0: rows0, rows1: shown(), heat0: heat0, heat1: heatCells().length, body: document.body.className };
      R.chk.densityApplied = /density-compact/.test(document.body.className);
      R.chk.noRebuild = !!(t1 && t1.__mark) && (window.__GEN || 0) === g0;
      R.chk.groupsKept = !!tg && shown() === rows0 && heatCells().length === heat0;
    },
    fdens: async function () {
      if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1 && document.querySelector('#resultsTable tbody td[style*="background-image"]'); }, 150000))) throw new Error('boot: no bars');
      await sleep(700);
      var nBars = function () { return document.querySelectorAll('#resultsTable tbody td[style*="background-image"]').length; };
      var b0 = nBars(), cf0 = window.__CF || 0;
      await switchDensity('compact');
      R.info.flat = { passes: (window.__CF || 0) - cf0, bars0: b0, bars1: nBars() };
      R.chk.densityApplied = /density-compact/.test(document.body.className);
      // a density switch changes no colour and no rule: NO formatting pass (was the snippet's full one)
      R.chk.noPass = ((window.__CF || 0) - cf0) === 0;
      R.chk.barsKept = b0 > 0 && nBars() === b0;
    },
    pkeep: async function () {
      await boot();
      var t0 = document.getElementById('pivotResultTable'); t0.__mark = 1;
      var g0 = window.__GEN || 0, c0 = heatCells();
      await switchTheme('theme-dark-blue');
      var t1 = document.getElementById('pivotResultTable'), c1 = heatCells();
      R.info.keep = { sameTable: !!(t1 && t1.__mark), builds: (window.__GEN || 0) - g0, light: tints(c0).slice(0, 3), dark: tints(c1).slice(0, 3), worst: worst(c1) };
      // the switch recolours the pivot it has; it does not build a new one
      R.chk.noRebuild = !!(t1 && t1.__mark) && (window.__GEN || 0) === g0;
      R.chk.recolored = c1.length === c0.length && c1.length > 0 && JSON.stringify(tints(c1)) !== JSON.stringify(tints(c0)) && worst(c1).ratio >= 4.5;
    },
    fbar: async function () {
      if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1 && document.querySelector('#resultsTable tbody td[style*="background-image"]'); }, 150000))) throw new Error('boot: no bars');
      await sleep(700);
      var bars = function () { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody td[style*="background-image"]')).filter(function (td) { return td.parentNode.style.display !== 'none'; })
        .map(function (td) { var cs = getComputedStyle(td); return { td: td, bar: parseColor(cs.backgroundImage), fill: null, text: parseColor(cs.color) }; }); };
      var b0 = bars();
      R.chk.bars = b0.length > 0;
      var cf0 = window.__CF || 0;
      await switchTheme('theme-dark-blue');
      var b1 = bars();
      R.info.flat = { passes: (window.__CF || 0) - cf0, n0: b0.length, n1: b1.length, worst: worst(b1) };
      // ONE formatting pass for the switch (the heat): not the heat pass AND the snippet's full pass
      R.chk.onePass = ((window.__CF || 0) - cf0) === 1;
      R.chk.darkAA = b1.length === b0.length && worst(b1).ratio >= 4.5;
    },
    pbar: async function () {
      await boot();
      var c0 = heatCells();
      R.info.light = { n: c0.length, worst: worst(c0), tints: tints(c0).slice(0, 4) };
      R.chk.lightAA = c0.length > 0 && c0.every(function (c) { return !!c.bar; }) && worst(c0).ratio >= 4.5;
      R.chk.registry = !!document.querySelector('#pivotResultTable[data-pnb-heat]');
      var len0 = c0.map(lens);
      await switchTheme('theme-dark-blue');
      var c1 = heatCells();
      R.info.dark = { n: c1.length, worst: worst(c1), tints: tints(c1).slice(0, 4) };
      R.chk.darkAA = c1.length === c0.length && worst(c1).ratio >= 4.5;
      R.chk.darkRetinted = JSON.stringify(tints(c1)) !== JSON.stringify(tints(c0));
      // the bar LENGTHS do not move: only the colour does
      R.chk.lengthsKept = JSON.stringify(c1.map(lens)) === JSON.stringify(len0);
      await switchTheme('theme-default');
      var c2 = heatCells();
      R.info.back = { n: c2.length, worst: worst(c2), tints: tints(c2).slice(0, 4) };
      R.chk.backSame = JSON.stringify(tints(c2)) === JSON.stringify(tints(c0)) && worst(c2).ratio >= 4.5;
    },
    pfill: async function () {
      await boot();
      var c0 = heatCells();
      R.info.light = { n: c0.length, worst: worst(c0), tints: tints(c0).slice(0, 4) };
      R.chk.lightAA = c0.length > 0 && worst(c0).ratio >= 4.5;
      await switchTheme('theme-dark-blue');
      var c1 = heatCells();
      R.info.dark = { n: c1.length, worst: worst(c1), tints: tints(c1).slice(0, 4) };
      R.chk.darkAA = c1.length === c0.length && worst(c1).ratio >= 4.5;
      R.chk.followsTheme = JSON.stringify(tints(c1)) !== JSON.stringify(tints(c0));
    },
    pfmt: async function () {
      await boot();
      var c0 = heatCells();
      var green = function (cs) { return cs.length > 0 && cs.every(function (c) { return key(c.text) === '0,128,0'; }); };
      R.info.light = { n: c0.length, texts: c0.slice(0, 3).map(function (c) { return key(c.text); }) };
      R.chk.formatAtRender = green(c0);
      await switchTheme('theme-dark-blue');
      var c1 = heatCells();
      R.info.dark = { n: c1.length, texts: c1.slice(0, 3).map(function (c) { return key(c.text); }), tints: tints(c1).slice(0, 3) };
      R.chk.formatStillWins = c1.length === c0.length && green(c1);
      R.chk.fillChanged = JSON.stringify(tints(c1)) !== JSON.stringify(tints(c0));
    },
    plazy: async function () {
      await boot();
      var t = document.getElementById('pivotResultTable');
      R.chk.isLazy = !!(t && t.getAttribute('data-pnb-lazy'));
      // open ONE group first: its rows are built now, in the LIGHT theme (the colorizers with them)
      var tg = document.querySelector('#pivotResultTable .pivot-collapse-toggle');
      if (tg) jQuery(tg).trigger('click');
      await sleep(400);
      var lightCells = heatCells();
      R.info.lightFirst = { n: lightCells.length, tints: tints(lightCells).slice(0, 3) };
      var before = document.querySelectorAll('#pivotResultTable tbody tr').length;
      await switchTheme('theme-dark-blue');
      var vis = heatCells();
      var darkTints = tints(vis);
      // build the rest of the rows now (Expand All), in the dark theme
      var b = document.createElement('button'); b.className = 'pivot-expand-all-btn'; document.body.appendChild(b);
      b.click();
      await sleep(500);
      var after = document.querySelectorAll('#pivotResultTable tbody tr').length;
      var all = heatCells();
      R.info.rows = { before: before, after: after, heatCells: all.length, darkTints: darkTints.slice(0, 4), allTints: tints(all).slice(0, 6) };
      R.chk.built = after > before;
      // built in the DARK theme: the dark text reads at AA on every bar (a light theme's bar under it reads ~1.7)
      R.chk.lateRowsDark = lightCells.length > 0 && all.length > vis.length && worst(all).ratio >= 4.5;
      R.info.worstLate = worst(all);
    },
    plain: async function () {
      await boot();
      R.chk.noRegistry = !document.querySelector('#pivotResultTable[data-pnb-heat]');
      R.chk.noHeat = heatCells().length === 0;
      await switchTheme('theme-dark-blue');
      R.chk.stillNoHeat = heatCells().length === 0;
    }
  };

  (async function () {
    try {
      var fn = SC[SCN];
      if (!fn) throw new Error('unknown scenario ' + SCN);
      await fn();
    } catch (e) { R.fatal = 'driver threw: ' + ((e && e.stack) || e); }
    R.errors = (window.__errors || []).concat(window.__rejections || []).slice(0, 8);
    R.hookErr = window.__HC_ERR || '';
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
