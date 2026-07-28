import json, os, shutil
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..ai.predictor import predict_from_labeled, index_labeled_image
from ..ai.lesion import detect_lesion_region
from ..reports import generate_diagnosis_pdf

router = APIRouter(prefix="/api", tags=["Review"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.get("/img/{image_id}")
def serve_image(image_id: int, db: Session = Depends(get_db)):
    """Rasm faylini qaytaradi — auth kerak emas."""
    img = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Topilmadi")

    path = _resolve_image_path(img)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fayl yo'q")

    ext   = os.path.splitext(path)[1].lower()
    mtype = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return FileResponse(path, media_type=mtype)


def _resolve_image_path(img: models.MammographyImage) -> str:
    path = img.file_path or ""
    if not os.path.exists(path):
        fname = os.path.basename(path.replace("\\", "/"))
        alt   = os.path.join(UPLOAD_DIR, fname)
        path  = alt if os.path.exists(alt) else path
    return path


@router.get("/report/{image_id}/pdf")
def download_report_pdf(image_id: int, db: Session = Depends(get_db),
                        current_user: models.User = Depends(get_current_user)):
    image = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    pdf_bytes = generate_diagnosis_pdf(image, _resolve_image_path(image))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="tashxis_{image_id}.pdf"'},
    )


def _require_radiolog(current_user: models.User):
    if current_user.role not in (models.UserRole.radiolog, models.UserRole.admin):
        raise HTTPException(status_code=403, detail="Faqat radiolog yoki admin")
    return current_user


# ─── Pending rasmlar (radiolog ko'rishi uchun) ───

@router.get("/pending", response_model=list[schemas.ImageOut])
def get_pending_images(db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)
    images = (db.query(models.MammographyImage)
              .filter(models.MammographyImage.status == models.ImageStatus.pending)
              .order_by(models.MammographyImage.uploaded_at.desc())
              .all())
    for img in images:
        img.patient_name = img.patient.full_name if img.patient else None
    return images


# ─── AI taxmin (labeled rasmlar bilan solishtirish) ───

@router.get("/ai-predict/{image_id}", response_model=schemas.AIPredictionOut)
def ai_predict(image_id: int, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)

    # AI tahlil hozircha o'chirilgan — dastur DICOM formatiga moslashtirilmoqda.
    raise HTTPException(status_code=503, detail="AI tahlil hozircha o'chirilgan")

    image = db.query(models.MammographyImage).filter(
        models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    if image.ai_prediction:
        return image.ai_prediction

    # Labeled rasmlarni bitta query bilan olish (N+1 dan qochish)
    from sqlalchemy import text
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")

    rows = db.execute(text("""
        SELECT dr.image_id, dr.label, mi.file_path
        FROM doctor_reviews dr
        JOIN mammography_images mi ON dr.image_id = mi.id
        WHERE dr.image_id != :img_id
    """), {"img_id": image_id}).fetchall()

    labeled_cases = []
    for row in rows:
        fp = row[2] or ""
        if not os.path.exists(fp):
            fname = os.path.basename(fp.replace("\\", "/"))
            alt   = os.path.join(upload_dir, fname)
            fp    = alt if os.path.exists(alt) else fp
        labeled_cases.append({
            "image_id":   row[0],
            "label":      row[1],
            "image_path": fp,
            "patient_name": "",
        })

    try:
        result = predict_from_labeled(image.file_path, labeled_cases)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI xatosi: {str(e)}")

    try:
        label_val  = result.get("label", "Normal")
        label_enum = models.ReviewLabel(label_val)
    except ValueError:
        label_enum = models.ReviewLabel.normal

    lesion_box = None
    if label_enum != models.ReviewLabel.normal:
        try:
            lesion_box = detect_lesion_region(image.file_path)
        except Exception:
            lesion_box = None

    pred = models.AIPrediction(
        image_id=image_id,
        label=label_enum,
        confidence=float(result.get("confidence", 0.0)),
        similar_cases=json.dumps(result.get("similar_cases", []), ensure_ascii=False),
        lesion_x=lesion_box["x"] if lesion_box else None,
        lesion_y=lesion_box["y"] if lesion_box else None,
        lesion_width=lesion_box["width"] if lesion_box else None,
        lesion_height=lesion_box["height"] if lesion_box else None,
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
        review.birads      = body.birads
        review.description = body.description
        review.doctor_id   = current_user.id
    else:
        review = models.DoctorReview(
            image_id=image_id,
            doctor_id=current_user.id,
            label=body.label,
            birads=body.birads,
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
    total_patients = db.execute(text(
        "SELECT COUNT(DISTINCT patient_id) FROM mammography_images WHERE patient_id IS NOT NULL"
    )).scalar() or 0
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
def get_reviewed(skip: int = 0, limit: int = 200,
                 db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    images = (db.query(models.MammographyImage)
              .filter(models.MammographyImage.status == models.ImageStatus.reviewed)
              .order_by(models.MammographyImage.uploaded_at.desc())
              .offset(skip).limit(limit).all())
    for img in images:
        img.patient_name = img.patient.full_name if img.patient else None
    return images


# ─── Admin: yuklangan bemorlar rasmlarini tozalash ───

@router.get("/admin/uploads/stats")
def get_upload_stats(db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    """Datasetdan tashqari yuklangan rasmlar soni."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Faqat admin")

    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    total = (db.query(models.MammographyImage)
             .filter(models.MammographyImage.file_path.like("%uploads%"))
             .filter(~models.MammographyImage.filename.like("mdb%"))
             .count())
    return {"uploaded_count": total}


@router.delete("/admin/uploads/clear")
def clear_uploaded_images(db: Session = Depends(get_db),
                          current_user: models.User = Depends(get_current_user)):
    """Datasetdan tashqari yuklangan barcha bemorlar rasmlarini o'chiradi."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Faqat admin")

    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")

    # Dataset (mdb*) dan tashqari rasm IDlari va fayl yo'llarini olish
    rows = db.execute(text("""
        SELECT id, file_path, filename FROM mammography_images
        WHERE file_path LIKE '%uploads%'
          AND filename NOT LIKE 'mdb%'
    """)).fetchall()

    if not rows:
        return {"success": True, "deleted_images": 0, "deleted_files": 0, "errors": []}

    image_ids = [r[0] for r in rows]
    deleted_files = 0
    errors        = []

    # Fayllarni diskdan o'chirish
    for img_id, file_path, _ in rows:
        path = file_path or ""
        if not os.path.exists(path):
            fname = os.path.basename(path.replace("\\", "/"))
            path  = os.path.join(upload_dir, fname)
        if os.path.exists(path):
            try:
                os.remove(path)
                deleted_files += 1
            except Exception as e:
                errors.append(str(e))

        emb_path = os.path.join(upload_dir, "embeddings", f"{img_id}.npy")
        if os.path.exists(emb_path):
            try:
                os.remove(emb_path)
            except Exception:
                pass

    # Raw SQL bilan ketma-ket o'chirish (NOT NULL constraint muammosidan qochish)
    placeholders = ",".join(str(i) for i in image_ids)
    db.execute(text(f"DELETE FROM ai_predictions WHERE image_id IN ({placeholders})"))
    db.execute(text(f"DELETE FROM doctor_reviews  WHERE image_id IN ({placeholders})"))
    db.execute(text(f"DELETE FROM mammography_images WHERE id IN ({placeholders})"))
    db.commit()

    log = models.Log(user_id=current_user.id, action="clear_uploads",
                     details=f"deleted {len(image_ids)} images, {deleted_files} files")
    db.add(log)
    db.commit()

    return {
        "success": True,
        "deleted_images": len(image_ids),
        "deleted_files": deleted_files,
        "errors": errors[:5] if errors else [],
    }
