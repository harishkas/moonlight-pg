import React, { useEffect, useState } from 'react'
import { Plus, Edit2, CheckCircle2, XCircle, Search, RefreshCw, Utensils } from 'lucide-react'
import { FoodPlan } from '../types'
import FoodPlanModal from './FoodPlanModal'

interface Props {
  isClient?: boolean
}

export default function FoodPlansView({ isClient = false }: Props) {
  const [plans, setPlans] = useState<FoodPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<FoodPlan | null>(null)

  async function loadPlans() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/food/plans', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load food plans')
      const data = await res.json()
      setPlans(data)
    } catch (e: any) {
      setError(e.message || 'Error loading food plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const filtered = plans.filter(p =>
    p.plan_name.toLowerCase().includes(search.toLowerCase()) ||
    p.plan_code.toLowerCase().includes(search.toLowerCase()) ||
    p.included_meals.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Food Subscription Plans</h2>
          <p className="muted">Configure meal packages, included meal sets, daily rates, and pricing</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadPlans} title="Refresh">
            <RefreshCw size={15} />
          </button>
          {!isClient && (
            <button className="primary" onClick={() => { setEditingPlan(null); setModalOpen(true) }}>
              <Plus size={16} /> Create Food Plan
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filter-bar">
        <div className="search-box flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search plans by name, code or meals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading plans…</div>
      ) : (
        <div className="plans-grid mt-16">
          {filtered.map(p => (
            <div key={p.id} className={`plan-card ${!p.is_active ? 'inactive' : ''}`}>
              <div className="plan-card-header">
                <span className="badge plan-code-badge">{p.plan_code}</span>
                <span className={`status-pill ${p.is_active ? 'active' : 'inactive'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <h3 className="plan-name">{p.plan_name}</h3>
              <p className="plan-desc">{p.description || 'Standard wholesome PG dining package.'}</p>

              <div className="plan-meals-box">
                <div className="text-xs text-muted mb-2 font-medium flex-row align-center gap-4">
                  <Utensils size={13} /> Included Meals:
                </div>
                <div className="plan-meals-tag-list">
                  {p.included_meals.split(',').map((m, idx) => (
                    <span key={idx} className="meal-tag">{m.trim()}</span>
                  ))}
                </div>
              </div>

              <div className="plan-pricing">
                <div className="price-primary">
                  ₹{p.monthly_price.toLocaleString('en-IN')}<span className="price-period">/month</span>
                </div>
                {p.daily_price ? (
                  <div className="price-secondary text-muted text-xs">
                    ₹{p.daily_price.toLocaleString('en-IN')}/day prorate
                  </div>
                ) : null}
              </div>

              <div className="plan-card-footer">
                <div className="subscriber-count">
                  <strong>{p.active_subscriptions_count}</strong> active tenants
                </div>
                {!isClient && (
                  <button
                    className="btn-sm secondary"
                    onClick={() => { setEditingPlan(p); setModalOpen(true) }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-card flex-1">
              <p>No food plans match your criteria.</p>
            </div>
          )}
        </div>
      )}

      <FoodPlanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={loadPlans}
        plan={editingPlan}
      />
    </div>
  )
}

