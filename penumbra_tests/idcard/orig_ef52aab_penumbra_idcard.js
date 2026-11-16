/*
 * Report id card (idcard, 2026-11-03).
 *
 * Hovering the short id at the end of the title crumb ("Penumbra > reports >
 * <id>", #pnbCrumbReport, also moved into the header as #dashboardBreadcrumb by
 * the Dashboard and Split layouts) pops a rich card like the app's other hover
 * tips (the shared .bld-help-pop surface): who authored the report, when it was
 * created and last saved, this viewer's last visit and access, its tags and
 * journal notes (and, for its editors only, its tables), and a link to send
 * feedback to the author.
 *
 * A page load pays NO query for it: created / last saved ride index.php's own
 * authorization row (reportIdCard), the rest was already in penumbra_vars
 * (lastAccess, reportTags, reportTables, journal, the access flags). The one
 * request is the author's NAME, fetched on the first hover only (fetchPerson).
 *
 * Standalone on purpose: no main.js hooks. The crumb keeps its click (reload);
 * its native title="Reload this report" is dropped so the browser tooltip does
 * not stack on the card, and the card's footer says what a click does.
 *
 * penumbra_vars is a top-level CONST: read it bare, never as window.penumbra_vars.
 */
(function () {
    'use strict';

    var SEL = '#pnbCrumbReport .pnb-crumb-item';
    var FEEDBACK_DEFAULT_SPEC = 'freeze ; Bug|What happened?* ; Suggestion|What would help? ; Question|What would you like to know?';
    var bootMs = Date.now();
    var $card = null, cardFor = null, timer = null, copiedTimer = null;

    function vars() {
        try { return (typeof penumbra_vars !== 'undefined' && penumbra_vars) ? penumbra_vars : {}; } catch (e) { return {}; }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function urlId() {
        try { return (new URLSearchParams(window.location.search).get('id') || '').trim(); } catch (e) { return ''; }
    }

    // ---- time ---------------------------------------------------------------
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // 'YYYY-MM-DD HH24:MI' (the server's local time) -> "Nov 3, 2026, 2:05 PM"
    function fmtWhen(txt) {
        var m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(String(txt || ''));
        if (!m) return '';
        var s = MONTHS[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
        if (m[4] !== undefined) {
            var h = parseInt(m[4], 10), ap = h >= 12 ? 'PM' : 'AM';
            h = h % 12; if (h === 0) h = 12;
            s += ', ' + h + ':' + m[5] + ' ' + ap;
        }
        return s;
    }
    // Seconds frozen at render + the time this page has been up.
    function liveSecs(secs) {
        if (typeof secs !== 'number' || secs < 0) return null;
        return secs + Math.max(0, Math.round((Date.now() - bootMs) / 1000));
    }
    function ago(secs) {
        if (secs == null) return '';
        var n;
        if (secs < 60) return 'just now';
        if (secs < 3600) { n = Math.floor(secs / 60); return n + (n === 1 ? ' minute' : ' minutes') + ' ago'; }
        if (secs < 86400) { n = Math.floor(secs / 3600); return n + (n === 1 ? ' hour' : ' hours') + ' ago'; }
        if (secs < 86400 * 2) return 'yesterday';
        if (secs < 86400 * 31) { n = Math.floor(secs / 86400); return n + ' days ago'; }
        if (secs < 86400 * 365) { n = Math.floor(secs / (86400 * 30.44)); n = Math.max(1, n); return n + (n === 1 ? ' month' : ' months') + ' ago'; }
        n = Math.floor(secs / (86400 * 365.25)); n = Math.max(1, n);
        return n + (n === 1 ? ' year' : ' years') + ' ago';
    }
    // A local date for "seconds ago" (the last visit has no server timestamp text).
    function dateOfAgo(secs) {
        var d = new Date(Date.now() - secs * 1000);
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function whenHtml(txt, secs) {
        var w = fmtWhen(txt), a = ago(liveSecs(secs));
        if (!w && !a) return '';
        return esc(w) + (a ? ' <span class="pnb-idc-muted">&middot; ' + esc(a) + '</span>' : '');
    }

    // ---- content ------------------------------------------------------------
    function section(label, items) {
        items = items.filter(Boolean);
        if (!items.length) return '';
        return '<div class="pnb-idc-sec"><div class="pnb-idc-label">' + esc(label) + '</div><ul class="pnb-idc-list">'
            + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
    }
    function listPreview(arr, max) {
        var shown = arr.slice(0, max).map(esc).join(', ');
        return arr.length > max ? shown + ' <span class="pnb-idc-muted">+' + (arr.length - max) + ' more</span>' : shown;
    }
    // ---- the author's name: fetched on first hover, once per page --------------
    // index.php hands over only the owner's Unity ID, so a page load pays nothing
    // for the name. The people picker (get_email_recipients.php, any signed-in
    // user) resolves it; until it answers, or if it cannot, the card shows the id.
    var person = null, personFor = '', personBusy = false;
    function ownerKey(c) { return String(c && c.owner || '').toLowerCase().replace(/@ncsu\.edu$/, '').trim(); }
    function fetchPerson(c) {
        var key = ownerKey(c);
        if (!key || personBusy || personFor === key || typeof fetch !== 'function') return;
        personBusy = true;
        fetch('get_email_recipients.php?term=' + encodeURIComponent(key), { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (rows) {
                var hit = null;
                (Array.isArray(rows) ? rows : []).forEach(function (r) {
                    if (hit || !r) return;
                    var u = String(r.username || '').toLowerCase(), m = String(r.value || '').toLowerCase();
                    if (u === key || m === key + '@ncsu.edu') hit = r;
                });
                person = hit ? {
                    name: String(hit.name || ((hit.fname || '') + ' ' + (hit.lname || ''))).trim(),
                    title: String(hit.title || ''), dept: String(hit.dept || ''),
                    active: (hit.active === undefined || hit.active === null || hit.active === '') ? null : (String(hit.active) === '1' || hit.active === true)
                } : null;
            }, function () { person = null; })
            .then(function () {
                personFor = key; personBusy = false;
                if ($card && cardFor) $card.innerHTML = cardHtml(urlId());   // the open card picks the name up
                if ($card && cardFor) place(cardFor);
            });
    }
    function prefetch() {
        var v = vars(), c = v.reportIdCard, id = urlId();
        if (c && typeof c === 'object' && id && String(c.id || '').toLowerCase() === id.toLowerCase()) fetchPerson(c);
    }
    function personOf(c) { return (person && personFor === ownerKey(c)) ? person : null; }

    function canFeedback(v) {
        return typeof window.penumbraOpenFeedbackDialog === 'function' && !v.isReportOwner;
    }

    function cardHtml(id) {
        var v = vars();
        var c = v.reportIdCard && typeof v.reportIdCard === 'object' ? v.reportIdCard : null;
        // The facts belong to the report the page RENDERED: after an in-page load of
        // another report (pnbCrumbSyncReport retargets the crumb) they would be wrong.
        if (c && String(c.id || '').toLowerCase() !== id.toLowerCase()) c = null;

        var title = '';
        try { title = (document.getElementById('mainReportTitle').textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { }

        var h = '<div class="pnb-idc-head">'
            + '<div class="pnb-idc-title">' + esc(title || 'Report') + '</div>'
            + '<code class="pnb-idc-id">' + esc(id) + '</code></div>';

        var about = [];
        if (c) {
            var who = '', p = personOf(c);
            if (p && p.name) {
                who = '<strong>' + esc(p.name) + '</strong>';
                var sub = [p.title, p.dept].filter(function (s) { return s && String(s).trim(); });
                if (sub.length) who += '<span class="pnb-idc-sub">' + esc(sub.join(', ')) + '</span>';
                if (p.active === false) who += '<span class="pnb-idc-sub pnb-idc-warn">No longer active in the directory</span>';
            } else if (c.owner) {
                who = '<strong>' + esc(c.owner) + '</strong>';
            }
            if (who) about.push('<span class="pnb-idc-k">Authored by</span> ' + who + (v.isReportOwner ? ' <span class="pnb-idc-pill">you</span>' : ''));
            var cr = whenHtml(c.created, c.createdAgo);
            if (cr) about.push('<span class="pnb-idc-k">Created</span> ' + cr);
            var up = whenHtml(c.updated, c.updatedAgo);
            if (up) about.push('<span class="pnb-idc-k">Last modified</span> ' + up);
        }
        h += section('Report', about);

        var you = [];
        if (c) {
            var la = typeof v.lastAccess === 'number' ? v.lastAccess : -1;
            you.push(la < 0
                ? '<span class="pnb-idc-k">Last visit</span> This is your first visit'
                : '<span class="pnb-idc-k">Last visit</span> ' + esc(dateOfAgo(liveSecs(la))) + ' <span class="pnb-idc-muted">&middot; ' + esc(ago(liveSecs(la))) + '</span>');
        }
        var role = v.isReportOwner ? 'Owner' : (v.isGlobalAdmin && !v.noadm) ? 'Administrator'
            : v.canEditReport ? 'Editor, you can change this report' : 'Viewer';
        you.push('<span class="pnb-idc-k">Your access</span> ' + esc(role));
        h += section('You', you);

        var more = [];
        if (c) {
            var tags = Array.isArray(v.reportTags) ? v.reportTags.filter(Boolean).map(String) : [];
            if (tags.length) more.push('<span class="pnb-idc-k">Tags</span> ' + listPreview(tags, 5));
            // Table names are authoring detail: only for those who can edit the report
            // (they see its SQL anyway); a viewer gains nothing from a schema name.
            var tbls = (v.canEditReport && Array.isArray(v.reportTables)) ? v.reportTables.filter(Boolean).map(String) : [];
            if (tbls.length) more.push('<span class="pnb-idc-k">' + (tbls.length === 1 ? 'Table' : tbls.length + ' tables') + '</span> ' + listPreview(tbls, 3));
            var j = v.journal;
            if (j && j.installed && j.enabled && j.total > 0) {
                more.push('<span class="pnb-idc-k">Journal</span> ' + j.total + (j.total === 1 ? ' note' : ' notes')
                    + (j.unseen > 0 ? ' <span class="pnb-idc-muted">(' + j.unseen + ' new to you)</span>' : ''));
            }
            if (v.asOf && v.asOf.when) more.push('<span class="pnb-idc-warn">Showing the version saved ' + esc(fmtWhen(v.asOf.when) || v.asOf.when) + '</span>');
        }
        h += section('Details', more);

        if (c && canFeedback(v)) {
            h += '<div class="pnb-idc-acts"><a href="#" class="pnb-idc-act pnb-idc-act-primary" data-idc="feedback">'
               + 'Send feedback to ' + esc(personOf(c) && personOf(c).name ? personOf(c).name.split(' ')[0] : 'the author') + '</a></div>';
        }
        h += '<div class="pnb-idc-foot"><span>Click the id to reload</span><span class="pnb-idc-links">'
           + '<a href="#" data-idc="copylink">Copy link</a><a href="#" data-idc="copyid">Copy id</a></span></div>';
        return h;
    }

    // ---- show / place / hide -------------------------------------------------
    function place(anchor) {
        if (!$card) return;
        var r = anchor.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        var cw = $card.offsetWidth, ch = $card.offsetHeight;
        var left = r.left, top = r.bottom + 6;
        if (top + ch > vh - 8 && r.top - ch - 6 >= 8) top = r.top - ch - 6;   // flip above
        if (left + cw > vw - 8) left = vw - cw - 8;                            // the Dashboard layout's top-right crumb
        if (left < 8) left = 8;
        if (top + ch > vh - 8) top = vh - ch - 8;
        if (top < 8) top = 8;
        $card.style.left = Math.round(left) + 'px';
        $card.style.top = Math.round(top) + 'px';
    }
    function hide() {
        clearTimeout(timer); timer = null;
        if ($card) { $card.parentNode && $card.parentNode.removeChild($card); $card = null; }
        if (cardFor) cardFor.removeAttribute('aria-describedby');
        cardFor = null;
    }
    function show(anchor) {
        clearTimeout(timer); timer = null;
        var step = document.getElementById('pnbCrumbReport');
        var id = urlId();
        if (!anchor || !document.contains(anchor) || !id || (step && step.hidden)) return;
        if (!$card) {
            $card = document.createElement('div');
            $card.className = 'pnb-idc bld-help-pop open';
            $card.id = 'pnbIdCard';
            $card.setAttribute('role', 'tooltip');
            $card.addEventListener('pointerenter', function () { clearTimeout(timer); timer = null; });
            $card.addEventListener('pointerleave', function () { clearTimeout(timer); timer = setTimeout(hide, 150); });
            $card.addEventListener('click', onCardClick);
            document.body.appendChild($card);
        }
        prefetch();   // keyboard focus comes straight here, without the hover delay
        $card.innerHTML = cardHtml(id);
        cardFor = anchor;
        anchor.setAttribute('aria-describedby', 'pnbIdCard');
        place(anchor);
    }
    function dropTitle(el) {
        // The native tooltip would stack on the card; keep the words for screen readers.
        if (el && el.hasAttribute('title')) {
            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', (el.textContent || '').trim() + ', reload this report');
            el.removeAttribute('title');
        }
    }

    // ---- actions --------------------------------------------------------------
    function copyText(text, linkEl) {
        function done(ok) {
            if (!linkEl) return;
            var was = linkEl.getAttribute('data-label') || linkEl.textContent;
            linkEl.setAttribute('data-label', was);
            linkEl.textContent = ok ? 'Copied' : 'Copy failed';
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(function () { if (linkEl) linkEl.textContent = was; }, 1400);
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
                return;
            }
        } catch (e) { }
        try {
            var ta = document.createElement('textarea');
            ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            done(ok);
        } catch (e2) { done(false); }
    }
    // The author's own feedback call when the page has one (the same rule as the
    // Ctrl+K "Send feedback to the report owner" row): its form, its wording.
    function authoredFeedback() {
        var a = document.querySelector('#reportSnippetOutput a.snippet-action[data-action-name="feedback"], #mainReportSubtitle a.snippet-action[data-action-name="feedback"]');
        if (!a) return null;
        return { spec: a.getAttribute('data-action-value') || '', label: (a.textContent || '').replace(/\s+/g, ' ').trim() || 'Send feedback' };
    }
    function onCardClick(e) {
        var a = e.target && e.target.closest ? e.target.closest('[data-idc]') : null;
        if (!a) return;
        e.preventDefault();
        var what = a.getAttribute('data-idc'), id = urlId();
        if (what === 'feedback') {
            hide();
            var fb = authoredFeedback();
            if (typeof window.penumbraOpenFeedbackDialog === 'function') {
                window.penumbraOpenFeedbackDialog(fb ? fb.spec : FEEDBACK_DEFAULT_SPEC, fb ? fb.label : 'Send feedback to the author');
            }
        } else if (what === 'copyid') {
            copyText(id, a);
        } else if (what === 'copylink') {
            var u = '';
            try { u = new URL('index.php?id=' + encodeURIComponent(id), window.location.href).href; } catch (err) { u = window.location.href; }
            copyText(u, a);
        }
    }

    // ---- wiring ---------------------------------------------------------------
    function anchorOf(target) {
        return target && target.closest ? target.closest(SEL) : null;
    }
    document.addEventListener('pointerover', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;   // touch: the tap is the reload
        var a = anchorOf(e.target);
        if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
        dropTitle(a);
        clearTimeout(timer);
        prefetch();   // the author's name starts loading during the hover delay
        timer = setTimeout(function () { show(a); }, $card ? 0 : 350);
    });
    document.addEventListener('pointerout', function (e) {
        var a = anchorOf(e.target);
        if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
        clearTimeout(timer);
        timer = setTimeout(hide, 150);
    });
    document.addEventListener('focusin', function (e) {
        var a = anchorOf(e.target);
        if (!a) return;
        var kb = true;
        try { kb = a.matches(':focus-visible'); } catch (err) { }
        dropTitle(a);
        if (kb) show(a);
    });
    document.addEventListener('focusout', function (e) {
        if (anchorOf(e.target)) { clearTimeout(timer); timer = setTimeout(hide, 150); }
    });
    document.addEventListener('mousedown', function (e) {
        if (anchorOf(e.target)) hide();
    });
    function follow() {
        if (!$card) return;
        if (cardFor && document.contains(cardFor)) place(cardFor); else hide();
    }
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, { passive: true, capture: true });
    // Escape closes the card. The app's own Escape handler (document, capture
    // phase) claims every Escape, so this listens one step earlier, on window.
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !$card || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        hide();
        e.preventDefault();
        e.stopPropagation();   // the card only: an open lightbox behind it stays open
    }, true);
    function init() {
        var el = document.querySelector(SEL);
        dropTitle(el);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

    // For the test suite and the console.
    window.penumbraIdCard = { html: cardHtml, show: show, hide: hide, ago: ago, fmtWhen: fmtWhen };
})();
