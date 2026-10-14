# spike_v2.ps1 - three bounded headless-Edge attempts; called by penumbra_chart_spike.cmd
$D = 'D:\Utilities\PHP_8.2-p\chart_spike'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$url = 'file:///D:/Utilities/PHP_8.2-p/chart_spike/chart.html'
"edge: $edge  exists=$(Test-Path $edge)"
"session: $([System.Diagnostics.Process]::GetCurrentProcess().SessionId)  interactive=$([Environment]::UserInteractive)  user=$([Environment]::UserName)"
$base = @('--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-background-networking','--hide-scrollbars','--mute-audio','--window-size=900,450','--virtual-time-budget=3000','--enable-logging=stderr','--v=1')
$attempts = @(
  @{ name='A'; args = @('--headless=new') + $base },
  @{ name='B'; args = @('--headless=new','--no-sandbox','--disable-crash-reporter','--disable-breakpad') + $base },
  @{ name='C'; args = @('--headless=old','--no-sandbox','--disable-crash-reporter','--disable-breakpad') + $base }
)
foreach ($a in $attempts) {
  $n = $a.name
  $png = "$D\chart_$n.png"; $prof = "$D\profile_$n"
  if (Test-Path $png) { [IO.File]::Delete($png) }
  $args = $a.args + @("--user-data-dir=$prof", "--screenshot=$png", $url)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $p = Start-Process -FilePath $edge -ArgumentList $args -PassThru -NoNewWindow -RedirectStandardError "$D\attempt_$n.err" -RedirectStandardOutput "$D\attempt_$n.out"
    if (-not $p.WaitForExit(40000)) {
      "attempt $n TIMEOUT after 40s - killing tree"
      try { & taskkill /PID $p.Id /T /F | Out-Null } catch {}
    } else {
      "attempt $n exit $($p.ExitCode) in $($sw.ElapsedMilliseconds) ms"
    }
  } catch { "attempt $n Start-Process failed: $($_.Exception.Message)" }
  "attempt $n png=$(Test-Path $png) bytes=$(if (Test-Path $png) { (Get-Item $png).Length } else { 0 })  err_bytes=$(if (Test-Path "$D\attempt_$n.err") { (Get-Item "$D\attempt_$n.err").Length } else { -1 })"
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*chart_spike*' } | ForEach-Object { "  leftover edge pid $($_.ProcessId) - killing"; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  if (Test-Path $png) { break }
}
