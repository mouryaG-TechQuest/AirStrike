@echo off
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     🌐 DEPLOY 3D SKY DEFENDER ONLINE                   ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Choose deployment method:
echo.
echo [1] Netlify (Recommended - Free, Easy)
echo [2] Vercel (Free, Fast)
echo [3] Local Server Only
echo [4] Exit
echo.
set /p choice="Enter choice (1-4): "

if "%choice%"=="1" goto netlify
if "%choice%"=="2" goto vercel
if "%choice%"=="3" goto local
if "%choice%"=="4" exit /b 0
goto end

:netlify
echo.
echo ═══════════════════════════════════════════════════════
echo  NETLIFY DEPLOYMENT
echo ═══════════════════════════════════════════════════════
echo.
echo 1. Go to: https://app.netlify.com/drop
echo 2. Drag and drop the "frontend" folder
echo 3. Get your public URL instantly!
echo.
echo Your game will be accessible worldwide via HTTPS.
echo Hand tracking will work on all devices.
echo.
start https://app.netlify.com/drop
echo.
echo Opening Netlify in browser...
pause
goto end

:vercel
echo.
echo ═══════════════════════════════════════════════════════
echo  VERCEL DEPLOYMENT
echo ═══════════════════════════════════════════════════════
echo.
where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js/npm required. Install from: https://nodejs.org
    pause
    goto end
)
echo Running: npx vercel frontend
echo.
cd frontend
npx vercel
cd ..
pause
goto end

:local
echo.
echo ═══════════════════════════════════════════════════════
echo  LOCAL SERVER
echo ═══════════════════════════════════════════════════════
echo.
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js required. Install from: https://nodejs.org
    pause
    goto end
)
echo Starting local server...
node services/server.js
pause
goto end

:end
echo.
echo Done!
pause