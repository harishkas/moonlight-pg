import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Tenant, WifiService } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function WifiModal({ isOpen, onClose, onSave }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [services, setServices] = useState<WifiService[]>([])
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [serviceId, setServiceId] = useState<number | ''>('')
  const [monthlyCharge, setMonthlyCharge] = useState('300')
  const [activationDate, setActivationDate] = useState(new Date().toISOString().slice(0, 10))
  const [includedInRent, setIncludedInRent] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)

      fetch('/api/services/wifi', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setServices(data.filter((s: any) => s.is_active))
          if (data.length > 0 && !serviceId) {
            setServiceId(data[0].id)
            setMonthlyCharge(data[0].monthly_charge.toString())
          }
        })
        .catch(console.error)
    }
  }, [isOpen])

  function handleServiceChange(id: number) {
    setServiceId(id)
    const s = services.find(x => x.id === id)
    if (s) setMonthlyCharge(s.monthly_charge.toString())
  }

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !serviceId) {
      setError('Please select both a tenant and a Wi-Fi service.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        tenant_id: tenantId,
        wifi_service_id: serviceId,
        activation_date: activationDate,
        monthly_charge: parseFloat(monthlyCharge),
        included_in_rent: includedInRent,
        remarks: remarks || null
      }
      const res = await fetch('/api/services/wifi/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to activate Wi-Fi subscription')
      }
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Activate Tenant Wi-Fi Service</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select Tenant *</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(Number(e.target.value))}
              required
            >
              <option value="">-- Choose active tenant --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.tenant_code}) - Room {t.current_allocation?.room_number || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Wi-Fi Network / Plan *</label>
              <select
                value={serviceId}
                onChange={e => handleServiceChange(Number(e.target.value))}
                required
              >
                <option value="">-- Choose Wi-Fi package --</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.network_name} (₹{s.monthly_charge.toLocaleString('en-IN')}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Monthly Fee (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyCharge}
                onChange={e => setMonthlyCharge(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Activation Date *</label>
            <input
              type="date"
              value={activationDate}
              onChange={e => setActivationDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group-checkbox mt-8">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includedInRent}
                onChange={e => setIncludedInRent(e.target.checked)}
              />
              <span>Wi-Fi is complementary (included in bed rent; zero separate billing)</span>
            </label>
          </div>

          <div className="form-group mt-12">
            <label>Device / Connection Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Laptop & phone MAC registered"
            />
            <small className="text-muted block mt-2">
              Note: Wi-Fi passwords are secure and never stored in tenant database records.
            </small>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Activating…' : 'Activate Wi-Fi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

