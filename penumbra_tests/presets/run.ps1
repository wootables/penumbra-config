# Runs both preset harnesses under headless Edge, each followed by its
# targeted mutant(s).
#
#   harness.html      the STORE   - migration, merge-on-read, pins
#   harness_ui.html   the CONTROL - PenumbraPresets.create(), mounted in a DOM
#
# The module is baked into a JS string literal (SRC.js) rather than <script
# src>'d: on file:// without --allow-file-access-from-files a script error is
# sanitised to "Script error.", so a harness can report success while testing
# nothing.
#
# THREE controls, because no one of them reaches another's invariant:
#   BREAK=1  mutate() stops stamping i:1, so a bucket never imports and
#            merge-on-read resurrects deleted presets from the legacy key.
#            Every READ-path test still passes - only the delete tests fail.
#   BREAK=2  Object.create(null) -> {}, so user-authored preset names inherit
#            from Object.prototype. Only the __proto__ tests fail.
#   BREAK=3  the preset NAME renders through innerHTML instead of textContent.
#            Only the XSS tests fail - 46 functional assertions still pass,
#            because a name without markup renders identically either way.
#   BREAK=5  (Preset Sharing, 2026-10-22) a shared row's rename/delete come from
#            can_write ALONE, so a reader is offered other people's rows. Only
#            the "reader:" row-rights checks fail.
#   BREAK=4  create() fetches the SHARED list at MOUNT, i.e. at report load.
#            Only "mounting makes NO request" and "refresh() makes NO request"
#            fail (124/2): the open-time request is deduplicated onto the
#            in-flight one, so everything else passes. Those two failures ARE
#            the owner's rule 3 (nothing at report load).
#
# UNC .ps1 files are GPO-blocked from running directly: paste this body as a
# scriptblock, do not pipe it, and never use Start-Process -Wait via a pipe.

# $MyInvocation.MyCommand.Path is null when this body is run as a scriptblock
# (the GPO workaround above), so check before calling Split-Path on it.
$dir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }
       else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\presets' }
$js  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js\penumbra_presets.js'

$src = [IO.File]::ReadAllText($js)
[IO.File]::WriteAllText("$dir\SRC.js", "window.__src = " + ($src | ConvertTo-Json -Compress) + ";")

$tag = '<script src="SRC.js"></script>'
$store = [IO.File]::ReadAllText("$dir\harness.html")
foreach ($n in 1, 2) {
  [IO.File]::WriteAllText("$dir\harness$n.html", $store.Replace($tag, $tag + '<script>window.__break=' + $n + ';</script>'))
}
$ui = [IO.File]::ReadAllText("$dir\harness_ui.html")
[IO.File]::WriteAllText("$dir\harness_ui3.html", $ui.Replace($tag, $tag + '<script>window.__break=3;</script>'))
[IO.File]::WriteAllText("$dir\harness_ui4.html", $ui.Replace($tag, $tag + '<script>window.__break=4;</script>'))
[IO.File]::WriteAllText("$dir\harness_ui5.html", $ui.Replace($tag, $tag + '<script>window.__break=5;</script>'))

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

foreach ($p in @(@('harness.html','real.txt','u0'),
                 @('harness1.html','ctrl1.txt','u1'),
                 @('harness2.html','ctrl2.txt','u2'),
                 @('harness_ui.html','ui.txt','v0'),
                 @('harness_ui3.html','ctrl3.txt','v3'),
                 @('harness_ui4.html','ctrl4.txt','v4'),
                 @('harness_ui5.html','ctrl5.txt','v5'))) {
  # A FRESH profile dir per launch, in local TEMP: a reused dir on the share can
  # still be locked by a previous headless Edge, and Start-Process -Wait then
  # never returns (2026-09-05, the whole run hung on the first page).
  $profile = Join-Path $env:TEMP ('pnbp_' + $p[2] + '_' + [IO.Path]::GetRandomFileName())
  Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $dir $p[1]) -ArgumentList `
    '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
    ("--user-data-dir=" + $profile),'--dump-dom',
    ("file:///" + (Join-Path $dir $p[0]).Replace('\','/'))
  Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
}

function Show($file, $label) {
  $dom = [IO.File]::ReadAllText((Join-Path $dir $file))
  $m = [regex]::Match($dom, '(?s)<pre id="out">(.*?)</pre>')
  $body = if ($m.Success) { $m.Groups[1].Value } else { '(no output captured)' }
  Write-Output "===== $label ====="
  Write-Output ($body -replace '&quot;','"' -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&')
}
Show 'real.txt'  'STORE - real'
Show 'ctrl1.txt' 'STORE - control 1, no import stamp (delete tests MUST fail)'
Show 'ctrl2.txt' 'STORE - control 2, bare {} name maps (__proto__ tests MUST fail)'
Show 'ui.txt'    'CONTROL - real'
Show 'ctrl3.txt' 'CONTROL - control 3, name via innerHTML (XSS tests MUST fail)'
Show 'ctrl4.txt' 'CONTROL - control 4, shared list fetched at MOUNT ("mounting makes NO request" MUST fail)'
Show 'ctrl5.txt' 'CONTROL - control 5, row rights from can_write alone ("reader:" row checks MUST fail)'
