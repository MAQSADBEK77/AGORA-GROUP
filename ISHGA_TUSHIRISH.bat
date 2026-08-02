@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title MammoAI - O'rnatish va ishga tushirish

echo ================================================
echo   MammoAI - O'rnatish va ishga tushirish
echo ================================================
echo.
echo   Bu fayl bitta bosishda hammasini qiladi:
echo   Python/Node tekshiradi (kerak bo'lsa o'rnatadi),
echo   kutubxonalarni o'rnatadi, serverlarni ishga
echo   tushiradi va brauzerni ochadi.
echo.

call :ensure_tool python "Python.Python.3.11" "Python"
if errorlevel 1 exit /b 1

call :ensure_tool node "OpenJS.NodeJS.LTS" "Node.js"
if errorlevel 1 exit /b 1

echo.
echo [OK] Python va Node.js tayyor
echo.

:: ---- Backend: virtual environment + kutubxonalar ----
cd /d "%~dp0backend"
if not exist "venv\Scripts\activate.bat" (
    echo [1/4] Backend virtual environment yaratilmoqda...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [2/4] Backend kutubxonalari o'rnatilmoqda (birinchi marta bir necha daqiqa oladi)...
pip install -r requirements.txt -q
call venv\Scripts\deactivate.bat

:: ---- Frontend: npm paketlar ----
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [3/4] Frontend kutubxonalari o'rnatilmoqda...
    call npm install
)

cd /d "%~dp0"
echo [4/4] Serverlar ishga tushmoqda...
echo.

start "MammoAI Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
start "MammoAI Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo ================================================
echo   MammoAI ishga tushdi!
echo.
echo   UI:   http://localhost:3000
echo   API:  http://localhost:8000/docs
echo.
echo   Admin: admin@mammoai.uz / Admin@2024
echo ================================================
echo.
echo   Bu oynani yopsangiz ham serverlar to'xtamaydi -
echo   ular "MammoAI Backend" va "MammoAI Frontend"
echo   nomli alohida oynalarda ishlayapti. Dasturni
echo   to'liq to'xtatish uchun o'sha ikkala oynani yoping.
echo ================================================
pause
exit /b 0

:: ================================================
:: %1 = konsol buyrug'i (masalan python), %2 = winget ID, %3 = chop uchun nom
:ensure_tool
where %1 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] %~3 topildi
    exit /b 0
)
echo [...] %~3 topilmadi, o'rnatilmoqda (winget orqali, internet kerak)...
winget install -e --id %~2 --silent --accept-package-agreements --accept-source-agreements
echo PATH yangilanmoqda...
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"
where %1 >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [DIQQAT] %~3 o'rnatildi, lekin joriy oyna buni hali ko'rmayapti.
    echo Iltimos, bu oynani YOPING va ISHGA_TUSHIRISH.bat faylini QAYTA oching.
    pause
    exit /b 1
)
echo [OK] %~3 o'rnatildi
exit /b 0
