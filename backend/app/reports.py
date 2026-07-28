"""Bemor uchun to'liq tashxis hisobotini PDF ko'rinishida yaratadi."""
import hashlib
import io
import os
from datetime import datetime

from PIL import Image as PILImage, ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle

from . import models

LABEL_HEX = {
    "Normal":         "#16a34a",
    "Benign":         "#ca8a04",
    "Malignant":      "#dc2626",
    "Very Malignant": "#7f1d1d",
}

CLINIC_LOGO_PATH = os.path.join(os.getenv("UPLOAD_DIR", "./uploads"), "clinic_logo.png")


def _verification_code(review) -> str:
    """Hisobotning soxta bo'lmaganini tekshirish uchun qisqa kod — review id+sana asosida."""
    raw = f"{review.id}-{review.reviewed_at}-{review.label.value}"
    return hashlib.sha256(raw.encode()).hexdigest()[:8].upper()


def _signature_stamp(review):
    """Shifokor tasdig'i muhri — shaxsiy imzo rasmi bo'lsa o'shani, bo'lmasa
    matnli 'TASDIQLANDI' muhrini (tekshirish kodi bilan) qaytaradi."""
    doctor = review.doctor
    code = _verification_code(review)
    date_txt = review.reviewed_at.strftime('%Y-%m-%d %H:%M') if review.reviewed_at else "—"

    cell_style = ParagraphStyle("StampText", fontName="Helvetica", fontSize=9, leading=12)
    stamp_bold = ParagraphStyle("StampBold", parent=cell_style, fontName="Helvetica-Bold", fontSize=10)

    if doctor and doctor.signature_path and os.path.exists(doctor.signature_path):
        sig_img = RLImage(doctor.signature_path, width=40 * mm, height=18 * mm, kind="proportional")
        content = [
            [sig_img],
            [Paragraph(f"<b>{doctor.full_name}</b>", cell_style)],
            [Paragraph(f"Tasdiqlangan: {date_txt}", cell_style)],
            [Paragraph(f"Tekshirish kodi: {code}", cell_style)],
        ]
    else:
        content = [
            [Paragraph("TASDIQLANDI", stamp_bold)],
            [Paragraph(f"<b>{doctor.full_name if doctor else '—'}</b>", cell_style)],
            [Paragraph(f"Sana: {date_txt}", cell_style)],
            [Paragraph(f"Tekshirish kodi: {code}", cell_style)],
        ]

    table = Table(content, colWidths=[60 * mm])
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#2563eb")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _annotate_image(image_path: str, ai_pred) -> io.BytesIO:
    img = PILImage.open(image_path).convert("RGB")
    if ai_pred and ai_pred.lesion_x is not None:
        w, h = img.size
        x0, y0 = ai_pred.lesion_x * w, ai_pred.lesion_y * h
        x1, y1 = x0 + ai_pred.lesion_width * w, y0 + ai_pred.lesion_height * h
        draw = ImageDraw.Draw(img)
        draw.rectangle([x0, y0, x1, y1], outline="#dc2626", width=max(3, int(w * 0.004)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    buf.seek(0)
    return buf


def generate_diagnosis_pdf(image: models.MammographyImage, resolved_image_path: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                             leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleUZ", parent=styles["Title"], fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=10, spaceAfter=4)
    normal = styles["Normal"]
    bold = ParagraphStyle("Bold", parent=normal, fontName="Helvetica-Bold")
    note = ParagraphStyle("Note", parent=normal, fontSize=8, textColor=colors.grey)

    elements = []

    title_block = [
        Paragraph("MammoAI — Tashxis Hisoboti", title_style),
        Paragraph(f"Yaratilgan sana: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal),
    ]
    if os.path.exists(CLINIC_LOGO_PATH):
        logo = RLImage(CLINIC_LOGO_PATH, width=22 * mm, height=22 * mm, kind="proportional")
        header_table = Table([[logo, title_block]], colWidths=[26 * mm, 139 * mm])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
    else:
        elements.extend(title_block)
    elements.append(Spacer(1, 8))

    patient = image.patient
    info_rows = [
        ["Bemor F.I.Sh.",   patient.full_name if patient else "—"],
        ["Tug'ilgan yil",   str(patient.birth_year) if patient and patient.birth_year else "—"],
        ["Telefon",         patient.phone if patient and patient.phone else "—"],
        ["Rasm fayli",      image.filename],
        ["Yuklangan sana",  image.uploaded_at.strftime('%Y-%m-%d %H:%M') if image.uploaded_at else "—"],
    ]
    table = Table(info_rows, colWidths=[45 * mm, 120 * mm])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)

    ai_pred = image.ai_prediction

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Mammografiya rasmi", h2))
    if os.path.exists(resolved_image_path):
        img_buf = _annotate_image(resolved_image_path, ai_pred)
        elements.append(RLImage(img_buf, width=110 * mm, height=110 * mm, kind="proportional"))
        if ai_pred and ai_pred.lesion_x is not None:
            elements.append(Paragraph(
                "<font color='#dc2626'>Qizil ramka — AI aniqlagan taxminiy shubhali mintaqa "
                "(tasvirga ishlov berish orqali; yakuniy tashxis radiolog tomonidan tasdiqlanadi).</font>",
                note))
    else:
        elements.append(Paragraph("Rasm fayli topilmadi.", normal))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("AI tahlil natijasi", h2))
    if ai_pred:
        color = LABEL_HEX.get(ai_pred.label.value, "#000000")
        elements.append(Paragraph(
            f"Taxmin: <font color='{color}'><b>{ai_pred.label.value}</b></font> — "
            f"Ishonch: {round((ai_pred.confidence or 0) * 100)}%", normal))
    else:
        elements.append(Paragraph("AI tahlil o'tkazilmagan.", normal))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Radiolog xulosasi", h2))
    review = image.review
    if review:
        color = LABEL_HEX.get(review.label.value, "#000000")
        birads_txt = f" — BI-RADS {review.birads}" if review.birads is not None else ""
        elements.append(Paragraph(
            f"Yakuniy diagnoz: <font color='{color}'><b>{review.label.value}</b></font>{birads_txt}", normal))
        elements.append(Paragraph(f"Shifokor: {review.doctor.full_name if review.doctor else '—'}", normal))
        if review.reviewed_at:
            elements.append(Paragraph(f"Sana: {review.reviewed_at.strftime('%Y-%m-%d %H:%M')}", normal))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("Izoh / Tavsif:", bold))
        elements.append(Paragraph((review.description or "—").replace("\n", "<br/>"), normal))

        elements.append(Spacer(1, 14))
        elements.append(_signature_stamp(review))
    else:
        elements.append(Paragraph("Radiolog hali diagnoz qo'ymagan.", normal))

    elements.append(Spacer(1, 14))
    elements.append(Paragraph(
        "Ushbu hisobot shifokorga yordamchi vosita bo'lib, yakuniy tibbiy qaror "
        "doim malakali shifokor tomonidan qabul qilinadi.", note))

    doc.build(elements)
    buf.seek(0)
    return buf.read()
