import { useEffect, useState } from 'react'
import {
  Calendar,
  Search,
  Filter,
  DollarSign,
  Edit3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Receipt,
  FileText
} from 'lucide-react'
import { RentInvoice } from '../types'

interface Props {
  onGenerateRent?: () => void
  onCollectPaymentForInvoice?: (invoice: RentInvoice) => void
  onAdjustInvoice?: (invoice: RentInvoice) => void
  isClient?: boolean
}

export default function RentManagementView({
  onGenerateRent,
  onCollectPaymentForInvoice,
  onAdjustInvoice,
  isClient = false
}: Props) {
  const [invoices, setInvoices] = useState<RentInvoice[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchInvoices() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (monthFilter !== 'all') params.set('month', monthFilter)
      params.set('year', String(yearFilter))

      const res = await fetch(`/api/rent/invoices?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load rent invoices')
      const data = await res.json()
      setInvoices(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [search, statusFilter, monthFilter, yearFilter])

  // Summary Metrics
  const totalBilled = invoices.reduce((acc, i) => acc + i.total_amount, 0)
  const totalCollected = invoices.reduce((acc, i) => acc + i.amount_paid, 0)
  const totalPending = invoices.reduce((acc, i) => acc + i.pending_amount, 0)
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">MONTHLY BILLING & RECEIVABLES</p>
          <h1>Rent Management</h1>
          <p className="muted">Generate monthly rent, manage prorated billings, adjust dues, and monitor payment status.</p>
        </div>
        {!isClient && onGenerateRent && (
          <button className="btn-primary" onClick={onGenerateRent}>
            <Calendar size={16} /> Generate Monthly Rent
          </button>
        )}
      </div>

      {/* KPI mini-bar */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '16px' }}>
        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <small className="muted-text">Total Billed</small>
          <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>₹{totalBilled.toLocaleString('en-IN')}</strong>
        </div>
        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <small className="muted-text">Rent Collected</small>
          <strong style={{ fontSize: '18px', color: 'var(--success)' }}>₹{totalCollected.toLocaleString('en-IN')}</strong>
        </div>
        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <small className="muted-text">Pending Rent</small>
          <strong style={{ fontSize: '18px', color: 'var(--danger)' }}>₹{totalPending.toLocaleString('en-IN')}</strong>
        </div>
        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <small className="muted-text">Overdue Invoices</small>
          <strong style={{ fontSize: '18px', color: overdueCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {overdueCount} Invoices
          </strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search invoice #, resident name, or tenant ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Month Selector */}
        <div className="filter-group">
          <Calendar size={15} className="muted-text" />
          <span className="filter-label">Month:</span>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="select-sm">
            <option value="all">All Months</option>
            {months.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group margin-left-auto">
          <Filter size={15} className="muted-text" />
          <span className="filter-label">Status:</span>
          {['all', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'].map(st => (
            <button
              key={st}
              className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Invoices' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading rent ledger...</div>
        ) : invoices.length === 0 ? (
          <div className="empty-state-card">
            <FileText size={36} className="muted-text" />
            <h4>No invoices match criteria</h4>
            <p className="muted-text">Generate monthly rent or adjust your filter selection.</p>
            <button className="btn-primary btn-sm margin-top-12" onClick={onGenerateRent}>
              <Calendar size={14} /> Generate Rent
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Resident</th>
                <th>Room & Bed</th>
                <th>Month</th>
                <th>Due Date</th>
                <th>Total Due</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <span className="badge badge-code">{inv.invoice_number}</span>
                  </td>
                  <td>
                    <div className="tenant-name-cell">
                      <strong>{inv.tenant_name}</strong>
                      <small className="muted-text">{inv.tenant_code}</small>
                    </div>
                  </td>
                  <td>
                    <span className="allocated-pill-cell">
                      Room {inv.room_number} · {inv.bed_number}
                    </span>
                  </td>
                  <td>
                    {months[inv.billing_month - 1]} {inv.billing_year}
                    {inv.prorated_days && (
                      <small className="badge badge-status-pending" style={{ display: 'block', fontSize: '9px', marginTop: '2px' }}>
                        Prorated ({inv.prorated_days} days)
                      </small>
                    )}
                  </td>
                  <td>{inv.due_date}</td>
                  <td>
                    <strong>₹{inv.total_amount.toLocaleString('en-IN')}</strong>
                    {inv.adjustment_amount !== 0 && (
                      <small className="muted-text" style={{ display: 'block', fontSize: '10px' }}>
                        Adj: {inv.adjustment_amount > 0 ? `+₹${inv.adjustment_amount}` : `-₹${Math.abs(inv.adjustment_amount)}`}
                      </small>
                    )}
                  </td>
                  <td className="text-success font-weight-bold">
                    ₹{inv.amount_paid.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <strong className={inv.pending_amount > 0 ? 'text-danger' : 'text-success'}>
                      ₹{inv.pending_amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-invoice-${inv.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      {!isClient && onCollectPaymentForInvoice && inv.pending_amount > 0 && (
                        <button
                          className="btn-primary btn-xs"
                          title="Collect Rent Payment"
                          onClick={() => onCollectPaymentForInvoice(inv)}
                        >
                          <DollarSign size={13} /> Collect
                        </button>
                      )}
                      {!isClient && onAdjustInvoice && (
                        <button
                          className="btn-icon-action"
                          title="Authorize Rent Adjustment / Discount"
                          onClick={() => onAdjustInvoice(inv)}
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
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

