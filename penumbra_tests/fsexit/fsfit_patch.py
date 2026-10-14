# =============================================================================
# FSFIT PATCHER (2026-10-01) - report charts re-fit; applies the change to fresh
# copies of the LIVE files, so a re-stage after another session's deploy is one
# run (no hand edits). Every anchor must be found exactly once.
#
#   py -3 fsfit_patch.py <work dir>
#     -> <work>\orig\...  the live files as copied   (+ <work>\orig.sha256)
#        <work>\stage\... the patched files           (js\main.js, css\main.css
#                                                       untouched, help_content.php, README.md)
# Written after the local scratchpad was wiped mid-session (17:20): the work dir
# belongs on this share, not under %TEMP%.
# =============================================================================
import hashlib, os, shutil, sys

APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
FILES = ['js/main.js', 'css/main.css', 'help_content.php', 'README.md']

MAIN_JS = [
(r'''        var progressRaf = null;
        var progressStart = 0;
        var DURATION = Math.round(intervalSec * 1000);
''', r'''        var progressRaf = null;
        var progressStart = 0;
        // The viewport the page on stage was mounted for (renderCurrent records
        // it): the re-fit near the end re-mounts when the viewport settles at
        // another size. _ccMountPending: the first mount is waiting for a
        // click-launched carousel's fullscreen to settle (also near the end).
        var _ccFitW = 0, _ccFitH = 0, _ccMountPending = false, _ccFitTimer = null;
        var DURATION = Math.round(intervalSec * 1000);
'''),
(r'''        // of the "incomplete chart on first open" bug.
        function renderCurrent() {
            var entry = entries[currentIdx];
''', r'''        // of the "incomplete chart on first open" bug.
        // keepProgress: a re-fit to a new viewport size re-mounts the SAME page
        // and must not restart its countdown - only navigation does.
        function renderCurrent(keepProgress) {
            // Whatever mounts first ends the wait for a click-launched
            // fullscreen (a navigation can beat it - see the end).
            _ccMountPending = false;
            var entry = entries[currentIdx];
'''),
(r'''            $overlay.find('.cc-dot').removeClass('active').attr('aria-selected', 'false')
                .filter('[data-idx="' + currentIdx + '"]').addClass('active').attr('aria-selected', 'true');
            resetProgress();
        }
''', r'''            $overlay.find('.cc-dot').removeClass('active').attr('aria-selected', 'false')
                .filter('[data-idx="' + currentIdx + '"]').addClass('active').attr('aria-selected', 'true');
            // Both mounts size from the viewport at this moment: the re-fit's baseline.
            _ccFitW = window.innerWidth; _ccFitH = window.innerHeight;
            if (!keepProgress) { resetProgress(); }
        }
'''),
(r'''            // Stop listening for viewport resizes - the overlay is going away.
            $(window).off('resize.chartCarouselSlide');
            $(document).off('keydown.chartCarousel');
''', r'''            // Stop listening for viewport resizes - the overlay is going away
            // (and leaving fullscreen is itself a resize the re-fit would see).
            $(window).off('resize.chartCarouselSlide resize.ccFit');
            clearTimeout(_ccFitTimer);
            _ccMountPending = false;
            $(document).off('keydown.chartCarousel');
'''),
(r'''         * Fullscreen button; the viewer's click on THAT is an activation, so the
         * same call succeeds the second time.
         */
        function _ccGoFullscreen() {
            var el = $overlay[0];
            var fn = el.requestFullscreen || el.webkitRequestFullscreen;
            if (!fn) return; // no API at all - never offer a button that cannot work
            try {
                var p = fn.call(el);
''', r'''         * Fullscreen button; the viewer's click on THAT is an activation, so the
         * same call succeeds the second time.
         *
         * Returns the request's promise (null for the old prefixed call or no
         * API) - the first mount waits on it, see the end of openChartCarousel.
         */
        function _ccGoFullscreen() {
            var el = $overlay[0];
            var fn = el.requestFullscreen || el.webkitRequestFullscreen;
            if (!fn) return null; // no API at all - never offer a button that cannot work
            var p = null;
            try {
                p = fn.call(el);
'''),
(r'''                $overlay.toggleClass('cc-fs-denied', !inFs);
            }, 150);
        }
''', r'''                $overlay.toggleClass('cc-fs-denied', !inFs);
            }, 150);
            return (p && typeof p.then === 'function') ? p : null;
        }
'''),
(r'''        // later size changes; charts re-fit on their own.
''', r'''        // later size changes; chart pages re-mount through the re-fit below.
'''),
(r'''            $overlay.toggleClass('cc-bg-hidden', document.hidden);
        });

        _ccGoFullscreen();
''', r'''            $overlay.toggleClass('cc-bg-hidden', document.hidden);
        });

        // Read BEFORE asking: a granted request consumes the activation.
        var _ccFsGesture = !!(navigator.userActivation && navigator.userActivation.isActive);
        var _ccFsAsk = _ccGoFullscreen();
'''),
(r'''        // Persistent (embedded-tile) overlays live inside an iframe whose box
        // can change under them: a tile that reloads during the dashboard's
        // edit mode mounts against a frame the edit chrome has shrunk (~37px
        // head), and Done grows it back; tiles can also be drag-resized. The
        // mount bakes the viewport into the canvas, so re-mount the current
        // page when the frame settles at a new size. (_ccRefitActiveSlide
        // above only re-scales the slide DOM - the chart canvas needs the
        // full remount.)
        if (persistentOpt) {
            var _ccPfitTimer = null;
            var _ccPfitW = window.innerWidth, _ccPfitH = window.innerHeight;
            $(window).on('resize.ccPersistentFit', function () {
                clearTimeout(_ccPfitTimer);
                _ccPfitTimer = setTimeout(function () {
                    if (window.innerWidth === _ccPfitW && window.innerHeight === _ccPfitH) { return; }
                    _ccPfitW = window.innerWidth; _ccPfitH = window.innerHeight;
                    try { renderCurrent(); } catch (eRf) { /* keep the current mount */ }
                }, 200);
            });
        }

        renderCurrent();
    }
''', r'''        // Re-fit: both mounts bake the viewport size into the page, so re-mount
        // it when the viewport settles at another size (200 ms debounce; the
        // countdown is not restarted). Report pages: the ⛶ on a windowed
        // (autoload) carousel and window resizes left a chart PAGE at its old
        // size - small, with empty bands, in the new stage. Their slides keep
        // the re-scale above and are not re-mounted here. Embedded tiles
        // (persistent) re-mount every page kind: the frame changes under them -
        // a tile that reloads during the dashboard's edit mode mounts against a
        // frame the edit chrome has shrunk (~37px head) and Done grows it back;
        // drag-resize; the tile's own fullscreen. close() unbinds this.
        $(window).on('resize.ccFit', function () {
            clearTimeout(_ccFitTimer);
            _ccFitTimer = setTimeout(function () {
                if (_ccMountPending || !$overlay.parent().length) { return; }
                if (window.innerWidth === _ccFitW && window.innerHeight === _ccFitH) { return; }
                var _fitEntry = entries[currentIdx];
                if (!persistentOpt && _fitEntry && _fitEntry.kind === 'slide') { return; }
                try { renderCurrent(true); } catch (eRf) { /* keep the current mount */ }
            }, 200);
        });

        // The FIRST mount waits for a click-launched carousel's fullscreen. A
        // click is a gesture, so the browser grants the request - but only after
        // this function returns: the viewport grows a beat later. Mounted now,
        // a chart page was sized for the WINDOW (empty bands above and below in
        // the fullscreen stage), and re-fitting it then would play its entry
        // animation twice. So mount when the request settles - granted or
        // refused, 1 s at most - once, at the final size. No gesture (the
        // autoload path, an embedded tile): the browser refuses, so mount at
        // once as before - the autoload spinner hand-off relies on that.
        if (_ccFsGesture && _ccFsAsk) {
            _ccMountPending = true;
            var _ccFirstMount = function () {
                if (!_ccMountPending) { return; }   // already mounted (a navigation) or closed
                if ($overlay.parent().length) { renderCurrent(); }
            };
            _ccFsAsk.then(_ccFirstMount, _ccFirstMount);
            setTimeout(_ccFirstMount, 1000);
        } else {
            renderCurrent();
        }
    }
'''),
]

HELP = [
(r'''The button only ever appears in that refused case. <code>F11</code> also works and is worth knowing for a kiosk screen.''',
 r'''The button only ever appears in that refused case. <code>F11</code> also works and is worth knowing for a kiosk screen. Either way the chart fills the space it has, and it re-fits when that space changes: entering true fullscreen, or resizing the window.'''),
]

README = [
(r'''# the tile stays and the fullscreen button is offered again. A report's own x still closes.
# Browser-only and REAL fullscreen (it needs a gesture): headless Edge over CDP with trusted
# mouse / key events, the REAL main.js + main.css in a same-origin frame of a dashboard stand-in.
# Scenarios: tile (the button, the x, back to the tile - twice), kiosk (the stand-in fullscreen
# first, as kiosk view is: the x unwinds ONLY the tile), esc (a windowed Escape that reaches the
# tile leaves it up; in fullscreen the browser keeps Esc and the tile stays), report (top level,
# not an embed: the x closes the carousel). The screen is 1600x1000 under a smaller window: with
# headless's default 800x600 screen under a bigger window, entering fullscreen SHRINKS the
# viewport and a report chart mounted at the old size covers the x (not a real-monitor case).
# Measured 2026-10-01 on the stage: 23/0; --control (the build before the change) red on exactly
# T-x T-name T-exit T-stay T-again K-x K-exit; --mutants 4/4 (nocss, noexit, closeall, noname).
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\fsexit\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\fsexit\run.py --mutants
''', r'''# the tile stays and the fullscreen button is offered again. A report's own x still closes.
# Same day, report charts RE-FIT (fsfit): both carousel mounts size the page from the viewport at
# that moment, and only tiles and slides followed later changes, so a click-launched chart - mounted
# before the browser granted fullscreen - kept the WINDOW's size (212 px of empty height in a
# 1000 px screen). The first mount of a click-launched carousel now waits for the fullscreen
# request to settle (1 s at most) and mounts once at the final size; every overlay re-mounts its
# chart page when the viewport settles at a new size (a report's slides keep their own re-scale),
# without restarting the slideshow countdown; close() unbinds the handler.
# Browser-only and REAL fullscreen (it needs a gesture): headless Edge over CDP with trusted
# mouse / key events, the REAL main.js + main.css in a same-origin frame of a dashboard stand-in.
# Scenarios: tile (the button, the x, back to the tile - twice; the chart fills both stages), kiosk
# (the stand-in fullscreen first, as kiosk view is: the x unwinds ONLY the tile), esc (a windowed
# Escape that reaches the tile leaves it up; in fullscreen the browser keeps Esc and the tile
# stays), report (top level, not an embed: the x closes the carousel and unbinds), fit (a
# click-launched chart fills the fullscreen stage, mounted once - a Chart.js plugin counts the
# mounts), win (a two-page carousel opened with no gesture, windowed like autoload: re-fits when the
# viewport shrinks and grows back - CDP device-metrics override - and after its fullscreen button;
# page 2 still arrives at 4 s). The screen is 1600x1000 under a smaller window, as a maximized
# window on a real monitor (headless defaults to an 800x600 screen).
# Measured 2026-10-01 on the stage: 35/0; --control (the build before fsfit) red on exactly F-size
# W-shrink W-grow W-fs; --control-fsexit (before the x) red on those plus T-x T-name T-exit T-stay
# T-again K-x K-exit; --mutants 9/9 (nocss, noexit, closeall, noname, nodefer, norefit, resetprog,
# nounbind, nobaseline). ~25 s.
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\fsexit\run.py
py -3 \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\fsexit\run.py --mutants
'''),
]

def apply(text, edits, crlf):
    for old, new in edits:
        if crlf:
            old, new = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        n = text.count(old)
        if n != 1:
            raise SystemExit('anchor found %d times: %r' % (n, old[:120]))
        text = text.replace(old, new)
    return text

def endings(b):
    crlf = b.count(b'\r\n'); lf = b.count(b'\n') - crlf
    return crlf, lf, b.count(b'\x00')

work = sys.argv[1]
for sub in ('orig', 'stage'):
    for d in ('js', 'css'):
        os.makedirs(os.path.join(work, sub, d), exist_ok=True)
lines = []
for rel in FILES:
    src = os.path.join(APP, *rel.split('/'))
    b = open(src, 'rb').read()
    open(os.path.join(work, 'orig', *rel.split('/')), 'wb').write(b)
    lines.append('%s *%s' % (hashlib.sha256(b).hexdigest(), rel))
    t = b.decode('utf-8', 'surrogateescape')
    if rel == 'js/main.js': t = apply(t, MAIN_JS, True)
    elif rel == 'help_content.php': t = apply(t, HELP, True)
    elif rel == 'README.md': t = apply(t, README, False)
    nb = t.encode('utf-8', 'surrogateescape')
    open(os.path.join(work, 'stage', *rel.split('/')), 'wb').write(nb)
    e0, e1 = endings(b), endings(nb)
    print('%-17s %s  CRLF/loneLF/NUL %s -> %s%s' % (rel, 'patched ' if nb != b else 'as live', e0, e1,
          '' if (e0[1] == 0) == (e1[1] == 0) and e0[2] == e1[2] else '   LINE-ENDING STYLE CHANGED'))
open(os.path.join(work, 'orig.sha256'), 'w', newline='\n').write('\n'.join(lines) + '\n')
print('wrote %s' % os.path.join(work, 'orig.sha256'))
