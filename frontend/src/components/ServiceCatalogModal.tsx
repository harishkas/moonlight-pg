import React, { useState } from 'react'
import { X } from 'lucide-react'
import { ServiceCatalogItem } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  item?: ServiceCatalogItem | null
}

export default function ServiceCatalogModal({ isOpen, onClose, onSave, item }: Props) {
  const [serviceCode, setServiceCode] = useState(item?.service_code || '')
  const [serviceName, setServiceName] = useState(item?.service_name || '')
  const [category, setCategory] = useState(item?.category || 'Laundry')
  const [description, setDescription] = useState(item?.description || '')
  const [billingType, setBillingType] = useState(item?.billing_type || 'Monthly')
  const [price, setPrice] = useState(item?.price?.toString() || '500')
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        service_code: serviceCode.toUpperCase().trim(),
        service_name: serviceName.trim(),
        category,
        description: description || null,
        billing_type: billingType,
        price: parseFloat(price),
        billing_frequency: billingType,
        is_active: isActive
      }
      const url = item ? `/api/services/catalog/${item.id}` : '/api/services/catalog'
      const method = item ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to save service')
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
          <h3>{item ? 'Edit Custom Service' : 'Add Custom PG Service'}</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Service Code *</label>
              <input
                type="text"
                value={serviceCode}
                onChange={e => setServiceCode(e.target.value.toUpperCase())}
                placeholder="e.g. SRV-LAUND"
                disabled={!!item}
                required
              />
            </div>
            <div className="form-group flex-2">
              <label>Service Name *</label>
              <input
                type="text"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. Ironing & Dry Cleaning"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="Laundry">Laundry</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Water">Drinking Water</option>
                <option value="Other">Other Facility</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Billing Frequency *</label>
              <select value={billingType} onChange={e => setBillingType(e.target.value)}>
                <option value="Monthly">Monthly</option>
                <option value="Per Usage">Per Usage</option>
                <option value="One-time">One-time</option>
                <option value="Daily">Daily</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Service Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Turnaround time 24 hours, weekly schedule, item restrictions..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : (item ? 'Update Service' : 'Add to Catalog')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

