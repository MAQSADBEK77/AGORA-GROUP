"""
Ko'krak to'qimasini fondan ajratib, keraksiz bo'sh (qora) chekkalarni kesib
tashlaydi. Bu YOLOX kabi o'qitilgan detektor EMAS — tez, arzon threshold
usuli (MVP uchun yetarli). Interfeys keyinchalik haqiqiy detektor bilan
almashtirilishi mumkin bo'lishi uchun ajratilgan, mustaqil funksiya.
"""
import cv2
import numpy as np


class BreastRegionDetector:
    """Ko'krak mintaqasini aniqlash uchun almashtirilishi mumkin interfeys.
    Hozirgi implementatsiya: threshold + connected components (arzon, tez).
    Kelajakda YOLO/YOLOX yoki segmentatsiya modeli bilan almashtirilishi mumkin —
    shu interfeysga (detect(image) -> bbox) rioya qilgan holda."""

    def detect(self, image: np.ndarray) -> tuple[int, int, int, int] | None:
        """image: 2D grayscale (uint8) massiv. Qaytaradi: (x0, y0, x1, y1) yoki None."""
        raise NotImplementedError


class ThresholdBreastDetector(BreastRegionDetector):
    def __init__(self, bg_threshold: int = 10, min_area_ratio: float = 0.02):
        self.bg_threshold = bg_threshold
        self.min_area_ratio = min_area_ratio

    def detect(self, image: np.ndarray) -> tuple[int, int, int, int] | None:
        h, w = image.shape[:2]
        blurred = cv2.GaussianBlur(image, (5, 5), 0)

        _, mask = cv2.threshold(blurred, self.bg_threshold, 255, cv2.THRESH_BINARY)
        # Kichik shovqinlarni tozalash
        kernel = np.ones((15, 15), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < self.min_area_ratio * w * h:
            return None

        x, y, bw, bh = cv2.boundingRect(largest)
        return (x, y, x + bw, y + bh)


def crop_breast_region(image: np.ndarray, detector: BreastRegionDetector | None = None) -> np.ndarray:
    """Ko'krak mintaqasini kesib qaytaradi. Aniqlab bo'lmasa, asl rasmni qaytaradi
    (xavfsiz — hech qachon ko'krak to'qimasini "yo'qotmaydi")."""
    detector = detector or ThresholdBreastDetector()
    bbox = detector.detect(image)
    if bbox is None:
        return image
    x0, y0, x1, y1 = bbox
    return image[y0:y1, x0:x1]
