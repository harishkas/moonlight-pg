from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), index=True)
    mobile: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[str] = mapped_column(String(20), default="Male")
    dob: Mapped[str | None] = mapped_column(String(20), nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(50), default="Working")
    company_or_college: Mapped[str | None] = mapped_column(String(100), nullable=True)
    joining_date: Mapped[str] = mapped_column(String(20))
    expected_leaving_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Pending", index=True) # Active, Vacated, Pending
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    allocations = relationship("BedAllocation", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(BedAllocation.id)")
    invoices = relationship("RentInvoice", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(RentInvoice.id)")
    payments = relationship("Payment", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(Payment.id)")
    deposits = relationship("Deposit", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(Deposit.id)")
    food_subscriptions = relationship("FoodSubscription", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(FoodSubscription.id)")
    parking_allocations = relationship("ParkingAllocation", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(ParkingAllocation.id)")
    service_charges = relationship("ServiceCharge", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(ServiceCharge.id)")
    wifi_subscriptions = relationship("WifiSubscription", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(WifiSubscription.id)")
    ac_subscriptions = relationship("AcSubscription", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(AcSubscription.id)")
    custom_service_subscriptions = relationship("TenantServiceSubscription", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(TenantServiceSubscription.id)")
    notifications = relationship("Notification", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(Notification.id)")
    tasks = relationship("PgTask", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(PgTask.id)")
    reminder_history = relationship("ReminderHistory", back_populates="tenant", cascade="all, delete-orphan", order_by="desc(ReminderHistory.id)")

class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    floor: Mapped[int] = mapped_column(Integer, default=1)
    room_type: Mapped[str] = mapped_column(String(30), default="Sharing") # Single, Sharing, Triple
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    monthly_rent: Mapped[float] = mapped_column(Float, default=6000.0)
    status: Mapped[str] = mapped_column(String(30), default="Available", index=True) # Available, Partially Occupied, Full, Maintenance
    has_ac: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    beds = relationship("Bed", back_populates="room", cascade="all, delete-orphan", order_by="Bed.bed_number")
    allocations = relationship("BedAllocation", back_populates="room")
    invoices = relationship("RentInvoice", back_populates="room")
    electricity_meters = relationship("ElectricityMeter", back_populates="room", cascade="all, delete-orphan")
    ac_subscriptions = relationship("AcSubscription", back_populates="room", cascade="all, delete-orphan")

class Bed(Base):
    __tablename__ = "beds"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    bed_number: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(30), default="Available", index=True) # Available, Occupied, Maintenance
    monthly_rent: Mapped[float] = mapped_column(Float, default=6000.0)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    room = relationship("Room", back_populates="beds")
    allocations = relationship("BedAllocation", back_populates="bed")
    invoices = relationship("RentInvoice", back_populates="bed")

class BedAllocation(Base):
    __tablename__ = "bed_allocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    bed_id: Mapped[int] = mapped_column(Integer, ForeignKey("beds.id"), index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    allocation_date: Mapped[str] = mapped_column(String(20))
    monthly_rent: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    vacating_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vacating_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    room_inspection_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pending_dues: Mapped[float] = mapped_column(Float, default=0.0)
    deposit_refund_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="allocations")
    bed = relationship("Bed", back_populates="allocations")
    room = relationship("Room", back_populates="allocations")
    invoices = relationship("RentInvoice", back_populates="allocation")


# ==========================================
# PHASE 3: FINANCIAL & PAYMENT MODELS
# ==========================================

class RentInvoice(Base):
    __tablename__ = "rent_invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    allocation_id: Mapped[int] = mapped_column(Integer, ForeignKey("bed_allocations.id"), index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    bed_id: Mapped[int] = mapped_column(Integer, ForeignKey("beds.id"), index=True)
    billing_month: Mapped[int] = mapped_column(Integer, index=True) # 1 - 12
    billing_year: Mapped[int] = mapped_column(Integer, index=True) # e.g. 2026
    billing_date: Mapped[str] = mapped_column(String(20)) # YYYY-MM-DD
    due_date: Mapped[str] = mapped_column(String(20)) # YYYY-MM-DD
    base_rent: Mapped[float] = mapped_column(Float) # Standard monthly allocation rent
    prorated_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_days_in_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    adjustment_amount: Mapped[float] = mapped_column(Float, default=0.0) # Admin authorized adjustment
    adjustment_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float) # Calculated net payable
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0)
    pending_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="Unpaid", index=True) # Paid, Partially Paid, Unpaid, Overdue
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="invoices")
    allocation = relationship("BedAllocation", back_populates="invoices")
    room = relationship("Room", back_populates="invoices")
    bed = relationship("Bed", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice", order_by="desc(Payment.id)")

class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payment_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("rent_invoices.id"), nullable=True, index=True)
    payment_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    amount: Mapped[float] = mapped_column(Float)
    payment_type: Mapped[str] = mapped_column(String(50), index=True) # Monthly Rent, Advance, Security Deposit, Food Charges, Electricity Charges, Maintenance Charges, Other Charges, Refund
    payment_mode: Mapped[str] = mapped_column(String(40), index=True) # Cash, UPI, Bank Transfer, Other
    transaction_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cancelled_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="payments")
    invoice = relationship("RentInvoice", back_populates="payments")
    receipt = relationship("Receipt", back_populates="payment", uselist=False, cascade="all, delete-orphan")

class Deposit(Base):
    __tablename__ = "deposits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deposit_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    deposit_type: Mapped[str] = mapped_column(String(40), index=True) # Advance Rent, Security Deposit
    total_amount: Mapped[float] = mapped_column(Float)
    payment_date: Mapped[str] = mapped_column(String(20))
    payment_mode: Mapped[str] = mapped_column(String(40))
    transaction_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    adjusted_amount: Mapped[float] = mapped_column(Float, default=0.0)
    refunded_amount: Mapped[float] = mapped_column(Float, default=0.0)
    remaining_balance: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(40), default="Active", index=True) # Active, Partially Adjusted, Fully Adjusted, Refunded
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="deposits")
    transactions = relationship("DepositTransaction", back_populates="deposit", cascade="all, delete-orphan", order_by="desc(DepositTransaction.id)")

class DepositTransaction(Base):
    __tablename__ = "deposit_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deposit_id: Mapped[int] = mapped_column(Integer, ForeignKey("deposits.id"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(40)) # Collection, Adjustment, Refund, Deduction
    amount: Mapped[float] = mapped_column(Float)
    transaction_date: Mapped[str] = mapped_column(String(20))
    payment_mode: Mapped[str | None] = mapped_column(String(40), nullable=True)
    transaction_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    linked_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("rent_invoices.id"), nullable=True)
    reason: Mapped[str] = mapped_column(String(255))
    recorded_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deposit = relationship("Deposit", back_populates="transactions")

class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    expense_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(150), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True) # Food and Groceries, Electricity, Water, Internet / Wi-Fi, Maintenance, Cleaning, Staff Salary, Repairs, Rent / Property Expenses, Other Expenses
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    expense_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    payment_mode: Mapped[str] = mapped_column(String(40)) # Cash, UPI, Bank Transfer, Other
    paid_to: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Receipt(Base):
    __tablename__ = "receipts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    payment_id: Mapped[int] = mapped_column(Integer, ForeignKey("payments.id"), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    receipt_date: Mapped[str] = mapped_column(String(20))
    pdf_filename: Mapped[str] = mapped_column(String(150))
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment = relationship("Payment", back_populates="receipt")
    tenant = relationship("Tenant")

class FinancialAuditLog(Base):
    __tablename__ = "financial_audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True) # Invoice, Payment, Deposit, Expense
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    action: Mapped[str] = mapped_column(String(50), index=True) # Generate, Adjust, Payment, Cancel, Refund, Edit, Delete
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    performed_by: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ==========================================
# PHASE 4: FOOD, FACILITIES & SERVICES MODELS
# ==========================================

class FoodPlan(Base):
    __tablename__ = "food_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    plan_name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    monthly_price: Mapped[float] = mapped_column(Float)
    daily_price: Mapped[float | None] = mapped_column(Float, default=0.0)
    included_meals: Mapped[str] = mapped_column(String(150), default="Breakfast, Lunch, Dinner")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subscriptions = relationship("FoodSubscription", back_populates="plan", cascade="all, delete-orphan")


class FoodSubscription(Base):
    __tablename__ = "food_subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("food_plans.id"), index=True)
    start_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True) # YYYY-MM-DD
    monthly_price: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Paused, Cancelled
    billing_frequency: Mapped[str] = mapped_column(String(30), default="Monthly") # Monthly, Daily, Weekly
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="food_subscriptions")
    plan = relationship("FoodPlan", back_populates="subscriptions")


class MealRecord(Base):
    __tablename__ = "meal_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meal_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    meal_type: Mapped[str] = mapped_column(String(30), index=True) # Breakfast, Lunch, Dinner
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="Served", index=True) # Served, Attended, Opted Out, Additional Request
    extra_charge: Mapped[float] = mapped_column(Float, default=0.0)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")


class WifiService(Base):
    __tablename__ = "wifi_services"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    network_name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    monthly_charge: Mapped[float] = mapped_column(Float, default=300.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subscriptions = relationship("WifiSubscription", back_populates="service", cascade="all, delete-orphan")


class WifiSubscription(Base):
    __tablename__ = "wifi_subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    wifi_service_id: Mapped[int] = mapped_column(Integer, ForeignKey("wifi_services.id"), index=True)
    activation_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    deactivation_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_charge: Mapped[float] = mapped_column(Float, default=300.0)
    included_in_rent: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Inactive
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="wifi_subscriptions")
    service = relationship("WifiService", back_populates="subscriptions")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slot_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    slot_type: Mapped[str] = mapped_column(String(40), default="Two-wheeler", index=True) # Two-wheeler, Four-wheeler, Other
    monthly_charge: Mapped[float] = mapped_column(Float, default=300.0)
    status: Mapped[str] = mapped_column(String(30), default="Available", index=True) # Available, Occupied, Maintenance
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    allocations = relationship("ParkingAllocation", back_populates="slot", cascade="all, delete-orphan")


class ParkingAllocation(Base):
    __tablename__ = "parking_allocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    allocation_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    slot_id: Mapped[int] = mapped_column(Integer, ForeignKey("parking_slots.id"), index=True)
    vehicle_type: Mapped[str] = mapped_column(String(40), default="Two-wheeler")
    vehicle_number: Mapped[str] = mapped_column(String(40), index=True)
    allocation_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    release_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_charge: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Released
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="parking_allocations")
    slot = relationship("ParkingSlot", back_populates="allocations")


class AcSubscription(Base):
    __tablename__ = "ac_subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    billing_rule: Mapped[str] = mapped_column(String(40), default="room_split") # room_split, tenant_fixed, included_in_rent
    monthly_charge: Mapped[float] = mapped_column(Float, default=1500.0)
    split_among_occupants: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Inactive
    start_date: Mapped[str] = mapped_column(String(20), index=True)
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    room = relationship("Room", back_populates="ac_subscriptions")
    tenant = relationship("Tenant", back_populates="ac_subscriptions")


class ElectricityMeter(Base):
    __tablename__ = "electricity_meters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meter_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    meter_type: Mapped[str] = mapped_column(String(40), default="Sub-meter")
    rate_per_unit: Mapped[float] = mapped_column(Float, default=10.0)
    billing_method: Mapped[str] = mapped_column(String(40), default="Meter-based") # Meter-based, Fixed monthly, Included in rent
    fixed_monthly_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Inactive
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    room = relationship("Room", back_populates="electricity_meters")
    readings = relationship("ElectricityReading", back_populates="meter", cascade="all, delete-orphan", order_by="desc(ElectricityReading.id)")


class ElectricityReading(Base):
    __tablename__ = "electricity_readings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reading_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    meter_id: Mapped[int] = mapped_column(Integer, ForeignKey("electricity_meters.id"), index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    billing_month: Mapped[int] = mapped_column(Integer, index=True) # 1 - 12
    billing_year: Mapped[int] = mapped_column(Integer, index=True) # e.g. 2026
    previous_reading: Mapped[float] = mapped_column(Float)
    current_reading: Mapped[float] = mapped_column(Float)
    units_consumed: Mapped[float] = mapped_column(Float)
    rate_per_unit: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    reading_date: Mapped[str] = mapped_column(String(20), index=True)
    is_billed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    meter = relationship("ElectricityMeter", back_populates="readings")
    room = relationship("Room")


class ServiceCatalog(Base):
    __tablename__ = "service_catalog"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    service_name: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True) # Food, Wi-Fi, Parking, AC, Electricity, Laundry, Housekeeping, Water, Other
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    billing_type: Mapped[str] = mapped_column(String(40), default="Monthly") # Monthly, One-time, Daily, Weekly, Per Usage, Custom
    price: Mapped[float] = mapped_column(Float)
    billing_frequency: Mapped[str] = mapped_column(String(40), default="Monthly")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subscriptions = relationship("TenantServiceSubscription", back_populates="service", cascade="all, delete-orphan")


class TenantServiceSubscription(Base):
    __tablename__ = "tenant_service_subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    service_id: Mapped[int] = mapped_column(Integer, ForeignKey("service_catalog.id"), index=True)
    start_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True) # Active, Paused, Cancelled
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="custom_service_subscriptions")
    service = relationship("ServiceCatalog", back_populates="subscriptions")


class ServiceCharge(Base):
    __tablename__ = "service_charges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    charge_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), index=True)
    service_category: Mapped[str] = mapped_column(String(50), index=True) # Food, Wi-Fi, Parking, AC, Electricity, Laundry, Housekeeping, Other
    source_ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True) # e.g. food_subscription_id, reading_id, etc.
    title: Mapped[str] = mapped_column(String(150), index=True)
    billing_month: Mapped[int] = mapped_column(Integer, index=True) # 1 - 12
    billing_year: Mapped[int] = mapped_column(Integer, index=True)
    amount: Mapped[float] = mapped_column(Float)
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0)
    pending_amount: Mapped[float] = mapped_column(Float)
    due_date: Mapped[str] = mapped_column(String(20)) # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String(30), default="Unpaid", index=True) # Unpaid, Partially Paid, Paid, Overdue
    invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("rent_invoices.id"), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="service_charges")
    invoice = relationship("RentInvoice")


class ServiceAuditLog(Base):
    __tablename__ = "service_audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True) # FoodPlan, FoodSubscription, MealRecord, ParkingSlot, ParkingAllocation, ElectricityMeter, ElectricityReading, ServiceCharge
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    action: Mapped[str] = mapped_column(String(50), index=True) # Create, Update, Pause, Resume, Cancel, Release, BillingGenerate, MeterReading
    performed_by: Mapped[str] = mapped_column(String(80))
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =========================================================================
# PHASE 6: AUTOMATION, NOTIFICATIONS, TASKS, AUDIT & ANALYTICS MODELS
# =========================================================================

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(150), index=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(60), index=True) # Rent Reminder, Overdue Payment, Payment Confirmation, Security Deposit, Agreement Expiry, Document Verification, Food Subscription, Service Renewal, Maintenance, Complaint, Visitor, Backup Status, System Alerts
    priority: Mapped[str] = mapped_column(String(20), default="Medium", index=True) # Low, Medium, High, Urgent
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    related_type: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True) # invoice, tenant, bed, subscription, task, backup
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    delivery_status: Mapped[str] = mapped_column(String(30), default="Delivered") # Delivered, Pending, Dismissed
    scheduled_date: Mapped[str | None] = mapped_column(String(20), nullable=True) # YYYY-MM-DD
    expiry_date: Mapped[str | None] = mapped_column(String(20), nullable=True) # YYYY-MM-DD
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="notifications")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50), default="General", index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ReminderHistory(Base):
    __tablename__ = "reminder_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("rent_invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    reminder_type: Mapped[str] = mapped_column(String(40), index=True) # 7_days_before, 3_days_before, 1_day_before, due_date, 1_day_after, 7_days_after, manual
    amount_due: Mapped[float] = mapped_column(Float, default=0.0)
    sent_date: Mapped[str] = mapped_column(String(20), index=True) # YYYY-MM-DD
    channel: Mapped[str] = mapped_column(String(30), default="in_app")
    status: Mapped[str] = mapped_column(String(30), default="Sent")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    tenant = relationship("Tenant", back_populates="reminder_history")
    invoice = relationship("RentInvoice")


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cron_expression: Mapped[str] = mapped_column(String(50), default="Daily 08:00")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_run_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(30), nullable=True) # Success, Failed, Running, Warning
    last_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_run_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    execution_logs = relationship("JobExecutionLog", back_populates="job", cascade="all, delete-orphan", order_by="desc(JobExecutionLog.id)")


class JobExecutionLog(Base):
    __tablename__ = "job_execution_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("scheduled_jobs.id", ondelete="CASCADE"), index=True)
    job_key: Mapped[str] = mapped_column(String(80), index=True)
    execution_time: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    status: Mapped[str] = mapped_column(String(30), index=True) # Success, Failed, Warning
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ScheduledJob", back_populates="execution_logs")


class ReportHistory(Base):
    __tablename__ = "report_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_type: Mapped[str] = mapped_column(String(30), index=True) # Daily, Weekly, Monthly
    report_title: Mapped[str] = mapped_column(String(150), index=True)
    start_date: Mapped[str] = mapped_column(String(20), index=True)
    end_date: Mapped[str] = mapped_column(String(20), index=True)
    generated_by: Mapped[str] = mapped_column(String(80), default="System Automated")
    summary_json: Mapped[str] = mapped_column(Text)
    pdf_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    csv_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PgTask(Base):
    __tablename__ = "pg_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), index=True) # Rent Follow-up, Tenant Follow-up, Agreement Renewal, Document Collection, Complaint Resolution, Maintenance, Food Management, Payment Follow-up, General Task
    priority: Mapped[str] = mapped_column(String(20), default="Medium", index=True) # Low, Medium, High, Urgent
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True) # Pending, In Progress, On Hold, Completed, Cancelled
    assigned_to: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True) # YYYY-MM-DD
    completed_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(80), default="Administrator")
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="tasks")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(80), index=True)
    action: Mapped[str] = mapped_column(String(60), index=True) # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, ALLOCATE, VACATE, GENERATE_RENT, RECORD_PAYMENT, CANCEL_PAYMENT, RECORD_DEPOSIT, ADJUST_DEPOSIT, BACKUP, RESTORE, RUN_JOB, IMPORT, EXPORT
    entity_type: Mapped[str] = mapped_column(String(50), index=True) # Tenant, Room, Bed, BedAllocation, RentInvoice, Payment, Deposit, Expense, Service, Backup, Task, Notification, Job
    entity_id: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    outcome: Mapped[str] = mapped_column(String(30), default="Success", index=True) # Success, Failed, Warning
    details: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class DataImportLog(Base):
    __tablename__ = "data_import_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True) # Tenants, Rooms, Beds, Allocations, Invoices, Payments, Expenses
    filename: Mapped[str] = mapped_column(String(255))
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="Previewed", index=True) # Previewed, Confirmed, Failed
    imported_by: Mapped[str] = mapped_column(String(80), default="Administrator")
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
