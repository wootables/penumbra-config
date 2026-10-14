@echo off
REM Wrapper for the Penumbra watchdog scheduled task.
REM Exists so the schtasks /TR argument is ONE unquoted path - nesting quotes
REM inside /TR is the classic way to get a task that registers cleanly and then
REM fails instantly on every run, logging nothing.
REM Pass-through args (%*) so --test and --verbose still work by hand.
"D:\Utilities\PHP_8.2-p\php.exe" "D:\Utilities\PHP_8.2-p\penumbra_monitor.php" %*
