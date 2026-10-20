# README swap (find rounds, 2026-10-20): cut the live README.md to readme\README.orig<N>.md, run a
# readme_patch*.py on the cut into readme\README<N>.md, then put it in place with MoveFileEx only if
# live still equals the cut (other sessions edit the README too). Git clean for README.md first.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\readme_swap.ps1'))) -N 6 -Patch readme_patch4.py [-DryRun]
param([string]$N, [string]$Patch, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
if (-not $N -or -not $Patch) { throw 'usage: -N <cut number> -Patch <readme_patch*.py>' }
$KitDir = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\find'
$Live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\README.md'
$Cut = Join-Path $KitDir "readme\README.orig$N.md"
$New = Join-Path $KitDir "readme\README$N.md"
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
$env:GIT_WORK_TREE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
function Get-Sha([string]$p) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower() }

$st = & git status --porcelain -- README.md
if ($LASTEXITCODE -ne 0) { throw "git status failed: $st" }
if ("$st".Trim()) { throw "README.md is not clean in git: $st" }
if ((Test-Path -LiteralPath $Cut) -or (Test-Path -LiteralPath $New)) { throw "the cut or the patched copy exists already ($N): pick a new -N" }
if (Test-Path -LiteralPath ($Live + '.deploy-tmp')) { throw 'a README.md.deploy-tmp is there' }
[IO.File]::Copy($Live, $Cut)
if ((Get-Sha $Cut) -ne (Get-Sha $Live)) { throw 'the cut differs from live (it moved while copying): run again with a new -N' }
Push-Location $env:TEMP
try {
  & py -3 (Join-Path $KitDir $Patch) $Cut $New
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $New)) { throw "the patch failed: nothing written live" }
} finally { Pop-Location }
Write-Host ('cut {0}  patched {1}' -f (Get-Sha $Cut).Substring(0, 12), (Get-Sha $New).Substring(0, 12))
if ($DryRun) { Write-Host 'dry run: stopping before the swap'; return }

if (-not ('PnbFindDeploy.Mv' -as [type])) {
  Add-Type -Namespace PnbFindDeploy -Name Mv -MemberDefinition '[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool MoveFileEx(string a, string b, int flags);'
}
$tmp = $Live + '.deploy-tmp'
[IO.File]::Copy($New, $tmp, $true)
if ((Get-Sha $tmp) -ne (Get-Sha $New)) { [IO.File]::Delete($tmp); throw 'the tmp copy differs: nothing swapped' }
if ((Get-Sha $Live) -ne (Get-Sha $Cut)) { [IO.File]::Delete($tmp); throw 'live README moved meanwhile: nothing swapped (run again with a new -N)' }
$ok = $false
for ($t = 0; $t -lt 20 -and -not $ok; $t++) {
  $ok = [PnbFindDeploy.Mv]::MoveFileEx($tmp, $Live, 1)
  if (-not $ok) { Start-Sleep -Milliseconds 250 }
}
if (-not $ok) { throw "MoveFileEx failed (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())); the tmp is left at $tmp" }
if ((Get-Sha $Live) -ne (Get-Sha $New)) { throw 'live README differs from the patched copy after the swap' }
Write-Host ('{0}  swapped README.md' -f (Get-Date -Format 'HH:mm:ss'))
