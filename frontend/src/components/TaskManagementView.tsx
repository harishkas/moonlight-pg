import React, { useState, useEffect } from 'react'
import {
  CheckSquare,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  User,
  X,
  Calendar,
  Layers,
  RotateCcw
} from 'lucide-react'
import { PgTaskItem } from '../types'

interface Props {
  isClient?: boolean
}

export default function TaskManagementView({ isClient }: Props = {}) {
  const [tasks, setTasks] = useState<PgTaskItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  // New Task Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Maintenance')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [creating, setCreating] = useState(false)

  // Complete Task Modal state
  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', { credentials: 'include' })
      if (res.ok) setTasks(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    setCreating(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          assigned_to: assignedTo,
          due_date: dueDate || null
        })
      })
      if (res.ok) {
        setModalOpen(false)
        setTitle('')
        setDescription('')
        setCategory('Maintenance')
        setPriority('Medium')
        setAssignedTo('')
        setDueDate('')
        loadTasks()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleCompleteTask = async () => {
    if (!completeTaskId) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/tasks/${completeTaskId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_notes: completionNotes })
      })
      if (res.ok) {
        setCompleteTaskId(null)
        setCompletionNotes('')
        loadTasks()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCompleting(false)
    }
  }

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) loadTasks()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = tasks.filter(t => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        t.title.toLowerCase().includes(q) ||
        t.task_number.toLowerCase().includes(q) ||
        (t.assigned_to && t.assigned_to.toLowerCase().includes(q))
      )
    }
    return true
  })

  const pendingCount = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="section-indicator-dot" />
            WORK ORDERS & FACILITY OPERATIONS
          </p>
          <div className="flex-row gap-8 align-center">
            <h1>Internal Task Management</h1>
            {pendingCount > 0 && (
              <span className="badge badge-status-pending">{pendingCount} Active</span>
            )}
          </div>
          <p className="muted">
            Track building repairs, routine cleaning schedules, rent collections, and staff work orders.
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={loadTasks} title="Refresh Tasks">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {!isClient && (
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={15} /> Create Work Order
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search work orders, codes, or assignees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="select-sm"
          >
            <option value="all">All Categories</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Rent Collection">Rent Collection</option>
            <option value="Administrative">Administrative</option>
            <option value="Security">Security</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Task List Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task Code</th>
              <th>Task Title & Scope</th>
              <th>Priority</th>
              <th>Category</th>
              <th>Assignee</th>
              <th>Due Date</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-24 text-muted">
                  Loading operational work orders...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-24 text-muted">
                  No operational tasks found matching your criteria.
                </td>
              </tr>
            ) : (
              filtered.map(t => {
                const isCompleted = t.status === 'Completed'
                return (
                  <tr key={t.id}>
                    <td>
                      <span className="badge badge-code">{t.task_number}</span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                          {t.title}
                        </strong>
                        {t.description && (
                          <small className="muted-text" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                            {t.description}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          t.priority === 'Urgent'
                            ? 'badge-vacated'
                            : t.priority === 'High'
                            ? 'badge-status-pending'
                            : 'badge-primary'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge category-badge-other">{t.category}</span>
                    </td>
                    <td>
                      {t.assigned_to ? (
                        <div className="flex-row gap-4 align-center text-xs font-medium">
                          <User size={12} className="text-muted" /> {t.assigned_to}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {t.due_date ? (
                        <div className="flex-row gap-4 align-center font-mono text-xs">
                          <Calendar size={11} className="text-muted" /> {t.due_date}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${isCompleted ? 'badge-active' : t.status === 'In Progress' ? 'badge-primary' : 'badge-status-pending'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="row-actions">
                        {!isCompleted && !isClient && (
                          <>
                            {t.status === 'Pending' && (
                              <button
                                onClick={() => handleStatusChange(t.id, 'In Progress')}
                                className="btn-secondary btn-xs"
                              >
                                Start Task
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setCompleteTaskId(t.id)
                                setCompletionNotes('')
                              }}
                              className="btn-primary btn-xs"
                            >
                              <CheckCircle2 size={12} /> Complete
                            </button>
                          </>
                        )}
                        {isCompleted && (
                          <span className="badge badge-active">
                            <CheckCircle2 size={11} /> Done
                          </span>
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

      {/* Create Task Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <h3>Create Work Order</h3>
                  <p className="muted-text">Schedule maintenance, repairs, or resident operational follow-ups</p>
                </div>
              </div>
              <button className="icon-btn-sm" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateTask} className="modal-form">
              <div>
                <label>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Repair AC drainage pipe in Room 302"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label>Description & Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Provide scope details, vendor contact, or resident notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label>Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Rent Collection">Rent Collection</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Security">Security</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label>Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label>Assign To (Staff/Admin)</label>
                  <input
                    type="text"
                    placeholder="e.g. Electrician Suresh"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                  />
                </div>

                <div>
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Saving Task…' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {completeTaskId && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex-row gap-8 align-center">
                <div className="modal-icon" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3>Complete Work Order</h3>
                  <p className="muted-text">Document completion notes, vendor invoice, or observations</p>
                </div>
              </div>
              <button className="icon-btn-sm" onClick={() => setCompleteTaskId(null)}><X size={16} /></button>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleCompleteTask(); }} className="modal-form">
              <div>
                <label>Completion Notes & Resolution</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Fixed drainage leak, tested unit for 30 minutes, verified cool airflow."
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setCompleteTaskId(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={completing} className="btn-primary">
                  {completing ? 'Completing…' : 'Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
