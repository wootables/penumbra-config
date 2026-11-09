# idcard suite (2026-11-03): the title crumb's short-id hover card, js/penumbra_idcard.js.
# Usage (scriptblock form, -File is GPO-refused on UNC):
#   & ([scriptblock]::Create((Get-Content '<this dir>\run.ps1' -Raw))) -App '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
# Runs: control (broken js, must FAIL), target (must be all green), mutant (the stale-id guard removed, must fail mismatch-nofacts only).
# (wcag mod 2026-11-07, M2) -App may be a stage dir holding js\ and css\ (a file it lacks comes from live). Added:
#   kbd    harness_kbd.tpl.html: the card is a non-modal dialog with real buttons, reached by ArrowDown from
#          the crumb, Escape / Tab off either end back to the crumb. Target all green; LIVE js shows the k-* reds.
#   look   harness_style.tpl.html: index.php's stylesheets (in its order, :hover / :focus-visible rewritten to
#          .__h / .__fv) - every <button> action computes exactly as the live <a> did, 8 themes x 3 states.
#   mutants one single-point revert per part of the fix, each must turn exactly its checks red.
param([string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra', [string]$Here = '')
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$here = if ($Here) { $Here } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\idcard' }
function Src([string]$rel) { $p = Join-Path $App $rel; if (Test-Path -LiteralPath $p) { return $p } return (Join-Path $live $rel) }
$work = Join-Path $env:TEMP ('idcard_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work | Out-Null
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
"app: $App"
$js = [IO.File]::ReadAllText((Src 'js\penumbra_idcard.js'))
$liveJs = [IO.File]::ReadAllText((Join-Path $live 'js\penumbra_idcard.js'))
$anchor = "if (c && String(c.id || '').toLowerCase() !== id.toLowerCase()) c = null;"
if (([regex]::Matches($js, [regex]::Escape($anchor))).Count -ne 1) { throw 'mutant anchor not found exactly once' }
[IO.File]::WriteAllText("$work\target.js", $js)
[IO.File]::WriteAllText("$work\livejs.js", $liveJs)
[IO.File]::WriteAllText("$work\control.js", 'function broken( { nope')
[IO.File]::WriteAllText("$work\mutant.js", $js.Replace($anchor, '// MUTANT'))
function RunPage([string]$html, [string]$k) {
  [IO.File]::WriteAllText("$work\h_$k.html", $html)
  Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput "$work\dom_$k.txt" -ArgumentList '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$work\ud_$k",'--virtual-time-budget=8000','--window-size=1400,900','--dump-dom',"file:///$($work -replace '\\','/')/h_$k.html"
  $t = Get-Content "$work\dom_$k.txt" -Raw
  if ($t -match 'data-r="([^"]*)"') { return [System.Net.WebUtility]::HtmlDecode($Matches[1]) } else { return 'NO RESULT' }
}
$tpl = [IO.File]::ReadAllText("$here\harness.tpl.html")
$res = @{}
foreach ($k in 'control','target','mutant') {
  $res[$k] = RunPage ($tpl.Replace('__TARGET__', "$k.js")) $k
  "$k : $($res[$k])"
}
$okAll = ($res.control -notmatch 'fail=0') -and ($res.target -match 'pass=25 fail=0') -and ($res.mutant -match 'fail=1 .*mismatch-nofacts')

# --- (wcag mod 2026-11-07) keyboard ------------------------------------------------
$ktpl = [IO.File]::ReadAllText("$here\harness_kbd.tpl.html")
$kt = RunPage ($ktpl.Replace('__TARGET__', 'target.js')) 'kbd_target'
"kbd target : $kt"
$kl = RunPage ($ktpl.Replace('__TARGET__', 'livejs.js')) 'kbd_live'
"kbd LIVE js (k-* reds expected) : $kl"
$okAll = $okAll -and ($kt -match 'pass=\d+ fail=0 errs=\[\]') -and ($kl -notmatch 'fail=0')

# --- (wcag mod 2026-11-07) look: index.php's stylesheets, live <a> vs target <button> ---
$idx = [IO.File]::ReadAllText((Src 'index.php'))
$cssRel = @([regex]::Matches($idx, '<link rel="stylesheet"[^>]*?href="(?:<\?php echo .)?(css/[A-Za-z0-9_.-]+\.css)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
$links = ''
$i = 0
foreach ($c in $cssRel) {
  $p = Src ($c -replace '/', '\')
  if (-not (Test-Path -LiteralPath $p)) { continue }
  $t = [IO.File]::ReadAllText($p).Replace(':hover', '.__h').Replace(':focus-visible', '.__fv')
  [IO.File]::WriteAllText("$work\css_$i.css", $t)
  $links += "<link rel=`"stylesheet`" href=`"css_$i.css`">`n"
  $i++
}
"look: $i stylesheets ($($cssRel -join ' '))"
$stpl = [IO.File]::ReadAllText("$here\harness_style.tpl.html").Replace('__CSS__', $links).Replace('__ORIG__', 'livejs.js')
$sr = RunPage ($stpl.Replace('__TARGET__', 'target.js')) 'look'
"look target : $sr"
$okAll = $okAll -and ($sr -match 'pass=\d+ fail=0 errs=\[\]')

# --- (wcag mod 2026-11-07) mutants: one single-point revert each ---------------------
$cssT = [IO.File]::ReadAllText((Src 'css\penumbra_idcard.css'))
$muts = [ordered]@{
  'm2role'   = @('js', "            `$card.setAttribute('role', 'dialog');", "            `$card.setAttribute('role', 'tooltip');", 'kbd', @('k-role'))
  'm2links'  = @('js', "<button type=`"button`" data-idc=`"copylink`">Copy link</button><button type=`"button`" data-idc=`"copyid`">Copy id</button>", "<a href=`"#`" data-idc=`"copylink`">Copy link</a><a href=`"#`" data-idc=`"copyid`">Copy id</a>", 'kbd', @('k-buttons','k-arrows','k-tab-out'))
  'm2arrow'  = @('js', "        e.preventDefault();`n        bs[0].focus();`n", "", 'kbd', @('k-arrow-in'))
  'm2stay'   = @('js', "            `$card.addEventListener('focusin', function () { clearTimeout(timer); timer = null; });`n", "", 'kbd', @('k-stays-open','k-kbd-pointerleave'))
  'm2esc'    = @('js', "if (`$card.contains(document.activeElement)) backToCrumb(cardFor); else hide();", "hide();", 'kbd', @('k-esc'))
  'm2quiet'  = @('js', "if (kb && !quietFocus) show(a);", "if (kb) show(a);", 'kbd', @('k-esc','k-esc-stays-shut','k-tab-out','k-shifttab-out'))   # without it the crumb's focus reopens the card at once
  'm2tab'    = @('js', "            backToCrumb(cardFor);`n            e.preventDefault();`n        }`n    }", "        }`n    }", 'kbd', @('k-tab-out','k-shifttab-out'))
  'm2guard'  = @('js', "                if (kbdInside()) return;   // the keyboard is working in it (wcag mod 2026-11-07)`n", "", 'kbd', @('k-kbd-pointerleave'))
  'm2underl' = @('css', ".pnb-idc.bld-help-pop .pnb-idc-links button:focus-visible {`n    margin: 0;`n    padding: 0;`n    border: 0;`n    border-bottom: 1px dashed var(--brand-secondary);", ".pnb-idc.bld-help-pop .pnb-idc-links button:focus-visible {`n    margin: 0;`n    padding: 0;`n    border: 0;", 'look', @('look-copylink-rest','look-copylink-__h','look-copylink-__fv','look-copyid-rest','look-copyid-__h','look-copyid-__fv','look-card-height'))
}
$mOk = 0; $mBad = 0
foreach ($m in $muts.Keys) {
  $d = $muts[$m]
  $src = if ($d[0] -eq 'js') { $js } else { $cssT }
  $n = ([regex]::Matches($src, [regex]::Escape($d[1]))).Count
  if ($n -ne 1) { "  FAIL  mutant $m anchor found $n times"; $mBad++; continue }
  $mut = $src.Replace($d[1], $d[2])
  if ($d[0] -eq 'js') {
    [IO.File]::WriteAllText("$work\m_$m.js", $mut)
    $r = RunPage ($ktpl.Replace('__TARGET__', "m_$m.js")) "m_$m"
  } else {
    [IO.File]::WriteAllText("$work\m_$m.css", $mut.Replace(':hover', '.__h').Replace(':focus-visible', '.__fv'))
    $ln = $links
    $ci = [array]::IndexOf($cssRel, 'css/penumbra_idcard.css')
    $ln = $ln.Replace("href=`"css_$ci.css`"", "href=`"m_$m.css`"")
    $r = RunPage ([IO.File]::ReadAllText("$here\harness_style.tpl.html").Replace('__CSS__', $ln).Replace('__ORIG__', 'livejs.js').Replace('__TARGET__', 'target.js')) "m_$m"
  }
  $missing = @($d[4] | Where-Object { $r -notmatch [regex]::Escape("FAIL $_") })
  $red = @([regex]::Matches($r, 'FAIL ((?:k-[a-z-]+)|(?:look-[a-z_-]+))') | ForEach-Object { $_.Groups[1].Value.Trim() })
  $extra = @($red | Where-Object { $d[4] -notcontains $_ })
  if ($missing.Count -eq 0 -and $r -notmatch 'fail=0' -and $extra.Count -eq 0) { $mOk++; "  PASS  mutant $m turns exactly $($d[4] -join ', ') red" }
  else { $mBad++; "  FAIL  mutant $m  missing: $($missing -join ', ')  extra: $($extra -join ', ')  [$($r.Substring(0, [Math]::Min(400, $r.Length)))]" }
}
"SUMMARY mutants ok=$mOk bad=$mBad"
$okAll = $okAll -and ($mBad -eq 0)
if ($okAll) { 'IDCARD SUITE: OK' } else { 'IDCARD SUITE: FAILED' }
