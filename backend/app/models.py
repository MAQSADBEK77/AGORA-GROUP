from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

# DB da qiymatlar (value) bilan saqlanishi uchun
def _by_value(obj):
    return [e.value for e in obj]


class UserRole(str, enum.Enum):
    admin    = "admin"
    hamshira = "hamshira"
    radiolog = "radiolog"


class ImageStatus(str, enum.Enum):
    pending  = "pending"   # Hamshira yukladi, radiolog ko'rmagan
    reviewed = "reviewed"  # Radiolog belgiladi


class ReviewLabel(str, enum.Enum):
    normal        = "Normal"
    benign        = "Benign"
    malignant     = "Malignant"
    very_malignant = "Very Malignant"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    full_name       = Column(String(150), nullable=False)
    email           = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(Enum(UserRole, values_callable=_by_value), default=UserRole.hamshira, nullable=False)
    is_active       = Column(Integer, default=1)
    signature_path  = Column(String(500), nullable=True)  # Shaxsiy imzo rasmi — PDF hisobotlarda ko'rsatiladi
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    images  = relationship("MammographyImage", back_populates="uploaded_by_user",
                            foreign_keys="MammographyImage.uploaded_by")
    reviews = relationship("DoctorReview", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    id               = Column(Integer, primary_key=True, index=True)
    full_name        = Column(String(150), nullable=False)
    birth_year       = Column(Integer)
    phone            = Column(String(20))
    notes            = Column(Text)
    is_demo          = Column(Integer, default=0)
    dicom_patient_id = Column(String(64), index=True, nullable=True)  # DICOM PatientID (0010,0020) — takroriy bemorni aniqlash uchun
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    images = relationship("MammographyImage", back_populates="patient")


class MammographyImage(Base):
    __tablename__ = "mammography_images"

    id          = Column(Integer, primary_key=True, index=True)
    patient_id  = Column(Integer, ForeignKey("patients.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename    = Column(String(255), nullable=False)
    file_path   = Column(String(500), nullable=False)
    file_format = Column(String(20))
    laterality          = Column(String(4), nullable=True)   # DICOM ImageLaterality: R / L
    view_position       = Column(String(16), nullable=True)  # DICOM ViewPosition: CC / MLO / ...
    patient_orientation = Column(String(16), nullable=True)  # DICOM PatientOrientation: "A\R" kabi — ViewPosition bo'sh bo'lganda CC/MLO'ni aniq ajratish uchun
    pixel_spacing       = Column(Float, nullable=True)        # mm/piksel — ruler asbobi uchun
    cad_summary   = Column(Text, nullable=True)         # Apparat CAD hisoboti (SR) — JSON, mavjud bo'lsa
    quality_warnings = Column(Text, nullable=True)      # Rasm sifati ogohlantirishlari — JSON list, mavjud bo'lsa
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)  # Ish yukini taqsimlash uchun — biriktirilgan radiolog (ixtiyoriy, ko'rish huquqini cheklamaydi)
    annotations = Column(Text, nullable=True)  # Radiolog qo'lda chizgan erkin chiziqlar — JSON: [{"points":[[x,y],...], "color":"#..."}]
    status      = Column(Enum(ImageStatus, values_callable=_by_value), default=ImageStatus.pending, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    patient            = relationship("Patient", back_populates="images")
    uploaded_by_user   = relationship("User", back_populates="images", foreign_keys=[uploaded_by])
    assigned_to_user   = relationship("User", foreign_keys=[assigned_to])
    review             = relationship("DoctorReview", back_populates="image", uselist=False)
    ai_prediction      = relationship("AIPrediction", back_populates="image", uselist=False)
    second_opinions    = relationship("SecondOpinion", back_populates="image",
                                       order_by="SecondOpinion.created_at", cascade="all, delete-orphan")


class DoctorReview(Base):
    """Radiolog tomonidan qo'lda belgilangan diagnoz — AI uchun trening ma'lumot."""
    __tablename__ = "doctor_reviews"

    id          = Column(Integer, primary_key=True, index=True)
    image_id    = Column(Integer, ForeignKey("mammography_images.id"), nullable=False, unique=True)
    doctor_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    label       = Column(Enum(ReviewLabel, values_callable=_by_value), nullable=False)
    birads      = Column(Integer, nullable=True)  # BI-RADS xalqaro tasnifi (0-6), ixtiyoriy — asosiy `label` bilan birga
    is_draft    = Column(Boolean, default=False, nullable=False)  # True = qoralama, hali yakunlanmagan
    description = Column(Text)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    image  = relationship("MammographyImage", back_populates="review")
    doctor = relationship("User", back_populates="reviews")


class SecondOpinion(Base):
    """Ikkinchi radiologning mustaqil fikri — asosiy DoctorReview'ni ALMASHTIRMAYDI,
    faqat unga qo'shimcha, ixtiyoriy tekshiruv sifatida saqlanadi (yengil ikki bosqichli
    o'qish — to'liq arbitratsiya oqimisiz)."""
    __tablename__ = "second_opinions"

    id          = Column(Integer, primary_key=True, index=True)
    image_id    = Column(Integer, ForeignKey("mammography_images.id"), nullable=False)
    doctor_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    label       = Column(Enum(ReviewLabel, values_callable=_by_value), nullable=False)
    birads      = Column(Integer, nullable=True)
    description = Column(Text)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    image  = relationship("MammographyImage", back_populates="second_opinions")
    doctor = relationship("User")


class AIPrediction(Base):
    """AI tomonidan qilingan taxmin (labeled rasmlar bilan solishtirish asosida)."""
    __tablename__ = "ai_predictions"

    id            = Column(Integer, primary_key=True, index=True)
    image_id      = Column(Integer, ForeignKey("mammography_images.id"), nullable=False, unique=True)
    label         = Column(Enum(ReviewLabel, values_callable=_by_value), nullable=False)
    confidence    = Column(Float, nullable=False)
    similar_cases = Column(Text)   # JSON: eng o'xshash labellar
    # Shubhali (lesion) mintaqa — rasm o'lchamiga nisbatan normallashtirilgan (0..1) koordinatalar
    lesion_x      = Column(Float, nullable=True)
    lesion_y      = Column(Float, nullable=True)
    lesion_width  = Column(Float, nullable=True)
    lesion_height = Column(Float, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    image = relationship("MammographyImage", back_populates="ai_prediction")


class Log(Base):
    __tablename__ = "logs"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    action     = Column(String(200))
    details    = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
