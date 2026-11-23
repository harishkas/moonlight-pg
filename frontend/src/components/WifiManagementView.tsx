import React, { useEffect, useState } from 'react'
import { Plus, Wifi, Search, RefreshCw, Power, CheckCircle, Info } from 'lucide-react'
import { WifiService, WifiSubscription } from '../types'
import WifiModal from './WifiModal'

export default function WifiManagementView() {
  const [services, setServices] = useState<WifiService[]>([])
  const [subs, setSubs] = useState<WifiSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [srvRes, subRes] = await Promise.all([
        fetch('/api/services/wifi', { credentials: 'include' }),
        fetch('/api/services/wifi/subscriptions', { credentials: 'include' })
      ])
      if (!srvRes.ok || !subRes.ok) throw new Error('Failed to load Wi-Fi data')
      const srvData = await srvRes.json()
      const subData = await subRes.json()
      setServices(srvData)
      setSubs(subData)
    } catch (e: any) {
      setError(e.message || 'Error loading Wi-Fi records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleDeactivate(sub: WifiSubscription) {
    if (!confirm(`Deactivate Wi-Fi service for ${sub.tenant_name}?`)) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/services/wifi/subscriptions/${sub.id}?status=Inactive&deactivation_date=${today}`, {
        method: 'PUT',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Deactivation failed')
      loadData()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const filteredSubs = subs.filter(s =>
    s.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.tenant_code.toLowerCase().includes(search.toLowerCase()) ||
    s.network_name.toLowerCase().includes(search.toLowerCase()) ||
    s.room_number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Wi-Fi Network & Subscriber Management</h2>
          <p className="muted">Manage high-speed internet networks, tenant subscriptions, and billing flags</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Activate Tenant Wi-Fi
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Available Wi-Fi Networks Overview */}
      <div className="card-grid-2 mb-20">
        {services.map(s => (
          <div key={s.id} className="card flex-row justify-between align-center p-16">
            <div className="flex-row gap-12 align-center">
              <div className="stat-icon bg-blue"><Wifi size={22} /></div>
              <div>
                <h4 className="font-semibold text-base mb-2">{s.network_name}</h4>
                <p className="text-muted text-xs">{s.description || 'Hostel High-Speed Fiber'}</p>
                <div className="text-xs text-muted mt-4">
                  <strong>{s.subscribers_count}</strong> active tenant devices
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-primary">₹{s.monthly_charge.toLocaleString('en-IN')}<span className="text-xs text-muted">/mo</span></div>
              <span className="badge category-badge-wifi mt-4">Active Network</span>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search-box flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search active Wi-Fi subscribers by tenant, code or room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading subscribers…</div>
      ) : (
        <div className="table-responsive mt-16">
          <table className="table">
            <thead>
              <tr>
                <th>Subscription #</th>
                <th>Tenant</th>
                <th>Room</th>
                <th>Network Plan</th>
                <th>Activation Date</th>
                <th className="text-right">Monthly Fee</th>
                <th>Billing Rule</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.subscription_number}</td>
                  <td>
                    <strong>{s.tenant_name}</strong>
                    <div className="text-muted text-xs">{s.tenant_code}</div>
                  </td>
                  <td>Room {s.room_number}</td>
                  <td>
                    <span className="badge category-badge-wifi">{s.network_name}</span>
                  </td>
                  <td>{s.activation_date}</td>
                  <td className="text-right font-medium">₹{s.monthly_charge.toLocaleString('en-IN')}</td>
                  <td>
                    {s.included_in_rent ? (
                      <span className="text-xs text-emerald font-medium">Included in Rent</span>
                    ) : (
                      <span className="text-xs text-muted">Billed Separately</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${s.status.toLowerCase()}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-center">
                    {s.status === 'Active' ? (
                      <button
                        className="btn-sm secondary text-rose"
                        onClick={() => handleDeactivate(s)}
                        title="Deactivate Wi-Fi"
                      >
                        <Power size={13} /> Deactivate
                      </button>
                    ) : (
                      <span className="text-muted text-xs">Deactivated</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-24">
                    No Wi-Fi subscriptions found matching your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <WifiModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={loadData}
      />
    </div>
  )
}

