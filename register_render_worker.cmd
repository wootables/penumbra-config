@echo off
REM One-shot: register the "Penumbra Render Worker" task (see register_render_worker.ps1).
REM Started by the watchdog wrapper when render_queue\register.once exists.
setlocal
set P=D:\Utilities\PHP_8.2-p
echo [%date% %time%] register start >> "%P%\render_queue\register.log"
powershell -NoProfile -ExecutionPolicy Bypass -File "%P%\register_render_worker.ps1" >> "%P%\render_queue\register.log" 2>&1
echo [%date% %time%] register end >> "%P%\render_queue\register.log"
endlocal
