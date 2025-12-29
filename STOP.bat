@echo off
echo.
echo ╔════════════════════════════════════════════╗
echo ║     🛑 STOPPING 3D SKY DEFENDER SERVER     ║
echo ╚════════════════════════════════════════════╝
echo.

:: Kill all node processes running the server
taskkill /f /im node.exe >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo ✓ Server stopped successfully!
) else (
    echo ℹ No server was running.
)

:: Clean up log file
del server.log >nul 2>&1

echo.
echo Done.
timeout /t 2 >nul