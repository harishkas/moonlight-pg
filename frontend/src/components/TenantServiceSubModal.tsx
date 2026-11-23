import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Tenant, ServiceCatalogItem } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  initialServiceId?: number | null
}

export default function TenantServiceSubModal({ isOpen, onClose, onSave, initialServiceId }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([])
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [serviceId, setServiceId] = useState<number | ''>(initialServiceId || '')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('500')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)

      fetch('/api/services/catalog', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          const active = data.filter((s: any) => s.is_active)
          setCatalog(active)
          const targetId = initialServiceId || (active.length > 0 ? active[0].id : null)
          if (targetId) {
            setServiceId(targetId)
            const found = active.find((x: any) => x.id === targetId)
            if (found) setUnitPrice(found.price.toString())
          }
        })
        .catch(console.error)
    }
  }, [isOpen, initialServiceId])

  function handleServiceChange(id: number) {
    setServiceId(id)
    const s = catalog.find(x => x.id === id)
    if (s) setUnitPrice(s.price.toString())
  }

  const qty = parseInt(quantity) || 1
  const price = parseFloat(unitPrice) || 0
  const total = Math.round(qty * price * 100) / 100

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !serviceId) {
      setError('Please select both a tenant and a service.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        tenant_id: Number(tenantId),
        service_id: Number(serviceId),
        start_date: startDate,
        quantity: qty,
        unit_price: price,
        remarks: remarks || null
      }
      const res = await fetch('/api/services/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to subscribe tenant to service')
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
          <h3>Subscribe Tenant to Custom Amenity</h3>
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
              <label>Select Service *</label>
              <select
                value={serviceId}
                onChange={e => handleServiceChange(Number(e.target.value))}
                required
              >
                <option value="">-- Choose service --</option>
                {catalog.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.service_name} (₹{s.price.toLocaleString('en-IN')}/{s.billing_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Unit Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Total Fee (₹)</label>
              <div className="total-display-box">
                ₹{total.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Ironing schedule: Mon & Thu"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Subscribing…' : 'Activate Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

