@echo off
REM SPIKE v3 (2026-09-29): Edge will not run as SYSTEM (v2). Try the two
REM passwordless service accounts via temporary local tasks (spike_v3.ps1).
setlocal
set D=D:\Utilities\PHP_8.2-p\chart_spike
echo [%date% %time%] spike v3 start >> "%D%\spike.log"
whoami >> "%D%\spike.log" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%D%\spike_v3.ps1" >> "%D%\spike.log" 2>&1
echo [%date% %time%] spike v3 end >> "%D%\spike.log"
endlocal
