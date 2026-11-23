import React, { useEffect, useState } from 'react'
import { Plus, Layers, Search, RefreshCw, Edit2, CheckCircle2, UserCheck } from 'lucide-react'
import { ServiceCatalogItem, TenantServiceSubscription } from '../types'
import ServiceCatalogModal from './ServiceCatalogModal'
import TenantServiceSubModal from './TenantServiceSubModal'

export default function AdditionalServicesView() {
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([])
  const [subs, setSubs] = useState<TenantServiceSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [catRes, subRes] = await Promise.all([
        fetch('/api/services/catalog', { credentials: 'include' }),
        fetch('/api/services/subscriptions', { credentials: 'include' })
      ])
      if (!catRes.ok || !subRes.ok) throw new Error('Failed to load service data')
      const catData = await catRes.json()
      const subData = await subRes.json()
      setCatalog(catData)
      setSubs(subData)
    } catch (e: any) {
      setError(e.message || 'Error loading services')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Additional Facilities & Services</h2>
          <p className="muted">Catalog of custom PG amenities: Laundry, Housekeeping, Water, Mattresses, and more</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="secondary" onClick={() => { setEditingItem(null); setCatalogModalOpen(true) }}>
            <Plus size={16} /> New Service Item
          </button>
          <button className="primary" onClick={() => { setSelectedServiceId(null); setSubModalOpen(true) }}>
            <UserCheck size={16} /> Subscribe Tenant
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading services…</div>
      ) : (
        <>
          {/* Services Catalog Grid */}
          <h3 className="section-title mb-12">Service Catalog & Packages</h3>
          <div className="plans-grid mb-24">
            {catalog.map(item => (
              <div key={item.id} className="plan-card">
                <div className="plan-card-header">
                  <span className="badge category-badge-other">{item.category}</span>
                  <span className="text-xs font-mono text-muted">{item.service_code}</span>
                </div>

                <h3 className="plan-name">{item.service_name}</h3>
                <p className="plan-desc">{item.description || 'Facility service package.'}</p>

                <div className="plan-pricing">
                  <div className="price-primary">
                    ₹{item.price.toLocaleString('en-IN')}<span className="price-period">/{item.billing_type}</span>
                  </div>
                </div>

                <div className="plan-card-footer">
                  <div className="subscriber-count">
                    <strong>{item.active_subscriptions_count}</strong> active subscriptions
                  </div>
                  <div className="flex-row gap-6">
                    <button
                      className="btn-sm secondary"
                      onClick={() => { setEditingItem(item); setCatalogModalOpen(true) }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      className="btn-sm primary"
                      onClick={() => { setSelectedServiceId(item.id); setSubModalOpen(true) }}
                    >
                      Subscribe
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Tenant Subscriptions Table */}
          <h3 className="section-title mb-12">Active Tenant Service Subscriptions</h3>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Subscription #</th>
                  <th>Tenant</th>
                  <th>Room</th>
                  <th>Service</th>
                  <th>Quantity</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Total Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.subscription_number}</td>
                    <td>
                      <strong>{s.tenant_name}</strong>
                      <div className="text-muted text-xs">{s.tenant_code}</div>
                    </td>
                    <td>Room {s.room_number}</td>
                    <td>
                      <span className="badge category-badge-other">{s.service_name}</span>
                    </td>
                    <td>{s.quantity}</td>
                    <td className="text-right font-medium">₹{s.unit_price.toLocaleString('en-IN')}</td>
                    <td className="text-right font-bold text-primary">₹{s.total_amount.toLocaleString('en-IN')}</td>
                    <td>
                      <span className="status-pill active">{s.status}</span>
                    </td>
                  </tr>
                ))}

                {subs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-24">
                      No tenant service subscriptions active. Click "Subscribe Tenant" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ServiceCatalogModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        onSave={loadData}
        item={editingItem}
      />

      <TenantServiceSubModal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onSave={loadData}
        initialServiceId={selectedServiceId}
      />
    </div>
  )
}

