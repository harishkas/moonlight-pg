import React, { useState } from 'react'
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Layers,
  ArrowRight
} from 'lucide-react'
import { DataImportPreviewData } from '../types'

const EXPORT_ENTITIES = [
  { id: 'tenants', name: 'Tenants & Residents', desc: 'Personal, contact, KYC & admission history' },
  { id: 'rooms', name: 'Rooms & Bed Types', desc: 'Room configurations, floor levels & AC specs' },
  { id: 'beds', name: 'Beds Inventory', desc: 'Individual bed numbers, prices & occupancy status' },
  { id: 'allocations', name: 'Bed Allocations', desc: 'Active & past resident bed assignments' },
  { id: 'invoices', name: 'Rent Invoices', desc: 'Monthly rent invoices, adjustments & payment status' },
  { id: 'payments', name: 'Payments Collected', desc: 'Payment receipts, modes, UPI refs & timestamps' },
  { id: 'deposits', name: 'Security Deposits', desc: 'Deposit balances, refunds & rent adjustments' },
  { id: 'expenses', name: 'PG Operating Expenses', desc: 'Groceries, utilities, repairs & salary expenditures' },
  { id: 'tasks', name: 'Operations Tasks', desc: 'Internal PG operational tasks & completion notes' },
  { id: 'audit_logs', name: 'Audit Trail', desc: 'Immutable security & administrative activity records' }
]

interface Props {
  isClient?: boolean
}

export default function DataImportExportView({ isClient }: Props = {}) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')

  // Import State
  const [importEntity, setImportEntity] = useState('tenants')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [validating, setValidating] = useState(false)
  const [preview, setPreview] = useState<DataImportPreviewData | null>(null)
  const [importing, setImporting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const handleExport = (entity: string, format: 'csv' | 'json') => {
    window.open(`/api/data-export/${entity}?format=${format}`, '_blank')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setPreview(null)
      const reader = new FileReader()
      reader.onload = event => {
        setFileContent((event.target?.result as string) || '')
      }
      reader.readAsText(file)
    }
  }

  const handleValidate = async () => {
    if (!selectedFile || !fileContent) return
    setValidating(true)
    setPreview(null)
    setStatusMsg('')
    try {
      const res = await fetch('/api/data-import/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: importEntity,
          filename: selectedFile.name,
          content_text: fileContent
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      } else {
        const err = await res.json()
        setStatusMsg(`Validation failed: ${err.detail || 'Error parsing file'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setValidating(false)
    }
  }

  const handleCommitImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const res = await fetch('/api/data-import/commit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: importEntity,
          filename: preview.filename,
          rows: preview.preview_rows
        })
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Import Successful! ${data.imported_count} records imported.`)
        setPreview(null)
        setSelectedFile(null)
        setFileContent('')
      } else {
        const err = await res.json()
        setStatusMsg(`Import error: ${err.detail || 'Commit failed'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            ENTERPRISE INTEROPERABILITY & BULK DATA TRANSIT
          </p>
          <h1>Data Export & Migration Manager</h1>
          <p className="muted">
            Export structured property registries into CSV and JSON, or validate schema compliance and bulk import resident data.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="modal-tabs">
        <button
          onClick={() => setActiveTab('export')}
          className={`tab-btn flex-row gap-6 align-center ${activeTab === 'export' ? 'active' : ''}`}
        >
          <Download size={15} /> Export Registry (CSV / JSON)
        </button>
        {!isClient && (
          <button
            onClick={() => setActiveTab('import')}
            className={`tab-btn flex-row gap-6 align-center ${activeTab === 'import' ? 'active' : ''}`}
          >
            <Upload size={15} /> Schema-Validated Import
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="notice margin-bottom-16">
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' ? (
        <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {EXPORT_ENTITIES.map(e => (
            <div key={e.id} className="stat-card">
              <div className="flex-between align-center margin-bottom-8">
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{e.name}</strong>
                  <p className="muted-text" style={{ margin: '2px 0 0', fontSize: '12px' }}>{e.desc}</p>
                </div>

                <div className="flex-row gap-6">
                  <button
                    onClick={() => handleExport(e.id, 'csv')}
                    className="btn-secondary btn-xs"
                    title="Export in CSV format"
                  >
                    <FileSpreadsheet size={13} /> CSV
                  </button>
                  <button
                    onClick={() => handleExport(e.id, 'json')}
                    className="btn-secondary btn-xs"
                    title="Export in JSON format"
                  >
                    <FileCode size={13} /> JSON
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Import Tab */
        <div className="flex-column gap-16">
          <div className="panel">
            <h3 className="margin-bottom-12">Stage 1: Entity Target & Source File</h3>

            <div className="form-grid-2">
              <div>
                <label>Target Entity Model</label>
                <select
                  value={importEntity}
                  onChange={e => {
                    setImportEntity(e.target.value)
                    setPreview(null)
                  }}
                >
                  <option value="tenants">Tenants (full_name, mobile, email, gender, dob...)</option>
                  <option value="rooms">Rooms (room_number, floor, room_type, capacity...)</option>
                  <option value="expenses">Expenses (title, category, amount, expense_date...)</option>
                </select>
              </div>

              <div>
                <label>Select CSV or JSON File</label>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="flex-row justify-end margin-top-16">
              <button
                onClick={handleValidate}
                disabled={!selectedFile || validating}
                className="btn-primary"
              >
                <CheckCircle2 size={15} />
                {validating ? 'Verifying Schema…' : 'Analyze & Validate File'}
              </button>
            </div>
          </div>

          {/* Stage 2: Preview & Commit */}
          {preview && (
            <div className="panel" style={{ borderTop: '3px solid #2563eb' }}>
              <div className="flex-between align-center margin-bottom-16">
                <div>
                  <h3 style={{ margin: 0 }}>Stage 2: Validation Inspection</h3>
                  <p className="muted-text" style={{ margin: '2px 0 0' }}>
                    Source file: <strong>{preview.filename}</strong> · {preview.total_rows} total rows parsed
                  </p>
                </div>

                <div className="flex-row gap-8">
                  <span className="badge badge-active">{preview.valid_count} Valid</span>
                  <span className="badge badge-status-pending">{preview.duplicate_count} Duplicates</span>
                  {preview.error_count > 0 && <span className="badge badge-vacated">{preview.error_count} Errors</span>}
                </div>
              </div>

              {preview.preview_rows.length > 0 && (
                <div className="table-responsive-wrapper margin-bottom-16">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Row Data Highlights</th>
                        <th>Validation Diagnostic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview_rows.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <span
                              className={`badge ${
                                row.validation_status === 'Valid'
                                  ? 'badge-active'
                                  : row.validation_status === 'Duplicate'
                                  ? 'badge-status-pending'
                                  : 'badge-vacated'
                              }`}
                            >
                              {row.validation_status}
                            </span>
                          </td>
                          <td className="font-mono text-xs">
                            {JSON.stringify(row.data).slice(0, 80)}…
                          </td>
                          <td className="text-muted text-xs">
                            {row.validation_errors.length > 0 ? row.validation_errors.join(', ') : 'Schema verified OK'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex-row justify-end">
                <button
                  onClick={handleCommitImport}
                  disabled={preview.valid_count === 0 || importing}
                  className="btn-primary"
                >
                  <Upload size={15} />
                  {importing ? 'Committing Records…' : `Commit ${preview.valid_count} Valid Records`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
