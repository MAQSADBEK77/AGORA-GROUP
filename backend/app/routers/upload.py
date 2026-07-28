from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..dicom_utils import dicom_to_png, read_dicom, render_png, extract_patient_info, is_cad_sr, parse_cad_sr
import json, os, shutil, uuid

router = APIRouter(prefix="/api", tags=["Upload"])
UPLOAD_DIR    = os.getenv("UPLOAD_DIR", "./uploads")
# Hozircha dastur faqat DICOM (.dcm) formatini qabul qiladi — AI tahlil vaqtincha o'chirilgan.
ALLOWED_EXTS  = {".dcm"}


@router.post("/patients", response_model=schemas.PatientOut)
def create_patient(patient: schemas.PatientCreate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    db_p = models.Patient(**patient.dict(), is_demo=0)
    db.add(db_p)
    db.commit()
    db.refresh(db_p)
    db.add(models.Log(user_id=current_user.id, action="create_patient",
                      details=f"{patient.full_name}"))
    db.commit()
    return db_p


@router.get("/patients", response_model=list[schemas.PatientOut])
def list_patients(search: str = "",
                  label: str = "",
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    from sqlalchemy import text as _text
    # Faqat real (demo bo'lmagan) bemorlar
    q = db.query(models.Patient).filter(models.Patient.is_demo == 0)

    if search:
        q = q.filter(
            models.Patient.full_name.ilike(f"%{search}%") |
            models.Patient.phone.ilike(f"%{search}%")
        )

    if label:
        # Diagnozi label ga mos bemorlar
        labeled_ids = db.execute(_text("""
            SELECT DISTINCT mi.patient_id
            FROM mammography_images mi
            JOIN doctor_reviews dr ON dr.image_id = mi.id
            WHERE dr.label = :label
        """), {"label": label}).scalars().all()
        q = q.filter(models.Patient.id.in_(labeled_ids))

    return q.order_by(models.Patient.created_at.desc()).all()


@router.get("/patients/{patient_id}", response_model=schemas.PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    return p


@router.post("/upload", response_model=schemas.ImageOut)
async def upload_image(patient_id: int = Form(...),
                       file: UploadFile = File(...),
                       db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Faqat DICOM (.dcm) fayllar qabul qilinadi")

    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    uid       = uuid.uuid4().hex
    dcm_path  = os.path.join(UPLOAD_DIR, f"{uid}.dcm")
    png_path  = os.path.join(UPLOAD_DIR, f"{uid}.png")

    with open(dcm_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        dicom_to_png(dcm_path, png_path)
    except Exception as e:
        os.remove(dcm_path)
        raise HTTPException(status_code=422, detail=f"DICOM faylni o'qib bo'lmadi: {e}")

    image = models.MammographyImage(
        patient_id=patient_id,
        uploaded_by=current_user.id,
        filename=file.filename,
        file_path=png_path,
        file_format="DCM",
        status=models.ImageStatus.pending,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    db.add(models.Log(user_id=current_user.id, action="upload",
                      details=f"image_id={image.id}, patient_id={patient_id}"))
    db.commit()
    return image


@router.post("/upload/dicom-folder", response_model=schemas.DicomBatchResponse)
async def upload_dicom_folder(files: list[UploadFile] = File(...),
                              db: Session = Depends(get_db),
                              current_user: models.User = Depends(get_current_user)):
    """Bir papka = bitta bemor. Papka ichidagi barcha .dcm fayllar (bemorning
    turli ko'rinishlari — R/L, CC/MLO) shu bitta bemorga biriktiriladi;
    bemor DICOM metama'lumotidan (birinchi topilgan fayldan) aniqlanadi."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    results: list[schemas.DicomBatchResult] = []
    processed = []  # (filename, png_path)
    patient_info = None
    cad_summary_json = None

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext != ".dcm":
            continue  # papka ichidagi DICOM bo'lmagan fayllar o'tkazib yuboriladi

        uid      = uuid.uuid4().hex
        dcm_path = os.path.join(UPLOAD_DIR, f"{uid}.dcm")
        with open(dcm_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            ds = read_dicom(dcm_path)
        except Exception as e:
            os.remove(dcm_path)
            results.append(schemas.DicomBatchResult(
                filename=file.filename, status="error", detail=f"DICOM faylni o'qib bo'lmadi: {e}"))
            continue

        info = extract_patient_info(ds)
        # Butun papka uchun bemor ma'lumoti — birinchi topilgan (PatientID yoki ism bor) fayldan olinadi
        if patient_info is None and (info["patient_id"] or info["full_name"]):
            patient_info = info

        # Ba'zi .dcm fayllar rasm emas (masalan CAD hisobot/SR, DICOMDIR) — piksel
        # ma'lumoti yo'q, shuning uchun xato emas, shunchaki o'tkazib yuboriladi
        if "PixelData" not in ds:
            os.remove(dcm_path)
            modality = getattr(ds, "Modality", "?")
            detail = f"Rasm emas ({modality} — hisobot/metama'lumot fayli)"
            if is_cad_sr(ds):
                try:
                    cad = parse_cad_sr(ds)
                    if cad:
                        cad_summary_json = json.dumps(cad, ensure_ascii=False)
                        detail = f"Apparat CAD hisoboti ({cad['algorithm']}) — topilmalar rasmlarga qo'shildi"
                except Exception:
                    pass
            results.append(schemas.DicomBatchResult(
                filename=file.filename, status="skipped", detail=detail))
            continue

        try:
            png_path = os.path.join(UPLOAD_DIR, f"{uid}.png")
            render_png(ds, png_path)
        except Exception as e:
            os.remove(dcm_path)
            results.append(schemas.DicomBatchResult(
                filename=file.filename, status="error", detail=str(e)))
            continue

        processed.append((file.filename, png_path, info["laterality"], info["view_position"], info["orientation"]))

    # --- Bitta bemorni aniqlash/yaratish (butun papka uchun bir marta) ---
    patient = None
    patients_created = patients_matched = 0
    if processed:
        if patient_info and patient_info["patient_id"]:
            patient = db.query(models.Patient).filter(
                models.Patient.dicom_patient_id == patient_info["patient_id"]).first()

        if patient:
            patients_matched = 1
        else:
            uid = uuid.uuid4().hex[:8]
            patient = models.Patient(
                full_name=(patient_info and patient_info["full_name"])
                          or f"Noma'lum bemor ({(patient_info and patient_info['patient_id']) or uid})",
                birth_year=patient_info["birth_year"] if patient_info else None,
                dicom_patient_id=patient_info["patient_id"] if patient_info else None,
                is_demo=0,
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
            patients_created = 1

    uploaded = 0
    for filename, png_path, laterality, view_position, orientation in processed:
        image = models.MammographyImage(
            patient_id=patient.id,
            uploaded_by=current_user.id,
            filename=filename,
            file_path=png_path,
            file_format="DCM",
            laterality=laterality,
            view_position=view_position,
            patient_orientation=orientation,
            cad_summary=cad_summary_json,
            status=models.ImageStatus.pending,
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        uploaded += 1
        results.append(schemas.DicomBatchResult(
            filename=filename, status="ok",
            patient_name=patient.full_name, image_id=image.id))

    db.add(models.Log(user_id=current_user.id, action="upload_dicom_folder",
                      details=f"{uploaded} rasm, bemor: {patient.full_name if patient else '-'}"))
    db.commit()

    return schemas.DicomBatchResponse(
        total=len(files), uploaded=uploaded,
        patients_created=patients_created, patients_matched=patients_matched,
        results=results,
    )


@router.get("/images/{image_id}", response_model=schemas.ImageOut)
def get_image(image_id: int, db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):
    img = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")
    return img


@router.get("/image-file/{image_id}")
def serve_image_file(image_id: int, db: Session = Depends(get_db)):
    """Rasm faylini qaytaradi — auth talab qilinmaydi (img tag uchun)."""
    from fastapi.responses import FileResponse
    img = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    path = img.file_path or ""
    if not os.path.exists(path):
        fname = os.path.basename(path.replace("\\", "/"))
        alt   = os.path.join(UPLOAD_DIR, fname)
        path  = alt if os.path.exists(alt) else ""

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    ext   = os.path.splitext(path)[1].lower()
    mtype = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return FileResponse(path, media_type=mtype)


@router.get("/patients/{patient_id}/images", response_model=list[schemas.ImageOut])
def get_patient_images(patient_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    return (db.query(models.MammographyImage)
            .filter(models.MammographyImage.patient_id == patient_id)
            .order_by(models.MammographyImage.uploaded_at.desc())
            .all())
