import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Room, Tenant } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  initialRoomId?: number | null
}

export default function AcSubscriptionModal({ isOpen, onClose, onSave, initialRoomId }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [roomId, setRoomId] = useState<number | ''>(initialRoomId || '')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [billingRule, setBillingRule] = useState<'room_split' | 'tenant_fixed' | 'included_in_rent'>('room_split')
  const [monthlyCharge, setMonthlyCharge] = useState('1500')
  const [splitAmongOccupants, setSplitAmongOccupants] = useState(true)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/rooms', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setRooms(data)
          if (!roomId && data.length > 0) {
            setRoomId(data[0].id)
          }
        })
        .catch(console.error)

      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)
    }
  }, [isOpen, initialRoomId])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId) {
      setError('Please select a room.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        room_id: Number(roomId),
        tenant_id: tenantId ? Number(tenantId) : null,
        billing_rule: billingRule,
        monthly_charge: parseFloat(monthlyCharge),
        split_among_occupants: splitAmongOccupants,
        start_date: startDate,
        remarks: remarks || null
      }
      const res = await fetch('/api/services/ac/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to configure AC subscription')
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
          <h3>Configure AC Service Subscription</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select Room *</label>
            <select
              value={roomId}
              onChange={e => setRoomId(Number(e.target.value))}
              required
            >
              <option value="">-- Choose room --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} (Floor {r.floor}, {r.room_type}) - {r.occupied_count}/{r.capacity} beds occupied
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Billing Allocation Rule *</label>
              <select
                value={billingRule}
                onChange={e => {
                  const val = e.target.value as any
                  setBillingRule(val)
                  setSplitAmongOccupants(val === 'room_split')
                }}
              >
                <option value="room_split">Room Shared Split (Equally divided among active tenants)</option>
                <option value="tenant_fixed">Individual Fixed (Dedicated single tenant charge)</option>
                <option value="included_in_rent">Included in Room Rent</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Total Monthly AC Fee (₹) *</label>
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

          {billingRule === 'tenant_fixed' && (
            <div className="form-group">
              <label>Dedicated Tenant</label>
              <select
                value={tenantId}
                onChange={e => setTenantId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">-- Choose tenant to charge --</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.tenant_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Service Effective Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>AC Specifications / Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. 1.5 Ton Split AC, Daikin Inverter"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Configuring…' : 'Save AC Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

