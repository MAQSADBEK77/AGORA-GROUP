import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
