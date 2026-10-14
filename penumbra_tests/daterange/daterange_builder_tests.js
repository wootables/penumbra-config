/*
 * daterange_builder_tests.js - [PROMPT;type=date-range] in the TAG GENERATOR.
 *
 * WHY THIS HALF EXISTS. The first build of the date-range prompt (2026-09-21) was
 * tested end to end in three engines and not at all in the builder, where it had
 * only had its `type === 'date'` tests widened. The owner found the rest by hand
 * the same evening: no way to enter the two dates of a default, nothing saying
 * the date limits fence both ends or what a Data Source means for a date, a regex
 * box that cannot apply, a :val-only template hint - and a Test button that
 * failed. None of it could have been caught, because nothing drove the builder.
 *
 * This drives it. The page boots the REAL js/main.js (run.ps1 unwraps its ready
 * closure and exports a few closure names as window.__PG), and the Tag Generator's
 * markup is LIFTED from the index.php under test - so a change to either file is
 * a change to what runs here. Every step is a real DOM event on a real control:
 * a Type change, typing, a menu pick, the Test and Generate buttons, the dialog's
 * own OK.
 */
(function () {
    var out = [];
    var pass = 0, fail = 0;
    function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    function check(label, got, want) {
        if (show(got) === show(want)) { pass++; out.push('  ok   ' + label); }
        else { fail++; out.push('  FAIL ' + label + '\n         got:  ' + show(got) + '\n         want: ' + show(want)); }
    }
    function checkContains(label, hay, needle) {
        if (typeof hay === 'string' && hay.indexOf(needle) >= 0) { pass++; out.push('  ok   ' + label); }
        else { fail++; out.push('  FAIL ' + label + '\n         got:  ' + show(hay) + '\n         want it to contain: ' + show(needle)); }
    }
    function section(t) {
        out.push('\n=== ' + t + ' ===');
        document.getElementById('out').textContent = out.join('\n') + '\nSTALLED in: ' + t;
    }
    function finish() {
        var pe = (window.__errors || []).concat(window.__rejections || []);
        if (pe.length) out.push('\npage errors during the run (informational): ' + pe.slice(0, 6).join(' | '));
        out.push('\nPASS: ' + pass + '   FAIL: ' + fail);
        out.push('RESULT: ' + (fail === 0 ? 'GREEN' : 'RED'));
        document.getElementById('out').textContent = out.join('\n') + '\nDONE';
    }
    function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
    function lit(m) { return m.format('DD-MMM-YY').toUpperCase(); }

    var PG = window.__PG || {};
    var vis = function (sel) { var e = $(sel).get(0); return !!e && $(e).css('display') !== 'none' && $(e).parents().filter(function () { return $(this).css('display') === 'none'; }).length === 0; };
    // The label's own words, without its checkbox or help icon.
    var labelText = function (sel) { return $(sel).contents().filter(function () { return this.nodeType === 3; }).text().replace(/\s+/g, ' ').trim(); };
    var preview = async function () { await tick(200); return $('#builderLivePreviewCode').text(); };    // the preview is debounced 120 ms
    var setType = function (t) { $('#promptType').val(t).trigger('change'); };
    var type = function (sel, text) { $(sel).val(text).trigger('input'); };
    var testOutput = function () { return $('#promptTestOutput').text().replace(/\s+/g, ' ').trim(); };
    // Opens the builder the way a person does: the editor's tag icon. With a tag
    // SELECTED in the editor that is "edit this prompt" (the form is loaded from it
    // and the button becomes Overwrite Prompt); with nothing selected it is a new
    // prompt on a reset form. Opening it is also what wires the live preview -
    // main.js binds that lazily, on first open - and a successful Generate CLOSES
    // it, so the tests re-open it exactly where a person would have to.
    var openBuilder = async function (selectTag) {
        var cm = PG.getEditor();
        if (selectTag) { cm.setValue(selectTag); cm.setSelection({ line: 0, ch: 0 }, { line: 0, ch: selectTag.length }); }
        else { cm.setCursor({ line: 0, ch: 0 }); }
        $('#promptGeneratorIcon').trigger('click');
        await tick(80);
    };
    // Click Test, then OK in the dialog it opens; returns what the builder printed.
    var runTest = async function (beforeOk) {
        $('#promptTestOutput').empty();
        $('#testPromptBtn').trigger('click');
        await tick(250);
        var $dlg = $('.modal-prompt-overlay').last();
        if (!$dlg.length) return 'NO DIALOG OPENED: ' + testOutput();
        if (beforeOk) beforeOk($dlg);
        $dlg.find('.modal-btn-primary').trigger('click');
        await tick(250);
        return testOutput();
    };

    (async function () {
        try {
            section('0. the page booted the real builder');
            await openBuilder();
            check('the tag icon opens the builder', vis('#promptGeneratorLightbox'), true);
            check('main.js exported its hooks', [typeof PG.parsePrompt, typeof PG.prefill, typeof PG.populateParents, typeof PG.getEditor], ['function', 'function', 'function', 'function']);
            check('the Type menu offers Date Range', $('#promptType option[value="date-range"]').length, 1);
            check('the quick-range menu holds the dialog\'s 12 ranges (+ "custom")', $('#promptRangeQuick option').length, 13);

            // =================================================================
            section('1. choosing Date Range reshapes the form');
            setType('text');
            check('CONTROL before: one Value box, no From / To editor', [vis('#promptDefault'), vis('#promptRangeDefault')], [true, false]);
            setType('date-range');
            check('the single Value box gives way to a From / To editor', [vis('#promptDefault'), vis('#promptRangeFrom'), vis('#promptRangeTo'), vis('#promptRangeQuick')], [false, true, true, true]);
            check('Force stays where it was', vis('#promptForceDefault'), true);
            check('Date Constraints are offered, and SAY they fence both ends', [vis('#promptMinDate'), vis('#promptMaxDate'), vis('#promptDateRangeLimitsNote')], [true, true, true]);
            $('#promptAdvancedDetails').prop('open', true);
            check('the regex box is gone (a regex cannot describe two dates); the Error Message stays', [vis('#promptValidate'), vis('#promptVErrorMessage')], [false, true]);
            checkContains('the SQL Template hint shows the two placeholders', $('#promptTemplate').attr('placeholder'), ':from');
            checkContains('...and the :val short form', $('#promptTemplate').attr('placeholder'), 'BETWEEN :val');
            check('No Quote is unavailable, as for every non-select type', $('#promptNoQuote').prop('disabled'), true);

            // =================================================================
            section('2. the Data Source says what it does for a DATE');
            check('it is a lookup, not "autofill"', labelText('label[for="promptAutofill"]'), 'Look up the earliest and latest date');
            check('the help icon survived the relabel', $('label[for="promptAutofill"] .bld-help-icon').length, 1);
            $('#promptAutofill').prop('checked', true).trigger('change');
            check('ONE column to name: Date Column; the Value Column is not offered', [labelText('label[for="promptAutofillColumn"]'), vis('#promptAutofillValueColumn')], ['Date Column', false]);
            checkContains('a range: min / max + All dates, and NOT a limit on what can be picked', $('#promptAutofillDateNote').text(), 'It does not limit which dates can be picked');
            setType('date');
            check('a single date gets the same honest wording...', [labelText('label[for="promptAutofill"]'), labelText('label[for="promptAutofillColumn"]'), vis('#promptAutofillValueColumn')], ['Look up the earliest and latest date', 'Date Column', false]);
            checkContains('...with ITS consequence: the calendar IS limited to the span', $('#promptAutofillDateNote').text(), 'the calendar is limited to that span');
            setType('select');
            check('CONTROL: a dropdown keeps the option-list wording and both columns', [labelText('label[for="promptAutofill"]'), labelText('label[for="promptAutofillColumn"]'), vis('#promptAutofillValueColumn'), vis('#promptAutofillDateNote')], ['Autofill from database', 'Display Column', true, false]);
            $('#promptAutofill').prop('checked', false).trigger('change');

            // =================================================================
            section('3. entering the two dates of a default');
            $('#resetPromptFormBtn').trigger('click');
            await tick(60);
            setType('date-range');
            type('#promptMessage', 'Award date');
            type('#promptName', 'award');
            check('nothing typed: no default, and the note says that is allowed', [$('#promptDefault').val(), $('#promptRangeDefaultNote').text()], ['', 'Leave both empty for no default: the dialog then opens with nothing chosen.']);
            type('#promptRangeFrom', 'first day of last month');
            check('ONE half is not a default, and the note says so', [$('#promptDefault').val(), $('#promptRangeDefaultNote').text()], ['first day of last month..', 'A default needs both a From and a To.']);
            type('#promptRangeTo', 'last day of last month');
            check('the two fields write ONE value: from..to', $('#promptDefault').val(), 'first day of last month..last day of last month');
            check('...the quick-range menu recognises what was typed', $('#promptRangeQuick option:selected').text(), 'Last month');
            var lm = moment().subtract(1, 'month');
            check('...and the note shows what it means today, and that it keeps rolling', $('#promptRangeDefaultNote').text(),
                'Today this is ' + lit(lm.clone().startOf('month')) + ' to ' + lit(lm.clone().endOf('month')) + '. It is saved as written, so it is worked out again every time the report runs.');
            check('the live preview carries it', await preview(), '[PROMPT;type=date-range;message=Award date;name=award;default=first day of last month..last day of last month]');

            $('#promptRangeQuick').val('first day of this fiscal year..TODAY').trigger('change');
            check('picking a quick range fills BOTH fields with its expressions', [$('#promptRangeFrom').val(), $('#promptRangeTo').val(), $('#promptDefault').val()],
                ['first day of this fiscal year', 'TODAY', 'first day of this fiscal year..TODAY']);
            type('#promptRangeFrom', '01-JUL-25'); type('#promptRangeTo', '30-JUN-26');
            check('literal dates: the menu falls back to (custom) and the note has nothing to add', [$('#promptRangeQuick').val(), $('#promptRangeDefaultNote').text()], ['', '']);
            type('#promptRangeTo', '01-JAN-25');
            check('a backwards default is called out while it is typed', $('#promptRangeDefaultNote').text(), 'The From date must be on or before the To date.');

            // =================================================================
            section('4. Generate refuses a default that is not a range; accepts one that is');
            var ed = PG.getEditor();
            ed.setValue('');
            $('#generatePromptBtn').trigger('click');
            await tick(60);
            checkContains('backwards: refused, in words', testOutput(), 'Date Range default: The From date must be on or before the To date.');
            check('...and NOTHING was inserted', ed.getValue(), '');
            type('#promptRangeTo', '');
            $('#generatePromptBtn').trigger('click');
            await tick(60);
            checkContains('one half: refused', testOutput(), 'Date Range default: A date range needs both a From and a To date.');
            check('...and nothing was inserted', ed.getValue(), '');
            type('#promptRangeFrom', 'first day of last month'); type('#promptRangeTo', 'last day of last month');
            $('#promptForceDefault').prop('checked', true).trigger('change');
            $('#generatePromptBtn').trigger('click');
            await tick(60);
            var TAG = '[PROMPT;type=date-range;message=Award date;name=award;forcedefault=first day of last month..last day of last month]';
            check('a good one is inserted exactly as previewed, and the builder closes', [ed.getValue(), vis('#promptGeneratorLightbox')], [TAG, false]);

            // =================================================================
            section('5. editing an existing tag: it loads back into the two fields and saves unchanged');
            await openBuilder(TAG);          // select the tag in the editor, click the tag icon
            check('the builder opens in Overwrite mode on that tag', [vis('#promptGeneratorLightbox'), $('#generatePromptBtn').text()], [true, 'Overwrite Prompt']);
            check('Type, both halves, the menu and Force all come back',
                [$('#promptType').val(), $('#promptRangeFrom').val(), $('#promptRangeTo').val(), $('#promptRangeQuick option:selected').text(), $('#promptForceDefault').prop('checked')],
                ['date-range', 'first day of last month', 'last day of last month', 'Last month', true]);
            check('...in the From / To editor, not the single Value box', [vis('#promptRangeFrom'), vis('#promptDefault')], [true, false]);
            // The frozen-default bug of 2026-08-31 was exactly this round trip, for a single
            // date: the builder showed the RESOLVED default and "Overwrite" froze the window.
            check('ROUND TRIP: what would be saved is the tag that was loaded, byte for byte (a rolling range stays rolling)', await preview(), TAG);
            $('#generatePromptBtn').trigger('click');
            await tick(60);
            check('...and Overwrite Prompt leaves the editor byte-identical', ed.getValue(), TAG);

            await openBuilder();
            check('a NEW prompt starts on a reset form, the range editor put away', [$('#promptType').val(), vis('#promptRangeDefault'), $('#promptRangeFrom').val(), $('#promptRangeTo').val()], ['text', false, '', '']);
            PG.prefill(PG.parsePrompt('[PROMPT;type=date-range;name=award;default=01-JUL-25..30-JUN-26;validate=min_date(2025-01-01),max_date(2026-12-31);template="AND d BETWEEN :val"]'));
            await tick(60);
            check('limits and template load too', [$('#promptRangeFrom').val(), $('#promptRangeTo').val(), $('#promptMinDate').val(), $('#promptMaxDate').val(), $('#promptTemplate').val()],
                ['01-JUL-25', '30-JUN-26', '01-JAN-25', '31-DEC-26', 'AND d BETWEEN :val']);
            check('...and go back out in the tag', await preview(), '[PROMPT;type=date-range;name=award;default=01-JUL-25..30-JUN-26;validate=min_date(2025-01-01),max_date(2026-12-31);template="AND d BETWEEN :val"]');

            // =================================================================
            section('6. the Test button');
            PG.prefill(PG.parsePrompt(TAG));          // a FORCED rolling default - the case that failed
            await tick(60);
            var forcedBefore = PG.forcedKeys().length;
            var storeBefore = localStorage.length;
            var got = await runTest();
            // Before the fix this printed "Error: PROMPT_REQUIRED:Award date".
            check('FORCED default: Test shows the SQL for the range in the dialog',
                got, "Success, SQL generates as: '" + lit(lm.clone().startOf('month')) + "' AND '" + lit(lm.clone().endOf('month')) + "'");
            check('...and leaves the session as it found it (no forced key kept, no test answer left in storage)', [PG.forcedKeys().length, localStorage.length], [forcedBefore, storeBefore]);
            got = await runTest(function ($dlg) {
                $dlg.find('[id$="_input"]').val('01-JUL-25').trigger('input');
                $dlg.find('[id$="_input2"]').val('30-JUN-26').trigger('input');
            });
            check('...and for an answer CHANGED in the dialog, that answer', got, "Success, SQL generates as: '01-JUL-25' AND '30-JUN-26'");
            type('#promptTemplate', 'AND a.award_date >= :from AND a.award_date <= :to');
            got = await runTest();
            check('with a template: both placeholders filled', got, "Success, SQL generates as: AND a.award_date >= '" + lit(lm.clone().startOf('month')) + "' AND a.award_date <= '" + lit(lm.clone().endOf('month')) + "'");

            // The flaw was never the date range's: with a forced default the Test button
            // ignored the tester's answer for EVERY type. The old types bound NULL and the
            // button called that success.
            $('#resetPromptFormBtn').trigger('click');
            await tick(60);
            setType('date');
            type('#promptName', 'start'); type('#promptMessage', 'Start');
            type('#promptDefault', 'TODAY-30');
            $('#promptForceDefault').prop('checked', true).trigger('change');
            got = await runTest();
            check('a forced SINGLE date now tests as its date (this used to print "NULL" and call it success)', got, "Success, SQL generates as: '" + lit(moment().subtract(30, 'days')) + "'");
            $('#promptForceDefault').prop('checked', false).trigger('change');
            got = await runTest();
            check('CONTROL: an unforced single date tests exactly as before', got, "Success, SQL generates as: '" + lit(moment().subtract(30, 'days')) + "'");

            // =================================================================
            section('7. switching Type away and back loses nothing');
            $('#resetPromptFormBtn').trigger('click');
            await tick(60);
            setType('date-range');
            type('#promptRangeFrom', 'TODAY-30'); type('#promptRangeTo', 'TODAY');
            setType('text');
            check('the single Value box comes back holding the pair; the editor and its note are put away', [vis('#promptDefault'), $('#promptDefault').val(), vis('#promptRangeDefault'), vis('#promptDateRangeLimitsNote')], [true, 'TODAY-30..TODAY', false, false]);
            $('#promptAdvancedDetails').prop('open', true);
            check('the regex box and the :val template hint are back', [vis('#promptValidate'), $('#promptTemplate').attr('placeholder')], [true, 'e.g. AND PI_NAME = :val']);
            setType('date-range');
            check('...and back again: the pair is split into the fields', [$('#promptRangeFrom').val(), $('#promptRangeTo').val(), $('#promptRangeQuick option:selected').text()], ['TODAY-30', 'TODAY', 'Last 30 days']);
            $('#promptDefault').val('TODAY-7');
            setType('date'); setType('date-range');
            check('a value typed for a SINGLE date lands in From instead of vanishing', [$('#promptRangeFrom').val(), $('#promptRangeTo').val()], ['TODAY-7', '']);

            // =================================================================
            section('8. a range can be a decision-tree CHILD, never a PARENT');
            ed.setValue("SELECT 1 FROM t WHERE 1=1 [PROMPT;type=select;name=mode;message=Mode;template=\"\";options=A,B]\n AND d BETWEEN [PROMPT;type=date-range;name=period;message=Period;resultif=mode:A]");
            PG.populateParents();
            var parents = $('#promptResultIfName option').map(function () { return $(this).val(); }).get().filter(Boolean);
            check('the Parent Prompt list offers the dropdown, and leaves the range out', parents, ['mode']);
            PG.prefill(PG.parsePrompt('[PROMPT;type=date-range;name=period;message=Period;resultif=mode:A]'));
            await tick(60);
            check('...while the range itself keeps its own parent when edited', await preview(), '[PROMPT;type=date-range;message=Period;name=period;resultif=mode:A]');
            ed.setValue('');

            if (window.__control) {
                section('CONTROL (must FAIL)');
                check('CONTROL: the builder has no From field (deliberately false)', $('#promptRangeFrom').length, 0);
            }
        } catch (e) {
            fail++;
            out.push('  FAIL (exception) ' + (e && e.stack ? e.stack : e));
        }
        finish();
    })();
})();
