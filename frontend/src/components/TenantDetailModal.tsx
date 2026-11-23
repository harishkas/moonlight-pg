import { useEffect, useState } from 'react'
import { X, User, Phone, Mail, MapPin, Briefcase, Calendar, BedDouble, AlertCircle, Clock, ShieldCheck, DollarSign } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'profile' | 'allocations' | 'payments'>('profile')

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
          <p className="loading-text">Loading tenant profile...</p>
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

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div className="flex-row gap-12">
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
                Joined on {tenant.joining_date} · {tenant.occupation || 'Resident'}
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tab navigation */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile & Allocation
          </button>
          <button
            className={`tab-btn ${activeTab === 'allocations' ? 'active' : ''}`}
            onClick={() => setActiveTab('allocations')}
          >
            Allocation History ({tenant.allocations?.length || 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            Payments & Dues (Phase 3)
          </button>
        </div>

        <div className="modal-body-scroll">
          {activeTab === 'profile' && (
            <div className="profile-grid">
              {/* Current Allocation Box */}
              <div className="allocation-highlight-card">
                <div className="flex-between">
                  <div className="flex-row gap-8 align-center">
                    <BedDouble size={20} className="text-primary" />
                    <strong>Current Room & Bed</strong>
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
                    No active bed allocated. This resident is currently {tenant.status.toLowerCase()}.
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
                      <small>Mobile Number</small>
                      <span>{tenant.mobile}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Mail size={15} />
                    <div>
                      <small>Email</small>
                      <span>{tenant.email || 'Not provided'}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <User size={15} />
                    <div>
                      <small>Gender & DOB</small>
                      <span>{tenant.gender} {tenant.dob ? `· DOB: ${tenant.dob}` : ''}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Briefcase size={15} />
                    <div>
                      <small>Occupation & Org</small>
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
                      <small>Emergency Phone</small>
                      <span>{tenant.emergency_contact_number || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        <span className="rent-tag">₹{a.monthly_rent}/mo</span>
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

          {activeTab === 'payments' && (
            <div className="phase3-preview-card">
              <div className="empty-state-card">
                <DollarSign size={36} className="text-primary" />
                <h4>Phase 3 — Payment & Ledger Integration</h4>
                <p className="muted-text">
                  Tenant rent invoices, security deposits, monthly payment receipts, and balance dues will be tracked here in Phase 3.
                </p>
                <div className="ledger-preview">
                  <div className="ledger-row">
                    <span>Monthly Rent Rate:</span>
                    <strong>₹{alloc?.monthly_rent || 6000}/mo</strong>
                  </div>
                  <div className="ledger-row">
                    <span>Pending Dues:</span>
                    <strong className="text-success">₹0.00 (No pending dues)</strong>
                  </div>
                  <div className="ledger-row">
                    <span>Security Deposit Status:</span>
                    <strong>Verified / On File</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onEdit(tenant)}>
            Edit Tenant Details
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

