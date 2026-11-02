# tipaud (2026-10-31, the user: "the hover help for layout mentions snippet buttons even for non admins/editors/owners,
# users dont know what these are -- are there other places that do this?"). Static. A hover tip a reader can open (the
# stores behind the reader's own dialogs: the pivot builder, the grouping dialog, the chart builder, Settings and Quick
# actions, the snapshots) says nothing of snippets, Custom Code, action(trigger) or vis() outside a part marked
# data-audience="writer", which the tip popover drops for a reader (main.js initHelpPopover's tipAudience: unless
# penumbra_vars.canEditReport); the editor keeps those parts; the chart builder's Width / Height fields (open to readers)
# say "the chart". The prompt builder's tips (builder-tips-storage.php) belong to the SQL / Custom Code editors: not read.
#   py -3 run.py                            the live app
#   py -3 run.py --stage DIR                a staged copy (each file from DIR when it is there, else live)
#   py -3 run.py --control                  live: the round's checks (NEW) are expected RED until it is in
#   py -3 run.py --stage DIR --mutant NAME  one mutant on the stage: its target checks must go red ("--mutant all": each)
import os, re, sys
LIVE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
RELS = {'pivot': 'help/tips/pivot-tips-storage.php', 'viz': 'help/tips/viz-tips-storage.php', 'settings': 'help/tips/settings-tips-storage.php',
        'snap': 'help/tips/snap-tips-storage.php', 'main': 'js/main.js', 'index': 'index.php'}
READER_STORES = ('pivot', 'viz', 'settings', 'snap')
WORDS = re.compile(r'snippet|custom code|action\(trigger|\bvis\(\)', re.I)
WRITER = re.compile(r'<(span|p|ul|li|div)\b[^>]*\bdata-audience="writer"[^>]*>.*?</\1>', re.S)
NEW = {'S-tipsReaders', 'S-tipGate', 'S-vizTitles', 'S-editorKept'}   # (tipaud, 2026-10-31)
NEW = set()   # (tipaud is LIVE since 8b6b55d, 2026-10-31: old checks now)

# name: ([(file, old, new)], [checks that must go red])
MUTANTS = {
    't-layout': ([('pivot', '<span data-audience="writer"> A snippet button can ask for it', '<span> A snippet button can ask for it')], ['S-tipsReaders', 'S-editorKept']),
    't-palette': ([('settings', '<span data-audience="writer"> Two letters also find', '<span> Two letters also find')], ['S-tipsReaders']),
    't-vizul': ([('viz', '<ul data-audience="writer">', '<ul>')], ['S-tipsReaders']),
    't-gate': ([('main', """$pop.find('[data-audience="writer"]').remove();""", '')], ['S-tipGate']),
    't-call2': ([('main', '$pop.html($src2.html()); tipAudience();', '$pop.html($src2.html());')], ['S-tipGate']),
    't-title': ([('index', 'space the chart is given', 'space the snippet is given')], ['S-vizTitles']),
}

def read(root, rel):
    p = os.path.join(root, *rel.split('/'))
    if not os.path.exists(p): p = os.path.join(LIVE, *rel.split('/'))
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape').replace('\r\n', '\n')

def tips(s):
    out = []
    parts = s.split('<div data-tip="')
    for p in parts[1:]:
        key = p[:p.index('"')]
        out.append((key, p[p.index('>') + 1:]))
    return out

def checks(t):
    res = []
    leaks = []
    for store in READER_STORES:
        for key, body in tips(t[store]):
            reader = WRITER.sub('', body)
            text = re.sub(r'<[^>]+>', '', reader)
            for m in WORDS.finditer(text):
                leaks.append('%s/%s: ...%s...' % (store, key, re.sub(r'\s+', ' ', text[max(0, m.start() - 40):m.end() + 30])))
    res.append(('S-tipsReaders', not leaks, 'a reader\'s tips name no snippet / Custom Code / action(trigger) / vis(): %s' % ('none' if not leaks else ' | '.join(leaks[:6]))))
    main = t['main']
    fn = re.search(r'function tipAudience\(\) \{(.*?)\}\n', main)
    gate = bool(fn) and 'penumbra_vars.canEditReport' in fn.group(1) and """$pop.find('[data-audience="writer"]').remove();""" in fn.group(1)
    calls = '$pop.html($src.html()); tipAudience();' in main and '$pop.html($src2.html()); tipAudience();' in main
    res.append(('S-tipGate', gate and calls, 'the tip popover drops writer parts for a reader who cannot edit the report (both paths)'))
    ix = t['index']
    tw = re.search(r'id="vizWidth"[^>]*title="([^"]*)"', ix) or re.search(r'title="([^"]*)"[^>]*id="vizWidth"', ix)
    th = re.search(r'id="vizHeight"[^>]*title="([^"]*)"', ix) or re.search(r'title="([^"]*)"[^>]*id="vizHeight"', ix)
    ok = bool(tw and th) and not WORDS.search(tw.group(1)) and not WORDS.search(th.group(1))
    res.append(('S-vizTitles', ok, 'the chart builder\'s Width / Height titles: %r / %r' % (tw.group(1)[:70] if tw else None, th.group(1)[:70] if th else None)))
    lay = dict(tips(t['pivot'])).get('group-layout', '')
    kept = any('group_by|COLUMN|layout=list' in m.group(0) for m in WRITER.finditer(lay))
    res.append(('S-editorKept', kept, 'an editor keeps the Layout tip\'s snippet line (inside its writer part)'))
    return res

def main():
    a = sys.argv[1:]
    stage = a[a.index('--stage') + 1] if '--stage' in a else None
    control = '--control' in a
    mut = a[a.index('--mutant') + 1] if '--mutant' in a else None
    root = stage if (stage and not control) else LIVE
    print('under test: %s' % root)
    t = {k: read(root, v) for k, v in RELS.items()}
    if mut:
        names = list(MUTANTS) if mut == 'all' else [mut]
        ok = bad = 0
        base = {a2 for a2, p, d in checks(t) if not p}
        if base: print('  NOTE  the unmutated build already fails: %s' % ' '.join(sorted(base)))
        for nm in names:
            edits, want = MUTANTS[nm]
            tm = dict(t)
            for f, old, new in edits:
                c = tm[f].count(old)
                if c != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (nm, f, c, old[:80]))
                tm[f] = tm[f].replace(old, new)
            red = {a2 for a2, p, d in checks(tm) if not p} - base
            hit = all(w in red for w in want)
            print('  %s  mutant %-10s turns %s red   [red: %s]' % ('PASS' if hit else 'FAIL', nm, ' '.join(want), ' '.join(sorted(red)) or 'none'))
            ok += hit; bad += (not hit)
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 and ok > 0 else 'RESULT: RED')
        return
    res = checks(t)
    p = f = 0; failed = []
    for a2, passed, d in res:
        print('  %s  %-16s %s' % ('PASS' if passed else 'FAIL', a2, d[:600]))
        if passed: p += 1
        else: f += 1; failed.append(a2)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        new_green = sorted(x for x in NEW if x not in failed)
        old_red = sorted(x for x in failed if x not in NEW)
        print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
        print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
        print('RESULT: GREEN' if not new_green and not old_red else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')

main()
