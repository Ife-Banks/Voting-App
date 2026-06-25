'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Award, Vote, ToggleLeft, ToggleRight, Loader2, TrendingUp, Calendar, Square, BarChart2, ChevronRight, Eye, EyeOff } from 'lucide-react'
import type { Settings, VotingSession } from '@/lib/types'
import { useAdminProfile } from '@/lib/admin-context'

export default function AdminDashboard() {
  const { profile } = useAdminProfile()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [settings, setSettings] = useState<Settings | null>(null)
  const [activeSession, setActiveSession] = useState<VotingSession | null>(null)
  const [stats, setStats] = useState({ students: 0, voted: 0, positions: 0, candidates: 0 })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [togglingResults, setTogglingResults] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [electionName, setElectionName] = useState('')
  const [schoolName, setSchoolName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const [{ data: s }, { data: students }, { data: positions }, { data: candidates }, { data: sessions }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('students').select('id, has_voted'),
      supabase.from('positions').select('id'),
      supabase.from('candidates').select('id'),
      supabase.from('voting_sessions').select('*').eq('is_active', true).maybeSingle(),
    ])
    if (s) { setSettings(s); setElectionName(s.election_name); setSchoolName(s.school_name) }
    if (sessions) setActiveSession(sessions)
    setStats({
      students: students?.length ?? 0,
      voted: students?.filter(s => s.has_voted).length ?? 0,
      positions: positions?.length ?? 0,
      candidates: candidates?.length ?? 0,
    })
    setLoading(false)
  }

  async function toggleVoting() {
    if (!settings) return
    setToggling(true)
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_voting', voting_open: !settings.voting_open }),
    })
    const { data } = await res.json()
    if (data) setSettings(data)
    setToggling(false)
  }

  async function toggleResultsPublic() {
    if (!settings) return
    setTogglingResults(true)
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_results_public', results_public: !settings.results_public }),
    })
    const { data } = await res.json()
    if (data) setSettings(data)
    setTogglingResults(false)
  }

  async function saveSettings() {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', election_name: electionName, school_name: schoolName }),
    })
    const { data } = await res.json()
    if (data) setSettings(data)
    setEditingName(false)
  }

  const turnout = stats.students > 0 ? Math.round((stats.voted / stats.students) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#C9A84C' }} />
    </div>
  )

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Dashboard</h1>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>Election overview and controls</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Registered Students', value: stats.students, icon: Users, color: '#C9A84C' },
          { label: 'Votes Cast', value: stats.voted, icon: Vote, color: '#3D8A6C' },
          { label: 'Positions', value: stats.positions, icon: Award, color: '#C9A84C' },
          { label: 'Candidates', value: stats.candidates, icon: TrendingUp, color: '#3D8A6C' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs" style={{ color: 'rgba(245,240,232,0.45)' }}>{label}</p>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-3xl font-display font-bold" style={{ color: '#F5F0E8' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active session */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#F5F0E8' }}>
            Active Session
          </h2>
          {activeSession ? (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                style={{ background: 'rgba(61,138,108,0.1)', border: '1px solid rgba(61,138,108,0.25)' }}>
                <Calendar size={20} style={{ color: '#3D8A6C' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F5F0E8' }}>{activeSession.title}</p>
                  <p className="text-xs" style={{ color: 'rgba(245,240,232,0.45)' }}>
                    Created {new Date(activeSession.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {isSuperAdmin && (
                <button onClick={async () => {
                  setEndingSession(true)
                  await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'end_session', session_id: activeSession.id }),
                  })
                  setActiveSession(null)
                  setEndingSession(false)
                }} disabled={endingSession}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#E74C3C' }}>
                  {endingSession ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                  End Session
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.35)' }}>No active session</p>
            </div>
          )}
        </div>

        {/* Voting toggle */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#F5F0E8' }}>
            Voting Status
          </h2>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-medium mb-1" style={{ color: '#F5F0E8' }}>
                {settings?.voting_open ? 'Voting is OPEN' : 'Voting is CLOSED'}
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
                {settings?.voting_open
                  ? 'Students can currently cast their votes'
                  : 'Students cannot access the voting portal'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${settings?.voting_open ? 'badge-open' : 'badge-closed'}`}>
              {settings?.voting_open ? 'OPEN' : 'CLOSED'}
            </span>
          </div>

          {isSuperAdmin && (
            <button onClick={toggleVoting} disabled={toggling}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${settings?.voting_open ? 'bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50' : 'btn-gold'}`}>
              {toggling ? <Loader2 size={16} className="animate-spin" /> :
                settings?.voting_open ? <><ToggleLeft size={18} /> Close Voting</> : <><ToggleRight size={18} /> Open Voting</>}
            </button>
          )}
        </div>

        {/* Results Visibility toggle */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#F5F0E8' }}>
            Results Visibility
          </h2>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-medium mb-1" style={{ color: '#F5F0E8' }}>
                {settings?.results_public ? 'Results are PUBLIC' : 'Results are HIDDEN'}
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
                {settings?.results_public
                  ? 'Students can view election results'
                  : 'Students see "Results Not Out Yet"'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${settings?.results_public ? 'badge-open' : 'badge-closed'}`}>
              {settings?.results_public ? 'PUBLIC' : 'HIDDEN'}
            </span>
          </div>

          {isSuperAdmin && (
            <button onClick={toggleResultsPublic} disabled={togglingResults}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${settings?.results_public ? 'bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50' : 'btn-gold'}`}>
              {togglingResults ? <Loader2 size={16} className="animate-spin" /> :
                settings?.results_public ? <><EyeOff size={18} /> Hide Results</> : <><Eye size={18} /> Publish Results</>}
            </button>
          )}
        </div>

        {/* View Results — super admin only */}
        {isSuperAdmin && (
          <a href="/admin/results" className="glass-card rounded-2xl p-6 flex items-center gap-4 hover:bg-white/5 transition-colors group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <BarChart2 size={22} style={{ color: '#C9A84C' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold mb-1" style={{ color: '#F5F0E8' }}>View Election Results</p>
              <p className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>
                See full breakdown of votes per candidate and position
              </p>
            </div>
            <ChevronRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color: '#C9A84C' }} />
          </a>
        )}

        {/* Turnout */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#F5F0E8' }}>
            Voter Turnout
          </h2>
          <div className="flex items-end gap-4 mb-4">
            <p className="text-5xl font-display font-bold gold-text">{turnout}%</p>
            <p className="text-sm pb-2" style={{ color: 'rgba(245,240,232,0.45)' }}>
              {stats.voted} of {stats.students} students voted
            </p>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(201,168,76,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${turnout}%`, background: 'linear-gradient(90deg, #1A4A3A, #C9A84C)' }} />
          </div>
        </div>

        {/* Election settings */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold" style={{ color: '#F5F0E8' }}>
              Election Settings
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
                <label className="block text-xs mb-2" style={{ color: 'rgba(245,240,232,0.55)' }}>Election Name</label>
                <input value={electionName} onChange={e => setElectionName(e.target.value)}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-2" style={{ color: 'rgba(245,240,232,0.55)' }}>School Name</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveSettings} className="btn-gold px-6 py-2.5 rounded-xl text-sm">Save</button>
                <button onClick={() => setEditingName(false)} className="btn-ghost px-6 py-2.5 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(245,240,232,0.4)' }}>Election Name</p>
                <p className="font-medium" style={{ color: '#F5F0E8' }}>{settings?.election_name}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(245,240,232,0.4)' }}>School Name</p>
                <p className="font-medium" style={{ color: '#F5F0E8' }}>{settings?.school_name}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
