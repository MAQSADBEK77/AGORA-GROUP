from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
    allow_credentials=False,
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


@app.get("/health")
def health():
    return {"status": "ok"}


# Bitta-port production rejimi: agar frontend build qilingan bo'lsa
# (frontend/dist mavjud bo'lsa — masalan server skripti orqali `npm run
# build` ishlatilgandan keyin), backend uni ham xizmat qiladi. Shunda
# Tailscale Funnel kabi tunnel xizmatlari uchun faqat BITTA portni (backend)
# tashqariga chiqarish kifoya — frontend alohida server/port talab qilmaydi.
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # React Router client-side yo'llari (masalan /review/12) uchun
        # ham har doim index.html qaytariladi — routing brauzerda hal bo'ladi.
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "MammoAI v2 — self-learning tizim", "docs": "/docs"}
