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

MIN_AREA_RATIO = 0.001    # rasm yuzasining shu ulushidan kichik bloklar e'tiborga olinmaydi
DENSE_PERCENTILE = 97      # to'qima ichida eng yorug' foizlik chegara
CORE_MARGIN_RATIO = 0.18   # ko'krak to'qimasi o'z chegara-qutisining shu ulushicha "chekka
                            # hudud" deb hisoblanadi (teri/mushak chegarasi — bu yerda
                            # shubhali deb belgilanmaydi, faqat ICHKI "asosiy" hudud qaraladi)
ANALYSIS_MAX_DIM = 900      # tezlik uchun tahlil shu o'lchamgacha kichraytirilgan nusxada
                            # bajariladi, natija asl rasm o'lchamiga qayta hisoblanadi


def _largest_component_mask(mask: np.ndarray) -> np.ndarray:
    """Faqat ENG KATTA bog'langan blokni qoldiradi — apparat yozgan L/R,
    CC/MLO kabi yorliqlar ko'krak to'qimasidan HAR DOIM ajralib turadi
    (orasida qora fon bor), shuning uchun alohida, kichikroq blok bo'lib
    chiqadi va shu yo'l bilan aniq chetlab o'tiladi — ularning rasmdagi
    ANIQ joylashuvidan qat'i nazar (faqat chetda emas, markazga yaqin ham
    bo'lishi mumkin)."""
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n_labels <= 1:
        return mask
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_label = 1 + int(np.argmax(areas))
    return np.where(labels == largest_label, 255, 0).astype(np.uint8)


def detect_lesion_region(image_path: str) -> dict | None:
    """Eng zich/yorug' mintaqani topib, normallashtirilgan (0..1) bbox qaytaradi."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None

    orig_h, orig_w = img.shape

    # Tezlik uchun kichikroq nusxada tahlil qilamiz (mammogramma fayllari
    # ko'pincha 4000-6000px bo'ladi — to'liq o'lchamda kontur/morfologik
    # amallar sekin ishlaydi). Natija oxirida asl o'lchamga moslashtiriladi.
    scale = min(1.0, ANALYSIS_MAX_DIM / max(orig_h, orig_w))
    img_s = cv2.resize(img, (int(orig_w * scale), int(orig_h * scale))) if scale < 1.0 else img
    h, w = img_s.shape
    blurred = cv2.GaussianBlur(img_s, (9, 9), 0)

    # Fondan ko'krak to'qimasini ajratish, so'ng FAQAT eng katta blok
    # (haqiqiy ko'krak) qoldiriladi — apparat yorliqlari qora fon bilan
    # ajralgan alohida (kichikroq) bloklar bo'lgani uchun bekor qilinadi.
    _, breast_mask = cv2.threshold(blurred, 15, 255, cv2.THRESH_BINARY)
    breast_mask = _largest_component_mask(breast_mask)

    bx, by, bbw, bbh = cv2.boundingRect(breast_mask)
    if bbw == 0 or bbh == 0:
        return None

    # MUHIM: ko'krak to'qimasining tashqi chegarasi — ayniqsa MLO ko'rinishida
    # KO'KRAK MUSHAGI (pectoral muscle) — rentgenda tabiiy ravishda ENG
    # ZICH/YORUG' qism bo'ladi, lekin bu shubhali topilma emas. Shu sabab
    # qidiruvni ko'krakning O'Z chegara-qutisi ichidagi MARKAZIY ("core")
    # hudud bilan cheklaymiz — haqiqiy topilmalar odatda har tomondan
    # to'qima bilan o'ralgan bo'ladi, tashqi chegaraga tegib turmaydi.
    mx, my = int(bbw * CORE_MARGIN_RATIO), int(bbh * CORE_MARGIN_RATIO)
    core_mask = np.zeros_like(breast_mask)
    core_mask[by + my: by + bbh - my, bx + mx: bx + bbw - mx] = 255
    search_mask = cv2.bitwise_and(breast_mask, core_mask)

    tissue_vals = blurred[search_mask > 0]
    if tissue_vals.size < 100:
        return None

    thresh_val = float(np.percentile(tissue_vals, DENSE_PERCENTILE))
    _, dense_mask = cv2.threshold(blurred, thresh_val, 255, cv2.THRESH_BINARY)
    dense_mask = cv2.bitwise_and(dense_mask, search_mask)

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
