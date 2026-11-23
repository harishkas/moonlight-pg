export type User = {
  username: string
  role: 'master' | 'admin' | 'client' | string
}

export type SystemUserItem = {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at?: string
}

export type AllocationBrief = {
  id: number
  room_id: number
  room_number: string
  floor: number
  bed_id: number
  bed_number: string
  allocation_date: string
  monthly_rent: number
  is_active: boolean
  vacating_date?: string | null
  vacating_reason?: string | null
  room_inspection_status?: string | null
  pending_dues: number
  deposit_refund_status?: string | null
  remarks?: string | null
  created_at?: string
}

export type Tenant = {
  id: number
  tenant_code: string
  full_name: string
  mobile: string
  email?: string | null
  gender: string
  dob?: string | null
  permanent_address?: string | null
  emergency_contact_name?: string | null
  emergency_contact_number?: string | null
  occupation?: string | null
  company_or_college?: string | null
  joining_date: string
  expected_leaving_date?: string | null
  status: 'Active' | 'Vacated' | 'Pending'
  current_allocation?: AllocationBrief | null
  allocations?: AllocationBrief[]
  pending_balance?: number
  total_paid?: number
  total_pending?: number
  security_deposit_held?: number
  advance_rent_held?: number
  created_at?: string
  updated_at?: string
}

export type BedOccupant = {
  tenant_id: number
  tenant_code: string
  full_name: string
  mobile: string
  allocation_id: number
  allocation_date: string
}

export type Bed = {
  id: number
  room_id: number
  bed_number: string
  status: 'Available' | 'Occupied' | 'Maintenance'
  monthly_rent: number
  occupant?: BedOccupant | null
}

export type Room = {
  id: number
  room_number: string
  floor: number
  room_type: string
  capacity: number
  monthly_rent: number
  status: 'Available' | 'Partially Occupied' | 'Full' | 'Maintenance'
  has_ac: boolean
  description?: string | null
  bed_count: number
  occupied_count: number
  available_count: number
  beds: Bed[]
}

export type Allocation = {
  id: number
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_id: number
  room_number: string
  bed_id: number
  bed_number: string
  allocation_date: string
  monthly_rent: number
  is_active: boolean
  vacating_date?: string | null
  vacating_reason?: string | null
  room_inspection_status?: string | null
  pending_dues: number
  deposit_refund_status?: string | null
  remarks?: string | null
  created_at?: string
}

export type RoomOverviewItem = {
  id: number
  room_number: string
  floor: number
  room_type: string
  capacity: number
  occupied_count: number
  available_count: number
  status: string
  monthly_rent: number
  occupants: string[]
}

export type DashboardData = {
  property_name: string
  total_rooms: number
  total_beds: number
  occupied_beds: number
  available_beds: number
  maintenance_beds: number
  active_tenants: number
  vacated_tenants: number
  pending_tenants: number
  occupancy_rate: number
  room_overview: RoomOverviewItem[]
  registered_users: number
}

// ==========================================
// PHASE 3: FINANCIAL TYPES
// ==========================================

export type PaymentSummaryBrief = {
  id: number
  payment_number: string
  payment_date: string
  amount: number
  payment_mode: string
  receipt_number: string
  is_cancelled: boolean
}

export type RentInvoice = {
  id: number
  invoice_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  bed_number: string
  billing_month: number
  billing_year: number
  billing_date: string
  due_date: string
  base_rent: number
  prorated_days?: number | null
  total_days_in_month?: number | null
  adjustment_amount: number
  adjustment_reason?: string | null
  total_amount: number
  amount_paid: number
  pending_amount: number
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue'
  notes?: string | null
  payments: PaymentSummaryBrief[]
  created_at?: string
}

export type Payment = {
  id: number
  payment_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  bed_number: string
  invoice_id?: number | null
  invoice_number?: string | null
  payment_date: string
  amount: number
  payment_type: string
  payment_mode: string
  transaction_ref?: string | null
  notes?: string | null
  receipt_number: string
  is_cancelled: boolean
  cancellation_reason?: string | null
  created_at?: string
}

export type DepositTransaction = {
  id: number
  transaction_type: 'Collection' | 'Adjustment' | 'Refund' | 'Deduction'
  amount: number
  transaction_date: string
  payment_mode?: string | null
  transaction_ref?: string | null
  linked_invoice_id?: number | null
  reason: string
  created_at?: string
}

export type Deposit = {
  id: number
  deposit_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  deposit_type: 'Security Deposit' | 'Advance Rent'
  total_amount: number
  payment_date: string
  payment_mode: string
  transaction_ref?: string | null
  adjusted_amount: number
  refunded_amount: number
  remaining_balance: number
  status: 'Active' | 'Partially Adjusted' | 'Fully Adjusted' | 'Refunded'
  remarks?: string | null
  transactions: DepositTransaction[]
  created_at?: string
}

export type Expense = {
  id: number
  expense_number: string
  title: string
  category: string
  description?: string | null
  amount: number
  expense_date: string
  payment_mode: string
  paid_to?: string | null
  reference_number?: string | null
  remarks?: string | null
  created_at?: string
}

export type Receipt = {
  id: number
  receipt_number: string
  payment_id: number
  payment_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  bed_number: string
  payment_type: string
  billing_period?: string | null
  amount: number
  payment_mode: string
  receipt_date: string
  pdf_filename: string
}

export type CategoryExpenseItem = {
  category: string
  amount: number
  percentage: number
}

export type FinancialDashboardData = {
  total_rent_expected: number
  total_rent_collected: number
  advance_collected: number
  security_deposits_collected: number
  other_income: number
  total_operating_income: number
  total_pending_rent: number
  overdue_rent: number
  outstanding_tenant_dues: number
  refundable_deposits_held: number
  total_monthly_expenses: number
  total_yearly_expenses: number
  expense_breakdown: CategoryExpenseItem[]
  net_operating_income: number
  cash_collected: number
  upi_collected: number
  bank_transfers_collected: number
  filter_period: string
  start_date: string
  end_date: string
}

export type MonthlyCollectionReportItem = {
  month_num: number
  month_name: string
  year: number
  expected_rent: number
  collected_rent: number
  pending_rent: number
  collection_rate: number
}

export type TenantOutstandingReportItem = {
  tenant_id: number
  tenant_code: string
  tenant_name: string
  mobile: string
  room_number: string
  bed_number: string
  status: string
  pending_invoices_count: number
  total_outstanding_amount: number
}

// ==========================================
// PHASE 4: SERVICES & FACILITIES TYPES
// ==========================================

export type FoodPlan = {
  id: number
  plan_code: string
  plan_name: string
  description?: string | null
  monthly_price: number
  daily_price?: number
  included_meals: string
  is_active: boolean
  active_subscriptions_count: number
  created_at?: string
  updated_at?: string
}

export type FoodSubscription = {
  id: number
  subscription_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  plan_id: number
  plan_name: string
  start_date: string
  end_date?: string | null
  monthly_price: number
  status: 'Active' | 'Paused' | 'Cancelled'
  billing_frequency: string
  remarks?: string | null
  created_at?: string
}

export type MealRecord = {
  id: number
  meal_date: string
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner'
  tenant_id?: number | null
  tenant_name?: string | null
  status: 'Served' | 'Attended' | 'Opted Out' | 'Additional Request'
  extra_charge: number
  remarks?: string | null
  recorded_by?: string | null
  created_at?: string
}

export type DailyMealSummary = {
  meal_date: string
  breakfast_count: number
  lunch_count: number
  dinner_count: number
  opted_out_count: number
  additional_requests_count: number
  total_extra_charges: number
}

export type WifiService = {
  id: number
  network_name: string
  description?: string | null
  monthly_charge: number
  is_active: boolean
  subscribers_count: number
  created_at?: string
}

export type WifiSubscription = {
  id: number
  subscription_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  wifi_service_id: number
  network_name: string
  activation_date: string
  deactivation_date?: string | null
  monthly_charge: number
  included_in_rent: boolean
  status: 'Active' | 'Inactive'
  remarks?: string | null
}

export type ParkingSlot = {
  id: number
  slot_number: string
  slot_type: 'Two-wheeler' | 'Four-wheeler' | 'Other'
  monthly_charge: number
  status: 'Available' | 'Occupied' | 'Maintenance'
  description?: string | null
  current_occupant_name?: string | null
  current_vehicle_number?: string | null
}

export type ParkingAllocation = {
  id: number
  allocation_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  slot_id: number
  slot_number: string
  vehicle_type: string
  vehicle_number: string
  allocation_date: string
  release_date?: string | null
  monthly_charge: number
  status: 'Active' | 'Released'
  remarks?: string | null
}

export type AcSubscription = {
  id: number
  subscription_number: string
  room_id: number
  room_number: string
  tenant_id?: number | null
  tenant_name?: string | null
  billing_rule: string
  monthly_charge: number
  split_among_occupants: boolean
  status: string
  start_date: string
  end_date?: string | null
  remarks?: string | null
}

export type AcRoomOverview = {
  room_id: number
  room_number: string
  floor: number
  room_type: string
  has_ac: boolean
  active_subscriptions_count: number
  subscriptions: Array<{
    id: number
    subscription_number: string
    billing_rule: string
    monthly_charge: number
    split_among_occupants: boolean
    status: string
  }>
}

export type ElectricityMeter = {
  id: number
  meter_number: string
  room_id: number
  room_number: string
  meter_type: string
  rate_per_unit: number
  billing_method: string
  fixed_monthly_amount: number
  status: string
  latest_reading?: number | null
}

export type ElectricityReading = {
  id: number
  reading_number: string
  meter_id: number
  meter_number: string
  room_id: number
  room_number: string
  billing_month: number
  billing_year: number
  previous_reading: number
  current_reading: number
  units_consumed: number
  rate_per_unit: number
  total_amount: number
  reading_date: string
  is_billed: boolean
  remarks?: string | null
}

export type ServiceCatalogItem = {
  id: number
  service_code: string
  service_name: string
  category: string
  description?: string | null
  billing_type: string
  price: number
  billing_frequency: string
  is_active: boolean
  active_subscriptions_count: number
}

export type TenantServiceSubscription = {
  id: number
  subscription_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  service_id: number
  service_name: string
  category: string
  start_date: string
  end_date?: string | null
  quantity: number
  unit_price: number
  total_amount: number
  status: string
  remarks?: string | null
}

export type ServiceCharge = {
  id: number
  charge_number: string
  tenant_id: number
  tenant_name: string
  tenant_code: string
  room_number: string
  service_category: string
  source_ref_id?: number | null
  title: string
  billing_month: number
  billing_year: number
  amount: number
  amount_paid: number
  pending_amount: number
  due_date: string
  status: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue'
  invoice_id?: number | null
  notes?: string | null
  created_at?: string
}

export type ServicesDashboardData = {
  active_food_subscribers: number
  monthly_food_revenue: number
  active_wifi_subscribers: number
  active_parking_allocations: number
  active_ac_subscriptions: number
  monthly_electricity_charges: number
  active_additional_services: number
  total_service_charges_generated: number
  total_service_payments_collected: number
  pending_service_charges: number
  category_breakdown: Array<{
    category: string
    total_billed: number
    total_collected: number
    pending_amount: number
  }>
}



// --- PHASE 6 TYPES: AUTOMATION, NOTIFICATIONS & ADVANCED ANALYTICS ---

export type NotificationItem = {
  id: number
  notification_number: string
  title: string
  description: string
  category: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  tenant_id?: number | null
  tenant_name?: string | null
  related_type?: string | null
  related_id?: number | null
  is_read: boolean
  read_at?: string | null
  delivery_status: string
  expiry_date?: string | null
  created_at: string
}

export type NotificationPreference = {
  id: number
  pref_key: string
  category: string
  channel: string
  is_enabled: boolean
  description?: string | null
}

export type ReminderHistoryItem = {
  id: number
  invoice_id: number
  invoice_number: string
  tenant_id: number
  tenant_name: string
  reminder_type: string
  amount_due: number
  sent_date: string
  channel: string
  status: string
  notes?: string | null
}

export type DuesAgingSummary = {
  total_unpaid_dues: number
  tenants_with_dues_count: number
  aging_0_30: number
  aging_30_60: number
  aging_60_plus: number
  tenants: Array<{
    tenant_id: number
    tenant_code: string
    tenant_name: string
    mobile: string
    room_number: string
    rent_dues: number
    service_dues: number
    total_dues: number
    overdue_0_30: number
    overdue_30_60: number
    overdue_60_plus: number
    invoices_count: number
  }>
}

export type ScheduledJobItem = {
  id: number
  job_key: string
  name: string
  description: string
  cron_expression: string
  is_active: boolean
  last_run_time?: string | null
  next_run_time?: string | null
  last_status?: string | null
  last_error?: string | null
}

export type JobExecutionLogItem = {
  id: number
  job_key: string
  job_name: string
  start_time: string
  end_time?: string | null
  duration_ms: number
  status: string
  records_processed: number
  message?: string | null
  error_details?: string | null
}

export type ReportHistoryItem = {
  id: number
  report_type: string
  report_date?: string | null
  start_date?: string | null
  end_date?: string | null
  generated_by: string
  file_format: string
  file_name: string
  records_count: number
  created_at: string
}

export type PgTaskItem = {
  id: number
  task_number: string
  title: string
  description?: string | null
  category: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
  assigned_to?: string | null
  created_by: string
  due_date?: string | null
  completed_at?: string | null
  completion_notes?: string | null
  created_at: string
}

export type AuditLogItem = {
  id: number
  timestamp: string
  action: string
  entity_name: string
  entity_id?: number | null
  performed_by: string
  ip_address?: string | null
  details?: string | null
}

export type BackupItem = {
  file_name: string
  file_size_mb: number
  created_at: string
  is_verified: boolean
}

export type SystemHealthData = {
  status: 'Healthy' | 'Action Needed' | 'Critical'
  app_name: string
  version: string
  uptime_seconds: number
  database_mode: string
  database_size_mb: number
  database_path: string
  disk_free_gb: number
  last_backup_time?: string | null
  last_backup_age_hours?: number | null
  active_scheduler_jobs: number
  warnings: string[]
}

export type AnalyticsOverviewData = {
  total_rooms: number
  total_beds: number
  occupied_beds: number
  available_beds: number
  maintenance_beds: number
  occupancy_rate: number
  total_rent_expected: number
  total_rent_collected: number
  total_rent_pending: number
  total_all_collected: number
  total_expenses: number
  net_operating_income: number
  collection_rate: number
  active_food_subscriptions: number
  active_parking_allocations: number
  pending_tasks_count: number
  unread_notifications_count: number
}

export type OccupancyAnalyticsData = {
  current_occupancy_rate: number
  occupied_beds: number
  available_beds: number
  total_beds: number
  trends: Array<{
    month: string
    occupancy_rate: number
    occupied_beds: number
    total_beds: number
  }>
  floor_breakdown: Array<{
    floor: number
    total_beds: number
    occupied_beds: number
    occupancy_rate: number
  }>
}

export type FinancialAnalyticsData = {
  monthly_trends: Array<{
    month: string
    rent_income: number
    other_income: number
    total_income: number
    total_expenses: number
    net_operating_income: number
    collection_rate: number
  }>
  expense_breakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
}

export type TenantAnalyticsData = {
  total_tenants_ever: number
  active_tenants: number
  vacated_tenants: number
  retention_rate: number
  average_stay_days: number
  stay_distribution: Array<{
    range: string
    count: number
  }>
}

export type ServicesAnalyticsData = {
  active_food_subscriptions: number
  active_parking_allocations: number
  parking_utilization_rate: number
  food_subscribers_by_plan: Array<{
    plan_name: string
    count: number
  }>
}

export type DataImportPreviewData = {
  entity_type: string
  filename: string
  total_rows: number
  valid_count: number
  error_count: number
  duplicate_count: number
  can_import: boolean
  columns: string[]
  preview_rows: Array<Record<string, any>>
  errors: Array<{ row: number; message: string }>
  duplicates: Array<{ row: number; message: string }>
}
