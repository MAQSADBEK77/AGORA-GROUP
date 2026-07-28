import csv, io, json, os, shutil
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
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
    if image.review and image.review.is_draft:
        raise HTTPException(status_code=400, detail="Qoralama uchun hisobot yaratib bo'lmaydi — avval yakunlang")

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


# ─── Bildirishnomalar (yangi/shoshilinch kutayotgan holatlar) ───

URGENT_WAIT_HOURS = 24

@router.get("/notifications", response_model=list[schemas.NotificationOut])
def get_notifications(limit: int = 20,
                      db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)

    images = (db.query(models.MammographyImage)
              .filter(models.MammographyImage.status == models.ImageStatus.pending)
              .order_by(models.MammographyImage.uploaded_at.desc())
              .limit(limit)
              .all())

    now = datetime.utcnow()
    notifications = []
    for img in images:
        urgent, reason = False, None
        if img.quality_warnings:
            urgent, reason = True, "Sifat ogohlantirishi"
        elif img.uploaded_at and (now - img.uploaded_at.replace(tzinfo=None)) > timedelta(hours=URGENT_WAIT_HOURS):
            urgent, reason = True, f"{URGENT_WAIT_HOURS} soatdan ko'p kutmoqda"

        notifications.append(schemas.NotificationOut(
            image_id=img.id,
            patient_id=img.patient_id,
            patient_name=img.patient.full_name if img.patient else None,
            uploaded_at=img.uploaded_at,
            urgent=urgent,
            reason=reason,
        ))

    notifications.sort(key=lambda n: (not n.urgent, ))
    return notifications


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
        review.is_draft    = body.is_draft
        review.doctor_id   = current_user.id
    else:
        review = models.DoctorReview(
            image_id=image_id,
            doctor_id=current_user.id,
            label=body.label,
            birads=body.birads,
            description=body.description,
            is_draft=body.is_draft,
        )
        db.add(review)

    # Qoralama — rasm holati "kutmoqda"da qoladi, AI o'qitish uchun ishlatilmaydi.
    # Faqat yakunlanganda (is_draft=False) "reviewed" bo'ladi va AI embedding yangilanadi.
    if not body.is_draft:
        image.status = models.ImageStatus.reviewed
        if image.ai_prediction:
            db.delete(image.ai_prediction)

    db.commit()
    db.refresh(review)

    if not body.is_draft:
        index_labeled_image(image_id, image.file_path)

    log = models.Log(user_id=current_user.id,
                     action="doctor_review_draft" if body.is_draft else "doctor_review",
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
                    .filter(models.DoctorReview.is_draft == False)
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


# ─── Shaxsiy statistika (har bir radiolog uchun o'zi bajargan ishlar) ───

@router.get("/stats/personal", response_model=schemas.PersonalStatsOut)
def personal_stats(db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    _require_radiolog(current_user)

    reviews = (db.query(models.DoctorReview)
               .filter(models.DoctorReview.doctor_id == current_user.id,
                       models.DoctorReview.is_draft == False)
               .order_by(models.DoctorReview.reviewed_at.asc())
               .all())

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start  = today_start - timedelta(days=today_start.weekday())
    month_start = datetime(now.year, now.month, 1)

    label_counts, birads_counts, daily = {}, {}, {}
    today_count = week_count = month_count = 0

    for r in reviews:
        label_counts[r.label.value] = label_counts.get(r.label.value, 0) + 1
        if r.birads is not None:
            key = str(r.birads)
            birads_counts[key] = birads_counts.get(key, 0) + 1
        if r.reviewed_at:
            if r.reviewed_at >= today_start:
                today_count += 1
            if r.reviewed_at >= week_start:
                week_count += 1
            if r.reviewed_at >= month_start:
                month_count += 1
            d = r.reviewed_at.strftime("%Y-%m-%d")
            daily[d] = daily.get(d, 0) + 1

    # So'nggi 14 kunlik qator — bo'sh kunlar ham 0 bilan ko'rsatiladi (grafik uchun)
    daily_counts = []
    for i in range(13, -1, -1):
        d = (today_start - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_counts.append({"date": d, "count": daily.get(d, 0)})

    total = len(reviews)
    days_active = max((now - reviews[0].reviewed_at).days, 1) if reviews else 1
    avg_per_day = round(total / days_active, 2) if total else 0.0

    return schemas.PersonalStatsOut(
        total_reviewed=total,
        today_count=today_count,
        week_count=week_count,
        month_count=month_count,
        avg_per_day=avg_per_day,
        label_counts=label_counts,
        birads_counts=birads_counts,
        daily_counts=daily_counts,
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


# ─── Statistikani CSV qilib eksport qilish ───

@router.get("/export/reviews.csv")
def export_reviews_csv(db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    """Barcha radiolog diagnozlarini CSV (Excel'da ochiladigan) formatda qaytaradi."""
    if current_user.role not in (models.UserRole.admin, models.UserRole.radiolog):
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    rows = (db.query(models.DoctorReview, models.MammographyImage, models.Patient, models.User)
            .join(models.MammographyImage, models.DoctorReview.image_id == models.MammographyImage.id)
            .join(models.Patient, models.MammographyImage.patient_id == models.Patient.id)
            .join(models.User, models.DoctorReview.doctor_id == models.User.id)
            .filter(models.DoctorReview.is_draft == False)
            .order_by(models.DoctorReview.reviewed_at.desc())
            .all())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "review_id", "reviewed_at", "patient_id", "patient_name", "birth_year",
        "image_id", "filename", "laterality", "diagnosis", "birads", "description", "doctor",
    ])
    for review, image, patient, doctor in rows:
        writer.writerow([
            review.id, review.reviewed_at.strftime("%Y-%m-%d %H:%M") if review.reviewed_at else "",
            patient.id, patient.full_name, patient.birth_year or "",
            image.id, image.filename, image.laterality or "",
            review.label.value, review.birads if review.birads is not None else "",
            (review.description or "").replace("\n", " "), doctor.full_name,
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mammoai_diagnozlar.csv"},
    )


# ─── Admin: audit-log ───

@router.get("/admin/logs", response_model=list[schemas.LogOut])
def get_audit_logs(skip: int = 0, limit: int = 100, action: str = "",
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    """Tizimdagi harakatlar tarixi (faqat admin ko'ra oladi)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Faqat admin")

    q = db.query(models.Log)
    if action:
        q = q.filter(models.Log.action == action)
    logs = q.order_by(models.Log.created_at.desc()).offset(skip).limit(limit).all()

    user_ids = {l.user_id for l in logs if l.user_id}
    users = {u.id: u.full_name for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()} if user_ids else {}
    for l in logs:
        l.user_name = users.get(l.user_id)
    return logs


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


@router.delete("/admin/patients/bulk")
def bulk_delete_patients(body: schemas.BulkDeleteRequest,
                         db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    """Bir nechta bemorni (va ularning yuklangan rasmlarini) birdaniga o'chiradi.
    Dataset (mdb*) rasmlari saqlanadi — clear_uploads bilan bir xil xavfsizlik qoidasi."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Faqat admin")
    if not body.patient_ids:
        raise HTTPException(status_code=400, detail="Bemor tanlanmagan")

    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    patient_ids = [int(pid) for pid in body.patient_ids]
    placeholders = ",".join(str(pid) for pid in patient_ids)

    rows = db.execute(text(f"""
        SELECT id, file_path, filename FROM mammography_images
        WHERE patient_id IN ({placeholders})
          AND filename NOT LIKE 'mdb%'
    """)).fetchall()

    image_ids = [r[0] for r in rows]
    deleted_files = 0
    errors = []

    for img_id, file_path, _ in rows:
        path = file_path or ""
        if not os.path.exists(path):
            fname = os.path.basename(path.replace("\\", "/"))
            path = os.path.join(upload_dir, fname)
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

    if image_ids:
        img_placeholders = ",".join(str(i) for i in image_ids)
        db.execute(text(f"DELETE FROM ai_predictions WHERE image_id IN ({img_placeholders})"))
        db.execute(text(f"DELETE FROM doctor_reviews  WHERE image_id IN ({img_placeholders})"))
        db.execute(text(f"DELETE FROM mammography_images WHERE id IN ({img_placeholders})"))
        db.commit()

    # Endi rasmi qolmagan bemorlarni (dataset rasmi ham yo'q bo'lsa) o'chirish
    deleted_patients = 0
    for pid in patient_ids:
        remaining = db.query(models.MammographyImage).filter(
            models.MammographyImage.patient_id == pid).count()
        if remaining == 0:
            patient = db.query(models.Patient).filter(models.Patient.id == pid).first()
            if patient:
                db.delete(patient)
                deleted_patients += 1
    db.commit()

    log = models.Log(user_id=current_user.id, action="bulk_delete_patients",
                     details=f"patient_ids={patient_ids}, deleted_images={len(image_ids)}, deleted_patients={deleted_patients}")
    db.add(log)
    db.commit()

    return {
        "success": True,
        "deleted_images": len(image_ids),
        "deleted_files": deleted_files,
        "deleted_patients": deleted_patients,
        "errors": errors[:5] if errors else [],
    }
