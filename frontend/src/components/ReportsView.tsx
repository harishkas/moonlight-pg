import { useEffect, useState } from 'react'
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Users,
  TrendingDown,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { MonthlyCollectionReportItem, TenantOutstandingReportItem } from '../types'

export default function ReportsView() {
  const [reportType, setReportType] = useState<'collection' | 'outstanding'>('collection')
  const [year, setYear] = useState<number>(new Date().getFullYear())

  const [collectionData, setCollectionData] = useState<MonthlyCollectionReportItem[]>([])
  const [outstandingData, setOutstandingData] = useState<TenantOutstandingReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadReport() {
    setLoading(true)
    setError('')
    try {
      if (reportType === 'collection') {
        const res = await fetch(`/api/reports/monthly-collection?year=${year}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load collection report')
        const data = await res.json()
        setCollectionData(data)
      } else {
        const res = await fetch('/api/reports/tenant-outstanding', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load outstanding balance report')
        const data = await res.json()
        setOutstandingData(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [reportType, year])

  function exportCSV() {
    let csvContent = 'data:text/csv;charset=utf-8,'
    if (reportType === 'collection') {
      csvContent += 'Month,Year,Expected Rent (INR),Collected Rent (INR),Pending Rent (INR),Collection Rate (%)\r\n'
      collectionData.forEach(row => {
        csvContent += `"${row.month_name}",${row.year},${row.expected_rent},${row.collected_rent},${row.pending_rent},${row.collection_rate}%\r\n`
      })
    } else {
      csvContent += 'Tenant Code,Full Name,Mobile,Room Number,Bed Number,Status,Pending Invoices,Total Outstanding (INR)\r\n'
      outstandingData.forEach(row => {
        csvContent += `"${row.tenant_code}","${row.tenant_name}","${row.mobile}","${row.room_number}","${row.bed_number}","${row.status}",${row.pending_invoices_count},${row.total_outstanding_amount}\r\n`
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `moonlight_pg_${reportType}_report_${year}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">EXECUTIVE STATEMENTS & AUDIT EXPORTS</p>
          <h1>Financial Reports & Analytics</h1>
          <p className="muted">Generate monthly collection statements, tenant outstanding ledgers, and exportable CSV files.</p>
        </div>
        <button className="btn-secondary" onClick={exportCSV}>
          <Download size={15} /> Export Report (CSV)
        </button>
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="filters-bar">
        <div className="filter-group">
          <button
            className={`filter-pill ${reportType === 'collection' ? 'active' : ''}`}
            onClick={() => setReportType('collection')}
          >
            <Calendar size={13} style={{ marginRight: '4px' }} />
            Monthly Rent Collection Statement
          </button>
          <button
            className={`filter-pill ${reportType === 'outstanding' ? 'active' : ''}`}
            onClick={() => setReportType('outstanding')}
          >
            <Users size={13} style={{ marginRight: '4px' }} />
            Tenant Outstanding Balances
          </button>
        </div>

        {reportType === 'collection' && (
          <div className="filter-group margin-left-auto">
            <span className="filter-label">Year:</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="select-sm">
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Report Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Compiling financial report...</div>
        ) : reportType === 'collection' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Expected Rent</th>
                <th>Collected Rent</th>
                <th>Pending Rent</th>
                <th>Collection Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {collectionData.map(row => (
                <tr key={row.month_num}>
                  <td>
                    <strong>{row.month_name} {row.year}</strong>
                  </td>
                  <td>₹{row.expected_rent.toLocaleString('en-IN')}</td>
                  <td className="text-success font-weight-bold">
                    ₹{row.collected_rent.toLocaleString('en-IN')}
                  </td>
                  <td className="text-danger font-weight-bold">
                    ₹{row.pending_rent.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <div className="flex-row gap-8 align-center">
                      <div className="expense-track" style={{ width: '80px', height: '6px' }}>
                        <div
                          className="expense-fill"
                          style={{
                            width: `${Math.min(100, row.collection_rate)}%`,
                            backgroundColor: row.collection_rate >= 80 ? 'var(--success)' : row.collection_rate > 0 ? '#f59e0b' : '#cbd5e1'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>
                        {row.collection_rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Resident ID</th>
                <th>Full Name</th>
                <th>Contact</th>
                <th>Room & Bed</th>
                <th>Resident Status</th>
                <th>Unpaid Invoices</th>
                <th>Total Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {outstandingData.map(row => (
                <tr key={row.tenant_id}>
                  <td>
                    <span className="badge badge-code">{row.tenant_code}</span>
                  </td>
                  <td>
                    <strong>{row.tenant_name}</strong>
                  </td>
                  <td>{row.mobile}</td>
                  <td>
                    <span className="allocated-pill-cell">
                      Room {row.room_number} · {row.bed_number}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <strong>{row.pending_invoices_count}</strong>
                  </td>
                  <td>
                    <strong style={{ fontSize: '14px', color: 'var(--danger)' }}>
                      ₹{row.total_outstanding_amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

