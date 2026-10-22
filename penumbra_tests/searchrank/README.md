# searchrank - report search ranks by relevance before recency (2026-10-21)

`get_server_reports.php` MODE search (the repository, 50 rows) and MODE quicksearch (home screen, Quick actions,
the dashboard tile editor, the Tags tool) sort a text search by `penumbraReportSearchRankSql()` first, then
`r.UPDATED_AT DESC`. Tiers: 0 the short id IS the term, 1 the id starts with it, 2 it starts a word of the id or
title (`REGEXP_LIKE(UPPER(col), '(^|[^[:alnum:]])' || UPPER(:rx))`, the term regex-escaped), 3 the id or title holds
it (INSTR: literal), 4 owner / access list / owner-by-name (quicksearch) / tag, 5 the rest (SQL, snippet, options,
task recipients). tag:NAME stays newest first. Live: faaae25 (+ the repository pill and help row in bdd7f0b).

## Server half (this folder)

    php -n run.php                      the live file: RESULT GREEN = 21/21
    php -n run.php --app <stage dir>    a staged get_server_reports.php
    php -n run.php --control            the pre-change file (git: the parent of the commit that brought the helper):
                                        exactly CONTROL_RED (14) must fail
    php -n run.php --mutants            12 single-point edits (mutants.json), each must turn EXACTLY its "must" red

`test.php` lifts the helpers by name and the two mode blocks verbatim, runs them on a fake connection that holds
every statement to OCI8's bind discipline on the Oracle text (a bound name not in the SQL = ORA-01036, the trap of
the search COUNT, which reuses the WHERE's binds; a placeholder left unbound = ORA-01008), then EXECUTES the SQL in
SQLite (pdo_sqlite from the server's ext folder) after dialect rewrites, on fixtures modelled on the "EPA" case
(62 hits, 54 only in STATE_DATA, epa-perm older than all of those). SQLite folds ASCII only and PCRE stands in for
Oracle's regex - hence the Oracle half.

## Oracle half (the DUAL probe)

    php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=pdo_sqlite
        oracle_probe.php --file <get_server_reports.php>  >  probe.json

prints `{sql, terms, expected}`: ONE read-only statement, FROM DUAL only, running the endpoint's own CASE (binds as
columns of a terms row) over fixture rows x 11 terms (EPA, budget, a.b, (epa, x]y, {x}, c++, cafe-accent, fy_budget,
a|b, smith) + a 256-char term, and the tiers SQLite gives for it. From a signed-in www3 tab (an admin's console, no
short_id): POST it to `query.php` as `query_template` with `params=[]`, `limitRows=1000`, map each row to
`T|SID|RK` (cells come back HTML-escaped) and compare with `expected`. 2026-10-21 on faaae25's stage: 300/300 equal.

## Clients (tested elsewhere)

repoorder J-search (the repository keeps the server's order) and J-pill / J-cap (the capped-search pill);
bulkset J7 pins the search render call.
