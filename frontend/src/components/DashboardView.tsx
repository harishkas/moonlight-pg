import { useState } from 'react'
import {
  Building2,
  BedDouble,
  Users,
  Percent,
  CheckCircle,
  Database,
  Server,
  ShieldCheck,
  RefreshCw,
  Plus,
  KeyRound,
  UserPlus,
  Utensils,
  Coffee,
  Car,
  Zap
} from 'lucide-react'
import { DashboardData } from '../types'

interface Props {
  dash: DashboardData | null
  onRefresh: () => void
  onAddTenant?: () => void
  onAddRoom?: () => void
  onAllocate?: () => void
  onSelectRoom: (roomId: number) => void
  onNavigate?: (viewId: any) => void
}

export default function DashboardView({
  dash,
  onRefresh,
  onAddTenant,
  onAddRoom,
  onAllocate,
  onSelectRoom,
  onNavigate
}: Props) {
  const [backupNotice, setBackupNotice] = useState('')
  const [backingUp, setBackingUp] = useState(false)

  async function triggerBackup() {
    setBackingUp(true)
    setBackupNotice('')
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Backup failed')
      const data = await res.json()
      setBackupNotice(`Backup snapshot created: ${data.filename}`)
    } catch (e) {
      setBackupNotice(e instanceof Error ? e.message : 'Backup trigger failed')
    } finally {
      setBackingUp(false)
    }
  }

  if (!dash) {
    return <div className="loading-container">Loading property analytics...</div>
  }

  return (
    <div className="view-container">
      {/* Top Welcome / Action Bar */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">PROPERTY OVERVIEW · PHASE 2</p>
          <h1>{dash.property_name}</h1>
          <p className="muted">Live operational status, room inventory, and resident allocations.</p>
        </div>
        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          {onAddRoom && (
            <button className="btn-secondary" onClick={onAddRoom}>
              <Plus size={14} /> Add Room
            </button>
          )}
          {onAddTenant && (
            <button className="btn-secondary" onClick={onAddTenant}>
              <UserPlus size={14} /> Add Tenant
            </button>
          )}
          {onAllocate && (
            <button className="btn-primary" onClick={onAllocate}>
              <KeyRound size={14} /> Allocate Bed
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid-8">
        <div className="stat-card">
          <div className="stat-top">
            <span>Total Rooms</span>
            <span className="stat-icon"><Building2 size={16} /></span>
          </div>
          <strong className="stat-value">{dash.total_rooms}</strong>
          <small>Configured rooms</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Total Capacity</span>
            <span className="stat-icon"><BedDouble size={16} /></span>
          </div>
          <strong className="stat-value">{dash.total_beds}</strong>
          <small>Beds in inventory</small>
        </div>

        <div className="stat-card highlight-occupied">
          <div className="stat-top">
            <span>Occupied Beds</span>
            <span className="stat-icon icon-occupied"><BedDouble size={16} /></span>
          </div>
          <strong className="stat-value text-primary">{dash.occupied_beds}</strong>
          <small>Current residents</small>
        </div>

        <div className="stat-card highlight-available">
          <div className="stat-top">
            <span>Available Beds</span>
            <span className="stat-icon icon-available"><CheckCircle size={16} /></span>
          </div>
          <strong className="stat-value text-success">{dash.available_beds}</strong>
          <small>Ready to allocate</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Maintenance</span>
            <span className="stat-icon"><BedDouble size={16} /></span>
          </div>
          <strong className="stat-value text-warning">{dash.maintenance_beds}</strong>
          <small>Under service</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Active Tenants</span>
            <span className="stat-icon"><Users size={16} /></span>
          </div>
          <strong className="stat-value text-primary">{dash.active_tenants}</strong>
          <small>Currently staying</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Vacated Tenants</span>
            <span className="stat-icon"><Users size={16} /></span>
          </div>
          <strong className="stat-value">{dash.vacated_tenants}</strong>
          <small>Past checkouts</small>
        </div>

        <div className="stat-card highlight-rate">
          <div className="stat-top">
            <span>Occupancy Rate</span>
            <span className="stat-icon"><Percent size={16} /></span>
          </div>
          <strong className="stat-value text-accent">{dash.occupancy_rate}%</strong>
          <small>Overall occupancy</small>
        </div>
      </div>

      {/* Main Section: Room Occupancy Floor Map & System Box */}
      <div className="section-grid-dashboard">
        {/* Left Column: Room Occupancy Overview */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Room Occupancy Overview</h2>
              <p className="muted">Live map of all rooms, beds, and current occupants.</p>
            </div>
            <span className="badge badge-primary">{dash.total_rooms} Rooms Total</span>
          </div>

          <div className="room-overview-grid">
            {dash.room_overview.map(room => (
              <div
                key={room.id}
                className={`room-overview-card status-${room.status.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => onSelectRoom(room.id)}
                title="Click to view room details & manage beds"
              >
                <div className="room-card-head">
                  <span className="room-num">Room {room.room_number}</span>
                  <span className="room-floor-tag">Floor {room.floor}</span>
                </div>

                <div className="room-bed-dots">
                  {Array.from({ length: room.capacity }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`bed-dot ${
                        idx < room.occupied_count
                          ? 'bed-dot-occupied'
                          : room.status === 'Maintenance'
                          ? 'bed-dot-maintenance'
                          : 'bed-dot-available'
                      }`}
                    />
                  ))}
                </div>

                <div className="room-card-foot">
                  <span className="room-occ-text">
                    {room.occupied_count}/{room.capacity} Beds
                  </span>
                  <span className={`badge badge-room-${room.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {room.status}
                  </span>
                </div>

                {room.occupants.length > 0 && (
                  <div className="room-occupants-list">
                    {room.occupants.map((occ, i) => (
                      <span key={i} className="occupant-chip">{occ}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Active Services & Local System Engine */}
        <div className="flex-column gap-16">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Services & Facilities</h2>
                <p className="muted">Active PG amenities & utility management</p>
              </div>
              <span className="phase-pill">Operational</span>
            </div>

            <div className="progress-line">
              <span style={{ width: '100%' }} />
            </div>

            <div className="check-row cursor-pointer" onClick={() => onNavigate?.('food-plans')}>
              <span className="check"><Utensils size={13} /></span>
              <div>
                <strong>Food Planning</strong>
                <small>Breakfast, lunch & dinner meal plans</small>
              </div>
              <span className="done">Configure →</span>
            </div>

            <div className="check-row cursor-pointer" onClick={() => onNavigate?.('food-subs')}>
              <span className="check"><Coffee size={13} /></span>
              <div>
                <strong>Food Subscriptions</strong>
                <small>Active resident food subscriptions</small>
              </div>
              <span className="done">Manage →</span>
            </div>

            <div className="check-row cursor-pointer" onClick={() => onNavigate?.('parking')}>
              <span className="check"><Car size={13} /></span>
              <div>
                <strong>Parking Management</strong>
                <small>Two-wheeler & four-wheeler slot allocations</small>
              </div>
              <span className="done">Manage →</span>
            </div>

            <div className="check-row cursor-pointer" onClick={() => onNavigate?.('electricity')}>
              <span className="check"><Zap size={13} /></span>
              <div>
                <strong>Electricity & Meters</strong>
                <small>Digital room sub-meter tracking & billing</small>
              </div>
              <span className="done">Manage →</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>System & Backups</h2>
                <p className="muted">Local-first data persistence</p>
              </div>
              <ShieldCheck color="#24865b" />
            </div>

            <div className="system-row">
              <Database size={16} />
              <span>SQLite Storage (WAL Mode)</span>
              <strong className="online">Connected</strong>
            </div>
            <div className="system-row">
              <Server size={16} />
              <span>FastAPI Backend + Vite Server</span>
              <strong className="online">Active</strong>
            </div>
            <div className="system-row">
              <ShieldCheck size={16} />
              <span>Argon2 Protected Session</span>
              <strong className="online">Authenticated</strong>
            </div>

            <button
              className="secondary backup-button"
              onClick={triggerBackup}
              disabled={backingUp}
            >
              <Database size={16} /> {backingUp ? 'Creating snapshot...' : 'Create Backup Snapshot'}
            </button>
            {backupNotice && <div className="notice">{backupNotice}</div>}
          </section>
        </div>
      </div>
    </div>
  )
}

