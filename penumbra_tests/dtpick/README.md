# dtpick (2026-11-05) - the runner twin of "active during" for Group by

    php -n pivotparityxtract_mirror.php <webroot>\schedule_runner.php mirror.php
    php -d date.timezone=America/New_York -d memory_limit=512M php_active_test.php mirror.php

26 asserts. Live 342d772: 26/0. Control (342d772^): fatals at the first missing function. Mutants: kit roundC/php_mutants.py (10, each caught).

## php_pivot_test.php (Round D1, 2026-11-05) - the runner twin of the active pivot

    php -n pivotparityxtract_mirror.php <webroot>\schedule_runner.php mirror.php
    php -d date.timezone=America/New_York -d memory_limit=512M php_pivot_test.php mirror.php <webroot>

25 asserts (collector, prorate, gate, HTML/CSV/XLSX). Live 8c91937: 25/0. Control (8c91937^): fatal at pivot_active_gate. Mutants: kit roundD/php_mutants.py (12, each caught). JS twin: chartinv -Only V (27; 12 mutants in kit roundD/js_mutants.py).

## Round D2 (2026-11-05)

delimgroup scenario pvactive (14, the pivot builder lifted from index.php by mk_harness.py) and palette ppvactive (7). Live 212d989: green. Control (212d989^): pvactive 8 red, ppvactive 5 red. Mutants: kit roundE/js_mutants.py (13) and palette run.py pp-* (4).
