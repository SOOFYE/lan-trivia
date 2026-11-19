@echo off
setlocal
cd /d "%~dp0"
title LAN Trivia
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed, or Windows cannot find it.
  echo Install the LTS version from https://nodejs.org and open this file again.
  pause
  exit /b 1
)
if not exist "node_modules\express\package.json" goto install
if not exist "node_modules\socket.io\package.json" goto install
goto launch
:install
echo This copy needs its one-time setup before it can run offline.
echo Connect to the internet before choosing Yes.
choice /C YN /M "Install the required files now?"
if errorlevel 2 exit /b 1
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo Setup failed. Check your connection and try again.
  pause
  exit /b 1
)
:launch
node scripts\launch.cjs
echo.
echo The game has stopped. Close this window or press any key.
pause >nul
