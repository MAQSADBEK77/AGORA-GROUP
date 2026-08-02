# MammoAI — Mammografiya AI Tizimi

Ko'krak saraton kasalligini erta aniqlash uchun yaratilgan tibbiy AI tizim.
Hamshira rasm yuklaydi → radiolog tekshiradi → AI o'z-o'zini o'qitib boradi.

---

## Ishga tushirish (Windows)

GitHub'dan repo'ni yuklab oling (yashil **Code → Download ZIP** yoki `git clone`),
so'ng papka ichidagi:

```
ISHGA_TUSHIRISH.bat
```

faylini ikki marta bosing. Shu bitta fayl avtomatik ravishda:

- Python va Node.js borligini tekshiradi (yo'q bo'lsa `winget` orqali o'zi o'rnatadi)
- Backend va frontend uchun kerakli kutubxonalarni o'rnatadi
- Ikkala serverni ishga tushiradi
- Brauzerni [http://localhost:3000](http://localhost:3000) manzilida ochadi

> Agar Python/Node birinchi marta shu skript orqali o'rnatilsa, oyna sizdan
> uni yopib qayta ochishni so'rashi mumkin (Windows PATH yangilanishi uchun) —
> bu faqat birinchi ishga tushirishda, bir marta bo'ladi.

Keyingi safar dasturni ochish uchun ham xuddi shu faylni bosishning o'zi
yetarli — kutubxonalar allaqachon o'rnatilgani uchun bir necha soniyada
ishga tushadi.

<details>
<summary>Alohida ishga tushirish, AI trenirovka, demo data (ilg'or foydalanuvchilar uchun)</summary>

**Talab:** Python 3.10+, Node.js 18+

Quyidagi fayllar `qoshimcha_skriptlar/` papkasida joylashgan (kunlik
ishlatishda kerak emas, shuning uchun asosiy papkadan olib qo'yilgan):

1. `install_windows.bat` / `install_mac.sh` — Python/Node tekshiradi va o'rnatadi
2. `start_backend_windows.bat` / `start_backend_mac.sh` — backend (alohida terminal)
3. `start_frontend_windows.bat` / `start_frontend_mac.sh` — frontend (alohida terminal)
4. `install_ai_windows.bat` / `install_ai_mac.sh` — PyTorch/AI kutubxonalarni o'rnatish (~500MB)
5. `train_windows.bat` / `train_mac.sh` — CBIS-DDSM asosida model trenirovkasi
6. `setup_demo_windows.bat` / `setup_demo_mac.sh` — Kaggle'dan MIAS demo dataset yuklash
7. `colab_train.ipynb` — Google Colab'da GPU bilan trenirovka qilish uchun notebook

Brauzerda oching: [http://localhost:3000](http://localhost:3000)

</details>

**macOS:** `Backend_Mac.command` va `Frontend_Mac.command` fayllarini oching.

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
GET  /api/report/{id}/pdf  # Tashxis hisoboti (PDF)
GET  /api/dashboard/stats  # Statistika
```

---

## Loyiha tuzilishi (fayllar xaritasi)

```
AGORA-GROUP-main/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI kirish nuqtasi — router'larni ulaydi, admin user yaratadi
│   │   ├── database.py          # SQLAlchemy engine/session (SQLite, DATABASE_URL orqali o'zgartiriladi)
│   │   ├── models.py            # ORM jadvallar: User, Patient, MammographyImage, DoctorReview, AIPrediction, Log
│   │   ├── schemas.py           # Pydantic request/response modellari (validatsiya)
│   │   ├── auth.py              # JWT yaratish/tekshirish (HS256), parol hash (bcrypt)
│   │   ├── reports.py           # Tashxis hisobotini PDF qilib generatsiya qiladi (reportlab)
│   │   ├── ai/
│   │   │   ├── embeddings.py    # ResNet18 (yoki PyTorch yo'q bo'lsa statistik fallback) bilan rasm embedding
│   │   │   ├── predictor.py     # KNN — eng o'xshash labellangan rasmlar bo'yicha weighted-vote taxmin
│   │   │   ├── lesion.py        # Shubhali/zich mintaqani klassik tasvirga ishlov berish orqali topadi
│   │   │   ├── validator.py     # Yuklangan rasm haqiqatan mammografiyami (grayscale, hajm) tekshiradi
│   │   │   └── heatmap.py       # Grad-CAM eskizi — hozirgi oqimda ishlatilmaydi (kelajak uchun saqlangan)
│   │   └── routers/
│   │       ├── auth.py          # /api/auth/*   — login, foydalanuvchi CRUD
│   │       ├── upload.py        # /api/patients, /api/upload — bemor va rasm yuklash
│   │       ├── review.py        # /api/pending, /api/ai-predict, /api/review, /api/report/*  — asosiy oqim
│   │       └── predict.py       # main.py'ga ulanmagan — eski (CNN-asoslangan) yondashuv qoldig'i
│   ├── migrate.py               # Bazaga yangi ustun qo'shish skripti (ALTER TABLE, ma'lumot yo'qolmaydi)
│   ├── setup_demo_data.py       # MIAS datasetini Kaggle'dan yuklab demo sifatida import qiladi
│   ├── prepare_dataset.py       # CBIS-DDSM'ni train.py uchun papka tuzilishiga tayyorlaydi
│   ├── train.py                 # Mustaqil ResNet klassifikator o'qitish skripti (ilova ishga tushishi uchun shart emas)
│   ├── requirements.txt         # Ilovani ishga tushirish uchun asosiy bog'liqliklar
│   ├── requirements-ai.txt      # Faqat train.py/prepare_dataset.py uchun og'ir AI bog'liqliklar (torch, timm...)
│   └── mammoai.db               # SQLite baza fayli
└── frontend/
    └── src/
        ├── App.jsx, main.jsx        # Marshrutlar (routes) va React kirish nuqtasi
        ├── api/axios.js             # Axios instance — JWT tokenni avtomatik biriktiradi, 401'da logout
        ├── context/ThemeContext.jsx # Dark/Light rejim
        ├── components/
        │   ├── Layout.jsx, Navbar.jsx, Sidebar.jsx  # Umumiy joylashuv
        │   ├── ProtectedRoute.jsx   # Tokensiz foydalanuvchini /login'ga yo'naltiradi
        │   ├── ImageZoom.jsx        # Rasmni kattalashtirish/panoramalash modali
        │   └── LesionOverlay.jsx   # AI aniqlagan shubhali mintaqa ramkasini rasm ustiga chizadi
        └── pages/
            ├── Login.jsx, Dashboard.jsx, Upload.jsx
            ├── ReviewQueue.jsx / ReviewDetail.jsx   # Navbat va detal — AI tahlil + PDF hisobot shu yerda
            ├── PatientHistory.jsx, AdminPanel.jsx
            └── PredictionResult.jsx  # App.jsx'da marshrut yo'q — ishlatilmaydi
```

> `predict.py`, `heatmap.py` va `PredictionResult.jsx` — loyihaning oldingi (CNN-asoslangan) versiyasidan qolgan fayllar, joriy oqimga ulanmagan. Himoya paytida savol bo'lsa, halol shunday deb javob bering.

---

## Arxitektura va ma'lumotlar oqimi

```
1. Hamshira rasm yuklaydi (Upload.jsx → POST /api/upload)
   → validator.py rasm grayscale/hajm bo'yicha tekshiradi
   → fayl backend/uploads/ ga saqlanadi, DB'da status="pending"

2. Radiolog "Ko'rib chiqish" navbatida rasmni ochadi (ReviewDetail.jsx)
   → "AI dan so'rang" → GET /api/ai-predict/{id}
   → embeddings.py: ResNet18 orqali yangi rasmning 512-o'lchamli vektori olinadi
   → predictor.py: barcha oldin labellangan rasmlar bilan cosine similarity hisoblanadi,
     eng yaqin K=5 tasi weighted-vote qiladi → label + confidence
   → agar natija "Normal" bo'lmasa, lesion.py tasvirni threshold+contour orqali
     tahlil qilib eng zich mintaqaning bbox'ini topadi (LesionOverlay.jsx rasm ustida chizadi)

3. Radiolog yakuniy diagnozni tanlaydi + izoh yozadi → POST /api/review/{id}
   → DoctorReview yoziladi, rasm statusi "reviewed"ga o'tadi
   → index_labeled_image(): shu rasmning embeddingi saqlanadi — bu "o'z-o'zini o'qitish":
     keyingi yangi rasmlar endi shu labellangan rasm bilan ham solishtiriladi

4. Istalgan vaqtda "Tashxis hisoboti (PDF)" tugmasi → GET /api/report/{id}/pdf
   → reports.py bemor ma'lumotlari + rasm (lesion ramkasi bilan) + AI natija +
     radiolog xulosasi/izohini bitta PDF faylga jamlaydi
```

### Ma'lumotlar bazasi sxemasi

| Jadval | Vazifasi | Asosiy bog'lanish |
|---|---|---|
| `users` | Login, rol (admin/hamshira/radiolog) | — |
| `patients` | Bemor kartasi | — |
| `mammography_images` | Yuklangan rasm, status (pending/reviewed) | `patient_id`, `uploaded_by` |
| `doctor_reviews` | Radiologning yakuniy diagnozi + izohi | `image_id` (1:1), `doctor_id` |
| `ai_predictions` | AI taxmini, ishonch %, o'xshash holatlar, lesion bbox | `image_id` (1:1) |
| `logs` | Har bir muhim amal (upload, review, o'chirish) | `user_id` |

### AI qanday ishlaydi — batafsil

- **Klassifikator emas, KNN**: tizimda oldindan o'qitilgan yagona "model" yo'q — ResNet18 (ImageNet'da o'qitilgan) faqat rasmni 512 o'lchamli vektorga aylantirish (embedding) uchun ishlatiladi. Taxmin radiolog belgilagan eng yaqin rasmlar asosida chiqariladi. Shuning uchun har bir yangi diagnoz darhol "ta'sir qiladi" — qayta trening kerak emas.
- **PyTorch bo'lmasa**: `embeddings.py` avtomatik statistik fallback'ga o'tadi (histogram + percentile asosidagi qo'lda features), tizim baribir ishlayveradi, faqat aniqlik pastroq bo'ladi.
- **Lesion mintaqa — taxminiy, klinik segmentatsiya emas**: `lesion.py` klassik tasvirga ishlov berish (Gaussian blur → Otsu/percentile threshold → contour) orqali eng zich/yorug' blokni topadi. Bu o'qitilgan segmentatsiya modeli emas — faqat radiologni yo'naltiruvchi yordamchi vosita, yakuniy qaror doim shifokor tomonidan tasdiqlanadi.
- **`train.py`/`prepare_dataset.py`** — bular alohida, mustaqil skriptlar (CBIS-DDSM asosida haqiqiy CNN klassifikator o'qitish uchun). Hozirgi ishlab turgan ilova (`predictor.py`) ular bilan bog'liq emas — bu kelajakda "haqiqiy" modelga o'tish yo'li sifatida loyihada saqlangan.

### Xavfsizlik

- JWT (HS256, 8 soat amal qiladi), parollar bcrypt bilan hash qilinadi.
- Rol asosida ruxsat: faqat radiolog/admin diagnoz qo'ya oladi, faqat admin foydalanuvchi boshqaradi.
- `/api/img/{id}` va `/api/image-file/{id}` authsiz ochiq — chunki `<img>` tegi orqali to'g'ridan-to'g'ri yuklanadi (brauzer so'rovlarida Authorization header yubora olmaydi); ID orqali kirish demo/prototip darajasida yetarli deb hisoblangan.

---

## Ko'p so'raladigan texnik savollar (himoya uchun)

**Nega neyron tarmoq klassifikatori emas, KNN?**
Kam miqdordagi labellangan rasm bilan ham ishlay oladi va har bir yangi diagnoz darhol "o'rganishga" hissa qo'shadi — qayta trening/deploy kerak emas. Bu "self-learning" talabiga mos keladi.

**Lesion mintaqa AI tomonidan "segmentatsiya" qilinganmi?**
Yo'q — bu klassik tasvirga ishlov berish (kontrast/zichlik chegarasi) orqali topilgan taxminiy hudud, o'qitilgan segmentatsiya modeli emas. Radiolog uchun yo'naltiruvchi vosita, yakuniy chegarani shifokor tasdiqlaydi.

**Model qayerda saqlanadi, qanday "yangilanadi"?**
Alohida model fayli yo'q — har bir labellangan rasmning embeddingi `uploads/embeddings/*.npy` sifatida saqlanadi va DB'dagi labeliga bog'lanadi. Yangi taxmin shu saqlangan embeddinglar bilan solishtirish orqali chiqariladi.

**Nega SQLite, production uchun yetarlimi?**
Prototip/demo bosqichi uchun yetarli. `DATABASE_URL` environment variable orqali PostgreSQL/MySQL'ga almashtirish kod o'zgarishisiz mumkin (SQLAlchemy abstraktsiyasi tufayli).

**Frontend backend bilan qanday bog'lanadi?**
Vite dev server `/api` va `/uploads` so'rovlarini `localhost:8000`ga proxy qiladi (`vite.config.js`). Har bir so'rovga `axios.js` interceptor orqali JWT avtomatik qo'shiladi, 401 kelsa foydalanuvchi avtomatik logout qilinadi.

**DICOM formatini qo'llab-quvvatlaydimi?**
Yuklash darajasida `.dcm` kengaytmasi qabul qilinadi (`pydicom` `requirements-ai.txt`da bor), lekin joriy `validator.py` DICOM fayllarni chuqur tekshirmasdan to'g'ri deb qabul qiladi — asosiy pipeline (embedding, lesion) JPG/PNG kutadi.

**Nega ba'zi fayllar (`predict.py`, `heatmap.py`, `PredictionResult.jsx`) loyihada bor-u ishlatilmaydi?**
Ular loyihaning oldingi, CNN-asoslangan versiyasidan qolgan — `main.py`/`App.jsx`ga ulanmagan. Kelajakda haqiqiy klassifikatorga o'tilganda qayta ishlatilishi mumkin.

---

> **Eslatma:** Bu tizim shifokorga yordamchi vosita bo'lib, yakuniy qaror doim shifokor tomonidan qabul qilinadi.
