"""
MammoAI - Model trenirovkasi
Dataset: CBIS-DDSM (Kaggle) yoki oddiy papka tuzilmasi

Papka tuzilmasi (ikkala format qo'llab-quvvatlanadi):

FORMAT 1 - Oddiy:
  data/
    train/
      Normal/    *.jpg, *.png
      Benign/    *.jpg, *.png
      Malignant/ *.jpg, *.png
    val/
      Normal/
      Benign/
      Malignant/

FORMAT 2 - CBIS-DDSM (Kaggle):
  data/
    jpeg/
      Mass-Training Full Mammogram Images/
      Mass-Test Full Mammogram Images/
    csv/
      mass_case_description_train_set.csv
      mass_case_description_test_set.csv

Ishga tushirish:
  python train.py --data_dir ./data --epochs 20 --batch_size 16
"""

import argparse
import os
import time
import copy
import json
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
import torchvision.transforms as transforms
from PIL import Image
import numpy as np

try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    import torchvision.models as tv_models
    TIMM_AVAILABLE = False

CLASSES = ["Normal", "Benign", "Malignant"]
NUM_CLASSES = 3

# ──────────────────────────── Transforms ────────────────────────────

TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

VAL_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ──────────────────────────── Dataset ────────────────────────────

class MammoDataset(Dataset):
    def __init__(self, root_dir: str, split: str = "train", transform=None):
        self.transform = transform
        self.samples = []

        split_dir = Path(root_dir) / split
        if not split_dir.exists():
            raise FileNotFoundError(f"Topilmadi: {split_dir}")

        for label_idx, class_name in enumerate(CLASSES):
            class_dir = split_dir / class_name
            if not class_dir.exists():
                print(f"  [!] {class_name} papkasi topilmadi, o'tkazildi")
                continue
            files = list(class_dir.glob("*.jpg")) + \
                    list(class_dir.glob("*.jpeg")) + \
                    list(class_dir.glob("*.png"))
            for f in files:
                self.samples.append((str(f), label_idx))

        if not self.samples:
            raise ValueError(f"'{split}' papkasida rasm topilmadi!")

        counts = [0] * NUM_CLASSES
        for _, lbl in self.samples:
            counts[lbl] += 1
        print(f"  {split}: Normal={counts[0]}, Benign={counts[1]}, Malignant={counts[2]}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), 0)
        if self.transform:
            img = self.transform(img)
        return img, label

    def get_weights(self):
        counts = [0] * NUM_CLASSES
        for _, lbl in self.samples:
            counts[lbl] += 1
        weights = []
        for _, lbl in self.samples:
            weights.append(1.0 / (counts[lbl] + 1e-8))
        return weights


# ──────────────────────────── Model ────────────────────────────

def build_model(num_classes: int, model_name: str = "efficientnet_b4"):
    if TIMM_AVAILABLE:
        model = timm.create_model(model_name, pretrained=True, num_classes=num_classes)
        print(f"  Model: {model_name} (timm, pretrained ImageNet)")
    else:
        model = tv_models.resnet50(weights=tv_models.ResNet50_Weights.IMAGENET1K_V1)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        print("  Model: ResNet50 (torchvision, pretrained ImageNet)")
    return model


# ──────────────────────────── Training ────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*55}")
    print(f"  MammoAI Model Trenirovkasi")
    print(f"  Device: {device}")
    print(f"  Epochs: {args.epochs} | Batch: {args.batch_size} | LR: {args.lr}")
    print(f"{'='*55}")

    print("\n[1/4] Dataset yuklanmoqda...")
    train_ds = MammoDataset(args.data_dir, "train", TRAIN_TRANSFORM)
    val_ds   = MammoDataset(args.data_dir, "val",   VAL_TRANSFORM)

    # Class imbalance uchun weighted sampler
    weights  = train_ds.get_weights()
    sampler  = WeightedRandomSampler(weights, len(weights))

    train_loader = DataLoader(train_ds, batch_size=args.batch_size,
                              sampler=sampler, num_workers=0, pin_memory=False)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size,
                              shuffle=False, num_workers=0)

    print("\n[2/4] Model qurilmoqda...")
    model = build_model(NUM_CLASSES, args.model).to(device)

    # Class weights (imbalance uchun)
    counts = [0] * NUM_CLASSES
    for _, lbl in train_ds.samples:
        counts[lbl] += 1
    cw = torch.tensor([1.0 / (c + 1e-8) for c in counts], dtype=torch.float).to(device)
    cw = cw / cw.sum() * NUM_CLASSES

    criterion = nn.CrossEntropyLoss(weight=cw, label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_acc  = 0.0
    best_weights = copy.deepcopy(model.state_dict())
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    print("\n[3/4] Trenirovka boshlanmoqda...\n")
    for epoch in range(1, args.epochs + 1):
        # --- Train ---
        model.train()
        t_loss, t_correct, t_total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            t_loss    += loss.item() * imgs.size(0)
            t_correct += (outputs.argmax(1) == labels).sum().item()
            t_total   += imgs.size(0)

        # --- Val ---
        model.eval()
        v_loss, v_correct, v_total = 0.0, 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                loss = criterion(outputs, labels)
                v_loss    += loss.item() * imgs.size(0)
                v_correct += (outputs.argmax(1) == labels).sum().item()
                v_total   += imgs.size(0)

        scheduler.step()

        t_acc = t_correct / t_total * 100
        v_acc = v_correct / v_total * 100
        history["train_loss"].append(t_loss / t_total)
        history["train_acc"].append(t_acc)
        history["val_loss"].append(v_loss / v_total)
        history["val_acc"].append(v_acc)

        marker = " ★ BEST" if v_acc > best_acc else ""
        print(f"  Epoch {epoch:3d}/{args.epochs}  "
              f"train_acc={t_acc:.1f}%  val_acc={v_acc:.1f}%  "
              f"lr={scheduler.get_last_lr()[0]:.6f}{marker}")

        if v_acc > best_acc:
            best_acc = v_acc
            best_weights = copy.deepcopy(model.state_dict())

    print(f"\n[4/4] Model saqlanmoqda...")
    os.makedirs(args.output_dir, exist_ok=True)
    model_path = os.path.join(args.output_dir, "mammo_model.pth")
    torch.save(best_weights, model_path)

    meta = {"model": args.model, "classes": CLASSES,
            "best_val_acc": round(best_acc, 2), "epochs": args.epochs}
    with open(os.path.join(args.output_dir, "model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{'='*55}")
    print(f"  Trenirovka tugadi!")
    print(f"  Eng yaxshi val aniqlik: {best_acc:.1f}%")
    print(f"  Model saqlandi: {model_path}")
    print(f"{'='*55}\n")
    return model_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MammoAI model trenirovkasi")
    parser.add_argument("--data_dir",   default="./data",    help="Dataset papkasi")
    parser.add_argument("--output_dir", default="./model",   help="Model saqlanadigan joy")
    parser.add_argument("--model",      default="efficientnet_b4", help="timm model nomi")
    parser.add_argument("--epochs",     type=int, default=25)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--lr",         type=float, default=1e-4)
    args = parser.parse_args()
    train(args)
