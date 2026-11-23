import logging
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import User
from .security import hash_password

logger = logging.getLogger("moonlight.users")

DEFAULT_ACCOUNTS = [
    ("master", "MoonLightMaster2026!", "master"),
    ("admin", "MoonLightAdmin2026!", "admin"),
    ("client", "MoonLightClient2026!", "client"),
    ("client1", "MoonLightClient2026!", "client"),
    ("client2", "MoonLightClient2026!", "client"),
    ("client3", "MoonLightClient2026!", "client"),
]

def init_system_users(db: Session):
    """Guarantees that Master, Admin, and Client accounts exist with verified roles."""
    for username, password, role in DEFAULT_ACCOUNTS:
        user = db.scalar(select(User).where(User.username == username))
        if not user:
            user = User(
                username=username,
                password_hash=hash_password(password),
                role=role,
                is_active=True
            )
            db.add(user)
            logger.info("Initialized system account: %s (role=%s)", username, role)
        else:
            # Ensure role is set properly
            if user.role != role or not user.is_active:
                user.role = role
                user.is_active = True
                logger.info("Synchronized system account: %s (role=%s)", username, role)
    db.commit()

