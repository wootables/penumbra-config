"""Pop-out tooltip hosting (2026-09-25) - anchor-based patch for js/main.js.

"When using 'Open in Window' from the admin console, the shortcut
helpers/functions tooltips show behind the window."  jQuery UI's tooltip
widget appends each tooltip (and its aria-live region) to the body of the
document it captured at CREATION and flip/fits it against the global window,
so every console tooltip built while docked kept opening in the TAB after the
console moved into its own window.  The fix decides per OPEN from the target's
ownerDocument (a prototype patch next to _pipRetargetUiWidgets), and closes any
tooltip still open on a console element before the console changes windows
(_pipCloseTooltips, called from _mountConsoleIn and restoreAdminFromPip).

    py -3 patch_tiphost.py forward <file>   apply   (refuses if already applied)
    py -3 patch_tiphost.py reverse <file>   remove  (refuses if not applied)
    py -3 patch_tiphost.py check   <file>   report hunk state, exit 0 = all applied

<file> is js/main.js (CRLF) or README.md (LF; the section 3 suite entry and
count), chosen by its name.  Bytes in, bytes out: main.js carries a NUL byte,
so nothing here decodes it.  Every anchor must match exactly once or the file
is left alone.
"""
import os
import sys

CRLF = b"\r\n"
LF = b"\n"


def lines(*ls):
    return CRLF.join(l.encode("utf-8") for l in ls)


def lf_lines(*ls):
    return LF.join(l.encode("utf-8") for l in ls)


# ---- hunk 1: say where tooltips went, in the PIP_UI_KEYS comment ----------
H1_OLD = lines(
    "    // given document; widgets created while popped out are correct already.",
    "    var PIP_UI_KEYS = [",
)
H1_NEW = lines(
    "    // given document; widgets created while popped out are correct already.",
    "    // (Tooltips are not in this list - see the per-open hosting just below.)",
    "    var PIP_UI_KEYS = [",
)

# ---- hunk 2: the per-open tooltip hosting ----------------------------------
ANCHOR2 = lines("    // Keep the console's internal flex container sized to the PiP window")
BLOCK = lines(
    "    // jQuery UI tooltips open in the document of the element they describe.",
    "    //",
    "    // THE TRAP (user-reported 2026-09-25: \"the shortcut helpers/functions",
    "    // tooltips show behind the window\"): the tooltip widget appends each",
    "    // tooltip, and its aria-live region, to the body of the document it",
    "    // captured at CREATION (this.document), and flips/fits it against the",
    "    // GLOBAL window. The Custom Code helpers (penumbra_snippet_help.js), the",
    "    // function underlines (#report-options-tab) and the cron + File Drop",
    "    // string() help are all built while the console is docked, so after \"Open",
    "    // in Window\" their tooltips kept opening in the tab, behind the console",
    "    // window. A title tooltip opened by keyboard focus did the same (the",
    "    // global $(document).tooltip hears the forwarded focusin). And a panel",
    "    // first built INSIDE the pop-out captured THAT document, so after Return to",
    "    // Tab its tooltips went into the closed window.",
    "    //",
    "    // Not a PIP_UI_KEYS entry: the global instance lives on the main document",
    "    // and serves BOTH windows at once, so there is no one document to retarget",
    "    // it to. Decided per OPEN instead, the same rule as _pnbBodyFor(e): the",
    "    // target's own document wins. Docked, that IS this.document and its window",
    "    // IS the global one, so every path below is stock jQuery UI 1.13.2.",
    "    (function () {",
    "        var proto = $.ui && $.ui.tooltip && $.ui.tooltip.prototype;",
    "        if (!proto || proto._pnbOwnDocument) return;",
    "        proto._pnbOwnDocument = true;",
    "        var stockOpen = proto._open;",
    "",
    "        // Stock is these lines with this.document[0].body as the fallback.",
    "        proto._appendTo = function (target) {",
    "            var front = target.closest('.ui-front, dialog');",
    "            if (front.length) return front;",
    "            var doc = target[0] && target[0].ownerDocument;",
    "            return (doc && doc.body) || this.document[0].body;",
    "        };",
    "",
    "        proto._open = function (event, target) {",
    "            var doc = target && target[0] && target[0].ownerDocument;",
    "            // jQuery UI's screen-reader copy of the text: keep it in the",
    "            // window the user is working in.",
    "            var live = this.liveRegion && this.liveRegion[0];",
    "            if (live && doc && doc.body && live.ownerDocument !== doc) {",
    "                try { doc.body.appendChild(live); } catch (err) { }",
    "            }",
    "            // position() defaults `within` to the tab's window: flip/fit a",
    "            // pop-out tooltip against its own window's size instead.",
    "            var pos = this.options.position;",
    "            if (!doc || doc === document || !doc.defaultView || !pos || pos.within) {",
    "                return stockOpen.apply(this, arguments);",
    "            }",
    "            pos.within = doc.defaultView;",
    "            try { return stockOpen.apply(this, arguments); }",
    "            finally { delete pos.within; }",
    "        };",
    "    })();",
    "",
    "    // A tooltip OPEN on a console element when the console changes windows -",
    "    // usually the one on the button that was just clicked - is left behind in",
    "    // the window the console leaves (visible there until its phantom timer",
    "    // fires), and its target ignores the next hover until that stale state is",
    "    // cleared. Close them before every move. triggerHandler runs only the",
    "    // target's own close handlers; nothing bubbles to the document.",
    "    function _pipCloseTooltips(rootEl) {",
    "        try {",
    "            $(rootEl).find('*').addBack().each(function () {",
    "                if (!$.data(this, 'ui-tooltip-open')) return;",
    "                $(this).triggerHandler('mouseleave');",
    "                $(this).triggerHandler('focusout');",
    "            });",
    "        } catch (err) { }",
    "    }",
)
H2_OLD = ANCHOR2
H2_NEW = BLOCK + CRLF + CRLF + ANCHOR2

# ---- hunks 3 + 4: close them before the console moves, both directions -----
H3_OLD = lines(
    "            var wrapperEl = document.getElementById('admWrapper');",
    "            _admPip.home = document.createComment('admWrapper-home');",
)
H3_NEW = lines(
    "            var wrapperEl = document.getElementById('admWrapper');",
    "            _pipCloseTooltips(wrapperEl);   // or they are stranded in the tab",
    "            _admPip.home = document.createComment('admWrapper-home');",
)
H4_OLD = lines(
    "            if (!wrapperEl) wrapperEl = document.getElementById('admWrapper');",
    "            if (wrapperEl && _admPip.home && _admPip.home.parentNode) {",
)
H4_NEW = lines(
    "            if (!wrapperEl) wrapperEl = document.getElementById('admWrapper');",
    "            _pipCloseTooltips(wrapperEl);   // or they close with the window, still \"open\"",
    "            if (wrapperEl && _admPip.home && _admPip.home.parentNode) {",
)

MAIN_HUNKS = [("pip-ui-keys-note", H1_OLD, H1_NEW), ("tooltip-hosting", H2_OLD, H2_NEW),
              ("close-on-mount", H3_OLD, H3_NEW), ("close-on-restore", H4_OLD, H4_NEW)]

# ---- README.md section 3: the suite count and the tiphost entry (LF) --------
R1_OLD = lf_lines(
    "Forty PowerShell suites plus five plain-PHP suites under `penumbra_tests\\` (directories",
    "re-counted 2026-09-23: 45, of which 40 carry a `run*.ps1` - this line had drifted again, it said",
    "thirty-two; a few suites, `presets` among them, have more than one entry point; `daterange` and",
    "`promptparity` joined that day). Run them from a workstation.",
)
R1_NEW = lf_lines(
    "Fifty-four PowerShell suites plus six plain-PHP suites under `penumbra_tests\\` (directories",
    "re-counted 2026-09-25: 60, of which 54 carry a `run*.ps1` - this line had drifted again, it said",
    "forty; a few suites, `presets` among them, have more than one entry point; `tiphost` joined that",
    "day). Run them from a workstation.",
)
SKT = "& ([scriptblock]::Create([IO.File]::ReadAllText('\\\\oitras\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\singlekeytips\\run.ps1'))) -Mutants"
TTH = "& ([scriptblock]::Create([IO.File]::ReadAllText('\\\\oitras\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\tiphost\\run.ps1')))"
R2_OLD = lf_lines(SKT, "", "# Switch motion (2026-09-24, follow-up 2026-09-25): a layout_switch / toggle_switch click moves the")
R2_NEW = lf_lines(
    SKT,
    "",
    "# Pop-out tooltip hosting (2026-09-25): with the admin console in its own window (\"Open in",
    "# Window\") every console tooltip - the Custom Code helper list (Shortcuts, Functions), the snippet",
    "# editor's function underlines, the scheduler's cron and File Drop string() help, a title tooltip",
    "# opened by keyboard focus - opens IN the console window. jQuery UI's tooltip appended to the",
    "# document it was CREATED in (the tab) and flip/fitted against the tab's window; main.js now decides",
    "# per open from the target's own document (a prototype patch beside _pipRetargetUiWidgets) and",
    "# closes a tooltip still open on a console element before the console changes windows",
    "# (_pipCloseTooltips). Browser: the REAL main.js, jQuery UI, penumbra_snippet_help.js and main.css",
    "# in headless Edge, the REAL tab strip and the REAL \"Open in Window\" button (a real window.open()",
    "# window) - docked (stock), popped out, back in the tab, and a page where the Custom Code panel is",
    "# first built INSIDE the console window. `-Real` repeats it with REAL clicks and hovers over CDP in",
    "# both windows (`-Shots <dir>` keeps screenshots). Measured 2026-09-25 on the stage: 25/0 + real",
    "# 7/0; `-Control` (the pre-fix .bak) RED on exactly the pop-out asserts (13 of 25, real 5 of 7);",
    "# `-Mutants` runs all 6 and each turned its own asserts red.",
    TTH + " -Real",
    TTH + " -Mutants",
    "",
    "# Switch motion (2026-09-24, follow-up 2026-09-25): a layout_switch / toggle_switch click moves the",
)
README_HUNKS = [("readme-suite-count", R1_OLD, R1_NEW), ("readme-tiphost-entry", R2_OLD, R2_NEW)]

HUNKS = MAIN_HUNKS


def state(data):
    out = []
    for name, old, new in HUNKS:
        n_new = data.count(new)
        n_old = data.count(old) - (n_new if old in new else 0)
        out.append((name, n_old, n_new))
    return out


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("forward", "reverse", "check"):
        print(__doc__)
        return 2
    mode, path = sys.argv[1], sys.argv[2]
    global HUNKS
    HUNKS = README_HUNKS if "readme" in os.path.basename(path).lower() else MAIN_HUNKS
    with open(path, "rb") as f:
        data = f.read()
    st = state(data)
    if mode == "check":
        ok = True
        for name, n_old, n_new in st:
            s = "APPLIED" if (n_new == 1 and n_old == 0) else ("NOT APPLIED" if (n_new == 0 and n_old == 1) else "AMBIGUOUS old=%d new=%d" % (n_old, n_new))
            print("  %-18s %s" % (name, s))
            ok = ok and s == "APPLIED"
        print("ALL APPLIED" if ok else "NOT FULLY APPLIED")
        return 0 if ok else 1
    for name, n_old, n_new in st:
        want_old, want_new = (1, 0) if mode == "forward" else (0, 1)
        if (n_old, n_new) != (want_old, want_new):
            print("REFUSED: hunk %s old=%d new=%d (need old=%d new=%d) - file untouched" % (name, n_old, n_new, want_old, want_new))
            return 1
    for name, old, new in HUNKS:
        data = data.replace(new, old, 1) if mode == "reverse" else data.replace(old, new, 1)
    with open(path, "wb") as f:
        f.write(data)
    print("%s OK: %s" % (mode, path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
