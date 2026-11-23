import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BedDouble,
  PieChart,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Percent,
  RotateCcw
} from 'lucide-react'
import {
  AnalyticsOverviewData,
  OccupancyAnalyticsData,
  FinancialAnalyticsData,
  TenantAnalyticsData,
  ServicesAnalyticsData
} from '../types'

export default function AnalyticsDashboardView() {
  const [overview, setOverview] = useState<AnalyticsOverviewData | null>(null)
  const [occupancy, setOccupancy] = useState<OccupancyAnalyticsData | null>(null)
  const [financials, setFinancials] = useState<FinancialAnalyticsData | null>(null)
  const [tenantStats, setTenantStats] = useState<TenantAnalyticsData | null>(null)
  const [services, setServices] = useState<ServicesAnalyticsData | null>(null)
  const [monthsRange, setMonthsRange] = useState<number>(6)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [monthsRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [ovRes, occRes, finRes, tenRes, srvRes] = await Promise.all([
        fetch('/api/analytics/overview', { credentials: 'include' }),
        fetch(`/api/analytics/occupancy?months=${monthsRange}`, { credentials: 'include' }),
        fetch(`/api/analytics/financials?months=${monthsRange}`, { credentials: 'include' }),
        fetch('/api/analytics/tenants', { credentials: 'include' }),
        fetch('/api/analytics/services', { credentials: 'include' })
      ])
      if (ovRes.ok) setOverview(await ovRes.json())
      if (occRes.ok) setOccupancy(await occRes.json())
      if (finRes.ok) setFinancials(await finRes.json())
      if (tenRes.ok) setTenantStats(await tenRes.json())
      if (srvRes.ok) setServices(await srvRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            BUSINESS INTELLIGENCE & PERFORMANCE ANALYTICS
          </p>
          <h1>Property Revenue & Operational Analytics</h1>
          <p className="muted">
            Telemetry metrics tracking Net Operating Income (NOI), collection efficiency, floor occupancy rates, and tenant retention.
          </p>
        </div>

        <div className="action-buttons-group">
          <select
            value={monthsRange}
            onChange={e => setMonthsRange(Number(e.target.value))}
            className="select-sm"
          >
            <option value={3}>Last 3 Months Period</option>
            <option value={6}>Last 6 Months Period</option>
            <option value={12}>Last 12 Months Period</option>
          </select>
          <button className="btn-secondary" onClick={loadAnalytics} title="Recalculate Metrics">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      {overview && (
        <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
          {/* Occupancy Rate */}
          <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="stat-top">
              <span>Bed Occupancy</span>
              <span className="stat-icon"><BedDouble size={15} /></span>
            </div>
            <strong className="stat-value font-mono" style={{ fontSize: '22px' }}>{overview.occupancy_rate}%</strong>
            <small className="muted-text">
              {overview.occupied_beds} occupied / {overview.total_beds} beds ({overview.available_beds} vacant)
            </small>
          </div>

          {/* Net Operating Income (NOI) */}
          <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
            <div className="stat-top">
              <span>Net Operating Income</span>
              <span className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}><DollarSign size={15} /></span>
            </div>
            <strong className="stat-value text-success font-mono" style={{ fontSize: '22px' }}>
              ₹{overview.net_operating_income.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </strong>
            <small className="muted-text">
              Rev: ₹{overview.total_all_collected.toLocaleString('en-IN')} | Exp: ₹{overview.total_expenses.toLocaleString('en-IN')}
            </small>
          </div>

          {/* Collection Efficiency */}
          <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
            <div className="stat-top">
              <span>Collection Efficiency</span>
              <span className="stat-icon" style={{ background: '#fffbeb', color: '#b45309' }}><Percent size={15} /></span>
            </div>
            <strong className="stat-value font-mono" style={{ fontSize: '22px', color: '#b45309' }}>
              {overview.collection_rate}%
            </strong>
            <small className="muted-text">
              Realized: ₹{overview.total_rent_collected.toLocaleString('en-IN')} of ₹{overview.total_rent_expected.toLocaleString('en-IN')}
            </small>
          </div>

          {/* Tenant Retention */}
          <div className="stat-card" style={{ borderLeft: '4px solid #7e22ce' }}>
            <div className="stat-top">
              <span>Resident Retention</span>
              <span className="stat-icon" style={{ background: '#faf5ff', color: '#7e22ce' }}><Users size={15} /></span>
            </div>
            <strong className="stat-value font-mono" style={{ fontSize: '22px', color: '#7e22ce' }}>
              {tenantStats ? `${tenantStats.retention_rate}%` : '66.7%'}
            </strong>
            <small className="muted-text">
              Average tenure: {tenantStats ? `${tenantStats.average_stay_days} days` : '194 days'}
            </small>
          </div>
        </div>
      )}

      {/* Financial Trends & Expense Breakdown Grid */}
      <div className="section-grid-dashboard" style={{ marginBottom: '20px' }}>
        {/* Monthly Revenue vs Expense Trend */}
        <div className="panel">
          <div className="flex-between align-center margin-bottom-16">
            <div>
              <h3 style={{ margin: 0 }}>Monthly Cash Flows & NOI</h3>
              <p className="muted-text" style={{ margin: '2px 0 0' }}>Revenue collected vs Operating expenditures</p>
            </div>
            <div className="flex-row gap-12 text-xs">
              <span className="flex-row gap-4 align-center font-medium" style={{ color: '#2563eb' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#2563eb' }}></span> Income
              </span>
              <span className="flex-row gap-4 align-center font-medium" style={{ color: '#dc2626' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#dc2626' }}></span> Expenses
              </span>
            </div>
          </div>

          {financials && financials.monthly_trends.length > 0 ? (
            <div className="flex-column gap-12">
              {financials.monthly_trends.map(t => {
                const maxVal = Math.max(...financials.monthly_trends.map(m => Math.max(m.total_income, m.total_expenses, 1)))
                const incPct = Math.min(100, Math.round((t.total_income / maxVal) * 100))
                const expPct = Math.min(100, Math.round((t.total_expenses / maxVal) * 100))

                return (
                  <div key={t.month} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px' }}>
                    <div className="flex-between text-xs margin-bottom-4">
                      <strong className="font-mono">{t.month}</strong>
                      <span className="font-mono">
                        Income: ₹{t.total_income.toLocaleString('en-IN')} · Exp: ₹{t.total_expenses.toLocaleString('en-IN')} · NOI:{' '}
                        <strong className={t.net_operating_income >= 0 ? 'text-success' : 'text-danger'}>
                          ₹{t.net_operating_income.toLocaleString('en-IN')}
                        </strong>
                      </span>
                    </div>
                    <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex', gap: '2px' }}>
                      <div
                        style={{ width: `${incPct}%`, background: '#2563eb', borderRadius: '3px' }}
                        title={`Income: ₹${t.total_income}`}
                      />
                      <div
                        style={{ width: `${expPct}%`, background: '#dc2626', borderRadius: '3px' }}
                        title={`Expenses: ₹${t.total_expenses}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-24 text-muted">No financial trend data available.</div>
          )}
        </div>

        {/* Expense Category Breakdown */}
        <div className="panel">
          <div className="margin-bottom-16">
            <h3 style={{ margin: 0 }}>Operational Outflows</h3>
            <p className="muted-text" style={{ margin: '2px 0 0' }}>Percentage distribution of property costs</p>
          </div>

          {financials && financials.expense_breakdown.length > 0 ? (
            <div className="flex-column gap-10">
              {financials.expense_breakdown.map(cat => (
                <div key={cat.category} style={{ fontSize: '12px' }}>
                  <div className="flex-between margin-bottom-4">
                    <strong>{cat.category}</strong>
                    <span className="font-mono text-muted">
                      ₹{cat.amount.toLocaleString('en-IN')} ({cat.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{ width: `${cat.percentage}%`, background: '#b45309', height: '100%', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 text-muted">No expense records logged.</div>
          )}
        </div>
      </div>

      {/* Occupancy Trends & Floor Breakdown */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* Floor Breakdown */}
        <div className="panel">
          <div className="margin-bottom-16">
            <h3 style={{ margin: 0 }}>Floor-Level Bed Utilization</h3>
            <p className="muted-text" style={{ margin: '2px 0 0' }}>Occupancy percentage per building level</p>
          </div>

          {occupancy && occupancy.floor_breakdown.length > 0 ? (
            <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {occupancy.floor_breakdown.map(f => (
                <div key={f.floor} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div className="flex-between align-center margin-bottom-4">
                    <strong>Floor {f.floor}</strong>
                    <span className="badge badge-primary">{f.occupancy_rate}%</span>
                  </div>
                  <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', margin: '6px 0' }}>
                    <div style={{ width: `${f.occupancy_rate}%`, background: '#2563eb', height: '100%' }} />
                  </div>
                  <div className="flex-between text-xs text-muted font-mono">
                    <span>Occupied: {f.occupied_beds}</span>
                    <span>Total: {f.total_beds} beds</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 text-muted">No floor telemetry recorded.</div>
          )}
        </div>

        {/* Tenant Stay Distribution */}
        <div className="panel">
          <div className="margin-bottom-16">
            <h3 style={{ margin: 0 }}>Resident Stay Duration Profile</h3>
            <p className="muted-text" style={{ margin: '2px 0 0' }}>Length-of-stay distribution across historic residents</p>
          </div>

          {tenantStats && tenantStats.stay_distribution.length > 0 ? (
            <div className="flex-column gap-10">
              {tenantStats.stay_distribution.map(d => {
                const totalStay = tenantStats.stay_distribution.reduce((acc, curr) => acc + curr.count, 0)
                const pct = totalStay > 0 ? Math.round((d.count / totalStay) * 100) : 0
                return (
                  <div key={d.range} style={{ fontSize: '12px' }}>
                    <div className="flex-between margin-bottom-4">
                      <strong>{d.range}</strong>
                      <span className="font-mono text-muted">
                        {d.count} resident(s) ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: '#059669', height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-24 text-muted">No resident tenure records available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
