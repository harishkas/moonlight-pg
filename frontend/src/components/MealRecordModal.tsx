import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Tenant } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function MealRecordModal({ isOpen, onClose, onSave }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10))
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Breakfast')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [status, setStatus] = useState<'Served' | 'Attended' | 'Opted Out' | 'Additional Request'>('Served')
  const [extraCharge, setExtraCharge] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        meal_date: mealDate,
        meal_type: mealType,
        tenant_id: tenantId ? Number(tenantId) : null,
        status,
        extra_charge: parseFloat(extraCharge) || 0,
        remarks: remarks || null
      }
      const res = await fetch('/api/food/meals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to record meal')
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
          <h3>Record Daily Meal Entry</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Meal Date *</label>
              <input
                type="date"
                value={mealDate}
                onChange={e => setMealDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Meal Type *</label>
              <select value={mealType} onChange={e => setMealType(e.target.value as any)}>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tenant (Optional if recording bulk/anonymous count)</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- General / Unspecified --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.tenant_code}) - Room {t.current_allocation?.room_number || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Meal Status *</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="Served">Served</option>
                <option value="Attended">Attended</option>
                <option value="Opted Out">Opted Out (Skipped)</option>
                <option value="Additional Request">Additional Request (Guest / Extra)</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Extra Charge (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={extraCharge}
                onChange={e => setExtraCharge(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Remarks / Menu Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Guest meal with friend, packed lunch, etc."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Recording…' : 'Record Meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

