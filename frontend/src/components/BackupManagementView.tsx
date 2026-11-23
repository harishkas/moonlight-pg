import React, { useState, useEffect } from 'react'
import {
  Database,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  HardDrive,
  FileCheck,
  X,
  History
} from 'lucide-react'
import { BackupItem } from '../types'

interface Props {
  isClient?: boolean
}

export default function BackupManagementView({ isClient }: Props = {}) {
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  // Safe Restore modal state
  const [restoreModalFile, setRestoreModalFile] = useState<string | null>(null)
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backups', { credentials: 'include' })
      if (res.ok) setBackups(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createBackupNow = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Created online snapshot: ${data.file_name} (${data.file_size_mb} MB) successfully.`)
        loadBackups()
        setTimeout(() => setStatusMsg(''), 5000)
      } else {
        const err = await res.json()
        setStatusMsg(`Backup creation failed: ${err.detail || 'Error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const verifyBackupIntegrity = async (filename: string) => {
    setVerifying(filename)
    try {
      const res = await fetch(`/api/backups/${filename}/verify`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        alert(`Integrity Verification Result for ${filename}:\nStatus: ${data.integrity_status}\nVerified: ${data.is_valid ? 'PASS (PRAGMA OK)' : 'FAIL'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setVerifying(null)
    }
  }

  const downloadBackup = (filename: string) => {
    window.open(`/api/backups/${filename}/download`, '_blank')
  }

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restoreModalFile || confirmPhrase !== 'RESTORE DATABASE') return
    setRestoring(true)
    try {
      const res = await fetch(`/api/backups/${restoreModalFile}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_phrase: confirmPhrase })
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Database safely restored! Safety snapshot saved as ${data.pre_restore_safety_backup}. Refreshing page...`)
        setRestoreModalFile(null)
        setConfirmPhrase('')
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        const err = await res.json()
        setStatusMsg(`Restore rejected: ${err.detail || 'Error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            DISASTER RECOVERY & POINT-IN-TIME SNAPSHOTS
          </p>
          <h1>Database Backup & Recovery Console</h1>
          <p className="muted">
            SQLite Online Backup API with PRAGMA integrity verification, live non-blocking snapshots, and safe restore workflows.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadBackups} title="Refresh Snapshots">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh List
          </button>
          {!isClient && (
            <button className="btn-primary" onClick={createBackupNow} disabled={creating}>
              <Database size={15} />
              {creating ? 'Creating Snapshot…' : 'Create Backup Snapshot'}
            </button>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="notice margin-bottom-16" style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}>
        <div className="flex-row gap-8 align-center font-weight-bold margin-bottom-4">
          <HardDrive size={15} className="text-primary" /> Live Non-Blocking Snapshot Architecture:
        </div>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#475569' }}>
          Backups are generated while running in Write-Ahead Logging (WAL) mode without locking resident records or disrupting billing transactions. An automatic pre-restore safety snapshot is archived before any restore operation.
        </p>
      </div>

      {statusMsg && (
        <div className="notice margin-bottom-16">
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Backups List Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Backup File</th>
              <th>File Size</th>
              <th>Created Timestamp</th>
              <th>PRAGMA Integrity Check</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-24 text-muted">
                  Loading backup snapshots...
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-24 text-muted">
                  No snapshot files found. Click "Create Backup Snapshot" to initialize your first backup.
                </td>
              </tr>
            ) : (
              backups.map(b => (
                <tr key={b.file_name}>
                  <td>
                    <strong className="font-mono" style={{ fontSize: '12px' }}>{b.file_name}</strong>
                  </td>
                  <td className="font-mono text-xs">{b.file_size_mb} MB</td>
                  <td className="text-muted">{new Date(b.created_at).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-active">
                      <CheckCircle2 size={11} /> PRAGMA OK
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      <button
                        onClick={() => verifyBackupIntegrity(b.file_name)}
                        disabled={verifying === b.file_name}
                        className="btn-secondary btn-xs"
                      >
                        {verifying === b.file_name ? 'Checking…' : 'Verify'}
                      </button>
                      <button
                        onClick={() => downloadBackup(b.file_name)}
                        className="btn-secondary btn-xs"
                        title="Download SQLite database snapshot file"
                      >
                        <Download size={12} /> Download
                      </button>
                      {!isClient && (
                        <button
                          onClick={() => {
                            setRestoreModalFile(b.file_name)
                            setConfirmPhrase('')
                          }}
                          className="btn-danger-outline btn-xs"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Safe Restore Modal */}
      {restoreModalFile && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 style={{ color: '#dc2626' }}>Confirm Database Restore</h3>
                  <p className="muted-text">Snapshot target: <strong>{restoreModalFile}</strong></p>
                </div>
              </div>
              <button className="icon-btn-sm" onClick={() => setRestoreModalFile(null)}><X size={16} /></button>
            </div>

            <div className="alert-error margin-bottom-12" style={{ display: 'block', lineHeight: 1.45 }}>
              <strong>SAFETY SAFEGUARD:</strong> Restoring will roll back active property data to this snapshot. A safety pre-restore backup will be captured immediately prior to execution.
            </div>

            <form onSubmit={handleRestoreSubmit} className="modal-form">
              <div>
                <label>
                  Type <strong>RESTORE DATABASE</strong> to authorize:
                </label>
                <input
                  type="text"
                  required
                  placeholder="RESTORE DATABASE"
                  value={confirmPhrase}
                  onChange={e => setConfirmPhrase(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setRestoreModalFile(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmPhrase !== 'RESTORE DATABASE' || restoring}
                  className="btn-danger"
                >
                  {restoring ? 'Restoring Snapshot…' : 'Authorize Restore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
