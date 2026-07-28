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
        "view_position": getattr(ds, "ViewPosition", None),
    }


# Mammography CAD SR Storage — DICOM standartidagi doimiy SOP Class UID
MAMMOGRAPHY_CAD_SR_UID = "1.2.840.10008.5.1.4.1.1.88.50"


def is_cad_sr(ds) -> bool:
    """Apparatning o'z ichki CAD hisoboti (Mammography CAD SR) ekanini tekshiradi."""
    return str(getattr(ds, "SOPClassUID", "")) == MAMMOGRAPHY_CAD_SR_UID


def _code_meaning(seq):
    try:
        return seq[0].CodeMeaning
    except Exception:
        return None


def parse_cad_sr(ds) -> dict | None:
    """Mammography CAD SR hisobotidan (masalan FUJIFILM M-CAD) topilmalarni
    tomon (chap/o'ng) bo'yicha yig'ib qaytaradi. DICOM SR ichidagi "by-reference"
    bog'lanishlar (Referenced Content Item Identifier) orqali har bir topilma
    qaysi rasmga tegishli ekani (demak — qaysi tomon) aniqlanadi."""
    algorithm = None
    summary_text = None

    path_to_item: dict[tuple, object] = {}

    def index(item, path=()):
        path_to_item[path] = item
        for i, child in enumerate(item.get("ContentSequence", []), start=1):
            index(child, path + (i,))

    index(ds)

    # Rasmlar ro'yxati: tree-path -> laterality
    image_laterality = {}
    for path, item in path_to_item.items():
        if item.get("ValueType") == "IMAGE":
            lat = None
            for c in item.get("ContentSequence", []):
                if _code_meaning(c.get("ConceptNameCodeSequence", [])) == "Image Laterality":
                    raw = _code_meaning(c.get("ConceptCodeSequence", [])) or ""
                    lat = "L" if "Left" in raw else ("R" if "Right" in raw else None)
            image_laterality[path] = lat

    by_side = {"L": {"clusters": 0, "calcifications": 0}, "R": {"clusters": 0, "calcifications": 0}}
    found_any = False

    for path, item in path_to_item.items():
        if _code_meaning(item.get("ConceptNameCodeSequence", [])) != "Single Image Finding":
            continue
        finding_type = _code_meaning(item.get("ConceptCodeSequence", []))
        if finding_type != "Calcification Cluster":
            continue

        # Shu topilma ichidagi birinchi "Referenced Content Item Identifier" orqali
        # qaysi IMAGE'ga tegishli ekanini aniqlaymiz (DICOM SR by-reference path —
        # oldida qo'shimcha "1" indeksi bilan keladi, shu sabab uni tashlab yuboramiz)
        def find_ref(sub_item):
            for c in sub_item.get("ContentSequence", []):
                if "ReferencedContentItemIdentifier" in c:
                    ref_path = tuple(int(x) for x in c.ReferencedContentItemIdentifier)[1:]
                    return image_laterality.get(ref_path)
                r = find_ref(c)
                if r:
                    return r
            return None
        side = find_ref(item)

        if side:
            found_any = True
            by_side[side]["clusters"] += 1
            for c in item.get("ContentSequence", []):
                if _code_meaning(c.get("ConceptNameCodeSequence", [])) == "Number of calcifications":
                    try:
                        by_side[side]["calcifications"] += int(c.MeasuredValueSequence[0].NumericValue)
                    except Exception:
                        pass

    if not found_any:
        return None

    for item in path_to_item.values():
        if _code_meaning(item.get("ConceptNameCodeSequence", [])) == "CAD Processing and Findings Summary":
            summary_text = _code_meaning(item.get("ConceptCodeSequence", []))
            break

    algorithm_name = ""
    for item in path_to_item.values():
        if _code_meaning(item.get("ConceptNameCodeSequence", [])) == "Algorithm Name":
            algorithm_name = item.get("TextValue", "") or ""
            break

    return {
        "algorithm": algorithm_name or str(getattr(ds, "Manufacturer", "")),
        "summary": summary_text,
        "by_side": by_side,
    }
