import React, { useState, useEffect } from 'react'
import { Bell, Check, CheckCheck, Trash2, Filter, AlertTriangle, Info, Clock, ExternalLink, X, Settings2 } from 'lucide-react'
import { NotificationItem, NotificationPreference } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onNavigateTo?: (view: string, id?: number) => void
  onRefreshUnread: () => void
  isClient?: boolean
}

export default function NotificationCenterModal({ isOpen, onClose, onNavigateTo, onRefreshUnread, isClient }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [activeTab, setActiveTab] = useState<'notifications' | 'preferences'>('notifications')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
      loadPreferences()
    }
  }, [isOpen])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadPreferences = async () => {
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPreferences(data)
      }
    } catch (e) {
      console.error(e)
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
        setStatusMsg('Notification preferences saved successfully.')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingPrefs(false)
    }
  }

  const triggerScan = async () => {
    try {
      setStatusMsg('Running automated reminder scan...')
      const res = await fetch('/api/automation/rent-reminders/run', {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStatusMsg(`Scan complete: ${data.reminders_sent} reminder(s) generated.`)
        loadNotifications()
        onRefreshUnread()
        setTimeout(() => setStatusMsg(''), 4000)
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!isOpen) return null

  const filtered = notifications.filter(n => {
    if (onlyUnread && n.is_read) return false
    if (filterCategory !== 'all' && n.category !== filterCategory) return false
    if (filterPriority !== 'all' && n.priority !== filterPriority) return false
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 840, width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex-row align-center gap-10">
            <div style={{ background: '#f1f5f9', padding: 6, borderRadius: 6, color: 'var(--primary)' }}>
              <Bell size={18} />
            </div>
            <div>
              <div className="flex-row align-center gap-8">
                <span className="font-semibold text-primary" style={{ fontSize: 15 }}>
                  Centralized Notification Center
                </span>
                {unreadCount > 0 && (
                  <span className="badge badge-warning font-mono" style={{ fontSize: 10 }}>
                    {unreadCount} UNREAD
                  </span>
                )}
              </div>
              <div className="muted-text font-mono" style={{ fontSize: 11 }}>
                Automated alerts, rent reminders & operational notifications
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-close" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534', padding: '8px 16px', fontSize: 12 }}>
            {statusMsg}
          </div>
        )}

        {/* Tab Selector & Controls */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="modal-tabs" style={{ marginBottom: 0 }}>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`modal-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            >
              Alerts ({notifications.length})
            </button>
            {!isClient && (
              <button
                onClick={() => setActiveTab('preferences')}
                className={`modal-tab flex-row align-center gap-6 ${activeTab === 'preferences' ? 'active' : ''}`}
              >
                <Settings2 size={13} />
                <span>Preferences</span>
              </button>
            )}
          </div>

          {activeTab === 'notifications' && !isClient && (
            <div className="flex-row align-center gap-8">
              <button
                onClick={triggerScan}
                className="btn-secondary"
                style={{ height: 30, fontSize: 11.5 }}
              >
                Scan Reminders Now
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="btn-secondary flex-row align-center gap-4 text-success"
                  style={{ height: 30, fontSize: 11.5 }}
                >
                  <CheckCheck size={13} />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Body */}
        {activeTab === 'notifications' ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Filter Bar */}
            <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', background: '#ffffff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
              <span className="muted-text flex-row align-center gap-4">
                <Filter size={12} /> Filter:
              </span>
              <button
                onClick={() => setOnlyUnread(!onlyUnread)}
                className={`btn-secondary ${onlyUnread ? 'active' : ''}`}
                style={{
                  height: 26,
                  padding: '0 8px',
                  fontSize: 11,
                  background: onlyUnread ? '#eff6ff' : undefined,
                  borderColor: onlyUnread ? '#3b82f6' : undefined,
                  color: onlyUnread ? '#1d4ed8' : undefined
                }}
              >
                Only Unread
              </button>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="form-control"
                style={{ height: 26, width: 'auto', padding: '0 8px', fontSize: 11 }}
              >
                <option value="all">All Categories</option>
                <option value="Rent Reminder">Rent Reminder</option>
                <option value="Overdue Payment">Overdue Payment</option>
                <option value="Agreement Expiry">Agreement Expiry</option>
                <option value="Backup Status">Backup Status</option>
                <option value="System Alerts">System Alerts</option>
              </select>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="form-control"
                style={{ height: 26, width: 'auto', padding: '0 8px', fontSize: 11 }}
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="flex-column gap-8">
              {loading ? (
                <div className="text-center muted-text" style={{ padding: 32 }}>Loading notifications...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center" style={{ padding: 40 }}>
                  <Bell size={28} className="muted-text" style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <div className="font-semibold text-primary" style={{ fontSize: 13.5 }}>No Notifications Found</div>
                  <div className="muted-text margin-top-4" style={{ fontSize: 12 }}>All alerts cleared or none match the selected filters.</div>
                </div>
              ) : (
                filtered.map(item => {
                  const isUrgent = item.priority === 'Urgent' || item.priority === 'High'
                  return (
                    <div
                      key={item.id}
                      className="panel"
                      style={{
                        padding: '12px 14px',
                        background: item.is_read ? '#ffffff' : '#f8fafc',
                        borderLeft: isUrgent ? '4px solid var(--danger)' : '4px solid var(--border-strong)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div className="flex-row align-center gap-10 flex-1">
                        <div
                          style={{
                            padding: 6,
                            borderRadius: 6,
                            background: isUrgent ? '#fee2e2' : '#f1f5f9',
                            color: isUrgent ? '#dc2626' : '#475569'
                          }}
                        >
                          {isUrgent ? <AlertTriangle size={15} /> : <Info size={15} />}
                        </div>

                        <div className="flex-1">
                          <div className="flex-row align-center gap-8 flex-wrap margin-bottom-4">
                            <span className="font-semibold text-primary" style={{ fontSize: 13 }}>
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

                          <div className="text-secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
                            {item.description}
                          </div>

                          <div className="flex-row align-center gap-12 muted-text margin-top-4 font-mono" style={{ fontSize: 10.5 }}>
                            <span className="flex-row align-center gap-4">
                              <Clock size={11} />
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                            {item.tenant_name && (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                Resident: {item.tenant_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isClient && (
                        <div className="flex-row align-center gap-4">
                          {!item.is_read && (
                            <button
                              onClick={() => markAsRead(item.id)}
                              className="btn-secondary"
                              style={{ height: 26, padding: '0 6px', fontSize: 11 }}
                              title="Mark as Read"
                            >
                              <Check size={12} className="text-success" />
                            </button>
                          )}
                          <button
                            onClick={() => dismissNotification(item.id)}
                            className="btn-secondary"
                            style={{ height: 26, width: 26, padding: 0, display: 'grid', placeItems: 'center', color: '#94a3b8' }}
                            title="Dismiss"
                          >
                            <Trash2 size={12} />
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
          /* Preferences Tab */
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }} className="flex-column gap-16">
            <div>
              <div className="font-semibold text-primary" style={{ fontSize: 13.5 }}>Automated Reminder Schedules & Channels</div>
              <div className="muted-text margin-top-4" style={{ fontSize: 11.5 }}>
                Configure when the background engine automatically scans invoices and generates in-app notifications.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {preferences.map(pref => (
                <div
                  key={pref.pref_key}
                  onClick={() => togglePref(pref.pref_key)}
                  className="panel"
                  style={{
                    cursor: 'pointer',
                    border: pref.is_enabled ? '1px solid #93c5fd' : '1px solid var(--border)',
                    background: pref.is_enabled ? '#f8fafc' : '#ffffff',
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold text-primary font-mono" style={{ fontSize: 11 }}>
                      {pref.pref_key.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="muted-text margin-top-4" style={{ fontSize: 11 }}>
                      {pref.description || pref.category}
                    </div>
                  </div>

                  <div
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      background: pref.is_enabled ? '#0f172a' : '#cbd5e1',
                      position: 'relative',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#ffffff',
                        position: 'absolute',
                        top: 3,
                        left: pref.is_enabled ? 17 : 3,
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-row justify-end" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                onClick={savePreferences}
                disabled={savingPrefs}
                className="btn-primary"
                style={{ height: 32, fontSize: 12 }}
              >
                {savingPrefs ? 'Saving Preferences...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
