import React, { useState, useEffect } from 'react'
import {
  Users,
  Key,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Plus,
  RotateCcw,
  UserCheck,
  Lock,
  Eye,
  AlertTriangle,
  X
} from 'lucide-react'
import { SystemUserItem } from '../types'

export default function UserManagementView() {
  const [users, setUsers] = useState<SystemUserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // Change Password Modal
  const [passwordModalUser, setPasswordModalUser] = useState<SystemUserItem | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'master' | 'admin' | 'subadmin' | 'client'>('client')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (res.ok) setUsers(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordModalUser || !newPassword) return
    setUpdatingPassword(true)
    try {
      const res = await fetch(`/api/users/${passwordModalUser.id}/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      })
      if (res.ok) {
        setStatusMsg(`Password for user '${passwordModalUser.username}' updated successfully.`)
        setPasswordModalUser(null)
        setNewPassword('')
        setTimeout(() => setStatusMsg(''), 4000)
      } else {
        const err = await res.json()
        setStatusMsg(`Password update failed: ${err.detail || 'Error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername || !createPassword) return
    setCreatingUser(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: createPassword,
          role: createRole
        })
      })
      if (res.ok) {
        setStatusMsg(`User account '${newUsername}' registered successfully.`)
        setCreateModalOpen(false)
        setNewUsername('')
        setCreatePassword('')
        setCreateRole('client')
        loadUsers()
        setTimeout(() => setStatusMsg(''), 4000)
      } else {
        const err = await res.json()
        setStatusMsg(`Failed to create user: ${err.detail || 'Error'}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreatingUser(false)
    }
  }

  const toggleUserStatus = async (user: SystemUserItem) => {
    if (user.username === 'master') {
      alert('Cannot deactivate the Master Control account.')
      return
    }
    try {
      const res = await fetch(`/api/users/${user.id}/status`, {
        method: 'PUT',
        credentials: 'include'
      })
      if (res.ok) {
        loadUsers()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            SYSTEM SECURITY & ROLE-BASED ACCESS CONTROL
          </p>
          <h1>User Access & Permissions Management</h1>
          <p className="muted">
            Configure system authentication credentials and assign access levels across Master Control, Administrators, and View-Only Clients.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadUsers} title="Refresh Accounts">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={15} /> Add User Account
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="notice margin-bottom-16">
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Role Definitions KPI Cards */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-top">
            <span>Master Control</span>
            <span className="stat-icon" style={{ background: '#fffbeb', color: '#b45309' }}>
              <ShieldAlert size={16} />
            </span>
          </div>
          <strong className="stat-value" style={{ fontSize: '18px', color: '#b45309' }}>Superadmin</strong>
          <small className="muted-text">
            Unrestricted master authority: operations, financial ledgers, hot backups, database restores, and credential management.
          </small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="stat-top">
            <span>Administrator</span>
            <span className="stat-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              <Shield size={16} />
            </span>
          </div>
          <strong className="stat-value" style={{ fontSize: '18px', color: '#1d4ed8' }}>Operations</strong>
          <small className="muted-text">
            Complete property control: resident onboarding, room/bed allocations, monthly billing runs, rent collection, and tasks.
          </small>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="stat-top">
            <span>Client (View-Only)</span>
            <span className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <Eye size={16} />
            </span>
          </div>
          <strong className="stat-value" style={{ fontSize: '18px', color: '#0284c7' }}>Read-Only</strong>
          <small className="muted-text">
            Strict viewing-only permissions: audit reports, telemetry, resident ledger status, and occupancy. Cannot add, edit, or delete.
          </small>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Access Tier</th>
              <th>Permissions Scope</th>
              <th>Account Status</th>
              <th className="text-right">Account Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-24 text-muted">
                  Loading system user directory...
                </td>
              </tr>
            ) : (
              users.map(u => {
                const isMaster = u.role === 'master'
                const isAdmin = u.role === 'admin'
                const isSubAdmin = u.role === 'subadmin'

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex-row gap-8 align-center">
                        <div
                          className="avatar"
                          style={{
                            width: '26px',
                            height: '26px',
                            fontSize: '11px',
                            background: isMaster ? '#fef3c7' : isAdmin ? '#e0e7ff' : isSubAdmin ? '#dcfce7' : '#e0f2fe',
                            color: isMaster ? '#b45309' : isAdmin ? '#3730a3' : isSubAdmin ? '#15803d' : '#0369a1'
                          }}
                        >
                          {u.username[0].toUpperCase()}
                        </div>
                        <strong className="font-mono">{u.username}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: isMaster ? '#fef3c7' : isAdmin ? '#e0e7ff' : isSubAdmin ? '#dcfce7' : '#e0f2fe',
                          color: isMaster ? '#b45309' : isAdmin ? '#3730a3' : isSubAdmin ? '#15803d' : '#0369a1',
                          borderColor: isMaster ? '#fde68a' : isAdmin ? '#c7d2fe' : isSubAdmin ? '#bbf7d0' : '#bae6fd'
                        }}
                      >
                        {isMaster ? '👑 Master Control' : isAdmin ? '🛡️ Administrator' : isSubAdmin ? '⚙️ Sub-Admin' : '🔒 Client (View-Only)'}
                      </span>
                    </td>
                    <td>
                      <span className="muted-text">
                        {isMaster
                          ? 'Full Control + User Administration + Safe Snapshot Restores'
                          : isAdmin
                          ? 'All Operational, Billing, and Financial Management'
                          : isSubAdmin
                          ? 'Daily Operations & Check-ins (No Deletions)'
                          : 'Read-Only / Viewing Authority Only'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-active' : 'badge-vacated'}`}>
                        {u.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="row-actions">
                        <button
                          onClick={() => {
                            setPasswordModalUser(u)
                            setNewPassword('')
                          }}
                          className="btn-secondary btn-xs"
                          title="Change user password"
                        >
                          <Key size={12} /> Reset Password
                        </button>
                        {u.username !== 'master' && (
                          <button
                            onClick={() => toggleUserStatus(u)}
                            className={u.is_active ? 'btn-danger-outline btn-xs' : 'btn-secondary btn-xs'}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Change Password Modal */}
      {passwordModalUser && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon">
                  <Key size={18} />
                </div>
                <div>
                  <h3>Change Password</h3>
                  <p className="muted-text">Target account: <strong>{passwordModalUser.username}</strong></p>
                </div>
              </div>
              <button className="icon-btn-sm" onClick={() => setPasswordModalUser(null)}><X size={16} /></button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="modal-form">
              <div>
                <label>New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new secure password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setPasswordModalUser(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword || newPassword.length < 6}
                  className="btn-primary"
                >
                  {updatingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon">
                  <Plus size={18} />
                </div>
                <div>
                  <h3>Create New User Account</h3>
                  <p className="muted-text">Register a new login with defined RBAC permissions</p>
                </div>
              </div>
              <button className="icon-btn-sm" onClick={() => setCreateModalOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div>
                <label>Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. client4, accountant, or supervisor"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                />
              </div>

              <div>
                <label>Initial Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  placeholder="Enter secure initial password"
                  value={createPassword}
                  onChange={e => setCreatePassword(e.target.value)}
                />
              </div>

              <div>
                <label>Assigned Role Tier</label>
                <select
                  value={createRole}
                  onChange={e => setCreateRole(e.target.value as any)}
                >
                  <option value="client">Client (View-Only, No Edit Authority)</option>
                  <option value="subadmin">Sub-Admin (Operations, No Deletions / No User Admin)</option>
                  <option value="admin">Administrator (Full Operational Access)</option>
                  <option value="master">Master Control (Full Superadmin Access)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser || !newUsername || createPassword.length < 6}
                  className="btn-primary"
                >
                  {creatingUser ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
