import React, { useState } from 'react'
import { X, Check } from 'lucide-react'
import { FoodPlan } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  plan?: FoodPlan | null
}

export default function FoodPlanModal({ isOpen, onClose, onSave, plan }: Props) {
  const [planCode, setPlanCode] = useState(plan?.plan_code || '')
  const [planName, setPlanName] = useState(plan?.plan_name || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [monthlyPrice, setMonthlyPrice] = useState(plan?.monthly_price?.toString() || '3000')
  const [dailyPrice, setDailyPrice] = useState(plan?.daily_price?.toString() || '100')
  const [includedMeals, setIncludedMeals] = useState(plan?.included_meals || 'Breakfast, Lunch, Dinner')
  const [isActive, setIsActive] = useState(plan?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        plan_code: planCode,
        plan_name: planName,
        description,
        monthly_price: parseFloat(monthlyPrice),
        daily_price: dailyPrice ? parseFloat(dailyPrice) : 0,
        included_meals: includedMeals,
        is_active: isActive
      }

      const url = plan ? `/api/food/plans/${plan.id}` : '/api/food/plans'
      const method = plan ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to save food plan')
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
          <h3>{plan ? 'Edit Food Plan' : 'Create New Food Plan'}</h3>
          <button className="icon-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Plan Code *</label>
              <input
                type="text"
                value={planCode}
                onChange={e => setPlanCode(e.target.value.toUpperCase())}
                placeholder="e.g. FP-FULL"
                disabled={!!plan}
                required
              />
            </div>
            <div className="form-group flex-2">
              <label>Plan Name *</label>
              <input
                type="text"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                placeholder="e.g. Full Day Food"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Monthly Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyPrice}
                onChange={e => setMonthlyPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Daily Price (₹) (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={dailyPrice}
                onChange={e => setDailyPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Included Meals (comma separated) *</label>
            <input
              type="text"
              value={includedMeals}
              onChange={e => setIncludedMeals(e.target.value)}
              placeholder="e.g. Breakfast, Lunch, Dinner"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Details regarding diet options, menu rotation, timings..."
            />
          </div>

          <div className="form-group-checkbox mt-8">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              <span>Plan is Active and available for tenant subscriptions</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : (plan ? 'Update Plan' : 'Create Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

