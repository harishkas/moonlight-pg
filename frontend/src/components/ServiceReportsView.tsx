import React, { useEffect, useState } from 'react'
import {
  FileSpreadsheet,
  Download,
  Calendar,
  FileText,
  Zap,
  Utensils,
  RefreshCw,
  Printer,
  ChevronRight
} from 'lucide-react'
import { Tenant } from '../types'

export default function ServiceReportsView() {
  const [activeTab, setActiveTab] = useState<'revenue' | 'electricity' | 'tenant-statements'>('revenue')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<number | ''>('')
  const [revenueData, setRevenueData] = useState<any>(null)
  const [elecData, setElecData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [tRes, revRes, elecRes] = await Promise.all([
        fetch('/api/tenants', { credentials: 'include' }),
        fetch('/api/services/reports/revenue?year=2026', { credentials: 'include' }),
        fetch('/api/services/reports/electricity', { credentials: 'include' })
      ])
      const t = await tRes.json()
      const rev = await revRes.json()
      const el = await elecRes.json()
      setTenants(t.filter((x: any) => x.status === 'Active'))
      if (t.length > 0 && !selectedTenantId) {
        setSelectedTenantId(t[0].id)
      }
      setRevenueData(rev)
      setElecData(el)
    } catch (e: any) {
      setError(e.message || 'Error loading reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function downloadCsv() {
    window.open('/api/services/reports/export-csv', '_blank')
  }

  function downloadTenantStatement(tId: number) {
    window.open(`/api/services/reports/statement-pdf/${tId}`, '_blank')
  }

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Services & Facilities Intelligence Reports</h2>
          <p className="muted">Detailed monthly analytics, electricity audits, CSV data exports & PDF statements</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="secondary" onClick={downloadCsv}>
            <FileSpreadsheet size={16} /> Export All Charges (CSV)
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Tabs */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          Monthly Service Revenue
        </button>
        <button
          className={`tab-btn ${activeTab === 'electricity' ? 'active' : ''}`}
          onClick={() => setActiveTab('electricity')}
        >
          Electricity Audit & Readings
        </button>
        <button
          className={`tab-btn ${activeTab === 'tenant-statements' ? 'active' : ''}`}
          onClick={() => setActiveTab('tenant-statements')}
        >
          Tenant Facility Statements (PDF)
        </button>
      </div>

      {loading ? (
        <div className="loading">Generating reports…</div>
      ) : (
        <div className="report-content mt-16">
          {/* TAB 1: Monthly Revenue */}
          {activeTab === 'revenue' && revenueData && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Annual Services Revenue Breakdown (2026)</h3>
                  <p className="card-subtitle">Monthly billed vs collected service income</p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Total Billed</th>
                      <th className="text-right">Total Collected</th>
                      <th className="text-right">Pending Balance</th>
                      <th className="text-right">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.monthly_breakdown.map((m: any) => {
                      const rate = m.billed > 0 ? Math.round((m.collected / m.billed) * 100) : 0
                      return (
                        <tr key={m.month_num}>
                          <td><strong>{m.month_name} 2026</strong></td>
                          <td className="text-right font-medium">₹{m.billed.toLocaleString('en-IN')}</td>
                          <td className="text-right text-emerald font-medium">₹{m.collected.toLocaleString('en-IN')}</td>
                          <td className="text-right text-rose font-medium">₹{m.pending.toLocaleString('en-IN')}</td>
                          <td className="text-right">
                            <span className={`status-pill ${rate >= 80 ? 'paid' : (rate > 0 ? 'partially-paid' : 'unpaid')}`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Electricity Consumption Audit */}
          {activeTab === 'electricity' && elecData && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Room-wise Electricity Consumption Audit</h3>
                  <p className="card-subtitle">
                    Period: {elecData.billing_period} · Total Units: {elecData.total_units_consumed} kWh · Total Amount: ₹{elecData.total_electricity_amount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Meter Number</th>
                      <th className="text-right">Previous (kWh)</th>
                      <th className="text-right">Current (kWh)</th>
                      <th className="text-right">Units Consumed</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Total Bill</th>
                      <th>Billing Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elecData.room_readings.map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td><strong>Room {r.room_number}</strong></td>
                        <td className="font-mono text-xs">{r.meter_number}</td>
                        <td className="text-right">{r.previous_reading}</td>
                        <td className="text-right font-medium">{r.current_reading}</td>
                        <td className="text-right font-bold text-primary">{r.units_consumed} kWh</td>
                        <td className="text-right">₹{r.rate_per_unit}</td>
                        <td className="text-right font-bold text-emerald">₹{r.total_amount.toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`status-pill ${r.is_billed ? 'paid' : 'unpaid'}`}>
                            {r.is_billed ? 'Invoiced' : 'Pending Run'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {elecData.room_readings.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-24">
                          No electricity readings found for this billing period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Tenant Service Statement */}
          {activeTab === 'tenant-statements' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Individual Tenant Service Statements (PDF)</h3>
                  <p className="card-subtitle">Generate official itemized statement for a tenant with single-click PDF export</p>
                </div>
              </div>

              <div className="p-16">
                <div className="form-group max-w-400 mb-20">
                  <label>Select Tenant</label>
                  <select
                    value={selectedTenantId}
                    onChange={e => setSelectedTenantId(Number(e.target.value))}
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.tenant_code}) - Room {t.current_allocation?.room_number || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTenantId ? (
                  <div className="statement-action-card p-20 bg-subtle rounded-md flex-row justify-between align-center">
                    <div>
                      <h4 className="font-semibold text-base mb-4">Official Facilities & Services Statement</h4>
                      <p className="text-muted text-xs">
                        Includes all food subscriptions, Wi-Fi packages, parking charges, room AC allocations, and electricity bills.
                      </p>
                    </div>
                    <button
                      className="primary inline-flex align-center gap-6"
                      onClick={() => downloadTenantStatement(Number(selectedTenantId))}
                    >
                      <Download size={15} /> Download PDF Statement
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

