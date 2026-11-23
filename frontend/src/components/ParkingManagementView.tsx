import React, { useEffect, useState } from 'react'
import { Plus, Car, Search, Filter, RefreshCw, KeyRound, CheckCircle2, ShieldAlert } from 'lucide-react'
import { ParkingSlot, ParkingAllocation } from '../types'
import ParkingSlotModal from './ParkingSlotModal'
import ParkingAllocateModal from './ParkingAllocateModal'

interface Props {
  isClient?: boolean
}

export default function ParkingManagementView({ isClient = false }: Props) {
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [allocations, setAllocations] = useState<ParkingAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [allocModalOpen, setAllocModalOpen] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [slotRes, allocRes] = await Promise.all([
        fetch('/api/parking/slots', { credentials: 'include' }),
        fetch('/api/parking/allocations', { credentials: 'include' })
      ])
      if (!slotRes.ok || !allocRes.ok) throw new Error('Failed to load parking records')
      const slotData = await slotRes.json()
      const allocData = await allocRes.json()
      setSlots(slotData)
      setAllocations(allocData)
    } catch (e: any) {
      setError(e.message || 'Error loading parking data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleRelease(alloc: ParkingAllocation) {
    const reason = prompt(`Release parking slot ${alloc.slot_number} from ${alloc.tenant_name}? Enter optional remarks:`)
    if (reason === null) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/parking/allocations/${alloc.id}/release`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_date: today, remarks: reason })
      })
      if (!res.ok) throw new Error('Failed to release parking bay')
      loadData()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const filteredSlots = slots.filter(s => {
    const matchesSearch =
      s.slot_number.toLowerCase().includes(search.toLowerCase()) ||
      (s.current_occupant_name && s.current_occupant_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.current_vehicle_number && s.current_vehicle_number.toLowerCase().includes(search.toLowerCase()))
    const matchesType = typeFilter === 'All' || s.slot_type === typeFilter
    return matchesSearch && matchesType
  })

  const occupiedCount = slots.filter(s => s.status === 'Occupied').length
  const availCount = slots.filter(s => s.status === 'Available').length

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Parking Bay Allocation & Management</h2>
          <p className="muted">Manage designated 2-wheeler and 4-wheeler vehicle parking slots</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          {!isClient && (
            <>
              <button className="secondary" onClick={() => setSlotModalOpen(true)}>
                <Plus size={16} /> Add Parking Slot
              </button>
              <button className="primary" onClick={() => { setSelectedSlotId(null); setAllocModalOpen(true) }}>
                <KeyRound size={16} /> Allocate Parking Slot
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Stats row */}
      <div className="stats-grid mb-20">
        <div className="stat-card">
          <div className="stat-icon bg-purple"><Car size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Parking Slots</span>
            <strong className="stat-value">{slots.length}</strong>
            <span className="stat-trend text-muted">Designated bays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-rose"><ShieldAlert size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Occupied Bays</span>
            <strong className="stat-value">{occupiedCount}</strong>
            <span className="stat-trend text-rose">Active permits</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-emerald"><CheckCircle2 size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Available Bays</span>
            <strong className="stat-value">{availCount}</strong>
            <span className="stat-trend text-emerald">Ready for allocation</span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by bay number, tenant name or vehicle number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-dropdown">
          <Filter size={15} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All Vehicle Types</option>
            <option value="Two-wheeler">Two-wheeler</option>
            <option value="Four-wheeler">Four-wheeler</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading parking bays…</div>
      ) : (
        <div className="parking-grid mt-16">
          {filteredSlots.map(slot => (
            <div key={slot.id} className={`parking-card status-${slot.status.toLowerCase()}`}>
              <div className="parking-card-header">
                <span className="parking-slot-tag">{slot.slot_number}</span>
                <span className={`status-pill ${slot.status.toLowerCase()}`}>
                  {slot.status}
                </span>
              </div>

              <div className="parking-type-badge">
                <Car size={14} /> {slot.slot_type}
              </div>

              {slot.status === 'Occupied' ? (
                <div className="parking-occupant-info">
                  <div className="text-xs text-muted">Allocated To:</div>
                  <strong className="text-sm block">{slot.current_occupant_name}</strong>
                  <div className="plate-badge mt-4">
                    {slot.current_vehicle_number}
                  </div>
                </div>
              ) : (
                <div className="parking-vacant-info">
                  <span className="text-xs text-muted">Vacant & ready for assignment</span>
                </div>
              )}

              <div className="parking-card-footer">
                <div className="font-semibold text-sm">
                  ₹{slot.monthly_charge.toLocaleString('en-IN')}<span className="text-xs text-muted">/mo</span>
                </div>
                {!isClient ? (
                  slot.status === 'Available' ? (
                    <button
                      className="btn-sm primary"
                      onClick={() => { setSelectedSlotId(slot.id); setAllocModalOpen(true) }}
                    >
                      Allocate
                    </button>
                  ) : (
                    <button
                      className="btn-sm secondary text-rose"
                      onClick={() => {
                        const al = allocations.find(a => a.slot_id === slot.id && a.status === 'Active')
                        if (al) handleRelease(al)
                      }}
                    >
                      Release
                    </button>
                  )
                ) : (
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>
                    View Only
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredSlots.length === 0 && (
            <div className="empty-card flex-1">
              <p>No parking slots found matching your filter.</p>
            </div>
          )}
        </div>
      )}

      <ParkingSlotModal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        onSave={loadData}
      />

      <ParkingAllocateModal
        isOpen={allocModalOpen}
        onClose={() => setAllocModalOpen(false)}
        onSave={loadData}
        initialSlotId={selectedSlotId}
      />
    </div>
  )
}

