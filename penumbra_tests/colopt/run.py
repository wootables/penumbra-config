# =============================================================================
# COLOPT SUITE (2026-10-12) - column options: formats, filter links, deep links
# per column (Settings panel chip + js/penumbra_colfmt.js popover), the pivot cog's
# Format, calculated-column date formats, formula-text escaping.
# colopt b (2026-10-12): the summary in the popover, the cog in the summary lane, the
# badges at the row's end (fsum + fpanel/gfmt/fsave/fclear/fnomod checks, NEW_B).
# colopt d (2026-10-12): the popover as a two-column form + no title tooltips while it
# is open (fform).
# colopt e (2026-10-12): the popover a size up (fform popRoomy), and the Settings
# panel's Theme / Density / Columns each on one row (fprows) - the harness now lifts
# the WHOLE panel from the index.php under test (mk_harness._panel).
# colopt f (2026-10-13): the Save dialog's report-wide Deep Link Vendor Codes default
# is gone (frepdeep: a report saved with it off opens linked, a save no longer writes
# it; furldeep: &deeplink=0 still turns a view's links off; S-* read the files' text).
# NEW = NEW_F.
# colopt c (2026-10-12): Freeze in the popover (ffreeze), the ? icons alike + hover
# tips (ftips) - the harness lifts its Settings / status bar bits from the index.php
# under test. NEW = the checks the change under test brought (now NEW_C).
# --control runs LIVE: every NEW check red there, every other one green.
#   page half   harness.html (mk_harness.py, from calccol's) + driver.js: the REAL
#               main.js + module + calc module                 L-<scn>-<check>, E-<scn>
#   php half    test_colopt.php: the date formatter + calc engine twins
#               (penumbra_calc.php) on the browser's own answers; the pivot's
#               aggFormat through generate_pivot_html (a side-effect-free mirror of
#               schedule_runner.php, pivotparity/extract_mirror.php) - its values
#               against the page's, text for text; and fixed cases       P-*
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_co_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = ['fbuild', 'fsort', 'fpanel', 'fsum', 'ffilter', 'fdeep', 'frepdeep', 'furldeep', 'fcalc', 'fxss', 'fsave', 'fclear', 'gfmt', 'fheat', 'pvfmt', 'pvfmt2', 'pvtie', 'pvcog', 'fnomod', 'ffreeze', 'ftips', 'fform', 'fprows', 'fparity']
def q(s): return urllib.parse.quote(s, safe='')
SCN_Q = {
    'fcalc': '&calc=' + q('DUE|{V_DATE} + 30|date:MMM D, YYYY') + '&calc=' + q('TWICE|{H_NUM} * 2'),
    'fxss': '&calc=' + q('X|"<img src=x onerror=window.__pwned=1>"|text') + '&calc=' + q('Q|IF({H_ENT} = "O\'Brien", "yes", "no")|text'),
    'fnomod': '&nomod=1',
    'furldeep': '&deeplink=0',
}
CHK = {
    'fbuild': ['amtShown', 'noOrigHtml', 'dateShown', 'filterClass', 'plainUntouched', 'linksKept', 'lazyFormatted', 'footerFmt', 'readersRaw'],
    'fsort': ['shownAsPattern', 'sortedByDate'],
    'fpanel': ['cogsAll', 'noShadeChip', 'noOldChips', 'restCog', 'cogWidth', 'popDateKind', 'chipOpen', 'pickDate', 'badgeReads', 'customPattern', 'badPatternKept',
               'resetClears', 'escapeCloses', 'popNumKind', 'shadeViaPopover', 'barBadge', 'outsideCloses', 'popLinkKind', 'vcDefault', 'vcOff'],
    'fsum': ['defaultOutlined', 'footerLabel', 'popHasSummary', 'popLeftAligned', 'avgFooter', 'avgSaved', 'avgBadgeOwn', 'notPending', 'sameAsDefaultNotOwn',
             'noneStored', 'fxWaits', 'fxInvalidKept', 'fxApplied', 'fxEnterInvalid', 'resetSum', 'textColList', 'uniqFooter', 'dropsLook', 'applyKeeps',
             'shadeOutside', 'laneSort', 'badgesOpen', 'nonDataOnlySummary'],
    'ffilter': ['classOn', 'looksLikeLink', 'copyPlainColor', 'clickFilters', 'rowsFiltered', 'otherColInert', 'enterFilters', 'valueNotDisplay', 'nestedSubFilter'],
    'fdeep': ['linkDefaultOn', 'offStripped', 'offSaved', 'otherColKeeps', 'nestedLinked', 'kinds', 'nestedOff', 'backOn'],
    'frepdeep': ['linkedDespite', 'popDefaultOn', 'savedNoKey'],
    'furldeep': ['urlOff', 'popOff'],
    'fcalc': ['shown', 'notSummable', 'kept', 'dialogFmt', 'dialogPreview', 'dialogCustom'],
    'fxss': ['noElement', 'shownAsText', 'quoteEquals'],
    'fsave': ['keepsBoth', 'keepsSummary'],
    'fclear': ['listed', 'listsSummary', 'cleared'],
    'gfmt': ['cellsFmt', 'footFmt', 'changeInPlace', 'footChanged', 'groupSumAvg', 'groupSumNone', 'filterInGroups', 'groupClick'],
    'fheat': ['barsFromValues', 'shownNoDollar'],
    'pvfmt': ['amtCurrency0', 'countStaysCount', 'meanPercent'],
    'pvfmt2': ['amtNumber2', 'countAsIs', 'meanAuto0'],
    'pvtie': ['ran'],
    'pvcog': ['cogDialog', 'popPivot', 'kbdFocus', 'fmtSet', 'shadeSet', 'autoDp', 'resetBoth'],
    'fnomod': ['oldChip', 'oldSumChip', 'rawCells', 'setNoop', 'oldFreeze'],
    'ffreeze': ['selectHidden', 'sectionFirstFive', 'checkFreezes', 'badges', 'inherited', 'moveDown', 'untickOff', 'reportDefault', 'offOwn',
                'resetBack', 'followsList', 'chipCount', 'chipOpens'],
    'ftips': ['iconsAlike', 'tipsPanel', 'tipPopover', 'noTitles'],
    'fform': ['formRows', 'titleWraps', 'sumLabel', 'oneLineEach', 'popRoomy', 'noTipsOpen', 'textCol', 'filterOwnRow', 'badgeWords', 'pivotForm'],
    'fprows': ['oneRowEach', 'labelsCol', 'rightEdge', 'labelsOneLine', 'hintUnder', 'emptyHintNoRoom', 'notesPlaced', 'pivotAbove',
               'disabledUnder', 'freezeUnder', 'listFills', 'collapsedRow'],
    'fparity': ['units', 'specs', 'kinds', 'decText', 'ran'],
    # (2026-10-15, WCAG) the sort lanes' names + state; the Theme / Density hint links by keyboard
    'fspa11y': ['sortNameVisible', 'sortStates', 'otherLanesNot', 'themeHintBtn', 'themeEnter', 'themeFocusMoves', 'themeSpaceClears',
                'densityHintBtn', 'densityEnter', 'densityFocusMoves', 'densitySpaceClears'],
}
SCN.append('fspa11y')
N = '\r\n'   # main.js, schedule_runner.php and main.css are CRLF; the module and both calc files LF
MUTANTS = {
    # --- the cell writer and the readers of a cell's VALUE (main.js)
    'm-rawattr': ([('main', "        if (val !== null) td.setAttribute('data-pnb-raw', val);", "        if (false) td.setAttribute('data-pnb-raw', val);")],
                  ['L-fbuild-amtShown', 'L-fsort-sortedByDate', 'L-ffilter-valueNotDisplay'], ['fbuild', 'fsort', 'ffilter']),
    'm-sortraw': ([('main', "                        text = cell ? _pnbCellValText(cell).trim() : '';", "                        text = cell ? cell.textContent.trim() : '';")],
                  ['L-fsort-sortedByDate'], ['fsort']),
    'm-filterraw': ([('main', "        const value = _pnbCellValText(td).trim();", "        const value = (td.textContent || '').trim();")], ['L-ffilter-valueNotDisplay'], ['ffilter']),
    'm-filterclass': ([('main', "        if (!document.body.classList.contains('pnb-click-filter') && !this.classList.contains('pnb-cflt'))" + N + "            return;",
                        "        if (!document.body.classList.contains('pnb-click-filter'))" + N + "            return;")],
                      ['L-ffilter-clickFilters', 'L-gfmt-groupClick'], ['ffilter', 'gfmt']),
    'm-enter': ([('main', "        e.preventDefault();" + N + "        _pnbCellFilter(colName, value);", "        e.preventDefault();")], ['L-ffilter-enterFilters'], ['ffilter']),
    'm-cfltclass': ([('main', "        if (ro && ro.filter) td.classList.add('pnb-cflt');" + N, "")], ['L-fbuild-filterClass', 'L-ffilter-classOn'], ['fbuild', 'ffilter']),
    'm-rulesraw': ([('main', "        if (cellNode.hasAttribute && cellNode.hasAttribute('data-pnb-raw')) return cellNode.getAttribute('data-pnb-raw').trim();" + N, "")],
                   ['L-fbuild-readersRaw'], ['fbuild']),
    'm-lazyro': ([('main', "                _pnbFillLazyCell(td, map ? map.get(nameById[cid]) : undefined," + N + "                    roById[cid] || (roById[cid] = _pnbColRenderOpts(nameById[cid])));",
                   "                _pnbFillLazyCell(td, map ? map.get(nameById[cid]) : undefined);")], ['L-fbuild-lazyFormatted'], ['fbuild']),
    # --- deep links per column
    'm-deepcol': ([('main', "        let contentStr = String(value);" + N + "        if (deep === undefined) deep = resolverLinksEnabled;",
                    "        let contentStr = String(value);" + N + "        deep = resolverLinksEnabled;")], ['L-fdeep-offStripped', 'L-fdeep-nestedOff'], ['fdeep']),
    'm-deepnest': ([('main', "                        } else if (deep && resolverRegex.test(cellStr)) {", "                        } else if (resolverLinksEnabled && resolverRegex.test(cellStr)) {")],
                   ['L-fdeep-nestedOff'], ['fdeep']),
    # --- totals, saving, clearing
    'm-footcol': ([('main', "                    col: th.getAttribute('data-colname')   // the viewer's format (colopt)" + N, "")], ['L-fbuild-footerFmt'], ['fbuild']),
    'm-groupfeet': ([('main', "        else try { updateTotalRow(); _pnbRefreshGroupedFooters(col); }", "        else try { updateTotalRow(); }")], ['L-gfmt-footChanged'], ['gfmt']),
    'm-savecarry': ([('main', "                if (!Object.prototype.hasOwnProperty.call(savedData, k)) savedData[k] = existing[k];", "")], ['L-fsave-keepsBoth'], ['fsave']),
    'm-clearlist': ([('main', "                    items.push('Column options: formats and links (' + plural(Object.keys(cp.colopt).length, 'column') + ')');" + N, "")],
                    ['L-fclear-listed'], ['fclear']),
    # --- the panel, the popover, the rollback
    'm-cog': ([('main', "        var cogSt = (!isFixed && _pnbColOptOn()) ? _pnbColState(colName || displayName) : null;", "        var cogSt = null;")],
              ['L-fpanel-cogsAll', 'L-fpanel-noOldChips'], ['fpanel']),
    'm-escopen': ([('main', "        _all('.sp-col-opts.is-open').removeClass('is-open').attr('aria-expanded', 'false');" + N, "")], ['L-fpanel-escapeCloses'], ['fpanel']),
    'm-shadevia': ([('main', "        if (key === 'shade') { penumbraSetShade(col, value || ''); _pnbColOptChipRefresh(col); return; }", "")], ['L-fpanel-shadeViaPopover'], ['fpanel']),
    'm-modoff': ([('main', "    function _pnbColOptOn() { return !!(window.PenumbraColFmt && typeof window.PenumbraColFmt.openPopover === 'function'); }",
                   "    function _pnbColOptOn() { return true; }")], ['L-fnomod-oldChip'], ['fnomod']),
    'c-link': ([('css', "    text-decoration: underline dotted;" + N + "    text-underline-offset: 2px;" + N, "")], ['L-ffilter-looksLikeLink'], ['ffilter']),
    'm-copycolor': ([('main', "            if (srcEl.closest && srcEl.closest('td.pnb-cflt') && !srcEl.style.color && srcEl.parentNode && srcEl.parentNode.nodeType === 1)",
                      "            if (false)")], ['L-ffilter-copyPlainColor'], ['ffilter']),
    # --- the format engine (module)
    'j-kinds': ([('mod', "            else if (parseDate(s)) dates++;\n", "")], ['L-fpanel-popDateKind', 'L-fparity-kinds'], ['fpanel', 'fparity']),
    'j-ampm': ([('mod', "            if (ap === 'A' && H === 12) H = 0;", "            if (false) H = 0;")], ['L-fparity-units', 'P-C-dates'], ['fparity']),
    'j-tie': ([('mod', "        var up = f.charAt(dp) >= '5';\n", "        var up = f.charAt(dp) > '5';\n")], ['L-fparity-units'], ['fparity']),
    # --- calculated columns (both engines)
    'm-calcdate': ([('main', "        var fmt = o.fmt || _pnbCalcDateFmt(col);", "        var fmt = o.fmt;")], ['L-fcalc-shown'], ['fcalc']),
    'j-calcesc': ([('calc', "            case 'str': return escLit(node.v);", "            case 'str': return node.v;")],
                  ['L-fxss-noElement', 'L-fxss-shownAsText', 'L-fxss-quoteEquals', 'P-C-calc'], ['fxss', 'fparity']),
    'j-calcsum': ([('calc', "            if (x.def.format !== 'text' && !isDateFormat(x.def.format)) summableNames[x.def.name] = true;",
                    "            if (x.def.format !== 'text') summableNames[x.def.name] = true;")], ['L-fcalc-notSummable'], ['fcalc']),
    'p-calcesc': ([('cphp', "        case 'str': return _pnb_calc_esc_lit($node['v']);", "        case 'str': return $node['v'];")],
                  ['P-C-escape', 'P-C-quoteEquals', 'P-C-calc'], ['fparity']),
    'p-weekday': ([('cphp', "    $wd = ((_pnb_calc_days_from_civil($dt['y'], $dt['m'], $dt['d']) % 7) + 11) % 7;", "    $wd = ((_pnb_calc_days_from_civil($dt['y'], $dt['m'], $dt['d']) % 7) + 10) % 7;")],
                  ['P-C-dates', 'P-C-dateResult'], ['fparity']),
    # --- the pivot's Format (both engines) and the cog
    'j-pvcur': ([('main', "                if (_fo.t === 'currency') _isCur = true;", "                if (false) _isCur = true;")], ['L-pvfmt-amtCurrency0', 'P-V-pvfmt-sameValues'], ['pvfmt']),
    'j-pvtie': ([('main', "            if (_fo && !_countLike && _fo.t === 'percent') return `${_pnbDecText(numVal, _fdp !== null ? _fdp : 1, true)}%`;",
                  "            if (_fo && !_countLike && _fo.t === 'percent') return `${_pivotFormatNumber(numVal * 100, _fdp !== null ? _fdp : 1, _fdp !== null ? _fdp : 1)}%`;")],
                ['P-V-pvtie-sameValues'], ['pvtie']),
    # (no j-pvdec: Intl on the plain value reads its shortest decimal text and rounds half
    # away, exactly as _pnbDecText does - an EQUIVALENT mutant. The parts that differ are the
    # float x 100 (j-pvtie) and PHP's number_format pre-rounding (p-pvtie).)
    'p-pvcur': ([('sr', "        if ($_fo['t'] === 'currency') $_isCur = true;", "        if (false) $_isCur = true;")], ['P-V-pvfmt-sameValues', 'P-F-currency-count-percent'], ['pvfmt']),
    'p-pvtie': ([('sr', "return pivot_dec_text($numVal, $_fdp !== null ? $_fdp : 1, true) . '%';", "return number_format($numVal * 100, 1) . '%';")],
                ['P-V-pvfmt-sameValues'], ['pvfmt']),
    'p-pvset': ([('sr', "    $GLOBALS['__pnb_pivot_agg_fmt'] = $out;", "    $GLOBALS['__pnb_pivot_agg_fmt'] = array();")],
                ['P-V-pvfmt-sameValues', 'P-V-pvfmt2-sameValues', 'P-F-number2-auto0'], ['pvfmt', 'pvfmt2']),
    'j-pvgetter': ([('main', "        return any ? out : null;" + N + "    }" + N + "    // A pivot format string, clean, or ''", "        return null;" + N + "    }" + N + "    // A pivot format string, clean, or ''")],
                   ['L-pvcog-fmtSet'], ['pvcog']),
    'j-pvcog': ([('main', "        if (_pnbColOptOn()) {" + N + "            td.setAttribute('aria-expanded', 'true');", "        if (false) {" + N + "            td.setAttribute('aria-expanded', 'true');")],
                ['L-pvcog-popPivot'], ['pvcog']),
    # --- (colopt b) the summary in the popover, the cog, the badges
    'm-sumlook': ([('main', "        delete transientColumnSummaries[name];" + N, "")], ['L-fsum-dropsLook'], ['fsum']),
    'm-sumdiff': ([('main', "        if (chosen !== inherited) sums[name] = chosen; else delete sums[name];", "        sums[name] = chosen;")],
                  ['L-fsum-sameAsDefaultNotOwn'], ['fsum']),
    'm-sumpersist': ([('main', "        persistColumnSummaries(sums, fxs);" + N, "")], ['L-fsum-avgSaved', 'L-fsave-keepsSummary'], ['fsum', 'fsave']),
    'm-sumrefresh': ([('main', "        _pnbSumWrite(name, type || '', formula);" + N + "        _pnbSumRefresh();" + N, "        _pnbSumWrite(name, type || '', formula);" + N)],
                     ['L-fsum-avgFooter', 'L-gfmt-groupSumAvg'], ['fsum', 'gfmt']),
    'm-groupsum': ([('main', "            } else penumbraRefreshSummaryFooters();" + N + "            penumbraRefreshDrillFooters();", "            } else updateTotalRow();" + N + "            penumbraRefreshDrillFooters();")],
                   ['L-gfmt-groupSumAvg', 'L-gfmt-groupSumNone'], ['gfmt']),
    'm-applykeep': ([('main', "        if (co) { summaryOverrides = userColumnSummaries; formulaOverrides = userColumnSummaryFormulas; }" + N, "")],
                    ['L-fsum-applyKeeps'], ['fsum']),
    'm-accent': ([('main', "        return { bits: bits, own: sOwn || bits.some(function (b) { return b.own; }),", "        return { bits: bits, own: bits.length > 0,")],
                 ['L-fsum-defaultOutlined', 'L-fpanel-vcDefault'], ['fsum', 'fpanel']),
    'm-nosum': ([('main', "            if (idef) bits.push({ t: 'NO ' + idef.badge,", "            if (false) bits.push({ t: 'NO ' + idef.badge,")], ['L-fsum-noneStored'], ['fsum']),
    # the default VC badge's own (bounded) scan - the panel builds its rows before any popover
    # has asked _pnbColKinds about the column
    'm-vcscan': ([('main', "            else if (raw.indexOf('resolver-link') !== -1) hit = true;   // a vendor code the server linked",
                   "            else if (false) hit = true;")], ['L-fpanel-vcDefault'], ['fpanel']),
    'm-badgeown': ([('main', "'<span class=\"sp-col-badge' + (b.own ? ' is-own' : '') + (b.ico ? ' is-ico' : '')", "'<span class=\"sp-col-badge' + (b.ico ? ' is-ico' : '')")],
                   ['L-fsum-avgBadgeOwn', 'L-fpanel-badgeReads', 'L-fpanel-barBadge'], ['fsum', 'fpanel']),
    'm-badgerefresh': ([('main', "                b.innerHTML = _pnbColBadgesInner(s);" + N, "")], ['L-fsum-avgBadgeOwn', 'L-fpanel-badgeReads'], ['fsum', 'fpanel']),
    'm-rank': ([('main', "        return cog.classList.contains('is-custom') ? 2 : (itemEl.querySelector('.sp-col-badge') ? 1 : 0);",
                 "        return cog.classList.contains('is-custom') ? 1 : (itemEl.querySelector('.sp-col-badge') ? 1 : 0);")], ['L-fsum-laneSort'], ['fsum']),
    'm-resetsum': ([('main', "        if (sumOwn) _pnbSumWrite(col, null);" + N, "")], ['L-fsum-resetSum'], ['fsum']),
    'm-indicator': ([('main', "        var any = $('#spColumnList .sp-col-item').find('.sp-col-sumtype, .sp-col-cog').filter(function () {",
                      "        var any = $('#spColumnList .sp-col-item').find('.sp-col-sumtype').filter(function () {")], ['L-fsum-footerLabel'], ['fsum']),
    'm-footlabel': ([('main', "               (on ? 'Hide footer badges' : 'Show footer badges') + '</button>' +", "               (on ? 'Hide badges' : 'Show badges') + '</button>' +")],
                    ['L-fsum-footerLabel'], ['fsum']),
    'm-sumpop': ([('main', "            summary: _pnbSumPopCfg(col),", "            summary: null,")], ['L-fsum-popHasSummary'], ['fsum']),
    'm-nondata': ([('main', "        var isData = !!(masterRowData && masterRowData.length && masterRowData[0].has(col));" + N, "        var isData = true;" + N)],
                  ['L-fsum-nonDataOnlySummary'], ['fsum']),
    'm-badgeclick': ([('main', "        if (cog) $(cog).trigger('click');" + N, "")], ['L-fsum-badgesOpen'], ['fsum']),
    'm-shaderefresh': ([('main', "        // ...and the column's cog and badges (colopt), whoever set it" + N + "        _pnbColOptChipRefresh(col);" + N, "")],
                       ['L-fsum-shadeOutside'], ['fsum']),
    'c-lane': ([('css', "    --sp-sum-lane: 24px;" + N, "")], ['L-fpanel-cogWidth'], ['fpanel']),
    'j-fxcheck': ([('mod', "            if (!err) { applySum('formula', expr); syncSumUi(''); return true; }", "            if (true) { applySum('formula', expr); syncSumUi(''); return true; }")],
                  ['L-fsum-fxInvalidKept'], ['fsum']),
    'j-align': ([('mod', "Math.min(cfg.align === 'start' ? r.left : r.right - mw, win.innerWidth - mw - 8)", "Math.min(r.right - mw, win.innerWidth - mw - 8)")],
                ['L-fsum-popLeftAligned'], ['fsum']),
    # --- (colopt c) Freeze in the popover
    'm-frzbit': ([('main', "        if (!f) return null;" + N + "        if (f.pos <= f.n) {", "        if (!f) return null;" + N + "        if (false) {")],
                 ['L-ffreeze-badges'], ['ffreeze']),
    'm-frzown': ([('main', "        return !!f && f.user && ((f.n > 0 && f.pos === f.n) || (f.n === 0 && f.report > 0 && f.pos === f.report));", "        return false;")],
                 ['L-ffreeze-badges', 'L-ffreeze-offOwn'], ['ffreeze']),
    'm-frzinh': ([('main', "        if (f.pos < f.n) return { checked: true, disabled: true, own: false,", "        if (f.pos < f.n) return { checked: true, disabled: false, own: false,")],
                 ['L-ffreeze-inherited'], ['ffreeze']),
    'm-frzpos': ([('main', "        if (on) penumbraSetFrozenCols(f.pos);", "        if (on) penumbraSetFrozenCols(f.pos - 1);")], ['L-ffreeze-checkFreezes'], ['ffreeze']),
    'm-frzoff': ([('main', "        else if (f.pos <= f.n) penumbraSetFrozenCols(0);" + N, "")], ['L-ffreeze-untickOff'], ['ffreeze']),
    'm-frzsync': ([('main', "        // ...and the rows' snowflake badges and cogs (colopt, 2026-10-12 c), which" + N +
                    "        // follow the same rows" + N + "        _pnbFreezeSync();" + N, "")], ['L-ffreeze-followsList', 'L-ffreeze-badges'], ['ffreeze']),
    'm-frzsel': ([('main', "        $wrap.toggle(!restricted && $('#tableHeader th').length > 0 && !_pnbColOptOn());", "        $wrap.toggle(!restricted && $('#tableHeader th').length > 0);")],
                 ['L-ffreeze-selectHidden'], ['ffreeze']),
    'm-frzreset': ([('main', "        if (_pnbFreezeOwn(_pnbFreezeState(col))) penumbraSetFrozenCols(reportFrozenCols);" + N, "")], ['L-ffreeze-resetBack'], ['ffreeze']),
    'm-frzfive': ([('main', "        if (!p || p > PENUMBRA_FROZEN_COLS_MAX) return null;", "        if (!p) return null;")], ['L-ffreeze-sectionFirstFive'], ['ffreeze']),
    'm-frzchip': ([('main', "            if (typeof penumbraOpenFreezeOptions === 'function' &&", "            if (false &&")], ['L-ffreeze-chipOpens'], ['ffreeze']),
    'j-frzui': ([('mod', "            cb.disabled = !!s.disabled;", "            cb.disabled = false;")], ['L-ffreeze-inherited'], ['ffreeze']),
    'j-frzreset': ([('mod', "            syncFreezeUi();" + "\n" + "            syncReset();" + "\n" + "            var first = q('select, input:not([disabled])');",
                     "            syncReset();" + "\n" + "            var first = q('select, input:not([disabled])');")], ['L-ffreeze-resetBack'], ['ffreeze']),
    # --- (colopt c) the ? icons: alike, and hover tips
    'c-helpalike': ([('css', "#settingsPanel .sp-help-icon," + N + ".sp-sumtype-menu.pnb-colopt .sp-help-icon {" + N + "    color: var(--text-muted, #777);",
                      ".pnb-none-x {" + N + "    color: var(--text-muted, #777);")], ['L-ftips-iconsAlike'], ['ftips']),
    'c-ring': ([('css', "    border-color: var(--text-muted, #8b949e);   /* --border-color is all but invisible on a dark surface */" + N, "")],
               ['L-ftips-iconsAlike'], ['ftips']),
    'c-tipz': ([('css', "    z-index: 300002;" + N, "    z-index: 30000;" + N)], ['L-ftips-tipPopover'], ['ftips']),
    'm-tiphover': ([('main', "        const _iconHoverSel = '.bld-help-icon, .tab-help-icon[data-tip], .sp-help-icon[data-tip]';",
                     "        const _iconHoverSel = '.bld-help-icon, .tab-help-icon[data-tip]';")], ['L-ftips-tipsPanel'], ['ftips']),
    'm-tiplazy': ([('main', "        var first = !_helpPopoverInited;" + N + "        initHelpPopover();", "        var first = false;")], ['L-ftips-tipsPanel'], ['ftips']),
    'i-tipkey': ([('index', 'data-tip="us-tip-settings" aria-label="Help: your settings"', 'title="Help" aria-label="Help: your settings"')],
                 ['L-ftips-tipsPanel', 'L-ftips-noTitles'], ['ftips']),
    'h-tipstore': ([('help', '<div data-tip="us-tip-colopts">', '<div data-tip="us-tip-colopts-x">')], ['L-ftips-tipPopover'], ['ftips']),
    'j-tipattr': ([('mod', "(cfg.help.tip ? ' data-tip=\"' + esc(cfg.help.tip) + '\"' : ' title=\"What these options do\"')", "' title=\"What these options do\"'")],
                  ['L-ftips-tipPopover', 'L-ftips-noTitles'], ['ftips']),
    # --- (colopt d) the two-column form, no title tooltips while open
    'c-formgrid': ([('css', "    grid-template-columns: 76px minmax(0, 1fr);   /* 62px until 2026-10-12 e (10px labels) */" + N, "")], ['L-fform-formRows'], ['fform']),
    'c-formlbl': ([('css', ".pnb-colopt-sec > .pnb-colopt-lbl { grid-column: 1; grid-row: 1; line-height: 1.2; }" + N, "")], ['L-fform-formRows'], ['fform']),
    'c-formwidth': ([('css', "    width: 396px;", "    width: 284px;")], ['L-fform-oneLineEach', 'L-fform-popRoomy'], ['fform']),
    'c-tipshide': ([('css', "body.pnb-colopt-open .ui-tooltip { display: none !important; }", "")], ['L-fform-noTipsOpen'], ['fform']),
    'j-tipsclass': ([('mod', "        doc.body.classList.add('pnb-colopt-open');", "")], ['L-fform-noTipsOpen'], ['fform']),
    'm-tipsclear': ([('main', "        _all('body').removeClass('pnb-colopt-open');" + N, "")], ['L-fform-noTipsOpen'], ['fform']),
    'j-shadefs': ([('mod', "            html += '<div class=\"pnb-colopt-sec\" data-sec=\"shade\" role=\"radiogroup\" aria-labelledby=\"' + id + 'sl\">' +\n"
                           "                '<div class=\"pnb-colopt-lbl\" id=\"' + id + 'sl\">Shading</div><div class=\"pnb-colopt-radios\">' +",
                    "            html += '<fieldset class=\"pnb-colopt-sec\" data-sec=\"shade\"><legend class=\"pnb-colopt-lbl\">Shading</legend><div class=\"pnb-colopt-radios\">' +")],
                  ['L-fform-formRows'], ['fform']),
    'j-sumsub': ([('mod', "Summary<span class=\"pnb-colopt-sub\">footer row</span></div>", "Summary</div>")], ['L-fform-sumLabel'], ['fform']),
    'c-titlewrap': ([('css', ".pnb-colopt-title { white-space: normal; overflow-wrap: anywhere; }" + N, "")], ['L-fform-titleWraps'], ['fform']),
    # --- (colopt e) the popover a size up; the Settings panel's Theme / Density / Columns rows
    'c-poppad': ([('css', "    padding: 14px 16px;" + N + "    color: var(--text-main, #222);" + N + "    font-size: 13px;",
                   "    padding: 8px 10px;" + N + "    color: var(--text-main, #222);" + N + "    font-size: 13px;")], ['L-fform-popRoomy'], ['fform']),
    'c-popfont': ([('css', "    font-size: 13px;" + N + "    line-height: 1.45;", "    font-size: 12px;" + N + "    line-height: 1.45;")], ['L-fform-popRoomy'], ['fform']),
    'c-poplbl': ([('css', "    font-size: 11px;   /* 10px until 2026-10-12 e: the Settings panel's own labels' size */", "    font-size: 10px;")], ['L-fform-popRoomy'], ['fform']),
    'c-prowgrid': ([('css', "#settingsPanel .sp-density-section {" + N + "    display: grid;" + N, "#settingsPanel .sp-density-section {" + N)],
                   ['L-fprows-oneRowEach', 'L-fprows-labelsCol'], ['fprows']),
    'c-pright': ([('css', "    align-items: center;" + N + "    padding: 0 32px 0 0;" + N, "    align-items: center;" + N)], ['L-fprows-rightEdge'], ['fprows']),
    'c-ptoggles': ([('css', "#settingsPanel .sp-toggles { padding-right: 32px; }" + N, "")], ['L-fprows-rightEdge'], ['fprows']),
    'c-phint': ([('css', "#settingsPanel .sp-density-section > .sp-default-hint { grid-column: 2; grid-row: 2; margin: 0; }",
                  "#settingsPanel .sp-density-section > .sp-default-hint { margin: 0; }")], ['L-fprows-hintUnder'], ['fprows']),
    'c-phintempty': ([('css', "#settingsPanel .sp-default-hint:empty { display: none; }" + N, "")], ['L-fprows-emptyHintNoRoom'], ['fprows']),
    'c-pcolsgrid': ([('css', "#settingsPanel .sp-columns-section {" + N + "    display: grid;" + N, "#settingsPanel .sp-columns-section {" + N)],
                    ['L-fprows-oneRowEach'], ['fprows']),
    'c-pcontents': ([('css', "#settingsPanel .sp-columns-section > .sp-columns-head { display: contents; }" + N, "")], ['L-fprows-oneRowEach'], ['fprows']),
    'c-plblcol': ([('css', "#settingsPanel .sp-columns-head > .sp-section-label { grid-column: 1; grid-row: 2; align-self: center; margin: 0 0 6px; }" + N, "")],
                  ['L-fprows-oneRowEach'], ['fprows']),
    'c-psearch': ([('css', "#settingsPanel .sp-columns-section > .sp-column-search-row { grid-column: 2; grid-row: 2; align-self: center; }" + N, "")],
                  ['L-fprows-oneRowEach'], ['fprows']),
    'c-prowbtn': ([('css', "#settingsPanel .sp-column-search-row .sp-rowbtn { margin: 0; }" + N, "")], ['L-fprows-oneRowEach'], ['fprows']),
    'c-pnotes': ([('css', "#settingsPanel .sp-columns-section > .sp-freeze-hint { grid-row: 4; }" + N, "")], ['L-fprows-notesPlaced'], ['fprows']),
    'c-pcolw': ([('css', "#settingsPanel .sp-columns-section > .sp-colw-note { grid-row: 5; }" + N, "")], ['L-fprows-notesPlaced'], ['fprows']),
    'c-padmin': ([('css', "#settingsPanel .sp-columns-section > .sp-admin-note { grid-row: 6; }" + N, "")], ['L-fprows-notesPlaced'], ['fprows']),
    'c-pdisabled': ([('css', "#settingsPanel .sp-columns-section > .sp-columns-disabled-msg { grid-row: 7; }" + N, "")], ['L-fprows-disabledUnder'], ['fprows']),
    'c-pfreeze': ([('css', "#settingsPanel .sp-columns-head > .sp-freeze { grid-column: 2; grid-row: 3; justify-self: end; margin: 0 32px 6px 0; }" + N, "")],
                  ['L-fprows-freezeUnder'], ['fprows']),
    'c-pcalc': ([('css', "#settingsPanel .sp-columns-section > .pnb-calc-sec { grid-row: 9; }" + N, "")], ['L-fprows-listFills'], ['fprows']),
    'c-plistrow': ([('css', "    grid-template-rows: repeat(7, auto) minmax(0, 1fr) auto;" + N, "    grid-template-rows: repeat(9, auto);" + N)],
                   ['L-fprows-listFills'], ['fprows']),
    # --- (colopt f) the Save dialog's report-wide Deep Link default is gone
    'm-bsokey': ([('main', "            rowExpandDefault: isRowExpandActive," + N,
                   "            rowExpandDefault: isRowExpandActive," + N + "            resolverLinksDefault: resolverLinksEnabled," + N)],
                 ['L-frepdeep-savedNoKey'], ['frepdeep']),
    'm-savekey': ([('main', "        stateObject.rowExpandDefault = $('#serverSaveRowHeight').is(':checked');" + N,
                    "        stateObject.rowExpandDefault = $('#serverSaveRowHeight').is(':checked');" + N + "        stateObject.resolverLinksDefault = true;" + N)],
                  ['L-frepdeep-savedNoKey'], ['frepdeep']),
    'm-readdflt': ([('main', "                            // read since 2026-10-13: deep links are set per column.)" + N + "                            resolverLinksEnabled = loadResolverPref();" + N,
                     "                            // read since 2026-10-13: deep links are set per column.)" + N
                     + "                            resolverLinksEnabled = decodedState.resolverLinksDefault === false ? false : loadResolverPref();" + N)],
                   ['L-frepdeep-linkedDespite'], ['frepdeep']),
    'm-deepdflt': ([('main', "    function _pnbDeepDefault() { return true; }", "    function _pnbDeepDefault() { return false; }")], ['L-frepdeep-popDefaultOn'], ['frepdeep']),
    'm-urlpref': ([('main', "        if (_penumbraUrlOverrides.deeplink !== null) return _penumbraUrlOverrides.deeplink;" + N, "")], ['L-furldeep-urlOff'], ['furldeep']),
    'i-cellback': ([('index', "                        <!-- (Deep Link Vendor Codes was a cell here until 2026-10-13: it is",
                     "                        <input type=\"checkbox\" id=\"serverSaveResolver\">\n                        <!-- (Deep Link Vendor Codes was a cell here until 2026-10-13: it is")],
                   ['S-noSaveDeepCell'], []),
    'h-lastdeep': ([('help', "Defaults: Row Height, Page Size &amp; Sort</h4>", "Defaults: Row Height, Deep Links, Page Size &amp; Sort</h4>")], ['S-helpNoDeepDefault'], []),
    # --- (colopt g) Filter its own row, "Click a table cell to filter by that value"
    'j-filterrow': ([('mod', "data-sec=\"filter\"><div class=\"pnb-colopt-lbl\">Filter</div>", "data-sec=\"links\"><div class=\"pnb-colopt-lbl\">Links</div>")],
                    ['L-fform-filterOwnRow', 'L-fform-formRows'], ['fform']),
    'j-filtertext': ([('mod', "> Click a table cell to filter by that value</label>", "> Click a value to filter the table</label>")], ['L-fform-filterOwnRow'], ['fform']),
    'm-badgewords': ([('main', "w: 'Click a table cell to filter by that value' }", "w: 'Click a value to filter' }")], ['L-fform-badgeWords'], ['fform']),
    'h-tipfilter': ([('help', "<li><strong>Filter</strong> - click a table cell to filter by that value.</li>", "<li><strong>Filter</strong> - click a value to filter.</li>")],
                    ['S-helpFilterRow'], []),
    # --- (2026-10-15, WCAG) the sort lanes' names + state; the hint links by keyboard
    'm-lanename': ([('main', "        var a11yName = label ? (label + ', ' + tip.charAt(0).toLowerCase() + tip.slice(1)) : tip;",
                     "        var a11yName = tip;")], ['L-fspa11y-sortNameVisible'], ['fspa11y']),
    'm-lanestate': ([('main', "                $h.attr('aria-label', a11yName + (owns ? (spSortDir === 1 ? ', sorted ascending' : ', sorted descending') : ', not sorted'));",
                      "                /* mutant: the name never follows the sort */")], ['L-fspa11y-sortStates', 'L-fspa11y-otherLanesNot'], ['fspa11y']),
    'm-hintkey': ([('main', "    $(document).on('keydown', '.sp-hint-link[role=\"button\"]', function (e) {",
                    "    $(document).on('keydown', '.sp-hint-link-mutant', function (e) {")],
                  ['L-fspa11y-themeEnter', 'L-fspa11y-themeFocusMoves', 'L-fspa11y-densityEnter', 'L-fspa11y-densityFocusMoves'], ['fspa11y']),
    'm-hintfocus': ([('main', "        refocus();" + N + "        setTimeout(refocus, 60);" + N + "        setTimeout(refocus, 400);",
                      "        /* mutant: focus left on the removed node */")],
                    ['L-fspa11y-themeFocusMoves', 'L-fspa11y-densityFocusMoves'], ['fspa11y']),
    'm-hintrole': ([('main', 'id="spDensityMakeGlobal" role="button" tabindex="0"', 'id="spDensityMakeGlobal"')],
                   ['L-fspa11y-densityHintBtn', 'L-fspa11y-densityEnter'], ['fspa11y']),
}
# (colopt f) checks on the files' text, beside the browser's
def static_checks(texts):
    idx, hlp = texts['index'], texts['help']
    return [
        ('S-noSaveDeepCell', 'serverSaveResolver' not in idx, 'index.php: serverSaveResolver x%d' % idx.count('serverSaveResolver')),
        ('S-helpNoDeepDefault', 'Defaults: Row Height, Deep Links' not in hlp and "can set the report's default under <em>Last Stop Changes</em>" not in hlp
         and 'Deep Link Vendor Codes</strong> - when on, recognized vendor codes' not in hlp, ''),
        # (colopt g) the help names the option as the popover does, in a Filter row of its own
        ('S-helpFilterRow', '<li><strong>Filter</strong> - click a table cell to filter by that value.</li>' in hlp   # (2026-10-19) the tip store; the topic's <em> wording no longer read here
         and 'Click a value to filter the table' not in hlp
         and 'click a value to filter; vendor code links' not in hlp, ''),
    ]
# the checks colopt b brought (live since 16:22) - kept for the record
NEW_B = {'L-fpanel-' + c for c in ('cogsAll', 'noOldChips', 'restCog', 'cogWidth', 'badgeReads', 'barBadge', 'vcDefault', 'vcOff')} | \
        {'L-fsum-' + c for c in CHK['fsum']} | {'E-fsum', 'L-gfmt-groupSumAvg', 'L-gfmt-groupSumNone', 'L-fsave-keepsSummary', 'L-fclear-listsSummary'}
# the checks colopt c brings: RED on live, the control's proof that they see it
# (their E- checks are not: both scenarios run on live without a page error - fsum died there)
NEW_C = {'L-ffreeze-' + c for c in CHK['ffreeze']} | {'L-ftips-' + c for c in CHK['ftips']}
# the checks colopt d brings (the two-column form, no title tooltips while open)
# (oneLineEach is not: the stacked form never wrapped either - it guards the narrower grid, c-formwidth)
NEW_D = {'L-fform-' + c for c in CHK['fform'] if c not in ('oneLineEach', 'popRoomy')}
# the checks colopt e brings: the popover a size up, and the Settings panel's one-row
# settings. Not new (true of the stacked panel as well - guards for the grid, each with
# its mutant): labelsOneLine, hintUnder, pivotAbove, disabledUnder, listFills.
NEW_E = {'L-fform-popRoomy'} | {'L-fprows-' + c for c in CHK['fprows']
                                if c not in ('labelsOneLine', 'hintUnder', 'pivotAbove', 'disabledUnder', 'listFills')}
# the checks colopt f brings: no report-wide Deep Link default (furldeep is a guard: &deeplink=
# worked before as well)
NEW_F = {'L-frepdeep-' + c for c in CHK['frepdeep']} | {'S-noSaveDeepCell', 'S-helpNoDeepDefault'}
# the checks colopt g brings: Filter a row of its own, the new words (formRows / textCol
# now name the filter row, so they are red on live too)
NEW_G = {'L-fform-filterOwnRow', 'L-fform-badgeWords', 'L-fform-formRows', 'L-fform-textCol', 'S-helpFilterRow'}
# the checks the 2026-10-15 WCAG fixes bring (the sort lanes' names, the hint links' keys):
# every one red on live
NEW_H = {'L-fspa11y-' + c for c in CHK['fspa11y']}
NEW = NEW_H

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
check_anchors = flag('--check-anchors')
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'sr': 'schedule_runner.php', 'cphp': 'penumbra_calc.php', 'css': os.path.join('css', 'main.css'),
        # (colopt c) the harness lifts its Settings / status bar bits from this index.php,
        # and serves this help_content.php - raw, as a static file - for the hover tips
        'index': 'index.php', 'help': os.path.join('help', 'tips', 'settings-tips-storage.php')}
sys.path.insert(0, HERE)
import mk_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = {'fillByName': 'penumbraFillLazyColumnsByName', 'kinds': '_pnbColKinds', 'saveCols': 'saveColumnPrefs', 'clearItems': '_spClearItems',
             'addAgg': 'addAggregationRow', 'fmts': 'getAggregationFormats', 'runSearch': 'runTableSearch', 'decText': '_pnbDecText',
             'cmpText': '_readComparisonCellText', 'sumText': 'penumbraReadCellForSummary', 'exportData': 'getExportData',
             'bso': 'buildStateObject'}
    h = '\r\n;try { window.__HC = {' + ', '.join("%s: (typeof %s === 'function' ? %s : null)" % (k, v, v) for k, v in names.items()) + \
        '}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_co_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))   # (harness.html: write_stage)
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(path):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    # The harness answers help_content.php from window.__HELP_STUB (its jQuery.ajax
    # mock): the candidate's Settings tips behind the marker ensureHelpLoaded() checks.
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    open(os.path.join(stage, 'harness.html'), 'wb').write(mk_harness.build(texts['index']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'help_stub.js'), 'wb').write(help_stub(texts['help']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_colfmt.js'), 'wb').write(texts['mod'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_calc.js'), 'wb').write(texts['calc'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'main.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))

INFO = {}
def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, SCN_Q.get(s, '')))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        INFO[s] = r.get('info') or {}
        out.append(('E-' + s, not r.get('errors') and not r.get('hookErr'), 'errors %s %s' % (r.get('errors'), r.get('hookErr'))))
        chk = r.get('chk') or {}
        # PNB_INFO=1: every check carries the scenario's info, passing ones too (and uncut)
        full = bool(os.environ.get('PNB_INFO'))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:None if full else 500]) if (v is not True or full) else '')))
    return out

def php_lines(res, prefix):
    out = []
    for line in res.stdout.splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)', line)
        if m: out.append((prefix + m.group(2), m.group(1) == 'PASS', m.group(3)))
    if 'TOTAL' not in res.stdout: out.append((prefix + 'ran', False, (res.stdout + res.stderr)[-500:]))
    return out

def run_php(texts):
    d = tempfile.mkdtemp(prefix='pnb_cop_')
    try:
        out = []
        srp = os.path.join(d, 'sr.php'); cp = os.path.join(d, 'penumbra_calc.php'); mir = os.path.join(d, 'mirror.php'); fx = os.path.join(d, 'fx.json')
        open(srp, 'wb').write(texts['sr'].encode('utf-8', 'surrogateescape'))
        open(cp, 'wb').write(texts['cphp'].encode('utf-8', 'surrogateescape'))
        for tag, p in (('sr', srp), ('calc', cp)):
            l = subprocess.run([PHP, '-n', '-l', p], capture_output=True, text=True).stdout
            out.append(('P-lint-' + tag, 'No syntax errors' in l, l.strip()[:200]))
        open(fx, 'w', encoding='utf-8').write(json.dumps({'parity': INFO.get('fparity'), 'pvfmt': INFO.get('pvfmt'), 'pvfmt2': INFO.get('pvfmt2'), 'pvtie': INFO.get('pvtie')}))
        res = subprocess.run([PHP, '-n', '-d', 'extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext', '-d', 'extension=mbstring',
                              '-d', 'date.timezone=America/New_York', os.path.join(HERE, 'test_colopt.php'), 'calc', cp, fx], capture_output=True, text=True)
        out += php_lines(res, 'P-')
        subprocess.run([PHP, '-n', os.path.join(HERE, '..', 'pivotparity', 'extract_mirror.php'), srp, mir], capture_output=True, text=True)
        res = subprocess.run([PHP, '-n', '-d', 'memory_limit=512M', os.path.join(HERE, 'test_colopt.php'), 'pivot', mir, os.path.join(APP, 'themes_config.php'), fx],
                             capture_output=True, text=True)
        out += php_lines(res, 'P-')
        return out
    finally:
        shutil.rmtree(d, ignore_errors=True)

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if check_anchors:
        badA = 0
        for m, (edits, must, scns) in MUTANTS.items():
            for f, old, new in edits:
                n = texts[f].count(old)
                if n != 1: badA += 1; print('  ANCHOR x%d  %-14s %s: %r' % (n, m, f, old[:100]))
        print('ANCHORS: %d mutants, %d bad' % (len(MUTANTS), badA))
        print('RESULT: GREEN' if badA == 0 else 'RESULT: RED')
    elif all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            INFO.clear()
            res = (run_browser(scns) if scns else [])
            res += run_php(t) if [x for x in must if x.startswith('P-')] else []
            res += static_checks(t) if [x for x in must if x.startswith('S-')] else []
            red = [a for a, p, _ in res if not p]
            # a scenario that died (F-<scn>) made none of its checks: each of them counts as red
            dead = [a[2:] for a in red if a.startswith('F-')]
            good = not [x for x in must if x not in red and not [d for d in dead if x.startswith('L-' + d + '-')]]
            okc += good; bad += (not good)
            print('  %s  mutant %-16s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None or [x for x in SCN if x in ('fparity', 'pvfmt', 'pvfmt2', 'pvtie')]: res += run_php(texts)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-34s %s' % ('PASS' if passed else 'FAIL', a, dd if os.environ.get('PNB_INFO') else dd[:500]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            # the control is LIVE, before the change under test (colopt c; b is live since 16:22):
            # every check this change brought (NEW) must be red there - a scenario that
            # dies there (F-<scn>) made none of its checks - and every other check green,
            # as it describes what live already does
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]} | {'E-' + s for s in dead}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]} | {'E-' + s for s in dead}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            # a scenario made of new checks only (fsum) may die on live; any other may not
            new_scn = {s for s in CHK if all(('L-%s-%s' % (s, c)) in NEW for c in CHK[s])}
            old_red = sorted(a for a in red if a not in NEW and not (a.startswith('F-') and a[2:] in new_scn))
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
