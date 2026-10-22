// notepaste suite - browser half (2026-10-21). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__JRRESULT = { scn, asserts: [{id, ok, detail}], errors: [...] } + window.__JRDONE = true.
// Pasting an image into a note attaches it, like a drop:
//   P-*  a paste on a row-note card's text field (the shared mentionField). An image with
//        no text = the card's Attach input takes it (renamed "pasted-YYYY-MM-DD-HHMM.ext"
//        when the clipboard calls it image.png), with the same type + size checks as a drop;
//        text (alone or beside an image, as Excel / Word copy) still pastes as text; an
//        edit (Attach hidden) refuses the image out loud.
//   C-*  the hover preview of an image attachment is up to 900 x 700 (70% of the window).
//
// GROUND TRUTH: the strings and sizes below, written out by hand - never computed by the
// code under test. The harness is notesfresh's (the notescol fixture, real main.js).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JR_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }

  var K3 = window.__NOTED;
  function notesTd(rk) {
    var bs = document.querySelectorAll('#resultsTable > tbody > tr > td[data-column="__JOURNAL_NOTES"] .journal-notes-btn');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === rk) return bs[i].parentNode;
    return null;
  }
  function card() { return document.querySelector('.journal-pvnote-card'); }
  async function openCard(rk) {
    var td = notesTd(rk);
    if (!td) throw new Error('no notes cell for ' + rk);
    clickEl(td.querySelector('.journal-notes-btn'));
    await until(function () { var c = card(); return c && c.getAttribute('data-pvn-key') === rk && c.querySelector('.journal-rownote-input'); }, 3000);
    return card();
  }
  function parts(c) {
    return {
      el: c.querySelector('.journal-rownote-input'),
      input: c.querySelector('.journal-attach-input'),
      sel: c.querySelector('.journal-attach-selected'),
      btn: c.querySelector('.journal-attach-btn')
    };
  }
  function bytes(n) { return new Uint8Array(n); }
  function file(name, type, size) { return new File([bytes(size || 64)], name, { type: type }); }
  // A real paste event: Chrome lets a page build one with its own DataTransfer.
  function paste(el, files, text) {
    el.focus();
    var rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
    var dt = new DataTransfer();
    if (text != null) dt.setData('text/plain', text);
    (files || []).forEach(function (f) { dt.items.add(f); });
    var ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev;
  }
  function picked(p) { return p.input.files && p.input.files.length ? p.input.files[0] : null; }
  function txt(p) { return (p.el.textContent || '').replace(/ /g, ' '); }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(300);
    await until(function () { return !window.__jPending; }, 15000);
    await sleep(700);
  }

  var S = {};
  // a screenshot: image only, called image.png
  S.shot = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('image.png', 'image/png', 2048)], null);
    await sleep(100);
    var f = picked(p);
    rec('P-shot-file', !!f && /^pasted-\d{4}-\d\d-\d\d-\d{4}\.png$/.test(f.name) && f.type === 'image/png' && f.size === 2048,
        f ? f.name + ' ' + f.type + ' ' + f.size : 'no file on the Attach input');
    var pill = p.sel.querySelector('.journal-attach-pill');
    rec('P-shot-pill', !!pill && !!f && pill.textContent.indexOf(f.name) === 0 && !!pill.querySelector('.journal-attach-clear'),
        p.sel.innerHTML);
    rec('P-shot-notext', txt(p) === '', 'field "' + txt(p) + '"');
  };
  // an image with its own name keeps it; the ext follows the name, not the type
  S.named = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('chart.webp', 'image/webp')], null);
    await sleep(100);
    var f = picked(p);
    rec('P-named', !!f && f.name === 'chart.webp', f ? f.name : 'no file');
  };
  // a jpeg called image.jpeg is renamed .jpg
  S.jpeg = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('image.jpeg', 'image/jpeg')], null);
    await sleep(100);
    var f = picked(p);
    rec('P-jpeg', !!f && /^pasted-\d{4}-\d\d-\d\d-\d{4}\.jpg$/.test(f.name), f ? f.name : 'no file');
  };
  // Excel / Word: an image AND text - the text is what pastes
  S.mixed = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('image.png', 'image/png')], 'Q3 total 1,204');
    await sleep(100);
    rec('P-mixed-text', txt(p) === 'Q3 total 1,204', 'field "' + txt(p) + '"');
    rec('P-mixed-nofile', !picked(p) && !p.sel.querySelector('.journal-attach-pill'), 'sel ' + p.sel.innerHTML);
  };
  // plain text, as before
  S.text = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, null, 'Checked with Lee.');
    await sleep(100);
    rec('P-text', txt(p) === 'Checked with Lee.' && !picked(p), 'field "' + txt(p) + '"');
  };
  // over 5 MB: the shared size check refuses it
  S.big = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('image.png', 'image/png', 5 * 1024 * 1024 + 1)], null);
    await sleep(100);
    var tb = p.sel.querySelector('.journal-attach-toobig');
    rec('P-big', !picked(p) && !!tb && /too large \(max 5 MB\)/.test(tb.textContent) && txt(p) === '', p.sel.innerHTML);
  };
  // an SVG is no type a note carries (the drop's own rule)
  S.svg = async function () {
    var p = parts(await openCard(K3));
    paste(p.el, [file('image.svg', 'image/svg+xml')], null);
    await sleep(100);
    var tb = p.sel.querySelector('.journal-attach-toobig');
    rec('P-svg', !picked(p) && !!tb && /not a type a note can carry/.test(tb.textContent), p.sel.innerHTML);
  };
  // an edit changes only the text: Attach is hidden, the image is refused out loud
  S.edit = async function () {
    var c = await openCard(K3), p = parts(c);
    p.btn.style.display = 'none';            // what setCardEdit does to the card
    paste(p.el, [file('image.png', 'image/png')], null);
    await sleep(100);
    var tb = p.sel.querySelector('.journal-attach-toobig');
    rec('P-edit', !picked(p) && !!tb && tb.textContent === 'An edit changes only the text: post the image as a new note.' && txt(p) === '',
        p.sel.innerHTML + ' | field "' + txt(p) + '"');
  };
  // the hover preview: a 2000 x 2000 image shows at 630 x 630 in a 1500 x 900 window
  // (max-height 70vh = 630 binds before max-width 900px); a 3000 x 600 one at 900 wide
  S.pop = async function () {
    function dataUrl(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv.toDataURL('image/png'); }
    async function shown(w, h) {
      var d = document.createElement('div'); d.className = 'journal-attach-pop'; d.style.display = 'block';
      var im = document.createElement('img'); d.appendChild(im); document.body.appendChild(d);
      await new Promise(function (r) { im.onload = r; im.onerror = r; im.src = dataUrl(w, h); });
      var b = im.getBoundingClientRect(); d.remove();
      return [Math.round(b.width), Math.round(b.height)];
    }
    var vw = window.innerWidth, vh = window.innerHeight;
    var a = await shown(2000, 2000), b = await shown(3000, 600);
    var wantH = Math.round(Math.min(700, vh * 0.7)), wantW = Math.round(Math.min(900, vw * 0.7));
    rec('C-pop-tall', a[0] === wantH && a[1] === wantH, 'window ' + vw + 'x' + vh + ': 2000x2000 shows ' + a.join('x') + ', want ' + wantH + 'x' + wantH);
    rec('C-pop-wide', b[0] === wantW && b[1] === Math.round(wantW / 5), '3000x600 shows ' + b.join('x') + ', want ' + wantW + 'x' + Math.round(wantW / 5));
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__JR_ERR, window.__JR_ERR2].filter(Boolean).join('; ');
    R.missing = window.__JR_MISSING || [];
    window.__JRRESULT = R;
    window.__JRDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
