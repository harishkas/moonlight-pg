import { useEffect, useState } from 'react'
import {
  Users,
  Search,
  UserPlus,
  Filter,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  KeyRound,
  LogOut,
  BedDouble,
  AlertCircle
} from 'lucide-react'
import { Tenant } from '../types'

interface Props {
  onAddTenant?: () => void
  onViewTenant: (tenantId: number) => void
  onEditTenant?: (tenant: Tenant) => void
  onAllocateTenant?: (tenant: Tenant) => void
  onVacateTenant?: (allocationId: number, tenantName: string, bedNumber: string, roomNumber: string) => void
  isMaster?: boolean
}

export default function TenantsView({
  onAddTenant,
  onViewTenant,
  onEditTenant,
  onAllocateTenant,
  onVacateTenant,
  isMaster = false
}: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [order, setOrder] = useState('asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchTenants() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('sort_by', sortBy)
      params.set('order', order)

      const res = await fetch(`/api/tenants?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load tenants list')
      const data = await res.json()
      setTenants(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [search, statusFilter, sortBy, order])

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/tenants/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to delete tenant.')
      }
      setDeleteConfirm(null)
      fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  const activeCount = tenants.filter(t => t.status === 'Active').length
  const pendingCount = tenants.filter(t => t.status === 'Pending').length
  const vacatedCount = tenants.filter(t => t.status === 'Vacated').length

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">RESIDENT REGISTRY · TENANT DIRECTORY</p>
          <h1>Tenant Management</h1>
          <p className="muted">Search, register, track bed allocations, view subscriptions, and manage resident profiles.</p>
        </div>
        {onAddTenant && (
          <button className="btn-primary" onClick={onAddTenant}>
            <UserPlus size={16} /> Register New Tenant
          </button>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div className="tenants-kpi-summary">
        <div className="kpi-mini-card" onClick={() => setStatusFilter('all')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label">TOTAL RESIDENTS</span>
          <strong className="kpi-num">{tenants.length}</strong>
          <small className="muted-text">In database</small>
        </div>
        <div className="kpi-mini-card" onClick={() => setStatusFilter('Active')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label text-success">ACTIVE RESIDENTS</span>
          <strong className="kpi-num text-success">{activeCount}</strong>
          <small className="muted-text">Currently residing</small>
        </div>
        <div className="kpi-mini-card" onClick={() => setStatusFilter('Pending')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label text-warning">PENDING ALLOCATION</span>
          <strong className="kpi-num text-warning">{pendingCount}</strong>
          <small className="muted-text">Awaiting check-in</small>
        </div>
        <div className="kpi-mini-card" onClick={() => setStatusFilter('Vacated')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label">VACATED</span>
          <strong className="kpi-num">{vacatedCount}</strong>
          <small className="muted-text">Past residents</small>
        </div>
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, phone, tenant ID, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={15} className="muted-text" />
          <span className="filter-label">Status:</span>
          {['all', 'Active', 'Pending', 'Vacated'].map(st => (
            <button
              key={st}
              className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Residents' : st}
            </button>
          ))}
        </div>

        <div className="filter-group margin-left-auto">
          <ArrowUpDown size={15} className="muted-text" />
          <span className="filter-label">Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select-sm">
            <option value="name">Name</option>
            <option value="date">Joining Date</option>
            <option value="code">Tenant ID</option>
          </select>
          <button
            className="btn-icon-subtle"
            title="Toggle sort direction"
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
          >
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Tenants Table / Cards */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading resident directory...</div>
        ) : tenants.length === 0 ? (
          <div className="empty-state-card">
            <Users size={36} className="muted-text" />
            <h4>No tenants found</h4>
            <p className="muted-text">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or status filter.'
                : 'Get started by adding your first tenant.'}
            </p>
            <button className="btn-primary btn-sm margin-top-12" onClick={onAddTenant}>
              <UserPlus size={14} /> Add Tenant
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant ID</th>
                <th>Full Name</th>
                <th>Contact</th>
                <th>Occupation / Org</th>
                <th>Joined On</th>
                <th>Allocated Room & Bed</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const alloc = t.current_allocation
                return (
                  <tr key={t.id}>
                    <td>
                      <span className="badge badge-code" style={{ cursor: 'pointer' }} onClick={() => onViewTenant(t.id)} title="Click to view details">{t.tenant_code}</span>
                    </td>
                    <td>
                      <div className="tenant-name-cell" style={{ cursor: 'pointer' }} onClick={() => onViewTenant(t.id)} title="Click to view full details">
                        <strong className="text-primary-link">{t.full_name}</strong>
                        <small className="muted-text">{t.gender}</small>
                      </div>
                    </td>
                    <td>
                      <div>{t.mobile}</div>
                      {t.email && <small className="muted-text">{t.email}</small>}
                    </td>
                    <td>
                      <div>{t.occupation || 'Resident'}</div>
                      {t.company_or_college && (
                        <small className="muted-text">{t.company_or_college}</small>
                      )}
                    </td>
                    <td>{t.joining_date}</td>
                    <td>
                      {alloc ? (
                        <div className="allocated-pill-cell">
                          <BedDouble size={14} className="text-primary" />
                          <span>Room {alloc.room_number} · {alloc.bed_number}</span>
                        </div>
                      ) : (
                        <span className="badge badge-unassigned">Not Allocated</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-status-${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn-details-highlight"
                          title="View Full Profile, Subscriptions, Billing & Dues"
                          onClick={() => onViewTenant(t.id)}
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                        {onEditTenant && (
                          <button
                            className="btn-icon-action"
                            title="Edit Details"
                            onClick={() => onEditTenant(t)}
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {alloc ? (
                          onVacateTenant && (
                            <button
                              className="btn-icon-action text-danger"
                              title="Vacate Bed"
                              onClick={() => onVacateTenant(alloc.id, t.full_name, alloc.bed_number, alloc.room_number)}
                            >
                              <LogOut size={15} />
                            </button>
                          )
                        ) : (
                          onAllocateTenant && (
                            <button
                              className="btn-icon-action text-primary"
                              title="Allocate Bed"
                              onClick={() => onAllocateTenant(t)}
                            >
                              <KeyRound size={15} />
                            </button>
                          )
                        )}
                        {(isMaster || (!alloc && onEditTenant)) && (
                          <button
                            className="btn-icon-action text-danger"
                            title={isMaster ? "Force Delete Tenant (Master Control)" : "Delete Tenant"}
                            onClick={() => setDeleteConfirm(t)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon text-danger bg-danger-light">
                  <Trash2 size={18} />
                </div>
                <h3>{isMaster ? "Master Force Delete Tenant?" : "Delete Tenant Record?"}</h3>
              </div>
            </div>
            <p className="margin-top-12">
              Are you sure you want to delete <strong>{deleteConfirm.full_name} ({deleteConfirm.tenant_code})</strong>?
            </p>
            {isMaster ? (
              <p className="margin-top-8" style={{ color: 'var(--danger, #ef4444)', fontSize: '13px', lineHeight: 1.5 }}>
                ⚠️ <strong>Master Control Authority:</strong> Force-deleting will permanently remove this tenant and wipe all related historical allocations, bills, subscriptions, and logs. No restrictions will block you.
              </p>
            ) : (
              <p className="muted-text margin-top-8">
                Note: Active residents or tenants with historical allocation logs cannot be deleted to preserve audit trails.
              </p>
            )}
            <div className="modal-actions margin-top-20">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : isMaster ? 'Confirm Force Delete' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

