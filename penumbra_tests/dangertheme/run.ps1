# =============================================================================
# Penumbra DANGER-THEME SUITE (2026-10-10) - each theme's own --accent-danger: the twelve registry
# themes carry it in their cssVars (penumbra_emit_theme_css() emits it inside body.theme-x after
# main.css, so it wins over body.is-dark), the five hand-written themes carry a body.theme-x line in
# css/main.css after the light / dark fallback pair, and every value reads >= 4.5:1 on its theme's
# surface and stays apart from the brand primary. PHP only (test_dangertheme.php); no browser.
#
#   powershell -File run.ps1                          live themes_config.php + css/main.css
#   powershell -File run.ps1 -App <dir>               a staged copy (both files under it)
#   powershell -File run.ps1 -Cfg <p> -Css <p>        the two files by hand
#   powershell -File run.ps1 [-App <dir>] -Mutant <name>    nocfg | dimcss | brand   (must go RED)
#   Control = -App <the pre-change copy> (orig25: one light / dark pair, no per-theme values):
#            RED, 32 fails (the fallback pin, the 5 hand-written lines, the order pin, 12 x 2 registry).
#   Mutants (applied to COPIES under %TEMP%; the live files are never written):
#     nocfg  -> midnight's cssVars loses accent-danger:        2 fails (registry carries + emitted CSS)
#     dimcss -> dark-blue's red turns #8b0000 (dark on dark):  1 fail  (contrast on its surface)
#     brand  -> wolfpack's red becomes its #990000 primary:    1 fail  (1:1 against the brand)
#   A mutant prints MUTANT CAUGHT (the expected fail count) or MUTANT SURVIVED (exit 1).
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock:
#   $d = '\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dangertheme'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <dir>
# Exit 1 when RED (or a mutant survives). Writes nothing to the webroot.
# =============================================================================
param([string]$App = '', [string]$Cfg = '', [string]$Css = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\' + '\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dangertheme' }
$live = '\' + '\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\' + '\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
if ($App) { if (-not $Cfg) { $Cfg = Join-Path $App 'themes_config.php' }; if (-not $Css) { $Css = Join-Path $App 'css\main.css' } }
if (-not $Cfg) { $Cfg = Join-Path $live 'themes_config.php' }
if (-not $Css) { $Css = Join-Path $live 'css\main.css' }
Write-Host "[1/2] registry: $Cfg"
Write-Host "      css:      $Css"
$expected = @{ 'nocfg' = 2; 'dimcss' = 1; 'brand' = 1 }
$work = ''
if ($Mutant) {
    if (-not $expected.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (nocfg | dimcss | brand)" }
    $u8 = New-Object System.Text.UTF8Encoding($false)
    $work = Join-Path $env:TEMP ('pnb_dangertheme_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force $work | Out-Null
    $cfgText = $u8.GetString([IO.File]::ReadAllBytes($Cfg)); $cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
    switch ($Mutant) {
        'nocfg' {
            # stays inside midnight's entry (amethyst opens its cssVars with the same two keys)
            $re = New-Object System.Text.RegularExpressions.Regex("(?s)('id' => 'theme-midnight'(?:(?!'id' => ').)*?)'accent-danger' => '#fb7185', ")
            $n = $re.Matches($cfgText).Count; if ($n -ne 1) { throw "mutant nocfg: anchor found $n times, expected 1" }
            $cfgText = $re.Replace($cfgText, '$1')
        }
        'dimcss' {
            $from = 'body.theme-dark-blue     { --accent-danger: #f85149; }'; $to = 'body.theme-dark-blue     { --accent-danger: #8b0000; }'
            $n = ([regex]::Matches($cssText, [regex]::Escape($from))).Count; if ($n -ne 1) { throw "mutant dimcss: anchor found $n times, expected 1" }
            $cssText = $cssText.Replace($from, $to)
        }
        'brand' {
            $from = 'body.theme-wolfpack      { --accent-danger: #cc0000; }'; $to = 'body.theme-wolfpack      { --accent-danger: #990000; }'
            $n = ([regex]::Matches($cssText, [regex]::Escape($from))).Count; if ($n -ne 1) { throw "mutant brand: anchor found $n times, expected 1" }
            $cssText = $cssText.Replace($from, $to)
        }
    }
    $Cfg = Join-Path $work 'themes_config.php'; $Css = Join-Path $work 'main.css'
    [IO.File]::WriteAllText($Cfg, $cfgText, $u8); [IO.File]::WriteAllText($Css, $cssText, $u8)
    Write-Host "      + MUTANT $Mutant (copies under $work)"
}
Write-Host "[2/2] test_dangertheme.php"
$out = & $php -n -d display_errors=stderr (Join-Path $here 'test_dangertheme.php') "--cfg=$Cfg" "--css=$Css" 2>&1 | ForEach-Object { [string]$_ }
$code = $LASTEXITCODE
$out | ForEach-Object { Write-Host $_ }
if ($work -and ($work -like (Join-Path $env:TEMP 'pnb_dangertheme_*'))) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
$summary = ($out | Where-Object { $_ -like 'PASS:*' } | Select-Object -Last 1)
$fails = -1; if ($summary -match 'FAIL:\s*(\d+)') { $fails = [int]$Matches[1] }
if ($Mutant) {
    $want = $expected[$Mutant]
    if ($fails -eq $want) { Write-Host "MUTANT CAUGHT: $Mutant -> $fails fail(s), as expected"; exit 0 }
    Write-Host "MUTANT SURVIVED: $Mutant -> $fails fail(s), expected $want"; exit 1
}
if ($code -ne 0 -or $fails -ne 0) { Write-Host "RESULT: RED (php exit $code)"; exit 1 }
exit 0
