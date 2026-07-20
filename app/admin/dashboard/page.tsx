'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Award, ToggleLeft, ToggleRight, Loader2, TrendingUp, BarChart2, ChevronRight } from 'lucide-react'
import type { Settings } from '@/lib/types'
import { useAdminProfile } from '@/lib/admin-context'

export default function AdminDashboard() {
  const { profile } = useAdminProfile()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stats, setStats] = useState({ positions: 0, candidates: 0, payments: 0, totalRevenue: 0 })
  const [loading, setLoading] = useState(true)
  const [togglingAward, setTogglingAward] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [awardName, setAwardName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [pricePerVote, setPricePerVote] = useState('100')

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const [{ data: s }, { data: positions }, { data: candidates }, { data: payments }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('positions').select('id'),
      supabase.from('candidates').select('id'),
      supabase.from('payments').select('amount_kobo, status').eq('status', 'success'),
    ])
    if (s) {
      setSettings(s)
      setAwardName(s.award_name)
      setSchoolName(s.school_name)
      setPricePerVote((s.price_per_vote_kobo / 100).toString())
    }
    setStats({
      positions: positions?.length ?? 0,
      candidates: candidates?.length ?? 0,
      payments: payments?.length ?? 0,
      totalRevenue: payments?.reduce((sum, p) => sum + (p as any).amount_kobo, 0) ?? 0,
    })
    setLoading(false)
  }

  async function toggleAwardOpen() {
    if (!settings) return
    setTogglingAward(true)
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_award_open', award_open: !settings.award_open }),
    })
    const { data } = await res.json()
    if (data) setSettings(data)
    setTogglingAward(false)
  }

  async function saveSettings() {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_settings',
        award_name: awardName,
        school_name: schoolName,
        price_per_vote_kobo: Math.round(parseFloat(pricePerVote) * 100),
      }),
    })
    const { data } = await res.json()
    if (data) setSettings(data)
    setEditingName(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#4CAF50' }} />
    </div>
  )

  const revenueInNaira = (stats.totalRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Dashboard</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{settings?.award_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Positions', value: stats.positions, icon: Award, color: '#4CAF50' },
          { label: 'Candidates', value: stats.candidates, icon: TrendingUp, color: '#3A3A50' },
          { label: 'Successful Payments', value: stats.payments, icon: BarChart2, color: '#4CAF50' },
          { label: 'Total Revenue', value: `₦${revenueInNaira}`, icon: TrendingUp, color: '#3A3A50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-3xl font-display font-bold" style={{ color: '#FFFFFF' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Award status toggle */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#FFFFFF' }}>
            Award Status
          </h2>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-medium mb-1" style={{ color: '#FFFFFF' }}>
                {settings?.award_open ? 'Voting is OPEN' : 'Voting is CLOSED'}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {settings?.award_open
                  ? 'Anyone can vote and pay for votes'
                  : 'Vote pages show a closed state'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${settings?.award_open ? 'badge-open' : 'badge-closed'}`}>
              {settings?.award_open ? 'OPEN' : 'CLOSED'}
            </span>
          </div>

          {isSuperAdmin && (
            <button onClick={toggleAwardOpen} disabled={togglingAward}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${settings?.award_open ? 'bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50' : 'btn-gold'}`}>
              {togglingAward ? <Loader2 size={16} className="animate-spin" /> :
                settings?.award_open ? <><ToggleLeft size={18} /> Close Voting</> : <><ToggleRight size={18} /> Open Voting</>}
            </button>
          )}
        </div>

        {/* Price per vote */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#FFFFFF' }}>
            Price Per Vote
          </h2>
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Each vote costs <strong className="gold-text">₦{pricePerVote}</strong>
          </p>
          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>₦</span>
                <input type="number" min={1} value={pricePerVote}
                  onChange={e => setPricePerVote(e.target.value)}
                  className="input-field pl-8 pr-4 py-2.5 rounded-xl text-sm w-28" />
              </div>
              <button onClick={async () => {
                const res = await fetch('/api/admin/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'save_settings',
                    price_per_vote_kobo: Math.round(parseFloat(pricePerVote) * 100),
                  }),
                })
                const { data } = await res.json()
                if (data) setSettings(data)
              }} className="btn-gold px-5 py-2.5 rounded-xl text-xs">
                Update
              </button>
            </div>
          )}
        </div>

        {/* View payments */}
        <a href="/admin/payments" className="glass-card rounded-2xl p-6 flex items-center gap-4 hover:bg-white/5 transition-colors group">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <BarChart2 size={22} style={{ color: '#4CAF50' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold mb-1" style={{ color: '#FFFFFF' }}>View Payments</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              See all transactions with CSV export
            </p>
          </div>
          <ChevronRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color: '#4CAF50' }} />
        </a>

        {/* Award settings */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold" style={{ color: '#FFFFFF' }}>
              Award Settings
            </h2>
            {!editingName && isSuperAdmin && (
              <button onClick={() => setEditingName(true)} className="btn-ghost px-4 py-2 rounded-lg text-xs">
                Edit
              </button>
            )}
          </div>
          {editingName ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Award Name</label>
                <input value={awardName} onChange={e => setAwardName(e.target.value)}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>School Name</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveSettings} className="btn-gold px-6 py-2.5 rounded-xl text-sm">Save</button>
                <button onClick={() => setEditingName(false)} className="btn-ghost px-6 py-2.5 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Award Name</p>
                <p className="font-medium" style={{ color: '#FFFFFF' }}>{settings?.award_name}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>School Name</p>
                <p className="font-medium" style={{ color: '#FFFFFF' }}>{settings?.school_name}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Price Per Vote</p>
                <p className="font-medium" style={{ color: '#FFFFFF' }}>₦{pricePerVote}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
