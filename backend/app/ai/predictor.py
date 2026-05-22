"""
Notebook bilan mos predictor:
  - ResNet18 (pretrained=True, fc -> 2 klass)
  - Klasslar: 0=normal, 1=cancer
  - Transform: Resize(224), ToTensor, Normalize([0.5,0.5,0.5],[0.5,0.5,0.5])
  - Model fayli: model_breast.pth
"""

import os
import numpy as np
from PIL import Image

UPLOAD_DIR  = os.getenv("UPLOAD_DIR", "./uploads")
MODEL_PATH  = os.getenv("MODEL_PATH", "./model/model_breast.pth")
HEATMAP_DIR = os.path.join(UPLOAD_DIR, "heatmaps")
NUM_CLASSES = 2
CLASSES     = ["Normal", "Cancer"]

_model   = None
_device  = None
_torch_ok = False

try:
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
    import torchvision.transforms as T
    _device   = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _torch_ok = True
except ImportError:
    pass

# Notebook dagi transform bilan to'liq mos
_TRANSFORM = None
if _torch_ok:
    import torchvision.transforms as T
    _TRANSFORM = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
    ])


def model_is_ready() -> bool:
    return _torch_ok and os.path.exists(MODEL_PATH)


def _load_model():
    global _model
    if _model is not None:
        return _model

    model = tv_models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=_device))
    model.to(_device)
    model.eval()
    _model = model
    print(f"[MammoAI] Model yuklandi: {MODEL_PATH}")
    return _model


# ─────────────── Heuristic fallback (deterministik) ───────────────

def _heuristic_predict(image_path: str) -> dict:
    try:
        img  = Image.open(image_path).convert("L").resize((224, 224))
        gray = np.array(img, dtype=np.float32)
    except Exception:
        return {"predicted_class": 0, "confidence": 0.65,
                "probabilities": [0.65, 0.35], "heatmap_path": None, "mode": "heuristic"}

    tissue_mask = gray > 25
    if tissue_mask.sum() < 500:
        return {"predicted_class": 0, "confidence": 0.80,
                "probabilities": [0.80, 0.20], "heatmap_path": None, "mode": "heuristic"}

    tissue = gray[tissue_mask]
    n = len(tissue)

    high_density = float(np.sum(tissue > 170) / n)
    very_bright  = float(np.sum(tissue > 230) / n)
    cx = np.abs(np.arange(224) - 112) / 112.0
    cy = np.abs(np.arange(224).reshape(-1, 1) - 112) / 112.0
    periph = float(((gray > 180) * ((cx + cy) > 1.2)).mean())

    cancer_score = high_density * 0.45 + very_bright * 0.35 + periph * 0.20
    cancer_score = min(max(cancer_score, 0.0), 1.0)
    normal_score = 1.0 - cancer_score

    probs = [normal_score, cancer_score]
    cls   = int(np.argmax(probs))
    return {"predicted_class": cls, "confidence": float(probs[cls]),
            "probabilities": probs, "heatmap_path": None, "mode": "heuristic"}


# ─────────────── Grad-CAM ───────────────

def _run_gradcam(model, tensor, cls_idx: int,
                 orig_img: Image.Image, image_id: int):
    try:
        import torch, cv2
        os.makedirs(HEATMAP_DIR, exist_ok=True)
        save_path = os.path.join(HEATMAP_DIR, f"heatmap_{image_id}.png")

        grads, acts = [], []

        def fwd_hook(m, inp, out):
            acts.append(out)
            out.register_hook(lambda g: grads.append(g))

        # ResNet18 ning oxirgi conv layeri: layer4
        hook = model.layer4.register_forward_hook(fwd_hook)
        model.zero_grad()
        out = model(tensor)
        out[0, cls_idx].backward()
        hook.remove()

        if not grads or not acts:
            return None

        g   = grads[0].squeeze().cpu().numpy()
        a   = acts[0].squeeze().cpu().numpy()
        w   = g.mean(axis=(1, 2))
        cam = np.zeros(a.shape[1:], dtype=np.float32)
        for i, wi in enumerate(w):
            cam += wi * a[i]
        cam = np.maximum(cam, 0)
        if cam.max() > 0:
            cam /= cam.max()

        W, H   = orig_img.size
        cam_up = cv2.resize(cam, (W, H))
        heat   = cv2.applyColorMap(np.uint8(255 * cam_up), cv2.COLORMAP_JET)
        heat   = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
        orig   = np.array(orig_img.convert("RGB"))
        blend  = (0.5 * orig + 0.5 * heat).astype(np.uint8)
        Image.fromarray(blend).save(save_path)
        return save_path
    except Exception:
        return None


# ─────────────── Asosiy funksiya ───────────────

def predict_image(image_path: str, image_id: int) -> dict:
    if not model_is_ready():
        return _heuristic_predict(image_path)

    try:
        model  = _load_model()
        img    = Image.open(image_path).convert("RGB")
        tensor = _TRANSFORM(img).unsqueeze(0).to(_device)

        with torch.no_grad():
            logits = model(tensor)
            probs  = torch.softmax(logits, dim=1).squeeze().cpu().numpy()

        cls  = int(probs.argmax())
        conf = float(probs[cls])

        heatmap = _run_gradcam(model, tensor, cls, img, image_id)

        return {
            "predicted_class": cls,
            "confidence":      conf,
            "probabilities":   probs.tolist(),
            "heatmap_path":    heatmap,
            "mode":            "model",
        }
    except Exception as e:
        print(f"[MammoAI] Model xatosi: {e}")
        return _heuristic_predict(image_path)
