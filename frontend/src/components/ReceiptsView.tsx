import { useEffect, useState } from 'react'
import {
  Receipt as ReceiptIcon,
  Search,
  Download,
  ExternalLink,
  Printer,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Receipt } from '../types'

export default function ReceiptsView() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchReceipts() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/receipts?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load receipts')
      const data = await res.json()
      setReceipts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching receipts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipts()
  }, [search])

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">OFFICIAL AUDIT DOCUMENTS · DIGITAL RECEIPTS</p>
          <h1>Payment Receipts Archive</h1>
          <p className="muted">Search, preview, print, and download PDF receipts for every completed financial transaction.</p>
        </div>
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
            placeholder="Search receipt #, resident name, or tenant ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="margin-left-auto muted-text" style={{ fontSize: '12px' }}>
          Total Receipts: <strong>{receipts.length}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading receipts archive...</div>
        ) : receipts.length === 0 ? (
          <div className="empty-state-card">
            <ReceiptIcon size={36} className="muted-text" />
            <h4>No receipts match search</h4>
            <p className="muted-text">Receipts are automatically generated whenever a payment is collected.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Voucher #</th>
                <th>Resident</th>
                <th>Room & Bed</th>
                <th>Date</th>
                <th>Payment Category</th>
                <th>Billing Period</th>
                <th>Amount Paid</th>
                <th>Mode</th>
                <th className="text-right">PDF Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="badge badge-code" style={{ fontWeight: 700 }}>
                      {r.receipt_number}
                    </span>
                  </td>
                  <td>{r.payment_number}</td>
                  <td>
                    <div className="tenant-name-cell">
                      <strong>{r.tenant_name}</strong>
                      <small className="muted-text">{r.tenant_code}</small>
                    </div>
                  </td>
                  <td>
                    <span className="allocated-pill-cell">
                      Room {r.room_number} · {r.bed_number}
                    </span>
                  </td>
                  <td>{r.receipt_date}</td>
                  <td>
                    <span className="badge badge-primary">{r.payment_type}</span>
                  </td>
                  <td>{r.billing_period || 'N/A'}</td>
                  <td>
                    <strong style={{ fontSize: '13px', color: 'var(--success)' }}>
                      ₹{r.amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>{r.payment_mode}</td>
                  <td className="text-right">
                    <div className="row-actions">
                      <a
                        href={`/api/receipts/${r.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary btn-xs"
                        title="Download / Print PDF Receipt"
                      >
                        <Printer size={13} /> Print / PDF
                      </a>
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

