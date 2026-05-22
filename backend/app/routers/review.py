import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..ai.predictor import predict_from_labeled, index_labeled_image

router = APIRouter(prefix="/api", tags=["Review"])


def _require_radiolog(current_user: models.User):
    if current_user.role not in (models.UserRole.radiolog, models.UserRole.admin):
        raise HTTPException(status_code=403, detail="Faqat radiolog yoki admin")
    return current_user


# ─── Pending rasmlar (radiolog ko'rishi uchun) ───

@router.get("/pending", response_model=list[schemas.ImageOut])
def get_pending_images(db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)
    return (db.query(models.MammographyImage)
            .filter(models.MammographyImage.status == models.ImageStatus.pending)
            .order_by(models.MammographyImage.uploaded_at.desc())
            .all())


# ─── AI taxmin (labeled rasmlar bilan solishtirish) ───

@router.get("/ai-predict/{image_id}", response_model=schemas.AIPredictionOut)
def ai_predict(image_id: int, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)

    image = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    # Mavjud taxmin bo'lsa qaytarish
    if image.ai_prediction:
        return image.ai_prediction

    # Barcha labeled rasmlarni olish (DB dan)
    reviews = (db.query(models.DoctorReview)
               .join(models.MammographyImage)
               .filter(models.MammographyImage.id != image_id)
               .all())

    labeled_cases = []
    for r in reviews:
        fp = r.image.file_path if r.image else ""
        # Fayl mavjudligini tekshirish
        import os as _os
        if not _os.path.exists(fp):
            fname = _os.path.basename(fp.replace("\\", "/"))
            alt   = _os.path.join(_os.getenv("UPLOAD_DIR", "./uploads"), fname)
            if _os.path.exists(alt):
                fp = alt
        labeled_cases.append({
            "image_id":    r.image_id,
            "label":       r.label.value,
            "image_path":  fp,
            "patient_name": r.image.patient.full_name if r.image and r.image.patient else "",
        })

    result = predict_from_labeled(image.file_path, labeled_cases)

    # Saqlash
    label_enum = models.ReviewLabel(result["label"])
    pred = models.AIPrediction(
        image_id=image_id,
        label=label_enum,
        confidence=result["confidence"],
        similar_cases=json.dumps(result.get("similar_cases", []), ensure_ascii=False),
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


# ─── Radiolog labeling (asosiy endpoint) ───

@router.post("/review/{image_id}", response_model=schemas.DoctorReviewOut)
def submit_review(image_id: int,
                  body: schemas.DoctorReviewCreate,
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)

    image = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    # Mavjud review ni yangilash yoki yangi yaratish
    review = image.review
    if review:
        review.label       = body.label
        review.description = body.description
        review.doctor_id   = current_user.id
    else:
        review = models.DoctorReview(
            image_id=image_id,
            doctor_id=current_user.id,
            label=body.label,
            description=body.description,
        )
        db.add(review)

    # Rasm statusini "reviewed" ga o'zgartirish
    image.status = models.ImageStatus.reviewed

    # Eski AI taxminni o'chirish (yangi label bo'lgani uchun)
    if image.ai_prediction:
        db.delete(image.ai_prediction)

    db.commit()
    db.refresh(review)

    # Embedding indekslash (AI uchun)
    index_labeled_image(image_id, image.file_path)

    log = models.Log(user_id=current_user.id, action="doctor_review",
                     details=f"image_id={image_id}, label={body.label}")
    db.add(log)
    db.commit()
    return review


# ─── Dashboard statistika ───

@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def dashboard_stats(db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    total_patients = db.query(models.Patient).count()
    total_images   = db.query(models.MammographyImage).count()
    pending_count  = db.query(models.MammographyImage).filter(
        models.MammographyImage.status == models.ImageStatus.pending).count()
    reviewed_count = db.query(models.MammographyImage).filter(
        models.MammographyImage.status == models.ImageStatus.reviewed).count()

    label_counts = (db.query(models.DoctorReview.label, func.count(models.DoctorReview.id))
                    .group_by(models.DoctorReview.label).all())
    counts = {lbl: cnt for lbl, cnt in label_counts}

    return schemas.DashboardStats(
        total_patients=total_patients,
        total_images=total_images,
        pending_count=pending_count,
        reviewed_count=reviewed_count,
        normal_count=counts.get(models.ReviewLabel.normal, 0),
        benign_count=counts.get(models.ReviewLabel.benign, 0),
        malignant_count=counts.get(models.ReviewLabel.malignant, 0),
        very_malignant_count=counts.get(models.ReviewLabel.very_malignant, 0),
    )


# ─── Barcha reviewed rasmlar ───

@router.get("/reviewed", response_model=list[schemas.ImageOut])
def get_reviewed(skip: int = 0, limit: int = 20,
                 db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    return (db.query(models.MammographyImage)
            .filter(models.MammographyImage.status == models.ImageStatus.reviewed)
            .order_by(models.MammographyImage.uploaded_at.desc())
            .offset(skip).limit(limit).all())
