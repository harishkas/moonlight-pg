import logging, sqlite3
from datetime import datetime, timedelta
from .config import DB_PATH, BACKUPS, BACKUP_RETENTION_DAYS

log = logging.getLogger("moonlight.backup")

def create_backup():
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = BACKUPS / f"moonlight_pg_{stamp}.sqlite3"
    source = sqlite3.connect(str(DB_PATH), timeout=30)
    destination = sqlite3.connect(str(target))
    try:
        source.backup(destination)
        check = destination.execute("PRAGMA integrity_check").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError(f"Backup integrity check failed: {check}")
    finally:
        destination.close()
        source.close()
    cutoff = datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)
    for old in BACKUPS.glob("moonlight_pg_*.sqlite3"):
        if datetime.fromtimestamp(old.stat().st_mtime) < cutoff:
            old.unlink(missing_ok=True)
    log.info("Created backup %s", target)
    return target
