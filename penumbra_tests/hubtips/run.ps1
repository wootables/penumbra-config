# Health hub (i) tips in a real browser with the real main.css (2026-10-15, user: "the health tips
# never go away when you move the mouse away or click"). main.css shows a tip while
# aria-expanded="true"; health.php's tipIdle() used to read that back, so a tip never closed.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('...\hubtips\run.ps1'))) [-App DIR]      DIR\health.php + DIR\css\main.css (default: the live app)
# CONTROL: health.php from 4780452..4e42166 -> exactly T2 and T8 red.
param([string]$App = '')
if (-not $App) { $App = [IO.Path]::Combine('\\oitras.oit.ncsu.edu\c$', 'inetpub\wwwroot\sponsor_migration\penumbra') }
$here = if ($PSScriptRoot) { $PSScriptRoot } else { [IO.Path]::Combine('\\oitras.oit.ncsu.edu\d$', 'Utilities\PHP_8.2-p\penumbra_tests\hubtips') }   # run as a scriptblock (unsigned scripts are blocked)
$tmp = Join-Path $env:TEMP ('hubtips_' + [guid]::NewGuid().ToString('N').Substring(0, 6)); [void][IO.Directory]::CreateDirectory($tmp)
$src = [IO.File]::ReadAllText((Join-Path $App 'health.php'))
$a = $src.IndexOf('    function tipOf(i)'); $b = $src.IndexOf('    function stickH()')
if ($a -lt 0 -or $b -lt $a) { 'FAIL lift: tip script not found'; exit 1 }
$html = [IO.File]::ReadAllText((Join-Path $here 'harness.html')).Replace('%%TIPJS%%', $src.Substring($a, $b - $a))
[IO.File]::WriteAllText((Join-Path $tmp 'h.html'), $html)
[IO.File]::Copy((Join-Path $App 'css\main.css'), (Join-Path $tmp 'main.css'))
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$dom = Join-Path $tmp 'dom.txt'
$pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',('--user-data-dir=' + (Join-Path $tmp 'prof')),'--virtual-time-budget=10000','--dump-dom',('file:///' + ($tmp -replace '\\','/') + '/h.html'))
$pr.WaitForExit(120000) | Out-Null; Start-Sleep 1
$fs = [IO.File]::Open($dom, 'Open', 'Read', 'ReadWrite'); $sr = New-Object IO.StreamReader($fs); $t = $sr.ReadToEnd(); $sr.Close()
$lines = @(([regex]::Match($t, '<pre id="out">([^<]*)')).Groups[1].Value -split "`n" | Where-Object { $_ })
$pass = 0; $fail = 0
foreach ($l in $lines) {
    $m = [regex]::Match($l, '\(want (\w+)/(\w+)\): expanded=(\w+) shown=(\w+)')
    if ($m.Success -and $m.Groups[1].Value -eq $m.Groups[3].Value -and $m.Groups[2].Value -eq $m.Groups[4].Value) { $pass++; "  ok   $l" } else { $fail++; "  FAIL $l" }
}
if ($lines.Count -ne 8) { $fail++; "  FAIL expected 8 steps, got $($lines.Count)" }
if ((Split-Path -Leaf $tmp) -like 'hubtips_*') { try { [IO.Directory]::Delete($tmp, $true) } catch { } }
"SUMMARY  pass=$pass  fail=$fail"; if ($fail) { 'RESULT: RED' } else { 'RESULT: GREEN' }