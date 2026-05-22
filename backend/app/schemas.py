from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import UserRole, ImageStatus, ReviewLabel


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


class DoctorReviewCreate(BaseModel):
    label: ReviewLabel
    description: Optional[str] = None


class DoctorReviewOut(BaseModel):
    id: int
    image_id: int
    label: ReviewLabel
    description: Optional[str]
    reviewed_at: datetime
    doctor: Optional[UserOut]

    class Config:
        from_attributes = True


class AIPredictionOut(BaseModel):
    id: int
    image_id: int
    label: ReviewLabel
    confidence: float
    similar_cases: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ImageOut(BaseModel):
    id: int
    patient_id: int
    filename: str
    file_format: Optional[str]
    status: ImageStatus
    uploaded_at: datetime
    review: Optional[DoctorReviewOut]
    ai_prediction: Optional[AIPredictionOut]

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_patients: int
    total_images: int
    pending_count: int
    reviewed_count: int
    normal_count: int
    benign_count: int
    malignant_count: int
    very_malignant_count: int
