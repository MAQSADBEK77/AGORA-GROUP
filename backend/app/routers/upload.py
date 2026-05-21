from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
import os, shutil, uuid

router = APIRouter(prefix="/api", tags=["Upload"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".dcm"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def validate_file(file: UploadFile):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Format qo'llab-quvvatlanmaydi. JPG, PNG, DICOM yuklang.")


@router.post("/patients", response_model=schemas.PatientOut)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    db_patient = models.Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)

    log = models.Log(user_id=current_user.id, action="create_patient",
                     details=f"Bemor yaratildi: {patient.full_name}")
    db.add(log)
    db.commit()
    return db_patient


@router.get("/patients", response_model=list[schemas.PatientOut])
def list_patients(search: str = "", db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Patient)
    if search:
        query = query.filter(models.Patient.full_name.ilike(f"%{search}%"))
    return query.order_by(models.Patient.created_at.desc()).all()


@router.get("/patients/{patient_id}", response_model=schemas.PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    return patient


@router.post("/upload", response_model=schemas.ImageOut)
async def upload_image(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    validate_file(file)

    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    image = models.MammographyImage(
        patient_id=patient_id,
        uploaded_by=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_format=ext.lstrip(".").upper(),
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    log = models.Log(user_id=current_user.id, action="upload_image",
                     details=f"Rasm yuklandi: {file.filename}, bemor_id={patient_id}")
    db.add(log)
    db.commit()
    return image


@router.get("/images/{image_id}", response_model=schemas.ImageOut)
def get_image(image_id: int, db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):
    image = db.query(models.MammographyImage).filter(models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")
    return image


@router.get("/patients/{patient_id}/images", response_model=list[schemas.ImageOut])
def get_patient_images(patient_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    return (db.query(models.MammographyImage)
            .filter(models.MammographyImage.patient_id == patient_id)
            .order_by(models.MammographyImage.uploaded_at.desc())
            .all())
