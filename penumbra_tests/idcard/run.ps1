# idcard suite (2026-11-03): the title crumb's short-id hover card, js/penumbra_idcard.js.
# Usage (scriptblock form, -File is GPO-refused on UNC):
#   & ([scriptblock]::Create((Get-Content '<this dir>\run.ps1' -Raw))) -App '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
# Runs: control (broken js, must FAIL), target (must be all green), mutant (the stale-id guard removed, must fail mismatch-nofacts only).
param([string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra')
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\idcard'
$work = Join-Path $env:TEMP ('idcard_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work | Out-Null
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$js = [IO.File]::ReadAllText((Join-Path $App 'js\penumbra_idcard.js'))
$anchor = "if (c && String(c.id || '').toLowerCase() !== id.toLowerCase()) c = null;"
if (([regex]::Matches($js, [regex]::Escape($anchor))).Count -ne 1) { throw 'mutant anchor not found exactly once' }
[IO.File]::WriteAllText("$work\target.js", $js)
[IO.File]::WriteAllText("$work\control.js", 'function broken( { nope')
[IO.File]::WriteAllText("$work\mutant.js", $js.Replace($anchor, '// MUTANT'))
$tpl = [IO.File]::ReadAllText("$here\harness.tpl.html")
$res = @{}
foreach ($k in 'control','target','mutant') {
  [IO.File]::WriteAllText("$work\h_$k.html", $tpl.Replace('__TARGET__', "$k.js"))
  Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput "$work\dom_$k.txt" -ArgumentList '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$work\ud_$k",'--virtual-time-budget=5000','--dump-dom',"file:///$($work -replace '\\','/')/h_$k.html"
  $t = Get-Content "$work\dom_$k.txt" -Raw
  $res[$k] = if ($t -match 'data-r="([^"]*)"') { $Matches[1] } else { 'NO RESULT' }
  "$k : $($res[$k])"
}
$okAll = ($res.control -notmatch 'fail=0') -and ($res.target -match 'pass=25 fail=0') -and ($res.mutant -match 'fail=1 .*mismatch-nofacts')
if ($okAll) { 'IDCARD SUITE: OK' } else { 'IDCARD SUITE: FAILED' }