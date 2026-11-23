import { useEffect, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  CreditCard,
  Plus,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart
} from 'lucide-react'
import { FinancialDashboardData } from '../types'

interface Props {
  onCollectPayment?: () => void
  onGenerateRent?: () => void
  onAddExpense?: () => void
  onRecordDeposit?: () => void
}

export default function FinancialDashboardView({
  onCollectPayment,
  onGenerateRent,
  onAddExpense,
  onRecordDeposit
}: Props) {
  const [data, setData] = useState<FinancialDashboardData | null>(null)
  const [period, setPeriod] = useState<string>('this_month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchFinancialData(p: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/financial/dashboard?period=${p}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load financial dashboard')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching financials')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialData(period)
  }, [period])

  return (
    <div className="view-container">
      {/* Header */}
      <div className="welcome-row">
        <div>
          <p className="eyebrow">ACCOUNTING & REVENUE INTELLIGENCE · PHASE 3</p>
          <h1>Financial Dashboard</h1>
          <p className="muted">Live rent collections, operating income, expense breakdown, and deposit liabilities.</p>
        </div>
        <div className="action-buttons-group">
          <button className="btn-secondary" onClick={() => fetchFinancialData(period)}>
            <RefreshCw size={14} /> Refresh
          </button>
          {onGenerateRent && (
            <button className="btn-secondary" onClick={onGenerateRent}>
              <Calendar size={14} /> Generate Rent
            </button>
          )}
          {onAddExpense && (
            <button className="btn-secondary" onClick={onAddExpense}>
              <TrendingDown size={14} /> Add Expense
            </button>
          )}
          {onRecordDeposit && (
            <button className="btn-secondary" onClick={onRecordDeposit}>
              <ShieldCheck size={14} /> Record Deposit
            </button>
          )}
          {onCollectPayment && (
            <button className="btn-primary" onClick={onCollectPayment}>
              <DollarSign size={14} /> Collect Payment
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Tabs */}
      <div className="filters-bar">
        <div className="filter-group">
          <Calendar size={16} className="muted-text" />
          <span className="filter-label">Accounting Period:</span>
          {[
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'all', label: 'All Time' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`filter-pill ${period === tab.id ? 'active' : ''}`}
              onClick={() => setPeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {data && (
          <div className="margin-left-auto muted-text" style={{ fontSize: '12px' }}>
            Period: <strong>{data.start_date}</strong> to <strong>{data.end_date}</strong>
          </div>
        )}
      </div>

      {loading || !data ? (
        <div className="loading-container">Calculating financial metrics...</div>
      ) : (
        <>
          {/* Main 4 Primary KPI Summary Cards */}
          <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card highlight-occupied">
              <div className="stat-top">
                <span>Total Rent Expected</span>
                <span className="stat-icon icon-occupied"><Clock size={16} /></span>
              </div>
              <strong className="stat-value text-primary">₹{data.total_rent_expected.toLocaleString('en-IN')}</strong>
              <small>Billed in this period</small>
            </div>

            <div className="stat-card highlight-available">
              <div className="stat-top">
                <span>Total Rent Collected</span>
                <span className="stat-icon icon-available"><TrendingUp size={16} /></span>
              </div>
              <strong className="stat-value text-success">₹{data.total_rent_collected.toLocaleString('en-IN')}</strong>
              <small>Realized rent revenue</small>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-top">
                <span>Total Pending Rent</span>
                <span className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                  <AlertTriangle size={16} />
                </span>
              </div>
              <strong className="stat-value text-danger">₹{data.total_pending_rent.toLocaleString('en-IN')}</strong>
              <small>Outstanding rent receivables</small>
            </div>

            <div className="stat-card highlight-rate">
              <div className="stat-top">
                <span>Net Operating Income</span>
                <span className="stat-icon"><DollarSign size={16} /></span>
              </div>
              <strong className={`stat-value ${data.net_operating_income >= 0 ? 'text-success' : 'text-danger'}`}>
                ₹{data.net_operating_income.toLocaleString('en-IN')}
              </strong>
              <small>Operating Revenue minus Expenses</small>
            </div>
          </div>

          {/* Secondary 4 KPI Cards: Liability & Collection Breakdown */}
          <div className="stats-grid-8" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '-8px' }}>
            <div className="stat-card">
              <div className="stat-top">
                <span>Security Deposits Held</span>
                <span className="stat-icon"><ShieldCheck size={16} /></span>
              </div>
              <strong className="stat-value text-warning">₹{data.refundable_deposits_held.toLocaleString('en-IN')}</strong>
              <small className="badge badge-status-pending" style={{ display: 'inline-block', marginTop: '4px' }}>
                Liability (Not Profit)
              </small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Overdue Rent</span>
                <span className="stat-icon text-danger"><Clock size={16} /></span>
              </div>
              <strong className="stat-value text-danger">₹{data.overdue_rent.toLocaleString('en-IN')}</strong>
              <small>Past payment due date</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Total Period Expenses</span>
                <span className="stat-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                  <TrendingDown size={16} />
                </span>
              </div>
              <strong className="stat-value text-danger">₹{data.total_monthly_expenses.toLocaleString('en-IN')}</strong>
              <small>Food, power, staff, Wi-Fi</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Operating Revenue</span>
                <span className="stat-icon"><TrendingUp size={16} /></span>
              </div>
              <strong className="stat-value text-primary">₹{data.total_operating_income.toLocaleString('en-IN')}</strong>
              <small>Excludes security deposits</small>
            </div>
          </div>

          {/* Detail Split: Expense Breakdown & Payment Mode Ledger */}
          <div className="section-grid-dashboard margin-top-16">
            {/* Left: Expense Breakdown */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Operational Expense Breakdown</h2>
                  <p className="muted">Categorized operational costs and percentage distribution.</p>
                </div>
                <span className="badge badge-primary">₹{data.total_monthly_expenses.toLocaleString('en-IN')} Total</span>
              </div>

              {data.expense_breakdown.length === 0 ? (
                <div className="empty-state-card" style={{ padding: '24px 0' }}>
                  <p className="muted-text">No expenses recorded for this selected period.</p>
                </div>
              ) : (
                <div className="expense-bars-list">
                  {data.expense_breakdown.map((item, idx) => (
                    <div key={idx} className="expense-bar-item">
                      <div className="flex-between align-center margin-bottom-4">
                        <strong style={{ fontSize: '12px' }}>{item.category}</strong>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>
                          ₹{item.amount.toLocaleString('en-IN')} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="expense-track">
                        <div
                          className="expense-fill"
                          style={{
                            width: `${Math.min(100, item.percentage)}%`,
                            backgroundColor: idx % 3 === 0 ? '#3b82f6' : idx % 3 === 1 ? '#10b981' : '#f59e0b'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right: Payment Channels & Cashflow Summary */}
            <div className="flex-column gap-16">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Collections by Mode</h2>
                    <p className="muted">Direct channel settlement breakdown</p>
                  </div>
                  <CreditCard size={18} className="muted-text" />
                </div>

                <div className="system-row">
                  <span className="flex-row gap-6 align-center">
                    <span className="status-dot dot-available" />
                    <strong>UPI Collections</strong>
                  </span>
                  <strong className="text-primary">₹{data.upi_collected.toLocaleString('en-IN')}</strong>
                </div>

                <div className="system-row">
                  <span className="flex-row gap-6 align-center">
                    <span className="status-dot dot-occupied" />
                    <strong>Bank Transfers (IMPS/NEFT)</strong>
                  </span>
                  <strong className="text-primary">₹{data.bank_transfers_collected.toLocaleString('en-IN')}</strong>
                </div>

                <div className="system-row">
                  <span className="flex-row gap-6 align-center">
                    <span className="status-dot dot-maintenance" />
                    <strong>Cash Payments</strong>
                  </span>
                  <strong className="text-primary">₹{data.cash_collected.toLocaleString('en-IN')}</strong>
                </div>
              </section>

              <section className="panel" style={{ background: '#f8fafc' }}>
                <div className="panel-heading">
                  <div>
                    <h3>Operating Health Checklist</h3>
                    <p className="muted">Regulatory and Accounting Integrity</p>
                  </div>
                </div>

                <div className="check-row">
                  <span className="check">✓</span>
                  <div>
                    <strong>Deposit Liability Segregation</strong>
                    <small>Security deposits separated from operating income</small>
                  </div>
                  <span className="done">Compliant</span>
                </div>

                <div className="check-row">
                  <span className="check">✓</span>
                  <div>
                    <strong>Prorated Rent Engine</strong>
                    <small>Accurate daily billing for mid-month join/vacate</small>
                  </div>
                  <span className="done">Active</span>
                </div>

                <div className="check-row">
                  <span className="check">✓</span>
                  <div>
                    <strong>Digital Receipt Generation</strong>
                    <small>Signed PDF vouchers with unique receipt numbers</small>
                  </div>
                  <span className="done">Active</span>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

