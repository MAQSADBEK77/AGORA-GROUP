#!/bin/bash
echo "================================================"
echo "  MammoAI Backend ishga tushmoqda..."
echo "================================================"

cd "$(dirname "$0")/backend"

PYTHON=~/miniconda3/envs/mammoai/bin/python
PIP=~/miniconda3/envs/mammoai/bin/pip
UVICORN=~/miniconda3/envs/mammoai/bin/uvicorn

echo "[1/2] Kutubxonalar tekshirilmoqda..."
$PIP install -r requirements.txt -q

echo "[2/2] Server ishga tushmoqda..."
echo ""
echo "  API:  http://localhost:8000"
echo "  Docs: http://localhost:8000/docs"
echo ""
$UVICORN app.main:app --host 0.0.0.0 --port 8000 --reload
