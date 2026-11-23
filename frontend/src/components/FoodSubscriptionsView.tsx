import React, { useEffect, useState } from 'react'
import { Plus, Search, Filter, RefreshCw, Pause, Play, XSquare, Edit3 } from 'lucide-react'
import { FoodSubscription } from '../types'
import FoodSubscriptionModal from './FoodSubscriptionModal'

interface Props {
  isClient?: boolean
}

export default function FoodSubscriptionsView({ isClient = false }: Props) {
  const [subs, setSubs] = useState<FoodSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<FoodSubscription | null>(null)

  async function loadSubs() {
    setLoading(true)
    setError('')
    try {
      const url = statusFilter === 'All'
        ? '/api/food/subscriptions'
        : `/api/food/subscriptions?status=${statusFilter}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load food subscriptions')
      const data = await res.json()
      setSubs(data)
    } catch (e: any) {
      setError(e.message || 'Error loading subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubs()
  }, [statusFilter])

  async function handleToggleStatus(sub: FoodSubscription, newStatus: 'Active' | 'Paused' | 'Cancelled') {
    if (!confirm(`Are you sure you want to mark subscription ${sub.subscription_number} as ${newStatus}?`)) return
    try {
      const res = await fetch(`/api/food/subscriptions/${sub.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Status update failed')
      loadSubs()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const filtered = subs.filter(s =>
    s.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.tenant_code.toLowerCase().includes(search.toLowerCase()) ||
    s.plan_name.toLowerCase().includes(search.toLowerCase()) ||
    s.subscription_number.toLowerCase().includes(search.toLowerCase()) ||
    s.room_number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Tenant Food Subscriptions</h2>
          <p className="muted">Manage active tenant meal subscriptions, mid-month proration, pause & cancellations</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadSubs} title="Refresh">
            <RefreshCw size={15} />
          </button>
          {!isClient && (
            <button className="primary" onClick={() => { setEditingSub(null); setModalOpen(true) }}>
              <Plus size={16} /> New Food Subscription
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filter-bar">
        <div className="search-box flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by tenant, code, room or plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-dropdown">
          <Filter size={15} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Paused">Paused Only</option>
            <option value="Cancelled">Cancelled Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading subscriptions…</div>
      ) : (
        <div className="table-responsive mt-16">
          <table className="table">
            <thead>
              <tr>
                <th>Subscription #</th>
                <th>Tenant</th>
                <th>Room</th>
                <th>Food Plan</th>
                <th>Start Date</th>
                <th className="text-right">Monthly Rate</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.subscription_number}</td>
                  <td>
                    <strong>{s.tenant_name}</strong>
                    <div className="text-muted text-xs">{s.tenant_code}</div>
                  </td>
                  <td>Room {s.room_number}</td>
                  <td>
                    <span className="badge category-badge-food">{s.plan_name}</span>
                  </td>
                  <td>{s.start_date}</td>
                  <td className="text-right font-medium">₹{s.monthly_price.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`status-pill ${s.status.toLowerCase()}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex-row gap-6 justify-center">
                      {!isClient && s.status === 'Active' && (
                        <button
                          className="btn-icon-xs text-amber"
                          title="Pause Subscription"
                          onClick={() => handleToggleStatus(s, 'Paused')}
                        >
                          <Pause size={14} />
                        </button>
                      )}
                      {!isClient && s.status === 'Paused' && (
                        <button
                          className="btn-icon-xs text-emerald"
                          title="Resume Subscription"
                          onClick={() => handleToggleStatus(s, 'Active')}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {!isClient && s.status !== 'Cancelled' && (
                        <button
                          className="btn-icon-xs text-rose"
                          title="Cancel Subscription"
                          onClick={() => handleToggleStatus(s, 'Cancelled')}
                        >
                          <XSquare size={14} />
                        </button>
                      )}
                      {!isClient && (
                        <button
                          className="btn-icon-xs text-muted"
                          title="Edit Details"
                          onClick={() => { setEditingSub(s); setModalOpen(true) }}
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {isClient && (
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>
                          View Only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-24">
                    No food subscriptions found matching your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <FoodSubscriptionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={loadSubs}
        subscription={editingSub}
      />
    </div>
  )
}

