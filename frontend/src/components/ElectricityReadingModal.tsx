import React, { useEffect, useState } from 'react'
import { X, Calculator } from 'lucide-react'
import { ElectricityMeter } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  initialMeterId?: number | null
}

export default function ElectricityReadingModal({ isOpen, onClose, onSave, initialMeterId }: Props) {
  const [meters, setMeters] = useState<ElectricityMeter[]>([])
  const [meterId, setMeterId] = useState<number | ''>(initialMeterId || '')
  const [billingMonth, setBillingMonth] = useState(new Date().getMonth() + 1)
  const [billingYear, setBillingYear] = useState(new Date().getFullYear())
  const [previousReading, setPreviousReading] = useState('0')
  const [currentReading, setCurrentReading] = useState('')
  const [ratePerUnit, setRatePerUnit] = useState('10')
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/electricity/meters', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setMeters(data)
          const targetId = initialMeterId || (data.length > 0 ? data[0].id : null)
          if (targetId) {
            setMeterId(targetId)
            const m = data.find((x: any) => x.id === targetId)
            if (m) {
              setPreviousReading(m.latest_reading?.toString() || '0')
              setRatePerUnit(m.rate_per_unit.toString())
            }
          }
        })
        .catch(console.error)
    }
  }, [isOpen, initialMeterId])

  function handleMeterChange(id: number) {
    setMeterId(id)
    const m = meters.find(x => x.id === id)
    if (m) {
      setPreviousReading(m.latest_reading?.toString() || '0')
      setRatePerUnit(m.rate_per_unit.toString())
    }
  }

  const prev = parseFloat(previousReading) || 0
  const cur = parseFloat(currentReading) || 0
  const units = Math.max(0, cur - prev)
  const rate = parseFloat(ratePerUnit) || 10
  const totalAmount = Math.round(units * rate * 100) / 100

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!meterId) {
      setError('Please select a meter.')
      return
    }

    if (cur < prev) {
      setError(`Current reading (${cur}) cannot be lower than previous reading (${prev}).`)
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        meter_id: Number(meterId),
        billing_month: billingMonth,
        billing_year: billingYear,
        previous_reading: prev,
        current_reading: cur,
        rate_per_unit: rate,
        reading_date: readingDate,
        remarks: remarks || null
      }
      const res = await fetch('/api/electricity/readings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to record meter reading')
      }
      onSave()
      onClose()
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
          <h3>Record Monthly Electricity Reading</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select Meter *</label>
            <select
              value={meterId}
              onChange={e => handleMeterChange(Number(e.target.value))}
              required
            >
              <option value="">-- Choose sub-meter --</option>
              {meters.map(m => (
                <option key={m.id} value={m.id}>
                  {m.meter_number} (Room {m.room_number}) - Latest: {m.latest_reading || 0} kWh
                </option>
              ))}
            </select>
          </div>

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

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Previous Reading (kWh) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={previousReading}
                onChange={e => setPreviousReading(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Current Reading (kWh) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentReading}
                onChange={e => setCurrentReading(e.target.value)}
                placeholder="e.g. 250"
                required
              />
            </div>
          </div>

          {/* Real-time Calculation Summary Box */}
          <div className="calculation-preview-box mt-12 mb-16">
            <div className="flex-row align-center gap-6 text-xs text-muted mb-6 font-semibold">
              <Calculator size={14} /> LIVE CHARGE COMPUTATION
            </div>
            <div className="flex-row justify-between text-sm mb-4">
              <span>Units Consumed:</span>
              <strong>{units.toFixed(2)} kWh</strong>
            </div>
            <div className="flex-row justify-between text-sm mb-4">
              <span>Rate Per Unit:</span>
              <span>₹{rate.toFixed(2)}/kWh</span>
            </div>
            <div className="flex-row justify-between text-base font-bold text-primary pt-6 border-top">
              <span>Total Electricity Charge:</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <small className="text-muted block mt-4">
              Note: When monthly billing is executed, this charge is split fairly among the active occupants of this room.
            </small>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Reading Date *</label>
              <input
                type="date"
                value={readingDate}
                onChange={e => setReadingDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-2">
              <label>Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Meter verified by caretaker"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Recording…' : 'Save Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

