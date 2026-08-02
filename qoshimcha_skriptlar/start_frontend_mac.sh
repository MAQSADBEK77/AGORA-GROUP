#!/bin/bash
echo "================================================"
echo "  MammoAI Frontend ishga tushmoqda..."
echo "================================================"

cd "$(dirname "$0")/../frontend"

NPM=~/miniconda3/bin/npm

if [ ! -d "node_modules" ]; then
    echo "[1/2] npm paketlar o'rnatilmoqda..."
    $NPM install
fi

echo "[2/2] Frontend server ishga tushmoqda..."
echo ""
echo "  UI: http://localhost:5173"
echo ""
$NPM run dev
