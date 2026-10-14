@echo off
REM One-shot: restart the "Penumbra Render Worker" task so the running copy is
REM replaced by the script now on disk (used once, 2026-09-29, when the 12:53
REM copy - which has no self-reload - had to pick up DOM mode). Started by the
REM watchdog wrapper when render_queue\restart.once exists; runs as SYSTEM.
setlocal
set P=D:\Utilities\PHP_8.2-p
set L=%P%\render_queue\restart.log
echo [%date% %time%] restart start >> "%L%"
schtasks /Query /TN "Penumbra Render Worker" /FO LIST >> "%L%" 2>&1
schtasks /End /TN "Penumbra Render Worker" >> "%L%" 2>&1
REM The worker's own finally-block removes worker.lock; give it a moment, then
REM clear a leftover lock so the new instance never sees a live-looking PID.
timeout /t 5 /nobreak > nul
if exist "%P%\render_queue\worker.lock" del /q "%P%\render_queue\worker.lock" >> "%L%" 2>&1
schtasks /Run /TN "Penumbra Render Worker" >> "%L%" 2>&1
timeout /t 10 /nobreak > nul
schtasks /Query /TN "Penumbra Render Worker" /FO LIST >> "%L%" 2>&1
echo [%date% %time%] restart end >> "%L%"
endlocal
