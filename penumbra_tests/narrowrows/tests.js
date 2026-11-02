// narrowrows - the health hub's row lists in a narrow card (2026-11-01). See run.ps1.
// Layout is read synchronously after the lists are copied in: a container query
// resolves in the same style pass, so no frame has to run (headless virtual time
// renders none after the first).
(function () {
    var tpl = document.getElementById('lists');
    ['w466', 'w386', 'w683'].forEach(function (id) { document.getElementById(id).appendChild(tpl.content.cloneNode(true)); });

    var lines = [], pass = 0, fail = 0;
    function ok(name, cond, got) {
        if (cond) pass++; else fail++;
        lines.push((cond ? 'ok   ' : 'FAIL ') + name + (got === undefined ? '' : '   (' + got + ')'));
    }
    function R(e) { return e.getBoundingClientRect(); }
    function list(probe, kind) { return document.querySelector('#' + probe + ' .pnb-rows-' + kind); }
    function rows(probe, kind) { return Array.prototype.slice.call(list(probe, kind).querySelectorAll('.pnb-row')); }
    function cell(row, k) { return row.querySelector(':scope > .' + k); }
    function each(probe, kind, fn) { return rows(probe, kind).map(fn); }
    function minOf(a) { return Math.min.apply(null, a); }
    function maxOf(a) { return Math.max.apply(null, a); }
    function widths(probe, kind, k) { return each(probe, kind, function (r) { return Math.round(R(cell(r, k)).width); }); }
    // How far any part of a row reaches past the list's right edge (a row's own
    // padding keeps a healthy one at -8).
    function past(probe, kind) {
        var l = list(probe, kind), lr = R(l).right;
        return maxOf(Array.prototype.slice.call(l.querySelectorAll('.pnb-row *'))
            .filter(function (e) { return R(e).width > 0; })
            .map(function (e) { return Math.round(R(e).right - lr); }));
    }
    function sameLine(probe, kind, a, b) {
        return each(probe, kind, function (r) { return Math.abs(R(cell(r, a)).top - R(cell(r, b)).top) < 2; }).every(Boolean);
    }
    function whole(probe, kind, k) {   // the cell's text is not clipped
        return each(probe, kind, function (r) { var e = cell(r, k); return e.scrollWidth <= e.clientWidth + 1; }).every(Boolean);
    }
    // the wordy cell starts below everything on the line above it
    function ownLine(probe, kind) {
        return each(probe, kind, function (r) {
            var p = R(cell(r, 'p')).top;
            return p >= Math.max(R(cell(r, 'to')).bottom, R(cell(r, 'k')).bottom) - 1;
        }).every(Boolean);
    }

    if (window.innerWidth >= 761) {
        // 466px: the hub's left column at a 1364px window (the reported case)
        var pw = widths('w466', 'out', 'p');
        ok('466 outage: the cause gets room (>= 200px)', minOf(pw) >= 200, pw.join(','));
        var ph = each('w466', 'out', function (r) { return Math.round(R(r.querySelector('.pt')).height); });
        ok('466 outage: the cause reads across, not down (<= 60px tall)', maxOf(ph) <= 60, ph.join(','));
        var under = each('w466', 'out', function (r) {
            var t = R(cell(r, 't')), to = R(cell(r, 'to'));
            return Math.abs(t.left - to.left) < 2 && to.top >= t.bottom - 1 && to.top - t.bottom <= 4;
        });
        ok('466 outage: the end time sits right under the start', under.every(Boolean), under.join(','));
        ok('466 outage: the checks stay on the first line', sameLine('w466', 'out', 't', 'k'));
        ok('466 outage: nothing past the card edge', past('w466', 'out') <= 0, past('w466', 'out'));
        var jw = widths('w466', 'jobs', 'd');
        ok('466 job: the name gets room (>= 150px)', minOf(jw) >= 150, jw.join(','));
        var jh = each('w466', 'jobs', function (r) { return Math.round(R(cell(r, 'd')).height); });
        ok('466 job: the name reads across, not down (<= 60px tall)', maxOf(jh) <= 60, jh.join(','));
        ok('466 job: the last run shows whole', whole('w466', 'jobs', 'to'));
        ok('466 job: the detail has a line of its own', ownLine('w466', 'jobs'));
        ok('466 job: nothing past the card edge', past('w466', 'jobs') <= 0, past('w466', 'jobs'));
        var rw = widths('w466', 'runs', 'd');
        ok('466 run: the name gets room (>= 150px)', minOf(rw) >= 150, rw.join(','));
        ok('466 run: the message has a line of its own', ownLine('w466', 'runs'));
        ok('466 run: nothing past the card edge', past('w466', 'runs') <= 0, past('w466', 'runs'));
        var dw = widths('w466', 'dl', 'p');
        ok('466 delivery: the detail gets room (>= 300px)', minOf(dw) >= 300, dw.join(','));
        ok('466 delivery: the log link stays on the first line', sameLine('w466', 'dl', 't', 'k'));
        var edge = each('w466', 'dl', function (r) { return Math.round(R(r).right - 8 - R(r.querySelector('.pnb-log-jump')).right); });
        ok('466 delivery: the log link sits at the right edge', maxOf(edge) <= 2, edge.join(','));

        // 386px: the narrowest two-column window (1160px)
        var pw2 = widths('w386', 'out', 'p');
        ok('386 outage: the cause gets room (>= 200px)', minOf(pw2) >= 200, pw2.join(','));
        ok('386 outage: the component shows whole', whole('w386', 'out', 'c'));
        ok('386 outage: nothing past the card edge', past('w386', 'out') <= 0, past('w386', 'out'));
        var jw2 = widths('w386', 'jobs', 'd');
        ok('386 job: the name gets room (>= 150px)', minOf(jw2) >= 150, jw2.join(','));
        ok('386 job: nothing past the card edge', past('w386', 'jobs') <= 0, past('w386', 'jobs'));
        var rw2 = widths('w386', 'runs', 'd');
        ok('386 run: the name gets room (>= 150px)', minOf(rw2) >= 150, rw2.join(','));
        ok('386 run: nothing past the card edge', past('w386', 'runs') <= 0, past('w386', 'runs'));
        var dw2 = widths('w386', 'dl', 'p');
        ok('386 delivery: the detail gets room (>= 300px)', minOf(dw2) >= 300, dw2.join(','));

        // 683px: a 1920px window - the one-line layouts stay
        ok('683 outage: one line per episode', sameLine('w683', 'out', 't', 'to') && sameLine('w683', 'out', 't', 'p'));
        ok('683 job: the controls stay beside the name', sameLine('w683', 'jobs', 't', 'k'));
        ok('683 run: the figures stay beside the name', sameLine('w683', 'runs', 't', 'k'));
        ok('683 delivery: one line per failure', sameLine('w683', 'dl', 't', 'p'));
    } else {
        // a phone-width window: the layout under 761px is the media query's, untouched
        var tw = widths('w466', 'out', 'to');
        ok('phone window: an outage end time keeps its own full line', minOf(tw) >= 400, tw.join(','));
    }
    if (/[?&]control=1/.test(location.search)) ok('CONTROL: a deliberately false assertion', false);

    document.getElementById('out').textContent = lines.join('\n') + '\nPASS: ' + pass + '   FAIL: ' + fail;
})();
