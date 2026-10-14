@echo off
REM Wrapper for the Penumbra people-sync scheduled task (HR -> NC_REPORTING.PENUMBRA_PEOPLE).
REM Exists so the schtasks /TR argument is ONE unquoted path - nesting quotes inside /TR
REM registers a task that fails instantly on every run and logs nothing (see penumbra_monitor.cmd).
REM Pass-through args (%*) so --dry-run / --verbose / --ensure-only work by hand.
"D:\Utilities\PHP_8.2-p\php.exe" "C:\inetpub\wwwroot\sponsor_migration\penumbra\people_sync.php" %*
