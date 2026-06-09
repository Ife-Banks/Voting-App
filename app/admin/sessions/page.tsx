'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { VotingSession } from '@/lib/types'
import { Plus, Loader2, CheckCircle2, XCircle, Clock, Play, Square } from 'lucide-react'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<VotingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
    if (data) setSessions(data)
    setLoading(false)
  }

  async function createSession() {
    if (!newTitle.trim()) return
    setCreating(true)

    // Deactivate any active session, then create the new one as active
    await supabase.from('voting_sessions').update({ is_active: false }).eq('is_active', true)

    const { data, error } = await supabase
      .from('voting_sessions')
      .insert({ title: newTitle.trim(), is_active: true })
      .select()
      .single()

    if (!error && data) {
      // Sync election name in settings
      await supabase.from('settings').update({ election_name: data.title }).eq('id', 1)
      const { data: updated } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
      if (updated) setSessions(updated)
      setNewTitle('')
    }
    setCreating(false)
  }

  async function endSession(session: VotingSession) {
    setActionLoading(session.id)
    await supabase
      .from('voting_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', session.id)
    // Clear election name in settings
    await supabase.from('settings').update({ election_name: 'Voting Closed' }).eq('id', 1)
    await load()
    setActionLoading(null)
  }

  async function activateSession(session: VotingSession) {
    setActionLoading(session.id)
    // Deactivate all, then activate this one
    await supabase.from('voting_sessions').update({ is_active: false }).neq('id', session.id)
    await supabase
      .from('voting_sessions')
      .update({ is_active: true, ended_at: null })
      .eq('id', session.id)
    // Sync election name in settings
    await supabase.from('settings').update({ election_name: session.title }).eq('id', 1)
    await load()
    setActionLoading(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full p-8">
      <Loader2 className="animate-spin" style={{ color: '#C9A84C' }} />
    </div>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Voting Sessions</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>Manage voting periods</p>
        </div>
      </div>

      {/* Create session */}
      <div className="glass-card rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#F5F0E8' }}>
          New Session
        </h2>
        <div className="flex gap-3">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="input-field flex-1 px-4 py-3 rounded-xl text-sm"
            placeholder="e.g. SRC Elections 2026/2027" />
          <button onClick={createSession} disabled={creating || !newTitle.trim()}
            className="btn-gold px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shrink-0">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create
          </button>
        </div>
      </div>

      {/* Sessions list */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'rgba(245,240,232,0.25)' }}>No sessions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Title</th>
                <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Status</th>
                <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Created</th>
                <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Ended</th>
                <th className="text-right px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id}
                  className={`border-b transition-colors hover:bg-white/[0.02] ${i === sessions.length - 1 ? 'border-transparent' : ''}`}
                  style={{ borderColor: 'rgba(201,168,76,0.06)' }}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium" style={{ color: '#F5F0E8' }}>{s.title}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${s.is_active ? 'badge-open' : 'badge-closed'}`}>
                      {s.is_active ? <><CheckCircle2 size={11} /> Active</> : <><XCircle size={11} /> Ended</>}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs" style={{ color: 'rgba(245,240,232,0.5)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs" style={{ color: 'rgba(245,240,232,0.5)' }}>
                      {s.ended_at ? new Date(s.ended_at).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {actionLoading === s.id ? (
                      <Loader2 size={14} className="animate-spin inline" style={{ color: '#C9A84C' }} />
                    ) : s.is_active ? (
                      <button onClick={() => endSession(s)}
                        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ml-auto"
                        style={{ background: 'rgba(192,57,43,0.15)', color: '#E74C3C' }}>
                        <Square size={12} /> End
                      </button>
                    ) : (
                      <button onClick={() => activateSession(s)}
                        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ml-auto"
                        style={{ background: 'rgba(61,138,108,0.15)', color: '#3D8A6C' }}>
                        <Play size={12} /> Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
