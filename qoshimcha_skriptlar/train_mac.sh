#!/bin/bash
echo "================================================"
echo "  MammoAI - ResNet18 Trenirovkasi (CBIS-DDSM)"
echo "================================================"
echo ""

cd "$(dirname "$0")/../backend"
source venv/bin/activate

pip install pandas -q

echo ""
echo "1-qadam: Dataset tayyorlash"
echo "  Avval Kaggle dan dataset yuklab oling:"
echo "  https://www.kaggle.com/datasets/awsaf49/cbis-ddsm-breast-cancer-image-dataset"
echo ""
echo "  Keyin quyidagi yo'lni kiriting:"
echo ""

read -p "CBIS-DDSM papkasi yo'lini kiriting: " DATASET_DIR

if [ -z "$DATASET_DIR" ]; then
    echo "Yo'l kiritilmadi. Chiqilmoqda..."
    exit 1
fi

echo ""
echo "Dataset tayyorlanmoqda..."
python prepare_dataset.py --dataset_dir "$DATASET_DIR" --output_dir "./data"

echo ""
echo "2-qadam: Trenirovka boshlanmoqda (25 epoch)..."
echo ""
python train.py --data_dir "./data" --output_dir "./model" --epochs 25 --batch_size 16 --lr 0.001

echo ""
echo "================================================"
echo "  Model saqlandi: backend/model/model_breast.pth"
echo "  Serverni qayta ishga tushiring: ./start_backend_mac.sh"
echo "================================================"
