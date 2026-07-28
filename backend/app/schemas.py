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
    signature_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


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
    dicom_patient_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BulkDeleteRequest(BaseModel):
    patient_ids: List[int]


class DicomBatchResult(BaseModel):
    filename: str
    status: str  # "ok" | "error" | "skipped"
    patient_name: Optional[str] = None
    image_id: Optional[int] = None
    detail: Optional[str] = None
    quality_warnings: Optional[List[str]] = None


class DicomBatchResponse(BaseModel):
    total: int
    uploaded: int
    patients_created: int
    patients_matched: int
    results: List[DicomBatchResult]


class DoctorReviewCreate(BaseModel):
    label: ReviewLabel
    birads: Optional[int] = None  # BI-RADS (0-6), ixtiyoriy
    description: Optional[str] = None
    is_draft: bool = False  # True = qoralama sifatida saqlash, hali yakunlanmagan


class DoctorReviewOut(BaseModel):
    id: int
    image_id: int
    label: ReviewLabel
    birads: Optional[int] = None
    is_draft: bool = False
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
    lesion_x: Optional[float] = None
    lesion_y: Optional[float] = None
    lesion_width: Optional[float] = None
    lesion_height: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImageOut(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    filename: str
    file_format: Optional[str]
    laterality: Optional[str] = None
    view_position: Optional[str] = None
    patient_orientation: Optional[str] = None
    pixel_spacing: Optional[float] = None
    cad_summary: Optional[str] = None
    quality_warnings: Optional[str] = None
    assigned_to: Optional[int] = None
    assigned_to_name: Optional[str] = None
    status: ImageStatus
    uploaded_at: datetime
    review: Optional[DoctorReviewOut]
    ai_prediction: Optional[AIPredictionOut]

    class Config:
        from_attributes = True


class AssignRequest(BaseModel):
    image_ids: List[int]
    radiolog_id: Optional[int] = None  # None = biriktirishni bekor qilish


class NotificationOut(BaseModel):
    image_id: int
    patient_id: int
    patient_name: Optional[str] = None
    uploaded_at: datetime
    urgent: bool = False
    reason: Optional[str] = None  # nima uchun "urgent" (masalan sifat ogohlantirishi yoki uzoq kutgan)


class LogOut(BaseModel):
    id: int
    user_id: Optional[int]
    action: Optional[str]
    details: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class PersonalStatsOut(BaseModel):
    total_reviewed: int
    today_count: int
    week_count: int
    month_count: int
    avg_per_day: float
    label_counts: dict
    birads_counts: dict
    daily_counts: List[dict]


class DoctorStatsOut(BaseModel):
    doctor_id: int
    doctor_name: str
    total_reviewed: int
    recall_rate: float  # Normal bo'lmagan tashxislar foizi
    avg_per_day: float


class QAStatsOut(BaseModel):
    total_reviewed: int
    overall_recall_rate: float
    label_counts: dict
    per_doctor: List[DoctorStatsOut]
    monthly_trend: List[dict]  # [{"month": "2026-01", "count": N}, ...]


class DashboardStats(BaseModel):
    total_patients: int
    total_images: int
    pending_count: int
    reviewed_count: int
    normal_count: int
    benign_count: int
    malignant_count: int
    very_malignant_count: int
