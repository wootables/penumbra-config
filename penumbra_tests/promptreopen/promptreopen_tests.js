/*
 * promptreopen_tests.js - RE-OPENING an answered prompt (2026-09-24).
 *
 * Drives the SHIPPED code: window.__src holds js/main.js as text (baked by
 * run.ps1); the functions under test are cut out of it by name and compiled
 * together with real jQuery / jQuery UI / moment on the page.
 *
 * What it pins:
 *   1. showPromptDialog: a select re-opened with a {value, display} prefill
 *      (what the chip, "Review all" and the scheduler form pass whenever an
 *      answer's label differs from its value) must preselect the option whose
 *      VALUE is the answer. It used to compare option values with the LABEL, so
 *      the dialog opened on the first option and OK quietly changed the answer.
 *   2. reconfigureSinglePrompt (clicking an answer chip): OK without touching
 *      anything keeps the answer.
 *   3. reconfigureAllPrompts ("Review all"): a child's resultif is matched with
 *      the same rules as a normal run - "!value" negates, "a|b" is any of them,
 *      "/re/" is a regex. It used to know only the regex and one exact value, so
 *      negated / multi-value children were skipped and their answers deleted.
 */
(function () {
    var out = [];
    var pass = 0, fail = 0;
    function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    function check(label, got, want) {
        if (show(got) === show(want)) { pass++; out.push('  ok   ' + label); }
        else { fail++; out.push('  FAIL ' + label + '\n         got:  ' + show(got) + '\n         want: ' + show(want)); }
    }
    function section(t) {
        out.push('\n=== ' + t + ' ===');
        document.getElementById('out').textContent = out.join('\n') + '\nSTALLED in: ' + t;
    }
    function finish() {
        out.push('\nPASS: ' + pass + '   FAIL: ' + fail);
        out.push('RESULT: ' + (fail === 0 ? 'GREEN' : 'RED'));
        document.getElementById('out').textContent = out.join('\n') + '\nDONE';
    }

    // main.js is CRLF; every anchor below is written with \n.
    var code = String(window.__src || '').replace(/\r\n/g, '\n');
    function grabFn(name) {
        var m = new RegExp('\\n    (?:async )?function ' + name + '\\(').exec(code);
        if (!m) throw new Error('grab: function ' + name + ' not found in main.js');
        var start = m.index + 1;
        var end = code.indexOf('\n    }\n', start);
        if (end < 0) throw new Error('grab: end of ' + name + ' not found');
        return code.substring(start, end + 7);
    }
    function grabLine(re, what) {
        var m = re.exec(code);
        if (!m) throw new Error('grab: ' + what + ' not found in main.js');
        return m[0];
    }

    var env;
    try {
        var names = [
            'escapeHtml', 'decodeHtmlEntities', 'stripWrappingQuotePair',
            'resolveDynamicValues', 'resolveKeywordDate', 'resolveDynamicDate',
            'penumbraIsDateRangeType', 'penumbraSplitDateRange', 'penumbraJoinDateRange', 'penumbraRangeHasKeywordEnd',
            'penumbraParseRangeEnd', 'penumbraFormatRangeEnd', 'penumbraRangeKeywordDate', 'penumbraResolveRangeEnd',
            'penumbraResolveDateRange', 'penumbraApplyDateRangeTemplate', 'penumbraDateRangePresets',
            'penumbraDateRangePresetFor', 'penumbraDateRangeLabel', 'penumbraDateRangeResolvedText', 'penumbraDateRangeRawDefault',
            'parsePrompt', 'parseMultiSelectDefault', 'splitValidateRules', 'validatePromptInput', 'sanitizeCssString',
            'showPromptDialog', '_pnbDateRangeDialogHtml', '_pnbWireDateRangeDialog',
            'generateResetLinkHtml', 'attachResetHandler', 'getPromptStorageKey', 'getPromptAnswerByName',
            'autofillAuthFailed', 'autofillPayloadError', 'resolvePromptDateRange',
            'promptTypeIconPaths', 'promptTypeIconSvg', '_pnbDatepickerBeforeShow',
            'promptStateIconSvg', 'updatePromptDisplay',
            'reconfigureSinglePrompt', 'reconfigureAllPrompts'
        ];
        // section= (2026-09-24): updatePromptDisplay and reconfigureAllPrompts call
        // these from then on; lifted only when the main.js under test has them, so
        // this suite runs against builds from before AND after.
        ['promptSectionKey', 'promptSectionMap'].forEach(function (n) {
            if (new RegExp('\\n    function ' + n + '\\(').test(code)) names.push(n);
        });
        var src = "var PNB_DATE_RANGE_SEP = '..';\n"
            + grabLine(/\n    const _isRangeKeyword = [^\n]+\n/, '_isRangeKeyword')
            + 'var _promptRangeCache = new Map();\n'
            + 'var _forceDefaultApplied = new Set();\n'
            + names.map(grabFn).join('\n')
            + '\nreturn {'
            + names.map(function (n) { return n + ':' + n; }).join(',')
            + ', _forceDefaultApplied: _forceDefaultApplied };';

        var calls = { toasts: [], ajax: [] };
        window.__ajaxAnswer = [];
        $.ajax = function (o) { calls.ajax.push(o); return Promise.resolve(window.__ajaxAnswer); };
        window._pnbModalHost = function () { return $(document.body); };
        env = new Function('getQuery', 'getSnippet', 'currentThemeId', 'penumbra_vars', 'editor', 'renderReportSnippet', 'handleSessionExpiredError',
            'showLoading', 'hideLoading', 'show_text', src)(
            function () { return window.__editorSql || ''; },
            function () { return ''; },
            function () { return 'theme-default'; },
            { shibboleth: {} },
            { getValue: function () { return window.__editorSql || ''; } },
            function () { }, function () { }, function () { }, function () { },
            function (html) { calls.toasts.push(String(html)); });
        env.calls = calls;
    } catch (e) {
        out.push('HARNESS FAILED TO BUILD: ' + e.message);
        fail++;
        finish();
        return;
    }

    function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
    function lastDialog() {
        var $d = $('.modal-prompt-overlay').last();
        if (!$d.length) return null;
        var id = $d.attr('id');
        return { $d: $d, id: id, input: document.getElementById(id + '_input') };
    }
    function selectedValues(sel) { return Array.from(sel.options).filter(function (o) { return o.selected; }).map(function (o) { return o.value; }); }
    function clearAll() { localStorage.clear(); env._forceDefaultApplied.clear(); $('.modal-prompt-overlay').remove(); window.__execClicks = 0; }
    function store(tag, obj) { localStorage.setItem(env.getPromptStorageKey(tag), JSON.stringify(obj)); }
    function stored(tag) { var s = localStorage.getItem(env.getPromptStorageKey(tag)); return s ? JSON.parse(s) : null; }

    // Opens a dialog, reads what it shows, presses OK, returns both.
    async function openAndOk(tag, prefill) {
        var p = env.showPromptDialog(env.parsePrompt(tag), prefill === undefined ? null : prefill);
        await tick(30);
        var d = lastDialog();
        var shown = !d ? null : (d.input.tagName === 'SELECT'
            ? (d.input.multiple ? selectedValues(d.input) : d.input.value)
            : d.input.value);
        if (d) $('#' + d.id + '_ok').trigger('click');
        var res = await p;
        return { shown: shown, result: res };
    }

    // Answers every dialog a flow opens by pressing OK; returns what each showed.
    async function okThrough(promise) {
        var seen = [], done = false;
        promise.then(function () { done = true; }, function () { done = true; });
        for (var guard = 0; guard < 300 && !done; guard++) {
            await tick(20);
            var d = lastDialog();
            if (d && !d.$d.data('seenByTest')) {
                d.$d.data('seenByTest', 1);
                var msg = d.$d.find('.modal-prompt-content span').first().text();
                seen.push(msg + '=' + (d.input ? d.input.value : ''));
                $('#' + d.id + '_ok').trigger('click');
            }
        }
        await promise;
        return seen;
    }

    var COL = '[PROMPT;type=select;name=col;nosave;template="";message=Search by;options=Full name (NAME):NAME,Last name (LAST_NAME):LAST_NAME,Primary OUC (OUC):OUC]';

    (async function () {
        try {
            // =================================================================
            section('1. showPromptDialog: a select re-opened with {value, display}');
            clearAll();
            var r = await openAndOk(COL, { value: 'LAST_NAME', display: 'Last name (LAST_NAME)' });
            check('Label:Value options: the stored VALUE is preselected', r.shown, 'LAST_NAME');
            check('OK without touching returns the same answer', r.result, { value: 'LAST_NAME', display: 'Last name (LAST_NAME)' });

            r = await openAndOk(COL, 'OUC');
            check('a plain-string prefill still selects by value', r.shown, 'OUC');

            r = await openAndOk(COL.replace(';message=', ';default=OUC;message='), null);
            check('no prefill: default= (a VALUE) is preselected', r.shown, 'OUC');
            r = await openAndOk(COL.replace(';message=', ';forcedefault=LAST_NAME;message='), null);
            check('no prefill: forcedefault= (a VALUE) is preselected', r.shown, 'LAST_NAME');

            // Worst case of the old comparison: the LABEL of the answer is another option's VALUE.
            r = await openAndOk('[PROMPT;type=select;name=x;message=Pick;options=A:B,B:C,C:D]', { value: 'C', display: 'B' });
            check('a label that equals ANOTHER option\'s value does not select that option', r.shown, 'C');
            check('... and OK keeps the real answer', r.result, { value: 'C', display: 'B' });

            // label/value autofill (the shape of options built from CONCAT(code, ' - ', descr):code)
            window.__ajaxAnswer = [{ label: 'CHO - CVM House Officers', value: 'CHO' }, { label: 'EFX - EHRA Faculty', value: 'EFX' }, { label: 'ENF - Exempt Professional Staff', value: 'ENF' }];
            r = await openAndOk("[PROMPT;type=select;name=cls;message=Class;autofill=T.CONCAT(CONCAT(C, ' - '), D):C]", { value: 'EFX', display: 'EFX - EHRA Faculty' });
            check('label/value autofill select: the stored VALUE is preselected', r.shown, 'EFX');
            check('... and OK keeps it', r.result, { value: 'EFX', display: 'EFX - EHRA Faculty' });
            window.__ajaxAnswer = [];

            // An answer that is no longer offered falls back to the first option (browser default) - unchanged behaviour.
            r = await openAndOk(COL, { value: 'GONE', display: 'Gone column' });
            check('a value no longer offered falls back to the first option', r.shown, 'NAME');

            // Types the change must NOT touch.
            window.__ajaxAnswer = [];
            r = await openAndOk("[PROMPT;type=text;name=u;message=Unity;autofill=T.CONCAT(CONCAT(U, ' - '), N):U]", { value: 'bplimon', display: 'bplimon - Limon,Bruce' });
            check('text autofill: the box still shows the LABEL', r.shown, 'bplimon - Limon,Bruce');
            check('text autofill: OK still returns the VALUE', r.result, { value: 'bplimon', display: 'bplimon - Limon,Bruce' });
            r = await openAndOk('[PROMPT;type=multi-select;name=m;message=Many;options=A,B,C]', ['A', 'C']);
            check('multi-select prefill (an array of values) is unchanged', r.shown, ['A', 'C']);

            // =================================================================
            section('2. reconfigureSinglePrompt - clicking an answer chip');
            clearAll();
            window.__editorSql = 'SELECT 1 FROM DUAL WHERE 1=1\n' + COL + '\n';
            store(COL, { value: 'LAST_NAME', display: 'Last name (LAST_NAME)', message: 'Search by', nosave: true });
            var chip = env.reconfigureSinglePrompt(env.getPromptStorageKey(COL));
            await tick(30);
            var d2 = lastDialog();
            check('the chip dialog opens on the current answer', d2 ? d2.input.value : null, 'LAST_NAME');
            if (d2) $('#' + d2.id + '_ok').trigger('click');
            await chip;
            var s2 = stored(COL);
            check('after OK the stored answer is unchanged', s2 ? [s2.value, s2.display] : null, ['LAST_NAME', 'Last name (LAST_NAME)']);
            check('the report re-ran once', window.__execClicks, 1);

            // =================================================================
            section('3. reconfigureAllPrompts - "Review all" matches resultif like a normal run');
            clearAll();
            var P2 = '[PROMPT;type=select;name=ppl;resultif=col:!ACTIVE|EMPL_STATUS;forcedefault=Active only;message=People;options=Active only,Everyone;template="AND 1=1"]';
            var P3 = '[PROMPT;type=text;name=a;resultif=col:NAME|LAST_NAME;message=Any of two;template="AND 2=2"]';
            var P4 = '[PROMPT;type=text;name=b;resultif=col:LAST_NAME;message=Exact;template="AND 3=3"]';
            var P5 = '[PROMPT;type=text;name=c;resultif=col:!LAST_NAME;message=Negated miss;template="AND 4=4"]';
            var P6 = '[PROMPT;type=text;name=d;resultif=col:/^LAST/;message=Regex;template="AND 5=5"]';
            window.__editorSql = 'SELECT 1 FROM DUAL WHERE 1=1\n' + [COL, P2, P3, P4, P5, P6].join('\n') + '\n';
            store(COL, { value: 'LAST_NAME', display: 'Last name (LAST_NAME)', message: 'Search by', nosave: true });
            store(P2, { value: 'Everyone', display: 'Everyone', message: 'People' });
            store(P3, { value: 'x', display: 'x', message: 'Any of two' });
            store(P4, { value: 'y', display: 'y', message: 'Exact' });
            store(P5, { value: 'z', display: 'z', message: 'Negated miss' });
            store(P6, { value: 'w', display: 'w', message: 'Regex' });
            var seen = await okThrough(env.reconfigureAllPrompts());
            check('asked, in order, with the stored answers shown', seen,
                ['Search by=LAST_NAME', 'People=Everyone', 'Any of two=x', 'Exact=y', 'Regex=w']);
            check('the negated child (resultif=col:!ACTIVE|...) kept its answer', (stored(P2) || {}).value, 'Everyone');
            check('the multi-value child (resultif=col:NAME|LAST_NAME) kept its answer', (stored(P3) || {}).value, 'x');
            check('the exact child kept its answer', (stored(P4) || {}).value, 'y');
            check('the regex child kept its answer', (stored(P6) || {}).value, 'w');
            check('the child whose condition fails (col:!LAST_NAME) was cleared', stored(P5), null);
            check('the parent answer is unchanged', (stored(COL) || {}).value, 'LAST_NAME');
            check('the report re-ran once', window.__execClicks, 1);

            // An unanswered parent: nothing matches, negated or not (as in processPrompts).
            clearAll();
            window.__editorSql = 'SELECT 1 FROM DUAL WHERE 1=1\n[PROMPT;type=text;name=zz;hidden;forcedefault=q]\n'
                + '[PROMPT;type=text;name=k;resultif=nobody:!X;message=Orphan;template="AND 6=6"]\n'
                + '[PROMPT;type=text;name=k2;default=v;message=Plain;template="AND 7=7"]\n';
            seen = await okThrough(env.reconfigureAllPrompts());
            check('a negated child of a parent that was never asked is not asked', seen, ['Plain=v']);

            if (window.__control) check('CONTROL: deliberate failure', 1, 2);
        } catch (e) {
            fail++;
            out.push('  FAIL threw: ' + (e && e.stack ? e.stack : e));
        }
        finish();
    })();
})();
