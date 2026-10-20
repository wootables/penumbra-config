# =============================================================================
# FILTER WORDING SUITE (2026-10-19): the report page's "search box" is the
# "filter box" in every user-facing word. FILTER = the box (keeps only the rows
# that match; totals, snippets, charts, calculations, exports and email follow),
# FIND = Ctrl+F (highlights only), SEARCH = finding something to go to (help,
# fields, reports, people). Static: reads the app files, no browser.
#
#   W1  index.php: the report box's own words, the scheduler field's label "Apply Filter:" (its own
#       run / clear keep their words: the user's scope, 10-19); the old ones gone
#   W2  main.js: placeholders, single keys, the empty state, notices, the Rows card,
#       the email and export header lines
#   W3  the Visual Filter Builder (search_builder_content.php + search_builder.js)
#   W4  Find's words for the filter (js/penumbra_find.js)
#   W5  the help: the topic's title (manifest + h3), "used to be called the search
#       box", the old words still findable (keywords), the scheduler's Filter
#   W6  SWEEP the help topics + tips: no "search box / bar / filter / syntax",
#       "Visual Search Builder", "saved searches", "the search keeps|shows|hides"
#       except the reviewed keeps (real searches) in KEEP_HELP
#   W7  SWEEP the JS string literals of the touched modules the same way (KEEP_JS)
#   W8  the Rows card still reads the grouped count text: its regex takes the new
#       "showing N filtered results" (and the old words), and the text says it
#   W9  the scheduled email (schedule_runner.php) and the journal's bulk message
#   W10 the in-app AI's prompt: FILTER BOX SYNTAX + the "was called" line
#   W11 the dashboard names the builder by its new name; its own filter box keeps its words
#   W12 the Custom Code reference keeps its API words with "(the filter box)"
#   S0  sanity: every file is there (holds in --control too)
#
#   py -3 run.py                      the kit's stage\                 EXPECTED: GREEN
#   py -3 run.py --app DIR            another copy in the app layout (e.g. the live webroot after the deploy)
#   py -3 run.py --control            the kit's orig\ (before the rename): every W check RED
#   py -3 run.py --mutant NAME / --mutants
# =============================================================================
import argparse, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ['index.php', 'js/main.js', 'js/search_builder.js', 'search_builder_content.php', 'js/penumbra_find.js',
         'js/penumbra_colmenu.js', 'js/penumbra_grouplist.js', 'js/penumbra_tiles.js', 'js/penumbra_bulkset.js',
         'js/penumbra_dashboard.js', 'schedule_runner.php', 'manage_journal.php', 'ai_system_prompt.php',
         'help/manifest.php', 'help/snippets.php', 'help/topics/optionsHelpLightbox.php']

# reviewed keeps: (file, a piece of the text around it) - REAL searches, or the one "used to be" sentence
KEEP_HELP = [
    ('auditorHelpLightbox.php', "entire history: the search box (top) matches user IDs"),
    ('auditorHelpLightbox.php', "drops that value straight into the search box"),
    ('copyHelpLightbox.php', "clause or a search box"),
    ('pivotBuilderHelpLightbox.php', "Use the search box to filter by name"),
    ('repositoryHelpLightbox.php', "Jumps to the search box from anywhere in the dialog"),
    ('repositoryHelpLightbox.php', "with the cursor in the search box"),
    ('repositoryHelpLightbox.php', "The button at the left of the search box"),
    ('searchHelpLightbox.php', "It used to be called the search box."),
    ('userSettingsHelpLightbox.php', "leave the filter and search boxes"),
    ('pivot-tips-storage.php', "Use the search box below to filter long field lists"),
]
KEEP_JS = [
    ('js/main.js', "Report list: jump to its search box"),
    # the dashboard's own filter box keeps its words (the user's call, 10-19)
    ('js/penumbra_dashboard.js', "report search syntax"),
    ('js/penumbra_dashboard.js', "own search syntax"),
    ('js/penumbra_dashboard.js', "Search filter"),
]
BOX = re.compile(r'(?i)\b(search (?:box|bar|filter|syntax|grammar)(?:es)?|visual search builder|saved search(?:es)?|the search (?:keeps|shows|hides)|your search hides)\b')

# name: (file, old, new, the checks that MUST go red). Each old must occur exactly once in the stage.
MUTANTS = {
    'idxlabel':   ('index.php', 'aria-label="Filter report table"', 'aria-label="Search report table"', ['W1']),
    'schedlabel': ('index.php', '>Apply Filter: <span class="tab-help-icon" data-target="#searchFilterHelpLightbox" title="Help: Apply Filter Syntax">',
                   '>Search Filter: <span class="tab-help-icon" data-target="#searchFilterHelpLightbox" title="Help: Search Filter Syntax">', ['W1']),
    # the user's scope (10-19): the scheduler's own run / clear and the dashboard's own words stay as they were
    'schedkeep':  ('index.php', 'id="schedSearchPlay" title="(Enter) Run search"', 'id="schedSearchPlay" title="(Enter) Apply the filter"', ['W1']),
    'dashkeep':   ('js/penumbra_dashboard.js', "searchHelpLightbox: 'Search help' };", "searchHelpLightbox: 'Filter help' };", ['W11']),
    'schedhelp':  ('help/topics/searchFilterHelpLightbox.php', '>Apply Filter (scheduler) <span', '>Filter (scheduler) <span', ['W5']),
    'placeholder': ('js/main.js', "restKeysOff: 'Double click here or begin typing to filter',", "restKeysOff: 'Double click here or begin typing to search',", ['W2']),
    'rowscard':   ('js/main.js', "kw: 'Filter', code: text, part: -1, xLabel: 'Clear the filter' });", "kw: 'Search', code: text, part: -1, xLabel: 'Clear the search' });", ['W2']),
    'rowsregex':  ('js/main.js', r"showing ([\d,]+) (?:filtered|search) results/.exec(rc);", r"showing ([\d,]+) search results/.exec(rc);", ['W8']),
    'builderhdr': ('js/search_builder.js', "'preset':    'Saved Filters',", "'preset':    'Saved Searches',", ['W3', 'W7']),
    'buildertitle': ('search_builder_content.php', '<h3 class="pnb-dlg-title">Visual Filter Builder ', '<h3 class="pnb-dlg-title">Visual Search Builder ', ['W3']),
    'findmore':   ('js/penumbra_find.js', "' your filter hides');", "' your search hides');", ['W4', 'W7']),
    'helptitle':  ('help/manifest.php', "'title' => 'Filtering the Table',", "'title' => 'Advanced Search',", ['W5']),
    'helpsweep':  ('help/topics/viewoptionsHelpLightbox.php', 'The filter box above the table', 'The search box above the table', ['W6']),
    'tipsweep':   ('help/tips/viz-tips-storage.php', 'Same syntax as the main filter box.', 'Same syntax as the main search bar.', ['W6']),
    'colmenu':    ('js/penumbra_colmenu.js', "(p.rows === 1 ? ' row' : ' rows') + ' the filter keeps' });", "(p.rows === 1 ? ' row' : ' rows') + ' the search keeps' });", ['W7']),
    'runner':     ('schedule_runner.php', '$linkText = "View this report for the interactive pivot view with sorting and filtering.";', '$linkText = "View this report for the interactive pivot view with sorting and search.";', ['W9']),
    'aiprompt':   ('ai_system_prompt.php', 'SECTION 3: FILTER BOX SYNTAX', 'SECTION 3: SEARCH BOX SYNTAX', ['W10']),
    'dashtitle':  ('js/penumbra_dashboard.js', 'title="Visual Filter Builder: compose the filter from conditions', 'title="Visual Search Builder: compose the filter from conditions', ['W11', 'W7']),
    'refnote':    ('help/topics/optionsHelpLightbox.php', 'puts VALUE in the search box (the filter box) and filters the table', 'puts VALUE in the search box and filters the table', ['W12']),
}

R = []
def rec(i, name, ok, detail=''):
    R.append((i, name, bool(ok), str(detail)[:500]))

def read(p):
    with open(p, 'rb') as f: return f.read().decode('utf-8', 'surrogateescape').replace('\r\n', '\n')

def missing(t, needles):  return [n for n in needles if n not in t]
def present(t, needles):  return [n for n in needles if n in t]

def help_text(t):
    t = re.sub(r'<\?php.*?\?>', ' ', t, flags=re.S)
    t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', t)

def js_literals(src):
    """the string literals of a JS file (comments and regex literals skipped)"""
    i, n, out, prev_sig, prev_word = 0, len(src), [], '', ''
    while i < n:
        c = src[i]
        if c in ' \t\r\n': i += 1; continue
        if src.startswith('//', i): j = src.find('\n', i); i = n if j < 0 else j; continue
        if src.startswith('/*', i): j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"`':
            q, j, buf = c, i + 1, []
            while j < n:
                d = src[j]
                if d == '\\': buf.append(src[j:j + 2]); j += 2; continue
                if d == q or (d == '\n' and q != '`'): break
                buf.append(d); j += 1
            out.append(''.join(buf)); i = j + 1; prev_sig, prev_word = q, ''; continue
        if c == '/' and (prev_sig == '' or prev_sig in '(,=:[!&|?{};+-*%<>~^' or prev_word in ('return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new')):
            j, cls = i + 1, False
            while j < n:
                d = src[j]
                if d == '\\': j += 2; continue
                if d == '\n': break
                if d == '[': cls = True
                elif d == ']': cls = False
                elif d == '/' and not cls: break
                j += 1
            j += 1
            while j < n and src[j].isalpha(): j += 1
            i = j; prev_sig, prev_word = ')', ''; continue
        if c.isalnum() or c in '_$':
            j = i
            while j < n and (src[j].isalnum() or src[j] in '_$'): j += 1
            prev_word = src[i:j]; prev_sig = 'a'; i = j; continue
        prev_sig, prev_word = c, ''; i += 1
    return out

def checks(T, helps):
    rec('S0', 'sanity: every file under test is there (%d files, %d help fragments)' % (len(T), len(helps)), all(T.values()) and len(helps) > 30, [k for k, v in T.items() if not v])
    idx, mj, sb, sbc, fd = T['index.php'], T['js/main.js'], T['js/search_builder.js'], T['search_builder_content.php'], T['js/penumbra_find.js']
    # ---- W1
    # The scheduler's own box keeps its run / clear words and is labelled "Apply Filter:" (the user, 10-19:
    # the other filter boxes "dont need correcting ... maybe use 'Apply Filter:' instead of search filter in
    # scheduler"); its builder icon names the builder, which is one shared dialog (Visual Filter Builder).
    need = ['aria-label="Filter report table"', 'role="search" aria-label="Filter the report"', 'placeholder="Double click here or begin typing to filter"',
            'id="tableSearchPlay" title="(Enter) Apply the filter"', 'id="clearTableSearch" title="Clear the filter">&times;',
            'title="Visual Filter Builder (/)"', 'title="Visual Filter Builder" role="button"', 'title="(Alt+Down) Show the columns and saved filters" aria-label="Show the columns and saved filters"',
            '>Apply Filter: <span class="tab-help-icon" data-target="#searchFilterHelpLightbox" title="Help: Apply Filter Syntax">',
            'id="schedSearchPlay" title="(Enter) Run search"', 'id="clearSchedSearch" title="Clear search">&times;',
            '<strong>Filter Bar</strong><small>Show the filter box above the table.</small>', '<h3>No rows match your filter</h3>',
            '<h3 style="margin-top: 0;">Filter Mismatch</h3>', 'the Visual Filter Builder, <code># 1-200</code> in the filter box']
    gone = ['Search report table', 'aria-label="Search the report"', 'id="tableSearchPlay" title="(Enter) Run search"', 'id="clearTableSearch" title="Clear search"',
            'title="Visual Search Builder', 'Open the Visual Search Builder', 'saved searches"', 'Search Filter Syntax', '>Search Filter: <', '<strong>Search Bar</strong>',
            'No rows match your search', 'Search Filter Mismatch', '>Visual Search Builder</a>']
    counts = idx.count('aria-label="Open the Visual Filter Builder"') == 2
    rec('W1', "index.php: the report box's words, the scheduler's 'Apply Filter:' label (its own run / clear unchanged), the builder's name on both icons, the View Options name, the empty state, the mismatch dialog; none of the old ones",
        not missing(idx, need) and not present(idx, gone) and counts, 'missing=%s old=%s counts=%s' % (missing(idx, need), present(idx, gone), counts))
    # ---- W2
    need = ["rest: 'Type / to filter, or double-click for suggestions',", "restKeysOff: 'Double click here or begin typing to filter',",
            "focus: 'Type to filter, or press / for the Visual Filter Builder'", "'/': { label: 'Jump to the filter box' },", "'x': { label: 'Clear the filter',",
            'That group is hidden by the current filter. Clear the filter to jump to it.', 'That row is hidden by the current filter. Clear the filter to jump to it.',
            "kw: 'Filter', code: text, part: -1, xLabel: 'Clear the filter' });", 'id="sbRfClear">Clear the whole filter</button>',
            'nothing matches the current filter.', "push('Filter', ctx.search || '(none)');", "bits.push('Filter: ' + q);",
            "blockRow(['Filter: ' + by.search.content]", '&#128269; Filter: ${escapeHtml(searchVal)}', " Include current filter: <code>",
            "'Clear the filter to see all '", "Narrow the view with a filter first.", "$warn.html('⚠ Filter differs - snapshot: \"'"]
    gone = ["to search, or double-click", "begin typing to search", "for the Visual Search Builder'", "Jump to the table search", "Clear the table search",
            "hidden by the current search", "'Clear the search'", "current search/filter", "Search filter differs", "kw: 'Search'", "Include current search filter",
            "Clear the search box", "with a search first", "' the search shows'"]
    rec('W2', 'main.js: the placeholders, the "/" and "x" keys, the empty state, the notices, the Rows card, the email / export / print / feedback lines say filter',
        not missing(mj, need) and not present(mj, gone), 'missing=%s old=%s' % (missing(mj, need), present(mj, gone)))
    # ---- W3
    need_c = ['<h3 class="pnb-dlg-title">Visual Filter Builder ', 'title="Help: Visual Filter Builder"', '> Filter source rows <span', '>Generated Filter<span',
              'title="Apply this filter to the table">Filter</button>', 'Type the preset name in the filter box to run it.']
    need_j = ["'preset':    'Saved Filters',", "saveLabel: 'Save current filter…',", "shareLabel: 'Share current filter…'",
              "$('#sbSubmitBtn').text('Filter').attr('title', 'Apply this filter to the table');", "'This filter is empty or incomplete."]
    gone = ['Visual Search Builder <span', 'Saved Searches', 'Save current search', 'Share current search', ".text('Search')", 'Generated Search Query', 'Search source rows']
    rec('W3', 'the Visual Filter Builder: its title, help title, Saved Filters, Save / Share current filter, the Filter button, Generated Filter, Filter source rows',
        not missing(sbc, need_c) and not missing(sb, need_j) and not present(sbc + sb, gone), 'missing=%s old=%s' % (missing(sbc, need_c) + missing(sb, need_j), present(sbc + sb, gone)))
    # ---- W4
    need = ["' your filter hides');", "(promo.add ? 'Add to the filter: ' : 'Filter for ')", "'The filter box is different: it keeps only the rows that match. '",
            'turns what you found into that filter.']
    gone = ['your search hides', 'Add to the search', 'The search box filters instead', "'Search for '"]
    rec('W4', "Find's words for the filter: 'N more in rows your filter hides', the Filter button's title, the (i) tip",
        not missing(fd, need) and not present(fd, gone), 'missing=%s old=%s' % (missing(fd, need), present(fd, gone)))
    # ---- W5
    man, top, sft = T['help/manifest.php'], helps.get('searchHelpLightbox.php', ''), helps.get('searchFilterHelpLightbox.php', '')
    kw = re.search(r"'id' => 'searchHelpLightbox'.*?'keywords' => '([^']*)'", man, re.S)
    kw = kw.group(1) if kw else ''
    ok = ("'title' => 'Filtering the Table'," in man and 'Advanced Search' not in man and all(w in kw for w in ('filter box', 'search box', 'search bar', 'advanced search', 'visual filter builder', 'visual search builder'))
          and '>Filtering the Table</h3>' in top and 'It used to be called the search box.' in top and '>Apply Filter (scheduler) <span' in sft
          and 'beside the <strong>Apply Filter</strong> field' in sft and "The Scheduler's Apply Filter field" in top
          and 'Advanced Search' not in top + sft and "'apply filter search filter per-recipient" in man)
    rec('W5', "the help: the topic is 'Filtering the Table' (manifest + h3), says it used to be the search box, the old words stay findable (keywords); the scheduler's field is 'Apply Filter' as on screen",
        ok, 'keywords=%r' % kw)
    # ---- W6
    bad = []
    for f, t in sorted(helps.items()):
        if f == 'optionsHelpLightbox.php': continue
        txt = help_text(t)
        for m in BOX.finditer(txt):
            ctx = txt[max(0, m.start() - 70):m.end() + 70]
            if not any(f == kf and kp in ctx for kf, kp in KEEP_HELP):
                bad.append('%s: ...%s...' % (f, ctx))
    rec('W6', 'SWEEP the help topics + tips: no search box / bar / filter / syntax, Visual Search Builder, saved searches, "the search keeps" left, except %d reviewed keeps (real searches)' % len(KEEP_HELP),
        not bad, '%d left: %s' % (len(bad), ' | '.join(bad[:4])))
    # ---- W7
    bad = []
    for rel in ['js/main.js', 'js/search_builder.js', 'js/penumbra_find.js', 'js/penumbra_colmenu.js', 'js/penumbra_grouplist.js', 'js/penumbra_tiles.js', 'js/penumbra_bulkset.js', 'js/penumbra_dashboard.js']:
        for lit in js_literals(T[rel]):
            if BOX.search(lit) and not any(rel == kf and kp in lit for kf, kp in KEEP_JS):
                bad.append('%s: %s' % (rel, lit[:120]))
    rec('W7', 'SWEEP the string literals of main.js, the builder, Find, the column menu, the group list, tiles, bulk settings and dashboards the same way (%d reviewed keep)' % len(KEEP_JS),
        not bad, '%d left: %s' % (len(bad), ' | '.join(bad[:4])))
    # ---- W8
    m = re.search(r"var gm = /(.+?)/\.exec\(rc\);", mj)
    sample_new = '12,345 total rows, showing 678 filtered results in 9 groups'
    sample_old = '12,345 total rows, showing 678 search results in 9 groups'
    sample_srch = '12,345 total rows, with 678 filtered results in 9 of 20 groups'
    try:
        rx = re.compile(m.group(1)) if m else None
    except re.error: rx = None
    def num(s):
        g = rx.search(s) if rx else None
        return (g.group(1) or g.group(2)) if g else None
    ok = bool(rx) and num(sample_new) == '678' and num(sample_old) == '678' and num(sample_srch) == '678' and 'showing ${totalOriginalRows.toLocaleString()} filtered results in' in mj
    rec('W8', "the Rows card still reads the grouped count text: its regex takes 'showing N filtered results' (and the old 'search results'), and the count text says it",
        ok, 'regex=%r new=%s old=%s with=%s' % (m.group(1) if m else None, num(sample_new), num(sample_old), num(sample_srch)))
    # ---- W9
    sr, jn = T['schedule_runner.php'], T['manage_journal.php']
    ok = (sr.count('&#128269; Filter: " . $') == 3 and '&#128269; Search filter' not in sr and sr.count('interactive pivot view with sorting and filtering.') == 2
          and 'with sorting and search.' not in sr and jn.count('Narrow the view with a filter first.') == 2 and 'with a search first' not in jn)
    rec('W9', "the scheduled email's 'Filter:' line (x3) and pivot link text (x2); the journal endpoint's bulk message (x2)", ok,
        'runner filter=%d link=%d journal=%d' % (sr.count('&#128269; Filter: " . $'), sr.count('sorting and filtering.'), jn.count('with a filter first.')))
    # ---- W10
    ai = T['ai_system_prompt.php']
    ok = 'SECTION 3: FILTER BOX SYNTAX' in ai and 'The filter box was called the search box until October 2026' in ai and 'SEARCH BOX SYNTAX' not in ai and "\\'Find Active\\'" not in ai
    rec('W10', "the in-app AI's prompt: 'FILTER BOX SYNTAX', the 'was called the search box' line, no 'Find' label on a filter link", ok)
    # ---- W11
    dj = T['js/penumbra_dashboard.js']
    need = ['title="Visual Filter Builder: compose the filter from conditions', 'aria-label="Open the Visual Filter Builder"', "or press / for the Visual Filter Builder');",
            # ...and its own box keeps its words (the user, 10-19: they "dont need correcting")
            'title="The report search syntax, applied to every tile', 'title="Search help: the syntax the filter uses" aria-label="Search help">',
            "searchHelpLightbox: 'Search help' };", ">Table only (search, toolbar, table, pagination)</option>", "fieldRow('Search filter', '<input type=\"text\" id=\"teSearch\""]
    rec('W11', "dashboards: the builder's new name; the dashboard's own filter box, Search help, default-filter hint and tile field keep their words", not missing(dj, need), 'missing=%s' % missing(dj, need))
    # ---- W12
    op, sn = T['help/topics/optionsHelpLightbox.php'], T['help/snippets.php']
    sha = re.search(r'sha256 ([0-9a-f]{64})', op)
    import hashlib
    reg_sha = hashlib.sha256(open(os.path.join(APP, 'help', 'snippets.php'), 'rb').read()).hexdigest()
    ok = (op.count('(the filter box)') >= 3 and 'puts VALUE in the search box (the filter box) and filters the table' in op and 'action(search, LABEL, VALUE)' in op
          and bool(sha) and sha.group(1) == reg_sha and '<strong>Filter</strong> and <strong>sort order</strong>' in sn)
    rec('W12', "the Custom Code reference keeps its API words (action(search, ...)) with '(the filter box)' beside them, and is the current render of help/snippets.php",
        ok, 'notes=%d sha=%s reg=%s' % (op.count('(the filter box)'), sha.group(1)[:12] if sha else None, reg_sha[:12]))

APP = os.path.join(HERE, 'stage')

def load(app, mutant=None):
    T = {}
    for rel in FILES:
        p = os.path.join(app, rel)
        T[rel] = read(p) if os.path.exists(p) else ''
    helps = {}
    for sub in ('help/topics', 'help/tips'):
        d = os.path.join(app, sub)
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f.endswith('.php'): helps[f] = read(os.path.join(d, f))
    if mutant:
        rel, old, new, _red = MUTANTS[mutant]
        if rel.startswith('help/topics/') or rel.startswith('help/tips/'):
            f = rel.split('/')[-1]; src = helps[f]
        else:
            src = T[rel]
        n = src.count(old)
        if n != 1: raise SystemExit("mutant '%s' anchor found %d times: %r" % (mutant, n, old[:80]))
        src = src.replace(old, new)
        if rel.startswith('help/topics/') or rel.startswith('help/tips/'):
            helps[rel.split('/')[-1]] = src
            if rel in T: T[rel] = src
        else:
            T[rel] = src
    return T, helps

def run(app, mutant=None, quiet=False):
    global APP
    APP = app
    del R[:]
    T, helps = load(app, mutant)
    checks(T, helps)
    if not quiet:
        for i, name, ok, d in R:
            print(('  PASS  ' if ok else '  FAIL  ') + i + ' ' + name + ('' if ok else '\n          ' + d))
    return [i for i, _n, ok, _d in R if not ok]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', default=os.path.join(HERE, 'stage'))
    ap.add_argument('--control', action='store_true')
    ap.add_argument('--mutant', default='')
    ap.add_argument('--mutants', action='store_true')
    a = ap.parse_args()
    app = os.path.join(HERE, 'orig') if a.control else a.app
    print('app: ' + app + ('   (CONTROL: the files before the rename)' if a.control else ''))
    if a.mutants:
        ok = 0
        for name, m in MUTANTS.items():
            red = run(app, name, quiet=True)
            bites = all(x in red for x in m[3])
            ok += bites
            print('MUTANT %-12s %s   red: %s' % (name, 'BITES' if bites else 'SURVIVES (wanted ' + ' '.join(m[3]) + ')', ' '.join(red) or '-'))
        print('MUTANTS %d / %d bite' % (ok, len(MUTANTS)))
        print('RESULT: ' + ('GREEN' if ok == len(MUTANTS) else 'RED'))
        return
    red = run(app, a.mutant or None)
    print('TOTAL pass=%d fail=%d' % (len(R) - len(red), len(red)))
    if a.control:
        wrong = [i for i, _n, ok, _d in R if (i == 'S0') != ok]
        print('CONTROL: %s' % ('as expected (S0 holds, every W check RED)' if not wrong else 'UNEXPECTED: ' + ' '.join(wrong)))
        print('RESULT: ' + ('GREEN' if not wrong else 'RED'))
        return
    print('RESULT: ' + ('GREEN' if not red else 'RED'))

if __name__ == '__main__':
    main()
