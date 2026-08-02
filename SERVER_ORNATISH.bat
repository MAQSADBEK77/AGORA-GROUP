@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title MammoAI SERVER - Birinchi marta o'rnatish

:: Administrator tekshirish (Task Scheduler va powercfg uchun kerak)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [XATO] Bu faylni ADMINISTRATOR sifatida ishga tushiring!
    echo Fayl ustida O'NG tugmani bosing va
    echo "Run as administrator" ni tanlang.
    pause
    exit /b 1
)

echo ================================================
echo   MammoAI SERVER - birinchi marta o'rnatish
echo   Bu kompyuter endi doimiy SERVER bo'ladi -
echo   radiologlar unga boshqa joydan kiradi.
echo ================================================
echo.

call :ensure_tool python "Python.Python.3.11" "Python"
if errorlevel 1 exit /b 1
call :ensure_tool node "OpenJS.NodeJS.LTS" "Node.js"
if errorlevel 1 exit /b 1
call :ensure_tool tailscale "Tailscale.Tailscale" "Tailscale"
if errorlevel 1 exit /b 1

echo.
echo [OK] Python, Node.js, Tailscale tayyor
echo.

:: ---- Backend: venv + kutubxonalar ----
cd /d "%~dp0backend"
if not exist "venv\Scripts\activate.bat" (
    echo [1/5] Backend virtual environment yaratilmoqda...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [2/5] Backend kutubxonalari o'rnatilmoqda...
pip install -r requirements.txt -q
call venv\Scripts\deactivate.bat

:: ---- Frontend: build (production - dev server EMAS) ----
cd /d "%~dp0frontend"
echo [3/5] Frontend build qilinmoqda (bir necha daqiqa cheking)...
call npm install
call npm run build
if not exist "dist\index.html" (
    echo [XATO] Frontend build muvaffaqiyatsiz tugadi. Yuqoridagi xabarni tekshiring.
    pause
    exit /b 1
)

cd /d "%~dp0"

:: ---- Kompyuter uxlab qolmasligi uchun ----
echo [4/5] Kompyuter uxlamasligi/ekran o'chmasligi sozlanmoqda...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /hibernate off >nul 2>&1

echo.
echo ================================================
echo   Endi Tailscale akkauntga kiring (bir martalik)
echo ================================================
echo   Brauzer ochiladi - Google/Microsoft/GitHub/email
echo   bilan BEPUL Tailscale akkauntga kiring.
echo.
echo   Kirgandan keyin yana bitta bir martalik qadam bor:
echo   https://login.tailscale.com/admin/dns sahifasida
echo   "Enable HTTPS" tugmasini bosing (Funnel ishlashi
echo   uchun shart).
echo ================================================
pause
tailscale up

echo.
echo [5/5] Server kompyuter yoqilganda avtomatik
echo ishga tushishi sozlanmoqda...
schtasks /create /tn "MammoAI Server" /tr "\"%~dp0SERVER_ISHGA_TUSHIRISH.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f
if errorlevel 1 (
    echo [DIQQAT] Avtomatik ishga tushirish sozlanmadi - buni
    echo qo'lda Task Scheduler orqali sozlashingiz kerak bo'ladi.
    echo Hech bo'lmaganda SERVER_ISHGA_TUSHIRISH.bat ni qo'lda
    echo ishga tushirib qo'ysangiz ham server ishlayveradi.
)

echo.
echo ================================================
echo   O'RNATISH TUGADI!
echo   Serverni hozir birinchi marta ishga tushiraman...
echo ================================================
pause

call "%~dp0SERVER_ISHGA_TUSHIRISH.bat"
exit /b 0

:: ================================================
:: %1 = konsol buyrug'i, %2 = winget ID, %3 = chop uchun nom
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
    echo Iltimos, bu oynani YOPING va SERVER_ORNATISH.bat faylini
    echo QAYTA, Administrator sifatida oching.
    pause
    exit /b 1
)
echo [OK] %~3 o'rnatildi
exit /b 0
