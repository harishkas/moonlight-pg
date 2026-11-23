import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Tenant, FoodPlan, FoodSubscription } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  subscription?: FoodSubscription | null
}

export default function FoodSubscriptionModal({ isOpen, onClose, onSave, subscription }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<FoodPlan[]>([])
  const [tenantId, setTenantId] = useState<number | ''>(subscription?.tenant_id || '')
  const [planId, setPlanId] = useState<number | ''>(subscription?.plan_id || '')
  const [startDate, setStartDate] = useState(subscription?.start_date || new Date().toISOString().slice(0, 10))
  const [monthlyPrice, setMonthlyPrice] = useState(subscription?.monthly_price?.toString() || '')
  const [status, setStatus] = useState(subscription?.status || 'Active')
  const [billingFrequency, setBillingFrequency] = useState(subscription?.billing_frequency || 'Monthly')
  const [remarks, setRemarks] = useState(subscription?.remarks || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Load active tenants & food plans
      fetch('/api/tenants', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setTenants(data.filter((t: any) => t.status === 'Active')))
        .catch(console.error)

      fetch('/api/food/plans', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setPlans(data.filter((p: any) => p.is_active))
          if (!subscription && data.length > 0 && !planId) {
            setPlanId(data[0].id)
            setMonthlyPrice(data[0].monthly_price.toString())
          }
        })
        .catch(console.error)
    }
  }, [isOpen])

  function handlePlanChange(id: number) {
    setPlanId(id)
    const p = plans.find(x => x.id === id)
    if (p) setMonthlyPrice(p.monthly_price.toString())
  }

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !planId) {
      setError('Please select both tenant and food plan.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (subscription) {
        // Edit / Update
        const payload = {
          plan_id: planId,
          status,
          monthly_price: parseFloat(monthlyPrice),
          remarks
        }
        const res = await fetch(`/api/food/subscriptions/${subscription.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Failed to update subscription')
        }
      } else {
        // Create
        const payload = {
          tenant_id: tenantId,
          plan_id: planId,
          start_date: startDate,
          monthly_price: parseFloat(monthlyPrice),
          billing_frequency: billingFrequency,
          prorate_first_month: true,
          remarks
        }
        const res = await fetch('/api/food/subscriptions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Failed to subscribe tenant')
        }
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
          <h3>{subscription ? 'Manage Food Subscription' : 'Subscribe Tenant to Food Plan'}</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select Tenant *</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(Number(e.target.value))}
              disabled={!!subscription}
              required
            >
              <option value="">-- Choose active tenant --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.tenant_code}) - Room {t.current_allocation?.room_number || 'Unallocated'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Select Food Plan *</label>
              <select
                value={planId}
                onChange={e => handlePlanChange(Number(e.target.value))}
                required
              >
                <option value="">-- Choose plan --</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plan_name} (₹{p.monthly_price.toLocaleString('en-IN')}/mo)
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
                value={monthlyPrice}
                onChange={e => setMonthlyPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={!!subscription}
                required
              />
            </div>
            {subscription && (
              <div className="form-group flex-1">
                <label>Status *</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)}>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Remarks / Dietary Preferences</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Vegetarian preference, allergies, etc."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : (subscription ? 'Save Changes' : 'Activate Subscription')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

