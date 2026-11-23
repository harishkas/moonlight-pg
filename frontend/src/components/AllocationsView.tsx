import { useEffect, useState } from 'react'
import {
  ClipboardList,
  Search,
  Filter,
  BedDouble,
  LogOut,
  KeyRound,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Allocation } from '../types'

interface Props {
  onNewAllocation?: () => void
  onVacate?: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
}

export default function AllocationsView({ onNewAllocation, onVacate }: Props) {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'vacated'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchAllocations() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/allocations', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load allocations')
      const data = await res.json()
      setAllocations(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading allocation records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllocations()
  }, [])

  const filtered = allocations.filter(a => {
    if (filter === 'active' && !a.is_active) return false
    if (filter === 'vacated' && a.is_active) return false
    if (search.trim()) {
      const s = search.toLowerCase()
      return (
        a.tenant_name.toLowerCase().includes(s) ||
        a.tenant_code.toLowerCase().includes(s) ||
        a.room_number.toLowerCase().includes(s) ||
        a.bed_number.toLowerCase().includes(s)
      )
    }
    return true
  })

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">AUDIT & TRACEABILITY · ALLOCATION LOGS</p>
          <h1>Bed Allocations & Checkout History</h1>
          <p className="muted">Preserved historical ledger of every check-in, checkout, room assignment, and vacating record.</p>
        </div>
        {onNewAllocation && (
          <button className="btn-primary" onClick={onNewAllocation}>
            <KeyRound size={16} /> New Bed Allocation
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by tenant name, ID, or room number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={15} className="muted-text" />
          <span className="filter-label">Filter:</span>
          <button
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Logs ({allocations.length})
          </button>
          <button
            className={`filter-pill ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Currently Active ({allocations.filter(a => a.is_active).length})
          </button>
          <button
            className={`filter-pill ${filter === 'vacated' ? 'active' : ''}`}
            onClick={() => setFilter('vacated')}
          >
            Vacated History ({allocations.filter(a => !a.is_active).length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading allocation history...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-card">
            <ClipboardList size={36} className="muted-text" />
            <h4>No allocation records found</h4>
            <p className="muted-text">No records match the current filter criteria.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Resident</th>
                <th>Room & Bed</th>
                <th>Rent Rate</th>
                <th>Check-in Date</th>
                <th>Status</th>
                <th>Vacating / Inspection Notes</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge-code">#{a.id}</span>
                  </td>
                  <td>
                    <div className="tenant-name-cell">
                      <strong>{a.tenant_name}</strong>
                      <small className="muted-text">{a.tenant_code}</small>
                    </div>
                  </td>
                  <td>
                    <div className="allocated-pill-cell">
                      <BedDouble size={14} className="text-primary" />
                      <span>Room {a.room_number} · {a.bed_number}</span>
                    </div>
                  </td>
                  <td>
                    <strong>₹{a.monthly_rent.toLocaleString('en-IN')}/mo</strong>
                  </td>
                  <td>{a.allocation_date}</td>
                  <td>
                    {a.is_active ? (
                      <span className="badge badge-active flex-row gap-4 align-center">
                        <CheckCircle size={11} /> Active Stay
                      </span>
                    ) : (
                      <span className="badge badge-vacated">
                        Vacated {a.vacating_date ? `(${a.vacating_date})` : ''}
                      </span>
                    )}
                  </td>
                  <td>
                    {!a.is_active ? (
                      <div className="vacate-notes-cell">
                        <small><strong>Reason:</strong> {a.vacating_reason || 'N/A'}</small>
                        {a.room_inspection_status && (
                          <small><strong>Inspection:</strong> {a.room_inspection_status}</small>
                        )}
                        {a.deposit_refund_status && (
                          <small><strong>Deposit:</strong> {a.deposit_refund_status}</small>
                        )}
                      </div>
                    ) : (
                      <small className="muted-text">Currently occupying bed</small>
                    )}
                  </td>
                  <td className="text-right">
                    {a.is_active && onVacate && (
                      <button
                        className="btn-danger-outline btn-xs"
                        onClick={() => onVacate(a.id, a.tenant_name, a.bed_number, a.room_number)}
                      >
                        <LogOut size={13} /> Vacate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

