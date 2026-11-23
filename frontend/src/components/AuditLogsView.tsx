import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  RotateCcw,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { AuditLogItem } from '../types'

export default function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      let url = '/api/audit-logs?limit=100'
      if (startDate) url += `&start_date=${startDate}`
      if (endDate) url += `&end_date=${endDate}`
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) setLogs(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedRow(prev => (prev === id ? null : id))
  }

  const filtered = logs.filter(item => {
    if (actionFilter !== 'all' && item.action.toUpperCase() !== actionFilter.toUpperCase()) return false
    if (entityFilter !== 'all' && item.entity_name !== entityFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        item.action.toLowerCase().includes(q) ||
        item.performed_by.toLowerCase().includes(q) ||
        item.entity_name.toLowerCase().includes(q) ||
        (item.details && item.details.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            COMPLIANCE & IMMUTABLE SECURITY LEDGER
          </p>
          <h1>System Audit Trail & Security Logs</h1>
          <p className="muted">
            Tamper-evident log of administrative operations, authorization decisions, financial updates, and system snapshots.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadLogs} title="Refresh Logs">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Trail
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search action, operator, or record details..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Operations</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="COMPLETE">COMPLETE</option>
            <option value="BACKUP">BACKUP</option>
            <option value="RESTORE">RESTORE</option>
          </select>

          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Target Modules</option>
            <option value="Auth">Auth & Security</option>
            <option value="Tenant">Tenants</option>
            <option value="Room">Rooms</option>
            <option value="BedAllocation">Allocations</option>
            <option value="RentInvoice">Invoices</option>
            <option value="Payment">Payments</option>
            <option value="Deposit">Deposits</option>
            <option value="Expense">Expenses</option>
            <option value="PgTask">Tasks</option>
            <option value="System">System & Storage</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="select-sm"
            style={{ width: '130px' }}
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="select-sm"
            style={{ width: '130px' }}
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="btn-secondary btn-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '32px' }}></th>
              <th>Timestamp</th>
              <th>Action Code</th>
              <th>Entity Target</th>
              <th>Operator</th>
              <th>Host / IP</th>
              <th>Audit Summary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-24 text-muted">
                  Loading immutable audit trail...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-24 text-muted">
                  No matching audit logs found.
                </td>
              </tr>
            ) : (
              filtered.map(item => {
                const isExpanded = expandedRow === item.id
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      onClick={() => toggleExpand(item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ color: 'var(--text-muted)' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="font-mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            ['CREATE', 'COMPLETE', 'LOGIN'].includes(item.action)
                              ? 'badge-active'
                              : ['DELETE', 'LOGOUT', 'RESTORE'].includes(item.action)
                              ? 'badge-vacated'
                              : 'badge-primary'
                          }`}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td><strong>{item.entity_name}</strong></td>
                      <td>{item.performed_by}</td>
                      <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {item.ip_address || '127.0.0.1'}
                      </td>
                      <td style={{ maxWidth: '380px' }} className="truncate" title={item.details || ''}>
                        {item.details || '-'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan={7} style={{ padding: '12px 18px 16px 42px' }}>
                          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                            <span className="eyebrow" style={{ marginBottom: '4px' }}>
                              Extended Audit Telemetry
                            </span>
                            <pre className="font-mono" style={{ margin: 0, fontSize: '11.5px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                              {item.details || 'No additional payload captured.'}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
