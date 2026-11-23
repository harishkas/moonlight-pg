import React, { useEffect, useState } from 'react'
import { X, KeyRound, AlertCircle, CheckCircle } from 'lucide-react'
import { Tenant, Room, Bed } from '../types'

interface Props {
  initialTenant?: Tenant | null
  initialRoomId?: number | null
  onClose: () => void
  onSuccess: () => void
}

export default function AllocateModal({ initialTenant, initialRoomId, onClose, onSuccess }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<number | string>(initialTenant?.id || '')
  const [selectedRoomId, setSelectedRoomId] = useState<number | string>(initialRoomId || '')
  const [selectedBedId, setSelectedBedId] = useState<number | string>('')
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().slice(0, 10))
  const [monthlyRent, setMonthlyRent] = useState<number>(6000)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const [tRes, rRes] = await Promise.all([
          fetch('/api/tenants?status=all', { credentials: 'include' }),
          fetch('/api/rooms', { credentials: 'include' })
        ])
        const [tData, rData] = await Promise.all([tRes.json(), rRes.json()])

        // Filter tenants that don't have active bed allocation
        const availableTenants = tData.filter((t: Tenant) => !t.current_allocation)
        setTenants(availableTenants)
        setRooms(rData)

        if (initialTenant && !availableTenants.some((t: Tenant) => t.id === initialTenant.id)) {
          // If the passed tenant actually already has an active allocation:
          if (initialTenant.current_allocation) {
            setError(`Tenant ${initialTenant.full_name} already has an active allocation in Room ${initialTenant.current_allocation.room_number}.`)
          }
        }

        if (initialRoomId) {
          const room = rData.find((r: Room) => r.id === initialRoomId)
          if (room) {
            const firstAvail = room.beds.find((b: Bed) => b.status === 'Available')
            if (firstAvail) {
              setSelectedBedId(firstAvail.id)
              setMonthlyRent(firstAvail.monthly_rent)
            }
          }
        }
      } catch (err) {
        setError('Failed to load allocation options.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [initialTenant, initialRoomId])

  // When room changes, pick available beds in that room
  const currentRoom = rooms.find(r => r.id === Number(selectedRoomId))
  const availableBeds = currentRoom ? currentRoom.beds.filter(b => b.status === 'Available') : []

  function handleRoomChange(roomId: string) {
    setSelectedRoomId(roomId)
    const room = rooms.find(r => r.id === Number(roomId))
    if (room) {
      const avail = room.beds.filter(b => b.status === 'Available')
      if (avail.length > 0) {
        setSelectedBedId(avail[0].id)
        setMonthlyRent(avail[0].monthly_rent)
      } else {
        setSelectedBedId('')
      }
    } else {
      setSelectedBedId('')
    }
  }

  function handleBedChange(bedId: string) {
    setSelectedBedId(bedId)
    const bed = availableBeds.find(b => b.id === Number(bedId))
    if (bed) {
      setMonthlyRent(bed.monthly_rent)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTenantId || !selectedBedId || !allocationDate) {
      setError('Please select a tenant, room, bed, and allocation date.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenant_id: Number(selectedTenantId),
          bed_id: Number(selectedBedId),
          allocation_date: allocationDate,
          monthly_rent: Number(monthlyRent)
        })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Allocation failed.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Bed Allocation Wizard</h3>
              <p className="muted-text">Assign an available bed to an unallocated tenant.</p>
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

        {loading ? (
          <p className="loading-text">Loading rooms and tenants...</p>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <div>
              <label>Select Tenant *</label>
              <select
                required
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
              >
                <option value="">-- Choose Tenant --</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.tenant_code} · {t.mobile}) [{t.status}]
                  </option>
                ))}
              </select>
              {tenants.length === 0 && (
                <small className="muted-text">
                  All registered tenants currently have active allocations. Register a new tenant first.
                </small>
              )}
            </div>

            <div className="form-grid-2">
              <div>
                <label>Select Room *</label>
                <select
                  required
                  value={selectedRoomId}
                  onChange={e => handleRoomChange(e.target.value)}
                >
                  <option value="">-- Choose Room --</option>
                  {rooms.map(r => {
                    const freeCount = r.beds.filter(b => b.status === 'Available').length
                    const isMaint = r.status === 'Maintenance'
                    return (
                      <option key={r.id} value={r.id} disabled={freeCount === 0 || isMaint}>
                        Room {r.room_number} (Floor {r.floor} · {freeCount} free) {isMaint ? '[Maintenance]' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label>Select Bed *</label>
                <select
                  required
                  value={selectedBedId}
                  onChange={e => handleBedChange(e.target.value)}
                  disabled={!selectedRoomId || availableBeds.length === 0}
                >
                  <option value="">-- Choose Bed --</option>
                  {availableBeds.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bed_number} (₹{b.monthly_rent}/mo)
                    </option>
                  ))}
                </select>
                {selectedRoomId && availableBeds.length === 0 && (
                  <small className="error-text">No available beds in this room.</small>
                )}
              </div>

              <div>
                <label>Allocation Date *</label>
                <input
                  type="date"
                  required
                  value={allocationDate}
                  onChange={e => setAllocationDate(e.target.value)}
                />
              </div>

              <div>
                <label>Monthly Rent (₹) *</label>
                <input
                  type="number"
                  required
                  value={monthlyRent}
                  onChange={e => setMonthlyRent(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || !selectedTenantId || !selectedBedId}
              >
                <CheckCircle size={15} />
                {submitting ? 'Confirming...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

