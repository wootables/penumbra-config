// dashsub - browser half: the Dashboard header's Subscribe chip beside a title it fits next to,
// run against the REAL subscription IIFE lifted from js/main.js and the REAL css/main.css by
// run.ps1, with real jQuery. Two schedules (the chip opens the list), so the list's placement
// is testable too. Writes its report into <pre id="out">. ?control=1 adds one false assertion.
(function () {
    var out = [], pass = 0, fail = 0;
    var CONTROL = /[?&]control=1/.test(location.search);
    function ok(c, label, detail) {
        if (c) { pass++; out.push('ok   ' + label); }
        else { fail++; out.push('FAIL ' + label + (detail !== undefined ? '\n       got: ' + detail : '')); }
    }
    function finish() {
        out.push('PASS: ' + pass + '   FAIL: ' + fail);
        document.getElementById('out').textContent = out.join('\n');
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    // Let the page react: pump its ResizeObservers (harness.html - no frames here), let its
    // timer run, and pump again for what that changed (the browser's next frame).
    async function settle() {
        window.__roPump(); await sleep(60);
        window.__roPump(); await sleep(60);
        window.__roPump(); await sleep(60);
    }

    var hdr = document.getElementById('reportHeaderContainer');
    var panel = document.getElementById('reportInfoPanel');
    var title = document.getElementById('mainReportTitle');
    var sub = document.getElementById('mainReportSubtitle');
    var crumb = document.getElementById('dashboardBreadcrumb');
    function chip() { return document.getElementById('pnbSubscribeBtn'); }
    function R(el) { return el.getBoundingClientRect(); }
    function beside() { return panel.classList.contains('pnb-sub-beside'); }
    function avail() {
        var cs = getComputedStyle(panel);
        return panel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    // What "fits" means, measured independently: the title on one line + 12px + the chip.
    function oneLineTitle() {
        var keep = title.style.width;
        title.style.width = 'max-content';
        var w = R(title).width;
        title.style.width = keep;
        return w;
    }
    function need() { return oneLineTitle() + 12 + R(chip()).width; }
    // Resize the header so the panel's content box is exactly `target` px wide.
    function setAvail(target) {
        hdr.style.width = (parseFloat(hdr.style.width || R(hdr).width) + target - avail()) + 'px';
    }
    function besideLook() {   // on the title's line, 12px after it, centred on it, above the subtitle
        var t = R(title), c = R(chip()), s = R(sub);
        var gap = c.left - t.right, dc = Math.abs((c.top + c.bottom) / 2 - (t.top + t.bottom) / 2);
        return { ok: Math.abs(gap - 12) <= 1 && dc <= 2 && c.bottom <= s.top + 0.5,
            detail: 'gap ' + gap.toFixed(1) + ', centre offset ' + dc.toFixed(1) + ', chip bottom ' + c.bottom.toFixed(1) + ', subtitle top ' + s.top.toFixed(1) };
    }
    function belowLook() {    // its own row under the subtitle, at the panel's left edge (as before)
        var c = R(chip()), s = R(sub), left = R(panel).left + parseFloat(getComputedStyle(panel).paddingLeft);
        return { ok: c.top >= s.bottom - 0.5 && Math.abs(c.left - left) <= 1,
            detail: 'chip top ' + c.top.toFixed(1) + ', subtitle bottom ' + s.bottom.toFixed(1) + ', chip left ' + c.left.toFixed(1) + ' vs panel ' + left.toFixed(1) };
    }
    function look(fn, label) { var r = fn(); ok(r.ok, label, r.detail); }

    (async function () {
        await settle();
        ok(!!chip(), 'setup: the chip rendered');
        if (!chip()) { finish(); return; }

        // T1 - a short title: the chip rides beside it.
        ok(beside(), 'T1 short title: flagged beside');
        look(besideLook, 'T1 short title: the chip on the title line, 12px after it, centred, above the subtitle');

        // T2 - a title that wraps: the chip keeps its row under the subtitle.
        title.textContent = 'Proposal Hit Ratio by College, Department and Principal Investigator for Fiscal Years 2019 through 2026, with Sponsor Detail';
        await settle();
        ok(R(title).height > 45, 'T2 sanity: the long title wraps', R(title).height);
        ok(!beside(), 'T2 long title: not beside');
        look(belowLook, 'T2 long title: the chip on its own row under the subtitle');

        // T3 - the boundary, both ways. The title alone fits on one line throughout.
        title.textContent = 'Awards by Federal Sponsor and College';
        await settle();
        var n = need();
        setAvail(n - 6);
        await settle();
        ok(R(title).height < 45, 'T3a sanity: the title alone still fits on one line', R(title).height);
        ok(!beside(), 'T3a 6px short of title + gap + chip: not beside', 'need ' + n.toFixed(1) + ', avail ' + avail().toFixed(1));
        look(belowLook, 'T3a the chip under the subtitle');
        setAvail(n + 6);
        await settle();
        ok(beside(), 'T3b widened to 6px past it: beside', 'need ' + n.toFixed(1) + ', avail ' + avail().toFixed(1));
        look(besideLook, 'T3b the chip beside the title');
        setAvail(n - 6);
        await settle();
        ok(!beside(), 'T3c narrowed again FROM beside (title squeezed in its track): back under the subtitle', 'avail ' + avail().toFixed(1));
        look(belowLook, 'T3c the chip under the subtitle');
        // T3d - a shorter title on the same one line: only the title resizes.
        title.textContent = 'Hit Ratio';
        await settle();
        ok(beside(), 'T3d a shorter title (same panel size): beside');
        look(besideLook, 'T3d the chip beside the title');

        // T4 - the beside grid is Dashboard's only.
        hdr.style.width = '900px';
        title.textContent = 'Hit Ratio';
        await settle();
        ok(beside(), 'T4 setup: beside in Dashboard');
        hdr.classList.remove('layout-dashboard');
        await settle();
        look(belowLook, 'T4 Default layout: the chip keeps its own row under the subtitle');
        hdr.classList.add('layout-dashboard');
        await settle();
        ok(beside(), 'T4 back to Dashboard: beside');
        look(besideLook, 'T4 back to Dashboard: the chip beside the title');

        // T5 - only the chip changes. Growing it squeezes the title (the title resizes);
        // shrinking it back under the subtitle resizes nothing but the chip.
        var txt = chip().querySelector('.pnb-sub-chip-txt');
        var label = txt.textContent, more = '';
        while (need() <= avail() + 0.5) { more += ' and more'; txt.textContent = label + more; }
        await settle();
        ok(!beside(), 'T5a a chip label too long to share the line: not beside');
        look(belowLook, 'T5a the chip under the subtitle');
        txt.textContent = label;
        await settle();
        ok(beside(), 'T5b the label back to "' + label + '": beside again');
        look(besideLook, 'T5b the chip beside the title');

        // T6 - hidden (F2 / snapshot band) keeps the answer: no jump when it comes back.
        panel.style.display = 'none';
        await settle();
        ok(beside(), 'T6 hidden panel: the flag is kept');
        panel.style.display = 'block';
        ok(beside(), 'T6 shown again: already beside on the first frame');
        look(besideLook, 'T6 shown again: the chip already beside the title');

        // T7 - the schedule list opens from the chip's left edge, and slides back into the
        // window when the chip sits at its right edge.
        chip().click();
        await sleep(60);
        var pop = document.querySelector('.pnb-sub-pop');
        ok(!!pop && Math.abs(R(pop).left - R(chip()).left) <= 0.5, 'T7a room to the right: the list opens at the chip\'s left edge',
            pop ? R(pop).left.toFixed(1) + ' vs ' + R(chip()).left.toFixed(1) : 'no list');
        if (pop) chip().click();
        await sleep(60);
        crumb.style.display = 'none';
        hdr.style.width = document.documentElement.clientWidth + 'px';
        await settle();
        title.style.paddingRight = Math.floor(avail() - need() - 1) + 'px';
        await settle();
        var vw = document.documentElement.clientWidth;
        ok(beside() && R(chip()).right > vw - 60, 'T7b setup: the chip beside the title at the window\'s right edge', R(chip()).right.toFixed(1) + ' of ' + vw);
        chip().click();
        await sleep(60);
        pop = document.querySelector('.pnb-sub-pop');
        var pr = pop ? R(pop) : null;
        ok(!!pr && pr.right <= vw - 8 + 0.5 && pr.left >= 0, 'T7b the list stays inside the window (8px margin)',
            pr ? 'left ' + pr.left.toFixed(1) + ', right ' + pr.right.toFixed(1) + ' of ' + vw : 'no list');
        ok(!!pr && Math.abs(pr.top - (R(chip()).bottom + 5)) <= 1.5, 'T7b the list still opens under the chip', pr ? pr.top.toFixed(1) : 'no list');
        if (pop) chip().click();

        // T8 - no script errors on the way (a check made inside the ResizeObserver callback
        // shows up here as "ResizeObserver loop completed with undelivered notifications").
        ok(window.__errs.length === 0, 'T8 no script errors', window.__errs.join(' | '));

        if (CONTROL) ok(false, 'CONTROL: the one deliberate failure');
        finish();
    })().catch(function (e) { ok(false, 'harness threw', String(e && e.stack || e)); finish(); });
})();
