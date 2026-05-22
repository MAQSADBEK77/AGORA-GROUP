from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .routers import auth, upload, predict
from . import models
from .auth import hash_password
from .database import SessionLocal
import os

Base.metadata.create_all(bind=engine)


def run_migrations():
    """Mavjud bazaga yangi ustunlar qo'shadi (schema o'zgarsa)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE predictions ADD COLUMN cancer_prob REAL",
            "ALTER TABLE predictions ADD COLUMN analysis_mode TEXT DEFAULT 'heuristic'",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Ustun allaqachon mavjud


run_migrations()

app = FastAPI(title="MammoAI API", version="1.0.0",
              description="Mammografiya AI Tizimi - Ko'krak saratonini aniqlash")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(predict.router)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def create_default_admin():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
        if not admin:
            admin_user = models.User(
                full_name="Administrator",
                email="admin@mammoai.uz",
                hashed_password=hash_password("Admin@2024"),
                role=models.UserRole.admin,
                is_active=1,
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()


create_default_admin()


@app.get("/")
def root():
    return {"message": "MammoAI tizimiga xush kelibsiz!", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
