import React, { useState } from 'react'
import { X, BedDouble, Plus, AlertCircle, Wrench, CheckCircle, UserCheck } from 'lucide-react'
import { Room } from '../types'

interface Props {
  room: Room
  onClose: () => void
  onRefresh: () => void
  onVacate: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
}

export default function RoomDetailModal({ room, onClose, onRefresh, onVacate }: Props) {
  const [addingBed, setAddingBed] = useState(false)
  const [newBedNumber, setNewBedNumber] = useState(`Bed ${room.beds.length + 1}`)
  const [newBedRent, setNewBedRent] = useState(room.monthly_rent)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAddBed(e: React.FormEvent) {
    e.preventDefault()
    if (!newBedNumber.trim()) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/rooms/${room.id}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bed_number: newBedNumber.trim(),
          status: 'Available',
          monthly_rent: Number(newBedRent)
        })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to add bed.')
      }

      setAddingBed(false)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding bed.')
    } finally {
      setLoading(false)
    }
  }

  async function toggleBedStatus(bedId: number, currentStatus: string) {
    const nextStatus = currentStatus === 'Maintenance' ? 'Available' : 'Maintenance'
    try {
      setError('')
      const res = await fetch(`/api/beds/${bedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to update bed status.')
      }

      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating bed.')
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon">
              <BedDouble size={20} />
            </div>
            <div>
              <h3>Room {room.room_number} Details</h3>
              <p className="muted-text">Floor {room.floor} · {room.room_type} · ₹{room.monthly_rent}/mo</p>
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

        {/* Room Metrics Header */}
        <div className="room-kpi-bar">
          <div className="kpi-item">
            <small>Status</small>
            <span className={`badge badge-room-${room.status.toLowerCase().replace(/\s+/g, '-')}`}>
              {room.status}
            </span>
          </div>
          <div className="kpi-item">
            <small>Climate</small>
            <span className={`badge ${room.has_ac ? 'badge-ac' : 'badge-non-ac'}`}>
              {room.has_ac ? '❄️ AC' : '🍃 Non-AC'}
            </span>
          </div>
          <div className="kpi-item">
            <small>Sharing & Price</small>
            <strong>{room.room_type} (₹{room.monthly_rent.toLocaleString('en-IN')}/mo)</strong>
          </div>
          <div className="kpi-item">
            <small>Occupied / Cap</small>
            <strong className="text-primary">{room.occupied_count} / {room.beds.length} Beds</strong>
          </div>
          <div className="kpi-item">
            <small>Available</small>
            <strong className="text-success">{room.available_count} Free</strong>
          </div>
        </div>

        {room.description && (
          <p className="room-desc-banner">{room.description}</p>
        )}

        <div className="flex-between align-center margin-top-16 margin-bottom-12">
          <h4>Configured Beds in Room</h4>
          {!addingBed && (
            <button className="btn-secondary btn-sm" onClick={() => setAddingBed(true)}>
              <Plus size={14} /> Add Bed
            </button>
          )}
        </div>

        {addingBed && (
          <form onSubmit={handleAddBed} className="add-bed-inline-form">
            <input
              placeholder="Bed label, e.g. Bed 3"
              value={newBedNumber}
              onChange={e => setNewBedNumber(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Rent (₹)"
              value={newBedRent}
              onChange={e => setNewBedRent(Number(e.target.value))}
              required
            />
            <button type="submit" className="btn-primary btn-sm" disabled={loading}>
              Save Bed
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAddingBed(false)}>
              Cancel
            </button>
          </form>
        )}

        <div className="beds-management-list">
          {room.beds.map(bed => (
            <div key={bed.id} className={`bed-card bed-card-${bed.status.toLowerCase()}`}>
              <div className="bed-card-header">
                <div className="flex-row gap-8 align-center">
                  <span className={`status-dot dot-${bed.status.toLowerCase()}`} />
                  <strong>{bed.bed_number}</strong>
                  <span className={`badge badge-bed-${bed.status.toLowerCase()}`}>
                    {bed.status}
                  </span>
                </div>
                <span className="rent-tag">₹{bed.monthly_rent}/mo</span>
              </div>

              {bed.occupant ? (
                <div className="bed-occupant-box">
                  <div className="flex-row gap-8 align-center">
                    <UserCheck size={16} className="text-primary" />
                    <div>
                      <strong>{bed.occupant.full_name}</strong>
                      <small> ({bed.occupant.tenant_code} · {bed.occupant.mobile})</small>
                    </div>
                  </div>
                  <div className="flex-between align-center margin-top-8">
                    <small className="muted-text">Since: {bed.occupant.allocation_date}</small>
                    <button
                      className="btn-danger-outline btn-xs"
                      onClick={() => onVacate(bed.occupant!.allocation_id, bed.occupant!.full_name, bed.bed_number, room.room_number)}
                    >
                      Vacate Tenant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bed-empty-box">
                  {bed.status === 'Available' ? (
                    <div className="flex-between align-center">
                      <span className="text-success flex-row gap-4 align-center">
                        <CheckCircle size={14} /> Ready for allocation
                      </span>
                      <button
                        className="btn-secondary btn-xs"
                        onClick={() => toggleBedStatus(bed.id, bed.status)}
                      >
                        <Wrench size={12} /> Set Maintenance
                      </button>
                    </div>
                  ) : (
                    <div className="flex-between align-center">
                      <span className="text-warning flex-row gap-4 align-center">
                        <Wrench size={14} /> In Maintenance
                      </span>
                      <button
                        className="btn-secondary btn-xs"
                        onClick={() => toggleBedStatus(bed.id, bed.status)}
                      >
                        <CheckCircle size={12} /> Set Available
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

