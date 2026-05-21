# Mammografiya AI Tizimi

## Ko‘krak Saratonini Erta Aniqlash Loyihasi

---

# Loyiha haqida

MammoAI — bu mammografiya rasmlarini sun’iy intellekt yordamida analiz qilib, ko‘krak saratoni ehtimolini erta aniqlash uchun yaratilgan tibbiy AI tizim.

Tizim klinika va shifoxonalarda foydalanish uchun mo‘ljallangan bo‘lib, mammografiya rasmlari hamshira yoki shifokor tomonidan tizimga yuklanadi.

AI model:
- rasmni analiz qiladi
- saraton ehtimolini hisoblaydi
- suspicious hududlarni aniqlaydi
- natijani shifokorga chiqaradi

---

# Loyihaning maqsadi

- Ko‘krak saratonini erta aniqlash
- Diagnostika vaqtini kamaytirish
- Shifokorlarga yordam berish
- AI orqali analiz sifatini oshirish

---

# Tizim foydalanuvchilari

Tizimdan:
- Hamshira
- Radiolog
- Shifokor
- Administrator

foydalanadi.

Oddiy foydalanuvchilar tizimga kira olmaydi.

---

# Tizim ishlash jarayoni

```

Hamshira mammografiya rasmini yuklaydi
                ↓
Tizim rasmni preprocessing qiladi
                ↓
AI model analiz qiladi
                ↓
Prediction generatsiya qilinadi
                ↓
Heatmap hosil qilinadi
                ↓
Natija shifokorga ko‘rsatiladi

```

---

# Texnologiyalar

## Frontend
- React
- Tailwind CSS
- Axios

## Backend
- Python
- FastAPI

## AI
- PyTorch
- Torchvision

## Image Processing
- OpenCV
- NumPy
- PIL

## Database
- PostgreSQL

## Deployment
- Docker
- Nginx
- VPS / Cloud Server

---

# Tizim modullari

## 1. Authentication Moduli

Vazifasi:
- Login
- JWT Authentication
- Role management

Rollar:
- Admin
- Hamshira
- Radiolog

---

## 2. Mammografiya Upload Moduli

Vazifasi:
Hamshira mammografiya rasmini yuklaydi.

Qo‘llab-quvvatlanadigan formatlar:
- JPG
- PNG
- DICOM

---

## 3. AI Analiz Moduli

Jarayon:
1. Image preprocessing
2. AI prediction
3. Probability calculation
4. Heatmap generation

Natijalar:
- Normal
- Benign
- Malignant

---

## 4. Image Processing Moduli

Jarayonlar:
- Resize
- Grayscale conversion
- Noise reduction
- Normalization

---

## 5. Heatmap Visualization

Texnologiya:
- Grad-CAM

Imkoniyatlari:
- Qizil suspicious area
- Explainable AI

---

## 6. Database Moduli

Saqlanadigan ma’lumotlar:
- Bemor ma’lumotlari
- Mammografiya rasmlari
- Prediction natijalari
- Analiz tarixi

Jadvallar:
- users
- patients
- mammography_images
- predictions
- logs

---

## 7. Dashboard

Imkoniyatlari:
- Predictionlarni ko‘rish
- Heatmap ko‘rish
- Statistikalar
- Search va filter

---

# AI Model haqida

Model turi:
- CNN (Convolutional Neural Network)

Ishlatilishi mumkin bo‘lgan modellar:
- ResNet50
- EfficientNet
- DenseNet121

Datasetlar:
- CBIS-DDSM
- MIAS Dataset

---

# API Endpointlar

## Authentication

```bash
POST /api/auth/login
GET  /api/auth/me
```

## Upload

```bash
POST /api/upload
```

## Prediction

```bash
POST /api/predict
GET  /api/predictions/:id
```

---

# Frontend sahifalari

- Login
- Dashboard
- Upload Page
- Prediction Result
- Patient History
- Admin Panel

---

# Xavfsizlik

- JWT Authentication
- Protected API
- Password hashing
- File validation
- Rate limiting

---

# Kelajakdagi rivojlantirish

- BI-RADS classification
- Mobile App
- Hospital integration
- Cloud AI
- AI report generation

---

# Muhim eslatma

Ushbu tizim:
- AI yordamchi tizimi hisoblanadi
- Mustaqil diagnoz qo‘ymaydi
- Yakuniy qaror shifokor tomonidan qabul qilinadi

Tizim faqat diagnostikani qo‘llab-quvvatlash uchun ishlatiladi.
