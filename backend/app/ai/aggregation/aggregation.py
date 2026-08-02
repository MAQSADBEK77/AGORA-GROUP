"""Ko'p ko'rinishli (multi-view) natijalarni ko'krak va tekshiruv darajasiga
yig'ish. Bu mantiq API va model kodidan MUSTAQIL — kelajakda murakkabroq
(masalan og'irliklangan) usulga almashtirish uchun ajratilgan."""

SIDE_KEYS = {"L": ["L_CC", "L_MLO"], "R": ["R_CC", "R_MLO"]}


def aggregate_breast(view_probs: dict[str, float]) -> float | None:
    """Bitta ko'krakning barcha ko'rinishlari orasidan ENG YUQORI ehtimollikni
    oladi (max-pooling) — mr.robot yechimida ham shu yondashuv qo'llanilgan:
    agar biror ko'rinishda shubhali topilma bo'lsa, boshqa ko'rinish "tinch"
    ko'rinishi buni yashirmasligi kerak."""
    vals = [v for v in view_probs.values() if v is not None]
    if not vals:
        return None
    return max(vals)


def aggregate_exam(views: dict[str, float | None]) -> dict:
    """views: {"L_CC": 0.1, "L_MLO": 0.2, "R_CC": 0.05, "R_MLO": None, ...}
    Qaytaradi: {"left_breast_probability", "right_breast_probability",
    "exam_probability", "views_used"}"""
    left_probs = {k: views.get(k) for k in SIDE_KEYS["L"] if views.get(k) is not None}
    right_probs = {k: views.get(k) for k in SIDE_KEYS["R"] if views.get(k) is not None}

    left_prob = aggregate_breast(left_probs)
    right_prob = aggregate_breast(right_probs)

    breast_probs = [p for p in (left_prob, right_prob) if p is not None]
    exam_prob = max(breast_probs) if breast_probs else None

    return {
        "left_breast_probability": round(left_prob, 4) if left_prob is not None else None,
        "right_breast_probability": round(right_prob, 4) if right_prob is not None else None,
        "exam_probability": round(exam_prob, 4) if exam_prob is not None else None,
        "views_used": [k for k, v in views.items() if v is not None],
    }
