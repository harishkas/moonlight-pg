import React, { useEffect, useState } from 'react'
import { Plus, Wind, CheckCircle2, XCircle, RefreshCw, Settings, Users } from 'lucide-react'
import { AcSubscription, AcRoomOverview } from '../types'
import AcSubscriptionModal from './AcSubscriptionModal'

export default function AcManagementView() {
  const [acRooms, setAcRooms] = useState<AcRoomOverview[]>([])
  const [subs, setSubs] = useState<AcSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [acRes, subsRes] = await Promise.all([
        fetch('/api/services/ac', { credentials: 'include' }),
        fetch('/api/services/ac/subscriptions', { credentials: 'include' })
      ])
      if (!acRes.ok || !subsRes.ok) throw new Error('Failed to load AC data')
      const acData = await acRes.json()
      const subsData = await subsRes.json()
      setAcRooms(acData)
      setSubs(subsData)
    } catch (e: any) {
      setError(e.message || 'Error loading AC records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function toggleRoomAc(roomId: number, currentHasAc: boolean) {
    try {
      const res = await fetch(`/api/services/ac/configure-room?room_id=${roomId}&has_ac=${!currentHasAc}`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to update room AC status')
      loadData()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="view-container">
      <div className="welcome-row">
        <div>
          <h2>Air Conditioning (AC) Management</h2>
          <p className="muted">Identify AC-equipped rooms, configure fixed fees or fair room-level sharing rules</p>
        </div>
        <div className="flex-row gap-8">
          <button className="secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="primary" onClick={() => { setSelectedRoomId(null); setModalOpen(true) }}>
            <Plus size={16} /> New AC Subscription
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading AC rooms…</div>
      ) : (
        <>
          <h3 className="section-title mb-12">Room AC Status & Equipment</h3>
          <div className="room-ac-grid mb-24">
            {acRooms.map(r => (
              <div key={r.room_id} className={`room-ac-card ${r.has_ac ? 'has-ac' : ''}`}>
                <div className="flex-row justify-between align-center mb-8">
                  <div className="font-bold text-base">Room {r.room_number}</div>
                  <span className={`badge ${r.has_ac ? 'category-badge-ac' : 'badge-outline'}`}>
                    {r.has_ac ? 'AC Equipped' : 'Non-AC'}
                  </span>
                </div>

                <div className="text-xs text-muted mb-12">
                  Floor {r.floor} · {r.room_type} · {r.active_subscriptions_count} active billing rules
                </div>

                <div className="flex-row justify-between align-center pt-8 border-top">
                  <button
                    className="btn-text-xs"
                    onClick={() => toggleRoomAc(r.room_id, r.has_ac)}
                  >
                    Toggle AC Equipment
                  </button>
                  {r.has_ac && (
                    <button
                      className="btn-sm secondary"
                      onClick={() => { setSelectedRoomId(r.room_id); setModalOpen(true) }}
                    >
                      <Plus size={12} /> Assign Rule
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h3 className="section-title mb-12">Active AC Subscriptions & Billing Rules</h3>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Subscription #</th>
                  <th>Room</th>
                  <th>Target Tenant</th>
                  <th>Billing Rule</th>
                  <th className="text-right">Monthly Fee</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.subscription_number}</td>
                    <td><strong>Room {s.room_number}</strong></td>
                    <td>{s.tenant_name || <span className="text-muted">All Room Occupants</span>}</td>
                    <td>
                      <span className="badge category-badge-ac">
                        {s.billing_rule === 'room_split' ? 'Shared Split' : (s.billing_rule === 'tenant_fixed' ? 'Fixed Individual' : 'Included in Rent')}
                      </span>
                    </td>
                    <td className="text-right font-medium">₹{s.monthly_charge.toLocaleString('en-IN')}</td>
                    <td>{s.start_date}</td>
                    <td>
                      <span className="status-pill active">{s.status}</span>
                    </td>
                  </tr>
                ))}

                {subs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-24">
                      No active AC billing subscriptions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AcSubscriptionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={loadData}
        initialRoomId={selectedRoomId}
      />
    </div>
  )
}

