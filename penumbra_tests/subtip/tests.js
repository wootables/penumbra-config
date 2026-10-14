// subtip - browser half: the header Subscribe button's detail card and the scheduler's live
// link pencil, run against the REAL code lifted from js/main.js (+ the Delivery Options markup
// from index.php, + css/main.css) by run.ps1, with real jQuery. The card's facts are the REAL
// PHP extractor's output (gen_about.php -> window.__about). Writes its report into <pre id="out">.
// ?control=1 adds one false assertion.
(function () {
    var out = [], pass = 0, fail = 0;
    var CONTROL = /[?&]control=1/.test(location.search);
    var $ = window.jQuery;
    function ok(c, label, detail) {
        if (c) { pass++; out.push('ok   ' + label); }
        else { fail++; out.push('FAIL ' + label + (detail !== undefined ? '\n       got: ' + detail : '')); }
    }
    function finish() {
        out.push('PASS: ' + pass + '   FAIL: ' + fail);
        document.getElementById('out').textContent = out.join('\n');
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function ptr(el, type, pointerType, related) {
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: pointerType || 'mouse', relatedTarget: related || null }));
    }
    function enter(el, pt) { ptr(el, 'pointerover', pt || 'mouse', null); }
    function leave(el) { ptr(el, 'pointerout', 'mouse', document.getElementById('elsewhere')); }
    function keyOn(target, k) {
        var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
        target.dispatchEvent(ev);
        return ev;
    }
    function tip() { return $('#pnbSubTip'); }
    function chip() { return document.getElementById('pnbSubscribeBtn'); }
    function secLabels() { return tip().find('.prt-section-label').map(function () { return $(this).text(); }).get(); }
    function secItems(label) {
        var items = [];
        tip().find('.pst-sec').each(function () {
            if ($(this).find('.prt-section-label').text() === label) {
                $(this).find('li').each(function () { items.push($(this).text()); });
            }
        });
        return items;
    }
    function foot() { return tip().find('.pst-foot').text(); }
    // Focus modality: the card opens on KEYBOARD focus only (:focus-visible).
    var origMatches = Element.prototype.matches;
    window.__fv = true;
    Element.prototype.matches = function (sel) { return sel === ':focus-visible' ? !!window.__fv : origMatches.call(this, sel); };
    // Subscribe / unsubscribe round trips answer like manage_subscription.php.
    $.post = function (url, data) {
        var d = $.Deferred();
        window.__posts.push(data);
        setTimeout(function () { d.resolve({ status: 'success', changed: true, on: data.action === 'subscribe', suppressed: false, message: 'done' }); }, 20);
        return d.promise();
    };
    window.__posts = [];
    var A = window.__about;
    var HIT_TITLE = 'Proposal Hit Ratio by College, Department and PI (row count)';

    async function run() {
        // ============================================================ S. one schedule: the chip
        var c = chip();
        ok(c && $(c).text() === 'Subscribe' && !c.hasAttribute('title'), 'S1 one schedule: a Subscribe chip with no native title (the card replaces it)', c ? c.outerHTML : 'no chip');

        enter(c);
        await sleep(150);
        ok(tip().length === 0, 'S2 a first hover waits a beat (no card at 150 ms)');
        await sleep(300);
        ok(tip().length === 1 && tip().attr('role') === 'tooltip' && c.getAttribute('aria-describedby') === 'pnbSubTip',
            'S2 then the card opens: role=tooltip, and the chip is described by it');
        ok(tip().find('.prt-header').text() === HIT_TITLE, 'S3 header = the email subject, {ROW_COUNT} named in words', tip().find('.prt-header').text());
        ok(secLabels().join('|') === 'When|Each email has|Data|Not sent when', 'S3 sections in order: When, Each email has, Data, Not sent when', secLabels().join('|'));
        ok(secItems('When').join('|') === 'Monthly on the 1st at 8:40 AM|Next email: Sun, Nov 1 at 8:40 AM', 'S3 when: the plain-English schedule and the next send', secItems('When').join('|'));
        ok(secItems('Each email has').join('|') === "The report's data table|Attached: CSV|A link to open the live report",
            'S3 each email: the table, the CSV, the live link (snippet off for this task: no line)', secItems('Each email has').join('|'));
        ok(secItems('Data').join('|') === 'Submitted: first day of 5 fiscal years ago to last day of last fiscal year',
            'S3 data: the saved prompt answer, named, its date range read as "a to b"', secItems('Data').join('|'));
        ok(secItems('Not sent when').join('|') === 'There are no rows', 'S3 not sent when: no rows', secItems('Not sent when').join('|'));
        ok(foot() === 'Click to subscribe as jdoe@ncsu.edu. A confirmation email follows. Every email has an Unsubscribe link.',
            'S3 last line: what the click does, the address, the confirmation and the Unsubscribe link', foot());
        var cr = c.getBoundingClientRect(), tr = tip()[0].getBoundingClientRect();
        ok(getComputedStyle(tip()[0]).position === 'fixed' && tr.top >= cr.bottom && tr.left >= 7 && tr.right <= window.innerWidth - 7,
            'S4 placed under the chip, inside the viewport (position fixed)', 'chip ' + Math.round(cr.bottom) + ' card ' + Math.round(tr.top) + '/' + Math.round(tr.left) + '/' + Math.round(tr.right));
        ok(getComputedStyle(tip()[0]).backgroundColor === 'rgb(26, 26, 46)', 'S4 the shared dark rich-tooltip look (main.css .pill-rich-tooltip family)', getComputedStyle(tip()[0]).backgroundColor);
        $(window).trigger('resize');
        ok(tip().length === 1 && Math.abs(tip()[0].getBoundingClientRect().top - tr.top) <= 1,
            'S4 a resize (main.js fires synthetic ones after layout changes) leaves the card by its button');

        // hoverable: pointer moves from the chip onto the card and it stays
        if (!tip().length) { enter(c); await sleep(450); }   // (a card lost above must not cascade into S5)
        leave(c);
        await sleep(60);
        enter(tip()[0]);
        await sleep(400);
        ok(tip().length === 1, 'S5 hoverable: moving onto the card keeps it open');
        leave(tip()[0]);
        await sleep(300);
        ok(tip().length === 0 && !c.hasAttribute('aria-describedby'), 'S5 leaving it closes it, and the chip loses aria-describedby');

        enter(c, 'touch');
        await sleep(600);
        ok(tip().length === 0, 'S6 a touch pointer never opens it (the tap is the action)');
        leave(c);
        await sleep(300);   // (a card that did open must not leak into S7)

        window.__fv = false; c.focus();
        await sleep(50);
        ok(tip().length === 0, 'S7 focus from a mouse press does not open it');
        c.blur(); window.__fv = true; c.focus();
        await sleep(10);
        ok(tip().length === 1, 'S7 keyboard focus opens it at once');
        $(c).trigger('mousedown');
        ok(tip().length === 0, 'S8 a press on the button closes it');
        c.blur(); c.focus();
        await sleep(10);
        var before = window.__centralEsc;
        var ev = keyOn(c, 'Escape');
        ok(tip().length === 0 && ev.defaultPrevented && window.__centralEsc === before,
            "S9 Escape closes the card, and the app's capture-phase handler never sees that Escape", 'tip=' + tip().length + ' prevented=' + ev.defaultPrevented + ' central=' + (window.__centralEsc - before));
        ev = keyOn(c, 'Escape');
        ok(window.__centralEsc === before + 1, 'S9 with nothing open, Escape goes on to the app as before');
        c.blur();

        $(c).trigger('click');
        await sleep(80);
        c = chip();
        ok(window.__posts.length === 1 && window.__posts[0].action === 'subscribe' && $(c).text() === 'Subscribed', 'S10 the click still subscribes (chip reads Subscribed)', $(c).text());
        enter(c);
        await sleep(450);
        ok(foot() === 'You are subscribed as jdoe@ncsu.edu. Click to unsubscribe.', 'S10 the card now says what the next click does', foot());
        leave(c);
        await sleep(300);

        // ============================================================ M. several schedules: the list
        $('#reportSnippet').val('sum(AMOUNT)');
        var rows = [
            { ID: '1345', TASK_TYPE: 'EMAIL', IS_ACTIVE: '1', SUBJECT: 'Proposal Hit Ratio ({ROW_COUNT})', CRON_EXPRESSION: '40 8 1 * *',
              SCHEDULE_HUMAN: 'Monthly on the 1st at 8:40 AM', RECIPIENTS: '',
              OPTIONS: JSON.stringify({ subscriptions_enabled: true, subscribers: [{ uid: 'jdoe', email: 'jdoe@ncsu.edu' }] }), SUB_ABOUT: A.hit },
            { ID: '1400', TASK_TYPE: 'EMAIL', IS_ACTIVE: '1', SUBJECT: 'Weekly changes - {SEND_DATE}', CRON_EXPRESSION: '0 7 * * 1',
              SCHEDULE_HUMAN: 'Every Monday at 7:00 AM', RECIPIENTS: 'Jane Doe <jdoe@ncsu.edu>; other@ncsu.edu',
              OPTIONS: JSON.stringify({ subscriptions_enabled: true, suppressed: ['jdoe@ncsu.edu'] }), SUB_ABOUT: A.chg },
            { ID: '1401', TASK_TYPE: 'SNAPSHOT', IS_ACTIVE: '1', SUBJECT: 'snap', CRON_EXPRESSION: '0 0 * * *', OPTIONS: '{"subscriptions_enabled":true}' },
            { ID: '1402', TASK_TYPE: 'EMAIL', IS_ACTIVE: '1', SUBJECT: '<img src=x onerror=window.__xss=9>', CRON_EXPRESSION: '0 6 * * *',
              SCHEDULE_HUMAN: '', RECIPIENTS: '', OPTIONS: JSON.stringify({ subscriptions_enabled: true }), SUB_ABOUT: A.xss }
        ];
        window._pnbSubSyncFromTaskList(rows);
        c = chip();
        ok($(c).text() === 'Subscribed (1/3)' && c.getAttribute('title') === 'This report has 3 email schedules (you receive 1). Click to see them, then hover one to see what it sends.',
            'M1 three schedules: the chip counts them and its title says the list explains each', c.getAttribute('title'));
        enter(c);
        await sleep(450);
        ok(tip().length === 0, 'M2 hovering the chip of a multi-schedule report opens no card (it opens the list)');
        leave(c);
        $(c).trigger('click');
        await sleep(20);
        var $rows = $('.pnb-sub-pop .pnb-sub-pop-item');
        ok($rows.length === 3 && $rows.eq(0).attr('data-task-id') === '1345' && $rows.eq(1).attr('data-task-id') === '1400',
            'M3 the list: one row per schedule, each carrying its task id', $rows.length);
        ok($rows.eq(0).find('.pnb-sub-pop-subj').text() === 'Proposal Hit Ratio (row count)' && $rows.eq(1).find('.pnb-sub-pop-subj').text() === 'Weekly changes - send date',
            'M3 the rows name {ROW_COUNT} / {SEND_DATE} in words too', $rows.eq(1).find('.pnb-sub-pop-subj').text());

        enter($rows[1]);
        await sleep(450);
        ok(tip().length === 1 && tip().find('.prt-header').text() === 'Weekly changes - send date', 'M4 hovering a row opens THAT schedule\'s card', tip().find('.prt-header').text());
        ok(secItems('Each email has').join('|') === "A change analysis: the rows that are new, removed or changed since the previous email|The report's summary figures and charts|Attached: Excel, PDF|A link to open the live report",
            'M4 each email: the change analysis, the snippet (this report has one), Excel + PDF, the link', secItems('Each email has').join('|'));
        ok(secItems('Data').join('|') === 'Leaves out: Unchanged Rows|Rows picked for each recipient: LEAD_UNIT = /^{OUC}/',
            'M4 data: the change group left out, and the per-recipient filter', secItems('Data').join('|'));
        ok(tip().find('code').first().text() === 'LEAD_UNIT = /^{OUC}/', 'M4 filters and conditions are shown as code');
        ok(secItems('Not sent when').join('|') === 'Nothing changed since the previous email|This is true: sum(AMOUNT) < 1000',
            'M4 not sent when: unchanged data, and the custom condition', secItems('Not sent when').join('|'));
        ok(foot() === 'You opted out of this schedule. Click to receive it again as jdoe@ncsu.edu.', 'M4 an opted-out typed recipient is told the click resumes it', foot());
        var pr = $('.pnb-sub-pop')[0].getBoundingClientRect(), rr = $rows[1].getBoundingClientRect(); tr = tip()[0].getBoundingClientRect();
        ok((tr.left >= pr.right + 7 || tr.right <= pr.left - 7) && Math.abs(tr.top - (rr.top - 6)) <= 1,
            'M5 the card sits BESIDE the list, level with its row - it never covers the other schedules',
            'pop ' + Math.round(pr.left) + '-' + Math.round(pr.right) + ' card ' + Math.round(tr.left) + '-' + Math.round(tr.right) + ' top ' + Math.round(tr.top) + ' row ' + Math.round(rr.top));

        enter($rows[0]);
        await sleep(20);
        ok(tip().find('.prt-header').text() === 'Proposal Hit Ratio (row count)' && foot() === 'You are subscribed as jdoe@ncsu.edu. Click to unsubscribe.',
            'M7 moving to the next row swaps the card at once (no second wait)', tip().find('.prt-header').text() + ' / ' + foot());
        leave($rows[0]);
        await sleep(300);

        $('#reportSnippet').val('');
        enter($rows[1]);
        await sleep(450);
        ok(secItems('Each email has').indexOf("The report's summary figures and charts") === -1, 'M6 a report without a snippet never promises one, whatever the option says');
        leave($rows[1]);
        await sleep(300);

        enter($rows[2]);
        await sleep(450);
        var hostile = $('.pnb-sub-pop, #pnbSubTip').find('img, script, svg, b').length;
        ok(tip().length === 1 && hostile === 0 && window.__xss === undefined && tip().find('.prt-header').text() === '<img src=x onerror=window.__xss=9>',
            'M8 subject, filter, prompt names and values, and the condition are all printed as text', 'elements=' + hostile + ' xss=' + window.__xss);
        ok(secItems('Data').join('|') === '<b>n</b>: <script>window.__xss=2</script>|Only rows where A = "<img src=x onerror=window.__xss=1>"',
            'M8 (the hostile values arrive intact, as words)', secItems('Data').join('|'));
        ok(foot() === 'Click to subscribe as jdoe@ncsu.edu. A confirmation email follows. Every email has an Unsubscribe link.', 'M8 not yet subscribed: the subscribe line', foot());
        leave($rows[2]);
        await sleep(300);

        var b3 = $rows.eq(2).find('.pnb-sub-pop-btn')[0];
        window.__fv = true; b3.focus();
        await sleep(10);
        ok(tip().length === 1 && b3.getAttribute('aria-describedby') === 'pnbSubTip', 'M9 keyboard focus on a row\'s button opens its card, described');
        $(b3).trigger('click');
        await sleep(80);
        ok($(b3).text() === 'Unsubscribe' && foot() === 'You are subscribed as jdoe@ncsu.edu. Click to unsubscribe.', 'M9 a keyboard toggle updates the open card\'s last line', $(b3).text() + ' / ' + foot());
        ok(chip().getAttribute('title') === 'This report has 3 email schedules (you receive 2). Click to see them, then hover one to see what it sends.', 'M9 ...and the chip\'s count', chip().getAttribute('title'));
        before = window.__centralEsc;
        var e1 = keyOn(b3, 'Escape');
        ok(tip().length === 0 && $('.pnb-sub-pop').length === 1 && e1.defaultPrevented, 'M10 first Escape: the card only');
        var e2 = keyOn(b3, 'Escape');
        ok($('.pnb-sub-pop').length === 0 && document.activeElement === chip() && e2.defaultPrevented && window.__centralEsc === before,
            'M10 second Escape: the list closes and focus returns to the chip (the app never saw either)', 'pop=' + $('.pnb-sub-pop').length + ' active=' + (document.activeElement && document.activeElement.id) + ' central=' + (window.__centralEsc - before));
        chip().blur();

        window._pnbSubPreviewToggle('new', true, { subject: 'Draft', cron: '' });
        $(chip()).trigger('click');
        await sleep(20);
        var $pend = $('.pnb-sub-pop .pnb-sub-pop-item[data-task-id="new"]');
        enter($pend[0]);
        await sleep(450);
        ok($pend.length === 1 && foot() === 'Subscriptions start once this schedule is saved.', 'M11 an unsaved preview row explains itself', foot());
        leave($pend[0]);
        await sleep(300);
        $(document.body).trigger('mousedown');

        // ============================================================ L. the live link pencil
        var $inc = $('#schedIncludeLink'), pen = document.getElementById('schedLinkTextBtn'), store = document.getElementById('schedLinkText');
        ok(pen && !$(pen).closest('label').length && $(pen).prev('label').find('#schedIncludeLink').length === 1,
            'L1 the pencil sits right after the Include Live Link label, outside it');
        ok(store && store.type === 'text' && store.offsetParent === null, 'L1 the store is a text input kept out of sight');
        $(pen).trigger('mousedown');
        pen.click();
        ok($inc.is(':checked'), 'L2 clicking the pencil never toggles the checkbox');
        window._schedLinkTextEscape();
        window._schedLinkTextSync();
        ok(!$(pen).hasClass('is-custom') && pen.getAttribute('aria-label') === 'Live link text: automatic. Edit' && !pen.disabled,
            'L3 no custom text: plain pencil, named "automatic"', pen.getAttribute('aria-label'));
        var cs = getComputedStyle(pen), penColor0 = cs.color;   // (computed styles are live: keep the string)
        ok(cs.marginTop === '-2px' && cs.paddingTop === '0px' && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.width === '18px',
            "L3 main.css styles it by id - the global button padding / margin-top don't reach it", cs.marginTop + ' ' + cs.paddingTop + ' ' + cs.backgroundColor + ' ' + cs.width);

        var dirty = window.__pnbLift.serialize();
        var changes = 0;
        $('#scheduler-tab').on('change', function (e) { if (e.target.id === 'schedLinkText') changes++; });
        $('<div class="ui-tooltip">Link text: automatic.</div>').appendTo(document.body);   // the page-wide tip, already up
        pen.click();
        var $pop = $('#schedLinkTextPop'), inp = document.getElementById('schedLinkTextInput');
        ok(!pen.hasAttribute('title') && $('.ui-tooltip').length === 0, 'L4 no tooltip over the open popup: the title goes and a tip already up is removed');
        var AUTO_TABLE = 'View this report to access the latest data. Additional exporting and analytics options are available.';
        ok($pop.length === 1 && $pop.attr('role') === 'dialog' && document.activeElement === inp && inp.placeholder === AUTO_TABLE,
            'L4 the popup opens with the field focused; the placeholder is the automatic text', inp ? inp.placeholder : 'no input');
        ok($pop.find('.sltp-hint q').text() === AUTO_TABLE && $pop.find('.sltp-reset').prop('disabled') && pen.getAttribute('aria-expanded') === 'true',
            'L4 the hint quotes the automatic text; "Use automatic" is off while nothing is custom; aria-expanded');
        ok($(inp).closest('form').attr('data-lpignore') === 'true' && $(inp).closest('form').attr('onsubmit') === 'return false', 'L4 the field sits in its own opt-out <form> (password managers)');
        var pb = pen.getBoundingClientRect(), pp = $pop[0].getBoundingClientRect();
        ok((pp.top >= pb.bottom || pp.bottom <= pb.top) && pp.left >= 7 && pp.right <= window.innerWidth - 7, 'L5 placed by the pencil, inside the viewport',
            Math.round(pp.top) + '/' + Math.round(pb.bottom));

        inp.value = 'Open the award dashboard';
        $pop.find('.sltp-apply').trigger('click');
        ok(store.value === 'Open the award dashboard' && changes === 1 && $('#schedLinkTextPop').length === 0, 'L6 Apply stores it (one change event, so the form knows) and closes',
            store.value + ' changes=' + changes);
        ok($(pen).hasClass('is-custom') && pen.getAttribute('title') === 'Link text, your wording: "Open the award dashboard". Click to change it.'
            && pen.getAttribute('aria-label') === 'Live link text: yours, "Open the award dashboard". Edit' && pen.getAttribute('aria-expanded') === 'false' && document.activeElement === pen,
            'L6 the pencil turns custom (title quotes it), and focus comes back to it', pen.getAttribute('title'));
        ok(getComputedStyle(pen, '::after').content !== 'none' && getComputedStyle(pen).color !== penColor0, 'L6 indicator: brand color plus the dot', penColor0 + ' -> ' + getComputedStyle(pen).color);
        var ser = window.__pnbLift.serialize();
        ok(ser.indexOf('schedLinkText=Open the award dashboard') !== -1 && ser !== dirty, 'L7 the unsaved-changes snapshot sees the edit');

        pen.click(); $pop = $('#schedLinkTextPop'); inp = document.getElementById('schedLinkTextInput');
        ok(inp.value === 'Open the award dashboard' && !$pop.find('.sltp-reset').prop('disabled'), 'L8 reopening shows the text; "Use automatic" is on');
        $pop.find('.sltp-reset').trigger('click');
        ok(store.value === '' && !$(pen).hasClass('is-custom') && changes === 2, 'L8 "Use automatic" clears it in one click', store.value + ' ' + changes);

        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = "  Two \n   words  ";
        keyOn(inp, 'Enter');
        ok(store.value === 'Two words' && $('#schedLinkTextPop').length === 0, 'L9 Enter applies; spaces and line breaks collapse to one line', JSON.stringify(store.value));

        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = AUTO_TABLE;
        keyOn(inp, 'Enter');
        ok(store.value === '', 'L10 typing the automatic text back = automatic (nothing custom stored)', JSON.stringify(store.value));

        store.value = 'Kept'; window._schedLinkTextSync();
        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = 'Discard me';
        before = window.__centralEsc;
        var esc = keyOn(inp, 'Escape');
        ok($('#schedLinkTextPop').length === 0 && store.value === 'Kept' && document.activeElement === pen && esc.defaultPrevented && window.__centralEsc === before,
            "L11 Escape (the app's handler, step A0.745) cancels, keeps the old text, and refocuses the pencil",
            'pop=' + $('#schedLinkTextPop').length + ' store=' + store.value + ' active=' + (document.activeElement && document.activeElement.id) + ' central=' + (window.__centralEsc - before));

        if ($('#schedLinkTextPop').length) window._schedLinkTextEscape();   // (keeps a broken Escape to ONE failure)
        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = 'Discard me too';
        $('#elsewhere').trigger('mousedown');
        ok($('#schedLinkTextPop').length === 0 && store.value === 'Kept', 'L12 a press outside cancels');
        pen.click();
        pen.click();
        ok($('#schedLinkTextPop').length === 0 && store.value === 'Kept', 'L17 the pencil toggles the popup closed (no apply)');
        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = 'Discard on tab-out';
        document.getElementById('elsewhere').focus();
        await sleep(20);
        ok($('#schedLinkTextPop').length === 0 && store.value === 'Kept', 'L18 focus leaving the popup cancels it');

        $('#schedChangesOnly').prop('checked', true);
        pen.click();
        ok(document.getElementById('schedLinkTextInput').placeholder === 'View the live report.', 'L13 with Send as Change Analysis the automatic text is the short pair text');
        window._schedLinkTextEscape();
        $('#schedChangesOnly').prop('checked', false); $('#pivot-output-container').show();
        pen.click();
        ok(document.getElementById('schedLinkTextInput').placeholder === 'View this report for the interactive pivot view with sorting and search.', 'L13 a pivot report: the pivot sentence');
        window._schedLinkTextEscape();
        $('#pivot-output-container').hide();

        pen.click();
        $inc.prop('checked', false).trigger('change');
        ok($('#schedLinkTextPop').length === 0 && pen.disabled && $(pen).hasClass('is-custom')
            && pen.getAttribute('title') === 'Turn on Include Live Link to change its text (yours is kept: "Kept")',
            'L14 Include Live Link off: the popup closes, the pencil disables, the custom mark and text are kept', pen.getAttribute('title'));
        if ($('#schedLinkTextPop').length) window._schedLinkTextEscape();   // (a popup left open above must not count here)
        pen.click();
        ok($('#schedLinkTextPop').length === 0, 'L14 a disabled pencil opens nothing');
        if ($('#schedLinkTextPop').length) window._schedLinkTextEscape();
        $inc.prop('checked', true).trigger('change');
        ok(!pen.disabled, 'L14 back on: editable again');

        pen.click(); inp = document.getElementById('schedLinkTextInput');
        inp.value = '<img src=x onerror=window.__xss2=1>';
        keyOn(inp, 'Enter');
        var penTitle = pen.getAttribute('title') || '';   // (read while closed: an open popup drops the title)
        pen.click();
        var bad = $('#deliveryHost, #schedLinkTextPop').find('img').length;
        ok(store.value === '<img src=x onerror=window.__xss2=1>' && bad === 0 && window.__xss2 === undefined
            && document.getElementById('schedLinkTextInput').value === store.value && penTitle.indexOf('"<img src=x') !== -1,
            'L15 markup in the text stays text: stored as typed, shown in the title and field, never rendered', 'imgs=' + bad);
        window._schedLinkTextEscape();

        // ============================================================ K. the other links' pencils (round 3)
        var kinds = [['full', 'schedLinkTextFullBtn', 'schedLinkTextFull', '#schedIncludeBody'],
                     ['chart', 'schedLinkTextChartBtn', 'schedLinkTextChart', '#schedIncludeSnippet'],
                     ['compare', 'schedLinkTextCompareBtn', 'schedLinkTextCompare', '#schedChangesOnly']];
        ok(kinds.every(function (k) {
            var b = document.getElementById(k[1]), s = document.getElementById(k[2]);
            return b && !$(b).closest('label').length && $(b).prev('label').find(k[3]).length === 1 && b.getAttribute('data-link-kind') === k[0] && s && s.type === 'text';
        }), 'K1 a pencil after Include Table in Body, Include Snippet and Send as Change Analysis - outside each label, each with its own text store');
        store.value = '';
        $inc.prop('checked', true); $('#schedIncludeBody').prop('checked', true); $('#schedIncludeSnippet').prop('checked', false); $('#schedChangesOnly').prop('checked', false);
        window._schedLinkTextSync();
        var pFull = document.getElementById('schedLinkTextFullBtn'), pChart = document.getElementById('schedLinkTextChartBtn'), pCmp = document.getElementById('schedLinkTextCompareBtn');
        ok(!pFull.disabled && pChart.disabled && pCmp.disabled && pChart.getAttribute('title') === 'Turn on Include Snippet to change its text'
            && pCmp.getAttribute('title') === 'Turn on Send as Change Analysis to change its text' && pFull.getAttribute('aria-label') === 'Full report link text: automatic. Edit',
            'K2 each pencil follows its own option: table on = editable; snippet and change analysis off = dimmed, saying which option to turn on',
            pChart.getAttribute('title') + ' / ' + pCmp.getAttribute('title'));
        $('#schedChangesOnly').prop('checked', true).trigger('change');
        ok(!pCmp.disabled, 'K2 Send as Change Analysis on: its pencil wakes');
        pCmp.click();
        var $kp = $('#schedLinkTextPop'), kin = document.getElementById('schedLinkTextInput');
        ok($kp.find('.sltp-title').text() === 'Comparison link text' && $kp.find('.sltp-where').text().indexOf('Beside the live link') === 0
            && kin.placeholder === 'View the comparison analysis.' && $kp.find('.sltp-hint q').text() === 'View the comparison analysis.' && kin.getAttribute('aria-label') === 'Comparison link text',
            'K3 its popup names the link, says where it shows, and offers its automatic text', $kp.find('.sltp-title').text() + ' / ' + (kin && kin.placeholder));
        kin.value = 'See what changed';
        $kp.find('.sltp-apply').trigger('click');
        ok(document.getElementById('schedLinkTextCompare').value === 'See what changed' && store.value === '' && $(pCmp).hasClass('is-custom') && !$(pen).hasClass('is-custom'),
            "K3 Apply stores ITS text only (the live link's stays automatic), and only its pencil turns custom");
        pCmp.click();
        pFull.click();
        ok($('#schedLinkTextPop').length === 1 && $('#schedLinkTextPop .sltp-title').text() === 'Full report link text' && document.getElementById('schedLinkTextCompare').value === 'See what changed',
            'K4 another pencil swaps the popup (the first closes unsaved)');
        document.getElementById('schedLinkTextInput').value = 'Open every row';
        keyOn(document.getElementById('schedLinkTextInput'), 'Enter');
        ok(document.getElementById('schedLinkTextFull').value === 'Open every row' && $(pFull).hasClass('is-custom') && document.activeElement === pFull,
            'K4 Enter applies to the full-report link, and focus goes back to ITS pencil');
        $('#schedIncludeSnippet').prop('checked', true).trigger('change');
        pChart.click();
        ok(!pChart.disabled && document.getElementById('schedLinkTextInput').placeholder === 'Open to full view', 'K5 Include Snippet on: the chart caption pencil, automatic "Open to full view"');
        document.getElementById('schedLinkTextInput').value = 'Bigger chart';
        $('#schedLinkTextPop .sltp-apply').trigger('click');
        $inc.prop('checked', false).trigger('change');
        ok(pChart.disabled && pChart.getAttribute('title') === 'Turn on Include Live Link to change its text (yours is kept: "Bigger chart")' && !pCmp.disabled && !pFull.disabled,
            'K5 chart links need the live link too: Include Live Link off dims the caption pencil (text kept), not the comparison or full-report ones', pChart.getAttribute('title'));
        $inc.prop('checked', true).trigger('change');
        pCmp.click();
        document.getElementById('schedLinkTextInput').value = 'Unsaved';
        $('#schedChangesOnly').prop('checked', false).trigger('change');
        ok($('#schedLinkTextPop').length === 0 && document.getElementById('schedLinkTextCompare').value === 'See what changed' && pCmp.disabled && $(pCmp).hasClass('is-custom'),
            'K6 its option turned off: the open popup closes unsaved, the pencil dims and keeps its mark');
        pFull.click();
        before = window.__centralEsc;
        var ek = keyOn(document.getElementById('schedLinkTextInput'), 'Escape');
        ok($('#schedLinkTextPop').length === 0 && document.activeElement === pFull && ek.defaultPrevented && window.__centralEsc === before,
            'K7 Escape (rung A0.745) cancels any of them and refocuses that pencil');
        ser = window.__pnbLift.serialize();
        ok(ser.indexOf('schedLinkTextCompare=See what changed') !== -1 && ser.indexOf('schedLinkTextFull=Open every row') !== -1 && ser.indexOf('schedLinkTextChart=Bigger chart') !== -1,
            'K8 every text is in the unsaved-changes snapshot');
    }

    run().catch(function (e) { ok(false, 'harness threw: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')); })
        .then(function () { if (CONTROL) ok(false, 'CONTROL: this assertion is false on purpose'); finish(); });
})();
