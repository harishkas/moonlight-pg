import React, { useState } from 'react'
import { X } from 'lucide-react'
import { ParkingSlot } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  slot?: ParkingSlot | null
}

export default function ParkingSlotModal({ isOpen, onClose, onSave, slot }: Props) {
  const [slotNumber, setSlotNumber] = useState(slot?.slot_number || '')
  const [slotType, setSlotType] = useState<'Two-wheeler' | 'Four-wheeler' | 'Other'>(slot?.slot_type || 'Two-wheeler')
  const [monthlyCharge, setMonthlyCharge] = useState(slot?.monthly_charge?.toString() || '300')
  const [status, setStatus] = useState(slot?.status || 'Available')
  const [description, setDescription] = useState(slot?.description || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        slot_number: slotNumber,
        slot_type: slotType,
        monthly_charge: parseFloat(monthlyCharge),
        status,
        description: description || null
      }
      const res = await fetch('/api/parking/slots', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to add parking slot')
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
          <h3>Add Designated Parking Slot</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Slot Number / Code *</label>
              <input
                type="text"
                value={slotNumber}
                onChange={e => setSlotNumber(e.target.value.toUpperCase())}
                placeholder="e.g. P-2W-11"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Slot Type *</label>
              <select value={slotType} onChange={e => setSlotType(e.target.value as any)}>
                <option value="Two-wheeler">Two-wheeler</option>
                <option value="Four-wheeler">Four-wheeler</option>
                <option value="Other">Other Vehicle</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Monthly Parking Charge (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyCharge}
                onChange={e => setMonthlyCharge(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Initial Status *</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="Available">Available</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Location / Bay Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Basement pillar 4, Covered car shed, etc."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

