import csv, json, io
from datetime import datetime
from typing import Tuple, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import (
    Tenant, Room, Bed, BedAllocation, RentInvoice, Payment,
    Deposit, Expense, FoodSubscription, ParkingAllocation,
    AuditLog, PgTask, DataImportLog
)
from .audit import log_audit

def export_entity_data(db: Session, entity_type: str, format_type: str = "csv") -> Tuple[str, str]:
    """Exports database table records as CSV or JSON."""
    entity = entity_type.lower()
    records = []

    if entity == "tenants":
        rows = db.scalars(select(Tenant).order_by(Tenant.id)).all()
        records = [
            {
                "id": r.id, "tenant_code": r.tenant_code, "full_name": r.full_name,
                "mobile": r.mobile, "email": r.email, "gender": r.gender, "dob": r.dob,
                "occupation": r.occupation, "joining_date": r.joining_date,
                "expected_leaving_date": r.expected_leaving_date, "status": r.status
            }
            for r in rows
        ]
    elif entity == "rooms":
        rows = db.scalars(select(Room).order_by(Room.room_number)).all()
        records = [
            {
                "id": r.id, "room_number": r.room_number, "floor": r.floor,
                "room_type": r.room_type, "capacity": r.capacity, "monthly_rent": r.monthly_rent,
                "status": r.status, "has_ac": r.has_ac, "description": r.description
            }
            for r in rows
        ]
    elif entity == "beds":
        rows = db.scalars(select(Bed).order_by(Bed.id)).all()
        records = [
            {"id": r.id, "room_id": r.room_id, "bed_number": r.bed_number, "status": r.status, "monthly_rent": r.monthly_rent}
            for r in rows
        ]
    elif entity == "invoices":
        rows = db.scalars(select(RentInvoice).order_by(RentInvoice.id.desc())).all()
        records = [
            {
                "id": r.id, "invoice_number": r.invoice_number, "tenant_id": r.tenant_id,
                "room_id": r.room_id, "bed_id": r.bed_id, "billing_month": r.billing_month,
                "billing_year": r.billing_year, "total_amount": r.total_amount, "amount_paid": r.amount_paid,
                "pending_amount": r.pending_amount, "due_date": r.due_date, "status": r.status
            }
            for r in rows
        ]
    elif entity == "payments":
        rows = db.scalars(select(Payment).order_by(Payment.id.desc())).all()
        records = [
            {
                "id": r.id, "payment_number": r.payment_number, "tenant_id": r.tenant_id,
                "amount": r.amount, "payment_date": r.payment_date,
                "payment_type": r.payment_type, "payment_mode": r.payment_mode,
                "receipt_number": r.receipt_number, "is_cancelled": r.is_cancelled
            }
            for r in rows
        ]
    elif entity == "expenses":
        rows = db.scalars(select(Expense).order_by(Expense.id.desc())).all()
        records = [
            {
                "id": r.id, "expense_number": r.expense_number, "category": r.category,
                "amount": r.amount, "expense_date": r.expense_date, "payment_mode": r.payment_mode,
                "paid_to": r.paid_to, "is_deleted": r.is_deleted
            }
            for r in rows
        ]
    elif entity == "tasks":
        rows = db.scalars(select(PgTask).order_by(PgTask.id.desc())).all()
        records = [
            {
                "id": r.id, "task_code": r.task_code, "title": r.title, "category": r.category,
                "priority": r.priority, "status": r.status, "assigned_to": r.assigned_to,
                "due_date": r.due_date, "completed_date": r.completed_date
            }
            for r in rows
        ]
    elif entity == "audit_logs":
        rows = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(1000)).all()
        records = [
            {
                "id": r.id, "username": r.username, "action": r.action, "entity_type": r.entity_type,
                "entity_id": r.entity_id, "outcome": r.outcome, "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in rows
        ]
    else:
        raise ValueError(f"Unsupported export entity: {entity_type}")

    if format_type.lower() == "json":
        return json.dumps(records, indent=2), "application/json"

    # CSV Format
    output = io.StringIO()
    if records:
        writer = csv.DictWriter(output, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)
    return output.getvalue(), "text/csv"

def preview_import_data(db: Session, entity_type: str, raw_content: str, filename: str) -> Dict[str, Any]:
    """Parses, validates, and detects duplicate records for an import file."""
    rows: List[dict] = []
    errors: List[str] = []

    if filename.endswith(".json"):
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, list):
                rows = parsed
            else:
                errors.append("JSON root must be an array of records.")
        except Exception as e:
            errors.append(f"Invalid JSON format: {e}")
    else: # CSV
        try:
            reader = csv.DictReader(io.StringIO(raw_content))
            rows = [dict(r) for r in reader]
        except Exception as e:
            errors.append(f"Invalid CSV format: {e}")

    if not rows and not errors:
        errors.append("File is empty or contains no records.")

    valid_rows = []
    skipped_rows = []

    entity = entity_type.lower()
    for idx, r in enumerate(rows):
        row_num = idx + 1
        row_errs = []

        if entity == "tenants":
            if not r.get("full_name"):
                row_errs.append("Missing full_name")
            if not r.get("mobile"):
                row_errs.append("Missing mobile")
            else:
                # Duplicate check in DB
                existing_mob = db.scalar(select(Tenant).where(Tenant.mobile == str(r["mobile"]).strip()))
                if existing_mob:
                    skipped_rows.append({"row": row_num, "reason": f"Mobile '{r['mobile']}' already exists (Tenant: {existing_mob.full_name})"})
                    continue

        elif entity == "rooms":
            if not r.get("room_number"):
                row_errs.append("Missing room_number")
            else:
                existing_room = db.scalar(select(Room).where(Room.room_number == str(r["room_number"]).strip()))
                if existing_room:
                    skipped_rows.append({"row": row_num, "reason": f"Room '{r['room_number']}' already exists"})
                    continue

        if row_errs:
            errors.append(f"Row {row_num}: {', '.join(row_errs)}")
        else:
            valid_rows.append(r)

    return {
        "entity_type": entity_type,
        "filename": filename,
        "total_rows": len(rows),
        "valid_count": len(valid_rows),
        "skipped_count": len(skipped_rows),
        "error_count": len(errors),
        "errors": errors[:50],
        "skipped": skipped_rows[:50],
        "preview": valid_rows[:20]
    }

def confirm_import_data(
    db: Session,
    entity_type: str,
    valid_rows: List[dict],
    filename: str,
    imported_by: str = "Administrator"
) -> Dict[str, Any]:
    """Commits validated records to the database with audit tracking."""
    entity = entity_type.lower()
    created_count = 0

    try:
        if entity == "tenants":
            # Determine starting tenant_code
            last_t = db.scalar(select(Tenant).order_by(Tenant.id.desc()))
            code_num = (last_t.id + 1) if last_t else 1

            for r in valid_rows:
                code = f"TEN-{code_num:04d}"
                t = Tenant(
                    tenant_code=code,
                    full_name=r.get("full_name", "").strip(),
                    mobile=str(r.get("mobile", "")).strip(),
                    email=r.get("email"),
                    gender=r.get("gender", "Male"),
                    dob=r.get("dob"),
                    permanent_address=r.get("permanent_address"),
                    occupation=r.get("occupation", "Working"),
                    joining_date=r.get("joining_date", datetime.now().strftime("%Y-%m-%d")),
                    expected_leaving_date=r.get("expected_leaving_date"),
                    status=r.get("status", "Active")
                )
                db.add(t)
                code_num += 1
                created_count += 1

        elif entity == "rooms":
            for r in valid_rows:
                room = Room(
                    room_number=str(r.get("room_number", "")).strip(),
                    floor=int(r.get("floor", 1)),
                    room_type=r.get("room_type", "Sharing"),
                    capacity=int(r.get("capacity", 2)),
                    monthly_rent=float(r.get("monthly_rent", 6000.0)),
                    has_ac=str(r.get("has_ac", "false")).lower() in ("true", "1", "yes"),
                    status=r.get("status", "Available"),
                    description=r.get("description")
                )
                db.add(room)
                db.flush()
                # Create beds
                for i in range(1, room.capacity + 1):
                    bed = Bed(
                        room_id=room.id,
                        bed_number=f"Bed {i}",
                        status="Available",
                        monthly_rent=room.monthly_rent
                    )
                    db.add(bed)
                created_count += 1

        db.commit()

        # Record import history
        import_log = DataImportLog(
            entity_type=entity_type,
            filename=filename,
            total_rows=len(valid_rows),
            success_rows=created_count,
            skipped_rows=0,
            error_rows=0,
            status="Confirmed",
            imported_by=imported_by
        )
        db.add(import_log)
        db.commit()

        log_audit(
            db=db,
            username=imported_by,
            action="IMPORT",
            entity_type=entity_type,
            entity_id=filename,
            outcome="Success",
            details=f"Imported {created_count} {entity_type} records from {filename}"
        )

        return {"status": "success", "imported_count": created_count}
    except Exception as e:
        db.rollback()
        raise e
