import logging
from typing import Optional
from sqlalchemy.orm import Session
from .models import AuditLog

log = logging.getLogger("moonlight.audit")

def redact_sensitive(text: str) -> str:
    """Removes sensitive keys/passwords from audit summaries."""
    import re
    cleaned = re.sub(r'(?i)(password|token|secret|hash)["\']?\s*[:=]\s*["\']?[^,\'"}]+', r'\1: [REDACTED]', text)
    return cleaned

def log_audit(
    db: Session,
    username: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str | int] = None,
    outcome: str = "Success",
    details: str = "",
    ip_address: Optional[str] = None,
    user_id: Optional[int] = None
) -> AuditLog:
    """Records an immutable audit log entry."""
    try:
        clean_details = redact_sensitive(details) if details else f"{action} on {entity_type} {entity_id or ''}".strip()
        audit_entry = AuditLog(
            user_id=user_id,
            username=username or "system",
            action=action.upper(),
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            outcome=outcome,
            details=clean_details[:2000],
            ip_address=ip_address
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        log.warning("Failed to record audit log: %s", e)
        db.rollback()
        return None

