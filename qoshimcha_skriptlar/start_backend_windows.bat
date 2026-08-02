@echo off
chcp 65001 >nul
title MammoAI - Backend

echo ================================================
echo   MammoAI Backend ishga tushmoqda...
echo ================================================

cd /d "%~dp0..\backend"

:: Virtual environment yo'q bo'lsa yaratish
if not exist "venv\Scripts\activate.bat" (
    echo [1/3] Virtual environment yaratilmoqda...
    python -m venv venv
)

:: Activate
call venv\Scripts\activate.bat

:: Paketlarni o'rnatish
echo [2/3] Kerakli kutubxonalar o'rnatilmoqda...
pip install -r requirements.txt -q

:: Ishga tushirish
echo [3/3] Server ishga tushmoqda...
echo.
echo   API:  http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo.
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
