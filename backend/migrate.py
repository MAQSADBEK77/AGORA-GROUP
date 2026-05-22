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
