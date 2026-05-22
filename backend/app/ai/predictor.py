import os
import json
import numpy as np
from PIL import Image

UPLOAD_DIR  = os.getenv("UPLOAD_DIR", "./uploads")
MODEL_PATH  = os.getenv("MODEL_PATH", "./model/mammo_model.pth")
META_PATH   = os.path.splitext(MODEL_PATH)[0].replace("mammo_model", "model_meta") + ".json"
HEATMAP_DIR = os.path.join(UPLOAD_DIR, "heatmaps")
NUM_CLASSES = 3
CLASSES     = ["Normal", "Benign", "Malignant"]

_model  = None
_device = None
_torch_ok = False

try:
    import torch
    import torch.nn as nn
    _device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _torch_ok = True
except ImportError:
    pass


def _build_model():
    """Model arxitekturasini meta-fayldan yoki default dan quradi."""
    arch = "efficientnet_b4"
    if os.path.exists(META_PATH):
        try:
            with open(META_PATH) as f:
                arch = json.load(f).get("model", arch)
        except Exception:
            pass

    try:
        import timm
        model = timm.create_model(arch, pretrained=False, num_classes=NUM_CLASSES)
    except Exception:
        import torchvision.models as tv
        model = tv.resnet50(weights=None)
        model.fc = __import__("torch").nn.Linear(model.fc.in_features, NUM_CLASSES)

    return model


def _get_transform():
    import torchvision.transforms as T
    return T.Compose([
        T.Resize((224, 224)),
        T.Grayscale(num_output_channels=3),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def _load_model():
    global _model
    if _model is not None:
        return _model
    import torch
    model = _build_model()
    model.load_state_dict(torch.load(MODEL_PATH, map_location=_device))
    model.to(_device)
    model.eval()
    _model = model
    print(f"[MammoAI] Model yuklandi: {MODEL_PATH}")
    return _model


def model_is_ready() -> bool:
    return _torch_ok and os.path.exists(MODEL_PATH)


# ──────────────── Heuristic fallback ────────────────

def _heuristic_predict(image_path: str) -> dict:
    """
    PyTorch yoki trenirovka qilingan model yo'q bo'lganda ishlatiladi.
    Deterministik: bir xil rasm → bir xil natija.
    Tibbiy asos: to'qima zichligi (BI-RADS density).
    """
    try:
        img = Image.open(image_path).convert("L").resize((224, 224))
    except Exception:
        return {"predicted_class": 0, "confidence": 0.60,
                "probabilities": [0.60, 0.25, 0.15],
                "heatmap_path": None, "mode": "heuristic"}

    gray = np.array(img, dtype=np.float32)
    tissue_mask = gray > 25
    if tissue_mask.sum() < 500:
        return {"predicted_class": 0, "confidence": 0.80,
                "probabilities": [0.80, 0.12, 0.08],
                "heatmap_path": None, "mode": "heuristic"}

    tissue = gray[tissue_mask]
    n = len(tissue)
    low  = float(np.sum((tissue > 25)  & (tissue <= 90))  / n)
    mid  = float(np.sum((tissue > 90)  & (tissue <= 170)) / n)
    high = float(np.sum((tissue > 170) & (tissue <= 230)) / n)
    vbrt = float(np.sum(tissue > 230)                      / n)

    cx = np.abs(np.arange(224) - 112) / 112.0
    cy = np.abs(np.arange(224).reshape(-1, 1) - 112) / 112.0
    periph = ((gray > 180) * ((cx + cy) > 1.2)).mean()

    normal_s    = low * 0.6 + (1 - high) * 0.3 + (1 - vbrt) * 0.1
    benign_s    = mid * 0.5 + high * 0.3 + (1 - periph) * 0.2
    malignant_s = high * 0.4 + vbrt * 0.35 + periph * 0.25

    total = normal_s + benign_s + malignant_s + 1e-8
    probs = [normal_s / total, benign_s / total, malignant_s / total]
    cls   = int(np.argmax(probs))
    return {"predicted_class": cls, "confidence": float(probs[cls]),
            "probabilities": probs, "heatmap_path": None, "mode": "heuristic"}


# ──────────────── Grad-CAM ────────────────

def _run_gradcam(model, tensor, cls_idx: int, orig_img: Image.Image,
                 image_id: int) -> str | None:
    try:
        import torch, cv2
        os.makedirs(HEATMAP_DIR, exist_ok=True)
        save_path = os.path.join(HEATMAP_DIR, f"heatmap_{image_id}.png")

        grads, acts = [], []

        def fwd_hook(m, inp, out):
            acts.append(out)
            out.register_hook(lambda g: grads.append(g))

        # Son conv layer — timm EfficientNet va ResNet uchun
        target = None
        for name, m in model.named_modules():
            if isinstance(m, torch.nn.Conv2d):
                target = m
        if target is None:
            return None

        hook = target.register_forward_hook(fwd_hook)
        model.zero_grad()
        out = model(tensor)
        out[0, cls_idx].backward()
        hook.remove()

        if not grads or not acts:
            return None

        g   = grads[0].squeeze().cpu().numpy()
        a   = acts[0].squeeze().cpu().numpy()
        w   = g.mean(axis=(1, 2)) if g.ndim == 3 else g.mean()
        cam = np.zeros(a.shape[1:] if a.ndim == 3 else a.shape, dtype=np.float32)
        if a.ndim == 3:
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


# ──────────────── Ana predict funksiya ────────────────

def predict_image(image_path: str, image_id: int) -> dict:
    if not model_is_ready():
        return _heuristic_predict(image_path)

    try:
        import torch
        model  = _load_model()
        tf     = _get_transform()
        img    = Image.open(image_path).convert("RGB")
        tensor = tf(img).unsqueeze(0).to(_device)

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
        print(f"[MammoAI] Model xatosi: {e} — heuristikga o'tildi")
        return _heuristic_predict(image_path)
