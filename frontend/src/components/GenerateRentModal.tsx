import React, { useState } from 'react'
import { X, Calendar, AlertCircle, CheckCircle } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: (count: number) => void
}

export default function GenerateRentModal({ onClose, onSuccess }: Props) {
  const now = new Date()
  const [billingMonth, setBillingMonth] = useState<number>(now.getMonth() + 1)
  const [billingYear, setBillingYear] = useState<number>(now.getFullYear())
  const [dueDate, setDueDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10)
  )
  const [prorate, setProrate] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/rent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billing_month: Number(billingMonth),
          billing_year: Number(billingYear),
          due_date: dueDate,
          prorate
        })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to generate monthly rent.')
      }

      const invoices = await res.json()
      onSuccess(invoices.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating invoices.')
    } finally {
      setSubmitting(false)
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon">
              <Calendar size={20} />
            </div>
            <div>
              <h3>Generate Monthly Rent Invoices</h3>
              <p className="muted-text">Batch create rent dues for all actively staying residents.</p>
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

        <form onSubmit={handleGenerate} className="modal-form">
          <div className="form-grid-2">
            <div>
              <label>Billing Month *</label>
              <select
                value={billingMonth}
                onChange={e => setBillingMonth(Number(e.target.value))}
              >
                {months.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name} ({i + 1})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Billing Year *</label>
              <input
                type="number"
                min="2020"
                max="2050"
                required
                value={billingYear}
                onChange={e => setBillingYear(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label>Payment Due Date *</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div className="checkbox-row margin-top-8">
            <input
              type="checkbox"
              id="prorate"
              checked={prorate}
              onChange={e => setProrate(e.target.checked)}
            />
            <label htmlFor="prorate" className="checkbox-label">
              Automatically calculate prorated rent for residents who joined or checked in mid-month
            </label>
          </div>

          <div className="modal-note-box">
            <span>Duplicate protection is enabled. Any resident who already has an invoice for {months[billingMonth - 1]} {billingYear} will not be charged twice.</span>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <CheckCircle size={15} />
              {submitting ? 'Generating Invoices...' : 'Generate Rent Invoices'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

