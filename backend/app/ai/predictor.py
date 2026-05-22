"""
KNN-based predictor:
- Radiolog labellar qo'ygan rasmlar embedding sifatida saqlanadi
- Yangi rasm uchun: K ta eng o'xshash labeled rasmni topadi
- O'sha rasmlarning labellari bo'yicha weighted vote qiladi
- Doktor qo'shgan har bir label AI ni yaxshilaydi
"""
import json
import os
from .embeddings import extract, save_embedding, load_embedding, cosine_similarity

K = 5   # Nechta qo'shni izlash


def predict_from_labeled(new_image_path: str, labeled_cases: list[dict]) -> dict:
    """
    labeled_cases: [{"image_id": int, "label": str, "image_path": str}, ...]
    Returns: {"label": str, "confidence": float, "similar_cases": [...]}
    """
    if not labeled_cases:
        return {
            "label": "Normal",
            "confidence": 0.0,
            "similar_cases": [],
            "note": "Hali radiolog belgilagan rasm yo'q. Avval bir nechta rasmni labeling qiling."
        }

    # Yangi rasmning embeddingini olish
    new_emb = extract(new_image_path)

    # Har bir labeled rasm bilan o'xshashlik hisoblash
    scored = []
    for case in labeled_cases:
        emb = load_embedding(case["image_id"])
        if emb is None:
            # Embedding yo'q bo'lsa, qayta hisoblash
            try:
                emb = extract(case["image_path"])
                save_embedding(case["image_id"], emb)
            except Exception:
                continue
        sim = cosine_similarity(new_emb, emb)
        scored.append({**case, "similarity": round(sim, 4)})

    # Eng o'xshash K ta olish
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top_k = scored[:K]

    if not top_k:
        return {"label": "Normal", "confidence": 0.0, "similar_cases": [], "note": "Embedding xatosi"}

    # Weighted voting
    label_weights: dict[str, float] = {}
    for case in top_k:
        lbl = case["label"]
        w   = case["similarity"]
        label_weights[lbl] = label_weights.get(lbl, 0.0) + w

    total = sum(label_weights.values()) + 1e-8
    label_probs = {k: v / total for k, v in label_weights.items()}

    best_label = max(label_probs, key=label_probs.__getitem__)
    confidence = label_probs[best_label]

    similar_cases_info = [
        {
            "image_id":   c["image_id"],
            "label":      c["label"],
            "similarity": c["similarity"],
            "patient":    c.get("patient_name", ""),
        }
        for c in top_k
    ]

    return {
        "label":         best_label,
        "confidence":    round(confidence, 4),
        "similar_cases": similar_cases_info,
        "label_probs":   {k: round(v, 4) for k, v in label_probs.items()},
    }


def index_labeled_image(image_id: int, image_path: str):
    """Radiolog label qo'ygandan keyin embedding ni saqlaydi."""
    try:
        emb = extract(image_path)
        save_embedding(image_id, emb)
        return True
    except Exception as e:
        print(f"[AI] Embedding xatosi image_id={image_id}: {e}")
        return False
