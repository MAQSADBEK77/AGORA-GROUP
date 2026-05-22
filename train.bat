@echo off
chcp 65001 >nul
title MammoAI - Model Trenirovkasi

echo ================================================
echo   MammoAI - EfficientNet-B4 Trenirovkasi
echo ================================================
echo.
echo Dataset papkasi tuzilmasi:
echo   backend\data\
echo     train\
echo       Normal\     (mammografiya rasmlari)
echo       Benign\     (mammografiya rasmlari)
echo       Malignant\  (mammografiya rasmlari)
echo     val\
echo       Normal\
echo       Benign\
echo       Malignant\
echo.
echo Dataset: https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset
echo.

cd /d "%~dp0backend"
call venv\Scripts\activate.bat

python train.py ^
  --data_dir  "./data" ^
  --output_dir "./model" ^
  --model     "efficientnet_b4" ^
  --epochs    25 ^
  --batch_size 16 ^
  --lr        0.0001

echo.
echo Model saqlandi: backend\model\mammo_model.pth
echo Serverni qayta ishga tushiring: start_backend.bat
pause
