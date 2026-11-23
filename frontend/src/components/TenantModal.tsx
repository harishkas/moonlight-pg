import React, { useState } from 'react'
import { X, UserPlus, Save, AlertCircle } from 'lucide-react'
import { Tenant } from '../types'

interface Props {
  tenant?: Tenant | null
  onClose: () => void
  onSuccess: () => void
}

export default function TenantModal({ tenant, onClose, onSuccess }: Props) {
  const isEdit = Boolean(tenant)
  const [fullName, setFullName] = useState(tenant?.full_name || '')
  const [mobile, setMobile] = useState(tenant?.mobile || '')
  const [email, setEmail] = useState(tenant?.email || '')
  const [gender, setGender] = useState(tenant?.gender || 'Male')
  const [dob, setDob] = useState(tenant?.dob || '')
  const [permanentAddress, setPermanentAddress] = useState(tenant?.permanent_address || '')
  const [emergencyName, setEmergencyName] = useState(tenant?.emergency_contact_name || '')
  const [emergencyMobile, setEmergencyMobile] = useState(tenant?.emergency_contact_number || '')
  const [occupation, setOccupation] = useState(tenant?.occupation || 'Working')
  const [companyOrCollege, setCompanyOrCollege] = useState(tenant?.company_or_college || '')
  const [joiningDate, setJoiningDate] = useState(tenant?.joining_date || new Date().toISOString().slice(0, 10))
  const [expectedLeavingDate, setExpectedLeavingDate] = useState(tenant?.expected_leaving_date || '')
  const [status, setStatus] = useState<string>(tenant?.status || 'Pending')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !mobile.trim() || !joiningDate) {
      setError('Please fill in all required fields (Name, Mobile, Joining Date).')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim() || null,
        gender,
        dob: dob || null,
        permanent_address: permanentAddress.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_number: emergencyMobile.trim() || null,
        occupation,
        company_or_college: companyOrCollege.trim() || null,
        joining_date: joiningDate,
        expected_leaving_date: expectedLeavingDate || null,
        status: isEdit ? status : (status || 'Pending')
      }

      const url = isEdit ? `/api/tenants/${tenant!.id}` : '/api/tenants'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `Request failed (${res.status})`)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tenant.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div className="flex-row gap-8">
            <div className="modal-icon">
              {isEdit ? <Save size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3>{isEdit ? `Edit Tenant (${tenant?.tenant_code})` : 'Register New Tenant'}</h3>
              <p className="muted-text">Fill in the tenant's personal, contact, and check-in details.</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            <div>
              <label>Full Name *</label>
              <input
                required
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label>Mobile Number *</label>
              <input
                required
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
              />
            </div>

            <div>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="e.g. rahul@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label>Gender *</label>
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label>Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
              />
            </div>

            <div>
              <label>Occupation</label>
              <select value={occupation} onChange={e => setOccupation(e.target.value)}>
                <option value="Working">Working Professional</option>
                <option value="Student">Student</option>
                <option value="Business">Business</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label>Company / College Name</label>
              <input
                placeholder="e.g. Infosys / State Tech College"
                value={companyOrCollege}
                onChange={e => setCompanyOrCollege(e.target.value)}
              />
            </div>

            <div>
              <label>Joining Date *</label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
              />
            </div>

            <div>
              <label>Expected Leaving Date</label>
              <input
                type="date"
                value={expectedLeavingDate}
                onChange={e => setExpectedLeavingDate(e.target.value)}
              />
            </div>

            {isEdit && (
              <div>
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Vacated">Vacated</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-section-title">Emergency Contact & Address</div>
          <div className="form-grid-2">
            <div>
              <label>Emergency Contact Name</label>
              <input
                placeholder="Parent / Guardian Name"
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
              />
            </div>

            <div>
              <label>Emergency Contact Phone</label>
              <input
                placeholder="e.g. 9876543219"
                value={emergencyMobile}
                onChange={e => setEmergencyMobile(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>Permanent Address</label>
            <textarea
              rows={2}
              placeholder="Full home or residential address"
              value={permanentAddress}
              onChange={e => setPermanentAddress(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Tenant' : 'Register Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

