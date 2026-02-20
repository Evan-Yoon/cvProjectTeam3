import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text("ALTER TABLE public.reports ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;"))
    db.commit()
    print("Column added successfully.")
except Exception as e:
    db.rollback()
    print("Failed or already added:", e)
finally:
    db.close()