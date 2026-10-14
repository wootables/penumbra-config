/*
 * promptparity_builder_tests.js - the TAG GENERATOR's Join Logic control.
 *
 * WHY THIS HALF EXISTS. Since 2026-09-29 a multi-select after !=, <> or NOT LIKE
 * joins its values with AND unless the prompt says logic=or - so "no logic=" and
 * "logic=or" no longer mean the same thing. The builder's Join Logic dropdown had
 * two choices, OR (the default, which wrote NOTHING) and AND: re-editing a tag
 * that carried a hand-written logic=or showed OR and saved it WITHOUT the logic=,
 * silently turning a "not both" NOT LIKE into "neither". The dropdown now has a
 * third, default choice - Automatic, which writes nothing - and OR writes
 * logic=or. This drives it, through the same page the daterange builder half
 * uses: the REAL js/main.js (ready closure unwrapped, a few names exported as
 * window.__PG) under the Tag Generator markup LIFTED from the index.php under
 * test. Every step is a real DOM event: a Type change, typing, a menu pick, the
 * tag icon, Generate / Overwrite Prompt.
 *
 * Heads-up for whoever edits this file: no doubled backslashes anywhere in it.
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
    var preview = async function () { await tick(200); return $('#builderLivePreviewCode').text(); };    // the preview is debounced 120 ms
    var setType = function (t) { $('#promptType').val(t).trigger('change'); };
    var type = function (sel, text) { $(sel).val(text).trigger('input'); };
    var pickLogic = function (v) { $('#promptLogic').val(v).trigger('change'); };
    // The builder the way a person opens it: the editor's tag icon. With a tag
    // SELECTED that is "edit this prompt" (Overwrite Prompt); with nothing selected
    // it is a new prompt on a reset form. A successful Generate closes it.
    var openBuilder = async function (selectTag) {
        var cm = PG.getEditor();
        if (selectTag) { cm.setValue(selectTag); cm.setSelection({ line: 0, ch: 0 }, { line: 0, ch: selectTag.length }); }
        else { cm.setCursor({ line: 0, ch: 0 }); }
        $('#promptGeneratorIcon').trigger('click');
        await tick(80);
    };

    (async function () {
        try {
            section('0. the page booted the real builder');
            await openBuilder();
            check('the tag icon opens the builder', vis('#promptGeneratorLightbox'), true);
            check('main.js exported its hooks', [typeof PG.parsePrompt, typeof PG.prefill, typeof PG.getEditor], ['function', 'function', 'function']);
            check('Join Logic offers Automatic, OR, AND - Automatic first, so it is what a reset form shows',
                $('#promptLogic option').map(function () { return $(this).val() + '=' + $(this).text().trim(); }).get(), ['=Automatic', 'or=OR', 'and=AND']);

            // =================================================================
            section('1. a new multi-select: Automatic writes no logic=, OR and AND write theirs');
            setType('multi-select');
            type('#promptMessage', 'Exclude');
            type('#promptName', 'm');
            type('#promptOptions', 'A\nB\nC');
            check('Join Logic is offered for a multi-select, on Automatic', [vis('#promptLogic'), $('#promptLogic').val()], [true, '']);
            var p0 = await preview();
            checkContains('the preview is a multi-select tag', p0, '[PROMPT;type=multi-select;');
            check('Automatic: no logic= in the tag', p0.indexOf('logic=') < 0, true);
            pickLogic('or');
            checkContains('OR: logic=or is written (it used to be the default that wrote nothing)', await preview(), ';logic=or');
            pickLogic('and');
            checkContains('AND: logic=and', await preview(), ';logic=and');

            // Generate it - the builder's own attribute order - and derive the three
            // tags the round trips below load back in.
            var ed = PG.getEditor();
            ed.setValue('');
            $('#generatePromptBtn').trigger('click');
            await tick(60);
            var TAG_AND = ed.getValue();
            check('Generate inserted the AND tag and closed the builder', [TAG_AND.indexOf(';logic=and') > 0, vis('#promptGeneratorLightbox')], [true, false]);
            var TAG_OR = TAG_AND.replace(';logic=and', ';logic=or');   // the hand-written "not both" form
            var TAG_AUTO = TAG_AND.replace(';logic=and', '');

            // =================================================================
            section('2. editing an existing tag keeps its logic= exactly');
            var trips = [[TAG_OR, 'or', 'a hand-written logic=or (after NOT LIKE: "not both") - this one used to be dropped'],
                         [TAG_AND, 'and', 'logic=and'],
                         [TAG_AUTO, '', 'no logic= at all']];
            for (var i = 0; i < trips.length; i++) {
                var tag = trips[i][0];
                await openBuilder(tag);
                check(trips[i][2] + ': opens in Overwrite mode, Join Logic on ' + (trips[i][1] || 'Automatic'),
                    [$('#generatePromptBtn').text(), $('#promptLogic').val()], ['Overwrite Prompt', trips[i][1]]);
                check('...ROUND TRIP: what would be saved is the tag that was loaded', await preview(), tag);
                $('#generatePromptBtn').trigger('click');
                await tick(60);
                check('...and Overwrite Prompt leaves the editor byte-identical', ed.getValue(), tag);
            }

            // =================================================================
            section('3. logic= is read without case, as the engines read it');
            PG.prefill(PG.parsePrompt('[PROMPT;type=multi-select;name=m;options=A,B;logic=AND]'));
            await tick(60);
            check('logic=AND loads as AND (it used to load as a blank menu)', $('#promptLogic').val(), 'and');
            PG.prefill(PG.parsePrompt('[PROMPT;type=multi-select;name=m;options=A,B;logic=xor]'));
            await tick(60);
            check('an unknown logic= loads as Automatic - every engine reads it as no logic= at all', $('#promptLogic').val(), '');

            // =================================================================
            section('4. a NEW prompt starts on Automatic, whatever the last one was');
            await openBuilder(TAG_AND);
            check('CONTROL: an AND tag loads as AND', $('#promptLogic').val(), 'and');
            ed.setValue('');
            await openBuilder();
            setType('multi-select');
            check('a new multi-select, right after: Automatic', $('#promptLogic').val(), '');
            ed.setValue('');

            if (window.__control) {
                section('CONTROL (must FAIL)');
                check('CONTROL: Join Logic has no Automatic choice (deliberately false)', $('#promptLogic option[value=""]').length, 0);
            }
        } catch (e) {
            fail++;
            out.push('  FAIL (exception) ' + (e && e.stack ? e.stack : e));
        }
        finish();
    })();
})();
