# =============================================================================
# VIEW OPTIONS LAYOUT SUITE (2026-09-25)
#
# View Options > End-User UI Options: every .view-option-item card puts its
# checkbox IN LINE with the title and runs the description under both at the
# card's full width (the label is a two-column grid, .view-option-text is
# display:contents), which lets the 12 cards - the eleven options (Search Bar, the
# twelfth, came 2026-09-25 evening) plus Bare Header, moved there from under the
# Layout radios - share ONE row from 1624px of grid width. Narrower, @container pnb-vo-eu (on the new .view-options-eu wrapper)
# picks 6 / 4 / 3 / 2 columns so no card is left alone on a row. The column
# heading "Header Layout" became "Layout". Later the same day (voradios): the
# three Layout radios got the same in-line card and share one row from a 376px
# column, and the subtitle label's "see Custom Code help" moved into the
# field's placeholder.
#
#   static half   the index.php under test: S1 the Layout heading, S2 the grid in
#                 its container wrapper with the 12 cards in order, S3 the Bare
#                 Header card (last, unchecked, the old spot gone), S4 the wrap
#                 point in Export/<wbr>Download, S5 the subtitle pointer.
#   browser half  #view-options-tab LIFTED from that index.php into vo.html, under
#                 index.php's <link> set with the css\main.css under test, in
#                 headless Edge over CDP (cdp.py - real layout, real mouse + keys):
#                 wide at 1677px (W1-W10 + WL1-WL3, the radios: the docked console
#                 on a 1080p screen), compact (C1-C6 + CL1-CL3), dark (D1-D6 +
#                 DL1-DL4), 13 widths (N2317..N399 for the grid, NL for the radios)
#                 + NW + NS1293 (the subtitle label on one line), input (R1-R5:
#                 real clicks, Space, the accessibility tree's name) and a fixture
#                 card (F1). 71 asserts. vo.html switches transitions OFF: its
#                 stylesheets load after the markup, and the Custom Sort button's
#                 `transition: all` would otherwise be measured mid-flight.
#
#   run.ps1                      live files          EXPECTED: GREEN 81 / 0 (71 before Preset Sharing, 2026-10-22)
#   run.ps1 -Control             the .bak-20260925-voptions files (the build
#                                before any of it)   EXPECTED: RED - see CONTROL below
#   run.ps1 -IndexPhp <p> -MainCss <p>   any other copies (a stage build)
#   run.ps1 -Mutant <name>       ONE rule broken, on the feature build
#   run.ps1 -Mutants             every mutant, each checked against the asserts it
#                                MUST turn red. A mutant that stays green = asserts
#                                that do not bite. (About a minute apiece.)
#   run.ps1 -CheckAnchors        only checks that every mutant's anchor occurs exactly
#                                once in the build under test (-Mutants does it first).
#   -Keep keeps the staging dir (and writes wide.png there).  -Here <dir> runs a copy.
#
# CONTROL (measured 2026-09-25 against the build before any of it): RED 16 / 52 -
# static 0 / 5, browser 16 / 47. What passes there is what the old layout already
# did: nothing overflowing (W4 C4 D4, WL3 CL3 DL3), titles within two lines (W6),
# the compact box in line (C2) and equal compact heights (C5), the dark colours
# (D6 DL4), and the radios' row count where the old 200px floor gave the same
# answer (NL2317 one row; NL536..NL399 one per row). The input phase stops at R1
# (the old box is not a card). The .bak-20260925-voradios build (the morning's
# cards with the old radios and subtitle label) fails EXACTLY the 18 radio /
# subtitle asserts: S5 WL1 WL2 W9 CL1 CL2 C6 DL1 DL2 NS1293 and NL1600..NL807.
# 24 mutants, all bite (-Mutants). PRESET SHARING (2026-10-22) made it 13 cards: 7 + 6 below 1760px, 5 + 5 + 3
# below 944px, the card left over spanning its row at 4 / 3 / 2 columns; S6 (the card is opt-in), NC944
# (checkbox in line with WRAPPED titles - at 1677px every title is one line now, so cbcenter bites there),
# grid-auto-rows: 1fr (C5) and the W9 / C6 budgets for two rows. 28 mutants, all bite.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\voptions'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Needs py -3 with websocket-client and the PHP 8.2 CLI (for the theme registry).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$IndexPhp = '', [string]$MainCss = '', [string]$App = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$CheckAnchors, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\voptions' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$stamp = '.bak-20260925-voptions'

if ($Control) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $IndexPhp = Resolve-Bak "$app\index.php$stamp"; $MainCss = Resolve-Bak "$app\css\main.css$stamp"
  if (-not $IndexPhp -or -not $MainCss) { throw "-Control needs the pre-change files (*$stamp); before the deploy pass -IndexPhp / -MainCss" }
}
$idxPath = if ($IndexPhp) { $IndexPhp } else { "$app\index.php" }
$cssPath = if ($MainCss) { $MainCss } else { "$app\css\main.css" }
$idx0 = [IO.File]::ReadAllText($idxPath, $utf8)
$css0 = [IO.File]::ReadAllText($cssPath, $utf8)

# --- mutants: ONE rule broken each. css\main.css is CRLF, index.php LF. Every
# edit string is built first: in PowerShell `'a' + 'b', 'c'` is 'a' + ('b','c').
$C = "`r`n"; $L = "`n"
$mBareCard = '                <div class="view-option-item"><label><input type="checkbox" id="viewOptionBareHeader"><div class="view-option-text"><strong>Bare Header</strong><small>Header without its card, crumb or watermark. Applies to everyone.</small></div></label></div>' + $L
$mBareSpan = $mBareCard.Replace('<label>', '<span>').Replace('</label>', '</span>')
$mSplitEnd = 'table on the left, snippets on the right.</small></label>' + $L + '                    </div>' + $L
$mOldBare  = $mSplitEnd + '                    <label class="header-layout-option header-bare-option"><input type="checkbox" id="viewOptionBareHeader"> <strong>Bare header</strong> <small>Any layout, without the frame: hides the breadcrumb, card, accent stripe, watermark and the header''s show/hide tab.</small></label>' + $L
$mEuOpen   = '            <div class="view-options-eu">' + $L
$mEuClose  = '            </div>' + $L + '            </div>' + $L + '            <?php /* Bare Header'
$mEuClose1 = '            </div>' + $L + '            <?php /* Bare Header'
$mContents = '.view-option-text {' + $C + '    display: contents;'
$mBlock    = '.view-option-text {' + $C + '    display: block;'
$mTitle    = '.view-option-item strong {' + $C + '    display: block;' + $C + '    font-size: 1.05em;'
$mTitle11  = '.view-option-item strong {' + $C + '    display: block;' + $C + '    font-size: 1.1em;'
$mAlign    = '    align-items: start;' + $C + '    overflow-wrap: anywhere;'
$mCenter   = '    align-items: center;' + $C + '    overflow-wrap: anywhere;'
$mNoWrap   = '    align-items: start;'
$mCompact  = '.compact-admin-mode .view-options-grid {' + $C + '    gap: 6px;' + $C + '    margin-top: 6px;' + $C + '}'
$mCompact2 = '.compact-admin-mode .view-options-grid {' + $C + '    gap: 6px;' + $C + '    margin-top: 6px;' + $C + '    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));' + $C + '}'
$mCbNudge  = '.view-option-item input[type="checkbox"] {' + $C + '    margin: 1.5px 0 0;'
$mCbNudge5 = '.view-option-item input[type="checkbox"] {' + $C + '    margin: 5px 0 0;'
$mRdGrid   = '.header-layout-option {' + $C + '    display: grid;'
$mRdFlex   = '.header-layout-option {' + $C + '    display: flex;'
$mRdMin    = '    box-sizing: border-box;' + $C + '    min-width: 120px;'
$mRdMin200 = '    box-sizing: border-box;' + $C + '    min-width: 200px;'
$mRdMinCb  = '    min-width: 120px;'
$mRdAlign  = '    align-items: start;' + $C + '    align-content: start;'
$mRdAlign0 = '    align-items: start;'
$mRdNudge  = '.header-layout-option input[type="radio"] {' + $C + '    margin: 1.5px 0 0;'
$mRdNudge5 = '.header-layout-option input[type="radio"] {' + $C + '    margin: 5px 0 0;'
$mRdCompact = '.compact-admin-mode .header-layout-option input[type="radio"] {' + $C + '    margin-top: 0;' + $C + '}' + $C
$mSubLabel  = 'html and snippet functions allowed):</label>'
$mSubLabel0 = 'html and snippet functions allowed -- see Custom Code help for snippet functions):</label>'
$mFloor    = '.view-options-grid {' + $C + '    display: grid;' + $C + '    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));'
$mAutoRows = '    grid-auto-rows: 1fr;' + $C
$mFloor190 = '.view-options-grid {' + $C + '    display: grid;' + $C + '    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));'
$mContainer = '    container: pnb-vo-eu / inline-size;' + $C
$m7col     = '    .view-options-eu > .view-options-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }' + $C
$m5col     = '    .view-options-eu > .view-options-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }' + $C
$mSpan4    = '    .view-options-eu > .view-options-grid > .view-option-item:last-child:nth-child(4n+1) { grid-column: 1 / -1; }' + $C
$m4col     = '    .view-options-eu > .view-options-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }' + $C
$m3col     = '    .view-options-eu > .view-options-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }' + $C
$m2col     = '    .view-options-eu > .view-options-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }' + $C
$mLayoutH  = $L + '                        Layout' + $L + '                    </h4>'
$mHeaderH  = $L + '                        Header Layout' + $L + '                    </h4>'
$mutantDefs = [ordered]@{
  'nocontents'      = @{ target = 'css'; edits = @(,@($mContents, $mBlock)); red = @('W3', 'C3', 'D3', 'W10') }
  # (13 cards) below 1760px the container rules decide the columns, so the floor shows only where auto-fit rules.
  'floor190'        = @{ target = 'css'; edits = @(,@($mFloor, $mFloor190)); red = @('N2317', 'N1760') }
  # With NO container rules, plain auto-fit happens to give the same balanced
  # rows at 535 / 400 / 399px (3, 3, 2 columns), so those widths stay green
  # there - an equivalent case, not a gap: no3col / no2col pin those two rules,
  # which exist because the <=807px 4-column rule would otherwise hold all the
  # way down.
  'nocontainer'     = @{ target = 'css'; edits = @(,@($mContainer, '')); red = @('N1759', 'N1293', 'N943') }
  'no7col'          = @{ target = 'css'; edits = @(,@($m7col, '')); red = @('N1759', 'N1293') }
  'noautorows'      = @{ target = 'css'; edits = @(,@($mAutoRows, '')); red = @('C5') }
  'no5col'          = @{ target = 'css'; edits = @(,@($m5col, '')); red = @('N943', 'N808') }
  'nospan4'         = @{ target = 'css'; edits = @(,@($mSpan4, '')); red = @('N671', 'N536') }
  'no4col'          = @{ target = 'css'; edits = @(,@($m4col, '')); red = @('N671', 'N536') }
  'no3col'          = @{ target = 'css'; edits = @(,@($m3col, '')); red = @('N535', 'N400') }
  'no2col'          = @{ target = 'css'; edits = @(,@($m2col, '')); red = @('N399') }
  # Twelve cards (2026-09-25): every title may take two lines now, so a bigger
  # title shows as HEIGHT - the grid's budget (W9) - not as a third line (W6).
  'title11'         = @{ target = 'css'; edits = @(,@($mTitle, $mTitle11)); red = @('W9') }
  'cbnudge'         = @{ target = 'css'; edits = @(,@($mCbNudge, $mCbNudge5)); red = @('W2', 'D2') }
  # (13 cards) every title is one line at 1677px, so centring is invisible there: NC944 holds it.
  'cbcenter'        = @{ target = 'css'; edits = @(,@($mAlign, $mCenter)); red = @('NC944') }
  'compactcols'     = @{ target = 'css'; edits = @(,@($mCompact, $mCompact2)); red = @('C1') }
  'nooverflowwrap'  = @{ target = 'css'; edits = @(,@($mAlign, $mNoWrap)); red = @('F1') }
  'nowbr'           = @{ target = 'idx'; edits = @(,@('<strong>Export/<wbr>Download</strong>', '<strong>Export/Download</strong>')); red = @('S4', 'NW') }
  'headerlayout'    = @{ target = 'idx'; edits = @(,@($mLayoutH, $mHeaderH)); red = @('S1', 'W8') }
  'nowrapper'       = @{ target = 'idx'; edits = @(@($mEuOpen, ''), @($mEuClose, $mEuClose1)); red = @('S2', 'N1759', 'N1293', 'N943') }
  'bareunderradios' = @{ target = 'idx'; edits = @(@($mBareCard, ''), @($mSplitEnd, $mOldBare)); red = @('S2', 'S3', 'W1', 'W7', 'W8', 'W9') }
  'presetsharingon' = @{ target = 'idx'; edits = @(,@('<input type="checkbox" id="viewOptionPresetSharing">', '<input type="checkbox" id="viewOptionPresetSharing" checked>')); red = @('S6') }
  'nolabel'         = @{ target = 'idx'; edits = @(,@($mBareCard, $mBareSpan)); red = @('R1', 'R3', 'R5') }
  # --- the Layout radios + the subtitle label (2026-09-25 pm) ---
  'radioflex'       = @{ target = 'css'; edits = @(,@($mRdGrid, $mRdFlex)); red = @('WL2', 'CL2', 'DL2') }
  'radiomin200'     = @{ target = 'css'; edits = @(,@($mRdMin, $mRdMin200)); red = @('WL1', 'CL1', 'DL1', 'NL1293', 'NL1168') }
  'radiocontentbox' = @{ target = 'css'; edits = @(,@($mRdMin, $mRdMinCb)); red = @('NL1293', 'NL1168') }
  'radiostretch'    = @{ target = 'css'; edits = @(,@($mRdAlign, $mRdAlign0)); red = @('WL2', 'DL2') }
  'radionudge'      = @{ target = 'css'; edits = @(,@($mRdNudge, $mRdNudge5)); red = @('WL2', 'DL2') }
  'radiocompact'    = @{ target = 'css'; edits = @(,@($mRdCompact, '')); red = @('CL2') }
  'subtitlelabel'   = @{ target = 'idx'; edits = @(,@($mSubLabel, $mSubLabel0)); red = @('S5', 'NS1293') }
}
function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- static half: the index.php under test -------------------------------------
function Test-Static([string]$idx) {
  $out = @()
  $hasLayout = [regex]::IsMatch($idx, '<h4[^>]*>\s*Layout\s*</h4>')
  $hasOld = [regex]::IsMatch($idx, '<h4[^>]*>\s*Header Layout\s*</h4>')
  $out += [pscustomobject]@{ id = 'S1'; name = 'the layout column is headed "Layout" (no "Header Layout" heading left)'; pass = $hasLayout -and -not $hasOld; detail = "Layout=$hasLayout HeaderLayout=$hasOld" }
  $eu = $idx.IndexOf('<div class="view-options-eu">')
  $next = if ($eu -ge 0) { $idx.IndexOf('<!-- Phase 2: Report Journal row features', $eu) } else { -1 }
  $ids = @(); $gridFirst = $false
  if ($eu -ge 0 -and $next -gt $eu) {
    $blk = $idx.Substring($eu, $next - $eu)
    $ids = @([regex]::Matches($blk, 'id="viewOption(\w+)"') | ForEach-Object { $_.Groups[1].Value })
    $gridFirst = [regex]::IsMatch($blk, '^<div class="view-options-eu">\s*<div class="view-options-grid">')
  }
  $want = 'Search,Snapshots,Email,Grouping,Clipboard,Export,Pivot,Viz,Pagination,Journal,PresetSharing,Columns,BareHeader'
  $out += [pscustomobject]@{ id = 'S2'; name = 'the End-User grid sits in .view-options-eu (the container its columns query) with the 13 cards in order (Search Bar first, Preset Sharing after Report Journal)'; pass = $gridFirst -and (($ids -join ',') -eq $want); detail = "wrapper@$eu gridFirst=$gridFirst ids=$($ids -join ',')" }
  $card = [regex]::Match($idx, '(?s)<div class="view-option-item"><label><input type="checkbox" id="viewOptionBareHeader">.*?</label></div>')
  $oldSpot = $idx.Contains('header-bare-option')
  $lastOk = ($ids.Count -gt 0) -and ($ids[$ids.Count - 1] -eq 'BareHeader')
  $out += [pscustomobject]@{ id = 'S3'; name = 'Bare Header is a card, the grid''s last, unchecked by default, and its old spot under the radios is gone'; pass = $card.Success -and ($card.Value -notmatch '\bchecked\b') -and $lastOk -and -not $oldSpot; detail = "card=$($card.Success) last=$lastOk oldSpot=$oldSpot" }
  $wbr = $idx.Contains('<strong>Export/<wbr>Download</strong>')
  $out += [pscustomobject]@{ id = 'S4'; name = 'Export/<wbr>Download carries its wrap point (it can break at the slash)'; pass = $wbr; detail = "wbr=$wbr" }
  # 2026-09-25 pm: the subtitle label's "see Custom Code help" moved into the
  # field's placeholder, so the label fits one line at 125% scaling.
  $sLab = [regex]::Match($idx, '<label for="reportSubtitle"[^>]*>([^<]*)</label>')
  $sPh = [regex]::Match($idx, '<textarea id="reportSubtitle" placeholder="([^"]*)"')
  $sOk = $sLab.Success -and $sPh.Success -and ($sLab.Groups[1].Value -notmatch 'Custom Code help') -and ($sPh.Groups[1].Value -match 'see Custom Code help for snippet functions')
  $out += [pscustomobject]@{ id = 'S5'; name = 'the subtitle''s "see Custom Code help" pointer lives in its placeholder, not its label'; pass = $sOk; detail = "label=[$($sLab.Groups[1].Value)] placeholder=[$($sPh.Groups[1].Value)]" }
  # (2026-10-22) Preset Sharing is OPT-IN like the journal: unchecked in the markup.
  $ps = [regex]::Match($idx, '<input type="checkbox" id="viewOptionPresetSharing"([^>]*)>')
  $out += [pscustomobject]@{ id = 'S6'; name = 'the Preset Sharing card is opt-in (unchecked by default)'; pass = $ps.Success -and ($ps.Groups[1].Value -notmatch '\bchecked\b'); detail = "found=$($ps.Success) attrs=[$($ps.Groups[1].Value)]" }
  return ,$out
}

# --- browser half: every case in ONE headless Edge ----------------------------
function Invoke-Browser([string]$idxText, [string]$cssText, [bool]$shot) {
  $run = Join-Path $env:TEMP ('pnb_vopt_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force "$run\css" | Out-Null
  foreach ($f in @('jquery-ui.css', 'penumbra_tiles.css', 'density.css', 'search_builder.css', 'penumbra_presets.css', 'penumbra_colwidths.css')) { Copy-Item "$app\css\$f" "$run\css\$f" -Force }
  [IO.File]::WriteAllText("$run\main.css", $cssText, $utf8)
  [IO.File]::WriteAllText("$run\index.php", $idxText, $utf8)
  foreach ($f in @('vo.html', 'cdp.py', 'gen.php')) { Copy-Item "$here\$f" "$run\$f" -Force }
  $gen = & $php -n "$run\gen.php" $run $app 2>&1
  if (-not (Test-Path "$run\themes.js")) { throw "gen.php wrote no themes.js: $gen" }
  $cases = New-Object System.Collections.ArrayList
  $wide = @{ name = 'wide'; query = 'phase=wide&w=1677&theme=theme-hello-kitty' }
  if ($shot) { $wide.shot = "$run\wide.png" }
  [void]$cases.Add($wide)
  [void]$cases.Add(@{ name = 'compact'; query = 'phase=compact&w=1677&compact=1&theme=theme-hello-kitty' })
  [void]$cases.Add(@{ name = 'dark'; query = 'phase=dark&w=1677&theme=theme-wolfpack-dark' })
  # width = End-User grid rows | Layout radio rows (one row from a 376px Layout
  # column = a 1168px tab; Split under the other two from 248px = 784px).
  # Twelve cards (Search Bar, 2026-09-25): one row from 1624px, then 6 + 6 /
  # 4 + 4 + 4 / 3 x 4 / 2 x 6 - twelve divides evenly at every step.
  # Thirteen (Preset Sharing, 2026-10-22): one row from 1760px, 7 + 6 down to 944px, 5 + 5 + 3 down to
  # 672px, then 4 / 3 / 2 columns with the card left over spanning its row (the trailing 1).
  $widths = [ordered]@{ '2317' = '13|1'; '1760' = '13|1'; '1759' = '7,6|1'; '1600' = '7,6|1'; '1293' = '7,6|1'; '1168' = '7,6|1'; '1167' = '7,6|2'; '944' = '7,6|2'; '943' = '5,5,3|2'; '808' = '5,5,3|2'; '807' = '5,5,3|2'; '672' = '5,5,3|3'; '671' = '4,4,4,1|3'; '536' = '4,4,4,1|3'; '535' = '3,3,3,3,1|3'; '400' = '3,3,3,3,1|3'; '399' = '2,2,2,2,2,2,1|3' }
  foreach ($w in $widths.Keys) {
    $parts = $widths[$w].Split('|')
    $q = "phase=width&w=$w&rows=$($parts[0])&lrows=$($parts[1])&theme=theme-hello-kitty"
    if ($w -eq '1760') { $q += '&wbr=1' }   # the narrowest one-row cards: Export/Download wraps there
    if ($w -eq '1293') { $q += '&sub1=1' }
    if ($w -eq '944') { $q += '&cb=1' }   # the narrowest 7-column cards: titles wrap there
    [void]$cases.Add(@{ name = "w$w"; query = $q })
  }
  [void]$cases.Add(@{ name = 'input'; query = 'phase=input&w=1677&theme=theme-hello-kitty' })
  [void]$cases.Add(@{ name = 'fixture'; query = 'phase=fixture&w=1624&theme=theme-hello-kitty' })
  $jobs = @{ base = ('file:///' + ($run -replace '\\', '/') + '/vo.html'); viewport = @(2400, 1000); cases = $cases }
  [IO.File]::WriteAllText("$run\jobs.json", ($jobs | ConvertTo-Json -Depth 6), $utf8)
  $pyOut = & py -3 "$run\cdp.py" "$run\jobs.json" "$run\results.json" 2>&1
  if (-not (Test-Path "$run\results.json")) { throw "cdp.py wrote no results: $pyOut" }
  $res = [IO.File]::ReadAllText("$run\results.json", $utf8) | ConvertFrom-Json
  $out = @()
  foreach ($rec in $res) {
    foreach ($a in @($rec.result.asserts)) {
      if ($null -eq $a) { continue }
      $out += [pscustomobject]@{ id = $a.id; name = $a.name; pass = [bool]$a.pass; detail = $a.detail; case = $rec.name }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch { } } else { Write-Host "kept: $run" }
  return ,$out
}

function Show-Results($rows, [string]$label) {
  Write-Host "[$label]"
  foreach ($x in $rows) {
    $d = if ($x.detail) { "  [$($x.detail)]" } else { '' }
    if ($d.Length -gt 400) { $d = $d.Substring(0, 400) + '...]' }
    Write-Host ('  {0}  {1} {2}{3}' -f $(if ($x.pass) { 'PASS' } else { 'FAIL' }), $x.id, $x.name, $d)
  }
  $p = @($rows | Where-Object { $_.pass }).Count; $f = @($rows | Where-Object { -not $_.pass }).Count
  Write-Host "SUMMARY $label pass=$p fail=$f"
}

function Invoke-All([string]$idxText, [string]$cssText, [bool]$quiet, [bool]$shot) {
  $st = Test-Static $idxText
  $br = Invoke-Browser $idxText $cssText $shot
  if (-not $quiet) { Show-Results $st 'static'; Show-Results $br 'browser' }
  return ,(@($st) + @($br))
}

Write-Host "index.php: $idxPath"
Write-Host "main.css:  $cssPath"
if ($CheckAnchors -or $Mutants) {
  # Every anchor must occur exactly once in the build under test - checked up
  # front, so a stale anchor fails in a second instead of mid-run.
  $stale = @()
  foreach ($nm in $mutantDefs.Keys) {
    $src = if ($mutantDefs[$nm].target -eq 'idx') { $idx0 } else { $css0 }
    try { [void](Apply-Mutant $src $nm) } catch { $stale += $_.Exception.Message }
  }
  if ($stale.Count) { $stale | ForEach-Object { Write-Host "ANCHOR $_" }; Write-Host 'RESULT: RED'; return }
  Write-Host "ANCHORS all $($mutantDefs.Count) mutants apply exactly once"
  if ($CheckAnchors) { Write-Host 'RESULT: GREEN'; return }
}
if ($Mutant -or $Mutants) {
  $names = if ($Mutants) { @($mutantDefs.Keys) } else { @($Mutant) }
  $bite = 0
  foreach ($nm in $names) {
    if (-not $mutantDefs.Contains($nm)) { throw "unknown mutant '$nm' (known: $(($mutantDefs.Keys) -join ', '))" }
    $m = $mutantDefs[$nm]
    $i2 = if ($m.target -eq 'idx') { Apply-Mutant $idx0 $nm } else { $idx0 }
    $c2 = if ($m.target -eq 'css') { Apply-Mutant $css0 $nm } else { $css0 }
    $all = Invoke-All $i2 $c2 $true $false
    $red = @($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id })
    $miss = @($m.red | Where-Object { $red -notcontains $_ })
    if ($miss.Count -eq 0) { $bite++; Write-Host ("MUTANT {0,-16} BITES   red: {1}" -f $nm, ($red -join ' ')) }
    else { Write-Host ("MUTANT {0,-16} MISSED  expected red {1} but {2} stayed green; red: {3}" -f $nm, ($m.red -join ' '), ($miss -join ' '), ($red -join ' ')) }
  }
  Write-Host "MUTANTS $bite / $($names.Count) bite"
  Write-Host $(if ($bite -eq $names.Count) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}
$all = Invoke-All $idx0 $css0 $false ([bool]$Keep)
$p = @($all | Where-Object { $_.pass }).Count; $f = @($all | Where-Object { -not $_.pass }).Count
Write-Host "TOTAL pass=$p fail=$f"
if ($f -gt 0) { Write-Host ('FAILED: ' + (@($all | Where-Object { -not $_.pass } | ForEach-Object { $_.id }) -join ' ')) }
Write-Host $(if ($f -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
