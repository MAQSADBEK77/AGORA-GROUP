#!/bin/bash
echo "================================================"
echo "  AI kutubxonalar o'rnatilmoqda (PyTorch CPU)"
echo "  ~500MB yuklanadi, internet kerak"
echo "================================================"
echo ""

cd "$(dirname "$0")/../backend"
source venv/bin/activate

echo "[1/2] PyTorch CPU o'rnatilmoqda..."
pip install torch==2.3.0 torchvision==0.18.0 --index-url https://download.pytorch.org/whl/cpu

echo "[2/2] Qolgan kutubxonalar..."
pip install timm==1.0.3 opencv-python-headless==4.9.0.80 pydicom==2.4.4 pandas scikit-learn

echo ""
echo "================================================"
echo "  Tayyor! Endi train.sh bilan model treniring qiling."
echo "================================================"
