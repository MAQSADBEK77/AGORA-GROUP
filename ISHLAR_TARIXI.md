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

### 7.1. Butun papka yuklash + DICOM metama'lumotidan bemorni avtomatik aniqlash

- Foydalanuvchi aniqladi: u fayl emas, **butun papka** yuklaydi (masalan bitta bemorning R/L, CC/MLO — bir nechta `.dcm` fayli turli quyi-papkalarda). Har bir DICOM faylining ichida bemor F.I.Sh/tug'ilgan yil/PatientID tegi bor — shuni qo'lda kiritmasdan, dastur o'zi o'qib olishi kerak.
- `backend/app/models.py` — `Patient.dicom_patient_id` ustuni qo'shildi (DICOM PatientID tegi bo'yicha bir xil bemorni keyingi yuklashlarda tanib olish uchun). `migrate.py`ga ham qo'shildi.
- `backend/app/dicom_utils.py` — `extract_patient_info()`: PatientID, PatientName (DICOM "Family^Given^Middle" formatini oddiy matnga o'giradi), PatientBirthDate (yildan) o'qiydi.
- `backend/app/routers/upload.py` — yangi `POST /api/upload/dicom-folder` endpoint: bir nechta faylni qabul qiladi, har biri uchun PatientID bo'yicha mavjud bemorni topadi yoki yangisini yaratadi, keyin rasmni shu bemorga bog'laydi. Natijada har bir fayl uchun holat (ok/error) va umumiy statistika (nechta yangi bemor, nechta mos kelgan) qaytadi.
- Frontend (`Upload.jsx`) — ikkita rejim: **"DICOM papka (avtomatik)"** (yangi, standart) — brauzerning `webkitdirectory` xususiyati orqali butun papkani tanlaydi, ichidagi barcha `.dcm`larni bitta so'rovda yuboradi, bemorni qo'lda tanlash shart emas; **"Bitta rasm (qo'lda)"** — eski, bitta faylni tanlab-tanlab bemorga biriktiruvchi oqim, hali ham mavjud.
- Test: haqiqiy `dcm/` papkadagi 4 ta faylni (bittasi bemorning R/L tomonlari) yuborib ko'rdim — birinchi fayl yangi bemor yaratdi, qolgan 3 tasi xuddi shu bemorga (PatientID mos kelgani uchun) to'g'ri biriktirildi.
- **Muhim**: `dcm/` papkasidagi fayllarda **haqiqiy bemor ismi (masalan "XUSANOVA Z") va PatientID** bor edi — bu haqiqiy PHI, shuning uchun sinovdan keyin bazadan va disk fayllaridan darhol o'chirib tashlandi, hech qanday joyga (GitHub'ga ham) yuborilmadi.

## Ochiq/davom etayotgan ishlar (keyingi safar davom ettirish uchun)

1. Railway deploy'ni yakunlash (build command tuzatilgandan keyingi natijani tekshirish).
2. CBIS-DDSM'ni to'liq (yoki kattaroq namunada) bazaga import qilish + embedding hisoblash.
3. Foydalanuvchi so'ragan holatda — GitHub'dagi juda keng ruxsatli Personal Access Token'larni o'chirib, kamroq huquqli (faqat `repo`) tokenlar bilan almashtirish tavsiya etiladi.
4. AI tahlilni qayta yoqish — hozircha DICOM'dan kelgan PNG'lar ustida KNN/embedding pipeline sinovdan o'tkazilmagan (ehtimol ishlaydi, chunki oddiy grayscale PNG, lekin tasdiqlanmagan).

## 8. Bitta bemorning barcha rasmlari — bitta oynada grid ko'rinish

- Foydalanuvchi professional DICOM viewer (DMED) skrinshotini ko'rsatib, xuddi shunday — bitta bemorning 4 ta ko'rinishi (R/L, CC/MLO) ko'rib chiqish sahifasida BITTA oynada, yonma-yon ko'rinishini so'radi.
- `backend/app/models.py` — `MammographyImage`ga `laterality` (R/L) va `view_position` (CC/MLO) ustunlari qo'shildi; `migrate.py`ga ham qo'shildi.
- `backend/app/routers/upload.py` (`/api/upload/dicom-folder`) — endi har bir faylning laterality/view_position tegi ham DICOM'dan o'qib, shu rasmga saqlanadi.
- `frontend/src/pages/ReviewDetail.jsx` — qayta yozildi: endi rasmning `patient_id`si orqali `/api/patients/{id}/images` chaqirilib, bemorning BARCHA rasmlari olinadi, standart tartibda (R CC, L CC, R MLO, L MLO) saralanib, 2x2 grid'da ko'rsatiladi. Har bir panelda laterality/view yorlig'i bor, bosilganda o'sha rasm kattalashadi. Diagnoz formasi endi BITTA saqlashda guruhdagi barcha rasmlarga birgalikda yoziladi (har biriga alohida `/api/review/{id}` chaqiriladi).
- Test: haqiqiy `dcm/` papkadagi 4 faylni yuklab, natijani statik HTML orqali skrinshot qildim — natija foydalanuvchi ko'rsatgan referens ko'rinishga (2x2, R/L CC/MLO yorliqlari bilan) mos keldi.
- Eslatma: `ReviewQueue.jsx` (navbat ro'yxati) hali ham har bir rasmni alohida qator qilib ko'rsatadi (bitta bemorning 4 rasmi = 4 qator) — buni ham bemor bo'yicha guruhlashni so'rashsa, keyingi ish bo'ladi.

### 8.1. R/L rasmlar joylashuvi tuzatildi

- Haqiqiy foydalanishda `ViewPosition` (CC/MLO) DICOM tegi ko'pincha **bo'sh** kelib chiqdi (fayl eksport qiluvchi tizimga bog'liq) — shu sabab avvalgi saralash R,R,L,L bo'lib qolar edi (referens viewer'dagidek R,L yonma-yon emas).
- Yechim: endi asosiy tartib — R va L rasmlarni navbatma-navbat (R,L,R,L...) joylashtirish, CC/MLO tegi esa faqat R/L guruh ICHIDA (mavjud bo'lsa) ikkinchi darajali tartiblash uchun ishlatiladi. Shunday qilib har qatorda doim bitta R + bitta L bo'ladi (taqqoslash uchun qulay), tegi bo'sh bo'lsa ham.
- Haqiqiy bemor rasmlari (production bazadagi #13) bilan sinab, natija to'g'ri chiqishi tasdiqlandi.

### 8.2. AI/Diagnoz paneli — chapdan chiqadigan yashirin panel (vertikal monitor uchun)

- Foydalanuvchi: dastur **vertikal (portret) monitorda** ochiladi, shuning uchun eni cheklangan — radiolog uchun eng muhimi 4 ta rasmni iloji boricha kattaroq va qulay ko'rish. Doimiy o'ng panel (AI Tahlil + Doktor Xulosasi) bu uchun joy yeyar edi.
- Yechim: sahifa tuzilishi o'zgartirildi — rasmlar endi butun kenglikni egallaydi (o'ng ustun olib tashlandi). AI/Diagnoz paneli endi ekranning chap chetiga **fixed** qilib biriktirilgan, standart holatda faqat ingichka (30px) ko'k tasma ko'rinadi ("Diagnoz" yozuvi bilan). Sichqoncha o'sha tasma ustiga kelganda (`group-hover`), panel 0.3s animatsiya bilan to'liq (320px) chapdan chiqib, rasm ustiga overlay bo'lib yozadi.
- Amalga oshirish: ikkita `position:absolute` element (ingichka tasma + to'liq panel) umumiy `fixed` ota-konteyner ichida, panel `-translate-x-full` (butunlay yashirin) dan `group-hover:translate-x-0` ga o'tadi.
- Statik HTML orqali (asl loyihaning compiled Tailwind CSS fayli bilan) ikkala holatni — yopiq va hover qilingan — skrinshot qilib tekshirdim, ikkalasi ham to'g'ri ishladi.

### 8.2. Tuzatish: "chap panel" aslida ilova navigatsiyasi ekan

- Foydalanuvchi tushuntirdi: "chap tomondagi panel" deganda AI/Diagnoz emas, **ilovaning o'zi chap tomonidagi asosiy menyu** (Dashboard/Yuklash/Ko'rib chiqish/...) nazarda tutilgan edi. AI/Diagnoz paneli esa ASL o'ng joyida qolishi kerak edi — uni chapga ko'chirganim noqulay bo'lib chiqdi (ilova menyusi ustiga tushib qolgan).
- Tuzatildi: `ReviewDetail.jsx` — AI/Diagnoz paneli asl ikki ustunli joylashuvga (`grid-cols-[1.6fr_1fr]`, rasmlar chapda, panel statik holda o'ngda) qaytarildi.
- `Sidebar.jsx` — o'rniga ANA SHU asosiy navigatsiya menyu yig'iladigan qilindi: standart holatda ingichka (faqat ikonkalar, `w-16`), sichqoncha olib borilganda to'liq kengayadi (`w-64`, matnlar bilan), `fixed` + bo'sh joy egallovchi spacer div orqali asosiy kontent joylashuviga ta'sir qilmaydi.
- Shu bilan birga: rasmlar orasidagi ortiqcha qora bo'shliq ham tuzatildi — grid ustunlari endi `auto` (rasmning tabiiy o'lchamiga moslashadi), oldingi `w-full` majburiy cho'zish o'rniga.
- Test: haqiqiy DICOM rasmlar bilan statik mockup orqali qayta tekshirildi — natija to'g'ri (rasmlar tekis tegib turadi, qo'shimcha bo'shliq yo'q).

## 9. Kontrast/yorqinlik va invert asboblari (rasm kattalashtirish oynasida)

- Radiolog o'simta/shubhali to'qimani topishda foydalanishi uchun `ImageZoom.jsx`ga qo'shildi: kontrast slayderi (50-300%), yorqinlik slayderi (50-200%), ranglarni teskari qilish (invert) tugmasi — barchasi CSS `filter` orqali (`contrast()`, `brightness()`, `invert()`), qo'shimcha server so'rovi kerak emas.
- "Standart" tugmasi va umumiy "reset" (0 tugmasi/RotateCcw) ikkalasi ham kontrast/yorqinlik/invertni asl holatga qaytaradi.
- Test: haqiqiy mammografiya rasmida standart, yuqori kontrast va invert holatlarini solishtirib skrinshot qildim — to'qima chegaralari sezilarli aniqroq chiqishi tasdiqlandi.
