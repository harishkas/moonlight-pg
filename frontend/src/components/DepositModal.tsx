import React, { useEffect, useState } from 'react'
import { X, ShieldCheck, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'
import { Tenant, RentInvoice, Deposit } from '../types'

interface Props {
  mode: 'create' | 'adjust' | 'refund'
  deposit?: Deposit | null
  initialTenantId?: number | null
  onClose: () => void
  onSuccess: () => void
}

export default function DepositModal({ mode, deposit, initialTenantId, onClose, onSuccess }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [invoices, setInvoices] = useState<RentInvoice[]>([])

  // Create fields
  const [tenantId, setTenantId] = useState<number | string>(initialTenantId || deposit?.tenant_id || '')
  const [depositType, setDepositType] = useState<'Security Deposit' | 'Advance Rent'>('Security Deposit')
  const [amount, setAmount] = useState<number | string>(deposit?.remaining_balance || '')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [transactionRef, setTransactionRef] = useState('')
  const [remarks, setRemarks] = useState('')

  // Adjust fields
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | string>('')

  const [loading, setLoading] = useState(mode !== 'create')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const [tRes, iRes] = await Promise.all([
          fetch('/api/tenants?status=all', { credentials: 'include' }),
          fetch('/api/rent/invoices?status=all', { credentials: 'include' })
        ])
        const [tData, iData] = await Promise.all([tRes.json(), iRes.json()])
        setTenants(tData)
        setInvoices(iData)
      } catch (err) {
        setError('Failed to load ledger data.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const tenantInvoices = invoices.filter(
    inv => inv.tenant_id === Number(tenantId || deposit?.tenant_id) && inv.pending_amount > 0
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'create') {
        if (!tenantId || Number(amount) <= 0) {
          throw new Error('Please select a resident and enter a positive deposit amount.')
        }
        const res = await fetch('/api/deposits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tenant_id: Number(tenantId),
            deposit_type: depositType,
            amount: Number(amount),
            payment_date: paymentDate,
            payment_mode: paymentMode,
            transaction_ref: transactionRef.trim() || null,
            remarks: remarks.trim() || null
          })
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Failed to record deposit.')
        }
      } else if (mode === 'adjust') {
        if (!deposit || !targetInvoiceId || Number(amount) <= 0) {
          throw new Error('Please select an invoice and enter adjustment amount.')
        }
        const res = await fetch(`/api/deposits/${deposit.id}/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            invoice_id: Number(targetInvoiceId),
            amount: Number(amount),
            reason: remarks.trim() || 'Adjusted against monthly rent invoice'
          })
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Failed to adjust deposit.')
        }
      } else if (mode === 'refund') {
        if (!deposit || Number(amount) <= 0) {
          throw new Error('Please enter refund amount.')
        }
        const res = await fetch(`/api/deposits/${deposit.id}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            amount: Number(amount),
            refund_date: paymentDate,
            payment_mode: paymentMode,
            transaction_ref: transactionRef.trim() || null,
            reason: remarks.trim() || 'Deposit refund'
          })
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Failed to process refund.')
        }
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3>
                {mode === 'create'
                  ? 'Record Advance or Security Deposit'
                  : mode === 'adjust'
                  ? `Adjust ${deposit?.deposit_type}`
                  : `Refund ${deposit?.deposit_type}`}
              </h3>
              <p className="muted-text">
                {mode === 'create'
                  ? 'Track refundable security liabilities and advance rent balances.'
                  : `${deposit?.deposit_number} · Resident: ${deposit?.tenant_name}`}
              </p>
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

        {deposit && (
          <div className="ledger-preview margin-bottom-12">
            <div className="ledger-row">
              <span>Deposit Voucher:</span>
              <strong>{deposit.deposit_number} ({deposit.deposit_type})</strong>
            </div>
            <div className="ledger-row">
              <span>Total Received:</span>
              <strong>₹{deposit.total_amount.toLocaleString('en-IN')}</strong>
            </div>
            <div className="ledger-row">
              <span>Available Balance:</span>
              <strong className="text-success">₹{deposit.remaining_balance.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'create' && (
            <>
              <div>
                <label>Select Resident *</label>
                <select
                  required
                  value={tenantId}
                  onChange={e => setTenantId(e.target.value)}
                >
                  <option value="">-- Choose Resident --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.tenant_code} · {t.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Accounting Category *</label>
                <select
                  value={depositType}
                  onChange={e => setDepositType(e.target.value as any)}
                >
                  <option value="Security Deposit">Security Deposit (Refundable Liability)</option>
                  <option value="Advance Rent">Advance Rent (Prepaid Rent)</option>
                </select>
                <small className="muted-text">
                  Note: Security Deposits are accounting liabilities and excluded from operational income.
                </small>
              </div>
            </>
          )}

          {mode === 'adjust' && (
            <div>
              <label>Select Rent Invoice to Settle *</label>
              <select
                required
                value={targetInvoiceId}
                onChange={e => {
                  setTargetInvoiceId(e.target.value)
                  const inv = tenantInvoices.find(i => i.id === Number(e.target.value))
                  if (inv && deposit) {
                    setAmount(Math.min(deposit.remaining_balance, inv.pending_amount))
                  }
                }}
              >
                <option value="">-- Select Pending Rent Invoice --</option>
                {tenantInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} (Due: ₹{inv.pending_amount} · Month: {inv.billing_month}/{inv.billing_year})
                  </option>
                ))}
              </select>
              {tenantInvoices.length === 0 && (
                <small className="error-text">No pending rent invoices found for this resident.</small>
              )}
            </div>
          )}

          <div className="form-grid-2">
            <div>
              <label>Amount (₹ INR) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="1"
                max={deposit ? deposit.remaining_balance : undefined}
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label>Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>

            {mode !== 'adjust' && (
              <>
                <div>
                  <label>Payment / Refund Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label>Transaction / Bank Ref</label>
                  <input
                    placeholder="e.g. UTR / NEFT Ref"
                    value={transactionRef}
                    onChange={e => setTransactionRef(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label>Reason / Remarks</label>
            <input
              placeholder="e.g. Received on room booking / refunded on checkout"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <CheckCircle size={15} />
              {submitting
                ? 'Processing...'
                : mode === 'create'
                ? 'Save Deposit'
                : mode === 'adjust'
                ? 'Confirm Adjustment'
                : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
