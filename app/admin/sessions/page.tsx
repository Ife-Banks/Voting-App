'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { VotingSession } from '@/lib/types'
import { Plus, Loader2, CheckCircle2, XCircle, Play, Square } from 'lucide-react'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<VotingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
    if (data) setSessions(data)
    setLoading(false)
  }

  async function createSession() {
    if (!newTitle.trim()) return
    setCreating(true)

    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_session', title: newTitle }),
    })
    const { sessions } = await res.json()
    if (sessions) setSessions(sessions)
    setNewTitle('')
    setCreating(false)
  }

  async function endSession(session: VotingSession) {
    setActionLoading(session.id)
    await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end_session', id: session.id }),
    })
    await load()
    setActionLoading(null)
  }

  async function activateSession(session: VotingSession) {
    setActionLoading(session.id)
    await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate_session', id: session.id, title: session.title }),
    })
    await load()
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="animate-spin" style={{ color: '#4CAF50' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Voting Sessions</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Manage voting periods</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-display font-semibold mb-4" style={{ color: '#FFFFFF' }}>
          New Session
        </h2>
        <div className="flex flex-col lg:flex-row gap-3">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="input-field flex-1 px-4 py-3 rounded-xl text-sm"
            placeholder="e.g. SRC Elections 2026/2027"
          />
          <button
            onClick={createSession}
            disabled={creating || !newTitle.trim()}
            className="btn-gold px-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shrink-0"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No sessions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(212,168,67,0.1)' }}>
                  <th className="text-left px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Title</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Created</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Ended</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b transition-colors hover:bg-white/[0.02] ${i === sessions.length - 1 ? 'border-transparent' : ''}`}
                    style={{ borderColor: 'rgba(212,168,67,0.06)' }}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{s.title}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${s.is_active ? 'badge-open' : 'badge-closed'}`}>
                        {s.is_active ? <><CheckCircle2 size={11} /> Active</> : <><XCircle size={11} /> Ended</>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {s.ended_at ? new Date(s.ended_at).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {actionLoading === s.id ? (
                        <Loader2 size={14} className="animate-spin inline" style={{ color: '#4CAF50' }} />
                      ) : s.is_active ? (
                        <button
                          onClick={() => endSession(s)}
                          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ml-auto"
                          style={{ background: 'rgba(192,57,43,0.15)', color: '#E74C3C' }}
                        >
                          <Square size={12} /> End
                        </button>
                      ) : (
                        <button
                          onClick={() => activateSession(s)}
                          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ml-auto"
                          style={{ background: 'rgba(58,58,80,0.15)', color: '#3A3A50' }}
                        >
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
