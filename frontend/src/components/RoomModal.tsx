import React, { useState } from 'react'
import { X, Building, Save, AlertCircle } from 'lucide-react'
import { Room } from '../types'

interface Props {
  room?: Room | null
  onClose: () => void
  onSuccess: () => void
}

export default function RoomModal({ room, onClose, onSuccess }: Props) {
  const isEdit = Boolean(room)
  const [roomNumber, setRoomNumber] = useState(room?.room_number || '')
  const [floor, setFloor] = useState<number>(room?.floor || 1)
  const [roomType, setRoomType] = useState(room?.room_type || 'Sharing')
  const [capacity, setCapacity] = useState<number>(room?.capacity || 2)
  const [monthlyRent, setMonthlyRent] = useState<number>(room?.monthly_rent || 6000)
  const [status, setStatus] = useState<string>(room?.status || 'Available')
  const [hasAc, setHasAc] = useState<boolean>(room?.has_ac ?? false)
  const [description, setDescription] = useState(room?.description || '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomNumber.trim()) {
      setError('Please provide a room number.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload: any = {
        room_number: roomNumber.trim(),
        floor: Number(floor),
        room_type: roomType,
        capacity: Number(capacity),
        monthly_rent: Number(monthlyRent),
        has_ac: hasAc,
        description: description.trim() || null,
        status
      }

      const url = isEdit ? `/api/rooms/${room!.id}` : '/api/rooms'
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
      setError(err instanceof Error ? err.message : 'Failed to save room.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8">
            <div className="modal-icon">
              <Building size={18} />
            </div>
            <div>
              <h3>{isEdit ? `Edit Room ${room?.room_number}` : 'Add New Room'}</h3>
              <p className="muted-text">Define room number, floor level, bed capacity, and monthly rent.</p>
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
              <label>Room Number *</label>
              <input
                required
                placeholder="e.g. 101, 204, 305"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
              />
            </div>

            <div>
              <label>Floor Number *</label>
              <input
                type="number"
                min={0}
                max={20}
                required
                value={floor}
                onChange={e => setFloor(Number(e.target.value))}
              />
            </div>

            <div>
              <label>Room Type</label>
              <select value={roomType} onChange={e => setRoomType(e.target.value)}>
                <option value="Single">Single Occupancy</option>
                <option value="Sharing">Double Sharing</option>
                <option value="Triple">Triple Sharing</option>
                <option value="Four Bed">4-Bed Dormitory</option>
              </select>
            </div>

            <div>
              <label>Bed Capacity *</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
              />
            </div>

            <div>
              <label>Default Monthly Rent (₹) *</label>
              <input
                type="number"
                step="100"
                required
                value={monthlyRent}
                onChange={e => setMonthlyRent(Number(e.target.value))}
              />
            </div>

            <div>
              <label>Room Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Available">Available</option>
                <option value="Partially Occupied">Partially Occupied</option>
                <option value="Full">Full</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label>Climate / AC Specification</label>
              <select value={hasAc ? 'ac' : 'non_ac'} onChange={e => setHasAc(e.target.value === 'ac')}>
                <option value="non_ac">🍃 Non-AC Room</option>
                <option value="ac">❄️ Air Conditioned (AC) Room</option>
              </select>
            </div>
          </div>

          <div>
            <label>Description / Features</label>
            <textarea
              rows={2}
              placeholder="e.g. Attached washroom, balcony view, north-facing"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
