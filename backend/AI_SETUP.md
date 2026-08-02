# MammoAI — Chuqur o'rganish (ConvNeXt) moduli

Bu hujjat `app/ai/` ostidagi chuqur o'rganish (deep learning) pipeline'ini
tasvirlaydi — mr.robot (RSNA Breast Cancer Detection musobaqasining 1-o'rin
yechimi, https://github.com/dangnh0611/kaggle_rsna_breast_cancer) g'oyalaridan
ilhomlangan, lekin **RASMAN o'sha model EMAS** (pastga qarang: "Muhim huquqiy
va texnik eslatma").

## Tezkor boshlash

```bash
# 1) Ixtiyoriy AI bog'liqliklarini o'rnatish (og'ir, ~1-2 GB)
pip install -r requirements.txt -r requirements-ai.txt

# 2) Dataset manifest'ini yaratish (bemor darajasida train/val bo'lingan)
python -m app.ai.training.dataset_prep

# 3) O'qitish (FAST profil — standart, ~30-50 daqiqa Apple Silicon'da)
python -m app.ai.training.train

# Yoki PRODUCTION profil (kuchli GPU serverda, kelajakda):
AI_PROFILE=production python -m app.ai.training.train
```

O'qitish tugagach, natija `model/convnext_best.pt` fayliga saqlanadi va
`/api/ai-predict/{image_id}` endpoint'i AVTOMATIK shu modelni ishlata boshlaydi
(backend qayta ishga tushirilgandan keyin — model birinchi so'rovda yuklanadi
va xotirada saqlanadi, har safar qayta yuklanmaydi).

## Arxitektura

```
app/ai/
  config.py                  — markazlashtirilgan konfiguratsiya (FAST/PRODUCTION)
  preprocessing/
    breast_crop.py           — ko'krak mintaqasini fondan ajratish (threshold-asosli, tez)
    transforms.py             — o'qitish (augmentatsiya bilan) / xulosa (aug'siz) transformatsiyalari
  models/
    convnext_model.py        — ConvNeXt wrapper (checkpoint yuklash/saqlash, device tanlash)
    registry.py               — model versiyalari tarixi (model/registry.json)
  training/
    dataset_prep.py           — CBIS-DDSM namunasidan BEMOR DARAJASIDA train/val manifest
    dataset.py                 — PyTorch Dataset (manifest.json'dan o'qiydi)
    train.py                   — o'qitish tsikli (vaqt byudjeti, ROC-AUC/PR-AUC baholash)
  inference/
    deep_predictor.py         — xulosa chiqarish (singleton model, MODEL_WEIGHTS_NOT_FOUND holati)
  aggregation/
    aggregation.py             — ko'p ko'rinishli (L-CC/L-MLO/R-CC/R-MLO) natijalarni yig'ish

  # Eski (KNN-asosidagi) tizim — ATAYLAB saqlab qolingan, ConvNeXt og'irligi
  # topilmasa AVTOMATIK ravishda shu tizimga qaytiladi:
  predictor.py, embeddings.py, lesion.py, heatmap.py, validator.py
```

## Dataset

Loyihada `backend/cbis_data/` ichida CBIS-DDSM (ochiq, akademik mammografiya
dataset)ning 500 rasmlik namunasi bor (`jpeg_sample/`, `sample_500.json`).
`sample_500.json` har bir rasm uchun `patient_id` saqlaydi — shu orqali
**bemor darajasida** train/val bo'linadi (`dataset_prep.py`), aks holda bitta
bemorning bir nechta rasmi ham train, ham val'ga tushib, natija soxta yuqori
chiqishi mumkin edi ("data leakage").

Joriy bo'linish (val_ratio=0.2, seed=42): **395 train / 104 val**, ikkala
to'plamda ham Benign/Malignant nisbati muvozanatli saqlangan.

## FAST vs PRODUCTION profil

| | FAST (hozirgi, standart) | PRODUCTION (kelajakda) |
|---|---|---|
| Model | ConvNeXt-Tiny | ConvNeXt-Base |
| Rasm o'lchami | 512px | 1536px |
| Epochlar | 20 | 40+ |
| Backbone | to'liq fine-tune | to'liq fine-tune |
| Vaqt byudjeti | 150 daqiqa (avtomatik to'xtaydi) | cheklovsiz |
| Dataset | 500 rasmlik namuna | to'liq CBIS-DDSM (~3300 rasm, `mapping.json`da bor) |

Profil `AI_PROFILE=fast|production` orqali tanlanadi. Barcha qiymatlar
`AI_*` muhit o'zgaruvchilari orqali sozlanadi (`ai/config.py`da to'liq
ro'yxat) — kodni o'zgartirmasdan.

## Nega bu "mr.robot" ning o'zi emas

Musobaqaning haqiqiy g'olib og'irliklari (YOLOX + ConvNeXt checkpoint'lari)
Kaggle qoidalariga ko'ra ochiq tarqatilmagan va ularni noldan qayta o'qitish
mualliflarning o'z GitHub'iga ko'ra **~8 kun A100 GPU** talab qiladi. Bu yerda:

- **ROI detektsiya (YOLOX)** o'rniga — tez, threshold-asosli `BreastRegionDetector`
  (interfeys sifatida qurilgan, kelajakda YOLOX bilan almashtirilishi mumkin).
- **ConvNeXt klassifikatsiya** — xuddi shu backbone oilasi ishlatilgan, lekin
  ImageNet pretrained og'irlikdan boshlab, faqat CBIS-DDSM namunasida
  fine-tune qilingan (musobaqa ma'lumotida EMAS).
- **Ensemble (4-fold)** — hozircha yo'q (bitta model), lekin `AI_ENABLE_ENSEMBLE`
  konfiguratsiyasi va kelajakda ko'p checkpoint'ni birlashtirish uchun joy
  qoldirilgan.

Shu sabab model versiyasi kodda **`mrrobot-inspired-0.1.0`** deb nomlangan —
"rasman mr.robot modeli" deb HECH QACHON da'vo qilinmaydi.

## Xavfsizlik va tibbiy ogohlantirish

- Model natijasi **HECH QACHON** "saraton tasdiqlandi" deb ko'rsatilmaydi —
  faqat "AI-baholangan ehtimollik" sifatida, va yakuniy tashxis doim radiolog
  tomonidan tasdiqlanishi kerakligi frontend'da alohida yozib qo'yilgan.
- Bemor ma'lumotlari (rasm, ism) hech qanday tashqi AI xizmatiga
  yuborilmaydi — model to'liq lokal (yoki o'zingizning serveringizda) ishlaydi.
- Model og'irligi topilmasa (`MODEL_WEIGHTS_NOT_FOUND`), tizim soxta
  bashorat QILMAYDI — avtomatik ravishda mavjud KNN (shifokor belgilagan
  rasmlar bilan solishtirish) tizimiga qaytadi.

## Muammolarni bartaraf etish

| Muammo | Yechim |
|---|---|
| `TORCH_NOT_INSTALLED` | `pip install -r requirements-ai.txt` |
| `MODEL_WEIGHTS_NOT_FOUND` | `python -m app.ai.training.train` ishga tushiring |
| O'qitish juda sekin | `AI_IMAGE_SIZE`ni kamaytiring yoki `AI_DEVICE=cpu`dan `mps`/`cuda`ga o'ting |
| CUDA/MPS xotira yetmayapti | `AI_BATCH_SIZE`ni kamaytiring |
