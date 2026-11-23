from sqlalchemy import select
from .config import ADMIN_USERNAME, ADMIN_PASSWORD
from .database import Base, engine, SessionLocal
from .models import User
from .security import hash_password

def main():
    if not ADMIN_PASSWORD or ADMIN_PASSWORD.startswith("CHANGE_THIS"):
        raise SystemExit("Set ADMIN_PASSWORD in backend/.env first.")
    if len(ADMIN_PASSWORD) < 12:
        raise SystemExit("ADMIN_PASSWORD must contain at least 12 characters.")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.username == ADMIN_USERNAME)):
            print("Admin already exists; no changes made.")
            return
        db.add(User(username=ADMIN_USERNAME, password_hash=hash_password(ADMIN_PASSWORD), role="admin"))
        db.commit()
        print(f"Admin '{ADMIN_USERNAME}' created.")
if __name__ == "__main__":
    main()
