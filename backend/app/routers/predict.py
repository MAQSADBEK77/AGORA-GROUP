from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..ai.predictor import predict_image
import os

router = APIRouter(prefix="/api", tags=["Prediction"])


@router.post("/predict/{image_id}", response_model=schemas.PredictionOut)
def run_prediction(image_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    image = db.query(models.MammographyImage).filter(models.MammographyImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")

    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=404, detail="Rasm fayli topilmadi")

    if image.prediction:
        return image.prediction

    result = predict_image(image.file_path, image_id)

    label_map = {0: models.PredictionLabel.normal,
                 1: models.PredictionLabel.cancer}

    prediction = models.Prediction(
        image_id=image_id,
        label=label_map[result["predicted_class"]],
        confidence=result["confidence"],
        normal_prob=result["probabilities"][0],
        cancer_prob=result["probabilities"][1],
        heatmap_path=result.get("heatmap_path"),
        analysis_mode=result.get("mode", "heuristic"),
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    log = models.Log(user_id=current_user.id, action="predict",
                     details=f"Analiz: image_id={image_id}, natija={prediction.label}")
    db.add(log)
    db.commit()
    return prediction


@router.get("/predictions/{prediction_id}", response_model=schemas.PredictionOut)
def get_prediction(prediction_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    pred = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not pred:
        raise HTTPException(status_code=404, detail="Natija topilmadi")
    return pred


@router.get("/predictions", response_model=list[schemas.PredictionOut])
def list_predictions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    return (db.query(models.Prediction)
            .order_by(models.Prediction.created_at.desc())
            .offset(skip).limit(limit).all())


@router.get("/heatmap/{prediction_id}")
def get_heatmap(prediction_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    pred = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not pred or not pred.heatmap_path:
        raise HTTPException(status_code=404, detail="Heatmap topilmadi")
    if not os.path.exists(pred.heatmap_path):
        raise HTTPException(status_code=404, detail="Heatmap fayli topilmadi")
    return FileResponse(pred.heatmap_path, media_type="image/png")


@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db),
                        current_user: models.User = Depends(get_current_user)):
    total_patients = db.query(models.Patient).count()
    total_images = db.query(models.MammographyImage).count()
    total_predictions = db.query(models.Prediction).count()

    label_counts = (db.query(models.Prediction.label, func.count(models.Prediction.id))
                    .group_by(models.Prediction.label).all())

    counts = {label: cnt for label, cnt in label_counts}
    return schemas.DashboardStats(
        total_patients=total_patients,
        total_images=total_images,
        total_predictions=total_predictions,
        normal_count=counts.get(models.PredictionLabel.normal, 0),
        cancer_count=counts.get(models.PredictionLabel.cancer, 0),
    )
