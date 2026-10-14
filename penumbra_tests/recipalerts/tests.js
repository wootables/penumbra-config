// recipalerts - scenarios for the scheduler's Recipients alert icon + card, run against the
// REAL functions lifted from js/main.js (see run.ps1) and real jQuery. Writes its report into
// <pre id="out">; run.ps1 reads it from the dumped DOM. ?control=1 adds one false assertion.
(function () {
    var out = [], pass = 0, fail = 0;
    var CONTROL = /[?&]control=1/.test(location.search);
    function ok(c, label) { if (c) { pass++; out.push('ok   ' + label); } else { fail++; out.push('FAIL ' + label); } }
    function finish() {
        out.push('PASS: ' + pass + '   FAIL: ' + fail);
        document.getElementById('out').textContent = out.join('\n');
    }
    var $ = window.jQuery;
    function caps(list) {
        $('#schedEmailContainer').empty();
        list.forEach(function (e) { $('<div class="email-capsule"></div>').data('email', e).appendTo('#schedEmailContainer'); });
    }
    function check() { window.checkSchedulerExternalWarning(); }
    function icon() { return $('#schedRecipAlert'); }
    function shown() { return icon().length === 1 && icon()[0].style.display !== 'none'; }

    try {
        var L = window.__pnbLift;
        if (!L) throw new Error('lifted code did not load');
        ok(icon().length === 1 && icon().is('span') && icon().closest('label').length === 1, 'the real markup: the icon is a span inside the Recipients label');
        window.penumbra_vars = { authorizedList: 'public' };
        $('#schedEventType').val('EMAIL');
        $('#schedIncludeLink').prop('checked', true);

        caps([]); check();
        ok(!shown(), 'no recipients: no icon');

        caps(['jdoe@ncsu.edu']); check();
        ok(!shown(), 'public report, campus recipient: no icon');

        window.penumbra_vars.authorizedList = 'jdoe, 1428'; check();
        ok(shown() && icon().hasClass('is-caution') && icon().text() === '⚠' && /1 warning/.test(icon().attr('aria-label')),
           'private report: a caution icon whose name says "1 warning"');

        window.penumbra_vars.authorizedList = 'public';
        caps(['jdoe@ncsu.edu', 'pat@example.com']); check();
        var a = L.recipAlerts();
        ok(a.length === 1 && a[0].level === 'caution' && /^1 recipient outside ncsu\.edu$/.test(a[0].title) && a[0].html.indexOf('pat@example.com') !== -1,
           'external address + Include Live Link: one note that names the address');

        $('#schedIncludeLink').prop('checked', false); check();
        ok(!shown(), 'the same address with Include Live Link off: no note (it is about the link text)');

        $('#schedIncludeLink').prop('checked', true);
        caps(['someone@lib.ncsu.edu', 'jdoe']);
        a = L.recipAlerts();
        ok(a.length === 1 && /^1 recipient outside/.test(a[0].title) && a[0].html.indexOf('<code>jdoe</code>') !== -1 && a[0].html.indexOf('lib.ncsu.edu') === -1,
           "the runner's rule: @lib.ncsu.edu is campus, a bare Unity ID has no ncsu.edu in it (the runner adds the note for it too)");

        window.penumbra_vars.authorizedList = 'jdoe';
        caps(['bad@x.', 'jdoe@ncsu.edu']); check();
        a = L.recipAlerts();
        ok(icon().hasClass('is-error') && icon().text() === '!' && a[0].level === 'error' && /1 problem, 1 warning/.test(icon().attr('aria-label'))
           && /corrected or removed: <code>bad@x\.<\/code>$/.test(a[0].html),
           'an address the save rejects: error icon, listed first, "1 problem, 1 warning", the address last (no "bad@x..")');

        caps(['<img src=x onerror=window.__xss=1>@x.', 'pat@example.com']); check();
        icon().trigger('click');
        var $card = $('#schedRecipAlertCard');
        ok($card.length === 1 && $card.find('.sra-item').length === 3, 'a click opens the card with one block per alert (3)');
        ok($card.find('.open-auth-list-link').length === 1, 'the private-report block links to the Access List');
        ok($card.find('img').length === 0 && !window.__xss, 'capsule text is escaped in the card');
        ok(icon().attr('aria-expanded') === 'true' && icon().attr('aria-controls') === 'schedRecipAlertCard', 'aria-expanded / aria-controls track the card');

        caps(['pat@example.com']); check();
        ok($('#schedRecipAlertCard .sra-item').length === 2 && icon().hasClass('is-caution'), 'a pinned card follows the list live (the error drops out, the icon turns caution)');

        window._schedRecipAlertEscape();
        var escState = 'card=' + $('#schedRecipAlertCard').length + ' focusOnIcon=' + (document.activeElement === icon()[0])
            + ' active=' + (document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'none')
            + ' expanded=' + icon().attr('aria-expanded') + ' visible=' + icon().is(':visible');
        ok($('#schedRecipAlertCard').length === 0 && document.activeElement === icon()[0] && icon().attr('aria-expanded') === 'false',
           'Escape closes the card and hands focus back to the icon WITHOUT reopening it (' + escState + ')');

        icon().trigger('click');
        $(document.body).trigger('mousedown');
        ok($('#schedRecipAlertCard').length === 0, 'a click anywhere else closes a pinned card');

        $('#schedEventType').val('SNAPSHOT'); check();
        ok(!shown() && $('#schedRecipAlertCard').length === 0, 'a Snapshot task has no recipient alerts');

        $('#schedEventType').val('EMAIL');
        window.penumbra_vars.authorizedList = 'public';
        caps(['jdoe@ncsu.edu']); check();
        ok(!shown(), 'all clear again: the icon hides');

        // Keyboard: focus opens a preview, focus leaving closes it (focusout decides a tick later).
        window.penumbra_vars.authorizedList = 'jdoe'; check();
        document.getElementById('elsewhere').focus();
        icon()[0].focus();
        var openedOnFocus = $('#schedRecipAlertCard').length === 1;
        document.getElementById('elsewhere').focus();
        setTimeout(function () {
            ok(openedOnFocus, 'keyboard focus on the icon opens the card');
            ok($('#schedRecipAlertCard').length === 0, 'focus moving elsewhere closes it');
            if (CONTROL) ok(false, 'CONTROL: a deliberately false assertion');
            finish();
        }, 60);
    } catch (e) {
        fail++;
        out.push('FAIL harness threw: ' + e.name + ': ' + e.message);
        finish();
    }
})();
