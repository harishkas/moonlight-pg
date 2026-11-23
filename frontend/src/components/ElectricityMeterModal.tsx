import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Room } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function ElectricityMeterModal({ isOpen, onClose, onSave }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [meterNumber, setMeterNumber] = useState('')
  const [roomId, setRoomId] = useState<number | ''>('')
  const [ratePerUnit, setRatePerUnit] = useState('10')
  const [billingMethod, setBillingMethod] = useState<'Meter-based' | 'Fixed monthly' | 'Included in rent'>('Meter-based')
  const [fixedAmount, setFixedAmount] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/rooms', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setRooms(data)
          if (data.length > 0 && !roomId) {
            setRoomId(data[0].id)
            setMeterNumber(`MTR-RM${data[0].room_number}`)
          }
        })
        .catch(console.error)
    }
  }, [isOpen])

  function handleRoomChange(id: number) {
    setRoomId(id)
    const r = rooms.find(x => x.id === id)
    if (r) {
      setMeterNumber(`MTR-RM${r.room_number}`)
    }
  }

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
        meter_number: meterNumber.trim().toUpperCase(),
        room_id: Number(roomId),
        meter_type: 'Digital Sub-meter',
        rate_per_unit: parseFloat(ratePerUnit),
        billing_method: billingMethod,
        fixed_monthly_amount: parseFloat(fixedAmount) || 0,
        status: 'Active'
      }
      const res = await fetch('/api/electricity/meters', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to register meter')
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
          <h3>Register Room Electricity Meter</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Select Room *</label>
              <select
                value={roomId}
                onChange={e => handleRoomChange(Number(e.target.value))}
                required
              >
                <option value="">-- Choose room --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} (Floor {r.floor})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Meter Serial / Number *</label>
              <input
                type="text"
                value={meterNumber}
                onChange={e => setMeterNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MTR-RM101"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Billing Method *</label>
              <select value={billingMethod} onChange={e => setBillingMethod(e.target.value as any)}>
                <option value="Meter-based">Meter-based (Units × Rate)</option>
                <option value="Fixed monthly">Fixed Monthly Surcharge</option>
                <option value="Included in rent">Complementary (Included in Rent)</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Rate Per Unit (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePerUnit}
                onChange={e => setRatePerUnit(e.target.value)}
                required
              />
            </div>
          </div>

          {billingMethod === 'Fixed monthly' && (
            <div className="form-group">
              <label>Fixed Monthly Surcharge (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedAmount}
                onChange={e => setFixedAmount(e.target.value)}
                required
              />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Registering…' : 'Register Meter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

