import os, time, uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
SIGNATURES_DIR = os.path.join(UPLOAD_DIR, "signatures")
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg"}

# Login uchun oddiy xotiradagi rate-limiting (brute-force himoyasi).
# Ko'p foydalanuvchili/ko'p jarayonli joylashtirishda bu Redis kabi umumiy
# xotiraga ko'chirilishi kerak — hozircha bitta jarayonli joylashtirish yetarli.
_failed_attempts: dict[str, list[float]] = {}
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60


def _check_rate_limit(email: str):
    now = time.time()
    attempts = [t for t in _failed_attempts.get(email, []) if now - t < WINDOW_SECONDS]
    _failed_attempts[email] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        wait_min = int((WINDOW_SECONDS - (now - attempts[0])) / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Juda ko'p noto'g'ri urinish. {wait_min} daqiqadan keyin qayta urinib ko'ring."
        )


def _record_failure(email: str):
    _failed_attempts.setdefault(email, []).append(time.time())


@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    _check_rate_limit(request.email)

    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        _record_failure(request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email yoki parol noto'g'ri"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Foydalanuvchi bloklangan")

    _failed_attempts.pop(request.email, None)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# VAQTINCHALIK: admin parolini tiklash uchun favqulodda endpoint — faqat maxfiy
# kalit to'g'ri kiritilsa ishlaydi. Ishlatilgandan so'ng KOD'DAN OLIB TASHLANADI.
_BOOTSTRAP_SECRET = "9Tp9CsGFqY6R17H1dvbI6i_oPWhfHyMov4EVTgBLlUc"

@router.post("/bootstrap-reset-admin")
def bootstrap_reset_admin(secret: str, new_password: str, db: Session = Depends(get_db)):
    if secret != _BOOTSTRAP_SECRET:
        raise HTTPException(status_code=403, detail="Noto'g'ri kalit")
    admin = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin topilmadi")
    admin.hashed_password = hash_password(new_password)
    db.commit()
    _failed_attempts.clear()
    return {"success": True, "email": admin.email}


@router.get("/signature/{user_id}")
def serve_signature(user_id: int, db: Session = Depends(get_db)):
    """Foydalanuvchi imzo rasmini qaytaradi — <img> tag uchun auth kerak emas."""
    from fastapi.responses import FileResponse
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.signature_path or not os.path.exists(user.signature_path):
        raise HTTPException(status_code=404, detail="Imzo topilmadi")
    ext = os.path.splitext(user.signature_path)[1].lower()
    mtype = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return FileResponse(user.signature_path, media_type=mtype)


@router.post("/register", response_model=schemas.UserOut)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Faqat admin foydalanuvchi qo'sha oladi")

    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")

    user = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    return db.query(models.User).all()


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    db.delete(user)
    db.commit()
    return {"message": "Foydalanuvchi o'chirildi"}


@router.put("/profile", response_model=schemas.UserOut)
def update_profile(data: schemas.ProfileUpdate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    if data.full_name:
        current_user.full_name = data.full_name
    if data.email:
        existing = db.query(models.User).filter(
            models.User.email == data.email,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Bu email band")
        current_user.email = data.email
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Parol kamida 6 belgi bo'lishi kerak")
        current_user.hashed_password = hash_password(data.password)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/signature", response_model=schemas.UserOut)
def upload_signature(file: UploadFile = File(...),
                     db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    """Shaxsiy imzo rasmini yuklaydi — PDF tashxis hisobotlarida ko'rsatiladi.
    Faqat radiolog/admin uchun (ular hisobotlarni tasdiqlaydi)."""
    if current_user.role not in (models.UserRole.radiolog, models.UserRole.admin):
        raise HTTPException(status_code=403, detail="Faqat radiolog yoki admin")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Faqat PNG yoki JPG rasm qabul qilinadi")

    os.makedirs(SIGNATURES_DIR, exist_ok=True)
    path = os.path.join(SIGNATURES_DIR, f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}")

    old_path = current_user.signature_path
    with open(path, "wb") as f:
        f.write(file.file.read())

    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    user.signature_path = path
    db.commit()
    db.refresh(user)

    if old_path and os.path.exists(old_path):
        try:
            os.remove(old_path)
        except Exception:
            pass

    return user


@router.delete("/me/signature", response_model=schemas.UserOut)
def delete_signature(db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    if current_user.signature_path and os.path.exists(current_user.signature_path):
        try:
            os.remove(current_user.signature_path)
        except Exception:
            pass
    current_user.signature_path = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int,
                data: schemas.ProfileUpdate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if data.full_name:
        user.full_name = data.full_name
    if data.email:
        existing = db.query(models.User).filter(
            models.User.email == data.email, models.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Bu email band")
        user.email = data.email
    if data.password:
        user.hashed_password = hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user
