window.__FIXTURE = {
  "note": "pivotsrc fixture (2026-09-28). Sums per funder/year: Alpha 20|120(2 txns), Bravo 150|10, Charlie 30|20, Delta 120|120(2), Echo 101(2)|5. AMOUNT > 100 as the pivot's Amount = Alpha Bravo Delta Echo; as the column = txns 4 and 8 (Bravo, Delta). COUNT is a source column that a default 'Count' label collides with.",
  "rows": [
    {"FUNDER": "Alpha",   "FY": "FY 2025", "AMOUNT": "20",  "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Alpha",   "FY": "FY 2026", "AMOUNT": "60",  "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Alpha",   "FY": "FY 2026", "AMOUNT": "60",  "TRANSACTION_TYPE": "Supplement", "COUNT": "1"},
    {"FUNDER": "Bravo",   "FY": "FY 2025", "AMOUNT": "150", "TRANSACTION_TYPE": "New",        "COUNT": "3"},
    {"FUNDER": "Bravo",   "FY": "FY 2026", "AMOUNT": "10",  "TRANSACTION_TYPE": "Supplement", "COUNT": "1"},
    {"FUNDER": "Charlie", "FY": "FY 2025", "AMOUNT": "30",  "TRANSACTION_TYPE": "New",        "COUNT": "3"},
    {"FUNDER": "Charlie", "FY": "FY 2026", "AMOUNT": "20",  "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Delta",   "FY": "FY 2025", "AMOUNT": "120", "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Delta",   "FY": "FY 2026", "AMOUNT": "50",  "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Delta",   "FY": "FY 2026", "AMOUNT": "70",  "TRANSACTION_TYPE": "Supplement", "COUNT": "1"},
    {"FUNDER": "Echo",    "FY": "FY 2025", "AMOUNT": "90",  "TRANSACTION_TYPE": "New",        "COUNT": "1"},
    {"FUNDER": "Echo",    "FY": "FY 2025", "AMOUNT": "11",  "TRANSACTION_TYPE": "Supplement", "COUNT": "1"},
    {"FUNDER": "Echo",    "FY": "FY 2026", "AMOUNT": "5",   "TRANSACTION_TYPE": "New",        "COUNT": "1"}
  ],
  "emailQueries": [
    "AMOUNT > 100",
    "{Amount} > 100",
    "__SRC AMOUNT > 100",
    "__ALL __SRC AMOUNT > 100",
    "__SRC __ALL AMOUNT > 100",
    "__ALL AMOUNT > 100",
    "Awards > 1",
    "%Δ != 5",
    "TRANSACTION_TYPE = New",
    "__SRC TRANSACTION_TYPE = New",
    "AMOUNT > 50 and Awards > 1",
    "AMOUNT > 50 or TRANSACTION_TYPE = Supplement",
    "__ROW AMOUNT > 100",
    "__SRC __ROW AMOUNT > 100",
    "__ALL __ROW AMOUNT > 100"
  ],
  "infoQueries": []
}
;