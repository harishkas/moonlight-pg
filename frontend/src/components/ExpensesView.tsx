import { useEffect, useState } from 'react'
import {
  TrendingDown,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { Expense } from '../types'
import { EXPENSE_CATEGORIES } from './ExpenseModal'

interface Props {
  onAddExpense?: () => void
  onEditExpense?: (expense: Expense) => void
  isClient?: boolean
}

export default function ExpensesView({ onAddExpense, onEditExpense, isClient = false }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState(false)

  async function fetchExpenses() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (monthFilter !== 'all') params.set('month', monthFilter)
      params.set('year', String(yearFilter))

      const res = await fetch(`/api/expenses?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load expenses')
      const data = await res.json()
      setExpenses(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [search, categoryFilter, monthFilter, yearFilter])

  async function handleConfirmDelete() {
    if (!deletingExpense) return
    setSubmittingDelete(true)
    try {
      const res = await fetch(`/api/expenses/${deletingExpense.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to delete expense')
      setDeletingExpense(null)
      fetchExpenses()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSubmittingDelete(false)
    }
  }

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0)
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">PROPERTY OUTFLOWS · EXPENDITURE LEDGER</p>
          <h1>Expense Management</h1>
          <p className="muted">Track food & groceries, utilities, maintenance, housekeeping, staff salaries, and repairs.</p>
        </div>
        {!isClient && onAddExpense && (
          <button className="btn-primary" onClick={onAddExpense}>
            <Plus size={16} /> Record Expense
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error margin-bottom-16">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI banner */}
      <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <small className="muted-text">Filtered Outflow Total</small>
          <strong style={{ fontSize: '20px', color: 'var(--danger)' }}>
            ₹{totalExpenseAmount.toLocaleString('en-IN')}
          </strong>
        </div>
        <div className="stat-card">
          <small className="muted-text">Total Recorded Items</small>
          <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
            {expenses.length} Records
          </strong>
        </div>
        <div className="stat-card">
          <small className="muted-text">Audited Records</small>
          <span className="badge badge-active" style={{ marginTop: '8px' }}>
            Preserved in Audit Log
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search expense title, voucher #, or vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div className="filter-group">
          <Filter size={15} className="muted-text" />
          <span className="filter-label">Category:</span>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="select-sm">
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div className="filter-group margin-left-auto">
          <Calendar size={15} className="muted-text" />
          <span className="filter-label">Month:</span>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="select-sm">
            <option value="all">All Months</option>
            {months.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive-wrapper">
        {loading ? (
          <div className="loading-container">Loading expense entries...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state-card">
            <TrendingDown size={36} className="muted-text" />
            <h4>No expenses match criteria</h4>
            <p className="muted-text">Add your first operational expense to track property outflow.</p>
            <button className="btn-primary btn-sm margin-top-12" onClick={onAddExpense}>
              <Plus size={14} /> Record Expense
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Title / Description</th>
                <th>Category</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Paid To / Vendor</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>
                    <span className="badge badge-code">{e.expense_number}</span>
                  </td>
                  <td>
                    <div>
                      <strong>{e.title}</strong>
                      {e.description && (
                        <small className="muted-text" style={{ display: 'block', fontSize: '11px' }}>
                          {e.description}
                        </small>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-primary">{e.category}</span>
                  </td>
                  <td>{e.expense_date}</td>
                  <td>
                    <strong style={{ fontSize: '13px', color: 'var(--danger)' }}>
                      ₹{e.amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>{e.payment_mode}</td>
                  <td>
                    <div>{e.paid_to || 'N/A'}</div>
                    {e.reference_number && (
                      <small className="muted-text" style={{ fontSize: '10px' }}>
                        Ref: {e.reference_number}
                      </small>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      {!isClient && onEditExpense && (
                        <button
                          className="btn-icon-action"
                          title="Edit Expense"
                          onClick={() => onEditExpense(e)}
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      {!isClient && (
                        <button
                          className="btn-icon-action text-danger"
                          title="Delete Record"
                          onClick={() => setDeletingExpense(e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isClient && (
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>
                          View Only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon text-danger bg-danger-light">
                  <Trash2 size={18} />
                </div>
                <h3>Delete Expense Record?</h3>
              </div>
            </div>
            <p className="margin-top-12">
              Are you sure you want to remove <strong>{deletingExpense.title} (₹{deletingExpense.amount.toLocaleString('en-IN')})</strong>?
            </p>
            <p className="muted-text margin-top-8">
              The entry will be soft-deleted and an audit log will be permanently preserved.
            </p>
            <div className="modal-actions margin-top-20">
              <button
                className="btn-secondary"
                onClick={() => setDeletingExpense(null)}
                disabled={submittingDelete}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={submittingDelete}
              >
                {submittingDelete ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
