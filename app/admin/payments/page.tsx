'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Payment } from '@/lib/types'
import { Loader2, Download, Search, RefreshCw } from 'lucide-react'

type ReverifyStatus = 'idle' | 'loading' | 'success' | 'failed' | 'still_pending' | 'error'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reverifyStatus, setReverifyStatus] = useState<Record<string, ReverifyStatus>>({})
  const [bulkReverifyStatus, setBulkReverifyStatus] = useState<ReverifyStatus>('idle')
  const [bulkSummary, setBulkSummary] = useState<{ checked: number; succeeded: number; failed: number; still_pending: number } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/admin/payments')
    if (res.ok) {
      const data = await res.json()
      if (data.payments) setPayments(data.payments)
    }
    setLoading(false)
  }

  async function reverifySingle(paymentId: string) {
    setReverifyStatus(prev => ({ ...prev, [paymentId]: 'loading' }))
    try {
      const res = await fetch('/api/admin/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId }),
      })
      const data = await res.json()
      if (data.result) {
        const resultType = data.result.result as ReverifyStatus
        setReverifyStatus(prev => ({ ...prev, [paymentId]: resultType }))
        if (resultType === 'success') {
          // Reload to get updated data
          await load()
        }
      } else {
        setReverifyStatus(prev => ({ ...prev, [paymentId]: 'error' }))
      }
    } catch {
      setReverifyStatus(prev => ({ ...prev, [paymentId]: 'error' }))
    }
  }

  async function reverifyBulk() {
    setBulkReverifyStatus('loading')
    setBulkSummary(null)
    try {
      const res = await fetch('/api/admin/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true }),
      })
      const data = await res.json()
      if (data.summary) {
        setBulkSummary(data.summary)
        setBulkReverifyStatus(data.summary.succeeded > 0 ? 'success' : 'still_pending')
        await load()
      } else {
        setBulkReverifyStatus('error')
      }
    } catch {
      setBulkReverifyStatus('error')
    }
  }

  const filtered = search ? payments.filter(p =>
    p.voter_name.toLowerCase().includes(search.toLowerCase()) ||
    p.voter_email.toLowerCase().includes(search.toLowerCase()) ||
    p.tx_ref.toLowerCase().includes(search.toLowerCase())
  ) : payments

  const pendingCount = payments.filter(p => p.status === 'pending').length

  function exportCSV() {
    const rows = ['Voter Name,Voter Email,Quantity,Price/Vote (₦),Amount (₦),Tx Ref,Status,Date']
    for (const p of filtered) {
      const priceNaira = p.price_per_vote_kobo / 100
      const amountNaira = p.amount_kobo / 100
      rows.push(`"${p.voter_name}","${p.voter_email}",${p.quantity},${priceNaira},${amountNaira},"${p.tx_ref}",${p.status},${new Date(p.created_at).toISOString()}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'payments-export.csv'
    a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#4CAF50' }} />
    </div>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Payments</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {payments.length} total transaction{payments.length !== 1 ? 's' : ''}
            {pendingCount > 0 && <span className="ml-2" style={{ color: '#D4A843' }}>({pendingCount} pending)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button
              onClick={reverifyBulk}
              disabled={bulkReverifyStatus === 'loading'}
              className="btn-ghost px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 border"
              style={{ borderColor: 'rgba(76,175,80,0.3)', color: '#4CAF50' }}
            >
              {bulkReverifyStatus === 'loading'
                ? <Loader2 size={16} className="animate-spin" />
                : <RefreshCw size={16} />
              }
              {bulkReverifyStatus === 'loading' ? 'Re-verifying...' : 'Re-verify pending'}
            </button>
          )}
          <button onClick={exportCSV}
            className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Bulk re-verify summary */}
      {bulkSummary && (
        <div className="mb-6 p-4 rounded-xl border" style={{ background: 'rgba(76,175,80,0.05)', borderColor: 'rgba(76,175,80,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
            Re-verify complete: {bulkSummary.checked} checked,{' '}
            <span style={{ color: '#4CAF50' }}>{bulkSummary.succeeded} succeeded</span>,{' '}
            <span style={{ color: '#E74C3C' }}>{bulkSummary.failed} failed</span>,{' '}
            <span style={{ color: '#D4A843' }}>{bulkSummary.still_pending} still pending</span>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
          placeholder="Search by name, email, or reference..." />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: 'rgba(212,168,67,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                <th className="text-left px-4 py-3 font-medium">Voter</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Quantity</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Date</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const rs = reverifyStatus[p.id] || 'idle'
                return (
                  <tr key={p.id} className="border-b" style={{ borderColor: 'rgba(212,168,67,0.05)' }}>
                    <td className="px-4 py-3" style={{ color: '#FFFFFF' }}>{p.voter_name}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.voter_email}</td>
                    <td className="px-4 py-3" style={{ color: '#FFFFFF' }}>{p.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: '#4CAF50' }}>
                      ₦{(p.amount_kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        p.status === 'success' ? 'badge-open' :
                        p.status === 'pending' ? 'badge-closed' : ''
                      }`}
                      style={{
                        color: p.status === 'success' ? '#4CAF50' : p.status === 'pending' ? '#D4A843' : '#E74C3C',
                        background: p.status === 'success' ? 'rgba(76,175,80,0.1)' : p.status === 'pending' ? 'rgba(212,168,67,0.1)' : 'rgba(231,76,60,0.1)',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.status === 'pending' ? (
                        rs === 'loading' ? (
                          <Loader2 size={14} className="animate-spin mx-auto" style={{ color: '#D4A843' }} />
                        ) : rs === 'success' ? (
                          <span className="text-xs font-semibold" style={{ color: '#4CAF50' }}>Done</span>
                        ) : rs === 'failed' ? (
                          <span className="text-xs font-semibold" style={{ color: '#E74C3C' }}>Failed</span>
                        ) : rs === 'still_pending' ? (
                          <span className="text-xs font-semibold" style={{ color: '#D4A843' }}>Pending</span>
                        ) : (
                          <button
                            onClick={() => reverifySingle(p.id)}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            title="Re-verify this payment"
                          >
                            <RefreshCw size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                          </button>
                        )
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {search ? 'No matching payments' : 'No payments yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
