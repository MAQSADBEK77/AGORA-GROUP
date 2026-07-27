"""DICOM (.dcm) fayllari bilan ishlash: PNG'ga aylantirish va bemor metama'lumotlarini o'qish."""
import numpy as np
import pydicom
from PIL import Image


def read_dicom(dcm_path: str):
    return pydicom.dcmread(dcm_path)


def render_png(ds, out_path: str) -> None:
    """DICOM pixel array'ni brauzerda ko'rsatsa bo'ladigan PNG'ga aylantiradi."""
    arr = ds.pixel_array.astype(np.float32)

    slope = float(getattr(ds, "RescaleSlope", 1))
    intercept = float(getattr(ds, "RescaleIntercept", 0))
    arr = arr * slope + intercept

    lo, hi = arr.min(), arr.max()
    arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else np.zeros_like(arr)

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = 255.0 - arr

    Image.fromarray(arr.astype(np.uint8), mode="L").save(out_path, format="PNG")


def dicom_to_png(dcm_path: str, out_path: str) -> None:
    render_png(read_dicom(dcm_path), out_path)


def _format_dicom_name(raw) -> str:
    # DICOM PN formati: Family^Given^Middle^Prefix^Suffix
    parts = [p for p in str(raw).split("^") if p]
    return " ".join(parts).strip() if parts else ""


def extract_patient_info(ds) -> dict:
    """DICOM tegларidan bemor ma'lumotlarini ajratib oladi (mavjud bo'lmasa None)."""
    patient_id = str(getattr(ds, "PatientID", "") or "").strip() or None

    raw_name = getattr(ds, "PatientName", None)
    full_name = _format_dicom_name(raw_name) if raw_name else None

    birth_year = None
    dob = str(getattr(ds, "PatientBirthDate", "") or "")
    if len(dob) == 8 and dob.isdigit():
        birth_year = int(dob[:4])

    return {
        "patient_id": patient_id,
        "full_name": full_name,
        "birth_year": birth_year,
        "sex": getattr(ds, "PatientSex", None),
        "laterality": getattr(ds, "ImageLaterality", None),
    }
