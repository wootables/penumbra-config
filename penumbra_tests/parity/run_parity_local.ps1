# =============================================================================
# Penumbra snippet parity harness - LOCAL LAUNCHER
#
#   $p = "$env:TEMP\run_parity_local.ps1"
#   Copy-Item '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity\run_parity_local.ps1' $p -Force
#   & $p                    # add -CompareOnly to skip to the comparison
#   & $p -MainSrc <path\to\main.js>   # a stage or mutant main.js in place of live's (how the
#                                     # page-error check is proved: tBodies -> tBodiez must go RED)
#
# Running it IN PLACE on the share is blocked by the very policy it works
# around - copy it local first, as above.
#
# WHY THIS EXISTS: this directory is a UNC share, and script execution from a
# UNC path is GPO-blocked on the workstations that run the harness - so
# `powershell -File \\oitras\d$\...\run_parity.ps1` fails before it starts, and
# so does run_parity.ps1's own trailing `& "$here\compare.ps1"` call.
#
# The workaround is to READ the two scripts and run their BODIES as scriptblocks
# with $PSScriptRoot substituted for the real share path. That is all this file
# does. Copy it somewhere local (or run it from a local checkout) and invoke it;
# it always sources run_parity.ps1 / compare.ps1 FRESH from the share, so it
# cannot drift from the harness it drives.
#
#   -CompareOnly   re-run just the comparison against the existing
#                  result_a.json / result_b.json / result_c.json (under a
#                  second). Use it after editing compare.ps1's $expected /
#                  $openBugs.
#   -MainSrc       handed to run_parity.ps1 unchanged (see its header).
#
# A RED run (2026-10-17): compare.ps1 ends in a throw when either harness recorded
# an uncaught error while main.js booted (page errors), after printing its report;
# this launcher does not catch it, so the error is the last thing on screen and the
# exit code is non-zero. -CompareOnly repeats the last full run's verdict (it reads
# the same a.dom.txt / b.dom.txt).
#
# Budget under a minute for a full run: 14-16 s on 2026-09-29 (24 s on
# 2026-09-19) - both Edge steps run on virtual time. Each Edge step gives up
# after 180 s without a complete dump, so a run that sits for minutes is a hung
# Edge, not a slow harness. Edge's stderr lines about fallback_task_provider.cc /
# crbug.com/40528867 (and now and then get_updates_processor.cc) in steps 4 and
# 5 are NOISE.
# =============================================================================
param([switch]$CompareOnly, [string]$MainSrc)

$ErrorActionPreference = 'Stop'
$root = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity'

if (-not (Test-Path $root)) { throw "parity share not reachable: $root" }

function Invoke-ShareScript {
    # ScriptArgs is a HASHTABLE (splatted by name): an array splat would bind positionally.
    param([string]$Name, [string]$StripFrom, [hashtable]$ScriptArgs = @{})
    $path = Join-Path $root $Name
    if (-not (Test-Path $path)) { throw "missing on the share: $path" }
    $body = [IO.File]::ReadAllText($path)
    # $PSScriptRoot is $null inside a scriptblock built from a string.
    $body = $body.Replace('$PSScriptRoot', "'$root'")
    if ($StripFrom) {
        $i = $body.IndexOf($StripFrom)
        # Not finding it is fine (run_parity.ps1 may stop calling compare.ps1);
        # silently running the call would NOT be, so only trim when present.
        if ($i -ge 0) { $body = $body.Substring(0, $i) }
    }
    & ([scriptblock]::Create($body)) @ScriptArgs
}

if (-not $CompareOnly) {
    # Drop run_parity.ps1's trailing compare.ps1 invocation - that nested call is
    # a UNC .ps1 too, and is blocked by the same policy.
    $runArgs = @{}; if ($MainSrc) { $runArgs['MainSrc'] = $MainSrc }
    Invoke-ShareScript -Name 'run_parity.ps1' -StripFrom '& "$here\compare.ps1"' -ScriptArgs $runArgs
}
Invoke-ShareScript -Name 'compare.ps1'
