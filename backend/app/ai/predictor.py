import os
import random

HEATMAP_DIR = "/app/uploads/heatmaps"

try:
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def _mock_predict():
    """PyTorch yo'q bo'lganda demo natija qaytaradi."""
    probs = [random.uniform(0.1, 0.9) for _ in range(3)]
    total = sum(probs)
    probs = [p / total for p in probs]
    cls = probs.index(max(probs))
    return {
        "predicted_class": cls,
        "confidence": probs[cls],
        "probabilities": probs,
        "heatmap_path": None,
    }


MODEL_PATH = os.getenv("MODEL_PATH", "./model/mammo_model.pth")
NUM_CLASSES = 3
_model = None
_device = None

if TORCH_AVAILABLE:
    import torch
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    import torchvision.transforms as transforms
    TRANSFORM = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def _load_model():
    global _model
    if _model is not None:
        return _model
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
    model = tv_models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, map_location=_device))
    model.to(_device)
    model.eval()
    _model = model
    return _model


def predict_image(image_path: str, image_id: int) -> dict:
    if not TORCH_AVAILABLE:
        return _mock_predict()

    import torch
    import numpy as np
    from PIL import Image

    model = _load_model()
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception:
        return _mock_predict()

    tensor = TRANSFORM(img).unsqueeze(0).to(_device)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()

    predicted_class = int(probs.argmax())
    confidence = float(probs[predicted_class])

    heatmap_path = None
    try:
        upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
        heatmap_dir = os.path.join(upload_dir, "heatmaps")
        os.makedirs(heatmap_dir, exist_ok=True)
        heatmap_path = os.path.join(heatmap_dir, f"heatmap_{image_id}.png")
        from .heatmap import generate_gradcam
        generate_gradcam(model, tensor, predicted_class, img, heatmap_path, _device)
    except Exception:
        heatmap_path = None

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "probabilities": probs.tolist(),
        "heatmap_path": heatmap_path,
    }
