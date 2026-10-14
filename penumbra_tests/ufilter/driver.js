/* =============================================================================
   Profile-popover list filter suite - driver (2026-10-14).

   Runs synchronously at parse time on the chrome mount (wireChromeBar) with the
   real main.css, seeded localStorage (2 pins, 3 recents - one of them pinned)
   and the harness's static pinned-snapshots list. Results land in <pre id="out">
   as RESULTS_JSON for run.ps1 (--dump-dom). Row links never navigate (a
   navigation would end the dump): a capture-phase listener records the href
   and prevents the default instead.

   Every step runs in a try/catch: a build without the filter box (the control)
   throws "no filter box" and the step goes red with that reason.
   ============================================================================= */
(function () {
  var results = [], pageErrors = [], clicks = [];
  window.addEventListener('error', function (e) { pageErrors.push(String(e.message)); });
  function rec(name, pass, detail) { results.push({ name: name, pass: !!pass, detail: detail == null ? '' : String(detail) }); }
  function $1(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function finish(fatal) {
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify({ results: results, pageErrors: pageErrors, fatal: fatal || null });
  }
  document.addEventListener('click', function (e) {
    var n = e.target;
    while (n && n.tagName !== 'A') { n = n.parentNode; }
    if (n) { clicks.push(n.getAttribute('href') || ''); e.preventDefault(); }
  }, true);

  function box() { return document.getElementById('sbUserFilter'); }
  function btn() { return document.getElementById('sbUserBtn'); }
  function seg() { return document.getElementById('sbUserSeg'); }
  function isOpen() { return seg().className.indexOf('sb-open') !== -1 && getComputedStyle($1('#sbUserPop')).display !== 'none'; }
  function shown(el) { return getComputedStyle(el).display !== 'none'; }
  function idOf(r) { var a = $1('.sb-recent-main', r); return r.getAttribute('data-id') || (a ? a.getAttribute('href') : '?'); }
  function vis(listId) { return $$('#' + listId + ' .sb-recent-row').filter(shown).map(idOf); }
  function hid(listId) { return $$('#' + listId + ' .sb-recent-row').filter(function (r) { return !shown(r); }).map(idOf); }
  function type(v) { var b = box(); if (!b) { throw new Error('no filter box'); } b.value = v; b.dispatchEvent(new Event('input', { bubbles: true })); }
  function press(el, k) { var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev; }
  function emptyLine(listId) { var e = $1('#' + listId + ' .sb-filter-empty'); return e && shown(e) ? e.textContent.trim() : ''; }
  function ruleShown() { var r = $1('#sbReportsList .sb-zone-rule'); return !!r && shown(r); }
  function state(listId) { return listId + ' vis=' + vis(listId).join(',') + ' hid=' + hid(listId).join(',') + ' empty="' + emptyLine(listId) + '"'; }
  function same(a, b) { return a.join(',') === b.join(','); }
  function focusName() { var a = document.activeElement; return a ? (a.id || a.className || a.tagName) : 'none'; }
  function step(name, fn) { try { var r = fn(); rec(name, r[0], r[1]); } catch (e) { rec(name, false, 'threw: ' + e.message); } }

  try {
    var now = Date.now();
    localStorage.clear();
    localStorage.setItem('penumbra_favorite_server_reports', JSON.stringify([{ id: 'alpha1', title: 'Alpha Budget' }, { id: 'beta2', title: 'Beta Awards' }]));
    localStorage.setItem('pnb_recent_reports', JSON.stringify([
      { id: 'alpha1', title: 'Alpha Budget', ts: now - 60000 },
      { id: 'gamma3', title: 'Gamma Alpha Two', ts: now - 120000 },
      { id: 'delta4', title: 'Delta Report', ts: now - 180000 }
    ]));
    if (!window.PenumbraUserSeg) { finish('penumbra_userseg.js did not load'); return; }
    window.PenumbraUserSeg.configure({ isAdmin: true, userKey: 'tester' });
    window.PenumbraUserSeg.wireChromeBar();

    step('F1 the header row holds the filter box (type=search, labelled, aria-controls names the reports list, a glyph beside it)', function () {
      var b = box(), row = b ? b.parentNode.parentNode : null;
      var ok = !!b && !!row && row.className.indexOf('sb-pop-h-row') !== -1 && row.textContent.indexOf('Your reports') !== -1
            && b.getAttribute('type') === 'search' && !!b.getAttribute('aria-label')
            && /\bsbReportsList\b/.test(b.getAttribute('aria-controls') || '') && !!$1('.sb-ufilter-ico', row);
      return [ok, 'box=' + !!b + ' row=' + (row && row.className) + ' type=' + (b && b.getAttribute('type')) + ' controls=' + (b && b.getAttribute('aria-controls'))];
    });
    step('F2 opening the card renders the lists and puts focus in an empty box', function () {
      btn().click();
      var b = box();
      var ok = isOpen() && !!b && document.activeElement === b && b.value === '' && vis('sbReportsList').length === 4;
      return [ok, 'open=' + isOpen() + ' focus=' + focusName() + ' value="' + (b && b.value) + '" ' + state('sbReportsList')];
    });
    step('F3 with nothing typed every row shows, the pinned/recent rule too, and no "No matches" line', function () {
      var ok = same(vis('sbReportsList'), ['alpha1', 'beta2', 'gamma3', 'delta4']) && ruleShown() && !emptyLine('sbReportsList') && vis('sbSnapPinsList').length === 2;
      return [ok, state('sbReportsList') + ' rule=' + ruleShown() + ' ' + state('sbSnapPinsList')];
    });
    step('F4 a title term narrows the reports list to the rows holding it and hides the zone rule', function () {
      type('alpha');
      var ok = same(vis('sbReportsList'), ['alpha1', 'gamma3']) && same(hid('sbReportsList'), ['beta2', 'delta4']) && !ruleShown();
      return [ok, state('sbReportsList') + ' rule=' + ruleShown()];
    });
    step('F5 a short id matches too', function () {
      type('beta2');
      return [same(vis('sbReportsList'), ['beta2']), state('sbReportsList')];
    });
    step('F6 several terms must ALL match', function () {
      type('alpha two');
      return [same(vis('sbReportsList'), ['gamma3']), state('sbReportsList')];
    });
    step('F7 matching ignores case', function () {
      type('ALPHA');
      return [same(vis('sbReportsList'), ['alpha1', 'gamma3']), state('sbReportsList')];
    });
    step('F8 a term nothing holds hides every row and shows one "No matches" line per list', function () {
      type('zzz');
      var ok = vis('sbReportsList').length === 0 && emptyLine('sbReportsList') === 'No matches'
            && vis('sbSnapPinsList').length === 0 && emptyLine('sbSnapPinsList') === 'No matches' && $$('.sb-filter-empty').length === 2;
      return [ok, state('sbReportsList') + ' ' + state('sbSnapPinsList') + ' lines=' + $$('.sb-filter-empty').length];
    });
    step('F9 clearing the box brings every row, the rule and no "No matches" line back', function () {
      type('');
      var ok = same(vis('sbReportsList'), ['alpha1', 'beta2', 'gamma3', 'delta4']) && ruleShown() && $$('.sb-filter-empty').length === 0 && vis('sbSnapPinsList').length === 2;
      return [ok, state('sbReportsList') + ' rule=' + ruleShown() + ' lines=' + $$('.sb-filter-empty').length];
    });
    step('F10 the pinned-snapshots list filters by a snapshot name and by its tooltip (report title / id)', function () {
      type('q1');
      var a = same(vis('sbSnapPinsList'), ['?snap=11']) && vis('sbReportsList').length === 0 && emptyLine('sbReportsList') === 'No matches' && !emptyLine('sbSnapPinsList');
      var s1 = state('sbSnapPinsList') + ' | ' + state('sbReportsList');
      type('delta');
      var b = same(vis('sbSnapPinsList'), ['?id=delta4&snap=local%7C123']) && same(vis('sbReportsList'), ['delta4']);
      return [a && b, s1 + ' || ' + state('sbSnapPinsList') + ' | ' + state('sbReportsList')];
    });
    step('F11 a re-render (pinning a row) keeps the filter applied', function () {
      type('alpha');
      $1('#sbReportsList .sb-recent-pin[data-id="gamma3"]').click();   // toggles the pin: the list is rebuilt
      var rebuilt = $1('#sbReportsList .sb-recent-row[data-id="gamma3"]');
      var ok = !!rebuilt && rebuilt.className.indexOf('is-pinned') !== -1 && same(vis('sbReportsList'), ['alpha1', 'gamma3']) && same(hid('sbReportsList'), ['beta2', 'delta4']);
      var detail = 'gammaRow=' + (rebuilt && rebuilt.className) + ' ' + state('sbReportsList');
      $1('#sbReportsList .sb-recent-pin[data-id="gamma3"]').click();   // and back
      return [ok, detail];
    });
    step('F12 Enter with a filter typed opens the first matching row (its link is clicked)', function () {
      type('gamma');
      var n0 = clicks.length;
      var ev = press(box(), 'Enter');
      var ok = clicks.length === n0 + 1 && /id=gamma3/.test(clicks[clicks.length - 1]) && ev.defaultPrevented;
      return [ok, 'clicks=' + clicks.slice(n0).join(' ') + ' prevented=' + ev.defaultPrevented];
    });
    step('F13 Enter on an empty box opens nothing', function () {
      type('');
      var n0 = clicks.length;
      press(box(), 'Enter');
      return [clicks.length === n0, 'clicks=' + clicks.slice(n0).join(' ')];
    });
    step('F14 ArrowDown moves focus to the first matching row link', function () {
      type('delta');
      var ev = press(box(), 'ArrowDown');
      var want = $1('#sbReportsList .sb-recent-row[data-id="delta4"] .sb-recent-main');
      return [document.activeElement === want && ev.defaultPrevented, 'focus=' + focusName() + ' prevented=' + ev.defaultPrevented];
    });
    step('F15 Escape in the box closes the card and hands focus back to the avatar button', function () {
      box().focus();
      type('delta');
      press(box(), 'Escape');
      var ok = !isOpen() && document.activeElement === btn() && btn().getAttribute('aria-expanded') === 'false';
      return [ok, 'open=' + isOpen() + ' focus=' + focusName() + ' expanded=' + btn().getAttribute('aria-expanded')];
    });
    step('F16 reopening resets: an empty, focused box and every row back', function () {
      btn().click();
      var b = box();
      var ok = isOpen() && !!b && b.value === '' && document.activeElement === b
            && same(vis('sbReportsList'), ['alpha1', 'beta2', 'gamma3', 'delta4']) && ruleShown() && $$('.sb-filter-empty').length === 0;
      return [ok, 'open=' + isOpen() + ' value="' + (b && b.value) + '" focus=' + focusName() + ' ' + state('sbReportsList')];
    });
    // The autofocus guard: a PHONE (coarse pointer AND a phone-narrow viewport)
    // gets no autofocus - the keyboard would cover the card; a touch laptop
    // (coarse primary pointer, hover: none, but a wide viewport - the user's
    // own machine, 2026-10-14) must still be focused. matchMedia is stubbed
    // to answer exactly the query the engine asks.
    step('F17 a phone (coarse pointer AND a phone-narrow viewport) is not auto-focused on open', function () {
      var realMM = window.matchMedia;
      try {
        press(box(), 'Escape');   // close the card F16 reopened
        window.matchMedia = function (q) { return { matches: q === '(pointer: coarse) and (max-width: 768px)', media: q }; };
        btn().click();
        var b = box();
        return [isOpen() && !!b && document.activeElement !== b && b.value === '', 'open=' + isOpen() + ' focus=' + focusName() + ' value="' + (b && b.value) + '"'];
      } finally { window.matchMedia = realMM; }
    });
    step('F18 a touch laptop (coarse pointer, wide viewport) IS auto-focused on open', function () {
      var realMM = window.matchMedia;
      try {
        press(box(), 'Escape');
        window.matchMedia = function (q) { return { matches: q === '(pointer: coarse)', media: q }; };
        btn().click();
        var b = box();
        return [isOpen() && !!b && document.activeElement === b, 'open=' + isOpen() + ' focus=' + focusName()];
      } finally { window.matchMedia = realMM; }
    });
    rec('F19 no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    finish();
  } catch (e) {
    finish('driver threw: ' + (e && e.message));
  }
})();
