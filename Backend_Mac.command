#!/bin/bash
cd "$(dirname "$0")/backend"
echo "================================================"
echo "  MammoAI Backend ishga tushmoqda..."
echo "================================================"
~/miniconda3/envs/mammoai/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
