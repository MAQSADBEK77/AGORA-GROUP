@echo off
chcp 65001 >nul
title MammoAI - Demo Data Import

echo ================================================
echo   MammoAI - MIAS Dataset Import
echo   (50MB Kaggle dan yuklanadi)
echo ================================================
echo.

cd /d "%~dp0backend"
call venv\Scripts\activate.bat

pip install kaggle pillow numpy -q

echo.
echo Boshlashdan avval:
echo   1. kaggle.com ga kiring
echo   2. Settings ^> API ^> Create New Token
echo   3. Yuklab olingan kaggle.json ni:
echo      C:\Users\%USERNAME%\.kaggle\  papkasiga qo'ying
echo.
pause

python setup_demo_data.py

pause
