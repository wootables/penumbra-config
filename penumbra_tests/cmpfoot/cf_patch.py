# cmpfoot: _penumbraRecomputeFooterInPlace fix (2026-09-30). Anchored, CRLF-exact.
#   py -3 cf_patch.py forward SRC DST     apply (every anchor exactly once)
#   py -3 cf_patch.py reverse SRC DST     undo (must give the original bytes back)
#   py -3 cf_patch.py oneliner SRC DST    the suggested one-line fix ONLY (a comparison variant, never deployed)
import sys

OLD = r'''    function _penumbraRecomputeFooterInPlace($wrapper) {
        $wrapper.find('tfoot td').each(function () {
            var $td = $(this);
            var colId = $td.attr('data-column');
            if (colId === '#' || colId === '__SNAP_TYPE' || $td.hasClass('pnb-sum-label')) return;
            var $strong = $td.find('strong');
            if (!$strong.length) return;
            var $th = $wrapper.find('thead th').eq($td.index());
            var colName = $th.attr('data-colname') || '';
            var type = colName ? penumbraResolveSummaryForName(colName, null) : $td.attr('data-sum-type');
            if (!type) return;
            var acc = penumbraSummaryAccumulator(type, col);
            $wrapper.find('tbody tr:not(.search-hidden):not(.journal-note-child) td[data-column="' + colId + '"]')
                .each(function () { acc.push(this.textContent); });
            var res = acc.finish();
            $strong.text(res === null ? '' : penumbraFormatSummary(res, type));
            $td.attr('data-sum-type', type);
            $td.find('.pnb-sum-badge').remove();
            $td.append(penumbraSummaryBadgeHtml(type, true, $td.attr('data-sum-col')));
        });
    }
'''

NEW = r'''    function _penumbraRecomputeFooterInPlace($wrapper) {
        var typesShown = [];
        $wrapper.find('tfoot td').each(function () {
            var $td = $(this);
            var colId = $td.attr('data-column');
            if (colId === '#' || colId === '__SNAP_TYPE' || $td.hasClass('pnb-sum-label')) return;
            var $strong = $td.find('strong');
            if (!$strong.length) return;
            // The column NAME is the cell's own data-sum-col, stamped by
            // generateComparisonTotalRow - NOT the header at this cell's index.
            // The diff's <thead> carries a hidden __SNAP_TYPE column its <tfoot>
            // has no cell for, so that header is the column to the LEFT: every
            // cell took its neighbour's summary type. (2026-09-30)
            var colName = $td.attr('data-sum-col') || '';
            var type = colName ? penumbraResolveSummaryForName(colName, null) : $td.attr('data-sum-type');
            if (!type) return;
            var acc = penumbraSummaryAccumulator(type, colName);
            // Through _readComparisonCellText, as the search's recompute reads
            // them: a modified cell holds its was AND now views, and its raw text
            // (the two run together) parses as NaN - the cell dropped out.
            $wrapper.find('tbody tr:not(.search-hidden):not(.journal-note-child) td[data-column="' + colId + '"]')
                .each(function () { acc.push(_readComparisonCellText(this)); });
            var res = acc.finish();
            $strong.text(res === null ? '' : penumbraFormatSummary(res, type));
            $td.attr('data-sum-type', type);
            $td.find('.pnb-sum-badge').remove();
            $td.append(penumbraSummaryBadgeHtml(type, true, colName));
            typesShown.push(type);
        });
        // The keyword follows the types, as a fresh render writes it: a badge
        // pick turns TOTALS into SUMMARY (and back).
        if (typesShown.length) {
            $wrapper.find('tfoot td.pnb-sum-label strong').text(penumbraSummaryHeaderLabel(typesShown));
        }
    }
'''

# The suggested fix, alone: `col` -> colName || data-sum-col || colId, nothing else.
ONE_OLD = "            if (!type) return;\n            var acc = penumbraSummaryAccumulator(type, col);\n            $wrapper.find('tbody tr:not(.search-hidden)"
ONE_NEW = "            if (!type) return;\n            var acc = penumbraSummaryAccumulator(type, colName || $td.attr('data-sum-col') || colId);\n            $wrapper.find('tbody tr:not(.search-hidden)"

def crlf(s): return s.replace('\r\n', '\n').replace('\n', '\r\n')

def swap(text, a, b, what):
    a, b = crlf(a), crlf(b)
    n = text.count(a)
    if n != 1: raise SystemExit('%s: anchor found %d times, expected 1' % (what, n))
    return text.replace(a, b)

mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src, 'rb').read().decode('utf-8', 'surrogateescape')
if mode == 'forward': text = swap(text, OLD, NEW, 'forward')
elif mode == 'reverse': text = swap(text, NEW, OLD, 'reverse')
elif mode == 'oneliner': text = swap(text, ONE_OLD, ONE_NEW, 'oneliner')
else: raise SystemExit('mode: forward | reverse | oneliner')
open(dst, 'wb').write(text.encode('utf-8', 'surrogateescape'))
print('%s: %s -> %s (%d bytes)' % (mode, src, dst, len(text.encode('utf-8', 'surrogateescape'))))
