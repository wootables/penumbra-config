window.__GR_FIXTURE = {
  "note": "grouprow fixture (2026-09-28). Grouped by COLLEGE, summary sum(AMOUNT): Eng 400,000, Sci 500,000. Rows 1 and 4 hold a Widget and a QTY over 5 on DIFFERENT sub-rows, row 3 on the SAME one. Expected values are hand-computed; names = the surviving groups.",
  "cols": ["#", "COLLEGE", "DEPT", "AWARD_DATE", "AMOUNT", "ACTIVE", "ITEMS"],
  "rows": [
    ["1", "Eng", "ECE",  "2024-03-15", "100000", "1", "@@JSON[{\"ITEM\":\"Widget\",\"QTY\":\"2\"},{\"ITEM\":\"Gadget\",\"QTY\":\"9\"}]"],
    ["2", "Eng", "ECE",  "2024-08-20", "250000", "0", "@@JSON[{\"ITEM\":\"Gadget\",\"QTY\":\"1\"}]"],
    ["3", "Eng", "ME",   "2024-03-01", "50000",  "1", "@@JSON[{\"ITEM\":\"Widget\",\"QTY\":\"7\"}]"],
    ["4", "Sci", "BIO",  "2025-01-10", "75000",  "0", "@@JSON[{\"ITEM\":\"Widget\",\"QTY\":\"3\"},{\"ITEM\":\"Bolt\",\"QTY\":\"8\"}]"],
    ["5", "Sci", "BIO",  "2025-09-05", "300000", "1", "@@JSON[{\"ITEM\":\"Bolt\",\"QTY\":\"1\"}]"],
    ["6", "Sci", "CHEM", "2024-11-11", "125000", "1", "@@JSON[{\"ITEM\":\"Gadget\",\"QTY\":\"4\"}]"]
  ],
  "cases": [
    {"id": "1", "q": "{Sum of AMOUNT} > 450000",                                      "groups": 1, "rows": 3, "names": "Sci"},
    {"id": "2", "q": "__ROW {Sum of AMOUNT} > 450000",                                "groups": 1, "rows": 3, "names": "Sci"},
    {"id": "3", "q": "DEPT = BIO and {Sum of AMOUNT} > 300000",                       "groups": 1, "rows": 2, "names": "Sci"},
    {"id": "4", "q": "__ROW DEPT = BIO and {Sum of AMOUNT} > 300000",                 "groups": 1, "rows": 2, "names": "Sci"},
    {"id": "5", "q": "ITEM = Widget and QTY > 5 and {Sum of AMOUNT} > 40000",        "groups": 2, "rows": 3, "names": "Eng,Sci"},
    {"id": "6", "q": "__ROW ITEM = Widget and QTY > 5 and {Sum of AMOUNT} > 40000",  "groups": 1, "rows": 1, "names": "Eng"}
  ]
};