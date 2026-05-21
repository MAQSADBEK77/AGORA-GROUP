from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    hamshira = "hamshira"
    radiolog = "radiolog"


class PredictionLabel(str, enum.Enum):
    normal = "Normal"
    benign = "Benign"
    malignant = "Malignant"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.hamshira, nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    images = relationship("MammographyImage", back_populates="uploaded_by_user")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    birth_year = Column(Integer)
    phone = Column(String(20))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    images = relationship("MammographyImage", back_populates="patient")


class MammographyImage(Base):
    __tablename__ = "mammography_images"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_format = Column(String(20))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="images")
    uploaded_by_user = relationship("User", back_populates="images")
    prediction = relationship("Prediction", back_populates="image", uselist=False)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("mammography_images.id"), nullable=False)
    label = Column(Enum(PredictionLabel), nullable=False)
    confidence = Column(Float, nullable=False)
    normal_prob = Column(Float)
    benign_prob = Column(Float)
    malignant_prob = Column(Float)
    heatmap_path = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    image = relationship("MammographyImage", back_populates="prediction")


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(200))
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
