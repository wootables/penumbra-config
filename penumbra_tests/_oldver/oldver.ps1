# =============================================================================
# oldver.ps1 - old versions of webroot files for -Control runs, read from GIT.
# PowerShell twin of oldver.py (read its header). The share is MachinePolicy RemoteSigned, so a
# plain dot-source is refused ("not digitally signed") - load it as a scriptblock, like the suites:
#   . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))
#   Get-BakItem "$js\main.js.bak-*-tag"   drop-in for Get-ChildItem <pattern> | Sort-Object Name
#                                         (FileInfo objects; .FullName / .Name as before)
#   Resolve-Bak "$app\x.php.bak-<stamp>"  drop-in for "path if Test-Path, else nothing"
#   Get-GitVersion 'abc1234^' 'js\main.js' the file at a commit (git show <rev>:<rel>), a path
# =============================================================================
$script:OldVerHere    = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver'   # fixed: a scriptblock has no file path
$script:OldVerWebroot = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$script:OldVerGitDir  = '\\oitras.oit.ncsu.edu\d$\Utilities\penumbra_git'
$script:OldVerIndex   = $null

function OldVer-Load {
  if ($null -eq $script:OldVerIndex) {
    $script:OldVerIndex = foreach ($line in [IO.File]::ReadAllLines((Join-Path $script:OldVerHere 'bak_index.tsv'))) {
      if ($line.StartsWith('#') -or -not $line.Trim()) { continue }
      $f = $line.Split("`t"); [pscustomobject]@{ Rel = $f[0]; Kind = $f[1]; Ref = $f[2] }
    }
  }
  $script:OldVerIndex
}

function OldVer-Git([string[]]$GitArgs, [string]$OutFile) {
  # Binary-safe: PowerShell 5.1 pipelines re-encode native stdout, so read the raw stream.
  $psi = New-Object Diagnostics.ProcessStartInfo 'git'
  $psi.Arguments = (@("--git-dir=`"$script:OldVerGitDir`"") + $GitArgs) -join ' '
  $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
  $p = [Diagnostics.Process]::Start($psi)
  $ms = New-Object IO.MemoryStream
  $errTask = $p.StandardError.ReadToEndAsync()
  $p.StandardOutput.BaseStream.CopyTo($ms); $p.WaitForExit()
  if ($p.ExitCode -ne 0) { throw "oldver: git $($GitArgs -join ' ') failed: $($errTask.Result.Trim())" }
  if ($OutFile) { [IO.File]::WriteAllBytes($OutFile, $ms.ToArray()); return }
  [Text.Encoding]::UTF8.GetString($ms.ToArray()).Trim()
}

function OldVer-BlobFile([string]$Sha, [string]$Base) {
  $d = Join-Path (Join-Path $script:OldVerHere 'cache') $Sha
  $p = Join-Path $d $Base
  if (Test-Path -LiteralPath $p) { return $p }
  [void](New-Item -ItemType Directory -Force -Path $d)
  $tmp = "$p.tmp"
  OldVer-Git @('cat-file', 'blob', $Sha) $tmp
  if ((OldVer-Git @('hash-object', '--no-filters', "`"$tmp`"")) -ne $Sha) { [IO.File]::Delete($tmp); throw "oldver: blob $Sha came back with the wrong hash" }
  [IO.File]::Move($tmp, $p)
  $p
}

function Get-BakItem([string]$Pattern) {
  $found = @{}
  foreach ($i in @(Get-ChildItem $Pattern -ErrorAction SilentlyContinue)) { $found[$i.Name.ToLower()] = $i }
  $root = $script:OldVerWebroot.TrimEnd('\') + '\'
  $norm = $Pattern.Replace('/', '\')
  if ($norm.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    $relPat = $norm.Substring($root.Length).Replace('\', '/')
    foreach ($e in (OldVer-Load)) {
      if ($e.Rel -notlike $relPat) { continue }
      $base = $e.Rel.Split('/')[-1]
      if ($found.ContainsKey($base.ToLower())) { continue }
      $path = if ($e.Kind -eq 'git') { OldVer-BlobFile $e.Ref $base } else { $e.Ref.Replace('/', '\') }
      $found[$base.ToLower()] = Get-Item -LiteralPath $path
    }
  }
  $found.Values | Sort-Object Name
}

function Resolve-Bak([string]$Path) {
  if (Test-Path -LiteralPath $Path) { return $Path }
  $hit = Get-BakItem ([Management.Automation.WildcardPattern]::Escape($Path)) | Select-Object -Last 1
  if ($hit) { $hit.FullName }
}

function Get-GitVersion([string]$Rev, [string]$Rel) {
  $Rel = $Rel.Replace('\', '/')
  $sha = OldVer-Git @('rev-parse', "`"${Rev}:$Rel`"")
  OldVer-BlobFile $sha $Rel.Split('/')[-1]
}
