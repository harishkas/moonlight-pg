import React, { useEffect, useState } from 'react'
import { Plus, Calendar, RefreshCw, Coffee, Sun, Moon, AlertOctagon, UserPlus } from 'lucide-react'
import { MealRecord, DailyMealSummary } from '../types'
import MealRecordModal from './MealRecordModal'

export default function DailyMealManagementView() {
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState<MealRecord[]>([])
  const [summary, setSummary] = useState<DailyMealSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [recsRes, sumRes] = await Promise.all([
        fetch(`/api/food/meals?meal_date=${targetDate}`, { credentials: 'include' }),
        fetch(`/api/food/meals/summary?date=${targetDate}`, { credentials: 'include' })
      ])
      if (!recsRes.ok || !sumRes.ok) throw new Error('Failed to load meal data')
      const recs = await recsRes.json()
      const sum = await sumRes.json()
      setRecords(recs)
      setSummary(sum)
    } catch (e: any) {
      setError(e.message || 'Error loading meal records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [targetDate])

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Daily Meal & Attendance Tracking</h2>
          <p className="muted">Log daily meal headcount, opt-outs, and guest extra meal requests</p>
        </div>
        <div className="flex-row gap-8 align-center">
          <div className="date-picker-inline">
            <Calendar size={15} />
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
            />
          </div>
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Record Meal Entry
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Meal Headcount Overview Cards */}
      {summary && (
        <div className="stats-grid mb-20">
          <div className="stat-card">
            <div className="stat-icon bg-amber"><Coffee size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Breakfast Served</span>
              <strong className="stat-value">{summary.breakfast_count}</strong>
              <span className="stat-trend text-muted">Morning meals</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-emerald"><Sun size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Lunch Served</span>
              <strong className="stat-value">{summary.lunch_count}</strong>
              <span className="stat-trend text-muted">Afternoon meals</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-blue"><Moon size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Dinner Served</span>
              <strong className="stat-value">{summary.dinner_count}</strong>
              <span className="stat-trend text-muted">Evening meals</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-rose"><AlertOctagon size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Opted Out (Skipped)</span>
              <strong className="stat-value">{summary.opted_out_count}</strong>
              <span className="stat-trend text-rose">Advanced notice</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon bg-purple"><UserPlus size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Extra / Guest Requests</span>
              <strong className="stat-value">{summary.additional_requests_count}</strong>
              <span className="stat-trend text-purple">₹{summary.total_extra_charges.toLocaleString('en-IN')} extra</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading meal logs…</div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>Daily Logs for {targetDate}</h3>
            <span className="text-muted text-xs">{records.length} entries recorded</span>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Meal Type</th>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th className="text-right">Extra Charge</th>
                  <th>Remarks</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className={`badge meal-type-badge-${r.meal_type.toLowerCase()}`}>
                        {r.meal_type}
                      </span>
                    </td>
                    <td>{r.tenant_name || <span className="text-muted italic">General / Hostel Bulk</span>}</td>
                    <td>
                      <span className={`status-pill ${r.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-right font-medium">
                      {r.extra_charge > 0 ? `₹${r.extra_charge.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td>{r.remarks || '-'}</td>
                    <td className="text-muted text-xs">{r.recorded_by || 'Admin'}</td>
                  </tr>
                ))}

                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-24">
                      No meal entries logged for this date. Click "Record Meal Entry" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MealRecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={loadData}
      />
    </div>
  )
}

