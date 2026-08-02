@echo off
chcp 65001 >nul
title MammoAI - AI kutubxonalar o'rnatish

echo ================================================
echo   AI kutubxonalar o'rnatilmoqda (PyTorch CPU)
echo   ~500MB yuklanadi, internet kerak
echo ================================================
echo.

cd /d "%~dp0..\backend"
call venv\Scripts\activate.bat

echo [1/2] PyTorch CPU o'rnatilmoqda...
pip install torch==2.3.0+cpu torchvision==0.18.0+cpu --index-url https://download.pytorch.org/whl/cpu

echo [2/2] Qolgan kutubxonalar...
pip install timm==1.0.3 opencv-python-headless==4.9.0.80 pydicom==2.4.4 pandas scikit-learn

echo.
echo ================================================
echo   Tayyor! Endi train.bat bilan model treniring qiling.
echo ================================================
pause
