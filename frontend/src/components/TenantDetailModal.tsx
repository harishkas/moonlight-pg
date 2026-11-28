import { useEffect, useState } from 'react'
import {
  X,
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
  FileSpreadsheet
} from 'lucide-react'
import { Tenant } from '../types'

interface Props {
  tenantId: number
  onClose: () => void
  onAllocate: (tenant: Tenant) => void
  onVacate: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
  onEdit: (tenant: Tenant) => void
}

export default function TenantDetailModal({ tenantId, onClose, onAllocate, onVacate, onEdit }: Props) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'subscriptions' | 'financials' | 'allocations'>('profile')

  async function loadTenant() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load tenant details.')
      const data = await res.json()
      setTenant(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching tenant.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTenant()
  }, [tenantId])

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <p className="loading-text">Loading tenant profile & subscription data...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <p className="error">{error || 'Tenant not found.'}</p>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
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
    <div className="modal-backdrop">
      <div className="modal-card modal-xl">
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row gap-12 align-center">
            <div className="avatar-large">
              {tenant.full_name[0]?.toUpperCase() || 'T'}
            </div>
            <div>
              <div className="flex-row gap-8 align-center">
                <h3>{tenant.full_name}</h3>
                <span className="badge badge-code">{tenant.tenant_code}</span>
                <span className={`badge badge-status-${tenant.status.toLowerCase()}`}>
                  {tenant.status}
                </span>
              </div>
              <p className="muted-text">
                Joined {tenant.joining_date} · {tenant.occupation || 'Resident'}
                {tenant.company_or_college ? ` (${tenant.company_or_college})` : ''}
              </p>
            </div>
          </div>
          <div className="flex-row gap-8 align-center">
            <button className="btn-secondary btn-sm" onClick={() => onEdit(tenant)}>
              Edit Resident
            </button>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Top KPI Quick Ribbon */}
        <div className="tenant-kpi-ribbon">
          <div className="kpi-ribbon-item">
            <span className="ribbon-label">BED ALLOCATION</span>
            <strong>{alloc ? `Room ${alloc.room_number} (${alloc.bed_number})` : 'Not Allocated'}</strong>
            <small>{alloc ? `Floor ${alloc.floor} · ₹${alloc.monthly_rent.toLocaleString('en-IN')}/mo` : 'No room assigned'}</small>
          </div>
          <div className="kpi-ribbon-item">
            <span className="ribbon-label">MONTHLY RENT</span>
            <strong>₹{(alloc?.monthly_rent || 0).toLocaleString('en-IN')}</strong>
            <small>Base room rent</small>
          </div>
          <div className="kpi-ribbon-item">
            <span className="ribbon-label">TOTAL PAID</span>
            <strong className="text-success">₹{(tenant.total_paid || 0).toLocaleString('en-IN')}</strong>
            <small>{payments.length} verified payments</small>
          </div>
          <div className="kpi-ribbon-item">
            <span className="ribbon-label">OUTSTANDING DUES</span>
            <strong className={(tenant.total_pending || 0) > 0 ? 'text-danger' : 'text-success'}>
              ₹{(tenant.total_pending || 0).toLocaleString('en-IN')}
            </strong>
            <small>{(tenant.total_pending || 0) > 0 ? 'Payment pending' : 'Zero balance dues'}</small>
          </div>
          <div className="kpi-ribbon-item">
            <span className="ribbon-label">SECURITY DEPOSIT</span>
            <strong>₹{(tenant.security_deposit_held || 0).toLocaleString('en-IN')}</strong>
            <small>Held in security ledger</small>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile & Room
          </button>
          <button
            className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions & Services {totalSubsCount > 0 && <span className="tab-pill-badge">{totalSubsCount}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'financials' ? 'active' : ''}`}
            onClick={() => setActiveTab('financials')}
          >
            Invoices & Payments ({invoices.length + payments.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'allocations' ? 'active' : ''}`}
            onClick={() => setActiveTab('allocations')}
          >
            Allocation History ({tenant.allocations?.length || 0})
          </button>
        </div>

        <div className="modal-body-scroll">
          {/* TAB 1: PROFILE & ROOM */}
          {activeTab === 'profile' && (
            <div className="profile-grid">
              {/* Current Allocation Box */}
              <div className="allocation-highlight-card">
                <div className="flex-between">
                  <div className="flex-row gap-8 align-center">
                    <BedDouble size={20} className="text-primary" />
                    <strong>Current Room & Bed Allocation</strong>
                  </div>
                  {alloc ? (
                    <button
                      className="btn-danger-outline btn-sm"
                      onClick={() => onVacate(alloc.id, tenant.full_name, alloc.bed_number, alloc.room_number)}
                    >
                      Vacate Bed
                    </button>
                  ) : (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => onAllocate(tenant)}
                    >
                      Allocate Bed Now
                    </button>
                  )}
                </div>

                {alloc ? (
                  <div className="allocation-details-grid">
                    <div>
                      <span className="stat-label">Room Number</span>
                      <strong>Room {alloc.room_number} (Floor {alloc.floor})</strong>
                    </div>
                    <div>
                      <span className="stat-label">Bed Allocated</span>
                      <strong>{alloc.bed_number}</strong>
                    </div>
                    <div>
                      <span className="stat-label">Monthly Rent</span>
                      <strong>₹{alloc.monthly_rent.toLocaleString('en-IN')}/mo</strong>
                    </div>
                    <div>
                      <span className="stat-label">Check-in Date</span>
                      <strong>{alloc.allocation_date}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="no-allocation-note">
                    No active bed allocated. This resident is currently marked as {tenant.status.toLowerCase()}.
                  </p>
                )}
              </div>

              {/* Personal Information */}
              <div className="info-section">
                <h4>Contact & Personal Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <Phone size={15} />
                    <div>
                      <small>Mobile Phone</small>
                      <span>{tenant.mobile}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Mail size={15} />
                    <div>
                      <small>Email Address</small>
                      <span>{tenant.email || 'Not provided'}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <User size={15} />
                    <div>
                      <small>Gender & Date of Birth</small>
                      <span>{tenant.gender} {tenant.dob ? `· DOB: ${tenant.dob}` : ''}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Briefcase size={15} />
                    <div>
                      <small>Occupation & Company / College</small>
                      <span>{tenant.occupation || 'Working'} {tenant.company_or_college ? `(${tenant.company_or_college})` : ''}</span>
                    </div>
                  </div>

                  <div className="info-item full-width">
                    <MapPin size={15} />
                    <div>
                      <small>Permanent Address</small>
                      <span>{tenant.permanent_address || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="info-section">
                <h4>Emergency Contact</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <ShieldCheck size={15} />
                    <div>
                      <small>Contact Person</small>
                      <span>{tenant.emergency_contact_name || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <Phone size={15} />
                    <div>
                      <small>Emergency Contact Number</small>
                      <span>{tenant.emergency_contact_number || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTIONS & SERVICES (ALL DATA) */}
          {activeTab === 'subscriptions' && (
            <div className="subscriptions-tab-container">
              {/* 1. Meal & Food Subscriptions */}
              <div className="subscription-section-card">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <Utensils size={18} className="text-primary" />
                    <h4>Meal & Food Plan Subscriptions</h4>
                  </div>
                  <span className="badge badge-neutral">{foodSubs.length} registered</span>
                </div>

                {foodSubs.length > 0 ? (
                  <div className="subs-cards-grid">
                    {foodSubs.map((fs: any) => (
                      <div key={fs.id} className="sub-item-card">
                        <div className="sub-header">
                          <strong>{fs.plan_name}</strong>
                          <span className={`badge badge-status-${(fs.status || 'active').toLowerCase()}`}>
                            {fs.status}
                          </span>
                        </div>
                        <div className="sub-details">
                          <div>
                            <small>Monthly Price:</small> <strong>₹{fs.monthly_price?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div>
                            <small>Frequency:</small> {fs.billing_frequency || 'Monthly'}
                          </div>
                          <div>
                            <small>Start Date:</small> {fs.start_date || 'N/A'}
                          </div>
                          {fs.end_date && (
                            <div>
                              <small>End Date:</small> {fs.end_date}
                            </div>
                          )}
                          <div>
                            <small>Subscription #:</small> <code>{fs.subscription_number}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-sub-note">No active meal plan subscriptions for this resident.</p>
                )}
              </div>

              {/* 2. Wi-Fi Subscriptions */}
              <div className="subscription-section-card">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <Wifi size={18} className="text-primary" />
                    <h4>High-Speed Wi-Fi Subscriptions</h4>
                  </div>
                  <span className="badge badge-neutral">{wifiSubs.length} registered</span>
                </div>

                {wifiSubs.length > 0 ? (
                  <div className="subs-cards-grid">
                    {wifiSubs.map((ws: any) => (
                      <div key={ws.id} className="sub-item-card">
                        <div className="sub-header">
                          <strong>{ws.service_name} ({ws.speed_mbps} Mbps)</strong>
                          <span className={`badge badge-status-${(ws.status || 'active').toLowerCase()}`}>
                            {ws.status}
                          </span>
                        </div>
                        <div className="sub-details">
                          <div>
                            <small>Monthly Charge:</small> <strong>₹{ws.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div>
                            <small>Activation Date:</small> {ws.activation_date || 'N/A'}
                          </div>
                          <div>
                            <small>Subscription #:</small> <code>{ws.subscription_number}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-sub-note">No dedicated Wi-Fi subscriptions assigned.</p>
                )}
              </div>

              {/* 3. Parking Slot Allocations */}
              <div className="subscription-section-card">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <Car size={18} className="text-primary" />
                    <h4>Vehicle Parking Allocations</h4>
                  </div>
                  <span className="badge badge-neutral">{parkingAllocs.length} registered</span>
                </div>

                {parkingAllocs.length > 0 ? (
                  <div className="subs-cards-grid">
                    {parkingAllocs.map((pa: any) => (
                      <div key={pa.id} className="sub-item-card">
                        <div className="sub-header">
                          <strong>Slot {pa.slot_number} ({pa.slot_type})</strong>
                          <span className={`badge badge-status-${(pa.status || 'active').toLowerCase()}`}>
                            {pa.status}
                          </span>
                        </div>
                        <div className="sub-details">
                          <div>
                            <small>Vehicle Type:</small> {pa.vehicle_type}
                          </div>
                          <div>
                            <small>Vehicle Reg #:</small> <strong>{pa.vehicle_number}</strong>
                          </div>
                          <div>
                            <small>Monthly Fee:</small> <strong>₹{pa.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div>
                            <small>Allocation Date:</small> {pa.allocation_date || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-sub-note">No vehicle parking slots allocated.</p>
                )}
              </div>

              {/* 4. Air Conditioning (AC) Subscriptions */}
              <div className="subscription-section-card">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <Wind size={18} className="text-primary" />
                    <h4>Air Conditioning (AC) Services</h4>
                  </div>
                  <span className="badge badge-neutral">{acSubs.length} registered</span>
                </div>

                {acSubs.length > 0 ? (
                  <div className="subs-cards-grid">
                    {acSubs.map((ac: any) => (
                      <div key={ac.id} className="sub-item-card">
                        <div className="sub-header">
                          <strong>Room {ac.room_number} AC</strong>
                          <span className={`badge badge-status-${(ac.status || 'active').toLowerCase()}`}>
                            {ac.status}
                          </span>
                        </div>
                        <div className="sub-details">
                          <div>
                            <small>Billing Rule:</small> {ac.billing_rule}
                          </div>
                          <div>
                            <small>Monthly Charge:</small> <strong>₹{ac.monthly_charge?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div>
                            <small>Start Date:</small> {ac.start_date || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-sub-note">No active AC subscriptions for this resident.</p>
                )}
              </div>

              {/* 5. Custom Facility Services */}
              {customServices.length > 0 && (
                <div className="subscription-section-card">
                  <div className="section-title-row">
                    <div className="flex-row gap-8 align-center">
                      <Layers size={18} className="text-primary" />
                      <h4>Custom Facility & Utility Services</h4>
                    </div>
                    <span className="badge badge-neutral">{customServices.length} registered</span>
                  </div>

                  <div className="subs-cards-grid">
                    {customServices.map((cs: any) => (
                      <div key={cs.id} className="sub-item-card">
                        <div className="sub-header">
                          <strong>{cs.service_name}</strong>
                          <span className={`badge badge-status-${(cs.status || 'active').toLowerCase()}`}>
                            {cs.status}
                          </span>
                        </div>
                        <div className="sub-details">
                          <div>
                            <small>Unit Price:</small> ₹{cs.unit_price} (Qty: {cs.quantity})
                          </div>
                          <div>
                            <small>Total Monthly Fee:</small> <strong>₹{cs.total_amount?.toLocaleString('en-IN')}/mo</strong>
                          </div>
                          <div>
                            <small>Start Date:</small> {cs.start_date || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVOICES & PAYMENTS */}
          {activeTab === 'financials' && (
            <div className="financials-tab-container">
              {/* Financial Balance Summary */}
              <div className="financial-overview-strip">
                <div className="fin-card">
                  <small>TOTAL RENT PAID</small>
                  <strong className="text-success">₹{(tenant.total_paid || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="fin-card">
                  <small>PENDING BALANCE</small>
                  <strong className={(tenant.total_pending || 0) > 0 ? 'text-danger' : 'text-success'}>
                    ₹{(tenant.total_pending || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="fin-card">
                  <small>SECURITY DEPOSIT HELD</small>
                  <strong>₹{(tenant.security_deposit_held || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="fin-card">
                  <small>ADVANCE RENT HELD</small>
                  <strong>₹{(tenant.advance_rent_held || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Rent Invoices Section */}
              <div className="sub-data-block margin-top-20">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <Receipt size={17} className="text-primary" />
                    <h4>Rent Invoices ({invoices.length})</h4>
                  </div>
                </div>

                {invoices.length > 0 ? (
                  <table className="mini-data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Month/Year</th>
                        <th>Due Date</th>
                        <th>Billed Amount</th>
                        <th>Amount Paid</th>
                        <th>Pending Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td><code>{inv.invoice_number}</code></td>
                          <td>{inv.billing_month}/{inv.billing_year}</td>
                          <td>{inv.due_date}</td>
                          <td><strong>₹{inv.total_amount?.toLocaleString('en-IN')}</strong></td>
                          <td className="text-success">₹{inv.amount_paid?.toLocaleString('en-IN')}</td>
                          <td className={inv.pending_amount > 0 ? 'text-danger' : 'text-muted'}>
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
                ) : (
                  <p className="empty-sub-note">No rent invoices generated for this tenant yet.</p>
                )}
              </div>

              {/* Payments History Section */}
              <div className="sub-data-block margin-top-24">
                <div className="section-title-row">
                  <div className="flex-row gap-8 align-center">
                    <CreditCard size={17} className="text-primary" />
                    <h4>Payment Transactions ({payments.length})</h4>
                  </div>
                </div>

                {payments.length > 0 ? (
                  <table className="mini-data-table">
                    <thead>
                      <tr>
                        <th>Payment #</th>
                        <th>Payment Date</th>
                        <th>Amount</th>
                        <th>Payment Method</th>
                        <th>Reference / UTR</th>
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
                          <td>{p.reference_number || 'N/A'}</td>
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
                ) : (
                  <p className="empty-sub-note">No payment transactions recorded.</p>
                )}
              </div>

              {/* Security Deposits Section */}
              {deposits.length > 0 && (
                <div className="sub-data-block margin-top-24">
                  <div className="section-title-row">
                    <div className="flex-row gap-8 align-center">
                      <Wallet size={17} className="text-primary" />
                      <h4>Deposit Records ({deposits.length})</h4>
                    </div>
                  </div>

                  <table className="mini-data-table">
                    <thead>
                      <tr>
                        <th>Deposit #</th>
                        <th>Type</th>
                        <th>Total Amount</th>
                        <th>Remaining Balance</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((d: any) => (
                        <tr key={d.id}>
                          <td><code>{d.deposit_number}</code></td>
                          <td>{d.deposit_type}</td>
                          <td>₹{d.amount?.toLocaleString('en-IN')}</td>
                          <td><strong>₹{d.remaining_balance?.toLocaleString('en-IN')}</strong></td>
                          <td>{d.deposit_date}</td>
                          <td>
                            <span className="badge badge-active">{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALLOCATION HISTORY */}
          {activeTab === 'allocations' && (
            <div className="history-tab">
              {tenant.allocations && tenant.allocations.length > 0 ? (
                <div className="history-timeline">
                  {tenant.allocations.map((a, i) => (
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
                        <div>
                          <small>Allocated On:</small> {a.allocation_date}
                        </div>
                        {a.vacating_date && (
                          <div>
                            <small>Vacated On:</small> {a.vacating_date}
                          </div>
                        )}
                        {a.vacating_reason && (
                          <div>
                            <small>Reason:</small> {a.vacating_reason}
                          </div>
                        )}
                        {a.room_inspection_status && (
                          <div>
                            <small>Inspection:</small> {a.room_inspection_status}
                          </div>
                        )}
                        {a.deposit_refund_status && (
                          <div>
                            <small>Deposit Refund:</small> {a.deposit_refund_status}
                          </div>
                        )}
                        {a.remarks && (
                          <div>
                            <small>Remarks:</small> {a.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-card">
                  <Clock size={32} className="muted-text" />
                  <p>No historical allocation records found for this tenant.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onEdit(tenant)}>
            Edit Resident Details
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
