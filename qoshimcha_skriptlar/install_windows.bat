@echo off
chcp 65001 >nul
title MammoAI - O'rnatish

echo ================================================
echo   MammoAI - Python va Node.js o'rnatish
echo ================================================
echo.

:: Python tekshirish
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Python o'rnatilmoqda...
    winget install -e --id Python.Python.3.11 --silent
    echo Python o'rnatildi. Iltimos, bu oynani YOPING va install.bat ni qayta ishga tushiring.
    pause
    exit
) else (
    echo [OK] Python topildi
)

:: Node.js tekshirish
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/2] Node.js o'rnatilmoqda...
    winget install -e --id OpenJS.NodeJS.LTS --silent
    echo Node.js o'rnatildi. Iltimos, bu oynani YOPING va install.bat ni qayta ishga tushiring.
    pause
    exit
) else (
    echo [OK] Node.js topildi
)

echo.
echo ================================================
echo   Hammasi tayyor! Endi ishga tushirish uchun:
echo   1. start_backend_windows.bat  (backend)
echo   2. start_frontend_windows.bat (frontend)
echo   (yoki repo tub papkasidagi ISHGA_TUSHIRISH.bat
echo    bilan hammasini bitta bosishda qiling)
echo ================================================
pause
