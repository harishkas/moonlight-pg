import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Tenant, ParkingSlot } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  initialSlotId?: number | null
}

export default function ParkingAllocateModal({ isOpen, onClose, onSave, initialSlotId }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [slotId, setSlotId] = useState<number | ''>(initialSlotId || '')
  const [vehicleType, setVehicleType] = useState('Two-wheeler')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().slice(0, 10))
  const [monthlyCharge, setMonthlyCharge] = useState('300')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)

      fetch('/api/parking/slots', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          const avail = data.filter((s: any) => s.status === 'Available')
          setSlots(avail)
          if (initialSlotId) {
            const found = data.find((s: any) => s.id === initialSlotId)
            if (found) {
              setSlotId(found.id)
              setVehicleType(found.slot_type)
              setMonthlyCharge(found.monthly_charge.toString())
            }
          } else if (avail.length > 0 && !slotId) {
            setSlotId(avail[0].id)
            setVehicleType(avail[0].slot_type)
            setMonthlyCharge(avail[0].monthly_charge.toString())
          }
        })
        .catch(console.error)
    }
  }, [isOpen, initialSlotId])

  function handleSlotChange(id: number) {
    setSlotId(id)
    const s = slots.find(x => x.id === id)
    if (s) {
      setVehicleType(s.slot_type)
      setMonthlyCharge(s.monthly_charge.toString())
    }
  }

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !slotId) {
      setError('Please select both a tenant and an available parking slot.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        tenant_id: tenantId,
        slot_id: slotId,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase().trim(),
        allocation_date: allocationDate,
        monthly_charge: parseFloat(monthlyCharge),
        remarks: remarks || null
      }
      const res = await fetch('/api/parking/allocations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to allocate parking slot')
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
          <h3>Allocate Parking Bay</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select Tenant *</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(Number(e.target.value))}
              required
            >
              <option value="">-- Choose active tenant --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.tenant_code}) - Room {t.current_allocation?.room_number || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Available Parking Slot *</label>
              <select
                value={slotId}
                onChange={e => handleSlotChange(Number(e.target.value))}
                required
              >
                <option value="">-- Choose available bay --</option>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.slot_number} ({s.slot_type}) - ₹{s.monthly_charge.toLocaleString('en-IN')}/mo
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Monthly Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyCharge}
                onChange={e => setMonthlyCharge(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Vehicle Number Plate *</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MH-12-AB-1234"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Allocation Date *</label>
              <input
                type="date"
                value={allocationDate}
                onChange={e => setAllocationDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Vehicle Make & Model / Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Royal Enfield Hunter 350, Black"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Allocating…' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

