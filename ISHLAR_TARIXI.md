# MammoAI — Bajarilgan ishlar tarixi

Bu fayl loyiha ustida qilingan ishlarni eslab qolish uchun yuritiladi. Yangi ish qilinganda shu faylga qo'shib boriladi.

## 1. AI tahlilda lesion (shubhali mintaqa) vizualizatsiyasi

- `backend/app/ai/lesion.py` — tasvirga ishlov berish (OpenCV) orqali ko'krak to'qimasidagi eng zich/yorug' mintaqani aniqlaydi, normallashtirilgan (0..1) bbox qaytaradi. Bu haqiqiy segmentatsiya modeli emas — mavjud tizim KNN+embedding o'xshashligiga asoslangani uchun tanlangan taxminiy (heuristik) yechim.
- `backend/app/models.py` — `AIPrediction` jadvaliga `lesion_x/y/width/height` ustunlari qo'shildi.
- `backend/app/routers/review.py` — AI tahlil (`/api/ai-predict/{id}`) paytida, agar diagnoz "Normal" bo'lmasa, lesion mintaqa avtomatik hisoblanadi va saqlanadi.
- `frontend/src/components/LesionOverlay.jsx` — rasm ustiga (object-contain letterboxing hisobga olingan holda) rangli ramka chizadi.
- `frontend/src/pages/ReviewDetail.jsx` — "AI Tahlil" bo'limida shubhali mintaqa diagnoz darajasiga mos rangda ko'rsatiladi.
- Test: sun'iy mammogramma yaratib, backend orqali koordinatalar to'g'ri qaytishi va frontendda ramka to'g'ri joylashishi (skrinshot orqali) tasdiqlandi.

## 2. Tashxis hisoboti — PDF yuklab olish

- `backend/app/reports.py` — `reportlab` yordamida to'liq tashxis hisobotini PDF qilib yaratadi: bemor ma'lumotlari, mammografiya rasmi (lesion ramkasi chizilgan holda), AI tahlil natijasi, radiolog diagnozi va uning Izoh/Tavsif matni.
- `backend/app/routers/review.py` — `GET /api/report/{image_id}/pdf` endpoint qo'shildi.
- Frontend (`ReviewDetail.jsx`) — "Tashxis hisoboti (PDF)" tugmasi qo'shildi, bosilganda PDF fayl brauzerda avtomatik yuklab olinadi.
- `backend/requirements.txt` ga `reportlab` va `opencv-python-headless` qo'shildi (ikkalasi ham asosiy ishlash uchun zarur, faqat AI o'qitish uchun emas).

## 3. GitHub bilan ishlash

- Loyiha uchun GitHub repo (`https://github.com/MAQSADBEK77/AGORA-GROUP`) borligi aniqlandi — u avvaldan 24+ commit tarixiga ega edi, local papkada esa git tarixi umuman yo'q edi (faqat fayllar mavjud edi). Shu sabab avval `origin/main`ga moslashtirilib, keyin yangi ishlar ustiga qo'shildi (tarix yo'qolmadi).
- Push qilish uchun GitHub Personal Access Token (repo huquqi bilan) ishlatildi.
- **Muhim**: bu Mac'da git alohida joylashgan (`~/bin/git` — maxsus wrapper), `git-remote-https` topilishi uchun har safar terminalda quyidagini ishga tushirish kerak bo'lishi mumkin:
  ```
  export GIT_EXEC_PATH=/Users/maqsadbekusmonov/libexec/git-core
  ```

## 4. Render.com'ga deploy (ishlab turibdi)

- `render.yaml` orqali Blueprint sifatida deploy qilindi: `mammoai-backend` (Docker) + `mammoai-frontend` (static site).
- Uchragan muammolar va yechimlari:
  - Static site uchun `plan: free` maydoni xato berardi → olib tashlandi.
  - Backend URL kutilganidan farqli (`mammoai-backend-dk61.onrender.com`) chiqdi → `VITE_API_URL` shunga moslashtirildi.
  - Backend'da `ModuleNotFoundError: cv2` xatosi → `requirements.txt`ga `opencv-python-headless` qo'shildi.
- Natija: **https://mammoai-frontend.onrender.com** (backend: `mammoai-backend-dk61.onrender.com`) — ishlab turibdi.
- Cheklov: bepul tarif — backend ~15 daqiqa ishlatilmasa "uxlaydi", disk vaqtinchalik (qayta ishga tushganda baza/rasmlar tozalanadi).

## 5. Railway.com'ga deploy (jarayon davomida)

- Xuddi shu repo Railway'ga ham ulandi (ikkinchi, muqobil hosting sifatida — Railway'da haqiqiy persistent volume va "uxlamaydigan" xizmat imkoniyati bor, lekin bepul emas: ~$5 trial krediti, keyin oyiga to'lov kerak).
- Uchragan muammolar:
  - Root Directory noto'g'ri sozlangani uchun build xato berdi → Railway'ning o'zi tavsiya qilgan "Set root directory" (`frontend`) tugmasi bosildi.
  - Railway `frontend/Dockerfile`ni avtomatik topib, undan foydalanib yubordi (bu fayl `docker-compose` uchun mo'ljallangan, nginx orqali ichki "backend" hostiga proxy qiladi — Railway'da bunday host yo'q, deploy "crashed" bo'lardi). Yechim: fayl `frontend/Dockerfile.compose` deb qayta nomlandi, `docker-compose.yml` shunga moslashtirildi, Railway esa endi Nixpacks (Node) builder orqali qura oladi.
  - `frontend/package.json`ga `"start": "serve -s dist -l ${PORT:-3000}"` skripti va `serve` paketi qo'shildi — Railway'da static saytni serve qilish uchun (Render'dan farqli, Railway'da alohida "static site" turi yo'q, har doim ishlaydigan server kerak).
  - Custom Build Command'da ortiqcha `cd frontend &&` qismi xato berayotgan edi (Root Directory allaqachon `frontend` bo'lgani uchun) — bu qatorni `npm install && npm run build`ga soddalashtirish kerakligi aytildi.
- Holat: deploy jarayoni davom etmoqda, oxirgi xato tuzatilgach natija hali tasdiqlanmagan.

## 6. CBIS-DDSM dataset (AI o'qitish uchun ko'proq rasm)

- Maqsad: bazada kamida 4000-5000 mammografiya rasmi bo'lishi (hozir juda kam).
- Kaggle orqali (`kaggle.json` — loyihada mavjud, foydalanuvchining shaxsiy kaliti) CBIS-DDSM dataset (~5.3GB, ~10000+ rasm) yuklab olish boshlangan.
- Avval 500 talik namuna (`cbis_data/jpeg_sample`, `sample_500.json`) bilan sinov qilindi — tarmoq uzilishlari (SSL/connection reset) tez-tez uchradi, skript xato bo'lgan fayllarni qayta urinish bilan yozilgan.
- **Holat**: sinov namunasi deyarli tugagan (499/500), lekin bazaga TO'LIQ import va embedding hisoblash bosqichi hali boshlanmagan/yakunlanmagan. Bu — keyingi sessiyada davom ettiriladigan ish.
- Eslatma: embedding hisoblash (ResNet18 orqali) CPU'da minglab rasm uchun soatlab vaqt olishi mumkin (GPU yo'q).

## 7. DICOM (.dcm) formatga o'tish, AI vaqtincha o'chirildi

- Foydalanuvchi haqiqiy DICOM fayllar (`dcm/` papkasi, real mammografiya skanerlari, MONOCHROME1, 16-bit) bilan ishlashni so'radi — dastur endi **faqat .dcm** qabul qiladi, oddiy JPG/PNG yuklab bo'lmaydi.
- `backend/app/dicom_utils.py` (yangi) — `dicom_to_png()`: pydicom orqali DICOM pixel array o'qiladi, RescaleSlope/Intercept qo'llaniladi, MONOCHROME1 bo'lsa invert qilinadi, 0-255 ga normallashtirilib PNG saqlanadi (brauzerda ko'rsatish uchun).
- `backend/app/routers/upload.py` — `ALLOWED_EXTS = {".dcm"}`; yuklangan `.dcm` fayl diskka saqlanadi (asl holicha) va darhol PNG'ga aylantiriladi, `file_path` PNG'ga ishora qiladi (shu sababli lesion overlay, PDF hisobot, rasm serve qilish kabi qolgan hamma joy o'zgarishsiz ishlayveradi).
- `backend/app/routers/review.py` — `/api/ai-predict/{id}` boshida `raise HTTPException(503, ...)` qo'shildi — AI tahlil vaqtincha butunlay o'chirilgan (bir qatorni o'chirish bilan qayta yoqiladi).
- Frontend: `Upload.jsx` faqat `.dcm` qabul qiladi; `ReviewDetail.jsx`da "AI dan so'rang" tugmasi o'rniga "AI tahlil hozircha o'chirilgan" degan yozuv chiqadi.
- `requirements.txt`ga qo'shildi: `pydicom`, `pylibjpeg`, `pylibjpeg-libjpeg` (bu ikkinchisi CBIS-DDSM/haqiqiy mammogram DICOM'larda keng tarqalgan "JPEG Lossless" siqilgan piksel ma'lumotini ochish uchun shart — pydicom yolg'iz o'zi buni ocha olmaydi).
- Test: real DICOM fayl orqali to'liq oqim (upload → PNG konversiya → serve → AI 503 qaytarishi → oddiy PNG rad etilishi) tasdiqlandi.

## Ochiq/davom etayotgan ishlar (keyingi safar davom ettirish uchun)

1. Railway deploy'ni yakunlash (build command tuzatilgandan keyingi natijani tekshirish).
2. CBIS-DDSM'ni to'liq (yoki kattaroq namunada) bazaga import qilish + embedding hisoblash.
3. Foydalanuvchi so'ragan holatda — GitHub'dagi juda keng ruxsatli Personal Access Token'larni o'chirib, kamroq huquqli (faqat `repo`) tokenlar bilan almashtirish tavsiya etiladi.
4. AI tahlilni qayta yoqish — hozircha DICOM'dan kelgan PNG'lar ustida KNN/embedding pipeline sinovdan o'tkazilmagan (ehtimol ishlaydi, chunki oddiy grayscale PNG, lekin tasdiqlanmagan).
