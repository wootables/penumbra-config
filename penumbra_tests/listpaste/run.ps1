# Runs harness.html twice under headless Edge: once against the real
# js/search_builder.js, once against a deliberately broken copy.
#
# The CONTROL is not optional. On file:// without --allow-file-access-from-files
# a script error is sanitised to "Script error.", so a harness can report success
# while testing nothing. Baking the source into a JS string literal (below)
# sidesteps that entirely, and the control proves the suite can still fail.
#
# UNC .ps1 files are GPO-blocked from running directly: paste this body as a
# scriptblock, do not pipe it, and never use Start-Process -Wait via a pipe.

# $MyInvocation.MyCommand.Path is null when this body is run as a scriptblock
# (the GPO workaround above), so check before calling Split-Path on it.
$dir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }
       else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\listpaste' }
$js  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js\search_builder.js'

$src = [IO.File]::ReadAllText($js)
[IO.File]::WriteAllText("$dir\SRC.js", "window.__src = " + ($src | ConvertTo-Json -Compress) + ";")

# harnessb.html = same suite, but with window.__break set so the extracted
# normalizeValueList loses its de-duplication.
$h = [IO.File]::ReadAllText("$dir\harness.html")
[IO.File]::WriteAllText("$dir\harnessb.html", $h.Replace('<script src="SRC.js"></script>',
    '<script src="SRC.js"></script><script>window.__break=1;</script>'))

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

foreach ($p in @(@('harness.html','real.txt','u1'), @('harnessb.html','ctrl.txt','u2'))) {
  Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $dir $p[1]) -ArgumentList `
    '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
    ("--user-data-dir=" + (Join-Path $dir $p[2])),'--dump-dom',
    ("file:///" + (Join-Path $dir $p[0]).Replace('\','/'))
}

function Show($file, $label) {
  $dom = [IO.File]::ReadAllText((Join-Path $dir $file))
  $m = [regex]::Match($dom, '(?s)<pre id="out">(.*?)</pre>')
  $body = if ($m.Success) { $m.Groups[1].Value } else { '(no output captured)' }
  Write-Output "===== $label ====="
  Write-Output ($body -replace '&quot;','"' -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&')
}
Show 'real.txt' 'REAL search_builder.js'
Show 'ctrl.txt' 'BROKEN-COPY CONTROL (must show failures)'
