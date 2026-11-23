import React, { useState, useEffect } from 'react'
import {
  Activity,
  HardDrive,
  Database,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Server
} from 'lucide-react'
import { SystemHealthData } from '../types'

export default function SystemHealthView() {
  const [health, setHealth] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadHealth()
  }, [])

  const loadHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/system/health', { credentials: 'include' })
      if (res.ok) setHealth(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${seconds % 60}s`
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            TELEMETRY & SERVER RUNTIME MONITORING
          </p>
          <h1>System Health & Infrastructure Diagnostics</h1>
          <p className="muted">
            Continuous verification of local SQLite engine, WAL mode concurrency, storage headroom, and daemon schedulers.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadHealth} title="Refresh Diagnostics">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Telemetry
          </button>
        </div>
      </div>

      {health && (
        <>
          {/* Main Status Header Card */}
          <div className="stat-card margin-bottom-16" style={{ padding: '18px 20px', borderLeft: health.status === 'Healthy' ? '4px solid #059669' : '4px solid #d97706' }}>
            <div className="flex-between flex-wrap gap-12">
              <div className="flex-row gap-14 align-center">
                <div
                  className="modal-icon"
                  style={{
                    width: '42px',
                    height: '42px',
                    background: health.status === 'Healthy' ? '#ecfdf5' : '#fffbeb',
                    color: health.status === 'Healthy' ? '#059669' : '#d97706',
                    borderColor: health.status === 'Healthy' ? '#a7f3d0' : '#fde68a'
                  }}
                >
                  <Activity size={22} />
                </div>
                <div>
                  <div className="flex-row gap-8 align-center">
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{health.app_name}</h2>
                    <span className="badge badge-code">v{health.version}</span>
                  </div>
                  <p className="muted-text" style={{ margin: '3px 0 0' }}>
                    Process Uptime: <strong>{formatUptime(health.uptime_seconds)}</strong> · Environment: Localhost Single-Node Workstation
                  </p>
                </div>
              </div>

              <span
                className={`badge ${
                  health.status === 'Healthy'
                    ? 'badge-active'
                    : health.status === 'Action Needed'
                    ? 'badge-status-pending'
                    : 'badge-vacated'
                }`}
                style={{ fontSize: '12px', padding: '5px 12px' }}
              >
                {health.status === 'Healthy' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {health.status}
              </span>
            </div>
          </div>

          {/* Warnings (if any) */}
          {health.warnings.length > 0 && (
            <div className="notice margin-bottom-16" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}>
              <div className="flex-row gap-6 align-center font-weight-bold margin-bottom-4">
                <AlertTriangle size={14} /> Attention Items Detected:
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '12.5px' }}>
                {health.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Diagnostic Metrics Grid */}
          <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
            {/* Database Engine */}
            <div className="stat-card">
              <div className="stat-top">
                <span>Journal Mode</span>
                <span className="stat-icon"><Database size={15} /></span>
              </div>
              <strong className="stat-value font-mono" style={{ fontSize: '18px' }}>{health.database_mode}</strong>
              <small className="text-success flex-row align-center gap-4">
                <CheckCircle2 size={11} /> Concurrency active
              </small>
            </div>

            {/* Database Size */}
            <div className="stat-card">
              <div className="stat-top">
                <span>Database File</span>
                <span className="stat-icon"><HardDrive size={15} /></span>
              </div>
              <strong className="stat-value" style={{ fontSize: '18px' }}>{health.database_size_mb} MB</strong>
              <small className="muted-text font-mono truncate" title={health.database_path} style={{ display: 'block', maxWidth: '200px' }}>
                {health.database_path.split('\\').pop() || 'local.sqlite3'}
              </small>
            </div>

            {/* Disk Free Space */}
            <div className="stat-card">
              <div className="stat-top">
                <span>Free Disk Headroom</span>
                <span className="stat-icon"><Server size={15} /></span>
              </div>
              <strong className="stat-value text-success" style={{ fontSize: '18px' }}>{health.disk_free_gb} GB</strong>
              <small className="muted-text">Verified write capacity</small>
            </div>

            {/* Scheduler Status */}
            <div className="stat-card">
              <div className="stat-top">
                <span>Scheduler Daemons</span>
                <span className="stat-icon"><Clock size={15} /></span>
              </div>
              <strong className="stat-value text-primary" style={{ fontSize: '18px' }}>{health.active_scheduler_jobs} Active</strong>
              <small className="text-success flex-row align-center gap-4">
                <CheckCircle2 size={11} /> Background timers running
              </small>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
