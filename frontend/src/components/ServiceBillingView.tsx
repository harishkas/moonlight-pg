import React, { useEffect, useState } from 'react'
import { Plus, Search, Filter, RefreshCw, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { ServiceCharge } from '../types'
import GenerateServiceBillingModal from './GenerateServiceBillingModal'
import PayServiceChargeModal from './PayServiceChargeModal'

interface Props {
  onGenerateBilling?: () => void
  isClient?: boolean
}

export default function ServiceBillingView({ onGenerateBilling, isClient = false }: Props) {
  const [charges, setCharges] = useState<ServiceCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedCharge, setSelectedCharge] = useState<ServiceCharge | null>(null)

  async function loadCharges() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'All') params.append('service_category', categoryFilter)
      if (statusFilter !== 'All') params.append('status', statusFilter)
      if (search) params.append('search', search)

      const res = await fetch(`/api/services/billing/charges?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load service charges')
      const data = await res.json()
      setCharges(data)
    } catch (e: any) {
      setError(e.message || 'Error loading charges')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCharges()
  }, [categoryFilter, statusFilter, search])

  const totalBilled = charges.reduce((a, c) => a + c.amount, 0)
  const totalPaid = charges.reduce((a, c) => a + c.amount_paid, 0)
  const totalPending = charges.reduce((a, c) => a + c.pending_amount, 0)

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Centralized Services Billing & Ledgers</h2>
          <p className="muted">Itemized monthly charges for food, Wi-Fi, parking, electricity & facilities</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadCharges} title="Refresh">
            <RefreshCw size={15} />
          </button>
          {!isClient && (
            <button className="primary" onClick={() => setGenerateModalOpen(true)}>
              <Plus size={16} /> Run Monthly Service Billing
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Financial Snapshot */}
      <div className="stats-grid mb-20">
        <div className="stat-card">
          <div className="stat-icon bg-blue"><CreditCard size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Services Billed</span>
            <strong className="stat-value">₹{totalBilled.toLocaleString('en-IN')}</strong>
            <span className="stat-trend text-muted">{charges.length} vouchers</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-emerald"><CheckCircle2 size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Collected Payments</span>
            <strong className="stat-value text-emerald">₹{totalPaid.toLocaleString('en-IN')}</strong>
            <span className="stat-trend text-emerald">Deposited to ledger</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-rose"><Clock size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Pending Dues</span>
            <strong className="stat-value text-rose">₹{totalPending.toLocaleString('en-IN')}</strong>
            <span className="stat-trend text-rose">Awaiting collection</span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by tenant, voucher code, room or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-dropdown">
          <Filter size={15} />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            <option value="Food">Food</option>
            <option value="Wi-Fi">Wi-Fi</option>
            <option value="Parking">Parking</option>
            <option value="AC">AC</option>
            <option value="Electricity">Electricity</option>
            <option value="Other">Other Amenities</option>
          </select>
        </div>

        <div className="filter-dropdown">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading vouchers…</div>
      ) : (
        <div className="table-responsive mt-16">
          <table className="table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Tenant</th>
                <th>Room</th>
                <th>Category</th>
                <th>Description / Period</th>
                <th className="text-right">Billed Amount</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Pending</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {charges.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.charge_number}</td>
                  <td>
                    <strong>{c.tenant_name}</strong>
                    <div className="text-muted text-xs">{c.tenant_code}</div>
                  </td>
                  <td>Room {c.room_number}</td>
                  <td>
                    <span className={`badge category-badge-${c.service_category.toLowerCase()}`}>
                      {c.service_category}
                    </span>
                  </td>
                  <td>
                    <div className="font-medium text-xs">{c.title}</div>
                    <div className="text-muted text-xs">Period: {c.billing_month}/{c.billing_year}</div>
                  </td>
                  <td className="text-right font-medium">₹{c.amount.toLocaleString('en-IN')}</td>
                  <td className="text-right text-emerald font-medium">₹{c.amount_paid.toLocaleString('en-IN')}</td>
                  <td className="text-right text-rose font-bold">₹{c.pending_amount.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`status-pill ${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-center">
                    {!isClient && c.pending_amount > 0 ? (
                      <button
                        className="btn-sm primary"
                        onClick={() => { setSelectedCharge(c); setPayModalOpen(true) }}
                      >
                        <CreditCard size={12} /> Pay
                      </button>
                    ) : c.pending_amount <= 0 ? (
                      <span className="text-emerald text-xs font-semibold flex-row align-center justify-center gap-4">
                        <CheckCircle2 size={13} /> Paid
                      </span>
                    ) : (
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>
                        Due
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {charges.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-muted py-24">
                    No service charge vouchers found. Click "Run Monthly Service Billing" to generate charges.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <GenerateServiceBillingModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onGenerated={loadCharges}
      />

      <PayServiceChargeModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        onPaid={loadCharges}
        charge={selectedCharge}
      />
    </div>
  )
}

