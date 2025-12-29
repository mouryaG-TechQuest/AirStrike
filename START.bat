@echo off
title 3D Sky Defender - Server
echo.
echo ╔════════════════════════════════════════════╗
echo ║     🎮 3D SKY DEFENDER - STARTING          ║
echo ╚════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js found
echo.

:: Save process ID to file for stop script
echo Starting server...
echo.

:: Start server and open browser
start /b node services/server.js > server.log 2>&1

:: Wait for server to start
timeout /t 2 /nobreak >nul

:: Open browser
start http://localhost:3000

echo ╔════════════════════════════════════════════╗
echo ║  ✓ Server started successfully!            ║
echo ║                                            ║
echo ║  Game URL: http://localhost:3000           ║
echo ║                                            ║
echo ║  To stop: Run STOP.bat or close this       ║
echo ╚════════════════════════════════════════════╝
echo.
echo Press any key to stop the server...
pause >nul

:: Kill node process when user presses key
taskkill /f /im node.exe >nul 2>&1
echo.
echo Server stopped.
del server.log >nul 2>&1