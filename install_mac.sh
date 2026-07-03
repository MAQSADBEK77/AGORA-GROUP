#!/bin/bash
echo "================================================"
echo "  MammoAI - Python va Node.js tekshirish"
echo "================================================"
echo ""

# Python tekshirish
if command -v python3 &>/dev/null; then
    echo "[OK] Python topildi: $(python3 --version)"
else
    echo "[!] Python topilmadi. O'rnatilmoqda (Homebrew orqali)..."
    if ! command -v brew &>/dev/null; then
        echo "Homebrew o'rnatilmoqda..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install python@3.11
    echo "[OK] Python o'rnatildi"
fi

# Node.js tekshirish
if command -v node &>/dev/null; then
    echo "[OK] Node.js topildi: $(node --version)"
else
    echo "[!] Node.js topilmadi. O'rnatilmoqda..."
    if ! command -v brew &>/dev/null; then
        echo "Homebrew o'rnatilmoqda..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install node
    echo "[OK] Node.js o'rnatildi"
fi

echo ""
echo "================================================"
echo "  Hammasi tayyor! Endi ishga tushirish uchun:"
echo "  1. ./start_backend.sh  (backend)"
echo "  2. ./start_frontend.sh (frontend)"
echo "================================================"
