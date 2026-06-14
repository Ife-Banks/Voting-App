'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Position } from '@/lib/types'
import { Trophy, Loader2, User, Vote, LogOut, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ResultsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [votingOpen, setVotingOpen] = useState(true)
  const [resultsPublic, setResultsPublic] = useState(false)
  const [electionName, setElectionName] = useState('SRC Elections')
  const [schoolName, setSchoolName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data?.user) setUserEmail(data.user.email)
        }

        const { data: settings } = await supabase
          .from('settings')
          .select('voting_open, results_public, election_name, school_name')
          .single()

        if (cancelled) return

        if (settings) {
          setVotingOpen(settings.voting_open ?? true)
          setResultsPublic(settings.results_public ?? false)
          setElectionName(settings.election_name ?? 'SRC Elections')
          setSchoolName(settings.school_name ?? '')
        }

        const { data: posData } = await supabase
          .from('positions')
          .select('*, candidates(*)')
          .order('display_order')

        if (cancelled) return
        if (posData) setPositions(posData)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#C9A84C' }} />
      </div>
    )
  }

  if (votingOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <AlertCircle size={36} style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#F5F0E8' }}>
            Voting is Still Open
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.5)' }} className="mb-8">
            Voting is currently ongoing. Results will be published once voting closes.
          </p>
          {userEmail ? (
            <Link href="/vote" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              <Vote size={16} /> Go to Vote
            </Link>
          ) : (
            <Link href="/login" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              Sign In to Vote
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!resultsPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <AlertCircle size={36} style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#F5F0E8' }}>
            Results Not Out Yet
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.5)' }} className="mb-8">
            The admin has not published the results yet. Check back soon.
          </p>
          {userEmail ? (
            <Link href="/vote" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              <Vote size={16} /> Go to Vote
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
              Sign In
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'rgba(201,168,76,0.15)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="font-display text-xl font-semibold gold-text">{electionName}</h1>
          {schoolName && (
            <p className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>{schoolName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs hidden sm:inline" style={{ color: 'rgba(245,240,232,0.4)' }}>
              {userEmail}
            </span>
          )}
          {userEmail ? (
            <button onClick={handleLogout} className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2">
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <Link href="/login" className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2">
              Sign In
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <Trophy size={28} style={{ color: '#C9A84C' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold gold-text mb-2">
            Election Results
          </h2>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            {electionName}
          </p>
        </div>

        <div className="space-y-8">
          {positions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.35)' }}>
                No positions or candidates found.
              </p>
            </div>
          )}

          {positions.map(position => {
            const candidates = [...(position.candidates ?? [])].sort((a, b) => b.vote_count - a.vote_count)
            const totalVotes = candidates.reduce((s, c) => s + c.vote_count, 0)
            const winner = candidates[0]

            return (
              <div key={position.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b flex items-center justify-between"
                  style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                  <div>
                    <h3 className="font-display text-xl font-semibold" style={{ color: '#F5F0E8' }}>
                      {position.title}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.4)' }}>
                      {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {winner && totalVotes > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
                      <Trophy size={14} style={{ color: '#C9A84C' }} />
                      <span className="text-sm font-semibold" style={{ color: '#C9A84C' }}>
                        {winner.full_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  {candidates.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'rgba(245,240,232,0.25)' }}>
                      No candidates
                    </p>
                  )}
                  {candidates.map((candidate, idx) => {
                    const pct = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0
                    const isWinner = idx === 0 && totalVotes > 0

                    return (
                      <div key={candidate.id} className="flex items-center gap-4">
                        {/* Photo */}
                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                          style={{ background: 'linear-gradient(135deg, #1A4A3A, #0A0A0F)' }}>
                          {candidate.photo_url ? (
                            <img src={candidate.photo_url} alt={candidate.full_name}
                              className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User size={20} style={{ color: 'rgba(201,168,76,0.3)' }} />
                            </div>
                          )}
                        </div>

                        {/* Info + Bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium" style={{ color: '#F5F0E8' }}>
                                {candidate.full_name}
                              </p>
                              {isWinner && <Trophy size={12} style={{ color: '#C9A84C' }} />}
                              {candidate.class && (
                                <span className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>
                                  {candidate.class}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-bold" style={{ color: isWinner ? '#C9A84C' : '#F5F0E8' }}>
                                {pct.toFixed(1)}%
                              </span>
                              <span className="text-xs w-14 text-right" style={{ color: 'rgba(245,240,232,0.4)' }}>
                                {candidate.vote_count} vote{candidate.vote_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden"
                            style={{ background: 'rgba(201,168,76,0.08)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: isWinner
                                  ? 'linear-gradient(90deg, #9B7A2E, #E8C97A)'
                                  : 'linear-gradient(90deg, #1A4A3A, #3D8A6C)'
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

        <p className="text-center text-xs mt-10" style={{ color: 'rgba(245,240,232,0.25)' }}>
          Powered by SRC Voting System &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}