import { useEffect, useState } from 'react'
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Ban,
  CheckCircle,
  FileText,
  DollarSign,
  AlertCircle,
  X
} from 'lucide-react'
import { Payment } from '../types'

interface Props {
  onRecordPayment?: () => void
  isClient?: boolean
}

export default function PaymentsView({ onRecordPayment, isClient = false }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cancel Payment Dialog
  const [cancellingPayment, setCancellingPayment] = useState<Payment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [submittingCancel, setSubmittingCancel] = useState(false)

  async function fetchPayments() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (typeFilter !== 'all') params.set('payment_type', typeFilter)
      if (modeFilter !== 'all') params.set('payment_mode', modeFilter)

      const res = await fetch(`/api/payments?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load payments')
      const data = await res.json()
      setPayments(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [search, typeFilter, modeFilter])

  async function handleConfirmCancel() {
    if (!cancellingPayment || !cancelReason.trim()) {
      alert('Please enter a cancellation reason for the audit trail.')
      return
    }

    setSubmittingCancel(true)
    try {
      const res = await fetch(`/api/payments/${cancellingPayment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancellation_reason: cancelReason.trim() })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Cancellation failed.')
      }

      setCancellingPayment(null)
      setCancelReason('')
      fetchPayments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error cancelling payment')
    } finally {
      setSubmittingCancel(false)
    }
  }

  function downloadReceiptPdf(receiptNumber: string) {
    window.open(`/api/receipts/${receiptNumber}/download`, '_blank')
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">TRANSACTION VOUCHERS · PAYMENT RECORDS</p>
          <h1>Payment Collection & History</h1>
          <p className="muted">Traceable transaction ledger with printable PDF receipts and reversal protection.</p>
        </div>
        {!isClient && onRecordPayment && (
          <button className="btn-primary" onClick={onRecordPayment}>
            <DollarSign size={16} /> Collect Payment
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search payment voucher, receipt #, resident, or UTR..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div className="filter-group">
          <Filter size={15} className="muted-text" />
          <span className="filter-label">Category:</span>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select-sm">
            <option value="all">All Categories</option>
            <option value="Monthly Rent">Monthly Rent</option>
            <option value="Advance">Advance Rent</option>
            <option value="Security Deposit">Security Deposit</option>
            <option value="Food Charges">Food Charges</option>
            <option value="Electricity Charges">Electricity Charges</option>
            <option value="Maintenance Charges">Maintenance</option>
          </select>
        </div>

        {/* Mode Filter */}
        <div className="filter-group margin-left-auto">
          <CreditCard size={15} className="muted-text" />
          <span className="filter-label">Mode:</span>
          {['all', 'UPI', 'Bank Transfer', 'Cash'].map(m => (
            <button
              key={m}
              className={`filter-pill ${modeFilter === m ? 'active' : ''}`}
              onClick={() => setModeFilter(m)}
            >
              {m === 'all' ? 'All Modes' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading payment vouchers...</div>
        ) : payments.length === 0 ? (
          <div className="empty-state-card">
            <CreditCard size={36} className="muted-text" />
            <h4>No payment vouchers found</h4>
            <p className="muted-text">Record your first resident payment to view transactions.</p>
            <button className="btn-primary btn-sm margin-top-12" onClick={onRecordPayment}>
              <DollarSign size={14} /> Collect Payment
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Receipt #</th>
                <th>Resident</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Mode & Ref</th>
                <th>Status</th>
                <th className="text-right">Receipt / Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className={p.is_cancelled ? 'row-cancelled' : ''}>
                  <td>
                    <span className="badge badge-code">{p.payment_number}</span>
                  </td>
                  <td>
                    <strong>{p.receipt_number}</strong>
                  </td>
                  <td>
                    <div className="tenant-name-cell">
                      <strong>{p.tenant_name}</strong>
                      <small className="muted-text">{p.tenant_code} (Room {p.room_number})</small>
                    </div>
                  </td>
                  <td>{p.payment_date}</td>
                  <td>
                    <strong style={{ fontSize: '14px', color: p.is_cancelled ? '#94a3b8' : 'var(--success)' }}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>{p.payment_type}</td>
                  <td>
                    <div>{p.payment_mode}</div>
                    {p.transaction_ref && (
                      <small className="muted-text" style={{ fontSize: '10px' }}>
                        Ref: {p.transaction_ref}
                      </small>
                    )}
                  </td>
                  <td>
                    {p.is_cancelled ? (
                      <span className="badge badge-vacated" title={p.cancellation_reason || ''}>
                        Cancelled
                      </span>
                    ) : (
                      <span className="badge badge-active flex-row gap-4 align-center">
                        <CheckCircle size={10} /> Valid
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      <a
                        href={`/api/receipts/${p.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary btn-xs"
                        title="Download PDF Receipt"
                      >
                        <Download size={13} /> PDF
                      </a>
                      {!isClient && !p.is_cancelled && (
                        <button
                          className="btn-icon-action text-danger"
                          title="Cancel / Reverse Transaction"
                          onClick={() => setCancellingPayment(p)}
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancel Payment Reason Modal */}
      {cancellingPayment && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon text-danger bg-danger-light">
                  <Ban size={20} />
                </div>
                <div>
                  <h3>Reverse / Cancel Payment</h3>
                  <p className="muted-text">
                    Voucher: {cancellingPayment.payment_number} · Amount: ₹{cancellingPayment.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setCancellingPayment(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="alert-error margin-bottom-12">
              <AlertCircle size={16} />
              <span>Financial transactions cannot be silently deleted. A cancellation audit record will be logged and the linked invoice balance will be restored.</span>
            </div>

            <div>
              <label>Cancellation Reason *</label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Bank transfer bounced / Entered incorrect resident / Duplicate entry"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>

            <div className="modal-actions margin-top-16">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCancellingPayment(null)}
                disabled={submittingCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmCancel}
                disabled={submittingCancel || !cancelReason.trim()}
              >
                {submittingCancel ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
