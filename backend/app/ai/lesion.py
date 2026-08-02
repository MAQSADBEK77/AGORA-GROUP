"""
Shubhali (lesion) mintaqani taxminiy aniqlash.

Tizimda hozircha o'qitilgan segmentatsiya modeli yo'q (KNN + embedding
o'xshashligiga asoslangan), shuning uchun mintaqa klassik tasvirga ishlov
berish orqali topiladi: ko'krak to'qimasi ichidagi eng zich/yorug' blok
qidiriladi. Bu faqat radiologga yo'naltiruvchi vosita — yakuniy tashxis
doim shifokor tomonidan tasdiqlanadi.
"""
import cv2
import numpy as np

MIN_AREA_RATIO = 0.001   # rasm yuzasining shu ulushidan kichik bloklar e'tiborga olinmaydi
DENSE_PERCENTILE = 97     # to'qima ichida eng yorug' foizlik chegara
EDGE_MARGIN_RATIO = 0.08  # rasm chetidan shu ulush — apparat yozgan "L/R", "MLO" kabi
                           # yorliqlar deyarli doim shu yerda bo'ladi, to'qima emas


def detect_lesion_region(image_path: str) -> dict | None:
    """Eng zich/yorug' mintaqani topib, normallashtirilgan (0..1) bbox qaytaradi."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None

    h, w = img.shape
    blurred = cv2.GaussianBlur(img, (9, 9), 0)

    # Fondan ko'krak to'qimasini ajratish
    _, breast_mask = cv2.threshold(blurred, 15, 255, cv2.THRESH_BINARY)

    # Rasm chetlarini (apparat yozgan L/R, MLO/CC kabi yorug' matn yorliqlari
    # ko'pincha shu yerda bo'ladi) tekshiruvdan chiqarib tashlaymiz — aks holda
    # ular "eng yorug' mintaqa" sifatida noto'g'ri tanlanib qolishi mumkin edi.
    mx, my = int(w * EDGE_MARGIN_RATIO), int(h * EDGE_MARGIN_RATIO)
    edge_mask = np.zeros_like(breast_mask)
    edge_mask[my:h - my, mx:w - mx] = 255
    breast_mask = cv2.bitwise_and(breast_mask, edge_mask)

    tissue_vals = blurred[breast_mask > 0]
    if tissue_vals.size < 100:
        return None

    thresh_val = float(np.percentile(tissue_vals, DENSE_PERCENTILE))
    _, dense_mask = cv2.threshold(blurred, thresh_val, 255, cv2.THRESH_BINARY)
    dense_mask = cv2.bitwise_and(dense_mask, breast_mask)

    contours, _ = cv2.findContours(dense_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    if area < MIN_AREA_RATIO * w * h:
        return None

    x, y, bw, bh = cv2.boundingRect(largest)

    # Ramka atrofiga biroz joy qo'shamiz, chetlarni oshib ketmasin
    pad_x, pad_y = int(bw * 0.15), int(bh * 0.15)
    x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
    x1, y1 = min(w, x + bw + pad_x), min(h, y + bh + pad_y)

    return {
        "x":      round(x0 / w, 4),
        "y":      round(y0 / h, 4),
        "width":  round((x1 - x0) / w, 4),
        "height": round((y1 - y0) / h, 4),
    }
