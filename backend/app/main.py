import logging, threading, time, calendar, csv, io, uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.orm import Session
from .config import APP_NAME, COOKIE_SECURE, BACKUP_TIME, LOGS, RECEIPTS, BASE
from .database import Base, engine, get_db, SessionLocal
from .models import (
    User, Tenant, Room, Bed, BedAllocation,
    RentInvoice, Payment, Deposit, DepositTransaction,
    Expense, Receipt, FinancialAuditLog,
    FoodPlan, FoodSubscription, MealRecord,
    WifiService, WifiSubscription,
    ParkingSlot, ParkingAllocation,
    AcSubscription,
    ElectricityMeter, ElectricityReading,
    ServiceCatalog, TenantServiceSubscription,
    ServiceCharge, ServiceAuditLog,
    Notification, PgTask
)
from .schemas import (
    TenantCreate, TenantUpdate, TenantOut, TenantDetailOut, AllocationBrief,
    RoomCreate, RoomUpdate, RoomOut,
    BedCreate, BedUpdate, BedOut,
    AllocationCreate, AllocationVacate, AllocationOut,
    DashboardOut, RoomOverviewItem,
    RentGenerateRequest, RentAdjustRequest, InvoiceOut, PaymentSummaryBrief,
    PaymentCreate, PaymentCancelRequest, PaymentOut,
    DepositCreate, DepositAdjustRequest, DepositRefundRequest, DepositOut, DepositTransactionOut,
    ExpenseCreate, ExpenseUpdate, ExpenseOut,
    ReceiptOut,
    FinancialDashboardOut, CategoryExpenseItem,
    FoodPlanCreate, FoodPlanUpdate, FoodPlanOut,
    FoodSubscriptionCreate, FoodSubscriptionUpdate, FoodSubscriptionOut,
    MealRecordCreate, MealRecordOut, DailyMealSummaryOut,
    WifiServiceCreate, WifiServiceUpdate, WifiServiceOut,
    WifiSubscriptionCreate, WifiSubscriptionOut,
    ParkingSlotCreate, ParkingSlotUpdate, ParkingSlotOut,
    ParkingAllocationCreate, ParkingAllocationOut, ParkingReleaseRequest,
    AcSubscriptionCreate, AcSubscriptionOut,
    ElectricityMeterCreate, ElectricityMeterUpdate, ElectricityMeterOut,
    ElectricityReadingCreate, ElectricityReadingOut,
    ServiceCatalogCreate, ServiceCatalogUpdate, ServiceCatalogOut,
    TenantServiceSubCreate, TenantServiceSubOut,
    GenerateServiceBillingRequest, ServiceChargeOut, ServicePaymentRequest,
    ServicesDashboardOut
)
from .security import verify_password, make_session, read_session, hash_password
from .init_users import init_system_users
from .backup import create_backup
from .seed import seed_initial_data
from .receipt_generator import generate_pdf_receipt, generate_pdf_service_statement
from .phase6_router import router as phase6_router
from .scheduler import start_automation_engine, init_scheduler_defaults
from .audit import log_audit

logging.basicConfig(filename=LOGS / "application.log", level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("moonlight")

app = FastAPI(title=APP_NAME, docs_url="/api/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- Role-Based Access Control (RBAC) Interceptor Middleware ---
@app.middleware("http")
async def role_access_middleware(request: Request, call_next):
    # Enforce write restrictions on state-modifying requests
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        path = request.url.path
        # Allow login, logout, docs, and report generation preview
        if path not in ["/api/auth/login", "/api/auth/logout", "/docs", "/openapi.json", "/api/reports/generate"]:
            token = request.cookies.get("mlpg_session")
            if token:
                user_id = read_session(token)
                if user_id:
                    with SessionLocal() as db:
                        user = db.get(User, user_id)
                        if user and user.role.lower() == "client":
                            log_audit(
                                db,
                                username=user.username,
                                action="DENIED",
                                entity_type="RBAC",
                                outcome="Blocked",
                                details=f"Client '{user.username}' attempted write action {request.method} on {path}",
                                user_id=user.id
                            )
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "Access Denied: Client accounts have View-Only authority. You do not have permission to add, edit, delete, or perform modifications."
                                }
                            )
                        if user and user.role.lower() == "subadmin" and request.method == "DELETE":
                            log_audit(
                                db,
                                username=user.username,
                                action="DENIED",
                                entity_type="RBAC",
                                outcome="Blocked",
                                details=f"Sub-Admin '{user.username}' attempted delete action on {path}",
                                user_id=user.id
                            )
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "Access Denied: Sub-Admin accounts cannot delete records."
                                }
                            )

    return await call_next(request)

app.include_router(phase6_router)

# --- Startup Event ---
@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        try:
            init_system_users(db)
        except Exception:
            logger.exception("System users initialization error")
        try:
            seed_initial_data(db)
        except Exception:
            logger.exception("Initial seeding error or data already exists")
        try:
            init_scheduler_defaults(db)
        except Exception:
            logger.exception("Scheduler defaults init error")
    try:
        create_backup()
    except Exception:
        logger.exception("Startup backup failed")
    try:
        start_automation_engine()
    except Exception:
        logger.exception("Startup automation engine failed")
    threading.Thread(target=backup_scheduler, daemon=True).start()

def backup_scheduler():
    while True:
        try:
            now = datetime.now()
            hh, mm = map(int, BACKUP_TIME.split(":"))
            target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if target <= now:
                target += timedelta(days=1)
            time.sleep(max(1, (target - now).total_seconds()))
            create_backup()
        except Exception:
            logger.exception("Scheduled backup failed")
            time.sleep(60)

# --- Authentication & Permission Dependencies ---
def authenticated_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("mlpg_session")
    user_id = read_session(token) if token else None
    if not user_id:
        raise HTTPException(401, "Please sign in.")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "Session is no longer valid.")
    return user

def require_admin_or_master(user: User = Depends(authenticated_user)):
    if user.role.lower() == "client":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Client accounts have View-Only access. You do not have permission to add, edit, or delete records."
        )
    return user

def require_master(user: User = Depends(authenticated_user)):
    if user.role.lower() not in ["master", "superadmin"]:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Master Control authority required."
        )
    return user

# --- Room Status Helper ---
def update_room_status(db: Session, room_id: int):
    room = db.get(Room, room_id)
    if not room:
        return
    beds = db.scalars(select(Bed).where(Bed.room_id == room_id)).all()
    if not beds:
        room.status = "Available"
        return
    occupied = sum(1 for b in beds if b.status == "Occupied")
    maintenance = sum(1 for b in beds if b.status == "Maintenance")
    total = len(beds)
    if maintenance == total:
        room.status = "Maintenance"
    elif occupied == total:
        room.status = "Full"
    elif occupied > 0:
        room.status = "Partially Occupied"
    else:
        if room.status != "Maintenance":
            room.status = "Available"

# --- Tenant Code Generator ---
def get_next_tenant_code(db: Session) -> str:
    count = db.scalar(select(func.count(Tenant.id))) or 0
    candidate = count + 1
    while db.scalar(select(Tenant.id).where(Tenant.tenant_code == f"TEN-{candidate:04d}")):
        candidate += 1
    return f"TEN-{candidate:04d}"

# --- Voucher Number Generators ---
def get_next_invoice_number(db: Session, year: int, month: int) -> str:
    count = db.scalar(
        select(func.count(RentInvoice.id)).where(RentInvoice.billing_year == year, RentInvoice.billing_month == month)
    ) or 0
    return f"INV-{year}{month:02d}-{(count + 1):04d}"

def get_next_payment_number(db: Session, date_str: str) -> str:
    ym = date_str[:7].replace("-", "")
    count = db.scalar(select(func.count(Payment.id))) or 0
    return f"PAY-{ym}-{(count + 1):04d}"

def get_next_receipt_number(db: Session, date_str: str) -> str:
    ym = date_str[:7].replace("-", "")
    count = db.scalar(select(func.count(Receipt.id))) or 0
    return f"REC-{ym}-{(count + 1):04d}"

def get_next_deposit_number(db: Session, date_str: str) -> str:
    year = date_str[:4]
    count = db.scalar(select(func.count(Deposit.id))) or 0
    return f"DEP-{year}-{(count + 1):04d}"

def get_next_expense_number(db: Session, date_str: str) -> str:
    ym = date_str[:7].replace("-", "")
    count = db.scalar(select(func.count(Expense.id))) or 0
    return f"EXP-{ym}-{(count + 1):04d}"


# ==========================================
# CORE & AUTH ENDPOINTS (Phase 1)
# ==========================================

@app.get("/api/health")
def health():
    return {"status": "ok", "application": APP_NAME, "phase": "Phase 3"}

@app.post("/api/auth/login")
def login(data: dict, response: Response, db: Session = Depends(get_db)):
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        log_audit(db, username=username or "anonymous", action="LOGIN", entity_type="User", outcome="Failed", details="Invalid credentials attempted")
        raise HTTPException(401, "Invalid username or password.")
    response.set_cookie("mlpg_session", make_session(user.id), httponly=True, secure=COOKIE_SECURE,
                        samesite="lax", max_age=43200, path="/")
    logger.info("Login user_id=%s", user.id)
    log_audit(db, username=user.username, action="LOGIN", entity_type="User", entity_id=str(user.id), outcome="Success", details="User signed in successfully", user_id=user.id)
    return {"username": user.username, "role": user.role}

@app.get("/api/auth/me")
def me(user: User = Depends(authenticated_user)):
    return {"username": user.username, "role": user.role}

@app.post("/api/auth/logout")
def logout(response: Response, user: User = Depends(authenticated_user), db: Session = Depends(get_db)):
    log_audit(db, username=user.username, action="LOGOUT", entity_type="User", entity_id=str(user.id), outcome="Success", details="User signed out", user_id=user.id)
    response.delete_cookie("mlpg_session", path="/", httponly=True, samesite="lax")
    return {"status": "signed_out"}

# ==========================================
# USER & ACCESS CONTROL ENDPOINTS
# ==========================================

@app.get("/api/users")
def get_users(user: User = Depends(authenticated_user), db: Session = Depends(get_db)):
    if user.role.lower() == "client":
        raise HTTPException(403, "Access Denied: Client accounts cannot view user accounts.")
    users = db.scalars(select(User).order_by(User.id)).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at) if u.created_at else ""
        }
        for u in users
    ]

@app.post("/api/users")
def create_user(data: dict, user: User = Depends(require_master), db: Session = Depends(get_db)):
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "client")).strip().lower()
    if not username or len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters.")
    if not password or len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if role not in ["master", "admin", "subadmin", "client"]:
        raise HTTPException(400, "Role must be 'master', 'admin', 'subadmin', or 'client'.")
    existing = db.scalar(select(User).where(User.username == username))
    if existing:
        raise HTTPException(400, f"Username '{username}' already exists.")
    new_user = User(username=username, password_hash=hash_password(password), role=role, is_active=True)
    db.add(new_user)
    db.commit()
    log_audit(db, username=user.username, action="CREATE", entity_type="User", entity_id=str(new_user.id),
              outcome="Success", details=f"Created {role} user '{username}'", user_id=user.id)
    return {"message": f"User '{username}' created.", "id": new_user.id}

@app.put("/api/users/{user_id}/password")
def change_password(user_id: int, data: dict, user: User = Depends(require_admin_or_master), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found.")
    if user.role.lower() != "master" and target.role.lower() in ["master", "admin"] and user.id != target.id:
        raise HTTPException(403, "Only Master Control can change administrator passwords.")
    new_password = str(data.get("new_password", ""))
    if not new_password or len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    target.password_hash = hash_password(new_password)
    db.commit()
    log_audit(db, username=user.username, action="UPDATE", entity_type="User", entity_id=str(target.id),
              outcome="Success", details=f"Updated password for user '{target.username}'", user_id=user.id)
    return {"message": f"Password for '{target.username}' updated successfully."}

@app.put("/api/users/{user_id}/status")
def toggle_user_status(user_id: int, user: User = Depends(require_master), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found.")
    if target.username == "master":
        raise HTTPException(400, "Cannot deactivate the Master Control account.")
    target.is_active = not target.is_active
    db.commit()
    log_audit(db, username=user.username, action="UPDATE", entity_type="User", entity_id=str(target.id),
              outcome="Success", details=f"Set user '{target.username}' active={target.is_active}", user_id=user.id)
    return {"message": f"User '{target.username}' is now {'active' if target.is_active else 'inactive'}."}

@app.post("/api/admin/backup")
def manual_backup(user: User = Depends(authenticated_user), db: Session = Depends(get_db)):
    path = create_backup()
    log_audit(db, username=user.username, action="BACKUP", entity_type="Backup", entity_id=path.name, outcome="Success", details=f"Created backup snapshot {path.name}", user_id=user.id)
    return {"status": "created", "filename": path.name}


# ==========================================
# TENANT MANAGEMENT (Phase 2 & Phase 3)
# ==========================================

def serialize_tenant(t: Tenant, db: Session) -> dict:
    active_alloc = db.scalar(
        select(BedAllocation).where(BedAllocation.tenant_id == t.id, BedAllocation.is_active == True)
    )
    alloc_brief = None
    if active_alloc:
        room = db.get(Room, active_alloc.room_id)
        bed = db.get(Bed, active_alloc.bed_id)
        alloc_brief = {
            "id": active_alloc.id,
            "room_id": active_alloc.room_id,
            "room_number": room.room_number if room else "N/A",
            "floor": room.floor if room else 1,
            "bed_id": active_alloc.bed_id,
            "bed_number": bed.bed_number if bed else "N/A",
            "allocation_date": active_alloc.allocation_date,
            "monthly_rent": active_alloc.monthly_rent,
            "is_active": active_alloc.is_active,
            "vacating_date": active_alloc.vacating_date,
            "vacating_reason": active_alloc.vacating_reason,
            "room_inspection_status": active_alloc.room_inspection_status,
            "pending_dues": active_alloc.pending_dues,
            "deposit_refund_status": active_alloc.deposit_refund_status,
            "remarks": active_alloc.remarks,
        }

    # Pending balance across invoices
    pending_sum = db.scalar(
        select(func.sum(RentInvoice.pending_amount)).where(RentInvoice.tenant_id == t.id)
    ) or 0.0

    return {
        "id": t.id,
        "tenant_code": t.tenant_code,
        "full_name": t.full_name,
        "mobile": t.mobile,
        "email": t.email,
        "gender": t.gender,
        "dob": t.dob,
        "permanent_address": t.permanent_address,
        "emergency_contact_name": t.emergency_contact_name,
        "emergency_contact_number": t.emergency_contact_number,
        "occupation": t.occupation,
        "company_or_college": t.company_or_college,
        "joining_date": t.joining_date,
        "expected_leaving_date": t.expected_leaving_date,
        "status": t.status,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "current_allocation": alloc_brief,
        "pending_balance": round(pending_sum, 2)
    }

@app.get("/api/tenants", response_model=List[TenantOut])
def get_tenants(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    order: str = Query("asc"),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Tenant)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                Tenant.full_name.ilike(s),
                Tenant.mobile.ilike(s),
                Tenant.tenant_code.ilike(s),
                Tenant.company_or_college.ilike(s)
            )
        )
    if status and status.lower() != "all":
        query = query.where(Tenant.status.ilike(status))

    sort_col = Tenant.full_name
    if sort_by == "date":
        sort_col = Tenant.joining_date
    elif sort_by == "code":
        sort_col = Tenant.tenant_code

    query = query.order_by(desc(sort_col) if order.lower() == "desc" else asc(sort_col))
    tenants = db.scalars(query).all()
    return [serialize_tenant(t, db) for t in tenants]

@app.post("/api/tenants", response_model=TenantOut)
def create_tenant(
    data: TenantCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    code = get_next_tenant_code(db)
    tenant = Tenant(
        tenant_code=code,
        full_name=data.full_name.strip(),
        mobile=data.mobile.strip(),
        email=data.email.strip() if data.email else None,
        gender=data.gender,
        dob=data.dob,
        permanent_address=data.permanent_address,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_number=data.emergency_contact_number,
        occupation=data.occupation,
        company_or_college=data.company_or_college,
        joining_date=data.joining_date,
        expected_leaving_date=data.expected_leaving_date,
        status=data.status or "Pending"
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return serialize_tenant(tenant, db)

@app.get("/api/tenants/{tenant_id}", response_model=TenantDetailOut)
def get_tenant_details(
    tenant_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    t_data = serialize_tenant(tenant, db)
    allocs = db.scalars(
        select(BedAllocation).where(BedAllocation.tenant_id == tenant_id).order_by(desc(BedAllocation.id))
    ).all()

    alloc_list = []
    for a in allocs:
        r = db.get(Room, a.room_id)
        b = db.get(Bed, a.bed_id)
        alloc_list.append({
            "id": a.id,
            "room_id": a.room_id,
            "room_number": r.room_number if r else "N/A",
            "floor": r.floor if r else 1,
            "bed_id": a.bed_id,
            "bed_number": b.bed_number if b else "N/A",
            "allocation_date": a.allocation_date,
            "monthly_rent": a.monthly_rent,
            "is_active": a.is_active,
            "vacating_date": a.vacating_date,
            "vacating_reason": a.vacating_reason,
            "room_inspection_status": a.room_inspection_status,
            "pending_dues": a.pending_dues,
            "deposit_refund_status": a.deposit_refund_status,
            "remarks": a.remarks,
        })
    t_data["allocations"] = alloc_list

    # Financial Summary for this tenant
    paid_sum = db.scalar(
        select(func.sum(Payment.amount)).where(Payment.tenant_id == tenant_id, Payment.is_cancelled == False)
    ) or 0.0
    pending_sum = db.scalar(
        select(func.sum(RentInvoice.pending_amount)).where(RentInvoice.tenant_id == tenant_id)
    ) or 0.0
    sec_dep = db.scalar(
        select(func.sum(Deposit.remaining_balance)).where(
            Deposit.tenant_id == tenant_id, Deposit.deposit_type == "Security Deposit"
        )
    ) or 0.0
    adv_rent = db.scalar(
        select(func.sum(Deposit.remaining_balance)).where(
            Deposit.tenant_id == tenant_id, Deposit.deposit_type == "Advance Rent"
        )
    ) or 0.0

    t_data["total_paid"] = round(paid_sum, 2)
    t_data["total_pending"] = round(pending_sum, 2)
    t_data["security_deposit_held"] = round(sec_dep, 2)
    t_data["advance_rent_held"] = round(adv_rent, 2)
    return t_data

@app.put("/api/tenants/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    update_data = data.dict(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(tenant, field, val)

    db.commit()
    db.refresh(tenant)
    return serialize_tenant(tenant, db)

def cascade_delete_tenant(db: Session, tenant: Tenant, user: User):
    """Allows Master Control to completely wipe a tenant and cascade all linked records."""
    tenant_id = tenant.id
    # 1. Clean up allocations and free beds
    allocations = db.scalars(select(BedAllocation).where(BedAllocation.tenant_id == tenant_id)).all()
    for alloc in allocations:
        bed = db.get(Bed, alloc.bed_id)
        if bed and bed.status == "Occupied":
            bed.status = "Available"
            update_room_status(db, bed.room_id)

        invoices = db.scalars(select(RentInvoice).where(RentInvoice.allocation_id == alloc.id)).all()
        for inv in invoices:
            payments = db.scalars(select(Payment).where(Payment.invoice_id == inv.id)).all()
            for p in payments:
                receipts = db.scalars(select(Receipt).where(Receipt.payment_id == p.id)).all()
                for r in receipts:
                    db.delete(r)
                db.delete(p)
            db.delete(inv)
        db.delete(alloc)

    # 2. Any additional invoices directly for this tenant
    other_invoices = db.scalars(select(RentInvoice).where(RentInvoice.tenant_id == tenant_id)).all()
    for inv in other_invoices:
        payments = db.scalars(select(Payment).where(Payment.invoice_id == inv.id)).all()
        for p in payments:
            receipts = db.scalars(select(Receipt).where(Receipt.payment_id == p.id)).all()
            for r in receipts:
                db.delete(r)
            db.delete(p)
        db.delete(inv)

    # 3. Direct payments
    other_payments = db.scalars(select(Payment).where(Payment.tenant_id == tenant_id)).all()
    for p in other_payments:
        receipts = db.scalars(select(Receipt).where(Receipt.payment_id == p.id)).all()
        for r in receipts:
            db.delete(r)
        db.delete(p)

    # 4. Deposits and transactions
    deposits = db.scalars(select(Deposit).where(Deposit.tenant_id == tenant_id)).all()
    for dep in deposits:
        txs = db.scalars(select(DepositTransaction).where(DepositTransaction.deposit_id == dep.id)).all()
        for tx in txs:
            db.delete(tx)
        db.delete(dep)

    # 5. Service Subscriptions & charges
    subs = db.scalars(select(TenantServiceSubscription).where(TenantServiceSubscription.tenant_id == tenant_id)).all()
    for s in subs:
        db.delete(s)

    scharges = db.scalars(select(ServiceCharge).where(ServiceCharge.tenant_id == tenant_id)).all()
    for sc in scharges:
        db.delete(sc)

    # Food
    food_subs = db.scalars(select(FoodSubscription).where(FoodSubscription.tenant_id == tenant_id)).all()
    for fs in food_subs:
        db.delete(fs)
    meals = db.scalars(select(MealRecord).where(MealRecord.tenant_id == tenant_id)).all()
    for m in meals:
        db.delete(m)

    # Wifi
    wifi_subs = db.scalars(select(WifiSubscription).where(WifiSubscription.tenant_id == tenant_id)).all()
    for ws in wifi_subs:
        db.delete(ws)

    # Parking
    parkings = db.scalars(select(ParkingAllocation).where(ParkingAllocation.tenant_id == tenant_id)).all()
    for pa in parkings:
        slot = db.get(ParkingSlot, pa.slot_id)
        if slot:
            slot.status = "Available"
        db.delete(pa)

    # AC
    ac_subs = db.scalars(select(AcSubscription).where(AcSubscription.tenant_id == tenant_id)).all()
    for ac in ac_subs:
        db.delete(ac)

    # Notifications & Tasks
    notifs = db.scalars(select(Notification).where(Notification.tenant_id == tenant_id)).all()
    for n in notifs:
        db.delete(n)
    tasks = db.scalars(select(PgTask).where(PgTask.tenant_id == tenant_id)).all()
    for tk in tasks:
        db.delete(tk)

    full_name = tenant.full_name
    code = tenant.tenant_code
    db.delete(tenant)
    db.commit()

    log_audit(
        db,
        username=user.username,
        action="FORCE_DELETE",
        entity_type="Tenant",
        entity_id=str(tenant_id),
        outcome="Success",
        details=f"Master force-deleted tenant {full_name} ({code}) and cleared all associated records",
        user_id=user.id
    )

@app.delete("/api/tenants/{tenant_id}")
def delete_tenant(
    tenant_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    if user.role.lower() in ["client", "subadmin"]:
        raise HTTPException(403, "Access Denied: You do not have permission to delete tenants.")

    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    is_master = user.role.lower() in ["master", "superadmin"]
    if is_master:
        cascade_delete_tenant(db, tenant, user)
        return {"status": "deleted", "tenant_id": tenant_id, "forced": True}

    # For standard Admin: enforce audit retention
    active_alloc = db.scalar(
        select(BedAllocation).where(BedAllocation.tenant_id == tenant_id, BedAllocation.is_active == True)
    )
    if active_alloc:
        raise HTTPException(400, "Cannot delete tenant with active bed allocation. Please vacate the tenant first.")

    has_history = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == tenant_id))
    if has_history:
        raise HTTPException(400, "Cannot delete tenant with historical allocation records. Audit and historical records must be preserved. Use Master Control to force delete if necessary.")

    db.delete(tenant)
    db.commit()
    log_audit(db, username=user.username, action="DELETE", entity_type="Tenant", entity_id=str(tenant_id),
              outcome="Success", details=f"Admin deleted tenant {tenant.full_name}", user_id=user.id)
    return {"status": "deleted", "tenant_id": tenant_id}


# ==========================================
# ROOM & BED MANAGEMENT (Phase 2)
# ==========================================

def serialize_room(r: Room, db: Session) -> dict:
    beds = db.scalars(select(Bed).where(Bed.room_id == r.id).order_by(Bed.bed_number)).all()
    bed_outs = []
    occupied_count = 0
    available_count = 0
    for b in beds:
        occ_info = None
        if b.status == "Occupied":
            occupied_count += 1
            active_alloc = db.scalar(
                select(BedAllocation).where(BedAllocation.bed_id == b.id, BedAllocation.is_active == True)
            )
            if active_alloc:
                t = db.get(Tenant, active_alloc.tenant_id)
                if t:
                    occ_info = {
                        "tenant_id": t.id,
                        "tenant_code": t.tenant_code,
                        "full_name": t.full_name,
                        "mobile": t.mobile,
                        "allocation_id": active_alloc.id,
                        "allocation_date": active_alloc.allocation_date
                    }
        elif b.status == "Available":
            available_count += 1

        bed_outs.append({
            "id": b.id,
            "room_id": b.room_id,
            "bed_number": b.bed_number,
            "status": b.status,
            "monthly_rent": b.monthly_rent,
            "occupant": occ_info
        })
    return {
        "id": r.id,
        "room_number": r.room_number,
        "floor": r.floor,
        "room_type": r.room_type,
        "capacity": r.capacity,
        "monthly_rent": r.monthly_rent,
        "status": r.status,
        "has_ac": bool(r.has_ac),
        "description": r.description,
        "bed_count": len(beds),
        "occupied_count": occupied_count,
        "available_count": available_count,
        "beds": bed_outs
    }

@app.get("/api/rooms", response_model=List[RoomOut])
def get_rooms(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    floor: Optional[int] = Query(None),
    has_ac: Optional[bool] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Room)
    if search:
        query = query.where(Room.room_number.ilike(f"%{search.strip()}%"))
    if status and status.lower() != "all":
        query = query.where(Room.status.ilike(status))
    if floor is not None:
        query = query.where(Room.floor == floor)
    if has_ac is not None:
        query = query.where(Room.has_ac == has_ac)

    query = query.order_by(Room.floor, Room.room_number)
    rooms = db.scalars(query).all()
    return [serialize_room(r, db) for r in rooms]

@app.post("/api/rooms", response_model=RoomOut)
def create_room(
    data: RoomCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    existing = db.scalar(select(Room).where(Room.room_number == data.room_number.strip()))
    if existing:
        raise HTTPException(400, f"Room '{data.room_number.strip()}' already exists.")

    room = Room(
        room_number=data.room_number.strip(),
        floor=data.floor,
        room_type=data.room_type,
        capacity=data.capacity,
        monthly_rent=data.monthly_rent,
        status=data.status or "Available",
        has_ac=bool(data.has_ac),
        description=data.description
    )
    db.add(room)
    db.flush()

    beds_to_create = data.initial_beds if data.initial_beds is not None else data.capacity
    for i in range(1, beds_to_create + 1):
        bed = Bed(
            room_id=room.id,
            bed_number=f"Bed {i}",
            status="Available",
            monthly_rent=data.monthly_rent
        )
        db.add(bed)

    db.commit()
    update_room_status(db, room.id)
    db.commit()
    db.refresh(room)
    return serialize_room(room, db)

@app.get("/api/rooms/{room_id}", response_model=RoomOut)
def get_room_details(
    room_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")
    return serialize_room(room, db)

@app.put("/api/rooms/{room_id}", response_model=RoomOut)
def update_room(
    room_id: int,
    data: RoomUpdate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")

    if data.room_number and data.room_number.strip() != room.room_number:
        exists = db.scalar(
            select(Room).where(Room.room_number == data.room_number.strip(), Room.id != room_id)
        )
        if exists:
            raise HTTPException(400, f"Room '{data.room_number.strip()}' already exists.")
        room.room_number = data.room_number.strip()

    if data.floor is not None:
        room.floor = data.floor
    if data.room_type is not None:
        room.room_type = data.room_type
    if data.capacity is not None:
        room.capacity = data.capacity
    if data.monthly_rent is not None:
        room.monthly_rent = data.monthly_rent
    if data.description is not None:
        room.description = data.description
    if data.status is not None:
        room.status = data.status
    if data.has_ac is not None:
        room.has_ac = data.has_ac

    db.commit()
    update_room_status(db, room.id)
    db.commit()
    db.refresh(room)
    return serialize_room(room, db)

@app.delete("/api/rooms/{room_id}")
def delete_room(
    room_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    if user.role.lower() in ["client", "subadmin"]:
        raise HTTPException(403, "Access Denied: You do not have permission to delete rooms.")

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")

    is_master = user.role.lower() in ["master", "superadmin"]

    beds = db.scalars(select(Bed).where(Bed.room_id == room_id)).all()
    occupied_beds = [b for b in beds if b.status == "Occupied"]

    if occupied_beds and not is_master:
        raise HTTPException(400, "Cannot delete room with occupied beds. Please vacate tenants first.")

    # Master full control / Admin if no historical allocations:
    for bed in beds:
        allocations = db.scalars(select(BedAllocation).where(BedAllocation.bed_id == bed.id)).all()
        if allocations and not is_master:
            raise HTTPException(400, "Cannot delete room with historical bed allocations. Master Control required.")

        for alloc in allocations:
            invoices = db.scalars(select(RentInvoice).where(RentInvoice.allocation_id == alloc.id)).all()
            for inv in invoices:
                payments = db.scalars(select(Payment).where(Payment.invoice_id == inv.id)).all()
                for p in payments:
                    receipts = db.scalars(select(Receipt).where(Receipt.payment_id == p.id)).all()
                    for r in receipts:
                        db.delete(r)
                    db.delete(p)
                db.delete(inv)
            db.delete(alloc)

        bed_invoices = db.scalars(select(RentInvoice).where(RentInvoice.bed_id == bed.id)).all()
        for inv in bed_invoices:
            payments = db.scalars(select(Payment).where(Payment.invoice_id == inv.id)).all()
            for p in payments:
                receipts = db.scalars(select(Receipt).where(Receipt.payment_id == p.id)).all()
                for r in receipts:
                    db.delete(r)
                db.delete(p)
            db.delete(inv)

        db.delete(bed)

    # Clean up meters, readings, and AC subscriptions for this room
    meters = db.scalars(select(ElectricityMeter).where(ElectricityMeter.room_id == room_id)).all()
    for m in meters:
        readings = db.scalars(select(ElectricityReading).where(ElectricityReading.meter_id == m.id)).all()
        for rd in readings:
            db.delete(rd)
        db.delete(m)

    ac_subs = db.scalars(select(AcSubscription).where(AcSubscription.room_id == room_id)).all()
    for ac in ac_subs:
        db.delete(ac)

    room_num = room.room_number
    db.delete(room)
    db.commit()

    log_audit(
        db,
        username=user.username,
        action="DELETE",
        entity_type="Room",
        entity_id=str(room_id),
        outcome="Success",
        details=f"Deleted room {room_num} ({'Master force delete' if is_master else 'Admin delete'})",
        user_id=user.id
    )
    return {"status": "deleted", "room_id": room_id}

@app.get("/api/beds", response_model=List[BedOut])
def get_beds(
    room_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Bed)
    if room_id:
        query = query.where(Bed.room_id == room_id)
    if status and status.lower() != "all":
        query = query.where(Bed.status.ilike(status))

    beds = db.scalars(query.order_by(Bed.room_id, Bed.bed_number)).all()
    results = []
    for b in beds:
        occ = None
        if b.status == "Occupied":
            alloc = db.scalar(select(BedAllocation).where(BedAllocation.bed_id == b.id, BedAllocation.is_active == True))
            if alloc:
                t = db.get(Tenant, alloc.tenant_id)
                if t:
                    occ = {
                        "tenant_id": t.id,
                        "tenant_code": t.tenant_code,
                        "full_name": t.full_name,
                        "mobile": t.mobile,
                        "allocation_id": alloc.id,
                        "allocation_date": alloc.allocation_date
                    }
        results.append({
            "id": b.id,
            "room_id": b.room_id,
            "bed_number": b.bed_number,
            "status": b.status,
            "monthly_rent": b.monthly_rent,
            "occupant": occ
        })
    return results

@app.get("/api/rooms/{room_id}/beds", response_model=List[BedOut])
def get_room_beds(
    room_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")
    return get_beds(room_id=room_id, status=None, user=user, db=db)

@app.post("/api/rooms/{room_id}/beds", response_model=BedOut)
def add_bed_to_room(
    room_id: int,
    data: BedCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")

    bed = Bed(
        room_id=room.id,
        bed_number=data.bed_number.strip(),
        status=data.status or "Available",
        monthly_rent=data.monthly_rent or room.monthly_rent
    )
    db.add(bed)
    db.flush()

    current_beds_count = db.scalar(select(func.count(Bed.id)).where(Bed.room_id == room_id)) or 0
    if current_beds_count > room.capacity:
        room.capacity = current_beds_count

    update_room_status(db, room_id)
    db.commit()
    db.refresh(bed)
    return {
        "id": bed.id,
        "room_id": bed.room_id,
        "bed_number": bed.bed_number,
        "status": bed.status,
        "monthly_rent": bed.monthly_rent,
        "occupant": None
    }

@app.put("/api/beds/{bed_id}", response_model=BedOut)
def update_bed(
    bed_id: int,
    data: BedUpdate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    bed = db.get(Bed, bed_id)
    if not bed:
        raise HTTPException(404, "Bed not found.")

    if data.status and data.status != bed.status:
        active_alloc = db.scalar(
            select(BedAllocation).where(BedAllocation.bed_id == bed_id, BedAllocation.is_active == True)
        )
        if active_alloc and data.status != "Occupied":
            raise HTTPException(400, "Cannot change status of an occupied bed. Vacate the tenant first.")
        bed.status = data.status

    if data.bed_number is not None:
        bed.bed_number = data.bed_number.strip()
    if data.monthly_rent is not None:
        bed.monthly_rent = data.monthly_rent

    db.commit()
    update_room_status(db, bed.room_id)
    db.commit()
    db.refresh(bed)

    occ = None
    if bed.status == "Occupied":
        alloc = db.scalar(select(BedAllocation).where(BedAllocation.bed_id == bed.id, BedAllocation.is_active == True))
        if alloc:
            t = db.get(Tenant, alloc.tenant_id)
            if t:
                occ = {
                    "tenant_id": t.id,
                    "tenant_code": t.tenant_code,
                    "full_name": t.full_name,
                    "mobile": t.mobile,
                    "allocation_id": alloc.id,
                    "allocation_date": alloc.allocation_date
                }
    return {
        "id": bed.id,
        "room_id": bed.room_id,
        "bed_number": bed.bed_number,
        "status": bed.status,
        "monthly_rent": bed.monthly_rent,
        "occupant": occ
    }


# ==========================================
# ALLOCATION & VACATING (Phase 2)
# ==========================================

@app.post("/api/allocations", response_model=AllocationOut)
def create_allocation(
    data: AllocationCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    existing_tenant_alloc = db.scalar(
        select(BedAllocation).where(BedAllocation.tenant_id == data.tenant_id, BedAllocation.is_active == True)
    )
    if existing_tenant_alloc:
        raise HTTPException(400, "Tenant already has an active bed allocation.")

    bed = db.get(Bed, data.bed_id)
    if not bed:
        raise HTTPException(404, "Bed not found.")
    if bed.status == "Occupied":
        raise HTTPException(400, "Selected bed is already occupied.")
    if bed.status == "Maintenance":
        raise HTTPException(400, "Cannot allocate a bed under maintenance.")

    existing_bed_alloc = db.scalar(
        select(BedAllocation).where(BedAllocation.bed_id == data.bed_id, BedAllocation.is_active == True)
    )
    if existing_bed_alloc:
        raise HTTPException(400, "Selected bed is already allocated to another active tenant.")

    room = db.get(Room, bed.room_id)
    if not room:
        raise HTTPException(404, "Room not found.")
    if room.status == "Maintenance":
        raise HTTPException(400, "Cannot allocate a bed in a room under maintenance.")

    active_in_room = db.scalar(
        select(func.count(BedAllocation.id)).where(BedAllocation.room_id == room.id, BedAllocation.is_active == True)
    ) or 0
    if active_in_room >= room.capacity:
        raise HTTPException(400, f"Room capacity ({room.capacity}) has already been reached.")

    allocation = BedAllocation(
        tenant_id=tenant.id,
        bed_id=bed.id,
        room_id=room.id,
        allocation_date=data.allocation_date,
        monthly_rent=data.monthly_rent,
        is_active=True
    )
    db.add(allocation)
    bed.status = "Occupied"
    tenant.status = "Active"
    db.flush()
    update_room_status(db, room.id)
    db.commit()
    db.refresh(allocation)

    return {
        "id": allocation.id,
        "tenant_id": tenant.id,
        "tenant_name": tenant.full_name,
        "tenant_code": tenant.tenant_code,
        "room_id": room.id,
        "room_number": room.room_number,
        "bed_id": bed.id,
        "bed_number": bed.bed_number,
        "allocation_date": allocation.allocation_date,
        "monthly_rent": allocation.monthly_rent,
        "is_active": allocation.is_active,
        "created_at": allocation.created_at
    }

@app.get("/api/allocations", response_model=List[AllocationOut])
def get_allocations(
    active_only: bool = Query(False),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(BedAllocation)
    if active_only:
        query = query.where(BedAllocation.is_active == True)
    query = query.order_by(desc(BedAllocation.id))

    allocs = db.scalars(query).all()
    results = []
    for a in allocs:
        t = db.get(Tenant, a.tenant_id)
        r = db.get(Room, a.room_id)
        b = db.get(Bed, a.bed_id)
        results.append({
            "id": a.id,
            "tenant_id": a.tenant_id,
            "tenant_name": t.full_name if t else "Unknown",
            "tenant_code": t.tenant_code if t else "N/A",
            "room_id": a.room_id,
            "room_number": r.room_number if r else "N/A",
            "bed_id": a.bed_id,
            "bed_number": b.bed_number if b else "N/A",
            "allocation_date": a.allocation_date,
            "monthly_rent": a.monthly_rent,
            "is_active": a.is_active,
            "vacating_date": a.vacating_date,
            "vacating_reason": a.vacating_reason,
            "room_inspection_status": a.room_inspection_status,
            "pending_dues": a.pending_dues,
            "deposit_refund_status": a.deposit_refund_status,
            "remarks": a.remarks,
            "created_at": a.created_at
        })
    return results

@app.get("/api/tenants/{tenant_id}/allocations", response_model=List[AllocationOut])
def get_tenant_allocations(
    tenant_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    allocs = db.scalars(
        select(BedAllocation).where(BedAllocation.tenant_id == tenant_id).order_by(desc(BedAllocation.id))
    ).all()
    results = []
    for a in allocs:
        r = db.get(Room, a.room_id)
        b = db.get(Bed, a.bed_id)
        results.append({
            "id": a.id,
            "tenant_id": a.tenant_id,
            "tenant_name": tenant.full_name,
            "tenant_code": tenant.tenant_code,
            "room_id": a.room_id,
            "room_number": r.room_number if r else "N/A",
            "bed_id": a.bed_id,
            "bed_number": b.bed_number if b else "N/A",
            "allocation_date": a.allocation_date,
            "monthly_rent": a.monthly_rent,
            "is_active": a.is_active,
            "vacating_date": a.vacating_date,
            "vacating_reason": a.vacating_reason,
            "room_inspection_status": a.room_inspection_status,
            "pending_dues": a.pending_dues,
            "deposit_refund_status": a.deposit_refund_status,
            "remarks": a.remarks,
            "created_at": a.created_at
        })
    return results

@app.post("/api/allocations/{allocation_id}/vacate", response_model=AllocationOut)
def vacate_allocation(
    allocation_id: int,
    data: AllocationVacate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    alloc = db.get(BedAllocation, allocation_id)
    if not alloc:
        raise HTTPException(404, "Allocation not found.")
    if not alloc.is_active:
        raise HTTPException(400, "Allocation is already vacated / inactive.")

    alloc.is_active = False
    alloc.vacating_date = data.vacating_date
    alloc.vacating_reason = data.vacating_reason
    alloc.room_inspection_status = data.room_inspection_status
    alloc.pending_dues = data.pending_dues
    alloc.deposit_refund_status = data.deposit_refund_status
    alloc.remarks = data.remarks

    bed = db.get(Bed, alloc.bed_id)
    if bed:
        bed.status = "Available"

    tenant = db.get(Tenant, alloc.tenant_id)
    if tenant:
        tenant.status = "Vacated"

    update_room_status(db, alloc.room_id)
    db.commit()
    db.refresh(alloc)

    room = db.get(Room, alloc.room_id)
    return {
        "id": alloc.id,
        "tenant_id": alloc.tenant_id,
        "tenant_name": tenant.full_name if tenant else "Unknown",
        "tenant_code": tenant.tenant_code if tenant else "N/A",
        "room_id": alloc.room_id,
        "room_number": room.room_number if room else "N/A",
        "bed_id": alloc.bed_id,
        "bed_number": bed.bed_number if bed else "N/A",
        "allocation_date": alloc.allocation_date,
        "monthly_rent": alloc.monthly_rent,
        "is_active": alloc.is_active,
        "vacating_date": alloc.vacating_date,
        "vacating_reason": alloc.vacating_reason,
        "room_inspection_status": alloc.room_inspection_status,
        "pending_dues": alloc.pending_dues,
        "deposit_refund_status": alloc.deposit_refund_status,
        "remarks": alloc.remarks,
        "created_at": alloc.created_at
    }


# ==========================================
# PHASE 3: MONTHLY RENT MANAGEMENT
# ==========================================

def serialize_invoice(inv: RentInvoice, db: Session) -> dict:
    tenant = db.get(Tenant, inv.tenant_id)
    room = db.get(Room, inv.room_id)
    bed = db.get(Bed, inv.bed_id)
    pmts = db.scalars(
        select(Payment).where(Payment.invoice_id == inv.id).order_by(desc(Payment.id))
    ).all()

    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "tenant_id": inv.tenant_id,
        "tenant_name": tenant.full_name if tenant else "N/A",
        "tenant_code": tenant.tenant_code if tenant else "N/A",
        "room_number": room.room_number if room else "N/A",
        "bed_number": bed.bed_number if bed else "N/A",
        "billing_month": inv.billing_month,
        "billing_year": inv.billing_year,
        "billing_date": inv.billing_date,
        "due_date": inv.due_date,
        "base_rent": inv.base_rent,
        "prorated_days": inv.prorated_days,
        "total_days_in_month": inv.total_days_in_month,
        "adjustment_amount": inv.adjustment_amount,
        "adjustment_reason": inv.adjustment_reason,
        "total_amount": inv.total_amount,
        "amount_paid": inv.amount_paid,
        "pending_amount": inv.pending_amount,
        "status": inv.status,
        "notes": inv.notes,
        "payments": [
            {
                "id": p.id,
                "payment_number": p.payment_number,
                "payment_date": p.payment_date,
                "amount": p.amount,
                "payment_mode": p.payment_mode,
                "receipt_number": p.receipt_number,
                "is_cancelled": p.is_cancelled
            }
            for p in pmts
        ],
        "created_at": inv.created_at
    }

@app.post("/api/rent/generate", response_model=List[InvoiceOut])
def generate_monthly_rent(
    data: RentGenerateRequest,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(BedAllocation).where(BedAllocation.is_active == True)
    if data.tenant_id:
        query = query.where(BedAllocation.tenant_id == data.tenant_id)

    allocations = db.scalars(query).all()
    if not allocations:
        raise HTTPException(400, "No active allocations found for rent generation.")

    created_invoices = []
    days_in_month = calendar.monthrange(data.billing_year, data.billing_month)[1]
    billing_date_str = f"{data.billing_year}-{data.billing_month:02d}-01"

    for alloc in allocations:
        # Check duplicate
        exists = db.scalar(
            select(RentInvoice).where(
                RentInvoice.tenant_id == alloc.tenant_id,
                RentInvoice.billing_month == data.billing_month,
                RentInvoice.billing_year == data.billing_year
            )
        )
        if exists:
            # Skip duplicate generation
            continue

        base_rent = alloc.monthly_rent
        prorated_days = None
        total_rent = base_rent

        # Mid-month joining proration calculation
        if data.prorate and alloc.allocation_date:
            try:
                alloc_dt = datetime.strptime(alloc.allocation_date, "%Y-%m-%d")
                if alloc_dt.year == data.billing_year and alloc_dt.month == data.billing_month:
                    if alloc_dt.day > 1:
                        prorated_days = days_in_month - alloc_dt.day + 1
                        total_rent = round((base_rent / days_in_month) * prorated_days, 2)
            except Exception:
                pass

        inv_num = get_next_invoice_number(db, data.billing_year, data.billing_month)
        invoice = RentInvoice(
            invoice_number=inv_num,
            tenant_id=alloc.tenant_id,
            allocation_id=alloc.id,
            room_id=alloc.room_id,
            bed_id=alloc.bed_id,
            billing_month=data.billing_month,
            billing_year=data.billing_year,
            billing_date=billing_date_str,
            due_date=data.due_date,
            base_rent=base_rent,
            prorated_days=prorated_days,
            total_days_in_month=days_in_month,
            adjustment_amount=0.0,
            total_amount=total_rent,
            amount_paid=0.0,
            pending_amount=total_rent,
            status="Unpaid",
            notes=f"Rent for {calendar.month_name[data.billing_month]} {data.billing_year}" +
                  (f" (Prorated for {prorated_days}/{days_in_month} days)" if prorated_days else "")
        )
        db.add(invoice)
        db.flush()

        db.add(FinancialAuditLog(
            entity_type="Invoice",
            entity_id=invoice.id,
            action="Generate",
            amount=total_rent,
            performed_by=user.username,
            reason=f"Monthly rent invoice generated for {data.billing_month}/{data.billing_year}",
            details_json=f'{{"invoice_number":"{inv_num}","prorated_days":{prorated_days}}}'
        ))
        created_invoices.append(invoice)

    db.commit()
    for inv in created_invoices:
        db.refresh(inv)

    return [serialize_invoice(inv, db) for inv in created_invoices]

@app.get("/api/rent/invoices", response_model=List[InvoiceOut])
def get_invoices(
    tenant_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(RentInvoice)
    if tenant_id:
        query = query.where(RentInvoice.tenant_id == tenant_id)
    if status and status.lower() != "all":
        query = query.where(RentInvoice.status.ilike(status))
    if month:
        query = query.where(RentInvoice.billing_month == month)
    if year:
        query = query.where(RentInvoice.billing_year == year)
    if search:
        s = f"%{search.strip()}%"
        query = query.join(Tenant).where(
            or_(
                RentInvoice.invoice_number.ilike(s),
                Tenant.full_name.ilike(s),
                Tenant.tenant_code.ilike(s)
            )
        )

    # Check for overdue status dynamically if due_date < today and unpaid
    today_str = datetime.now().strftime("%Y-%m-%d")
    invoices = db.scalars(query.order_by(desc(RentInvoice.id))).all()
    for inv in invoices:
        if inv.pending_amount > 0 and inv.due_date < today_str and inv.status != "Overdue":
            inv.status = "Overdue"
            db.commit()

    return [serialize_invoice(inv, db) for inv in invoices]

@app.get("/api/rent/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice_details(
    invoice_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    invoice = db.get(RentInvoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found.")
    return serialize_invoice(invoice, db)

@app.put("/api/rent/invoices/{invoice_id}/adjust", response_model=InvoiceOut)
def adjust_invoice(
    invoice_id: int,
    data: RentAdjustRequest,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    invoice = db.get(RentInvoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found.")
    if not data.adjustment_reason.strip():
        raise HTTPException(400, "Authorized adjustment reason is required.")

    old_total = invoice.total_amount
    invoice.adjustment_amount += data.adjustment_amount
    invoice.adjustment_reason = data.adjustment_reason.strip()
    invoice.total_amount = max(0.0, round(invoice.base_rent + invoice.adjustment_amount, 2))
    invoice.pending_amount = max(0.0, round(invoice.total_amount - invoice.amount_paid, 2))

    if invoice.pending_amount == 0.0:
        invoice.status = "Paid"
    elif invoice.amount_paid > 0:
        invoice.status = "Partially Paid"
    else:
        today_str = datetime.now().strftime("%Y-%m-%d")
        invoice.status = "Overdue" if invoice.due_date < today_str else "Unpaid"

    db.add(FinancialAuditLog(
        entity_type="Invoice",
        entity_id=invoice.id,
        action="Adjust",
        amount=data.adjustment_amount,
        performed_by=user.username,
        reason=data.adjustment_reason.strip(),
        details_json=f'{{"old_total":{old_total},"new_total":{invoice.total_amount}}}'
    ))
    db.commit()
    db.refresh(invoice)
    return serialize_invoice(invoice, db)

@app.get("/api/rent/outstanding")
def get_outstanding_rent(
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    invoices = db.scalars(
        select(RentInvoice).where(RentInvoice.pending_amount > 0).order_by(RentInvoice.due_date)
    ).all()
    total_outstanding = sum(inv.pending_amount for inv in invoices)
    today_str = datetime.now().strftime("%Y-%m-%d")
    overdue_invoices = [inv for inv in invoices if inv.due_date < today_str]
    total_overdue = sum(inv.pending_amount for inv in overdue_invoices)

    return {
        "total_outstanding_amount": round(total_outstanding, 2),
        "total_overdue_amount": round(total_overdue, 2),
        "unpaid_invoices_count": len(invoices),
        "overdue_invoices_count": len(overdue_invoices),
        "invoices": [serialize_invoice(inv, db) for inv in invoices]
    }


# ==========================================
# PHASE 3: PAYMENT COLLECTION & RECEIPTS
# ==========================================

def serialize_payment(p: Payment, db: Session) -> dict:
    tenant = db.get(Tenant, p.tenant_id)
    room_num = "N/A"
    bed_num = "N/A"
    inv_num = None

    if p.invoice_id:
        inv = db.get(RentInvoice, p.invoice_id)
        if inv:
            inv_num = inv.invoice_number
            r = db.get(Room, inv.room_id)
            b = db.get(Bed, inv.bed_id)
            if r: room_num = r.room_number
            if b: bed_num = b.bed_number
    else:
        alloc = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == p.tenant_id, BedAllocation.is_active == True))
        if alloc:
            r = db.get(Room, alloc.room_id)
            b = db.get(Bed, alloc.bed_id)
            if r: room_num = r.room_number
            if b: bed_num = b.bed_number

    return {
        "id": p.id,
        "payment_number": p.payment_number,
        "tenant_id": p.tenant_id,
        "tenant_name": tenant.full_name if tenant else "N/A",
        "tenant_code": tenant.tenant_code if tenant else "N/A",
        "room_number": room_num,
        "bed_number": bed_num,
        "invoice_id": p.invoice_id,
        "invoice_number": inv_num,
        "payment_date": p.payment_date,
        "amount": p.amount,
        "payment_type": p.payment_type,
        "payment_mode": p.payment_mode,
        "transaction_ref": p.transaction_ref,
        "notes": p.notes,
        "receipt_number": p.receipt_number,
        "is_cancelled": p.is_cancelled,
        "cancellation_reason": p.cancellation_reason,
        "created_at": p.created_at
    }

@app.post("/api/payments", response_model=PaymentOut)
def record_payment(
    data: PaymentCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    if data.amount <= 0:
        raise HTTPException(400, "Payment amount must be greater than zero.")

    invoice = None
    prev_balance = 0.0
    rem_balance = 0.0
    billing_period_text = None

    if data.invoice_id:
        invoice = db.get(RentInvoice, data.invoice_id)
        if not invoice:
            raise HTTPException(404, "Linked invoice not found.")
        if invoice.tenant_id != tenant.id:
            raise HTTPException(400, "Invoice does not belong to the selected tenant.")

        prev_balance = invoice.pending_amount
        if data.amount > prev_balance:
            raise HTTPException(400, f"Payment (Rs. {data.amount:,.2f}) exceeds outstanding invoice balance (Rs. {prev_balance:,.2f}). Use Advance for overpayments.")

        invoice.amount_paid += data.amount
        invoice.pending_amount = max(0.0, round(invoice.pending_amount - data.amount, 2))
        rem_balance = invoice.pending_amount

        if invoice.pending_amount == 0.0:
            invoice.status = "Paid"
        else:
            invoice.status = "Partially Paid"

        billing_period_text = f"{calendar.month_name[invoice.billing_month]} {invoice.billing_year}"
    else:
        # Check current tenant active allocation
        billing_period_text = "Direct Collection / Other"

    # Generate Voucher and Receipt numbers
    pay_num = get_next_payment_number(db, data.payment_date)
    rec_num = get_next_receipt_number(db, data.payment_date)

    payment = Payment(
        payment_number=pay_num,
        tenant_id=tenant.id,
        invoice_id=data.invoice_id,
        payment_date=data.payment_date,
        amount=data.amount,
        payment_type=data.payment_type,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        notes=data.notes,
        receipt_number=rec_num,
        is_cancelled=False
    )
    db.add(payment)
    db.flush()

    # Room/Bed resolution for receipt
    room_str = "N/A"
    bed_str = "N/A"
    alloc = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == tenant.id, BedAllocation.is_active == True))
    if alloc:
        r = db.get(Room, alloc.room_id)
        b = db.get(Bed, alloc.bed_id)
        if r: room_str = r.room_number
        if b: bed_str = b.bed_number

    # Generate PDF receipt
    try:
        pdf_file = generate_pdf_receipt(
            receipt_number=rec_num,
            payment_number=pay_num,
            payment_date=data.payment_date,
            tenant_name=tenant.full_name,
            tenant_code=tenant.tenant_code,
            room_number=room_str,
            bed_number=bed_str,
            payment_type=data.payment_type,
            billing_period=billing_period_text,
            amount_paid=data.amount,
            payment_mode=data.payment_mode,
            transaction_ref=data.transaction_ref,
            previous_balance=prev_balance,
            remaining_balance=rem_balance,
            received_by=user.username
        )
        receipt = Receipt(
            receipt_number=rec_num,
            payment_id=payment.id,
            tenant_id=tenant.id,
            receipt_date=data.payment_date,
            pdf_filename=pdf_file
        )
        db.add(receipt)
    except Exception as ex:
        logger.exception("Failed to generate PDF receipt")

    # Financial Audit Log
    db.add(FinancialAuditLog(
        entity_type="Payment",
        entity_id=payment.id,
        action="Payment",
        amount=data.amount,
        performed_by=user.username,
        reason=f"Payment received via {data.payment_mode}",
        details_json=f'{{"payment_number":"{pay_num}","receipt_number":"{rec_num}"}}'
    ))

    db.commit()
    db.refresh(payment)
    return serialize_payment(payment, db)

@app.get("/api/payments", response_model=List[PaymentOut])
def get_payments(
    tenant_id: Optional[int] = Query(None),
    payment_type: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Payment)
    if tenant_id:
        query = query.where(Payment.tenant_id == tenant_id)
    if payment_type and payment_type.lower() != "all":
        query = query.where(Payment.payment_type.ilike(payment_type))
    if payment_mode and payment_mode.lower() != "all":
        query = query.where(Payment.payment_mode.ilike(payment_mode))
    if date_from:
        query = query.where(Payment.payment_date >= date_from)
    if date_to:
        query = query.where(Payment.payment_date <= date_to)
    if search:
        s = f"%{search.strip()}%"
        query = query.join(Tenant).where(
            or_(
                Payment.payment_number.ilike(s),
                Payment.receipt_number.ilike(s),
                Payment.transaction_ref.ilike(s),
                Tenant.full_name.ilike(s),
                Tenant.tenant_code.ilike(s)
            )
        )

    payments = db.scalars(query.order_by(desc(Payment.id))).all()
    return [serialize_payment(p, db) for p in payments]

@app.get("/api/payments/{payment_id}", response_model=PaymentOut)
def get_payment_details(
    payment_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")
    return serialize_payment(payment, db)

@app.get("/api/tenants/{tenant_id}/payments", response_model=List[PaymentOut])
def get_tenant_payments(
    tenant_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    payments = db.scalars(
        select(Payment).where(Payment.tenant_id == tenant_id).order_by(desc(Payment.id))
    ).all()
    return [serialize_payment(p, db) for p in payments]

@app.post("/api/payments/{payment_id}/cancel", response_model=PaymentOut)
def cancel_payment(
    payment_id: int,
    data: PaymentCancelRequest,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")
    if payment.is_cancelled:
        raise HTTPException(400, "Payment is already cancelled.")
    if not data.cancellation_reason.strip():
        raise HTTPException(400, "Cancellation reason is mandatory.")

    payment.is_cancelled = True
    payment.cancellation_reason = data.cancellation_reason.strip()
    payment.cancelled_at = datetime.now()
    payment.cancelled_by = user.username

    # Reverse invoice balance if payment was linked to an invoice
    if payment.invoice_id:
        invoice = db.get(RentInvoice, payment.invoice_id)
        if invoice:
            invoice.amount_paid = max(0.0, round(invoice.amount_paid - payment.amount, 2))
            invoice.pending_amount = min(invoice.total_amount, round(invoice.pending_amount + payment.amount, 2))
            today_str = datetime.now().strftime("%Y-%m-%d")
            if invoice.pending_amount == invoice.total_amount:
                invoice.status = "Overdue" if invoice.due_date < today_str else "Unpaid"
            else:
                invoice.status = "Partially Paid"

    db.add(FinancialAuditLog(
        entity_type="Payment",
        entity_id=payment.id,
        action="Cancel",
        amount=payment.amount,
        performed_by=user.username,
        reason=data.cancellation_reason.strip(),
        details_json=f'{{"payment_number":"{payment.payment_number}","invoice_id":{payment.invoice_id}}}'
    ))
    db.commit()
    db.refresh(payment)
    return serialize_payment(payment, db)


# ==========================================
# PHASE 3: ADVANCE & DEPOSIT MANAGEMENT
# ==========================================

def serialize_deposit(d: Deposit, db: Session) -> dict:
    tenant = db.get(Tenant, d.tenant_id)
    txs = db.scalars(
        select(DepositTransaction).where(DepositTransaction.deposit_id == d.id).order_by(desc(DepositTransaction.id))
    ).all()

    return {
        "id": d.id,
        "deposit_number": d.deposit_number,
        "tenant_id": d.tenant_id,
        "tenant_name": tenant.full_name if tenant else "N/A",
        "tenant_code": tenant.tenant_code if tenant else "N/A",
        "deposit_type": d.deposit_type,
        "total_amount": d.total_amount,
        "payment_date": d.payment_date,
        "payment_mode": d.payment_mode,
        "transaction_ref": d.transaction_ref,
        "adjusted_amount": d.adjusted_amount,
        "refunded_amount": d.refunded_amount,
        "remaining_balance": d.remaining_balance,
        "status": d.status,
        "remarks": d.remarks,
        "transactions": [
            {
                "id": t.id,
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "transaction_date": t.transaction_date,
                "payment_mode": t.payment_mode,
                "transaction_ref": t.transaction_ref,
                "linked_invoice_id": t.linked_invoice_id,
                "reason": t.reason,
                "created_at": t.created_at
            }
            for t in txs
        ],
        "created_at": d.created_at
    }

@app.post("/api/deposits", response_model=DepositOut)
def record_deposit(
    data: DepositCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    if data.amount <= 0:
        raise HTTPException(400, "Deposit amount must be greater than zero.")

    dep_num = get_next_deposit_number(db, data.payment_date)
    deposit = Deposit(
        deposit_number=dep_num,
        tenant_id=tenant.id,
        deposit_type=data.deposit_type,
        total_amount=data.amount,
        payment_date=data.payment_date,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        adjusted_amount=0.0,
        refunded_amount=0.0,
        remaining_balance=data.amount,
        status="Active",
        remarks=data.remarks
    )
    db.add(deposit)
    db.flush()

    # Record Initial Collection Transaction
    db.add(DepositTransaction(
        deposit_id=deposit.id,
        transaction_type="Collection",
        amount=data.amount,
        transaction_date=data.payment_date,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        reason=f"Initial {data.deposit_type} received",
        recorded_by=user.username
    ))

    # Also record into Payment voucher & generate receipt for resident
    pay_num = get_next_payment_number(db, data.payment_date)
    rec_num = get_next_receipt_number(db, data.payment_date)
    payment = Payment(
        payment_number=pay_num,
        tenant_id=tenant.id,
        invoice_id=None,
        payment_date=data.payment_date,
        amount=data.amount,
        payment_type=data.deposit_type,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        notes=f"{data.deposit_type} voucher: {dep_num}",
        receipt_number=rec_num,
        is_cancelled=False
    )
    db.add(payment)
    db.flush()

    # Room/Bed resolution for receipt
    room_str = "N/A"
    bed_str = "N/A"
    alloc = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == tenant.id, BedAllocation.is_active == True))
    if alloc:
        r = db.get(Room, alloc.room_id)
        b = db.get(Bed, alloc.bed_id)
        if r: room_str = r.room_number
        if b: bed_str = b.bed_number

    try:
        pdf_file = generate_pdf_receipt(
            receipt_number=rec_num,
            payment_number=pay_num,
            payment_date=data.payment_date,
            tenant_name=tenant.full_name,
            tenant_code=tenant.tenant_code,
            room_number=room_str,
            bed_number=bed_str,
            payment_type=data.deposit_type,
            billing_period="Deposit / Security",
            amount_paid=data.amount,
            payment_mode=data.payment_mode,
            transaction_ref=data.transaction_ref,
            previous_balance=data.amount,
            remaining_balance=0.0,
            received_by=user.username
        )
        db.add(Receipt(
            receipt_number=rec_num,
            payment_id=payment.id,
            tenant_id=tenant.id,
            receipt_date=data.payment_date,
            pdf_filename=pdf_file
        ))
    except Exception as ex:
        logger.warning(f"Deposit PDF generation error: {ex}")

    db.add(FinancialAuditLog(
        entity_type="Deposit",
        entity_id=deposit.id,
        action="Payment",
        amount=data.amount,
        performed_by=user.username,
        reason=f"New {data.deposit_type} recorded",
        details_json=f'{{"deposit_number":"{dep_num}","receipt_number":"{rec_num}"}}'
    ))

    db.commit()
    db.refresh(deposit)
    return serialize_deposit(deposit, db)

@app.get("/api/deposits", response_model=List[DepositOut])
def get_deposits(
    tenant_id: Optional[int] = Query(None),
    deposit_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Deposit)
    if tenant_id:
        query = query.where(Deposit.tenant_id == tenant_id)
    if deposit_type and deposit_type.lower() != "all":
        query = query.where(Deposit.deposit_type.ilike(deposit_type))
    if status and status.lower() != "all":
        query = query.where(Deposit.status.ilike(status))

    deposits = db.scalars(query.order_by(desc(Deposit.id))).all()
    return [serialize_deposit(d, db) for d in deposits]

@app.get("/api/tenants/{tenant_id}/deposits", response_model=List[DepositOut])
def get_tenant_deposits(
    tenant_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    deposits = db.scalars(
        select(Deposit).where(Deposit.tenant_id == tenant_id).order_by(desc(Deposit.id))
    ).all()
    return [serialize_deposit(d, db) for d in deposits]

@app.post("/api/deposits/{deposit_id}/adjust", response_model=DepositOut)
def adjust_deposit(
    deposit_id: int,
    data: DepositAdjustRequest,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    deposit = db.get(Deposit, deposit_id)
    if not deposit:
        raise HTTPException(404, "Deposit record not found.")
    if data.amount > deposit.remaining_balance:
        raise HTTPException(400, f"Adjustment amount (Rs. {data.amount:,.2f}) exceeds available balance (Rs. {deposit.remaining_balance:,.2f}).")

    invoice = db.get(RentInvoice, data.invoice_id)
    if not invoice:
        raise HTTPException(404, "Target invoice not found.")
    if invoice.tenant_id != deposit.tenant_id:
        raise HTTPException(400, "Invoice and deposit belong to different tenants.")
    if data.amount > invoice.pending_amount:
        raise HTTPException(400, f"Adjustment amount (Rs. {data.amount:,.2f}) exceeds pending invoice amount (Rs. {invoice.pending_amount:,.2f}).")

    # Update deposit balance
    deposit.adjusted_amount += data.amount
    deposit.remaining_balance = round(deposit.remaining_balance - data.amount, 2)
    if deposit.remaining_balance == 0.0:
        deposit.status = "Fully Adjusted"
    else:
        deposit.status = "Partially Adjusted"

    today_str = datetime.now().strftime("%Y-%m-%d")

    # Record Deposit Transaction
    db.add(DepositTransaction(
        deposit_id=deposit.id,
        transaction_type="Adjustment",
        amount=data.amount,
        transaction_date=today_str,
        linked_invoice_id=invoice.id,
        reason=data.reason.strip(),
        recorded_by=user.username
    ))

    # Apply to invoice
    invoice.amount_paid += data.amount
    invoice.pending_amount = max(0.0, round(invoice.pending_amount - data.amount, 2))
    if invoice.pending_amount == 0.0:
        invoice.status = "Paid"
    else:
        invoice.status = "Partially Paid"

    # Also record payment voucher for the adjustment
    pay_num = get_next_payment_number(db, today_str)
    rec_num = get_next_receipt_number(db, today_str)
    payment = Payment(
        payment_number=pay_num,
        tenant_id=deposit.tenant_id,
        invoice_id=invoice.id,
        payment_date=today_str,
        amount=data.amount,
        payment_type=f"{deposit.deposit_type} Adjustment",
        payment_mode="Deposit Adjustment",
        transaction_ref=deposit.deposit_number,
        notes=f"Adjusted from {deposit.deposit_number}: {data.reason}",
        receipt_number=rec_num,
        is_cancelled=False
    )
    db.add(payment)

    db.add(FinancialAuditLog(
        entity_type="Deposit",
        entity_id=deposit.id,
        action="Adjust",
        amount=data.amount,
        performed_by=user.username,
        reason=data.reason.strip(),
        details_json=f'{{"invoice_id":{invoice.id},"invoice_number":"{invoice.invoice_number}"}}'
    ))

    db.commit()
    db.refresh(deposit)
    return serialize_deposit(deposit, db)

@app.post("/api/deposits/{deposit_id}/refund", response_model=DepositOut)
def refund_deposit(
    deposit_id: int,
    data: DepositRefundRequest,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    deposit = db.get(Deposit, deposit_id)
    if not deposit:
        raise HTTPException(404, "Deposit record not found.")
    if data.amount > deposit.remaining_balance:
        raise HTTPException(400, f"Refund amount (Rs. {data.amount:,.2f}) exceeds refundable balance (Rs. {deposit.remaining_balance:,.2f}).")

    deposit.refunded_amount += data.amount
    deposit.remaining_balance = round(deposit.remaining_balance - data.amount, 2)
    if deposit.remaining_balance == 0.0:
        deposit.status = "Refunded"
    else:
        deposit.status = "Partially Adjusted"

    db.add(DepositTransaction(
        deposit_id=deposit.id,
        transaction_type="Refund",
        amount=data.amount,
        transaction_date=data.refund_date,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        reason=data.reason.strip(),
        recorded_by=user.username
    ))

    db.add(FinancialAuditLog(
        entity_type="Deposit",
        entity_id=deposit.id,
        action="Refund",
        amount=data.amount,
        performed_by=user.username,
        reason=data.reason.strip(),
        details_json=f'{{"refund_mode":"{data.payment_mode}","transaction_ref":"{data.transaction_ref}"}}'
    ))

    db.commit()
    db.refresh(deposit)
    return serialize_deposit(deposit, db)


# ==========================================
# PHASE 3: EXPENSE MANAGEMENT
# ==========================================

@app.post("/api/expenses", response_model=ExpenseOut)
def create_expense(
    data: ExpenseCreate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    if data.amount <= 0:
        raise HTTPException(400, "Expense amount must be greater than zero.")

    exp_num = get_next_expense_number(db, data.expense_date)
    expense = Expense(
        expense_number=exp_num,
        title=data.title.strip(),
        category=data.category,
        description=data.description,
        amount=data.amount,
        expense_date=data.expense_date,
        payment_mode=data.payment_mode,
        paid_to=data.paid_to,
        reference_number=data.reference_number,
        remarks=data.remarks,
        is_deleted=False
    )
    db.add(expense)
    db.flush()

    db.add(FinancialAuditLog(
        entity_type="Expense",
        entity_id=expense.id,
        action="Payment",
        amount=data.amount,
        performed_by=user.username,
        reason=f"Recorded expense: {data.title}",
        details_json=f'{{"expense_number":"{exp_num}","category":"{data.category}"}}'
    ))

    db.commit()
    db.refresh(expense)
    return expense

@app.get("/api/expenses", response_model=List[ExpenseOut])
def get_expenses(
    category: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Expense).where(Expense.is_deleted == False)
    if category and category.lower() != "all":
        query = query.where(Expense.category.ilike(category))
    if date_from:
        query = query.where(Expense.expense_date >= date_from)
    if date_to:
        query = query.where(Expense.expense_date <= date_to)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                Expense.title.ilike(s),
                Expense.expense_number.ilike(s),
                Expense.paid_to.ilike(s),
                Expense.reference_number.ilike(s)
            )
        )

    expenses = db.scalars(query.order_by(desc(Expense.expense_date), desc(Expense.id))).all()
    # Filter by month/year in memory or sql
    if month or year:
        filtered = []
        for e in expenses:
            try:
                dt = datetime.strptime(e.expense_date, "%Y-%m-%d")
                if month and dt.month != month: continue
                if year and dt.year != year: continue
                filtered.append(e)
            except Exception:
                filtered.append(e)
        return filtered

    return expenses

@app.put("/api/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    expense = db.get(Expense, expense_id)
    if not expense or expense.is_deleted:
        raise HTTPException(404, "Expense not found.")

    update_dict = data.dict(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            setattr(expense, field, val)

    db.add(FinancialAuditLog(
        entity_type="Expense",
        entity_id=expense.id,
        action="Edit",
        amount=expense.amount,
        performed_by=user.username,
        reason="Updated expense details",
        details_json=f'{{"expense_number":"{expense.expense_number}"}}'
    ))

    db.commit()
    db.refresh(expense)
    return expense

@app.delete("/api/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    expense = db.get(Expense, expense_id)
    if not expense or expense.is_deleted:
        raise HTTPException(404, "Expense not found.")

    expense.is_deleted = True
    db.add(FinancialAuditLog(
        entity_type="Expense",
        entity_id=expense.id,
        action="Delete",
        amount=expense.amount,
        performed_by=user.username,
        reason="Soft-deleted expense record",
        details_json=f'{{"expense_number":"{expense.expense_number}"}}'
    ))
    db.commit()
    return {"status": "deleted", "expense_id": expense_id}


# ==========================================
# PHASE 3: RECEIPTS & PDF ACCESS
# ==========================================

@app.get("/api/receipts", response_model=List[ReceiptOut])
def get_receipts(
    tenant_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    query = select(Receipt)
    if tenant_id:
        query = query.where(Receipt.tenant_id == tenant_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.join(Tenant).where(
            or_(
                Receipt.receipt_number.ilike(s),
                Tenant.full_name.ilike(s),
                Tenant.tenant_code.ilike(s)
            )
        )

    receipts = db.scalars(query.order_by(desc(Receipt.id))).all()
    results = []
    for r in receipts:
        p = db.get(Payment, r.payment_id)
        t = db.get(Tenant, r.tenant_id)
        room_str = "N/A"
        bed_str = "N/A"
        period = "N/A"

        if p and p.invoice_id:
            inv = db.get(RentInvoice, p.invoice_id)
            if inv:
                period = f"{calendar.month_name[inv.billing_month]} {inv.billing_year}"
                rm = db.get(Room, inv.room_id)
                bd = db.get(Bed, inv.bed_id)
                if rm: room_str = rm.room_number
                if bd: bed_str = bd.bed_number
        elif t:
            alloc = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == t.id, BedAllocation.is_active == True))
            if alloc:
                rm = db.get(Room, alloc.room_id)
                bd = db.get(Bed, alloc.bed_id)
                if rm: room_str = rm.room_number
                if bd: bed_str = bd.bed_number

        results.append({
            "id": r.id,
            "receipt_number": r.receipt_number,
            "payment_id": r.payment_id,
            "payment_number": p.payment_number if p else "N/A",
            "tenant_id": r.tenant_id,
            "tenant_name": t.full_name if t else "N/A",
            "tenant_code": t.tenant_code if t else "N/A",
            "room_number": room_str,
            "bed_number": bed_str,
            "payment_type": p.payment_type if p else "General",
            "billing_period": period,
            "amount": p.amount if p else 0.0,
            "payment_mode": p.payment_mode if p else "Cash",
            "receipt_date": r.receipt_date,
            "pdf_filename": r.pdf_filename
        })
    return results

@app.get("/api/receipts/{receipt_id}/download")
def download_receipt(
    receipt_id: int,
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    receipt = db.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found.")

    filepath = RECEIPTS / receipt.pdf_filename
    if not filepath.exists():
        # Re-generate PDF receipt on demand
        payment = db.get(Payment, receipt.payment_id)
        tenant = db.get(Tenant, receipt.tenant_id)
        if payment and tenant:
            room_str = "N/A"
            bed_str = "N/A"
            period = "General Collection"
            if payment.invoice_id:
                inv = db.get(RentInvoice, payment.invoice_id)
                if inv:
                    period = f"{calendar.month_name[inv.billing_month]} {inv.billing_year}"
                    rm = db.get(Room, inv.room_id)
                    bd = db.get(Bed, inv.bed_id)
                    if rm: room_str = rm.room_number
                    if bd: bed_str = bd.bed_number

            generate_pdf_receipt(
                receipt_number=receipt.receipt_number,
                payment_number=payment.payment_number,
                payment_date=payment.payment_date,
                tenant_name=tenant.full_name,
                tenant_code=tenant.tenant_code,
                room_number=room_str,
                bed_number=bed_str,
                payment_type=payment.payment_type,
                billing_period=period,
                amount_paid=payment.amount,
                payment_mode=payment.payment_mode,
                transaction_ref=payment.transaction_ref,
                previous_balance=payment.amount,
                remaining_balance=0.0,
                received_by=user.username
            )

    return FileResponse(
        path=str(filepath),
        filename=receipt.pdf_filename,
        media_type="application/pdf"
    )


# ==========================================
# PHASE 3: FINANCIAL DASHBOARD & REPORTS
# ==========================================

@app.get("/api/financial/dashboard", response_model=FinancialDashboardOut)
def get_financial_dashboard(
    period: str = Query("this_month"), # this_month, last_month, this_year, all
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    now = datetime.now()
    if period == "this_month":
        s_date = f"{now.year}-{now.month:02d}-01"
        days_in_m = calendar.monthrange(now.year, now.month)[1]
        e_date = f"{now.year}-{now.month:02d}-{days_in_m:02d}"
    elif period == "last_month":
        lm_year = now.year if now.month > 1 else now.year - 1
        lm_month = now.month - 1 if now.month > 1 else 12
        days_in_m = calendar.monthrange(lm_year, lm_month)[1]
        s_date = f"{lm_year}-{lm_month:02d}-01"
        e_date = f"{lm_year}-{lm_month:02d}-{days_in_m:02d}"
    elif period == "this_year":
        s_date = f"{now.year}-01-01"
        e_date = f"{now.year}-12-31"
    elif period == "custom" and start_date and end_date:
        s_date = start_date
        e_date = end_date
    else:
        # All time
        s_date = "2020-01-01"
        e_date = "2050-12-31"

    # Rent expected in period
    rent_expected = db.scalar(
        select(func.sum(RentInvoice.total_amount)).where(
            RentInvoice.billing_date >= s_date,
            RentInvoice.billing_date <= e_date
        )
    ) or 0.0

    # Rent collected in period
    rent_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.payment_type == "Monthly Rent",
            Payment.is_cancelled == False,
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    # Advance collected in period
    advance_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.payment_type == "Advance",
            Payment.is_cancelled == False,
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    # Security deposits collected in period (Liability!)
    sec_deposits_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.payment_type == "Security Deposit",
            Payment.is_cancelled == False,
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    other_income = db.scalar(
        select(func.sum(Payment.amount)).where(
            ~Payment.payment_type.in_(["Monthly Rent", "Advance", "Security Deposit", "Refund"]),
            Payment.is_cancelled == False,
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    # Operating income = Rent + Advance (realized) + Other Income. EXCLUDES SECURITY DEPOSITS!
    total_operating_income = rent_collected + advance_collected + other_income

    # Outstanding dues
    total_pending_rent = db.scalar(
        select(func.sum(RentInvoice.pending_amount)).where(RentInvoice.pending_amount > 0)
    ) or 0.0

    today_str = now.strftime("%Y-%m-%d")
    overdue_rent = db.scalar(
        select(func.sum(RentInvoice.pending_amount)).where(
            RentInvoice.pending_amount > 0,
            RentInvoice.due_date < today_str
        )
    ) or 0.0

    # Total refundable deposits held currently
    refundable_deposits_held = db.scalar(
        select(func.sum(Deposit.remaining_balance)).where(Deposit.status != "Refunded")
    ) or 0.0

    # Monthly & Yearly Expenses
    cur_m_start = f"{now.year}-{now.month:02d}-01"
    cur_m_end = f"{now.year}-{now.month:02d}-{calendar.monthrange(now.year, now.month)[1]:02d}"
    monthly_expenses = db.scalar(
        select(func.sum(Expense.amount)).where(
            Expense.is_deleted == False,
            Expense.expense_date >= cur_m_start,
            Expense.expense_date <= cur_m_end
        )
    ) or 0.0

    yearly_expenses = db.scalar(
        select(func.sum(Expense.amount)).where(
            Expense.is_deleted == False,
            Expense.expense_date >= f"{now.year}-01-01",
            Expense.expense_date <= f"{now.year}-12-31"
        )
    ) or 0.0

    period_expenses = db.scalar(
        select(func.sum(Expense.amount)).where(
            Expense.is_deleted == False,
            Expense.expense_date >= s_date,
            Expense.expense_date <= e_date
        )
    ) or 0.0

    # Category breakdown for period
    cat_rows = db.execute(
        select(Expense.category, func.sum(Expense.amount))
        .where(Expense.is_deleted == False, Expense.expense_date >= s_date, Expense.expense_date <= e_date)
        .group_by(Expense.category)
        .order_by(desc(func.sum(Expense.amount)))
    ).all()

    breakdown = []
    for cat, total in cat_rows:
        pct = round((total / period_expenses * 100), 1) if period_expenses > 0 else 0.0
        breakdown.append({
            "category": cat,
            "amount": round(total, 2),
            "percentage": pct
        })

    # Net Operating Income
    net_operating_income = round(total_operating_income - period_expenses, 2)

    # Payment modes breakdown for period
    cash_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.is_cancelled == False,
            Payment.payment_mode == "Cash",
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    upi_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.is_cancelled == False,
            Payment.payment_mode == "UPI",
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    bank_collected = db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.is_cancelled == False,
            Payment.payment_mode == "Bank Transfer",
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date
        )
    ) or 0.0

    return {
        "total_rent_expected": round(rent_expected, 2),
        "total_rent_collected": round(rent_collected, 2),
        "advance_collected": round(advance_collected, 2),
        "security_deposits_collected": round(sec_deposits_collected, 2),
        "other_income": round(other_income, 2),
        "total_operating_income": round(total_operating_income, 2),
        "total_pending_rent": round(total_pending_rent, 2),
        "overdue_rent": round(overdue_rent, 2),
        "outstanding_tenant_dues": round(total_pending_rent, 2),
        "refundable_deposits_held": round(refundable_deposits_held, 2),
        "total_monthly_expenses": round(monthly_expenses, 2),
        "total_yearly_expenses": round(yearly_expenses, 2),
        "expense_breakdown": breakdown,
        "net_operating_income": net_operating_income,
        "cash_collected": round(cash_collected, 2),
        "upi_collected": round(upi_collected, 2),
        "bank_transfers_collected": round(bank_collected, 2),
        "filter_period": period,
        "start_date": s_date,
        "end_date": e_date
    }

@app.get("/api/reports/monthly-collection")
def get_monthly_collection_report(
    year: int = Query(2026),
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    results = []
    for m in range(1, 13):
        expected = db.scalar(
            select(func.sum(RentInvoice.total_amount)).where(
                RentInvoice.billing_year == year, RentInvoice.billing_month == m
            )
        ) or 0.0
        paid = db.scalar(
            select(func.sum(RentInvoice.amount_paid)).where(
                RentInvoice.billing_year == year, RentInvoice.billing_month == m
            )
        ) or 0.0
        pending = db.scalar(
            select(func.sum(RentInvoice.pending_amount)).where(
                RentInvoice.billing_year == year, RentInvoice.billing_month == m
            )
        ) or 0.0
        rate = round((paid / expected * 100), 1) if expected > 0 else 0.0

        results.append({
            "month_num": m,
            "month_name": calendar.month_name[m],
            "year": year,
            "expected_rent": round(expected, 2),
            "collected_rent": round(paid, 2),
            "pending_rent": round(pending, 2),
            "collection_rate": rate
        })
    return results

@app.get("/api/reports/tenant-outstanding")
def get_tenant_outstanding_report(
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        select(Tenant, func.sum(RentInvoice.pending_amount), func.count(RentInvoice.id))
        .join(RentInvoice, RentInvoice.tenant_id == Tenant.id)
        .where(RentInvoice.pending_amount > 0)
        .group_by(Tenant.id)
        .order_by(desc(func.sum(RentInvoice.pending_amount)))
    ).all()

    results = []
    for t, total_due, count_inv in rows:
        alloc = db.scalar(select(BedAllocation).where(BedAllocation.tenant_id == t.id, BedAllocation.is_active == True))
        room_str = "N/A"
        bed_str = "N/A"
        if alloc:
            r = db.get(Room, alloc.room_id)
            b = db.get(Bed, alloc.bed_id)
            if r: room_str = r.room_number
            if b: bed_str = b.bed_number

        results.append({
            "tenant_id": t.id,
            "tenant_code": t.tenant_code,
            "tenant_name": t.full_name,
            "mobile": t.mobile,
            "room_number": room_str,
            "bed_number": bed_str,
            "status": t.status,
            "pending_invoices_count": count_inv,
            "total_outstanding_amount": round(total_due, 2)
        })
    return results


# ==========================================
# PHASE 2: DASHBOARD INTEGRATION
# ==========================================

@app.get("/api/dashboard", response_model=DashboardOut)
def get_dashboard(
    user: User = Depends(authenticated_user),
    db: Session = Depends(get_db)
):
    total_rooms = db.scalar(select(func.count(Room.id))) or 0
    total_beds = db.scalar(select(func.count(Bed.id))) or 0
    occupied_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Occupied")) or 0
    available_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Available")) or 0
    maintenance_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Maintenance")) or 0

    active_tenants = db.scalar(select(func.count(Tenant.id)).where(Tenant.status == "Active")) or 0
    vacated_tenants = db.scalar(select(func.count(Tenant.id)).where(Tenant.status == "Vacated")) or 0
    pending_tenants = db.scalar(select(func.count(Tenant.id)).where(Tenant.status == "Pending")) or 0

    registered_users = db.scalar(select(func.count(User.id))) or 1
    occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0

    rooms = db.scalars(select(Room).order_by(Room.floor, Room.room_number)).all()
    room_items = []
    for r in rooms:
        beds = db.scalars(select(Bed).where(Bed.room_id == r.id)).all()
        occ_beds = [b for b in beds if b.status == "Occupied"]
        avail_beds = [b for b in beds if b.status == "Available"]

        occupant_names = []
        for b in occ_beds:
            alloc = db.scalar(select(BedAllocation).where(BedAllocation.bed_id == b.id, BedAllocation.is_active == True))
            if alloc:
                t = db.get(Tenant, alloc.tenant_id)
                if t:
                    occupant_names.append(f"{t.full_name} ({b.bed_number})")

        room_items.append({
            "id": r.id,
            "room_number": r.room_number,
            "floor": r.floor,
            "room_type": r.room_type,
            "capacity": r.capacity,
            "occupied_count": len(occ_beds),
            "available_count": len(avail_beds),
            "status": r.status,
            "monthly_rent": r.monthly_rent,
            "occupants": occupant_names
        })

    return {
        "property_name": APP_NAME,
        "total_rooms": total_rooms,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "maintenance_beds": maintenance_beds,
        "active_tenants": active_tenants,
        "vacated_tenants": vacated_tenants,
        "pending_tenants": pending_tenants,
        "occupancy_rate": occupancy_rate,
        "room_overview": room_items,
        "registered_users": registered_users
    }


# ==========================================
# PHASE 4: SERVICES & FACILITIES MODULES
# ==========================================

def get_tenant_active_room_bed(db: Session, tenant_id: int):
    alloc = db.scalar(
        select(BedAllocation)
        .where(BedAllocation.tenant_id == tenant_id, BedAllocation.is_active == True)
        .order_by(desc(BedAllocation.id))
    )
    if alloc:
        room = db.get(Room, alloc.room_id)
        bed = db.get(Bed, alloc.bed_id)
        return (room.room_number if room else "N/A", bed.bed_number if bed else "N/A")
    return ("N/A", "N/A")

def log_service_audit(db: Session, entity_type: str, entity_id: int, action: str, user_name: str, details: str = None):
    audit = ServiceAuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        performed_by=user_name,
        details_json=details
    )
    db.add(audit)

# ------------------------------------------
# 1. FOOD PLANS & SUBSCRIPTIONS
# ------------------------------------------

@app.get("/api/food/plans", response_model=List[FoodPlanOut])
def get_food_plans(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    plans = db.scalars(select(FoodPlan).order_by(FoodPlan.id)).all()
    out = []
    for p in plans:
        sub_count = db.scalar(
            select(func.count(FoodSubscription.id))
            .where(FoodSubscription.plan_id == p.id, FoodSubscription.status == "Active")
        ) or 0
        out.append(FoodPlanOut(
            id=p.id,
            plan_code=p.plan_code,
            plan_name=p.plan_name,
            description=p.description,
            monthly_price=p.monthly_price,
            daily_price=p.daily_price or 0.0,
            included_meals=p.included_meals,
            is_active=p.is_active,
            active_subscriptions_count=sub_count,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return out

@app.post("/api/food/plans", response_model=FoodPlanOut)
def create_food_plan(data: FoodPlanCreate, db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    existing = db.scalar(select(FoodPlan).where(FoodPlan.plan_code == data.plan_code.strip()))
    if existing:
        raise HTTPException(400, f"Food plan with code '{data.plan_code}' already exists.")
    
    plan = FoodPlan(
        plan_code=data.plan_code.strip().upper(),
        plan_name=data.plan_name.strip(),
        description=data.description,
        monthly_price=float(data.monthly_price),
        daily_price=float(data.daily_price or 0.0),
        included_meals=data.included_meals,
        is_active=data.is_active
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    log_service_audit(db, "FoodPlan", plan.id, "Create", current_user.username, f"Created {plan.plan_name}")
    db.commit()

    return FoodPlanOut(
        id=plan.id,
        plan_code=plan.plan_code,
        plan_name=plan.plan_name,
        description=plan.description,
        monthly_price=plan.monthly_price,
        daily_price=plan.daily_price or 0.0,
        included_meals=plan.included_meals,
        is_active=plan.is_active,
        active_subscriptions_count=0,
        created_at=plan.created_at,
        updated_at=plan.updated_at
    )

@app.put("/api/food/plans/{plan_id}", response_model=FoodPlanOut)
def update_food_plan(plan_id: int, data: FoodPlanUpdate, db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    plan = db.get(FoodPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Food plan not found.")
    
    if data.plan_name is not None:
        plan.plan_name = data.plan_name.strip()
    if data.description is not None:
        plan.description = data.description
    if data.monthly_price is not None:
        plan.monthly_price = float(data.monthly_price)
    if data.daily_price is not None:
        plan.daily_price = float(data.daily_price)
    if data.included_meals is not None:
        plan.included_meals = data.included_meals
    if data.is_active is not None:
        plan.is_active = data.is_active

    db.commit()
    db.refresh(plan)
    log_service_audit(db, "FoodPlan", plan.id, "Update", current_user.username, f"Updated {plan.plan_name}")
    db.commit()

    sub_count = db.scalar(
        select(func.count(FoodSubscription.id))
        .where(FoodSubscription.plan_id == plan.id, FoodSubscription.status == "Active")
    ) or 0

    return FoodPlanOut(
        id=plan.id,
        plan_code=plan.plan_code,
        plan_name=plan.plan_name,
        description=plan.description,
        monthly_price=plan.monthly_price,
        daily_price=plan.daily_price or 0.0,
        included_meals=plan.included_meals,
        is_active=plan.is_active,
        active_subscriptions_count=sub_count,
        created_at=plan.created_at,
        updated_at=plan.updated_at
    )

@app.get("/api/food/subscriptions", response_model=List[FoodSubscriptionOut])
def get_food_subscriptions(
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(FoodSubscription).order_by(desc(FoodSubscription.id))
    if tenant_id:
        query = query.where(FoodSubscription.tenant_id == tenant_id)
    if status and status != "All":
        query = query.where(FoodSubscription.status == status)
    
    subs = db.scalars(query).all()
    results = []
    for s in subs:
        t = db.get(Tenant, s.tenant_id)
        p = db.get(FoodPlan, s.plan_id)
        room_no, _ = get_tenant_active_room_bed(db, s.tenant_id)
        results.append(FoodSubscriptionOut(
            id=s.id,
            subscription_number=s.subscription_number,
            tenant_id=s.tenant_id,
            tenant_name=t.full_name if t else "Unknown",
            tenant_code=t.tenant_code if t else "N/A",
            room_number=room_no,
            plan_id=s.plan_id,
            plan_name=p.plan_name if p else "Unknown",
            start_date=s.start_date,
            end_date=s.end_date,
            monthly_price=s.monthly_price,
            status=s.status,
            billing_frequency=s.billing_frequency,
            remarks=s.remarks,
            created_at=s.created_at
        ))
    return results

@app.post("/api/food/subscriptions", response_model=FoodSubscriptionOut)
def subscribe_tenant_food(
    data: FoodSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    
    plan = db.get(FoodPlan, data.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(400, "Active food plan not found.")

    # Check for active existing subscription
    existing_sub = db.scalar(
        select(FoodSubscription)
        .where(FoodSubscription.tenant_id == data.tenant_id, FoodSubscription.status == "Active")
    )
    if existing_sub:
        raise HTTPException(400, f"Tenant already has an active subscription ({existing_sub.subscription_number}). Please cancel or change the existing plan first.")

    monthly_price = float(data.monthly_price if data.monthly_price is not None else plan.monthly_price)

    # Proration check if starting mid-month
    sub_num = f"FSUB-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    sub = FoodSubscription(
        subscription_number=sub_num,
        tenant_id=data.tenant_id,
        plan_id=data.plan_id,
        start_date=data.start_date,
        end_date=data.end_date,
        monthly_price=monthly_price,
        status="Active",
        billing_frequency=data.billing_frequency,
        remarks=data.remarks
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    log_service_audit(db, "FoodSubscription", sub.id, "Create", current_user.username, f"Subscribed {tenant.full_name} to {plan.plan_name}")
    db.commit()

    room_no, _ = get_tenant_active_room_bed(db, tenant.id)
    return FoodSubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        tenant_id=sub.tenant_id,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        room_number=room_no,
        plan_id=sub.plan_id,
        plan_name=plan.plan_name,
        start_date=sub.start_date,
        end_date=sub.end_date,
        monthly_price=sub.monthly_price,
        status=sub.status,
        billing_frequency=sub.billing_frequency,
        remarks=sub.remarks,
        created_at=sub.created_at
    )

@app.put("/api/food/subscriptions/{subscription_id}", response_model=FoodSubscriptionOut)
def update_food_subscription(
    subscription_id: int,
    data: FoodSubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    sub = db.get(FoodSubscription, subscription_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")

    if data.plan_id is not None:
        p = db.get(FoodPlan, data.plan_id)
        if not p:
            raise HTTPException(400, "Target food plan not found.")
        sub.plan_id = data.plan_id
        if data.monthly_price is None:
            sub.monthly_price = p.monthly_price

    if data.status is not None:
        if data.status not in ["Active", "Paused", "Cancelled"]:
            raise HTTPException(400, "Invalid status. Must be Active, Paused, or Cancelled.")
        sub.status = data.status

    if data.end_date is not None:
        sub.end_date = data.end_date
    if data.monthly_price is not None:
        sub.monthly_price = float(data.monthly_price)
    if data.remarks is not None:
        sub.remarks = data.remarks

    db.commit()
    db.refresh(sub)
    log_service_audit(db, "FoodSubscription", sub.id, "Update", current_user.username, f"Updated status={sub.status}")
    db.commit()

    tenant = db.get(Tenant, sub.tenant_id)
    plan = db.get(FoodPlan, sub.plan_id)
    room_no, _ = get_tenant_active_room_bed(db, sub.tenant_id)

    return FoodSubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        tenant_id=sub.tenant_id,
        tenant_name=tenant.full_name if tenant else "Unknown",
        tenant_code=tenant.tenant_code if tenant else "N/A",
        room_number=room_no,
        plan_id=sub.plan_id,
        plan_name=plan.plan_name if plan else "Unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        monthly_price=sub.monthly_price,
        status=sub.status,
        billing_frequency=sub.billing_frequency,
        remarks=sub.remarks,
        created_at=sub.created_at
    )

# ------------------------------------------
# DAILY MEAL MANAGEMENT
# ------------------------------------------

@app.get("/api/food/meals", response_model=List[MealRecordOut])
def get_meal_records(
    meal_date: Optional[str] = None,
    meal_type: Optional[str] = None,
    tenant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(MealRecord).order_by(desc(MealRecord.id))
    if meal_date:
        query = query.where(MealRecord.meal_date == meal_date)
    if meal_type and meal_type != "All":
        query = query.where(MealRecord.meal_type == meal_type)
    if tenant_id:
        query = query.where(MealRecord.tenant_id == tenant_id)
    
    records = db.scalars(query.limit(100)).all()
    results = []
    for r in records:
        t_name = None
        if r.tenant_id:
            t = db.get(Tenant, r.tenant_id)
            t_name = t.full_name if t else None
        results.append(MealRecordOut(
            id=r.id,
            meal_date=r.meal_date,
            meal_type=r.meal_type,
            tenant_id=r.tenant_id,
            tenant_name=t_name,
            status=r.status,
            extra_charge=r.extra_charge,
            remarks=r.remarks,
            recorded_by=r.recorded_by,
            created_at=r.created_at
        ))
    return results

@app.post("/api/food/meals", response_model=MealRecordOut)
def record_daily_meal(
    data: MealRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    t_name = None
    if data.tenant_id:
        t = db.get(Tenant, data.tenant_id)
        if not t:
            raise HTTPException(404, "Tenant not found.")
        t_name = t.full_name

    rec = MealRecord(
        meal_date=data.meal_date,
        meal_type=data.meal_type,
        tenant_id=data.tenant_id,
        status=data.status,
        extra_charge=float(data.extra_charge),
        remarks=data.remarks,
        recorded_by=current_user.username
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return MealRecordOut(
        id=rec.id,
        meal_date=rec.meal_date,
        meal_type=rec.meal_type,
        tenant_id=rec.tenant_id,
        tenant_name=t_name,
        status=rec.status,
        extra_charge=rec.extra_charge,
        remarks=rec.remarks,
        recorded_by=rec.recorded_by,
        created_at=rec.created_at
    )

@app.get("/api/food/meals/summary", response_model=DailyMealSummaryOut)
def get_daily_meal_summary(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    records = db.scalars(select(MealRecord).where(MealRecord.meal_date == target_date)).all()

    bf = sum(1 for r in records if r.meal_type == "Breakfast" and r.status in ["Served", "Attended"])
    lunch = sum(1 for r in records if r.meal_type == "Lunch" and r.status in ["Served", "Attended"])
    dinner = sum(1 for r in records if r.meal_type == "Dinner" and r.status in ["Served", "Attended"])
    opted_out = sum(1 for r in records if r.status == "Opted Out")
    extra = sum(1 for r in records if r.status == "Additional Request")
    extra_charges = sum(r.extra_charge for r in records)

    return DailyMealSummaryOut(
        meal_date=target_date,
        breakfast_count=bf,
        lunch_count=lunch,
        dinner_count=dinner,
        opted_out_count=opted_out,
        additional_requests_count=extra,
        total_extra_charges=round(extra_charges, 2)
    )

# ------------------------------------------
# 2. WI-FI SERVICE & SUBSCRIPTIONS
# ------------------------------------------

@app.get("/api/services/wifi", response_model=List[WifiServiceOut])
def get_wifi_services(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    services = db.scalars(select(WifiService).order_by(WifiService.id)).all()
    out = []
    for s in services:
        sub_count = db.scalar(
            select(func.count(WifiSubscription.id))
            .where(WifiSubscription.wifi_service_id == s.id, WifiSubscription.status == "Active")
        ) or 0
        out.append(WifiServiceOut(
            id=s.id,
            network_name=s.network_name,
            description=s.description,
            monthly_charge=s.monthly_charge,
            is_active=s.is_active,
            subscribers_count=sub_count,
            created_at=s.created_at
        ))
    return out

@app.post("/api/services/wifi", response_model=WifiServiceOut)
def create_wifi_service(data: WifiServiceCreate, db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    existing = db.scalar(select(WifiService).where(WifiService.network_name == data.network_name.strip()))
    if existing:
        raise HTTPException(400, "Wi-Fi service with this network name already exists.")

    srv = WifiService(
        network_name=data.network_name.strip(),
        description=data.description,
        monthly_charge=float(data.monthly_charge),
        is_active=data.is_active
    )
    db.add(srv)
    db.commit()
    db.refresh(srv)
    log_service_audit(db, "WifiService", srv.id, "Create", current_user.username, f"Created {srv.network_name}")
    db.commit()

    return WifiServiceOut(
        id=srv.id,
        network_name=srv.network_name,
        description=srv.description,
        monthly_charge=srv.monthly_charge,
        is_active=srv.is_active,
        subscribers_count=0,
        created_at=srv.created_at
    )

@app.get("/api/services/wifi/subscriptions", response_model=List[WifiSubscriptionOut])
def get_wifi_subscriptions(
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(WifiSubscription).order_by(desc(WifiSubscription.id))
    if tenant_id:
        query = query.where(WifiSubscription.tenant_id == tenant_id)
    if status and status != "All":
        query = query.where(WifiSubscription.status == status)

    subs = db.scalars(query).all()
    results = []
    for s in subs:
        t = db.get(Tenant, s.tenant_id)
        srv = db.get(WifiService, s.wifi_service_id)
        room_no, _ = get_tenant_active_room_bed(db, s.tenant_id)
        results.append(WifiSubscriptionOut(
            id=s.id,
            subscription_number=s.subscription_number,
            tenant_id=s.tenant_id,
            tenant_name=t.full_name if t else "Unknown",
            tenant_code=t.tenant_code if t else "N/A",
            room_number=room_no,
            wifi_service_id=s.wifi_service_id,
            network_name=srv.network_name if srv else "Unknown",
            activation_date=s.activation_date,
            deactivation_date=s.deactivation_date,
            monthly_charge=s.monthly_charge,
            included_in_rent=s.included_in_rent,
            status=s.status,
            remarks=s.remarks
        ))
    return results

@app.post("/api/services/wifi/subscriptions", response_model=WifiSubscriptionOut)
def subscribe_tenant_wifi(
    data: WifiSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    
    srv = db.get(WifiService, data.wifi_service_id)
    if not srv or not srv.is_active:
        raise HTTPException(400, "Active Wi-Fi service not found.")

    existing = db.scalar(
        select(WifiSubscription)
        .where(WifiSubscription.tenant_id == data.tenant_id, WifiSubscription.status == "Active")
    )
    if existing:
        raise HTTPException(400, f"Tenant already has active Wi-Fi subscription ({existing.subscription_number}).")

    sub_num = f"WIFI-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    charge = float(data.monthly_charge if data.monthly_charge is not None else srv.monthly_charge)

    sub = WifiSubscription(
        subscription_number=sub_num,
        tenant_id=data.tenant_id,
        wifi_service_id=data.wifi_service_id,
        activation_date=data.activation_date,
        deactivation_date=data.deactivation_date,
        monthly_charge=charge,
        included_in_rent=data.included_in_rent,
        status="Active",
        remarks=data.remarks
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    log_service_audit(db, "WifiSubscription", sub.id, "Activate", current_user.username, f"Activated Wi-Fi for {tenant.full_name}")
    db.commit()

    room_no, _ = get_tenant_active_room_bed(db, tenant.id)
    return WifiSubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        tenant_id=sub.tenant_id,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        room_number=room_no,
        wifi_service_id=sub.wifi_service_id,
        network_name=srv.network_name,
        activation_date=sub.activation_date,
        deactivation_date=sub.deactivation_date,
        monthly_charge=sub.monthly_charge,
        included_in_rent=sub.included_in_rent,
        status=sub.status,
        remarks=sub.remarks
    )

@app.put("/api/services/wifi/subscriptions/{subscription_id}", response_model=WifiSubscriptionOut)
def update_wifi_subscription(
    subscription_id: int,
    status: Optional[str] = Query(None),
    deactivation_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    sub = db.get(WifiSubscription, subscription_id)
    if not sub:
        raise HTTPException(404, "Wi-Fi subscription not found.")

    if status:
        sub.status = status
    if deactivation_date:
        sub.deactivation_date = deactivation_date

    db.commit()
    db.refresh(sub)
    log_service_audit(db, "WifiSubscription", sub.id, "Update", current_user.username, f"Wi-Fi status={sub.status}")
    db.commit()

    t = db.get(Tenant, sub.tenant_id)
    srv = db.get(WifiService, sub.wifi_service_id)
    room_no, _ = get_tenant_active_room_bed(db, sub.tenant_id)

    return WifiSubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        tenant_id=sub.tenant_id,
        tenant_name=t.full_name if t else "Unknown",
        tenant_code=t.tenant_code if t else "N/A",
        room_number=room_no,
        wifi_service_id=sub.wifi_service_id,
        network_name=srv.network_name if srv else "Unknown",
        activation_date=sub.activation_date,
        deactivation_date=sub.deactivation_date,
        monthly_charge=sub.monthly_charge,
        included_in_rent=sub.included_in_rent,
        status=sub.status,
        remarks=sub.remarks
    )

# ------------------------------------------
# 3. PARKING MANAGEMENT
# ------------------------------------------

@app.get("/api/parking/slots", response_model=List[ParkingSlotOut])
def get_parking_slots(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    slots = db.scalars(select(ParkingSlot).order_by(ParkingSlot.slot_number)).all()
    results = []
    for s in slots:
        occ_name = None
        veh_num = None
        if s.status == "Occupied":
            alloc = db.scalar(
                select(ParkingAllocation)
                .where(ParkingAllocation.slot_id == s.id, ParkingAllocation.status == "Active")
            )
            if alloc:
                t = db.get(Tenant, alloc.tenant_id)
                occ_name = t.full_name if t else None
                veh_num = alloc.vehicle_number
        results.append(ParkingSlotOut(
            id=s.id,
            slot_number=s.slot_number,
            slot_type=s.slot_type,
            monthly_charge=s.monthly_charge,
            status=s.status,
            description=s.description,
            current_occupant_name=occ_name,
            current_vehicle_number=veh_num
        ))
    return results

@app.post("/api/parking/slots", response_model=ParkingSlotOut)
def create_parking_slot(data: ParkingSlotCreate, db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    existing = db.scalar(select(ParkingSlot).where(ParkingSlot.slot_number == data.slot_number.strip().upper()))
    if existing:
        raise HTTPException(400, f"Parking slot '{data.slot_number}' already exists.")

    slot = ParkingSlot(
        slot_number=data.slot_number.strip().upper(),
        slot_type=data.slot_type,
        monthly_charge=float(data.monthly_charge),
        status=data.status,
        description=data.description
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    log_service_audit(db, "ParkingSlot", slot.id, "Create", current_user.username, f"Created slot {slot.slot_number}")
    db.commit()

    return ParkingSlotOut(
        id=slot.id,
        slot_number=slot.slot_number,
        slot_type=slot.slot_type,
        monthly_charge=slot.monthly_charge,
        status=slot.status,
        description=slot.description
    )

@app.get("/api/parking/allocations", response_model=List[ParkingAllocationOut])
def get_parking_allocations(
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    vehicle_number: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(ParkingAllocation).order_by(desc(ParkingAllocation.id))
    if tenant_id:
        query = query.where(ParkingAllocation.tenant_id == tenant_id)
    if status and status != "All":
        query = query.where(ParkingAllocation.status == status)
    if vehicle_number:
        query = query.where(ParkingAllocation.vehicle_number.ilike(f"%{vehicle_number.strip()}%"))

    allocs = db.scalars(query).all()
    results = []
    for a in allocs:
        t = db.get(Tenant, a.tenant_id)
        s = db.get(ParkingSlot, a.slot_id)
        results.append(ParkingAllocationOut(
            id=a.id,
            allocation_number=a.allocation_number,
            tenant_id=a.tenant_id,
            tenant_name=t.full_name if t else "Unknown",
            tenant_code=t.tenant_code if t else "N/A",
            slot_id=a.slot_id,
            slot_number=s.slot_number if s else "N/A",
            vehicle_type=a.vehicle_type,
            vehicle_number=a.vehicle_number,
            allocation_date=a.allocation_date,
            release_date=a.release_date,
            monthly_charge=a.monthly_charge,
            status=a.status,
            remarks=a.remarks
        ))
    return results

@app.post("/api/parking/allocations", response_model=ParkingAllocationOut)
def allocate_parking_slot(
    data: ParkingAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")
    
    slot = db.get(ParkingSlot, data.slot_id)
    if not slot:
        raise HTTPException(404, "Parking slot not found.")
    
    if slot.status != "Available":
        raise HTTPException(400, f"Parking slot '{slot.slot_number}' is currently {slot.status}. Cannot allocate.")

    alloc_num = f"PARK-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    charge = float(data.monthly_charge if data.monthly_charge is not None else slot.monthly_charge)

    alloc = ParkingAllocation(
        allocation_number=alloc_num,
        tenant_id=data.tenant_id,
        slot_id=data.slot_id,
        vehicle_type=data.vehicle_type,
        vehicle_number=data.vehicle_number.strip().upper(),
        allocation_date=data.allocation_date,
        monthly_charge=charge,
        status="Active",
        remarks=data.remarks
    )
    db.add(alloc)
    slot.status = "Occupied"
    db.commit()
    db.refresh(alloc)
    log_service_audit(db, "ParkingAllocation", alloc.id, "Allocate", current_user.username, f"Allocated slot {slot.slot_number} to {tenant.full_name}")
    db.commit()

    return ParkingAllocationOut(
        id=alloc.id,
        allocation_number=alloc.allocation_number,
        tenant_id=alloc.tenant_id,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        slot_id=alloc.slot_id,
        slot_number=slot.slot_number,
        vehicle_type=alloc.vehicle_type,
        vehicle_number=alloc.vehicle_number,
        allocation_date=alloc.allocation_date,
        release_date=alloc.release_date,
        monthly_charge=alloc.monthly_charge,
        status=alloc.status,
        remarks=alloc.remarks
    )

@app.post("/api/parking/allocations/{allocation_id}/release", response_model=ParkingAllocationOut)
def release_parking_allocation(
    allocation_id: int,
    data: ParkingReleaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    alloc = db.get(ParkingAllocation, allocation_id)
    if not alloc:
        raise HTTPException(404, "Parking allocation not found.")

    if alloc.status == "Released":
        raise HTTPException(400, "This parking slot allocation is already released.")

    alloc.status = "Released"
    alloc.release_date = data.release_date
    if data.remarks:
        alloc.remarks = f"{alloc.remarks or ''} | Released: {data.remarks}".strip(" |")

    slot = db.get(ParkingSlot, alloc.slot_id)
    if slot:
        slot.status = "Available"

    db.commit()
    db.refresh(alloc)
    log_service_audit(db, "ParkingAllocation", alloc.id, "Release", current_user.username, f"Released slot {slot.slot_number if slot else ''}")
    db.commit()

    tenant = db.get(Tenant, alloc.tenant_id)
    return ParkingAllocationOut(
        id=alloc.id,
        allocation_number=alloc.allocation_number,
        tenant_id=alloc.tenant_id,
        tenant_name=tenant.full_name if tenant else "Unknown",
        tenant_code=tenant.tenant_code if tenant else "N/A",
        slot_id=alloc.slot_id,
        slot_number=slot.slot_number if slot else "N/A",
        vehicle_type=alloc.vehicle_type,
        vehicle_number=alloc.vehicle_number,
        allocation_date=alloc.allocation_date,
        release_date=alloc.release_date,
        monthly_charge=alloc.monthly_charge,
        status=alloc.status,
        remarks=alloc.remarks
    )

# ------------------------------------------
# 4. AC MANAGEMENT
# ------------------------------------------

@app.get("/api/services/ac")
def get_ac_overview(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    rooms = db.scalars(select(Room).order_by(Room.room_number)).all()
    results = []
    for r in rooms:
        ac_subs = db.scalars(select(AcSubscription).where(AcSubscription.room_id == r.id, AcSubscription.status == "Active")).all()
        results.append({
            "room_id": r.id,
            "room_number": r.room_number,
            "floor": r.floor,
            "room_type": r.room_type,
            "has_ac": r.has_ac,
            "active_subscriptions_count": len(ac_subs),
            "subscriptions": [
                {
                    "id": s.id,
                    "subscription_number": s.subscription_number,
                    "billing_rule": s.billing_rule,
                    "monthly_charge": s.monthly_charge,
                    "split_among_occupants": s.split_among_occupants,
                    "status": s.status
                } for s in ac_subs
            ]
        })
    return results

@app.post("/api/services/ac/configure-room")
def configure_room_ac(
    room_id: int = Query(...),
    has_ac: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found.")
    room.has_ac = has_ac
    db.commit()
    log_service_audit(db, "Room", room.id, "ConfigureAC", current_user.username, f"Room {room.room_number} has_ac={has_ac}")
    db.commit()
    return {"message": f"Room {room.room_number} AC configuration set to {has_ac}"}

@app.get("/api/services/ac/subscriptions", response_model=List[AcSubscriptionOut])
def get_ac_subscriptions(
    room_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(AcSubscription).order_by(desc(AcSubscription.id))
    if room_id:
        query = query.where(AcSubscription.room_id == room_id)
    if status and status != "All":
        query = query.where(AcSubscription.status == status)

    subs = db.scalars(query).all()
    results = []
    for s in subs:
        r = db.get(Room, s.room_id)
        t = db.get(Tenant, s.tenant_id) if s.tenant_id else None
        results.append(AcSubscriptionOut(
            id=s.id,
            subscription_number=s.subscription_number,
            room_id=s.room_id,
            room_number=r.room_number if r else "N/A",
            tenant_id=s.tenant_id,
            tenant_name=t.full_name if t else None,
            billing_rule=s.billing_rule,
            monthly_charge=s.monthly_charge,
            split_among_occupants=s.split_among_occupants,
            status=s.status,
            start_date=s.start_date,
            end_date=s.end_date,
            remarks=s.remarks
        ))
    return results

@app.post("/api/services/ac/subscriptions", response_model=AcSubscriptionOut)
def create_ac_subscription(
    data: AcSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    room = db.get(Room, data.room_id)
    if not room:
        raise HTTPException(404, "Room not found.")
    room.has_ac = True

    tenant = None
    if data.tenant_id:
        tenant = db.get(Tenant, data.tenant_id)

    sub_num = f"AC-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    sub = AcSubscription(
        subscription_number=sub_num,
        room_id=data.room_id,
        tenant_id=data.tenant_id,
        billing_rule=data.billing_rule,
        monthly_charge=float(data.monthly_charge),
        split_among_occupants=data.split_among_occupants,
        status="Active",
        start_date=data.start_date,
        end_date=data.end_date,
        remarks=data.remarks
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    log_service_audit(db, "AcSubscription", sub.id, "Create", current_user.username, f"AC configured for Room {room.room_number}")
    db.commit()

    return AcSubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        room_id=sub.room_id,
        room_number=room.room_number,
        tenant_id=sub.tenant_id,
        tenant_name=tenant.full_name if tenant else None,
        billing_rule=sub.billing_rule,
        monthly_charge=sub.monthly_charge,
        split_among_occupants=sub.split_among_occupants,
        status=sub.status,
        start_date=sub.start_date,
        end_date=sub.end_date,
        remarks=sub.remarks
    )

# ------------------------------------------
# 5. ELECTRICITY MANAGEMENT
# ------------------------------------------

@app.get("/api/electricity/meters", response_model=List[ElectricityMeterOut])
def get_electricity_meters(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    meters = db.scalars(select(ElectricityMeter).order_by(ElectricityMeter.id)).all()
    out = []
    for m in meters:
        r = db.get(Room, m.room_id)
        latest_rd = db.scalar(
            select(ElectricityReading.current_reading)
            .where(ElectricityReading.meter_id == m.id)
            .order_by(desc(ElectricityReading.id))
        )
        out.append(ElectricityMeterOut(
            id=m.id,
            meter_number=m.meter_number,
            room_id=m.room_id,
            room_number=r.room_number if r else "N/A",
            meter_type=m.meter_type,
            rate_per_unit=m.rate_per_unit,
            billing_method=m.billing_method,
            fixed_monthly_amount=m.fixed_monthly_amount,
            status=m.status,
            latest_reading=latest_rd
        ))
    return out

@app.post("/api/electricity/meters", response_model=ElectricityMeterOut)
def register_electricity_meter(
    data: ElectricityMeterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    room = db.get(Room, data.room_id)
    if not room:
        raise HTTPException(404, "Room not found.")

    existing = db.scalar(select(ElectricityMeter).where(ElectricityMeter.meter_number == data.meter_number.strip().upper()))
    if existing:
        raise HTTPException(400, f"Meter with number '{data.meter_number}' already registered.")

    meter = ElectricityMeter(
        meter_number=data.meter_number.strip().upper(),
        room_id=data.room_id,
        meter_type=data.meter_type,
        rate_per_unit=float(data.rate_per_unit),
        billing_method=data.billing_method,
        fixed_monthly_amount=float(data.fixed_monthly_amount),
        status=data.status
    )
    db.add(meter)
    db.commit()
    db.refresh(meter)
    log_service_audit(db, "ElectricityMeter", meter.id, "Register", current_user.username, f"Registered meter {meter.meter_number} for Room {room.room_number}")
    db.commit()

    return ElectricityMeterOut(
        id=meter.id,
        meter_number=meter.meter_number,
        room_id=meter.room_id,
        room_number=room.room_number,
        meter_type=meter.meter_type,
        rate_per_unit=meter.rate_per_unit,
        billing_method=meter.billing_method,
        fixed_monthly_amount=meter.fixed_monthly_amount,
        status=meter.status,
        latest_reading=0.0
    )

@app.get("/api/electricity/readings", response_model=List[ElectricityReadingOut])
def get_electricity_readings(
    room_id: Optional[int] = None,
    meter_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(ElectricityReading).order_by(desc(ElectricityReading.id))
    if room_id:
        query = query.where(ElectricityReading.room_id == room_id)
    if meter_id:
        query = query.where(ElectricityReading.meter_id == meter_id)
    if month:
        query = query.where(ElectricityReading.billing_month == month)
    if year:
        query = query.where(ElectricityReading.billing_year == year)

    readings = db.scalars(query).all()
    results = []
    for rd in readings:
        m = db.get(ElectricityMeter, rd.meter_id)
        r = db.get(Room, rd.room_id)
        results.append(ElectricityReadingOut(
            id=rd.id,
            reading_number=rd.reading_number,
            meter_id=rd.meter_id,
            meter_number=m.meter_number if m else "N/A",
            room_id=rd.room_id,
            room_number=r.room_number if r else "N/A",
            billing_month=rd.billing_month,
            billing_year=rd.billing_year,
            previous_reading=rd.previous_reading,
            current_reading=rd.current_reading,
            units_consumed=rd.units_consumed,
            rate_per_unit=rd.rate_per_unit,
            total_amount=rd.total_amount,
            reading_date=rd.reading_date,
            is_billed=rd.is_billed,
            remarks=rd.remarks
        ))
    return results

@app.post("/api/electricity/readings", response_model=ElectricityReadingOut)
def record_electricity_reading(
    data: ElectricityReadingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    meter = db.get(ElectricityMeter, data.meter_id)
    if not meter:
        raise HTTPException(404, "Electricity meter not found.")

    prev = data.previous_reading
    if prev is None:
        last_rd = db.scalar(
            select(ElectricityReading)
            .where(ElectricityReading.meter_id == meter.id)
            .order_by(desc(ElectricityReading.id))
        )
        prev = last_rd.current_reading if last_rd else 0.0

    if data.current_reading < prev:
        raise HTTPException(400, f"Current reading ({data.current_reading}) cannot be lower than previous reading ({prev}).")

    rate = float(data.rate_per_unit if data.rate_per_unit is not None else meter.rate_per_unit)
    units = round(float(data.current_reading) - float(prev), 2)
    tot = round(units * rate, 2)

    rd_num = f"ELEC-{data.billing_year}{data.billing_month:02d}-{meter.meter_number}-{str(int(time.time()))[-4:]}"
    reading = ElectricityReading(
        reading_number=rd_num,
        meter_id=meter.id,
        room_id=meter.room_id,
        billing_month=data.billing_month,
        billing_year=data.billing_year,
        previous_reading=float(prev),
        current_reading=float(data.current_reading),
        units_consumed=units,
        rate_per_unit=rate,
        total_amount=tot,
        reading_date=data.reading_date,
        is_billed=False,
        remarks=data.remarks
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    log_service_audit(db, "ElectricityReading", reading.id, "RecordReading", current_user.username, f"Meter {meter.meter_number}: {units} units = Rs.{tot}")
    db.commit()

    room = db.get(Room, meter.room_id)
    return ElectricityReadingOut(
        id=reading.id,
        reading_number=reading.reading_number,
        meter_id=reading.meter_id,
        meter_number=meter.meter_number,
        room_id=reading.room_id,
        room_number=room.room_number if room else "N/A",
        billing_month=reading.billing_month,
        billing_year=reading.billing_year,
        previous_reading=reading.previous_reading,
        current_reading=reading.current_reading,
        units_consumed=reading.units_consumed,
        rate_per_unit=reading.rate_per_unit,
        total_amount=reading.total_amount,
        reading_date=reading.reading_date,
        is_billed=reading.is_billed,
        remarks=reading.remarks
    )

# ------------------------------------------
# 6. ADDITIONAL SERVICES CATALOG & SUBSCRIPTIONS
# ------------------------------------------

@app.get("/api/services/catalog", response_model=List[ServiceCatalogOut])
def get_service_catalog(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    services = db.scalars(select(ServiceCatalog).order_by(ServiceCatalog.id)).all()
    results = []
    for s in services:
        cnt = db.scalar(
            select(func.count(TenantServiceSubscription.id))
            .where(TenantServiceSubscription.service_id == s.id, TenantServiceSubscription.status == "Active")
        ) or 0
        results.append(ServiceCatalogOut(
            id=s.id,
            service_code=s.service_code,
            service_name=s.service_name,
            category=s.category,
            description=s.description,
            billing_type=s.billing_type,
            price=s.price,
            billing_frequency=s.billing_frequency,
            is_active=s.is_active,
            active_subscriptions_count=cnt
        ))
    return results

@app.post("/api/services/catalog", response_model=ServiceCatalogOut)
def create_service_catalog_item(
    data: ServiceCatalogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    code = data.service_code.strip().upper()
    existing = db.scalar(select(ServiceCatalog).where(ServiceCatalog.service_code == code))
    if existing:
        raise HTTPException(400, f"Service with code '{code}' already exists.")

    item = ServiceCatalog(
        service_code=code,
        service_name=data.service_name.strip(),
        category=data.category,
        description=data.description,
        billing_type=data.billing_type,
        price=float(data.price),
        billing_frequency=data.billing_frequency,
        is_active=data.is_active
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    log_service_audit(db, "ServiceCatalog", item.id, "Create", current_user.username, f"Created {item.service_name}")
    db.commit()

    return ServiceCatalogOut(
        id=item.id,
        service_code=item.service_code,
        service_name=item.service_name,
        category=item.category,
        description=item.description,
        billing_type=item.billing_type,
        price=item.price,
        billing_frequency=item.billing_frequency,
        is_active=item.is_active,
        active_subscriptions_count=0
    )

@app.put("/api/services/catalog/{service_id}", response_model=ServiceCatalogOut)
def update_service_catalog_item(
    service_id: int,
    data: ServiceCatalogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    item = db.get(ServiceCatalog, service_id)
    if not item:
        raise HTTPException(404, "Service not found.")

    if data.service_name is not None:
        item.service_name = data.service_name.strip()
    if data.category is not None:
        item.category = data.category
    if data.description is not None:
        item.description = data.description
    if data.billing_type is not None:
        item.billing_type = data.billing_type
    if data.price is not None:
        item.price = float(data.price)
    if data.billing_frequency is not None:
        item.billing_frequency = data.billing_frequency
    if data.is_active is not None:
        item.is_active = data.is_active

    db.commit()
    db.refresh(item)
    log_service_audit(db, "ServiceCatalog", item.id, "Update", current_user.username, f"Updated {item.service_name}")
    db.commit()

    cnt = db.scalar(
        select(func.count(TenantServiceSubscription.id))
        .where(TenantServiceSubscription.service_id == item.id, TenantServiceSubscription.status == "Active")
    ) or 0

    return ServiceCatalogOut(
        id=item.id,
        service_code=item.service_code,
        service_name=item.service_name,
        category=item.category,
        description=item.description,
        billing_type=item.billing_type,
        price=item.price,
        billing_frequency=item.billing_frequency,
        is_active=item.is_active,
        active_subscriptions_count=cnt
    )

@app.get("/api/services/subscriptions", response_model=List[TenantServiceSubOut])
def get_custom_service_subscriptions(
    tenant_id: Optional[int] = None,
    service_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(TenantServiceSubscription).order_by(desc(TenantServiceSubscription.id))
    if tenant_id:
        query = query.where(TenantServiceSubscription.tenant_id == tenant_id)
    if service_id:
        query = query.where(TenantServiceSubscription.service_id == service_id)
    if status and status != "All":
        query = query.where(TenantServiceSubscription.status == status)

    subs = db.scalars(query).all()
    results = []
    for s in subs:
        t = db.get(Tenant, s.tenant_id)
        srv = db.get(ServiceCatalog, s.service_id)
        room_no, _ = get_tenant_active_room_bed(db, s.tenant_id)
        results.append(TenantServiceSubOut(
            id=s.id,
            subscription_number=s.subscription_number,
            tenant_id=s.tenant_id,
            tenant_name=t.full_name if t else "Unknown",
            tenant_code=t.tenant_code if t else "N/A",
            room_number=room_no,
            service_id=s.service_id,
            service_name=srv.service_name if srv else "Unknown",
            category=srv.category if srv else "Other",
            start_date=s.start_date,
            end_date=s.end_date,
            quantity=s.quantity,
            unit_price=s.unit_price,
            total_amount=s.total_amount,
            status=s.status,
            remarks=s.remarks
        ))
    return results

@app.post("/api/services/subscriptions", response_model=TenantServiceSubOut)
def subscribe_tenant_custom_service(
    data: TenantServiceSubCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    tenant = db.get(Tenant, data.tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    srv = db.get(ServiceCatalog, data.service_id)
    if not srv or not srv.is_active:
        raise HTTPException(400, "Active service not found in catalog.")

    unit_price = float(data.unit_price if data.unit_price is not None else srv.price)
    qty = max(1, int(data.quantity))
    tot = round(qty * unit_price, 2)

    sub_num = f"SRV-{srv.service_code}-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    sub = TenantServiceSubscription(
        subscription_number=sub_num,
        tenant_id=data.tenant_id,
        service_id=data.service_id,
        start_date=data.start_date,
        end_date=data.end_date,
        quantity=qty,
        unit_price=unit_price,
        total_amount=tot,
        status="Active",
        remarks=data.remarks
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    log_service_audit(db, "TenantServiceSubscription", sub.id, "Subscribe", current_user.username, f"Subscribed {tenant.full_name} to {srv.service_name}")
    db.commit()

    room_no, _ = get_tenant_active_room_bed(db, tenant.id)
    return TenantServiceSubOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        tenant_id=sub.tenant_id,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        room_number=room_no,
        service_id=sub.service_id,
        service_name=srv.service_name,
        category=srv.category,
        start_date=sub.start_date,
        end_date=sub.end_date,
        quantity=sub.quantity,
        unit_price=sub.unit_price,
        total_amount=sub.total_amount,
        status=sub.status,
        remarks=sub.remarks
    )

# ------------------------------------------
# 7. CENTRALIZED SERVICE BILLING ENGINE
# ------------------------------------------

@app.post("/api/services/billing/generate")
def generate_service_billing(
    data: GenerateServiceBillingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    """
    Centralized billing engine:
    Gathers all active food, Wi-Fi, parking, AC, electricity, and custom service subscriptions
    and generates itemized ServiceCharge records for the specified month/year.
    Prevents duplicate billing!
    """
    m = data.billing_month
    y = data.billing_year
    due_date = data.due_date
    created_charges = []
    skipped_count = 0
    charge_counter = int(time.time() * 1000) % 1000000

    # Load existing billed keys from DB for this period to guarantee uniqueness & duplicate prevention
    existing_records = db.scalars(
        select(ServiceCharge)
        .where(ServiceCharge.billing_month == m, ServiceCharge.billing_year == y)
    ).all()
    already_billed_keys = {(r.tenant_id, r.service_category, r.source_ref_id) for r in existing_records}
    tenant_cat_billed = {(r.tenant_id, r.service_category) for r in existing_records}

    allowed_cats = data.service_categories or ["Food", "Wi-Fi", "Parking", "AC", "Electricity", "Other"]

    # 1. Food Subscriptions
    if "Food" in allowed_cats:
        food_subs = db.scalars(
            select(FoodSubscription)
            .where(FoodSubscription.status == "Active")
        ).all()
        for fs in food_subs:
            key = (fs.tenant_id, "Food")
            if key in tenant_cat_billed:
                skipped_count += 1
                continue

            tenant_cat_billed.add(key)
            plan = db.get(FoodPlan, fs.plan_id)
            title = f"Food Plan: {plan.plan_name if plan else 'Subscription'}"
            charge_num = f"SCHG-{y}{m:02d}-FOOD-{fs.tenant_id}-{charge_counter:04d}"
            charge_counter += 1
            
            sc = ServiceCharge(
                charge_number=charge_num,
                tenant_id=fs.tenant_id,
                service_category="Food",
                source_ref_id=fs.id,
                title=title,
                billing_month=m,
                billing_year=y,
                amount=fs.monthly_price,
                amount_paid=0.0,
                pending_amount=fs.monthly_price,
                due_date=due_date,
                status="Unpaid"
            )
            db.add(sc)
            created_charges.append(sc)

    # 2. Wi-Fi Subscriptions (where not included in rent)
    if "Wi-Fi" in allowed_cats:
        wifi_subs = db.scalars(
            select(WifiSubscription)
            .where(WifiSubscription.status == "Active", WifiSubscription.included_in_rent == False)
        ).all()
        for ws in wifi_subs:
            key = (ws.tenant_id, "Wi-Fi")
            if key in tenant_cat_billed:
                skipped_count += 1
                continue

            tenant_cat_billed.add(key)
            srv = db.get(WifiService, ws.wifi_service_id)
            title = f"Wi-Fi Service: {srv.network_name if srv else 'High-Speed Internet'}"
            charge_num = f"SCHG-{y}{m:02d}-WIFI-{ws.tenant_id}-{charge_counter:04d}"
            charge_counter += 1

            sc = ServiceCharge(
                charge_number=charge_num,
                tenant_id=ws.tenant_id,
                service_category="Wi-Fi",
                source_ref_id=ws.id,
                title=title,
                billing_month=m,
                billing_year=y,
                amount=ws.monthly_charge,
                amount_paid=0.0,
                pending_amount=ws.monthly_charge,
                due_date=due_date,
                status="Unpaid"
            )
            db.add(sc)
            created_charges.append(sc)

    # 3. Parking Allocations
    if "Parking" in allowed_cats:
        parking_allocs = db.scalars(
            select(ParkingAllocation)
            .where(ParkingAllocation.status == "Active")
        ).all()
        for pa in parking_allocs:
            key = (pa.tenant_id, "Parking", pa.id)
            if key in already_billed_keys:
                skipped_count += 1
                continue

            already_billed_keys.add(key)
            slot = db.get(ParkingSlot, pa.slot_id)
            title = f"Parking Slot: {slot.slot_number if slot else 'Allocated'} ({pa.vehicle_number})"
            charge_num = f"SCHG-{y}{m:02d}-PARK-{pa.tenant_id}-{charge_counter:04d}"
            charge_counter += 1

            sc = ServiceCharge(
                charge_number=charge_num,
                tenant_id=pa.tenant_id,
                service_category="Parking",
                source_ref_id=pa.id,
                title=title,
                billing_month=m,
                billing_year=y,
                amount=pa.monthly_charge,
                amount_paid=0.0,
                pending_amount=pa.monthly_charge,
                due_date=due_date,
                status="Unpaid"
            )
            db.add(sc)
            created_charges.append(sc)

    # 4. AC Subscriptions
    if "AC" in allowed_cats:
        ac_subs = db.scalars(
            select(AcSubscription)
            .where(AcSubscription.status == "Active")
        ).all()
        for acs in ac_subs:
            room = db.get(Room, acs.room_id)
            room_title = room.room_number if room else "Room"

            if acs.tenant_id:
                key = (acs.tenant_id, "AC")
                if key in tenant_cat_billed:
                    skipped_count += 1
                    continue
                tenant_cat_billed.add(key)
                charge_num = f"SCHG-{y}{m:02d}-AC-{acs.tenant_id}-{charge_counter:04d}"
                charge_counter += 1
                sc = ServiceCharge(
                    charge_number=charge_num,
                    tenant_id=acs.tenant_id,
                    service_category="AC",
                    source_ref_id=acs.id,
                    title=f"Air Conditioning: Room {room_title}",
                    billing_month=m,
                    billing_year=y,
                    amount=acs.monthly_charge,
                    amount_paid=0.0,
                    pending_amount=acs.monthly_charge,
                    due_date=due_date,
                    status="Unpaid"
                )
                db.add(sc)
                created_charges.append(sc)
            elif acs.split_among_occupants and room:
                active_allocs = db.scalars(
                    select(BedAllocation)
                    .where(BedAllocation.room_id == room.id, BedAllocation.is_active == True)
                ).all()
                if active_allocs:
                    split_amount = round(acs.monthly_charge / len(active_allocs), 2)
                    for alloc in active_allocs:
                        key = (alloc.tenant_id, "AC")
                        if key in tenant_cat_billed:
                            skipped_count += 1
                            continue
                        tenant_cat_billed.add(key)
                        charge_num = f"SCHG-{y}{m:02d}-AC-{alloc.tenant_id}-{charge_counter:04d}"
                        charge_counter += 1
                        sc = ServiceCharge(
                            charge_number=charge_num,
                            tenant_id=alloc.tenant_id,
                            service_category="AC",
                            source_ref_id=acs.id,
                            title=f"AC Shared: Room {room_title} (1/{len(active_allocs)} split)",
                            billing_month=m,
                            billing_year=y,
                            amount=split_amount,
                            amount_paid=0.0,
                            pending_amount=split_amount,
                            due_date=due_date,
                            status="Unpaid"
                        )
                        db.add(sc)
                        created_charges.append(sc)

    # 5. Electricity Readings
    if "Electricity" in allowed_cats:
        elec_readings = db.scalars(
            select(ElectricityReading)
            .where(
                ElectricityReading.billing_month == m,
                ElectricityReading.billing_year == y,
                ElectricityReading.is_billed == False
            )
        ).all()
        for erd in elec_readings:
            room = db.get(Room, erd.room_id)
            active_allocs = db.scalars(
                select(BedAllocation)
                .where(BedAllocation.room_id == erd.room_id, BedAllocation.is_active == True)
            ).all()
            if active_allocs:
                split_elec = round(erd.total_amount / len(active_allocs), 2)
                for alloc in active_allocs:
                    charge_num = f"SCHG-{y}{m:02d}-ELEC-{alloc.tenant_id}-{charge_counter:04d}"
                    charge_counter += 1
                    sc = ServiceCharge(
                        charge_number=charge_num,
                        tenant_id=alloc.tenant_id,
                        service_category="Electricity",
                        source_ref_id=erd.id,
                        title=f"Electricity: Room {room.room_number if room else ''} ({erd.units_consumed} units total)",
                        billing_month=m,
                        billing_year=y,
                        amount=split_elec,
                        amount_paid=0.0,
                        pending_amount=split_elec,
                        due_date=due_date,
                        status="Unpaid"
                    )
                    db.add(sc)
                    created_charges.append(sc)
                erd.is_billed = True

    # 6. Custom Services Subscriptions
    if "Other" in allowed_cats:
        custom_subs = db.scalars(
            select(TenantServiceSubscription)
            .where(TenantServiceSubscription.status == "Active")
        ).all()
        for cs in custom_subs:
            key = (cs.tenant_id, "Custom", cs.id)
            if key in already_billed_keys:
                skipped_count += 1
                continue

            already_billed_keys.add(key)
            srv = db.get(ServiceCatalog, cs.service_id)
            title = f"{srv.service_name if srv else 'Custom Service'} (Qty: {cs.quantity})"
            charge_num = f"SCHG-{y}{m:02d}-SRV-{cs.tenant_id}-{charge_counter:04d}"
            charge_counter += 1
            sc = ServiceCharge(
                charge_number=charge_num,
                tenant_id=cs.tenant_id,
                service_category=srv.category if srv else "Other",
                source_ref_id=cs.id,
                title=title,
                billing_month=m,
                billing_year=y,
                amount=cs.total_amount,
                amount_paid=0.0,
                pending_amount=cs.total_amount,
                due_date=due_date,
                status="Unpaid"
            )
            db.add(sc)
            created_charges.append(sc)

    # Optional Integration with Rent Invoice
    if data.integrate_with_rent_invoice:
        for sc in created_charges:
            inv = db.scalar(
                select(RentInvoice)
                .where(
                    RentInvoice.tenant_id == sc.tenant_id,
                    RentInvoice.billing_month == m,
                    RentInvoice.billing_year == y
                )
            )
            if inv:
                sc.invoice_id = inv.id
                inv.total_amount = round(inv.total_amount + sc.amount, 2)
                inv.pending_amount = round(inv.pending_amount + sc.amount, 2)
                inv.status = "Partially Paid" if inv.amount_paid > 0 else "Unpaid"

    db.commit()

    total_amount = sum(c.amount for c in created_charges)
    log_service_audit(
        db, "ServiceCharge", 0, "BillingGenerate",
        current_user.username,
        f"Generated {len(created_charges)} service charges for {m}/{y}. Total=Rs.{total_amount:,.2f}"
    )
    db.commit()

    return {
        "billing_period": f"{m}/{y}",
        "charges_generated": len(created_charges),
        "total_amount_billed": round(total_amount, 2),
        "duplicates_skipped": skipped_count,
        "integrated_with_rent_invoices": data.integrate_with_rent_invoice
    }

@app.get("/api/services/billing/charges", response_model=List[ServiceChargeOut])
def get_service_charges(
    tenant_id: Optional[int] = None,
    service_category: Optional[str] = None,
    status: Optional[str] = None,
    billing_month: Optional[int] = None,
    billing_year: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(ServiceCharge).order_by(desc(ServiceCharge.id))
    if tenant_id:
        query = query.where(ServiceCharge.tenant_id == tenant_id)
    if service_category and service_category != "All":
        query = query.where(ServiceCharge.service_category == service_category)
    if status and status != "All":
        query = query.where(ServiceCharge.status == status)
    if billing_month:
        query = query.where(ServiceCharge.billing_month == billing_month)
    if billing_year:
        query = query.where(ServiceCharge.billing_year == billing_year)
    if search:
        s = f"%{search.strip()}%"
        query = query.join(Tenant).where(or_(Tenant.full_name.ilike(s), ServiceCharge.title.ilike(s), ServiceCharge.charge_number.ilike(s)))

    charges = db.scalars(query).all()
    results = []
    for c in charges:
        t = db.get(Tenant, c.tenant_id)
        room_no, _ = get_tenant_active_room_bed(db, c.tenant_id)
        results.append(ServiceChargeOut(
            id=c.id,
            charge_number=c.charge_number,
            tenant_id=c.tenant_id,
            tenant_name=t.full_name if t else "Unknown",
            tenant_code=t.tenant_code if t else "N/A",
            room_number=room_no,
            service_category=c.service_category,
            source_ref_id=c.source_ref_id,
            title=c.title,
            billing_month=c.billing_month,
            billing_year=c.billing_year,
            amount=c.amount,
            amount_paid=c.amount_paid,
            pending_amount=c.pending_amount,
            due_date=c.due_date,
            status=c.status,
            invoice_id=c.invoice_id,
            notes=c.notes,
            created_at=c.created_at
        ))
    return results

@app.get("/api/services/billing/outstanding")
def get_outstanding_service_balances(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    tenants = db.scalars(select(Tenant).where(Tenant.status == "Active")).all()
    out = []
    for t in tenants:
        pending_charges = db.scalars(
            select(ServiceCharge)
            .where(ServiceCharge.tenant_id == t.id, ServiceCharge.pending_amount > 0)
        ).all()
        total_pending = sum(c.pending_amount for c in pending_charges)
        if total_pending > 0:
            room_no, bed_no = get_tenant_active_room_bed(db, t.id)
            out.append({
                "tenant_id": t.id,
                "tenant_code": t.tenant_code,
                "tenant_name": t.full_name,
                "room_number": room_no,
                "bed_number": bed_no,
                "total_service_pending": round(total_pending, 2),
                "pending_items_count": len(pending_charges),
                "breakdown": [
                    {
                        "id": c.id,
                        "category": c.service_category,
                        "title": c.title,
                        "billing_month": c.billing_month,
                        "billing_year": c.billing_year,
                        "pending": c.pending_amount
                    } for c in pending_charges
                ]
            })
    return out

@app.post("/api/services/billing/pay")
def pay_service_charge(
    data: ServicePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    """
    Records payment against an itemized service charge using the Phase 3 Payment engine!
    Creates a Payment, generates a ReportLab PDF receipt, and updates ServiceCharge balances.
    """
    chg = db.get(ServiceCharge, data.charge_id)
    if not chg:
        raise HTTPException(404, "Service charge not found.")

    if chg.status == "Paid":
        raise HTTPException(400, "This service charge has already been fully paid.")

    if data.amount <= 0:
        raise HTTPException(400, "Payment amount must be greater than zero.")

    if data.amount > chg.pending_amount:
        raise HTTPException(400, f"Payment amount (Rs.{data.amount}) cannot exceed pending amount (Rs.{chg.pending_amount}).")

    tenant = db.get(Tenant, chg.tenant_id)
    room_no, bed_no = get_tenant_active_room_bed(db, tenant.id)

    # 1. Create Payment record
    pay_num = f"PAY-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    rec_num = f"REC-{datetime.now().strftime('%Y%m%d')}-{str(int(time.time()))[-4:]}"
    today = datetime.now().strftime("%Y-%m-%d")

    payment_type = f"{chg.service_category} Charges"
    pay = Payment(
        payment_number=pay_num,
        tenant_id=chg.tenant_id,
        invoice_id=chg.invoice_id,
        payment_date=today,
        amount=float(data.amount),
        payment_type=payment_type,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        notes=f"Service charge payment: {chg.title}. {data.notes or ''}".strip(),
        receipt_number=rec_num
    )
    db.add(pay)

    # 2. Update ServiceCharge
    prev_balance = chg.pending_amount
    chg.amount_paid = round(chg.amount_paid + data.amount, 2)
    chg.pending_amount = round(chg.amount - chg.amount_paid, 2)
    chg.status = "Paid" if chg.pending_amount == 0 else "Partially Paid"

    # 3. If linked to RentInvoice, also update invoice pending amount
    if chg.invoice_id:
        inv = db.get(RentInvoice, chg.invoice_id)
        if inv:
            inv.amount_paid = round(inv.amount_paid + data.amount, 2)
            inv.pending_amount = max(0.0, round(inv.total_amount - inv.amount_paid, 2))
            inv.status = "Paid" if inv.pending_amount == 0 else "Partially Paid"

    db.commit()
    db.refresh(pay)

    # 4. Generate PDF Receipt via ReportLab
    pdf_filename = generate_pdf_receipt(
        receipt_number=rec_num,
        payment_number=pay_num,
        payment_date=today,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        room_number=room_no,
        bed_number=bed_no,
        payment_type=payment_type,
        billing_period=f"{chg.billing_month}/{chg.billing_year}",
        amount_paid=data.amount,
        payment_mode=data.payment_mode,
        transaction_ref=data.transaction_ref,
        previous_balance=prev_balance,
        remaining_balance=chg.pending_amount,
        received_by=current_user.username
    )

    receipt = Receipt(
        receipt_number=rec_num,
        payment_id=pay.id,
        tenant_id=tenant.id,
        receipt_date=today,
        pdf_filename=pdf_filename
    )
    db.add(receipt)
    log_service_audit(
        db, "ServiceCharge", chg.id, "Payment",
        current_user.username,
        f"Paid Rs.{data.amount} for {chg.title} via {data.payment_mode} (Receipt: {rec_num})"
    )
    db.commit()

    return {
        "message": "Payment recorded successfully",
        "payment_id": pay.id,
        "payment_number": pay_num,
        "receipt_number": rec_num,
        "pdf_download_url": f"/api/financial/receipts/{receipt.id}/download",
        "remaining_pending": chg.pending_amount,
        "charge_status": chg.status
    }

# ------------------------------------------
# 8. SERVICES DASHBOARD
# ------------------------------------------

@app.get("/api/services/dashboard", response_model=ServicesDashboardOut)
def get_services_dashboard(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    now = datetime.now()
    cur_m = now.month
    cur_y = now.year

    # 1. Food Subscribers & Revenue
    active_food_subs = db.scalars(
        select(FoodSubscription).where(FoodSubscription.status == "Active")
    ).all()
    monthly_food_rev = sum(s.monthly_price for s in active_food_subs)

    # 2. Wi-Fi Subscribers
    active_wifi_cnt = db.scalar(
        select(func.count(WifiSubscription.id))
        .where(WifiSubscription.status == "Active")
    ) or 0

    # 3. Parking Allocations
    active_parking_cnt = db.scalar(
        select(func.count(ParkingAllocation.id))
        .where(ParkingAllocation.status == "Active")
    ) or 0

    # 4. AC Subscriptions
    active_ac_cnt = db.scalar(
        select(func.count(AcSubscription.id))
        .where(AcSubscription.status == "Active")
    ) or 0

    # 5. Monthly Electricity Charges
    monthly_elec = db.scalar(
        select(func.sum(ElectricityReading.total_amount))
        .where(ElectricityReading.billing_month == cur_m, ElectricityReading.billing_year == cur_y)
    ) or 0.0

    # 6. Additional Services Subscriptions
    active_add_cnt = db.scalar(
        select(func.count(TenantServiceSubscription.id))
        .where(TenantServiceSubscription.status == "Active")
    ) or 0

    # 7. Total Service Charges, Collections, Pending
    total_charges = db.scalar(select(func.sum(ServiceCharge.amount))) or 0.0
    total_paid = db.scalar(select(func.sum(ServiceCharge.amount_paid))) or 0.0
    total_pending = db.scalar(select(func.sum(ServiceCharge.pending_amount))) or 0.0

    # Category breakdown
    categories = ["Food", "Wi-Fi", "Parking", "AC", "Electricity", "Other"]
    breakdown = []
    for cat in categories:
        b_amt = db.scalar(
            select(func.sum(ServiceCharge.amount))
            .where(ServiceCharge.service_category == cat)
        ) or 0.0
        p_amt = db.scalar(
            select(func.sum(ServiceCharge.amount_paid))
            .where(ServiceCharge.service_category == cat)
        ) or 0.0
        pending_amt = db.scalar(
            select(func.sum(ServiceCharge.pending_amount))
            .where(ServiceCharge.service_category == cat)
        ) or 0.0
        breakdown.append({
            "category": cat,
            "total_billed": round(b_amt, 2),
            "total_collected": round(p_amt, 2),
            "pending_amount": round(pending_amt, 2)
        })

    return ServicesDashboardOut(
        active_food_subscribers=len(active_food_subs),
        monthly_food_revenue=round(monthly_food_rev, 2),
        active_wifi_subscribers=active_wifi_cnt,
        active_parking_allocations=active_parking_cnt,
        active_ac_subscriptions=active_ac_cnt,
        monthly_electricity_charges=round(monthly_elec, 2),
        active_additional_services=active_add_cnt,
        total_service_charges_generated=round(total_charges, 2),
        total_service_payments_collected=round(total_paid, 2),
        pending_service_charges=round(total_pending, 2),
        category_breakdown=breakdown
    )

# ------------------------------------------
# 9. SERVICE REPORTS & EXPORT
# ------------------------------------------

@app.get("/api/services/reports/revenue")
def get_service_revenue_report(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    target_year = year or datetime.now().year
    categories = ["Food", "Wi-Fi", "Parking", "AC", "Electricity", "Other"]
    monthly_data = []

    for m in range(1, 13):
        m_name = calendar.month_abbr[m]
        billed = db.scalar(
            select(func.sum(ServiceCharge.amount))
            .where(ServiceCharge.billing_year == target_year, ServiceCharge.billing_month == m)
        ) or 0.0
        collected = db.scalar(
            select(func.sum(ServiceCharge.amount_paid))
            .where(ServiceCharge.billing_year == target_year, ServiceCharge.billing_month == m)
        ) or 0.0
        pending = db.scalar(
            select(func.sum(ServiceCharge.pending_amount))
            .where(ServiceCharge.billing_year == target_year, ServiceCharge.billing_month == m)
        ) or 0.0

        monthly_data.append({
            "month_num": m,
            "month_name": m_name,
            "billed": round(billed, 2),
            "collected": round(collected, 2),
            "pending": round(pending, 2)
        })

    return {
        "year": target_year,
        "monthly_breakdown": monthly_data
    }

@app.get("/api/services/reports/electricity")
def get_electricity_consumption_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    now = datetime.now()
    m = month or now.month
    y = year or now.year

    readings = db.scalars(
        select(ElectricityReading)
        .where(ElectricityReading.billing_month == m, ElectricityReading.billing_year == y)
    ).all()

    items = []
    tot_units = 0.0
    tot_amount = 0.0

    for rd in readings:
        meter = db.get(ElectricityMeter, rd.meter_id)
        room = db.get(Room, rd.room_id)
        tot_units += rd.units_consumed
        tot_amount += rd.total_amount
        items.append({
            "room_number": room.room_number if room else "N/A",
            "meter_number": meter.meter_number if meter else "N/A",
            "previous_reading": rd.previous_reading,
            "current_reading": rd.current_reading,
            "units_consumed": rd.units_consumed,
            "rate_per_unit": rd.rate_per_unit,
            "total_amount": rd.total_amount,
            "is_billed": rd.is_billed
        })

    return {
        "billing_period": f"{m}/{y}",
        "total_units_consumed": round(tot_units, 2),
        "total_electricity_amount": round(tot_amount, 2),
        "room_readings": items
    }

@app.get("/api/services/reports/subscriptions")
def get_all_subscriptions_report(db: Session = Depends(get_db), current_user: User = Depends(authenticated_user)):
    return {
        "active_food_subscriptions": db.scalar(select(func.count(FoodSubscription.id)).where(FoodSubscription.status == "Active")) or 0,
        "active_wifi_subscriptions": db.scalar(select(func.count(WifiSubscription.id)).where(WifiSubscription.status == "Active")) or 0,
        "active_parking_allocations": db.scalar(select(func.count(ParkingAllocation.id)).where(ParkingAllocation.status == "Active")) or 0,
        "active_ac_subscriptions": db.scalar(select(func.count(AcSubscription.id)).where(AcSubscription.status == "Active")) or 0,
        "active_custom_services": db.scalar(select(func.count(TenantServiceSubscription.id)).where(TenantServiceSubscription.status == "Active")) or 0
    }

@app.get("/api/services/reports/export-csv")
def export_service_charges_csv(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    query = select(ServiceCharge).order_by(desc(ServiceCharge.id))
    if month:
        query = query.where(ServiceCharge.billing_month == month)
    if year:
        query = query.where(ServiceCharge.billing_year == year)

    charges = db.scalars(query).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Charge ID", "Tenant Name", "Tenant Code", "Room Number",
        "Category", "Title", "Billing Month", "Billing Year",
        "Amount (Rs.)", "Amount Paid (Rs.)", "Pending (Rs.)", "Status", "Due Date"
    ])

    for c in charges:
        t = db.get(Tenant, c.tenant_id)
        room_no, _ = get_tenant_active_room_bed(db, c.tenant_id)
        writer.writerow([
            c.charge_number,
            t.full_name if t else "Unknown",
            t.tenant_code if t else "N/A",
            room_no,
            c.service_category,
            c.title,
            c.billing_month,
            c.billing_year,
            c.amount,
            c.amount_paid,
            c.pending_amount,
            c.status,
            c.due_date
        ])

    output.seek(0)
    filename = f"Service_Charges_Report_{year or 'All'}_{month or 'All'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/services/reports/statement-pdf/{tenant_id}")
def download_tenant_service_statement_pdf(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(authenticated_user)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found.")

    charges = db.scalars(
        select(ServiceCharge)
        .where(ServiceCharge.tenant_id == tenant.id)
        .order_by(desc(ServiceCharge.id))
    ).all()

    room_no, bed_no = get_tenant_active_room_bed(db, tenant.id)
    today = datetime.now().strftime("%Y-%m-%d")
    stat_num = f"STAT-{tenant.tenant_code}-{datetime.now().strftime('%Y%m%d%H%M')}"

    c_list = []
    tot_billed = 0.0
    tot_paid = 0.0
    tot_pending = 0.0

    for c in charges:
        tot_billed += c.amount
        tot_paid += c.amount_paid
        tot_pending += c.pending_amount
        c_list.append({
            "category": c.service_category,
            "title": c.title,
            "billing_month": c.billing_month,
            "billing_year": c.billing_year,
            "amount": c.amount,
            "amount_paid": c.amount_paid,
            "pending_amount": c.pending_amount,
            "status": c.status
        })

    pdf_filename = generate_pdf_service_statement(
        statement_number=stat_num,
        statement_date=today,
        tenant_name=tenant.full_name,
        tenant_code=tenant.tenant_code,
        room_number=room_no,
        bed_number=bed_no,
        charges=c_list,
        total_billed=tot_billed,
        total_paid=tot_paid,
        total_pending=tot_pending,
        prepared_by=current_user.username
    )

    pdf_path = RECEIPTS / pdf_filename
    if not pdf_path.exists():
        raise HTTPException(500, "Statement PDF could not be generated.")

    return FileResponse(
        path=str(pdf_path),
        filename=pdf_filename,
        media_type="application/pdf"
    )

# =========================================================================
# PRODUCTION STATIC FRONTEND SERVING
# =========================================================================
frontend_dist_candidates = [
    BASE.parent / "frontend" / "dist",
    BASE / "static_dist",
    BASE / "frontend" / "dist",
    Path("/app/frontend/dist"),
    Path("/app/dist")
]

frontend_dist = None
for candidate in frontend_dist_candidates:
    if candidate.exists() and (candidate / "index.html").exists():
        frontend_dist = candidate
        break

if frontend_dist:
    from fastapi.staticfiles import StaticFiles

    # Mount assets folder
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all route to serve SPA index.html
    @app.get("/{full_path:path}")
    async def serve_frontend_spa(request: Request, full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))


