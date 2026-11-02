# tipaud - hover help keeps snippet talk for editors

Static (no browser). Started 2026-10-31 (round grpcnt) from the user's report: the grouping dialog's Layout tip told
every reader "A snippet button can ask for it", and readers do not know what snippets are.

A hover tip a reader can open (help/tips: pivot, viz, settings, snap - the stores behind the reader's own dialogs)
says nothing of snippets, Custom Code, `action(trigger` or `vis()` outside a part marked `data-audience="writer"`.
main.js `initHelpPopover` drops those parts (`tipAudience`) unless `penumbra_vars.canEditReport` (an administrator,
a grant holder or the owner of the loaded report). The prompt builder's tips (builder-tips-storage.php) belong to the
SQL / Custom Code editors and are not read.

Checks: S-tipsReaders (no reader-facing mention left), S-tipGate (the popover drops writer parts on both of its
paths), S-vizTitles (the chart builder's Width / Height titles say "the chart"), S-editorKept (the Layout tip's
snippet line is still there, inside its writer part).

    py -3 run.py                            the live app
    py -3 run.py --stage DIR                a staged copy (each file from DIR when it is there, else live)
    py -3 run.py --control                  live: the round's checks (NEW) are expected RED until it is in
    py -3 run.py --stage DIR --mutant all   each mutant: its target checks must go red

A new tip that mentions snippets for editors: wrap that part in `<span data-audience="writer">` (or put the attribute
on its `<p>` / `<ul>` / `<li>`). The browser side of the gate is grplist's `tip` scenario (tipReaderNoSnippet).
