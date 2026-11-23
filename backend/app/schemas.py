from datetime import datetime
from typing import Any, List, Optional, Dict
from pydantic import BaseModel, Field

# ==========================================
# PHASE 1 & 2 SCHEMAS
# ==========================================

# --- Tenant Schemas ---
class TenantBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    mobile: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = None
    gender: str = "Male"
    dob: Optional[str] = None
    permanent_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    occupation: Optional[str] = "Working"
    company_or_college: Optional[str] = None
    joining_date: str
    expected_leaving_date: Optional[str] = None
    status: str = "Pending"

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    permanent_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    occupation: Optional[str] = None
    company_or_college: Optional[str] = None
    joining_date: Optional[str] = None
    expected_leaving_date: Optional[str] = None
    status: Optional[str] = None

class AllocationBrief(BaseModel):
    id: int
    room_id: int
    room_number: str
    floor: int
    bed_id: int
    bed_number: str
    allocation_date: str
    monthly_rent: float
    is_active: bool
    vacating_date: Optional[str] = None
    vacating_reason: Optional[str] = None
    room_inspection_status: Optional[str] = None
    pending_dues: float = 0.0
    deposit_refund_status: Optional[str] = None
    remarks: Optional[str] = None

class TenantOut(TenantBase):
    id: int
    tenant_code: str
    current_allocation: Optional[AllocationBrief] = None
    pending_balance: float = 0.0
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True

class TenantDetailOut(TenantOut):
    allocations: List[AllocationBrief] = []
    total_paid: float = 0.0
    total_pending: float = 0.0
    security_deposit_held: float = 0.0
    advance_rent_held: float = 0.0

# --- Bed Schemas ---
class BedBase(BaseModel):
    bed_number: str
    status: str = "Available"
    monthly_rent: float = 6000.0

class BedCreate(BedBase):
    pass

class BedUpdate(BaseModel):
    bed_number: Optional[str] = None
    status: Optional[str] = None
    monthly_rent: Optional[float] = None

class BedOccupant(BaseModel):
    tenant_id: int
    tenant_code: str
    full_name: str
    mobile: str
    allocation_id: int
    allocation_date: str

class BedOut(BedBase):
    id: int
    room_id: int
    occupant: Optional[BedOccupant] = None

    class Config:
        from_attributes = True

# --- Room Schemas ---
class RoomBase(BaseModel):
    room_number: str
    floor: int = 1
    room_type: str = "Sharing"
    capacity: int = 2
    monthly_rent: float = 6000.0
    status: str = "Available"
    has_ac: bool = False
    description: Optional[str] = None

class RoomCreate(RoomBase):
    initial_beds: Optional[int] = None

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[int] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    monthly_rent: Optional[float] = None
    status: Optional[str] = None
    has_ac: Optional[bool] = None
    description: Optional[str] = None

class RoomOut(RoomBase):
    id: int
    bed_count: int = 0
    occupied_count: int = 0
    available_count: int = 0
    beds: List[BedOut] = []

    class Config:
        from_attributes = True

# --- Allocation Schemas ---
class AllocationCreate(BaseModel):
    tenant_id: int
    bed_id: int
    allocation_date: str
    monthly_rent: float

class AllocationVacate(BaseModel):
    vacating_date: str
    vacating_reason: Optional[str] = "Normal checkout"
    room_inspection_status: Optional[str] = "Passed"
    pending_dues: float = 0.0
    deposit_refund_status: Optional[str] = "Full Refund"
    remarks: Optional[str] = None

class AllocationOut(BaseModel):
    id: int
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_id: int
    room_number: str
    bed_id: int
    bed_number: str
    allocation_date: str
    monthly_rent: float
    is_active: bool
    vacating_date: Optional[str] = None
    vacating_reason: Optional[str] = None
    room_inspection_status: Optional[str] = None
    pending_dues: float = 0.0
    deposit_refund_status: Optional[str] = None
    remarks: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Dashboard Schemas (Phase 2) ---
class RoomOverviewItem(BaseModel):
    id: int
    room_number: str
    floor: int
    room_type: str
    capacity: int
    occupied_count: int
    available_count: int
    status: str
    monthly_rent: float
    occupants: List[str] = []

class DashboardOut(BaseModel):
    property_name: str
    total_rooms: int
    total_beds: int
    occupied_beds: int
    available_beds: int
    maintenance_beds: int
    active_tenants: int
    vacated_tenants: int
    pending_tenants: int
    occupancy_rate: float
    room_overview: List[RoomOverviewItem] = []
    registered_users: int = 1


# ==========================================
# PHASE 3: FINANCIAL SCHEMAS
# ==========================================

# --- Rent Invoices ---
class RentGenerateRequest(BaseModel):
    billing_month: int = Field(..., ge=1, le=12)
    billing_year: int = Field(..., ge=2020, le=2050)
    due_date: str
    tenant_id: Optional[int] = None # None means all active tenants
    prorate: bool = True

class RentAdjustRequest(BaseModel):
    adjustment_amount: float
    adjustment_reason: str

class PaymentSummaryBrief(BaseModel):
    id: int
    payment_number: str
    payment_date: str
    amount: float
    payment_mode: str
    receipt_number: str
    is_cancelled: bool

class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    bed_number: str
    billing_month: int
    billing_year: int
    billing_date: str
    due_date: str
    base_rent: float
    prorated_days: Optional[int] = None
    total_days_in_month: Optional[int] = None
    adjustment_amount: float
    adjustment_reason: Optional[str] = None
    total_amount: float
    amount_paid: float
    pending_amount: float
    status: str
    notes: Optional[str] = None
    payments: List[PaymentSummaryBrief] = []
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Payments ---
class PaymentCreate(BaseModel):
    tenant_id: int
    invoice_id: Optional[int] = None
    payment_date: str
    amount: float = Field(..., gt=0)
    payment_type: str = "Monthly Rent" # Monthly Rent, Advance, Security Deposit, Food Charges, etc.
    payment_mode: str = "UPI" # Cash, UPI, Bank Transfer, Other
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None

class PaymentCancelRequest(BaseModel):
    cancellation_reason: str

class PaymentOut(BaseModel):
    id: int
    payment_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    bed_number: str
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    payment_date: str
    amount: float
    payment_type: str
    payment_mode: str
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None
    receipt_number: str
    is_cancelled: bool
    cancellation_reason: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Deposits ---
class DepositCreate(BaseModel):
    tenant_id: int
    deposit_type: str = "Security Deposit" # Security Deposit, Advance Rent
    amount: float = Field(..., gt=0)
    payment_date: str
    payment_mode: str = "UPI"
    transaction_ref: Optional[str] = None
    remarks: Optional[str] = None

class DepositAdjustRequest(BaseModel):
    invoice_id: int
    amount: float = Field(..., gt=0)
    reason: str = "Adjusted against monthly rent"

class DepositRefundRequest(BaseModel):
    amount: float = Field(..., gt=0)
    refund_date: str
    payment_mode: str = "Bank Transfer"
    transaction_ref: Optional[str] = None
    reason: str = "Refund on checkout"

class DepositTransactionOut(BaseModel):
    id: int
    transaction_type: str
    amount: float
    transaction_date: str
    payment_mode: Optional[str] = None
    transaction_ref: Optional[str] = None
    linked_invoice_id: Optional[int] = None
    reason: str
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class DepositOut(BaseModel):
    id: int
    deposit_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    deposit_type: str
    total_amount: float
    payment_date: str
    payment_mode: str
    transaction_ref: Optional[str] = None
    adjusted_amount: float
    refunded_amount: float
    remaining_balance: float
    status: str
    remarks: Optional[str] = None
    transactions: List[DepositTransactionOut] = []
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Expenses ---
class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    category: str
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    expense_date: str
    payment_mode: str = "UPI"
    paid_to: Optional[str] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    expense_date: Optional[str] = None
    payment_mode: Optional[str] = None
    paid_to: Optional[str] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class ExpenseOut(ExpenseCreate):
    id: int
    expense_number: str
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Receipts ---
class ReceiptOut(BaseModel):
    id: int
    receipt_number: str
    payment_id: int
    payment_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    bed_number: str
    payment_type: str
    billing_period: Optional[str] = None
    amount: float
    payment_mode: str
    receipt_date: str
    pdf_filename: str

    class Config:
        from_attributes = True

# --- Financial Dashboard ---
class CategoryExpenseItem(BaseModel):
    category: str
    amount: float
    percentage: float

class FinancialDashboardOut(BaseModel):
    # Income
    total_rent_expected: float
    total_rent_collected: float
    advance_collected: float
    security_deposits_collected: float # Treated as liability, excluded from operating profit
    other_income: float
    total_operating_income: float # Rent collected + other income (excluding deposits)

    # Outstanding
    total_pending_rent: float
    overdue_rent: float
    outstanding_tenant_dues: float
    refundable_deposits_held: float

    # Expenses
    total_monthly_expenses: float
    total_yearly_expenses: float
    expense_breakdown: List[CategoryExpenseItem] = []

    # Financial Summary
    net_operating_income: float # total_operating_income - total_expenses
    cash_collected: float
    upi_collected: float
    bank_transfers_collected: float

    # Metadata
    filter_period: str
    start_date: str
    end_date: str


# ==========================================
# PHASE 4: FOOD, FACILITIES & SERVICES SCHEMAS
# ==========================================

# --- Food Plan Schemas ---
class FoodPlanBase(BaseModel):
    plan_code: str
    plan_name: str
    description: Optional[str] = None
    monthly_price: float
    daily_price: Optional[float] = 0.0
    included_meals: str = "Breakfast, Lunch, Dinner"
    is_active: bool = True

class FoodPlanCreate(FoodPlanBase):
    pass

class FoodPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    description: Optional[str] = None
    monthly_price: Optional[float] = None
    daily_price: Optional[float] = None
    included_meals: Optional[str] = None
    is_active: Optional[bool] = None

class FoodPlanOut(FoodPlanBase):
    id: int
    active_subscriptions_count: int = 0
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Food Subscription Schemas ---
class FoodSubscriptionCreate(BaseModel):
    tenant_id: int
    plan_id: int
    start_date: str # YYYY-MM-DD
    end_date: Optional[str] = None
    monthly_price: Optional[float] = None # Auto-retrieved from plan if omitted
    billing_frequency: str = "Monthly"
    prorate_first_month: bool = True
    remarks: Optional[str] = None

class FoodSubscriptionUpdate(BaseModel):
    plan_id: Optional[int] = None
    status: Optional[str] = None # Active, Paused, Cancelled
    end_date: Optional[str] = None
    monthly_price: Optional[float] = None
    remarks: Optional[str] = None

class FoodSubscriptionOut(BaseModel):
    id: int
    subscription_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    plan_id: int
    plan_name: str
    start_date: str
    end_date: Optional[str] = None
    monthly_price: float
    status: str
    billing_frequency: str
    remarks: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Meal Record Schemas ---
class MealRecordCreate(BaseModel):
    meal_date: str # YYYY-MM-DD
    meal_type: str # Breakfast, Lunch, Dinner
    tenant_id: Optional[int] = None
    status: str = "Served" # Served, Attended, Opted Out, Additional Request
    extra_charge: float = 0.0
    remarks: Optional[str] = None

class MealRecordOut(BaseModel):
    id: int
    meal_date: str
    meal_type: str
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    status: str
    extra_charge: float
    remarks: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class DailyMealSummaryOut(BaseModel):
    meal_date: str
    breakfast_count: int
    lunch_count: int
    dinner_count: int
    opted_out_count: int
    additional_requests_count: int
    total_extra_charges: float

# --- Wi-Fi Service & Subscription Schemas ---
class WifiServiceCreate(BaseModel):
    network_name: str
    description: Optional[str] = None
    monthly_charge: float = 300.0
    is_active: bool = True

class WifiServiceUpdate(BaseModel):
    network_name: Optional[str] = None
    description: Optional[str] = None
    monthly_charge: Optional[float] = None
    is_active: Optional[bool] = None

class WifiServiceOut(BaseModel):
    id: int
    network_name: str
    description: Optional[str] = None
    monthly_charge: float
    is_active: bool
    subscribers_count: int = 0
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class WifiSubscriptionCreate(BaseModel):
    tenant_id: int
    wifi_service_id: int
    activation_date: str
    deactivation_date: Optional[str] = None
    monthly_charge: Optional[float] = None
    included_in_rent: bool = False
    remarks: Optional[str] = None

class WifiSubscriptionOut(BaseModel):
    id: int
    subscription_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    wifi_service_id: int
    network_name: str
    activation_date: str
    deactivation_date: Optional[str] = None
    monthly_charge: float
    included_in_rent: bool
    status: str
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

# --- Parking Schemas ---
class ParkingSlotCreate(BaseModel):
    slot_number: str
    slot_type: str = "Two-wheeler" # Two-wheeler, Four-wheeler, Other
    monthly_charge: float = 300.0
    status: str = "Available" # Available, Occupied, Maintenance
    description: Optional[str] = None

class ParkingSlotUpdate(BaseModel):
    slot_type: Optional[str] = None
    monthly_charge: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None

class ParkingSlotOut(BaseModel):
    id: int
    slot_number: str
    slot_type: str
    monthly_charge: float
    status: str
    description: Optional[str] = None
    current_occupant_name: Optional[str] = None
    current_vehicle_number: Optional[str] = None

    class Config:
        from_attributes = True

class ParkingAllocationCreate(BaseModel):
    tenant_id: int
    slot_id: int
    vehicle_type: str = "Two-wheeler"
    vehicle_number: str
    allocation_date: str
    monthly_charge: Optional[float] = None
    remarks: Optional[str] = None

class ParkingReleaseRequest(BaseModel):
    release_date: str
    remarks: Optional[str] = None

class ParkingAllocationOut(BaseModel):
    id: int
    allocation_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    slot_id: int
    slot_number: str
    vehicle_type: str
    vehicle_number: str
    allocation_date: str
    release_date: Optional[str] = None
    monthly_charge: float
    status: str
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

# --- AC Service Schemas ---
class AcSubscriptionCreate(BaseModel):
    room_id: int
    tenant_id: Optional[int] = None
    billing_rule: str = "room_split" # room_split, tenant_fixed, included_in_rent
    monthly_charge: float = 1500.0
    split_among_occupants: bool = True
    start_date: str
    end_date: Optional[str] = None
    remarks: Optional[str] = None

class AcSubscriptionOut(BaseModel):
    id: int
    subscription_number: str
    room_id: int
    room_number: str
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    billing_rule: str
    monthly_charge: float
    split_among_occupants: bool
    status: str
    start_date: str
    end_date: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

# --- Electricity Schemas ---
class ElectricityMeterCreate(BaseModel):
    meter_number: str
    room_id: int
    meter_type: str = "Sub-meter"
    rate_per_unit: float = 10.0
    billing_method: str = "Meter-based" # Meter-based, Fixed monthly, Included in rent
    fixed_monthly_amount: float = 0.0
    status: str = "Active"

class ElectricityMeterUpdate(BaseModel):
    rate_per_unit: Optional[float] = None
    billing_method: Optional[str] = None
    fixed_monthly_amount: Optional[float] = None
    status: Optional[str] = None

class ElectricityMeterOut(BaseModel):
    id: int
    meter_number: str
    room_id: int
    room_number: str
    meter_type: str
    rate_per_unit: float
    billing_method: str
    fixed_monthly_amount: float
    status: str
    latest_reading: Optional[float] = None

    class Config:
        from_attributes = True

class ElectricityReadingCreate(BaseModel):
    meter_id: int
    billing_month: int
    billing_year: int
    current_reading: float
    reading_date: str
    previous_reading: Optional[float] = None # Auto-computed from prior reading if omitted
    rate_per_unit: Optional[float] = None # Auto-computed from meter if omitted
    remarks: Optional[str] = None

class ElectricityReadingOut(BaseModel):
    id: int
    reading_number: str
    meter_id: int
    meter_number: str
    room_id: int
    room_number: str
    billing_month: int
    billing_year: int
    previous_reading: float
    current_reading: float
    units_consumed: float
    rate_per_unit: float
    total_amount: float
    reading_date: str
    is_billed: bool
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

# --- Additional Services Catalog & Subscriptions ---
class ServiceCatalogCreate(BaseModel):
    service_code: str
    service_name: str
    category: str = "Other"
    description: Optional[str] = None
    billing_type: str = "Monthly"
    price: float
    billing_frequency: str = "Monthly"
    is_active: bool = True

class ServiceCatalogUpdate(BaseModel):
    service_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    billing_type: Optional[str] = None
    price: Optional[float] = None
    billing_frequency: Optional[str] = None
    is_active: Optional[bool] = None

class ServiceCatalogOut(BaseModel):
    id: int
    service_code: str
    service_name: str
    category: str
    description: Optional[str] = None
    billing_type: str
    price: float
    billing_frequency: str
    is_active: bool
    active_subscriptions_count: int = 0

    class Config:
        from_attributes = True

class TenantServiceSubCreate(BaseModel):
    tenant_id: int
    service_id: int
    start_date: str
    end_date: Optional[str] = None
    quantity: int = 1
    unit_price: Optional[float] = None
    remarks: Optional[str] = None

class TenantServiceSubOut(BaseModel):
    id: int
    subscription_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    service_id: int
    service_name: str
    category: str
    start_date: str
    end_date: Optional[str] = None
    quantity: int
    unit_price: float
    total_amount: float
    status: str
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

# --- Centralized Service Billing ---
class GenerateServiceBillingRequest(BaseModel):
    billing_month: int
    billing_year: int
    due_date: str
    integrate_with_rent_invoice: bool = False
    service_categories: Optional[List[str]] = None

class ServiceChargeOut(BaseModel):
    id: int
    charge_number: str
    tenant_id: int
    tenant_name: str
    tenant_code: str
    room_number: str
    service_category: str
    source_ref_id: Optional[int] = None
    title: str
    billing_month: int
    billing_year: int
    amount: float
    amount_paid: float
    pending_amount: float
    due_date: str
    status: str
    invoice_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class ServicePaymentRequest(BaseModel):
    charge_id: int
    amount: float
    payment_mode: str = "UPI"
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None

# --- Services Dashboard ---
class ServicesDashboardOut(BaseModel):
    active_food_subscribers: int
    monthly_food_revenue: float
    active_wifi_subscribers: int
    active_parking_allocations: int
    active_ac_subscriptions: int
    monthly_electricity_charges: float
    active_additional_services: int
    total_service_charges_generated: float
    total_service_payments_collected: float
    pending_service_charges: float
    category_breakdown: List[Dict[str, Any]] = []


# =========================================================================
# PHASE 6: SCHEMAS
# =========================================================================

# --- Notifications ---
class NotificationOut(BaseModel):
    id: int
    notification_code: str
    title: str
    description: str
    category: str
    priority: str
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    is_read: bool
    read_at: Optional[Any] = None
    is_dismissed: bool
    delivery_status: str
    scheduled_date: Optional[str] = None
    expiry_date: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class NotificationPreferenceOut(BaseModel):
    id: int
    key: str
    value: str
    category: str
    description: Optional[str] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True

class NotificationPreferenceUpdate(BaseModel):
    preferences: Dict[str, str]

class ReminderHistoryOut(BaseModel):
    id: int
    invoice_id: Optional[int] = None
    tenant_id: int
    tenant_name: Optional[str] = None
    reminder_type: str
    amount_due: float
    sent_date: str
    channel: str
    status: str
    notes: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Scheduled Jobs ---
class JobExecutionLogOut(BaseModel):
    id: int
    job_id: int
    job_key: str
    execution_time: Any
    status: str
    details: Optional[str] = None
    duration_ms: int

    class Config:
        from_attributes = True

class ScheduledJobOut(BaseModel):
    id: int
    job_key: str
    name: str
    description: Optional[str] = None
    cron_expression: str
    is_active: bool
    last_run_at: Optional[Any] = None
    last_status: Optional[str] = None
    last_message: Optional[str] = None
    next_run_at: Optional[Any] = None
    execution_logs: List[JobExecutionLogOut] = []

    class Config:
        from_attributes = True

class ScheduledJobUpdate(BaseModel):
    is_active: Optional[bool] = None
    cron_expression: Optional[str] = None

# --- Reports ---
class ReportHistoryOut(BaseModel):
    id: int
    report_type: str
    report_title: str
    start_date: str
    end_date: str
    generated_by: str
    summary_json: str
    pdf_filename: Optional[str] = None
    csv_filename: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

class ReportGenerateRequest(BaseModel):
    report_type: str # Daily, Weekly, Monthly
    date_str: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None

# --- Tasks ---
class PgTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General Task"
    priority: str = "Medium"
    status: str = "Pending"
    assigned_to: Optional[str] = None
    tenant_id: Optional[int] = None
    due_date: Optional[str] = None
    completed_date: Optional[str] = None
    remarks: Optional[str] = None

class PgTaskCreate(PgTaskBase):
    pass

class PgTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    tenant_id: Optional[int] = None
    due_date: Optional[str] = None
    completed_date: Optional[str] = None
    remarks: Optional[str] = None

class PgTaskOut(PgTaskBase):
    id: int
    task_code: str
    created_by: str
    tenant_name: Optional[str] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Audit Logs ---
class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    outcome: str
    details: str
    ip_address: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True

# --- Backup Management ---
class BackupItemOut(BaseModel):
    filename: str
    size_bytes: int
    size_mb: float
    created_at: str
    integrity_status: str

class BackupSettingsOut(BaseModel):
    auto_backup_enabled: bool
    backup_time: str
    retention_days: int
    total_backups_count: int
    total_size_mb: float
    last_backup_time: Optional[str] = None

class BackupSettingsUpdate(BaseModel):
    auto_backup_enabled: Optional[bool] = None
    backup_time: Optional[str] = None
    retention_days: Optional[int] = None

# --- Data Import ---
class DataImportPreviewRequest(BaseModel):
    entity_type: str
    filename: str
    content_text: str

class DataImportPreviewOut(BaseModel):
    entity_type: str
    filename: str
    total_rows: int
    valid_count: int
    skipped_count: int
    error_count: int
    errors: List[str] = []
    skipped: List[Dict[str, Any]] = []
    preview: List[Dict[str, Any]] = []

class DataImportConfirmRequest(BaseModel):
    entity_type: str
    filename: str
    rows: List[Dict[str, Any]]

# --- System Health ---
class SystemHealthOut(BaseModel):
    status: str
    app_name: str
    system_time: str
    database_connected: bool
    database_size_mb: float
    disk_total_gb: float
    disk_free_gb: float
    disk_used_pct: float
    low_disk_warning: bool
    last_backup_filename: Optional[str] = None
    last_backup_time: Optional[str] = None
    scheduler_active: bool
    total_jobs: int
    failed_jobs_24h: int
    pending_notifications_count: int
    overdue_invoices_count: int
    warnings: List[str] = []
