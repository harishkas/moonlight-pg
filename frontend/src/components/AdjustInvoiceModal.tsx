import React, { useState } from 'react'
import { X, Edit3, AlertCircle, CheckCircle } from 'lucide-react'
import { RentInvoice } from '../types'

interface Props {
  invoice: RentInvoice
  onClose: () => void
  onSuccess: () => void
}

export default function AdjustInvoiceModal({ invoice, onClose, onSuccess }: Props) {
  const [adjustmentAmount, setAdjustmentAmount] = useState<number | string>(0)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustmentReason.trim()) {
      setError('Authorized adjustment reason is required for audit logs.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/rent/invoices/${invoice.id}/adjust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adjustment_amount: Number(adjustmentAmount),
          adjustment_reason: adjustmentReason.trim()
        })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Invoice adjustment failed.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adjusting invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  const projectedTotal = Math.max(0, invoice.base_rent + (invoice.adjustment_amount || 0) + Number(adjustmentAmount))

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon">
              <Edit3 size={20} />
            </div>
            <div>
              <h3>Authorize Rent Adjustment</h3>
              <p className="muted-text">Invoice {invoice.invoice_number} · Resident: {invoice.tenant_name}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="ledger-preview margin-bottom-12">
          <div className="ledger-row">
            <span>Base Rent:</span>
            <strong>₹{invoice.base_rent.toLocaleString('en-IN')}</strong>
          </div>
          <div className="ledger-row">
            <span>Current Total Due:</span>
            <strong>₹{invoice.total_amount.toLocaleString('en-IN')}</strong>
          </div>
          <div className="ledger-row">
            <span>Amount Already Paid:</span>
            <strong className="text-success">₹{invoice.amount_paid.toLocaleString('en-IN')}</strong>
          </div>
          <div className="ledger-row">
            <span>Current Outstanding:</span>
            <strong className="text-danger">₹{invoice.pending_amount.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <form onSubmit={handleAdjust} className="modal-form">
          <div>
            <label>Adjustment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="Use negative for discount/waiver, positive for fine/charge"
              value={adjustmentAmount}
              onChange={e => setAdjustmentAmount(e.target.value)}
            />
            <small className="muted-text">
              Projected new total payable: <strong>₹{projectedTotal.toLocaleString('en-IN')}</strong>
            </small>
          </div>

          <div>
            <label>Adjustment Reason & Authorization *</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. 5-day waiver authorized by manager due to delayed check-in"
              value={adjustmentReason}
              onChange={e => setAdjustmentReason(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <CheckCircle size={15} />
              {submitting ? 'Applying Adjustment...' : 'Apply & Save Audit Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
