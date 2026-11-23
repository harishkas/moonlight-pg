import React, { useState, useEffect } from 'react'
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Activity,
  History,
  FileText,
  Calendar,
  Layers
} from 'lucide-react'
import { ScheduledJobItem, JobExecutionLogItem } from '../types'

interface Props {
  isClient?: boolean
}

export default function AutomationDashboardView({ isClient = false }: Props) {
  const [jobs, setJobs] = useState<ScheduledJobItem[]>([])
  const [logs, setLogs] = useState<JobExecutionLogItem[]>([])
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs'>('jobs')
  const [loading, setLoading] = useState(false)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [jobsRes, logsRes] = await Promise.all([
        fetch('/api/automation/jobs', { credentials: 'include' }),
        fetch('/api/automation/logs?limit=30', { credentials: 'include' })
      ])
      if (jobsRes.ok) setJobs(await jobsRes.json())
      if (logsRes.ok) setLogs(await logsRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/automation/jobs/${jobId}/toggle`, {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        const updated = await res.json()
        setJobs(prev => prev.map(j => (j.id === jobId ? updated : j)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const runJobNow = async (jobKey: string, jobName: string) => {
    setRunningJob(jobKey)
    try {
      const res = await fetch(`/api/automation/jobs/${jobKey}/run-now`, {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Job '${jobName}' completed in ${data.duration_ms}ms: ${data.records_processed} records processed.`)
        loadData()
        setTimeout(() => setStatusMsg(''), 5000)
      } else {
        const err = await res.json()
        setStatusMsg(`Execution failed: ${err.detail || 'Unknown error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRunningJob(null)
    }
  }

  const activeCount = jobs.filter(j => j.is_active).length

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            SCHEDULED DAEMON ENGINE & AUTOMATION WORKERS
          </p>
          <h1>Background Jobs & Automation Scheduler</h1>
          <p className="muted">
            Non-blocking cron workers managing rent invoice generation, overdue aging markers, and agreement expirations.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadData} title="Refresh Automation State">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Status
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
          <div className="stat-top">
            <span>Active Cron Schedules</span>
            <span className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}><Activity size={15} /></span>
          </div>
          <strong className="stat-value font-mono" style={{ fontSize: '20px' }}>
            {activeCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {jobs.length} registered</span>
          </strong>
          <small className="text-success flex-row align-center gap-4">
            <CheckCircle2 size={11} /> Worker thread running
          </small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="stat-top">
            <span>Logged Executions</span>
            <span className="stat-icon"><History size={15} /></span>
          </div>
          <strong className="stat-value font-mono" style={{ fontSize: '20px' }}>{logs.length}</strong>
          <small className="muted-text">Audited background job triggers</small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #7e22ce' }}>
          <div className="stat-top">
            <span>Execution Reliability</span>
            <span className="stat-icon" style={{ background: '#faf5ff', color: '#7e22ce' }}><CheckCircle2 size={15} /></span>
          </div>
          <strong className="stat-value font-mono text-success" style={{ fontSize: '20px' }}>
            {logs.length > 0
              ? `${Math.round((logs.filter(l => l.status === 'Success').length / logs.length) * 100)}%`
              : '100%'}
          </strong>
          <small className="muted-text">Zero fatal daemon crashes</small>
        </div>
      </div>

      {statusMsg && (
        <div className="notice margin-bottom-16">
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="modal-tabs">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`tab-btn flex-row gap-6 align-center ${activeTab === 'jobs' ? 'active' : ''}`}
        >
          <Layers size={14} /> Registered Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`tab-btn flex-row gap-6 align-center ${activeTab === 'logs' ? 'active' : ''}`}
        >
          <History size={14} /> Execution Audit Logs ({logs.length})
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'jobs' ? (
        <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {jobs.map(job => {
            const isRunning = runningJob === job.job_key
            return (
              <div
                key={job.id}
                className="stat-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: job.is_active ? '3px solid #2563eb' : '3px solid #94a3b8',
                  opacity: job.is_active ? 1 : 0.7
                }}
              >
                <div>
                  <div className="flex-between align-center margin-bottom-8">
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{job.name}</strong>
                      <p className="muted-text" style={{ margin: '2px 0 0', fontSize: '11.5px' }}>{job.description}</p>
                    </div>

                    <button
                      onClick={() => !isClient && toggleJob(job.id)}
                      disabled={isClient}
                      className={`btn-xs ${job.is_active ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ cursor: isClient ? 'not-allowed' : 'pointer' }}
                    >
                      {job.is_active ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="flex-row gap-6 align-center margin-top-12">
                    <span className="badge badge-code">
                      <Clock size={11} /> {job.cron_expression}
                    </span>
                    {job.last_status && (
                      <span className={`badge ${job.last_status === 'Success' ? 'badge-active' : 'badge-vacated'}`}>
                        {job.last_status === 'Success' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {job.last_status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-between align-center margin-top-16 pt-2" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <span className="text-muted text-xs font-mono">
                    Last: {job.last_run_time ? new Date(job.last_run_time).toLocaleString() : 'Never'}
                  </span>
                  {!isClient ? (
                    <button
                      onClick={() => runJobNow(job.job_key, job.name)}
                      disabled={isRunning}
                      className="btn-secondary btn-xs"
                    >
                      <Play size={11} className={isRunning ? 'animate-spin' : ''} />
                      {isRunning ? 'Running…' : 'Trigger Run'}
                    </button>
                  ) : (
                    <span className="badge badge-info" style={{ fontSize: '10px' }}>
                      Scheduler Active
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Logs Tab */
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Job Identifier</th>
                <th>Execution Start</th>
                <th>Duration</th>
                <th>Records Impacted</th>
                <th>Telemetry Diagnostic</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-24 text-muted">
                    No background job executions recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge ${log.status === 'Success' ? 'badge-active' : 'badge-vacated'}`}>
                        {log.status === 'Success' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {log.status}
                      </span>
                    </td>
                    <td><strong>{log.job_name}</strong></td>
                    <td className="font-mono text-xs">{new Date(log.start_time).toLocaleString()}</td>
                    <td className="font-mono text-xs">{log.duration_ms} ms</td>
                    <td className="font-mono">{log.records_processed}</td>
                    <td className="text-muted text-xs truncate max-w-xs" title={log.message || ''}>
                      {log.message || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
