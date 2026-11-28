import React, { useEffect, useState } from 'react'
import {
  Building2,
  LayoutDashboard,
  Users,
  BedDouble,
  ClipboardList,
  Wallet,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Receipt as ReceiptIcon,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
  Database,
  Utensils,
  Coffee,
  Wifi,
  Car,
  Wind,
  Zap,
  Layers,
  FileCheck2,
  PieChart,
  Bell,
  BarChart3,
  CheckSquare,
  History,
  HardDrive,
  Activity,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown
} from 'lucide-react'
import { User, DashboardData, Tenant, Room, RentInvoice, Deposit, Expense } from './types'

// Phase 2 Views
import DashboardView from './components/DashboardView'
import TenantsView from './components/TenantsView'
import TenantDetailView from './components/TenantDetailView'
import RoomsView from './components/RoomsView'
import AllocationsView from './components/AllocationsView'
import TenantModal from './components/TenantModal'
import TenantDetailModal from './components/TenantDetailModal'
import RoomModal from './components/RoomModal'
import RoomDetailModal from './components/RoomDetailModal'
import AllocateModal from './components/AllocateModal'
import VacateModal from './components/VacateModal'

// Phase 3 Views & Modals
import FinancialDashboardView from './components/FinancialDashboardView'
import RentManagementView from './components/RentManagementView'
import PaymentsView from './components/PaymentsView'
import DepositsView from './components/DepositsView'
import ExpensesView from './components/ExpensesView'
import ReceiptsView from './components/ReceiptsView'
import ReportsView from './components/ReportsView'

import RecordPaymentModal from './components/RecordPaymentModal'
import GenerateRentModal from './components/GenerateRentModal'
import AdjustInvoiceModal from './components/AdjustInvoiceModal'
import DepositModal from './components/DepositModal'
import ExpenseModal from './components/ExpenseModal'

// Phase 4 Views & Modals
import ServicesDashboardView from './components/ServicesDashboardView'
import FoodPlansView from './components/FoodPlansView'
import FoodSubscriptionsView from './components/FoodSubscriptionsView'
import DailyMealManagementView from './components/DailyMealManagementView'
import WifiManagementView from './components/WifiManagementView'
import ParkingManagementView from './components/ParkingManagementView'
import AcManagementView from './components/AcManagementView'
import ElectricityManagementView from './components/ElectricityManagementView'
import AdditionalServicesView from './components/AdditionalServicesView'
import ServiceBillingView from './components/ServiceBillingView'
import ServiceReportsView from './components/ServiceReportsView'
import GenerateServiceBillingModal from './components/GenerateServiceBillingModal'

// Phase 6 Views & Modals: Automation, Notifications & Analytics
import NotificationCenterModal from './components/NotificationCenterModal'
import NotificationsView from './components/NotificationsView'
import AutomationDashboardView from './components/AutomationDashboardView'
import AnalyticsDashboardView from './components/AnalyticsDashboardView'
import AutomatedReportsView from './components/AutomatedReportsView'
import TaskManagementView from './components/TaskManagementView'
import AuditLogsView from './components/AuditLogsView'
import BackupManagementView from './components/BackupManagementView'
import DataImportExportView from './components/DataImportExportView'
import SystemHealthView from './components/SystemHealthView'
import UserManagementView from './components/UserManagementView'
import { Key } from 'lucide-react'

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.detail || `Request failed (${r.status})`)
  }
  return r.json()
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [notice, setNotice] = useState('')

  // Current view navigation
  type ViewType =
    | 'dashboard'
    | 'tenants'
    | 'rooms'
    | 'allocations'
    | 'financial'
    | 'rent'
    | 'payments'
    | 'deposits'
    | 'expenses'
    | 'receipts'
    | 'reports'
    | 'services-dashboard'
    | 'food-plans'
    | 'food-subs'
    | 'daily-meals'
    | 'wifi'
    | 'parking'
    | 'ac'
    | 'electricity'
    | 'custom-services'
    | 'service-billing'
    | 'service-reports'
    | 'notifications'
    | 'automation'
    | 'analytics'
    | 'automated-reports'
    | 'tasks'
    | 'audit-logs'
    | 'backup-manager'
    | 'import-export'
    | 'system-health'
    | 'settings'
    | 'users'

  const [currentView, setCurrentView] = useState<ViewType>('dashboard')

  // Phase 6 Notifications & Automation state
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

  const refreshUnreadCount = async () => {
    try {
      const r = await fetch('/api/notifications/unread-count', { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setUnreadNotificationsCount(data.count || 0)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Phase 4 Billing modal state
  const [generateServiceBillingModalOpen, setGenerateServiceBillingModalOpen] = useState(false)

  // Phase 2 Modals state
  const [tenantModalOpen, setTenantModalOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [detailTenantId, setDetailTenantId] = useState<number | null>(null)

  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [detailRoom, setDetailRoom] = useState<Room | null>(null)

  const [allocateModalOpen, setAllocateModalOpen] = useState(false)
  const [allocateTenant, setAllocateTenant] = useState<Tenant | null>(null)
  const [allocateRoomId, setAllocateRoomId] = useState<number | null>(null)

  const [vacateModalData, setVacateModalData] = useState<{
    allocationId: number
    tenantName: string
    bedNumber: string
    roomNumber: string
  } | null>(null)

  // Phase 3 Modals state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentInitialTenantId, setPaymentInitialTenantId] = useState<number | null>(null)
  const [paymentInitialInvoiceId, setPaymentInitialInvoiceId] = useState<number | null>(null)

  const [generateRentModalOpen, setGenerateRentModalOpen] = useState(false)

  const [adjustInvoiceModalData, setAdjustInvoiceModalData] = useState<RentInvoice | null>(null)

  const [depositModalState, setDepositModalState] = useState<{
    open: boolean
    mode: 'create' | 'adjust' | 'refund'
    deposit?: Deposit | null
    tenantId?: number | null
  }>({ open: false, mode: 'create' })

  const [expenseModalState, setExpenseModalState] = useState<{
    open: boolean
    expense?: Expense | null
  }>({ open: false })

  const isMaster = user?.role === 'master' || user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin'
  const isClient = user?.role === 'client'

  // Collapsible Tree-Branch Navigation state
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({
    'core': true,
    'financial': false,
    'services': false,
    'automation': false,
    'system': false,
  })

  const treeBranches = [
    {
      id: 'core',
      label: 'Core & Residents',
      icon: Users,
      items: [
        { id: 'tenants', label: 'Tenants Directory', icon: Users },
        { id: 'rooms', label: 'Rooms & Beds', icon: BedDouble },
        { id: 'allocations', label: 'Allocations History', icon: ClipboardList },
      ]
    },
    {
      id: 'financial',
      label: 'Financial Management',
      icon: Wallet,
      items: [
        { id: 'financial', label: 'Financial Dashboard', icon: TrendingUp },
        { id: 'rent', label: 'Rent Management', icon: Wallet },
        { id: 'payments', label: 'Payments & Collections', icon: CreditCard },
        { id: 'deposits', label: 'Advance & Deposits', icon: ShieldCheck },
        { id: 'expenses', label: 'Expenses', icon: TrendingDown },
        { id: 'receipts', label: 'Receipts Archive', icon: ReceiptIcon },
        { id: 'reports', label: 'Financial Reports', icon: FileSpreadsheet },
      ]
    },
    {
      id: 'services',
      label: 'Services & Facilities',
      icon: Utensils,
      items: [
        { id: 'food-plans', label: 'Food Planning', icon: Utensils },
        { id: 'food-subs', label: 'Food Subscriptions', icon: Coffee },
        { id: 'parking', label: 'Parking Management', icon: Car },
        { id: 'electricity', label: 'Electricity & Meters', icon: Zap },
      ]
    },
    {
      id: 'automation',
      label: 'Automation & Analytics',
      icon: BarChart3,
      items: [
        { id: 'analytics', label: 'Business Analytics', icon: BarChart3 },
        { id: 'automated-reports', label: 'Automated Reports', icon: FileSpreadsheet },
        { id: 'notifications', label: 'Notification Center', icon: Bell },
        { id: 'tasks', label: 'Task Management', icon: CheckSquare },
        { id: 'automation', label: 'Automation & Jobs', icon: Layers },
        { id: 'audit-logs', label: 'System Audit Logs', icon: History },
        { id: 'backup-manager', label: 'Backup & Recovery', icon: HardDrive },
        { id: 'import-export', label: 'Data Import & Export', icon: FileCheck2 },
        { id: 'system-health', label: 'System Health', icon: Activity },
      ]
    },
    {
      id: 'system',
      label: 'System & Control',
      icon: Settings,
      items: [
        { id: 'settings', label: 'Settings & Backups', icon: Settings },
        ...(isMaster ? [{ id: 'users', label: 'User & Access Control', icon: Key }] : [])
      ]
    }
  ]

  // Automatically keep parent branch open when viewing one of its sub-items
  useEffect(() => {
    for (const b of treeBranches) {
      if (b.items.some(i => i.id === currentView)) {
        setOpenBranches(prev => ({ ...prev, [b.id]: true }))
        break
      }
    }
  }, [currentView])

  const toggleBranch = (branchId: string) => {
    setOpenBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }))
  }

  const toggleAllBranches = () => {
    const allOpen = Object.values(openBranches).every(Boolean)
    const nextVal = !allOpen
    setOpenBranches({
      'core': nextVal,
      'financial': nextVal,
      'services': nextVal,
      'automation': nextVal,
      'system': nextVal,
    })
  }

  async function refreshDashboard() {
    try {
      const data = await api<DashboardData>('/api/dashboard')
      setDash(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    api<User>('/api/auth/me')
      .then(async u => {
        setUser(u)
        await refreshDashboard()
        await refreshUnreadCount()
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await api<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      setUser(u)
      setPassword('')
      await refreshDashboard()
      await refreshUnreadCount()
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setDash(null)
  }

  async function openRoomDetails(roomId: number) {
    try {
      const room = await api<Room>(`/api/rooms/${roomId}`)
      setDetailRoom(room)
    } catch (e) {
      setNotice('Could not load room details.')
    }
  }

  if (loading) {
    return <div className="loading">Loading Moon Light PG…</div>
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark"><Building2 size={27} /></div>
          <p className="eyebrow">PROPERTY MANAGEMENT SYSTEM</p>
          <h1>Moon Light PG</h1>
          <p className="muted">Sign in to manage operations & finances</p>
          <form onSubmit={signIn}>
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="Enter username"
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter password"
            />
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="secure-note" style={{ marginTop: '16px' }}>
            <ShieldCheck size={16} /> Enterprise Access Control · Authorized Personnel Only
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="small-mark"><Building2 size={20} /></div>
          <div>
            <strong>Moon Light PG</strong>
            <small>Management System</small>
          </div>
          <button className="mobile-close" onClick={() => setMenu(false)}><X /></button>
        </div>

        <div className="sidebar-scrollable">
          {/* Main Quick Access */}
          <div className="nav-top-quick">
            <button
              className={`nav-item nav-home-item ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('dashboard')
                setMenu(false)
              }}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
          </div>

          <div className="nav-tree-header">
            <span>MODULES</span>
            <button
              type="button"
              className="btn-toggle-all"
              onClick={toggleAllBranches}
              title="Expand or collapse all categories"
            >
              <ChevronsUpDown size={12} />
              <span>{Object.values(openBranches).every(Boolean) ? 'Collapse' : 'Expand'}</span>
            </button>
          </div>

          {/* Tree-Branch Structure */}
          <div className="nav-tree-branches">
            {treeBranches.map(branch => {
              const isOpen = !!openBranches[branch.id]
              const isBranchActive = branch.items.some(i => i.id === currentView)
              const BranchIcon = branch.icon

              return (
                <div key={branch.id} className={`nav-tree-branch ${isBranchActive ? 'branch-active' : ''}`}>
                  <button
                    type="button"
                    className={`branch-header-btn ${isOpen ? 'open' : ''} ${isBranchActive ? 'active-parent' : ''}`}
                    onClick={() => toggleBranch(branch.id)}
                  >
                    <div className="branch-title-group">
                      <BranchIcon size={15} className="branch-main-icon" />
                      <span className="branch-title-text">{branch.label}</span>
                    </div>
                    <div className="branch-meta-group">
                      <span className="branch-count-pill">{branch.items.length}</span>
                      {isOpen ? (
                        <ChevronDown size={14} className="branch-arrow" />
                      ) : (
                        <ChevronRight size={14} className="branch-arrow" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="branch-children-container">
                      <div className="tree-guide-line" />
                      <div className="branch-items-list">
                        {branch.items.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            className={`nav-item nav-sub-item ${currentView === id && (!detailTenantId || id !== 'tenants') ? 'active' : ''}`}
                            onClick={() => {
                              setCurrentView(id as ViewType)
                              if (id === 'tenants') setDetailTenantId(null)
                              setMenu(false)
                            }}
                          >
                            <span className="tree-leaf-indicator" />
                            <Icon size={14} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="status-dot" /> Local SQLite active
          </div>
          <small>Phase 4 · Services & Facilities</small>
        </div>
      </aside>

      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      {/* Main Workspace Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="flex-row gap-12 align-center">
            <button className="mobile-menu" onClick={() => setMenu(true)}><Menu /></button>
            <div>
              <span className="crumb">Moon Light PG /</span>
              {currentView === 'tenants' && detailTenantId ? (
                <>
                  <span
                    className="crumb text-primary-link"
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setDetailTenantId(null)}
                  >
                    Tenants
                  </span>
                  <span className="crumb"> /</span>
                  <strong className="view-title-capitalize">Resident Dossier</strong>
                </>
              ) : (
                <strong className="view-title-capitalize">
                  {currentView === 'financial' ? 'Financial Dashboard' : currentView}
                </strong>
              )}
            </div>
          </div>

          <div className="flex-row gap-12 align-center">
            {isMaster && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f59e0b1a', color: '#f59e0b', border: '1px solid #f59e0b55', fontWeight: 600, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>
                👑 Master Control
              </span>
            )}
            {isAdmin && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#3b82f61a', color: '#60a5fa', border: '1px solid #3b82f655', fontWeight: 600, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>
                🛡️ Administrator
              </span>
            )}
            {isClient && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0284c71a', color: '#38bdf8', border: '1px solid #38bdf855', fontWeight: 600, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>
                🔒 View-Only Mode (Client)
              </span>
            )}

            <button
              className="icon-button"
              style={{ position: 'relative', cursor: 'pointer' }}
              title="Notifications"
              onClick={() => setNotificationModalOpen(true)}
            >
              <Bell size={18} />
              {unreadNotificationsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '9999px',
                    padding: '1px 5px',
                    lineHeight: 1
                  }}
                >
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <div className="user-menu">
              <div className="avatar" style={{ background: isMaster ? '#f59e0b' : isAdmin ? '#3b82f6' : '#0284c7' }}>
                {user.username[0].toUpperCase()}
              </div>
              <div className="user-name">
                <strong>{user.username}</strong>
                <small>{isMaster ? 'Master Control' : isAdmin ? 'Administrator' : 'Client (View-Only)'}</small>
              </div>
              <button className="icon-button" title="Sign out" onClick={signOut}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {notice && (
          <div className="toast-notice">
            <span>{notice}</span>
            <button className="icon-btn-sm" onClick={() => setNotice('')}><X size={14} /></button>
          </div>
        )}

        <div className="content">
          {currentView === 'dashboard' && (
            <DashboardView
              dash={dash}
              onRefresh={refreshDashboard}
              onNavigate={(viewId) => setCurrentView(viewId)}
              onAddTenant={!isClient ? () => {
                setEditingTenant(null)
                setTenantModalOpen(true)
              } : undefined}
              onAddRoom={!isClient ? () => {
                setEditingRoom(null)
                setRoomModalOpen(true)
              } : undefined}
              onAllocate={!isClient ? () => {
                setAllocateTenant(null)
                setAllocateRoomId(null)
                setAllocateModalOpen(true)
              } : undefined}
              onSelectRoom={openRoomDetails}
            />
          )}

          {currentView === 'financial' && (
            <FinancialDashboardView
              onCollectPayment={!isClient ? () => {
                setPaymentInitialTenantId(null)
                setPaymentInitialInvoiceId(null)
                setPaymentModalOpen(true)
              } : undefined}
              onGenerateRent={!isClient ? () => setGenerateRentModalOpen(true) : undefined}
              onAddExpense={!isClient ? () => setExpenseModalState({ open: true, expense: null }) : undefined}
              onRecordDeposit={!isClient ? () => setDepositModalState({ open: true, mode: 'create' }) : undefined}
            />
          )}

          {currentView === 'tenants' && (
            detailTenantId ? (
              <TenantDetailView
                tenantId={detailTenantId}
                isClient={isClient}
                onBack={() => setDetailTenantId(null)}
                onEditTenant={!isClient ? t => {
                  setEditingTenant(t)
                  setTenantModalOpen(true)
                } : undefined}
                onAllocateTenant={!isClient ? t => {
                  setAllocateTenant(t)
                  setAllocateRoomId(null)
                  setAllocateModalOpen(true)
                } : undefined}
                onVacateTenant={!isClient ? (allocationId, tenantName, bedNumber, roomNumber) => {
                  setVacateModalData({ allocationId, tenantName, bedNumber, roomNumber })
                } : undefined}
                onRecordPayment={!isClient ? tId => {
                  setPaymentInitialTenantId(tId)
                  setPaymentInitialInvoiceId(null)
                  setPaymentModalOpen(true)
                } : undefined}
              />
            ) : (
              <TenantsView
                isMaster={isMaster}
                onAddTenant={!isClient ? () => {
                  setEditingTenant(null)
                  setTenantModalOpen(true)
                } : undefined}
                onViewTenant={id => setDetailTenantId(id)}
                onEditTenant={!isClient ? t => {
                  setEditingTenant(t)
                  setTenantModalOpen(true)
                } : undefined}
                onAllocateTenant={!isClient ? t => {
                  setAllocateTenant(t)
                  setAllocateRoomId(null)
                  setAllocateModalOpen(true)
                } : undefined}
                onVacateTenant={!isClient ? (allocationId, tenantName, bedNumber, roomNumber) => {
                  setVacateModalData({ allocationId, tenantName, bedNumber, roomNumber })
                } : undefined}
              />
            )
          )}

          {currentView === 'rooms' && (
            <RoomsView
              isMaster={isMaster}
              isClient={isClient}
              onAddRoom={!isClient ? () => {
                setEditingRoom(null)
                setRoomModalOpen(true)
              } : undefined}
              onEditRoom={!isClient ? r => {
                setEditingRoom(r)
                setRoomModalOpen(true)
              } : undefined}
              onSelectRoom={openRoomDetails}
              onAllocateBedInRoom={!isClient ? roomId => {
                setAllocateTenant(null)
                setAllocateRoomId(roomId)
                setAllocateModalOpen(true)
              } : undefined}
              onVacate={!isClient ? (allocationId, tenantName, bedNumber, roomNumber) => {
                setVacateModalData({ allocationId, tenantName, bedNumber, roomNumber })
              } : undefined}
            />
          )}

          {currentView === 'rent' && (
            <RentManagementView
              isClient={isClient}
              onGenerateRent={!isClient ? () => setGenerateRentModalOpen(true) : undefined}
              onCollectPaymentForInvoice={!isClient ? inv => {
                setPaymentInitialTenantId(inv.tenant_id)
                setPaymentInitialInvoiceId(inv.id)
                setPaymentModalOpen(true)
              } : undefined}
              onAdjustInvoice={!isClient ? inv => setAdjustInvoiceModalData(inv) : undefined}
            />
          )}

          {currentView === 'payments' && (
            <PaymentsView
              isClient={isClient}
              onRecordPayment={!isClient ? () => {
                setPaymentInitialTenantId(null)
                setPaymentInitialInvoiceId(null)
                setPaymentModalOpen(true)
              } : undefined}
            />
          )}

          {currentView === 'deposits' && (
            <DepositsView
              isClient={isClient}
              onRecordDeposit={!isClient ? () => setDepositModalState({ open: true, mode: 'create' }) : undefined}
              onAdjustDeposit={!isClient ? d => setDepositModalState({ open: true, mode: 'adjust', deposit: d }) : undefined}
              onRefundDeposit={!isClient ? d => setDepositModalState({ open: true, mode: 'refund', deposit: d }) : undefined}
            />
          )}

          {currentView === 'expenses' && (
            <ExpensesView
              isClient={isClient}
              onAddExpense={!isClient ? () => setExpenseModalState({ open: true, expense: null }) : undefined}
              onEditExpense={!isClient ? e => setExpenseModalState({ open: true, expense: e }) : undefined}
            />
          )}

          {currentView === 'receipts' && <ReceiptsView />}

          {currentView === 'reports' && <ReportsView />}

          {currentView === 'allocations' && (
            <AllocationsView
              onNewAllocation={!isClient ? () => {
                setAllocateTenant(null)
                setAllocateRoomId(null)
                setAllocateModalOpen(true)
              } : undefined}
              onVacate={!isClient ? (allocationId, tenantName, bedNumber, roomNumber) => {
                setVacateModalData({ allocationId, tenantName, bedNumber, roomNumber })
              } : undefined}
            />
          )}

          {/* Phase 4: Food, Facilities & Additional Services Views */}
          {currentView === 'services-dashboard' && (
            <ServicesDashboardView
              isClient={isClient}
              onNavigate={id => setCurrentView(id)}
              onGenerateBilling={!isClient ? () => setGenerateServiceBillingModalOpen(true) : undefined}
            />
          )}

          {currentView === 'food-plans' && <FoodPlansView isClient={isClient} />}
          {currentView === 'food-subs' && <FoodSubscriptionsView isClient={isClient} />}
          {currentView === 'daily-meals' && <DailyMealManagementView />}
          {currentView === 'wifi' && <WifiManagementView />}
          {currentView === 'parking' && <ParkingManagementView isClient={isClient} />}
          {currentView === 'ac' && <AcManagementView />}
          {currentView === 'electricity' && <ElectricityManagementView isClient={isClient} />}
          {currentView === 'custom-services' && <AdditionalServicesView />}
          {currentView === 'service-billing' && (
            <ServiceBillingView
              isClient={isClient}
              onGenerateBilling={!isClient ? () => setGenerateServiceBillingModalOpen(true) : undefined}
            />
          )}
          {currentView === 'service-reports' && <ServiceReportsView />}

          {/* Phase 6: Automation, Notifications & Analytics Views */}
          {currentView === 'notifications' && (
            <NotificationsView
              isClient={isClient}
              onRefreshUnread={refreshUnreadCount}
              onNavigateTo={id => setCurrentView(id)}
            />
          )}
          {currentView === 'automation' && <AutomationDashboardView isClient={isClient} />}
          {currentView === 'analytics' && <AnalyticsDashboardView />}
          {currentView === 'automated-reports' && <AutomatedReportsView />}
          {currentView === 'tasks' && <TaskManagementView isClient={isClient} />}
          {currentView === 'audit-logs' && <AuditLogsView />}
          {currentView === 'backup-manager' && <BackupManagementView isClient={isClient} />}
          {currentView === 'import-export' && <DataImportExportView isClient={isClient} />}
          {currentView === 'system-health' && <SystemHealthView />}

          {currentView === 'users' && <UserManagementView />}

          {currentView === 'settings' && (
            <div className="view-container">
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">CONFIGURATION & MAINTENANCE</p>
                  <h1>System Settings</h1>
                  <p className="muted">Property credentials, database parameters, and maintenance logs.</p>
                </div>
              </div>

              <div className="section-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Property Details</h3>
                  </div>
                  <div className="info-grid margin-top-12">
                    <div className="info-item">
                      <small>Property Name</small>
                      <strong>Moon Light PG</strong>
                    </div>
                    <div className="info-item">
                      <small>Current Phase</small>
                      <strong>Phase 4 (Food, Facilities & Additional Services)</strong>
                    </div>
                    <div className="info-item">
                      <small>Database Mode</small>
                      <strong>SQLite 3 with WAL Journaling</strong>
                    </div>
                    <div className="info-item">
                      <small>Receipt Storage</small>
                      <strong>Local PDF Receipts (/data/receipts)</strong>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h3>Database Backup Tools</h3>
                  </div>
                  <p className="muted-text">
                    Create immediate point-in-time snapshots of all rooms, beds, tenants, allocations, rent, payments, deposits, and services.
                  </p>
                  {!isClient ? (
                    <button
                      className="btn-primary margin-top-16"
                      onClick={async () => {
                        try {
                          const r = await api<{ filename: string }>('/api/admin/backup', { method: 'POST' })
                          setNotice(`Backup snapshot created successfully: ${r.filename}`)
                        } catch (e) {
                          setNotice('Backup trigger failed')
                        }
                      }}
                    >
                      <Database size={15} /> Create Backup Snapshot
                    </button>
                  ) : (
                    <div className="badge badge-info margin-top-16" style={{ display: 'inline-block' }}>
                      🔒 Backups managed by Administrator / Master Control
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          <div className="footer-note">
            Moon Light PG · Phase 4 Food, Facilities & Services · Local-first Windows Application
          </div>
        </div>
      </main>

      {/* --- Modals --- */}

      {/* Phase 4: Centralized Service Billing Modal */}
      {generateServiceBillingModalOpen && (
        <GenerateServiceBillingModal
          isOpen={generateServiceBillingModalOpen}
          onClose={() => setGenerateServiceBillingModalOpen(false)}
          onGenerated={() => {
            setNotice('Service billing run executed successfully!')
            refreshDashboard()
          }}
        />
      )}

      {/* Phase 2: Add / Edit Tenant */}
      {tenantModalOpen && (
        <TenantModal
          tenant={editingTenant}
          onClose={() => {
            setTenantModalOpen(false)
            setEditingTenant(null)
          }}
          onSuccess={() => {
            setTenantModalOpen(false)
            setEditingTenant(null)
            refreshDashboard()
            setNotice(editingTenant ? 'Tenant updated successfully.' : 'New tenant registered successfully.')
          }}
        />
      )}

      {/* Phase 2: Add / Edit Room */}
      {roomModalOpen && (
        <RoomModal
          room={editingRoom}
          onClose={() => {
            setRoomModalOpen(false)
            setEditingRoom(null)
          }}
          onSuccess={() => {
            setRoomModalOpen(false)
            setEditingRoom(null)
            refreshDashboard()
            setNotice(editingRoom ? 'Room updated.' : 'New room created with bed inventory.')
          }}
        />
      )}

      {/* Phase 2: Room Details */}
      {detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          onClose={() => setDetailRoom(null)}
          onRefresh={async () => {
            const updated = await api<Room>(`/api/rooms/${detailRoom.id}`)
            setDetailRoom(updated)
            refreshDashboard()
          }}
          onVacate={(allocId, tName, bNum, rNum) => {
            setDetailRoom(null)
            setVacateModalData({ allocationId: allocId, tenantName: tName, bedNumber: bNum, roomNumber: rNum })
          }}
        />
      )}

      {/* Phase 2: Allocate Bed */}
      {allocateModalOpen && (
        <AllocateModal
          initialTenant={allocateTenant}
          initialRoomId={allocateRoomId}
          onClose={() => {
            setAllocateModalOpen(false)
            setAllocateTenant(null)
            setAllocateRoomId(null)
          }}
          onSuccess={() => {
            setAllocateModalOpen(false)
            setAllocateTenant(null)
            setAllocateRoomId(null)
            refreshDashboard()
            setNotice('Bed allocated successfully!')
          }}
        />
      )}

      {/* Phase 2: Vacate Tenant */}
      {vacateModalData && (
        <VacateModal
          allocationId={vacateModalData.allocationId}
          tenantName={vacateModalData.tenantName}
          bedNumber={vacateModalData.bedNumber}
          roomNumber={vacateModalData.roomNumber}
          onClose={() => setVacateModalData(null)}
          onSuccess={() => {
            setVacateModalData(null)
            refreshDashboard()
            setNotice(`Resident vacated and bed ${vacateModalData.bedNumber} released.`)
          }}
        />
      )}

      {/* Phase 3: Record Payment */}
      {paymentModalOpen && (
        <RecordPaymentModal
          initialTenantId={paymentInitialTenantId}
          initialInvoiceId={paymentInitialInvoiceId}
          onClose={() => {
            setPaymentModalOpen(false)
            setPaymentInitialTenantId(null)
            setPaymentInitialInvoiceId(null)
          }}
          onSuccess={() => {
            setPaymentModalOpen(false)
            setPaymentInitialTenantId(null)
            setPaymentInitialInvoiceId(null)
            refreshDashboard()
            setNotice('Payment recorded and PDF receipt generated!')
          }}
        />
      )}

      {/* Phase 3: Generate Monthly Rent */}
      {generateRentModalOpen && (
        <GenerateRentModal
          onClose={() => setGenerateRentModalOpen(false)}
          onSuccess={count => {
            setGenerateRentModalOpen(false)
            refreshDashboard()
            setNotice(`Generated ${count} monthly rent invoice(s)!`)
          }}
        />
      )}

      {/* Phase 3: Adjust Invoice */}
      {adjustInvoiceModalData && (
        <AdjustInvoiceModal
          invoice={adjustInvoiceModalData}
          onClose={() => setAdjustInvoiceModalData(null)}
          onSuccess={() => {
            setAdjustInvoiceModalData(null)
            refreshDashboard()
            setNotice('Invoice adjustment authorized and recorded.')
          }}
        />
      )}

      {/* Phase 3: Deposit Modal (Create / Adjust / Refund) */}
      {depositModalState.open && (
        <DepositModal
          mode={depositModalState.mode}
          deposit={depositModalState.deposit}
          initialTenantId={depositModalState.tenantId}
          onClose={() => setDepositModalState({ open: false, mode: 'create' })}
          onSuccess={() => {
            setDepositModalState({ open: false, mode: 'create' })
            refreshDashboard()
            setNotice('Deposit transaction completed and recorded.')
          }}
        />
      )}

      {/* Phase 3: Expense Modal */}
      {expenseModalState.open && (
        <ExpenseModal
          expense={expenseModalState.expense}
          onClose={() => setExpenseModalState({ open: false })}
          onSuccess={() => {
            setExpenseModalState({ open: false })
            refreshDashboard()
            setNotice('Expense entry saved.')
          }}
        />
      )}

      {/* Phase 6: Notification Center Modal */}
      <NotificationCenterModal
        isOpen={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        onRefreshUnread={refreshUnreadCount}
        onNavigateTo={view => {
          setNotificationModalOpen(false)
          setCurrentView(view as ViewType)
        }}
        isClient={isClient}
      />
    </div>
  )
}
