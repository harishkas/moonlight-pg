import React, { useEffect, useState } from 'react'
import { Plus, Zap, Search, Filter, RefreshCw, BarChart2, AlertCircle } from 'lucide-react'
import { ElectricityMeter, ElectricityReading } from '../types'
import ElectricityMeterModal from './ElectricityMeterModal'
import ElectricityReadingModal from './ElectricityReadingModal'

interface Props {
  isClient?: boolean
}

export default function ElectricityManagementView({ isClient = false }: Props) {
  const [meters, setMeters] = useState<ElectricityMeter[]>([])
  const [readings, setReadings] = useState<ElectricityReading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meterModalOpen, setMeterModalOpen] = useState(false)
  const [readingModalOpen, setReadingModalOpen] = useState(false)
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [mtrRes, rdRes] = await Promise.all([
        fetch('/api/electricity/meters', { credentials: 'include' }),
        fetch('/api/electricity/readings', { credentials: 'include' })
      ])
      if (!mtrRes.ok || !rdRes.ok) throw new Error('Failed to load electricity records')
      const mtrData = await mtrRes.json()
      const rdData = await rdRes.json()
      setMeters(mtrData)
      setReadings(rdData)
    } catch (e: any) {
      setError(e.message || 'Error loading electricity data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalUnits = readings.reduce((acc, r) => acc + r.units_consumed, 0)
  const totalAmount = readings.reduce((acc, r) => acc + r.total_amount, 0)

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Electricity & Sub-Meter Management</h2>
          <p className="muted">Track room-wise digital sub-meter readings, calculate consumption, and divide shared costs</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          {!isClient && (
            <>
              <button className="secondary" onClick={() => setMeterModalOpen(true)}>
                <Plus size={16} /> Register Meter
              </button>
              <button className="primary" onClick={() => { setSelectedMeterId(null); setReadingModalOpen(true) }}>
                <Zap size={16} /> Record Reading
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* KPI Overview */}
      <div className="stats-grid mb-20">
        <div className="stat-card">
          <div className="stat-icon bg-amber"><Zap size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Installed Sub-Meters</span>
            <strong className="stat-value">{meters.length}</strong>
            <span className="stat-trend text-muted">Digital meters</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-blue"><BarChart2 size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Units Logged</span>
            <strong className="stat-value">{totalUnits.toFixed(1)} kWh</strong>
            <span className="stat-trend text-blue">Cumulative consumption</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-emerald"><Zap size={20} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Electricity Amount</span>
            <strong className="stat-value">₹{totalAmount.toLocaleString('en-IN')}</strong>
            <span className="stat-trend text-emerald">At ₹10/unit standard</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading meters and readings…</div>
      ) : (
        <>
          {/* Registered Sub-Meters Grid */}
          <h3 className="section-title mb-12">Registered Room Sub-Meters</h3>
          <div className="meters-grid mb-24">
            {meters.map(m => (
              <div key={m.id} className="meter-card">
                <div className="flex-row justify-between align-center mb-6">
                  <span className="meter-id-badge">{m.meter_number}</span>
                  <span className="badge category-badge-electricity">Room {m.room_number}</span>
                </div>

                <div className="meter-reading-box">
                  <div className="text-xs text-muted">Latest Reading</div>
                  <div className="meter-kwh-display">
                    {m.latest_reading !== null ? m.latest_reading : '0.0'} <span className="text-xs font-normal">kWh</span>
                  </div>
                </div>

                <div className="text-xs text-muted mt-8">
                  Rate: <strong>₹{m.rate_per_unit}/kWh</strong> · {m.billing_method}
                </div>

                <div className="card-actions-row mt-12">
                  <button
                    className="btn-sm primary full"
                    onClick={() => { setSelectedMeterId(m.id); setReadingModalOpen(true) }}
                  >
                    Record Reading
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Consumption History Table */}
          <h3 className="section-title mb-12">Meter Reading History</h3>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Reading #</th>
                  <th>Room</th>
                  <th>Meter #</th>
                  <th>Billing Period</th>
                  <th className="text-right">Prev (kWh)</th>
                  <th className="text-right">Current (kWh)</th>
                  <th className="text-right">Units Consumed</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Total Charge</th>
                  <th>Billed Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.map(rd => (
                  <tr key={rd.id}>
                    <td className="font-mono text-xs">{rd.reading_number}</td>
                    <td><strong>Room {rd.room_number}</strong></td>
                    <td className="font-mono text-xs">{rd.meter_number}</td>
                    <td>{rd.billing_month}/{rd.billing_year}</td>
                    <td className="text-right">{rd.previous_reading}</td>
                    <td className="text-right font-medium">{rd.current_reading}</td>
                    <td className="text-right text-primary font-bold">{rd.units_consumed} kWh</td>
                    <td className="text-right">₹{rd.rate_per_unit}</td>
                    <td className="text-right font-bold text-emerald">₹{rd.total_amount.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`status-pill ${rd.is_billed ? 'paid' : 'unpaid'}`}>
                        {rd.is_billed ? 'Billed to Invoices' : 'Pending Billing Run'}
                      </span>
                    </td>
                  </tr>
                ))}

                {readings.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-24">
                      No electricity readings recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ElectricityMeterModal
        isOpen={meterModalOpen}
        onClose={() => setMeterModalOpen(false)}
        onSave={loadData}
      />

      <ElectricityReadingModal
        isOpen={readingModalOpen}
        onClose={() => setReadingModalOpen(false)}
        onSave={loadData}
        initialMeterId={selectedMeterId}
      />
    </div>
  )
}

