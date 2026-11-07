# fbucket suite: writes corpus.json. The expected rows are written BY HAND below; every date-bucket query is
# also worked out by an independent oracle (Python's datetime over the fixture's dates) and must agree, so a
# hand slip cannot make a wrong expectation that both engines then "pass".
#   py -3 mk_corpus.py   (writes corpus.json beside it)
import datetime as dt, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
COLS = ['ID', 'D', 'T', 'AMT', 'L', 'N', 'AWARD DATE', 'Q', 'Q:fy']
R = [
    # ID  D                           T                        AMT                           L                                N        AWARD DATE     Q             Q:fy
    (1,  '2025-07-01',                '2025-07-01 09:15:00',   '$150,000',                   'Jones, Jacob;Smith, Ann',      'alpha', '07/15/2024',  '2025-01-05', 'x'),
    (2,  '06/30/2025',                '2025-06-30 23:59:59',   '99,999.99',                  'Smith, Ann',                   'beta',  '15-MAR-23',   '2025-01-05', 'y'),
    (3,  '15-MAR-99',                 '',                      '(5,000)',                    '',                             'gamma', '2023',        '2025-01-05', 'x'),
    (4,  '01-JAN-01',                 '2001-01-01 00:00:00',   '1,000,000',                  'Doe, J; Jones, Jacob ;Doe, J', 'delta', 'Mar 2025',    '2025-01-05', 'y'),
    (5,  '',                          '',                      '33',                         'Palmtag',                      '',      '',            '2025-01-05', 'y'),
    (6,  'TBD',                       '',                      'n/a',                        'Lee &amp; Co;Kim',             'eps',   '',            '2025-01-05', 'y'),
    (7,  '12/31/2026',                '',                      '250000',                     'Smith, Ann;Jones, Jacob',      'zeta',  '',            '2025-01-05', 'y'),
    (8,  '2024-02-29',                '2024-02-29 13:00:00',   '0.5',                        'kim',                          'eta',   '',            '2025-01-05', 'y'),
    (9,  '@@HTML<b>2025-11-15</b>',   '',                      '@@HTML<span>12,345</span>',  '@@HTML<i>A;B</i>',             'theta', '',            '2025-01-05', 'y'),
    (10, 'Feb 2025',                  '',                      '1e3',                        'A|B',                          'iota',  '',            '2025-01-05', 'y'),
    (11, '2025-08-20',                '2025-08-20 07:05:00',   '45,000',                     'Kim;Palmtag',                  'kappa', '',            '2025-01-05', 'y'),
    (12, '2023-10-01',                '',                      '7,500',                      'Smith, Ann; Lee &amp; Co',     'lambda', '',           '2025-01-05', 'y'),
    (13, '01/02/2026',                '',                      '3,000,000',                  'Doe, J',                       'mu',    '',            '2025-01-05', 'y'),
    (14, '2025-12-25',                '',                      '$600',                       'Jones, Jacob; Kim',            'nu',    '',            '2025-01-05', 'y'),
]
ROWS = [dict((COLS[i], str(r[i])) for i in range(len(COLS))) for r in R]
ALL = [r[0] for r in R]
EN = '–'

# ---- the oracle: the fixture's D dates, read by Python (the formats the fixture uses) ----
def dparse(s):
    s = re.sub(r'<[^>]*>', '', s[6:] if s.startswith('@@HTML') else s).strip()
    if not s: return None, None
    for f, g in (('%Y-%m-%d', 'day'), ('%m/%d/%Y', 'day'), ('%b %Y', 'month')):
        try: return dt.datetime.strptime(s, f), g
        except ValueError: pass
    m = re.match(r'^(\d{2})-([A-Z]{3})-(\d{2})$', s)
    if m:
        y = int(m.group(3)); y += 2000 if y <= 68 else 1900
        return dt.datetime.strptime('%s-%s-%d' % (m.group(1), m.group(2).title(), y), '%d-%b-%Y'), 'day'
    return None, 'text:' + s
MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
DW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
def label(split, s):
    d, g = dparse(s)
    if d is None: return '' if g is None else g[5:]
    if g == 'month' and split in ('dow', 'hour'): return s
    fy = d.year + 1 if d.month >= 7 else d.year
    return {'year': str(d.year), 'fy': 'FY%02d' % (fy % 100), 'yq': '%d Q%d' % (d.year, (d.month - 1) // 3 + 1),
            'fyq': 'FY%02d Q%d' % (fy % 100, ((d.month + 5) % 12) // 3 + 1), 'ym': '%s %d' % (MO[d.month - 1], d.year),
            'quarter': 'Q%d' % ((d.month - 1) // 3 + 1), 'fquarter': 'FQ%d' % (((d.month + 5) % 12) // 3 + 1),
            'month': MO[d.month - 1], 'monthnum': '%02d' % d.month, 'dow': DW[d.weekday()]}[split]
def where(split, pred):
    return [r[0] for r in R if pred(label(split, r[1]))]

Q = []
def q(slug, text, ids, oracle=None, ctl=True):
    if oracle is not None and sorted(oracle) != sorted(ids):
        raise SystemExit('ORACLE DISAGREES on %s: hand %s, oracle %s' % (slug, ids, sorted(oracle)))
    Q.append({'slug': slug, 'q': text, 'ids': sorted(ids), 'bucket': ctl})

fy26 = [1, 9, 11, 13, 14]
q('fy-eq', 'D:fy = FY26', fy26, where('fy', lambda l: l == 'FY26'))
q('fy-ge', 'D:fy >= FY26', [1, 7, 9, 11, 13, 14], where('fy', lambda l: l in ('FY26', 'FY27')))
q('fy-lt-century', 'D:fy < FY01', [3], where('fy', lambda l: l == 'FY99'))
q('fy-multi', 'D:fy = /^(?:FY99|FY01)$/', [3, 4], where('fy', lambda l: l in ('FY99', 'FY01')))
q('fy-ne', 'D:fy != FY26', [2, 3, 4, 5, 6, 7, 8, 10, 12], where('fy', lambda l: l != 'FY26'))
q('dow-weekend', 'D:dow = /^(?:Sat|Sun)$/', [9, 12], where('dow', lambda l: l in ('Sat', 'Sun')))
q('month-ge', 'D:month >= Jul', [1, 7, 9, 11, 12, 14], where('month', lambda l: l in MO[6:]))
q('month-ge-lower', 'D:month >= jul', [1, 7, 9, 11, 12, 14], where('month', lambda l: l in MO[6:]))
q('ym-eq', "D:ym = 'Jul 2025'", [1], where('ym', lambda l: l == 'Jul 2025'))
q('ym-between', "D:ym >= 'Jan 2025' and D:ym <= 'Jun 2025'", [2, 10],
  where('ym', lambda l: l in ['%s 2025' % m for m in MO[:6]]))
q('quarter', 'D:quarter = Q1', [3, 4, 8, 10, 13], where('quarter', lambda l: l == 'Q1'))
q('fquarter', 'D:fquarter = FQ1', [1, 11], where('fquarter', lambda l: l == 'FQ1'))
q('yq', "D:yq = '2025 Q3'", [1, 11], where('yq', lambda l: l == '2025 Q3'))
q('fyq', "D:fyq = 'FY26 Q2'", [9, 14], where('fyq', lambda l: l == 'FY26 Q2'))
q('monthnum-12', 'D:monthnum = 12', [7, 14], where('monthnum', lambda l: l == '12'))
q('monthnum-2', 'D:monthnum = 2', [8, 10], where('monthnum', lambda l: l == '02'))
q('year-eq', 'D:year = 2025', [1, 2, 9, 10, 11, 14], where('year', lambda l: l == '2025'))
q('year-gt', 'D:year > 2025', [7, 13], where('year', lambda l: l.isdigit() and int(l) > 2025))
q('hour-eq', "T:hour = '09:00'", [1])
q('hour-ge', "T:hour >= '13:00'", [2, 8])
q('dow-coarse', "D:dow = 'Feb 2025'", [10], where('dow', lambda l: l == 'Feb 2025'))
q('fy-text', 'D:fy = TBD', [6], where('fy', lambda l: l == 'TBD'))
q('fy-empty', 'D:fy = empty', [5], where('fy', lambda l: l == ''))
q('fy-notempty', 'D:fy != empty', [i for i in ALL if i != 5], where('fy', lambda l: l != ''))
q('braced-multiword', '{AWARD DATE:fy} = FY25', [1, 4])
q('quoted-multiword', "'AWARD DATE:fy' = FY25", [1, 4])
q('contains-2tok', 'D:fy FY2', [1, 2, 7, 8, 9, 10, 11, 12, 13, 14], where('fy', lambda l: 'FY2' in l))
q('regex-2tok', 'D:fy /^FY2[56]/', [1, 2, 9, 10, 11, 13, 14], where('fy', lambda l: l in ('FY25', 'FY26')))
q('word-contains', 'D:fy contains fy27', [7], where('fy', lambda l: l == 'FY27'))
q('case-col', 'd:FY = fy26', fy26)
q('braced-spaces', '{ D :fy } = FY26', fy26)
q('fy-vs-number', 'D:fy > 2025', [], ctl=False)
q('hour-date-only', "D:hour = '00:00'", [], ctl=False)
q('colon-column', '{Q:fy} = x', [1, 3], ctl=False)
q('colon-column-bare', 'Q:fy = x', [1, 3], ctl=False)
q('unknown-base', 'ZZ:fy = FY26', [], ctl=False)
q('unknown-suffix', 'D:fiscal = FY26', [], ctl=False)
q('bin-eq', "AMT:bin100000 = '100,000 %s 199,999'" % EN, [1])
q('bin-ge', 'AMT:bin100000 >= 200000', [4, 7, 13])
q('binlog-eq', "AMT:binlog = '100,000 %s 999,999'" % EN, [1, 7])
q('binlog-lt1', "AMT:binlog = '< 1'", [3, 8])
q('bins-above', "AMT:bins100000_250000 = 'above 250K'", [4, 7, 13])
q('bins-below', "AMT:bins100000_250000 = 'below 100K'", [2, 3, 5, 8, 9, 11, 12, 14])
q('bins-unsorted', "AMT:bins250000_100000 = '100K %s 250K'" % EN, [1])
q('bin-auto', "AMT:bin = '0 %s 499,999'" % EN, [1, 2, 5, 7, 8, 9, 11, 12, 14])
q('bin-auto-neg', "AMT:bin = '-500,000 %s -1'" % EN, [3])
q('list-eq', "L:dsemi = 'Jones, Jacob'", [1, 4, 7, 14])
q('list-ne', "L:dsemi != 'Jones, Jacob'", [2, 3, 5, 6, 8, 9, 10, 11, 12, 13])
q('list-multi', 'L:dsemi = /^(?:Palmtag|Kim)$/', [5, 6, 8, 11, 14])
q('list-entity', "L:dsemi = 'Lee & Co'", [6, 12])
q('list-empty', 'L:dsemi = empty', [3])
q('list-notempty', 'L:dsemi != empty', [i for i in ALL if i != 3])
q('list-contains', 'L:dsemi Smith', [1, 2, 7, 12])
q('list-pipe', 'L:dpipe = B', [10])
q('list-html', 'L:dsemi = B', [9])
q('mix-group', "(D:fy = FY25 or D:fy = FY27) and AMT:binlog = '100,000 %s 999,999'" % EN, [7])
q('mix-or', 'D:fy = FY26 or N = zeta', [1, 7, 9, 11, 13, 14])
q('mix-and', 'D:fy = FY26 and L:dsemi = Kim', [11, 14])

# ---- label parity: the same texts through the browser's labels, the server's, and the runner's own grouping ----
DATE_T = ['2025-07-01', '06/30/2025', '6/30/2025', '15-MAR-99', '15-MAR-68', '15-MAR-69', '01-JAN-01', '2024-02-29',
          'Feb 2025', 'February 2025', '2025-02', '02/2025', '2025', '2025-07-01 09:15:00', '2025-07-01 23:59:59.123',
          '18-SEP-25 02:22:00 PM', '9/18/2025 14:22', '02/30/2025', 'TBD', '', '5 Mar 2025', '31-DEC-2025', '2025 Feb',
          '12/31/99', '1/2/26', '2026-01-02']
NUM_T = ['$150,000', '99,999.99', '(5,000)', '1,000,000', '0.5', '0', '1', '9.99', '10', '-0.5', '1e3', 'n/a', '', '12%',
         '\x02123\x02', '+5', '.5', '1 000', '999999999999', '-1', '100000', '250000', '249999.999', '-250,000.5', '(0.5)']
LIST_T = ['Jones, Jacob;Smith, Ann', ' a ; b ;a', 'a;;b', 'A|B| c', 'x\ty\t x', 'line1\r\nline2\nline3\rline4',
          'one  two   three', '', ';', 'Lee & Co;Kim', '  solo  ', 'a,b, c ,,a', 'p|q|p']
LBL = []
for s in ['year', 'fy', 'yq', 'fyq', 'ym', 'quarter', 'fquarter', 'month', 'monthnum', 'dow', 'hour']:
    for t in DATE_T: LBL.append({'tok': 'D:' + s, 'text': t, 'kind': 'date', 'split': s})
for tok, w in (('A:bin1000', 1000), ('A:bin7', 7), ('A:binlog', None), ('A:bins100000_250000', None), ('A:bins0_10', None), ('A:bins5', None)):
    for t in NUM_T: LBL.append({'tok': tok, 'text': t, 'kind': 'bins' if 'bins' in tok else 'bin', 'split': tok.split(':')[1], 'width': w})
for d in ('dsemi', 'dcomma', 'dpipe', 'dtab', 'dnl', 'dspace'):
    for t in LIST_T: LBL.append({'tok': 'L:' + d, 'text': t, 'kind': 'list', 'split': d})

json.dump({'columns': COLS, 'rows': ROWS, 'queries': Q, 'labels': LBL}, open(os.path.join(HERE, 'corpus.json'), 'w', encoding='utf-8'),
          ensure_ascii=True, indent=1)
print('corpus.json: %d rows, %d queries (%d bucket), %d label cases' % (len(ROWS), len(Q), sum(1 for x in Q if x['bucket']), len(LBL)))
