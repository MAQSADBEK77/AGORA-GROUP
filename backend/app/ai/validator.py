from PIL import Image
import numpy as np


def is_mammography_image(image_path: str) -> tuple[bool, str]:
    if image_path.lower().endswith(".dcm"):
        return True, ""

    try:
        img = Image.open(image_path)
    except Exception:
        return False, "Rasm fayli o'qib bo'lmadi"

    w, h = img.size
    if w < 100 or h < 100:
        return False, "Rasm juda kichik (min 100x100)"

    arr = np.array(img.convert("RGB"), dtype=np.float32) / 255.0  # [0..1]

    # --- 1. HSV SATURATION TEKSHIRUVI (asosiy) ---
    # Har bir piksel uchun saturation = (max - min) / max
    # Mammografiya: saturation ≈ 0 (kulrang)
    # Rangli rasm (mashina, odamlar): ko'p piksel saturation > 0
    max_val = np.max(arr, axis=2)
    min_val = np.min(arr, axis=2)
    # Juda qorong'i piksellarni chiqarib tashlaymiz (ular har doim s≈0)
    bright_mask = max_val > 0.08
    if bright_mask.sum() > 100:
        saturation = np.where(
            bright_mask,
            (max_val - min_val) / (max_val + 1e-8),
            0.0
        )
        high_sat_ratio = float(np.mean(saturation[bright_mask] > 0.12))
        if high_sat_ratio > 0.06:  # 6%+ piksel rangli
            return False, (
                f"Bu mammografiya rasmi emas — rangli piksellar: {high_sat_ratio*100:.0f}%. "
                "Faqat kulrang (grayscale) tibbiy rasmlar qabul qilinadi"
            )

    # --- 2. KANAL KORRELYATSIYA TEKSHIRUVI ---
    # Haqiqiy grayscale rasmda R, G, B bir xil bo'ladi
    r = arr[:, :, 0].flatten()
    g = arr[:, :, 1].flatten()
    b = arr[:, :, 2].flatten()
    rg_diff = float(np.mean(np.abs(r - g)))
    rb_diff = float(np.mean(np.abs(r - b)))
    if rg_diff > 0.06 or rb_diff > 0.06:
        return False, (
            f"Rangli rasm aniqlandi (kanal farqi: {max(rg_diff, rb_diff):.3f}). "
            "Mammografiya rasmlari kulrang bo'ladi"
        )

    # --- 3. BO'SH YOKI YAROQSIZ RASM ---
    gray = np.array(img.convert("L"), dtype=np.float32)
    dark_ratio = float(np.mean(gray < 20))
    if dark_ratio > 0.98:
        return False, "Rasm deyarli qora yoki bo'sh"
    if dark_ratio < 0.03:
        return False, "Mammografiya uchun qora fon juda kam"
    if float(np.std(gray)) < 8:
        return False, "Rasm kontrastsiz — sifatli mammografiya rasmi yuklang"

    return True, ""
