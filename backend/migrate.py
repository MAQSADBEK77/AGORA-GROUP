"""
Ma'lumotlar bazasini yangi sxemaga moslashtiradi.
Mavjud ma'lumotlarni saqlab, yangi ustunlar qo'shadi.
"""
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "./mammoai.db")

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    changed = False

    migrations = [
        ("predictions", "cancer_prob",    "ALTER TABLE predictions ADD COLUMN cancer_prob REAL"),
        ("predictions", "analysis_mode",  "ALTER TABLE predictions ADD COLUMN analysis_mode TEXT DEFAULT 'heuristic'"),
        ("ai_predictions", "lesion_x",      "ALTER TABLE ai_predictions ADD COLUMN lesion_x REAL"),
        ("ai_predictions", "lesion_y",      "ALTER TABLE ai_predictions ADD COLUMN lesion_y REAL"),
        ("ai_predictions", "lesion_width",  "ALTER TABLE ai_predictions ADD COLUMN lesion_width REAL"),
        ("ai_predictions", "lesion_height", "ALTER TABLE ai_predictions ADD COLUMN lesion_height REAL"),
        ("patients", "dicom_patient_id", "ALTER TABLE patients ADD COLUMN dicom_patient_id TEXT"),
        ("mammography_images", "cad_summary", "ALTER TABLE mammography_images ADD COLUMN cad_summary TEXT"),
        ("mammography_images", "patient_orientation", "ALTER TABLE mammography_images ADD COLUMN patient_orientation TEXT"),
        ("mammography_images", "laterality",    "ALTER TABLE mammography_images ADD COLUMN laterality TEXT"),
        ("mammography_images", "view_position", "ALTER TABLE mammography_images ADD COLUMN view_position TEXT"),
        # Eski ustunlarni tozalash (SQLite ALTER DROP yo'q, shuning uchun shunchaki o'tkazib yuboramiz)
    ]

    for table, col, sql in migrations:
        if not column_exists(cur, table, col):
            print(f"  + {table}.{col} ustuni qo'shilmoqda...")
            cur.execute(sql)
            changed = True
        else:
            print(f"  ✓ {table}.{col} allaqachon mavjud")

    conn.commit()
    conn.close()
    print("\nMigration tugadi!" if changed else "\nHech narsa o'zgarmadi.")

if __name__ == "__main__":
    migrate()
