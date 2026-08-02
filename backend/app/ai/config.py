"""
MammoAI — ConvNeXt-asosidagi tashxis modeli konfiguratsiyasi.

Ikkita profil bor:
  - "fast"       — hozirgi MVP: kichik model, kam epoch, tez o'qitish (~1 soat)
  - "production" — kelajakda kuchli GPU serverda: katta model, to'liq fine-tuning

Profil AI_PROFILE muhit o'zgaruvchisi orqali tanlanadi (standart: "fast").
Barcha qiymatlar shu yerda markazlashtirilgan — kodning boshqa joylariga
sochilmagan (talab qilingan tuzilma).
"""
import os
from dataclasses import dataclass


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    val = os.getenv(name)
    return float(val) if val is not None else default


def _env_int(name: str, default: int) -> int:
    val = os.getenv(name)
    return int(val) if val is not None else default


@dataclass(frozen=True)
class AIConfig:
    enabled: bool
    profile: str            # "fast" | "production"
    device: str              # "auto" | "cuda" | "mps" | "cpu"
    model_name: str          # torchvision model nomi, masalan "convnext_tiny"
    image_size: int
    batch_size: int
    epochs: int
    freeze_backbone: bool
    learning_rate: float
    num_workers: int
    amp: bool
    max_training_minutes: int   # 0 = cheklovsiz
    fast_dataset: bool
    max_train_samples: int      # 0 = cheklovsiz
    max_val_samples: int        # 0 = cheklovsiz
    threshold: float            # ehtimollikni Normal/Malignant'ga aylantirish chegarasi
    enable_heatmap: bool
    enable_ensemble: bool
    model_dir: str
    checkpoint_path: str
    model_version: str


_FAST = dict(
    model_name="convnext_tiny",
    image_size=512,
    batch_size=8,
    epochs=15,
    # MUHIM (birinchi urinishdan xulosa): dataset juda kichik (395 rasm) —
    # to'liq backbone'ni 1-epochdan yechib yuborish (freeze_backbone=False)
    # beqaror o'qitishga olib keldi (train_loss 20 epoch davomida deyarli
    # qimirlamadi, ROC-AUC~0.52 — tasodifga yaqin). Standart transfer-learning
    # amaliyoti: avval FAQAT klassifikator boshini o'qitish (backbone muzlatilgan),
    # keyin xohlasa oxirgi bosqichni ham yechish mumkin (AI_FREEZE_BACKBONE=false).
    freeze_backbone=True,
    learning_rate=3e-4,       # faqat kichik classifier boshi o'qitilgani uchun kattaroq LR xavfsiz
    num_workers=2,
    amp=True,
    max_training_minutes=150,
    fast_dataset=True,
    max_train_samples=0,     # hozircha butun 500 talik namunani ishlatamiz
    max_val_samples=0,
)

_PRODUCTION = dict(
    model_name="convnext_base",
    image_size=1536,
    batch_size=4,
    epochs=40,
    freeze_backbone=False,
    learning_rate=5e-5,
    num_workers=8,
    amp=True,
    max_training_minutes=0,   # cheklovsiz
    fast_dataset=False,
    max_train_samples=0,
    max_val_samples=0,
)


def load_config() -> AIConfig:
    profile = os.getenv("AI_PROFILE", "fast").strip().lower()
    base = _PRODUCTION if profile == "production" else _FAST

    model_dir = os.getenv("AI_MODEL_DIR", "./model")

    return AIConfig(
        enabled=_env_bool("AI_ENABLED", True),
        profile=profile,
        device=os.getenv("AI_DEVICE", "auto"),
        model_name=os.getenv("AI_MODEL_NAME", base["model_name"]),
        image_size=_env_int("AI_INPUT_SIZE", base["image_size"]),
        batch_size=_env_int("AI_BATCH_SIZE", base["batch_size"]),
        epochs=_env_int("AI_EPOCHS", base["epochs"]),
        freeze_backbone=_env_bool("AI_FREEZE_BACKBONE", base["freeze_backbone"]),
        learning_rate=_env_float("AI_LEARNING_RATE", base["learning_rate"]),
        num_workers=_env_int("AI_NUM_WORKERS", base["num_workers"]),
        amp=_env_bool("AI_AMP", base["amp"]),
        max_training_minutes=_env_int("AI_MAX_TRAINING_MINUTES", base["max_training_minutes"]),
        fast_dataset=_env_bool("AI_FAST_DATASET", base["fast_dataset"]),
        max_train_samples=_env_int("AI_MAX_TRAIN_SAMPLES", base["max_train_samples"]),
        max_val_samples=_env_int("AI_MAX_VAL_SAMPLES", base["max_val_samples"]),
        threshold=_env_float("AI_THRESHOLD", 0.5),
        enable_heatmap=_env_bool("AI_ENABLE_HEATMAP", True),
        enable_ensemble=_env_bool("AI_ENABLE_ENSEMBLE", False),
        model_dir=model_dir,
        checkpoint_path=os.getenv("AI_MODEL_CHECKPOINT", os.path.join(model_dir, "convnext_best.pt")),
        model_version=os.getenv("AI_MODEL_VERSION", "mrrobot-inspired-0.1.0"),
    )


CONFIG = load_config()
