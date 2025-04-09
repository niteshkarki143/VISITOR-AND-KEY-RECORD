@echo off
setlocal enabledelayedexpansion

:: Create logs directory if it doesn't exist
if not exist "C:\ServerLogs" mkdir C:\ServerLogs

:: Set log file with current date
set "logfile=C:\ServerLogs\access_log_%date:~-4,4%%date:~-10,2%%date:~-7,2%.txt"

:: Header for log file
echo Server Access Log - Generated %date% %time% > "%logfile%"
echo ================================================ >> "%logfile%"

:: Netstat to show active connections
echo Active Network Connections: >> "%logfile%"
netstat -ano >> "%logfile%"

:: Firewall log connections
echo Firewall Connections: >> "%logfile%"
netsh advfirewall monitor show firewall >> "%logfile%"

:: Get IP configurations
echo IP Configurations: >> "%logfile%"
ipconfig /all >> "%logfile%"

:: List all established connections
echo Established Connections: >> "%logfile%"
netstat -ano | findstr ESTABLISHED >> "%logfile%"

:: Log routing table
echo Routing Table: >> "%logfile%"
route print >> "%logfile%"

:: Optional: If you want to continuously monitor
:: Uncomment the following section if needed
:: :loop
::     netstat -ano | findstr ESTABLISHED >> "%logfile%"
::     timeout /t 300 /nobreak > nul
:: goto loop

echo Logging complete. Check log file at %logfile%

echo Starting Cloudflare Tunnel for VMS/KMS...

REM Ensure you're in the project directory
cd /d "%~dp0"

REM Start the Node.js server in the background
start /B node server.js

REM Wait a moment for the server to start
timeout /t 2 /nobreak > nul

REM Run Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000

pause
