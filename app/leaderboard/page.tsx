'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Position, Settings } from '@/lib/types'
import { Trophy, Loader2, User, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function LeaderboardPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: pos }, { data: s }] = await Promise.all([
        supabase.from('positions').select('*, candidates(*)').order('display_order'),
        supabase.from('settings').select('*').single(),
      ])
      if (pos) setPositions(pos)
      if (s) setSettings(s)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        (payload) => {
          const updated = payload.new as any
          setPositions(prev => prev.map(p => ({
            ...p,
            candidates: p.candidates?.map(c => c.id === updated.id ? { ...c, ...updated } : c),
          })))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#4CAF50' }} />
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen flex flex-col">
      <header className="border-b" style={{ borderColor: 'rgba(212,168,67,0.15)', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-xl font-semibold gold-text">{settings?.award_name ?? 'NASSA Student Choice Award'}</h1>
            {settings?.school_name && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{settings.school_name}</p>
            )}
          </div>
          <Link href="/awards" className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 w-fit">
            All Categories <ChevronRight size={12} />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <TrendingUp size={28} style={{ color: '#4CAF50' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold gold-text mb-2">Live Leaderboard</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Real-time results across all categories
          </p>
        </div>

        {settings?.results_visible ? (
          <div className="space-y-8">
            {positions.length === 0 && (
              <div className="text-center py-16 glass-card rounded-2xl">
                <p style={{ color: 'rgba(255,255,255,0.3)' }} className="text-sm">
                  No categories or candidates yet.
                </p>
              </div>
            )}

            {positions.map(position => {
              const candidates = [...(position.candidates ?? [])].sort((a, b) => b.vote_count - a.vote_count)
              const totalVotes = candidates.reduce((s, c) => s + c.vote_count, 0)
              const winner = candidates[0]

              return (
                <div key={position.id} className="glass-card rounded-2xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-5 border-b flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: 'rgba(212,168,67,0.1)' }}>
                    <div>
                      <h3 className="font-display text-xl font-semibold" style={{ color: '#FFFFFF' }}>
                        {position.title}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {winner && totalVotes > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl w-fit"
                        style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
                        <Trophy size={14} style={{ color: '#4CAF50' }} />
                        <span className="text-sm font-semibold" style={{ color: '#4CAF50' }}>
                          {winner.full_name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6 space-y-5">
                    {candidates.length === 0 && (
                      <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        No candidates
                      </p>
                    )}

                    {candidates.map((candidate, idx) => {
                      const pct = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0
                      const isWinner = idx === 0 && totalVotes > 0

                      return (
                        <div key={candidate.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #1A1A2E, #0A1A0A)' }}>
                            {candidate.photo_url ? (
                              <img src={candidate.photo_url} alt={candidate.full_name} className="w-full h-full object-cover object-top" />
                            ) : (
                              <User size={20} style={{ color: 'rgba(212,168,67,0.3)' }} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>
                                  #{idx + 1}
                                </span>
                                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                                  {candidate.full_name}
                                </p>
                                {isWinner && <Trophy size={12} style={{ color: '#4CAF50' }} />}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-bold" style={{ color: isWinner ? '#4CAF50' : '#FFFFFF' }}>
                                  {pct.toFixed(1)}%
                                </span>
                                <span className="text-xs w-14 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  {candidate.vote_count} vote{candidate.vote_count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(212,168,67,0.08)' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  background: isWinner
                                    ? 'linear-gradient(90deg, #2E7D32, #66BB6A)'
                                    : 'linear-gradient(90deg, #1A1A2E, #3A3A50)',
                                }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-2xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
              <TrendingUp size={28} style={{ color: 'rgba(212,168,67,0.4)' }} />
            </div>
            <p className="text-lg font-display font-semibold gold-text mb-2">Results coming soon</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Stay tuned — results will be displayed in due time.
            </p>
          </div>
        )}

        <p className="text-center text-xs mt-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {settings?.school_name} &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
