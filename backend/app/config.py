import os
from pathlib import Path
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parents[1]
load_dotenv(BASE / ".env")
APP_NAME = os.getenv("APP_NAME", "Moon Light PG")
APP_SECRET = os.getenv("APP_SECRET", "moonlight-pg-enterprise-secret-key-production-2026-v1")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "MoonLightAdmin2026!")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
BACKUP_TIME = os.getenv("BACKUP_TIME", "22:00")
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
DATA = BASE / "data"
DB_PATH = DATA / "moonlight_pg.db"
BACKUPS = DATA / "backups"
LOGS = DATA / "logs"
RECEIPTS = DATA / "receipts"
REPORTS = DATA / "reports"
UPLOADS = DATA / "uploads"
for directory in (DATA, BACKUPS, LOGS, RECEIPTS, REPORTS, UPLOADS):
    directory.mkdir(parents=True, exist_ok=True)
if len(APP_SECRET) < 32:
    raise RuntimeError("Set APP_SECRET in backend/.env to at least 32 characters.")
