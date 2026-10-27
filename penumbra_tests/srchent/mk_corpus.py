# Builds corpus.json for the srchent suite (2026-10-26). Characters outside ASCII
# are made with chr() so the file holds plain \u escapes (json.dumps, ensure_ascii).
# Every row puts ONE reading rule in front of both engines; every query names the
# rows it must return (RID), and both engines must return exactly those.
import json, os

C = chr
NBSP, BOM, IDEO, LS, MONG, FF, VT, NUL = C(0xA0), C(0xFEFF), C(0x3000), C(0x2028), C(0x180E), C(0x0C), C(0x0B), C(0)
EMOJI, PUA_F600 = C(0x1F600), C(0xF600)

COLUMNS = ['#', 'RID', 'DEPT', 'DEPT2', 'TITLE', 'NOTE', 'AMT', 'LINK', 'SUBS']

# The nested rows come first: both engines learn the nested column names from the
# FIRST 10 rows (buildVirtualColumnNames / _search_virtual_column_names).
ROWS = [
    ('nested',   {'SUBS': '@@JSON' + json.dumps([
                     {'SUB': "@@HTML<a href='#'>Lab &amp; Field</a> ", 'AMT2': '5'},
                     {'SUB': 'R&amp;D', 'AMT2': '7'},
                     {'SUB': '  spaced  ', 'AMT2': '9'},
                     {'SUB': '@@HTML' + NBSP + '<i>x</i>&lt;' + NBSP, 'AMT2': None}])}),
    ('nested2',  {'SUBS': '@@JSON' + json.dumps([{'SUB': 'Plain', 'AMT2': 3}])}),
    ('amp',      {'DEPT': 'Crop &amp; Soil Sciences', 'DEPT2': 'Crop & Soil Sciences'}),
    ('rawamp',   {'DEPT': 'Crop & Soil Sciences', 'DEPT2': 'Crop &amp; Soil Sciences'}),
    ('pathob',   {'DEPT': '196001-Population Health&amp;Pathobiology'}),
    ('ltgt',     {'DEPT': '&lt;none&gt;'}),                  # decoded, THEN read as a tag: '' (the browser's order)
    ('lonelt',   {'TITLE': 'Score &lt; 5'}),                 # a "<" with no ">" after it stays
    ('pct',      {'TITLE': '<1%'}),                          # strip_tags() read this as ''
    ('bigtag',   {'TITLE': 'x &lt; 5 and y &gt; 3'}),        # '<' .. '>' decoded become a "tag": 'x  3'
    ('ltraw',    {'TITLE': 'a < b'}),                        # the same in every engine
    ('quotes',   {'NOTE': '&quot;Quoted&quot; &amp; &apos;apos&apos;'}),
    ('unknown',  {'NOTE': '&#65;&#x42;&#X43;&AMP;&eacute;&#;&amp'}),   # 'AB' then the rest as it is
    ('onepass',  {'NOTE': '&amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt;'}),  # one pass: '&lt;b&gt;bold&lt;/b&gt;'
    ('nbspent',  {'NOTE': '&nbsp;Padded&nbsp;'}),
    ('nbspmid',  {'NOTE': 'Mid&nbsp;space'}),                # a PLAIN space, not U+00A0
    ('nbspraw',  {'NOTE': NBSP + 'NBSP raw' + NBSP}),
    ('nbsp160',  {'NOTE': '&#160;Entity NBSP&#xA0;'}),
    ('bom',      {'NOTE': BOM + 'BOM lead'}),
    ('pair',     {'NOTE': 'Emoji &#55357;&#56832; pair &#xD83D;&#xDE00;'}),
    ('lone',     {'NOTE': 'Lone &#55357; half &#56832;&#55357;'}),  # a low then a high: two halves, no pair
    ('astral',   {'NOTE': 'Astral &#128512; &#65601;'}),             # 16 bits: U+F600 and 'A'
    ('hugedec',  {'NOTE': 'Huge &#99999999999999999999;|&#1234567890123456789;|&#1000000000000065;|&#000000000000000000065;|&#' + '9' * 400 + ';'}),
    ('hexround', {'NOTE': 'Hex &#x20000000000001;|&#x20000000000003;|&#x1FFFFFFFFFFFFF;|&#x100000000000000000;|&#x0000000000000000041;|&#x2000000000000C1;|&#x2000000000000D0;|&#x2000000000000D1;|&#x2000000000000F0;'}),
    # 2^57 + low bits, rounded to a multiple of 32: C1 down, D0 half (even: down), D1 up, F0 half (odd: up)
    ('dollar',   {'AMT': '&#36;1,250.50'}),
    ('link',     {'LINK': '@@HTML<a href="x?a=1&amp;b=2">R&amp;D Office</a>'}),
    ('athtml',   {'LINK': '&#64;&#64;HTML<b>Encoded marker</b>'}),
    ('quotedgt', {'LINK': '<a title="x>y">t</a>'}),
    ('comment',  {'LINK': 'a<!-- c > d -->b'}),
    ('nul',      {'NOTE': 'NUL end' + NUL}),
    ('ideo',     {'NOTE': IDEO + 'Ideographic' + LS}),
    ('mongol',   {'NOTE': MONG + 'Mongolian'}),
    ('ff',       {'NOTE': FF + 'Formfeed' + VT}),
    ('plain',    {'DEPT': 'Plant Biology', 'TITLE': 'Plain title', 'NOTE': 'plain note', 'AMT': '75',
                  'LINK': '@@HTML<a href="y">Plain Link</a>'}),
    ('blank',    {}),
]

ALL = [r[0] for r in ROWS]
QUERIES = [
    # slug, query, the rows it returns
    ('eqamp',      "DEPT = 'Crop & Soil Sciences'", ['amp', 'rawamp']),
    ('containamp', "DEPT contains '& Soil'", ['amp', 'rawamp']),
    ('entitygone', "DEPT contains '&amp;'", []),
    ('regexamp',   'DEPT = /Health&Patho/', ['pathob']),
    ('exactamp',   'DEPT2 = //Crop & Soil Sciences//', ['amp', 'rawamp']),
    ('phamp',      'DEPT = {DEPT2} and DEPT2 != empty', ['amp', 'rawamp']),
    ('ltgtempty',  'DEPT = empty and RID = ltgt', ['ltgt']),
    ('lonelt',     "TITLE contains 'Score < 5'", ['lonelt']),
    ('pct',        "TITLE = '<1%'", ['pct']),
    ('bigtag',     'TITLE = //x  3//', ['bigtag']),
    ('ltraw',      "TITLE = 'a < b'", ['ltraw']),
    ('quotes',     'NOTE contains "& \'apos\'"', ['quotes']),
    ('unknown',    'NOTE = //AB&#X43;&AMP;&eacute;&#;&amp//', ['unknown']),
    ('onepass',    "NOTE contains '&lt;b&gt;bold'", ['onepass']),
    ('padded',     'NOTE = //Padded//', ['nbspent']),
    ('nbspmid',    'NOTE = //Mid space//', ['nbspmid']),
    ('nbspraw',    'NOTE = //NBSP raw//', ['nbspraw']),
    ('nbsp160',    'NOTE = //Entity NBSP//', ['nbsp160']),
    ('bom',        'NOTE = //BOM lead//', ['bom']),
    ('pair',       "NOTE contains 'Emoji " + EMOJI + " pair " + EMOJI + "'", ['pair']),
    ('lone',       "NOTE contains 'Lone  half'", []),
    ('astral',     "NOTE contains 'Astral " + PUA_F600 + " A'", ['astral']),
    ('nul',        'NOTE = //NUL end//', []),
    ('ideo',       'NOTE = //Ideographic//', ['ideo']),
    ('mongol',     'NOTE = //Mongolian//', []),
    ('ff',         'NOTE = //Formfeed//', ['ff']),
    ('dollar',     'AMT > 1000', ['dollar']),
    ('link',       "LINK = 'R&D Office'", ['link']),
    ('linkglobal', "'R&D Office'", ['link']),
    ('globalneg',  "!= 'Crop & Soil Sciences'", [r for r in ALL if r not in ('amp', 'rawamp')]),
    ('athtml',     "LINK = 'Encoded marker'", ['athtml']),
    ('quotedgt',   'LINK contains \'y">t\'', ['quotedgt']),
    ('comment',    'LINK = //a d -->b//', ['comment']),
    ('nesthtml',   "SUB = 'Lab &amp; Field'", ['nested']),
    ('nestraw',    "SUB = 'R&amp;D'", ['nested']),
    ('nestnodec',  "SUB = 'R&D'", []),
    ('nestspaced', 'SUB = //  spaced  //', ['nested']),
    ('nestnbsp',   'SUB = //x&lt;//', ['nested']),
    ('rowhtml',    "__ROW SUB = 'Lab &amp; Field' and AMT2 = 5", ['nested']),
    ('rowhtmlneg', "__ROW SUB = 'Lab &amp; Field' and AMT2 = 7", []),
    ('nested2',    'AMT2 = 3', ['nested2']),
    ('plaineq',    "DEPT = 'Plant Biology'", ['plain']),
    ('plainlink',  "LINK = 'Plain Link'", ['plain']),
]

rows = []
for i, (rid, cells) in enumerate(ROWS):
    r = {c: '' for c in COLUMNS}
    r['#'] = str(i + 1)
    r['RID'] = rid
    r.update(cells)
    rows.append(r)
assert len(set(ALL)) == len(ALL) and len(set(q[0] for q in QUERIES)) == len(QUERIES)
for q in QUERIES:
    for rid in q[2]:
        assert rid in ALL, (q[0], rid)

corpus = {
    '_about': ('srchent (2026-10-26): cells and searches run through BOTH search engines - main.js '
               '(getCellValue / getVirtualColumnsForRow / getStructuredVirtualData, parseAdvancedQuery + '
               'evaluateParsedQuery, in harness.html) and penumbra_search.php (_search_get_cell_value, '
               '_search_get_virtual_columns, _search_get_structured_virtual_data, php_apply_search_filter, '
               'by php_side.php). expect = the RIDs a query returns; both engines must return exactly them.'),
    'columns': COLUMNS,
    'rows': rows,
    'queries': [{'slug': s, 'q': q, 'expect': e} for s, q, e in QUERIES],
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus.json')
with open(out, 'w', encoding='ascii', newline='\n') as f:
    json.dump(corpus, f, ensure_ascii=True, indent=1)
print('corpus.json: %d rows, %d queries' % (len(rows), len(QUERIES)))
