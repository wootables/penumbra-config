// wsmenu: the page half's recorder. Loaded LAST (after js/penumbra_wsmenu.js), so its window contextmenu listener
// sees each right-click after the menu did: who the target was, whether the browser's menu was cancelled
// (prevented), and which menus are open. run.py drives real input over CDP and reads these.
(function () {
    'use strict';
    window.__ctx = [];
    window.__calls = [];
    window.__clicks = [];
    window.__errors = window.__errors || [];
    window.addEventListener('error', function (e) { window.__errors.push(String(e.message) + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno); });
    window.addEventListener('contextmenu', function (e) {
        var t = e.target;
        window.__ctx.push({ id: (t && t.id) || '', tag: (t && t.tagName) || '', prevented: !!e.defaultPrevented,
                            page: !!document.getElementById('pnbPageMenu'), head: !!document.getElementById('pnbHeadMenu') });
    });
    // a click on a control the menu drives (capture: before its own handlers, which may stop it)
    document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[id]') : null;
        if (t && t.id) { window.__clicks.push(t.id); }
    }, true);
    function vis(n) { return !!(n && (n.offsetWidth || n.offsetHeight || n.getClientRects().length)); }
    window.__ws = {
        vis: vis,
        // a spot of white space inside an element: the element itself under the pointer, or one of its container divs
        // (the control bar's gaps are its pager and toolbar wrappers' empty parts)
        gap: function (sel, side) {
            var el = document.querySelector(sel);
            if (!el) { return null; }
            var r = el.getBoundingClientRect(), xs = [], x, y, h, i;
            for (x = Math.ceil(r.left) + 2; x < r.right - 2; x += 3) { xs.push(x); }
            if (side === 'right') { xs.reverse(); }
            for (i = 0; i < xs.length; i++) {
                for (y = Math.ceil(r.top) + 2; y < r.bottom - 2; y += 3) {
                    h = document.elementFromPoint(xs[i], y);
                    if (h === el || (h && h.tagName === 'DIV' && el.contains(h) && !h.matches('[role], [tabindex]'))) { return { x: xs[i], y: y, on: h.id || h.className }; }
                }
            }
            return null;
        },
        center: function (sel) {
            var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
            if (!el) { return null; }
            var r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        },
        // the open menus: the page menu's items (act, label, note, role, checked, disabled, tag, href, target) and its lists
        menu: function () {
            var m = document.getElementById('pnbPageMenu');
            if (!m) { return null; }
            function items(p) {
                return Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item'), function (n) {
                    var lab = n.querySelector('.pnb-hm-label'), note = n.querySelector('.pnb-hm-note'), chk = n.querySelector('.pnb-hm-check');
                    return { act: n.getAttribute('data-act'), label: lab ? lab.textContent : '', note: note ? note.textContent : '', role: n.getAttribute('role'),
                             checked: n.getAttribute('aria-checked'), disabled: n.getAttribute('aria-disabled') === 'true', tag: n.tagName,
                             href: n.getAttribute('href'), target: n.getAttribute('target'), rel: n.getAttribute('rel'), mark: chk ? chk.textContent : '',
                             aria: n.getAttribute('aria-label'), title: n.getAttribute('title'), sub: n.getAttribute('aria-haspopup') === 'menu' };
                });
            }
            var subs = Array.prototype.filter.call(document.querySelectorAll('.pnb-pm.pnb-hm-sub'), function () { return true; });
            var r = m.getBoundingClientRect(), name = m.querySelector('.pnb-hm-name'), foot = m.querySelector('.pnb-hm-foot');
            return { name: name ? name.textContent : '', foot: foot ? foot.textContent : '', items: items(m),
                     rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
                     focus: document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-act') : null,
                     subs: subs.map(function (s) {
                         var sr = s.getBoundingClientRect();
                         return { items: items(s), heads: Array.prototype.map.call(s.querySelectorAll('.pnb-hm-head'), function (h) { return h.textContent; }),
                                  rect: { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom } };
                     }) };
        },
        // an item of the open menu (or of its list at depth d) by act: its center, to click for real
        itemAt: function (act, d) {
            var ps = [document.getElementById('pnbPageMenu')].concat(Array.prototype.slice.call(document.querySelectorAll('.pnb-pm.pnb-hm-sub')));
            var p = ps[d || 0];
            if (!p) { return null; }
            var n = p.querySelector('.pnb-hm-item[data-act="' + act + '"]');
            return n ? window.__ws.center(n) : null;
        },
        select: function (sel) {
            var el = document.querySelector(sel), r = document.createRange();
            r.selectNodeContents(el);
            var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
            var b = r.getBoundingClientRect();
            return { x: Math.round(b.left + Math.min(20, b.width / 2)), y: Math.round(b.top + b.height / 2) };
        },
        spy: function (obj, name, tag) {
            var o = (typeof obj === 'string') ? eval(obj) : obj;   // eslint-disable-line no-eval
            if (!o || typeof o[name] !== 'function' || o[name].__spied) { return !!(o && o[name] && o[name].__spied); }
            var f = o[name];
            o[name] = function () { window.__calls.push(tag); return f.apply(this, arguments); };
            o[name].__spied = true;
            return true;
        }
    };
})();
