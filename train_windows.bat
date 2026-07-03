@echo off
chcp 65001 >nul
title MammoAI - Model Trenirovkasi

echo ================================================
echo   MammoAI - ResNet18 Trenirovkasi (CBIS-DDSM)
echo ================================================
echo.

cd /d "%~dp0backend"
call venv\Scripts\activate.bat

:: Pandas kerak (dataset tayyorlash uchun)
pip install pandas -q

echo.
echo 1-qadam: Dataset tayyorlash
echo   Avval Kaggle dan dataset yuklab oling:
echo   https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset
echo.
echo   Keyin quyidagi buyruqni o'zgartiring va ishga tushiring:
echo.
echo   python prepare_dataset.py --dataset_dir "C:\path\to\cbis-ddsm" --output_dir "./data"
echo.
echo   (yuqoridagi yo'lni o'z papkangizga moslashtiring)
echo.

set /p DATASET_DIR="CBIS-DDSM papkasi yo'lini kiriting: "

if "%DATASET_DIR%"=="" (
    echo Yo'l kiritilmadi. Chiqilmoqda...
    pause
    exit
)

echo.
echo Dataset tayyorlanmoqda...
python prepare_dataset.py --dataset_dir "%DATASET_DIR%" --output_dir "./data"

echo.
echo 2-qadam: Trenirovka boshlanmoqda (25 epoch)...
echo.

python train.py --data_dir "./data" --output_dir "./model" --epochs 25 --batch_size 16 --lr 0.001

echo.
echo ================================================
echo   Model saqlandi: backend\model\model_breast.pth
echo   Serverni qayta ishga tushiring: start_backend.bat
echo ================================================
pause
