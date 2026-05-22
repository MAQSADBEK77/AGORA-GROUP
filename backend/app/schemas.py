from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from .models import UserRole, PredictionLabel


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.hamshira


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class PatientCreate(BaseModel):
    full_name: str
    birth_year: Optional[int] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    full_name: str
    birth_year: Optional[int]
    phone: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PredictionOut(BaseModel):
    id: int
    image_id: int
    label: PredictionLabel
    confidence: float
    normal_prob: Optional[float]
    cancer_prob: Optional[float]
    heatmap_path: Optional[str]
    analysis_mode: Optional[str] = "heuristic"
    created_at: datetime

    class Config:
        from_attributes = True


class ImageOut(BaseModel):
    id: int
    patient_id: int
    filename: str
    file_format: Optional[str]
    uploaded_at: datetime
    prediction: Optional[PredictionOut]

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_patients: int
    total_images: int
    total_predictions: int
    normal_count: int
    cancer_count: int
