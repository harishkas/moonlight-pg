import React, { useEffect, useState } from 'react'
import {
  Utensils,
  Coffee,
  Car,
  Zap,
  FileCheck2,
  AlertCircle,
  Plus,
  RefreshCw,
  ArrowRight
} from 'lucide-react'
import { ServicesDashboardData } from '../types'

interface Props {
  onNavigate: (viewId: any) => void
  onGenerateBilling?: () => void
  isClient?: boolean
}

export default function ServicesDashboardView({ onNavigate, onGenerateBilling, isClient = false }: Props) {
  const [data, setData] = useState<ServicesDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/services/dashboard', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load services dashboard')
      const d = await res.json()
      setData(d)
    } catch (e: any) {
      setError(e.message || 'Error loading dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading && !data) {
    return <div className="loading">Loading services dashboard…</div>
  }

  return (
    <div className="view-container">
      {/* Top Welcome & Actions Header */}
      <div className="welcome-row">
        <div>
          <h2>Food, Parking & Electricity Dashboard</h2>
          <p className="muted">Monitoring active meal plans, food subscriptions, vehicle parking, and electricity sub-meters</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} /> Refresh
          </button>
          {!isClient && onGenerateBilling && (
            <button className="primary" onClick={onGenerateBilling}>
              <FileCheck2 size={16} /> Run Monthly Service Billing
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          {/* Key Metric Highlights Grid: ONLY Food Planning, Food Subs, Parking, Electricity */}
          <div className="stats-grid">
            <div className="stat-card cursor-pointer" onClick={() => onNavigate('food-plans')}>
              <div className="stat-icon bg-emerald"><Utensils size={20} /></div>
              <div className="stat-content">
                <span className="stat-label">Food Planning</span>
                <strong className="stat-value">Meal Plans</strong>
                <span className="stat-trend text-emerald">Breakfast, Lunch & Dinner</span>
              </div>
            </div>

            <div className="stat-card cursor-pointer" onClick={() => onNavigate('food-subs')}>
              <div className="stat-icon bg-emerald"><Coffee size={20} /></div>
              <div className="stat-content">
                <span className="stat-label">Food Subscriptions</span>
                <strong className="stat-value">{data.active_food_subscribers} Active</strong>
                <span className="stat-trend text-emerald">₹{data.monthly_food_revenue.toLocaleString('en-IN')}/mo volume</span>
              </div>
            </div>

            <div className="stat-card cursor-pointer" onClick={() => onNavigate('parking')}>
              <div className="stat-icon bg-purple"><Car size={20} /></div>
              <div className="stat-content">
                <span className="stat-label">Parking Management</span>
                <strong className="stat-value">{data.active_parking_allocations} Slots</strong>
                <span className="stat-trend text-purple">2-Wheeler & 4-Wheeler Bays</span>
              </div>
            </div>

            <div className="stat-card cursor-pointer" onClick={() => onNavigate('electricity')}>
              <div className="stat-icon bg-amber"><Zap size={20} /></div>
              <div className="stat-content">
                <span className="stat-label">Electricity & Meters</span>
                <strong className="stat-value">₹{data.monthly_electricity_charges.toLocaleString('en-IN')}</strong>
                <span className="stat-trend text-amber">Digital sub-meters active</span>
              </div>
            </div>
          </div>

          {/* Financial Summary & Integration Cards */}
          <div className="card-grid-2 mt-20">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Centralized Services Financials</h3>
                  <p className="card-subtitle">Itemized service revenue linked to Phase 3 accounting</p>
                </div>
                <button className="btn-sm secondary" onClick={() => onNavigate('service-billing')}>
                  View Ledger <ArrowRight size={13} />
                </button>
              </div>

              <div className="summary-boxes-grid mt-12">
                <div className="summary-box">
                  <span className="text-muted text-xs">Total Services Billed</span>
                  <div className="font-bold text-lg text-primary">₹{data.total_service_charges_generated.toLocaleString('en-IN')}</div>
                </div>
                <div className="summary-box">
                  <span className="text-muted text-xs">Service Revenue Collected</span>
                  <div className="font-bold text-lg text-emerald">₹{data.total_service_payments_collected.toLocaleString('en-IN')}</div>
                </div>
                <div className="summary-box">
                  <span className="text-muted text-xs">Pending Outstanding</span>
                  <div className="font-bold text-lg text-rose">₹{data.pending_service_charges.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-16">
                <div className="flex-row justify-between text-xs mb-4">
                  <span>Collection Efficiency</span>
                  <span className="font-bold">
                    {data.total_service_charges_generated > 0
                      ? Math.round((data.total_service_payments_collected / data.total_service_charges_generated) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill bg-emerald"
                    style={{
                      width: `${data.total_service_charges_generated > 0
                        ? Math.min(100, Math.round((data.total_service_payments_collected / data.total_service_charges_generated) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Category Revenue Breakdown</h3>
                  <p className="card-subtitle">Performance by service category</p>
                </div>
              </div>

              <table className="table mt-12">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Billed</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {data.category_breakdown
                    .filter(cat => ['Food', 'Parking', 'Electricity'].includes(cat.category))
                    .map(cat => (
                      <tr key={cat.category}>
                        <td>
                          <span className={`badge category-badge-${cat.category.toLowerCase()}`}>
                            {cat.category}
                          </span>
                        </td>
                        <td className="text-right font-medium">₹{cat.total_billed.toLocaleString('en-IN')}</td>
                        <td className="text-right text-emerald font-medium">₹{cat.total_collected.toLocaleString('en-IN')}</td>
                        <td className="text-right text-rose font-medium">₹{cat.pending_amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  {data.category_breakdown.filter(cat => ['Food', 'Parking', 'Electricity'].includes(cat.category)).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">No service charges generated yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

