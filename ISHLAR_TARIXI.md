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

## 10. Sidebar matn tuzatish + sudraladigan rasm/panel chegarasi

- Yig'ilgan (`w-16`) holatdagi asosiy navigatsiyada matnlar qisman ko'rinib (kesilib) xунук turgan edi — endi `opacity-0 group-hover:opacity-100` orqali to'liq yashiringan, faqat sichqoncha kelganda tekis chiqadi.
- `ReviewDetail.jsx`: rasm kartochkasi va AI/Doktor panel orasiga sudrab kattalashtirish/kichraytirish uchun chegara (divider) qo'shildi — foydalanuvchi xohlagancha rasm tomonini kengaytirib, panelni torайтиши (yoki aksincha) mumkin. Tanlangan nisbat `localStorage`da saqlanadi, keyingi safar ham eslab qoladi. Faqat katta ekranlarda (`lg:`) ishlaydi, mobil/tor ekranda ustma-ust (stacked) qolaveradi.

### 10.1. Qayta ko'rib chiqish: yon panel emas, pastki sticky footer

- Foydalanuvchi aniqlashtirdi: sudraladigan yon panel emas, balki AI Tahlil + Doktor Xulosasi **pastki "sticky footer"** kabi bo'lishi kerak edi.
- Yakuniy yechim: rasmlar to'liq kenglikda oddiy sahifa oqimida; AI Tahlil (qisqartirilgan — faqat label+ishonch) va Doktor Xulosasi (diagnoz tugmalari bir qatorda + izoh + tasdiqlash tugmasi bir qatorda) — barchasi `fixed bottom-0` panelga joylashtirildi, sahifa qancha scroll qilinmasin doim ko'rinib turadi. Eski sudraladigan-chegara va o'ng-tomon-sticky yondashuvlar olib tashlandi.
- Rasmlar kartasiga footer balandligiga mos pastki bo'shliq (`pb-64 lg:pb-56`) qo'shildi, shuning uchun footer rasm kontentini yashirmaydi.

## 11. Piksel ma'lumotisiz DICOM fayllar (SR hisobot) endi xato emas

- Foydalanuvchi `dcm/` papkani yangilagach, ichida bitta "begona" fayl "The dataset has no 'Pixel Data'... " xatosi bilan chiqdi. Tekshirilganda — bu **Mammography CAD SR (Structured Report)** ekan (FUJIFILM M-CAD algoritmi ishlab chiqargan matnli hisobot, Modality=SR), rasm emas — shuning uchun piksel ma'lumoti yo'q. Real DICOM eksportlarida bunday hisobot fayllar rasmlar bilan birga keladi.
- `backend/app/routers/upload.py` (`upload_dicom_folder`) — endi har bir faylda `"PixelData" not in ds` tekshiruvi qo'shildi: agar yo'q bo'lsa, xato emas, **"skipped"** holati bilan aniq izoh ("Rasm emas — hisobot/metama'lumot fayli") qaytariladi.
- Frontend (`Upload.jsx`) — natijalar ro'yxatida "skipped" holati endi qizil (xato) emas, kulrang rangda ko'rsatiladi.
- Test: haqiqiy 5 faylli papka (4 rasm + 1 SR hisobot) bilan sinaldi — 4 rasm to'g'ri bitta bemorga yuklandi, SR fayli chiroyli "o'tkazib yuborildi" deb belgilandi.

## 12. Apparatning ichki CAD hisobotini o'qish (Mammography SR)

- Foydalanuvchi so'radi: "skip qilingan" SR fayl aslida nima ekanini tahlil qilib, ichidagi natijalarni ham ko'rsatib berish.
- Tahlil natijasi: bu fayl — **FUJIFILM M-CAD** (apparatning o'z ichki AI'si) tomonidan yaratilgan **Mammography CAD SR** hisoboti, bizning tizimimizdan mustaqil. Ichida **kaltsifikatsiya to'plamlari (Calcification Cluster)** topilmalari bor — har birining aniq koordinatalari (markaz + kontur) va qaysi ko'krak tomoniga tegishli ekanligi DICOM SR daraxtidagi "by-reference" bog'lanishlar (`Referenced Content Item Identifier`) orqali aniqlanadi.
- **Muhim texnik nozik jihat**: SR hisobot ichida rasmlarga bog'lanish narsa **SOPInstanceUID** orqali bo'ladi, lekin real hayotda (bu namunada ham) SR "For Processing" versiyadagi rasmlarga ishora qiladi, arxivlangan fayllar esa boshqa UID'ga ega bo'lishi mumkin — shu sabab **aniq rasmga** emas, faqat **tomon (chap/o'ng)** darajasida moslashtirildi (buni SR o'zining IMAGE bo'limidagi laterality ma'lumoti orqali ishonchli hisoblab bo'ladi).
- `backend/app/dicom_utils.py`: `is_cad_sr()` (SOP Class UID `1.2.840.10008.5.1.4.1.1.88.50` orqali aniqlaydi) va `parse_cad_sr()` (SR daraxtini path-based indexlab, har bir "Calcification Cluster" topilmasini tegishli tomonga bog'laydi, tomon bo'yicha klaster/kaltsifikatsiya sonini yig'adi).
- `MammographyImage.cad_summary` (JSON, TEXT) — papka yuklanganda SR fayl topilsa, natija o'sha bemorning barcha rasmlariga yoziladi.
- `ReviewDetail.jsx` — footer'da yangi "Apparat CAD hisoboti" bo'limi: har tomon uchun topilma bor/yo'qligi va soni, "bizning AI'dan mustaqil" degan aniq izoh bilan.
- Test: haqiqiy SR fayl bilan sinaldi — natija to'g'ri chiqdi (chap: 5 klaster/12 kaltsifikatsiya, o'ng: topilma yo'q), keyin test ma'lumotlari tozalandi.

### 12.1. Topilmalarni rasm ustida belgilab ko'rsatish

- Foydalanuvchi: faqat son emas, aniq qayerda ekanini ham ko'rish kerak.
- `parse_cad_sr` endi har bir klasterning markaz koordinatasini (DICOM piksel birligida) ham qaytaradi.
- Yangi `CadMarkers.jsx` — bu koordinatalarni rasmning haqiqiy `naturalWidth/Height`iga nisbatan hisoblab, to'q sariq halqa bilan belgilaydi (LesionOverlay bilan bir xil object-contain letterboxing mantig'i).
- **Cheklov**: SR hisobot rasmlarga **SOPInstanceUID** orqali bog'langan, lekin bu real namunada SR "For Processing" versiyaga ishora qiladi — bizda saqlangan fayllar boshqa UID'ga ega. Shuningdek, bizning fayllarda `ViewPosition` (CC/MLO) ham bo'sh, shu sabab ANIQ qaysi rasm (MLO yoki CC) ekanini ajratib bo'lmaydi. Shuning uchun belgilar **shu tomonning barcha rasmlarida** ko'rsatiladi (aniq bitta rasmda emas) — bu haqda footer'da ochiq izoh bor.
- Test: haqiqiy rasmlar bilan skrinshot orqali tekshirildi — belgilar ikkala L-ko'rinishda ham to'qima ustida, bir xil mantiqiy hududda chiqdi.

### 12.2. To'liq chuqurlik: har kaltsifikatsiyaning aniq konturi + qo'shimcha metama'lumot

- Foydalanuvchi: "yana qanday data bor" so'rovi asosida SR ichida yana quyidagilar topildi: har klasterdagi HAR BIR alohida kaltsifikatsiyaning o'z markazi+konturi (shakli), algoritm versiyasi, qaysi tekshiruvlar o'tkazilgani ("Mammography breast density", "Calcification Cluster"), va muhimi — **"Summary of Analyses: Not Attempted"** (xavflilik/BI-RADS baholash o'tkazilmagan, faqat joy aniqlangan).
- Foydalanuvchi: "hammasi to'liq, konturigacha, yuqori aniqlikda chiqsin" deb so'radi.
- `parse_cad_sr` butunlay qayta yozildi — endi to'liq ierarxik struktura qaytaradi: `by_side.{L,R}.clusters[].calcifications[].{center,outline}`, plus `algorithm_version`, `detections_performed`, `analyses_attempted`.
- `CadMarkers.jsx` — oldingi taxminiy doiralar o'rniga, endi SVG + `viewBox` orqali DICOM piksel koordinatalarini TO'G'RIDAN-TO'G'RI (hech qanday JS hisob-kitobsiz) chizadi — har bir kaltsifikatsiyaning haqiqiy mikro-shakli (ko'pburchak konturi) piksel-aniqlikda ko'rinadi.
- Footer'da qo'shildi: algoritm versiyasi, o'tkazilgan tekshiruvlar ro'yxati, va agar `analyses_attempted=false` bo'lsa — qizil ogohlantirish ("apparat faqat joyni aniqladi, xavfni baholamadi").
- Test: skrinshot + yaqinlashtirib (crop) tekshirdim — har bir mikroskopik kaltsifikatsiyaning konturi to'qima ustida to'g'ri joyda chiqdi.

### 12.3. Muhim tuzatish: MLO/CC orasida aralashib ketgan topilmalar

- Foydalanuvchi: "boshqa joylarni belgilaganga o'xshayapti" — tekshirilganda, L (yoki R) tomonning HAMMA topilmalari ikkala ko'rinishga (CC ham, MLO ham) baravar chizilayotgani aniqlandi, garchi har bir topilma aslida FAQAT bitta ko'rinishga tegishli bo'lsa-da.
- Yechim topildi: `ViewPosition` bo'sh bo'lsa-da, **`PatientOrientation`** (masalan "A\R" — CC, "A\FR" — MLO) deyarli har doim mavjud va CC/MLO'ni ishonchli ajratadi.
- `MammographyImage.patient_orientation` ustuni qo'shildi (yuklashda saqlanadi). `parse_cad_sr` endi laterality+orientation kombinatsiyasi bo'yicha **`by_view`** xaritasini ham qaytaradi (masalan `"L|A\R"` va `"L|A\FR"` alohida-alohida).
- Frontend endi har rasmning aynan o'z ko'rinishiga mos topilmalarni tanlab ko'rsatadi (`by_side` faqat orientatsiya yo'q eski yozuvlar uchun zaxira sifatida qoladi).
- Test: L-CC va L-MLO rasmlari alohida-alohida tekshirildi — endi har biri FAQAT o'ziga tegishli klasterlarni (mos ravishda 2 va 3 ta) ko'rsatadi, ular endi bir-biridan farqli va to'g'ri joyda.

### 10.2. Sticky footer'ni sudrab kattalashtirish/kichraytirish + rasmlarni maksimal kattalashtirish

- Foydalanuvchi so'radi: pastki sticky footer'ning tepa chegarasida sudrab (tepaga/pastga) kichraytirib-kattalashtirish mumkin bo'lsin, va 4 ta rasm ham maksimal katta ko'rinsin.
- `ReviewDetail.jsx` — footer balandligi endi `footerHeight` state'da saqlanadi (boshlang'ich 320px, `localStorage` kaliti `reviewFooterHeight` orqali eslab qolinadi). Footer'ning tepasida `GripHorizontal` ikonkali tutqich qo'shildi — sichqoncha/barmoq bilan bosib tepaga-pastga sudralganda `mousemove`/`touchmove` orqali balandlik real vaqtda o'zgaradi (min 110px, maks ekran balandligining 85%).
- Statik `pb-64 lg:pb-56` va `max-h-[45vh]` klasslari olib tashlanib, o'rniga `footerHeight`ga bog'liq inline `style` qo'yildi — shuning uchun rasm kartochkasining pastki bo'shlig'i va footer balandligi doim bir-biriga mos keladi.
- Rasm elementlarining qattiq `max-h-[520px]` chegarasi olib tashlanib, `maxHeight: max(320px, calc(100vh - footerHeight - 200px))` bilan almashtirildi — footer kichraytirilganda rasmlar ekranning qolgan bo'sh joyini avtomatik to'ldirib, maksimal katta bo'lib ko'rinadi.
- Test: `npx vite build` orqali kompilyatsiya xatosiz o'tishi tekshirildi. Brauzerda haqiqiy sichqoncha bilan sudrash vizual tasdiqlanmadi — muhitda headless brauzer vositasi (`chromium-cli`/Playwright) mavjud emas edi.

### 10.3. Rasmlar hali ham kichkina va o'rtada qolib ketayotgan edi — to'liq kenglikka yoyildi

- Foydalanuvchi: 4 ta rasm hamon kichkina, `max-w-7xl` markazlashtirilgan sahifa tufayli o'rtada siqilib qolgan edi; chap navbar va o'ng ekran chetidan atigi ~10px oraliq qolib, qolgan hammasi rasmlarga tegishli bo'lishi kerak edi.
- Sabab: rasm grid konteyneri `w-fit` (kontentga moslashuvchi, cho'zilmaydigan) edi va sahifaning o'zi `max-w-7xl mx-auto` bilan 1280px'ga cheklangan, kattaroq monitorlarda ikkala tomonda katta bo'sh joy qolardi. Rasmlar balandlik bo'yicha cheklangani (`maxHeight`) uchun eni ham tabiiy nisbatga ko'ra kichik chiqardi.
- Yechim: `ReviewDetail.jsx` — sahifaning tashqi `max-w-7xl` cheklovi rasm bo'limidan olib tashlandi (orqaga qaytish tugmasi va pastki panel ichki kontenti hali ham o'zining `max-w-7xl`sida qoladi). Rasm kartochkasiga `-mx-6 px-[10px]` qo'yildi — bu asosiy `<main>`ning `p-6` to'ldirishini bekor qilib, o'rniga atigi 10px chekka oraliq qoldiradi. Grid endi `w-full` (cho'zilib to'liq kenglikni egallaydi), rasmlar esa `w-full h-auto object-contain` bilan — balandlik emas, ENI ustuvor hisoblanadi, shuning uchun rasm ustunning butun kengligini to'ldiradi (balandlik tabiiy nisbatga ko'ra o'sadi, sahifa kerak bo'lsa pastga scroll qiladi).
- Test: `npx vite build` xatosiz o'tdi. Vizual (brauzer) tasdiqlash muhitda headless brauzer vositasi yo'qligi sababli amalga oshirilmadi.

## 13. Backlog / Roadmap — foydalanuvchi taklif qilgan keyingi ishlar (2026-07-28, hali BOSHLANMAGAN)

Foydalanuvchi 30+ ta funksiya taklif qildi. Ko'lami juda katta (ba'zilari soatlab, ba'zilari
(Postgres o'tish, ikkinchi radiolog tasdig'i kabi) kunlab/arxitektura darajasidagi ish talab
qiladi), shuning uchun hammasini bittada tekshirmasdan qilish o'rniga — ro'yxat shu yerda
saqlanadi, ustuvorlik foydalanuvchi bilan kelishilgach navbat bilan bajariladi.

**Klinik ish jarayoni**
1. BI-RADS standart tasnifi (0-6) — hozirgi Normal/Benign/Malignant o'rniga.
2. Oldingi tekshiruv bilan taqqoslash (prior study comparison).
3. Navbatni bemor bo'yicha guruhlash (ReviewQueue.jsx) — 4 rasm 4 qator emas, 1 karta.
4. Ikkinchi radiolog tasdig'i (double-reading + arbitration).
5. Ishlarni radiologlarga biriktirish (case assignment/worklist).

**Rasm bilan ishlash asboblari**
6. O'lchov (ruler) asbobi.
7. Erkin chizish/annotatsiya (freehand).
8. Rasm sifatini avtomatik tekshirish (kesilgan/xira/noto'g'ri pozitsiya ogohlantirishi).

**Tezlik va qulaylik**
9. Klaviatura tezkor tugmalari (navbat, diagnoz belgilash).
10. Tezkor shablon iboralar (quick-phrase) — tavsif maydoni uchun.
11. Qidiruv va filtr (ism/PatientID/sana/diagnoz) — navbatda.
12. Ko'p tillilik (i18n) infratuzilmasi (hozir qattiq o'zbekcha).

**Hisobot va analitika**
13. Admin panelda audit-log ko'rish oynasi (Log jadvali yozilyapti, UI yo'q).
14. Statistik/QA dashboard (recall rate, radiolog vaqti, oylik trend).
15. Bildirishnoma tizimi (yangi/shoshilinch holat).
16. CSV/Excel eksport.

**Xavfsizlik va infratuzilma**
17. Login urinishlarini cheklash (rate-limiting).
18. PostgreSQL'ga o'tish + avtomatik zaxira — SQLite ko'p foydalanuvchida parallel yozishda
    muammoli, Render/Railway diskining vaqtinchaligi allaqachon muammo bo'lgan (4-bo'lim).
19. Sessiya vaqti tugashi (auto-logout).

**Solishtirish va diagnoz oqimi**
20. Rasmlarni solishtirish uchun sinxron zoom/pan (masalan oldingi/yangi tekshiruv).
21. "Flicker" rejim — ikki rasmni tez almashtirib ko'rish.
22. Draft → Final ikki bosqichli diagnoz (hozir bitta "tasdiqlash").
23. Shaxsiy statistika paneli (radiolog o'zi uchun).
24. Tezkor filtr-tablar ("Bugungi", "Mening holatlarim", "Kutilayotgan").

**Admin/amaliy**
25. Ko'p rasmni birvarakayiga tanlab amal qilish (bulk select).

**Hisobot/chop etish**
26. PDF hisobotga klinika logotipi + raqamli imzo (F.I.Sh + sana shtamp).
27. Brauzerdan to'g'ridan-to'g'ri chop etish tugmasi.

**Klinik integratsiya**
28. Natijani DICOM SR formatida eksport (boshqa PACS tizimiga yuborish uchun).
29. Ovozli diktovka (speech-to-text) — tavsif maydoni uchun.

Keyingi safar: foydalanuvchi bilan ustuvorlikni kelishib, shu ro'yxatdan tanlab bajarish kerak.

## 14. Foydalanuvchi backlog'idan birinchi 10 band bajarildi (2026-07-29, avtonom rejimda)

Foydalanuvchi uxlab, "eng yaxshi tartibni o'zing tanla, to'xtama, savol berma" dedi.
Ustuvorlik: xavfsiz, kam xatarli, tez natija beradigan ishlardan boshlandi.

1. **Navbatni bemor bo'yicha guruhlash** — `/pending`, `/reviewed` endpointlari `patient_name`
   qaytaradi; `ReviewQueue.jsx` endi bitta bemorning barcha rasmlarini BITTA kartaga
   birlashtiradi (rasm soni belgisi bilan), eng "og'ir" diagnozni ko'rsatadi.
2. **Qidiruv + tezkor sana filtri** — bemor ismi bo'yicha qidiruv, "Hammasi/Bugungi/Shu hafta" tablar.
3. **Klaviatura tezkor tugmalari** (`ReviewDetail.jsx`) — 1-4 diagnoz, Ctrl/Cmd+Enter saqlash,
   ←/→ yoki [/] navbatda oldingi/keyingi bemor, Esc — navbatga qaytish (matn maydonlarida ishlamaydi).
4. **Tezkor shablon iboralar** — Izoh maydoni ostida `<select>`, tanlansa matnga qo'shiladi.
5. **BI-RADS (0-6)** — `DoctorReview.birads` ustuni, mavjud Normal/Benign/Malignant/Very Malignant
   tizimiga QO'SHIMCHA (uni almashtirmadi — xavfsizlik uchun), forma/o'qish/PDF'da ko'rinadi.
6. **Admin audit-log UI** — `GET /api/admin/logs`, AdminPanel'da yig'iladigan jadval.
7. **CSV eksport** — `GET /api/export/reviews.csv` (admin/radiolog), AdminPanel'da yuklab olish tugmasi.
8. **Login rate-limiting** — bir email uchun 15 daqiqada 5 martadan ortiq xato parol → 429,
   xotirada saqlanadi (Redis kerak emas, bitta jarayonli joylashtirish uchun yetarli).
9. **Sessiya auto-logout** — 20 daqiqa harakatsizlikdan keyin avtomatik chiqish (`ProtectedRoute.jsx`).
10. **Brauzer print tugmasi** — "Chop etish" (PDF yuklab olishdan tashqari), `@media print` orqali
    faqat rasm+yakuniy xulosa ko'rinadi, menyu/forma yashiriladi.

**Muhim eslatma (ehtiyot bo'lish uchun)**: shu ishlar davomida test paytida BITTA marta haqiqiy
mavjud rasm (image_id=1, patient 25 — foydalanuvchining o'z DICOM testidan qolgan) ustida
`/api/review/1` chaqirilib, tasodifan "reviewed" holatiga o'tkazib qo'yilgan edi. Darhol
sezilib, review yozuvi o'chirildi, status "pending"ga qaytarildi, embedding fayli tozalandi.
**Xulosa**: keyingi safar yozuvchi (POST/PUT/DELETE) testlar uchun HAR DOIM yangi, alohida
test-bemor yaratish kerak (upload orqali) — mavjud ID'lardan HECH QACHON foydalanmaslik kerak.

Davom etayotgan ishlar: ruler asbobi, rasm sifat tekshiruvi, Draft/Final oqimi, shaxsiy
statistika, bulk select, bildirishnoma, QA dashboard, sinxron zoom/pan+flicker, PDF logotip —
navbatda, autonom davom etilmoqda.

## 15. Ruler, sifat tekshiruvi va Draft/Final oqimi (2026-07-29, avtonom rejimda)

1. **O'lchov (ruler) asbobi** — `ImageZoom.jsx`ga qo'shildi: ikki nuqta bosilsa, orasidagi
   masofa DICOM `PixelSpacing` (mm/piksel) mavjud bo'lsa millimetrda, aks holda pikselda
   ko'rsatiladi. `getBoundingClientRect()`ga asoslangan koordinata xaritalash CSS
   scale/translate transformlarni hisobga oladi (mavjud `LesionOverlay` andozasidan foydalanildi).
   Backend: `extract_patient_info()` `PixelSpacing`ni o'qiydi,
   `mammography_images.pixel_spacing` ustunida saqlanadi.
2. **Rasm sifatini avtomatik tekshirish** — `dicom_utils.check_image_quality()`: juda kichik
   o'lcham (<500px), juda qorong'i (qora piksel nisbati >0.97), past kontrast (std<8) va
   xiralik (Laplacian variance<15, OpenCV orqali) — hammasi ogohlantirish sifatida
   (`quality_warnings`), yuklashni TO'XTATMAYDI, faqat radiologga ko'rsatiladi.
3. **Draft → Final ikki bosqichli diagnoz** — `DoctorReview.is_draft` (default `False`).
   - Qoralama saqlanganda: `image.status` "pending"da qoladi, eski AI bashorati o'chirilmaydi,
     `index_labeled_image()` (AI o'z-o'zini o'qitish) ISHGA TUSHMAYDI — chunki qoralama hali
     yakuniy tashxis emas, uni AI trening ma'lumoti sifatida ishlatish noto'g'ri bo'lardi.
   - Yakunlanganda (`is_draft=False`): status "reviewed"ga o'tadi, AI qayta o'qitiladi — avvalgi
     bitta bosqichli xulq bilan bir xil.
   - PDF hisobot (`GET /api/report/{id}/pdf`) va CSV eksport (`/api/export/reviews.csv`)
     qoralamalarni RAD ETADI (400 xato / qatordan chiqarib tashlaydi) — chunki "Yakuniy diagnoz"
     deb chop etilgan hujjat hali tasdiqlanmagan xulosani ko'rsatib yubormasligi kerak.
   - Dashboard statistika (`/api/dashboard/stats`) diagnoz-soni hisobida qoralamalarni
     hisobga OLMAYDI (faqat yakunlangan tashxislar sanaladi).
   - Frontend: `ReviewDetail.jsx`da "Qoralama saqlash" (ikkinchi, kulrang tugma) va
     "Tasdiqlash (yakunlash)" tugmalari alohida; qoralama holatida "Qoralama" belgisi (amber
     badge) ko'rsatiladi (o'qish rejimida va print bo'limida). `ReviewQueue.jsx`da guruh
     ichidagi eng og'ir diagnoz hisoblanganda qoralamalar HISOBGA OLINMAYDI (aks holda hali
     tasdiqlanmagan tashxis "Kutmoqda" o'rniga xato ravishda yakuniy diagnoz kabi ko'rinar edi);
     guruhda faqat qoralama bo'lsa, "Kutmoqda" o'rniga "Qoralama" belgisi ko'rsatiladi.
   - `backend/migrate.py`dagi eski "predictions" jadvali (hozirgi sxemada mavjud emas,
     `ai_predictions` bilan almashtirilgan) haqidagi o'lik migratsiya qatorlari endi
     jadval mavjudligini oldindan tekshiradi va yo'q bo'lsa xatosiz o'tkazib yuboradi
     (avval har safar `sqlite3.OperationalError` bilan yiqilar edi).
   - Test: `FastAPI TestClient` + `get_current_user` override orqali (parolni bilmasdan)
     alohida test-bemor (`upload/dicom-folder` orqali yaratilgan, sun'iy DICOM) ustida
     qoralama→yakunlash oqimi to'liq tekshirildi (status, embedding fayli, PDF 400/200,
     CSV filtri) — keyin barcha test yozuvlar va fayllar to'liq tozalandi.

## 16. Shaxsiy statistika paneli (har bir radiolog uchun) (2026-07-29, avtonom rejimda)

- `GET /api/stats/personal` (`backend/app/routers/review.py`) — faqat radiolog/admin, faqat
  `current_user.id`ga tegishli va `is_draft=False` (yakunlangan) tashxislarni hisoblaydi:
  jami son, bugun/shu hafta/shu oy soni, kunlik o'rtacha (birinchi tashxisdan buyon o'tgan
  kunlarga bo'lib), diagnoz-turlari bo'yicha taqsimot, BI-RADS taqsimoti, va so'nggi 14 kunlik
  kunlik son qatori (bo'sh kunlar ham 0 bilan — grafikda uzilib qolmasligi uchun).
- Yangi schema: `schemas.PersonalStatsOut`.
- Yangi sahifa `frontend/src/pages/PersonalStats.jsx` ("Statistikam", `/stats` yo'li,
  faqat radiolog/admin sidebar'da ko'radi) — mavjud Dashboard'dagi StatCard/recharts
  andozasidan foydalanilgan: 4 ta statistik karta, 14 kunlik ustunli diagramma, diagnoz
  taqsimoti pie-chart, BI-RADS soni bo'yicha kichik badge'lar qatori.
- **Muhim dizayn qarori**: qoralamalar (`is_draft=True`) statistikaga UMUMAN kirmaydi — aks
  holda hali yakunlanmagan, o'zgarishi mumkin bo'lgan tashxis radiologning "ishlab chiqarish"
  ko'rsatkichiga soxta ta'sir qilgan bo'lardi.
- Test: ikkita alohida test-bemor (`upload/dicom-folder`) yaratilib, ularga turli diagnoz/BI-RADS
  bilan yakuniy review yozildi, `/api/stats/personal` javobi (son, taqsimot, kunlik qator) qo'lda
  tekshirilgan qiymatlar bilan solishtirilib tasdiqlandi — so'ng barcha test yozuv/fayllar o'chirildi.

## 17. Admin panelda ko'p bemorni birdaniga tanlab o'chirish (bulk select) (2026-07-29, avtonom rejimda)

- `DELETE /api/admin/patients/bulk` (`backend/app/routers/review.py`) — faqat admin, so'rov
  tanasida `patient_ids: [...]` qabul qiladi. `admin/uploads/clear`dagi bilan bir xil xavfsizlik
  qoidasi: faqat yuklangan (`uploads/`) rasmlar o'chiriladi, MIAS dataset rasmlari (`mdb*`)
  HECH QACHON o'chirilmaydi. Har bir tanlangan bemorning fayllari (rasm + AI embedding) diskdan
  o'chiriladi, `ai_predictions`/`doctor_reviews`/`mammography_images` qatorlari tozalanadi;
  agar bemorda (dataset rasmisiz) boshqa rasm qolmasa, `patients` yozuvi ham o'chiriladi.
  Har bir amal audit-logga (`bulk_delete_patients`) yoziladi.
- Yangi schema: `schemas.BulkDeleteRequest`.
- Frontend: `frontend/src/pages/PatientHistory.jsx`ga faqat ADMIN uchun "Ko'p tanlash" tugmasi
  qo'shildi — yoqilganda har bir bemor qatorida checkbox chiqadi, pastda "N ta bemor tanlandi"
  paneli va "Tanlanganlarni o'chirish" tugmasi ko'rinadi, bosilganda tasdiqlash oynasi
  (mavjud AdminPanel'dagi "Tozalash" modal andozasi asosida) chiqadi.
- Test: ikkita alohida test-bemor yaratilib, `DELETE /api/admin/patients/bulk` orqali
  birgalikda o'chirildi — fayllar diskdan o'chgani, DB qatorlari tozalangani va bemor
  yozuvlari o'chgani tasdiqlandi; alohida, admin bo'lmagan foydalanuvchi (hamshira) bilan
  chaqirilganda 403 qaytishi ham tekshirildi.

## 18. Bildirishnoma tizimi (yangi/shoshilinch holatlar) (2026-07-29, avtonom rejimda)

- Avval mavjud bo'lgan bell-belgisi faqat umumiy son (badge) ko'rsatib, bosilganda to'g'ridan-to'g'ri
  `/review`ga o'tkazardi — endi haqiqiy bildirishnoma ro'yxati bilan pastga tushadigan panel bo'ldi.
- `mammography_images.quality_warnings` ustuni qo'shildi — avval sifat ogohlantirishlari faqat
  yuklash javobida (ephemeral) qaytardi, endi rasmga biriktirilib DOIMIY saqlanadi
  (`backend/app/routers/upload.py`, JSON qatorlar ro'yxati sifatida).
- `GET /api/notifications` (`backend/app/routers/review.py`) — radiolog/admin uchun so'nggi
  kutayotgan rasmlar ro'yxati (standart 20 ta), har biri "shoshilinch" deb belgilanadi agar:
  (a) sifat ogohlantirishi mavjud bo'lsa, YOKI (b) 24 soatdan ko'proq javobsiz kutgan bo'lsa.
  Shoshilinch bo'lganlar ro'yxat boshida ko'rsatiladi.
- `frontend/src/components/Navbar.jsx` — qo'ng'iroq belgisi bosilganda dropdown panel ochiladi:
  har bir bildirishnoma bemor ismi, sabab (shoshilinch bo'lsa qizil, oddiy bo'lsa ko'k) va
  "necha vaqt oldin" bilan ko'rsatiladi; bosilsa to'g'ridan-to'g'ri o'sha rasmning
  ko'rib chiqish sahifasiga o'tadi. Panel tashqarisiga bosilganda avtomatik yopiladi.
  Mavjud 20 soniyalik polling va "yangi rasm yuklandi" toast xabari saqlanib qoldi.
- Test: sun'iy kichik (64x64) DICOM yuklanganda `quality_warnings` ustunga saqlanishi va
  `/api/notifications` javobida `urgent: true, reason: "Sifat ogohlantirishi"` sifatida
  to'g'ri qaytishi tasdiqlandi — keyin test yozuv/fayllar o'chirildi.

## 19. QA / statistik dashboard — barcha radiologlar bo'yicha (2026-07-29, avtonom rejimda)

- `GET /api/stats/qa?months=N` (`backend/app/routers/review.py`) — FAQAT ADMIN (15-bo'limdagi
  shaxsiy statistikadan farqi: bu yerda BARCHA radiologlar bo'yicha yig'ma ko'rsatkich).
  Qaytaradi: jami yakunlangan tashxis soni, umumiy "recall rate" (Normal bo'lmagan tashxislar
  foizi — skrining sifatini kuzatishning standart ko'rsatkichi), diagnoz taqsimoti, har bir
  radiolog bo'yicha jadval (jami soni, o'ziga xos recall rate, kunlik o'rtacha), va so'nggi N
  oylik trend (bo'sh oylar ham 0 bilan — standart 6 oy).
- Yangi schemalar: `schemas.DoctorStatsOut`, `schemas.QAStatsOut`.
- Yangi sahifa `frontend/src/pages/QADashboard.jsx` — faqat admin sidebar'da ko'radi (`/qa`):
  3 ta statistik karta (jami, recall rate, faol radiologlar soni), radiologlar bo'yicha
  ustunli diagramma, oylik trend chiziqli grafigi, va batafsil jadval.
  Bu 15-bo'limdagi "Statistikam" (shaxsiy, har bir radiolog o'zinikini ko'radi) bilan
  BIRGA ishlaydi, bir-birini almashtirmaydi — ikkalasi ham zarur, turli auditoriya uchun.
- Test: uchta alohida test-bemor yaratilib, ikkita radiolog (radiolog + admin) har xil
  diagnoz bilan tekshirdi (Normal, Malignant, Benign) — javobdagi umumiy recall rate (66.7%),
  har bir radiologning o'ziga xos recall rate'i (50%, 100%) va oylik trend qo'lda hisoblangan
  qiymatlar bilan mos kelishi tasdiqlandi; admin bo'lmagan foydalanuvchida 403 tekshirildi;
  so'ng barcha test yozuv/fayllar o'chirildi.

## 20. Rasmlarni sinxron zoom/pan bilan solishtirish + Flicker rejimi (2026-07-29, avtonom rejimda)

- Yangi komponent `frontend/src/components/CompareModal.jsx` — ikkita rasmni (masalan L va R,
  yoki bir bemorning eski/yangi tekshiruvi — chunki bitta bemorga qayta yuklangan barcha
  rasmlar `ReviewDetail.jsx`da allaqachon bitta oynada yig'ilib turadi) sinxron zoom/pan bilan
  ko'rsatadi. Bitta umumiy scale/pos state ikkala rasmga BIRGA qo'llanadi — birini kattalashtirish
  yoki surish ikkalasini ham birga harakatlantiradi (professional PACS "linked cine" kabi).
  Ikki rejim: **Yonma-yon** (side-by-side) va **Flicker** (bitta joyga ustma-ust qo'yilib,
  ~650ms oralig'ida avtomatik almashtiriladi — klassik radiologik "flicker" texnikasi, farqni
  ko'rish uchun; Bo'shliq/Space bilan qo'lda ham almashtirish mumkin, Play/Pause bilan
  avtomatik almashtirishni to'xtatish mumkin).
- `frontend/src/pages/ReviewDetail.jsx` — "Taqqoslash" tugmasi (kamida 2 ta rasm bo'lsa
  ko'rinadi) rejimni yoqadi; yoqilganda har bir rasm ustida checkbox chiqadi, aniq 2 tasi
  tanlanganda "Solishtirish" tugmasi faollashadi va `CompareModal`ni ochadi.
- Test: headless Chrome + Chrome DevTools Protocol (websockets) orqali sun'iy 2 ta rasmli
  test-bemor bilan to'liq oqim tekshirildi (skrinshotlar orqali) — taqqoslash rejimi yoqilishi,
  2 ta rasm tanlanishi, modal ochilishi (yonma-yon holatda ikkalasi to'g'ri ko'rinishi) va
  Flicker rejimiga o'tish (bitta rasm, label almashinishi) barchasi to'g'ri ishlashi
  tasdiqlandi; keyin test yozuv/fayllar o'chirildi.

## 21. PDF hisobotga klinika logotipi va shifokor imzo muhri (2026-07-29, avtonom rejimda)

Foydalanuvchi backlog'idagi so'nggi (20-) band — shu bilan asl 29 bandlik ro'yxatning
xavfsiz/tezkor qismi (1-20) to'liq yakunlandi.

- **Klinika logotipi**: `users.signature_path` kabi alohida jadval kerak emas — logotip
  bitta umumiy fayl (`uploads/clinic_logo.png`) sifatida saqlanadi. `POST/GET/DELETE
  /api/admin/clinic-logo` (faqat admin yozadi/o'chiradi, o'qish ochiq — `<img>` tegi uchun).
  Yuklanganda PIL orqali PNG'ga aylantiriladi (kirish formatidan qat'iy nazar bitta format).
  `AdminPanel.jsx`da "Klinika logotipi" kartasi (boshqa admin kartalar bilan bir xil uslubda).
- **Shifokor imzosi**: `User.signature_path` ustuni qo'shildi (faqat radiolog/admin
  yuklashi mumkin — `POST/DELETE /api/auth/me/signature`, ko'rish uchun ochiq
  `GET /api/auth/signature/{user_id}`). `ProfileModal.jsx`da imzo yuklash/o'chirish
  bo'limi (faqat radiolog/admin rolida ko'rinadi).
- `backend/app/reports.py` — PDF sarlavhasida logotip (bo'lsa) sarlavha yonida chiqadi;
  "Radiolog xulosasi" bo'limi oxirida ko'k ramkali tasdiq muhri: agar shifokor imzo rasmi
  yuklagan bo'lsa o'sha rasm, aks holda matnli "TASDIQLANDI" muhri — ikkalasida ham
  shifokor ismi, sana va **tekshirish kodi** (review id+sana+diagnozdan SHA-256 xesh,
  8 belgi) ko'rsatiladi — hisobotning keyinchalik o'zgartirilmaganini tekshirish uchun
  oddiy, kriptografik bo'lmagan lekin foydali yordamchi vosita.
- Test: sun'iy klinika logotipi va imzo rasmlari yuklab, PDF hisobot generatsiya qilindi;
  headless Chrome orqali (Chrome'ning ichki PDF ko'rish vositasi bilan file:// orqali
  ochilib) skrinshot olinib TASDIQLANDI: (1) logotip bilan + haqiqiy imzo rasmi bilan,
  (2) imzo o'chirilgandan keyin matnli "TASDIQLANDI" muhriga to'g'ri qaytishi. AdminPanel
  va ProfileModal UI qismlari ham skrinshot orqali tekshirildi. So'ng barcha test
  yozuv/fayl/logotip/imzo o'chirildi.
