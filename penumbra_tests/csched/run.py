# =============================================================================
# CSCHED SUITE (2026-11-01, the card gap list's item 7, part 3) - the scheduled email's cards
#
# A report saved showing cards (viewOptions.cards.open + .sent, js/penumbra_cards.js savedView) emails those cards:
# penumbra_cards_email.php, wired into schedule_runner.php's generate_report_html (the email body alone). test_csched.php
# runs the include on its own (the runner is NEVER required: Oracle and mail) with the runner's delimiter split lifted,
# the real theme registry, and checks the runner's wiring by source; the theme roles' parity with the browser's.
#
#   py -3 run.py                  candidate = LIVE (penumbra_cards_email.php, schedule_runner.php, js/penumbra_cards.js)
#   py -3 run.py --stage DIR      a stage in the app layout (each file from DIR when there, else live)
#   py -3 run.py --control        live: expects every new check red (no include there yet)
#   py -3 run.py --mutants | --mutant NAME     (with --stage DIR: mutate the stage)
# Writes nothing to the webroot (mutants run on copies in %TEMP%).
# =============================================================================
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
ABSENT = {'P-lint-runner'}   # holds on live too
# (cmsize, 2026-11-01) the include is live (csched 4bb5714): the control now expects THIS round's checks red on live and
# every other green; P-budget measures a card by the new layout (either way on live)
NEW = {'P-paritySize', 'P-cols', 'P-compact', 'P-big', 'P-cardThemed', 'P-large', 'P-xlType'}
NEW = set()   # (cmsize is LIVE since 3fd86cf: the control expects every check green)
NEW = {'P-pillThemed', 'P-pillRuled'}   # (cfb8: the pill outlined as on screen)
NEW = set()   # (cfb8 is LIVE since e1c835f: the control expects every check green)
NEW = {'P-cfgSentSize', 'P-notes'}   # (csz: the size shown at save, the notes)
NEW = set()   # (csz is LIVE since 4cda1d2: the control expects every check green)
NEW = {'P-cutNoHeads', 'P-rankFast', 'S-changeNoCards'}   # (cnest sweep: the cut's headings, the rank's search, change analysis as tables)
NEW = set()   # (cnest is LIVE since ab526da: the control expects every check green)
NEW = {'P-pctShown'}   # (csw2: a Percent format's bar by its shown text)
NEW = set()   # (csw2 is LIVE since a7d63c3: the control expects every check green)
NEW = {'P-groupAgg', 'S-aggWired'}   # (cleft: the group summary on the card email's headings)
NEW = set()   # (cleft is LIVE since 4300d47: the control expects every check green)
NEW = {'P-edge', 'P-edgePick'}   # (cedge: the status edge on the scheduled email's cards)
NEW = set()   # (cedge is LIVE since ac211e9: the control expects every check green)
NEW_CPDF = {'P-pdfPages', 'P-pdfPill', 'P-pdfSafe', 'P-pdfBar', 'P-pdfGrouped', 'P-pdfCap', 'P-pdfNone', 'P-pdfFor', 'P-pdfNotes', 'P-pdfRender', 'S-pdfWired',
            'S-pdfChange', 'P-pdfFormat', 'P-pdfArray'}   # (cpdf: the scheduled PDF's cards; the sweep's three)
NEW = NEW | NEW_CPDF   # (cpdf) add, never replace
NEW = NEW - NEW_CPDF   # (cpdf is LIVE since 3c9c516: the control expects every check green)
NEW_CSWEEP3 = {'P-arrayCells', 'P-noWarnings'}   # (csweep3: array cells in the email's and the PDF's cards; P-noWarnings reads live's warning on them)
NEW = NEW | NEW_CSWEEP3   # (csweep3) add, never replace
NEW = NEW - NEW_CSWEEP3   # (csweep3 is LIVE since fb50302: the control expects every check green)
NEW_MAILHID = {'P-hidBlank'}   # (mailhid: a value hidden by its highlight mails blank)
NEW = NEW | NEW_MAILHID   # (mailhid) add, never replace
NEW = NEW - NEW_MAILHID   # (mailhid is LIVE since c4cc721: the control expects every check green)
NEW_PVSCHED = {'P-pvCapture', 'P-pvCaptureHl', 'P-pvTiles', 'P-pvSetup', 'P-pvParent', 'P-pvEmail', 'P-pvEmailHl', 'P-pvEmailSize', 'P-pvEmailCut',
               'P-pvPdfPages', 'P-pvPdfCap', 'P-pvPdfFor', 'P-pvPdfRender', 'P-pvCfg', 'S-pvWired', 'S-pvSaved', 'P-pvEmailHid'}   # (pvsched: a pivot saved showing its tiles; P-pvSame holds on live - no recorder there)
NEW = NEW | NEW_PVSCHED   # (pvsched) add, never replace
NEW = NEW - NEW_PVSCHED   # (pvsched is LIVE since 6636ed1: the control expects every check green)
NEW_HIDFIX = {'P-hidImp', 'P-hidImpFlat', 'P-pvEmailHidImp'}   # (hidfix: a fill ruled "!important" still hides its own colour's text)
NEW = NEW | NEW_HIDFIX   # (hidfix) add, never replace
NEW = NEW - NEW_HIDFIX   # (hidfix is LIVE since 12d2785: the control expects every check green)
NEW_TILEGAP = {'P-pvBlankCol', 'P-pvPdfBlankCol'}   # (tilegap: a blank column keeps its line, as the tile on screen; P-pvBlankColNoLabels holds on live)
NEW = NEW | NEW_TILEGAP   # (tilegap) add, never replace
NEW_PDFGAPS = {'S-pvDropCtx', 'P-pvPdfHid', 'P-pdfLogTable'}   # (pdfgaps: a drop's pivot PDF as tiles; a tile page's hidden value blank; the table's log line)
NEW = NEW | NEW_PDFGAPS   # (pdfgaps) add, never replace
NEW = NEW - NEW_PDFGAPS   # (pdfgaps is LIVE since 0b11424: the control expects every check green)
NEW = NEW - NEW_TILEGAP   # (tilegap is LIVE since 31fc7e8: the control expects every check green)
EITHER = {'P-budget'}
MUTANTS = {
    'm-open': ([('inc', "    if (!$c || empty($c['open']) || !isset($c['sent']) || !is_array($c['sent'])) return null;", "    if (!$c || !isset($c['sent']) || !is_array($c['sent'])) return null;")], ['P-cfgNoOpen']),
    'm-theme': ([('inc', "        $o[$role] = (is_string($v) && preg_match(", "        $o[$role] = (false && preg_match(")], ['P-themeDark', 'P-themeAll']),
    'm-paritydef': ([('inc', "'text' => array('text-main', '#222222')", "'text' => array('text-main', '#000000')")], ['P-parityTheme']),
    'm-cols': ([('inc', "'compact' => array('cols' => 4,", "'compact' => array('cols' => 3,")], ['P-compact', 'P-paritySize']),
    # (cmsize) Large laid out as Standard (the user's report) / the title's type fixed / the padding fixed
    'm-large': ([('inc', "'large' => array('cols' => 2, 'pad' => '14px 16px', 'title' => 15,", "'large' => array('cols' => 2, 'pad' => '11px 12px', 'title' => 13,")], ['P-large', 'P-paritySize']),
    'm-type': ([('inc', "'<div style=\"font-size:' . $ms['title'] . 'px;font-weight:bold;", "'<div style=\"font-size:14px;font-weight:bold;")], ['P-large', 'P-xlType']),
    # (cfb8, the user: the pill not honoured) the pill filled again, no outline
    'm-pill': ([('inc', "'border:1px solid ' . ($ps !== '' ? 'transparent' : $th['text']) . ';' . ($ps !== '' ? $ps : 'color:' . $th['text'] . ';')", "($ps !== '' ? $ps : 'background-color:' . $th['alt'] . ';color:' . $th['text'] . ';')")], ['P-pillThemed', 'P-pillRuled']),
    # (csz) the size shown at save ignored / no notes on the cards
    'm-sentsize': ([('inc', "(isset($x['size']) && in_array($x['size'],", "(false && in_array($x['size'],")], ['P-cfgSentSize']),
    'm-notes': ([('inc', "            if ($notes !== '' && _pnb_cm_text($C($notes)['raw']) !== '') $h .= ", "            if (false) $h .= ")], ['P-notes']),
    'm-pad': ([('inc', "border-radius:8px;padding:' . $ms['pad'] . ';", "border-radius:8px;padding:10px 12px;")], ['P-cardThemed', 'P-large', 'P-xlType']),
    'm-chips': ([('inc', "$id = ($chips && isset($cfg['lists'][$n])) ? $cfg['lists'][$n] : '';", "$id = '';")], ['P-chips']),
    'm-htmlchips': ([('inc', "if ($id === '' || substr($raw, 0, 2) === '@@' || strpos($raw, '<') !== false ||", "if ($id === '' ||")], ['P-chipsHtmlKept']),
    'm-hidden': ([('inc', "    $pick = function ($n) use ($have) { return ($n !== '' && isset($have[$n])) ? $n : ''; };", "    $pick = function ($n) use ($have) { return $n; };")], ['P-noWarnings']),
    'm-budget': ([('inc', "            if ($budget > 0 && $bytes + strlen($card) > $budget) { $cut = true; continue; }\n", "")], ['P-budget']),
    'm-heads': ([('inc', "        if ($sc['name'] !== null) {\n", "        if (false) {\n")], ['P-groupHeads']),
    'm-rank': ([('inc', "    return (($a + $lo - 1) / 2) / ($n - 1) * 100;", "    return $lo / $n * 100;")], ['P-bars', 'P-rankSame']),   # (cnest: re-anchored)
    # (cnest sweep) the cut's headings / the rank's scan back / change analysis as cards
    'cn-heads': ([('inc', "        if ($cut && !$cells) continue;   // (cnest sweep)", "        // (cnest sweep)")], ['P-cutNoHeads']),
    'cn-scan': ([('inc', "    $lo = 0; $hi = $n; while ($lo < $hi) { $md = ($lo + $hi) >> 1; if ($vals[$md] < $v) $lo = $md + 1; else $hi = $md; }", "    $lo = 0; while ($lo < $n && $vals[$lo] < $v) $lo++; for ($w = 0; $w < $n; $w++) { $vals[$w] = $vals[$w]; }")], ['P-rankFast']),
    'cn-change': ([('run', "                    $GLOBALS['penumbra_cards_email'] = null;   // (cnest sweep)", "                    // (cnest sweep)")], ['S-changeNoCards']),
    # (csw2) the bar's shown percentage: not passed / not read
    'w2-pctcall': ([('inc', "$vals, $rc['html']);", "$vals);")], ['P-pctShown']),
    'w2-pctread': ([('inc', "    if ($st !== '' && preg_match", "    if (false && preg_match")], ['P-pctShown']),
    'l3-aggfn': ([('inc', "$_ga = $aggFn ? $aggFn($rows, $path) : null;", "$_ga = null;")], ['P-groupAgg']),   # (cleft)
    'l3-aggdec': ([('inc', "html_entity_decode((string)$_ga, ENT_QUOTES, 'UTF-8')", "(string)$_ga")], ['P-groupAgg']),
    'l3-aggcall': ([('run', "strlen($html)) : 0, $_cardsAgg);", "strlen($html)) : 0);")], ['S-aggWired']),
    'm-labels': ([('inc', "($cfg['nolabels'] ? '' :", "(false ? '' :")], ['P-nolabels']),
    # (cedge) the edge left off / picked by contrast alone / the card's own colour kept
    'ed-pmail': ([('inc', "($eg !== '' ? 'border-left:4px solid ' . _pnb_cm_h($eg) . ';' : '')", "''")], ['P-edge']),
    'ed-pchroma': ([('inc', "        if ($ch >= 24) { if ($ch > $bc) { $bc = $ch; $best = $v; } }\n        elseif ($k > $gk) { $gk = $k; $grey = $v; }\n", "        if ($k > $gk) { $gk = $k; $grey = $v; }\n")], ['P-edgePick']),
    'ed-pown': ([('inc', "        if ($k < 1.05) continue;\n", "")], ['P-edgePick']),
    'm-rowcss': ([('inc', "            $cs = (is_array($f['row']) && isset($f['row']['background-color']))", "            $cs = (false && isset($f['row']['background-color']))")], ['P-rowCss']),
    # schedule_runner.php
    'm-pdf': ([('run', "($isEmail && $viewMode !== 'pivot' && !empty($data)", "($viewMode !== 'pivot' && !empty($data)")], ['S-bodyOnly']),
    'm-guard': ([('run', "function_exists('penumbra_cards_email_cfg') ? penumbra_cards_email_cfg($state) : null;", "penumbra_cards_email_cfg($state);")], ['S-globalGuarded']),
    'm-cell': ([('run', "'html' => penumbra_notes_cell_html(formatCellContent($cellValue), $colName),", "'html' => formatCellContent($cellValue),")], ['S-sameCell']),
    # (cpdf) the cap ignored / its note page gone / the pill or the list left off / a pivot as cards / the plugin's cards
    # mode off / its pages landscape / a site not asking
    'pd-cap': ([('inc', "            if ($shown >= $max) break 2;", "            if (false) break 2;")], ['P-pdfCap']),
    'pd-note': ([('inc', "    if ($cut) {\n        $left = $total - $shown;", "    if (false) {\n        $left = $total - $shown;")], ['P-pdfCap']),
    'pd-pill': ([('inc', "($pw ? '<td width=\"' . $pw . '%\" align=\"center\"", "(false ? '<td width=\"' . $pw . '%\" align=\"center\"")], ['P-pdfPill']),
    'pd-list': ([('inc', "                if ($notes !== '' && strtoupper((string)$col) === $notes) continue;", "                continue;")], ['P-pdfPages']),
    'pd-pivot': ([('inc', "    if ($viewMode === 'pivot') return penumbra_cards_pdf_tiles_for($data, $reportTitle);", "    if (false) return penumbra_cards_pdf_tiles_for($data, $reportTitle);")], ['P-pdfFor', 'P-pvPdfFor']),   # (pvsched: re-aimed at the pivot's route)
    'pd-mode': ([('pdf', "        if (!empty($cardPages)) {", "        if (false) {")], ['P-pdfRender']),
    'pd-land': ([('pdf', "                $pdf->AddPage('P');", "                $pdf->AddPage();")], ['P-pdfRender']),
    'pd-site': ([('run', "                                            'card_pages' => (function_exists('penumbra_cards_pdf_for') ? penumbra_cards_pdf_for($prData, $prViewMode, $reportTitle) : null)   // (cpdf)\n", "")], ['S-pdfWired']),
    # (cpdf sweep) a recipient's change analysis as cards / the column format skipped / an array cell warning again
    'pd-change': ([('run', "                                        $GLOBALS['penumbra_cards_email'] = null;   // (cpdf sweep) this recipient's was/now tables, never cards (as the broadcast's)\n", "")], ['S-pdfChange']),
    'pd-format': ([('inc', "        if (function_exists('penumbra_email_cell_format')) $raw = penumbra_email_cell_format(strtoupper((string)$col), $raw);", "        //")], ['P-pdfFormat']),
    'pd-array': ([('inc', "    $s = is_array($raw) ? (string)json_encode($raw) : (string)$raw;", "    $s = (string)$raw;")], ['P-noWarnings']),
    # (csweep3) an empty array read as a value again / the email card's value cast on an array again
    'w3-emptyarr': ([('inc', "    if (is_array($raw) && !$raw) return '';", "    if (false) return '';")], ['P-arrayCells']),
    'w3-valarr': ([('inc', "                if (is_array($c['raw'])) return '<span style=\"' . $st . '\">' . $c['html'] . '</span>';", "                if (false) return '';")], ['P-arrayCells', 'P-noWarnings']),
    # (pvsched) the record off / no value recorded / no highlight / no Grand Total / the HTML touched while recording
    'ps-cap': ([('run', "    $_pcap = (isset($GLOBALS['penumbra_pivot_capture']) && is_array($GLOBALS['penumbra_pivot_capture']))", "    $_pcap = (false && is_array($GLOBALS['penumbra_pivot_capture']))")], ['P-pvCapture', 'P-pvTiles']),
    'ps-cell': ([('run', "if ($_pcap !== null) { $_pcb = \"{$tdDataCss} background-color: {$bg};\"; $_pcap['rows'][$rowIndex]['cells'][] = array(", "if (false) { $_pcb = \"{$tdDataCss} background-color: {$bg};\"; $_pcap['rows'][$rowIndex]['cells'][] = array(")], ['P-pvCapture', 'P-pvTiles']),
    'ps-hl': ([('run', "'hl' => (strpos($cellStyle, $_pcb) === 0) ? substr($cellStyle, strlen($_pcb)) : ''); }", "'hl' => ''); }")], ['P-pvCaptureHl', 'P-pvEmailHl']),
    'ps-foot': ([('run', "if ($_pcap !== null) { if (!empty($_actG['noFooter'])) $_pcap['foot'] = null; $GLOBALS['penumbra_pivot_capture'] = $_pcap; }", "if ($_pcap !== null) { $_pcap['foot'] = null; $GLOBALS['penumbra_pivot_capture'] = $_pcap; }")], ['P-pvCapture', 'P-pvTiles']),
    'ps-same': ([('run', "        if ($_pcap !== null) $_pcap['foot']['label'] = $colTotalLabel;", "        if ($_pcap !== null) $html .= ' ';")], ['P-pvSame']),
    # the setup's big number / bar scale / parent pill / measures picked; no Grand Total tile
    'ps-big': ([('inc', "        if ($bm >= 0) { $bc = _pnb_pv_total($r, $bm);", "        if (false) { $bc = _pnb_pv_total($r, $bm);")], ['P-pvSetup']),
    'ps-bar': ([('inc', "    sort($scale);\n", "    $scale = array();\n")], ['P-pvSetup']),
    'ps-parent': ([('inc', "        if ($cfg['pill'] === 'parent' && $sub !== '') {", "        if (false) {")], ['P-pvParent']),
    'ps-fields': ([('inc', "            if ($only !== null && !in_array((int)$c['agg'], $only, true)) continue;\n", "")], ['P-pvSetup']),
    'ps-gtlast': ([('inc', "        $tiles[] = array('title' => $ft, 'sub' => '', 'pill' => null,", "        if (false) $tiles[] = array('title' => $ft, 'sub' => '', 'pill' => null,")], ['P-pvTiles']),
    # the email: the size saved / the budget's cut; the PDF's cap; the saved setup: open, the tiles the saver saw
    'ps-size': ([('inc', "    $sz = (is_array($cfg) && isset($GLOBALS['PENUMBRA_CARDS_MAIL_SIZE'][$cfg['size']])) ? $cfg['size'] : 'standard';", "    $sz = 'standard';")], ['P-pvEmailSize']),
    'ps-hid': ([('inc', "(_pnb_cm_hid(_pnb_pv_cssarr($fd['css'])) ? '&nbsp;' :", "(false ? '&nbsp;' :")], ['P-pvEmailHid']),   # (pvsched) mailhid's rule off on the tiles
    'ps-cut': ([('inc', "        if ($budget > 0 && $bytes + strlen($one) > $budget) { $cut = true; continue; }\n", "")], ['P-pvEmailCut']),
    'ps-pdfcap': ([('inc', "        if ($n === $lim) break;", "        if (false) break;")], ['P-pvPdfCap']),
    'ps-open': ([('inc', "    if (!$c || empty($c['open'])) return null;\n    $saw =", "    if (!$c) return null;\n    $saw =")], ['P-pvCfg']),
    'ps-saw': ([('inc', "    $src = $saw ? $saw :", "    $src = false ? $saw :")], ['P-pvCfg']),
    # the runner's wiring: the body / the task's context / its reset / the saved setup per task; the browser's Save
    'ps-body': ([('run', "        $_tilesHere = penumbra_cards_pivot_tiles($data, $pivotSettings, $themeName, $formatRules, $rewriteRules);", "        $_tilesHere = null;")], ['S-pvWired']),
    'ps-ctx': ([('run', "                $GLOBALS['penumbra_cards_tiles_ctx'] = array('settings' =>", "                $GLOBALS['penumbra_cards_tiles_ctxX'] = array('settings' =>")], ['S-pvWired']),
    'ps-reset': ([('run', "            $GLOBALS['penumbra_cards_tiles_ctx'] = null;   // (pvsched) this task's pivot context", "            // (pvsched) this task's pivot context")], ['S-pvWired']),
    'ps-cfgline': ([('run', "    $GLOBALS['penumbra_cards_tiles'] = function_exists('penumbra_cards_tiles_cfg') ? penumbra_cards_tiles_cfg($state) : null;", "    $GLOBALS['penumbra_cards_tiles'] = null;")], ['S-pvWired']),
    'ps-saved': ([('cjs', "return { open: 1, tiles: tv }; }", "return { open: 1 }; }")], ['S-pvSaved']),
}

MUTANTS.update({
    # (mailhid) a hidden value drawn as before (the square) / every two-colour value blanked
    'm-hid': ([('inc', "                if (_pnb_cm_hid($c['css'])) return '&nbsp;';", "                if (false) return '&nbsp;';")], ['P-hidBlank']),
    'm-hideq': ([('inc', "return $c !== '' && $c === strtolower(", "return $c !== '' && '' !== strtolower(")], ['P-hidKept']),
    # (hidfix) the priority kept on the fill: it never equals its text
    'hf-imp': ([('inc', "    $css = array('color' => preg_replace(", "    $cssOff = array('color' => preg_replace(")], ['P-hidImp', 'P-hidImpFlat', 'P-pvEmailHidImp']),
    # (tilegap) the email skips a blank column again / lists it with no labels too / the PDF skips it
    'tg-mail': ([('inc', "            if ($fv === '' && $nol) continue;", "            if ($fv === '') continue;")], ['P-pvBlankCol']),
    'tg-nol': ([('inc', "            if ($fv === '' && $nol) continue;", "            if (false && $nol) continue;")], ['P-pvBlankColNoLabels']),
    'tg-pdf': ([('inc', "            // (tilegap) a column with no value keeps its row, blank,", "            if ($fv === '') continue; // (tilegap) a column with no value keeps its row, blank,")], ['P-pvPdfBlankCol']),
    # (pdfgaps) the drop records no context / a tile page prints a hidden value / the table's line logged under card pages
    'pg-drop': ([('run', "$GLOBALS['penumbra_cards_tiles_ctx'] = array('theme' => $themeName,", "$GLOBALS['penumbra_cards_tiles_ctxX'] = array('theme' => $themeName,")], ['S-pvDropCtx']),
    'pg-pdfhid': ([('inc', "(_pnb_cm_hid(_pnb_pv_cssarr($fd['css'])) ? '' : _pnb_cm_h($fv)) . '</td></tr>';", "(_pnb_cm_h($fv)) . '</td></tr>';")], ['P-pvPdfHid']),
    'pg-log': ([('pdf', "        if (function_exists('log_scheduler') && empty($options['card_pages'])) {", "        if (function_exists('log_scheduler')) {")], ['P-pdfLogTable']),
})

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
root = APP if control else (stage_dir or APP)
def pick(rel):
    p = os.path.join(root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {'inc': pick('penumbra_cards_email.php'), 'run': pick('schedule_runner.php'), 'cjs': pick(os.path.join('js', 'penumbra_cards.js'))}
cand['pdf'] = pick(os.path.join('plugins', 'pdf_generator.php'))   # (cpdf) the PDF plugin under test (its cards mode)
TCPDF = os.path.join(APP, 'plugins', 'lib', 'tcpdf', 'tcpdf.php')   # (cpdf) live's TCPDF behind it
THM = os.path.join(APP, 'themes_config.php'); SRCH = os.path.join(APP, 'penumbra_search.php')

def run_test(paths):
    # (cpdf) TCPDF on PHP 8 reads curl's constants: the extension loaded for the render (production's php82 has it)
    out = subprocess.run([PHP, '-n', '-d', 'extension_dir=' + os.path.dirname(PHP).replace(chr(92), '/') + '/ext', '-d', 'extension=curl', os.path.join(HERE, 'test_csched.php'), paths['inc'], paths['run'], THM, SRCH, paths['cjs'], paths['pdf'], TCPDF], capture_output=True, text=True, encoding='utf-8', errors='replace')
    res = []
    for line in (out.stdout or '').splitlines():
        m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)', line)
        if m: res.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
    if not res: res.append(('F-run', False, ((out.stdout or '') + (out.stderr or ''))[-600:]))
    res += run_pvtiles(paths)   # (pvsched) a pivot's tiles: the candidate runner's mirror + the include
    return res

# (pvsched) test_pvtiles.php over a MIRROR of the candidate runner (its functions alone: pivotparity's extractor, never the
# runner itself - Oracle, mail), in its own PHP (its stand-ins are not test_csched.php's)
EXTRACT = os.path.join(os.path.dirname(HERE), 'pivotparity', 'extract_mirror.php')
if not os.path.exists(EXTRACT): EXTRACT = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'   # (a kit's copy of the suite)
def run_pvtiles(paths):
    d = tempfile.mkdtemp(prefix='pnb_pvt_')
    try:
        os.makedirs(os.path.join(d, 'log'), exist_ok=True)   # the mirror's log_scheduler writes beside itself
        mir = os.path.join(d, 'mirror.php')
        e = subprocess.run([PHP, '-n', EXTRACT, paths['run'], mir], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if not os.path.exists(mir): return [('F-pvmirror', False, ((e.stdout or '') + (e.stderr or ''))[-400:])]
        out = subprocess.run([PHP, '-n', '-d', 'extension_dir=' + os.path.dirname(PHP).replace(chr(92), '/') + '/ext', '-d', 'extension=curl', os.path.join(HERE, 'test_pvtiles.php'),
                              mir, paths['inc'], THM, SRCH, paths['run'], paths['pdf'], TCPDF, paths['cjs']], capture_output=True, text=True, encoding='utf-8', errors='replace')
        res = []
        for line in (out.stdout or '').splitlines():
            m = re.match(r'\s+(PASS|FAIL)\s+(\S+)\s*(.*)', line)
            if m: res.append((m.group(2), m.group(1) == 'PASS', m.group(3)))
        if not res: res.append(('F-pvrun', False, ((out.stdout or '') + (out.stderr or ''))[-600:]))
        return res
    finally:
        shutil.rmtree(d, ignore_errors=True)

def mutated(name):
    d = tempfile.mkdtemp(prefix='pnb_csched_')
    paths = {}
    for k, p in cand.items():
        dst = os.path.join(d, k + os.path.splitext(p)[1]); shutil.copyfile(p, dst); paths[k] = dst
    for f, old, new in MUTANTS[name][0]:
        t = open(paths[f], 'rb').read().decode('utf-8', 'surrogateescape')
        o = old.replace('\n', '\r\n') if (f == 'run' and '\r\n' in t) else old
        n = new.replace('\n', '\r\n') if (f == 'run' and '\r\n' in t) else new
        if t.count(o) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t.count(o), old[:80]))
        open(paths[f], 'wb').write(t.replace(o, n).encode('utf-8', 'surrogateescape'))
    return d, paths

print('candidate: %s' % cand)
if all_mutants or one_mutant:
    okc = bad = 0
    for m in ([one_mutant] if one_mutant else list(MUTANTS)):
        d, paths = mutated(m)
        try: res = run_test(paths)
        finally: shutil.rmtree(d, ignore_errors=True)
        red = [a for a, p, _ in res if not p]
        must = MUTANTS[m][1]
        good = not [x for x in must if x not in red]
        okc += good; bad += (not good)
        print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
    print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
    print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
else:
    res = run_test(cand)
    p = f = 0; failed = []
    for a, passed, d in res:
        print('  %s  %-26s %s' % ('PASS' if passed else 'FAIL', a, d[:300]))
        if passed: p += 1
        else: f += 1; failed.append(a)
    print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
    if control:
        seen = {a for a, _, _ in res}
        new_green = sorted(a for a, passed, _ in res if passed and a in NEW)
        old_red = sorted(a for a, passed, _ in res if not passed and a not in NEW and a not in EITHER)
        unseen = sorted(NEW - seen)
        print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
        print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
        print('CONTROL: new checks not seen: %s' % (' '.join(unseen) or 'none'))
        print('RESULT: GREEN' if not new_green and not old_red and not unseen else 'RESULT: RED')
    else:
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
