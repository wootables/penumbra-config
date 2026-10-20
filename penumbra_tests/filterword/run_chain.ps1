# FILTER WORDING (2026-10-19): every suite whose checks name a changed word, ONE AT A TIME,
# each in a child process, against the filterword stage (or -Live: the live webroot, to show
# the dual-word pins still pass on the files before the rename). Logs: out\<suite>[_live].txt,
# the last lines of each in out\SUMMARY[_live].txt. Writes nothing to the webroot.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\run_chain.ps1'))) [-Live] [-Only a,b]
#   (a .ps1 on the share does not run with -File on this machine; a scriptblock does)
param([switch]$Live, [string]$Only = '', [string]$Stage = 'stage')
$ErrorActionPreference = 'Continue'
$Kit   = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\filterword'
$Tests = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests'
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$S = if ($Live) { $LiveDir } else { Join-Path $Kit $Stage }
$tag = if ($Live) { '_live' } elseif ($Stage -ne 'stage') { '_' + $Stage } else { '' }
$Out = Join-Path $Kit 'out'
if (-not (Test-Path -LiteralPath $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }
$env:PYTHONIOENCODING = 'utf-8'

# dashsearch takes a FLAT stage folder
$Flat = Join-Path $Kit 'stage_flat_dashsearch'
if (-not $Live) {
  if (-not (Test-Path -LiteralPath $Flat)) { New-Item -ItemType Directory -Path $Flat | Out-Null }
  foreach ($rel in @('js\penumbra_dashboard.js', 'js\penumbra_tiles.js', 'js\main.js', 'css\main.css', 'css\penumbra_dashboard.css', 'index.php',
                     'js\search_builder.js', 'css\search_builder.css', 'search_builder_content.php', 'journal_export.php')) {
    [IO.File]::Copy((Join-Path $S $rel), (Join-Path $Flat ([IO.Path]::GetFileName($rel))), $true)
  }
}

function PyArgs([string]$suite) {
  switch ($suite) {
    'find'      { return @('--stage', $S) }   # (find's own default is its kit's stage, not live)
    'colmenu'   { return @('--stage', $S) }
    'rowfunnel' { return @('--stage', $S) }
    'printx'    { return @('--stage', $S) }
    'togglefix' { return @('--dir', $S) }
    'subsettip' { return @('--app', $S) }
    'acrow'     { return @('--js', "$S\js\search_builder.js", '--css', "$S\css\search_builder.css", '--help-php', "$S\help\topics\searchHelpLightbox.php") }
  }
}
function PsArgs([string]$suite) {
  switch ($suite) {
    'singlekeytips' { return "-MainJs '$S\js\main.js' -MainCss '$S\css\main.css' -A11yJs '$S\js\penumbra_a11y.js' -DashJs '$S\js\penumbra_dashboard.js' -HealthPhp '$LiveDir\health.php' -HelpPhp '$S\help\topics\userSettingsHelpLightbox.php' -IndexPhp '$S\index.php'" }
    'searchbar'     { return "-MainCss '$S\css\main.css' -MainJs '$S\js\main.js' -IndexPhp '$S\index.php' -HelpPhp '$S\help\topics\viewoptionsHelpLightbox.php'" }
    'noadm5'        { if ($Live) { return '' } else { return "-App '$S'" } }
    'xlsx'          { return "-MainJs '$S\js\main.js'" }
    'subtip'        { if ($Live) { return '' } else { return "-App '$S'" } }
    'dashsearch'    { if ($Live) { return '' } else { return "-Stage '$Flat'" } }
  }
}

$py = @('find', 'colmenu', 'rowfunnel', 'printx', 'togglefix', 'subsettip', 'acrow')
$ps = @('singlekeytips', 'searchbar', 'noadm5', 'xlsx', 'subtip', 'dashsearch')
$want = if ($Only) { $Only -split ',' } else { $py + $ps }
$summary = Join-Path $Out ("SUMMARY$tag.txt")
"filterword chain $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  files under test: $S" | Out-File -FilePath $summary -Encoding utf8

foreach ($suite in $want) {
  $dir = Join-Path $Tests $suite
  $log = Join-Path $Out ("$suite$tag.txt")
  $t0 = Get-Date
  if ($py -contains $suite) {
    $a = PyArgs $suite
    $p = Start-Process -FilePath 'py' -ArgumentList (@('-3', 'run.py') + ($a | ForEach-Object { '"' + $_ + '"' })) -WorkingDirectory $dir -NoNewWindow -Wait -PassThru `
         -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')
  } else {
    $a = PsArgs $suite
    # the child's command goes in a file (no quoting through the command line); the suite runs as a
    # scriptblock with its $here pinned to its folder (a UNC $PSScriptRoot does not resolve there)
    $child = Join-Path $Out ("child_$suite$tag.ps1")
    $body = "Set-Location '$dir'`r`n" +
            "& ([scriptblock]::Create([IO.File]::ReadAllText('$dir\run.ps1').Replace('`$here = `$PSScriptRoot', `"```$here = '$dir'`"))) $a *>&1`r`n"
    [IO.File]::WriteAllText($child, $body, (New-Object System.Text.UTF8Encoding($false)))
    # (a .ps1 on the share will not run with -File here, whatever -ExecutionPolicy says: a scriptblock does)
    $argLine = '-NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(''' + $child + ''')))"'
    $p = Start-Process -FilePath 'powershell' -ArgumentList $argLine -WorkingDirectory $dir -NoNewWindow -Wait -PassThru `
         -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')
  }
  $secs = [int]((Get-Date) - $t0).TotalSeconds
  $tail = (Get-Content -LiteralPath $log -Tail 6 -ErrorAction SilentlyContinue) -join ' | '
  ("{0,-14} exit={1} {2,4}s  {3}" -f $suite, $p.ExitCode, $secs, $tail) | Out-File -FilePath $summary -Encoding utf8 -Append
}
"done $(Get-Date -Format 'HH:mm:ss')" | Out-File -FilePath $summary -Encoding utf8 -Append
