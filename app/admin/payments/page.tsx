'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Payment } from '@/lib/types'
import { Loader2, Download, Search } from 'lucide-react'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    // Payments are read via the service-role client exposed by the browser client's schema
    // Since we have the public RLS off for payments, we use the admin client approach
    const res = await fetch('/api/admin/payments')
    if (res.ok) {
      const data = await res.json()
      if (data.payments) setPayments(data.payments)
    }
    setLoading(false)
  }

  function exportCSV() {
    const filtered = search ? payments.filter(p =>
      p.voter_name.toLowerCase().includes(search.toLowerCase()) ||
      p.voter_email.toLowerCase().includes(search.toLowerCase()) ||
      p.tx_ref.toLowerCase().includes(search.toLowerCase())
    ) : payments

    const rows = ['Voter Name,Voter Email,Candidate,Quantity,Price/Vote (₦),Amount (₦),Tx Ref,Status,Date']
    for (const p of filtered) {
      const priceNaira = p.price_per_vote_kobo / 100
      const amountNaira = p.amount_kobo / 100
      rows.push(`"${p.voter_name}","${p.voter_email}",,${p.quantity},${priceNaira},${amountNaira},"${p.tx_ref}",${p.status},${new Date(p.created_at).toISOString()}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'payments-export.csv'
    a.click()
  }

  const filtered = search ? payments.filter(p =>
    p.voter_name.toLowerCase().includes(search.toLowerCase()) ||
    p.voter_email.toLowerCase().includes(search.toLowerCase()) ||
    p.tx_ref.toLowerCase().includes(search.toLowerCase())
  ) : payments

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
          </p>
        </div>
        <button onClick={exportCSV}
          className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Download size={16} /> Export CSV
        </button>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
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
