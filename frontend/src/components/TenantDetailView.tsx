import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  BedDouble,
  AlertCircle,
  Clock,
  ShieldCheck,
  DollarSign,
  Utensils,
  Wifi,
  Car,
  Wind,
  Layers,
  Receipt,
  CreditCard,
  Wallet,
  CheckCircle2,
  Edit,
  KeyRound,
  LogOut,
  RefreshCw,
  PlusCircle
} from 'lucide-react'
import { Tenant } from '../types'

interface Props {
  tenantId: number
  onBack: () => void
  onEditTenant?: (tenant: Tenant) => void
  onAllocateTenant?: (tenant: Tenant) => void
  onVacateTenant?: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
  onRecordPayment?: (tenantId: number) => void
  isClient?: boolean
}

export default function TenantDetailView({
  tenantId,
  onBack,
  onEditTenant,
  onAllocateTenant,
  onVacateTenant,
  onRecordPayment,
  isClient = false
}: Props) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'services' | 'billing' | 'history'>('all')

  async function loadTenant() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load tenant details.')
      const data = await res.json()
      setTenant(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching tenant profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTenant()
  }, [tenantId])

  if (loading) {
    return (
      <div className="view-container">
        <div className="loading-container">
          <RefreshCw size={24} className="spin text-primary" />
          <p className="margin-top-12">Loading full resident dossier and service subscriptions...</p>
        </div>
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="view-container">
        <div className="alert-error">
          <AlertCircle size={18} />
          <span>{error || 'Tenant not found.'}</span>
        </div>
        <button className="btn-secondary margin-top-16" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Residents Directory
        </button>
      </div>
    )
  }

  const alloc = tenant.current_allocation
  const foodSubs = tenant.food_subscriptions || []
  const wifiSubs = tenant.wifi_subscriptions || []
  const parkingAllocs = tenant.parking_allocations || []
  const acSubs = tenant.ac_subscriptions || []
  const customServices = tenant.custom_services || []
  const invoices = tenant.invoices || []
  const payments = tenant.payments || []
  const deposits = tenant.deposits || []

  const totalSubsCount =
    foodSubs.length + wifiSubs.length + parkingAllocs.length + acSubs.length + customServices.length

  return (
    <div className="view-container tenant-dossier-page">
      {/* Navigation & Header Toolbar */}
      <div className="dossier-top-bar">
        <button className="btn-back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Residents Directory
        </button>

        <div className="dossier-actions">
          {!isClient && onRecordPayment && (
            <button className="btn-success-action" onClick={() => onRecordPayment(tenant.id)}>
              <CreditCard size={15} /> Record Payment
            </button>
          )}
          {!isClient && onEditTenant && (
            <button className="btn-secondary" onClick={() => onEditTenant(tenant)}>
              <Edit size={15} /> Edit Profile
            </button>
          )}
          {!isClient && alloc && onVacateTenant && (
            <button
              className="btn-danger-outline"
              onClick={() => onVacateTenant(alloc.id, tenant.full_name, alloc.bed_number, alloc.room_number)}
            >
              <LogOut size={15} /> Vacate Bed
            </button>
          )}
          {!isClient && !alloc && onAllocateTenant && (
            <button className="btn-primary" onClick={() => onAllocateTenant(tenant)}>
              <KeyRound size={15} /> Allocate Bed
            </button>
          )}
        </div>
      </div>

      {/* Main Resident Identity Banner Card */}
      <div className="resident-hero-card">
        <div className="resident-hero-main">
          <div className="resident-avatar-huge">
            {tenant.full_name[0]?.toUpperCase() || 'T'}
          </div>
          <div className="resident-hero-info">
            <div className="flex-row gap-10 align-center flex-wrap">
              <h2>{tenant.full_name}</h2>
              <span className="badge badge-code font-13">{tenant.tenant_code}</span>
              <span className={`badge badge-status-${tenant.status.toLowerCase()}`}>
                {tenant.status}
              </span>
            </div>
            <p className="hero-subtext">
              Resident since <strong>{tenant.joining_date}</strong> · {tenant.occupation || 'Resident'}
              {tenant.company_or_college ? ` at ${tenant.company_or_college}` : ''}
              {tenant.expected_leaving_date ? ` · Expected checkout: ${tenant.expected_leaving_date}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Telemetry Metric Widgets Strip */}
      <div className="dossier-kpi-grid">
        <div className="dossier-kpi-widget">
          <div className="kpi-widget-icon bg-blue-subtle text-accent">
            <BedDouble size={20} />
          </div>
          <div className="kpi-widget-content">
            <span className="kpi-widget-title">CURRENT BED</span>
            <strong className="kpi-widget-value">
              {alloc ? `Room ${alloc.room_number}` : 'Unallocated'}
            </strong>
            <small className="kpi-widget-sub">
              {alloc ? `${alloc.bed_number} · Floor ${alloc.floor}` : 'No active bed'}
            </small>
          </div>
        </div>

        <div className="dossier-kpi-widget">
          <div className="kpi-widget-icon bg-slate-subtle text-secondary">
            <DollarSign size={20} />
          </div>
          <div className="kpi-widget-content">
            <span className="kpi-widget-title">MONTHLY RENT</span>
            <strong className="kpi-widget-value">
              ₹{(alloc?.monthly_rent || 0).toLocaleString('en-IN')}
            </strong>
            <small className="kpi-widget-sub">Base bed rate</small>
          </div>
        </div>

        <div className="dossier-kpi-widget">
          <div className="kpi-widget-icon bg-emerald-subtle text-success">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-widget-content">
            <span className="kpi-widget-title">TOTAL PAID</span>
            <strong className="kpi-widget-value text-success">
              ₹{(tenant.total_paid || 0).toLocaleString('en-IN')}
            </strong>
            <small className="kpi-widget-sub">{payments.length} verified transaction(s)</small>
          </div>
        </div>

        <div className="dossier-kpi-widget">
          <div className={`kpi-widget-icon ${(tenant.total_pending || 0) > 0 ? 'bg-rose-subtle text-danger' : 'bg-emerald-subtle text-success'}`}>
            <Receipt size={20} />
          </div>
          <div className="kpi-widget-content">
            <span className="kpi-widget-title">OUTSTANDING DUES</span>
            <strong className={`kpi-widget-value ${(tenant.total_pending || 0) > 0 ? 'text-danger' : 'text-success'}`}>
              ₹{(tenant.total_pending || 0).toLocaleString('en-IN')}
            </strong>
            <small className="kpi-widget-sub">
              {(tenant.total_pending || 0) > 0 ? 'Rent dues pending' : 'Zero balance / Cleared'}
            </small>
          </div>
        </div>

        <div className="dossier-kpi-widget">
          <div className="kpi-widget-icon bg-amber-subtle text-warning">
            <ShieldCheck size={20} />
          </div>
          <div className="kpi-widget-content">
            <span className="kpi-widget-title">SECURITY DEPOSIT</span>
            <strong className="kpi-widget-value">
              ₹{(tenant.security_deposit_held || 0).toLocaleString('en-IN')}
            </strong>
            <small className="kpi-widget-sub">Held in security ledger</small>
          </div>
        </div>
      </div>

      {/* Filter / View Tabs */}
      <div className="dossier-tabs-strip">
        <button
          className={`dossier-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Dossier Widgets
        </button>
        <button
          className={`dossier-tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          Subscriptions & Facilities ({totalSubsCount})
        </button>
        <button
          className={`dossier-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing & Payments ({invoices.length + payments.length})
        </button>
        <button
          className={`dossier-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Stay History ({tenant.allocations?.length || 0})
        </button>
      </div>

      {/* Main Widgets Container */}
      <div className="dossier-widgets-container">
        {/* ROW 1: PROFILE DOSSIER & ROOM ALLOCATION WIDGETS */}
        {(activeTab === 'all' || activeTab === 'services') && (
          <div className="dossier-two-col-grid">
            {/* Widget: Personal & Contact Dossier */}
            <div className="dossier-card-widget">
              <div className="widget-header">
                <div className="flex-row gap-8 align-center">
                  <User size={18} className="text-primary" />
                  <h3>Personal & Contact Dossier</h3>
                </div>
              </div>
              <div className="widget-body">
                <div className="profile-details-list">
                  <div className="profile-detail-row">
                    <span className="detail-label"><Phone size={14} /> Mobile Phone</span>
                    <strong className="detail-val">{tenant.mobile}</strong>
                  </div>
                  <div className="profile-detail-row">
                    <span className="detail-label"><Mail size={14} /> Email Address</span>
                    <strong className="detail-val">{tenant.email || 'Not provided'}</strong>
                  </div>
                  <div className="profile-detail-row">
                    <span className="detail-label"><Calendar size={14} /> Gender & DOB</span>
                    <span className="detail-val">{tenant.gender} {tenant.dob ? `· DOB: ${tenant.dob}` : ''}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="detail-label"><Briefcase size={14} /> Occupation & Org</span>
                    <span className="detail-val">
                      {tenant.occupation || 'Resident'} {tenant.company_or_college ? `(${tenant.company_or_college})` : ''}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="detail-label"><MapPin size={14} /> Permanent Address</span>
                    <span className="detail-val">{tenant.permanent_address || 'Not provided'}</span>
                  </div>
                  <div className="profile-detail-row highlight-subtle">
                    <span className="detail-label"><ShieldCheck size={14} /> Emergency Contact</span>
                    <span className="detail-val">
                      <strong>{tenant.emergency_contact_name || 'N/A'}</strong>
                      {tenant.emergency_contact_number && ` · Phone: ${tenant.emergency_contact_number}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget: Room & Bed Status */}
            <div className="dossier-card-widget">
              <div className="widget-header">
                <div className="flex-row gap-8 align-center">
                  <BedDouble size={18} className="text-primary" />
                  <h3>Accommodation & Bed Assignment</h3>
                </div>
                {alloc && (
                  <span className="badge badge-active">Active Resident</span>
                )}
              </div>
              <div className="widget-body">
                {alloc ? (
                  <div className="room-highlight-container">
                    <div className="room-identity-box">
                      <div className="room-big-badge">Room {alloc.room_number}</div>
                      <div className="bed-big-pill">{alloc.bed_number}</div>
                    </div>
                    <div className="room-info-grid margin-top-16">
                      <div className="room-info-item">
                        <small>Floor</small>
                        <strong>Floor {alloc.floor}</strong>
                      </div>
                      <div className="room-info-item">
                        <small>Monthly Rent</small>
                        <strong className="text-accent">₹{alloc.monthly_rent?.toLocaleString('en-IN')}/mo</strong>
                      </div>
                      <div className="room-info-item">
                        <small>Check-in Date</small>
                        <strong>{alloc.allocation_date}</strong>
                      </div>
                      <div className="room-info-item">
                        <small>Room Inspection</small>
                        <strong>{alloc.room_inspection_status || 'Verified Clean'}</strong>
                      </div>
                    </div>
                    {!isClient && onVacateTenant && (
                      <div className="margin-top-20">
                        <button
                          className="btn-danger-outline full"
                          onClick={() => onVacateTenant(alloc.id, tenant.full_name, alloc.bed_number, alloc.room_number)}
                        >
                          <LogOut size={15} /> Initiate Checkout & Vacate Bed
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-allocation-widget">
                    <BedDouble size={40} className="muted-text" />
                    <h4>No Bed Allocated</h4>
                    <p className="muted-text font-12">
                      This resident currently has no assigned room or bed. Click below to assign an available bed.
                    </p>
                    {!isClient && onAllocateTenant && (
                      <button className="btn-primary btn-sm margin-top-12" onClick={() => onAllocateTenant(tenant)}>
                        <KeyRound size={14} /> Allocate Bed Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ROW 2: ACTIVE SUBSCRIPTIONS & SERVICES WIDGET (FULL WIDTH) */}
        {(activeTab === 'all' || activeTab === 'services') && (
          <div className="dossier-card-widget margin-top-20">
            <div className="widget-header">
              <div className="flex-row gap-8 align-center">
                <Layers size={18} className="text-primary" />
                <h3>Active Subscriptions & Ancillary Services</h3>
              </div>
              <span className="badge badge-neutral">{totalSubsCount} Subscribed Service(s)</span>
            </div>
            <div className="widget-body">
              <div className="service-cards-masonry">
                {/* 1. Meal & Food Subscription Card */}
                <div className="service-dossier-card">
                  <div className="service-card-head">
                    <div className="flex-row gap-8 align-center">
                      <div className="service-card-icon bg-amber-subtle text-warning">
                        <Utensils size={18} />
                      </div>
                      <div>
                        <strong>Meal & Food Plan</strong>
                        <small className="display-block text-muted">Daily dining service</small>
                      </div>
                    </div>
                    <span className={`badge ${foodSubs.length > 0 ? 'badge-active' : 'badge-neutral'}`}>
                      {foodSubs.length > 0 ? 'Subscribed' : 'None'}
                    </span>
                  </div>
                  <div className="service-card-content">
                    {foodSubs.length > 0 ? (
                      foodSubs.map((fs: any) => (
                        <div key={fs.id} className="sub-detail-block">
                          <div className="flex-between">
                            <strong>{fs.plan_name}</strong>
                            <strong className="text-accent">₹{fs.monthly_price?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div className="flex-between font-12 text-muted margin-top-4">
                            <span>Code: <code>{fs.plan_code}</code></span>
                            <span>{fs.billing_frequency || 'Monthly'}</span>
                          </div>
                          <div className="font-11 text-muted margin-top-4">
                            Active from {fs.start_date || 'N/A'} {fs.end_date ? `to ${fs.end_date}` : ''}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-service-text">No active meal plan subscriptions for this resident.</p>
                    )}
                  </div>
                </div>

                {/* 2. Wi-Fi Subscription Card */}
                <div className="service-dossier-card">
                  <div className="service-card-head">
                    <div className="flex-row gap-8 align-center">
                      <div className="service-card-icon bg-blue-subtle text-accent">
                        <Wifi size={18} />
                      </div>
                      <div>
                        <strong>High-Speed Wi-Fi</strong>
                        <small className="display-block text-muted">Fiber broadband access</small>
                      </div>
                    </div>
                    <span className={`badge ${wifiSubs.length > 0 ? 'badge-active' : 'badge-neutral'}`}>
                      {wifiSubs.length > 0 ? 'Subscribed' : 'None'}
                    </span>
                  </div>
                  <div className="service-card-content">
                    {wifiSubs.length > 0 ? (
                      wifiSubs.map((ws: any) => (
                        <div key={ws.id} className="sub-detail-block">
                          <div className="flex-between">
                            <strong>{ws.service_name}</strong>
                            <strong className="text-accent">₹{ws.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div className="font-12 text-muted margin-top-4">
                            {ws.description || 'Unlimited high-speed internet'}
                          </div>
                          <div className="font-11 text-muted margin-top-4">
                            Activated on {ws.activation_date || 'N/A'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-service-text">No dedicated Wi-Fi plan assigned.</p>
                    )}
                  </div>
                </div>

                {/* 3. Vehicle Parking Card */}
                <div className="service-dossier-card">
                  <div className="service-card-head">
                    <div className="flex-row gap-8 align-center">
                      <div className="service-card-icon bg-emerald-subtle text-success">
                        <Car size={18} />
                      </div>
                      <div>
                        <strong>Vehicle Parking</strong>
                        <small className="display-block text-muted">Dedicated slot allotment</small>
                      </div>
                    </div>
                    <span className={`badge ${parkingAllocs.length > 0 ? 'badge-active' : 'badge-neutral'}`}>
                      {parkingAllocs.length > 0 ? 'Allocated' : 'None'}
                    </span>
                  </div>
                  <div className="service-card-content">
                    {parkingAllocs.length > 0 ? (
                      parkingAllocs.map((pa: any) => (
                        <div key={pa.id} className="sub-detail-block">
                          <div className="flex-between">
                            <strong>Slot {pa.slot_number} ({pa.slot_type})</strong>
                            <strong className="text-accent">₹{pa.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div className="flex-between font-12 text-muted margin-top-4">
                            <span>Vehicle: {pa.vehicle_type}</span>
                            <strong><code>{pa.vehicle_number}</code></strong>
                          </div>
                          <div className="font-11 text-muted margin-top-4">
                            Allotted on {pa.allocation_date || 'N/A'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-service-text">No parking slots allocated for this resident.</p>
                    )}
                  </div>
                </div>

                {/* 4. Air Conditioning Card */}
                <div className="service-dossier-card">
                  <div className="service-card-head">
                    <div className="flex-row gap-8 align-center">
                      <div className="service-card-icon bg-cyan-subtle text-info">
                        <Wind size={18} />
                      </div>
                      <div>
                        <strong>Air Conditioning (AC)</strong>
                        <small className="display-block text-muted">Climate control billing</small>
                      </div>
                    </div>
                    <span className={`badge ${acSubs.length > 0 ? 'badge-active' : 'badge-neutral'}`}>
                      {acSubs.length > 0 ? 'Active' : 'None'}
                    </span>
                  </div>
                  <div className="service-card-content">
                    {acSubs.length > 0 ? (
                      acSubs.map((ac: any) => (
                        <div key={ac.id} className="sub-detail-block">
                          <div className="flex-between">
                            <strong>Room {ac.room_number} AC</strong>
                            <strong className="text-accent">₹{ac.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div className="font-12 text-muted margin-top-4">
                            Rule: {ac.billing_rule}
                          </div>
                          <div className="font-11 text-muted margin-top-4">
                            Active since {ac.start_date || 'N/A'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-service-text">No AC subscription active for this resident.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Facilities Subscribed */}
              {customServices.length > 0 && (
                <div className="custom-services-strip margin-top-16">
                  <h4 className="font-12 uppercase text-muted margin-bottom-8">Additional Custom Facilities</h4>
                  <div className="custom-services-grid">
                    {customServices.map((cs: any) => (
                      <div key={cs.id} className="custom-service-chip">
                        <span>{cs.service_name}</span>
                        <strong className="text-accent">₹{cs.total_amount?.toLocaleString('en-IN')}/mo</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROW 3: BILLING & INVOICES WIDGET */}
        {(activeTab === 'all' || activeTab === 'billing') && (
          <div className="dossier-card-widget margin-top-20">
            <div className="widget-header">
              <div className="flex-row gap-8 align-center">
                <Receipt size={18} className="text-primary" />
                <h3>Rent Invoices & Billing Ledger</h3>
              </div>
              <span className="badge badge-neutral">{invoices.length} Invoices</span>
            </div>
            <div className="widget-body">
              {invoices.length > 0 ? (
                <div className="table-responsive-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Billing Cycle</th>
                        <th>Due Date</th>
                        <th>Total Amount</th>
                        <th>Amount Paid</th>
                        <th>Pending Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td><code>{inv.invoice_number}</code></td>
                          <td><strong>{inv.billing_month}/{inv.billing_year}</strong></td>
                          <td>{inv.due_date}</td>
                          <td><strong>₹{inv.total_amount?.toLocaleString('en-IN')}</strong></td>
                          <td className="text-success">₹{inv.amount_paid?.toLocaleString('en-IN')}</td>
                          <td className={inv.pending_amount > 0 ? 'text-danger font-bold' : 'text-muted'}>
                            ₹{inv.pending_amount?.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <span className={`badge badge-status-${(inv.status || 'unpaid').toLowerCase().replace(' ', '-')}`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-service-text padding-16">No monthly rent invoices generated for this tenant yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ROW 4: PAYMENTS & DEPOSITS LEDGERS */}
        {(activeTab === 'all' || activeTab === 'billing') && (
          <div className="dossier-two-col-grid margin-top-20">
            {/* Widget: Payments History */}
            <div className="dossier-card-widget">
              <div className="widget-header">
                <div className="flex-row gap-8 align-center">
                  <CreditCard size={18} className="text-primary" />
                  <h3>Payment History</h3>
                </div>
                <span className="badge badge-neutral">{payments.length} Payments</span>
              </div>
              <div className="widget-body">
                {payments.length > 0 ? (
                  <div className="table-responsive-wrapper">
                    <table className="mini-data-table">
                      <thead>
                        <tr>
                          <th>Payment #</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Mode</th>
                          <th>Ref #</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p: any) => (
                          <tr key={p.id}>
                            <td><code>{p.payment_number}</code></td>
                            <td>{p.payment_date}</td>
                            <td><strong className="text-success">₹{p.amount?.toLocaleString('en-IN')}</strong></td>
                            <td>{p.payment_method}</td>
                            <td><small className="text-muted">{p.reference_number || 'N/A'}</small></td>
                            <td>
                              {p.is_cancelled ? (
                                <span className="badge badge-danger">Cancelled</span>
                              ) : (
                                <span className="badge badge-success">Verified</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-service-text padding-16">No payment records found.</p>
                )}
              </div>
            </div>

            {/* Widget: Security Deposits */}
            <div className="dossier-card-widget">
              <div className="widget-header">
                <div className="flex-row gap-8 align-center">
                  <Wallet size={18} className="text-primary" />
                  <h3>Security Deposit Ledger</h3>
                </div>
                <span className="badge badge-neutral">{deposits.length} Deposit(s)</span>
              </div>
              <div className="widget-body">
                {deposits.length > 0 ? (
                  <div className="table-responsive-wrapper">
                    <table className="mini-data-table">
                      <thead>
                        <tr>
                          <th>Deposit #</th>
                          <th>Type</th>
                          <th>Original</th>
                          <th>Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map((d: any) => (
                          <tr key={d.id}>
                            <td><code>{d.deposit_number}</code></td>
                            <td>{d.deposit_type}</td>
                            <td>₹{d.amount?.toLocaleString('en-IN')}</td>
                            <td><strong className="text-success">₹{d.remaining_balance?.toLocaleString('en-IN')}</strong></td>
                            <td>
                              <span className="badge badge-active">{d.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-service-text padding-16">No deposit transactions logged.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ROW 5: ALLOCATION & STAY HISTORY */}
        {(activeTab === 'all' || activeTab === 'history') && (
          <div className="dossier-card-widget margin-top-20 margin-bottom-30">
            <div className="widget-header">
              <div className="flex-row gap-8 align-center">
                <Clock size={18} className="text-primary" />
                <h3>Room & Bed Stay History</h3>
              </div>
              <span className="badge badge-neutral">{tenant.allocations?.length || 0} Allocation(s)</span>
            </div>
            <div className="widget-body">
              {tenant.allocations && tenant.allocations.length > 0 ? (
                <div className="history-timeline padding-12">
                  {tenant.allocations.map((a: any) => (
                    <div key={a.id} className={`timeline-card ${a.is_active ? 'active-item' : 'past-item'}`}>
                      <div className="timeline-header">
                        <div className="flex-row gap-8 align-center">
                          <BedDouble size={16} />
                          <strong>Room {a.room_number} · {a.bed_number}</strong>
                          {a.is_active ? (
                            <span className="badge badge-active">Currently Active</span>
                          ) : (
                            <span className="badge badge-vacated">Vacated</span>
                          )}
                        </div>
                        <span className="rent-tag">₹{a.monthly_rent?.toLocaleString('en-IN')}/mo</span>
                      </div>
                      <div className="timeline-body">
                        <div><small>Allotted On:</small> {a.allocation_date}</div>
                        {a.vacating_date && <div><small>Vacated On:</small> {a.vacating_date}</div>}
                        {a.vacating_reason && <div><small>Reason:</small> {a.vacating_reason}</div>}
                        {a.room_inspection_status && <div><small>Inspection:</small> {a.room_inspection_status}</div>}
                        {a.deposit_refund_status && <div><small>Deposit Refund:</small> {a.deposit_refund_status}</div>}
                        {a.remarks && <div><small>Remarks:</small> {a.remarks}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-service-text padding-16">No past allocation history records.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
