'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Position } from '@/lib/types'
import { Download, Trophy, Loader2, User } from 'lucide-react'

export default function ResultsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVoters, setTotalVoters] = useState(0)
  const [totalVoted, setTotalVoted] = useState(0)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: pos }, { data: students }] = await Promise.all([
      supabase.from('positions').select('*, candidates(*) ').order('display_order'),
      supabase.from('students').select('id, has_voted'),
    ])
    if (pos) setPositions(pos)
    if (students) {
      setTotalVoters(students.length)
      setTotalVoted(students.filter(s => s.has_voted).length)
    }
    setLoading(false)
  }

  function exportCSV() {
    const rows: string[] = ['Position,Candidate,Class,Votes,Percentage']
    positions.forEach(pos => {
      const total = (pos.candidates ?? []).reduce((s, c) => s + c.vote_count, 0)
      ;(pos.candidates ?? []).sort((a, b) => b.vote_count - a.vote_count).forEach(c => {
        const pct = total > 0 ? ((c.vote_count / total) * 100).toFixed(1) : '0'
        rows.push(`"${pos.title}","${c.full_name}","${c.class ?? ''}",${c.vote_count},${pct}%`)
      })
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'election-results.csv'
    a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#C9A84C' }} />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text mb-1">Election Results</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            {totalVoted} of {totalVoters} students voted ({totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0}% turnout)
          </p>
        </div>
        <button onClick={exportCSV} className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="space-y-6">
        {positions.map(position => {
          const candidates = [...(position.candidates ?? [])].sort((a, b) => b.vote_count - a.vote_count)
          const totalVotes = candidates.reduce((s, c) => s + c.vote_count, 0)
          const winner = candidates[0]

          return (
            <div key={position.id} className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b flex items-center justify-between"
                style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <div>
                  <h2 className="font-display text-xl font-semibold" style={{ color: '#F5F0E8' }}>
                    {position.title}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.4)' }}>
                    {totalVotes} total votes
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

              <div className="p-6 space-y-4">
                {candidates.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'rgba(245,240,232,0.25)' }}>
                    No candidates added
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

                      {/* Bar */}
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
                        <div className="h-2 rounded-full overflow-hidden"
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
    </div>
  )
}
