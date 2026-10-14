/*
 * promptsection_builder_tests.js - section= in the TAG GENERATOR (2026-09-24).
 *
 * The page boots the REAL js/main.js (run.ps1 unwraps its ready closure and
 * exports a few closure names as window.__PG); the Tag Generator's markup AND
 * its inline <style> block are LIFTED from the index.php under test, and
 * css/main.css is the one under test - so the 50/50 row is measured with the
 * rules that ship. Every step is a real DOM event on a real control: typing,
 * the Parent Prompt menu, the Generate / Overwrite and Test buttons, the
 * dialog's own OK. (Why this half exists: a feature with an authoring surface
 * is not done until it has been authored, tested, saved and re-edited THROUGH
 * that surface - date-range, 2026-09-21.)
 *
 * What it pins:
 *   1. The Section field shares Name's old row 50/50 (same .bld-row, equal
 *      widths, together as wide as the full-width Message field).
 *   2. Typed -> the preview and the generated tag carry `section=` right after
 *      `name=`, trimmed, inner spaces collapsed; a name that would break the tag
 *      is refused by Generate (in words, nothing inserted) and left out of the
 *      preview.
 *   3. Re-opening a tag loads the section back; Overwrite without a change is
 *      byte-identical; a changed section reaches EVERY copy of the tag.
 *   4. Suggestions: the sections the report already uses, first spelling each.
 *   5. With a Decision Tree parent the field stays ENABLED: blank = the
 *      parent's section (the placeholder says so), a name = a section of its
 *      own, written alongside resultif and template; dirsearch's People prompt
 *      (a child with its own section, a negated resultif and a template)
 *      round-trips whole. (The first build disabled the field - 2026-09-24.)
 *   6. Reset empties it; Test works with a section and leaves nothing behind.
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

    var PG = window.__PG || {};
    var vis = function (sel) { var e = $(sel).get(0); return !!e && $(e).css('display') !== 'none' && $(e).parents().filter(function () { return $(this).css('display') === 'none'; }).length === 0; };
    var labelText = function (sel) { return $(sel).contents().filter(function () { return this.nodeType === 3; }).text().replace(/\s+/g, ' ').trim(); };
    var preview = async function () { await tick(200); return $('#builderLivePreviewCode').text(); };    // the preview is debounced 120 ms
    var type = function (sel, text) { $(sel).val(text).trigger('input'); };
    var testOutput = function () { return $('#promptTestOutput').text().replace(/\s+/g, ' ').trim(); };
    var width = function (el) { return el ? el.getBoundingClientRect().width : -1; };
    // Opens the builder the way a person does: the editor's tag icon. With text
    // SELECTED in the editor that is "edit this prompt"; with nothing selected it
    // is a new prompt on a reset form. `sql` (optional) is the whole editor text;
    // the FIRST occurrence of `selectTag` in it is selected.
    var openBuilder = async function (selectTag, sql) {
        var cm = PG.getEditor();
        if (sql !== undefined) cm.setValue(sql);
        if (selectTag) {
            if (sql === undefined) cm.setValue(selectTag);
            var at = cm.getValue().indexOf(selectTag);
            cm.setSelection(cm.posFromIndex(at), cm.posFromIndex(at + selectTag.length));
        } else {
            cm.setCursor(cm.posFromIndex(cm.getValue().length));
        }
        $('#promptGeneratorIcon').trigger('click');
        await tick(80);
    };
    var generate = async function () { $('#generatePromptBtn').trigger('click'); await tick(80); };
    var pickParent = async function (name) { $('#promptResultIfName').val(name).trigger('change'); await tick(20); };

    (async function () {
        try {
            section('0. the page booted the real builder');
            var ed = PG.getEditor();
            ed.setValue('');
            await openBuilder();
            check('the tag icon opens the builder', vis('#promptGeneratorLightbox'), true);
            check('main.js exported its hooks', [typeof PG.parsePrompt, typeof PG.prefill, typeof PG.populateParents, typeof PG.getEditor], ['function', 'function', 'function', 'function']);

            // =================================================================
            section('1. Name and Section share one row, 50/50');
            var $name = $('#promptName'), $sec = $('#promptSection');
            check('a Section field: labelled, with its help icon and a suggestions list',
                [$sec.length, labelText('label[for="promptSection"]'), $('label[for="promptSection"] .bld-help-icon').attr('data-tip'), $sec.attr('list'), $('#' + $sec.attr('list')).prop('tagName')],
                [1, 'Section', 'section', 'promptSectionList', 'DATALIST']);
            var $row = $name.closest('.bld-row');
            check('Name and Section sit in the SAME .bld-row, Name first',
                [$row.length, $sec.closest('.bld-row').is($row), $row.find('input').map(function () { return this.id; }).get()], [1, true, ['promptName', 'promptSection']]);
            var nw = width($name.closest('.bld-field').get(0)), sw = width($sec.closest('.bld-field').get(0));
            check('the two halves are the same width (50/50)', [nw > 50, Math.abs(nw - sw) <= 1], [true, true]);
            var rw = width($row.get(0)), mw = width($('#promptMessage').closest('.bld-field').get(0));
            check('together they fill the space Name had alone (as wide as the Message field below)', Math.abs(rw - mw) <= 1, true);
            check('side by side on one line', Math.abs($name.get(0).getBoundingClientRect().top - $sec.get(0).getBoundingClientRect().top) <= 1, true);
            check('Message still follows on its own line', $('#promptMessage').get(0).getBoundingClientRect().top > $sec.get(0).getBoundingClientRect().bottom, true);

            // =================================================================
            section('2. a new prompt with a section');
            type('#promptMessage', 'From date'); type('#promptName', 'from'); type('#promptSection', 'Dates');
            checkContains('the live preview carries it, right after the name', await preview(), ';name=from;section=Dates');
            type('#promptSection', '  Report   period ');
            checkContains('trimmed, inner spaces collapsed', await preview(), ';name=from;section=Report period');
            // The name is the box's caption now, so any text reads - punctuation too.
            type('#promptSection', 'Who & where (2026)');
            checkContains('a caption with punctuation and digits is written as typed', await preview(), ';name=from;section=Who & where (2026)');
            type('#promptSection', '-');
            checkContains('...and "-" (a box with no caption) too', await preview(), ';name=from;section=-');
            var refused = [];
            for (var bad of ['a;b', 'a]b', 'a[b', 'a=b']) {
                type('#promptSection', bad);
                refused.push((await preview()).indexOf('section=') < 0);
            }
            check('the tag\'s own characters ; ] [ = are left out of the preview', refused, [true, true, true, true]);
            type('#promptSection', 'a;b');
            ed.setValue('');
            await generate();
            checkContains('...and Generate refuses them, in words', testOutput(), 'A section name cannot contain ; [ ] or =.');
            check('...and inserts NOTHING', ed.getValue(), '');
            type('#promptSection', 'Dates');
            await generate();
            var TAG = '[PROMPT;type=text;message=From date;name=from;section=Dates]';
            check('a good one is inserted exactly as previewed, and the builder closes', [ed.getValue(), vis('#promptGeneratorLightbox')], [TAG, false]);

            // =================================================================
            section('3. editing it again');
            await openBuilder(TAG);
            check('re-opened on the tag: Overwrite mode, the section loaded', [$('#generatePromptBtn').text(), $('#promptSection').val(), $('#promptSection').prop('disabled')], ['Overwrite Prompt', 'Dates', false]);
            check('ROUND TRIP: the preview is the tag that was loaded, byte for byte', await preview(), TAG);
            await generate();
            check('...and Overwrite Prompt leaves the editor byte-identical', ed.getValue(), TAG);
            var TWO = 'SELECT 1 FROM A WHERE d = ' + TAG + '\nUNION ALL\nSELECT 1 FROM B WHERE d = ' + TAG;
            await openBuilder(TAG, TWO);
            type('#promptSection', 'Filters');
            await generate();
            var TAG2 = TAG.replace('section=Dates', 'section=Filters');
            check('a changed section reaches EVERY copy of the tag', ed.getValue(), TWO.split(TAG).join(TAG2));
            await openBuilder(TAG2, TAG2);
            type('#promptSection', '');
            await generate();
            check('clearing the field takes section= out of the tag', ed.getValue(), '[PROMPT;type=text;message=From date;name=from]');

            // =================================================================
            section('4. suggestions: the sections the report already uses');
            ed.setValue('SELECT 1 FROM t WHERE a = [PROMPT;type=text;name=a;section=Dates]\n AND b = [PROMPT;type=text;name=b;section=filters]\n AND c = [PROMPT;type=text;name=c;section=DATES]\n AND e = [PROMPT;type=text;name=e]');
            await openBuilder();
            check('each section once, first spelling, in the order used', $('#promptSectionList option').map(function () { return $(this).attr('value'); }).get(), ['Dates', 'filters']);
            ed.setValue('SELECT 1 FROM t WHERE e = [PROMPT;type=text;name=e]');
            await openBuilder();
            check('a report without sections suggests none', $('#promptSectionList option').length, 0);

            // =================================================================
            // (Until 2026-09-24 14:50 a parent DISABLED the field; the only way to
            // give a child a section was clearing the Decision Tree - SQL Template
            // included - and dirsearch's People prompt broke that way within minutes.)
            section('5. a Decision Tree parent: blank = its section, a name = a section of its own');
            ed.setValue('SELECT 1 FROM t WHERE 1=1 [PROMPT;type=select;name=mode;message=Mode;template="";options=A,B;section=Filters]');
            await openBuilder();
            type('#promptMessage', 'Value'); type('#promptName', 'val');
            $('#promptAdvancedDetails').prop('open', true);
            await pickParent('mode');
            type('#promptResultIfValue', 'A');
            check('choosing a parent leaves the field ENABLED and says what blank means',
                [$('#promptSection').prop('disabled'), $('#promptSection').val(), $('#promptSection').attr('placeholder'), $('#promptSection').attr('title')],
                [false, '', "Parent's section", "Blank: this prompt sits in its Decision Tree parent's section. Name a section to give it its own."]);
            var pv = await preview();
            check('...blank writes no section= (the prompt follows its parent)', [pv.indexOf('section=') < 0, pv.indexOf('resultif=mode:A') >= 0], [true, true]);
            type('#promptSection', 'Own');
            pv = await preview();
            check('a name is written TOGETHER with the Decision Tree - nothing else has to go', [pv.indexOf(';name=val;section=Own;') >= 0, pv.indexOf(';resultif=mode:A]') >= 0], [true, true]);
            await pickParent('');
            check('clearing the parent keeps what was typed and gives back the field\'s own placeholder',
                [$('#promptSection').prop('disabled'), $('#promptSection').val(), $('#promptSection').attr('placeholder'), $('#promptSection').attr('title')], [false, 'Own', 'e.g. Dates', undefined]);
            // The prompt that broke: a child with its own section, a negated resultif and a template.
            var PEOPLE = '[PROMPT;type=select;name=people;section=active_only;resultif=mode:!A;forcedefault=Active only;label=People;message=People filter;options=Active only,Everyone;template="AND (:val = \'Everyone\' OR ACTIVE = 1)"]';
            ed.setValue('SELECT 1 FROM t WHERE 1=1 [PROMPT;type=select;name=mode;message=Mode;template="";options=A,B] ' + PEOPLE);
            await openBuilder(PEOPLE, ed.getValue());
            check('dirsearch\'s People loads whole: its section (field enabled), its Decision Tree AND its SQL Template',
                [$('#promptSection').val(), $('#promptSection').prop('disabled'), $('#promptResultIfName').val(), $('#promptResultIfValue').val(), $('#promptTemplate').val()],
                ['active_only', false, 'mode', '!A', "AND (:val = 'Everyone' OR ACTIVE = 1)"]);
            await generate();
            var saved = (ed.getValue().match(/\[PROMPT;[^\]]*name=people[^\]]*\]/) || [''])[0];
            var re = saved ? PG.parsePrompt(saved) : {};
            check('...and Overwrite keeps all three (the 14:07 save lost the Decision Tree and the template)',
                [re.section, re.resultif && re.resultif.parentName, re.resultif && re.resultif.expectedValue, re.template, re.forcedefault],
                ['active_only', 'mode', '!A', "AND (:val = 'Everyone' OR ACTIVE = 1)", 'Active only']);

            // =================================================================
            section('6. Reset, and the Test button');
            ed.setValue('');
            await openBuilder();
            type('#promptSection', 'Dates');
            $('#resetPromptFormBtn').trigger('click');
            await tick(60);
            check('Reset empties the field and leaves it enabled', [$('#promptSection').val(), $('#promptSection').prop('disabled')], ['', false]);
            type('#promptMessage', 'Unit'); type('#promptName', 'unit'); type('#promptSection', 'Filters');
            var keysBefore = Object.keys(localStorage).filter(function (k) { return k.indexOf('penumbra_prompt_') === 0; }).length;
            $('#promptTestOutput').empty();
            $('#testPromptBtn').trigger('click');
            await tick(250);
            var $dlg = $('.modal-prompt-overlay').last();
            check('Test opens the prompt dialog', $dlg.length, 1);
            $dlg.find('[id$="_input"]').val('OSP').trigger('input');
            $dlg.find('.modal-btn-primary').trigger('click');
            await tick(250);
            check('...and shows the SQL for the answer - section= changes nothing there', testOutput(), "Success, SQL generates as: 'OSP'");
            check('...and leaves no test answer behind', Object.keys(localStorage).filter(function (k) { return k.indexOf('penumbra_prompt_') === 0; }).length, keysBefore);

            if (window.__control) {
                section('CONTROL (must FAIL)');
                check('CONTROL: the builder has no Section field (deliberately false)', $('#promptSection').length, 0);
            }
        } catch (e) {
            fail++;
            out.push('  FAIL (exception) ' + (e && e.stack ? e.stack : e));
        }
        finish();
    })();
})();
