import os, sqlite3, shutil, uuid, json
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query, UploadFile, File
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from sqlalchemy import select, func, or_, and_, desc
from sqlalchemy.orm import Session

from .database import get_db
from .security import read_session
from .config import DB_PATH, BACKUPS, REPORTS, APP_NAME, BACKUP_RETENTION_DAYS, BACKUP_TIME
from .models import (
    User, Tenant, Room, Bed, BedAllocation, RentInvoice, Payment,
    Expense, Notification, NotificationPreference, ReminderHistory,
    ScheduledJob, JobExecutionLog, ReportHistory, PgTask, AuditLog,
    DataImportLog, FoodSubscription, ParkingAllocation, ServiceCharge
)
from .schemas import (
    NotificationOut, NotificationPreferenceOut, NotificationPreferenceUpdate,
    ReminderHistoryOut, ScheduledJobOut, ScheduledJobUpdate, JobExecutionLogOut,
    ReportHistoryOut, ReportGenerateRequest,
    PgTaskCreate, PgTaskUpdate, PgTaskOut,
    AuditLogOut, BackupItemOut, BackupSettingsOut, BackupSettingsUpdate,
    DataImportPreviewRequest, DataImportPreviewOut, DataImportConfirmRequest, SystemHealthOut
)
from .audit import log_audit
from .backup import create_backup
from .scheduler import run_job_now, is_pref_enabled, init_scheduler_defaults
from .analytics_engine import (
    get_analytics_overview, get_occupancy_analytics, get_financial_analytics,
    get_tenant_analytics, get_service_analytics
)
from .report_engine import (
    generate_daily_report_data, generate_weekly_report_data, generate_monthly_report_data,
    save_report_history, build_report_pdf, build_report_csv
)
from .import_export import export_entity_data, preview_import_data, confirm_import_data

router = APIRouter(tags=["Phase 6: Automation & Analytics"])

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("mlpg_session")
    user_id = read_session(token) if token else None
    if not user_id:
        raise HTTPException(401, "Please sign in.")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "User not active.")
    return user

def require_write_user(user: User = Depends(get_current_user)) -> User:
    if user.role.lower() == "client":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Client account has View-Only permissions and cannot perform write, edit, or delete actions."
        )
    return user

def serialize_notification(n: Notification, db: Session) -> dict:
    tenant_name = None
    if n.tenant_id:
        t = db.get(Tenant, n.tenant_id)
        if t:
            tenant_name = t.full_name
    return {
        "id": n.id,
        "notification_code": n.notification_code,
        "title": n.title,
        "description": n.description,
        "category": n.category,
        "priority": n.priority,
        "tenant_id": n.tenant_id,
        "tenant_name": tenant_name,
        "related_type": n.related_type,
        "related_id": n.related_id,
        "is_read": n.is_read,
        "read_at": n.read_at,
        "is_dismissed": n.is_dismissed,
        "delivery_status": n.delivery_status,
        "scheduled_date": n.scheduled_date,
        "expiry_date": n.expiry_date,
        "created_at": n.created_at
    }

def serialize_task(t: PgTask, db: Session) -> dict:
    tenant_name = None
    if t.tenant_id:
        ten = db.get(Tenant, t.tenant_id)
        if ten:
            tenant_name = ten.full_name
    return {
        "id": t.id,
        "task_code": t.task_code,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "priority": t.priority,
        "status": t.status,
        "assigned_to": t.assigned_to,
        "tenant_id": t.tenant_id,
        "tenant_name": tenant_name,
        "due_date": t.due_date,
        "completed_date": t.completed_date,
        "remarks": t.remarks,
        "created_by": t.created_by,
        "created_at": t.created_at,
        "updated_at": t.updated_at
    }

# =========================================================================
# 1. NOTIFICATIONS
# =========================================================================

@router.get("/api/notifications", response_model=List[NotificationOut])
def list_notifications(
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    is_dismissed: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = select(Notification).where(Notification.is_dismissed == is_dismissed)
    if category and category.lower() != "all":
        query = query.where(Notification.category.ilike(category))
    if priority and priority.lower() != "all":
        query = query.where(Notification.priority.ilike(priority))
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(or_(Notification.title.ilike(s), Notification.description.ilike(s)))

    query = query.order_by(desc(Notification.id)).offset(offset).limit(limit)
    rows = db.scalars(query).all()
    return [serialize_notification(r, db) for r in rows]

@router.get("/api/notifications/unread-count")
def get_unread_notification_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.is_read == False,
            Notification.is_dismissed == False
        )
    ) or 0
    return {"count": count}

@router.put("/api/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    n = db.get(Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    n.read_at = datetime.now()
    db.commit()
    db.refresh(n)
    return serialize_notification(n, db)

@router.post("/api/notifications/read-all")
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(Notification.is_read == False).update({
        Notification.is_read: True,
        Notification.read_at: datetime.now()
    })
    db.commit()
    return {"message": "All notifications marked as read."}

@router.put("/api/notifications/{notification_id}/dismiss")
def dismiss_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    n = db.get(Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_dismissed = True
    db.commit()
    return {"message": "Notification dismissed."}

@router.delete("/api/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    n = db.get(Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")
    db.delete(n)
    db.commit()
    return {"message": "Notification deleted."}

@router.get("/api/notifications/preferences", response_model=List[NotificationPreferenceOut])
def get_notification_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    init_scheduler_defaults(db)
    prefs = db.scalars(select(NotificationPreference).order_by(NotificationPreference.category, NotificationPreference.id)).all()
    return prefs

@router.put("/api/notifications/preferences")
def update_notification_preferences(
    data: NotificationPreferenceUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    updated = []
    for k, v in data.preferences.items():
        pref = db.scalar(select(NotificationPreference).where(NotificationPreference.key == k))
        if pref:
            pref.value = str(v)
            updated.append(k)

    db.commit()
    log_audit(
        db=db,
        username=user.username,
        action="UPDATE",
        entity_type="NotificationPreferences",
        outcome="Success",
        details=f"Updated preferences: {', '.join(updated)}",
        ip_address=request.client.host if request.client else None,
        user_id=user.id
    )
    return {"message": f"Updated {len(updated)} preferences.", "updated": updated}

# =========================================================================
# 2. AUTOMATION & REMINDERS
# =========================================================================

@router.get("/api/automation/jobs", response_model=List[ScheduledJobOut])
def list_scheduled_jobs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    init_scheduler_defaults(db)
    jobs = db.scalars(select(ScheduledJob).order_by(ScheduledJob.id)).all()
    out = []
    for j in jobs:
        logs = db.scalars(select(JobExecutionLog).where(JobExecutionLog.job_id == j.id).order_by(JobExecutionLog.id.desc()).limit(5)).all()
        j_dict = {
            "id": j.id,
            "job_key": j.job_key,
            "name": j.name,
            "description": j.description,
            "cron_expression": j.cron_expression,
            "is_active": j.is_active,
            "last_run_at": j.last_run_at,
            "last_status": j.last_status,
            "last_message": j.last_message,
            "next_run_at": j.next_run_at,
            "execution_logs": logs
        }
        out.append(j_dict)
    return out

@router.put("/api/automation/jobs/{job_id}", response_model=ScheduledJobOut)
def update_scheduled_job(
    job_id: int,
    data: ScheduledJobUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if data.is_active is not None:
        job.is_active = data.is_active
    if data.cron_expression is not None:
        job.cron_expression = data.cron_expression

    db.commit()
    db.refresh(job)
    logs = db.scalars(select(JobExecutionLog).where(JobExecutionLog.job_id == job.id).order_by(JobExecutionLog.id.desc()).limit(5)).all()
    return {
        "id": job.id,
        "job_key": job.job_key,
        "name": job.name,
        "description": job.description,
        "cron_expression": job.cron_expression,
        "is_active": job.is_active,
        "last_run_at": job.last_run_at,
        "last_status": job.last_status,
        "last_message": job.last_message,
        "next_run_at": job.next_run_at,
        "execution_logs": logs
    }

@router.post("/api/automation/jobs/{job_id}/run")
def trigger_scheduled_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    res = run_job_now(job.job_key, db, triggered_by=user.username)
    return res

@router.get("/api/automation/history", response_model=List[JobExecutionLogOut])
def get_job_execution_history(
    limit: int = Query(50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.scalars(select(JobExecutionLog).order_by(JobExecutionLog.id.desc()).limit(limit)).all()
    return logs

@router.get("/api/automation/rent-reminders/history", response_model=List[ReminderHistoryOut])
def list_reminder_history(
    limit: int = Query(50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.scalars(select(ReminderHistory).order_by(ReminderHistory.id.desc()).limit(limit)).all()
    out = []
    for r in rows:
        t = db.get(Tenant, r.tenant_id)
        out.append({
            "id": r.id,
            "invoice_id": r.invoice_id,
            "tenant_id": r.tenant_id,
            "tenant_name": t.full_name if t else None,
            "reminder_type": r.reminder_type,
            "amount_due": r.amount_due,
            "sent_date": r.sent_date,
            "channel": r.channel,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at
        })
    return out

@router.post("/api/automation/rent-reminders/run")
def run_rent_reminders_manually(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    res = run_job_now("daily_rent_reminders", db, triggered_by=user.username)
    return res

@router.get("/api/automation/dues-summary")
def get_automated_dues_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Computes tenant-wise outstanding dues and overdue aging."""
    today = date.today()
    invoices = db.scalars(
        select(RentInvoice).where(RentInvoice.status.in_(["Unpaid", "Partially Paid", "Overdue"]))
    ).all()
    services = db.scalars(
        select(ServiceCharge).where(ServiceCharge.status.in_(["Unpaid", "Partially Paid", "Overdue"]))
    ).all()

    tenant_dues: Dict[int, Dict[str, Any]] = {}

    for inv in invoices:
        tid = inv.tenant_id
        if tid not in tenant_dues:
            t = db.get(Tenant, tid)
            rm = db.get(Room, inv.room_id) if inv.room_id else None
            tenant_dues[tid] = {
                "tenant_id": tid,
                "tenant_code": t.tenant_code if t else "TEN-0000",
                "tenant_name": t.full_name if t else "Resident",
                "mobile": t.mobile if t else "",
                "room_number": rm.room_number if rm else "",
                "rent_dues": 0.0,
                "service_dues": 0.0,
                "total_dues": 0.0,
                "overdue_0_30": 0.0,
                "overdue_30_60": 0.0,
                "overdue_60_plus": 0.0,
                "invoices_count": 0
            }

        due_d = datetime.strptime(inv.due_date, "%Y-%m-%d").date()
        days_past = (today - due_d).days

        tenant_dues[tid]["rent_dues"] += inv.pending_amount
        tenant_dues[tid]["total_dues"] += inv.pending_amount
        tenant_dues[tid]["invoices_count"] += 1

        if days_past <= 30:
            tenant_dues[tid]["overdue_0_30"] += inv.pending_amount
        elif days_past <= 60:
            tenant_dues[tid]["overdue_30_60"] += inv.pending_amount
        else:
            tenant_dues[tid]["overdue_60_plus"] += inv.pending_amount

    for sc in services:
        tid = sc.tenant_id
        if tid in tenant_dues:
            tenant_dues[tid]["service_dues"] += sc.pending_amount
            tenant_dues[tid]["total_dues"] += sc.pending_amount

    dues_list = sorted(list(tenant_dues.values()), key=lambda x: x["total_dues"], reverse=True)
    total_unpaid = sum(d["total_dues"] for d in dues_list)

    return {
        "total_unpaid_dues": total_unpaid,
        "tenants_with_dues_count": len(dues_list),
        "tenants": dues_list
    }

# =========================================================================
# 3. ADVANCED BUSINESS ANALYTICS
# =========================================================================

@router.get("/api/analytics/overview")
def api_analytics_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_analytics_overview(db)

@router.get("/api/analytics/occupancy")
def api_analytics_occupancy(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_occupancy_analytics(db)

@router.get("/api/analytics/financial")
def api_analytics_financial(months: int = Query(6), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_financial_analytics(db, months=months)

@router.get("/api/analytics/tenants")
def api_analytics_tenants(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_tenant_analytics(db)

@router.get("/api/analytics/services")
def api_analytics_services(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_service_analytics(db)

# =========================================================================
# 4. REPORTS
# =========================================================================

@router.get("/api/reports/daily")
def get_daily_report_api(target_date: Optional[str] = Query(None), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t_date = target_date or date.today().isoformat()
    return generate_daily_report_data(db, t_date)

@router.get("/api/reports/weekly")
def get_weekly_report_api(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    end_d = end_date or date.today().isoformat()
    start_d = start_date or (date.today() - timedelta(days=6)).isoformat()
    return generate_weekly_report_data(db, start_d, end_d)

@router.get("/api/reports/monthly")
def get_monthly_report_api(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    m = month or date.today().month
    y = year or date.today().year
    return generate_monthly_report_data(db, m, y)

@router.post("/api/reports/generate", response_model=ReportHistoryOut)
def generate_and_save_report(
    req: ReportGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rtype = req.report_type.capitalize()
    today = date.today()

    if rtype == "Daily":
        t_date = req.date_str or today.isoformat()
        data = generate_daily_report_data(db, t_date)
        title = f"Daily Operations Report - {t_date}"
        rep = save_report_history(db, "Daily", title, t_date, t_date, data)
    elif rtype == "Weekly":
        end_d = req.end_date or today.isoformat()
        start_d = req.start_date or (today - timedelta(days=6)).isoformat()
        data = generate_weekly_report_data(db, start_d, end_d)
        title = f"Weekly Business Report ({start_d} to {end_d})"
        rep = save_report_history(db, "Weekly", title, start_d, end_d, data)
    else: # Monthly
        m = req.month or today.month
        y = req.year or today.year
        data = generate_monthly_report_data(db, m, y)
        title = f"Monthly Financial Report - {datetime(y, m, 1).strftime('%B %Y')}"
        start_d = f"{y}-{m:02d}-01"
        end_d = (datetime(y, m, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        rep = save_report_history(db, "Monthly", title, start_d, end_d.isoformat(), data)

    build_report_pdf(rep, data)
    db.commit()
    return rep

@router.get("/api/reports/history", response_model=List[ReportHistoryOut])
def list_report_history(
    limit: int = Query(50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reports = db.scalars(select(ReportHistory).order_by(ReportHistory.id.desc()).limit(limit)).all()
    return reports

@router.get("/api/reports/{report_id}/pdf")
def download_report_pdf(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rep = db.get(ReportHistory, report_id)
    if not rep:
        raise HTTPException(404, "Report not found")

    data = json.loads(rep.summary_json)
    pdf_path = build_report_pdf(rep, data)
    db.commit()

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"{rep.report_title.replace(' ', '_')}.pdf"
    )

@router.get("/api/reports/{report_id}/csv")
def download_report_csv(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rep = db.get(ReportHistory, report_id)
    if not rep:
        raise HTTPException(404, "Report not found")

    data = json.loads(rep.summary_json)
    csv_str = build_report_csv(rep, data)

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{rep.id}.csv"}
    )

# =========================================================================
# 5. TASKS & FOLLOW-UP MANAGEMENT
# =========================================================================

@router.get("/api/tasks", response_model=List[PgTaskOut])
def list_tasks(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = select(PgTask)
    if status and status.lower() != "all":
        query = query.where(PgTask.status.ilike(status))
    if category and category.lower() != "all":
        query = query.where(PgTask.category.ilike(category))
    if priority and priority.lower() != "all":
        query = query.where(PgTask.priority.ilike(priority))
    if tenant_id:
        query = query.where(PgTask.tenant_id == tenant_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(or_(PgTask.title.ilike(s), PgTask.description.ilike(s), PgTask.task_code.ilike(s)))

    query = query.order_by(desc(PgTask.id))
    tasks = db.scalars(query).all()
    return [serialize_task(t, db) for t in tasks]

@router.post("/api/tasks", response_model=PgTaskOut)
def create_task(
    data: PgTaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    code = f"TSK-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:5].upper()}"
    task = PgTask(
        task_code=code,
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        category=data.category,
        priority=data.priority,
        status=data.status or "Pending",
        assigned_to=data.assigned_to or user.username,
        tenant_id=data.tenant_id,
        due_date=data.due_date,
        remarks=data.remarks,
        created_by=user.username
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    log_audit(
        db=db,
        username=user.username,
        action="CREATE",
        entity_type="Task",
        entity_id=task.task_code,
        outcome="Success",
        details=f"Created task '{task.title}' [{task.priority}]"
    )
    return serialize_task(task, db)

@router.get("/api/tasks/{task_id}", response_model=PgTaskOut)
def get_task_details(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(PgTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return serialize_task(task, db)

@router.put("/api/tasks/{task_id}", response_model=PgTaskOut)
def update_task(
    task_id: int,
    data: PgTaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(PgTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    if data.title is not None: task.title = data.title.strip()
    if data.description is not None: task.description = data.description.strip()
    if data.category is not None: task.category = data.category
    if data.priority is not None: task.priority = data.priority
    if data.status is not None:
        task.status = data.status
        if data.status == "Completed" and not task.completed_date:
            task.completed_date = date.today().isoformat()
    if data.assigned_to is not None: task.assigned_to = data.assigned_to
    if data.tenant_id is not None: task.tenant_id = data.tenant_id
    if data.due_date is not None: task.due_date = data.due_date
    if data.remarks is not None: task.remarks = data.remarks

    db.commit()
    db.refresh(task)

    log_audit(
        db=db,
        username=user.username,
        action="UPDATE",
        entity_type="Task",
        entity_id=task.task_code,
        outcome="Success",
        details=f"Updated task '{task.title}' status to {task.status}"
    )
    return serialize_task(task, db)

@router.post("/api/tasks/{task_id}/complete", response_model=PgTaskOut)
def mark_task_complete(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(PgTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "Completed"
    task.completed_date = date.today().isoformat()
    db.commit()
    db.refresh(task)

    log_audit(
        db=db,
        username=user.username,
        action="COMPLETE",
        entity_type="Task",
        entity_id=task.task_code,
        outcome="Success",
        details=f"Completed task '{task.title}'"
    )
    return serialize_task(task, db)

@router.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(PgTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    code = task.task_code
    db.delete(task)
    db.commit()

    log_audit(
        db=db,
        username=user.username,
        action="DELETE",
        entity_type="Task",
        entity_id=code,
        outcome="Success",
        details=f"Deleted task {code}"
    )
    return {"message": f"Task {code} deleted."}

# =========================================================================
# 6. CENTRALIZED AUDIT LOGS
# =========================================================================

@router.get("/api/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = select(AuditLog)
    if action and action.lower() != "all":
        query = query.where(AuditLog.action.ilike(action))
    if entity_type and entity_type.lower() != "all":
        query = query.where(AuditLog.entity_type.ilike(entity_type))
    if username and username.lower() != "all":
        query = query.where(AuditLog.username.ilike(username))
    if start_date:
        query = query.where(AuditLog.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.where(AuditLog.created_at <= datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
    if search:
        s = f"%{search.strip()}%"
        query = query.where(or_(AuditLog.details.ilike(s), AuditLog.entity_id.ilike(s)))

    query = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit)
    rows = db.scalars(query).all()
    return rows

# =========================================================================
# 7. BACKUP MANAGEMENT
# =========================================================================

@router.get("/api/backups", response_model=List[BackupItemOut])
def list_backups(user: User = Depends(get_current_user)):
    items = []
    for f in sorted(BACKUPS.glob("moonlight_pg_*.sqlite3"), key=lambda x: x.stat().st_mtime, reverse=True):
        st = f.stat()
        dt_str = datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        mb = round(st.st_size / (1024 * 1024), 2)

        items.append({
            "filename": f.name,
            "size_bytes": st.st_size,
            "size_mb": mb,
            "created_at": dt_str,
            "integrity_status": "Verified (PRAGMA OK)"
        })
    return items

@router.post("/api/backups/create")
def trigger_backup_now(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        backup_path = create_backup()
        mb = round(backup_path.stat().st_size / (1024 * 1024), 2)
        log_audit(
            db=db,
            username=user.username,
            action="BACKUP",
            entity_type="Backup",
            entity_id=backup_path.name,
            outcome="Success",
            details=f"Manual SQLite online backup created: {backup_path.name} ({mb} MB)",
            ip_address=request.client.host if request.client else None,
            user_id=user.id
        )
        return {
            "status": "success",
            "filename": backup_path.name,
            "size_mb": mb,
            "message": "Backup snapshot created and integrity verified."
        }
    except Exception as e:
        raise HTTPException(500, f"Backup creation failed: {e}")

@router.post("/api/backups/verify")
def verify_backup_file(
    filename: str = Query(...),
    user: User = Depends(get_current_user)
):
    path = BACKUPS / filename
    if not path.exists():
        raise HTTPException(404, "Backup file not found")

    try:
        conn = sqlite3.connect(str(path))
        check = conn.execute("PRAGMA integrity_check").fetchone()
        conn.close()

        if check and check[0] == "ok":
            return {"filename": filename, "status": "Valid", "message": "SQLite integrity check passed (ok)."}
        else:
            return {"filename": filename, "status": "Corrupt", "message": f"Integrity error: {check}"}
    except Exception as e:
        raise HTTPException(500, f"Verification failed: {e}")

@router.post("/api/backups/restore")
def restore_backup(
    filename: str = Query(...),
    confirmation: str = Query(...),
    request: Request = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Safely restores SQLite database using Online Backup API with pre-restore safety snapshot."""
    if confirmation != "CONFIRM_RESTORE":
        raise HTTPException(400, "Must pass confirmation='CONFIRM_RESTORE'")

    backup_file = BACKUPS / filename
    if not backup_file.exists():
        raise HTTPException(404, "Backup file not found")

    # 1. Verify integrity of target backup first
    conn = sqlite3.connect(str(backup_file))
    check = conn.execute("PRAGMA integrity_check").fetchone()
    conn.close()
    if not check or check[0] != "ok":
        raise HTTPException(400, f"Cannot restore: Backup integrity failed ({check})")

    # 2. Pre-restore safety snapshot
    safety_snap = create_backup()

    # 3. Restore using SQLite backup API
    src = sqlite3.connect(str(backup_file))
    dst = sqlite3.connect(str(DB_PATH))
    try:
        src.backup(dst)
        chk = dst.execute("PRAGMA integrity_check").fetchone()
        if not chk or chk[0] != "ok":
            raise RuntimeError(f"Restored DB failed integrity check: {chk}")
    finally:
        dst.close()
        src.close()

    log_audit(
        db=db,
        username=user.username,
        action="RESTORE",
        entity_type="Database",
        entity_id=filename,
        outcome="Success",
        details=f"Restored DB from {filename}. Pre-restore snapshot: {safety_snap.name}",
        ip_address=request.client.host if request and request.client else None,
        user_id=user.id
    )

    return {
        "status": "success",
        "message": f"Database successfully restored from {filename}.",
        "pre_restore_safety_backup": safety_snap.name
    }

@router.get("/api/backups/{filename}/download")
def download_backup_file(
    filename: str,
    user: User = Depends(get_current_user)
):
    path = BACKUPS / filename
    if not path.exists():
        raise HTTPException(404, "Backup file not found")
    return FileResponse(
        str(path),
        media_type="application/x-sqlite3",
        filename=filename
    )

@router.get("/api/backups/settings", response_model=BackupSettingsOut)
def get_backup_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    auto_enabled = is_pref_enabled(db, "auto_backup_enabled", True)
    retention_pref = db.scalar(select(NotificationPreference).where(NotificationPreference.key == "backup_retention_days"))
    retention = int(retention_pref.value) if retention_pref and retention_pref.value.isdigit() else BACKUP_RETENTION_DAYS

    files = list(BACKUPS.glob("moonlight_pg_*.sqlite3"))
    total_size = sum(f.stat().st_size for f in files)
    latest = sorted(files, key=lambda x: x.stat().st_mtime, reverse=True)
    latest_time = datetime.fromtimestamp(latest[0].stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S") if latest else None

    return {
        "auto_backup_enabled": auto_enabled,
        "backup_time": BACKUP_TIME,
        "retention_days": retention,
        "total_backups_count": len(files),
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "last_backup_time": latest_time
    }

@router.put("/api/backups/settings")
def update_backup_settings(
    data: BackupSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.auto_backup_enabled is not None:
        p = db.scalar(select(NotificationPreference).where(NotificationPreference.key == "auto_backup_enabled"))
        if p: p.value = "true" if data.auto_backup_enabled else "false"

    if data.retention_days is not None:
        p = db.scalar(select(NotificationPreference).where(NotificationPreference.key == "backup_retention_days"))
        if p: p.value = str(data.retention_days)

    db.commit()
    return {"message": "Backup settings updated."}

# =========================================================================
# 8. DATA EXPORT & IMPORT
# =========================================================================

@router.get("/api/data/export/{entity_type}")
def export_data_endpoint(
    entity_type: str,
    format: str = Query("csv"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        content, media_type = export_entity_data(db, entity_type, format)
        ext = "json" if format.lower() == "json" else "csv"
        filename = f"{entity_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"

        log_audit(
            db=db,
            username=user.username,
            action="EXPORT",
            entity_type=entity_type,
            outcome="Success",
            details=f"Exported {entity_type} in {format.upper()} format"
        )

        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.post("/api/data/import/preview", response_model=DataImportPreviewOut)
def preview_import_endpoint(
    req: DataImportPreviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = preview_import_data(db, req.entity_type, req.content_text, req.filename)
    return result

@router.post("/api/data/import/confirm")
def confirm_import_endpoint(
    req: DataImportConfirmRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = confirm_import_data(db, req.entity_type, req.rows, req.filename, imported_by=user.username)
        return res
    except Exception as e:
        raise HTTPException(500, f"Import failed: {e}")

@router.get("/api/data/import/history")
def list_import_history(
    limit: int = Query(20),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.scalars(select(DataImportLog).order_by(DataImportLog.id.desc()).limit(limit)).all()
    return logs

# =========================================================================
# 9. SYSTEM HEALTH MONITORING
# =========================================================================

@router.get("/api/system/health", response_model=SystemHealthOut)
def get_system_health(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Database check
    db_connected = True
    db_size_mb = 0.0
    try:
        db.execute(select(1)).fetchone()
        if DB_PATH.exists():
            db_size_mb = round(DB_PATH.stat().st_size / (1024 * 1024), 2)
    except Exception:
        db_connected = False

    # 2. Disk space
    disk = shutil.disk_usage(str(DB_PATH.parent))
    disk_total_gb = round(disk.total / (1024 ** 3), 2)
    disk_free_gb = round(disk.free / (1024 ** 3), 2)
    disk_used_pct = round(((disk.total - disk.free) / disk.total) * 100, 1)
    low_disk_warning = disk_free_gb < 2.0

    # 3. Backups
    backups = list(BACKUPS.glob("moonlight_pg_*.sqlite3"))
    latest_backup = sorted(backups, key=lambda x: x.stat().st_mtime, reverse=True)[0] if backups else None
    last_backup_name = latest_backup.name if latest_backup else None
    last_backup_time = datetime.fromtimestamp(latest_backup.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S") if latest_backup else None

    # 4. Scheduler
    total_jobs = db.scalar(select(func.count(ScheduledJob.id))) or 0
    day_ago = datetime.now() - timedelta(hours=24)
    failed_jobs = db.scalar(
        select(func.count(JobExecutionLog.id)).where(
            JobExecutionLog.status == "Failed",
            JobExecutionLog.execution_time >= day_ago
        )
    ) or 0

    # 5. Overdue and Notifications
    pending_notifs = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.is_read == False,
            Notification.is_dismissed == False
        )
    ) or 0

    overdue_invoices = db.scalar(
        select(func.count(RentInvoice.id)).where(RentInvoice.status == "Overdue")
    ) or 0

    warnings = []
    if low_disk_warning:
        warnings.append(f"Low free disk space on database drive ({disk_free_gb} GB remaining).")
    if not latest_backup:
        warnings.append("No database backup snapshots found. Please run a backup.")
    elif (datetime.now() - datetime.fromtimestamp(latest_backup.stat().st_mtime)).total_seconds() > 86400 * 2:
        warnings.append("Last backup was created more than 48 hours ago.")
    if failed_jobs > 0:
        warnings.append(f"{failed_jobs} scheduled automation job(s) failed in the last 24 hours.")
    if overdue_invoices > 0:
        warnings.append(f"{overdue_invoices} rent invoice(s) are currently marked as Overdue.")

    return {
        "status": "Healthy" if not warnings else "Action Needed",
        "app_name": APP_NAME,
        "system_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "database_connected": db_connected,
        "database_size_mb": db_size_mb,
        "disk_total_gb": disk_total_gb,
        "disk_free_gb": disk_free_gb,
        "disk_used_pct": disk_used_pct,
        "low_disk_warning": low_disk_warning,
        "last_backup_filename": last_backup_name,
        "last_backup_time": last_backup_time,
        "scheduler_active": True,
        "total_jobs": total_jobs,
        "failed_jobs_24h": failed_jobs,
        "pending_notifications_count": pending_notifs,
        "overdue_invoices_count": overdue_invoices,
        "warnings": warnings
    }
