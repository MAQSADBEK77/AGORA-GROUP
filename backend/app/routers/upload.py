from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..ai.validator import is_mammography_image
import os, shutil, uuid

router = APIRouter(prefix="/api", tags=["Upload"])
UPLOAD_DIR    = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_EXTS  = {".jpg", ".jpeg", ".png", ".dcm"}


@router.post("/patients", response_model=schemas.PatientOut)
def create_patient(patient: schemas.PatientCreate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    db_p = models.Patient(**patient.dict())
    db.add(db_p)
    db.commit()
    db.refresh(db_p)
    db.add(models.Log(user_id=current_user.id, action="create_patient",
                      details=f"{patient.full_name}"))
    db.commit()
    return db_p


@router.get("/patients", response_model=list[schemas.PatientOut])
def list_patients(search: str = "",
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Patient)
    if search:
        q = q.filter(models.Patient.full_name.ilike(f"%{search}%"))
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
        raise HTTPException(status_code=400, detail="Faqat JPG, PNG, DICOM formatlar")

    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    fname     = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, fname)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Mammografiya validatsiyasi
    valid, reason = is_mammography_image(file_path)
    if not valid:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Noto'g'ri rasm: {reason}")

    image = models.MammographyImage(
        patient_id=patient_id,
        uploaded_by=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_format=ext.lstrip(".").upper(),
        status=models.ImageStatus.pending,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    db.add(models.Log(user_id=current_user.id, action="upload",
                      details=f"image_id={image.id}, patient_id={patient_id}"))
    db.commit()
    return image


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
