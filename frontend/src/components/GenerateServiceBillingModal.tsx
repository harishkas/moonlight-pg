import React, { useState } from 'react'
import { X, Layers, CheckCircle2 } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onGenerated: () => void
}

export default function GenerateServiceBillingModal({ isOpen, onClose, onGenerated }: Props) {
  const [billingMonth, setBillingMonth] = useState(new Date().getMonth() + 1)
  const [billingYear, setBillingYear] = useState(new Date().getFullYear())
  const [dueDate, setDueDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().slice(0, 10)
  )
  const [integrateWithRent, setIntegrateWithRent] = useState(false)
  const [selectedCats, setSelectedCats] = useState<string[]>([
    'Food',
    'Wi-Fi',
    'Parking',
    'AC',
    'Electricity',
    'Other'
  ])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  function toggleCat(cat: string) {
    if (selectedCats.includes(cat)) {
      setSelectedCats(selectedCats.filter(c => c !== cat))
    } else {
      setSelectedCats([...selectedCats, cat])
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (selectedCats.length === 0) {
      setError('Please select at least one service category.')
      return
    }

    setBusy(true)
    setError('')
    setResult(null)
    try {
      const payload = {
        billing_month: billingMonth,
        billing_year: billingYear,
        due_date: dueDate,
        integrate_with_rent_invoice: integrateWithRent,
        service_categories: selectedCats
      }
      const res = await fetch('/api/services/billing/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to generate service billing')
      }
      const resData = await res.json()
      setResult(resData)
      onGenerated()
    } catch (err: any) {
      setError(err.message || 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Centralized Service Billing Engine</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {result ? (
          <div className="success-state py-16 text-center">
            <div className="stat-icon bg-emerald mx-auto mb-12">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="font-bold text-lg mb-4">Service Billing Run Complete!</h4>
            <p className="text-muted text-sm mb-16">
              Generated <strong>{result.charges_generated}</strong> new service charge vouchers for billing period {result.billing_period}.
              <br />
              Total amount billed: <strong>₹{result.total_amount_billed.toLocaleString('en-IN')}</strong>.
              <br />
              Duplicates prevented: <strong>{result.duplicates_skipped}</strong>.
            </p>
            <button className="primary" onClick={onClose}>Done & View Charges</button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="modal-form">
            <p className="text-muted text-xs mb-12">
              This automated engine aggregates active food subscriptions, Wi-Fi packages, parking bays, AC allocations, electricity sub-meter readings, and custom facilities into itemized service vouchers.
            </p>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Billing Month *</label>
                <select value={billingMonth} onChange={e => setBillingMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-1">
                <label>Billing Year *</label>
                <input
                  type="number"
                  value={billingYear}
                  onChange={e => setBillingYear(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Payment Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="block mb-6">Include Categories:</label>
              <div className="flex-row flex-wrap gap-8">
                {['Food', 'Wi-Fi', 'Parking', 'AC', 'Electricity', 'Other'].map(cat => (
                  <button
                    type="button"
                    key={cat}
                    className={`cat-pill-toggle ${selectedCats.includes(cat) ? 'selected' : ''}`}
                    onClick={() => toggleCat(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group-checkbox mt-12">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={integrateWithRent}
                  onChange={e => setIntegrateWithRent(e.target.checked)}
                />
                <span>Attach to tenant's Monthly Rent Invoice (Aggregated balance in Phase 3)</span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Running Engine…' : 'Generate Service Charges'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

