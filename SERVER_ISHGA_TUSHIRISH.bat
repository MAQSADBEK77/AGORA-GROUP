@echo off
chcp 65001 >nul
title MammoAI SERVER

cd /d "%~dp0backend"
call venv\Scripts\activate.bat

echo ================================================
echo   MammoAI SERVER ishga tushmoqda (production)
echo ================================================
echo.

:: Tailscale Funnel'ni alohida oynada ishga tushiramiz - bu backend
:: 8000-portini tashqariga (internetga) HTTPS orqali ochadi. Alohida
:: oynada qoldirilishi kerak, aks holda funnel to'xtaydi.
start "MammoAI Tailscale Funnel" cmd /k "tailscale funnel 8000"

timeout /t 3 /nobreak >nul
echo.
echo   Radiolog kirishi kerak bo'lgan tashqi manzil:
echo   ------------------------------------------------
tailscale funnel status
echo   ------------------------------------------------
echo.
echo   Mahalliy manzil: http://localhost:8000
echo   Admin login: admin@mammoai.uz / Admin@2024
echo ================================================
echo.
echo   DIQQAT: bu oynani va "MammoAI Tailscale Funnel"
echo   oynasini YOPMANG - ular ochiq turishi kerak,
echo   aks holda server/tashqi havola to'xtaydi.
echo ================================================
echo.

:restart_loop
uvicorn app.main:app --host 0.0.0.0 --port 8000
echo.
echo [DIQQAT] Server kutilmaganda to'xtadi. 5 soniyadan keyin
echo qayta ishga tushiriladi...
timeout /t 5 /nobreak >nul
goto restart_loop
