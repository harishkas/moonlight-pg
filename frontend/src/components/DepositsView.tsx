import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  DollarSign,
  ArrowRightLeft,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Deposit } from '../types'

interface Props {
  onRecordDeposit?: () => void
  onAdjustDeposit?: (deposit: Deposit) => void
  onRefundDeposit?: (deposit: Deposit) => void
  isClient?: boolean
}

export default function DepositsView({
  onRecordDeposit,
  onAdjustDeposit,
  onRefundDeposit,
  isClient = false
}: Props) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'Security Deposit' | 'Advance Rent'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingDeposit, setViewingDeposit] = useState<Deposit | null>(null)

  async function fetchDeposits() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('deposit_type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/deposits?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load deposit records')
      const data = await res.json()
      setDeposits(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching deposits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeposits()
  }, [typeFilter, statusFilter])

  const filtered = deposits.filter(d => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      d.deposit_number.toLowerCase().includes(s) ||
      d.tenant_name.toLowerCase().includes(s) ||
      d.tenant_code.toLowerCase().includes(s)
    )
  })

  // Calculations
  const totalHeldSecurity = deposits
    .filter(d => d.deposit_type === 'Security Deposit' && d.status !== 'Refunded')
    .reduce((acc, d) => acc + d.remaining_balance, 0)

  const totalHeldAdvance = deposits
    .filter(d => d.deposit_type === 'Advance Rent' && d.status !== 'Refunded')
    .reduce((acc, d) => acc + d.remaining_balance, 0)

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">DEPOSIT LIABILITIES & ADVANCE LEDGER</p>
          <h1>Advance & Security Deposit Management</h1>
          <p className="muted">Track refundable security deposits, prepaid advance balances, and checkout settlements.</p>
        </div>
        {!isClient && onRecordDeposit && (
          <button className="btn-primary" onClick={onRecordDeposit}>
            <ShieldCheck size={16} /> Record Deposit
          </button>
        )}
      </div>

      {/* KPI Cards for Held Deposits */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-top">
            <span>Total Security Deposits Held</span>
            <span className="stat-icon"><ShieldCheck size={16} /></span>
          </div>
          <strong className="stat-value text-warning">₹{totalHeldSecurity.toLocaleString('en-IN')}</strong>
          <small className="badge badge-status-pending" style={{ fontSize: '10px' }}>Refundable Liability</small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-top">
            <span>Unadjusted Advance Rent</span>
            <span className="stat-icon"><ArrowRightLeft size={16} /></span>
          </div>
          <strong className="stat-value text-primary">₹{totalHeldAdvance.toLocaleString('en-IN')}</strong>
          <small>Prepaid rent available for adjustment</small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-top">
            <span>Total Managed Deposits</span>
            <span className="stat-icon"><DollarSign size={16} /></span>
          </div>
          <strong className="stat-value text-success">
            ₹{(totalHeldSecurity + totalHeldAdvance).toLocaleString('en-IN')}
          </strong>
          <small>{deposits.length} deposit records on file</small>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search deposit #, resident name, or tenant ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Deposit Type Tabs */}
        <div className="filter-group">
          <span className="filter-label">Category:</span>
          <button
            className={`filter-pill ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Deposits
          </button>
          <button
            className={`filter-pill ${typeFilter === 'Security Deposit' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Security Deposit')}
          >
            Security Deposit (Refundable)
          </button>
          <button
            className={`filter-pill ${typeFilter === 'Advance Rent' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Advance Rent')}
          >
            Advance Rent (Prepaid)
          </button>
        </div>

        {/* Status Filter */}
        <div className="filter-group margin-left-auto">
          <span className="filter-label">Status:</span>
          {['all', 'Active', 'Partially Adjusted', 'Fully Adjusted', 'Refunded'].map(st => (
            <button
              key={st}
              className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading deposit ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-card">
            <ShieldCheck size={36} className="muted-text" />
            <h4>No deposit records found</h4>
            <p className="muted-text">Record an advance rent or security deposit to view entries.</p>
            <button className="btn-primary btn-sm margin-top-12" onClick={onRecordDeposit}>
              <ShieldCheck size={14} /> Record Deposit
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Resident</th>
                <th>Category</th>
                <th>Date</th>
                <th>Initial Amount</th>
                <th>Adjusted</th>
                <th>Refunded</th>
                <th>Remaining Balance</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td>
                    <span className="badge badge-code">{d.deposit_number}</span>
                  </td>
                  <td>
                    <div className="tenant-name-cell">
                      <strong>{d.tenant_name}</strong>
                      <small className="muted-text">{d.tenant_code}</small>
                    </div>
                  </td>
                  <td>
                    <span className={d.deposit_type === 'Security Deposit' ? 'badge badge-status-pending' : 'badge badge-primary'}>
                      {d.deposit_type}
                    </span>
                  </td>
                  <td>{d.payment_date}</td>
                  <td>₹{d.total_amount.toLocaleString('en-IN')}</td>
                  <td>₹{d.adjusted_amount.toLocaleString('en-IN')}</td>
                  <td>₹{d.refunded_amount.toLocaleString('en-IN')}</td>
                  <td>
                    <strong style={{ fontSize: '13px', color: d.remaining_balance > 0 ? 'var(--primary)' : '#94a3b8' }}>
                      ₹{d.remaining_balance.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-status-${d.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      {!isClient && onAdjustDeposit && d.remaining_balance > 0 && d.deposit_type === 'Advance Rent' && (
                        <button
                          className="btn-primary btn-xs"
                          title="Adjust advance against pending rent invoice"
                          onClick={() => onAdjustDeposit(d)}
                        >
                          <ArrowRightLeft size={13} /> Adjust
                        </button>
                      )}
                      {!isClient && onRefundDeposit && d.remaining_balance > 0 && (
                        <button
                          className="btn-secondary btn-xs"
                          title="Refund remaining deposit on checkout"
                          onClick={() => onRefundDeposit(d)}
                        >
                          <RotateCcw size={13} /> Refund
                        </button>
                      )}
                      <button
                        className="btn-icon-action"
                        title="View Transaction Audit History"
                        onClick={() => setViewingDeposit(d)}
                      >
                        <ShieldCheck size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Transaction History Modal */}
      {viewingDeposit && (
        <div className="modal-backdrop">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3>Deposit Ledger & History</h3>
                  <p className="muted-text">
                    {viewingDeposit.deposit_number} · Resident: {viewingDeposit.tenant_name} ({viewingDeposit.deposit_type})
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setViewingDeposit(null)}>
                <CheckCircle size={18} />
              </button>
            </div>

            <div className="ledger-preview margin-bottom-16">
              <div className="ledger-row">
                <span>Initial Deposit:</span>
                <strong>₹{viewingDeposit.total_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="ledger-row">
                <span>Total Adjusted:</span>
                <strong>₹{viewingDeposit.adjusted_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="ledger-row">
                <span>Total Refunded:</span>
                <strong>₹{viewingDeposit.refunded_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="ledger-row">
                <span>Remaining Balance:</span>
                <strong className="text-success">₹{viewingDeposit.remaining_balance.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <h4>Transaction Audit Trail</h4>
            <div className="history-timeline margin-top-8">
              {viewingDeposit.transactions.map((tx, idx) => (
                <div key={idx} className="timeline-card active-item">
                  <div className="timeline-header">
                    <strong>{tx.transaction_type}</strong>
                    <span className="rent-tag">₹{tx.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="timeline-body">
                    <div><small>Date:</small> {tx.transaction_date}</div>
                    <div><small>Mode / Ref:</small> {tx.payment_mode || 'System'} {tx.transaction_ref ? `(${tx.transaction_ref})` : ''}</div>
                    <div className="full-width"><small>Reason / Note:</small> {tx.reason}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions margin-top-16">
              <button className="btn-primary" onClick={() => setViewingDeposit(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
