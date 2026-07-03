#!/bin/bash
echo "================================================"
echo "  MammoAI - MIAS Dataset Import"
echo "  (50MB Kaggle dan yuklanadi)"
echo "================================================"
echo ""

cd "$(dirname "$0")/backend"
source venv/bin/activate

pip install requests pillow numpy -q

echo ""
echo "Boshlashdan avval:"
echo "  1. kaggle.com ga kiring"
echo "  2. Settings > API > Create New Token"
echo "  3. Yuklab olingan kaggle.json ni:"
echo "     ~/.kaggle/  papkasiga qo'ying"
echo ""
read -p "Davom etish uchun Enter bosing..."

mkdir -p ~/.kaggle
if [ ! -f "$(dirname "$0")/kaggle.json" ]; then
    echo "[!] kaggle.json topilmadi. ~/.kaggle/ papkasiga qo'ying."
    exit 1
fi
cp "$(dirname "$0")/kaggle.json" ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json

python setup_demo_data.py
