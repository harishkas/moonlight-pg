import React, { useState, useEffect } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  AlertTriangle,
  Info,
  Clock,
  Settings2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2
} from 'lucide-react'
import { NotificationItem, NotificationPreference, DuesAgingSummary } from '../types'

interface Props {
  onRefreshUnread: () => void
  onNavigateTo?: (view: any) => void
  isClient?: boolean
}

export default function NotificationsView({ onRefreshUnread, onNavigateTo, isClient = false }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [duesSummary, setDuesSummary] = useState<DuesAgingSummary | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'rent' | 'system' | 'preferences'>('all')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [notifRes, prefRes, duesRes] = await Promise.all([
        fetch('/api/notifications', { credentials: 'include' }),
        fetch('/api/notifications/preferences', { credentials: 'include' }),
        fetch('/api/automation/dues-summary', { credentials: 'include' })
      ])
      if (notifRes.ok) setNotifications(await notifRes.json())
      if (prefRes.ok) setPreferences(await prefRes.json())
      if (duesRes.ok) setDuesSummary(await duesRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        )
        onRefreshUnread()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        onRefreshUnread()
        setStatusMsg('All notifications marked as read.')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const dismissNotification = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
        onRefreshUnread()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const triggerScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/automation/rent-reminders/run', {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Rent Reminder scan completed: ${data.reminders_sent} reminder(s) generated.`)
        loadAll()
        onRefreshUnread()
        setTimeout(() => setStatusMsg(''), 4000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const togglePref = (prefKey: string) => {
    setPreferences(prev =>
      prev.map(p => (p.pref_key === prefKey ? { ...p, is_enabled: !p.is_enabled } : p))
    )
  }

  const savePreferences = async () => {
    setSavingPrefs(true)
    try {
      const prefMap: Record<string, string> = {}
      preferences.forEach(p => {
        prefMap[p.pref_key] = p.is_enabled ? 'true' : 'false'
      })
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefMap })
      })
      if (res.ok) {
        setStatusMsg('Notification preferences updated successfully.')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingPrefs(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = notifications.filter(n => {
    if (onlyUnread && n.is_read) return false
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false
    if (activeTab === 'rent' && !['Rent Reminder', 'Overdue Payment'].includes(n.category)) return false
    if (activeTab === 'system' && ['Rent Reminder', 'Overdue Payment'].includes(n.category)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        (n.tenant_name && n.tenant_name.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="view-container">
      {/* Industrial Header */}
      <div className="welcome-row">
        <div>
          <span className="eyebrow">CENTRALIZED EVENT ENGINE</span>
          <h1 className="font-bold flex-row align-center gap-10">
            Notification Center
            {unreadCount > 0 && (
              <span className="badge badge-warning font-mono" style={{ fontSize: 11, padding: '2px 8px' }}>
                {unreadCount} UNREAD
              </span>
            )}
          </h1>
          <p className="muted">
            Centralized automated alerts, rent reminders, departures, and operational notifications
          </p>
        </div>

        {!isClient && (
          <div className="action-buttons-group">
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="btn-primary flex-row align-center gap-6"
            >
              <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
              <span>{scanning ? 'Scanning...' : 'Scan Reminders Now'}</span>
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="btn-secondary flex-row align-center gap-6"
              >
                <CheckCheck size={14} className="text-success" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dues & Aging Summary Panel */}
      {duesSummary && duesSummary.tenants_with_dues_count > 0 && (
        <div className="panel" style={{ borderLeft: '4px solid var(--warning)', background: '#fffbeb', marginBottom: 20 }}>
          <div className="flex-between flex-wrap gap-16">
            <div className="flex-row align-center gap-12">
              <div style={{ background: '#fef3c7', padding: 8, borderRadius: 6, color: '#b45309' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="font-semibold text-primary" style={{ fontSize: 13.5 }}>Outstanding Dues & Overdue Aging</div>
                <div className="muted-text font-mono" style={{ fontSize: 12 }}>
                  ₹{duesSummary.total_unpaid_dues.toLocaleString('en-IN', { minimumFractionDigits: 2 })} pending across {duesSummary.tenants_with_dues_count} residents
                </div>
              </div>
            </div>

            <div className="flex-row align-center gap-10">
              <div style={{ background: '#fff', padding: '6px 14px', borderRadius: 6, border: '1px solid #fde68a', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: '#92400e', fontWeight: 600 }}>0 - 30 DAYS</div>
                <div className="font-bold font-mono" style={{ fontSize: 13, color: '#b45309' }}>
                  ₹{duesSummary.aging_0_30.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '6px 14px', borderRadius: 6, border: '1px solid #fed7aa', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: '#9a3412', fontWeight: 600 }}>30 - 60 DAYS</div>
                <div className="font-bold font-mono" style={{ fontSize: 13, color: '#c2410c' }}>
                  ₹{duesSummary.aging_30_60.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '6px 14px', borderRadius: 6, border: '1px solid #fecdd3', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: '#9f1239', fontWeight: 600 }}>60+ DAYS</div>
                <div className="font-bold font-mono" style={{ fontSize: 13, color: '#e11d48' }}>
                  ₹{duesSummary.aging_60_plus.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="modal-tabs" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('all')}
          className={`modal-tab ${activeTab === 'all' ? 'active' : ''}`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('rent')}
          className={`modal-tab ${activeTab === 'rent' ? 'active' : ''}`}
        >
          Rent & Invoices ({notifications.filter(n => ['Rent Reminder', 'Overdue Payment'].includes(n.category)).length})
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`modal-tab ${activeTab === 'system' ? 'active' : ''}`}
        >
          System & Departures ({notifications.filter(n => !['Rent Reminder', 'Overdue Payment'].includes(n.category)).length})
        </button>
        {!isClient && (
          <button
            onClick={() => setActiveTab('preferences')}
            className={`modal-tab flex-row align-center gap-6 ${activeTab === 'preferences' ? 'active' : ''}`}
          >
            <Settings2 size={13} />
            <span>Schedules & Rules</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', fontSize: 12.5, marginBottom: 16, borderRadius: 6 }}>
          {statusMsg}
        </div>
      )}

      {/* Body Content */}
      {activeTab !== 'preferences' ? (
        <div className="flex-column gap-12">
          {/* Filter Bar */}
          <div className="filters-bar" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ minWidth: 260, maxWidth: 400, flex: 1 }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search alerts or resident..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="flex-row align-center gap-8">
              <button
                onClick={() => setOnlyUnread(!onlyUnread)}
                className={`btn-secondary ${onlyUnread ? 'active' : ''}`}
                style={{
                  background: onlyUnread ? '#eff6ff' : undefined,
                  borderColor: onlyUnread ? '#3b82f6' : undefined,
                  color: onlyUnread ? '#1d4ed8' : undefined,
                  fontSize: 12
                }}
              >
                Only Unread
              </button>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="form-control"
                style={{ width: 'auto', fontSize: 12, height: 32, padding: '0 10px' }}
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Alert List */}
          <div className="flex-column gap-8">
            {loading ? (
              <div className="panel text-center muted-text" style={{ padding: 40 }}>Loading notifications...</div>
            ) : filtered.length === 0 ? (
              <div className="panel text-center" style={{ padding: 48 }}>
                <Bell size={28} className="muted-text" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <div className="font-semibold text-primary">No Notifications Recorded</div>
                <div className="muted-text margin-top-4">All clear! No pending operational alerts.</div>
              </div>
            ) : (
              filtered.map(item => {
                const isUrgent = item.priority === 'Urgent' || item.priority === 'High'
                const isOverdue = item.category === 'Overdue Payment'
                return (
                  <div
                    key={item.id}
                    className="panel"
                    style={{
                      background: item.is_read ? '#ffffff' : '#f8fafc',
                      borderLeft: isUrgent ? '4px solid var(--danger)' : isOverdue ? '4px solid var(--warning)' : '4px solid var(--border-strong)',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16
                    }}
                  >
                    <div className="flex-row align-center gap-12 flex-1">
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          background: isUrgent ? '#fee2e2' : '#f1f5f9',
                          color: isUrgent ? '#dc2626' : '#475569'
                        }}
                      >
                        {isUrgent ? <AlertTriangle size={18} /> : <Info size={18} />}
                      </div>

                      <div className="flex-1">
                        <div className="flex-row align-center gap-8 flex-wrap margin-bottom-4">
                          <span className="font-semibold text-primary" style={{ fontSize: 13.5 }}>
                            {item.title}
                          </span>
                          <span
                            className={`badge ${
                              item.priority === 'Urgent'
                                ? 'badge-danger'
                                : item.priority === 'High'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {item.priority}
                          </span>
                          <span className="badge badge-neutral font-mono" style={{ fontSize: 10 }}>
                            {item.category}
                          </span>
                          {!item.is_read && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                          )}
                        </div>

                        <div className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                          {item.description}
                        </div>

                        <div className="flex-row align-center gap-16 muted-text margin-top-8 font-mono" style={{ fontSize: 11 }}>
                          <span className="flex-row align-center gap-4">
                            <Clock size={12} />
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                          {item.tenant_name && (
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>
                              RESIDENT: {item.tenant_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isClient && (
                      <div className="flex-row align-center gap-6">
                        {!item.is_read && (
                          <button
                            onClick={() => markAsRead(item.id)}
                            className="btn-secondary flex-row align-center gap-4"
                            style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                            title="Mark as Read"
                          >
                            <Check size={12} className="text-success" />
                            <span>Read</span>
                          </button>
                        )}
                        <button
                          onClick={() => dismissNotification(item.id)}
                          className="btn-secondary"
                          style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center', color: '#94a3b8' }}
                          title="Dismiss"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* Preferences & Schedule Matrix */
        <div className="panel" style={{ padding: 24 }}>
          <div className="margin-bottom-16">
            <h3 className="font-semibold text-primary" style={{ fontSize: 14 }}>Automated Schedule & Notification Preferences</h3>
            <p className="muted-text margin-top-4">
              Configure reminder schedules (e.g. 7d, 3d, 1d before, on due date, 1d & 7d after) and system alerts.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {preferences.map(pref => (
              <div
                key={pref.pref_key}
                onClick={() => togglePref(pref.pref_key)}
                className="panel"
                style={{
                  cursor: 'pointer',
                  border: pref.is_enabled ? '1px solid #93c5fd' : '1px solid var(--border)',
                  background: pref.is_enabled ? '#f8fafc' : '#ffffff',
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="font-semibold text-primary font-mono" style={{ fontSize: 11.5 }}>
                    {pref.pref_key.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="muted-text margin-top-4" style={{ fontSize: 11.5 }}>
                    {pref.description || pref.category}
                  </div>
                </div>

                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: pref.is_enabled ? '#0f172a' : '#cbd5e1',
                    position: 'relative',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: pref.is_enabled ? 19 : 3,
                      transition: 'all 0.2s'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="margin-top-20 flex-row justify-end" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button
              onClick={savePreferences}
              disabled={savingPrefs}
              className="btn-primary"
            >
              {savingPrefs ? 'Saving Preferences...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
