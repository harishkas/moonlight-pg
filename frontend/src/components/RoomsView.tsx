import { useEffect, useState, useMemo } from 'react'
import {
  BedDouble,
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Wrench,
  KeyRound,
  Edit,
  Eye,
  AlertCircle,
  Snowflake,
  Wind,
  Users,
  Layers,
  LayoutGrid,
  Sparkles,
  Phone,
  UserCheck,
  DoorOpen,
  ArrowRight,
  Trash2
} from 'lucide-react'
import { Room } from '../types'

interface Props {
  onAddRoom?: () => void
  onEditRoom?: (room: Room) => void
  onSelectRoom: (roomId: number) => void
  onAllocateBedInRoom?: (roomId: number) => void
  onVacate?: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
  isMaster?: boolean
  isClient?: boolean
}

export default function RoomsView({
  onAddRoom,
  onEditRoom,
  onSelectRoom,
  onAllocateBedInRoom,
  onVacate,
  isMaster = false,
  isClient = false
}: Props) {
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [search, setSearch] = useState('')
  const [acFilter, setAcFilter] = useState<'all' | 'ac' | 'non_ac'>('all')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sharingFilter, setSharingFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom] = useState(false)

  async function handleDeleteRoom() {
    if (!roomToDelete) return
    setDeletingRoom(true)
    setError('')
    try {
      const res = await fetch(`/api/rooms/${roomToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to delete room.')
      }
      setRoomToDelete(null)
      fetchRooms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete room failed')
      setRoomToDelete(null)
    } finally {
      setDeletingRoom(false)
    }
  }

  async function fetchRooms() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rooms', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load room inventory')
      const data: Room[] = await res.json()
      setAllRooms(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching rooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  // Global inventory statistics
  const stats = useMemo(() => {
    const totalRooms = allRooms.length
    const acRooms = allRooms.filter(r => r.has_ac).length
    const nonAcRooms = totalRooms - acRooms
    
    let totalBeds = 0
    let occupiedBeds = 0
    let availableBeds = 0
    let maintBeds = 0
    let fullRooms = 0
    let partialRooms = 0
    let availableRooms = 0
    let maintRooms = 0
    let rentSum = 0

    allRooms.forEach(r => {
      totalBeds += r.beds?.length || r.capacity
      occupiedBeds += r.occupied_count || 0
      availableBeds += r.available_count || 0
      rentSum += r.monthly_rent || 0

      if (r.status === 'Full') fullRooms++
      else if (r.status === 'Partially Occupied') partialRooms++
      else if (r.status === 'Available') availableRooms++
      else if (r.status === 'Maintenance') maintRooms++

      r.beds?.forEach(b => {
        if (b.status === 'Maintenance') maintBeds++
      })
    })

    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
    const avgRent = totalRooms > 0 ? Math.round(rentSum / totalRooms) : 0

    return {
      totalRooms,
      acRooms,
      nonAcRooms,
      totalBeds,
      occupiedBeds,
      availableBeds,
      maintBeds,
      fullRooms,
      partialRooms,
      availableRooms,
      maintRooms,
      occupancyRate,
      avgRent
    }
  }, [allRooms])

  // Distinct floors available in inventory
  const distinctFloors = useMemo(() => {
    return Array.from(new Set(allRooms.map(r => r.floor))).sort((a, b) => a - b)
  }, [allRooms])

  // Distinct sharing types available in inventory
  const distinctSharingTypes = useMemo(() => {
    return Array.from(new Set(allRooms.map(r => r.room_type))).filter(Boolean)
  }, [allRooms])

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return allRooms.filter(room => {
      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchRoomNum = room.room_number.toLowerCase().includes(q)
        const matchDesc = room.description?.toLowerCase().includes(q)
        const matchOccupant = room.beds?.some(b => 
          b.occupant?.full_name.toLowerCase().includes(q) ||
          b.occupant?.mobile.includes(q) ||
          b.occupant?.tenant_code.toLowerCase().includes(q)
        )
        if (!matchRoomNum && !matchDesc && !matchOccupant) return false
      }

      // AC filter
      if (acFilter === 'ac' && !room.has_ac) return false
      if (acFilter === 'non_ac' && room.has_ac) return false

      // Floor filter
      if (floorFilter !== 'all' && String(room.floor) !== floorFilter) return false

      // Status filter
      if (statusFilter !== 'all' && room.status.toLowerCase() !== statusFilter.toLowerCase()) return false

      // Sharing filter
      if (sharingFilter !== 'all' && room.room_type !== sharingFilter) return false

      return true
    })
  }, [allRooms, search, acFilter, floorFilter, statusFilter, sharingFilter])

  // Group rooms by floor when in grouped mode
  const roomsByFloor = useMemo(() => {
    const grouped: { [floor: number]: Room[] } = {}
    filteredRooms.forEach(room => {
      if (!grouped[room.floor]) grouped[room.floor] = []
      grouped[room.floor].push(room)
    })
    return grouped
  }, [filteredRooms])

  const sortedFloorKeys = useMemo(() => {
    return Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b)
  }, [roomsByFloor])

  function getFloorLabel(floorNum: number) {
    if (floorNum === 0) return 'Ground Floor'
    if (floorNum === 1) return '1st Floor'
    if (floorNum === 2) return '2nd Floor'
    if (floorNum === 3) return '3rd Floor'
    return `Floor ${floorNum}`
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">PROPERTY INVENTORY · AC & NON-AC ROOMS</p>
          <h1>Rooms & Bed Management</h1>
          <p className="muted">
            Crystal-clear overview of AC vs Non-AC rooms, floor locations, bed sharing types, pricing, and live resident occupancy.
          </p>
        </div>
        <div className="action-buttons-group">
          {onAddRoom && (
            <button className="btn-primary" onClick={onAddRoom}>
              <Plus size={16} /> Add New Room
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Top Inventory Metrics Bar */}
      <div className="rooms-kpi-strip">
        {/* KPI 1: Total Rooms & Climate Breakdown */}
        <div className="room-kpi-card">
          <div className="room-kpi-icon icon-building">
            <Building2 size={20} />
          </div>
          <div className="room-kpi-content">
            <span className="room-kpi-label">TOTAL ROOMS</span>
            <div className="room-kpi-main-val">
              {stats.totalRooms} <span className="room-kpi-sub-unit">Rooms</span>
            </div>
            <div className="room-kpi-climate-split">
              <span className="climate-pill-mini ac">
                <Snowflake size={11} /> {stats.acRooms} AC
              </span>
              <span className="climate-pill-mini non-ac">
                <Wind size={11} /> {stats.nonAcRooms} Non-AC
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Bed Occupancy Status */}
        <div className="room-kpi-card">
          <div className="room-kpi-icon icon-bed">
            <BedDouble size={20} />
          </div>
          <div className="room-kpi-content">
            <span className="room-kpi-label">BED OCCUPANCY</span>
            <div className="room-kpi-main-val">
              {stats.occupiedBeds} <span className="room-kpi-sub-unit">/ {stats.totalBeds} Occupied</span>
            </div>
            <div className="room-kpi-bed-split">
              <span className="badge-free-mini">
                <CheckCircle size={11} /> {stats.availableBeds} Available Beds
              </span>
              {stats.maintBeds > 0 && (
                <span className="badge-maint-mini">
                  <Wrench size={11} /> {stats.maintBeds} Maint.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: Occupancy Rate */}
        <div className="room-kpi-card">
          <div className="room-kpi-icon icon-rate">
            <Users size={20} />
          </div>
          <div className="room-kpi-content">
            <span className="room-kpi-label">OCCUPANCY RATE</span>
            <div className="room-kpi-main-val">
              {stats.occupancyRate}% <span className="room-kpi-sub-unit">Filled</span>
            </div>
            <div className="room-occupancy-mini-bar">
              <div 
                className="room-occupancy-mini-fill" 
                style={{ width: `${stats.occupancyRate}%` }} 
              />
            </div>
            <small className="muted-text">
              {stats.fullRooms} Full · {stats.partialRooms} Partial · {stats.availableRooms} Empty
            </small>
          </div>
        </div>

        {/* KPI 4: Average Rent */}
        <div className="room-kpi-card">
          <div className="room-kpi-icon icon-price">
            <Sparkles size={20} />
          </div>
          <div className="room-kpi-content">
            <span className="room-kpi-label">AVERAGE MONTHLY RENT</span>
            <div className="room-kpi-main-val">
              ₹{stats.avgRent.toLocaleString('en-IN')} <span className="room-kpi-sub-unit">/ bed / mo</span>
            </div>
            <span className="muted-text">
              Standard pricing based on AC & Sharing
            </span>
          </div>
        </div>
      </div>

      {/* Streamlined Clean Filter Bar (No clutter, single neat row) */}
      <div className="filters-bar">
        {/* Search Box */}
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search room #, occupant name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Climate Dropdown */}
        <select
          value={acFilter}
          onChange={e => setAcFilter(e.target.value as 'all' | 'ac' | 'non_ac')}
          className="form-control"
          style={{ width: 'auto', minWidth: 130, height: 32, fontSize: 12 }}
        >
          <option value="all">Climate: All ({stats.totalRooms})</option>
          <option value="ac">❄️ AC Only ({stats.acRooms})</option>
          <option value="non_ac">💨 Non-AC ({stats.nonAcRooms})</option>
        </select>

        {/* Floor Dropdown */}
        <select
          value={floorFilter}
          onChange={e => setFloorFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: 120, height: 32, fontSize: 12 }}
        >
          <option value="all">Floor: All Floors</option>
          {distinctFloors.map(f => (
            <option key={f} value={String(f)}>
              {getFloorLabel(f)}
            </option>
          ))}
        </select>

        {/* Occupancy Status Dropdown */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: 130, height: 32, fontSize: 12 }}
        >
          <option value="all">Status: All</option>
          <option value="Available">🟢 Available ({stats.availableRooms})</option>
          <option value="Partially Occupied">🟡 Partial ({stats.partialRooms})</option>
          <option value="Full">🔵 Full ({stats.fullRooms})</option>
          <option value="Maintenance">🟠 Maintenance ({stats.maintRooms})</option>
        </select>

        {/* Sharing Type Dropdown */}
        <select
          value={sharingFilter}
          onChange={e => setSharingFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: 130, height: 32, fontSize: 12 }}
        >
          <option value="all">Sharing: All</option>
          {distinctSharingTypes.map(st => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {/* Layout View Toggle */}
        <button
          className="btn-secondary"
          onClick={() => setViewMode(viewMode === 'grouped' ? 'grid' : 'grouped')}
          style={{ height: 32, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          title={viewMode === 'grouped' ? 'Switch to Flat Grid' : 'Switch to Group by Floor'}
        >
          {viewMode === 'grouped' ? <Layers size={14} /> : <LayoutGrid size={14} />}
          <span>{viewMode === 'grouped' ? 'By Floor' : 'Flat Grid'}</span>
        </button>

        {/* Clear Filters Button (shown only when any filter is active) */}
        {(search || acFilter !== 'all' || floorFilter !== 'all' || statusFilter !== 'all' || sharingFilter !== 'all') && (
          <button
            className="btn-secondary"
            onClick={() => {
              setSearch('')
              setAcFilter('all')
              setFloorFilter('all')
              setStatusFilter('all')
              setSharingFilter('all')
            }}
            style={{ height: 32, padding: '0 10px', fontSize: 12, color: 'var(--danger)' }}
            title="Clear all filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Rooms Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner-border" />
          <p>Loading real-time room and bed inventory...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="empty-state-card">
          <BedDouble size={44} className="muted-text" />
          <h4>No rooms match your chosen filters</h4>
          <p className="muted-text">
            Try adjusting your search criteria, clearing the AC/Floor/Occupancy filters, or add a new room.
          </p>
          <div className="action-buttons-group margin-top-12">
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                setSearch('')
                setAcFilter('all')
                setFloorFilter('all')
                setStatusFilter('all')
                setSharingFilter('all')
              }}
            >
              Clear All Filters
            </button>
            {onAddRoom && (
              <button className="btn-primary btn-sm" onClick={onAddRoom}>
                <Plus size={14} /> Add Room
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped by Floor View */
        <div className="floor-sections-container">
          {sortedFloorKeys.map(floorNum => {
            const floorRooms = roomsByFloor[floorNum] || []
            const floorAcCount = floorRooms.filter(r => r.has_ac).length
            const floorNonAcCount = floorRooms.length - floorAcCount
            const floorBeds = floorRooms.reduce((sum, r) => sum + r.beds.length, 0)
            const floorOccupied = floorRooms.reduce((sum, r) => sum + r.occupied_count, 0)
            const floorAvailable = floorRooms.reduce((sum, r) => sum + r.available_count, 0)

            return (
              <div key={floorNum} className="floor-section-wrapper">
                {/* Floor Section Header */}
                <div className="floor-section-header">
                  <div className="floor-header-left">
                    <div className="floor-badge-large">
                      <Building2 size={16} />
                      <span>{getFloorLabel(floorNum)}</span>
                    </div>
                    <div className="floor-summary-pills">
                      <span className="summary-pill">
                        {floorRooms.length} {floorRooms.length === 1 ? 'Room' : 'Rooms'}
                      </span>
                      <span className="summary-pill ac-split">
                        <Snowflake size={11} /> {floorAcCount} AC
                      </span>
                      <span className="summary-pill non-ac-split">
                        <Wind size={11} /> {floorNonAcCount} Non-AC
                      </span>
                      <span className="summary-pill bed-split">
                        {floorOccupied}/{floorBeds} Beds Filled ({floorAvailable} Free)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rooms Grid for this floor */}
                <div className="rooms-cards-grid">
                  {floorRooms.map(room => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onSelectRoom={onSelectRoom}
                      onEditRoom={onEditRoom}
                      onAllocateBedInRoom={onAllocateBedInRoom}
                      onVacate={onVacate}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Flat Grid View */
        <div className="rooms-cards-grid">
          {filteredRooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onSelectRoom={onSelectRoom}
              onEditRoom={onEditRoom}
              onAllocateBedInRoom={onAllocateBedInRoom}
              onVacate={onVacate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Individual Room Card Component
// Designed with maximum clarity for:
// 1. AC vs Non-AC separation
// 2. Floor number & Room number
// 3. Occupied vs Available rooms/beds
// 4. Which sharing type (Single, Double, Triple, Dorm)
// 5. Monthly price / rent
// -------------------------------------------------------------
interface RoomCardProps {
  room: Room
  onSelectRoom: (roomId: number) => void
  onEditRoom?: (room: Room) => void
  onAllocateBedInRoom?: (roomId: number) => void
  onVacate?: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
}

function RoomCard({
  room,
  onSelectRoom,
  onEditRoom,
  onAllocateBedInRoom,
  onVacate
}: RoomCardProps) {
  const statusSlug = room.status.toLowerCase().replace(/\s+/g, '-')
  const hasAvailableBed = room.available_count > 0 && room.status !== 'Maintenance'

  return (
    <div className={`room-card-v2 status-border-${statusSlug}`}>
      {/* 1. TOP HEADER: Room Number + Floor + AC Badge + Occupancy Status Badge */}
      <div className="room-card-v2-header">
        <div className="room-identity-group">
          <div className="room-number-display">
            <span className="room-lbl">ROOM</span>
            <strong className="room-num">{room.room_number}</strong>
          </div>
          <span className="room-floor-tag" title={`Located on floor ${room.floor}`}>
            <Building2 size={12} />
            {room.floor === 0 ? 'Ground' : `Floor ${room.floor}`}
          </span>
        </div>

        <div className="room-badges-right">
          {/* AC / Non-AC Separation Badge */}
          {room.has_ac ? (
            <span className="climate-badge-pill climate-ac" title="Air Conditioned Room">
              <Snowflake size={12} /> AC ROOM
            </span>
          ) : (
            <span className="climate-badge-pill climate-non-ac" title="Standard Non-AC Room">
              <Wind size={12} /> NON-AC
            </span>
          )}

          {/* Occupancy Status Badge */}
          <span className={`room-status-badge badge-${statusSlug}`}>
            {room.status === 'Partially Occupied' ? 'Partial' : room.status}
          </span>
        </div>
      </div>

      {/* 2. SPECS & PRICING RIBBON: Sharing Type + Price/Rent + Occupancy Progress */}
      <div className="room-specs-ribbon">
        {/* Sharing Type */}
        <div className="spec-item-box">
          <span className="spec-label">SHARING</span>
          <strong className="spec-value sharing-text">
            <Users size={13} className="text-muted" />
            {room.room_type} ({room.capacity} Bed{room.capacity > 1 ? 's' : ''})
          </strong>
        </div>

        {/* Price / Rent (Prominently Highlighted) */}
        <div className="spec-item-box rent-box">
          <span className="spec-label">MONTHLY RENT</span>
          <div className="spec-price-tag">
            <span className="currency-symbol">₹</span>
            <span className="price-amount">{room.monthly_rent.toLocaleString('en-IN')}</span>
            <span className="price-sub">/mo/bed</span>
          </div>
        </div>
      </div>

      {/* Occupancy Summary Progress Bar */}
      <div className="room-occupancy-summary-bar">
        <div className="flex-between align-center margin-bottom-4">
          <span className="occupancy-ratio-text">
            <strong>{room.occupied_count} of {room.beds.length}</strong> Beds Occupied
          </span>
          <span className={`free-beds-counter ${room.available_count > 0 ? 'text-success' : 'text-muted'}`}>
            {room.available_count > 0 
              ? `🟢 ${room.available_count} Bed${room.available_count > 1 ? 's' : ''} Available` 
              : '🔴 No Beds Free'}
          </span>
        </div>
        <div className="progress-track-occupancy">
          <div
            className={`progress-fill-occupancy ${room.occupied_count === room.beds.length ? 'fill-full' : 'fill-partial'}`}
            style={{ width: `${room.beds.length > 0 ? (room.occupied_count / room.beds.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 3. BEDS INVENTORY BREAKDOWN */}
      <div className="room-beds-section">
        <div className="flex-between align-center margin-bottom-8">
          <span className="beds-section-title">
            <BedDouble size={13} /> Configured Beds ({room.beds.length}):
          </span>
          {hasAvailableBed && onAllocateBedInRoom && (
            <button
              className="quick-allocate-btn"
              onClick={() => onAllocateBedInRoom(room.id)}
              title="Allocate a resident to an available bed in this room"
            >
              <KeyRound size={11} /> Allocate Bed
            </button>
          )}
        </div>

        <div className="beds-grid-v2">
          {room.beds.map(bed => {
            const isOccupied = bed.status === 'Occupied'
            const isMaint = bed.status === 'Maintenance'
            const isAvailable = bed.status === 'Available'

            return (
              <div
                key={bed.id}
                className={`bed-card-item status-${bed.status.toLowerCase()}`}
              >
                <div className="bed-card-head">
                  <div className="flex-row gap-6 align-center">
                    <span className={`bed-status-bullet dot-${bed.status.toLowerCase()}`} />
                    <strong className="bed-code-title">{bed.bed_number}</strong>
                  </div>
                  <span className="bed-fee-tag">₹{bed.monthly_rent.toLocaleString('en-IN')}/mo</span>
                </div>

                {isOccupied && bed.occupant ? (
                  <div className="bed-occupant-details">
                    <div className="occupant-name-row">
                      <UserCheck size={12} className="text-primary" />
                      <strong className="occupant-full-name" title={bed.occupant.full_name}>
                        {bed.occupant.full_name}
                      </strong>
                    </div>
                    <div className="occupant-sub-info">
                      <span className="occupant-mobile-text">
                        <Phone size={10} /> {bed.occupant.mobile}
                      </span>
                      {onVacate && (
                        <button
                          className="btn-vacate-mini"
                          title="Vacate tenant from this bed"
                          onClick={() =>
                            onVacate(
                              bed.occupant!.allocation_id,
                              bed.occupant!.full_name,
                              bed.bed_number,
                              room.room_number
                            )
                          }
                        >
                          Vacate
                        </button>
                      )}
                    </div>
                  </div>
                ) : isAvailable ? (
                  <div className="bed-vacant-details">
                    <span className="vacant-text">
                      <DoorOpen size={12} className="text-success" /> Bed is Vacant
                    </span>
                    {onAllocateBedInRoom && (
                      <button
                        className="assign-bed-chip-btn"
                        onClick={() => onAllocateBedInRoom(room.id)}
                      >
                        + Assign Tenant
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bed-maint-details">
                    <Wrench size={12} className="text-warning" /> Under Maintenance
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Description note if present */}
      {room.description && (
        <div className="room-card-description">
          <small>{room.description}</small>
        </div>
      )}

      {/* 4. ACTIONS FOOTER */}
      <div className="room-card-v2-footer">
        <button
          className="btn-secondary btn-sm flex-1"
          onClick={() => onSelectRoom(room.id)}
          title="Open bed details, add beds, or toggle maintenance"
        >
          <Eye size={13} /> Manage Beds
        </button>
        {hasAvailableBed && onAllocateBedInRoom && (
          <button
            className="btn-primary btn-sm"
            onClick={() => onAllocateBedInRoom(room.id)}
            title="Assign a tenant to this room"
          >
            <KeyRound size={13} /> Quick Allocate
          </button>
        )}
        {onEditRoom && (
          <button
            className="btn-secondary btn-sm btn-icon-only"
            title="Edit Room Configuration (Capacity, Rent, AC, Floor)"
            onClick={() => onEditRoom(room)}
          >
            <Edit size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
