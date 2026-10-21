// hljournal suite - page half (2026-10-20 e, hl phase 4): highlight rules on the journal's columns.
// The REAL main.js, js/penumbra_colfmt.js and the journal's REAL painter (applyRowFeatures, through
// refreshJournalRowFeatures with the two state loaders stubbed) on the colmenu harness: a saved
// report keyed by V_ID, a toggle Done (key k1), Notes, the who / when columns.
//   hjunit  Basic's forms for a toggle and for Notes, written and read back (penumbra_colfmt.js)
//   hjtog   a toggle's cog has Highlight; the editor's choices; "is checked" on the whole row
//           drawn on the marked rows; a mark drawn again; a data column's rule naming Done; the
//           Save list names the column; a rename keeps the rules (filed under the internal name)
//   hjnotes Notes: "has notes" on its cell, "mentions" on the row; a new note drawn again
//   hjwho   Done by / Done on: text and day rules on their cells
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  var T = '__JOURNAL_TOGGLE__k1', N = '__JOURNAL_NOTES', BY = '__JOURNAL_BY__k1', ON = '__JOURNAL_ON__k1';
  function P() { return window.Penumbra; }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function popover() { return document.querySelector('.sp-sumtype-menu.pnb-colopt'); }
  function hlEd() { var p = popover(); return p ? p.querySelector('.pnb-hl-ed') : null; }
  function hlQ(sel) { var e = hlEd(); return e ? e.querySelector(sel) : null; }
  function q2(sel) { var p = popover(); return p ? p.querySelector(sel) : null; }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function setInput(el, v) { el.value = v; fire(el, 'input'); }
  function closeAll() { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
  function probe(css, prop) { var d = document.createElement('div'); d.style.cssText = css; document.body.appendChild(d); var v = getComputedStyle(d)[prop]; d.remove(); return v; }
  function rows() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return tr.offsetParent; }); }
  function keyOf(tr) { var b = tr.querySelector('.journal-notes-btn[data-row-key], .journal-toggle-box[data-row-key]'); return b ? b.getAttribute('data-row-key') : null; }
  function cellOf(tr, name) { return tr.querySelector(':scope > td[data-column="' + name + '"]'); }
  function colIdx(name) { var h = fth(name); return h ? Array.prototype.indexOf.call(h.parentNode.children, h) : -1; }
  function td(tr, name) { var i = colIdx(name); return i >= 0 ? tr.children[i] : null; }
  // the journal of a saved report: the key, Done, Notes (and the who / when columns), marks
  async function journal(opts) {
    opts = opts || {};
    var J = P();
    J.journalReportId = 'zzhl';
    window._penumbraJournalHidden = false;
    window._penumbraJournalKeyColumns = ['V_ID'];
    window._penumbraJournalToggles = [{ key: 'k1', label: opts.label || 'Done', oldLabels: opts.old || [] }];
    window._penumbraJournalRowNotes = true;
    window._penumbraJournalToggleWho = !!opts.who;
    window._penumbraToggleState = window._penumbraToggleState || { k1: {} };
    window._penumbraRowNoteCounts = window._penumbraRowNoteCounts || {};
    window._penumbraRowNotes = window._penumbraRowNotes || {};
    J.loadJournalToggles = function () { }; J.loadJournalRowNotes = function () { };
    if (J.journalMarkLoadedKey) J.journalMarkLoadedKey();
    J.refreshJournalRowFeatures();
    await until(function () { return !!fth(T) && !!fth(N) && (!opts.who || !!fth(BY)); }, 6000);
    await sleep(500);   // the highlight pass after the paint (120 ms) and its own work
  }
  function mark(k, by, at) { window._penumbraToggleState.k1[k] = { by: by || 'harness', at: at || '2026-10-15 09:30:00' }; }
  function note(k, text, n) {
    var counts = Object.assign({}, window._penumbraRowNoteCounts), notes = Object.assign({}, window._penumbraRowNotes);
    counts[k] = n || 1;
    notes[k] = [{ ID: 900 + Object.keys(notes).length, NOTE_TEXT: text }];
    window._penumbraRowNoteCounts = counts; window._penumbraRowNotes = notes;
  }
  async function redraw() { P().refreshJournalRowFeatures(); await sleep(600); }
  function openCog(name, title) { closeAll(); P().headerMenu.openColOpts(fth(name), name, title, false, null); return popover(); }
  async function addRule(fn) {
    var add = q2('[data-co="hl-add"]');
    if (!add) return false;
    add.click();
    await sleep(120);
    await fn();
    await sleep(700);   // the editor's pause (300 ms), the hand-over, the pass
    var d = hlQ('[data-co="hl-done"]');
    if (d) { d.click(); await sleep(100); }
    return true;
  }
  function pick(sel, v) { var e = hlQ(sel); if (!e) return false; e.value = v; fire(e, 'change'); return true; }

  var S = {
    hjunit: async function () {
      var F = window.PenumbraColFmt;
      function kf(c) { return c === 'Done' ? 'toggle' : c === 'Notes' ? 'notes' : 'text'; }
      function rt(o) { var w = F.hlWhen(o), p = F.hlWhenPicks(w, kf); return { w: w, p: p }; }
      var a = rt({ col: 'Done', op: 'checked', kind: 'toggle' }), b = rt({ col: 'Done', op: 'unchecked', kind: 'toggle' });
      R.chk.toggleForms = a.w === 'Done = ☑' && a.p && a.p.op === 'checked' && b.w === 'Done = ☐' && b.p && b.p.op === 'unchecked'
        && F.hlOps('toggle').map(function (o) { return o[0]; }).join() === 'checked,unchecked,always';
      var c = rt({ col: 'Notes', op: 'hasnotes', kind: 'notes' }), d = rt({ col: 'Notes', op: 'nonotes', kind: 'notes' });
      var e = rt({ col: 'Notes', op: 'morethan', v: '2', kind: 'notes' }), f = rt({ col: 'Notes', op: 'mentions', v: 'budget', kind: 'notes' });
      var g = rt({ col: 'Notes', op: 'mentions', v: 'sent to PI', kind: 'notes' }), h = rt({ col: 'Notes', op: 'mentions', v: '2024', kind: 'notes' });
      R.chk.notesForms = c.w === 'Notes > 0' && c.p.op === 'hasnotes' && d.w === 'Notes = empty' && d.p.op === 'nonotes'
        && e.w === 'Notes > 2' && e.p.op === 'morethan' && e.p.v === '2' && f.w === 'Notes contains budget' && f.p.op === 'mentions' && f.p.v === 'budget'
        && g.w === 'Notes = /sent to PI/' && g.p.op === 'mentions' && g.p.v === 'sent to PI' && h.w === 'Notes = /2024/' && h.p.v === '2024'
        && F.hlOps('notes').map(function (o) { return o[0]; }).join() === 'hasnotes,nonotes,mentions,morethan,always';
      // an Advanced condition over a toggle is Custom; a data column keeps its own choices
      R.chk.customStays = F.hlWhenPicks('Done = ☑ and V_AMOUNT > 5', kf) === null && F.hlWhenPicks('V_NAME = //Alpha//', kf).op === 'is'
        && F.hlDescribe({ w: 'Notes > 2', css: 'color: red', row: true }, kf, 'Notes') === 'Has more notes than 2, whole row';
      R.info.forms = [a.w, b.w, c.w, d.w, e.w, f.w, g.w, h.w];
    },

    hjtog: async function () {
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      var keys = [];
      await step('setup', async function () {
        window._penumbraToggleState = { k1: {} };
        await journal();
        keys = rows().slice(0, 12).map(keyOf).filter(Boolean);
        [0, 3, 7].forEach(function (i) { if (keys[i]) mark(keys[i]); });
        await redraw();
        R.chk.painted = !!fth(T) && !!fth(N) && keys.length >= 10;
      });
      await step('cog', async function () {
        var p = openCog(T, 'Done');
        R.chk.cogHl = !!p && !!p.querySelector('[data-sec="highlight"] [data-co="hl-add"]');
        await addRule(async function () {
          var cs = hlQ('[data-co="hl-col"]'), os = hlQ('[data-co="hl-op"]');
          var ops = os ? Array.prototype.map.call(os.options, function (o) { return o.value; }) : [];
          R.chk.editorKinds = !!cs && cs.value === 'Done' && /\(this column\)/.test(cs.options[cs.selectedIndex].textContent) && ops.join() === 'checked,unchecked,always' && os.value === 'checked';
          var rowR = hlQ('[data-co="hl-to"][value="row"]');
          if (rowR) { rowR.checked = true; fire(rowR, 'change'); }
          R.info.ed = { col: cs && cs.value, ops: ops };
        });
        closeAll();
        await sleep(400);
        var marked = rows().filter(function (tr) { var k = keyOf(tr); return k && window._penumbraToggleState.k1[k]; });
        var plain = rows().filter(function (tr) { var k = keyOf(tr); return k && !window._penumbraToggleState.k1[k]; });
        R.chk.rowsDrawn = marked.length === 3 && marked.every(function (tr) { return getComputedStyle(tr).backgroundColor === amber; })
          && plain.length > 0 && plain.every(function (tr) { return getComputedStyle(tr).backgroundColor !== amber; });
        R.info.drawn = { marked: marked.length, plain: plain.length };
      });
      await step('tick', async function () {
        var k = keys[1];
        mark(k);
        await redraw();
        var tr = rows().filter(function (x) { return keyOf(x) === k; })[0];
        delete window._penumbraToggleState.k1[keys[0]];
        await redraw();
        var tr0 = rows().filter(function (x) { return keyOf(x) === keys[0]; })[0];
        R.chk.tickRedraw = !!tr && getComputedStyle(tr).backgroundColor === amber && !!tr0 && getComputedStyle(tr0).backgroundColor !== amber;
      });
      await step('dataCond', async function () {
        var red = probe('color: var(--accent-danger, #c62828)', 'color');
        openCog('V_NAME', 'V_NAME');
        await addRule(async function () {
          var adv = hlQ('[data-co="hl-adv"]');
          if (adv) { adv.click(); await sleep(100); }
          var wIn = hlQ('[data-co="hl-w"]'), cIn = hlQ('[data-co="hl-css"]');
          // typed one after the other, as a keyboard user does (condition, Tab, CSS): the
          // condition's wait runs when the CSS box takes over
          // each box focused as it is typed in, as a user's is (the view leaves the focused box alone)
          if (wIn) { wIn.focus(); setInput(wIn, 'Done = ☑'); }
          await sleep(100);
          if (cIn) { cIn.focus(); setInput(cIn, 'color: var(--accent-danger, #c62828)'); }
        });
        closeAll();
        await sleep(400);
        var on = rows().filter(function (tr) { var k = keyOf(tr); return k && window._penumbraToggleState.k1[k]; });
        var stored = null;
        try { var pm = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); Object.keys(pm).forEach(function (k) { var co = pm[k] && pm[k].colopt; if (co && co.V_NAME) stored = co.V_NAME.hl; }); } catch (e) { }
        R.info.dataCond = { on: on.length, red: red, cells: on.slice(0, 3).map(function (tr) { var c = td(tr, 'V_NAME'); return c ? [c.getAttribute('style'), getComputedStyle(c).color] : null; }), stored: stored };
        R.chk.dataCond = on.length > 0 && on.every(function (tr) { var c = td(tr, 'V_NAME'); return c && getComputedStyle(c).color === red; })
          && rows().filter(function (tr) { var k = keyOf(tr); return k && !window._penumbraToggleState.k1[k]; }).every(function (tr) { var c = td(tr, 'V_NAME'); return c && getComputedStyle(c).color !== red; });
      });
      // Done right after typing: the value is not lost with the editor
      await step('quickDone', async function () {
        openCog('V_NAME', 'V_NAME');
        var add = q2('[data-co="hl-add"]');
        if (!add) return;
        add.click();
        await sleep(120);
        pick('[data-co="hl-op"]', 'is');
        await sleep(60);
        var v = hlQ('[data-co="hl-v"]');
        if (v) setInput(v, 'Alpha Bravo');
        var d = hlQ('[data-co="hl-done"]');
        if (d) d.click();
        await sleep(300);
        var items = Array.prototype.map.call(document.querySelectorAll('.sp-sumtype-menu.pnb-colopt .pnb-hl-item'), function (x) { return x.textContent.replace(/\s+/g, ' ').trim(); });
        R.chk.quickDone = items.some(function (t) { return /Is Alpha Bravo/.test(t); });
        R.info.quickDone = items;
        closeAll();
      });
      await step('saveList', async function () {
        var body = document.getElementById('lastStopCardBody');
        if (!body) { body = document.createElement('div'); body.id = 'lastStopCardBody'; document.body.appendChild(body); }
        P().hlRenderSaveList();
        var items = Array.prototype.map.call(document.querySelectorAll('#pnbHlSaveRow .pnb-hl-save-item'), function (l) { return l.textContent.trim(); });
        R.chk.saveLabel = items.some(function (t) { return /^Done: Is checked, whole row/.test(t); }) && !items.some(function (t) { return /__JOURNAL/.test(t); });
        R.info.save = items;
      });
      await step('rename', async function () {
        await journal({ label: 'Complete', old: ['Done'] });
        await sleep(300);
        var marked = rows().filter(function (tr) { var k = keyOf(tr); return k && window._penumbraToggleState.k1[k]; });
        var p = openCog(T, 'Complete');
        var cs = null;
        var ed = q2('[data-co="hl-edit"]');
        if (ed) { ed.click(); await sleep(150); cs = hlQ('[data-co="hl-col"]'); }
        var os = hlQ('[data-co="hl-op"]');
        R.chk.renameKeeps = marked.length > 0 && marked.every(function (tr) { return getComputedStyle(tr).backgroundColor === amber; })
          && !!p && /Complete/.test((p.querySelector('.pnb-colopt-title') || {}).textContent || '') && !!q2('.pnb-hl-item')
          && !!cs && cs.value === 'Done' && !!os && os.value === 'checked';
        R.info.rename = { marked: marked.length, col: cs && cs.value, op: os && os.value };
        closeAll();
      });
    },

    hjnotes: async function () {
      var keys = [];
      var green = probe('color: var(--accent-success, #2e7d32)', 'color');
      var blue = probe('background-color: var(--pnb-hl-blue, #dbe9fb)', 'backgroundColor');
      await step('setup', async function () {
        window._penumbraToggleState = { k1: {} };
        await journal();
        keys = rows().slice(0, 12).map(keyOf).filter(Boolean);
        note(keys[0], 'Call the sponsor back'); note(keys[2], 'budget sent to the PI', 3); note(keys[5], 'Done');
        await redraw();
      });
      await step('hasNotes', async function () {
        openCog(N, 'Notes');
        await addRule(async function () {
          var os = hlQ('[data-co="hl-op"]');
          var ops = os ? Array.prototype.map.call(os.options, function (o) { return o.value; }) : [];
          R.chk.notesOps = ops.join() === 'hasnotes,nonotes,mentions,morethan,always' && os.value === 'hasnotes';
          var tx = hlQ('[data-co="hl-tx"][data-k="green"]'); if (tx) tx.click();
          var fl = hlQ('[data-co="hl-fl"][data-k=""]'); if (fl) fl.click();
        });
        closeAll();
        await sleep(400);
        var withN = rows().filter(function (tr) { return window._penumbraRowNoteCounts[keyOf(tr)] > 0; });
        var without = rows().filter(function (tr) { var k = keyOf(tr); return k && !(window._penumbraRowNoteCounts[k] > 0); });
        R.chk.hasNotes = withN.length === 3 && withN.every(function (tr) { var c = td(tr, N); return c && getComputedStyle(c).color === green; })
          && without.length > 0 && without.every(function (tr) { var c = td(tr, N); return c && getComputedStyle(c).color !== green; });
      });
      await step('mentions', async function () {
        openCog(N, 'Notes');
        await addRule(async function () {
          pick('[data-co="hl-op"]', 'mentions');
          await sleep(80);
          var v = hlQ('[data-co="hl-v"]'); if (v) setInput(v, 'budget');
          var rowR = hlQ('[data-co="hl-to"][value="row"]'); if (rowR) { rowR.checked = true; fire(rowR, 'change'); }
          var fl = hlQ('[data-co="hl-fl"][data-k="blue"]'); if (fl) fl.click();
        });
        closeAll();
        await sleep(400);
        var hit = rows().filter(function (tr) { return keyOf(tr) === keys[2]; })[0];
        var miss = rows().filter(function (tr) { return keyOf(tr) === keys[0]; })[0];
        R.chk.mentions = !!hit && getComputedStyle(hit).backgroundColor === blue && !!miss && getComputedStyle(miss).backgroundColor !== blue;
      });
      await step('newNote', async function () {
        note(keys[8], 'the budget again');
        await redraw();
        await sleep(400);
        var tr = rows().filter(function (x) { return keyOf(x) === keys[8]; })[0];
        R.chk.noteRedraw = !!tr && getComputedStyle(tr).backgroundColor === blue && getComputedStyle(td(tr, N)).color === green;
        R.info.newNote = { key: keys[8], found: !!tr, bg: tr && getComputedStyle(tr).backgroundColor, want: blue, cell: tr && td(tr, N) && getComputedStyle(td(tr, N)).color, wantCell: green,
          count: window._penumbraRowNoteCounts[keys[8]], text: (P().journalRowNotesSearchText && tr) ? 'n/a' : null };
      });
    },

    hjwho: async function () {
      var keys = [];
      var it = 'italic';
      var grey = probe('background-color: var(--pnb-hl-grey, #e6e6e6)', 'backgroundColor');
      await step('setup', async function () {
        window._penumbraToggleState = { k1: {} };
        await journal({ who: true });
        keys = rows().slice(0, 12).map(keyOf).filter(Boolean);
        var today = new Date(), iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
        var old = new Date(today.getTime() - 90 * 86400000);
        mark(keys[0], 'harness', iso(today) + ' 09:00:00'); mark(keys[1], 'pat', iso(today) + ' 09:00:00'); mark(keys[2], 'harness', iso(old) + ' 09:00:00');
        await redraw();
        R.chk.whoCols = !!fth(BY) && !!fth(ON);
      });
      await step('by', async function () {
        openCog(BY, 'Done by');
        await addRule(async function () {
          var cs = hlQ('[data-co="hl-col"]');
          R.info.byCol = cs && cs.value;
          pick('[data-co="hl-op"]', 'is');
          await sleep(60);
          var v = hlQ('[data-co="hl-v"]'); if (v) setInput(v, 'harness');
          var b = hlQ('[data-co="hl-i"]'); if (b) b.click();
          var fl = hlQ('[data-co="hl-fl"][data-k=""]'); if (fl) fl.click();
        });
        closeAll();
        await sleep(400);
        var on = rows().filter(function (tr) { var m = window._penumbraToggleState.k1[keyOf(tr)]; return m && m.by === 'harness'; });
        var off = rows().filter(function (tr) { var m = window._penumbraToggleState.k1[keyOf(tr)]; return !m || m.by !== 'harness'; });
        R.chk.byRule = on.length === 2 && on.every(function (tr) { var c = td(tr, BY); return c && getComputedStyle(c).fontStyle === it; })
          && off.every(function (tr) { var c = td(tr, BY); return c && getComputedStyle(c).fontStyle !== it; });
      });
      await step('on', async function () {
        openCog(ON, 'Done on');
        await addRule(async function () {
          var os = hlQ('[data-co="hl-op"]');
          R.info.onOps = os ? Array.prototype.map.call(os.options, function (o) { return o.value; }) : [];
          pick('[data-co="hl-op"]', 'last');
          await sleep(60);
          var v = hlQ('[data-co="hl-v"]'); if (v) setInput(v, '30');
          var fl = hlQ('[data-co="hl-fl"][data-k="grey"]'); if (fl) fl.click();
        });
        closeAll();
        await sleep(400);
        var recent = rows().filter(function (tr) { var k = keyOf(tr); return k === keys[0] || k === keys[1]; });
        var olden = rows().filter(function (tr) { return keyOf(tr) === keys[2]; });
        R.chk.onRule = (R.info.onOps || []).indexOf('last') >= 0 && recent.length === 2 && recent.every(function (tr) { var c = td(tr, ON); return c && getComputedStyle(c).backgroundColor === grey; })
          && olden.length === 1 && getComputedStyle(td(olden[0], ON)).backgroundColor !== grey;
      });
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
