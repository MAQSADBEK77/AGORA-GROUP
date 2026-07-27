"""DICOM (.dcm) faylini brauzerda ko'rsatish uchun PNG'ga aylantiradi."""
import numpy as np
import pydicom
from PIL import Image


def dicom_to_png(dcm_path: str, out_path: str) -> None:
    ds = pydicom.dcmread(dcm_path)
    arr = ds.pixel_array.astype(np.float32)

    slope = float(getattr(ds, "RescaleSlope", 1))
    intercept = float(getattr(ds, "RescaleIntercept", 0))
    arr = arr * slope + intercept

    lo, hi = arr.min(), arr.max()
    arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else np.zeros_like(arr)

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = 255.0 - arr

    Image.fromarray(arr.astype(np.uint8), mode="L").save(out_path, format="PNG")
