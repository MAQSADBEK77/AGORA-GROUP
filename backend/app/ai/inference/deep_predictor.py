"""
ConvNeXt-asosidagi xulosa chiqarish xizmati.

Model FAQAT bir marta yuklanadi (singleton) — har bir so'rov uchun qayta
yuklanmaydi. Checkpoint topilmasa, aniq MODEL_WEIGHTS_NOT_FOUND holatini
qaytaradi — soxta bashorat qilmaydi.
"""
import os
import cv2
from PIL import Image

from ..config import load_config

# torch/torchvision — OG'IR, IXTIYORIY bog'liqlik (requirements-ai.txt).
# O'rnatilmagan muhitda (masalan yengil Render deploy) butun ilova
# qulamasligi uchun — shu yerda xavfsiz tekshiriladi, xolos KNN tizimiga
# qaytiladi (mavjud embeddings.py'dagi bir xil pattern).
try:
    import torch
    from ..models.convnext_model import MammographyClassifier, resolve_device, load_checkpoint
    from ..preprocessing.breast_crop import crop_breast_region
    from ..preprocessing.transforms import inference_transform
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

_model = None
_device = None
_transform = None
_cfg = None
_weights_loaded = False


def _get_model():
    global _model, _device, _transform, _cfg, _weights_loaded
    if _model is not None:
        return _model, _device, _transform, _weights_loaded

    _cfg = load_config()
    _device = resolve_device(_cfg.device)
    _model = MammographyClassifier(_cfg.model_name, pretrained=not os.path.exists(_cfg.checkpoint_path))
    _weights_loaded = load_checkpoint(_model, _cfg.checkpoint_path, _device)
    _model.to(_device).eval()
    _transform = inference_transform(_cfg.image_size)
    return _model, _device, _transform, _weights_loaded


def model_status() -> dict:
    """Model holatini tekshiradi (og'irlik yuklanganmi) — kod ishga tushirmasdan."""
    cfg = load_config()
    return {
        "enabled": cfg.enabled and TORCH_AVAILABLE,
        "torch_available": TORCH_AVAILABLE,
        "weights_found": TORCH_AVAILABLE and os.path.exists(cfg.checkpoint_path),
        "checkpoint_path": cfg.checkpoint_path,
        "model_name": cfg.model_name,
        "model_version": cfg.model_version,
    }


def predict_image(image_path: str) -> dict:
    """Bitta rasm uchun saraton ehtimolini hisoblaydi.
    Qaytaradi: {"status": "completed"|"error", "probability": float|None,
    "model_version": str, "warnings": [...], "error": str|None}"""
    if not TORCH_AVAILABLE:
        return {
            "status": "TORCH_NOT_INSTALLED",
            "probability": None,
            "warnings": ["torch/torchvision o'rnatilmagan (requirements-ai.txt) — KNN tizimiga qaytilmoqda."],
        }

    cfg = load_config()
    if not cfg.enabled:
        return {"status": "disabled", "probability": None, "warnings": ["AI_ENABLED=false"]}

    if not os.path.exists(cfg.checkpoint_path):
        return {
            "status": "MODEL_WEIGHTS_NOT_FOUND",
            "probability": None,
            "model_version": cfg.model_version,
            "warnings": [f"Model og'irligi topilmadi: {cfg.checkpoint_path}. Avval o'qitish kerak."],
        }

    try:
        model, device, transform, weights_loaded = _get_model()
        img_gray = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img_gray is None:
            return {"status": "error", "probability": None, "error": "Rasmni o'qib bo'lmadi"}

        img_gray = crop_breast_region(img_gray)
        img_rgb = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor = transform(pil_img).unsqueeze(0).to(device)

        with torch.inference_mode():
            logit = model(tensor)
            probability = torch.sigmoid(logit).item()

        return {
            "status": "completed",
            "probability": round(probability, 4),
            "model_version": cfg.model_version,
            "model_name": cfg.model_name,
            "warnings": [],
        }
    except Exception as e:
        return {"status": "error", "probability": None, "error": str(e), "warnings": []}
