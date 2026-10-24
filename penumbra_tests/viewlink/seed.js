// viewlink: what the viewer had saved before opening the page (runs after the harness's
// localStorage.clear(), before main.js). vwins / vwinsc: their own column layout for lrfix -
// three columns, two frozen, V_NAME 333px wide, V_AMOUNT shown as a whole number.
(function () {
  var S = window.__SCN;
  // console errors, for a scenario's diagnostics
  window.__cerr = [];
  var _ce = console.error; console.error = function () { try { window.__cerr.push(Array.prototype.map.call(arguments, function (x) { return String(x && x.stack || x); }).join(' ').slice(0, 400)); } catch (e) { } return _ce.apply(console, arguments); };
  if (/^vwins/.test(S)) {
    var entry = {
      order: ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE'],
      visible: ['V_ID', 'V_NAME', 'V_AMOUNT'],
      isNumVisible: true,
      frozen: 2,
      widths: { V_NAME: 333 },
      colopt: { V_AMOUNT: { fmt: 'number:0' } }
    };
    var all = { lrfix: entry, otherreport: { visible: ['A'], order: ['A'] } };
    window.__SEEDED = JSON.stringify(all);
    localStorage.setItem('penumbra_column_prefs', window.__SEEDED);
  }
  // vccA: the viewer's own calculated column on lrfix (the report carries TRIPLE itself)
  if (S === 'vccA') {
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ lrfix: [{ name: 'DOUBLE', formula: '{H_NUM} * 2', format: 'number' }] }));
  }
})();
