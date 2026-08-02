"""
MammoAI — ConvNeXt tasniflagichini o'qitish (FAST yoki PRODUCTION profil).

Ishga tushirish:
  python -m app.ai.training.train

Muhim o'zgaruvchilar (ai/config.py'da to'liq ro'yxati):
  AI_PROFILE=fast|production
  AI_EPOCHS, AI_BATCH_SIZE, AI_INPUT_SIZE, AI_MAX_TRAINING_MINUTES ...

Vaqt byudjeti (AI_MAX_TRAINING_MINUTES) tugashiga yaqinlashsa, joriy epoch
tugagach o'qitish TO'XTAYDI va ENG YAXSHI checkpoint saqlanadi — hech qachon
"vaqt tugadi" sababli model yo'qolmaydi.
"""
import json
import os
import time

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import roc_auc_score, average_precision_score

from ..config import load_config
from ..models.convnext_model import MammographyClassifier, resolve_device, save_checkpoint
from ..models.registry import record_model
from ..preprocessing.transforms import train_transform, inference_transform
from .dataset import MammographyDataset
from .dataset_prep import build_manifest, save_manifest, summarize

MODEL_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "model")
MANIFEST_PATH = os.path.join(MODEL_ROOT, "manifest.json")


def ensure_manifest():
    if not os.path.exists(MANIFEST_PATH):
        print("Manifest topilmadi, yaratilmoqda...")
        entries = build_manifest()
        save_manifest(entries, MANIFEST_PATH)
        summarize(entries)


@torch.no_grad()
def evaluate(model, loader, device, autocast_device):
    model.eval()
    all_probs, all_labels = [], []
    total_loss = 0.0
    criterion = nn.BCEWithLogitsLoss()
    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device).unsqueeze(1)
        with torch.autocast(device_type=autocast_device, enabled=(autocast_device != "cpu")):
            logits = model(images)
            loss = criterion(logits, labels)
        total_loss += loss.item() * images.size(0)
        probs = torch.sigmoid(logits).float().cpu().numpy().flatten()
        all_probs.extend(probs.tolist())
        all_labels.extend(labels.cpu().numpy().flatten().tolist())

    avg_loss = total_loss / len(loader.dataset)
    try:
        roc_auc = roc_auc_score(all_labels, all_probs)
        pr_auc = average_precision_score(all_labels, all_probs)
    except ValueError:
        # Val to'plamida bitta klass bo'lsa (juda kichik namunada bo'lishi mumkin)
        roc_auc, pr_auc = float("nan"), float("nan")
    return avg_loss, roc_auc, pr_auc


def train():
    cfg = load_config()
    ensure_manifest()

    device = resolve_device(cfg.device)
    autocast_device = "cuda" if device.type == "cuda" else ("mps" if device.type == "mps" else "cpu")
    print(f"{'='*60}\nMammoAI ConvNeXt o'qitish — profil: {cfg.profile}")
    print(f"Device: {device} | Model: {cfg.model_name} | Rasm o'lchami: {cfg.image_size}")
    print(f"Epochlar: {cfg.epochs} | Batch: {cfg.batch_size} | Vaqt limiti: {cfg.max_training_minutes} daqiqa")
    print(f"{'='*60}\n")

    train_ds = MammographyDataset(MANIFEST_PATH, "train", transform=train_transform(cfg.image_size))
    val_ds = MammographyDataset(MANIFEST_PATH, "val", transform=inference_transform(cfg.image_size))
    print(f"Train: {len(train_ds)} rasm | Val: {len(val_ds)} rasm\n")

    train_loader = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True,
                              num_workers=cfg.num_workers)
    val_loader = DataLoader(val_ds, batch_size=cfg.batch_size, shuffle=False,
                            num_workers=cfg.num_workers)

    model = MammographyClassifier(cfg.model_name, pretrained=True,
                                  freeze_backbone=cfg.freeze_backbone).to(device)

    # Sinf muvozanatsizligi uchun pos_weight (Malignant kamroq bo'lsa og'irroq hisoblanadi)
    n_pos = sum(1 for e in train_ds.entries if e["label"] == 1)
    n_neg = sum(1 for e in train_ds.entries if e["label"] == 0)
    pos_weight = torch.tensor([n_neg / max(n_pos, 1)], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    print(f"Sinf muvozanati: {n_neg} Benign / {n_pos} Malignant -> pos_weight={pos_weight.item():.2f}\n")

    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                                   lr=cfg.learning_rate)

    best_roc_auc = -1.0
    best_state = None
    history = []
    start_time = time.time()
    time_budget_s = cfg.max_training_minutes * 60 if cfg.max_training_minutes > 0 else None

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device).unsqueeze(1)

            optimizer.zero_grad()
            with torch.autocast(device_type=autocast_device, enabled=(cfg.amp and autocast_device != "cpu")):
                logits = model(images)
                loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)

        train_loss = running_loss / len(train_ds)
        val_loss, roc_auc, pr_auc = evaluate(model, val_loader, device, autocast_device)

        elapsed = time.time() - start_time
        marker = ""
        if not (roc_auc != roc_auc) and roc_auc > best_roc_auc:  # NaN xavfsiz solishtirish
            best_roc_auc = roc_auc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            marker = " *"

        print(f"Epoch {epoch:3d}/{cfg.epochs} | train_loss={train_loss:.4f} | "
              f"val_loss={val_loss:.4f} | ROC-AUC={roc_auc:.4f} | PR-AUC={pr_auc:.4f} | "
              f"{elapsed:.0f}s{marker}")

        history.append({
            "epoch": epoch, "train_loss": train_loss, "val_loss": val_loss,
            "roc_auc": roc_auc, "pr_auc": pr_auc, "elapsed_seconds": elapsed,
        })

        if time_budget_s and elapsed > time_budget_s:
            print(f"\nVaqt byudjeti ({cfg.max_training_minutes} daq) tugadi — "
                  f"joriy epoch yakunlanib, o'qitish to'xtatilmoqda.")
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    os.makedirs(cfg.model_dir, exist_ok=True)
    save_checkpoint(model, cfg.checkpoint_path, extra={
        "model_version": cfg.model_version,
        "image_size": cfg.image_size,
        "best_roc_auc": best_roc_auc,
        "profile": cfg.profile,
    })

    metrics_path = os.path.join(cfg.model_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump({
            "model_version": cfg.model_version,
            "profile": cfg.profile,
            "best_roc_auc": best_roc_auc,
            "history": history,
            "train_size": len(train_ds),
            "val_size": len(val_ds),
        }, f, indent=2)

    record_model(cfg.model_dir, {
        "model_name": cfg.model_name,
        "model_version": cfg.model_version,
        "profile": cfg.profile,
        "checkpoint_path": cfg.checkpoint_path,
        "image_size": cfg.image_size,
        "roc_auc": best_roc_auc,
        "train_size": len(train_ds),
        "val_size": len(val_ds),
        "epochs_run": len(history),
        "dataset_version": "cbis-ddsm-sample-500",
    })

    print(f"\n{'='*60}")
    print(f"O'qitish tugadi. Eng yaxshi ROC-AUC: {best_roc_auc:.4f}")
    print(f"Checkpoint: {cfg.checkpoint_path}")
    print(f"Metrikalar: {metrics_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    train()
