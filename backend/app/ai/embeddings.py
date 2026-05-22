"""
Rasm feature extraction (embedding).
PyTorch bo'lsa ResNet18 ishlatadi, bo'lmasa numpy/PIL bilan statistik features.
"""
import os
import numpy as np
from PIL import Image

EMBED_DIR = os.path.join(os.getenv("UPLOAD_DIR", "./uploads"), "embeddings")

try:
    import torch
    import torchvision.models as tv_models
    import torchvision.transforms as T

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _extractor = None

    def _get_extractor():
        global _extractor
        if _extractor is not None:
            return _extractor
        model = tv_models.resnet18(weights=tv_models.ResNet18_Weights.IMAGENET1K_V1)
        model = torch.nn.Sequential(*list(model.children())[:-1])  # avgpool output: 512-dim
        model.to(_device).eval()
        _extractor = model
        return _extractor

    _tf = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
    ])

    def extract(image_path: str) -> np.ndarray:
        img    = Image.open(image_path).convert("RGB")
        tensor = _tf(img).unsqueeze(0).to(_device)
        with torch.no_grad():
            feat = _get_extractor()(tensor).squeeze().cpu().numpy()
        norm = np.linalg.norm(feat)
        return feat / (norm + 1e-8)

    TORCH_OK = True

except ImportError:
    TORCH_OK = False

    def extract(image_path: str) -> np.ndarray:
        """PyTorch yo'q — statistik features."""
        img  = Image.open(image_path).convert("L").resize((128, 128))
        arr  = np.array(img, dtype=np.float32) / 255.0
        h, w = arr.shape
        feat = []

        # Global statistikalar
        feat += [arr.mean(), arr.std(),
                 float(np.percentile(arr, 10)), float(np.percentile(arr, 25)),
                 float(np.percentile(arr, 75)), float(np.percentile(arr, 90))]

        # 4x4 mintaqaviy histogram (16 * 16 = 256 bin)
        for i in range(4):
            for j in range(4):
                region = arr[i*h//4:(i+1)*h//4, j*w//4:(j+1)*w//4]
                hist, _ = np.histogram(region, bins=16, range=(0.0, 1.0))
                hist = hist.astype(np.float32)
                feat.extend(hist / (hist.sum() + 1e-8))

        vec  = np.array(feat, dtype=np.float32)
        norm = np.linalg.norm(vec)
        return vec / (norm + 1e-8)


def save_embedding(image_id: int, embedding: np.ndarray):
    os.makedirs(EMBED_DIR, exist_ok=True)
    np.save(os.path.join(EMBED_DIR, f"{image_id}.npy"), embedding)


def load_embedding(image_id: int) -> np.ndarray | None:
    path = os.path.join(EMBED_DIR, f"{image_id}.npy")
    if os.path.exists(path):
        return np.load(path)
    return None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))
