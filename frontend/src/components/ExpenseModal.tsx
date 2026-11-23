import React, { useState } from 'react'
import { X, Receipt as ExpenseIcon, AlertCircle, CheckCircle } from 'lucide-react'
import { Expense } from '../types'

interface Props {
  expense?: Expense | null
  onClose: () => void
  onSuccess: () => void
}

export const EXPENSE_CATEGORIES = [
  'Food and Groceries',
  'Electricity',
  'Water',
  'Internet / Wi-Fi',
  'Maintenance',
  'Cleaning',
  'Staff Salary',
  'Repairs',
  'Rent / Property Expenses',
  'Other Expenses'
] as const

export default function ExpenseModal({ expense, onClose, onSuccess }: Props) {
  const isEdit = Boolean(expense)
  const [title, setTitle] = useState(expense?.title || '')
  const [category, setCategory] = useState(expense?.category || 'Food and Groceries')
  const [amount, setAmount] = useState<number | string>(expense?.amount || '')
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState(expense?.payment_mode || 'UPI')
  const [paidTo, setPaidTo] = useState(expense?.paid_to || '')
  const [referenceNumber, setReferenceNumber] = useState(expense?.reference_number || '')
  const [description, setDescription] = useState(expense?.description || '')
  const [remarks, setRemarks] = useState(expense?.remarks || '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || Number(amount) <= 0 || !expenseDate) {
      setError('Please provide title, positive amount, and expense date.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim() || null,
        amount: Number(amount),
        expense_date: expenseDate,
        payment_mode: paymentMode,
        paid_to: paidTo.trim() || null,
        reference_number: referenceNumber.trim() || null,
        remarks: remarks.trim() || null
      }

      const url = isEdit ? `/api/expenses/${expense!.id}` : '/api/expenses'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to save expense.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving expense.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon text-warning">
              <ExpenseIcon size={20} />
            </div>
            <div>
              <h3>{isEdit ? `Edit Expense (${expense?.expense_number})` : 'Record Property Expense'}</h3>
              <p className="muted-text">Food, utilities, salaries, repairs, and daily operational costs.</p>
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

        <form onSubmit={handleSubmit} className="modal-form">
          <div>
            <label>Expense Title / Item *</label>
            <input
              required
              placeholder="e.g. Monthly Electricity Bill / Milk & Groceries"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label>Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Amount (₹ INR) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="1"
                placeholder="e.g. 3500"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label>Expense Date *</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>

            <div>
              <label>Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label>Paid To / Vendor</label>
              <input
                placeholder="e.g. Electricity Board / Clean Aqua"
                value={paidTo}
                onChange={e => setPaidTo(e.target.value)}
              />
            </div>

            <div>
              <label>Invoice / Reference #</label>
              <input
                placeholder="e.g. Bill No / UTR"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>Description / Breakdown</label>
            <textarea
              rows={2}
              placeholder="e.g. 50 cans drinking water + RO filter service"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label>Audit Remarks / Notes</label>
            <input
              placeholder="e.g. Verified by warden with physical bill on file"
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
              {submitting ? 'Saving...' : isEdit ? 'Update Expense' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

