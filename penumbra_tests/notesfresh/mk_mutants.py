# notesfresh: writes mutants.json - single-point reverts of the 2026-10-16 change.
# must = the asserts that MUST turn red (None = explore: print what turns red).
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = ['cardnew', 'cardsame', 'cardedit', 'carddel', 'cardgone', 'cardmoved']
TABS = ['tabback', 'tabhidden', 'tabglance', 'tabcard']
M = {}
def mut(name, edits, must, scn):
    M[name] = {'edits': [list(e) for e in edits], 'must': must, 'scn': scn}

# ---- main.js: the card re-read
mut('nocall', [("            refreshCardNotes(key, kind);   // that row's notes, read again (2026-10-16)\n", "")],
    ['F-new', 'F-tint', 'F-status', 'F-rail', 'F-cell', 'F-one-call', 'F-same-call', 'F-edit-text', 'F-edit-cell', 'F-del', 'F-del-cell', 'F-gone', 'F-gone-cell', 'F-moved-count'], CARDS)
mut('nosig', [("            if (rowNotesSig(had) === rowNotesSig(fresh)) return false;\n", "")], ['F-same-noredraw'], ['cardsame'])
mut('sigtext', [("n.NOTE_TEXT || '', n.PARENT_ID == null", "n.PARENT_ID == null")], ['F-edit-text', 'F-edit-cell'], ['cardedit'])
mut('counts', [("            if (fresh.length) { store[key] = fresh; counts[key] = fresh.length; }", "            if (fresh.length) { store[key] = fresh; }")],
    ['F-cell', 'F-del-cell', 'F-moved-count'], ['cardnew', 'carddel', 'cardmoved'])
mut('gonekeep', [("            else { delete store[key]; delete counts[key]; }", "            else { }")], ['F-gone', 'F-gone-cell'], ['cardgone'])
mut('tint', [("                    it.classList.add('journal-rownote-new');\n", "")], ['F-tint'], ['cardnew'])
mut('nofade', [("                    setTimeout(function () { it.classList.remove('journal-rownote-new'); }, 2200);\n", "")], ['F-tint-fades'], ['cardnew'])
mut('nostatus', [("                if (added && !$.trim($st.text())) $st.attr", "                if (false) $st.attr")], ['F-status'], ['cardnew'])
mut('anycard', [("c.el && c.el.parentNode && c.key === key && c.kind === kind && ", "c.el && c.el.parentNode && ")], ['F-moved-card'], ['cardmoved'])
mut('noderived', [("            refreshJournalDerivedViews();   // the table's Notes cells too (it schedules the apply)\n", "")],
    ['F-cell', 'F-edit-cell', 'F-del-cell', 'F-gone-cell', 'F-moved-count'], CARDS)
# ---- main.css: the tint
mut('csstint', [("""/* A note that arrived in an open note card (2026-10-16): the same static tint, the fade gated likewise. */
.journal-rownote-item.journal-rownote-new {
    background-color: color-mix(in srgb, var(--accent-warning, gold) 24%, var(--bg-surface, #fff));
}""", """/* A note that arrived in an open note card (2026-10-16): the same static tint, the fade gated likewise. */
.journal-rownote-item.journal-rownote-new {
}""", 'css')], ['F-tint'], ['cardnew'])
# ---- main.js: the tab-return check
mut('age', [("            if (typeof at === 'number' && Date.now() - at >= JNOTES_STALE_MS) checkRowNotesVersion();", "            checkRowNotesVersion();")], ['B-short', 'B-same', 'B-quiet', 'B-reload', 'B-rebase'], ['tabback'])
mut('noconfirm', [("{ window._penumbraRowNotesAt = Date.now(); return; }   // still current", "return;")], ['B-quiet', 'B-reload', 'B-rebase'], ['tabback'])
mut('noloadat', [("                window._penumbraRowNotesAt = Date.now();   // ...and when they were last known current\n", "")], ['B-same', 'B-quiet', 'B-reload', 'B-rebase', 'B-hidden', 'B-glance', 'B-card'], TABS)
mut('vercmp', [("if (resp.ver === window._penumbraRowNotesVer) { window._penumbraRowNotesAt", "if (false) { window._penumbraRowNotesAt")], ['B-same', 'B-reload', 'B-rebase'], ['tabback'])
mut('verbase', [("window._penumbraRowNotesVer = (resp && resp.status === 'success' && typeof resp.ver === 'string') ? resp.ver : null;", "window._penumbraRowNotesVer = null;")],
    ['B-same', 'B-quiet', 'B-reload', 'B-rebase', 'B-hidden', 'B-glance', 'B-card'], TABS)
mut('novis', [("        document.addEventListener('visibilitychange', jNotesBack);\n", "")], ['B-hidden'], ['tabhidden'])
mut('nofocus', [("        window.addEventListener('focus', jNotesBack);\n", "")], ['B-same', 'B-quiet', 'B-reload', 'B-rebase', 'B-glance', 'B-card'], ['tabback', 'tabglance', 'tabcard'])
mut('nocardfollow', [("                window.Penumbra.journalRowNotesChanged();\n            }).always(function () { _jVerInFlight = false; });",
                      "                window.Penumbra.loadJournalRowNotes();\n            }).always(function () { _jVerInFlight = false; });")], ['B-card'], ['tabcard'])
# ---- manage_journal.php
mut('p-onewhere', [('''                  WHERE " . journalRowNotesWhere() . " AND SCOPE = :sc AND ROW_KEY = :rk''',
                    '''                  WHERE REPORT_ID = :rid AND SCOPE = :sc AND ROW_KEY = :rk''', 'php')], ['S-where-uses', 'S-one-binds'], [])
mut('p-vernull', [("            $ver = null;\n", "", 'php')], ['S-ver-safe'], [])
mut('p-verkey', [("                SUM(ORA_HASH(ROW_KEY)) AS KH,\n", "", 'php')], ['S-ver-sql'], [])
mut('p-vertext', [("                SUM(NVL(ORA_HASH(DBMS_LOB.SUBSTR(NOTE_TEXT, 1000, 1)), 0)) AS TH\n", "                0 AS TH\n", 'php')], ['S-ver-sql'], [])
mut('p-nosent', [(",\n                               'ver' => $ver));", "));", 'php')], ['S-ver-sent'], [])
mut('p-nvgate', [("""        if (!journalCallerCanReadJournal($report, $currentUserKey, $isAdmin)) {
            echo json_encode(array('status' => 'error', 'message' => 'The Report Journal is off for this report.'));
            exit;
        }
        if (journalEnsureFiledFor($report) === 'error') {
            echo json_encode(array('status' => 'error', 'message' => 'The journal could not be checked against the report\\'s key columns. Try again in a moment.'));
            exit;
        }
        try {
            $ver = journalRowNotesVersion($report['ID']);""", """        if (journalEnsureFiledFor($report) === 'error') {
            echo json_encode(array('status' => 'error', 'message' => 'The journal could not be checked against the report\\'s key columns. Try again in a moment.'));
            exit;
        }
        try {
            $ver = journalRowNotesVersion($report['ID']);""", 'php')], ['S-nv-gates'], [])
mut('p-onekind', [(" || !in_array($kind, array('row', 'pivot', 'chart'), true)", "", 'php')], ['S-one-gates', 'S-one-kind'], [])
json.dump(M, open(os.path.join(HERE, 'mutants.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(M), 'mutants')
