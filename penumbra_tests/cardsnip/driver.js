// cardsnip suite - browser half (2026-11-02). The REAL main.js (ready closure unwrapped, window.__SM export
// hook) + the REAL penumbra_cards.js, driven through the REAL layout_switch / toggle_switch / action(trigger)
// click handlers. What the viewer sees: the cards come and go, the switch thumb and the toggle follow the card
// view however it changed, data(cards) / data(cardsize) re-render (engine A in the snippet, engine B in the
// subtitle), a bad cards| word is refused with a notice.
//   B0 boot   C1 Cards position   C2 Table beside Cards   C3 cards|small   C4 the toggle (cards|large)
//   C5 the viewer's own Table / Cards switch   C6 cards|huge refused   C7 cards|toggle   C8 a grouping beats Cards
//   E1 the subtitle (engine B)   C9 the viewer's own size list
(function () {
  var R = [];
  function rec(name, pass, detail) {
    R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) });
    document.getElementById('out').textContent = 'running after ' + R.length + ': ' + JSON.stringify(R);   // a stalled run still shows how far it got
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8), hostReduced: false,
                    hookErr: [window.__SM_ERR, window.__SM_ERR2, (window.__SM_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__SM || {};
  function C() { return window.Penumbra && window.Penumbra.cards; }
  function sw() { return document.querySelector('#reportSnippetOutput .pnb-layout-switch'); }
  function opt(i) { var s = sw(); return s ? s.querySelectorAll('.pnb-ls-opt')[i] : null; }
  function sel() { var s = sw(); return s ? s.getAttribute('data-ls-selected') : 'NO SWITCH'; }
  function tg() { return document.querySelector('#reportSnippetOutput .pnb-toggle'); }
  function tgOn() { var t = tg(); return t ? ({ '1': 'true', '0': 'false' })[t.getAttribute('data-ts-on')] || t.getAttribute('data-ts-on') : 'NO TOGGLE'; }   // the toggle writes 1 / 0
  function tgBtn() { var t = tg(); return t ? t.querySelector('.pnb-toggle-btn') : null; }
  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : 'NO #' + id; }
  function on() { var c = C(); return c ? c.on() : 'NO CARDS'; }
  function size() { var c = C(); return c ? c.size() : 'NO CARDS'; }
  function drawn() { return document.querySelectorAll('#pnbCardsHost .pnb-card').length; }
  function grouped() { return $('#groupedResultsContainer').is(':visible'); }
  function link(label) { return $('#reportSnippetOutput a.snippet-action').filter(function () { return $.trim($(this).text()) === label; }).get(0) || null; }
  function notice() { return document.body.innerText || ''; }   // show_text's toast dock
  function state() {
    return 'cards=' + on() + ' size=' + size() + ' drawn=' + drawn() + ' sel=' + sel() + ' toggle=' + tgOn() +
      ' cv=' + txt('cv') + ' cz=' + txt('cz') + ' grouped=' + grouped();
  }
  function motion() { return H.motion ? H.motion() : null; }
  async function idle() {
    for (var i = 0; i < 200; i++) {
      if (!$('#loadingOverlay').is(':visible') && !motion()) break;
      await sleep(25);
    }
    await sleep(150);
  }
  async function bootWait() {
    for (var i = 0; i < 600; i++) {
      if (window.__queryDone >= 1 && $('#resultsTable tbody tr').length && sw() && C() && !$('#loadingOverlay').is(':visible')) break;
      await sleep(25);
    }
    await sleep(500);
  }
  async function click(el) { if (el) { $(el).trigger('click'); } await idle(); }

  async function main() {
    await bootWait();
    if (!sw()) { finish('no layout_switch rendered: ' + $('#reportSnippetOutput').text().slice(0, 300)); return; }
    if (!C()) { finish('penumbra_cards.js did not load'); return; }
    // (csw2) the big pass: 1,001 rows and format() in the snippet - the Table / Cards pick re-renders data(cards)
    if (/[?&]big=1/.test(location.search)) {
      var cv0 = txt('cv'), pz0 = /Large Dataset Detected/.test(document.body.textContent);
      C().set('cards'); await idle(); await sleep(600);
      var pz1 = /Large Dataset Detected/.test(document.body.textContent);
      rec('V1 big report: the card view picked, data(cards)=true, no live-edit pause notice', on() === true && cv0 === 'false' && txt('cv') === 'true' && !pz0 && !pz1, 'cv0=' + cv0 + ' paused=' + pz0 + '/' + pz1 + ' ' + state());
      rec('V0 no page errors (big)', errs().length === 0, errs().slice(0, 4).join(' | '));
      finish(); return;
    }

    // B0: the table on boot; data(cards) false, data(cardsize) medium; the Table position; the toggle off
    rec('B0 boot: the table, data(cards)=false, data(cardsize)=medium, thumb on Table, toggle off',
      on() === false && txt('cv') === 'false' && txt('cz') === 'medium' && sel() === '0' && tgOn() === 'false', state());
    // D1 / D2 (dname): a name keeps its case - ?Unit= and [PROMPT name=Region] in the report body (engine A) and the subtitle (B)
    rec('D1 report body: data(Unit) = the ?Unit= value', txt('du') === 'Chem', 'du=' + txt('du'));
    rec('D2 subtitle: data(Unit) = the ?Unit= value', /for Chem/.test(txt('mainReportSubtitle')), txt('mainReportSubtitle'));
    rec('B1 the toggle on cards|large rendered (cards|... can define a toggle)', !!tg(), $('#reportSnippetOutput').text().slice(0, 200));

    // C1: the Cards position shows the cards; the thumb stays there; data(cards) re-renders
    await click(opt(1));
    rec('C1 Cards position: cards drawn, thumb on Cards, data(cards)=true', on() === true && drawn() > 0 && sel() === '1' && txt('cv') === 'true', state());

    // C2: the Table position beside a Cards position leaves the cards (already flat: nothing else to do)
    await click(opt(0));
    rec('C2 Table beside Cards: cards gone, thumb on Table, data(cards)=false', on() === false && drawn() === 0 && sel() === '0' && txt('cv') === 'false', state());

    // C3: cards|small from an action link: cards at Small; the thumb follows; data(cardsize)=small; the toggle stays off
    await click(link('Small'));
    rec('C3 cards|small: cards at the Small size, thumb on Cards, data(cardsize)=small, toggle off',
      on() === true && size() === 'compact' && sel() === '1' && txt('cz') === 'small' && tgOn() === 'false', state());

    // C4: the toggle runs cards|large: on, at Large; the toggle reads it back as on
    await click(tgBtn());
    rec('C4 toggle on: cards|large, data(cardsize)=large, toggle on', on() === true && size() === 'large' && txt('cz') === 'large' && tgOn() === 'true', state());
    await click(tgBtn());
    rec('C4b toggle off: cards|off, the table, toggle off, thumb on Table', on() === false && tgOn() === 'false' && sel() === '0', state());

    // C5: the viewer's own Table / Cards switch (what #pnbCardsSwitch runs): the snippet's controls and data() follow
    C().set('cards'); await idle();
    rec('C5 the viewer switch to cards: thumb on Cards, data(cards)=true', on() === true && sel() === '1' && txt('cv') === 'true', state());
    C().set('table'); await idle();
    rec('C5b the viewer switch back: thumb on Table, data(cards)=false', on() === false && sel() === '0' && txt('cv') === 'false', state());

    // C6: an unknown word is refused with a notice naming it; nothing changes
    await click(link('Bad'));
    var n6 = notice();
    rec("C6 cards|huge refused: a notice naming 'huge', still the table", on() === false && /unknown option 'huge'/.test(n6), state() + ' notice=' + n6.slice(0, 160));

    // C7: cards|toggle flips both ways
    await click(link('Flip'));
    var c7a = on();
    await click(link('Flip'));
    rec('C7 cards|toggle: on, then off again', c7a === true && on() === false, 'first=' + c7a + ' ' + state());

    // C8: grouped with the cards on, the By Dept position wins (the cards stay on under it); Table leaves both
    await click(opt(1));
    await click(opt(2));
    rec('C8 By Dept with cards on: grouped, thumb on By Dept (not Cards), cards still on', grouped() && sel() === '2' && on() === true, state());
    await click(opt(0));
    rec('C8b Table from a grouping with cards: the flat table, no cards, thumb on Table', !grouped() && on() === false && sel() === '0', state());

    // E1: engine B (the subtitle) answers the same keys
    try { if (typeof H.subtitle === 'function') H.subtitle(); } catch (e) { }
    var s1 = txt('mainReportSubtitle');
    C().showAs('xl'); await idle();
    try { if (typeof H.subtitle === 'function') H.subtitle(); } catch (e) { }
    var s2 = txt('mainReportSubtitle');
    rec('E1 subtitle (engine B): "false at large" on the table (C4 left the size at Large), "true at xl" in Extra large cards',
      /false at large/.test(s1) && /true at xl/.test(s2), 'before=' + s1 + ' | after=' + s2);
    // C9: the viewer's own size list (what #pnbCardsSize runs): no switch motion settles anything, data(cardsize) follows
    C().setSize('compact'); await idle();
    rec('C9 the viewer size list to Small: data(cardsize)=small with no switch involved', on() === true && txt('cz') === 'small', state());
    C().set('table'); await idle();

    // D3 (last: the editor change schedules a live re-render that would land in a later check): a [PROMPT] named Region (no stored answer: its default), through the report body's own lookup - the tag put in
    // the snippet editor only for the call, so no run ever prompts for it
    var d3 = 'NO HOOK';
    var ed = H.snipEd ? H.snipEd() : null;   // a getter: the editor is made after the hook runs
    if (typeof H.lookup === 'function' && ed && ed.getValue) {
      var keep = ed.getValue();
      try { ed.setValue(keep + '\n<!-- [PROMPT; name=Region; default=East] -->'); d3 = String(H.lookup('region', null, undefined, 'Region').v); }
      catch (e) { d3 = 'threw: ' + e; }
      finally { ed.setValue(keep); }
      await sleep(300);
    }
    rec('D3 report body lookup: data(Region) = the Region prompt\'s default', d3 === 'East', 'got=' + d3);
    rec('P0 no page errors', errs().length === 0, errs().slice(0, 4).join(' | '));
    finish();
  }
  main().catch(function (e) { finish('driver threw: ' + String(e && e.stack || e)); });
})();
