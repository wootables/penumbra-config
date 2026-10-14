param([string]$Label='run')
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivot_trigger'
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$src = [IO.File]::ReadAllText("$app\js\main.js", (New-Object System.Text.UTF8Encoding($false)))
$anchor = '$(document).ready(function () {'
$h = 'try { window.__PT5 = { extract: extractAggregationValue, stddev: pivotSampleStdDev, antimode: pivotAntimodeFromValues, antimodeMap: pivotAntimodeFromMap, parseNums: pivotParseNumericValues }; } catch (e) { window.__PT5_ERR = String(e); } try { window.__PT7 = { resolveW: pivotResolveAutoBinWidth, autoW: pivotAutoBinWidth, binBucket: pivotBinBucketLabel }; } catch (e) { window.__PT7_ERR = String(e); } try { window.__PT9 = { wavgOf: pivotWavgOf, wavgPair: _pivotWavgPair, wavgCol: pivotWavgWeightCol, pctOf: pivotPercentileOf, pctP: pivotPercentileP }; } catch (e) { window.__PT9_ERR = String(e); } try { window.__CF = { names: penumbraCfAggFnNames, detect: penumbraCfAggDetectRegex, call: penumbraCfAggCallRegex }; } catch (e) { window.__CF_ERR = String(e); }'
$i = $src.IndexOf($anchor)
if ($i -lt 0) { throw 'closure anchor not found' }
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $h`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_probe.js", $patched, (New-Object System.Text.UTF8Encoding($false)))

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$rid = [Guid]::NewGuid().ToString('N').Substring(0,8)
$dom = "$here\probe_dom_$rid.txt"
$udd = "$here\edgeprofile_$rid"
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/probe.html'
$eargs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom',$url)
$p = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $eargs
$p.WaitForExit()
$d = $null
for ($k = 0; $k -lt 25; $k++) { try { $d = [IO.File]::ReadAllText($dom); break } catch { Start-Sleep -Milliseconds 400 } }
if (-not $d) { throw 'could not read dump' }
$i = $d.IndexOf('<pre id="out">'); $j = $d.IndexOf('</pre>', $i)
if ($i -lt 0) { throw "no <pre id=out>; $($d.Length) bytes" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { Write-Host "NOT FINISHED: $($txt.Substring(0,[Math]::Min(800,$txt.Length)))"; exit 2 }
$r = $txt.Substring(13) | ConvertFrom-Json
Write-Host "===== $Label ====="
if ($r.pageErrors.Count) { Write-Host "PAGE_ERRORS: $($r.pageErrors -join '; ')" }
$f = 0
foreach ($x in $r.results) {
  if ($x.pass) { Write-Host "  PASS  $($x.name)" }
  else { $f++; Write-Host "  FAIL  $($x.name)"; Write-Host "        $($x.detail)" }
}
Write-Host "$($r.results.Count) probes, $f failed"
try { Remove-Item $dom -Force -ErrorAction SilentlyContinue } catch {}
try { Remove-Item $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
