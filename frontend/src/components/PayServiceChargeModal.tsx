import React, { useState } from 'react'
import { X, CheckCircle2, Download, Receipt } from 'lucide-react'
import { ServiceCharge } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onPaid: () => void
  charge: ServiceCharge | null
}

export default function PayServiceChargeModal({ isOpen, onClose, onPaid, charge }: Props) {
  const [amount, setAmount] = useState(charge?.pending_amount?.toString() || '')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [transactionRef, setTransactionRef] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [error, setError] = useState('')

  if (!isOpen || !charge) return null

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    const payAmt = parseFloat(amount)
    if (!payAmt || payAmt <= 0) {
      setError('Please enter a valid positive payment amount.')
      return
    }
    if (payAmt > charge!.pending_amount) {
      setError(`Payment cannot exceed pending amount of ₹${charge!.pending_amount.toLocaleString('en-IN')}`)
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        charge_id: charge!.id,
        amount: payAmt,
        payment_mode: paymentMode,
        transaction_ref: transactionRef || null,
        notes: notes || null
      }
      const res = await fetch('/api/services/billing/pay', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Payment processing failed')
      }
      const d = await res.json()
      setReceiptUrl(d.pdf_download_url)
      onPaid()
    } catch (err: any) {
      setError(err.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Record Service Payment</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {receiptUrl ? (
          <div className="success-state py-16 text-center">
            <div className="stat-icon bg-emerald mx-auto mb-12">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="font-bold text-lg mb-4">Payment Recorded Successfully!</h4>
            <p className="text-muted text-sm mb-16">
              Receipt generated and securely archived in the Phase 3 financial ledger.
            </p>
            <div className="flex-row gap-8 justify-center">
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="button primary inline-flex align-center gap-6"
              >
                <Download size={15} /> Download PDF Receipt
              </a>
              <button className="secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePay} className="modal-form">
            <div className="charge-details-summary p-12 bg-subtle rounded-md mb-12">
              <div className="flex-row justify-between mb-4">
                <span className="text-muted text-xs">Voucher:</span>
                <span className="font-mono text-xs font-semibold">{charge.charge_number}</span>
              </div>
              <div className="flex-row justify-between mb-4">
                <span className="text-muted text-xs">Tenant:</span>
                <span className="font-medium text-xs">{charge.tenant_name} (Room {charge.room_number})</span>
              </div>
              <div className="flex-row justify-between mb-4">
                <span className="text-muted text-xs">Item:</span>
                <span className="text-xs">{charge.title}</span>
              </div>
              <div className="flex-row justify-between pt-6 border-top">
                <span className="text-muted text-xs font-bold">Outstanding Balance:</span>
                <span className="font-bold text-sm text-rose">₹{charge.pending_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Amount to Collect (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={charge.pending_amount}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group flex-1">
                <label>Payment Mode *</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Transaction / Reference Number</label>
              <input
                type="text"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g. UPI Ref / Bank UTR / Cheque Number"
              />
            </div>

            <div className="form-group">
              <label>Payment Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Received via GPay"
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Processing…' : `Collect ₹${parseFloat(amount || '0').toLocaleString('en-IN')}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

