"""
MIAS Mammografiya datasetini yuklab, bazaga import qiladi.

Ishga tushirish:
  python setup_demo_data.py

Nima qiladi:
  1. Kaggle dan MIAS datasetini yuklab oladi (50MB)
  2. PGM rasmlarni JPG ga o'tkazadi
  3. Label bo'yicha ajratadi: Normal / Benign / Malignant / Very Malignant
  4. Har bir rasm uchun sintetik bemor yaratadi
  5. Bazaga upload qilib, doktor review sifatida saqlaydi
  6. AI darhol ishlashga tayyor bo'ladi
"""

import os, sys, shutil, subprocess, requests, zipfile
from pathlib import Path

# ─── Kutubxonalarni tekshirish ───

def install(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

try:
    from PIL import Image
except ImportError:
    print("Pillow o'rnatilmoqda...")
    install("pillow")
    from PIL import Image

try:
    import numpy as np
except ImportError:
    print("numpy o'rnatilmoqda...")
    install("numpy")
    import numpy as np

try:
    import kaggle
except ImportError:
    print("kaggle o'rnatilmoqda...")
    install("kaggle")

# ─── Sozlamalar ───

BASE_DIR    = Path(__file__).parent
DATA_DIR    = BASE_DIR / "mias_data"
UPLOAD_DIR  = BASE_DIR / "uploads"
DB_PATH     = BASE_DIR / "mammoai.db"

# MIAS INFO.txt label mapping
# CLASS: NORM=normal, CALC=calcification, MASS=mass, ASYM=asymmetry, ARCH=arch, MISC=misc
# SEVERITY: B=benign, M=malignant, (bo'sh)=normal

def parse_mias_info(info_path: Path) -> list[dict]:
    """MIAS INFO.txt ni o'qib label list qaytaradi."""
    records = []
    with open(info_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("%"):
                continue
            parts = line.split()
            if len(parts) < 3:
                continue

            ref      = parts[0]          # mdb001
            bg       = parts[1]          # G/F/D
            cls      = parts[2]          # NORM/CALC/MASS/...
            severity = parts[3] if len(parts) > 3 else ""  # B/M/""

            # 4 ta labelga moslashtirish
            if cls == "NORM":
                label = "Normal"
            elif severity == "B":
                label = "Benign"
            elif severity == "M":
                # Malignant va Very Malignant: radius bo'yicha ajratish
                radius = int(parts[6]) if len(parts) > 6 else 0
                label  = "Very Malignant" if radius > 150 else "Malignant"
            else:
                continue  # Noma'lum

            records.append({"ref": ref, "label": label})

    return records


def pgm_to_jpg(pgm_path: Path, jpg_path: Path):
    """PGM rasmni JPG ga o'tkazadi."""
    img = Image.open(pgm_path).convert("RGB")
    img.save(jpg_path, "JPEG", quality=90)


def download_mias():
    """Kaggle dan MIAS yuklab oladi."""
    DATA_DIR.mkdir(exist_ok=True)
    print("\n[1/4] MIAS dataset yuklanmoqda (50MB)...")

    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json.exists():
        print("\n  kaggle.json topilmadi!")
        print("  1. kaggle.com → Settings → API → Create New Token")
        print("  2. kaggle.json ni C:\\Users\\<ism>\\.kaggle\\ ga qo'ying")
        json_path = input("  Yoki kaggle.json yo'lini kiriting: ").strip().strip('"')
        if json_path and Path(json_path).exists():
            dest = Path.home() / ".kaggle"
            dest.mkdir(exist_ok=True)
            shutil.copy(json_path, dest / "kaggle.json")
            os.chmod(dest / "kaggle.json", 0o600)
        else:
            print("  kaggle.json kerak. Chiqilmoqda.")
            sys.exit(1)

    os.chdir(DATA_DIR)
    os.system("kaggle datasets download -d kmader/mias-mammography --unzip -q")
    os.chdir(BASE_DIR)

    pgm_files = list(DATA_DIR.rglob("*.pgm"))
    print(f"  {len(pgm_files)} ta PGM rasm topildi")
    return pgm_files


def convert_and_organize(records: list[dict], pgm_dir: Path) -> dict[str, list[Path]]:
    """Rasmlarni JPG ga o'tkazib papkalarga ajratadi."""
    print("\n[2/4] Rasmlar ajratilmoqda...")
    UPLOAD_DIR.mkdir(exist_ok=True)

    organized: dict[str, list[Path]] = {
        "Normal": [], "Benign": [], "Malignant": [], "Very Malignant": []
    }

    for rec in records:
        pgm_candidates = list(pgm_dir.rglob(f"{rec['ref']}*.pgm"))
        if not pgm_candidates:
            continue
        pgm_path = pgm_candidates[0]
        jpg_name = f"{rec['ref']}_{rec['label'].replace(' ','_')}.jpg"
        jpg_path = UPLOAD_DIR / jpg_name

        try:
            pgm_to_jpg(pgm_path, jpg_path)
            organized[rec["label"]].append(jpg_path)
        except Exception as e:
            print(f"  [!] {pgm_path.name}: {e}")

    for lbl, files in organized.items():
        print(f"  {lbl}: {len(files)} ta rasm")

    return organized


def import_to_db(organized: dict[str, list[Path]]):
    """Rasmlarni bazaga import qiladi (patient + image + doctor_review)."""
    print("\n[3/4] Bazaga import qilinmoqda...")

    # Django/FastAPI import yo'li
    sys.path.insert(0, str(BASE_DIR))
    os.environ.setdefault("UPLOAD_DIR", str(UPLOAD_DIR))

    import sqlite3, uuid
    from datetime import datetime

    conn = sqlite3.connect(str(DB_PATH))
    cur  = conn.cursor()

    # Admin user id
    cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("  Admin topilmadi. Avval serverni bir marta yoqing.")
        conn.close()
        return
    admin_id = row[0]

    # Radiolog user (yo'q bo'lsa admin ishlatadi)
    cur.execute("SELECT id FROM users WHERE role='radiolog' LIMIT 1")
    rad = cur.fetchone()
    doctor_id = rad[0] if rad else admin_id

    total = 0
    for label_str, jpg_files in organized.items():
        for i, jpg_path in enumerate(jpg_files):
            # Sintetik bemor
            patient_name = f"Demo Bemor {label_str} {i+1}"
            cur.execute(
                "INSERT INTO patients (full_name, birth_year, created_at) VALUES (?,?,?)",
                (patient_name, 1960 + (i % 30), datetime.utcnow().isoformat())
            )
            patient_id = cur.lastrowid

            # Image
            cur.execute("""
                INSERT INTO mammography_images
                  (patient_id, uploaded_by, filename, file_path, file_format, status, uploaded_at)
                VALUES (?,?,?,?,?,?,?)
            """, (
                patient_id, admin_id,
                jpg_path.name, str(jpg_path),
                "JPG", "reviewed",
                datetime.utcnow().isoformat()
            ))
            image_id = cur.lastrowid

            # DoctorReview
            cur.execute("""
                INSERT INTO doctor_reviews
                  (image_id, doctor_id, label, description, reviewed_at)
                VALUES (?,?,?,?,?)
            """, (
                image_id, doctor_id, label_str,
                f"MIAS dataset — {label_str} sinf (demo ma'lumot)",
                datetime.utcnow().isoformat()
            ))
            total += 1

        conn.commit()
        print(f"  {label_str}: {len(jpg_files)} ta saqlandi")

    conn.close()
    print(f"\n  Jami {total} ta rasm import qilindi!")


def build_embeddings():
    """Barcha import qilingan rasmlar uchun embedding yaratadi."""
    print("\n[4/4] AI uchun embedding yaratilmoqda...")
    sys.path.insert(0, str(BASE_DIR))
    os.environ.setdefault("UPLOAD_DIR", str(UPLOAD_DIR))

    import sqlite3
    try:
        from app.ai.embeddings import extract, save_embedding
    except Exception as e:
        print(f"  Embedding moduli yuklanmadi: {e}")
        return

    conn = sqlite3.connect(str(DB_PATH))
    cur  = conn.cursor()
    cur.execute("SELECT id, file_path FROM mammography_images WHERE status='reviewed'")
    images = cur.fetchall()
    conn.close()

    done = 0
    for image_id, file_path in images:
        if not Path(file_path).exists():
            continue
        try:
            emb = extract(file_path)
            save_embedding(image_id, emb)
            done += 1
        except Exception:
            pass

    print(f"  {done}/{len(images)} ta embedding yaratildi")


def main():
    print("=" * 55)
    print("  MammoAI — MIAS Demo Data Import")
    print("=" * 55)

    # Kaggle mavjudmi tekshirish
    pgm_files = list(DATA_DIR.rglob("*.pgm")) if DATA_DIR.exists() else []

    if not pgm_files:
        pgm_files = download_mias()

    # INFO.txt topish
    info_candidates = list(DATA_DIR.rglob("*.txt")) + list(DATA_DIR.rglob("Info.txt"))
    info_file = next((f for f in info_candidates if "info" in f.name.lower()), None)

    if info_file:
        records = parse_mias_info(info_file)
    else:
        # Fayllar nomi bo'yicha label taxmin qilish
        print("  INFO.txt topilmadi, fayl nomi bo'yicha label qilinmoqda...")
        records = []
        for pgm in pgm_files:
            # MIAS da mdb001-mdb053 = normal, qolganlar aralash
            num = int(''.join(filter(str.isdigit, pgm.stem[:6])) or 0)
            if num <= 53:
                label = "Normal"
            elif num <= 150:
                label = "Benign"
            elif num <= 270:
                label = "Malignant"
            else:
                label = "Very Malignant"
            records.append({"ref": pgm.stem, "label": label})

    pgm_dir    = DATA_DIR
    organized  = convert_and_organize(records, pgm_dir)
    import_to_db(organized)
    build_embeddings()

    total = sum(len(v) for v in organized.values())
    print(f"\n{'='*55}")
    print(f"  Tayyor! {total} ta rasm bazaga qo'shildi.")
    print(f"  Serverni qayta yoqing: start_backend.bat")
    print(f"  Radiolog sifatida kirish → 'Ko'rib Chiqish' → 'AI dan so'rang'")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
