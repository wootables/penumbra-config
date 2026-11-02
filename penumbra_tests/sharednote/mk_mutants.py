import json, sys
# sharednote's browser mutants: each a single-point revert of the stage's main.js. "must": null = EXPLORE
# (print the red set); filled in from that run once each red set is read and makes sense.
out = sys.argv[1]
must = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else {}
M = {
    'nobase': ("                body = { action: 'edit', note_id: box._snId, note_text: text, base_text: base, mentions: mentions };",
               "                body = { action: 'edit', note_id: box._snId, note_text: text, mentions: mentions };", ['card', 'conflict', 'clear']),
    'render': ("            if (sharedOn() && kind !== 'pivot' && kind !== 'chart') return sharedViewHtml(rowKey);   // (sharednote) the one note\n", "", ['card', 'conflict', 'inline']),
    'flat': ("            if (sharedOn()) { var sn = sharedNoteIn(notes); return sn ? String(sn.NOTE_TEXT == null ? '' : sn.NOTE_TEXT).replace(/\\r\\n|\\r/g, '\\n').replace(/^[ \\t\\n]+|[ \\t\\n]+$/g, '') : ''; }\n", "", ['export']),
    'preview': ("            if (sharedOn()) t = t.trim().replace(/\\s*[\\r\\n]+\\s*/g, ' · ');   // (sharednote) its lines apart on the one line\n", "", ['cell', 'card', 'blank']),
    'count': ("(n && !shared ? n : '')", "(n ? n : '')", ['cell', 'setup']),
    'conflict': ("                    box._snBase = cur ? String(cur.NOTE_TEXT == null ? '' : cur.NOTE_TEXT) : null;\n", "", ['conflict']),
    'esc': ("            if (sharedEscape()) return true;   // (sharednote) an edit open in the box: cancelled\n", "", ['cancel']),
    'savemode': ("            if (window._penumbraJournalNotesMode === 'shared') viewOptions.journalNotesMode = 'shared';\n", "", ['setup']),
    'restoremode': ("                window._penumbraJournalNotesMode = _jvo.journalNotesMode === 'shared' ? 'shared' : '';   // a Shared note (2026-11-01)\n", "", None),
    'draft': ("            if (keep && ta && (snText(ta) !== (box._snBase || '').replace(/\\s+$/, '') || (box._snFiles && box._snFiles.length))) _snDrafts[snDraftKey(key)] = { html: ta.innerHTML, base: box._snBase, id: box._snId, files: (box._snFiles || []).slice() };\n", "", ['cancel', 'inline']),
    # (sharedmention) the box without the mention field; the clock rule
    'mentionfield': ("                if (window.Penumbra.mentionField) {\n                    ta._mentionMf = window.Penumbra.mentionField(ta, {", "                if (false) {\n                    ta._mentionMf = window.Penumbra.mentionField(ta, {", ['mention']),
    'clock': ("                    var when = (cur && window.moment && moment(cur.CREATED_AT, 'YYYY-MM-DD HH:mm:ss').isAfter(moment())) ? 'just now' : fmtWhen(cur && cur.CREATED_AT);",
              "                    var when = fmtWhen(cur && cur.CREATED_AT);", ['mention']),
    'blankopen': ("                if (!sharedNoteOf(key) || _snDrafts[snDraftKey(key)]) sharedOpen(_snBox);", "                if (_snDrafts[snDraftKey(key)]) sharedOpen(_snBox);", ['blank', 'card']),
    'compose': ("                if (panel && panel.classList.contains('pnb-sharednote')) return !!sharedOpen(sharedEditWhere(panel), text || '');   // (sharednote; sharedcard: a small card's in its details)\n", "", ['inline']),
    # (sharedcard, 2026-11-01) a small card's Edit edits in its details window
    'smallcard': ("            if (!/^(compact|standard)$/.test(String(C.size() || 'standard'))) return box;", "            if (!/^$/.test(String(C.size() || 'standard'))) return box;", ['smallcard']),
    'needsnotes': ("$('#journalNotesModeShared').prop('checked', window._penumbraJournalNotesMode === 'shared').prop('disabled', !window._penumbraJournalRowNotes);",
                   "$('#journalNotesModeShared').prop('checked', window._penumbraJournalNotesMode === 'shared').prop('disabled', false);", ['setup']),
    # (sharedfiles, 2026-11-01) files on a Shared note; the composers' row. A 4th element names the file: 'css' main.css,
    # 'cardscss' penumbra_cards.css (default: main.js)
    'filesdrop': ("            if (zone.input && zone.input.classList.contains('pnb-sharednote-files')) { sharedAddFiles(sharedBox(zone.input), files); return; }\n", "", ['paste']),
    'pastewrap': ("            if (!$wrap.length) $wrap = $(noteEl).closest('.pnb-sharednote-edit');   // (sharedfiles) a Shared note's box\n", "", ['paste']),
    'replyparent': ("            if (rootId) fd.append('parent_id', rootId);\n", "", ['files', 'filesonly']),
    'firstfile': ("                            root = (resp.attachment && resp.attachment.note_id) ? String(resp.attachment.note_id) : null;\n", "", ['filesonly']),
    'filesset': ("                + sharedFilesHtml(rowKey, n)\n", "", ['files', 'filesonly']),
    'cardgrid': (".journal-rownote-inline .journal-rownote-compose-actions { display: contents; }", ".journal-rownote-inline .journal-rownote-compose-actions { display: flex; }", ['layout'], 'cardscss'),
    'sharedrow': (".pnb-sharednote-row { display: flex; align-items: flex-end; gap: 8px; }", ".pnb-sharednote-row { display: block; }", ['files', 'layout'], 'css'),
}
o = {}
for k, v in M.items():
    a, b, scn = v[0], v[1], v[2]
    o[k] = {'edits': [[a, b] + ([v[3]] if len(v) > 3 else [])], 'must': must.get(k), 'scn': scn}
json.dump(o, open(out, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
print(len(o), 'mutants')
