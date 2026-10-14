@echo off
REM Spike v3 helper: run by a TEMPORARY local task under a service account.
REM %1 = attempt suffix (NS = Network Service, LS = Local Service).
set D=D:\Utilities\PHP_8.2-p\chart_spike
set X=%1
echo [%date% %time%] attempt %X% start >> "%D%\attempt_%X%.log"
whoami >> "%D%\attempt_%X%.log" 2>&1
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --no-sandbox --disable-gpu --disable-crash-reporter --disable-breakpad --no-first-run --no-default-browser-check --disable-extensions --disable-sync --disable-background-networking --hide-scrollbars --mute-audio --enable-logging=stderr --v=1 --user-data-dir="%D%\profile_%X%" --window-size=900,450 --virtual-time-budget=3000 --screenshot="%D%\chart_%X%.png" "file:///D:/Utilities/PHP_8.2-p/chart_spike/chart.html" > "%D%\attempt_%X%.out" 2> "%D%\attempt_%X%.err"
echo [%date% %time%] attempt %X% edge exit %errorlevel% >> "%D%\attempt_%X%.log"
if exist "%D%\chart_%X%.png" (echo png ok >> "%D%\attempt_%X%.log") else (echo NO PNG >> "%D%\attempt_%X%.log")
echo [%date% %time%] attempt %X% end >> "%D%\attempt_%X%.log"
