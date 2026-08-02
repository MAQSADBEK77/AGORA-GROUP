"""
CBIS-DDSM namunaviy datasetidan (cbis_data/jpeg_sample, 500 rasm) BEMOR
DARAJASIDA train/val manifest yaratadi.

MUHIM: bitta bemorning bir nechta rasmi (CC/MLO, chap/o'ng) bo'lishi mumkin.
Agar tasodifiy (rasm darajasida) bo'linsa, bir xil bemorning rasmlari HAM
train'da, HAM val'da paydo bo'lishi mumkin — bu "data leakage" (model
val to'plamida "tanigan" bemorni ko'radi, natija soxta yuqori chiqadi).
Shu sababli BEMOR ID (mapping.json/sample_500.json'dagi patient_id) bo'yicha
bo'linadi — bitta bemor faqat bitta to'plamda (yo train, yo val) bo'ladi.

Natija: model_dir/manifest.json — [{"path":..., "label":..., "patient_id":..., "split":...}]
"""
import json
import os
import random

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "cbis_data")
JPEG_DIR = os.path.join(DATA_DIR, "jpeg_sample")
SAMPLE_JSON = os.path.join(DATA_DIR, "sample_500.json")

LABEL_TO_INT = {"Benign": 0, "Malignant": 1}


def build_manifest(val_ratio: float = 0.2, seed: int = 42) -> list[dict]:
    with open(SAMPLE_JSON) as f:
        sample = json.load(f)

    files = sorted(os.listdir(JPEG_DIR))
    # sample_500.json va jpeg_sample fayllari indeks bo'yicha mos keladi
    # (0000_Label.jpg -> sample[0], tekshirilgan)
    entries = []
    for idx, fname in enumerate(files):
        if idx >= len(sample):
            break
        meta = sample[idx]
        entries.append({
            "path": os.path.join(JPEG_DIR, fname),
            "label": LABEL_TO_INT[meta["label"]],
            "label_name": meta["label"],
            "patient_id": meta["patient_id"],
        })

    # Bemor -> shu bemorning har qanday rasmida Malignant bormi (stratifikatsiya uchun)
    patient_has_malignant: dict[str, bool] = {}
    for e in entries:
        pid = e["patient_id"]
        patient_has_malignant[pid] = patient_has_malignant.get(pid, False) or (e["label"] == 1)

    malignant_patients = sorted([p for p, has in patient_has_malignant.items() if has])
    benign_patients = sorted([p for p, has in patient_has_malignant.items() if not has])

    rng = random.Random(seed)
    rng.shuffle(malignant_patients)
    rng.shuffle(benign_patients)

    def split_patients(patients):
        n_val = max(1, int(len(patients) * val_ratio))
        return set(patients[n_val:]), set(patients[:n_val])

    train_mal, val_mal = split_patients(malignant_patients)
    train_ben, val_ben = split_patients(benign_patients)
    train_patients = train_mal | train_ben
    val_patients = val_mal | val_ben

    for e in entries:
        e["split"] = "train" if e["patient_id"] in train_patients else "val"

    return entries


def save_manifest(entries: list[dict], out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def summarize(entries: list[dict]):
    for split in ("train", "val"):
        subset = [e for e in entries if e["split"] == split]
        n_patients = len(set(e["patient_id"] for e in subset))
        n_mal = sum(1 for e in subset if e["label"] == 1)
        n_ben = sum(1 for e in subset if e["label"] == 0)
        print(f"  {split}: {len(subset)} rasm, {n_patients} bemor "
              f"({n_ben} Benign / {n_mal} Malignant)")


if __name__ == "__main__":
    entries = build_manifest()
    out_path = os.path.join(os.path.dirname(DATA_DIR), "model", "manifest.json")
    save_manifest(entries, out_path)
    print(f"Manifest saqlandi: {out_path}")
    summarize(entries)

    # Leakage tekshiruvi: bir xil bemor ikkala to'plamda bo'lmasligi kerak
    train_p = set(e["patient_id"] for e in entries if e["split"] == "train")
    val_p = set(e["patient_id"] for e in entries if e["split"] == "val")
    overlap = train_p & val_p
    assert not overlap, f"DATA LEAKAGE: {len(overlap)} bemor ikkala to'plamda ham bor!"
    print("  Leakage tekshiruvi: OK (train/val bemorlari kesishmaydi)")
