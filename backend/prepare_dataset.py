"""
CBIS-DDSM datasetini train.py uchun tayyorlaydi.

Kaggle dan yuklab olgandan keyin:
  python prepare_dataset.py --dataset_dir "C:/path/to/cbis-ddsm-breast-cancer-image-dataset"

Dataset tuzilmasi (Kaggle dan keyin):
  cbis-ddsm/
    csv/
      mass_case_description_train_set.csv
      mass_case_description_test_set.csv
      calc_case_description_train_set.csv
      calc_case_description_test_set.csv
    jpeg/
      Mass-Training Full Mammogram Images/
      Mass-Test Full Mammogram Images/
      Calc-Training Full Mammogram Images/
      Calc-Test Full Mammogram Images/

Natija (train.py uchun tayyor):
  data/
    train/
      normal/   (BENIGN rasmlari)
      cancer/   (MALIGNANT rasmlari)
    val/
      normal/
      cancer/
"""

import os
import shutil
import argparse
import random
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("pandas o'rnatilmagan. O'rnatish: pip install pandas")
    exit(1)

# CBIS-DDSM label → bizning 2 klass
LABEL_MAP = {
    "MALIGNANT":              "cancer",
    "BENIGN":                 "normal",
    "BENIGN_WITHOUT_CALLBACK": "normal",
}

CSV_FILES = [
    ("csv/mass_case_description_train_set.csv", "train"),
    ("csv/mass_case_description_test_set.csv",  "val"),
    ("csv/calc_case_description_train_set.csv", "train"),
    ("csv/calc_case_description_test_set.csv",  "val"),
]


def find_image(jpeg_root: Path, partial_path: str) -> Path | None:
    """CSV dagi nisbiy yo'ldan haqiqiy fayl yo'lini topadi."""
    # To'g'ridan-to'g'ri
    candidate = jpeg_root / partial_path
    if candidate.exists():
        return candidate

    # Faqat fayl nomini olib qidirish
    filename = Path(partial_path).name
    for found in jpeg_root.rglob(filename):
        return found

    # Papka nomiga qarab qidirish
    parts = Path(partial_path).parts
    if len(parts) >= 2:
        subfolder = parts[0]
        for d in jpeg_root.iterdir():
            if d.is_dir() and subfolder.lower() in d.name.lower():
                for found in d.rglob(filename):
                    return found
    return None


def prepare(dataset_dir: str, output_dir: str, val_ratio: float, seed: int):
    random.seed(seed)
    dataset_path = Path(dataset_dir)
    output_path  = Path(output_dir)
    jpeg_root    = dataset_path / "jpeg"

    if not dataset_path.exists():
        print(f"[!] Dataset papkasi topilmadi: {dataset_path}")
        return

    # Papkalar yaratish
    for split in ("train", "val"):
        for cls in ("normal", "cancer"):
            (output_path / split / cls).mkdir(parents=True, exist_ok=True)

    stats = {"train": {"normal": 0, "cancer": 0},
             "val":   {"normal": 0, "cancer": 0}}
    errors = 0

    print(f"\nDataset: {dataset_path}")
    print(f"Output:  {output_path}\n")

    for csv_rel, default_split in CSV_FILES:
        csv_path = dataset_path / csv_rel
        if not csv_path.exists():
            print(f"  [!] CSV topilmadi: {csv_path.name}, o'tkazildi")
            continue

        print(f"  o'qilmoqda: {csv_path.name}")
        df = pd.read_csv(csv_path)

        # Pathology ustuni nomini topish
        path_col  = next((c for c in df.columns if "pathology" in c.lower()), None)
        img_col   = next((c for c in df.columns
                          if "full mammogram" in c.lower() or "image file path" in c.lower()), None)

        if not path_col or not img_col:
            print(f"    [!] Ustun topilmadi. Mavjud ustunlar: {list(df.columns)}")
            continue

        df = df.dropna(subset=[path_col, img_col])

        # Train/val bo'lish (train CSV dan bir qismi val ga ketadi)
        rows = df.to_dict("records")
        if default_split == "train" and val_ratio > 0:
            random.shuffle(rows)
            split_idx  = int(len(rows) * (1 - val_ratio))
            train_rows = rows[:split_idx]
            val_rows   = rows[split_idx:]
            batches    = [("train", train_rows), ("val", val_rows)]
        else:
            batches = [(default_split, rows)]

        for split, batch in batches:
            for row in batch:
                pathology = str(row[path_col]).strip().upper()
                cls       = LABEL_MAP.get(pathology)
                if cls is None:
                    continue

                img_rel  = str(row[img_col]).strip()
                src_path = find_image(jpeg_root, img_rel)

                if src_path is None:
                    errors += 1
                    continue

                # Noyob nom bilan saqlash
                dst_name = f"{split}_{cls}_{stats[split][cls]:05d}{src_path.suffix}"
                dst_path = output_path / split / cls / dst_name
                shutil.copy2(src_path, dst_path)
                stats[split][cls] += 1

    total = sum(v for s in stats.values() for v in s.values())
    print(f"\n{'='*45}")
    print(f"  Tayyor! Jami {total} ta rasm ko'chirildi.")
    print(f"  Train → normal: {stats['train']['normal']}, cancer: {stats['train']['cancer']}")
    print(f"  Val   → normal: {stats['val']['normal']},  cancer: {stats['val']['cancer']}")
    if errors:
        print(f"  [!] {errors} ta rasm topilmadi (DICOM bo'lishi mumkin)")
    print(f"{'='*45}")
    print(f"\n  Endi trenirovkani boshlang:")
    print(f"  python train.py --data_dir {output_dir}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset_dir", required=True,
                        help="Kaggle dan yuklangan CBIS-DDSM papkasi yo'li")
    parser.add_argument("--output_dir",  default="./data",
                        help="Natija papkasi (default: ./data)")
    parser.add_argument("--val_ratio",   type=float, default=0.2,
                        help="Validation ulushi (default: 0.2)")
    parser.add_argument("--seed",        type=int,   default=42)
    args = parser.parse_args()
    prepare(args.dataset_dir, args.output_dir, args.val_ratio, args.seed)
