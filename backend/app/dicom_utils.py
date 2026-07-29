"""DICOM (.dcm) fayllari bilan ishlash: PNG'ga aylantirish va bemor metama'lumotlarini o'qish."""
import numpy as np
import pydicom
from PIL import Image


def read_dicom(dcm_path: str):
    return pydicom.dcmread(dcm_path)


def render_png(ds, out_path: str) -> np.ndarray:
    """DICOM pixel array'ni brauzerda ko'rsatsa bo'ladigan PNG'ga aylantiradi.
    Sifat tekshiruvida qayta ishlatish uchun natijaviy 8-bitli массивни qaytaradi."""
    arr = ds.pixel_array.astype(np.float32)

    slope = float(getattr(ds, "RescaleSlope", 1))
    intercept = float(getattr(ds, "RescaleIntercept", 0))
    arr = arr * slope + intercept

    lo, hi = arr.min(), arr.max()
    arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else np.zeros_like(arr)

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = 255.0 - arr

    arr8 = arr.astype(np.uint8)
    Image.fromarray(arr8, mode="L").save(out_path, format="PNG")
    return arr8


def dicom_to_png(dcm_path: str, out_path: str) -> None:
    render_png(read_dicom(dcm_path), out_path)


def check_image_quality(arr8: np.ndarray) -> list[str]:
    """Yuklangan rasmda aniq muammolarni (kesilgan/juda kichik, deyarli bo'sh,
    xira) tekshiradi. Yuklashni to'xtatmaydi — faqat ogohlantirish qaytaradi."""
    warnings = []
    h, w = arr8.shape

    if h < 500 or w < 500:
        warnings.append(f"Rasm o'lchami juda kichik ({w}x{h}) — kesilgan yoki noto'g'ri bo'lishi mumkin")

    dark_ratio = float(np.mean(arr8 < 10))
    if dark_ratio > 0.97:
        warnings.append("Rasm deyarli butunlay qora — noto'g'ri ekspozitsiya bo'lishi mumkin")

    if float(np.std(arr8)) < 8:
        warnings.append("Rasm kontrastsiz — sifat past bo'lishi mumkin")

    try:
        import cv2
        lap_var = cv2.Laplacian(arr8, cv2.CV_64F).var()
        if lap_var < 15:
            warnings.append("Rasm xira (blur) ko'rinishga ega bo'lishi mumkin")
    except Exception:
        pass

    return warnings


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

    orientation = getattr(ds, "PatientOrientation", None)

    return {
        "patient_id": patient_id,
        "full_name": full_name,
        "birth_year": birth_year,
        "sex": getattr(ds, "PatientSex", None),
        "laterality": getattr(ds, "ImageLaterality", None),
        "view_position": getattr(ds, "ViewPosition", None),
        # CC/MLO ko'pincha ViewPosition orqali bo'sh keladi, lekin PatientOrientation
        # (Row\Col) deyarli har doim bor va CAD SR hisobotidagi rasm bilan aniq
        # moslashtirish (view_key) uchun ishonchli belgi bo'lib xizmat qiladi
        "orientation": "\\".join(str(x) for x in orientation) if orientation else None,
        # Piksel oralig'i (mm) — rasmdagi masofani piksel emas, millimetrda
        # o'lchash (ruler asbobi) uchun. DICOM odatda [qator, ustun] mm/piksel beradi.
        "pixel_spacing": float(ds.PixelSpacing[0]) if getattr(ds, "PixelSpacing", None) else None,
    }


def view_key(laterality, orientation) -> str | None:
    """Laterality + PatientOrientation'dan bitta ko'rinishni (masalan L-CC yoki
    L-MLO) boshqa joylarda ham bir xil aniqlash uchun kalit yasaydi."""
    if not laterality or not orientation:
        return None
    return f"{laterality}|{orientation}"


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


def _scoord_points(item) -> list:
    """SCOORD content-item'idan (x,y) juftliklar ro'yxatini qaytaradi."""
    data = list(item.get("GraphicData", []))
    return [[round(float(data[i])), round(float(data[i + 1]))] for i in range(0, len(data) - 1, 2)]


def parse_cad_sr(ds) -> dict | None:
    """Mammography CAD SR hisobotidan (masalan FUJIFILM M-CAD) topilmalarni to'liq
    o'qiydi: har bir kaltsifikatsiya to'plami, undagi HAR BIR alohida kaltsifikatsiyaning
    markazi va aniq konturi (outline). Har bir topilma ANIQ qaysi ko'rinishga (masalan
    L-CC yoki L-MLO — laterality+PatientOrientation orqali) tegishli ekani DICOM SR
    ichidagi "by-reference" bog'lanishlar (Referenced Content Item Identifier) orqali
    aniqlanadi — shu sababli MLO'dagi topilma CC'ga (yoki aksincha) aralashmaydi."""
    path_to_item: dict[tuple, object] = {}

    def index(item, path=()):
        path_to_item[path] = item
        for i, child in enumerate(item.get("ContentSequence", []), start=1):
            index(child, path + (i,))

    index(ds)

    # Rasmlar ro'yxati: tree-path -> (laterality, view_key)
    image_view = {}
    for path, item in path_to_item.items():
        if item.get("ValueType") == "IMAGE":
            lat = row = col = None
            for c in item.get("ContentSequence", []):
                name = _code_meaning(c.get("ConceptNameCodeSequence", []))
                if name == "Image Laterality":
                    raw = _code_meaning(c.get("ConceptCodeSequence", [])) or ""
                    lat = "L" if "Left" in raw else ("R" if "Right" in raw else None)
                elif name == "Patient Orientation Row":
                    row = c.get("TextValue")
                elif name == "Patient Orientation Col":
                    col = c.get("TextValue")
            orientation = "\\".join(x for x in (row, col) if x) or None
            image_view[path] = (lat, view_key(lat, orientation))

    def find_view(sub_item):
        for c in sub_item.get("ContentSequence", []):
            if "ReferencedContentItemIdentifier" in c:
                ref_path = tuple(int(x) for x in c.ReferencedContentItemIdentifier)[1:]
                return image_view.get(ref_path, (None, None))
            r = find_view(c)
            if r != (None, None):
                return r
        return (None, None)

    def parse_calcification(item) -> dict:
        calc = {"center": None, "outline": []}
        for c in item.get("ContentSequence", []):
            if c.get("ValueType") != "SCOORD":
                continue
            name = _code_meaning(c.get("ConceptNameCodeSequence", []))
            pts = _scoord_points(c)
            if name == "Center" and pts:
                calc["center"] = pts[0]
            elif name == "Outline" and pts:
                calc["outline"] = pts
        return calc

    # DICOM CID 6059 (Mammography CAD Non-Lesion/Lesion Finding turlari) — faqat
    # "Calcification Cluster"ni emas, boshqa TURDAGI topilmalarni ham ("Mass" — ya'ni
    # o'simta/soya, shuningdek assimetrik zichlik va arxitektura buzilishi) o'qiymiz.
    # Ilgari faqat kaltsifikatsiya to'plami o'qilar edi — shu sabab apparat "Mass" deb
    # belgilagan haqiqiy o'simta/soya joylari HECH QACHON rasmga chiqmas edi (garchi
    # SR faylida mavjud bo'lsa ham). Endi har ikkalasi ham qamrab olinadi.
    CLUSTER_FINDING_TYPES = {"Calcification Cluster"}
    SINGLE_REGION_FINDING_TYPES = {
        "Mass", "Focal Asymmetric Density", "Architectural Distortion",
        "Solitary Calcification", "Skin Lesion", "Intramammary Lymph Node",
    }

    by_side = {"L": {"clusters": []}, "R": {"clusters": []}}
    by_view = {}
    found_any = False

    for path, item in path_to_item.items():
        if _code_meaning(item.get("ConceptNameCodeSequence", [])) != "Single Image Finding":
            continue
        finding_type = _code_meaning(item.get("ConceptCodeSequence", []))
        if finding_type not in CLUSTER_FINDING_TYPES and finding_type not in SINGLE_REGION_FINDING_TYPES:
            continue

        side, vkey = find_view(item)
        if not side:
            continue
        found_any = True

        if finding_type in CLUSTER_FINDING_TYPES:
            cluster = {"type": finding_type, "center": None, "count": 0, "calcifications": []}
            for c in item.get("ContentSequence", []):
                name = _code_meaning(c.get("ConceptNameCodeSequence", []))
                if name == "Number of calcifications":
                    try:
                        cluster["count"] = int(c.MeasuredValueSequence[0].NumericValue)
                    except Exception:
                        pass
                elif name == "Center" and c.get("ValueType") == "SCOORD":
                    pts = _scoord_points(c)
                    if pts:
                        cluster["center"] = pts[0]
                elif _code_meaning(c.get("ConceptCodeSequence", [])) == "Individual Calcification":
                    cluster["calcifications"].append(parse_calcification(c))
        else:
            # Bitta mintaqali topilma (Mass va h.k.) — o'ziga xos kaltsifikatsiyalar
            # klasteri yo'q, faqat bitta markaz/kontur. Frontend'dagi mavjud
            # renderlashdan foydalanish uchun bitta "calcification" sifatida o'raymiz.
            region = parse_calcification(item)
            cluster = {
                "type": finding_type,
                "center": region["center"],
                "count": 1,
                "calcifications": [region],
            }

        by_side[side]["clusters"].append(cluster)
        if vkey:
            by_view.setdefault(vkey, {"clusters": []})["clusters"].append(cluster)

    if not found_any:
        return None

    summary_text = None
    for item in path_to_item.values():
        if _code_meaning(item.get("ConceptNameCodeSequence", [])) == "CAD Processing and Findings Summary":
            summary_text = _code_meaning(item.get("ConceptCodeSequence", []))
            break

    algorithm_name = algorithm_version = ""
    for item in path_to_item.values():
        cname = _code_meaning(item.get("ConceptNameCodeSequence", []))
        if cname == "Algorithm Name" and not algorithm_name:
            algorithm_name = item.get("TextValue", "") or ""
        elif cname == "Algorithm Version" and not algorithm_version:
            algorithm_version = item.get("TextValue", "") or ""
        if algorithm_name and algorithm_version:
            break

    detections_performed = []
    analyses_attempted_flags = []  # HAR BIR "Summary of Analyses" yozuvi — oldin faqat OXIRGISI saqlanardi (xato)
    for item in path_to_item.values():
        cname = _code_meaning(item.get("ConceptNameCodeSequence", []))
        if cname == "Detection Performed":
            val = _code_meaning(item.get("ConceptCodeSequence", []))
            if val and val not in detections_performed:
                detections_performed.append(val)
        elif cname == "Summary of Analyses":
            analyses_attempted_flags.append(
                _code_meaning(item.get("ConceptCodeSequence", [])) != "Not Attempted")

    # Barcha toifalar bo'yicha tahlil o'tkazilgan bo'lsagina True; birortasi bo'lmasa False —
    # avvalgi versiya faqat DARAXTDA OXIRGI uchragan yozuvni saqlar edi (boshqalarini yo'qotardi).
    analyses_attempted = all(analyses_attempted_flags) if analyses_attempted_flags else None

    # O'simta/soya turidagi (Mass va h.k.) tahlil UMUMAN o'tkazilganmi — bu "Calcification
    # Cluster" tahlilidan MUTLAQO BOSHQA, alohida CAD modul. Yo'q bo'lsa, CAD hech narsa
    # belgilamagani "o'simta yo'q" degani EMAS — apparat buni umuman qidirmagan, xolos.
    mass_detection_performed = any(
        d in detections_performed for d in ("Mass", "Focal Asymmetric Density", "Architectural Distortion")
    )

    return {
        "algorithm": algorithm_name or str(getattr(ds, "Manufacturer", "")),
        "algorithm_version": algorithm_version,
        "summary": summary_text,
        "detections_performed": detections_performed,
        "analyses_attempted": analyses_attempted,
        "mass_detection_performed": mass_detection_performed,
        "by_side": by_side,
        "by_view": by_view,
    }
