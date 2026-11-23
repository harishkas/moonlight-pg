import React, { useEffect, useState } from 'react'
import { X, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'
import { Tenant, RentInvoice } from '../types'

interface Props {
  initialTenantId?: number | null
  initialInvoiceId?: number | null
  onClose: () => void
  onSuccess: () => void
}

export default function RecordPaymentModal({ initialTenantId, initialInvoiceId, onClose, onSuccess }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [invoices, setInvoices] = useState<RentInvoice[]>([])

  const [tenantId, setTenantId] = useState<number | string>(initialTenantId || '')
  const [invoiceId, setInvoiceId] = useState<number | string>(initialInvoiceId || '')
  const [amount, setAmount] = useState<number | string>('')
  const [paymentType, setPaymentType] = useState('Monthly Rent')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [transactionRef, setTransactionRef] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
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

        if (initialInvoiceId) {
          const inv = iData.find((i: RentInvoice) => i.id === initialInvoiceId)
          if (inv) {
            setTenantId(inv.tenant_id)
            setInvoiceId(inv.id)
            setAmount(inv.pending_amount)
          }
        }
      } catch (err) {
        setError('Failed to load tenants or invoices.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [initialInvoiceId])

  // Filter invoices for chosen tenant
  const tenantInvoices = invoices.filter(
    inv => inv.tenant_id === Number(tenantId) && inv.pending_amount > 0
  )

  function handleInvoiceChange(invId: string) {
    setInvoiceId(invId)
    const inv = invoices.find(i => i.id === Number(invId))
    if (inv) {
      setAmount(inv.pending_amount)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || Number(amount) <= 0 || !paymentDate) {
      setError('Please provide a valid tenant, positive amount, and payment date.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload: any = {
        tenant_id: Number(tenantId),
        payment_date: paymentDate,
        amount: Number(amount),
        payment_type: paymentType,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim() || null,
        notes: notes.trim() || null
      }
      if (invoiceId) {
        payload.invoice_id = Number(invoiceId)
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Payment recording failed.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error recording payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon text-success">
              <DollarSign size={20} />
            </div>
            <div>
              <h3>Collect Resident Payment</h3>
              <p className="muted-text">Record rent, advance, fees, or miscellaneous collections with instant receipt.</p>
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

        {loading ? (
          <p className="loading-text">Loading ledger options...</p>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <div>
              <label>Select Resident / Tenant *</label>
              <select
                required
                value={tenantId}
                onChange={e => {
                  setTenantId(e.target.value)
                  setInvoiceId('')
                }}
              >
                <option value="">-- Choose Resident --</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.tenant_code} · {t.mobile}) [Pending: ₹{t.pending_balance || 0}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Link to Rent Invoice (Optional)</label>
              <select
                value={invoiceId}
                onChange={e => handleInvoiceChange(e.target.value)}
              >
                <option value="">-- General / Non-Invoice Payment --</option>
                {tenantInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} (Due: ₹{inv.pending_amount} · Month: {inv.billing_month}/{inv.billing_year})
                  </option>
                ))}
              </select>
              {tenantId && tenantInvoices.length === 0 && (
                <small className="muted-text">This resident has no pending rent invoices.</small>
              )}
            </div>

            <div className="form-grid-2">
              <div>
                <label>Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  placeholder="e.g. 6500"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label>Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>

              <div>
                <label>Payment Category</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                  <option value="Monthly Rent">Monthly Rent</option>
                  <option value="Advance">Advance Rent</option>
                  <option value="Security Deposit">Security Deposit</option>
                  <option value="Food Charges">Food Charges</option>
                  <option value="Electricity Charges">Electricity Charges</option>
                  <option value="Maintenance Charges">Maintenance Charges</option>
                  <option value="Other Charges">Other Charges</option>
                </select>
              </div>

              <div>
                <label>Payment Mode *</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                  <option value="Other">Other Mode</option>
                </select>
              </div>
            </div>

            <div>
              <label>Transaction / UTR Reference (Optional for Cash)</label>
              <input
                placeholder="e.g. UPI Ref / Cheque No / Bank Ref"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
              />
            </div>

            <div>
              <label>Internal Notes / Remarks</label>
              <input
                placeholder="e.g. Paid on time, received by front desk"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                <CheckCircle size={15} />
                {submitting ? 'Recording...' : 'Record Payment & Generate Receipt'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

