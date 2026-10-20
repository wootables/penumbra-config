# =============================================================================
# ACROW SUITE (2026-10-01) - the Visual Search Builder's value list: the whole
# row is ONE checkbox, and the selection settles when the list closes.
#
# One engine (js/search_builder.js + css/search_builder.css), three hosts: the
# report search (#tableSearch, "Search"), the scheduler's Search Filter
# (#schedSearchFilter, "Insert", an EMAIL task: recipient tokens with NO
# checkbox) and the dashboard filter (#dashSearchInput, "Apply"). Before the
# change the FIRST pick depended on where the press landed: the label picked one
# value and closed the list, the checkbox started a set that took the TYPED
# FILTER text in as a member ('Al' + Alice = /^(?:Al|Alice)$/).
#
# Now: a press anywhere on a value's row (checkbox, label, the row's own
# padding) ticks / unticks it and keeps the list open; while the list is open
# the selection lives on the row at any count and the box keeps the typed
# filter; every close path settles it: 2+ = "Multiple Values Selected (N)",
# 1 = that entry in the box, 0 = the typed text stands.
#
# Headless Edge over CDP with TRUSTED mouse / key events (Input.dispatch*,
# Input.insertText) at the checkbox pixel vs the label pixel, plus synthetic
# probes where a same-turn read is the point. The page loads the REAL builder
# files with stubs (driver.js): _penumbraSearchAPI, $.get for
# search_builder_content.php (its markup, written to sbc.html), the preset chip,
# and stand-ins for the hosts' own Escape handling: main.js's document-capture
# section C on the report / scheduler hosts (it fades the builder and does not
# know the value list), the dashboard's window-capture guard on the dash host.
#
# Review round (2026-10-01 evening): the sticky header is there from the first
# render (a header appearing on the first tick pushed the rows down under a still
# pointer: click + Enter or a double-click picked a second value), the hover
# highlight follows real pointer moves only, Space / Enter act on a checkbox row
# only when the arrow keys put the highlight there, a double-click is one tick,
# 'Show only selected' lets go when nothing is ticked, journal toggle columns
# single-pick, and Escape closes only the list on every host.
#
# Round 3 (2026-10-02): the header is the same height in every state at EVERY
# width (both links always laid out, invisible under a hint until something is
# ticked; the counts line never wraps), and the row's own 'clear selection' link
# no longer appears or goes while the list is open (in a narrow builder it moved
# the box and the list); a repeat press is dropped only on the SAME row; a press
# on the header keeps the list open; Space-decided rows are not re-ticked by
# Enter; with nothing ticked Enter picks a mouse-highlighted row (never the row
# just clicked); the header counts data values only (no recipient tokens).
#
# Round 4 (2026-10-02): while the list is open the builder dialog keeps its place (it is
# centred, so a row count line that wraps, emptied on every tick and refilled 200 ms
# later, or a query preview that wraps moved the box, the list and every row); the
# wheel takes the mouse's highlight along to the row under the pointer (never the arrow
# keys'); a double-click's repeat press is dropped on the same row OR the same spot ('Show
# only selected' slides another row under it); a recipient token under the mouse does
# not take Enter from ticked values; Space's row and Clear selection reset the 'just
# decided' row the way a click does.
#
# Asserts (P = parity, B/E/Z = settle, S/D/R = hosts, N/K = keys, ...):
#   P-first   typed 'Al', a press on Alice's checkbox: set [Alice], box keeps 'Al', list open
#             and filtered, Alice ticked, preview NAME = Alice (never the typed 'Al')
#   P-same    ...a press on Alice's LABEL gives the identical state
#   P-whole   whole list (no typed text): checkbox, label and the row's padding on Bob all
#             give the same: set [Bob], box empty, placeholder Bob, list open
#   P-nodbl   a click that still reaches the checkbox after the press does not toggle it back
#   P-right   a right-button press on a row does nothing (list open, nothing ticked)
#   C-css     the checkbox takes no pointer events: the row is the hit target at its pixel
#   B-one     one ticked, the box blurs: the box shows Alice as a normal entry, list closed
#   E-mid     a second tick: set of 2, the box still shows the typed filter, list still filtered
#   E-two     ...Escape: "Multiple Values Selected (2)", the alternation in the preview
#   Z-zero    tick + untick, Escape: the typed text stands (NAME = Al)
#   S-first   Search clicked with the list open settles the row FIRST (same turn)
#   S-search  ...and the search bar gets NAME = Alice, the table search runs
#   O-gt      one tick, operator changed to gt: the value stays (NAME > Alice)
#   N-extend  a set {Alice,Bob}, Enter on Albert: the set grows to 3 and the search runs
#   N-keep    Enter on an already ticked row never unticks it
#   N-single  (guard) typed 'Bo', ArrowDown, Enter: NAME = Bob in one keystroke, searched
#   K-keep    Space ticks the highlighted row and the highlight stays; ArrowDown goes on from it
#   T-pre     a typed 'Alice|Bob' opened whole shows Alice and Bob ticked
#   T-ext     ...ticking Albert extends it to three (no literal pipe member)
#   T-drop    a committed value the column does not offer is not shown ticked, so not kept
#   T-typed   typing a value in full does not show it ticked (the box is the filter)
#   J-cb      '[1,2]' through a checkbox row stays '[1,2]'
#   J-nocb    '[1,2]' through a no-checkbox row (operator gt) stays '[1,2]' (not '1,2')
#   H-show    sticky header from the first tick; "Show only selected" lists just Alice
#   H-clear   "Clear selection": list stays open, nothing ticked, the typed filter kept
#   H-after   ...Escape: the typed text stands
#   M-click   a click in the box during a selection keeps the list filtered by the typed text
#   Q-rehost  the list moves to another box inside the blur delay: the first box settles
#   X-pipe    'X|Y' ticked: mid-session preview == settled preview; box 'X\|Y'
#   G-state   the preset chip's getState with one tick open: value is the tick (typed form)
#   R-insert  scheduler host: a tick + Insert gives NAME = Alice to the scheduler
#   R-token   (guard) scheduler host: a recipient token (no checkbox) single-picks and closes
#   R-seed    a committed token is not a tick: ticking Alice gives [Alice]
#   R-replace a token picked during a selection replaces it
#   D-preview dashboard host: the count line is asked about NAME = Alice mid-selection
#   D-apply   ...Apply settles and filters with NAME = Alice
#   C-col     (guard) a column change mid-selection clears the row
#   F-free    (guard) free text, no tick: kept as typed
#   W-remove  (guard) removing the row mid-selection: no error, list closed
#   E-err     (guard) no page errors in any scenario
#   P-still   the header is there before the first tick ('0 selected'), the tick moves no row,
#             and a click leaves no keyboard highlight behind (at the browser's 1366x900; round 3
#             adds the narrow widths below)
#   P-enter   click a value (the list stays open, it is ticked), nudge the pointer, Enter: the
#             search is exactly that value on all 3 hosts (Search / Insert / Apply), and typed 'Al'
#             + Albert + Enter gives NAME = Albert
#   P-dbl     a trusted double-click on a row is ONE tick (not a tick and an untick)
#   P-unenter untick a value by mouse, Enter: it stays unticked (pointer still, or nudged onto
#             the row; a fresh selection, a committed set of 3 opened from the box, and (round 3)
#             the only tick unticked with the hand resting on it: the typed text is searched)
#   P-space   'New', click New Haven, nudge, Space, 'York': the box reads 'New York' (the space is
#             typed, not a toggle) and New Haven stays ticked
#   K-rest    the pointer rests on one row while the arrow keys highlight another: Space toggles
#             the keyed row and the highlight stays on it across the re-render
#   H-strand  'Show only selected', then untick everything: the full list comes back
#   H-showone a committed single value opened whole: 'Show only selected' lists just it, ticked
#   H-rowlink the row's own 'clear selection' link stays hidden while the list is open (1 and 2
#             ticks; round 3, it used to show at 2), and shows once the list closes on a set of 2
#   T-toggle  a journal toggle column's list has no checkboxes: a click on the other state
#             replaces the value and closes the list
#   E-host    report / scheduler / dashboard: Escape closes only the list (settled to the
#             count), the builder stays; a second Escape closes the builder (the host's own handler)
#   H-doc     (static) help_content.php's 'Multi-value selection (checkboxes)' list describes this
#             (row click, closing, arrow keys + Space / Enter, Enter after Space / with the mouse,
#             no-checkbox values incl. toggle columns, the close-time display, typing, the header),
#             with no 'read-only chip' / 'legacy behavior' and no em-dash
#   --- round 3 (the 4th SCENARIOS item is the window width) ---
#   P-still1024  report host at 1024x900: the box, the list, the header height and every row top
#             are identical across 0 -> 1 -> 2 -> 1 -> 0 ticks, AND the reviewer's fast hand (aim at
#             Alice, Alan, Albert where drawn, click 0.6 s apart) ticks all three; the hint fits on
#             its line, not cut (this and the two below)
#   P-still800   ...the same at 800x900 (there the row's own link used to move the box at 2 ticks)
#   P-stillsched ...the same on the scheduler host at 1200x900 with FRUIT (22 values + 20 tokens:
#             a scrolling list, whose scrollbar narrows the header)
#   P-dblnext a quick press on the NEXT row that the browser counts as a double-click (mouse
#             clickCount 2; touch: two taps 16px apart) ticks it too: [Alan, Albert]
#   H-press   a press on the header's hint (nothing ticked) or its counts (2 ticked) keeps the list
#             open and the selection as it was; the links still work; the hint is device-neutral
#   K-spaceenter  Al, ArrowDown, Space, Space, Enter: Alice stays unticked, NAME = Al is searched;
#             Space then ArrowDown re-arms Enter (Alice + Alan); unchanged: ArrowDown, Enter = NAME =
#             Alice, and ArrowDown, Space, ArrowDown, Space, Enter = Alice + Alan
#   P-hover   nothing ticked, a real pointer move onto Albert, Enter: NAME = Albert on all 3 hosts;
#             with Alice ticked by click, hover Albert + Enter keeps NAME = Alice
#   H-count   scheduler EMAIL host: the header counts the column's 6 values, not the 20 recipient
#             tokens listed with them ('6 values', typed 'Al' = '3 of 6')
#   --- round 4 (stubs in driver.js: T.pivotCount, T.longValues) ---
#   P-stillpivot  pivot view at 1024 (the count line wraps): typed 'Al', 0 -> 1 -> 2 -> 1 -> 0 ticks,
#             each read right after the press was handled (count line emptied) AND after the 200 ms
#             refill: box, list, header, every row top identical (the list stays under the box);
#             the hurried hand aiming at each row's top + 4px where drawn before any tick ticks
#             all three, at 1024 and 1366
#   P-stilllong   4 long sponsor names on each host at 1024 (the preview wraps at the 3rd): 0 -> 4 -> 0
#             ticks, the same geometry throughout (read the same two ways)
#   P-wheel   nothing ticked, the pointer on Avocado, the wheel scrolls the list under it: the only
#             highlighted row is the one under the pointer, and Enter searches it; an arrow-key
#             highlight stays through the wheel and Enter ticks it (Banana)
#   P-dblshow 'Show only selected', a double-click on a ticked row unticks it alone (the row that
#             slides under the pointer is untouched); on the only tick: nothing ticked, closing
#             leaves the typed text (NAME = Al)
#   R-tokenenter  scheduler: Alice + Alan ticked, the pointer on {FNAME}, Enter inserts the two
#             values; the arrow keys' token row (ArrowUp) is still single-picked
#   P-decided Space-untick + a 1px pointer move onto that row + Enter keeps it unticked (NAME = Al);
#             Clear selection, then the pointer onto the last clicked row + Enter picks it
#
#   --- round 5 (2026-10-02): the column picked again reopens its value list; the column cell
#   holds its tip on one line. Re-picking the column a row already has fires no 'change', so
#   the list a pick opens never came back. Chromium ends EVERY pick from a <select> popup with
#   a click on the select whose detail is 0 (recorded in headless Edge 154 with trusted keys:
#   input + change first when the value moved; the press that opens the popup is detail 1;
#   Escape / a click elsewhere send none); Firefox clicks the chosen <option>. The repick_*
#   scenarios but _syn / _open drive the REAL popup (a trusted press opens it, Enter / ArrowDown /
#   Escape go to it); the layout_* ones add a date column, a nested column and a long name.
#   A-repick1 one tick, a click away (Alice in the box), the column picked again from its popup
#             (Enter on the same option): the list reopens WHOLE with Alice ticked, the box still
#             Alice, the focus in it; the press that opened the popup opened nothing; Bob + Escape =
#             the set of two
#   A-repickset  ...two ticks closed into a set: the list reopens with both ticked, the set intact
#   A-keys    the keyboard only: Shift+Tab twice to the column select (the list closes), Space opens
#             its popup, Enter on the same column: the list reopens with Alice ticked, drawn once
#   A-syn     the same with the Chromium sequence dispatched in one turn (a committed value, a set
#             of 2, and a between row: its From box hosts the list, From / To kept)
#   A-firefox ...and with Firefox's click on the chosen <option>
#   A-open    the list open with a selection of 2, the column picked again inside the box's 150 ms
#             blur delay: the list stays open (re-drawn whole), the set intact, Escape settles it
#   A-diff    (guard) a DIFFERENT column from the popup: the box cleared and the new column's list
#             opened, drawn ONCE (no second open from the pick's click); the synthetic sequence too
#             (in its own turn the list is not open yet, the focus still on the select)
#   A-none    (guard) the popup dismissed with Escape, the press alone (a click with detail 1), a
#             jQuery .trigger('click'), the press + the select losing focus, a column-reference row:
#             nothing opens, nothing drawn, nothing cleared
#   L-tip     at 1024 / 1280 / 1366 / 1440 / 1920 wide: the date tip and the nested tip each on ONE
#             line, inside their column cell (not under the operator)
#   L-row     (guard) ...every row: no horizontal overflow, its links on one line, the x inside it; the
#             operator and both between boxes at least their minimum widths (100 / 80) and, at
#             1280..1920, no narrower than the build before gave them (FLOOR5); the dialog inside
#             the window with 24px to spare, no horizontal scrollbar, the close button in it, the
#             title on one line; the value list sized to its box, its header the same height and
#             every row where it was at 1 -> 0 -> 1 ticks. Green before round 5 too (a narrow
#             column squeezed nothing); red when the column cell grows and the dialog does not
#   L-wide    a tip drawn wider than measured (letter-spacing: a wider font, a larger minimum font
#             size) still takes one line at 1366
#   L-narrow  (guard) at 700 wide (the narrow-screen block) the tips may wrap again (white-space
#             normal, the cell's min-width 0) and no row overflows
#   L-tolist  (guard; round-5 fix) at 769 / 800 wide (report) and 769 (dashboard) a between row's
#             To box sits near the window's right edge in the wider dialog: its value list (200px
#             at least) ends inside the window, still right under the box and across its width,
#             and the page gets no horizontal scrollbar. Green before round 5 too (the narrower
#             dialog left room); red when the list is only ever left-aligned to its box
#   A-btwdiff (round-5 fix) a between row (From 'Alan', To 'Bob') picks a DIFFERENT column: both
#             boxes cleared, the focus in the From box and the new column's list open there AND
#             still open 0.6 s later (the old handler focused both boxes, so the To box kept the
#             focus and From's blur timer closed the list ~150 ms after it opened)
#   H-repick  (static) the help's 'Multi-value selection (checkboxes)' list says the column picked
#             again reopens the list with the ticks intact, with no em-dash
#
#   py -3 run.py                      candidate = the LIVE js/css/help (before the deploy this IS the control)
#   py -3 run.py --js F --css F --help-php F   candidate = these files (a stage)
#   py -3 run.py --control            the build before the change (live while it lacks the fix, else the
#                                     newest js\search_builder.js.bak-*-acrow + css / help .bak-*-acrow):
#                                     every assert but the GUARDS red, the guards green
#   py -3 run.py --control5 [--js F --css F --help-php F]   the build before ROUND 5 (these files, else
#                                     live while it lacks the round-5 mark, else the newest
#                                     .bak-*-acrow5 - name round 5's deploy backups -acrow5, so the
#                                     plain --control keeps finding the original -acrow ones): the
#                                     round-5 asserts but its guards red, everything else green
#   py -3 run.py [--js F --css F] --mutants      every mutant of the candidate against its red list
#   py -3 run.py [--js F --css F] --mutant NAME  one of them;   --explore prints the raw observations
#   py -3 run.py [--js F ...] --only a,b         just those scenarios, raw observations, no asserts
# Stages into %TEMP%\pnb_acrow_*; writes nothing to the webroot. Summary -> summary*.txt here.
# cd into this folder first (Git Bash mangles a \\server\d$ argument to py -3).
# =============================================================================
import glob, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
sys.path.insert(0, r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'); from oldver import bak_glob, bak_path   # .bak copies come from git since 2026-10-14
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
CRLF = '\r\n'
FIX_MARK = 'function settleAcSelection('
FIX_MARK5 = 'function reopenColumnValueList('   # round 5

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
given = dict((k, k in args) for k in ('--js', '--css', '--help-php'))
js_path = opt('--js', os.path.join(APP, 'js', 'search_builder.js'))
css_path = opt('--css', os.path.join(APP, 'css', 'search_builder.css'))
help_path = opt('--help-php', os.path.join(APP, 'help', 'topics', 'searchHelpLightbox.php'))   # (2026-10-19) the v1 help is gone
control = flag('--control')
control5 = flag('--control5')
mutants = flag('--mutants')
one_mutant = opt('--mutant', None)
explore = flag('--explore')
only = opt('--only', None)
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
if control5 and not given['--js'] and FIX_MARK5 in read_b(js_path):
    bj = bak_glob(os.path.join(APP, 'js', 'search_builder.js.bak-*-acrow5'))
    if not bj: raise SystemExit('--control5: live has round 5 and there is no js\\search_builder.js.bak-*-acrow5 (pass --js/--css/--help-php)')
    js_path = bj[-1]
    bc = bak_glob(os.path.join(APP, 'css', 'search_builder.css.bak-*-acrow5'))
    if bc and not given['--css']: css_path = bc[-1]
    bh = bak_glob(os.path.join(APP, 'help_content.php.bak-*-acrow5'))
    if bh and not given['--help-php']: help_path = bh[-1]
if control:
    js_path, css_path = os.path.join(APP, 'js', 'search_builder.js'), os.path.join(APP, 'css', 'search_builder.css')
    if FIX_MARK in read_b(js_path):
        bj = bak_glob(os.path.join(APP, 'js', 'search_builder.js.bak-*-acrow'))
        bc = bak_glob(os.path.join(APP, 'css', 'search_builder.css.bak-*-acrow'))
        if not bj: raise SystemExit('--control: live has the fix and there is no js\\search_builder.js.bak-*-acrow')
        js_path = bj[-1]
        if bc: css_path = bc[-1]
        bh = bak_glob(os.path.join(APP, 'help_content.php.bak-*-acrow'))
        if bh: help_path = bh[-1]
JS0, CSS0 = read_b(js_path), read_b(css_path)
HELP0 = read_b(help_path)

# --- Mutants: each edit's anchor must occur exactly once in the candidate. -----
# The row press's double-click guard (round 4: the same row, or the same spot).
DBL_GUARD = ('            if (e.detail > 1 && pt && (pressed === pt.v ||' + CRLF +
             '                    (Math.abs(e.clientX - pt.x) <= 8 && Math.abs(e.clientY - pt.y) <= 8))) return;' + CRLF)
# Round 5: the help's bullet on picking the column again (one whole line of the list).
HELP5_TEXT = "Reopens its value list with your ticks intact"   # (2026-10-19) the v2 Search topic's row
HELP5_BULLET = ('            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; white-space: normal; max-width: none;">Pick the row\'s column again</td><td style="padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; white-space: normal; max-width: none;">' + HELP5_TEXT + ', for example after clicking away by accident.</td></tr>\n')
MUTANTS = {
    # the old fork: a row press toggles only once the row already holds a set; before
    # that the label single-picks and closes
    'gate': ([('js', '            if ($cb.length) {' + CRLF,
               "            if ($cb.length && $($('#sbAutocompleteDropdown').data('sbHostRow')).data('sb-multi-values')) {" + CRLF)],
             ['P-same', 'P-whole', 'P-first']),
    # a tick builds on the RAW box text again (the typed filter joins the set)
    'seedraw': ([('js', '        var current = acCheckedValues($hostRow, op, allValues, term);' + CRLF,
                  "        var current = (function () { var s = $hostRow.data('sb-multi-values'); if (Array.isArray(s)) return s.slice();"
                  " var v = $hostRow.find('.sb-value-input').not('.sb-value-input-secondary').val() || ''; return v === '' ? [] : [v]; })();" + CRLF)],
                ['P-first', 'T-ext']),
    # closing the list no longer settles: the open selection is left on the row
    'nosettle': ([('js', '        if (_acActiveInput) settleAcSelection(_acActiveInput);' + CRLF, '')],
                 ['B-one', 'E-two', 'Z-zero']),
    # the preview of a one-tick selection falls back to the box (the typed filter)
    'nodisplay1': ([('js', '            // One tick with the list still open previews as that value (mirrors buildQuery).' + CRLF +
                     '            if (Array.isArray(multiVals) && multiVals.length === 1 && MULTI_SELECT_OPERATORS[op]) {' + CRLF,
                     '            // One tick with the list still open previews as that value (mirrors buildQuery).' + CRLF +
                     '            if (false) {' + CRLF)],
                   ['P-first', 'X-pipe']),
    # no click-cancel AND no pointer-events rule (a stale cached CSS): a click that still
    # reaches the box toggles it straight back
    'noclickcancel': ([('js', "        $(document).on('click', '.sb-ac-checkbox', function(e) {" + CRLF + '            e.preventDefault();' + CRLF + '        });' + CRLF,
                        "        $(document).on('click', '.sb-ac-checkbox', function(e) {" + CRLF + '        });' + CRLF),
                       ('css', '    margin: 0;' + CRLF + '    pointer-events: none;' + CRLF, '    margin: 0;' + CRLF + '    cursor: pointer;' + CRLF)],
                      ['P-nodbl', 'C-css']),
    # the CSS half alone: the checkbox is its own hit target again
    'nocss': ([('css', '    margin: 0;' + CRLF + '    pointer-events: none;' + CRLF, '    margin: 0;' + CRLF + '    cursor: pointer;' + CRLF)],
              ['C-css']),
    # Enter on a checkbox row single-picks again: a set is wiped
    'enterpick': ([('js', '                        if ($acb.length) {' + CRLF, '                        if (false) {' + CRLF)],
                  ['N-extend', 'N-keep']),
    # the toggled row is not re-highlighted after the re-render
    'noremark': ([('js', "                    }).first().addClass('sb-ac-active');" + CRLF, '                    }).first();' + CRLF)],
                 ['K-keep']),
    # ...or it is, after a mouse toggle too (and then counts as a keyboard highlight)
    'remarkall': ([('js', '                if (keyed) {' + CRLF, '                if (true) {' + CRLF)],
                  ['P-still', 'P-unenter']),
    # the sticky header appears with the first tick again (the rows jump under the pointer)
    'headerlate': ([('js', '        var showHeader = multiEnabled && (hasMultiData ||' + CRLF +
                     '            matches.some(function(m) { return !isRecipientVarToken(m); }));' + CRLF,
                     '        var showHeader = hasMultiData;' + CRLF)],
                   ['P-still', 'H-showone']),
    # the second press of a double-click toggles again
    'nodetail': ([('js', DBL_GUARD, '')],
                 ['P-dbl']),
    # round 3: ...or a repeat press is dropped on ANY row (a quick tap on the next row is lost)
    'detailany': ([('js', DBL_GUARD, '            if (e.detail > 1) return;' + CRLF)],
                  ['P-dblnext']),
    # round 4: ...or only on the same ROW (in 'Show only selected' the 1st press slides
    # another row under the pointer and the 2nd press toggles it)
    'dblspot': ([('js', DBL_GUARD, '            if (e.detail > 1 && pt && pressed === pt.v) return;' + CRLF)],
                ['P-dblshow']),
    # round 4: the builder dialog re-centres under the open list again (a count line or a
    # preview that wraps moves the box, the list and every row)
    'nohold': ([('js', '        var h = _acDlgHold;' + CRLF, '        var h = null;' + CRLF)],
               ['P-stillpivot', 'P-stilllong']),
    # round 4: ...held at each re-render only, not when the count line refills 200 ms later
    'noobserve': ([('js', "        if (!dlg || typeof ResizeObserver !== 'function') return;" + CRLF, '        return;' + CRLF)],
                  ['P-stillpivot']),
    # round 4: the wheel leaves the mouse's highlight on a row scrolled away (Enter picks it)
    'scrollfollow': ([('js', "            if (!dd || dd.id !== 'sbAutocompleteDropdown' || _acKeyHighlight) return;" + CRLF,
                       '            if (true) return;' + CRLF)],
                     ['P-wheel']),
    # round 4: ...or takes the arrow keys' highlight away too
    'scrollkey': ([('js', "            if (!dd || dd.id !== 'sbAutocompleteDropdown' || _acKeyHighlight) return;" + CRLF,
                    "            if (!dd || dd.id !== 'sbAutocompleteDropdown') return;" + CRLF)],
                  ['P-wheel']),
    # round 4: a recipient token under the mouse takes Enter and replaces the ticked set
    'tokenkeep': ([('js', "                        } else if (!_acKeyHighlight && $dd.data('sbMultiEnabled') && !acNothingTicked()) {" + CRLF,
                    '                        } else if (false) {' + CRLF)],
                  ['R-tokenenter']),
    # round 4: ...or the arrow keys' token row no longer single-picks while values are ticked
    'tokenkeyed': ([('js', "                        } else if (!_acKeyHighlight && $dd.data('sbMultiEnabled') && !acNothingTicked()) {" + CRLF,
                     "                        } else if ($dd.data('sbMultiEnabled') && !acNothingTicked()) {" + CRLF)],
                   ['R-tokenenter']),
    # round 4: Space's row is not 'just decided' (a pointer nudge onto it, Enter re-ticks it)
    'spacelast': ([('js', "                        _acLastPressValue = $active.attr('data-value') || '';" + CRLF, '')],
                  ['P-decided']),
    # round 4: Clear selection keeps the last click's row exempt (hover it, Enter: not picked)
    'clearlast': ([('js', '            _acLastPressValue = null;   // a fresh start: Enter may pick any hovered value' + CRLF, '')],
                  ['P-decided']),
    # Enter ticks whatever row is highlighted (the mouse's, a Space-decided one)
    'keyflag': ([('js', "                            if (enterTicks && !$acb.prop('checked')) $acb.prop('checked', true).trigger('change');" + CRLF,
                  "                            if (!$acb.prop('checked')) $acb.prop('checked', true).trigger('change');" + CRLF)],
                ['P-unenter', 'K-spaceenter']),
    # round 3: Space-untick then Enter ticks the row again
    'spacedenter': ([('js', '                            if (_acKeyHighlight) enterTicks = !_acKeySpaced;' + CRLF,
                      '                            if (_acKeyHighlight) enterTicks = true;' + CRLF)],
                    ['K-spaceenter']),
    # round 3: an arrow key after Space does not re-arm Enter
    'spacedarrow': ([('js', '                    _acKeyHighlight = $next.length > 0;' + CRLF + '                    _acKeySpaced = false;' + CRLF,
                      '                    _acKeyHighlight = $next.length > 0;' + CRLF)],
                    ['K-spaceenter']),
    # round 3: Enter never picks a hovered row (a typed fragment is searched instead)
    'hoverpick': ([('js', '                            else if (acNothingTicked()) enterTicks = $active.attr(',
                    '                            else if (false) enterTicks = $active.attr(')],
                  ['P-hover']),
    # round 3: ...or picks it even with something ticked (click, hover another, Enter = 2 values)
    'hoverticked': ([('js', '                            else if (acNothingTicked()) enterTicks = $active.attr(',
                      '                            else if (true) enterTicks = $active.attr(')],
                    ['P-hover']),
    # round 3: ...or re-ticks the row just unticked by click
    'hoverlast': ([('js', "enterTicks = $active.attr('data-value') !== _acLastPressValue;" + CRLF, 'enterTicks = true;' + CRLF)],
                  ['P-unenter']),
    # Space toggles a row the mouse highlighted (the typed space is eaten)
    'spaceflag': ([('js', "                    if (_acKeyHighlight && $active.length && $active.hasClass('sb-ac-item-multi')) {" + CRLF,
                    "                    if ($active.length && $active.hasClass('sb-ac-item-multi')) {" + CRLF)],
                  ['P-space']),
    # the arrow keys no longer mark their highlight as the keyboard's
    'arrowflag': ([('js', '                    _acKeyHighlight = $next.length > 0;' + CRLF, '')],
                  ['K-keep', 'N-extend']),
    # the hover highlight follows mouseenter again (sent to a row re-rendered under a still pointer)
    'hoverenter': ([('js', "        $(document).on('mousemove', '.sb-ac-item', function() {" + CRLF,
                     "        $(document).on('mouseenter', '.sb-ac-item', function() {" + CRLF)],
                   ['K-rest']),
    # 'Show only selected' outlives the last tick (an empty list with no way back)
    'showonlystrand': ([('js', '        var showOnlySelected = !!(hostValueSet && hostValueSet.size > 0 && $dropdownExisting.length &&' + CRLF,
                         '        var showOnlySelected = !!(hasMultiData && $dropdownExisting.length &&' + CRLF)],
                       ['H-strand']),
    # 'Show only selected' re-renders filtered by the box text (a committed value)
    'showterm': ([('js', "                showAutocompleteDropdown($hi, $dd.data('sbTerm') || '', allValues);" + CRLF,
                   "                showAutocompleteDropdown($hi, $hi.val() || '', allValues);" + CRLF)],
                 ['H-showone']),
    # a toggle column gets checkboxes again (ticking the other state matches every row)
    'togglemulti': ([('js', '        var multiEnabled = !!(hostCol && MULTI_SELECT_OPERATORS[hostOp]) && !isToggleColumnName(hostCol);' + CRLF,
                      '        var multiEnabled = !!(hostCol && MULTI_SELECT_OPERATORS[hostOp]);' + CRLF)],
                    ['T-toggle']),
    # no window-capture Escape: the report / scheduler page's handler closes the whole builder
    'noescwin': ([('js', "        window.addEventListener('keydown', function(e) {" + CRLF +
                   "            if ((e.key !== 'Escape' && e.key !== 'Esc') || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;" + CRLF,
                   "        window.addEventListener('keydown-off', function(e) {" + CRLF +
                   "            if ((e.key !== 'Escape' && e.key !== 'Esc') || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;" + CRLF)],
                 ['E-host']),
    # round 3: the row's own 'clear selection' link appears at 2 ticks under the open list
    # again (in a narrow builder it re-wraps the row's links and grows the dialog). Round 4:
    # the dialog now holds its place under an open list, so that growth no longer moves the
    # box (P-still800 stays green); the link itself is still wrong mid-session (H-rowlink).
    'rowmultiopen': ([('js', '            // the list sets the link (a set of 2+ has one, a plain value none).' + CRLF,
                       '            // the list sets the link (a set of 2+ has one, a plain value none).' + CRLF +
                       "            $row.toggleClass('sb-row-multi', arr.length >= 2);" + CRLF)],
                     ['H-rowlink']),
    # round 3: the header's links exist only once something is ticked (the bar grows on a tick)
    'linkslate': ([('js', '                        showSelHtml + clearLinkHtml +' + CRLF,
                    "                        (idle ? '' : showSelHtml + clearLinkHtml) +" + CRLF)],
                  ['P-still', 'P-still1024', 'P-still800', 'P-stillsched']),
    # round 3: the hint takes space of its own (in the flow next to the hidden links)
    'hintflow': ([('css', '.sb-ac-hint {' + CRLF + '    position: absolute;' + CRLF, '.sb-ac-hint {' + CRLF + '    position: static;' + CRLF)],
                 ['P-still', 'P-still1024']),
    # round 3: a press on the header (hint, counts) blurs the box and closes the list
    'nobarguard': ([('js', "        $(document).on('mousedown', '.sb-ac-filter-bar', function(e) {" + CRLF,
                     "        $(document).on('mousedown', '.sb-ac-filter-bar-off', function(e) {" + CRLF)],
                   ['H-press']),
    # round 3: the hint speaks to mouse users only again
    'hintclick': ([('js', "'<span class=\"sb-ac-hint\">Tick one or more values</span>'", "'<span class=\"sb-ac-hint\">Click values to tick them</span>'")],
                  ['H-press']),
    # round 3: the header counts the scheduler's recipient tokens as values ('26 values')
    'tokencount': ([('js', 'var notToken = function(v) { return !isRecipientVarToken(v); };', 'var notToken = function(v) { return true; };')],
                   ['H-count']),
    # Search no longer settles first
    'nosubmitsettle': ([('js', '            hideAutocompleteDropdown();' + CRLF + '            const query = buildQuery();' + CRLF,
                         '            const query = buildQuery();' + CRLF)],
                       ['S-first']),
    # "Clear selection" ends the session (wipes the typed filter, as before)
    'clearends': ([('js', '            setRowMultiMode($(hostRowEl), [], { open: true, filter: term });' + CRLF,
                    '            setRowMultiMode($(hostRowEl), []);' + CRLF)],
                  ['H-clear']),
    # the operator change clears a one-tick selection before the list closes (old order)
    'opsettle': ([('js', '            // by the time the check below runs, and survives a switch to `gt`.' + CRLF + '            hideAutocompleteDropdown();' + CRLF,
                   '            // by the time the check below runs, and survives a switch to `gt`.' + CRLF),
                  ('js', '            }' + CRLF + '            updateColRefState($row);' + CRLF + '            // Split candidacy depends on the operator',
                   '            }' + CRLF + '            hideAutocompleteDropdown();' + CRLF + '            updateColRefState($row);' + CRLF + '            // Split candidacy depends on the operator')],
                 ['O-gt']),
    # the query (count line, presets) of a one-tick selection falls back to the box
    'noquery1': ([('js', '            // filter text in the box (RAW, as typedVals hands it over below).' + CRLF +
                   '            if (Array.isArray(multiVals) && multiVals.length === 1 && MULTI_SELECT_OPERATORS[op]) {' + CRLF,
                   '            // filter text in the box (RAW, as typedVals hands it over below).' + CRLF + '            if (false) {' + CRLF)],
                 ['D-preview']),
    # a preset saved with one tick open stores the typed filter
    'noextract1': ([('js', '            } else if (Array.isArray(multiVals) && multiVals.length === 1) {' + CRLF, '            } else if (false) {' + CRLF)],
                   ['G-state']),
    # moving to another box inside the blur delay leaves the first box unsettled
    'norehost': ([('js', '        if (_acActiveInput && _acActiveInput !== $input[0]) settleAcSelection(_acActiveInput);' + CRLF, '')],
                 ['Q-rehost']),
    # jQuery .data() again on the single-pick path ('[1,2]' -> '1,2')
    'datavalue': ([('js', "        var value = $item.attr('data-value') || '';" + CRLF + '        var $input = $(_acActiveInput);' + CRLF,
                    "        var value = $item.data('value');" + CRLF + '        var $input = $(_acActiveInput);' + CRLF)],
                  ['J-nocb']),
    # every mouse button toggles
    'noprimary': ([('js', '            if (e.button !== undefined && e.button !== 0) return;   // primary button only' + CRLF, '')],
                  ['P-right']),
    # a selection that ends at 0 wipes the typed text
    'nokeeptext': ([('js', '        if (set.length === 0) setRowMultiMode($hostRow, [], { keepText: true });' + CRLF,
                     '        if (set.length === 0) setRowMultiMode($hostRow, []);' + CRLF)],
                   ['Z-zero', 'H-after']),
    # a click in the box during a selection shows the WHOLE list under the typed filter
    'clickall': ([('js', '            triggerAutocomplete($(this), !$(this).val());' + CRLF, '            triggerAutocomplete($(this), true);' + CRLF)],
                 ['M-click']),
    # a committed value the column does not offer is seeded (never shown ticked, yet kept)
    'nooffered': ([('js', '            return offered.has(v) && !isRecipientVarToken(v);' + CRLF, '            return !isRecipientVarToken(v);' + CRLF)],
                  ['T-drop']),
    # a committed recipient token is seeded (it has no checkbox) and joins the set
    'tokenfilter': ([('js', '            return offered.has(v) && !isRecipientVarToken(v);' + CRLF, '            return offered.has(v);' + CRLF)],
                    ['R-seed']),
    # the typed filter is pre-ticked while typing
    'noterm': ([('js', '        if (term) return [];' + CRLF, '')],
               ['T-typed']),
    # the help's click bullet back to the old split ("legacy behavior")
    'helpold': ([('help', "Ticks or unticks it; the list stays open. Click outside the list, or press <kbd>Tab</kbd> or <kbd>Esc</kbd>, to close it.",
                  "<li>Clicking an item's label and clicking its checkbox both add to the set once you're in multi-value mode; clicking the label of a value in single-value mode picks just that one (legacy behavior).")],
                ['H-doc']),
    # --- round 5 ---
    # the same-column check goes: a DIFFERENT column's pick also reopens from its click (a
    # second open on top of the change path's)
    'repicksame': ([('js', "            if (!col || col !== $(this).data('sbColAtPress')) return;" + CRLF, '            if (!col) return;' + CRLF)],
                   ['A-diff']),
    # the detail-0 test goes: the press that opens the popup (detail 1) reopens the list
    'repickdetail': ([('js', "            if (!oe || !(oe.detail === 0 || (e.target && e.target.tagName === 'OPTION'))) return;" + CRLF,
                       '            if (!oe) return;' + CRLF)],
                     ['A-none']),
    # ...or only Chromium's click counts (Firefox clicks the chosen <option>)
    'repickoption': ([('js', "            if (!oe || !(oe.detail === 0 || (e.target && e.target.tagName === 'OPTION'))) return;" + CRLF,
                       '            if (!oe || oe.detail !== 0) return;' + CRLF)],
                     ['A-firefox']),
    # the column is remembered on a press only: a select reached with Tab (the keyboard) does not reopen
    'repickfocus': ([('js', "        $(document).on('mousedown focus', '.sb-col-select', function() {" + CRLF,
                      "        $(document).on('mousedown', '.sb-col-select', function() {" + CRLF)],
                    ['A-keys']),
    # the re-pick clears the value box first, as the change path does
    'repickclear': ([('js', "        _acReopenSeq++;" + CRLF + "        $input.trigger('focus');" + CRLF,
                      "        _acReopenSeq++;" + CRLF + "        $input.val('').trigger('focus');" + CRLF)],
                    ['A-repick1', 'A-syn']),
    # the box's blur from before the re-pick still closes the reopened list
    'repickseq': ([('js', '                if (reopenSeq !== _acReopenSeq) return;' + CRLF, '')],
                  ['A-open']),
    # the tips may wrap again (a tip drawn wider than measured takes two lines)
    'tipwrap': ([('css', '    margin-bottom: -10px;' + CRLF +
                  '    /* One line (.sb-col-wrapper is sized for it); the narrow-screen block lets it wrap. */' + CRLF +
                  '    white-space: nowrap;' + CRLF, '    margin-bottom: -10px;' + CRLF)],
                ['L-wide']),
    # the column cell back to 100px: the one-line tip runs out of it, under the operator
    'colmin': ([('css', '    min-width: 260px;' + CRLF, '    min-width: 100px;' + CRLF)],
               ['L-tip']),
    # the dialog back to 55% / 520px / 850px: the operator and the between boxes squeezed
    'dlgnarrow': ([('css', '    width: 62%;' + CRLF + '    min-width: 700px;' + CRLF + '    max-width: 900px;' + CRLF,
                    '    width: 55%;' + CRLF + '    min-width: 520px;' + CRLF + '    max-width: 850px;' + CRLF)],
                  ['L-row']),
    # the narrow-screen block no longer lets the tips wrap
    'nomedia': ([('css', CRLF + "    /* The row stacks here: the column cell is the row's full width, and a tip" + CRLF +
                  '       that still does not fit wraps rather than running off the dialog. */' + CRLF +
                  '    .sb-date-tip,' + CRLF + '    .sb-nested-tip {' + CRLF + '        white-space: normal;' + CRLF + '    }' + CRLF, '')],
                ['L-narrow']),
    # the help's re-pick bullet goes
    'helprepick': ([('help', HELP5_BULLET, '')],
                   ['H-repick']),
    # round-5 fix: the list is only ever left-aligned to its box (under a To box near the
    # window's right edge it runs past the window)
    'noclamp': ([('js', "        if (over > 0) $dropdown.css('left', Math.max(0, rect.left - over) + 'px');" + CRLF, '')],
                ['L-tolist']),
    # the column change focuses BOTH value boxes again: a between row's list closes ~150 ms later
    'btwfocus': ([('js', "                    $boxes.val('');" + CRLF + "                    $input.focus();" + CRLF,
                   "                    $boxes.val('').focus();" + CRLF)],
                 ['A-btwdiff']),
}
# The build before the change: every non-guard assert is red. Round 5's guards are green
# there too, but L-row: its value list part (a header from the first render, a press that
# ticks) is the acrow change itself, so before it L-row is red like the rest.
GUARDS5 = ['A-diff', 'A-none', 'L-row', 'L-narrow', 'L-tolist']
GUARDS = ['N-single', 'R-token', 'C-col', 'F-free', 'W-remove', 'E-err'] + [a for a in GUARDS5 if a != 'L-row']
# Round 5's asserts: red on the build before round 5 (--control5) but its guards.
ROUND5 = ['A-repick1', 'A-repickset', 'A-keys', 'A-syn', 'A-firefox', 'A-open', 'A-diff', 'A-none',
          'L-tip', 'L-row', 'L-wide', 'L-narrow', 'L-tolist', 'A-btwdiff', 'H-repick']

def mutate(js, css, help_text, name):
    files = {'js': js, 'css': css, 'help': help_text}
    for which, old, new in MUTANTS[name][0]:
        n = files[which].count(old)
        if n != 1: raise SystemExit("mutant '%s': anchor found %d times in %s (needs the FIXED build): %r" % (name, n, which, old[:90]))
        files[which] = files[which].replace(old, new)
    return files['js'], files['css'], files['help']

# --- Stage + browser --------------------------------------------------------------
stage = tempfile.mkdtemp(prefix='pnb_acrow_')
for f in ['jquery-3.7.1.min.js', 'jquery-ui.min.js']: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
for f in ['harness.html', 'driver.js']: shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
sbc = read_b(os.path.join(APP, 'search_builder_content.php'))
at = sbc.find('?>')
if at < 0 or sbc.find('searchBuilderLightbox', at) < 0: raise SystemExit('search_builder_content.php: no markup after the PHP header - update run.py')
open(os.path.join(stage, 'sbc.html'), 'wb').write(sbc[at + 2:].lstrip('\r\n').encode('utf-8', 'surrogateescape'))

def write_build(js, css):
    open(os.path.join(stage, 'search_builder.js'), 'wb').write(js.encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'search_builder.css'), 'wb').write(css.encode('utf-8', 'surrogateescape'))

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
prof = os.path.join(os.environ.get('TEMP', stage), 'pnbedge_acrow_%d' % dp)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + prof, '--window-size=1366,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

KEYS = {
    'Escape': {'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27},
    'Enter': {'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r'},
    'Space': {'key': ' ', 'code': 'Space', 'windowsVirtualKeyCode': 32, 'text': ' '},
    'ArrowDown': {'key': 'ArrowDown', 'code': 'ArrowDown', 'windowsVirtualKeyCode': 40},
    'ArrowUp': {'key': 'ArrowUp', 'code': 'ArrowUp', 'windowsVirtualKeyCode': 38},
    'CtrlSpace': {'key': ' ', 'code': 'Space', 'windowsVirtualKeyCode': 32, 'modifiers': 2},
    'ShiftTab': {'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9, 'modifiers': 8},   # round 5
}

class Tab(object):
    def __init__(self):
        self.t = jget('/json/new?about:blank', 'PUT')
        self.ws = websocket.create_connection(self.t['webSocketDebuggerUrl'], timeout=60, suppress_origin=True)
        self.n = 0
        self.last = (0, 0)
        # Every build is written to the same file names: never let the browser hand
        # a page the previous build (heuristic freshness on http.server responses).
        self.call('Network.enable')
        self.call('Network.setCacheDisabled', {'cacheDisabled': True})
        self.call('Page.enable')
        self.call('Page.bringToFront')
        self.call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        self.call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html' % hp})
        t0 = time.time()
        while time.time() - t0 < 15:
            if self.ev("!!(window.T && window._penumbraSearchBuilder && document.readyState === 'complete')"): break
            time.sleep(0.1)
    def call(self, m, p=None):
        self.n += 1; mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get('id') == mid:
                if 'error' in r: raise RuntimeError('%s: %s' % (m, r['error']))
                return r.get('result', {})
    def ev(self, expr):
        r = self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
        if r.get('exceptionDetails'):
            return {'__exc': (r['exceptionDetails'].get('exception') or {}).get('description') or str(r['exceptionDetails'])[:300]}
        return r.get('result', {}).get('value')
    def js(self, expr):
        v = self.ev('JSON.stringify(%s)' % expr)
        if isinstance(v, dict): return v
        return json.loads(v) if v else None
    def state(self, i=0): return self.js('T.state(%d)' % i) or {}
    def open(self, host):
        self.ev("T.open('%s')" % host)
        t0 = time.time()
        while time.time() - t0 < 10:
            if self.ev('T.isOpen()') is True: break
            time.sleep(0.1)
        time.sleep(0.25)
    def mouse(self, typ, x, y, button='none', buttons=0, count=0):
        p = {'type': typ, 'x': x, 'y': y, 'button': button, 'buttons': buttons}
        if count: p['clickCount'] = count
        self.call('Input.dispatchMouseEvent', p)
    def click(self, x, y, button='left'):
        bits = {'left': 1, 'right': 2}[button]
        self.last = (x, y)
        self.mouse('mouseMoved', x, y); time.sleep(0.03)
        self.mouse('mousePressed', x, y, button, bits, 1); time.sleep(0.04)
        self.mouse('mouseReleased', x, y, button, 0, 1)
    def dblclick(self, x, y):
        self.last = (x, y)
        self.mouse('mouseMoved', x, y); time.sleep(0.03)
        self.mouse('mousePressed', x, y, 'left', 1, 1); time.sleep(0.03)
        self.mouse('mouseReleased', x, y, 'left', 0, 1); time.sleep(0.08)
        self.mouse('mousePressed', x, y, 'left', 1, 2); time.sleep(0.03)
        self.mouse('mouseReleased', x, y, 'left', 0, 2)
    def wheel(self, x, y, dy, wait=0.6):
        # A mouse-wheel scroll over (x, y) with the pointer held still there.
        self.call('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': x, 'y': y, 'deltaX': 0, 'deltaY': dy})
        time.sleep(wait)
    def nudge(self, wait=0.15):
        # A real 1px pointer move where the last click landed: a resting hand.
        x, y = self.last
        self.mouse('mouseMoved', x + 1, y); time.sleep(wait)
    def click_n(self, x, y, count):
        # A press the browser counts as the count-th of a multi-click (e.detail).
        self.last = (x, y)
        self.mouse('mouseMoved', x, y); time.sleep(0.03)
        self.mouse('mousePressed', x, y, 'left', 1, count); time.sleep(0.03)
        self.mouse('mouseReleased', x, y, 'left', 0, count)
    def tap(self, x, y):
        # A touch tap (needs Emulation.setTouchEmulationEnabled first).
        self.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); time.sleep(0.03)
        self.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    def viewport(self, w, h=900):
        # The window the user has: a narrow one makes the value list (min 200px) narrow.
        self.call('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': False})
        time.sleep(0.3)
    def press(self, part, v=None, i=0, button='left', wait=0.3):
        r = self.js('T.rect(%s, %s, %d)' % (json.dumps(part), json.dumps(v), i))
        if not r or '__exc' in r: return None
        hit = self.ev('T.hit(%d, %d)' % (r['x'], r['y']))
        self.click(r['x'], r['y'], button)
        time.sleep(wait)
        return hit
    def type(self, text, wait=0.3):
        self.call('Input.insertText', {'text': text}); time.sleep(wait)
    def key(self, name, wait=0.3):
        k = dict(KEYS[name])
        down = dict(k, type='keyDown' if 'text' in k else 'rawKeyDown')
        up = dict(k, type='keyUp'); up.pop('text', None)
        self.call('Input.dispatchKeyEvent', down)
        self.call('Input.dispatchKeyEvent', up)
        time.sleep(wait)
    def close(self):
        try: self.ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, self.t['id']), timeout=10).read()
        except Exception: pass

def with_tab(host, fn, width=None, prep=None):
    tab = Tab(); obs = {}
    try:
        if width: tab.viewport(width)
        if prep: tab.ev(prep)   # round 5: stubs the builder reads when it opens
        tab.open(host)
        fn(tab, obs)
        obs['errs'] = (tab.state() or {}).get('errs', [])
    except Exception as e:
        obs['exc'] = repr(e)
    finally:
        tab.close()
    return obs

def typed(tab, text='Al', q='NAME = Zed', i=0):
    tab.js('T.setup(%s)' % json.dumps(q)); time.sleep(0.15)
    tab.js('T.clearBox(%d)' % i); time.sleep(0.1)
    tab.type(text)

def whole(tab, q='NAME = Zed'):
    tab.js('T.setup(%s)' % json.dumps(q)); time.sleep(0.15)
    tab.js('T.clearBox(0)'); tab.js('T.dbl(0)'); time.sleep(0.25)

# --- Scenarios ----------------------------------------------------------------------
def s_pc_typed(t, o):
    typed(t)
    o['hit'] = t.press('cb', 'Alice')
    o['s'] = t.state()
    o['pe'] = t.ev('T.cbStyle()')
    t.ev("T.cbclick('Alice')"); time.sleep(0.25)
    o['s2'] = t.state()
    t.press('neutral'); time.sleep(0.3)
    o['blur'] = t.state()
def s_pl_typed(t, o):
    typed(t)
    o['hit'] = t.press('label', 'Alice')
    o['s'] = t.state()
    t.press('label', 'Alan')
    o['s2'] = t.state()
    t.key('Escape')
    o['esc'] = t.state()
def s_pc_whole(t, o):
    whole(t); o['hit'] = t.press('cb', 'Bob'); o['s'] = t.state()
def s_pl_whole(t, o):
    whole(t); o['hit'] = t.press('label', 'Bob'); o['s'] = t.state()
def s_pp_whole(t, o):
    whole(t); o['hit'] = t.press('pad', 'Bob'); o['s'] = t.state()
def s_right(t, o):
    typed(t); t.press('label', 'Alice', button='right'); o['s'] = t.state()
def s_untick(t, o):
    typed(t); t.press('label', 'Alice'); t.press('label', 'Alice')
    o['s'] = t.state()
    t.key('Escape'); o['esc'] = t.state()
def s_search(t, o):
    typed(t); t.press('cb', 'Alice')
    o['sync'] = t.js('T.submitSync()')
    time.sleep(0.7); o['after'] = t.state()
def s_opgt(t, o):
    typed(t); t.press('cb', 'Alice')
    t.js("T.op(0, 'gt')"); time.sleep(0.3); o['s'] = t.state()
def s_enter_set(t, o):
    t.js("T.setup('NAME = /^(?:Alice|Bob)$/')"); time.sleep(0.2)
    o['s0'] = t.state()
    t.press('box', None, 0); time.sleep(0.2)
    o['open'] = t.state()
    for _ in range(3): t.key('ArrowDown', 0.1)
    o['pre'] = t.state()
    t.key('Enter', 0.8)
    o['after'] = t.state()
def s_enter_keep(t, o):
    t.js("T.setup('NAME = /^(?:Alice|Bob)$/')"); time.sleep(0.2)
    t.press('box', None, 0); time.sleep(0.2)
    t.key('ArrowDown', 0.1)
    o['pre'] = t.state()
    t.key('Enter', 0.8)
    o['after'] = t.state()
def s_enter_single(t, o):
    typed(t, 'Bo'); t.key('ArrowDown', 0.1)
    o['pre'] = t.state()
    t.key('Enter', 0.8)
    o['after'] = t.state()
def s_space(t, o):
    t.js("T.setup('NAME = Zed')"); time.sleep(0.15)
    t.js('T.clearBox(0)'); time.sleep(0.1)
    t.key('CtrlSpace', 0.25)
    o['s0'] = t.state()
    t.key('ArrowDown', 0.1); t.key('ArrowDown', 0.1)
    t.key('Space'); o['s1'] = t.state()
    t.key('ArrowDown', 0.1); o['s2'] = t.state()
    t.key('Space'); o['s3'] = t.state()
def s_typedset(t, o):
    t.js("T.setup('NAME = Zed')"); time.sleep(0.15)
    t.js("T.prepBox(0, 'Alice|Bob')"); t.js('T.dbl(0)'); time.sleep(0.25)
    o['s0'] = t.state()
    t.press('label', 'Albert'); o['s1'] = t.state()
    t.key('Escape'); o['s2'] = t.state()
def s_zed(t, o):
    t.js("T.setup('NAME = Zed')"); time.sleep(0.15)
    t.js("T.prepBox(0, 'Zed')"); t.js('T.dbl(0)'); time.sleep(0.25)
    o['s0'] = t.state()
    t.press('label', 'Bob'); o['s1'] = t.state()
    t.key('Escape'); o['s2'] = t.state()
def s_typedfull(t, o):
    typed(t, 'Alice'); o['s0'] = t.state()
    t.press('label', 'Alice'); o['s1'] = t.state()
def s_json(t, o):
    typed(t, '['); t.press('label', '[1,2]'); t.key('Escape'); o['s'] = t.state()
    t.js("T.op(0, 'gt')"); time.sleep(0.2)
    t.js('T.clearBox(0)'); t.type('[')
    o['open'] = t.state()
    t.press('label', '[1,2]'); o['s2'] = t.state()
def s_header(t, o):
    typed(t); t.press('label', 'Alice'); o['s0'] = t.state()
    t.press('show'); o['s1'] = t.state()
    t.press('show'); o['s2'] = t.state()
    t.press('clear'); o['s3'] = t.state()
    t.key('Escape'); o['s4'] = t.state()
def s_caret(t, o):
    typed(t); t.press('label', 'Alice'); o['s0'] = t.state()
    t.press('box', None, 0); o['s'] = t.state()
def s_rehost(t, o):
    t.js("T.setup('NAME = Zed and NAME = Zod')"); time.sleep(0.2)
    o['rows'] = t.ev('T.rows()')
    t.js('T.clearBox(0)'); time.sleep(0.1); t.type('Al')
    t.press('label', 'Alice'); o['s0'] = t.state(0)
    t.ev("T.rehost(1, 'B')"); time.sleep(0.45)
    o['r0'] = t.state(0); o['r1'] = t.state(1)
def s_pipe(t, o):
    typed(t, 'X'); t.press('cb', 'X|Y')
    o['mid'] = t.state(); o['gs'] = t.js('T.getState()')
    t.key('Escape'); o['after'] = t.state()
def s_sched(t, o):
    typed(t); o['s0'] = t.state()
    t.press('cb', 'Alice')
    t.press('submit', wait=0.8); o['after'] = t.state()
def s_token(t, o):
    typed(t, '{F'); o['s0'] = t.state()
    t.press('label', '{FNAME}'); o['s1'] = t.state()
    t.js('T.dbl(0)'); time.sleep(0.25)
    o['whole'] = t.state()
    t.press('label', 'Alice'); o['s2'] = t.state()
    t.press('label', '{FNAME}'); o['s3'] = t.state()
def s_dash(t, o):
    typed(t); t.press('cb', 'Alice'); time.sleep(0.35)
    o['s'] = t.state()
    t.press('submit', wait=0.8); o['after'] = t.state()
def s_colchange(t, o):
    typed(t); t.press('label', 'Alice')
    t.js("T.col(0, 'CODE')"); time.sleep(0.35); o['s'] = t.state()
def s_free(t, o):
    typed(t, 'Zork'); t.key('Escape'); o['s'] = t.state()
def s_remove(t, o):
    t.js("T.setup('NAME = Zed and NAME = Zod')"); time.sleep(0.2)
    t.js('T.clearBox(1)'); time.sleep(0.1); t.type('Al')
    t.press('label', 'Alice')
    o['rows'] = t.ev('T.remove(1)'); time.sleep(0.3); o['s'] = t.state()
# --- review round: mouse then keyboard, geometry, header, toggle columns, Escape ---
def s_still(t, o):
    whole(t)
    o['s0'] = t.state(); o['tops0'] = t.js('T.tops()')
    o['hit'] = t.press('label', 'Bob')
    o['s1'] = t.state(); o['tops1'] = t.js('T.tops()')
def s_enter_click(t, o):
    whole(t)
    t.press('label', 'Bob'); o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_enter_typed(t, o):
    typed(t)
    t.press('label', 'Albert'); o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_dbl(t, o):
    whole(t)
    r = t.js("T.rect('label', 'Bob', 0)")
    t.dblclick(r['x'], r['y']); time.sleep(0.4)
    o['s1'] = t.state()
    t.press('neutral'); time.sleep(0.3)
    o['blur'] = t.state()
def s_unenter(t, o):
    typed(t)
    t.press('label', 'Alice'); t.press('label', 'Alan'); t.press('label', 'Alan')
    o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_unenter_still(t, o):
    # the reviewers' flow: untick by mouse, Enter with the pointer where it was
    typed(t)
    t.press('label', 'Alice'); t.press('label', 'Alan'); t.press('label', 'Alan')
    o['s1'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_unenter_set(t, o):
    t.js("T.setup('NAME = /^(?:Alice|Bob|Alan)$/')"); time.sleep(0.2)
    t.press('box', None, 0); time.sleep(0.2)
    o['open'] = t.state()
    t.press('label', 'Alan'); o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_spacetype(t, o):
    t.js("T.setup('CITY = Zed')"); time.sleep(0.15)
    t.js('T.clearBox(0)'); time.sleep(0.1)
    t.type('New'); o['s0'] = t.state()
    t.press('label', 'New Haven'); o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Space'); t.type('York'); o['s3'] = t.state()
def s_rest(t, o):
    t.js("T.setup('NAME = Zed')"); time.sleep(0.15)
    t.js('T.clearBox(0)'); time.sleep(0.1)
    t.key('CtrlSpace', 0.3)
    r = t.js("T.rect('label', 'Bob', 0)")
    t.mouse('mouseMoved', r['x'], r['y']); time.sleep(0.15)
    o['hover'] = t.state()
    t.key('ArrowDown', 0.15); o['s0'] = t.state()
    t.key('Space', 0.4); o['s1'] = t.state()
    t.key('Space', 0.4); o['s2'] = t.state()
def s_strand(t, o):
    t.js("T.setup('NAME = /^(?:Alice|Bob)$/')"); time.sleep(0.2)
    t.press('box', None, 0); time.sleep(0.2)
    o['open'] = t.state()
    t.press('show'); o['only'] = t.state()
    t.press('label', 'Alice'); o['u1'] = t.state()
    t.press('label', 'Bob'); o['u2'] = t.state()
    t.type('A'); o['typed'] = t.state()
def s_showone(t, o):
    t.js("T.setup('NAME = Bob')"); time.sleep(0.2)
    t.js('T.dbl(0)'); time.sleep(0.25)
    o['s0'] = t.state()
    o['hit'] = t.press('show'); o['s1'] = t.state()
def s_rowlink(t, o):
    typed(t); t.press('label', 'Alice'); o['s1'] = t.state()
    t.press('label', 'Alan'); o['s2'] = t.state()
    t.key('Escape', 0.6); o['s3'] = t.state()
def s_toggle(t, o):
    t.js('T.setup(%s)' % json.dumps(u'TOG = ☐')); time.sleep(0.2)
    t.ev('document.activeElement && document.activeElement.blur()'); time.sleep(0.3)
    o['s0'] = t.state()
    t.js('T.prepBox(0, %s)' % json.dumps(u'☐')); time.sleep(0.4)   # focus opens a toggle column's whole list
    o['open'] = t.state()
    t.press('label', u'☑'); o['s1'] = t.state()
def s_esc(t, o):
    typed(t); t.press('label', 'Alice'); t.press('label', 'Alan')
    o['s0'] = t.state()
    t.key('Escape', 0.7); o['s1'] = t.state()
    t.key('Escape', 0.9); o['s2'] = t.state()
# --- round 3: narrow lists, double-tap on the next row, header presses, Space then
# Enter, hover then Enter, the scheduler's counts ---
def open_whole(t, col):
    t.js('T.setup(%s)' % json.dumps('%s = Zed' % col)); time.sleep(0.15)
    t.js('T.clearBox(0)'); t.js('T.dbl(0)'); time.sleep(0.3)
def still_seq(col, vals):
    # 0 -> 1 -> 2 -> 1 -> 0 ticks: where the box, the list, its header and every row sit
    def f(t, o):
        open_whole(t, col)
        o['g0'] = t.js('T.geo()'); o['s0'] = t.state()
        # the hint fits the list's width (one line, not cut): [scrollWidth, clientWidth]
        o['hintfit'] = t.js("(function(){var h=document.querySelector('#sbAutocompleteDropdown .sb-ac-hint'); return h ? [h.scrollWidth, h.clientWidth] : null;})()")
        for lab, v in (('1', vals[0]), ('2', vals[1]), ('1b', vals[1]), ('0b', vals[0])):
            t.press('label', v)
            o['g' + lab] = t.js('T.geo()'); o['s' + lab] = t.state()
    return f
def fast_seq(col, vals):
    # The reviewer's fast hand: aim at three rows where they were drawn, click each
    # 0.6 s apart (outside the double-click time), never re-aiming.
    def f(t, o):
        open_whole(t, col)
        pts = [t.js('T.rect("label", %s, 0)' % json.dumps(v)) for v in vals]
        pts = [p if (p and '__exc' not in p) else None for p in pts]
        o['aim'] = [[v, p and p['y']] for v, p in zip(vals, pts)]
        for p in pts:
            if p: t.click(p['x'], p['y'])
            time.sleep(0.6)
        o['s'] = t.state()
    return f
def s_dblnext(t, o):
    # A quick second press on the NEXT row that the browser counts as a double-click.
    whole(t)
    ra, rb = t.js("T.rect('label', 'Alan', 0)"), t.js("T.rect('label', 'Albert', 0)")
    if not ra or not rb or '__exc' in ra or '__exc' in rb:
        o['s1'] = t.state(); return
    t.click_n(ra['x'], ra['y'], 1); time.sleep(0.1)
    t.click_n(rb['x'], rb['y'], 2); time.sleep(0.4)
    o['s1'] = t.state()
def s_dbltap(t, o):
    # Touch: two quick taps 16px apart (Alan, then Albert just below) are a double-tap.
    whole(t)
    t.call('Emulation.setTouchEmulationEnabled', {'enabled': True, 'maxTouchPoints': 5})
    ra = t.js("T.rect('label', 'Alan', 0)")
    if not ra or '__exc' in ra:
        o['s1'] = t.state(); return
    t.tap(ra['x'], ra['y']); time.sleep(0.15)
    t.tap(ra['x'], ra['y'] + 16); time.sleep(0.9)
    o['s1'] = t.state()
def s_hdrpress(t, o):
    whole(t)
    o['hint'] = t.press('hint', wait=0.5); o['s0'] = t.state()
    t.press('label', 'Alice'); t.press('label', 'Alan')
    o['counts'] = t.press('counts', wait=0.5); o['s1'] = t.state()
    t.press('show'); o['s2'] = t.state()
def s_spaceenter(t, o):
    typed(t); t.key('ArrowDown', 0.15)
    t.key('Space', 0.4); o['s1'] = t.state()
    t.key('Space', 0.4); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_spacearrow(t, o):
    # an arrow key after Space re-arms Enter: Alan is ticked too
    typed(t); t.key('ArrowDown', 0.15); t.key('Space', 0.4); t.key('ArrowDown', 0.15)
    t.key('Enter', 0.8); o['after'] = t.state()
def s_spacetwo(t, o):
    # unchanged: ArrowDown, Space, ArrowDown, Space, Enter = the two values
    typed(t); t.key('ArrowDown', 0.15); t.key('Space', 0.4); t.key('ArrowDown', 0.15); t.key('Space', 0.4)
    t.key('Enter', 0.8); o['after'] = t.state()
def s_downenter(t, o):
    # unchanged: ArrowDown, Enter = tick the highlighted value and search
    typed(t); t.key('ArrowDown', 0.15)
    t.key('Enter', 0.8); o['after'] = t.state()
def hover(t, v):
    # a real pointer move onto a row (none when the list is not there: the build closed it)
    r = t.js('T.rect("label", %s, 0)' % json.dumps(v))
    if r and '__exc' not in r:
        t.mouse('mouseMoved', r['x'], r['y'])
    time.sleep(0.2)
def s_hover(t, o):
    typed(t)
    hover(t, 'Albert'); o['hov'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_hover_ticked(t, o):
    typed(t); t.press('label', 'Alice'); o['s1'] = t.state()
    hover(t, 'Albert'); o['hov'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_unenter_last(t, o):
    # untick the only tick by click, the hand rests on it, Enter: it stays unticked
    typed(t); t.press('label', 'Alice'); t.press('label', 'Alice'); o['s1'] = t.state()
    t.nudge(); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_count(t, o):
    whole(t); o['whole'] = t.state()
    t.js('T.clearBox(0)'); t.type('Al'); o['typed'] = t.state()
# --- round 4: what grows or shrinks BELOW the box (the dialog is centred on the page), the
# wheel, a double-click in 'Show only selected', a hovered recipient token with values
# ticked, the row just decided by Space / before Clear selection ---
LONG4 = ['National Science Foundation', 'National Institutes of Health', 'Department of Energy', 'Department of Defense']
def still_below(prep, col, typed_text, vals):
    # Up through vals and back down to 0, each state read after the count line's 200 ms
    # refill: the box, the list, the header and every row top stay where they were.
    def f(t, o):
        o['bplain'] = t.js('T.below()')   # before the stub: the plain count line
        t.ev(prep)
        if typed_text:
            typed(t, typed_text, '%s = Zed' % col); time.sleep(0.4)
        else:
            open_whole(t, col); time.sleep(0.3)
        o['g0'] = t.js('T.geo()'); o['b0'] = t.js('T.below()'); o['s0'] = t.state()
        seq = [(str(i + 1), v) for i, v in enumerate(vals)] + [('%db' % i, vals[i]) for i in range(len(vals) - 1, -1, -1)]
        o['labs'] = ['0'] + [lab for lab, _ in seq]
        for lab, v in seq:
            t.js('(window.__pressGeo = null)')
            t.press('label', v, wait=0.5)
            # p = right after the press was handled (count line still empty), g = settled
            o['p' + lab] = t.js('window.__pressGeo')
            o['g' + lab] = t.js('T.geo()'); o['b' + lab] = t.js('T.below()'); o['s' + lab] = t.state()
    return f
def fast_top4(prep, col, typed_text, vals):
    # The reviewer's hurried hand in pivot view: aim at each row's upper edge (top + 4px)
    # where it was drawn before any tick, click 0.6 s apart, never re-aiming.
    def f(t, o):
        t.ev(prep)
        typed(t, typed_text, '%s = Zed' % col); time.sleep(0.4)
        pts = [t.js('T.rect("top4", %s, 0)' % json.dumps(v)) for v in vals]
        pts = [p if (p and '__exc' not in p) else None for p in pts]
        o['landed'] = []
        for p in pts:
            if p:
                o['landed'].append(t.ev('T.itemAt(%d, %d)' % (p['x'], p['y'])))
                t.click(p['x'], p['y'])
            time.sleep(0.6)
        o['s'] = t.state()
    return f
def s_wheel(t, o):
    # nothing ticked: a real pointer move onto Avocado, then the wheel scrolls the list
    # under the still pointer; Enter
    open_whole(t, 'FRUIT')
    r = t.js("T.rect('label', 'Avocado', 0)")
    if not r or '__exc' in r:
        o['s1'] = t.state(); return
    t.mouse('mouseMoved', r['x'], r['y']); time.sleep(0.2); o['hov'] = t.state()
    t.wheel(r['x'], r['y'], 120)
    o['under'] = t.ev('T.itemAt(%d, %d)' % (r['x'], r['y'])); o['lit'] = t.js('T.lit()'); o['s1'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_wheel_key(t, o):
    # the arrow keys' highlight (Banana) is not the mouse's: the wheel leaves it be
    open_whole(t, 'FRUIT')
    r = t.js("T.rect('label', 'Avocado', 0)")
    if not r or '__exc' in r:
        o['s1'] = t.state(); return
    t.mouse('mouseMoved', r['x'], r['y']); time.sleep(0.2)
    t.key('ArrowDown', 0.2); o['s0'] = t.state()
    t.wheel(r['x'], r['y'], 120); o['s1'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_showdbl(t, o):
    # 'Show only selected' with 3 ticked, a double-click on Alice: the 1st press unticks it
    # (the list drops it, Alan slides under the pointer), the 2nd press must not touch Alan
    typed(t)
    for v in AL3: t.press('label', v, wait=0.4)
    t.press('show', wait=0.5); o['only'] = t.state()
    r = t.js("T.rect('label', 'Alice', 0)")
    if not r or '__exc' in r:
        o['s1'] = t.state(); return
    t.dblclick(r['x'], r['y']); time.sleep(0.5); o['s1'] = t.state()
def s_showdbl_last(t, o):
    # ...on the only tick: the 1st press brings the full list back, the 2nd must not tick
    # the value that came up under the pointer
    typed(t); t.press('label', 'Albert', wait=0.4)
    t.press('show', wait=0.5); o['only'] = t.state()
    r = t.js("T.rect('label', 'Albert', 0)")
    if not r or '__exc' in r:
        o['s1'] = t.state(); return
    t.dblclick(r['x'], r['y']); time.sleep(0.5); o['s1'] = t.state()
    t.press('neutral', wait=0.6); o['closed'] = t.state()
def s_tokenenter(t, o):
    # scheduler EMAIL host: Alice + Alan ticked, the pointer on a recipient token, Enter
    typed(t, 'a')
    t.press('label', 'Alice'); t.press('label', 'Alan'); o['two'] = t.state()
    hover(t, '{FNAME}'); o['hov'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_tokenkey(t, o):
    # ...the arrow keys' token row (ArrowUp from nothing = the last row) is still picked
    typed(t, 'a')
    t.press('label', 'Alice'); t.press('label', 'Alan')
    t.key('ArrowUp', 0.2); o['pre'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_spacenudge(t, o):
    # Space unticks the arrow keys' Alice, a 1px real pointer move lands on her row, Enter
    typed(t); t.key('ArrowDown', 0.15); t.key('Space', 0.4); t.key('Space', 0.4); o['s1'] = t.state()
    r = t.js("T.rect('label', 'Alice', 0)")
    if r and '__exc' not in r:
        t.mouse('mouseMoved', r['x'] + 1, r['y']); time.sleep(0.2)
    o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
def s_clearhover(t, o):
    # Alan + Alice ticked, Clear selection, the pointer straight onto Alice, Enter
    typed(t); t.press('label', 'Alan'); t.press('label', 'Alice')
    t.press('clear', wait=0.4); o['s1'] = t.state()
    hover(t, 'Alice'); o['s2'] = t.state()
    t.key('Enter', 0.8); o['after'] = t.state()
# --- round 5: the column picked again; the column cell's tip on one line ---
def col_popup(t, i, keys, wait=0.6):
    # A REAL pick from row i's column <select>: a trusted press opens its popup, then the
    # keys go to the popup (ArrowDown moves its highlight, Enter picks, Escape dismisses).
    r = t.js('T.colRect(%d)' % i)
    if not r or '__exc' in r: return None
    r0 = t.ev('T.renders()')
    t.click(r['x'], r['y']); time.sleep(0.5)
    st = {'popup': t.state(i), 'popupRenders': t.ev('T.renders()') - r0, 'popupWhere': t.js('T.where(%d)' % i)}
    for k in keys: t.key(k, 0.25)
    time.sleep(wait)
    st['renders'] = t.ev('T.renders()') - r0
    return st
def blur_all(t, wait=0.3):
    t.ev('document.activeElement && document.activeElement.blur && document.activeElement.blur()'); time.sleep(wait)
def s_repick_one(t, o):
    # one tick, a click away (the list closes: Alice in the box), the column picked again
    typed(t); t.press('label', 'Alice'); t.press('neutral', wait=0.5); o['closed'] = t.state()
    o['pick'] = col_popup(t, 0, ['Enter'])
    o['s'] = t.state(); o['w'] = t.js('T.where(0)')
    t.press('label', 'Bob'); o['s2'] = t.state()
    t.key('Escape', 0.6); o['esc'] = t.state()
def s_repick_set(t, o):
    # two ticks, a click away (the set of 2 on the row), the column picked again
    typed(t); t.press('label', 'Alice'); t.press('label', 'Alan'); t.press('neutral', wait=0.5); o['closed'] = t.state()
    o['pick'] = col_popup(t, 0, ['Enter'])
    o['s'] = t.state(); o['w'] = t.js('T.where(0)')
    t.key('Escape', 0.6); o['esc'] = t.state()
def s_repick_keys(t, o):
    # the keyboard only: one tick, Shift+Tab twice (the list closes: Alice in the box; the focus
    # on the column select), Space opens its popup, Enter picks the same column
    typed(t); t.press('label', 'Alice')
    t.key('ShiftTab', 0.3); t.key('ShiftTab', 0.4); o['onsel'] = t.state(); o['w0'] = t.js('T.where(0)')
    r0 = t.ev('T.renders()')
    t.key('Space', 0.5); o['popup'] = t.state()
    t.key('Enter', 0.6); o['s'] = t.state(); o['w'] = t.js('T.where(0)'); o['r'] = t.ev('T.renders()') - r0
def s_repick_diff(t, o):
    # (guard) a DIFFERENT column from the popup (NAME -> CODE)
    t.js("T.setup('NAME = Alice')"); time.sleep(0.2); blur_all(t)
    o['pick'] = col_popup(t, 0, ['ArrowDown', 'Enter'])
    o['s'] = t.state()
def s_repick_esc(t, o):
    # (guard) the popup opened (its press is a click with detail 1), then Escape
    t.js("T.setup('NAME = Alice')"); time.sleep(0.2); blur_all(t)
    o['pick'] = col_popup(t, 0, ['Escape'])
    o['s'] = t.state()
def s_repick_syn(t, o):
    # the browsers' event sequences dispatched and read in ONE turn (T.repick), each from a
    # closed list
    def reset(q):
        blur_all(t); t.js('T.setup(%s)' % json.dumps(q)); time.sleep(0.2); blur_all(t)
    def run(key, how, q, to=None):
        reset(q)
        r0 = t.ev('T.renders()')
        o[key] = t.js('T.repick(0, %s, %s)' % (json.dumps(how), json.dumps(to)))
        time.sleep(0.5)
        o[key + '_s'] = t.state(); o[key + '_w'] = t.js('T.where(0)'); o[key + '_r'] = t.ev('T.renders()') - r0
    run('one', 'chromium', 'NAME = Alice')
    run('set', 'chromium', 'NAME = /^(?:Alice|Bob)$/')
    run('ff', 'firefox', 'NAME = Alice')
    run('diff', 'chromium', 'NAME = Alice', 'CODE')
    run('user', 'user', 'NAME = Alice')
    run('jq', 'jq', 'NAME = Alice')
    run('dis', 'dismiss', 'NAME = Alice')
    # a between row: From 'Alan', To 'Bob'
    reset('NAME = Zed'); t.js("T.op(0, 'between')"); time.sleep(0.2)
    # (values set without an input event: one would open the To box's list, and nothing closes it)
    t.ev("(function(){var $r=$('#sbConditionsContainer .sb-condition-row').eq(0); $r.find('.sb-value-input').not('.sb-value-input-secondary').val('Alan'); $r.find('.sb-value-input-secondary').val('Bob'); return true;})()")
    blur_all(t)
    o['btw'] = t.js("T.repick(0, 'chromium')"); time.sleep(0.5)
    o['btw_s'] = t.state(); o['btw_w'] = t.js('T.where(0)')
    # a column-reference row (its value box hidden): nothing to open
    reset('NAME = Alice'); t.ev("$('#sbConditionsContainer .sb-swap-to-col-link').first().trigger('click'); true"); time.sleep(0.2); blur_all(t)
    r0 = t.ev('T.renders()')
    o['ref'] = t.js("T.repick(0, 'chromium')"); time.sleep(0.5)
    o['ref_s'] = t.state(); o['ref_r'] = t.ev('T.renders()') - r0
def s_repick_open(t, o):
    # the list OPEN with a selection of 2 (typed 'Al'), the column picked again inside the
    # value box's 150 ms blur delay (the Chromium sequence in one turn)
    typed(t); t.press('label', 'Alice'); t.press('label', 'Alan'); o['s0'] = t.state()
    o['pick'] = t.js("T.repick(0, 'chromium')")
    time.sleep(0.6); o['s'] = t.state(); o['w'] = t.js('T.where(0)')
    t.key('Escape', 0.6); o['esc'] = t.state()
LAYOUT_PREP = 'T.dateCols()'
WIDE_TIP = ("(function(){var s=document.createElement('style'); s.textContent='.sb-date-tip,.sb-nested-tip{letter-spacing:1px}';"
            " document.head.appendChild(s); return true;})()")
def s_layout(t, o):
    # the four rows (plain, between dates, nested, long name), then the value list on row 0
    # opened whole (Alice ticked), Alice unticked, Bob ticked: the list's place, width, header
    t.js('T.fourRows()'); time.sleep(0.5); t.js('T.fourVals()'); time.sleep(0.4)
    o['lay'] = t.js('T.layout()')
    t.js('T.dbl(0)'); time.sleep(0.3)
    fit = ("(function(){var d=document.getElementById('sbAutocompleteDropdown'), b=$('#sbConditionsContainer .sb-condition-row').eq(0)"
           ".find('.sb-value-input')[0]; if(!d||!$(d).is(':visible')) return null; var r=d.getBoundingClientRect(), q=b.getBoundingClientRect();"
           " return {w:Math.round(r.width), boxW:Math.round(q.width), l:Math.round(r.left), boxL:Math.round(q.left), top:Math.round(r.top), boxB:Math.round(q.bottom)};})()")
    o['fit'] = t.js(fit)
    o['g1'] = t.js('T.geo()'); o['s1'] = t.state()
    t.press('label', 'Alice'); o['g0'] = t.js('T.geo()'); o['s0'] = t.state()
    t.press('label', 'Bob'); o['g1b'] = t.js('T.geo()'); o['s1b'] = t.state()
def s_layout_wide(t, o):
    t.ev(WIDE_TIP)
    t.js('T.fourRows()'); time.sleep(0.5); t.js('T.fourVals()'); time.sleep(0.4)
    o['lay'] = t.js('T.layout()')
def s_layout_narrow(t, o):
    t.js('T.fourRows()'); time.sleep(0.5); t.js('T.fourVals()'); time.sleep(0.4)
    o['lay'] = t.js('T.layout()')
# Round-5 fix: where row 0's To-box list sits against the window (its right edge, the box).
TOLIST_FIT = ("(function(){var d=document.getElementById('sbAutocompleteDropdown'), de=document.documentElement,"
              " b=$('#sbConditionsContainer .sb-condition-row').eq(0).find('.sb-value-input-secondary')[0]; if(!b) return null;"
              " var q=b.getBoundingClientRect(), o={boxL:Math.round(q.left), boxR:Math.round(q.right), boxW:Math.round(q.width),"
              " boxB:Math.round(q.bottom), vw:window.innerWidth, cw:de.clientWidth, page:[de.scrollWidth, de.clientWidth],"
              " host: !!(d && $(d).data('sbHostInput') === b), focusTo: document.activeElement === b};"
              " if(d && $(d).is(':visible')){var r=d.getBoundingClientRect(); o.l=Math.round(r.left); o.r=Math.round(r.right);"
              " o.w=Math.round(r.width); o.top=Math.round(r.top);} return o;})()")
def s_tolist(t, o):
    # a between row (NAME, From Zed): a trusted click into its To box and 'Al' typed there
    t.js("T.setup('NAME = Zed')"); time.sleep(0.2); t.js("T.op(0, 'between')"); time.sleep(0.2); blur_all(t)
    r = t.js("(function(){var b=$('#sbConditionsContainer .sb-condition-row').eq(0).find('.sb-value-input-secondary')[0];"
             " if(!b) return null; var q=b.getBoundingClientRect(); return {x:Math.round(q.left+20), y:Math.round(q.top+q.height/2)};})()")
    if not r: return
    t.click(r['x'], r['y']); time.sleep(0.3)
    t.type('Al', 0.5)
    o['fit'] = t.js(TOLIST_FIT); o['s'] = t.state()
def s_btwdiff(t, o):
    # a between row (From 'Alan', To 'Bob'), then a DIFFERENT column from the popup (NAME -> CODE)
    t.js("T.setup('NAME = Zed')"); time.sleep(0.2); t.js("T.op(0, 'between')"); time.sleep(0.2)
    t.ev("(function(){var $r=$('#sbConditionsContainer .sb-condition-row').eq(0); $r.find('.sb-value-input').not('.sb-value-input-secondary').val('Alan'); $r.find('.sb-value-input-secondary').val('Bob'); return true;})()")
    blur_all(t)
    o['pick'] = col_popup(t, 0, ['ArrowDown', 'Enter'], wait=0.15)
    o['s0'] = t.state(); o['w0'] = t.js('T.where(0)')
    time.sleep(0.6)
    o['s'] = t.state(); o['w'] = t.js('T.where(0)')

SCENARIOS = [
    ('pc_typed', 'report', s_pc_typed), ('pl_typed', 'report', s_pl_typed),
    ('pc_whole', 'report', s_pc_whole), ('pl_whole', 'report', s_pl_whole), ('pp_whole', 'report', s_pp_whole),
    ('right', 'report', s_right), ('untick', 'report', s_untick), ('search', 'report', s_search), ('opgt', 'report', s_opgt),
    ('enter_set', 'report', s_enter_set), ('enter_keep', 'report', s_enter_keep), ('enter_single', 'report', s_enter_single),
    ('space', 'report', s_space), ('typedset', 'report', s_typedset), ('zed', 'report', s_zed), ('typedfull', 'report', s_typedfull),
    ('json', 'report', s_json), ('header', 'report', s_header), ('caret', 'report', s_caret), ('rehost', 'report', s_rehost),
    ('pipe', 'report', s_pipe), ('sched', 'sched', s_sched), ('token', 'sched', s_token), ('dash', 'dash', s_dash),
    ('colchange', 'report', s_colchange), ('free', 'report', s_free), ('remove', 'report', s_remove),
    ('still', 'report', s_still), ('enter_report', 'report', s_enter_click), ('enter_sched', 'sched', s_enter_click),
    ('enter_dash', 'dash', s_enter_click), ('enter_typed', 'report', s_enter_typed), ('dbl', 'report', s_dbl),
    ('unenter', 'report', s_unenter), ('unenter_still', 'report', s_unenter_still), ('unenter_set', 'report', s_unenter_set),
    ('spacetype', 'report', s_spacetype),
    ('rest', 'report', s_rest), ('strand', 'report', s_strand), ('showone', 'report', s_showone),
    ('rowlink', 'report', s_rowlink), ('toggle', 'report', s_toggle),
    ('esc_report', 'report', s_esc), ('esc_sched', 'sched', s_esc), ('esc_dash', 'dash', s_esc),
    # round 3 (a 4th item = the window width; the rest run at the browser's 1366)
    ('still_1024', 'report', still_seq('NAME', ['Alice', 'Alan']), 1024),
    ('fast_1024', 'report', fast_seq('NAME', ['Alice', 'Alan', 'Albert']), 1024),
    ('still_800', 'report', still_seq('NAME', ['Alice', 'Alan']), 800),
    ('fast_800', 'report', fast_seq('NAME', ['Alice', 'Alan', 'Albert']), 800),
    ('still_sched', 'sched', still_seq('FRUIT', ['Apple', 'Apricot']), 1200),
    ('fast_sched', 'sched', fast_seq('FRUIT', ['Apple', 'Apricot', 'Avocado']), 1200),
    ('dblnext', 'report', s_dblnext), ('dbltap', 'report', s_dbltap), ('hdrpress', 'report', s_hdrpress),
    ('spaceenter', 'report', s_spaceenter), ('spacearrow', 'report', s_spacearrow),
    ('spacetwo', 'report', s_spacetwo), ('downenter', 'report', s_downenter),
    ('hover_report', 'report', s_hover), ('hover_sched', 'sched', s_hover), ('hover_dash', 'dash', s_hover),
    ('hover_ticked', 'report', s_hover_ticked), ('unenter_last', 'report', s_unenter_last),
    ('count_sched', 'sched', s_count),
    # round 4
    ('still_pivot', 'report', still_below('T.pivotCount()', 'NAME', 'Al', ['Alice', 'Alan']), 1024),
    ('fast_pivot_1024', 'report', fast_top4('T.pivotCount()', 'NAME', 'Al', ['Alice', 'Alan', 'Albert']), 1024),
    ('fast_pivot_1366', 'report', fast_top4('T.pivotCount()', 'NAME', 'Al', ['Alice', 'Alan', 'Albert']), 1366),
    ('still_long_report', 'report', still_below('T.longValues()', 'SPONSOR', None, LONG4), 1024),
    ('still_long_sched', 'sched', still_below('T.longValues()', 'SPONSOR', None, LONG4), 1024),
    ('still_long_dash', 'dash', still_below('T.longValues()', 'SPONSOR', None, LONG4), 1024),
    ('wheel', 'report', s_wheel), ('wheel_key', 'report', s_wheel_key),
    ('showdbl', 'report', s_showdbl), ('showdbl_last', 'report', s_showdbl_last),
    ('tokenenter', 'sched', s_tokenenter), ('tokenkey', 'sched', s_tokenkey),
    ('spacenudge', 'report', s_spacenudge), ('clearhover', 'report', s_clearhover),
    # round 5 (a 5th item = JS run before the builder opens)
    ('repick_one', 'report', s_repick_one), ('repick_set', 'report', s_repick_set), ('repick_keys', 'report', s_repick_keys),
    ('repick_diff', 'report', s_repick_diff), ('repick_esc', 'report', s_repick_esc),
    ('repick_syn', 'report', s_repick_syn), ('repick_open', 'report', s_repick_open),
    ('layout_1024', 'report', s_layout, 1024, LAYOUT_PREP), ('layout_1280', 'report', s_layout, 1280, LAYOUT_PREP),
    ('layout_1366', 'report', s_layout, 1366, LAYOUT_PREP), ('layout_1440', 'report', s_layout, 1440, LAYOUT_PREP),
    ('layout_1920', 'report', s_layout, 1920, LAYOUT_PREP),
    ('layout_wide', 'report', s_layout_wide, 1366, LAYOUT_PREP), ('layout_700', 'report', s_layout_narrow, 700, LAYOUT_PREP),
    # round-5 fix
    ('tolist_769', 'report', s_tolist, 769), ('tolist_800', 'report', s_tolist, 800), ('tolist_dash', 'dash', s_tolist, 769),
    ('btwdiff', 'report', s_btwdiff),
]

# --- Asserts --------------------------------------------------------------------------
def g(o, *path):
    for p in path:
        if not isinstance(o, dict): return None
        o = o.get(p)
    return o
KEYS_SAME = ['set', 'box', 'ph', 'rowMulti', 'boxMulti', 'open', 'checked', 'ticks', 'shown', 'header', 'preview']
def pick(s): return {k: (s or {}).get(k) for k in KEYS_SAME}
AL3 = ['Alice', 'Alan', 'Albert']
ALL = ['Alice', 'Alan', 'Albert', 'Bob', '[1,2]', 'X|Y']

def evaluate(O):
    R = {}
    def A(aid, cond, detail):
        R[aid] = (bool(cond), detail)
    pc, pl = O['pc_typed'], O['pl_typed']
    s = g(pc, 's') or {}
    A('P-first', s.get('set') == ['Alice'] and s.get('box') == 'Al' and s.get('open') and s.get('shown') == AL3
      and s.get('checked') == ['Alice'] and s.get('ticks') == ['Alice'] and s.get('preview') == 'NAME = Alice',
      pick(s))
    A('P-same', pick(g(pc, 's')) == pick(g(pl, 's')) and g(pl, 's', 'set') == ['Alice'],
      {'checkbox': pick(g(pc, 's')), 'label': pick(g(pl, 's'))})
    w = [pick(g(O[k], 's')) for k in ('pc_whole', 'pl_whole', 'pp_whole')]
    A('P-whole', w[0] == w[1] == w[2] and w[0].get('set') == ['Bob'] and w[0].get('box') == '' and w[0].get('ph') == 'Bob'
      and w[0].get('open') and w[0].get('checked') == ['Bob'] and w[0].get('shown') == ALL,
      {'hits': [g(O[k], 'hit') for k in ('pc_whole', 'pl_whole', 'pp_whole')], 'states': w})
    s2 = g(pc, 's2') or {}
    A('P-nodbl', s2.get('set') == ['Alice'] and s2.get('ticks') == ['Alice'] and s2.get('open'), pick(s2))
    r = g(O['right'], 's') or {}
    A('P-right', r.get('set') is None and r.get('box') == 'Al' and r.get('open') and r.get('checked') == [], pick(r))
    A('C-css', g(pc, 'pe') == 'none' and str(g(pc, 'hit') or '').startswith('div.sb-ac-item'),
      {'pointerEvents': g(pc, 'pe'), 'hitAtCheckbox': g(pc, 'hit')})
    b = g(pc, 'blur') or {}
    A('B-one', b.get('box') == 'Alice' and b.get('set') is None and not b.get('open') and b.get('ph') == 'Value...'
      and not b.get('rowMulti') and not b.get('boxMulti') and b.get('preview') == 'NAME = Alice', pick(b))
    m = g(pl, 's2') or {}
    A('E-mid', m.get('set') == ['Alice', 'Alan'] and m.get('box') == 'Al' and m.get('open') and m.get('shown') == AL3
      and m.get('ph') == 'Multiple Values Selected (2)', pick(m))
    e = g(pl, 'esc') or {}
    A('E-two', e.get('set') == ['Alice', 'Alan'] and e.get('box') == '' and not e.get('open') and e.get('ph') == 'Multiple Values Selected (2)'
      and e.get('rowMulti') and e.get('preview') == 'NAME = /^(?:Alice|Alan)$/', pick(e))
    u, ue = g(O['untick'], 's') or {}, g(O['untick'], 'esc') or {}
    A('Z-zero', u.get('set') == [] and u.get('box') == 'Al' and u.get('open') and u.get('checked') == []
      and ue.get('box') == 'Al' and ue.get('set') is None and ue.get('ph') == 'Value...' and ue.get('preview') == 'NAME = Al' and not ue.get('rowMulti'),
      {'open': pick(u), 'closed': pick(ue)})
    sy, sa = g(O['search'], 'sync') or {}, g(O['search'], 'after') or {}
    A('S-first', sy.get('open') is False and sy.get('set') is None and sy.get('box') == 'Alice' and sy.get('target') == 'NAME = Alice', sy)
    A('S-search', g(sa, 'targets', 'report') == 'NAME = Alice' and g(sa, 'calls', 'run') == 1 and not sa.get('lb'),
      {'target': g(sa, 'targets', 'report'), 'runs': g(sa, 'calls', 'run'), 'lb': sa.get('lb')})
    og = g(O['opgt'], 's') or {}
    A('O-gt', og.get('op') == 'gt' and og.get('box') == 'Alice' and og.get('set') is None and og.get('preview') == 'NAME > Alice', pick(og))
    es = O['enter_set']
    A('N-extend', g(es, 's0', 'set') == ['Alice', 'Bob'] and g(es, 'open', 'checked') == ['Alice', 'Bob'] and g(es, 'pre', 'active') == ['Albert']
      and g(es, 'after', 'targets', 'report') == 'NAME = /^(?:Alice|Bob|Albert)$/' and g(es, 'after', 'calls', 'run') == 1,
      {'s0': g(es, 's0', 'set'), 'checked': g(es, 'open', 'checked'), 'active': g(es, 'pre', 'active'),
       'target': g(es, 'after', 'targets', 'report'), 'runs': g(es, 'after', 'calls', 'run')})
    ek = O['enter_keep']
    A('N-keep', g(ek, 'pre', 'active') == ['Alice'] and g(ek, 'after', 'targets', 'report') == 'NAME = /^(?:Alice|Bob)$/' and g(ek, 'after', 'calls', 'run') == 1,
      {'active': g(ek, 'pre', 'active'), 'target': g(ek, 'after', 'targets', 'report'), 'runs': g(ek, 'after', 'calls', 'run')})
    en = O['enter_single']
    A('N-single', g(en, 'pre', 'active') == ['Bob'] and g(en, 'after', 'targets', 'report') == 'NAME = Bob' and g(en, 'after', 'calls', 'run') == 1,
      {'active': g(en, 'pre', 'active'), 'target': g(en, 'after', 'targets', 'report'), 'runs': g(en, 'after', 'calls', 'run')})
    sp = O['space']
    A('K-keep', g(sp, 's0', 'open') and g(sp, 's1', 'active') == ['Alan'] and g(sp, 's1', 'set') == ['Alan'] and g(sp, 's2', 'active') == ['Albert']
      and g(sp, 's3', 'active') == ['Albert'] and g(sp, 's3', 'set') == ['Alan', 'Albert'] and g(sp, 's3', 'box') == '',
      {k: {'active': g(sp, k, 'active'), 'set': g(sp, k, 'set'), 'box': g(sp, k, 'box')} for k in ('s0', 's1', 's2', 's3')})
    ts = O['typedset']
    A('T-pre', g(ts, 's0', 'open') and g(ts, 's0', 'checked') == ['Alice', 'Bob'], pick(g(ts, 's0')))
    A('T-ext', g(ts, 's1', 'set') == ['Alice', 'Bob', 'Albert'] and g(ts, 's1', 'ph') == 'Multiple Values Selected (3)'
      and g(ts, 's2', 'preview') == 'NAME = /^(?:Alice|Bob|Albert)$/', {'s1': pick(g(ts, 's1')), 's2': pick(g(ts, 's2'))})
    z = O['zed']
    A('T-drop', g(z, 's0', 'checked') == [] and g(z, 's1', 'set') == ['Bob'] and g(z, 's2', 'box') == 'Bob' and g(z, 's2', 'preview') == 'NAME = Bob',
      {'s0': pick(g(z, 's0')), 's1': pick(g(z, 's1')), 's2': pick(g(z, 's2'))})
    tf = O['typedfull']
    A('T-typed', g(tf, 's0', 'open') and g(tf, 's0', 'checked') == [] and g(tf, 's1', 'set') == ['Alice'] and g(tf, 's1', 'checked') == ['Alice'],
      {'s0': pick(g(tf, 's0')), 's1': pick(g(tf, 's1'))})
    j = O['json']
    A('J-cb', g(j, 's', 'box') == '[1,2]' and g(j, 's', 'preview') == 'NAME = [1,2]', pick(g(j, 's')))
    A('J-nocb', g(j, 'open', 'cbs') == 0 and g(j, 's2', 'box') == '[1,2]' and not g(j, 's2', 'open'),
      {'open': pick(g(j, 'open')), 'cbs': g(j, 'open', 'cbs'), 's2': pick(g(j, 's2'))})
    h = O['header']
    A('H-show', '1 selected' in str(g(h, 's0', 'header')) and g(h, 's1', 'shown') == ['Alice'] and g(h, 's2', 'shown') == AL3,
      {'header': g(h, 's0', 'header'), 'only': g(h, 's1', 'shown'), 'all': g(h, 's2', 'shown')})
    A('H-clear', g(h, 's3', 'open') and g(h, 's3', 'set') == [] and g(h, 's3', 'box') == 'Al' and g(h, 's3', 'checked') == [] and g(h, 's3', 'shown') == AL3,
      pick(g(h, 's3')))
    A('H-after', g(h, 's4', 'box') == 'Al' and g(h, 's4', 'set') is None and g(h, 's4', 'preview') == 'NAME = Al', pick(g(h, 's4')))
    c = O['caret']
    A('M-click', g(c, 's', 'open') and g(c, 's', 'box') == 'Al' and g(c, 's', 'shown') == AL3 and g(c, 's', 'set') == ['Alice'],
      {'s0': pick(g(c, 's0')), 's': pick(g(c, 's'))})
    rh = O['rehost']
    A('Q-rehost', g(rh, 'rows') == 2 and g(rh, 's0', 'set') == ['Alice'] and g(rh, 'r0', 'set') is None and g(rh, 'r0', 'box') == 'Alice'
      and g(rh, 'r1', 'open'), {'s0': pick(g(rh, 's0')), 'r0': pick(g(rh, 'r0')), 'r1open': g(rh, 'r1', 'open')})
    p = O['pipe']
    A('X-pipe', g(p, 'mid', 'set') == ['X|Y'] and g(p, 'mid', 'preview') == g(p, 'after', 'preview') == 'NAME = X|Y' and g(p, 'after', 'box') == 'X\\|Y',
      {'mid': g(p, 'mid', 'preview'), 'after': g(p, 'after', 'preview'), 'box': g(p, 'after', 'box')})
    A('G-state', g(p, 'gs', 'query') == 'NAME = X|Y' and (g(p, 'gs', 'conditions') or [{}])[0].get('value') == 'X\\|Y'
      and 'values' not in (g(p, 'gs', 'conditions') or [{}])[0], g(p, 'gs'))
    sc = O['sched']
    A('R-insert', (g(sc, 's0', 'cbs') or 0) > 0 and g(sc, 'after', 'targets', 'sched') == 'NAME = Alice' and g(sc, 'after', 'calls', 'sched') == ['NAME = Alice']
      and g(sc, 'after', 'submitLabel') == 'Insert',
      {'cbs': g(sc, 's0', 'cbs'), 'target': g(sc, 'after', 'targets', 'sched'), 'cb': g(sc, 'after', 'calls', 'sched'), 'label': g(sc, 'after', 'submitLabel')})
    tk = O['token']
    A('R-token', g(tk, 's0', 'shown') and '{FNAME}' in g(tk, 's0', 'shown') and g(tk, 's0', 'cbs') == 0
      and g(tk, 's1', 'box') == '{FNAME}' and not g(tk, 's1', 'open') and g(tk, 's1', 'set') is None,
      {'s0': pick(g(tk, 's0')), 'cbs': g(tk, 's0', 'cbs'), 's1': pick(g(tk, 's1'))})
    A('R-seed', g(tk, 'whole', 'open') and g(tk, 'whole', 'checked') == [] and g(tk, 's2', 'set') == ['Alice'],
      {'whole': pick(g(tk, 'whole')), 's2': pick(g(tk, 's2'))})
    A('R-replace', g(tk, 's3', 'box') == '{FNAME}' and g(tk, 's3', 'set') is None and not g(tk, 's3', 'open'), pick(g(tk, 's3')))
    d = O['dash']
    A('D-preview', g(d, 's', 'open') and g(d, 's', 'calls', 'lastPreview') == 'NAME = Alice',
      {'lastPreview': g(d, 's', 'calls', 'lastPreview'), 's': pick(g(d, 's'))})
    A('D-apply', g(d, 'after', 'targets', 'dash') == 'NAME = Alice' and g(d, 'after', 'calls', 'submit') == ['NAME = Alice'] and g(d, 'after', 'submitLabel') == 'Apply',
      {'target': g(d, 'after', 'targets', 'dash'), 'submit': g(d, 'after', 'calls', 'submit'), 'label': g(d, 'after', 'submitLabel')})
    cc = g(O['colchange'], 's') or {}
    A('C-col', cc.get('col') == 'CODE' and cc.get('set') is None and cc.get('box') == '', pick(cc))
    f = g(O['free'], 's') or {}
    A('F-free', f.get('box') == 'Zork' and f.get('preview') == 'NAME = Zork' and f.get('set') is None, pick(f))
    rm = O['remove']
    A('W-remove', g(rm, 'rows') == 1 and not g(rm, 's', 'open') and not g(rm, 's', 'errs'), {'rows': g(rm, 'rows'), 's': pick(g(rm, 's'))})
    # --- review round ---
    st = O['still']
    A('P-still', '0 selected' in str(g(st, 's0', 'header')) and bool(g(st, 'tops0')) and g(st, 'tops0') == g(st, 'tops1')
      and g(st, 's1', 'set') == ['Bob'] and g(st, 's1', 'open') and g(st, 's1', 'active') == [],
      {'header0': g(st, 's0', 'header'), 'tops0': g(st, 'tops0'), 'tops1': g(st, 'tops1'), 's1': pick(g(st, 's1')), 'active': g(st, 's1', 'active')})
    er, es, ed, et = O['enter_report'], O['enter_sched'], O['enter_dash'], O['enter_typed']
    A('P-enter', g(er, 's1', 'set') == ['Bob'] and g(er, 's1', 'open') and g(er, 'after', 'targets', 'report') == 'NAME = Bob' and g(er, 'after', 'calls', 'run') == 1
      and g(es, 's1', 'set') == ['Bob'] and g(es, 's1', 'open') and g(es, 'after', 'calls', 'sched') == ['NAME = Bob']
      and g(ed, 's1', 'set') == ['Bob'] and g(ed, 's1', 'open') and g(ed, 'after', 'calls', 'submit') == ['NAME = Bob']
      and g(et, 's1', 'set') == ['Albert'] and g(et, 's1', 'open') and g(et, 'after', 'targets', 'report') == 'NAME = Albert',
      {'report': [g(er, 's1', 'set'), g(er, 's2', 'active'), g(er, 'after', 'targets', 'report'), g(er, 'after', 'calls', 'run')],
       'sched': [g(es, 's1', 'set'), g(es, 's2', 'active'), g(es, 'after', 'calls', 'sched')],
       'dash': [g(ed, 's1', 'set'), g(ed, 's2', 'active'), g(ed, 'after', 'calls', 'submit')],
       'typed': [g(et, 's1', 'set'), g(et, 's2', 'active'), g(et, 'after', 'targets', 'report')]})
    db = O['dbl']
    A('P-dbl', g(db, 's1', 'set') == ['Bob'] and g(db, 's1', 'open') and g(db, 's1', 'checked') == ['Bob']
      and g(db, 'blur', 'box') == 'Bob' and g(db, 'blur', 'set') is None,
      {'s1': pick(g(db, 's1')), 'blur': pick(g(db, 'blur'))})
    ue, uq, us, ul = O['unenter'], O['unenter_still'], O['unenter_set'], O['unenter_last']
    # round 3 adds 'last': the ONLY tick unticked by click, the hand on it, Enter. With
    # nothing ticked Enter now picks a mouse-highlighted row, but never the row just clicked.
    A('P-unenter', g(ue, 's1', 'set') == ['Alice'] and g(ue, 's1', 'open') and g(ue, 'after', 'targets', 'report') == 'NAME = Alice' and g(ue, 'after', 'calls', 'run') == 1
      and g(uq, 's1', 'set') == ['Alice'] and g(uq, 's1', 'open') and g(uq, 'after', 'targets', 'report') == 'NAME = Alice'
      and g(us, 'open', 'checked') == ['Alice', 'Alan', 'Bob'] and g(us, 's1', 'set') == ['Alice', 'Bob']
      and g(us, 'after', 'targets', 'report') == 'NAME = /^(?:Alice|Bob)$/'
      and g(ul, 's1', 'set') == [] and g(ul, 's1', 'open') and g(ul, 's2', 'active') == ['Alice']
      and g(ul, 'after', 'targets', 'report') == 'NAME = Al' and g(ul, 'after', 'calls', 'run') == 1,
      {'fresh': [g(ue, 's1', 'set'), g(ue, 's2', 'active'), g(ue, 'after', 'targets', 'report')],
       'still': [g(uq, 's1', 'set'), g(uq, 's1', 'active'), g(uq, 'after', 'targets', 'report')],
       'set': [g(us, 'open', 'checked'), g(us, 's1', 'set'), g(us, 's2', 'active'), g(us, 'after', 'targets', 'report')],
       'last': [g(ul, 's1', 'set'), g(ul, 's2', 'active'), g(ul, 'after', 'targets', 'report')]})
    sp2 = O['spacetype']
    A('P-space', g(sp2, 's1', 'set') == ['New Haven'] and g(sp2, 's1', 'open') and g(sp2, 's3', 'box') == 'New York'
      and g(sp2, 's3', 'set') == ['New Haven'] and g(sp2, 's3', 'open') and g(sp2, 's3', 'shown') == ['New York'],
      {'s1': pick(g(sp2, 's1')), 's2active': g(sp2, 's2', 'active'), 's3': pick(g(sp2, 's3'))})
    rs = O['rest']
    A('K-rest', g(rs, 'hover', 'active') == ['Bob'] and g(rs, 's0', 'active') == ['[1,2]'] and g(rs, 's1', 'set') == ['[1,2]']
      and g(rs, 's1', 'active') == ['[1,2]'] and g(rs, 's2', 'set') == [] and g(rs, 's2', 'active') == ['[1,2]'],
      {k: {'active': g(rs, k, 'active'), 'set': g(rs, k, 'set')} for k in ('hover', 's0', 's1', 's2')})
    sd = O['strand']
    A('H-strand', g(sd, 'only', 'shown') == ['Alice', 'Bob'] and g(sd, 'u2', 'set') == [] and g(sd, 'u2', 'shown') == ALL
      and g(sd, 'typed', 'shown') == AL3,
      {k: {'shown': g(sd, k, 'shown'), 'set': g(sd, k, 'set'), 'header': g(sd, k, 'header')} for k in ('only', 'u1', 'u2', 'typed')})
    so = O['showone']
    A('H-showone', g(so, 's0', 'checked') == ['Bob'] and g(so, 's1', 'shown') == ['Bob'] and g(so, 's1', 'checked') == ['Bob']
      and 'Show all values' in str(g(so, 's1', 'header')),
      {'s0': pick(g(so, 's0')), 's1': pick(g(so, 's1'))})
    rl = O['rowlink']
    # round 3: the row's own link no longer appears while the list is open (it moved
    # the box in a narrow builder); closing the list on a set of 2 shows it
    A('H-rowlink', g(rl, 's1', 'set') == ['Alice'] and g(rl, 's1', 'open') and g(rl, 's1', 'rowLink') is False
      and g(rl, 's2', 'set') == ['Alice', 'Alan'] and g(rl, 's2', 'open') and g(rl, 's2', 'rowLink') is False
      and not g(rl, 's3', 'open') and g(rl, 's3', 'set') == ['Alice', 'Alan'] and g(rl, 's3', 'rowLink') is True,
      {k: [g(rl, k, 'set'), g(rl, k, 'open'), g(rl, k, 'rowLink')] for k in ('s1', 's2', 's3')})
    tg = O['toggle']
    TOGS = [u'☐', u'☑']
    A('T-toggle', g(tg, 'open', 'open') and g(tg, 'open', 'cbs') == 0 and g(tg, 'open', 'shown') == TOGS and not g(tg, 'open', 'header')
      and g(tg, 's1', 'box') == TOGS[1] and not g(tg, 's1', 'open') and g(tg, 's1', 'set') is None and g(tg, 's1', 'preview') == u'TOG = ☑',
      {'s0': pick(g(tg, 's0')), 'open': pick(g(tg, 'open')), 'cbs': g(tg, 'open', 'cbs'), 's1': pick(g(tg, 's1'))})
    def esc_ok(e):
        return (g(e, 's0', 'set') == ['Alice', 'Alan'] and bool(g(e, 's0', 'open')) and g(e, 's1', 'lb') is True and not g(e, 's1', 'open')
                and g(e, 's1', 'set') == ['Alice', 'Alan'] and g(e, 's1', 'ph') == 'Multiple Values Selected (2)' and g(e, 's2', 'lb') is False)
    eh = dict((h, O['esc_' + h]) for h in ('report', 'sched', 'dash'))
    A('E-host', all(esc_ok(e) for e in eh.values()),
      dict((h, {'ok': esc_ok(e), 's1': pick(g(e, 's1')), 'lb1': g(e, 's1', 'lb'), 'lb2': g(e, 's2', 'lb')}) for h, e in eh.items()))
    # --- round 3 ---
    def still_ok(st, fa, vals):
        gs = [g(st, k) for k in ('g0', 'g1', 'g2', 'g1b', 'g0b')]
        same = bool(gs[0]) and bool(gs[0].get('tops')) and gs[0].get('header') and all(x == gs[0] for x in gs)
        sets = [g(st, k, 'set') for k in ('s1', 's2', 's1b', 's0b')]
        opened = all(g(st, k, 'open') for k in ('s0', 's1', 's2', 's1b', 's0b'))
        hf = g(st, 'hintfit')
        fits = isinstance(hf, list) and len(hf) == 2 and 0 < hf[0] <= hf[1]
        return (same and opened and fits and sets == [[vals[0]], vals[:2], [vals[0]], []] and g(fa, 's', 'set') == vals and bool(g(fa, 's', 'open')))
    def still_det(st, fa):
        return {'hintfit': g(st, 'hintfit'), 'geo': {k: g(st, k) for k in ('g0', 'g1', 'g2', 'g1b', 'g0b')},
                'sets': [g(st, k, 'set') for k in ('s1', 's2', 's1b', 's0b')], 'open': [g(st, k, 'open') for k in ('s0', 's1', 's2', 's1b', 's0b')],
                'fast': {'aim': g(fa, 'aim'), 'set': g(fa, 's', 'set'), 'open': g(fa, 's', 'open')}}
    for aid, sk, fk, vals in (('P-still1024', 'still_1024', 'fast_1024', AL3), ('P-still800', 'still_800', 'fast_800', AL3),
                              ('P-stillsched', 'still_sched', 'fast_sched', ['Apple', 'Apricot', 'Avocado'])):
        A(aid, still_ok(O[sk], O[fk], vals), still_det(O[sk], O[fk]))
    dn, dt = O['dblnext'], O['dbltap']
    A('P-dblnext', g(dn, 's1', 'set') == ['Alan', 'Albert'] and g(dn, 's1', 'open') and (g(dn, 's1', 'md') or [])[-2:] == [1, 2]
      and g(dt, 's1', 'set') == ['Alan', 'Albert'] and g(dt, 's1', 'open'),
      {'mouse': [g(dn, 's1', 'set'), g(dn, 's1', 'md')], 'touch': [g(dt, 's1', 'set'), g(dt, 's1', 'md')]})
    hp = O['hdrpress']
    A('H-press', g(hp, 'hint') is not None and g(hp, 's0', 'hint') == 'Tick one or more values' and g(hp, 's0', 'open') and not g(hp, 's0', 'set')
      and g(hp, 'counts') is not None and g(hp, 's1', 'open') and g(hp, 's1', 'set') == ['Alice', 'Alan'] and g(hp, 's1', 'box') == ''
      and g(hp, 's2', 'shown') == ['Alice', 'Alan'],
      {'hintHit': g(hp, 'hint'), 's0': [g(hp, 's0', 'hint'), g(hp, 's0', 'open'), g(hp, 's0', 'set')],
       'countsHit': g(hp, 'counts'), 's1': pick(g(hp, 's1')), 's2shown': g(hp, 's2', 'shown')})
    se, sa, s2k, de = O['spaceenter'], O['spacearrow'], O['spacetwo'], O['downenter']
    A('K-spaceenter', g(se, 's1', 'set') == ['Alice'] and g(se, 's1', 'open') and g(se, 's1', 'box') == 'Al'
      and g(se, 's2', 'set') == [] and g(se, 's2', 'open') and g(se, 's2', 'active') == ['Alice']
      and g(se, 'after', 'targets', 'report') == 'NAME = Al' and g(se, 'after', 'calls', 'run') == 1 and g(se, 'after', 'set') is None
      and g(sa, 'after', 'targets', 'report') == 'NAME = /^(?:Alice|Alan)$/'
      and g(s2k, 'after', 'targets', 'report') == 'NAME = /^(?:Alice|Alan)$/' and g(s2k, 'after', 'calls', 'run') == 1
      and g(de, 'after', 'targets', 'report') == 'NAME = Alice' and g(de, 'after', 'calls', 'run') == 1,
      {'s1': pick(g(se, 's1')), 's2': [g(se, 's2', 'set'), g(se, 's2', 'active')], 'after': [g(se, 'after', 'targets', 'report'), g(se, 'after', 'set')],
       'arrow': g(sa, 'after', 'targets', 'report'), 'downSpaceDownSpace': g(s2k, 'after', 'targets', 'report'),
       'downEnter': g(de, 'after', 'targets', 'report')})
    hr, hs, hd, ht = O['hover_report'], O['hover_sched'], O['hover_dash'], O['hover_ticked']
    A('P-hover', all(g(x, 'hov', 'active') == ['Albert'] and g(x, 'hov', 'open') for x in (hr, hs, hd))
      and g(hr, 'after', 'targets', 'report') == 'NAME = Albert' and g(hr, 'after', 'calls', 'run') == 1
      and g(hs, 'after', 'calls', 'sched') == ['NAME = Albert'] and g(hd, 'after', 'calls', 'submit') == ['NAME = Albert']
      and g(ht, 's1', 'set') == ['Alice'] and g(ht, 's1', 'open') and g(ht, 'hov', 'active') == ['Albert']
      and g(ht, 'after', 'targets', 'report') == 'NAME = Alice',
      {'report': [g(hr, 'hov', 'active'), g(hr, 'after', 'targets', 'report')], 'sched': g(hs, 'after', 'calls', 'sched'),
       'dash': g(hd, 'after', 'calls', 'submit'), 'ticked': [g(ht, 's1', 'set'), g(ht, 's1', 'open'), g(ht, 'hov', 'active'), g(ht, 'after', 'targets', 'report')]})
    cs = O['count_sched']
    A('H-count', '{FNAME}' in (g(cs, 'whole', 'shown') or []) and str(g(cs, 'whole', 'counts')).startswith('6 values')
      and str(g(cs, 'typed', 'counts')).startswith('3 of 6'),
      {'whole': g(cs, 'whole', 'counts'), 'typed': g(cs, 'typed', 'counts'), 'tokensListed': '{FNAME}' in (g(cs, 'whole', 'shown') or [])})
    # --- round 4 ---
    def below_ok(st, vals, grew):
        labs = g(st, 'labs') or []
        gs = [g(st, 'g' + k) for k in labs]
        ps = [g(st, 'p' + k) for k in labs[1:]]   # read inside the press, before the count refill
        same = (len(gs) == 2 * len(vals) + 1 and bool(gs[0]) and bool(gs[0].get('tops')) and all(x == gs[0] for x in gs)
                and all(x == gs[0] for x in ps))
        opened = bool(labs) and all(g(st, 's' + k, 'open') for k in labs)
        want = [vals[:i + 1] for i in range(len(vals))] + [vals[:i] for i in range(len(vals) - 1, -1, -1)]
        sets = [g(st, 's' + k, 'set') for k in labs[1:]]
        return same and opened and sets == want and grew(st, labs)
    def below_det(st):
        labs = g(st, 'labs') or []
        return {'geo': {k: g(st, 'g' + k) for k in labs}, 'atPress': {k: g(st, 'p' + k) for k in labs[1:]},
                'below': {k: g(st, 'b' + k) for k in ['plain'] + labs},
                'sets': [g(st, 's' + k, 'set') for k in labs[1:]], 'open': [g(st, 's' + k, 'open') for k in labs]}
    # evidence the trigger fired: the pivot count line is taller than the plain one; the
    # long values' preview wrapped at some tick
    pivot_grew = lambda st, labs: (g(st, 'b0', 'count') or 0) > (g(st, 'bplain', 'count') or 0) > 0
    long_grew = lambda st, labs: max([g(st, 'b' + k, 'preview') or 0 for k in labs] or [0]) > (g(st, 'b0', 'preview') or 0) > 0
    sp, f1, f3 = O['still_pivot'], O['fast_pivot_1024'], O['fast_pivot_1366']
    A('P-stillpivot', below_ok(sp, ['Alice', 'Alan'], pivot_grew)
      and g(f1, 's', 'set') == AL3 and g(f1, 's', 'open') and g(f3, 's', 'set') == AL3 and g(f3, 's', 'open'),
      {'still': below_det(sp), 'fast1024': [g(f1, 'landed'), g(f1, 's', 'set')], 'fast1366': [g(f3, 'landed'), g(f3, 's', 'set')]})
    ls = dict((h, O['still_long_' + h]) for h in ('report', 'sched', 'dash'))
    A('P-stilllong', all(below_ok(x, LONG4, long_grew) for x in ls.values()),
      dict((h, {'ok': below_ok(x, LONG4, long_grew), 'det': below_det(x)}) for h, x in ls.items()))
    wh, wk = O['wheel'], O['wheel_key']
    un = g(wh, 'under')
    A('P-wheel', g(wh, 'hov', 'active') == ['Avocado'] and un not in (None, 'Avocado') and g(wh, 's1', 'active') == [un]
      and g(wh, 'lit') == [un] and g(wh, 'after', 'targets', 'report') == 'FRUIT = %s' % un
      and g(wk, 's0', 'active') == ['Banana'] and g(wk, 's1', 'active') == ['Banana'] and g(wk, 'after', 'targets', 'report') == 'FRUIT = Banana',
      {'mouse': {'hov': g(wh, 'hov', 'active'), 'under': un, 'active': g(wh, 's1', 'active'), 'lit': g(wh, 'lit'), 'enter': g(wh, 'after', 'targets', 'report')},
       'keys': {'s0': g(wk, 's0', 'active'), 's1': g(wk, 's1', 'active'), 'enter': g(wk, 'after', 'targets', 'report')}})
    sd1, sd2 = O['showdbl'], O['showdbl_last']
    A('P-dblshow', g(sd1, 'only', 'shown') == AL3 and g(sd1, 's1', 'set') == ['Alan', 'Albert'] and g(sd1, 's1', 'open')
      and g(sd2, 'only', 'shown') == ['Albert'] and g(sd2, 's1', 'set') == [] and g(sd2, 's1', 'open')
      and g(sd2, 'closed', 'box') == 'Al' and g(sd2, 'closed', 'preview') == 'NAME = Al',
      {'three': [g(sd1, 'only', 'shown'), g(sd1, 's1', 'set'), g(sd1, 's1', 'md')],
       'last': [g(sd2, 'only', 'shown'), g(sd2, 's1', 'set'), g(sd2, 'closed', 'box'), g(sd2, 'closed', 'preview')]})
    te, tk2 = O['tokenenter'], O['tokenkey']
    tok = (g(tk2, 'pre', 'active') or [''])[0] if g(tk2, 'pre', 'active') else ''
    A('R-tokenenter', g(te, 'two', 'set') == ['Alice', 'Alan'] and g(te, 'hov', 'active') == ['{FNAME}']
      and g(te, 'after', 'calls', 'sched') == ['NAME = /^(?:Alice|Alan)$/'] and not g(te, 'after', 'open')
      and str(tok).startswith('{') and g(tk2, 'after', 'calls', 'sched') == ['NAME = %s' % tok],
      {'hover': [g(te, 'two', 'set'), g(te, 'hov', 'active'), g(te, 'after', 'calls', 'sched')],
       'keys': [g(tk2, 'pre', 'active'), g(tk2, 'after', 'calls', 'sched')]})
    sn, ch = O['spacenudge'], O['clearhover']
    A('P-decided', g(sn, 's1', 'set') == [] and g(sn, 's1', 'open') and g(sn, 's2', 'active') == ['Alice']
      and g(sn, 'after', 'targets', 'report') == 'NAME = Al' and g(sn, 'after', 'calls', 'run') == 1
      and g(ch, 's1', 'set') == [] and g(ch, 's1', 'open') and g(ch, 's2', 'active') == ['Alice']
      and g(ch, 'after', 'targets', 'report') == 'NAME = Alice' and g(ch, 'after', 'calls', 'run') == 1,
      {'spaceNudge': [g(sn, 's1', 'set'), g(sn, 's2', 'active'), g(sn, 'after', 'targets', 'report')],
       'clearHover': [g(ch, 's1', 'set'), g(ch, 's2', 'active'), g(ch, 'after', 'targets', 'report')]})
    # --- round 5 ---
    ro, rs = O['repick_one'], O['repick_set']
    A('A-repick1', g(ro, 'closed', 'box') == 'Alice' and g(ro, 'closed', 'open') is False and g(ro, 'closed', 'set') is None
      and g(ro, 'pick', 'popup', 'open') is False and g(ro, 'pick', 'popupRenders') == 0
      and g(ro, 's', 'open') and g(ro, 's', 'box') == 'Alice' and g(ro, 's', 'checked') == ['Alice'] and g(ro, 's', 'shown') == ALL
      and g(ro, 's', 'set') is None and g(ro, 's', 'col') == 'NAME' and g(ro, 's', 'lb') is True
      and g(ro, 'w', 'focusBox') is True and g(ro, 'w', 'host') == 'from'
      and g(ro, 's2', 'set') == ['Alice', 'Bob'] and g(ro, 'esc', 'preview') == 'NAME = /^(?:Alice|Bob)$/',
      {'closed': pick(g(ro, 'closed')), 'pick': g(ro, 'pick'), 's': pick(g(ro, 's')), 'where': g(ro, 'w'),
       's2set': g(ro, 's2', 'set'), 'escPreview': g(ro, 'esc', 'preview')})
    A('A-repickset', g(rs, 'closed', 'set') == ['Alice', 'Alan'] and g(rs, 'closed', 'open') is False and g(rs, 'closed', 'rowMulti')
      and g(rs, 'pick', 'popup', 'open') is False
      and g(rs, 's', 'open') and g(rs, 's', 'checked') == ['Alice', 'Alan'] and g(rs, 's', 'set') == ['Alice', 'Alan'] and g(rs, 's', 'shown') == ALL
      and g(rs, 'w', 'focusBox') is True
      and g(rs, 'esc', 'set') == ['Alice', 'Alan'] and g(rs, 'esc', 'ph') == 'Multiple Values Selected (2)'
      and g(rs, 'esc', 'preview') == 'NAME = /^(?:Alice|Alan)$/',
      {'closed': pick(g(rs, 'closed')), 'pick': g(rs, 'pick'), 's': pick(g(rs, 's')), 'where': g(rs, 'w'), 'esc': pick(g(rs, 'esc'))})
    rk = O['repick_keys']
    A('A-keys', g(rk, 'onsel', 'open') is False and g(rk, 'onsel', 'box') == 'Alice' and g(rk, 'w0', 'focusSel') is True
      and g(rk, 'popup', 'open') is False
      and g(rk, 's', 'open') and g(rk, 's', 'box') == 'Alice' and g(rk, 's', 'checked') == ['Alice'] and g(rk, 's', 'shown') == ALL
      and g(rk, 's', 'lb') is True and g(rk, 'w', 'focusBox') is True and g(rk, 'r') == 1,
      {'onsel': [pick(g(rk, 'onsel')), g(rk, 'w0')], 'popup': pick(g(rk, 'popup')), 's': pick(g(rk, 's')), 'where': g(rk, 'w'), 'renders': g(rk, 'r')})
    sy = O['repick_syn']
    def reopened(k, box, checked):
        return (g(sy, k + '_s', 'open') and g(sy, k + '_s', 'box') == box and g(sy, k + '_s', 'checked') == checked
                and g(sy, k + '_s', 'shown') == ALL and g(sy, k + '_w', 'focusBox') is True and g(sy, k + '_w', 'host') == 'from'
                and g(sy, k + '_s', 'col') == 'NAME')
    A('A-syn', reopened('one', 'Alice', ['Alice']) and g(sy, 'one', 'open') is True and g(sy, 'one_s', 'set') is None
      and reopened('set', '', ['Alice', 'Bob']) and g(sy, 'set_s', 'set') == ['Alice', 'Bob']
      and g(sy, 'btw_s', 'open') and g(sy, 'btw_w', 'host') == 'from' and g(sy, 'btw_w', 'focusBox') is True
      and g(sy, 'btw_s', 'box') == 'Alan' and g(sy, 'btw_w', 'to') == 'Bob' and g(sy, 'btw_s', 'op') == 'between',
      {'one': [g(sy, 'one'), pick(g(sy, 'one_s')), g(sy, 'one_w')], 'set': [pick(g(sy, 'set_s')), g(sy, 'set_w')],
       'between': [g(sy, 'btw'), pick(g(sy, 'btw_s')), g(sy, 'btw_w')]})
    A('A-firefox', reopened('ff', 'Alice', ['Alice']), {'ff': [g(sy, 'ff'), pick(g(sy, 'ff_s')), g(sy, 'ff_w')]})
    ao = O['repick_open']
    A('A-open', g(ao, 's0', 'open') and g(ao, 's0', 'set') == ['Alice', 'Alan'] and g(ao, 's0', 'box') == 'Al'
      and g(ao, 's', 'open') and g(ao, 's', 'set') == ['Alice', 'Alan'] and g(ao, 's', 'checked') == ['Alice', 'Alan']
      and g(ao, 's', 'shown') == ALL and g(ao, 'w', 'focusBox') is True
      and g(ao, 'esc', 'set') == ['Alice', 'Alan'] and g(ao, 'esc', 'ph') == 'Multiple Values Selected (2)' and not g(ao, 'esc', 'open'),
      {'s0': pick(g(ao, 's0')), 'pick': g(ao, 'pick'), 's': pick(g(ao, 's')), 'where': g(ao, 'w'), 'esc': pick(g(ao, 'esc'))})
    rd = O['repick_diff']
    A('A-diff', g(rd, 's', 'col') == 'CODE' and g(rd, 's', 'box') == '' and g(rd, 's', 'open') and g(rd, 's', 'shown') == ['C1', 'C2']
      and g(rd, 'pick', 'renders') == 1
      and g(sy, 'diff', 'open') is False and g(sy, 'diff', 'focusSel') is True and g(sy, 'diff', 'renders') == 0
      and g(sy, 'diff_s', 'open') and g(sy, 'diff_s', 'col') == 'CODE' and g(sy, 'diff_s', 'box') == '' and g(sy, 'diff_r') == 1,
      {'popup': [g(rd, 'pick'), pick(g(rd, 's')), g(rd, 's', 'col')],
       'synthetic': [g(sy, 'diff'), pick(g(sy, 'diff_s')), g(sy, 'diff_s', 'col'), g(sy, 'diff_r')]})
    rx = O['repick_esc']
    def untouched(k):
        return (g(sy, k, 'open') is False and g(sy, k, 'renders') == 0 and g(sy, k + '_s', 'open') is False
                and g(sy, k + '_s', 'box') == 'Alice' and g(sy, k + '_r') == 0)
    A('A-none', g(rx, 'pick', 'popup', 'open') is False and g(rx, 'pick', 'popupRenders') == 0 and g(rx, 'pick', 'renders') == 0
      and g(rx, 's', 'open') is False and g(rx, 's', 'box') == 'Alice' and g(rx, 's', 'col') == 'NAME' and g(rx, 's', 'lb') is True
      and untouched('user') and untouched('jq') and untouched('dis')
      and g(sy, 'ref_s', 'open') is False and g(sy, 'ref_r') == 0 and not g(sy, 'ref_s', 'errs'),
      {'popupEsc': [g(rx, 'pick'), pick(g(rx, 's'))], 'user': [g(sy, 'user'), g(sy, 'user_s', 'box'), g(sy, 'user_r')],
       'jq': [g(sy, 'jq'), g(sy, 'jq_s', 'box'), g(sy, 'jq_r')], 'dismiss': [g(sy, 'dis'), g(sy, 'dis_s', 'box'), g(sy, 'dis_r')],
       'colref': [g(sy, 'ref'), g(sy, 'ref_s', 'open'), g(sy, 'ref_r')]})
    # The layout. FLOOR5 = the operator select / each between box width the build before
    # round 5 gave at these window widths (Edge 154: 149.3/112.2, 162.2/120.8, 173.3/128.2,
    # 189.1/138.7), less 2px: the wider column cell must not have squeezed them.
    FLOOR5 = {1024: (100, 80), 1280: (147, 110), 1366: (160, 118), 1440: (171, 126), 1920: (187, 136)}
    def tips(lay):
        return [r for r in ((lay or {}).get('rows') or []) if r.get('tip')]
    def tip_ok(lay):
        ts = tips(lay)
        return (len(ts) == 2 and set(r['tip']['cls'] for r in ts) == {'sb-date-tip', 'sb-nested-tip'}
                and all(r['tip']['lines'] == 1 and r['tip']['right'] <= r['wrapper']['r'] + 0.5 for r in ts))
    def row_ok(lay, w):
        rows = (lay or {}).get('rows') or []
        if len(rows) != 4: return False
        dlg, vw = lay.get('dlg') or {}, lay.get('vw') or 0
        fo, fb = FLOOR5[w]
        btw = [r for r in rows if r.get('op') == 'between']
        return (all(r['scroll'][0] <= r['scroll'][1] and r['actsLines'] <= 1 and r['remove']['r'] <= r['row']['r']
                    and r['opSel']['w'] >= fo for r in rows)
                and len(btw) == 1 and btw[0]['v1']['w'] >= fb and (btw[0]['v2'] or {}).get('w', 0) >= fb
                and dlg.get('l', 0) >= 24 and dlg.get('r', 1e9) <= vw - 24 and lay['dlgScroll'][0] <= lay['dlgScroll'][1]
                and lay['close']['l'] >= dlg['l'] and lay['close']['r'] <= dlg['r'] and lay['title']['h'] < 30)
    def list_ok(o):
        f, gs = g(o, 'fit') or {}, [g(o, k) for k in ('g1', 'g0', 'g1b')]
        # the list's width is its box's (200px at least) plus its 1px side borders
        return (bool(f) and 0 <= f['w'] - max(f['boxW'], 200) <= 3 and abs(f['l'] - f['boxL']) <= 1 and abs(f['top'] - f['boxB']) <= 1
                and bool(gs[0]) and bool(gs[0].get('tops')) and gs[0].get('header') and all(x == gs[0] for x in gs)
                and [g(o, k, 'set') for k in ('s0', 's1b')] == [[], ['Bob']] and g(o, 's1', 'checked') == ['Alice'])
    LW = (1024, 1280, 1366, 1440, 1920)
    lays = dict((w, O['layout_%d' % w]) for w in LW)
    A('L-tip', all(tip_ok(g(lays[w], 'lay')) for w in LW),
      dict((w, [[r['tip'], r['wrapper']['r']] for r in tips(g(lays[w], 'lay'))]) for w in LW))
    A('L-row', all(row_ok(g(lays[w], 'lay'), w) and list_ok(lays[w]) for w in LW),
      dict((w, {'row': row_ok(g(lays[w], 'lay'), w), 'list': list_ok(lays[w]),
                'dlg': g(lays[w], 'lay', 'dlg'), 'dlgScroll': g(lays[w], 'lay', 'dlgScroll'),
                'rows': [[r['op'], r['scroll'], r['actsLines'], r['opSel']['w'], r['v1'] and r['v1']['w'], r['v2'] and r['v2']['w']]
                         for r in (g(lays[w], 'lay', 'rows') or [])],
                'fit': g(lays[w], 'fit'), 'geo': [g(lays[w], k) for k in ('g1', 'g0', 'g1b')]}) for w in LW))
    lw = g(O['layout_wide'], 'lay')
    A('L-wide', len(tips(lw)) == 2 and all(r['tip']['lines'] == 1 for r in tips(lw))
      and all(r['scroll'][0] <= r['scroll'][1] for r in (lw or {}).get('rows') or []),
      [[r['tip'], r['wrapper']['r'], r['scroll']] for r in tips(lw)])
    ln = g(O['layout_700'], 'lay')
    A('L-narrow', len(tips(ln)) == 2 and all(r['tip']['ws'] == 'normal' and r['wrapperMin'] == '0px' for r in tips(ln))
      and all(r['scroll'][0] <= r['scroll'][1] for r in (ln or {}).get('rows') or [])
      and (ln or {}).get('dlg', {}).get('l', -1) >= 0 and (ln or {}).get('dlg', {}).get('r', 1e9) <= (ln or {}).get('vw', 0),
      {'tips': [[r['tip'], r['wrapperMin']] for r in tips(ln)], 'scroll': [r['scroll'] for r in (ln or {}).get('rows') or []],
       'dlg': (ln or {}).get('dlg')})
    # Round-5 fix: the To box's list ends inside the window (4px to spare), right under the
    # box and across its width, as wide as its box (200px at least) plus its borders.
    def tolist_ok(o):
        f = g(o, 'fit') or {}
        return (f.get('l') is not None and abs(f['top'] - f['boxB']) <= 1 and f['l'] >= 0
                and f['r'] <= min(f['vw'], f['cw']) and f['l'] <= f['boxL'] + 1 and f['r'] >= f['boxR'] - 1
                and 0 <= f['w'] - max(f['boxW'], 200) <= 3 and f['page'][0] <= f['page'][1])
    TL = ('tolist_769', 'tolist_800', 'tolist_dash')
    A('L-tolist', all(tolist_ok(O[k]) for k in TL), dict((k, g(O[k], 'fit')) for k in TL))
    bd = O['btwdiff']
    A('A-btwdiff', g(bd, 's', 'col') == 'CODE' and g(bd, 's', 'op') == 'between' and g(bd, 's', 'box') == ''
      and g(bd, 'w', 'to') == '' and bool(g(bd, 's', 'open')) and g(bd, 'w', 'host') == 'from' and g(bd, 'w', 'focusBox') is True,
      {'s0': pick(g(bd, 's0')), 'w0': g(bd, 'w0'), 's': pick(g(bd, 's')), 'col': g(bd, 's', 'col'), 'op': g(bd, 's', 'op'), 'where': g(bd, 'w')})
    allerr = {k: (v.get('errs') or []) + ([v['exc']] if v.get('exc') else []) for k, v in O.items() if (v.get('errs') or v.get('exc'))}
    A('E-err', not allerr, allerr)
    return R

# The Search help's 'Multi-value selection (checkboxes)' list says what the list does now.
def help_doc(help_text):
    # (2026-10-19) the v1 help is gone: the Search topic's "Picking several values (checkboxes)" table says it
    a = help_text.find('<strong>Picking several values (checkboxes)</strong>')
    b = help_text.find('</table>', a) if a >= 0 else -1
    sec = help_text[a:b] if a >= 0 and b > a else ''
    need = ["Click a value's row, checkbox or text", 'Ticks or unticks it; the list stays open', 'press <kbd>Tab</kbd> or <kbd>Esc</kbd>, to close it', 'Arrow keys, then <kbd>Space</kbd>', 'Ticks or unticks the highlighted value', 'Ticks the highlighted value, closes the list and runs the ', 'Right after <kbd>Space</kbd>, or with no arrow-key highlight, it closes the list and runs with what is ticked', 'it picks the value under the mouse instead, unless you have just unticked it', 'states of a journal toggle column', 'One ticked value shows as a normal entry', 'The typed text is never added to the set', 'Once a value is ticked it offers', '<strong>Clear selection</strong> (unticks everything and keeps the list open)']
    # ("...runs the " + search, or filter since penumbra_tests\filterword 2026-10-19, which pins that word)
    gone = ['read-only chip', 'legacy behavior', chr(0x2014), '&mdash;']   # no em-dash (user copy rule)
    missing = [n for n in need if n not in sec]
    left = [x for x in gone if x in sec]
    return (bool(sec) and not missing and not left), {'missing': missing, 'still there': left, 'section': len(sec)}

# Round 5: ...and one bullet of it says the column picked again reopens the list.
def help_doc5(help_text):
    a = help_text.find('<strong>Picking several values (checkboxes)</strong>')
    b = help_text.find('</table>', a) if a >= 0 else -1
    sec = help_text[a:b] if a >= 0 and b > a else ''
    li = [x for x in sec.split('<tr>') if HELP5_TEXT in x]
    bad = [x for x in (chr(0x2014), '&mdash;') if li and x in li[0]]
    return (len(li) == 1 and not bad), {'bullets': len(li), 'emdash': bad, 'text': li[0][:300] if li else None}

def run_build(js, css, label, help_text=None, names=None):
    write_build(js, css)
    O = {}
    for sc in SCENARIOS:
        name, host, fn = sc[:3]
        if names is not None and name not in names: continue
        O[name] = with_tab(host, fn, sc[3] if len(sc) > 3 else None, sc[4] if len(sc) > 4 else None)
    if names is not None: return O, {}
    R = evaluate(O)
    ht = HELP0 if help_text is None else help_text
    R['H-doc'] = help_doc(ht)
    R['H-repick'] = help_doc5(ht)
    return O, R

def report(R, out):
    for aid in R:
        ok, det = R[aid]
        out.append(('PASS ' if ok else 'FAIL ') + aid + ('' if ok else '   ' + json.dumps(det)[:900]))

lines = []
ok_all = False
out_name = 'summary_control.txt' if control else ('summary_mutants.txt' if (mutants or one_mutant) else 'summary.txt')
try:
    if only:
        names = [x.strip() for x in only.split(',') if x.strip()]
        unknown = [x for x in names if x not in [sc[0] for sc in SCENARIOS]]
        if unknown: raise SystemExit('--only: unknown scenarios %s' % ', '.join(unknown))
        O, _ = run_build(JS0, CSS0, 'only', None, names)
        lines.append('candidate: %s + %s (only %s)' % (js_path, css_path, ', '.join(names)))
        lines.append(json.dumps(O, indent=1)[:120000])
        ok_all = True
        out_name = 'summary_only.txt'
    elif mutants or one_mutant:
        names = [one_mutant] if one_mutant else list(MUTANTS.keys())
        lines.append('candidate: %s + %s' % (js_path, css_path))
        ok_all = True
        for nm in names:   # every anchor first: a stale one fails before any browser time is spent
            if nm not in MUTANTS: raise SystemExit('unknown mutant %s (known: %s)' % (nm, ', '.join(MUTANTS)))
            mutate(JS0, CSS0, HELP0, nm)
        for nm in names:
            mj, mc, mh = mutate(JS0, CSS0, HELP0, nm)
            if all(w == 'help' for w, _, _ in MUTANTS[nm][0]):
                O, R = {}, {'H-doc': help_doc(mh), 'H-repick': help_doc5(mh)}   # a help-only mutant needs no browser
            else:
                O, R = run_build(mj, mc, nm, mh)
            red = sorted(a for a in R if not R[a][0])
            want = MUTANTS[nm][1]
            missed = [a for a in want if R.get(a, (True,))[0]]
            bites = not missed
            ok_all = ok_all and bites
            lines.append('%-15s %s  red=%s%s' % (nm, 'BITES ' if bites else 'MISSED', ','.join(red) or '-', ('  (expected red still green: %s)' % ','.join(missed)) if missed else ''))
            if explore: lines.append(json.dumps(O)[:20000])
        out_name = 'summary_mutant_%s.txt' % one_mutant if one_mutant else 'summary_mutants.txt'
    else:
        O, R = run_build(JS0, CSS0, 'control' if control else 'candidate')
        lines.append(('CONTROL (the build before the change): ' if control else
                      'CONTROL5 (the build before round 5): ' if control5 else 'candidate: ') + js_path + ' + ' + css_path + ' + ' + help_path)
        report(R, lines)
        red = sorted(a for a in R if not R[a][0])
        if control:
            want = sorted(a for a in R if a not in GUARDS)
            ok_all = red == want
            lines.append('control red: %d of %d (expected %d: every assert but the guards %s)' % (len(red), len(R), len(want), ','.join(GUARDS)))
            if red != want:
                lines.append('  unexpected green: %s' % ','.join(a for a in want if a not in red))
                lines.append('  unexpected red:   %s' % ','.join(a for a in red if a not in want))
        elif control5:
            want = sorted(a for a in ROUND5 if a not in GUARDS5)
            ok_all = red == want
            lines.append('control5 red: %d of %d (expected %d: the round-5 asserts but its guards %s; everything else green)'
                         % (len(red), len(R), len(want), ','.join(GUARDS5)))
            if red != want:
                lines.append('  unexpected green: %s' % ','.join(a for a in want if a not in red))
                lines.append('  unexpected red:   %s' % ','.join(a for a in red if a not in want))
        else:
            ok_all = not red
        lines.append('%d asserts, %d passed, %d failed' % (len(R), len(R) - len(red), len(red)))
        if explore: lines.append(json.dumps(O, indent=1)[:60000])
        out_name = 'summary_control.txt' if control else 'summary_control5.txt' if control5 else 'summary.txt'
    lines.append('RESULT: ' + ('GREEN' if ok_all else 'RED'))
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command',
                              "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % os.path.basename(prof)],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    except Exception: pass
    shutil.rmtree(stage, ignore_errors=True)
    shutil.rmtree(prof, ignore_errors=True)

text = '\n'.join(lines)
print(text)
try: open(os.path.join(HERE, out_name), 'w', encoding='utf-8').write(text + '\n')
except Exception as e: print('could not write summary: %r' % e)
