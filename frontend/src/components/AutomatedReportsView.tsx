import React, { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Calendar,
  Layers,
  History,
  TrendingUp,
  DollarSign,
  BedDouble,
  CheckCircle2,
  Filter,
  FileSpreadsheet
} from 'lucide-react'
import { ReportHistoryItem } from '../types'

export default function AutomatedReportsView() {
  const [reportType, setReportType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [weekStart, setWeekStart] = useState<string>(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  )
  const [weekEnd, setWeekEnd] = useState<string>(new Date().toISOString().split('T')[0])

  const [generating, setGenerating] = useState(false)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/reports/history', { credentials: 'include' })
      if (res.ok) setHistory(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }

  const generateReport = async () => {
    setGenerating(true)
    setPreviewData(null)
    try {
      const payload: any = { report_type: reportType }
      if (reportType === 'Daily') {
        payload.report_date = selectedDate
      } else if (reportType === 'Weekly') {
        payload.start_date = weekStart
        payload.end_date = weekEnd
      } else if (reportType === 'Monthly') {
        payload.month = selectedMonth
        payload.year = selectedYear
      }

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        setPreviewData(data)
        loadHistory()
        setStatusMsg(`${reportType} Report generated successfully (#${data.report_id}).`)
      } else {
        const err = await res.json()
        setStatusMsg(`Generation failed: ${err.detail || 'Error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const downloadPdf = (reportId: number) => {
    window.open(`/api/reports/${reportId}/pdf`, '_blank')
  }

  const downloadCsv = (reportId: number) => {
    window.open(`/api/reports/${reportId}/csv`, '_blank')
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            EXECUTIVE REPORTING & STATUTORY ARCHIVE
          </p>
          <h1>Automated Operations & Financial Reports</h1>
          <p className="muted">
            Compile operational performance, cash flow summaries, and occupancy metrics into printable PDF reports and CSV datasets.
          </p>
        </div>
      </div>

      {/* Generator Form Panel */}
      <div className="panel margin-bottom-20">
        <h3 className="margin-bottom-12">Compile New Report</h3>

        {/* Type Selector Tabs */}
        <div className="filter-group margin-bottom-16">
          {(['Daily', 'Weekly', 'Monthly'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setReportType(type)
                setPreviewData(null)
              }}
              className={`filter-pill ${reportType === type ? 'active' : ''}`}
            >
              {type} Executive Report
            </button>
          ))}
        </div>

        {/* Dynamic Controls based on report type */}
        <div className="form-grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'flex-end' }}>
          {reportType === 'Daily' && (
            <div>
              <label>Select Audit Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {reportType === 'Weekly' && (
            <>
              <div>
                <label>Cycle Start Date</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={e => setWeekStart(e.target.value)}
                />
              </div>
              <div>
                <label>Cycle End Date</label>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={e => setWeekEnd(e.target.value)}
                />
              </div>
            </>
          )}

          {reportType === 'Monthly' && (
            <>
              <div>
                <label>Billing Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Billing Year</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                />
              </div>
            </>
          )}

          <div>
            <button
              onClick={generateReport}
              disabled={generating}
              className="btn-primary full"
            >
              <FileText size={15} />
              {generating ? 'Compiling Metrics…' : `Generate ${reportType} Report`}
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="notice margin-top-12">
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Report On-Screen Preview */}
      {previewData && (
        <div className="panel margin-bottom-20" style={{ borderTop: '3px solid #2563eb' }}>
          <div className="flex-between align-center margin-bottom-16">
            <div>
              <span className="badge badge-primary margin-bottom-4">
                {previewData.report_type} Report #{previewData.report_id}
              </span>
              <h3 style={{ margin: 0 }}>Executive Ledger Snapshot</h3>
            </div>
            <div className="flex-row gap-8">
              <button
                onClick={() => downloadPdf(previewData.report_id)}
                className="btn-primary btn-sm"
              >
                <Download size={13} /> Download PDF
              </button>
              <button
                onClick={() => downloadCsv(previewData.report_id)}
                className="btn-secondary btn-sm"
              >
                <FileSpreadsheet size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* Quick Metrics from Summary */}
          <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-top"><span>Revenue Realized</span></div>
              <strong className="stat-value text-success font-mono" style={{ fontSize: '18px' }}>
                ₹{(previewData.summary_data.total_revenue || previewData.summary_data.rent_collected || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Total Outflows</span></div>
              <strong className="stat-value text-danger font-mono" style={{ fontSize: '18px' }}>
                ₹{(previewData.summary_data.total_expenses || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Net Operating Cash Flow</span></div>
              <strong className="stat-value text-primary font-mono" style={{ fontSize: '18px' }}>
                ₹{(previewData.summary_data.net_cash_flow || previewData.summary_data.net_operating_income || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Bed Occupancy</span></div>
              <strong className="stat-value font-mono" style={{ fontSize: '18px' }}>
                {previewData.summary_data.occupancy_rate || 0}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Generated Reports History Table */}
      <div className="table-responsive-wrapper">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Generated Report Archive</strong>
          <span className="text-muted text-xs font-mono">{history.length} historical records</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Report Classification</th>
              <th>Period Coverage</th>
              <th>Compiled By</th>
              <th>Records Processed</th>
              <th>Created Timestamp</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-24 text-muted">
                  No compiled reports archived yet.
                </td>
              </tr>
            ) : (
              history.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className="badge badge-primary">{item.report_type}</span>
                  </td>
                  <td className="font-mono text-xs">
                    {item.report_date || `${item.start_date} to ${item.end_date}`}
                  </td>
                  <td>{item.generated_by}</td>
                  <td className="font-mono text-xs">{item.records_count}</td>
                  <td className="text-muted font-mono text-xs">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="text-right">
                    <div className="row-actions">
                      <button
                        onClick={() => downloadPdf(item.id)}
                        className="btn-secondary btn-xs"
                        title="Download printable PDF voucher"
                      >
                        <Download size={11} /> PDF
                      </button>
                      <button
                        onClick={() => downloadCsv(item.id)}
                        className="btn-secondary btn-xs"
                        title="Export tabular CSV data"
                      >
                        <FileSpreadsheet size={11} /> CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
