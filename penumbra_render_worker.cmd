@echo off
REM Wrapper for the "Penumbra Render Worker" scheduled task (NETWORK SERVICE).
REM Exists so the schtasks /TR argument is ONE unquoted path - nesting quotes
REM inside /TR registers a task that fails instantly and logs nothing (see
REM penumbra_monitor.cmd). Pass-through args (%*) so -Once / -Queue work by hand.
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Utilities\PHP_8.2-p\penumbra_render_worker.ps1" %*
