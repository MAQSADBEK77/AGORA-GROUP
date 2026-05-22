# MammoAI — Mammografiya AI Tizimi

Ko'krak saraton kasalligini erta aniqlash uchun yaratilgan tibbiy AI tizim.
Hamshira rasm yuklaydi → radiolog tekshiradi → AI o'z-o'zini o'qitib boradi.

---

## Ishga tushirish

> **Talab:** Python 3.10+, Node.js 18+

**1. Backend** — yangi terminal oching:

```
start_backend.bat
```

**2. Frontend** — boshqa terminal oching:

```
start_frontend.bat
```

**3. Brauzerda oching:** [http://localhost:3000](http://localhost:3000)

---

## Test akkauntlari

| Rol | Email | Parol |
|-----|-------|-------|
| **Admin** | admin@mammoai.uz | admin123 |
| **Radiolog** | maqsadbekweb@gmail.com | admin123 |
| **Hamshira** | shohjaxon@gmail.com | admin123 |

---

## Test qilish tartibi

### 1. Hamshira sifatida kiring
- Dashboard'da o'ng tomonda **"Rasm yuklash"** widget mavjud
- Bemor qidiring yoki yangi bemor yarating
- Mammografiya rasmini yuklang (JPG/PNG)

### 2. Radiolog sifatida kiring
- Navbar'da **qo'ng'iroq belgisi** — yangi rasm kelganda bildirishnoma chiqadi
- **"Ko'rib chiqish"** bo'limiga o'ting
- Rasmni oching → **"AI dan so'rang"** tugmasini bosing
- AI taxminini ko'ring, keyin o'z diagnozingizni qo'ying:
  `Normal / Benign / Malignant / Very Malignant`

### 3. Admin sifatida kiring
- **Foydalanuvchilar** qo'shish, tahrirlash, o'chirish
- **"Yuklangan bemorlar rasmlarini tozalash"** — test rasmlarini o'chirish

---

## Tizim qanday ishlaydi

```
Hamshira rasm yuklaydi
        ↓
Radiolog rasmni ko'rib diagnoz qo'yadi
        ↓
AI bu rasmni o'rganib oladi (self-learning)
        ↓
Keyingi yangi rasmda AI shu tajribadan foydalanadi
```

**AI texnologiyasi:** KNN + ResNet embedding. Radiolog qancha ko'p label qo'ysa, AI shuncha aniqroq ishlaydi. DB da 990 ta labeled MIAS mammografiya rasmi bor.

---

## Sahifalar

| Sahifa | URL | Kim uchun |
|--------|-----|-----------|
| Login | `/login` | Hammaga |
| Dashboard | `/dashboard` | Hammaga |
| Ko'rib chiqish | `/review` | Radiolog, Admin |
| Rasm detali | `/review/:id` | Radiolog, Admin |
| Admin panel | `/admin` | Admin |

---

## Texnologiyalar

| | |
|-|-|
| **Frontend** | React, Tailwind CSS, Recharts |
| **Backend** | Python, FastAPI, SQLAlchemy |
| **AI** | KNN, ResNet18 embedding, NumPy |
| **DB** | SQLite |
| **Auth** | JWT, bcrypt |

---

## API

Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

Asosiy endpointlar:
```
POST /api/auth/login
GET  /api/pending          # Kutayotgan rasmlar
GET  /api/ai-predict/{id}  # AI taxmin
POST /api/review/{id}      # Radiolog diagnozi
GET  /api/dashboard/stats  # Statistika
```

---

> **Eslatma:** Bu tizim shifokorga yordamchi vosita bo'lib, yakuniy qaror doim shifokor tomonidan qabul qilinadi.
