/**
 * penumbra_dashboard.js - the cross-report dashboard viewer + builder.
 *
 * Loaded ONLY by dashboard.php (never by index.php). Reads its boot payload from
 * the top-level `penumbra_dash_vars` const the page emits.
 *
 * Since 2026-08-23 everything that interprets ROWS - text/number helpers,
 * aggregation, the stat/chart/table renderers, fetching, embed URLs - lives in
 * js/penumbra_tiles.js (window.PenumbraTiles), loaded just before this file and
 * ALSO by index.php for the report infobox's tile|/embed| modes. One engine,
 * two hosts. This module owns the grid, the builder and the kiosk: chrome, not
 * data. Sources: live (?json=1), snapshot, url (same-origin JSON), inline JSON.
 *
 * Data model (STATE_DATA):
 *   { version:1, rowH:68, theme:'theme-...', refreshSeconds:0, tiles:[
 *       { id:'t1', type:'stat|chart|table|note', report:'shortid', label:'',
 *         w:1-12, h:rows of rowH px (2 = the pre-09-05 150px row; states without
 *         rowH are migrated on load), source:'live|snapshot', prompts:{name:value},
 *         agg:'count|distinct|sum|avg|min|max', column:'COL', format:'number|currency|percent|raw',
 *         chartType:'bar|line|pie|doughnut', groupBy:'COL', valueAgg:'count|sum|avg',
 *         valueColumn:'COL', topN:10, columns:['A','B'], rows:10, text:'' } ] }
 *
 * Every tile's data is fetched with the VIEWER'S OWN session:
 *   live      -> index.php?id=<report>&json=1&<prompt>=<value>...   ({data:[rows]})
 *   snapshot  -> manage_snapshots.php action=list (newest) then action=load
 * so a tile whose source the viewer cannot open fails closed to a per-tile message.
 * This module never receives anyone else's rights.
 *
 * Cell values from ?json=1 arrive ENTITY-ENCODED (query.php encodes every cell -
 * the same rule every machine sink follows), so aggregation/labels decode first
 * and rendering re-escapes.
 */
(function () {
    'use strict';

    if (typeof penumbra_dash_vars === 'undefined') { return; }
    var V = penumbra_dash_vars;

    // =========================================================================
    // Small helpers
    // =========================================================================
    // The shared data->tile engine (js/penumbra_tiles.js). The local names below
    // are aliases so the rest of this file reads as before; the implementations
    // are shared with the report infobox and must never be re-copied here.
    var T = window.PenumbraTiles;
    if (!T) { return; }
    var escapeHtml = T.escapeHtml;
    // Full page-theme swap: the theme class PLUS the marker set main.js's
    // applyTheme() writes (data-theme, is-dark, registry-theme). V.themes rows
    // carry isDark/modern, so cycling a dark dashboard -> a light one can
    // never strand 'is-dark' on the body.
    function applyPageTheme(themeId) {
        var row = null;
        for (var i = 0; i < (V.themes || []).length; i++) {
            if (V.themes[i].id === themeId) { row = V.themes[i]; break; }
        }
        if (!row) { themeId = 'theme-default'; }
        document.body.className = document.body.className
            .replace(/\btheme-[\w-]+\b/g, ' ').replace(/\bis-dark\b/g, ' ').replace(/\bregistry-theme\b/g, ' ')
            .replace(/\s+/g, ' ').trim()
            + ' ' + themeId
            + (row && row.isDark ? ' is-dark' : '')
            + (row && row.modern ? ' registry-theme' : '');
        document.body.setAttribute('data-theme', themeId);
    }
    var decodeEntities = T.decodeEntities;
    var cellText = T.cellText;
    var cellSpecialHtml = T.cellSpecialHtml;
    var toNumber = T.toNumber;
    var fmtNumber = T.fmtNumber;
    var fmtValue = T.fmtValue;
    var cssVar = T.cssVar;
    var REDUCED_MOTION = T.reducedMotion();
    function uid() { return 't' + Math.random().toString(36).substring(2, 8); }

    // Kiosk mode (?kiosk=1): chrome-free wall display. View-only by construction -
    // the header (and with it every builder entry point) is hidden, and auto-refresh
    // gets a sensible default so an unattended screen stays current.
    var KIOSK = /[?&]kiosk=1(&|$)/.test((V.urlSearchOverride != null) ? String(V.urlSearchOverride) : String(window.location.search || ''));
    var KIOSK_DEFAULT_REFRESH = 300;

    // Pinned dashboards (home screen + the landing page strip in index.php read the
    // same key). Stored client-side: a pin is a personal bookmark, not shared state.
    var PIN_KEY = 'penumbra_dash_pins';
    function loadPins() {
        try { var p = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); return Object.prototype.toString.call(p) === '[object Array]' ? p : []; }
        catch (e) { return []; }
    }
    function savePins(p) { try { localStorage.setItem(PIN_KEY, JSON.stringify(p)); } catch (e) {} }

    // =========================================================================
    // State
    // =========================================================================
    var DASH = (V.state && typeof V.state === 'object') ? V.state
             : { version: 1, theme: 'theme-default', refreshSeconds: 0, tiles: [] };
    if (!DASH.tiles) { DASH.tiles = []; }
    var META = V.meta || { short_id: '', title: '', authorized: V.currentUserKey, owner_id: V.currentUserKey };
    META.tagsBase = Array.isArray(META.tags) ? META.tags.slice() : [];   // the list the page loaded (2026-10-09): a save posts it, so only this page's own changes move

    // -------------------------------------------------------------------------
    // URL parameters -> every tile (owner, 2026-09-05). Anything in the page's
    // own query string that is not the dashboard's (id, kiosk) or a report view
    // control (the embed reserved list: theme, fspages, via...) is a PROMPT
    // ANSWER for every tile at once. The URL wins over a tile's own stored value
    // - the rule ?theme= already follows. A name no report asks for is ignored by
    // that report, so nothing here needs to know which tiles it applies to.
    // ?search= is the one view control that rides too: it pre-filters every
    // framed report AND every data tile - index.php's ?json=1 path runs the same
    // search engine on the server (penumbra_search.php, since 2026-09-05). The
    // kiosk URL rewrites carry the parameters forward, so a bookmarked or cycling
    // kiosk keeps them.
    // V.urlSearchOverride exists for the harness (a page cannot fake its URL).
    // -------------------------------------------------------------------------
    var URL_PROMPTS = {}, URL_SEARCH = '', URL_SEARCH_SET = false;   // URL_SEARCH_SET: the address carried search= (even empty)
    (function () {
        var qs = (V.urlSearchOverride != null) ? String(V.urlSearchOverride) : String(window.location.search || '');
        var reserved = $.extend({ id: 1, kiosk: 1 }, T.EMBED_RESERVED || {});
        qs.replace(/^\?/, '').split('&').forEach(function (pair) {
            if (!pair) { return; }
            var i = pair.indexOf('='), k = (i === -1) ? pair : pair.substring(0, i), v = (i === -1) ? '' : pair.substring(i + 1);
            try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (e) {}
            try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e2) {}
            if (!k) { return; }
            if (k.toLowerCase() === 'search') { URL_SEARCH = v; URL_SEARCH_SET = true; return; }
            if (reserved[k.toLowerCase()]) { return; }
            URL_PROMPTS[k] = v;
        });
    })();
    // The address note lists prompt answers; the dashboard filter box shows ?search= (2026-09-29).
    function urlParamCount() { return Object.keys(URL_PROMPTS).length; }
    // The page's own URL for a dashboard, the parameters carried forward.
    function dashPageUrl(shortId, kiosk) {
        var parts = [];
        if (shortId) { parts.push('id=' + encodeURIComponent(shortId)); }
        if (kiosk) { parts.push('kiosk=1'); }
        for (var k in URL_PROMPTS) { if (Object.prototype.hasOwnProperty.call(URL_PROMPTS, k)) { parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(URL_PROMPTS[k])); } }
        // The address IS the filter - except the dashboard's own default filter
        // (2026-09-30), which a clean address applies for each viewer (its me()
        // words resolve per viewer, so a shared link must not carry one viewer's
        // value): the default is left out, and a box cleared on such a dashboard
        // writes an empty search= so a reload keeps it cleared.
        var def = defaultFilterText();
        if (URL_SEARCH && URL_SEARCH !== def) { parts.push('search=' + encodeURIComponent(URL_SEARCH)); }
        else if (!URL_SEARCH && def) { parts.push('search='); }
        return 'dashboard.php' + (parts.length ? '?' + parts.join('&') : '');
    }
    // A tile's effective prompt answers: its own, with the URL's on top.
    function effPrompts(tile) {
        if (!Object.keys(URL_PROMPTS).length) { return tile.prompts || {}; }
        return $.extend({}, tile.prompts || {}, URL_PROMPTS);
    }
    // A shallow copy of the tile as the engine should see it: effective prompts,
    // the URL search on a framed report, and the label with its tokens resolved.
    function effTile(tile) {
        var t = $.extend({}, tile);
        t.prompts = effPrompts(tile);
        // The tile's own search and the dashboard filter (2026-09-29, see
        // "Dashboard search" below): plain text when there is no dashboard
        // filter, a routed fragment list when there is.
        var ss = tileSearchSpec(tile);
        t.search = ss.search;
        t.dsearch = ss.dsearch;
        t.label = tileLabel(tile);
        return t;
    }

    // -------------------------------------------------------------------------
    // Dashboard search (2026-09-29). One filter for the whole dashboard: the
    // search text in the page's own address (?search=), typed into the header
    // box. Each tile receives it as a FRAGMENT LIST (&dsearch=, JSON {p: modifier
    // prefix, f: [[COLUMN or '', text], ...]}, built by PenumbraTiles.splitSearch)
    // rather than as plain text, and the side that knows the tile's real columns
    // keeps only the fragments whose column that report has: index.php's ?json=1
    // path for stat/chart/table tiles, the framed report page (main.js
    // penumbraRouteDashSearch) for embeds. Both report the skipped columns, and
    // the note under the box names every tile the filter does not reach. Sent as
    // plain text, a condition on a missing column is a literal comparison in both
    // search engines - COLLEGE = Eng on a report without COLLEGE matches NO row -
    // so one filter would blank every tile that cannot answer it.
    //   - A tile's own stored search stays; the dashboard filter is ANDed onto it.
    //     When the tile's own filter uses `or` (or a leading __ROW-style
    //     modifier) the two cannot be joined in this grammar, so the tile keeps
    //     its own filter and the note says the dashboard's did not reach it.
    //   - A dashboard filter that itself uses `or` cannot be routed fragment by
    //     fragment either: it goes to every tile as one fragment, as typed
    //     (replacing a tile's own filter - the pre-2026-09-29 rule), and the
    //     note warns that a tile whose report lacks one of its columns shows no
    //     rows.
    //   - Embeds are filtered IN PLACE through the framed page's
    //     Penumbra.applyDashboardSearch (no reload, no query re-run); a chart or
    //     slide tile, or a page that has not loaded yet, reloads with the new
    //     address instead.
    // -------------------------------------------------------------------------
    var _dashSplit = { text: null, parts: null };
    // The columns the tiles are known to have, as one UPPER-cased set (a framed
    // report's own list through its page's _penumbraSearchAPI, a data tile's
    // rows as last seen, nested sub-table columns, '#'): rebuilt when a tile
    // answers (tileColsChanged), read by fragCol.
    var _colsUnion = null, _colsUnionVer = 0, _colsUnionBuilt = -1, _leadTimer = null;
    function colsUnion() {
        if (_colsUnion && _colsUnionBuilt === _colsUnionVer) { return _colsUnion; }
        var u = Object.create(null);
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tc = tileBuilderCols(DASH.tiles[i]);
            for (var k in (tc ? tc.upper : {})) { u[k] = true; }
        }
        _colsUnion = u; _colsUnionBuilt = _colsUnionVer;
        return u;
    }
    function tileColsChanged() {
        _colsUnionVer++;
        clearTimeout(_leadTimer);
        _leadTimer = setTimeout(rerouteLeads, 250);
    }
    // The column a fragment is routed by (2026-09-30): the leading column of an
    // operator form (COLLEGE = Eng), or the leading name of the SHORT form
    // (COLLEGE Eng: contains, splitSearch's lead) when some tile has that
    // column. A short form whose leading word no tile has stays a global term
    // on every tile (Chemistry grant), as both search engines read it.
    function fragCol(f) {
        if (f.col) { return f.col; }
        return (f.lead && colsUnion()[f.lead]) ? f.lead : '';
    }
    // A short form goes out as a global term until a tile that has its column
    // has answered (at load, none has): then it routes by that column, and every
    // tile whose list would now differ is sent again. A tile that HAS the
    // column keeps what it shows (both routers apply the same text either way),
    // so only the tiles that lack it move: from a search of every cell for the
    // words, which matched nothing and read as 0 rows, to "not filtered" with
    // the reason.
    var _tileSearchSent = {};   // tileId -> the search key it was last sent with
    function rerouteLeads() {
        _leadTimer = null;
        if (!URL_SEARCH) { return; }
        var dash = dashSearchParts();
        if (!dash || dash.or) { return; }
        var leads = dash.fragments.filter(function (f) { return !f.col && f.lead; });
        if (!leads.length) { return; }
        var moved = false;
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            if (tl.type === 'note' || tl.type === 'trend' || tl.type === 'controls' || tileStaticReach(tl) || !(tl.id in _tileSearchSent)) { continue; }
            var key = tileSearchKey(tl);
            if (key === _tileSearchSent[tl.id]) { continue; }
            var $t = $('#dashMain .dash-tile[data-tile-id="' + tl.id + '"]');
            if (!$t.length) { continue; }
            var tc = tileBuilderCols(tl), same = !!tc;
            for (var j = 0; same && j < leads.length; j++) {
                var c = fragCol(leads[j]);
                if (c && !(c in tc.upper)) { same = false; }
            }
            if (same) { _tileSearchSent[tl.id] = key; continue; }
            moved = true;
            if (tl.type === 'embed') { applySearchToEmbed($t, tl); } else { renderTileInto($t, tl); }
        }
        if (moved) { renderDashSearchNote(); }
    }
    function dashSearchParts() {
        if (_dashSplit.text !== URL_SEARCH) {
            _dashSplit.text = URL_SEARCH;
            _dashSplit.parts = URL_SEARCH ? T.splitSearch(URL_SEARCH) : null;
        }
        return (_dashSplit.parts && _dashSplit.parts.fragments.length) ? _dashSplit.parts : null;
    }
    // What a tile is sent: { search: plain text or '', dsearch: fragment-list
    // JSON or '', note: why the dashboard filter does not reach it, or '' }.
    function tileSearchSpec(tile) { return searchSpecFor(tile, dashSearchParts(), URL_SEARCH); }
    // The same for any split filter (dash) and its text: the Visual Search
    // Builder's count line asks about a filter that is not applied yet.
    function searchSpecFor(tile, dash, text) {
        var own = String(tile.search || '').trim();
        if (!dash) { return { search: own, dsearch: '', note: '' }; }
        if (dash.or) {
            return { search: '', dsearch: JSON.stringify({ p: '', f: [['', text]] }), note: '' };
        }
        var f = [];
        if (own) {
            var mine = T.splitSearch(own);
            if (mine.or || mine.prefix) {
                return { search: own, dsearch: '', note: 'its own filter uses ' + (mine.or ? '"or"' : 'a modifier') + ', so the two cannot be combined' };
            }
            f.push(['', own]);
        }
        for (var i = 0; i < dash.fragments.length; i++) { f.push([fragCol(dash.fragments[i]), dash.fragments[i].text]); }
        return { search: '', dsearch: JSON.stringify({ p: dash.prefix || '', f: f }), note: '' };
    }
    function tileSearchKey(tile) {
        var ss = tileSearchSpec(tile);
        return ss.search + '\u0001' + ss.dsearch;
    }
    // The options every embed URL is built with (renderTileInto, the in-place
    // apply and refreshTile must agree, or a reload would change the address).
    function embedOpts() {
        return { theme: DASH.theme, fstheme: DASH.theme || 'theme-default', via: 'dashboard ' + (META.short_id || V.shortId || '') };
    }

    var _tileSearchSkipped = {};   // tileId -> columns the tile's report lacks (from its fetch or its frame)
    var _tileRenderTok = {};       // tileId -> newest data render; an older fetch landing late is dropped
    function noteTileSearch(tile, skipped) {
        _tileSearchSkipped[tile.id] = (Object.prototype.toString.call(skipped) === '[object Array]') ? skipped.slice() : [];
        renderDashSearchNote();
    }
    // Why no dashboard filter can reach a tile, whatever it says ('' = one
    // can): the tile does not read a live report.
    function tileStaticReach(tile) {
        if (tile.type === 'trend') { return 'it plots snapshot history'; }
        if (tile.type !== 'embed') {
            var src = T.effectiveSource(tile);
            if (src === 'snapshot') { return 'it reads a snapshot'; }
            if (src === 'url') { return 'it reads a JSON address'; }
            if (src === 'inline') { return 'it holds inline data'; }
        }
        return '';
    }
    // '' when the dashboard filter reaches the tile (or there is none);
    // otherwise a short reason it cannot.
    function tileSearchReach(tile) {
        if (!URL_SEARCH || tile.type === 'note') { return ''; }
        var st = tileStaticReach(tile);
        if (st) { return st; }
        var ss = tileSearchSpec(tile);
        if (ss.note) { return ss.note; }
        var sk = _tileSearchSkipped[tile.id];
        if (sk && sk.length) { return 'its report has no ' + sk.join(', ') + (sk.length > 1 ? ' columns' : ' column'); }
        return '';
    }
    function markTileReach(tile, why) {
        var $t = $('#dashMain .dash-tile[data-tile-id="' + tile.id + '"]');
        if (!$t.length) { return; }
        $t.toggleClass('dash-tile-unfiltered', !!why);
        var $b = $t.find('.dash-nofilter-badge');
        if (!why) { $b.remove(); return; }
        var $h = $t.find('.dash-tile-head');
        if (!$h.length) { return; }   // bare sectional embeds: the note under the filter box carries it
        if (!$b.length) { $b = $('<span class="dash-nofilter-badge"></span>').appendTo($h); }
        var tip = 'The dashboard filter does not reach this tile: ' + why + '.';
        $b.attr('title', tip).html('not filtered<span class="sr-only">. ' + escapeHtml(tip) + '</span>');
    }
    function renderDashSearchNote() {
        var parts = [];
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i], why = tileSearchReach(tl);
            markTileReach(tl, why);
            if (why) { parts.push(tileLabel(tl) + ' (' + why + ')'); }
        }
        var $n = $('#dashFilterNote');
        if (!$n.length) { return; }
        var dash = dashSearchParts();
        var lines = [];
        if (!URL_SEARCH && _defaultFilterMissing.length) {
            lines.push('The dashboard\'s default filter uses me(' + _defaultFilterMissing.join('), me(') + '), which has no value for you, so it is not applied.');
        }
        if (dash && dash.or) {
            lines.push('A filter with "or" goes to every tile as typed; a tile whose report lacks one of its columns shows no rows.');
        }
        if (parts.length) { lines.push('Not filtered: ' + parts.join(' \u00b7 ') + '.'); }
        $n.text(lines.join(' '));
    }

    // The header box. Mounted once per page (renderHead rebuilds the title and
    // the buttons, never this), so typing and focus survive every re-render.
    function mountDashFilter() {
        if ($('#dashFilter').length || !V.shortId || !V.found) { return; }
        var kh = keyHints();
        $('<div class="dash-filter" id="dashFilter" role="search" aria-label="Filter the dashboard">' +
            '<div class="dash-filter-box">' +
            '<button type="button" class="dash-filter-btn dash-filter-sb" id="dashSearchBuilder" ' +
            'title="Visual Search Builder: compose the filter from conditions' + (kh.tip('/') ? ' (/ in the empty box)' : '') + '" ' +
            'aria-label="Open the Visual Search Builder"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg></button>' +
            '<input type="text" id="dashSearchInput" autocomplete="off" spellcheck="false" ' +
            'placeholder="Filter every tile, e.g. COLLEGE = Engineering" ' +
            'title="The report search syntax, applied to every tile whose report has the column. Double-click or Ctrl+Space for suggestions; Enter applies it' + kh.tip('/') + '"' + kh.attr('/') +
            ' aria-describedby="dashFilterNote">' +
            '<button type="button" class="dash-filter-btn" id="dashSearchGo" title="Apply the filter (Enter)" aria-label="Apply the filter">&#9654;&#xFE0E;</button>' +
            '<button type="button" class="dash-filter-btn" id="dashSearchClear" title="Clear the filter" aria-label="Clear the filter">&times;</button>' +
            // The column arrow (2026-10-06), as on a report's search bar: every column the tiles offer.
            '<button type="button" class="dash-filter-btn dash-filter-cols" id="dashSearchCols" title="(Alt+Down) Show the columns" aria-label="Show the columns">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg></button>' +
            '<button type="button" class="dash-filter-btn dash-filter-help" id="dashSearchHelp" title="Search help: the syntax the filter uses" aria-label="Search help">?</button>' +
            '</div>' +
            '<div class="dash-filter-note" id="dashFilterNote" aria-live="polite"></div>' +
          '</div>').insertBefore('#dashHeadActions');
        syncDashFilterBox(true);
    }
    function syncDashFilterBox(force) {
        var $in = $('#dashSearchInput');
        if (!$in.length) { return; }
        if (force) { $in.val(URL_SEARCH); }
        var val = String($in.val() || '').trim();
        $('#dashFilter').toggleClass('dash-filter-active', !!URL_SEARCH).toggleClass('dash-filter-dirty', val !== URL_SEARCH);
        $('#dashSearchClear').toggleClass('dash-filter-hide', !val && !URL_SEARCH);
        // Apply, as the report bar's run: nothing to apply in an empty box with
        // no filter on (2026-10-13). An applied filter emptied in the box keeps
        // it - applying the empty box takes the filter off.
        $('#dashSearchGo').toggleClass('dash-filter-hide', !val && !URL_SEARCH);
        // The column arrow and the clear share the box's edge (2026-10-06): the
        // arrow while there is no search, the clear once there is one.
        syncDashArrow();
        controlsFollowBox();
    }
    // Except while the search ENDS with a column that has a value list
    // (2026-10-13): then the arrow lists that column's values (search_builder.js
    // showColumnList) and shows beside the clear. Also run on a hover over the
    // box and on focus: the engine and the tiles' columns load after the box.
    var _dashArrowText = null;
    function syncDashArrow(force) {
        var $in = $('#dashSearchInput');
        if (!$in.length) { return; }
        var raw = String($in.val() || ''), val = raw.trim();
        var key = raw + '\u0000' + URL_SEARCH;   // the hide also follows the applied filter
        if (!force && key === _dashArrowText) { return; }
        _dashArrowText = key;
        var sb = window._penumbraSearchBuilder;
        var trailCol = (val && sb && typeof sb.trailingColumn === 'function') ? sb.trailingColumn('#dashSearchInput') : '';
        $('#dashSearchCols').toggleClass('dash-filter-hide', !!(val || URL_SEARCH) && !trailCol)
            .attr('title', trailCol ? '(Alt+Down) Show the values of ' + trailCol : '(Alt+Down) Show the columns')
            .attr('aria-label', trailCol ? 'Show the values of ' + trailCol : 'Show the columns');
    }
    $(document).on('mouseenter', '#dashFilter .dash-filter-box', function () { syncDashArrow(true); });
    $(document).on('focus', '#dashSearchInput', function () { syncDashArrow(true); });
    function applyDashSearch(text) {
        text = resolveMeTokens(String(text == null ? '' : text)).trim();   // me(ouc) and the other me() words resolve for this viewer (2026-09-30)
        if (text === URL_SEARCH) { syncDashFilterBox(true); renderAllControls(); return; }
        URL_SEARCH = text;
        _tileSearchSkipped = {};
        // The address IS the filter: a bookmark or a shared link reopens it.
        try { history.replaceState(history.state, '', dashPageUrl(META.short_id || V.shortId, KIOSK)); } catch (e) { }
        renderHead();   // the title and subtitle may name data(search)
        var via = { via: 'dashboard ' + (META.short_id || V.shortId || '') };
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            var $t = $('#dashMain .dash-tile[data-tile-id="' + tl.id + '"]');
            if (!$t.length || tl.type === 'note' || tl.type === 'trend' || tl.type === 'controls') { continue; }
            if (tl.report) { $t.find('.dash-tile-open').attr('href', T.openUrl(effTile(tl), via)); }
            if (tl.type === 'embed') { applySearchToEmbed($t, tl); }
            else {
                // Reuse a same-key fetch only while fresh (refreshTile's 15s rule):
                // clearing a filter after ten minutes must not bring back
                // ten-minute-old rows.
                var fk = tileFetchKey(tl), ent = dataCache[fk];
                if (ent && !(ent.at && (Date.now() - ent.at) < 15000)) { delete dataCache[fk]; }
                renderTileInto($t, tl);
            }
        }
        syncDashFilterBox(true);
        renderAllControls();   // after the box is set: their state is the box
        renderDashSearchNote();
        dashAnnounce(text ? 'Dashboard filter applied.' : 'Dashboard filter cleared.');
    }
    function applySearchToEmbed($tile, tile) {
        var fr = $tile.find('iframe.dash-embed')[0];
        if (!fr) { renderTileInto($tile, tile); return; }
        var et = effTile(tile);
        var want = T.embedUrl(et, embedOpts());
        // A chart or slide tile is the report's carousel, drawn once from the
        // filtered rows: it reloads with the new address instead.
        if (tile.show !== 'chart') {
            var w = null, api = null;
            try { w = fr.contentWindow; api = w && w.Penumbra ? w.Penumbra.applyDashboardSearch : null; } catch (e) { api = null; }
            if (typeof api === 'function') {
                var took = false;
                try { took = (api.call(w.Penumbra, { dsearch: et.dsearch || '', search: et.search || '' }) === true); } catch (e2) { took = false; }
                if (took) {
                    // A later reload (auto-refresh, Refresh) must come back with THIS filter.
                    try { w.history.replaceState(w.history.state, '', want); } catch (e3) { }
                    _tileSearchSent[tile.id] = tileSearchKey(tile);
                    return;
                }
            }
        }
        renderTileInto($tile, tile);   // not loaded yet, a chart stage, or a page without the hook
    }
    // -------------------------------------------------------------------------
    // Controls tile (2026-09-29): the report's filter_strip() chips and filter|
    // switches, for the whole dashboard. It holds no data and filters nothing
    // itself: its chips and switches WRITE the dashboard filter (the header
    // box) and read their pressed state back from the box, in the report's own
    // grammar (PenumbraTiles.strip, shared with main.js), so a hand-edited or
    // cleared box moves them too. The filter then reaches each tile as any
    // typed filter does: only the tiles whose report has the column.
    //   tile.strip    the filter_strip() argument list, verbatim
    //                 ('College|COLLEGE', 'Status|STATUS|exclude|top=8', 'segmented')
    //   tile.toggles  [{ label, cond }]: each switch puts one condition into the
    //                 filter while on and takes only that one out when off (the
    //                 report's filter|COND / unfilter|COND)
    // Chips are the values the tiles hold for the column - the same union the
    // box's suggestions list - in A to Z order, WITHOUT counts: a count across
    // tiles that read different reports would not mean anything. A filter with
    // a top-level `or` pauses them, as on a report: a condition joined with
    // `and` would bind to one side of the `or` only.
    // -------------------------------------------------------------------------
    var _ctlExpanded = {};   // tileId -> { COL: true } while that group's "+n more" is open
    var _ctlFind = {};       // tileId -> { COL: text } typed into a list field's find box (the list option, 2026-10-01)
    // The box, when this page has one; the applied filter otherwise.
    function dashBoxText() {
        var $in = $('#dashSearchInput');
        return $in.length ? String($in.val() || '') : URL_SEARCH;
    }
    function controlsSpec(tile) {
        return (Array.isArray(tile.strip) && tile.strip.length) ? T.strip.parseArgs(tile.strip) : null;
    }
    // A range field's kind and hints (2026-09-30) come from the values the
    // tiles hold - the same union as the chips - and are set on the field
    // BEFORE the state is read: a bound is read as that kind.
    function controlsKinds(spec) {
        var out = Object.create(null);
        if (!spec || spec.error) { return out; }
        spec.fields.forEach(function (f) {
            if (!f.range) { return; }
            var col = String(f.col).toUpperCase(), ri = T.strip.rangeInfo(dashColumnValues(col) || []);
            f.kind = ri.kind;
            out[col] = ri;
        });
        return out;
    }
    function controlsState(spec) {
        controlsKinds(spec);
        return T.strip.state(dashBoxText(), spec.fields);
    }
    // Chip counts (2026-10-01). A count is only honest when every tile that has
    // the column reads ONE report (and prompt set): then it is how many of that
    // report's rows hold the value and pass the rest of the filter - the
    // strip's rule on the report page. The dashboard evaluates no grammar of
    // its own: with nothing else filtering the group the full unfiltered rows
    // a tile or the fill read already holds are counted; otherwise ONE capped
    // read per group goes through the server with the other conditions routed
    // as any tile's are, cached until a refresh. None across reports, none on
    // a capped read (a partial count would mislead), none while a read is out.
    var _ctlCountRows = Object.create(null);   // report|prompts\u0001others -> { rows, capped } or { pending }
    function controlsSource(col) {
        var cu = String(col).toUpperCase(), key = null, tile = null, name = null;
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i], tc = tileBuilderCols(tl);
            if (!tc || !(cu in tc.upper) || !tl.report) { continue; }
            var k = rowsSeenKey(tl);
            if (key === null) { key = k; tile = tl; name = tc.upper[cu]; }
            else if (k !== key) { return null; }   // the column spans reports: one number could not mean anything
        }
        return key === null ? null : { key: key, tile: tile, name: name };
    }
    function controlsCounts(col, spec, st) {
        var src = controlsSource(col);
        if (!src) { return null; }
        var cu = String(col).toUpperCase();
        var others = { prefix: st.prefix || '', sel: {}, range: st.range || {}, rest: st.rest || [], or: false };
        spec.fields.forEach(function (g) {
            var gc = String(g.col).toUpperCase();
            if (gc !== cu && st.sel[gc] && st.sel[gc].length) { others.sel[gc] = st.sel[gc]; }
        });
        var text = T.strip.compose(others, spec.fields), rows = null;
        if (!text) {
            var seen = _rowsSeen[src.key];
            if (!seen || seen.score !== 7) { return null; }   // filtered, an excerpt or a capped read: not the whole report
            rows = seen.rows;
        } else {
            var ck = src.key + '\u0001' + text, had = _ctlCountRows[ck];
            if (!had) {
                had = _ctlCountRows[ck] = { pending: true };
                var ss = searchSpecFor({ report: src.tile.report, prompts: src.tile.prompts }, T.splitSearch(text), text);
                T.fetchRows({ source: 'live', report: src.tile.report, prompts: effPrompts(src.tile), limit: CTL_FILL_LIMIT, search: ss.search, dsearch: ss.dsearch })
                    .then(function (res) {
                        _ctlCountRows[ck] = { rows: res.rows, capped: (typeof res.totalRows === 'number') && res.totalRows > res.rows.length };
                        scheduleControls();
                    })
                    .catch(function () { _ctlCountRows[ck] = { rows: null }; });
            }
            if (had.pending || !had.rows || had.capped) { return null; }
            rows = had.rows;
        }
        var out = Object.create(null);
        for (var r = 0; r < rows.length; r++) {
            var v = builderCellValue(T.getCell(rows[r], src.name));
            if (v === null) { continue; }
            var lk = v.toLowerCase();
            out[lk] = (out[lk] || 0) + 1;
        }
        return out;
    }
    function controlsGroups(spec, st, rinfo) {
        var byValue = function (a, b) { return a.v.localeCompare(b.v, undefined, { numeric: true, sensitivity: 'base' }); };
        var counts = spec.mods.indexOf('nocounts') === -1;
        return spec.fields.map(function (f) {
            var col = String(f.col).toUpperCase(), idx = Object.create(null), list = [];
            if (f.range) {
                var ri = (rinfo && rinfo[col]) || { kind: '', lo: '', hi: '' }, rg = (st.range && st.range[col]) || { min: '', max: '' };
                return { field: f, values: [], range: { kind: ri.kind, lo: ri.lo, hi: ri.hi, min: rg.min, max: rg.max } };
            }
            var dv = dashColumnValues(col);
            (dv || []).forEach(function (v) {
                var k = String(v).toLowerCase();
                if (!idx[k]) { idx[k] = { v: String(v), n: null, on: false }; list.push(idx[k]); }
            });
            // The (blank) chip (2026-09-30): once a tile has answered, a field
            // with the blank option offers the rows whose cell is empty.
            if (f.blank && dv) { idx[''] = { v: '', n: null, on: false }; list.push(idx['']); }
            // A pressed value no tile holds (a filter typed or bookmarked
            // earlier) still gets a chip, so it can be released.
            (st.sel[col] || []).forEach(function (sv) {
                var k = String(sv).toLowerCase();
                if (!idx[k]) { idx[k] = { v: String(sv), n: null, on: true }; list.push(idx[k]); }
                idx[k].on = true;
            });
            list.sort(byValue);
            if (idx['']) { list.splice(list.indexOf(idx['']), 1); list.push(idx['']); }   // the (blank) chip last, whatever the order
            var cnt = counts ? controlsCounts(col, spec, st) : null;
            if (cnt) { list.forEach(function (e) { e.n = cnt[String(e.v).toLowerCase()] || 0; }); }
            return { field: f, values: list };
        });
    }
    // Draws one Controls tile from the box. Returns true while a chip group
    // has no values yet (its tiles are still loading). An unchanged drawing
    // leaves the DOM alone, so a re-read never moves focus or a hover.
    function renderControlsInto($tile, tile) {
        var text = dashBoxText(), off = T.splitTopLevel(text).or ? 'or' : null;
        var spec = controlsSpec(tile), html = '', waiting = false;
        var rinfo = controlsKinds(spec);
        var textRange = Object.keys(rinfo).filter(function (c) { return rinfo[c].kind === 'text'; });
        if (spec && spec.error) {
            html += '<div class="dash-tile-err">' + escapeHtml('Filter chips: ' + spec.error) + '</div>';
        } else if (textRange.length) {
            // A range compares numbers or dates; on a text column both search
            // engines fall back to text and match nothing (the report's rule).
            html += '<div class="dash-tile-err">' + escapeHtml('Filter chips: ' + textRange.join(', ') + ' holds text, so it cannot be a range (a range needs numbers or dates)') + '</div>';
        } else if (spec) {
            var st = off ? { prefix: '', sel: {}, range: {}, rest: [], or: false } : T.strip.state(text, spec.fields);
            var groups = controlsGroups(spec, st, rinfo);
            waiting = groups.some(function (g) { return g.range ? !g.range.kind : !g.values.length; });
            html += T.strip.render(spec, { off: off, groups: groups }, _ctlExpanded[tile.id] || {}, { where: 'dashboard', emptyText: 'no values yet', find: _ctlFind[tile.id] || {} });
        }
        var tgs = Array.isArray(tile.toggles) ? tile.toggles : [];
        if (tgs.length) {
            html += '<div class="dash-ctl-toggles">' + tgs.map(function (x, i) {
                var cond = String((x && x.cond) || '').trim(), on = !off && !!cond && T.strip.has(text, cond);
                return '<span class="pnb-toggle" data-ts-on="' + (on ? '1' : '0') + '" data-ts-label="left">' +
                    '<button type="button" class="pnb-toggle-btn" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-ctl-i="' + i + '"' +
                    ' title="' + escapeHtml(cond) + '"' + (off ? ' disabled' : '') + '>' +
                    '<span class="pnb-toggle-label">' + escapeHtml((x && x.label) || cond) + '</span>' +
                    '<span class="sp-switch" aria-hidden="true"></span></button></span>';
            }).join('') + '</div>';
            if (off && !spec) { html += '<span class="pnb-fs-note">' + escapeHtml(T.strip.offNote('or', 'dashboard')) + '</span>'; }
        }
        if (!html) {
            html = '<div class="dash-ctl-empty">No filter chips or switches yet' + (editMode ? ': edit this tile to add them.' : '.') + '</div>';
        }
        html = '<div class="dash-controls">' + html + '</div>';
        // Never over a range pair being typed in: while focus is in the pair,
        // a box whose text differs from what was drawn is not written yet (the
        // other box of the pair included - Tab from one to the other). A commit
        // marks its boxes drawn (controlsCommitRange), so its redraw goes ahead.
        var aeGrp = $(document.activeElement).closest('.pnb-fs-range')[0];
        if (aeGrp && $.contains($tile[0], aeGrp) && $(aeGrp).find('.pnb-fs-bound').filter(function () { return this.value !== this.defaultValue; }).length) { return waiting; }
        if ($tile.data('ctlHtml') !== html) {
            var key = ctlFocusKey($tile);
            $tile.data('ctlHtml', html).find('.dash-tile-body').html(html);
            if (key) { ctlRefocus($tile, key); }   // the redraw replaced the focused node
        }
        $tile.find('.dash-tile-foot').empty();
        return waiting;
    }
    function renderAllControls() {
        var waiting = false;
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            if (tl.type !== 'controls') { continue; }
            var $t = $('#dashMain .dash-tile[data-tile-id="' + tl.id + '"]');
            if ($t.length && renderControlsInto($t, tl)) { waiting = true; }
        }
        return waiting;
    }
    // The values arrive with the tiles (a data tile's fetch, a framed report's
    // own load), so the Controls tiles are drawn again when rows land, and
    // re-read every 1.5s (30s at most) while a group still has no values.
    var _ctlTimer = null, _ctlTries = 0;
    function scheduleControls(ms, fresh) {
        if (!DASH || !DASH.tiles || !DASH.tiles.some(function (x) { return x.type === 'controls'; })) { return; }
        if (fresh !== false) { _ctlTries = 0; }
        clearTimeout(_ctlTimer);
        _ctlTimer = setTimeout(function () {
            controlsFillRows();
            if (renderAllControls() && _ctlTries < 20) { _ctlTries++; scheduleControls(1500, false); }
        }, ms == null ? 150 : ms);
    }
    // Chips list the values the tiles HOLD, and a data tile holds only what
    // it fetched: under a dashboard filter just the matching rows (a
    // bookmarked COLLEGE = Eng would offer no other college), and a table
    // tile only its excerpt. So for each report that answers a Controls
    // column and will never load its full, unfiltered rows by itself, one
    // unfiltered read (capped at CTL_FILL_LIMIT rows) fills the lists - once
    // per report and prompt set, and only on a dashboard with Controls chips.
    var CTL_FILL_LIMIT = 5000;
    var _ctlFillAsked = Object.create(null);
    function controlsColumns() {
        var out = [];
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i], sp = (tl.type === 'controls') ? controlsSpec(tl) : null;
            if (!sp || sp.error) { continue; }
            sp.fields.forEach(function (f) { var c = String(f.col).toUpperCase(); if (out.indexOf(c) === -1) { out.push(c); } });
        }
        return out;
    }
    function controlsFillRows() {
        var want = controlsColumns();
        if (!want.length) { return; }
        var best = Object.create(null), pick = Object.create(null);
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            if (tl.type !== 'stat' && tl.type !== 'chart' && tl.type !== 'table') { continue; }
            if (!tl.report || T.effectiveSource(tl) !== 'live') { continue; }
            var k = rowsSeenKey(tl);
            // The score noteRowsSeen will give this tile's own rows: 7 = full
            // and unfiltered, which the chips need; less = filtered or an excerpt.
            var ss = tileSearchSpec(tl);
            var natural = (ss.dsearch ? 0 : 4) + (String(tl.search || '').trim() ? 0 : 2) + (tileRowLimit(tl) ? 0 : 1);
            if (!(k in best) || natural > best[k]) { best[k] = natural; pick[k] = tl; }
        }
        Object.keys(best).forEach(function (k) {
            var had = _rowsSeen[k];
            if (best[k] === 7 || _ctlFillAsked[k] || (had && had.score === 7)) { return; }
            // Only a report that has a Controls column - known once its tile's
            // first rows are in (the next redraw asks again until then).
            var tc = tileBuilderCols(pick[k]);
            if (!tc || !want.some(function (c) { return c in tc.upper; })) { return; }
            _ctlFillAsked[k] = true;
            var tl = pick[k];
            T.fetchRows({ source: 'live', report: tl.report, prompts: effPrompts(tl), limit: CTL_FILL_LIMIT, search: '', dsearch: '' })
                .then(function (res) {
                    var capped = (typeof res.totalRows === 'number') && res.totalRows > res.rows.length;
                    // A tile that meanwhile holds MORE rows (a report the filter
                    // could not reach arrives whole) keeps them over a capped read.
                    var now = _rowsSeen[k];
                    if (!(capped && now && now.rows.length > res.rows.length)) {
                        noteRowsSeen({ report: tl.report, prompts: tl.prompts }, null, res.rows, capped ? CTL_FILL_LIMIT : 0);
                    }
                    scheduleControls();
                })
                .catch(function () { /* the chips keep what the tiles hold */ });
        });
    }
    // Focus survives a redraw (WCAG 2.4.3): the focused control is found again
    // by what it is, not by node - the redraw replaces every node.
    function ctlFocusKey($tile) {
        var ae = document.activeElement;
        if (!ae || !$tile[0] || !$.contains($tile[0], ae)) { return null; }
        var $a = $(ae);
        return { col: String($a.closest('.pnb-fs-group').attr('data-fs-col') || ''), val: $a.attr('data-fs-val'),
                 act: $a.attr('data-fs-act'), i: $a.attr('data-ctl-i'), bound: $a.attr('data-fs-bound'), find: $a.hasClass('pnb-fs-find') || undefined };
    }
    function ctlRefocus($tile, key) {
        var $hit = $tile.find('.pnb-fs-chip, [data-fs-act], .pnb-toggle-btn, .pnb-fs-bound, .pnb-fs-find').filter(function () {
            var $e = $(this);
            if (key.i !== undefined) { return $e.attr('data-ctl-i') === key.i; }
            if (key.find) { return $e.hasClass('pnb-fs-find') && String($e.closest('.pnb-fs-group').attr('data-fs-col') || '') === key.col; }
            if (key.bound !== undefined) {
                return $e.attr('data-fs-bound') === key.bound && String($e.closest('.pnb-fs-group').attr('data-fs-col') || '') === key.col;
            }
            if ($e.attr('data-fs-act') === 'clearall') { return key.act === 'clearall'; }
            if (String($e.closest('.pnb-fs-group').attr('data-fs-col') || '') !== key.col) { return false; }
            return key.val !== undefined ? $e.attr('data-fs-val') === key.val : $e.attr('data-fs-act') === key.act;
        }).first();
        if ($hit.length) {
            $hit.trigger('focus');
            if (key.find) { try { $hit[0].setSelectionRange($hit.val().length, $hit.val().length); } catch (e0) { /* not a text box */ } }
        }
        else if ($tile.find('.pnb-fs-chip').length) { $tile.find('.pnb-fs-chip').first().trigger('focus'); }
    }
    function controlsTileOf(el) {
        var $tile = $(el).closest('.dash-tile'), i = tileIndexById($tile.attr('data-tile-id'));
        return (i > -1 && DASH.tiles[i].type === 'controls') ? { $tile: $tile, tile: DASH.tiles[i] } : null;
    }
    // Every change goes through the box and the ordinary apply, so the
    // address, the note under the box and every tile follow as they do for
    // typed text. The box is written first: the apply re-reads it.
    function controlsApply(text) {
        $('#dashSearchInput').val(text);
        applyDashSearch(text);   // redraws the Controls tiles, focus kept (renderControlsInto)
    }
    // -------------------------------------------------------------------------
    // Cross-filtering (2026-09-30): a click on a value IN a tile - a chart's bar
    // or slice, a table tile's plain cell, a framed report's cell (main.js posts
    // it as penumbra:xfilter) - puts `COL = /^(?:value)$/` into the dashboard
    // filter: the exact-value shape a Controls chip writes, so every tile whose
    // report has the column follows and a chip for that value reads pressed.
    // The same click again releases it. One AND-run only: under an "or" filter
    // the click says why it cannot, like a switch. Nothing while editing.
    // -------------------------------------------------------------------------
    var _xfHinted = false;
    function crossFilterCond(col, value) {
        return T.strip.colRef(String(col).toUpperCase()) + ' = /^(?:' + T.strip.encode(String(value)) + ')$/';
    }
    function crossFilter(col, value) {
        col = String(col == null ? '' : col).trim(); value = String(value == null ? '' : value).trim();
        if (!col || col === '#' || !value || editMode) { return false; }
        var text = dashBoxText(), cond = crossFilterCond(col, value);
        var had = T.strip.has(text, cond);
        var next = had ? T.strip.remove(text, cond) : T.strip.add(text, cond);
        if (next === null) {
            dashShowText('The dashboard filter holds an "or" query, so a click cannot add one condition to it. Clear the filter first.', 6000);
            return false;
        }
        if (!had && !_xfHinted) {
            _xfHinted = true;
            dashShowText('Filtering every tile by ' + escapeHtml(cond) + '. Click the same value again to release it.', 5000);
        }
        controlsApply(next);
        return true;
    }
    // A search link's own text (a cell's data-search, the report's click-to-
    // search convention; 2026-10-01): a table tile's link, or a framed report's
    // posted here instead of searching that frame alone. Toggled like a cell's
    // value, one AND-run only; a text the run cannot take (an "or", a modifier,
    // or a box holding an "or") replaces the filter, as the link does on its own
    // page. Applied as written: a now() or calc() inside it is the report
    // page's to resolve, and a framed page has resolved it before posting.
    function crossFilterText(text) {
        text = String(text == null ? '' : text).trim();
        if (!text || editMode) { return false; }
        var box = dashBoxText();
        var had = T.strip.has(box, text);
        var next = had ? T.strip.remove(box, text) : T.strip.add(box, text);
        if (next === null) { next = text; had = false; }
        if (!had && !_xfHinted) {
            _xfHinted = true;
            dashShowText('Filtering every tile by ' + escapeHtml(text) + '. Click the same link again to release it.', 5000);
        }
        controlsApply(next);
        return true;
    }
    // Several criteria from ONE click (a framed chart's stacked segment): all in
    // or all out together, by the first one's state.
    function crossFilterPairs(pairs) {
        var list = [];
        (pairs || []).forEach(function (p) {
            var c = String(p && p.col != null ? p.col : '').trim(), v = String(p && p.value != null ? p.value : '').trim();
            if (c && c !== '#' && v) { list.push(crossFilterCond(c, v)); }
        });
        if (!list.length || editMode) { return false; }
        if (list.length === 1) { return crossFilter(pairs[0].col, pairs[0].value); }
        var text = dashBoxText(), had = T.strip.has(text, list[0]), next = text;
        for (var i = 0; i < list.length && next !== null; i++) { next = had ? T.strip.remove(next, list[i]) : T.strip.add(next, list[i]); }
        if (next === null) {
            dashShowText('The dashboard filter holds an "or" query, so a click cannot add one condition to it. Clear the filter first.', 6000);
            return false;
        }
        controlsApply(next);
        return true;
    }
    // Chart tiles: the clicked category is the condition; a stacked segment
    // names its split value too, both in or both out. "(blank)" and "(other)"
    // are buckets, not values.
    function chartCrossFilterHooks(tile) {
        return {
            onHover: function (evt, els) {
                var el = evt && evt.native && evt.native.target;
                if (el && el.style) { el.style.cursor = (els && els.length && !editMode) ? 'pointer' : ''; }
            },
            onClick: function (evt, els, chart) {
                if (!chart || !els || !els.length || !tile.groupBy || editMode) { return; }
                var e0 = els[0], label = chart.data.labels[e0.index];
                if (label == null || label === '(blank)' || label === '(other)') { return; }
                var ds = chart.data.datasets[e0.datasetIndex];
                var split = (tile.splitBy && ds && ds.label != null && ds.label !== '(blank)' && ds.label !== '(other)') ? String(ds.label) : null;
                if (split === null) { crossFilter(tile.groupBy, label); return; }
                var text = dashBoxText(), c1 = crossFilterCond(tile.groupBy, label), c2 = crossFilterCond(tile.splitBy, split);
                var h1 = T.strip.has(text, c1), h2 = T.strip.has(text, c2);
                if (h1 !== h2) { crossFilter(h1 ? tile.splitBy : tile.groupBy, h1 ? split : label); return; }   // even them up
                var both = h1 ? T.strip.remove(T.strip.remove(text, c1) || '', c2) : T.strip.add(T.strip.add(text, c1) || '', c2);
                if (both === null) { crossFilter(tile.groupBy, label); return; }   // the "or" notice
                controlsApply(both);
            }
        };
    }
    // Table tiles: a plain cell (renderTable marks it with data-col).
    // A search link in a table tile's cell (2026-10-01): the report's data-search
    // convention, which has no page of its own here, filters the dashboard.
    $(document).on('click', '#dashMain .dash-tile-table a[data-search]', function (e) {
        e.preventDefault();
        e.stopPropagation();   // not the cell's own click-to-filter as well
        crossFilterText($(this).attr('data-search'));
    });
    $(document).on('click', '#dashMain .dash-tile-table td[data-col]', function (e) {
        if (editMode || $(e.target).closest('a, button, input, select, textarea').length) { return; }
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed) { return; }   // the click that ends a text selection
        crossFilter($(this).attr('data-col'), $(this).text());
    });
    // -------------------------------------------------------------------------
    // Cross-filtering from the keyboard (WCAG 2.1.1, 2026-10-15). The clicks
    // above are pointer-only; these reach the SAME crossFilter():
    //   table tiles - every row is a tab stop (T.renderInto cellFilter). Enter
    //     or Space on a row filters by its first plain value; Left / Right walk
    //     the row's plain cells (tabindex -1) and Enter / Space on a cell filters
    //     by that cell; Up / Down keep the column; Escape goes back to the row.
    //     Chosen over a tab stop per cell (up to 200 rows x N columns of Tab
    //     presses) and over a menu (the value is already on screen). A hint
    //     under the table says so while a row or cell has focus.
    //   chart tiles - a "Filter" button in the tile head opens a menu of the
    //     chart's categories (and split values), each a menuitemcheckbox that
    //     reads pressed while its condition is in the filter.
    // The table re-renders after the filter applies, so the focused value is
    // remembered and focus put back on it (else its row, else the tile's link).
    // -------------------------------------------------------------------------
    var _xfFocus = null;   // { tileId, col, value, at }
    function xfAnnounce(col, value, wasOn) {
        dashAnnounce((wasOn ? 'Released ' : 'Filtered every tile by ') + col + ' = ' + value + '.');
    }
    function xfIsOn(col, value) {
        return T.strip.has(dashBoxText(), crossFilterCond(col, value));
    }
    function xfByCell(td) {
        var $td = $(td), col = String($td.attr('data-col') || ''), value = $.trim($td.text());
        if (!col || !value || editMode) { return false; }
        var wasOn = xfIsOn(col, value);
        var $tile = $td.closest('.dash-tile');
        _xfFocus = { tileId: String($tile.attr('data-tile-id') || ''), col: col, value: value, at: Date.now() };
        if (!crossFilter(col, value)) { _xfFocus = null; return false; }
        xfAnnounce(col, value, wasOn);
        return true;
    }
    function xfRestoreFocus($tile, tile) {
        var f = _xfFocus;
        if (!f || f.tileId !== String(tile.id)) { return; }
        _xfFocus = null;
        if (Date.now() - f.at > 30000) { return; }
        // Only when focus fell to the page with the old table: never steal it back.
        var ae = document.activeElement;
        if (ae && ae !== document.body && document.documentElement.contains(ae)) { return; }
        var $hit = $tile.find('td[data-col]').filter(function () {
            return String($(this).attr('data-col')) === f.col && $.trim($(this).text()) === f.value;
        }).first();
        if (!$hit.length) { $hit = $tile.find('.dash-tile-body tbody tr[tabindex]').first(); }
        if (!$hit.length) { $hit = $tile.find('.dash-tile-open, .dash-xf-btn').first(); }
        if ($hit.length) { try { $hit[0].focus({ preventScroll: true }); } catch (e) { $hit[0].focus(); } }
    }
    function xfCellsOf(tr) { return $(tr).children('td[data-col]'); }
    function xfIsKey(e, names) { return names.indexOf(e.key) > -1; }
    $(document).on('keydown', '#dashMain .dash-tile-table tbody tr, #dashMain .dash-tile-table td[data-col]', function (e) {
        if (e.target !== this || editMode || e.ctrlKey || e.metaKey || e.altKey) { return; }
        var isRow = this.tagName === 'TR';
        var tr = isRow ? this : $(this).closest('tr')[0];
        var $cells = xfCellsOf(tr), i = isRow ? -1 : $cells.index(this);
        var to = null;
        if (xfIsKey(e, ['Enter', ' ', 'Spacebar'])) {
            e.preventDefault();
            e.stopPropagation();
            var td = isRow ? $cells[0] : this;
            if (td) { xfByCell(td); }
            return;
        }
        if (xfIsKey(e, ['ArrowRight', 'Right'])) { to = isRow ? $cells[0] : $cells[i + 1]; }
        else if (xfIsKey(e, ['ArrowLeft', 'Left'])) { to = isRow ? null : (i > 0 ? $cells[i - 1] : tr); }
        else if (!isRow && xfIsKey(e, ['Escape', 'Esc'])) { to = tr; }
        else if (!isRow && xfIsKey(e, ['ArrowDown', 'Down', 'ArrowUp', 'Up'])) {
            var $rows = $(tr).parent().children('tr'), r = $rows.index(tr) + (/Down/.test(e.key) ? 1 : -1);
            var col = String($(this).attr('data-col'));
            to = (r >= 0 && r < $rows.length) ? xfCellsOf($rows[r]).filter(function () { return String($(this).attr('data-col')) === col; })[0] || null : null;
        }
        else { return; }
        e.preventDefault();
        if (to) { try { to.focus({ preventScroll: false }); } catch (e2) { to.focus(); } }
    });
    // The hint shows while a row or cell of that table has focus.
    $(document).on('focusin', '#dashMain .dash-tile-table tbody tr, #dashMain .dash-tile-table td[data-col]', function () {
        if (editMode) { return; }
        $(this).closest('.dash-tile-body').find('.dash-table-kbdhint').prop('hidden', false);
    });
    $(document).on('focusout', '#dashMain .dash-tile-table .dash-table-wrap', function (e) {
        var $b = $(this).closest('.dash-tile-body');
        if (e.relatedTarget && $b[0] && $b[0].contains(e.relatedTarget) && $(e.relatedTarget).closest('tbody').length) { return; }
        $b.find('.dash-table-kbdhint').prop('hidden', true);
    });
    // Chart tiles: the menu of the chart's values.
    function xfChartItems(tile) {
        var ch = chartInstances[tile.id], items = [], seen = {};
        if (!ch || !ch.data || !tile.groupBy) { return items; }
        function add(col, v) {
            if (v == null) { return; }
            v = String(v).trim();
            if (!v || v === '(blank)' || v === '(other)') { return; }
            var k = col + '\u0000' + v;
            if (seen[k]) { return; }
            seen[k] = 1;
            items.push({ col: col, value: v });
        }
        (ch.data.labels || []).forEach(function (l) { add(tile.groupBy, l); });
        if (tile.splitBy) { (ch.data.datasets || []).forEach(function (d) { add(tile.splitBy, d && d.label); }); }
        return items;
    }
    function xfCloseMenu(focusBtn) {
        var m = document.getElementById('dashXfMenu');
        if (!m) { return; }
        var btn = m.__pnbXfBtn;
        if (m.contains(document.activeElement)) { focusBtn = true; }   // never drop focus to the page
        if (m.parentNode) { m.parentNode.removeChild(m); }
        if (btn) { btn.setAttribute('aria-expanded', 'false'); if (focusBtn && document.documentElement.contains(btn)) { btn.focus(); } }
    }
    function xfOpenMenu(btn) {
        xfCloseMenu(false);
        var $tile = $(btn).closest('.dash-tile'), i = tileIndexById($tile.attr('data-tile-id'));
        var tile = i > -1 ? DASH.tiles[i] : null;
        if (!tile || editMode) { return; }
        var items = xfChartItems(tile);
        var lbl = tileLabel(tile) || 'chart';
        var m = document.createElement('div');
        m.id = 'dashXfMenu';
        m.className = 'dash-xf-menu';
        m.setAttribute('role', 'menu');
        m.setAttribute('aria-label', 'Filter the dashboard by a value in ' + lbl);
        var r = btn.getBoundingClientRect();
        // Layout inline (fixed to the button; the tile clips its overflow); colours are theme tokens.
        m.style.cssText = 'position:fixed; z-index:10050; top:' + Math.round(r.bottom + 2) + 'px; right:' + Math.max(4, Math.round(document.documentElement.clientWidth - r.right)) + 'px;'
            + ' max-height:' + Math.max(120, Math.round(window.innerHeight - r.bottom - 12)) + 'px; overflow:auto; min-width:160px; max-width:min(360px, calc(100vw - 16px));'
            + ' padding:4px; background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border-strong, var(--border-color)); border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,0.18);';
        var html = '';
        if (!items.length) {
            html = '<div class="dash-xf-empty" style="padding:4px 6px; font-size:11px; color:var(--text-muted);">No values to filter by.</div>';
        }
        items.forEach(function (it, k) {
            var on = xfIsOn(it.col, it.value);
            html += '<button type="button" class="dash-xf-item" role="menuitemcheckbox" aria-checked="' + (on ? 'true' : 'false') + '"'
                  + ' tabindex="' + (k === 0 ? '0' : '-1') + '" data-k="' + k + '"'
                  + ' style="display:block; width:100%; text-align:left; font:inherit; font-size:11px; padding:3px 6px; margin:0; border:0; border-radius:3px; background:transparent; color:inherit; cursor:pointer;">'
                  + '<span aria-hidden="true">' + (on ? '&#10003; ' : '') + '</span>'
                  + (tile.splitBy ? escapeHtml(it.col) + ': ' : '') + escapeHtml(it.value) + '</button>';
        });
        m.innerHTML = html;
        m.__pnbXfItems = items;
        m.__pnbXfBtn = btn;
        m.__pnbXfTile = tile;
        document.body.appendChild(m);
        btn.setAttribute('aria-expanded', 'true');
        var first = m.querySelector('.dash-xf-item');
        if (first) { first.focus(); }
        else { btn.focus(); }
    }
    $(document).on('click', '#dashMain .dash-xf-btn', function (e) {
        e.preventDefault();
        if (document.getElementById('dashXfMenu') && document.getElementById('dashXfMenu').__pnbXfBtn === this) { xfCloseMenu(true); return; }
        xfOpenMenu(this);
    });
    $(document).on('click', '#dashXfMenu .dash-xf-item', function (e) {
        e.preventDefault();
        var m = document.getElementById('dashXfMenu'), it = m && m.__pnbXfItems && m.__pnbXfItems[+$(this).attr('data-k')];
        if (!it) { return; }
        var wasOn = xfIsOn(it.col, it.value);
        xfCloseMenu(true);
        if (crossFilter(it.col, it.value)) { xfAnnounce(it.col, it.value, wasOn); }
    });
    // Capture phase on the window: the shared menu controller (penumbra_a11y.js)
    // would otherwise remove the node on Escape itself and leave the button's
    // aria-expanded at true. Arrow keys stay with that controller.
    window.addEventListener('keydown', function (e) {
        var m = document.getElementById('dashXfMenu');
        if (!m || !m.contains(e.target)) { return; }
        if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); xfCloseMenu(true); }
        else if (e.key === 'Tab') { e.preventDefault(); xfCloseMenu(true); }
    }, true);
    $(document).on('mousedown', function (e) {
        var m = document.getElementById('dashXfMenu');
        if (m && !m.contains(e.target) && !$(e.target).closest('.dash-xf-btn').length) { xfCloseMenu(false); }
    });
    $(window).on('resize', function () { xfCloseMenu(false); });
    document.addEventListener('scroll', function (e) {
        var m = document.getElementById('dashXfMenu');
        if (m && !(e.target && e.target.nodeType === 1 && m.contains(e.target))) { xfCloseMenu(false); }
    }, true);
    $(document).on('click', '#dashMain .dash-controls .pnb-fs-chip', function (e) {
        e.preventDefault();
        var c = controlsTileOf(this), spec = c && controlsSpec(c.tile);
        if (!spec || spec.error || $(this).closest('.pnb-fstrip').attr('data-fs-off')) { return; }
        var col = String($(this).closest('.pnb-fs-group').attr('data-fs-col') || '').toUpperCase();
        var val = String($(this).attr('data-fs-val') || ''), low = val.toLowerCase();
        var st = controlsState(spec);
        if (st.or) { return; }
        var cur = st.sel[col] || [];
        var next = cur.filter(function (v) { return String(v).toLowerCase() !== low; });
        if (next.length === cur.length) { next.push(val); }
        st.sel[col] = next;
        controlsApply(T.strip.compose(st, spec.fields));
    });
    $(document).on('click', '#dashMain .dash-controls .pnb-fstrip [data-fs-act]', function (e) {
        e.preventDefault();
        var c = controlsTileOf(this), spec = c && controlsSpec(c.tile);
        if (!spec || spec.error) { return; }
        var act = $(this).attr('data-fs-act'), col = String($(this).closest('.pnb-fs-group').attr('data-fs-col') || '').toUpperCase();
        if (act === 'more') {
            var ex = _ctlExpanded[c.tile.id] || (_ctlExpanded[c.tile.id] = {});
            ex[col] = !ex[col];
            renderControlsInto(c.$tile, c.tile);
            return;
        }
        if ($(this).closest('.pnb-fstrip').attr('data-fs-off')) { return; }
        var st = controlsState(spec);
        if (st.or) { return; }
        if (act === 'clear') { st.sel[col] = []; st.range[col] = { min: '', max: '' }; }
        else if (act === 'clearall') { st.sel = {}; st.range = {}; }
        else { return; }
        controlsApply(T.strip.compose(st, spec.fields));
    });
    // A list field's find box (the list option, 2026-10-01): typing filters the
    // rows in place through the tiles module's one filter; the text is kept
    // per tile and column, so a redraw draws it back (and ctlRefocus puts the
    // caret back). Enter presses the first row still showing that is not yet
    // pressed, as picking from a found list should.
    $(document).on('input', '#dashMain .dash-controls .pnb-fs-find', function () {
        var c = controlsTileOf(this), grp = $(this).closest('.pnb-fs-group')[0];
        if (!c || !grp) { return; }
        var f = _ctlFind[c.tile.id] || (_ctlFind[c.tile.id] = {});
        f[String(grp.getAttribute('data-fs-col') || '').toUpperCase()] = this.value;
        T.strip.listFilter(grp, this.value);
    });
    $(document).on('keydown', '#dashMain .dash-controls .pnb-fs-find', function (e) {
        if (e.key !== 'Enter') { return; }
        e.preventDefault();
        var $first = $(this).closest('.pnb-fs-group').find('.pnb-fs-chip:not(.pnb-fs-hid)[aria-pressed="false"]').first();
        if ($first.length) { $first.trigger('click'); }
    });
    // Range boxes (2026-09-30): the pair commits TOGETHER - Enter in either,
    // or focus leaving the pair (read a tick later, once the new focus has
    // landed, so the redraw can put it back) - and a box holding neither a
    // number nor a date (for a date field: not a full date) is marked, and
    // nothing is written. The report page's rule, same grammar.
    function controlsCommitRange(grp) {
        var c = controlsTileOf(grp), spec = c && controlsSpec(c.tile);
        if (!spec || spec.error || $(grp).closest('.pnb-fstrip').attr('data-fs-off')) { return; }
        var st = controlsState(spec);
        if (st.or) { return; }
        var col = String($(grp).attr('data-fs-col') || '').toUpperCase(), kind = $(grp).attr('data-fs-kind') || '';
        var rg = { min: '', max: '' }, bad = false;
        $(grp).find('.pnb-fs-bound').each(function () {
            var b = T.strip.bound($(this).val(), kind);
            if (b === null) { bad = true; $(this).attr('aria-invalid', 'true'); return; }
            $(this).removeAttr('aria-invalid');
            rg[$(this).attr('data-fs-bound')] = b;
        });
        if (bad) { return; }
        var cur = st.range[col] || { min: '', max: '' };
        if (cur.min === rg.min && cur.max === rg.max) { return; }   // nothing changed
        st.range[col] = rg;
        $(grp).find('.pnb-fs-bound').each(function () { this.defaultValue = this.value; });   // written: no longer typing
        controlsApply(T.strip.compose(st, spec.fields));
    }
    $(document).on('keydown', '#dashMain .dash-controls .pnb-fs-bound', function (e) {
        if (e.key !== 'Enter') { return; }
        e.preventDefault();
        controlsCommitRange($(this).closest('.pnb-fs-range')[0]);
    });
    $(document).on('focusout', '#dashMain .dash-controls .pnb-fs-range', function () {
        var grp = this;
        setTimeout(function () {
            if (!document.body.contains(grp) || $.contains(grp, document.activeElement)) { return; }   // still in the pair, or redrawn meanwhile
            controlsCommitRange(grp);
        }, 0);
    });
    $(document).on('click', '#dashMain .dash-controls .pnb-toggle-btn', function (e) {
        e.preventDefault();
        var c = controlsTileOf(this), i = parseInt($(this).attr('data-ctl-i'), 10);
        var x = c && Array.isArray(c.tile.toggles) ? c.tile.toggles[i] : null;
        var cond = String((x && x.cond) || '').trim();
        if (!cond) { return; }
        var text = dashBoxText();
        var next = T.strip.has(text, cond) ? T.strip.remove(text, cond) : T.strip.add(text, cond);
        if (next === null) {
            dashShowText('The dashboard filter holds an "or" query, so a switch cannot add or remove one condition. Clear the filter first.', 6000);
            return;
        }
        controlsApply(next);
    });
    // Every change to the box - typing, Escape putting back the filter in
    // force, a picked suggestion - passes through syncDashFilterBox, which
    // calls this: the chips and switches follow the box (the report's rule:
    // their state IS the box). Debounced for typing; an unchanged drawing is
    // skipped, so the calls are cheap.
    var _ctlBoxTimer = null;
    function controlsFollowBox() {
        clearTimeout(_ctlBoxTimer);
        _ctlBoxTimer = setTimeout(renderAllControls, 180);
    }

    // A framed report reports what it routed: { type, dsearch, skipped, applied }.
    // A late message from an earlier filter must not overwrite the current one.
    window.addEventListener('message', function (ev) {
        // Only our own tile frames are listened to (the source check below); a
        // file: test page has no comparable origin, so it skips the origin check.
        if (ev.origin !== window.location.origin && window.location.protocol !== 'file:') { return; }
        var d = ev.data;
        if (d && d.type === 'penumbra:xfilter') {
            // A framed report's cell click (main.js click-to-filter, hosted): our own frames only.
            var mine = false;
            $('#dashMain iframe.dash-embed').each(function () { if (this.contentWindow === ev.source) { mine = true; } });
            if (mine) { if (d.text) { crossFilterText(d.text); } else if (d.pairs && d.pairs.length) { crossFilterPairs(d.pairs); } else { crossFilter(d.col, d.value); } }
            return;
        }
        if (!d || d.type !== 'penumbra:dsearch') { return; }
        scheduleControls();   // the frame's rows are in: a Controls tile may have new values
        tileColsChanged();    // and its columns are known (the page routes as it builds its table; the header may follow)
        setTimeout(tileColsChanged, 800);
        $('#dashMain iframe.dash-embed').each(function () {
            if (this.contentWindow !== ev.source) { return; }
            var id = $(this).closest('.dash-tile').attr('data-tile-id');
            for (var i = 0; i < DASH.tiles.length; i++) {
                if (DASH.tiles[i].id !== id) { continue; }
                if (String(d.dsearch || '') === String(effTile(DASH.tiles[i]).dsearch || '')) { noteTileSearch(DASH.tiles[i], d.skipped); }
                break;
            }
            return false;
        });
    });
    // The report search box's suggestions (2026-09-29): double-click the box or
    // press Ctrl+Space for the columns, the values after COLUMN =, the nested
    // columns - search_builder.js attachFilterAutocomplete, the same engine the
    // report page runs, asking this page's _penumbraSearchAPI adapter (the
    // columns and values of the tiles the filter reaches). Attached on first use
    // with the builder's files, so a dashboard nobody filters never loads them;
    // the gesture that asked for it is replayed once they are in.
    var _dashAcOn = false;
    function dashAutocomplete(replay) {
        loadDashBuilder().then(function () {
            var sb = window._penumbraSearchBuilder;
            if (!sb || typeof sb.attachFilterAutocomplete !== 'function' || !$.fn.autocomplete) { return; }
            if (!_dashAcOn) {
                _dashAcOn = true;
                sb.attachFilterAutocomplete('#dashSearchInput', {
                    includePresets: false,
                    onSearchExecute: function () { applyDashSearch($('#dashSearchInput').val()); },
                    onInputChange: function () { syncDashFilterBox(false); }
                });
            }
            replay();
        }, builderFailed);
    }
    $(document).on('dblclick', '#dashSearchInput', function () {
        if (_dashAcOn) { return; }   // attached: the engine's own handler has it
        var el = this;
        dashAutocomplete(function () { $(el).trigger('dblclick'); });
    });
    // The column arrow (2026-10-06) and Alt+Down in the box: every column, as
    // the double-click into the empty box lists them (search_builder.js
    // showColumnList - a pick adds `and COLUMN ` after what is typed). The
    // arrow toggles; its mousedown keeps the focus in the box, whose blur
    // would close the list, and notes whether the list was open (the widget
    // closes it on that mousedown, before the click).
    function dashShowColumns() {
        dashAutocomplete(function () {
            var sb = window._penumbraSearchBuilder;
            if (!sb || typeof sb.showColumnList !== 'function' || !sb.showColumnList('#dashSearchInput')) { $('#dashSearchInput').trigger('focus'); }
        });
    }
    $(document).on('mousedown', '#dashSearchCols', function (e) {
        if (e.button !== 0) { return; }
        e.preventDefault();
        var sb = window._penumbraSearchBuilder;
        $(this).data('pnbWasOpen', !!(sb && typeof sb.columnListOpen === 'function' && sb.columnListOpen('#dashSearchInput')));
    });
    $(document).on('click', '#dashSearchCols', function (e) {
        e.preventDefault();
        var wasOpen = $(this).data('pnbWasOpen');
        $(this).removeData('pnbWasOpen');
        var sb = window._penumbraSearchBuilder;
        if (wasOpen || (sb && typeof sb.columnListOpen === 'function' && sb.columnListOpen('#dashSearchInput'))) {
            try { $('#dashSearchInput').autocomplete('close'); } catch (eC) { }
            $('#dashSearchInput').trigger('focus');
            return;
        }
        dashShowColumns();
    });
    $(document).on('keydown', '#dashSearchInput', function (e) {
        // / in the EMPTY box opens the Visual Search Builder, as on a report's
        // search bar (the page-wide / is what focuses the box).
        if (e.key === '/' && !$(this).val() && !dashKeysOff() && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            openDashBuilder();
            return;
        }
        if ((e.key === ' ' || e.keyCode === 32) && e.ctrlKey && !_dashAcOn) {
            e.preventDefault();
            var el = this;
            dashAutocomplete(function () { $(el).trigger($.Event('keydown', { key: ' ', keyCode: 32, which: 32, ctrlKey: true })); });
            return;
        }
        // Alt+Down = the column arrow; once the engine is attached its own
        // handler takes the key (and stops it before this one).
        if ((e.key === 'ArrowDown' || e.keyCode === 40) && e.altKey && !e.ctrlKey && !e.metaKey && !_dashAcOn) {
            e.preventDefault();
            dashShowColumns();
            return;
        }
        // The suggestion list had it first: Enter picked the highlighted
        // suggestion, Escape closed the list.
        if ((e.key === 'Enter' || e.key === 'Escape') && e.isDefaultPrevented()) { return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (_dashAcOn) { try { $(this).autocomplete('close'); } catch (eAc) { } }
            applyDashSearch($(this).val());
        } else if (e.key === 'Escape') {
            // Un-applied typing is dropped; the box shows the filter in force.
            e.preventDefault(); e.stopPropagation();
            syncDashFilterBox(true);
            $(this).trigger('blur');
        }
    });
    $(document).on('click', '#dashSearchHelp', function (e) { e.preventDefault(); openHelpPanel('searchHelpLightbox'); });
    $(document).on('input', '#dashSearchInput', function () { syncDashFilterBox(false); });
    $(document).on('click', '#dashSearchGo', function () { applyDashSearch($('#dashSearchInput').val()); });
    $(document).on('click', '#dashSearchClear', function () {
        $('#dashSearchInput').val('');
        applyDashSearch('');
        $('#dashSearchInput').trigger('focus');
    });
    $(document).on('focus', '#dashSearchInput', function () {
        if (!this.value && !dashKeysOff() && !$(this).attr('data-ph')) {
            $(this).attr('data-ph', $(this).attr('placeholder') || '').attr('placeholder', 'Type a filter (double-click for suggestions), or press / for the Visual Search Builder');
        }
    });
    $(document).on('blur', '#dashSearchInput', function () {
        var ph = $(this).attr('data-ph');
        if (ph) { $(this).attr('placeholder', ph); }
        $(this).removeAttr('data-ph');
    });

    // -------------------------------------------------------------------------
    // Visual Search Builder (2026-09-29). The report page's builder composes
    // the dashboard filter: js/search_builder.js with its markup
    // (search_builder_content.php) and its jQuery UI / moment dependencies,
    // loaded on first open, so a dashboard nobody filters this way never
    // downloads them. The builder asks its host page through
    // window._penumbraSearchAPI - main.js on a report page, the adapter below
    // here - which answers from the tiles the filter can reach: each framed
    // report through that page's own _penumbraSearchAPI, each data tile from
    // its fetched rows. Its count line names the tiles a filter would reach, by
    // the rule the tiles route by (a condition goes to a tile whose report has
    // its column), in the words the note uses once the filter is applied.
    // Opened by the magnifier in the box, or / in the empty box.
    // -------------------------------------------------------------------------
    // The best rows seen per report + prompts: rows fetched without a dashboard
    // filter outrank filtered ones, then rows without the tile's own filter,
    // then a full rowset over a table tile's slice - so the value lists still
    // offer every college after COLLEGE = Eng is applied.
    var _rowsSeen = Object.create(null);
    // The column list a report's ?json=1 envelope carries (index.php `columns`,
    // 2026-09-30): what the report HAS even when the filter left it no rows -
    // rows alone could not say. Same key as _rowsSeen.
    var _colsSeen = Object.create(null);
    function noteColsSeen(tile, cols) {
        if (!tile.report || !cols || !cols.length) { return; }
        _colsSeen[rowsSeenKey(tile)] = cols.slice();
        tileColsChanged();
    }
    function rowsSeenKey(tile) { return String(tile.report || '') + '|' + JSON.stringify(effPrompts(tile)); }
    function noteRowsSeen(tile, ss, rows, limit) {
        if (!tile.report || !rows || !rows.length) { return; }
        var score = (ss && ss.dsearch ? 0 : 4) + (String(tile.search || '').trim() ? 0 : 2) + (limit ? 0 : 1);
        var k = rowsSeenKey(tile), had = _rowsSeen[k];
        if (!had || score >= had.score) { _rowsSeen[k] = { rows: rows, score: score }; }
        tileColsChanged();
    }
    function tileFrameApi(tile) {
        var fr = $('#dashMain .dash-tile[data-tile-id="' + tile.id + '"] iframe.dash-embed')[0];
        try {
            var api = (fr && fr.contentWindow) ? fr.contentWindow._penumbraSearchAPI : null;
            return (api && typeof api.getColumns === 'function') ? api : null;
        } catch (e) { return null; }
    }
    // A data tile's @@JSON nested sub-table columns, read as index.php and the
    // report page read them (penumbra_search.php _search_virtual_column_names,
    // main.js buildVirtualColumnNames): the keys of each sub-table's first
    // object, UPPER-cased, first seen in the first 10 rows. query.php sends an
    // @@JSON cell unescaped, so it parses as it is.
    function nestedTable(raw) {
        var s = (raw == null) ? '' : String(raw), at = s.indexOf('@@JSON'), t = null;
        if (at === -1) { return null; }
        try { t = JSON.parse(s.substring(at + 6)); } catch (e) { return null; }
        return (Array.isArray(t) && t.length && t[0] !== null && typeof t[0] === 'object') ? t : null;
    }
    function rowCells(row) {
        if (!row || typeof row !== 'object') { return []; }
        if (typeof Map !== 'undefined' && row instanceof Map) { return Array.from(row.values()); }
        return Object.keys(row).map(function (k) { return row[k]; });
    }
    function rowsNestedNames(rows) {
        var out = [];
        for (var i = 0; i < rows.length && i < 10; i++) {
            rowCells(rows[i]).forEach(function (cell) {
                var t = nestedTable(cell);
                if (!t) { return; }
                Object.keys(t[0]).forEach(function (k) { var u = k.toUpperCase(); if (out.indexOf(u) === -1) { out.push(u); } });
            });
        }
        return out;
    }
    // What a tile the filter can reach answers to: { names: [{ name, visible }],
    // nested: [NAME], upper: { NAME: name } }, or null while that is unknown (a
    // frame still loading, a data tile not fetched yet) or when no filter reaches
    // the tile. Nested sub-table columns count: both routers keep them - the
    // framed page (main.js _pnbDashLoadText) and index.php
    // (penumbra_search_known_columns) - and both search engines read them, the
    // framed page's on-load pre-filter too (2026-09-29).
    function tileBuilderCols(tile) {
        if (tile.type === 'note' || tileStaticReach(tile)) { return null; }
        var names = [], nested = [], i;
        if (tile.type === 'embed') {
            var api = tileFrameApi(tile), cols = null, vn = null;
            try { cols = api ? api.getColumns() : null; } catch (e) { cols = null; }
            for (i = 0; cols && i < cols.length; i++) {
                if (cols[i] && cols[i].name) { names.push({ name: String(cols[i].name), visible: cols[i].visible !== false }); }
            }
            try { vn = (api && typeof api.buildVirtualColumnNames === 'function') ? api.buildVirtualColumnNames() : null; } catch (e) { vn = null; }
            for (i = 0; vn && i < vn.length; i++) {
                if (vn[i]) { nested.push(String(vn[i]).toUpperCase()); }
            }
        } else if (tile.report) {
            var seen = _rowsSeen[rowsSeenKey(tile)], env = _colsSeen[rowsSeenKey(tile)];
            if (seen) {
                T.sniffColumns(seen.rows).forEach(function (c) { names.push({ name: c.name, visible: true }); });
                nested = rowsNestedNames(seen.rows);
            }
            // The envelope's list fills in what no rows could show (a fetch the
            // filter emptied): '#' is added below, a nested column stays nested
            // once rows have shown it.
            for (i = 0; env && i < env.length; i++) {
                var en = String(env[i]), eu = en.toUpperCase();
                if (en === '#' || nested.indexOf(eu) > -1) { continue; }
                if (!names.some(function (n) { return n.name.toUpperCase() === eu; })) { names.push({ name: en, visible: true }); }
            }
        }
        if (!names.length) { return null; }
        var upper = Object.create(null), nest = [];
        for (i = 0; i < names.length; i++) {
            var u = names[i].name.toUpperCase();
            if (!(u in upper)) { upper[u] = names[i].name; }
        }
        for (i = 0; i < nested.length; i++) {
            if (!(nested[i] in upper)) { upper[nested[i]] = nested[i]; nest.push(nested[i]); }
        }
        if (tile.type !== 'embed') { upper['#'] = '#'; }   // index.php's router knows the row number
        return { names: names, nested: nest, upper: upper };
    }
    // Every column the filter can reach, once, visible when any tile shows it.
    function builderColumns() {
        var out = [], at = Object.create(null);
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tc = tileBuilderCols(DASH.tiles[i]);
            for (var j = 0; tc && j < tc.names.length; j++) {
                var c = tc.names[j], u = c.name.toUpperCase();
                if (u in at) { if (c.visible) { out[at[u]].visible = true; } continue; }
                at[u] = out.length;
                out.push({ name: c.name, visible: c.visible });
            }
        }
        return out;
    }
    // Every nested sub-table column the filter can reach, once - except a name
    // some tile has as a top-level column (the builder lists it there, and its
    // own nested list leaves such names out the same way).
    function builderNestedColumns() {
        var tcs = DASH.tiles.map(tileBuilderCols), top = Object.create(null), out = [], i, j;
        for (i = 0; i < tcs.length; i++) {
            for (j = 0; tcs[i] && j < tcs[i].names.length; j++) { top[tcs[i].names[j].name.toUpperCase()] = true; }
        }
        for (i = 0; i < tcs.length; i++) {
            for (j = 0; tcs[i] && j < tcs[i].nested.length; j++) {
                var n = tcs[i].nested[j];
                if (!(n in top) && out.indexOf(n) === -1) { out.push(n); }
            }
        }
        return out;
    }
    // Each tile that has the column, once per framed page or report:
    // fn(the column in that tile's spelling, its frame's API or null, its rows
    // or null, whether it is a nested sub-table column there); returning false
    // stops.
    function eachTileWith(col, fn) {
        var cu = String(col == null ? '' : col).toUpperCase(), done = Object.create(null);
        if (!cu) { return; }
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i], tc = tileBuilderCols(tl);
            if (!tc || !(cu in tc.upper)) { continue; }
            var nested = tc.nested.indexOf(cu) > -1;
            if (tl.type === 'embed') {
                if (fn(tc.upper[cu], tileFrameApi(tl), null, nested) === false) { return; }
                continue;
            }
            var k = rowsSeenKey(tl);
            if (k in done) { continue; }
            done[k] = true;
            if (_rowsSeen[k] && fn(tc.upper[cu], null, _rowsSeen[k].rows, nested) === false) { return; }
        }
    }
    // One cell as the report page lists it (main.js getColumnAutocompleteValues):
    // @@HTML unwrapped, entities decoded, tags stripped; null for @@JSON.
    function builderCellValue(raw) {
        if (raw == null) { return ''; }
        var v = String(raw).trim();
        if (v.substring(0, 6) === '@@JSON') { return null; }
        if (v.substring(0, 6) === '@@HTML') { v = v.substring(6); }
        return T.decodeEntities(v).replace(/<[^>]*>/g, '').trim();
    }
    // A data tile's distinct values, or null where the report page offers no
    // list either (nested tables, a value over 150 characters, over 15000).
    function rowValues(rows, name) {
        var seen = Object.create(null), out = [];
        for (var i = 0; i < rows.length; i++) {
            var v = builderCellValue(T.getCell(rows[i], name));
            if (v === null || v.length > 150) { return null; }
            if (!v || (v in seen)) { continue; }
            seen[v] = true;
            out.push(v);
            if (out.length > 15000) { return null; }
        }
        return out;
    }
    // The same for a nested sub-table column, as the report page lists one
    // (main.js _computeColumnAutocompleteValues, nested branch): the column's
    // values in every sub-table of every row, @@HTML unwrapped and tags
    // stripped; null when there are none, or past 150 characters or 15000.
    function rowNestedValues(rows, name) {
        var cu = String(name).toUpperCase(), seen = Object.create(null), out = [];
        for (var i = 0; i < rows.length; i++) {
            var cells = rowCells(rows[i]);
            for (var c = 0; c < cells.length; c++) {
                var t = nestedTable(cells[c]), key = null;
                if (!t) { continue; }
                Object.keys(t[0]).forEach(function (k) { if (key === null && k.toUpperCase() === cu) { key = k; } });
                if (key === null) { continue; }
                for (var j = 0; j < t.length; j++) {
                    var v = (t[j] && t[j][key] != null) ? String(t[j][key]) : '';
                    if (v.substring(0, 6) === '@@HTML') { v = v.substring(6).replace(/<[^>]*>/g, ''); }
                    v = v.trim();
                    if (!v) { continue; }
                    if (v.length > 150) { return null; }
                    if (!(v in seen)) {
                        seen[v] = true;
                        out.push(v);
                        if (out.length > 15000) { return null; }
                    }
                }
            }
        }
        return out.length ? out : null;
    }
    // The date shapes and picker formats of main.js getColumnDateInfo, for a
    // data tile's rows: the first of the first 20 rows that parses decides.
    var DATE_SHAPES = [
        [/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'M/D/YYYY', 'mm/dd/yy'],
        [/^\d{1,2}\/\d{1,2}\/\d{2}$/, 'M/D/YY', 'mm/dd/y'],
        [/^\d{4}-\d{1,2}-\d{1,2}/, 'YYYY-M-D', 'yy-mm-dd'],
        [/^\d{1,2}-[A-Za-z]{3}-\d{2}$/, 'D-MMM-YY', 'dd-M-y']
    ];
    function rowsDateInfo(rows, name) {
        if (typeof window.moment !== 'function') { return null; }
        for (var i = 0; i < rows.length && i < 20; i++) {
            var v = builderCellValue(T.getCell(rows[i], name));
            if (!v) { continue; }
            for (var k = 0; k < DATE_SHAPES.length; k++) {
                var hit = DATE_SHAPES[k][0].exec(v);
                if (hit && window.moment(hit[0], DATE_SHAPES[k][1]).isValid()) {
                    return { isDate: true, format: DATE_SHAPES[k][1], jqFormat: DATE_SHAPES[k][2],
                             isUpper: /[a-z]/i.test(v) && v === v.toUpperCase(), sampleValue: v };
                }
            }
        }
        return null;
    }
    // The builder's count line: which tiles a filter that is not applied yet
    // would reach, in the words of the note under the box.
    function builderReach(query) {
        var q = String(query == null ? '' : query).trim();
        var dash = q ? T.splitSearch(q) : null;
        if (!dash || !dash.fragments.length) { return ''; }
        var n = 0, miss = [], waiting = 0;
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            if (tl.type === 'note' || tl.type === 'controls') { continue; }
            n++;
            var why = tileStaticReach(tl) || searchSpecFor(tl, dash, q).note;
            if (!why && !dash.or) {
                var tc = tileBuilderCols(tl);
                if (!tc) { waiting++; continue; }
                var sk = [];
                for (var j = 0; j < dash.fragments.length; j++) {
                    var c = fragCol(dash.fragments[j]);
                    if (c && !(c in tc.upper) && sk.indexOf(c) === -1) { sk.push(c); }
                }
                if (sk.length) { why = 'its report has no ' + sk.join(', ') + (sk.length > 1 ? ' columns' : ' column'); }
            }
            if (why) { miss.push(tileLabel(tl) + ' (' + why + ')'); }
        }
        if (!n) { return ''; }
        var reach = n - miss.length - waiting;
        var s = (reach === n) ? (n === 1 ? 'reaches the one tile' : 'reaches all ' + n + ' tiles')
                              : 'reaches ' + reach + ' of ' + n + ' tiles';
        if (dash.or) { s += ' as typed ("or" is not split by column: a tile whose report lacks one of its columns shows no rows)'; }
        if (miss.length) { s += '; not filtered: ' + miss.join(' · '); }
        if (waiting) { s += '; ' + waiting + (waiting > 1 ? ' tiles have' : ' tile has') + ' not loaded yet'; }
        return s;
    }
    // __ALL / __SRC have nothing to show against on this page (no pivot), nor
    // __ROW while no tile has a nested column, so the builder would drop them:
    // the ones the box had when it opened are put back on what it returns.
    var MOD_RUN = /^(?:\s*__(?:ROW|ALL|SRC)\s+)*/i;
    function keepModifiers(query, had) {
        var q = String(query == null ? '' : query).trim();
        if (!q || !had) { return q; }
        var mine = (MOD_RUN.exec(q) || [''])[0].toUpperCase(), add = '';
        (String(had).match(/__(?:ROW|ALL|SRC)/gi) || []).forEach(function (m) {
            m = m.toUpperCase();
            if (mine.indexOf(m) === -1 && add.indexOf(m) === -1) { add += m + ' '; }
        });
        return add + q;
    }
    // Every value the tiles hold for a column (framed reports ask their own
    // page), once, sorted; null where none can say or past 15000. The box's
    // suggestions and the Controls tile's chips read this one list.
    function dashColumnValues(col) {
        var seen = Object.create(null), out = [], any = false, tooMany = false;
        eachTileWith(col, function (name, api, rows, nested) {
            var vals = null;
            if (api) {
                try { vals = (typeof api.getColumnAutocompleteValues === 'function') ? api.getColumnAutocompleteValues(name) : null; } catch (e) { vals = null; }
            } else { vals = nested ? rowNestedValues(rows, name) : rowValues(rows, name); }
            if (!Array.isArray(vals)) { return; }
            any = true;
            for (var i = 0; i < vals.length; i++) {
                var v = String(vals[i]);
                if (v !== '' && !(v in seen)) { seen[v] = true; out.push(v); }
            }
            if (out.length > 15000) { tooMany = true; return false; }
        });
        if (!any || tooMany || !out.length) { return null; }
        return out.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    }
    window._penumbraSearchAPI = window._penumbraSearchAPI || {
        getColumns: function () { return builderColumns(); },
        // The builder lists these under Nested Table Columns, and offers __ROW
        // while there are any.
        buildVirtualColumnNames: function () { return builderNestedColumns(); },
        getColumnAutocompleteValues: function (col) { return dashColumnValues(col); },
        getColumnDateInfo: function (col) {
            var info = null;
            eachTileWith(col, function (name, api, rows) {
                var d = null;
                if (api) {
                    try { d = (typeof api.getColumnDateInfo === 'function') ? api.getColumnDateInfo(name) : null; } catch (e) { d = null; }
                } else { d = rowsDateInfo(rows, name); }
                if (d && d.isDate) { info = d; return false; }
            });
            return info || { isDate: false };
        },
        // main.js penumbraTakeSrcModifier: __SRC out of the leading modifier run.
        takeSrcModifier: function (query) {
            var q = String(query == null ? '' : query);
            var head = (/^(?:__(?:ALL|ROW|SRC)\s+)*/i.exec(q) || [''])[0];
            if (!/__SRC\s/i.test(head)) { return { query: q, src: false }; }
            return { query: head.replace(/__SRC\s+/gi, '') + q.slice(head.length), src: true };
        },
        getCurrentReportId: function () { return 'dashboard:' + (META.short_id || V.shortId || ''); },
        runTableSearch: function () { applyDashSearch($('#dashSearchInput').val()); },
        handleSessionExpired: function () { showSsoDialog(); }
    };
    // The builder's files, once. Script elements (not an eval of fetched
    // text), in order; a stylesheet that fails is not fatal.
    var _sbLoad = null;
    function loadBuilderAsset(kind, url) {
        var d = $.Deferred(), el = document.createElement(kind);
        if (kind === 'link') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; el.async = false; }
        el.setAttribute('data-pnb-builder', '1');
        el.onload = function () { d.resolve(); };
        el.onerror = function () { if (kind === 'link') { d.resolve(); } else { d.reject(new Error('could not load ' + url)); } };
        document.head.appendChild(el);
        return d.promise();
    }
    function loadDashBuilder() {
        if (typeof window.openSearchBuilder === 'function') { return $.Deferred().resolve().promise(); }
        if (_sbLoad) { return _sbLoad; }
        var A = V.builderAssets || {};
        var css = A.css || ['css/jquery-ui.css', 'css/search_builder.css'];
        var js = A.js || ['js/moment.min.js', 'js/jquery-ui.min.js', 'js/search_builder.js'];
        if (!document.getElementById('searchBuilderContainer')) { $('<div id="searchBuilderContainer"></div>').appendTo('body'); }
        // The builder's title icon, from the report page's sprite.
        if (!document.getElementById('pnbi-search')) {
            $('body').append('<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden" xmlns="http://www.w3.org/2000/svg"><defs>' +
                '<symbol id="pnbi-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></symbol></defs></svg>');
        }
        var chain = $.when.apply($, css.map(function (href) { return loadBuilderAsset('link', href); }));
        js.forEach(function (src) {
            if (/moment/i.test(src) && typeof window.moment === 'function') { return; }
            if (/jquery-ui/i.test(src) && $.fn.datepicker) { return; }
            chain = chain.then(function () { return loadBuilderAsset('script', src); });
        });
        _sbLoad = chain.then(null, function (err) { _sbLoad = null; return $.Deferred().reject(err).promise(); });
        return _sbLoad;
    }
    var _sbHadMods = '';
    // Tiles the builder cannot answer for YET: a data tile whose fetch is in
    // flight, a framed report near the viewport whose frame has not loaded (a
    // lazy frame below the fold never will, so it is not waited for). The
    // builder's column list is a snapshot taken when it opens, and an early
    // open used to show nothing and never fill (2026-09-30).
    function builderTilesPending() {
        var n = 0;
        for (var i = 0; i < DASH.tiles.length; i++) {
            var tl = DASH.tiles[i];
            if (tl.type === 'note' || tileStaticReach(tl)) { continue; }
            if (tl.type === 'embed') {
                var fr = $('#dashMain .dash-tile[data-tile-id="' + tl.id + '"] iframe.dash-embed');
                if (!fr.length || fr.data('pnbFrameLoaded') || tileFrameApi(tl)) { continue; }
                var r = fr[0].getBoundingClientRect();
                if (r.top < (window.innerHeight || 800) + 300) { n++; }
                continue;
            }
            if (!tl.report) { continue; }
            var e = dataCache[tileFetchKey(tl)];
            if (e && e.rows === null && e.error === null) { n++; }
        }
        return n;
    }
    // Resolves with the number of tiles still pending when the wait gave up.
    function waitForBuilderTiles(maxMs) {
        return new Promise(function (resolve) {
            var t0 = Date.now();
            (function poll() {
                var n = builderTilesPending();
                if (!n || Date.now() - t0 >= maxMs) { resolve(n); return; }
                $('#dashFilterNote').text('Loading the columns of ' + n + ' tile' + (n === 1 ? '' : 's') + '…');
                setTimeout(poll, 150);
            })();
        });
    }
    function openDashBuilder() {
        if (!$('#dashSearchInput').length) { return; }
        loadDashBuilder().then(function () {
            if (typeof window.openSearchBuilder !== 'function') { builderFailed(); return; }
            return waitForBuilderTiles(8000).then(function (left) {
            renderDashSearchNote();
            if (left) {
                var $note = $('#dashFilterNote');
                $note.text(($note.text() + ' ' + left + ' tile' + (left === 1 ? ' had' : 's had') + ' not loaded when the builder opened; reopen it for their columns.').trim());
            }
            _sbHadMods = (MOD_RUN.exec(String($('#dashSearchInput').val() || '')) || [''])[0];
            window.openSearchBuilder({
                target: '#dashSearchInput',
                includePresets: false,
                submitLabel: 'Apply',
                submitTitle: 'Apply this filter to every tile whose report has its columns',
                previewText: builderReach,
                onSubmit: function (q) {
                    // While it lists nested columns the builder shows its own __ROW
                    // box, ticked from the box when it opened (search_builder.js), so
                    // __ROW is then the builder's to keep or drop: putting it back
                    // would undo an untick.
                    var rowBox = document.getElementById('sbRowMatchLabel');
                    if (rowBox && getComputedStyle(rowBox).display !== 'none') { _sbHadMods = _sbHadMods.replace(/__ROW\s+/gi, ''); }
                    var out = keepModifiers(q, _sbHadMods);
                    if (out !== String(q == null ? '' : q).trim()) { $('#dashSearchInput').val(out); }
                    applyDashSearch(out);
                }
            });
            });
        }, builderFailed);
    }
    function builderFailed() {
        $('#dashFilterNote').text('The Visual Search Builder could not be loaded; type the filter in the box instead (or reload the page if you have been away).');
    }
    $(document).on('click', '#dashSearchBuilder', function (e) { e.preventDefault(); openDashBuilder(); });
    // The builder's "?" opens the Search help topic in this page's help panel,
    // over the builder, at the builder's section (2026-09-29: the help stays on
    // the dashboard). Any other topic opens the Help Center on the report page.
    $(document).on('click', '#searchBuilderLightbox .tab-help-icon', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tgt = String($(this).attr('data-target') || '').replace(/^#/, '') || 'searchHelpLightbox';
        if (LOCAL_HELP[tgt]) { openHelpPanel(tgt, $(this).attr('data-jump-to')); return; }
        window.open('index.php#help=' + encodeURIComponent(tgt), '_blank', 'noopener');
    });
    // Escape closes the builder (the report page's main.js does this there),
    // after its value list or date picker has had it - and after a help panel
    // opened over it. Capture phase on the window, so the page's own Escape
    // handling never sees it as well.
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' && e.key !== 'Esc') { return; }
        var lb = document.getElementById('searchBuilderLightbox');
        if (!lb || !$(lb).is(':visible') || $('#dashSsoLightbox').length || $('#dashHelpOverlay').length) { return; }
        if ($('#sbAutocompleteDropdown').is(':visible') || $('#ui-datepicker-div').is(':visible')) { return; }
        e.preventDefault();
        e.stopPropagation();
        $(lb).fadeOut();
    }, true);

    // Tile labels resolve the vocabulary a report title already knows (owner,
    // 2026-09-05): me() / me(attr) from the viewer's identity - same keys and
    // same default (fname) as the report's me(), a free-text argument having its
    // identity words replaced - and data(NAME) from the tile's effective prompt
    // answers (URL first), plus data(search) and data(report). Unknown -> ''.
    var SHIB = V.shibboleth || {};
    // me() / me(attr) -> the viewer's identity: the report's me() keys and its
    // default (first name, else the Unity ID). Shared by tile labels and the
    // dashboard filter (2026-09-30). missing, when given, collects the words
    // that resolved to nothing for this viewer.
    function resolveMeTokens(text, missing) {
        return String(text == null ? '' : text).replace(/\bme\(([^)]*)\)/gi, function (m, arg) {
            var a = String(arg || '').trim().replace(/^['"]|['"]$/g, ''), out;
            if (!a) { out = SHIB.fname || SHIB.unity || V.currentUserKey || ''; }
            else {
                var low = a.toLowerCase();
                if (Object.prototype.hasOwnProperty.call(SHIB, low)) { out = SHIB[low] || ''; }
                else {
                    out = a;
                    for (var k in SHIB) {
                        if (Object.prototype.hasOwnProperty.call(SHIB, k)) { out = out.replace(new RegExp('\\b' + k + '\\b', 'gi'), SHIB[k] || ''); }
                    }
                }
            }
            if (missing && !String(out || '').trim()) { missing.push(a || 'me'); }
            return out;
        });
    }
    // The dashboard's own default filter (Settings, 2026-09-30): DASH.filter in
    // the search grammar, me() words resolved for THIS viewer. '' when there is
    // none, or when a me() word has no value for the viewer (a half condition
    // would match nothing - the note under the box says why instead).
    var _defaultFilterMissing = [], _defaultApplied = null;
    function defaultFilterText() {
        var raw = (DASH && DASH.filter != null) ? String(DASH.filter).trim() : '';
        _defaultFilterMissing = [];
        if (!raw) { return ''; }
        var text = resolveMeTokens(raw, _defaultFilterMissing).trim();
        return _defaultFilterMissing.length ? '' : text;
    }
    // At boot and when the kiosk cycle swaps dashboards: a clean address applies
    // the default; an address with search= (even empty) is the filter as given.
    function applyDefaultFilter() {
        if (URL_SEARCH_SET) { return; }
        URL_SEARCH = defaultFilterText();
        _defaultApplied = URL_SEARCH;
    }
    function resolveLabel(text, tile) {
        var s = String(text || '');
        if (!s) { return s; }
        s = resolveMeTokens(s);
        s = s.replace(/\bdata\(([^)]*)\)/gi, function (m, arg) {
            var a = String(arg || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
            if (a === 'search') { return (tile && (URL_SEARCH || tile.search)) || ''; }
            if (a === 'report') { return (tile && tile.report) || ''; }
            var p = tile ? effPrompts(tile) : URL_PROMPTS;
            for (var pk in p) {
                if (Object.prototype.hasOwnProperty.call(p, pk) && pk.toLowerCase() === a) { return (p[pk] == null) ? '' : String(p[pk]); }
            }
            return '';
        });
        // Bare names (owner, 2026-09-06): a prompt or address parameter written on
        // its own - "Feed for pi_name", "for PI_NAME" - is replaced by its answer,
        // whole word, any case. Only names WITH an answer are touched, so an
        // unanswered name stays visible as the placeholder it is; longest names
        // first so "pi_name" is never eaten by a shorter "pi". data(NAME) remains
        // for a name that is also an ordinary word in the title.
        var bare = tile ? effPrompts(tile) : URL_PROMPTS;
        var keys = Object.keys(bare).filter(function (k) { return k && bare[k] != null && String(bare[k]) !== ''; })
                         .sort(function (a, b) { return b.length - a.length; });
        for (var bi = 0; bi < keys.length; bi++) {
            var bk = keys[bi];
            var re = new RegExp('\\b' + bk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
            s = s.replace(re, function () { return String(bare[bk]); });
        }
        return s;
    }
    function tileLabel(tile) {
        var raw = tile.label || (tile.type === 'note' || tile.type === 'controls' ? '' : (tile.report || (tile.url ? 'JSON URL' : 'Inline data')));
        return resolveLabel(raw, tile);
    }
    var IS_NEW = !V.found;
    var editMode = false;
    var dirty = false;
    // The settings panel's Theme select repaints the page the moment you pick
    // one ("Applies immediately" is the promise printed under it). That preview
    // is NOT a commit: closePanel() rolls the page back to DASH.theme unless
    // Apply cleared this flag first.
    var themePreviewing = false;

    // fetchKey -> { promise, rows, asOf, error, at } ; several tiles off one report
    // share ONE fetch per render cycle.
    var dataCache = {};
    var chartInstances = {};   // tileId -> Chart
    var refreshTimer = null;
    var _tileLastRefresh = {};   // tileId -> ms of last content render (per-tile refresh engine)
    var _dashGen = 0;            // bumped when a kiosk cycle swaps dashboards: stale tile fetches must not touch the new dashboard's charts (duplicated dashboards share tile ids)

    window.addEventListener('beforeunload', function (e) {
        if (dirty && !KIOSK) { e.preventDefault(); e.returnValue = ''; }
    });

    // =========================================================================
    // Data layer
    // =========================================================================
    // Table tiles only need their visible rows, so they ask the server for exactly
    // that (&limit=, sliced after the saved sort). The limit is part of the cache
    // key: a capped table fetch must never be handed to a stat/chart tile that
    // needs the full rowset.
    function tileRowLimit(tile) {
        return (tile.type === 'table') ? Math.min(Math.max(1, tile.rows || 10), 200) : 0;
    }
    // Cache key = source kind + identity (report id / URL / a hash of the inline
    // JSON) + prompts + limit, so tiles sharing one source share ONE fetch.
    function tileFetchKey(tile) {
        var src = T.effectiveSource(tile);
        var ident = (src === 'url') ? String(tile.url || '')
                  : (src === 'inline') ? T.hashStr(tile.json || '')
                  : String(tile.report || '');
        return src.charAt(0).toUpperCase() + ':' + ident + '|' +
               JSON.stringify(effPrompts(tile)) + '|' + tileRowLimit(tile) + '|' + tileSearchKey(tile);
    }

    // The fetch itself is the shared engine's (PenumbraTiles.fetchRows: live
    // ?json=1 with the VIEWER's session, newest snapshot, same-origin JSON URL,
    // inline JSON). This wrapper only adds the per-render cache and the entry
    // contract ({rows, asOf, totalRows, error}) the renderers and the builder read.
    function fetchTileData(tile, force) {
        var key = tileFetchKey(tile);
        if (!force && dataCache[key] && dataCache[key].promise) { return dataCache[key].promise; }

        if (force) { _ctlCountRows = Object.create(null); }   // fresh rows: fresh chip counts (2026-10-01)
        var entry = { rows: null, asOf: null, error: null, at: Date.now() };
        dataCache[key] = entry;

        var ss = tileSearchSpec(tile);
        _tileSearchSent[tile.id] = tileSearchKey(tile);
        var spec = { source: tile.source, report: tile.report, url: tile.url, json: tile.json,
                     prompts: effPrompts(tile), limit: tileRowLimit(tile),
                     search: ss.search, dsearch: ss.dsearch };   // the server filters the JSON rows (2026-09-05; routed fragments 2026-09-29)
        entry.promise = T.fetchRows(spec)
            .then(function (res) {
                entry.rows = res.rows;
                entry.asOf = res.asOf || null;
                // The true size when a &limit= trimmed (or the rowset's own length):
                // lets the tile footer report the real size while holding a slice.
                entry.totalRows = (typeof res.totalRows === 'number') ? res.totalRows : null;
                entry.searchSkipped = res.searchSkipped || null;   // dashboard-filter columns this report lacks
                entry.columns = res.columns || null;
                noteColsSeen(tile, res.columns);                    // the report's columns, rows or none (2026-09-30)
                noteRowsSeen(tile, ss, res.rows, spec.limit);      // the Visual Search Builder's columns and values
                scheduleControls();                                 // and a Controls tile's chips
                return entry;
            })
            .catch(function (err) {
                // A 403 means the VIEWER lacks access to the source report: the
                // fail-closed case (the message is the engine's).
                entry.error = T.errorMessage(err);
                throw entry;
            });
        return entry.promise;
    }

    // -------------------------------------------------------------------------
    // Trend data: one stat computed across a report's SNAPSHOT HISTORY - change
    // over time from data the scheduler is already capturing.
    //
    // Two paths, very different costs:
    //  - agg = count  -> the snapshot LIST already carries ROW_COUNT per snapshot,
    //    so the whole trend needs ZERO payload loads.
    //  - anything else -> each snapshot's CLOB is loaded and aggregated, one at a
    //    time (sequential on purpose: N parallel CLOB reads per tile, times several
    //    tiles, is how a dashboard becomes a stampede).
    // Points are capped (2..24) and ordered oldest-first for the axis.
    // -------------------------------------------------------------------------
    function trendFetchKey(tile) {
        return 'T:' + tile.report + '|' + (tile.agg || 'count') + '|' + (tile.column || '') + '|' + (tile.points || 12);
    }
    function fetchTrendData(tile, force) {
        var key = trendFetchKey(tile);
        if (!force && dataCache[key] && dataCache[key].promise) { return dataCache[key].promise; }

        var entry = { points: null, error: null, at: Date.now() };
        dataCache[key] = entry;
        var wanted = Math.min(Math.max(2, tile.points || 12), 24);

        entry.promise = $.getJSON('manage_snapshots.php', { action: 'list', report_id: tile.report })
            .then(function (resp) {
                var list = (resp && resp.status === 'success' && resp.data) ? resp.data.slice() : [];
                if (list.length < 2) { throw new Error('Trends need at least 2 snapshots of the source report (the Scheduler can create them on a schedule).'); }
                list.sort(function (a, b) { return String(a.CREATED_AT || '') < String(b.CREATED_AT || '') ? -1 : 1; });
                list = list.slice(-wanted);   // newest N, oldest-first

                if ((tile.agg || 'count') === 'count') {
                    entry.points = list.map(function (s) {
                        return { at: String(s.CREATED_AT || ''), value: parseInt(s.ROW_COUNT, 10) || 0 };
                    });
                    return entry;
                }

                // Sequential load+aggregate chain.
                var points = [];
                var chain = $.Deferred().resolve().promise();
                list.forEach(function (s) {
                    chain = chain.then(function () {
                        return $.getJSON('manage_snapshots.php', { action: 'load', snap_id: s.ID }).then(function (r) {
                            if (!r || r.status !== 'success' || !r.data) { throw new Error((r && r.message) || 'Snapshot load failed.'); }
                            var rows;
                            try { rows = JSON.parse(r.data.SNAP_DATA); } catch (e) { rows = null; }
                            if (!rows || Object.prototype.toString.call(rows) !== '[object Array]') {
                                throw new Error('A snapshot payload could not be read (encrypted reports are not supported).');
                            }
                            points.push({ at: String(s.CREATED_AT || ''), value: computeStat(rows, tile.agg, tile.column) });
                        });
                    });
                });
                return chain.then(function () { entry.points = points; return entry; });
            })
            .catch(function (err) {
                entry.error = (err && err.message) ? err.message
                            : (err && err.status === 403) ? 'You do not have access to the source report.'
                            : 'Could not load snapshot history.';
                throw entry;
            });
        return entry.promise;
    }

    // =========================================================================
    // Aggregation + palette: the shared engine's (summary-engine vocabulary,
    // theme-derived colors). Trend tiles still aggregate here via computeStat.
    // =========================================================================
    var computeStat = T.computeStat;
    var sniffColumns = T.sniffColumns;
    var palette = T.palette;

    // =========================================================================
    // Rendering
    // =========================================================================
    // The grid IS the percent system: 12 fr-unit columns, so a span of 3 is 25% of
    // the page on every display. Free spans since drag-resize landed (was a preset
    // list); rows are fixed 68px tracks, also display-independent.
    // Row unit halved 2026-09-05 (was 150px): the vertical resize jump was too
    // coarse. 68 is not arbitrary - two 68px rows plus the 14px gap between them
    // is EXACTLY one old 150px row, so every saved layout maps by doubling h
    // (normalizeGridUnits) and renders pixel-identical to before.
    var GRID_COLS = 12, GRID_ROW_H = 68, GRID_GAP = 14, MAX_ROWS = 80;
    function clampW(w) { w = parseInt(w, 10) || 4; return Math.max(1, Math.min(GRID_COLS, w)); }
    function clampH(h) { h = parseInt(h, 10) || 2; return Math.max(1, Math.min(MAX_ROWS, h)); }
    // Saved states carry `rowH`: the row unit their h spans were authored in.
    // Absent (or 150) means the pre-09-05 unit - double every span, once, and
    // stamp the state so the next Save persists the new unit. Idempotent.
    function normalizeGridUnits(st) {
        if (!st || typeof st !== 'object') { return st; }
        if (parseInt(st.rowH, 10) === GRID_ROW_H) { return st; }
        var tiles = Array.isArray(st.tiles) ? st.tiles : [];
        for (var i = 0; i < tiles.length; i++) {
            if (!tiles[i] || typeof tiles[i] !== 'object') { continue; }
            tiles[i].h = Math.max(1, (parseInt(tiles[i].h, 10) || 1) * 2);
        }
        st.rowH = GRID_ROW_H;
        return st;
    }
    normalizeGridUnits(DASH);
    // Tablet tier (2026-09-05): between the phone breakpoint (<=900px, one
    // column) and 1200px the grid runs SIX columns and every stored 12-column
    // span is halved (rounded up), so a half-width tile stays half-width instead
    // of squeezing to a sliver. View mode only - the builder always works on the
    // real 12-column grid, so what an author drags is what is stored.
    var TABLET_MQ = window.matchMedia ? window.matchMedia('(min-width: 901px) and (max-width: 1200px)') : null;
    function gridCols() { return (TABLET_MQ && TABLET_MQ.matches && !editMode) ? 6 : GRID_COLS; }
    function colSpan(tile) {
        var w = clampW(tile.w);
        return gridCols() === 6 ? Math.max(1, Math.ceil(w / 2)) : w;
    }
    function tileSpanStyle(tile) {
        return 'grid-column: span ' + colSpan(tile) + '; grid-row: span ' + clampH(tile.h) + ';';
    }
    // Re-derive every tile's column span in place (no re-render, no iframe
    // reload) - on a viewport crossing and on every edit-mode toggle.
    function applyGridCols() {
        var six = gridCols() === 6;
        $('body').toggleClass('dash-cols-6', six);
        $('#dashMain .dash-tile').each(function () {
            var t = DASH.tiles[tileIndexById($(this).attr('data-tile-id'))];
            if (t) { this.style.gridColumn = 'span ' + colSpan(t); }
        });
    }
    if (TABLET_MQ) {
        if (TABLET_MQ.addEventListener) { TABLET_MQ.addEventListener('change', applyGridCols); }
        else if (TABLET_MQ.addListener) { TABLET_MQ.addListener(applyGridCols); }
    }

    // Live size readout while a tile is resized (and after a keyboard nudge):
    // the snap is finer since the row unit halved, so the number says what the
    // eye cannot. "6 x 4" = column span x row span. Removed on mouseup.
    var _chipTimer = null;
    function showSizeChip($tile, w, h, autoHide) {
        var $c = $tile.children('.dash-size-chip');
        if (!$c.length) { $c = $('<span class="dash-size-chip" aria-hidden="true"></span>').appendTo($tile); }
        $c.text(w + ' × ' + h);
        clearTimeout(_chipTimer);
        if (autoHide) { _chipTimer = setTimeout(function () { $c.remove(); }, 1100); }
    }
    function hideSizeChip($tile) { clearTimeout(_chipTimer); $tile.children('.dash-size-chip').remove(); }

    // -------------------------------------------------------------------------
    // Drag-to-resize (edit mode). The drag is free but the RESULT snaps to grid
    // tracks live, so what the author sees mid-drag is exactly what every other
    // display gets - no pixel sizes are ever stored.
    // -------------------------------------------------------------------------
    var _rz = null;   // { idx, $tile, startX, startY, startW, startH, colUnit }
    $(document).on('mousedown', '.dash-resize', function (e) {
        if (e.button !== 0) { return; }
        e.preventDefault();
        e.stopPropagation();
        var $tile = $(this).closest('.dash-tile');
        var idx = -1;
        var id = $tile.attr('data-tile-id');
        for (var i = 0; i < DASH.tiles.length; i++) { if (DASH.tiles[i].id === id) { idx = i; break; } }
        if (idx === -1) { return; }
        var $grid = $tile.closest('.dash-grid');
        _rz = {
            idx: idx,
            $tile: $tile,
            startX: e.pageX,
            startY: e.pageY,
            startW: clampW(DASH.tiles[idx].w),
            startH: clampH(DASH.tiles[idx].h),
            colUnit: ($grid[0].clientWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS + GRID_GAP
        };
        $('body').addClass('dash-resizing');
    });
    $(document).on('mousemove.dashResize', function (e) {
        if (!_rz) { return; }
        var w = clampW(_rz.startW + Math.round((e.pageX - _rz.startX) / _rz.colUnit));
        var h = clampH(_rz.startH + Math.round((e.pageY - _rz.startY) / (GRID_ROW_H + GRID_GAP)));
        _rz.$tile.css({ 'grid-column': 'span ' + w, 'grid-row': 'span ' + h });
        _rz.live = { w: w, h: h };
        showSizeChip(_rz.$tile, w, h, false);
    });
    $(document).on('mouseup.dashResize', function () {
        if (!_rz) { return; }
        hideSizeChip(_rz.$tile);
        if (_rz.live && (_rz.live.w !== _rz.startW || _rz.live.h !== _rz.startH)) {
            DASH.tiles[_rz.idx].w = _rz.live.w;
            DASH.tiles[_rz.idx].h = _rz.live.h;
            dirty = true;
            // Charts observe their container and reflow on their own; embeds with
            // auto-height re-measure on the next content resize tick.
        }
        $('body').removeClass('dash-resizing');
        _rz = null;
    });

    // -------------------------------------------------------------------------
    // Keyboard (2026-09-05). The header buttons' tooltips name the keys. Never
    // while typing, never with a panel open, never in kiosk (Esc / the corner x
    // are its exits). Edit mode adds a SELECTED tile: click a tile to select it,
    // the arrow keys resize it one span at a time, Shift+Left/Right move it
    // earlier/later in the order, Esc clears the selection.
    // -------------------------------------------------------------------------
    var _selTileId = null;
    function selectTile(id) {
        _selTileId = id || null;
        $('#dashMain .dash-tile').removeClass('dash-tile-selected');
        if (_selTileId) { $('#dashMain .dash-tile[data-tile-id="' + _selTileId + '"]').addClass('dash-tile-selected'); }
    }
    $(document).on('click', '.dash-grid-edit .dash-tile', function (e) {
        if ($(e.target).closest('button, a, .dash-resize, iframe, input, select, textarea').length) { return; }
        var id = $(this).attr('data-tile-id');
        selectTile(id === _selTileId ? null : id);
    });
    // Keyboard: focus landing anywhere in a tile (the tile itself, or one of its
    // head buttons) selects it, so the arrow keys have something to resize.
    // Native capture listener, not a jQuery-delegated focusin: jQuery's focus
    // leverage does not see a programmatic focus() reliably (verified 2026-09-09).
    document.addEventListener('focusin', function (e) {
        var tile = e.target && e.target.closest ? e.target.closest('.dash-grid-edit .dash-tile') : null;
        if (!tile) { return; }
        var id = tile.getAttribute('data-tile-id');
        if (id && id !== _selTileId) { selectTile(id); }
    }, true);
    // A visually hidden polite live region for state that is otherwise only
    // visual: the size readout while nudging, a stale badge, a failed refresh.
    function dashAnnounce(msg) {
        var el = document.getElementById('dashLive');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dashLive'; el.className = 'sr-only';
            el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true');
            document.body.appendChild(el);
        }
        el.textContent = '';
        setTimeout(function () { el.textContent = String(msg || ''); }, 30);
    }
    function nudgeSelected(key, shift) {
        if (!_selTileId) { return false; }
        var idx = tileIndexById(_selTileId);
        var $tile = $('#dashMain .dash-tile[data-tile-id="' + _selTileId + '"]');
        if (idx === -1 || !$tile.length) { return false; }
        if (shift && (key === 'ArrowLeft' || key === 'ArrowRight')) {
            // The head's own move buttons: same code path as a click, the node
            // moves in place and keeps its selection.
            $tile.find('.dash-tt-btn[data-act="' + (key === 'ArrowLeft' ? 'left' : 'right') + '"]').trigger('click');
            return true;
        }
        var t = DASH.tiles[idx];
        var w0 = clampW(t.w), h0 = clampH(t.h), w = w0, h = h0;
        // NOT clampW/clampH here: their `|| default` treats 0 as "unset".
        if (key === 'ArrowLeft') { w = Math.max(1, w - 1); }
        else if (key === 'ArrowRight') { w = Math.min(GRID_COLS, w + 1); }
        else if (key === 'ArrowUp') { h = Math.max(1, h - 1); }
        else if (key === 'ArrowDown') { h = Math.min(MAX_ROWS, h + 1); }
        else { return false; }
        if (w !== w0 || h !== h0) {
            t.w = w; t.h = h; dirty = true;
            $tile.css({ 'grid-column': 'span ' + w, 'grid-row': 'span ' + h });
        }
        showSizeChip($tile, w, h, true);
        dashAnnounce(w + ' by ' + h);
        return true;
    }

    // -------------------------------------------------------------------------
    // Drag-to-reorder (edit mode). Grab a tile by its head (anywhere that isn't
    // a button/link) and drop it on another tile: the LEFT half of the target
    // means "insert before", the right half "insert after" - an edge highlight
    // shows which while dragging. The source tile stays put during the drag -
    // the pointer is the ghost - so elementFromPoint under the cursor is the
    // drop target, not the source.
    // -------------------------------------------------------------------------
    function tileIndexById(id) {
        for (var i = 0; i < DASH.tiles.length; i++) { if (DASH.tiles[i].id === id) { return i; } }
        return -1;
    }
    function tileUnderPoint(x, y) {
        var el = document.elementFromPoint(x, y);
        if (!el) { return null; }
        var $t = $(el).closest('.dash-tile');
        return $t.length ? $t : null;
    }
    var _mv = null;   // { idx, $tile, startX, startY, started }
    $(document).on('mousedown', '.dash-grid-edit .dash-tile-head', function (e) {
        if (e.button !== 0 || _rz) { return; }
        if ($(e.target).closest('button, a, input, select, textarea').length) { return; }
        var $tile = $(this).closest('.dash-tile');
        var idx = tileIndexById($tile.attr('data-tile-id'));
        if (idx === -1) { return; }
        e.preventDefault();
        _mv = { idx: idx, $tile: $tile, startX: e.pageX, startY: e.pageY, started: false };
    });
    function dropSide($t, clientX) {
        var r = $t[0].getBoundingClientRect();
        return (clientX - r.left) < r.width / 2 ? 'before' : 'after';
    }
    $(document).on('mousemove.dashMove', function (e) {
        if (!_mv) { return; }
        if (!_mv.started) {
            // 5px dead zone so plain clicks on the head never start a drag.
            if (Math.abs(e.pageX - _mv.startX) < 5 && Math.abs(e.pageY - _mv.startY) < 5) { return; }
            _mv.started = true;
            _mv.$tile.addClass('dash-drag-src');
            $('body').addClass('dash-dragging');   // also kills iframe pointer-events
        }
        var $t = tileUnderPoint(e.clientX, e.clientY);
        $('.dash-drop-before, .dash-drop-after').removeClass('dash-drop-before dash-drop-after');
        if ($t && $t[0] !== _mv.$tile[0]) {
            $t.addClass(dropSide($t, e.clientX) === 'before' ? 'dash-drop-before' : 'dash-drop-after');
        }
    });
    $(document).on('mouseup.dashMove', function (e) {
        if (!_mv) { return; }
        var mv = _mv;
        _mv = null;
        $('body').removeClass('dash-dragging');
        $('.dash-drop-before, .dash-drop-after').removeClass('dash-drop-before dash-drop-after');
        mv.$tile.removeClass('dash-drag-src');
        if (!mv.started) { return; }
        var $t = tileUnderPoint(e.clientX, e.clientY);
        if (!$t || $t[0] === mv.$tile[0]) { return; }
        var side = dropSide($t, e.clientX);
        var targetId = $t.attr('data-tile-id');
        var moved = DASH.tiles.splice(mv.idx, 1)[0];
        var at = tileIndexById(targetId);   // recomputed AFTER the splice
        if (at === -1) { DASH.tiles.splice(mv.idx, 0, moved); return; }   // target vanished: restore
        if (side === 'after') { at++; }
        DASH.tiles.splice(at, 0, moved);
        dirty = true;
        // Move ONLY the dragged node - its own iframe reloads (browsers reload
        // relocated frames), but every other tile keeps its loaded state.
        if (side === 'before') { mv.$tile.insertBefore($t); } else { mv.$tile.insertAfter($t); }
    });

    // Shared chrome builders: tileChrome (full-tile HTML for fresh renders) and
    // setEditMode's in-place toggle both use these, so the two can never drift.
    var RESIZE_HANDLE_HTML = '<span class="dash-resize" title="Drag to resize (snaps to the grid, so it looks the same on every display)" aria-hidden="true"></span>';
    // The door to the Dashboards help topic. In the header bar it is a labelled
    // button like its neighbours (Refresh / Kiosk / Edit) and like the home
    // dock's "Help Center"; inside the panels the small ring, as on every dialog
    // head (owner's call, 2026-09-05). Both are plain links: the Help Center
    // markup lives on the report page, which opens it at the topic via #help=.
    // Both open the Dashboards topic IN A PANEL ON THIS PAGE (owner, 2026-09-06:
    // leaving the dashboard to read about the dashboard was the wrong trade);
    // the panel's own link opens the whole Help Center on the report page via
    // its #help= deep link, for search and the other topics.
    var DASH_HELP_HREF = 'index.php#help=dashboardsHelpLightbox';
    // Its "(H)" and aria-keyshortcuts follow the single-key switch (keyHints()).
    function dashHelpLink(kh) {
        return '<button type="button" class="dash-btn dash-help-link" id="dashHelpBtn"' + kh.attr('h') + ' ' +
               'title="Help for dashboards: tiles, address parameters, title tokens, keyboard, kiosk' + kh.tip('h') + '">? Help</button>';
    }

    // The help panel: help_content.php (the same fragment set the report page
    // lazy-loads) fetched once per page, one topic lifted out of it. The topics a
    // dashboard reader needs open HERE (owner: Dashboards 2026-09-06, Search
    // 2026-09-29 - the filter box speaks the search syntax, and reading about it
    // must not mean leaving the dashboard); any other topic opens the whole Help
    // Center on the report page. A SEPARATE overlay from #dashOverlay so it
    // stacks over an open tile editor without closing it (and losing the edits),
    // and over the Visual Search Builder. Scripts are stripped before the fragment
    // is parsed: the topic is prose, and jQuery's .html() would run them.
    var LOCAL_HELP = { dashboardsHelpLightbox: 'Dashboards help', searchHelpLightbox: 'Search help' };
    var _helpHtml = null;
    function closeHelpPanel() { $('#dashHelpOverlay').remove(); }
    // A heading of the open topic, scrolled to the top of the panel.
    function helpJump(id) {
        var $body = $('#dashHelpOverlay .dash-help-body'), el = id ? document.getElementById(id) : null;
        if (!el || !$body.length || !$.contains($body[0], el)) { return; }
        $body.scrollTop($body.scrollTop() + el.getBoundingClientRect().top - $body[0].getBoundingClientRect().top - 8);
    }
    // topic: a LOCAL_HELP key (default: Dashboards); jumpTo: an id inside it.
    function openHelpPanel(topic, jumpTo) {
        topic = (topic && LOCAL_HELP[topic]) ? topic : 'dashboardsHelpLightbox';
        closeHelpPanel();
        var href = 'index.php#help=' + topic;
        var full = '<a class="dash-help-full" href="' + href + '" target="_blank" rel="noopener" ' +
                   'title="The whole Help Center - every topic and search - opens on the report page in a new tab">Full Help Center &#8599;</a>';
        $('body').append(
            '<div class="dash-overlay" id="dashHelpOverlay" data-topic="' + topic + '"><div class="dash-panel dash-panel-wide" role="dialog" aria-modal="true" data-pnb-modal="1" aria-label="' + LOCAL_HELP[topic] + '">' +
            '<div class="dash-panel-head"><h2>' + LOCAL_HELP[topic] + '</h2>' + full +
            '<button type="button" class="dash-help-close penumbra-fs-dialog-close" title="Close (Esc)" aria-label="Close">&times;</button></div>' +
            '<div class="dash-panel-body dash-help-body"><div class="dash-tile-wait"><span class="dash-spin"></span></div></div>' +
            '</div></div>');
        $('#dashHelpOverlay .dash-panel').attr('tabindex', '-1').focus();
        if (window.PenumbraA11y) { window.PenumbraA11y.sweep(); }
        function fail() {
            $('#dashHelpOverlay .dash-help-body').html('<div class="dash-tile-err">The help text could not be loaded. ' +
                '<a href="' + href + '" target="_blank" rel="noopener">Open the Help Center</a> instead.</div>');
        }
        function render(html) {
            var $doc = $('<div>').html(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ''));
            var $topic = $doc.find('#' + topic + ' .lightbox-content');
            if (!$topic.length) { fail(); return; }
            $topic.find('.close-lightbox').remove();
            $topic.find('h3').first().remove();   // the panel head already names the topic
            // Cross-topic links are hub-only triggers on the report page: a topic
            // this page shows opens in this panel, any other opens the hub there.
            $topic.find('a.pnb-help-open, a[data-target], .tab-help-icon').each(function () {
                var tgt = String($(this).attr('data-target') || '').replace(/^#/, '');
                if (LOCAL_HELP[tgt]) { $(this).attr({ href: '#', 'data-dash-help': tgt }).removeAttr('target'); }
                else { $(this).attr({ href: 'index.php#help=' + (tgt || 'whatIsPenumbraLightbox'), target: '_blank', rel: 'noopener' }); }
            });
            $('#dashHelpOverlay .dash-help-body').html((topic === 'dashboardsHelpLightbox'
                // WCAG 2.1.4: single-character shortcuts must be switchable off.
                ? '<label class="dash-keys-toggle"><input type="checkbox" id="dashKeysToggle"' + (dashKeysOff() ? '' : ' checked') + '> ' +
                  'Single-key shortcuts (R, H, K, E, A, S, P here; on a report press ? for its keys; r and 1 to 4 on Health)</label>'
                : '') + $topic.html());
            helpJump(jumpTo);
        }
        if (_helpHtml !== null) { render(_helpHtml); return; }
        $.get('help_content.php', function (html) {
            _helpHtml = (typeof html === 'string') ? html : '';
            if ($('#dashHelpOverlay').length) { render(_helpHtml); }
        }).fail(fail);
    }
    $(document).on('click', '#dashHelpBtn, .dash-panel-help', function (e) { e.preventDefault(); openHelpPanel(); });
    $(document).on('click', '.dash-help-close', closeHelpPanel);
    // Inside the panel: the topic's own jump index, and links to the other local topic.
    $(document).on('click', '#dashHelpOverlay a[data-jump-to]', function (e) { e.preventDefault(); helpJump($(this).attr('data-jump-to')); });
    $(document).on('click', '#dashHelpOverlay [data-dash-help]', function (e) {
        e.preventDefault();
        openHelpPanel($(this).attr('data-dash-help'), $(this).attr('data-jump-to'));
    });
    $(document).on('change', '#dashKeysToggle', function () {
        try { localStorage.setItem('pnb_single_keys', this.checked ? 'on' : 'off'); } catch (e) { }
        renderHead();   // the header's key hints follow the switch at once
    });
    function dashKeysOff() {
        try { return localStorage.getItem('pnb_single_keys') === 'off'; } catch (e) { return false; }
    }
    // Single-key hints (2026-09-25): a header button names its key - in its
    // tooltip and its aria-keyshortcuts - only while that key works: the
    // shared switch on (WCAG 2.1.4) and a dashboard open (the list page has no
    // keys). Read once per render so every button agrees.
    function keyHints() {
        var on = !!V.shortId && !dashKeysOff();
        return {
            tip: function (k) { return on ? ' (' + k.toUpperCase() + ')' : ''; },
            attr: function (k) { return on ? ' aria-keyshortcuts="' + k + '"' : ''; }
        };
    }
    $(document).on('mousedown', '#dashHelpOverlay', function (e) { if (e.target === this) { closeHelpPanel(); } });

    // Sectional embeds (header-only / table-only / single-chart) are meant to
    // read as PART of the dashboard, not as a framed thing: outside edit mode
    // they drop the tile head entirely (the framed section carries its own
    // identity). Edit mode keeps the head - the tools live there.
    function tileIsSection(tile) {
        // Chart embeds left this list 2026-09-05: the frame's carousel title band
        // duplicated the tile label (and cost the chart 48px), so the band is now
        // hidden in-frame (main.css .cc-persistent) and the tile keeps its normal
        // head - label, open link, tools - like every data tile.
        return (tile.type === 'embed' && (tile.show === 'header' || tile.show === 'table'));
    }

    function tileHeadHtml(tile, idx) {
        var label = tileLabel(tile);   // me() / data(NAME) resolved; the editor keeps the raw text
        var srcBadge = '';
        // Badge vocabulary is the engine's (history / embedded / snapshot / JSON
        // URL / inline data); plain live report tiles carry none.
        var badge = (tile.type === 'note' || tile.type === 'controls') ? { text: '' } : T.sourceBadge(tile);
        if (badge.text) {
            srcBadge = '<span class="dash-src-badge" title="' + escapeHtml(badge.title) + '">' + escapeHtml(badge.text) + '</span>';
        }
        var editBar = '';
        if (editMode) {
            editBar =
                '<span class="dash-tile-tools">' +
                '<button type="button" class="dash-tt-btn" data-act="left" data-idx="' + idx + '" title="Move earlier" aria-label="Move tile earlier">&#9664;</button>' +
                '<button type="button" class="dash-tt-btn" data-act="right" data-idx="' + idx + '" title="Move later" aria-label="Move tile later">&#9654;</button>' +
                '<button type="button" class="dash-tt-btn" data-act="edit" data-idx="' + idx + '" title="Edit tile" aria-label="Edit tile">&#9998;</button>' +
                '<button type="button" class="dash-tt-btn" data-act="dupe" data-idx="' + idx + '" title="Duplicate tile" aria-label="Duplicate tile">&#10697;</button>' +
                '<button type="button" class="dash-tt-btn dash-tt-danger" data-act="remove" data-idx="' + idx + '" title="Remove tile" aria-label="Remove tile">&#10005;</button>' +
                '</span>';
        } else if (false) {
            // The keyboard way to a chart's cross-filter (WCAG 2.1.1, 2026-10-15):
            // a menu of its values. In .dash-tile-tools so print hides it too.
            editBar =
                '<span class="dash-tile-tools">' +
                '<button type="button" class="dash-tt-btn dash-xf-btn" aria-haspopup="menu" aria-expanded="false"' +
                ' title="Filter the dashboard by a value in this chart" aria-label="Filter the dashboard by a value in ' + escapeHtml(label) + '">Filter</button>' +
                '</span>';
        }
        var openLink = '';
        if (tile.type !== 'note' && tile.report) {
            // Prompts, an embed's search pre-filter and the via attribution (the
            // report's OPEN audit names this dashboard) ride along - engine-built so
            // the infobox's tile links are identical.
            var href = T.openUrl(effTile(tile), { via: 'dashboard ' + (META.short_id || V.shortId || '') });
            openLink = '<a class="dash-tile-open" href="' + escapeHtml(href) + '" target="_blank" rel="noopener" title="Open the source report (with this tile&#39;s prompt values)" aria-label="Open the source report">&#8599;</a>';
        }
        return '<div class="dash-tile-head">' +
               // A heading, so screen-reader users can jump tile to tile (h1 is the dashboard title).
               '<h2 class="dash-tile-label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</h2>' +
               srcBadge + editBar + openLink +
               '</div>';
    }

    function tileChrome(tile, idx) {
        var isSection = tileIsSection(tile);
        var bare = isSection && !editMode;
        var classes = 'dash-tile dash-tile-' + escapeHtml(tile.type) +
                      (isSection ? ' dash-tile-embed-sect' : '') +
                      (tile.type === 'embed' && tile.show === 'chart' ? ' dash-tile-embed-chart' : '') +
                      (bare ? ' dash-tile-bare' : '');
        return '<div class="' + classes + '" data-tile-id="' + escapeHtml(tile.id) + '"' +
               // Edit mode: the tile itself takes focus, so the arrow-key resize and
               // Shift+Left/Right move have a keyboard way in (WCAG 2.1.1).
               (editMode ? ' tabindex="0" role="group" aria-label="' + escapeHtml(tileLabel(tile)) + ' tile. Arrow keys resize it, Shift plus Left or Right move it"' : '') +
               ' style="' + tileSpanStyle(tile) + '">' +
               (bare ? '' : tileHeadHtml(tile, idx)) +
               '<div class="dash-tile-body"><div class="dash-tile-wait"><span class="dash-spin"></span></div></div>' +
               '<div class="dash-tile-foot"></div>' +
               (editMode ? RESIZE_HANDLE_HTML : '') +
               '</div>';
    }

    function renderTileError($tile, msg) {
        $tile.removeData('hasData').removeClass('dash-tile-stale').find('.dash-stale-badge').remove();
        $tile.find('.dash-tile-body').html('<div class="dash-tile-err">' + escapeHtml(msg) + '</div>');
        dashAnnounce(($tile.find('.dash-tile-label').text() || 'A tile') + ': ' + msg);
    }
    // A fetch that FAILS on a tile that has rendered data before keeps that data
    // and wears a "stale HH:MM" badge (the error in its tooltip) instead of
    // swapping a wall-display card for an error box (2026-09-05). A first load,
    // or a render error on rows that did arrive, still shows the error.
    function tileFailed($tile, msg) {
        if (!$tile.data('hasData')) { renderTileError($tile, msg); return; }
        var d = new Date();
        var hhmm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        $tile.addClass('dash-tile-stale');
        var $b = $tile.find('.dash-stale-badge');
        if (!$b.length) { $b = $('<span class="dash-stale-badge"></span>').appendTo($tile.find('.dash-tile-head')); }
        var why = 'Refresh failed at ' + hhmm + ': ' + msg + '. Showing the last data that loaded.';
        // The reason is text for screen readers too, not a tooltip only (WCAG 1.3.1 / 4.1.3).
        $b.attr('title', why).html('stale ' + hhmm + '<span class="sr-only">. ' + escapeHtml(why) + '</span>');
        dashAnnounce(($tile.find('.dash-tile-label').text() || 'A tile') + ': ' + why);
    }
    function tileFresh($tile) {
        $tile.data('hasData', true).removeClass('dash-tile-stale').find('.dash-stale-badge').remove();
    }

    // -------------------------------------------------------------------------
    // Embed auto-height: size the iframe to its CONTENT so nothing scrolls inside
    // the tile - the dashboard page scrolls instead (explicitly preferred on small
    // viewports, where the grid is single-column and the tile just grows).
    //
    // Same-origin (XFO SAMEORIGIN), so the parent may read the framed document.
    // The iframe gets an exact pixel height; on desktop the tile's ROW SPAN is
    // then snapped to cover it, keeping the grid's no-overlap flow intact. A
    // ResizeObserver on the framed <html> follows later changes (searches,
    // pagination, 'All' rows) with a debounce. Observers are tracked per tile and
    // swept on re-render so detached documents never keep them alive.
    // -------------------------------------------------------------------------
    var embedObservers = {};   // tileId -> { ro, timer, poll, doc }
    function sweepEmbedObservers() {
        for (var k in embedObservers) {
            if (Object.prototype.hasOwnProperty.call(embedObservers, k)) {
                try { if (embedObservers[k].ro) { embedObservers[k].ro.disconnect(); } } catch (e) {}
                clearTimeout(embedObservers[k].timer);
                clearInterval(embedObservers[k].poll);
            }
        }
        embedObservers = {};
    }
    function sweepTileObserver(id) {
        if (!embedObservers[id]) { return; }
        try { if (embedObservers[id].ro) { embedObservers[id].ro.disconnect(); } } catch (e) {}
        clearTimeout(embedObservers[id].timer);
        clearInterval(embedObservers[id].poll);
        delete embedObservers[id];
    }

    // ── Surgical re-renders ──────────────────────────────────────────────────
    // renderDash() rebuilds the whole grid, which recreates every embed IFRAME
    // - each one a full report load. Editing must not cost that: these helpers
    // touch ONLY the affected tile's DOM, leaving every other tile's iframe
    // (and its loaded state) alone. Any structural surprise falls back to the
    // full render.
    function rebuildTile(id) {
        var idx = tileIndexById(id);
        var $grid = $('#dashMain .dash-grid');
        var $old = $grid.find('.dash-tile[data-tile-id="' + id + '"]');
        if (idx === -1 || !$grid.length || !$old.length) { renderDash(); return; }
        sweepTileObserver(id);
        var $fresh = $(tileChrome(DASH.tiles[idx], idx));
        $old.replaceWith($fresh);
        renderTileInto($fresh, DASH.tiles[idx]);
    }
    function insertTileNode(id, $afterTile) {
        var idx = tileIndexById(id);
        var $grid = $('#dashMain .dash-grid');
        // No grid yet = the dashboard was empty (the empty-state card is in
        // #dashMain instead) - the full render builds the grid around tile #1.
        if (idx === -1 || !$grid.length) { renderDash(); return; }
        var $fresh = $(tileChrome(DASH.tiles[idx], idx));
        if ($afterTile && $afterTile.length) { $fresh.insertAfter($afterTile); }
        else { $fresh.appendTo($grid); }
        renderTileInto($fresh, DASH.tiles[idx]);
    }

    // Enter/leave edit mode WITHOUT rebuilding the grid: toggle the grid
    // class and swap each tile's chrome (head with tools, resize grip, bare
    // sectional state) in place. The tile BODY - and any iframe inside it -
    // is never touched, so embeds don't reload just because the user wants
    // to rearrange things.
    function setEditMode(on) {
        editMode = on;
        renderHead();
        var $grid = $('#dashMain .dash-grid');
        if (!$grid.length) { renderDash(); return; }   // empty state has mode-specific copy
        $grid.toggleClass('dash-grid-edit', on);
        if (!on) { selectTile(null); }
        applyGridCols();   // the tablet tier is view-mode only: 12 columns while editing
        for (var i = 0; i < DASH.tiles.length; i++) {
            var t = DASH.tiles[i];
            var $tile = $grid.children('.dash-tile[data-tile-id="' + t.id + '"]');
            if (!$tile.length) { continue; }
            var bare = tileIsSection(t) && !on;
            $tile.toggleClass('dash-tile-bare', bare);
            if (on) { $tile.attr({ tabindex: '0', role: 'group', 'aria-label': tileLabel(t) + ' tile. Arrow keys resize it, Shift plus Left or Right move it' }); }
            else { $tile.removeAttr('tabindex role aria-label'); }
            $tile.children('.dash-tile-head').remove();
            if (!bare) { $tile.prepend(tileHeadHtml(t, i)); }
            $tile.children('.dash-resize').remove();
            if (on) { $tile.append(RESIZE_HANDLE_HTML); }
            // Sectional embeds just grew or lost their head row - re-snap the
            // auto-height span to the new content height (does NOT reload the
            // frame; autoSizeEmbed only re-measures and re-observes).
            if (t.type === 'embed' && t.autoHeight) { autoSizeEmbed($tile, t); }
        }
    }
    function autoSizeEmbed($tile, tile) {
        var iframe = $tile.find('iframe.dash-embed')[0];
        if (!iframe) { return; }
        if (embedObservers[tile.id]) {
            try { if (embedObservers[tile.id].ro) { embedObservers[tile.id].ro.disconnect(); } } catch (e) {}
            clearTimeout(embedObservers[tile.id].timer);
            clearInterval(embedObservers[tile.id].poll);
        }
        var entry = { ro: null, timer: null, poll: null, doc: null };
        embedObservers[tile.id] = entry;

        // The REAL framed document, or null. An iframe starts life on about:blank
        // and swaps documents when the page arrives - measuring (or observing) the
        // blank doc sizes the tile to nothing and then never updates, because the
        // observer is watching a document that just got thrown away. That swap is
        // also why a single load-event hook is not enough.
        // The real-document gate and the content measurement are the engine's
        // (PenumbraTiles.frameDoc / measureFrame - the infobox's embed| mode sizes
        // its frame with the same truth). What stays here is the grid math.
        function realDoc() { return T.frameDoc(iframe); }

        function apply() {
            var contentH = T.measureFrame(iframe);
            if (!contentH) { return; }   // not laid out yet
            // Cap: a report showing 'All' of 50k rows must not mint a mile-long
            // tile; past the cap the frame scrolls internally as an escape hatch.
            var maxH = MAX_ROWS * (GRID_ROW_H + GRID_GAP);
            // +10 bottom slack for full/table embeds (their body keeps 8px of
            // padding below the content); a header-only frame hugs the card
            // exactly - the banner IS the tile, edge to edge (2026-08-23).
            var capped = Math.min(contentH + (tile.show === 'header' ? 0 : 10), maxH);
            // Hysteresis, twin of PenumbraTiles.fitFrameHeight: viewport-tracking
            // content (a pivot view's scroll region) re-measures ~= the frame on
            // every ResizeObserver tick - without this the +10 slack ratchets
            // the tile taller forever.
            var curH = parseInt(iframe.style.height, 10) || 0;
            if (curH > 0 && Math.abs(capped - curH) <= 12) { return; }
            iframe.style.height = capped + 'px';
            // Tile height = span*ROW_H + (span-1)*GAP; the chrome offset is MEASURED
            // (bare sectional embeds have no head at all, normal tiles ~31px).
            var headH = $tile.find('.dash-tile-head').outerHeight() || 0;
            var need = capped + headH + 16;
            var span = Math.max(1, Math.min(MAX_ROWS, Math.ceil(need / (GRID_ROW_H + GRID_GAP))));
            $tile.css('grid-row', 'span ' + span);
            // The span reserves whole 82px rows; without this the CARD stretches
            // to fill the last partial row and the slack reads as dead tile space
            // (the reported gap under header embeds). Hug the content instead -
            // the leftover track is page background, not card interior.
            $tile.addClass('dash-tile-autoh');
        }

        // (Re)attach the observer whenever the framed DOCUMENT changes identity.
        // The report page keeps growing after its load event (the table renders
        // from an AJAX response), so the observer - not the load event - is what
        // keeps the tile true.
        function ensureObserved() {
            var doc = realDoc();
            if (!doc) { return false; }
            if (entry.doc === doc && entry.ro) { apply(); return true; }
            if (entry.ro) { try { entry.ro.disconnect(); } catch (e) {} entry.ro = null; }
            entry.doc = doc;
            apply();
            if (typeof ResizeObserver !== 'undefined') {
                entry.ro = new ResizeObserver(function () {
                    clearTimeout(entry.timer);
                    entry.timer = setTimeout(apply, 150);
                });
                try { entry.ro.observe(doc.documentElement); } catch (e) { entry.ro = null; }
            }
            return true;
        }

        $(iframe).off('load.dashAuto').on('load.dashAuto', ensureObserved);
        // Poll as the safety net for the blank->real swap racing the load hook (and
        // for lazy frames that start late). Stops once the real doc is observed.
        var tries = 0;
        entry.poll = setInterval(function () {
            tries++;
            if (ensureObserved() || tries > 40) { clearInterval(entry.poll); entry.poll = null; }
        }, 350);
    }

    function renderTileInto($tile, tile) {
        _tileLastRefresh[tile.id] = Date.now();   // any render counts as fresh
        var _rGen = _dashGen;    // async results from a pre-swap dashboard are dropped
        if (tile.type === 'note') {
            // HTML notes go through DOMPurify like every other author-supplied
            // markup (report snippets, @@HTML cells). Until 2026-09-04 a note with
            // any tag in it was injected RAW, so a public dashboard note ran script
            // in every viewer's session. Plain text (no tags) keeps the escape +
            // <br> path so literal <, &, > and line breaks display faithfully.
            // Same rule as PenumbraTiles.renderNote - keep the two in step.
            var noteTxt = tile.text || '';
            var noteHtml = (/<[a-z][^>]*>/i.test(noteTxt) && typeof DOMPurify !== 'undefined')
                ? DOMPurify.sanitize(noteTxt, { FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'] })
                : escapeHtml(noteTxt).replace(/\n/g, '<br>');
            $tile.find('.dash-tile-body').html('<div class="dash-note">' + noteHtml + '</div>');
            return;
        }
        if (tile.type === 'controls') {
            if (renderControlsInto($tile, tile)) { scheduleControls(1500); }
            return;
        }
        if (!T.hasSource(tile)) { renderTileError($tile, tile.type === 'embed' || !tile.source || tile.source === 'live' || tile.source === 'snapshot' ? 'No source report chosen.' : 'No data source given.'); return; }

        if (tile.type === 'embed') {
            // The real report page, framed. The URL is the engine's (embedUrl:
            // noadm + embed=1 chrome trim, eview= sections, fullscreen+fspages for
            // one chart/slide, the dashboard theme, the search pre-filter, the
            // via attribution, per-tile prompts) - the infobox's embed| mode
            // builds the identical URL. loading="lazy": an offscreen embed costs
            // nothing until scrolled near - what keeps embeds pay-for-what-you-use.
            // fstheme: the dashboard's theme also wins INSIDE a chart/slide
            // frame, over a carousel theme the report's snippet pinned (owner,
            // 2026-09-05). Passed for theme-default too - "default" is a choice.
            var et = effTile(tile);   // URL prompts + search on top, label resolved
            _tileSearchSent[tile.id] = tileSearchKey(tile);
            var src = T.embedUrl(et, embedOpts());
            $tile.find('.dash-tile-body').html(
                '<iframe class="dash-embed" src="' + escapeHtml(src) + '" loading="lazy" ' +
                'title="' + escapeHtml(et.label || tile.report) + '"></iframe>');
            $tile.find('.dash-tile-foot').empty();
            $tile.find('iframe.dash-embed').on('load', function () { $(this).data('pnbFrameLoaded', 1); scheduleControls(1000); tileColsChanged(); });
            // Chart embeds are a fixed-size stage (the carousel overlay fills the
            // frame) - auto-height would measure the page BEHIND the overlay.
            if (tile.autoHeight !== false && tile.show !== 'chart') { autoSizeEmbed($tile, tile); }
            return;
        }

        if (tile.type === 'trend') {
            fetchTrendData(tile).then(function (entry) {
                if (_rGen !== _dashGen) { return; }
                var pts = entry.points || [];
                var $body = $tile.find('.dash-tile-body');
                $tile.find('.dash-tile-foot').html(
                    pts.length + ' snapshots &middot; ' +
                    escapeHtml(String(pts[0].at).substring(0, 10)) + ' &rarr; ' +
                    escapeHtml(String(pts[pts.length - 1].at).substring(0, 10)));
                $body.html('<div class="dash-chart-wrap"><canvas></canvas></div>');
                var canvas = $body.find('canvas')[0];
                if (chartInstances[tile.id]) { try { chartInstances[tile.id].destroy(); } catch (e) {} }
                var color = palette(1)[0];
                var textColor = cssVar('--text-main', '#333');
                var fmt = tile.format || 'number';
                chartInstances[tile.id] = new Chart(canvas, {
                    type: (tile.chartType === 'bar') ? 'bar' : 'line',
                    data: {
                        // No date adapter is bundled with Chart.js here, so the axis is
                        // categorical with pre-shortened date labels - fine for
                        // snapshot cadences (daily/weekly).
                        labels: pts.map(function (p) { return String(p.at).substring(0, 10); }),
                        datasets: [{
                            label: tile.label || tile.report,
                            data: pts.map(function (p) { return p.value; }),
                            backgroundColor: color,
                            borderColor: color,
                            borderWidth: 2,
                            fill: false,
                            tension: 0.25,
                            pointRadius: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: REDUCED_MOTION ? false : { duration: 350 },
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: function (ctx) { return fmtValue(ctx.parsed.y, fmt); } } }
                        },
                        scales: {
                            x: { ticks: { color: textColor, autoSkip: true, maxRotation: 45 }, grid: { display: false } },
                            y: { ticks: { color: textColor, callback: function (v) { return fmtValue(v, fmt); } }, beginAtZero: true }
                        }
                    }
                });
                // WCAG 1.1.1: role=img + label + sr-only data table (js/penumbra_a11y.js).
                try { if (window.enhanceChartA11y) { window.enhanceChartA11y(chartInstances[tile.id]); } } catch (e) {}
                tileFresh($tile);
            }).catch(function (entry) {
                if (_rGen !== _dashGen) { return; }
                tileFailed($tile, (entry && entry.error) || 'Could not load snapshot history.');
            });
            return;
        }

        var _tok = (_tileRenderTok[tile.id] = (_tileRenderTok[tile.id] || 0) + 1);
        fetchTileData(tile).then(function (entry) {
            // A newer render of this tile (a dashboard filter applied while this
            // fetch was in flight) owns the tile now.
            if (_tileRenderTok[tile.id] !== _tok) { return; }
            var rows = entry.rows || [];
            var totalRows = (typeof entry.totalRows === 'number') ? entry.totalRows : rows.length;
            var $body = $tile.find('.dash-tile-body');
            var $foot = $tile.find('.dash-tile-foot');
            var footBits = [fmtNumber(totalRows, 0) + (totalRows === 1 ? ' row' : ' rows')];
            if (entry.asOf) { footBits.push('as of ' + escapeHtml(String(entry.asOf).substring(0, 16))); }
            $foot.html(footBits.join(' &middot; '));

            // Stat / chart / table bodies are the engine's renderers (the same
            // markup an infobox tile shows). Chart instances stay tracked here so
            // re-renders and kiosk swaps can destroy them.
            var res = T.renderInto($body, tile, { rows: rows, totalRows: totalRows, chartHooks: (tile.type === 'chart') ? chartCrossFilterHooks(tile) : null, cellFilter: tile.type === 'table' });
            if (res.error) { renderTileError($tile, res.error); xfRestoreFocus($tile, tile); return; }
            xfRestoreFocus($tile, tile);
            if (tile.type === 'chart') {
                if (chartInstances[tile.id]) { try { chartInstances[tile.id].destroy(); } catch (e) {} }
                chartInstances[tile.id] = res.chart;
            }
            tileFresh($tile);
            noteTileSearch(tile, entry.searchSkipped);
        }).catch(function (entry) {
            if (_rGen !== _dashGen || _tileRenderTok[tile.id] !== _tok) { return; }
            tileFailed($tile, (entry && entry.error) || 'Could not load data.');
            xfRestoreFocus($tile, tile);
        });
    }

    function renderHead() {
        var $t = $('#dashHeadTitle'), $a = $('#dashHeadActions');
        // The buttons are rebuilt below: keep keyboard focus on the same control
        // (or its twin, Edit <-> Done) instead of dropping it to the page (WCAG 2.4.3).
        var _prevFocusId = (document.activeElement && $(document.activeElement).closest('#dashHeadActions').length) ? document.activeElement.id : '';
        if (!V.shortId) {
            $t.html('<h1>Your dashboards</h1>');
            $a.html((V.canCreate
                ? '<button type="button" class="dash-btn dash-btn-primary" id="dashCreateBtn">+ New dashboard</button>'
                : '') + dashHelpLink(keyHints()));
            return;
        }
        // The dashboard title resolves the same tokens a tile label does (owner,
        // 2026-09-05): me() / me(attr) and data(NAME) from the address, NAME
        // matched regardless of case. The tab title follows so a bookmark reads right.
        var title = resolveLabel(META.title || META.short_id || V.shortId, null);
        try { document.title = title + ' · Penumbra Dashboards'; } catch (eT) { }
        // URL parameters in force are SAID, not silent: a viewer must be able to
        // tell a filtered dashboard from the plain one.
        var urlNote = '';
        if (urlParamCount()) {
            var uparts = [];
            for (var uk in URL_PROMPTS) { if (Object.prototype.hasOwnProperty.call(URL_PROMPTS, uk)) { uparts.push(uk + ' = ' + URL_PROMPTS[uk]); } }
            urlNote = '<p class="dash-subtitle dash-url-note" title="Applied to every tile from this page\'s address. Tiles whose report has no such prompt ignore it.">' +
                      'From the address, applied to every tile: ' + escapeHtml(uparts.join(' · ')) + '</p>';
        }
        $t.html('<h1>' + escapeHtml(title) + '</h1>' +
                (DASH.subtitle ? '<p class="dash-subtitle">' + escapeHtml(resolveLabel(DASH.subtitle, null)) + '</p>' : '') + urlNote);
        if (KIOSK) { $a.empty(); return; }   // header is hidden anyway; render nothing interactive
        var kh = keyHints();
        var btns = '<button type="button" class="dash-btn" id="dashRefreshBtn" title="Re-fetch every tile' + kh.tip('r') + '"' + kh.attr('r') + '>&#8635; Refresh</button>';
        if (!editMode) {
            // &#xFE0E; = variation selector-15: force the TEXT presentation of
            // the four-corners glyph. Without it Windows renders the EMOJI
            // form, whose font metrics inflate the line box and push the
            // "Kiosk" text off its neighbors' baseline.
            btns += '<a class="dash-btn" href="' + escapeHtml(dashPageUrl(META.short_id || V.shortId, true)) + '" ' +
                    'title="Chrome-free wall-display view of this dashboard, auto-refreshing' + kh.tip('k') + '"' + kh.attr('k') + '>&#9974;&#xFE0E; Kiosk</a>';
        }
        // A viewer-facing pause (WCAG 2.2.2): auto-refresh replaces tile content on
        // its own schedule; anyone reading can hold it, not just an owner in Settings.
        if (!editMode && (parseInt(DASH.refreshSeconds, 10) || 0) >= 30) {
            btns += '<button type="button" class="dash-btn" id="dashPauseBtn" aria-pressed="' + (_refreshPaused ? 'true' : 'false') + '" ' +
                    'title="' + (_refreshPaused ? 'Resume the automatic refresh' : 'Pause the automatic refresh so nothing changes while you read') + kh.tip('p') + '"' + kh.attr('p') + '>' +
                    (_refreshPaused ? 'Resume refresh' : 'Pause refresh') + '</button>';
        }
        if (V.canEdit) {
            btns += editMode
                ? '<button type="button" class="dash-btn" id="dashSettingsBtn" title="Title, access, theme, refresh and kiosk cycle' + kh.tip('s') + '"' + kh.attr('s') + '>Settings</button>' +
                  '<button type="button" class="dash-btn" id="dashAddTileBtn" title="Add a tile' + kh.tip('a') + '"' + kh.attr('a') + '>+ Add tile</button>' +
                  '<button type="button" class="dash-btn dash-btn-primary" id="dashSaveBtn" title="Save the layout (Ctrl+S)" aria-keyshortcuts="Control+s">Save</button>' +
                  '<button type="button" class="dash-btn" id="dashDoneBtn" title="Leave edit mode' + kh.tip('e') + '. While editing: click a tile, then arrow keys resize it and Shift+Left/Right move it"' + kh.attr('e') + '>Done</button>'
                : '<button type="button" class="dash-btn" id="dashEditBtn" title="Rearrange, resize, add and edit tiles' + kh.tip('e') + '"' + kh.attr('e') + '>&#9998; Edit</button>';
        }
        // The Dashboards help topic, always at hand (owner, 2026-09-05: the address
        // parameters and title tokens are discoverable nowhere else). The Help
        // Center lives on the report page, so this opens it there at the topic.
        btns += dashHelpLink(kh);
        $a.html(btns);
        if (_prevFocusId) {
            var twin = ({ dashEditBtn: 'dashDoneBtn', dashDoneBtn: 'dashEditBtn' })[_prevFocusId] || _prevFocusId;
            var $nf = $('#' + twin);
            if (!$nf.length) { $nf = $('#' + _prevFocusId); }
            if ($nf.length) { $nf.trigger('focus'); }
        }
        tickCountdown();   // edit-mode toggles hide/show the countdown bar immediately
    }

    function renderDash(forceRefetch) {
        renderHead();
        var $main = $('#dashMain');
        sweepEmbedObservers();   // old iframes are about to leave the DOM
        _tileSearchSkipped = {};   // every tile reports again as it renders
        if (forceRefetch) {
            dataCache = {};
        }
        if (!DASH.tiles.length) {
            $main.html('<div class="dash-empty">' +
                (V.canEdit
                    ? 'This dashboard is empty. ' + (editMode ? 'Use <strong>+ Add tile</strong> above.' : 'Click <strong>Edit</strong> to add tiles.')
                    : 'This dashboard has no tiles yet.') +
                '</div>');
            return;
        }
        var html = '<div class="dash-grid' + (editMode ? ' dash-grid-edit' : '') + '">';
        var i;
        for (i = 0; i < DASH.tiles.length; i++) { html += tileChrome(DASH.tiles[i], i); }
        html += '</div>';
        $main.html(html);
        for (i = 0; i < DASH.tiles.length; i++) {
            renderTileInto($main.find('.dash-tile[data-tile-id="' + DASH.tiles[i].id + '"]'), DASH.tiles[i]);
        }
        applyGridCols();   // sets body.dash-cols-6 to match the spans tileSpanStyle just wrote
        renderDashSearchNote();   // badges live in the heads just rebuilt
    }

    // ---------------- Home (no id) ----------------
    function renderHome() {
        renderHead();
        var $main = $('#dashMain');
        $main.html('<div class="dash-loading">Loading your dashboards&hellip;</div>');
        $.getJSON('manage_dashboard.php', { action: 'list' }).done(function (resp) {
            if (resp && resp.needs_install) {
                $main.html('<div class="dash-install-card">' +
                    '<h2>One-time setup</h2>' +
                    '<p>The dashboards table has not been created yet.</p>' +
                    (resp.is_admin
                        ? '<button type="button" class="dash-btn dash-btn-primary" id="dashInstallBtn">Create table now</button>'
                        : '<p>Ask an administrator to open this page once to set it up.</p>') +
                    '</div>');
                return;
            }
            if (!resp || resp.status !== 'success') {
                $main.html('<div class="dash-tile-err">' + escapeHtml((resp && resp.message) || 'Could not load dashboards.') + '</div>');
                return;
            }
            if (!resp.data.length) {
                $main.html('<div class="dash-empty">No dashboards yet.' +
                    (V.canCreate ? ' Create the first one with <strong>+ New dashboard</strong>.' : '') + '</div>');
                return;
            }
            var pins = loadPins();
            // Pinned first, then the rest, each group keeping the server's
            // recently-updated ordering.
            var rows = resp.data.slice().sort(function (a, b) {
                var pa = pins.indexOf(a.short_id) > -1 ? 0 : 1;
                var pb = pins.indexOf(b.short_id) > -1 ? 0 : 1;
                return pa - pb;
            });
            var html = '<div class="dash-home-tools"><input type="search" id="dashHomeFilter" placeholder="Filter: title, id, owner, or tag:NAME" aria-label="Filter dashboards" autocomplete="off"></div><div class="dash-home-grid">';
            rows.forEach(function (d) {
                var pinned = pins.indexOf(d.short_id) > -1;
                // The star is a SIBLING of the link, never a button inside it (WCAG
                // 4.1.2); .dash-home-item positions it over the card. Pinned state is
                // aria-pressed plus a filled vs hollow star, not colour alone (1.4.1).
                html += '<div class="dash-home-item" data-hay="' + escapeHtml(((d.title || '') + ' ' + d.short_id + ' ' + (d.owner_id || '')).toLowerCase()) + '" data-tags="' + escapeHtml('|' + (d.tags || []).join('|') + '|') + '">' +
                        '<a class="dash-home-card" href="dashboard.php?id=' + encodeURIComponent(d.short_id) + '">' +
                        '<div class="dash-home-title">' + escapeHtml(d.title || d.short_id) + '</div>' +
                        '<div class="dash-home-meta">' + escapeHtml(d.short_id) + ' &middot; ' + escapeHtml(d.owner_id || '') + '</div>' +
                        ((d.tags && d.tags.length) ? '<div class="dash-home-tags">' + d.tags.map(function (t) { return '<span class="access-capsule report-tag dash-home-tag" data-tag="' + escapeHtml(t) + '" title="Show every dashboard tagged ' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
                        // Footer row: updated stamp left, badge right, both IN FLOW so a long
                        // owner/date can never run under an absolutely placed badge (2026-09-22).
                        '<div class="dash-home-foot">' +
                        '<span class="dash-home-updated">' + (d.updated_at ? 'Updated ' + escapeHtml(d.updated_at) : '') + '</span>' +
                        ((d.can_edit && !penumbra_dash_vars.noadm) ? '<span class="dash-home-badge">editable</span>' : '') +   // &noadm: a viewer's list (2026-10-02)
                        '</div>' +
                        '</a>' +
                        '<button type="button" class="dash-pin' + (pinned ? ' is-pinned' : '') + '" data-sid="' + escapeHtml(d.short_id) + '"' +
                        ' title="' + (pinned ? 'Unpin from the home screen' : 'Pin to the Penumbra home screen') + '"' +
                        ' aria-label="Pin ' + escapeHtml(d.title || d.short_id) + ' to the home screen"' +
                        ' aria-pressed="' + (pinned ? 'true' : 'false') + '">' + (pinned ? '&#9733;' : '&#9734;') + '</button>' +
                        '</div>';
            });
            html += '</div>';
            $main.html(html);
            // Filter (2026-10-09): title / id / owner text, or tag:NAME for exactly one tag;
            // a pill click fills it; ?search= on the address runs it first (the Tags tool's link).
            function applyHomeFilter() {
                var q = $.trim($('#dashHomeFilter').val()).toLowerCase(), m = /^tag:\s*([a-z0-9_]+)$/i.exec(q);
                $('.dash-home-item').each(function () {
                    var ok = !q || (m ? String($(this).attr('data-tags')).indexOf('|' + m[1].toUpperCase() + '|') !== -1 : String($(this).attr('data-hay')).indexOf(q) !== -1);
                    $(this).toggle(ok);
                });
            }
            $('#dashHomeFilter').on('input', applyHomeFilter);
            $main.off('click.dashTag').on('click.dashTag', '.dash-home-tag', function (e) { e.preventDefault(); e.stopPropagation(); $('#dashHomeFilter').val('tag:' + $(this).attr('data-tag')).trigger('input'); });
            var deep = ''; try { deep = new URLSearchParams(window.location.search).get('search') || ''; } catch (eU) { }
            if (deep) { $('#dashHomeFilter').val(deep).trigger('input'); }
        }).fail(function () {
            $main.html('<div class="dash-tile-err">Could not load dashboards.</div>');
        });
    }

    // =========================================================================
    // Panels (settings / tile editor / create) - small self-contained overlay.
    // =========================================================================
    function openPanel(title, bodyHtml, onReady) {
        closePanel();
        // data-pnb-modal: the shared modal manager (js/penumbra_a11y.js) traps Tab
        // inside and hands focus back to the opener when the panel is removed.
        var html = '<div class="dash-overlay" id="dashOverlay"><div class="dash-panel" role="dialog" aria-modal="true" data-pnb-modal="1" aria-label="' + escapeHtml(title) + '">' +
                   '<div class="dash-panel-head"><h2>' + escapeHtml(title) + '</h2>' +
                   // Same help door in the builder's panels (tile editor, settings).
                   '<button type="button" class="tab-help-icon dash-panel-help" title="Help for dashboards: tiles, address parameters, title tokens, keyboard" aria-label="Dashboards help">?</button>' +
                   // penumbra-fs-dialog-close = the app's round close button (main.css), so the
                   // tile editor / settings panel match every other Penumbra dialog (owner nit, 2026-09-05).
                   '<button type="button" class="dash-panel-close penumbra-fs-dialog-close" title="Close (Esc)" aria-label="Close">&times;</button></div>' +
                   '<div class="dash-panel-body">' + bodyHtml + '</div>' +
                   '</div></div>';
        $('body').append(html);
        $('#dashOverlay .dash-panel').attr('tabindex', '-1').focus();
        if (window.PenumbraA11y) { window.PenumbraA11y.sweep(); }   // attach the trap now, not at the next debounce
        if (onReady) { onReady($('#dashOverlay')); }
    }
    // Every close path (the X, Escape, a backdrop click, Apply) funnels through
    // here, so this is the one place that has to undo an uncommitted theme
    // preview - otherwise dismissing the panel would leave the page wearing a
    // theme DASH.theme never agreed to, and a later Save would write the old id
    // over a page that looks different.
    function closePanel() {
        stopChartProbe();
        if (themePreviewing) { themePreviewing = false; applyPageTheme(DASH.theme || 'theme-default'); }
        $('#dashOverlay').remove();
        // The shared modal manager hands focus back to the opener; when that opener
        // was re-rendered meanwhile (a tile's edit button after Apply), land on the grid.
        setTimeout(function () { if (document.activeElement === document.body) { $('#dashMain').trigger('focus'); } }, 0);
    }

    // Loading cover over the open panel (used while the chart probe loads the
    // framed report - which can take a few seconds on a heavy report).
    function panelLoading(show, msg) {
        $('#dashPanelLoad').remove();
        $('#dashOverlay .dash-panel-body').removeAttr('inert');
        if (!show) { return; }
        var $panel = $('#dashOverlay .dash-panel');
        if (!$panel.length) { return; }
        $panel.append(
            '<div id="dashPanelLoad"><div class="dash-panel-load-inner">' +
            '<span class="dash-spin"></span><div class="dash-panel-load-msg">' + msg + '</div>' +
            '<button type="button" class="dash-btn" id="dashPanelLoadCancel">Cancel</button>' +
            '</div></div>');
        // The cover blocks the pointer; make it block the keyboard too (WCAG 2.4.3):
        // the covered form goes inert and Cancel is the one reachable control.
        $panel.find('.dash-panel-body').attr('inert', '');
        $('#dashPanelLoadCancel').trigger('focus');
    }

    // ---------------- Chart/slide probe ----------------
    // The ONLY correct enumeration of a report's charts + slides is the report's
    // own penumbraCollectCarouselEntries() (main.js) - the exact list ?fspages=
    // indexes. So the tile editor asks a hidden framed copy of the report for
    // it, rather than re-parsing snippets here (the enumeration-divergence trap).
    var _chartProbe = null;   // { $ifr, timer, tries, completeTicks }
    function stopChartProbe() {
        if (_chartProbe) {
            clearInterval(_chartProbe.timer);
            _chartProbe.$ifr.remove();
            _chartProbe = null;
        }
        // Any stop (success, timeout, cancel, mode switch, panel close) also
        // clears the panel's loading cover (and its inert form + focus).
        if ($('#dashPanelLoad').length) {
            $('#dashPanelLoad').remove();
            $('#dashOverlay .dash-panel-body').removeAttr('inert');
            $('#dashOverlay .dash-panel').trigger('focus');
        }
    }
    function startChartProbe(report, prompts, onDone) {
        stopChartProbe();
        var src = 'index.php?id=' + encodeURIComponent(report) + '&noadm&embed=1';
        for (var k in (prompts || {})) {
            if (Object.prototype.hasOwnProperty.call(prompts, k)) {
                src += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(prompts[k]);
            }
        }
        // Off-screen but SIZED and visible-to-layout: display:none lays charts
        // out at zero and can starve render paths; a real viewport keeps the
        // framed page honest.
        var $ifr = $('<iframe class="dash-chart-probe" src="' + escapeHtml(src) + '"></iframe>')
            .css({ position: 'fixed', left: '-2200px', top: '0', width: '1200px', height: '800px', visibility: 'hidden' })
            .appendTo('body');
        var maxTries = parseInt(window.PENUMBRA_DASH_PROBE_TRIES, 10) || 60;   // ~30s ceiling
        _chartProbe = { $ifr: $ifr, tries: 0, completeTicks: 0 };
        _chartProbe.timer = setInterval(function () {
            if (!_chartProbe) { return; }
            _chartProbe.tries++;
            var entries = null, complete = false;
            try {
                var w = $ifr[0].contentWindow;
                complete = !!(w && w.document && w.document.readyState === 'complete');
                if (w && typeof w.penumbraCollectCarouselEntries === 'function') {
                    entries = w.penumbraCollectCarouselEntries();
                }
            } catch (e) { /* transient about:blank document swaps */ }
            if (entries && entries.length) { stopChartProbe(); onDone(entries); return; }
            // Charts render AFTER the data query, so "complete" alone proves
            // nothing - but a page complete for ~5s whose enumerator keeps
            // returning nothing genuinely has no charts or slides.
            if (complete && entries) { _chartProbe.completeTicks++; }
            if ((entries && _chartProbe.completeTicks > 10) || _chartProbe.tries >= maxTries) {
                stopChartProbe();
                onDone(null);
            }
        }, 500);
    }
    function chartEntryLabel(en, i) {
        var lbl = (i + 1) + '. ';
        if (en.kind === 'slide') {
            lbl += (en.title || ('Slide ' + (i + 1))) +
                   (en.chartTitles && en.chartTitles.length ? ' - ' + en.chartTitles.join(', ') : '');
        } else {
            lbl += en.title || 'Chart';
        }
        return lbl;
    }
    $(document).on('click', '.dash-panel-close', closePanel);
    $(document).on('keydown', function (e) {
        // The sign-in dialog outranks the panels (it sits over them); Escape = its Close.
        if (e.key === 'Escape' && $('#dashSsoLightbox').length) { e.stopPropagation(); $('#dashSsoClose').trigger('click'); return; }
        // The help panel stacks above everything - the builder too - so Escape takes it first.
        if (e.key === 'Escape' && $('#dashHelpOverlay').length) { e.stopPropagation(); closeHelpPanel(); return; }
        // The Visual Search Builder is modal: no page shortcut while it is open
        // (its Escape is handled on the window, in the builder block).
        if ($('#searchBuilderLightbox').is(':visible')) { return; }
        if (e.key === 'Escape' && $('#dashOverlay').length) { e.stopPropagation(); closePanel(); return; }
        // Shortcuts (2026-09-05) - see the keyboard block above the reorder code.
        if ($('#dashHelpOverlay').length) { return; }
        if (!V.shortId || $('#dashOverlay').length || KIOSK) { return; }
        var tg = e.target;
        if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) { return; }
        var k = e.key || '';
        if (e.ctrlKey || e.metaKey) {
            // Ctrl+S saves while editing; the browser's "save page" is never wanted here.
            if ((k === 's' || k === 'S') && editMode && V.canEdit) { e.preventDefault(); $('#dashSaveBtn').trigger('click'); }
            return;
        }
        if (e.altKey) { return; }
        if (editMode && k.indexOf('Arrow') === 0) { if (nudgeSelected(k, e.shiftKey)) { e.preventDefault(); } return; }
        if (editMode && k === 'Escape') { selectTile(null); return; }
        if (dashKeysOff()) { return; }   // the help panel's checkbox (WCAG 2.1.4)
        switch (k.toLowerCase()) {
            case 'r': $('#dashRefreshBtn').trigger('click'); break;
            case 'p': if (!editMode) { $('#dashPauseBtn').trigger('click'); } break;
            case 'h': openHelpPanel(); break;
            // Native click: the kiosk control is an <a> whose delegated handler
            // requests fullscreen - a keydown is a user gesture, so it is granted.
            case 'k': if (!editMode) { var $kb = $('a.dash-btn[href*="kiosk=1"]'); if ($kb.length) { $kb[0].click(); } } break;
            case 'e': if (V.canEdit) { $(editMode ? '#dashDoneBtn' : '#dashEditBtn').trigger('click'); } break;
            case 'a': if (editMode) { $('#dashAddTileBtn').trigger('click'); } break;
            case 's': if (editMode) { $('#dashSettingsBtn').trigger('click'); } break;
            case '/': if ($('#dashSearchInput').length) { e.preventDefault(); $('#dashSearchInput').trigger('focus').trigger('select'); } break;
        }
    });
    // Clicking the dim backdrop closes; clicks inside the panel do not.
    $(document).on('mousedown', '#dashOverlay', function (e) { if (e.target === this) { closePanel(); } });

    var _fieldRowSeq = 0;
    function fieldRow(label, inner, hint) {
        // WCAG 1.3.1 / 4.1.2: the label NAMES its control - by id when the control
        // has one (the hint is then tied to it with aria-describedby), else by
        // labelling the row's first form control through aria-labelledby.
        var m = /<(?:input|select|textarea)\b[^>]*\sid="([^"]+)"/i.exec(inner);
        var lblAttr = '', hintId = '';
        if (m) {
            lblAttr = ' for="' + m[1] + '"';
            if (hint) {
                hintId = m[1] + 'FieldHint';
                inner = inner.replace(/<((?:input|select|textarea)\b[^>]*\sid="[^"]+")/i, '<$1 aria-describedby="' + hintId + '"');
            }
        } else if (/<(input|select|textarea)\b/i.test(inner)) {
            var lid = 'dashFieldLbl' + (++_fieldRowSeq);
            lblAttr = ' id="' + lid + '"';
            inner = inner.replace(/<(input|select|textarea)\b/i, '<$1 aria-labelledby="' + lid + '"');
        }
        return '<div class="dash-field"><label' + lblAttr + '>' + escapeHtml(label) + '</label>' + inner +
               (hint ? '<div class="dash-field-hint"' + (hintId ? ' id="' + hintId + '"' : '') + '>' + hint + '</div>' : '') + '</div>';
    }

    // ---------------- Access-list pillbox ----------------
    // The SAME classification rules as the report save dialog's pill system
    // (main.js parseAccessEntry / isPillAccessType), re-hosted because main.js
    // isn't loaded on this page. main.css styles the .access-capsule classes,
    // so the pills look identical to the report editor's.
    function dashParseAccessEntry(raw) {
        raw = $.trim(raw);
        if (!raw) { return null; }
        var m = raw.match(/^(.+?)\s*<([^>]+)>$/);   // "Firstname Lastname <email>"
        if (m) {
            return { type: m[2].toLowerCase().indexOf('@ncsu.edu') > -1 ? 'ncsu' : 'external',
                     value: raw, display: $.trim(m[1]) };
        }
        if (raw.indexOf('@ncsu.edu') > -1 && raw.indexOf('@') > -1) { return { type: 'ncsu', value: raw, display: raw.split('@')[0] }; }
        if (raw.indexOf('@') > -1 && raw.indexOf('.') > -1) { return { type: 'external', value: raw, display: raw }; }
        // 2/4/6-digit tokens act as OUC rules (checkAuthorization matches those
        // prefixes exactly); other lengths stay plain text.
        if (/^(\d{2}|\d{4}|\d{6})$/.test(raw)) { return { type: 'ouc', value: raw, display: raw }; }
        if (/^public$/i.test(raw)) { return { type: 'public', value: raw, display: raw }; }
        if (/^adminonly$/i.test(raw)) { return { type: 'adminonly', value: raw, display: raw }; }
        return { type: 'text', value: raw, display: raw };
    }
    var DASH_PILL_CLASS = { ncsu: 'ncsu-user', external: 'external-email', ouc: 'ouc-code',
                            'public': 'keyword-public', adminonly: 'keyword-adminonly' };
    // Hover details, from the SAME endpoints the report dialog's pills use:
    // people via get_email_recipients.php, OUC meaning via get_ouc_info.php.
    var _dashPersonCache = {};   // email -> title string | 'pending'
    var _dashOucCache = {};      // code  -> title string | 'pending'
    function dashPersonTitle(ud, fallback) {
        var bits = [];
        var nm = $.trim((ud.fname || '') + ' ' + (ud.lname || ''));
        if (nm) { bits.push(nm); }
        if (ud.username) { bits.push('Unity: ' + ud.username); }
        if (ud.email || ud.value) { bits.push(ud.email || ud.value); }
        if (ud.dept) { bits.push(ud.dept + (ud.ouc ? ' (' + ud.ouc + ')' : '')); }
        return bits.join('\n') || fallback;
    }
    function dashKeywordTitle(type, value) {
        if (type === 'public') { return 'public - anyone who can sign in to Penumbra can view this dashboard'; }
        if (type === 'adminonly') { return 'adminonly - matches no one; only administrators can view'; }
        return value;
    }
    function dashResolvePillTitle($pill, entry) {
        if (entry.type === 'public' || entry.type === 'adminonly') {
            $pill.attr('title', dashKeywordTitle(entry.type, entry.value));
            return;
        }
        if (entry.type === 'ouc') {
            var code = entry.value;
            if (typeof _dashOucCache[code] === 'string' && _dashOucCache[code] !== 'pending') {
                $pill.attr('title', _dashOucCache[code]);
                return;
            }
            if (_dashOucCache[code] === 'pending') { return; }
            _dashOucCache[code] = 'pending';
            $.getJSON('get_ouc_info.php', { ouc: code }).done(function (info) {
                if (!info || (!info.label && !info.college && !info.deptCount)) { delete _dashOucCache[code]; return; }
                var bits = [];
                if (info.label) { bits.push(info.label); }
                if (info.college && info.college !== info.label) { bits.push(info.college); }
                if (info.deptCount) { bits.push(info.deptCount + ' department' + (info.deptCount === 1 ? '' : 's')); }
                _dashOucCache[code] = code + ' - ' + bits.join('\n');
                $pill.closest('.dash-access-box').find('.access-capsule.ouc-code').each(function () {
                    if (String($(this).attr('data-value')) === code) { $(this).attr('title', _dashOucCache[code]); }
                });
            }).fail(function () { delete _dashOucCache[code]; });
            return;
        }
        if (entry.type === 'ncsu' || entry.type === 'external') {
            var m = entry.value.match(/<([^>]+)>/);
            var email = $.trim((m ? m[1] : entry.value)).toLowerCase();
            if (email.indexOf('@') === -1) { return; }
            if (typeof _dashPersonCache[email] === 'string' && _dashPersonCache[email] !== 'pending') {
                $pill.attr('title', _dashPersonCache[email]);
                return;
            }
            if (_dashPersonCache[email] === 'pending') { return; }
            _dashPersonCache[email] = 'pending';
            $.getJSON('get_email_recipients.php', { term: email }).done(function (items) {
                var hit = null;
                (items || []).forEach(function (it) {
                    if (String(it.value || '').toLowerCase() === email) { hit = it; }
                });
                if (!hit) { delete _dashPersonCache[email]; return; }
                _dashPersonCache[email] = dashPersonTitle(hit, entry.value);
                $pill.closest('.dash-access-box').find('.access-capsule').each(function () {
                    var rv = String($(this).attr('data-value'));
                    var mm = rv.match(/<([^>]+)>/);
                    if ($.trim(mm ? mm[1] : rv).toLowerCase() === email) { $(this).attr('title', _dashPersonCache[email]); }
                });
            }).fail(function () { delete _dashPersonCache[email]; });
        }
    }
    // Turns a container (holding one text input) into a capsule editor. Pill
    // types render as capsules; plain unityids stay as free text in the input -
    // the same split the report dialog makes. Returns { value: fn } giving the
    // full comma-joined list.
    // ---------------- Tags (2026-10-09) ----------------
    // The dashboard's tags as pills: the closed vocabulary the page carries
    // (penumbra_dash_vars.tagVocabulary, a datalist under the input); a non-admin
    // may add or remove only tags they hold a grant on, the others sit as locked
    // pills. The same capsule classes as the report dialog's tags (main.css).
    function tagListHtml(id) {
        return '<datalist id="' + (id || 'dsTagList') + '">' +
               (V.tagVocabulary || []).map(function (t) { return '<option value="' + escapeHtml(String(t)) + '">'; }).join('') + '</datalist>';
    }
    function buildTagPillbox($box, initial) {
        var $input = $box.find('input');
        var vocab = (V.tagVocabulary || []).map(function (t) { return String(t).toUpperCase(); });
        var held = (V.tagGrants || []).map(function (t) { return String(t).toUpperCase(); });
        function normalize(raw) {
            var t = String(raw || '').trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
            return /^[A-Z][A-Z0-9_]{0,59}$/.test(t) ? t : '';
        }
        function canTouch(t) { return !!V.isAdmin || held.indexOf(t) !== -1; }
        function has(t) { var f = false; $box.find('.access-capsule').each(function () { if (String($(this).attr('data-value')) === t) { f = true; } }); return f; }
        function addPill(t) {
            if (!t || has(t)) { return; }
            if ($box.find('.access-capsule').length >= 20) { say('A dashboard carries at most 20 tags.'); return; }   // the server's cap (2026-10-09), said here instead of dropped in silence
            var locked = !canTouch(t);
            $('<div class="access-capsule report-tag' + (locked ? ' locked' : '') + '" data-value="' + escapeHtml(t) + '" title="' +
              (locked ? 'You do not hold a grant on this tag, so it stays as it is' : escapeHtml(t)) + '"><span>' + escapeHtml(t) + '</span>' +
              (locked ? '' : '<button type="button" class="remove-access" aria-label="Remove ' + escapeHtml(t) + '">&times;</button>') + '</div>').insertBefore($input);
        }
        var $hint = $('<div class="dash-tag-hint" aria-live="polite"></div>').insertAfter($box);
        function say(msg) { $hint.text(msg || ''); }
        function commit() {
            var parts = String($input.val()).split(/[,\s]+/), i, t;
            for (i = 0; i < parts.length; i++) {
                t = normalize(parts[i]);
                if (!t) { continue; }
                if (vocab.indexOf(t) === -1) { say(t + ' is not an existing tag. New tags start in Admin › Tags.'); continue; }
                if (!canTouch(t)) { say('You do not hold a grant on ' + t + '.'); continue; }
                addPill(t); say('');
            }
            $input.val('');
        }
        (initial || []).forEach(function (t) { addPill(normalize(t)); });
        $box.on('keydown', 'input', function (ev) {
            if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); commit(); }
            else if (ev.key === 'Backspace' && !this.value) { $box.find('.access-capsule:not(.locked)').last().remove(); }
        });
        $box.on('change', 'input', commit);
        $box.on('focusout', 'input', function () { setTimeout(commit, 150); });
        $box.on('click', '.remove-access', function () { $(this).closest('.access-capsule').remove(); $input.trigger('focus'); });
        $box.on('click', function (e) { if (e.target === this) { $input.trigger('focus'); } });
        return { value: function () { return $box.find('.access-capsule').map(function () { return String($(this).attr('data-value')); }).get(); } };
    }

    function buildAccessPillbox($box, initial) {
        var $input = $box.find('input');
        function addPill(entry, ud) {
            var dup = false;
            $box.find('.access-capsule').each(function () {
                // .attr, not .data: jQuery .data coerces numeric OUCs to Numbers.
                if (String($(this).attr('data-value') || '').toLowerCase() === entry.value.toLowerCase()) { dup = true; }
            });
            if (dup) { return; }
            var $pill = $('<div class="access-capsule ' + DASH_PILL_CLASS[entry.type] + '" data-value="' + escapeHtml(entry.value) + '" title="' + escapeHtml(entry.value) + '">' +
              '<span>' + escapeHtml(entry.display) + '</span><button type="button" class="remove-access" aria-label="Remove ' + escapeHtml(entry.display) + '">&times;</button></div>').insertBefore($input);
            if (ud) { $pill.attr('title', dashPersonTitle(ud, entry.value)); }
            else { dashResolvePillTitle($pill, entry); }
        }
        function commit() {
            var parts = String($input.val()).split(','), leftover = [], i, e;
            for (i = 0; i < parts.length; i++) {
                e = dashParseAccessEntry(parts[i]);
                if (!e) { continue; }
                if (DASH_PILL_CLASS[e.type]) { addPill(e); } else { leftover.push(e.value); }
            }
            $input.val(leftover.join(', '));
        }
        String(initial || '').split(',').forEach(function (p) {
            var e = dashParseAccessEntry(p);
            if (!e) { return; }
            if (DASH_PILL_CLASS[e.type]) { addPill(e); }
            else { $input.val(($input.val() ? $input.val() + ', ' : '') + e.value); }
        });
        $box.on('keydown', 'input', function (ev) {
            if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); hideResults(); commit(); }
            else if (ev.key === 'Escape') { hideResults(); }
            else if (ev.key === 'Backspace' && !this.value) { $box.find('.access-capsule').last().remove(); }
            // WCAG 2.1.1: Down moves into the directory matches (they are buttons).
            else if (ev.key === 'ArrowDown') { var $first = $box.find('.dash-ac-item').first(); if ($first.length) { ev.preventDefault(); $first.trigger('focus'); } }
        });
        $box.on('focusout', 'input', function (ev) {
            // Focus moving INTO the matches list must not hide it (keyboard path).
            if (ev.relatedTarget && $(ev.relatedTarget).closest('.dash-access-results').length) { return; }
            // Delay so a click on a dropdown item lands before commit/hide.
            setTimeout(function () { hideResults(); commit(); }, 180);
        });
        $box.on('focusout', '.dash-ac-item', function (ev) {
            if (ev.relatedTarget && $box[0].contains(ev.relatedTarget)) { return; }   // still inside the pillbox
            setTimeout(function () { hideResults(); commit(); }, 180);
        });
        $box.on('keydown', '.dash-ac-item', function (ev) {
            var $items = $box.find('.dash-ac-item'), i = $items.index(this);
            if (ev.key === 'ArrowDown') { ev.preventDefault(); $items.eq(Math.min(i + 1, $items.length - 1)).trigger('focus'); }
            else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (i <= 0) { $input.trigger('focus'); } else { $items.eq(i - 1).trigger('focus'); } }
            else if (ev.key === 'Escape') { ev.preventDefault(); hideResults(); $input.trigger('focus'); }
        });
        $box.on('click', '.remove-access', function () { $(this).closest('.access-capsule').remove(); $input.trigger('focus'); });
        $box.on('click', function (e) { if (e.target === this) { $input.trigger('focus'); } });

        // Directory autocomplete: same endpoint + item layout as the report
        // dialog's access list. The term is whatever follows the last comma;
        // OUC digits and full emails don't hit the directory.
        function hideResults() { $box.find('.dash-access-results').remove(); }
        var acTimer = null;
        $box.on('input', 'input', function () {
            var full = String($input.val());
            var lastComma = full.lastIndexOf(',');
            var term = $.trim(lastComma >= 0 ? full.substring(lastComma + 1) : full);
            clearTimeout(acTimer);
            if (term.length < 3 || term.indexOf('@') > -1 || /^\d+$/.test(term) || !/[a-z]/i.test(term)) { hideResults(); return; }
            acTimer = setTimeout(function () {
                $.getJSON('get_email_recipients.php', { term: term })
                    .done(function (items) {
                        hideResults();
                        if (!items || !items.length) { return; }
                        var html = '<div class="dash-access-results" role="group" aria-label="Directory matches">' + items.slice(0, 10).map(function (it) {
                            return '<button type="button" class="dash-ac-item"><div class="email-item-row">' +
                                   '<span class="email-item-name">' + escapeHtml(it.name || '') + '</span>' +
                                   '<span class="email-item-addr">' + escapeHtml(it.value || '') + '</span></div></button>';
                        }).join('') + '</div>';
                        $box.append(html);
                        $box.find('.dash-ac-item').each(function (i) { $(this).data('ac-item', items[i]); });
                    });
            }, 300);
        });
        function pickItem($item) {
            var it = $item.data('ac-item') || {};
            var email = String(it.value || '');
            var fullValue = it.name ? (it.name + ' <' + email + '>') : email;
            var type = email.toLowerCase().indexOf('@ncsu.edu') > -1 ? 'ncsu' : 'external';
            // Preserve anything before the last comma (OUCs mid-typing etc.).
            var cur = String($input.val());
            var lastComma = cur.lastIndexOf(',');
            $input.val(lastComma >= 0 ? cur.substring(0, lastComma) : '');
            addPill({ type: type, value: fullValue, display: it.name || email }, it);
            hideResults();
            commit();   // pill-ize any preserved preceding entries too
            $input.trigger('focus');
        }
        $box.on('mousedown', '.dash-ac-item', function (ev) {
            ev.preventDefault();   // keep focus in the input (mousedown fires before focusout)
            pickItem($(this));
        });
        // Enter / Space on a focused match (keyboard path). The mouse path picked
        // on mousedown and removed the list, so a mouse click never reaches here.
        $box.on('click', '.dash-ac-item', function () { pickItem($(this)); });
        return {
            value: function () {
                commit();
                var parts = [];
                $box.find('.access-capsule').each(function () { parts.push(String($(this).attr('data-value'))); });
                String($input.val()).split(',').forEach(function (t) { t = $.trim(t); if (t) { parts.push(t); } });
                return parts.join(',');
            }
        };
    }

    // ---------------- Dashboard settings ----------------
    function openSettings() {
        var themeOpts = V.themes.map(function (t) {
            return '<option value="' + escapeHtml(t.id) + '"' + (DASH.theme === t.id ? ' selected' : '') + '>' +
                   escapeHtml(t.label) + (t.isDark ? ' (dark)' : '') + '</option>';
        }).join('');
        var body =
            fieldRow('Title', '<input type="text" id="dsTitle" maxlength="500" value="' + escapeHtml(META.title || '') + '">') +
            fieldRow('Subtitle', '<input type="text" id="dsSubtitle" maxlength="500" value="' + escapeHtml(DASH.subtitle || '') + '">', 'Optional, shown under the title.') +
            fieldRow('Default filter', '<input type="text" id="dsFilter" maxlength="1000" spellcheck="false" autocomplete="off" placeholder="e.g. OUC = me(ouc)" value="' + escapeHtml(DASH.filter || '') + '">',
                'The report search syntax, applied when a link to this dashboard carries no search of its own (a link with &amp;search= wins, and clearing the box keeps it cleared for that address). ' +
                'me(ouc), me(dept), me(unity) and the other me() words resolve for each viewer. Leave empty for no default.') +
            fieldRow('Access list', '<div class="dash-access-box" id="dsAuthBox">' +
                '<input type="text" id="dsAuthInput" placeholder="Add a Unity ID, email, OUC number, or public&hellip;"></div>',
                'Who may VIEW this dashboard. Enter or comma commits an entry; plain Unity IDs stay as text. ' +
                'Tiles still load with each viewer&#39;s own rights, so sharing the dashboard never shares the data.') +
            (V.tagsReady ? fieldRow('Tags', '<div class="dash-access-box" id="dsTagBox">' +
                '<input type="text" id="dsTagInput" list="dsTagList" placeholder="Add an existing tag&hellip;" autocomplete="off"></div>' + tagListHtml('dsTagList'),
                'How the dashboard home finds this dashboard (<code>tag:NAME</code> in its filter box), and what a tag grant opens: tagging a dashboard also shares its editing with the tag&#39;s grant holders. ' +
                'Existing names only; new ones start in Admin &rsaquo; Tags.') : '') +
            fieldRow('Theme', '<select id="dsTheme">' + themeOpts + '</select>',
                'Applies immediately: picking one repaints the page (and this panel) right away. ' +
                'Apply also re-themes the tiles, and Save keeps it. Closing without Apply puts the old theme back.') +
            fieldRow('Auto-refresh', '<select id="dsRefresh">' +
                [0, -1, 60, 300, 900, 1800, 3600, 7200, 14400].map(function (s) {
                    var lbl = s === 0 ? 'Off'
                        : (s === -1 ? 'Never (static, even in kiosk)'
                        : (s < 3600 ? (s / 60) + ' min' : (s / 3600) + (s === 3600 ? ' hour' : ' hours')));
                    return '<option value="' + s + '"' + ((parseInt(DASH.refreshSeconds, 10) || 0) === s ? ' selected' : '') + '>' + lbl + '</option>';
                }).join('') + '</select>', 'Re-fetches tiles on an interval while the tab is visible. ' +
                '"Off" lets kiosk view apply its 5-minute default; "Never" stays static everywhere. ' +
                'Individual tiles can override this in the tile editor.') +
            fieldRow('Kiosk cycle', '<input type="text" id="dsCycleIds" placeholder="other-dash-id, another-id" value="' +
                escapeHtml((DASH.cycle && Array.isArray(DASH.cycle.ids)) ? DASH.cycle.ids.join(', ') : '') + '"> every ' +
                '<select id="dsCycleSecs">' + [30, 60, 120, 300, 600].map(function (s) {
                    var sel = (DASH.cycle && parseInt(DASH.cycle.seconds, 10) === s) ? ' selected' : (!DASH.cycle && s === 60 ? ' selected' : '');
                    return '<option value="' + s + '"' + sel + '>' + (s < 60 ? s + 's' : (s / 60) + ' min') + '</option>';
                }).join('') + '</select>',
                'Kiosk view rotates between this dashboard and the listed ones (IDs, comma-separated), ' +
                'in place - fullscreen survives. Leave empty for a single-dashboard kiosk.') +
            '<div class="dash-panel-actions">' +
            (IS_NEW ? '' : '<button type="button" class="dash-btn dash-btn-danger" id="dsDelete">Delete dashboard</button>') +
            (IS_NEW ? '' : '<button type="button" class="dash-btn" id="dsDuplicate" title="Create a copy of this dashboard (layout and tiles; the copy is yours to reshare)">Duplicate&hellip;</button>') +
            '<button type="button" class="dash-btn dash-btn-primary" id="dsApply">Apply</button></div>';

        openPanel('Dashboard settings', body, function ($ov) {
            var authBox = buildAccessPillbox($('#dsAuthBox'), META.authorized || '');
            var tagBox = (V.tagsReady && $('#dsTagBox').length) ? buildTagPillbox($('#dsTagBox'), META.tags || []) : null;
            // Live preview: the page chrome AND this panel are var-driven, so the
            // swap is visible through the translucent backdrop the moment a theme
            // is picked. Tiles are deliberately left alone until Apply - rebuilding
            // every embed iframe on each keystroke through the select would be a
            // fetch storm.
            $ov.on('change', '#dsTheme', function () {
                themePreviewing = true;
                applyPageTheme($(this).val() || 'theme-default');
            });
            $ov.on('click', '#dsApply', function () {
                var themeBefore = DASH.theme;
                META.title = $.trim($('#dsTitle').val());
                DASH.subtitle = $.trim($('#dsSubtitle').val());
                DASH.filter = $.trim($('#dsFilter').val());
                META.authorized = authBox.value();
                if (tagBox) { META.tags = tagBox.value(); }
                DASH.theme = $('#dsTheme').val();
                DASH.refreshSeconds = parseInt($('#dsRefresh').val(), 10) || 0;
                var cycIds = $.trim($('#dsCycleIds').val()).split(',')
                    .map(function (s) { return $.trim(s); })
                    .filter(function (s) { return /^[A-Za-z0-9\-_]{1,100}$/.test(s) && s !== (META.short_id || V.shortId); });
                DASH.cycle = cycIds.length ? { ids: cycIds, seconds: parseInt($('#dsCycleSecs').val(), 10) || 60 } : null;
                dirty = true;
                // A theme change shows immediately: swap the page chrome BEFORE
                // renderDash() so the rebuilt tiles (embed URLs carry &theme=,
                // native charts read the CSS vars at build time) all pick up the
                // new look in the same pass. The preview flag is cleared first -
                // this IS the commit, so closePanel() must not roll it back.
                themePreviewing = false;
                if (DASH.theme !== themeBefore) { applyPageTheme(DASH.theme || 'theme-default'); }
                // The default in force follows the new default (a filter the viewer
                // typed or cleared stays theirs); renderDash() below re-fetches with it.
                if (_defaultApplied !== null && URL_SEARCH === _defaultApplied) {
                    URL_SEARCH = defaultFilterText();
                    _defaultApplied = URL_SEARCH;
                    _tileSearchSkipped = {};
                    try { history.replaceState(history.state, '', dashPageUrl(META.short_id || V.shortId, KIOSK)); } catch (e) { }
                    syncDashFilterBox(true);
                }
                closePanel();
                renderDash();
                scheduleAutoRefresh();
            });
            $ov.on('click', '#dsDuplicate', function () {
                openDuplicate();
            });
            $ov.on('click', '#dsDelete', function () {
                if (!confirm('Delete this dashboard?\n\nThe layout is removed for everyone it is shared with. Source reports and their data are not touched.')) { return; }
                $.ajax({
                    url: 'manage_dashboard.php?action=delete', type: 'POST', contentType: 'application/json',
                    data: JSON.stringify({ short_id: META.short_id }), dataType: 'json'
                }).done(function (r) {
                    if (r && r.status === 'success') { dirty = false; window.location.href = 'dashboard.php'; }
                    else { alert((r && r.message) || 'Delete failed.'); }
                }).fail(function (x) { alert((x.responseJSON && x.responseJSON.message) || 'Delete failed.'); });
            });
        });
    }

    // ---------------- Tile editor ----------------
    // [value, label] pairs, mirroring the main app's summary/pivot aggregate
    // vocabulary. Trends drop mode/antimode (they plot numbers, not strings).
    // Aggregate vocabulary = the engine's (one list for dashboards AND infobox tiles).
    var AGGS = T.AGGS;
    var TREND_AGGS = T.NUMERIC_AGGS;
    function aggOptions(list, sel) {
        return list.map(function (a) {
            return '<option value="' + a[0] + '"' + (sel === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
        }).join('');
    }

    function promptsToText(p) {
        var out = [], k;
        for (k in (p || {})) { if (Object.prototype.hasOwnProperty.call(p, k)) { out.push(k + '=' + p[k]); } }
        return out.join('\n');
    }
    function textToPrompts(t) {
        var out = {}, lines = String(t || '').split('\n'), i, eq, k, v;
        for (i = 0; i < lines.length; i++) {
            eq = lines[i].indexOf('=');
            if (eq < 1) { continue; }
            k = $.trim(lines[i].substring(0, eq));
            v = $.trim(lines[i].substring(eq + 1));
            if (k !== '') { out[k] = v; }
        }
        return out;
    }

    // ---------------- Controls tile: the editor's form ----------------
    // The form writes tile.strip - the filter_strip() argument list, so the
    // report's own parser (PenumbraTiles.strip.parseArgs) reads it back and a
    // bad list fails with the report's own message - and tile.toggles. Look,
    // size, labels, layout and alignment are filter_strip() keywords.
    var CTL_LOOKS = [['', 'Chips'], ['segmented', 'Segmented (one track per column)'], ['ghost', 'Ghost (outlined)'], ['bare', 'Bare (text only)']];
    var CTL_SIZES = [['', 'Normal'], ['small', 'Small'], ['large', 'Large']];
    var CTL_LABELS = [['left', 'Left of the chips'], ['top', 'Above the chips'], ['none', 'Hidden (screen readers still read them)']];
    var CTL_LAYOUTS = [['', 'In a row, wrapping'], ['vertical', 'Stacked'], ['columns=2', '2 columns'], ['columns=3', '3 columns'], ['columns=4', '4 columns']];
    var CTL_ALIGNS = [['', 'Left'], ['center', 'Centered'], ['right', 'Right']];
    var CTL_TOP_DEFAULT = 12;   // filter_strip()'s own default: an unchanged box writes no top=N
    function ctlOptions(list, sel) {
        return list.map(function (o) {
            return '<option value="' + escapeHtml(o[0]) + '"' + (o[0] === sel ? ' selected' : '') + '>' + escapeHtml(o[1]) + '</option>';
        }).join('');
    }
    function ctlFieldRowHtml(f) {
        f = f || { label: '', col: '', mode: 'in', top: CTL_TOP_DEFAULT, range: false, blank: false, list: false };
        var rng = !!f.range;
        return '<div class="dash-ctl-row">' +
            '<input type="text" class="teCtlLabel" maxlength="80" placeholder="Label" aria-label="Chip group label" value="' + escapeHtml(f.label || '') + '">' +
            '<input type="text" class="teCtlCol" list="teCtlColList" placeholder="COLUMN" aria-label="Column" autocomplete="off" spellcheck="false" value="' + escapeHtml(f.col || '') + '">' +
            '<label class="dash-check" title="A from / to pair instead of chips, for a column of numbers or dates"><input type="checkbox" class="teCtlRange"' + (rng ? ' checked' : '') + '> range</label>' +
            '<label class="dash-check" title="Pressed chips name the values to leave out"><input type="checkbox" class="teCtlEx"' + (f.mode === 'ex' ? ' checked' : '') + (rng ? ' disabled' : '') + '> exclude</label>' +
            '<label class="dash-check" title="A (blank) chip for the rows whose cell is empty, shown last"><input type="checkbox" class="teCtlBlank"' + (f.blank ? ' checked' : '') + (rng ? ' disabled' : '') + '> blank</label>' +
            '<label class="dash-check" title="A type-to-find list of every value instead of folded chips, for a column with hundreds of values"><input type="checkbox" class="teCtlList"' + (f.list ? ' checked' : '') + (rng ? ' disabled' : '') + '> list</label>' +
            '<label class="dash-ctl-top" title="Chips shown before &quot;+n more&quot; (0 = all)">show <input type="number" class="teCtlTop" min="0" max="200" value="' +
            (f.top == null ? CTL_TOP_DEFAULT : f.top) + '" aria-label="Chips shown before +n more (0 = all)"' + ((rng || f.list) ? ' disabled' : '') + '></label>' +
            '<button type="button" class="dash-btn dash-ctl-del" title="Remove this column" aria-label="Remove this column">&times;</button>' +
            '</div>';
    }
    function ctlToggleRowHtml(x) {
        x = x || { label: '', cond: '' };
        return '<div class="dash-ctl-trow">' +
            '<input type="text" class="teCtlTLabel" maxlength="80" placeholder="Label, e.g. Active only" aria-label="Switch label" value="' + escapeHtml(x.label || '') + '">' +
            '<input type="text" class="teCtlTCond" placeholder="Condition, e.g. STATUS = Active" aria-label="Switch condition" autocomplete="off" spellcheck="false" value="' + escapeHtml(x.cond || '') + '">' +
            '<button type="button" class="dash-btn dash-ctl-del" title="Remove this switch" aria-label="Remove this switch">&times;</button>' +
            '</div>';
    }
    function controlsEditorHtml(t) {
        var saved = Array.isArray(t.strip) && t.strip.length;
        var spec = saved ? T.strip.parseArgs(t.strip) : null;
        var ok = spec && !spec.error;
        var mods = ok ? spec.mods : [];
        var has = function (c) { return mods.indexOf(c) > -1; };
        var layout = has('vertical') ? 'vertical' : '';
        mods.forEach(function (m) { var cm = /^cols-(\d)$/.exec(m); if (cm) { layout = 'columns=' + cm[1]; } });
        // A new tile shows its labels (there is no snippet text around it to
        // name the groups); a saved list without labels= keeps them hidden.
        var labels = has('labels-top') ? 'top' : (has('labels-left') || !saved) ? 'left' : 'none';
        var names = builderColumns().map(function (c) { return c.name; }).concat(builderNestedColumns());
        var toggles = Array.isArray(t.toggles) ? t.toggles : [];
        return '<div class="dash-field-hint" style="margin: 0 0 10px;">Chips and switches that write the <strong>dashboard filter</strong> ' +
            '(the box in the header) and read their state back from it. The filter reaches every tile whose report has the column, exactly as typed text does.</div>' +
            '<div class="dash-field"><label id="teCtlFieldsLbl">Filter chips: one group per column</label>' +
            '<div id="teCtlFields" role="group" aria-labelledby="teCtlFieldsLbl">' + (ok && spec.fields.length ? spec.fields : [null]).map(ctlFieldRowHtml).join('') + '</div>' +
            '<button type="button" class="dash-btn" id="teCtlAddField">+ Add a column</button>' +
            '<datalist id="teCtlColList">' + names.map(function (n) { return '<option value="' + escapeHtml(n) + '">'; }).join('') + '</datalist>' +
            '<div class="dash-field-hint">A chip for each value the tiles hold for the column, A to Z, with a count when every tile that has the column reads one report. Pressed chips in one group mean any of them; groups combine with <code>and</code>. ' +
            '<em>Range</em> shows a from / to pair instead, for a column of numbers or dates. ' +
            (names.length ? 'The column box suggests the columns of the tiles on this dashboard.' : 'Column suggestions appear once the tiles have loaded.') + '</div>' +
            (spec && spec.error ? '<div class="dash-field-hint"><span class="dash-err-inline">The saved chips could not be read (' + escapeHtml(spec.error) + '). Set them up again.</span></div>' : '') +
            '</div>' +
            '<div class="dash-ctl-style">' +
            fieldRow('Look', '<select id="teCtlLook">' + ctlOptions(CTL_LOOKS, has('segmented') ? 'segmented' : has('ghost') ? 'ghost' : has('bare') ? 'bare' : '') + '</select>') +
            fieldRow('Size', '<select id="teCtlSize">' + ctlOptions(CTL_SIZES, has('small') ? 'small' : has('large') ? 'large' : '') + '</select>') +
            fieldRow('Group labels', '<select id="teCtlLabels">' + ctlOptions(CTL_LABELS, labels) + '</select>') +
            fieldRow('Layout', '<select id="teCtlLayout">' + ctlOptions(CTL_LAYOUTS, layout) + '</select>') +
            fieldRow('Alignment', '<select id="teCtlAlign">' + ctlOptions(CTL_ALIGNS, has('align-center') ? 'center' : has('align-right') ? 'right' : '') + '</select>') +
            fieldRow('Width', '<label class="dash-check"><input type="checkbox" id="teCtlWide"' + (has('wide') ? ' checked' : '') + '> Span the whole tile</label>') +
            fieldRow('Counts', '<label class="dash-check"><input type="checkbox" id="teCtlCounts"' + (has('nocounts') ? '' : ' checked') + '> Show how many rows each chip would add</label>',
                'Shown when every tile that has the column reads one report; across reports, or on a report over 5,000 rows, no number is shown.') +
            '</div>' +
            '<div class="dash-field"><label id="teCtlTogglesLbl">Switches: each adds one condition to the filter while on</label>' +
            '<div id="teCtlToggles" role="group" aria-labelledby="teCtlTogglesLbl">' + toggles.map(ctlToggleRowHtml).join('') + '</div>' +
            '<button type="button" class="dash-btn" id="teCtlAddToggle">+ Add a switch</button>' +
            '<div class="dash-field-hint">A condition in the filter&#39;s own grammar, such as <code>STATUS = Active</code> or <code>AMOUNT &gt; 100000</code>; ' +
            'several joined with <code>and</code> go on and off together. No <code>or</code>. Switching it off takes out its own condition and leaves the rest.</div>' +
            '</div>';
    }
    // The form back into { strip, toggles }, or { error } naming what to fix.
    function readControlsEditor() {
        var args = [], toggles = [], err = null, nFields = 0;
        $('#teCtlFields .dash-ctl-row').each(function () {
            if (err) { return; }
            var $r = $(this), label = $.trim($r.find('.teCtlLabel').val()), col = $.trim($r.find('.teCtlCol').val());
            if (!label && !col) { return; }   // an untouched row is not a field
            if (!col) { err = 'Enter the column for ' + label + '.'; return; }
            if (!label) { label = col; }
            if (label.indexOf('|') > -1 || col.indexOf('|') > -1) { err = 'A label or a column cannot contain the | character: ' + label; return; }
            var bits = [label, col];
            if ($r.find('.teCtlRange').is(':checked')) {
                bits.push('range');   // exclude and show N are chip options: a range takes neither
            } else {
                if ($r.find('.teCtlEx').is(':checked')) { bits.push('exclude'); }
                if ($r.find('.teCtlBlank').is(':checked')) { bits.push('blank'); }
                if ($r.find('.teCtlList').is(':checked')) { bits.push('list'); }   // a list shows every value: show N stays out (2026-10-01)
                else {
                    var top = parseInt($r.find('.teCtlTop').val(), 10);
                    if (!isNaN(top) && top !== CTL_TOP_DEFAULT) { bits.push('top=' + Math.max(0, Math.min(200, top))); }
                }
            }
            args.push(bits.join('|'));
            nFields++;
        });
        if (err) { return { error: err }; }
        if (nFields) {
            ['#teCtlLook', '#teCtlSize', '#teCtlLayout', '#teCtlAlign'].forEach(function (id) { var v = $(id).val(); if (v) { args.push(v); } });
            var lb = $('#teCtlLabels').val();
            if (lb === 'left' || lb === 'top') { args.push('labels=' + lb); }
            if ($('#teCtlWide').is(':checked')) { args.push('wide'); }
            if (!$('#teCtlCounts').is(':checked')) { args.push('nocounts'); }
            var chk = T.strip.parseArgs(args);
            if (chk.error) { return { error: 'Filter chips: ' + chk.error }; }
        }
        $('#teCtlToggles .dash-ctl-trow').each(function () {
            if (err) { return; }
            var $r = $(this), label = $.trim($r.find('.teCtlTLabel').val()), cond = $.trim($r.find('.teCtlTCond').val());
            if (!label && !cond) { return; }
            if (!cond) { err = 'Enter the condition for the switch ' + label + '.'; return; }
            var sp = T.splitTopLevel(cond);
            if (sp.or) { err = 'A switch condition cannot use "or" (the filter has no parentheses to keep it apart): ' + cond; return; }
            if (sp.prefix) { err = 'A switch condition cannot start with __ROW, __ALL or __SRC: ' + cond; return; }
            toggles.push({ label: label || cond, cond: cond });
        });
        if (err) { return { error: err }; }
        if (!nFields && !toggles.length) { return { error: 'Add at least one column of chips or one switch.' }; }
        return { strip: args, toggles: toggles };
    }

    function openTileEditor(tile, isNewTile) {
        var t = $.extend(true, { w: 4, h: 2, source: 'live', type: 'stat' }, tile || {});
        // The Data select only applies to stat/chart/table; other types are
        // report-bound, so their saved source (if any) can only be live/snapshot.
        var srcNow = T.effectiveSource(t);
        if (t.type === 'embed' || t.type === 'trend' || t.type === 'note' || t.type === 'controls') { srcNow = (t.source === 'snapshot') ? 'snapshot' : 'live'; }
        var body =
            fieldRow('Tile type', '<select id="teType">' +
                ['stat', 'chart', 'table', 'trend', 'embed', 'note', 'controls'].map(function (ty) {
                    var lbl = ty === 'trend' ? 'Trend (over snapshot history)'
                            : ty === 'controls' ? 'Controls (filter chips and switches for the dashboard filter)'
                            : ty === 'embed' ? 'Embedded report (the full live table)'
                            : ty.charAt(0).toUpperCase() + ty.slice(1);
                    return '<option value="' + ty + '"' + (t.type === ty ? ' selected' : '') + '>' + lbl + '</option>';
                }).join('') + '</select>') +
            // Data source FIRST: it decides whether a report picker, a URL box or a
            // JSON box follows. url/inline = rows from somewhere other than a saved
            // report (same-origin only - the engine refuses anything else).
            '<div id="teSourceField">' +
            fieldRow('Data', '<select id="teSource">' +
                '<option value="live"' + (srcNow === 'live' ? ' selected' : '') + '>Live report (runs the report now)</option>' +
                '<option value="snapshot"' + (srcNow === 'snapshot' ? ' selected' : '') + '>Report&#39;s latest snapshot (instant, as-of dated)</option>' +
                '<option value="url"' + (srcNow === 'url' ? ' selected' : '') + '>JSON URL (same-origin, fetched with your own session)</option>' +
                '<option value="inline"' + (srcNow === 'inline' ? ' selected' : '') + '>Inline JSON rows (typed into the tile)</option>' +
                '</select>') + '</div>' +
            '<div class="dash-field" id="teReportField"><label for="teReportSearch">Source report</label>' +
            '<div class="dash-report-pick">' +
            '<input type="text" id="teReportSearch" placeholder="Type 3+ characters to search reports&hellip;" autocomplete="off" value="' + escapeHtml(t.report || '') + '">' +
            '<div id="teReportResults" class="dash-report-results" style="display:none;"></div></div>' +
            '<div class="dash-field-hint" id="teReportHint">' + (t.report ? 'Using <strong>' + escapeHtml(t.report) + '</strong>.' : 'Pick the saved report this tile reads from.') + '</div></div>' +
            '<div id="teUrlField" style="display:none;">' +
            fieldRow('JSON URL', '<input type="text" id="teUrl" value="' + escapeHtml(t.url || '') + '" placeholder="index.php?id=REPORT&amp;json=1&amp;name=value" autocomplete="off">',
                'A relative or same-origin URL returning JSON rows: a bare array, or <code>{"data":[...]}</code> like a report&#39;s <code>&amp;json=1</code> (any <code>&amp;name=value</code> prompt answers go in the URL). Other hosts are blocked by the browser&#39;s security policy.') +
            '<div class="dash-field-hint" id="teUrlHint"></div></div>' +
            '<div id="teJsonField" style="display:none;">' +
            fieldRow('Rows (JSON)', '<textarea id="teJson" rows="5" spellcheck="false" placeholder=\'[{"Name":"A","Amount":100},{"Name":"B","Amount":250}]\'>' + escapeHtml(t.json || '') + '</textarea>',
                'An array of objects, one per row (or <code>{"data":[...]}</code>). Saved with the dashboard.') +
            '<div class="dash-field-hint" id="teJsonHint"></div></div>' +
            fieldRow('Label', '<input type="text" id="teLabel" maxlength="200" value="' + escapeHtml(t.label || '') + '">') +
            fieldRow('Auto-refresh', '<select id="teRefresh">' +
                ['', -1, 60, 300, 900, 1800, 3600, 7200, 14400].map(function (s) {
                    var cur = (t.refreshSeconds === undefined || t.refreshSeconds === null) ? '' : String(t.refreshSeconds);
                    var lbl = s === '' ? 'Inherit (dashboard setting)'
                        : (s === -1 ? 'None (this tile stays static)'
                        : (s < 3600 ? (s / 60) + ' min' : (s / 3600) + (s === 3600 ? ' hour' : ' hours')));
                    return '<option value="' + s + '"' + (cur === String(s) ? ' selected' : '') + '>' + lbl + '</option>';
                }).join('') + '</select>',
                'This tile only. Inherit follows the dashboard&#39;s auto-refresh; None keeps the tile static even when the dashboard refreshes.') +
            '<div id="teTypeFields"></div>' +
            '<div id="teDataFields">' +
            '<div id="tePromptRows"></div>' +
            '<div id="tePromptsField">' +
            fieldRow('Prompt values', '<textarea id="tePrompts" rows="2" placeholder="name=value (one per line)">' + escapeHtml(promptsToText(t.prompts)) + '</textarea>',
                'Optional. Overrides the report&#39;s prompts for this tile, e.g. <code>date=01-JUL-25</code>.') +
            '</div>' +
            '<div class="dash-field-hint" id="tePromptHints" style="display:none;"></div>' +
            '</div>' +
            '<div class="dash-panel-actions">' +
            '<button type="button" class="dash-btn dash-btn-primary" id="teApply">' + (isNewTile ? 'Add tile' : 'Apply') + '</button>' +
            '<button type="button" class="dash-btn" id="teCopySnippet" title="Copy an action(infobox, ...) snippet that opens this tile from any report&#39;s Custom Code">Copy as infobox snippet</button>' +
            '</div>' +
            '<div id="teSnippetOut" style="display:none;">' +
            '<textarea id="teSnippetText" rows="3" readonly spellcheck="false" aria-label="Infobox snippet" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:11px;"></textarea>' +
            '<div class="dash-field-hint">Paste into a report&#39;s Custom Code. The link opens this tile in an infobox, rendered by the same engine as the dashboard - with the viewer&#39;s own rights to the source.</div></div>';

        openPanel(isNewTile ? 'Add tile' : 'Edit tile', body, function ($ov) {
            var columns = [];   // sniffed from a sample fetch

            function renderTypeFields() {
                var ty = $('#teType').val();
                var numCols = columns.filter(function (c) { return c.numeric; });
                function colOpts(sel, wantNumeric) {
                    var list = wantNumeric && numCols.length ? numCols : columns;
                    var o = list.map(function (c) {
                        return '<option value="' + escapeHtml(c.name) + '"' + (sel === c.name ? ' selected' : '') + '>' + escapeHtml(c.name) + (c.numeric ? ' (#)' : '') + '</option>';
                    }).join('');
                    return o || '<option value="">(pick a report first)</option>';
                }
                var h = '';
                if (ty === 'controls') {
                    h = controlsEditorHtml(t);
                } else if (ty === 'note') {
                    h = fieldRow('Text', '<textarea id="teText" rows="3">' + escapeHtml(t.text || '') + '</textarea>',
                        'HTML is allowed and renders as-is; plain text keeps its line breaks.');
                } else if (ty === 'stat') {
                    h = fieldRow('Aggregate', '<select id="teAgg">' + aggOptions(AGGS, t.agg || 'count') + '</select>',
                            'The same aggregate set as column summaries and pivots.') +
                        fieldRow('Column', '<select id="teColumn">' + colOpts(t.column, false) + '</select>',
                            'Ignored for <code>count (all rows)</code>. <code>(#)</code> marks numeric columns.') +
                        fieldRow('Format', '<select id="teFormat">' + ['number', 'currency', 'percent', 'raw'].map(function (f) {
                            return '<option value="' + f + '"' + ((t.format || 'number') === f ? ' selected' : '') + '>' + f + '</option>';
                        }).join('') + '</select>') +
                        fieldRow('Sub-label', '<input type="text" id="teSub" maxlength="120" value="' + escapeHtml(t.sub || '') + '">', 'Small text under the number.');
                } else if (ty === 'chart') {
                    var CHART_TYPES = [['bar', 'bar'], ['hbar', 'horizontal bar'], ['line', 'line'], ['area', 'area'],
                                       ['pie', 'pie'], ['doughnut', 'doughnut'], ['radar', 'radar'], ['polarArea', 'polar area']];
                    var splitOpts = '<option value="">(none)</option>' + columns.map(function (c) {
                        return '<option value="' + escapeHtml(c.name) + '"' + (t.splitBy === c.name ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
                    }).join('');
                    h = fieldRow('Chart type', '<select id="teChartType">' + CHART_TYPES.map(function (ct) {
                            return '<option value="' + ct[0] + '"' + ((t.chartType || 'bar') === ct[0] ? ' selected' : '') + '>' + ct[1] + '</option>';
                        }).join('') + '</select>') +
                        fieldRow('Group by', '<select id="teGroupBy">' + colOpts(t.groupBy, false) + '</select>') +
                        fieldRow('Value', '<select id="teValueAgg">' + aggOptions(TREND_AGGS, t.valueAgg || 'count') + '</select> of <select id="teValueColumn">' + colOpts(t.valueColumn, true) + '</select>',
                            'Any summary aggregate, computed per group.') +
                        fieldRow('Split by', '<select id="teSplitBy">' + splitOpts + '</select>',
                            'Optional second grouping: bars stack by it, lines get one series per value (top 8, rest fold into &ldquo;(other)&rdquo;). Not applicable to pie/doughnut/radar/polar.') +
                        fieldRow('Top N groups', '<input type="number" id="teTopN" min="2" max="50" value="' + (t.topN || 10) + '">');
                } else if (ty === 'table') {
                    var chosen = t.columns || [];
                    h = fieldRow('Columns', '<div class="dash-col-checks" id="teCols">' + (columns.length ? columns.map(function (c) {
                            return '<label><input type="checkbox" value="' + escapeHtml(c.name) + '"' + (chosen.indexOf(c.name) > -1 ? ' checked' : '') + '> ' + escapeHtml(c.name) + '</label>';
                        }).join('') : '<em>(pick a report first)</em>') + '</div>') +
                        fieldRow('Rows to show', '<input type="number" id="teRows" min="1" max="200" value="' + (t.rows || 10) + '">',
                            'The tile fetches only this many rows from the server (plus the true total), so big reports stay fast.') +
                        fieldRow('Row height', '<select id="teRowHeight">' +
                            '<option value="uniform"' + (t.rowHeight === 'grow' ? '' : ' selected') + '>Uniform (clip long values; hover a cell to read it)</option>' +
                            '<option value="grow"' + (t.rowHeight === 'grow' ? ' selected' : '') + '>Grow to fit (wrap long values)</option></select>',
                            'The same choice the report page offers. Uniform keeps the row count predictable on a wall display.') +
                        '<div class="dash-field-hint" style="margin: -4px 0 11px;">Excerpt table: viewers can sort it (click a header; Shift-click adds a secondary sort) and <code>@@HTML</code> columns render. ' +
                        'For search, summaries, pagination and <code>@@JSON</code> sub-tables, use the <strong>Embedded report</strong> type with Show: Table only.</div>';
                } else if (ty === 'embed') {
                    h = fieldRow('Show', '<select id="teShow">' +
                            '<option value="both"' + ((t.show || 'both') === 'both' ? ' selected' : '') + '>Header + table (the whole report)</option>' +
                            '<option value="header"' + (t.show === 'header' ? ' selected' : '') + '>Header only (title, prompts, date range, stats)</option>' +
                            '<option value="table"' + (t.show === 'table' ? ' selected' : '') + '>Table only (search, toolbar, table, pagination)</option>' +
                            '<option value="chart"' + (t.show === 'chart' ? ' selected' : '') + '>One chart or slide (from the report)</option>' +
                            '</select>',
                        'Header-only makes a great KPI strip; table-only drops the banner. With table-only, prompts are set by this tile&#39;s prompt values (the inputs live in the header). One chart/slide shows a single report page, rendered by the report&#39;s own engine.') +
                        '<div id="teChartNField"' + (t.show === 'chart' ? '' : ' style="display:none;"') + '>' +
                        fieldRow('Chart / slide', '<span id="teChartPick"><input type="number" id="teChartN" min="1" max="99" value="' + (t.chartN || 1) + '"></span>',
                        'Which of the report&#39;s charts or slides to show. The list is read from the report itself (its fullscreen-carousel order).') +
                        '</div>' +
                        '<div id="teAutoHField"' + (t.show === 'chart' ? ' style="display:none;"' : '') + '>' +
                        fieldRow('Height', '<label class="dash-check"><input type="checkbox" id="teAutoH"' + (t.autoHeight !== false ? ' checked' : '') + '> ' +
                            'Auto-size to the content (no scrollbar inside the tile)</label>',
                        'The tile grows to fit the embedded page and the dashboard itself scrolls - especially on smaller screens. Untick to keep a fixed height with scrolling inside the frame.') +
                        '</div>' +
                        fieldRow('Search filter', '<input type="text" id="teSearch" value="' + escapeHtml(t.search || '') + '" placeholder="optional, e.g. AWARD_STATUS = Awarded">',
                        'Pre-filters the embedded table with the report&#39;s own search syntax. Leave empty for everything.') +
                        '<div class="dash-field-hint" style="margin: -4px 0 11px;">The embedded report is the REAL report page: its sorting, multi-sort, ' +
                        '<code>@@HTML</code>/<code>@@JSON</code> rendering, summaries, search and pagination all work. It loads the full report app, ' +
                        'so use these for a centerpiece, not for a wall of ten.</div>';
                } else if (ty === 'trend') {
                    h = fieldRow('Aggregate', '<select id="teAgg">' + aggOptions(TREND_AGGS, t.agg || 'count') + '</select>',
                        '<code>count</code> reads snapshot metadata directly - the fastest kind of trend. Anything else loads each snapshot&#39;s data.') +
                        fieldRow('Column', '<select id="teColumn">' + colOpts(t.column, true) + '</select>', 'Ignored for <code>count</code>.') +
                        fieldRow('Format', '<select id="teFormat">' + ['number', 'currency', 'percent', 'raw'].map(function (f) {
                            return '<option value="' + f + '"' + ((t.format || 'number') === f ? ' selected' : '') + '>' + f + '</option>';
                        }).join('') + '</select>') +
                        fieldRow('Style', '<select id="teChartType">' +
                            '<option value="line"' + (t.chartType !== 'bar' ? ' selected' : '') + '>line</option>' +
                            '<option value="bar"' + (t.chartType === 'bar' ? ' selected' : '') + '>bar</option></select>') +
                        fieldRow('Points', '<input type="number" id="tePoints" min="2" max="24" value="' + (t.points || 12) + '">',
                            'How many of the newest snapshots to plot (oldest &rarr; newest).');
                }
                $('#teTypeFields').html(h);
                applySourceFields();
                $('#teCopySnippet').toggle(ty !== 'note' && ty !== 'trend' && ty !== 'controls');
                $('#teRefresh').closest('.dash-field').toggle(ty !== 'controls');   // nothing to refetch
                if (ty === 'embed' && $('#teShow').val() === 'chart') { refreshChartPick(); }
                else if (ty !== 'embed') { stopChartProbe(); }
            }
            // Which source a tile of the chosen type can have, and which inputs
            // that source needs. Trend reads snapshot HISTORY and an embed IS the
            // live page: both are report-only, so the Data select hides and the
            // report picker shows (embeds keep PROMPTS - they ride the URL into
            // the framed report). Data tiles (stat/chart/table) may read a report
            // (live/snapshot, with prompts), a same-origin JSON URL, or inline
            // JSON - the picker, URL box and JSON box swap accordingly.
            function currentSource() {
                var ty = $('#teType').val();
                if (ty === 'embed' || ty === 'trend' || ty === 'note' || ty === 'controls') { return 'live'; }
                return $('#teSource').val() || 'live';
            }
            function applySourceFields() {
                var ty = $('#teType').val();
                var src = currentSource();
                var dataTile = (ty === 'stat' || ty === 'chart' || ty === 'table');
                $('#teSourceField').toggle(dataTile);
                $('#teReportField').toggle(ty !== 'note' && ty !== 'controls' && src !== 'url' && src !== 'inline');
                $('#teUrlField').toggle(dataTile && src === 'url');
                $('#teJsonField').toggle(dataTile && src === 'inline');
                // Prompts ride only into REPORT fetches (live / snapshot / embed).
                $('#teDataFields').toggle(ty !== 'note' && ty !== 'trend' && ty !== 'controls' && src !== 'url' && src !== 'inline');
            }

            // Populate the chart/slide picker from the framed report's own
            // enumeration. Falls back to the plain number input on failure.
            function refreshChartPick() {
                if (!t.report) { return; }
                $('#teChartPickStatus').remove();
                startChartProbe(t.report, textToPrompts($('#tePrompts').val()), function (entries) {
                    panelLoading(false);
                    var cur = parseInt($('#teChartN').val(), 10) || (t.chartN || 1);
                    if (!entries) {
                        $('#teChartPick').after('<div class="dash-field-hint" id="teChartPickStatus">Could not read the chart list - enter the number manually (fullscreen-carousel order).</div>');
                        return;   // the number input stays
                    }
                    var opts = entries.map(function (en, i) {
                        return '<option value="' + (i + 1) + '"' + (cur === i + 1 ? ' selected' : '') + '>' +
                               escapeHtml(chartEntryLabel(en, i)) + '</option>';
                    }).join('');
                    // An existing tile pointing past the current list keeps its number
                    // visible instead of silently snapping to page 1.
                    if (cur > entries.length) { opts += '<option value="' + cur + '" selected>' + cur + '. (beyond the current list)</option>'; }
                    $('#teChartPick').html('<select id="teChartN">' + opts + '</select>');
                    $('#teChartPickStatus').remove();
                });
                // AFTER startChartProbe: its own leading stopChartProbe() clears
                // any previous cover - adding first would be erased immediately.
                panelLoading(true, 'Reading the report&#39;s charts and slides&hellip;<br>' +
                    '<span class="dash-panel-load-sub">The report runs once so its own chart list can be read.</span>');
            }

            function sniffFromReport() {
                // Non-report sources: sample the URL / parse the JSON for columns.
                var src = currentSource();
                if (src === 'url' || src === 'inline') {
                    var spec = (src === 'url') ? { source: 'url', url: $.trim($('#teUrl').val()) }
                                               : { source: 'inline', json: $('#teJson').val() };
                    var $hint = $(src === 'url' ? '#teUrlHint' : '#teJsonHint');
                    promptDefs = null;
                    renderPromptRows();
                    if (!(spec.url || $.trim(spec.json || ''))) { columns = []; $hint.empty(); renderTypeFields(); return; }
                    if (src === 'url' && !T.isSameOrigin(spec.url)) {
                        columns = [];
                        $hint.html('<span class="dash-err-inline">' + escapeHtml(T.CROSS_ORIGIN_MSG) + '</span>');
                        renderTypeFields();
                        return;
                    }
                    $hint.html('Reading columns&hellip;');
                    T.fetchRows(spec)
                        .then(function (res) {
                            if (currentSource() !== src) { return; }   // source switched mid-flight
                            columns = sniffColumns(res.rows);
                            $hint.html(fmtNumber(res.totalRows, 0) + ' rows &middot; ' + columns.length + ' columns.');
                            renderTypeFields();
                        })
                        .catch(function (err) {
                            if (currentSource() !== src) { return; }
                            columns = [];
                            $hint.html('<span class="dash-err-inline">' + escapeHtml(T.errorMessage(err)) + '</span>');
                            renderTypeFields();
                        });
                    return;
                }
                if (!t.report) { columns = []; promptDefs = null; renderPromptRows(); renderTypeFields(); return; }
                loadPromptDefs();
                // Embeds need no column list - don't pull a possibly huge rowset just
                // to configure an iframe.
                if ($('#teType').val() === 'embed') {
                    $('#teReportHint').html('Embedding <strong>' + escapeHtml(t.report) + '</strong>.');
                    if ($('#teShow').val() === 'chart') { refreshChartPick(); }
                    return;
                }
                $('#teReportHint').html('Reading columns from <strong>' + escapeHtml(t.report) + '</strong>&hellip;');
                // Column sniffing needs a SAMPLE, not the rowset: cap the fetch so
                // configuring a tile on a 50k-row report doesn't drag. total_rows
                // still reports the report's true size.
                fetchTileData({ report: t.report, source: 'live', type: 'table', rows: 100,
                                prompts: textToPrompts($('#tePrompts').val()) }, true)
                    .then(function (entry) {
                        columns = sniffColumns(entry.rows);
                        var total = (typeof entry.totalRows === 'number') ? entry.totalRows : entry.rows.length;
                        $('#teReportHint').html('Using <strong>' + escapeHtml(t.report) + '</strong> &middot; ' +
                            fmtNumber(total, 0) + ' rows &middot; ' + columns.length + ' columns.');
                        renderTypeFields();
                    })
                    .catch(function (entry) {
                        columns = [];
                        $('#teReportHint').html('<span class="dash-err-inline">' + escapeHtml((entry && entry.error) || 'Could not read the report.') + '</span>');
                        renderTypeFields();
                    });
            }

            // ---- Prompt convenience: the source report's declared prompts become
            // structured inputs (dropdowns when the prompt declares options). The
            // hidden #tePrompts textarea stays the single source of truth - rows
            // write through to it, unknown/extra lines are preserved, and teApply
            // reads it exactly as before.
            var promptDefs = null;
            function loadPromptDefs() {
                var forReport = t.report;
                $.getJSON('manage_dashboard.php', { action: 'report_prompts', report_id: forReport })
                    .done(function (resp) {
                        if (t.report !== forReport) { return; }   // report changed mid-flight
                        // Label autofill: an EMPTY label at selection time takes
                        // the source report's title. Never overwrites anything
                        // the author typed.
                        if (resp && resp.status === 'success' && resp.title && !$.trim($('#teLabel').val())) {
                            $('#teLabel').val(String(resp.title));
                        }
                        // resp.unknown = the report's state couldn't be read (e.g.
                        // encrypted): prompt existence is UNKNOWN, keep the manual box.
                        promptDefs = (resp && resp.status === 'success' && resp.data && !resp.unknown) ? resp.data : null;
                        renderPromptRows(resp || {});
                    })
                    .fail(function () { promptDefs = null; renderPromptRows({}); });
            }
            function renderPromptRows(meta) {
                var $wrap = $('#tePromptRows'), $hints = $('#tePromptHints');
                var notes = [];
                if (meta && meta.has_me) {
                    notes.push('This report uses <code>me()</code> - on a dashboard it resolves to whoever is <em>viewing</em>, so there is nothing to configure.');
                }
                if (meta && meta.unnamed > 0) {
                    notes.push(meta.unnamed + ' prompt' + (meta.unnamed > 1 ? 's' : '') + ' without <code>name=</code> cannot be overridden per-tile.');
                }
                $hints.html(notes.join('<br>')).toggle(notes.length > 0);
                if (!promptDefs) {
                    // Unknown (fetch failed / unreadable report): keep the manual box.
                    $wrap.empty();
                    $('#tePromptsField').show();
                    return;
                }
                if (!promptDefs.length) {
                    // The report declares NO named prompts: there is nothing to
                    // override, so the raw box only appears if it already holds
                    // values (legacy entries the author may want to clear).
                    $wrap.empty();
                    $('#tePromptsField').toggle($.trim($('#tePrompts').val()) !== '');
                    return;
                }
                var cur = textToPrompts($('#tePrompts').val());
                var html = promptDefs.map(function (p) {
                    if (p.hidden) { return ''; }
                    var label = p.label || p.title || p.name;
                    var val = (cur[p.name] !== undefined) ? String(cur[p.name]) : '';
                    var dflt = (p.forcedefault !== null && p.forcedefault !== undefined && p.forcedefault !== '')
                             ? String(p.forcedefault) : String(p['default'] || '');
                    var inner;
                    if (p.options && p.options.length) {
                        var found = false;
                        var opts = p.options.map(function (o) {
                            var sel = val !== '' && val === String(o.value);
                            if (sel) { found = true; }
                            return '<option value="' + escapeHtml(String(o.value)) + '"' + (sel ? ' selected' : '') + '>' + escapeHtml(String(o.label)) + '</option>';
                        }).join('');
                        // A previously-typed custom value survives as its own entry.
                        if (val !== '' && !found) { opts += '<option value="' + escapeHtml(val) + '" selected>' + escapeHtml(val) + '</option>'; }
                        inner = '<select class="dash-prompt-input" id="dashPrompt-' + String(p.name).replace(/[^A-Za-z0-9_-]/g, '_') + '" data-name="' + escapeHtml(p.name) + '">' +
                                '<option value="">(report default' + (dflt ? ': ' + escapeHtml(dflt) : '') + ')</option>' + opts + '</select>';
                    } else {
                        var ph = dflt ? ('default: ' + dflt) : (p.autofill ? 'autofilled - type a value to override' : 'report default');
                        inner = '<input type="text" class="dash-prompt-input" id="dashPrompt-' + String(p.name).replace(/[^A-Za-z0-9_-]/g, '_') + '" data-name="' + escapeHtml(p.name) + '" value="' + escapeHtml(val) + '" placeholder="' + escapeHtml(ph) + '">';
                    }
                    return '<div class="dash-field dash-prompt-row"' + (p.message ? ' title="' + escapeHtml(p.message) + '"' : '') + '>' +
                           '<label for="dashPrompt-' + String(p.name).replace(/[^A-Za-z0-9_-]/g, '_') + '">' + escapeHtml(label) + ' <span class="dash-prompt-name">(' + escapeHtml(p.name) + ')</span></label>' + inner + '</div>';
                }).join('');
                // Lines the report doesn't declare (extras) stay editable as raw text.
                var known = {}, extras = [];
                promptDefs.forEach(function (p) { known[p.name] = 1; });
                for (var k in cur) {
                    if (Object.prototype.hasOwnProperty.call(cur, k) && !known[k]) { extras.push(k); }
                }
                $wrap.html(html);
                $('#tePromptsField').toggle(extras.length > 0);
            }
            var promptSyncTimer = null;
            $ov.on('change', '.dash-prompt-input', function () {
                if (!promptDefs) { return; }
                var cur = textToPrompts($('#tePrompts').val());
                var known = {};
                promptDefs.forEach(function (p) { known[p.name] = 1; });
                var lines = [];
                $('.dash-prompt-input').each(function () {
                    var n = String($(this).data('name')), v = $.trim($(this).val());
                    if (v !== '') { lines.push(n + '=' + v); }
                });
                for (var k in cur) {
                    if (Object.prototype.hasOwnProperty.call(cur, k) && !known[k]) { lines.push(k + '=' + cur[k]); }
                }
                $('#tePrompts').val(lines.join('\n'));
                // New prompt values can change the rowset - re-sniff (debounced; a
                // sniff is a capped 100-row fetch, not the whole report).
                clearTimeout(promptSyncTimer);
                promptSyncTimer = setTimeout(function () {
                    if (t.report && $('#teType').val() !== 'embed') { sniffFromReport(); }
                }, 500);
            });

            // Report search: the same auth-filtered quicksearch the home screen uses,
            // so authors only see reports they can actually open.
            var searchTimer = null;
            $ov.on('input', '#teReportSearch', function () {
                var term = $.trim($(this).val());
                clearTimeout(searchTimer);
                if (term.length < 3) { $('#teReportResults').hide(); return; }
                searchTimer = setTimeout(function () {
                    $.getJSON('get_server_reports.php', { mode: 'quicksearch', search: term })
                        .done(function (resp) {
                            var rows = (resp && resp.data) || [];
                            if (!rows.length) { $('#teReportResults').html('<div class="dash-rr-none">No matching reports.</div>').show(); return; }
                            $('#teReportResults').html(rows.slice(0, 12).map(function (r) {
                                return '<button type="button" class="dash-rr-item" data-sid="' + escapeHtml($.trim(r.SHORT_ID)) + '">' +
                                       '<strong>' + escapeHtml($.trim(r.SHORT_ID)) + '</strong> ' + escapeHtml(r.TITLE || '') + '</button>';
                            }).join('')).show();
                        });
                }, 300);
            });
            $ov.on('click', '.dash-rr-item', function () {
                t.report = String($(this).data('sid'));
                $('#teReportSearch').val(t.report);
                $('#teReportResults').hide();
                sniffFromReport();
            });
            // Typing an exact short id and tabbing away also works (no search needed).
            $ov.on('change', '#teReportSearch', function () {
                var vRaw = $.trim($(this).val());
                if (vRaw && vRaw !== t.report && /^[A-Za-z0-9\-_]+$/.test(vRaw)) { t.report = vRaw; sniffFromReport(); }
            });
            $ov.on('change', '#teType', renderTypeFields);
            // Controls: rows in and out (an empty row is simply not saved).
            $ov.on('click', '#teCtlAddField', function () {
                $('#teCtlFields').append(ctlFieldRowHtml(null));
                $('#teCtlFields .dash-ctl-row').last().find('.teCtlLabel').trigger('focus');
            });
            $ov.on('click', '#teCtlAddToggle', function () {
                $('#teCtlToggles').append(ctlToggleRowHtml(null));
                $('#teCtlToggles .dash-ctl-trow').last().find('.teCtlTLabel').trigger('focus');
            });
            $ov.on('click', '.dash-ctl-del', function () { $(this).closest('.dash-ctl-row, .dash-ctl-trow').remove(); });
            $ov.on('change', '.teCtlRange', function () {
                var $row = $(this).closest('.dash-ctl-row');
                $row.find('.teCtlEx, .teCtlBlank, .teCtlList').prop('disabled', this.checked);
                $row.find('.teCtlTop').prop('disabled', this.checked || $row.find('.teCtlList').is(':checked'));
            });
            $ov.on('change', '.teCtlList', function () {   // a list has no fold: show N stays out (2026-10-01)
                $(this).closest('.dash-ctl-row').find('.teCtlTop').prop('disabled', this.checked);
            });
            $ov.on('change', '#teSource', function () { columns = []; applySourceFields(); sniffFromReport(); });
            $ov.on('change', '#teUrl, #teJson', function () { sniffFromReport(); });
            $ov.on('change', '#teShow', function () {
                var isChart = $(this).val() === 'chart';
                $('#teChartNField').toggle(isChart);
                $('#teAutoHField').toggle(!isChart);
                if (isChart) { refreshChartPick(); } else { stopChartProbe(); }
            });
            // Cancel on the loading cover: keep the manual number input instead.
            $ov.on('click', '#dashPanelLoadCancel', function () {
                stopChartProbe();
                $('#teChartPickStatus').remove();
                $('#teChartPick').after('<div class="dash-field-hint" id="teChartPickStatus">List loading cancelled - enter the number manually (fullscreen-carousel order).</div>');
            });
            $ov.on('change', '#tePrompts', function () { if (t.report) { sniffFromReport(); } });

            // Sizes are set by dragging the tile's corner in edit mode, not here.
            // Existing tiles keep their spans; new ones start from a sane per-type
            // footprint and get resized in place.
            var TYPE_DEFAULT_SIZE = {
                stat: [3, 2], chart: [6, 4], table: [6, 4], trend: [6, 4],
                embed: [12, 6], note: [12, 2], controls: [12, 2]
            };
            // Reads the editor into a tile object - or returns undefined after
            // telling the author what is missing. Shared by Apply and by "Copy as
            // infobox snippet", so the two can never disagree about a tile.
            function readTileFromEditor() {
                var ty = $('#teType').val();
                var def = TYPE_DEFAULT_SIZE[ty] || [4, 1];
                var next = {
                    id: t.id || uid(),
                    type: ty,
                    label: $.trim($('#teLabel').val()),
                    // Inherit ('' -> undefined) is DROPPED by JSON.stringify, so
                    // inheriting tiles carry no key in the saved state.
                    refreshSeconds: ($('#teRefresh').val() === '' ? undefined : parseInt($('#teRefresh').val(), 10)),
                    w: isNewTile ? def[0] : clampW(t.w),
                    h: isNewTile ? def[1] : clampH(t.h)
                };
                if (ty === 'note') {
                    next.text = $('#teText').val();
                } else if (ty === 'controls') {
                    var cr = readControlsEditor();
                    if (cr.error) { alert(cr.error); return; }
                    next.strip = cr.strip;
                    next.toggles = cr.toggles;
                } else {
                    var srcSel = currentSource();
                    if (srcSel === 'url') {
                        next.source = 'url';
                        next.url = $.trim($('#teUrl').val());
                        if (!next.url) { alert('Enter the JSON URL to read.'); return; }
                        if (!T.isSameOrigin(next.url)) { alert(T.CROSS_ORIGIN_MSG); return; }
                    } else if (srcSel === 'inline') {
                        next.source = 'inline';
                        next.json = $('#teJson').val();
                        try { JSON.parse(next.json); } catch (e) { alert('Rows must be valid JSON: ' + e.message); return; }
                    } else {
                        if (!t.report) { alert('Pick a source report first.'); return; }
                        next.report = t.report;
                        next.source = srcSel;
                        next.prompts = textToPrompts($('#tePrompts').val());
                    }
                    if (ty === 'stat') {
                        next.agg = $('#teAgg').val();
                        next.column = $('#teColumn').val() || '';
                        next.format = $('#teFormat').val();
                        next.sub = $.trim($('#teSub').val());
                        if (next.agg !== 'count' && !next.column) { alert('Pick a column for ' + next.agg + '.'); return; }
                    } else if (ty === 'chart') {
                        next.chartType = $('#teChartType').val();
                        next.groupBy = $('#teGroupBy').val() || '';
                        next.valueAgg = $('#teValueAgg').val();
                        next.valueColumn = $('#teValueColumn').val() || '';
                        next.splitBy = $('#teSplitBy').val() || '';
                        next.topN = Math.max(2, Math.min(50, parseInt($('#teTopN').val(), 10) || 10));
                        if (!next.groupBy) { alert('Pick a group-by column.'); return; }
                        if (next.valueAgg !== 'count' && !next.valueColumn) { alert('Pick a value column for ' + next.valueAgg + '.'); return; }
                    } else if (ty === 'table') {
                        next.columns = $('#teCols input:checked').map(function () { return this.value; }).get();
                        next.rows = Math.max(1, Math.min(200, parseInt($('#teRows').val(), 10) || 10));
                        // Uniform is the default and is stored as absence (JSON.stringify drops undefined).
                        next.rowHeight = ($('#teRowHeight').val() === 'grow') ? 'grow' : undefined;
                        if (!next.columns.length) { alert('Tick at least one column.'); return; }
                    } else if (ty === 'trend') {
                        next.agg = $('#teAgg').val();
                        next.column = $('#teColumn').val() || '';
                        next.format = $('#teFormat').val();
                        next.chartType = $('#teChartType').val();
                        next.points = Math.max(2, Math.min(24, parseInt($('#tePoints').val(), 10) || 12));
                        delete next.source;   // trend is snapshot-history by definition
                        delete next.prompts;
                        if (next.agg !== 'count' && !next.column) { alert('Pick a column for ' + next.agg + '.'); return; }
                    } else if (ty === 'embed') {
                        next.search = $.trim($('#teSearch').val());
                        next.show = $('#teShow').val();
                        if (next.show === 'chart') {
                            next.chartN = Math.max(1, Math.min(99, parseInt($('#teChartN').val(), 10) || 1));
                            next.autoHeight = false;   // the carousel overlay is a fixed stage
                        } else {
                            next.autoHeight = $('#teAutoH').is(':checked');
                        }
                        delete next.source;   // an embed IS the live page
                    }
                }
                return next;
            }
            // The same tile as an action(infobox, ...) link for any report's Custom
            // Code - the engine builds the spec, so what the infobox shows is what
            // this editor describes.
            $ov.on('click', '#teCopySnippet', function () {
                var tl = readTileFromEditor();
                if (!tl) { return; }
                // The infobox tile|/embed| grammar sizes h in 150px rows (its own
                // unit, unchanged); the grid's rows are 68px, so halve on the way out.
                tl.h = Math.max(1, Math.round(clampH(tl.h) / 2));
                var snip = T.tileToInfoboxSnippet(tl, $.trim($('#teLabel').val()));
                $('#teSnippetText').val(snip);
                $('#teSnippetOut').show();
                var done = function () { dashShowText('Infobox snippet copied - paste it into a report\'s Custom Code.', 3500); };
                var fallback = function () { try { $('#teSnippetText')[0].select(); } catch (e) {} };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(snip).then(done, fallback);
                } else { fallback(); }
            });
            $ov.on('click', '#teApply', function () {
                var next = readTileFromEditor();
                if (!next) { return; }
                if (isNewTile) { DASH.tiles.push(next); }
                else {
                    for (var i = 0; i < DASH.tiles.length; i++) {
                        if (DASH.tiles[i].id === next.id) { DASH.tiles[i] = next; break; }
                    }
                }
                dirty = true;
                closePanel();
                // Only the edited/added tile re-renders - every other tile's
                // iframe keeps its loaded state instead of reloading.
                if (isNewTile) { insertTileNode(next.id, null); }
                else { rebuildTile(next.id); }
            });

            renderTypeFields();
            if (t.report) { sniffFromReport(); }
        });
    }

    // ---------------- Duplicate dashboard ----------------
    // Copies the CURRENT in-memory layout (including unsaved tweaks) into a
    // new dashboard owned by this user, then navigates there. The original's
    // unsaved edits stay unsaved - the copy is where they land.
    function openDuplicate() {
        var body =
            fieldRow('Title', '<input type="text" id="dpTitle" maxlength="500" value="' + escapeHtml(((META.title || V.shortId) + ' (copy)').slice(0, 500)) + '">') +
            fieldRow('Dashboard ID', '<input type="text" id="dpId" maxlength="100" value="' + escapeHtml(seedDashId()) + '">',
                'Letters, numbers, hyphens, underscores. Becomes the permanent URL (<code>dashboard.php?id=&hellip;</code>).') +
            '<div class="dash-panel-actions"><button type="button" class="dash-btn dash-btn-primary" id="dpGo">Create copy</button></div>';
        openPanel('Duplicate dashboard', body, function ($ov) {
            $ov.on('click', '#dpGo', function () {
                var title = $.trim($('#dpTitle').val());
                var sid = $.trim($('#dpId').val());
                if (!title) { alert('A title is required.'); return; }
                if (!/^[A-Za-z0-9\-_]{1,100}$/.test(sid)) { alert('Invalid ID.'); return; }
                var payload = {
                    short_id: sid,
                    title: title,
                    authorized: META.authorized || V.currentUserKey,
                    // a copy carries only the tags its maker may apply (2026-10-09): the CREATE gate refused the others, so the
                    // owner of a dashboard an admin had tagged could not copy it; a tag-only maker's copy needs one of theirs
                    tags: (function () { var all = META.tags || []; if (V.isAdmin) { return all; } var held = V.tagGrants || []; var mine = all.filter(function (t) { return held.indexOf(String(t).toUpperCase()) !== -1; }); return (mine.length || !held.length) ? mine : [held[0]]; })(),
                    state_data: JSON.stringify(DASH)
                };
                $.ajax({
                    url: 'manage_dashboard.php?action=save', type: 'POST', contentType: 'application/json',
                    data: JSON.stringify(payload), dataType: 'json'
                }).done(function (r) {
                    if (r && r.status === 'success') {
                        // The copy carries the current in-memory layout, so the
                        // navigation isn't losing anything - suppress the
                        // beforeunload dirty prompt (same pattern as Delete).
                        dirty = false;
                        window.location.href = 'dashboard.php?id=' + encodeURIComponent(sid);
                    }
                    else { alert((r && r.message) || 'Duplicate failed.'); }
                }).fail(function (x) { alert((x.responseJSON && x.responseJSON.message) || 'Duplicate failed.'); });
            });
        });
    }

    // ---------------- Create dashboard (home) ----------------
    function seedDashId() {
        var rnd = Math.random().toString(36).substring(2, 6);
        if (V.isAdmin) { return 'dash-' + rnd; }
        for (var i = 0; i < V.reportGrantPatterns.length; i++) {
            var p = String(V.reportGrantPatterns[i] || '');
            if (p.indexOf('*') === -1) { continue; }
            var seeded = p.replace(/\*/g, 'dash' + rnd);
            if (/^[A-Za-z0-9\-_]+$/.test(seeded)) { return seeded; }
        }
        return 'dash-' + rnd;
    }

    function openCreate() {
        var body =
            fieldRow('Title', '<input type="text" id="dcTitle" maxlength="500" placeholder="e.g. Pre-award at a glance">') +
            fieldRow('Dashboard ID', '<input type="text" id="dcId" maxlength="100" value="' + escapeHtml(seedDashId()) + '">',
                V.isAdmin ? 'Letters, numbers, hyphens, underscores. Becomes the permanent URL (<code>dashboard.php?id=&hellip;</code>).'
                          : (V.reportGrantPatterns.length ? 'Must match one of your report-grant patterns (' + escapeHtml(V.reportGrantPatterns.join(', ')) + '), or the dashboard must carry one of your tags.'
                                                          : 'Letters, numbers, hyphens, underscores. The dashboard must carry one of your tags (below).')) +
            (V.tagsReady && (V.isAdmin || (V.tagGrants || []).length) ? fieldRow('Tags', '<div class="dash-access-box" id="dcTagBox"><input type="text" id="dcTagInput" list="dcTagList" placeholder="Add an existing tag&hellip;" autocomplete="off"></div>' + tagListHtml('dcTagList'),
                V.isAdmin ? 'Optional. How the dashboard home finds it (<code>tag:NAME</code>); a tag grant makes its holders editors of it.'
                          : 'Pre-filled with the tags you hold a grant on; keep at least one unless the ID matches a pattern of yours.') : '') +
            '<div class="dash-panel-actions"><button type="button" class="dash-btn dash-btn-primary" id="dcGo">Create</button></div>';
        openPanel('New dashboard', body, function ($ov) {
            var createTags = $('#dcTagBox').length ? buildTagPillbox($('#dcTagBox'), V.isAdmin ? [] : (V.tagGrants || [])) : null;
            $ov.on('click', '#dcGo', function () {
                var title = $.trim($('#dcTitle').val());
                var sid = $.trim($('#dcId').val());
                if (!title) { alert('A title is required.'); return; }
                if (!/^[A-Za-z0-9\-_]{1,100}$/.test(sid)) { alert('Invalid ID.'); return; }
                var payload = {
                    short_id: sid, title: title, authorized: V.currentUserKey,
                    tags: createTags ? createTags.value() : [],
                    state_data: JSON.stringify({ version: 1, theme: 'theme-default', refreshSeconds: 0, tiles: [] })
                };
                $.ajax({
                    url: 'manage_dashboard.php?action=save', type: 'POST', contentType: 'application/json',
                    data: JSON.stringify(payload), dataType: 'json'
                }).done(function (r) {
                    if (r && r.status === 'success') { window.location.href = 'dashboard.php?id=' + encodeURIComponent(sid); }
                    else { alert((r && r.message) || 'Create failed.'); }
                }).fail(function (x) { alert((x.responseJSON && x.responseJSON.message) || 'Create failed.'); });
            });
        });
    }

    // ---------------- Save ----------------
    // Toast notifications: the SAME system as the report page - main.js's
    // show_text() renders stacked cards into the #action_overlay dock. This is
    // a slim re-host (the SSO-dialog pattern): identical markup and classes so
    // main.css (which dashboard.php already loads) owns the entire look, with
    // the behavior subset a dashboard needs - stack of up to 3 cards, per-card
    // countdown bar, hover/keyboard-focus pause, close button - and without
    // the report page's queue pill / coalescing / pop-out-console routing.
    // Kind is sniffed from the house prefix markup (SUCCESS:/ERROR:/NOTICE:)
    // exactly like main.js's _pnbToastKind, so call sites read the same.
    var _DASH_TOAST_ICONS = {
        ok:   '<svg class="pnb-toast-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7-8"/></svg>',
        err:  '<svg class="pnb-toast-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3v6"/><circle cx="8" cy="12.5" r="0.8" fill="currentColor" stroke="none"/></svg>',
        warn: '<svg class="pnb-toast-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2L14.5 13.5H1.5L8 2z"/><path d="M8 6.5v3"/></svg>',
        load: '<svg class="pnb-toast-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 1.5A6.5 6.5 0 1 1 1.5 8"/></svg>',
        info: '<svg class="pnb-toast-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 7v6"/><circle cx="8" cy="3.5" r="0.8" fill="currentColor" stroke="none"/></svg>'
    };
    function _dashToastKind(html) {
        var head = String(html).slice(0, 400).toLowerCase();
        if (head.indexOf('lightgreen') !== -1) return 'ok';
        if (head.indexOf('accent-danger') !== -1 || head.indexOf('#cc0000') !== -1
            || head.indexOf('color: red') !== -1 || head.indexOf('color:red') !== -1) return 'err';
        if (head.indexOf('#5bc0de') !== -1) return 'load';
        if (head.indexOf('accent-warning') !== -1 || head.indexOf('orange') !== -1
            || head.indexOf('gold') !== -1) return 'warn';
        return 'info';
    }
    var _dashToastCards = [], _dashToastPaused = false, _dashToastRaf = 0, _dashToastLast = 0;
    function _dashToastDock() {
        var dock = document.getElementById('action_overlay');
        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'action_overlay';
            dock.className = 'pnb-toast-dock';
            dock.innerHTML = '<span class="pnb-toast-more" hidden></span>';
            document.body.appendChild(dock);
            dock.addEventListener('mouseenter', function () { _dashToastPaused = true; });
            dock.addEventListener('mouseleave', function () { _dashToastPaused = false; });
            dock.addEventListener('focusin', function () { _dashToastPaused = true; });
            dock.addEventListener('focusout', function () { _dashToastPaused = false; });
            dock.addEventListener('click', function (e) {
                var btn = e.target && e.target.closest ? e.target.closest('.pnb-toast-x') : null;
                if (!btn) { return; }
                var card = btn.closest('.pnb-toast-card');
                for (var i = 0; i < _dashToastCards.length; i++) {
                    if (_dashToastCards[i].el === card) { _dashToastClose(_dashToastCards[i]); break; }
                }
            });
        }
        return dock;
    }
    function _dashToastClose(t) {
        if (t.closing) { return; }
        t.closing = true;
        t.el.classList.add('pnbt-leave');
        setTimeout(function () {
            if (t.el.parentNode) { t.el.parentNode.removeChild(t.el); }
            var i = _dashToastCards.indexOf(t);
            if (i > -1) { _dashToastCards.splice(i, 1); }
        }, 180);
    }
    function _dashToastLoop() {
        if (_dashToastRaf) { return; }
        _dashToastLast = Date.now();
        _dashToastRaf = requestAnimationFrame(function tick() {
            _dashToastRaf = 0;
            var now = Date.now();
            // Clamp dt: rAF freezes in hidden tabs; time away must not count
            // against a toast (same rule as the report page's loop).
            var dt = Math.min(250, now - _dashToastLast);
            _dashToastLast = now;
            if (!_dashToastPaused) {
                _dashToastCards.slice().forEach(function (t) {
                    if (t.closing) { return; }
                    t.remaining -= dt;
                    if (t.barEl) { t.barEl.style.transform = 'scaleX(' + Math.max(0, t.remaining / t.duration) + ')'; }
                    if (t.remaining <= 0) { _dashToastClose(t); }
                });
            }
            if (_dashToastCards.length) { _dashToastRaf = requestAnimationFrame(tick); }
        });
    }
    function dashShowText(text, duration) {
        duration = duration || 8000;
        var safe = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(text) : text;
        var dock = _dashToastDock();
        var kind = _dashToastKind(safe);
        var live = _dashToastCards.filter(function (c) { return !c.closing; });
        if (live.length >= 3) { _dashToastClose(live[0]); }   // oldest yields; no queue here
        var el = document.createElement('div');
        el.className = 'pnb-toast-card pnbt-' + kind + (duration >= 12000 ? ' pnbt-pinned' : '');
        el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
        el.innerHTML = (_DASH_TOAST_ICONS[kind] || _DASH_TOAST_ICONS.info)
            + '<span class="pnb-toast-msg"></span>'
            + '<span class="pnb-toast-count"></span>'
            + '<button type="button" class="pnb-toast-x" aria-label="Close" title="Close">&times;</button>'
            + '<span class="pnb-toast-bar" aria-hidden="true"></span>';
        el.querySelector('.pnb-toast-msg').innerHTML = safe;
        dock.appendChild(el);
        el.classList.add('pnbt-enter');
        setTimeout(function () { el.classList.remove('pnbt-enter'); }, 30);
        _dashToastCards.push({
            el: el, duration: duration, remaining: duration, closing: false,
            barEl: el.querySelector('.pnb-toast-bar')
        });
        _dashToastLoop();
    }

    function saveDashboard() {
        var payload = {
            short_id: META.short_id || V.shortId,
            title: META.title || META.short_id || V.shortId,
            authorized: META.authorized || V.currentUserKey,
            tags: META.tags || [],
            tags_base: Array.isArray(META.tagsBase) ? META.tagsBase : (META.tags || []),   // what this page loaded (2026-10-09): only its own changes move
            state_data: JSON.stringify(DASH),
            overwrite: !IS_NEW
        };
        var $btn = $('#dashSaveBtn').prop('disabled', true).text('Saving…');
        $.ajax({
            url: 'manage_dashboard.php?action=save', type: 'POST', contentType: 'application/json',
            data: JSON.stringify(payload), dataType: 'json'
        }).done(function (r) {
            $btn.prop('disabled', false).text('Save');
            if (r && r.status === 'success') {
                dirty = false;
                IS_NEW = false;
                $btn.text('Saved ✓');
                setTimeout(function () { $btn.text('Save'); }, 1600);
                if (Array.isArray(r.tags)) { META.tags = r.tags.slice(); }   // the list as stored (2026-10-09): the next save starts from it
                META.tagsBase = (META.tags || []).slice();
                if (r.tags_failed) { dashShowText("<p id='undo_text'><span style='color: var(--accent-danger, #cc0000)'>WARNING:</span> " + escapeHtml(r.message || 'The layout is saved; its tags are not.') + "</p>"); }
                else { dashShowText("<p id='undo_text'><span style='color: lightgreen'>SUCCESS:</span> Dashboard saved.</p>"); }
            } else {
                dashShowText("<p id='undo_text'><span style='color: var(--accent-danger, #cc0000)'>ERROR:</span> Save failed: " + escapeHtml((r && r.message) || 'unknown error') + " - your changes are NOT stored yet.</p>", 15000);
            }
        }).fail(function (x) {
            $btn.prop('disabled', false).text('Save');
            dashShowText("<p id='undo_text'><span style='color: var(--accent-danger, #cc0000)'>ERROR:</span> Save failed: " + escapeHtml((x.responseJSON && x.responseJSON.message) || 'network or server error') + " - your changes are NOT stored yet.</p>", 15000);
        });
    }

    // ---------------- SSO expiry recovery ----------------
    // Same contract as the report page's net (main.js): campus SSO lasts ~an
    // hour; when it lapses, tile fetches die as status 0 (CSP kills the
    // cross-origin Shib redirect), an explicit X-Penumbra-Auth: expired header,
    // or a login PAGE arriving where JSON was expected. sso_refresh.html
    // announces success via postMessage + BroadcastChannel('pnb_sso'). Markup
    // reuses main.css's modal/sso classes so the dialog matches the report's.
    var _ssoPopup = null, _ssoWired = false, _ssoSignedIn = false;
    function ssoRefreshUrl() { return 'sso_refresh.html?t=' + Date.now(); }
    function ssoMarkSignedIn() {
        _ssoSignedIn = true;
        if (_ssoPopup && !_ssoPopup.closed) { try { _ssoPopup.close(); } catch (e) {} }
        _ssoPopup = null;
        var $box = $('#dashSsoLightbox');
        if (!$box.length) { return; }
        $box.find('.sso-popup-blocked').removeClass('is-on');
        $box.find('.sso-status').addClass('is-on is-success')
            .html('<span class="sso-check" aria-hidden="true">&#10003;</span> Signed back in.');
        $box.find('#dashSsoSignIn').hide();
        $box.find('#dashSsoClose').text('Close & reload tiles').trigger('focus');
    }
    function ssoWire() {
        if (_ssoWired) { return; }
        _ssoWired = true;
        window.addEventListener('message', function (ev) {
            if (ev.origin !== window.location.origin) { return; }
            if (ev.data && ev.data.type === 'pnb-sso-refreshed') { ssoMarkSignedIn(); }
        });
        if ('BroadcastChannel' in window) {
            try {
                var bc = new BroadcastChannel('pnb_sso');
                bc.onmessage = function (ev) {
                    if (ev.data && ev.data.type === 'pnb-sso-refreshed') { ssoMarkSignedIn(); }
                };
            } catch (e) { /* best-effort; postMessage path remains */ }
        }
    }
    function showSsoDialog() {
        if ($('#dashSsoLightbox').length) { return; }   // bursts = one dialog
        ssoWire();
        _ssoSignedIn = false;
        $('body').append(
            '<div id="dashSsoLightbox" class="modal-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="dashSsoTitle">' +
            '<div class="modal-prompt-box" style="position:relative;">' +
            '<div class="pnb-dlg-head"><div class="pnb-dlg-tt">' +
            '<h3 class="pnb-dlg-title" id="dashSsoTitle">Sign-in session expired</h3></div>' +
            '<button class="close-lightbox" aria-label="Close" title="Close">&times;</button></div>' +
            '<div class="modal-prompt-content">' +
            '<p>Your NC&nbsp;State single sign-on session has expired &mdash; campus SSO only lasts about an hour. <strong>The dashboard layout is safe;</strong> the server just refused the last data request.</p>' +
            '<ol class="sso-steps">' +
            '<li>Click <strong>Sign in again</strong>. A small NC&nbsp;State login window opens.</li>' +
            '<li>When it finishes it closes itself and this dialog shows <strong>Signed back in</strong>.</li>' +
            '<li>Close this dialog &mdash; the tiles reload automatically.</li></ol>' +
            '<p class="sso-popup-blocked">Your browser blocked the popup &mdash; <a href="sso_refresh.html" target="_blank" rel="opener" class="dash-sso-manual">open the sign-in page in a new tab</a> instead, then come back here.</p>' +
            '<div class="sso-status" role="status" aria-live="polite"></div></div>' +
            '<div class="modal-prompt-buttons" style="justify-content:flex-end;">' +
            '<button id="dashSsoClose" class="modal-btn-secondary">Close</button>' +
            '<button id="dashSsoSignIn" class="modal-btn-primary">Sign in again</button>' +
            '</div></div></div>');
        $('#dashSsoSignIn').trigger('focus');
    }
    $(document).on('click', '#dashSsoSignIn', function () {
        var w = 560, h = 700;
        var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
        var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
        var win = null;
        try { win = window.open(ssoRefreshUrl(), 'pnbSsoRefresh', 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top); } catch (e) {}
        if (!win) { try { win = window.open(ssoRefreshUrl(), '_blank'); } catch (e) {} }
        var $box = $('#dashSsoLightbox');
        if (win) {
            _ssoPopup = win;
            try { win.focus(); } catch (e) {}
            $box.find('.sso-popup-blocked').removeClass('is-on');
            $box.find('.sso-status').removeClass('is-success').addClass('is-on')
                .html('<span class="infobox-spinner" aria-hidden="true"></span> Waiting for the sign-in window to finish&hellip;');
        } else {
            $box.find('.sso-popup-blocked').addClass('is-on');
        }
    });
    $(document).on('click', '.dash-sso-manual', function () { this.href = ssoRefreshUrl(); });
    $(document).on('click', '#dashSsoClose, #dashSsoLightbox .close-lightbox', function () {
        var reload = _ssoSignedIn;
        $('#dashSsoLightbox').remove();
        // Fresh session, stale tiles: refetch everything (embeds reload too).
        if (reload && V.found) { renderDash(true); }
    });
    // The detection net - mirrors main.js's ajaxError triage exactly.
    $(document).ajaxError(function (event, jqXHR, settings) {
        if (!jqXHR || !settings) { return; }
        if (jqXHR.statusText === 'abort' || jqXHR.statusText === 'canceled') { return; }
        var authHdr = '';
        try { authHdr = jqXHR.getResponseHeader('X-Penumbra-Auth') || ''; } catch (err) {}
        if (authHdr === 'expired') { showSsoDialog(); return; }
        var url = String(settings.url || '').split('#')[0];
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) && url.indexOf(window.location.origin + '/') !== 0) { return; }
        if (!/\.php(\?|$)/i.test(url)) { return; }
        if (jqXHR.status === 0) {
            if (navigator.onLine === false) { return; }
            showSsoDialog();
            return;
        }
        // A login PAGE where JSON was expected: 200 + HTML body + no parsed JSON.
        if (jqXHR.status === 200 && jqXHR.responseJSON === undefined &&
            typeof jqXHR.responseText === 'string' && /^\s*<(!doctype|html)\b/i.test(jqXHR.responseText)) {
            showSsoDialog();
        }
    });

    // ---------------- Auto refresh ----------------
    // Countdown bar: a thin line that depletes toward the next auto-refresh -
    // bottom edge of the title band normally, fixed at the viewport top in kiosk
    // (the band is hidden there). Ticks once per second, so reduced-motion users
    // get discrete steps; everyone else gets a CSS-smoothed glide between ticks.
    var cdTimer = null, cdEndsAt = 0, cdTotal = 0;
    function tickCountdown() {
        var bar = document.getElementById('dashCountdown');
        if (!bar) { return; }
        // Edit mode pauses auto-refresh, so a depleting bar would be a lie.
        bar.style.visibility = editMode ? 'hidden' : '';
        var remain = Math.max(0, cdEndsAt - Date.now());
        document.getElementById('dashCountdownFill').style.width =
            (cdTotal ? (remain / cdTotal) * 100 : 0) + '%';
    }
    function stopCountdown() {
        if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
        $('#dashCountdown').remove();
    }
    function armCountdown(seconds) {
        stopCountdown();
        var html = '<div id="dashCountdown" aria-hidden="true"><span id="dashCountdownFill"></span></div>';
        if (KIOSK) { $('body').append(html); $('#dashCountdown').addClass('dash-cd-fixed'); }
        else { $('#dashHead').append(html); }
        cdTotal = seconds * 1000;
        cdEndsAt = Date.now() + cdTotal;
        tickCountdown();
        cdTimer = setInterval(tickCountdown, 1000);
    }
    // ── Per-tile auto-refresh engine ─────────────────────────────────────────
    // Refresh cadence resolves PER TILE: tile.refreshSeconds when set (-1 =
    // None: this tile never auto-refreshes; >=30 = its own interval), else the
    // dashboard's refreshSeconds (0 = Off, -1 = Never even in kiosk). One 5s
    // ticker walks the due times - a due embed reloads its iframe in place, a
    // due data tile drops its cache entry and re-renders alone. The old design
    // (one interval -> renderDash(true)) reloaded EVERY tile together.
    function tileEffRefresh(tile) {
        if (tile && tile.refreshSeconds !== undefined && tile.refreshSeconds !== null && String(tile.refreshSeconds) !== '') {
            var own = parseInt(tile.refreshSeconds, 10);
            if (!isNaN(own)) { return own; }
        }
        return parseInt(DASH.refreshSeconds, 10) || 0;
    }
    function refreshTile($tile, tile) {
        _tileLastRefresh[tile.id] = Date.now();
        if (tile.type === 'note' || tile.type === 'controls') { return; }   // static text / chips over other tiles - nothing to refetch
        if (tile.type === 'embed') {
            var fr = $tile.find('iframe.dash-embed')[0];
            if (fr) {
                // Reload at the tile's CURRENT address: a dashboard filter applied
                // in place since the frame loaded (2026-09-29) lives in it.
                var want = T.embedUrl(effTile(tile), embedOpts());
                try {
                    if (fr.contentWindow.location.href === new URL(want, window.location.href).href) { fr.contentWindow.location.reload(); }
                    else { fr.src = want; }
                } catch (e) { fr.src = want; }
            }
            return;
        }
        // Drop the tile's OWN cache entry: trend tiles cache under a 'T:' key
        // (deleting the 'L:' key would evict a same-report sibling's live
        // entry for nothing). And when several tiles share one key, a sibling
        // may have refetched it seconds ago - within 15s the entry is fresh
        // enough, so re-render from it instead of stampeding N identical
        // queries for N same-report tiles due in the same tick.
        var key = (tile.type === 'trend') ? trendFetchKey(tile) : tileFetchKey(tile);
        var ent = dataCache[key];
        if (!(ent && ent.at && (Date.now() - ent.at) < 15000)) { delete dataCache[key]; }
        renderTileInto($tile, tile);
    }
    var _refreshPaused = false;   // the header's Pause refresh button (viewer-facing)
    function scheduleAutoRefresh() {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
        stopCountdown();
        var dashS = parseInt(DASH.refreshSeconds, 10) || 0;
        // The countdown bar shows the DASHBOARD cadence (what inheriting tiles
        // follow); tiles with their own interval simply do their thing.
        if (dashS >= 30) { armCountdown(dashS); }
        refreshTimer = setInterval(function () {
            // Re-arm the bar each dashboard cycle whether or not tiles ran -
            // the next ATTEMPT is always one interval away.
            if (dashS >= 30 && Date.now() >= cdEndsAt) { cdEndsAt = Date.now() + cdTotal; }
            // Hidden tabs are timer-throttled by the browser anyway; skip so a
            // wall of queries never fires the moment a background tab wakes.
            if (document.hidden || editMode || _refreshPaused) { return; }
            var now = Date.now();
            for (var i = 0; i < DASH.tiles.length; i++) {
                var t = DASH.tiles[i];
                var eff = tileEffRefresh(t);
                if (eff < 30) { continue; }
                if (now - (_tileLastRefresh[t.id] || 0) < eff * 1000) { continue; }
                var $tile = $('#dashMain .dash-tile[data-tile-id="' + t.id + '"]');
                if (!$tile.length) { continue; }
                // A reader mid-table: a refresh would scroll the excerpt (or reload
                // the framed report) out from under them. Skip this tick; the tile
                // stays due and goes the moment the pointer leaves (2026-09-05).
                var readable = (t.type === 'table') || (t.type === 'embed' && t.show !== 'chart' && t.show !== 'header');
                if (readable && $tile.is(':hover')) { continue; }
                // Keyboard reader: a focused control inside the tile (or the tile
                // itself) would be destroyed by the re-render. Same rule, any tile.
                if ($tile.is(':focus') || $tile.find(':focus').length) { continue; }
                refreshTile($tile, t);
            }
        }, 5000);
    }

    // =========================================================================
    // Events
    // =========================================================================
    // Pin toggle on a home card. The card itself is a link, so the star must both
    // stop the navigation and never bubble into it.
    $(document).on('click', '.dash-pin', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var sid = String($(this).data('sid'));
        var pins = loadPins();
        var i = pins.indexOf(sid);
        if (i > -1) { pins.splice(i, 1); } else { pins.push(sid); }
        savePins(pins);
        renderHome();   // re-sorts pinned-first and refreshes star states
    });

    $(document).on('click', '#dashPauseBtn', function () {
        _refreshPaused = !_refreshPaused;
        if (_refreshPaused) { stopCountdown(); }
        else { var s = parseInt(DASH.refreshSeconds, 10) || 0; if (s >= 30) { armCountdown(s); } }
        renderHead();   // relabels the button; focus stays on it
        dashAnnounce(_refreshPaused ? 'Automatic refresh paused' : 'Automatic refresh resumed');
    });

    $(document).on('click', '#dashCreateBtn', openCreate);
    $(document).on('click', '#dashInstallBtn', function () {
        var $b = $(this).prop('disabled', true).text('Creating…');
        $.ajax({ url: 'manage_dashboard.php?action=install', type: 'POST', contentType: 'application/json', data: '{}', dataType: 'json' })
            .done(function (r) {
                if (r && r.status === 'success') { renderHome(); }
                else { $b.prop('disabled', false).text('Create table now'); alert((r && r.message) || 'Install failed.'); }
            })
            .fail(function (x) { $b.prop('disabled', false).text('Create table now'); alert((x.responseJSON && x.responseJSON.message) || 'Install failed.'); });
    });
    // Kiosk: THIS click is the user gesture - the kiosk page itself loads
    // without one and could never call requestFullscreen. Enter fullscreen,
    // then flip to kiosk IN PLACE: element fullscreen does NOT survive a
    // navigation (live-verified - navigating snapped the window straight
    // back out), and nothing about kiosk mode actually needs a reload.
    // The URL is rewritten via replaceState so refresh/bookmark stay kiosk.
    // The pre-kiosk refresh interval, so leaving kiosk restores the author's
    // setting instead of keeping the kiosk default forever. null = kiosk never
    // overrode it.
    var _preKioskRefresh = null;

    // ── Kiosk auto-cycle ─────────────────────────────────────────────────────
    // DASH.cycle = { ids: ['other-dash', ...], seconds: N }: while kiosk is
    // active, rotate between this dashboard and the listed ones IN PLACE (a
    // navigation would kill fullscreen). Each hop fetches the next dashboard
    // via manage_dashboard action=get (viewer-authorized), swaps DASH/META,
    // and re-renders; inaccessible or broken entries are skipped so one bad
    // id can't stall the rotation.
    var _cycleTimer = null, _cycleList = null, _cyclePos = 0;
    // Epoch token: a hop's fetch can still be in flight when kiosk exits (or
    // another hop starts). Every teardown bumps the epoch; a landing response
    // whose epoch is stale gets dropped instead of swapping the page under a
    // user who already left kiosk.
    var _cycleEpoch = 0;
    function startKioskCycle() {
        stopKioskCycle();
        var cfg = DASH.cycle;
        if (!cfg || !Array.isArray(cfg.ids) || !cfg.ids.length) { return; }
        if (dirty) {
            dashShowText("<p id='undo_text'><span style='color: orange'>NOTICE:</span> Kiosk cycling is paused - this dashboard has unsaved changes that rotating away would lose.</p>", 12000);
            return;
        }
        _cycleList = [String(META.short_id || V.shortId)].concat(cfg.ids.map(String));
        _cyclePos = 0;
        var secs = Math.max(15, parseInt(cfg.seconds, 10) || 60);
        _cycleTimer = setInterval(function () {
            _cyclePos = (_cyclePos + 1) % _cycleList.length;
            loadDashboardInPlace(_cycleList[_cyclePos]);
        }, secs * 1000);
    }
    function stopKioskCycle() {
        _cycleEpoch++;   // invalidates any hop fetch still in flight
        if (_cycleTimer) { clearInterval(_cycleTimer); _cycleTimer = null; }
        _cycleList = null;
        _cyclePos = 0;
    }
    function loadDashboardInPlace(sid) {
        // manage_dashboard action=get: existing endpoint (viewer-authorized),
        // takes `id` and returns top-level short_id/title/authorized plus the
        // PARSED layout in `state`.
        var ep = _cycleEpoch;
        $.getJSON('manage_dashboard.php', { action: 'get', id: sid })
            .done(function (r) {
                // A response landing after the user left kiosk (or after a
                // newer hop) must not swap the page under them.
                if (ep !== _cycleEpoch || !KIOSK) { return; }
                if (!r || r.status !== 'success') { return; }   // skip, keep rotating
                var st = (r.state && Array.isArray(r.state.tiles)) ? r.state : null;
                if (!st) { return; }
                _dashGen++;   // stale tile fetches from the outgoing dashboard drop their results
                // Tear down the current dashboard's live pieces.
                for (var k in chartInstances) {
                    if (Object.prototype.hasOwnProperty.call(chartInstances, k)) {
                        try { chartInstances[k].destroy(); } catch (e2) { }
                    }
                }
                chartInstances = {};
                sweepEmbedObservers();
                dataCache = {};
                _tileLastRefresh = {};
                DASH = normalizeGridUnits(st);
                applyDefaultFilter();   // its own default, unless the address carried a filter (2026-09-30)
                META = { short_id: r.short_id, title: r.title, authorized: r.authorized, owner_id: r.owner_id, tags: Array.isArray(r.tags) ? r.tags.slice() : [] };   // the tags too (2026-10-09): a Save after a hop used to post an empty list
                META.tagsBase = META.tags.slice();
                V.shortId = r.short_id;
                V.found = true;
                // &noadm previews a viewer: manage_dashboard.php never hears it, so
                // the fetched dashboard's can_edit (an admin's, an owner's) is clamped
                // here - the page's own rule (dashboard.php's $canEdit). (2026-10-02)
                V.canEdit = !!r.can_edit && !penumbra_dash_vars.noadm;   // Edit/Save entry points after exit reflect THIS dashboard
                // Same kiosk default rule as entry - and the same STASH: exit
                // must restore the fetched dashboard's own value, or the 300s
                // default leaks into a later Save (it silently overwrote the
                // author's "Off" before this stash).
                _preKioskRefresh = null;
                var ks2 = parseInt(DASH.refreshSeconds, 10) || 0;
                if (KIOSK && ks2 !== -1 && ks2 < 30) {
                    _preKioskRefresh = DASH.refreshSeconds;
                    DASH.refreshSeconds = KIOSK_DEFAULT_REFRESH;
                }
                // The corner x navigates on middle/ctrl-click - keep its href
                // pointing at the dashboard actually on screen.
                $('.dash-kiosk-exit').attr('href', dashPageUrl(r.short_id, false));
                // Swap the page theme with the dashboard (embeds get the new
                // theme via their URLs; the chrome must match).
                applyPageTheme(st.theme || 'theme-default');
                try {
                    history.replaceState(null, '', dashPageUrl(r.short_id, KIOSK));
                } catch (e3) { }
                document.title = resolveLabel(r.title || r.short_id, null) + ' · Penumbra Dashboards';
                renderDash();
                scheduleAutoRefresh();
            });
    }
    // Kiosk pointer (2026-09-05): a wall display otherwise shows a mouse arrow
    // forever. Hidden after 3s without movement, back on the next move; framed
    // reports keep their own cursor (a parent's CSS never reaches an iframe).
    var _curTimer = null;
    function _cursorWake() {
        $('body').removeClass('dash-cursor-hidden');
        clearTimeout(_curTimer);
        _curTimer = setTimeout(function () { if (KIOSK) { $('body').addClass('dash-cursor-hidden'); } }, 3000);
    }
    function armCursorHide() { $(document).on('mousemove.dashCursor mousedown.dashCursor keydown.dashCursor', _cursorWake); _cursorWake(); }
    function disarmCursorHide() { $(document).off('.dashCursor'); clearTimeout(_curTimer); $('body').removeClass('dash-cursor-hidden'); }

    // fromAddress (2026-10-01): the boot path, where KIOSK is already true from
    // the ?kiosk=1 address and no gesture has happened yet.
    function enterKioskMode(fromAddress) {
        if (KIOSK && !fromAddress) { return; }
        KIOSK = true;
        document.body.className += ' dash-kiosk';
        armCursorHide();
        // An unattended screen must stay current even when the author never
        // set an interval - EXCEPT when the author chose "Never" (-1), which
        // means static everywhere, kiosk included. In-memory only.
        var _ksNow = parseInt(DASH.refreshSeconds, 10) || 0;
        if (_ksNow !== -1 && _ksNow < 30) {
            _preKioskRefresh = DASH.refreshSeconds;
            DASH.refreshSeconds = KIOSK_DEFAULT_REFRESH;
        }
        if (!$('.dash-kiosk-exit').length) {
            $('body').append('<a class="dash-kiosk-exit" href="' + escapeHtml(dashPageUrl(V.shortId, false)) +
                '" title="Leave kiosk view (Esc)">&times;</a>');
        }
        try { history.replaceState(null, '', dashPageUrl(V.shortId, true)); } catch (e) { }
        renderHead();            // kiosk branch empties the action bar
        scheduleAutoRefresh();   // re-arm with the kiosk interval; the countdown re-pins itself
        startKioskCycle();       // rotates dashboards when DASH.cycle is configured
    }
    // The exit twin - also IN PLACE, so tiles keep their loaded state on the
    // way out too. Two ways in here: the corner x (mouse) and the
    // fullscreenchange listener (keyboard: Esc leaves fullscreen, which
    // auto-cancels kiosk - one press exits both).
    function exitKioskMode() {
        if (!KIOSK) { return; }
        KIOSK = false;
        stopKioskCycle();
        disarmCursorHide();
        $('body').removeClass('dash-kiosk');
        if (_preKioskRefresh !== null) { DASH.refreshSeconds = _preKioskRefresh; _preKioskRefresh = null; }
        $('.dash-kiosk-exit').remove();
        $('.dash-kiosk-hint').remove();
        $(document).off('.dashKioskFs');
        try { history.replaceState(null, '', dashPageUrl(V.shortId, false)); } catch (e) { }
        try { if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); } } catch (e) { }
        renderHead();            // the action bar comes back
        scheduleAutoRefresh();   // restored interval; countdown re-homes to the title band
    }
    // Kiosk exists ONLY in true fullscreen (user call, 2026-08-13): windowed
    // kiosk is just a hidden toolbar - worthless. So: entry requires the
    // fullscreen request to be GRANTED (this click is the gesture), and any
    // exit from fullscreen - Esc, F11, the browser's own UI - cancels kiosk
    // automatically. One Esc therefore leaves both.
    $(document).on('click', 'a.dash-btn[href*="kiosk=1"]', function (e) {
        e.preventDefault();
        try {
            var p = document.documentElement.requestFullscreen();
            if (p && p.then) {
                p.then(function () { enterKioskMode(); }, function () {
                    dashShowText("<p id='undo_text'><span style='color: orange'>NOTICE:</span> The browser blocked the fullscreen request - kiosk view needs it.</p>");
                });
            } else {
                // No promise (ancient engine): trust the synchronous call only
                // if fullscreen actually took - kiosk stays fullscreen-only.
                setTimeout(function () {
                    if (document.fullscreenElement) { enterKioskMode(); }
                    else { dashShowText("<p id='undo_text'><span style='color: orange'>NOTICE:</span> The browser blocked the fullscreen request - kiosk view needs it.</p>"); }
                }, 120);
            }
        } catch (err) {
            dashShowText("<p id='undo_text'><span style='color: orange'>NOTICE:</span> Fullscreen is unavailable in this browser - kiosk view needs it.</p>");
        }
    });
    $(document).on('click', '.dash-kiosk-exit', function (e) {
        e.preventDefault();
        exitKioskMode();
    });
    // A kiosk opened from its ADDRESS (2026-10-01) has had no user gesture, so
    // the browser's full screen waits for a click or a key press: every one
    // while the kiosk is windowed asks (best effort; refused, it stays
    // windowed), and a hint button stays until full screen is granted - a click
    // on it is a gesture the page itself sees. No hint when the window already
    // fills the screen (F11, or a browser launched in its own kiosk mode:
    // nothing more needed). The dashboard's embedded reports are same-origin
    // frames, and a click or a key INSIDE one never reaches this document (seen
    // live: the first click landed in a frame), so their documents get the same
    // listeners - the frames there at entry, and later ones on their load
    // through an observer, since a reload gives a frame a new document.
    function kioskGesture(e) {
        if (!KIOSK) { return; }
        if (e && e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) { return; }
        if (document.fullscreenElement) { return; }
        try { var p = document.documentElement.requestFullscreen(); if (p && p.catch) { p.catch(function () { }); } } catch (err) { }
    }
    function kioskFrameKey(e) {
        if (e.key === 'Escape') { if (KIOSK && !document.fullscreenElement) { exitKioskMode(); } return; }
        kioskGesture(e);
    }
    function armKioskFrameDoc(fr) {
        var d = null;
        try { d = fr.contentDocument; } catch (e) { d = null; }
        if (!d || d.__pnbKiosk) { return; }
        d.__pnbKiosk = true;
        d.addEventListener('click', kioskGesture, true);
        d.addEventListener('keydown', kioskFrameKey, true);
    }
    var _kioskFrameObs = null;
    function armKioskFrames() {
        $('iframe.dash-embed').each(function () {
            var fr = this;
            if (!fr.__pnbKioskLoad) { fr.__pnbKioskLoad = true; fr.addEventListener('load', function () { if (KIOSK) { armKioskFrameDoc(fr); } }); }
            armKioskFrameDoc(fr);
        });
        if (!_kioskFrameObs && window.MutationObserver) {
            _kioskFrameObs = new MutationObserver(function () { if (KIOSK) { armKioskFrames(); } });
            _kioskFrameObs.observe(document.getElementById('dashMain') || document.body, { childList: true, subtree: true });
        }
    }
    function armKioskGestureFullscreen() {
        var fills = window.innerWidth >= (screen.width - 2) && window.innerHeight >= (screen.height - 2);
        if (!fills && !document.fullscreenElement && !$('.dash-kiosk-hint').length) {
            $('body').append('<button type="button" class="dash-kiosk-hint">&#9974;&#xFE0E; Click for full screen &middot; Esc leaves kiosk view</button>');
        }
        $(document).off('.dashKioskFs').on('click.dashKioskFs keydown.dashKioskFs', kioskGesture);
        armKioskFrames();
    }
    // Esc leaves a windowed kiosk (one opened from its address before any
    // gesture took it full screen); in full screen the browser's own Esc exit
    // arrives as fullscreenchange below. On the window at capture: the page's
    // own Escape handlers stop the event lower down.
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && KIOSK && !document.fullscreenElement && !$('#dashOverlay').length) { exitKioskMode(); }
    }, true);
    document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement) { $('.dash-kiosk-hint').remove(); }
        if (KIOSK && !document.fullscreenElement) { exitKioskMode(); }
    });
    $(document).on('click', '#dashEditBtn', function () { setEditMode(true); });
    $(document).on('click', '#dashDoneBtn', function () {
        if (dirty && !confirm('You have unsaved changes. Leave edit mode anyway? (They stay until you reload.)')) { return; }
        setEditMode(false);
    });
    $(document).on('click', '#dashRefreshBtn', function () {
        renderDash(true);
        scheduleAutoRefresh();   // manual refresh restarts the interval AND the countdown bar
    });
    $(document).on('click', '#dashSaveBtn', saveDashboard);
    $(document).on('click', '#dashSettingsBtn', openSettings);
    $(document).on('click', '#dashAddTileBtn', function () { openTileEditor(null, true); });

    $(document).on('click', '.dash-tt-btn', function () {
        // Resolve the tile by ID at click time (not the baked data-idx):
        // surgical inserts/removals don't renumber the other tiles' buttons,
        // so a stored index can go stale - the id never does.
        var $tileEl = $(this).closest('.dash-tile');
        var idx = tileIndexById($tileEl.attr('data-tile-id'));
        var act = $(this).data('act');
        if (idx === -1 || !DASH.tiles[idx]) { return; }
        if (act === 'remove') {
            if (!confirm('Remove this tile?')) { return; }
            var gone = DASH.tiles[idx];
            if (chartInstances[gone.id]) { try { chartInstances[gone.id].destroy(); } catch (e) {} delete chartInstances[gone.id]; }
            sweepTileObserver(gone.id);
            delete _tileLastRefresh[gone.id];
            DASH.tiles.splice(idx, 1);
            $tileEl.remove();
            if (!DASH.tiles.length) { renderDash(); }   // back to the empty-state card
        } else if (act === 'left' && idx > 0) {
            var a = DASH.tiles[idx - 1]; DASH.tiles[idx - 1] = DASH.tiles[idx]; DASH.tiles[idx] = a;
            // Moving a node reloads ITS iframe (unavoidable - the browser
            // reloads relocated frames); the neighbor and everyone else stay.
            $tileEl.insertBefore($tileEl.prev('.dash-tile'));
        } else if (act === 'right' && idx < DASH.tiles.length - 1) {
            var b = DASH.tiles[idx + 1]; DASH.tiles[idx + 1] = DASH.tiles[idx]; DASH.tiles[idx] = b;
            $tileEl.insertAfter($tileEl.next('.dash-tile'));
        } else if (act === 'edit') {
            openTileEditor(DASH.tiles[idx], false); return;
        } else if (act === 'dupe') {
            var copy = JSON.parse(JSON.stringify(DASH.tiles[idx]));
            copy.id = uid();
            DASH.tiles.splice(idx + 1, 0, copy);
            insertTileNode(copy.id, $tileEl);
        } else { return; }
        dirty = true;
    });

    // =========================================================================
    // Boot
    // =========================================================================
    $(function () {
        // A ?kiosk=1 address opens kiosk view directly (2026-10-01): the
        // chrome-free view at once, and the browser's full screen on the first
        // click or key press (a fresh document can never BE fullscreen - a
        // user gesture is required; a wall display whose browser is already
        // full screen needs nothing more). The home and not-found paths still
        // downgrade: there is nothing to show, and KIOSK=true there used to
        // empty the action bar and leave kiosk=1 in the URL.
        var kioskLink = KIOSK;
        if (kioskLink && !(V.shortId && V.found)) {
            KIOSK = false;
            try {
                history.replaceState(null, '', V.shortId ? dashPageUrl(V.shortId, false) : 'dashboard.php');
            } catch (e) { }
        }
        if (!V.shortId) { renderHome(); return; }
        if (!V.found) {
            renderHead();
            $('#dashMain').html('<div class="dash-tile-err">No dashboard named &ldquo;' + escapeHtml(V.shortId) + '&rdquo; exists' +
                (V.canCreate ? ' &mdash; <a href="dashboard.php">create it from the dashboards home</a>.' : '.') + '</div>');
            return;
        }
        applyDefaultFilter();   // a clean address = the dashboard's own default filter (2026-09-30)
        renderDash();
        if (kioskLink) { enterKioskMode(true); armKioskGestureFullscreen(); }   // its own scheduleAutoRefresh, with the kiosk interval
        else { scheduleAutoRefresh(); }
        mountDashFilter();
        renderDashSearchNote();
        document.addEventListener('visibilitychange', function () {
            // Coming back to a visible tab: catch up any tile whose effective
            // interval elapsed while hidden. Per-tile, same rules as the
            // ticker (Never/-1 and Off/0 resolve to eff < 30 = untouched).
            if (document.hidden || editMode) { return; }
            var now = Date.now();
            for (var i = 0; i < DASH.tiles.length; i++) {
                var t = DASH.tiles[i];
                var eff = tileEffRefresh(t);
                if (eff < 30) { continue; }
                if (now - (_tileLastRefresh[t.id] || 0) <= eff * 1000) { continue; }
                var $tile = $('#dashMain .dash-tile[data-tile-id="' + t.id + '"]');
                if ($tile.length) { refreshTile($tile, t); }
            }
        });
    });
})();
