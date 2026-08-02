"""ConvNeXt-asosidagi mammografiya tasniflagichi — mr.robot g'oyasidan ilhomlangan
(ConvNeXt backbone), lekin RASMAN mr.robot modeli EMAS: haqiqiy musobaqa
og'irliklari ochiq tarqatilmagan, shuning uchun ImageNet pretrained og'irlik
bilan boshlab, o'zimizning datasetda fine-tune qilamiz."""
import os
import torch
import torch.nn as nn
import torchvision.models as tv_models

MODEL_BUILDERS = {
    "convnext_tiny": (tv_models.convnext_tiny, tv_models.ConvNeXt_Tiny_Weights.IMAGENET1K_V1),
    "convnext_small": (tv_models.convnext_small, tv_models.ConvNeXt_Small_Weights.IMAGENET1K_V1),
    "convnext_base": (tv_models.convnext_base, tv_models.ConvNeXt_Base_Weights.IMAGENET1K_V1),
}


def resolve_device(preference: str = "auto") -> torch.device:
    if preference == "cuda":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if preference == "mps":
        return torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    if preference == "cpu":
        return torch.device("cpu")
    # auto
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class MammographyClassifier(nn.Module):
    """Bitta mammogramma rasmidan saraton ehtimolini (logit) chiqaradi.
    Chiqish: 1 ta logit (sigmoid orqali 0..1 ehtimollikka aylantiriladi) —
    ikkilik tasnif (Normal vs Malignant/shubhali)."""

    def __init__(self, model_name: str = "convnext_tiny", pretrained: bool = True,
                freeze_backbone: bool = False):
        super().__init__()
        if model_name not in MODEL_BUILDERS:
            raise ValueError(f"Noma'lum model: {model_name}. Mavjud: {list(MODEL_BUILDERS)}")
        builder, weights_enum = MODEL_BUILDERS[model_name]
        self.model_name = model_name
        self.backbone = builder(weights=weights_enum if pretrained else None)

        in_features = self.backbone.classifier[2].in_features
        self.backbone.classifier[2] = nn.Linear(in_features, 1)

        if freeze_backbone:
            for name, param in self.backbone.named_parameters():
                if "classifier" not in name:
                    param.requires_grad = False

    def forward(self, x):
        return self.backbone(x)

    def set_backbone_frozen(self, frozen: bool):
        for name, param in self.backbone.named_parameters():
            if "classifier" not in name:
                param.requires_grad = not frozen


def load_checkpoint(model: MammographyClassifier, checkpoint_path: str, device: torch.device) -> bool:
    """Checkpoint mavjud bo'lsa yuklaydi va True qaytaradi; bo'lmasa False
    (chaqiruvchi taraf MODEL_WEIGHTS_NOT_FOUND holatini o'zi bildirishi kerak)."""
    if not os.path.exists(checkpoint_path):
        return False
    state = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state["model_state_dict"] if "model_state_dict" in state else state)
    return True


def save_checkpoint(model: MammographyClassifier, checkpoint_path: str, extra: dict | None = None):
    os.makedirs(os.path.dirname(checkpoint_path), exist_ok=True)
    payload = {"model_state_dict": model.state_dict(), "model_name": model.model_name}
    if extra:
        payload.update(extra)
    torch.save(payload, checkpoint_path)
