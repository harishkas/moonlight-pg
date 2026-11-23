import React, { useState } from 'react'
import { X, LogOut, AlertCircle, CheckCircle } from 'lucide-react'

interface Props {
  allocationId: number
  tenantName: string
  bedNumber: string
  roomNumber: string
  onClose: () => void
  onSuccess: () => void
}

export default function VacateModal({ allocationId, tenantName, bedNumber, roomNumber, onClose, onSuccess }: Props) {
  const [vacatingDate, setVacatingDate] = useState(new Date().toISOString().slice(0, 10))
  const [vacatingReason, setVacatingReason] = useState('Course/Job Completion')
  const [inspectionStatus, setInspectionStatus] = useState('Passed - No Damages')
  const [pendingDues, setPendingDues] = useState<number>(0)
  const [refundStatus, setRefundStatus] = useState('Full Refund Processed')
  const [remarks, setRemarks] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleVacate(e: React.FormEvent) {
    e.preventDefault()
    if (!vacatingDate) {
      setError('Please provide the actual leaving date.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/allocations/${allocationId}/vacate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vacating_date: vacatingDate,
          vacating_reason: vacatingReason,
          room_inspection_status: inspectionStatus,
          pending_dues: Number(pendingDues),
          deposit_refund_status: refundStatus,
          remarks: remarks.trim() || null
        })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Vacating workflow failed.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process vacating.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex-row gap-8 align-center">
            <div className="modal-icon text-danger bg-danger-light">
              <LogOut size={20} />
            </div>
            <div>
              <h3>Vacate Resident & Release Bed</h3>
              <p className="muted-text">
                Checkout <strong>{tenantName}</strong> from <strong>Room {roomNumber} · {bedNumber}</strong>.
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

        <div className="vacate-summary-banner">
          <span>This will mark the tenant as <strong>Vacated</strong> and immediately release <strong>{bedNumber}</strong> back to Available inventory. Historical records are preserved.</span>
        </div>

        <form onSubmit={handleVacate} className="modal-form">
          <div className="form-grid-2">
            <div>
              <label>Actual Leaving Date *</label>
              <input
                type="date"
                required
                value={vacatingDate}
                onChange={e => setVacatingDate(e.target.value)}
              />
            </div>

            <div>
              <label>Reason for Vacating</label>
              <select value={vacatingReason} onChange={e => setVacatingReason(e.target.value)}>
                <option value="Course/Job Completion">Course/Job Completion</option>
                <option value="Relocation to Other City">Relocation to Other City</option>
                <option value="Moving to Own Apartment">Moving to Own Apartment</option>
                <option value="Personal Reasons">Personal Reasons</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label>Room Inspection Status</label>
              <select value={inspectionStatus} onChange={e => setInspectionStatus(e.target.value)}>
                <option value="Passed - No Damages">Passed - No Damages</option>
                <option value="Minor Cleaning Needed">Minor Cleaning Needed</option>
                <option value="Repairs Required">Repairs Required</option>
              </select>
            </div>

            <div>
              <label>Pending Dues (₹) [Phase 3]</label>
              <input
                type="number"
                min="0"
                value={pendingDues}
                onChange={e => setPendingDues(Number(e.target.value))}
              />
            </div>

            <div className="full-width">
              <label>Deposit Refund Status [Phase 3]</label>
              <select value={refundStatus} onChange={e => setRefundStatus(e.target.value)}>
                <option value="Full Refund Processed">Full Refund Processed</option>
                <option value="Partial Deduction Applied">Partial Deduction Applied</option>
                <option value="No Refund / Forfeited">No Refund / Forfeited</option>
                <option value="Pending Bank Clearance">Pending Bank Clearance</option>
              </select>
            </div>
          </div>

          <div>
            <label>Inspection Remarks / Handover Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Returned room keys and cupboard keys. All fixtures intact."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={submitting}>
              <CheckCircle size={15} />
              {submitting ? 'Releasing Bed...' : 'Confirm Vacate & Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

