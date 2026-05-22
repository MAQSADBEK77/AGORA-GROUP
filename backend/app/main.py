from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .routers import auth, upload, review
from . import models
from .auth import hash_password
from .database import SessionLocal
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MammoAI API", version="2.0.0",
              description="Mammografiya AI — Doktor tasdiqlashi asosida o'z-o'zini o'qituvchi tizim")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(review.router)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def create_default_admin():
    db = SessionLocal()
    try:
        exists = db.query(models.User).filter(
            models.User.role == models.UserRole.admin).first()
        if not exists:
            db.add(models.User(
                full_name="Administrator",
                email="admin@mammoai.uz",
                hashed_password=hash_password("Admin@2024"),
                role=models.UserRole.admin,
                is_active=1,
            ))
            db.commit()
    finally:
        db.close()


create_default_admin()


@app.get("/")
def root():
    return {"message": "MammoAI v2 — self-learning tizim", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
