"""Oddiy fayl-asosidagi model registri — qaysi model versiyasi qachon,
qanday ma'lumot va natija bilan o'qitilganini saqlaydi. Kelajakda bazaga
ko'chirish kerak bo'lsa, shu interfeys (record/list_all) saqlanadi."""
import json
import os
from datetime import datetime, timezone


def _registry_path(model_dir: str) -> str:
    return os.path.join(model_dir, "registry.json")


def record_model(model_dir: str, entry: dict):
    path = _registry_path(model_dir)
    entries = list_all(model_dir)
    entry["recorded_at"] = datetime.now(timezone.utc).isoformat()
    entries.append(entry)
    os.makedirs(model_dir, exist_ok=True)
    with open(path, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def list_all(model_dir: str) -> list[dict]:
    path = _registry_path(model_dir)
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def latest(model_dir: str) -> dict | None:
    entries = list_all(model_dir)
    return entries[-1] if entries else None
