import sqlite3

conn = sqlite3.connect("mammoai.db")
cur  = conn.cursor()

updates = [
    ("doctor_reviews", "normal",        "Normal"),
    ("doctor_reviews", "benign",        "Benign"),
    ("doctor_reviews", "malignant",     "Malignant"),
    ("doctor_reviews", "very_malignant","Very Malignant"),
    ("ai_predictions", "normal",        "Normal"),
    ("ai_predictions", "benign",        "Benign"),
    ("ai_predictions", "malignant",     "Malignant"),
]

for table, old, new in updates:
    cur.execute(f"UPDATE {table} SET label=? WHERE label=?", (new, old))
    print(f"  {table}: {old} -> {new} ({cur.rowcount} ta)")

conn.commit()

cur.execute("SELECT DISTINCT label FROM doctor_reviews")
print("\ndoctor_reviews labels:", [r[0] for r in cur.fetchall()])
conn.close()
print("Tayyor!")
