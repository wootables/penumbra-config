# =============================================================================
# Dashboard search suite (2026-09-29, phase 1 of the dashboard filter, plus the
# Visual Search Builder on the dashboard)
#
#   route.php       the SERVER half: corpus.json through penumbra_search.php's
#                   penumbra_route_dash_search() (a "rows" case: with the column
#                   list derived from its rows, as index.php derives it), the
#                   known-columns helper, and index.php's real &dsearch= step cut
#                   out by its markers (nested @@JSON columns and __ROW too); then
#                   index.php's journal step + &search= / &dsearch= END TO END with
#                   journal_export.php (its queryViaOci8 stubbed): toggle columns
#                   written into the rows, "Done = ☑" read as the page reads it.
#                   A "journal" corpus case gets its toggle columns the same way.
#   mainframe.html  the REPORT PAGE half: main.js (hooks window.__DSM) framed
#                   inside a stand-in dashboard - the same corpus through
#                   penumbraRouteDashSearch (a "rows" case: through the page's
#                   own column lists, load path and in place), the ?dsearch=
#                   on-load pre-filter (tableless embeds too),
#                   Penumbra.applyDashboardSearch, and the postMessage to the
#                   parent, checked by the parent. Then mainload.html, framed the
#                   same way: REAL query loads of rows with an @@JSON sub-table -
#                   what the tile SHOWS after the on-load pre-filter (a nested
#                   column, __ROW, a plain ?search=, the snapshot table), not
#                   only what it routes (2026-09-29 evening); journal columns with
#                   the journal state answering AFTER the query (the real race)
#   dash.html       the DASHBOARD half: penumbra_dashboard.js + penumbra_tiles.js
#                   (splitSearch, the filter box, per-tile routing, in-place
#                   embeds, the "not filtered" note and badges, stale-fetch
#                   guard, clear) against the framed-report double index.php;
#                   the real main.css on a dark theme for computed styles
#   builder.html    the VISUAL SEARCH BUILDER on the dashboard: the opener, the
#                   first-open file loading (and an expired session on it), the
#                   window._penumbraSearchAPI adapter (columns, value lists, date
#                   pickers, from framed reports and data tiles), the count line
#                   naming the tiles a filter reaches, Apply / reopen / clear,
#                   Escape, the / key, kept modifiers, the ? link. The builder's
#                   markup is search_builder_content.php past its PHP header
#                   (written to sbc.html here).
#   controls.html   the CONTROLS TILE (phase 2, 2026-09-29 night): filter chips
#                   and switches that write the dashboard filter - values from
#                   the data tiles and the framed report, A to Z, no counts; a
#                   chip / switch / clear through the ordinary apply (address,
#                   routing, in-place embed); state read back from the box
#                   (typing, Escape); the "or" pause; the fold; focus kept; the
#                   tile editor driven: re-open, change, Apply, Save (the posted
#                   state), re-open with what was saved, the refusals, a new
#                   tile from Add tile.
#   controls2.html  the Controls tile on a dashboard OPENED under a filter: the
#                   chips still offer every value (one unfiltered, capped read
#                   per report that has a Controls column - and only one), a
#                   table excerpt does not limit them, the 5,000-row cap,
#                   "no values yet", a switches-only tile.
#
#   dashlead.html   the SHORT FORM at load (2026-09-30): a dashboard opened with
#                   ?search=COLLEGE Eng in its address goes out as a global term
#                   (no tile has answered), then routes by the column once the
#                   report that has it has: the tiles without it are sent again
#                   and show every row with the reason; a short form typed later
#                   routes at once; words no tile has stay a global term.
#   dashcols.html   the column ENVELOPE (2026-09-30): index.php's ?json=1 names a
#                   report's columns even when the filter leaves it no rows, so a
#                   short form on a column only a rowless report has still routes.
#   controls3.html  RANGE fields on the Controls tile (2026-09-30 evening):
#                   'Label|COLUMN|range' = a from / to pair writing COL >= X and
#                   COL <= Y (numbers as digits, dates as ISO days from the date
#                   picker); kinds and hints from the tiles' values; Enter, the
#                   pair committing together, a bad value marked, never a redraw
#                   over a pair being typed in, Escape, a year bound left typed,
#                   clear; the editor's range box ticked, refused on a text
#                   column, saved, re-opened. (The two engines reading these texts
#                   alike: filterstrip section J.)
#   mainxf.html     (inside mainframe.html) the real main.js hosted by a dashboard:
#                   a cell click posts penumbra:xfilter to the parent (2026-09-30).
#   dashdefault.html the dashboard's DEFAULT FILTER (Settings, 2026-09-30 evening): a clean
#                   address applies it with me() resolved for the viewer, the address stays clean,
#                   a cleared box writes an empty search=, a typed me() resolves, Settings changes
#                   and Save keeps it, a me() word with no value leaves it off with a note;
#                   dashdefault2.html = the same page opened with an EMPTY search=, which wins.
#   controls4.html  the (BLANK) chip on the Controls tile (2026-09-30, late): 'Label|COLUMN|blank'
#                   offers the rows whose cell is empty as a chip of its own - last, in italics,
#                   no count - writing an empty alternative (STATUS = /^(?:)$/, or /^(?:|Open)$/
#                   among values; != on an exclude group) that the tiles' reports match against
#                   their blank cells; pressed state read back from a typed filter, Escape, Clear
#                   all; the editor's blank box (off while range is ticked), saved, re-opened.
#   kiosk.html      a ?kiosk=1 ADDRESS opens kiosk view directly (2026-10-01): body.dash-kiosk at
#                   once (header hidden, action bar empty, corner exit, address kept, countdown
#                   pinned with the kiosk refresh default), the hint, the browser's full screen
#                   asked for ONCE on the first click or key press (stubbed), a modifier alone
#                   not a gesture, every gesture while windowed asking and the hint a button
#                   that stays (kiosklink2), a frame added after boot wired (a click inside asks,
#                   Esc inside leaves), Esc leaving the windowed kiosk (header and Kiosk link
#                   back, address and interval restored, tiles kept), the button path, and
#                   leaving full screen ending kiosk. The pre-feature boot downgraded every
#                   kiosk=1 address to the normal view.
#   controls5.html  chip COUNTS on the Controls tile (2026-10-01): a count only when every tile
#                   that has the column reads ONE report (STATUS / TYPE from a stat tile's full
#                   rows, NAME from the fill read; none for COLLEGE, held by two reports; none
#                   for ZIP, a 5,001-row report behind a table excerpt = a capped fill read); a
#                   pressed chip narrows the OTHER groups through one capped read each with the
#                   condition routed (never its own group), cached by the other-conditions text;
#                   Clear all back to the held rows; the editor's Counts box off -> nocounts.
#   (mainload.html, 2026-10-01 later) a REAL load that returns NO ROWS: the driver's column
#                   metadata (query.php's columns_meta) names the columns, the dashboard filter
#                   is routed by them and posted (a missing column skipped), the search API and
#                   the header map list them; with no metadata nothing is named, never the last
#                   query's columns. route.php: the same envelope and routing on the server.
#   controls6.html  the LIST option on the Controls tile (2026-10-01, later): 'Label|COLUMN|list'
#                   draws a type-to-find box over a scrolling column of every value (no
#                   "+n more"), each row a chip with its single-source count; typing hides
#                   the rows it misses in place with no filter change; Enter presses the
#                   first row showing that is not pressed; the typed text, the pressed-first
#                   order and the focus survive the redraw; a typed filter presses its row
#                   and never leaves it hidden; Clear all keeps the text; the editor's list
#                   box authored, saved and re-opened (off under range; show N off under list)
#   xflink.html     SEARCH LINKS route to the dashboard filter (2026-10-01): a cell's data-search
#                   link in a table tile toggles its text in the filter (applied, routed, the
#                   note, a second link joining with and, the same link releasing); an "or"
#                   link replaces the filter as it does on its own page; a frame of ours
#                   posting a link's text is applied, a message from elsewhere ignored.
#                   mainxf.html: the hosted main.js posts a link's text and leaves its box.
#   -Stage <dir>    test the files in a flat stage folder (penumbra_dashboard.js,
#                   penumbra_tiles.js, main.js, main.css, penumbra_dashboard.css,
#                   penumbra_search.php, index.php, search_builder.js,
#                   search_builder.css, search_builder_content.php,
#                   journal_export.php - each one
#                   missing there is taken from the live app); default = the
#                   live app. The pre-feature live files are the positive
#                   control: every part must go FATAL or red.
#   -Mutant <name>  ONE single-point change, to show a named assertion bites:
#       routeoff   the dashboard sends plain search (the pre-2026-09-29 rule)
#       staleok    a slower, older fetch may overwrite a newer filter's tile
#       reloadall  embeds are never filtered in place
#       gatefirst  the tableless-embed gate outranks a dashboard filter again
#       jsroute    main.js keeps fragments on columns the report lacks
#       phproute   penumbra_search.php keeps fragments on columns the report lacks
#       sbreach    search_builder.js ignores the host's count line
#       sblabel    search_builder.js ignores the host's submit label
#       keepmods   the dashboard drops modifiers the builder cannot show
#       valunion   the value list stops at the first tile that has the column
#       rowsbest   filtered rows replace unfiltered ones for the value lists
#       escoff     Escape never closes the builder on the dashboard
#       shortcut   page shortcuts fire while the builder is open
#     nested columns (2026-09-29 evening):
#       prefilter    main.js's on-load pre-filters parse without the nested columns
#       prefilterrow main.js's on-load pre-filters ignore a leading __ROW
#       flatnest     the flat search's ONE column list (box, pre-filters, router) loses them
#       phpnest      penumbra_search.php reads nested columns from the first row only
#       phpnestall   penumbra_search.php reads them from every row, not the first 10
#       phpengine    the PHP engine reads the first row while its router reads 10
#       sbnested     the dashboard's builder is offered no nested columns
#       sbnestvals   a data tile's nested column gets no value list
#       sbnestreach  the count line and the value lists ignore the tiles' nested columns
#       sbrowkeep    the dashboard puts back a __ROW the builder's own box dropped
#     journal columns (2026-09-29 night):
#       jsjournal    main.js's router leaves the journal columns out again
#       rerunoff     a journal search run before the journal state landed is never re-run
#       jpending     main.js stops tracking the journal state fetches in flight
#       phpresolver  index.php's &dsearch= step reads "Done = ☑" without the toggle resolver
#       phpsearchres index.php's &search= step reads it without the resolver
#       jresolverret journal_export.php stops handing index.php its resolver
#     the dashboard filter box's suggestions and help (phase 2, 2026-09-29 night):
#       acoff        the box never gets the suggestion engine
#       acescape     the box's Enter / Escape ignore an open suggestion list
#       sbengine     the shared engine stops asking its host (_penumbraSearchAPI)
#       mainwrap     main.js stops wiring the engine to the report search box
#       helpremote   the builder's ? opens the report page in a new tab again
#       helpesc      Escape closes the builder under an open help panel
#       helpz        the help panel opens underneath the builder
#     the Controls tile (phase 2, 2026-09-29 night):
#       ctlvalues    the chips get no values from the tiles
#       ctlstate     the chips never read their pressed state from the box
#       ctlapply     a chip writes the box but never applies it
#       ctltoggle    a switch replaces the filter instead of adding one condition
#       ctlor        an "or" filter no longer pauses the chips
#       ctlreach     the builder's count line counts a Controls tile as a tile (builder.html)
#       ctlfill      the chips never read a report's unfiltered rows (controls2.html)
#       ctlfillonce  the unfiltered read repeats with every redraw (controls2.html)
#       ctllabel     a checkbox's own label in an editor field is set as a heading again (css)
#       ctlrangekind   the click handlers read a range's bound without its kind (controls3.html)
#       ctlrangecommit moving from one box of the pair to the other commits half (controls3.html)
#       ctlrangeedit   the editor's range box is not saved (controls3.html)
#       ctlrangeguard  a redraw runs over a pair being typed in (controls3.html)
#       ctlrangeclean  a commit leaves its boxes looking typed, so a later redraw wipes the other box (controls3.html)
#       ctlfocus     a redraw drops the keyboard focus
#       ctlsave      the editor's Apply loses the chips
#       ctlfollow    the chips stop following the box (Escape, typing)
#       ctlempty     a group with no values says nothing (penumbra_tiles.js)
#     the short form COLUMN value (2026-09-30):
#       leadsplit    splitSearch never names the short form's leading word (penumbra_tiles.js)
#       leadoff      the dashboard never routes a short form by its leading column
#       leadreroute  a tile is never sent the filter again once the column is known (dashlead.html)
#     the column envelope and cross-filtering (2026-09-30):
#       colsidx      index.php's json envelope carries no columns key (route.php)
#       colsenv      the dashboard ignores the envelope's columns (dashcols.html)
#       xfcells      a table tile's cells carry no column (penumbra_tiles.js; dash.html)
#       xfchart      chart tiles get no click hook (dash.html)
#       xfmsg        a framed report's cross-filter message is ignored (dash.html)
#       xfhost       main.js filters the frame instead of posting to the dashboard (mainxf.html)
#       xfhostchart  a hosted page's chart click opens its drill popup instead of posting (mainxf.html)
#       xfpairs      the dashboard applies only the first criterion of a framed chart's click (dash.html)
#     keyboard cross-filtering (WCAG 2.1.1, 2026-10-15; dash.html section K):
#       xfkeys       Enter / Space / arrows on a table tile's rows and cells do nothing
#       xfkeycells   a table tile's plain cells get no tabindex, so the arrows cannot reach them (penumbra_tiles.js)
#       xffocus      focus is not put back on the value after the table redraws
#       xfmenu       chart tiles get no Filter menu
#     the default filter (2026-09-30 evening):
#       defoff       a clean address never applies the default (dashdefault.html)
#       defaddr      a cleared box on a dashboard with a default leaves the address bare (dashdefault.html)
#       defme        a typed me() word is not resolved (dashdefault.html)
#     the (blank) chip (2026-09-30, late):
#       ctlblank     a blank field offers no blank chip (controls4.html)
#       ctlblankpin  the blank chip sorts first instead of last (controls4.html)
#       ctlblankedit the editor's blank box is never saved (controls4.html)
#     the kiosk link (2026-10-01):
#       kiosklink    a kiosk=1 address is downgraded to the normal view again (kiosk.html)
#       kioskgesture the first click or key never asks for full screen (kiosk.html)
#       kioskesc     Esc no longer leaves a windowed kiosk (kiosk.html)
#       kioskframe   an embedded frame's document gets no kiosk listeners (kiosk.html)
#     chip counts (2026-10-01):
#       ctlcountsrc   a column two reports hold still counts (controls5.html)
#       ctlcountothers the other groups' conditions never narrow a count (controls5.html)
#       ctlcountself  a group's own selection narrows its own counts (controls5.html)
#       ctlcountcap   a capped read counts anyway (controls5.html)
#       ctlcountcache every redraw repeats the count reads (controls5.html)
#       ctlnocounts   the editor's Counts box is never saved (controls5.html)
#       ctllistedit   the editor's list box is never saved (controls6.html)
#       ctllistkeep   a redraw drops the typed find text (controls6.html)
#       ctllistfind   typing hides nothing (controls6.html)
#       ctllistfocus  a redraw moves focus out of the find box (the box left out of the refocus selector; controls6.html)
#       ctllisttop    the editor keeps show N on under list (controls6.html)
#       metacols      a rowless query's metadata no longer fills the envelope (route.php)
#       metaroute     the routing needs rows again (route.php)
#       pagemeta      the page no longer records a rowless query's columns (mainframe: mainload)
#       pagepost      the page no longer posts a rowless query's routing (mainframe: mainload)
#       apicols       the search API lists nothing without a header row (mainframe: mainload)
#     search links (2026-10-01):
#       xflink       a table tile's search link filters nothing (xflink.html)
#       xflinkmsg    a framed report's posted search text is ignored (xflink.html)
#       xflinkhost   the hosted main.js searches its own frame on a link (mainframe.html)
#     the column arrow (2026-10-06, the report search bar's arrow on the dashboard box; builder.html A1):
#       colsbtn      the box has no arrow button
#       colsload     the arrow / Alt+Down never load the engine or open the list
#       colsaltkey   Alt+Down in the box does nothing before the engine is loaded
#       colstoggle   a second click on the arrow opens the list again instead of closing it
#       colsborder   the box's boundary goes back to the 1.3:1 divider colour (penumbra_dashboard.css)
#       colsswap     the arrow stays beside the clear once there is a search (round 2: the clear takes its place)
#       sbaccent     the magnifier loses its brand accent and reads as a landmark again (penumbra_dashboard.css)
#
# Run the BODY as a scriptblock (UNC scripts are GPO-blocked), ONE run at a time
# (every run rewrites this folder), output to a file:
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashsearch'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot',"`$here = '$dir'"))) -Stage <dir> 6>&1 *>&1 | Out-File "$dir\run.log"
# Results land in summary.txt. Exit code 1 when anything failed.
# =============================================================================
param([string]$Stage = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashsearch' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$summary = New-Object System.Collections.Generic.List[string]
$failTotal = 0

function Src($name, $liveRel) {
  if ($Stage -and (Test-Path -LiteralPath (Join-Path $Stage $name))) { return (Join-Path $Stage $name) }
  return (Join-Path $app $liveRel)
}
$files = @{
  dash   = Src 'penumbra_dashboard.js'      'js\penumbra_dashboard.js'
  tiles  = Src 'penumbra_tiles.js'          'js\penumbra_tiles.js'
  main   = Src 'main.js'                    'js\main.js'
  dcss   = Src 'penumbra_dashboard.css'     'css\penumbra_dashboard.css'
  mcss   = Src 'main.css'                   'css\main.css'
  search = Src 'penumbra_search.php'        'penumbra_search.php'
  index  = Src 'index.php'                  'index.php'
  sb     = Src 'search_builder.js'          'js\search_builder.js'
  sbcss  = Src 'search_builder.css'         'css\search_builder.css'
  sbc    = Src 'search_builder_content.php' 'search_builder_content.php'
  journal = Src 'journal_export.php'        'journal_export.php'
  help   = Src 'help_content.php'           'help_content.php'
}
$summary.Add("files: " + $(if ($Stage) { $Stage + ' (missing ones from LIVE)' } else { 'LIVE' }) + $(if ($Mutant) { "   MUTANT $Mutant" } else { '' }))

Write-Host "[1/17] staging ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js',
          'show-hint.js','foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js',
          'penumbra_snippet_help.js','purify.min.js','penumbra_template.js','chart-4.5.1.min.js','penumbra_a11y.js')
foreach ($f in $libs) { Copy-Item "$app\js\$f" "$here\$f" -Force }
Copy-Item $files.mcss "$here\main.css" -Force
Copy-Item "$app\css\penumbra_tiles.css" "$here\penumbra_tiles.css" -Force
Copy-Item "$app\css\jquery-ui.css" "$here\jquery-ui.css" -Force
Copy-Item $files.sbcss "$here\search_builder.css" -Force
New-Item -ItemType Directory -Force "$here\app" | Out-Null

$txt = @{
  dash   = [IO.File]::ReadAllText($files.dash, $utf8)
  tiles  = [IO.File]::ReadAllText($files.tiles, $utf8)
  main   = [IO.File]::ReadAllText($files.main, $utf8)
  search = [IO.File]::ReadAllText($files.search, $utf8)
  index  = [IO.File]::ReadAllText($files.index, $utf8)
  sb     = [IO.File]::ReadAllText($files.sb, $utf8)
  journal = [IO.File]::ReadAllText($files.journal, $utf8)
  dcss   = [IO.File]::ReadAllText($files.dcss, $utf8)
}
# Mutants: @(file key, old, new). The anchor must occur exactly once.
$mutants = @{
  'routeoff'  = @('dash', "return { search: '', dsearch: JSON.stringify({ p: dash.prefix || '', f: f }), note: '' };", "return { search: URL_SEARCH, dsearch: '', note: '' };")
  'staleok'   = @('dash', 'if (_tileRenderTok[tile.id] !== _tok) { return; }', '/* mutant: no stale guard */')
  'reloadall' = @('dash', 'try { w = fr.contentWindow; api = w && w.Penumbra ? w.Penumbra.applyDashboardSearch : null; } catch (e) { api = null; }', 'api = null;')
  'gatefirst' = @('main', 'if (_pnbDashSearch) return _pnbDashLoadText(cols);', 'if (_pnbDashSearch && !_penumbraTablelessEmbed()) return _pnbDashLoadText(cols);')
  'jsroute'   = @('main', 'if (!col || have[col]) {', 'if (true) {')
  'phproute'  = @('search', 'if ($col === '''' || isset($have[$col])) {', 'if (true) {')
  'sbreach'   = @('sb', 'if (_sbMode.previewText) {', 'if (false) {')
  'sblabel'   = @('sb', 'if (_sbMode.submitLabel) {', 'if (false) {')
  'keepmods'  = @('dash', 'var out = keepModifiers(q, _sbHadMods);', 'var out = String(q == null ? '''' : q).trim();')
  'valunion'  = @('dash', 'if (out.length > 15000) { tooMany = true; return false; }', 'return false;')
  'rowsbest'  = @('dash', 'if (!had || score >= had.score) { _rowsSeen[k] = { rows: rows, score: score }; }', '_rowsSeen[k] = { rows: rows, score: score };')
  'escoff'    = @('dash', 'if (!lb || !$(lb).is('':visible'') || $(''#dashSsoLightbox'').length || $(''#dashHelpOverlay'').length) { return; }', 'return;')
  'shortcut'  = @('dash', 'if ($(''#searchBuilderLightbox'').is('':visible'')) { return; }', '/* mutant: shortcuts ignore the builder */')
  'prefilter'    = @('main', 'const cols = penumbraFlatSearchColumns(names);', 'const cols = names.concat([''#'']);')
  'prefilterrow' = @('main', 'const rowMatch = /^__ROW\s+/i.test(q);', 'const rowMatch = false;')
  'flatnest'     = @('main', 'buildVirtualColumnNames().forEach(vc => { if (!all.some(c => c.toUpperCase() === vc)) all.push(vc); });', '/* mutant: no nested names */')
  'phpnest'      = @('search', 'if ($n++ >= 10) {', 'if ($n++ >= 1) {')
  'phpnestall'   = @('search', 'if ($n++ >= 10) {', 'if (false) {')
  'phpengine'    = @('search', 'foreach (_search_virtual_column_names($sampleRows) as $vColName) {', 'foreach (_search_virtual_column_names(array_slice($sampleRows, 0, 1)) as $vColName) {')
  'sbnested'     = @('dash', 'buildVirtualColumnNames: function () { return builderNestedColumns(); },', 'buildVirtualColumnNames: function () { return []; },')
  'sbnestvals'   = @('dash', 'vals = nested ? rowNestedValues(rows, name) : rowValues(rows, name);', 'vals = rowValues(rows, name);')
  'sbnestreach'  = @('dash', 'if (!(nested[i] in upper)) { upper[nested[i]] = nested[i]; nest.push(nested[i]); }', 'if (!(nested[i] in upper)) { nest.push(nested[i]); }')
  'sbrowkeep'    = @('dash', 'if (rowBox && getComputedStyle(rowBox).display !== ''none'') {', 'if (false) {')
  'jsjournal'    = @('main', '_pnbDashRouted = penumbraRouteDashSearch(p.dsearch, penumbraFlatSearchColumns(cols));', '_pnbDashRouted = penumbraRouteDashSearch(p.dsearch, cols.concat([''#''], buildVirtualColumnNames()));')
  'rerunoff'     = @('main', 'if (!pend.length || !penumbraSearchNamesJournal(query)) return;', 'return;')
  'jpending'     = @('main', '_jDataPending.push(xhr);', '/* mutant: journal fetches not tracked */')
  'phpresolver'  = @('index', 'php_apply_search_filter($response[''data''], ''standard'', $_dsRouted[''text''], null, $journal_toggle_resolver);', 'php_apply_search_filter($response[''data''], ''standard'', $_dsRouted[''text'']);')
  'phpsearchres' = @('index', 'php_apply_search_filter($response[''data''], ''standard'', (string)$_GET[''search''], null, $journal_toggle_resolver);', 'php_apply_search_filter($response[''data''], ''standard'', (string)$_GET[''search'']);')
  'jresolverret' = @('journal', '$out[''resolver''] = $resolver;', '/* mutant: no resolver returned */')
  'acoff'        = @('dash', 'sb.attachFilterAutocomplete(''#dashSearchInput'', {', '(function () {})(''#dashSearchInput'', {')
  'acescape'     = @('dash', 'if ((e.key === ''Enter'' || e.key === ''Escape'') && e.isDefaultPrevented()) { return; }', '/* mutant: the box ignores the suggestion list */')
  'sbengine'     = @('sb', 'var _acApi = window._penumbraSearchAPI || {};', 'var _acApi = {};')
  'mainwrap'     = @('main', 'window._penumbraSearchBuilder.attachFilterAutocomplete(selector, opts);', '/* mutant: main.js no longer wires the engine */')
  'helpremote'   = @('dash', 'if (LOCAL_HELP[tgt]) { openHelpPanel(tgt, $(this).attr(''data-jump-to'')); return; }', '/* mutant: the builder ? opens a new tab again */')
  'helpesc'      = @('dash', 'if (!lb || !$(lb).is('':visible'') || $(''#dashSsoLightbox'').length || $(''#dashHelpOverlay'').length) { return; }', 'if (!lb || !$(lb).is('':visible'') || $(''#dashSsoLightbox'').length) { return; }')
  'helpz'        = @('dcss', '#dashHelpOverlay { z-index: 20001; }', '/* mutant: the help panel under the builder */')
  'ctlvalues'    = @('dash', '(dashColumnValues(col) || []).forEach(function (v) {', '([]).forEach(function (v) {')
  'ctlstate'     = @('dash', 'var st = off ? { prefix: '''', sel: {}, range: {}, rest: [], or: false } : T.strip.state(text, spec.fields);', 'var st = { prefix: '''', sel: {}, range: {}, rest: [], or: false };')
  'ctlapply'     = @('dash', 'applyDashSearch(text);   // redraws the Controls tiles, focus kept (renderControlsInto)', '/* mutant: written, never applied */')
  'ctltoggle'    = @('dash', 'var next = T.strip.has(text, cond) ? T.strip.remove(text, cond) : T.strip.add(text, cond);', 'var next = T.strip.has(text, cond) ? '''' : cond;')
  'ctlor'        = @('dash', 'var text = dashBoxText(), off = T.splitTopLevel(text).or ? ''or'' : null;', 'var text = dashBoxText(), off = null;')
  'ctlreach'     = @('dash', 'if (tl.type === ''note'' || tl.type === ''controls'') { continue; }', 'if (tl.type === ''note'') { continue; }')
  'ctlfill'      = @('dash', 'if (best[k] === 7 || _ctlFillAsked[k] || (had && had.score === 7)) { return; }', 'return;')
  'ctlfillonce'  = @('dash', '_ctlFillAsked[k] = true;', '/* mutant: asked again every time */')
  'ctllabel'     = @('dcss', '.dash-field > label.dash-check { display: flex; font-size: 12.5px; font-weight: 400; color: inherit; text-transform: none; letter-spacing: 0; margin-bottom: 0; }', '/* mutant: no checkbox label rule */')
  'ctlfocus'     = @('dash', 'if (key) { ctlRefocus($tile, key); }   // the redraw replaced the focused node', '/* mutant: focus not restored */')
  'ctlsave'      = @('dash', 'next.strip = cr.strip;', '/* mutant: chips not saved */')
  'ctlfollow'    = @('dash', '        controlsFollowBox();', '        /* mutant: the chips do not follow the box */')
  'ctlempty'     = @('tiles', "if (!grp.values.length && opts.emptyText) html += '<span class=`"pnb-fs-empty`">' + escapeHtml(opts.emptyText) + '</span>';", '/* mutant: no empty text */')
  'leadsplit'    = @('tiles', 'if (bm) { f.lead = String(bm[1] || bm[2] || bm[3] || bm[4] || '''').trim().toUpperCase(); }', '/* mutant: no lead */')
  'leadoff'      = @('dash', 'return (f.lead && colsUnion()[f.lead]) ? f.lead : '''';', 'return '''';')
  'leadreroute'  = @('dash', '_leadTimer = setTimeout(rerouteLeads, 250);', '/* mutant: never sent again */')
  'colsidx'      = @('index', 'if (!empty($_dsCols)) { $response[''columns''] = $_dsCols; }', '/* mutant: no columns key */')
  'colsenv'      = @('dash', 'noteColsSeen(tile, res.columns);', '/* mutant: envelope columns ignored */')
  'xfcells'      = @('tiles', 'var plainCol = (special === null && !isHtmlCol(cols[c]) && !/@@JSON/i.test(cols[c]) && cols[c] !== ''#'')', 'var plainCol = (false)')
  'xfchart'      = @('dash', 'chartHooks: (tile.type === ''chart'') ? chartCrossFilterHooks(tile) : null', 'chartHooks: null')
  'xfmsg'        = @('dash', 'if (mine) { if (d.pairs && d.pairs.length) { crossFilterPairs(d.pairs); } else { crossFilter(d.col, d.value); } }', 'if (mine) { /* mutant: frame clicks ignored */ }')
  'xfhost'       = @('main', 'if (_pnbDashHosted() && _pnbDashPostFilter(col, value)) return;', '/* mutant: never posts to the dashboard */')
  'xfhostchart'  = @('main', '&& _pnbDashPostFilter(hostedPairs[0].col, hostedPairs[0].value, hostedPairs)) {', '&& false) {')
  'ctlrangekind'   = @('dash', '        controlsKinds(spec);', '        /* mutant: no kinds */')
  'ctlrangecommit' = @('dash', 'if (!document.body.contains(grp) || $.contains(grp, document.activeElement)) { return; }', 'if (!document.body.contains(grp)) { return; }')
  'ctlrangeedit'   = @('dash', 'bits.push(''range'');   // exclude and show N are chip options: a range takes neither', '/* mutant: range not saved */')
  'ctlrangeguard'  = @('dash', 'if (aeGrp && $.contains($tile[0], aeGrp) && $(aeGrp).find(''.pnb-fs-bound'').filter(function () { return this.value !== this.defaultValue; }).length) { return waiting; }', '/* mutant: redraw over typing */')
  'ctlrangeclean'  = @('dash', '$(grp).find(''.pnb-fs-bound'').each(function () { this.defaultValue = this.value; });   // written: no longer typing', '/* mutant: a commit leaves its boxes looking typed */')
  'xfpairs'      = @('dash', 'if (mine) { if (d.pairs && d.pairs.length) { crossFilterPairs(d.pairs); } else { crossFilter(d.col, d.value); } }', 'if (mine) { crossFilter(d.col, d.value); }')
  'defoff'       = @('dash', 'if (URL_SEARCH_SET) { return; }', 'return;')
  'defaddr'      = @('dash', 'else if (!URL_SEARCH && def) { parts.push(''search=''); }', '/* mutant: a cleared address bare */')
  'defme'        = @('dash', 'text = resolveMeTokens(String(text == null ? '''' : text)).trim();', 'text = String(text == null ? '''' : text).trim();')
  'ctlblank'     = @('dash', 'if (f.blank && dv) { idx[''''] = { v: '''', n: null, on: false }; list.push(idx['''']); }', '/* mutant: no blank chip */')
  'ctlblankpin'  = @('dash', 'if (idx['''']) { list.splice(list.indexOf(idx['''']), 1); list.push(idx['''']); }   // the (blank) chip last, whatever the order', '/* mutant: the blank chip sorts first */')
  'ctlblankedit' = @('dash', 'if ($r.find(''.teCtlBlank'').is('':checked'')) { bits.push(''blank''); }', '/* mutant: blank not saved */')
  'kiosklink'    = @('dash', 'if (kioskLink) { enterKioskMode(true); armKioskGestureFullscreen(); }   // its own scheduleAutoRefresh, with the kiosk interval', 'if (false) { }')
  'kioskgesture' = @('dash', 'try { var p = document.documentElement.requestFullscreen(); if (p && p.catch) { p.catch(function () { }); } } catch (err) { }', '/* mutant: never asks */')
  'kioskesc'     = @('dash', 'if (e.key === ''Escape'' && KIOSK && !document.fullscreenElement && !$(''#dashOverlay'').length) { exitKioskMode(); }', '/* mutant: Esc ignored */')
  'kioskframe'   = @('dash', 'd.addEventListener(''click'', kioskGesture, true);', '/* mutant: no frame listeners */')
  'ctlcountsrc'    = @('dash', 'else if (k !== key) { return null; }   // the column spans reports: one number could not mean anything', 'else if (false) { return null; }')
  'ctlcountothers' = @('dash', 'var text = T.strip.compose(others, spec.fields), rows = null;', 'var text = '''', rows = null;')
  'ctlcountself'   = @('dash', 'if (gc !== cu && st.sel[gc] && st.sel[gc].length) { others.sel[gc] = st.sel[gc]; }', 'if (st.sel[gc] && st.sel[gc].length) { others.sel[gc] = st.sel[gc]; }')
  'ctlcountcap'    = @('dash', 'if (!seen || seen.score !== 7) { return null; }   // filtered, an excerpt or a capped read: not the whole report', 'if (!seen) { return null; }')
  'ctlcountcache'  = @('dash', ', had = _ctlCountRows[ck];', ', had = null;')
  'ctlnocounts'    = @('dash', 'if (!$(''#teCtlCounts'').is('':checked'')) { args.push(''nocounts''); }', '/* mutant: counts box ignored */')
  # keyboard cross-filtering (WCAG 2.1.1, 2026-10-15; dash.html section K)
  'xfkeys'       = @('dash', 'if (e.target !== this || editMode || e.ctrlKey || e.metaKey || e.altKey) { return; }', 'return;')
  'xfkeycells'   = @('tiles', '+ (cellFilter ? '' tabindex="-1"'' : '''')', '')
  'xffocus'      = @('dash', 'if (!f || f.tileId !== String(tile.id)) { return; }', 'return;')
  'xfmenu'       = @('dash', '} else if (tile.type === ''chart'' && tile.groupBy) {', '} else if (false) {')
  'xflink'       = @('dash', 'crossFilterText($(this).attr(''data-search''));', '/* mutant: the link filters nothing */')
  'xflinkmsg'    = @('dash', 'if (mine) { if (d.text) { crossFilterText(d.text); } else if', 'if (mine) { if (false) { } else if')
  'xflinkhost'   = @('main', 'if (_pnbDashHosted() && _pnbDashPostSearch(resolvedQuery)) return;', '/* mutant: the frame searches itself */')
  'ctllistedit'  = @('dash', 'if ($r.find(''.teCtlList'').is('':checked'')) { bits.push(''list''); }', 'if (false) { bits.push(''list''); }')
  'ctllistkeep'  = @('dash', '{ where: ''dashboard'', emptyText: ''no values yet'', find: _ctlFind[tile.id] || {} });', '{ where: ''dashboard'', emptyText: ''no values yet'' });')
  'ctllistfind'  = @('dash', 'T.strip.listFilter(grp, this.value);', '/* mutant: typing filters nothing */')
  'ctllistfocus' = @('dash', '.pnb-toggle-btn, .pnb-fs-bound, .pnb-fs-find'').filter(function () {', '.pnb-toggle-btn, .pnb-fs-bound'').filter(function () {')
  'ctllisttop'   = @('dash', '$(this).closest(''.dash-ctl-row'').find(''.teCtlTop'').prop(''disabled'', this.checked);', '/* mutant: show N stays on under list */')
  'metacols'     = @('index', ': penumbra_search_columns_from_meta(isset($response[''columns_meta'']) ? $response[''columns_meta''] : null);', ': array();')
  'metaroute'    = @('index', 'if (!empty($_dsCols)) {   // the rows'' columns, or a rowless query''s metadata (2026-10-01)', 'if (!empty($response[''data''])) {')
  'pagemeta'     = @('main', '$("#resultsTable").data(''columnNameToOriginalIndex'', _pnbMetaIdx);', '/* mutant: the metadata columns not recorded */')
  'pagepost'     = @('main', '_pnbDashLoadText(_pnbMetaCols.length ? _pnbMetaCols : null);', '_pnbDashLoadText(null);')
  'apicols'      = @('main', 'cols = Object.keys($("#resultsTable").data(''columnNameToOriginalIndex'') || {}).map(function (n) { return { name: n, visible: true }; });', '/* mutant: no fallback */')
  'colsbtn'      = @('dash', '''<button type="button" class="dash-filter-btn dash-filter-cols" id="dashSearchCols"', '''<button type="button" class="dash-filter-btn dash-filter-cols" id="dashSearchColsGone"')
  'colsload'     = @('dash', 'function dashShowColumns() {', 'function dashShowColumns() { return;')
  'colsaltkey'   = @('dash', '&& e.altKey && !e.ctrlKey && !e.metaKey && !_dashAcOn) {', '&& false) {')
  'colstoggle'   = @('dash', '$(this).data(''pnbWasOpen'', !!(sb && typeof sb.columnListOpen === ''function'' && sb.columnListOpen(''#dashSearchInput'')));', '$(this).data(''pnbWasOpen'', false);')
  'colsborder'   = @('dcss', '    border: 1px solid var(--border-strong, var(--border-color, #888));', '    border: 1px solid var(--border-color, #ccc);')
  'colsswap'     = @('dash', '$(''#dashSearchCols'').toggleClass(''dash-filter-hide'', !!(val || URL_SEARCH));', '/* mutant: the arrow stays beside the clear */')
  # (parentheses: PowerShell's comma binds tighter than +, which would split the anchor into two elements)
  'sbaccent'     = @('dcss', ('    background: color-mix(in srgb, var(--brand-primary, #336699) 10%, transparent);' + "`n" + '    background-color: color-mix(in srgb, var(--brand-primary, #336699) 10%, transparent);' + "`n" + '    color: var(--brand-text, var(--brand-primary, #336699));'), '    /* mutant: no accent */')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mk = $mutants[$Mutant][0]; $mOld = $mutants[$Mutant][1]; $mNew = $mutants[$Mutant][2]
  $mN = ([regex]::Matches($txt[$mk], [regex]::Escape($mOld))).Count
  if ($mN -ne 1) { throw "mutant '$Mutant' anchor found $mN times in $mk, expected 1: $mOld" }
  $txt[$mk] = $txt[$mk].Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\dash.js", $txt.dash, $utf8)
[IO.File]::WriteAllText("$here\penumbra_tiles.js", $txt.tiles, $utf8)
[IO.File]::WriteAllText("$here\search_builder.js", $txt.sb, $utf8)
[IO.File]::WriteAllText("$here\app\penumbra_search.php", $txt.search, $utf8)
[IO.File]::WriteAllText("$here\app\index.php", $txt.index, $utf8)
[IO.File]::WriteAllText("$here\app\journal_export.php", $txt.journal, $utf8)
[IO.File]::WriteAllText("$here\penumbra_dashboard.css", $txt.dcss, $utf8)
# The builder's markup: search_builder_content.php past its PHP header (the
# login gate), as the server sends it to a signed-in viewer.
$sbcText = [IO.File]::ReadAllText($files.sbc, $utf8)
$sbcAt = $sbcText.IndexOf('?>')
if ($sbcAt -lt 0 -or $sbcText.IndexOf('searchBuilderLightbox', $sbcAt) -lt 0) { throw "search_builder_content.php: no markup after the PHP header - update run.ps1" }
[IO.File]::WriteAllText("$here\sbc.html", $sbcText.Substring($sbcAt + 2).TrimStart("`r", "`n"), $utf8)
# The help the dashboard's help panel fetches (help_content.php): since 2026-10-19 that URL is a shim over
# help/topics + help/tips, so the raw fragments are concatenated here (their PHP guard parses as a comment).
$pnbHelpAll = New-Object System.Collections.Generic.List[byte]
foreach ($pf in @(Get-ChildItem -LiteralPath "$app\help\topics" -Filter *.php) + @(Get-ChildItem -LiteralPath "$app\help\tips" -Filter *.php)) { $pnbHelpAll.AddRange([IO.File]::ReadAllBytes($pf.FullName)); $pnbHelpAll.AddRange([byte[]](10)) }
[IO.File]::WriteAllBytes("$here\help.html", $pnbHelpAll.ToArray())

$anchor = '$(document).ready(function () {'
if (-not $txt.main.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }
$hooks = @(
  'try { window.__DSM = { route: penumbraRouteDashSearch, onLoad: _getOnLoadSearchQuery, loadText: _pnbDashLoadText,',
  '  get: function () { return { ds: _pnbDashSearch, key: _pnbDashAppliedKey, routed: _pnbDashRouted, retry: _pnbDashRetry }; },',
  '  set: function (ds) { _pnbDashSearch = ds; _pnbDashAppliedKey = null; _pnbDashRouted = null; },',
  '  applied: function (v) { _flatSearchAppliedFor = v; },',
  '  tableless: _penumbraTablelessEmbed, overrides: function () { return _penumbraUrlOverrides; },',
  '  resv: function () { return [_DL_RESERVED_PARAMS.dsearch, _CMP_RESERVED_PARAMS.dsearch]; },',
  '  cols: _pnbDashColumns, rows: function (r) { masterRowData = r; }, sql: function (s) { editor.setValue(s); },',
  '  rebuild: function (snap) { return rebuildTableFromMasterData(snap); },',
  '  chartClick: _handleChartElementClick, hosted: _pnbDashHosted };',
  '} catch (e) { window.__DSM_ERR = String(e); }'
) -join ' '
$i0 = $txt.main.IndexOf($anchor)
$patched = $txt.main.Substring(0, $i0) + $anchor + "`r`n    $hooks`r`n" + $txt.main.Substring($i0 + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $utf8)

Write-Host "[2/17] server half (route.php) ..."
$phpOut = & $php -n "$here\route.php" "$here\app" 2>&1 | ForEach-Object { "$_" }
$phpFail = @($phpOut | Where-Object { $_ -match '^\s+FAIL|^FATAL' }).Count
$phpLine = @($phpOut | Where-Object { $_ -match 'assertions, \d+ failed|^FATAL' }) | Select-Object -Last 1
if (-not $phpLine) { $phpLine = 'route.php produced no summary'; $phpFail = [Math]::Max($phpFail, 1) }
$summary.Add("route.php: $phpLine")
$phpOut | Where-Object { $_ -match '^\s+FAIL|^\s{8}|^FATAL' } | ForEach-Object { $summary.Add("  $_") }
$failTotal += $phpFail

function RunPage($page, $label) {
  $out = Join-Path $here ('dom_' + ($page -replace '\.html$', '') + '.txt')
  $prof = Join-Path $env:TEMP ('pnbds_' + [guid]::NewGuid().ToString('N').Substring(0, 6))
  $url = 'file:///' + ($here -replace '\\', '/') + '/' + $page
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $out -ArgumentList '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', "--user-data-dir=$prof", '--virtual-time-budget=60000', '--window-size=1366,900', '--dump-dom', $url
  $pr.WaitForExit(240000) | Out-Null
  if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
  Start-Sleep -Milliseconds 500
  $fs = New-Object IO.FileStream($out, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $dom = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
  $m = [regex]::Match($dom, 'RESULT(?:&gt;|>){2}(.*?)(?:&lt;|<){2}FIN', 'Singleline')
  if (-not $m.Success) {
    $i = $dom.IndexOf('<pre id="out">'); $j = $dom.IndexOf('</pre>', $i)
    $peek = if ($i -ge 0) { [System.Net.WebUtility]::HtmlDecode($dom.Substring($i + 14, [Math]::Min(400, $j - $i - 14))) } else { '' }
    $summary.Add("${label}: NO RESULT MARKER (dom $($dom.Length) bytes) $peek")
    return 1
  }
  $items = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) -split ' ;; '
  $pass = @($items | Where-Object { $_ -like 'PASS *' }).Count
  $fail = @($items | Where-Object { $_ -notlike 'PASS *' })
  $summary.Add(("{0}: {1} PASS, {2} FAIL" -f $label, $pass, $fail.Count))
  $fail | ForEach-Object { $summary.Add("  $_") }
  try { Remove-Item -LiteralPath $prof -Recurse -Force -ErrorAction SilentlyContinue } catch {}
  return $fail.Count
}
Write-Host "[3/17] report-page half (mainframe.html) ..."
$failTotal += (RunPage 'mainframe.html' 'mainframe.html')
Write-Host "[4/17] dashboard half (dash.html) ..."
$failTotal += (RunPage 'dash.html' 'dash.html')
Write-Host "[5/17] Visual Search Builder on the dashboard (builder.html) ..."
$failTotal += (RunPage 'builder.html' 'builder.html')
Write-Host "[6/17] Controls tile (controls.html) ..."
$failTotal += (RunPage 'controls.html' 'controls.html')
Write-Host "[7/17] Controls tile opened under a filter (controls2.html) ..."
$failTotal += (RunPage 'controls2.html' 'controls2.html')
Write-Host "[8/17] the short form at load (dashlead.html) ..."
$failTotal += (RunPage 'dashlead.html' 'dashlead.html')
Write-Host "[9/17] the column envelope (dashcols.html) ..."
$failTotal += (RunPage 'dashcols.html' 'dashcols.html')
Write-Host "[10/17] the default filter (dashdefault.html) ..."
$failTotal += (RunPage 'dashdefault.html' 'dashdefault.html')
Write-Host "[11/17] an empty search= wins over the default (dashdefault2.html) ..."
$failTotal += (RunPage 'dashdefault2.html' 'dashdefault2.html')
Write-Host "[12/17] range fields on the Controls tile (controls3.html) ..."
$failTotal += (RunPage 'controls3.html' 'controls3.html')
Write-Host "[13/17] the (blank) chip on the Controls tile (controls4.html) ..."
$failTotal += (RunPage 'controls4.html' 'controls4.html')
Write-Host "[14/17] a kiosk=1 address opens kiosk view directly (kiosk.html) ..."
$failTotal += (RunPage 'kiosk.html' 'kiosk.html')
Write-Host "[15/17] chip counts on the Controls tile (controls5.html) ..."
$failTotal += (RunPage 'controls5.html' 'controls5.html')
Write-Host "[16/17] search links route to the dashboard filter (xflink.html) ..."
$failTotal += (RunPage 'xflink.html' 'xflink.html')
Write-Host "[17/17] the list option on the Controls tile (controls6.html) ..."
$failTotal += (RunPage 'controls6.html' 'controls6.html')

$summary.Add("TOTAL FAILED: $failTotal")
[IO.File]::WriteAllLines("$here\summary.txt", $summary)
$summary | ForEach-Object { Write-Host $_ }
if ($failTotal -gt 0) { exit 1 }
