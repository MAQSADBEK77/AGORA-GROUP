@echo off
chcp 65001 >nul
title MammoAI - Frontend

echo ================================================
echo   MammoAI Frontend ishga tushmoqda...
echo ================================================

cd /d "%~dp0..\frontend"

:: node_modules yo'q bo'lsa o'rnatish
if not exist "node_modules" (
    echo [1/2] npm paketlar o'rnatilmoqda...
    npm install
)

echo [2/2] Frontend server ishga tushmoqda...
echo.
echo   UI: http://localhost:3000
echo.
npm run dev
