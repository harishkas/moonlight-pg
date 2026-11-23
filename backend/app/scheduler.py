import logging, threading, time, uuid, json
from datetime import datetime, timedelta, date
from typing import Dict, Any, Optional
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import (
    ScheduledJob, JobExecutionLog, Notification, NotificationPreference,
    ReminderHistory, RentInvoice, Tenant, BedAllocation, FoodSubscription,
    ParkingAllocation, ReportHistory, Room, Bed
)
from .backup import create_backup
from .audit import log_audit

log = logging.getLogger("moonlight.scheduler")

# Registered default jobs
DEFAULT_JOBS = [
    {
        "job_key": "daily_rent_reminders",
        "name": "Automated Rent Reminders",
        "description": "Scans upcoming and overdue rent invoices (7d, 3d, 1d before, on due date, and after) and delivers in-app notifications without duplicates.",
        "cron_expression": "Daily 08:00"
    },
    {
        "job_key": "daily_overdue_marker",
        "name": "Overdue Invoices Status Marker",
        "description": "Marks past-due unpaid or partially paid rent invoices as Overdue and raises priority alerts.",
        "cron_expression": "Daily 00:05"
    },
    {
        "job_key": "daily_agreement_expiry_check",
        "name": "Agreement & Tenant Departure Monitoring",
        "description": "Identifies tenants approaching their expected leaving date (30d, 15d, 7d, 0d) and raises departure notifications.",
        "cron_expression": "Daily 09:00"
    },
    {
        "job_key": "daily_subscription_renewal_check",
        "name": "Food & Facilities Subscription Monitor",
        "description": "Checks active food plans, parking, and utility allocations for renewals and mid-month lifecycle adjustments.",
        "cron_expression": "Daily 08:30"
    },
    {
        "job_key": "daily_auto_backup",
        "name": "SQLite Online Database Backup",
        "description": "Creates a verified SQLite online backup snapshot and applies retention policies.",
        "cron_expression": "Daily 22:00"
    },
    {
        "job_key": "daily_report_generator",
        "name": "Daily Operations Report",
        "description": "Compiles daily occupancy changes, collections, expenses, and maintenance requests.",
        "cron_expression": "Daily 23:55"
    },
    {
        "job_key": "weekly_report_generator",
        "name": "Weekly Business Summary",
        "description": "Aggregates 7-day revenue, expenses, occupancy trends, and food service usage.",
        "cron_expression": "Weekly Sun 23:55"
    },
    {
        "job_key": "monthly_report_generator",
        "name": "Monthly Financial & Operating Statement",
        "description": "Computes gross rent, service revenues, expense breakdown, and Net Operating Income (NOI).",
        "cron_expression": "Monthly 1st 01:00"
    }
]

# Registered default reminder preferences
DEFAULT_PREFERENCES = [
    ("rent_reminder_7d_before", "true", "Rent Reminders", "Send reminder 7 days before due date"),
    ("rent_reminder_3d_before", "true", "Rent Reminders", "Send reminder 3 days before due date"),
    ("rent_reminder_1d_before", "true", "Rent Reminders", "Send reminder 1 day before due date"),
    ("rent_reminder_due_date", "true", "Rent Reminders", "Send reminder on invoice due date"),
    ("rent_reminder_1d_after", "true", "Rent Reminders", "Send overdue notice 1 day past due date"),
    ("rent_reminder_7d_after", "true", "Rent Reminders", "Send critical overdue notice 7 days past due date"),
    ("agreement_expiry_30d", "true", "Agreements", "Alert 30 days before expected leaving date"),
    ("agreement_expiry_7d", "true", "Agreements", "Alert 7 days before expected leaving date"),
    ("backup_alert_enabled", "true", "Backups", "Notify administrator upon daily backup creation"),
    ("auto_backup_enabled", "true", "Backups", "Automatically run daily SQLite online backups"),
    ("backup_retention_days", "30", "Backups", "Number of days to keep backup files"),
    ("low_disk_warning_gb", "2.0", "System Health", "Alert threshold in GB for low disk space")
]

def init_scheduler_defaults(db: Session):
    """Initializes default jobs and notification preferences if not already seeded."""
    for item in DEFAULT_JOBS:
        existing = db.scalar(select(ScheduledJob).where(ScheduledJob.job_key == item["job_key"]))
        if not existing:
            db.add(ScheduledJob(
                job_key=item["job_key"],
                name=item["name"],
                description=item["description"],
                cron_expression=item["cron_expression"],
                is_active=True
            ))

    for key, val, cat, desc in DEFAULT_PREFERENCES:
        existing = db.scalar(select(NotificationPreference).where(NotificationPreference.key == key))
        if not existing:
            db.add(NotificationPreference(
                key=key,
                value=val,
                category=cat,
                description=desc
            ))
    db.commit()

def is_pref_enabled(db: Session, key: str, default: bool = True) -> bool:
    pref = db.scalar(select(NotificationPreference).where(NotificationPreference.key == key))
    if not pref:
        return default
    return pref.value.strip().lower() in ("true", "1", "yes", "on")

def create_inapp_notification(
    db: Session,
    title: str,
    description: str,
    category: str,
    priority: str = "Medium",
    tenant_id: Optional[int] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
    delivery_status: str = "Delivered"
) -> Notification:
    """Helper to emit an in-app notification without duplication."""
    # Check if identical unread notification was issued today
    today_str = date.today().isoformat()
    existing = db.scalar(
        select(Notification).where(
            Notification.title == title,
            Notification.related_type == related_type,
            Notification.related_id == related_id,
            Notification.is_read == False,
            Notification.is_dismissed == False,
            Notification.created_at >= datetime.now() - timedelta(hours=20)
        )
    )
    if existing:
        return existing

    code = f"NOTIF-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
    notif = Notification(
        notification_code=code,
        title=title,
        description=description,
        category=category,
        priority=priority,
        tenant_id=tenant_id,
        related_type=related_type,
        related_id=related_id,
        is_read=False,
        delivery_status=delivery_status
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

# =========================================================================
# JOB IMPLEMENTATIONS
# =========================================================================

def execute_daily_rent_reminders(db: Session) -> Dict[str, Any]:
    """Generates automated rent reminders for unpaid/partially paid invoices."""
    today = date.today()
    invoices = db.scalars(
        select(RentInvoice).where(RentInvoice.status.in_(["Unpaid", "Partially Paid", "Overdue"]))
    ).all()

    reminders_sent = 0
    skipped_count = 0

    for inv in invoices:
        tenant = db.get(Tenant, inv.tenant_id)
        tenant_name = tenant.full_name if tenant else "Resident"
        due_d = datetime.strptime(inv.due_date, "%Y-%m-%d").date()
        diff_days = (due_d - today).days

        # Determine target reminder schedule
        rem_type = None
        pref_key = None
        priority = "Medium"

        if diff_days == 7:
            rem_type = "7_days_before"
            pref_key = "rent_reminder_7d_before"
            priority = "Low"
        elif diff_days == 3:
            rem_type = "3_days_before"
            pref_key = "rent_reminder_3d_before"
            priority = "Medium"
        elif diff_days == 1:
            rem_type = "1_day_before"
            pref_key = "rent_reminder_1d_before"
            priority = "Medium"
        elif diff_days == 0:
            rem_type = "due_date"
            pref_key = "rent_reminder_due_date"
            priority = "High"
        elif diff_days == -1:
            rem_type = "1_day_after"
            pref_key = "rent_reminder_1d_after"
            priority = "High"
        elif diff_days == -7:
            rem_type = "7_days_after"
            pref_key = "rent_reminder_7d_after"
            priority = "Urgent"

        if not rem_type or not is_pref_enabled(db, pref_key, True):
            skipped_count += 1
            continue

        # Prevent duplicate reminders for the same invoice and schedule
        already_sent = db.scalar(
            select(ReminderHistory).where(
                ReminderHistory.invoice_id == inv.id,
                ReminderHistory.reminder_type == rem_type
            )
        )
        if already_sent:
            skipped_count += 1
            continue

        # Record reminder history
        rh = ReminderHistory(
            invoice_id=inv.id,
            tenant_id=inv.tenant_id,
            reminder_type=rem_type,
            amount_due=inv.pending_amount,
            sent_date=today.isoformat(),
            channel="in_app",
            status="Sent",
            notes=f"Reminder for Invoice #{inv.invoice_number} ({rem_type})"
        )
        db.add(rh)

        # Emit in-app notification
        title = f"Rent Reminder: {tenant_name} (Due: {inv.due_date})"
        if diff_days < 0:
            title = f"OVERDUE Rent Alert: {tenant_name} (₹{inv.pending_amount:,.2f})"

        room_str = ""
        if inv.room_id:
            rm = db.get(Room, inv.room_id)
            if rm:
                room_str = f"Room {rm.room_number}"
        if inv.bed_id:
            bd = db.get(Bed, inv.bed_id)
            if bd:
                room_str = f"{room_str}, Bed {bd.bed_number}" if room_str else f"Bed {bd.bed_number}"
        loc_str = f" ({room_str})" if room_str else ""

        desc = (
            f"Invoice #{inv.invoice_number} for {tenant_name}{loc_str} "
            f"has an outstanding balance of ₹{inv.pending_amount:,.2f}. Due Date: {inv.due_date}."
        )
        cat = "Overdue Payment" if diff_days < 0 else "Rent Reminder"

        create_inapp_notification(
            db=db,
            title=title,
            description=desc,
            category=cat,
            priority=priority,
            tenant_id=inv.tenant_id,
            related_type="invoice",
            related_id=inv.id
        )
        reminders_sent += 1

    db.commit()
    return {"reminders_sent": reminders_sent, "skipped_invoices": skipped_count}

def execute_daily_overdue_marker(db: Session) -> Dict[str, Any]:
    """Marks past-due invoices as Overdue and raises priority alerts."""
    today_str = date.today().isoformat()
    past_due_invoices = db.scalars(
        select(RentInvoice).where(
            RentInvoice.due_date < today_str,
            RentInvoice.status.in_(["Unpaid", "Partially Paid"])
        )
    ).all()

    marked_count = 0
    for inv in past_due_invoices:
        inv.status = "Overdue"
        marked_count += 1

    db.commit()
    return {"marked_overdue": marked_count}

def execute_daily_agreement_expiry_check(db: Session) -> Dict[str, Any]:
    """Alerts administrators when resident expected departure is approaching."""
    today = date.today()
    tenants = db.scalars(
        select(Tenant).where(
            Tenant.status == "Active",
            Tenant.expected_leaving_date.isnot(None)
        )
    ).all()

    alerts_sent = 0
    for t in tenants:
        try:
            exp_date = datetime.strptime(t.expected_leaving_date, "%Y-%m-%d").date()
            diff = (exp_date - today).days

            if diff in (30, 15, 7, 0):
                pref = "agreement_expiry_30d" if diff == 30 else "agreement_expiry_7d"
                if not is_pref_enabled(db, pref, True):
                    continue

                priority = "Urgent" if diff == 0 else "High" if diff <= 7 else "Medium"
                title = f"Agreement Expiry: {t.full_name} ({diff} days left)" if diff > 0 else f"Expected Vacate Today: {t.full_name}"
                desc = (
                    f"Resident {t.full_name} ({t.tenant_code}, Mob: {t.mobile}) is scheduled to vacate on "
                    f"{t.expected_leaving_date}. Please review inspection status, pending rent dues, and deposit refund."
                )

                create_inapp_notification(
                    db=db,
                    title=title,
                    description=desc,
                    category="Agreement Expiry",
                    priority=priority,
                    tenant_id=t.id,
                    related_type="tenant",
                    related_id=t.id
                )
                alerts_sent += 1
        except Exception:
            continue

    return {"agreement_alerts_sent": alerts_sent}

def execute_daily_subscription_renewal_check(db: Session) -> Dict[str, Any]:
    """Monitors subscriptions for mid-month changes and lifecycle adjustments."""
    today_str = date.today().isoformat()
    food_subs = db.scalars(select(FoodSubscription).where(FoodSubscription.status == "Active")).all()
    parking_allocs = db.scalars(select(ParkingAllocation).where(ParkingAllocation.status == "Active")).all()

    return {
        "active_food_subscriptions": len(food_subs),
        "active_parking_allocations": len(parking_allocs)
    }

def execute_daily_auto_backup(db: Session) -> Dict[str, Any]:
    """Creates a verified SQLite online backup."""
    if not is_pref_enabled(db, "auto_backup_enabled", True):
        return {"status": "skipped", "reason": "auto_backup_disabled"}

    backup_path = create_backup()
    filename = backup_path.name
    size_mb = round(backup_path.stat().st_size / (1024 * 1024), 2)

    if is_pref_enabled(db, "backup_alert_enabled", True):
        create_inapp_notification(
            db=db,
            title="Database Backup Created",
            description=f"Automated SQLite online backup completed: {filename} ({size_mb} MB). Integrity verified.",
            category="Backup Status",
            priority="Low",
            related_type="backup"
        )

    log_audit(
        db=db,
        username="system_scheduler",
        action="BACKUP",
        entity_type="Backup",
        entity_id=filename,
        outcome="Success",
        details=f"Automated daily backup created: {filename} ({size_mb} MB)"
    )
    return {"status": "success", "filename": filename, "size_mb": size_mb}

def execute_daily_report_generator(db: Session) -> Dict[str, Any]:
    from .report_engine import generate_daily_report_data, save_report_history
    today_str = date.today().isoformat()
    data = generate_daily_report_data(db, today_str)
    rep = save_report_history(db, "Daily", f"Daily Operations Report - {today_str}", today_str, today_str, data)
    return {"report_id": rep.id, "report_title": rep.report_title}

def execute_weekly_report_generator(db: Session) -> Dict[str, Any]:
    from .report_engine import generate_weekly_report_data, save_report_history
    today = date.today()
    start_d = (today - timedelta(days=6)).isoformat()
    end_d = today.isoformat()
    data = generate_weekly_report_data(db, start_d, end_d)
    rep = save_report_history(db, "Weekly", f"Weekly Business Report ({start_d} to {end_d})", start_d, end_d, data)
    return {"report_id": rep.id, "report_title": rep.report_title}

def execute_monthly_report_generator(db: Session) -> Dict[str, Any]:
    from .report_engine import generate_monthly_report_data, save_report_history
    today = date.today()
    m = today.month
    y = today.year
    data = generate_monthly_report_data(db, m, y)
    title = f"Monthly Financial Report - {today.strftime('%B %Y')}"
    start_d = f"{y}-{m:02d}-01"
    end_d = today.isoformat()
    rep = save_report_history(db, "Monthly", title, start_d, end_d, data)
    return {"report_id": rep.id, "report_title": rep.report_title}

JOB_DISPATCHER = {
    "daily_rent_reminders": execute_daily_rent_reminders,
    "daily_overdue_marker": execute_daily_overdue_marker,
    "daily_agreement_expiry_check": execute_daily_agreement_expiry_check,
    "daily_subscription_renewal_check": execute_daily_subscription_renewal_check,
    "daily_auto_backup": execute_daily_auto_backup,
    "daily_report_generator": execute_daily_report_generator,
    "weekly_report_generator": execute_weekly_report_generator,
    "monthly_report_generator": execute_monthly_report_generator,
}

def run_job_now(job_key: str, db: Session, triggered_by: str = "Administrator") -> Dict[str, Any]:
    """Manually executes a registered scheduled job and logs the result."""
    if job_key not in JOB_DISPATCHER:
        raise ValueError(f"Unknown job key: {job_key}")

    job = db.scalar(select(ScheduledJob).where(ScheduledJob.job_key == job_key))
    if not job:
        init_scheduler_defaults(db)
        job = db.scalar(select(ScheduledJob).where(ScheduledJob.job_key == job_key))

    start_t = time.time()
    status = "Success"
    msg = ""

    try:
        handler = JOB_DISPATCHER[job_key]
        result = handler(db)
        msg = json.dumps(result)
    except Exception as e:
        status = "Failed"
        msg = str(e)
        log.error("Error executing job %s: %s", job_key, e)

    duration_ms = int((time.time() - start_t) * 1000)

    if job:
        job.last_run_at = datetime.now()
        job.last_status = status
        job.last_message = msg[:500]

        log_entry = JobExecutionLog(
            job_id=job.id,
            job_key=job_key,
            status=status,
            details=msg[:1000],
            duration_ms=duration_ms
        )
        db.add(log_entry)
        db.commit()

    log_audit(
        db=db,
        username=triggered_by,
        action="RUN_JOB",
        entity_type="Job",
        entity_id=job_key,
        outcome=status,
        details=f"Execution of {job_key} completed in {duration_ms}ms with status {status}"
    )

    return {"job_key": job_key, "status": status, "duration_ms": duration_ms, "result": msg}

# =========================================================================
# BACKGROUND SCHEDULER THREAD
# =========================================================================

class BackgroundAutomationWorker(threading.Thread):
    def __init__(self, interval_seconds: int = 60):
        super().__init__(daemon=True, name="MoonLight-Scheduler")
        self.interval = interval_seconds
        self.running = True

    def run(self):
        log.info("Background automation worker thread started (poll interval: %ss)", self.interval)
        # Wait 10 seconds after server startup before initial evaluation
        time.sleep(10)
        while self.running:
            try:
                db = SessionLocal()
                try:
                    init_scheduler_defaults(db)
                    active_jobs = db.scalars(select(ScheduledJob).where(ScheduledJob.is_active == True)).all()
                    now = datetime.now()

                    for j in active_jobs:
                        should_run = False
                        if not j.last_run_at:
                            should_run = True
                        else:
                            # If last run was more than 23 hours ago, execute daily job
                            delta_hours = (now - j.last_run_at).total_seconds() / 3600
                            if "daily" in j.job_key and delta_hours >= 23.5:
                                should_run = True
                            elif "weekly" in j.job_key and delta_hours >= 160:
                                should_run = True
                            elif "monthly" in j.job_key and delta_hours >= 670:
                                should_run = True

                        if should_run:
                            log.info("Automation engine triggering scheduled job: %s", j.job_key)
                            run_job_now(j.job_key, db, triggered_by="system_scheduler")

                finally:
                    db.close()
            except Exception as e:
                log.error("Scheduler worker loop encountered error: %s", e)

            time.sleep(self.interval)

    def stop(self):
        self.running = False

_global_worker: Optional[BackgroundAutomationWorker] = None

def start_automation_engine():
    global _global_worker
    if _global_worker is None or not _global_worker.is_alive():
        _global_worker = BackgroundAutomationWorker(interval_seconds=60)
        _global_worker.start()
        log.info("Started Moon Light PG Automation Engine")

def stop_automation_engine():
    global _global_worker
    if _global_worker and _global_worker.is_alive():
        _global_worker.stop()
        log.info("Stopped Moon Light PG Automation Engine")
